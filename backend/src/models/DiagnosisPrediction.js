const mongoose = require('mongoose');

const diagnosisPredictionSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SymptomSession', required: true, index: true },
    predictions: [{
        condition: String,
        icdCode: String,
        confidence: Number,
        reasoning: String,
        sources: [String]
    }],
    redFlagSymptoms: [String],
    differentialDiagnosis: [String],
    clinicalNote: String,
}, { timestamps: { createdAt: 'generatedAt', updatedAt: true } });

module.exports = mongoose.model('DiagnosisPrediction', diagnosisPredictionSchema);
