
import React from 'react';
import { Library, RefreshCw, Share2 } from 'lucide-react';

export default function KPainterMats({ projectMaterials, activeMaterial, onSelect, onChangeMesh, onExport }: any) {
    return (
        <div className="flex flex-col h-full bg-[#111]">
            {/* Header */}
            <div className="p-3 border-b border-[#222] bg-[#1a1a1a] shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white font-bold text-[10px] tracking-wider">
                        <Library size={12} className="text-[#3daee9]" /> MATERIALS
                    </div>
                    <div className="flex gap-1">
                        <button onClick={onChangeMesh} className="p-1 hover:bg-[#333] rounded text-gray-400 transition-colors" title="Change Mesh">
                            <RefreshCw size={12} />
                        </button>
                        <button onClick={onExport} className="p-1 hover:bg-[#3daee9]/20 rounded text-[#3daee9] transition-colors" title="Commit">
                            <Share2 size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Materials Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div className="grid grid-cols-3 gap-2">
                    {projectMaterials && projectMaterials.map((mat: any, i: number) => (
                        <div
                            key={i}
                            className="relative group flex-shrink-0 cursor-pointer"
                            title={mat.name}
                            onClick={() => onSelect(mat)}
                        >
                            <div className={`aspect-square rounded border-2 transition-all overflow-hidden ${activeMaterial?.id === mat.id ? 'border-[#3daee9] ring-2 ring-[#3daee9]/50 shadow-lg shadow-[#3daee9]/20' : 'border-[#444] hover:border-[#666]'}`}>
                                <img src={mat.preview} className="w-full h-full object-cover" alt={mat.name} />
                            </div>
                            <div className="text-[8px] text-gray-400 mt-1 truncate text-center">{mat.name}</div>
                        </div>
                    ))}
                </div>
                {(!projectMaterials || projectMaterials.length === 0) && (
                    <div className="text-[10px] text-gray-600 italic text-center py-8">No Materials Found</div>
                )}
            </div>
        </div>
    );
}
