const express = require('express');
const router = express.Router();
const {
    startSession,
    getSession,
    diagnoseSession,
    getSessionHistory,
    updateSessionStatus,
} = require('../controllers/sessionController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All session routes require authentication
router.use(requireAuth);

// Patient routes
router.post('/start', requireRole('patient'), startSession);
router.get('/', requireRole('patient'), getSessionHistory);
router.get('/:id', getSession); // patient (own) OR doctor

// Diagnosis trigger
router.post('/:id/diagnose', diagnoseSession);

// Doctor-only status update
router.patch('/:id/status', requireRole('doctor', 'admin'), updateSessionStatus);

module.exports = router;
