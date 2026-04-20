
import React from 'react';
import { Layers, Plus, Eye, EyeOff, Trash2, PaintBucket } from 'lucide-react';

export default function KPainterLayers({ layers, activeLayerId, onAdd, onDelete, onToggle, onSelect, onFill }: any) {
    return (
        <div className="flex-1 flex flex-col min-h-0 border-b border-[#222]">
            <div className="p-3 border-b border-[#222] bg-[#1a1a1a] flex justify-between items-center">
                <div className="flex items-center gap-2 text-white font-bold text-xs tracking-wider">
                    <Layers size={14} className="text-[#3daee9]"/> LAYERS
                </div>
                <div className="flex gap-1">
                    <button onClick={onFill} className="text-gray-400 hover:text-white p-1 hover:bg-[#333] rounded" title="Fill Layer"><PaintBucket size={14}/></button>
                    <button onClick={onAdd} className="text-[#3daee9] hover:text-white p-1 hover:bg-[#333] rounded" title="Add Layer"><Plus size={14}/></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-[#111]">
                {layers.slice().reverse().map((l: any) => (
                    <div key={l.id} 
                         onClick={() => onSelect(l.id)}
                         className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-all ${activeLayerId === l.id ? 'bg-[#2b3036] border-[#3daee9]' : 'bg-[#16181b] border-transparent hover:bg-[#222]'}`}
                    >
                        <button onClick={(e) => { e.stopPropagation(); onToggle(l.id); }} className="text-gray-500 hover:text-white">
                            {l.visible ? <Eye size={14}/> : <EyeOff size={14}/>}
                        </button>
                        <div className="flex-1 text-[11px] font-medium text-gray-300 truncate">{l.name}</div>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(l.id); }} className="text-gray-600 hover:text-red-400 p-1">
                            <Trash2 size={12}/>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
