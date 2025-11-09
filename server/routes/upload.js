import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import FileUpload from '../models/FileUpload.js';
import FinancialRecord, { MONTHS } from '../models/FinancialRecord.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Extract month and year from filename
const extractDateFromFilename = (filename) => {
    // Match patterns like "Iqraa income & expense-JAN 25.xlsx"
    const match = filename.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s?(\d{2})/i);
    if (match) {
        return {
            month: match[1].toUpperCase(),
            year: parseInt('20' + match[2])
        };
    }
    return null;
};

// Extract organization from filename
const extractOrganizationFromFilename = (filename) => {
    if (filename.toLowerCase().includes('iqra')) {
        return 'IQRA';
    } else if (filename.toLowerCase().includes('icbm')) {
        return 'ICBM';
    }
    return null;
};

const normalizeText = (value) => {
    if (value === null || value === undefined) return '';

    if (typeof value === 'object') {
        if ('text' in value && value.text) {
            return normalizeText(value.text);
        }

        if (Array.isArray(value.richText)) {
            return normalizeText(value.richText.map(part => part.text).join(' '));
        }
    }

    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const getNumericValue = (cell) => {
    if (!cell) return null;

    let value = cell.result ?? cell.value;

    if (value === null || value === undefined) return null;

    if (typeof value === 'object') {
        if ('result' in value) {
            value = value.result;
        } else if ('text' in value) {
            value = value.text;
        } else if (Array.isArray(value.richText)) {
            value = value.richText.map(part => part.text).join('');
        }
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const isNegative = /^\(.*\)$/.test(trimmed);
        const cleaned = trimmed.replace(/[(),]/g, '').replace(/[^0-9.\-]/g, '');
        if (!cleaned) return null;
        const parsed = Number(cleaned);
        if (!Number.isFinite(parsed)) return null;
        const finalValue = isNegative ? -parsed : parsed;
        return Math.round((finalValue + Number.EPSILON) * 100) / 100;
    }

    return null;
};

const createEmptyIncome = () => ({
    openingBalance: 0,
    tuitionFees: 0,
    hostelFees: 0,
    researchFees: 0,
    examFees: 0,
    transferFromNBS: 0,
    transferFromEcobank: 0,
    transferFromBilalTrust: 0,
    refundFromBilalTrust: 0,
    totalIncome: 0
});

const createEmptyExpenses = () => ({
    paidToZilfqarAli: 0,
    transferToECOBANK_Iqra: 0,
    transferToECOBANK_ICBM: 0,
    transferToNBSBANK_Iqra: 0,
    transferToNBSBANK_ICBM: 0,
    transferToNBS: 0,
    water: 0,
    electricity: 0,
    buildingMaintenance: 0,
    vehicleInsurance: 0,
    vehicleMaintenance: 0,
    fuel: 0,
    ecobankBankCharges: 0,
    nbsBankBankCharges: 0,
    overdrawnInterest: 0,
    salaries: 0,
    salariesIqbal: 0,
    pensionContribution: 0,
    salariesProcessingFee: 0,
    paye: 0,
    partTimeTeachers: 0,
    securityMotelParadise: 0,
    securityICBM: 0,
    otherExpenseStaffCondolences: 0,
    otherExpenseFireExtinguisher: 0,
    otherExpenseStudentResearchFees: 0,
    unityStaffWelfare: 0,
    subscriptionIHAM: 0,
    subscriptionBNL: 0,
    subscriptionOMNIPLUS: 0,
    totalExpenses: 0
});

const FIELD_MAPPINGS = [
    { regex: /opening balance/, section: 'income', field: 'openingBalance' },
    { regex: /tuition fee/, section: 'income', field: 'tuitionFees' },
    { regex: /hostel fee/, section: 'income', field: 'hostelFees' },
    { regex: /research fee/, section: 'income', field: 'researchFees' },
    { regex: /exam fee/, section: 'income', field: 'examFees' },
    { regex: /transfer from nbs/, section: 'income', field: 'transferFromNBS' },
    { regex: /transfer from ecobank/, section: 'income', field: 'transferFromEcobank' },
    { regex: /transfer from bilal/, section: 'income', field: 'transferFromBilalTrust' },
    { regex: /refund from bilal/, section: 'income', field: 'refundFromBilalTrust' },

    { regex: /paid to zilfqar/, section: 'expenses', field: 'paidToZilfqarAli' },
    { regex: /transfer to ecobank iqra/, section: 'expenses', field: 'transferToECOBANK_Iqra' },
    { regex: /transfer to ecobank icbm/, section: 'expenses', field: 'transferToECOBANK_ICBM' },
    { regex: /transfer to nbs bank iqra/, section: 'expenses', field: 'transferToNBSBANK_Iqra' },
    { regex: /transfer to nbs bank icbm/, section: 'expenses', field: 'transferToNBSBANK_ICBM' },
    { regex: /transfer to nbs/, section: 'expenses', field: 'transferToNBS' },
    { regex: /\bwater\b/, section: 'expenses', field: 'water' },
    { regex: /electricity/, section: 'expenses', field: 'electricity' },
    { regex: /building maint/, section: 'expenses', field: 'buildingMaintenance' },
    { regex: /vehicle insurance/, section: 'expenses', field: 'vehicleInsurance' },
    { regex: /vehicle maintenance/, section: 'expenses', field: 'vehicleMaintenance' },
    { regex: /\bfuel\b/, section: 'expenses', field: 'fuel' },
    { regex: /ecobank bank charge/, section: 'expenses', field: 'ecobankBankCharges' },
    { regex: /nbs bank bank charge/, section: 'expenses', field: 'nbsBankBankCharges' },
    { regex: /overdrawn interest/, section: 'expenses', field: 'overdrawnInterest' },
    { regex: /^salaries$/, section: 'expenses', field: 'salaries' },
    { regex: /salaries iqbal/, section: 'expenses', field: 'salariesIqbal' },
    { regex: /pension contribution/, section: 'expenses', field: 'pensionContribution' },
    { regex: /salaries processing fee/, section: 'expenses', field: 'salariesProcessingFee' },
    { regex: /\bpaye\b/, section: 'expenses', field: 'paye' },
    { regex: /part time teacher/, section: 'expenses', field: 'partTimeTeachers' },
    { regex: /security motel/, section: 'expenses', field: 'securityMotelParadise' },
    { regex: /security icbm/, section: 'expenses', field: 'securityICBM' },
    { regex: /staff condolence/, section: 'expenses', field: 'otherExpenseStaffCondolences' },
    { regex: /fire extinguisher/, section: 'expenses', field: 'otherExpenseFireExtinguisher' },
    { regex: /student research fee/, section: 'expenses', field: 'otherExpenseStudentResearchFees' },
    { regex: /unity staff welfare/, section: 'expenses', field: 'unityStaffWelfare' },
    { regex: /subscription[-\s]?iham/, section: 'expenses', field: 'subscriptionIHAM' },
    { regex: /subscription[-\s]?bnl/, section: 'expenses', field: 'subscriptionBNL' },
    { regex: /subscription[-\s]?omn/, section: 'expenses', field: 'subscriptionOMNIPLUS' },

    { regex: /closing balance/, section: 'meta', field: 'closingBalance' },
    { regex: /bank balance/, section: 'meta', field: 'bankBalance' },
    { regex: /unpresented cheque/, section: 'meta', field: 'unpresentedCheques' },
    { regex: /deposit[s]? not shown/, section: 'meta', field: 'depositsNotShown' },
    { regex: /balance after adjustment/, section: 'meta', field: 'balanceAfterAdjustments' }
];

const applyMappedValue = (record, mapping, value) => {
    if (value === null || value === undefined || !record) return;

    if (mapping.section === 'income') {
        record.income[mapping.field] = value;
    } else if (mapping.section === 'expenses') {
        record.expenses[mapping.field] = value;
    } else {
        record[mapping.field] = value;
    }

    record.__hasData = true;
};

const detectOrganizationFromSheet = (sheetName, fallback) => {
    const normalized = (sheetName || '').toLowerCase();
    if (normalized.includes('iqra')) return 'IQRA';
    if (normalized.includes('icbm')) return 'ICBM';
    return fallback || null;
};

const detectSheetStructure = (worksheet) => {
    const accounts = new Map();
    let descriptionColumn = null;

    worksheet.eachRow((row) => {
        row.eachCell((cell, colNumber) => {
            const value = normalizeText(cell?.value);
            if (!value) return;

            if (!accounts.has('Ecobank') && value === 'ecobank') {
                accounts.set('Ecobank', colNumber);
            } else if (!accounts.has('NBS Bank') && value === 'nbs bank') {
                accounts.set('NBS Bank', colNumber);
            }
        });
    });

    if (accounts.size === 0) {
        return null;
    }

    const accountColumns = Array.from(accounts.entries())
        .map(([name, column]) => ({ name, column }))
        .sort((a, b) => a.column - b.column);
    const firstAccountColumn = Math.min(...accountColumns.map(entry => entry.column));
    descriptionColumn = Math.max(1, firstAccountColumn - 1);

    return {
        descriptionColumn,
        accounts: accountColumns
    };
};

const buildRecord = ({ organization, account, month, year, fileMeta, sheetName }) => {
    const monthIndex = MONTHS.indexOf(month);
    if (monthIndex === -1) {
        throw new Error(`Unsupported month "${month}"`);
    }

    return {
        organization,
        month,
        year,
        monthIndex: monthIndex + 1,
        periodStart: new Date(year, monthIndex, 1),
        account,
        income: createEmptyIncome(),
        expenses: createEmptyExpenses(),
        closingBalance: 0,
        bankBalance: 0,
        unpresentedCheques: 0,
        depositsNotShown: 0,
        balanceAfterAdjustments: 0,
        fileName: fileMeta.fileName,
        originalFileName: fileMeta.originalFileName,
        uploadedBy: fileMeta.uploadedBy || 'System',
        uploadDate: new Date(),
        sourceSheet: sheetName,
        __hasData: false
    };
};

const parseWorksheet = (worksheet, context) => {
    const summary = {
        sheetName: worksheet.name,
        organization: null,
        accounts: [],
        rowsParsed: 0,
        recordsCaptured: 0
    };
    const errors = [];

    const organization = detectOrganizationFromSheet(worksheet.name, context.defaultOrganization);
    summary.organization = organization;

    if (!organization) {
        errors.push({
            row: null,
            field: 'organization',
            message: 'Unable to determine organization for this sheet',
            value: { sheet: worksheet.name }
        });
        return { records: [], summary, errors };
    }

    const structure = detectSheetStructure(worksheet);
    if (!structure) {
        errors.push({
            row: null,
            field: 'structure',
            message: 'Could not determine account columns (Ecobank/NBS Bank) in this sheet',
            value: { sheet: worksheet.name }
        });
        return { records: [], summary, errors };
    }

    const accountRecords = structure.accounts.reduce((acc, meta) => {
        acc[meta.name] = buildRecord({
            organization,
            account: meta.name,
            month: context.month,
            year: context.year,
            fileMeta: context.fileMeta,
            sheetName: worksheet.name
        });
        return acc;
    }, {});

    worksheet.eachRow((row) => {
        const descriptionCell = row.getCell(structure.descriptionColumn);
        const description = normalizeText(descriptionCell?.value);
        if (!description || description === 'mwk') return;

        const mapping = FIELD_MAPPINGS.find(entry => entry.regex.test(description));
        if (!mapping) return;

        summary.rowsParsed += 1;

        structure.accounts.forEach(({ name, column }) => {
            const value = getNumericValue(row.getCell(column));
            if (value === null) return;
            applyMappedValue(accountRecords[name], mapping, value);
        });
    });

    const records = Object.values(accountRecords)
        .filter(record => record.__hasData)
        .map(record => {
            delete record.__hasData;
            return record;
        });

    summary.recordsCaptured = records.length;
    summary.accounts = records.map(record => record.account);

    return { records, summary, errors };
};

const parseWorkbook = async (workbook, context) => {
    const parsed = {
        records: [],
        summaries: [],
        errors: []
    };

    workbook.eachSheet((worksheet) => {
        const result = parseWorksheet(worksheet, context);
        parsed.records.push(...result.records);
        parsed.summaries.push(result.summary);
        parsed.errors.push(...result.errors);
    });

    return parsed;
};

// Upload and process Excel file
router.post('/excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const providedOrganization = req.body.organization ? req.body.organization.toUpperCase() : null;
        const providedMonth = req.body.month ? req.body.month.toUpperCase() : null;
        const providedYear = req.body.year ? parseInt(req.body.year, 10) : null;

        if (providedOrganization && !['IQRA', 'ICBM'].includes(providedOrganization)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Organization must be either "IQRA" or "ICBM".'
            });
        }

        const extractedDate = extractDateFromFilename(req.file.originalname);
        const extractedOrg = extractOrganizationFromFilename(req.file.originalname);

        const finalOrganization = providedOrganization || extractedOrg;
        const finalMonth = providedMonth || extractedDate?.month;
        const finalYear = providedYear || extractedDate?.year;

        if (!finalMonth || !MONTHS.includes(finalMonth)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Unable to determine the month for this workbook. Provide it manually or adjust the filename.',
                hint: 'Expected month like JAN, FEB, ... DEC'
            });
        }

        if (!finalYear || Number.isNaN(finalYear)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                success: false,
                message: 'Unable to determine the year for this workbook. Please provide a four digit year.'
            });
        }

        // Create file upload record
        const fileUpload = new FileUpload({
            originalFileName: req.file.originalname,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadStatus: 'processing',
            uploadedBy: req.body.uploadedBy || 'System'
        });

        await fileUpload.save();

        // Process the Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const parseResult = await parseWorkbook(workbook, {
            month: finalMonth,
            year: finalYear,
            defaultOrganization: finalOrganization,
            fileMeta: {
                fileName: req.file.filename,
                originalFileName: req.file.originalname,
                uploadedBy: req.body.uploadedBy || 'System'
            }
        });

        if (parseResult.records.length === 0) {
            fileUpload.uploadStatus = 'failed';
            fileUpload.validationResults = {
                totalRecords: 0,
                validRecords: 0,
                invalidRecords: parseResult.errors.length || 1,
                errors: parseResult.errors.length
                    ? parseResult.errors
                    : [{
                        row: null,
                        field: 'workbook',
                        message: 'No recognizable financial data found in this file',
                        value: {
                            fileName: req.file.originalname
                        }
                    }]
            };
            fileUpload.errorMessage = 'No recognizable financial data found in this file.';
            await fileUpload.save();

            return res.status(400).json({
                success: false,
                message: 'No recognizable financial data found in this file',
                errors: fileUpload.validationResults.errors
            });
        }

        const savedRecords = [];
        const organizationsImpacted = new Set();
        const accountsImpacted = new Set();

        for (const record of parseResult.records) {
            organizationsImpacted.add(record.organization);
            accountsImpacted.add(`${record.organization} - ${record.account}`);

            try {
                const existing = await FinancialRecord.findOne({
                    organization: record.organization,
                    account: record.account,
                    month: record.month,
                    year: record.year
                });

                if (existing) {
                    existing.set({
                        ...record,
                        income: record.income,
                        expenses: record.expenses,
                        closingBalance: record.closingBalance,
                        bankBalance: record.bankBalance,
                        unpresentedCheques: record.unpresentedCheques,
                        depositsNotShown: record.depositsNotShown,
                        balanceAfterAdjustments: record.balanceAfterAdjustments,
                        fileName: record.fileName,
                        originalFileName: record.originalFileName,
                        uploadedBy: record.uploadedBy,
                        uploadDate: new Date(),
                        sourceSheet: record.sourceSheet,
                        periodStart: record.periodStart,
                        monthIndex: record.monthIndex
                    });
                    await existing.save();
                    savedRecords.push(existing._id);
                } else {
                    const financialRecord = new FinancialRecord(record);
                    await financialRecord.save();
                    savedRecords.push(financialRecord._id);
                }
            } catch (error) {
                parseResult.errors.push({
                    row: null,
                    field: 'database',
                    message: `Error saving record: ${error.message}`,
                    value: {
                        sheet: record.sourceSheet,
                        organization: record.organization,
                        account: record.account,
                        month: record.month,
                        year: record.year
                    }
                });
            }
        }

        fileUpload.financialRecords = savedRecords;
        fileUpload.totalRecords = parseResult.records.length;
        fileUpload.recordsProcessed = savedRecords.length;
        fileUpload.processingProgress = 100;
        fileUpload.validationResults = {
            totalRecords: parseResult.records.length,
            validRecords: savedRecords.length,
            invalidRecords: parseResult.errors.length,
            errors: parseResult.errors
        };
        fileUpload.uploadStatus = parseResult.errors.length ? 'completed' : 'completed';
        fileUpload.processedDate = new Date();

        await fileUpload.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.emit('file-uploaded', {
            fileId: fileUpload._id,
            fileName: req.file.originalname,
            recordsProcessed: savedRecords.length,
            errors: parseResult.errors.length,
            period: {
                month: finalMonth,
                year: finalYear
            },
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'File processed successfully',
            data: {
                fileUpload: {
                    id: fileUpload._id,
                    originalFileName: fileUpload.originalFileName,
                    uploadStatus: fileUpload.uploadStatus,
                    recordsProcessed: savedRecords.length,
                    totalRecords: parseResult.records.length,
                    sheetsProcessed: parseResult.summaries.length
                },
                period: {
                    month: finalMonth,
                    year: finalYear
                },
                sheets: parseResult.summaries,
                totals: {
                    organizations: Array.from(organizationsImpacted),
                    accounts: Array.from(accountsImpacted),
                    accountsCount: accountsImpacted.size,
                    recordsCreated: savedRecords.length
                },
                validationResults: fileUpload.validationResults
            }
        });

    } catch (error) {
        console.error('Error processing file:', error);

        // Update file upload status if it exists
        if (req.file) {
            try {
                await FileUpload.findOneAndUpdate(
                    { fileName: req.file.filename },
                    {
                        uploadStatus: 'failed',
                        errorMessage: error.message
                    }
                );
            } catch (updateError) {
                console.error('Error updating file upload status:', updateError);
            }
        }

        res.status(500).json({
            success: false,
            message: 'Error processing file',
            error: error.message
        });
    }
});

// Get upload history
router.get('/history', async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;

        const filter = {};
        if (status) filter.uploadStatus = status;

        const skip = (page - 1) * limit;

        const [uploads, total] = await Promise.all([
            FileUpload.find(filter)
                .sort({ uploadDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('financialRecords', 'organization month year account')
                .lean(),
            FileUpload.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: {
                uploads,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / limit),
                    count: uploads.length,
                    totalRecords: total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching upload history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching upload history',
            error: error.message
        });
    }
});

// Get upload details
router.get('/:id', async (req, res) => {
    try {
        const upload = await FileUpload.findById(req.params.id)
            .populate('financialRecords')
            .lean();

        if (!upload) {
            return res.status(404).json({
                success: false,
                message: 'Upload record not found'
            });
        }

        res.json({
            success: true,
            data: upload
        });
    } catch (error) {
        console.error('Error fetching upload details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching upload details',
            error: error.message
        });
    }
});

export default router;
