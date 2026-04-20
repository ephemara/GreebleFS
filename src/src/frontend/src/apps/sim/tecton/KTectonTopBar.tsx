
import React, { useState } from 'react';
import {
    Map as MapIcon, Film, UploadCloud, Download, Globe, Activity, Share2, Flame
} from 'lucide-react';

interface KTectonTopBarProps {
    viewMode: number;
    setViewMode: (mode: number) => void;
    showSequencer: boolean;
    setShowSequencer: (show: boolean) => void;
    handleHeightmapUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    status: string;
    onCommit: () => void;
    asteroidParams: { radius: number; strength: number };
    setAsteroidParams: React.Dispatch<React.SetStateAction<{ radius: number; strength: number }>>;
    handleAsteroid: () => void;
}

export default function KTectonTopBar({
    viewMode, setViewMode,
    showSequencer, setShowSequencer,
    handleHeightmapUpload,
    status,
    onCommit,
    asteroidParams,
    setAsteroidParams,
    handleAsteroid
}: KTectonTopBarProps) {
    const [showAsteroidMenu, setShowAsteroidMenu] = useState(false);

    return (
        <div className="absolute top-4 left-4 right-4 h-14 pointer-events-none flex items-center justify-between z-40">
            {/* BACKGROUND BLUR CONTAINER */}
            <div className="absolute inset-0 bg-[#050505]/90 backdrop-blur-md border border-[#222]/50 rounded-xl shadow-2xl animate-in slide-in-from-top-2 pointer-events-auto" />

            {/* CONTENT LAYER */}
            <div className="relative z-10 w-full h-full flex items-center justify-between px-6 pointer-events-auto">
                {/* LEFT: TITLE, STATUS, IMPORT, TIMELINE */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Globe className="text-emerald-500" size={20} />
                        <div>
                            <h1 className="text-sm font-bold text-white tracking-widest">TECTON</h1>
                            <div className="text-[9px] text-emerald-500/70 font-mono tracking-wider">TERRAFORM</div>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-[#333]/50 mx-2"></div>

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] rounded-lg border border-[#222]">
                        <Activity size={12} className={status.includes("PROCESSING") ? "text-yellow-400 animate-pulse" : "text-emerald-500"} />
                        <span className="text-[10px] font-mono text-gray-400 uppercase">{status}</span>
                    </div>

                    <div className="h-8 w-px bg-[#333]/50 mx-2"></div>

                    {/* MOVED: Import & Timeline to LEFT */}
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-[#111] hover:bg-[#222] text-gray-400 hover:text-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-[#333]">
                            <UploadCloud size={14} />
                            <span className="text-[10px] font-bold">IMPORT</span>
                            <input type="file" onChange={handleHeightmapUpload} className="hidden" accept="image/*" />
                        </label>

                        <button
                            onClick={() => setShowSequencer(!showSequencer)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${showSequencer ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/50' : 'bg-[#111] text-gray-400 border-transparent hover:bg-[#222] hover:text-white'}`}
                        >
                            <Film size={14} />
                            <span className="text-[10px] font-bold">TIMELINE</span>
                        </button>
                    </div>
                </div>

                {/* CENTER: UPLINK BUTTON */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <button
                        onClick={onCommit}
                        className="bg-[#000]/80 backdrop-blur-md border border-emerald-500/50 text-emerald-400 px-8 py-2 rounded-full font-bold text-[10px] tracking-[0.2em] shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300 flex items-center gap-2 group overflow-hidden"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                        <Share2 size={14} className="group-hover:rotate-12 transition-transform" /> UPLINK TO KERNEL
                    </button>
                </div>

                {/* RIGHT: VIEW MODES & ASTEROID */}
                <div className="flex items-center gap-4">
                    {/* View Modes */}
                    <div className="flex items-center p-1 bg-[#111] rounded-lg border border-[#222]">
                        {['STANDARD', 'NEON', 'HEATMAP', 'CONTOUR'].map((m, i) => (
                            <button
                                key={i}
                                onClick={() => setViewMode(i)}
                                className={`px-3 py-1.5 rounded text-[10px] font-bold transition-all relative overflow-hidden ${viewMode === i ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {m}
                                {viewMode === i && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 box-shadow-[0_0_8px_#10b981]" />}
                            </button>
                        ))}
                    </div>

                    <div className="h-8 w-px bg-[#333]/50 mx-2"></div>

                    {/* Asteroid Toggle */}
                    <div
                        className="relative"
                        onMouseEnter={() => setShowAsteroidMenu(true)}
                        onMouseLeave={() => setShowAsteroidMenu(false)}
                    >
                        <button
                            onClick={handleAsteroid}
                            className="px-3 py-2 rounded-lg text-[9px] font-bold flex items-center gap-2 border transition-all bg-red-900/20 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white shadow-[0_0_10px_rgba(220,38,38,0.2)]"
                            title="SIMULATE IMPACT"
                        >
                            <Flame size={14} />
                        </button>

                        {showAsteroidMenu && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-[#0a0a0a] border border-red-900/50 p-4 rounded shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
                                <div className="text-[9px] font-bold text-red-500 mb-3 tracking-widest uppercase border-b border-red-900/30 pb-2">Impact Settings</div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-[9px] text-red-400 mb-1">Radius</div>
                                        <input type="range" min="0.1" max="1.0" step="0.1" value={asteroidParams.radius} onChange={e => setAsteroidParams(p => ({ ...p, radius: parseFloat(e.target.value) }))} className="w-full h-1 bg-red-900/30 rounded appearance-none accent-red-500" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[9px] text-red-400 mb-1">Force</div>
                                        <input type="range" min="1.0" max="20.0" step="1.0" value={asteroidParams.strength} onChange={e => setAsteroidParams(p => ({ ...p, strength: parseFloat(e.target.value) }))} className="w-full h-1 bg-red-900/30 rounded appearance-none accent-red-500" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
