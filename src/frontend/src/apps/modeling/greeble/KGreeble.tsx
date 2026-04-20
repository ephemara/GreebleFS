
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SAOPass } from 'three/examples/jsm/postprocessing/SAOPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { PMREMGenerator } from 'three';
import KGreebleUI from './KGreebleUI';
import {
    processImage, packORM, generateTexture, generateSceneLayout, SHAPES
} from './KGreebleEngine';
import {
    spawnMeshAtPosition, generateAnimationClips, prepareSceneForExport, toggleFullscreen
} from './KGreebleutils';
import { performBoolean, createLinearArray } from './KGreebleModifiers';
import { initLighting, updateLighting } from './KGreeblelighting';
import { useKGreebleInteraction } from './KGreeblemouseandcamera';
import { greeblePhysics } from './KGreeblePhysics';
import {
    useZenControlBindings,
    useZenModuleBridge,
    useZenSharedControls,
    ZEN_VIEWPORT_OPERATOR_SESSION_KEY
} from '../../../core/zen';

export default function KGreeble({ sharedState, onCommit, zenShellMode = 'standalone' }: any) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge('greeble');
    const { gizmoMode, transformSpace, snapEnabled, setGizmoMode, setTransformSpace, setSnapEnabled } = useZenSharedControls();
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const [mode, setMode] = useState('build');
    const [buildTab, setBuildTab] = useState<'PRIMITIVES' | 'KERNEL'>('PRIMITIVES');
    const [activeShape, setActiveShape] = useState(SHAPES.GREEBLE);
    const [prompt, setPrompt] = useState('');
    const [architectPrompt, setArchitectPrompt] = useState('');
    const [isArchitecting, setIsArchitecting] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [status, setStatus] = useState("Titan Engine v31.1");
    const [selectedObjectUUID, setSelectedObjectUUID] = useState<string | null>(null);

    const [sunIntensity, setSunIntensity] = useState(2.0);
    const [sunAngle, setSunAngle] = useState(45);
    const [neonMode, setNeonMode] = useState(false);

    const [userImports, setUserImports] = useState<any[]>([]);
    const [materialLibrary, setMaterialLibrary] = useState<any[]>([]);
    const [mergeOnExport, setMergeOnExport] = useState(false);
    const [includeBase, setIncludeBase] = useState(false);
    const [targetEngine, setTargetEngine] = useState('GENERIC');
    const [objectCount, setObjectCount] = useState(1);

    const [transformData, setTransformData] = useState({ scale: 1, rotationY: 0, height: 0, posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 });

    const [animTime, setAnimTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [animDuration, setAnimDuration] = useState(10.0);
    const [keyframes, setKeyframes] = useState<any>({});
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [targetFPS, setTargetFPS] = useState(60);

    const [matParams, setMatParams] = useState({
        normalStrength: 2.0, roughnessContrast: 1.2, roughnessBrightness: 0,
        roughnessInvert: true, metalContrast: 1.5, metalBias: -50,
        aoIntensity: 0.8, makeSeamless: false, hue: 0, wear: 0.1, scale: 1.0,
        displacementScale: 0.0
    });

    // --- MODIFIER STATE ---
    const [modifierMode, setModifierMode] = useState<'none' | 'picking_boolean_target'>('none');
    const [booleanTargetUUID, setBooleanTargetUUID] = useState<string | null>(null);
    const [arrayParams, setArrayParams] = useState({ count: 5, offset: { x: 2, y: 0, z: 0 } });


    const [layers, setLayers] = useState<any[]>([
        { id: 'base', name: 'Base Mesh', visible: true, color: '#555555', texture: null, sourceImg: null }
    ]);
    const layersRef = useRef(layers);
    useEffect(() => { layersRef.current = layers; }, [layers]);

    const [activeLayerId, setActiveLayerId] = useState('base');
    const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set(['base']));

    useEffect(() => {
        publishLayers(layers.map((layer, index) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            order: index
        })));
    }, [layers, publishLayers]);

    useEffect(() => {
        publishState({
            status,
            mode,
            activeLayerId,
            selectedLayerIds: Array.from(selectedLayerIds)
        });
    }, [activeLayerId, mode, publishState, selectedLayerIds, status]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            ...(sharedState?.activeArtifactId
                ? { activeAssetId: sharedState.activeArtifactId }
                : {}),
            activeLayerId
        });
    }, [
        activeLayerId,
        isToolOverlay,
        publishSelection,
        sharedState?.activeArtifactId
    ]);

    // --- MODIFIERS STATE ---
    const [symmetry, setSymmetry] = useState('none');
    const [radialCount, setRadialCount] = useState(6);
    const [altOrbit, setAltOrbit] = useState(false);
    const [surfaceMode, setSurfaceMode] = useState(false);
    const [gridLock, setGridLock] = useState(false);
    const [gridSize, setGridSize] = useState(0.5);
    const [voidAnchor, setVoidAnchor] = useState(false); // Forces Up-vector
    const [chaosMode, setChaosMode] = useState(false); // Random Rotation/Scale
    const [fractalEcho, setFractalEcho] = useState(false); // Recursive spawning

    useEffect(() => {
        const operatorSubjectLayerId = isToolOverlay
            ? sharedState?.activeLayerId ?? null
            : activeLayerId;
        const operatorSubjectEntityId = isToolOverlay
            ? sharedState?.activeEntityId ?? null
            : null;

        publishState({
            [ZEN_VIEWPORT_OPERATOR_SESSION_KEY]: {
                moduleId: 'greeble',
                enabled: true,
                subjectAssetId: sharedState?.activeArtifactId ?? null,
                subjectEntityId: operatorSubjectEntityId,
                subjectLayerId: operatorSubjectLayerId,
                materialId: sharedState?.activeMaterialId ?? null,
                shape: activeShape,
                symmetry,
                radialCount,
                altOrbit,
                surfaceMode,
                gridLock,
                gridSize,
                voidAnchor,
                chaosMode,
                fractalEcho,
                scale: Math.max(
                    0.01,
                    transformData.scale
                        || transformData.scaleX
                        || transformData.scaleY
                        || transformData.scaleZ
                        || 1
                )
            }
        });
    }, [
        activeLayerId,
        activeShape,
        altOrbit,
        chaosMode,
        fractalEcho,
        gridLock,
        gridSize,
        isToolOverlay,
        publishState,
        radialCount,
        sharedState?.activeArtifactId,
        sharedState?.activeEntityId,
        sharedState?.activeLayerId,
        sharedState?.activeMaterialId,
        surfaceMode,
        symmetry,
        transformData.scale,
        transformData.scaleX,
        transformData.scaleY,
        transformData.scaleZ,
        voidAnchor
    ]);

    // --- SCULPT STATE ---
    const [sculptTool, setSculptTool] = useState('CLAY');
    const [sculptColor, setSculptColor] = useState('#ffffff');
    const [sculptSettings, setSculptSettings] = useState({
        radius: 0.5,
        intensity: 0.5,
        wireframe: false
    });

    // BRUSH MENU STATE
    const [isBrushMenuOpen, setIsBrushMenuOpen] = useState(false);
    const [brushMenuPos, setBrushMenuPos] = useState({ x: 0, y: 0 });

    // SPACE MENU STATE
    const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
    const [spaceMenuPos, setSpaceMenuPos] = useState({ x: 0, y: 0 });

    const mouseClientRef = useRef({ x: 0, y: 0 });
    const isGizmoDragging = useRef(false);
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    const [autoKey, setAutoKey] = useState(false);
    const autoKeyRef = useRef(autoKey);
    useEffect(() => { autoKeyRef.current = autoKey; }, [autoKey]);

    // EXPERIMENTAL ANIMATION FEATURES
    const [motionTrail, setMotionTrail] = useState(false);
    const motionTrailRef = useRef(motionTrail);
    useEffect(() => { motionTrailRef.current = motionTrail; }, [motionTrail]);

    const [chaosTrack, setChaosTrack] = useState(0);
    const chaosTrackRef = useRef(chaosTrack);
    useEffect(() => { chaosTrackRef.current = chaosTrack; }, [chaosTrack]);

    const [rayTracing, setRayTracing] = useState(false);
    const rayTracingRef = useRef(rayTracing);
    useEffect(() => { rayTracingRef.current = rayTracing; }, [rayTracing]);

    const [skyMode, setSkyMode] = useState(false);
    const skyModeRef = useRef(skyMode);
    useEffect(() => { skyModeRef.current = skyMode; }, [skyMode]);

    const [isHDRActive, setIsHDRActive] = useState(false);
    const [groundSize, setGroundSize] = useState(150); // New State for Ground Size
    const groundSizeRef = useRef(groundSize);
    useEffect(() => { groundSizeRef.current = groundSize; }, [groundSize]);


    // ADVANCED ANIMATION STATE (RAPIER PHYSICS)
    const [physicsSettings, setPhysicsSettings] = useState({
        gravity: -9.8,
        bounciness: 0.6,
        dropHeight: 10,
        isSimulating: false
    });
    const physicsSettingsRef = useRef(physicsSettings);
    useEffect(() => { physicsSettingsRef.current = physicsSettings; }, [physicsSettings]);

    const [proceduralSettings, setProceduralSettings] = useState({ pulseSpeed: 0, pulseAmp: 0, spinSpeed: 0 });
    const proceduralSettingsRef = useRef(proceduralSettings);
    useEffect(() => { proceduralSettingsRef.current = proceduralSettings; }, [proceduralSettings]);

    const [easingType, setEasingType] = useState('linear'); // linear, smooth, elastic
    const easingTypeRef = useRef(easingType);
    useEffect(() => { easingTypeRef.current = easingType; }, [easingType]);

    const mountRef = useRef<HTMLDivElement>(null);
    const textureInputRef = useRef<HTMLInputElement>(null);

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
        brushCursor: null,
        moveData: null, // For Sculpt Move/Stretch
        trailLine: null, // For Motion Trail
        composer: null, // Post-Processing
        passes: {} // Store passes to update settings
    });
    useZenControlBindings('greeble', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'greeble') {
            return false;
        }

        if (actionId === 'menu.quick.hold') {
            if (phase === 'down') {
                setSpaceMenuPos(mouseClientRef.current);
                setSpaceMenuOpen(true);
            } else {
                setSpaceMenuOpen(false);
            }
            return true;
        }

        if (phase !== 'down') {
            return false;
        }

        switch (actionId) {
            case 'camera.focus': {
                const { selectedObject, rootGroup, camera, controls } = sceneRef.current;
                const target = selectedObject || rootGroup;

                if (!target) {
                    return false;
                }

                const box = new THREE.Box3().setFromObject(target);
                if (box.isEmpty()) {
                    return false;
                }

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
                setStatus(selectedObject ? 'Subject Focused' : 'Scene Framed');
                return true;
            }
            case 'history.undo':
                handleUndo();
                return true;
            case 'layer.prev':
                handleCycleLayer(-1);
                return true;
            case 'layer.next':
                handleCycleLayer(1);
                return true;
            default:
                return false;
        }
    });

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
            setMaterialLibrary(prev => {
                const newMats = sharedState.materials.filter((m: any) => !prev.find(p => p.id === m.id));
                if (newMats.length === 0) return prev;

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
                return [...prev, ...converted];
            });
        }
    }, [sharedState?.materials]);

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

    // --- GIZMO ATTACHMENT LOGIC ---
    useEffect(() => {
        const { transformControl, selectedObject } = sceneRef.current;
        if (!transformControl) return;

        if (selectedObject && (mode === 'edit' || mode === 'animate')) {
            transformControl.attach(selectedObject);
        } else {
            transformControl.detach();
        }
    }, [selectedObjectUUID, mode]);

    // --- GIZMO SETTINGS SYNC ---
    // --- GIZMO SETTINGS SYNC ---
    useEffect(() => {
        const r = sceneRef.current;
        const tc = r.transformControl;
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

    // Sync Ray Tracing & Sky Settings
    useEffect(() => {
        const { passes, groundPlane, sky, scene, renderer, keyLight, fillLight, rimLight, grid } = sceneRef.current;
        if (!passes || !scene) return;

        // --- RAY TRACING ---
        if (passes.ssr) passes.ssr.enabled = rayTracing;

        if (passes.bloom) {
            passes.bloom.strength = rayTracing ? 0.5 : 0.3;
        }



        // --- SKY MODE ---
        if (skyMode) {
            if (sky) sky.visible = true;
            if (groundPlane) {
                groundPlane.visible = true;
                groundPlane.material.color.setHex(0xdddddd); // White/Grey floor
                groundPlane.material.roughness = 0.8;
                groundPlane.material.metalness = 0.1;
            }
            if (grid) grid.visible = false;
            scene.background = new THREE.Color(0xffffff); // Fallback

            // Sun Position
            const sunPos = new THREE.Vector3();
            const phi = THREE.MathUtils.degToRad(90 - 20); // Elevation
            const theta = THREE.MathUtils.degToRad(180); // Azimuth
            sunPos.setFromSphericalCoords(1, phi, theta);
            if (sky) sky.material.uniforms['sunPosition'].value.copy(sunPos);

            // Lighting for Sky
            if (keyLight) {
                keyLight.position.copy(sunPos).multiplyScalar(100);
                keyLight.color.setHex(0xffffff);
                keyLight.intensity = 3.0;
            }
            if (fillLight) fillLight.intensity = 0.5;
            if (rimLight) rimLight.intensity = 0.5;

        } else {
            if (sky) sky.visible = false;
            if (groundPlane) {
                groundPlane.visible = rayTracing; // Only show in RT mode if not in Sky Mode
                groundPlane.material.color.setHex(0x050505);
                groundPlane.material.roughness = 0.1;
                groundPlane.material.metalness = 0.5;
            }
            if (grid) grid.visible = true;
            scene.background = new THREE.Color(0x151515);

            // Revert Lighting
            if (keyLight) {
                keyLight.position.set(15, 20, 15);
                keyLight.color.setHex(0xfff0dd);
                keyLight.intensity = 2.5;
            }
            if (fillLight) fillLight.intensity = 1.0;
            if (rimLight) rimLight.intensity = 10;
        }

    }, [rayTracing, skyMode]);

    // Helper to spawn objects
    const spawnProceduralObject = useCallback((point: any, normal: any, type: string, targetLayerId = null) => {
        const targetId = targetLayerId || activeLayerId;
        const { layerMap } = sceneRef.current;
        if (!layerMap || !layerMap[targetId]) return null;

        const { group, material } = layerMap[targetId];

        const container = spawnMeshAtPosition(point, normal, type, material, userImports);

        if (container) {
            group.add(container);
        }
        return container;
    }, [activeLayerId, userImports]);

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

    const bakePhysics = useCallback(() => {
        const { selectedObject, animation } = sceneRef.current;
        if (!selectedObject) return;

        const duration = animation.duration || 10;
        const fps = 60;
        const dt = 1 / fps;
        const steps = Math.floor(duration * fps);

        const keys: any[] = [];
        const pos = selectedObject.position.clone();
        const vel = new THREE.Vector3(0, 0, 0); // Initial velocity could be added later
        const gravity = new THREE.Vector3(0, physicsSettings.gravity, 0);
        const bounciness = physicsSettings.bounciness;

        for (let i = 0; i <= steps; i++) {
            const t = i * dt;

            // Physics Step
            vel.addScaledVector(gravity, dt);
            pos.addScaledVector(vel, dt);

            // Floor Collision
            if (pos.y < 0) {
                pos.y = 0;
                vel.y *= -bounciness;
                // Friction
                vel.x *= 0.9;
                vel.z *= 0.9;
            }

            keys.push({
                t: t,
                p: pos.clone(),
                q: selectedObject.quaternion.clone(),
                s: selectedObject.scale.clone()
            });
        }

        setKeyframes((prev: any) => ({ ...prev, [selectedObject.uuid]: keys }));
        setStatus("Physics Simulation Baked");
    }, [physicsSettings]);

    // === RAPIER PHYSICS HANDLERS ===
    const handleTogglePhysics = useCallback(async () => {
        const { rootGroup } = sceneRef.current;
        if (!rootGroup) return;

        if (physicsSettings.isSimulating) {
            // Stop simulation
            greeblePhysics.stopLoop();
            await greeblePhysics.reset();
            setPhysicsSettings(prev => ({ ...prev, isSimulating: false }));
            setStatus('⏹ PHYSICS STOPPED');
        } else {
            // Start simulation
            setStatus('⚡ INITIALIZING RAPIER...');
            const initialized = await greeblePhysics.init(physicsSettings.gravity);

            if (initialized) {
                await greeblePhysics.addGroundPlane(150);
                await greeblePhysics.addSceneObjects(rootGroup, 0);
                greeblePhysics.setCallbacks(undefined, (s) => setStatus(s));
                greeblePhysics.startLoop(60);
                setPhysicsSettings(prev => ({ ...prev, isSimulating: true }));
            } else {
                // Fallback warning
                setStatus('⚠ Rapier unavailable - using JS physics');
            }
        }
    }, [physicsSettings]);

    const handleDropSelected = useCallback(async () => {
        const { selectedObject, rootGroup } = sceneRef.current;
        if (!selectedObject) return;

        // If not simulating, init first
        if (!physicsSettings.isSimulating) {
            const initialized = await greeblePhysics.init(physicsSettings.gravity);
            if (initialized) {
                await greeblePhysics.addGroundPlane(150);
                greeblePhysics.setCallbacks(undefined, (s) => setStatus(s));
            }
        }

        await greeblePhysics.dropSelected([selectedObject], physicsSettings.dropHeight || 10);

        if (!physicsSettings.isSimulating) {
            greeblePhysics.startLoop(60);
            setPhysicsSettings(prev => ({ ...prev, isSimulating: true }));
        }
    }, [physicsSettings]);

    const handleDropAll = useCallback(async () => {
        const { rootGroup } = sceneRef.current;
        if (!rootGroup) return;

        // Init if not already
        if (!physicsSettings.isSimulating) {
            const initialized = await greeblePhysics.init(physicsSettings.gravity);
            if (initialized) {
                await greeblePhysics.addGroundPlane(150);
                greeblePhysics.setCallbacks(undefined, (s) => setStatus(s));
            }
        }

        await greeblePhysics.addSceneObjects(rootGroup, physicsSettings.dropHeight || 10);

        if (!physicsSettings.isSimulating) {
            greeblePhysics.startLoop(60);
            setPhysicsSettings(prev => ({ ...prev, isSimulating: true }));
        }

        setStatus(`🌧 DROPPED ALL FROM ${physicsSettings.dropHeight || 10}m`);
    }, [physicsSettings]);

    const { handleMouseDown, handleMouseMove, handleMouseUp, resetCamera } = useKGreebleInteraction(
        sceneRef,
        mountRef,
        {
            mode, activeShape, activeLayerId, symmetry, radialCount, userImports,
            surfaceMode, gridLock, gridSize, voidAnchor, chaosMode, fractalEcho,
            sculptSettings, sculptTool, sculptColor,
            isGizmoDragging // Pass ref to hook
        },
        { setTransformData, setSelectedObjectUUID, setStatus, setObjectCount, setMode, setGizmoMode },
        { spawnProceduralObject, captureCurrentTransform }
    );

    // Lighting Update
    useEffect(() => {
        const { keyLight, fillLight, rimLight, bounceLight } = sceneRef.current;
        updateLighting({ keyLight, fillLight, rimLight, bounceLight }, sunIntensity, sunAngle);
    }, [sunIntensity, sunAngle]);

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
                        } catch (e) { console.warn("Material extraction failed", e); }
                    }
                });

                if (newLibEntries.length > 0) {
                    setMaterialLibrary(prev => [...prev, ...newLibEntries]);
                }
            }

            const box = new THREE.Box3().setFromObject(scene);
            const size = new THREE.Vector3(); box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1 / (maxDim || 1);
            scene.scale.set(scale, scale, scale);

            const baseLayer = sceneRef.current.layerMap?.base;
            if (baseLayer?.group) {
                while (baseLayer.group.children.length > 0) {
                    const child = baseLayer.group.children[0];
                    baseLayer.group.remove(child);
                }

                const baseContainer = new THREE.Group();
                baseContainer.userData.isContainer = true;
                baseContainer.userData.isSharedBase = true;
                const sharedScene = scene.clone(true);
                sharedScene.traverse((c: any) => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                    }
                });
                baseContainer.add(sharedScene);
                baseLayer.group.add(baseContainer);
                sceneRef.current.selectedObject = baseContainer;
                setSelectedObjectUUID(baseContainer.uuid);
                setActiveLayerId('base');
            }

            const newImport = { id: `import_${item.id}`, storageId: item.id, name: item.name, scene: scene };
            setUserImports(prev => [...prev, newImport]);
            setActiveShape(newImport.id);
            setStatus("KERNEL ASSET READY");
        });
    };

    useEffect(() => {
        if (isToolOverlay) return;
        if (!sharedState?.activeArtifactId || !sharedState?.storage) return;
        const current = sharedState.storage.find((item: any) => item.id === sharedState.activeArtifactId);
        if (current?.blob) {
            loadFromStorage(current);
        }
    }, [isToolOverlay, sharedState?.activeArtifactId, sharedState?.storage]);

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT') return;

            // Cancel Picking
            if (e.key === 'Escape' && modifierMode === 'picking_boolean_target') {
                setModifierMode('none');
                setBooleanTargetUUID(null);
                setStatus("Pick Cancelled");
                return;
            }

            // Undo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Surface Mode Toggle
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                setSurfaceMode(prev => !prev);
                setStatus("Surface Mode Toggled");
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'b':
                    setBrushMenuPos(mouseClientRef.current);
                    setIsBrushMenuOpen(prev => !prev);
                    break;
                case 'delete':
                case 'backspace':
                    const { selectedObject, selectionBox } = sceneRef.current;
                    if (selectedObject && selectedObject.parent) {
                        selectedObject.parent.remove(selectedObject);
                        if (selectionBox) selectionBox.visible = false;
                        sceneRef.current.selectedObject = null;
                        setSelectedObjectUUID(null);
                        setStatus("Matter Erased");
                    }
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo]);

    const handleClear = useCallback(() => {
        const { rootGroup, selectionBox } = sceneRef.current;
        if (selectionBox) selectionBox.visible = false;
        sceneRef.current.selectedObject = null;
        setSelectedObjectUUID(null);
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
        setLayers([{ id: 'base', name: 'Base Mesh', visible: true, color: '#333333' }]);
        setActiveLayerId('base');
        setStatus("System Reset");
    }, []);

    const updateMaterialVisuals = useCallback((img: HTMLImageElement) => {
        if (!img) return;
        const loadTexture = (url: string) => new Promise<THREE.Texture>(resolve => new THREE.TextureLoader().load(url, (t) => resolve(t)));
        const useDisplacement = matParams.displacementScale > 0;
        const baseData = processImage(img, 'base', matParams);
        const normalData = processImage(img, 'normal', matParams);
        const ormData = packORM(img, matParams);
        const heightData = useDisplacement ? processImage(img, 'height', matParams) : null;

        Promise.all([
            baseData ? loadTexture(baseData) : Promise.resolve(null),
            normalData ? loadTexture(normalData) : Promise.resolve(null),
            ormData ? loadTexture(ormData) : Promise.resolve(null),
            heightData ? loadTexture(heightData) : Promise.resolve(null)
        ]).then(([albedoTex, normalTex, ormTex, heightTex]) => {
            [albedoTex, normalTex, ormTex, heightTex].forEach(t => {
                if (!t) return; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(matParams.scale, matParams.scale);
            });
            const { material } = sceneRef.current.layerMap[activeLayerId];
            if (material.map && albedoTex) { material.map.image = albedoTex.image; material.map.repeat.set(matParams.scale, matParams.scale); material.map.needsUpdate = true; } else { material.map = albedoTex; }
            if (material.normalMap && normalTex) { material.normalMap.image = normalTex.image; material.normalMap.repeat.set(matParams.scale, matParams.scale); material.normalMap.needsUpdate = true; } else { material.normalMap = normalTex; }
            if (material.roughnessMap && ormTex) { material.roughnessMap.image = ormTex.image; material.roughnessMap.repeat.set(matParams.scale, matParams.scale); material.roughnessMap.needsUpdate = true; } else { material.roughnessMap = ormTex; material.aoMap = ormTex; material.metalnessMap = ormTex; }
            if (heightTex) { if (material.displacementMap) { material.displacementMap.image = heightTex.image; material.displacementMap.needsUpdate = true; } else { material.displacementMap = heightTex; } material.displacementScale = matParams.displacementScale; } else { if (material.displacementMap) { material.displacementMap.dispose(); material.displacementMap = null; } material.displacementScale = 0; }
            material.color.setHex(0xffffff); material.needsUpdate = true;
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, texture: baseData } : l));
        });
    }, [activeLayerId, matParams]);



    // --- MODIFIER LOGIC ---
    useEffect(() => {
        if (modifierMode === 'picking_boolean_target' && selectedObjectUUID) {
            // User picked something
            // Check if it is different from current selection? 
            // Wait, useKGreebleInteraction updates selectedObjectUUID when we click.
            // But we need to distinguish "Subject" (Start) vs "Target" (Pick).
            // Currently selectedObjectUUID is the ONLY selection.
            // So: User selects A. Click Pick. user Selects B.
            // selectedObjectUUID becomes B.

            // We need to capture "Subject" BEFORE mode starts or implicitly assume 
            // we have a Subject.
            // Actually, we should probably listen for selectedObjectUUID changes?
            // But here we are in render.
        }
    }, [selectedObjectUUID, modifierMode]);

    // We need to handle the picking logic. 
    // The easiest way without rewriting interaction is:
    // When Pick Target is clicked, we assume the Current Selected Object is the SUBJECT.
    // We store it in a Ref or State.
    // Then when selectedObjectUUID changes, we assume that's the TARGET.

    const booleanSubjectRef = useRef<string | null>(null);

    useEffect(() => {
        if (modifierMode === 'picking_boolean_target') {
            if (!booleanSubjectRef.current) {
                // Initialize Subject
                booleanSubjectRef.current = selectedObjectUUID;
                setStatus("Pick Target Object...");
            } else if (selectedObjectUUID !== booleanSubjectRef.current) {
                // We picked a new object
                setBooleanTargetUUID(selectedObjectUUID);
                setStatus("Target Acquired");
                // We DON'T exit mode yet, allowing re-pick? Or exit?
                // Let's exit picking mode
                setModifierMode('none');

                // Restore selection to Subject so we can perform op? 
                // Creating the boolean usually implies "Subject - Target" or similar.
                // It's better to keep Target in state, and Subject is the 'main' selection.
                // But wait, if I reset selection to Subject, user sees Subject selected.
                // That's good.

                // Let's do:
                setTimeout(() => setSelectedObjectUUID(booleanSubjectRef.current), 50);
            }
        } else {
            // Reset
            if (modifierMode === 'none') {
                // don't clear targetUUID here, we need it for buttons
                booleanSubjectRef.current = null;
            }
        }
    }, [modifierMode, selectedObjectUUID]);

    const handleBooleanOp = useCallback((op: 'UNION' | 'SUBTRACT' | 'INTERSECT') => {
        const { scene, layerMap } = sceneRef.current;
        if (!selectedObjectUUID || !booleanTargetUUID) return;

        const subject = scene.getObjectByProperty('uuid', selectedObjectUUID); // Current selection should be Subject
        const target = scene.getObjectByProperty('uuid', booleanTargetUUID);

        if (subject && target && subject instanceof THREE.Mesh && target instanceof THREE.Mesh) {
            const result = performBoolean(subject, target, op);
            if (result) {
                // Add result to active layer
                const layer = layerMap[activeLayerId];
                if (layer) {
                    result.userData.isBooleanResult = true;
                    if (layer.material) result.material = layer.material;
                    layer.group.add(result);

                    // Remove originals? usually yes
                    if (subject.parent) subject.parent.remove(subject);
                    if (target.parent) target.parent.remove(target);

                    // Select new result
                    setSelectedObjectUUID(result.uuid);
                    sceneRef.current.selectedObject = result;

                    // Reset
                    setBooleanTargetUUID(null);
                    setStatus(`Boolean ${op} Complete`);
                }
            } else {
                setStatus("Boolean Failed");
            }
        }
    }, [selectedObjectUUID, booleanTargetUUID, activeLayerId]);

    const handleArrayOp = useCallback(() => {
        const { scene, layerMap } = sceneRef.current;
        if (!selectedObjectUUID) return;

        const subject = scene.getObjectByProperty('uuid', selectedObjectUUID);
        if (subject) {
            // Create Array
            const offsetVec = new THREE.Vector3(arrayParams.offset.x, arrayParams.offset.y, arrayParams.offset.z);
            const rotEuler = new THREE.Euler(0, 0, 0); // Todo: add UI
            const scaleVec = new THREE.Vector3(1, 1, 1); // Todo: add UI

            const group = createLinearArray(subject, arrayParams.count, offsetVec, rotEuler, scaleVec);

            const layer = layerMap[activeLayerId];
            if (layer && group) {
                // Remove original if we want, or keep it.
                // createLinearArray generates new clones relative to original position.
                // Usually we keep original as first element or replace.
                // My implementation adds offset * i.
                // So i=0 overlaps original.

                // Let's hide original or remove it?
                // Safer: array is a new object.
                layer.group.add(group);

                // Remove original to avoid Z-fighting on first element
                if (subject.parent) subject.parent.remove(subject);

                // Select group
                // sceneRef.current.selectedObject = group; // Interaction might not support Group selection well yet
                // But let's try.
                setStatus("Array Created");
            }
        }
    }, [selectedObjectUUID, arrayParams, activeLayerId]);



    const removeMaterial = useCallback((layerId: string) => {
        const { layerMap } = sceneRef.current;
        const layer3D = layerMap[layerId];
        if (!layer3D) return;

        // Dispose old material
        if (layer3D.material) layer3D.material.dispose();

        // Create new default material
        const newMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.6 });
        layer3D.material = newMat;
        layer3D.group.traverse((c: any) => { if (c.isMesh) c.material = newMat; });
        layerMap[layerId].material = newMat;

        // Update State
        setLayers(prev => prev.map(l => l.id === layerId ? { ...l, texture: null, sourceImg: null } : l));
        setStatus("Material Stripped");
    }, []);

    const commitMaterial = useCallback((img: HTMLImageElement, name: string) => {
        const baseData = processImage(img, 'base', matParams);
        setMaterialLibrary(prev => { if (prev.find(m => m.sourceImg.src === img.src)) return prev; return [...prev, { id: Date.now(), name: name, texture: baseData, sourceImg: img }]; });
        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, sourceImg: img } : l));
        updateMaterialVisuals(img);
        setStatus("Material Created");
    }, [activeLayerId, matParams, updateMaterialVisuals]);

    const handleTextureUploadClick = () => { if (textureInputRef.current) textureInputRef.current.click(); };
    const handleTextureUpload = (e: any) => {
        const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const img = new Image(); img.src = evt.target?.result as string; img.onload = () => { commitMaterial(img, file.name); } }; reader.readAsDataURL(file);
    };

    const addLayer = () => {
        const id = `layer_${Date.now()}`; const name = `Layer ${layers.length + 1}`; const color = '#' + Math.floor(Math.random() * 16777215).toString(16);
        setLayers(prev => [...prev, { id, name, visible: true, color, texture: null, sourceImg: null }]);
        setActiveLayerId(id);
        const { rootGroup, layerMap } = sceneRef.current;
        const newGroup = new THREE.Group(); newGroup.userData.isLayer = true; rootGroup.add(newGroup);
        const newMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.5, metalness: 0.5 });
        layerMap[id] = { group: newGroup, material: newMat };
        setStatus(`Created ${name}`);
    };

    const handleCycleLayer = (direction: number) => {
        if (layers.length === 0) return;
        const currentIdx = layers.findIndex(l => l.id === activeLayerId);
        if (currentIdx === -1) { setActiveLayerId(layers[0].id); return; }
        const newIdx = Math.max(0, Math.min(layers.length - 1, currentIdx + direction));
        if (newIdx !== currentIdx) {
            const newId = layers[newIdx].id;
            selectLayerObject(newId);
        }
    };

    const handleLayerSelect = (id: string, multi: boolean) => {
        setActiveLayerId(id);
        if (multi) {
            const newSet = new Set(selectedLayerIds);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            setSelectedLayerIds(newSet);
        } else {
            setSelectedLayerIds(new Set([id]));
        }
        selectLayerObject(id);
    };

    const cycleLayer = (direction: number) => {
        if (layers.length === 0) return;
        const currentIndex = layers.findIndex(l => l.id === activeLayerId);
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = layers.length - 1;
        if (newIndex >= layers.length) newIndex = 0;
        const newLayer = layers[newIndex];
        handleLayerSelect(newLayer.id, false);
    };

    const mergeMeshes = (idsToMerge: string[], newName: string) => {
        const { layerMap, rootGroup } = sceneRef.current;
        const layersToMerge = idsToMerge.map(id => layerMap[id]).filter(l => l);
        if (layersToMerge.length < 2) return;

        setStatus("FUSING LAYERS...");

        // Collect all meshes from all groups
        const geometries: THREE.BufferGeometry[] = [];
        let targetMat = layersToMerge[layersToMerge.length - 1].material;

        layersToMerge.forEach(layer => {
            layer.group.traverse((child: any) => {
                if (child.isMesh && child.geometry) {
                    child.updateMatrixWorld();
                    const geo = child.geometry.clone();
                    geo.applyMatrix4(child.matrixWorld);
                    geometries.push(geo);
                }
            });
        });

        if (geometries.length > 0) {
            try {
                const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries);
                mergedGeo.center(); // Center geometry to local origin
                mergedGeo.computeVertexNormals();

                // Remove old layers
                idsToMerge.forEach(id => deleteLayer(id));

                // Create new layer
                const id = `layer_${Date.now()}`;
                const newGroup = new THREE.Group();
                newGroup.userData.isLayer = true;
                newGroup.userData.isContainer = true; // Ensure it's treated as a container for selection
                rootGroup.add(newGroup);

                const newMesh = new THREE.Mesh(mergedGeo, targetMat);
                newMesh.castShadow = true; newMesh.receiveShadow = true;
                newMesh.userData.isMerged = true; // Tag for potential future use
                newGroup.add(newMesh);

                layerMap[id] = { group: newGroup, material: targetMat };
                setLayers(prev => [...prev, { id, name: newName, visible: true, color: '#ffffff', texture: null, sourceImg: null }]);
                setActiveLayerId(id);
                setSelectedLayerIds(new Set([id]));
                selectLayerObject(id);
                setStatus("FUSION COMPLETE");
            } catch (e) { console.error(e); setStatus("MERGE FAILED"); }
        }
    };

    const handleMergeSelected = () => {
        if (selectedLayerIds.size < 2) return;
        mergeMeshes(Array.from(selectedLayerIds), "Fused_Layer");
        setSelectedLayerIds(new Set());
    };

    const handleMergeAll = () => {
        if (layers.length < 2) return;
        mergeMeshes(layers.map(l => l.id), "Scene_Monolith");
        setSelectedLayerIds(new Set());
    };
    const duplicateLayer = (id: string) => {
        const sourceLayerState = layers.find(l => l.id === id); if (!sourceLayerState) return; const { rootGroup, layerMap } = sceneRef.current; const sourceLayer3D = layerMap[id]; if (!sourceLayer3D) return; const newId = `layer_${Date.now()}`; const newName = `${sourceLayerState.name} Copy`; const newLayerState = { ...sourceLayerState, id: newId, name: newName }; const newGroup = sourceLayer3D.group.clone(true); const newMaterial = sourceLayer3D.material.clone(); newGroup.traverse((child: any) => { if (child.isMesh) { child.material = newMaterial; child.castShadow = true; child.receiveShadow = true; } }); newGroup.userData.isLayer = true; rootGroup.add(newGroup); layerMap[newId] = { group: newGroup, material: newMaterial }; setLayers(prev => [...prev, newLayerState]); setActiveLayerId(newId); setStatus(`Duplicated ${sourceLayerState.name}`);
    };
    const selectLayerObject = (layerId: string) => {
        const layer = sceneRef.current.layerMap[layerId]; if (!layer) return; const group = layer.group; sceneRef.current.selectedObject = group; setSelectedObjectUUID(group.uuid);
        if (sceneRef.current.selectionBox) { sceneRef.current.selectionBox.setFromObject(group); sceneRef.current.selectionBox.visible = true; }

        // Attach Gizmo
        if (sceneRef.current.transformControl) {
            sceneRef.current.transformControl.attach(group);
        }
        // Auto-enable gizmo mode if off
        setGizmoMode(prev => (prev === 'translate' || prev === 'rotate' || prev === 'scale') ? prev : 'translate');

        setTransformData({ scale: group.scale.x, rotationY: group.rotation.y, height: group.position.y, posX: group.position.x, posY: group.position.y, posZ: group.position.z, rotX: group.rotation.x, rotY: group.rotation.y, rotZ: group.rotation.z, scaleX: group.scale.x, scaleY: group.scale.y, scaleZ: group.scale.z }); setActiveLayerId(layerId); setMode('edit'); setStatus(`Selected Layer: ${layers.find(l => l.id === layerId)?.name}`);
    };
    const deleteLayer = (id: string) => {
        if (layers.length <= 1) return; const { rootGroup, layerMap, selectionBox, transformControl } = sceneRef.current;
        if (selectionBox) selectionBox.visible = false;
        if (transformControl) transformControl.detach();
        sceneRef.current.selectedObject = null; setSelectedObjectUUID(null); const layerObj = layerMap[id]; if (layerObj) { rootGroup.remove(layerObj.group); layerObj.group.traverse((c: any) => { if (c.geometry) c.geometry.dispose(); }); layerObj.material.dispose(); delete layerMap[id]; } const newLayers = layers.filter(l => l.id !== id); setLayers(newLayers); if (activeLayerId === id) setActiveLayerId(newLayers[newLayers.length - 1].id);
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

    const handleExport = (exportMode: 'download' | 'commit', format: 'glb' | 'obj' = 'glb') => {
        const { rootGroup, selectionBox, animation } = sceneRef.current;
        const sceneToExport = prepareSceneForExport(rootGroup, includeBase, selectionBox);

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

    const handleDeleteSelected = () => { const { selectedObject, selectionBox } = sceneRef.current; if (selectedObject && selectedObject.parent) { selectedObject.parent.remove(selectedObject); if (selectionBox) selectionBox.visible = false; sceneRef.current.selectedObject = null; setSelectedObjectUUID(null); setStatus("Matter Erased"); } };
    const handleDuplicateObject = () => { const { selectedObject, selectionBox } = sceneRef.current; if (selectedObject && selectedObject.parent) { const clone = selectedObject.clone(true); clone.position.add(new THREE.Vector3(0.5, 0, 0.5)); selectedObject.parent.add(clone); sceneRef.current.selectedObject = clone; setSelectedObjectUUID(clone.uuid); if (selectionBox) selectionBox.setFromObject(clone); setStatus("Replicated"); } };
    const handleGenerate = async () => { if (!prompt) return; setGenerating(true); setStatus(`Conjuring Texture...`); const result = await generateTexture(prompt); if (result.url) { const img = new Image(); img.crossOrigin = "Anonymous"; img.src = result.url; img.onload = () => { commitMaterial(img, prompt.substring(0, 10)); }; } else if (result.error) { setStatus(`Error: ${result.error}`); } setGenerating(false); };

    const executeArchitectProtocol = async () => {
        if (!architectPrompt) return;
        setIsArchitecting(true);
        setStatus("Establishing Neural Link...");
        const responseData = await generateSceneLayout(architectPrompt);
        if (responseData && responseData.layers) {
            for (const layerDef of responseData.layers) {
                const layerName = layerDef.name || "AI_Layer"; const layerColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
                let targetLayerId = layersRef.current.find((l: any) => l.name === layerName)?.id;
                if (!targetLayerId) { targetLayerId = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; const newLayerState = { id: targetLayerId, name: layerName, visible: true, color: layerColor, texture: null, sourceImg: null }; setLayers(prev => [...prev, newLayerState]); const { rootGroup, layerMap } = sceneRef.current; const newGroup = new THREE.Group(); newGroup.userData.isLayer = true; rootGroup.add(newGroup); const newMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(layerColor), roughness: 0.5, metalness: 0.5 }); layerMap[targetLayerId] = { group: newGroup, material: newMat }; }
                if (layerDef.objects && Array.isArray(layerDef.objects)) { for (const item of layerDef.objects) { const shapeKey = Object.values(SHAPES).includes(item.type) ? item.type : SHAPES.CUBE; const pos = new THREE.Vector3(item.pos?.[0] || 0, item.pos?.[1] || 0, item.pos?.[2] || 0); const normal = new THREE.Vector3(0, 1, 0); const obj = spawnProceduralObject(pos, normal, shapeKey, targetLayerId); if (obj) { if (item.rot) obj.rotation.set(item.rot[0], item.rot[1], item.rot[2]); if (item.scale) obj.scale.set(item.scale[0], item.scale[1], item.scale[2]); } await new Promise(r => setTimeout(r, 10)); } }
            }
            setStatus("Neural Construction Complete");
        } else if (responseData && Array.isArray(responseData)) {
            for (const item of responseData) { const shapeKey = Object.values(SHAPES).includes(item.type) ? item.type : SHAPES.CUBE; const pos = new THREE.Vector3(item.pos?.[0] || 0, item.pos?.[1] || 0, item.pos?.[2] || 0); const normal = new THREE.Vector3(0, 1, 0); const obj = spawnProceduralObject(pos, normal, shapeKey); if (obj) { if (item.rot) obj.rotation.set(item.rot[0], item.rot[1], item.rot[2]); if (item.scale) obj.scale.set(item.scale[0], item.scale[1], item.scale[2]); } await new Promise(r => setTimeout(r, 20)); }
            setStatus("Neural Construction Complete (Flat)");
        } else { setStatus("Protocol Error: Invalid Blueprint"); }
        setIsArchitecting(false);
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

    // INITIALIZATION & RENDER LOOP
    useEffect(() => {
        if (isToolOverlay) return;
        if (!mountRef.current) return;
        mountRef.current.innerHTML = '';

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x151515);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 8000);
        camera.position.set(3, 4, 6);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio); // High DPI
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mountRef.current.appendChild(renderer.domElement);

        // --- ENVIRONMENT (IBL) ---
        try {
            console.log("Initializing Environment...");
            const pmremGenerator = new PMREMGenerator(renderer);
            pmremGenerator.compileEquirectangularShader();
            const roomEnvironment = new RoomEnvironment();
            scene.environment = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
            // scene.background = new THREE.Color(0x111111); // Keep dark background
            roomEnvironment.dispose();
            console.log("Environment Initialized.");
        } catch (e) {
            console.error("Failed to initialize Environment:", e);
        }

        const ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0); scene.add(ambient); // Reduced ambient, let IBL do the work
        const { keyLight, fillLight, rimLight, bounceLight } = initLighting(scene);

        const rootGroup = new THREE.Group(); scene.add(rootGroup);
        const selectionBox = new THREE.BoxHelper(undefined, 0x00ff00); selectionBox.visible = false; scene.add(selectionBox);

        const grid = new THREE.GridHelper(4000, 400, 0x444444, 0x222222); grid.position.y = -0.01; scene.add(grid);

        // --- SKY SETUP ---
        let sky: any = null;
        try {
            console.log("Initializing Sky...", Sky);
            if (Sky) {
                sky = new Sky();
                sky.scale.setScalar(450000);
                sky.material.uniforms['turbidity'].value = 10;
                sky.material.uniforms['rayleigh'].value = 3;
                sky.material.uniforms['mieCoefficient'].value = 0.005;
                sky.material.uniforms['mieDirectionalG'].value = 0.7;
                sky.visible = false;
                scene.add(sky);
                console.log("Sky Initialized.");
            } else {
                console.error("Sky class is undefined!");
            }
        } catch (e) {
            console.error("Failed to initialize Sky:", e);
        }

        const baseGroup = new THREE.Group(); baseGroup.userData.isLayer = true; baseGroup.userData.isBase = true; rootGroup.add(baseGroup);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.6 });
        const baseContainer = new THREE.Group(); baseContainer.userData.isContainer = true; baseContainer.userData.isDefaultBase = true;

        baseGroup.add(baseContainer);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05; controls.maxDistance = 4000;
        const disconnectZenViewport = connectViewport({
            element: mountRef.current,
            scene,
            camera,
            controls,
            renderer
        });

        const transformControl = new TransformControls(camera, renderer.domElement);
        transformControl.addEventListener('dragging-changed', (event: any) => {
            controls.enabled = !event.value;
            isGizmoDragging.current = event.value;

            // Auto-Key Logic on Release
            if (!event.value && modeRef.current === 'animate' && autoKeyRef.current) {
                captureCurrentTransform();
                setStatus("Auto-Key Recorded");
            }
        });
        transformControl.addEventListener('change', () => {
            const { selectedObject, animation } = sceneRef.current;
            if (selectedObject) {
                // Scale Safety (from KSculpt)
                if (Math.abs(selectedObject.scale.x) < 0.001) selectedObject.scale.x = 0.001;
                if (Math.abs(selectedObject.scale.y) < 0.001) selectedObject.scale.y = 0.001;
                if (Math.abs(selectedObject.scale.z) < 0.001) selectedObject.scale.z = 0.001;

                // Sync transform back to React state
                setTransformData({
                    scale: selectedObject.scale.x,
                    rotationY: selectedObject.rotation.y,
                    height: selectedObject.position.y,
                    posX: selectedObject.position.x,
                    posY: selectedObject.position.y,
                    posZ: selectedObject.position.z,
                    rotX: selectedObject.rotation.x,
                    rotY: selectedObject.rotation.y,
                    rotZ: selectedObject.rotation.z,
                    scaleX: selectedObject.scale.x,
                    scaleY: selectedObject.scale.y,
                    scaleZ: selectedObject.scale.z
                });

                // Live Keyframe Recording if animating
                if (mode === 'animate' && animation.isPlaying) {
                    captureCurrentTransform();
                }
            }
        });
        scene.add(transformControl as any);

        // Initialize Brush Cursor for sculpting
        const cursorGeo = new THREE.RingGeometry(0.02, 0.03, 32);
        const cursorMat = new THREE.MeshBasicMaterial({ color: 0x3daee9, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide });
        const brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
        brushCursor.visible = false;
        scene.add(brushCursor);

        sceneRef.current = {
            ...sceneRef.current, scene, camera, renderer, rootGroup, controls, transformControl,
            selectionBox, keyLight, fillLight, rimLight, bounceLight,
            layerMap: { 'base': { group: baseGroup, material: baseMat } },
            dragTarget: new THREE.Vector3(),
            brushCursor, sky, grid
        };

        // --- POST-PROCESSING SETUP ---
        const composer = new EffectComposer(renderer);

        // Pass 1: Base Render
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Pass 2: SAO (Ambient Occlusion) - ENABLED BY DEFAULT
        const saoPass = new (SAOPass as any)(scene, camera, false, true);
        saoPass.enabled = true; // Always on for "PS4" look
        saoPass.params.saoBias = 0.5;
        saoPass.params.saoIntensity = 0.002; // Subtle but present
        saoPass.params.saoScale = 10;
        saoPass.params.saoKernelRadius = 15;
        saoPass.params.saoMinResolution = 0;
        saoPass.params.saoBlur = true;
        composer.addPass(saoPass);

        // Pass 3: SSR
        const ssrPass = new SSRPass({
            renderer, scene, camera, width: mountRef.current?.clientWidth || 800, height: mountRef.current?.clientHeight || 600,
            groundReflector: null, selects: null
        });
        ssrPass.thickness = 0.01;
        ssrPass.infiniteThick = false;
        ssrPass.enabled = false;
        composer.addPass(ssrPass);

        // Pass 4: Bloom
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(mountRef.current?.clientWidth || 800, mountRef.current?.clientHeight || 600), 1.5, 0.4, 0.85);
        bloomPass.strength = 0.3; // Cinematic bloom
        bloomPass.radius = 0.2;
        bloomPass.threshold = 0.9;
        composer.addPass(bloomPass);

        // Pass 5: Gamma
        const gammaPass = new ShaderPass(GammaCorrectionShader);
        composer.addPass(gammaPass);

        sceneRef.current.composer = composer;
        sceneRef.current.passes = { sao: saoPass, ssr: ssrPass, bloom: bloomPass };

        // Ground Plane for SSR
        // Ground Plane for SSR
        const planeGeo = new THREE.PlaneGeometry(150, 150);
        const planeMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.5, side: THREE.DoubleSide });
        const groundPlane = new THREE.Mesh(planeGeo, planeMat);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.y = -0.01;
        groundPlane.receiveShadow = true;
        groundPlane.visible = false;
        scene.add(groundPlane);
        sceneRef.current.groundPlane = groundPlane;

        // Ground Plane Update Logic
        sceneRef.current.updateGround = (size: number, isHDR: boolean) => {
            if (groundPlane) {
                groundPlane.geometry.dispose();
                groundPlane.geometry = new THREE.PlaneGeometry(size, size);

                if (isHDR) {
                    // Darker, glossier floor for HDR to show reflections and shadows
                    (groundPlane.material as THREE.MeshStandardMaterial).color.setHex(0x111111);
                    (groundPlane.material as THREE.MeshStandardMaterial).roughness = 0.1;
                    (groundPlane.material as THREE.MeshStandardMaterial).metalness = 0.8;
                } else {
                    // Default dark floor
                    (groundPlane.material as THREE.MeshStandardMaterial).color.setHex(0x050505);
                    (groundPlane.material as THREE.MeshStandardMaterial).roughness = 0.1;
                    (groundPlane.material as THREE.MeshStandardMaterial).metalness = 0.5;
                }
            }
        };

        let frameId: any;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            const { animation, selectedObject, isDragging, dragTarget } = sceneRef.current;

            if (isDragging && selectedObject && dragTarget) {
                // LEGACY DRAG REMOVED - GIZMO ONLY
                // selectedObject.position.lerp(dragTarget, 0.35);
            }

            if (animation && animation.isPlaying) {
                const dt = 1.0 / (animation.fps || 60);
                animation.time += dt;
                if (animation.time > animation.duration) animation.time = 0;
                setAnimTime(animation.time);
            }

            if (animation && animation.data) {
                const t = animation.time;
                Object.keys(animation.data).forEach(uuid => {
                    if (selectedObject && uuid === selectedObject.uuid && isDragging) return;
                    if (!animation.isPlaying && !animation.isScrubbing && selectedObject && uuid === selectedObject.uuid) return;

                    const keys = animation.data[uuid];
                    if (!keys || keys.length < 1) return;
                    let target: any = undefined;
                    scene.traverse((c: any) => { if (c.uuid === uuid) target = c; });
                    if (!target) return;

                    keys.sort((a: any, b: any) => a.t - b.t);

                    if (t <= keys[0].t) { const k = keys[0]; target.position.copy(k.p); target.quaternion.copy(k.q); target.scale.copy(k.s); return; }
                    if (t >= keys[keys.length - 1].t) { const k = keys[keys.length - 1]; target.position.copy(k.p); target.quaternion.copy(k.q); target.scale.copy(k.s); return; }

                    for (let i = 0; i < keys.length - 1; i++) {
                        if (t >= keys[i].t && t <= keys[i + 1].t) {
                            const k1 = keys[i]; const k2 = keys[i + 1];
                            const range = k2.t - k1.t;
                            let alpha = range <= 0 ? 0 : (t - k1.t) / range;

                            // EASING
                            if (easingTypeRef.current === 'smooth') {
                                alpha = alpha * alpha * (3 - 2 * alpha); // SmoothStep
                            } else if (easingTypeRef.current === 'elastic') {
                                const c4 = (2 * Math.PI) / 3;
                                alpha = alpha === 0 ? 0 : alpha === 1 ? 1 : -Math.pow(2, 10 * alpha - 10) * Math.sin((alpha * 10 - 10.75) * c4);
                            }

                            target.position.lerpVectors(k1.p, k2.p, alpha);
                            target.quaternion.slerpQuaternions(k1.q, k2.q, alpha);
                            target.scale.lerpVectors(k1.s, k2.s, alpha);

                            // PROCEDURAL MODIFIERS
                            const { pulseSpeed, pulseAmp, spinSpeed } = proceduralSettingsRef.current;
                            if (pulseSpeed > 0 && pulseAmp > 0) {
                                const scaleOffset = Math.sin(t * pulseSpeed * 5) * pulseAmp;
                                target.scale.addScalar(scaleOffset);
                            }
                            if (spinSpeed > 0) {
                                target.rotation.y += t * spinSpeed;
                            }

                            // CHAOS TRACK
                            if (chaosTrackRef.current > 0) {
                                const chaos = chaosTrackRef.current * 0.1;
                                target.position.x += (Math.random() - 0.5) * chaos;
                                target.position.y += (Math.random() - 0.5) * chaos;
                                target.position.z += (Math.random() - 0.5) * chaos;
                            }
                            break;
                        }
                    }

                    // MOTION TRAIL VISUALIZER
                    if (motionTrailRef.current && selectedObject && uuid === selectedObject.uuid) {
                        if (!sceneRef.current.trailLine) {
                            const geometry = new THREE.BufferGeometry();
                            const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
                            const line = new THREE.Line(geometry, material);
                            scene.add(line);
                            sceneRef.current.trailLine = line;
                        }

                        // Generate path points from keys
                        const points = [];
                        keys.forEach((k: any) => points.push(k.p.x, k.p.y, k.p.z));
                        sceneRef.current.trailLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
                        sceneRef.current.trailLine.visible = true;
                    } else if (sceneRef.current.trailLine) {
                        sceneRef.current.trailLine.visible = false;
                    }
                });
            }

            controls.update();
            if (selectedObject && selectionBox) { selectionBox.setFromObject(selectedObject); selectionBox.update(); }

            // Update Gizmo
            if (transformControl && selectedObject && (modeRef.current === 'edit' || modeRef.current === 'animate')) {
                if (transformControl.object !== selectedObject) transformControl.attach(selectedObject);
            } else if (transformControl) {
                transformControl.detach();
            }

            // RENDER
            if (rayTracingRef.current && sceneRef.current.composer) {
                sceneRef.current.composer.render();
            } else {
                renderer.render(scene, camera);
            }

            // Update Ground dynamically if needed (though usually event driven is better, this ensures sync)
            if (sceneRef.current.groundPlane && sceneRef.current.updateGround) {
                // Check if we need to update based on ref changes (optimization: only do this when props change)
            }
        };

        animate();

        const handleResize = () => {
            if (!mountRef.current) return;
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };

        const resizeObserver = new ResizeObserver(() => {
            // Debounce resize to prevent black flash during panel transitions
            const w = window as any;
            if (w.resizeTimeout) clearTimeout(w.resizeTimeout);
            w.resizeTimeout = setTimeout(() => {
                handleResize();
            }, 100);
        });
        if (mountRef.current) resizeObserver.observe(mountRef.current);

        return () => {
            disconnectZenViewport();
            cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            const w = window as any;
            if (w.resizeTimeout) clearTimeout(w.resizeTimeout);
            if (mountRef.current) mountRef.current.innerHTML = '';
            renderer.dispose();
        };
    }, [connectViewport, isToolOverlay]);

    // --- ALT ORBIT LOGIC ---
    useEffect(() => {
        const { controls } = sceneRef.current;
        if (!controls) return;

        if (altOrbit) {
            // Disable default left-click orbit
            controls.mouseButtons.LEFT = null;
            controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
            controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Alt') {
                    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
                }
            };
            const handleKeyUp = (e: KeyboardEvent) => {
                if (e.key === 'Alt') {
                    controls.mouseButtons.LEFT = null;
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            return () => {
                window.removeEventListener('keydown', handleKeyDown);
                window.removeEventListener('keyup', handleKeyUp);
                // Reset defaults on cleanup
                controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
            };
        } else {
            // Reset to standard
            controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        }
    }, [altOrbit]);

    const resetSim = () => { /* Placeholder for future simulation reset if added to Greeble */ };

    useEffect(() => {
        if (sceneRef.current && sceneRef.current.updateGround) {
            sceneRef.current.updateGround(groundSize, false); // Assuming no custom HDR means default ground behavior
        }
    }, [groundSize]);

    return (
        <KGreebleUI
            mode={mode} setMode={setMode}
            buildTab={buildTab} setBuildTab={setBuildTab}
            activeShape={activeShape} setActiveShape={setActiveShape}
            architectPrompt={architectPrompt} setArchitectPrompt={setArchitectPrompt} isArchitecting={isArchitecting} executeArchitectProtocol={executeArchitectProtocol}
            selectedObjectUUID={selectedObjectUUID} transformData={transformData} updateTransformFromUI={updateTransformFromUI}
            animTime={animTime} animDuration={animDuration} setAnimDuration={setAnimDuration} isPlaying={isPlaying} togglePlay={togglePlay} stopPlay={stopPlay}
            handleTimelineScrub={handleTimelineScrub} handleSliderChange={handleSliderChange} handleSliderUp={handleSliderUp} keyframes={keyframes}
            handleAddKeyframe={handleAddKeyframe} handleDeleteKeyframe={handleDeleteKeyframe} targetFPS={targetFPS} setTargetFPS={setTargetFPS}
            layers={layers} activeLayerId={activeLayerId} setActiveLayerId={handleLayerSelect} addLayer={addLayer} duplicateLayer={duplicateLayer} deleteLayer={deleteLayer} toggleVisibility={toggleVisibility} selectLayerObject={selectLayerObject}
            selectedLayerIds={selectedLayerIds} handleMergeSelected={handleMergeSelected} handleMergeAll={handleMergeAll}
            gizmoMode={gizmoMode} setGizmoMode={setGizmoMode} transformSpace={transformSpace} setTransformSpace={setTransformSpace} snapEnabled={snapEnabled} setSnapEnabled={setSnapEnabled}
            skyMode={skyMode} setSkyMode={setSkyMode}
            toggleDefaultHDR={undefined} groundSize={groundSize} setGroundSize={setGroundSize}
            scene={sceneRef.current.scene} renderer={sceneRef.current.renderer}
            isHDRActive={isHDRActive}
            onHDRActive={(active: boolean) => {
                setIsHDRActive(active);
                if (sceneRef.current?.updateGround) sceneRef.current.updateGround(groundSize, active);
            }}
            materialLibrary={materialLibrary} commitMaterial={commitMaterial} removeMaterial={removeMaterial} prompt={prompt} setPrompt={setPrompt} generating={generating} handleGenerate={handleGenerate}
            handleTextureUploadClick={handleTextureUploadClick} handleTextureUpload={handleTextureUpload} textureInputRef={textureInputRef} matParams={matParams} setMatParams={setMatParams} downloadMap={() => { }} downloadAll={() => { }}
            sunIntensity={sunIntensity} setSunIntensity={setSunIntensity} sunAngle={sunAngle} setSunAngle={setSunAngle}
            handleUndo={handleUndo} handleClear={handleClear}
            handleChaosScatter={handleChaosScatter} handleGlitch={handleGlitch} handleDuplicateObject={handleDuplicateObject} handleDeleteSelected={handleDeleteSelected}
            targetEngine={targetEngine} setTargetEngine={setTargetEngine} mergeOnExport={mergeOnExport} setMergeOnExport={setMergeOnExport} includeBase={includeBase} setIncludeBase={setIncludeBase} handleExport={handleExport}
            neonMode={neonMode} setNeonMode={setNeonMode} toggleFullscreen={toggleFullscreen}
            mountRef={mountRef}
            handleMouseDown={handleMouseDown} handleMouseMove={handleMouseMove} handleMouseUp={handleMouseUp}
            resetCamera={resetCamera} resetSim={resetSim}
            simRes={2048}
            sharedState={sharedState} loadFromStorage={loadFromStorage}

            spaceMenuOpen={spaceMenuOpen}
            spaceMenuPos={spaceMenuPos}
            surfaceMode={surfaceMode} setSurfaceMode={setSurfaceMode}
            symmetry={symmetry} setSymmetry={setSymmetry}
            radialCount={radialCount} setRadialCount={setRadialCount}

            // NEW MODIFIERS
            gridLock={gridLock} setGridLock={setGridLock}
            gridSize={gridSize} setGridSize={setGridSize}
            voidAnchor={voidAnchor} setVoidAnchor={setVoidAnchor}
            chaosMode={chaosMode} setChaosMode={setChaosMode}
            fractalEcho={fractalEcho} setFractalEcho={setFractalEcho}

            // SCULPT
            sculptSettings={sculptSettings} setSculptSettings={setSculptSettings}
            sculptTool={sculptTool} setSculptTool={setSculptTool}
            sculptColor={sculptColor} setSculptColor={setSculptColor}

            // BRUSH MENU
            isBrushMenuOpen={isBrushMenuOpen} setIsBrushMenuOpen={setIsBrushMenuOpen}
            brushMenuPos={brushMenuPos} setBrushMenuPos={setBrushMenuPos}

            // NEW FEATURES
            autoKey={autoKey} setAutoKey={setAutoKey}
            altOrbit={altOrbit} setAltOrbit={setAltOrbit}
            motionTrail={motionTrail} setMotionTrail={setMotionTrail}
            chaosTrack={chaosTrack} setChaosTrack={setChaosTrack}
            rayTracing={rayTracing} setRayTracing={setRayTracing}
            physicsSettings={physicsSettings} setPhysicsSettings={setPhysicsSettings}
            proceduralSettings={proceduralSettings} setProceduralSettings={setProceduralSettings}
            easingType={easingType} setEasingType={setEasingType}
            onBakePhysics={bakePhysics}
            onTogglePhysics={handleTogglePhysics}
            onDropSelected={handleDropSelected}
            onDropAll={handleDropAll}

            // MODIFIERS PROPS
            modifierMode={modifierMode} setModifierMode={setModifierMode}
            handleBooleanOp={handleBooleanOp}
            handleArrayOp={handleArrayOp}
            arrayParams={arrayParams} setArrayParams={setArrayParams}
            booleanTargetUUID={booleanTargetUUID}
            zenShellMode={zenShellMode}
        />
    );
}
