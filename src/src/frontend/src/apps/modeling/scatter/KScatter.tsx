
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Cpu, Package, Activity } from 'lucide-react';
import KScatterTopBar from './KScatterTopBar';
import KScatterLeftPanel from './KScatterLeftPanel';
import KScatterRightPanel from './KScatterRightPanel';
import * as ScatterClient from '../../../services/scatterClient';
import { useZenControlBindings, useZenModuleBridge, ZEN_VIEWPORT_OPERATOR_SESSION_KEY } from '../../../core/zen';


export default function KScatter({ sharedState, onCommit, zenShellMode = 'standalone' }: any) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge('scatter');
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const [status, setStatus] = useState("K-SCATTER ONLINE");
    const [activeTab, setActiveTab] = useState<'primitives' | 'storage'>('primitives');

    // Scatter Params
    const [objectCount, setObjectCount] = useState(100);
    const [scatterRadius, setScatterRadius] = useState(2.0);
    const [minScale, setMinScale] = useState(0.05);
    const [maxScale, setMaxScale] = useState(0.2);
    const [scatterMode, setScatterMode] = useState('CLOUD');
    const [weldGeometry, setWeldGeometry] = useState(false);
    const [autoRotate, setAutoRotate] = useState(false);
    const [distributionEnabled, setDistributionEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // K-SCRIPT
    const [userScript, setUserScript] = useState(`// Available: i (index), count, p (pos), r (rot), s (scale)
// Math is global. radius is available.

const t = (i / count) * Math.PI * 4;
const rad = 2 + Math.cos(t * 3) * 1.5;

p.x = Math.cos(t) * rad;
p.z = Math.sin(t) * rad;
p.y = i * 0.05 - 2;

r.y = t;
r.z = Math.sin(t * 2) * 0.5;

const scale = 0.1 + Math.abs(Math.sin(t * 5)) * 0.2;
s.setScalar(scale);`);
    const [scriptError, setScriptError] = useState<string | null>(null);

    // Sources
    const [activePrimitive, setActivePrimitive] = useState('CUBE');
    const [activeStorageId, setActiveStorageId] = useState<string | null>(null);

    // The Palette holds the mesh(es) we are scattering
    const paletteRef = useRef<any[]>([]);

    useEffect(() => {
        publishLayers([
            {
                id: 'scatter:placements',
                name: 'Scatter Placements',
                order: 0,
                tags: ['instances']
            }
        ]);
    }, [publishLayers]);

    useEffect(() => {
        publishState({
            status,
            objectCount,
            scatterMode,
            activePrimitive,
            [ZEN_VIEWPORT_OPERATOR_SESSION_KEY]: {
                moduleId: 'scatter',
                enabled: true,
                subjectAssetId: sharedState?.activeArtifactId ?? null,
                subjectEntityId: isToolOverlay ? sharedState?.activeEntityId ?? null : null,
                subjectLayerId: isToolOverlay
                    ? sharedState?.activeLayerId ?? null
                    : 'scatter:placements',
                materialId: sharedState?.activeMaterialId ?? null,
                sourceMode: activeStorageId ? 'storage' : 'primitive',
                primitive: activePrimitive,
                storageAssetId: activeStorageId,
                objectCount,
                scatterRadius,
                minScale,
                maxScale,
                scatterMode,
                distributionEnabled
            }
        });
    }, [
        activePrimitive,
        activeStorageId,
        distributionEnabled,
        isToolOverlay,
        maxScale,
        minScale,
        objectCount,
        publishState,
        scatterMode,
        scatterRadius,
        sharedState?.activeArtifactId,
        sharedState?.activeEntityId,
        sharedState?.activeLayerId,
        sharedState?.activeMaterialId,
        status
    ]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            ...(sharedState?.activeArtifactId ?? activeStorageId
                ? {
                    activeAssetId: sharedState?.activeArtifactId ?? activeStorageId
                }
                : {}),
            activeLayerId: 'scatter:placements'
        });
    }, [
        activeStorageId,
        isToolOverlay,
        publishSelection,
        sharedState?.activeArtifactId
    ]);

    const mountRef = useRef<HTMLDivElement>(null);
    const engine = useRef<any>({
        scene: null, camera: null, renderer: null,
        controls: null, baseMesh: null, edgeGeo: null, scatterGroup: null,
        raycaster: new THREE.Raycaster(),
        frameId: 0
    });

    const frameScatterViewport = () => {
        const { camera, controls, baseMesh, scatterGroup } = engine.current;
        if (!camera || !controls) {
            return;
        }

        const focusTarget = baseMesh ?? scatterGroup ?? null;
        const bounds = focusTarget ? new THREE.Box3().setFromObject(focusTarget) : new THREE.Box3();
        const center = bounds.isEmpty() ? new THREE.Vector3(0, 0, 0) : bounds.getCenter(new THREE.Vector3());
        const size = bounds.isEmpty() ? new THREE.Vector3(4, 4, 4) : bounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 4);
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target);

        if (direction.lengthSq() < 0.001) {
            direction.set(1, 0.85, 1);
        }

        direction.normalize();
        camera.position.copy(center.clone().add(direction.multiplyScalar(Math.max(6, maxDim * 1.8))));
        controls.target.copy(center);
        controls.update();
        setStatus('SCATTER VIEW FRAMED');
    };

    useZenControlBindings('scatter', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'scatter' || phase !== 'down') {
            return false;
        }

        if (actionId === 'camera.focus') {
            if (isToolOverlay) {
                return false;
            }
            frameScatterViewport();
            return true;
        }

        return false;
    });

    // --- INIT ENGINE ---
    useEffect(() => {
        if (isToolOverlay) return;
        if (!mountRef.current) return;
        if (engine.current.renderer) {
            cancelAnimationFrame(engine.current.frameId);
            engine.current.renderer.dispose();
            if (mountRef.current) mountRef.current.innerHTML = '';
        }

        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505);
        scene.fog = new THREE.FogExp2(0x050505, 0.00);
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
        camera.position.set(6, 6, 6);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(w, h);
        renderer.shadowMap.enabled = true;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.5;
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.autoRotate = false; controls.autoRotateSpeed = 0.5;
        const disconnectZenViewport = connectViewport({
            element: mountRef.current,
            scene,
            camera,
            controls,
            renderer
        });

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 3.5); scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xff00cc, 4.5); dir.position.set(10, 10, 5); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); scene.add(dir);
        const blue = new THREE.PointLight(0x00ffff, 3.0); blue.position.set(-5, 2, -5); scene.add(blue);
        const fill = new THREE.DirectionalLight(0xffaa00, 1.0); fill.position.set(-5, 0, 5); scene.add(fill);

        const geo = new THREE.IcosahedronGeometry(1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2, metalness: 0.8 });
        const base = new THREE.Mesh(geo, mat); base.receiveShadow = true; base.castShadow = true; base.visible = true;
        scene.add(base);
        engine.current.baseMesh = base;
        engine.current.edgeGeo = new THREE.EdgesGeometry(geo);

        const scatterGroup = new THREE.Group();
        scene.add(scatterGroup);
        engine.current.scatterGroup = scatterGroup;

        engine.current = { ...engine.current, scene, camera, renderer, controls };

        const animate = () => {
            engine.current.frameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        updatePaletteFromPrimitive('CUBE');

        const handleResize = () => { if (!mountRef.current) return; camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight); };
        window.addEventListener('resize', handleResize);
        return () => { disconnectZenViewport(); window.removeEventListener('resize', handleResize); cancelAnimationFrame(engine.current.frameId); renderer.dispose(); };
    }, [connectViewport, isToolOverlay]);

    useEffect(() => { if (engine.current.controls) engine.current.controls.autoRotate = autoRotate; }, [autoRotate]);

    useEffect(() => {
        if (isToolOverlay) return;
        if (sharedState?.artifact && engine.current.scene) {
            const url = URL.createObjectURL(sharedState.artifact);
            const loader = new GLTFLoader();
            setStatus("LOADING BASE SURFACE...");
            loader.load(url, (gltf) => {
                const { scene, baseMesh } = engine.current;
                if (baseMesh) scene.remove(baseMesh);

                // Clone entire scene to preserve all meshes and materials
                const imported = gltf.scene.clone();

                // Normalize the entire imported group
                const box = new THREE.Box3().setFromObject(imported);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 3.0 / (maxDim || 1);

                // Center and scale the group
                imported.position.sub(center.multiplyScalar(scale));
                imported.scale.set(scale, scale, scale);
                imported.updateMatrixWorld(true);

                // Add to scene with original materials preserved
                scene.add(imported);
                engine.current.baseMesh = imported;

                // Build edge geometry from all meshes
                const edgeGeos: THREE.BufferGeometry[] = [];
                imported.traverse((c: any) => {
                    if (c.isMesh && c.geometry) {
                        const worldGeo = c.geometry.clone();
                        worldGeo.applyMatrix4(c.matrixWorld);
                        edgeGeos.push(new THREE.EdgesGeometry(worldGeo));
                    }
                });
                if (edgeGeos.length > 0) {
                    engine.current.edgeGeo = BufferGeometryUtils.mergeGeometries(edgeGeos);
                }

                setStatus("BASE MESH MOUNTED");
                generateScatter();
                URL.revokeObjectURL(url);
            });
        }
    }, [isToolOverlay, sharedState?.artifact]);

    const updatePaletteFromPrimitive = (type: string) => {
        let geo;
        switch (type) { case 'CUBE': geo = new THREE.BoxGeometry(1, 1, 1); break; case 'SPHERE': geo = new THREE.IcosahedronGeometry(0.5, 1); break; case 'CYLINDER': geo = new THREE.CylinderGeometry(0.2, 0.2, 1, 8); break; case 'PYRAMID': geo = new THREE.ConeGeometry(0.5, 1, 4); break; case 'PLATE': geo = new THREE.BoxGeometry(1, 0.1, 1); break; default: geo = new THREE.BoxGeometry(1, 1, 1); }
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5 });
        paletteRef.current = [{ geometry: geo, material: mat }];
        generateScatter();
    };

    // Load a storage item as the base mesh (when distribution is OFF)
    const loadAsBaseMesh = (storageItem: any) => {
        const url = URL.createObjectURL(storageItem.blob);
        const loader = new GLTFLoader();
        setStatus(`LOADING BASE: ${storageItem.name}...`);
        loader.load(url, (gltf) => {
            const { scene, baseMesh } = engine.current;
            if (baseMesh) scene.remove(baseMesh);

            // Clone entire scene to preserve all meshes and materials
            const imported = gltf.scene.clone();

            // Normalize
            const box = new THREE.Box3().setFromObject(imported);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.0 / (maxDim || 1);

            imported.position.sub(center.multiplyScalar(scale));
            imported.scale.set(scale, scale, scale);
            imported.updateMatrixWorld(true);

            scene.add(imported);
            engine.current.baseMesh = imported;

            // Build edge geometry from all meshes
            const edgeGeos: THREE.BufferGeometry[] = [];
            imported.traverse((c: any) => {
                if (c.isMesh && c.geometry) {
                    const worldGeo = c.geometry.clone();
                    worldGeo.applyMatrix4(c.matrixWorld);
                    edgeGeos.push(new THREE.EdgesGeometry(worldGeo));
                }
            });
            if (edgeGeos.length > 0) {
                engine.current.edgeGeo = BufferGeometryUtils.mergeGeometries(edgeGeos);
            }

            setStatus(`BASE MESH MOUNTED: ${storageItem.name}`);
            generateScatter();
            URL.revokeObjectURL(url);
        });
    };

    const updatePaletteFromStorage = (storageItem: any) => {
        if (!storageItem) return;

        // If distribution is OFF, load as base mesh instead of scattering
        if (!distributionEnabled) {
            loadAsBaseMesh(storageItem);
            return;
        }

        // DISTRIBUTE MODE: Merge all meshes into ONE combined geometry
        // so the whole character/model scatters as a single unit
        const url = URL.createObjectURL(storageItem.blob);
        const loader = new GLTFLoader();
        setStatus(`PARSING ${storageItem.name}...`);
        loader.load(url, (gltf) => {
            const geometries: THREE.BufferGeometry[] = [];
            const materials: THREE.Material[] = [];

            gltf.scene.updateMatrixWorld(true);
            gltf.scene.traverse((c: any) => {
                if (c.isMesh && c.geometry) {
                    // Clone and apply world transform so mesh is in correct position
                    const g = c.geometry.clone();
                    g.applyMatrix4(c.matrixWorld);
                    geometries.push(g);
                    if (c.material) {
                        materials.push(Array.isArray(c.material) ? c.material[0] : c.material);
                    }
                }
            });

            if (geometries.length > 0) {
                // Merge all geometries into one combined mesh
                const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries, false);
                if (mergedGeo) {
                    // Normalize the merged geometry
                    mergedGeo.computeBoundingBox();
                    const size = new THREE.Vector3();
                    mergedGeo.boundingBox!.getSize(size);
                    const max = Math.max(size.x, size.y, size.z);
                    if (max > 0) {
                        const s = 1.0 / max;
                        mergedGeo.scale(s, s, s);
                        mergedGeo.center();
                    }

                    // Use the first material or a default
                    const mat = materials.length > 0 ? materials[0].clone() : new THREE.MeshStandardMaterial();

                    paletteRef.current = [{ geometry: mergedGeo, material: mat }];
                    setStatus(`LOADED AS SINGLE VARIANT`);
                    generateScatter();
                } else {
                    setStatus("ERROR: MERGE FAILED");
                }
            } else {
                setStatus("ERROR: NO MESHES FOUND");
            }
            URL.revokeObjectURL(url);
        });
    };

    // Rust-powered scatter modes (async)
    const RUST_MODES = ['POISSON', 'FIBONACCI', 'SUNFLOWER', 'HALTON', 'VORONOI', 'PHYLLOTAXIS', 'CLUSTER', 'ORGANIC', 'PHYSICS_DROP', 'GRAVITY_WELL'];

    const generateScatterRust = async () => {
        const { scatterGroup } = engine.current;
        const palette = paletteRef.current;

        while (scatterGroup.children.length > 0) {
            const c = scatterGroup.children.pop();
            if ((c as any).isInstancedMesh) (c as any).dispose();
        }
        if (!palette || palette.length === 0) return;

        setIsLoading(true);
        setStatus(`COMPUTING ${scatterMode} (RUST)...`);

        try {
            let positions: [number, number, number][] = [];
            let transforms: ScatterClient.ScatterTransform[] | null = null;

            const seed = Date.now();
            const r = scatterRadius;

            // Call appropriate Rust function
            switch (scatterMode) {
                case 'POISSON':
                    positions = await ScatterClient.poissonDiskScatter(objectCount, r, r / Math.sqrt(objectCount) * 1.5, seed);
                    break;
                case 'FIBONACCI':
                case 'PHYLLOTAXIS':
                    positions = await ScatterClient.fibonacciSpiralScatter(objectCount, r, r * 0.5);
                    break;
                case 'SUNFLOWER':
                    positions = await ScatterClient.sunflowerDiskScatter(objectCount, r);
                    break;
                case 'HALTON':
                    positions = await ScatterClient.haltonScatter(objectCount, r);
                    break;
                case 'VORONOI':
                    positions = await ScatterClient.voronoiCellScatter(objectCount, r, seed);
                    break;
                case 'CLUSTER':
                    positions = await ScatterClient.clusterScatter(objectCount, r, Math.max(3, Math.floor(objectCount / 20)), 0.7, seed);
                    break;
                case 'ORGANIC':
                    positions = await ScatterClient.organicScatter(objectCount, r, 0.5, 0.3, seed);
                    break;
                case 'PHYSICS_DROP':
                case 'GRAVITY_WELL':
                    transforms = await ScatterClient.physicsDropScatter(
                        objectCount,
                        r * 2,      // spawn height
                        r,          // spawn radius  
                        (minScale + maxScale) / 2 * 0.3, // object radius
                        -9.81,      // gravity
                        300,        // iterations
                        seed
                    );
                    break;
                default:
                    positions = [];
            }

            // Create instanced meshes
            const numVariants = palette.length;
            const instancedMeshes: any[] = [];
            const actualCount = transforms ? transforms.length : positions.length;
            const countsPerVariant = new Array(numVariants).fill(0);
            for (let i = 0; i < actualCount; i++) countsPerVariant[i % numVariants]++;

            palette.forEach((item: any, idx: number) => {
                const count = countsPerVariant[idx];
                if (count === 0) return;
                const mesh = new THREE.InstancedMesh(item.geometry, item.material, count);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.userData.idxCounter = 0;
                scatterGroup.add(mesh);
                instancedMeshes.push(mesh);
            });

            const dummy = new THREE.Object3D();

            // Apply positions/transforms to instances
            for (let i = 0; i < actualCount; i++) {
                if (transforms) {
                    // Physics-based: use full transform
                    const t = transforms[i];
                    dummy.position.set(t.position[0], t.position[1], t.position[2]);
                    dummy.quaternion.set(t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3]);
                    const s = minScale + Math.random() * (maxScale - minScale);
                    dummy.scale.set(s, s, s);
                } else {
                    // Position-only: random rotation and scale
                    const p = positions[i];
                    dummy.position.set(p[0], p[1], p[2]);
                    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    const s = minScale + Math.random() * (maxScale - minScale);
                    dummy.scale.set(s, s, s);
                }

                dummy.updateMatrix();

                const variantIdx = i % numVariants;
                let currentV = 0;
                for (let v = 0; v < numVariants; v++) {
                    if (countsPerVariant[v] > 0) {
                        if (v === variantIdx) {
                            const targetMesh = instancedMeshes[currentV];
                            const localIdx = targetMesh.userData.idxCounter++;
                            targetMesh.setMatrixAt(localIdx, dummy.matrix);
                            break;
                        }
                        currentV++;
                    }
                }
            }

            instancedMeshes.forEach(m => m.instanceMatrix.needsUpdate = true);
            setStatus(`SCATTERED ${actualCount} OBJECTS (${scatterMode}) ⚡RUST`);
        } catch (err: any) {
            console.error('[KScatter] Rust error:', err);
            setStatus(`ERROR: ${err.message || err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const generateScatter = () => {
        // Route to Rust for algorithmic modes
        if (RUST_MODES.includes(scatterMode)) {
            generateScatterRust();
            return;
        }

        const { scene, baseMesh, scatterGroup, edgeGeo } = engine.current; const palette = paletteRef.current;
        while (scatterGroup.children.length > 0) { const c = scatterGroup.children.pop(); if ((c as any).isInstancedMesh) (c as any).dispose(); }
        if (!palette || palette.length === 0) return;
        const numVariants = palette.length; const instancedMeshes: any[] = []; const countsPerVariant = new Array(numVariants).fill(0);
        for (let i = 0; i < objectCount; i++) countsPerVariant[i % numVariants]++;
        palette.forEach((item: any, idx: number) => { const count = countsPerVariant[idx]; if (count === 0) return; const mesh = new THREE.InstancedMesh(item.geometry, item.material, count); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.idxCounter = 0; scatterGroup.add(mesh); instancedMeshes.push(mesh); });
        const dummy = new THREE.Object3D(); const sampler = baseMesh ? baseMesh.geometry : null; const posAttr = sampler ? sampler.attributes.position : null; const normAttr = sampler ? sampler.attributes.normal : null; const edgeAttr = edgeGeo ? edgeGeo.attributes.position : null;
        let scriptFn: any = null; if (scatterMode === 'SCRIPT') { try { scriptFn = new Function('i', 'count', 'p', 'r', 's', 'Math', 'radius', userScript); setScriptError(null); } catch (e: any) { setScriptError(e.message); } }

        for (let i = 0; i < objectCount; i++) {
            let pos = new THREE.Vector3(); let norm = new THREE.Vector3(0, 1, 0); const t = i / objectCount; const r = scatterRadius;
            if (scatterMode === 'SURFACE' && posAttr && normAttr) { const rIndex = Math.floor(Math.random() * posAttr.count); pos.fromBufferAttribute(posAttr, rIndex); norm.fromBufferAttribute(normAttr, rIndex); pos.applyMatrix4(baseMesh.matrixWorld); norm.transformDirection(baseMesh.matrixWorld); }
            else if (scatterMode === 'VERTEX' && posAttr && normAttr) { const vIndex = i % posAttr.count; pos.fromBufferAttribute(posAttr, vIndex); norm.fromBufferAttribute(normAttr, vIndex); pos.applyMatrix4(baseMesh.matrixWorld); norm.transformDirection(baseMesh.matrixWorld); }
            else if (scatterMode === 'EDGE' && edgeAttr) { const numEdges = edgeAttr.count / 2; const edgeIdx = Math.floor(Math.random() * numEdges); const v1 = new THREE.Vector3().fromBufferAttribute(edgeAttr, edgeIdx * 2); const v2 = new THREE.Vector3().fromBufferAttribute(edgeAttr, edgeIdx * 2 + 1); pos.lerpVectors(v1, v2, Math.random()); pos.applyMatrix4(baseMesh.matrixWorld); norm.set(0, 1, 0); }
            else if (scatterMode === 'CLOUD') { pos.set((Math.random() - 0.5) * r * 2, (Math.random() - 0.5) * r * 2, (Math.random() - 0.5) * r * 2); }
            else if (scatterMode === 'SPHERE') { const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1); pos.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)); norm.copy(pos).normalize(); }
            else if (scatterMode === 'RING') { const theta = Math.random() * Math.PI * 2; const rad = r * (0.8 + Math.random() * 0.4); pos.set(Math.cos(theta) * rad, (Math.random() - 0.5) * 0.2, Math.sin(theta) * rad); }
            else if (scatterMode === 'SPIRAL') { const arms = 3; const armIndex = i % arms; const angleOffset = (Math.PI * 2 / arms) * armIndex; const dist = Math.pow(Math.random(), 2) * r * 2; const angle = dist * 2.0 + angleOffset; pos.set(Math.cos(angle) * dist, (Math.random() - 0.5) * dist * 0.2, Math.sin(angle) * dist); }
            else if (scatterMode === 'GRID') { const s = Math.ceil(Math.pow(objectCount, 1 / 3)); const gap = r / s * 2; const ix = i % s; const iy = Math.floor(i / s) % s; const iz = Math.floor(i / (s * s)); pos.set(ix * gap - r, iy * gap - r, iz * gap - r); }
            else if (scatterMode === 'HELIX') { const h = r * 2; const y = t * h - r; const angle = t * Math.PI * 8; const rad = r * 0.5; pos.set(Math.cos(angle) * rad, y, Math.sin(angle) * rad); if (i % 2 === 0) pos.x *= -1; pos.z *= -1; }
            else if (scatterMode === 'WAVE') { const s = Math.ceil(Math.sqrt(objectCount)); const gap = r / s * 4; const ix = i % s; const iz = Math.floor(i / s); const x = ix * gap - r * 2; const z = iz * gap - r * 2; const y = Math.sin(x) * Math.cos(z) * 0.5; pos.set(x, y, z); }
            else if (scatterMode === 'VORTEX') { const h = r * 3; const y = t * h - h / 2; const rad = (t * t) * r * 2 + 0.1; const angle = t * Math.PI * 10; pos.set(Math.cos(angle) * rad, y, Math.sin(angle) * rad); }
            else if (scatterMode === 'EXPLOSION') { const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(); const dist = Math.random() * r * 2; pos.copy(dir).multiplyScalar(dist); norm.copy(dir); }
            // Nature modes (JS fallback for unimplemented)
            else if (scatterMode === 'IVY') { const theta = t * Math.PI * 6; const rad = 0.5 + t * r; pos.set(Math.cos(theta) * rad, t * r * 2 - r, Math.sin(theta) * rad + Math.sin(t * 20) * 0.2); }
            else if (scatterMode === 'MOSS') { pos.set((Math.random() - 0.5) * r * 2, Math.abs(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * r * 2); }
            else if (scatterMode === 'CORAL') { const branch = Math.floor(Math.random() * 5); const bAngle = (branch / 5) * Math.PI * 2; const h = Math.random() * r; const spread = h * 0.5; pos.set(Math.cos(bAngle) * spread + (Math.random() - 0.5) * 0.2, h, Math.sin(bAngle) * spread + (Math.random() - 0.5) * 0.2); }
            else if (scatterMode === 'CRYSTAL') { const face = Math.floor(Math.random() * 6); const fAngles = [0, 60, 120, 180, 240, 300].map(a => a * Math.PI / 180); const fAngle = fAngles[face]; const h = Math.random() * r * 1.5; const rad = r * 0.3 * (1 - h / (r * 1.5)); pos.set(Math.cos(fAngle) * rad, h - r * 0.5, Math.sin(fAngle) * rad); }
            // Simulation fallbacks
            else if (scatterMode === 'MAGNETIC') { const pole = i % 2 === 0 ? 1 : -1; const angle = Math.random() * Math.PI * 2; const dist = Math.random() * r; pos.set(Math.cos(angle) * dist, pole * (r * 0.5 + Math.random() * r * 0.5), Math.sin(angle) * dist); }
            else if (scatterMode === 'REPEL') { const angle = (i / objectCount) * Math.PI * 2; const dist = 0.5 + (i / objectCount) * r; pos.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 0.5, Math.sin(angle) * dist); }
            else { pos.set((Math.random() - 0.5) * r, (Math.random() - 0.5) * r, (Math.random() - 0.5) * r); }

            dummy.position.copy(pos);
            if (scatterMode === 'EXPLOSION' || scatterMode === 'SPHERE' || scatterMode === 'SURFACE' || scatterMode === 'VERTEX') { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm); dummy.quaternion.copy(q); if (scatterMode === 'SURFACE') dummy.rotateY(Math.random() * Math.PI * 2); } else { dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); }
            const s = minScale + Math.random() * (maxScale - minScale); dummy.scale.set(s, s, s);
            if (scatterMode === 'SCRIPT' && scriptFn) { try { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); scriptFn(i, objectCount, dummy.position, dummy.rotation, dummy.scale, Math, scatterRadius); } catch (e) { } }
            dummy.updateMatrix();
            const variantIdx = i % numVariants; const mesh = instancedMeshes[variantIdx]; let targetMesh = null; let currentV = 0;
            for (let v = 0; v < numVariants; v++) { if (countsPerVariant[v] > 0) { if (v === variantIdx) { targetMesh = instancedMeshes[currentV]; break; } currentV++; } }
            if (targetMesh) { const localIdx = targetMesh.userData.idxCounter++; targetMesh.setMatrixAt(localIdx, dummy.matrix); }
        }
        instancedMeshes.forEach(m => m.instanceMatrix.needsUpdate = true); setStatus(`SCATTERED ${objectCount} OBJECTS (${scatterMode})`)
    };

    const handleExport = async () => {
        const { baseMesh, scatterGroup } = engine.current; setStatus(weldGeometry ? "WELDING GEOMETRY..." : "PACKING DATA...");
        await new Promise(resolve => setTimeout(resolve, 50));
        const exportScene = new THREE.Scene(); if (baseMesh) exportScene.add(baseMesh.clone());
        if (weldGeometry) {
            const batches = new Map(); scatterGroup.children.forEach((child: any) => { if (child.isInstancedMesh) { const mat = child.material; const geom = child.geometry; const count = child.count; const matrix = new THREE.Matrix4(); let batch = batches.get(mat.uuid); if (!batch) { batch = { material: mat, geometries: [] }; batches.set(mat.uuid, batch); } for (let i = 0; i < count; i++) { child.getMatrixAt(i, matrix); const instanceGeo = geom.clone(); instanceGeo.applyMatrix4(matrix); batch.geometries.push(instanceGeo); } } });
            batches.forEach((value) => { if (value.geometries.length > 0) { const mergedGeo = BufferGeometryUtils.mergeGeometries(value.geometries); const mesh = new THREE.Mesh(mergedGeo, value.material); mesh.name = "Scattered_Monolith"; exportScene.add(mesh); } });
        } else { exportScene.add(scatterGroup.clone()); }
        setStatus("GENERATING BINARY..."); const exporter = new GLTFExporter();
        exporter.parse(exportScene, (gltf) => { const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' }); if (onCommit) { onCommit(blob, weldGeometry ? "K-SCATTER_MONOLITH" : "K-SCATTER_INSTANCES"); setStatus("SENT TO KERNEL"); } }, (e) => console.error(e), { binary: true });
    };

    useEffect(() => { if (engine.current.scene) generateScatter(); }, [objectCount, scatterRadius, minScale, maxScale, scatterMode, userScript]);

    return (
        <div className={`flex h-full w-full text-gray-300 font-mono select-none overflow-hidden ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>
            {/* LEFT PANEL */}
            {!isViewportHost && (
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KScatterLeftPanel
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        activePrimitive={activePrimitive}
                        setActivePrimitive={setActivePrimitive}
                        updatePaletteFromPrimitive={updatePaletteFromPrimitive}
                        activeStorageId={activeStorageId}
                        setActiveStorageId={setActiveStorageId}
                        updatePaletteFromStorage={updatePaletteFromStorage}
                        sharedState={sharedState}
                    />
                </div>
            )}

            {/* VIEWPORT */}
            <div className={`flex-1 relative h-full cursor-crosshair ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-black'}`}>
                {/* TOP BAR */}
                {!isViewportHost && (
                    <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                        <KScatterTopBar
                            objectCount={objectCount}
                            setObjectCount={setObjectCount}
                            scatterRadius={scatterRadius}
                            setScatterRadius={setScatterRadius}
                            minScale={minScale}
                            setMinScale={setMinScale}
                            maxScale={maxScale}
                            setMaxScale={setMaxScale}
                            autoRotate={autoRotate}
                            setAutoRotate={setAutoRotate}
                            weldGeometry={weldGeometry}
                            setWeldGeometry={setWeldGeometry}
                            distributionEnabled={distributionEnabled}
                            setDistributionEnabled={setDistributionEnabled}
                            onUplink={handleExport}
                        />
                    </div>
                )}

                {/* CANVAS */}
                <div ref={mountRef} className={`absolute inset-0 w-full h-full ${isToolOverlay ? 'opacity-0 pointer-events-none' : ''}`} />

                {/* STATUS OVERLAY */}
                {!isViewportHost && (
                    <div className="absolute top-20 left-6 flex flex-col gap-2 pointer-events-none">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-pink-500 bg-black/80 px-4 py-2 border-l-2 border-pink-500 shadow-xl backdrop-blur-md">
                            <Activity size={12} className="animate-pulse" /> {status}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 bg-black/60 px-4 py-1 rounded border border-white/10 backdrop-blur-md">
                            <Package size={12} /> INSTANCES: {objectCount}
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT PANEL */}
            {!isViewportHost && (
                <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                    <KScatterRightPanel
                        scatterMode={scatterMode}
                        setScatterMode={setScatterMode}
                        hasBaseMesh={!!engine.current.baseMesh}
                        userScript={userScript}
                        setUserScript={setUserScript}
                        scriptError={scriptError}
                    />
                </div>
            )}
        </div>
    );
}
