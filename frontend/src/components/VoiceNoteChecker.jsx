import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    Loader2,
    Mic,
    MicOff,
    RefreshCw,
    Stethoscope,
    PhoneCall,
} from 'lucide-react';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const MEDICAL_TERMS = {
    symptom: [
        'pain',
        'fever',
        'vomiting',
        'cough',
        'headache',
        'nausea',
        'dizziness',
        'fatigue',
        'breathlessness',
        'shortness of breath',
    ],
    location: [
        'chest',
        'abdomen',
        'stomach',
        'head',
        'back',
        'arm',
        'leg',
        'left side',
        'right side',
    ],
    severity: ['mild', 'moderate', 'severe', 'worst', 'crushing'],
    duration: ['minutes', 'hours', 'days', 'weeks'],
    redFlag: [
        'crushing chest pain',
        "can't breathe",
        'cannot breathe',
        'shortness of breath',
        'difficulty breathing',
        'slurred speech',
        'loss of consciousness',
        'unresponsive',
    ],
};

const buildRegex = (words) =>
    new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('|')})\\b`, 'i');

const VoiceNoteChecker = () => {
    const [language, setLanguage] = useState('en');
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [rawTranscript, setRawTranscript] = useState('');
    const [loadingNote, setLoadingNote] = useState(false);
    const [noteResult, setNoteResult] = useState(null);
    const [error, setError] = useState('');
    const [correctionMode, setCorrectionMode] = useState(false);

    const recognitionRef = useRef(null);
    const debounceRef = useRef(null);

    const startRecording = () => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice recognition is not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
            let current = '';
            for (let i = 0; i < event.results.length; i += 1) {
                current += event.results[i][0].transcript;
            }
            setRawTranscript(current);
            setTranscript(current);
        };
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    };

    const highlightedTranscript = useMemo(() => {
        if (!transcript) return null;
        const text = transcript;

        const segments = [];
        let remaining = text;

        const categories = [
            { type: 'redFlag', color: 'bg-red-100 text-red-800' },
            { type: 'symptom', color: 'bg-emerald-100 text-emerald-800' },
            { type: 'location', color: 'bg-sky-100 text-sky-800' },
            { type: 'severity', color: 'bg-orange-100 text-orange-800' },
            { type: 'duration', color: 'bg-orange-50 text-orange-700' },
        ];

        const matches = [];
        categories.forEach((cat) => {
            const list = MEDICAL_TERMS[cat.type] || [];
            list.forEach((w) => {
                const escaped = w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
                const re = new RegExp(escaped, 'gi');
                let m;
                while ((m = re.exec(text))) {
                    matches.push({
                        start: m.index,
                        end: m.index + m[0].length,
                        type: cat.type,
                        color: cat.color,
                    });
                }
            });
        });

        matches.sort((a, b) => a.start - b.start || b.end - a.end);

        const chosen = [];
        let lastEnd = 0;
        matches.forEach((m) => {
            if (m.start >= lastEnd) {
                chosen.push(m);
                lastEnd = m.end;
            }
        });

        let index = 0;
        chosen.forEach((m) => {
            if (m.start > index) {
                segments.push({
                    text: text.slice(index, m.start),
                    type: 'plain',
                });
            }
            segments.push({
                text: text.slice(m.start, m.end),
                type: m.type,
                color: m.color,
            });
            index = m.end;
        });
        if (index < text.length) {
            segments.push({ text: text.slice(index), type: 'plain' });
        }

        return segments;
    }, [transcript]);

    const emergencyDetected = noteResult?.emergency?.detected;

    const triggerVoiceToNote = async () => {
        if (!transcript.trim()) return;
        setLoadingNote(true);
        setError('');
        try {
            const res = await axios.post(
                `${API_BASE}/patients/me/voice-to-note`,
                { transcript, language },
                { withCredentials: true },
            );
            if (res.data?.success) {
                setNoteResult(res.data.data);
            } else {
                setError(res.data?.message || 'Unable to generate clinical note.');
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    'AI service unavailable. Please try again or type your symptoms instead.',
            );
        } finally {
            setLoadingNote(false);
        }
    };

    useEffect(() => {
        if (!transcript.trim()) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            triggerVoiceToNote();
        }, 2000);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcript, language]);

    const handleManualSubmit = () => {
        triggerVoiceToNote();
    };

    const handleCorrection = () => {
        setCorrectionMode(true);
        stopRecording();
        setIsRecording(false);
    };

    const handleReset = () => {
        setTranscript('');
        setRawTranscript('');
        setNoteResult(null);
        setError('');
        setCorrectionMode(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {emergencyDetected && (
                <div className="rounded-3xl overflow-hidden border border-red-200 shadow-lg">
                    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            <p className="text-sm font-semibold">
                                Emergency language detected — do not rely on this app.
                            </p>
                        </div>
                        <a
                            href="tel:108"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white text-red-700 text-xs font-bold uppercase tracking-widest"
                        >
                            <PhoneCall className="w-4 h-4" />
                            Call 108 Now
                        </a>
                    </div>
                    <div className="bg-red-50 px-4 py-2 text-[11px] text-red-700">
                        If you or someone near you has chest pain, trouble breathing, or sudden
                        weakness, please call emergency services immediately.
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            Voice-to-Note Capture
                        </h1>
                        <p className="text-xs text-slate-500">
                            Speak naturally — MediAI will turn your story into a structured clinical
                            note in real time.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setLanguage((l) => (l === 'en' ? 'hi' : 'en'))}
                            className="px-3 py-1.5 rounded-2xl bg-slate-100 text-[11px] font-bold uppercase tracking-widest text-slate-600"
                        >
                            {language === 'en' ? 'ENGLISH' : 'हिंदी'}
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="p-2 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                Voice input
                            </p>
                            <button
                                type="button"
                                onClick={correctionMode ? () => setCorrectionMode(false) : handleCorrection}
                                className="text-[11px] text-teal-700 font-bold uppercase tracking-widest"
                            >
                                {correctionMode ? 'Back to live capture' : "I said something different"}
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center py-6 border border-slate-100 rounded-3xl bg-slate-50/60">
                            <button
                                type="button"
                                onClick={isRecording ? stopRecording : startRecording}
                                className={cn(
                                    'w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all',
                                    isRecording
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'bg-teal-600 text-white hover:scale-105',
                                )}
                            >
                                {isRecording ? (
                                    <MicOff className="w-8 h-8" />
                                ) : (
                                    <Mic className="w-8 h-8" />
                                )}
                            </button>
                            <p
                                className={cn(
                                    'mt-3 text-xs font-semibold',
                                    isRecording ? 'text-red-500' : 'text-slate-500',
                                )}
                            >
                                {isRecording
                                    ? 'Listening… speak as you would to your doctor.'
                                    : 'Tap to start or stop recording.'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-slate-600">
                                Transcript (editable)
                            </p>
                            <div className="min-h-[140px] max-h-[200px] overflow-y-auto bg-white border border-slate-100 rounded-2xl p-3 text-sm text-slate-800">
                                {correctionMode ? (
                                    <textarea
                                        value={transcript}
                                        onChange={(e) => setTranscript(e.target.value)}
                                        className="w-full h-32 text-sm text-slate-800 outline-none resize-none"
                                        placeholder="Type or correct what you actually said…"
                                    />
                                ) : highlightedTranscript && highlightedTranscript.length ? (
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                        {highlightedTranscript.map((seg, idx) =>
                                            seg.type === 'plain' ? (
                                                <span key={idx}>{seg.text}</span>
                                            ) : (
                                                <span
                                                    key={idx}
                                                    className={cn(
                                                        'rounded px-1 py-0.5',
                                                        seg.color,
                                                    )}
                                                >
                                                    {seg.text}
                                                </span>
                                            ),
                                        )}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400">
                                        Your transcript will appear here as you speak. You can tap
                                        &quot;I said something different&quot; to correct it.
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleManualSubmit}
                            disabled={!transcript.trim() || loadingNote}
                            className={cn(
                                'w-full mt-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest',
                                !transcript.trim() || loadingNote
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-teal-600 text-white hover:bg-teal-700',
                            )}
                        >
                            {loadingNote && <Loader2 className="w-4 h-4 animate-spin" />}
                            Generate clinical note
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <Stethoscope className="w-4 h-4 text-teal-600" />
                                Live clinical summary
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-red-50 border border-red-100 text-[11px] text-red-700">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}

                        {!noteResult && !error && (
                            <div className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                                While you speak, MediAI periodically sends your transcript to the AI
                                service (every ~2 seconds) to update this summary and draft SOAP
                                note.
                            </div>
                        )}

                        {noteResult && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-teal-600" />
                                        <p className="text-xs font-semibold text-slate-700">
                                            Extracted symptoms
                                        </p>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Risk: {noteResult.riskScore}/100 ({noteResult.riskLevel})
                                    </p>
                                </div>
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                    {noteResult.extractedSymptoms &&
                                    noteResult.extractedSymptoms.length ? (
                                        noteResult.extractedSymptoms.map((s, idx) => (
                                            <p
                                                key={`${s.name || 'sym'}-${idx}`}
                                                className="text-[11px] text-slate-600"
                                            >
                                                • {s.name}{' '}
                                                <span className="text-slate-400">
                                                    {s.bodyLocation ? `(${s.bodyLocation}) ` : ''}
                                                    {s.duration ? `• ${s.duration}` : ''}
                                                </span>
                                            </p>
                                        ))
                                    ) : (
                                        <p className="text-[11px] text-slate-400">
                                            No symptoms extracted yet.
                                        </p>
                                    )}
                                </div>
                                <div className="border-t border-slate-100 pt-2 space-y-1">
                                    <p className="text-[11px] font-semibold text-slate-700">
                                        SOAP note draft
                                    </p>
                                    <div className="h-32 overflow-y-auto bg-slate-50 border border-slate-100 rounded-2xl p-3 text-[11px] text-slate-700 whitespace-pre-wrap">
                                        {noteResult.soapNote?.formattedText ||
                                            'SOAP note will appear here once available.'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceNoteChecker;

