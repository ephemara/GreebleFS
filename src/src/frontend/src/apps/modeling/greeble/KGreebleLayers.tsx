
import React from 'react';
import { Layers, Plus, Eye, EyeOff, Maximize, Files, Trash2, Merge, Combine } from 'lucide-react';

export default function KGreebleLayers({
  layers,
  activeLayerId,
  setActiveLayerId,
  addLayer,
  duplicateLayer,
  deleteLayer,
  toggleVisibility,
  selectLayerObject,
  selectedLayerIds,
  handleMergeSelected,
  handleMergeAll,
  removeMaterial
}: any) {
  const selectedCount = selectedLayerIds ? selectedLayerIds.size : 0;
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-[#222] bg-[#111]/50 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-xs tracking-widest text-gray-300 flex items-center gap-2"><Layers size={14} /> STRATA</h2>
          <button onClick={addLayer} className="p-1 hover:bg-[#222] rounded text-emerald-500"><Plus size={14} /></button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleMergeSelected}
            disabled={selectedCount < 2}
            className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${selectedCount >= 2 ? 'bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-900/50' : 'bg-[#1a1a1a] text-gray-600 border-transparent cursor-not-allowed'}`}
          >
            <Merge size={10} /> MERGE ({selectedCount})
          </button>
          <button
            onClick={handleMergeAll}
            disabled={layers.length < 2}
            className={`flex-1 py-1 rounded text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${layers.length >= 2 ? 'bg-[#1a1a1a] text-gray-400 border-[#333] hover:text-white hover:bg-[#222]' : 'bg-[#1a1a1a] text-gray-600 border-transparent cursor-not-allowed'}`}
          >
            <Combine size={10} /> MERGE ALL
          </button>
        </div>
      </div>
      <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar flex-1">
        {layers.map((l: any) => {
          const isSelected = selectedLayerIds?.has(l.id);
          const isActive = activeLayerId === l.id;
          return (
            <div key={l.id} onClick={(e) => setActiveLayerId(l.id, e.shiftKey)} className={`flex items-center gap-2 p-2 rounded cursor-pointer border ${isActive ? 'bg-[#1a1a1a]/80 border-emerald-500/30' : isSelected ? 'bg-[#1a1a1a]/50 border-orange-500/30' : 'border-transparent hover:bg-[#161616]/50'}`}>
              <button onClick={(e) => { e.stopPropagation(); toggleVisibility(l.id); }} className="text-gray-600 hover:text-gray-300">{l.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              <div className="w-3 h-3 rounded-full border border-[#333]" style={{ background: l.color }}></div>
              <span className={`text-xs flex-1 ${activeLayerId === l.id ? 'text-white font-bold' : 'text-gray-400'}`}>{l.name}</span>

              {l.texture && (
                <div className="flex items-center gap-1 bg-[#222] px-1.5 py-0.5 rounded border border-[#333]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[8px] text-gray-400 font-mono">MAT</span>
                  <button onClick={(e) => { e.stopPropagation(); removeMaterial(l.id); }} className="text-gray-500 hover:text-red-400 ml-1"><Trash2 size={8} /></button>
                </div>
              )}

              <button onClick={(e) => { e.stopPropagation(); selectLayerObject(l.id); }} className="text-gray-600 hover:text-blue-400 mr-1" title="Target Stratum"><Maximize size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); duplicateLayer(l.id); }} className="text-gray-600 hover:text-green-400 mr-1" title="Clone Stratum"><Files size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }} className="text-gray-600 hover:text-red-400" title="Destroy Stratum"><Trash2 size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
