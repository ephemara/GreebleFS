import { Hexagon, Repeat, Wind, Fingerprint, Zap, ArrowUpToLine, Crown } from 'lucide-react';

interface KGreebleXenoProps {
    titanParams: any;
    setTitanParams: (params: any) => void;
    activateTool: () => void;
    isActive: boolean;
}

export default function KGreebleXeno({ titanParams, setTitanParams, activateTool, isActive }: KGreebleXenoProps) {
    
    const update = (key: string, value: any) => {
        setTitanParams({ ...titanParams, [key]: value });
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-6 pb-4 animate-in fade-in slide-in-from-left-4">
            
            {/* ACTIVATION BUTTON */}
            <button
                onClick={activateTool}
                className={`w-full py-6 rounded-xl border flex flex-col items-center justify-center gap-3 transition-all relative overflow-hidden group ${isActive ? 'border-purple-500 bg-purple-900/20' : 'border-[#333] bg-[#0a0a0a] hover:border-gray-500'}`}
            >
                <div
                    className={`absolute inset-0 opacity-10 ${isActive ? 'animate-pulse' : ''}`}
                    style={{
                        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(196,181,253,0.28) 0, transparent 22%), radial-gradient(circle at 80% 30%, rgba(168,85,247,0.22) 0, transparent 18%), radial-gradient(circle at 40% 80%, rgba(139,92,246,0.18) 0, transparent 20%)',
                    }}
                />
                <div className={`p-3 rounded-full ${isActive ? 'bg-purple-500 text-black' : 'bg-[#222] text-gray-500'}`}>
                    <Hexagon size={24} />
                </div>
                <div className="flex flex-col items-center z-10">
                    <span className={`text-xs font-black tracking-widest uppercase ${isActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-white'}`}>
                        XENO
                    </span>
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide mt-1">
                        Super-Geometry
                    </span>
                </div>
            </button>

            {/* CONTROLS */}
            <div className={`space-y-5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                
                {/* GOD MODE TOGGLE */}
                <div className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded border border-purple-900/30">
                    <div className="flex items-center gap-2">
                        <Crown size={14} className="text-yellow-500" />
                        <span className="text-[10px] font-bold text-yellow-500 tracking-wider">HIGH FIDELITY</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={titanParams.landscapeMode || false} 
                            onChange={e => update('landscapeMode', e.target.checked)} 
                            className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-yellow-600"></div>
                    </label>
                </div>

                {/* 1. SHAPE DNA */}
                <section className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Fingerprint size={12} /> Superformula
                    </div>
                    
                    {/* M1: Number of Lobes/Corners */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                            <span>SYMMETRY (M)</span>
                            <span className="text-purple-400">{titanParams.m1.toFixed(0)}</span>
                        </div>
                        <input type="range" min="0" max="20" step="1" value={titanParams.m1} onChange={(e) => update('m1', parseFloat(e.target.value))} className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none accent-purple-500" />
                    </div>

                    {/* N1: Bloat vs Pinch */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                            <span>TENSION (N1)</span>
                            <span className="text-purple-400">{titanParams.n1.toFixed(2)}</span>
                        </div>
                        <input type="range" min="0.1" max="10" step="0.1" value={titanParams.n1} onChange={(e) => update('n1', parseFloat(e.target.value))} className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none accent-purple-500" />
                    </div>
                </section>

                <div className="h-px bg-white/5" />

                {/* 2. RECURSION & QUALITY */}
                <section className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Repeat size={12} /> Structure & Quality
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                            <span>DEPTH (COMPLEXITY)</span>
                            <span className="text-blue-400">{titanParams.complexity}</span>
                        </div>
                        <input type="range" min="1" max="5" step="1" value={titanParams.complexity} onChange={(e) => update('complexity', parseFloat(e.target.value))} className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none accent-blue-500" />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#222]">
                        <span className="text-[9px] font-bold text-gray-400 flex items-center gap-2"><Zap size={10} /> HIGH RES GEOMETRY</span>
                        <input 
                            type="checkbox"
                            checked={titanParams.highRes || false}
                            onChange={(e) => update('highRes', e.target.checked)}
                            className="accent-blue-500"
                        />
                    </div>

                    <div className="flex items-center justify-between p-2 bg-[#111] rounded border border-[#222]">
                        <span className="text-[9px] font-bold text-gray-400 flex items-center gap-2"><ArrowUpToLine size={10} /> PROCEDURAL MIXIN</span>
                        <input 
                            type="checkbox"
                            checked={titanParams.useProcedural || false}
                            onChange={(e) => update('useProcedural', e.target.checked)}
                            className="accent-emerald-500"
                        />
                    </div>
                </section>

                <div className="h-px bg-white/5" />

                {/* 3. DEFORMATION */}
                <section className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                        <Wind size={12} /> Surrealist Warping
                    </div>
                    
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                            <span>TWIST FACTOR</span>
                            <span className="text-pink-400">{titanParams.twist.toFixed(2)}</span>
                        </div>
                        <input type="range" min="-5.0" max="5.0" step="0.1" value={titanParams.twist} onChange={(e) => update('twist', parseFloat(e.target.value))} className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none accent-pink-500" />
                    </div>
                </section>

            </div>
            </div>
        </div>
    );
}
