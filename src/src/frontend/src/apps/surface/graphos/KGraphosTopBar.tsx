
import React from 'react';
import {
    Brush, Eraser, Move, Droplet,
    Zap, Activity, Minus, Plus, Maximize, MousePointer2, Cpu, Box, Monitor, Split
} from 'lucide-react';

export default function KGraphosTopBar({
    brush, setBrush,
    activeTab, setActiveTab,
    activeMods, setActiveMods,
    canvasConfig,
    gpuMode, setGpuMode,
    is3DMode, toggle3DMode,
    onResize,
    isToolOverlay = false
}: any) {
    return (
        <div className={`h-14 border-b border-[#222] flex items-center justify-between px-4 z-40 shadow-xl select-none relative ${isToolOverlay ? 'bg-[#0a0a0a]/88 backdrop-blur-xl' : 'bg-[#0a0a0a]'}`}>

            {/* LEFT: TOOLS */}
            <div className="flex items-center gap-2">
                <div className="flex bg-[#111] p-1 rounded border border-[#222]">
                    <button
                        onClick={() => setBrush((b: any) => ({ ...b, erase: false }))}
                        className={`p-2 rounded transition-all ${!brush.erase ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50' : 'text-gray-500 hover:text-white'}`}
                        title="Brush Tool (B)"
                    >
                        <Brush size={16} />
                    </button>
                    <button
                        onClick={() => setBrush((b: any) => ({ ...b, erase: true }))}
                        className={`p-2 rounded transition-all ${brush.erase ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50' : 'text-gray-500 hover:text-white'}`}
                        title="Eraser Tool (E)"
                    >
                        <Eraser size={16} />
                    </button>
                </div>

                <div className="h-8 w-px bg-[#222] mx-2"></div>

                {/* BRUSH SETTINGS */}
                <div className="flex items-center gap-6">
                    <div className="flex flex-col w-32 gap-1 group">
                        <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-rose-400 transition-colors"><span>Size</span> <span>{brush.size}px</span></div>
                        <input type="range" min="1" max="500" step="1" value={brush.size} onChange={(e) => setBrush((b: any) => ({ ...b, size: parseFloat(e.target.value) }))} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                    </div>

                    <div className="flex flex-col w-24 gap-1 group">
                        <div className="flex justify-between text-[9px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-rose-400 transition-colors"><span>Opacity</span> <span>{(brush.opacity * 100).toFixed(0)}%</span></div>
                        <input type="range" min="0.0" max="1.0" step="0.01" value={brush.opacity} onChange={(e) => setBrush((b: any) => ({ ...b, opacity: parseFloat(e.target.value) }))} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-rose-500" />
                    </div>

                    {/* SYMMETRY */}
                    <div className="flex bg-[#111] p-1 rounded border border-[#222] gap-1">
                        <button onClick={() => setBrush(b => ({ ...b, symmetry: 'NONE' }))} className={`px-2 py-1 rounded text-[8px] font-bold ${brush.symmetry === 'NONE' ? 'bg-rose-900/30 text-rose-400' : 'text-gray-500'}`}>OFF</button>
                        <button onClick={() => setBrush(b => ({ ...b, symmetry: 'X' }))} className={`px-2 py-1 rounded text-[8px] font-bold ${brush.symmetry === 'X' ? 'bg-rose-900/30 text-rose-400' : 'text-gray-500'}`}>X</button>
                        <button onClick={() => setBrush(b => ({ ...b, symmetry: 'Y' }))} className={`px-2 py-1 rounded text-[8px] font-bold ${brush.symmetry === 'Y' ? 'bg-rose-900/30 text-rose-400' : 'text-gray-500'}`}>Y</button>
                        <button onClick={() => setBrush(b => ({ ...b, symmetry: 'RADIAL' }))} className={`px-2 py-1 rounded text-[8px] font-bold ${brush.symmetry === 'RADIAL' ? 'bg-rose-900/30 text-rose-400' : 'text-gray-500'}`}><Split size={10} /></button>
                    </div>
                </div>
            </div>

            {/* CENTER: COLOR */}
            <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer">
                    <div className="w-8 h-8 rounded-full border-2 border-[#333] shadow-lg overflow-hidden group-hover:border-rose-500 transition-colors">
                        <div className="w-full h-full" style={{ backgroundColor: brush.color }} />
                    </div>
                    <input type="color" value={brush.color} onChange={(e) => setBrush((b: any) => ({ ...b, color: e.target.value }))} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500">PIGMENT</span>
                    <span className="text-[10px] font-mono text-white">{brush.color.toUpperCase()}</span>
                </div>
            </div>

            {/* RIGHT: PHYSICS & INFO */}
            <div className="flex items-center gap-4">
                <button onClick={toggle3DMode} className={`flex items-center gap-2 px-4 py-1.5 rounded text-[9px] font-bold border transition-all ${is3DMode ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-transparent border-[#333] text-gray-500 hover:text-white'}`} title="View Canvas in 3D Space"><Box size={12} /> {is3DMode ? '3D VIEW' : '2D VIEW'}</button>
                <button onClick={() => setGpuMode(!gpuMode)} className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold border transition-all ${gpuMode ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-transparent border-[#333] text-gray-500 hover:text-white'}`} title="Enable Heavy Physics Sims"><Cpu size={12} /> GPU FX: {gpuMode ? 'ON' : 'OFF'}</button>
                <div className="h-8 w-px bg-[#222]"></div>
                <div className="text-right flex flex-col items-end">
                    <div className="text-[9px] font-bold text-gray-500 flex items-center gap-1"><Monitor size={10} /> CANVAS</div>
                    <select value={canvasConfig.width} onChange={(e) => onResize(parseInt(e.target.value))} className="bg-transparent text-[10px] font-mono text-white outline-none text-right cursor-pointer hover:text-rose-400">
                        <option value={1024}>1024 x 1024 (1K)</option>
                        <option value={2048}>2048 x 2048 (2K)</option>
                        <option value={4096}>4096 x 4096 (4K)</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
