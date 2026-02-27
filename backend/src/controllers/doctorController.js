const SymptomSession = require('../models/SymptomSession');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// ─── GET /api/v1/doctors/dashboard ───────────────────────────────
exports.getDashboard = asyncHandler(async (req, res) => {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
        pendingReviews,
        todayPatients,
        criticalAlerts,
        recentSessions,
    ] = await Promise.all([
        // Unreviewed sessions (status = pending)
        SymptomSession.countDocuments({ status: 'pending' }),

        // Sessions started today (unique patients)
        SymptomSession.distinct('patientId', { createdAt: { $gte: todayStart } }).then(ids => ids.length),

        // Critical sessions in last 24h
        SymptomSession.find({ riskLevel: 'critical', createdAt: { $gte: last24h } })
            .sort({ riskScore: -1 })
            .limit(10)
            .populate('patientId', 'name email gender dateOfBirth')
            .lean(),

        // Most recent 5 sessions across all patients
        SymptomSession.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('patientId', 'name email')
            .lean(),
    ]);

    res.json({
        success: true,
        data: {
            pendingReviews,
            todayPatients,
            criticalAlerts: criticalAlerts.map(formatSessionSummary),
            recentSessions: recentSessions.map(formatSessionSummary),
        },
    });
});

// ─── GET /api/v1/doctors/patients ────────────────────────────────
exports.getPatients = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Aggregate: distinct patients with their latest session info
    const patients = await SymptomSession.aggregate([
        {
            $sort: { createdAt: -1 },
        },
        {
            $group: {
                _id: '$patientId',
                lastSessionDate: { $first: '$createdAt' },
                lastRiskLevel: { $first: '$riskLevel' },
                lastRiskScore: { $first: '$riskScore' },
                totalSessions: { $sum: 1 },
                totalSymptoms: { $sum: { $size: '$extractedSymptoms' } },
                lastStatus: { $first: '$status' },
            },
        },
        { $sort: { lastSessionDate: -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'patient',
            },
        },
        { $unwind: '$patient' },
        {
            $project: {
                _id: 1,
                name: '$patient.name',
                email: '$patient.email',
                gender: '$patient.gender',
                dateOfBirth: '$patient.dateOfBirth',
                lastSessionDate: 1,
                lastRiskLevel: 1,
                lastRiskScore: 1,
                totalSessions: 1,
                totalSymptoms: 1,
                lastStatus: 1,
            },
        },
    ]);

    const total = await SymptomSession.distinct('patientId').then(ids => ids.length);

    res.json({
        success: true,
        data: patients,
        meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
});

// ─── GET /api/v1/doctors/patients/:patientId/history ─────────────
exports.getPatientHistory = asyncHandler(async (req, res) => {
    const { patientId } = req.params;

    // Verify patient exists
    const patient = await User.findById(patientId).select('name email gender dateOfBirth chronicConditions currentMedications').lean();
    if (!patient || patient.role === 'doctor') {
        return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const sessions = await SymptomSession.find({ patientId })
        .sort({ createdAt: -1 })
        .lean();

    // Format for timeline view
    const timeline = sessions.map(s => ({
        sessionId: s._id,
        date: s.createdAt,
        riskLevel: s.riskLevel,
        riskScore: s.riskScore,
        status: s.status,
        triageRecommendation: s.triageRecommendation,
        symptomCount: s.extractedSymptoms?.length || 0,
        symptoms: s.extractedSymptoms?.map(sym => sym.name) || [],
        doctorNotes: s.doctorNotes,
    }));

    res.json({
        success: true,
        data: {
            patient,
            timeline,
            summary: {
                totalSessions: sessions.length,
                avgRiskScore: sessions.length
                    ? Math.round(sessions.reduce((s, x) => s + (x.riskScore || 0), 0) / sessions.length)
                    : 0,
                criticalCount: sessions.filter(s => s.riskLevel === 'critical').length,
                pendingCount: sessions.filter(s => s.status === 'pending').length,
            },
        },
    });
});

// ─── GET /api/v1/doctors/alerts ──────────────────────────────────
exports.getAlerts = asyncHandler(async (req, res) => {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const alerts = await SymptomSession.find({
        riskLevel: { $in: ['critical', 'high'] },
        createdAt: { $gte: last24h },
    })
        .sort({ riskScore: -1 })
        .populate('patientId', 'name email gender dateOfBirth')
        .lean();

    res.json({
        success: true,
        data: alerts.map(a => ({
            sessionId: a._id,
            patient: a.patientId,
            riskLevel: a.riskLevel,
            riskScore: a.riskScore,
            triageRecommendation: a.triageRecommendation,
            symptoms: a.extractedSymptoms?.map(s => s.name) || [],
            symptomCount: a.extractedSymptoms?.length || 0,
            status: a.status,
            createdAt: a.createdAt,
            ageMinutes: Math.floor((Date.now() - new Date(a.createdAt)) / 60000),
        })),
        meta: { total: alerts.length, since: last24h },
    });
});

// ─── POST /api/v1/doctors/notes/:sessionId ───────────────────────
exports.saveNotes = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { notes, markReviewed = true } = req.body;

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Notes cannot be empty' });
    }

    const session = await SymptomSession.findByIdAndUpdate(
        sessionId,
        {
            doctorNotes: notes.trim(),
            ...(markReviewed && { status: 'reviewed' }),
        },
        { new: true }
    );

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({
        success: true,
        message: markReviewed ? 'Notes saved and session marked as reviewed' : 'Notes saved',
        data: {
            sessionId: session._id,
            doctorNotes: session.doctorNotes,
            status: session.status,
        },
    });
});

// ─── Utility formatter ────────────────────────────────────────────
function formatSessionSummary(s) {
    return {
        sessionId: s._id,
        patient: s.patientId
            ? { id: s.patientId._id, name: s.patientId.name, email: s.patientId.email }
            : null,
        riskLevel: s.riskLevel,
        riskScore: s.riskScore,
        triageRecommendation: s.triageRecommendation,
        status: s.status,
        symptomCount: s.extractedSymptoms?.length || 0,
        createdAt: s.createdAt,
    };
}
