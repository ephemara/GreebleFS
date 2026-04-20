
import React from 'react';
import { Circle, Ban } from 'lucide-react';

export default function KSculptAlphaMenu({ visible, position, alphas, activeAlpha, onSelect }: any) {
    if (!visible) return null;

    return (
        <div 
            className="fixed z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-75 w-64"
            style={{ 
                left: position.x, 
                top: position.y,
                transform: 'translate(-50%, -50%)'
            }}
        >
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center mb-3 border-b border-orange-500/20 pb-2">
                Brush Alpha
            </div>
            
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                {/* Default / None */}
                <button
                    onClick={() => onSelect(null)}
                    className={`aspect-square rounded-lg border flex items-center justify-center transition-all ${!activeAlpha ? 'bg-orange-500 border-orange-400 text-black' : 'bg-[#111] border-[#333] text-gray-500 hover:text-white'}`}
                    title="No Alpha (Round)"
                >
                    <Circle size={16} fill={!activeAlpha ? "black" : "currentColor"} />
                </button>

                {/* Alpha List */}
                {alphas && alphas.map((alpha: any, i: number) => (
                    <button 
                        key={i}
                        onClick={() => onSelect(alpha)}
                        className={`
                            relative aspect-square rounded-lg border overflow-hidden transition-all group
                            ${activeAlpha === alpha ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-[#333] hover:border-white'}
                        `}
                    >
                        <img 
                            src={alpha.preview || alpha.url} 
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" 
                            alt={alpha.name}
                        />
                    </button>
                ))}
            </div>
            
            {(!alphas || alphas.length === 0) && (
                <div className="text-[8px] text-gray-600 text-center mt-2 italic">
                    No custom alphas loaded.<br/>Import in K-Painter.
                </div>
            )}
        </div>
    );
}
