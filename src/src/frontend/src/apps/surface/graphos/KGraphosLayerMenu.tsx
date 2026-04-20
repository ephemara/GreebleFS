
import React from 'react';
import { Layers, Plus, Eye, EyeOff, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { KButton } from '../../../core/ui';

export default function KGraphosLayerMenu({
    visible,
    position, // NEW
    layers,
    activeLayerId,
    setActiveLayerId,
    onAdd,
    onDelete,
    onToggleVisibility,
    onOpacityChange
}: any) {
    if (!visible) return null;

    const activeLayer = layers.find((l: any) => l.id === activeLayerId);

    return (
        <div
            className="absolute w-64 bg-[#111] border border-[#333] rounded-xl shadow-2xl p-4 flex flex-col gap-4 z-50"
            style={{
                top: position ? position.y : '50%',
                left: position ? position.x : '50%',
                transform: 'translate(-50%, -50%)' // Center on cursor
            }}
        >

            {/* HEADER */}
            <div className="flex items-center justify-between text-gray-400 border-b border-[#333] pb-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    <Layers size={14} className="text-rose-500" /> Quick Layers
                </div>
                <div className="text-[9px] font-mono bg-[#222] px-1.5 py-0.5 rounded text-gray-500">L</div>
            </div>

            {/* ACTIVE LAYER CONTROLS */}
            {activeLayer && (
                <div className="flex flex-col gap-2 bg-[#0a0a0a] p-2 rounded border border-[#222]">
                    <div className="flex justify-between text-[9px] font-bold text-gray-500">
                        <span>OPACITY</span>
                        <span>{(activeLayer.opacity * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={activeLayer.opacity}
                        onChange={(e) => onOpacityChange(activeLayer.id, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#222] rounded-full appearance-none accent-rose-500 cursor-pointer"
                    />
                </div>
            )}

            {/* LAYER LIST */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {[...layers].reverse().map((layer: any) => (
                    <div
                        key={layer.id}
                        onClick={() => setActiveLayerId(layer.id)}
                        className={`group flex items-center justify-between p-2 rounded cursor-pointer border transition-all ${activeLayerId === layer.id
                            ? 'bg-rose-900/20 border-rose-500/50'
                            : 'bg-[#1a1a1a] border-transparent hover:border-[#333]'
                            }`}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                                className={`p-1 rounded hover:bg-white/10 ${layer.visible ? 'text-gray-400' : 'text-gray-600'}`}
                            >
                                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <span className={`text-[10px] font-bold truncate ${activeLayerId === layer.id ? 'text-rose-400' : 'text-gray-400'}`}>
                                {layer.name}
                            </span>
                        </div>

                        {activeLayerId === layer.id && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }}
                                className="p-1 text-gray-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* FOOTER ACTIONS */}
            <KButton onClick={onAdd} variant="primary" className="w-full py-2 bg-rose-600 border-rose-500 text-[10px]">
                <Plus size={12} className="mr-1" /> NEW LAYER
            </KButton>

        </div>
    );
}
