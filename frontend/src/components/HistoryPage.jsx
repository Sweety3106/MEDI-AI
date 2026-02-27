import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertCircle,
    CalendarIcon,
    ChevronDown,
    ChevronUp,
    Download,
    Filter,
    Activity,
    BarChart3,
    PieChart as PieChartIcon,
    LineChart as LineChartIcon,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    CartesianGrid,
    Legend,
} from 'recharts';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const RISK_CONFIG = {
    critical: { label: 'Critical', color: 'bg-red-100 text-red-700', dot: 'bg-red-500', chart: '#ef4444' },
    high: { label: 'High', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', chart: '#f97316' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', chart: '#eab308' },
    low: { label: 'Low', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', chart: '#10b981' },
};

const TRIAGE_LABELS = {
    emergency: 'Emergency Department (Immediately)',
    urgent_care: 'Urgent Care (Within Hours)',
    gp: 'See a GP (1–2 days)',
    home_care: 'Home Care / Monitor',
};

const STATUS_OPTIONS = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'closed', label: 'Closed' },
];

const RISK_OPTIONS = [
    { value: '', label: 'All Risk Levels' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

const HistoryPage = () => {
    const [sessions, setSessions] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [filters, setFilters] = useState({
        from: '',
        to: '',
        riskLevel: '',
        status: '',
        page: 1,
        limit: 50,
    });

    const [expandedId, setExpandedId] = useState(null);
    const [exporting, setExporting] = useState(false);

    const fetchSessions = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (filters.from) params.from = filters.from;
            if (filters.to) params.to = filters.to;
            if (filters.riskLevel) params.riskLevel = filters.riskLevel;
            if (filters.status) params.status = filters.status;
            params.page = filters.page;
            params.limit = filters.limit;

            const res = await axios.get(`${API_BASE}/sessions`, {
                params,
                withCredentials: true,
            });

            if (res.data?.success) {
                setSessions(res.data.data || []);
                setMeta(res.data.meta || null);
            } else {
                setError(res.data?.message || 'Unable to load history.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to load history.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stats = useMemo(() => {
        if (!sessions.length) {
            return {
                total: meta?.total || 0,
                symptoms: [],
                riskDistribution: [],
                riskTrend: [],
            };
        }

        const symptomCounts = {};
        const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
        const riskByDate = {};

        sessions.forEach((s) => {
            (s.extractedSymptoms || []).forEach((sym) => {
                if (!sym?.name) return;
                const key = sym.name.trim();
                symptomCounts[key] = (symptomCounts[key] || 0) + 1;
            });

            if (riskCounts[s.riskLevel] !== undefined) {
                riskCounts[s.riskLevel] += 1;
            }

            const dateKey = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : 'Unknown';
            if (!riskByDate[dateKey]) {
                riskByDate[dateKey] = { date: dateKey, riskScoreSum: 0, count: 0 };
            }
            riskByDate[dateKey].riskScoreSum += s.riskScore || 0;
            riskByDate[dateKey].count += 1;
        });

        const symptomsArr = Object.entries(symptomCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const riskDistribution = Object.entries(riskCounts)
            .filter(([, value]) => value > 0)
            .map(([key, value]) => ({
                name: RISK_CONFIG[key].label,
                value,
                key,
            }));

        const riskTrend = Object.values(riskByDate)
            .map((item) => ({
                date: item.date,
                avgRisk: item.count ? Math.round((item.riskScoreSum / item.count) * 10) / 10 : 0,
            }))
            .sort((a, b) => (a.date > b.date ? 1 : -1));

        return {
            total: meta?.total ?? sessions.length,
            symptoms: symptomsArr,
            riskDistribution,
            riskTrend,
        };
    }, [sessions, meta]);

    const handleFilterChange = (field, value) => {
        setFilters((prev) => ({
            ...prev,
            [field]: value,
            page: 1,
        }));
    };

    const handleApplyFilters = () => {
        fetchSessions();
    };

    const handleExportPDF = async () => {
        if (!sessions.length) return;
        setExporting(true);
        try {
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });

            const margin = 40;
            let y = margin;

            const addLine = (text, options = {}) => {
                const { bold = false, size = 11 } = options;
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

            doc.setFontSize(18);
            doc.setFont('Helvetica', 'bold');
            doc.text('MediAI - Symptom History', margin, y);
            y += 26;

            doc.setFontSize(11);
            doc.setFont('Helvetica', 'normal');
            const now = new Date().toLocaleString();
            addLine(`Generated: ${now}`);

            if (filters.from || filters.to) {
                addLine(
                    `Date Range: ${filters.from || 'Start'} — ${filters.to || 'Today'}`
                );
            }

            addLine(
                `Total Sessions in View: ${stats.total}`
            );

            y += 8;
            addLine(' ', { size: 6 });

            sessions.forEach((s, index) => {
                y += 4;
                addLine(`Session ${index + 1}`, { bold: true, size: 13 });
                const createdAt = s.createdAt
                    ? new Date(s.createdAt).toLocaleString()
                    : 'Unknown';
                const riskLabel = RISK_CONFIG[s.riskLevel]?.label || 'Unknown';
                const triageLabel = TRIAGE_LABELS[s.triageRecommendation] || s.triageRecommendation;
                const statusLabel = s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : 'Unknown';

                addLine(`Date & Time: ${createdAt}`);
                addLine(`Risk: ${riskLabel} (${s.riskScore ?? '-'} / 100)`);
                addLine(`Status: ${statusLabel}`);
                if (triageLabel) {
                    addLine(`Triage Recommendation: ${triageLabel}`);
                }

                const chief = (s.extractedSymptoms && s.extractedSymptoms[0]?.name) || 'Not specified';
                addLine(`Chief Complaint: ${chief}`);

                const additionalSymptoms = (s.extractedSymptoms || [])
                    .slice(1)
                    .map((sym) => sym.name)
                    .filter(Boolean);

                if (additionalSymptoms.length) {
                    addLine(`Other Symptoms: ${additionalSymptoms.join(', ')}`);
                }

                const vs = s.vitalSigns || {};
                const vitalsLine = [
                    vs.temperature != null ? `Temp: ${vs.temperature}°C` : null,
                    vs.bloodPressure ? `BP: ${vs.bloodPressure}` : null,
                    vs.heartRate != null ? `HR: ${vs.heartRate} bpm` : null,
                    vs.spo2 != null ? `SpO₂: ${vs.spo2}%` : null,
                ]
                    .filter(Boolean)
                    .join('  •  ');
                if (vitalsLine) {
                    addLine(`Vitals: ${vitalsLine}`);
                }

                if (s.rawInput) {
                    addLine('Patient Description:', { bold: true });
                    addLine(`"${s.rawInput}"`);
                }

                y += 10;
            });

            doc.save('mediai-history.pdf');
        } finally {
            setExporting(false);
        }
    };

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-16 space-y-6 bg-white rounded-3xl border border-dashed border-slate-200">
            <div className="w-32 h-32 rounded-full bg-teal-50 flex items-center justify-center">
                <div className="w-20 h-20 rounded-3xl border-4 border-dashed border-teal-200 flex flex-col items-center justify-center text-teal-500">
                    <Activity className="w-8 h-8 mb-1" />
                </div>
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-800">No symptom history yet</h2>
                <p className="text-slate-500 text-sm max-w-md">
                    Start your first symptom check to build a timeline your doctor can review later.
                </p>
            </div>
            <a
                href="/symptoms"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-600 text-white text-sm font-bold shadow-md shadow-teal-500/30 hover:bg-teal-700 transition-colors"
            >
                Start your first symptom check
            </a>
        </div>
    );

    const renderTimelineItem = (session) => {
        const riskCfg = RISK_CONFIG[session.riskLevel] || RISK_CONFIG.low;
        const date = session.createdAt ? new Date(session.createdAt) : null;
        const isExpanded = expandedId === session._id;
        const chiefSymptom =
            (session.extractedSymptoms && session.extractedSymptoms[0]?.name) ||
            (session.rawInput ? session.rawInput.slice(0, 60) + '…' : 'Symptom session');

        const triageLabel = TRIAGE_LABELS[session.triageRecommendation] || session.triageRecommendation;
        const statusLabel = session.status
            ? session.status.charAt(0).toUpperCase() + session.status.slice(1)
            : 'Unknown';

        const vitals = session.vitalSigns || {};

        return (
            <li key={session._id || session.createdAt} className="relative pl-10 pb-10 last:pb-0">
                <span className="absolute left-3 top-3 -ml-px h-full w-px bg-slate-200" />
                <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-white border-2 border-teal-500 flex items-center justify-center">
                    <span className={cn('w-2 h-2 rounded-full', riskCfg.dot)} />
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                <CalendarIcon className="w-3 h-3" />
                                <span>
                                    {date
                                        ? `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}`
                                        : 'Unknown time'}
                                </span>
                            </div>
                            <h3 className="mt-1 text-sm font-bold text-slate-800">
                                {chiefSymptom}
                            </h3>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
                                        riskCfg.color
                                    )}
                                >
                                    {riskCfg.label}
                                </span>
                                <span className="text-xs font-mono text-slate-500">
                                    {session.riskScore ?? '-'} / 100
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold">
                                Status: {statusLabel}
                            </span>
                        </div>
                    </div>

                    {triageLabel && (
                        <div className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">Triage:</span>{' '}
                            {triageLabel}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : session._id)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-teal-600 hover:text-teal-700"
                    >
                        {isExpanded ? 'Hide details' : 'View full details'}
                        {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        )}
                    </button>

                    {isExpanded && (
                        <div className="mt-3 border-t border-slate-100 pt-3 space-y-3 text-xs text-slate-600">
                            {session.extractedSymptoms && session.extractedSymptoms.length > 0 && (
                                <div>
                                    <div className="font-semibold text-slate-700 mb-1">Symptoms</div>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {session.extractedSymptoms.map((sym, idx) => (
                                            <li key={`${sym.name || 'sym'}-${idx}`} className="flex items-start gap-2">
                                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-400" />
                                                <div>
                                                    <div className="font-semibold">{sym.name || 'Symptom'}</div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {[
                                                            sym.bodyLocation,
                                                            sym.duration,
                                                            sym.severity != null ? `Severity: ${sym.severity}/10` : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(' • ')}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {(vitals.temperature != null ||
                                vitals.bloodPressure ||
                                vitals.heartRate != null ||
                                vitals.spo2 != null) && (
                                <div>
                                    <div className="font-semibold text-slate-700 mb-1">Vitals</div>
                                    <div className="flex flex-wrap gap-2 text-[11px]">
                                        {vitals.temperature != null && (
                                            <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-100">
                                                Temp: {vitals.temperature}°C
                                            </span>
                                        )}
                                        {vitals.bloodPressure && (
                                            <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-100">
                                                BP: {vitals.bloodPressure}
                                            </span>
                                        )}
                                        {vitals.heartRate != null && (
                                            <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-100">
                                                HR: {vitals.heartRate} bpm
                                            </span>
                                        )}
                                        {vitals.spo2 != null && (
                                            <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-100">
                                                SpO₂: {vitals.spo2}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {session.rawInput && (
                                <div>
                                    <div className="font-semibold text-slate-700 mb-1">Patient description</div>
                                    <p className="text-slate-600 italic bg-slate-50/60 rounded-xl px-3 py-2">
                                        “{session.rawInput}”
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </li>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Symptom History</h1>
                    <p className="text-slate-500 text-sm">
                        A timeline of all your AI-assisted symptom checks. Filter, explore trends, and export for your doctor.
                    </p>
                </div>
                <button
                    type="button"
                    disabled={!sessions.length || exporting}
                    onClick={handleExportPDF}
                    className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold shadow-sm border transition-colors',
                        !sessions.length || exporting
                            ? 'bg-slate-100 text-slate-400 border-slate-100 cursor-not-allowed'
                            : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                    )}
                >
                    <Download className="w-4 h-4" />
                    {exporting ? 'Preparing PDF...' : 'Download full history (PDF)'}
                </button>
            </div>

            <section className="bg-white rounded-3xl border border-slate-100 p-4 md:p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Filters</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                            From
                        </label>
                        <input
                            type="date"
                            value={filters.from}
                            onChange={(e) => handleFilterChange('from', e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                            To
                        </label>
                        <input
                            type="date"
                            value={filters.to}
                            onChange={(e) => handleFilterChange('to', e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                            Risk Level
                        </label>
                        <select
                            value={filters.riskLevel}
                            onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                        >
                            {RISK_OPTIONS.map((opt) => (
                                <option key={opt.value || 'all-risk'} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                            Status
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value || 'all-status'} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleApplyFilters}
                                className="px-3 py-2 rounded-2xl bg-teal-600 text-white text-xs font-bold uppercase tracking-widest shadow-sm hover:bg-teal-700"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
                {meta && (
                    <div className="mt-3 text-[11px] text-slate-400">
                        Showing{' '}
                        <span className="font-semibold text-slate-600">
                            {sessions.length}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-slate-600">
                            {meta.total}
                        </span>{' '}
                        sessions
                    </div>
                )}
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                    Total Sessions
                                </p>
                                <p className="text-3xl font-extrabold text-slate-900 mt-1">
                                    {stats.total}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                                <Activity className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            History across all your AI symptom checks in the selected range.
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-teal-600" />
                                <h3 className="text-sm font-bold text-slate-800">
                                    Most frequent symptoms
                                </h3>
                            </div>
                        </div>
                        {stats.symptoms.length ? (
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={stats.symptoms}
                                        layout="vertical"
                                        margin={{ top: 0, right: 16, bottom: 0, left: 40 }}
                                    >
                                        <XAxis type="number" hide />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={80}
                                            tick={{ fontSize: 10 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(15, 118, 110, 0.04)' }}
                                            contentStyle={{
                                                fontSize: 11,
                                                borderRadius: 12,
                                                borderColor: '#e2e8f0',
                                            }}
                                        />
                                        <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 4, 4]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                We will show your most frequent symptoms once you complete at least one session.
                            </p>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <PieChartIcon className="w-4 h-4 text-teal-600" />
                                <h3 className="text-sm font-bold text-slate-800">
                                    Risk level distribution
                                </h3>
                            </div>
                        </div>
                        {stats.riskDistribution.length ? (
                            <div className="flex items-center gap-4">
                                <div className="h-40 flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.riskDistribution}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={45}
                                                outerRadius={70}
                                                paddingAngle={2}
                                            >
                                                {stats.riskDistribution.map((entry) => (
                                                    <Cell
                                                        key={entry.key}
                                                        fill={RISK_CONFIG[entry.key]?.chart || '#64748b'}
                                                    />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    fontSize: 11,
                                                    borderRadius: 12,
                                                    borderColor: '#e2e8f0',
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-1 text-[11px]">
                                    {stats.riskDistribution.map((entry) => (
                                        <div key={entry.key} className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        RISK_CONFIG[entry.key]?.chart || '#64748b',
                                                }}
                                            />
                                            <span className="text-slate-600 font-semibold">
                                                {entry.name}
                                            </span>
                                            <span className="text-slate-400">
                                                ({entry.value} session
                                                {entry.value !== 1 ? 's' : ''})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                Once you have sessions across different risk levels, we will visualize them here.
                            </p>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <LineChartIcon className="w-4 h-4 text-teal-600" />
                                <h3 className="text-sm font-bold text-slate-800">
                                    Risk trend over time
                                </h3>
                            </div>
                        </div>
                        {stats.riskTrend.length ? (
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.riskTrend} margin={{ top: 5, right: 16, bottom: 0, left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 10 }}
                                            tickMargin={8}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10 }}
                                            tickMargin={6}
                                            domain={[0, 100]}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                fontSize: 11,
                                                borderRadius: 12,
                                                borderColor: '#e2e8f0',
                                            }}
                                        />
                                        <Legend
                                            verticalAlign="top"
                                            align="right"
                                            iconSize={8}
                                            wrapperStyle={{ fontSize: 10 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="avgRisk"
                                            name="Avg Risk Score"
                                            stroke="#0f766e"
                                            strokeWidth={2}
                                            dot={{ r: 2 }}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400">
                                As you complete more sessions over time, we will show whether your overall risk is improving or worsening.
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <section className="bg-slate-50/60 rounded-3xl border border-slate-100 p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <h2 className="text-sm font-bold text-slate-800">
                            Timeline
                        </h2>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-500 animate-pulse">
                            Loading your history...
                        </p>
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                ) : !sessions.length ? (
                    renderEmptyState()
                ) : (
                    <ol className="mt-2">
                        {sessions.map((session) => renderTimelineItem(session))}
                    </ol>
                )}
            </section>
        </div>
    );
};

export default HistoryPage;

