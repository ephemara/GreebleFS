import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import {
    Share2, Activity,
    Undo, Redo, Download,
    MousePointer2, Maximize2, Minimize2, Grid3X3, Layers, Trash2,
    Eye, EyeOff, Plus, FileDown, FolderOpen, ArrowDownToLine,
    Split, Scan,
    Hammer, Move
} from 'lucide-react';

// Patch Three.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
import KSculptUI from './KSculptUI';
import KSculptRightPanel from './KSculptRightPanel';
import KTopBar from '../../../core/ui/KPanelV2/KTopBar';
import KSculptBrushMenu from './KSculptBrushMenu';
import KSculptAlphaMenu from './KSculptAlphaMenu';
import KSculptSpaceMenu from './KSculptSpaceMenu';
import { useKSculptKeybinds } from './useKSculptKeybinds';
import { getMatCapPresetIndex, MATCAPS } from './KSculptMatCaps';
import { MeshTopology, applyBrushRust, rustSculptManager } from './KSculptOptimization';
import { rustRaycastManager } from '../../../services/raycastClient';
import { rustSubdivide } from '../../../services/subdivideClient';
import { leashClient } from '../../../services/leashClient';
import { gpuBrushCursor } from './KSculptCursor';
import { AdaptiveInfiniteGrid } from '../../../core/three/AdaptiveInfiniteGrid';
import {
    readZenClonerOperatorSession,
    readZenGreebleOperatorSession,
    readZenScatterOperatorSession,
    resolveZenViewportPointerPolicy,
    ZenClonerOperatorSession,
    ZenGreebleOperatorSession,
    ZenScatterOperatorSession,
    useZenModuleBridge,
    useZenSharedControls,
    useZenWorkspaceStore,
    ZEN_COMPONENT_KEYS,
    UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
    UNIVERSAL_VIEWPORT_BACKGROUND_IMAGE
} from '../../../core/zen';
import {
    coerceTectonLandscapeConfig,
    createTectonLandscapeGeometry,
    TECTON_LANDSCAPE_BOOTSTRAP_LAYER_NAMES,
    TECTON_LANDSCAPE_LAYER_ID,
    TECTON_LANDSCAPE_LAYER_NAME
} from '../../sim/tecton/tectonLandscape';
import {
    CHRONO_QUANTUM_FIELD_BOOTSTRAP_LAYER_NAMES,
    CHRONO_QUANTUM_FIELD_LAYER_ID,
    CHRONO_QUANTUM_FIELD_LAYER_NAME,
    coerceChronoQuantumState,
    createChronoQuantumFieldGeometry,
    isChronoQuantumArtifactSource,
    isChronoQuantumModuleId,
    readChronoQuantumModuleState
} from '../../sim/chronoquantum/chronoQuantumShared';

const MAX_HISTORY = 15;
const HOVER_COLOR = 0x3daee9;
const MIN_LAYER_SCALE = 0.001;
const GREEBLE_ECHO_OFFSETS = [
    new THREE.Vector3(0.28, 0.1, 0),
    new THREE.Vector3(-0.24, 0.12, 0.18),
    new THREE.Vector3(0.16, -0.08, -0.22),
    new THREE.Vector3(-0.12, -0.04, 0.24)
];

type KernelLikeMaterial = {
    id?: string | null;
    base?: string | null;
    normal?: string | null;
    roughness?: string | null;
    metallic?: string | null;
    ao?: string | null;
    height?: string | null;
    emissive?: string | null;
};

const sanitizeOperatorKey = (value: string): string =>
    value.replace(/[^a-zA-Z0-9:_-]+/g, '_');

const createSculptEntityId = (layerId: string): string =>
    `sculpt:entity:${sanitizeOperatorKey(layerId)}`;

const createOperatorResultLayerId = (operatorId: 'scatter' | 'cloner', subjectLayerId: string): string =>
    `${operatorId}:operator:${sanitizeOperatorKey(subjectLayerId)}`;

const isOperatorResultLayerId = (layerId: string | null): boolean =>
    Boolean(layerId && (layerId.startsWith('scatter:operator:') || layerId.startsWith('cloner:operator:')));

const resolveKernelMaterialRecord = (material: any): KernelLikeMaterial | null => {
    if (!material || typeof material !== 'object') {
        return null;
    }

    if ('channels' in material && material.channels && typeof material.channels === 'object') {
        return {
            id: typeof material.id === 'string' ? material.id : null,
            base: material.channels.base ?? null,
            normal: material.channels.normal ?? null,
            roughness: material.channels.roughness ?? null,
            metallic: material.channels.metallic ?? null,
            ao: material.channels.ao ?? null,
            height: material.channels.height ?? null,
            emissive: material.channels.emissive ?? null
        };
    }

    return material as KernelLikeMaterial;
};

const createSculptTransformComponent = (mesh: THREE.Mesh) => ({
    position: [mesh.position.x, mesh.position.y, mesh.position.z] as [number, number, number],
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z] as [number, number, number],
    scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z] as [number, number, number]
});

const orientMeshToSurfaceNormal = (
    mesh: THREE.Mesh,
    normal: THREE.Vector3,
    voidAnchor: boolean
) => {
    const safeNormal = normal.clone().normalize();
    const up = voidAnchor ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, safeNormal);
    mesh.quaternion.copy(quaternion);
};

const createGreebleGeometry = (shape: string): THREE.BufferGeometry => {
    switch (shape?.toLowerCase()) {
        case 'sphere':
            return new THREE.IcosahedronGeometry(0.18, 2);
        case 'cylinder':
        case 'pipe':
        case 'pillar':
        case 'tower':
            return new THREE.CylinderGeometry(0.08, 0.12, 0.42, 18);
        case 'cone':
        case 'spike':
        case 'pyramid':
            return new THREE.ConeGeometry(0.18, 0.42, shape?.toLowerCase() === 'pyramid' ? 4 : 12);
        case 'torus':
        case 'ring':
        case 'gear':
            return new THREE.TorusGeometry(0.22, 0.05, 10, 20);
        case 'capsule':
            return new THREE.CapsuleGeometry(0.1, 0.28, 6, 12);
        case 'icosa':
        case 'crystal':
        case 'fractal':
            return new THREE.IcosahedronGeometry(0.2, 1);
        case 'wall':
            return new THREE.BoxGeometry(0.42, 0.22, 0.08);
        case 'platform':
            return new THREE.BoxGeometry(0.36, 0.06, 0.36);
        case 'arc':
            return new THREE.TorusGeometry(0.26, 0.04, 8, 16, Math.PI);
        case 'tentacle':
        case 'spine':
        case 'chain':
            return new THREE.CylinderGeometry(0.05, 0.08, 0.5, 8);
        case 'flora':
            return new THREE.ConeGeometry(0.14, 0.38, 7);
        case 'ruins':
        case 'city':
        case 'struct':
            return new THREE.BoxGeometry(0.28, 0.34, 0.24);
        case 'greeble':
        default:
            return new THREE.BoxGeometry(0.22, 0.18, 0.26, 2, 2, 2);
    }
};

const createScatterPrimitiveGeometry = (primitive: string): THREE.BufferGeometry => {
    switch (primitive?.toUpperCase()) {
        case 'SPHERE':
            return new THREE.IcosahedronGeometry(0.14, 1);
        case 'CYLINDER':
            return new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10);
        case 'PYRAMID':
            return new THREE.ConeGeometry(0.12, 0.28, 4);
        case 'PLATE':
            return new THREE.BoxGeometry(0.3, 0.04, 0.3);
        case 'CUBE':
        default:
            return new THREE.BoxGeometry(0.2, 0.2, 0.2);
    }
};

const getArtifactMountKey = (artifactId: string | null, artifactBlob: Blob | null): string | null =>
    artifactId && artifactBlob
        ? `${artifactId}:${artifactBlob.size}:${artifactBlob.type}`
        : null;

interface SculptLayer {
    id: string;
    name: string;
    mesh: THREE.Mesh;
    visible: boolean;
    polyCount: number;
    materialId?: string; // ID of Kernel Material if assigned
}

export default function KSculpt({ sharedState, onCommit, onAlphaCommit, performance, zenShellMode = 'standalone' }: any) {
    const { connectViewport, publishLayers, publishState, publishSelection } = useZenModuleBridge('sculpt');
    const zenWorkspaceDocument = useZenWorkspaceStore((state) => state.document);
    const upsertSceneEntity = useZenWorkspaceStore((state) => state.upsertSceneEntity);
    const removeSceneEntity = useZenWorkspaceStore((state) => state.removeSceneEntity);
    const bindSceneEntityMaterial = useZenWorkspaceStore((state) => state.bindSceneEntityMaterial);
    const {
        gizmoMode,
        transformSpace,
        snapEnabled,
        orbitModifierActive,
        setGizmoMode,
        setTransformSpace,
        setSnapEnabled
    } = useZenSharedControls();
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';

    // --- UI STATE ---
    const [mode, setMode] = useState<'SCULPT' | 'TRANSFORM'>('SCULPT');
    const [activeTab, setActiveTab] = useState<'BRUSH' | 'GEO' | 'PRIMS' | 'DATA'>('BRUSH');
    const [activeTool, setActiveTool] = useState('CLAY');
    const [radius, setRadius] = useState(0.5);
    const [intensity, setIntensity] = useState(0.5);
    const [wireframe, setWireframe] = useState(false);
    const [symmetry, setSymmetry] = useState<'NONE' | 'X'>('X');
    const [status, setStatus] = useState("KIPP SCULPT ENGINE");
    const [activeColor, setActiveColor] = useState('#ffffff');
    const [brushMode, setBrushMode] = useState<'ADD' | 'SUB'>('ADD');

    // Dynamic Topology State
    const [dynamicTopology, setDynamicTopology] = useState(false);
    const [detailSize, setDetailSize] = useState(0.5);
    const bootstrappedKernelSceneRef = useRef(false);
    const mountedSharedArtifactRef = useRef<{ id: string | null; key: string | null }>({
        id: null,
        key: null
    });

    // BEVY INTEGRATION
    const [isBevyActive, setIsBevyActive] = useState(false); // Make React transparent

    const orbitRef = useRef<any>(null); // For tracking camera delta
    const lastRot = useRef<{ x: number, y: number }>({ x: 0, y: 0 }); // Track last rotation for delta

    // Menus
    const [isBrushMenuOpen, setIsBrushMenuOpen] = useState(false);
    const [isAlphaMenuOpen, setIsAlphaMenuOpen] = useState(false);

    // Space Menu State
    const [isSpaceMenuOpen, setIsSpaceMenuOpen] = useState(false);
    const [isSpaceMenuLocked, setIsSpaceMenuLocked] = useState(false);
    const [isBrushMenuLocked, setIsBrushMenuLocked] = useState(false);
    const [spaceMenuPos, setSpaceMenuPos] = useState({ x: 0, y: 0 });

    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const mousePosRef = useRef({ x: 0, y: 0 });

    // Track mouse for menu position
    const handleGlobalMouseMove = (e: MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    useEffect(() => {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
    }, []);

    // Layer System
    const [layers, setLayers] = useState<SculptLayer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());
    const greebleOperatorSession = readZenGreebleOperatorSession(
        zenWorkspaceDocument.moduleState.greeble as Record<string, unknown> | undefined
    );
    const scatterOperatorSession = readZenScatterOperatorSession(
        zenWorkspaceDocument.moduleState.scatter as Record<string, unknown> | undefined
    );
    const clonerOperatorSession = readZenClonerOperatorSession(
        zenWorkspaceDocument.moduleState.cloner as Record<string, unknown> | undefined
    );
    const tectonLandscapeConfig = coerceTectonLandscapeConfig(
        zenWorkspaceDocument.moduleState.tecton as Record<string, unknown> | undefined
    );
    const chronoQuantumState = coerceChronoQuantumState(
        readChronoQuantumModuleState(zenWorkspaceDocument.moduleState)
    );
    const activeViewportPointerPolicy = resolveZenViewportPointerPolicy(zenWorkspaceDocument.activeModuleId);
    const usesToolPrimaryAltOrbit = activeViewportPointerPolicy === 'tool-primary-alt-orbit'
        && (zenWorkspaceDocument.activeModuleId !== 'greeble' || greebleOperatorSession.altOrbit);
    const usesPassiveOverlayPointerPolicy = activeViewportPointerPolicy === 'passive-overlay';
    const activeWorkspaceAssetId = zenWorkspaceDocument.activeAssetId;
    const activeKernelArtifactRecord = sharedState?.storage?.find(
        (item: any) => item.id === activeWorkspaceAssetId
    ) ?? null;
    const isChronoQuantumActive = isChronoQuantumModuleId(zenWorkspaceDocument.activeModuleId);
    const shouldBypassSharedArtifactForTecton = zenWorkspaceDocument.activeModuleId === 'tecton'
        && activeKernelArtifactRecord?.source !== 'K-TECTON';
    const shouldBypassSharedArtifactForChronoQuantum = isChronoQuantumActive
        && !isChronoQuantumArtifactSource(activeKernelArtifactRecord?.source);
    const operatorSignatureRef = useRef<{ scatter: string | null; cloner: string | null }>({
        scatter: null,
        cloner: null
    });

    useEffect(() => {
        publishLayers(layers.map((layer, index) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            order: index,
            tags: layer.materialId ? ['material-linked'] : []
        })));
    }, [layers, publishLayers]);

    useEffect(() => {
        publishState({
            activeLayerId,
            selectedLayerIds: Array.from(selectedLayerIds),
            status,
            mode
        });
    }, [activeLayerId, mode, publishState, selectedLayerIds, status]);

    useEffect(() => {
        const shouldBypassSharedArtifactSelection = shouldBypassSharedArtifactForTecton
            || shouldBypassSharedArtifactForChronoQuantum;
        const selectionAssetId = shouldBypassSharedArtifactSelection
            ? null
            : ((sharedState?.activeArtifactId || !activeLayerId)
                ? sharedState?.activeArtifactId ?? null
                : undefined);

        publishSelection({
            ...(selectionAssetId === undefined ? {} : { activeAssetId: selectionAssetId }),
            activeEntityId: activeLayerId ? createSculptEntityId(activeLayerId) : null,
            activeLayerId
        });
    }, [
        activeLayerId,
        publishSelection,
        sharedState?.activeArtifactId,
        shouldBypassSharedArtifactForChronoQuantum,
        shouldBypassSharedArtifactForTecton
    ]);

    // Material / Alpha
    const [materialMode, setMaterialMode] = useState<'CLAY' | 'PBR'>('PBR');
    const [activeMaterial, setActiveMaterial] = useState<any>(null);
    const [activeAlpha, setActiveAlpha] = useState<THREE.Texture | null>(null); // For Brush Alpha
    const [currentMatCap, setCurrentMatCap] = useState<string>(MATCAPS.ICE);
    const [showGrid, setShowGrid] = useState(true);

    // Computed values for UI
    const activePolyCount = layers.find(l => l.id === activeLayerId)?.polyCount || 0;
    const [subdivisionLevel, setSubdivisionLevel] = useState(0);
    const [extractionThickness, setExtractionThickness] = useState(0.01);

    // Transform State
    const [transformData, setTransformData] = useState({
        posX: 0, posY: 0, posZ: 0,
        rotX: 0, rotY: 0, rotZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1
    });

    const mountRef = useRef<HTMLDivElement>(null);
    const viewportGridRef = useRef<AdaptiveInfiniteGrid | null>(null);

    // --- INPUT TICK LOOP ---
    useEffect(() => {
        sceneRef.current.tick = () => {
            const { camera, raycaster, meshes, brushCursor, symmetryCursor, isSculpting, moveData, settings } = sceneRef.current;
            if (!camera || !mountRef.current) return;

            const { activeTool, radius, symmetry, mode, activeLayerId } = settings;

            // 1. Calc NDC
            // We use the last known mouse pos from the ref
            const rect = mountRef.current.getBoundingClientRect();
            // Check if mouse is roughly inside? Logic might run globally if dragging.

            const mx = mousePosRef.current.x;
            const my = mousePosRef.current.y;

            const x = ((mx - rect.left) / rect.width) * 2 - 1;
            const y = -((my - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera({ x, y }, camera);

            // --- LEASH IPC: SYNC WITH BEVY ---
            invoke('leash_cursor', { x, y }).catch(() => { });


            if (mode === 'SCULPT') {
                if (activeTool === 'SELECT') {
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;
                    document.body.style.cursor = 'pointer';
                    return;
                }

                if (!activeLayerId || !meshes.has(activeLayerId)) return;
                const mesh = meshes.get(activeLayerId);

                // === RUST RAYCAST (fast cached async) ===
                // Fire async raycast request (throttled internally)
                const rayOrigin = raycaster.ray.origin;
                const rayDir = raycaster.ray.direction;
                rustRaycastManager.requestRaycast(mesh, rayOrigin, rayDir, 1000);

                // Get cached result for instant 60fps response
                const cachedHit = rustRaycastManager.getCachedHit();

                // During active sculpting, we need super-fresh hits, so fallback to JS briefly
                // Otherwise use the fast Rust cached result
                let hitPoint: THREE.Vector3 | null = null;
                let hitNormal: THREE.Vector3 | null = null;
                let hasHit = false;

                if (cachedHit) {
                    // Use Rust cached result (FAST)
                    hitPoint = new THREE.Vector3(cachedHit.point.x, cachedHit.point.y, cachedHit.point.z);
                    hitNormal = new THREE.Vector3(cachedHit.normal.x, cachedHit.normal.y, cachedHit.normal.z);
                    hasHit = true;
                } else if (isSculpting) {
                    // Fallback to JS only during active sculpting when cache is stale
                    // This ensures no lag when you first click
                    const intersects = raycaster.intersectObject(mesh);
                    if (intersects.length > 0) {
                        hitPoint = intersects[0].point;
                        hitNormal = intersects[0].face?.normal || new THREE.Vector3(0, 1, 0);
                        hasHit = true;
                    }
                }

                if (hasHit && hitPoint && hitNormal) {
                    // GPU Brush Cursor - no 3D geometry, just shader projection!
                    gpuBrushCursor.update({ point: hitPoint, face: { normal: hitNormal } } as any, radius, symmetry);
                    sceneRef.current.hoverPoint = hitPoint;
                    sceneRef.current.hoverNormal = hitNormal;

                    // Hide old 3D cursors (legacy)
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;

                    if (isSculpting && activeTool !== 'MOVE' && activeTool !== 'STRETCH') {
                        // Only apply JS sculpting if Bevy is NOT active
                        if (!isBevyActive) {
                            applyBrush(hitPoint, hitNormal);
                        }

                        // --- LEASH IPC: SEND BRUSH STROKE TO BEVY ---
                        const toolMap: Record<string, number> = {
                            'CLAY': 0, 'SMOOTH': 1, 'FLATTEN': 2,
                            'GRAB': 3, 'MOVE': 4, 'SNAKE': 5
                        };
                        const toolId = toolMap[activeTool] ?? 0;

                        // Compute Delta (NDC)
                        const lastX = sceneRef.current.lastNdcX ?? x;
                        const lastY = sceneRef.current.lastNdcY ?? y;
                        const dx = x - lastX;
                        const dy = y - lastY;

                        // Send
                        invoke('leash_brush', { tool: toolId, radius, intensity, x, y, dx, dy }).catch(() => { });

                        // Update last
                        sceneRef.current.lastNdcX = x;
                        sceneRef.current.lastNdcY = y;
                    }

                } else if (!isSculpting) {
                    gpuBrushCursor.hide();
                    if (brushCursor) brushCursor.visible = false;
                    if (symmetryCursor) symmetryCursor.visible = false;
                    sceneRef.current.hoverPoint = null;
                }

                // --- MOVE & STRETCH DRAG LOGIC ---
                // Reuse existing move logic but ensure it runs here
                if (isSculpting && (activeTool === 'MOVE' || activeTool === 'STRETCH') && moveData) {
                    if (activeTool === 'STRETCH') {
                        const dy = (my - moveData.dragStartMouse.y);
                        const stretchFactor = dy * 0.01;
                        const worldDelta = moveData.grabNormal.clone().multiplyScalar(-stretchFactor);

                        const invMat = mesh.matrixWorld.clone();
                        if (Math.abs(invMat.determinant()) > 1e-9) {
                            invMat.invert();
                            const localDelta = worldDelta.clone().transformDirection(invMat);
                            const posAttr = mesh.geometry.attributes.position;
                            for (let i = 0; i < moveData.indices.length; i++) {
                                const idx = moveData.indices[i];
                                const w = moveData.weights[i];
                                const orig = moveData.initialPos[i];
                                const moveVec = localDelta.clone().multiplyScalar(w);
                                posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                            }
                            // Symmetry
                            if (symmetry === 'X' && moveData.symIndices) {
                                const symDelta = localDelta.clone(); symDelta.x *= -1;
                                for (let i = 0; i < moveData.symIndices.length; i++) {
                                    const idx = moveData.symIndices[i];
                                    const w = moveData.symWeights[i];
                                    const orig = moveData.symInitialPos[i];
                                    const moveVec = symDelta.clone().multiplyScalar(w);
                                    posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                }
                            }
                            posAttr.needsUpdate = true;
                        }
                    } else {
                        // MOVE
                        const targetPoint = new THREE.Vector3();
                        raycaster.ray.intersectPlane(moveData.screenPlane, targetPoint);
                        if (targetPoint) {
                            const invMat = mesh.matrixWorld.clone();
                            if (Math.abs(invMat.determinant()) > 1e-9) {
                                invMat.invert();
                                const localTarget = targetPoint.clone().applyMatrix4(invMat);
                                const localGrab = moveData.grabPoint.clone().applyMatrix4(invMat);
                                const delta = localTarget.sub(localGrab);

                                const posAttr = mesh.geometry.attributes.position;
                                for (let i = 0; i < moveData.indices.length; i++) {
                                    const idx = moveData.indices[i];
                                    const w = moveData.weights[i];
                                    const orig = moveData.initialPos[i];
                                    const moveVec = delta.clone().multiplyScalar(w);
                                    posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                }
                                if (symmetry === 'X' && moveData.symIndices) {
                                    const symDelta = delta.clone(); symDelta.x *= -1;
                                    for (let i = 0; i < moveData.symIndices.length; i++) {
                                        const idx = moveData.symIndices[i];
                                        const w = moveData.symWeights[i];
                                        const orig = moveData.symInitialPos[i];
                                        const moveVec = symDelta.clone().multiplyScalar(w);
                                        posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                    }
                                }
                                posAttr.needsUpdate = true;
                            }
                        }
                    }
                    if (sceneRef.current.topology) {
                        // Deferred normal update? Or immediate? Immediate for visual feedback is fine in animate loop.
                        mesh.geometry.computeVertexNormals();
                        // Note: moveData logic recomputes normals every frame. Expensive? 
                        // Move brush affects many verts? Usually radius based. O(N_modified). OK.
                    } else {
                        mesh.geometry.computeVertexNormals();
                    }
                }
            } else {
                // Not in sculpt mode logic (Transform mode handled by controls)
            }
        };
    }, []); // Run once


    const sceneRef = useRef<any>({
        scene: null, camera: null, renderer: null, controls: null,
        transformControl: null, raycaster: new THREE.Raycaster(),
        brushCursor: null, symmetryCursor: null,
        isSculpting: false, hoverPoint: null, hoverNormal: null,
        sculptHistory: [], historyIndex: -1, moveData: null,
        meshes: new Map<string, THREE.Mesh>(), // Map ID to Mesh for fast access
        selectionBox: null,
        topology: null, // Optimization
        isBrushBusy: false, // Throttle: prevents overlapping brush calls
        lastBrushTime: 0,   // Throttle: min 16ms between calls (~60fps max)
        tick: null as (() => void) | null,
        settings: {
            activeTool: 'CLAY',
            radius: 0.5,
            intensity: 0.5,
            symmetry: 'X',
            mode: 'SCULPT',
            activeLayerId: null as string | null,
            activeMaterial: null as any,
            brushMode: 'ADD' as 'ADD' | 'SUB',
            activeAlpha: null as THREE.Texture | null,
            dynamicTopology: false,
            detailSize: 0.5,
            activeColor: '#ffffff'
        }
    });

    // --- STATE SYNC ---
    // Sync React state to Ref for the Animation Loop to access without closures
    useEffect(() => {
        const s = sceneRef.current.settings;
        s.activeTool = activeTool;
        s.radius = radius;
        s.intensity = intensity;
        s.symmetry = symmetry;
        s.mode = mode;
        s.activeLayerId = activeLayerId;
        s.activeMaterial = activeMaterial;
        s.brushMode = brushMode;
        s.activeAlpha = activeAlpha;
        s.dynamicTopology = dynamicTopology;
        s.detailSize = detailSize;
        s.activeColor = activeColor;
    }, [activeTool, radius, intensity, symmetry, mode, activeLayerId, activeMaterial, brushMode, activeAlpha, dynamicTopology, detailSize, activeColor]);

    // --- GRID HELPER ---
    useEffect(() => {
        viewportGridRef.current?.setVisible(showGrid);
    }, [showGrid]);

    // Mouse tracking for menus
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // --- INIT ENGINE ---
    useEffect(() => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        const scene = new THREE.Scene();
        scene.background = null; // Allow CSS gradient to show through
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(0, 0, 4);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        // renderer.shadowMap.enabled = true; // MatCaps don't need shadows usually, but we can keep for PBR mode
        // renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // Minimal Lights for PBR mode fallback, MatCaps ignore this
        const ambient = new THREE.AmbientLight(0xffffff, 0.5); scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1); dirLight.position.set(5, 10, 7); scene.add(dirLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;
        const disconnectZenViewport = connectViewport({
            element: mountRef.current,
            scene,
            camera,
            controls,
            renderer
        });

        // Track Rotation
        lastRot.current = { x: camera.rotation.x, y: camera.rotation.y };
        controls.addEventListener('change', () => {
            // Calculate Delta
            const rotX = camera.rotation.x;
            const rotY = camera.rotation.y;

            const dx = rotY - lastRot.current.y; // Yaw (around Y)
            const dy = rotX - lastRot.current.x; // Pitch (around X)

            if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
                leashClient.cameraRotate(dx, dy, 'sculpt');
            }

            lastRot.current = { x: rotX, y: rotY };
        });
        orbitRef.current = controls;

        const transformControl = new TransformControls(camera, renderer.domElement);
        transformControl.addEventListener('dragging-changed', (event) => { controls.enabled = !event.value; });
        transformControl.addEventListener('change', () => {
            const r = sceneRef.current;
            const activeSceneLayerId = r.settings.activeLayerId;
            if (activeSceneLayerId && r.meshes.has(activeSceneLayerId)) {
                const m = r.meshes.get(activeSceneLayerId);
                if (Math.abs(m.scale.x) < MIN_LAYER_SCALE) m.scale.x = MIN_LAYER_SCALE;
                if (Math.abs(m.scale.y) < MIN_LAYER_SCALE) m.scale.y = MIN_LAYER_SCALE;
                if (Math.abs(m.scale.z) < MIN_LAYER_SCALE) m.scale.z = MIN_LAYER_SCALE;
                setTransformData({ posX: m.position.x, posY: m.position.y, posZ: m.position.z, rotX: m.rotation.x, rotY: m.rotation.y, rotZ: m.rotation.z, scaleX: m.scale.x, scaleY: m.scale.y, scaleZ: m.scale.z });
                syncLayerEntityState(activeSceneLayerId, m.name ?? 'Layer', m, m.userData.layerMaterialId ?? null);
            }
        });
        scene.add(transformControl as any);

        // Brush Cursors
        const cursorGeo = new THREE.RingGeometry(0.02, 0.03, 32);
        const cursorMat = new THREE.MeshBasicMaterial({ color: HOVER_COLOR, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide });
        const brushCursor = new THREE.Mesh(cursorGeo, cursorMat);
        brushCursor.visible = false;
        scene.add(brushCursor);

        // Symmetry Cursor
        const symCursor = new THREE.Mesh(cursorGeo, new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.5, depthTest: false, side: THREE.DoubleSide }));
        symCursor.visible = false;
        scene.add(symCursor);

        const viewportGrid = new AdaptiveInfiniteGrid();
        viewportGrid.setVisible(showGrid);
        viewportGridRef.current = viewportGrid;
        scene.add(viewportGrid.group);

        const selectionBox = new THREE.BoxHelper(undefined as any, 0xffaa00);
        selectionBox.visible = false;
        scene.add(selectionBox);

        sceneRef.current = { ...sceneRef.current, scene, camera, renderer, controls, transformControl, brushCursor, symmetryCursor: symCursor, selectionBox };

        // Default Load
        // Clear any existing state to handle Strict Mode / Hot Reload
        sceneRef.current.meshes.clear();

        let mounted = true;
        if (!sharedState?.activeArtifactId && !(sharedState?.storage?.length)) {
            loadPrimitive(
                zenWorkspaceDocument.activeModuleId === 'tecton'
                    ? 'LANDSCAPE'
                    : (isChronoQuantumActive ? 'CHRONO_QUANTUM_FIELD' : 'SPHERE'),
                () => mounted
            );
        }

        const animate = () => {
            requestAnimationFrame(animate);
            if (sceneRef.current.tick) sceneRef.current.tick();
            controls.update();
            viewportGrid.update(camera, controls.target);
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => { if (!mountRef.current) return; camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight); };
        window.addEventListener('resize', handleResize);
        return () => {
            mounted = false;
            disconnectZenViewport();
            window.removeEventListener('resize', handleResize);
            viewportGrid.dispose();
            viewportGridRef.current = null;
            if (mountRef.current) mountRef.current.innerHTML = '';
            renderer.dispose();
            setLayers([]);
            sceneRef.current.meshes.clear();
        };
    }, [connectViewport]);

    useEffect(() => {
        if (bootstrappedKernelSceneRef.current) return;
        if (sharedState?.activeArtifactId || sharedState?.storage?.length) return;
        if (shouldBypassSharedArtifactForTecton || shouldBypassSharedArtifactForChronoQuantum) return;
        if (!onCommit || layers.length === 0) return;

        bootstrappedKernelSceneRef.current = true;
        handleUplink();
    }, [
        layers.length,
        onCommit,
        sharedState?.activeArtifactId,
        sharedState?.storage?.length,
        shouldBypassSharedArtifactForChronoQuantum,
        shouldBypassSharedArtifactForTecton
    ]);

    useEffect(() => {
        if (zenWorkspaceDocument.activeModuleId !== 'tecton') {
            return;
        }

        if (!shouldBypassSharedArtifactForTecton) {
            return;
        }

        const existingLandscape = sceneRef.current.meshes.get(TECTON_LANDSCAPE_LAYER_ID);
        if (existingLandscape?.userData.tectonLandscapeRevision === tectonLandscapeConfig.revision) {
            if (activeLayerId !== TECTON_LANDSCAPE_LAYER_ID) {
                handleLayerSelect(TECTON_LANDSCAPE_LAYER_ID, false);
            }
            return;
        }

        const isBootstrapOnlyScene = layers.length === 0 || layers.every((layer) =>
            layer.id === TECTON_LANDSCAPE_LAYER_ID
            || TECTON_LANDSCAPE_BOOTSTRAP_LAYER_NAMES.includes(
                layer.name as (typeof TECTON_LANDSCAPE_BOOTSTRAP_LAYER_NAMES)[number]
            )
        );

        if (!isBootstrapOnlyScene && !existingLandscape) {
            return;
        }

        if (existingLandscape) {
            handleDeleteLayer(TECTON_LANDSCAPE_LAYER_ID);
        }

        layers
            .filter((layer) =>
                layer.id !== TECTON_LANDSCAPE_LAYER_ID
                && TECTON_LANDSCAPE_BOOTSTRAP_LAYER_NAMES.includes(
                    layer.name as (typeof TECTON_LANDSCAPE_BOOTSTRAP_LAYER_NAMES)[number]
                )
            )
            .forEach((layer) => handleDeleteLayer(layer.id));

        loadPrimitive('LANDSCAPE');
    }, [
        activeLayerId,
        layers,
        shouldBypassSharedArtifactForTecton,
        tectonLandscapeConfig.revision,
        zenWorkspaceDocument.activeModuleId
    ]);

    useEffect(() => {
        if (!isChronoQuantumActive) {
            return;
        }

        if (!shouldBypassSharedArtifactForChronoQuantum || !sceneRef.current.scene) {
            return;
        }

        const existingField = sceneRef.current.meshes.get(CHRONO_QUANTUM_FIELD_LAYER_ID);
        if (existingField?.userData.chronoQuantumUpdatedAt === chronoQuantumState.updatedAt) {
            if (activeLayerId !== CHRONO_QUANTUM_FIELD_LAYER_ID) {
                handleLayerSelect(CHRONO_QUANTUM_FIELD_LAYER_ID, false);
            }
            return;
        }

        if (existingField) {
            handleDeleteLayer(CHRONO_QUANTUM_FIELD_LAYER_ID);
        }

        const isBootstrapOnlyScene = layers.length === 0 || layers.every((layer) =>
            layer.id === CHRONO_QUANTUM_FIELD_LAYER_ID
            || CHRONO_QUANTUM_FIELD_BOOTSTRAP_LAYER_NAMES.includes(
                layer.name as (typeof CHRONO_QUANTUM_FIELD_BOOTSTRAP_LAYER_NAMES)[number]
            )
        );

        if (isBootstrapOnlyScene) {
            layers
                .filter((layer) =>
                    layer.id !== CHRONO_QUANTUM_FIELD_LAYER_ID
                    && CHRONO_QUANTUM_FIELD_BOOTSTRAP_LAYER_NAMES.includes(
                        layer.name as (typeof CHRONO_QUANTUM_FIELD_BOOTSTRAP_LAYER_NAMES)[number]
                    )
                )
                .forEach((layer) => handleDeleteLayer(layer.id));
        }

        loadPrimitive('CHRONO_QUANTUM_FIELD');
    }, [
        activeLayerId,
        chronoQuantumState.updatedAt,
        isChronoQuantumActive,
        layers,
        shouldBypassSharedArtifactForChronoQuantum
    ]);

    // Update Gizmo Settings
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

    // --- LAYER MANAGEMENT ---

    const disposeMeshResources = (mesh?: THREE.Mesh | null) => {
        if (!mesh) {
            return;
        }

        sceneRef.current.scene?.remove(mesh);
        void rustSculptManager.disposeMesh(mesh);
        void rustRaycastManager.disposeMesh(mesh);
        mesh.geometry?.dispose?.();

        const materials = new Set<THREE.Material>();
        const collectMaterial = (value: unknown) => {
            if (Array.isArray(value)) {
                value.forEach(collectMaterial);
                return;
            }

            if (value && typeof value === 'object' && (value as any).isMaterial) {
                materials.add(value as THREE.Material);
            }
        };

        collectMaterial(mesh.material);
        collectMaterial(mesh.userData.originalPBR);
        collectMaterial(mesh.userData.layerPBRMaterial);
        collectMaterial(mesh.userData.surfaceMaterial);

        materials.forEach((material) => material.dispose?.());
        gpuBrushCursor.releaseMesh(mesh);
    };

    const createDefaultSurfaceMaterial = (geometry: THREE.BufferGeometry) => {
        const material = new THREE.MeshStandardMaterial({
            color: 0xf2ede3,
            roughness: 0.78,
            metalness: 0.04,
            vertexColors: !!geometry.attributes.color,
            side: THREE.DoubleSide
        });
        material.name = 'KSculptSurface';
        return material;
    };

    const syncClayOverlayMaterial = (material?: THREE.Material | null) => {
        if (!material) {
            return;
        }

        const userData = ((material as any).userData ??= {});
        const clayOverlayUniforms = (userData.clayOverlayUniforms ??= {
            uClayOverlayEnabled: { value: materialMode === 'CLAY' ? 1.0 : 0.0 },
            uClayPreset: { value: getMatCapPresetIndex(currentMatCap) },
            uClayStrength: { value: 0.82 }
        });

        clayOverlayUniforms.uClayOverlayEnabled.value = materialMode === 'CLAY' ? 1.0 : 0.0;
        clayOverlayUniforms.uClayPreset.value = getMatCapPresetIndex(currentMatCap);

        if (userData.clayOverlayInjected) {
            return;
        }

        const existingCallback = material.onBeforeCompile?.bind(material);
        const existingProgramKey = material.customProgramCacheKey?.bind(material);
        material.customProgramCacheKey = () =>
            `${existingProgramKey ? existingProgramKey() : 'base'}|ksculpt-clay-overlay-v2`;
        material.onBeforeCompile = (shader, renderer) => {
            if (existingCallback) {
                existingCallback(shader, renderer);
            }

            Object.assign(shader.uniforms, clayOverlayUniforms);

            shader.vertexShader = `
                attribute float mask;
                varying float vMask;
                ${shader.vertexShader}
            `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vMask = mask;
                `
            );

            shader.fragmentShader = `
                uniform float uClayOverlayEnabled;
                uniform float uClayPreset;
                uniform float uClayStrength;
                varying float vMask;

                vec3 ksTopColor(float preset) {
                    if (preset < 0.5) return vec3(0.46, 0.86, 0.71);
                    if (preset < 1.5) return vec3(0.93, 0.96, 1.00);
                    if (preset < 2.5) return vec3(0.91, 0.92, 0.95);
                    return vec3(0.98, 0.88, 0.82);
                }

                vec3 ksMidColor(float preset) {
                    if (preset < 0.5) return vec3(0.12, 0.48, 0.34);
                    if (preset < 1.5) return vec3(0.44, 0.57, 0.74);
                    if (preset < 2.5) return vec3(0.53, 0.56, 0.62);
                    return vec3(0.72, 0.50, 0.42);
                }

                vec3 ksBottomColor(float preset) {
                    if (preset < 0.5) return vec3(0.03, 0.08, 0.06);
                    if (preset < 1.5) return vec3(0.07, 0.09, 0.13);
                    if (preset < 2.5) return vec3(0.09, 0.10, 0.12);
                    return vec3(0.12, 0.08, 0.06);
                }

                vec3 ksRimColor(float preset) {
                    if (preset < 0.5) return vec3(0.90, 1.00, 0.96);
                    if (preset < 1.5) return vec3(1.00, 0.98, 0.93);
                    if (preset < 2.5) return vec3(0.98, 0.98, 0.99);
                    return vec3(1.00, 0.93, 0.88);
                }

                ${shader.fragmentShader}
            `.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>
                vec3 ksNormal = normalize(normal);
                vec3 ksViewDir = normalize(-vViewPosition);
                vec3 ksLightDir = normalize(vec3(-0.35, 0.78, 0.52));
                float ksFacing = clamp(dot(ksNormal, ksViewDir), 0.0, 1.0);
                float ksRim = pow(1.0 - ksFacing, 2.4);
                float ksSun = max(dot(ksNormal, ksLightDir), 0.0);
                vec3 ksReflect = reflect(-ksLightDir, ksNormal);
                float ksSpec = pow(max(dot(ksReflect, ksViewDir), 0.0), 26.0);
                float ksHorizon = clamp(ksNormal.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 ksEnvLower = mix(ksBottomColor(uClayPreset), ksMidColor(uClayPreset), ksHorizon);
                vec3 ksEnvUpper = mix(ksMidColor(uClayPreset), ksTopColor(uClayPreset), smoothstep(0.18, 0.92, ksHorizon));
                vec3 ksEnv = mix(ksEnvLower, ksEnvUpper, smoothstep(0.12, 0.88, ksHorizon));
                vec3 ksOverlay = ksEnv * (0.28 + ksFacing * 0.48 + ksSun * 0.24)
                    + ksRimColor(uClayPreset) * ksRim * 0.42
                    + vec3(1.0) * ksSpec * 0.18;
                float ksMaskDarken = 1.0 - (vMask * 0.7);
                vec3 ksBase = gl_FragColor.rgb * ksMaskDarken;
                float ksWeight = clamp(uClayOverlayEnabled, 0.0, 1.0) * clamp(uClayStrength, 0.0, 1.0);
                gl_FragColor.rgb = mix(ksBase, ksBase * 0.22 + ksOverlay, ksWeight);
                `
            );
        };

        userData.clayOverlayInjected = true;
        material.needsUpdate = true;
    };

    const applySurfaceMaterial = (mesh: THREE.Mesh, surfaceMaterial: THREE.Material) => {
        if ((surfaceMaterial as any).vertexColors !== undefined && mesh.geometry.attributes.color) {
            (surfaceMaterial as any).vertexColors = true;
        }
        surfaceMaterial.side = THREE.DoubleSide;
        (surfaceMaterial as any).wireframe = wireframe;
        syncClayOverlayMaterial(surfaceMaterial);
        mesh.userData.surfaceMaterial = surfaceMaterial;
        mesh.material = surfaceMaterial;
        gpuBrushCursor.patchMesh(mesh);
    };

    const findKernelMaterialById = (materialId: string | null | undefined) => {
        if (!materialId) {
            return null;
        }

        if (sharedState?.activeMaterial?.id === materialId) {
            return resolveKernelMaterialRecord(sharedState.activeMaterial);
        }

        return resolveKernelMaterialRecord(
            sharedState?.materials?.find((material: any) => material.id === materialId) ?? null
        );
    };

    const resolvePreferredLayerMaterial = (layerId: string | null) => {
        const explicitlySelected = findKernelMaterialById(sharedState?.activeMaterialId ?? null);
        if (explicitlySelected) {
            return explicitlySelected;
        }

        const sourceLayer = layers.find((layer) => layer.id === layerId);
        return findKernelMaterialById(sourceLayer?.materialId ?? null);
    };

    const syncLayerEntityState = (
        layerId: string,
        name: string,
        mesh: THREE.Mesh,
        materialId: string | null
    ) => {
        const entityId = createSculptEntityId(layerId);
        upsertSceneEntity({
            id: entityId,
            name,
            moduleId: 'sculpt',
            layerId,
            tags: ['scene-node', 'sculpt-layer', 'mesh-layer'],
            components: {
                [ZEN_COMPONENT_KEYS.transform]: createSculptTransformComponent(mesh)
            }
        });
        bindSceneEntityMaterial(entityId, materialId ?? null);
    };

    const addMeshToScene = (
        mesh: THREE.Mesh,
        name: string,
        importedMaterial?: THREE.Material | THREE.Material[],
        options?: {
            layerId?: string;
            select?: boolean;
            suppressHistory?: boolean;
            materialId?: string | null;
            kernelMaterial?: KernelLikeMaterial | null;
        }
    ) => {
        const { scene } = sceneRef.current;
        const id = options?.layerId ?? mesh.uuid;
        const existingLayer = layers.find((layer) => layer.id === id);
        const existingMesh = sceneRef.current.meshes.get(id);

        if (existingMesh) {
            disposeMeshResources(existingMesh);
            sceneRef.current.meshes.delete(id);
        }

        // Sanitize Geometry
        let geo = mesh.geometry;
        const count = geo.attributes.position.count;
        if (!geo.attributes.color) {
            geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
        }
        const maskData = new Float32Array(count).fill(0);
        geo.setAttribute('mask', new THREE.BufferAttribute(maskData, 1));

        geo.computeVertexNormals();
        geo.computeBoundingBox();

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.visible = existingLayer?.visible ?? true;
        mesh.name = name;
        mesh.userData.isSculptable = true;

        const initialSurfaceMaterial = importedMaterial
            ? (Array.isArray(importedMaterial) ? importedMaterial[0] : importedMaterial).clone()
            : createDefaultSurfaceMaterial(geo);
        mesh.userData.originalPBR = initialSurfaceMaterial;
        applySurfaceMaterial(mesh, initialSurfaceMaterial);

        if (importedMaterial) {
            setMaterialMode('PBR');
        }

        scene.add(mesh);
        sceneRef.current.meshes.set(id, mesh);

        // Initialize BVH (Async if possible? Sync for now)
        // @ts-ignore
        mesh.geometry.computeBoundsTree();

        // Initialize Topology
        sceneRef.current.topology = new MeshTopology();
        sceneRef.current.topology.build(mesh.geometry);

        // Register with Rust backend for high-performance sculpting
        rustSculptManager.registerMesh(mesh).then((handle) => {
            if (handle) {
                console.log(`[KSculpt] Sculpt mesh registered: ${name} (handle: ${handle})`);
            }
        });

        // Register with Rust backend for high-performance raycasting (parry3d BVH)
        rustRaycastManager.registerMesh(mesh).then((handle) => {
            if (handle) {
                console.log(`[KSculpt] Raycast mesh registered: ${name} (handle: ${handle})`);
            }
        });

        // Patch mesh material for GPU-based brush cursor (no more 3D ring!)
        gpuBrushCursor.patchMesh(mesh);

        const resolvedMaterialId = options?.materialId ?? existingLayer?.materialId ?? null;
        mesh.userData.layerMaterialId = resolvedMaterialId;

        setLayers((prev) => {
            const nextLayer = {
                id,
                name,
                mesh,
                visible: existingLayer?.visible ?? true,
                polyCount: geo.attributes.position.count,
                materialId: resolvedMaterialId ?? undefined
            };

            return prev.some((layer) => layer.id === id)
                ? prev.map((layer) => (layer.id === id ? nextLayer : layer))
                : [...prev, nextLayer];
        });

        syncLayerEntityState(id, name, mesh, resolvedMaterialId);

        if ((options?.select ?? true) === true) {
            setActiveLayerId(id);
            setSelectedLayerIds(new Set([id]));
        }

        const layerMaterial = options?.kernelMaterial ?? findKernelMaterialById(resolvedMaterialId);
        if (layerMaterial) {
            updateMeshMaterial(id, layerMaterial);
        }

        if (!options?.suppressHistory) {
            sceneRef.current.sculptHistory = [];
            sceneRef.current.historyIndex = -1;
            saveHistory();
        }

        setStatus(`${name.toUpperCase()} ADDED`);
        return id;
    };

    // --- MERGE LOGIC ---
    const mergeMeshes = (idsToMerge: string[], newName: string) => {
        const meshesToMerge: THREE.Mesh[] = [];
        idsToMerge.forEach(id => {
            const mesh = sceneRef.current.meshes.get(id);
            if (mesh) meshesToMerge.push(mesh);
        });

        if (meshesToMerge.length < 2) return;

        setStatus("FUSING GEOMETRY...");

        const geometries: THREE.BufferGeometry[] = [];

        meshesToMerge.forEach(mesh => {
            mesh.updateMatrixWorld();
            const geo = mesh.geometry.clone();
            geo.applyMatrix4(mesh.matrixWorld);
            geometries.push(geo);
        });

        try {
            const mergedGeo = BufferGeometryUtils.mergeGeometries(geometries);
            mergedGeo.computeVertexNormals();

            // Use material of the last mesh (active one usually)
            const targetMat = meshesToMerge[meshesToMerge.length - 1].material;
            const newMesh = new THREE.Mesh(mergedGeo, targetMat);

            // Cleanup old
            idsToMerge.forEach((id) => {
                const mesh = sceneRef.current.meshes.get(id);
                if (!mesh) {
                    return;
                }
                disposeMeshResources(mesh);
                sceneRef.current.meshes.delete(id);
                removeSceneEntity(createSculptEntityId(id));
            });

            // Update State
            setLayers(prev => prev.filter(l => !idsToMerge.includes(l.id)));

            // Add New
            addMeshToScene(newMesh, newName);
            setStatus("FUSION COMPLETE");

        } catch (e) {
            console.error(e);
            setStatus("MERGE FAILED");
        }
    };

    const handleMergeDown = (layerId: string) => {
        const layerIndex = layers.findIndex(l => l.id === layerId);
        if (layerIndex === -1 || layerIndex >= layers.length - 1) return;
        const topLayer = layers[layerIndex];
        const bottomLayer = layers[layerIndex + 1];
        mergeMeshes([topLayer.id, bottomLayer.id], `${bottomLayer.name}_Fused`);
    };

    const handleMergeSelected = () => {
        if (selectedLayerIds.size < 2) return;
        // Convert Set to Array and sort by current layer order
        const ids = Array.from(selectedLayerIds) as string[];
        // Sort ids based on their index in the layers array to maintain hierarchy logic if needed
        // but simple array is fine for now.
        mergeMeshes(ids, "Fused_Entity");
        setSelectedLayerIds(new Set());
    };

    const handleMergeAll = () => {
        if (layers.length < 2) return;
        const ids = layers.map(l => l.id);
        mergeMeshes(ids, "Scene_Monolith");
        setSelectedLayerIds(new Set());
    };

    // --- MATERIAL LOGIC ---
    const handleApplyMaterial = (mat: any) => {
        if (!activeLayerId) {
            return;
        }

        if (!mat) {
            setActiveMaterial(null);
            setLayers((prev) => prev.map((layer) => (
                layer.id === activeLayerId
                    ? { ...layer, materialId: undefined }
                    : layer
            )));
            bindSceneEntityMaterial(createSculptEntityId(activeLayerId), null);
            updateMeshMaterial(activeLayerId, null);
            return;
        }
        setActiveMaterial(mat);
        setLayers(prev => prev.map(l => {
            if (l.id === activeLayerId) {
                return { ...l, materialId: mat.id };
            }
            return l;
        }));
        bindSceneEntityMaterial(createSculptEntityId(activeLayerId), mat.id ?? null);
        updateMeshMaterial(activeLayerId, mat);
    };

    const updateMeshMaterial = (layerId: string, kernelMat: any | null) => {
        const mesh = sceneRef.current.meshes.get(layerId);
        if (!mesh) return;
        const resolvedMaterial = resolveKernelMaterialRecord(kernelMat);

        if (!resolvedMaterial) {
            if (mesh.userData.layerPBRMaterial) {
                (mesh.userData.layerPBRMaterial as THREE.Material).dispose?.();
                mesh.userData.layerPBRMaterial = null;
            }
            if (mesh.userData.originalPBR) {
                applySurfaceMaterial(mesh, mesh.userData.originalPBR as THREE.Material);
            }
            mesh.userData.layerMaterialId = null;
            return;
        }

        const loader = new THREE.TextureLoader();
        const load = (url: string) => url ? loader.load(url) : null;

        const newMat = new THREE.MeshStandardMaterial({
            map: load(resolvedMaterial.base ?? ''),
            normalMap: load(resolvedMaterial.normal ?? ''),
            roughnessMap: load(resolvedMaterial.roughness ?? ''),
            metalnessMap: load(resolvedMaterial.metallic ?? ''),
            aoMap: load(resolvedMaterial.ao ?? ''),
            emissiveMap: load(resolvedMaterial.emissive ?? ''),
            displacementMap: load(resolvedMaterial.height ?? ''),
            displacementScale: 0.05,
            roughness: 1.0,
            metalness: 1.0,
            color: 0xffffff
        });
        const previousLayerMaterial = mesh.userData.layerPBRMaterial as THREE.Material | undefined;
        mesh.userData.layerPBRMaterial = newMat;
        applySurfaceMaterial(mesh, newMat);
        if (previousLayerMaterial && previousLayerMaterial !== mesh.userData.originalPBR) {
            previousLayerMaterial.dispose?.();
        }
        mesh.userData.layerMaterialId = resolvedMaterial.id ?? mesh.userData.layerMaterialId ?? null;
    };

    // Sync Material Mode Changes
    useEffect(() => {
        layers.forEach(layer => {
            const mesh = sceneRef.current.meshes.get(layer.id);
            if (!mesh) return;
            syncClayOverlayMaterial(mesh.userData.surfaceMaterial as THREE.Material | undefined);
        });
    }, [currentMatCap, layers, materialMode, wireframe]);

    useEffect(() => {
        layers.forEach((layer) => {
            if (!layer.materialId) {
                return;
            }

            const materialRecord = sharedState?.materials?.find((material: any) => material.id === layer.materialId);
            if (materialRecord) {
                updateMeshMaterial(layer.id, materialRecord);
            }
        });
    }, [layers, sharedState?.materials]);

    // Update Wireframe
    useEffect(() => {
        layers.forEach(layer => {
            const mesh = sceneRef.current.meshes.get(layer.id);
            if (mesh && mesh.material) {
                (mesh.material as any).wireframe = wireframe;
                const sourceMaterial = mesh.userData.surfaceMaterial as THREE.Material | undefined;
                if (sourceMaterial) {
                    (sourceMaterial as any).wireframe = wireframe;
                    syncClayOverlayMaterial(sourceMaterial);
                }
            }
        });
    }, [wireframe, layers]);

    // --- SELECTION & FRAME ---
    const handleLayerSelect = (id: string, multi: boolean) => {
        // Always set active for sculpting
        setActiveLayerId(id);

        if (multi) {
            const newSet = new Set(selectedLayerIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedLayerIds(newSet);
        } else {
            // If simply clicking, we just select this one
            setSelectedLayerIds(new Set([id]));
        }

        const mesh = sceneRef.current.meshes.get(id);
        if (mesh && sceneRef.current.selectionBox) {
            sceneRef.current.selectionBox.setFromObject(mesh);
            sceneRef.current.selectionBox.visible = true;
            // Fade out selection box
            setTimeout(() => { sceneRef.current.selectionBox.visible = false; }, 500);
        }
    };

    const handleFrameActive = () => {
        if (!activeLayerId) return;
        const mesh = sceneRef.current.meshes.get(activeLayerId);
        if (!mesh) return;

        const r = sceneRef.current;
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3(); box.getCenter(center);
        const size = new THREE.Vector3(); box.getSize(size);

        const radius = Math.max(size.x, size.y, size.z) / 2;
        const fov = r.camera.fov * (Math.PI / 180);
        let cameraDist = Math.abs(radius / Math.sin(fov / 2));
        cameraDist *= 1.5;

        const direction = new THREE.Vector3().subVectors(r.camera.position, r.controls.target).normalize();
        const newPos = center.clone().add(direction.multiplyScalar(cameraDist));

        r.camera.position.copy(newPos);
        r.controls.target.copy(center);
        r.controls.update();
        setStatus("FRAMED ACTIVE");
    };

    const handleCycleLayer = (direction: number) => {
        if (layers.length === 0) return;

        const currentIdx = layers.findIndex(l => l.id === activeLayerId);
        if (currentIdx === -1) {
            setActiveLayerId(layers[0].id);
            return;
        }

        const newIdx = Math.max(0, Math.min(layers.length - 1, currentIdx + direction));
        if (newIdx !== currentIdx) {
            const newId = layers[newIdx].id;
            setActiveLayerId(newId);
            setSelectedLayerIds(new Set([newId]));

            const mesh = sceneRef.current.meshes.get(newId);
            if (mesh && sceneRef.current.selectionBox) {
                sceneRef.current.selectionBox.setFromObject(mesh);
                sceneRef.current.selectionBox.visible = true;
                setTimeout(() => { sceneRef.current.selectionBox.visible = false; }, 300);
            }
        }
    };

    function loadPrimitive(type: string, isValid?: () => boolean) {
        if (type === 'SPHERE') {
            const loader = new GLTFLoader();
            setStatus("LOADING QUAD SPHERE...");
            loader.load('/primitives_glb/Quad_Sphere.glb', (gltf) => {
                if (isValid && !isValid()) return;

                let foundMesh = false;
                gltf.scene.traverse((c: any) => {
                    if (c.isMesh && !foundMesh) {
                        foundMesh = true;
                        let geo = c.geometry;

                        // Center and Scale
                        geo.computeBoundingBox();
                        geo.center();

                        const size = new THREE.Vector3();
                        geo.boundingBox.getSize(size);
                        const maxDim = Math.max(size.x, size.y, size.z);
                        if (maxDim > 0) {
                            const scaleFactor = 2.0 / maxDim; // Normalize to approx size 2
                            geo.scale(scaleFactor, scaleFactor, scaleFactor);
                        }

                        // --- SEAM WELDING FIX ---
                        // Delete UVs to force a perfect weld (Sculpting priority)
                        geo.deleteAttribute('uv');
                        geo.deleteAttribute('normal'); // Recompute later

                        // Merge Vertices for Sculpting
                        try { geo = BufferGeometryUtils.mergeVertices(geo, 1e-4); } catch (e) { }

                        geo.computeVertexNormals();

                        const mesh = new THREE.Mesh(geo);
                        const id = addMeshToScene(mesh, 'QuadSphere');

                        if (id) {
                            handleLayerSelect(id, false);
                            setStatus("QUAD SPHERE LOADED");
                        }
                    }
                });

                if (!foundMesh) {
                    console.warn("Quad Sphere GLB loaded but no mesh found. Using fallback.");
                    const geo = new THREE.SphereGeometry(1, 128, 128);
                    const mesh = new THREE.Mesh(geo);
                    addMeshToScene(mesh, 'Sphere_Fallback');
                }
            }, undefined, (err) => {
                if (isValid && !isValid()) return;
                console.error("Failed to load Quad Sphere", err);
                // Fallback
                const geo = new THREE.SphereGeometry(1, 128, 128);
                const mesh = new THREE.Mesh(geo);
                addMeshToScene(mesh, 'Sphere_Fallback');
            });
            return;
        }

        let geo;
        switch (type) {
            case 'CUBE':
                geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 64, 64, 64);
                break;
            case 'CYLINDER':
                geo = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 64, 64);
                break;
            case 'TORUS':
                geo = new THREE.TorusGeometry(0.8, 0.3, 64, 128);
                break;
            case 'LANDSCAPE':
                geo = createTectonLandscapeGeometry(tectonLandscapeConfig);
                break;
            case 'CHRONO_QUANTUM_FIELD':
                geo = createChronoQuantumFieldGeometry(chronoQuantumState);
                break;
            case 'PLANE':
                geo = new THREE.PlaneGeometry(2, 2, 128, 128);
                break;
            case 'ICOSA':
                geo = new THREE.IcosahedronGeometry(1.0, 5);
                break;
            default:
                // Fallback default
                geo = new THREE.SphereGeometry(1, 128, 128);
        }

        // Merge Vertices for Sculpting Topology
        try { geo = BufferGeometryUtils.mergeVertices(geo); } catch (e) { }

        // Ensure Attributes
        const count = geo.attributes.position.count;
        if (!geo.attributes.color) geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
        if (!geo.attributes.mask) geo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(count).fill(0), 1));

        // Initialize BVH
        // @ts-ignore
        if (!geo.boundsTree) geo.computeBoundsTree();

        const mesh = new THREE.Mesh(geo);
        if (type === 'LANDSCAPE') {
            mesh.userData.tectonLandscapeRevision = tectonLandscapeConfig.revision;
            mesh.userData.tectonLandscapeConfig = { ...tectonLandscapeConfig };
        }
        if (type === 'CHRONO_QUANTUM_FIELD') {
            mesh.userData.chronoQuantumUpdatedAt = chronoQuantumState.updatedAt;
            mesh.userData.chronoQuantumState = { ...chronoQuantumState };
        }
        const primitiveName = type === 'LANDSCAPE'
            ? TECTON_LANDSCAPE_LAYER_NAME
            : type === 'CHRONO_QUANTUM_FIELD'
                ? CHRONO_QUANTUM_FIELD_LAYER_NAME
                : type;
        const primitiveOptions = type === 'LANDSCAPE'
            ? {
                layerId: TECTON_LANDSCAPE_LAYER_ID,
                materialId: sharedState?.activeMaterialId ?? null
            }
            : type === 'CHRONO_QUANTUM_FIELD'
                ? {
                    layerId: CHRONO_QUANTUM_FIELD_LAYER_ID,
                    materialId: sharedState?.activeMaterialId ?? null
                }
                : undefined;
        const id = addMeshToScene(
            mesh,
            primitiveName,
            undefined,
            primitiveOptions
        );

        // AUTO-GIZMO
        if (id) {
            handleLayerSelect(id, false);
            setStatus(
                type === 'LANDSCAPE'
                    ? "TECTON LANDSCAPE READY"
                    : type === 'CHRONO_QUANTUM_FIELD'
                        ? "CHRONO QUANTUM FIELD READY"
                        : "PRIMITIVE SPAWNED"
            );
        }
    }

    function loadFromStorage(item: any) {
        if (!item?.blob && item?.path) {
            loadFromPath(item.path, item.name);
            return;
        }

        const url = URL.createObjectURL(item.blob);
        const loader = new GLTFLoader();
        setStatus(`IMPORTING ${item.name}...`);

        loader.load(url, (gltf) => {
            ingestLoadedScene(gltf.scene, item.name);

            URL.revokeObjectURL(url);
        }, undefined, (err) => {
            console.error("Import failed", err);
            setStatus("IMPORT FAILED");
            URL.revokeObjectURL(url);
        });
    }

    function resolveImportUrl(path: string): string {
        if (
            path.startsWith('blob:')
            || path.startsWith('data:')
            || path.startsWith('http://')
            || path.startsWith('https://')
            || path.startsWith('asset:')
            || path.startsWith('tauri:')
        ) {
            return path;
        }

        return convertFileSrc(path);
    }

    function ingestLoadedScene(root: THREE.Object3D, sourceName: string) {
        root.updateMatrixWorld(true);

        const validMeshes: { mesh: THREE.Mesh, bakedGeo: THREE.BufferGeometry }[] = [];

        root.traverse((c: any) => {
            if (c.isMesh) {
                const geo = c.geometry.clone();
                geo.applyMatrix4(c.matrixWorld);
                validMeshes.push({ mesh: c, bakedGeo: geo });
            }
        });

        if (validMeshes.length === 0) {
            setStatus("NO MESHES FOUND");
            return;
        }

        const globalBox = new THREE.Box3();
        validMeshes.forEach((vm) => {
            vm.bakedGeo.computeBoundingBox();
            if (vm.bakedGeo.boundingBox) {
                globalBox.union(vm.bakedGeo.boundingBox);
            }
        });

        const center = new THREE.Vector3();
        globalBox.getCenter(center);
        const size = new THREE.Vector3();
        globalBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        const scaleFactor = maxDim > 0 ? 2.0 / maxDim : 1.0;
        const offset = center.clone().negate();

        validMeshes.forEach(({ mesh: originalMesh, bakedGeo }, index) => {
            bakedGeo.translate(offset.x, offset.y, offset.z);
            bakedGeo.scale(scaleFactor, scaleFactor, scaleFactor);
            bakedGeo.computeVertexNormals();

            const newMesh = new THREE.Mesh(bakedGeo);
            newMesh.position.set(0, 0, 0);
            newMesh.rotation.set(0, 0, 0);
            newMesh.scale.set(1, 1, 1);
            addMeshToScene(newMesh, originalMesh.name || `${sourceName}_${index}`, originalMesh.material);
        });

        setStatus(`IMPORTED ${validMeshes.length} PARTS`);
        setMode('TRANSFORM');
        setGizmoMode('translate');
    }

    function loadFromPath(path: string, name?: string) {
        const loader = new GLTFLoader();
        const sourceName = name ?? path.split(/[\\/]/).pop() ?? 'ImportedMesh';
        setStatus(`IMPORTING ${sourceName.toUpperCase()}...`);

        loader.load(resolveImportUrl(path), (gltf) => {
            ingestLoadedScene(gltf.scene, sourceName);
        }, undefined, (err) => {
            console.error("Path import failed", err);
            setStatus("IMPORT FAILED");
        });
    }

    useEffect(() => {
        const activeArtifactId = sharedState?.activeArtifactId ?? null;
        const artifactBlob = sharedState?.artifact ?? null;
        const artifactMountKey = getArtifactMountKey(activeArtifactId, artifactBlob);

        if (shouldBypassSharedArtifactForTecton) {
            mountedSharedArtifactRef.current = { id: null, key: null };
            return;
        }

        if (!activeArtifactId || !artifactBlob) {
            mountedSharedArtifactRef.current = { id: null, key: null };
            return;
        }

        if (
            bootstrappedKernelSceneRef.current &&
            layers.length > 0 &&
            mountedSharedArtifactRef.current.id === null
        ) {
            mountedSharedArtifactRef.current = { id: activeArtifactId, key: artifactMountKey };
            return;
        }

        if (
            mountedSharedArtifactRef.current.id === activeArtifactId &&
            mountedSharedArtifactRef.current.key === artifactMountKey
        ) {
            return;
        }

        const scene = sceneRef.current.scene;
        if (!scene) {
            return;
        }

        const sourceItem = sharedState?.storage?.find((item: any) => item.id === activeArtifactId) ?? {
            id: activeArtifactId,
            name: `Shared_${activeArtifactId}`,
            blob: artifactBlob
        };

        sceneRef.current.transformControl?.detach();
        if (sceneRef.current.selectionBox) {
            sceneRef.current.selectionBox.visible = false;
        }

        Array.from(sceneRef.current.meshes.entries()).forEach(([layerId, mesh]: [string, THREE.Mesh]) => {
            disposeMeshResources(mesh);
            removeSceneEntity(createSculptEntityId(layerId));
        });

        sceneRef.current.meshes.clear();
        sceneRef.current.topology = null;
        sceneRef.current.sculptHistory = [];
        sceneRef.current.historyIndex = -1;

        setLayers([]);
        setActiveLayerId(null);
        setSelectedLayerIds(new Set());

        mountedSharedArtifactRef.current = { id: activeArtifactId, key: artifactMountKey };
        loadFromStorage(sourceItem);
    }, [layers.length, sharedState?.activeArtifactId, sharedState?.artifact, sharedState?.storage, shouldBypassSharedArtifactForTecton]);

    useEffect(() => {
        const controls = sceneRef.current.controls as OrbitControls | null;
        if (!controls) {
            return;
        }

        const resetMouseButtons = () => {
            controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
            controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
            controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
        };

        if (!usesToolPrimaryAltOrbit) {
            resetMouseButtons();
            return;
        }

        controls.mouseButtons.LEFT = null as any;
        controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
        controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
        controls.mouseButtons.LEFT = orbitModifierActive ? THREE.MOUSE.ROTATE : null as any;

        return () => {
            resetMouseButtons();
        };
    }, [orbitModifierActive, usesToolPrimaryAltOrbit]);

    // --- LOGIC ---

    const resolveOperatorSubjectLayerId = (requestedLayerId: string | null): string | null => {
        if (requestedLayerId && sceneRef.current.meshes.has(requestedLayerId)) {
            return requestedLayerId;
        }

        if (activeLayerId && !isOperatorResultLayerId(activeLayerId) && sceneRef.current.meshes.has(activeLayerId)) {
            return activeLayerId;
        }

        return null;
    };

    const createMergedMeshFromPlacements = (
        sourceGeometry: THREE.BufferGeometry,
        placements: Array<{
            position: THREE.Vector3;
            quaternion: THREE.Quaternion;
            scale: THREE.Vector3;
        }>,
        material: THREE.Material
    ): THREE.Mesh | null => {
        if (placements.length === 0) {
            return null;
        }

        const bakedGeometries = placements.map((placement) => {
            const geometry = sourceGeometry.clone();
            const matrix = new THREE.Matrix4().compose(
                placement.position,
                placement.quaternion,
                placement.scale
            );
            geometry.applyMatrix4(matrix);
            return geometry;
        });

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(bakedGeometries, false);
        if (!mergedGeometry) {
            bakedGeometries.forEach((geometry) => geometry.dispose());
            return null;
        }

        mergedGeometry.computeVertexNormals();
        bakedGeometries.forEach((geometry) => geometry.dispose());
        return new THREE.Mesh(mergedGeometry, material);
    };

    const createScatterResultMesh = (
        subjectMesh: THREE.Mesh,
        session: ZenScatterOperatorSession
    ): THREE.Mesh | null => {
        const sourceGeometry = createScatterPrimitiveGeometry(session.primitive);
        const subjectGeometry = subjectMesh.geometry;
        const positionAttribute = subjectGeometry.getAttribute('position');
        const normalAttribute = subjectGeometry.getAttribute('normal');
        if (!positionAttribute || positionAttribute.count === 0) {
            sourceGeometry.dispose();
            return null;
        }

        const edgeGeometry = new THREE.EdgesGeometry(subjectGeometry);
        const edgeAttribute = edgeGeometry.getAttribute('position');
        const placements: Array<{
            position: THREE.Vector3;
            quaternion: THREE.Quaternion;
            scale: THREE.Vector3;
        }> = [];
        const count = Math.max(1, session.objectCount);
        const safeRadius = Math.max(0.01, session.scatterRadius);

        for (let index = 0; index < count; index++) {
            const point = new THREE.Vector3();
            const normal = new THREE.Vector3(0, 1, 0);
            const theta = (index / count) * Math.PI * 2;
            const heightT = count > 1 ? index / (count - 1) : 0;

            switch (session.scatterMode) {
                case 'SURFACE':
                case 'POISSON':
                case 'FIBONACCI':
                case 'SUNFLOWER':
                case 'HALTON':
                case 'VORONOI':
                case 'PHYLLOTAXIS':
                case 'CLUSTER':
                case 'ORGANIC':
                case 'PHYSICS_DROP':
                case 'GRAVITY_WELL': {
                    const randomIndex = Math.floor(Math.random() * positionAttribute.count);
                    point.fromBufferAttribute(positionAttribute, randomIndex).applyMatrix4(subjectMesh.matrixWorld);
                    if (normalAttribute) {
                        normal.fromBufferAttribute(normalAttribute, randomIndex).transformDirection(subjectMesh.matrixWorld);
                    }
                    break;
                }
                case 'VERTEX': {
                    const vertexIndex = index % positionAttribute.count;
                    point.fromBufferAttribute(positionAttribute, vertexIndex).applyMatrix4(subjectMesh.matrixWorld);
                    if (normalAttribute) {
                        normal.fromBufferAttribute(normalAttribute, vertexIndex).transformDirection(subjectMesh.matrixWorld);
                    }
                    break;
                }
                case 'EDGE': {
                    const edgeCount = edgeAttribute ? edgeAttribute.count / 2 : 0;
                    if (edgeCount > 0) {
                        const edgeIndex = Math.floor(Math.random() * edgeCount);
                        const edgeA = new THREE.Vector3().fromBufferAttribute(edgeAttribute, edgeIndex * 2);
                        const edgeB = new THREE.Vector3().fromBufferAttribute(edgeAttribute, edgeIndex * 2 + 1);
                        point.lerpVectors(edgeA, edgeB, Math.random()).applyMatrix4(subjectMesh.matrixWorld);
                    }
                    break;
                }
                case 'SPHERE':
                    point.setFromSphericalCoords(
                        safeRadius,
                        Math.acos(1 - 2 * Math.random()),
                        Math.random() * Math.PI * 2
                    );
                    normal.copy(point).normalize();
                    break;
                case 'RING':
                    point.set(Math.cos(theta) * safeRadius, 0, Math.sin(theta) * safeRadius);
                    normal.set(0, 1, 0);
                    break;
                case 'SPIRAL':
                    point.set(
                        Math.cos(theta * 2) * safeRadius * heightT,
                        (heightT - 0.5) * safeRadius * 2,
                        Math.sin(theta * 2) * safeRadius * heightT
                    );
                    break;
                case 'GRID': {
                    const gridColumns = Math.max(1, Math.ceil(Math.sqrt(count)));
                    const x = (index % gridColumns) - (gridColumns - 1) * 0.5;
                    const z = Math.floor(index / gridColumns) - (gridColumns - 1) * 0.5;
                    point.set(x * safeRadius * 0.6, 0, z * safeRadius * 0.6);
                    break;
                }
                case 'HELIX':
                    point.set(
                        Math.cos(theta * 2) * safeRadius,
                        (heightT - 0.5) * safeRadius * 3,
                        Math.sin(theta * 2) * safeRadius
                    );
                    normal.set(Math.cos(theta), 0.4, Math.sin(theta)).normalize();
                    break;
                case 'WAVE':
                    point.set(
                        (heightT - 0.5) * safeRadius * 4,
                        Math.sin(theta * 4) * safeRadius * 0.35,
                        Math.cos(theta * 2) * safeRadius * 0.8
                    );
                    break;
                case 'VORTEX':
                    point.set(
                        Math.cos(theta * 3) * safeRadius * (1 + heightT),
                        (heightT - 0.5) * safeRadius * 4,
                        Math.sin(theta * 3) * safeRadius * (1 + heightT)
                    );
                    normal.copy(point).normalize();
                    break;
                case 'EXPLOSION':
                    point.set(
                        (Math.random() - 0.5) * safeRadius * 4,
                        (Math.random() - 0.5) * safeRadius * 4,
                        (Math.random() - 0.5) * safeRadius * 4
                    );
                    normal.copy(point).normalize();
                    break;
                default:
                    point.set(
                        (Math.random() - 0.5) * safeRadius * 2,
                        (Math.random() - 0.5) * safeRadius * 2,
                        (Math.random() - 0.5) * safeRadius * 2
                    );
                    break;
            }

            const scaleValue = THREE.MathUtils.lerp(session.minScale, session.maxScale, Math.random());
            const orientation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                normal.lengthSq() > 0 ? normal.clone().normalize() : new THREE.Vector3(0, 1, 0)
            );
            placements.push({
                position: point,
                quaternion: orientation,
                scale: new THREE.Vector3(scaleValue, scaleValue, scaleValue)
            });
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.55,
            metalness: 0.12,
            vertexColors: Boolean(sourceGeometry.getAttribute('color'))
        });
        const mesh = createMergedMeshFromPlacements(sourceGeometry, placements, material);
        sourceGeometry.dispose();
        edgeGeometry.dispose();
        return mesh;
    };

    const createClonerResultMesh = (
        subjectMesh: THREE.Mesh,
        session: ZenClonerOperatorSession
    ): THREE.Mesh | null => {
        const sourceGeometry = subjectMesh.geometry.clone();
        sourceGeometry.applyMatrix4(subjectMesh.matrixWorld);
        sourceGeometry.computeVertexNormals();

        const placements: Array<{
            position: THREE.Vector3;
            quaternion: THREE.Quaternion;
            scale: THREE.Vector3;
        }> = [];

        if (session.clonerMode === 'RADIAL') {
            for (let index = 0; index < session.radialCount; index++) {
                const angle = (index / session.radialCount) * Math.PI * 2;
                placements.push({
                    position: new THREE.Vector3(
                        Math.cos(angle) * session.radialRadius,
                        0,
                        Math.sin(angle) * session.radialRadius
                    ),
                    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0)),
                    scale: new THREE.Vector3(1, 1, 1)
                });
            }
        } else if (session.clonerMode === 'LINEAR') {
            const countY = Math.max(1, Math.round(session.clonerCount.y));
            const offsetY = ((countY - 1) * session.clonerSpacing.y) * 0.5;
            for (let index = 0; index < countY; index++) {
                placements.push({
                    position: new THREE.Vector3(0, index * session.clonerSpacing.y - offsetY, 0),
                    quaternion: new THREE.Quaternion(),
                    scale: new THREE.Vector3(1, 1, 1)
                });
            }
        } else if (session.clonerMode === 'SINGLE') {
            placements.push({
                position: new THREE.Vector3(),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1)
            });
        } else {
            const countX = Math.max(1, Math.round(session.clonerCount.x));
            const countY = Math.max(1, Math.round(session.clonerCount.y));
            const countZ = Math.max(1, Math.round(session.clonerCount.z));
            const offsetX = ((countX - 1) * session.clonerSpacing.x) * 0.5;
            const offsetY = ((countY - 1) * session.clonerSpacing.y) * 0.5;
            const offsetZ = ((countZ - 1) * session.clonerSpacing.z) * 0.5;

            for (let x = 0; x < countX; x++) {
                for (let y = 0; y < countY; y++) {
                    for (let z = 0; z < countZ; z++) {
                        placements.push({
                            position: new THREE.Vector3(
                                x * session.clonerSpacing.x - offsetX,
                                y * session.clonerSpacing.y - offsetY,
                                z * session.clonerSpacing.z - offsetZ
                            ),
                            quaternion: new THREE.Quaternion(),
                            scale: new THREE.Vector3(1, 1, 1)
                        });
                    }
                }
            }
        }

        const material = Array.isArray(subjectMesh.material)
            ? subjectMesh.material[0]?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff })
            : subjectMesh.material?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
        const mesh = createMergedMeshFromPlacements(sourceGeometry, placements, material);
        sourceGeometry.dispose();
        return mesh;
    };

    const applySharedGreeblePlacement = (
        point: THREE.Vector3,
        normal: THREE.Vector3,
        session: ZenGreebleOperatorSession
    ) => {
        const subjectLayerId = resolveOperatorSubjectLayerId(session.subjectLayerId);
        if (!subjectLayerId) {
            setStatus('SELECT A SUBJECT FOR GREEBLE');
            return;
        }

        const preferredMaterial = resolvePreferredLayerMaterial(subjectLayerId);
        const placementMaterialId = preferredMaterial?.id ?? sharedState?.activeMaterialId ?? null;
        const symmetryCount = session.symmetry === 'radial'
            ? Math.max(1, session.radialCount)
            : session.symmetry === 'x'
                ? 2
                : 1;
        const echoCount = session.fractalEcho ? GREEBLE_ECHO_OFFSETS.length + 1 : 1;
        const subjectMesh = sceneRef.current.meshes.get(subjectLayerId);
        const subjectCenter = subjectMesh
            ? new THREE.Box3().setFromObject(subjectMesh).getCenter(new THREE.Vector3())
            : new THREE.Vector3();

        let firstCreatedLayerId: string | null = null;

        for (let symmetryIndex = 0; symmetryIndex < symmetryCount; symmetryIndex++) {
            const angle = session.symmetry === 'radial'
                ? (symmetryIndex / symmetryCount) * Math.PI * 2
                : 0;

            for (let echoIndex = 0; echoIndex < echoCount; echoIndex++) {
                const mesh = new THREE.Mesh(createGreebleGeometry(session.shape));
                const placementPoint = point.clone();

                if (session.symmetry === 'x' && symmetryIndex === 1) {
                    placementPoint.x *= -1;
                }

                if (session.symmetry === 'radial' && subjectMesh) {
                    placementPoint.sub(subjectCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(subjectCenter);
                }

                if (session.gridLock) {
                    placementPoint.set(
                        Math.round(placementPoint.x / session.gridSize) * session.gridSize,
                        Math.round(placementPoint.y / session.gridSize) * session.gridSize,
                        Math.round(placementPoint.z / session.gridSize) * session.gridSize
                    );
                }

                if (echoIndex > 0) {
                    placementPoint.add(GREEBLE_ECHO_OFFSETS[echoIndex - 1].clone().multiplyScalar(session.scale));
                }

                mesh.position.copy(placementPoint);
                mesh.scale.setScalar(session.scale * (echoIndex > 0 ? 0.72 : 1));

                if (session.surfaceMode) {
                    orientMeshToSurfaceNormal(mesh, normal, session.voidAnchor);
                }

                if (session.chaosMode) {
                    mesh.rotation.x += (Math.random() - 0.5) * 0.6;
                    mesh.rotation.y += (Math.random() - 0.5) * Math.PI;
                    mesh.rotation.z += (Math.random() - 0.5) * 0.6;
                    const randomScale = THREE.MathUtils.lerp(0.8, 1.35, Math.random());
                    mesh.scale.multiplyScalar(randomScale);
                }

                const createdLayerId = addMeshToScene(
                    mesh,
                    `${session.shape.toUpperCase()}_${Date.now().toString().slice(-5)}`,
                    undefined,
                    {
                        select: echoIndex === 0 && symmetryIndex === 0,
                        materialId: placementMaterialId,
                        kernelMaterial: preferredMaterial
                    }
                );

                if (!firstCreatedLayerId) {
                    firstCreatedLayerId = createdLayerId;
                }
            }
        }

        if (firstCreatedLayerId) {
            handleLayerSelect(firstCreatedLayerId, false);
            setStatus(`GREEBLE PLACED ON ${subjectLayerId.toUpperCase()}`);
        }
    };

    useEffect(() => {
        if (zenWorkspaceDocument.activeModuleId !== 'scatter' || !scatterOperatorSession.enabled) {
            operatorSignatureRef.current.scatter = null;
            return;
        }

        const subjectLayerId = resolveOperatorSubjectLayerId(scatterOperatorSession.subjectLayerId);
        if (!subjectLayerId) {
            setStatus('SCATTER NEEDS AN ACTIVE SUBJECT');
            return;
        }

        const subjectMesh = sceneRef.current.meshes.get(subjectLayerId);
        if (!subjectMesh) {
            return;
        }

        const subjectPosition = subjectMesh.geometry.getAttribute('position');
        const signature = JSON.stringify({
            ...scatterOperatorSession,
            subjectLayerId,
            subjectVersion: subjectPosition?.version ?? 0,
            subjectCount: subjectPosition?.count ?? 0,
            position: [subjectMesh.position.x, subjectMesh.position.y, subjectMesh.position.z],
            rotation: [subjectMesh.rotation.x, subjectMesh.rotation.y, subjectMesh.rotation.z],
            scale: [subjectMesh.scale.x, subjectMesh.scale.y, subjectMesh.scale.z]
        });

        if (operatorSignatureRef.current.scatter === signature) {
            return;
        }

        operatorSignatureRef.current.scatter = signature;

        const scatterMesh = createScatterResultMesh(subjectMesh, scatterOperatorSession);
        if (!scatterMesh) {
            setStatus('SCATTER COULD NOT BUILD OUTPUT');
            return;
        }

        const preferredMaterial = resolvePreferredLayerMaterial(subjectLayerId);
        addMeshToScene(
            scatterMesh,
            `${layers.find((layer) => layer.id === subjectLayerId)?.name ?? 'Subject'}_Scatter`,
            undefined,
            {
                layerId: createOperatorResultLayerId('scatter', subjectLayerId),
                select: false,
                suppressHistory: true,
                materialId: preferredMaterial?.id ?? sharedState?.activeMaterialId ?? null,
                kernelMaterial: preferredMaterial
            }
        );
        setStatus(`SCATTER SYNCED (${scatterOperatorSession.objectCount} INSTANCES)`);
    }, [
        layers,
        scatterOperatorSession,
        sharedState?.activeMaterialId,
        zenWorkspaceDocument.activeModuleId
    ]);

    useEffect(() => {
        if (zenWorkspaceDocument.activeModuleId !== 'cloner' || !clonerOperatorSession.enabled) {
            operatorSignatureRef.current.cloner = null;
            return;
        }

        const subjectLayerId = resolveOperatorSubjectLayerId(clonerOperatorSession.subjectLayerId);
        if (!subjectLayerId) {
            setStatus('CLONER NEEDS AN ACTIVE SUBJECT');
            return;
        }

        const subjectMesh = sceneRef.current.meshes.get(subjectLayerId);
        if (!subjectMesh) {
            return;
        }

        const subjectPosition = subjectMesh.geometry.getAttribute('position');
        const signature = JSON.stringify({
            ...clonerOperatorSession,
            subjectLayerId,
            subjectVersion: subjectPosition?.version ?? 0,
            subjectCount: subjectPosition?.count ?? 0,
            position: [subjectMesh.position.x, subjectMesh.position.y, subjectMesh.position.z],
            rotation: [subjectMesh.rotation.x, subjectMesh.rotation.y, subjectMesh.rotation.z],
            scale: [subjectMesh.scale.x, subjectMesh.scale.y, subjectMesh.scale.z]
        });

        if (operatorSignatureRef.current.cloner === signature) {
            return;
        }

        operatorSignatureRef.current.cloner = signature;

        const clonerMesh = createClonerResultMesh(subjectMesh, clonerOperatorSession);
        if (!clonerMesh) {
            setStatus('CLONER COULD NOT BUILD OUTPUT');
            return;
        }

        const preferredMaterial = resolvePreferredLayerMaterial(subjectLayerId);
        addMeshToScene(
            clonerMesh,
            `${layers.find((layer) => layer.id === subjectLayerId)?.name ?? 'Subject'}_Cloner`,
            undefined,
            {
                layerId: createOperatorResultLayerId('cloner', subjectLayerId),
                select: false,
                suppressHistory: true,
                materialId: preferredMaterial?.id ?? sharedState?.activeMaterialId ?? null,
                kernelMaterial: preferredMaterial
            }
        );
        setStatus(`CLONER SYNCED (${clonerOperatorSession.clonerMode})`);
    }, [
        clonerOperatorSession,
        layers,
        sharedState?.activeMaterialId,
        zenWorkspaceDocument.activeModuleId
    ]);

    const saveHistory = () => {
        const { meshes, sculptHistory, historyIndex } = sceneRef.current;
        if (!activeLayerId || !meshes.has(activeLayerId)) return;

        const mesh = meshes.get(activeLayerId);
        const geo = mesh.geometry;

        const snapshot = {
            layerId: activeLayerId,
            pos: new Float32Array(geo.attributes.position.array),
            col: new Float32Array(geo.attributes.color.array),
            // Save Mask if exists
            mask: geo.attributes.mask ? new Float32Array(geo.attributes.mask.array) : null,
            // Save UV if exists
            uv: geo.attributes.uv ? new Float32Array(geo.attributes.uv.array) : null,
            // Save Index if exists
            index: geo.index ? new Uint32Array(geo.index.array) : null,
            count: geo.attributes.position.count
        };

        let newHistory = sculptHistory.slice(0, historyIndex + 1);
        newHistory.push(snapshot);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();

        sceneRef.current.sculptHistory = newHistory;
        sceneRef.current.historyIndex = newHistory.length - 1;
    };

    const undo = () => {
        const { historyIndex, sculptHistory, meshes } = sceneRef.current;
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const snapshot = sculptHistory[newIndex];
            const mesh = meshes.get(snapshot.layerId);

            if (mesh) {
                // Check if topology changed (count or index presence mismatch)
                const currentGeo = mesh.geometry;
                const topoChanged = snapshot.count !== currentGeo.attributes.position.count ||
                    (!!snapshot.index !== !!currentGeo.index) ||
                    (snapshot.index && currentGeo.index && snapshot.index.length !== currentGeo.index.count);

                if (topoChanged) {
                    // Full Rebuild
                    const newGeo = new THREE.BufferGeometry();
                    newGeo.setAttribute('position', new THREE.BufferAttribute(snapshot.pos, 3));
                    newGeo.setAttribute('color', new THREE.BufferAttribute(snapshot.col, 3));
                    if (snapshot.mask) newGeo.setAttribute('mask', new THREE.BufferAttribute(snapshot.mask, 1));
                    if (snapshot.uv) newGeo.setAttribute('uv', new THREE.BufferAttribute(snapshot.uv, 2));
                    if (snapshot.index) newGeo.setIndex(new THREE.BufferAttribute(snapshot.index, 1));

                    newGeo.computeVertexNormals();
                    newGeo.computeBoundingBox();

                    mesh.geometry.dispose();
                    mesh.geometry = newGeo;

                    // Rebuild Optimization Structures
                    // @ts-ignore
                    newGeo.computeBoundsTree();
                    if (sceneRef.current.topology) sceneRef.current.topology.build(newGeo);

                } else {
                    // Fast Path: Update Attributes
                    mesh.geometry.attributes.position.array.set(snapshot.pos);
                    mesh.geometry.attributes.color.array.set(snapshot.col);
                    mesh.geometry.attributes.position.needsUpdate = true;
                    mesh.geometry.attributes.color.needsUpdate = true;

                    if (snapshot.mask && mesh.geometry.attributes.mask) {
                        mesh.geometry.attributes.mask.array.set(snapshot.mask);
                        mesh.geometry.attributes.mask.needsUpdate = true;
                    }

                    mesh.geometry.computeVertexNormals();
                }

                if (activeLayerId !== snapshot.layerId) setActiveLayerId(snapshot.layerId);

                // Update Polycount in UI
                const count = mesh.geometry.attributes.position.count;
                setLayers(prev => prev.map(l => l.id === snapshot.layerId ? { ...l, polyCount: count } : l));

                sceneRef.current.historyIndex = newIndex;
                setStatus("UNDO");
            }
        }
    };

    // --- INTERACTION ---

    const handleStepUp = () => {
        const { meshes } = sceneRef.current;
        if (!activeLayerId || !meshes.has(activeLayerId)) return;
        const mesh = meshes.get(activeLayerId);

        setStatus("SUBDIVIDING GEOMETRY...");
        setTimeout(async () => {
            let oldGeo = mesh.geometry;

            // --- RUST SUBDIVISION (Loop) ---
            // If indexed, try Rust
            if (oldGeo.index) {
                const attrMap: any[] = [];
                const attributesToSend: any[] = [];
                if (oldGeo.attributes.uv) {
                    attrMap.push({ type: 'uv', size: 2 });
                    attributesToSend.push({ values: Array.from(oldGeo.attributes.uv.array), item_size: 2 });
                }
                if (oldGeo.attributes.color) {
                    attrMap.push({ type: 'color', size: 3 });
                    attributesToSend.push({ values: Array.from(oldGeo.attributes.color.array), item_size: 3 });
                }
                if (oldGeo.attributes.mask) {
                    attrMap.push({ type: 'mask', size: 1 });
                    attributesToSend.push({ values: Array.from(oldGeo.attributes.mask.array), item_size: 1 });
                }

                const result = await rustSubdivide.subdivide(
                    oldGeo.attributes.position.array as Float32Array,
                    oldGeo.index.array as Uint32Array,
                    attributesToSend,
                    1
                );

                if (result) {
                    const newGeo = new THREE.BufferGeometry();
                    newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(result.positions), 3));
                    newGeo.setIndex(result.indices);

                    // Restore attributes
                    result.attributes.forEach((attr, idx) => {
                        const map = attrMap[idx];
                        if (map) newGeo.setAttribute(map.type, new THREE.BufferAttribute(new Float32Array(attr.values), map.size));
                    });

                    // Finalize (duplicate of bottom logic)
                    mesh.geometry.dispose();
                    mesh.geometry = newGeo;
                    newGeo.computeVertexNormals();
                    // @ts-ignore
                    newGeo.computeBoundsTree();
                    if (sceneRef.current.topology) sceneRef.current.topology.build(newGeo);

                    rustSculptManager.disposeMesh(mesh).then(() => rustSculptManager.registerMesh(mesh));
                    rustRaycastManager.disposeMesh(mesh).then(() => rustRaycastManager.registerMesh(mesh));

                    setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, polyCount: newGeo.attributes.position.count } : l));
                    setSubdivisionLevel(prev => prev + 1);
                    saveHistory();
                    setStatus("MESH SUBDIVIDED");
                    console.log(`[KSculpt] Rust subdivision success: ${result.vertex_count} vertices`);
                    return; // SKIP JS FALLBACK
                }
            }

            // --- JS FALLBACK ---
            console.warn("[KSculpt] Falling back to JS subdivision");
            if (oldGeo.index) oldGeo = oldGeo.toNonIndexed();

            const pos = oldGeo.attributes.position;
            const col = oldGeo.attributes.color;
            const uvAttr = oldGeo.attributes.uv; // Get UVs
            const maskAttr = oldGeo.attributes.mask; // Get Mask

            const positions = [];
            const colors = [];
            const uvs: number[] = []; // Store new UVs
            const masks: number[] = []; // Store new Masks

            for (let i = 0; i < pos.count; i += 3) {
                const vA = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                const vB = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
                const vC = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

                const cA = new THREE.Color(col.getX(i), col.getY(i), col.getZ(i));
                const cB = new THREE.Color(col.getX(i + 1), col.getY(i + 1), col.getZ(i + 1));
                const cC = new THREE.Color(col.getX(i + 2), col.getY(i + 2), col.getZ(i + 2));

                // UVs
                let uvA = new THREE.Vector2(), uvB = new THREE.Vector2(), uvC = new THREE.Vector2();
                if (uvAttr) {
                    uvA.set(uvAttr.getX(i), uvAttr.getY(i));
                    uvB.set(uvAttr.getX(i + 1), uvAttr.getY(i + 1));
                    uvC.set(uvAttr.getX(i + 2), uvAttr.getY(i + 2));
                }

                // Masks (Default to 0 if missing)
                const mA = maskAttr ? maskAttr.getX(i) : 0;
                const mB = maskAttr ? maskAttr.getX(i + 1) : 0;
                const mC = maskAttr ? maskAttr.getX(i + 2) : 0;

                const vAB = vA.clone().add(vB).multiplyScalar(0.5);
                const vBC = vB.clone().add(vC).multiplyScalar(0.5);
                const vCA = vC.clone().add(vA).multiplyScalar(0.5);

                const cAB = cA.clone().lerp(cB, 0.5);
                const cBC = cB.clone().lerp(cC, 0.5);
                const cCA = cC.clone().lerp(cA, 0.5);

                // Interpolate UVs
                const uvAB = uvA.clone().lerp(uvB, 0.5);
                const uvBC = uvB.clone().lerp(uvC, 0.5);
                const uvCA = uvC.clone().lerp(uvA, 0.5);

                // Interpolate Masks
                const mAB = (mA + mB) * 0.5;
                const mBC = (mB + mC) * 0.5;
                const mCA = (mC + mA) * 0.5;

                const push = (v: any, clr: any, uv: any, m: number) => {
                    positions.push(v.x, v.y, v.z);
                    colors.push(clr.r, clr.g, clr.b);
                    if (uvAttr) uvs.push(uv.x, uv.y);
                    masks.push(m);
                };

                push(vA, cA, uvA, mA); push(vAB, cAB, uvAB, mAB); push(vCA, cCA, uvCA, mCA);
                push(vAB, cAB, uvAB, mAB); push(vB, cB, uvB, mB); push(vBC, cBC, uvBC, mBC);
                push(vCA, cCA, uvCA, mCA); push(vBC, cBC, uvBC, mBC); push(vC, cC, uvC, mC);
                push(vAB, cAB, uvAB, mAB); push(vBC, cBC, uvBC, mBC); push(vCA, cCA, uvCA, mCA);
            }

            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            newGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            if (uvAttr) {
                newGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            }
            // Add Interpolated Mask
            newGeo.setAttribute('mask', new THREE.Float32BufferAttribute(masks, 1));

            const mergedGeo = BufferGeometryUtils.mergeVertices(newGeo);
            mergedGeo.computeVertexNormals();

            mesh.geometry.dispose();
            mesh.geometry = mergedGeo;

            // Rebuild BVH
            // @ts-ignore
            mergedGeo.computeBoundsTree();

            // Rebuild Topology
            if (sceneRef.current.topology) {
                sceneRef.current.topology.build(mergedGeo);
            }

            // Re-register with Rust backend (geometry changed completely)
            rustSculptManager.disposeMesh(mesh).then(() => {
                rustSculptManager.registerMesh(mesh).then((handle) => {
                    if (handle) {
                        console.log(`[KSculpt] Sculpt mesh re-registered after subdivide (handle: ${handle})`);
                    }
                });
            });

            // Re-register raycast mesh (parry3d BVH)
            rustRaycastManager.disposeMesh(mesh).then(() => {
                rustRaycastManager.registerMesh(mesh).then((handle) => {
                    if (handle) {
                        console.log(`[KSculpt] Raycast mesh re-registered after subdivide (handle: ${handle})`);
                    }
                });
            });

            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, polyCount: mergedGeo.attributes.position.count } : l));
            setSubdivisionLevel(prev => prev + 1);

            saveHistory();
            setStatus("MESH SUBDIVIDED");
        }, 50);
    };

    const updateTransformFromUI = (key: string, value: number) => {
        const { meshes } = sceneRef.current;
        if (!activeLayerId || !meshes.has(activeLayerId)) return;
        const mesh = meshes.get(activeLayerId);

        const safeVal = isNaN(value) ? 0 : value;
        setTransformData(prev => ({ ...prev, [key]: safeVal }));

        switch (key) {
            case 'posX': mesh.position.x = safeVal; break;
            case 'posY': mesh.position.y = safeVal; break;
            case 'posZ': mesh.position.z = safeVal; break;
            case 'rotX': mesh.rotation.x = safeVal; break;
            case 'rotY': mesh.rotation.y = safeVal; break;
            case 'rotZ': mesh.rotation.z = safeVal; break;
            case 'scaleX': mesh.scale.x = safeVal || 0.001; break;
            case 'scaleY': mesh.scale.y = safeVal || 0.001; break;
            case 'scaleZ': mesh.scale.z = safeVal || 0.001; break;
        }
    };

    const onPointerMove = (e: any) => {
        // Logic moved to input tick loop for performance
        return;

        const { camera, raycaster, meshes, brushCursor, symmetryCursor, isSculpting, moveData } = sceneRef.current;
        if (!camera) return;

        const rect = mountRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera({ x, y }, camera);

        if (mode === 'SCULPT') {
            if (activeTool === 'SELECT') {
                if (brushCursor) brushCursor.visible = false;
                if (symmetryCursor) symmetryCursor.visible = false;
                document.body.style.cursor = 'pointer';
                return;
            }

            if (!activeLayerId || !meshes.has(activeLayerId)) return;
            const mesh = meshes.get(activeLayerId);

            // --- RUST RAYCAST (FAST) ---
            // Request async raycast (throttled to 60fps, results cached)
            const ray = raycaster.ray;
            rustRaycastManager.requestRaycast(
                mesh,
                ray.origin,
                ray.direction,
                1000
            );

            // Check for cached hit from Rust
            const cachedHit = rustRaycastManager.getCachedHit();
            let hit = null;

            if (cachedHit) {
                // Use cached Rust result (fast path)
                hit = {
                    point: new THREE.Vector3(cachedHit.point.x, cachedHit.point.y, cachedHit.point.z),
                    face: { normal: new THREE.Vector3(cachedHit.normal.x, cachedHit.normal.y, cachedHit.normal.z) },
                    distance: cachedHit.distance,
                };
            } else {
                // Fallback to JS raycast (slow but necessary for first frame)
                const intersects = raycaster.intersectObject(mesh);
                if (intersects.length > 0) {
                    hit = intersects[0];
                }
            }

            if (hit) {
                // GPU Brush Cursor - no 3D geometry, just shader projection!
                gpuBrushCursor.update(hit, radius, symmetry);
                sceneRef.current.hoverPoint = hit.point;
                sceneRef.current.hoverNormal = hit.face?.normal || new THREE.Vector3(0, 1, 0);

                // Hide old 3D cursors (legacy)
                if (brushCursor) brushCursor.visible = false;
                if (symmetryCursor) symmetryCursor.visible = false;

                if (isSculpting && activeTool !== 'MOVE' && activeTool !== 'STRETCH') {
                    applyBrush(hit.point, hit.face!.normal); // Throttle is inside applyBrush
                }
            } else if (!isSculpting) {
                gpuBrushCursor.hide();
                if (brushCursor) brushCursor.visible = false;
                if (symmetryCursor) symmetryCursor.visible = false;
                sceneRef.current.hoverPoint = null;
            }

            // --- MOVE & STRETCH DRAG LOGIC ---
            if (isSculpting && (activeTool === 'MOVE' || activeTool === 'STRETCH') && moveData) {

                if (activeTool === 'STRETCH') {
                    // STRETCH: Deform along normal based on vertical mouse movement
                    const dy = (e.clientY - moveData.dragStartMouse.y);
                    const stretchFactor = dy * 0.01; // Sensitivity

                    // Dragging up (negative dy) should pull out (positive normal)
                    const worldDelta = moveData.grabNormal.clone().multiplyScalar(-stretchFactor);

                    const invMat = mesh.matrixWorld.clone();
                    if (Math.abs(invMat.determinant()) < 1e-9) {
                        invMat.invert();
                        const localDelta = worldDelta.clone().transformDirection(invMat); // Convert direction to local
                        const posAttr = mesh.geometry.attributes.position;

                        for (let i = 0; i < moveData.indices.length; i++) {
                            const idx = moveData.indices[i];
                            const w = moveData.weights[i];
                            const orig = moveData.initialPos[i];
                            const moveVec = localDelta.clone().multiplyScalar(w);
                            posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                        }

                        // Symmetry Stretch
                        if (symmetry === 'X' && moveData.symIndices) {
                            const symDelta = localDelta.clone();
                            symDelta.x *= -1;
                            for (let i = 0; i < moveData.symIndices.length; i++) {
                                const idx = moveData.symIndices[i];
                                const w = moveData.symWeights[i];
                                const orig = moveData.symInitialPos[i];
                                const moveVec = symDelta.clone().multiplyScalar(w);
                                posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                            }
                        }
                        posAttr.needsUpdate = true;
                    }
                } else {
                    // MOVE: Screen Space Drag
                    const targetPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(moveData.screenPlane, targetPoint);
                    if (targetPoint) {
                        const invMat = mesh.matrixWorld.clone();
                        if (Math.abs(invMat.determinant()) < 1e-9) {
                            invMat.invert();
                            const localTarget = targetPoint.clone().applyMatrix4(invMat);
                            const localGrab = moveData.grabPoint.clone().applyMatrix4(invMat);
                            const localDelta = localTarget.sub(localGrab);
                            const posAttr = mesh.geometry.attributes.position;

                            if (!isNaN(localDelta.x)) {
                                for (let i = 0; i < moveData.indices.length; i++) {
                                    const idx = moveData.indices[i];
                                    const w = moveData.weights[i];
                                    const orig = moveData.initialPos[i];
                                    const moveVec = localDelta.clone().multiplyScalar(w);
                                    posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                }

                                if (symmetry === 'X' && moveData.symIndices) {
                                    const symDelta = localDelta.clone();
                                    symDelta.x *= -1;
                                    for (let i = 0; i < moveData.symIndices.length; i++) {
                                        const idx = moveData.symIndices[i];
                                        const w = moveData.symWeights[i];
                                        const orig = moveData.symInitialPos[i];
                                        const moveVec = symDelta.clone().multiplyScalar(w);
                                        posAttr.setXYZ(idx, orig.x + moveVec.x, orig.y + moveVec.y, orig.z + moveVec.z);
                                    }
                                }
                                posAttr.needsUpdate = true;
                            }
                        }
                    }
                }
            }
        }
    };

    // --- INPUT HANDLING ---
    useEffect(() => {
        const sharedTransformModules = new Set(['sculpt', 'greeble', 'scatter', 'cloner', 'rig', 'tecton']);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.matches('input, textarea')) return;
            if (!sharedTransformModules.has(zenWorkspaceDocument.activeModuleId)) return;

            if (e.key.toLowerCase() === 'w') {
                if (mode !== 'TRANSFORM') {
                    setMode('TRANSFORM');
                    setGizmoMode('translate');
                    setTransformSpace('world');
                    setStatus("TRANSFORM MODE ACTIVE");
                }
                return;
            }

            if (e.key.toLowerCase() === 'e') {
                if (mode !== 'TRANSFORM') {
                    setMode('TRANSFORM');
                    setTransformSpace('world');
                    setStatus("TRANSFORM MODE ACTIVE");
                }
                setGizmoMode('rotate');
                return;
            }

            if (e.key.toLowerCase() === 'r') {
                if (mode !== 'TRANSFORM') {
                    setMode('TRANSFORM');
                    setTransformSpace('world');
                    setStatus("TRANSFORM MODE ACTIVE");
                }
                setGizmoMode('scale');
                return;
            }

            // ESC: Exit Transform (if active)
            if (e.key === 'Escape') {
                if (mode === 'TRANSFORM') {
                    setMode('SCULPT');
                    setStatus("SCULPT MODE RESUMED");
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, setGizmoMode, setTransformSpace, zenWorkspaceDocument.activeModuleId]);

    const onPointerDown = (e: any) => {
        if (e.button !== 0) return;

        if (usesPassiveOverlayPointerPolicy) {
            return;
        }

        if (usesToolPrimaryAltOrbit && e.altKey) {
            return;
        }

        // --- BEVY HISTORY SNAPSHOT ---
        // Save state before starting a new stroke
        leashClient.historySnapshot('sculpt');

        // Gizmo Protection (if transform controls are active, let them handle it)
        // (Usually handled by TransformControls internal events, but if we click OFF, we might want to deselect)
        if (sceneRef.current) {
            // Initialize Topology system if missing
            if (!sceneRef.current.topology) {
                sceneRef.current.topology = new MeshTopology();
            }

            // Re-mount logic if needed...
            const { camera, renderer, scene } = sceneRef.current;
        }
        const { camera, meshes } = sceneRef.current;
        const rect = mountRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

        // CHECK INTERSECTIONS
        const allMeshes = Array.from(meshes.values());
        const intersects = raycaster.intersectObjects(allMeshes as THREE.Object3D[]);

        if (zenWorkspaceDocument.activeModuleId === 'greeble' && greebleOperatorSession.enabled && !e.shiftKey) {
            const subjectLayerId = resolveOperatorSubjectLayerId(greebleOperatorSession.subjectLayerId);
            const subjectMesh = subjectLayerId ? sceneRef.current.meshes.get(subjectLayerId) : null;
            const subjectHits = subjectMesh
                ? raycaster.intersectObject(subjectMesh, false)
                : intersects;

            if (subjectHits.length > 0) {
                const hit = subjectHits[0];
                const worldNormal = hit.face?.normal
                    ? hit.face.normal.clone().transformDirection((hit.object as THREE.Object3D).matrixWorld)
                    : new THREE.Vector3(0, 1, 0);
                applySharedGreeblePlacement(hit.point.clone(), worldNormal, greebleOperatorSession);
            } else {
                setStatus('GREEBLE NEEDS A SURFACE HIT');
            }
            return;
        }

        if (
            (zenWorkspaceDocument.activeModuleId === 'scatter' || zenWorkspaceDocument.activeModuleId === 'cloner')
            && !e.shiftKey
        ) {
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                let foundId = null;
                meshes.forEach((m: THREE.Mesh, id: string) => {
                    if (m.uuid === hitMesh.uuid) foundId = id;
                });

                if (foundId) {
                    handleLayerSelect(foundId, false);
                    setMode('TRANSFORM');
                    setGizmoMode('translate');
                    setStatus(`ACTIVE SUBJECT: ${(hitMesh as any).name}`);
                }
            } else {
                setStatus(`${zenWorkspaceDocument.activeModuleId.toUpperCase()} READY`);
            }
            return;
        }

        // SHIFT-CLICK OR SELECT TOOL: Smart Selection
        if (e.shiftKey || activeTool === 'SELECT') {
            if (intersects.length > 0) {
                const hitMesh = intersects[0].object;
                let foundId = null;
                meshes.forEach((m: THREE.Mesh, id: string) => {
                    if (m.uuid === hitMesh.uuid) foundId = id;
                });

                if (foundId) {
                    handleLayerSelect(foundId, false); // Select it

                    if (e.shiftKey) {
                        // SMART GIZMO TRIGGER
                        // If already in transform on this object, toggle off? Or maybe just ensure ON.
                        // User said: "shift click... and it also toggles the gizmo"
                        setMode('TRANSFORM');
                        setGizmoMode('translate');
                        setStatus(`QUICK MOVE: ${(hitMesh as any).name}`);
                    } else {
                        setStatus(`SELECTED: ${(hitMesh as any).name}`);
                    }
                }
            } else {
                // Clicked Empty Space
                if (mode === 'TRANSFORM') {
                    setMode('SCULPT');
                    setStatus("SCULPT MODE RESUMED");
                }
            }
            return;
        }

        if (mode === 'TRANSFORM') return; // Let Gizmo handle input

        const { hoverPoint, hoverNormal } = sceneRef.current;
        if (activeLayerId && hoverPoint && meshes.has(activeLayerId)) {
            const mesh = meshes.get(activeLayerId);
            sceneRef.current.isSculpting = true;
            sceneRef.current.controls.enabled = false;

            // ... SCULPT LOGIC ...

            if (activeTool === 'MOVE' || activeTool === 'STRETCH') {
                // Prepare Move/Stretch Data (Indices, Weights)
                const posAttr = mesh.geometry.attributes.position;
                const indices = []; const weights = []; const initialPos = [];

                const symIndices = []; const symWeights = []; const symInitialPos = [];

                const invMat = mesh.matrixWorld.clone();
                if (Math.abs(invMat.determinant()) < 1e-9) return;
                invMat.invert();

                const localHover = hoverPoint.clone().applyMatrix4(invMat);
                const symLocalHover = localHover.clone();
                symLocalHover.x *= -1;

                const scale = new THREE.Vector3();
                mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
                const safeScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
                const localRadius = radius / safeScale;
                const rSq = (localRadius / 2) * (localRadius / 2);

                for (let i = 0; i < posAttr.count; i++) {
                    const px = posAttr.getX(i); const py = posAttr.getY(i); const pz = posAttr.getZ(i);

                    // Main Brush
                    const dx = px - localHover.x;
                    const dy = py - localHover.y;
                    const dz = pz - localHover.z;
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < rSq) {
                        const falloff = Math.pow(1 - distSq / rSq, 2); // Soft falloff
                        indices.push(i);
                        weights.push(falloff);
                        initialPos.push(new THREE.Vector3(px, py, pz));
                    }

                    // Symmetry Brush
                    if (symmetry === 'X') {
                        const sdx = px - symLocalHover.x;
                        const sdy = py - symLocalHover.y;
                        const sdz = pz - symLocalHover.z;
                        const sDistSq = sdx * sdx + sdy * sdy + sdz * sdz;

                        if (sDistSq < rSq) {
                            const falloff = Math.pow(1 - sDistSq / rSq, 2);
                            symIndices.push(i);
                            symWeights.push(falloff);
                            symInitialPos.push(new THREE.Vector3(px, py, pz));
                        }
                    }
                }

                // Plane for Screen-Space Move
                const screenPlane = new THREE.Plane();
                const normal = camera.getWorldDirection(new THREE.Vector3());
                screenPlane.setFromNormalAndCoplanarPoint(normal, hoverPoint);

                sceneRef.current.moveData = {
                    indices, weights, initialPos,
                    symIndices, symWeights, symInitialPos,
                    grabPoint: hoverPoint.clone(),
                    grabNormal: hoverNormal.clone(),
                    screenPlane,
                    dragStartMouse: { x: e.clientY, y: e.clientY } // Store Y for Stretch
                };
            } else {
                saveHistory();
            }
        }
    };

    const onPointerUp = () => {
        // Refit BVH if we sculpted
        if (sceneRef.current.isSculpting && activeLayerId) {
            const mesh = sceneRef.current.meshes.get(activeLayerId);
            if (mesh) {
                // @ts-ignore - Refit BVH (fast incremental update)
                if (mesh.geometry.boundsTree) mesh.geometry.boundsTree.refit();

                // REMOVED: mesh.geometry.computeVertexNormals()
                // Normals are now computed in Rust during each brush stroke
                // and applied via applyBrushResultToGeometry() - no JS freeze!

                // Mark mesh as dirty for raycast sync (async, non-blocking)
                rustRaycastManager.markDirty(mesh);
                // TODO: Share mesh state between sculpt and raycast modules in Rust
                // to eliminate this IPC entirely
            }
        }

        sceneRef.current.isSculpting = false;
        sceneRef.current.controls.enabled = true;
        sceneRef.current.moveData = null;
    };

    const applyBrush = async (point: THREE.Vector3, normal: THREE.Vector3) => {
        // THROTTLE: Skip if brush is already busy (prevents async overlap)
        if (sceneRef.current.isBrushBusy) return;

        const now = Date.now(); // Use Date.now() to avoid performance shadowing
        if (now - sceneRef.current.lastBrushTime < 16) return; // 16ms = ~60fps max

        sceneRef.current.isBrushBusy = true;
        sceneRef.current.lastBrushTime = now;

        const { meshes, topology, settings } = sceneRef.current;
        const { activeLayerId, brushMode, intensity, activeTool, radius, symmetry, dynamicTopology, detailSize } = settings;

        if (!activeLayerId || !meshes.has(activeLayerId)) {
            sceneRef.current.isBrushBusy = false;
            return;
        }
        const mesh = meshes.get(activeLayerId);

        // Apply Brush Mode (Add/Sub)
        const effectiveIntensity = brushMode === 'SUB' ? -intensity : intensity;

        try {
            // Use Rust-accelerated sculpting (with automatic JS fallback)
            await applyBrushRust(
                mesh,
                topology,
                point,
                normal,
                radius,
                effectiveIntensity,
                activeTool,
                symmetry,
                null, // Alpha Texture (Todo)
                dynamicTopology,
                detailSize
            );
        } finally {
            sceneRef.current.isBrushBusy = false;
        }
    };

    const commitToKernel = () => {
        if (!onCommit) return;

        // collect visible layers
        const visibleLayers = layers.filter(l => l.visible);
        if (visibleLayers.length === 0) {
            setStatus("NOTHING TO EXPORT");
            return;
        }

        setStatus("EXPORTING TO KERNEL...");

        try {
            const exportScene = new THREE.Scene();
            const meshesToDispose: THREE.Mesh[] = [];

            visibleLayers.forEach(layer => {
                const mesh = sceneRef.current.meshes.get(layer.id);
                if (mesh) {
                    const exportMesh = mesh.clone();
                    exportMesh.name = layer.name;
                    exportMesh.userData = {}; // Clear internal data

                    const overlayChildren: THREE.Object3D[] = [];
                    exportMesh.traverse((child) => {
                        if ((child as any).userData?.isMatcapOverlay) {
                            overlayChildren.push(child);
                        }
                    });
                    overlayChildren.forEach((child) => child.parent?.remove(child));

                    exportScene.add(exportMesh);
                    meshesToDispose.push(exportMesh);
                }
            });

            const exporter = new GLTFExporter();
            exporter.parse(
                exportScene,
                (result) => {
                    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
                    onCommit(blob, "SCULPT_EXPORT");
                    setStatus(`UPLOAD COMPLETE (${visibleLayers.length} MESHES)`);

                    // Cleanup
                    meshesToDispose.forEach(m => {
                        if ((m.material as any).isMeshStandardMaterial) {
                            (m.material as THREE.Material).dispose();
                        }
                    });
                },
                (err) => {
                    console.error("Export Error:", err);
                    setStatus("EXPORT FAILED: " + (err.message || "Unknown"));
                    // Cleanup
                    meshesToDispose.forEach(m => {
                        if ((m.material as any).isMeshStandardMaterial) {
                            (m.material as THREE.Material).dispose();
                        }
                    });
                },
                { binary: true }
            );
        } catch (e: any) {
            console.error("Export Crash:", e);
            setStatus("EXPORT CRASH: " + e.message);
        }
    };

    const handleToggleVis = (id: string) => {
        const mesh = sceneRef.current.meshes.get(id);
        if (mesh) {
            mesh.visible = !mesh.visible;
            setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: mesh.visible } : l));
        }
    };

    const handleDeleteLayer = (id: string) => {
        const mesh = sceneRef.current.meshes.get(id);
        if (mesh) {
            disposeMeshResources(mesh);
            sceneRef.current.meshes.delete(id);
            setLayers(prev => prev.filter(l => l.id !== id));
            if (activeLayerId === id) setActiveLayerId(null);
            setSelectedLayerIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            removeSceneEntity(createSculptEntityId(id));
        }
    };

    // --- MASK OPERATIONS ---

    const clearMask = () => {
        if (!activeLayerId) return;
        const mesh = sceneRef.current.meshes.get(activeLayerId);
        if (mesh && mesh.geometry.attributes.mask) {
            const maskAttr = mesh.geometry.attributes.mask;
            const arr = maskAttr.array as Float32Array;
            arr.fill(0);
            maskAttr.needsUpdate = true;
        }
    };

    const invertMask = () => {
        if (!activeLayerId) return;
        const mesh = sceneRef.current.meshes.get(activeLayerId);
        if (mesh && mesh.geometry.attributes.mask) {
            const maskAttr = mesh.geometry.attributes.mask;
            const arr = maskAttr.array as Float32Array;
            for (let i = 0; i < arr.length; i++) {
                arr[i] = 1.0 - arr[i];
            }
            maskAttr.needsUpdate = true;
        }
    };

    const extractMask = () => {
        if (!activeLayerId) return;
        const mesh = sceneRef.current.meshes.get(activeLayerId);
        if (!mesh || !mesh.geometry.attributes.mask) return;

        const maskAttr = mesh.geometry.attributes.mask;
        const posAttr = mesh.geometry.attributes.position;
        const colAttr = mesh.geometry.attributes.color;
        const indexAttr = mesh.geometry.index;

        const validFaces: number[] = [];
        const oldToNewIndex = new Map<number, number>();
        const newPositions: number[] = [];
        const newColors: number[] = [];
        const newIndices: number[] = [];

        const isMasked = (idx: number) => maskAttr.getX(idx) > 0.1;

        // Collect Faces
        if (indexAttr) {
            for (let i = 0; i < indexAttr.count; i += 3) {
                const a = indexAttr.getX(i);
                const b = indexAttr.getX(i + 1);
                const c = indexAttr.getX(i + 2);
                if (isMasked(a) && isMasked(b) && isMasked(c)) validFaces.push(a, b, c);
            }
        } else {
            for (let i = 0; i < posAttr.count; i += 3) {
                if (isMasked(i) && isMasked(i + 1) && isMasked(i + 2)) validFaces.push(i, i + 1, i + 2);
            }
        }

        if (validFaces.length === 0) {
            setStatus("NO MASK TO EXTRACT");
            return;
        }

        // Build Base Surface
        const getOrAddVertex = (oldIdx: number) => {
            if (oldToNewIndex.has(oldIdx)) return oldToNewIndex.get(oldIdx)!;
            const newIdx = newPositions.length / 3;
            newPositions.push(posAttr.getX(oldIdx), posAttr.getY(oldIdx), posAttr.getZ(oldIdx));
            if (colAttr) newColors.push(colAttr.getX(oldIdx), colAttr.getY(oldIdx), colAttr.getZ(oldIdx));
            else newColors.push(1, 1, 1);
            oldToNewIndex.set(oldIdx, newIdx);
            return newIdx;
        };

        validFaces.forEach(oldIdx => newIndices.push(getOrAddVertex(oldIdx)));

        // --- PANEL LOOPS (THICKNESS) ---
        if (extractionThickness > 0.0001) {
            // 1. Compute Base Geometry Logic
            const frontGeo = new THREE.BufferGeometry();
            frontGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
            frontGeo.setIndex(newIndices);
            frontGeo.computeVertexNormals();

            const posV = frontGeo.attributes.position.array as Float32Array;
            const normV = frontGeo.attributes.normal.array as Float32Array;
            const count = posV.length / 3;

            const finalPos: number[] = Array.from(posV);
            const finalCol: number[] = Array.from(newColors);
            const finalInd: number[] = Array.from(newIndices);

            // 2. Create Back Shell (Offset)
            for (let i = 0; i < count; i++) {
                const x = posV[i * 3]; const y = posV[i * 3 + 1]; const z = posV[i * 3 + 2];
                const nx = normV[i * 3]; const ny = normV[i * 3 + 1]; const nz = normV[i * 3 + 2];

                finalPos.push(x - nx * extractionThickness);
                finalPos.push(y - ny * extractionThickness);
                finalPos.push(z - nz * extractionThickness);

                finalCol.push(finalCol[i * 3], finalCol[i * 3 + 1], finalCol[i * 3 + 2]);
            }

            // 3. Faces for Back Shell (Inverted Winding)
            for (let i = 0; i < newIndices.length; i += 3) {
                finalInd.push(newIndices[i + 2] + count, newIndices[i + 1] + count, newIndices[i] + count);
            }

            // 4. Stitch Borders
            const edgeMap = new Map<string, number>();
            for (let i = 0; i < newIndices.length; i += 3) {
                const u = newIndices[i]; const v = newIndices[i + 1]; const w = newIndices[i + 2];
                const add = (a: number, b: number) => {
                    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
                    edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
                };
                add(u, v); add(v, w); add(w, u);
            }

            for (let i = 0; i < newIndices.length; i += 3) {
                const edges = [[newIndices[i], newIndices[i + 1]], [newIndices[i + 1], newIndices[i + 2]], [newIndices[i + 2], newIndices[i]]];
                edges.forEach(([u, v]) => {
                    const key = u < v ? `${u}_${v}` : `${v}_${u}`;
                    if (edgeMap.get(key) === 1) {
                        // Boundary Edge -> Create Quad
                        // Front: u -> v. Back: v+count -> u+count
                        finalInd.push(u, v, v + count);
                        finalInd.push(u, v + count, u + count);
                    }
                });
            }

            newPositions.length = 0; newPositions.push(...finalPos);
            newColors.length = 0; newColors.push(...finalCol);
            newIndices.length = 0; newIndices.push(...finalInd);
        }

        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
        if (newColors.length > 0) newGeo.setAttribute('color', new THREE.Float32BufferAttribute(newColors, 3));
        newGeo.setIndex(newIndices);

        // Initial Mask Clear on new mesh
        const newCount = newPositions.length / 3;
        newGeo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(newCount).fill(0), 1));

        newGeo.computeVertexNormals();

        const newMesh = new THREE.Mesh(newGeo);
        // Copy transform
        newMesh.position.copy(mesh.position);
        newMesh.rotation.copy(mesh.rotation);
        newMesh.scale.copy(mesh.scale);

        // Offset slightly if shell
        if (extractionThickness <= 0.0001) newMesh.position.add(new THREE.Vector3(0.01, 0.01, 0.01));

        const newName = `${layers.find(l => l.id === activeLayerId)?.name || 'Mesh'}_Extracted`;
        addMeshToScene(newMesh, newName); // Adds to scene and layer system
        setStatus(`MASK EXTRACTED (${extractionThickness > 0 ? 'SOLID' : 'SHELL'})`);
    };

    // --- VOXEL REMESHER (RUST POWERED) ---
    const handleVoxelRemesh = async () => {
        if (!activeLayerId || !sceneRef.current.meshes.has(activeLayerId)) return;
        const mesh = sceneRef.current.meshes.get(activeLayerId)!;

        saveHistory(); // Undo Step
        setStatus("REMESHING (RUST)...");

        try {
            // Extract geometry data
            const geo = mesh.geometry;
            const posAttr = geo.attributes.position;
            const positions = Array.from(posAttr.array as Float32Array);
            const indices = geo.index ? Array.from(geo.index.array as Uint32Array) : [];

            if (indices.length === 0) {
                // Non-indexed geometry - skip
                setStatus("REMESH FAILED: Non-indexed geometry");
                return;
            }

            // Call Rust remesher (100 = resolution, higher = more detail)
            const { rustRemesh } = await import('../../../services/remeshClient');
            const result = await rustRemesh.remesh(positions, indices, 100);

            // Create new geometry from Rust result
            const newGeo = new THREE.BufferGeometry();
            newGeo.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3));
            newGeo.setIndex(result.indices);
            newGeo.computeVertexNormals();

            // Add required attributes
            const count = result.positions.length / 3;
            newGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
            newGeo.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(count).fill(0), 1));

            // Replace Geometry
            mesh.geometry.dispose();
            mesh.geometry = newGeo;

            // Rebuild BVH
            // @ts-ignore
            newGeo.computeBoundsTree();

            // Update Poly Count
            setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, polyCount: count } : l));

            setStatus(`REMESHED (RUST) - ${count} Verts - ${result.time_ms.toFixed(1)}ms`);
        } catch (err: any) {
            console.error("Rust remesh failed:", err);
            setStatus(`REMESH FAILED: ${err.message || err}`);
        }
    };

    useEffect(() => {
        const r = sceneRef.current;
        if (r.transformControl && activeLayerId && r.meshes.has(activeLayerId)) {
            if (mode === 'TRANSFORM') {
                r.transformControl.attach(r.meshes.get(activeLayerId));
            } else {
                r.transformControl.detach();
            }
        }
    }, [activeLayerId, mode]);

    // Use Keybinds with Frame support
    useKSculptKeybinds(
        activeTool,
        setRadius,
        setActiveTool,
        undo,
        setWireframe,
        handleFrameActive,
        handleCycleLayer,
        () => { setMenuPos(mousePosRef.current); setIsBrushMenuOpen(p => !p); }, // Toggle Brush Menu
        () => { setMenuPos(mousePosRef.current); setIsAlphaMenuOpen(p => !p); },  // Toggle Alpha Menu
        () => setSymmetry(prev => prev === 'X' ? 'NONE' : 'X'),
        () => {
            setIsSpaceMenuOpen((open) => {
                if (open) {
                    return false;
                }

                setSpaceMenuPos({ x: mousePosRef.current.x, y: mousePosRef.current.y });
                return true;
            });
        }
    );
    // --- BEVY SYNC ---
    const handleSyncBevy = () => {
        setIsBevyActive(false);
        setStatus("BEVY DISABLED");
    };

    // --- UPLINK ---
    function handleUplink() {
        if (!onCommit || layers.length === 0) return;
        setStatus("UPLINKING TO KERNEL...");

        const exporter = new GLTFExporter();
        const exportGroup = new THREE.Group();

        // Export visible layers
        layers.forEach(l => {
            if (l.visible) {
                // Clone helps avoid modifying scene state during export
                const clone = l.mesh.clone();
                exportGroup.add(clone);
            }
        });

        if (exportGroup.children.length === 0) {
            setStatus("NOTHING TO EXPORT");
            return;
        }

        exporter.parse(
            exportGroup,
            (gltf) => {
                const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
                onCommit(blob, 'K-SCULPT');
                setStatus("ASSETS SECURED IN KERNEL");
            },
            (err) => {
                console.error(err);
                setStatus("UPLINK FAILED");
            },
            { binary: true }
        );
    }

    return (
        <div
            className={`flex h-full w-full font-sans overflow-hidden select-none relative ${isBevyActive ? 'bg-transparent' : 'bg-[#050505]'}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={async (e) => {
                e.preventDefault();

                // 1. Handle OS File Drop (e.g. from Explorer)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    // @ts-ignore - Tauri/Electron specific "path" property
                    const path = file.path;

                    if (path) {
                        setStatus(`LOADING: ${file.name}`);
                        loadFromPath(path, file.name);
                    }
                    return;
                }

                // 2. Handle Internal K_OS Drop
                const data = e.dataTransfer.getData('application/json');
                try {
                    const item = JSON.parse(data);
                    if (item.type === 'MESH') {
                        // Re-hydrate Blob from Shared State if missing (JSON transfer strips Blobs)
                        let artifact = item;
                        if (!item.blob && sharedState?.storage) {
                            const found = sharedState.storage.find((a: any) => a.id === item.id);
                            if (found) artifact = found;
                        }

                        if (artifact.path) {
                            loadFromPath(artifact.path, artifact.name);
                        } else if (artifact.blob) {
                            await loadFromStorage(artifact);
                        } else {
                            console.error("KSculpt Drop: No Blob found for artifact", item.id);
                        }
                    }
                    else if (item.type === 'MAT') handleApplyMaterial(item);
                    else if (item.type === 'ALPHA') setActiveAlpha(item);
                } catch (err) { console.error("Drop failed", err); }
            }}
        >

            {/* OVERLAYS */}
            {!isViewportHost && (
            <KSculptBrushMenu
                visible={isBrushMenuOpen}
                position={menuPos}
                activeTool={activeTool}
                onSelect={(id: string) => {
                    setActiveTool(id);
                    if (!isBrushMenuLocked) setIsBrushMenuOpen(false);
                }}
                brushParams={{ radius, intensity }}
                setBrushParams={(p: any) => {
                    if (p.radius !== undefined) setRadius(p.radius);
                    if (p.intensity !== undefined) setIntensity(p.intensity);
                }}
                symmetry={symmetry}
                setSymmetry={setSymmetry}
                isLocked={isBrushMenuLocked}
                onToggleLock={() => setIsBrushMenuLocked(!isBrushMenuLocked)}
                brushMode={brushMode} setBrushMode={setBrushMode}
            />
            )}

            {!isViewportHost && (
            <KSculptAlphaMenu
                visible={isAlphaMenuOpen}
                position={menuPos}
                alphas={sharedState?.alphas || []}
                activeAlpha={activeAlpha}
                onSelect={(alpha: any) => { setActiveAlpha(alpha); setIsAlphaMenuOpen(false); }}
            />
            )}

            {/* UI PANELS */}

            {/* LEFT PANEL (Main Tools) */}
            {!isViewportHost && (
            <KSculptUI
                mode={mode} setMode={setMode} activeTab={activeTab} setActiveTab={setActiveTab} activeTool={activeTool} setActiveTool={setActiveTool}
                activeColor={activeColor} setActiveColor={setActiveColor}
                subdivisionLevel={subdivisionLevel} polyCount={activePolyCount} handleStepUp={handleStepUp} undo={undo} wireframe={wireframe} setWireframe={setWireframe}
                transformData={transformData} updateTransformFromUI={updateTransformFromUI} loadPrimitive={loadPrimitive} sharedState={sharedState} loadFromStorage={loadFromStorage}
                onSaveAlphaToStorage={(alpha: { name: string, url: string }) => {
                    if (onAlphaCommit) {
                        setStatus("UPLINKING ALPHA...");
                        onAlphaCommit(alpha);
                        setStatus("ALPHA SECURED IN KERNEL");
                    } else if (onCommit) {
                        // Fallback to generic storage if alpha channel is closed
                        fetch(alpha.url)
                            .then(res => res.blob())
                            .then(blob => {
                                onCommit(blob, 'ALPHA');
                                setStatus("ALPHA SECURED IN DATA BANK");
                            })
                            .catch(err => {
                                console.error("Alpha Uplink Failed", err);
                                setStatus("UPLINK FAILED");
                            });
                    }
                }}
                // Layers props passed but not used by UI anymore (except maybe for some logic? safe to pass)
                layers={layers} activeLayerId={activeLayerId} setActiveLayerId={handleLayerSelect} toggleVisibility={handleToggleVis} deleteLayer={handleDeleteLayer}
                mergeDown={handleMergeDown} mergeSelected={handleMergeSelected} mergeAll={handleMergeAll} selectedLayerIds={selectedLayerIds}
                // Gizmo Props
                gizmoMode={gizmoMode} setGizmoMode={setGizmoMode}
                transformSpace={transformSpace} setTransformSpace={setTransformSpace}
                // Masking
                onClearMask={clearMask} onInvertMask={invertMask} onExtractMask={extractMask}
                // Menus
                toggleBrushMenu={() => setIsBrushMenuOpen(prev => !prev)}
                // Remesh
                onRemesh={handleVoxelRemesh}
            />
            )}

            {/* VIEWPORT AREA */}
            <div className="flex-1 relative h-full cursor-crosshair group overflow-hidden bg-transparent">
                {/* UPLINK BUTTON */}


                {!isToolOverlay && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundColor: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
                        backgroundImage: UNIVERSAL_VIEWPORT_BACKGROUND_IMAGE
                    }}
                ></div>
                )}
                {!isToolOverlay && (
                <div className="absolute inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                )}
                {!isViewportHost && (
                <KTopBar
                    onUplink={handleUplink}
                    themeColor="#f97316" // KSculpt Orange Theme
                    leftContent={
                        <>
                            <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
                                <button onClick={() => leashClient.historyUndo('sculpt')} className="p-1 hover:text-[#f97316] transition-colors"><Undo size={14} /></button>
                                <button onClick={() => leashClient.historyRedo('sculpt')} className="p-1 hover:text-[#f97316] transition-colors"><Redo size={14} /></button>
                            </div>
                            <div className="h-6 w-px bg-[#333] mx-2"></div>

                            {/* RADIUS */}
                            <div className="flex flex-col w-24 gap-1 group">
                                <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                                    <span>Radius</span> <span className="text-[#f97316]">{radius.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="0.05" max="2.0" step="0.05"
                                    value={radius}
                                    onChange={(e) => setRadius(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-[#f97316] hover:accent-[#f97316]"
                                />
                            </div>

                            {/* INTENSITY */}
                            <div className="flex flex-col w-24 gap-1 group">
                                <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                                    <span>Intensity</span> <span className="text-[#f97316]">{intensity.toFixed(2)}</span>
                                </div>
                                <input
                                    type="range" min="0.1" max="1.0" step="0.05"
                                    value={intensity}
                                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-[#f97316] hover:accent-[#f97316]"
                                />
                            </div>

                            <div className="h-6 w-px bg-[#333] mx-2"></div>

                            {/* BRUSH MODE (ADD/SUB) */}
                            <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
                                <button
                                    onClick={() => setBrushMode('ADD')}
                                    className={`px-3 py-1 rounded text-[9px] font-bold transition-all ${brushMode === 'ADD' ? 'bg-[#f97316] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Kadd
                                </button>
                                <button
                                    onClick={() => setBrushMode('SUB')}
                                    className={`px-3 py-1 rounded text-[9px] font-bold transition-all ${brushMode === 'SUB' ? 'bg-[#f97316] text-black shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Ksub
                                </button>
                            </div>

                            <div className="h-6 w-px bg-[#333] mx-2"></div>

                            {/* DYNAMIC TOPOLOGY */}
                            <div className="flex items-center gap-2 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
                                <button
                                    onClick={() => setDynamicTopology(!dynamicTopology)}
                                    className={`px-3 py-1 rounded text-[9px] font-bold transition-all border ${dynamicTopology ? 'bg-red-900/40 text-red-400 border-red-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                                >
                                    DYNTOPO
                                </button>

                                {dynamicTopology && (
                                    <div className="flex flex-col w-20 gap-1 group animate-in fade-in slide-in-from-left-2 duration-200">
                                        <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                                            <span>Detail</span> <span className="text-red-400">{detailSize.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range" min="0.1" max="2.0" step="0.1"
                                            value={detailSize}
                                            onChange={(e) => setDetailSize(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="h-6 w-px bg-[#333] mx-2"></div>
                            {/* BEVY SYNC */}
                            <button
                                onClick={handleSyncBevy}
                                className="flex items-center gap-1 px-3 py-1 bg-[#161616] border border-[#333] text-gray-500 rounded text-[9px] font-bold tracking-wider cursor-not-allowed"
                            >
                                <Activity size={10} />
                                BEVY OFF
                            </button>
                        </>
                    }
                    rightContent={
                        <>
                            {/* GRID TOGGLE */}
                            <button
                                onClick={() => setShowGrid(!showGrid)}
                                className={`px-2 py-1 text-[10px] font-bold tracking-wider rounded border transition-colors ${showGrid
                                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                                    : 'bg-[#0a0a0a] text-gray-500 border-[#222] hover:text-gray-300'
                                    }`}
                            >
                                GRID
                            </button>

                            {/* MATCAPS */}
                            <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#222]">
                                {Object.values(MATCAPS).map((mc) => (
                                    <button
                                        key={mc}
                                        onClick={() => setCurrentMatCap(mc)}
                                        className={`px-3 py-1 rounded text-[9px] font-bold transition-all ${currentMatCap === mc ? 'bg-[#333] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {mc.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>

                            <div className="h-6 w-px bg-[#333]"></div>

                            {/* TOGGLES */}
                            <button
                                onClick={() => setSymmetry(symmetry === 'X' ? 'NONE' : 'X')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-[9px] font-bold transition-all border ${symmetry === 'X' ? 'bg-blue-900/20 text-blue-400 border-blue-500' : 'bg-transparent text-gray-500 border-transparent hover:text-white'}`}
                            >
                                <Split size={12} /> {symmetry === 'X' ? 'SYM: X' : 'OFF'}
                            </button>

                            <button
                                onClick={() => setWireframe(!wireframe)}
                                className={`p-2 rounded border transition-all ${wireframe ? 'bg-orange-900/20 text-orange-400 border-orange-500' : 'bg-[#1a1a1a] text-gray-500 border-transparent hover:text-white'}`}
                                title="Toggle Wireframe (W)"
                            >
                                <Scan size={14} />
                            </button>
                        </>
                    }
                />
                )}

                {/* SPACE MENU (K-FLUX) */}
                {!isViewportHost && (
                <KSculptSpaceMenu
                    visible={isSpaceMenuOpen}
                    position={spaceMenuPos}
                    activeForce={activeTool} // Reuse activeTool for now to trigger engine changes
                    setActiveForce={(force: string) => {
                        setActiveTool(force);
                        // Optional: close menu on select? Or keep open for tweaking? KGraphos keeps it open usually
                    }}
                    forceParams={{ intensity, radius }}
                    setForceParams={(p: any) => {
                        if (p.intensity !== undefined) setIntensity(p.intensity);
                        if (p.radius !== undefined) setRadius(p.radius);
                    }}
                    onReset={() => {
                        setActiveTool('CLAY');
                        setIntensity(0.5);
                        setRadius(0.5);
                    }}
                    gpuMode={true} // Always active for now
                    isLocked={isSpaceMenuLocked}
                    onToggleLock={() => setIsSpaceMenuLocked(!isSpaceMenuLocked)}
                />
                )}

                <div ref={mountRef} className={`absolute inset-0 z-0 outline-none ${isBevyActive || isToolOverlay ? 'opacity-0' : ''} ${isToolOverlay ? 'pointer-events-none' : ''}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} />

                {!isViewportHost && (
                <div className="absolute top-20 left-6 flex flex-col gap-2 pointer-events-none"><div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 bg-black/80 px-4 py-2 border-l-2 border-orange-500 shadow-xl backdrop-blur-md"><Activity size={12} className="animate-pulse" /> {status}</div></div>
                )}
            </div>

            {/* RIGHT PANEL (Layers / Subtools) */}
            {!isViewportHost && (
            <KSculptRightPanel
                layers={layers}
                activeLayerId={activeLayerId}
                setActiveLayerId={handleLayerSelect}
                toggleVisibility={handleToggleVis}
                deleteLayer={handleDeleteLayer}
                mergeDown={handleMergeDown}
                mergeSelected={handleMergeSelected}
                mergeAll={handleMergeAll}
                selectedLayerIds={selectedLayerIds}
                // Material Props
                materialMode={materialMode} setMaterialMode={setMaterialMode}
                activeMaterial={activeMaterial} applyMaterial={handleApplyMaterial}
                projectMaterials={sharedState?.materials || []}
                // Assets (Prims & Storage)
                loadPrimitive={loadPrimitive}
                loadFromStorage={loadFromStorage}
                sharedState={sharedState}
            />
            )}
        </div>
    );
}
