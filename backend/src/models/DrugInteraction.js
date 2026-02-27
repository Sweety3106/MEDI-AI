const mongoose = require('mongoose');

const drugInteractionSchema = new mongoose.Schema({
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    medications: [{ type: String }],
    interactions: [{
        drug1: String,
        drug2: String,
        severity: String,
        description: String,
        recommendation: String
    }],
}, { timestamps: { createdAt: 'checkedAt', updatedAt: true } });

module.exports = mongoose.model('DrugInteraction', drugInteractionSchema);
