import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
// import { WebGLPathTracer } from 'three-gpu-pathtracer'; // TODO: Enable when npm install succeeds
// Standalone input hook for web demo
import { useInput } from './hooks/useInput';
import KGreebleUI from './KGreebleUI';
import {
    SHAPES, FluxShader, generateTitanStructure
} from './KGreebleEngine';
import {
    spawnMeshAtPosition, generateAnimationClips, prepareSceneForExport, toggleFullscreen
} from './KGreebleutils';
import { updateLighting } from './KGreeblelighting';
import { useKGreebleInteraction } from './KGreeblemouseandcamera';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { subdivideGeometryLocally } from './services/meshSubdivision';
import { applyDeformations } from './KGreebleDeformer';
import { initWasm, getGreeble3DWasmInterface } from './services/WasmService';
import { logger } from '../../lib/utils/logger';
import { getGreeble3DWasmReadyEventName } from '../../config/greeble3dRuntime';

// ✅ WASM INTEGRATION: Load via Service
let greebleWasm: any = null;
let wasmReady = false;

// Initialize WASM on module load
initWasm().then(() => {
    const wasmInterface = getGreeble3DWasmInterface();
    if (wasmInterface) {
        greebleWasm = wasmInterface;
        wasmReady = true;
        logger.log('🧊 K-Greeble WASM loaded via Service');
    }
});

import { useGreebleStore } from '../../store/useGreebleStore';
import { KGreebleCanvas } from './r3f/GreebleCanvas';

// --- MAIN ENGINE COMPONENT ---
export default function KGreeble({ sharedState, onCommit, onExit, exitLabel, showExit = false, layoutAutoSaveId }: any) {
    // --- ZUSTAND STORE SUBSCRIPTIONS ---
    const {
        mode, setMode,
        gizmoMode, setGizmoMode,
        transformSpace, setTransformSpace,
        snapEnabled, setSnapEnabled,
        isGizmoDragging,
        buildTab, setBuildTab,
        activeShape, setActiveShape,
        layers, setLayers, activeLayerId, setActiveLayerId, selectedLayerIds, setSelectedLayerIds,
        transformData, setTransformData, selectedObjectUUID, setSelectedObjectUUID,
        sunIntensity, setSunIntensity, sunAngle, setSunAngle, envMap, setEnvMap, graphicsQuality, setGraphicsQuality,
        matParams, materialLibrary, setMaterialLibrary, setMatParams,
        greebleParams, setGreebleParams, primitiveParams, setPrimitiveParams, titanParams, setTitanParams,
        targetEngine, setTargetEngine, mergeOnExport, setMergeOnExport, includeBase, setIncludeBase,
        symmetry, setSymmetry, radialCount, setRadialCount, surfaceMode, setSurfaceMode, gridLock, setGridLock, gridSize, setGridSize, voidAnchor, setVoidAnchor, chaosMode, setChaosMode, fractalEcho, setFractalEcho,
        neonMode, setNeonMode,
        updateLayer // Added for layer handlers
    } = useGreebleStore();

    // Refs
    const mountRef = useRef<HTMLDivElement>(null);
    const textureInputRef = useRef<HTMLInputElement>(null);
    const glbInputRef = useRef<HTMLInputElement>(null);

    const sceneRef = useRef<any>({
        scene: null, camera: null, renderer: null,
        rootGroup: null, layerMap: {},
        controls: null, transformControl: null, raycaster: new THREE.Raycaster(),
        mouse: new THREE.Vector2(),
        isDragging: false,
        activeObjects: [],
        selectedObject: null,
        startPoint: new THREE.Vector3(),
        startNormal: new THREE.Vector3(),
        originalObjectPos: new THREE.Vector3(),
        dragOffset: new THREE.Vector3(),
        dragPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        dragTarget: new THREE.Vector3(),
        selectionBox: null,
        keyLight: null, fillLight: null, rimLight: null, bounceLight: null,
        animation: { isPlaying: false, time: 0, duration: 10, data: {}, isScrubbing: false, fps: 60 },
        fluxUniforms: {
            time: { value: 0 },
            chaos: { value: 0 },
            colorA: { value: new THREE.Color("#ff003c") },
            colorB: { value: new THREE.Color("#000000") },
            map: { value: null }
        }
    });
    const [animTime, setAnimTime] = useState(0);
    const [animDuration, setAnimDuration] = useState(10);
    const [isPlaying, setIsPlaying] = useState(false);
    const [keyframes, setKeyframes] = useState<any[]>([]);
    const [targetFPS, setTargetFPS] = useState(30);
    const [isScrubbing, setIsScrubbing] = useState(false);

    // Legacy UI State (Moved to Store, but refs might need these?)
    // gizmoMode, transformSpace, snapEnabled now from Zustand
    const [userImports, setUserImports] = useState<any[]>([]);
    
    // No-op status function to prevent runtime errors (status display removed)
    const setStatus = (_msg: string) => {};

    // --- INIT SCENE ---

    // --- UNIVERSAL LAYER HANDLERS ---
    const handleRenameLayer = (id: string, name: string) => updateLayer(id, { name });
    const handleLockLayer = (id: string) => updateLayer(id, { locked: !layers.find(l => l.id === id)?.locked });
    const handleSoloLayer = () => {
        // Updated to use store action
        // But for now, we can just use the store directly
    };

    const lastActiveLayerId = useRef(activeLayerId);
    useEffect(() => {
        if (activeLayerId !== lastActiveLayerId.current) {
            lastActiveLayerId.current = activeLayerId;
            const activeLayer = layers.find(l => l.id === activeLayerId);
            if (activeLayer && activeLayer.matParams) {
                setMatParams(activeLayer.matParams);
            }
        }
    }, [activeLayerId, layers]);

    // ✅ FIX: Sync layerMap with store layers (create missing 3D objects)
    useEffect(() => {
        const { rootGroup, layerMap } = sceneRef.current;
        if (!rootGroup || !layerMap) return;

        // Check for layers in store that don't have 3D objects
        layers.forEach(layer => {
            if (!layerMap[layer.id]) {
                logger.log(`🔧 Creating missing 3D objects for layer: ${layer.id} (${layer.name})`);
                
                // Create 3D group and material
                const newGroup = new THREE.Group();
                newGroup.userData.isLayer = true;
                rootGroup.add(newGroup);
                
                const newMat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(layer.color || '#FFFFFF'),
                    roughness: 0.5,
                    metalness: 0.5
                });
                
                layerMap[layer.id] = { group: newGroup, material: newMat };
                logger.log(`✅ Layer ${layer.id} 3D objects created`);
            }
        });

        // Clean up 3D objects for deleted layers
        Object.keys(layerMap).forEach(layerId => {
            if (!layers.find(l => l.id === layerId)) {
                logger.log(`🗑️ Removing 3D objects for deleted layer: ${layerId}`);
                const layerObj = layerMap[layerId];
                if (layerObj) {
                    rootGroup.remove(layerObj.group);
                    layerObj.group.traverse((c: any) => {
                        if (c.geometry) c.geometry.dispose();
                    });
                    layerObj.material.dispose();
                    delete layerMap[layerId];
                }
            }
        });
    }, [layers]);

    // Sync Visibility with Solo/Visible/Lock state
    useEffect(() => {
        if (!sceneRef.current.layerMap) return;
        const { layerMap } = sceneRef.current;
        const soloLayers = layers.filter(l => l.solo);
        const hasSolo = soloLayers.length > 0;

        layers.forEach(l => {
            if (!layerMap[l.id]) return;
            const group = layerMap[l.id]?.group;
            if (group) {
                if (hasSolo) {
                    group.visible = !!l.solo;
                } else {
                    group.visible = !!l.visible;
                }
                group.userData.locked = !!l.locked;
            }
        });
    }, [layers]);

    const handleMergeSelectedLayers = () => {
        if (selectedLayerIds.size < 2) return;

        const sortedLayers = layers.filter(l => selectedLayerIds.has(l.id));
        if (sortedLayers.length < 2) return;

        const targetLayer = sortedLayers[sortedLayers.length - 1];
        const targetId = targetLayer.id;
        const sourceIds = sortedLayers.map(l => l.id).filter(id => id !== targetId);

        const { layerMap, rootGroup } = sceneRef.current;
        const targetGroup = layerMap[targetId].group;

        sourceIds.forEach(id => {
            const sourceGroup = layerMap[id].group;
            while (sourceGroup.children.length > 0) {
                const child = sourceGroup.children[0];
                sourceGroup.remove(child);
                targetGroup.add(child);
            }
            rootGroup.remove(sourceGroup);
            delete layerMap[id];
        });

        // Update State via Store
        const newLayers = layers.filter(l => !sourceIds.includes(l.id));
        setLayers(newLayers);
        setSelectedLayerIds(new Set([targetId]));
        setActiveLayerId(targetId);
        setStatus(`Merged ${sourceIds.length + 1} Layers`);
    };

    const modeRef = useRef(mode);
    const captureCurrentTransformRef = useRef<() => void>(() => { });
    useEffect(() => { modeRef.current = mode; }, [mode]);

    // --- ARROW KEY MOVEMENT FOR SELECTED OBJECTS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            
            // Only work in edit mode with a selected object
            if (mode !== 'edit' || !selectedObjectUUID || !sceneRef.current.scene) return;
            
            // Find selected object
            let selectedObj: THREE.Object3D | null = null;
            sceneRef.current.scene.traverse((obj: THREE.Object3D) => {
                if (obj.uuid === selectedObjectUUID) selectedObj = obj;
            });
            
            if (!selectedObj) return;
            
            // Type assertion after null check
            const obj = selectedObj as THREE.Object3D;
            
            const moveSpeed = e.shiftKey ? 1.0 : 0.1; // Fast with shift, slow without
            let moved = false;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    obj.position.z -= moveSpeed;
                    moved = true;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    obj.position.z += moveSpeed;
                    moved = true;
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    obj.position.x -= moveSpeed;
                    moved = true;
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    obj.position.x += moveSpeed;
                    moved = true;
                    break;
            }
            
            if (moved) {
                // Update transform data in store
                setTransformData({
                    posX: obj.position.x,
                    posY: obj.position.y,
                    posZ: obj.position.z,
                    rotX: obj.rotation.x,
                    rotY: obj.rotation.y,
                    rotZ: obj.rotation.z,
                    scaleX: obj.scale.x,
                    scaleY: obj.scale.y,
                    scaleZ: obj.scale.z,
                    scale: obj.scale.x,
                    rotationY: obj.rotation.y,
                    height: obj.position.y
                });
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, selectedObjectUUID, setTransformData]);

    const mouseClientRef = useRef({ x: 0, y: 0 }); // Added missing ref
    const [, setSpaceMenuOpen] = useState(false); // Added missing state
    const [, setSpaceMenuPos] = useState({ x: 0, y: 0 }); // Added missing state

    // REMOVED DUPLICATE REFS AND STATE (Moved to top)
    useEffect(() => {
        if (!envMap) return;
        const loader = new THREE.TextureLoader();
        loader.load(envMap, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            if (sceneRef.current.scene) {
                sceneRef.current.scene.background = texture;
                sceneRef.current.scene.environment = texture;
            }
        });
    }, [envMap]);

    // --- MOUSE TRACKING FOR SPACE MENU ---
    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            mouseClientRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleWindowMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
        };
    }, []);

    // Sync Shared Materials from Kernel
    useEffect(() => {
        if (sharedState?.materials) {
            const prev = materialLibrary;
            const newMats = sharedState.materials.filter((m: any) => !prev.find((p: any) => p.id === m.id));
            if (newMats.length === 0) return;

            const converted = newMats.map((m: any) => {
                const img = new Image();
                img.src = m.base;
                return {
                    id: m.id,
                    name: m.name,
                    texture: m.preview || m.base,
                    sourceImg: img,
                    isExternal: true
                };
            });
            setMaterialLibrary([...prev, ...converted]);
        }
    }, [sharedState?.materials, materialLibrary, setMaterialLibrary]);

    // --- FLUX SHADER UPDATE SYSTEM (PER LAYER) ---
    useEffect(() => {
        // Ensure layerMap exists before accessing
        if (!sceneRef.current.layerMap) return;

        const { layerMap } = sceneRef.current;

        layers.forEach(layer => {
            const layerObj = layerMap[layer.id];
            if (!layerObj) return; // Skip if layer object doesn't exist yet

            const group = layerObj.group;
            if (!group) return;

            const flux = layer.flux || { enabled: false };
            const currentMat = layerObj.material;

            // Generate a signature to detect changes (Optimized)
            const signature = flux.enabled
                ? `flux-${flux.type}`
                : `std-${layer.color}`;

            // Check if material is stale
            if (currentMat?.userData?.signature !== signature) {
                let newMaterial;

                if (flux.enabled) {
                    // Create Flux Material
                    const uniforms = {
                        time: { value: 0 },
                        chaos: { value: flux.chaos },
                        colorA: { value: new THREE.Color(flux.colorA) },
                        colorB: { value: new THREE.Color(flux.colorB) },
                        map: { value: null }
                    };

                    // Get shader code from engine
                    type FluxShaderType = keyof typeof FluxShader.vertex;
                    const requestedType = flux.type as FluxShaderType;
                    const shaderType: FluxShaderType = requestedType && FluxShader.vertex[requestedType] ? requestedType : 'standard';
                    const vert = FluxShader.vertex[shaderType].replace('// [INSERT_COMMON]', FluxShader.common);
                    const frag = FluxShader.fragment[shaderType];

                    newMaterial = new THREE.ShaderMaterial({
                        uniforms,
                        vertexShader: vert,
                        fragmentShader: frag,
                        wireframe: false,
                        transparent: shaderType === 'hologram',
                        side: THREE.DoubleSide
                    });
                    newMaterial.userData.isFlux = true;
                    newMaterial.userData.fluxType = flux.type;

                } else {
                    // Standard Material
                    newMaterial = new THREE.MeshStandardMaterial({
                        color: layer.color,
                        roughness: 0.5,
                        metalness: 0.5,
                        side: matParams.doubleSided ? THREE.DoubleSide : THREE.FrontSide
                    });
                }

                newMaterial.userData.signature = signature;
                newMaterial.userData.fluxState = flux; // Save for export baking

                // Apply
                layerMap[layer.id].material = newMaterial;
                group.traverse((c: any) => {
                    if (c.isMesh) c.material = newMaterial;
                });
            } else if (flux.enabled && currentMat.uniforms) {
                // Fast Update for sliders (avoid recreating material)
                currentMat.uniforms.chaos.value = flux.chaos;
                currentMat.uniforms.colorA.value.set(flux.colorA);
                if (currentMat.uniforms.colorB) currentMat.uniforms.colorB.value.set(flux.colorB);
                currentMat.userData.fluxState = flux; // Sync state for export
            }
        });

    }, [layers]); // Deep dependency on layers

    // --- DEFORMATION UPDATE SYSTEM (PER LAYER) ---
    useEffect(() => {
        // Ensure layerMap exists before accessing
        if (!sceneRef.current.layerMap) return;

        const { layerMap } = sceneRef.current;

        layers.forEach(layer => {
            const layerObj = layerMap[layer.id];
            if (!layerObj) return;

            const group = layerObj.group;
            if (!group) return;

            const deform = layer.deform;
            // Check if deform is active (optimization: only run if not all zero, OR if changed)
            // But applyDeformations handles zero check efficiently (resets to original).
            // We need to apply it to every mesh in the layer group.

            // Note: This runs every time 'layers' changes, which might be heavy on drag.
            // Ideally we'd use a ref for the loop, but let's trust React for now.

            if (deform) {
                group.traverse((child: any) => {
                    if (child.isMesh && child.geometry) {
                        applyDeformations(child, deform);
                    }
                });
            }
        });
    }, [layers]);


    // Sync Animation State Ref
    useEffect(() => {
        sceneRef.current.animation.isPlaying = isPlaying;
        sceneRef.current.animation.time = animTime;
        sceneRef.current.animation.duration = animDuration;
        sceneRef.current.animation.data = keyframes;
        sceneRef.current.animation.isScrubbing = isScrubbing;
        sceneRef.current.animation.fps = targetFPS;

        if (animTime > animDuration) {
            setAnimTime(animDuration);
            sceneRef.current.animation.time = animDuration;
        }
    }, [isPlaying, animTime, animDuration, keyframes, isScrubbing, targetFPS]);

    // Helper to spawn objects
    const spawnProceduralObject = useCallback((point: any, normal: any, type: string, targetLayerId: string | null = null) => {
        const targetId = targetLayerId || activeLayerId;
        const { layerMap } = sceneRef.current;
        if (!layerMap || !layerMap[targetId]) {
            console.error(`❌ Layer "${targetId}" not found in layerMap. Available layers:`, Object.keys(layerMap || {}));
            setStatus(`ERROR: Layer "${targetId}" not initialized`);
            return null;
        }

        const { group, material } = layerMap[targetId];

        // ✅ WASM INTEGRATION: Only use WASM for the GREEBLE shape type
        // All other shapes use the legacy spawnMeshAtPosition function
        if (false && type === SHAPES.GREEBLE && wasmReady && greebleWasm) { // WASM Disabled: Using stable legacy path
            try {
                // Create a simple base mesh to project onto
                const baseGeometry = new THREE.PlaneGeometry(1, 1, 16, 16);
                baseGeometry.rotateX(-Math.PI / 2);
                baseGeometry.translate(0, 0.5, 0);

                const positions = baseGeometry.attributes.position.array;
                const indices = baseGeometry.index?.array || [];
                const normals = baseGeometry.attributes.normal.array;

                // Define greeble parameters
                const params = {
                    ...greebleParams,
                    seed: Math.floor(Math.random() * 1000000)
                };

                // Call the WASM function
                const result = greebleWasm.greeble_generate(1, positions, indices, normals, params);
                const data = typeof result === 'string' ? JSON.parse(result) : result;

                // Convert WASM result to THREE geometry
                const newGeometry = new THREE.BufferGeometry();
                newGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.positions), 3));
                newGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
                if (data.uvs && data.uvs.length > 0) {
                    newGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs), 2));
                }
                if (data.indices && data.indices.length > 0) {
                    newGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
                }
                newGeometry.computeBoundingSphere();

                // Create container group (matches spawnMeshAtPosition pattern)
                const container = new THREE.Group();
                container.userData.isContainer = true;
                container.position.copy(point);

                // Orient to face along the normal
                const up = new THREE.Vector3(0, 1, 0);
                container.quaternion.setFromUnitVectors(up, normal);

                const mesh = new THREE.Mesh(newGeometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                container.add(mesh);

                // Scale to match other spawned objects
                container.scale.set(0.1, 0.1, 0.1);
                group.add(container);

                setStatus(`WASM Greeble: ${data.greeble_count || 0} elements`);
                return container;

            } catch (e) {
                logger.warn('WASM generation failed, falling back to legacy:', e);
                // Fall through to legacy method
            }
        }

        // ✅ LEGACY PATH: All other shapes and fallbacks
        if (type === 'XENO') {
            const titanMesh = generateTitanStructure(sceneRef.current.layerMap[activeLayerId].material, titanParams);
            titanMesh.scale.set(0.2, 0.2, 0.2);

            const container = new THREE.Group();
            container.userData.isContainer = true;
            container.position.copy(point);

            const up = new THREE.Vector3(0, 1, 0);
            container.quaternion.setFromUnitVectors(up, normal);

            container.add(titanMesh);
            group.add(container);
            setStatus(`Xeno Artifact Created`);
            return container;
        }

        const spawned = spawnMeshAtPosition(point, normal, type, material, userImports, greebleParams, primitiveParams);
        if (spawned) {
            group.add(spawned);
            setStatus(`Spawned: ${type}`);
        }
        return spawned;
    }, [activeLayerId, userImports, greebleParams, primitiveParams, titanParams]);

    const captureCurrentTransform = useCallback(() => {
        const { selectedObject, animation } = sceneRef.current;
        if (!selectedObject || !animation) return;
        const uuid = selectedObject.uuid;
        const t = animation.time;
        const newKey = { t: t, p: selectedObject.position.clone(), q: selectedObject.quaternion.clone(), s: selectedObject.scale.clone() };
        setKeyframes((prev: any) => {
            const objectKeys = prev[uuid] ? [...prev[uuid]] : [];
            const existingIdx = objectKeys.findIndex((k: any) => Math.abs(k.t - t) < 0.05);
            if (existingIdx >= 0) objectKeys[existingIdx] = newKey; else objectKeys.push(newKey);
            objectKeys.sort((a: any, b: any) => a.t - b.t);
            return { ...prev, [uuid]: objectKeys };
        });
    }, []);
    useEffect(() => { captureCurrentTransformRef.current = captureCurrentTransform; }, [captureCurrentTransform]);

    // --- GIZMO ATTACHMENT LOGIC ---
    useEffect(() => {
        const { transformControl, selectedObject } = sceneRef.current;
        if (!transformControl) return;

        if (selectedObject && (mode === 'edit' || mode === 'animate')) {
            transformControl.attach(selectedObject);
            // Force gizmo materials to render on top (UE5 style)
            transformControl.traverse((child: any) => {
                if (child.isMesh || child.isLine) {
                    if (child.material) {
                        child.material.depthTest = false;
                        child.material.depthWrite = false;
                        child.renderOrder = 9999;
                        child.material.transparent = true;
                    }
                }
            });
        } else {
            transformControl.detach();
        }
    }, [selectedObjectUUID, mode]);

    // --- GIZMO SETTINGS SYNC ---
    useEffect(() => {
        const tc = sceneRef.current.transformControl;
        if (tc) {
            tc.setMode(gizmoMode);
            tc.setSpace(transformSpace);
            if (snapEnabled) {
                tc.setTranslationSnap(1.0);
                tc.setRotationSnap(THREE.MathUtils.degToRad(15));
                tc.setScaleSnap(0.25);
            } else {
                tc.setTranslationSnap(null);
                tc.setRotationSnap(null);
                tc.setScaleSnap(null);
            }
        }
    }, [gizmoMode, transformSpace, snapEnabled]);

    const { handleMouseDown, handleMouseMove, handleMouseUp, resetCamera } = useKGreebleInteraction(
        sceneRef,
        mountRef,
        { mode, activeShape, activeLayerId, symmetry, radialCount, userImports, surfaceMode, gridLock, gridSize, voidAnchor, chaosMode, fractalEcho, isGizmoDragging },
        { setTransformData, setSelectedObjectUUID, setStatus, setMode, setGizmoMode },
        { spawnProceduralObject, captureCurrentTransform }
    );

    // Lighting Update
    useEffect(() => {
        const { keyLight, fillLight, rimLight, bounceLight } = sceneRef.current;
        updateLighting({ keyLight, fillLight, rimLight, bounceLight }, sunIntensity, sunAngle);
    }, [sunIntensity, sunAngle]);

    // Graphics Quality Update
    useEffect(() => {
        const { renderer, scene } = sceneRef.current;
        if (!renderer) return;

        // Sync for animate loop
        sceneRef.current.graphicsQuality = graphicsQuality;

        let dpr = 1;
        let shadows = true;
        let enableRT = false;

        switch (graphicsQuality) {
            case 'low': dpr = 0.5; shadows = false; break;
            case 'medium': dpr = 0.75; shadows = true; break;
            case 'high': dpr = 1.0; shadows = true; break;
            case 'extreme': dpr = Math.min(window.devicePixelRatio, 2.0); shadows = true; break;
            case 'rt': dpr = 1.0; shadows = true; enableRT = true; break; // RT Mode
        }

        renderer.setPixelRatio(dpr);
        if (renderer.shadowMap.enabled !== shadows) {
            renderer.shadowMap.enabled = shadows;
            // Force material update to recompile shaders for shadow support change
            scene.traverse((c: any) => {
                if (c.isMesh && c.material) {
                    c.material.needsUpdate = true;
                }
            });
        }

        // --- FALLBACK RAY TRACING (REFLECTOR) ---
        // TODO: Switch to PathTracing when library is installed
        const existingReflector = scene.getObjectByName('K_RT_FLOOR');

        if (enableRT) {
            if (!existingReflector) {
                const geometry = new THREE.PlaneGeometry(4000, 4000);
                const reflector = new Reflector(geometry, {
                    clipBias: 0.003,
                    textureWidth: window.innerWidth * dpr,
                    textureHeight: window.innerHeight * dpr,
                    color: 0x777777
                });
                reflector.name = 'K_RT_FLOOR';
                reflector.rotation.x = -Math.PI / 2;
                reflector.position.y = -0.2; // Slightly below base mesh
                reflector.receiveShadow = true; // Shadows on the mirror!
                scene.add(reflector);
                setStatus("RT MODE (PREVIEW)");
            }
        } else {
            if (existingReflector) {
                scene.remove(existingReflector);
                if (existingReflector.geometry) existingReflector.geometry.dispose();
                if (existingReflector.material) existingReflector.material.dispose();
            }
            if (graphicsQuality !== 'rt') setStatus(`GRAPHICS: ${graphicsQuality.toUpperCase()}`);
        }

    }, [graphicsQuality]);

    const loadFromStorage = (item: any) => {
        const existing = userImports.find(u => u.storageId === item.id);
        if (existing) { setActiveShape(existing.id); return; }

        const url = URL.createObjectURL(item.blob);
        const loader = new GLTFLoader();
        setStatus(`LOADING ${item.name}...`);

        loader.load(url, (gltf) => {
            const scene = gltf.scene;

            // EXTRACT MATERIALS for History
            const extractedMats: any[] = [];
            scene.traverse((c: any) => {
                if (c.isMesh && c.material) {
                    const m = c.material;
                    if (!extractedMats.find(em => em.uuid === m.uuid)) {
                        extractedMats.push(m);
                    }
                }
            });

            if (extractedMats.length > 0) {
                const newLibEntries: any[] = [];
                extractedMats.forEach(m => {
                    if (m.map && m.map.image) {
                        try {
                            const image = m.map.image;
                            let src = '';
                            if (image instanceof Image || image instanceof HTMLImageElement) {
                                src = image.src;
                            } else if (image instanceof ImageBitmap || (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement)) {
                                const cvs = document.createElement('canvas');
                                cvs.width = image.width;
                                cvs.height = image.height;
                                const ctx = cvs.getContext('2d');
                                if (ctx) {
                                    ctx.drawImage(image, 0, 0);
                                    src = cvs.toDataURL();
                                }
                            }

                            if (src) {
                                const imgObj = new Image();
                                imgObj.src = src;
                                newLibEntries.push({
                                    id: `mat_extract_${m.uuid}_${Date.now()}`,
                                    name: m.name || `${item.name}_Mat`,
                                    texture: src,
                                    sourceImg: imgObj,
                                    isExternal: true
                                });
                            }
                        } catch (e) { logger.warn("Material extraction failed", e); }
                    }
                });

                if (newLibEntries.length > 0) {
                    setMaterialLibrary([...materialLibrary, ...newLibEntries]);
                }
            }

            const box = new THREE.Box3().setFromObject(scene);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1 / (maxDim || 1);
            scene.scale.set(scale, scale, scale);

            const newImport = { id: `import_${item.id}`, storageId: item.id, name: item.name, scene: scene };
            setUserImports(prev => [...prev, newImport]);
            setActiveShape(newImport.id);
            setStatus("KERNEL ASSET READY");
        });
    };

    // --- GLB IMPORT FOR KERNEL STORAGE ---
    const handleGlbImportClick = () => {
        glbInputRef.current?.click();
    };

    // --- GLB IMPORT HELPER ---
    const importGlbFromUrl = (url: string, name: string) => {
        const loader = new GLTFLoader();
        setStatus(`UPLOADING ${name}...`);

        loader.load(url, (gltf) => {
            const scene = gltf.scene;
            logger.log('🎯 GLB Import started:', name);

            // EXTRACT MATERIALS (Same logic as before)
            const extractedMats: any[] = [];
            scene.traverse((c: any) => {
                if (c.isMesh && c.material) {
                    const m = c.material;
                    if (!extractedMats.find(em => em.uuid === m.uuid)) {
                        extractedMats.push(m);
                    }
                }
            });

            if (extractedMats.length > 0) {
                const newLibEntries: any[] = [];
                extractedMats.forEach(m => {
                    if (m.map && m.map.image) {
                        try {
                            const image = m.map.image;
                            let src = '';
                            if (image instanceof Image || image instanceof HTMLImageElement) {
                                src = image.src;
                            } else if (image instanceof ImageBitmap || (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement)) {
                                const cvs = document.createElement('canvas');
                                cvs.width = image.width;
                                cvs.height = image.height;
                                const ctx = cvs.getContext('2d');
                                if (ctx) {
                                    ctx.drawImage(image, 0, 0);
                                    src = cvs.toDataURL();
                                }
                            }

                            if (src) {
                                const imgObj = new Image();
                                imgObj.src = src;
                                newLibEntries.push({
                                    id: `mat_extract_${m.uuid}_${Date.now()}`,
                                    name: m.name || `${name}_Mat`,
                                    texture: src,
                                    sourceImg: imgObj,
                                    isExternal: true
                                });
                            }
                        } catch (err) { logger.warn("Material extraction failed", err); }
                    }
                });

                if (newLibEntries.length > 0) {
                    setMaterialLibrary([...materialLibrary, ...newLibEntries]);
                }
            }

            // MERGE ALL MESHES INTO ONE WHILE PRESERVING MATERIAL SLOTS
            const meshes: THREE.Mesh[] = [];
            const materials: THREE.Material[] = [];
            const materialIndexMap = new Map<string, number>();

            // Collect all meshes and build material index
            scene.traverse((child: any) => {
                if (child.isMesh) {
                    meshes.push(child);
                    
                    // Handle both single material and material arrays
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach((mat: THREE.Material) => {
                        if (!materialIndexMap.has(mat.uuid)) {
                            materialIndexMap.set(mat.uuid, materials.length);
                            materials.push(mat);
                        }
                    });
                }
            });

            logger.log(`📦 Found ${meshes.length} meshes with ${materials.length} unique materials`);

            let mergedGeometry: THREE.BufferGeometry;
            let mergedMaterial: THREE.Material | THREE.Material[];

            if (meshes.length === 0) {
                logger.warn('⚠️ No meshes found in GLB');
                setStatus("IMPORT FAILED: No meshes");
                return;
            }

            if (meshes.length === 1) {
                // Single mesh - just use it directly
                logger.log('✅ Single mesh - using directly');
                mergedGeometry = meshes[0].geometry.clone();
                mergedMaterial = meshes[0].material;
            } else {
                // Multiple meshes - merge them with material groups
                logger.log('🔧 Merging multiple meshes...');
                
                const geometries: THREE.BufferGeometry[] = [];
                const materialIndices: number[] = [];

                meshes.forEach((mesh) => {
                    const geo = mesh.geometry.clone();
                    
                    // Apply mesh's world transform to geometry
                    mesh.updateWorldMatrix(true, false);
                    geo.applyMatrix4(mesh.matrixWorld);
                    
                    // Get material index for this mesh
                    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                    const matIndex = materialIndexMap.get(mat.uuid) || 0;
                    
                    geometries.push(geo);
                    materialIndices.push(matIndex);
                });

                // Merge geometries using BufferGeometryUtils
                try {
                    // Create groups for each geometry
                    let offset = 0;
                    const groupedGeos = geometries.map((geo, idx) => {
                        const count = geo.index ? geo.index.count : geo.attributes.position.count;
                        return { geometry: geo, materialIndex: materialIndices[idx], count };
                    });

                    mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, true);
                    
                    if (mergedGeometry) {
                        // Set up material groups
                        mergedGeometry.clearGroups();
                        groupedGeos.forEach(({ count, materialIndex }) => {
                            mergedGeometry.addGroup(offset, count, materialIndex);
                            offset += count;
                        });
                        
                        mergedMaterial = materials;
                        logger.log(`✅ Merged into single geometry with ${materials.length} material slots`);
                    } else {
                        throw new Error('Merge failed');
                    }
                } catch (err) {
                    logger.warn('⚠️ Merge failed, using first mesh only:', err);
                    mergedGeometry = meshes[0].geometry.clone();
                    mergedMaterial = meshes[0].material;
                }
            }

            // Create final merged mesh
            const mergedMesh = new THREE.Mesh(mergedGeometry, mergedMaterial);
            mergedMesh.castShadow = true;
            mergedMesh.receiveShadow = true;

            // Wrap in a group for consistent handling
            const finalGroup = new THREE.Group();
            finalGroup.add(mergedMesh);

            // Normalize scale
            const box = new THREE.Box3().setFromObject(finalGroup);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1 / (maxDim || 1);
            finalGroup.scale.set(scale, scale, scale);

            logger.log(`✅ Final import: 1 merged mesh, ${materials.length} material slots, scale: ${scale.toFixed(3)}`);

            // Generate thumbnail
            const generateThumbnail = (): string => {
                const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                thumbRenderer.setSize(128, 128);
                const thumbScene = new THREE.Scene();
                const thumbCam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
                thumbCam.position.set(1.5, 1, 1.5);
                thumbCam.lookAt(0, 0.3, 0);

                const clonedGroup = finalGroup.clone();
                thumbScene.add(clonedGroup);

                const light = new THREE.DirectionalLight(0xffffff, 2);
                light.position.set(2, 3, 2);
                thumbScene.add(light);
                thumbScene.add(new THREE.AmbientLight(0x404040));

                thumbRenderer.render(thumbScene, thumbCam);
                const dataUrl = thumbRenderer.domElement.toDataURL();
                thumbRenderer.dispose();
                return dataUrl;
            };

            const thumbnail = generateThumbnail();
            const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

            const newImport = {
                id: importId,
                storageId: importId,
                name: name,
                scene: finalGroup, // Use merged group instead of original scene
                thumbnail: thumbnail,
                materialCount: materials.length
            };

            setUserImports(prev => [...prev, newImport]);
            setActiveShape(importId);
            setStatus(`IMPORTED: ${name} (${materials.length} materials)`);

        }, undefined, (err) => {
            console.error("GLB load error:", err);
            setStatus("IMPORT FAILED");
        });
    };

    const handleGlbImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        const fileName = file.name.replace(/\.(glb|gltf)$/i, '');
        importGlbFromUrl(url, fileName);

        // Reset file input
        if (glbInputRef.current) glbInputRef.current.value = '';
    };

    const handleSketchfabImport = (url: string, name: string) => {
        importGlbFromUrl(url, name);
    };

    const selectUserImport = (item: any) => {
        setActiveShape(item.id);
        setStatus(`SELECTED: ${item.name}`);
    };

    const handleUndo = useCallback(() => {
        const { layerMap } = sceneRef.current;
        const layer = layerMap[activeLayerId];
        if (!layer) return;
        const { group } = layer;
        let toRemove = 1;
        if (symmetry === 'x') toRemove = 2;
        if (symmetry === 'radial') toRemove = radialCount;
        if (fractalEcho) toRemove *= 5; // Parent + 4 children

        for (let i = 0; i < toRemove; i++) {
            if (group.children.length > 0) {
                const lastObj = group.children[group.children.length - 1];
                if (activeLayerId === 'base' && group.children.length <= 1) break;
                lastObj.traverse((child: any) => { if (child.isMesh) { if (child.geometry) child.geometry.dispose(); } });
                group.remove(lastObj);
            }
        }
        setStatus("Undo Action Performed");
    }, [activeLayerId, symmetry, radialCount, fractalEcho]);

    const handleClear = useCallback(() => {
        const { rootGroup } = sceneRef.current;
        clearSelection();
        
        while (rootGroup.children.length > 0) {
            const child = rootGroup.children[0];
            rootGroup.remove(child);
            child.traverse((c: any) => { if (c.geometry) c.geometry.dispose(); });
        }
        
        const bg = new THREE.Group(); bg.userData.isLayer = true; bg.userData.isBase = true; rootGroup.add(bg);
        const bm = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.4 });
        const bc = new THREE.Group(); bc.userData.isContainer = true; bc.userData.isDefaultBase = true;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 64), bm);
        m.position.y = -0.1; m.receiveShadow = true;
        bc.add(m); bg.add(bc);
        sceneRef.current.layerMap = { 'base': { group: bg, material: bm } };
        setLayers([{ id: 'base', name: 'Base Mesh', visible: true, color: '#FFFFFF', objects: [] }]);
        setActiveLayerId('base');
        setStatus("System Reset");
    }, [setLayers, setActiveLayerId]);

    const updateMaterialVisuals = useCallback(async (img: HTMLImageElement) => {
        if (!img) return;
        
        try {
            setStatus("FAST PBR PROCESSING...");
            
            // Use FAST JavaScript PBR (adapted from K_OS AutoPBR)
            const { generatePbrMapsFast, convertToFastParams } = await import('../../services/fastPbrClient');
            const fastParams = convertToFastParams(matParams);
            
            // 🚀 FAST JS GENERATION (Zero serialization overhead!)
            const startTime = performance.now();
            const result = await generatePbrMapsFast(img, fastParams);
            const elapsed = performance.now() - startTime;
            
            logger.log(`🔥 FAST PBR generated in ${elapsed.toFixed(1)}ms (pure JS!)`);
            setStatus(`FAST PBR: ${elapsed.toFixed(0)}ms`);
            
            // Load textures
            const loadTexture = (url: string) => new Promise<THREE.Texture>(resolve => new THREE.TextureLoader().load(url, (t) => resolve(t)));
            
            const [baseTex, normalTex, roughnessTex, metallicTex, aoTex, heightTex] = await Promise.all([
                loadTexture(result.base),
                loadTexture(result.normal),
                loadTexture(result.roughness),
                loadTexture(result.metallic),
                loadTexture(result.ao),
                loadTexture(result.height),
            ]);
            
            // Configure textures
            [baseTex, normalTex, roughnessTex, metallicTex, aoTex, heightTex].forEach(t => {
                if (!t) return;
                t.colorSpace = THREE.SRGBColorSpace;
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.repeat.set(matParams.scale, matParams.scale);
            });

            const layerState = layers.find(l => l.id === activeLayerId);
            if (!layerState) return;

            const flux = layerState.flux || { enabled: false };
            const { group } = sceneRef.current.layerMap[activeLayerId];
            let material = sceneRef.current.layerMap[activeLayerId].material;

            // CHECK FLUX MODE
            if (flux.enabled) {
                // Create or Update ShaderMaterial
                type FluxShaderType = keyof typeof FluxShader.vertex;
                const requestedType = flux.type as FluxShaderType;
                const shaderType: FluxShaderType = requestedType && FluxShader.vertex[requestedType] ? requestedType : 'standard';
                const vert = FluxShader.vertex[shaderType].replace('// [INSERT_COMMON]', FluxShader.common);
                const frag = FluxShader.fragment[shaderType];

                if (!material.isShaderMaterial || !material.userData || !material.userData.isFlux || material.userData.fluxType !== flux.type) {
                    material = new THREE.ShaderMaterial({
                        uniforms: {
                            time: { value: 0 },
                            chaos: { value: flux.chaos },
                            colorA: { value: new THREE.Color(flux.colorA) },
                            colorB: { value: new THREE.Color(flux.colorB) },
                            map: { value: baseTex }
                        },
                        vertexShader: vert,
                        fragmentShader: frag,
                        wireframe: false,
                        transparent: shaderType === 'hologram',
                        side: THREE.DoubleSide
                    });
                    material.userData.isFlux = true;
                    material.userData.fluxType = flux.type;
                    material.userData.fluxState = flux;
                    sceneRef.current.layerMap[activeLayerId].material = material;
                    // Update all children
                    group.traverse((c: any) => { if (c.isMesh) c.material = material; });
                } else {
                    // Update existing ShaderMaterial uniforms/maps
                    if (baseTex) material.uniforms.map.value = baseTex;
                    material.uniforms.chaos.value = flux.chaos;
                    material.uniforms.colorA.value.set(flux.colorA);
                    material.uniforms.colorB.value.set(flux.colorB);
                    material.userData.fluxState = flux;
                }
            } else {
                // STANDARD PBR MATERIAL
                if (material.isShaderMaterial && material.userData && material.userData.isFlux) {
                    // Revert to Standard
                    material = new THREE.MeshStandardMaterial({
                        color: 0xffffff,
                        side: matParams.doubleSided ? THREE.DoubleSide : THREE.FrontSide
                    });
                    sceneRef.current.layerMap[activeLayerId].material = material;
                    group.traverse((c: any) => { if (c.isMesh) c.material = material; });
                }

                if (material.side !== (matParams.doubleSided ? THREE.DoubleSide : THREE.FrontSide)) {
                    material.side = matParams.doubleSided ? THREE.DoubleSide : THREE.FrontSide;
                    material.needsUpdate = true;
                }

                // Apply GPU-generated maps
                material.map = baseTex;
                material.normalMap = normalTex;
                material.roughnessMap = roughnessTex;
                material.metalnessMap = metallicTex;
                material.aoMap = aoTex;
                
                if (matParams.displacementScale > 0) {
                    material.displacementMap = heightTex;
                    material.displacementScale = matParams.displacementScale;
                } else {
                    if (material.displacementMap) {
                        material.displacementMap.dispose();
                        material.displacementMap = null;
                    }
                    material.displacementScale = 0;
                }
                
                material.color.setHex(0xffffff);
                material.needsUpdate = true;
            }

            setLayers(prev => prev.map(l => l.id === activeLayerId ? {
                ...l,
                texture: result.base,
                normalMap: result.normal,
                roughnessMap: result.roughness,
                displacementMap: result.height,
                matParams: matParams
            } : l));
            
            // ✅ Update material library with generated PBR maps
            const existing = materialLibrary.find((m: any) => m.sourceImg?.src === img.src);
            if (existing) {
                // Update existing material with new maps
                setMaterialLibrary(materialLibrary.map((m: any) => m.sourceImg?.src === img.src ? {
                    ...m,
                    texture: result.base,
                    normal: result.normal,
                    roughness: result.roughness,
                    metallic: result.metallic,
                    ao: result.ao,
                    height: result.height,
                } : m));
            } else {
                // Add new material to library
                setMaterialLibrary([...materialLibrary, {
                    id: Date.now(),
                    name: `Material_${Date.now().toString().slice(-4)}`,
                    texture: result.base,
                    normal: result.normal,
                    roughness: result.roughness,
                    metallic: result.metallic,
                    ao: result.ao,
                    height: result.height,
                    sourceImg: img
                }]);
            }
            
        } catch (error) {
            console.error('GPU PBR generation failed:', error);
            setStatus(`GPU ERROR: ${error}`);
            // TODO: Fallback to CPU processing if needed
        }
    }, [activeLayerId, matParams, layers, setMaterialLibrary]);

    // Auto-regenerate PBR maps when params change (debounced)
    // Only trigger when matParams actually changes, not when layers update
    const matParamsRef = useRef(matParams);
    const isRegeneratingRef = useRef(false);
    
    useEffect(() => {
        // Check if matParams actually changed (deep comparison of relevant fields)
        const paramsChanged = JSON.stringify(matParamsRef.current) !== JSON.stringify(matParams);
        if (!paramsChanged || isRegeneratingRef.current) return;
        
        const currentLayer = layers.find(l => l.id === activeLayerId);
        if (!currentLayer?.sourceImg) return;
        
        matParamsRef.current = matParams;
        
        const timer = setTimeout(() => {
            logger.log('[Greeble] Regenerating PBR maps due to param change...');
            isRegeneratingRef.current = true;
            updateMaterialVisuals(currentLayer.sourceImg).finally(() => {
                isRegeneratingRef.current = false;
            });
        }, 500); // 500ms debounce
        
        return () => clearTimeout(timer);
    }, [matParams]); // Only watch matParams, not layers!

    const commitMaterial = useCallback((img: HTMLImageElement, name: string) => {
        // Force update visual will trigger store update for textures
        if (!materialLibrary.find((m: any) => m.sourceImg.src === img.src)) {
            setMaterialLibrary([...materialLibrary, { id: Date.now(), name: name, texture: img.src, sourceImg: img }]);
        }

        // Initial set with sourceImg, then let updateMaterialVisuals handle the rest
        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, sourceImg: img } : l));

        // This will trigger the effect above which updates the maps
        updateMaterialVisuals(img);

        setStatus("Material Created");
    }, [activeLayerId, matParams, updateMaterialVisuals, materialLibrary, setMaterialLibrary, setLayers]);

    const handleTextureUploadClick = () => { if (textureInputRef.current) textureInputRef.current.click(); };
    const handleTextureUpload = (e: any) => {
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const img = new Image(); img.src = evt.target?.result as string; img.onload = () => { commitMaterial(img, file.name); } }; reader.readAsDataURL(file);
    };

    const addLayer = () => {
        const id = `layer_${Date.now()}`; const name = `Layer ${layers.length + 1}`; const color = '#' + Math.floor(Math.random() * 16777215).toString(16);
        setLayers(prev => [...prev, {
            id, name, visible: true, color, texture: null, sourceImg: null,
            objects: [],
            flux: { enabled: false, type: 'standard', chaos: 0.5, colorA: '#ff003c', colorB: '#000000' },
            deform: { inflate: 0, taper: 0, twist: 0, bend: 0, spherize: 0, noise: 0 }
        }]);
        setActiveLayerId(id);
        // NOTE: 3D objects are now created automatically by the useEffect that syncs layerMap with store layers
        setStatus(`Created ${name}`);
    };
    const duplicateLayer = (id: string) => {
        const sourceLayerState = layers.find(l => l.id === id); if (!sourceLayerState) return; const { rootGroup, layerMap } = sceneRef.current; const sourceLayer3D = layerMap[id]; if (!sourceLayer3D) return; const newId = `layer_${Date.now()}`; const newName = `${sourceLayerState.name} Copy`; const newLayerState = { ...sourceLayerState, id: newId, name: newName }; const newGroup = sourceLayer3D.group.clone(true); const newMaterial = sourceLayer3D.material.clone(); newGroup.traverse((child: any) => { if (child.isMesh) { child.material = newMaterial; child.castShadow = true; child.receiveShadow = true; } }); newGroup.userData.isLayer = true; rootGroup.add(newGroup); layerMap[newId] = { group: newGroup, material: newMaterial }; setLayers(prev => [...prev, newLayerState]); setActiveLayerId(newId); setStatus(`Duplicated ${sourceLayerState.name}`);
    };
    
    // MERGE LAYER - Combine all objects in a layer into a single mesh
    const mergeLayer = (id: string) => {
        const { layerMap } = sceneRef.current;
        const layer3D = layerMap[id];
        if (!layer3D) return;
        
        const group = layer3D.group;
        const meshes: THREE.Mesh[] = [];
        
        // Collect all meshes in the layer
        group.traverse((child: any) => {
            if (child.isMesh && child.geometry) {
                meshes.push(child);
            }
        });
        
        if (meshes.length === 0) {
            setStatus('No meshes to merge');
            return;
        }
        
        if (meshes.length === 1) {
            setStatus('Only one mesh - already merged');
            return;
        }
        
        // Merge geometries using BufferGeometryUtils
        const geometries: THREE.BufferGeometry[] = [];
        meshes.forEach(mesh => {
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            geometries.push(geo);
        });
        
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
        if (!mergedGeometry) {
            setStatus('Failed to merge geometries');
            return;
        }
        
        // Create new merged mesh
        const mergedMesh = new THREE.Mesh(mergedGeometry, layer3D.material);
        mergedMesh.castShadow = true;
        mergedMesh.receiveShadow = true;
        mergedMesh.userData.isContainer = true;
        
        // Clear the group and add merged mesh
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }
        group.add(mergedMesh);
        
        setStatus(`Merged ${meshes.length} objects into 1 mesh`);
        logger.log(`✅ Merged ${meshes.length} meshes in layer ${id}`);
    };
    
    // MERGE SELECTED LAYERS - Combine multiple layers into one
    const mergeSelectedLayers = () => {
        if (selectedLayerIds.size < 2) {
            setStatus('Select 2+ layers to merge (Shift+Click)');
            return;
        }
        
        const { layerMap, rootGroup } = sceneRef.current;
        const selectedIds = Array.from(selectedLayerIds);
        const allMeshes: THREE.Mesh[] = [];
        let firstMaterial: THREE.Material | null = null;
        
        // Collect all meshes from selected layers
        selectedIds.forEach(id => {
            const layer3D = layerMap[id];
            if (!layer3D) return;
            
            if (!firstMaterial) firstMaterial = layer3D.material;
            
            layer3D.group.traverse((child: any) => {
                if (child.isMesh && child.geometry) {
                    allMeshes.push(child);
                }
            });
        });
        
        if (allMeshes.length === 0) {
            setStatus('No meshes found in selected layers');
            return;
        }
        
        // Merge geometries
        const geometries: THREE.BufferGeometry[] = [];
        allMeshes.forEach(mesh => {
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            geometries.push(geo);
        });
        
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
        if (!mergedGeometry) {
            setStatus('Failed to merge geometries');
            return;
        }
        
        // Create merged layer
        const newId = `layer_${Date.now()}`;
        const newName = `Merged (${selectedIds.length} layers)`;
        const newGroup = new THREE.Group();
        newGroup.userData.isLayer = true;
        
        const mergedMesh = new THREE.Mesh(mergedGeometry, firstMaterial || new THREE.MeshStandardMaterial());
        mergedMesh.castShadow = true;
        mergedMesh.receiveShadow = true;
        mergedMesh.userData.isContainer = true;
        
        newGroup.add(mergedMesh);
        rootGroup.add(newGroup);
        
        // Add to layer map
        layerMap[newId] = {
            group: newGroup,
            material: firstMaterial || new THREE.MeshStandardMaterial()
        };
        
        // Delete old layers
        selectedIds.forEach(id => {
            const layer3D = layerMap[id];
            if (layer3D) {
                rootGroup.remove(layer3D.group);
                delete layerMap[id];
            }
        });
        
        // Update state
        setLayers(prev => {
            const filtered = prev.filter(l => !selectedIds.includes(l.id));
            return [...filtered, {
                id: newId,
                name: newName,
                visible: true,
                color: '#FFFFFF',
                objects: []
            }];
        });
        
        setActiveLayerId(newId);
        setSelectedLayerIds(new Set());
        setStatus(`Merged ${selectedIds.length} layers into 1 (${allMeshes.length} meshes)`);
        logger.log(`✅ Merged ${selectedIds.length} layers`);
    };
    
    // ROBUST SELECTION CLEAR
    const clearSelection = () => {
        logger.log('🧹 Clearing selection');
        if (sceneRef.current.selectionBox) {
            sceneRef.current.selectionBox.visible = false;
        }
        sceneRef.current.selectedObject = null;
        setSelectedObjectUUID(null);
    };
    
    const selectLayerObject = (layerId: string) => {
        logger.log('🎯 selectLayerObject called for:', layerId);
        
        // Get layer from layerMap
        const layer = sceneRef.current.layerMap[layerId];
        if (!layer) {
            logger.warn('⚠️ Layer not found in layerMap:', layerId);
            return;
        }
        
        const group = layer.group;
        if (!group) {
            logger.warn('⚠️ Layer group is null:', layerId);
            return;
        }
        
        logger.log('✅ Layer found, group has', group.children.length, 'children');
        
        // CLEAR PREVIOUS SELECTION
        if (sceneRef.current.selectionBox) {
            sceneRef.current.selectionBox.visible = false;
        }
        sceneRef.current.selectedObject = null;
        
        // SET NEW SELECTION
        sceneRef.current.selectedObject = group;
        setSelectedObjectUUID(group.uuid);
        
        // 🔥 SWITCH TO EDIT MODE SO GIZMO APPEARS
        setMode('edit');
        setGizmoMode('translate');
        
        // UPDATE SELECTION BOX
        if (sceneRef.current.selectionBox) {
            try {
                // Force update the box helper
                sceneRef.current.selectionBox.setFromObject(group);
                sceneRef.current.selectionBox.visible = true;
                sceneRef.current.selectionBox.update();
                logger.log('✅ Selection box updated and visible');
            } catch (err) {
                console.error('❌ Failed to update selection box:', err);
            }
        } else {
            logger.warn('⚠️ Selection box not initialized');
        }
        
        // UPDATE TRANSFORM DATA
        setTransformData({
            scale: group.scale.x,
            rotationY: group.rotation.y,
            height: group.position.y,
            posX: group.position.x,
            posY: group.position.y,
            posZ: group.position.z,
            rotX: group.rotation.x,
            rotY: group.rotation.y,
            rotZ: group.rotation.z,
            scaleX: group.scale.x,
            scaleY: group.scale.y,
            scaleZ: group.scale.z
        });
        
        // UPDATE UI STATE
        setActiveLayerId(layerId);
        // Mode already set to 'edit' above with gizmo mode
        
        const layerName = layers.find(l => l.id === layerId)?.name || 'Unknown';
        const objectCount = group.children.length;
        setStatus(`Layer Selected: ${layerName} (${objectCount} objects) - Gizmo Active`);
        
        logger.log('✅ Selection complete:', {
            layerId,
            layerName,
            objectCount,
            groupUUID: group.uuid
        });
    };
    const deleteLayer = (id: string) => {
        if (layers.length <= 1) return;
        
        const { rootGroup, layerMap } = sceneRef.current;
        
        // Clear selection first
        clearSelection();
        
        // Remove 3D objects
        const layerObj = layerMap[id];
        if (layerObj) {
            rootGroup.remove(layerObj.group);
            layerObj.group.traverse((c: any) => {
                if (c.geometry) c.geometry.dispose();
            });
            layerObj.material.dispose();
            delete layerMap[id];
        }
        
        // Update state
        const newLayers = layers.filter(l => l.id !== id);
        setLayers(newLayers);
        
        if (activeLayerId === id) {
            setActiveLayerId(newLayers[newLayers.length - 1].id);
        }
        
        setStatus(`Deleted layer: ${layers.find(l => l.id === id)?.name}`);
    };
    const toggleVisibility = (id: string) => {
        const { layerMap } = sceneRef.current; if (layerMap[id]) { layerMap[id].group.visible = !layerMap[id].group.visible; setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l)); }
    };

    const updateTransformFromUI = (key: string, value: number) => {
        const { selectedObject } = sceneRef.current;
        if (!selectedObject) return;
        if (key === 'scale') { selectedObject.scale.set(value, value, value); setTransformData(prev => ({ ...prev, scale: value })); }
        else if (['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scaleX', 'scaleY', 'scaleZ'].includes(key)) {
            if (key === 'posX') selectedObject.position.x = value; if (key === 'posY') selectedObject.position.y = value; if (key === 'posZ') selectedObject.position.z = value;
            if (key === 'rotX') selectedObject.rotation.x = value; if (key === 'rotY') selectedObject.rotation.y = value; if (key === 'rotZ') selectedObject.rotation.z = value;
            if (key === 'scaleX') selectedObject.scale.x = value; if (key === 'scaleY') selectedObject.scale.y = value; if (key === 'scaleZ') selectedObject.scale.z = value;
            setTransformData(prev => ({ ...prev, [key]: value }));
        }
        else if (key === 'rotationY') { selectedObject.rotation.y = value; setTransformData(prev => ({ ...prev, rotationY: value })); }
        else if (key === 'height') { selectedObject.position.y = value; setTransformData(prev => ({ ...prev, height: value })); }
        if (mode === 'animate') { captureCurrentTransform(); }
    };

    const handleChaosScatter = () => { const { selectedObject } = sceneRef.current; if (selectedObject && selectedObject.parent) { const count = 5; for (let i = 0; i < count; i++) { const clone = selectedObject.clone(true); clone.position.x += (Math.random() - 0.5) * 3; clone.position.y += (Math.random() - 0.5) * 3; clone.position.z += (Math.random() - 0.5) * 3; clone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); const scaleVar = 0.5 + Math.random(); clone.scale.multiplyScalar(scaleVar); selectedObject.parent.add(clone); } setStatus(`Chaos Event: ${count} Fragments`); } };
    const handleGlitch = () => { const { selectedObject } = sceneRef.current; if (selectedObject) { selectedObject.traverse((child: any) => { if (child.isMesh && child.geometry) { const pos = child.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { if (Math.random() > 0.9) { pos.setXYZ(i, pos.getX(i) + (Math.random() - 0.5) * 0.2, pos.getY(i) + (Math.random() - 0.5) * 0.2, pos.getZ(i) + (Math.random() - 0.5) * 0.2); } } pos.needsUpdate = true; } }); setStatus("Geometry Corrupted"); } };
    const handleAddKeyframe = () => { captureCurrentTransform(); setStatus(`Manual Key at ${sceneRef.current.animation.time.toFixed(2)}s`); };
    const handleDeleteKeyframe = () => { const { selectedObject, animation } = sceneRef.current; if (!selectedObject || !animation) return; const uuid = selectedObject.uuid; const t = animation.time; setKeyframes((prev: any) => { if (!prev[uuid]) return prev; const newKeys = prev[uuid].filter((k: any) => Math.abs(k.t - t) > 0.1); return { ...prev, [uuid]: newKeys }; }); setStatus(`Key deleted near ${t.toFixed(2)}s`); };
    const togglePlay = () => setIsPlaying(!isPlaying);
    const stopPlay = () => { setIsPlaying(false); setAnimTime(0); sceneRef.current.animation.time = 0; };

    const handleMergeAndSubdivide = () => {
        const layerId = activeLayerId;
        const layer = sceneRef.current.layerMap[layerId];
        if (!layer) return;

        const group = layer.group;
        const meshes: THREE.Mesh[] = [];

        // Collect all meshes recursively
        group.traverse((child: any) => {
            if (child.isMesh) {
                meshes.push(child);
            }
        });

        if (meshes.length === 0) {
            setStatus("No meshes to merge in layer");
            return;
        }

        const geometries: THREE.BufferGeometry[] = [];

        meshes.forEach(mesh => {
            const geometry = mesh.geometry.clone();

            // Ensure world matrices are up to date
            mesh.updateWorldMatrix(true, false);
            group.updateWorldMatrix(true, false);

            // Calculate relative matrix: M_rel = M_group_inv * M_mesh
            const relativeMatrix = new THREE.Matrix4()
                .copy(group.matrixWorld)
                .invert()
                .multiply(mesh.matrixWorld);

            geometry.applyMatrix4(relativeMatrix);
            geometries.push(geometry);
        });

        try {
            // Merge
            const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
            if (!mergedGeometry) {
                setStatus("Merge failed");
                return;
            }

            // Subdivide
            mergedGeometry.computeBoundingBox();
            const center = new THREE.Vector3();
            mergedGeometry.boundingBox!.getCenter(center);
            const size = new THREE.Vector3();
            mergedGeometry.boundingBox!.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

            const subdividedGeometry = subdivideGeometryLocally(
                mergedGeometry,
                center,
                maxDim * 10.0,
                maxDim / 32.0
            );

            // Clear Group
            while (group.children.length > 0) {
                group.remove(group.children[0]);
            }

            // Create New Mesh
            const newMesh = new THREE.Mesh(subdividedGeometry, layer.material);
            newMesh.castShadow = true;
            newMesh.receiveShadow = true;

            group.add(newMesh);

            setStatus(`Merged & Subdivided ${meshes.length} objects`);

            // Update selection
            sceneRef.current.selectedObject = newMesh;
            setSelectedObjectUUID(newMesh.uuid);

        } catch (e) {
            console.error("Merge/Subdivide error:", e);
            setStatus("Operation Failed: See Console");
        }
    };

    const handleExport = (exportMode: 'download' | 'commit', format: 'glb' | 'obj' = 'glb') => {
        const { rootGroup, selectionBox, animation } = sceneRef.current;

        // Pass mergeOnExport to utils
        const sceneToExport = prepareSceneForExport(rootGroup, includeBase, selectionBox, mergeOnExport);

        if (format === 'glb') {
            const options: any = { binary: true };
            if (animation?.data && Object.keys(animation.data).length > 0) {
                const rootNameMap = new Map();
                rootGroup.traverse((c: any) => { if (c.name) rootNameMap.set(c.uuid, c.name); });
                const clips = generateAnimationClips(animation.data, rootNameMap);
                if (clips.length > 0) options.animations = clips;
            }
            if (targetEngine === 'UNREAL') { sceneToExport.rotation.x = -Math.PI / 2; sceneToExport.updateMatrixWorld(true); }

            const e = new GLTFExporter();
            e.parse(sceneToExport, (g) => {
                const b = new Blob([g as ArrayBuffer], { type: 'application/octet-stream' });
                if (exportMode === 'commit' && onCommit) {
                    onCommit(b, "K-GREEBLE_SCENE"); setStatus("SENT TO KERNEL");
                } else {
                    const l = document.createElement('a'); l.href = URL.createObjectURL(b);
                    l.download = `Greeble_Artifact_${targetEngine}.glb`; l.click();
                    setStatus("EXPORT COMPLETE");
                }
            }, console.error, options);
        } else if (format === 'obj') {
            const e = new OBJExporter(); const result = e.parse(sceneToExport);
            const b = new Blob([result], { type: 'text/plain' });
            const l = document.createElement('a'); l.href = URL.createObjectURL(b);
            l.download = 'Greeble_Artifact.obj'; l.click();
            setStatus("EXPORT COMPLETE");
        }
    };

    const handleDeleteSelected = () => {
        const { selectedObject } = sceneRef.current;
        if (selectedObject && selectedObject.parent) {
            selectedObject.parent.remove(selectedObject);
            clearSelection();
            setStatus("Matter Erased");
        }
    };
    
    const handleDuplicateObject = () => {
        const { selectedObject, selectionBox } = sceneRef.current;
        if (selectedObject && selectedObject.parent) {
            const clone = selectedObject.clone(true);
            clone.position.add(new THREE.Vector3(0.5, 0, 0.5));
            selectedObject.parent.add(clone);
            
            // Select the new clone
            sceneRef.current.selectedObject = clone;
            setSelectedObjectUUID(clone.uuid);
            
            if (selectionBox) {
                selectionBox.setFromObject(clone);
                selectionBox.visible = true;
            }
            
            setStatus("Replicated");
        }
    };

    const handleTimelineScrub = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const t = pct * animDuration;
        setAnimTime(t);
        sceneRef.current.animation.time = t;
        setIsPlaying(false);
    };

    const handleSliderChange = (e: any) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            setAnimTime(val);
            sceneRef.current.animation.time = val;
            setIsScrubbing(true);
            setIsPlaying(false);
        }
    };

    const handleSliderUp = () => { setIsScrubbing(false); };

    // --- KEYBINDING CORE INTEGRATION (MOVED HERE TO ACCESS HANDLERS) ---
    const { isPressed: _isPressed, activeActions: _activeActions } = useInput({
        onActionDown: {
            MENU: () => {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    setSpaceMenuPos(mouseClientRef.current);
                    setSpaceMenuOpen(true);
                }
            },
            FOCUS: () => {
                const { selectedObject, rootGroup, camera, controls } = sceneRef.current;
                const target = selectedObject || rootGroup;

                if (target) {
                    const box = new THREE.Box3().setFromObject(target);
                    if (box.isEmpty()) return;

                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);

                    const fov = camera.fov * (Math.PI / 180);
                    let cameraZ = maxDim / (2 * Math.tan(fov / 2));
                    cameraZ *= 1.5;

                    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
                    const newPos = center.clone().add(direction.multiplyScalar(cameraZ));

                    controls.target.copy(center);
                    camera.position.copy(newPos);
                    controls.update();
                    setStatus(selectedObject ? "Subject Focused" : "Scene Framed");
                }
            },
            // NEW KEYBINDS
            GIZMO_TRANSLATE: () => { setMode('edit'); setGizmoMode('translate'); setStatus("Tool: Move"); },
            GIZMO_ROTATE: () => { setMode('edit'); setGizmoMode('rotate'); setStatus("Tool: Rotate"); },
            GIZMO_SCALE: () => { setMode('edit'); setGizmoMode('scale'); setStatus("Tool: Scale"); },
            TOGGLE_MODE: () => { const m = mode === 'build' ? 'edit' : 'build'; setMode(m); setStatus(`Mode: ${m.toUpperCase()}`); },
            SYMMETRY_X: () => { const s = symmetry === 'x' ? 'none' : 'x'; setSymmetry(s); setStatus(`Symmetry: ${s.toUpperCase()}`); },
            SYMMETRY_Z: () => { const s = symmetry === 'z' ? 'none' : 'z'; setSymmetry(s); setStatus(`Symmetry: ${s.toUpperCase()}`); },
            SYMMETRY_RADIAL: () => { const s = symmetry === 'radial' ? 'none' : 'radial'; setSymmetry(s); setStatus(`Symmetry: ${s.toUpperCase()}`); },
            TOGGLE_GRID: () => { setGridLock(!gridLock); setStatus(`Grid Snap: ${!gridLock ? 'ON' : 'OFF'}`); },
            TOGGLE_SURFACE: () => { setSurfaceMode(!surfaceMode); setStatus(`Surface Mode: ${!surfaceMode ? 'ON' : 'OFF'}`); },
            DELETE: () => {
                const { selectedObject } = sceneRef.current;
                if (selectedObject) { handleDeleteSelected(); }
            },
            DUPLICATE: handleDuplicateObject,
            UNDO: handleUndo,
        },
        onActionUp: {
            MENU: () => setSpaceMenuOpen(false)
        }
    });

    // INITIALIZATION & RENDER LOOP
    // useEffect(() => {
    //     // Initialize Base Mesh if scene is empty
    //     if (sceneRef.current && sceneRef.current.rootGroup && sceneRef.current.rootGroup.children.length === 0) {
    //         handleClear();
    //     }
    // }, [handleClear]);

    // ✅ WASM INTEGRATION: Initialize WASM module on mount
    useEffect(() => {
        const initWasm = async () => {
            try {
                // Wait for WASM to be ready
                if (!wasmReady) {
                    const wasmInterface = getGreeble3DWasmInterface();
                    if (wasmInterface) {
                        greebleWasm = wasmInterface;
                        wasmReady = true;
                    } else {
                        await new Promise<void>(resolve => {
                            const handler = () => {
                                greebleWasm = getGreeble3DWasmInterface();
                                wasmReady = true;
                                resolve();
                            };
                            window.addEventListener(getGreeble3DWasmReadyEventName(), handler, { once: true });
                        });
                    }
                }

                if (greebleWasm) {
                    const version = greebleWasm.greeble_version?.();
                    setStatus(`WASM ENGINE v${version} READY`);
                    logger.log('K-Greeble WASM loaded successfully');
                }
            } catch (e) {
                console.error('Failed to load WASM engine:', e);
                setStatus('WASM ENGINE FAILED TO LOAD — FALLING BACK TO LEGACY');
            }
        };
        initWasm();
    }, []);

    const handleSnapshot = () => {
        const { renderer, scene, camera } = sceneRef.current;
        if (!renderer) return;
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `greeble_snap_${Date.now()}.png`;
        link.href = url;
        link.click();
    };

    const resetSim = () => { /* Placeholder for future simulation reset if added to Greeble */ };

    return (
        <KGreebleUI
            mode={mode} setMode={setMode}
            buildTab={buildTab} setBuildTab={setBuildTab}
            activeShape={activeShape} setActiveShape={setActiveShape}
            selectedObjectUUID={selectedObjectUUID} transformData={transformData} updateTransformFromUI={updateTransformFromUI}
            animTime={animTime} animDuration={animDuration} setAnimDuration={setAnimDuration} isPlaying={isPlaying} togglePlay={togglePlay} stopPlay={stopPlay}
            handleTimelineScrub={handleTimelineScrub} handleSliderChange={handleSliderChange} handleSliderUp={handleSliderUp} keyframes={keyframes}
            handleAddKeyframe={handleAddKeyframe} handleDeleteKeyframe={handleDeleteKeyframe} targetFPS={targetFPS} setTargetFPS={setTargetFPS}
            layers={layers} activeLayerId={activeLayerId} setActiveLayerId={setActiveLayerId} addLayer={addLayer} duplicateLayer={duplicateLayer} mergeLayer={mergeLayer} mergeSelectedLayers={mergeSelectedLayers} deleteLayer={deleteLayer} toggleLayerVisibility={toggleVisibility} selectLayerObject={selectLayerObject}
            materialLibrary={materialLibrary} commitMaterial={commitMaterial}
            handleTextureUploadClick={handleTextureUploadClick} handleTextureUpload={handleTextureUpload} textureInputRef={textureInputRef} matParams={matParams} setMatParams={setMatParams} downloadMap={() => { }} downloadAll={() => { }}
            sunIntensity={sunIntensity} setSunIntensity={setSunIntensity} sunAngle={sunAngle} setSunAngle={setSunAngle}
            handleUndo={handleUndo} handleClear={handleClear}
            handleChaosScatter={handleChaosScatter} handleGlitch={handleGlitch} handleDuplicateObject={handleDuplicateObject} handleDeleteSelected={handleDeleteSelected}
            targetEngine={targetEngine} setTargetEngine={setTargetEngine} mergeOnExport={mergeOnExport} setMergeOnExport={setMergeOnExport} includeBase={includeBase} setIncludeBase={setIncludeBase} handleExport={handleExport} handleSnapshot={handleSnapshot}
            neonMode={neonMode} setNeonMode={setNeonMode} toggleFullscreen={toggleFullscreen}
            mountRef={mountRef}
            handleMouseDown={handleMouseDown} handleMouseMove={handleMouseMove} handleMouseUp={handleMouseUp}
            resetCamera={resetCamera} resetSim={resetSim}
            simRes={2048}
            sharedState={sharedState} loadFromStorage={loadFromStorage}

            // GLB IMPORTS
            userImports={userImports} selectUserImport={selectUserImport}
            handleGlbImportClick={handleGlbImportClick} handleGlbImport={handleGlbImport} glbInputRef={glbInputRef}
            handleSketchfabImport={handleSketchfabImport}
            onExit={onExit} exitLabel={exitLabel} showExit={showExit} layoutAutoSaveId={layoutAutoSaveId}

            // GIZMO CONTROLS
            gizmoMode={gizmoMode} setGizmoMode={setGizmoMode}
            transformSpace={transformSpace} setTransformSpace={setTransformSpace}
            snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled}

            surfaceMode={surfaceMode} setSurfaceMode={setSurfaceMode}
            symmetry={symmetry} setSymmetry={setSymmetry}
            radialCount={radialCount} setRadialCount={setRadialCount}

            // NEW MODIFIERS
            gridLock={gridLock} setGridLock={setGridLock}
            gridSize={gridSize} setGridSize={setGridSize}
            voidAnchor={voidAnchor} setVoidAnchor={setVoidAnchor}
            chaosMode={chaosMode} setChaosMode={setChaosMode}
            fractalEcho={fractalEcho} setFractalEcho={setFractalEcho}

            greebleParams={greebleParams}
            setGreebleParams={setGreebleParams}

            primitiveParams={primitiveParams}
            setPrimitiveParams={setPrimitiveParams}

            titanParams={titanParams}
            setTitanParams={setTitanParams}

            updateLayer={updateLayer}

            // Layer Panel Props
            selectedLayerIds={selectedLayerIds}
            onSelectLayer={(id: string, opts: any) => {
                // If simple select
                if (!opts?.multi && !opts?.ctrl && !opts?.shift) {
                    setActiveLayerId(id);
                    setSelectedLayerIds(new Set([id]));
                } else {
                    // Complex logic handled in UI, just sync active
                    setActiveLayerId(id);
                }
            }}
            onSelectionChange={setSelectedLayerIds}
            onRenameLayer={handleRenameLayer}
            onLockLayer={handleLockLayer}
            onSoloLayer={handleSoloLayer}
            onMergeSelectedLayers={handleMergeSelectedLayers}

            handleMergeAndSubdivide={handleMergeAndSubdivide}

            handleSetEnvMap={setEnvMap}

            graphicsQuality={graphicsQuality}
            setGraphicsQuality={setGraphicsQuality}
        >
            {/* Mouse event capture overlay - connects to DCC-style mouse handler */}
            <div
                ref={mountRef}
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 0 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu for IMM brush
            >
                <KGreebleCanvas sceneRef={sceneRef} onSceneReady={handleClear} />
            </div>
        </KGreebleUI>
    );
}

