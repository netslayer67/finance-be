import express from 'express';
import { query, validationResult } from 'express-validator';
import ExcelJS from 'exceljs';
import FinancialRecord from '../models/FinancialRecord.js';

const router = express.Router();

const NUMERIC_FORMAT = '#,##0.00';
const AVAILABLE_ORGANIZATIONS = ['IQRA', 'ICBM'];
const AVAILABLE_ACCOUNTS = ['Ecobank', 'NBS Bank'];

const formatExpenseLabel = (value = '') => {
    const withSpaces = value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim();

    return withSpaces
        .split(' ')
        .filter(Boolean)
        .map((word) => {
            if (word.length <= 3 || /^[A-Z]+$/.test(word)) {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
};

const expenseSchema = FinancialRecord.schema.path('expenses');
const expensePaths = expenseSchema?.schema?.paths || {};
const EXPENSE_CATEGORIES = Object.keys(expensePaths)
    .filter((field) => field !== 'totalExpenses')
    .map((field) => ({
        key: field,
        label: formatExpenseLabel(field)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
const EXPENSE_CATEGORY_SET = new Set(EXPENSE_CATEGORIES.map((category) => category.key));
const EXPENSE_CATEGORY_LABEL_MAP = EXPENSE_CATEGORIES.reduce((acc, category) => {
    acc[category.key] = category.label;
    return acc;
}, {});

// Get consolidated financial report
router.get('/consolidated', [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('organization').optional().isIn(AVAILABLE_ORGANIZATIONS),
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
            const workbook = createConsolidatedWorkbook(consolidationResult, {
                startDate,
                endDate,
                organization
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=consolidated-report-${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
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
    query('organization').optional().isIn(AVAILABLE_ORGANIZATIONS)
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

router.get('/expenses/categories', (req, res) => {
    res.json({
        success: true,
        data: {
            categories: EXPENSE_CATEGORIES
        }
    });
});

router.get('/expenses/breakdown', [
    query('startDate').notEmpty().isISO8601(),
    query('endDate').notEmpty().isISO8601(),
    query('organization').optional().isIn(AVAILABLE_ORGANIZATIONS),
    query('account').optional().isIn(AVAILABLE_ACCOUNTS),
    query('categories').optional().custom((value) => {
        if (!value) return true;
        const requested = value.split(',').map((item) => item.trim()).filter(Boolean);
        const invalid = requested.filter((category) => !EXPENSE_CATEGORY_SET.has(category));
        if (invalid.length) {
            throw new Error(`Invalid categories requested: ${invalid.join(', ')}`);
        }
        return true;
    }),
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

        const {
            startDate,
            endDate,
            organization,
            account,
            categories,
            format = 'json'
        } = req.query;

        const start = normaliseDate(startDate);
        const end = normaliseDate(endDate, true);

        if (!start || !end || start > end) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date range supplied'
            });
        }

        let selectedCategories = categories
            ? categories.split(',').map((item) => item.trim()).filter(Boolean)
            : EXPENSE_CATEGORIES.map(({ key }) => key);

        selectedCategories = Array.from(new Set(selectedCategories));

        if (!selectedCategories.length) {
            selectedCategories = EXPENSE_CATEGORIES.map(({ key }) => key);
        }

        const invalidCategories = selectedCategories.filter((category) => !EXPENSE_CATEGORY_SET.has(category));
        if (invalidCategories.length) {
            return res.status(400).json({
                success: false,
                message: `Invalid categories requested: ${invalidCategories.join(', ')}`
            });
        }

        const matchStage = {
            periodStart: {
                $gte: start,
                $lte: end
            }
        };

        if (organization) matchStage.organization = organization.toUpperCase();
        if (account) matchStage.account = account;

        const totalsAggregation = await FinancialRecord.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    ...buildExpenseAggregation(selectedCategories)
                }
            }
        ]);

        if (!totalsAggregation.length) {
            return res.status(404).json({
                success: false,
                message: 'No financial records found for the specified criteria'
            });
        }

        const monthlyAggregation = await FinancialRecord.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        year: '$year',
                        month: '$month',
                        monthIndex: '$monthIndex'
                    },
                    totalExpenses: { $sum: '$expenses.totalExpenses' },
                    ...buildExpenseAggregation(selectedCategories)
                }
            },
            { $sort: { '_id.year': 1, '_id.monthIndex': 1 } }
        ]);

        const totals = totalsAggregation[0];

        const breakdown = selectedCategories.map((category) => {
            const label = getExpenseCategoryLabel(category);
            const total = totals[category] || 0;
            return {
                key: category,
                label,
                total,
                percentage: totals.totalExpenses ? (total / totals.totalExpenses) * 100 : 0,
                monthly: monthlyAggregation.map((month) => ({
                    period: `${month._id.month} ${month._id.year}`,
                    year: month._id.year,
                    month: month._id.month,
                    monthIndex: month._id.monthIndex,
                    value: month[category] || 0
                }))
            };
        });

        const monthlyTotals = monthlyAggregation.map((month) => ({
            period: `${month._id.month} ${month._id.year}`,
            year: month._id.year,
            monthIndex: month._id.monthIndex,
            total: month.totalExpenses || 0,
            categories: selectedCategories.reduce((acc, category) => {
                acc[category] = month[category] || 0;
                return acc;
            }, {})
        }));

        const filtersDescription = formatFiltersDescription({
            organization,
            account,
            startDate,
            endDate
        });

        const payload = {
            summary: {
                totalExpenses: totals.totalExpenses || 0,
                totalRecords: totals.totalRecords || 0,
                range: {
                    start: startDate,
                    end: endDate,
                    label: formatDateRangeLabel(startDate, endDate)
                },
                filters: {
                    organization: organization || 'All',
                    account: account || 'All',
                    description: filtersDescription
                }
            },
            breakdown,
            monthlyTotals,
            selectedCategories,
            filterDescription: filtersDescription
        };

        if (format === 'excel') {
            const workbook = createExpenseBreakdownWorkbook(payload);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=expense-breakdown-${Date.now()}.xlsx`);
            await workbook.xlsx.write(res);
            return res.end();
        }

        res.json({
            success: true,
            data: payload
        });
    } catch (error) {
        console.error('Error generating expense breakdown:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating expense breakdown',
            error: error.message
        });
    }
});

// Get organization-wise summary
router.get('/organization-summary', [
    query('year').optional().isInt({ min: 2020, max: 2030 }),
    query('organization').optional().isIn(AVAILABLE_ORGANIZATIONS)
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
                monthIndex,
                year
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

const buildExpenseAggregation = (categories = []) => {
    return categories.reduce((acc, category) => {
        acc[category] = { $sum: { $ifNull: [`$expenses.${category}`, 0] } };
        return acc;
    }, {});
};

const getExpenseCategoryLabel = (category) => {
    return EXPENSE_CATEGORY_LABEL_MAP[category] || formatExpenseLabel(category);
};

const normaliseDate = (value, isEnd = false) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    if (isEnd) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }

    return date;
};

const formatDateRangeLabel = (start, end) => {
    const parsedStart = start ? new Date(start) : null;
    const parsedEnd = end ? new Date(end) : null;

    const hasValidStart = parsedStart && !Number.isNaN(parsedStart.getTime());
    const hasValidEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime());

    if (!hasValidStart && !hasValidEnd) return 'All records';

    const formatter = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    if (hasValidStart && hasValidEnd) {
        return `${formatter.format(parsedStart)} - ${formatter.format(parsedEnd)}`;
    }

    if (hasValidStart) {
        return `From ${formatter.format(parsedStart)}`;
    }

    return `Until ${formatter.format(parsedEnd)}`;
};

const formatFiltersDescription = ({
    organization,
    account,
    startDate,
    endDate
} = {}) => {
    const parts = [];

    if (organization) parts.push(`Organization: ${organization}`);
    if (account) parts.push(`Account: ${account}`);
    if (startDate || endDate) {
        parts.push(`Range: ${formatDateRangeLabel(startDate, endDate)}`);
    }

    if (!parts.length) {
        return 'All records';
    }

    return parts.join(' | ');
};

const createConsolidatedWorkbook = (data, filters = {}) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Financial Dashboard';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.mergeCells('A1:B1');
    summarySheet.getCell('A1').value = 'Financial Consolidated Report';
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    summarySheet.addRow([]);

    summarySheet.addRow(['Generated', new Date().toLocaleString()]);
    summarySheet.addRow(['Filters', formatFiltersDescription(filters)]);
    summarySheet.addRow(['Period', formatDateRangeLabel(filters.startDate, filters.endDate)]);
    summarySheet.addRow(['Total Records', data.summary.recordCount]);

    const addCurrencyRow = (label, amount) => {
        const row = summarySheet.addRow([label, amount]);
        row.getCell(2).numFmt = NUMERIC_FORMAT;
    };

    addCurrencyRow('Total Income', data.summary.totalIncome);
    addCurrencyRow('Total Expenses', data.summary.totalExpenses);
    addCurrencyRow('Net Income', data.summary.netIncome);

    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;

    const organizationSheet = workbook.addWorksheet('By Organization');
    organizationSheet.columns = [
        { header: 'Organization', key: 'organization', width: 18 },
        { header: 'Total Income', key: 'totalIncome', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Total Expenses', key: 'totalExpenses', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Net Income', key: 'netIncome', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Records', key: 'recordsCount', width: 12 }
    ];

    Object.entries(data.byOrganization).forEach(([organization, stats]) => {
        organizationSheet.addRow({
            organization,
            totalIncome: stats.totalIncome,
            totalExpenses: stats.totalExpenses,
            netIncome: stats.netIncome,
            recordsCount: stats.recordsCount
        });
    });

    const monthSheet = workbook.addWorksheet('By Month');
    monthSheet.columns = [
        { header: 'Period', key: 'period', width: 18 },
        { header: 'Total Income', key: 'totalIncome', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Total Expenses', key: 'totalExpenses', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Net Income', key: 'netIncome', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Records', key: 'recordsCount', width: 12 }
    ];

    Object.entries(data.byMonth)
        .sort(([, a], [, b]) => {
            const yearDiff = (a.year || 0) - (b.year || 0);
            if (yearDiff !== 0) return yearDiff;
            return (a.monthIndex || 0) - (b.monthIndex || 0);
        })
        .forEach(([period, stats]) => {
            monthSheet.addRow({
                period,
                totalIncome: stats.totalIncome,
                totalExpenses: stats.totalExpenses,
                netIncome: stats.netIncome,
                recordsCount: stats.recordsCount || 0
            });
        });

    const accountSheet = workbook.addWorksheet('By Account');
    accountSheet.columns = [
        { header: 'Account', key: 'account', width: 18 },
        { header: 'Total Income', key: 'totalIncome', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Total Expenses', key: 'totalExpenses', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Net Income', key: 'netIncome', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Records', key: 'recordsCount', width: 12 }
    ];

    Object.entries(data.byAccount).forEach(([account, stats]) => {
        accountSheet.addRow({
            account,
            totalIncome: stats.totalIncome,
            totalExpenses: stats.totalExpenses,
            netIncome: stats.netIncome,
            recordsCount: stats.recordsCount
        });
    });

    const detailSheet = workbook.addWorksheet('Detailed Records');
    detailSheet.columns = [
        { header: 'Organization', key: 'organization', width: 15 },
        { header: 'Period', key: 'period', width: 15 },
        { header: 'Account', key: 'account', width: 15 },
        { header: 'Income', key: 'income', width: 15, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Expenses', key: 'expenses', width: 15, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Net Income', key: 'netIncome', width: 15, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Closing Balance', key: 'closingBalance', width: 18, style: { numFmt: NUMERIC_FORMAT } }
    ];

    data.records.forEach((record) => {
        detailSheet.addRow({
            organization: record.organization,
            period: `${record.month} ${record.year}`,
            account: record.account,
            income: record.income?.totalIncome || 0,
            expenses: record.expenses?.totalExpenses || 0,
            netIncome: record.netIncome || 0,
            closingBalance: record.closingBalance || 0
        });
    });

    return workbook;
};

const createExpenseBreakdownWorkbook = (data) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Financial Dashboard';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Expense Summary');
    summarySheet.mergeCells('A1:C1');
    summarySheet.getCell('A1').value = 'Expense Breakdown Report';
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    summarySheet.addRow([]);
    summarySheet.addRow(['Range', data.summary.range?.label || 'All records']);
    summarySheet.addRow(['Filters', data.filterDescription || 'All records']);
    const totalRow = summarySheet.addRow(['Total Expenses', data.summary.totalExpenses]);
    totalRow.getCell(2).numFmt = NUMERIC_FORMAT;
    summarySheet.addRow(['Records', data.summary.totalRecords]);

    const categorySheet = workbook.addWorksheet('Categories');
    categorySheet.columns = [
        { header: 'Category', key: 'category', width: 30 },
        { header: 'Amount', key: 'amount', width: 18, style: { numFmt: NUMERIC_FORMAT } },
        { header: 'Share (%)', key: 'percentage', width: 15, style: { numFmt: '0.00' } }
    ];

    data.breakdown.forEach((category) => {
        categorySheet.addRow({
            category: category.label,
            amount: category.total,
            percentage: category.percentage
        });
    });

    const monthlySheet = workbook.addWorksheet('Monthly Detail');
    const baseColumns = [
        { header: 'Period', key: 'period', width: 18 },
        { header: 'Total Expenses', key: 'total', width: 18, style: { numFmt: NUMERIC_FORMAT } }
    ];

    const categoryColumns = data.selectedCategories.map((categoryKey) => ({
        header: getExpenseCategoryLabel(categoryKey),
        key: categoryKey,
        width: 18,
        style: { numFmt: NUMERIC_FORMAT }
    }));

    monthlySheet.columns = [...baseColumns, ...categoryColumns];

    data.monthlyTotals.forEach((month) => {
        monthlySheet.addRow({
            period: month.period,
            total: month.total,
            ...month.categories
        });
    });

    return workbook;
};

export default router;
