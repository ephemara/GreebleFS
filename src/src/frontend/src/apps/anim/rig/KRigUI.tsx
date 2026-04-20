
import React from 'react';
import {
    Bone, Activity, RefreshCw,
    Bot, Anchor, Layers, Copy, Zap,
    Maximize, Split, Check, Paintbrush, Sliders, Trash2,
    Play, Square, Move, RotateCw, Settings, MousePointer2
} from 'lucide-react';
import { KPanel, KSection, KButton, KSlider } from '../../../core/ui';

export default function KRigUI({
    meshLoaded,
    rigDetected,
    rigPrompt,
    setRigPrompt,
    handleGenerateRig,
    isGeneratingRig,
    spawnSkeleton,
    stripRig,
    bindRadius,
    setBindRadius,
    bindSkin,
    mode,
    setMode,
    ikEnabled,
    setIkEnabled,
    physicsEnabled,
    setPhysicsEnabled,
    physicsSettings,
    setPhysicsSettings,
    skeletonMap,
    selectBone,
    activeBoneId,
    // Weight Painting Props
    weightSettings,
    setWeightSettings,
    // Animation Props
    animations,
    isPlaying,
    handlePlayAnim,
    handleStopAnim,
    // New Props
    markerMode,
    markerCount,
    startMarkerPlacement,
    cancelMarkerPlacement,
    solveMarkers,
    dqsEnabled,
    setDqsEnabled
}: any) {
    return (
        <div className="w-80 bg-[#0f0f0f] border-r border-[#222] flex flex-col z-20 shadow-2xl h-full">
            {/* HEADER */}
            <div className="p-4 border-b border-[#222] bg-[#111]">
                <div className="flex items-center gap-2 text-violet-500 mb-1">
                    <Zap size={18} /><span className="font-black text-lg tracking-tighter">K-RIG</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="text-[9px] text-gray-500 tracking-[0.3em] font-mono">KIPP ENGINE 0.5 ALPHA</div>
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${meshLoaded ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-[9px] text-gray-500 font-bold">{meshLoaded ? (rigDetected ? 'RIGGED' : 'STATIC') : 'NO MESH'}</span>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex bg-[#1a1a1a] border-b border-[#222] shrink-0">
                <button onClick={() => setMode('SETUP')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${mode === 'SETUP' ? 'bg-[#111] text-violet-400 border-b-2 border-violet-500' : 'text-gray-500 hover:text-white'}`}>
                    <Settings size={12} /> SETUP
                </button>
                <button onClick={() => setMode('POSE')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${mode === 'POSE' ? 'bg-[#111] text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 hover:text-white'}`}>
                    <Move size={12} /> POSE
                </button>
                <button onClick={() => setMode('WEIGHTS')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${mode === 'WEIGHTS' ? 'bg-[#111] text-red-400 border-b-2 border-red-500' : 'text-gray-500 hover:text-white'}`}>
                    <Paintbrush size={12} /> WEIGHTS
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {mode === 'SETUP' && (
                    <div className="animate-in slide-in-from-left-4 space-y-6">
                        {rigDetected ? (
                            <div className="bg-[#161616] border border-green-900/30 rounded p-4 space-y-3">
                                <div className="text-[10px] font-bold text-green-400 flex items-center gap-2 uppercase tracking-wider">
                                    <Activity size={12} /> Active Rig
                                </div>
                                <div className="text-[9px] text-gray-400 leading-relaxed">
                                    Skeleton is bound and active. Switch to Pose mode to animate, or Weights mode to refine skinning.
                                </div>
                                <button
                                    onClick={stripRig}
                                    className="w-full py-2 bg-red-900/10 hover:bg-red-900/30 text-red-400 border border-red-900/30 rounded text-[9px] font-bold flex items-center justify-center gap-2 transition-all"
                                >
                                    <Trash2 size={12} /> DETACH SKELETON
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* 1. AUTO RIGGING (8-DOT) */}
                                <div className="bg-[#161616] border border-[#222] rounded p-3 space-y-3">
                                    <span className="text-[10px] font-bold text-violet-400 uppercase flex items-center gap-2 tracking-wider"><Bot size={12} /> Auto-Rig Solver</span>

                                    {!markerMode ? (
                                        <button
                                            onClick={startMarkerPlacement}
                                            disabled={!meshLoaded}
                                            className="w-full py-6 border-2 border-dashed border-[#333] hover:border-violet-500 rounded flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-violet-400 transition-all group disabled:opacity-50"
                                        >
                                            <MousePointer2 size={16} className="group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-bold">PLACE 8 MARKERS</span>
                                        </button>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-2">
                                                <span className="text-[9px] font-bold text-gray-400">MARKERS PLACED</span>
                                                <span className={`text-[10px] font-bold ${markerCount === 8 ? 'text-green-400' : 'text-violet-400'}`}>{markerCount} / 8</span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-1 bg-[#0a0a0a] rounded-full overflow-hidden">
                                                <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${(markerCount / 8) * 100}%` }}></div>
                                            </div>

                                            <div className="text-[9px] text-gray-400 italic text-center py-1">
                                                {markerCount === 0 && "Click CHIN position"}
                                                {markerCount === 1 && "Click LEFT WRIST"}
                                                {markerCount === 2 && "Click RIGHT WRIST"}
                                                {markerCount === 3 && "Click LEFT ELBOW"}
                                                {markerCount === 4 && "Click RIGHT ELBOW"}
                                                {markerCount === 5 && "Click LEFT KNEE"}
                                                {markerCount === 6 && "Click RIGHT KNEE"}
                                                {markerCount === 7 && "Click GROIN / HIPS"}
                                                {markerCount === 8 && "READY TO SOLVE"}
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={cancelMarkerPlacement} className="flex-1 py-1.5 bg-[#222] hover:bg-[#333] rounded text-[9px] text-gray-400">CANCEL</button>
                                                <button
                                                    onClick={solveMarkers}
                                                    disabled={markerCount < 8}
                                                    className="flex-1 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-[#222] disabled:text-gray-600 text-white rounded text-[9px] font-bold"
                                                >
                                                    SOLVE SKELETON
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. MANUAL SKELETON */}
                                <div className="space-y-3">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Bone size={12} /> Standard Rigs</div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => spawnSkeleton('BIPED')} disabled={!meshLoaded} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[#222] hover:border-violet-500 rounded text-[10px] text-gray-300 hover:text-white transition-all group disabled:opacity-50">
                                            <span>HUMANOID (BIPED)</span>
                                            <Bone size={12} className="text-gray-600 group-hover:text-violet-500" />
                                        </button>
                                        <button onClick={() => spawnSkeleton('UE5_MANNEQUIN')} disabled={!meshLoaded} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[#222] hover:border-violet-500 rounded text-[10px] text-gray-300 hover:text-white transition-all group disabled:opacity-50">
                                            <span>UE5 MANNEQUIN</span>
                                            <Bone size={12} className="text-gray-600 group-hover:text-violet-500" />
                                        </button>
                                        <button onClick={() => spawnSkeleton('QUADRUPED')} disabled={!meshLoaded} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[#222] hover:border-violet-500 rounded text-[10px] text-gray-300 hover:text-white transition-all group disabled:opacity-50">
                                            <span>QUADRUPED (CAT/DOG)</span>
                                            <Bone size={12} className="text-gray-600 group-hover:text-violet-500" />
                                        </button>
                                        <button onClick={() => spawnSkeleton('ROBOTIC_ARM')} disabled={!meshLoaded} className="flex items-center justify-between px-3 py-2 bg-[#161616] border border-[#222] hover:border-violet-500 rounded text-[10px] text-gray-300 hover:text-white transition-all group disabled:opacity-50">
                                            <span>MECHANICAL ARM</span>
                                            <Bone size={12} className="text-gray-600 group-hover:text-violet-500" />
                                        </button>
                                    </div>
                                </div>

                                {/* 3. BINDING */}
                                <div className="space-y-3 pt-4 border-t border-[#222]">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Layers size={12} /> Skin Binding</div>
                                    <div className="bg-[#161616] p-3 rounded border border-[#222] space-y-4">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 mb-1">INFLUENCE RADIUS <span className="text-violet-400">{bindRadius}</span></div>
                                            <input
                                                type="range" min="0.1" max="2.0" step="0.1"
                                                value={bindRadius} onChange={(e) => setBindRadius(parseFloat(e.target.value))}
                                                className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-violet-600"
                                            />
                                        </div>

                                        <button
                                            onClick={() => setDqsEnabled(!dqsEnabled)}
                                            className={`w-full py-1.5 text-[9px] font-bold border rounded flex items-center justify-center gap-2 transition-all ${dqsEnabled ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'bg-[#111] border-[#333] text-gray-500'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${dqsEnabled ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                                            DUAL QUATERNION SKINNING
                                        </button>

                                        <button
                                            onClick={bindSkin}
                                            disabled={mode === 'POSE' || skeletonMap.length === 0}
                                            className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded text-[9px] font-bold tracking-wider shadow-lg shadow-violet-900/20 disabled:opacity-50 disabled:shadow-none transition-all"
                                        >
                                            {mode === 'POSE' ? 'MESH BOUND' : 'BIND GEOMETRY'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {mode === 'POSE' && (
                    <div className="animate-in slide-in-from-right-4 space-y-6">
                        {/* IK SETTINGS */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-cyan-500 uppercase flex items-center gap-2 tracking-wider"><Anchor size={12} /> Kinematics</div>
                            <div className="bg-[#161616] p-3 rounded border border-[#222] space-y-3">
                                <button
                                    onClick={() => setIkEnabled(!ikEnabled)}
                                    className={`w-full py-2 text-[10px] font-bold rounded border transition-all flex items-center justify-center gap-2 ${ikEnabled ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'bg-[#111] border-[#333] text-gray-500'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${ikEnabled ? 'bg-cyan-400 shadow-[0_0_5px_cyan]' : 'bg-gray-600'}`}></div>
                                    FABRIK SOLVER {ikEnabled ? 'ACTIVE' : 'DISABLED'}
                                </button>
                                {ikEnabled && (
                                    <div className="text-[9px] text-gray-500 italic text-center">
                                        Full-body inverse kinematics enabled.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PHYSICS SETTINGS */}
                        <div className="space-y-3 pt-2 border-t border-[#222]">
                            <div className="text-[10px] font-bold text-violet-500 uppercase flex items-center gap-2 tracking-wider"><Zap size={12} /> Dynamic Physics</div>
                            <div className="bg-[#161616] p-3 rounded border border-[#222] space-y-3">
                                <button
                                    onClick={() => setPhysicsEnabled(!physicsEnabled)}
                                    className={`w-full py-2 text-[10px] font-bold rounded border transition-all flex items-center justify-center gap-2 ${physicsEnabled ? 'bg-violet-900/20 border-violet-500 text-violet-400' : 'bg-[#111] border-[#333] text-gray-500'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${physicsEnabled ? 'bg-violet-400 shadow-[0_0_5px_violet]' : 'bg-gray-600'}`}></div>
                                    PHYSICS {physicsEnabled ? 'ACTIVE' : 'OFF'}
                                </button>

                                {physicsEnabled && (
                                    <div className="space-y-2 pt-2">
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 mb-1">STIFFNESS <span className="text-violet-400">{physicsSettings?.stiffness || 0.2}</span></div>
                                            <input
                                                type="range" min="0.01" max="1.0" step="0.01"
                                                value={physicsSettings?.stiffness || 0.2}
                                                onChange={(e) => setPhysicsSettings({ ...physicsSettings, stiffness: parseFloat(e.target.value) })}
                                                className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-violet-600"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[9px] text-gray-400 mb-1">DAMPING <span className="text-violet-400">{physicsSettings?.drag || 0.95}</span></div>
                                            <input
                                                type="range" min="0.5" max="0.99" step="0.01"
                                                value={physicsSettings?.drag || 0.95}
                                                onChange={(e) => setPhysicsSettings({ ...physicsSettings, drag: parseFloat(e.target.value) })}
                                                className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-violet-600"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ANIMATION LIST */}
                        {animations && animations.length > 0 && (
                            <div className="space-y-3">
                                <div className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><Activity size={12} /> Animation Clips</div>
                                <div className="bg-[#161616] p-3 rounded border border-[#222] space-y-2">
                                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#222]">
                                        <span className="text-[9px] text-gray-500 font-bold">{isPlaying ? "PLAYING..." : "READY"}</span>
                                        <button
                                            onClick={handleStopAnim}
                                            className="p-1 hover:bg-[#333] rounded text-red-400 transition-colors"
                                        >
                                            <Square size={12} />
                                        </button>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                        {animations.map((anim: string) => (
                                            <button
                                                key={anim}
                                                onClick={() => handlePlayAnim(anim)}
                                                className="w-full text-left px-2 py-2 bg-[#0a0a0a] hover:bg-[#222] rounded text-[9px] font-mono text-gray-400 hover:text-white flex items-center gap-2 transition-all border border-transparent hover:border-[#333]"
                                            >
                                                <Play size={10} /> {anim}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {mode === 'WEIGHTS' && (
                    <div className="animate-in slide-in-from-left-4 space-y-6">
                        <div className="bg-[#161616] p-4 rounded border border-red-900/30 space-y-4">
                            <div className="text-[10px] font-bold text-red-400 flex items-center gap-2 uppercase tracking-wider mb-2"><Paintbrush size={12} /> Weight Painting</div>

                            <div>
                                <div className="flex justify-between text-[9px] text-gray-400 mb-1">BRUSH RADIUS <span className="text-red-400">{weightSettings.radius}</span></div>
                                <input
                                    type="range" min="0.05" max="1.0" step="0.05"
                                    value={weightSettings.radius} onChange={(e) => setWeightSettings({ ...weightSettings, radius: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-red-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-[9px] text-gray-400 mb-1">INTENSITY <span className="text-orange-400">{weightSettings.intensity}</span></div>
                                <input
                                    type="range" min="0.05" max="1.0" step="0.05"
                                    value={weightSettings.intensity} onChange={(e) => setWeightSettings({ ...weightSettings, intensity: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-orange-500"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setWeightSettings({ ...weightSettings, subtract: false })}
                                    className={`flex-1 py-2 rounded text-[9px] font-bold border transition-all ${!weightSettings.subtract ? 'bg-red-600 text-white border-red-600' : 'bg-[#111] border-[#333] text-gray-500'}`}
                                >
                                    ADD
                                </button>
                                <button
                                    onClick={() => setWeightSettings({ ...weightSettings, subtract: true })}
                                    className={`flex-1 py-2 rounded text-[9px] font-bold border transition-all ${weightSettings.subtract ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#111] border-[#333] text-gray-500'}`}
                                >
                                    SUBTRACT
                                </button>
                            </div>
                        </div>
                        <div className="text-[9px] text-gray-600 italic px-2 text-center">
                            Select a bone below to paint its influence map.
                        </div>
                    </div>
                )}

                {/* HIERARCHY LIST */}
                {skeletonMap.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-[#222]">
                        <div className="text-[10px] font-bold text-gray-500 uppercase flex justify-between tracking-wider">
                            <span>Joint Hierarchy</span>
                            <span className="text-gray-600">{skeletonMap.length} BONES</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto pr-1 space-y-0.5 custom-scrollbar bg-[#161616] p-2 rounded border border-[#222]">
                            {skeletonMap.map((b: any) => (
                                <button
                                    key={b.id}
                                    onClick={() => selectBone(b.id)}
                                    className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono flex items-center gap-2 transition-all ${activeBoneId === b.name ? 'bg-violet-900/40 text-violet-100 border-l-2 border-violet-400' : 'text-gray-500 hover:bg-[#222] hover:text-gray-300'}`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${activeBoneId === b.name ? 'bg-violet-400' : 'bg-gray-700'}`}></div>
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
