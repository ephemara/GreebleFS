
import React from 'react';
import { Layers, Eye, EyeOff, Trash2, Box, MousePointer2, Combine, Merge } from 'lucide-react';

export default function KSculptLayers({ 
    layers, 
    activeLayerId, 
    setActiveLayerId, 
    toggleVisibility, 
    deleteLayer,
    mergeDown,
    mergeSelected,
    mergeAll,
    selectedLayerIds
}: any) {
    const selectedCount = selectedLayerIds.size;

    return (
        <div className="flex-1 flex flex-col min-h-0 border-t border-[#222]">
            <div className="bg-[#111] border-b border-[#222] flex flex-col">
                <div className="p-3 flex items-center justify-between">
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Layers size={10}/> SubTools ({layers.length})
                    </div>
                </div>
                
                {/* MERGE ACTIONS */}
                <div className="flex gap-1 px-2 pb-2">
                    <button 
                        onClick={mergeSelected}
                        disabled={selectedCount < 2}
                        className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${selectedCount >= 2 ? 'bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-900/50' : 'bg-[#1a1a1a] text-gray-600 border-transparent cursor-not-allowed'}`}
                        title="Merge Selected (Shift+Click to select)"
                    >
                        <Merge size={10}/> SELECTED ({selectedCount})
                    </button>
                    <button 
                        onClick={mergeAll}
                        disabled={layers.length < 2}
                        className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${layers.length >= 2 ? 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]' : 'bg-[#1a1a1a] text-gray-600 border-transparent cursor-not-allowed'}`}
                    >
                        <Combine size={10}/> MERGE ALL
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {layers.length === 0 && (
                    <div className="text-[9px] text-gray-600 text-center py-4 italic">No geometry loaded</div>
                )}
                
                {layers.map((layer: any, index: number) => {
                    const isActive = activeLayerId === layer.id;
                    const isSelected = selectedLayerIds.has(layer.id);
                    
                    return (
                        <div 
                            key={layer.id}
                            onClick={(e) => setActiveLayerId(layer.id, e.shiftKey)}
                            className={`
                                flex items-center gap-2 p-2 rounded cursor-pointer border transition-all
                                ${isActive 
                                    ? 'bg-[#222] border-orange-500/50' 
                                    : isSelected 
                                        ? 'bg-[#1a1a1a] border-orange-500/20' 
                                        : 'bg-transparent border-transparent hover:bg-[#161616]'
                                }
                            `}
                        >
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                                className={`p-1 rounded hover:bg-black ${layer.visible ? 'text-gray-400' : 'text-gray-700'}`}
                            >
                                {layer.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                                <div className={`text-[10px] font-bold truncate ${isActive ? 'text-white' : isSelected ? 'text-orange-200' : 'text-gray-400'}`}>
                                    {layer.name}
                                </div>
                                <div className="text-[8px] text-gray-600 font-mono">
                                    {layer.polyCount.toLocaleString()} polys
                                </div>
                            </div>

                            {isActive && <MousePointer2 size={10} className="text-orange-500"/>}
                            {isSelected && !isActive && <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50"/>}
                            
                            {index < layers.length - 1 && !isSelected && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); mergeDown(layer.id); }}
                                    className="p-1.5 rounded text-gray-600 hover:text-blue-400 hover:bg-black transition-colors"
                                    title="Merge Down"
                                >
                                    <Combine size={12}/>
                                </button>
                            )}

                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                                className="p-1.5 rounded text-gray-700 hover:text-red-400 hover:bg-black transition-colors"
                            >
                                <Trash2 size={12}/>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
