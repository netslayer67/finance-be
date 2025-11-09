import mongoose from 'mongoose';

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_LOOKUP = MONTHS.reduce((acc, month, index) => {
    acc[month] = index + 1;
    return acc;
}, {});

const FinancialRecordSchema = new mongoose.Schema({
    organization: {
        type: String,
        required: true,
        enum: ['IQRA', 'ICBM'],
        index: true
    },
    month: {
        type: String,
        required: true,
        enum: MONTHS,
        uppercase: true,
        index: true
    },
    monthIndex: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
        index: true
    },
    periodStart: {
        type: Date,
        required: true,
        index: true
    },
    year: {
        type: Number,
        required: true,
        min: 2020,
        max: 2030,
        index: true
    },
    account: {
        type: String,
        required: true,
        enum: ['Ecobank', 'NBS Bank'],
        index: true
    },

    // Income section
    income: {
        openingBalance: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        tuitionFees: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        hostelFees: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        researchFees: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        examFees: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferFromNBS: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferFromEcobank: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferFromBilalTrust: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        refundFromBilalTrust: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        totalIncome: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        }
    },

    // Expenses section
    expenses: {
        paidToZilfqarAli: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferToECOBANK_Iqra: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferToECOBANK_ICBM: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferToNBSBANK_Iqra: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferToNBSBANK_ICBM: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        transferToNBS: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        water: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        electricity: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        buildingMaintenance: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        vehicleInsurance: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        vehicleMaintenance: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        fuel: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        ecobankBankCharges: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        nbsBankBankCharges: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        overdrawnInterest: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        salaries: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        salariesIqbal: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        pensionContribution: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        salariesProcessingFee: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        paye: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        partTimeTeachers: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        securityMotelParadise: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        securityICBM: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        otherExpenseStaffCondolences: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        otherExpenseFireExtinguisher: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        otherExpenseStudentResearchFees: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        unityStaffWelfare: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        subscriptionIHAM: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        subscriptionBNL: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        subscriptionOMNIPLUS: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        },
        totalExpenses: {
            type: Number,
            default: 0,
            set: function (value) {
                return Math.round((value + Number.EPSILON) * 100) / 100;
            }
        }
    },

    // Calculated fields
    closingBalance: {
        type: Number,
        default: 0,
        set: function (value) {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }
    },

    bankBalance: {
        type: Number,
        default: 0,
        set: function (value) {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }
    },

    unpresentedCheques: {
        type: Number,
        default: 0,
        set: function (value) {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }
    },

    depositsNotShown: {
        type: Number,
        default: 0,
        set: function (value) {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }
    },

    balanceAfterAdjustments: {
        type: Number,
        default: 0,
        set: function (value) {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }
    },

    // File metadata
    fileName: {
        type: String,
        required: true
    },
    originalFileName: {
        type: String,
        required: true
    },
    sourceSheet: {
        type: String
    },
    uploadedBy: {
        type: String,
        default: 'System'
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },

    // Validation and status
    isValid: {
        type: Boolean,
        default: true
    },
    validationErrors: [{
        field: String,
        message: String,
        value: mongoose.Schema.Types.Mixed
    }],

    // Derived calculations
    netIncome: {
        type: Number,
        default: 0,
        set: function (value) {
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound indexes for efficient querying
FinancialRecordSchema.index({ organization: 1, month: 1, account: 1 });
FinancialRecordSchema.index({ year: 1, organization: 1 });
FinancialRecordSchema.index({ uploadDate: -1 });
FinancialRecordSchema.index({ periodStart: -1 });

// Virtual for total income calculation
FinancialRecordSchema.virtual('calculatedTotalIncome').get(function () {
    return this.income.openingBalance +
        this.income.tuitionFees +
        this.income.hostelFees +
        this.income.researchFees +
        this.income.examFees +
        this.income.transferFromNBS +
        this.income.transferFromEcobank +
        this.income.transferFromBilalTrust +
        this.income.refundFromBilalTrust;
});

// Virtual for total expenses calculation
FinancialRecordSchema.virtual('calculatedTotalExpenses').get(function () {
    return this.expenses.paidToZilfqarAli +
        this.expenses.transferToECOBANK_Iqra +
        this.expenses.transferToECOBANK_ICBM +
        this.expenses.transferToNBSBANK_Iqra +
        this.expenses.transferToNBSBANK_ICBM +
        this.expenses.transferToNBS +
        this.expenses.water +
        this.expenses.electricity +
        this.expenses.buildingMaintenance +
        this.expenses.vehicleInsurance +
        this.expenses.vehicleMaintenance +
        this.expenses.fuel +
        this.expenses.ecobankBankCharges +
        this.expenses.nbsBankBankCharges +
        this.expenses.overdrawnInterest +
        this.expenses.salaries +
        this.expenses.salariesIqbal +
        this.expenses.pensionContribution +
        this.expenses.salariesProcessingFee +
        this.expenses.paye +
        this.expenses.partTimeTeachers +
        this.expenses.securityMotelParadise +
        this.expenses.securityICBM +
        this.expenses.otherExpenseStaffCondolences +
        this.expenses.otherExpenseFireExtinguisher +
        this.expenses.otherExpenseStudentResearchFees +
        this.expenses.unityStaffWelfare +
        this.expenses.subscriptionIHAM +
        this.expenses.subscriptionBNL +
        this.expenses.subscriptionOMNIPLUS;
});

FinancialRecordSchema.virtual('periodLabel').get(function () {
    if (!this.month || !this.year) return '';
    return `${this.month} ${this.year}`;
});

// Pre-save middleware to calculate derived values
FinancialRecordSchema.pre('save', function (next) {
    // Calculate total income
    this.income.totalIncome = this.calculatedTotalIncome;

    // Calculate total expenses
    this.expenses.totalExpenses = this.calculatedTotalExpenses;

    // Calculate net income
    this.netIncome = this.income.totalIncome - this.expenses.totalExpenses;

    next();
});

// Method to validate record data
FinancialRecordSchema.methods.validateData = function () {
    const errors = [];

    // Check if closing balance matches calculated balance
    const calculatedClosing = this.income.totalIncome - this.expenses.totalExpenses;
    if (Math.abs(this.closingBalance - calculatedClosing) > 0.01) {
        errors.push({
            field: 'closingBalance',
            message: 'Closing balance does not match calculated value',
            value: this.closingBalance
        });
    }

    // Check if balance after adjustments is correct
    const calculatedBalanceAfter = this.bankBalance - this.unpresentedCheques + this.depositsNotShown;
    if (Math.abs(this.balanceAfterAdjustments - calculatedBalanceAfter) > 0.01) {
        errors.push({
            field: 'balanceAfterAdjustments',
            message: 'Balance after adjustments does not match calculated value',
            value: this.balanceAfterAdjustments
        });
    }

    this.validationErrors = errors;
    this.isValid = errors.length === 0;

    return errors;
};

// Static method to get summary by period
FinancialRecordSchema.statics.getSummaryByPeriod = function (startDate, endDate, organization) {
    const matchStage = {
        periodStart: { $gte: startDate, $lte: endDate }
    };

    if (organization) {
        matchStage.organization = organization;
    }

    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    year: '$year',
                    month: '$month',
                    organization: '$organization'
                },
                totalIncome: { $sum: '$income.totalIncome' },
                totalExpenses: { $sum: '$expenses.totalExpenses' },
                netIncome: { $sum: '$netIncome' },
                recordCount: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
};

// Ensure derived month metadata is always populated
FinancialRecordSchema.pre('validate', function (next) {
    if (this.month) {
        const normalizedMonth = this.month.toUpperCase();
        const index = MONTH_LOOKUP[normalizedMonth];

        if (index) {
            this.month = normalizedMonth;
            this.monthIndex = this.monthIndex || index;

            if (!this.periodStart && this.year) {
                this.periodStart = new Date(this.year, index - 1, 1);
            }
        }
    }

    if (this.monthIndex && this.year && !this.periodStart) {
        this.periodStart = new Date(this.year, this.monthIndex - 1, 1);
    }

    next();
});

export default mongoose.model('FinancialRecord', FinancialRecordSchema);
