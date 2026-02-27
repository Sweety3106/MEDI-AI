const mongoose = require('mongoose');

const symptomSessionSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rawInput: { type: String, required: true },
    extractedSymptoms: [{
        name: String,
        bodyLocation: String,
        severity: { type: Number, min: 1, max: 10 },
        duration: String,
        onset: String,
        character: String
    }],
    vitalSigns: {
        temperature: Number,
        bloodPressure: String,
        heartRate: Number,
        spo2: Number
    },
    riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], index: true },
    riskScore: { type: Number, min: 0, max: 100 },
    triageRecommendation: { type: String, enum: ['home_care', 'gp', 'urgent_care', 'emergency'] },
    status: { type: String, enum: ['pending', 'reviewed', 'closed'], default: 'pending' },
    inputType: { type: String, enum: ['text', 'voice'], default: 'text' },
    language: { type: String, enum: ['en', 'hi'], default: 'en' },
    doctorNotes: { type: String, default: '' },
}, { timestamps: true });

symptomSessionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SymptomSession', symptomSessionSchema);
