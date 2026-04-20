export type ZenModuleId =
    | 'sculpt'
    | 'greeble'
    | 'scatter'
    | 'atlas'
    | 'painter'
    | 'cloner'
    | 'rig'
    | 'quantum'
    | 'graphos'
    | 'autopbr'
    | 'inspect'
    | 'tecton'
    | 'chronos'
    | 'genius'
    | 'bevy'
    | 'unknown';

export type ZenAssetKind = 'scene' | 'material' | 'alpha' | 'cache' | 'unknown';

export type ZenProjectionMode = 'perspective' | 'orthographic';

export const ZEN_COMPONENT_KEYS = {
    transform: 'zen:transform',
    assetRef: 'zen:asset-ref',
    materialBinding: 'zen:material-binding'
} as const;

export interface ZenMaterialBindingComponent {
    materialId: string | null;
}

export interface ZenAppDefinition {
    id: ZenModuleId;
    name: string;
    category: 'model' | 'surface' | 'anim' | 'sim' | 'render' | 'dev' | 'unknown';
    viewportGroupId: string;
    rootLayerName: string;
    sceneRole: 'editor' | 'sim' | 'utility';
    assetKind: ZenAssetKind;
    usesUniversalViewport: boolean;
    usesUniversalLayers: boolean;
    sharesSceneSpace: boolean;
    ecsTags: string[];
    defaultViewport: Partial<ZenViewportState>;
}

export interface ZenViewportCameraState {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    near: number;
    far: number;
    fov?: number;
    zoom?: number;
}

export interface ZenViewportState {
    moduleId: ZenModuleId;
    projection: ZenProjectionMode;
    camera: ZenViewportCameraState;
    background: string;
    navigationMode: string;
    domSize: {
        width: number;
        height: number;
    };
    lastUpdated: number;
}

export interface ZenSequencerSourceState {
    moduleId: ZenModuleId;
    label: string;
    duration: number;
    fps: number;
    loop: boolean;
    available: boolean;
    updatedAt: number;
}

export interface ZenSequencerState {
    activeSourceModuleId: ZenModuleId | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    fps: number;
    playbackRate: number;
    loop: boolean;
    lastUpdated: number;
    sources: Partial<Record<ZenModuleId, ZenSequencerSourceState>>;
}

export interface ZenSequencerSourceInput {
    label?: string;
    duration?: number;
    fps?: number;
    loop?: boolean;
    available?: boolean;
}

export interface ZenSequencerTransportPatch {
    isPlaying?: boolean;
    currentTime?: number;
    fps?: number;
    playbackRate?: number;
    loop?: boolean;
}

export interface ZenLayerDocument {
    id: string;
    name: string;
    moduleId: ZenModuleId;
    visible: boolean;
    locked: boolean;
    order: number;
    parentLayerId: string | null;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

export interface ZenEntityDocument {
    id: string;
    name: string;
    moduleId: ZenModuleId;
    layerId: string;
    assetId?: string;
    parentId: string | null;
    children: string[];
    components: Record<string, unknown>;
    tags: string[];
    createdAt: number;
    updatedAt: number;
}

export interface ZenAssetDocument {
    id: string;
    name: string;
    moduleId: ZenModuleId;
    kind: ZenAssetKind;
    mimeType: string;
    size: number;
    storagePath: string;
    extension: string;
    checksum?: string;
    createdAt: number;
    updatedAt: number;
    metadata: Record<string, unknown>;
}

export interface ZenMaterialDocument {
    id: string;
    name: string;
    preview: string;
    channels: Record<string, string | null>;
    createdAt: number;
    updatedAt: number;
}

export interface ZenAlphaDocument {
    id: string;
    name: string;
    preview: string;
    createdAt: number;
    updatedAt: number;
}

export interface ZenWorkspaceDocument {
    schema: 'zen.workspace';
    version: '1.0.0';
    createdAt: number;
    updatedAt: number;
    activeModuleId: ZenModuleId;
    activeViewportModuleId: ZenModuleId;
    activeAssetId: string | null;
    activeEntityId: string | null;
    activeLayerId: string | null;
    activeMaterialId: string | null;
    layers: ZenLayerDocument[];
    entities: ZenEntityDocument[];
    assets: ZenAssetDocument[];
    materials: ZenMaterialDocument[];
    alphas: ZenAlphaDocument[];
    viewports: Record<string, ZenViewportState>;
    moduleState: Record<string, Record<string, unknown>>;
}

export interface ZenLayerInput {
    id?: string;
    name: string;
    visible?: boolean;
    locked?: boolean;
    order?: number;
    parentLayerId?: string | null;
    tags?: string[];
}

export interface ZenEntityInput {
    id?: string;
    name: string;
    moduleId: ZenModuleId;
    layerId: string;
    assetId?: string;
    parentId?: string | null;
    children?: string[];
    components?: Record<string, unknown>;
    tags?: string[];
}

export interface ZenViewportRuntimeSession {
    element?: HTMLElement | null;
    scene?: unknown;
    camera?: unknown;
    controls?: unknown;
    renderer?: unknown;
}
