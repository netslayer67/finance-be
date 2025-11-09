import express from 'express';
import { query, validationResult } from 'express-validator';
import FinancialRecord from '../models/FinancialRecord.js';
import FileUpload from '../models/FileUpload.js';
import dayjs from 'dayjs';

const router = express.Router();

// Get dashboard overview data
router.get('/overview', [
    query('timeframe').optional().isIn(['7d', '30d', '90d', '1y', 'all']),
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

        const { timeframe = 'all', organization } = req.query;
        const normalizedOrg = organization ? organization.toUpperCase() : undefined;

        const now = dayjs();
        const baseFilter = {};
        if (normalizedOrg) {
            baseFilter.organization = normalizedOrg;
        }

        const timeframeFilter = { ...baseFilter };
        let previousFilter = { ...baseFilter };
        let range = null;

        const rollingDurations = { '7d': 7, '30d': 30, '90d': 90 };

        if (rollingDurations[timeframe]) {
            const days = rollingDurations[timeframe];
            const start = now.subtract(days, 'day').startOf('day');
            timeframeFilter.periodStart = { $gte: start.toDate() };

            const prevEnd = start.subtract(1, 'day').endOf('day');
            const prevStart = prevEnd.subtract(days, 'day').startOf('day');
            previousFilter.periodStart = {
                $gte: prevStart.toDate(),
                $lte: prevEnd.toDate()
            };

            range = {
                start: start.toDate(),
                end: now.toDate()
            };
        } else if (timeframe === '1y') {
            timeframeFilter.year = now.year();
            previousFilter.year = now.year() - 1;
            range = {
                start: now.startOf('year').toDate(),
                end: now.endOf('year').toDate()
            };
        } else {
            previousFilter = null;
        }

        const aggregateTotals = async (match) => {
            if (!match) return null;

            const totals = await FinancialRecord.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: null,
                        totalIncome: { $sum: '$income.totalIncome' },
                        totalExpenses: { $sum: '$expenses.totalExpenses' },
                        netIncome: { $sum: '$netIncome' },
                        recordCount: { $sum: 1 },
                        avgClosingBalance: { $avg: '$closingBalance' },
                        totalClosingBalance: { $sum: '$closingBalance' }
                    }
                }
            ]);

            return totals[0] || null;
        };

        const [
            currentTotalsRaw,
            previousTotalsRaw,
            lifetimeTotalsRaw,
            yearToDateTotalsRaw,
            organizationBreakdown,
            accountBreakdown,
            coverageData,
            recentActivity
        ] = await Promise.all([
            aggregateTotals(timeframeFilter),
            aggregateTotals(previousFilter),
            aggregateTotals(baseFilter),
            aggregateTotals({ ...baseFilter, year: now.year() }),
            FinancialRecord.aggregate([
                { $match: baseFilter },
                {
                    $group: {
                        _id: '$organization',
                        totalIncome: { $sum: '$income.totalIncome' },
                        totalExpenses: { $sum: '$expenses.totalExpenses' },
                        netIncome: { $sum: '$netIncome' },
                        recordCount: { $sum: 1 }
                    }
                },
                { $sort: { totalIncome: -1 } }
            ]),
            FinancialRecord.aggregate([
                { $match: baseFilter },
                {
                    $group: {
                        _id: '$account',
                        totalIncome: { $sum: '$income.totalIncome' },
                        totalExpenses: { $sum: '$expenses.totalExpenses' },
                        netIncome: { $sum: '$netIncome' },
                        recordCount: { $sum: 1 }
                    }
                },
                { $sort: { totalIncome: -1 } }
            ]),
            FinancialRecord.aggregate([
                { $match: baseFilter },
                {
                    $group: {
                        _id: null,
                        firstPeriod: { $min: '$periodStart' },
                        lastPeriod: { $max: '$periodStart' },
                        monthsCovered: { $addToSet: { month: '$month', year: '$year' } }
                    }
                }
            ]),
            FinancialRecord.find(baseFilter)
                .sort({ periodStart: -1 })
                .limit(10)
                .select('organization month year account income.totalIncome expenses.totalExpenses netIncome periodStart closingBalance')
                .lean()
        ]);

        const formatTotals = (stats) => ({
            totalIncome: stats?.totalIncome || 0,
            totalExpenses: stats?.totalExpenses || 0,
            netIncome: stats?.netIncome || 0,
            recordCount: stats?.recordCount || 0,
            avgClosingBalance: stats?.avgClosingBalance || 0,
            totalClosingBalance: stats?.totalClosingBalance || 0
        });

        const current = formatTotals(currentTotalsRaw);
        const previous = timeframe === 'all'
            ? { ...current }
            : formatTotals(previousTotalsRaw);
        const lifetime = formatTotals(lifetimeTotalsRaw);
        const yearToDateTotals = formatTotals(yearToDateTotalsRaw);

        const calculateChange = (currentValue, previousValue) => {
            if (previousValue === undefined || previousValue === null) {
                return currentValue > 0 ? 100 : 0;
            }

            if (previousValue === 0) {
                return currentValue === 0 ? 0 : 100;
            }

            return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
        };

        const buildTrend = (currentValue, previousValue, inverse = false) => {
            const change = calculateChange(currentValue, previousValue);
            const trend = inverse
                ? currentValue <= previousValue ? 'up' : 'down'
                : currentValue >= previousValue ? 'up' : 'down';

            return {
                current: currentValue,
                previous: previousValue,
                change,
                trend
            };
        };

        const trends = {
            income: buildTrend(current.totalIncome, previous.totalIncome),
            expenses: buildTrend(current.totalExpenses, previous.totalExpenses, true),
            netIncome: buildTrend(current.netIncome, previous.netIncome)
        };

        const coverage = coverageData[0]
            ? {
                firstPeriod: coverageData[0].firstPeriod,
                lastPeriod: coverageData[0].lastPeriod,
                monthsCovered: coverageData[0].monthsCovered?.length || 0
            }
            : null;

        const recentActivityFormatted = recentActivity.map(activity => ({
            ...activity,
            periodLabel: `${activity.month} ${activity.year}`
        }));

        res.json({
            success: true,
            data: {
                current,
                previous,
                trends,
                recentActivity: recentActivityFormatted,
                timeframe,
                organization: normalizedOrg || null,
                range,
                coverage,
                cumulative: {
                    lifetime,
                    yearToDate: yearToDateTotals,
                    organizations: organizationBreakdown,
                    accounts: accountBreakdown
                }
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard overview:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard overview',
            error: error.message
        });
    }
});

// Get chart data for dashboard
router.get('/charts', [
    query('chartType').optional().isIn(['income-expense', 'monthly-trend', 'organization-comparison', 'balance-trend']),
    query('timeframe').optional().isIn(['3m', '6m', '1y', '2y', 'all']),
    query('organization').optional().isIn(['IQRA', 'ICBM'])
], async (req, res) => {
    try {
        const { chartType = 'monthly-trend', timeframe = 'all', organization } = req.query;

        const filter = {};
        const now = dayjs();
        const currentYear = now.year();

        switch (timeframe) {
            case '3m': {
                const start = now.subtract(3, 'month').startOf('month');
                filter.periodStart = { $gte: start.toDate() };
                break;
            }
            case '6m': {
                const start = now.subtract(6, 'month').startOf('month');
                filter.periodStart = { $gte: start.toDate() };
                break;
            }
            case '1y':
                filter.year = currentYear;
                break;
            case '2y':
                filter.year = { $in: [currentYear, currentYear - 1] };
                break;
            case 'all':
            default:
                break;
        }

        if (organization) filter.organization = organization.toUpperCase();

        let chartData = [];

        switch (chartType) {
            case 'income-expense':
                chartData = await FinancialRecord.aggregate([
                    { $match: filter },
                    {
                        $group: {
                            _id: {
                                year: '$year',
                                month: '$month'
                            },
                            monthIndex: { $first: '$monthIndex' },
                            income: { $sum: '$income.totalIncome' },
                            expenses: { $sum: '$expenses.totalExpenses' },
                            netIncome: { $sum: '$netIncome' }
                        }
                    },
                    { $sort: { '_id.year': 1, monthIndex: 1 } },
                    {
                        $addFields: {
                            label: { $concat: ['$_id.month', ' ', { $toString: '$_id.year' }] }
                        }
                    }
                ]);
                break;

            case 'monthly-trend':
                chartData = await FinancialRecord.aggregate([
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
                    { $sort: { '_id.year': 1, monthIndex: 1 } },
                    {
                        $addFields: {
                            label: { $concat: ['$_id.month', ' ', { $toString: '$_id.year' }] }
                        }
                    }
                ]);
                break;

            case 'organization-comparison':
                chartData = await FinancialRecord.aggregate([
                    { $match: filter },
                    {
                        $group: {
                            _id: '$organization',
                            totalIncome: { $sum: '$income.totalIncome' },
                            totalExpenses: { $sum: '$expenses.totalExpenses' },
                            netIncome: { $sum: '$netIncome' },
                            recordCount: { $sum: 1 }
                        }
                    },
                    { $sort: { totalIncome: -1 } },
                    { $addFields: { label: '$_id' } }
                ]);
                break;

            case 'balance-trend':
                chartData = await FinancialRecord.aggregate([
                    { $match: filter },
                    {
                        $group: {
                            _id: {
                                year: '$year',
                                month: '$month'
                            },
                            monthIndex: { $first: '$monthIndex' },
                            avgClosingBalance: { $avg: '$closingBalance' },
                            totalClosingBalance: { $sum: '$closingBalance' }
                        }
                    },
                    { $sort: { '_id.year': 1, monthIndex: 1 } },
                    {
                        $addFields: {
                            label: { $concat: ['$_id.month', ' ', { $toString: '$_id.year' }] }
                        }
                    }
                ]);
                break;
        }

        res.json({
            success: true,
            data: {
                chartType,
                timeframe,
                organization,
                data: chartData
            }
        });

    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chart data',
            error: error.message
        });
    }
});

// Get real-time statistics
router.get('/stats', async (req, res) => {
    try {
        const [totalRecords, recentUploads, monthlyData] = await Promise.all([
            FinancialRecord.countDocuments(),

            FileUpload.find({ uploadStatus: 'completed' })
                .sort({ processedDate: -1 })
                .limit(5)
                .select('originalFileName processedDate recordsProcessed')
                .lean(),

            FinancialRecord.aggregate([
                {
                    $group: {
                        _id: {
                            year: '$year',
                            month: '$month'
                        },
                        monthIndex: { $first: '$monthIndex' },
                        totalIncome: { $sum: '$income.totalIncome' },
                        totalExpenses: { $sum: '$expenses.totalExpenses' },
                        recordCount: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, monthIndex: 1 } },
                { $limit: 12 },
                {
                    $addFields: {
                        label: { $concat: ['$_id.month', ' ', { $toString: '$_id.year' }] }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                totalRecords,
                recentUploads,
                monthlyData,
                lastUpdated: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching real-time stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching real-time stats',
            error: error.message
        });
    }
});

// Get system health
router.get('/health', async (req, res) => {
    try {
        const healthCheck = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                database: 'connected',
                uploads: 'active',
                processing: 'active'
            },
            metrics: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            }
        };

        // Check database connection
        try {
            await FinancialRecord.estimatedDocumentCount();
        } catch (error) {
            healthCheck.services.database = 'error';
            healthCheck.status = 'degraded';
        }

        res.json({
            success: true,
            data: healthCheck
        });

    } catch (error) {
        console.error('Error checking system health:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking system health',
            error: error.message
        });
    }
});

export default router;
