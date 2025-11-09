import express from 'express';
import { query, validationResult } from 'express-validator';
import FinancialRecord from '../models/FinancialRecord.js';

const router = express.Router();

// Get consolidated financial report
router.get('/consolidated', [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('organization').optional().isIn(['IQRA', 'ICBM']),
    query('format').optional().isIn(['json', 'excel'])
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

        const { startDate, endDate, organization, format = 'json' } = req.query;

        // Build filter
        const filter = {};
        if (organization) filter.organization = organization.toUpperCase();
        if (startDate || endDate) {
            filter.periodStart = {};
            if (startDate) filter.periodStart.$gte = new Date(startDate);
            if (endDate) filter.periodStart.$lte = new Date(endDate);
        }

        // Get data for consolidation
        const records = await FinancialRecord.find(filter)
            .sort({ year: 1, monthIndex: 1, organization: 1, account: 1 })
            .lean();

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No financial records found for the specified criteria'
            });
        }

        // Process consolidation logic
        const consolidationResult = consolidateFinancialData(records);

        if (format === 'excel') {
            // Return Excel format (you would implement Excel generation here)
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=consolidated-report.xlsx');
            // Return Excel data
            return res.json({
                success: true,
                message: 'Excel format not implemented yet',
                data: consolidationResult
            });
        }

        res.json({
            success: true,
            data: consolidationResult
        });

    } catch (error) {
        console.error('Error generating consolidated report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating consolidated report',
            error: error.message
        });
    }
});

// Get comparative analysis report
router.get('/comparative', [
    query('period1Start').notEmpty().isISO8601(),
    query('period1End').notEmpty().isISO8601(),
    query('period2Start').notEmpty().isISO8601(),
    query('period2End').notEmpty().isISO8601(),
    query('organization').optional().isIn(['IQRA', 'ICBM'])
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

        const {
            period1Start,
            period1End,
            period2Start,
            period2End,
            organization
        } = req.query;

        const filter = {};
        if (organization) filter.organization = organization.toUpperCase();

        // Get data for both periods
        const [period1Data, period2Data] = await Promise.all([
            getPeriodData(period1Start, period1End, filter),
            getPeriodData(period2Start, period2End, filter)
        ]);

        const comparison = {
            period1: {
                dateRange: { start: period1Start, end: period1End },
                ...period1Data
            },
            period2: {
                dateRange: { start: period2Start, end: period2End },
                ...period2Data
            },
            differences: calculateDifferences(period1Data, period2Data),
            percentageChanges: calculatePercentageChanges(period1Data, period2Data)
        };

        res.json({
            success: true,
            data: comparison
        });

    } catch (error) {
        console.error('Error generating comparative report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating comparative report',
            error: error.message
        });
    }
});

// Get organization-wise summary
router.get('/organization-summary', [
    query('year').optional().isInt({ min: 2020, max: 2030 }),
    query('organization').optional().isIn(['IQRA', 'ICBM'])
], async (req, res) => {
    try {
        const { year, organization } = req.query;

        const filter = {};
        if (year) filter.year = parseInt(year);
        if (organization) filter.organization = organization.toUpperCase();

        const summary = await FinancialRecord.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: {
                        year: '$year',
                        organization: '$organization',
                        month: '$month'
                    },
                    monthIndex: { $first: '$monthIndex' },
                    totalIncome: { $sum: '$income.totalIncome' },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    netIncome: { $sum: '$netIncome' },
                    recordsCount: { $sum: 1 },
                    avgClosingBalance: { $avg: '$closingBalance' }
                }
            },
            { $sort: { '_id.year': 1, monthIndex: 1, '_id.organization': 1 } }
        ]);

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error generating organization summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating organization summary',
            error: error.message
        });
    }
});

// Helper functions
const consolidateFinancialData = (records) => {
    const result = {
        summary: {
            totalIncome: 0,
            totalExpenses: 0,
            netIncome: 0,
            recordCount: records.length
        },
        byOrganization: {},
        byMonth: {},
        byAccount: {},
        trendAnalysis: {},
        records: records
    };

    records.forEach(record => {
        const { organization, month, year, account, monthIndex } = record;

        // Add to summary
        result.summary.totalIncome += record.income?.totalIncome || 0;
        result.summary.totalExpenses += record.expenses?.totalExpenses || 0;

        // By organization
        if (!result.byOrganization[organization]) {
            result.byOrganization[organization] = {
                totalIncome: 0,
                totalExpenses: 0,
                netIncome: 0,
                recordsCount: 0
            };
        }
        result.byOrganization[organization].totalIncome += record.income?.totalIncome || 0;
        result.byOrganization[organization].totalExpenses += record.expenses?.totalExpenses || 0;
        result.byOrganization[organization].recordsCount++;

        // By month
        const monthKey = `${month} ${year}`;
        if (!result.byMonth[monthKey]) {
            result.byMonth[monthKey] = {
                totalIncome: 0,
                totalExpenses: 0,
                netIncome: 0,
                recordsCount: 0,
                monthIndex
            };
        }
        result.byMonth[monthKey].totalIncome += record.income?.totalIncome || 0;
        result.byMonth[monthKey].totalExpenses += record.expenses?.totalExpenses || 0;
        result.byMonth[monthKey].recordsCount++;

        // By account
        if (!result.byAccount[account]) {
            result.byAccount[account] = {
                totalIncome: 0,
                totalExpenses: 0,
                netIncome: 0,
                recordsCount: 0
            };
        }
        result.byAccount[account].totalIncome += record.income?.totalIncome || 0;
        result.byAccount[account].totalExpenses += record.expenses?.totalExpenses || 0;
        result.byAccount[account].recordsCount++;
    });

    // Calculate net income
    result.summary.netIncome = result.summary.totalIncome - result.summary.totalExpenses;
    Object.keys(result.byOrganization).forEach(org => {
        result.byOrganization[org].netIncome =
            result.byOrganization[org].totalIncome - result.byOrganization[org].totalExpenses;
    });
    Object.keys(result.byMonth).forEach(month => {
        result.byMonth[month].netIncome =
            result.byMonth[month].totalIncome - result.byMonth[month].totalExpenses;
    });
    Object.keys(result.byAccount).forEach(account => {
        result.byAccount[account].netIncome =
            result.byAccount[account].totalIncome - result.byAccount[account].totalExpenses;
    });

    return result;
};

const getPeriodData = async (startDate, endDate, filter) => {
    const dateFilter = {
        ...filter,
        periodStart: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    };

    const data = await FinancialRecord.aggregate([
        { $match: dateFilter },
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

    return data[0] || {
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        recordCount: 0,
        avgClosingBalance: 0
    };
};

const calculateDifferences = (period1, period2) => {
    return {
        totalIncome: period2.totalIncome - period1.totalIncome,
        totalExpenses: period2.totalExpenses - period1.totalExpenses,
        netIncome: period2.netIncome - period1.netIncome,
        recordCount: period2.recordCount - period1.recordCount,
        avgClosingBalance: period2.avgClosingBalance - period1.avgClosingBalance
    };
};

const calculatePercentageChanges = (period1, period2) => {
    return {
        totalIncome: period1.totalIncome !== 0 ? ((period2.totalIncome - period1.totalIncome) / period1.totalIncome) * 100 : 0,
        totalExpenses: period1.totalExpenses !== 0 ? ((period2.totalExpenses - period1.totalExpenses) / period1.totalExpenses) * 100 : 0,
        netIncome: period1.netIncome !== 0 ? ((period2.netIncome - period1.netIncome) / period1.netIncome) * 100 : 0,
        avgClosingBalance: period1.avgClosingBalance !== 0 ? ((period2.avgClosingBalance - period1.avgClosingBalance) / period1.avgClosingBalance) * 100 : 0
    };
};

export default router;
