import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    Bell,
    Activity,
    Users,
    ClipboardList,
    TrendingUp,
    ArrowRight,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const RISK_CONFIG = {
    critical: { label: 'CRITICAL', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
    high: { label: 'HIGH', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    medium: { label: 'MEDIUM', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
    low: { label: 'LOW', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

const DoctorDashboard = ({ user }) => {
    const navigate = useNavigate();

    // Role-gating (simple client-side guard)
    if (user?.role !== 'doctor' && user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <XCircle className="w-10 h-10 text-red-500" />
                <p className="text-slate-600 font-semibold text-sm">
                    This dashboard is only available to doctor accounts.
                </p>
            </div>
        );
    }

    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState(null);

    const [alerts, setAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [tableRiskFilter, setTableRiskFilter] = useState('');
    const [sortByRisk, setSortByRisk] = useState(true);

    const [toast, setToast] = useState(null);
    const [lastAlertCount, setLastAlertCount] = useState(0);

    const [markingSessionId, setMarkingSessionId] = useState(null);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE}/doctors/dashboard`, {
                withCredentials: true,
            });
            if (res.data?.success) {
                setDashboard(res.data.data);
            }
        } catch (err) {
            // Silent fail for now; could surface to UI if needed
        } finally {
            setLoading(false);
        }
    };

    const fetchAlerts = async ({ showToastForNew = true } = {}) => {
        try {
            setAlertsLoading(true);
            const res = await axios.get(`${API_BASE}/doctors/alerts`, {
                withCredentials: true,
            });
            if (res.data?.success) {
                const list = res.data.data || [];
                setAlerts(list);

                if (showToastForNew && lastAlertCount && list.length > lastAlertCount) {
                    const diff = list.length - lastAlertCount;
                    setToast({
                        id: Date.now(),
                        message: `${diff} new sessions since your last visit`,
                    });
                    setTimeout(() => setToast(null), 4000);
                }
                setLastAlertCount(list.length);
            }
        } catch (err) {
            // Silent fail for now
        } finally {
            setAlertsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
        fetchAlerts({ showToastForNew: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll dashboard criticals every 30s
    useEffect(() => {
        const id = setInterval(() => {
            fetchDashboard();
        }, 30000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll alerts endpoint every 60s
    useEffect(() => {
        const id = setInterval(() => {
            fetchAlerts({ showToastForNew: true });
        }, 60000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastAlertCount]);

    const criticalPanelAlerts = useMemo(() => {
        if (!alerts?.length) return [];
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return alerts
            .filter((a) => a.riskLevel === 'critical' && new Date(a.createdAt) >= last24h)
            .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
    }, [alerts]);

    const recentSessions = useMemo(() => {
        const list = dashboard?.recentSessions || [];
        const filtered = list.filter((s) => {
            const matchesRisk = tableRiskFilter
                ? s.riskLevel === tableRiskFilter
                : true;
            const q = search.trim().toLowerCase();
            const matchesSearch = !q
                ? true
                : (s.patient?.name || '').toLowerCase().includes(q) ||
                  (s.patient?.email || '').toLowerCase().includes(q);
            return matchesRisk && matchesSearch;
        });

        if (sortByRisk) {
            const weight = { critical: 4, high: 3, medium: 2, low: 1 };
            filtered.sort(
                (a, b) =>
                    (weight[b.riskLevel] || 0) - (weight[a.riskLevel] || 0) ||
                    (b.riskScore || 0) - (a.riskScore || 0),
            );
        } else {
            filtered.sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            );
        }

        return filtered;
    }, [dashboard, search, tableRiskFilter, sortByRisk]);

    const handleMarkReviewed = async (sessionId) => {
        try {
            setMarkingSessionId(sessionId);
            await axios.patch(
                `${API_BASE}/sessions/${sessionId}/status`,
                { status: 'reviewed' },
                { withCredentials: true },
            );
            await Promise.all([fetchDashboard(), fetchAlerts({ showToastForNew: false })]);
        } catch (err) {
            setToast({
                id: Date.now(),
                message: 'Failed to mark session as reviewed',
            });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setMarkingSessionId(null);
        }
    };

    const renderRiskBadge = (riskLevel) => {
        const cfg = RISK_CONFIG[riskLevel] || RISK_CONFIG.low;
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest',
                    cfg.badge,
                )}
            >
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                {cfg.label}
            </span>
        );
    };

    const formatTime = (ts) => {
        if (!ts) return 'Unknown';
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateTime = (ts) => {
        if (!ts) return 'Unknown';
        const d = new Date(ts);
        return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })}`;
    };

    const formatPatient = (patient) => {
        if (!patient) return 'Anonymous';
        if (!patient.name) {
            const email = patient.email || '';
            return email ? email.split('@')[0] : 'Anonymous';
        }
        return patient.name;
    };

    const todayStats = useMemo(() => {
        const todaySessions = (dashboard?.recentSessions || []).filter((s) => {
            if (!s.createdAt) return false;
            const d = new Date(s.createdAt);
            const now = new Date();
            return (
                d.getDate() === now.getDate() &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );
        });

        const count = todaySessions.length;
        const avgRisk = count
            ? Math.round(
                  (todaySessions.reduce((acc, s) => acc + (s.riskScore || 0), 0) /
                      count) *
                      10,
              ) / 10
            : 0;

        const criticalCount = todaySessions.filter(
            (s) => s.riskLevel === 'critical',
        ).length;

        return {
            todaySessions: count,
            avgRisk,
            criticalCount,
        };
    }, [dashboard]);

    return (
        <div className="space-y-8">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-40">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm shadow-xl shadow-slate-900/40">
                        <Bell className="w-4 h-4 text-teal-400" />
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        Doctor Dashboard
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-900 text-white">
                            Live
                        </span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Monitor high-risk sessions, review recent consults, and stay ahead of critical alerts.
                    </p>
                </div>
            </div>

            {/* Critical Alerts Panel */}
            <section className="rounded-3xl overflow-hidden shadow-lg border border-red-100 bg-gradient-to-br from-red-600 via-red-500 to-orange-500 text-white">
                <div className="px-6 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-yellow-300" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
                                Critical Alerts • Last 24 hours
                            </p>
                            <p className="text-lg font-semibold">
                                {criticalPanelAlerts.length
                                    ? `${criticalPanelAlerts.length} critical session${
                                          criticalPanelAlerts.length > 1 ? 's' : ''
                                      } awaiting review`
                                    : 'No new critical sessions'}
                            </p>
                        </div>
                    </div>
                    <div className="text-xs text-white/80 hidden sm:block">
                        Refreshes automatically every 30 seconds.
                    </div>
                </div>
                <div className="bg-white rounded-t-3xl text-slate-900">
                    {alertsLoading && !criticalPanelAlerts.length ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-2">
                            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-semibold text-slate-500">
                                Fetching latest alerts…
                            </p>
                        </div>
                    ) : criticalPanelAlerts.length ? (
                        <ul className="divide-y divide-slate-100">
                            {criticalPanelAlerts.map((alert) => (
                                <li
                                    key={alert.sessionId}
                                    className="px-6 py-4 flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="hidden sm:flex flex-col items-center justify-center text-xs text-slate-400">
                                            <span className="font-mono text-sm text-slate-900">
                                                {alert.riskScore ?? '-'}
                                            </span>
                                            <span>Score</span>
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-sm truncate max-w-[200px] sm:max-w-[260px]">
                                                    {formatPatient(alert.patient)}
                                                </span>
                                                {renderRiskBadge(alert.riskLevel)}
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-1">
                                                {(alert.symptoms && alert.symptoms[0]) ||
                                                    'Chief complaint not available'}
                                            </p>
                                            <p className="text-[11px] text-slate-400">
                                                {formatDateTime(alert.createdAt)} •{' '}
                                                {alert.ageMinutes} min ago
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/results/${alert.sessionId}`)}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-sm hover:bg-slate-800"
                                        >
                                            Review now
                                            <ArrowRight className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMarkReviewed(alert.sessionId)}
                                            disabled={markingSessionId === alert.sessionId}
                                            className={cn(
                                                'inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700',
                                                markingSessionId === alert.sessionId &&
                                                    'opacity-50 cursor-not-allowed',
                                            )}
                                        >
                                            <CheckCircle2 className="w-3 h-3" />
                                            Mark reviewed
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="px-6 py-6 flex items-center gap-3 text-sm text-slate-600">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <p>
                                No critical sessions in the last 24 hours. Continue to monitor high-risk cases from the
                                table below.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Stats Row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={ClipboardList}
                    label="Pending reviews"
                    value={dashboard?.pendingReviews ?? '—'}
                    hint="Sessions waiting for doctor review."
                    colorClass="text-sky-600"
                    bgClass="bg-sky-50"
                    loading={loading}
                />
                <StatCard
                    icon={Users}
                    label="Today’s sessions"
                    value={todayStats.todaySessions}
                    hint="Unique recent consults captured today."
                    colorClass="text-violet-600"
                    bgClass="bg-violet-50"
                    loading={loading}
                />
                <StatCard
                    icon={AlertTriangle}
                    label="Critical alerts (today)"
                    value={todayStats.criticalCount}
                    hint="Critical risk sessions created today."
                    colorClass="text-red-600"
                    bgClass="bg-red-50"
                    loading={loading}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Avg risk score (today)"
                    value={
                        todayStats.todaySessions
                            ? `${todayStats.avgRisk.toFixed(1)}`
                            : '—'
                    }
                    hint="Average risk score across today’s sessions."
                    colorClass="text-teal-600"
                    bgClass="bg-teal-50"
                    loading={loading}
                />
            </section>

            {/* Recent Sessions Table + Quick Actions */}
            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <h2 className="text-sm font-bold text-slate-800">
                            Recent sessions
                        </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search patient by name or email"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 rounded-2xl border border-slate-200 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40 w-52"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Filter className="w-3 h-3" />
                            <select
                                value={tableRiskFilter}
                                onChange={(e) => setTableRiskFilter(e.target.value)}
                                className="rounded-2xl border border-slate-200 px-2 py-1 bg-slate-50 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40"
                            >
                                <option value="">All risks</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSortByRisk((prev) => !prev)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest"
                        >
                            Sort: {sortByRisk ? 'Risk level' : 'Time'}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="min-w-full text-xs">
                        <thead className="bg-slate-50">
                            <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                <th className="px-4 py-2 text-left">Patient</th>
                                <th className="px-4 py-2 text-left">Time</th>
                                <th className="px-4 py-2 text-left">Chief complaint</th>
                                <th className="px-4 py-2 text-left">Risk</th>
                                <th className="px-4 py-2 text-left">Status</th>
                                <th className="px-4 py-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-6 text-center text-slate-400"
                                    >
                                        Loading sessions…
                                    </td>
                                </tr>
                            ) : !recentSessions.length ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-6 text-center text-slate-400"
                                    >
                                        No recent sessions found.
                                    </td>
                                </tr>
                            ) : (
                                recentSessions.map((s) => (
                                    <tr
                                        key={s.sessionId}
                                        className="border-t border-slate-100 hover:bg-slate-50/60"
                                    >
                                        <td className="px-4 py-2 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800">
                                                    {formatPatient(s.patient)}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {s.patient?.email || '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 align-top text-slate-600">
                                            {formatDateTime(s.createdAt)}
                                        </td>
                                        <td className="px-4 py-2 align-top text-slate-600">
                                            <span className="line-clamp-2">
                                                {/* For demo we don't have explicit chief complaint per session summary,
                                                    so this can be extended later to use top symptom */}
                                                Previous symptom session
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 align-top">
                                            {renderRiskBadge(s.riskLevel)}
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                Score: {s.riskScore ?? '—'}/100
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 align-top">
                                            <span className="text-[11px] font-semibold text-slate-600 capitalize">
                                                {s.status || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 align-top text-right">
                                            <div className="flex flex-col items-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        navigate(`/results/${s.sessionId}`)
                                                    }
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-teal-600 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-teal-700"
                                                >
                                                    Review
                                                </button>
                                                {s.status !== 'reviewed' && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleMarkReviewed(s.sessionId)
                                                        }
                                                        disabled={
                                                            markingSessionId === s.sessionId
                                                        }
                                                        className={cn(
                                                            'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700',
                                                            markingSessionId === s.sessionId &&
                                                                'opacity-50 cursor-not-allowed',
                                                        )}
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Mark reviewed
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

const StatCard = ({
    icon: Icon,
    label,
    value,
    hint,
    colorClass,
    bgClass,
    loading,
}) => (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-3">
        <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                {label}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {loading ? '…' : value}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
        </div>
        <div
            className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center',
                bgClass,
            )}
        >
            <Icon className={cn('w-5 h-5', colorClass)} />
        </div>
    </div>
);

export default DoctorDashboard;

