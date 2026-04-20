import {
    ZenAssetDocument,
    ZEN_COMPONENT_KEYS,
    ZenEntityDocument,
    ZenEntityInput,
    ZenLayerDocument,
    ZenLayerInput,
    ZenMaterialDocument,
    ZenAlphaDocument,
    ZenModuleId,
    ZenViewportState,
    ZenWorkspaceDocument
} from './types';
import {
    getZenAppDefinition,
    modulesShareViewportGroup,
    resolveViewportHostModuleId,
    resolveViewportOwnerOnModuleSwitch
} from './moduleRegistry';

const FALLBACK_CAMERA = {
    position: [6, 6, 6] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    up: [0, 1, 0] as [number, number, number],
    near: 0.1,
    far: 5000,
    fov: 45,
    zoom: 1
};

export const ZEN_SCENE_ROOT_LAYER_ID = 'zen:scene-root';
export const ZEN_SHARED_PLACEMENTS_LAYER_ID = 'zen:placements';
export const ZEN_SHARED_ASSET_LAYER_ID = 'zen:assets';

export const createZenId = (prefix: string): string =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const slugifyZenName = (value: string): string =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'layer';

export const createDefaultViewportState = (moduleId: ZenModuleId): ZenViewportState => {
    const module = getZenAppDefinition(moduleId);
    return {
        moduleId,
        projection: module?.defaultViewport.projection ?? 'perspective',
        camera: {
            ...FALLBACK_CAMERA
        },
        background: module?.defaultViewport.background ?? '#050505',
        navigationMode: module?.defaultViewport.navigationMode ?? 'orbit',
        domSize: { width: 0, height: 0 },
        lastUpdated: Date.now()
    };
};

export const getEntityMaterialId = (entity?: ZenEntityDocument | null): string | null => {
    if (!entity) {
        return null;
    }

    const binding = entity.components[ZEN_COMPONENT_KEYS.materialBinding] as
        | { materialId?: string | null }
        | undefined;

    return binding?.materialId ?? null;
};

export const ensureWorkspaceScaffold = (document: ZenWorkspaceDocument): ZenWorkspaceDocument => {
    const requestedViewportModuleId = document.activeViewportModuleId ?? document.activeModuleId;
    const resolvedViewportModuleId = resolveViewportHostModuleId(requestedViewportModuleId);
    const nextViewports = {
        ...document.viewports
    };
    const carriedViewport = nextViewports[requestedViewportModuleId];

    if (!nextViewports[resolvedViewportModuleId]) {
        nextViewports[resolvedViewportModuleId] = carriedViewport && modulesShareViewportGroup(requestedViewportModuleId, resolvedViewportModuleId)
            ? {
                ...carriedViewport,
                moduleId: resolvedViewportModuleId,
                lastUpdated: Date.now()
            }
            : createDefaultViewportState(resolvedViewportModuleId);
    }

    let nextDocument: ZenWorkspaceDocument = {
        ...document,
        activeViewportModuleId: resolvedViewportModuleId,
        activeAssetId: (document as any).activeAssetId ?? null,
        activeEntityId: (document as any).activeEntityId ?? null,
        activeLayerId: (document as any).activeLayerId ?? null,
        activeMaterialId: (document as any).activeMaterialId ?? null,
        viewports: nextViewports
    };

    nextDocument = ensureLayer(nextDocument, 'unknown', {
        id: ZEN_SCENE_ROOT_LAYER_ID,
        name: 'Scene Space',
        order: -100,
        parentLayerId: null,
        tags: ['workspace-root', 'scene-space']
    }).document;

    nextDocument = ensureLayer(nextDocument, 'unknown', {
        id: ZEN_SHARED_PLACEMENTS_LAYER_ID,
        name: 'Placed Objects',
        order: -99,
        parentLayerId: ZEN_SCENE_ROOT_LAYER_ID,
        tags: ['workspace-root', 'placements']
    }).document;

    nextDocument = ensureLayer(nextDocument, 'unknown', {
        id: ZEN_SHARED_ASSET_LAYER_ID,
        name: 'Asset Reservoir',
        order: -98,
        parentLayerId: ZEN_SCENE_ROOT_LAYER_ID,
        tags: ['workspace-root', 'assets']
    }).document;

    return nextDocument;
};

export const createZenWorkspaceDocument = (activeModuleId: ZenModuleId = 'sculpt'): ZenWorkspaceDocument => {
    const now = Date.now();
    const viewportModuleId = resolveViewportHostModuleId(activeModuleId);
    return ensureWorkspaceScaffold({
        schema: 'zen.workspace',
        version: '1.0.0',
        createdAt: now,
        updatedAt: now,
        activeModuleId,
        activeViewportModuleId: viewportModuleId,
        activeAssetId: null,
        activeEntityId: null,
        activeLayerId: null,
        activeMaterialId: null,
        layers: [],
        entities: [],
        assets: [],
        materials: [],
        alphas: [],
        viewports: {
            [viewportModuleId]: createDefaultViewportState(viewportModuleId)
        },
        moduleState: {}
    });
};

export const ensureLayer = (
    document: ZenWorkspaceDocument,
    moduleId: ZenModuleId,
    input: ZenLayerInput
): { document: ZenWorkspaceDocument; layer: ZenLayerDocument } => {
    const now = Date.now();
    const layerId = input.id ?? `${moduleId}:${slugifyZenName(input.name)}`;
    const existing = document.layers.find((layer) => layer.id === layerId);
    const nextLayer: ZenLayerDocument = existing
        ? {
            ...existing,
            name: input.name,
            visible: input.visible ?? existing.visible,
            locked: input.locked ?? existing.locked,
            order: input.order ?? existing.order,
            parentLayerId: input.parentLayerId ?? existing.parentLayerId,
            tags: input.tags ?? existing.tags,
            updatedAt: now
        }
        : {
            id: layerId,
            name: input.name,
            moduleId,
            visible: input.visible ?? true,
            locked: input.locked ?? false,
            order: input.order ?? document.layers.filter((layer) => layer.moduleId === moduleId).length,
            parentLayerId: input.parentLayerId ?? null,
            tags: input.tags ?? [],
            createdAt: now,
            updatedAt: now
        };

    const nextLayers = existing
        ? document.layers.map((layer) => (layer.id === layerId ? nextLayer : layer))
        : [...document.layers, nextLayer];

    return {
        document: {
            ...document,
            updatedAt: now,
            layers: nextLayers
        },
        layer: nextLayer
    };
};

export const syncModuleLayers = (
    document: ZenWorkspaceDocument,
    moduleId: ZenModuleId,
    layers: ZenLayerInput[]
): ZenWorkspaceDocument => {
    let nextDocument = ensureWorkspaceScaffold(document);
    const module = getZenAppDefinition(moduleId);

    if (module) {
        nextDocument = ensureLayer(nextDocument, moduleId, {
            id: `${moduleId}:root`,
            name: module.rootLayerName,
            order: -1,
            parentLayerId: ZEN_SHARED_PLACEMENTS_LAYER_ID,
            tags: ['module-root']
        }).document;
    }

    layers
        .slice()
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .forEach((layer, index) => {
            nextDocument = ensureLayer(nextDocument, moduleId, {
                ...layer,
                order: layer.order ?? index,
                parentLayerId: layer.parentLayerId ?? `${moduleId}:root`
            }).document;
        });

    return nextDocument;
};

export const upsertAsset = (
    document: ZenWorkspaceDocument,
    asset: ZenAssetDocument
): ZenWorkspaceDocument => {
    const now = Date.now();
    const exists = document.assets.some((entry) => entry.id === asset.id);
    const nextAsset = exists
        ? { ...asset, updatedAt: now }
        : { ...asset, createdAt: asset.createdAt ?? now, updatedAt: now };

    return {
        ...document,
        updatedAt: now,
        assets: exists
            ? document.assets.map((entry) => (entry.id === asset.id ? nextAsset : entry))
            : [...document.assets, nextAsset]
    };
};

export const upsertMaterial = (
    document: ZenWorkspaceDocument,
    material: ZenMaterialDocument
): ZenWorkspaceDocument => {
    const now = Date.now();
    const exists = document.materials.some((entry) => entry.id === material.id);
    const nextMaterial = exists
        ? { ...material, updatedAt: now }
        : { ...material, createdAt: material.createdAt ?? now, updatedAt: now };

    return {
        ...document,
        updatedAt: now,
        materials: exists
            ? document.materials.map((entry) => (entry.id === material.id ? nextMaterial : entry))
            : [...document.materials, nextMaterial]
    };
};

export const upsertAlpha = (
    document: ZenWorkspaceDocument,
    alpha: ZenAlphaDocument
): ZenWorkspaceDocument => {
    const now = Date.now();
    const exists = document.alphas.some((entry) => entry.id === alpha.id);
    const nextAlpha = exists
        ? { ...alpha, updatedAt: now }
        : { ...alpha, createdAt: alpha.createdAt ?? now, updatedAt: now };

    return {
        ...document,
        updatedAt: now,
        alphas: exists
            ? document.alphas.map((entry) => (entry.id === alpha.id ? nextAlpha : entry))
            : [...document.alphas, nextAlpha]
    };
};

export const upsertEntity = (
    document: ZenWorkspaceDocument,
    input: ZenEntityInput
): { document: ZenWorkspaceDocument; entity: ZenEntityDocument } => {
    const now = Date.now();
    const entityId = input.id ?? createZenId('entity');
    const existing = document.entities.find((entity) => entity.id === entityId);
    const nextEntity: ZenEntityDocument = existing
        ? {
            ...existing,
            ...input,
            parentId: input.parentId ?? existing.parentId,
            children: input.children ?? existing.children,
            components: input.components ?? existing.components,
            tags: input.tags ?? existing.tags,
            updatedAt: now
        }
        : {
            id: entityId,
            name: input.name,
            moduleId: input.moduleId,
            layerId: input.layerId,
            assetId: input.assetId,
            parentId: input.parentId ?? null,
            children: input.children ?? [],
            components: input.components ?? {},
            tags: input.tags ?? [],
            createdAt: now,
            updatedAt: now
        };

    const nextEntities = existing
        ? document.entities.map((entity) => (entity.id === entityId ? nextEntity : entity))
        : [...document.entities, nextEntity];

    return {
        document: {
            ...document,
            updatedAt: now,
            entities: nextEntities
        },
        entity: nextEntity
    };
};

export const spawnSceneEntityFromAsset = (
    document: ZenWorkspaceDocument,
    asset: ZenAssetDocument,
    layerId: string
): ZenWorkspaceDocument => {
    const nextDocument = ensureWorkspaceScaffold(document);
    const existing = nextDocument.entities.find((entity) => entity.assetId === asset.id);
    if (existing) {
        return upsertEntity(nextDocument, {
            id: existing.id,
            name: existing.name,
            moduleId: existing.moduleId,
            layerId,
            assetId: asset.id,
            components: existing.components,
            tags: existing.tags
        }).document;
    }

    return upsertEntity(nextDocument, {
        name: asset.name,
        moduleId: asset.moduleId,
        layerId,
        assetId: asset.id,
        tags: ['scene-node', asset.kind],
        components: {
            [ZEN_COMPONENT_KEYS.transform]: {
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            [ZEN_COMPONENT_KEYS.assetRef]: {
                assetId: asset.id
            }
        }
    }).document;
};

export const setActiveModule = (
    document: ZenWorkspaceDocument,
    moduleId: ZenModuleId
): ZenWorkspaceDocument => {
    const scopedDocument = ensureWorkspaceScaffold(document);
    const currentViewportModuleId = resolveViewportHostModuleId(scopedDocument.activeViewportModuleId);
    const nextViewportModuleId = resolveViewportOwnerOnModuleSwitch(currentViewportModuleId, moduleId);
    const currentViewport = scopedDocument.viewports[currentViewportModuleId];
    const nextViewport = scopedDocument.viewports[nextViewportModuleId] ?? createDefaultViewportState(nextViewportModuleId);
    const carriedViewport = currentViewport && modulesShareViewportGroup(currentViewportModuleId, nextViewportModuleId)
        ? {
            ...nextViewport,
            projection: currentViewport.projection,
            camera: {
                ...nextViewport.camera,
                ...currentViewport.camera
            },
            domSize: {
                ...nextViewport.domSize,
                ...currentViewport.domSize
            },
            navigationMode: currentViewport.navigationMode,
            background: currentViewport.background,
            moduleId: nextViewportModuleId,
            lastUpdated: Date.now()
        }
        : nextViewport;

    return {
        ...scopedDocument,
        updatedAt: Date.now(),
        activeModuleId: moduleId,
        activeViewportModuleId: nextViewportModuleId,
        viewports: {
            ...scopedDocument.viewports,
            [nextViewportModuleId]: carriedViewport
        }
    };
};

export const setActiveViewportModule = (
    document: ZenWorkspaceDocument,
    moduleId: ZenModuleId
): ZenWorkspaceDocument => {
    const scopedDocument = ensureWorkspaceScaffold(document);
    const viewportModuleId = resolveViewportHostModuleId(moduleId);

    return {
        ...scopedDocument,
        updatedAt: Date.now(),
        activeViewportModuleId: viewportModuleId,
        viewports: {
            ...scopedDocument.viewports,
            [viewportModuleId]: scopedDocument.viewports[viewportModuleId] ?? createDefaultViewportState(viewportModuleId)
        }
    };
};

export const setActiveSceneSelection = (
    document: ZenWorkspaceDocument,
    selection: Partial<Pick<ZenWorkspaceDocument, 'activeAssetId' | 'activeEntityId' | 'activeLayerId'>>
): ZenWorkspaceDocument => {
    const scopedDocument = ensureWorkspaceScaffold(document);
    return {
        ...scopedDocument,
        updatedAt: Date.now(),
        activeAssetId: Object.prototype.hasOwnProperty.call(selection, 'activeAssetId')
            ? selection.activeAssetId ?? null
            : scopedDocument.activeAssetId,
        activeEntityId: Object.prototype.hasOwnProperty.call(selection, 'activeEntityId')
            ? selection.activeEntityId ?? null
            : scopedDocument.activeEntityId,
        activeLayerId: Object.prototype.hasOwnProperty.call(selection, 'activeLayerId')
            ? selection.activeLayerId ?? null
            : scopedDocument.activeLayerId
    };
};

export const setActiveMaterial = (
    document: ZenWorkspaceDocument,
    materialId: string | null
): ZenWorkspaceDocument => ({
    ...ensureWorkspaceScaffold(document),
    updatedAt: Date.now(),
    activeMaterialId: materialId
});

export const setViewportState = (
    document: ZenWorkspaceDocument,
    moduleId: ZenModuleId,
    viewport: Partial<ZenViewportState>
): ZenWorkspaceDocument => {
    const current = document.viewports[moduleId] ?? createDefaultViewportState(moduleId);
    return {
        ...ensureWorkspaceScaffold(document),
        updatedAt: Date.now(),
        viewports: {
            ...document.viewports,
            [moduleId]: {
                ...current,
                ...viewport,
                camera: {
                    ...current.camera,
                    ...viewport.camera
                },
                domSize: {
                    ...current.domSize,
                    ...viewport.domSize
                },
                lastUpdated: Date.now()
            }
        }
    };
};

export const setModuleState = (
    document: ZenWorkspaceDocument,
    moduleId: ZenModuleId,
    moduleState: Record<string, unknown>
): ZenWorkspaceDocument => ({
    ...ensureWorkspaceScaffold(document),
    updatedAt: Date.now(),
    moduleState: {
        ...document.moduleState,
        [moduleId]: {
            ...(document.moduleState[moduleId] ?? {}),
            ...moduleState
        }
    }
});

export const moveEntityToLayer = (
    document: ZenWorkspaceDocument,
    entityId: string,
    layerId: string
): ZenWorkspaceDocument => {
    const entity = document.entities.find((entry) => entry.id === entityId);
    if (!entity) {
        return document;
    }

    return upsertEntity(document, {
        ...entity,
        layerId
    }).document;
};

export const patchEntityComponents = (
    document: ZenWorkspaceDocument,
    entityId: string,
    components: Record<string, unknown>
): ZenWorkspaceDocument => {
    const entity = document.entities.find((entry) => entry.id === entityId);
    if (!entity) {
        return document;
    }

    return upsertEntity(document, {
        ...entity,
        components: {
            ...entity.components,
            ...components
        }
    }).document;
};

export const bindMaterialToEntity = (
    document: ZenWorkspaceDocument,
    entityId: string,
    materialId: string | null
): ZenWorkspaceDocument => {
    const scopedDocument = patchEntityComponents(document, entityId, {
        [ZEN_COMPONENT_KEYS.materialBinding]: {
            materialId
        }
    });

    return scopedDocument.activeEntityId === entityId
        ? setActiveMaterial(scopedDocument, materialId)
        : scopedDocument;
};

export const removeEntity = (
    document: ZenWorkspaceDocument,
    entityId: string
): ZenWorkspaceDocument => {
    const scopedDocument = ensureWorkspaceScaffold(document);
    const entity = scopedDocument.entities.find((entry) => entry.id === entityId);
    if (!entity) {
        return scopedDocument;
    }

    const now = Date.now();

    return {
        ...scopedDocument,
        updatedAt: now,
        activeEntityId: scopedDocument.activeEntityId === entityId ? null : scopedDocument.activeEntityId,
        activeMaterialId: scopedDocument.activeEntityId === entityId
            ? null
            : scopedDocument.activeMaterialId,
        entities: scopedDocument.entities
            .filter((entry) => entry.id !== entityId)
            .map((entry) => {
                if (entry.parentId === entityId) {
                    return {
                        ...entry,
                        parentId: null,
                        updatedAt: now
                    };
                }

                if (entry.children.includes(entityId)) {
                    return {
                        ...entry,
                        children: entry.children.filter((childId) => childId !== entityId),
                        updatedAt: now
                    };
                }

                return entry;
            })
    };
};

export const removeWorkspaceItem = (
    document: ZenWorkspaceDocument,
    kind: 'asset' | 'material' | 'alpha',
    id: string
): ZenWorkspaceDocument => {
    const now = Date.now();

    if (kind === 'asset') {
        const removedAssetEntities = document.entities.filter((entity) => entity.assetId === id);
        const removedEntityIds = removedAssetEntities.map((entity) => entity.id);
        const removedLayerIds = removedAssetEntities.map((entity) => entity.layerId);
        const removedMaterialIds = removedAssetEntities
            .map((entity) => getEntityMaterialId(entity))
            .filter((materialId): materialId is string => Boolean(materialId));
        return {
            ...document,
            updatedAt: now,
            activeAssetId: document.activeAssetId === id ? null : document.activeAssetId,
            activeEntityId: removedEntityIds.includes(document.activeEntityId ?? '') ? null : document.activeEntityId,
            activeLayerId: removedLayerIds.includes(document.activeLayerId ?? '') ? null : document.activeLayerId,
            activeMaterialId: removedMaterialIds.includes(document.activeMaterialId ?? '')
                ? null
                : document.activeMaterialId,
            assets: document.assets.filter((asset) => asset.id !== id),
            entities: document.entities.filter((entity) => entity.assetId !== id)
        };
    }

    if (kind === 'material') {
        return {
            ...document,
            updatedAt: now,
            materials: document.materials.filter((material) => material.id !== id),
            activeMaterialId: document.activeMaterialId === id ? null : document.activeMaterialId,
            entities: document.entities.map((entity) => {
                if (getEntityMaterialId(entity) !== id) {
                    return entity;
                }

                return {
                    ...entity,
                    updatedAt: now,
                    components: {
                        ...entity.components,
                        [ZEN_COMPONENT_KEYS.materialBinding]: {
                            materialId: null
                        }
                    }
                };
            })
        };
    }

    return {
        ...document,
        updatedAt: now,
        alphas: document.alphas.filter((alpha) => alpha.id !== id)
    };
};
