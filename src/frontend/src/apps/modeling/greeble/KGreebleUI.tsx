
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
    Rocket, Sun, Orbit, Plus, MousePointer2, BrainCircuit, Film, Move,
    ClipboardCopy, Trash2, Zap, Activity, MonitorPlay, Expand,
    Download, Settings, Share2, Layers, HardDrive, Copy, Eye, EyeOff,
    Crosshair, LayoutGrid, CircleDot, Grid, RotateCcw, Anchor, Network, Dna, Box,
    GripVertical, ChevronLeft, ChevronRight, Hammer, Circle, Square, Scaling, Paintbrush, Maximize, Minimize2, UploadCloud,
    Combine, CopyPlus
} from 'lucide-react';
import KGreeblePrimitives from './KGreeblePrimitives';
import KGreebleAI from './KGreebleAI';
import KGreebleAnimation, { KGreebleTimeline } from './KGreebleAnimation';
import KGreebleLayers from './KGreebleLayers';
import KGreebleMats from './KGreebleMats';
import KGreebleBrushMenu from './KGreebleBrushMenu';
import { KPanel } from '../../../core/ui';
import { KHDRWidget } from '../../../core/ui/widgets/KHDRWidget';
import { usePython } from '../../../core/hooks/usePython';

export default function KGreebleUI({
    mode, setMode,
    buildTab, setBuildTab,
    activeShape, setActiveShape,
    architectPrompt, setArchitectPrompt, isArchitecting, executeArchitectProtocol,
    selectedObjectUUID, transformData, updateTransformFromUI,
    animTime, animDuration, setAnimDuration, isPlaying, togglePlay, stopPlay,
    handleTimelineScrub, handleSliderChange, handleSliderUp, keyframes,
    handleAddKeyframe, handleDeleteKeyframe, targetFPS, setTargetFPS,
    layers, activeLayerId, setActiveLayerId, addLayer, duplicateLayer, deleteLayer, toggleVisibility, selectLayerObject,
    materialLibrary, commitMaterial, removeMaterial, prompt, setPrompt, generating, handleGenerate,
    handleTextureUploadClick, handleTextureUpload, textureInputRef, matParams, setMatParams, downloadMap, downloadAll,
    sunIntensity, setSunIntensity, sunAngle, setSunAngle,
    handleUndo, handleClear,
    handleChaosScatter, handleGlitch, handleDuplicateObject, handleDeleteSelected,
    targetEngine, setTargetEngine, mergeOnExport, setMergeOnExport, includeBase, setIncludeBase, handleExport,
    neonMode, setNeonMode, toggleFullscreen,
    mountRef,
    handleMouseDown, handleMouseMove, handleMouseUp,
    resetCamera, resetSim,
    simRes,
    sharedState, loadFromStorage,
    spaceMenuOpen, spaceMenuPos,
    surfaceMode, setSurfaceMode,
    symmetry, setSymmetry,
    radialCount, setRadialCount,
    gridLock, setGridLock, gridSize, setGridSize,
    voidAnchor, setVoidAnchor,
    chaosMode, setChaosMode,
    fractalEcho, setFractalEcho,
    sculptSettings, setSculptSettings,
    sculptTool, setSculptTool,
    sculptColor, setSculptColor,
    // NEW PROPS
    gizmoMode, setGizmoMode,
    transformSpace, setTransformSpace,
    snapEnabled, setSnapEnabled,
    selectedLayerIds, handleMergeSelected, handleMergeAll,
    // BRUSH MENU PROPS
    isBrushMenuOpen, setIsBrushMenuOpen, brushMenuPos, setBrushMenuPos,
    // NEW FEATURES
    autoKey, setAutoKey,
    altOrbit, setAltOrbit,
    motionTrail, setMotionTrail,
    chaosTrack, setChaosTrack,
    rayTracing, setRayTracing,
    physicsSettings, setPhysicsSettings,
    proceduralSettings, setProceduralSettings,
    easingType, setEasingType,
    onBakePhysics,
    onTogglePhysics,
    onDropSelected,
    onDropAll,
    // HDR Widget Props passed down
    scene, renderer, onHDRActive,


    groundSize, setGroundSize,
    // MODIFIERS PROPS
    modifierMode, setModifierMode,
    handleBooleanOp,
    handleArrayOp,
    arrayParams, setArrayParams,
    booleanTargetUUID,
    isPickingBooleanTarget,
    zenShellMode = 'standalone'
}: any) {
    const [activeRightTab, setActiveRightTab] = useState('layers');
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';

    // --- PYTHON BRIDGE ---
    const { callScript, loading: pythonLoading } = usePython();
    const [spawnerParams, setSpawnerParams] = useState({
        pattern: 'sphere',
        count: 100,
        size: 0.5
    });
    const [parametricFormula, setParametricFormula] = useState('torus');

    const handleSpawnCubes = async () => {
        if (!scene) return;
        console.log(`🎲 Spawning ${spawnerParams.count} cubes in ${spawnerParams.pattern} pattern...`);

        try {
            const result: any = await callScript('procedural_spawner', 'cube_explosion', {
                count: spawnerParams.count,
                radius: 10.0,
                cube_size: spawnerParams.size,
                pattern: spawnerParams.pattern
            });

            if (result && result.cubes) {
                console.log(`✅ Python returned ${result.cubes.length} cubes!`);

                // Spawn each cube in the scene
                result.cubes.forEach((cubeData: any, idx: number) => {
                    const geometry = new THREE.BoxGeometry(cubeData.scale[0], cubeData.scale[1], cubeData.scale[2]);
                    const material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color().setHSL(idx / result.cubes.length, 0.8, 0.5),
                        metalness: 0.3,
                        roughness: 0.7
                    });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(cubeData.position[0], cubeData.position[1], cubeData.position[2]);
                    cube.rotation.set(cubeData.rotation[0], cubeData.rotation[1], cubeData.rotation[2]);
                    cube.castShadow = true;
                    cube.receiveShadow = true;

                    // Add to layer
                    const activeLayer = layers.find((l: any) => l.id === activeLayerId);
                    if (activeLayer && activeLayer.group) {
                        activeLayer.group.add(cube);
                        activeLayer.objects.push({ uuid: cube.uuid, name: `Cube_${idx}` });
                    }
                });

                console.log('🎉 Cubes spawned! Enable physics and drop them!');
            }
        } catch (err) {
            console.error('❌ Cube spawn failed:', err);
        }
    };

    const handleSpawnParametric = async () => {
        if (!scene) return;
        console.log(`🌀 Generating ${parametricFormula} surface...`);

        try {
            const result: any = await callScript('procedural_spawner', 'parametric_mesh', {
                formula: parametricFormula,
                resolution: 30
            });

            if (result && result.vertices && result.faces) {
                console.log(`✅ Python returned mesh: ${result.vertex_count} verts, ${result.face_count} faces`);

                // Build Three.js geometry
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(result.vertices.flat());
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                const indices = new Uint32Array(result.faces.flat());
                geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                geometry.computeVertexNormals();

                const material = new THREE.MeshStandardMaterial({
                    color: 0x00ffcc,
                    metalness: 0.6,
                    roughness: 0.4,
                    side: THREE.DoubleSide
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;

                // Add to layer
                const activeLayer = layers.find((l: any) => l.id === activeLayerId);
                if (activeLayer && activeLayer.group) {
                    activeLayer.group.add(mesh);
                    activeLayer.objects.push({ uuid: mesh.uuid, name: parametricFormula.toUpperCase() });
                }

                console.log('🎉 Parametric mesh spawned!');
            }
        } catch (err) {
            console.error('❌ Parametric spawn failed:', err);
        }
    };

    // Collapsing State
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);

    const BRUSHES = [
        { id: 'SELECT', icon: MousePointer2, label: 'SELECT' },
        { id: 'CLAY', icon: Circle, label: 'CLAY' },
        { id: 'ERODE', icon: Minimize2, label: 'ERODE' },
        { id: 'MOVE', icon: Move, label: 'MOVE' },
        { id: 'SMOOTH', icon: Activity, label: 'SMOOTH' },
        { id: 'FLATTEN', icon: Square, label: 'FLATTEN' },
        { id: 'INFLATE', icon: Maximize, label: 'INFLATE' },
        { id: 'PAINT', icon: Paintbrush, label: 'PAINT' },
        { id: 'STRETCH', icon: Scaling, label: 'STRETCH' },
        { id: 'NOISE', icon: Zap, label: 'NOISE' },
    ];

    return (
        <div className={`flex w-full h-full text-gray-200 font-sans overflow-hidden select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#151515]'}`}>
            {/* BRUSH MENU */}
            {!isViewportHost && (
            <KGreebleBrushMenu
                visible={isBrushMenuOpen}
                position={brushMenuPos}
                activeTool={sculptTool}
                onSelect={(tool: string) => {
                    setSculptTool(tool);
                    setIsBrushMenuOpen(false);
                }}
            />
            )}

            {/* SPACE MODIFIER MENU */}
            {!isViewportHost && spaceMenuOpen && (
                <div
                    className="fixed z-[100] bg-[#111]/95 border border-emerald-500/50 rounded-xl p-4 shadow-[0_0_60px_rgba(16,185,129,0.2)] backdrop-blur-xl flex flex-col gap-4 w-72 animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
                    style={{ left: spaceMenuPos.x + 20, top: spaceMenuPos.y - 20 }}
                >
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest border-b border-emerald-900/50 pb-2 flex items-center gap-2">
                        <LayoutGrid size={12} /> MODIFIERS
                    </div>

                    {/* SYMMETRY MATRIX */}
                    <div className="space-y-2">
                        <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1"><CircleDot size={10} /> Symmetry Matrix</div>
                        <div className="grid grid-cols-4 gap-1">
                            <button onClick={() => setSymmetry('none')} className={`py-1.5 rounded text-[8px] font-bold border transition-all ${symmetry === 'none' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>NONE</button>
                            <button onClick={() => setSymmetry('x')} className={`py-1.5 rounded text-[8px] font-bold border transition-all ${symmetry === 'x' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>X-AXIS</button>
                            <button onClick={() => setSymmetry('z')} className={`py-1.5 rounded text-[8px] font-bold border transition-all ${symmetry === 'z' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>Z-AXIS</button>
                            <button onClick={() => setSymmetry('radial')} className={`py-1.5 rounded text-[8px] font-bold border transition-all ${symmetry === 'radial' ? 'bg-emerald-900/30 border-emerald-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>RADIAL</button>
                        </div>
                    </div>

                    {symmetry === 'radial' && (
                        <div className="space-y-1 animate-in slide-in-from-top-2">
                            <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                                <span>COUNT</span> <span className="text-emerald-400">{radialCount}</span>
                            </div>
                            <input
                                type="range" min="3" max="24" step="1"
                                value={radialCount}
                                onChange={(e) => setRadialCount(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-emerald-500"
                            />
                        </div>
                    )}

                    {/* SPATIAL CONSTRAINTS */}
                    <div className="space-y-2 pt-2 border-t border-[#222]">
                        <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1"><Anchor size={10} /> Spatial Constraints</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setGridLock(!gridLock)}
                                className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-1 transition-all ${gridLock ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                            >
                                <Grid size={10} /> GRID LOCK
                            </button>
                            <button
                                onClick={() => setSurfaceMode(!surfaceMode)}
                                className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-1 transition-all ${surfaceMode ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                            >
                                <Layers size={10} /> SURFACE
                            </button>
                        </div>

                        {gridLock && (
                            <div className="flex items-center gap-2 animate-in fade-in">
                                <span className="text-[8px] text-gray-500 font-bold w-8">SIZE</span>
                                <input
                                    type="range" min="0.1" max="5.0" step="0.1"
                                    value={gridSize}
                                    onChange={(e) => setGridSize(parseFloat(e.target.value))}
                                    className="flex-1 h-1 bg-[#222] rounded-lg appearance-none accent-blue-500"
                                />
                                <span className="text-[8px] text-blue-400 w-6 text-right">{gridSize}</span>
                            </div>
                        )}

                        <button
                            onClick={() => setVoidAnchor(!voidAnchor)}
                            className={`w-full py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-2 transition-all ${voidAnchor ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                        >
                            <RotateCcw size={10} /> VOID ANCHOR (WORLD UP)
                        </button>
                        <button
                            onClick={() => setAltOrbit(!altOrbit)}
                            className={`w-full py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-2 transition-all ${altOrbit ? 'bg-yellow-900/30 border-yellow-500 text-yellow-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                        >
                            <Orbit size={10} /> ALT ORBIT (MAYA STYLE)
                        </button>
                    </div>

                    {/* CHAOS ENGINE */}
                    <div className="space-y-2 pt-2 border-t border-[#222]">
                        <div className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1"><Zap size={10} /> Chaos Engine</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setChaosMode(!chaosMode)}
                                className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-1 transition-all ${chaosMode ? 'bg-orange-900/30 border-orange-500 text-orange-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                            >
                                <Activity size={10} /> ENTROPY
                            </button>
                            <button
                                onClick={() => setFractalEcho(!fractalEcho)}
                                className={`py-2 rounded text-[9px] font-bold border flex items-center justify-center gap-1 transition-all ${fractalEcho ? 'bg-pink-900/30 border-pink-500 text-pink-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                            >
                                <Dna size={10} /> FRACTAL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT TOOLBAR (KPanel) */}
            {!isViewportHost && (
            <KPanel
                position="left"
                className={isToolOverlay ? 'pointer-events-auto' : ''}
                collapsible
                isCollapsed={isLeftCollapsed}
                onCollapseChange={setIsLeftCollapsed}
                collapsedContent={
                    <div className="flex flex-col gap-6 w-full items-center">
                        <button onClick={() => { setMode('build') }} className={`p-2 rounded-lg transition-all ${mode === 'build' ? 'bg-emerald-900/50 text-emerald-400' : 'text-gray-500 hover:text-white'}`} title="BUILD"><Plus size={20} /></button>
                        <button onClick={() => { setMode('sculpt') }} className={`p-2 rounded-lg transition-all ${mode === 'sculpt' ? 'bg-orange-900/50 text-orange-400' : 'text-gray-500 hover:text-white'}`} title="SCULPT"><Hammer size={20} /></button>
                        <button onClick={() => { setMode('edit') }} className={`p-2 rounded-lg transition-all ${mode === 'edit' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-500 hover:text-white'}`} title="EDIT"><MousePointer2 size={20} /></button>
                        <button onClick={() => { setMode('architect') }} className={`p-2 rounded-lg transition-all ${mode === 'architect' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-500 hover:text-white'}`} title="AI"><BrainCircuit size={20} /></button>
                        <button onClick={() => { setMode('animate') }} className={`p-2 rounded-lg transition-all ${mode === 'animate' ? 'bg-pink-900/50 text-pink-400' : 'text-gray-500 hover:text-white'}`} title="ANIM"><Film size={20} /></button>
                    </div>
                }
            >
                {/* EXPANDED HEADER */}





                <div className="p-2 border-b border-[#222]/50 grid grid-cols-5 gap-1">
                    <button onClick={() => { setMode('build') }} className={`py-2 rounded text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${mode === 'build' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-[#1a1a1a]/50'}`}><Plus size={12} /> BUILD</button>
                    <button onClick={() => { setMode('sculpt') }} className={`py-2 rounded text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${mode === 'sculpt' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:bg-[#1a1a1a]/50'}`}><Hammer size={12} /> SCULPT</button>
                    <button onClick={() => { setMode('edit') }} className={`py-2 rounded text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${mode === 'edit' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-[#1a1a1a]/50'}`}><MousePointer2 size={12} /> EDIT</button>
                    <button onClick={() => { setMode('architect') }} className={`py-2 rounded text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${mode === 'architect' ? 'bg-purple-600 text-white animate-pulse' : 'text-gray-500 hover:bg-[#1a1a1a]/50'}`}><BrainCircuit size={12} /> AI</button>
                    <button onClick={() => { setMode('animate') }} className={`py-2 rounded text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${mode === 'animate' ? 'bg-pink-600 text-white' : 'text-gray-500 hover:bg-[#1a1a1a]/50'}`}><Film size={12} /> ANIM</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar pb-12">
                    {/* MODE CONTENT SWITCHER */}
                    {mode === 'animate' ? (
                        <div className="p-4 border border-pink-900/30 bg-pink-900/10 rounded-lg text-center">
                            <Film size={24} className="mx-auto text-pink-500 mb-2" />
                            <div className="text-[10px] text-pink-400 font-bold">ANIMATION MODE ACTIVE</div>
                            <div className="text-[9px] text-gray-500 mt-1">Use the floating timeline below to sequence motion.</div>
                            <button
                                onClick={() => setAutoKey(!autoKey)}
                                className={`mt-2 px-3 py-1 rounded text-[9px] font-bold border transition-all ${autoKey ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                            >
                                ● AUTO-KEY: {autoKey ? 'ON' : 'OFF'}
                            </button>

                            {/* EXPERIMENTAL FEATURES */}
                            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                                <div className="text-[9px] text-pink-500 font-bold mb-2">EXPERIMENTAL</div>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setMotionTrail(!motionTrail)}
                                        className={`w-full py-1 rounded text-[9px] font-bold border transition-all ${motionTrail ? 'bg-pink-500 text-white' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}
                                    >
                                        MOTION TRAIL
                                    </button>
                                    <div>
                                        <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                                            <span>CHAOS TRACK</span>
                                            <span>{chaosTrack.toFixed(1)}</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="5" step="0.1"
                                            value={chaosTrack}
                                            onChange={(e) => setChaosTrack(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* RAPIER PHYSICS ENGINE */}
                            <div className="mt-4 pt-4 border-t border-cyan-900/30 w-full text-left">
                                <div className="text-[9px] text-cyan-500 font-bold mb-2 flex items-center gap-2">
                                    ⚡ RAPIER PHYSICS ENGINE
                                    {physicsSettings.isSimulating && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] text-gray-400">
                                        <span>GRAVITY</span><span>{physicsSettings.gravity.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="-20" max="0" step="0.1" value={physicsSettings.gravity} onChange={e => setPhysicsSettings({ ...physicsSettings, gravity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-cyan-500" />

                                    <div className="flex justify-between text-[9px] text-gray-400">
                                        <span>BOUNCE</span><span>{physicsSettings.bounciness.toFixed(2)}</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.05" value={physicsSettings.bounciness} onChange={e => setPhysicsSettings({ ...physicsSettings, bounciness: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-cyan-500" />

                                    <div className="flex justify-between text-[9px] text-gray-400">
                                        <span>DROP HEIGHT</span><span>{physicsSettings.dropHeight || 10}m</span>
                                    </div>
                                    <input type="range" min="2" max="50" step="1" value={physicsSettings.dropHeight || 10} onChange={e => setPhysicsSettings({ ...physicsSettings, dropHeight: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-cyan-500" />

                                    {/* SIMULATION CONTROLS */}
                                    <div className="grid grid-cols-2 gap-1 pt-2">
                                        <button
                                            onClick={onTogglePhysics}
                                            className={`py-2 rounded text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${physicsSettings.isSimulating ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-cyan-900/30 border-cyan-500 text-cyan-400 hover:bg-cyan-900/50'}`}
                                        >
                                            {physicsSettings.isSimulating ? '⏹ STOP' : '▶ SIMULATE'}
                                        </button>
                                        <button
                                            onClick={onDropSelected}
                                            disabled={!selectedObjectUUID}
                                            className="py-2 bg-orange-900/30 border border-orange-500 text-orange-400 rounded text-[9px] font-bold hover:bg-orange-900/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                        >
                                            🪂 DROP
                                        </button>
                                    </div>

                                    <button
                                        onClick={onDropAll}
                                        className="w-full py-2 bg-purple-900/30 border border-purple-500 text-purple-400 rounded text-[9px] font-bold hover:bg-purple-900/50 transition-all flex items-center justify-center gap-1"
                                    >
                                        🌧 DROP ALL FROM SKY
                                    </button>

                                    <button onClick={onBakePhysics} className="w-full py-2 mt-1 bg-pink-900/30 border border-pink-500 text-pink-400 rounded text-[9px] font-bold hover:bg-pink-900/50 transition-all">
                                        ⏺ BAKE TO KEYFRAMES
                                    </button>
                                </div>
                            </div>

                            {/* PROCEDURAL MODIFIERS */}
                            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                                <div className="text-[9px] text-pink-500 font-bold mb-2">PROCEDURAL MODIFIERS</div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[9px] text-gray-400"><span>PULSE SPEED</span><span>{proceduralSettings.pulseSpeed}</span></div>
                                    <input type="range" min="0" max="5" step="0.1" value={proceduralSettings.pulseSpeed} onChange={e => setProceduralSettings({ ...proceduralSettings, pulseSpeed: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500" />

                                    <div className="flex justify-between text-[9px] text-gray-400"><span>PULSE AMP</span><span>{proceduralSettings.pulseAmp}</span></div>
                                    <input type="range" min="0" max="2" step="0.1" value={proceduralSettings.pulseAmp} onChange={e => setProceduralSettings({ ...proceduralSettings, pulseAmp: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500" />

                                    <div className="flex justify-between text-[9px] text-gray-400"><span>SPIN SPEED</span><span>{proceduralSettings.spinSpeed}</span></div>
                                    <input type="range" min="0" max="5" step="0.1" value={proceduralSettings.spinSpeed} onChange={e => setProceduralSettings({ ...proceduralSettings, spinSpeed: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-pink-500" />
                                </div>
                            </div>

                            {/* EASING */}
                            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                                <div className="text-[9px] text-pink-500 font-bold mb-2">INTERPOLATION</div>
                                <div className="flex gap-1">
                                    {['linear', 'smooth', 'elastic'].map(e => (
                                        <button key={e} onClick={() => setEasingType(e)} className={`flex-1 py-1 rounded text-[8px] font-bold border ${easingType === e ? 'bg-pink-500 text-white border-pink-500' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                                            {e.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* TRANSFORM CONTROLS FOR ANIMATION */}
                            <div className="mt-4 pt-4 border-t border-pink-900/30 w-full text-left">
                                <div className="text-[9px] text-pink-500 font-bold mb-2">TRANSFORM KEY</div>
                                <div className="grid grid-cols-3 gap-1 mb-2">
                                    <div className="bg-[#111] p-1 rounded border border-[#222]">
                                        <div className="text-[8px] text-red-500 font-bold">POS X</div>
                                        <input type="number" value={transformData.posX.toFixed(2)} onChange={e => updateTransformFromUI('posX', parseFloat(e.target.value))} className="w-full bg-transparent text-[9px] text-white outline-none" />
                                    </div>
                                    <div className="bg-[#111] p-1 rounded border border-[#222]">
                                        <div className="text-[8px] text-green-500 font-bold">POS Y</div>
                                        <input type="number" value={transformData.posY.toFixed(2)} onChange={e => updateTransformFromUI('posY', parseFloat(e.target.value))} className="w-full bg-transparent text-[9px] text-white outline-none" />
                                    </div>
                                    <div className="bg-[#111] p-1 rounded border border-[#222]">
                                        <div className="text-[8px] text-blue-500 font-bold">POS Z</div>
                                        <input type="number" value={transformData.posZ.toFixed(2)} onChange={e => updateTransformFromUI('posZ', parseFloat(e.target.value))} className="w-full bg-transparent text-[9px] text-white outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                    <div className="bg-[#111] p-1 rounded border border-[#222]">
                                        <div className="text-[8px] text-red-500 font-bold">ROT X</div>
                                        <input type="number" value={THREE.MathUtils.radToDeg(transformData.rotX).toFixed(1)} onChange={e => updateTransformFromUI('rotX', THREE.MathUtils.degToRad(parseFloat(e.target.value)))} className="w-full bg-transparent text-[9px] text-white outline-none" />
                                    </div>
                                    <div className="bg-[#111] p-1 rounded border border-[#222]">
                                        <div className="text-[8px] text-green-500 font-bold">ROT Y</div>
                                        <input type="number" value={THREE.MathUtils.radToDeg(transformData.rotY).toFixed(1)} onChange={e => updateTransformFromUI('rotY', THREE.MathUtils.degToRad(parseFloat(e.target.value)))} className="w-full bg-transparent text-[9px] text-white outline-none" />
                                    </div>
                                    <div className="bg-[#111] p-1 rounded border border-[#222]">
                                        <div className="text-[8px] text-blue-500 font-bold">ROT Z</div>
                                        <input type="number" value={THREE.MathUtils.radToDeg(transformData.rotZ).toFixed(1)} onChange={e => updateTransformFromUI('rotZ', THREE.MathUtils.degToRad(parseFloat(e.target.value)))} className="w-full bg-transparent text-[9px] text-white outline-none" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : mode === 'architect' ? (
                        <KGreebleAI
                            architectPrompt={architectPrompt}
                            setArchitectPrompt={setArchitectPrompt}
                            executeArchitectProtocol={executeArchitectProtocol}
                            isArchitecting={isArchitecting}
                        />
                    ) : mode === 'sculpt' ? (
                        <div className="space-y-4 animate-in slide-in-from-left-4">
                            <div className="text-[10px] font-bold text-orange-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Hammer size={12} /> Sculpt Tools</div>

                            <div className="bg-[#161616]/50 p-3 rounded border border-orange-900/30 space-y-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">RADIUS <span className="text-orange-400">{sculptSettings.radius.toFixed(2)}</span></div>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={sculptSettings.radius} onChange={e => setSculptSettings({ ...sculptSettings, radius: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-orange-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">INTENSITY <span className="text-orange-400">{sculptSettings.intensity.toFixed(2)}</span></div>
                                    <input type="range" min="0.1" max="2.0" step="0.1" value={sculptSettings.intensity} onChange={e => setSculptSettings({ ...sculptSettings, intensity: parseFloat(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-orange-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {BRUSHES.map((b) => (
                                    <button
                                        key={b.id}
                                        onClick={() => setSculptTool(b.id)}
                                        className={`aspect-square flex flex-col items-center justify-center rounded border transition-all ${sculptTool === b.id ? 'bg-orange-600 text-white border-orange-500' : 'bg-[#161616] text-gray-500 border-[#222] hover:border-gray-500'}`}
                                        title={b.label}
                                    >
                                        <b.icon size={16} />
                                        <span className="text-[7px] font-bold mt-1">{b.label}</span>
                                    </button>
                                ))}
                            </div>

                            {sculptTool === 'PAINT' && (
                                <div className="flex items-center gap-2 pt-2 border-t border-[#333] animate-in fade-in">
                                    <span className="text-[9px] font-bold text-gray-400">PAINT COLOR</span>
                                    <input type="color" value={sculptColor} onChange={(e) => setSculptColor(e.target.value)} className="flex-1 bg-transparent border-none h-6 cursor-pointer" />
                                </div>
                            )}
                        </div>
                    ) : mode === 'edit' ? (
                        <section>
                            <div className="text-[10px] font-bold text-blue-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Move size={12} /> Transform Matrix</div>

                            {/* GIZMO CONTROLS */}
                            <div className="flex gap-2 mb-4 bg-[#161616] p-1 rounded border border-[#222]">
                                {['translate', 'rotate', 'scale'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setGizmoMode(m)}
                                        className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${gizmoMode === m ? 'bg-blue-900/40 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setTransformSpace(s => s === 'world' ? 'local' : 'world')} className="flex-1 py-1.5 bg-[#161616] border border-[#222] rounded text-[9px] font-bold text-gray-400 hover:text-white">{transformSpace.toUpperCase()}</button>
                                <button onClick={() => setSnapEnabled(s => !s)} className={`flex-1 py-1.5 border rounded text-[9px] font-bold ${snapEnabled ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-[#161616] border-[#222] text-gray-400'}`}>SNAP: {snapEnabled ? 'ON' : 'OFF'}</button>
                            </div>

                            {selectedObjectUUID ? (
                                <div className="space-y-4 bg-[#161616]/50 p-4 rounded-xl border border-blue-900/30">
                                    <div className="pb-3 mb-3 border-b border-[#222]/50 text-[10px] text-blue-300 italic text-center flex items-center justify-center gap-2 bg-blue-900/10 rounded p-2"><span>💡 Hold <strong className="text-white">SHIFT</strong> to Elevate (Y-Axis)</span></div>
                                    {['X', 'Y', 'Z'].map(axis => (<div key={`pos${axis}`}><div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">POS {axis} <span className="text-blue-400">{transformData[`pos${axis}`].toFixed(2)}</span></div><div className="flex gap-2"><input type="range" min="-100" max="100" step="0.1" value={transformData[`pos${axis}`]} onChange={(e) => updateTransformFromUI(`pos${axis}`, parseFloat(e.target.value))} className="flex-1 h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-blue-600" /><input type="number" value={transformData[`pos${axis}`]} onChange={(e) => updateTransformFromUI(`pos${axis}`, parseFloat(e.target.value))} className="w-12 bg-black border border-blue-900 text-[9px] text-center text-blue-200" /></div></div>))}
                                    <div className="h-px bg-[#222]/50 my-2"></div>
                                    {['X', 'Y', 'Z'].map(axis => (<div key={`rot${axis}`}><div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">ROT {axis} <span className="text-green-400">{((transformData[`rot${axis}`] * 180) / Math.PI).toFixed(0)}°</span></div><input type="range" min="0" max={Math.PI * 2} step="0.1" value={transformData[`rot${axis}`]} onChange={(e) => updateTransformFromUI(`rot${axis}`, parseFloat(e.target.value))} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-green-500" /></div>))}
                                    <div className="h-px bg-[#222]/50 my-2"></div>
                                    {['X', 'Y', 'Z'].map(axis => (<div key={`scale${axis}`}><div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">SCALE {axis} <span className="text-purple-400">{transformData[`scale${axis}`].toFixed(2)}</span></div><input type="range" min="0.1" max="50.0" step="0.1" value={transformData[`scale${axis}`]} onChange={(e) => updateTransformFromUI(`scale${axis}`, parseFloat(e.target.value))} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-purple-600" /></div>))}
                                    <div className="space-y-2 pt-4 border-t border-[#222]/50">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center mb-1">Destructive Operations</div>
                                        <button onClick={handleChaosScatter} className="w-full py-3 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-900/50 rounded flex items-center justify-center gap-2 text-xs font-bold text-indigo-400"><Zap size={14} /> CHAOS SCATTER</button>
                                        <button onClick={handleGlitch} className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded flex items-center justify-center gap-2 text-xs font-bold text-red-400"><Activity size={14} /> GLITCH GEOMETRY</button>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <button onClick={handleDuplicateObject} className="py-2 bg-[#0a0a0a]/50 hover:bg-[#222] border border-[#222] rounded flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300"><ClipboardCopy size={12} /> DUPLICATE</button>
                                            <button onClick={handleDeleteSelected} className="py-2 bg-[#0a0a0a]/50 hover:bg-red-900/10 border border-[#222] rounded flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300 hover:text-red-400"><Trash2 size={12} /> DELETE</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (<div className="p-6 text-center text-[10px] text-gray-600 border border-dashed border-[#222] rounded-xl">Select an object to manipulate.</div>)}
                        </section>
                    ) : (
                        /* BUILD MODE */
                        <>
                            <div className="flex bg-[#1a1a1a]/50 p-1 rounded border border-[#333] mb-4">
                                <button onClick={() => setBuildTab('PRIMITIVES')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${buildTab === 'PRIMITIVES' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>PRIMITIVES</button>
                                <button onClick={() => setBuildTab('KERNEL')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${buildTab === 'KERNEL' ? 'bg-orange-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>KERNEL</button>
                            </div>

                            {buildTab === 'PRIMITIVES' && (
                                <KGreeblePrimitives activeShape={activeShape} setActiveShape={setActiveShape} />
                            )}

                            {buildTab === 'KERNEL' && (
                                <section>
                                    <div className="text-[10px] font-bold text-orange-500 uppercase mb-3 flex items-center gap-2 tracking-widest"><HardDrive size={12} /> Kernel Storage</div>
                                    {(!sharedState?.storage || sharedState.storage.length === 0) ? (
                                        <div className="p-4 border border-dashed border-[#222] rounded text-center text-[10px] text-gray-600 italic">
                                            Kernel Memory Empty.<br />Commit artifacts from other modules.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            {sharedState.storage.map((item: any) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => loadFromStorage(item)}
                                                    className={`relative aspect-square rounded border overflow-hidden transition-all group ${activeShape === `import_${item.id}` ? 'border-orange-500 ring-1 ring-orange-500' : 'border-[#222] hover:border-gray-500'}`}
                                                >
                                                    {item.thumbnail ? (
                                                        <img src={item.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={item.name} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-[#111]"><Box size={16} className="text-gray-600" /></div>
                                                    )}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[7px] text-center py-1 truncate px-1 text-gray-300">
                                                        {item.name}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    )}
                    {(mode !== 'architect' && mode !== 'animate') && (
                        <section className="grid grid-cols-2 gap-2 pt-4 border-t border-red-900/20">
                            <button onClick={handleUndo} className="py-3 bg-[#161616]/50 hover:bg-[#222] text-gray-400 border border-[#222] rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 uppercase"><ClipboardCopy size={14} /> Undo</button>
                            <button onClick={handleClear} className="py-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/40 rounded-lg text-[10px] font-bold flex items-center justify-center gap-2 uppercase"><Trash2 size={10} /> RESET SCENE</button>
                        </section>
                    )}
                </div>


            </KPanel>
            )}

            {/* VIEWPORT - FULL SCREEN BEHIND UI */}
            <div className={`flex-1 relative h-full z-0 cursor-crosshair group ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>
                <div ref={mountRef} className={`absolute inset-0 z-0 ${isToolOverlay ? 'opacity-0 pointer-events-none' : ''}`} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} />

                {/* TITAN UPLINK (CENTERED, OVERLAYS EVERYTHING) */}
                {!isViewportHost && (
                <button onClick={() => handleExport('commit')} className={`absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#000]/80 backdrop-blur-md border border-[#00ffcc]/50 text-[#00ffcc] px-8 py-3 rounded-full font-bold text-xs tracking-[0.2em] shadow-[0_0_30px_rgba(0,255,204,0.2)] hover:bg-[#00ffcc] hover:text-black hover:shadow-[0_0_50px_rgba(0,255,204,0.6)] transition-all duration-300 flex items-center gap-3 group overflow-hidden ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    <Share2 size={16} className="group-hover:rotate-12 transition-transform" /> UPLINK TO KERNEL
                </button>
                )}


                {!isViewportHost && (
                <div className={`absolute top-6 right-6 z-50 flex gap-2 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                    <KHDRWidget
                        scene={scene}
                        renderer={renderer}
                        defaultEnabled={false}
                        onHDRActive={onHDRActive}
                    />


                    <button onClick={() => setRayTracing(!rayTracing)} className={`p-2 rounded border backdrop-blur-sm transition-all ${rayTracing ? 'bg-purple-500/80 border-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)]' : 'bg-[#161616]/60 border-[#222] text-gray-400'}`} title="Ray Tracing"><Zap size={16} /></button>
                    <button onClick={() => setNeonMode(!neonMode)} className={`p-2 rounded border backdrop-blur-sm transition-all ${neonMode ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400' : 'bg-[#161616]/60 border-[#222] text-gray-400'}`} title="Neon Protocol"><MonitorPlay size={16} /></button>
                    <button onClick={toggleFullscreen} className="p-2 bg-[#161616]/60 backdrop-blur-sm hover:bg-[#222]/80 rounded text-gray-400 hover:text-white border border-[#222]"><Expand size={16} /></button>
                </div>
                )}

                {!isViewportHost && (
                <div className="absolute top-6 left-6 pointer-events-none flex flex-col gap-2 z-40">
                    <div className={`flex items-center gap-2 text-[10px] font-bold bg-black/60 px-4 py-2 rounded border backdrop-blur-md shadow-lg ${mode === 'build' ? 'text-emerald-500 border-emerald-900/50' : mode === 'edit' ? 'text-blue-400 border-blue-900/50' : mode === 'animate' ? 'text-pink-400 border-pink-900/50' : mode === 'sculpt' ? 'text-orange-400 border-orange-900/50' : 'text-purple-400 border-purple-900/50'}`}>
                        {mode === 'build' ? <Plus size={12} /> : mode === 'edit' ? <MousePointer2 size={12} /> : mode === 'animate' ? <Film size={12} /> : mode === 'sculpt' ? <Hammer size={12} /> : <BrainCircuit size={12} />}
                        PROTOCOL: {mode.toUpperCase()}
                    </div>
                    {mode === 'build' && <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 bg-black/60 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md">INSERT: {activeShape.startsWith('import') ? activeShape.split('_')[1] : activeShape.toUpperCase()}</div>}
                    <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 bg-black/60 px-3 py-1.5 rounded border border-purple-900/50 backdrop-blur-md"><Layers size={12} /> STRATUM: {layers.find((l: any) => l.id === activeLayerId)?.name.toUpperCase()}</div>
                    {surfaceMode && <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 bg-black/60 px-3 py-1.5 rounded border border-blue-900/50 backdrop-blur-md"><Grid size={12} /> SURFACE MODE: ACTIVE</div>}
                    {gridLock && <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 bg-black/60 px-3 py-1.5 rounded border border-blue-900/50 backdrop-blur-md"><Grid size={12} /> GRID LOCK: {gridSize}</div>}
                    {voidAnchor && <div className="flex items-center gap-2 text-[10px] font-bold text-purple-400 bg-black/60 px-3 py-1.5 rounded border border-purple-900/50 backdrop-blur-md"><Anchor size={12} /> VOID ANCHOR: ON</div>}
                    {fractalEcho && <div className="flex items-center gap-2 text-[10px] font-bold text-pink-400 bg-black/60 px-3 py-1.5 rounded border border-pink-900/50 backdrop-blur-md"><Dna size={12} /> FRACTAL ECHO</div>}
                </div>
                )}

                {/* FLOATING ANIMATION TIMELINE */}
                {!isViewportHost && mode === 'animate' && (
                    <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                        <KGreebleTimeline
                            animTime={animTime}
                            animDuration={animDuration}
                            setAnimDuration={setAnimDuration}
                            isPlaying={isPlaying}
                            togglePlay={togglePlay}
                            stopPlay={stopPlay}
                            handleTimelineScrub={handleTimelineScrub}
                            handleSliderChange={handleSliderChange}
                            handleSliderUp={handleSliderUp}
                            keyframes={keyframes}
                            selectedObjectUUID={selectedObjectUUID}
                            handleAddKeyframe={handleAddKeyframe}
                            handleDeleteKeyframe={handleDeleteKeyframe}
                            targetFPS={targetFPS}
                            setTargetFPS={setTargetFPS}
                            style={{ left: 24, right: 24 }}
                        />
                    </div>
                )}
            </div>

            {/* RIGHT TOOLBAR (KPanel) */}
            {!isViewportHost && (
            <KPanel
                position="right"
                className={isToolOverlay ? 'pointer-events-auto' : ''}
                collapsible
                isCollapsed={isRightCollapsed}
                onCollapseChange={setIsRightCollapsed}
                collapsedContent={
                    <div className="flex flex-col gap-6 w-full items-center">
                        <button onClick={() => { setActiveRightTab('layers') }} className={`p-2 rounded-lg transition-all ${activeRightTab === 'layers' ? 'bg-emerald-900/50 text-emerald-400' : 'text-gray-500 hover:text-white'}`} title="LAYERS"><Layers size={20} /></button>
                        <button onClick={() => { setActiveRightTab('pbr') }} className={`p-2 rounded-lg transition-all ${activeRightTab === 'pbr' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-500 hover:text-white'}`} title="PBR"><CircleDot size={20} /></button>
                        <button onClick={() => { setActiveRightTab('python') }} className={`p-2 rounded-lg transition-all ${activeRightTab === 'python' ? 'bg-yellow-900/50 text-yellow-400' : 'text-gray-500 hover:text-white'}`} title="PYTHON"><BrainCircuit size={20} /></button>
                        <button onClick={() => { setActiveRightTab('export') }} className={`p-2 rounded-lg transition-all ${activeRightTab === 'export' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-500 hover:text-white'}`} title="EXPORT"><Share2 size={20} /></button>
                    </div>
                }
            >
                {/* EXPANDED TABS */}
                <div className="flex border-b border-[#222] bg-[#0f0f0f]">
                    <button onClick={() => setActiveRightTab('layers')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeRightTab === 'layers' ? 'bg-[#1a1a1a] text-emerald-400 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-white hover:bg-[#161616]'}`}><Layers size={14} /> LAYERS</button>
                    <button onClick={() => setActiveRightTab('pbr')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeRightTab === 'pbr' ? 'bg-[#1a1a1a] text-purple-400 border-b-2 border-purple-500' : 'text-gray-500 hover:text-white hover:bg-[#161616]'}`}><CircleDot size={14} /> PBR</button>
                    <button onClick={() => setActiveRightTab('modifiers')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeRightTab === 'modifiers' ? 'bg-[#1a1a1a] text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-500 hover:text-white hover:bg-[#161616]'}`}><Combine size={14} /> MODS</button>
                    <button onClick={() => setActiveRightTab('python')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeRightTab === 'python' ? 'bg-[#1a1a1a] text-yellow-400 border-b-2 border-yellow-500' : 'text-gray-500 hover:text-white hover:bg-[#161616]'}`}><BrainCircuit size={14} /> PY</button>
                    <button onClick={() => setActiveRightTab('export')} className={`flex-1 py-3 text-[10px] font-bold transition-all flex flex-col items-center gap-1 ${activeRightTab === 'export' ? 'bg-[#1a1a1a] text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-white hover:bg-[#161616]'}`}><Share2 size={14} /> EXPORT</button>
                </div>

                {activeRightTab === 'modifiers' && (
                    <div className="flex-1 p-4 bg-[#0a0a0a]/20 space-y-6 overflow-y-auto custom-scrollbar">
                        {/* BOOLEAN SECTION */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-yellow-900/30">
                                <Combine size={12} /> Boolean Operations
                            </div>

                            <div className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded-lg space-y-3">
                                <div className="text-[9px] text-gray-400">
                                    1. Select <strong>Subject</strong> mesh.<br />
                                    2. Click <strong>PICK TARGET</strong>.<br />
                                    3. Select <strong>Target</strong> mesh to cut/add.<br />
                                    4. Choose Operation.
                                </div>

                                <button
                                    onClick={() => setModifierMode(modifierMode === 'picking_boolean_target' ? 'none' : 'picking_boolean_target')}
                                    className={`w-full py-2 rounded text-[10px] font-bold border transition-all flex items-center justify-center gap-2 ${modifierMode === 'picking_boolean_target' ? 'bg-yellow-500 text-black border-yellow-400 animate-pulse' : 'bg-[#161616] border-[#333] text-gray-400 hover:text-white'}`}
                                >
                                    {modifierMode === 'picking_boolean_target' ? 'PICKING TARGET...' : 'PICK TARGET'}
                                    <Crosshair size={12} />
                                </button>

                                {booleanTargetUUID && (
                                    <div className="text-[9px] text-emerald-400 font-bold text-center bg-emerald-900/20 py-1 rounded border border-emerald-900/50">
                                        TARGET SELECTED
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-1">
                                    <button onClick={() => handleBooleanOp('UNION')} disabled={!booleanTargetUUID} className="py-2 bg-[#161616] border border-[#333] hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-[9px] font-bold text-gray-300 rounded hover:text-yellow-400 transition-colors">UNION</button>
                                    <button onClick={() => handleBooleanOp('SUBTRACT')} disabled={!booleanTargetUUID} className="py-2 bg-[#161616] border border-[#333] hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-[9px] font-bold text-gray-300 rounded hover:text-yellow-400 transition-colors">SUBTRACT</button>
                                    <button onClick={() => handleBooleanOp('INTERSECT')} disabled={!booleanTargetUUID} className="py-2 bg-[#161616] border border-[#333] hover:border-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-[9px] font-bold text-gray-300 rounded hover:text-yellow-400 transition-colors">INTERSECT</button>
                                </div>
                            </div>
                        </div>

                        {/* ARRAY SECTION */}
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-blue-900/30">
                                <CopyPlus size={12} /> Array Modifier
                            </div>

                            <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg space-y-3">
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-400 font-bold mb-1">COUNT <span className="text-blue-400">{arrayParams.count}</span></div>
                                    <input type="range" min="1" max="50" step="1" value={arrayParams.count} onChange={e => setArrayParams({ ...arrayParams, count: parseInt(e.target.value) })} className="w-full h-1 bg-[#0a0a0a] rounded-lg appearance-none accent-blue-500" />
                                </div>

                                <div className="space-y-1">
                                    <div className="text-[9px] font-bold text-gray-500">OFFSET (X/Y/Z)</div>
                                    <div className="grid grid-cols-3 gap-1">
                                        {['x', 'y', 'z'].map(axis => (
                                            <div key={axis} className="bg-[#0a0a0a] p-1 rounded border border-[#222]">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={arrayParams.offset[axis]}
                                                    onChange={e => setArrayParams({ ...arrayParams, offset: { ...arrayParams.offset, [axis]: parseFloat(e.target.value) } })}
                                                    className="w-full bg-transparent text-[9px] text-center text-gray-300 outline-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button onClick={handleArrayOp} className="w-full py-2 bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/50 text-blue-400 text-[9px] font-bold rounded transition-colors uppercase">
                                    Create Array
                                </button>
                            </div>
                        </div>


                    </div>
                )}
                {activeRightTab === 'layers' && (
                    <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-2xl relative h-full overflow-hidden">
                        <KGreebleLayers
                            layers={layers}
                            activeLayerId={activeLayerId}
                            setActiveLayerId={setActiveLayerId}
                            addLayer={addLayer}
                            duplicateLayer={duplicateLayer}
                            deleteLayer={deleteLayer}
                            toggleVisibility={toggleVisibility}
                            selectLayerObject={selectLayerObject}
                            selectedLayerIds={selectedLayerIds}
                            handleMergeSelected={handleMergeSelected}
                            handleMergeAll={handleMergeAll}
                            removeMaterial={removeMaterial}
                        />
                    </div>
                )}

                {activeRightTab === 'pbr' && (
                    <KGreebleMats
                        materialLibrary={materialLibrary}
                        commitMaterial={commitMaterial}
                        removeMaterial={removeMaterial}
                        prompt={prompt}
                        setPrompt={setPrompt}
                        generating={generating}
                        handleGenerate={handleGenerate}
                        handleTextureUploadClick={handleTextureUploadClick}
                        handleTextureUpload={handleTextureUpload}
                        textureInputRef={textureInputRef}
                        matParams={matParams}
                        setMatParams={setMatParams}
                        layers={layers}
                        activeLayerId={activeLayerId}
                        downloadMap={downloadMap}
                        downloadAll={downloadAll}
                    />
                )}



                {activeRightTab === 'python' && (
                    <div className="flex-1 p-4 bg-[#0a0a0a]/20 space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-yellow-900/30">
                            <BrainCircuit size={12} /> Python Bridge Test
                        </div>

                        {/* SIMPLE TEST */}
                        <div className="p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-lg space-y-4">
                            <div className="text-[9px] text-yellow-400 font-bold uppercase">🔬 Connection Test</div>

                            <button
                                onClick={async () => {
                                    console.log("🔵 Testing Python bridge...");
                                    try {
                                        const result = await callScript('hello', 'test', {});
                                        console.log("✅ Python Response:", result);
                                        alert(`SUCCESS!\n\n${JSON.stringify(result, null, 2)}`);
                                    } catch (err: any) {
                                        console.error("❌ Python Error:", err);
                                        alert(`FAILED!\n\n${err.toString()}`);
                                    }
                                }}
                                disabled={pythonLoading}
                                className="w-full py-4 rounded text-[11px] font-bold border bg-yellow-500 border-yellow-400 text-black hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all uppercase"
                            >
                                {pythonLoading ? 'Testing...' : '🚀 Test Python Connection'}
                            </button>

                            <div className="text-[8px] text-gray-500 text-center space-y-1">
                                <div>Click button to test Python bridge.</div>
                                <div>Opens alert with result or error.</div>
                            </div>
                        </div>

                        {/* DEBUG INFO */}
                        <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-[8px] text-gray-500 space-y-1">
                            <div className="text-red-400 font-bold mb-2">DEBUG</div>
                            <div>• Check console for Python logs</div>
                            <div>• Python sidecar must be running</div>
                            <div>• Start with: <code className="bg-black p-1 text-yellow-400">npm run tauri:dev</code></div>
                        </div>
                    </div>
                )}

                {activeRightTab === 'export' && (
                    <div className="flex-1 p-4 bg-[#0a0a0a]/20 space-y-4">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Settings size={12} /> Export Configuration</div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-gray-500">TARGET ENGINE</label>
                            <div className="flex bg-[#161616] p-1 rounded border border-[#222]">
                                {['GENERIC', 'UNREAL', 'UNITY'].map(t => (
                                    <button key={t} onClick={() => setTargetEngine(t)} className={`flex-1 py-1.5 rounded text-[8px] font-bold transition-all ${targetEngine === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-[#161616] rounded border border-[#222]">
                                <span className="text-[9px] font-bold text-gray-400">WELD GEOMETRY</span>
                                <button onClick={() => setMergeOnExport(!mergeOnExport)} className={`w-8 h-4 rounded-full transition-colors ${mergeOnExport ? 'bg-emerald-600' : 'bg-gray-700'} relative`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${mergeOnExport ? 'left-4.5 translate-x-full' : 'left-0.5'}`} style={{ transform: mergeOnExport ? 'translateX(100%)' : 'none', left: mergeOnExport ? 'auto' : '2px', right: mergeOnExport ? '2px' : 'auto' }} /></button>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-[#161616] rounded border border-[#222]">
                                <span className="text-[9px] font-bold text-gray-400">INCLUDE BASE MESH</span>
                                <button onClick={() => setIncludeBase(!includeBase)} className={`w-8 h-4 rounded-full transition-colors ${includeBase ? 'bg-emerald-600' : 'bg-gray-700'} relative`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${includeBase ? 'left-4.5 translate-x-full' : 'left-0.5'}`} style={{ transform: includeBase ? 'translateX(100%)' : 'none', left: includeBase ? 'auto' : '2px', right: includeBase ? '2px' : 'auto' }} /></button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#222]">
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleExport('download', 'glb')} className="bg-[#161616] hover:bg-[#222] text-gray-400 border border-[#222] py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-colors shadow-lg"><Download size={14} /> .GLB</button>
                                <button onClick={() => handleExport('download', 'obj')} className="bg-[#161616] hover:bg-[#222] text-gray-400 border border-[#222] py-3 rounded font-bold text-[10px] flex items-center justify-center gap-2 tracking-widest hover:text-white transition-colors shadow-lg"><Download size={14} /> .OBJ</button>
                            </div>
                            <div className="mt-2 text-[8px] text-gray-600 text-center italic">
                                Exports current scene state. Animation included in GLB if present.
                            </div>
                        </div>
                    </div>
                )}
            </KPanel>
            )}
        </div >
    );
}
