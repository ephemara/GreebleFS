import { HexColorPicker } from 'react-colorful';
import { Zap, Activity, Grid, Layers, RefreshCw, Wind, Waves, Disc } from 'lucide-react';

// Define Shader Library Metadata
const SHADER_TYPES = [
    { id: 'standard', name: 'Standard', icon: <Wind size={10} />, desc: 'Simplex Noise' },
    { id: 'hologram', name: 'Hologram', icon: <Grid size={10} />, desc: 'Scanline Interference' },
    { id: 'liquid', name: 'Liquid', icon: <Waves size={10} />, desc: 'Viscosity Fluid' },
    { id: 'glitch', name: 'Glitch', icon: <Zap size={10} />, desc: 'Vertex Quantization' },
    { id: 'plasma', name: 'Plasma', icon: <Disc size={10} />, desc: 'High Energy' }
];

interface KGreebleFluxProps {
    activeLayerId: string | null;
    layers: any[];
    updateLayer: (id: string, updates: any) => void;
}

export default function KGreebleFlux({
    activeLayerId,
    layers,
    updateLayer
}: KGreebleFluxProps) {
    
    if (!activeLayerId) {
        return (
            <div className="p-8 text-center text-gray-600 flex flex-col items-center justify-center h-full">
                <Zap size={24} className="mb-2 opacity-20" />
                <p className="text-[10px] font-mono uppercase">Select Layer</p>
            </div>
        );
    }

    const activeLayer = layers.find(l => l.id === activeLayerId);
    const fluxParams = activeLayer?.flux || { 
        enabled: false, 
        type: 'standard', 
        chaos: 0.5, 
        colorA: '#ff003c', 
        colorB: '#000000' 
    };

    const setFluxParams = (newParams: any) => {
        updateLayer(activeLayerId, { flux: newParams });
    };

    return (
        <div className="p-3 bg-[#0a0a0a] flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-4 text-red-500 border-b border-red-900/20 pb-2">
                <Zap size={14} className="fill-red-500/20" />
                <h2 className="font-bold text-[10px] tracking-widest uppercase">Flux Engine // <span className="text-white">{activeLayer?.name}</span></h2>
            </div>

            {/* MAIN TOGGLE */}
            <div className={`mb-4 p-2 border rounded transition-all ${fluxParams.enabled ? 'bg-red-950/10 border-red-500/50' : 'bg-[#111] border-[#222]'}`}>
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className={`text-[9px] font-black uppercase tracking-wider ${fluxParams.enabled ? 'text-red-400' : 'text-gray-500'}`}>
                            Shader Status
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={fluxParams.enabled} 
                            onChange={e => setFluxParams({...fluxParams, enabled: e.target.checked})} 
                            className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                </div>
            </div>

            {fluxParams.enabled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    
                    {/* SHADER TYPE SELECTOR */}
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-2 mb-1">
                            <Layers size={10} /> Protocol
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {SHADER_TYPES.map(shader => (
                                <button
                                    key={shader.id}
                                    onClick={() => setFluxParams({...fluxParams, type: shader.id})}
                                    className={`flex items-center gap-2 p-1.5 rounded border transition-all text-left ${fluxParams.type === shader.id ? 'bg-red-900/20 border-red-500/50 text-white' : 'bg-[#111] border-[#222] text-gray-500 hover:border-gray-600'}`}
                                >
                                    <div className={`p-1 rounded ${fluxParams.type === shader.id ? 'bg-red-500 text-black' : 'bg-[#222]'}`}>
                                        {shader.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider truncate">{shader.name}</div>
                                        <div className="text-[8px] text-gray-600 truncate">{shader.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* CHAOS CONTROL */}
                    <div className="space-y-1">
                        <div className="flex justify-between items-end">
                            <label className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-2">
                                <Activity size={10} /> Chaos
                            </label>
                            <span className="text-[9px] font-mono text-red-400">{fluxParams.chaos.toFixed(2)}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" max="2.0" step="0.05" 
                            value={fluxParams.chaos} 
                            onChange={e => setFluxParams({...fluxParams, chaos: parseFloat(e.target.value)})} 
                            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none accent-red-500 cursor-pointer hover:accent-red-400 transition-all"
                        />
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* COLOR CONTROL */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                             <label className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-2">
                                <RefreshCw size={10} /> Primary
                            </label>
                            <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: fluxParams.colorA }} />
                        </div>
                        
                        <div className="custom-color-picker-wrapper small">
                            <HexColorPicker 
                                color={fluxParams.colorA} 
                                onChange={(color) => setFluxParams({...fluxParams, colorA: color})} 
                                style={{ width: '100%', height: '80px' }}
                            />
                        </div>

                        <div className="flex items-center justify-between mt-2">
                             <label className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-2">
                                <RefreshCw size={10} /> Secondary
                            </label>
                            <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: fluxParams.colorB }} />
                        </div>
                        
                        <div className="custom-color-picker-wrapper small">
                            <HexColorPicker 
                                color={fluxParams.colorB} 
                                onChange={(color) => setFluxParams({...fluxParams, colorB: color})} 
                                style={{ width: '100%', height: '80px' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
