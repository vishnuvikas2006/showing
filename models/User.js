 const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['citizen', 'officer', 'admin'],
        default: 'citizen'
    },
    department: {
        type: String,
        enum: ['Road & Infrastructure', 'Water Supply', 'Electricity', 'Waste Management', 'Public Safety', 'Other', null],
        default: null
    },
    rewards: {
        points: {
            type: Number,
            default: 0
        },
        level: {
            type: String,
            enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Responsible Citizen'],
            default: 'Bronze'
        },
        badges: [{
            name: String,
            description: String,
            icon: String,
            dateEarned: {
                type: Date,
                default: Date.now
            }
        }]
    },
    isResponsibleCitizen: {
        type: Boolean,
        default: false
    },
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Update rewards level and check for Responsible Citizen badge
userSchema.methods.updateRewardsLevel = function() {
    const points = this.rewards.points || 0;
    
    // Update level based on points
    if (points >= 1000) {
        this.rewards.level = 'Platinum';
    } else if (points >= 500) {
        this.rewards.level = 'Gold';
    } else if (points >= 200) {
        this.rewards.level = 'Silver';
    } else {
        this.rewards.level = 'Bronze';
    }

    // Responsible Citizen Logic (100+ points)
    const hasResponsibleBadge = this.rewards.badges.some(b => b.name === 'Responsible Citizen');
    
    if (points >= 100 && !hasResponsibleBadge) {
        this.rewards.badges.push({
            name: 'Responsible Citizen',
            description: 'Earned 100+ points by actively participating in civic issues',
            icon: '🏅',
            dateEarned: new Date()
        });
        this.isResponsibleCitizen = true;
    }
    
    return this.rewards;
};

// Add points to user
userSchema.methods.addPoints = function(pointsToAdd) {
    this.rewards.points = (this.rewards.points || 0) + pointsToAdd;
    return this.updateRewardsLevel();
};

module.exports = mongoose.model('User', userSchema);