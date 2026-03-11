 const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Complaint = require('./models/Complaint');
const Department = require('./models/Department');
const OfficerReport = require('./models/OfficerReport');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Log all requests for debugging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images, videos, and documents are allowed'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/civic_grievance', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
    initializeDatabase();
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Initialize database with default departments and admin
async function initializeDatabase() {
    try {
        // Create default departments
        const departments = [
            'Road & Infrastructure',
            'Water Supply',
            'Electricity',
            'Waste Management',
            'Public Safety',
            'Other'
        ];
        
        for (const deptName of departments) {
            const existingDept = await Department.findOne({ name: deptName });
            if (!existingDept) {
                await Department.create({
                    name: deptName,
                    contactInfo: {
                        email: `${deptName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}@gov.in`,
                        phone: '+91-XXXXXXXXXX'
                    }
                });
                console.log(`✅ Created department: ${deptName}`);
            }
        }
        
        // Create default admin if not exists
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                name: 'System Administrator',
                email: 'admin@gov.in',
                phone: '9999999999',
                password: 'Admin@123',
                role: 'admin',
                rewards: {
                    points: 1000,
                    level: 'Platinum',
                    badges: [{ name: 'Founder', dateEarned: new Date() }]
                }
            });
            console.log('✅ Created default admin user');
            console.log('   Email: admin@gov.in');
            console.log('   Password: Admin@123');
        }
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// ============ AUTH ROUTES ============

// User Registration

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password, role, department } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email or phone already exists' });
        }
        
        // Create new user
        const user = new User({
            name,
            email,
            phone,
            password,
            role: role || 'citizen',
            department: department || null
        });
        
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                department: user.department,
                rewards: user.rewards
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'your_jwt_secret_key',
            { expiresIn: '7d' }
        );
        
        console.log(`User logged in: ${user.email}, Role: ${user.role}`);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                department: user.department,
                rewards: user.rewards
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============ COMPLAINT ROUTES ============

// Submit Complaint
app.post('/api/complaints', authenticateToken, upload.array('media', 5), async (req, res) => {
    try {
        console.log('Received complaint submission:', req.body);
        
        const { title, description, category, location, isEmergency } = req.body;
        
        if (!title || !description || !category || !location) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Parse location if it's a string
        let locationData;
        try {
            locationData = typeof location === 'string' ? JSON.parse(location) : location;
        } catch (e) {
            locationData = { address: location };
        }
        
        // Handle uploaded files
        const media = req.files ? req.files.map(file => ({
            url: `/uploads/${file.filename}`,
            type: file.mimetype.startsWith('image/') ? 'image' : 
                  file.mimetype.startsWith('video/') ? 'video' : 'document'
        })) : [];
        
        // Create complaint
        const complaint = new Complaint({
            title,
            description,
            category,
            location: {
                address: locationData.address || 'Address not provided',
                landmark: locationData.landmark || '',
                coordinates: {
                    lat: locationData.lat || 0,
                    lng: locationData.lng || 0
                }
            },
            media,
            isEmergency: isEmergency === 'true' || isEmergency === true,
            citizen: req.user.id,
            timeline: [{
                status: 'Submitted',
                remark: 'Complaint submitted successfully',
                updatedBy: req.user.id
            }]
        });
        
        // If emergency, set high priority
        if (complaint.isEmergency) {
            complaint.priority = 'Emergency';
            complaint.status = 'Emergency';
            console.log('🚨 EMERGENCY COMPLAINT');
        }
        
        // Save to database
        await complaint.save();
        console.log('✅ Complaint saved with ID:', complaint.complaintId);
        
        // Award 10 points for submitting complaint
        try {
            const user = await User.findById(req.user.id);
            if (user) {
                user.rewards.points = (user.rewards.points || 0) + 10;
                user.updateRewardsLevel();
                await user.save();
            }
            complaint.pointsAwarded.submission = true;
            await complaint.save();
        } catch (rewardError) {
            console.error('Error updating rewards:', rewardError);
        }
        
        res.status(201).json({
            message: 'Complaint submitted successfully',
            complaint: {
                id: complaint._id,
                complaintId: complaint.complaintId,
                status: complaint.status,
                priority: complaint.priority
            }
        });
    } catch (error) {
        console.error('❌ Complaint submission error:', error);
        res.status(500).json({ error: 'Failed to submit complaint: ' + error.message });
    }
});

// Upload completion photo (officer/admin only)
app.post('/api/complaints/:id/completion-photo', authenticateToken, authorize('officer', 'admin'), upload.single('completionPhoto'), async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const photoUrl = `/uploads/${req.file.filename}`;
        
        // Update complaint with completion photo
        complaint.completionPhoto = photoUrl;
        
        // Add to timeline
        complaint.timeline.push({
            status: complaint.status,
            remark: 'Completion photo uploaded',
            updatedBy: req.user.id,
            updatedAt: new Date()
        });
        
        await complaint.save();
        
        res.json({
            message: 'Completion photo uploaded successfully',
            photoUrl
        });
    } catch (error) {
        console.error('Completion photo upload error:', error);
        res.status(500).json({ error: 'Failed to upload completion photo: ' + error.message });
    }
});

// Get Complaints (with filters)
app.get('/api/complaints', authenticateToken, async (req, res) => {
    try {
        const { status, category, page = 1, limit = 10 } = req.query;
        const query = {};
        
        // Apply filters
        if (status) query.status = status;
        if (category) query.category = category;
        
        // Role-based filtering
        if (req.user.role === 'citizen') {
            query.citizen = req.user.id;
        } else if (req.user.role === 'officer') {
            const user = await User.findById(req.user.id);
            if (user && user.department) {
                query['assignedTo.department'] = user.department;
            }
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const complaints = await Complaint.find(query)
            .populate('citizen', 'name email phone')
            .populate('assignedTo.officer', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Complaint.countDocuments(query);
        
        res.json({
            complaints,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Fetch complaints error:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// Get Single Complaint
app.get('/api/complaints/:id', authenticateToken, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('citizen', 'name email phone')
            .populate('assignedTo.officer', 'name email')
            .populate('timeline.updatedBy', 'name role');
        
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        
        // Increment views
        complaint.views += 1;
        await complaint.save();
        
        res.json(complaint);
    } catch (error) {
        console.error('Fetch complaint error:', error);
        res.status(500).json({ error: 'Failed to fetch complaint' });
    }
});

// Update Complaint Status (Officer/Admin only)
app.patch('/api/complaints/:id/status', authenticateToken, authorize('officer', 'admin'), async (req, res) => {
    try {
        const { status, remark } = req.body;
        
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        
        // Update status
        complaint.status = status;
        complaint.timeline.push({
            status,
            remark: remark || `Status updated to ${status}`,
            updatedBy: req.user.id
        });
        
        // If resolved directly by admin, add resolution details
        if (status === 'Resolved' && req.user.role === 'admin') {
            complaint.resolution = {
                resolvedAt: new Date(),
                resolvedBy: req.user.id,
                remarks: remark
            };
        }
        
        await complaint.save();
        
        res.json({
            message: 'Complaint status updated',
            complaint
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update complaint status' });
    }
});

// Upvote Complaint
app.post('/api/complaints/:id/upvote', authenticateToken, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);
        
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        
        // Check if user already upvoted
        if (complaint.upvotes.includes(req.user.id)) {
            // Remove upvote
            complaint.upvotes = complaint.upvotes.filter(id => id.toString() !== req.user.id);
        } else {
            // Add upvote
            complaint.upvotes.push(req.user.id);
        }
        
        await complaint.save();
        
        res.json({ 
            message: 'Upvote updated',
            upvotes: complaint.upvotes.length 
        });
    } catch (error) {
        console.error('Upvote error:', error);
        res.status(500).json({ error: 'Failed to update upvote' });
    }
});

// ============ ADMIN ROUTES ============

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error('Fetch users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all complaints (admin only)
app.get('/api/admin/complaints', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const query = {};
        
        if (status) query.status = status;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const complaints = await Complaint.find(query)
            .populate('citizen', 'name email phone')
            .populate('assignedTo.officer', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Complaint.countDocuments(query);
        
        res.json({
            complaints,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Fetch admin complaints error:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// Assign complaint to officer (admin only)
app.post('/api/admin/assign', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { complaintId, officerId, department } = req.body;
        
        console.log('Assignment request:', { complaintId, officerId, department });
        
        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        
        const officer = await User.findById(officerId);
        if (!officer || officer.role !== 'officer') {
            return res.status(400).json({ error: 'Invalid officer' });
        }
        
        complaint.assignedTo = {
            department: department || officer.department,
            officer: officerId,
            assignedAt: new Date()
        };
        complaint.status = 'Assigned';
        complaint.timeline.push({
            status: 'Assigned',
            remark: `Assigned to ${officer.name} (${department || officer.department})`,
            updatedBy: req.user.id
        });

        // Award 20 points to citizen for complaint verified as valid (first time only)
        if (!complaint.pointsAwarded.verification) {
            complaint.pointsAwarded.verification = true;
            const citizen = await User.findById(complaint.citizen);
            if (citizen) {
                citizen.rewards.points = (citizen.rewards.points || 0) + 20;
                citizen.updateRewardsLevel();
                await citizen.save();
            }
        }

        await complaint.save();

        // Populate officer details for response
        await complaint.populate('assignedTo.officer', 'name email department');
        
        res.json({ 
            message: 'Complaint assigned successfully',
            complaint 
        });
    } catch (error) {
        console.error('Assignment error:', error);
        res.status(500).json({ error: 'Failed to assign complaint: ' + error.message });
    }
});

// Get all officers (admin only)
app.get('/api/admin/officers', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const officers = await User.find({ role: 'officer' }, 'name email department');
        res.json(officers);
    } catch (error) {
        console.error('Fetch officers error:', error);
        res.status(500).json({ error: 'Failed to fetch officers' });
    }
});

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const stats = {};
        
        if (req.user.role === 'citizen') {
            // Citizen stats
            stats.myComplaints = await Complaint.countDocuments({ citizen: req.user.id });
            stats.resolvedComplaints = await Complaint.countDocuments({ 
                citizen: req.user.id, 
                status: 'Resolved' 
            });
            stats.pendingComplaints = await Complaint.countDocuments({ 
                citizen: req.user.id, 
                status: { $nin: ['Resolved', 'Closed'] } 
            });
            stats.emergencyComplaints = await Complaint.countDocuments({ 
                citizen: req.user.id, 
                isEmergency: true 
            });
            
            // User rewards
            const user = await User.findById(req.user.id);
            stats.rewards = user.rewards;
            
        } else if (req.user.role === 'officer') {
            // Officer stats
            const user = await User.findById(req.user.id);
            stats.assignedToMe = await Complaint.countDocuments({ 
                'assignedTo.officer': req.user.id 
            });
            stats.resolvedByMe = await Complaint.countDocuments({ 
                'assignedTo.officer': req.user.id,
                status: 'Resolved' 
            });
            stats.departmentComplaints = await Complaint.countDocuments({ 
                'assignedTo.department': user.department 
            });
            stats.highPriority = await Complaint.countDocuments({ 
                'assignedTo.department': user.department,
                priority: { $in: ['High', 'Critical', 'Emergency'] }
            });
            
        } else if (req.user.role === 'admin') {
            // Admin stats
            stats.totalComplaints = await Complaint.countDocuments();
            stats.totalUsers = await User.countDocuments();
            stats.totalOfficers = await User.countDocuments({ role: 'officer' });
            stats.emergencyComplaints = await Complaint.countDocuments({ isEmergency: true });
            stats.resolvedComplaints = await Complaint.countDocuments({ status: 'Resolved' });
            stats.pendingComplaints = await Complaint.countDocuments({ 
                status: { $nin: ['Resolved', 'Closed'] } 
            });
            
            // Category distribution
            const categories = await Complaint.aggregate([
                { $group: { _id: '$category', count: { $sum: 1 } } }
            ]);
            stats.categoryDistribution = categories;
        }
        
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Submit Feedback
app.post('/api/complaints/:id/feedback', authenticateToken, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }
        
        // Check if user is the citizen who filed the complaint
        if (complaint.citizen.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You can only provide feedback on your own complaints' });
        }
        
        complaint.feedback = {
            rating,
            comment,
            submittedAt: new Date()
        };
        
        await complaint.save();
        
        // Add extra rewards for feedback
        const user = await User.findById(req.user.id);
        if (user) {
            user.rewards.points += 2;
            user.updateRewardsLevel();
            await user.save();
        }
        
        res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// ============ OFFICER REPORT ROUTES ============

// Officer submits work completion report
app.post('/api/reports', authenticateToken, authorize('officer'), upload.single('billFile'), async (req, res) => {
    try {
        const { complaintId, workDescription, materialsUsed, completionDate, billAmount } = req.body;

        if (!complaintId || !workDescription || !completionDate || !billAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const complaint = await Complaint.findById(complaintId);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        // Ensure officer is assigned to this complaint
        if (complaint.assignedTo.officer && complaint.assignedTo.officer.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You are not assigned to this complaint' });
        }

        const officerUser = await User.findById(req.user.id);

        const billFile = req.file ? `/uploads/${req.file.filename}` : null;

        const report = new OfficerReport({
            complaint: complaintId,
            officer: req.user.id,
            officerName: officerUser.name,
            workDescription,
            materialsUsed: materialsUsed || '',
            completionDate: new Date(completionDate),
            billAmount: parseFloat(billAmount),
            billFile
        });

        await report.save();

        // Update complaint status to Work Submitted and link report
        complaint.status = 'Work Submitted';
        complaint.officerReport = report._id;
        complaint.timeline.push({
            status: 'Work Submitted',
            remark: `Work completion report submitted by ${officerUser.name}. Bill Amount: ₹${billAmount}`,
            updatedBy: req.user.id
        });
        await complaint.save();

        res.status(201).json({
            message: 'Work report submitted successfully. Awaiting admin approval.',
            report: { id: report._id, reportId: report.reportId }
        });
    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({ error: 'Failed to submit report: ' + error.message });
    }
});

// Get officer reports (officer: own, admin: all)
app.get('/api/reports', authenticateToken, async (req, res) => {
    try {
        const query = {};
        if (req.user.role === 'officer') {
            query.officer = req.user.id;
        }

        const reports = await OfficerReport.find(query)
            .populate('complaint', 'complaintId title category status')
            .populate('officer', 'name email department')
            .sort({ createdAt: -1 });

        res.json(reports);
    } catch (error) {
        console.error('Fetch reports error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get single report
app.get('/api/reports/:id', authenticateToken, async (req, res) => {
    try {
        const report = await OfficerReport.findById(req.params.id)
            .populate('complaint', 'complaintId title category status citizen')
            .populate('officer', 'name email department')
            .populate('reviewedBy', 'name');

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Fetch report error:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Admin reviews officer report (Approve / Reject / Correction Required)
app.patch('/api/reports/:id/review', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { adminStatus, adminRemarks } = req.body;

        if (!['Approved', 'Rejected', 'Correction Required'].includes(adminStatus)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const report = await OfficerReport.findById(req.params.id).populate('complaint');
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        report.adminStatus = adminStatus;
        report.adminRemarks = adminRemarks || '';
        report.reviewedBy = req.user.id;
        report.reviewedAt = new Date();
        await report.save();

        const complaint = await Complaint.findById(report.complaint._id);

        if (adminStatus === 'Approved') {
            // Set complaint to Resolved
            complaint.status = 'Resolved';
            complaint.resolution = {
                resolvedAt: new Date(),
                resolvedBy: req.user.id,
                remarks: adminRemarks || 'Work approved by admin'
            };
            complaint.timeline.push({
                status: 'Resolved',
                remark: `Work report approved by admin. ${adminRemarks || ''}`,
                updatedBy: req.user.id
            });

            // Award 30 points to citizen for resolution (first time only)
            if (!complaint.pointsAwarded.resolution) {
                complaint.pointsAwarded.resolution = true;
                const citizen = await User.findById(complaint.citizen);
                if (citizen) {
                    citizen.rewards.points = (citizen.rewards.points || 0) + 30;
                    citizen.updateRewardsLevel();
                    await citizen.save();
                }
            }
        } else if (adminStatus === 'Rejected') {
            complaint.status = 'In Progress';
            complaint.officerReport = null;
            complaint.timeline.push({
                status: 'In Progress',
                remark: `Work report rejected by admin. Reason: ${adminRemarks || 'Not specified'}`,
                updatedBy: req.user.id
            });
        } else if (adminStatus === 'Correction Required') {
            complaint.timeline.push({
                status: 'Work Submitted',
                remark: `Correction required: ${adminRemarks || 'Please revise and resubmit'}`,
                updatedBy: req.user.id
            });
        }

        await complaint.save();

        res.json({ message: `Report ${adminStatus} successfully`, report });
    } catch (error) {
        console.error('Report review error:', error);
        res.status(500).json({ error: 'Failed to review report: ' + error.message });
    }
});

// Admin: Citizen leaderboard (top citizens by points)
app.get('/api/admin/leaderboard', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const citizens = await User.find({ role: 'citizen', isActive: true }, '-password')
            .sort({ 'rewards.points': -1 })
            .limit(20);

        // Enrich with complaint counts
        const leaderboard = await Promise.all(citizens.map(async (c) => {
            const totalComplaints = await Complaint.countDocuments({ citizen: c._id });
            const resolvedComplaints = await Complaint.countDocuments({ citizen: c._id, status: 'Resolved' });
            return {
                _id: c._id,
                name: c.name,
                email: c.email,
                points: c.rewards.points || 0,
                level: c.rewards.level,
                badges: c.rewards.badges,
                isResponsibleCitizen: c.isResponsibleCitizen,
                totalComplaints,
                resolvedComplaints
            };
        }));

        res.json(leaderboard);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ============ PAGE ROUTES ============

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/report', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/report.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/complaints', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'complaints.html'));
});

app.get('/complaints.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'complaints.html'));
});

app.get('/officer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'officer.html'));
});

app.get('/officer.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'officer.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is working!',
        timestamp: new Date().toISOString(),
        status: 'online'
    });
});

// Catch-all route for debugging
app.use((req, res) => {
    console.log(`404 - Page not found: ${req.url}`);
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📱 Test endpoint: http://localhost:${PORT}/api/test`);
    console.log(`🔑 Login page: http://localhost:${PORT}/`);
    console.log(`👤 Admin login: admin@gov.in / Admin@123\n`);
});
