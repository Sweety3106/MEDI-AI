const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Auth routes (public)
router.use('/auth', require('./authRoutes'));

// Session management
router.use('/sessions', require('./sessionRoutes'));

// Doctor clinical panel
router.use('/doctors', require('./doctorRoutes'));

// Patient profile & self-service
router.use('/patients', require('./patientRoutes'));

// Admin platform management
router.use('/admin', require('./adminRoutes'));

// Protected clinical stubs (to be expanded)
router.get('/patients', requireAuth, requireRole('patient', 'doctor', 'admin'), (req, res) =>
    res.json({ success: true, message: 'Patient routes - coming soon' })
);
router.get('/doctors/dashboard', requireAuth, requireRole('doctor', 'admin'), (req, res) =>
    res.json({ success: true, message: 'Doctor dashboard - coming soon' })
);
router.get('/ai/status', requireAuth, (req, res) =>
    res.json({ success: true, message: 'AI service proxy - coming soon' })
);
router.get('/admin/users', requireAuth, requireRole('admin'), (req, res) =>
    res.json({ success: true, message: 'Admin panel - coming soon' })
);

module.exports = router;
