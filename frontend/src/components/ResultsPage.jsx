import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  Activity,
  Download,
  Share2,
  MessageCircle,
  PhoneCall,
  ShieldAlert,
  Info,
  CheckCircle2,
  MapPin,
  ExternalLink
} from 'lucide-react';
import BodyComponent from 'react-body-highlighter';
import { cn } from '../utils/cn';

const ResultsPage = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Simulate fetching session data
    setTimeout(() => {
      setData({
        sessionId: id,
        riskLevel: 'HIGH', // CRITICAL, HIGH, MEDIUM, LOW
        riskScore: 78,
        triageRecommendation: "Visit Urgent Care Within a Few Hours",
        triageReasoning: "Multiple red-flag symptoms present (fever + localized abdominal pain) which require clinical evaluation to rule out acute issues like appendicitis.",
        symptoms: [
          { name: "Lower Right Abdominal Pain", slug: "stomach", severity: 8, location: "Right Iliac Fossa", duration: "12 hours", isRedFlag: true },
          { name: "High Fever", slug: "head", severity: 9, location: "Systemic", duration: "6 hours", isRedFlag: true },
          { name: "Nausea", slug: "stomach", severity: 4, location: "Digestive", duration: "4 hours", isRedFlag: false },
        ],
        conditions: [
          { name: "Acute Appendicitis", icd: "K35.80", confidence: 85, supporting: ["Right LRQ pain", "Fever", "Nausea"], recommendedTests: ["Abdominal Ultrasound", "CBC", "CT Scan"] },
          { name: "Gastroenteritis", icd: "A09", confidence: 45, supporting: ["Nausea", "Fever"], recommendedTests: ["Stool Culture"] },
          { name: "Urinary Tract Infection", icd: "N39.0", confidence: 30, supporting: ["Lower pain", "Fever"], recommendedTests: ["Urinalysis"] },
        ],
        emergencyContacts: [
          { name: "Ambulance (India)", number: "108" },
          { name: "Emergency Response", number: "112" }
        ]
      });
      setLoading(false);
    }, 1500);
  }, [id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 font-bold animate-pulse">Retrieving clinical report...</p>
    </div>
  );

  const getRiskUI = (level) => {
    const configs = {
      CRITICAL: { bg: "bg-red-500", lightBg: "bg-red-50", text: "text-red-500", banner: "⚠️ SEEK EMERGENCY CARE IMMEDIATELY", icon: ShieldAlert, pulse: "animate-pulse" },
      HIGH: { bg: "bg-orange-500", lightBg: "bg-orange-50", text: "text-orange-500", banner: "🏥 Visit Urgent Care Within a Few Hours", icon: AlertTriangle, pulse: "" },
      MEDIUM: { bg: "bg-yellow-500", lightBg: "bg-yellow-50", text: "text-yellow-600", banner: "📅 See a Doctor Within 24-48 Hours", icon: Info, pulse: "" },
      LOW: { bg: "bg-green-500", lightBg: "bg-green-50", text: "text-green-600", banner: "🏠 Home Care Likely Sufficient — Monitor Symptoms", icon: CheckCircle2, pulse: "" }
    };
    return configs[level] || configs.LOW;
  };

  const bodyPartsData = data.symptoms.map(s => ({
    name: s.slug,
    shape: s.slug,
    color: s.isRedFlag ? '#EF4444' : '#F97316'
  }));

  const riskUI = getRiskUI(data.riskLevel);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">

      {/* ─── SECTION 1: RISK BANNER ────────────────────────────────── */}
      <div className={cn("rounded-[2rem] overflow-hidden shadow-2xl transition-all", riskUI.lightBg, riskUI.pulse)}>
        <div className={cn("p-6 text-white text-center font-extrabold text-lg flex items-center justify-center gap-3", riskUI.bg)}>
          <riskUI.icon className="w-6 h-6" />
          {riskUI.banner}
        </div>
        <div className="p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#e2e8f0" strokeWidth="12" />
              <circle
                cx="80" cy="80" r="70" fill="none"
                stroke="currentColor" strokeWidth="12"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * data.riskScore) / 100}
                strokeLinecap="round"
                className={cn(riskUI.text, "transition-all duration-1000 ease-out")}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-slate-800">{data.riskScore}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Score</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="text-xl font-bold text-slate-800">Triage Summary</h3>
            <p className="text-slate-600 leading-relaxed text-sm">{data.triageReasoning}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* ─── SECTION 2: SYMPTOMS ──────────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" />
              Symptom Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.symptoms.map((s) => (
                <div key={s.name} className={cn(
                  "p-5 rounded-[1.5rem] bg-white border shadow-sm group",
                  s.isRedFlag ? "border-red-100" : "border-slate-100"
                )}>
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                    {s.isRedFlag && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                      <div className={cn("h-full", s.isRedFlag ? "bg-red-500" : "bg-teal-500")} style={{ width: `${s.severity * 10}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{s.location} • {s.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── SECTION 3: CONDITIONS ───────────────────────── */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800">Possible Conditions</h3>
            <div className="space-y-3">
              {data.conditions.map((c) => (
                <details key={c.name} className="group bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <summary className="p-5 flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-sm">
                        {c.confidence}%
                      </div>
                      <h4 className="font-bold text-slate-800">{c.name}</h4>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-5 pb-5 pt-0 text-xs text-slate-600 space-y-2">
                    <p><strong>Recommended Tests:</strong> {c.recommendedTests.join(', ')}</p>
                    <p><strong>Supporting Evidence:</strong> {c.supporting.join(', ')}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* ─── SIDEBAR: BODY MAP VISUALIZATION ─────────────────── */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm sticky top-24">
            <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-widest text-center">Localized Hotspots</h3>
            <div className="flex justify-center scale-125 h-[300px]">
              <BodyComponent
                partsInput={bodyPartsData}
                readOnly={true}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-4">Red highlights indicate severe symptoms extracted from your description.</p>
          </div>

          <div className="bg-slate-900 p-6 rounded-[2rem] text-white space-y-4">
            <h3 className="font-bold text-sm">Immediate Actions</h3>
            <a href="tel:108" className="flex items-center justify-between p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors">
              <span className="font-bold text-xs uppercase tracking-widest">Call Ambulance</span>
              <span className="text-lg font-black">108</span>
            </a>
            <button className="w-full py-4 bg-teal-600 rounded-2xl text-xs font-bold hover:bg-teal-700 transition-colors">
              Report to Nearest Hospital
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
