
import React from 'react';
import { Layers, Eye, EyeOff, Trash2, Plus, Move, Sliders } from 'lucide-react';

export default function KGraphosLayers({ 
    layers, 
    activeLayerId, 
    setActiveLayerId, 
    onAdd, 
    onDelete, 
    onToggleVisibility,
    onOpacityChange
}: any) {
    
    const handleVisClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleVisibility(id, false); 
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(id);
    };

    return (
        <div className="flex flex-col h-full">
            {/* HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-[#222] mb-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12}/> Layer Stack
                </div>
                <button 
                    onClick={onAdd}
                    className="p-1.5 bg-rose-900/20 hover:bg-rose-900/40 border border-rose-500/50 text-rose-400 rounded transition-all hover:scale-105"
                    title="New Layer"
                >
                    <Plus size={14}/>
                </button>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                {layers.slice().reverse().map((layer: any) => (
                    <div 
                        key={layer.id}
                        onClick={() => setActiveLayerId(layer.id)}
                        className={`
                            group flex flex-col p-2 rounded border cursor-pointer transition-all
                            ${activeLayerId === layer.id 
                                ? 'bg-[#1a1a1a] border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
                                : 'bg-[#0f0f0f] border-transparent hover:border-[#333]'
                            }
                        `}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <button 
                                    onClick={(e) => handleVisClick(e, layer.id)}
                                    className={`text-gray-500 hover:text-white transition-colors ${!layer.visible && 'opacity-50'}`}
                                    title="Toggle Visibility"
                                >
                                    {layer.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                                </button>
                                <span className={`text-[10px] font-bold truncate ${activeLayerId === layer.id ? 'text-white' : 'text-gray-400'}`}>
                                    {layer.name}
                                </span>
                            </div>
                            <button 
                                onClick={(e) => handleDeleteClick(e, layer.id)}
                                className="text-gray-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            >
                                <Trash2 size={12}/>
                            </button>
                        </div>

                        {/* Layer Controls (Visible on Active) */}
                        {activeLayerId === layer.id && (
                            <div 
                                className="flex items-center gap-2 px-1 animate-in fade-in slide-in-from-top-1 duration-200" 
                                onClick={(e) => e.stopPropagation()} // Stop clicking slider from selecting layer again
                                onPointerDown={(e) => e.stopPropagation()} // Stop dragging slider from painting on canvas
                            >
                                <span className="text-[8px] text-gray-600 font-bold w-8">OPACITY</span>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.01"
                                    value={layer.opacity ?? 1.0}
                                    onChange={(e) => onOpacityChange(layer.id, parseFloat(e.target.value))}
                                    className="flex-1 h-1 bg-[#222] rounded-lg appearance-none accent-rose-500 cursor-pointer"
                                />
                                <span className="text-[8px] text-rose-400 w-6 text-right">
                                    {Math.round((layer.opacity ?? 1.0) * 100)}%
                                </span>
                            </div>
                        )}
                    </div>
                ))}
                
                {layers.length === 0 && (
                    <div className="text-center py-8 text-[10px] text-gray-700 italic border-2 border-dashed border-[#222] rounded">
                        No Layers Active
                    </div>
                )}
            </div>
            
            {/* FOOTER INFO */}
            <div className="pt-3 mt-2 border-t border-[#222] flex justify-between text-[9px] text-gray-600 font-mono">
                <span>{layers.length} LAYERS</span>
                <span>'S' TO SOLO</span>
            </div>
        </div>
    );
}
