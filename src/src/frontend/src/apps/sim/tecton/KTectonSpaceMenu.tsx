
import React from 'react';
import { 
  Zap, Minimize2, Waves, Layers, Scissors, Move, Flame, 
  Power, Cpu, Activity, Gauge, RotateCcw, Droplet, CloudRain
} from 'lucide-react';

export default function KTectonSpaceMenu({
    activeEffect, setActiveEffect,
    isSimActive, setIsSimActive,
    simSpeed, setSimSpeed,
    handleReset,
    position,
    visible
}: any) {
    if (!visible) return null;

    const kernels = [
        {id:0, l:'ZERO-POINT', desc:'STABLE FIELD', i:Minimize2, c:'text-gray-400', b:'border-gray-600'}, 
        {id:6, l:'MAGMA FLOW', desc:'FLUID ADVECTION', i:Flame, c:'text-orange-500', b:'border-orange-500'},
        {id:7, l:'THERMAL VENTS', desc:'FLUID DEPOSITION', i:CloudRain, c:'text-pink-500', b:'border-pink-500'},
        {id:2, l:'HYDRAULIC', desc:'RAIN & EROSION', i:Droplet, c:'text-blue-400', b:'border-blue-500'},
        {id:5, l:'STRATA', desc:'GEO LAYERING', i:Layers, c:'text-emerald-400', b:'border-emerald-500'}, 
        {id:4, l:'TECTONIC', desc:'SEISMIC CRACK', i:Scissors, c:'text-yellow-400', b:'border-yellow-500'},
        {id:3, l:'WARP', desc:'SPATIAL DISTORT', i:Move, c:'text-purple-400', b:'border-purple-500'}, 
        {id:1, l:'THERMAL', desc:'HEAT DIFFUSION', i:Zap, c:'text-red-400', b:'border-red-500'}
    ];

    const style = {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
    };

    return (
        <div 
            className="fixed z-[100] w-80 bg-[#050505]/95 backdrop-blur-xl border border-emerald-500/50 rounded-2xl shadow-[0_0_60px_rgba(16,185,129,0.2)] p-6 animate-in fade-in zoom-in-95 duration-75 flex flex-col gap-4 pointer-events-auto font-sans"
            style={style}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#222] pb-3">
                <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-emerald-500"/>
                    <span className="text-[10px] font-black text-white tracking-[0.2em]">PHYSICS KERNEL</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${isSimActive ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}/>
            </div>

            {/* Global Params */}
            <div className="space-y-2 pb-2 border-b border-[#222]">
                <div className="flex justify-between items-center text-[9px] font-bold text-gray-400">
                    <span className="flex items-center gap-2"><Gauge size={10}/> TIME DILATION</span>
                    <span className="text-emerald-400 font-mono">{simSpeed.toFixed(1)}x</span>
                </div>
                <input 
                    type="range" min="0.1" max="5.0" step="0.1" 
                    value={simSpeed} 
                    onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#222] rounded appearance-none accent-emerald-500"
                />
            </div>

            {/* Kernel Grid */}
            <div className="grid grid-cols-2 gap-2">
                {kernels.map(k => (
                    <button 
                        key={k.id}
                        onClick={() => setActiveEffect(k.id)}
                        className={`
                            relative p-3 rounded-lg border transition-all group overflow-hidden flex flex-col gap-1 text-left
                            ${activeEffect === k.id 
                                ? `bg-[#1a1a1a] ${k.b} shadow-[0_0_15px_rgba(0,0,0,0.5)]` 
                                : 'bg-[#0a0a0a] border-[#222] hover:bg-[#111] hover:border-[#444]'
                            }
                        `}
                    >
                        {activeEffect === k.id && <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50`}/>}
                        
                        <div className="flex items-center justify-between">
                            <k.i size={16} className={activeEffect === k.id ? k.c : 'text-gray-600 group-hover:text-gray-400'}/>
                            {activeEffect === k.id && <Activity size={10} className={`${k.c} animate-pulse`}/>}
                        </div>
                        
                        <div>
                            <div className={`text-[9px] font-bold tracking-wider ${activeEffect === k.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                {k.l}
                            </div>
                            <div className="text-[7px] text-gray-600 font-mono opacity-80">
                                {k.desc}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Global Engine Controls */}
            <div className="flex gap-2 pt-2 border-t border-[#333]">
                <button 
                    onClick={() => setIsSimActive(!isSimActive)} 
                    className={`
                        flex-1 py-3 rounded-lg text-[10px] font-black tracking-widest flex items-center justify-center gap-2 transition-all border
                        ${isSimActive 
                            ? 'bg-emerald-900/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
                            : 'bg-[#111] border-[#333] text-gray-500 hover:text-white hover:border-gray-500'
                        }
                    `}
                >
                    <Power size={14}/> {isSimActive ? 'HALT' : 'IGNITE'}
                </button>
                
                <button 
                    onClick={handleReset}
                    className="w-12 flex items-center justify-center rounded-lg border border-red-900/30 bg-red-900/10 hover:bg-red-900/20 hover:border-red-500/50 text-red-500 transition-all"
                    title="Flush Cache (Reset)"
                >
                    <RotateCcw size={14}/>
                </button>
            </div>

            <div className="text-[8px] text-center text-gray-600 font-mono">
                RELEASE SPACE TO CLOSE
            </div>
        </div>
    );
}
