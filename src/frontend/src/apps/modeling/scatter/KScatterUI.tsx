
import React from 'react';
import {
    LayoutGrid, Box, Circle, Dna, Triangle, Layers, HardDrive,
    Activity, ScanLine, Orbit, Terminal, Merge, CheckCircle2, RotateCw
} from 'lucide-react';

const TOPOLOGY_MODES = [
    { id: 'SURFACE', label: 'SURFACE', icon: Layers },
    { id: 'VERTEX', label: 'VERTEX', icon: Box },
    { id: 'EDGE', label: 'EDGE', icon: ScanLine },
];

const ORBITAL_MODES = [
    { id: 'CLOUD', label: 'CLOUD', icon: Box },
    { id: 'SPHERE', label: 'SHELL', icon: Circle },
    { id: 'RING', label: 'RING', icon: Circle },
    { id: 'SPIRAL', label: 'SPIRAL', icon: Activity },
    { id: 'GRID', label: 'LATTICE', icon: LayoutGrid },
    { id: 'HELIX', label: 'HELIX', icon: Dna },
    { id: 'WAVE', label: 'WAVE', icon: Activity },
    { id: 'VORTEX', label: 'VORTEX', icon: Activity },
    { id: 'EXPLOSION', label: 'BURST', icon: Activity },
];

export default function KScatterUI({
    activeTab, setActiveTab,
    activePrimitive, setActivePrimitive, updatePaletteFromPrimitive,
    activeStorageId, setActiveStorageId, updatePaletteFromStorage,
    sharedState,
    objectCount, setObjectCount,
    scatterRadius, setScatterRadius,
    minScale, setMinScale,
    maxScale, setMaxScale,
    scatterMode, setScatterMode,
    engine,
    userScript, setUserScript, scriptError,
    weldGeometry, setWeldGeometry,
    autoRotate, setAutoRotate,
    distributionEnabled, setDistributionEnabled
}: any) {
    return (
        <div className="w-80 bg-[#0a0a0a] border-r border-[#222] flex flex-col z-20 shadow-2xl">
            <div className="p-4 border-b border-[#222] bg-[#111]">
                <h1 className="font-bold text-xl tracking-tighter text-white flex items-center gap-2">
                    <LayoutGrid className="text-pink-500" size={18} /> K-SCATTER
                </h1>
                <div className="text-[9px] text-pink-500/60 font-bold tracking-[0.3em]">KIPP ENGINE 0.5 ALPHA</div>
            </div>

            <div className="flex border-b border-[#222]">
                <button onClick={() => setActiveTab('primitives')} className={`flex-1 py-3 text-[10px] font-bold ${activeTab === 'primitives' ? 'bg-[#1a1a1a] text-pink-400 border-b-2 border-pink-500' : 'text-gray-500 hover:text-white'}`}>PRIMITIVES</button>
                <button onClick={() => setActiveTab('storage')} className={`flex-1 py-3 text-[10px] font-bold ${activeTab === 'storage' ? 'bg-[#1a1a1a] text-pink-400 border-b-2 border-pink-500' : 'text-gray-500 hover:text-white'}`}>KERNEL STORAGE</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {activeTab === 'primitives' && (
                    <div className="grid grid-cols-4 gap-2">
                        {['CUBE', 'SPHERE', 'CYLINDER', 'PYRAMID', 'PLATE'].map(shape => (
                            <button
                                key={shape}
                                onClick={() => { setActivePrimitive(shape); updatePaletteFromPrimitive(shape); }}
                                className={`aspect-square rounded border flex items-center justify-center transition-all ${activePrimitive === shape ? 'bg-pink-900/20 border-pink-500 text-pink-400' : 'bg-[#111] border-[#222] text-gray-600 hover:text-white'}`}
                            >
                                {shape === 'CUBE' && <Box size={14} />}
                                {shape === 'SPHERE' && <Circle size={14} />}
                                {shape === 'CYLINDER' && <Dna size={14} />}
                                {shape === 'PYRAMID' && <Triangle size={14} />}
                                {shape === 'PLATE' && <Layers size={14} />}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'storage' && (
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><HardDrive size={10} /> Available Assets</div>
                        {(!sharedState?.storage || sharedState.storage.length === 0) ? (
                            <div className="text-[10px] text-gray-600 italic p-4 text-center border border-dashed border-[#222] rounded">Kernel Memory Empty.<br />Commit objects from Sculpt/Greeble first.</div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {sharedState.storage.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => { setActiveStorageId(item.id); updatePaletteFromStorage(item); }}
                                        className={`relative aspect-square rounded border overflow-hidden transition-all group ${activeStorageId === item.id ? 'border-pink-500 ring-1 ring-pink-500' : 'border-[#222] hover:border-gray-500'}`}
                                    >
                                        {item.thumbnail ? (
                                            <img src={item.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={item.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-[#111]"><Box size={16} className="text-gray-600" /></div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] text-center py-1 truncate px-1 text-gray-300">
                                            {item.name}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <hr className="border-[#222]" />

                <div className="space-y-4">
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Activity size={10} /> Distribution</div>
                    <div><div className="flex justify-between text-[10px] text-gray-400 mb-1">Density</div><input type="range" min="10" max="2000" value={objectCount} onChange={e => setObjectCount(parseInt(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-pink-500" /></div>
                    <div><div className="flex justify-between text-[10px] text-gray-400 mb-1">Spread / Radius</div><input type="range" min="0.5" max="20" step="0.5" value={scatterRadius} onChange={e => setScatterRadius(parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded accent-pink-500" /></div>
                    <div><div className="flex justify-between text-[10px] text-gray-400 mb-1">Scale Range</div><div className="flex gap-2"><input type="range" min="0.01" max="0.5" step="0.01" value={minScale} onChange={e => setMinScale(parseFloat(e.target.value))} className="flex-1 h-1 bg-[#222] rounded accent-pink-500" /><input type="range" min="0.1" max="2.0" step="0.1" value={maxScale} onChange={e => setMaxScale(parseFloat(e.target.value))} className="flex-1 h-1 bg-[#222] rounded accent-pink-500" /></div></div>

                    {/* SURFACE TOPOLOGY */}
                    <div className="space-y-2 mt-4">
                        <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest border-b border-blue-900/30 pb-1 mb-2 flex items-center gap-2"><ScanLine size={10} /> SURFACE TOPOLOGY</div>
                        <div className="grid grid-cols-3 gap-1">
                            {TOPOLOGY_MODES.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setScatterMode(m.id)}
                                    disabled={!engine.current.baseMesh}
                                    className={`flex flex-col items-center justify-center p-2 rounded border text-[9px] font-bold transition-all
                                    ${scatterMode === m.id
                                            ? 'bg-blue-900/30 border-blue-500 text-blue-300'
                                            : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300'}
                                    ${!engine.current.baseMesh ? 'opacity-30 cursor-not-allowed' : ''}
                                `}
                                >
                                    <m.icon size={14} className="mb-1" /> {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ORBITAL FLUX */}
                    <div className="space-y-2 mt-4">
                        <div className="text-[9px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-900/30 pb-1 mb-2 flex items-center gap-2"><Orbit size={10} /> ORBITAL FLUX</div>
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
                                    <m.icon size={14} className="mb-1" /> {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* LOGIC GATE */}
                    <div className="space-y-2 mt-4">
                        <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest border-b border-emerald-900/30 pb-1 mb-2 flex items-center gap-2"><Terminal size={10} /> LOGIC GATE</div>
                        <button
                            onClick={() => setScatterMode('SCRIPT')}
                            className={`w-full flex items-center justify-center gap-2 p-2 rounded border text-[9px] font-bold transition-all
                            ${scatterMode === 'SCRIPT'
                                    ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400'
                                    : 'bg-[#161616] border-[#333] text-gray-500 hover:text-gray-300'}
                        `}
                        >
                            <Terminal size={14} /> K-SCRIPT EXECUTION
                        </button>
                    </div>

                    {/* K-SCRIPT EDITOR */}
                    {scatterMode === 'SCRIPT' && (
                        <div className="mt-4 animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-bold text-gray-400">PROCEDURAL LOGIC</span>
                                {scriptError && <span className="text-[8px] text-red-500 font-bold bg-red-900/20 px-1 rounded">SYNTAX ERROR</span>}
                            </div>
                            <textarea
                                value={userScript}
                                onChange={(e) => setUserScript(e.target.value)}
                                className={`w-full h-48 bg-[#080808] border rounded p-2 text-[10px] font-mono outline-none resize-none leading-relaxed ${scriptError ? 'border-red-500 text-red-300' : 'border-[#333] text-green-400 focus:border-green-500'}`}
                                spellCheck={false}
                            />
                            <div className="text-[8px] text-gray-600 font-mono mt-1">
                                Vars: <span className="text-gray-400">i, count, p, r, s, Math, radius</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-[#222]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Merge size={10} /> Optimization</span>
                    </div>
                    <div className="space-y-2">
                        <button onClick={() => setWeldGeometry(!weldGeometry)} className={`w-full py-2 rounded border text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${weldGeometry ? 'bg-pink-900/20 border-pink-500 text-pink-400' : 'bg-[#161616] border-[#333] text-gray-500'}`}>
                            {weldGeometry ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            {weldGeometry ? 'EXPORT: INDIVIDUAL' : 'EXPORT: INSTANCES'}
                        </button>
                        <button onClick={() => setAutoRotate(!autoRotate)} className={`w-full py-2 rounded border text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${autoRotate ? 'bg-pink-900/20 border-pink-500 text-pink-400' : 'bg-[#161616] border-[#333] text-gray-500'}`}>
                            <RotateCw size={12} className={autoRotate ? "animate-spin" : ""} />
                            {autoRotate ? 'AUTO-ROTATE: ACTIVE' : 'AUTO-ROTATE: OFF'}
                        </button>
                        <button
                            onClick={() => setDistributionEnabled(!distributionEnabled)}
                            className={`w-full py-2 rounded border text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${distributionEnabled ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'bg-[#161616] border-[#333] text-gray-500'}`}
                        >
                            {distributionEnabled ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                            {distributionEnabled ? 'ROUND-ROBIN: DISTRIBUTE' : 'ROUND-ROBIN: OFF (AS BASE)'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
