const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        enum: ['Road & Infrastructure', 'Water Supply', 'Electricity', 'Waste Management', 'Public Safety', 'Other'],
        required: true,
        unique: true
    },
    description: String,
    headOfficer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    officers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    contactInfo: {
        email: String,
        phone: String,
        address: String
    },
    statistics: {
        totalComplaints: {
            type: Number,
            default: 0
        },
        resolvedComplaints: {
            type: Number,
            default: 0
        },
        pendingComplaints: {
            type: Number,
            default: 0
        },
        avgResolutionTime: {
            type: Number,
            default: 0
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Department', departmentSchema);