import React, { useRef } from 'react';
import {
    Activity, Zap, Terminal, Layers,
    Play, Pause, RefreshCw, Cpu, Grid,
    Settings2, Maximize, Focus, Orbit,
    Aperture, Wind, Droplet, Flame, Disc,
    Network, Binary, CircleDot, Microscope,
    Image as ImageIcon, Upload, Music, Sliders,
    ShieldBan, RotateCcw, Ghost, Film, Video, StopCircle,
    FileJson as FileJsonIcon, Package as PackageIcon, Download, FileVideo, Atom, Infinity as InfinityIcon, Magnet,
    GitMerge, Radio, ArrowUp, Sun, Share2, Grid2x2, Sparkles
} from 'lucide-react';
import { useChronos } from './ChronosContext';
import { useChronosExport } from './ChronosExport';
import ChronosEngine from './ChronosEngine';

export default function ChronosUI() {
    const {
        status,
        activeTab, setActiveTab,
        simRes, setSimRes,
        mode, setMode,
        speed, setSpeed,
        chaos, setChaos,
        damping, setDamping,
        userScript, setUserScript,
        compileStatus,
        isScriptActive, setIsScriptActive,
        pointSize, setPointSize,
        opacity, setOpacity,
        colorHex, setColorHex,
        color2Hex, setColor2Hex,
        colorMode, setColorMode,
        gradientStrength, setGradientStrength,
        highFidelity, setHighFidelity,
        autoOrbit, setAutoOrbit,
        recResolution, setRecResolution,
        recQuality, setRecQuality,
        recFormat, setRecFormat,
        isRecording,
        isRecordingVAT,
        isRecordingSequence,
        processingProgress,
        engineRef
    } = useChronos();

    const {
        handleCommit,
        toggleRecording,
        toggleVATRecording,
        toggleSequenceRecording
    } = useChronosExport();

    // Helper to trigger compile on engine
    const handleCompile = () => {
        if (engineRef.current && engineRef.current.compileShader) {
            engineRef.current.compileShader();
        }
    };

    const resetCamera = () => { if (engineRef.current) { engineRef.current.camera.position.set(0, 30, 60); engineRef.current.controls.target.set(0, 0, 0); engineRef.current.controls.update(); } };

    return (
        <div className="flex w-full h-screen bg-black text-[#00ffcc] font-mono overflow-hidden select-none">

            {/* LEFT CONTROL DECK */}
            <div className="w-80 bg-[#050505] border-r border-[#00ffcc]/20 flex flex-col z-10 shadow-2xl">
                <div className="p-4 border-b border-[#00ffcc]/20 bg-[#0a0a0a]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 border border-[#00ffcc] rounded bg-[#00ffcc]/10">
                            <Activity size={18} className="animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black tracking-wider text-white">K-CHRONOS <span className="text-[#00ffcc]">GENESIS</span></h1>
                            <div className="text-[9px] text-gray-500 tracking-[0.2em]">0.5 ALPHA</div>
                        </div>
                    </div>
                </div>

                <div className="flex border-b border-[#00ffcc]/20 bg-[#080808]">
                    <button onClick={() => setActiveTab('core')} className={`flex-1 py-3 text-[9px] font-bold tracking-wider hover:bg-[#00ffcc]/10 ${activeTab === 'core' ? 'text-[#00ffcc] border-b-2 border-[#00ffcc] bg-[#00ffcc]/5' : 'text-gray-600'}`}>CORE</button>
                    <button onClick={() => setActiveTab('mods')} className={`flex-1 py-3 text-[9px] font-bold tracking-wider hover:bg-[#00ffcc]/10 ${activeTab === 'mods' ? 'text-[#00ffcc] border-b-2 border-[#00ffcc] bg-[#00ffcc]/5' : 'text-gray-600'}`}>MODS</button>
                    <button onClick={() => setActiveTab('export')} className={`flex-1 py-3 text-[9px] font-bold tracking-wider hover:bg-[#00ffcc]/10 ${activeTab === 'export' ? 'text-[#00ffcc] border-b-2 border-[#00ffcc] bg-[#00ffcc]/5' : 'text-gray-600'}`}>EXPORT</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">

                    {activeTab === 'core' && (
                        <>
                            <div className="space-y-3">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Cpu size={12} /> Simulation Core</div>

                                {/* RESOLUTION */}
                                <div className="grid grid-cols-4 gap-1">
                                    {[128, 512, 1024, 2048, 4096, 8192].map(r => (
                                        <button key={r} onClick={() => setSimRes(r)} className={`py-1 text-[9px] border rounded transition-all ${simRes === r ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'border-[#222] text-gray-500 hover:text-white'}`}>
                                            {r >= 1024 ? (r / 1024) + 'K' : r}
                                        </button>
                                    ))}
                                </div>

                                {/* MODES */}
                                <div className="space-y-1">
                                    <label className="text-[9px] text-[#00ffcc]/50">PHYSICS MODEL</label>
                                    <div className="grid grid-cols-1 gap-1">
                                        {[
                                            { id: 0, label: 'ZERO-POINT FIELD (STABLE)', icon: Grid },
                                            { id: 1, label: 'KERR BLACK HOLE', icon: CircleDot },
                                            { id: 2, label: 'ION STORM', icon: Wind },
                                            { id: 3, label: 'GALAXY SPIRAL DENSITY', icon: Atom },
                                            { id: 4, label: 'LORENZ ATTRACTOR', icon: InfinityIcon },
                                            { id: 5, label: 'VAN ALLEN BELT', icon: Magnet },
                                            { id: 6, label: 'AIZAWA ATTRACTOR', icon: Activity },
                                            { id: 7, label: 'BINARY STAR (ROCHE)', icon: GitMerge },
                                            { id: 8, label: 'QUASAR JET', icon: Radio },
                                            { id: 9, label: 'SUPERNOVA REMNANT', icon: Sun },
                                            { id: 10, label: 'ALCUBIERRE WARP', icon: ArrowUp },
                                            { id: 11, label: 'SOLAR PROMINENCE', icon: Flame },
                                            { id: 12, label: 'QUANTUM FOAM', icon: Droplet },
                                            { id: 13, label: 'CYBERPUNK CITY', icon: Grid2x2 },
                                            { id: 14, label: 'DNA HELIX', icon: Activity },
                                            { id: 15, label: 'BLACK HOLE (V2)', icon: CircleDot },
                                        ].map(m => (
                                            <button key={m.id} onClick={() => setMode(m.id)} className={`p-2 text-left text-[10px] border rounded flex items-center gap-2 ${mode === m.id ? 'border-[#00ffcc] bg-[#00ffcc]/10 text-[#00ffcc]' : 'border-[#222] text-gray-500'}`}>
                                                <m.icon size={12} /> {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 2. CONSTANTS */}
                            <div className="space-y-3 pt-4 border-t border-[#222]">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Sliders size={12} /> Global Constants</div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-gray-400"><span>SPEED</span><span>{speed.toFixed(1)}</span></div>
                                    <input type="range" min="0" max="3" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-full accent-[#00ffcc] h-1 bg-gray-800 rounded" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-gray-400"><span>ENTROPY (CHAOS)</span><span>{chaos.toFixed(1)}</span></div>
                                    <input type="range" min="0" max="2" step="0.1" value={chaos} onChange={e => setChaos(parseFloat(e.target.value))} className="w-full accent-[#00ffcc] h-1 bg-gray-800 rounded" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-gray-400"><span>DAMPING (FRICTION)</span><span>{damping.toFixed(3)}</span></div>
                                    <input type="range" min="0.8" max="0.99" step="0.001" value={damping} onChange={e => setDamping(parseFloat(e.target.value))} className="w-full accent-[#00ffcc] h-1 bg-gray-800 rounded" />
                                </div>
                            </div>

                            {/* 3. OPTICS (ADVANCED COLOR SYSTEM) */}
                            <div className="space-y-3 pt-4 border-t border-[#222]">
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Aperture size={12} /> Optics</div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-gray-400"><span>PARTICLE SIZE</span><span>{pointSize.toFixed(1)}</span></div>
                                    <input type="range" min="0.1" max="10" step="0.1" value={pointSize} onChange={e => setPointSize(parseFloat(e.target.value))} className="w-full accent-[#00ffcc] h-1 bg-gray-800 rounded" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] text-gray-400"><span>OPACITY</span><span>{opacity.toFixed(2)}</span></div>
                                    <input type="range" min="0.1" max="1.0" step="0.01" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))} className="w-full accent-[#00ffcc] h-1 bg-gray-800 rounded" />
                                </div>

                                {/* DUAL COLOR SYSTEM */}
                                <div className="space-y-2 pt-2 border-t border-[#222]">
                                    <div className="text-[9px] text-gray-400">COLOR GRADIENT</div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 space-y-1">
                                            <div className="text-[8px] text-gray-500">PRIMARY</div>
                                            <input type="color" value={colorHex} onChange={e => setColorHex(e.target.value)} className="w-full h-6 bg-transparent border border-[#333] rounded cursor-pointer" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="text-[8px] text-gray-500">SECONDARY</div>
                                            <input type="color" value={color2Hex} onChange={e => setColor2Hex(e.target.value)} className="w-full h-6 bg-transparent border border-[#333] rounded cursor-pointer" />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                        {['SOLID', 'VELOCITY', 'POSITION', 'ANGLE'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setColorMode(m)}
                                                className={`flex-1 py-1 text-[7px] border rounded ${colorMode === m ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'border-[#333] text-gray-500'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    {colorMode !== 'SOLID' && (
                                        <div className="space-y-1 pt-1 animate-in fade-in">
                                            <div className="flex justify-between text-[8px] text-gray-500"><span>GRADIENT STRENGTH</span><span>{gradientStrength.toFixed(1)}</span></div>
                                            <input type="range" min="0" max="2" step="0.1" value={gradientStrength} onChange={e => setGradientStrength(parseFloat(e.target.value))} className="w-full accent-[#00ffcc] h-1 bg-gray-800 rounded" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'mods' && (
                        <div className="space-y-4 animate-in slide-in-from-left-4">
                            <div className="border border-[#00ffcc]/30 rounded bg-[#00ffcc]/5 overflow-hidden">
                                <div className="p-3 flex items-center justify-between bg-black/40 border-b border-[#00ffcc]/20">
                                    <div className="flex items-center gap-2 text-[#00ffcc] text-[10px] font-bold"><Terminal size={12} /> GLSL INJECTOR</div>
                                    <div className={`text-[8px] font-mono ${compileStatus === 'COMPILED' ? 'text-green-500' : compileStatus === 'READY' ? 'text-gray-500' : 'text-yellow-500'}`}>{compileStatus}</div>
                                </div>
                                <textarea
                                    className="w-full h-40 bg-black text-[#00ffcc] text-[10px] font-mono p-3 outline-none resize-none border-none leading-relaxed"
                                    value={userScript}
                                    onChange={e => setUserScript(e.target.value)}
                                    spellCheck={false}
                                />
                                <div className="p-2 bg-black/40 border-t border-[#00ffcc]/20 flex justify-between items-center">
                                    <div className="text-[8px] text-gray-500 font-mono">VARS: <span className="text-white">p, v, t</span></div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setIsScriptActive(!isScriptActive)} className={`px-3 py-1.5 border border-[#00ffcc]/50 text-[9px] font-bold rounded transition-all ${isScriptActive ? 'bg-[#00ffcc] text-black' : 'bg-transparent text-[#00ffcc]'}`}>{isScriptActive ? 'ACTIVE' : 'ENABLE'}</button>
                                        <button onClick={handleCompile} className="px-3 py-1.5 bg-[#00ffcc]/10 hover:bg-[#00ffcc]/30 border border-[#00ffcc]/50 hover:text-white text-[#00ffcc] text-[9px] font-bold rounded transition-all flex items-center gap-2"><Zap size={10} /> INJECT</button>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[9px] text-[#00ffcc]/50 font-mono">
                                <p className="mb-2">EXAMPLES:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setUserScript("force.y += sin(p.x * 2.0 + t) * 0.5;")} className="p-2 border border-[#222] hover:border-[#00ffcc] rounded text-left">Sine Wave</button>
                                    <button onClick={() => setUserScript("force += cross(normalize(p), vec3(0,1,0));")} className="p-2 border border-[#222] hover:border-[#00ffcc] rounded text-left">Vortex</button>
                                    <button onClick={() => setUserScript("force -= normalize(p) * (sin(t*10.0)*2.0);")} className="p-2 border border-[#222] hover:border-[#00ffcc] rounded text-left">Pulse</button>
                                    <button onClick={() => setUserScript("force += curl(p.x*0.1, p.y*0.1, t*0.5);")} className="p-2 border border-[#222] hover:border-[#00ffcc] rounded text-left">Curl Noise</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'export' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            <div className="border border-[#00ffcc]/30 rounded p-4 bg-[#00ffcc]/5">
                                <div className="flex items-center gap-2 text-xs font-bold text-[#00ffcc] mb-3"><Film size={14} /> CINEMA RECORDING</div>

                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    {/* RESOLUTION */}
                                    <div className="space-y-1">
                                        <div className="text-[8px] text-[#00ffcc]/50 uppercase tracking-wider">Resolution</div>
                                        <div className="grid grid-cols-2 gap-1">
                                            {['WINDOW', '1080p', '4K', '8K'].map(r => (
                                                <button key={r} onClick={() => setRecResolution(r)} className={`py-1 text-[8px] border rounded ${recResolution === r ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'border-[#00ffcc]/30 text-[#00ffcc]'}`}>{r}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* QUALITY */}
                                    <div className="space-y-1">
                                        <div className="text-[8px] text-[#00ffcc]/50 uppercase tracking-wider">Quality</div>
                                        <div className="flex flex-col gap-1">
                                            {['HIGH', 'ULTRA', 'LOSSLESS'].map(q => (
                                                <button key={q} onClick={() => setRecQuality(q)} className={`py-1 px-2 text-[8px] border rounded text-left ${recQuality === q ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'border-[#00ffcc]/30 text-[#00ffcc]'}`}>{q}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* FORMAT SELECTOR */}
                                <div className="mb-4 space-y-1">
                                    <div className="text-[8px] text-[#00ffcc]/50 uppercase tracking-wider">Format Container</div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['WEBM', 'MP4', 'MOV'].map(f => (
                                            <button key={f} onClick={() => setRecFormat(f)} className={`py-1 text-[8px] border rounded ${recFormat === f ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'border-[#00ffcc]/30 text-[#00ffcc]'}`}>
                                                .{f.toLowerCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button onClick={toggleRecording} className={`w-full py-3 border font-bold text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${isRecording ? 'border-white text-white bg-red-600 animate-pulse' : 'border-[#00ffcc] text-[#00ffcc] hover:bg-[#00ffcc] hover:text-black'}`}>
                                    {isRecording ? <StopCircle size={16} /> : <Video size={16} />} {isRecording ? 'STOP RECORDING' : 'START CAPTURE'}
                                </button>
                            </div>

                            <div className="space-y-2">
                                <button onClick={toggleVATRecording} className={`w-full py-3 border ${isRecordingVAT ? 'border-red-500 text-red-500' : 'border-[#00ffcc]/50 text-[#00ffcc]'} text-[10px] font-bold flex items-center justify-center gap-2`}>
                                    <FileJsonIcon size={12} /> {isRecordingVAT ? 'STOP VAT' : 'RECORD VAT (TEXTURE)'}
                                </button>
                                {isRecordingVAT && <div className="w-full bg-[#222] h-1 rounded overflow-hidden"><div className="h-full bg-red-500 transition-all" style={{ width: `${processingProgress}%` }} /></div>}

                                <button onClick={toggleSequenceRecording} className={`w-full py-3 border ${isRecordingSequence ? 'border-red-500 text-red-500' : 'border-[#00ffcc]/50 text-[#00ffcc]'} text-[10px] font-bold flex items-center justify-center gap-2`}>
                                    <PackageIcon size={12} /> {isRecordingSequence ? 'STOP SEQ' : 'RECORD SEQUENCE (GLB)'}
                                </button>
                                {isRecordingSequence && <div className="w-full bg-[#222] h-1 rounded overflow-hidden"><div className="h-full bg-red-500 transition-all" style={{ width: `${processingProgress}%` }} /></div>}
                            </div>
                        </div>
                    )}

                </div>
            </div >

            {/* VIEWPORT */}
            <div className="flex-1 relative bg-black cursor-crosshair">
                <ChronosEngine />

                {/* KIPP UPLINK */}
                <button onClick={handleCommit} className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#000]/80 backdrop-blur-md border border-[#00ffcc]/50 text-[#00ffcc] px-8 py-3 rounded-full font-bold text-xs tracking-[0.2em] shadow-[0_0_30px_rgba(0,255,204,0.2)] hover:bg-[#00ffcc] hover:text-black hover:shadow-[0_0_50px_rgba(0,255,204,0.6)] transition-all duration-300 flex items-center gap-3 group overflow-hidden">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    <Share2 size={16} className="group-hover:rotate-12 transition-transform" /> UPLINK SNAPSHOT
                </button>

                {/* HUD */}
                <div className="absolute top-6 left-6 pointer-events-none">
                    <div className="text-[10px] font-bold text-[#00ffcc] flex items-center gap-2"><Terminal size={12} /> SYSTEM STATUS: NOMINAL</div>
                    <div className="text-[9px] text-[#00ffcc]/50 mt-1">{(simRes * simRes).toLocaleString()} PARTICLES // FPS: UNLOCKED</div>
                </div>

                {/* CONTROLS */}
                <div className="absolute top-6 right-6 flex gap-2">
                    <button onClick={() => setHighFidelity(!highFidelity)} className={`p-2 bg-black/50 border border-[#00ffcc]/30 rounded hover:bg-[#00ffcc] hover:text-black transition-all ${highFidelity ? 'text-[#00ffcc] border-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.5)]' : 'text-gray-500'}`} title="HIGH FIDELITY MODE"><Sparkles size={14} /></button>
                    <button onClick={resetCamera} className="p-2 bg-black/50 border border-[#00ffcc]/30 text-[#00ffcc] rounded hover:bg-[#00ffcc] hover:text-black transition-all" title="RESET CAMERA"><Focus size={14} /></button>
                    <button onClick={() => setAutoOrbit(!autoOrbit)} className={`p-2 bg-black/50 border border-[#00ffcc]/30 rounded hover:bg-[#00ffcc] hover:text-black transition-all ${autoOrbit ? 'text-[#00ffcc] border-[#00ffcc]' : 'text-gray-500'}`} title="AUTO ORBIT"><Orbit size={14} /></button>
                </div>
            </div>

        </div>
    );
}
