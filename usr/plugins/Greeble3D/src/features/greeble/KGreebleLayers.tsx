

import { Layers, Plus, Eye, EyeOff, Maximize, Files, Trash2 } from 'lucide-react';

export default function KGreebleLayers({
  layers,
  activeLayerId,
  setActiveLayerId,
  addLayer,
  duplicateLayer,
  deleteLayer,
  toggleVisibility,
  selectLayerObject
}: any) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden border-b border-[#222] max-h-48">
      <div className="p-3 border-b border-[#222] bg-[#111] flex justify-between items-center">
        <h2 className="font-bold text-xs tracking-widest text-gray-300 flex items-center gap-2"><Layers size={14} /> STRATA</h2>
        <button onClick={addLayer} className="p-1 hover:bg-[#222] rounded text-emerald-500"><Plus size={14} /></button>
      </div>
      <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar flex-1 bg-[#080808]">
        {layers.map((l: any) => (
          <div key={l.id} onClick={() => setActiveLayerId(l.id)} className={`flex items-center gap-2 p-2 rounded cursor-pointer border ${activeLayerId === l.id ? 'bg-[#1a1a1a] border-emerald-500/30' : 'border-transparent hover:bg-[#161616]'}`}>
            <button onClick={(e) => { e.stopPropagation(); toggleVisibility(l.id); }} className="text-gray-600 hover:text-gray-300">{l.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
            <div className="w-3 h-3 rounded-full border border-[#333]" style={{ background: l.color }}></div><span className={`text-xs flex-1 ${activeLayerId === l.id ? 'text-white font-bold' : 'text-gray-400'}`}>{l.name}</span>
            <button onClick={(e) => { e.stopPropagation(); selectLayerObject(l.id); }} className="text-gray-600 hover:text-blue-400 mr-1" title="Target Stratum"><Maximize size={12} /></button>
            <button onClick={(e) => { e.stopPropagation(); duplicateLayer(l.id); }} className="text-gray-600 hover:text-green-400 mr-1" title="Clone Stratum"><Files size={12} /></button>
            <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id); }} className="text-gray-600 hover:text-red-400" title="Destroy Stratum"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
