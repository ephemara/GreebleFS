
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
    Play, Pause, Square, Download, UploadCloud,
    Settings, Activity, Move, RotateCw, Maximize,
    Wind, Zap, Waves, Ghost, Repeat,
    Layers, Trash2, Plus, GripVertical, Timer,
    Film, Video, AlertTriangle, MonitorPlay, X,
    RefreshCw, Cpu, Database, Anchor, Infinity as InfinityIcon,
    AlignVerticalSpaceAround, Heart, MousePointer2,
    ArrowUpFromLine, Dna, Snowflake, Lightbulb, MoveHorizontal,
    RefreshCcw, ArrowDownCircle, Radar, Rotate3D, Flame,
    Tornado, Milestone, Spline, Camera, Grid as GridIcon,
    Circle, Box, BarChart2, Layers as LayersIcon, Terminal,
    FileCode, FileJson, Image as ImageIcon, BoxSelect,
    Share2, Package, FileBox, Link, Clock, Split, Scissors,
    Tornado as TornadoIcon, Disc, Magnet, Droplets, Minimize2, Move3d,
    Orbit, Shuffle, Aperture, Bomb, Diamond
} from 'lucide-react';
import AssetBrowser from '../../../components/AssetBrowser';
import { useZenControlBindings, useZenModuleBridge, useZenWorkspaceStore, ZEN_VIEWPORT_OPERATOR_SESSION_KEY } from '../../../core/zen';

// --- MATH & NOISE UTILS ---
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n) * 43758.5453123);
const lerp = (a, b, t) => a + (b - a) * t;
const noise = (x) => {
    const i = Math.floor(x);
    const f = fract(x);
    const u = f * f * (3.0 - 2.0 * f);
    return lerp(hash(i), hash(i + 1.0), u);
};

// --- MOTION MODIFIERS ---
const MODIFIERS = {
    // --- CLASSICS ---
    ORBIT: { id: 'orbit', name: 'Orbit', icon: RotateCw, params: { speed: 0.5, axis: 'y', step: 0.1 } },
    FLOAT: { id: 'float', name: 'Float', icon: Ghost, params: { speed: 1.0, height: 0.5, phase: 0, step: 0.2 } },
    PULSE: { id: 'pulse', name: 'Pulse', icon: Activity, params: { speed: 3.0, scale: 0.1, base: 1.0, step: 0.1 } },
    SHAKE: { id: 'shake', name: 'Shake', icon: Zap, params: { intensity: 0.1, frequency: 10, decay: 0 } },
    ELASTIC: { id: 'elastic', name: 'Elastic', icon: Maximize, params: { speed: 4, amount: 0.15, axis: 'y', step: 0.1 } },

    // --- INTERMEDIATE ---
    PENDULUM: { id: 'pendulum', name: 'Pendulum', icon: Anchor, params: { speed: 2.0, angle: 45, axis: 'z', step: 0.1 } },
    WOBBLE: { id: 'wobble', name: 'Wobble', icon: Wind, params: { speed: 1.5, intensity: 0.3, step: 0.2 } },
    FIGURE8: { id: 'figure8', name: 'Figure 8', icon: InfinityIcon, params: { speed: 1.0, width: 1.0, height: 0.5, step: 0.1 } },
    HEARTBEAT: { id: 'heartbeat', name: 'Heartbeat', icon: Heart, params: { bpm: 60, intensity: 0.2, step: 0.0 } },
    GLITCH: { id: 'glitch', name: 'Glitch', icon: AlertTriangle, params: { interval: 0.5, scatter: 0.2 } },
    STEP: { id: 'step', name: 'Stop Motion', icon: Video, params: { fps: 12 } },

    // --- PHYSICS & FX ---
    BOUNCE: { id: 'bounce', name: 'Bounce', icon: ArrowUpFromLine, params: { speed: 2.0, height: 1.0, squash: 0.2, step: 0.1 } },
    TUMBLE: { id: 'tumble', name: 'Tumble', icon: RefreshCcw, params: { speedX: 0.5, speedY: 0.3, speedZ: 0.7, step: 0.05 } },
    STROBE: { id: 'strobe', name: 'Strobe', icon: Lightbulb, params: { speed: 15.0, duty: 0.5, step: 0.1 } },
    CORKSCREW: { id: 'corkscrew', name: 'Corkscrew', icon: Dna, params: { speed: 1.0, height: 1.0, rotations: 2.0, step: 0.1 } },
    SHIVER: { id: 'shiver', name: 'Shiver', icon: Snowflake, params: { intensity: 0.05, frequency: 50.0 } },
    SWAY: { id: 'sway', name: 'Sway', icon: Waves, params: { speed: 0.8, angle: 15.0, step: 0.2 } },
    YOYO: { id: 'yoyo', name: 'Yo-Yo', icon: ArrowDownCircle, params: { speed: 2.0, length: 1.5, step: 0.1 } },
    CRAB: { id: 'crab', name: 'Crab', icon: MoveHorizontal, params: { speed: 2.0, width: 1.0, step: 0.1 } },

    // --- COMPLEX ---
    LISSAJOUS: { id: 'lissajous', name: 'Lissajous', icon: Spline, params: { speed: 1.0, size: 1.0, a: 3, b: 2, step: 0.05 } },
    FLIP: { id: 'flip', name: 'Flip', icon: Rotate3D, params: { interval: 2.0, speed: 5.0, axis: 'x', step: 0.1 } },
    TREMOR: { id: 'tremor', name: 'Tremor', icon: Tornado, params: { intensity: 0.1, speed: 20.0 } },
    SCAN: { id: 'scan', name: 'Scan', icon: Radar, params: { distance: 2.0, speed: 1.0, axis: 'x', step: 0.1 } },
    WARP: { id: 'warp', name: 'Warp', icon: Flame, params: { speed: 2.0, stretch: 0.5, step: 0.1 } },
    DRIFT: { id: 'drift', name: 'Drift', icon: Milestone, params: { speed: 0.2, radius: 0.5 } },
    BOBBLE: { id: 'bobble', name: 'Bobble', icon: Activity, params: { speed: 4.0, amount: 0.3, step: 0.1 } },
    TWIST: { id: 'twist', name: 'Twist', icon: RefreshCw, params: { speed: 2.0, angle: 30, axis: 'y', step: 0.05 } },

    // --- ADVANCED (NEW) ---
    SPIRAL: { id: 'spiral', name: 'Spiral', icon: TornadoIcon, params: { speed: 1.0, radius: 2.0, grow: 1.0, rotations: 3.0 } },
    VORTEX: { id: 'vortex', name: 'Vortex', icon: Disc, params: { speed: 2.0, strength: 2.0, radius: 5.0, falloff: 1.0 } },
    MAGNET: { id: 'magnet', name: 'Magnet', icon: Magnet, params: { speed: 1.0, strength: 2.0, range: 4.0 } },
    NOISE_FLOW: { id: 'noise_flow', name: 'Noise Flow', icon: Waves, params: { speed: 0.5, scale: 0.2, force: 1.0 } },
    RIPPLE: { id: 'ripple', name: 'Ripple', icon: Droplets, params: { speed: 2.0, frequency: 2.0, amplitude: 0.5, decay: 0.2 } },
    SQUASH: { id: 'squash', name: 'Squash', icon: Minimize2, params: { speed: 3.0, amount: 0.5, axis: 'y' } },
    ACCORDION: { id: 'accordion', name: 'Accordion', icon: Move3d, params: { speed: 1.5, amount: 0.5, axis: 'y' } },
    CHAOS: { id: 'chaos', name: 'Chaos', icon: Shuffle, params: { speed: 1.0, scale: 2.0 } },
    BREATHE: { id: 'breathe', name: 'Breathe', icon: Aperture, params: { speed: 0.5, amount: 0.2 } },
    EXPLODE: { id: 'explode', name: 'Explode', icon: Bomb, params: { strength: 5.0, decay: 0.1, trigger: 0.5 } },

    // --- K-SCRIPT ---
    CODE: {
        id: 'code', name: 'K-SCRIPT', icon: Terminal,
        params: {
            code: "p.y += Math.sin(t * v.freq + i * 0.1) * v.amp;", error: null,
            sliders: [{ id: 'amp', label: 'Amplitude', val: 1.0, min: 0, max: 5 }, { id: 'freq', label: 'Frequency', val: 2.0, min: 0, max: 10 }]
        }
    }
};

const getModifierDefinitionByType = (type: string) =>
    Object.values(MODIFIERS).find((modifier) => modifier.id === type);

const hydrateClonerChains = (value: any) => {
    if (!Array.isArray(value) || value.length === 0) {
        return createDefaultClonerChains();
    }

    return value.map((chain: any, index: number) => ({
        id: typeof chain?.id === 'string' ? chain.id : createChainInstance(index).id,
        name: typeof chain?.name === 'string' ? chain.name : `CHAIN ${index + 1}`,
        duration: getFiniteNumber(chain?.duration, 4.0),
        modifiers: Array.isArray(chain?.modifiers)
            ? chain.modifiers.map((modifier: any) => {
                const definition = getModifierDefinitionByType(modifier?.type);
                return {
                    ...modifier,
                    name: typeof modifier?.name === 'string' ? modifier.name : definition?.name ?? 'Modifier',
                    icon: definition?.icon ?? Terminal,
                    params: modifier?.params ?? {}
                };
            })
            : []
    }));
};

const serializeClonerChains = (chains: any[]) =>
    chains.map((chain) => ({
        ...chain,
        modifiers: chain.modifiers.map(({ icon, ...modifier }: any) => modifier)
    }));

const createModifierInstance = (key) => ({
    instanceId: Date.now() + Math.random(),
    type: MODIFIERS[key].id,
    name: MODIFIERS[key].name,
    icon: MODIFIERS[key].icon,
    params: { ...MODIFIERS[key].params, sliders: MODIFIERS[key].params.sliders ? JSON.parse(JSON.stringify(MODIFIERS[key].params.sliders)) : undefined }
});

const createChainInstance = (index) => ({
    id: `chain_${Date.now()}`,
    name: `CHAIN ${index + 1}`,
    duration: 4.0,
    modifiers: []
});

const DEFAULT_CLONER_BOOTSTRAP = {
    mode: 'SINGLE',
    count: { x: 1, y: 1, z: 1 },
    spacing: { x: 2.0, y: 2.0, z: 2.0 }
} as const;

const LEGACY_CLONER_BOOTSTRAP = {
    mode: 'GRID',
    count: { x: 5, y: 1, z: 5 },
    defaultModifierType: 'float'
} as const;

const getFiniteNumber = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const getVectorState = (value: any, fallback: { x: number; y: number; z: number }) => ({
    x: getFiniteNumber(value?.x, fallback.x),
    y: getFiniteNumber(value?.y, fallback.y),
    z: getFiniteNumber(value?.z, fallback.z)
});

const createDefaultClonerChains = () => {
    return [createChainInstance(0)];
};

const isLegacyDefaultClonerChains = (chains: any[]) =>
    chains.length === 1 &&
    Array.isArray(chains[0]?.modifiers) &&
    chains[0].modifiers.length === 1 &&
    chains[0].modifiers[0]?.type === LEGACY_CLONER_BOOTSTRAP.defaultModifierType;

const isLegacyDefaultClonerState = (safeState: any, chains: any[]) => {
    const persistedCount = getVectorState(safeState.sessionClonerCount, LEGACY_CLONER_BOOTSTRAP.count);
    const persistedMode = typeof safeState.sessionClonerMode === 'string'
        ? safeState.sessionClonerMode
        : LEGACY_CLONER_BOOTSTRAP.mode;

    return (
        persistedMode === LEGACY_CLONER_BOOTSTRAP.mode &&
        persistedCount.x === LEGACY_CLONER_BOOTSTRAP.count.x &&
        persistedCount.y === LEGACY_CLONER_BOOTSTRAP.count.y &&
        persistedCount.z === LEGACY_CLONER_BOOTSTRAP.count.z &&
        isLegacyDefaultClonerChains(chains)
    );
};

const readPersistedClonerState = (persisted: Record<string, unknown> | undefined) => {
    const safeState = (persisted ?? {}) as any;
    const hydratedChains = hydrateClonerChains(safeState.sessionChains);
    const shouldMigrateLegacyDefaults = isLegacyDefaultClonerState(safeState, hydratedChains);
    const chains = shouldMigrateLegacyDefaults ? createDefaultClonerChains() : hydratedChains;

    return {
        normalizeScale: safeState.sessionNormalizeScale ?? true,
        distributionMode: typeof safeState.sessionDistributionMode === 'string' ? safeState.sessionDistributionMode : 'ROUND_ROBIN',
        keyframes: safeState.sessionKeyframes && typeof safeState.sessionKeyframes === 'object' ? safeState.sessionKeyframes : {},
        activeKeyId: typeof safeState.sessionActiveKeyId === 'string' ? safeState.sessionActiveKeyId : null,
        exportFormat: typeof safeState.sessionExportFormat === 'string' ? safeState.sessionExportFormat : 'GLB',
        exportMode: typeof safeState.sessionExportMode === 'string' ? safeState.sessionExportMode : 'ANIM',
        targetEngine: typeof safeState.sessionTargetEngine === 'string' ? safeState.sessionTargetEngine : 'GENERIC',
        splitAnimations: Boolean(safeState.sessionSplitAnimations),
        chains,
        activeChainId: shouldMigrateLegacyDefaults
            ? chains[0]?.id
            : safeState.sessionActiveChainId ?? chains[0]?.id,
        selectedModId: shouldMigrateLegacyDefaults
            ? null
            : safeState.sessionSelectedModId ?? chains[0]?.modifiers?.[0]?.instanceId ?? null,
        clonerMode: shouldMigrateLegacyDefaults
            ? DEFAULT_CLONER_BOOTSTRAP.mode
            : typeof safeState.sessionClonerMode === 'string'
                ? safeState.sessionClonerMode
                : DEFAULT_CLONER_BOOTSTRAP.mode,
        clonerCount: shouldMigrateLegacyDefaults
            ? { ...DEFAULT_CLONER_BOOTSTRAP.count }
            : getVectorState(safeState.sessionClonerCount, DEFAULT_CLONER_BOOTSTRAP.count),
        clonerSpacing: getVectorState(safeState.sessionClonerSpacing, DEFAULT_CLONER_BOOTSTRAP.spacing),
        radialRadius: getFiniteNumber(safeState.sessionRadialRadius, 5.0),
        radialCount: Math.max(1, Math.round(getFiniteNumber(safeState.sessionRadialCount, 8))),
        sequencerFps: Math.max(1, Math.round(getFiniteNumber(safeState.sessionSequencerFps, 30)))
    };
};

export default function KCloner({ sharedState, onCommit, zenShellMode = 'standalone' }: any) {
    const {
        connectViewport,
        publishLayers,
        publishState,
        publishSelection,
        publishSequencerSource,
        focusSequencerSource,
        updateSequencerTransport
    } = useZenModuleBridge('cloner');
    const activeWorkspaceModuleId = useZenWorkspaceStore((state) => state.document.activeModuleId);
    const sequencerIsPlaying = useZenWorkspaceStore((state) => state.sequencer.isPlaying);
    const activeSequencerSourceId = useZenWorkspaceStore((state) => state.sequencer.activeSourceModuleId);
    const clonerSequencerSource = useZenWorkspaceStore((state) => state.sequencer.sources.cloner ?? null);
    const isViewportHost = zenShellMode === 'viewport-host';
    const isToolOverlay = zenShellMode === 'tool-overlay';
    const initialClonerStateRef = useRef<any>(null);
    if (!initialClonerStateRef.current) {
        initialClonerStateRef.current = readPersistedClonerState(
            useZenWorkspaceStore.getState().document.moduleState.cloner as Record<string, unknown> | undefined
        );
    }
    const initialClonerState = initialClonerStateRef.current;
    const isPlaying = sequencerIsPlaying && activeSequencerSourceId === 'cloner';
    const fps = Math.max(1, Math.round(clonerSequencerSource?.fps ?? initialClonerState.sequencerFps));
    const [baking, setBaking] = useState(false);
    const [status, setStatus] = useState("kipp engine 0.5 alpha");

    // EXPORT SETTINGS
    const [exportFormat, setExportFormat] = useState(initialClonerState.exportFormat); // GLB, OBJ, USDZ, VAT
    const [exportMode, setExportMode] = useState(initialClonerState.exportMode); // ANIM, INSTANCE, SEPARATED
    const [targetEngine, setTargetEngine] = useState(initialClonerState.targetEngine); // GENERIC, UNREAL, UNITY
    const [splitAnimations, setSplitAnimations] = useState(initialClonerState.splitAnimations); // SPLIT CHAINS

    // NEW FEATURES
    const [normalizeScale, setNormalizeScale] = useState(initialClonerState.normalizeScale);
    const [distributionMode, setDistributionMode] = useState(initialClonerState.distributionMode); // ROUND_ROBIN, RANDOM
    const [showBrowser, setShowBrowser] = useState(false);

    // KEYFRAME SYSTEM
    const [keyframes, setKeyframes] = useState<Record<string, { t: number, v: number }[]>>(initialClonerState.keyframes);
    const [activeKeyId, setActiveKeyId] = useState<string | null>(initialClonerState.activeKeyId); // For future curve editor

    // HELPER: Get Value at Time
    const getVal = useCallback((id: string, def: number, timeOverride?: number) => {
        const t = timeOverride ?? timeRef.current;
        const track = keyframes[id];
        if (!track || track.length === 0) return def;

        // Find surrounding keys
        // Sort just in case (though we should insert sorted)
        const sorted = [...track].sort((a, b) => a.t - b.t);

        if (t <= sorted[0].t) return sorted[0].v;
        if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v;

        const idx = sorted.findIndex(k => k.t > t);
        if (idx === -1) return sorted[sorted.length - 1].v;

        const k1 = sorted[idx - 1];
        const k2 = sorted[idx];
        const pct = (t - k1.t) / (k2.t - k1.t);
        return k1.v + (k2.v - k1.v) * pct; // Linear for now
    }, [keyframes]);

    const updateClonerSourceFps = useCallback((nextFps: number) => {
        publishSequencerSource({
            fps: Math.max(1, Math.round(nextFps))
        });
        focusSequencerSource();
    }, [focusSequencerSource, publishSequencerSource]);

    const toggleKey = (id: string, val: number) => {
        const t = parseFloat(timeRef.current.toFixed(2));
        setKeyframes(prev => {
            const track = prev[id] || [];
            const existsIdx = track.findIndex(k => Math.abs(k.t - t) < 0.05);

            if (existsIdx >= 0) {
                // Remove
                const next = [...track];
                next.splice(existsIdx, 1);
                const res = { ...prev, [id]: next };
                if (next.length === 0) delete res[id];
                return res;
            } else {
                // Add
                return { ...prev, [id]: [...track, { t, v: val }].sort((a, b) => a.t - b.t) };
            }
        });
    };

    // CHAIN SYSTEM
    const [chains, setChains] = useState(() => {
        return initialClonerState.chains;
    });
    const [activeChainId, setActiveChainId] = useState(() => initialClonerState.activeChainId ?? chains[0]?.id);
    const [playbackChainId, setPlaybackChainId] = useState<string | null>(null); // Visual feedback during playback

    const [selectedModId, setSelectedModId] = useState(() => initialClonerState.selectedModId ?? chains[0]?.modifiers[0]?.instanceId);
    const [clonerMode, setClonerMode] = useState(initialClonerState.clonerMode);
    const [clonerCount, setClonerCount] = useState(initialClonerState.clonerCount);
    const [clonerSpacing, setClonerSpacing] = useState(initialClonerState.clonerSpacing);
    const [radialRadius, setRadialRadius] = useState(initialClonerState.radialRadius);
    const [radialCount, setRadialCount] = useState(initialClonerState.radialCount);

    const playheadRef = useRef<HTMLDivElement>(null);
    const timeTextRef = useRef<HTMLSpanElement>(null);
    const topTimeTextRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef(useZenWorkspaceStore.getState().sequencer.currentTime);
    const sequencerRef = useRef(useZenWorkspaceStore.getState().sequencer);
    const scriptCache = useRef<any>({});

    // BLOB CACHE FOR RE-PROCESSING
    const lastBlobRef = useRef<{ data: Blob | ArrayBuffer, name: string } | null>(null);
    const mountedSharedArtifactRef = useRef<{ id: string | null; blob: Blob | null }>({
        id: null,
        blob: null
    });

    const meshGroupRef = useRef<any>(null);
    const dummyRef = useRef(new THREE.Object3D());
    const originalsRef = useRef<any[]>([]);
    const geometriesRef = useRef<any[]>([]);
    const materialsRef = useRef<any[]>([]);

    // Computed Total Duration
    const totalDuration = chains.reduce((acc, chain) => acc + chain.duration, 0);

    const stateRef = useRef({
        isPlaying, fps, totalDuration, chains, clonerMode, clonerCount,
        clonerSpacing, radialRadius, radialCount, exportFormat, exportMode, targetEngine,
        splitAnimations, keyframes
    });

    useEffect(() => {
        stateRef.current = {
            isPlaying, fps, totalDuration, chains, clonerMode, clonerCount,
            clonerSpacing, radialRadius, radialCount, exportFormat, exportMode, targetEngine,
            splitAnimations, keyframes
        };
        if (meshGroupRef.current) rebuildLayout();
    }, [fps, isPlaying, totalDuration, chains, clonerMode, clonerCount, clonerSpacing, radialRadius, radialCount, exportFormat, exportMode, targetEngine, splitAnimations, distributionMode, keyframes]);

    const mountRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef<number>(0);
    const sceneRef = useRef<any>({ scene: null, camera: null, renderer: null, controls: null, clock: new THREE.Clock() });

    useEffect(() => {
        publishLayers([
            {
                id: 'cloner:instances',
                name: 'Cloner Instances',
                order: 0,
                tags: ['instancer']
            }
        ]);
    }, [publishLayers]);

    useEffect(() => {
        publishState({
            status,
            clonerMode,
            activeChainId,
            chainCount: chains.length,
            transportOwner: 'global-sequencer',
            transportActive: activeSequencerSourceId === 'cloner',
            sessionChains: serializeClonerChains(chains),
            sessionActiveChainId: activeChainId,
            sessionSelectedModId: selectedModId,
            sessionClonerMode: clonerMode,
            sessionClonerCount: clonerCount,
            sessionClonerSpacing: clonerSpacing,
            sessionRadialRadius: radialRadius,
            sessionRadialCount: radialCount,
            sessionNormalizeScale: normalizeScale,
            sessionDistributionMode: distributionMode,
            sessionKeyframes: keyframes,
            sessionActiveKeyId: activeKeyId,
            sessionExportFormat: exportFormat,
            sessionExportMode: exportMode,
            sessionTargetEngine: targetEngine,
            sessionSplitAnimations: splitAnimations,
            sessionSequencerFps: fps,
            [ZEN_VIEWPORT_OPERATOR_SESSION_KEY]: {
                moduleId: 'cloner',
                enabled: true,
                subjectAssetId: sharedState?.activeArtifactId ?? null,
                subjectEntityId: isToolOverlay ? sharedState?.activeEntityId ?? null : null,
                subjectLayerId: isToolOverlay
                    ? sharedState?.activeLayerId ?? null
                    : 'cloner:instances',
                materialId: sharedState?.activeMaterialId ?? null,
                clonerMode,
                clonerCount,
                clonerSpacing,
                radialRadius,
                radialCount,
                normalizeScale,
                distributionMode
            }
        });
    }, [
        activeChainId,
        activeKeyId,
        activeSequencerSourceId,
        chains,
        clonerCount,
        clonerMode,
        clonerSpacing,
        distributionMode,
        exportFormat,
        exportMode,
        fps,
        isToolOverlay,
        keyframes,
        normalizeScale,
        publishState,
        radialCount,
        radialRadius,
        selectedModId,
        sharedState?.activeArtifactId,
        sharedState?.activeEntityId,
        sharedState?.activeLayerId,
        sharedState?.activeMaterialId,
        splitAnimations,
        status,
        targetEngine
    ]);

    useEffect(() => {
        publishSequencerSource({
            duration: totalDuration,
            fps,
            loop: totalDuration > 0,
            available: totalDuration > 0
        });
    }, [fps, publishSequencerSource, totalDuration]);

    useEffect(() => {
        if (activeWorkspaceModuleId === 'cloner') {
            focusSequencerSource();
        }
    }, [activeWorkspaceModuleId, focusSequencerSource]);

    useEffect(() => {
        const unsubscribe = useZenWorkspaceStore.subscribe((state, previousState) => {
            if (state.sequencer === previousState.sequencer) return;
            sequencerRef.current = state.sequencer;
            if (state.sequencer.activeSourceModuleId === 'cloner') {
                timeRef.current = state.sequencer.currentTime;
            }
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        if (isToolOverlay) {
            return;
        }

        publishSelection({
            ...(sharedState?.activeArtifactId
                ? { activeAssetId: sharedState.activeArtifactId }
                : {}),
            activeLayerId: 'cloner:instances'
        });
    }, [
        isToolOverlay,
        publishSelection,
        sharedState?.activeArtifactId
    ]);

    // --- UNIFIED GEOMETRY LOADER ---
    const loadGeometryFromSource = useCallback((data: Blob | ArrayBuffer, name: string) => {
        lastBlobRef.current = { data, name };

        const processGeos = (geos: any[], mats: any[]) => {
            if (geos.length > 0) {
                geometriesRef.current = geos;
                materialsRef.current = mats;
                rebuildLayout();
                setStatus(`Loaded: ${geos.length} objects`);
            } else {
                setStatus("No Meshes Found");
            }
        };

        const traverse = (obj: any, foundGeos: any[], foundMats: any[]) => {
            if (obj.isMesh) {
                obj.geometry.computeBoundingBox();

                if (normalizeScale) {
                    const box = obj.geometry.boundingBox;
                    const size = new THREE.Vector3(); box.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 0) { const scale = 1.0 / maxDim; obj.geometry.scale(scale, scale, scale); }
                }

                obj.geometry.center();
                foundGeos.push(obj.geometry);
                let mat = obj.material; if (Array.isArray(mat)) mat = mat[0];
                foundMats.push(mat ? mat.clone() : new THREE.MeshStandardMaterial({ color: 0xff00ff }));
            }
            if (obj.children) obj.children.forEach(c => traverse(c, foundGeos, foundMats));
        };

        try {
            const extension = name.split('.').pop()?.toLowerCase() || '';

            if (extension === 'glb' || extension === 'gltf' || !extension) { // Default to GLB if unknown (e.g. kernel blob)
                const loader = new GLTFLoader();
                const buffer = data instanceof Blob ? URL.createObjectURL(data) : data;
                if (typeof buffer === 'string') {
                    loader.load(buffer, (gltf) => {
                        const foundGeos: any[] = []; const foundMats: any[] = [];
                        traverse(gltf.scene, foundGeos, foundMats);
                        processGeos(foundGeos, foundMats);
                        URL.revokeObjectURL(buffer);
                    });
                } else {
                    loader.parse(buffer as ArrayBuffer, '', (gltf) => {
                        const foundGeos: any[] = []; const foundMats: any[] = [];
                        traverse(gltf.scene, foundGeos, foundMats);
                        processGeos(foundGeos, foundMats);
                    });
                }
            }
            else if (extension === 'fbx') {
                const loader = new FBXLoader();
                const buffer = data instanceof Blob ? URL.createObjectURL(data) : data; // FBXLoader needs path or URL usually? Actually parse takes ArrayBuffer
                // If it's a blob, we need ArrayBuffer for parse, or URL for load
                if (data instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const res = loader.parse(e.target?.result as ArrayBuffer, '');
                        const foundGeos: any[] = []; const foundMats: any[] = [];
                        traverse(res, foundGeos, foundMats);
                        processGeos(foundGeos, foundMats);
                    };
                    reader.readAsArrayBuffer(data);
                } else {
                    const res = loader.parse(data as ArrayBuffer, '');
                    const foundGeos: any[] = []; const foundMats: any[] = [];
                    traverse(res, foundGeos, foundMats);
                    processGeos(foundGeos, foundMats);
                }
            }
            else if (extension === 'obj') {
                const loader = new OBJLoader();
                // OBJ requires text
                const text = data instanceof Blob ? null : new TextDecoder().decode(data as ArrayBuffer);
                if (text) {
                    const res = loader.parse(text);
                    const foundGeos: any[] = []; const foundMats: any[] = [];
                    traverse(res, foundGeos, foundMats);
                    processGeos(foundGeos, foundMats);
                } else {
                    // Blob to text
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const res = loader.parse(e.target?.result as string);
                        const foundGeos: any[] = []; const foundMats: any[] = [];
                        traverse(res, foundGeos, foundMats);
                        processGeos(foundGeos, foundMats);
                    };
                    reader.readAsText(data as Blob);
                }
            }
        } catch (e) {
            console.error(e);
            setStatus("Import Error");
        }
    }, [normalizeScale]); // Re-create when setting changes

    // Re-process if normalization changes
    useEffect(() => {
        if (lastBlobRef.current) {
            loadGeometryFromSource(lastBlobRef.current.data, lastBlobRef.current.name);
        }
    }, [normalizeScale, loadGeometryFromSource]);

    // --- KERNEL BRIDGE LOADING ---
    useEffect(() => {
        if (isToolOverlay) return;
        const activeArtifactId = sharedState?.activeArtifactId ?? null;
        const artifactBlob = sharedState?.artifact ?? null;

        if (!activeArtifactId || !artifactBlob) {
            mountedSharedArtifactRef.current = { id: null, blob: null };
            return;
        }

        if (
            mountedSharedArtifactRef.current.id === activeArtifactId &&
            mountedSharedArtifactRef.current.blob === artifactBlob
        ) {
            return;
        }

        mountedSharedArtifactRef.current = {
            id: activeArtifactId,
            blob: artifactBlob instanceof Blob ? artifactBlob : null
        };
        loadGeometryFromSource(artifactBlob, `kernel_${activeArtifactId}.glb`);
        setStatus("KERNEL ARTIFACT LINKED");
    }, [isToolOverlay, loadGeometryFromSource, sharedState?.activeArtifactId, sharedState?.artifact]);

    // --- INIT ---
    useEffect(() => {
        if (isToolOverlay) return;
        if (!mountRef.current) return;
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505);
        scene.fog = new THREE.Fog(0x050505, 500, 3000);
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
        camera.position.set(15, 15, 20);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mountRef.current.appendChild(renderer.domElement);
        const ambient = new THREE.HemisphereLight(0xffffff, 0x000000, 1.0);
        scene.add(ambient);
        const keyLight = new THREE.SpotLight(0x00ffff, 50);
        keyLight.position.set(20, 40, 20); keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048); scene.add(keyLight);
        const rimLight = new THREE.SpotLight(0xff00ff, 20);
        rimLight.position.set(-20, 10, -20);
        scene.add(rimLight);
        const grid = new THREE.GridHelper(2000, 200, 0x1a1a1a, 0x0a0a0a);
        scene.add(grid);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05; controls.maxDistance = 2000;
        const disconnectZenViewport = connectViewport({
            element: mountRef.current,
            scene,
            camera,
            controls,
            renderer
        });

        const group = new THREE.Group();
        scene.add(group);
        meshGroupRef.current = group;

        geometriesRef.current = [];
        materialsRef.current = [];

        if (!sharedState?.artifact) {
            setStatus("AWAITING SHARED SCENE");
        }

        sceneRef.current = { scene, camera, renderer, controls, clock: null };

        rebuildLayout();

        const animate = () => {
            const { scene, camera, renderer, controls } = sceneRef.current;
            const { totalDuration, chains, clonerMode, clonerCount, clonerSpacing, radialRadius, radialCount, keyframes } = stateRef.current;
            if (!scene) return;
            controls.update();
            const sequencer = sequencerRef.current;
            const globalTime = sequencer.activeSourceModuleId === 'cloner'
                ? sequencer.currentTime
                : timeRef.current;
            timeRef.current = globalTime;

            // HELPER: Get Keyframe Value
            const getK = (id, def) => {
                const track = keyframes[id];
                if (!track || track.length === 0) return def;
                if (globalTime <= track[0].t) return track[0].v;
                if (globalTime >= track[track.length - 1].t) return track[track.length - 1].v;
                for (let i = 0; i < track.length - 1; i++) {
                    if (globalTime >= track[i].t && globalTime < track[i + 1].t) {
                        const t = (globalTime - track[i].t) / (track[i + 1].t - track[i].t);
                        return track[i].v + (track[i + 1].v - track[i].v) * t;
                    }
                }
                return def;
            };

            // Determine Active Chain
            let activeChain = chains[0];
            let localTime = 0;
            let timeAccumulator = 0;

            for (const chain of chains) {
                if (globalTime < timeAccumulator + chain.duration) {
                    activeChain = chain;
                    localTime = globalTime - timeAccumulator;
                    break;
                }
                timeAccumulator += chain.duration;
            }

            if (mountRef.current) {
                const progress = totalDuration > 0 ? (globalTime / totalDuration) * 100 : 0;
                if (playheadRef.current) playheadRef.current.style.left = `${progress}%`;
                if (timeTextRef.current) timeTextRef.current.innerText = globalTime.toFixed(2);
                if (topTimeTextRef.current) topTimeTextRef.current.innerText = `${globalTime.toFixed(2)}s / ${totalDuration.toFixed(2)}s`;
            }

            if (meshGroupRef.current) {
                const group = meshGroupRef.current;
                const dum = dummyRef.current;
                const origins = originalsRef.current;

                let effectiveTime = localTime;
                const stepMod = activeChain.modifiers.find(m => m.type === 'step');
                if (stepMod) { const steps = stepMod.params.fps; effectiveTime = Math.floor(localTime * steps) / steps; }

                // Pre-calc layout params using Keyframes
                let lx = 0, ly = 0, lz = 0;
                let spX = 0, spY = 0, spZ = 0;
                let radR = 0;

                if (clonerMode === 'GRID') {
                    const cx = clonerCount.x; const cy = clonerCount.y; const cz = clonerCount.z;
                    spX = getK('grid_space_x', clonerSpacing.x);
                    spY = getK('grid_space_y', clonerSpacing.y);
                    spZ = getK('grid_space_z', clonerSpacing.z);
                    lx = (cx - 1) * spX * 0.5;
                    ly = (cy - 1) * spY * 0.5;
                    lz = (cz - 1) * spZ * 0.5;
                } else if (clonerMode === 'RADIAL') {
                    radR = getK('rad_radius', radialRadius); // Keyframed Radius
                } else if (clonerMode === 'LINEAR') {
                    spY = getK('grid_space_y', clonerSpacing.y);
                    ly = (clonerCount.y - 1) * spY * 0.5;
                }

                group.children.forEach((mesh) => {
                    if (!mesh.isInstancedMesh) return;
                    const count = mesh.count;
                    const globalIndices = mesh.userData.globalIndices;
                    if (!globalIndices) return;
                    for (let i = 0; i < count; i++) {
                        const globalIdx = globalIndices[i];
                        const orig = origins[globalIdx];
                        if (!orig) continue;

                        dum.rotation.copy(orig.rot);
                        dum.scale.copy(orig.scale);

                        // DYNAMIC POSITIONING
                        if (clonerMode === 'GRID') {
                            const cx = clonerCount.x; const cy = clonerCount.y; const cz = clonerCount.z;
                            let rem = globalIdx;
                            const iz = rem % cz; rem = Math.floor(rem / cz);
                            const iy = rem % cy; rem = Math.floor(rem / cy);
                            const ix = rem;
                            dum.position.set(ix * spX - lx, iy * spY - ly + (cy > 1 ? 0 : 0.5), iz * spZ - lz);
                        } else if (clonerMode === 'RADIAL') {
                            const step = (Math.PI * 2) / radialCount;
                            const angle = step * globalIdx;
                            dum.position.set(Math.cos(angle) * radR, 0.5, Math.sin(angle) * radR);
                            dum.rotation.set(0, -angle, 0);
                        } else if (clonerMode === 'LINEAR') {
                            const py = globalIdx * spY - ly + 2;
                            dum.position.set(0, py, 0);
                        } else {
                            dum.position.copy(orig.pos);
                        }

                        activeChain.modifiers.forEach(mod => {
                            if (mod.type !== 'step') applyModifierLogic(dum, mod, effectiveTime, globalIdx);
                        });

                        dum.updateMatrix();
                        mesh.setMatrixAt(i, dum.matrix);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                });
            }
            renderer.render(scene, camera);
            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        const handleResize = () => {
            if (!mountRef.current) return;
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            disconnectZenViewport();
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(requestRef.current);
            if (mountRef.current) mountRef.current.innerHTML = '';
            renderer.dispose();
        };
    }, [connectViewport, isToolOverlay]);

    // Sync active playback chain for UI highlighting (throttled)
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isPlaying) {
                setPlaybackChainId(null);
                return;
            }
            let accumulator = 0;
            const currentT = timeRef.current;
            for (const c of chains) {
                if (currentT < accumulator + c.duration) {
                    setPlaybackChainId(c.id);
                    return;
                }
                accumulator += c.duration;
            }
        }, 100);
        return () => clearInterval(interval);
    }, [isPlaying, chains]);

    const disposeVariantMesh = (mesh?: any) => {
        if (!mesh) return;
        mesh.parent?.remove(mesh);
        mesh.dispose?.();
    };

    const createVariantMesh = (geometry: any, material: any, capacity: number) => {
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, capacity));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.userData.globalIndices = new Int32Array(0);
        return mesh;
    };

    // --- MULTI-MESH LAYOUT BUILDER ---
    const rebuildLayout = () => {
        const group = meshGroupRef.current;
        if (!group) return;
        const { clonerMode, clonerCount, clonerSpacing, radialRadius, radialCount } = stateRef.current;
        const origins: any[] = [];
        let totalCount = 0;

        if (clonerMode === 'SINGLE') {
            origins.push({ pos: new THREE.Vector3(0, 0.5, 0), rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) });
            totalCount = 1;
        }
        else if (clonerMode === 'GRID') {
            const offX = (clonerCount.x - 1) * clonerSpacing.x * 0.5;
            const offY = (clonerCount.y - 1) * clonerSpacing.y * 0.5;
            const offZ = (clonerCount.z - 1) * clonerSpacing.z * 0.5;
            for (let x = 0; x < clonerCount.x; x++) {
                for (let y = 0; y < clonerCount.y; y++) {
                    for (let z = 0; z < clonerCount.z; z++) {
                        const px = x * clonerSpacing.x - offX;
                        const py = y * clonerSpacing.y - offY + (clonerCount.y > 1 ? 0 : 0.5);
                        const pz = z * clonerSpacing.z - offZ;
                        origins.push({ pos: new THREE.Vector3(px, py, pz), rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) });
                        totalCount++;
                    }
                }
            }
        }
        else if (clonerMode === 'RADIAL') {
            const step = (Math.PI * 2) / radialCount;
            for (let i = 0; i < radialCount; i++) {
                const angle = step * i;
                const px = Math.cos(angle) * radialRadius;
                const pz = Math.sin(angle) * radialRadius;
                const rot = new THREE.Euler(0, -angle, 0);
                origins.push({ pos: new THREE.Vector3(px, 0.5, pz), rot: rot, scale: new THREE.Vector3(1, 1, 1) });
                totalCount++;
            }
        }
        else if (clonerMode === 'LINEAR') {
            const offY = (clonerCount.y - 1) * clonerSpacing.y * 0.5;
            for (let i = 0; i < clonerCount.y; i++) {
                const py = i * clonerSpacing.y - offY + 2;
                origins.push({ pos: new THREE.Vector3(0, py, 0), rot: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) });
                totalCount++;
            }
        }
        originalsRef.current = origins;

        const variants = geometriesRef.current.reduce((acc: any[], geometry: any, index: number) => {
            const material = materialsRef.current[index];
            if (geometry && material) acc.push({ geometry, material });
            return acc;
        }, []);
        const numVariants = variants.length;
        const existingChildren = [...group.children];

        if (numVariants === 0) {
            existingChildren.forEach(child => disposeVariantMesh(child));
            return;
        }

        const countsPerVariant = new Array(numVariants).fill(0);
        const variantMeshes = variants.map((variant, vIdx) => {
            const existingMesh = existingChildren[vIdx];
            if (existingMesh?.isInstancedMesh) return existingMesh;

            disposeVariantMesh(existingMesh);
            const mesh = createVariantMesh(variant.geometry, variant.material, 1);
            group.add(mesh);
            return mesh;
        });

        for (let i = numVariants; i < existingChildren.length; i++) {
            disposeVariantMesh(existingChildren[i]);
        }

        // Calculate assignments
        const assignments = new Int32Array(totalCount);
        if (distributionMode === 'RANDOM' && numVariants > 1) {
            // seeded-like random or just simple random (stable for this call)
            for (let i = 0; i < totalCount; i++) assignments[i] = Math.floor(Math.random() * numVariants);
        } else {
            // ROUND ROBIN
            for (let i = 0; i < totalCount; i++) assignments[i] = i % numVariants;
        }

        for (let i = 0; i < totalCount; i++) { countsPerVariant[assignments[i]]++; }

        variantMeshes.forEach((existingMesh, vIdx) => {
            const variant = variants[vIdx];
            const needed = countsPerVariant[vIdx];
            let mesh = existingMesh;
            if (needed > mesh.instanceMatrix.count) {
                const newMax = Math.max(mesh.instanceMatrix.count * 2, needed + 1000);
                const newMesh = createVariantMesh(variant.geometry, variant.material, newMax);
                disposeVariantMesh(mesh);
                group.add(newMesh);
                mesh = newMesh;
                variantMeshes[vIdx] = mesh;
            }
            mesh.count = needed;
            mesh.userData.globalIndices = new Int32Array(needed);
            mesh.userData.localCounter = 0;
            mesh.geometry = variant.geometry;
            mesh.material = variant.material;
        });

        const dum = dummyRef.current;
        for (let i = 0; i < totalCount; i++) {
            const variantIdx = assignments[i];
            const mesh = variantMeshes[variantIdx];
            if (!mesh) continue;
            const localIdx = mesh.userData.localCounter++;
            if (localIdx >= mesh.count) continue;
            mesh.userData.globalIndices[localIdx] = i;
            const o = origins[i];
            dum.position.copy(o.pos);
            dum.rotation.copy(o.rot);
            dum.scale.copy(o.scale);
            dum.updateMatrix();
            mesh.setMatrixAt(localIdx, dum.matrix);
        }
        variantMeshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; delete mesh.userData.localCounter; });
    };

    const applyModifierLogic = (obj, mod, t, index) => {
        // Base params from modifier
        const baseP = mod.params;

        // INTERPOLATED PARAMS
        const p: any = new Proxy(baseP, {
            get: (target, prop: string) => {
                // Properties that shouldn't be interpolated or are structural
                if (prop === 'step' || prop === 'axis' || prop === 'error' || prop === 'sliders' || prop === 'code') return target[prop];
                const keyId = `mod_${mod.instanceId}_${prop}`;
                return getVal(keyId, target[prop]);
            }
        });

        // Helper for consistent access
        const getP = (k) => getVal(`mod_${mod.instanceId}_${k}`, baseP[k]);

        // Offset TIME for effect spread
        const step = baseP.step !== undefined ? baseP.step : 0.1;
        const offset = index * step;
        const time = t + offset;

        switch (mod.type) {
            case 'orbit': const rr = (time * p.speed) * (Math.PI * 2) * 0.1; if (p.axis === 'y') obj.rotation.y += rr; else if (p.axis === 'x') obj.rotation.x += rr; else obj.rotation.z += rr; break;
            case 'code':
                const cacheKey = mod.instanceId; let script = scriptCache.current[cacheKey]; const v = {}; if (p.sliders) p.sliders.forEach(s => { v[s.id] = s.val; });
                if (!script || script.raw !== p.code) {
                    try { const func = new Function('p', 'r', 's', 't', 'i', 'M', 'v', p.code); scriptCache.current[cacheKey] = { raw: p.code, func: func, valid: true }; if (p.error) { p.error = null; } }
                    catch (e: any) { scriptCache.current[cacheKey] = { raw: p.code, valid: false, error: e.message }; p.error = e.message; return; }
                    script = scriptCache.current[cacheKey];
                }
                if (script && script.valid) { try { script.func(obj.position, obj.rotation, obj.scale, t, index, Math, v); } catch (re: any) { script.valid = false; p.error = "Runtime: " + re.message; } }
                break;
            case 'float': obj.position.y += Math.sin((time * p.speed) + p.phase) * p.height; break;
            case 'pulse': obj.scale.multiplyScalar(1 + Math.sin(time * p.speed) * p.scale); break;
            case 'shake': obj.position.add(new THREE.Vector3((noise(t * p.frequency + index) - 0.5) * p.intensity, (noise(t * p.frequency + 100 + index) - 0.5) * p.intensity, (noise(t * p.frequency + 200 + index) - 0.5) * p.intensity)); break;
            case 'elastic': const str = 1 + Math.sin(time * p.speed) * p.amount; const sq = 1 / Math.sqrt(Math.max(0.1, str)); if (p.axis === 'y') obj.scale.set(sq, str, sq); else obj.scale.set(str, sq, sq); break;
            case 'pendulum': const th = Math.sin(time * p.speed) * (p.angle * (Math.PI / 180)); if (p.axis === 'z') obj.rotation.z += th; else obj.rotation.x += th; break;
            case 'wobble': obj.rotation.x += Math.sin(time * p.speed) * p.intensity; obj.rotation.z += Math.cos(time * p.speed * 1.3) * p.intensity; break;
            case 'figure8': obj.position.x += Math.cos(time * p.speed) * p.width; obj.position.z += Math.sin(time * p.speed * 2) * (p.width * 0.5); break;
            case 'heartbeat': const bt = (time * (p.bpm / 60)) % 1; let bi = 0; if (bt < 0.15) bi = Math.sin(bt * Math.PI / 0.15); else if (bt > 0.25 && bt < 0.4) bi = Math.sin((bt - 0.25) * Math.PI / 0.15) * 0.6; obj.scale.multiplyScalar(1 + bi * p.intensity); break;
            case 'bounce': const by = Math.abs(Math.sin(time * p.speed)) * p.height; obj.position.y += by; if (by < 0.2) { const sf = 1.0 + (0.2 - by) * p.squash; obj.scale.set(1 + sf * 0.2, 1 / sf, 1 + sf * 0.2); } break;
            case 'tumble': obj.rotation.x += time * p.speedX; obj.rotation.y += time * p.speedY; obj.rotation.z += time * p.speedZ; break;
            case 'strobe': if (Math.sin(time * p.speed) <= (p.duty * 2 - 1)) obj.scale.set(0, 0, 0); break;
            case 'corkscrew': obj.position.y += Math.sin(time * p.speed) * p.height; obj.rotation.y += time * p.rotations; break;
            case 'shiver': obj.scale.multiplyScalar(1 + (hash(t * p.frequency + index) - 0.5) * p.intensity); break;
            case 'sway': const sr = p.angle * (Math.PI / 180); obj.rotation.z += Math.sin(time * p.speed) * sr; obj.rotation.x += Math.cos(time * p.speed * 0.7) * (sr * 0.5); break;
            case 'yoyo': obj.position.y -= Math.abs(Math.sin(time * p.speed)) * p.length; break;
            case 'crab': obj.position.x += Math.sin(time * p.speed) * p.width; break;
            case 'lissajous': obj.position.add(new THREE.Vector3(p.size * Math.sin(p.a * time * p.speed), p.size * Math.sin(p.b * time * p.speed), p.size * Math.sin(time * p.speed))); break;
            case 'flip': const ft = (time * p.speed) % p.interval; if (ft < 1.0) { const ea = ft * ft * (3 - 2 * ft); const an = ea * Math.PI * 2; if (p.axis === 'x') obj.rotation.x += an; if (p.axis === 'y') obj.rotation.y += an; if (p.axis === 'z') obj.rotation.z += an; } break;
            case 'tremor': obj.rotation.x += (noise(t * p.speed + index) - 0.5) * p.intensity; obj.rotation.y += (noise(t * p.speed + 100 + index) - 0.5) * p.intensity; obj.rotation.z += (noise(t * p.speed + 200 + index) - 0.5) * p.intensity; break;
            case 'scan': const sp = Math.sin(time * p.speed) * p.distance; if (p.axis === 'x') obj.position.x += sp; if (p.axis === 'y') obj.position.y += sp; if (p.axis === 'z') obj.position.z += sp; break;
            case 'warp': const wv = Math.sin(time * p.speed); obj.position.z += wv * 5; const ws = 1 + Math.abs(Math.cos(time * p.speed)) * p.stretch; obj.scale.z *= ws; obj.scale.x /= Math.sqrt(ws); obj.scale.y /= Math.sqrt(ws); break;
            case 'drift': obj.position.add(new THREE.Vector3((noise(t * p.speed + index) - 0.5) * p.radius * 5, (noise(t * p.speed + 50 + index) - 0.5) * p.radius * 5, (noise(t * p.speed + 100 + index) - 0.5) * p.radius * 5)); break;
            case 'bobble': const bY = Math.abs(Math.sin(time * p.speed)); obj.position.y += bY * 0.2; obj.rotation.z += Math.cos(time * p.speed) * p.amount; break;
            case 'twist': const ta = Math.sin(time * p.speed) * (p.angle * Math.PI / 180); if (p.axis === 'y') obj.rotation.y += ta; if (p.axis === 'x') obj.rotation.x += ta; if (p.axis === 'z') obj.rotation.z += ta; break;

            // NEW MODIFIERS
            case 'spiral':
                const sp_a = time * p.speed * p.rotations + (index * 0.1);
                const sp_r = p.radius + (Math.sin(time * p.speed * 0.5) * p.grow);
                obj.position.x += Math.cos(sp_a) * sp_r;
                obj.position.z += Math.sin(sp_a) * sp_r;
                break;
            case 'vortex':
                const dist = Math.sqrt(obj.position.x * obj.position.x + obj.position.z * obj.position.z);
                const v_factor = Math.max(0, 1 - (dist / p.radius)) * p.strength;
                const v_angle = time * p.speed * v_factor;
                const cosV = Math.cos(v_angle); const sinV = Math.sin(v_angle);
                const vx = obj.position.x * cosV - obj.position.z * sinV;
                const vz = obj.position.x * sinV + obj.position.z * cosV;
                obj.position.x = vx; obj.position.z = vz;
                obj.position.y += v_factor * Math.sin(time * p.speed * 2);
                break;
            case 'magnet':
                const m_target = new THREE.Vector3(Math.sin(time * p.speed) * p.range, Math.cos(time * p.speed * 0.7) * p.range, 0);
                const m_dist = obj.position.distanceTo(m_target);
                if (m_dist < p.range) {
                    const pull = (1 - m_dist / p.range) * p.strength;
                    obj.position.lerp(m_target, pull * 0.1);
                }
                break;
            case 'noise_flow':
                const nx = noise(obj.position.x * p.scale + time * p.speed);
                const ny = noise(obj.position.y * p.scale + time * p.speed + 100);
                const nz = noise(obj.position.z * p.scale + time * p.speed + 200);
                obj.position.add(new THREE.Vector3((nx - 0.5) * p.force, (ny - 0.5) * p.force, (nz - 0.5) * p.force));
                obj.rotation.x += (nx - 0.5) * p.force;
                obj.rotation.y += (ny - 0.5) * p.force;
                break;
            case 'ripple':
                const r_dist = Math.sqrt(obj.position.x * obj.position.x + obj.position.z * obj.position.z);
                const r_wave = Math.sin(r_dist * p.frequency - time * p.speed) * p.amplitude * Math.exp(-r_dist * p.decay);
                obj.position.y += r_wave;
                // Tilt based on wave derivative approx
                obj.rotation.x += r_wave * 0.5;
                break;
            case 'squash':
                const sq_v = 1 + Math.sin(time * p.speed + index * 0.1) * p.amount;
                const sq_i = 1 / Math.sqrt(sq_v);
                if (p.axis === 'y') obj.scale.set(sq_i, sq_v, sq_i);
                else if (p.axis === 'x') obj.scale.set(sq_v, sq_i, sq_i);
                else obj.scale.set(sq_i, sq_i, sq_v);
                break;
            case 'accordion':
                const ac_v = Math.sin(time * p.speed) * p.amount;
                if (p.axis === 'y') obj.position.y *= (1 + ac_v);
                else if (p.axis === 'x') obj.position.x *= (1 + ac_v);
                else obj.position.z *= (1 + ac_v);
                break;
            case 'chaos':
                // Lorenz-ish attraction
                const dt = 0.01 * p.speed;
                const dx = 10 * (obj.position.y - obj.position.x);
                const dy = obj.position.x * (28 - obj.position.z) - obj.position.y;
                const dz = obj.position.x * obj.position.y - (8 / 3) * obj.position.z;
                obj.position.add(new THREE.Vector3(dx * dt * p.scale, dy * dt * p.scale, dz * dt * p.scale));
                break;
            case 'breathe':
                const br = 1 + (Math.sin(time * p.speed) * 0.5 + 0.5) * p.amount + (noise(time + index) * 0.1);
                obj.scale.multiplyScalar(br);
                break;
            case 'explode':
                const ex_t = (time * 0.5) % 2;
                if (ex_t > p.trigger) {
                    const ex_dir = obj.position.clone().normalize();
                    const ex_force = (ex_t - p.trigger) * p.strength;
                    obj.position.add(ex_dir.multiplyScalar(ex_force));
                    obj.rotation.x += Math.random() * ex_force;
                    obj.rotation.y += Math.random() * ex_force;
                }
                break;

            default: break;
        }
    };

    const handleResetCamera = () => {
        const { camera, controls } = sceneRef.current;
        if (!camera || !controls) {
            return;
        }

        const focusTarget = meshGroupRef.current ?? sceneRef.current.scene ?? null;
        const bounds = focusTarget ? new THREE.Box3().setFromObject(focusTarget) : new THREE.Box3();
        if (bounds.isEmpty()) {
            camera.position.set(15, 15, 20);
            controls.target.set(0, 0, 0);
            controls.update();
            return;
        }

        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 4);
        const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
        if (direction.lengthSq() < 0.001) {
            direction.set(1, 0.85, 1);
        }

        direction.normalize();
        camera.position.copy(center.clone().add(direction.multiplyScalar(Math.max(10, maxDim * 1.8))));
        controls.target.copy(center);
        controls.update();
        setStatus('Viewport Framed');
    };

    useZenControlBindings('cloner', ({ actionId, phase, sourceModuleId }) => {
        if (sourceModuleId !== 'cloner' || phase !== 'down') {
            return false;
        }

        if (actionId === 'camera.focus') {
            if (isToolOverlay) {
                return false;
            }
            handleResetCamera();
            return true;
        }

        return false;
    });

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = (event) => {
            loadGeometryFromSource(event.target?.result as ArrayBuffer, file.name);
        };
    };

    const handleUplink = async () => {
        const group = meshGroupRef.current;
        if (!group || !onCommit) return;
        setStatus("Uplinking to Kernel...");

        // We export as GLB INSTANCE mode for efficiency
        const exportScene = new THREE.Scene();
        group.children.forEach(mesh => {
            if (mesh.isInstancedMesh) {
                const c = mesh.clone();
                exportScene.add(c);
            }
        });

        // @ts-ignore
        new GLTFExporter().parse(
            exportScene,
            (glb) => {
                const blob = new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' });
                const file = new File([blob], `KCloner_Link_${Date.now()}.glb`);
                onCommit(file, 'K-CLONER');
                setStatus("Uplink Complete");
            },
            (err) => { console.error(err); setStatus("Uplink Error"); },
            { binary: true }
        );
    };

    // CHAIN MANAGERS
    const addChain = () => {
        const newChain = createChainInstance(chains.length);
        setChains(prev => [...prev, newChain]);
        setActiveChainId(newChain.id);
    };

    const removeChain = (id) => {
        if (chains.length <= 1) return;
        const newChains = chains.filter(c => c.id !== id);
        setChains(newChains);
        if (activeChainId === id) setActiveChainId(newChains[0].id);
    };

    const updateChain = (id, field, value) => {
        setChains(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addModifier = (key) => {
        setChains(prev => prev.map(c => {
            if (c.id === activeChainId) {
                return { ...c, modifiers: [...c.modifiers, createModifierInstance(key)] };
            }
            return c;
        }));
    };

    const updateParam = (modId, param, val) => {
        setChains(prev => prev.map(c => {
            if (c.id === activeChainId) {
                return {
                    ...c,
                    modifiers: c.modifiers.map(m => m.instanceId === modId ? { ...m, params: { ...m.params, [param]: val } } : m)
                };
            }
            return c;
        }));
    };

    const removeModifier = (modId) => {
        setChains(prev => prev.map(c => {
            if (c.id === activeChainId) {
                return { ...c, modifiers: c.modifiers.filter(m => m.instanceId !== modId) };
            }
            return c;
        }));
        setSelectedModId(null);
    };

    const handleReset = () => {
        setChains(prev => prev.map(c => ({ ...c, modifiers: [] })));
        setSelectedModId(null);
        setPlaybackChainId(null);
        focusSequencerSource();
        updateSequencerTransport({ isPlaying: false, currentTime: 0 });
        timeRef.current = 0;
        if (playheadRef.current) playheadRef.current.style.left = '0%';
        if (timeTextRef.current) timeTextRef.current.innerText = '0.00';
    };

    // --- UNIVERSAL EXPORT ENGINE ---
    const handleBake = async () => {
        const { exportFormat, exportMode, targetEngine, totalDuration, chains, splitAnimations, fps } = stateRef.current;
        const group = meshGroupRef.current;
        const origins = originalsRef.current;

        if (!group || origins.length === 0) {
            setStatus("Error: No Scene Data");
            return;
        }

        const wasPlaying = isPlaying;
        focusSequencerSource();
        updateSequencerTransport({ isPlaying: false });
        setBaking(true); setStatus(`Starting ${exportMode} Export...`);
        await new Promise(r => setTimeout(r, 50));

        try {
            if (exportFormat === 'VAT') {
                const totalFrames = Math.floor(totalDuration * fps);
                const data: any = { fps, duration: totalDuration, frames: [] };
                const dum = dummyRef.current;
                for (let f = 0; f <= totalFrames; f++) {
                    const globalTime = f / fps;

                    // Find active chain for this frame
                    let activeChain = chains[0];
                    let localTime = 0;
                    let timeAccumulator = 0;
                    for (const chain of chains) {
                        if (globalTime < timeAccumulator + chain.duration) {
                            activeChain = chain;
                            localTime = globalTime - timeAccumulator;
                            break;
                        }
                        timeAccumulator += chain.duration;
                    }

                    let effectiveTime = localTime;
                    const stepMod = activeChain.modifiers.find(m => m.type === 'step');
                    if (stepMod) { effectiveTime = Math.floor(localTime * stepMod.params.fps) / stepMod.params.fps; }

                    const frame: any[] = [];
                    group.children.forEach(mesh => {
                        if (!mesh.isInstancedMesh) return;
                        const indices = mesh.userData.globalIndices;
                        if (!indices) return;
                        for (let i = 0; i < mesh.count; i++) {
                            const gIdx = indices[i];
                            const orig = origins[gIdx];
                            if (!orig) continue;
                            dum.position.copy(orig.pos); dum.rotation.copy(orig.rot); dum.scale.copy(orig.scale);
                            activeChain.modifiers.forEach(mod => { if (mod.type !== 'step') applyModifierLogic(dum, mod, effectiveTime, gIdx); });
                            frame.push([Number(dum.position.x.toFixed(3)), Number(dum.position.y.toFixed(3)), Number(dum.position.z.toFixed(3))]);
                        }
                    });
                    data.frames.push(frame);
                }
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `KCloner_VAT.json`; a.click();
                setBaking(false); updateSequencerTransport({ isPlaying: wasPlaying });
                return;
            }

            // CONSTRUCT EXPORT SCENE
            const exportScene = new THREE.Scene();
            if (targetEngine === 'UNREAL') exportScene.rotation.x = Math.PI;
            if (targetEngine === 'BLENDER') exportScene.rotation.x = -Math.PI / 2;

            // Mode: INSTANCE
            if (exportMode === 'INSTANCE' && exportFormat === 'GLB') {
                group.children.forEach(mesh => {
                    if (mesh.isInstancedMesh) {
                        const c = mesh.clone();
                        exportScene.add(c);
                    }
                });
            }
            // Mode: SEPARATED/ANIM
            else {
                group.children.forEach(mesh => {
                    if (!mesh.isInstancedMesh) return;
                    const indices = mesh.userData.globalIndices;
                    if (!indices) return;
                    for (let i = 0; i < mesh.count; i++) {
                        const gIdx = indices[i];
                        const orig = origins[gIdx];
                        if (!orig) continue;
                        const c = new THREE.Mesh(mesh.geometry.clone(), mesh.material.clone());
                        c.name = `Clone_${gIdx}`;
                        c.position.copy(orig.pos); c.rotation.copy(orig.rot); c.scale.copy(orig.scale);
                        c.updateMatrix(); // Force update
                        exportScene.add(c);
                    }
                });
            }

            // BAKE ANIMATION
            let clips: THREE.AnimationClip[] = [];
            if (exportMode === 'ANIM') {
                if (exportScene.children.length > 2000) { alert("Too many objects (>2000) for animation. Static bake forced."); }
                else {
                    const totalFrames = Math.floor(totalDuration * fps); const times: any[] = [];
                    const clones = exportScene.children;
                    const tracksMap = new Map();
                    clones.forEach(c => tracksMap.set(c.name, { p: [], q: [], s: [] }));

                    for (let f = 0; f <= totalFrames; f++) {
                        const globalTime = f / fps; times.push(globalTime);

                        let activeChain = chains[0];
                        let localTime = 0;
                        let timeAccumulator = 0;
                        for (const chain of chains) {
                            if (globalTime < timeAccumulator + chain.duration) {
                                activeChain = chain;
                                localTime = globalTime - timeAccumulator;
                                break;
                            }
                            timeAccumulator += chain.duration;
                        }

                        let effT = localTime;
                        const stepMod = activeChain.modifiers.find(m => m.type === 'step');
                        if (stepMod) effT = Math.floor(localTime * stepMod.params.fps) / stepMod.params.fps;

                        clones.forEach((item) => {
                            const parts = item.name.split('_');
                            if (parts.length < 2) return;
                            const gIdx = parseInt(parts[1]);
                            const orig = origins[gIdx];
                            if (!orig) return;

                            item.position.copy(orig.pos); item.rotation.copy(orig.rot); item.scale.copy(orig.scale);
                            activeChain.modifiers.forEach(mod => { if (mod.type !== 'step') applyModifierLogic(item, mod, effT, gIdx); });
                            item.updateMatrix();

                            const tr = tracksMap.get(item.name);
                            tr.p.push(item.position.x, item.position.y, item.position.z);
                            tr.q.push(item.quaternion.x, item.quaternion.y, item.quaternion.z, item.quaternion.w);
                            tr.s.push(item.scale.x, item.scale.y, item.scale.z);
                        });
                        if (f % 10 === 0) { setStatus(`Baking Frame ${f}/${totalFrames}`); await new Promise(r => setTimeout(r, 0)); }
                    }

                    // ANIMATION SPLITTER LOGIC
                    if (splitAnimations) {
                        let startTime = 0;
                        chains.forEach((chain) => {
                            const duration = chain.duration;
                            const endTime = startTime + duration;

                            const startIndex = times.findIndex(t => t >= startTime);
                            let endIndex = times.findIndex(t => t > endTime);
                            if (endIndex === -1) endIndex = times.length;

                            // Create normalized time array for this clip (starting at 0)
                            const chainTimes = times.slice(startIndex, endIndex).map(t => t - startTime);

                            const chainTracks: THREE.KeyframeTrack[] = [];
                            tracksMap.forEach((data, name) => {
                                // Slice data arrays (3 for vec, 4 for quat)
                                const pSlice = data.p.slice(startIndex * 3, endIndex * 3);
                                const qSlice = data.q.slice(startIndex * 4, endIndex * 4);
                                const sSlice = data.s.slice(startIndex * 3, endIndex * 3);

                                if (pSlice.length > 0) chainTracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, chainTimes, pSlice));
                                if (qSlice.length > 0) chainTracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, chainTimes, qSlice));
                                if (sSlice.length > 0) chainTracks.push(new THREE.VectorKeyframeTrack(`${name}.scale`, chainTimes, sSlice));
                            });

                            if (chainTracks.length > 0) {
                                clips.push(new THREE.AnimationClip(chain.name, duration, chainTracks));
                            }
                            startTime += duration;
                        });
                    } else {
                        // MONOLITHIC FALLBACK
                        const tracks: any[] = [];
                        tracksMap.forEach((data, name) => {
                            if (data.p.length > 0) {
                                tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, data.p));
                                tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, data.q));
                                tracks.push(new THREE.VectorKeyframeTrack(`${name}.scale`, times, data.s));
                            }
                        });
                        if (tracks.length > 0) clips.push(new THREE.AnimationClip('KCloner_Action', totalDuration, tracks));
                    }
                }
            }

            exportScene.updateMatrixWorld(true);

            if (exportFormat === 'GLB') {
                const opts: any = { binary: true };
                if (clips.length > 0) opts.animations = clips;

                // @ts-ignore
                new GLTFExporter().parse(
                    exportScene,
                    (glb) => {
                        const blob = new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `KCloner_${exportMode}_${Date.now()}.glb`; a.click();
                        setBaking(false); setStatus("Export Complete"); updateSequencerTransport({ isPlaying: wasPlaying });
                    },
                    (err) => { console.error(err); setBaking(false); setStatus("Export Error"); updateSequencerTransport({ isPlaying: wasPlaying }); },
                    opts
                );
            }
            else if (exportFormat === 'OBJ') {
                const res = new OBJExporter().parse(exportScene);
                const blob = new Blob([res], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `KCloner_Static.obj`; a.click();
                setBaking(false); updateSequencerTransport({ isPlaying: wasPlaying });
            }
            else if (exportFormat === 'USDZ') {
                const usdz = await new USDZExporter().parse(exportScene);
                const blob = new Blob([usdz as BlobPart], { type: 'application/octet-stream' }); const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `KCloner_Static.usdz`; a.click();
                setBaking(false); updateSequencerTransport({ isPlaying: wasPlaying });
            }

        } catch (e) {
            console.error(e);
            setBaking(false);
            setStatus("Export Failed");
            updateSequencerTransport({ isPlaying: wasPlaying });
        }
    };

    const activeChain = chains.find(c => c.id === activeChainId) || chains[0];
    const activeMod = activeChain.modifiers.find(m => m.instanceId === selectedModId);

    return (
        <div className={`flex h-full text-gray-200 font-sans overflow-hidden select-none ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-[#050505]'}`}>
            {/* LEFT PANEL */}
            {!isViewportHost && (
            <div className={`w-80 bg-[#0e0e0e] border-r border-[#222] flex flex-col z-20 shadow-2xl ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                <div className="p-4 border-b border-[#222] bg-gradient-to-r from-[#050505] to-[#111]"><h1 className="font-bold text-xl tracking-tighter text-white flex items-center gap-2"><Activity size={18} className="text-cyan-400" /> K-CLONER <span className="text-[9px] text-gray-500 font-mono">0.5 ALPHA</span></h1></div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    <div className="bg-[#131313] rounded border border-[#222] p-3">
                        <div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><GridIcon size={10} /> Cloner Structure</div>
                        <div className="flex bg-[#0a0a0a] p-1 rounded border border-[#333] mb-4">{['SINGLE', 'GRID', 'RADIAL', 'LINEAR'].map(m => (<button key={m} onClick={() => setClonerMode(m)} className={`flex-1 py-1.5 text-[9px] font-bold rounded transition-all ${clonerMode === m ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{m}</button>))}</div>

                        <div className="space-y-2 mb-4 p-2 bg-[#0a0a0a] rounded border border-[#333] animate-in slide-in-from-left-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-gray-500 flex items-center gap-1"><GridIcon size={10} /> DISTRIBUTION</span>
                                <div className="flex bg-[#161616] rounded p-0.5 border border-[#222]">
                                    {['ROUND_ROBIN', 'RANDOM'].map(m => (
                                        <button key={m} onClick={() => setDistributionMode(m)} className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${distributionMode === m ? 'bg-cyan-900 text-cyan-200' : 'text-gray-600 hover:text-white'}`}>
                                            {m === 'ROUND_ROBIN' ? 'CYCLE' : 'RND'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-[#222] pt-2">
                                <span className="text-[9px] font-bold text-gray-500 flex items-center gap-1"><Maximize size={10} /> AUTO-SCALE</span>
                                <button onClick={() => setNormalizeScale(!normalizeScale)} className={`w-8 h-4 rounded-full transition-colors relative border ${normalizeScale ? 'bg-cyan-900 border-cyan-700' : 'bg-[#161616] border-[#333]'}`}>
                                    <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform ${normalizeScale ? 'left-4.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                        {clonerMode === 'GRID' && (
                            <div className="space-y-4 animate-in slide-in-from-left-1">
                                {['x', 'y', 'z'].map(axis => (
                                    <div key={axis} className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                            <span>COUNT {axis.toUpperCase()}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => toggleKey(`grid_count_${axis}`, clonerCount[axis])} className={`transition-colors ${keyframes[`grid_count_${axis}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}><Diamond size={8} fill={keyframes[`grid_count_${axis}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? "currentColor" : "none"} /></button>
                                                <span className="text-cyan-400">{clonerCount[axis]}</span>
                                            </div>
                                        </div>
                                        <input type="range" min="1" max="50" value={clonerCount[axis]} onChange={e => setClonerCount({ ...clonerCount, [axis]: parseInt(e.target.value) || 1 })} className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-cyan-500" />

                                        <div className="flex justify-between text-[9px] text-gray-500 font-bold mt-1 items-center">
                                            <span>SPACING {axis.toUpperCase()}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => toggleKey(`grid_space_${axis}`, clonerSpacing[axis])} className={`transition-colors ${keyframes[`grid_space_${axis}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}><Diamond size={8} fill={keyframes[`grid_space_${axis}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? "currentColor" : "none"} /></button>
                                                <span className="text-cyan-400">{clonerSpacing[axis].toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <input type="range" min="0.1" max="10" step="0.1" value={clonerSpacing[axis]} onChange={e => setClonerSpacing({ ...clonerSpacing, [axis]: parseFloat(e.target.value) || 0 })} className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-gray-500" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {clonerMode === 'RADIAL' && (
                            <div className="space-y-2 animate-in slide-in-from-left-1">
                                <div className="flex justify-between text-[9px] text-gray-500 font-bold items-center">
                                    <span>COUNT</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => toggleKey(`rad_count`, radialCount)} className={`transition-colors ${keyframes[`rad_count`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}><Diamond size={8} fill={keyframes[`rad_count`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? "currentColor" : "none"} /></button>
                                        <span className="text-cyan-400">{radialCount}</span>
                                    </div>
                                </div>
                                <input type="range" min="3" max="2000" value={radialCount} onChange={e => setRadialCount(parseInt(e.target.value) || 3)} className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-cyan-500" />

                                <div className="flex justify-between text-[9px] text-gray-500 font-bold mt-2 items-center">
                                    <span>RADIUS</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => toggleKey(`rad_radius`, radialRadius)} className={`transition-colors ${keyframes[`rad_radius`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}><Diamond size={8} fill={keyframes[`rad_radius`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? "currentColor" : "none"} /></button>
                                        <span className="text-cyan-400">{radialRadius}</span>
                                    </div>
                                </div>
                                <input type="range" min="1" max="50" step="0.5" value={radialRadius} onChange={e => setRadialRadius(parseFloat(e.target.value) || 1)} className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-cyan-500" />
                            </div>
                        )}
                        {clonerMode === 'LINEAR' && (
                            <div className="space-y-2 animate-in slide-in-from-left-1"><div className="flex justify-between text-[9px] text-gray-500 font-bold"><span>COUNT Y</span> <span className="text-cyan-400">{clonerCount.y}</span></div><input type="range" min="1" max="2000" value={clonerCount.y} onChange={e => setClonerCount({ ...clonerCount, y: parseInt(e.target.value) || 1 })} className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-cyan-500" /><div className="flex justify-between text-[9px] text-gray-500 font-bold mt-2"><span>SPACING</span> <span className="text-cyan-400">{clonerSpacing.y}</span></div><input type="range" min="0.1" max="10" step="0.1" value={clonerSpacing.y} onChange={e => setClonerSpacing({ ...clonerSpacing, y: parseFloat(e.target.value) || 0.1 })} className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-cyan-500" /></div>
                        )}
                    </div>

                    <div className="space-y-6">
                        <div><div className="text-[10px] font-bold text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Database size={10} /> Basic Motion</div><div className="grid grid-cols-2 gap-2">{['ORBIT', 'FLOAT', 'PULSE', 'SHAKE', 'ELASTIC'].map(key => { const m = MODIFIERS[key]; return (<button key={key} onClick={() => addModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-cyan-500/50 hover:bg-[#1a1a1a] transition-all group"><m.icon size={16} className="text-gray-400 group-hover:text-cyan-400 transition-colors" /><span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span></button>) })}</div></div>
                        <div><div className="text-[10px] font-bold text-cyan-600 uppercase mb-3 flex items-center gap-2 tracking-wider"><Activity size={10} /> Rhythmic</div><div className="grid grid-cols-2 gap-2">{['PENDULUM', 'WOBBLE', 'FIGURE8', 'HEARTBEAT', 'GLITCH', 'STEP'].map(key => { const m = MODIFIERS[key]; return (<button key={key} onClick={() => addModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-cyan-500/50 hover:bg-[#1a1a1a] transition-all group"><m.icon size={16} className="text-gray-400 group-hover:text-cyan-400 transition-colors" /><span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span></button>) })}</div></div>
                        <div><div className="text-[10px] font-bold text-orange-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Zap size={10} /> Physics & FX</div><div className="grid grid-cols-2 gap-2">{['BOUNCE', 'TUMBLE', 'STROBE', 'CORKSCREW', 'SHIVER', 'SWAY', 'YOYO', 'CRAB'].map(key => { const m = MODIFIERS[key]; return (<button key={key} onClick={() => addModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-orange-500/50 hover:bg-[#1a1a1a] transition-all group"><m.icon size={16} className="text-gray-400 group-hover:text-orange-400 transition-colors" /><span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span></button>) })}</div></div>
                        <div><div className="text-[10px] font-bold text-purple-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Spline size={10} /> Complex Math</div><div className="grid grid-cols-2 gap-2">{['LISSAJOUS', 'FLIP', 'TREMOR', 'SCAN', 'WARP', 'DRIFT', 'BOBBLE', 'TWIST'].map(key => { const m = MODIFIERS[key]; return (<button key={key} onClick={() => addModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-purple-500/50 hover:bg-[#1a1a1a] transition-all group"><m.icon size={16} className="text-gray-400 group-hover:text-purple-400 transition-colors" /><span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span></button>) })}</div></div>
                        <div><div className="text-[10px] font-bold text-pink-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><TornadoIcon size={10} /> Advanced</div><div className="grid grid-cols-2 gap-2">{['SPIRAL', 'VORTEX', 'MAGNET', 'NOISE_FLOW', 'RIPPLE', 'SQUASH', 'ACCORDION', 'CHAOS', 'BREATHE', 'EXPLODE'].map(key => { const m = MODIFIERS[key]; return (<button key={key} onClick={() => addModifier(key)} className="flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-pink-500/50 hover:bg-[#1a1a1a] transition-all group"><m.icon size={16} className="text-gray-400 group-hover:text-pink-400 transition-colors" /><span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">{m.name}</span></button>) })}</div></div>
                        <div><div className="text-[10px] font-bold text-emerald-500 uppercase mb-3 flex items-center gap-2 tracking-wider"><Terminal size={10} /> Custom</div><div className="grid grid-cols-2 gap-2"><button onClick={() => addModifier('CODE')} className="col-span-2 flex flex-col items-center justify-center gap-2 p-2 bg-[#131313] border border-[#222] rounded hover:border-emerald-500/50 hover:bg-[#1a1a1a] transition-all group"><Terminal size={16} className="text-gray-400 group-hover:text-emerald-400 transition-colors" /><span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">K-SCRIPT</span></button></div></div>
                    </div>
                </div>
            </div>
            )}
            {/* MIDDLE: STACK & VIEWPORT */}
            <div className={`flex-1 flex flex-col relative ${isToolOverlay ? 'bg-transparent' : 'bg-black'}`}>
                {!isViewportHost && (
                <div className={`h-10 bg-[#0e0e0e] border-b border-[#222] flex items-center justify-between px-4 z-10 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                    <div className="flex items-center gap-2 text-gray-500"><MonitorPlay size={14} /><span className="text-[10px] font-mono uppercase">{status}</span></div>
                    <div className="flex gap-2 items-center"><button onClick={handleResetCamera} className="text-[9px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center gap-1 mr-2"><Camera size={10} /> RESET</button><button onClick={() => updateClonerSourceFps(30)} className={`text-[9px] px-2 py-0.5 rounded ${fps === 30 ? 'bg-cyan-900/30 text-cyan-400' : 'text-gray-600'}`}>30 FPS</button><button onClick={() => updateClonerSourceFps(60)} className={`text-[9px] px-2 py-0.5 rounded ${fps === 60 ? 'bg-cyan-900/30 text-cyan-400' : 'text-gray-600'}`}>60 FPS</button></div>
                </div>
                )}
                <div className={`flex-1 relative overflow-hidden ${isToolOverlay ? 'pointer-events-none bg-transparent' : 'bg-gradient-to-b from-[#080808] to-[#020202]'}`}>
                    <div ref={mountRef} className={`absolute inset-0 cursor-crosshair ${isToolOverlay ? 'opacity-0 pointer-events-none' : ''}`} />

                    {/* CHAIN MANAGER OVERLAY */}
                    {!isViewportHost && (
                    <div className={`absolute bottom-4 left-4 z-10 w-72 flex flex-col gap-2 ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                        <div className="bg-black/60 backdrop-blur rounded border border-white/5 p-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-cyan-500 uppercase flex items-center gap-2"><Link size={10} /> Chain Operations</span>
                                <button onClick={addChain} className="text-[9px] bg-cyan-900/50 hover:bg-cyan-700 text-cyan-100 px-1.5 py-0.5 rounded border border-cyan-800 flex items-center gap-1"><Plus size={10} /> NEW</button>
                            </div>
                            <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1">
                                {chains.map((chain, i) => (
                                    <button
                                        key={chain.id}
                                        onClick={() => { setActiveChainId(chain.id); setSelectedModId(null); }}
                                        className={`flex-shrink-0 px-2 py-1 rounded text-[9px] font-bold border transition-all ${activeChainId === chain.id ? 'bg-cyan-600 border-cyan-400 text-white' : playbackChainId === chain.id ? 'bg-cyan-900/30 border-cyan-800 text-cyan-200' : 'bg-black/40 border-white/10 text-gray-500 hover:text-white'}`}
                                    >
                                        {chain.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* MODIFIER STACK FOR ACTIVE CHAIN */}
                        <div className="bg-black/60 backdrop-blur rounded border border-white/5 p-2 max-h-64 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1">
                                <input
                                    type="text"
                                    value={activeChain.name}
                                    onChange={(e) => updateChain(activeChain.id, 'name', e.target.value)}
                                    className="bg-transparent text-[10px] font-bold text-white w-24 outline-none border-b border-transparent focus:border-cyan-500"
                                />
                                <div className="flex items-center gap-1">
                                    <Clock size={10} className="text-gray-500" />
                                    <input
                                        type="number"
                                        min="0.1" step="0.1"
                                        value={activeChain.duration}
                                        onChange={(e) => updateChain(activeChain.id, 'duration', parseFloat(e.target.value))}
                                        className="bg-transparent text-[9px] font-mono text-cyan-400 w-8 text-right outline-none border-b border-transparent focus:border-cyan-500"
                                    />
                                    <span className="text-[8px] text-gray-600">s</span>
                                    <button onClick={() => removeChain(activeChain.id)} className="text-gray-600 hover:text-red-500 ml-2"><Trash2 size={10} /></button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                {activeChain.modifiers.length === 0 && <div className="text-[9px] text-gray-600 text-center py-4 italic">Empty Chain</div>}
                                {activeChain.modifiers.map((mod, index) => (
                                    <div key={mod.instanceId} onClick={() => setSelectedModId(mod.instanceId)} className={`relative p-2 rounded border cursor-pointer flex items-center gap-3 transition-all backdrop-blur-sm ${selectedModId === mod.instanceId ? 'bg-cyan-950/40 border-cyan-500/50' : 'bg-black/40 border-white/5 hover:bg-black/80'}`}>
                                        <div className="text-[9px] font-mono text-gray-500">0{index + 1}</div>
                                        <mod.icon size={14} className={selectedModId === mod.instanceId ? 'text-cyan-400' : 'text-gray-500'} />
                                        <div className="flex-1"><div className={`text-[10px] font-bold ${selectedModId === mod.instanceId ? 'text-gray-200' : 'text-gray-400'}`}>{mod.name}</div></div>
                                        <button onClick={(e) => { e.stopPropagation(); removeModifier(mod.instanceId); }} className="text-gray-600 hover:text-red-500"><X size={12} /></button>
                                    </div>
                                ))}
                            </div>
                            {activeChain.modifiers.length > 0 && <button onClick={handleReset} className="mt-2 w-full text-[9px] text-red-500 hover:text-red-400 flex items-center justify-center gap-1 bg-black/20 hover:bg-black/40 px-2 py-1 rounded border border-transparent hover:border-red-900/30"><Trash2 size={10} /> CLEAR MODS</button>}
                        </div>
                    </div>
                    )}

                    {!isViewportHost && (
                    <div className="absolute top-4 right-4 flex flex-col items-end gap-1 pointer-events-none"><div className="text-[10px] font-bold text-gray-600 uppercase">kipp engine renderer</div><div className="text-[9px] text-gray-700 font-mono" ref={topTimeTextRef}>0.00s / {totalDuration.toFixed(2)}s</div></div>
                    )}
                </div>
                {!isViewportHost && (
                <div className={`bg-[#0e0e0e] border-t border-[#222] ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                    {zenShellMode === 'standalone' && (
                    <div className="h-16 flex items-center px-4 gap-4 z-20">
                        <button onClick={() => { focusSequencerSource(); updateSequencerTransport({ isPlaying: !isPlaying }); }} className="w-10 h-10 rounded-full bg-cyan-900/20 text-cyan-400 border border-cyan-900/50 flex items-center justify-center hover:bg-cyan-900/40 hover:text-white transition-all">{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
                        <button onClick={() => { focusSequencerSource(); updateSequencerTransport({ isPlaying: false, currentTime: 0 }); }} className="text-gray-500 hover:text-white transition-colors"><Square size={14} /></button>
                        <div className="flex-1 h-8 bg-[#131313] border border-[#222] rounded relative cursor-pointer overflow-hidden group" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const pct = (e.clientX - rect.left) / rect.width; const newTime = pct * totalDuration; focusSequencerSource(); updateSequencerTransport({ currentTime: newTime }); }}><div className="absolute inset-0 opacity-20 flex flex-col justify-evenly px-2 pointer-events-none"><div className="h-px bg-cyan-900 w-full" /><div className="h-px bg-cyan-900 w-full" /><div className="h-px bg-cyan-900 w-full" /></div><div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10 shadow-[0_0_10px_rgba(0,255,204,0.8)]" style={{ left: '0%' }}></div></div>
                        <div className="flex items-center gap-2 border-l border-[#222] pl-4"><Timer size={14} className="text-gray-500" /><span ref={timeTextRef} className="text-[10px] w-10 text-center font-mono text-cyan-400">0.00</span><span className="text-[10px] font-mono text-gray-600">/ {totalDuration.toFixed(2)}s</span></div>
                    </div>
                    )}
                    <div className="h-14 border-t border-[#222] bg-[#0a0a0a] flex items-center justify-between px-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase"><Download size={12} /> Export</div>
                        <div className="flex gap-2 items-center">
                            {/* SPLIT ANIMATIONS TOGGLE */}
                            <button
                                onClick={() => setSplitAnimations(!splitAnimations)}
                                className={`px-3 py-1.5 rounded text-[9px] font-bold flex items-center gap-2 border transition-all ${splitAnimations ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-[#161616] border-[#333] text-gray-500 hover:text-white'}`}
                                title="Export chains as separate animation clips in one GLB"
                            >
                                <Split size={12} className={splitAnimations ? "text-cyan-400" : "text-gray-600"} /> {splitAnimations ? 'SPLIT CHAINS' : 'SINGLE CLIP'}
                            </button>

                            {/* TARGET ENGINE SELECT */}
                            <div className="flex bg-[#161616] rounded border border-[#333] p-0.5 mr-2">
                                {['GENERIC', 'UNREAL', 'UNITY'].map(t => <button key={t} onClick={() => setTargetEngine(t)} className={`px-2 py-1.5 text-[8px] font-bold rounded ${targetEngine === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t}</button>)}
                            </div>
                            {/* FORMAT SELECT */}
                            <div className="flex bg-[#161616] rounded border border-[#333] p-0.5">
                                <button onClick={() => setExportFormat('GLB')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportFormat === 'GLB' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>GLB</button>
                                <button onClick={() => setExportFormat('OBJ')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportFormat === 'OBJ' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>OBJ</button>
                                <button onClick={() => setExportFormat('USDZ')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportFormat === 'USDZ' ? 'bg-cyan-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>USDZ</button>
                                <button onClick={() => setExportFormat('VAT')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportFormat === 'VAT' ? 'bg-purple-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>VAT</button>
                            </div>
                            {/* MODE SELECT */}
                            <div className="flex bg-[#161616] rounded border border-[#333] p-0.5 ml-2">
                                <button onClick={() => setExportMode('ANIM')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportMode === 'ANIM' ? 'bg-green-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>ANIM</button>
                                <button onClick={() => setExportMode('INSTANCE')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportMode === 'INSTANCE' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>INSTANCE</button>
                                <button onClick={() => setExportMode('SEPARATED')} className={`px-3 py-1.5 text-[9px] font-bold rounded ${exportMode === 'SEPARATED' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}>SEPARATED</button>
                            </div>

                            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-[#161616] hover:bg-[#222] border border-[#333] rounded text-[9px] font-bold text-gray-400 hover:text-white flex items-center gap-2 ml-2" title="Import File"><UploadCloud size={10} /> IMPORT</button>
                            <button onClick={() => setShowBrowser(true)} className="px-3 py-1.5 bg-[#161616] hover:bg-[#222] border border-[#333] rounded text-[9px] font-bold text-gray-400 hover:text-white flex items-center gap-2" title="Browse Storage"><Database size={10} /> BROWSE</button>
                            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".glb,.gltf,.fbx,.obj" />

                            <button onClick={handleUplink} className="px-3 py-1.5 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 rounded text-[9px] font-bold flex items-center gap-2 transition-all ml-2" title="Send to Kernel"><Share2 size={10} /> UPLINK</button>
                            <button onClick={handleBake} disabled={baking} className={`px-4 py-1.5 rounded font-bold text-[9px] flex items-center gap-2 tracking-widest hover:text-white transition-all shadow-lg border ml-2 ${exportFormat === 'VAT' ? 'bg-purple-900/20 hover:bg-purple-900/40 text-purple-400 border-purple-900/50' : 'bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-400 border-cyan-900/50'}`}>{baking ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />} {baking ? 'BAKING...' : 'EXPORT'}</button>
                        </div>
                    </div>
                </div>
                )}
            </div>
            {/* RIGHT PANEL */}
            {!isViewportHost && (
            <div className={`w-72 bg-[#0e0e0e] border-l border-[#222] flex flex-col z-20 shadow-2xl ${isToolOverlay ? 'pointer-events-auto' : ''}`}>
                <div className="p-3 border-b border-[#222] bg-[#111] flex justify-between items-center"><h2 className="font-bold text-xs tracking-widest text-gray-300 flex items-center gap-2"><Settings size={14} /> PARAMETERS</h2></div>
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar bg-[#0a0a0a]">
                    {activeMod ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-200">
                            <div className="flex items-start gap-3 border-b border-[#222] pb-4"><div className="p-2 bg-cyan-900/20 rounded border border-cyan-900/50 text-cyan-400"><activeMod.icon size={20} /></div><div><h3 className="font-bold text-sm text-gray-200 uppercase">{activeMod.name}</h3></div></div>
                            <div className="space-y-4">{Object.keys(activeMod.params).map(key => { const val = activeMod.params[key]; if (key === 'error' || key === 'sliders') return null; if (activeMod.type === 'code' && key === 'code') { const hasError = activeMod.params.error; return (<div key={key} className="space-y-2 animate-in slide-in-from-right"><div className="flex justify-between items-end"><div className="text-[9px] text-gray-400 font-bold">EXPRESSION SCRIPT</div>{hasError && <span className="text-[8px] text-red-500 bg-red-900/20 px-2 rounded animate-pulse">SYNTAX ERROR</span>}</div><div className="relative"><textarea className={`w-full h-32 bg-[#080808] border rounded p-2 text-[10px] font-mono outline-none resize-none leading-relaxed ${hasError ? 'border-red-500 text-red-400' : 'border-[#333] text-cyan-400 focus:border-cyan-500'}`} value={activeMod.params[key]} onChange={(e) => updateParam(selectedModId, key, e.target.value)} spellCheck="false" /><div className="absolute left-0 top-2 bottom-2 w-4 text-[8px] text-gray-700 flex flex-col items-center border-r border-[#222] pointer-events-none bg-[#0f0f0f]"><div>1</div><div>2</div><div>3</div></div></div>{hasError && (<div className="p-2 bg-red-900/10 border border-red-900/50 rounded text-[9px] text-red-400 font-mono">{`> ${activeMod.params.error}`}</div>)}<div className="space-y-2 pt-2 border-t border-[#222]"><div className="flex justify-between items-center"><div className="text-[9px] text-gray-400 font-bold">CUSTOM VARIABLES (v.)</div><button onClick={() => { const newSlider = { id: `var${activeMod.params.sliders.length}`, label: 'New Var', val: 1, min: 0, max: 10 }; const newSliders = [...activeMod.params.sliders, newSlider]; updateParam(selectedModId, 'sliders', newSliders); }} className="text-[8px] bg-[#1a1a1a] border border-[#333] hover:border-green-500 text-green-500 px-2 py-1 rounded">+ ADD SLIDER</button></div>{activeMod.params.sliders && activeMod.params.sliders.map((s, idx) => (<div key={idx} className="bg-[#111] p-2 rounded border border-[#222] space-y-2"><div className="flex gap-2 items-center"><span className="text-[9px] text-cyan-600 font-mono font-bold">v.</span><input type="text" value={s.id} onChange={(e) => { const copy = [...activeMod.params.sliders]; copy[idx].id = e.target.value.replace(/[^a-zA-Z0-9]/g, ''); updateParam(selectedModId, 'sliders', copy); }} className="bg-transparent border-b border-[#333] text-[9px] text-white w-16 focus:border-cyan-500 outline-none" /><input type="text" value={s.label} onChange={(e) => { const copy = [...activeMod.params.sliders]; copy[idx].label = e.target.value; updateParam(selectedModId, 'sliders', copy); }} className="bg-transparent text-[9px] text-gray-500 w-full text-right focus:text-gray-300 outline-none" /><button onClick={() => { const copy = activeMod.params.sliders.filter((_, i) => i !== idx); updateParam(selectedModId, 'sliders', copy); }} className="text-gray-600 hover:text-red-500"><X size={10} /></button></div><div className="flex gap-2 items-center"><button onClick={() => toggleKey(`mod_${selectedModId}_slider_${s.id}`, s.val)} className={`transition-colors ${keyframes[`mod_${selectedModId}_slider_${s.id}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}><Diamond size={8} fill={keyframes[`mod_${selectedModId}_slider_${s.id}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? "currentColor" : "none"} /></button><input type="range" min={s.min} max={s.max} step={0.01} value={s.val} onChange={(e) => { const copy = [...activeMod.params.sliders]; copy[idx].val = parseFloat(e.target.value); updateParam(selectedModId, 'sliders', copy); }} className="flex-1 h-1 bg-[#222] rounded-lg appearance-none accent-cyan-500 cursor-pointer" /><span className="text-[9px] font-mono text-cyan-400 w-8 text-right">{s.val.toFixed(1)}</span></div></div>))}</div></div>); } const isAxis = key === 'axis'; const isStep = key === 'step'; return (<div key={key}> <div className="flex justify-between text-[9px] text-gray-400 mb-2 font-bold uppercase tracking-wider">{key} {isStep && <span className="text-cyan-500">(OFFSET)</span>}</div> {isAxis ? (<div className="flex bg-[#161616] rounded border border-[#333] p-1">{['x', 'y', 'z'].map(axis => (<button key={axis} onClick={() => updateParam(selectedModId, key, axis)} className={`flex-1 py-1 text-[9px] uppercase font-bold rounded ${val === axis ? 'bg-cyan-700 text-white' : 'text-gray-500 hover:text-white'}`}>{axis}</button>))}</div>) : (<div className="flex gap-3 items-center"><button onClick={() => toggleKey(`mod_${selectedModId}_${key}`, val)} className={`transition-colors ${keyframes[`mod_${selectedModId}_${key}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? 'text-cyan-400 fill-cyan-400' : 'text-gray-700 hover:text-cyan-600'}`}><Diamond size={8} fill={keyframes[`mod_${selectedModId}_${key}`]?.some(k => Math.abs(k.t - timeRef.current) < 0.1) ? "currentColor" : "none"} /></button><input type="range" min={key.includes('speed') || key.includes('freq') ? 0.1 : 0} max={key.includes('angle') ? 360 : 10} step={0.01} value={val} onChange={(e) => updateParam(selectedModId, key, parseFloat(e.target.value) || 0)} className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer ${isStep ? 'bg-cyan-900/30 accent-cyan-400' : 'bg-[#222] accent-gray-400'}`} /><input type="number" value={val} onChange={(e) => updateParam(selectedModId, key, parseFloat(e.target.value) || 0)} className="w-12 bg-[#161616] border border-[#333] text-[9px] text-center text-cyan-400 rounded focus:border-cyan-500 outline-none py-1 font-mono" /></div>)}</div>) })}</div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50 gap-3"><MousePointer2 size={32} /><span className="text-[10px] uppercase font-bold tracking-widest text-center">Select a Modifier<br />to Edit</span></div>
                    )}
                </div>
            </div>
            )}
            <div className={isToolOverlay ? 'pointer-events-auto' : ''}>
                <AssetBrowser
                    isOpen={showBrowser}
                    onClose={() => setShowBrowser(false)}
                    browserTab="ARTIFACTS"
                    artifacts={sharedState?.storage || []}
                    materials={[]}
                    alphas={[]}
                    selectedArtifactIds={[]}
                    activeArtifactId={null}
                    previewArtifactId={null}
                    isImporting={false}
                    isMerging={false}
                    openFolders={{}}
                    onTabChange={() => { }}
                    onToggleFolder={() => { }}
                    onArtifactClick={() => { }}
                    onArtifactSelect={() => { }}
                    onArtifactWeld={() => { }}
                    onArtifactDownload={() => { }}
                    onArtifactDelete={() => { }}
                    onMountArtifact={(id) => {
                        const art = sharedState?.storage?.find(a => a.id === id);
                        if (art) {
                            const src = art.blob || art.url;
                            if (src) {
                                loadGeometryFromSource(src, art.name || 'asset.glb');
                                setShowBrowser(false);
                            } else {
                                setStatus("Asset has no data");
                            }
                        }
                    }}
                    onUnmountArtifact={() => { }}
                    onDeselectAll={() => { }}
                    onMerge={() => { }}
                    onImport={() => { }}
                    onAlphaImport={() => { }}
                    onMaterialDelete={() => { }}
                    onAlphaDelete={() => { }}
                />
            </div>
        </div>
    );
}
