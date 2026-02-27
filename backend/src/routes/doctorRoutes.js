const express = require('express');
const router = express.Router();
const {
    getDashboard,
    getPatients,
    getPatientHistory,
    getAlerts,
    saveNotes,
} = require('../controllers/doctorController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All doctor routes require auth + doctor/admin role
router.use(requireAuth, requireRole('doctor', 'admin'));

router.get('/dashboard', getDashboard);
router.get('/patients', getPatients);
router.get('/patients/:patientId/history', getPatientHistory);
router.get('/alerts', getAlerts);
router.post('/notes/:sessionId', saveNotes);

module.exports = router;
