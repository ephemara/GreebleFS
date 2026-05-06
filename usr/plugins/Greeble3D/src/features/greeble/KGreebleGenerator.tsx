import { Box, Hash, Grid, Maximize, ArrowUpToLine, Activity } from 'lucide-react';
import { SHAPES } from './KGreebleEngine';
import { BufferedSlider } from './ui/BufferedSlider';

interface KGreebleGeneratorProps {
    activeShape: string;
    setActiveShape: (shape: string) => void;
    greebleParams: {
        seed: number;
        density: number;
        clustering: number;
        scale_min: number;
        scale_max: number;
        height_min: number;
        height_max: number;
        primitiveType: string;
        pattern: string;
        noise_frequency: number;
        noise_octaves: number;
        useImports?: boolean;
        useShaders?: boolean;
        distortion?: number;
        infiniteShapes?: boolean;
        shapeSegments?: number;
    };
    setGreebleParams: (params: any) => void;
}

export default function KGreebleGenerator({
    activeShape,
    setActiveShape,
    greebleParams,
    setGreebleParams
}: KGreebleGeneratorProps) {

    const updateParam = (key: string, value: any) => {
        setGreebleParams({ ...greebleParams, [key]: value });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6 pb-4">
            {/* ACTIVATION BUTTON */}
            <button
                onClick={() => setActiveShape(SHAPES.GREEBLE)}
                className={`w-full py-6 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all relative overflow-hidden group ${activeShape === SHAPES.GREEBLE ? 'border-emerald-500 bg-emerald-900/20' : 'border-[#333] bg-[#0a0a0a] hover:border-gray-500'}`}
            >
                <div
                    className={`absolute inset-0 opacity-20 ${activeShape === SHAPES.GREEBLE ? 'animate-pulse' : ''}`}
                    style={{
                        backgroundImage: 'linear-gradient(rgba(16,185,129,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.18) 1px, transparent 1px)',
                        backgroundSize: '18px 18px',
                    }}
                />
                <div className={`p-3 rounded-full ${activeShape === SHAPES.GREEBLE ? 'bg-emerald-500 text-black' : 'bg-[#222] text-gray-500'}`}>
                    <Box size={24} />
                </div>
                <div className="flex flex-col items-center z-10">
                    <span className={`text-xs font-black tracking-widest uppercase ${activeShape === SHAPES.GREEBLE ? 'text-emerald-400' : 'text-gray-400 group-hover:text-white'}`}>
                        Greeble Generator
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide mt-1">
                        {activeShape === SHAPES.GREEBLE ? 'Active Protocol' : 'Click to Activate'}
                    </span>
                </div>
            </button>

            {/* CONTROLS */}
            <div className={`space-y-5 transition-opacity duration-300 ${activeShape === SHAPES.GREEBLE ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                
                {/* DISTRIBUTION SETTINGS */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Grid size={12} /> Distribution
                    </div>
                    
                    <div className="space-y-1">
                        <BufferedSlider 
                            label="SHAPE COUNT (DENSITY)" 
                            value={greebleParams.density}
                            onChange={(v) => updateParam('density', v)}
                            min={0.1} max={5.0} step={0.1}
                            accent="accent-emerald-500"
                        />
                        <p className="text-[8px] text-gray-600">
                            Controls the total number of greebles spawned (Multiplier).
                        </p>
                    </div>

                    <div className="space-y-1">
                        <BufferedSlider 
                            label="CLUSTERING" 
                            value={greebleParams.clustering}
                            onChange={(v) => updateParam('clustering', v)}
                            min={0.0} max={1.0} step={0.05}
                            accent="accent-emerald-500"
                        />
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* GEOMETRY SETTINGS */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Maximize size={12} /> Geometry
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                                <span>SCALE MIN</span>
                            </div>
                            <input 
                                type="number" step="0.05"
                                value={greebleParams.scale_min}
                                onChange={(e) => updateParam('scale_min', parseFloat(e.target.value))}
                                className="w-full bg-[#111] border border-[#222] rounded px-2 py-1 text-[10px] text-gray-300"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                                <span>SCALE MAX</span>
                            </div>
                            <input 
                                type="number" step="0.05"
                                value={greebleParams.scale_max}
                                onChange={(e) => updateParam('scale_max', parseFloat(e.target.value))}
                                className="w-full bg-[#111] border border-[#222] rounded px-2 py-1 text-[10px] text-gray-300"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                         <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                                <span>HEIGHT MIN</span>
                            </div>
                            <input 
                                type="number" step="0.05"
                                value={greebleParams.height_min}
                                onChange={(e) => updateParam('height_min', parseFloat(e.target.value))}
                                className="w-full bg-[#111] border border-[#222] rounded px-2 py-1 text-[10px] text-gray-300"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                                <span>HEIGHT MAX</span>
                            </div>
                            <input 
                                type="number" step="0.05"
                                value={greebleParams.height_max}
                                onChange={(e) => updateParam('height_max', parseFloat(e.target.value))}
                                className="w-full bg-[#111] border border-[#222] rounded px-2 py-1 text-[10px] text-gray-300"
                            />
                        </div>
                    </div>
                </div>

                 <div className="h-px bg-white/5" />

                {/* NOISE SETTINGS */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Activity size={12} /> Noise Pattern
                    </div>
                    
                    <div className="space-y-1">
                        <BufferedSlider 
                            label="FREQUENCY" 
                            value={greebleParams.noise_frequency}
                            onChange={(v) => updateParam('noise_frequency', v)}
                            min={0.1} max={10.0} step={0.1}
                            accent="accent-emerald-500"
                        />
                    </div>

                    <div className="space-y-1">
                        <BufferedSlider 
                            label="OCTAVES" 
                            value={greebleParams.noise_octaves}
                            onChange={(v) => updateParam('noise_octaves', v)}
                            min={1} max={8} step={1}
                            accent="accent-emerald-500"
                        />
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* ADVANCED MODULES */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Activity size={12} /> Advanced Modules
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#222]">
                        <span className="text-[9px] font-bold text-gray-400">KERNEL IMPORTS</span>
                        <input 
                            type="checkbox"
                            checked={greebleParams.useImports || false}
                            onChange={(e) => updateParam('useImports', e.target.checked)}
                            className="accent-emerald-500"
                        />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#222]">
                        <span className="text-[9px] font-bold text-gray-400">SHADER INJECTION</span>
                        <input 
                            type="checkbox"
                            checked={greebleParams.useShaders || false}
                            onChange={(e) => updateParam('useShaders', e.target.checked)}
                            className="accent-red-500"
                        />
                    </div>

                    <div className="space-y-1 mt-2">
                        <BufferedSlider 
                            label="GEOMETRY DISTORTION" 
                            value={greebleParams.distortion || 0}
                            onChange={(v) => updateParam('distortion', v)}
                            min={0} max={1.0} step={0.05}
                            accent="accent-purple-500"
                        />
                    </div>
                </div>

                <div className="h-px bg-white/5" />

                {/* INFINITE SHAPES */}
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <ArrowUpToLine size={12} /> Infinite Shapes
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#222]">
                        <span className="text-[9px] font-bold text-gray-400">PROCEDURAL GEOMETRY</span>
                        <input 
                            type="checkbox"
                            checked={greebleParams.infiniteShapes || false}
                            onChange={(e) => updateParam('infiniteShapes', e.target.checked)}
                            className="accent-blue-500"
                        />
                    </div>

                    {greebleParams.infiniteShapes && (
                        <div className="space-y-1 mt-2 animate-in fade-in">
                            <BufferedSlider 
                                label="SEGMENT MAX" 
                                value={greebleParams.shapeSegments || 12}
                                onChange={(v) => updateParam('shapeSegments', v)}
                                min={3} max={500} step={1}
                                accent="accent-blue-500"
                            />
                            <p className="text-[8px] text-gray-600 mt-1">
                                Generates random 2D profiles extruded into 3D. Higher values create complex circular or star-like gears.
                            </p>
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5" />

                {/* SEED */}
                 <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Hash size={12} /> Seed
                    </div>
                    <div className="flex gap-2">
                         <input 
                            type="number"
                            value={greebleParams.seed}
                            onChange={(e) => updateParam('seed', parseInt(e.target.value))}
                            className="flex-1 bg-[#111] border border-[#222] rounded px-2 py-1.5 text-[10px] text-gray-300 font-mono"
                        />
                        <button 
                            onClick={() => updateParam('seed', Math.floor(Math.random() * 1000000))}
                            className="px-3 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-gray-400 hover:text-white transition-colors"
                        >
                            <RefreshCcwIcon size={12} />
                        </button>
                    </div>
                </div>

            </div>
            </div>
        </div>
    );
}

function RefreshCcwIcon({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
        </svg>
    )
}
