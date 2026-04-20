import React from 'react';
import { X } from 'lucide-react';

export default function KGraphosMaterialMenu({ visible, position, projectMaterials, activeMaterial, setActiveMaterial, onSelect, setMaterialMode }: any) {
    if (!visible) return null;

    const handleMaterialSelect = (mat: any) => {
        setActiveMaterial(mat);
        setMaterialMode(true); // Auto-activate material mode
        if (onSelect) onSelect();
    };

    const style = {
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
    };

    return (
        <div
            className="fixed z-[9999] pointer-events-auto"
            style={style}
        >
            <div className="bg-[#0a0a0a] border-2 border-rose-500/50 rounded-xl shadow-2xl shadow-rose-900/50 backdrop-blur-xl p-4 min-w-[400px]">
                {/* Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#222]">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                            PBR Material Browser
                        </span>
                    </div>
                    <button
                        onClick={() => onSelect && onSelect()}
                        className="p-1 hover:bg-[#222] rounded transition-all text-gray-500 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Material Grid */}
                {projectMaterials && projectMaterials.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {projectMaterials.map((mat: any) => (
                            <button
                                key={mat.id}
                                onClick={() => handleMaterialSelect(mat)}
                                className={`group relative aspect-square rounded-lg border overflow-hidden transition-all ${activeMaterial?.id === mat.id
                                        ? 'border-rose-500 ring-2 ring-rose-500/50 scale-95'
                                        : 'border-[#333] hover:border-rose-400 hover:scale-95'
                                    }`}
                                title={mat.name}
                            >
                                <img
                                    src={mat.preview}
                                    className="w-full h-full object-cover"
                                    alt={mat.name}
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="text-[8px] font-bold text-white truncate">{mat.name}</div>
                                </div>
                                {activeMaterial?.id === mat.id && (
                                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-black" />
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-[10px] text-gray-600 italic">No PBR Materials Available</div>
                        <div className="text-[8px] text-gray-700 mt-1">Generate materials in the Material tab</div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-3 pt-2 border-t border-[#222]">
                    <div className="text-[7px] text-gray-600 text-center">
                        Press <kbd className="px-1 py-0.5 bg-[#222] rounded text-rose-400">M</kbd> to close
                    </div>
                </div>
            </div>
        </div>
    );
}
