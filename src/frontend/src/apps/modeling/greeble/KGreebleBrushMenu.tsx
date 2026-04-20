
import React from 'react';
import { Circle, Move, Activity, Square, Maximize, Paintbrush, MousePointer2, Zap, Minimize2, Scaling } from 'lucide-react';

const BRUSHES = [
    { id: 'SELECT', icon: MousePointer2, label: 'SELECT', key: 'S' },
    { id: 'CLAY', icon: Circle, label: 'CLAY', key: '1' },
    { id: 'MOVE', icon: Move, label: 'MOVE', key: '2' },
    { id: 'SMOOTH', icon: Activity, label: 'SMOOTH', key: '3' },
    { id: 'FLATTEN', icon: Square, label: 'FLATTEN', key: '4' },
    { id: 'INFLATE', icon: Maximize, label: 'INFLATE', key: '5' },
    { id: 'PAINT', icon: Paintbrush, label: 'PAINT', key: '6' },
    { id: 'ERODE', icon: Minimize2, label: 'ERODE', key: '7' },
    { id: 'STRETCH', icon: Scaling, label: 'STRETCH', key: '8' },
    { id: 'NOISE', icon: Zap, label: 'NOISE', key: '9' },
];

export default function KGreebleBrushMenu({ visible, position, activeTool, onSelect }: any) {
    if (!visible) return null;

    return (
        <div
            className="fixed z-[100] bg-[#0a0a0a]/90 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-75 grid grid-cols-5 gap-2 w-80 pointer-events-auto"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)'
            }}
        >
            <div className="col-span-5 text-[9px] font-bold text-gray-500 uppercase tracking-widest text-center mb-2 border-b border-orange-500/20 pb-2">
                Select Sculpt Tool
            </div>
            {BRUSHES.map((brush) => (
                <button
                    key={brush.id}
                    onClick={() => onSelect(brush.id)}
                    className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border transition-all group
                        ${activeTool === brush.id
                            ? 'bg-orange-500 text-black border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                            : 'bg-[#111] border-[#333] text-gray-400 hover:border-orange-500/50 hover:text-white'
                        }
                    `}
                >
                    <brush.icon size={20} className={activeTool === brush.id ? "text-black" : "text-gray-500 group-hover:text-white"} />
                    <span className="text-[7px] font-black">{brush.label}</span>
                </button>
            ))}
        </div>
    );
}
