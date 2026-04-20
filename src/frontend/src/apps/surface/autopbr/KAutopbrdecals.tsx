
import React from 'react';
import { UploadCloud, Grip, Scaling, Sun } from 'lucide-react';

export default function KAutopbrdecals({ 
    decalImage, 
    handleDecalUpload, 
    params, 
    setParams, 
    sourceImage 
}: any) {
    if (!sourceImage) return null;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <Grip size={12}/> Decal Projection
            </div>

            <label className={`block w-full p-4 border border-dashed rounded hover:border-blue-500 transition cursor-pointer bg-[#111] text-center group ${decalImage ? 'border-blue-500/50' : 'border-[#333]'}`}>
                <input type="file" className="hidden" onChange={handleDecalUpload} accept="image/png,image/jpeg,image/webp"/>
                {decalImage ? (
                    <div className="flex flex-col items-center">
                        <img src={decalImage} className="h-16 object-contain mb-2 opacity-80" />
                        <span className="text-[8px] text-blue-400 font-bold uppercase">CLICK TO REPLACE</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-blue-400">
                        <UploadCloud size={20}/>
                        <span className="text-[10px] font-bold uppercase">UPLOAD DECAL (PNG)</span>
                    </div>
                )}
            </label>
            
            {decalImage && (
                <>
                    <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                        <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                            <span className="flex items-center gap-1"><Grip size={10}/> DENSITY (COUNT)</span> 
                            <span className="text-blue-400">{(params.decalCount*20).toFixed(0)}</span>
                        </div>
                        <input type="range" min="0" max="1.0" step="0.05" value={params.decalCount} onChange={e=>setParams({...params, decalCount: parseFloat(e.target.value)})} className="w-full h-1 bg-[#222] rounded appearance-none accent-blue-500"/>
                        <div className="text-[8px] text-gray-600 italic text-right">0 = Off</div>
                    </div>

                    <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                        <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                            <span className="flex items-center gap-1"><Scaling size={10}/> SCALE VARIANCE</span> 
                            <span className="text-blue-400">{(params.decalScale*100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min="0.1" max="2.0" step="0.1" value={params.decalScale} onChange={e=>setParams({...params, decalScale: parseFloat(e.target.value)})} className="w-full h-1 bg-[#222] rounded appearance-none accent-blue-500"/>
                    </div>

                    <div className="space-y-3 bg-[#111] p-3 rounded border border-[#222]">
                        <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                            <span className="flex items-center gap-1"><Sun size={10}/> OPACITY</span> 
                            <span className="text-blue-400">{(params.decalOpacity*100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min="0.1" max="1.0" step="0.05" value={params.decalOpacity} onChange={e=>setParams({...params, decalOpacity: parseFloat(e.target.value)})} className="w-full h-1 bg-[#222] rounded appearance-none accent-blue-500"/>
                    </div>
                </>
            )}
        </div>
    );
}
