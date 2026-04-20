
import React from 'react';
import { Sun, Lightbulb, Eclipse, Move, Zap } from 'lucide-react';

export default function KAutopbrlighting({ lighting, setLighting }: any) {
    
    const update = (key: string, val: any) => {
        setLighting((prev: any) => ({ ...prev, [key]: val }));
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Sun size={12}/> Studio Environment
            </div>

            <div className="p-3 bg-[#111] rounded border border-[#222] space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                        <span>ENVIRONMENT INTENSITY</span> <span className="text-yellow-400">{lighting.envIntensity.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="5" step="0.1" value={lighting.envIntensity} onChange={e=>update('envIntensity', parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-yellow-500"/>
                </div>
            </div>

            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mt-4">
                <Zap size={12}/> Key Light (Sun)
            </div>

            <div className="p-3 bg-[#111] rounded border border-[#222] space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                        <span>INTENSITY</span> <span className="text-blue-400">{lighting.keyIntensity.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="10" step="0.1" value={lighting.keyIntensity} onChange={e=>update('keyIntensity', parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-blue-500"/>
                </div>
                
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                        <span>COLOR</span> <span className="text-gray-500">{lighting.keyColor}</span>
                    </div>
                    <div className="flex gap-2">
                        <input type="color" value={lighting.keyColor} onChange={e=>update('keyColor', e.target.value)} className="flex-1 bg-transparent border border-[#333] h-6 rounded cursor-pointer"/>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                        <span>ANGLE (Y)</span> <span className="text-gray-500">{lighting.keyAngle.toFixed(0)}°</span>
                    </div>
                    <input type="range" min="0" max="360" step="1" value={lighting.keyAngle} onChange={e=>update('keyAngle', parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-gray-500"/>
                </div>
            </div>

            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mt-4">
                <Eclipse size={12}/> Rim Light
            </div>

            <div className="p-3 bg-[#111] rounded border border-[#222] space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                        <span>INTENSITY</span> <span className="text-purple-400">{lighting.rimIntensity.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="10" step="0.1" value={lighting.rimIntensity} onChange={e=>update('rimIntensity', parseFloat(e.target.value))} className="w-full h-1 bg-[#222] rounded appearance-none accent-purple-500"/>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                        <span>COLOR</span>
                    </div>
                    <div className="flex gap-2">
                        <input type="color" value={lighting.rimColor} onChange={e=>update('rimColor', e.target.value)} className="flex-1 bg-transparent border border-[#333] h-6 rounded cursor-pointer"/>
                    </div>
                </div>
            </div>
        </div>
    );
}
