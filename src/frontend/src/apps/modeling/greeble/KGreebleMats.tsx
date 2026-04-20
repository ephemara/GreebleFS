
import React from 'react';
import { Palette, Library, Loader2, Wand2, UploadCloud, Grid3X3, Trash2 } from 'lucide-react';

export default function KGreebleMats({
    materialLibrary,
    commitMaterial,
    removeMaterial,
    prompt,
    setPrompt,
    generating,
    handleGenerate,
    handleTextureUploadClick,
    handleTextureUpload,
    textureInputRef,
    matParams,
    setMatParams,
    layers,
    activeLayerId,
    downloadMap,
    downloadAll
}: any) {
    return (
        <div className="p-4 bg-[#0a0a0a] flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2 mb-4 text-emerald-600">
                <Palette size={16} /><h2 className="font-bold text-xs tracking-widest uppercase">PBR Material Lab</h2>
            </div>

            {materialLibrary.length > 0 && (
                <div className="mb-4">
                    <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Library size={10} /> History</h3>
                    <div className="grid grid-cols-4 gap-2">
                        {materialLibrary.map((mat: any) => (
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
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">AI Synthesizer</label>
                    <textarea className="w-full bg-[#0a0a0a] border border-[#222] rounded p-2 text-[10px] text-gray-300 focus:border-emerald-800 outline-none resize-none font-mono h-14 placeholder-gray-700" placeholder="e.g. Worn spaceship hull..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                    <button onClick={handleGenerate} disabled={generating || !prompt} className="w-full bg-emerald-800 hover:bg-emerald-700 text-white py-2 rounded font-bold text-[10px] flex items-center justify-center gap-2 disabled:opacity-50 tracking-widest shadow-lg">
                        {generating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} TRANSMUTE
                    </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#222]">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Custom Import</label>
                    <button onClick={handleTextureUploadClick} className="w-full py-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-dashed border-[#333] rounded text-[10px] font-bold text-gray-400 flex items-center justify-center gap-2"><UploadCloud size={12} /> UPLOAD TEXTURE</button>
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
                    <button onClick={() => setMatParams({ ...matParams, makeSeamless: !matParams.makeSeamless })} className={`w-full flex items-center justify-center gap-2 py-2 rounded text-[9px] font-bold border transition ${matParams.makeSeamless ? 'bg-green-900/20 border-green-900 text-green-500' : 'bg-[#0a0a0a] border-[#222] text-gray-600'}`}><Grid3X3 size={10} /> {matParams.makeSeamless ? 'SEAMLESS: ACTIVE' : 'SEAMLESS: INACTIVE'}</button>
                </div>

                {layers.find((l: any) => l.id === activeLayerId)?.texture && (
                    <div className="relative aspect-video rounded border border-[#222] overflow-hidden bg-black mt-2 shadow-lg shadow-emerald-900/10 group">
                        <img src={layers.find((l: any) => l.id === activeLayerId).texture} className="w-full h-full object-cover opacity-80" />
                        <div className="absolute bottom-0 w-full bg-black/80 text-[8px] text-emerald-500 text-center p-0.5 font-mono tracking-widest">MAT_INSTANCE_01</div>
                        <button
                            onClick={() => removeMaterial(activeLayerId)}
                            className="absolute top-2 right-2 p-1 bg-red-900/80 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove Material"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
