import React, { useState } from 'react';
import {
    X, Lock, Unlock, Paintbrush,
    Circle, Move, Activity, Square, Maximize, Minimize2, PenTool, Eraser, Archive,
    MousePointer2, Sliders
} from 'lucide-react';
import { BRUSHES } from './KSculptConstants';

// Styled Components / Tailwind Classes 
// We use inline mostly but keep it clean

export default function KSculptBrushMenu({
    visible, position,
    activeTool, onSelect,
    brushParams, setBrushParams,
    symmetry, setSymmetry,
    isLocked, onToggleLock,
    brushMode, setBrushMode
}: any) {
    if (!visible) return null;

    const style = position ? {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
    } : {
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)'
    };

    return (
        <div
            className="fixed z-[100] bg-[#0a0a0a]/95 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-4 shadow-[0_0_80px_rgba(249,115,22,0.15)] animate-in fade-in zoom-in-95 duration-100 w-72 flex flex-col gap-3 pointer-events-auto font-sans select-none"
            style={style}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-orange-900/30 pb-2">
                <div className="text-[10px] font-black text-orange-500 tracking-[0.2em] flex items-center gap-2">
                    <Paintbrush size={14} /> BRUSH ARSENAL
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSymmetry(symmetry === 'X' ? 'NONE' : 'X')}
                        className={`px-2 py-1 rounded text-[8px] font-bold border transition-all ${symmetry === 'X' ? 'bg-orange-500 text-black border-orange-400' : 'bg-[#1a1a1a] text-gray-500 border-[#333]'}`}
                        title="Toggle Symmetry"
                    >
                        {symmetry === 'X' ? 'SYM: ON' : 'SYM: OFF'}
                    </button>
                    <button
                        onClick={onToggleLock}
                        className={`p-1 rounded hover:bg-orange-900/30 transition-colors ${isLocked ? 'text-orange-500' : 'text-gray-600'}`}
                        title={isLocked ? "Unlock Menu" : "Lock Menu Open"}
                    >
                        {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                </div>
            </div>

            {/* SLIDERS (Integrated) */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 space-y-3">
                {/* RADIUS */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider">
                        <span>Radius</span> <span className="text-orange-500">{brushParams?.radius?.toFixed(2) || '0.50'}</span>
                    </div>
                    <input
                        type="range" min="0.05" max="2.0" step="0.05"
                        value={brushParams?.radius || 0.5}
                        onChange={(e) => setBrushParams({ ...brushParams, radius: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-[#222] rounded appearance-none accent-orange-500"
                    />
                </div>

                {/* INTENSITY */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider">
                        <span>Intensity</span> <span className="text-orange-500">{brushParams?.intensity?.toFixed(2) || '0.50'}</span>
                    </div>
                    <input
                        type="range" min="0.1" max="1.0" step="0.05"
                        value={brushParams?.intensity || 0.5}
                        onChange={(e) => setBrushParams({ ...brushParams, intensity: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-[#222] rounded appearance-none accent-orange-500"
                    />
                </div>

                {/* KADD / KSUB MODE */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setBrushMode('ADD')}
                        className={`
                        py-1.5 rounded-lg text-[8px] font-black tracking-widest border transition-all
                        ${brushMode === 'ADD' ? 'bg-orange-500 text-black border-orange-400' : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300'}
                    `}
                    >
                        KADD
                    </button>
                    <button
                        onClick={() => setBrushMode('SUB')}
                        className={`
                         py-1.5 rounded-lg text-[8px] font-black tracking-widest border transition-all
                        ${brushMode === 'SUB' ? 'bg-orange-500 text-black border-orange-400' : 'bg-[#111] border-[#222] text-gray-500 hover:text-gray-300'}
                    `}
                    >
                        KSUB
                    </button>
                </div>
            </div>

            {/* BRUSH GRID */}
            <div className="grid grid-cols-4 gap-2">
                {BRUSHES.map((brush) => (
                    <button
                        key={brush.id}
                        onClick={() => onSelect(brush.id)}
                        className={`
                            aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border transition-all group relative overflow-hidden
                            ${activeTool === brush.id
                                ? 'bg-orange-900/20 border-orange-500/50 text-orange-100 shadow-[inset_0_0_15px_rgba(249,115,22,0.2)]'
                                : 'bg-[#111] border-[#222] text-gray-500 hover:border-orange-500/30 hover:text-gray-300'
                            }
                        `}
                        title={`${brush.label} (${brush.key})`}
                    >
                        <brush.icon size={18} className={activeTool === brush.id ? "text-orange-400 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]" : "text-gray-600 group-hover:text-gray-400"} />
                        <span className="text-[6px] font-black tracking-wider">{brush.label}</span>

                        {/* Hotkey Indicator */}
                        <div className="absolute top-1 right-1 text-[5px] font-mono opacity-30">{brush.key}</div>
                    </button>
                ))}
            </div>

            <div className="text-[8px] text-center text-gray-700 font-mono pt-1">
                PRESS 'B' TO TOGGLE
            </div>
        </div>
    );
}
