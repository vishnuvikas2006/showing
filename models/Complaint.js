 const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    complaintId: {
        type: String,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Road & Infrastructure', 'Water Supply', 'Electricity', 'Waste Management', 'Public Safety', 'Other Civic Issues'],
        required: true
    },
    subCategory: {
        type: String,
        default: null
    },
    location: {
        address: {
            type: String,
            required: true
        },
        landmark: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        ward: String,
        zone: String
    },
    media: [{
        url: String,
        type: {
            type: String,
            enum: ['image', 'video', 'document']
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Completion photo after work is done
    completionPhoto: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Work Submitted', 'Resolved', 'Closed', 'Emergency'],
        default: 'Submitted'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical', 'Emergency'],
        default: 'Medium'
    },
    isEmergency: {
        type: Boolean,
        default: false
    },
    citizen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        department: {
            type: String,
            enum: ['Road & Infrastructure', 'Water Supply', 'Electricity', 'Waste Management', 'Public Safety', 'Other']
        },
        officer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        assignedAt: Date
    },
    timeline: [{
        status: String,
        remark: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }],
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        submittedAt: Date
    },
    resolution: {
        resolvedAt: Date,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        remarks: String
    },
    officerReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OfficerReport',
        default: null
    },
    pointsAwarded: {
        submission: { type: Boolean, default: false },
        verification: { type: Boolean, default: false },
        resolution: { type: Boolean, default: false }
    },
    views: {
        type: Number,
        default: 0
    },
    upvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Generate complaint ID before saving
complaintSchema.pre('save', async function(next) {
    if (!this.complaintId) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const count = await mongoose.model('Complaint').countDocuments();
        this.complaintId = `CVC-${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
    }
    
    // Set priority based on category and emergency
    if (this.isEmergency || this.category === 'Public Safety') {
        this.priority = 'Emergency';
    } else if (this.category === 'Water Supply' || this.category === 'Electricity') {
        this.priority = 'High';
    }
    
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
