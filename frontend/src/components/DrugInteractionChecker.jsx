import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SEVERITY_STYLES = {
    severe: { bg: 'bg-red-600', text: 'text-white', label: 'SEVERE' },
    moderate: { bg: 'bg-orange-400', text: 'text-white', label: 'MODERATE' },
    minor: { bg: 'bg-yellow-300', text: 'text-gray-800', label: 'MINOR' },
    none: { bg: 'bg-green-500', text: 'text-white', label: 'SAFE' },
};

const RATING_STYLES = {
    safe: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
    caution: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' },
    danger: { bg: 'bg-red-100', border: 'border-red-600', text: 'text-red-800' },
};

export default function DrugInteractionChecker() {
    const [inputValue, setInputValue] = useState('');
    const [medications, setMedications] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);

    const addMedication = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !medications.includes(trimmed)) {
            setMedications([...medications, trimmed]);
            setInputValue('');
        }
    };

    const removeMedication = (med) => {
        setMedications(medications.filter(m => m !== med));
    };

    const handleCheck = async () => {
        if (medications.length < 2) {
            setError('Please add at least 2 medications.');
            return;
        }
        setError('');
        setLoading(true);
        setResult(null);
        try {
            const res = await axios.post(`${API_URL}/check-drug-interactions`, { medications });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to check interactions. Make sure the AI service is running.');
        }
        setLoading(false);
    };

    const getSeverity = (drug1, drug2) => {
        if (!result) return null;
        return result.interactions.find(
            i => (i.drug1 === drug1 && i.drug2 === drug2) || (i.drug1 === drug2 && i.drug2 === drug1)
        );
    };

    const ratingStyle = result ? RATING_STYLES[result.overallSafetyRating] || RATING_STYLES.caution : null;

    return (
        <div className="max-w-4xl mx-auto p-6 font-sans">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-1">Drug Interaction Checker</h1>
                <p className="text-gray-500 text-sm">Powered by OpenFDA + GPT-4o clinical pharmacology analysis</p>
            </div>

            {/* Medication Input */}
            <div className="bg-white rounded-xl shadow-md p-5 mb-6 border border-gray-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Add Medications</label>
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addMedication()}
                        placeholder="e.g. Metformin, Lisinopril..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={addMedication}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
                    >
                        + Add
                    </button>
                </div>

                {/* Medication Tags */}
                <div className="flex flex-wrap gap-2">
                    {medications.map(med => (
                        <span key={med} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                            {med}
                            <button onClick={() => removeMedication(med)} className="ml-1 text-blue-500 hover:text-red-500 font-bold">×</button>
                        </span>
                    ))}
                </div>

                {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}

                <button
                    onClick={handleCheck}
                    disabled={loading}
                    className="mt-4 w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                    {loading ? '🔍 Analyzing...' : '🔍 Check Interactions'}
                </button>
            </div>

            {/* Results */}
            {result && (
                <>
                    {/* Summary */}
                    <div className={`rounded-xl p-4 border-2 mb-6 ${ratingStyle.bg} ${ratingStyle.border}`}>
                        <p className={`font-bold text-base ${ratingStyle.text}`}>
                            {result.summary}
                        </p>
                        <p className={`text-xs mt-1 ${ratingStyle.text} opacity-75`}>
                            Overall Safety Rating: <strong className="uppercase">{result.overallSafetyRating}</strong>
                        </p>
                    </div>

                    {/* Interaction Matrix Table */}
                    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden mb-6">
                        <div className="p-4 border-b">
                            <h2 className="font-bold text-gray-700">Interaction Matrix</h2>
                            <div className="flex gap-3 mt-2 flex-wrap">
                                {Object.entries(SEVERITY_STYLES).map(([key, val]) => (
                                    <span key={key} className={`px-2 py-0.5 rounded text-xs font-semibold ${val.bg} ${val.text}`}>
                                        {val.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-4 py-2 text-left text-gray-500 font-medium">&nbsp;</th>
                                        {result.medications.map(med => (
                                            <th key={med} className="px-4 py-2 text-center text-gray-700 font-semibold">{med}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.medications.map((row, ri) => (
                                        <tr key={row} className="border-t">
                                            <td className="px-4 py-2 font-semibold text-gray-700">{row}</td>
                                            {result.medications.map((col, ci) => {
                                                if (ri === ci) return <td key={col} className="px-4 py-2 text-center text-gray-300">—</td>;
                                                const interaction = getSeverity(row, col);
                                                const sev = interaction?.severity || 'none';
                                                const style = SEVERITY_STYLES[sev] || SEVERITY_STYLES.none;
                                                return (
                                                    <td key={col} className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => setExpandedRow(expandedRow === `${ri}-${ci}` ? null : `${ri}-${ci}`)}
                                                            className={`px-3 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text} hover:opacity-80 transition`}
                                                        >
                                                            {style.label}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Interaction Details */}
                    {result.interactions.filter(i => i.severity !== 'none').length > 0 && (
                        <div className="space-y-3">
                            <h2 className="font-bold text-gray-700">Interaction Details</h2>
                            {result.interactions.filter(i => i.severity !== 'none').map((ix, idx) => {
                                const style = SEVERITY_STYLES[ix.severity] || SEVERITY_STYLES.none;
                                return (
                                    <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                                                {style.label}
                                            </span>
                                            <span className="font-semibold text-gray-700">{ix.drug1} ↔ {ix.drug2}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-1">{ix.description}</p>
                                        <p className="text-xs text-gray-500"><strong>Clinical Significance:</strong> {ix.clinicalSignificance}</p>
                                        <p className="text-xs text-gray-500 mt-1"><strong>Recommendation:</strong> {ix.recommendation}</p>
                                        {ix.sources?.length > 0 && (
                                            <p className="text-xs text-gray-400 mt-1">Sources: {ix.sources.join(', ')}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <p className="text-xs text-gray-400 mt-6 text-center">
                        ⚠️ AI-generated analysis. Always consult a licensed pharmacist or physician before making medication decisions.
                    </p>
                </>
            )}
        </div>
    );
}
