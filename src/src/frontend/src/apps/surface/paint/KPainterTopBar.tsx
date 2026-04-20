import React from 'react';
import {
    Paintbrush, Activity, Eye, UploadCloud, BoxSelect, Globe, Zap, Box, LayoutGrid, Split, Pipette, Disc, MousePointer2, Lightbulb
} from 'lucide-react';
import { usePainter } from './PainterContext';

export default function KPainterTopBar() {
    const {
        brush, setBrush,
        activeChannels, setActiveChannels,
        viewChannel, setViewChannel,
        handleExport,
        blackHole, setBlackHole,
        performanceMode, setPerformanceMode,
        viewMode, setViewMode,
        symmetry, setSymmetry,
        lighting, setLighting
    } = usePainter();

    return (
        <div className="h-12 bg-[#111]/80 backdrop-blur-md border-b border-[#333]/50 flex items-center justify-between px-2 z-40 shadow-lg shrink-0">

            {/* LEFT: BRUSH STATS & MODES */}
            <div className="flex items-center gap-3">
                <div className="text-[10px] font-black text-[#3daee9] tracking-widest border-r border-[#333] pr-4 mr-2">V2</div>

                {/* MODE TOGGLES */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setBrush((b: any) => ({ ...b, isPicking: !b.isPicking }))}
                        className={`p-1.5 rounded transition-all ${brush.isPicking ? 'bg-yellow-500 text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}
                        title="Eyedropper (I)"
                    ><Pipette size={14} /></button>

                    <button
                        onClick={() => setBrush((b: any) => ({ ...b, projectionMode: !b.projectionMode }))}
                        className={`p-1.5 rounded transition-all ${brush.projectionMode ? 'bg-pink-500 text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}
                        title="3D Projection (P)"
                    ><Globe size={14} /></button>

                    <button
                        onClick={() => setBrush((b: any) => ({ ...b, isSeamless: !b.isSeamless }))}
                        className={`p-1.5 rounded transition-all ${brush.isSeamless ? 'bg-green-500 text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}
                        title="Seamless Tiling"
                    ><BoxSelect size={14} /></button>
                </div>

                <div className="h-6 w-px bg-[#333]"></div>

                {/* SLIDERS (Mini) */}
                <div className="flex items-center gap-4">
                    <div className="flex flex-col w-20 gap-1 group">
                        <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors"><span>Size</span> <span className="text-blue-400">{brush.size}</span></div>
                        <input type="range" min="1" max="200" step="1" value={brush.size} onChange={(e) => setBrush((b: any) => ({ ...b, size: parseFloat(e.target.value) }))} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                    <div className="flex flex-col w-20 gap-1 group">
                        <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors"><span>Flow</span> <span className="text-cyan-400">{brush.flow.toFixed(2)}</span></div>
                        <input type="range" min="0.01" max="1.0" step="0.01" value={brush.flow} onChange={(e) => setBrush((b: any) => ({ ...b, flow: parseFloat(e.target.value) }))} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                    </div>
                </div>

            </div>

            {/* CENTER: CHANNELS */}
            <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
                    {[{ id: 'albedo', l: 'C' }, { id: 'normal', l: 'N' }, { id: 'roughness', l: 'R' }, { id: 'metalness', l: 'M' }, { id: 'emission', l: 'E' }].map(ch => (
                        <button
                            key={ch.id}
                            onClick={() => setActiveChannels((p: any) => ({ ...p, [ch.id]: !p[ch.id] }))}
                            className={`w-6 h-6 flex items-center justify-center rounded text-[9px] font-bold transition-all ${activeChannels[ch.id] ? 'bg-[#3daee9] text-black shadow-sm' : 'bg-transparent text-gray-600 hover:text-white'}`}
                            title={`Toggle ${ch.id}`}
                        >
                            {ch.l}
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT: VIEW & SYMMETRY & UPLINK */}
            <div className="flex items-center gap-4">

                {/* SYMMETRY */}
                <div className="flex bg-[#0a0a0a] rounded border border-[#222] overflow-hidden p-0.5">
                    {['x', 'y', 'z'].map(axis => (
                        <button
                            key={axis}
                            onClick={() => setSymmetry((prev: any) => ({ ...prev, [axis]: !prev[axis as keyof typeof prev] }))}
                            className={`px-2 py-1 text-[9px] font-bold transition-colors ${usePainter().symmetry?.[axis as 'x' | 'y' | 'z'] ? 'bg-[#00ffcc]/20 text-[#00ffcc]' : 'text-gray-500 hover:text-white'}`}
                        >
                            {axis.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="h-6 w-px bg-[#333]"></div>

                {/* LIGHTING */}
                <div className="flex items-center gap-2">
                    <Lightbulb size={12} className="text-yellow-400" />
                    <select
                        value={lighting.preset}
                        onChange={(e) => setLighting(prev => ({ ...prev, preset: e.target.value }))}
                        className="bg-[#0a0a0a] border border-[#222] rounded text-[9px] font-bold text-gray-300 outline-none py-1 px-2 cursor-pointer hover:border-gray-500"
                    >
                        <option value="studio">Studio</option>
                        <option value="outdoor">Outdoor</option>
                        <option value="dark">Dark</option>
                        <option value="neutral">Neutral</option>
                    </select>
                    <div className="flex flex-col w-16 gap-0.5">
                        <div className="text-[7px] font-bold text-gray-500 uppercase tracking-wider">Intensity</div>
                        <input
                            type="range"
                            min="0.1"
                            max="2.0"
                            step="0.1"
                            value={lighting.intensity}
                            onChange={(e) => setLighting(prev => ({ ...prev, intensity: parseFloat(e.target.value) }))}
                            className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                    </div>
                </div>

                <div className="h-6 w-px bg-[#333]"></div>

                {/* VIEW MODE */}
                <div className="flex bg-[#0a0a0a] p-0.5 rounded border border-[#222]">
                    <button onClick={() => setViewMode('3D')} className={`p-1.5 rounded transition-all ${viewMode === '3D' ? 'bg-[#333] text-white' : 'text-gray-600 hover:text-gray-300'}`}><Box size={14} /></button>
                    <button onClick={() => setViewMode('2D')} className={`p-1.5 rounded transition-all ${viewMode === '2D' ? 'bg-[#333] text-white' : 'text-gray-600 hover:text-gray-300'}`}><LayoutGrid size={14} /></button>
                </div>

                <select
                    value={viewChannel}
                    onChange={(e) => setViewChannel(e.target.value)}
                    className="bg-[#0a0a0a] border border-[#222] rounded text-[9px] font-bold text-gray-300 outline-none py-1.5 px-2 w-24 cursor-pointer hover:border-gray-500"
                >
                    <option value="MATERIAL">Full Material</option>
                    <option value="BASE">Base Color</option>
                    <option value="ROUGHNESS">Roughness</option>
                    <option value="METALNESS">Metallic</option>
                    <option value="NORMAL">Normal Map</option>
                    <option value="EMISSION">Emission</option>
                </select>

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#3daee9]/10 hover:bg-[#3daee9]/20 text-[#3daee9] border border-[#3daee9]/40 rounded-lg text-[9px] font-bold tracking-widest transition-all shadow-lg group ml-2"
                >
                    <UploadCloud size={12} className="group-hover:-translate-y-0.5 transition-transform" /> UPLINK
                </button>
            </div>

        </div>
    );
}
