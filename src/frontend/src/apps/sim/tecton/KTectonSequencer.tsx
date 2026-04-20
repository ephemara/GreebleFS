
import React from 'react';
import {
    Play, Pause, SkipBack, Disc, Clock, Film, Layers,
    Repeat, ChevronRight, ChevronLeft
} from 'lucide-react';

export default function KTectonSequencer({
    isRecording, setIsRecording,
    isPlaying, setIsPlaying,
    playhead, setPlayhead,
    maxFrames, setMaxFrames,
    timeDilation, setTimeDilation,
    overwriteMode, setOverwriteMode,
    timelineRef,
    frameStats,
    onExportGLB,
    onExportZIP
}: any) {
    return (
        <div className="h-64 bg-[#080808] border-t border-[#1a1a1a] flex flex-col relative z-30 animate-in slide-in-from-bottom-10 duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] font-sans">

            {/* TOP BAR */}
            <div className="h-8 bg-[#050505] flex items-center justify-between px-4 border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-500 tracking-widest uppercase">
                    <Film size={12} /> Geo-Sequencer
                </div>
                <div className="text-[9px] text-gray-600 font-mono flex items-center gap-2">
                    <Layers size={10} />
                    BUFFER: {frameStats?.length || 0} /
                    <input
                        type="number" value={maxFrames}
                        onChange={(e) => setMaxFrames(Math.max(100, parseInt(e.target.value)))}
                        className="bg-transparent border-b border-gray-700 w-12 text-center text-emerald-400 focus:outline-none focus:border-emerald-500"
                    /> FRAMES
                </div>
            </div>

            {/* CONTROLS */}
            <div className="h-12 border-b border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsRecording(!isRecording)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all ${isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_#ef4444]' : 'bg-[#151515] border border-[#333] text-gray-400 hover:text-white hover:border-gray-500'}`}
                    >
                        <Disc size={12} className={isRecording ? "animate-pulse" : ""} />
                        {isRecording ? "REC" : "RECORD"}
                    </button>

                    <div className="h-6 w-px bg-[#222]"></div>

                    <div className="flex items-center gap-1">
                        <button onClick={() => setPlayhead(0)} className="p-2 hover:bg-[#222] rounded text-emerald-400 transition-colors"><SkipBack size={14} /></button>

                        <button onClick={() => {
                            setPlayhead(Math.max(0, playhead - 1));
                            setIsPlaying(false);
                        }} className="p-2 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-colors"><ChevronLeft size={14} /></button>

                        <button onClick={() => setIsPlaying(!isPlaying)} className={`p-2 rounded text-emerald-400 transition-all ${isPlaying ? 'bg-emerald-900/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'hover:bg-[#222]'}`}>
                            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                        </button>

                        <button onClick={() => {
                            setPlayhead(Math.min(playhead + 1, frameStats.length - 1));
                            setIsPlaying(false);
                        }} className="p-2 hover:bg-[#222] rounded text-gray-400 hover:text-white transition-colors"><ChevronRight size={14} /></button>

                        <button className="p-2 hover:bg-[#222] rounded text-gray-500 hover:text-white transition-colors opacity-50"><Repeat size={14} /></button>
                    </div>

                    <div className="h-6 w-px bg-[#222]"></div>

                    <div className="flex items-center gap-3 text-[10px] font-mono bg-[#050505] px-3 py-1.5 rounded border border-[#222]">
                        <span className="text-gray-500 font-bold">FRAME</span>
                        <span className="text-emerald-400 font-bold text-lg">{String(Math.floor(playhead)).padStart(4, '0')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Clock size={14} className="text-gray-600" />
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Playback Rate</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range" min="0.1" max="4.0" step="0.1"
                                    value={timeDilation} onChange={(e) => setTimeDilation(parseFloat(e.target.value))}
                                    className="w-24 h-1 bg-[#222] rounded appearance-none accent-emerald-500"
                                />
                                <span className="text-[9px] text-emerald-400 w-8 font-mono">{timeDilation.toFixed(1)}x</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-[#222]"></div>

                    <button onClick={() => setOverwriteMode(!overwriteMode)} className={`text-[9px] font-bold px-3 py-1.5 rounded border tracking-wider transition-all ${overwriteMode ? 'bg-red-900/20 border-red-500 text-red-400' : 'border-[#333] bg-[#151515] text-gray-500 hover:text-gray-300'}`}>
                        {overwriteMode ? 'OVERWRITE' : 'APPEND'}
                    </button>

                    <div className="h-6 w-px bg-[#222]"></div>

                    <div className="flex items-center gap-2">
                        <button onClick={onExportGLB} className="text-[9px] font-bold px-3 py-1.5 rounded bg-emerald-900/40 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2">
                            <Layers size={10} /> GLB
                        </button>
                        <button onClick={onExportZIP} className="text-[9px] font-bold px-3 py-1.5 rounded bg-[#151515] border border-[#333] text-gray-400 hover:text-white transition-all flex items-center gap-2">
                            <Layers size={10} /> ZIP
                        </button>
                    </div>
                </div>
            </div>

            {/* TIMELINE VISUALIZER */}
            <div className="flex-1 relative bg-[#050505] group overflow-hidden">
                {/* Grid */}
                <div className="absolute inset-0 flex justify-between px-2 opacity-20 pointer-events-none">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="w-px h-full bg-[#333]"></div>
                    ))}
                </div>

                <div className="absolute inset-0 top-2 bottom-2">
                    <canvas ref={timelineRef} width={1200} height={100} className="w-full h-full opacity-90 block" />
                </div>

                {/* Playhead */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-20 pointer-events-none shadow-[0_0_15px_#10b981]"
                    style={{ left: `${(playhead / maxFrames) * 100}%` }}
                >
                    <div className="absolute top-0 -left-1.5 w-4 h-4 bg-emerald-500 clip-path-polygon"></div>
                </div>

                {/* Scrubber Area */}
                <input
                    type="range"
                    min="0" max={maxFrames}
                    value={playhead}
                    onChange={(e) => {
                        setIsPlaying(false);
                        setIsRecording(false);
                        setPlayhead(parseFloat(e.target.value));
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
                />
            </div>

            <style>{`
                .clip-path-polygon {
                    clip-path: polygon(0% 0%, 100% 0%, 50% 100%);
                }
            `}</style>
        </div>
    );
}
