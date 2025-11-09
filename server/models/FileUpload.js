import mongoose from 'mongoose';

const FileUploadSchema = new mongoose.Schema({
    originalFileName: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    uploadStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    processingProgress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    errorMessage: {
        type: String
    },
    recordsProcessed: {
        type: Number,
        default: 0
    },
    totalRecords: {
        type: Number,
        default: 0
    },
    uploadedBy: {
        type: String,
        default: 'System'
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    processedDate: {
        type: Date
    },
    financialRecords: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinancialRecord'
    }],
    validationResults: {
        totalRecords: { type: Number, default: 0 },
        validRecords: { type: Number, default: 0 },
        invalidRecords: { type: Number, default: 0 },
        errors: [{
            row: Number,
            field: String,
            message: String,
            value: mongoose.Schema.Types.Mixed
        }]
    }
}, {
    timestamps: true
});

FileUploadSchema.index({ uploadDate: -1 });
FileUploadSchema.index({ uploadStatus: 1 });

export default mongoose.model('FileUpload', FileUploadSchema);