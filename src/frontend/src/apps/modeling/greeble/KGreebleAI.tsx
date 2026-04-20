
import React from 'react';
import { Terminal, Cpu, Loader2, Radio } from 'lucide-react';

export default function KGreebleAI({ 
    architectPrompt, 
    setArchitectPrompt, 
    executeArchitectProtocol, 
    isArchitecting 
}: any) {
    return (
        <section className="flex flex-col h-full">
             <div className="text-[10px] font-bold text-purple-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                 <Terminal size={12}/> Architect Protocol
             </div>
             <div className="bg-[#161616] border border-purple-900/30 rounded-xl p-4 flex flex-col gap-4 flex-1">
                 <div className="text-[10px] text-gray-400 font-mono leading-relaxed">
                    <span className="text-purple-400">System:</span> AI architect 0.1 pre alpha.<br/>
                    <span className="text-purple-400">System:</span> Layers & Physics Enabled.<br/>
                    <span className="text-gray-500 italic">Try: "vast planetary system with a red supergiant in the middle", "lush jungle with complex geometry", "scatter rocks", "detailed medieval house"</span>
                 </div>
                 <div className="space-y-2 mt-auto">
                    <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
                        <Cpu size={10}/> Live Input
                    </label>
                    <textarea 
                        className="w-full bg-[#0a0a0a] border border-purple-900/30 rounded p-3 text-[10px] text-purple-200 focus:border-purple-500 outline-none resize-none font-mono h-24 placeholder-purple-900/50" 
                        placeholder="Describe object to fabricate..." 
                        value={architectPrompt} 
                        onChange={(e) => setArchitectPrompt(e.target.value)}
                    />
                    <button 
                        onClick={executeArchitectProtocol} 
                        disabled={isArchitecting || !architectPrompt} 
                        className="w-full bg-purple-900/20 hover:bg-purple-900/40 text-purple-400 border border-purple-900/50 py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 disabled:opacity-50 tracking-widest shadow-lg uppercase transition-all"
                    >
                        {isArchitecting ? <Loader2 size={12} className="animate-spin"/> : <Radio size={12}/>} 
                        {isArchitecting ? 'FABRICATING...' : 'GENERATE'}
                    </button>
                 </div>
             </div>
         </section>
    );
}
