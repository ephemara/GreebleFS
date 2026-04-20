
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Share2, Grid, Mountain, Box, Columns, Maximize } from 'lucide-react';

import KAtlasUI from './KAtlasUI';
import { createKippUVGrid, applyUVProjection, applyLSCM, ProjectionConfig } from './KAtlasUVEngine';
import { applyBoxProjection } from './KAtlasBox';
import { setupMaterialLink, updateMaterialView } from './KAtlasUVmatlink';
import { applyHybridAutoUnwrap } from './KAtlasHybrid';

import KAtlasUVEditor from './KAtlasUVEditor';
import KAtlasUVHologram from './KAtlasUVHologram';
import { useZenModuleBridge } from '../../../core/zen';

export default function KAtlas({ sharedState, onCommit, zenShellMode = 'standalone' }: any) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge('atlas');
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    // Core State
    const [projection, setProjection] = useState('ORIGINAL');
    const [targetAxis, setTargetAxis] = useState('Y'); // X, Y, Z
    const [coordSpace, setCoordSpace] = useState('LOCAL'); // LOCAL, WORLD
    const [status, setStatus] = useState("SYSTEM_IDLE");
    const [isProcessing, setIsProcessing] = useState(false);
    const [uvStats, setUvStats] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'GRID' | 'MATERIAL'>('GRID');
    const [showOriginal, setShowOriginal] = useState(true);
    const [layoutMode, setLayoutMode] = useState<'3D' | 'SPLIT' | '2D'>('SPLIT');

    // Multi-Mesh State
    const [hierarchy, setHierarchy] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedFaceIndices, setSelectedFaceIndices] = useState<number[]>([]);

    // Modifier Stack State
    const [scale, setScale] = useState(1.0);
    const [stretchU, setStretchU] = useState(1.0);
    const [stretchV, setStretchV] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [offsetU, setOffsetU] = useState(0.0);
    const [offsetV, setOffsetV] = useState(0.0);
    const [jitter, setJitter] = useState(0.0);

    // LSCM State
    const [lscmIterations, setLscmIterations] = useState(600);
    const [lscmPadding, setLscmPadding] = useState(2);
    const [lscmTexels, setLscmTexels] = useState(32);
    const [lscmResolution, setLscmResolution] = useState(1024);

    // Box Projection State
    const [boxPadding, setBoxPadding] = useState(0.005);
    const [boxWorldAlign, setBoxWorldAlign] = useState(true);
    const [boxCameraCount, setBoxCameraCount] = useState(6); // Multi-camera projection (6, 14, 26, 50, 98)

    // UV View Mode (2D flat vs 3D hologram)
    const [uvViewMode, setUvViewMode] = useState<'2D' | 'HOLOGRAM'>('HOLOGRAM');

    // Hybrid Mode State
    const [hybridAutoClassify, setHybridAutoClassify] = useState(true);
    const [hybridForceMode, setHybridForceMode] = useState<'AUTO' | 'LSCM' | 'BOX'>('AUTO');

    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        publishLayers([
            {
                id: 'atlas:working-set',
                name: 'Atlas Working Set',
                order: 0,
                tags: ['uv']
            }
        ]);
    }, [publishLayers]);

    useEffect(() => {
        publishState({
            status,
            viewMode,
            layoutMode,
            selectedIds,
            hierarchyCount: hierarchy.length
        });
    }, [hierarchy.length, layoutMode, publishState, selectedIds, status, viewMode]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            activeAssetId: sharedState?.activeArtifactId ?? null,
            activeLayerId: selectedIds[0] ?? 'atlas:working-set'
        });
    }, [isToolOverlay, publishSelection, selectedIds, sharedState?.activeArtifactId]);

    const engine = useRef<any>({
        scene: null, camera: null, renderer: null,
        rootGroup: null,
        controls: null, checkerTex: createKippUVGrid(),
        selectionBox: null,
        meshes: {}, // Map<uuid, Mesh>
        originalGeos: {} // Map<uuid, BufferGeometry>
    });

    // --- INIT ENGINE ---
    useEffect(() => {
        if (isToolOverlay) return;
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(w, h);
        renderer.setClearColor(0x050505);
        // Enable shadow map for better visualization regardless of material
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Output encoding to match PBR workflows
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        mountRef.current.appendChild(renderer.domElement);

        const scene = new THREE.Scene();

        const grid = new THREE.GridHelper(30, 30, 0x333333, 0x0a0a0a);
        grid.position.y = -2;
        scene.add(grid);

        const rootGroup = new THREE.Group();
        scene.add(rootGroup);

        const selectionBox = new THREE.BoxHelper(undefined, 0x00b894);
        selectionBox.visible = false;
        scene.add(selectionBox);

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambient);
        const dir = new THREE.DirectionalLight(0xffffff, 2.0);
        dir.position.set(5, 10, 5);
        dir.castShadow = true;
        scene.add(dir);
        const backLight = new THREE.DirectionalLight(0x00b894, 0.5);
        backLight.position.set(-5, 2, -5);
        scene.add(backLight);

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(6, 5, 6);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        const disconnectZenViewport = connectViewport({
            element: mountRef.current,
            scene,
            camera,
            controls,
            renderer
        });

        engine.current = { ...engine.current, scene, camera, renderer, controls, rootGroup, selectionBox };

        if (!sharedState?.artifact) {
            setStatus("AWAITING_SHARED_SCENE");
        }

        let frameId;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (mountRef.current && camera && renderer) {
                const nw = mountRef.current.clientWidth;
                const nh = mountRef.current.clientHeight;
                camera.aspect = nw / nh;
                camera.updateProjectionMatrix();
                renderer.setSize(nw, nh);
            }
        };
        // Use ResizeObserver for more robust resizing in split view
        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(mountRef.current);

        return () => {
            disconnectZenViewport();
            resizeObserver.disconnect();
            cancelAnimationFrame(frameId);
            renderer.dispose();
            if (mountRef.current) mountRef.current.innerHTML = '';
        };
    }, [connectViewport, isToolOverlay]);

    // --- KERNEL HOT-SWAP ---
    useEffect(() => {
        if (isToolOverlay) return;
        if (sharedState?.artifact && engine.current.rootGroup) {
            setStatus("SYNCING_KERNEL...");
            const url = URL.createObjectURL(sharedState.artifact);
            const loader = new GLTFLoader();
            loader.load(url, (gltf) => {
                loadScene(gltf.scene);
                URL.revokeObjectURL(url);
            });
        }
    }, [isToolOverlay, sharedState?.artifact]);

    // --- VIEW MODE TOGGLE EFFECT ---
    useEffect(() => {
        const { rootGroup, checkerTex } = engine.current;
        if (rootGroup) {
            const commonMat = new THREE.MeshStandardMaterial({
                map: checkerTex,
                color: 0xffffff,
                roughness: 0.3,
                metalness: 0.2,
                side: THREE.DoubleSide
            });

            updateMaterialView(rootGroup, viewMode === 'MATERIAL', commonMat);
        }
    }, [viewMode]);

    const loadScene = (sceneRoot) => {
        const { rootGroup, checkerTex } = engine.current;

        // Clear old
        while (rootGroup.children.length > 0) {
            const c = rootGroup.children[0];
            rootGroup.remove(c);
            if (c.geometry) c.geometry.dispose();
        }

        engine.current.meshes = {};
        engine.current.originalGeos = {};

        const newHierarchy: any[] = [];
        const newIds: string[] = [];

        // Center the whole scene first
        const box = new THREE.Box3().setFromObject(sceneRoot);
        const center = box.getCenter(new THREE.Vector3());
        sceneRoot.position.sub(center);

        const commonMat = new THREE.MeshStandardMaterial({
            map: checkerTex,
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.2,
            side: THREE.DoubleSide
        });

        // 1. Preserve Originals via MatLink
        setupMaterialLink(sceneRoot);

        let idx = 0;
        sceneRoot.traverse((child) => {
            if (child.isMesh) {
                const newGeo = child.geometry.clone();
                newGeo.computeVertexNormals();

                // Only generate basic UVs if none exist
                if (!newGeo.attributes.uv) {
                    const count = newGeo.attributes.position.count;
                    newGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
                }

                child.castShadow = true;
                child.receiveShadow = true;

                if (!child.name) child.name = `Polygroup_${idx}`;

                engine.current.meshes[child.uuid] = child;
                engine.current.originalGeos[child.uuid] = newGeo.clone(); // Backup with original UVs

                newHierarchy.push({
                    id: child.uuid,
                    name: child.name,
                    visible: true,
                    verts: newGeo.attributes.position.count
                });
                newIds.push(child.uuid);
                idx++;
            }
        });

        // 2. Apply initial view mode
        updateMaterialView(sceneRoot, viewMode === 'MATERIAL', commonMat);

        rootGroup.add(sceneRoot);
        setHierarchy(newHierarchy);
        setSelectedIds(newIds);
        setProjection('ORIGINAL'); // Reset projection mode
        setStatus(`SCENE_LOADED: ${idx} MESHES`);
    };

    const handleSelection = (id: string, multi: boolean) => {
        let newSelection = [...selectedIds];
        if (multi) {
            if (newSelection.includes(id)) newSelection = newSelection.filter(uid => uid !== id);
            else newSelection.push(id);
        } else {
            newSelection = [id];
        }
        setSelectedIds(newSelection);

        // Update Selection Box
        const { selectionBox, meshes } = engine.current;
        if (newSelection.length > 0) {
            if (newSelection.length === 1) {
                const m = meshes[newSelection[0]];
                if (m) { selectionBox.setFromObject(m); selectionBox.visible = true; }
            } else {
                selectionBox.visible = false;
            }
        } else {
            selectionBox.visible = false;
        }
    };

    const toggleVis = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const mesh = engine.current.meshes[id];
        if (mesh) {
            mesh.visible = !mesh.visible;
            setHierarchy(prev => prev.map(item => item.id === id ? { ...item, visible: mesh.visible } : item));
        }
    };

    // --- THE MULTI-WAR ALGORITHM ---
    const performUnwrap = (forceProj: string | null = null) => {
        if (selectedIds.length === 0) { setStatus("NO_MESH_SELECTED"); return; }

        const pMode = forceProj || projection;
        const { meshes, camera, originalGeos } = engine.current;

        setIsProcessing(true);
        setStatus(`BATCH_COMPUTE: ${pMode} [${coordSpace}]`);

        setTimeout(() => {
            let totalVerts = 0;

            // Projection Config Bundle
            const config: ProjectionConfig = {
                projection: pMode,
                targetAxis: targetAxis,
                coordSpace: coordSpace,
                scale: scale,
                stretchU: stretchU,
                stretchV: stretchV,
                rotation: rotation,
                offsetU: offsetU,
                offsetV: offsetV,
                jitter: jitter,
                camera: camera
            };

            const promises: Promise<void>[] = [];

            selectedIds.forEach(id => {
                const mesh = meshes[id];
                if (!mesh || !mesh.visible) return;

                if (config.projection === 'LSCM') {
                    const lscmConfig = {
                        maxIterations: lscmIterations,
                        padding: lscmPadding,
                        texelsPerUnit: lscmTexels,
                        resolution: lscmResolution
                    };
                    promises.push(applyLSCM(mesh, lscmConfig).then(count => {
                        totalVerts += count;
                    }));
                } else if (config.projection === 'BOX_6AXIS') {
                    // Start of Box Logic
                    applyBoxProjection(mesh, { padding: boxPadding, worldAlign: boxWorldAlign, cameraCount: boxCameraCount });
                    totalVerts += mesh.geometry.attributes.position.count;
                    promises.push(Promise.resolve());
                } else if (config.projection === 'HYBRID_AUTO') {
                    // New Hybrid Auto Mode - Intelligent unwrapping
                    const hybridConfig = {
                        lscmIterations: lscmIterations,
                        boxPadding: boxPadding,
                        boxWorldAlign: boxWorldAlign,
                        boxCameraCount: boxCameraCount,
                        autoClassify: hybridAutoClassify,
                        forceMode: hybridForceMode === 'AUTO' ? undefined : hybridForceMode
                    };

                    promises.push(applyHybridAutoUnwrap(mesh, hybridConfig).then(result => {
                        totalVerts += result.vertCount;
                        console.log(`Hybrid: ${result.classification} → ${result.solver} solver`);
                    }));
                } else {
                    const vertCount = applyUVProjection(mesh, originalGeos[id], config);
                    totalVerts += vertCount;
                }
            });

            Promise.all(promises).then(() => {
                setUvStats({ verts: totalVerts, meshes: selectedIds.length });
                setIsProcessing(false);
                setStatus("TOPOLOGY_UPDATED");
                // Force update editor by toggling selection or similar? 
                // Actually the Editor depends on selectedIds and meshes. 
                // If meshes geometry changes, we might need to signal update.
                // For now, we can just trigger a re-render of Editor by updating a dummy state or relying on selectedIds if they change.
                // But selectedIds don't change here.
                // We can pass a version number to Editor.
                setUvStats(prev => ({ ...prev, version: Date.now() }));
            });
        }, 20);
    };

    const handlePreset = (type: string) => {
        if (type === 'WALL') {
            setProjection('BOX');
            setCoordSpace('WORLD');
            setScale(1.0);
            setStretchU(1.0); setStretchV(1.0);
            setJitter(0.0);
            setTimeout(() => performUnwrap('BOX'), 0);
        } else if (type === 'FLOOR') {
            setProjection('PLANAR_AXIS');
            setTargetAxis('Y');
            setCoordSpace('WORLD');
            setScale(0.5);
            setJitter(0.0);
            setTimeout(() => performUnwrap('PLANAR_AXIS'), 0);
        } else if (type === 'PROP') {
            setProjection('BOX');
            setCoordSpace('LOCAL');
            setScale(1.0);
            setJitter(0.0);
            setTimeout(() => performUnwrap('BOX'), 0);
        } else if (type === 'ATLAS_GRID') {
            setProjection('BOX');
            setScale(4.0);
            setTimeout(() => performUnwrap('BOX'), 0);
        }
    };

    const handlePack = () => {
        // Simple Grid Packer
        if (selectedIds.length === 0) return;

        const { meshes } = engine.current;
        const cols = Math.ceil(Math.sqrt(selectedIds.length));
        const cellSize = 1.0 / cols;

        setStatus(`PACKING ${selectedIds.length} ISLANDS...`);

        selectedIds.forEach((id, idx) => {
            const mesh = meshes[id];
            if (!mesh) return;

            const col = idx % cols;
            const row = Math.floor(idx / cols);

            const uOff = col * cellSize;
            const vOff = row * cellSize;

            const geo = mesh.geometry;
            const uvs = geo.attributes.uv;

            for (let i = 0; i < uvs.count; i++) {
                let u = uvs.getX(i);
                let v = uvs.getY(i);

                // Normalize to 0-1 first if needed, but assuming they are already mapped 0-1
                // Scale down
                u = u * cellSize + uOff;
                v = v * cellSize + vOff;

                uvs.setXY(i, u, v);
            }
            uvs.needsUpdate = true;
        });
        setStatus("PACKING COMPLETE");
        setUvStats(prev => ({ ...prev, version: Date.now() }));
    };

    const handleCommit = () => {
        const { rootGroup } = engine.current;
        if (!rootGroup) return;
        setStatus("PACKING_SCENE...");

        // RESTORE MATERIALS BEFORE EXPORT if currently in GRID mode, 
        // or should we export what is seen? Typically user wants the UVs on their original mats.
        // So we force restore originals momentarily or just clone and restore.

        // Let's force restore originals for export to keep material data
        const commonMat = new THREE.MeshStandardMaterial(); // dummy
        updateMaterialView(rootGroup, true, commonMat);

        const exporter = new GLTFExporter();
        exporter.parse(
            rootGroup,
            (gltf) => {
                const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
                if (onCommit) {
                    onCommit(blob, "K-ATLAS_UNWRAP");
                    setStatus("SENT TO KERNEL");
                }
                // Restore view mode
                updateMaterialView(rootGroup, viewMode === 'MATERIAL', engine.current.checkerTex);
            },
            (err) => console.error(err),
            { binary: true }
        );
    };

    return (
        <div className={`h-screen text-gray-300 font-mono flex overflow-hidden select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>

            {!isViewportHost && (
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KAtlasUI
                        hierarchy={hierarchy}
                        selectedIds={selectedIds}
                        onSelect={handleSelection}
                        onSelectAll={() => setSelectedIds(hierarchy.map(h => h.id))}
                        onToggleVis={toggleVis}

                        coordSpace={coordSpace} setCoordSpace={setCoordSpace}
                        projection={projection} setProjection={setProjection}
                        targetAxis={targetAxis} setTargetAxis={setTargetAxis}

                        scale={scale} setScale={setScale}
                        stretchU={stretchU} setStretchU={setStretchU}
                        stretchV={stretchV} setStretchV={setStretchV}
                        rotation={rotation} setRotation={setRotation}
                        offsetU={offsetU} setOffsetU={setOffsetU}
                        offsetV={offsetV} setOffsetV={setOffsetV}

                        onPerformUnwrap={performUnwrap}
                        isProcessing={isProcessing}
                        uvStats={uvStats}

                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        showOriginal={showOriginal}
                        setShowOriginal={setShowOriginal}

                        jitter={jitter} setJitter={setJitter}
                        onPack={handlePack}
                        onPreset={handlePreset}

                        lscmIterations={lscmIterations} setLscmIterations={setLscmIterations}
                        lscmPadding={lscmPadding} setLscmPadding={setLscmPadding}
                        lscmTexels={lscmTexels} setLscmTexels={setLscmTexels}
                        lscmResolution={lscmResolution} setLscmResolution={setLscmResolution}

                        boxPadding={boxPadding} setBoxPadding={setBoxPadding}
                        boxWorldAlign={boxWorldAlign} setBoxWorldAlign={setBoxWorldAlign}
                        boxCameraCount={boxCameraCount} setBoxCameraCount={setBoxCameraCount}

                        hybridAutoClassify={hybridAutoClassify} setHybridAutoClassify={setHybridAutoClassify}
                        hybridForceMode={hybridForceMode} setHybridForceMode={setHybridForceMode}
                    />
                </div>
            )}

            <div className="flex-1 relative flex overflow-hidden">

                {/* LAYOUT TOGGLE - Positioned below top bar but above content */}
                {/* LAYOUT CONTROLS - Top Right - Icon Based */}
                {!isViewportHost && !isToolOverlay && (
                <div className="absolute top-2 right-2 flex bg-[#0a0a0a] border border-[#333] rounded-md p-1 gap-1 z-40 pointer-events-auto shadow-xl">
                    <button onClick={() => setLayoutMode('3D')} title="3D View Only"
                        className={`p-1.5 rounded transition-all ${layoutMode === '3D' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}>
                        <Box size={14} />
                    </button>
                    <button onClick={() => setLayoutMode('SPLIT')} title="Split Screen"
                        className={`p-1.5 rounded transition-all ${layoutMode === 'SPLIT' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}>
                        <Columns size={14} />
                    </button>
                    <button onClick={() => setLayoutMode('2D')} title="UV Editor Fullscreen"
                        className={`p-1.5 rounded transition-all ${layoutMode === '2D' ? 'bg-[#222] text-white shadow-sm' : 'text-gray-500 hover:text-white hover:bg-[#1a1a1a]'}`}>
                        <Maximize size={14} />
                    </button>
                </div>
                )}

                {/* 3D VIEW */}
                <div className={`relative ${isViewportHost || layoutMode !== '2D' ? 'flex-1' : 'hidden'} ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-gradient-to-b from-[#080808] to-[#050505]'}`}>
                    <div ref={mountRef} className={`absolute inset-0 cursor-move ${isToolOverlay ? 'opacity-0 pointer-events-none' : ''}`} />

                    {/* KIPP UPLINK */}
                    {!isViewportHost && !isToolOverlay && (
                    <button onClick={handleCommit} className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-[#000]/80 backdrop-blur-md border border-[#00ffcc]/50 text-[#00ffcc] px-8 py-3 rounded-full font-bold text-xs tracking-[0.2em] shadow-[0_0_30px_rgba(0,255,204,0.2)] hover:bg-[#00ffcc] hover:text-black hover:shadow-[0_0_50px_rgba(0,255,204,0.6)] transition-all duration-300 flex items-center gap-3 group overflow-hidden">
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" /> <Share2 size={16} className="group-hover:rotate-12 transition-transform" /> UPLINK TO KERNEL
                    </button>
                    )}

                    {!isViewportHost && !isToolOverlay && (
                        <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
                            <div className="text-teal-400 text-[10px] font-bold bg-[#000]/80 backdrop-blur-md px-4 py-2 rounded-sm border-l-2 border-teal-500 flex items-center gap-3 shadow-xl">
                                <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-yellow-400 animate-ping' : 'bg-teal-400'}`} />
                                <span className="font-mono tracking-wider">{status}</span>
                            </div>
                        </div>
                    )}

                    {!isViewportHost && !isToolOverlay && (
                        <div className="absolute bottom-6 right-6 text-right pointer-events-none opacity-30">
                            <h2 className="text-4xl font-black text-[#222] tracking-tighter">kipp engine</h2>
                            <p className="text-[10px] font-mono text-gray-600">0.5 alpha</p>
                        </div>
                    )}
                </div>

                {/* UV VIEW (2D or HOLOGRAM) */}
                {!isViewportHost && !isToolOverlay && (layoutMode === 'SPLIT' || layoutMode === '2D') && (
                    <div className={`relative ${layoutMode === 'SPLIT' ? 'w-1/2 border-l border-[#222]' : 'flex-1'} bg-[#111]`}>
                        {/* UV View Mode Toggle */}
                        {/* UV View Mode Toggle - Left - Capsule Style */}
                        <div className="absolute top-2 left-2 z-50 flex bg-[#0a0a0a]/80 backdrop-blur-sm border border-[#333] rounded-full p-1 gap-1">
                            <button
                                onClick={() => setUvViewMode('2D')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full transition-all ${uvViewMode === '2D'
                                        ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                                        : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                <Grid size={10} /> 2D FLAT
                            </button>
                            <button
                                onClick={() => setUvViewMode('HOLOGRAM')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full transition-all ${uvViewMode === 'HOLOGRAM'
                                        ? 'bg-[#00ffcc] text-black shadow-[0_0_15px_rgba(0,255,204,0.3)]'
                                        : 'text-gray-500 hover:text-[#00ffcc]'
                                    }`}
                            >
                                <Mountain size={10} /> HOLOGRAM
                            </button>
                        </div>

                        {/* Render based on mode */}
                        {uvViewMode === '2D' ? (
                            <KAtlasUVEditor
                                meshes={engine.current.meshes}
                                selectedIds={selectedIds}
                                syncSelection={selectedFaceIndices}
                                onSelectionChange={setSelectedFaceIndices}
                                version={uvStats?.version || 0}
                            />
                        ) : (
                            <KAtlasUVHologram
                                meshes={engine.current.meshes}
                                selectedIds={selectedIds}
                                version={uvStats?.version || 0}
                            />
                        )}
                    </div>
                )}

            </div>

        </div>
    );
}
