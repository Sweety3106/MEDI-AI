const express = require('express');
const router = express.Router();
const {
    getStats,
    getUsers,
    verifyUser,
    getSessions,
    getCriticalAlerts,
} = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// All admin routes require auth + admin role
router.use(requireAuth, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.patch('/users/:id/verify', verifyUser);
router.get('/sessions', getSessions);
router.get('/critical-alerts', getCriticalAlerts);

module.exports = router;
