const mongoose = require('mongoose');

const officerReportSchema = new mongoose.Schema({
    reportId: {
        type: String,
        unique: true
    },
    complaint: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint',
        required: true
    },
    officer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    officerName: {
        type: String,
        required: true
    },
    workDescription: {
        type: String,
        required: true
    },
    materialsUsed: {
        type: String,
        default: ''
    },
    completionDate: {
        type: Date,
        required: true
    },
    billAmount: {
        type: Number,
        required: true
    },
    billFile: {
        type: String,
        default: null
    },
    adminStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Correction Required'],
        default: 'Pending'
    },
    adminRemarks: {
        type: String,
        default: ''
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-generate reportId
officerReportSchema.pre('save', async function(next) {
    if (!this.reportId) {
        const count = await mongoose.model('OfficerReport').countDocuments();
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        this.reportId = `RPT-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('OfficerReport', officerReportSchema);
