import express from 'express';
import { body, query, validationResult } from 'express-validator';
import FinancialRecord from '../models/FinancialRecord.js';

const router = express.Router();

// Get all financial records with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const {
            organization,
            month,
            account,
            year,
            page = 1,
            limit = 20,
            sortBy = 'periodStart',
            sortOrder = 'desc'
        } = req.query;

        // Build filter object - only add non-empty parameters
        const filter = {};
        if (organization && organization.trim()) filter.organization = organization.trim().toUpperCase();
        if (month && month.trim()) filter.month = month.trim().toUpperCase();
        if (account && account.trim()) filter.account = account.trim();
        if (year && year.trim()) filter.year = parseInt(year);

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query
        const [records, total] = await Promise.all([
            FinancialRecord.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            FinancialRecord.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: {
                records,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: records.length,
                    totalRecords: total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching financial records:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching financial records',
            error: error.message
        });
    }
});

// Get single financial record by ID
router.get('/:id', async (req, res) => {
    try {
        const record = await FinancialRecord.findById(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Financial record not found'
            });
        }

        res.json({
            success: true,
            data: record
        });
    } catch (error) {
        console.error('Error fetching financial record:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching financial record',
            error: error.message
        });
    }
});

// Create new financial record
router.post('/', [
    body('organization').isIn(['IQRA', 'ICBM']).withMessage('Invalid organization'),
    body('month').matches(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s\d{2}$/).withMessage('Invalid month format'),
    body('account').isIn(['Ecobank', 'NBS Bank']).withMessage('Invalid account'),
    body('year').isInt({ min: 2020, max: 2030 }).withMessage('Invalid year')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const record = new FinancialRecord(req.body);
        await record.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.emit('financial-record-created', {
            record: record.toObject(),
            timestamp: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Financial record created successfully',
            data: record
        });
    } catch (error) {
        console.error('Error creating financial record:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating financial record',
            error: error.message
        });
    }
});

// Update financial record
router.put('/:id', [
    body('organization').optional().isIn(['IQRA', 'ICBM']),
    body('month').optional().matches(/^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s\d{2}$/),
    body('account').optional().isIn(['Ecobank', 'NBS Bank']),
    body('year').optional().isInt({ min: 2020, max: 2030 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const record = await FinancialRecord.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Financial record not found'
            });
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.emit('financial-record-updated', {
            record: record.toObject(),
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Financial record updated successfully',
            data: record
        });
    } catch (error) {
        console.error('Error updating financial record:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating financial record',
            error: error.message
        });
    }
});

// Delete financial record
router.delete('/:id', async (req, res) => {
    try {
        const record = await FinancialRecord.findByIdAndDelete(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Financial record not found'
            });
        }

        // Emit real-time update
        const io = req.app.get('io');
        io.emit('financial-record-deleted', {
            recordId: req.params.id,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Financial record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting financial record:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting financial record',
            error: error.message
        });
    }
});

// Get summary statistics
router.get('/summary/statistics', async (req, res) => {
    try {
        const { organization, year } = req.query;

        const filter = {};
        if (organization) filter.organization = organization;
        if (year) filter.year = parseInt(year);

        const summary = await FinancialRecord.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: '$income.totalIncome' },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    netIncome: { $sum: '$netIncome' },
                    recordCount: { $sum: 1 },
                    avgClosingBalance: { $avg: '$closingBalance' }
                }
            }
        ]);

        const organizationBreakdown = await FinancialRecord.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$organization',
                    totalIncome: { $sum: '$income.totalIncome' },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    netIncome: { $sum: '$netIncome' },
                    recordCount: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                overall: summary[0] || {
                    totalIncome: 0,
                    totalExpenses: 0,
                    netIncome: 0,
                    recordCount: 0,
                    avgClosingBalance: 0
                },
                byOrganization: organizationBreakdown
            }
        });
    } catch (error) {
        console.error('Error fetching summary statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching summary statistics',
            error: error.message
        });
    }
});

// Get monthly trends
router.get('/trends/monthly', async (req, res) => {
    try {
        const { organization, year } = req.query;

        const filter = {};
        if (organization) filter.organization = organization;
        if (year) filter.year = parseInt(year);

        const trends = await FinancialRecord.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        year: '$year',
                        month: '$month'
                    },
                    monthIndex: { $first: '$monthIndex' },
                    totalIncome: { $sum: '$income.totalIncome' },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    netIncome: { $sum: '$netIncome' },
                    recordCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, monthIndex: 1 } }
        ]);

        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Error fetching monthly trends:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching monthly trends',
            error: error.message
        });
    }
});

export default router;
