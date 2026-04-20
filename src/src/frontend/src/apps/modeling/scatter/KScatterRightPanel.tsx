import React from 'react';
import {
    Activity, ScanLine, Orbit, Terminal, Box, Sparkles, Atom, Zap, Leaf, Cpu
} from 'lucide-react';
import { KRightPanel } from '../../../core/ui/KPanelV2';

interface KScatterRightPanelProps {
    scatterMode: string;
    setScatterMode: (mode: string) => void;
    hasBaseMesh: boolean;
    userScript: string;
    setUserScript: (script: string) => void;
    scriptError: string | null;
}

// ============================================================================
// SCATTER MODE DEFINITIONS
// ============================================================================

const TOPOLOGY_MODES = [
    { id: 'SURFACE', label: 'SURFACE', icon: <ScanLine size={14} /> },
    { id: 'VERTEX', label: 'VERTEX', icon: <Box size={14} /> },
    { id: 'EDGE', label: 'EDGE', icon: <ScanLine size={14} /> },
];

const ORBITAL_MODES = [
    { id: 'CLOUD', label: 'CLOUD' },
    { id: 'SPHERE', label: 'SHELL' },
    { id: 'RING', label: 'RING' },
    { id: 'SPIRAL', label: 'SPIRAL' },
    { id: 'GRID', label: 'LATTICE' },
    { id: 'HELIX', label: 'HELIX' },
    { id: 'WAVE', label: 'WAVE' },
    { id: 'VORTEX', label: 'VORTEX' },
    { id: 'EXPLOSION', label: 'BURST' },
];

// NEW: Algorithmic modes (Rust-powered)
const ALGORITHMIC_MODES = [
    { id: 'POISSON', label: 'POISSON', rust: true },
    { id: 'FIBONACCI', label: 'FIBONACCI', rust: true },
    { id: 'SUNFLOWER', label: 'SUNFLOWER', rust: true },
    { id: 'HALTON', label: 'HALTON', rust: true },
    { id: 'VORONOI', label: 'VORONOI', rust: true },
    { id: 'PHYLLOTAXIS', label: 'PHYLLOTAXIS', rust: true },
];

// NEW: Nature-inspired modes
const NATURE_MODES = [
    { id: 'CLUSTER', label: 'CLUSTER', rust: true },
    { id: 'ORGANIC', label: 'ORGANIC', rust: true },
    { id: 'IVY', label: 'IVY' },
    { id: 'MOSS', label: 'MOSS' },
    { id: 'CORAL', label: 'CORAL' },
    { id: 'CRYSTAL', label: 'CRYSTAL' },
];

// NEW: Simulation modes (Rapier3D physics)
const SIMULATION_MODES = [
    { id: 'PHYSICS_DROP', label: 'DROP', rust: true, physics: true },
    { id: 'GRAVITY_WELL', label: 'GRAVITY', rust: true, physics: true },
    { id: 'MAGNETIC', label: 'MAGNETIC' },
    { id: 'REPEL', label: 'REPEL' },
];

export default function KScatterRightPanel({
    scatterMode, setScatterMode,
    hasBaseMesh,
    userScript, setUserScript, scriptError
}: KScatterRightPanelProps) {

    const ModeButton = ({ mode, color, requiresMesh = false }: {
        mode: { id: string; label: string; rust?: boolean; physics?: boolean };
        color: string;
        requiresMesh?: boolean;
    }) => {
        const disabled = requiresMesh && !hasBaseMesh;
        const isRust = (mode as any).rust;
        const isPhysics = (mode as any).physics;

        return (
            <button
                key={mode.id}
                onClick={() => setScatterMode(mode.id)}
                disabled={disabled}
                className={`relative flex flex-col items-center justify-center p-2 rounded border text-[9px] font-bold transition-all
                    ${scatterMode === mode.id
                        ? `bg-${color}-900/30 border-${color}-500 text-${color}-400`
                        : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300 hover:border-[#444]'}
                    ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
                `}
                style={scatterMode === mode.id ? {
                    backgroundColor: `var(--${color}-900-30, rgba(100, 50, 150, 0.3))`,
                    borderColor: `var(--${color}-500, #8b5cf6)`,
                    color: `var(--${color}-400, #a78bfa)`
                } : {}}
            >
                {mode.label}
                {isRust && (
                    <span className="absolute -top-1 -right-1 text-[6px] bg-orange-500 text-black px-1 rounded font-black">
                        RS
                    </span>
                )}
                {isPhysics && (
                    <span className="absolute -bottom-1 -right-1 text-[6px] bg-cyan-500 text-black px-1 rounded font-black">
                        ⚡
                    </span>
                )}
            </button>
        );
    };

    const tabs = [
        {
            id: 'modes',
            label: 'Scatter Modes',
            icon: Orbit,
            view: (
                <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
                    {/* SURFACE TOPOLOGY */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest border-b border-blue-900/30 pb-1 mb-2 flex items-center gap-2">
                            <ScanLine size={10} /> SURFACE TOPOLOGY
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {TOPOLOGY_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setScatterMode(m.id)}
                                    disabled={!hasBaseMesh}
                                    className={`flex flex-col items-center justify-center p-2 rounded border text-[9px] font-bold transition-all
                                        ${scatterMode === m.id
                                            ? 'bg-blue-900/30 border-blue-500 text-blue-300'
                                            : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300'}
                                        ${!hasBaseMesh ? 'opacity-30 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {m.icon}
                                    <span className="mt-1">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ORBITAL FLUX */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-900/30 pb-1 mb-2 flex items-center gap-2">
                            <Orbit size={10} /> ORBITAL FLUX
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {ORBITAL_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setScatterMode(m.id)}
                                    className={`flex flex-col items-center justify-center p-2 rounded border text-[9px] font-bold transition-all
                                        ${scatterMode === m.id
                                            ? 'bg-pink-900/20 border-pink-500 text-pink-400'
                                            : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300'}
                                    `}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ALGORITHMIC (NEW - Rust Powered) */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-violet-400 uppercase tracking-widest border-b border-violet-900/30 pb-1 mb-2 flex items-center gap-2">
                            <Cpu size={10} /> ALGORITHMIC
                            <span className="ml-auto text-[7px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">RUST</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {ALGORITHMIC_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setScatterMode(m.id)}
                                    className={`relative flex flex-col items-center justify-center p-2 rounded border text-[9px] font-bold transition-all
                                        ${scatterMode === m.id
                                            ? 'bg-violet-900/30 border-violet-500 text-violet-400'
                                            : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300 hover:border-violet-800/50'}
                                    `}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* NATURE (NEW) */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest border-b border-emerald-900/30 pb-1 mb-2 flex items-center gap-2">
                            <Leaf size={10} /> NATURE
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {NATURE_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setScatterMode(m.id)}
                                    className={`relative flex flex-col items-center justify-center p-2 rounded border text-[9px] font-bold transition-all
                                        ${scatterMode === m.id
                                            ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400'
                                            : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300 hover:border-emerald-800/50'}
                                    `}
                                >
                                    {m.label}
                                    {m.rust && (
                                        <span className="absolute -top-1 -right-1 text-[6px] bg-orange-500 text-black px-1 rounded font-black">
                                            RS
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SIMULATION (NEW - Physics) */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest border-b border-cyan-900/30 pb-1 mb-2 flex items-center gap-2">
                            <Zap size={10} /> SIMULATION
                            <span className="ml-auto text-[7px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">PHYSICS</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                            {SIMULATION_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setScatterMode(m.id)}
                                    className={`relative flex flex-col items-center justify-center p-2.5 rounded border text-[9px] font-bold transition-all
                                        ${scatterMode === m.id
                                            ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400'
                                            : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300 hover:border-cyan-800/50'}
                                    `}
                                >
                                    {m.label}
                                    {m.rust && (
                                        <span className="absolute -top-1 -right-1 text-[6px] bg-orange-500 text-black px-1 rounded font-black">
                                            RS
                                        </span>
                                    )}
                                    {m.physics && (
                                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[6px] bg-cyan-500 text-black px-1 rounded font-black">
                                            ⚡RAPIER
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'script',
            label: 'K-Script',
            icon: Terminal,
            view: (
                <div className="space-y-4">
                    {/* LOGIC GATE */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-amber-400 uppercase tracking-widest border-b border-amber-900/30 pb-1 mb-2 flex items-center gap-2">
                            <Terminal size={10} /> LOGIC GATE
                        </div>

                        <button
                            onClick={() => setScatterMode('SCRIPT')}
                            className={`w-full flex items-center justify-center gap-2 p-2 rounded border text-[9px] font-bold transition-all
                                ${scatterMode === 'SCRIPT'
                                    ? 'bg-amber-900/20 border-amber-500 text-amber-400'
                                    : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300'}
                            `}
                        >
                            <Terminal size={14} /> K-SCRIPT EXECUTION
                        </button>
                    </div>

                    {/* SCRIPT EDITOR */}
                    {scatterMode === 'SCRIPT' && (
                        <div className="animate-in fade-in slide-in-from-right-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-gray-400">PROCEDURAL LOGIC</span>
                                {scriptError && (
                                    <span className="text-[8px] text-red-500 font-bold bg-red-900/20 px-1 rounded">
                                        SYNTAX ERROR
                                    </span>
                                )}
                            </div>
                            <textarea
                                value={userScript}
                                onChange={(e) => setUserScript(e.target.value)}
                                className={`w-full h-48 bg-[#080808] border rounded p-2 text-[10px] font-mono outline-none resize-none leading-relaxed ${scriptError
                                    ? 'border-red-500 text-red-300'
                                    : 'border-[#333] text-green-400 focus:border-amber-500'
                                    }`}
                                spellCheck={false}
                            />
                            <div className="text-[8px] text-gray-600 font-mono mt-1">
                                Vars: <span className="text-gray-400">i, count, p, r, s, Math, radius</span>
                            </div>
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <KRightPanel
            width="w-72"
            tabs={tabs}
        />
    );
}
