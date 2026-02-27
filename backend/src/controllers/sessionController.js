const axios = require('axios');
const SymptomSession = require('../models/SymptomSession');
const DiagnosisPrediction = require('../models/DiagnosisPrediction');
const asyncHandler = require('../utils/asyncHandler');
const { config } = require('../config/config');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─── Helper: call AI service ──────────────────────────────────────
const callAI = async (endpoint, body) => {
    const res = await axios.post(`${AI_URL}${endpoint}`, body, { timeout: 30000 });
    return res.data;
};

// ─── POST /api/v1/sessions/start ─────────────────────────────────
exports.startSession = asyncHandler(async (req, res) => {
    const { rawInput, inputType = 'text', language = 'en' } = req.body;

    if (!rawInput) {
        return res.status(400).json({ success: false, message: 'rawInput is required' });
    }

    // 1. Extract symptoms from AI service
    let extractedData = {};
    try {
        extractedData = await callAI('/extract-symptoms', { text: rawInput, language });
    } catch (err) {
        console.error('AI extraction failed:', err.message);
        extractedData = { extractedSymptoms: [], vitalMentions: {}, extractionConfidence: 0 };
    }

    // 2. Basic risk scoring (GPT-based /stratify-risk if available, else compute locally)
    let riskScore = 0;
    let riskLevel = 'low';
    const symptoms = extractedData.extractedSymptoms || [];
    if (symptoms.length > 0) {
        const avgSeverity = symptoms.reduce((sum, s) => sum + (s.severity || 5), 0) / symptoms.length;
        riskScore = Math.min(100, Math.round(avgSeverity * 10));
        if (riskScore >= 70) riskLevel = 'critical';
        else if (riskScore >= 50) riskLevel = 'high';
        else if (riskScore >= 30) riskLevel = 'medium';
    }

    // 3. Save session to MongoDB
    const session = await SymptomSession.create({
        patientId: req.user._id,
        rawInput,
        extractedSymptoms: symptoms,
        vitalSigns: {
            temperature: extractedData.vitalMentions?.temperature,
            bloodPressure: extractedData.vitalMentions?.bp,
            heartRate: extractedData.vitalMentions?.hr,
        },
        riskScore,
        riskLevel,
        triageRecommendation: riskLevel === 'critical' ? 'emergency'
            : riskLevel === 'high' ? 'urgent_care'
                : riskLevel === 'medium' ? 'gp' : 'home_care',
        status: 'pending',
    });

    res.status(201).json({
        success: true,
        data: {
            sessionId: session._id,
            extractedSymptoms: session.extractedSymptoms,
            vitalSigns: session.vitalSigns,
            riskScore: session.riskScore,
            riskLevel: session.riskLevel,
            triageRecommendation: session.triageRecommendation,
            extractionConfidence: extractedData.extractionConfidence || 0,
        },
    });
});

// ─── GET /api/v1/sessions/:id ─────────────────────────────────────
exports.getSession = asyncHandler(async (req, res) => {
    const session = await SymptomSession.findById(req.params.id).lean();
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Patients can only view their own; doctors can view any
    if (req.user.role === 'patient' && session.patientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to view this session' });
    }

    // Attach diagnosis if available
    const diagnosis = await DiagnosisPrediction.findOne({ sessionId: session._id }).lean();

    res.json({ success: true, data: { session, diagnosis: diagnosis || null } });
});

// ─── POST /api/v1/sessions/:id/diagnose ──────────────────────────
exports.diagnoseSession = asyncHandler(async (req, res) => {
    const session = await SymptomSession.findById(req.params.id);
    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.patientId.toString() !== req.user._id.toString() && req.user.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const patientProfile = {
        age: req.user.dateOfBirth
            ? Math.floor((Date.now() - new Date(req.user.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
            : null,
        gender: req.user.gender,
        chronicConditions: req.user.chronicConditions || [],
        medications: req.user.currentMedications || [],
    };

    // 1. Generate differential diagnosis
    let diagnosisResult = {};
    try {
        diagnosisResult = await callAI('/generate-diagnosis', {
            extractedSymptoms: session.extractedSymptoms,
            riskScore: session.riskScore,
            patientAge: patientProfile.age,
            patientGender: patientProfile.gender,
            chronicConditions: patientProfile.chronicConditions,
        });
    } catch (err) {
        console.error('Diagnosis generation failed:', err.message);
    }

    // 2. Generate SOAP note
    let soapResult = {};
    try {
        soapResult = await callAI('/generate-soap-note', {
            patientProfile,
            rawInput: session.rawInput,
            extractedSymptoms: session.extractedSymptoms,
            diagnosisPredictions: diagnosisResult,
            riskScore: session.riskScore,
        });
    } catch (err) {
        console.error('SOAP note generation failed:', err.message);
    }

    // 3. Save/update diagnosis in DB
    const diagnosis = await DiagnosisPrediction.findOneAndUpdate(
        { sessionId: session._id },
        {
            sessionId: session._id,
            predictions: (diagnosisResult.differentialDiagnosis || []).map(d => ({
                condition: d.condition,
                icdCode: d.icdCode,
                confidence: d.confidenceScore,
                reasoning: d.reasoning,
                sources: d.recommendedTests || [],
            })),
            redFlagSymptoms: [],
            differentialDiagnosis: (diagnosisResult.differentialDiagnosis || []).map(d => d.condition),
            clinicalNote: soapResult.formattedText || '',
        },
        { upsert: true, new: true }
    );

    res.json({
        success: true,
        data: {
            sessionId: session._id,
            differentialDiagnosis: diagnosisResult.differentialDiagnosis || [],
            mostLikelyDiagnosis: diagnosisResult.mostLikelyDiagnosis || '',
            urgency: diagnosisResult.urgency || 'medium',
            soapNote: soapResult.structuredData || {},
            pdfExport: soapResult.pdfExport || null,
            disclaimer: diagnosisResult.disclaimer || 'AI-generated. Must be confirmed by a licensed physician.',
        },
    });
});

// ─── GET /api/v1/sessions (patient history, paginated) ───────────
exports.getSessionHistory = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 10,
        riskLevel, status,
        from, to,
    } = req.query;

    const filter = { patientId: req.user._id };
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
        .lean();

    res.json({
        success: true,
        data: sessions,
        meta: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit),
        },
    });
});

// ─── PATCH /api/v1/sessions/:id/status (doctor only) ─────────────
exports.updateSessionStatus = asyncHandler(async (req, res) => {
    const { status, doctorNotes } = req.body;
    const validStatuses = ['reviewed', 'closed'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const session = await SymptomSession.findByIdAndUpdate(
        req.params.id,
        { status, ...(doctorNotes && { doctorNotes }) },
        { new: true }
    );

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true, data: session });
});
