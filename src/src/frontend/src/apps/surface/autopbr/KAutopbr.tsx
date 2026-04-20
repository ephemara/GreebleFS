
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
    UploadCloud, Layers, Box, Globe, Sparkles, Wand2, Share2, Cuboid, Package, Loader2, RotateCcw
} from 'lucide-react';
import { processImage, packORM, generateAITexture } from './KAutopbrEngine';
import KAutopbrUI from './KAutopbrUI';
import { python } from '../../../services/pythonBridge';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getEntityMaterialId, useZenModuleBridge, useZenWorkspaceStore } from '../../../core/zen';

export const DEFAULT_PARAMS = {
    normalStrength: 0.01,
    roughnessBase: 0.7,       // NEW: Base roughness level (0=glossy, 1=matte)
    roughnessContrast: 1.0,
    roughnessBrightness: 0,
    roughnessInvert: false,   // CHANGED: More intuitive default
    metallicBase: 0.0,        // NEW: Base metallic level
    metalContrast: 1.0,
    metalBias: 0,             // CHANGED: Neutral default
    aoIntensity: 1.0,
    heightContrast: 1.0,
    makeSeamless: false,
    dust: 0.0,
    grunge: 0.0,
    scratches: 0.0,
    edgeFry: 0.0,
    hue: 0,
    scale: 1.0,
    cyberDetail: 0.0,
    cyberScale: 0.1,
    bioDetail: 0.0,
    bioFreq: 0.2,
    emissiveThreshold: 0.0,
    decalCount: 0.0,
    decalScale: 0.5,
    decalOpacity: 0.9,
    displacementScale: 0.05,
    pixelate: 0.0,
    scanlines: 0.0,
    noise: 0.0,
    chromatic: 0.0,
    brightness: 1.0,
    contrast: 1.0,
    gamma: 1.0,
    vignette: 0.0,
    edgeWear: 0.0,
    cavityDirt: 0.0
};

interface AutopbrSceneTarget {
    id: string;
    name: string;
    materialUuid: string | null;
    colorHex: string;
    layerId: string | null;
    entityId: string | null;
    assetId: string | null;
}

const AUTOPBR_SHARED_TARGET_ID = 'autopbr:shared-target';
const AUTOPBR_TARGET_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee'];

const readMaterialBaseSource = (material: any): string | null => {
    if (!material || typeof material !== 'object') {
        return null;
    }

    if (typeof material.base === 'string' && material.base.length > 0) {
        return material.base;
    }

    if (material.channels && typeof material.channels.base === 'string' && material.channels.base.length > 0) {
        return material.channels.base;
    }

    return typeof material.preview === 'string' && material.preview.length > 0
        ? material.preview
        : null;
};

export default function KAutopbr({
    sharedState,
    onMaterialCommit,
    onCommit,
    tempImage,
    setTempImage,
    zenShellMode = 'standalone'
}: any) {
    const { publishLayers, publishState, publishSelection } = useZenModuleBridge('autopbr');
    const bindActiveSceneEntityMaterial = useZenWorkspaceStore((state) => state.bindActiveSceneEntityMaterial);
    const zenWorkspaceDocument = useZenWorkspaceStore((state) => state.document);
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const canvasRef = useRef<any>(null);
    const sceneRef = useRef<any>(null);
    const rendererRef = useRef<any>(null);
    const meshRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const frameId = useRef<any>(null);
    const isDragging = useRef(false);
    const previousMousePosition = useRef({ x: 0, y: 0 });
    const lightsRef = useRef<any>({});

    const [sourceImage, setSourceImage] = useState(null);
    const [sourceImgObj, setSourceImgObj] = useState<HTMLImageElement | null>(null);
    const [decalImage, setDecalImage] = useState(null);
    const [decalImgObj, setDecalImgObj] = useState<HTMLImageElement | null>(null);

    const [loading, setLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isBaking, setIsBaking] = useState(false);
    const [aiBakeMode, setAiBakeMode] = useState(false); // Toggle for AI Bake workflow
    const [materialMode, setMaterialMode] = useState<'matte' | 'glossy'>('matte'); // MATTE/GLOSSY toggle like Substance Sampler

    const [viewShape, setViewShape] = useState(sharedState?.artifact ? 'artifact' : 'sphere');
    const [activeTab, setActiveTab] = useState('surface');
    const [status, setStatus] = useState('K-SAMPLE READY');

    const [sceneMaterials, setSceneMaterials] = useState<any[]>([]);
    const [sceneTargets, setSceneTargets] = useState<AutopbrSceneTarget[]>([]);
    const [activeSceneTargetId, setActiveSceneTargetId] = useState<string | null>(null);

    const [maps, setMaps] = useState<any>({ base: null, normal: null, roughness: null, metallic: null, ao: null, height: null, emissive: null });

    // Lighting Config
    const [lighting, setLighting] = useState({
        envIntensity: 0.5,
        keyIntensity: 1.5,
        keyColor: '#ffffff',
        keyAngle: 45,
        rimIntensity: 2.0,
        rimColor: '#3b82f6'
    });

    const [envMode, setEnvMode] = useState('studio'); // studio, custom
    const [envPath, setEnvPath] = useState('');

    const [params, setParams] = useState(DEFAULT_PARAMS);

    const overlaySceneTargets = useMemo<AutopbrSceneTarget[]>(() => {
        if (!isToolOverlay) {
            return [];
        }

        return [{
            id: `autopbr:shared:${sharedState?.activeEntityId ?? sharedState?.activeLayerId ?? AUTOPBR_SHARED_TARGET_ID}`,
            name: sharedState?.activeLayer?.name
                ?? sharedState?.activeEntity?.name
                ?? sharedState?.activeMaterial?.name
                ?? 'Shared Sample Target',
            materialUuid: sharedState?.activeMaterialId ?? null,
            colorHex: AUTOPBR_TARGET_COLORS[0],
            layerId: sharedState?.activeLayerId ?? null,
            entityId: sharedState?.activeEntityId ?? null,
            assetId: sharedState?.activeArtifactId ?? null
        }];
    }, [
        isToolOverlay,
        sharedState?.activeArtifactId,
        sharedState?.activeEntityId,
        sharedState?.activeEntity?.name,
        sharedState?.activeLayer?.name,
        sharedState?.activeLayerId,
        sharedState?.activeMaterial?.name,
        sharedState?.activeMaterialId
    ]);

    const overlayWorkspaceTargets = useMemo<AutopbrSceneTarget[]>(() => {
        if (!isToolOverlay) {
            return [];
        }

        const layerById = new Map(zenWorkspaceDocument.layers.map((layer) => [layer.id, layer]));
        const entityCountByLayerId = zenWorkspaceDocument.entities.reduce<Record<string, number>>((counts, entity) => {
            counts[entity.layerId] = (counts[entity.layerId] ?? 0) + 1;
            return counts;
        }, {});

        const targets = zenWorkspaceDocument.entities
            .filter((entity) => {
                const layer = layerById.get(entity.layerId);
                if (!layer) {
                    return false;
                }

                if (layer.tags.includes('workspace-root') || layer.tags.includes('module-root')) {
                    return false;
                }

                return entity.moduleId !== 'autopbr';
            })
            .sort((left, right) => {
                const leftLayer = layerById.get(left.layerId);
                const rightLayer = layerById.get(right.layerId);
                const orderDelta = (leftLayer?.order ?? 0) - (rightLayer?.order ?? 0);
                if (orderDelta !== 0) {
                    return orderDelta;
                }

                return left.name.localeCompare(right.name);
            })
            .map((entity, index) => {
                const layer = layerById.get(entity.layerId);
                if (!layer) {
                    return null;
                }

                const materialId = getEntityMaterialId(entity);
                const layerEntityCount = entityCountByLayerId[entity.layerId] ?? 0;
                return {
                    id: `autopbr:shared:${entity.id}`,
                    name: layerEntityCount > 1
                        ? `${layer.name} • ${entity.name}`
                        : layer.name,
                    materialUuid: materialId,
                    colorHex: AUTOPBR_TARGET_COLORS[index % AUTOPBR_TARGET_COLORS.length],
                    layerId: layer.id,
                    entityId: entity.id,
                    assetId: entity.assetId ?? null
                } satisfies AutopbrSceneTarget;
            })
            .filter((target): target is AutopbrSceneTarget => Boolean(target));

        return targets.length > 0 ? targets : overlaySceneTargets;
    }, [isToolOverlay, overlaySceneTargets, zenWorkspaceDocument.entities, zenWorkspaceDocument.layers]);

    const visibleSceneTargets = isToolOverlay ? overlayWorkspaceTargets : sceneTargets;
    const overlayResolvedActiveSceneTargetId = useMemo(() => {
        if (!isToolOverlay) {
            return null;
        }

        return visibleSceneTargets.find((target) => target.entityId === sharedState?.activeEntityId)?.id
            ?? visibleSceneTargets.find((target) => target.layerId === sharedState?.activeLayerId)?.id
            ?? visibleSceneTargets[0]?.id
            ?? null;
    }, [
        isToolOverlay,
        sharedState?.activeEntityId,
        sharedState?.activeLayerId,
        visibleSceneTargets
    ]);
    const resolvedActiveSceneTargetId = isToolOverlay
        ? overlayResolvedActiveSceneTargetId
        : activeSceneTargetId;
    const activeSceneTarget = useMemo(
        () => visibleSceneTargets.find((target) => target.id === resolvedActiveSceneTargetId) ?? null,
        [resolvedActiveSceneTargetId, visibleSceneTargets]
    );
    const activeMaterialId = activeSceneTarget?.materialUuid ?? null;

    const handleSelectSceneTarget = useCallback((targetId: string) => {
        if (isToolOverlay) {
            const nextTarget = visibleSceneTargets.find((target) => target.id === targetId);
            if (!nextTarget) {
                return;
            }

            publishSelection({
                activeAssetId: nextTarget.assetId,
                activeEntityId: nextTarget.entityId,
                activeLayerId: nextTarget.layerId
            });
            return;
        }

        setActiveSceneTargetId(targetId);
    }, [isToolOverlay, publishSelection, visibleSceneTargets]);

    useEffect(() => {
        publishLayers(visibleSceneTargets.map((target, index) => ({
            id: target.id,
            name: target.name,
            order: index,
            tags: ['material', 'sample-layer']
        })));
    }, [publishLayers, visibleSceneTargets]);

    useEffect(() => {
        publishState({
            status,
            viewShape,
            activeTab,
            activeSceneTargetId: resolvedActiveSceneTargetId,
            activeMaterialId,
            sampleTargetCount: visibleSceneTargets.length,
            generatedMapCount: Object.values(maps).filter(Boolean).length
        });
    }, [
        activeMaterialId,
        activeTab,
        maps,
        publishState,
        resolvedActiveSceneTargetId,
        status,
        viewShape,
        visibleSceneTargets.length
    ]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            activeAssetId: sharedState?.activeArtifactId ?? null,
            activeLayerId: resolvedActiveSceneTargetId
        });
    }, [
        isToolOverlay,
        publishSelection,
        resolvedActiveSceneTargetId,
        sharedState?.activeArtifactId
    ]);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        if (!sceneTargets.length) {
            if (activeSceneTargetId !== null) {
                setActiveSceneTargetId(null);
            }
            return;
        }

        if (!sceneTargets.some((target) => target.id === activeSceneTargetId)) {
            setActiveSceneTargetId(sceneTargets[0].id);
        }
    }, [activeSceneTargetId, isToolOverlay, sceneTargets]);

    const handleEnvironmentChange = (mode: string, path: string = '') => {
        setEnvMode(mode);
        setEnvPath(path);

        if (!sceneRef.current || !(window as any).pmremGenerator) return;
        const scene = sceneRef.current;
        const pmrem = (window as any).pmremGenerator;

        if (mode === 'studio') {
            scene.environment = (window as any).defaultEnv || null;
            scene.background = null;
        } else if (mode === 'custom' && path) {
            // Check if it's a Data URL (generated) or a file path (HDR)
            if (path.startsWith('data:') || path.startsWith('blob:')) {
                new THREE.TextureLoader().load(path, (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    const envMap = pmrem.fromEquirectangular(texture).texture;
                    scene.environment = envMap;
                    scene.background = envMap;
                    texture.dispose();
                });
            } else {
                new RGBELoader().load(path, (texture) => {
                    const envMap = pmrem.fromEquirectangular(texture).texture;
                    scene.environment = envMap;
                    scene.background = envMap;
                    texture.dispose();
                });
            }
        }
    };

    useEffect(() => {
        if (tempImage) {
            const img = new Image();
            img.onload = () => {
                setSourceImgObj(img);
                setSourceImage(tempImage);
                if (setTempImage) setTempImage(null); // Clear from kernel
            };
            img.src = tempImage;
        }
    }, [tempImage, setTempImage]);

    // CRITICAL: Sync sourceImage string to sourceImgObj HTMLImageElement
    // This enables Flux generators (which only have setSourceImage) to work properly
    useEffect(() => {
        if (sourceImage && typeof sourceImage === 'string') {
            // Only create new image if we don't already have a matching sourceImgObj
            if (!sourceImgObj || sourceImgObj.src !== sourceImage) {
                const img = new Image();
                img.onload = () => {
                    setSourceImgObj(img);
                };
                img.src = sourceImage;
            }
        }
    }, [sourceImage]);


    useEffect(() => {
        if (isToolOverlay) return;
        if (!canvasRef.current) return;
        const w = canvasRef.current.clientWidth;
        const h = canvasRef.current.clientHeight;
        const scene = new THREE.Scene();

        // Lights Setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 8, 5);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const rimLight = new THREE.PointLight(0x3b82f6, 2.0, 20);
        rimLight.position.set(-5, 2, -5);
        scene.add(rimLight);

        const fillLight = new THREE.PointLight(0xa855f7, 0.5);
        fillLight.position.set(0, -5, 0);
        scene.add(fillLight);

        lightsRef.current = { ambientLight, dirLight, rimLight, fillLight };

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        camera.position.set(0, 0, 3.5);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();

        // Default Environment
        const roomEnvironment = new RoomEnvironment();
        const defaultEnv = pmremGenerator.fromScene(roomEnvironment).texture;
        scene.environment = defaultEnv;

        // Store for switcher
        (window as any).pmremGenerator = pmremGenerator;
        (window as any).defaultEnv = defaultEnv;

        sceneRef.current = scene;
        rendererRef.current = renderer;

        const animate = () => {
            if (meshRef.current && !isDragging.current) { meshRef.current.rotation.y += 0.0015; }
            renderer.render(scene, camera);
            frameId.current = requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
            if (canvasRef.current && camera && renderer) {
                const width = canvasRef.current.clientWidth;
                const height = canvasRef.current.clientHeight;
                if (width === 0 || height === 0) return; // Persistence check

                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                renderer.setSize(width, height, false);
            }
        };
        window.addEventListener('resize', handleResize);

        // PERSISTENCE FIX: ResizeObserver to catch visibility changes
        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(canvasRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            cancelAnimationFrame(frameId.current);
            renderer.dispose();
            pmremGenerator.dispose();
        };
    }, [isToolOverlay]);

    // Update Lights dynamically
    useEffect(() => {
        const lights = lightsRef.current;
        if (!lights.ambientLight) return;

        lights.ambientLight.intensity = lighting.envIntensity;
        lights.dirLight.intensity = lighting.keyIntensity;
        lights.dirLight.color.set(lighting.keyColor);

        const rad = (lighting.keyAngle * Math.PI) / 180;
        lights.dirLight.position.set(Math.sin(rad) * 8, 8, Math.cos(rad) * 8);

        lights.rimLight.intensity = lighting.rimIntensity;
        lights.rimLight.color.set(lighting.rimColor);

    }, [lighting]);

    useEffect(() => {
        if (sharedState?.artifact) {
            setViewShape('artifact');
        }
    }, [sharedState?.artifact]);

    useEffect(() => {
        if (isToolOverlay) {
            setSceneMaterials([]);
            setSceneTargets([]);
            setActiveSceneTargetId(null);
            return;
        }

        if (!sceneRef.current) return;
        const scene = sceneRef.current;
        if (meshRef.current) { scene.remove(meshRef.current); }

        const buildSceneTargets = (root: THREE.Object3D) => {
            const materialList: THREE.MeshStandardMaterial[] = [];
            const targets: AutopbrSceneTarget[] = [];
            let meshCounter = 0;

            root.traverse((child: any) => {
                if (!child.isMesh || !child.material) {
                    return;
                }

                meshCounter += 1;
                const sourceSlots = Array.isArray(child.material)
                    ? child.material
                    : [child.material];

                const upgradedSlots = sourceSlots.map((slot: any, slotIndex: number) => {
                    const upgraded = slot?.isMeshStandardMaterial
                        ? slot.clone()
                        : new THREE.MeshStandardMaterial({
                            color: slot?.color ?? 0x888888,
                            map: slot?.map ?? null
                        });

                    upgraded.name = upgraded.name || `${child.name || `Layer_${meshCounter}`}_Mat_${slotIndex + 1}`;
                    materialList.push(upgraded);
                    targets.push({
                        id: `autopbr:sample:${child.uuid}:${slotIndex}`,
                        name: `${child.name || `Layer_${meshCounter}`}${sourceSlots.length > 1 ? ` • Slot ${slotIndex + 1}` : ''}`,
                        materialUuid: upgraded.uuid,
                        colorHex: `#${upgraded.color.getHexString()}`,
                        layerId: `autopbr:sample:${child.uuid}:${slotIndex}`,
                        entityId: child.uuid,
                        assetId: null
                    });

                    return upgraded;
                });

                child.material = Array.isArray(child.material)
                    ? upgradedSlots
                    : upgradedSlots[0];
            });

            return {
                materials: materialList,
                targets
            };
        };

        if (viewShape === 'artifact' && sharedState?.artifact) {
            const loader = new GLTFLoader();
            const url = URL.createObjectURL(sharedState.artifact);
            loader.load(url, (gltf) => {
                const root = gltf.scene;
                const box = new THREE.Box3().setFromObject(root);
                const size = new THREE.Vector3(); box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.0 / (maxDim || 1);
                root.scale.set(scale, scale, scale);
                box.setFromObject(root);
                const center = new THREE.Vector3(); box.getCenter(center);
                root.position.sub(center);

                scene.add(root);
                meshRef.current = root;

                const { materials, targets } = buildSceneTargets(root);
                setSceneMaterials(materials);
                setSceneTargets(targets);
                setActiveSceneTargetId(targets[0]?.id ?? null);
                URL.revokeObjectURL(url);
            });
        } else {
            let geo;
            if (viewShape === 'cube') geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 64, 64, 64);
            else geo = new THREE.SphereGeometry(1, 128, 128);
            const newMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.0, name: 'Primitive_Mat' });
            const newMesh = new THREE.Mesh(geo, newMat);
            newMesh.castShadow = true; newMesh.receiveShadow = true;
            scene.add(newMesh);
            meshRef.current = newMesh;
            setSceneMaterials([newMat]);
            const targetId = `autopbr:sample:${newMesh.uuid}:0`;
            setSceneTargets([{
                id: targetId,
                name: viewShape === 'cube' ? 'Cube Sample' : 'Sphere Sample',
                materialUuid: newMat.uuid,
                colorHex: `#${newMat.color.getHexString()}`,
                layerId: targetId,
                entityId: newMesh.uuid,
                assetId: null
            }]);
            setActiveSceneTargetId(targetId);
        }
    }, [isToolOverlay, viewShape, sharedState?.artifact]);

    useEffect(() => {
        if (!maps.base || !activeMaterialId || sceneMaterials.length === 0) return;
        const targetMat = sceneMaterials.find(m => m.uuid === activeMaterialId);
        if (!targetMat) return;

        const loader = new THREE.TextureLoader();
        const load = (url) => { if (!url) return null; const t = loader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; };

        if (maps.base) { targetMat.map = load(maps.base); if (targetMat.map) targetMat.map.repeat.set(params.scale, params.scale); }
        if (maps.normal) { targetMat.normalMap = load(maps.normal); if (targetMat.normalMap) { targetMat.normalMap.colorSpace = THREE.LinearSRGBColorSpace; targetMat.normalMap.repeat.set(params.scale, params.scale); } }
        if (maps.roughness) { targetMat.roughnessMap = load(maps.roughness); if (targetMat.roughnessMap) { targetMat.roughnessMap.colorSpace = THREE.LinearSRGBColorSpace; targetMat.roughnessMap.repeat.set(params.scale, params.scale); } }
        if (maps.metallic) { targetMat.metalnessMap = load(maps.metallic); if (targetMat.metalnessMap) { targetMat.metalnessMap.colorSpace = THREE.LinearSRGBColorSpace; targetMat.metalnessMap.repeat.set(params.scale, params.scale); } }
        if (maps.ao) { targetMat.aoMap = load(maps.ao); if (targetMat.aoMap) { targetMat.aoMap.colorSpace = THREE.LinearSRGBColorSpace; targetMat.aoMap.repeat.set(params.scale, params.scale); } }
        if (maps.height) { targetMat.displacementMap = load(maps.height); targetMat.displacementScale = params.displacementScale; if (targetMat.displacementMap) targetMat.displacementMap.repeat.set(params.scale, params.scale); }

        const emissiveActive = params.emissiveThreshold > 0.01;
        if (maps.emissive && emissiveActive) {
            targetMat.emissiveMap = load(maps.emissive);
            if (targetMat.emissiveMap) targetMat.emissiveMap.repeat.set(params.scale, params.scale);
            targetMat.emissive = new THREE.Color(0xffffff);
            targetMat.emissiveIntensity = 2.0;
        } else {
            targetMat.emissiveMap = null;
            targetMat.emissive = new THREE.Color(0x000000);
            targetMat.emissiveIntensity = 0.0;
        }
        targetMat.needsUpdate = true;
    }, [maps, activeMaterialId, params.emissiveThreshold, params.displacementScale, params.scale, sceneMaterials]);

    const generateMaps = useCallback(() => {
        if (!sourceImgObj) return;
        setLoading(true);
        setTimeout(() => {
            const newMaps = { ...maps }; // Keep existing overrides

            newMaps.base = processImage(sourceImgObj, decalImgObj, 'base', params);
            newMaps.normal = processImage(sourceImgObj, decalImgObj, 'normal', params);
            newMaps.roughness = processImage(sourceImgObj, decalImgObj, 'roughness', params);
            newMaps.metallic = processImage(sourceImgObj, decalImgObj, 'metallic', params);
            newMaps.ao = processImage(sourceImgObj, decalImgObj, 'ao', params);
            newMaps.height = processImage(sourceImgObj, decalImgObj, 'height', params);
            newMaps.emissive = processImage(sourceImgObj, decalImgObj, 'emissive', params);

            setMaps(newMaps);
            setLoading(false);
        }, 10);
    }, [sourceImgObj, decalImgObj, params]);

    // Handle map manual override
    const handleMapOverride = (type: string, e: any) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setMaps((prev: any) => ({ ...prev, [type]: ev.target?.result }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => { const t = setTimeout(() => { if (sourceImgObj) generateMaps(); }, 150); return () => clearTimeout(t); }, [generateMaps]);

    const applyPreset = (preset: any) => {
        // Reset to defaults first, then apply preset params
        // Preserve 'scale' and 'makeSeamless' as they are often global preferences
        const currentScale = params.scale;
        const currentSeamless = params.makeSeamless;

        setParams({
            ...DEFAULT_PARAMS,
            scale: currentScale,
            makeSeamless: currentSeamless,
            ...preset.params
        });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                if (ev.target?.result) {
                    const dataUrl = ev.target.result as string;

                    // If AI Bake mode is enabled, process immediately
                    if (aiBakeMode) {
                        await handleAIBake(dataUrl);
                        // Don't set sourceImage yet - handleAIBake will set the result
                    } else {
                        // Normal workflow
                        const img = new Image();
                        img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); };
                        img.src = dataUrl;
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDecalUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const img = new Image();
                    img.onload = () => { setDecalImgObj(img); setDecalImage(img.src as any); };
                    img.src = ev.target.result as string;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true);
        const b64 = await generateAITexture(aiPrompt);
        if (b64) {
            const img = new Image();
            img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); setIsGenerating(false); };
            img.src = b64;
        } else { setIsGenerating(false); }
    };

    const handleAIBake = async (imageDataUrl: string) => {
        if (!imageDataUrl) return;
        setIsBaking(true);
        console.log("🎨 AI Bake: Starting...");

        try {
            // Start Python if not already running
            await python.start().catch(() => { });

            console.log("🎨 AI Bake: Processing with Depth Anything V2...");

            let result: any;
            try {
                // Request paths, NOT full data (fast)
                result = await python.call('autopbr.bake_v3', { b64_data: imageDataUrl });
            } catch (err: any) {
                if (err.toString().includes('Method not found')) {
                    console.log("⚠️ Method not found (v3), initialising script...");
                    // Try reloading using explicit script name
                    await python.reloadScript('autopbr_bake').catch(() => { });
                    await new Promise(r => setTimeout(r, 200));
                    console.log("🔄 Retrying bake v3...");
                    result = await python.call('autopbr.bake_v3', { b64_data: imageDataUrl });
                } else {
                    throw err;
                }
            }

            if (result.status === 'success' && result.maps) {
                console.log("✅ AI Bake: Done! Fetching map data...");
                const newMaps = { ...maps };

                // Fetch each map individually to avoid IPC channel lockup
                const keys = Object.keys(result.maps);
                for (const key of keys) {
                    const localPath = result.maps[key];
                    try {
                        console.log(`📥 Fetching ${key}...`);
                        const data: any = await python.call('autopbr.get_b64', { path: localPath });
                        if (data && data.data) {
                            const b64 = data.data;
                            if (key === 'base') {
                                newMaps.base = b64;
                                // Set source image to the delighted result
                                const img = new Image();
                                img.onload = () => { setSourceImgObj(img); setSourceImage(img.src as any); };
                                img.src = b64;
                            }
                            if (key === 'normal') newMaps.normal = b64;
                            if (key === 'roughness') newMaps.roughness = b64;
                            if (key === 'ao') newMaps.ao = b64;
                            if (key === 'height') newMaps.height = b64;
                        }
                    } catch (e) {
                        console.error(`Failed to fetch ${key}:`, e);
                    }
                }

                setMaps(newMaps);
                console.log("✨ All maps applied!");
            } else {
                console.error("❌ AI Bake: Failed -", result.message || result);
            }
        } catch (e) {
            console.error("❌ AI Bake: Error -", e);
        } finally {
            setIsBaking(false);
        }
    };

    const handleSendToKernel = () => {
        if (!maps.base) return;
        if (onMaterialCommit) {
            const committedMaterial = onMaterialCommit(maps);
            if (committedMaterial?.id) {
                bindActiveSceneEntityMaterial(committedMaterial.id);
                setStatus(isToolOverlay
                    ? `MATERIAL STORED -> ${(activeSceneTarget?.name ?? sharedState?.activeLayer?.name ?? sharedState?.activeEntity?.name ?? 'ACTIVE TARGET').toUpperCase()}`
                    : 'MATERIAL STORED');
            }
        }
    };

    // UPLINK: Save Modified 3D Object to Kernel
    const handleArtifactUplink = () => {
        if (!meshRef.current) return;
        const exporter = new GLTFExporter();
        exporter.parse(meshRef.current, (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            if (onCommit) onCommit(blob, "K-AUTOPBR_UPLINK");
        }, (err) => console.error(err), { binary: true, embedImages: true });
    };

    // UPLINK: Extract Material from current object into Editor
    const handleExtractFromMesh = () => {
        if (isToolOverlay) {
            const source = readMaterialBaseSource(sharedState?.activeMaterial);
            if (!source) return;
            const newImg = new Image();
            newImg.onload = () => {
                setSourceImgObj(newImg);
                setSourceImage(source as any);
            };
            newImg.src = source;
            return;
        }

        if (!activeMaterialId) return;
        const mat = sceneMaterials.find(m => m.uuid === activeMaterialId);
        if (mat && mat.map && mat.map.image) {
            const img = mat.map.image;
            // Create a canvas to extract data
            const canvas = document.createElement('canvas');
            canvas.width = img.width || 1024;
            canvas.height = img.height || 1024;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL();
                const newImg = new Image();
                newImg.onload = () => {
                    setSourceImgObj(newImg);
                    setSourceImage(dataUrl);
                };
                newImg.src = dataUrl;
            }
        }
    };

    const loadMaterialFromLibrary = (mat) => {
        const img = new Image();
        img.src = mat.base;
        img.onload = () => {
            setSourceImgObj(img);
            setSourceImage(img.src as any);
        };
    };

    const resetTargetMaterial = () => {
        if (isToolOverlay) {
            bindActiveSceneEntityMaterial(null);
            setStatus('TARGET MATERIAL CLEARED');
            return;
        }

        if (!activeMaterialId) return;
        const targetMat = sceneMaterials.find(m => m.uuid === activeMaterialId);
        if (targetMat) {
            targetMat.map = null; targetMat.normalMap = null; targetMat.roughnessMap = null;
            targetMat.metalnessMap = null; targetMat.aoMap = null; targetMat.displacementMap = null;
            targetMat.emissiveMap = null; targetMat.color.setHex(0x888888);
            targetMat.needsUpdate = true;
        }
    };

    const handlePointerDown = (e) => { isDragging.current = true; previousMousePosition.current = { x: e.clientX, y: e.clientY }; if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'; };
    const handlePointerMove = (e) => { if (!isDragging.current || !meshRef.current) return; const delta = { x: e.clientX - previousMousePosition.current.x, y: e.clientY - previousMousePosition.current.y }; meshRef.current.rotation.y += delta.x * 0.005; meshRef.current.rotation.x += delta.y * 0.005; previousMousePosition.current = { x: e.clientX, y: e.clientY }; };
    const handlePointerUp = () => { isDragging.current = false; if (canvasRef.current) canvasRef.current.style.cursor = 'grab'; };
    const handleWheel = (e) => { e.preventDefault(); if (!cameraRef.current) return; const zoomSpeed = 0.001; const newZ = cameraRef.current.position.z + e.deltaY * zoomSpeed; cameraRef.current.position.z = Math.min(Math.max(newZ, 1.5), 10); };

    const exportGLB = () => {
        if (!meshRef.current) return;
        const exporter = new GLTFExporter();
        exporter.parse(meshRef.current, (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none'; link.href = url; link.download = 'Kipp_Flux_Asset.glb';
            document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        }, (err) => console.error(err), { binary: true, embedImages: true });
    };

    const handleReset = () => {
        setSourceImage(null);
        setSourceImgObj(null);
        setDecalImage(null);
        setDecalImgObj(null);
        setMaps({ base: null, normal: null, roughness: null, metallic: null, ao: null, height: null, emissive: null });
        setAiPrompt("");
        setViewShape('sphere');
    };

    const downloadMap = (dataUrl, name) => {
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.download = `K_${name}.png`; link.href = dataUrl; link.style.display = 'none';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const downloadAll = () => { Object.keys(maps).filter(k => maps[k]).forEach((k, i) => setTimeout(() => downloadMap(maps[k], k), i * 800)); };

    return (
        <div className={`h-screen text-gray-300 font-mono overflow-hidden flex flex-col select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>
            {!isViewportHost && (
            <header className={`${isToolOverlay
                ? 'ml-auto w-full lg:w-[35%] bg-black/70 backdrop-blur-xl border-l border-b border-white/10 shadow-2xl'
                : 'bg-[#0a0a0a] border-b border-[#222] shadow-xl'
                } p-3 z-50 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                <div className="flex justify-between items-center max-w-full">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-900/20 border border-blue-500/30 p-2 rounded text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                                K-SAMPLE <span className="text-[9px] bg-blue-900/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">0.5 ALPHA</span>
                            </h1>
                            {isToolOverlay && (
                                <p className="text-[9px] uppercase tracking-[0.18em] text-blue-300/80 mt-1">
                                    {sharedState?.activeLayer?.name
                                        ?? sharedState?.activeEntity?.name
                                        ?? sharedState?.activeMaterial?.name
                                        ?? 'Shared Viewport Target'}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-[#111] p-1.5 rounded-lg border border-[#222]">
                        <button
                            onClick={() => setAiBakeMode(!aiBakeMode)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-[10px] transition-all border ${aiBakeMode
                                ? 'bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/50 text-purple-300'
                                : 'bg-[#1a1a1a] hover:bg-[#222] border-[#333] text-gray-400 hover:text-white'
                                }`}
                            title="Toggle AI Bake Mode: Upload images and auto-generate PBR maps using Depth Anything V2"
                        >
                            <Sparkles size={12} className={aiBakeMode ? 'animate-pulse' : ''} />
                            {aiBakeMode ? 'AI BAKE: ON' : 'AI BAKE: OFF'}
                        </button>
                        <label className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer font-bold text-[10px] transition-all border ${isBaking ? 'opacity-50 cursor-not-allowed' : 'bg-[#1a1a1a] hover:bg-[#222] border-[#333] text-gray-300 hover:text-white'
                            }`}>
                            {isBaking ? <Loader2 className="animate-spin" size={12} /> : <UploadCloud size={12} />}
                            <span>{isBaking ? 'BAKING...' : 'UPLOAD SOURCE'}</span>
                            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={isBaking} />
                        </label>
                        <div className="w-px h-6 bg-[#333]"></div>
                        <div className="flex items-center gap-2 group">
                            <div className="relative"><Wand2 size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-500" /><input type="text" placeholder="Generate texture..." className="bg-[#050505] border border-[#333] text-gray-400 text-[10px] rounded pl-7 pr-2 py-1.5 w-48 focus:border-blue-500 focus:text-white transition-all outline-none" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()} /></div>
                            <button onClick={handleAiGenerate} disabled={isGenerating || !aiPrompt} className="bg-[#1a1a1a] hover:bg-blue-900/30 text-gray-400 hover:text-blue-400 border border-[#333] hover:border-blue-500/50 p-1.5 rounded transition-all disabled:opacity-50">{isGenerating ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}</button>
                        </div>
                        <div className="w-px h-6 bg-[#333]"></div>
                        <button onClick={handleReset} title="Reset Material" className="bg-[#1a1a1a] hover:bg-red-900/20 text-gray-400 hover:text-red-400 border border-[#333] hover:border-red-500/30 p-1.5 rounded transition-all"><RotateCcw size={12} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isToolOverlay && (
                            <div className="flex bg-[#111] rounded border border-[#222] p-0.5 mr-2">
                                <button onClick={() => setViewShape('sphere')} className={`p-1.5 rounded ${viewShape === 'sphere' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-white'}`} title="Sphere View"><Globe size={14} /></button>
                                <button onClick={() => setViewShape('cube')} className={`p-1.5 rounded ${viewShape === 'cube' ? 'bg-blue-900/30 text-blue-400' : 'text-gray-500 hover:text-white'}`} title="Cube View"><Cuboid size={14} /></button>
                                {sharedState?.artifact && (<button onClick={() => setViewShape('artifact')} className={`p-1.5 rounded ${viewShape === 'artifact' ? 'bg-purple-900/30 text-purple-400' : 'text-gray-500 hover:text-white'}`} title="Artifact View"><Package size={14} /></button>)}
                            </div>
                        )}

                        {/* UPLINK ACTIONS */}
                        <button onClick={handleSendToKernel} disabled={!sourceImage} className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#222] text-gray-300 hover:text-white border border-[#333] px-3 py-1.5 rounded font-bold text-[10px] transition"><Share2 size={12} /> SAVE MATERIAL</button>
                        {!isToolOverlay && viewShape === 'artifact' && (
                            <button onClick={handleArtifactUplink} className="flex items-center gap-2 bg-purple-900/20 hover:bg-purple-900/40 text-purple-400 border border-purple-900/50 px-3 py-1.5 rounded font-bold text-[10px] transition"><UploadCloud size={12} /> UPLINK MESH</button>
                        )}

                        {!isToolOverlay && (
                            <button onClick={exportGLB} disabled={!sourceImage} className="flex items-center gap-2 bg-[#1a1a1a] hover:bg-[#222] text-gray-300 hover:text-white border border-[#333] px-3 py-1.5 rounded font-bold text-[10px] transition"><Box size={12} /> EXPORT</button>
                        )}
                    </div>
                </div>
            </header>
            )}

            <main className="flex-1 flex overflow-hidden">
                {!isToolOverlay ? (
                    <div className="flex-1 relative flex flex-col bg-[#050505] min-w-0">
                        <div className="flex-1 relative group" style={{ cursor: 'grab' }}>
                            <canvas ref={canvasRef} className="w-full h-full block outline-none touch-none relative z-10" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel} />
                            {!sourceImage && viewShape !== 'artifact' && (<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-gray-700 z-0"><Globe size={64} className="mb-4 opacity-20" /><p className="text-xl font-bold tracking-widest uppercase opacity-20">KIPP ENGINE IDLE</p></div>)}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 pointer-events-none bg-transparent" />
                )}

                {!isViewportHost && (
                    <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                        <KAutopbrUI
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            sceneTargets={visibleSceneTargets}
                            activeSceneTargetId={resolvedActiveSceneTargetId}
                            setActiveSceneTargetId={handleSelectSceneTarget}
                            resetTargetMaterial={resetTargetMaterial}
                            sharedState={sharedState}
                            loadMaterialFromLibrary={loadMaterialFromLibrary}
                            sourceImage={sourceImage}
                        setSourceImage={setSourceImage}
                        params={params}
                        setParams={setParams}
                        applyPreset={applyPreset}
                        maps={maps}
                        downloadMap={downloadMap}
                        downloadAll={downloadAll}
                        decalImage={decalImage}
                        handleDecalUpload={handleDecalUpload}
                        lighting={lighting}
                        setLighting={setLighting}
                        handleMapOverride={handleMapOverride}
                        handleExtractFromMesh={handleExtractFromMesh}
                        viewShape={viewShape}
                        envMode={envMode}
                        materialMode={materialMode}
                        setMaterialMode={setMaterialMode}
                        onEnvChange={handleEnvironmentChange}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};
