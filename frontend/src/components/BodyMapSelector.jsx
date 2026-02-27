import React, { useState } from 'react';
import { RefreshCcw, ChevronRight, Info, Check } from 'lucide-react';
import { cn } from '../utils/cn';

// Simple SVG parts for Front view
const FRONT_PARTS = [
    { slug: 'head', label: 'Head/Face', path: 'M40,20 Q50,5 60,20 Q60,40 50,45 Q40,40 40,20', cx: 50, cy: 25 },
    { slug: 'neck', label: 'Neck', path: 'M45,45 L55,45 L54,52 L46,52 Z', cx: 50, cy: 48 },
    { slug: 'chest', label: 'Chest', path: 'M30,55 L70,55 L75,100 L25,100 Z', cx: 50, cy: 80 },
    { slug: 'stomach', label: 'Stomach/Abdomen', path: 'M25,100 L75,100 L70,150 L30,150 Z', cx: 50, cy: 125 },
    { slug: 'left-arm', label: 'Left Arm', path: 'M70,55 L90,65 L85,120 L75,110 Z', cx: 80, cy: 90 },
    { slug: 'right-arm', label: 'Right Arm', path: 'M30,55 L10,65 L15,120 L25,110 Z', cx: 20, cy: 90 },
    { slug: 'left-hand', label: 'Left Hand', path: 'M85,120 L95,140 L85,150 L75,140 Z', cx: 85, cy: 135 },
    { slug: 'right-hand', label: 'Right Hand', path: 'M15,120 L5,140 L15,150 L25,140 Z', cx: 15, cy: 135 },
    { slug: 'left-leg', label: 'Left Leg', path: 'M50,150 L70,160 L65,220 L55,220 Z', cx: 62, cy: 190 },
    { slug: 'right-leg', label: 'Right Leg', path: 'M50,150 L30,160 L35,220 L45,220 Z', cx: 38, cy: 190 },
    { slug: 'left-foot', label: 'Left Foot', path: 'M55,220 L70,235 L55,245 L50,235 Z', cx: 60, cy: 235 },
    { slug: 'right-foot', label: 'Right Foot', path: 'M45,220 L30,235 L45,245 L50,235 Z', cx: 40, cy: 235 },
];

// Simple SVG parts for Back view
const BACK_PARTS = [
    { slug: 'head-back', label: 'Head (Back)', path: 'M40,20 Q50,5 60,20 Q60,40 50,45 Q40,40 40,20', cx: 50, cy: 25 },
    { slug: 'neck-back', label: 'Neck (Back)', path: 'M45,45 L55,45 L54,52 L46,52 Z', cx: 50, cy: 48 },
    { slug: 'upper-back', label: 'Upper Back', path: 'M30,55 L70,55 L75,85 L25,85 Z', cx: 50, cy: 70 },
    { slug: 'lower-back', label: 'Lower Back', path: 'M25,85 L75,85 L73,130 L27,130 Z', cx: 50, cy: 110 },
    { slug: 'buttocks', label: 'Buttocks', path: 'M27,130 L73,130 L70,160 L30,160 Z', cx: 50, cy: 145 },
    { slug: 'left-arm-back', label: 'Left Arm (Back)', path: 'M70,55 L90,65 L85,120 L75,110 Z', cx: 80, cy: 90 },
    { slug: 'right-arm-back', label: 'Right Arm (Back)', path: 'M30,55 L10,65 L15,120 L25,110 Z', cx: 20, cy: 90 },
    { slug: 'left-leg-back', label: 'Left Leg (Back)', path: 'M50,160 L70,170 L65,220 L55,220 Z', cx: 62, cy: 195 },
    { slug: 'right-leg-back', label: 'Right Leg (Back)', path: 'M50,160 L30,170 L35,220 L45,220 Z', cx: 38, cy: 195 },
];

const BodyMapSelector = ({ onSelect, initialSelected = [] }) => {
    const [isBack, setIsBack] = useState(false);
    const [selectedParts, setSelectedParts] = useState(initialSelected);

    const handlePartClick = (slug, label) => {
        setSelectedParts(prev => {
            const exists = prev.find(p => p.slug === slug);
            if (exists) {
                return prev.filter(p => p.slug !== slug);
            }
            return [...prev, { slug, label, severity: 'mild' }];
        });
    };

    const parts = isBack ? BACK_PARTS : FRONT_PARTS;

    return (
        <div className="flex flex-col items-center gap-6 p-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between w-full">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Localization</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tap where it hurts</p>
                </div>
                <button
                    onClick={() => setIsBack(!isBack)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl text-xs font-bold transition-all border border-teal-100/50"
                >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    {isBack ? 'Front View' : 'Back View'}
                </button>
            </div>

            <div className="relative bg-teal-50/20 rounded-[3rem] p-8 border border-white shadow-inner flex justify-center w-full max-w-[300px]">
                {/* Simple Custom SVG Body Map */}
                <svg viewBox="0 0 100 250" className="w-[180px] h-[400px]">
                    {/* Base Silhouette (Dummy) */}
                    <path
                        d="M50,5 Q35,5 35,20 L35,40 Q35,50 50,55 Q65,50 65,40 L65,20 Q65,5 50,5 Z"
                        fill="#f1f5f9"
                        stroke="#e2e8f0"
                        strokeWidth="1"
                    />

                    {parts.map(p => {
                        const isSelected = selectedParts.find(sp => sp.slug === p.slug);
                        const config = isSelected
                            ? isSelected.severity === 'severe' ? { fill: '#fee2e2', stroke: '#ef4444' }
                                : isSelected.severity === 'moderate' ? { fill: '#ffedd5', stroke: '#f97316' }
                                    : { fill: '#ccfbf1', stroke: '#14b8a6' }
                            : { fill: '#ffffff', stroke: '#cbd5e1' };

                        return (
                            <g
                                key={p.slug}
                                className="cursor-pointer group"
                                onClick={() => handlePartClick(p.slug, p.label)}
                            >
                                <path
                                    d={p.path}
                                    fill={config.fill}
                                    stroke={config.stroke}
                                    strokeWidth={isSelected ? "2" : "1"}
                                    className="transition-all duration-300 group-hover:fill-teal-50"
                                />
                                {isSelected && (
                                    <circle cx={p.cx} cy={p.cy} r="3" fill={config.stroke} className="animate-pulse" />
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Legend */}
                <div className="absolute top-4 left-4 space-y-1 bg-white/60 backdrop-blur-md p-2 rounded-xl border border-white/50 shadow-sm text-[8px] font-bold uppercase text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Sev
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Mod
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Mild
                    </div>
                </div>
            </div>

            <div className="w-full space-y-4">
                {selectedParts.length > 0 ? (
                    <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Selected Areas</span>
                        <div className="flex flex-col gap-2">
                            {selectedParts.map((part) => (
                                <div
                                    key={part.slug}
                                    className="px-4 py-3 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-bottom-2"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            part.severity === 'severe' ? "bg-red-500" : part.severity === 'moderate' ? "bg-orange-500" : "bg-teal-500"
                                        )} />
                                        <span className="text-xs font-bold text-slate-700">{part.label}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <select
                                            className="bg-slate-50 px-2 py-1 rounded-lg text-[10px] font-bold uppercase text-slate-500 outline-none border-none"
                                            value={part.severity}
                                            onChange={(e) => {
                                                const newParts = selectedParts.map(p =>
                                                    p.slug === part.slug ? { ...p, severity: e.target.value } : p
                                                );
                                                setSelectedParts(newParts);
                                            }}
                                        >
                                            <option value="mild">Mild</option>
                                            <option value="moderate">Medium</option>
                                            <option value="severe">Severe</option>
                                        </select>
                                        <button
                                            onClick={() => setSelectedParts(prev => prev.filter(p => p.slug !== part.slug))}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-400">Click the body map to select pain locations</p>
                    </div>
                )}

                <button
                    onClick={() => onSelect(selectedParts)}
                    className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                >
                    Confirm & Continue
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default BodyMapSelector;
