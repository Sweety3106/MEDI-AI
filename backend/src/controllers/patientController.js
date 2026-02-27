const axios = require('axios');
const User = require('../models/User');
const SymptomSession = require('../models/SymptomSession');
const DiagnosisPrediction = require('../models/DiagnosisPrediction');
const asyncHandler = require('../utils/asyncHandler');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─── GET /api/v1/patients/me ─────────────────────────────────────
exports.getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .select('-passwordHash')
        .lean();

    res.json({ success: true, data: user });
});

// ─── PUT /api/v1/patients/me ──────────────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
    const allowedFields = ['allergies', 'chronicConditions', 'currentMedications', 'bloodGroup', 'gender', 'dateOfBirth', 'name'];
    const updates = {};

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select('-passwordHash');

    res.json({ success: true, data: user });
});

// ─── GET /api/v1/patients/me/timeline ────────────────────────────
exports.getTimeline = asyncHandler(async (req, res) => {
    const sessions = await SymptomSession.find({ patientId: req.user._id })
        .sort({ createdAt: 1 }) // chronological
        .lean();

    // Fetch top diagnosis for each session
    const sessionIds = sessions.map(s => s._id);
    const diagnoses = await DiagnosisPrediction.find({ sessionId: { $in: sessionIds } }).lean();
    const diagMap = {};
    for (const d of diagnoses) {
        diagMap[d.sessionId.toString()] = d;
    }

    // Build timeline entries
    const timeline = sessions.map(s => ({
        date: s.createdAt,
        sessionId: s._id,
        chiefComplaint: s.rawInput?.slice(0, 120) || '',
        riskLevel: s.riskLevel,
        riskScore: s.riskScore,
        triageRecommendation: s.triageRecommendation,
        status: s.status,
        topDiagnosis: diagMap[s._id.toString()]?.predictions?.[0]?.condition || null,
        symptomCount: s.extractedSymptoms?.length || 0,
    }));

    // Group by month
    const grouped = {};
    for (const entry of timeline) {
        const key = new Date(entry.date).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(entry);
    }

    res.json({
        success: true,
        data: {
            timeline,
            grouped,
            total: timeline.length,
        },
    });
});

// ─── GET /api/v1/patients/me/stats ───────────────────────────────
exports.getStats = asyncHandler(async (req, res) => {
    const sessions = await SymptomSession.find({ patientId: req.user._id }).lean();

    if (sessions.length === 0) {
        return res.json({
            success: true,
            data: {
                totalSessions: 0,
                averageRiskScore: 0,
                lastSessionDate: null,
                riskLevelDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
                mostCommonSymptoms: [],
            },
        });
    }

    // Risk distribution
    const riskLevelDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
    let totalRisk = 0;
    const symptomCounts = {};

    for (const s of sessions) {
        if (s.riskLevel) riskLevelDistribution[s.riskLevel] = (riskLevelDistribution[s.riskLevel] || 0) + 1;
        totalRisk += s.riskScore || 0;
        for (const sym of s.extractedSymptoms || []) {
            if (sym.name) {
                const key = sym.name.toLowerCase();
                symptomCounts[key] = (symptomCounts[key] || 0) + 1;
            }
        }
    }

    // Top 10 most common symptoms
    const mostCommonSymptoms = Object.entries(symptomCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const sortedSessions = sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
        success: true,
        data: {
            totalSessions: sessions.length,
            averageRiskScore: Math.round(totalRisk / sessions.length),
            lastSessionDate: sortedSessions[0]?.createdAt || null,
            riskLevelDistribution,
            mostCommonSymptoms,
        },
    });
});

// ─── POST /api/v1/patients/me/check-drugs ────────────────────────
exports.checkMyDrugs = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('currentMedications').lean();
    const medications = req.body.medications || user.currentMedications || [];

    if (!medications || medications.length < 2) {
        return res.status(400).json({
            success: false,
            message: 'At least 2 medications required. Add medications to your profile first.',
        });
    }

    try {
        const result = await axios.post(`${AI_URL}/check-drug-interactions`, { medications }, { timeout: 30000 });
        res.json({ success: true, data: result.data });
    } catch (err) {
        console.error('Drug check failed:', err.message);
        res.status(502).json({
            success: false,
            message: 'AI service unavailable. Make sure the AI service is running.',
        });
    }
});
