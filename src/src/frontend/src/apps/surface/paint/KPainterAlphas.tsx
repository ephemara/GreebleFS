
import React from 'react';
import { Stamp, Upload, Wand2, Loader2, Plus } from 'lucide-react';

export default function KPainterAlphas({ 
    alphas, 
    activeAlpha, 
    onSelect,
    handleGenerateAlpha,
    handleImportAlpha,
    isGeneratingAlpha,
    alphaPrompt,
    setAlphaPrompt
}: any) {
    return (
        <div className="space-y-3 pt-4 border-t border-[#222]">
            <div className="flex items-center gap-2 text-gray-500 font-bold text-[10px] uppercase tracking-widest mb-1">
                <Stamp size={10}/> Brush Tip (Alpha)
            </div>
            
            {/* GENERATOR / IMPORT */}
            <div className="bg-[#111] p-2 rounded border border-[#222] space-y-2">
                <div className="flex gap-1">
                    <input 
                        type="text" 
                        placeholder="Flux Generate..." 
                        className="flex-1 bg-[#0a0a0a] border border-[#333] rounded px-2 py-1 text-[9px] text-white focus:border-[#3daee9] outline-none"
                        value={alphaPrompt}
                        onChange={(e) => setAlphaPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateAlpha()}
                    />
                    <button 
                        onClick={handleGenerateAlpha} 
                        disabled={isGeneratingAlpha || !alphaPrompt}
                        className="bg-[#3daee9]/20 hover:bg-[#3daee9]/40 border border-[#3daee9]/50 text-[#3daee9] p-1.5 rounded disabled:opacity-50"
                    >
                        {isGeneratingAlpha ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                    </button>
                </div>
                <label className="flex items-center justify-center gap-2 w-full py-1.5 bg-[#161616] hover:bg-[#222] border border-[#333] rounded text-[9px] text-gray-400 cursor-pointer hover:text-white transition-colors">
                    <Upload size={10}/> UPLOAD ALPHA
                    <input type="file" onChange={handleImportAlpha} accept="image/*" className="hidden"/>
                </label>
            </div>

            {/* ALPHA GRID */}
            <div className="grid grid-cols-5 gap-1 max-h-32 overflow-y-auto custom-scrollbar p-1">
                {/* Reset / None Button */}
                <button 
                    onClick={() => onSelect(null)}
                    className={`aspect-square rounded border flex items-center justify-center transition-all ${!activeAlpha ? 'border-[#3daee9] bg-[#3daee9]/20 text-[#3daee9]' : 'border-[#333] bg-[#111] text-gray-600 hover:border-gray-500'}`}
                    title="Soft Round (Default)"
                >
                    <div className="w-2 h-2 bg-current rounded-full" />
                </button>
                
                {/* Alpha List */}
                {alphas && alphas.map((alpha: any, i: number) => {
                    // Check if current texture UUID matches (if it's a texture object) or URL matches
                    const isActive = activeAlpha && (activeAlpha === alpha.texture || activeAlpha.uuid === alpha.texture.uuid);
                    
                    return (
                        <button 
                            key={i}
                            onClick={() => onSelect(alpha)}
                            className={`aspect-square rounded border overflow-hidden relative group transition-all ${isActive ? 'border-[#3daee9] ring-1 ring-[#3daee9]' : 'border-[#333] bg-[#111] hover:border-white'}`}
                        >
                            {/* Invert rendering so white alpha looks correct on dark UI if needed, but usually alphas are b/w */}
                            <img src={alpha.preview || alpha.url} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
