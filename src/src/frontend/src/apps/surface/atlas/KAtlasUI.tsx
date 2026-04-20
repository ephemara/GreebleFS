
import React from 'react';
import {
    Terminal, List, Cpu, Box, Cylinder, Globe, LayoutGrid, Camera,
    Zap, Layers, RefreshCw, Undo, Eye, EyeOff, Grid3X3, Image as ImageIcon, Ruler, Cuboid
} from 'lucide-react';

interface KAtlasUIProps {
    hierarchy: any[];
    selectedIds: string[];
    onSelect: (id: string, multi: boolean) => void;
    onSelectAll: () => void;
    onToggleVis: (id: string, e: React.MouseEvent) => void;

    coordSpace: string;
    setCoordSpace: (s: string) => void;
    projection: string;
    setProjection: (p: string) => void;
    targetAxis: string;
    setTargetAxis: (a: string) => void;

    scale: number; setScale: (n: number) => void;
    stretchU: number; setStretchU: (n: number) => void;
    stretchV: number; setStretchV: (n: number) => void;
    rotation: number; setRotation: (n: number) => void;
    offsetU: number; setOffsetU: (n: number) => void;
    offsetV: number; setOffsetV: (n: number) => void;

    onPerformUnwrap: (proj?: string | null) => void;
    onPack: () => void;
    jitter: number; setJitter: (n: number) => void;
    onPreset: (type: string) => void;
    isProcessing: boolean;
    uvStats: any;

    viewMode: 'GRID' | 'MATERIAL';
    setViewMode: (m: 'GRID' | 'MATERIAL') => void;

    showOriginal: boolean;
    setShowOriginal: (b: boolean) => void;

    lscmIterations: number; setLscmIterations: (n: number) => void;
    lscmPadding: number; setLscmPadding: (n: number) => void;
    lscmTexels: number; setLscmTexels: (n: number) => void;
    lscmResolution: number; setLscmResolution: (n: number) => void;

    boxPadding: number; setBoxPadding: (n: number) => void;
    boxWorldAlign: boolean; setBoxWorldAlign: (b: boolean) => void;
    boxCameraCount: number; setBoxCameraCount: (n: number) => void;

    hybridAutoClassify: boolean; setHybridAutoClassify: (b: boolean) => void;
    hybridForceMode: 'AUTO' | 'LSCM' | 'BOX'; setHybridForceMode: (m: 'AUTO' | 'LSCM' | 'BOX') => void;
}

export default function KAtlasUI({
    hierarchy, selectedIds, onSelect, onSelectAll, onToggleVis,
    coordSpace, setCoordSpace,
    projection, setProjection,
    targetAxis, setTargetAxis,
    scale, setScale,
    stretchU, setStretchU,
    stretchV, setStretchV,
    rotation, setRotation,
    offsetU, setOffsetU,
    offsetV, setOffsetV,
    onPerformUnwrap, onPack, jitter, setJitter, onPreset,
    isProcessing, uvStats,
    viewMode, setViewMode,
    showOriginal, setShowOriginal,
    lscmIterations, setLscmIterations,
    lscmPadding, setLscmPadding,
    lscmTexels, setLscmTexels,
    lscmResolution, setLscmResolution,
    boxPadding, setBoxPadding,
    boxWorldAlign, setBoxWorldAlign,
    boxCameraCount, setBoxCameraCount,
    hybridAutoClassify, setHybridAutoClassify,
    hybridForceMode, setHybridForceMode
}: KAtlasUIProps) {
    const [activeTab, setActiveTab] = React.useState<'PROJECTION' | 'AUTO' | 'SMART' | 'HARD_SURFACE' | 'EDITOR'>('PROJECTION');

    return (
        <div className="w-96 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
            <div className="p-4 border-b border-[#222] bg-gradient-to-r from-[#0a0a0a] to-[#111]">
                <div className="flex items-center gap-2 mb-1">
                    <Terminal size={18} className="text-teal-500" />
                    <h1 className="font-bold text-xl tracking-tighter text-white">K-ATLAS</h1>
                </div>

                {/* VIEW TOGGLE */}
                <div className="flex bg-[#161616] p-0.5 rounded border border-[#222] mt-3">
                    <button
                        onClick={() => setViewMode('GRID')}
                        className={`flex-1 py-1 text-[9px] font-bold flex items-center justify-center gap-1 rounded transition-all ${viewMode === 'GRID' ? 'bg-teal-900/30 text-teal-400' : 'text-gray-500'}`}
                    >
                        <Grid3X3 size={10} /> UV GRID
                    </button>
                    <button
                        onClick={() => setViewMode('MATERIAL')}
                        className={`flex-1 py-1 text-[9px] font-bold flex items-center justify-center gap-1 rounded transition-all ${viewMode === 'MATERIAL' ? 'bg-teal-900/30 text-teal-400' : 'text-gray-500'}`}
                    >
                        <ImageIcon size={10} /> MATERIAL
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-[#222] bg-[#0e0e0e]">
                <button onClick={() => setActiveTab('PROJECTION')} className={`flex-1 py-3 text-[9px] font-bold border-b-2 transition-colors ${activeTab === 'PROJECTION' ? 'border-teal-500 text-teal-400 bg-[#111]' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>PROJECTION</button>
                <button onClick={() => setActiveTab('AUTO')} className={`flex-1 py-3 text-[9px] font-bold border-b-2 transition-colors ${activeTab === 'AUTO' ? 'border-purple-500 text-purple-400 bg-[#111]' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>AUTO</button>
                <button onClick={() => setActiveTab('SMART')} className={`flex-1 py-3 text-[9px] font-bold border-b-2 transition-colors ${activeTab === 'SMART' ? 'border-teal-500 text-teal-400 bg-[#111]' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>SMART</button>
                <button onClick={() => setActiveTab('HARD_SURFACE')} className={`flex-1 py-3 text-[9px] font-bold border-b-2 transition-colors ${activeTab === 'HARD_SURFACE' ? 'border-teal-500 text-teal-400 bg-[#111]' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>HARD</button>
                <button onClick={() => setActiveTab('EDITOR')} className={`flex-1 py-3 text-[9px] font-bold border-b-2 transition-colors ${activeTab === 'EDITOR' ? 'border-teal-500 text-teal-400 bg-[#111]' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>EDITOR</button>
            </div>

            <div className="flex-1 p-5 space-y-6 overflow-y-auto custom-scrollbar">

                {/* SCENE HIERARCHY (Always Visible) */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                        <div className="flex items-center gap-2"><List size={10} /> SCENE HIERARCHY</div>
                        <button onClick={onSelectAll} className="text-teal-500 hover:text-white">SELECT ALL</button>
                    </div>
                    <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-sm max-h-32 overflow-y-auto custom-scrollbar">
                        {hierarchy.length === 0 && <div className="p-2 text-[9px] text-gray-600 italic">No Meshes Loaded</div>}
                        {hierarchy.map((item) => {
                            const isSel = selectedIds.includes(item.id);
                            return (
                                <div key={item.id}
                                    onClick={(e) => onSelect(item.id, e.ctrlKey || e.metaKey)}
                                    className={`flex items-center gap-2 p-1.5 cursor-pointer border-l-2 transition-colors ${isSel ? 'bg-teal-900/20 border-teal-500 text-teal-100' : 'border-transparent hover:bg-[#161616]'}`}
                                >
                                    <button onClick={(e) => onToggleVis(item.id, e)} className="text-gray-600 hover:text-gray-300">
                                        {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <span className="text-[9px] truncate flex-1">{item.name}</span>
                                    <span className="text-[8px] text-gray-600 font-mono">{item.verts}v</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="text-[9px] text-gray-500 flex justify-between">
                        <span>{selectedIds.length} Objects Selected</span>
                        <span className="text-teal-600">CTRL+CLICK to Multi</span>
                    </div>
                </div>

                {/* TAB CONTENT */}
                {activeTab === 'PROJECTION' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                            <Cpu size={10} /> Projection Core
                        </div>

                        {/* SPACE TOGGLE */}
                        <div className="flex bg-[#111] border border-[#222] rounded-sm p-0.5 mb-2">
                            <button onClick={() => setCoordSpace('LOCAL')} className={`flex-1 py-1 text-[9px] font-bold transition-all ${coordSpace === 'LOCAL' ? 'bg-teal-900/30 text-teal-400' : 'text-gray-500'}`}>LOCAL</button>
                            <button onClick={() => setCoordSpace('WORLD')} className={`flex-1 py-1 text-[9px] font-bold transition-all ${coordSpace === 'WORLD' ? 'bg-teal-900/30 text-teal-400' : 'text-gray-500'}`}>WORLD</button>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'ORIGINAL', name: 'RESTORE_UV', icon: <Undo size={14} />, desc: 'Revert to source UVs.' },
                                { id: 'BOX', name: 'SMART_BOX', icon: <Box size={14} />, desc: 'Triplanar logic.' },
                                { id: 'CYLINDER', name: 'CYLINDER_CORE', icon: <Cylinder size={14} />, desc: 'Radial tube unwrap.' },
                                { id: 'SPHERICAL', name: 'SPHERICAL_POLAR', icon: <Globe size={14} />, desc: 'Equirectangular.' },
                                { id: 'PLANAR_AXIS', name: 'AXIS_SLICE', icon: <LayoutGrid size={14} />, desc: 'Locked planar project.' },
                                { id: 'CAMERA_VIEW', name: 'VIEWPORT_PROJECT', icon: <Camera size={14} />, desc: 'From camera angle.' },
                                { id: 'NORMAL_FRACTURE', name: 'NORMAL_FRACTURE', icon: <Zap size={14} />, desc: 'Chaos glitch map.' },
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { setProjection(p.id); setTimeout(() => onPerformUnwrap(p.id), 0); }}
                                    className={`relative p-2 rounded-sm border text-left transition-all group overflow-hidden
                                    ${projection === p.id
                                            ? 'bg-teal-900/10 border-teal-500/50'
                                            : 'bg-[#111] border-[#222] hover:border-gray-600'
                                        }`
                                    }
                                >
                                    {projection === p.id && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-teal-500"></div>}
                                    <div className="flex items-center gap-2">
                                        <span className={projection === p.id ? 'text-teal-400' : 'text-gray-500'}>{p.icon}</span>
                                        <div className={`text-[10px] font-bold tracking-tight ${projection === p.id ? 'text-teal-400' : 'text-gray-300'}`}>{p.name}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {(projection === 'CYLINDRICAL' || projection === 'PLANAR_AXIS') && (
                            <div className="flex gap-1 pt-1 animate-in fade-in slide-in-from-top-1">
                                {['X', 'Y', 'Z'].map(axis => (
                                    <button
                                        key={axis}
                                        onClick={() => { setTargetAxis(axis); setTimeout(() => onPerformUnwrap(), 0); }}
                                        className={`flex-1 py-1 text-[9px] font-bold border rounded-sm transition-colors ${targetAxis === axis ? 'bg-teal-500 text-black border-teal-500' : 'bg-[#111] text-gray-500 border-[#222] hover:border-gray-500'}`}
                                    >
                                        {axis}-AXIS
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* PRESETS */}
                        <div className="space-y-3 pt-4 border-t border-[#1a1a1a]">
                            <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                <LayoutGrid size={10} /> Quick Presets
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => onPreset('WALL')} className="py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] rounded-sm text-[9px] font-bold text-gray-400 hover:text-white transition-colors">WALL (BOX)</button>
                                <button onClick={() => onPreset('FLOOR')} className="py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] rounded-sm text-[9px] font-bold text-gray-400 hover:text-white transition-colors">FLOOR (PLANAR)</button>
                                <button onClick={() => onPreset('PROP')} className="py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] rounded-sm text-[9px] font-bold text-gray-400 hover:text-white transition-colors">PROP (LOCAL)</button>
                                <button onClick={() => onPreset('ATLAS_GRID')} className="py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] rounded-sm text-[9px] font-bold text-gray-400 hover:text-white transition-colors">ATLAS 4x4</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'SMART' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                        <div className="text-[9px] font-bold text-teal-500 uppercase tracking-widest flex items-center gap-2">
                            <Cpu size={10} /> LSCM Solver
                        </div>

                        <div className="p-3 bg-teal-900/10 border border-teal-900/30 rounded-sm text-[10px] text-teal-200/70 leading-relaxed">
                            Least Squares Conformal Map (LSCM) solver minimizes angle distortion. Best for organic shapes.
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-500"><span>ITERATIONS</span><span className="text-teal-500">{lscmIterations}</span></div>
                            <input type="range" min="100" max="10000" step="100" value={lscmIterations}
                                onChange={e => setLscmIterations(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-full appearance-none accent-teal-500 cursor-pointer" />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-500"><span>PADDING</span><span className="text-teal-500">{lscmPadding}px</span></div>
                            <input type="range" min="0" max="32" step="1" value={lscmPadding}
                                onChange={e => setLscmPadding(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-full appearance-none accent-teal-500 cursor-pointer" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>TEXELS/UNIT</span></div>
                                <input type="number" value={lscmTexels} onChange={e => setLscmTexels(parseInt(e.target.value))}
                                    className="w-full bg-[#111] border border-[#222] text-[9px] text-gray-300 p-1 rounded-sm text-center focus:border-teal-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>RESOLUTION</span></div>
                                <select value={lscmResolution} onChange={e => setLscmResolution(parseInt(e.target.value))}
                                    className="w-full bg-[#111] border border-[#222] text-[9px] text-gray-300 p-1 rounded-sm focus:border-teal-500 outline-none">
                                    <option value={512}>512</option>
                                    <option value={1024}>1024</option>
                                    <option value={2048}>2048</option>
                                    <option value={4096}>4096</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={() => { setProjection('LSCM'); setTimeout(() => onPerformUnwrap('LSCM'), 0); }}
                            disabled={isProcessing}
                            className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[10px] font-black tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all shadow-lg mt-4"
                        >
                            {isProcessing ? <RefreshCw className="animate-spin" size={12} /> : <Cpu size={12} />}
                            {isProcessing ? 'SOLVING...' : 'RUN LSCM SOLVER'}
                        </button>
                    </div>
                )}

                {activeTab === 'AUTO' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                        <div className="text-[9px] font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={10} /> Hybrid Auto-Unwrap
                        </div>

                        <div className="p-3 bg-purple-900/10 border border-purple-900/30 rounded-sm text-[10px] text-purple-200/70 leading-relaxed">
                            Rizom UV-style intelligent solver. Auto-classifies meshes and routes to LSCM (organic) or Box (hard-surface) for optimal results.
                        </div>

                        {/* Classification Toggle */}
                        <div className="flex items-center justify-between p-2 bg-[#111] border border-[#222] rounded-sm">
                            <span className="text-[9px] font-bold text-gray-400">AUTO-CLASSIFY</span>
                            <button
                                onClick={() => setHybridAutoClassify(!hybridAutoClassify)}
                                className={`w-8 h-4 rounded-full relative transition-colors ${hybridAutoClassify ? 'bg-purple-600' : 'bg-[#333]'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${hybridAutoClassify ? 'left-4.5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {/* Force Mode Override */}
                        <div className="space-y-2">
                            <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">SOLVER OVERRIDE</div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setHybridForceMode('AUTO')}
                                    className={`flex-1 py-2 text-[9px] font-bold border rounded-sm transition-colors ${hybridForceMode === 'AUTO' ? 'bg-purple-600 text-black border-purple-600' : 'bg-[#111] text-gray-500 border-[#222] hover:border-gray-500'}`}
                                >
                                    AUTO
                                </button>
                                <button
                                    onClick={() => setHybridForceMode('LSCM')}
                                    className={`flex-1 py-2 text-[9px] font-bold border rounded-sm transition-colors ${hybridForceMode === 'LSCM' ? 'bg-purple-600 text-black border-purple-600' : 'bg-[#111] text-gray-500 border-[#222] hover:border-gray-500'}`}
                                >
                                    LSCM
                                </button>
                                <button
                                    onClick={() => setHybridForceMode('BOX')}
                                    className={`flex-1 py-2 text-[9px] font-bold border rounded-sm transition-colors ${hybridForceMode === 'BOX' ? 'bg-purple-600 text-black border-purple-600' : 'bg-[#111] text-gray-500 border-[#222] hover:border-gray-500'}`}
                                >
                                    BOX
                                </button>
                            </div>
                        </div>

                        {/* Combined Config - Shows sliders for BOTH solvers */}
                        <div className="space-y-3 pt-3 border-t border-[#1a1a1a]">
                            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">LSCM SETTINGS</div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>ITERATIONS</span><span className="text-purple-500">{lscmIterations}</span></div>
                                <input type="range" min="100" max="10000" step="100" value={lscmIterations}
                                    onChange={e => setLscmIterations(parseInt(e.target.value))}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-purple-500 cursor-pointer" />
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-[#1a1a1a] pt-3">
                            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">BOX SETTINGS</div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>PADDING</span><span className="text-purple-500">{boxPadding.toFixed(3)}</span></div>
                                <input type="range" min="0.001" max="0.1" step="0.001" value={boxPadding}
                                    onChange={e => setBoxPadding(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-purple-500 cursor-pointer" />
                            </div>
                        </div>

                        <button
                            onClick={() => { setProjection('HYBRID_AUTO'); setTimeout(() => onPerformUnwrap('HYBRID_AUTO'), 0); }}
                            disabled={isProcessing}
                            className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[10px] font-black tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all shadow-lg mt-4"
                        >
                            {isProcessing ? <RefreshCw className="animate-spin" size={12} /> : <Zap size={12} />}
                            {isProcessing ? 'SOLVING...' : 'RUN HYBRID AUTO'}
                        </button>

                        <button
                            onClick={onPack}
                            disabled={isProcessing}
                            className="w-full py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-purple-500/30 text-purple-400 text-[9px] font-bold tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all"
                        >
                            <LayoutGrid size={12} />
                            PACK UV ISLANDS
                        </button>
                    </div>
                )}

                {activeTab === 'HARD_SURFACE' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                        <div className="text-[9px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2">
                            <Cuboid size={10} /> 6-Axis Box Array
                        </div>

                        <div className="p-3 bg-orange-900/10 border border-orange-900/30 rounded-sm text-[10px] text-orange-200/70 leading-relaxed">
                            Splits edges based on 6 cardinal directions to eliminate stretching. Ideal for hard-surface/mechanical.
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-500"><span>ISLAND PADDING</span><span className="text-orange-500">{boxPadding.toFixed(3)}</span></div>
                            <input type="range" min="0.001" max="0.1" step="0.001" value={boxPadding}
                                onChange={e => setBoxPadding(parseFloat(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-full appearance-none accent-orange-500 cursor-pointer" />
                        </div>

                        <div className="flex items-center justify-between p-2 bg-[#111] border border-[#222] rounded-sm">
                            <span className="text-[9px] font-bold text-gray-400">WORLD ALIGN</span>
                            <button
                                onClick={() => setBoxWorldAlign(!boxWorldAlign)}
                                className={`w-8 h-4 rounded-full relative transition-colors ${boxWorldAlign ? 'bg-orange-600' : 'bg-[#333]'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${boxWorldAlign ? 'left-4.5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {/* MULTI-CAMERA SLIDER */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-500">
                                <span>PROJECTION CAMERAS</span>
                                <span className="text-orange-500 font-bold">{boxCameraCount}</span>
                            </div>
                            <input type="range" min="6" max="98" step="8" value={boxCameraCount}
                                onChange={e => setBoxCameraCount(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-full appearance-none accent-orange-500 cursor-pointer" />
                            <div className="text-[8px] text-gray-600">6 = Box | 14+ = Multi-angle (less stretching)</div>
                        </div>

                        <button
                            onClick={() => { setProjection('BOX_6AXIS'); setTimeout(() => onPerformUnwrap('BOX_6AXIS'), 0); }}
                            disabled={isProcessing}
                            className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-black text-[10px] font-black tracking-widest rounded-sm flex items-center justify-center gap-2 transition-all shadow-lg mt-4"
                        >
                            {isProcessing ? <RefreshCw className="animate-spin" size={12} /> : <Box size={12} />}
                            {isProcessing ? 'SOLVING...' : 'RUN BOX PROJECTION'}
                        </button>
                    </div>
                )}

                {activeTab === 'EDITOR' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                        <div className="text-[9px] font-bold text-pink-500 uppercase tracking-widest flex items-center gap-2">
                            <Layers size={10} /> Stack Modifiers
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-500"><span>GLOBAL SCALE</span><span className="text-teal-500">{scale.toFixed(2)}</span></div>
                            <input type="range" min="0.1" max="10.0" step="0.1" value={scale}
                                onChange={e => { setScale(parseFloat(e.target.value)); }}
                                onMouseUp={() => onPerformUnwrap()}
                                className="w-full h-1 bg-[#222] rounded-full appearance-none accent-teal-500 cursor-pointer" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>STRETCH U</span><span className="text-teal-500">{stretchU.toFixed(1)}</span></div>
                                <input type="range" min="0.1" max="5.0" step="0.1" value={stretchU}
                                    onChange={e => setStretchU(parseFloat(e.target.value))}
                                    onMouseUp={() => onPerformUnwrap()}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-teal-500 cursor-pointer" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>STRETCH V</span><span className="text-teal-500">{stretchV.toFixed(1)}</span></div>
                                <input type="range" min="0.1" max="5.0" step="0.1" value={stretchV}
                                    onChange={e => setStretchV(parseFloat(e.target.value))}
                                    onMouseUp={() => onPerformUnwrap()}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-teal-500 cursor-pointer" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-500"><span>ROTATION</span><span className="text-teal-500">{rotation}°</span></div>
                            <input type="range" min="0" max="360" step="15" value={rotation}
                                onChange={e => setRotation(parseInt(e.target.value))}
                                onMouseUp={() => onPerformUnwrap()}
                                className="w-full h-1 bg-[#222] rounded-full appearance-none accent-teal-500 cursor-pointer" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>OFFSET U</span></div>
                                <input type="range" min="-1.0" max="1.0" step="0.05" value={offsetU}
                                    onChange={e => setOffsetU(parseFloat(e.target.value))}
                                    onMouseUp={() => onPerformUnwrap()}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-gray-500 cursor-pointer" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>OFFSET V</span></div>
                                <input type="range" min="-1.0" max="1.0" step="0.05" value={offsetV}
                                    onChange={e => setOffsetV(parseFloat(e.target.value))}
                                    onMouseUp={() => onPerformUnwrap()}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-gray-500 cursor-pointer" />
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-[#1a1a1a]">
                            <div className="text-[9px] font-bold text-pink-600 uppercase tracking-widest flex items-center gap-2">
                                <Zap size={10} /> Experimental
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] text-gray-500"><span>UV JITTER</span><span className="text-pink-500">{jitter.toFixed(2)}</span></div>
                                <input type="range" min="0" max="1.0" step="0.01" value={jitter}
                                    onChange={e => setJitter(parseFloat(e.target.value))}
                                    onMouseUp={() => onPerformUnwrap()}
                                    className="w-full h-1 bg-[#222] rounded-full appearance-none accent-pink-500 cursor-pointer" />
                            </div>

                            <button
                                onClick={onPack}
                                className="w-full py-2 bg-pink-900/20 hover:bg-pink-900/40 border border-pink-900/50 text-pink-400 text-[9px] font-bold rounded-sm transition-all"
                            >
                                AUTO-PACK ISLANDS
                            </button>
                        </div>
                    </div>
                )}

                {/* Stats Footer */}
                {uvStats && (
                    <div className="p-3 bg-[#0e0e0e] rounded-sm border border-[#1a1a1a] space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono"><span>Objects</span><span className="text-gray-200">{uvStats.meshes}</span></div>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono"><span>Total Verts</span><span className="text-gray-200">{uvStats.verts.toLocaleString()}</span></div>
                    </div>
                )}

            </div>
        </div >
    );
}
