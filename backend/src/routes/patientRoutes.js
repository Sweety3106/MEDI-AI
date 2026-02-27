const express = require('express');
const router = express.Router();
const {
    getProfile,
    updateProfile,
    getTimeline,
    getStats,
    checkMyDrugs,
} = require('../controllers/patientController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All patient routes require auth + patient role
router.use(requireAuth, requireRole('patient'));

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.get('/me/timeline', getTimeline);
router.get('/me/stats', getStats);
router.post('/me/check-drugs', checkMyDrugs);

module.exports = router;
