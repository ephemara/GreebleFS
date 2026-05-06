import { create } from 'zustand';

// Define Types
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'add' | 'subtract';

// Layer normalization helper to ensure all required fields exist
// This prevents runtime crashes when layer data comes from external sources or older versions
const normalizeLayer = (layer: Partial<Layer> & { id: string; name: string }): Layer => ({
    id: layer.id,
    name: layer.name,
    visible: layer.visible ?? true,
    locked: layer.locked ?? false,
    solo: layer.solo ?? false,
    opacity: layer.opacity ?? 1,
    blendMode: layer.blendMode ?? 'normal',
    color: layer.color ?? '#FFFFFF', // Default to white instead of gray
    texture: layer.texture ?? null,
    normalMap: layer.normalMap ?? null,
    roughnessMap: layer.roughnessMap ?? null,
    displacementMap: layer.displacementMap ?? null,
    sourceImg: layer.sourceImg ?? null,
    matParams: layer.matParams,
    objects: Array.isArray(layer.objects) ? layer.objects : [],
    flux: layer.flux ?? { enabled: false, type: 'standard', chaos: 0.5, colorA: '#ff003c', colorB: '#000000' },
    deform: layer.deform ?? { inflate: 0, taper: 0, twist: 0, bend: 0, spherize: 0, noise: 0 }
});

export interface SceneObject {
    id: string;
    type: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    params?: any;
}

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    locked?: boolean;
    solo?: boolean;
    opacity?: number;
    blendMode?: BlendMode;
    color: string;
    texture?: any;
    normalMap?: any; // Normal Map (Data URL)
    roughnessMap?: any; // Roughness/ORM Map (Data URL)
    displacementMap?: any; // Height Map (Data URL)
    sourceImg?: any; // Original Image Element (for re-processing)
    matParams?: MaterialParams; // Per-layer material settings
    objects: SceneObject[];
    flux?: {
        enabled: boolean;
        type: string;
        chaos: number;
        colorA: string;
        colorB: string;
    };
    deform?: {
        inflate: number;
        taper: number;
        twist: number;
        bend: number;
        spherize: number;
        noise: number;
    };
}

export interface TransformData {
    posX: number; posY: number; posZ: number;
    rotX: number; rotY: number; rotZ: number;
    scaleX: number; scaleY: number; scaleZ: number;
    scale: number;
    rotationY: number;
    height: number;
}

export interface MaterialParams {
    normalStrength: number;
    roughnessContrast: number;
    roughnessBrightness: number;
    roughnessInvert: boolean;
    metalContrast: number;
    metalBias: number;
    aoIntensity: number;
    makeSeamless: boolean;
    hue: number;
    wear: number;
    scale: number;
    displacementScale: number;
    doubleSided: boolean;
}

interface GreebleState {
    // --- MODE & UI ---
    mode: 'build' | 'edit' | 'animate';
    setMode: (mode: 'build' | 'edit' | 'animate') => void;
    gizmoMode: 'translate' | 'rotate' | 'scale';
    setGizmoMode: (mode: 'translate' | 'rotate' | 'scale') => void;
    transformSpace: 'world' | 'local';
    setTransformSpace: (space: 'world' | 'local') => void;
    snapEnabled: boolean;
    setSnapEnabled: (enabled: boolean) => void;
    isGizmoDragging: boolean;
    setIsGizmoDragging: (dragging: boolean) => void;
    buildTab: 'GREEBLE' | 'PRIMITIVES' | 'KERNEL' | 'XENO';
    setBuildTab: (tab: 'GREEBLE' | 'PRIMITIVES' | 'KERNEL' | 'XENO') => void;
    activeShape: string;
    setActiveShape: (shape: string) => void;

    // --- LAYERS ---
    layers: Layer[];
    activeLayerId: string;
    selectedLayerIds: Set<string>;
    setLayers: (layers: Layer[] | ((prev: Layer[]) => Layer[])) => void;
    setActiveLayerId: (id: string) => void;
    setSelectedLayerIds: (ids: Set<string>) => void;

    // Layer Actions
    addLayer: () => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    deleteLayer: (id: string) => void;
    duplicateLayer: (id: string) => void;
    mergeLayer: (id: string) => void;
    mergeSelectedLayers: () => void;
    toggleLayerVisibility: (id: string) => void;
    setLayerSolo: (id: string) => void;

    // Object Actions
    addObjectToLayer: (layerId: string, object: SceneObject) => void;
    updateObject: (layerId: string, objectId: string, updates: Partial<SceneObject>) => void;
    removeObject: (layerId: string, objectId: string) => void;

    // --- SELECTION & TRANSFORM ---
    selectedObjectUUID: string | null;
    setSelectedObjectUUID: (uuid: string | null) => void;
    transformData: TransformData;
    setTransformData: (data: Partial<TransformData> | ((prev: TransformData) => TransformData)) => void;

    // --- SCENE SETTINGS ---
    sunIntensity: number;
    setSunIntensity: (v: number) => void;
    sunAngle: number;
    setSunAngle: (v: number) => void;
    envMap: string | null;
    setEnvMap: (url: string | null) => void;
    graphicsQuality: 'low' | 'medium' | 'high' | 'extreme' | 'rt';
    setGraphicsQuality: (q: 'low' | 'medium' | 'high' | 'extreme' | 'rt') => void;

    // --- MATERIALS ---
    matParams: MaterialParams;
    setMatParams: (params: Partial<MaterialParams> | ((prev: MaterialParams) => MaterialParams)) => void;
    materialLibrary: any[];
    setMaterialLibrary: (lib: any[]) => void;

    // --- GENERATORS ---
    greebleParams: any;
    setGreebleParams: (params: any) => void;
    primitiveParams: any;
    setPrimitiveParams: (params: any) => void;
    titanParams: any;
    setTitanParams: (params: any) => void;

    // --- MODIFIERS ---
    symmetry: string;
    setSymmetry: (s: string) => void;
    radialCount: number;
    setRadialCount: (n: number) => void;
    surfaceMode: boolean;
    setSurfaceMode: (b: boolean) => void;
    gridLock: boolean;
    setGridLock: (b: boolean) => void;
    gridSize: number;
    setGridSize: (n: number) => void;
    voidAnchor: boolean;
    setVoidAnchor: (b: boolean) => void;
    chaosMode: boolean;
    setChaosMode: (b: boolean) => void;
    fractalEcho: boolean;
    setFractalEcho: (b: boolean) => void;
    neonMode: boolean;
    setNeonMode: (b: boolean) => void;
    
    // --- IMM BRUSH SCALE ---
    immBrushScaleMin: number;
    setImmBrushScaleMin: (n: number) => void;
    immBrushScaleMax: number;
    setImmBrushScaleMax: (n: number) => void;

    // --- EXPORT ---
    targetEngine: string;
    setTargetEngine: (e: string) => void;
    mergeOnExport: boolean;
    setMergeOnExport: (b: boolean) => void;
    includeBase: boolean;
    setIncludeBase: (b: boolean) => void;

    // --- SNAPSHOT STATE ---
    isSnapshotting: boolean;
    setIsSnapshotting: (b: boolean) => void;
}

export const useGreebleStore = create<GreebleState>((set) => ({
    // Mode
    mode: 'build',
    setMode: (mode) => set({ mode }),
    gizmoMode: 'translate',
    setGizmoMode: (gizmoMode) => set({ gizmoMode }),
    transformSpace: 'world',
    setTransformSpace: (transformSpace) => set({ transformSpace }),
    snapEnabled: false,
    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    isGizmoDragging: false,
    setIsGizmoDragging: (isGizmoDragging) => set({ isGizmoDragging }),
    buildTab: 'GREEBLE',
    setBuildTab: (buildTab) => set({ buildTab }),
    activeShape: 'GREEBLE',
    setActiveShape: (activeShape) => set({ activeShape }),

    // Layers
    layers: [{
        id: 'base',
        name: 'Base Mesh',
        visible: true,
        color: '#FFFFFF', // White - vibrant and visible!
        objects: [],
        flux: { enabled: false, type: 'standard', chaos: 0.5, colorA: '#ff003c', colorB: '#000000' },
        deform: { inflate: 0, taper: 0, twist: 0, bend: 0, spherize: 0, noise: 0 }
    }],
    activeLayerId: 'base',
    selectedLayerIds: new Set(['base']),
    setLayers: (input) => set((state) => {
        const rawLayers = typeof input === 'function' ? input(state.layers) : input;
        // Normalize all layers to ensure required fields exist, protecting against corrupted data
        return { layers: rawLayers.map(l => normalizeLayer(l)) };
    }),
    setActiveLayerId: (id) => set({ activeLayerId: id }), // Don't reset selection when setting active
    setSelectedLayerIds: (ids) => {
        console.log('🏪 STORE setSelectedLayerIds called with:', Array.from(ids));
        set({ selectedLayerIds: ids });
    },

    addLayer: () => set((state) => {
        const id = `layer_${Date.now()}`;
        const name = `Layer ${state.layers.length + 1}`;
        
        // Vibrant color palette - cycles through unique, visible colors
        const vibrantColors = [
            '#FFFFFF', // White
            '#00D9FF', // Cyan
            '#00FF88', // Green
            '#FF00FF', // Magenta
            '#FFFF00', // Yellow
            '#FF6B00', // Orange
            '#FF0066', // Hot Pink
            '#9D00FF', // Purple
            '#00FFFF', // Aqua
            '#FF3366', // Red-Pink
            '#66FF00', // Lime
            '#FF0099', // Deep Pink
            '#00CCFF', // Sky Blue
            '#FFCC00', // Gold
            '#FF3300', // Red-Orange
            '#00FF00', // Bright Green
        ];
        
        // Cycle through colors based on layer count
        const color = vibrantColors[state.layers.length % vibrantColors.length];
        
        const newLayer: Layer = {
            id, name, visible: true, color,
            objects: [],
            texture: null, normalMap: null, roughnessMap: null, displacementMap: null, sourceImg: null,
            flux: { enabled: false, type: 'standard', chaos: 0.5, colorA: '#ff003c', colorB: '#000000' },
            deform: { inflate: 0, taper: 0, twist: 0, bend: 0, spherize: 0, noise: 0 }
        };
        return {
            layers: [...state.layers, newLayer],
            activeLayerId: id,
            selectedLayerIds: new Set([id])
        };
    }),

    updateLayer: (id, updates) => set((state) => ({
        layers: state.layers.map(l => l.id === id ? { ...l, ...updates } : l)
    })),

    deleteLayer: (id) => set((state) => {
        if (state.layers.length <= 1) return state;
        const newLayers = state.layers.filter(l => l.id !== id);
        const newActiveId = state.activeLayerId === id ? newLayers[newLayers.length - 1].id : state.activeLayerId;
        return {
            layers: newLayers,
            activeLayerId: newActiveId,
            selectedLayerIds: new Set([newActiveId])
        };
    }),

    duplicateLayer: (id) => set((state) => {
        const source = state.layers.find(l => l.id === id);
        if (!source) return state;
        const newId = `layer_${Date.now()}`;
        // Deep copy objects
        const newObjects = source.objects.map(obj => ({
            ...obj,
            id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        }));

        const newLayer = { ...source, id: newId, name: `${source.name} Copy`, objects: newObjects };
        return {
            layers: [...state.layers, newLayer],
            activeLayerId: newId,
            selectedLayerIds: new Set([newId])
        };
    }),

    // Merge functions are implemented in KGreeble.tsx (need access to 3D scene)
    // These are just placeholders for TypeScript
    mergeLayer: (_id) => {},
    mergeSelectedLayers: () => {},

    toggleLayerVisibility: (id) => set((state) => ({
        layers: state.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
    })),

    setLayerSolo: (id) => set((state) => {
        const layer = state.layers.find(l => l.id === id);
        if (!layer) return state;
        const newSolo = !layer.solo;
        return {
            layers: state.layers.map(l => l.id === id ? { ...l, solo: newSolo } : l)
        };
    }),

    // Object Actions
    addObjectToLayer: (layerId, object) => set((state) => ({
        layers: state.layers.map(l => l.id === layerId ? { ...l, objects: [...l.objects, object] } : l)
    })),

    updateObject: (layerId, objectId, updates) => set((state) => ({
        layers: state.layers.map(l => l.id === layerId ? {
            ...l,
            objects: l.objects.map(o => o.id === objectId ? { ...o, ...updates } : o)
        } : l)
    })),

    removeObject: (layerId, objectId) => set((state) => ({
        layers: state.layers.map(l => l.id === layerId ? {
            ...l,
            objects: l.objects.filter(o => o.id !== objectId)
        } : l)
    })),

    // Selection
    selectedObjectUUID: null,
    setSelectedObjectUUID: (uuid) => set({ selectedObjectUUID: uuid }),
    transformData: { scale: 1, rotationY: 0, height: 0, posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    setTransformData: (input) => set((state) => ({
        transformData: typeof input === 'function' ? input(state.transformData) : { ...state.transformData, ...input }
    })),

    // Scene
    sunIntensity: 2.0,
    setSunIntensity: (v) => set({ sunIntensity: v }),
    sunAngle: 45,
    setSunAngle: (v) => set({ sunAngle: v }),
    envMap: null,
    setEnvMap: (url) => set({ envMap: url }),
    graphicsQuality: 'high',
    setGraphicsQuality: (q) => set({ graphicsQuality: q }),

    // Materials
    matParams: {
        normalStrength: 2.0, roughnessContrast: 1.2, roughnessBrightness: 0,
        roughnessInvert: true, metalContrast: 1.5, metalBias: -50,
        aoIntensity: 0.8, makeSeamless: false, hue: 0, wear: 0.1, scale: 1.0,
        displacementScale: 0.0, doubleSided: false
    },
    setMatParams: (input) => set((state) => ({
        matParams: typeof input === 'function' ? input(state.matParams) : { ...state.matParams, ...input }
    })),
    materialLibrary: [],
    setMaterialLibrary: (lib) => set({ materialLibrary: lib }),

    // Generators
    greebleParams: {
        seed: 12345, density: 0.7, clustering: 0.5, scale_min: 0.1, scale_max: 0.4,
        height_min: 0.05, height_max: 0.25, primitiveType: 'cubic', pattern: 'random',
        noise_frequency: 2.5, noise_octaves: 4,
    },
    setGreebleParams: (p) => set({ greebleParams: p }),

    primitiveParams: { infiniteShapes: false, shapeSegments: 12, distortion: 0 },
    setPrimitiveParams: (p) => set({ primitiveParams: p }),

    titanParams: {
        m1: 4, m2: 4, n1: 1, n2: 1, n3: 1, complexity: 2, twist: 0,
        highRes: false, useProcedural: false, landscapeMode: false
    },
    setTitanParams: (p) => set({ titanParams: p }),

    // Modifiers
    symmetry: 'none',
    setSymmetry: (s) => set({ symmetry: s }),
    radialCount: 6,
    setRadialCount: (n) => set({ radialCount: n }),
    surfaceMode: false,
    setSurfaceMode: (b) => set({ surfaceMode: b }),
    gridLock: false,
    setGridLock: (b) => set({ gridLock: b }),
    gridSize: 0.5,
    setGridSize: (n) => set({ gridSize: n }),
    voidAnchor: false,
    setVoidAnchor: (b) => set({ voidAnchor: b }),
    chaosMode: false,
    setChaosMode: (b) => set({ chaosMode: b }),
    fractalEcho: false,
    setFractalEcho: (b) => set({ fractalEcho: b }),
    neonMode: false,
    setNeonMode: (b) => set({ neonMode: b }),
    
    // IMM Brush Scale Range
    immBrushScaleMin: 0.01,
    setImmBrushScaleMin: (n) => set({ immBrushScaleMin: n }),
    immBrushScaleMax: 3,
    setImmBrushScaleMax: (n) => set({ immBrushScaleMax: n }),

    // Export
    targetEngine: 'GENERIC',
    setTargetEngine: (e) => set({ targetEngine: e }),
    mergeOnExport: false,
    setMergeOnExport: (b) => set({ mergeOnExport: b }),
    includeBase: false,
    setIncludeBase: (b) => set({ includeBase: b }),

    isSnapshotting: false,
    setIsSnapshotting: (b) => set({ isSnapshotting: b }),
}));
