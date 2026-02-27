const User = require('../models/User');
const SymptomSession = require('../models/SymptomSession');
const asyncHandler = require('../utils/asyncHandler');

// ─── GET /api/v1/admin/stats ─────────────────────────────────────
exports.getStats = asyncHandler(async (req, res) => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);

    const [
        patientCount, doctorCount, adminCount,
        sessionsToday, sessionsWeek, sessionsMonth, sessionsAll,
        riskDist, allSessions,
    ] = await Promise.all([
        User.countDocuments({ role: 'patient' }),
        User.countDocuments({ role: 'doctor' }),
        User.countDocuments({ role: 'admin' }),
        SymptomSession.countDocuments({ createdAt: { $gte: todayStart } }),
        SymptomSession.countDocuments({ createdAt: { $gte: weekStart } }),
        SymptomSession.countDocuments({ createdAt: { $gte: monthStart } }),
        SymptomSession.countDocuments(),
        SymptomSession.aggregate([
            { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
        ]),
        SymptomSession.find({}, 'extractedSymptoms createdAt').lean(),
    ]);

    // Risk distribution
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of riskDist) {
        if (r._id) riskDistribution[r._id] = r.count;
    }

    // Symbol frequency across all sessions
    const symptomCounts = {};
    for (const s of allSessions) {
        for (const sym of s.extractedSymptoms || []) {
            if (sym.name) {
                const k = sym.name.toLowerCase();
                symptomCounts[k] = (symptomCounts[k] || 0) + 1;
            }
        }
    }
    const mostCommonSymptoms = Object.entries(symptomCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Avg sessions per day (based on last 30 days)
    const avgSessionsPerDay = sessionsMonth > 0 ? +(sessionsMonth / 30).toFixed(1) : 0;

    res.json({
        success: true,
        data: {
            totalUsers: {
                patients: patientCount,
                doctors: doctorCount,
                admins: adminCount,
                total: patientCount + doctorCount + adminCount,
            },
            totalSessions: {
                today: sessionsToday,
                week: sessionsWeek,
                month: sessionsMonth,
                all: sessionsAll,
            },
            riskDistribution,
            avgSessionsPerDay,
            mostCommonSymptoms,
        },
    });
});

// ─── GET /api/v1/admin/users ─────────────────────────────────────
exports.getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, isVerified } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

    // Attach session counts
    const userIds = users.map(u => u._id);
    const sessionCounts = await SymptomSession.aggregate([
        { $match: { patientId: { $in: userIds } } },
        { $group: { _id: '$patientId', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    for (const sc of sessionCounts) countMap[sc._id.toString()] = sc.count;

    const enriched = users.map(u => ({
        ...u,
        sessionCount: countMap[u._id.toString()] || 0,
    }));

    res.json({
        success: true,
        data: enriched,
        meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
});

// ─── PATCH /api/v1/admin/users/:id/verify ────────────────────────
exports.verifyUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
        req.params.id,
        { isVerified: true },
        { new: true }
    ).select('-passwordHash');

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
        success: true,
        message: `${user.role === 'doctor' ? 'Doctor' : 'User'} account verified`,
        data: { id: user._id, name: user.name, role: user.role, isVerified: user.isVerified },
    });
});

// ─── GET /api/v1/admin/sessions ──────────────────────────────────
exports.getSessions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, riskLevel, status, from, to } = req.query;
    const filter = {};

    if (riskLevel) filter.riskLevel = riskLevel;
    if (status) filter.status = status;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const total = await SymptomSession.countDocuments(filter);
    const sessions = await SymptomSession.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('patientId', 'name email role')
        .lean();

    res.json({
        success: true,
        data: sessions,
        meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
});

// ─── GET /api/v1/admin/critical-alerts ───────────────────────────
exports.getCriticalAlerts = asyncHandler(async (req, res) => {
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const alerts = await SymptomSession.find({
        riskLevel: 'critical',
        createdAt: { $gte: last48h },
    })
        .sort({ riskScore: -1, createdAt: -1 })
        .populate('patientId', 'name email gender dateOfBirth')
        .lean();

    res.json({
        success: true,
        data: alerts.map(a => ({
            sessionId: a._id,
            patient: a.patientId,
            riskScore: a.riskScore,
            triageRecommendation: a.triageRecommendation,
            status: a.status,
            symptoms: a.extractedSymptoms?.map(s => s.name) || [],
            symptomCount: a.extractedSymptoms?.length || 0,
            createdAt: a.createdAt,
            hoursAgo: +((Date.now() - new Date(a.createdAt)) / 3600000).toFixed(1),
            doctorNotes: a.doctorNotes || null,
        })),
        meta: { total: alerts.length, since: last48h },
    });
});
