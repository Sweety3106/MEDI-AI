import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Keyboard,
    Mic,
    ChevronRight,
    ChevronLeft,
    AlertCircle,
    Thermometer,
    Activity,
    Heart,
    Waves,
    RefreshCw,
    CheckCircle2,
    Trash2,
    Play,
    Search
} from 'lucide-react';
import { cn } from '../utils/cn';
import BodyMapSelector from './BodyMapSelector';

const SymptomChecker = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [inputMode, setInputMode] = useState(null); // 'text' | 'voice'
    const [language, setLanguage] = useState('en'); // 'en' | 'hi'
    const [textInput, setTextInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [vitals, setVitals] = useState({
        temp: '',
        bp: '',
        hr: '',
        spo2: ''
    });
    const [selectedBodyParts, setSelectedBodyParts] = useState([]);
    const [loadingStep, setLoadingStep] = useState(0);

    const recognitionRef = useRef(null);

    // ─── STEP 1: MODE & LANG ────────────────────────────────────
    const renderStep1 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-800">How would you like to describe your symptoms?</h2>
                <p className="text-slate-500 mt-2">Choose the most convenient way for you right now.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                {[
                    { id: 'text', icon: Keyboard, title: 'Type Symptoms', desc: 'Use your keyboard to describe feelings in detail.' },
                    { id: 'voice', icon: Mic, title: 'Speak Symptoms', desc: 'Describe your symptoms using your voice (Fastest).' }
                ].map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => { setInputMode(mode.id); setStep(2); }}
                        className="flex-1 p-6 bg-white border-2 border-slate-100 rounded-3xl text-left hover:border-teal-500 hover:shadow-xl hover:shadow-teal-500/5 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors mb-4">
                            <mode.icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">{mode.title}</h3>
                        <p className="text-slate-500 text-sm mt-1">{mode.desc}</p>
                    </button>
                ))}
            </div>

            <div className="bg-slate-100/50 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 uppercase tracking-widest pl-2">Preferred Language</span>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {['en', 'hi'].map((l) => (
                        <button
                            key={l}
                            onClick={() => setLanguage(l)}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                                language === l ? "bg-teal-600 text-white shadow-md shadow-teal-500/20" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {l === 'en' ? 'English' : 'हिंदी'}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // ─── STEP 2: BODY MAP (LOCALIZATION) ───────────────────────
    const renderStep2 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-800">Pinpoint Locations</h2>
            </div>

            <BodyMapSelector
                initialSelected={selectedBodyParts}
                onSelect={(parts) => {
                    setSelectedBodyParts(parts);
                    const locationText = parts
                        .filter(p => p.slug)
                        .map(p => p.slug.replace(/-/g, ' '))
                        .join(', ');
                    if (locationText && !textInput.includes(locationText)) {
                        setTextInput(prev => `Pain/Issue localized at: ${locationText}. ${prev}`);
                    }
                    setStep(3);
                }}
            />

            <button
                onClick={() => setStep(3)}
                className="w-full text-slate-400 text-xs font-bold uppercase tracking-widest py-2 hover:text-slate-600 transition-colors"
            >
                Skip localization
            </button>
        </div>
    );

    // ─── STEP 2: INPUT (TEXT) ───────────────────────────────────
    const renderTextMode = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-3">
                <button onClick={() => setStep(2)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-800">Describe your symptoms</h2>
            </div>

            <div className="relative">
                <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value.slice(0, 500))}
                    className="w-full h-48 bg-white border-2 border-slate-100 rounded-3xl p-6 text-slate-700 focus:border-teal-500/50 focus:ring-0 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                    placeholder={language === 'en' ? "Describe location, severity, and duration... e.g., 'Severe headache for 2 days...'" : "अपनी समस्याओं का विस्तार से वर्णन करें... जैसे, '२ दिनों से सिर में तेज दर्द है...'"}
                />
                <div className="absolute bottom-4 right-6 text-xs font-bold font-mono text-slate-400">
                    {textInput.length}/500
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {['Location', 'Severity', 'Duration', 'Onset', 'Triggers'].map(item => (
                    <div key={item} className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">{item}</div>
                ))}
            </div>

            <button
                disabled={textInput.length < 10}
                onClick={() => setStep(4)}
                className="w-full py-4 bg-teal-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
            >
                Continue to Vitals
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );

    // ─── STEP 2: INPUT (VOICE) ──────────────────────────────────
    const startRecording = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event) => {
            let current = "";
            for (let i = 0; i < event.results.length; i++) {
                current += event.results[i][0].transcript;
            }
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

    const renderVoiceMode = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-3">
                <button onClick={() => setStep(2)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-slate-800">Speak your symptoms</h2>
            </div>

            <div className="flex flex-col items-center justify-center py-12 space-y-8">
                <div className="relative">
                    {isRecording && (
                        <div className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping" />
                    )}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={cn(
                            "w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all relative z-10",
                            isRecording ? "bg-red-500 text-white" : "bg-teal-600 text-white hover:scale-105"
                        )}
                    >
                        {isRecording ? <div className="w-8 h-8 bg-white rounded-sm" /> : <Mic className="w-10 h-10" />}
                    </button>
                </div>

                <div className="text-center">
                    <p className={cn("font-bold text-lg", isRecording ? "text-red-500" : "text-slate-800")}>
                        {isRecording ? "Listening..." : "Tap to start speaking"}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">AI will transcribe your {language === 'en' ? 'English' : 'हिंदी'} session.</p>
                </div>
            </div>

            <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 min-h-[120px] max-h-[200px] overflow-y-auto italic text-slate-600">
                {transcript || "Transcription will appear here..."}
            </div>

            <div className="flex gap-4">
                <button
                    onClick={() => { setTranscript(''); stopRecording(); }}
                    className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <Trash2 className="w-6 h-6" />
                </button>
                <button
                    disabled={!transcript || isRecording}
                    onClick={() => { setTextInput(transcript); setStep(4); }}
                    className="flex-1 py-4 bg-teal-600 disabled:bg-slate-200 text-white rounded-2xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                >
                    Confirm Transcript
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );

    // ─── STEP 3: VITALS ─────────────────────────────────────────
    const renderStep3 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-3">
                <button onClick={() => setStep(3)} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Add Clinical Vitals</h2>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Recommended but Optional</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                    { id: 'temp', icon: Thermometer, label: 'Temperature', unit: '°C' },
                    { id: 'bp', icon: Activity, label: 'Blood Pressure', unit: 'mmHg' },
                    { id: 'hr', icon: Heart, label: 'Heart Rate', unit: 'bpm' },
                    { id: 'spo2', icon: Waves, label: 'SpO2 Level', unit: '%' }
                ].map((v) => (
                    <div key={v.id} className="bg-white p-4 border border-slate-100 rounded-2xl shadow-sm flex items-center gap-4 focus-within:border-teal-500 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <v.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-1">{v.label}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    placeholder="--"
                                    value={vitals[v.id]}
                                    onChange={(e) => setVitals({ ...vitals, [v.id]: e.target.value })}
                                    className="w-full text-lg font-bold text-slate-700 outline-none"
                                />
                                <span className="text-xs font-bold text-slate-300">{v.unit}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex gap-4">
                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    Note: If you are experiencing chest pain, difficulty breathing, or slurred speech, please skip this app and call emergency services immediately.
                </p>
            </div>

            <button
                onClick={() => { setStep(5); startLoadingAnimation(); }}
                className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
            >
                Analyze My Symptoms
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );

    // ─── STEP 4: LOADING ────────────────────────────────────────
    const loadingStages = [
        { label: "Extracting clinical markers...", icon: Search },
        { label: "Refining risk assessment...", icon: Activity },
        { label: "Generating differential diagnosis...", icon: RefreshCw },
        { label: "Finalizing clinical report (SOAP)...", icon: CheckCircle2 }
    ];

    const startLoadingAnimation = () => {
        setLoadingStep(0);
        const interval = setInterval(() => {
            setLoadingStep(prev => {
                if (prev >= loadingStages.length - 1) {
                    clearInterval(interval);
                    setTimeout(() => navigate('/results/session-123'), 1000);
                    return prev;
                }
                return prev + 1;
            });
        }, 3000);
    };

    const renderStep4 = () => (
        <div className="flex flex-col items-center justify-center py-20 space-y-12 animate-in zoom-in-95 duration-500">
            <div className="relative w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-teal-500 rounded-full border-t-transparent animate-spin" />
                <div className="w-16 h-16 rounded-3xl bg-teal-500 flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
                    <RefreshCw className="w-8 h-8 animate-pulse" />
                </div>
            </div>

            <div className="w-full max-w-sm space-y-6">
                {loadingStages.map((stage, i) => {
                    const StageIcon = stage.icon;
                    const isDone = i < loadingStep;
                    const isCurrent = i === loadingStep;

                    return (
                        <div
                            key={stage.label}
                            className={cn(
                                "flex items-center gap-4 transition-all duration-700",
                                isCurrent ? "opacity-100 scale-100" : isDone ? "opacity-40 scale-95" : "opacity-0 scale-90 translate-y-4"
                            )}
                        >
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                isDone ? "bg-green-100 text-green-600" : "bg-teal-50 text-teal-600"
                            )}>
                                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <StageIcon className="w-5 h-5" />}
                            </div>
                            <span className={cn(
                                "font-bold text-sm",
                                isCurrent ? "text-slate-800" : isDone ? "text-slate-400 line-through" : "text-slate-200"
                            )}>
                                {stage.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <p className="text-slate-400 text-xs italic">Extracted markers will be available in ~10 seconds.</p>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-10 overflow-hidden">
                {[1, 2, 3, 4, 5].map(s => (
                    <div
                        key={s}
                        className={cn(
                            "h-1.5 rounded-full transition-all duration-500",
                            step === s ? "w-10 bg-teal-600" : step > s ? "w-6 bg-teal-200" : "w-2 bg-slate-200"
                        )}
                    />
                ))}
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 min-h-[500px] flex flex-col justify-center">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && (inputMode === 'text' ? renderTextMode() : renderVoiceMode())}
                {step === 4 && renderStep3()}
                {step === 5 && renderStep4()}
            </div>
        </div>
    );
};

export default SymptomChecker;
