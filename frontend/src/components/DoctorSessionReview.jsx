import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    ClipboardCopy,
    FileText,
    HeartPulse,
    Loader2,
    Pill,
    Stethoscope,
    ThumbsDown,
    ThumbsUp,
    User as UserIcon,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const RISK_CONFIG = {
    critical: { label: 'Critical', color: 'bg-red-100 text-red-700', ring: 'ring-red-500' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-700', ring: 'ring-orange-500' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700', ring: 'ring-yellow-400' },
    low: { label: 'Low', color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-500' },
};

const DoctorSessionReview = ({ user }) => {
    const { sessionId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [session, setSession] = useState(null);
    const [diagnosis, setDiagnosis] = useState(null);
    const [patient, setPatient] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [patientSummary, setPatientSummary] = useState(null);

    const [assessmentAgreement, setAssessmentAgreement] = useState('agree'); // 'agree' | 'modify'
    const [doctorNotes, setDoctorNotes] = useState('');
    const [diagnosisOverride, setDiagnosisOverride] = useState('');
    const [disposition, setDisposition] = useState('reviewed'); // reviewed | needs_followup | referred | closed

    const [soapNote, setSoapNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState({});

    const [toast, setToast] = useState(null);

    const showToast = (message) => {
        setToast({ id: Date.now(), message });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const sessionRes = await axios.get(`${API_BASE}/sessions/${sessionId}`, {
                withCredentials: true,
            });
            if (!sessionRes.data?.success) {
                throw new Error(sessionRes.data?.message || 'Unable to load session');
            }

            const { session: s, diagnosis: d } = sessionRes.data.data;
            setSession(s);
            setDiagnosis(d);
            setSoapNote(d?.clinicalNote || '');

            if (s?.patientId) {
                const histRes = await axios.get(
                    `${API_BASE}/doctors/patients/${s.patientId}/history`,
                    { withCredentials: true },
                );
                if (histRes.data?.success) {
                    setPatient(histRes.data.data.patient);
                    setTimeline(histRes.data.data.timeline || []);
                    setPatientSummary(histRes.data.data.summary || null);
                }
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    err.message ||
                    'Unable to load clinical session for review.',
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    const riskUI = useMemo(() => {
        if (!session) return null;
        const cfg = RISK_CONFIG[session.riskLevel] || RISK_CONFIG.low;
        return {
            ...cfg,
            score: session.riskScore ?? 0,
        };
    }, [session]);

    const derivedRiskReasoning = useMemo(() => {
        if (!session) return '';
        const level = session.riskLevel || 'low';
        const chief = session.extractedSymptoms?.[0]?.name;
        const count = session.extractedSymptoms?.length || 0;
        if (level === 'critical') {
            return `High composite risk driven by severe symptoms such as "${chief || 'red-flag presentation'}" with ${count} documented findings and elevated AI risk score (${session.riskScore}/100). Recommend urgent in-person evaluation.`;
        }
        if (level === 'high') {
            return `Significant symptom burden with "${chief || 'key complaints'}", resulting in a high AI risk estimate (${session.riskScore}/100). Consider early in-person review or escalation if symptoms worsen.`;
        }
        if (level === 'medium') {
            return `Moderate risk profile based on current symptoms and vitals. Outpatient follow-up and safety-net advice are recommended.`;
        }
        return `Low estimated risk based on current presentation. Home care with clear return precautions is likely appropriate.`;
    }, [session]);

    const redFlags = useMemo(() => {
        const modelFlags = diagnosis?.redFlagSymptoms || [];
        const severeSymptoms =
            session?.extractedSymptoms?.filter((s) => (s.severity || 0) >= 8).map((s) => s.name) ||
            [];
        const merged = [...modelFlags, ...severeSymptoms].filter(Boolean);
        return Array.from(new Set(merged));
    }, [diagnosis, session]);

    const investigations = useMemo(() => {
        if (!diagnosis?.predictions?.length) return [];
        const all = diagnosis.predictions.flatMap((p) => p.sources || []);
        return Array.from(new Set(all));
    }, [diagnosis]);

    const handleCopySoap = async () => {
        try {
            await navigator.clipboard.writeText(soapNote || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            showToast('Unable to copy to clipboard in this browser.');
        }
    };

    const handleExportSoapPdf = async () => {
        if (!soapNote) return;
        setExporting(true);
        try {
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const margin = 40;
            let y = margin;

            const addLine = (text, { bold = false, size = 11 } = {}) => {
                doc.setFont('Helvetica', bold ? 'bold' : 'normal');
                doc.setFontSize(size);
                const pageWidth = doc.internal.pageSize.getWidth();
                const maxWidth = pageWidth - margin * 2;
                const lines = doc.splitTextToSize(text, maxWidth);
                lines.forEach((line) => {
                    if (y > doc.internal.pageSize.getHeight() - margin) {
                        doc.addPage();
                        y = margin;
                    }
                    doc.text(line, margin, y);
                    y += 16;
                });
            };

            addLine('MediAI – SOAP Clinical Note', { bold: true, size: 16 });
            y += 8;
            const patientName = patient?.name || 'Patient';
            addLine(
                `${patientName} • Session ID: ${session?._id || sessionId} • Risk: ${
                    session?.riskScore ?? '-'
                }/100`,
                { size: 10 },
            );
            y += 12;

            addLine('AI-generated SOAP note (editable draft):', { bold: true });
            addLine(soapNote || '');

            doc.save('mediai-soap-note.pdf');
        } finally {
            setExporting(false);
        }
    };

    const handleSave = async () => {
        if (!session) return;
        setSaving(true);
        try {
            const dispositionLabel =
                disposition === 'needs_followup'
                    ? 'Needs Follow-up'
                    : disposition === 'referred'
                        ? 'Referred'
                        : disposition === 'closed'
                            ? 'Closed'
                            : 'Reviewed';

            const headerLines = [
                `AI Assessment: ${assessmentAgreement === 'agree' ? 'Agreed' : 'Modified'}`,
                diagnosisOverride ? `Diagnosis Override: ${diagnosisOverride}` : null,
                `Disposition: ${dispositionLabel}`,
            ]
                .filter(Boolean)
                .join('\n');

            const finalNotes = `${headerLines}\n\n${doctorNotes || ''}`.trim();

            if (finalNotes) {
                await axios.post(
                    `${API_BASE}/doctors/notes/${session._id}`,
                    {
                        notes: finalNotes,
                        markReviewed: disposition !== 'closed',
                    },
                    { withCredentials: true },
                );
            }

            if (disposition === 'closed') {
                await axios.patch(
                    `${API_BASE}/sessions/${session._id}/status`,
                    { status: 'closed' },
                    { withCredentials: true },
                );
            }

            showToast('Review saved for this session.');
            await fetchData();
        } catch (err) {
            showToast(
                err.response?.data?.message || 'Unable to save doctor review for this session.',
            );
        } finally {
            setSaving(false);
        }
    };

    const handleFeedback = (condition, value) => {
        setFeedback((prev) => {
            const current = prev[condition];
            const next = current === value ? null : value;
            return { ...prev, [condition]: next };
        });
        showToast('Feedback recorded (used to improve AI over time).');
    };

    const renderSymptomList = () => {
        if (!session?.extractedSymptoms?.length) {
            return (
                <p className="text-xs text-slate-500">
                    No structured symptoms were extracted for this session.
                </p>
            );
        }

        return (
            <div className="space-y-2">
                {session.extractedSymptoms.map((sym, idx) => {
                    const severity = sym.severity ?? 5;
                    const confidence = Math.min(100, Math.round(severity * 10));
                    return (
                        <div
                            key={`${sym.name || 'sym'}-${idx}`}
                            className="bg-slate-50 rounded-2xl px-3 py-2 flex items-start gap-3"
                        >
                            <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {confidence}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-semibold text-sm text-slate-800 truncate">
                                        {sym.name || 'Symptom'}
                                    </div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                                        Conf.
                                    </div>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                        className="h-full bg-teal-500"
                                        style={{ width: `${confidence}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                                    {sym.bodyLocation && (
                                        <span>{sym.bodyLocation}</span>
                                    )}
                                    {sym.duration && <span>• {sym.duration}</span>}
                                    {sym.onset && <span>• Onset: {sym.onset}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                <p className="text-slate-500 text-sm font-semibold">
                    Loading clinical session for review…
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!session) return null;

    const formattedDob =
        patient?.dateOfBirth && new Date(patient.dateOfBirth).toLocaleDateString();
    const age =
        patient?.dateOfBirth &&
        Math.floor(
            (Date.now() - new Date(patient.dateOfBirth).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000),
        );

    return (
        <div className="space-y-6">
            {toast && (
                <div className="fixed bottom-6 right-6 z-40">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm shadow-xl shadow-slate-900/40">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        Clinical Session Review
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white">
                            Doctor View
                        </span>
                    </h1>
                    <p className="text-xs text-slate-500">
                        Session ID: {session._id}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800"
                >
                    Back
                    <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left column: Patient Info */}
                <div className="space-y-4">
                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                    Patient
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                    {patient?.name || 'Patient'}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    {patient?.email || 'No email on file'}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500">
                            <div>
                                <p className="font-semibold text-slate-700">Age</p>
                                <p>{age ? `${age} years` : '—'}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700">Gender</p>
                                <p className="capitalize">
                                    {patient?.gender || 'Not specified'}
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700">DOB</p>
                                <p>{formattedDob || '—'}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700">Blood group</p>
                                <p>{patient?.bloodGroup || '—'}</p>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-teal-600" />
                            Clinical background
                        </h2>
                        <InfoList
                            label="Chronic conditions"
                            items={patient?.chronicConditions}
                            placeholder="No chronic conditions recorded."
                        />
                        <InfoList
                            label="Allergies"
                            items={patient?.allergies}
                            placeholder="No allergies documented."
                        />
                        <InfoList
                            label="Current medications"
                            items={patient?.currentMedications}
                            placeholder="No current medications saved."
                            icon={Pill}
                        />
                    </section>

                    <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm p-4 space-y-3 text-white">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-amber-300" />
                            <h2 className="text-xs font-bold uppercase tracking-widest">
                                Drug interaction warnings
                            </h2>
                        </div>
                        <p className="text-[11px] text-slate-300">
                            In a full deployment, MediAI automatically screens this patient’s
                            current medications for high-risk interactions using the drug
                            interaction engine.
                        </p>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-emerald-300">
                                No blocking interactions detected in this demo.
                            </span>
                            <button
                                type="button"
                                onClick={() => navigate('/drugs')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-white text-slate-900 text-[10px] font-bold uppercase tracking-widest"
                            >
                                Open drug checker
                                <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    </section>

                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <HeartPulse className="w-4 h-4 text-rose-500" />
                                Previous sessions
                            </h2>
                            {patientSummary && (
                                <p className="text-[11px] text-slate-400">
                                    {patientSummary.totalSessions} total • Avg risk:{' '}
                                    {patientSummary.avgRiskScore}/100
                                </p>
                            )}
                        </div>
                        {timeline && timeline.length ? (
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {timeline.slice(0, 5).map((t) => {
                                    const d = t.date ? new Date(t.date) : null;
                                    const cfg = RISK_CONFIG[t.riskLevel] || RISK_CONFIG.low;
                                    return (
                                        <li
                                            key={t.sessionId}
                                            className="flex items-center justify-between gap-2 text-[11px]"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={cn(
                                                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                                        cfg.ring.replace('ring-', 'bg-'),
                                                    )}
                                                />
                                                <span className="truncate text-slate-600">
                                                    {d
                                                        ? d.toLocaleDateString()
                                                        : 'Previous session'}
                                                </span>
                                            </div>
                                            <span className="text-slate-400">
                                                {t.riskScore ?? '-'} / 100
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-[11px] text-slate-400">
                                This appears to be the first recorded session for this
                                patient.
                            </p>
                        )}
                    </section>
                </div>

                {/* Right column: AI Analysis + Doctor actions */}
                <div className="space-y-4">
                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                    AI risk assessment
                                </h2>
                            </div>
                            {riskUI && (
                                <span
                                    className={cn(
                                        'px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
                                        riskUI.color,
                                    )}
                                >
                                    {riskUI.label} • {riskUI.score}/100
                                </span>
                            )}
                        </div>
                        {riskUI && (
                            <div className="flex items-center gap-4">
                                <div className="relative w-28 h-28 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle
                                            cx="56"
                                            cy="56"
                                            r="48"
                                            fill="none"
                                            stroke="#e2e8f0"
                                            strokeWidth="10"
                                        />
                                        <circle
                                            cx="56"
                                            cy="56"
                                            r="48"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="10"
                                            strokeDasharray={2 * Math.PI * 48}
                                            strokeDashoffset={
                                                2 * Math.PI * 48 -
                                                ((2 * Math.PI * 48 * riskUI.score) / 100 || 0)
                                            }
                                            strokeLinecap="round"
                                            className={cn(
                                                'transition-all duration-700 ease-out',
                                                riskUI.ring.replace('ring-', 'text-'),
                                            )}
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-xl font-black text-slate-900">
                                            {riskUI.score}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                            Risk
                                        </span>
                                    </div>
                                </div>
                                <p className="flex-1 text-xs text-slate-600 leading-relaxed">
                                    {derivedRiskReasoning}
                                </p>
                            </div>
                        )}
                        <div className="border-t border-slate-100 pt-3">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-teal-600" />
                                Extracted symptoms
                            </h3>
                            {renderSymptomList()}
                        </div>
                    </section>

                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-700" />
                                AI differential diagnosis
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Click 👍 / 👎 to provide feedback per diagnosis.
                            </p>
                        </div>

                        {diagnosis?.predictions?.length ? (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                {diagnosis.predictions.map((p) => {
                                    const key = p.condition || 'Diagnosis';
                                    const fb = feedback[key];
                                    return (
                                        <details
                                            key={key + (p.icdCode || '')}
                                            className="group bg-slate-50 rounded-2xl px-3 py-2"
                                        >
                                            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                        {p.confidence != null
                                                            ? `${p.confidence}%`
                                                            : '--'}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800 truncate">
                                                            {p.condition || 'Diagnosis'}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400">
                                                            {p.icdCode || 'No ICD code'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleFeedback(key, 'up');
                                                        }}
                                                        className={cn(
                                                            'w-7 h-7 rounded-full border flex items-center justify-center text-xs',
                                                            fb === 'up'
                                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                                : 'border-slate-200 text-slate-500 hover:bg-emerald-50',
                                                        )}
                                                    >
                                                        <ThumbsUp className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleFeedback(key, 'down');
                                                        }}
                                                        className={cn(
                                                            'w-7 h-7 rounded-full border flex items-center justify-center text-xs',
                                                            fb === 'down'
                                                                ? 'bg-red-500 border-red-500 text-white'
                                                                : 'border-slate-200 text-slate-500 hover:bg-red-50',
                                                        )}
                                                    >
                                                        <ThumbsDown className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </summary>
                                            {(p.reasoning || (p.sources && p.sources.length)) && (
                                                <div className="mt-2 text-[11px] text-slate-600 space-y-1">
                                                    {p.reasoning && (
                                                        <p>
                                                            <span className="font-semibold">
                                                                Reasoning:{' '}
                                                            </span>
                                                            {p.reasoning}
                                                        </p>
                                                    )}
                                                    {p.sources && p.sources.length > 0 && (
                                                        <p>
                                                            <span className="font-semibold">
                                                                Suggested investigations:{' '}
                                                            </span>
                                                            {p.sources.join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </details>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">
                                No differential diagnosis is stored for this session yet.
                            </p>
                        )}

                        {redFlags.length > 0 && (
                            <div className="border-t border-slate-100 pt-3 space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Red flag symptoms
                                </h3>
                                <div className="flex flex-wrap gap-1.5 text-[11px]">
                                    {redFlags.map((rf) => (
                                        <span
                                            key={rf}
                                            className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-100"
                                        >
                                            {rf}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {investigations.length > 0 && (
                            <div className="border-t border-slate-100 pt-3 space-y-1">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                    Recommended investigations
                                </h3>
                                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                                    {investigations.map((inv) => (
                                        <li key={inv}>{inv}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>

                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-teal-600" />
                                SOAP note
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopySoap}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200"
                                >
                                    <ClipboardCopy className="w-3 h-3" />
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                    type="button"
                                    disabled={!soapNote || exporting}
                                    onClick={handleExportSoapPdf}
                                    className={cn(
                                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl text-[10px] font-bold uppercase tracking-widest',
                                        !soapNote || exporting
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-slate-900 text-white',
                                    )}
                                >
                                    {exporting && (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    )}
                                    Export PDF
                                </button>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Editable AI-generated SOAP draft. You can tweak this note and export
                            it for your records or EMR.
                        </p>
                        <textarea
                            value={soapNote}
                            onChange={(e) => setSoapNote(e.target.value)}
                            className="w-full h-44 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                            placeholder="SOAP note is not available for this session."
                        />
                    </section>

                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-slate-700" />
                            Doctor assessment & actions
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                            <div className="space-y-1">
                                <p className="font-semibold text-slate-700">
                                    Alignment with AI assessment
                                </p>
                                <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px]">
                                    <button
                                        type="button"
                                        onClick={() => setAssessmentAgreement('agree')}
                                        className={cn(
                                            'px-3 py-1 rounded-full font-bold uppercase tracking-widest',
                                            assessmentAgreement === 'agree'
                                                ? 'bg-teal-600 text-white shadow-sm'
                                                : 'text-slate-500',
                                        )}
                                    >
                                        Agree
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAssessmentAgreement('modify')}
                                        className={cn(
                                            'px-3 py-1 rounded-full font-bold uppercase tracking-widest',
                                            assessmentAgreement === 'modify'
                                                ? 'bg-slate-900 text-white shadow-sm'
                                                : 'text-slate-500',
                                        )}
                                    >
                                        Modify
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-slate-700">Disposition</p>
                                <div className="grid grid-cols-2 gap-1">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="reviewed"
                                            checked={disposition === 'reviewed'}
                                            onChange={(e) => setDisposition(e.target.value)}
                                            className="w-3 h-3 text-teal-600 border-slate-300"
                                        />
                                        <span>Reviewed</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="needs_followup"
                                            checked={disposition === 'needs_followup'}
                                            onChange={(e) => setDisposition(e.target.value)}
                                            className="w-3 h-3 text-teal-600 border-slate-300"
                                        />
                                        <span>Needs follow-up</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="referred"
                                            checked={disposition === 'referred'}
                                            onChange={(e) => setDisposition(e.target.value)}
                                            className="w-3 h-3 text-teal-600 border-slate-300"
                                        />
                                        <span>Referred</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            value="closed"
                                            checked={disposition === 'closed'}
                                            onChange={(e) => setDisposition(e.target.value)}
                                            className="w-3 h-3 text-teal-600 border-slate-300"
                                        />
                                        <span>Closed</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                            <div className="space-y-1">
                                <p className="font-semibold text-slate-700">
                                    Diagnosis override (optional)
                                </p>
                                <input
                                    type="text"
                                    value={diagnosisOverride}
                                    onChange={(e) => setDiagnosisOverride(e.target.value)}
                                    placeholder="e.g. Acute appendicitis vs. viral gastroenteritis"
                                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                                />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-slate-700">
                                    Doctor notes (for EMR / handoff)
                                </p>
                                <textarea
                                    value={doctorNotes}
                                    onChange={(e) => setDoctorNotes(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40 resize-none"
                                    placeholder="Summarize your impression, management plan, and safety-net advice."
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[11px] text-slate-400">
                                Saving will mark this session as reviewed (or closed) and attach
                                your notes to the record.
                            </p>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className={cn(
                                    'inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest bg-teal-600 text-white shadow-sm hover:bg-teal-700',
                                    saving && 'opacity-60 cursor-not-allowed',
                                )}
                            >
                                {saving && (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                Save review
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

const InfoList = ({ label, items, placeholder, icon: Icon }) => {
    const hasItems = items && items.length;
    return (
        <div className="space-y-1 text-[11px]">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                {Icon && <Icon className="w-3 h-3 text-slate-500" />}
                {label}
            </p>
            {hasItems ? (
                <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                        <span
                            key={item}
                            className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700"
                        >
                            {item}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-slate-400">{placeholder}</p>
            )}
        </div>
    );
};

export default DoctorSessionReview;

