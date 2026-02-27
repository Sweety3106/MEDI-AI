import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DrugInteractionChecker from './components/DrugInteractionChecker';
import SymptomChecker from './components/SymptomChecker';
import ResultsPage from './components/ResultsPage';
import HistoryPage from './components/HistoryPage';
import DoctorDashboard from './components/DoctorDashboard';
import DoctorSessionReview from './components/DoctorSessionReview';
import VoiceNoteChecker from './components/VoiceNoteChecker';

// ─── Placeholder pages ───────────────────────────────────────────
const Dashboard = () => (
    <div className="space-y-6">
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-3xl p-8 text-white shadow-xl shadow-teal-500/10 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2">Welcome Back, MediAI 🏥</h2>
                <p className="text-teal-100 text-sm max-w-md leading-relaxed">
                    Start a new session or check your medical stats. Our AI clinical assistant is ready to help you.
                </p>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Sessions" value="12" color="text-teal-600" bg="bg-teal-50" />
            <StatCard label="Avg Risk Score" value="4.2" color="text-orange-500" bg="bg-orange-50" />
            <StatCard label="Safe sessions" value="85%" color="text-green-600" bg="bg-green-50" />
            <StatCard label="Active Medications" value="2" color="text-blue-600" bg="bg-blue-50" />
        </div>
    </div>
);

const StatCard = ({ label, value, color, bg }) => (
    <div className={`p-6 rounded-2xl border border-slate-100 shadow-sm bg-white`}>
        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
    </div>
);

const Placeholder = ({ title, icon }) => (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 border-dashed min-h-[400px]">
        <div className="text-6xl mb-4 opacity-20">{icon}</div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-slate-400 text-sm mt-2">This feature is coming soon to MediAI.</p>
    </div>
);

function App() {
    // Current user context
    // For now this is hard-coded; in a real app this would come from auth
    const user = { name: 'Dr. MediAI', role: 'doctor' };

    return (
        <Router>
            <Layout user={user}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/symptoms" element={<SymptomChecker />} />
                    <Route path="/symptoms/voice" element={<VoiceNoteChecker />} />
                    <Route path="/results/:id" element={<ResultsPage />} />
                    <Route path="/drugs" element={<DrugInteractionChecker />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/profile" element={<Placeholder title="User Profile" icon="👤" />} />

                    {/* Doctor Routes */}
                    <Route path="/doctor" element={<DoctorDashboard user={user} />} />
                    <Route path="/doctor/dashboard" element={<DoctorDashboard user={user} />} />
                    <Route path="/doctor/sessions/:sessionId" element={<DoctorSessionReview user={user} />} />
                    <Route path="/doctor/alerts" element={<Placeholder title="Critical Alerts" icon="🚨" />} />
                    <Route path="/doctor/patients" element={<Placeholder title="Patient Management" icon="👥" />} />
                    <Route path="/doctor/review" element={<Placeholder title="Clinical Review" icon="📄" />} />

                    <Route path="/settings" element={<Placeholder title="Settings" icon="⚙️" />} />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
