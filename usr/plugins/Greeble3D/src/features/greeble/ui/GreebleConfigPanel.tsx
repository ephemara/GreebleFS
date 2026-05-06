import { 
    Sliders, Zap, Box, Layers, Maximize, Activity, Dna, 
    Grid, RefreshCcw, Hash, ArrowUpFromLine
} from 'lucide-react';

interface GreebleConfigPanelProps {
    params: any;
    setParams: (params: any) => void;
    onClose?: () => void;
}

const SliderControl = ({ label, value, min, max, step, onChange, icon: Icon }: any) => (
    <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={12} className="text-gray-500" />}
                {label}
            </div>
            <span className="font-mono text-emerald-500">{value.toFixed(2)}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#111] rounded-lg appearance-none accent-emerald-500 hover:accent-emerald-400 transition-all cursor-pointer border border-[#222]"
        />
    </div>
);

const ToggleControl = ({ label, value, onChange, icon: Icon }: any) => (
    <button
        onClick={() => onChange(!value)}
        className={`w-full py-2 px-3 rounded border flex items-center justify-between transition-all ${value ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-[#111] border-[#222] text-gray-500 hover:border-gray-500'}`}
    >
        <div className="flex items-center gap-2 text-[10px] font-bold">
            {Icon && <Icon size={12} />}
            {label}
        </div>
        <div className={`w-2 h-2 rounded-full ${value ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-700'}`} />
    </button>
);

export const GreebleConfigPanel = ({ params, setParams }: GreebleConfigPanelProps) => {
    
    const update = (key: string, value: any) => {
        setParams((prev: any) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Box size={16} className="text-emerald-500" />
                    <span className="text-xs font-black tracking-widest text-white">GREEBLE ENGINE CONFIG</span>
                </div>
                <div className="text-[9px] font-bold text-gray-500 border border-white/10 px-2 py-0.5 rounded bg-black/50">
                    PROCEDURAL MODE
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                
                {/* 1. DISTRIBUTION PATTERNS */}
                <section className="space-y-4">
                    <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-900/30 pb-1">
                        <Grid size={12} /> Distribution Logic
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <SliderControl 
                            label="DENSITY" 
                            value={params.density} 
                            min={0.1} max={1.0} step={0.05} 
                            onChange={(v: number) => update('density', v)} 
                            icon={Layers}
                        />
                        <SliderControl 
                            label="CLUSTERING" 
                            value={params.clustering || 0.5} 
                            min={0} max={1} step={0.1} 
                            onChange={(v: number) => update('clustering', v)} 
                            icon={Activity}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={() => update('seed', Math.floor(Math.random() * 1000000))}
                            className="flex-1 py-2 bg-[#111] hover:bg-[#222] border border-[#222] rounded text-[10px] font-bold text-gray-400 flex items-center justify-center gap-2"
                        >
                            <RefreshCcw size={12} /> RANDOMIZE SEED
                        </button>
                        <div className="text-[10px] font-mono text-gray-600">#{params.seed}</div>
                    </div>
                </section>

                {/* 2. DIMENSIONAL PROPERTIES */}
                <section className="space-y-4">
                    <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2 border-b border-blue-900/30 pb-1">
                        <Maximize size={12} /> Dimensions
                    </div>
                    <SliderControl 
                        label="SCALE MIN" 
                        value={params.scale_min} 
                        min={0.05} max={1.0} step={0.05} 
                        onChange={(v: number) => update('scale_min', v)} 
                    />
                    <SliderControl 
                        label="SCALE MAX" 
                        value={params.scale_max} 
                        min={0.1} max={2.0} step={0.1} 
                        onChange={(v: number) => update('scale_max', v)} 
                    />
                     <div className="grid grid-cols-2 gap-4">
                        <SliderControl 
                            label="HEIGHT MIN" 
                            value={params.height_min} 
                            min={0.01} max={0.5} step={0.01} 
                            onChange={(v: number) => update('height_min', v)} 
                            icon={ArrowUpFromLine}
                        />
                        <SliderControl 
                            label="HEIGHT MAX" 
                            value={params.height_max} 
                            min={0.1} max={1.0} step={0.05} 
                            onChange={(v: number) => update('height_max', v)} 
                        />
                    </div>
                </section>

                {/* 3. GEOMETRIC DIVERSITY */}
                <section className="space-y-4">
                    <div className="text-[9px] font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2 border-b border-purple-900/30 pb-1">
                        <Dna size={12} /> Geometry & Noise
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <SliderControl 
                            label="NOISE FREQ" 
                            value={params.noise_frequency} 
                            min={0.1} max={10.0} step={0.1} 
                            onChange={(v: number) => update('noise_frequency', v)} 
                            icon={Zap}
                        />
                        <SliderControl 
                            label="OCTAVES" 
                            value={params.noise_octaves} 
                            min={1} max={8} step={1} 
                            onChange={(v: number) => update('noise_octaves', v)} 
                            icon={Hash}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-gray-500 mb-1">PRIMITIVE SET</div>
                        <div className="flex gap-1 bg-[#111] p-1 rounded border border-[#222]">
                            {['CUBIC', 'CYLIN', 'PYRA', 'ORGANIC'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => update('primitiveType', type.toLowerCase())}
                                    className={`flex-1 py-1.5 rounded text-[8px] font-bold transition-all ${params.primitiveType === type.toLowerCase() ? 'bg-purple-900/30 text-purple-400 border border-purple-500/30' : 'text-gray-600 hover:text-gray-300'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 4. ADVANCED */}
                <section className="space-y-4">
                    <div className="text-[9px] font-bold text-orange-500 uppercase tracking-widest flex items-center gap-2 border-b border-orange-900/30 pb-1">
                        <Sliders size={12} /> Advanced
                    </div>
                    <ToggleControl 
                        label="ALIGN TO NORMAL" 
                        value={true} // Always true for now in WASM
                        onChange={() => {}} 
                        icon={ArrowUpFromLine}
                    />
                    <ToggleControl 
                        label="PREVENT INTERSECTIONS" 
                        value={false} // Placeholder
                        onChange={() => {}} 
                        icon={Box}
                    />
                </section>

            </div>

            {/* Footer */}
            <div className="p-4 bg-[#050505] border-t border-white/10 text-center text-[9px] text-gray-600 italic">
                Changes apply on next generation
            </div>
        </div>
    );
};
