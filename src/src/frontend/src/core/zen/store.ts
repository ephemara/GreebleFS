import { create } from 'zustand';
import { KernelAlpha, KernelArtifact, KernelMaterial } from '../types/kernel';
import { getZenAppDefinition, resolveZenModuleId } from './moduleRegistry';
import {
    clearZenControlInteractionState,
    createZenControlInteractionState,
    reduceZenControlInteractionState,
    ZenControlActionId,
    ZenControlHandlerResolver,
    ZenControlInteractionState,
    ZenControlPhase,
    ZenSharedGizmoMode,
    ZenSharedTransformSpace
} from './controlRegistry';
import {
    bindMaterialToEntity,
    createZenWorkspaceDocument,
    ensureLayer,
    ensureWorkspaceScaffold,
    getEntityMaterialId,
    moveEntityToLayer,
    patchEntityComponents,
    removeEntity,
    removeWorkspaceItem,
    setActiveMaterial,
    setActiveModule,
    setActiveSceneSelection,
    setActiveViewportModule,
    setModuleState,
    setViewportState,
    spawnSceneEntityFromAsset,
    syncModuleLayers,
    upsertAlpha,
    upsertAsset,
    upsertEntity,
    upsertMaterial,
    ZEN_SHARED_PLACEMENTS_LAYER_ID
} from './document';
import {
    advanceZenSequencer,
    createZenSequencerState,
    patchZenSequencerTransport,
    setZenSequencerActiveSource,
    syncZenSequencerSource
} from './sequencer';
import {
    ZenAlphaDocument,
    ZenAssetDocument,
    ZenLayerInput,
    ZenMaterialDocument,
    ZenModuleId,
    ZenEntityInput,
    ZenSequencerSourceInput,
    ZenSequencerState,
    ZenSequencerTransportPatch,
    ZenViewportRuntimeSession,
    ZenWorkspaceDocument
} from './types';

type RuntimeViewportMap = Partial<Record<ZenModuleId, ZenViewportRuntimeSession>>;
type ZenControlHandlerMap = Partial<Record<ZenModuleId, Record<string, ZenControlHandlerResolver>>>;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const areZenStateValuesEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) {
        return true;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length
            && left.every((value, index) => areZenStateValuesEqual(value, right[index]));
    }

    if (isPlainRecord(left) && isPlainRecord(right)) {
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        return leftKeys.length === rightKeys.length
            && leftKeys.every((key) => areZenStateValuesEqual(left[key], right[key]));
    }

    return false;
};

interface ZenWorkspaceStore {
    document: ZenWorkspaceDocument;
    runtimeViewports: RuntimeViewportMap;
    interaction: ZenControlInteractionState;
    controlHandlers: ZenControlHandlerMap;
    sequencer: ZenSequencerState;
    resetWorkspace: (activeModuleId?: ZenModuleId) => void;
    hydrateWorkspace: (document: ZenWorkspaceDocument) => void;
    activateModule: (moduleId: ZenModuleId) => void;
    setActiveViewportModuleId: (moduleId: ZenModuleId) => void;
    setActiveSelection: (selection: Partial<Pick<ZenWorkspaceDocument, 'activeAssetId' | 'activeEntityId' | 'activeLayerId'>>) => void;
    setActiveMaterialId: (materialId: string | null) => void;
    ensureModuleLayer: (moduleId: ZenModuleId) => string;
    syncModuleLayers: (moduleId: ZenModuleId, layers: ZenLayerInput[]) => void;
    registerViewportSession: (moduleId: ZenModuleId, session: ZenViewportRuntimeSession) => void;
    unregisterViewportSession: (moduleId: ZenModuleId) => void;
    refreshViewportState: (moduleId: ZenModuleId) => void;
    registerControlHandlers: (moduleId: ZenModuleId, scopeId: string, resolver: ZenControlHandlerResolver) => void;
    unregisterControlHandlers: (moduleId: ZenModuleId, scopeId: string) => void;
    dispatchControlAction: (
        actionId: ZenControlActionId,
        phase: ZenControlPhase,
        keyboardEvent: KeyboardEvent,
        sourceModuleId?: ZenModuleId
    ) => boolean;
    clearControlInteraction: () => void;
    setSharedGizmoMode: (mode: ZenSharedGizmoMode) => void;
    setSharedTransformSpace: (space: ZenSharedTransformSpace) => void;
    toggleSharedTransformSpace: () => void;
    setSharedSnapEnabled: (enabled: boolean) => void;
    toggleSharedSnapEnabled: () => void;
    setModuleState: (moduleId: ZenModuleId, state: Record<string, unknown>) => void;
    syncSequencerSource: (moduleId: ZenModuleId, input: ZenSequencerSourceInput) => void;
    setActiveSequencerSource: (moduleId: ZenModuleId | null) => void;
    patchSequencerTransport: (patch: ZenSequencerTransportPatch) => void;
    advanceSequencer: (deltaSeconds: number) => void;
    upsertSceneEntity: (input: ZenEntityInput) => void;
    moveSceneEntityToLayer: (entityId: string, layerId: string) => void;
    patchSceneEntityComponents: (entityId: string, components: Record<string, unknown>) => void;
    bindSceneEntityMaterial: (entityId: string, materialId: string | null) => void;
    bindActiveSceneEntityMaterial: (materialId: string | null) => void;
    removeSceneEntity: (entityId: string) => void;
    upsertKernelArtifact: (artifact: KernelArtifact) => void;
    removeKernelArtifact: (artifactId: string) => void;
    upsertKernelMaterial: (material: KernelMaterial) => void;
    removeKernelMaterial: (materialId: string) => void;
    upsertKernelAlpha: (alpha: KernelAlpha) => void;
    removeKernelAlpha: (alphaId: string) => void;
}

const readViewportSnapshot = (moduleId: ZenModuleId, runtime?: ZenViewportRuntimeSession) => {
    if (!runtime?.camera) {
        return null;
    }

    const camera = runtime.camera as any;
    const controls = runtime.controls as any;
    const element = runtime.element;

    return {
        moduleId,
        projection: camera.isOrthographicCamera ? 'orthographic' : 'perspective',
        camera: {
            position: [camera.position?.x ?? 0, camera.position?.y ?? 0, camera.position?.z ?? 0] as [number, number, number],
            target: [
                controls?.target?.x ?? 0,
                controls?.target?.y ?? 0,
                controls?.target?.z ?? 0
            ] as [number, number, number],
            up: [camera.up?.x ?? 0, camera.up?.y ?? 1, camera.up?.z ?? 0] as [number, number, number],
            near: camera.near ?? 0.1,
            far: camera.far ?? 5000,
            fov: camera.fov ?? undefined,
            zoom: camera.zoom ?? undefined
        },
        domSize: {
            width: element?.clientWidth ?? 0,
            height: element?.clientHeight ?? 0
        },
        navigationMode: controls ? 'orbit' : 'static'
    } as const;
};

const toZenAsset = (artifact: KernelArtifact): ZenAssetDocument => {
    const moduleId = resolveZenModuleId(artifact.source);
    const extension = artifact.blob.type === 'model/gltf-binary'
        ? 'glb'
        : artifact.name.split('.').pop()?.toLowerCase() ?? 'bin';

    return {
        id: artifact.id,
        name: artifact.name,
        moduleId,
        kind: 'scene',
        mimeType: artifact.blob.type,
        size: artifact.size,
        storagePath: `artifacts/${artifact.id}`,
        extension,
        createdAt: artifact.timestamp,
        updatedAt: artifact.timestamp,
        metadata: {
            source: artifact.source,
            welded: artifact.isWelded ?? false
        }
    };
};

const toZenMaterial = (material: KernelMaterial): ZenMaterialDocument => ({
    id: material.id,
    name: material.name,
    preview: material.preview,
    channels: {
        base: material.base,
        normal: material.normal,
        roughness: material.roughness,
        metallic: material.metallic,
        ao: material.ao,
        height: material.height,
        emissive: material.emissive
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
});

const toZenAlpha = (alpha: KernelAlpha): ZenAlphaDocument => ({
    id: alpha.id,
    name: alpha.name,
    preview: alpha.preview,
    createdAt: Date.now(),
    updatedAt: Date.now()
});

export const useZenWorkspaceStore = create<ZenWorkspaceStore>((set, get) => ({
    document: createZenWorkspaceDocument('sculpt'),
    runtimeViewports: {},
    interaction: createZenControlInteractionState(),
    controlHandlers: {},
    sequencer: createZenSequencerState(),
    resetWorkspace: (activeModuleId = 'sculpt') => {
        set({
            document: createZenWorkspaceDocument(activeModuleId),
            runtimeViewports: {},
            interaction: createZenControlInteractionState(),
            sequencer: createZenSequencerState()
        });
    },
    hydrateWorkspace: (document) => {
        set({
            document: ensureWorkspaceScaffold(document),
            sequencer: createZenSequencerState()
        });
    },
    activateModule: (moduleId) => {
        set((state) => ({
            document: setActiveModule(state.document, moduleId)
        }));
    },
    setActiveViewportModuleId: (moduleId) => {
        set((state) => ({
            document: setActiveViewportModule(state.document, moduleId)
        }));
    },
    setActiveSelection: (selection) => {
        set((state) => {
            let nextSelection = selection;

            if (
                Object.prototype.hasOwnProperty.call(selection, 'activeAssetId') &&
                selection.activeAssetId === null &&
                !Object.prototype.hasOwnProperty.call(selection, 'activeEntityId')
            ) {
                nextSelection = {
                    ...selection,
                    activeEntityId: null
                };
            }

            if (selection.activeAssetId && !selection.activeEntityId) {
                const linkedEntity = state.document.entities.find((entity) => entity.assetId === selection.activeAssetId);
                if (linkedEntity) {
                    nextSelection = {
                        ...selection,
                        activeEntityId: linkedEntity.id,
                        activeLayerId: selection.activeLayerId ?? linkedEntity.layerId
                    };
                }
            }

            const nextDocument = setActiveSceneSelection(state.document, nextSelection);
            const selectionTouchesSubject = Object.prototype.hasOwnProperty.call(selection, 'activeAssetId')
                || Object.prototype.hasOwnProperty.call(selection, 'activeEntityId');
            const selectedEntity = nextDocument.entities.find((entity) => entity.id === nextDocument.activeEntityId);
            const resolvedDocument = selectionTouchesSubject
                ? setActiveMaterial(nextDocument, getEntityMaterialId(selectedEntity))
                : nextDocument;

            if (
                resolvedDocument.activeAssetId === state.document.activeAssetId
                && resolvedDocument.activeEntityId === state.document.activeEntityId
                && resolvedDocument.activeLayerId === state.document.activeLayerId
                && resolvedDocument.activeMaterialId === state.document.activeMaterialId
            ) {
                return state;
            }

            return {
                document: resolvedDocument
            };
        });
    },
    setActiveMaterialId: (materialId) => {
        set((state) => ({
            document: setActiveMaterial(state.document, materialId)
        }));
    },
    ensureModuleLayer: (moduleId) => {
        const module = getZenAppDefinition(moduleId);
        const rootLayerId = `${moduleId}:root`;

        if (!module) {
            return rootLayerId;
        }

        set((state) => ({
            document: ensureLayer(state.document, moduleId, {
                id: rootLayerId,
                name: module.rootLayerName,
                order: -1,
                parentLayerId: ZEN_SHARED_PLACEMENTS_LAYER_ID,
                tags: ['module-root']
            }).document
        }));

        return rootLayerId;
    },
    syncModuleLayers: (moduleId, layers) => {
        set((state) => ({
            document: syncModuleLayers(state.document, moduleId, layers)
        }));
    },
    registerViewportSession: (moduleId, session) => {
        set((state) => ({
            runtimeViewports: {
                ...state.runtimeViewports,
                [moduleId]: session
            }
        }));
        get().refreshViewportState(moduleId);
    },
    unregisterViewportSession: (moduleId) => {
        set((state) => {
            const nextRuntime = { ...state.runtimeViewports };
            delete nextRuntime[moduleId];
            return {
                runtimeViewports: nextRuntime
            };
        });
    },
    refreshViewportState: (moduleId) => {
        const runtime = get().runtimeViewports[moduleId];
        const snapshot = readViewportSnapshot(moduleId, runtime);
        if (!snapshot) {
            return;
        }

        set((state) => ({
            document: setViewportState(state.document, moduleId, snapshot)
        }));
    },
    registerControlHandlers: (moduleId, scopeId, resolver) => {
        set((state) => ({
            controlHandlers: {
                ...state.controlHandlers,
                [moduleId]: {
                    ...(state.controlHandlers[moduleId] ?? {}),
                    [scopeId]: resolver
                }
            }
        }));
    },
    unregisterControlHandlers: (moduleId, scopeId) => {
        set((state) => {
            const moduleHandlers = { ...(state.controlHandlers[moduleId] ?? {}) };
            delete moduleHandlers[scopeId];

            const nextControlHandlers = { ...state.controlHandlers };
            if (Object.keys(moduleHandlers).length === 0) {
                delete nextControlHandlers[moduleId];
            } else {
                nextControlHandlers[moduleId] = moduleHandlers;
            }

            return {
                controlHandlers: nextControlHandlers
            };
        });
    },
    dispatchControlAction: (actionId, phase, keyboardEvent, sourceModuleId) => {
        const state = get();
        const resolvedSourceModuleId = sourceModuleId ?? state.document.activeModuleId;
        const candidateModules = Array.from(new Set([
            resolvedSourceModuleId,
            state.document.activeModuleId,
            state.document.activeViewportModuleId
        ]));

        set((currentState) => ({
            interaction: reduceZenControlInteractionState(
                currentState.interaction,
                actionId,
                phase,
                resolvedSourceModuleId
            )
        }));

        for (const targetModuleId of candidateModules) {
            const moduleHandlers = state.controlHandlers[targetModuleId];
            if (!moduleHandlers) {
                continue;
            }

            for (const resolver of Object.values(moduleHandlers)) {
                const result = resolver({
                    actionId,
                    phase,
                    keyboardEvent,
                    sourceModuleId: resolvedSourceModuleId,
                    targetModuleId,
                    document: get().document,
                    interaction: get().interaction
                });

                if (result !== false) {
                    return true;
                }
            }
        }

        return false;
    },
    clearControlInteraction: () => {
        set((state) => ({
            interaction: clearZenControlInteractionState(state.interaction)
        }));
    },
    setSharedGizmoMode: (mode) => {
        set((state) => ({
            interaction: {
                ...state.interaction,
                gizmoMode: mode,
                lastActionId: state.interaction.lastActionId,
                lastActionModuleId: state.interaction.lastActionModuleId,
                updatedAt: Date.now()
            }
        }));
    },
    setSharedTransformSpace: (space) => {
        set((state) => ({
            interaction: {
                ...state.interaction,
                transformSpace: space,
                updatedAt: Date.now()
            }
        }));
    },
    toggleSharedTransformSpace: () => {
        set((state) => ({
            interaction: {
                ...state.interaction,
                transformSpace: state.interaction.transformSpace === 'world' ? 'local' : 'world',
                updatedAt: Date.now()
            }
        }));
    },
    setSharedSnapEnabled: (enabled) => {
        set((state) => ({
            interaction: {
                ...state.interaction,
                snapEnabled: enabled,
                updatedAt: Date.now()
            }
        }));
    },
    toggleSharedSnapEnabled: () => {
        set((state) => ({
            interaction: {
                ...state.interaction,
                snapEnabled: !state.interaction.snapEnabled,
                updatedAt: Date.now()
            }
        }));
    },
    setModuleState: (moduleId, statePatch) => {
        set((state) => {
            const currentState = state.document.moduleState[moduleId] ?? {};
            const nextState = {
                ...currentState,
                ...statePatch
            };

            if (areZenStateValuesEqual(currentState, nextState)) {
                return state;
            }

            return {
                document: setModuleState(state.document, moduleId, statePatch)
            };
        });
    },
    syncSequencerSource: (moduleId, input) => {
        set((state) => ({
            sequencer: syncZenSequencerSource(state.sequencer, moduleId, input)
        }));
    },
    setActiveSequencerSource: (moduleId) => {
        set((state) => ({
            sequencer: setZenSequencerActiveSource(state.sequencer, moduleId)
        }));
    },
    patchSequencerTransport: (patch) => {
        set((state) => ({
            sequencer: patchZenSequencerTransport(state.sequencer, patch)
        }));
    },
    advanceSequencer: (deltaSeconds) => {
        set((state) => ({
            sequencer: advanceZenSequencer(state.sequencer, deltaSeconds)
        }));
    },
    upsertSceneEntity: (input) => {
        set((state) => {
            const rootLayerId = input.layerId || get().ensureModuleLayer(input.moduleId);
            return {
                document: upsertEntity(state.document, {
                    ...input,
                    layerId: rootLayerId
                }).document
            };
        });
    },
    moveSceneEntityToLayer: (entityId, layerId) => {
        set((state) => ({
            document: moveEntityToLayer(state.document, entityId, layerId)
        }));
    },
    patchSceneEntityComponents: (entityId, components) => {
        set((state) => ({
            document: patchEntityComponents(state.document, entityId, components)
        }));
    },
    bindSceneEntityMaterial: (entityId, materialId) => {
        set((state) => ({
            document: bindMaterialToEntity(state.document, entityId, materialId)
        }));
    },
    bindActiveSceneEntityMaterial: (materialId) => {
        const activeEntityId = get().document.activeEntityId;
        if (!activeEntityId) {
            get().setActiveMaterialId(materialId);
            return;
        }

        get().bindSceneEntityMaterial(activeEntityId, materialId);
    },
    removeSceneEntity: (entityId) => {
        set((state) => ({
            document: removeEntity(state.document, entityId)
        }));
    },
    upsertKernelArtifact: (artifact) => {
        const asset = toZenAsset(artifact);
        const rootLayerId = get().ensureModuleLayer(asset.moduleId);

        set((state) => {
            const documentWithAsset = upsertAsset(state.document, asset);
            const documentWithEntity = spawnSceneEntityFromAsset(documentWithAsset, asset, rootLayerId);
            const activeEntity = documentWithEntity.entities.find((entity) => entity.assetId === asset.id);

            return {
                document: setActiveSceneSelection(documentWithEntity, {
                    activeAssetId: asset.id,
                    activeEntityId: activeEntity?.id ?? null,
                    activeLayerId: activeEntity?.layerId ?? rootLayerId
                })
            };
        });
    },
    removeKernelArtifact: (artifactId) => {
        set((state) => ({
            document: removeWorkspaceItem(state.document, 'asset', artifactId)
        }));
    },
    upsertKernelMaterial: (material) => {
        const documentMaterial = toZenMaterial(material);
        set((state) => ({
            document: upsertMaterial(state.document, documentMaterial)
        }));
    },
    removeKernelMaterial: (materialId) => {
        set((state) => ({
            document: removeWorkspaceItem(state.document, 'material', materialId)
        }));
    },
    upsertKernelAlpha: (alpha) => {
        const documentAlpha = toZenAlpha(alpha);
        set((state) => ({
            document: upsertAlpha(state.document, documentAlpha)
        }));
    },
    removeKernelAlpha: (alphaId) => {
        set((state) => ({
            document: removeWorkspaceItem(state.document, 'alpha', alphaId)
        }));
    }
}));
