
import React from 'react';
import { Film, Move, SkipBack, Play, Pause, Clock, Timer, Gamepad2, Key, Trash2 } from 'lucide-react';

export default function KGreebleAnimation({
    selectedObjectUUID,
    transformData,
    updateTransformFromUI,
    animTime,
    animDuration,
    setAnimDuration,
    isPlaying,
    togglePlay,
    stopPlay,
    handleTimelineScrub,
    handleSliderChange,
    handleSliderUp,
    keyframes,
    handleAddKeyframe,
    handleDeleteKeyframe,
    targetFPS,
    setTargetFPS
}: any) {
    return (
        <>
            {/* SIDEBAR CONTENT */}
            <section className="flex flex-col h-full">
                 <div className="text-[10px] font-bold text-pink-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                     <Film size={12}/>K-Sequencer 0.1 Pre Alpha
                 </div>
                 
                 <div className="bg-[#161616]/50 border border-pink-900/30 rounded-xl p-4 flex flex-col gap-4">
                     {selectedObjectUUID ? (
                        <>
                           <div className="text-[10px] font-bold text-blue-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                               <Move size={12}/> Keyframe Matrix
                           </div>
                           <div className="space-y-4">
                               <div className="pb-3 mb-3 border-b border-[#ffffff10] text-[10px] text-blue-300 italic text-center flex items-center justify-center gap-2 bg-blue-900/10 rounded p-2">
                                   <span>Auto-Keying: <strong className="text-white">ACTIVE</strong></span>
                               </div>
                               {['X','Y','Z'].map(axis => ( 
                                   <div key={`pos${axis}`}>
                                       <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">POS {axis} <span className="text-blue-400">{transformData[`pos${axis}`].toFixed(2)}</span></div>
                                       <div className="flex gap-2">
                                           <input type="range" min="-100" max="100" step="0.1" value={transformData[`pos${axis}`]} onChange={(e)=>updateTransformFromUI(`pos${axis}`,parseFloat(e.target.value))} className="flex-1 h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-blue-600"/>
                                           <input type="number" value={transformData[`pos${axis}`]} onChange={(e)=>updateTransformFromUI(`pos${axis}`,parseFloat(e.target.value))} className="w-12 bg-black border border-blue-900 text-[9px] text-center text-blue-200"/>
                                       </div>
                                   </div>
                               ))}
                               <div className="h-px bg-[#ffffff10] my-2"></div>
                               {['X','Y','Z'].map(axis => ( 
                                   <div key={`rot${axis}`}>
                                       <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">ROT {axis} <span className="text-green-400">{((transformData[`rot${axis}`]*180)/Math.PI).toFixed(0)}°</span></div>
                                       <input type="range" min="0" max={Math.PI*2} step="0.1" value={transformData[`rot${axis}`]} onChange={(e)=>updateTransformFromUI(`rot${axis}`,parseFloat(e.target.value))} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-green-500"/>
                                   </div>
                               ))}
                               <div className="h-px bg-[#ffffff10] my-2"></div>
                               {['X','Y','Z'].map(axis => ( 
                                   <div key={`scale${axis}`}>
                                       <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">SCALE {axis} <span className="text-purple-400">{transformData[`scale${axis}`].toFixed(2)}</span></div>
                                       <input type="range" min="0.1" max="50.0" step="0.1" value={transformData[`scale${axis}`]} onChange={(e)=>updateTransformFromUI(`scale${axis}`,parseFloat(e.target.value))} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-purple-600"/>
                                   </div>
                               ))}
                           </div>
                        </>
                     ) : (
                        <div className="text-[10px] text-gray-500 text-center italic py-4">Select an object to animate</div>
                     )}
                 </div>
             </section>
        </>
    );
}

export function KGreebleTimeline({
    animTime,
    animDuration,
    setAnimDuration,
    isPlaying,
    togglePlay,
    stopPlay,
    handleSliderChange,
    handleSliderUp,
    keyframes,
    selectedObjectUUID,
    handleAddKeyframe,
    handleDeleteKeyframe,
    targetFPS,
    setTargetFPS,
    style
}: any) {
    return (
        <div 
            className="absolute bottom-6 h-32 bg-[#050505]/80 backdrop-blur-xl border border-[#333] rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 z-50"
            style={style}
        >
             <div className="flex items-center justify-between p-2 border-b border-[#333] bg-[#0a0a0a]/50">
                 <div className="flex items-center gap-2">
                     <button onClick={stopPlay} className="text-gray-400 hover:text-white p-1"><SkipBack size={14}/></button>
                     <button onClick={togglePlay} className={`text-white w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlaying?'bg-red-500 hover:bg-red-600':'bg-green-500 hover:bg-green-600'}`}>{isPlaying?<Pause size={14}/>:<Play size={14} className="ml-0.5"/>}</button>
                     <div className="text-[10px] font-mono text-pink-400 ml-2 bg-black/40 px-2 py-1 rounded border border-pink-900/30">{animTime.toFixed(2)}s / {animDuration}s</div>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                         <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1"><Clock size={10}/> FPS</span>
                         <select value={targetFPS} onChange={(e)=>setTargetFPS(parseInt(e.target.value))} className="bg-[#0a0a0a] border border-[#333] rounded text-[9px] text-pink-400 focus:border-pink-500 outline-none px-1 py-1 cursor-pointer hover:bg-[#1a1a1a]">
                             <option value="24">24</option>
                             <option value="30">30</option>
                             <option value="60">60</option>
                             <option value="120">120</option>
                         </select>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1"><Timer size={10}/> DUR</span>
                         <input type="number" min="0.1" max="300" step="0.1" value={animDuration} onChange={(e) => setAnimDuration(parseFloat(e.target.value) || 1)} className="w-12 bg-[#0a0a0a] border border-[#333] rounded text-[9px] text-center text-pink-400 focus:border-pink-500 outline-none py-1"/>
                    </div>
                 </div>
             </div>
             
             <div className="flex-1 relative group cursor-ew-resize bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" onMouseDown={handleSliderChange} onMouseMove={(e) => {if(e.buttons === 1) handleSliderChange(e)}} onMouseUp={handleSliderUp}>
                 <div className="absolute inset-0 w-full h-full">
                     {/* Grid Lines */}
                     <div className="absolute inset-0 flex justify-between px-2 opacity-10 pointer-events-none">
                         {[...Array(10)].map((_, i) => <div key={i} className="w-px h-full bg-white"/>)}
                     </div>

                     {/* Playhead Line */}
                     <div className="absolute top-0 bottom-0 w-0.5 bg-pink-500 z-20 pointer-events-none shadow-[0_0_10px_#ec4899]" style={{left: `${(animTime/animDuration)*100}%`}}>
                         <div className="w-3 h-3 bg-pink-500 rotate-45 -ml-[5px] -mt-1.5 border border-white"></div>
                     </div>
                     
                     {/* Keyframes */}
                     {selectedObjectUUID && keyframes[selectedObjectUUID]?.map((k: any, i: number) => (
                         <div key={i} className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-400 border border-black rotate-45 z-10 hover:scale-150 transition-transform cursor-pointer" style={{left: `${(k.t/animDuration)*100}%`}} title={`Keyframe ${i+1} at ${k.t.toFixed(2)}s`}></div>
                     ))}
                     
                     {/* Click Area Input (Invisible but handles interaction) */}
                     <input 
                       type="range" 
                       min="0" 
                       max={animDuration} 
                       step="0.01" 
                       value={animTime} 
                       onChange={handleSliderChange}
                       className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-ew-resize" 
                     />
                 </div>
             </div>
             
             {selectedObjectUUID && (
                 <div className="p-2 border-t border-[#333] flex justify-between bg-[#0a0a0a]/80 items-center">
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-2"><Gamepad2 size={12}/> Target: <span className="text-white">{selectedObjectUUID.substring(0,8)}...</span></span>
                    <div className="flex gap-2">
                        <button onClick={handleAddKeyframe} className="bg-pink-900/40 hover:bg-pink-600 text-pink-200 px-3 py-1 rounded text-[9px] font-bold flex items-center gap-1 border border-pink-900 transition-colors shadow-lg"><Key size={10}/> KEYFRAME</button>
                        <button onClick={handleDeleteKeyframe} className="bg-red-900/20 hover:bg-red-600 text-red-400 px-3 py-1 rounded text-[9px] font-bold flex items-center gap-1 border border-red-900/50 transition-colors"><Trash2 size={10}/> DELETE KEY</button>
                    </div>
                 </div>
             )}
         </div>
    );
}
