

import { Palette, Library, UploadCloud, Grid3X3 } from 'lucide-react';

export default function KGreebleMats({
    materialLibrary = [],
    commitMaterial,
    handleTextureUploadClick,
    handleTextureUpload,
    textureInputRef,
    matParams,
    setMatParams,
    layers,
    activeLayerId
}: any) {
    // Safety check: ensure materialLibrary is always an array
    const safeMaterialLibrary = Array.isArray(materialLibrary) ? materialLibrary : [];
    
    return (
        <div className="p-4 bg-[#0a0a0a] flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Palette size={16} /><h2 className="font-bold text-xs tracking-widest uppercase">PBR Material Lab</h2>
            </div>

            {safeMaterialLibrary.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Library size={10} /> History</h3>
                    <div className="grid grid-cols-4 gap-2">
                        {safeMaterialLibrary.map((mat: any) => (
                            <button
                                key={mat.id}
                                onClick={() => commitMaterial(mat.sourceImg, mat.name)}
                                className="relative aspect-square rounded border border-[#222] overflow-hidden hover:border-emerald-500 transition-all group"
                                title={mat.name}
                            >
                                <img src={mat.texture} className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-[#161616] p-3 rounded border border-[#222] space-y-4">
                <div className="space-y-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Import Texture</label>
                    <button onClick={handleTextureUploadClick} className="w-full py-3 bg-emerald-800 hover:bg-emerald-700 border border-emerald-900 rounded text-[10px] font-bold text-white flex items-center justify-center gap-2 tracking-widest shadow-lg"><UploadCloud size={12} /> UPLOAD TEXTURE</button>
                    <input type="file" ref={textureInputRef} onChange={handleTextureUpload} accept="image/*" className="hidden" />
                </div>

                <div className="space-y-3 pt-2 border-t border-[#222]">
                    <div><div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">SCALE (UV)</div><input type="range" min="0.1" max="5.0" step="0.1" value={matParams.scale} onChange={e => setMatParams({ ...matParams, scale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-white" /></div>
                    <div><div className="flex justify-between text-[9px] text-purple-400 font-bold mb-1">NORMAL STRENGTH</div><input type="range" min="0.001" max="5.0" step="0.001" value={matParams.normalStrength} onChange={e => setMatParams({ ...matParams, normalStrength: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-purple-900" /></div>
                    <div><div className="flex justify-between text-[9px] text-orange-400 font-bold mb-1">ROUGHNESS</div><input type="range" min="0.1" max="3" step="0.1" value={matParams.roughnessContrast} onChange={e => setMatParams({ ...matParams, roughnessContrast: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-orange-900" /></div>
                    <div><div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">METALNESS</div><input type="range" min="-100" max="100" step="1" value={matParams.metalBias} onChange={e => setMatParams({ ...matParams, metalBias: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-gray-500" /></div>
                    <div><div className="flex justify-between text-[9px] text-yellow-600 font-bold mb-1">GRUNGE</div><input type="range" min="0" max="0.5" step="0.01" value={matParams.wear} onChange={e => setMatParams({ ...matParams, wear: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-yellow-700" /></div>
                    <div><div className="flex justify-between text-[9px] text-pink-600 font-bold mb-1">HUE SHIFT</div><input type="range" min="0" max="360" step="1" value={matParams.hue} onChange={e => setMatParams({ ...matParams, hue: parseInt(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-800" /></div>
                    <div><div className="flex justify-between text-[9px] text-blue-400 font-bold mb-1">DISPLACEMENT <span className="text-gray-500">{matParams.displacementScale === 0 ? "(OFF)" : matParams.displacementScale.toFixed(2)}</span></div><input type="range" min="0" max="0.5" step="0.01" value={matParams.displacementScale || 0} onChange={e => setMatParams({ ...matParams, displacementScale: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-blue-800" /></div>
                    <button onClick={() => setMatParams({ ...matParams, doubleSided: !matParams.doubleSided })} className={`w-full flex items-center justify-center gap-2 py-2 rounded text-[9px] font-bold border transition ${matParams.doubleSided ? 'bg-indigo-900/20 border-indigo-900 text-indigo-400' : 'bg-[#0a0a0a] border-[#222] text-gray-600'}`}><Grid3X3 size={10} /> {matParams.doubleSided ? 'SIDE: DOUBLE' : 'SIDE: SINGLE'}</button>
                    <button onClick={() => setMatParams({ ...matParams, makeSeamless: !matParams.makeSeamless })} className={`w-full flex items-center justify-center gap-2 py-2 rounded text-[9px] font-bold border transition ${matParams.makeSeamless ? 'bg-green-900/20 border-green-900 text-green-500' : 'bg-[#0a0a0a] border-[#222] text-gray-600'}`}><Grid3X3 size={10} /> {matParams.makeSeamless ? 'SEAMLESS: ACTIVE' : 'SEAMLESS: INACTIVE'}</button>
                </div>

                {layers.find((l: any) => l.id === activeLayerId)?.texture && (
                    <div className="relative aspect-video rounded border border-[#222] overflow-hidden bg-black mt-2 shadow-lg shadow-emerald-900/10">
                        <img src={layers.find((l: any) => l.id === activeLayerId).texture} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute bottom-0 w-full bg-black/80 text-[8px] text-emerald-500 text-center p-0.5 font-mono tracking-widest">MAT_INSTANCE_01</div>
                    </div>
                )}
            </div>
        </div>
    );
}
