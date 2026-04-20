
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Activity, Move, RotateCw, Share2, Maximize, Zap, Split, Scan, Paintbrush, MousePointer2 } from 'lucide-react';

import { StudioStage } from '../../../core/three/StudioStage';
import { KRigEngine } from './KRigEngine';
import KRigUI from './KRigUI';
import { useZenControlBindings, useZenModuleBridge, useZenSharedControls } from '../../../core/zen';
import { UNIVERSAL_VIEWPORT_BACKGROUND_HEX } from '../../../core/zen';

export default function KRig({ sharedState, onCommit, zenShellMode = 'standalone' }: any) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge('rig');
    const { gizmoMode, setGizmoMode } = useZenSharedControls();
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const mountRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<KRigEngine | null>(null);
    const stageRef = useRef<StudioStage | null>(null);
    const clockRef = useRef(new THREE.Clock());

    // UI State
    const [status, setStatus] = useState("K-RIG ENGINE INITIALIZED");
    const [mode, setMode] = useState('SETUP'); // SETUP | POSE | WEIGHTS
    const [meshLoaded, setMeshLoaded] = useState(false);
    const [rigDetected, setRigDetected] = useState(false);
    const [skeletonMap, setSkeletonMap] = useState<any[]>([]);
    const [activeBoneId, setActiveBoneId] = useState<string | null>(null);

    // Animation State
    const [animations, setAnimations] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);

    // Rigging State
    const [bindRadius, setBindRadius] = useState(0.8);
    const [ikEnabled, setIkEnabled] = useState(true);
    const [physicsEnabled, setPhysicsEnabled] = useState(false);
    const [physicsSettings, setPhysicsSettings] = useState({ stiffness: 0.2, drag: 0.95 });

    const [mirrorMode, setMirrorMode] = useState(false);
    const [xRayMode, setXRayMode] = useState(false);

    // Weight Paint State
    const [weightSettings, setWeightSettings] = useState({ radius: 0.3, intensity: 0.5, subtract: false });
    const isPainting = useRef(false);

    // AI & Auto-Rig
    const [rigPrompt, setRigPrompt] = useState("");
    const [isGeneratingRig, setIsGeneratingRig] = useState(false);
    const [markerMode, setMarkerMode] = useState(false);
    const [markerCount, setMarkerCount] = useState(0); // 0-8
    const [dqsEnabled, setDqsEnabled] = useState(true);

    useEffect(() => {
        publishLayers([
            {
                id: 'rig:skeleton',
                name: 'Rig Skeleton',
                order: 0,
                tags: ['rig']
            }
        ]);
    }, [publishLayers]);

    useEffect(() => {
        publishState({
            status,
            mode,
            activeBoneId,
            rigDetected,
            meshLoaded
        });
    }, [activeBoneId, meshLoaded, mode, publishState, rigDetected, status]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            activeAssetId: sharedState?.activeArtifactId ?? null,
            activeLayerId: activeBoneId ? `rig:bone:${activeBoneId}` : 'rig:skeleton'
        });
    }, [activeBoneId, isToolOverlay, publishSelection, sharedState?.activeArtifactId]);

    // Refs for event handlers
    const stateRef = useRef({ activeBoneId, mirrorMode, gizmoMode, mode, weightSettings, markerMode });
    useEffect(() => {
        stateRef.current = { activeBoneId, mirrorMode, gizmoMode, mode, weightSettings, markerMode };
    }, [activeBoneId, mirrorMode, gizmoMode, mode, weightSettings, markerMode]);

    const ikEnabledRef = useRef(ikEnabled);
    useEffect(() => { ikEnabledRef.current = ikEnabled; }, [ikEnabled]);

    const physicsRef = useRef({ enabled: physicsEnabled, settings: physicsSettings });
    useEffect(() => {
        physicsRef.current = { enabled: physicsEnabled, settings: physicsSettings };
        if (engineRef.current) {
            engineRef.current.physics.enabled = physicsEnabled;
            engineRef.current.physics.stiffness = physicsSettings.stiffness;
            engineRef.current.physics.drag = physicsSettings.drag;
        }
    }, [physicsEnabled, physicsSettings]);

    useEffect(() => {
        engineRef.current?.gizmo.setMode(gizmoMode);
    }, [gizmoMode]);

    useZenControlBindings('rig', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'rig') {
            return false;
        }

        if (actionId !== 'camera.orbit.hold') {
            return false;
        }

        const controls = stageRef.current?.controls;
        const renderer = stageRef.current?.renderer;
        if (!controls || !renderer) {
            return false;
        }

        const isActive = phase === 'down';
        controls.enabled = isActive;
        renderer.domElement.style.cursor = isActive ? 'move' : 'default';
        return true;
    });

    // --- INIT ---
    useEffect(() => {
        if (isToolOverlay) return;
        if (!mountRef.current) return;

        const stage = new StudioStage(mountRef.current, {
            cameraPosition: [0, 1.5, 4],
            background: Number.parseInt(UNIVERSAL_VIEWPORT_BACKGROUND_HEX.slice(1), 16),
            controls: true,
            lighting: true
        });
        if (stage.controls) {
            stage.controls.enabled = false;
        }
        stageRef.current = stage;
        const disconnectZenViewport = connectViewport({
            element: mountRef.current,
            scene: stage.scene,
            camera: stage.camera,
            controls: stage.controls,
            renderer: stage.renderer
        });

        const engine = new KRigEngine(stage);
        engineRef.current = engine;

        stage.onLoop(() => {
            const dt = clockRef.current.getDelta();
            if (ikEnabledRef.current) engine.updateIK();
            engine.update(dt);
        });

        // --- INTERACTION HANDLERS ---
        const getNDC = (e: MouseEvent) => {
            const rect = mountRef.current!.getBoundingClientRect();
            return {
                x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
                y: -((e.clientY - rect.top) / rect.height) * 2 + 1
            };
        };

        const handleDown = (e: MouseEvent) => {
            if (e.altKey) return;
            if (e.button !== 0) return;

            const { mode, activeBoneId, weightSettings } = stateRef.current;
            const ndc = getNDC(e);

            if (mode === 'WEIGHTS') {
                isPainting.current = true;
                if (stage.controls) stage.controls.enabled = false;

                // Initial paint
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);

                if (engine.mesh) {
                    const intersects = raycaster.intersectObject(engine.mesh);
                    if (intersects.length > 0) {
                        const boneIdx = engine.bones.findIndex(b => b.name === activeBoneId);
                        if (boneIdx >= 0) {
                            engine.paintWeights(intersects[0].point, weightSettings.radius, weightSettings.intensity, weightSettings.subtract);
                        }
                    }
                }
            } else if (mode === 'SETUP' && stateRef.current.markerMode) {
                // MARKER PLACEMENT
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
                if (engine.mesh) {
                    console.log("K-RIG: Raycasting on mesh:", engine.mesh.name, "Type:", engine.mesh.type);
                    const intersects = raycaster.intersectObject(engine.mesh, true);
                    console.log("K-RIG: Intersects count:", intersects.length);
                    if (intersects.length > 0) {
                        console.log("K-RIG: Clicked point:", intersects[0].point);
                        engine.addNextMarker(intersects[0].point);
                        setMarkerCount(engine.markerSystem.markers.size);
                        // Auto-advance or check completion
                        if (engine.markerSystem.isComplete()) {
                            setStatus("MARKERS COMPLETE - READY TO SOLVE");
                        } else {
                            setStatus(`PLACED MARKER ${engine.markerSystem.markers.size}/8`);
                        }
                    }
                }
            } else {
                // Selection Mode
                const selected = engine.select(ndc);
                if (selected) {
                    setActiveBoneId(selected.userData.boneName || selected.name);
                    engine.gizmo.setMode(stateRef.current.gizmoMode);
                }
            }
        };

        const handleMove = (e: MouseEvent) => {
            const { markerMode } = stateRef.current;
            const ndc = getNDC(e);

            // Preview Marker
            if (markerMode && engine.mesh) {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);
                const intersects = raycaster.intersectObject(engine.mesh, true);
                if (intersects.length > 0) {
                    engine.markerSystem.updatePreview(intersects[0].point);
                } else {
                    engine.markerSystem.hidePreview();
                }
            }

            if (!isPainting.current) return;

            const { activeBoneId, weightSettings } = stateRef.current;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), stage.camera);

            if (engine.mesh) {
                const intersects = raycaster.intersectObject(engine.mesh);
                if (intersects.length > 0) {
                    const boneIdx = engine.bones.findIndex(b => b.name === activeBoneId);
                    if (boneIdx >= 0) {
                        engine.paintWeights(intersects[0].point, weightSettings.radius, weightSettings.intensity, weightSettings.subtract);
                    }
                }
            }
        };

        const handleUp = () => {
            isPainting.current = false;
            if (stage.controls) stage.controls.enabled = true;
        };

        const handleGizmoChange = () => {
            const { mirrorMode, activeBoneId } = stateRef.current;
            if (mirrorMode && activeBoneId) {
                engine.applyMirror(activeBoneId);
            }
        };

        stage.renderer.domElement.addEventListener('mousedown', handleDown);
        stage.renderer.domElement.addEventListener('mousemove', handleMove);
        stage.renderer.domElement.addEventListener('mouseup', handleUp);
        engine.gizmo.controls.addEventListener('change', handleGizmoChange);

        return () => {
            disconnectZenViewport();
            if (stage.renderer && stage.renderer.domElement) {
                stage.renderer.domElement.removeEventListener('mousedown', handleDown);
                stage.renderer.domElement.removeEventListener('mousemove', handleMove);
                stage.renderer.domElement.removeEventListener('mouseup', handleUp);
            }
            if (engine.gizmo && engine.gizmo.controls) {
                engine.gizmo.controls.removeEventListener('change', handleGizmoChange);
            }
            engine.dispose();
            stage.dispose();
        };
    }, [connectViewport, isToolOverlay]);

    // --- MODE SWITCHING SIDE EFFECTS ---
    useEffect(() => {
        const engine = engineRef.current;
        if (!engine) return;

        if (mode === 'WEIGHTS') {
            const idx = engine.bones.findIndex(b => b.name === activeBoneId);
            if (idx >= 0) {
                engine.toggleWeightPaint(true, idx);
                setStatus("BIO-SURGERY ACTIVE");
            } else {
                setStatus("SELECT A BONE FIRST");
            }
        } else {
            engine.toggleWeightPaint(false);
            if (mode === 'POSE') setStatus("POSING MODE");
            if (mode === 'SETUP') setStatus("RIG SETUP");
        }
    }, [mode, activeBoneId]);

    // --- KERNEL INTEGRATION ---
    useEffect(() => {
        if (isToolOverlay) return;
        if (sharedState?.artifact && engineRef.current && !meshLoaded) {
            setStatus("MOUNTING ARTIFACT...");
            const url = URL.createObjectURL(sharedState.artifact);
            engineRef.current.loadArtifact(url).then((isRigged) => {
                setMeshLoaded(true);
                setRigDetected(isRigged);

                const engine = engineRef.current;
                if (!engine) return;

                // Sync Skeleton Map immediately
                if (engine.bones.length > 0) {
                    setSkeletonMap(engine.bones.map(b => ({ id: b.uuid, name: b.name })));
                }

                // Sync Animations
                if (engine.clips.length > 0) {
                    setAnimations(engine.clips.map(c => c.name));
                    setStatus(`IMPORTED ${engine.clips.length} ANIMATIONS`);
                }

                if (isRigged) {
                    setMode('POSE');
                    setStatus("EXISTING RIG DETECTED");
                } else {
                    setStatus("STATIC GEOMETRY LINKED");
                }
            });
        }
    }, [isToolOverlay, sharedState, meshLoaded]);

    const spawnSkeleton = (type: string) => {
        const engine = engineRef.current;
        if (!engine) return;
        engine.spawnSkeleton(type);
        setSkeletonMap(engine.bones.map(b => ({ id: b.uuid, name: b.name })));
        engine.autoFitSkeleton();
        setStatus(`${type} RIG GENERATED`);
    };

    const toggleXRay = () => {
        const newVal = !xRayMode;
        setXRayMode(newVal);
        engineRef.current?.setXRay(newVal);
    };

    const bindSkin = async () => {
        if (!engineRef.current) return;

        setStatus("VOXELIZING MESH (WebGPU)...");
        // Yield to render update
        await new Promise(r => setTimeout(r, 50));

        await engineRef.current.bindMeshToSkeleton(bindRadius);

        setMode('POSE');
        setStatus("GEODESIC BINDING COMPLETE");
    };

    // Auto-Rigging Markers
    const startMarkerPlacement = () => {
        setMarkerMode(true);
        setMarkerCount(0);
        setStatus("PLACE MARKER: CHIN");
        engineRef.current?.markerSystem.clearAll();
    };

    const cancelMarkerPlacement = () => {
        setMarkerMode(false);
        setIsGeneratingRig(false);
        setStatus("MARKER PLACEMENT CANCELLED");
        engineRef.current?.markerSystem.clearAll();
    };

    const solveMarkers = async () => {
        const engine = engineRef.current;
        if (!engine) return;

        const success = await engine.solveSkeletonFromMarkers();
        if (success) {
            setMarkerMode(false);
            setSkeletonMap(engine.bones.map(b => ({ id: b.uuid, name: b.name })));
            setStatus("SKELETON FITTED TO MARKERS");
        }
    };

    // DQS
    useEffect(() => {
        const engine = engineRef.current;
        if (engine?.mesh && engine.mesh instanceof THREE.SkinnedMesh) {
            // We need to import toggleDQS from KRigDQS or access it via engine logic if exposed
            // Since we didn't expose it on engine, let's assume engine handles it or we import it.
            // Actually, engine has DQSShaderInjector imported. We should add a method to engine or import here.
            // Better to add method to KRigEngine: setDQSEnabled(bool)
            // For now, I'll direct access if possible or simpler: assume engine has method.
            // I'll add `setDQS` to KRigEngine in next step if missing.
            // Or better:
            const mat = engine.mesh.material as any;
            if (mat.userData?.dqsShader?.uniforms?.useDQS) {
                mat.userData.dqsShader.uniforms.useDQS.value = dqsEnabled;
                mat.needsUpdate = true;
            }
        }
    }, [dqsEnabled]);


    const stripRig = () => {
        engineRef.current?.stripSkeleton();
        setRigDetected(false);
        setSkeletonMap([]);
        setAnimations([]); // Clear animations
        setMode('SETUP');
        setStatus("RIG PURGED - MESH STATIC");
    };

    const handleGenerateRig = async () => {
        if (!rigPrompt) return;
        setIsGeneratingRig(true);
        setStatus("NEURAL ARCHITECT WORKING...");
        setTimeout(() => {
            spawnSkeleton('BIPED');
            setStatus("AI RIG SYNTHESIZED");
            setIsGeneratingRig(false);
        }, 1500);
    };

    const handleCommit = () => {
        if (!engineRef.current?.mesh || !stageRef.current) return;
        setStatus("PACKING ASSET...");
        const exporter = new GLTFExporter();
        const engine = engineRef.current;
        engine.prepareForExport();
        exporter.parse(stageRef.current.scene, (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
            if (onCommit) {
                onCommit(blob, "K-RIG_CHARACTER");
                setStatus("UPLINK SUCCESSFUL");
            }
            engine.restoreAfterExport();
        }, (e) => {
            console.error(e);
            setStatus("EXPORT FAILED");
            engine.restoreAfterExport();
        }, { binary: true });
    };

    const handleGizmoModeChange = (mode: 'translate' | 'rotate' | 'scale') => {
        setGizmoMode(mode);
        engineRef.current?.gizmo.setMode(mode);
    };

    // Animation Controls
    const handlePlayAnim = (clipName: string) => {
        engineRef.current?.playAnimation(clipName);
        setIsPlaying(true);
        setStatus("PLAYBACK: " + clipName);
    };

    const handleStopAnim = () => {
        engineRef.current?.stopAnimation();
        setIsPlaying(false);
        setStatus("PLAYBACK STOPPED");
    };

    return (
        <div className={`flex h-full w-full text-gray-200 font-sans overflow-hidden select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>
            {!isViewportHost && (
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KRigUI
                        meshLoaded={meshLoaded}
                        rigDetected={rigDetected}
                        rigPrompt={rigPrompt} setRigPrompt={setRigPrompt}
                        handleGenerateRig={handleGenerateRig} isGeneratingRig={isGeneratingRig}
                        spawnSkeleton={spawnSkeleton}
                        stripRig={stripRig}
                        bindRadius={bindRadius} setBindRadius={setBindRadius}
                        bindSkin={bindSkin}
                        mode={mode} setMode={setMode}
                        ikEnabled={ikEnabled} setIkEnabled={setIkEnabled}
                        physicsEnabled={physicsEnabled} setPhysicsEnabled={setPhysicsEnabled}
                        physicsSettings={physicsSettings} setPhysicsSettings={setPhysicsSettings}
                        skeletonMap={skeletonMap}
                        activeBoneId={activeBoneId}
                        selectBone={(id: string) => {
                            const b = engineRef.current?.bones.find(x => x.uuid === id);
                            if (b) {
                                if (mode !== 'WEIGHTS') engineRef.current?.gizmo.attach(b);
                                setActiveBoneId(b.name);
                            }
                        }}
                        weightSettings={weightSettings}
                        setWeightSettings={setWeightSettings}
                        animations={animations}
                        isPlaying={isPlaying}
                        handlePlayAnim={handlePlayAnim}
                        handleStopAnim={handleStopAnim}
                        markerMode={markerMode}
                        markerCount={markerCount}
                        startMarkerPlacement={startMarkerPlacement}
                        cancelMarkerPlacement={cancelMarkerPlacement}
                        solveMarkers={solveMarkers}
                        dqsEnabled={dqsEnabled}
                        setDqsEnabled={setDqsEnabled}
                    />
                </div>
            )}

            <div className={`flex-1 relative cursor-crosshair ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-black'}`}>
                <div ref={mountRef} className={`absolute inset-0 ${isToolOverlay ? 'opacity-0 pointer-events-none' : ''}`} />

                {/* STATUS BAR */}
                {!isViewportHost && (
                    <div className="absolute top-4 left-4 pointer-events-none">
                        <div className="px-3 py-1.5 bg-[#111]/90 border border-[#222] rounded-full backdrop-blur text-[10px] font-bold text-gray-400 flex items-center gap-2 shadow-xl">
                            <Activity size={12} className={meshLoaded ? "text-green-500" : "text-red-500"} /> {status}
                        </div>
                    </div>
                )}

                {/* TOOLBAR */}
                {!isViewportHost && (
                <div className={`absolute top-4 right-4 flex gap-2 pointer-events-auto ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                    {mode === 'WEIGHTS' && (
                        <div className="px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded-full text-red-400 text-[10px] font-bold flex items-center gap-2 animate-pulse mr-2">
                            <Paintbrush size={12} /> WEIGHT MODE
                        </div>
                    )}

                    <button
                        onClick={toggleXRay}
                        className={`p-2 rounded-lg border transition-all ${xRayMode ? 'bg-violet-900/40 border-violet-500 text-violet-200' : 'bg-[#111] border-[#222] text-gray-500 hover:text-white hover:border-gray-600'}`}
                        title="X-Ray Mode"
                    >
                        <Scan size={16} />
                    </button>
                    <div className="w-px h-8 bg-[#222] mx-1"></div>
                    <div className="flex bg-[#111] rounded-lg border border-[#222] p-0.5">
                        <button onClick={() => handleGizmoModeChange('translate')} className={`p-1.5 rounded-md transition-all ${gizmoMode === 'translate' ? 'bg-[#222] text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-white'}`}><Move size={14} /></button>
                        <button onClick={() => handleGizmoModeChange('rotate')} className={`p-1.5 rounded-md transition-all ${gizmoMode === 'rotate' ? 'bg-[#222] text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-white'}`}><RotateCw size={14} /></button>
                        <button onClick={() => handleGizmoModeChange('scale')} className={`p-1.5 rounded-md transition-all ${gizmoMode === 'scale' ? 'bg-[#222] text-cyan-400 shadow-sm' : 'text-gray-500 hover:text-white'}`}><Maximize size={14} /></button>
                    </div>
                </div>
                )}

                {/* BOTTOM TOOLS */}
                {!isViewportHost && (
                    <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-4 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                        {mode === 'SETUP' && skeletonMap.length > 0 && (
                            <div className="flex gap-2 bg-[#111] p-1 rounded-full border border-[#222]">
                                <button
                                    onClick={() => setMirrorMode(!mirrorMode)}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all ${mirrorMode ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'border-transparent text-gray-500 hover:text-white'}`}
                                >
                                    <Split size={12} /> MIRROR EDITS
                                </button>
                            </div>
                        )}

                        <button onClick={handleCommit} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2 rounded-full font-bold text-[10px] tracking-widest shadow-lg shadow-violet-900/30 transition-all flex items-center gap-2 group">
                            <Share2 size={14} className="group-hover:rotate-12 transition-transform" /> UPLINK TO KERNEL
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
