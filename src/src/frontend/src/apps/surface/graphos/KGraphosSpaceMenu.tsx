
import React, { useState } from 'react';
import {
    Droplet, CloudRain, Waves, Activity, RotateCcw,
    Wind, Power, Gauge, ArrowDown, ChevronsDown, Sprout, Magnet, Zap, Monitor, Cpu,
    ChevronLeft, ChevronRight, Flame, Snowflake, Sun, Move, Shuffle, Sparkles,
    Layers, AlignCenterVertical, Tornado, Atom, Clock, ScanLine,
    Lock, Unlock
} from 'lucide-react';

const SIMS = [
    // PAGE 1: FLUIDS & FLOW
    { id: 'wind', label: 'WIND', icon: Wind, desc: 'Velocity Advection' },
    { id: 'drip', label: 'DRIP', icon: ArrowDown, desc: 'Gravity Flow' },
    { id: 'rivulet', label: 'RIVULET', icon: ChevronsDown, desc: 'Quantum Stream' },
    { id: 'bleed', label: 'BLEED', icon: CloudRain, desc: 'Wet Diffusion' },
    { id: 'liquify', label: 'LIQUIFY', icon: Waves, desc: 'Distortion' },
    { id: 'erosion', label: 'EROSION', icon: Layers, desc: 'Hydraulic Decay' },
    { id: 'vortex', label: 'VORTEX', icon: Tornado, desc: 'Curl Noise' },
    { id: 'magnetic', label: 'MAGNET', icon: Magnet, desc: 'Attraction' },
    { id: 'growth', label: 'GROWTH', icon: Sprout, desc: 'Organic' },

    // PAGE 2: COSMIC & ENERGY
    { id: 'nebula', label: 'NEBULA', icon: CloudRain, desc: 'Gas Expansion' },
    { id: 'thermal', label: 'THERMAL', icon: Flame, desc: 'Heat Rise' },
    { id: 'blackhole', label: 'VOID', icon: Sun, desc: 'Gravity Well' },
    { id: 'caustic', label: 'CAUSTIC', icon: Sparkles, desc: 'Light Refract' },
    { id: 'shatter', label: 'SHATTER', icon: Zap, desc: 'Voronoi Break' },
    { id: 'warp', label: 'WARP', icon: Move, desc: 'Domain Warp' },
    { id: 'life', label: 'LIFE', icon: Activity, desc: 'Automata' },
    { id: 'quantum', label: 'QUANTUM', icon: Atom, desc: 'Wave Function' },
    { id: 'chronos', label: 'CHRONOS', icon: Clock, desc: 'Time Dilate' },

    // PAGE 3: GLITCH & DATA
    { id: 'datamosh', label: 'MOSH', icon: Monitor, desc: 'Video Decay' },
    { id: 'sort', label: 'SORT', icon: AlignCenterVertical, desc: 'Pixel Sort' },
    { id: 'scanline', label: 'SCAN', icon: ScanLine, desc: 'CRT Raster' },
    { id: 'echo', label: 'ECHO', icon: Layers, desc: 'Feedback Loop' },
    { id: 'noise', label: 'NOISE', icon: Shuffle, desc: 'Static' },
];

// Helper to group into pages of 9
const PAGES = [];
for (let i = 0; i < SIMS.length; i += 9) {
    PAGES.push(SIMS.slice(i, i + 9));
}

export default function KGraphosSpaceMenu({
    visible, position,
    activeSims, toggleSim,
    simParams, setSimParams,
    onReset,
    gpuMode, setGpuMode,
    ...props
}: any) {
    const [page, setPage] = useState(0);

    if (!visible) return null;

    const style = position ? {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
    } : {
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)'
    };

    const currentSims = PAGES[page];

    return (
        <div
            className="fixed z-[100] bg-[#0a0a0a]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-[0_0_80px_rgba(6,182,212,0.15)] animate-in fade-in zoom-in-95 duration-100 w-80 flex flex-col gap-3 pointer-events-auto font-sans select-none"
            style={style}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-cyan-900/30 pb-2">
                <div className="text-[10px] font-black text-cyan-400 tracking-[0.2em] flex items-center gap-2">
                    <Cpu size={14} /> REACTOR CORE
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={props.onToggleLock}
                        className={`p-1 rounded hover:bg-cyan-900/30 transition-colors ${props.isLocked ? 'text-cyan-400' : 'text-gray-600'}`}
                        title={props.isLocked ? "Unlock Menu" : "Lock Menu Open"}
                    >
                        {props.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button
                        onClick={() => setGpuMode(!gpuMode)}
                        className={`px-3 py-1 rounded-full text-[8px] font-bold flex items-center gap-1 border transition-all ${gpuMode ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-[#1a1a1a] text-gray-500 border-[#333]'}`}
                    >
                        {gpuMode ? 'GPU: ONLINE' : 'GPU: OFFLINE'}
                    </button>
                </div>
            </div>

            {/* SLIDERS (CENTRAL CONTROL) */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-cyan-600">SPEED</span>
                    <span className="text-[8px] font-mono text-cyan-400">{simParams.speed.toFixed(1)}x</span>
                </div>
                <input
                    type="range" min="0.1" max="3.0" step="0.1"
                    value={simParams.speed} onChange={(e) => setSimParams({ ...simParams, speed: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-[#222] rounded appearance-none accent-cyan-500"
                />

                <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[7px] font-bold text-purple-500">CHAOS</div>
                        <input type="range" min="0" max="2.0" step="0.1" value={simParams.chaos} onChange={(e) => setSimParams({ ...simParams, chaos: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-purple-500" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-[7px] font-bold text-emerald-500">DECAY</div>
                        <input type="range" min="0.8" max="0.99" step="0.01" value={simParams.decay} onChange={(e) => setSimParams({ ...simParams, decay: parseFloat(e.target.value) })} className="w-full h-1 bg-[#222] rounded appearance-none accent-emerald-500" />
                    </div>
                </div>
            </div>

            {/* KERNEL GRID (PAGED) */}
            <div className="grid grid-cols-3 gap-1.5 h-48">
                {currentSims.map((sim: any) => {
                    const isActive = activeSims[sim.id];
                    return (
                        <button
                            key={sim.id}
                            onClick={() => toggleSim(sim.id)}
                            disabled={!gpuMode}
                            className={`
                                flex flex-col items-center justify-center gap-1 rounded border transition-all group relative overflow-hidden
                                ${isActive
                                    ? 'bg-cyan-900/20 border-cyan-500/50 text-cyan-100 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]'
                                    : 'bg-[#111] border-[#222] text-gray-500 hover:border-cyan-900/50 hover:text-gray-300'
                                }
                                ${!gpuMode ? 'opacity-30 cursor-not-allowed' : ''}
                            `}
                        >
                            <sim.icon size={18} className={isActive ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]' : 'text-gray-600'} />
                            <span className="text-[8px] font-bold tracking-wider">{sim.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* PAGINATION & ACTIONS */}
            <div className="flex items-center justify-between pt-1">
                <div className="flex gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 rounded border border-[#333] hover:bg-[#222] text-gray-400 disabled:opacity-30"
                    >
                        <ChevronLeft size={12} />
                    </button>
                    <div className="flex items-center gap-1 px-2">
                        {PAGES.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === page ? 'bg-cyan-500 scale-125' : 'bg-[#333]'}`} />
                        ))}
                    </div>
                    <button
                        onClick={() => setPage(p => Math.min(PAGES.length - 1, p + 1))}
                        disabled={page === PAGES.length - 1}
                        className="p-1.5 rounded border border-[#333] hover:bg-[#222] text-gray-400 disabled:opacity-30"
                    >
                        <ChevronRight size={12} />
                    </button>
                </div>

                <button
                    onClick={onReset}
                    className="px-3 py-1.5 bg-red-900/10 hover:bg-red-900/30 border border-red-900/50 text-red-500 rounded text-[8px] font-bold flex items-center gap-2 transition-all"
                >
                    <RotateCcw size={10} /> FLUSH
                </button>
            </div>
        </div>
    );
}
