
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Hexagon, Activity, Cuboid, Image as ImageIcon, HardDrive, Box } from 'lucide-react';

// --- THREE-MESH-BVH INTEGRATION ---
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Patch THREE.BufferGeometry and THREE.Mesh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

import { PaintEngine, PaintLayer, TEXTURE_SIZE } from '../../../core/surface/PaintSystem';
import { usePaintInput } from './KPaintMouse';
import { useInput } from '../../../core/hooks/useInput';
import { InkSystem } from './InkSystem';
import KPainterUI from './KPainterUI';
import { PainterContext } from './PainterContext';
import { useZenModuleBridge } from '../../../core/zen';

// --- RUST SPH FLUID SIMULATION (UV-Space) ---
import { RustFluidSim } from '../../../services/rustFluid';

// --- RUST UV RAYCASTING (High-perf paint loop) ---
import { rustRaycastUVManager } from '../../../services/raycastClient';

// --- RUST BRUSH DYNAMICS (Stroke interpolation + symmetry) ---
import { processBrushStroke, SymmetryConfig } from '../../../services/brushDynamics';

const apiKey = (import.meta as any).env?.VITE_API_KEY || '';

const createAtlasBox = (w = 1, h = 1, d = 1, seg = 16) => {
    const geometries = [];
    const createFace = (uOff: number, vOff: number, width: number, height: number, widthSegments: number, heightSegments: number, matrix: THREE.Matrix4) => {
        const geo = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
        geo.applyMatrix4(matrix);
        const uvs = geo.attributes.uv;
        for (let i = 0; i < uvs.count; i++) {
            let u = uvs.getX(i); let v = uvs.getY(i);
            u = (u + uOff) / 3; v = (v + vOff) / 2;
            uvs.setXY(i, u, v);
        }
        return geo;
    };
    const halfW = w / 2; const halfH = h / 2; const halfD = d / 2;
    const mFront = new THREE.Matrix4().makeTranslation(0, 0, halfD); geometries.push(createFace(1, 1, w, h, seg, seg, mFront));
    const mBack = new THREE.Matrix4().makeRotationY(Math.PI); mBack.setPosition(0, 0, -halfD); geometries.push(createFace(2, 1, w, h, seg, seg, mBack));
    // Fixed Right/Left rotations (swapped logic to point outwards)
    const mRight = new THREE.Matrix4().makeRotationY(Math.PI / 2); mRight.setPosition(halfW, 0, 0); geometries.push(createFace(2, 0, d, h, seg, seg, mRight));
    const mLeft = new THREE.Matrix4().makeRotationY(-Math.PI / 2); mLeft.setPosition(-halfW, 0, 0); geometries.push(createFace(0, 1, d, h, seg, seg, mLeft));
    const mTop = new THREE.Matrix4().makeRotationX(-Math.PI / 2); mTop.setPosition(0, halfH, 0); geometries.push(createFace(1, 0, w, d, seg, seg, mTop));
    const mBottom = new THREE.Matrix4().makeRotationX(Math.PI / 2); mBottom.setPosition(0, -halfH, 0); geometries.push(createFace(0, 0, w, d, seg, seg, mBottom));
    return BufferGeometryUtils.mergeGeometries(geometries);
};

const createQuadSphere = (radius = 1, seg = 24) => {
    const geo = createAtlasBox(1, 1, 1, seg);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        v.normalize().multiplyScalar(radius);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
};

const KippIO = {
    normalize: (object: THREE.Object3D) => {
        // *** T-POSE EXTRACTION: Handle animated/skinned meshes ***
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        object.traverse((c: any) => {
            if (c.isSkinnedMesh) {
                skinnedMeshes.push(c);
            }
        });

        // If we have skinned meshes, reset to bind pose and bake to static geometry
        if (skinnedMeshes.length > 0) {
            console.log(`[KPainter] Found ${skinnedMeshes.length} skinned meshes - extracting T-pose...`);

            skinnedMeshes.forEach((skinnedMesh) => {
                const skeleton = skinnedMesh.skeleton;
                if (skeleton) {
                    // Reset all bones to their bind pose (T-pose)
                    skeleton.bones.forEach((bone, i) => {
                        if (skeleton.boneInverses[i]) {
                            // Get the inverse bind matrix and invert it to get the original position
                            const bindMatrix = skeleton.boneInverses[i].clone().invert();
                            bone.matrix.copy(bindMatrix);
                            bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
                        }
                    });
                    skeleton.update();
                }

                // Bake the skinned mesh to a static mesh for painting
                // This converts the deformed geometry to a regular BufferGeometry
                skinnedMesh.updateMatrixWorld(true);
                const bakedGeometry = skinnedMesh.geometry.clone();

                // Apply the bind pose to create static geometry
                // We use the position attribute directly since we're at T-pose
                const posAttr = bakedGeometry.attributes.position;
                const normalAttr = bakedGeometry.attributes.normal;
                const skinIndexAttr = bakedGeometry.attributes.skinIndex as THREE.BufferAttribute;
                const skinWeightAttr = bakedGeometry.attributes.skinWeight as THREE.BufferAttribute;

                if (skinIndexAttr && skinWeightAttr && skeleton) {
                    const boneMatrices = skeleton.boneMatrices;
                    const bindMatrix = skinnedMesh.bindMatrix;
                    const bindMatrixInverse = skinnedMesh.bindMatrixInverse;

                    const vertex = new THREE.Vector3();
                    const normal = new THREE.Vector3();
                    const skinned = new THREE.Vector3();
                    const skinnedNormal = new THREE.Vector3();
                    const temp = new THREE.Vector4();
                    const boneMatrix = new THREE.Matrix4();
                    const tempMatrix = new THREE.Matrix4();

                    for (let i = 0; i < posAttr.count; i++) {
                        vertex.fromBufferAttribute(posAttr, i);
                        vertex.applyMatrix4(bindMatrix);

                        skinned.set(0, 0, 0);

                        for (let j = 0; j < 4; j++) {
                            const boneIndex = skinIndexAttr.getComponent(i, j);
                            const weight = skinWeightAttr.getComponent(i, j);

                            if (weight > 0) {
                                boneMatrix.fromArray(boneMatrices, boneIndex * 16);
                                temp.copy(vertex as any).applyMatrix4(boneMatrix).multiplyScalar(weight);
                                skinned.add(temp as any);
                            }
                        }

                        skinned.applyMatrix4(bindMatrixInverse);
                        posAttr.setXYZ(i, skinned.x, skinned.y, skinned.z);

                        // Also transform normals
                        if (normalAttr) {
                            normal.fromBufferAttribute(normalAttr, i);
                            skinnedNormal.set(0, 0, 0);

                            for (let j = 0; j < 4; j++) {
                                const boneIndex = skinIndexAttr.getComponent(i, j);
                                const weight = skinWeightAttr.getComponent(i, j);

                                if (weight > 0) {
                                    boneMatrix.fromArray(boneMatrices, boneIndex * 16);
                                    tempMatrix.copy(boneMatrix).invert().transpose();
                                    temp.set(normal.x, normal.y, normal.z, 0).applyMatrix4(tempMatrix);
                                    skinnedNormal.add(new THREE.Vector3(temp.x, temp.y, temp.z).multiplyScalar(weight));
                                }
                            }

                            skinnedNormal.normalize();
                            normalAttr.setXYZ(i, skinnedNormal.x, skinnedNormal.y, skinnedNormal.z);
                        }
                    }

                    posAttr.needsUpdate = true;
                    if (normalAttr) normalAttr.needsUpdate = true;
                }

                // Remove skinning attributes - we're now a static mesh
                bakedGeometry.deleteAttribute('skinIndex');
                bakedGeometry.deleteAttribute('skinWeight');

                // Replace the skinned mesh with a regular mesh
                const staticMesh = new THREE.Mesh(bakedGeometry, skinnedMesh.material);
                staticMesh.name = skinnedMesh.name || `baked_mesh_${Date.now()}`;
                staticMesh.userData = skinnedMesh.userData || {};

                // Replace in parent
                if (skinnedMesh.parent) {
                    skinnedMesh.parent.add(staticMesh);
                    skinnedMesh.parent.remove(skinnedMesh);
                    staticMesh.position.copy(skinnedMesh.position);
                    staticMesh.rotation.copy(skinnedMesh.rotation);
                    staticMesh.scale.copy(skinnedMesh.scale);
                }
            });

            console.log('[KPainter] T-pose extraction complete - converted to static meshes');
        }

        // Continue with standard normalization
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 3.0;
        const scaleFactor = targetSize / (maxDim || 1);
        object.position.sub(center.multiplyScalar(scaleFactor));
        object.scale.set(scaleFactor, scaleFactor, scaleFactor);
        const meshes: THREE.Mesh[] = [];
        object.traverse((c: any) => {
            if (c.isMesh) {
                c.castShadow = true; c.receiveShadow = true;

                // *** SAFETY: Ensure mesh and geometry have valid names ***
                if (!c.name) c.name = `mesh_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                if (c.geometry && !c.geometry.name) c.geometry.name = `geo_${c.name}`;
                if (c.material && !c.material.name) c.material.name = `mat_${c.name}`;

                if (!c.geometry.attributes.uv) {
                    const count = c.geometry.attributes.position.count;
                    const uvs = new Float32Array(count * 2);
                    for (let i = 0; i < count; i++) { uvs[i * 2] = (c.geometry.attributes.position.getX(i) + 1) / 2; uvs[i * 2 + 1] = (c.geometry.attributes.position.getY(i) + 1) / 2; }
                    c.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                }
                // Compute BVH for accelerated raycasting
                c.geometry.computeBoundsTree();
                meshes.push(c);
            }
        });
        return { object, meshes };
    },
    getPrimitive: (type: string) => {
        let geo;
        switch (type) {
            case 'cube': geo = createAtlasBox(1.5, 1.5, 1.5, 1); break;
            case 'sphere': geo = createQuadSphere(1.0, 32); break;
            case 'torus': geo = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 64); break;
            case 'plane': geo = new THREE.PlaneGeometry(2, 2); break;
            case 'cylinder': geo = new THREE.CylinderGeometry(0.8, 0.8, 2, 32); break;
            case 'capsule': geo = new THREE.CapsuleGeometry(0.8, 2, 4, 16); break;
            case 'octahedron': geo = new THREE.OctahedronGeometry(1, 0); break;
            default: geo = createAtlasBox(1, 1, 1, 1);
        }
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
        return KippIO.normalize(mesh);
    }
};

interface TextureSet {
    id: string; name: string; meshes: THREE.Mesh[]; layers: PaintLayer[];
    uiLayers: { id: string, name: string, visible: boolean }[];
    compositeLayer: PaintLayer; activeLayerId: string | null;
}

interface HistoryItem { layerId: string; snapshot: any; }

export default function KPainter({ sharedState, onCommit, performance, onAlphaCommit, zenShellMode = 'standalone' }: any) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge('painter');
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- EFFECT THROTTLING (Skip expensive effects every 2nd frame for 2x perf) ---
    const effectFrameRef = useRef(0);
    const EFFECT_THROTTLE_FRAMES = 2; // Run effects every Nth frame (2 = every other frame)

    // Core App State
    const [mode, setMode] = useState<'STARTUP' | 'PAINT'>('STARTUP');
    const [initialData, setInitialData] = useState<{ object: THREE.Object3D, meshes: THREE.Mesh[] } | null>(null);
    const [activeMaterial, setActiveMaterial] = useState<any>(null);
    const [keepMaterials, setKeepMaterials] = useState(true);

    // Paint State
    const [brush, setBrush] = useState<{
        size: number;
        opacity: number;
        hardness: number;
        color: string;
        roughness: number;
        metalness: number;
        emission: number;
        flow: number;
        alphaMap: THREE.Texture | null;
        smartMask: { edge: number; slope: number; height: number };
        spacing: number;
        distanceScale: boolean;
        isSeamless: boolean;
        isPicking: boolean;
        projectionMode: boolean;
        type: string;
    }>({
        size: 50,
        opacity: 1.0,
        hardness: 0.5,
        color: '#ffffff',
        roughness: 0.5,
        metalness: 0.0,
        emission: 0.0,
        flow: 0.5,
        alphaMap: null,
        smartMask: { edge: 0.0, slope: 0.0, height: 0.0 },
        spacing: 0.1,
        distanceScale: false,
        isSeamless: false,
        isPicking: false,
        projectionMode: true, // Enabled by default with Rust BVH raycasting
        type: 'standard' // 'standard', 'INK'
    });
    const [activeChannels, setActiveChannels] = useState({ albedo: true, normal: true, roughness: true, metalness: true, emission: true });

    const [layers, setLayers] = useState<{ id: string, name: string, visible: boolean }[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [textureSets, setTextureSets] = useState<{ id: string, name: string }[]>([]);
    const [activeSetId, setActiveSetId] = useState<string | null>(null);

    const [showMods, setShowMods] = useState(false);
    const [isModsLocked, setIsModsLocked] = useState(false);
    const [modsPosition, setModsPosition] = useState<{ x: number, y: number } | null>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });

    const [activeMods, setActiveMods] = useState<Record<string, boolean>>({
        hydro: false, particulate: false, entropy: false, inertia: false, vector: false,
        reaction: false, vortex: false, drip: false, flow: false, growth: false,
        ferro: false, quantum: false, chronos: false
    });

    const [modParams, setModParams] = useState({ speed: 0.3, chaos: 0.5, intensity: 1.0 });

    // --- SYMMETRY STATE ---
    const [symmetry, setSymmetry] = useState({ x: false, y: false, z: false, radial: false, radialCount: 4 });

    // --- KERR BLACK HOLE STATE ---
    const [blackHole, setBlackHole] = useState({
        active: false,
        strength: 2.0,
        spin: 5.0,
        radius: 0.1,
        decay: 0.95,
        infinite: false
    });

    const [viewChannel, setViewChannel] = useState('MATERIAL');
    const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
    const [performanceMode, setPerformanceMode] = useState(false);

    // --- LIGHTING STATE ---
    const [lighting, setLighting] = useState({ preset: 'studio', intensity: 1.0 });
    const [importedTextures, setImportedTextures] = useState<{ id: string; name: string; url: string; texture: any }[]>([]);

    const handleImportTexture = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const tex = new THREE.TextureLoader().load(url, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.name = file.name;
        });
        const id = Date.now().toString(36);
        setImportedTextures(prev => [...prev, { id, name: file.name, url, texture: tex }]);
    };

    const handleExportTextures = () => {
        // Re-use export logic for now, or trigger saving of active composite
        handleExport();
    };

    const [alphaPrompt, setAlphaPrompt] = useState('');
    const [isGeneratingAlpha, setIsGeneratingAlpha] = useState(false);
    const [status, setStatus] = useState("GPU ENGINE READY");

    useEffect(() => {
        publishLayers(layers.map((layer, index) => ({
            id: layer.id,
            name: activeSetId ? `${activeSetId}:${layer.name}` : layer.name,
            visible: layer.visible,
            order: index,
            tags: activeSetId ? [activeSetId] : []
        })));
    }, [activeSetId, layers, publishLayers]);

    useEffect(() => {
        publishState({
            status,
            activeLayerId,
            activeSetId,
            viewMode
        });
    }, [activeLayerId, activeSetId, publishState, status, viewMode]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            activeAssetId: sharedState?.activeArtifactId ?? null,
            activeLayerId: activeLayerId ? `${activeSetId ?? 'paint'}:${activeLayerId}` : null
        });
    }, [activeLayerId, activeSetId, isToolOverlay, publishSelection, sharedState?.activeArtifactId]);

    const undoStack = useRef<HistoryItem[]>([]);
    const redoStack = useRef<HistoryItem[]>([]);

    const engine = useRef<any>({
        scene: null, camera: null, renderer: null, controls: null,
        paintEngine: null, targetMeshes: [], raycaster: null, cursorMesh: null,
        initialized: false, textureSetData: {}, loadedTextures: null,
        canvas: null, lastPaintPos: null
    });

    const brushRef = useRef(brush);
    const channelsRef = useRef<any>(activeChannels); // Ref for activeChannels state
    const activeLayerIdRef = useRef<string | null>(null);
    const activeSetIdRef = useRef<string | null>(null);
    // Modifiers
    const activeModsRef = useRef<Record<string, boolean>>({});
    const modParamsRef = useRef(modParams);

    // List of all possible channels (static)
    const allChannelsRef = useRef<string[]>(['albedo', 'normal', 'roughness', 'metalness', 'emission']);

    // INK BRUSH STATE
    const inkPointsRef = useRef<number[][]>([]);
    const inkMeshRef = useRef<THREE.Mesh | null>(null);

    // --- RUST SPH FLUID STATE ---
    const rustFluidRef = useRef<RustFluidSim | null>(null);
    const fluidActiveRef = useRef(false);

    const blackHoleRef = useRef(blackHole);
    const viewChannelRef = useRef(viewChannel);
    const viewModeRef = useRef(viewMode); // Added viewModeRef

    useEffect(() => { brushRef.current = brush; }, [brush]);
    useEffect(() => { channelsRef.current = activeChannels; }, [activeChannels]);
    useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
    useEffect(() => { activeSetIdRef.current = activeSetId; }, [activeSetId]);
    useEffect(() => { activeModsRef.current = activeMods; }, [activeMods]);
    useEffect(() => { modParamsRef.current = modParams; }, [modParams]);
    useEffect(() => { blackHoleRef.current = blackHole; }, [blackHole]);
    useEffect(() => { viewChannelRef.current = viewChannel; }, [viewChannel]); // Added sync for viewChannelRef

    useEffect(() => {
        viewModeRef.current = viewMode;
        if (engine.current) {
            engine.current.viewMode = viewMode;

            // Switch Cursor Parent so it renders in the active scene
            const r = engine.current;
            if (r.cursorMesh && r.scene && r.scene2D) {
                if (viewMode === '2D') {
                    r.scene.remove(r.cursorMesh);
                    r.scene2D.add(r.cursorMesh);
                } else {
                    r.scene2D.remove(r.cursorMesh);
                    r.scene.add(r.cursorMesh);
                }
            }
        }
    }, [viewMode]);

    // NEW: Bake Geometry on Load
    // NEW: Bake Geometry on Load
    useEffect(() => {
        const r = engine.current;
        if (r.paintEngine && r.targetMeshes.length > 0) {
            // Bake the active mesh for projection painting support
            // Bake the active mesh for projection painting support
            const targets = r.targetMeshes;

            // Safety: Ensure BVH is computed for ALL meshes
            targets.forEach((t: any) => {
                if (t.geometry && !t.geometry.boundsTree) t.geometry.computeBoundsTree();
            });

            r.paintEngine.bakeGeometry(targets);

            // Critical: Ensure the layer is composed at least once so it's not black
            const setId = activeSetIdRef.current;
            if (setId && r.textureSetData[setId]) {
                const set = r.textureSetData[setId];
                r.paintEngine.compose(set.layers, set.compositeLayer);
            }

            setStatus("GEOMETRY BAKED");
        }
    }, [initialData, activeSetId]);

    useEffect(() => {
        const r = engine.current;
        const setId = activeSetId;
        if (!r.textureSetData || !setId) return;
        const set = r.textureSetData[setId];
        if (!set) return;

        const updateMats = (cb: (mat: THREE.MeshStandardMaterial) => void) => {
            set.meshes.forEach((m: THREE.Mesh) => {
                const mat = m.material as THREE.MeshStandardMaterial;
                cb(mat);
                mat.needsUpdate = true;
            });
        };

        const comp = set.compositeLayer;

        if (viewChannel === 'MATERIAL') {
            updateMats(mat => {
                mat.map = comp.getRead('albedo').texture;
                mat.normalMap = comp.getRead('normal').texture;
                mat.roughnessMap = comp.getRead('roughness').texture;
                mat.metalnessMap = comp.getRead('metalness').texture;
                mat.emissiveMap = comp.getRead('emission').texture;
                mat.color.setHex(0xffffff);
            });
        } else {
            let map: THREE.Texture | null = null;
            if (viewChannel === 'BASE') map = comp.getRead('albedo').texture;
            if (viewChannel === 'NORMAL') map = comp.getRead('normal').texture;
            if (viewChannel === 'ROUGHNESS') map = comp.getRead('roughness').texture;
            if (viewChannel === 'METALNESS') map = comp.getRead('metalness').texture;
            if (viewChannel === 'EMISSION') map = comp.getRead('emission').texture;

            updateMats(mat => {
                mat.map = map;
                mat.normalMap = null;
                mat.roughnessMap = null;
                mat.metalnessMap = null;
                mat.emissiveMap = null;
                mat.color.setHex(0xffffff);
            });
        }
    }, [viewChannel, activeSetId]);

    useEffect(() => {
        const r = engine.current;
        if (r.renderer && performance) {
            r.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (performance.resolution || 1.0));
        }
    }, [performance]);

    // Update Lighting
    useEffect(() => {
        const r = engine.current;
        if (!r.initialized || !r.scene || !r.renderer) return;

        const pmremGenerator = new THREE.PMREMGenerator(r.renderer);

        // Generate environment based on preset
        let envIntensity = 0.04;
        switch (lighting.preset) {
            case 'studio':
                envIntensity = 0.04;
                break;
            case 'outdoor':
                envIntensity = 0.08;
                break;
            case 'dark':
                envIntensity = 0.01;
                break;
            case 'neutral':
                envIntensity = 0.03;
                break;
        }

        // Dispose old environment to prevent memory leak
        if (r.scene.environment) {
            r.scene.environment.dispose();
        }

        const environment = pmremGenerator.fromScene(new RoomEnvironment(), envIntensity).texture;
        r.scene.environment = environment;

        // Apply intensity multiplier to all meshes
        const setId = activeSetIdRef.current;
        if (setId && r.textureSetData[setId]) {
            const set = r.textureSetData[setId];
            set.meshes.forEach((m: THREE.Mesh) => {
                const mat = m.material as THREE.MeshStandardMaterial;
                mat.envMapIntensity = lighting.intensity;
                mat.needsUpdate = true;
            });
        }

        pmremGenerator.dispose();
        setStatus(`LIGHTING: ${lighting.preset.toUpperCase()} @ ${lighting.intensity.toFixed(1)}x`);
    }, [lighting]);

    const recordHistory = useCallback(() => {
        const r = engine.current;
        const setId = activeSetIdRef.current;
        const layerId = activeLayerIdRef.current;
        if (!setId || !layerId || !r.paintEngine) return;
        const set = r.textureSetData[setId];
        const layer = set.layers.find((l: any) => l.id === layerId);
        if (!layer) return;
        const snapshot = r.paintEngine.snapshotLayer(layer);
        undoStack.current.push({ layerId, snapshot });
        if (undoStack.current.length > 20) {
            const oldest = undoStack.current.shift();
            if (oldest) r.paintEngine.disposeSnapshot(oldest.snapshot);
        }
        redoStack.current.forEach(item => r.paintEngine.disposeSnapshot(item.snapshot));
        redoStack.current = [];
    }, []);

    const undo = useCallback(() => {
        const r = engine.current;
        const setId = activeSetIdRef.current;
        if (!undoStack.current.length || !setId || !r.paintEngine) return;
        const set = r.textureSetData[setId];
        const historyItem = undoStack.current.pop();
        if (!historyItem) return;
        const layer = set.layers.find((l: any) => l.id === historyItem.layerId);
        if (layer) {
            const currentSnapshot = r.paintEngine.snapshotLayer(layer);
            redoStack.current.push({ layerId: layer.id, snapshot: currentSnapshot });
            r.paintEngine.restoreLayer(layer, historyItem.snapshot);
            r.paintEngine.disposeSnapshot(historyItem.snapshot);
            r.paintEngine.compose(set.layers, set.compositeLayer);
            setStatus("UNDO");
        }
    }, []);

    const redo = useCallback(() => {
        const r = engine.current;
        const setId = activeSetIdRef.current;
        if (!redoStack.current.length || !setId || !r.paintEngine) return;
        const set = r.textureSetData[setId];
        const redoItem = redoStack.current.pop();
        if (!redoItem) return;
        const layer = set.layers.find((l: any) => l.id === redoItem.layerId);
        if (layer) {
            const currentSnapshot = r.paintEngine.snapshotLayer(layer);
            undoStack.current.push({ layerId: layer.id, snapshot: currentSnapshot });
            r.paintEngine.restoreLayer(layer, redoItem.snapshot);
            r.paintEngine.disposeSnapshot(redoItem.snapshot);
            r.paintEngine.compose(set.layers, set.compositeLayer);
            setStatus("REDO");
        }
    }, []);

    const handlePickColor = useCallback((uv: any) => {
        const r = engine.current;
        const setId = activeSetIdRef.current;
        if (!r.paintEngine || !setId) return;
        const set = r.textureSetData[setId];
        if (!set) return;

        // Pick from composite layer
        const color = r.paintEngine.pickColor(set.compositeLayer, uv);

        // Convert Color to Hex String
        const hex = '#' + color.getHexString();
        setBrush(prev => ({ ...prev, color: hex, isPicking: false }));
        setStatus("SAMPLED COLOR");
    }, []);

    const inputOptions = useMemo(() => ({
        onActionDown: {
            UNDO: undo, REDO: redo,
            NAVIGATE: () => {
                const r = engine.current;
                if (r.controls) {
                    r.controls.enabled = true; r.controls.enableRotate = true; r.controls.enableZoom = true;
                    if (r.cursorMesh) r.cursorMesh.visible = false;
                    if (r.canvas) r.canvas.style.cursor = 'move';
                }
            }
        },
        onActionUp: {
            NAVIGATE: () => {
                const r = engine.current;
                if (r.controls) { r.controls.enableRotate = false; if (r.canvas) r.canvas.style.cursor = 'crosshair'; }
            }
        }
    }), [undo, redo, isModsLocked]);

    useInput(inputOptions);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const r = engine.current;
            if (e.key.toLowerCase() === 'p') {
                setBrush(prev => {
                    const next = !prev.projectionMode;
                    setStatus(next ? "PROJECTION MODE: ON" : "PROJECTION MODE: OFF");
                    return { ...prev, projectionMode: next };
                });
            }
            if (e.key.toLowerCase() === 'i') {
                setBrush(prev => {
                    const next = !prev.isPicking;
                    setStatus(next ? "PICKER: ON" : "PICKER: OFF");
                    return { ...prev, isPicking: next };
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const paint = useCallback((uv: THREE.Vector2, pressure: number = 1.0, event: any) => {
        // console.log("PAINT EXEC:", uv, pressure);
        const r = engine.current;
        const setId = activeSetIdRef.current;
        if (!r.paintEngine || !setId) return;
        const set = r.textureSetData[setId];
        if (!set) return;

        // --- PICKER LOGIC ---
        if (brushRef.current.isPicking) {
            handlePickColor(uv);
            return;
        }

        const activeLId = activeLayerIdRef.current;
        if (!activeLId) return;
        const layer = set.layers.find((l: any) => l.id === activeLId);
        if (!layer || !layer.visible) return;

        const dynamicBrush: any = { ...brushRef.current };
        const pressureCurve = Math.pow(pressure, 1.5);
        dynamicBrush.flow *= pressureCurve;
        dynamicBrush.size *= (0.8 + pressureCurve * 0.2);

        // Inject World Position for Projection Painting
        if (dynamicBrush.projectionMode && r.cursorMesh) {
            dynamicBrush.worldPos = r.cursorMesh.position.clone();
        }

        // --- MASKING LOGIC ---
        const isMasking = event.ctrlKey;
        const isEraseMask = event.shiftKey;

        if (isMasking) {
            r.paintEngine.paint(uv, dynamicBrush, null, null, null, null, true, isEraseMask);
            return;
        }

        if (activeModsRef.current.hydro) {
            let delta = new THREE.Vector2(0, 0);
            if (r.lastPaintPos) { delta.subVectors(uv, r.lastPaintPos).multiplyScalar(50.0); }
            r.lastPaintPos = uv.clone();
            r.paintEngine.splatVelocity(layer, uv, delta, dynamicBrush.size * pressure);
        }

        // Store last position for simulation logic that needs tracking
        r.lastPaintPos = uv.clone();

        const applyStroke = (targetUV: THREE.Vector2, targetPos: THREE.Vector3 | null) => {
            // Inject World Position for Projection Painting
            const strokeBrush = { ...dynamicBrush };
            if (strokeBrush.projectionMode && targetPos) {
                strokeBrush.worldPos = targetPos;
            }

            if (activeModsRef.current.particulate) {
                const particleCount = Math.floor(10 * pressure);
                for (let i = 0; i < particleCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * 0.05 * pressure;
                    const scatterUV = targetUV.clone().add(new THREE.Vector2(Math.cos(angle) * dist, Math.sin(angle) * dist));
                    scatterUV.x = Math.max(0, Math.min(1, scatterUV.x)); scatterUV.y = Math.max(0, Math.min(1, scatterUV.y));
                    const scatterBrush = { ...strokeBrush, flow: strokeBrush.flow * 0.2, size: strokeBrush.size * 0.5 };
                    r.paintEngine.paint(scatterUV, scatterBrush, layer, channelsRef.current, r.targetMeshes[0], r.loadedTextures);
                }
            } else {
                r.paintEngine.paint(targetUV, strokeBrush, layer, channelsRef.current, r.targetMeshes[0], r.loadedTextures);
            }
        };

        if (!r.paintEngine || !layer) return;

        const curBrush = brushRef.current;

        // --- INK BRUSH LOGIC (2D Only for MVP) ---
        if (curBrush.type === 'INK' && viewMode === '2D') {
            // 1. Accumulate Points [x, y, pressure]
            // UV is 0-1.
            inkPointsRef.current.push([uv.x, uv.y, pressure]);

            // 2. Generate Live Geometry
            // Scale size relative to 2048 texture (freehand defaults to ~10px usually)
            // If brush.size is 50, we want 50/2048 in UV space.
            const normalizedSize = curBrush.size / 2048;

            const geo = InkSystem.generateStrokeGeometry(inkPointsRef.current, {
                size: normalizedSize,
                thinning: 0.7,
                smoothing: 0.5,
                streamline: 0.6,
                simulatePressure: true
            });

            if (geo) {
                if (!inkMeshRef.current) {
                    const mat = new THREE.MeshBasicMaterial({ color: curBrush.color, depthTest: false, transparent: true, opacity: 0.8 });
                    const m = new THREE.Mesh(geo, mat);
                    m.position.z = 0.001; // Overlay
                    r.scene2D?.add(m);
                    inkMeshRef.current = m;
                } else {
                    inkMeshRef.current.geometry.dispose();
                    inkMeshRef.current.geometry = geo;
                }
                r.needsUpdate = true;
            }
            return; // Skip standard paint
        }

        // --- STANDARD PAINT LOGIC ---
        // --- SYMMETRY LOGIC ---
        // 1. Get Mesh and Transform Cursor to Local Space
        const mesh = r.targetMeshes[0];
        if (!mesh || !mesh.geometry.boundsTree) {
            // Fallback if no mesh/bvh: just paint at cursor
            applyStroke(uv, r.cursorMesh ? r.cursorMesh.position : null);
            r.needsUpdate = true;
            return;
        }

        const worldCursor = r.cursorMesh ? r.cursorMesh.position.clone() : new THREE.Vector3();
        // Convert to Local Space for Symmetry Math
        const localCursor = worldCursor.clone();
        mesh.worldToLocal(localCursor);

        const localPositions: THREE.Vector3[] = [localCursor];

        // 2. Generate Target Positions (In Local Space)
        // X Symmetry
        if (symmetry.x) {
            const count = localPositions.length;
            for (let i = 0; i < count; i++) {
                const p = localPositions[i].clone(); p.x *= -1; localPositions.push(p);
            }
        }
        // Y Symmetry
        if (symmetry.y) {
            const count = localPositions.length;
            for (let i = 0; i < count; i++) {
                const p = localPositions[i].clone(); p.y *= -1; localPositions.push(p);
            }
        }
        // Z Symmetry
        if (symmetry.z) {
            const count = localPositions.length;
            for (let i = 0; i < count; i++) {
                const p = localPositions[i].clone(); p.z *= -1; localPositions.push(p);
            }
        }
        // Radial Symmetry (Around Y Axis)
        if (symmetry.radial && symmetry.radialCount > 1) {
            const basePositions = [...localPositions];
            localPositions.length = 0; // Clear and rebuild
            const step = (Math.PI * 2) / symmetry.radialCount;

            basePositions.forEach(base => {
                // Convert to polar
                const radius = Math.sqrt(base.x * base.x + base.z * base.z);
                const angle = Math.atan2(base.z, base.x);

                for (let i = 0; i < symmetry.radialCount; i++) {
                    const theta = angle + step * i;
                    const rx = Math.cos(theta) * radius;
                    const rz = Math.sin(theta) * radius;
                    localPositions.push(new THREE.Vector3(rx, base.y, rz));
                }
            });
        }

        // 3. Resolve UVs for each Position (using BVH in Local Space of EACH mesh)
        // Optimization: Support Multi-Mesh Objects (e.g. Head + Body separate meshes)

        localPositions.forEach((posCandidate, idx) => {
            // For the primary stroke (idx 0), we already have the UV from input.
            // But we need to handle mirrored strokes.
            // AND we need to know WHICH mesh the mirrored stroke lands on.
            // The localPosition 'posCandidate' is in the Local Space of 'r.targetMeshes[0]' (the reference).
            // If meshes share the same parent/transform, this is valid for all.
            // If not, we need to be careful. ('KippIO.normalize' usually puts them under one parent).
            // Let's assume shared space or World Space logic.

            // Actually, 'localPositions' were calculated relative to meshes[0].
            // Let's convert back to WORLD for the search, to be safe across multiple meshes.
            const worldProbe = posCandidate.clone();
            mesh.localToWorld(worldProbe);

            if (idx === 0) {
                applyStroke(uv, worldProbe);
                return;
            }

            // Search all meshes for the closest point
            let bestHit: { distance: number, uv: THREE.Vector2, point: THREE.Vector3, mesh: THREE.Mesh } | null = null;

            for (const m of r.targetMeshes) {
                if (!m.geometry.boundsTree) continue;

                // Convert World Probe to this Mesh's Local Space
                const localProbe = worldProbe.clone();
                m.worldToLocal(localProbe);

                const target = m.geometry.boundsTree.closestPointToPoint(localProbe, m, 'point', 'uv');
                if (target) {
                    const worldHit = target.point.clone();
                    m.localToWorld(worldHit);
                    const dist = worldHit.distanceTo(worldProbe);

                    if (dist < 0.5) { // Tolerance
                        if (!bestHit || dist < bestHit.distance) {
                            bestHit = { distance: dist, uv: target.uv, point: worldHit, mesh: m };
                        }
                    }
                }
            }

            if (bestHit) {
                // Found a valid surface execution point!
                applyStroke(bestHit.uv, bestHit.point);
            }
        });

        // Debug Status for Symmetry
        if (symmetry.x || symmetry.y || symmetry.z || (symmetry.radial && symmetry.radialCount > 1)) {
            // Optional: Uncomment for debug
            // setStatus(`SYM: ${localPositions.length} strokes. BVH: OK`);
        }

        r.needsUpdate = true;
    }, [handlePickColor, symmetry, viewMode]);

    const { handlePointerDown, handlePointerMove, handlePointerUp } = usePaintInput(canvasRef, engine, brushRef);

    const onCanvasPointerUp = (e: any) => {
        handlePointerUp(e); // Base reset

        // Commit Ink Stroke
        const r = engine.current;
        if (brushRef.current.type === 'INK' && inkMeshRef.current) {
            const activeSet = r.textureSetData[activeSetIdRef.current || ''];
            const activeLId = activeLayerIdRef.current;
            const layer = activeSet?.layers.find((l: any) => l.id === activeLId);

            if (layer && r.paintEngine) {
                r.paintEngine.drawGeometry(inkMeshRef.current.geometry, layer, brushRef.current);
            }

            // Cleanup
            if (r.scene2D) r.scene2D.remove(inkMeshRef.current);
            inkMeshRef.current.geometry.dispose();
            (inkMeshRef.current.material as THREE.Material).dispose();
            inkMeshRef.current = null;
            inkPointsRef.current = [];
            r.needsUpdate = true;
        } else {
            // Reset points anyway
            inkPointsRef.current = [];
            if (inkMeshRef.current && r.scene2D) {
                r.scene2D.remove(inkMeshRef.current);
                inkMeshRef.current = null;
            }
        }
    }

    const onPointerDown = (e: any) => {
        engine.current.lastPaintPos = null;
        inkPointsRef.current = []; // Clear ink
        if (e.button === 0 && !e.altKey && !e.ctrlKey && !brushRef.current.isPicking) {
            recordHistory();
        }
        handlePointerDown(e, paint);
    };

    useEffect(() => {
        if (activeMaterial) {
            setStatus(`LOADING BRUSH MAT: ${activeMaterial.name}`);
            const loader = new THREE.TextureLoader();
            const load = (url: string) => new Promise<THREE.Texture | null>(r => { if (!url) r(null); else loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; r(t); }); });
            Promise.all([
                load(activeMaterial.base), load(activeMaterial.normal), load(activeMaterial.roughness), load(activeMaterial.metallic), load(activeMaterial.emissive)
            ]).then(([alb, nrm, rgh, met, ems]) => {
                if (nrm) nrm.colorSpace = THREE.LinearSRGBColorSpace;
                if (rgh) rgh.colorSpace = THREE.LinearSRGBColorSpace;
                if (met) met.colorSpace = THREE.LinearSRGBColorSpace;
                engine.current.loadedTextures = { albedo: alb, normal: nrm, roughness: rgh, metalness: met, emission: ems };
                setStatus("BRUSH MATERIAL READY");
            });
        } else { engine.current.loadedTextures = null; }
    }, [activeMaterial]);

    const handleGenerateAlpha = async () => {
        if (!alphaPrompt) return;
        setIsGeneratingAlpha(true); setStatus("FORGING ALPHA MASK...");
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instances: [{ prompt: `white organic brush alpha mask on black background, high contrast, ${alphaPrompt}, 2d texture, flat` }], parameters: { sampleCount: 1, aspectRatio: "1:1" } })
            });
            const data = await res.json();
            if (data.predictions?.[0]?.bytesBase64Encoded) {
                const b64 = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
                const tex = new THREE.TextureLoader().load(b64);
                if (onAlphaCommit) { onAlphaCommit({ name: alphaPrompt, url: b64 }); }
                setBrush(prev => ({ ...prev, alphaMap: tex })); setStatus("ALPHA FORGED");
            } else { setStatus("GENERATION FAILED"); }
        } catch (e) { console.error(e); setStatus("API ERROR"); } finally { setIsGeneratingAlpha(false); }
    };

    const handleImportAlpha = (e: any) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            const tex = new THREE.TextureLoader().load(url);
            if (onAlphaCommit) { onAlphaCommit({ name: file.name, url: url }); }
            setBrush(prev => ({ ...prev, alphaMap: tex }));
        }
    };

    const handleClearMask = () => {
        const r = engine.current;
        if (r.paintEngine && r.paintEngine.maskSystem) {
            r.paintEngine.maskSystem.clear();
            setStatus("MASK CLEARED");
        }
    };

    useEffect(() => {
        if (!initialData || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const w = canvas.clientWidth; const h = canvas.clientHeight;
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * (performance?.resolution || 1));
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.autoClear = false;

        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050505);
        // Dim default environment
        scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; // Start dim (will be managed by lighting effect)

        // --- KAUTOPBR-STYLE 3-POINT LIGHTING RIG (The Sexy One) ---
        // 1. Ambient (Subtle Base)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);

        // 2. Key Light (Main Directional - NOT TOO BRIGHT!)
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(5, 8, 5);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.bias = -0.0001;
        scene.add(keyLight);

        // 3. Rim Light (Blue Edge Pop - Makes Materials Look Premium!)
        const rimLight = new THREE.PointLight(0x3b82f6, 1.5, 20);
        rimLight.position.set(-5, 2, -5);
        scene.add(rimLight);

        // 4. Fill Light (Purple Warmth From Below)
        const fillLight = new THREE.PointLight(0xa855f7, 0.3);
        fillLight.position.set(0, -5, 0);
        scene.add(fillLight);

        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100); camera.position.set(3, 3, 3);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;
        controls.enableRotate = true; controls.enableZoom = true; controls.enablePan = true;
        controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        controls.enabled = false; // Start disabled (enabled by Alt key or Navigate tool)
        const disconnectZenViewport = connectViewport({
            element: canvasRef.current,
            scene,
            camera,
            controls,
            renderer
        });

        // --- 2D SCENE SETUP ---
        const scene2D = new THREE.Scene();
        scene2D.background = null; // Transparent background
        // Ortho camera 0..1 in both axes
        const camera2D = new THREE.OrthographicCamera(0, 1, 1, 0, 0, 10);
        camera2D.position.z = 1;

        // 2D Texture Display Quad (shows the actual painted texture)
        const mesh2D = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 1.0 })
        );
        mesh2D.position.set(0.5, 0.5, 0);
        scene2D.add(mesh2D);

        // UV Wireframe (will show ALL selected texture sets)
        const wireMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, depthTest: false, transparent: true, opacity: 0.8 });
        const wireframe2D = new THREE.LineSegments(new THREE.BufferGeometry(), wireMat);
        scene2D.add(wireframe2D);

        // ... (rest of setup)

        scene.add(new THREE.DirectionalLight(0xffffff, 2), new THREE.AmbientLight(0xffffff, 0.5));

        const paintEngine = new PaintEngine(renderer);
        // ... (mesh setup)
        const { object, meshes } = initialData;
        scene.add(object);

        // --- TEXTURE SET SETUP ---
        const setsData: Record<string, any> = {};
        const setsList: { id: string, name: string }[] = [];
        let firstSetId: string | null = null;
        let firstSet: any = null;

        // Group meshes by material
        const buckets: Record<string, THREE.Mesh[]> = {};
        meshes.forEach(m => {
            const mat = m.material as THREE.MeshStandardMaterial;
            const id = mat.name || m.name || 'default';
            if (!buckets[id]) buckets[id] = [];
            buckets[id].push(m);
        });

        Object.keys(buckets).forEach((id, idx) => {
            const ms = buckets[id];
            // Create layers
            const comp = new PaintLayer(id + '_comp', 'Composite', TEXTURE_SIZE, TEXTURE_SIZE); // Composite
            const base = new PaintLayer(id + '_base', 'Base Layer', TEXTURE_SIZE, TEXTURE_SIZE);

            // Fill Base Layer with defaults FIRST
            paintEngine.fillLayer(base, {
                albedo: [0.7, 0.7, 0.7, 1.0],
                normal: [0.5, 0.5, 1.0, 1.0],
                roughness: [0.5, 0.5, 0.5, 1.0],
                metalness: [0.0, 0.0, 0.0, 1.0],
                emission: [0.0, 0.0, 0.0, 1.0]
            });

            // Check for existing material textures and OVERWRITE defaults
            const material = ms[0].material as THREE.MeshStandardMaterial;
            const hasTexture = material.map || material.normalMap || material.roughnessMap || material.metalnessMap || material.emissiveMap;

            if (hasTexture) {
                // Helper to blit texture over default (use local renderer, not engine.current)
                const blitTex = (tex: THREE.Texture | null, channel: string) => {
                    if (tex && renderer) {
                        const quadScene = new THREE.Scene();
                        const quad = new THREE.Mesh(
                            new THREE.PlaneGeometry(2, 2),
                            new THREE.MeshBasicMaterial({ map: tex })
                        );
                        quadScene.add(quad);
                        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

                        const target = base.getWrite(channel);
                        const oldTarget = renderer.getRenderTarget();
                        renderer.setRenderTarget(target);
                        renderer.clear();
                        renderer.render(quadScene, cam);
                        renderer.setRenderTarget(oldTarget);
                        base.swap(channel);

                        quad.geometry.dispose();
                        (quad.material as THREE.Material).dispose();
                    }
                };

                blitTex(material.map, 'albedo');
                blitTex(material.normalMap, 'normal');
                blitTex(material.roughnessMap, 'roughness');
                blitTex(material.metalnessMap, 'metalness');
                blitTex(material.emissiveMap, 'emission');
            }

            const layers = [base];

            const set = {
                id, name: id, meshes: ms, layers, compositeLayer: comp,
                uiLayers: [{ id: base.id, name: 'Base Layer', visible: true }],
                activeLayerId: base.id
            };

            // *** CRITICAL: Compose base layer into composite layer ***
            paintEngine.compose(layers, comp);

            // *** CRITICAL: Bind mesh materials to composite layer textures ***
            ms.forEach((m: THREE.Mesh) => {
                const mat = m.material as THREE.MeshStandardMaterial;
                mat.map = comp.getRead('albedo').texture;
                mat.normalMap = comp.getRead('normal').texture;
                mat.roughnessMap = comp.getRead('roughness').texture;
                mat.metalnessMap = comp.getRead('metalness').texture;
                mat.emissiveMap = comp.getRead('emission').texture;
                mat.emissive = new THREE.Color(1, 1, 1); // Enable emission
                mat.needsUpdate = true;
            });

            setsData[id] = set;
            setsList.push({ id, name: id });

            if (idx === 0) {
                firstSetId = id;
                firstSet = set;
            }
        });

        engine.current.textureSetData = setsData;

        // Generate UV Wireframe from first mesh (Assumption: sharing UV space or using first valid)
        // Update UV wireframe for 2D mode - Show ALL selected texture sets
        const loadedMeshes = firstSet ? firstSet.meshes : [];
        if (loadedMeshes.length > 0) {
            const segments: number[] = [];

            // Iterate through ALL loaded meshes (all selected texture sets)
            loadedMeshes.forEach((mesh: THREE.Mesh) => {
                const geo = mesh.geometry;
                const uv = geo.attributes.uv;
                if (!uv || !geo.index) return;

                const idx = geo.index;
                for (let i = 0; i < idx.count; i += 3) {
                    const a = idx.getX(i);
                    const b = idx.getX(i + 1);
                    const c = idx.getX(i + 2);
                    const u1 = new THREE.Vector2(uv.getX(a), uv.getY(a));
                    const u2 = new THREE.Vector2(uv.getX(b), uv.getY(b));
                    const u3 = new THREE.Vector2(uv.getX(c), uv.getY(c));

                    // Add triangle edges
                    segments.push(u1.x, u1.y, 0, u2.x, u2.y, 0);
                    segments.push(u2.x, u2.y, 0, u3.x, u3.y, 0);
                    segments.push(u3.x, u3.y, 0, u1.x, u1.y, 0);
                }
            });

            if (segments.length > 0) {
                const wireGeo = new THREE.BufferGeometry();
                wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
                wireframe2D.geometry = wireGeo;
            }
        }

        // ...

        const raycaster = new THREE.Raycaster();
        // Cursor Mesh
        const cursorMesh = new THREE.Mesh(
            new THREE.RingGeometry(0.02, 0.025, 32),
            new THREE.MeshBasicMaterial({ color: 0x3daee9, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthTest: false })
        );
        cursorMesh.visible = false;
        scene.add(cursorMesh);

        engine.current = {
            scene, camera, renderer, controls, paintEngine,
            ambientLight, keyLight, rimLight, fillLight, // 3-point lighting rig
            scene2D, camera2D, mesh2D, wireframe2D,
            targetMeshes: firstSet ? firstSet.meshes : [],
            raycaster, cursorMesh,
            initialized: true, textureSetData: setsData, loadedTextures: null,
            canvas: canvas, lastPaintPos: null,
            // Sync initial state
            viewMode: viewMode // Using state directly here as it's inside effect
        };

        // scene.add(engine.current.cursorMesh); // Already added above

        setTextureSets(setsList);
        setActiveSetId(firstSetId);
        setLayers(firstSet.uiLayers);
        setActiveLayerId(firstSet.activeLayerId);
        setStatus("READY");

        // --- RUST RAYCAST REGISTRATION ---
        // Register all meshes with Rust BVH for high-performance raycasting
        const targetMeshesForRust = firstSet ? firstSet.meshes : [];
        targetMeshesForRust.forEach(async (mesh: THREE.Mesh) => {
            const handle = await rustRaycastUVManager.registerMesh(mesh);
            if (handle) {
                console.log(`[KPainter] Registered mesh ${mesh.name || mesh.uuid} with Rust raycast (handle: ${handle})`);
            }
        });

        // Store reference to raycast manager on engine for use in paint loop
        engine.current.rustRaycastManager = rustRaycastUVManager;

        const animate = () => {
            requestAnimationFrame(animate);
            const r = engine.current;
            const activeSet = r.textureSetData[activeSetIdRef.current || ''];
            const bh = blackHoleRef.current;
            const is2D = viewModeRef.current === '2D';

            if (activeSet) {
                // Update 2D Mesh Texture if in 2D mode
                if (is2D && r.mesh2D) {
                    // Show the currently selected channel or Albedo if pure material mode
                    // For simplicity, let's show the Composite Albedo for now, or the View Channel
                    // Ideally we mirror the viewChannel logic
                    const map = viewChannel === 'MATERIAL' || viewChannel === 'BASE'
                        ? activeSet.compositeLayer.getRead('albedo').texture
                        : viewChannel === 'NORMAL' ? activeSet.compositeLayer.getRead('normal').texture
                            : viewChannel === 'ROUGHNESS' ? activeSet.compositeLayer.getRead('roughness').texture
                                : viewChannel === 'METALNESS' ? activeSet.compositeLayer.getRead('metalness').texture
                                    : viewChannel === 'EMISSION' ? activeSet.compositeLayer.getRead('emission').texture
                                        : activeSet.compositeLayer.getRead('albedo').texture;

                    if (r.mesh2D.material.map !== map) {
                        r.mesh2D.material.map = map;
                        r.mesh2D.material.needsUpdate = true;
                    }
                }

                const activeLId = activeLayerIdRef.current;
                const layer = activeSet.layers.find((l: any) => l.id === activeLId);
                const mods = activeModsRef.current;
                const params = modParamsRef.current;

                if (layer) {
                    let needsUpdate = false;

                    // --- KERR BLACK HOLE EVENT ---
                    if (bh.active) {
                        const center = r.lastPaintPos || new THREE.Vector2(0.5, 0.5);
                        r.paintEngine.stepBlackHole(layer, center, bh);

                        // If Infinite Stability is ON, force dissipation to 1.0 (no fade)
                        // Otherwise default to 0.998
                        const dissipation = bh.infinite ? 1.0 : 0.998;

                        // Force fluid advection for all channels to mix materials
                        r.paintEngine.stepFluid(layer, ['albedo', 'roughness', 'metalness', 'emission', 'normal'], dissipation);
                        needsUpdate = true;

                        // --- RUST SPH BLACK HOLE (Kerr Frame-Dragging) ---
                        if (rustFluidRef.current && fluidActiveRef.current) {
                            const uvCenter = r.lastPaintPos || new THREE.Vector2(0.5, 0.5);
                            rustFluidRef.current.applyBlackHole(
                                [uvCenter.x, uvCenter.y],
                                bh.strength * 0.1,
                                bh.spin * 0.1,
                                bh.radius
                            );
                        }
                    }

                    // ====================================================================
                    // OPTIMIZED EFFECTS - GPU fluid sim + throttled processing
                    // Effects run every Nth frame for performance, rendering stays 60fps
                    // ====================================================================
                    const ALL_CHANNELS = ['albedo', 'normal', 'roughness', 'metalness', 'emission'];
                    const hasFluidMod = mods.hydro || mods.vortex || mods.drip || mods.flow || mods.particulate;
                    const hasAnyEffect = hasFluidMod || mods.reaction || mods.ferro || mods.quantum || mods.chronos || mods.growth;

                    // --- EFFECT THROTTLING: Skip expensive effects every Nth frame ---
                    effectFrameRef.current = (effectFrameRef.current + 1) % EFFECT_THROTTLE_FRAMES;
                    const shouldProcessEffects = effectFrameRef.current === 0 || !hasAnyEffect;

                    // Use GPU-based fluid sim for ALL fluid effects (fast!)
                    // --- THROTTLED: Only process on Nth frames ---
                    if (hasFluidMod && shouldProcessEffects) {
                        // Apply forces via GPU splatVelocity (fast, no Rust IPC)
                        const lastUV = r.lastPaintPos || new THREE.Vector2(0.5, 0.5);
                        const brushSize = brushRef.current?.size || 50;

                        if (mods.hydro) {
                            // Motion-based velocity splat - scaled by speed
                            const speedScale = params.speed * 0.05; // Much slower default
                            const motion = new THREE.Vector2(speedScale, -speedScale);
                            r.paintEngine.splatVelocity(layer, lastUV, motion, brushSize * params.intensity);
                        }

                        if (mods.vortex) {
                            // Create swirl by splatting perpendicular velocity
                            const t = performance.now() * 0.001 * params.speed;
                            const vx = Math.cos(t) * params.speed * 0.15;
                            const vy = Math.sin(t) * params.speed * 0.15;
                            r.paintEngine.splatVelocity(layer, lastUV, new THREE.Vector2(vx, vy), brushSize * params.intensity);
                        }

                        if (mods.drip) {
                            // Downward velocity - much slower
                            r.paintEngine.splatVelocity(layer, lastUV, new THREE.Vector2(0, params.speed * 0.05), brushSize * params.intensity);
                        }

                        if (mods.flow) {
                            // Horizontal rivulet with noise - slower
                            const n = Math.sin(performance.now() * 0.0005 * params.speed + lastUV.y * 10) * params.chaos;
                            r.paintEngine.splatVelocity(layer, lastUV, new THREE.Vector2(n * 0.05, params.speed * 0.03), brushSize * params.intensity);
                        }

                        if (mods.particulate) {
                            // Scatter splats - REDUCED from 3 to 1 for performance!
                            const ox = (Math.random() - 0.5) * 0.1 * params.chaos;
                            const oy = (Math.random() - 0.5) * 0.1 * params.chaos;
                            const splat = new THREE.Vector2(lastUV.x + ox, lastUV.y + oy);
                            r.paintEngine.splatVelocity(layer, splat, new THREE.Vector2(ox * params.speed, oy * params.speed), brushSize * 0.5 * params.intensity);
                        }

                        // GPU fluid step with ALL channels
                        r.paintEngine.stepFluid(layer, ALL_CHANNELS, 0.995);
                        needsUpdate = true;
                    }

                    // GPU-only effects - now also affect all channels
                    // --- THROTTLED: Only process on Nth frames ---
                    if (shouldProcessEffects) {
                        if (mods.reaction) {
                            r.paintEngine.stepReaction(layer);
                            r.paintEngine.stepFluid(layer, ALL_CHANNELS, 0.999);
                            needsUpdate = true;
                        }
                        if (mods.ferro) {
                            r.paintEngine.stepFerro(layer);
                            r.paintEngine.stepFluid(layer, ALL_CHANNELS, 0.999);
                            needsUpdate = true;
                        }
                        if (mods.quantum) {
                            r.paintEngine.stepQuantum(layer);
                            r.paintEngine.stepFluid(layer, ALL_CHANNELS, 0.999);
                            needsUpdate = true;
                        }
                        if (mods.chronos) {
                            r.paintEngine.stepChronos(layer);
                            needsUpdate = true;
                        }
                        if (mods.growth) {
                            r.paintEngine.stepGrowth(layer, params);
                            r.paintEngine.stepFluid(layer, ALL_CHANNELS, 0.999);
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) r.needsUpdate = true;
                }

                if (r.needsUpdate) {
                    r.paintEngine.compose(activeSet.layers, activeSet.compositeLayer);
                    r.needsUpdate = false;
                }
            }

            // INPUT HANDLING: Force controls disabled unless specific conditions met
            // This prevents orbit controls from stealing input during painting
            if (r.controls) {
                // If 2D mode, controls might be used for pan/zoom of canvas? 
                // Currently 2D is static ortho, so no controls needed there really.
                // WE ONLY ENABLE CONTROLS IF:
                // 1. viewMode is 3D AND
                // 2. Alt key is held (handled by internal useInput logic calling NAVIGATE) OR
                // 3. User is explicitly in NAVIGATE tool

                // However, OrbitControls.update() must be called if damping is on.
                // But controls.enabled should be false by default.

                // We rely on usePaintInput / useInput to flip 'enabled' to true when needed.
                // So here we just update.
                r.controls.update();

                // Safety: If not navigating, ensure disabled?
                // Actually, useInput 'onActionUp' disables it. 
                // But if we start with it enabled, it's bad.
                // Let's rely on the initial state being correct, or forced here if no action is active.
                // But 'action' state is inside useInput/usePaintInput closures.
            }

            renderer.clear();
            renderer.clear();
            // Always render 3D Scene (Hologram Mode for UV View)
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!canvas) return;
            const nw = canvas.clientWidth; const nh = canvas.clientHeight;
            camera.aspect = nw / nh; camera.updateProjectionMatrix();
            renderer.setSize(nw, nh, false);

            // Resize logic for 2D Camera? 
            // It's 0-1 so we just want to fit it on screen. 
            // Ideally we want to center the square UV map in the aspect ratio
            if (engine.current.camera2D) {
                const aspect = nw / nh;
                const cam = engine.current.camera2D;
                // Basic check to keep 1:1 square centered
                if (aspect > 1) {
                    // Wider than tall
                    cam.left = (1 - aspect) / 2;
                    cam.right = (1 + aspect) / 2;
                    cam.top = 1;
                    cam.bottom = 0;
                } else {
                    // Taller than wide
                    cam.left = 0;
                    cam.right = 1;
                    cam.top = (1 + (1 / aspect)) / 2;
                    cam.bottom = (1 - (1 / aspect)) / 2;
                }
                cam.updateProjectionMatrix();
            }
        };
        window.addEventListener('resize', handleResize);
        // Trigger initial resize to set 2D cam correctly
        handleResize();

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', (e) => handlePointerMove(e, paint));
        canvas.addEventListener('pointerup', onCanvasPointerUp);
        canvas.addEventListener('pointerleave', onCanvasPointerUp);
        return () => {
            disconnectZenViewport();
            window.removeEventListener('resize', handleResize);
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
            renderer.dispose();
            Object.values(setsData).forEach((s: any) => { s.layers.forEach((l: any) => l.dispose()); s.compositeLayer.dispose(); });
            paintEngine.dispose();
        };
    }, [connectViewport, initialData, performance?.resolution]);

    const switchTextureSet = (setId: string) => {
        const r = engine.current;
        if (!r.textureSetData || !r.textureSetData[setId]) return;
        if (activeSetId && r.textureSetData[activeSetId]) {
            r.textureSetData[activeSetId].uiLayers = layers;
            r.textureSetData[activeSetId].activeLayerId = activeLayerId;
        }
        const newSet = r.textureSetData[setId];
        setActiveSetId(setId);
        setLayers(newSet.uiLayers);
        setActiveLayerId(newSet.activeLayerId);
        r.targetMeshes = newSet.meshes;
    };

    const addLayer = () => {
        if (!activeSetId) return;
        const r = engine.current;
        const set = r.textureSetData[activeSetId];
        const id = 'layer_' + Date.now();
        const name = 'Layer ' + (set.layers.length + 1);
        const newLayer = new PaintLayer(id, name, TEXTURE_SIZE, TEXTURE_SIZE);
        r.paintEngine.clearLayer(newLayer);
        set.layers.push(newLayer);
        const newUiLayers = [...layers, { id, name, visible: true }];
        setLayers(newUiLayers);
        setActiveLayerId(id);
        r.paintEngine.compose(set.layers, set.compositeLayer);
    };

    const handleFillLayer = () => {
        if (!activeSetId || !activeLayerId) return;
        const r = engine.current;
        const set = r.textureSetData[activeSetId];
        const layer = set.layers.find((l: any) => l.id === activeLayerId);
        if (!layer) return;
        recordHistory();
        r.paintEngine.fillLayerWithTextures(layer, r.loadedTextures, brush.color);
        r.paintEngine.compose(set.layers, set.compositeLayer);
        setStatus("LAYER FILLED");
    };

    const deleteLayer = (id: string) => {
        if (layers.length <= 1 || !activeSetId) return;
        const r = engine.current;
        const set = r.textureSetData[activeSetId];
        const idx = set.layers.findIndex((l: any) => l.id === id);
        if (idx > -1) {
            const l = set.layers[idx]; l.dispose();
            set.layers.splice(idx, 1);
            const newUiLayers = layers.filter(ui => ui.id !== id);
            setLayers(newUiLayers);
            if (activeLayerId === id) setActiveLayerId(newUiLayers[newUiLayers.length - 1].id);
            r.paintEngine.compose(set.layers, set.compositeLayer);
        }
    };

    const toggleLayer = (id: string) => {
        if (!activeSetId) return;
        const r = engine.current;
        const set = r.textureSetData[activeSetId];
        const layer = set.layers.find((l: any) => l.id === id);
        if (layer) {
            layer.visible = !layer.visible;
            setLayers(prev => prev.map(ui => ui.id === id ? { ...ui, visible: layer.visible } : ui));
            r.paintEngine.compose(set.layers, set.compositeLayer);
        }
    };

    const handleExport = async () => {
        const { scene, renderer, textureSetData, paintEngine } = engine.current;
        if (!scene || !paintEngine) return;
        setStatus("BAKING FINAL ASSETS...");
        const exportTarget = new THREE.WebGLRenderTarget(TEXTURE_SIZE, TEXTURE_SIZE, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
        const exporter = new GLTFExporter();
        const bakeTexture = (sourceRt: THREE.WebGLRenderTarget, name: string) => {
            paintEngine.copyTo(sourceRt, exportTarget);
            const w = TEXTURE_SIZE; const h = TEXTURE_SIZE;
            const buffer = new Uint8Array(w * h * 4);
            renderer.readRenderTargetPixels(exportTarget, 0, 0, w, h, buffer);
            const flippedBuffer = new Uint8Array(w * h * 4);
            const rowBytes = w * 4;
            for (let y = 0; y < h; y++) {
                const srcRowStart = y * rowBytes;
                const destRowStart = (h - 1 - y) * rowBytes;
                flippedBuffer.set(buffer.subarray(srcRowStart, srcRowStart + rowBytes), destRowStart);
            }
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const ctx = c.getContext('2d'); if (!ctx) return null;
            const idata = ctx.createImageData(w, h); idata.data.set(flippedBuffer); ctx.putImageData(idata, 0, 0);
            const tex = new THREE.CanvasTexture(c);
            tex.colorSpace = (name === 'baseColor' || name === 'emission') ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            tex.flipY = false; tex.name = name; tex.needsUpdate = true;
            return tex;
        };
        const exportScene = new THREE.Scene();
        Object.values(textureSetData).forEach((set: any) => {
            const bakedMaps = {
                map: bakeTexture(set.compositeLayer.getRead('albedo'), 'baseColor'),
                normalMap: bakeTexture(set.compositeLayer.getRead('normal'), 'normal'),
                roughnessMap: bakeTexture(set.compositeLayer.getRead('roughness'), 'roughness'),
                metalnessMap: bakeTexture(set.compositeLayer.getRead('metalness'), 'metallic'),
                emissiveMap: bakeTexture(set.compositeLayer.getRead('emission'), 'emission'),
            };
            const mat = new THREE.MeshStandardMaterial({ ...bakedMaps, color: 0xffffff, roughness: 1.0, metalness: 1.0, emissive: 0xffffff });
            mat.name = set.name;
            set.meshes.forEach((m: THREE.Mesh) => { const clone = m.clone(); clone.geometry = m.geometry.clone(); clone.material = mat; exportScene.add(clone); });
        });
        exportTarget.dispose();
        exporter.parse(exportScene, (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            if (onCommit) onCommit(blob, "K-PAINTER_ASSET");
            setStatus("EXPORT COMPLETE");
        }, (err) => { console.error(err); setStatus("EXPORT FAILED"); }, { binary: true, embedImages: true });
    };

    const handlePrimitive = (type: string) => {
        const data = KippIO.getPrimitive(type);
        setInitialData(data);
        setMode('PAINT');
        setStatus("PRIMITIVE LOADED");
    };

    const resolveActiveArtifactSource = useCallback(() => {
        const activeArtifactId = sharedState?.activeArtifactId ?? null;
        const storageItem = sharedState?.storage?.find((item: any) => item.id === activeArtifactId && item?.blob) ?? null;

        if (storageItem) {
            return {
                blob: storageItem.blob,
                name: storageItem.name ?? `artifact_${activeArtifactId}.glb`
            };
        }

        if (sharedState?.artifact) {
            return {
                blob: sharedState.artifact,
                name: `artifact_${activeArtifactId ?? 'active'}.glb`
            };
        }

        return null;
    }, [sharedState?.activeArtifactId, sharedState?.artifact, sharedState?.storage]);

    const loadPainterScene = useCallback(async (
        blob: Blob,
        statusLabel: string
    ) => {
        const url = URL.createObjectURL(blob);
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(url);
            const data = KippIO.normalize(gltf.scene);
            setInitialData(data);
            setMode('PAINT');
            setStatus(statusLabel);
        } catch (e) {
            console.error(e);
            setStatus("LOAD FAILED");
        } finally {
            URL.revokeObjectURL(url);
        }
    }, []);

    const handleArtifact = useCallback(async () => {
        const source = resolveActiveArtifactSource();
        if (!source?.blob) return;

        setStatus(`LOADING ${source.name}...`);
        await loadPainterScene(source.blob, "ARTIFACT MOUNTED");
    }, [loadPainterScene, resolveActiveArtifactSource]);

    useEffect(() => {
        if (mode !== 'STARTUP') return;
        const source = resolveActiveArtifactSource();
        if (!source?.blob) return;
        void handleArtifact();
    }, [handleArtifact, mode, resolveActiveArtifactSource]);

    const loadFromStorage = useCallback(async (item: any) => {
        if (!item?.blob) return;
        setStatus(`LOADING ${item.name}...`);
        await loadPainterScene(item.blob, `LOADED: ${item.name}`);
    }, [loadPainterScene]);



    // --- EFFECT: PERFORMANCE MODE ---
    useEffect(() => {
        const r = engine.current;
        if (!r.scene || !r.renderer) return;

        if (performanceMode) {
            r.scene.environment = null; // Kill IBL
            r.renderer.setPixelRatio(1); // Force 1x pixel ratio
            r.targetMeshes.forEach((m: THREE.Mesh) => {
                m.castShadow = false; m.receiveShadow = false;
                if (m.material instanceof THREE.MeshStandardMaterial) {
                    m.material.envMapIntensity = 0.0; // Disable env reflections
                }
            });
            setStatus("PERFORMANCE MODE: ON");
        } else {
            // Restore High Quality
            const env = new THREE.PMREMGenerator(r.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
            r.scene.environment = env;
            r.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            r.targetMeshes.forEach((m: THREE.Mesh) => {
                m.castShadow = true; m.receiveShadow = true;
                if (m.material instanceof THREE.MeshStandardMaterial) {
                    m.material.envMapIntensity = 1.0;
                }
            });
            setStatus("PERFORMANCE MODE: OFF");
        }
    }, [performanceMode]);

    // --- CONTEXT PROVIDER VALUE ---
    const contextValue = {
        brush, setBrush, activeChannels, setActiveChannels,
        layers, activeLayerId,
        handleLayerAdd: addLayer, handleLayerDelete: deleteLayer,
        handleLayerToggle: toggleLayer, handleLayerSelect: setActiveLayerId,
        handleLayerFill: handleFillLayer,
        activeMaterial, setActiveMaterial, projectMaterials: sharedState?.materials || [],
        textureSets, activeSetId, handleSetSelect: switchTextureSet,
        handleExport, handleUndo: undo, handleRedo: redo,
        handleChangeMesh: () => setMode('STARTUP'),
        paint, recordHistory,
        status, viewChannel, setViewChannel,
        alphas: sharedState?.alphas || [], alphaPrompt, setAlphaPrompt,
        isGeneratingAlpha, handleGenerateAlpha, handleImportAlpha,
        handleClearMask,
        // KERR EVENT
        blackHole, setBlackHole,
        // BRUSH MODS
        activeMods, setActiveMods,
        // MOD PARAMETERS (Speed, Chaos, Intensity)
        modParams, setModParams,
        // PICKER
        handlePickColor,
        // PERFORMANCE
        performanceMode, setPerformanceMode,
        // VIEW MODE
        viewMode, setViewMode,
        // SYMMETRY
        symmetry, setSymmetry,
        // LIGHTING
        lighting, setLighting,
        // TEXTURES
        importedTextures, handleImportTexture, handleExportTextures
    };

    return (
        <PainterContext.Provider value={contextValue}>
            <div className={`h-full text-[#fcfcfc] font-sans flex flex-col overflow-hidden ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#111]'}`}>
                {mode === 'STARTUP' && !isViewportHost ? (
                    <div className={`flex-1 flex bg-[#0f0f0f] text-white min-w-0 min-h-0 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                        <div className="flex-1 relative flex flex-col items-center justify-center border-r border-[#222] bg-[#0a0a0a] overflow-y-auto p-8">
                            <div className="flex flex-col items-center gap-8 max-w-2xl w-full">
                                {/* MOUNT ARTIFACT SECTION */}
                                {sharedState?.artifact && (
                                    <div className="flex flex-col items-center">
                                        <button onClick={handleArtifact} className="group relative w-64 h-64 flex flex-col items-center justify-center bg-[#3daee9]/5 border border-[#3daee9]/30 rounded-2xl hover:bg-[#3daee9]/10 hover:border-[#3daee9] transition-all cursor-pointer shadow-[0_0_30px_rgba(61,174,233,0.1)] hover:shadow-[0_0_50px_rgba(61,174,233,0.2)]">
                                            <div className="absolute inset-0 bg-[#3daee9]/5 blur-3xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity animate-pulse"></div>
                                            <Hexagon size={64} className="text-[#3daee9] mb-6 drop-shadow-[0_0_10px_rgba(61,174,233,0.5)] group-hover:scale-110 transition-transform" />
                                            <div className="text-lg font-black text-white tracking-widest mb-1 z-10">MOUNT ARTIFACT</div>
                                            <div className="text-[10px] font-mono text-[#3daee9] tracking-widest z-10">FROM K-OS KERNEL</div>
                                        </button>
                                    </div>
                                )}

                                {/* KERNEL STORAGE SECTION */}
                                {sharedState?.storage && sharedState.storage.length > 0 && (
                                    <div className="w-full">
                                        <div className="text-[10px] font-bold text-orange-500 uppercase mb-4 flex items-center gap-2 tracking-widest justify-center">
                                            <HardDrive size={12} /> KERNEL STORAGE
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                                            {sharedState.storage.map((item: any) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => loadFromStorage(item)}
                                                    className="relative aspect-square rounded-lg border border-[#333] hover:border-orange-500 overflow-hidden transition-all group bg-[#111] hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]"
                                                >
                                                    {item.thumbnail ? (
                                                        <img src={item.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt={item.name} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Box size={20} className="text-gray-600 group-hover:text-orange-500 transition-colors" />
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[8px] text-center py-1 truncate px-1 text-gray-300 font-bold tracking-wide">
                                                        {item.name}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* EMPTY STATE */}
                                {!sharedState?.artifact && (!sharedState?.storage || sharedState.storage.length === 0) && (
                                    <div className="flex flex-col items-center p-12 rounded-2xl border-2 border-dashed border-[#333] opacity-50 animate-pulse">
                                        <Activity size={64} className="mb-6 text-gray-700" />
                                        <div className="text-sm font-black text-gray-300 uppercase tracking-[0.2em]">WAITING FOR KERNEL</div>
                                        <div className="mt-2 text-[10px] text-gray-600 font-mono text-center">Mount artifact from K-OS<br />or select a primitive</div>
                                    </div>
                                )}

                                {/* PRESERVE TEXTURES TOGGLE - shows if any option is available */}
                                {(sharedState?.artifact || (sharedState?.storage && sharedState.storage.length > 0)) && (
                                    <button
                                        onClick={() => setKeepMaterials(!keepMaterials)}
                                        className={"px-4 py-2 rounded border text-[9px] font-bold tracking-widest transition-all flex items-center justify-center gap-2 " + (keepMaterials ? "bg-[#3daee9]/20 border-[#3daee9] text-[#3daee9]" : "bg-[#111] border-[#333] text-gray-500")}
                                    >
                                        <ImageIcon size={12} /> {keepMaterials ? 'PRESERVE TEXTURES' : 'OVERWRITE MATERIALS'}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="w-[400px] flex flex-col p-8 bg-[#16181b] min-w-0 shadow-2xl z-10 justify-center">
                            <div className="mb-8 border-b border-[#333] pb-4">
                                <h1 className="text-3xl font-black tracking-tighter mb-1 text-white">K-PAINTER <span className="text-[#3daee9]">GPU</span></h1>
                                <p className="text-[10px] text-gray-500 font-mono">HIGH FIDELITY TEXTURING SUITE</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[{ id: 'sphere', label: 'SPHERE' }, { id: 'cube', label: 'CUBE' }, { id: 'plane', label: 'PLANE' }, { id: 'torus', label: 'TORUS' }, { id: 'cylinder', label: 'CYLINDER' }, { id: 'capsule', label: 'CAPSULE' }, { id: 'octahedron', label: 'OCTAHEDRON' }].map(p => (
                                    <button key={p.id} onClick={() => handlePrimitive(p.id)} className="aspect-square bg-[#0f0f0f] border border-[#222] hover:border-[#3daee9] hover:bg-[#3daee9]/10 rounded-xl flex flex-col items-center justify-center transition-all group">
                                        <Cuboid size={24} className="mb-2 text-gray-600 group-hover:text-[#3daee9] transition-colors" />
                                        <span className="text-[10px] font-bold tracking-widest text-gray-400 group-hover:text-white">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`flex flex-col h-full w-full ${isToolOverlay ? 'bg-transparent' : 'bg-[#111]'}`}>
                        <KPainterUI
                            canvasRef={canvasRef}
                            engineRef={engine}
                            zenShellMode={zenShellMode}
                        />
                    </div>
                )}
            </div>
        </PainterContext.Provider>
    );
}
