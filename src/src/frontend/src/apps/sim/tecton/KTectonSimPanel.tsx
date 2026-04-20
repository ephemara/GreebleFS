
import React from 'react';
import { 
  Zap, Minimize2, Waves, Layers, Scissors, Move, Flame, 
  Power, RotateCcw, Activity, Gauge, Cpu
} from 'lucide-react';

export default function KTectonSimPanel({
    activeEffect, setActiveEffect,
    simSpeed, setSimSpeed,
    isSimActive, setIsSimActive,
    handleReset,
    status
}: any) {
    return (
        <div className="w-72 bg-[#050505] border-l border-[#1a1a1a] flex flex-col z-20 shadow-[-4px_0_24px_rgba(0,0,0,0.8)]">
            {/* HEADER */}
            <div className="p-5 border-b border-[#222] bg-[#080808]">
                <div className="flex items-center gap-2 text-[#66fcf1] mb-1">
                    <Cpu size={18}/><span className="font-black text-lg tracking-widest italic">SIMULATION</span>
                </div>
                <div className="text-[9px] text-gray-600 font-mono tracking-[0.3em]">PHYSICS KERNEL</div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
                
                {/* STATUS MONITOR */}
                <div className="p-3 rounded border border-[#222] bg-[#0a0a0a] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity size={12} className={isSimActive ? "text-green-500 animate-pulse" : "text-gray-600"}/>
                        <span className="text-[9px] font-bold text-gray-400 tracking-widest">CORE STATUS</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold ${isSimActive ? "text-green-500" : "text-gray-600"}`}>
                        {isSimActive ? "ONLINE" : "STANDBY"}
                    </span>
                </div>

                {/* KERNELS */}
                <div className="space-y-3">
                    <div className="text-[9px] font-bold text-[#66fcf1] uppercase tracking-widest border-b border-[#222] pb-2 mb-2">Active Kernel</div>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            {id:0, l:'ZERO-POINT', desc:'Stable Energy Field', i:Minimize2}, 
                            {id:2, l:'HYDRAULIC', desc:'Fluid Erosion', i:Waves},
                            {id:5, l:'STRATA', desc:'Geological Layering', i:Layers}, 
                            {id:4, l:'TECTONIC', desc:'Seismic Shatter', i:Scissors},
                            {id:3, l:'WARP', desc:'Spatial Distortion', i:Move}, 
                            {id:1, l:'THERMAL', desc:'Heat Diffusion', i:Flame}
                        ].map(k => (
                            <button 
                                key={k.id} 
                                onClick={()=>setActiveEffect(k.id)} 
                                className={`flex items-center gap-3 p-3 rounded border transition-all text-left group ${activeEffect===k.id ? `border-[#66fcf1] bg-[#66fcf1]/5 shadow-[0_0_15px_rgba(102,252,241,0.1)]` : 'border-[#222] bg-[#0a0a0a] hover:border-gray-600'}`}
                            >
                                <div className={`p-2 rounded ${activeEffect===k.id ? 'bg-[#66fcf1] text-black' : 'bg-[#151515] text-gray-500'}`}>
                                    <k.i size={14}/>
                                </div>
                                <div>
                                    <div className={`text-[10px] font-bold tracking-wider ${activeEffect===k.id ? 'text-[#66fcf1]' : 'text-gray-400'}`}>{k.l}</div>
                                    <div className="text-[8px] text-gray-600 font-mono">{k.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* PARAMETERS */}
                <div className="space-y-4 pt-4 border-t border-[#1a1a1a]">
                    <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Gauge size={12}/> Time Dilation
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                            <span>SIMULATION SPEED</span> <span className="text-[#66fcf1]">{simSpeed.toFixed(1)}x</span>
                        </div>
                        <input 
                            type="range" min="0" max="5.0" step="0.1" 
                            value={simSpeed} onChange={e=>setSimSpeed(parseFloat(e.target.value))} 
                            className="w-full h-1 bg-[#222] rounded appearance-none accent-[#66fcf1]"
                        />
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="space-y-2 pt-4 border-t border-[#1a1a1a]">
                    <button 
                        onClick={() => setIsSimActive(!isSimActive)} 
                        className={`w-full py-4 rounded text-[10px] font-black tracking-widest flex items-center justify-center gap-2 transition-all border ${isSimActive ? 'bg-green-500/10 border-green-500 text-green-500 shadow-[0_0_20px_rgba(74,222,128,0.2)]' : 'bg-[#151515] border-[#222] text-gray-400 hover:text-white hover:border-gray-500'}`}
                    >
                        <Power size={14}/> {isSimActive ? 'PAUSE ENGINE' : 'IGNITE ENGINE'}
                    </button>
                    
                    <button 
                        onClick={handleReset} 
                        className="w-full py-3 bg-red-900/10 border border-red-900/30 hover:bg-red-900/20 hover:border-red-500/50 text-red-500 text-[10px] font-bold tracking-widest rounded flex items-center justify-center gap-2 transition-all"
                    >
                        <RotateCcw size={12}/> FLUSH CACHE (RESET)
                    </button>
                </div>

            </div>
        </div>
    );
}
