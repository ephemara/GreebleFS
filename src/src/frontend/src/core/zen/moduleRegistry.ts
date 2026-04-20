import { ZenAppDefinition, ZenModuleId } from './types';
import { UNIVERSAL_VIEWPORT_BACKGROUND_HEX } from './viewportTheme';

export const ZEN_UNIVERSAL_VIEWPORT_GROUP_ID = 'zen.universal.viewport';
export const ZEN_VIEWPORT_GROUP_HOSTS: Record<string, ZenModuleId> = {
    [ZEN_UNIVERSAL_VIEWPORT_GROUP_ID]: 'sculpt'
};

export const UNIVERSAL_VIEWPORT_MODULE_IDS: ZenModuleId[] = [
    'sculpt',
    'greeble',
    'scatter',
    'atlas',
    'graphos',
    'autopbr',
    'painter',
    'cloner',
    'rig',
    'chronos',
    'quantum',
    'tecton'
];

export const ZEN_APP_REGISTRY: Record<string, ZenAppDefinition> = {
    sculpt: {
        id: 'sculpt',
        name: 'K-SCULPT',
        category: 'model',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Sculpt Layers',
        sceneRole: 'editor',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['mesh', 'sculpt'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    greeble: {
        id: 'greeble',
        name: 'K-GREEBLE',
        category: 'model',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Greeble Layers',
        sceneRole: 'editor',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['mesh', 'procedural'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    scatter: {
        id: 'scatter',
        name: 'K-SCATTER',
        category: 'model',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Scatter Layers',
        sceneRole: 'editor',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['mesh', 'instancer'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    atlas: {
        id: 'atlas',
        name: 'K-ATLAS',
        category: 'surface',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Atlas Layers',
        sceneRole: 'utility',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['mesh', 'uv'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    graphos: {
        id: 'graphos',
        name: 'K-GRAPHOS',
        category: 'surface',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Graphos Layers',
        sceneRole: 'editor',
        assetKind: 'material',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['paint', 'material', 'canvas'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'paint'
        }
    },
    painter: {
        id: 'painter',
        name: 'K-PAINTER',
        category: 'surface',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Painter Layers',
        sceneRole: 'editor',
        assetKind: 'material',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['paint', 'material'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'paint'
        }
    },
    autopbr: {
        id: 'autopbr',
        name: 'K-SAMPLE',
        category: 'surface',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Sample Layers',
        sceneRole: 'editor',
        assetKind: 'material',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['material', 'sampling', 'surface'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    cloner: {
        id: 'cloner',
        name: 'K-CLONER',
        category: 'anim',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Cloner Layers',
        sceneRole: 'editor',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['mesh', 'instancer', 'animation'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    rig: {
        id: 'rig',
        name: 'K-RIG',
        category: 'anim',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Rig Layers',
        sceneRole: 'editor',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['mesh', 'rig'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    quantum: {
        id: 'quantum',
        name: 'K-QUANTUM',
        category: 'sim',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Quantum Layers',
        sceneRole: 'sim',
        assetKind: 'cache',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['sim', 'points'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    chronos: {
        id: 'chronos',
        name: 'K-CHRONOS',
        category: 'sim',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Chrono Quantum Layers',
        sceneRole: 'sim',
        assetKind: 'cache',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['sim', 'field', 'time'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    tecton: {
        id: 'tecton',
        name: 'K-TECTON',
        category: 'sim',
        viewportGroupId: ZEN_UNIVERSAL_VIEWPORT_GROUP_ID,
        rootLayerName: 'Landscape Layers',
        sceneRole: 'sim',
        assetKind: 'scene',
        usesUniversalViewport: true,
        usesUniversalLayers: true,
        sharesSceneSpace: true,
        ecsTags: ['terrain', 'landscape', 'sim'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'orbit'
        }
    },
    genius: {
        id: 'genius',
        name: 'K-GENIUS',
        category: 'dev',
        viewportGroupId: 'module.genius',
        rootLayerName: 'Kain Acceleration Notes',
        sceneRole: 'utility',
        assetKind: 'unknown',
        usesUniversalViewport: false,
        usesUniversalLayers: false,
        sharesSceneSpace: false,
        ecsTags: ['dev', 'kain', 'acceleration'],
        defaultViewport: {
            projection: 'perspective',
            background: UNIVERSAL_VIEWPORT_BACKGROUND_HEX,
            navigationMode: 'none'
        }
    }
};

export const MODULE_SOURCE_TO_ID: Record<string, ZenModuleId> = {
    'K-SCULPT': 'sculpt',
    'K-GREEBLE': 'greeble',
    'K-SCATTER': 'scatter',
    'K-ATLAS': 'atlas',
    'K-GRAPHOS': 'graphos',
    'K-SAMPLE': 'autopbr',
    'K-AUTOPBR': 'autopbr',
    'K-AUTOPBR_UPLINK': 'autopbr',
    'K-PAINTER': 'painter',
    'K-CLONER': 'cloner',
    'K-RIG': 'rig',
    'K-QUANTUM': 'quantum',
    'K-CHRONOS': 'chronos',
    'K-TECTON': 'tecton',
    'K-GENIUS': 'genius',
    IMPORT: 'unknown',
    MERGED: 'unknown'
};

export const resolveZenModuleId = (value?: string | null): ZenModuleId => {
    if (!value) return 'unknown';

    const normalized = value.toUpperCase();
    return MODULE_SOURCE_TO_ID[normalized] ?? (value.toLowerCase() as ZenModuleId) ?? 'unknown';
};

export const getZenAppDefinition = (moduleId: ZenModuleId): ZenAppDefinition | undefined =>
    ZEN_APP_REGISTRY[moduleId];

export const isUniversalViewportModule = (moduleId: ZenModuleId): boolean =>
    UNIVERSAL_VIEWPORT_MODULE_IDS.includes(moduleId);

export const getZenViewportGroupId = (moduleId: ZenModuleId): string =>
    getZenAppDefinition(moduleId)?.viewportGroupId ?? `module.${moduleId}`;

export const resolveViewportHostModuleId = (moduleId: ZenModuleId): ZenModuleId =>
    ZEN_VIEWPORT_GROUP_HOSTS[getZenViewportGroupId(moduleId)] ?? moduleId;

export const modulesShareViewportGroup = (
    leftModuleId: ZenModuleId,
    rightModuleId: ZenModuleId
): boolean => getZenViewportGroupId(leftModuleId) === getZenViewportGroupId(rightModuleId);

export const resolveViewportOwnerOnModuleSwitch = (
    _currentViewportModuleId: ZenModuleId,
    nextModuleId: ZenModuleId
): ZenModuleId => resolveViewportHostModuleId(nextModuleId);
