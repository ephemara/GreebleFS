import { describe, expect, it } from 'vitest';
import {
    bindMaterialToEntity,
    createZenWorkspaceDocument,
    moveEntityToLayer,
    patchEntityComponents,
    removeEntity,
    setActiveMaterial,
    setActiveModule,
    setActiveSceneSelection,
    setViewportState,
    spawnSceneEntityFromAsset,
    syncModuleLayers,
    upsertAsset
} from './document';
import { UNIVERSAL_VIEWPORT_BACKGROUND_HEX } from './viewportTheme';

describe('zen document helpers', () => {
    it('creates a workspace with a default viewport for the active module', () => {
        const workspace = createZenWorkspaceDocument('sculpt');

        expect(workspace.schema).toBe('zen.workspace');
        expect(workspace.activeModuleId).toBe('sculpt');
        expect(workspace.activeAssetId).toBeNull();
        expect(workspace.activeEntityId).toBeNull();
        expect(workspace.activeLayerId).toBeNull();
        expect(workspace.activeMaterialId).toBeNull();
        expect(workspace.activeViewportModuleId).toBe('sculpt');
        expect(workspace.layers.find((layer) => layer.id === 'zen:scene-root')?.name).toBe('Scene Space');
        expect(workspace.layers.find((layer) => layer.id === 'zen:placements')?.parentLayerId).toBe('zen:scene-root');
        expect(workspace.viewports.sculpt).toBeDefined();
        expect(workspace.viewports.sculpt.camera.position).toEqual([6, 6, 6]);
        expect(workspace.viewports.sculpt.background).toBe(UNIVERSAL_VIEWPORT_BACKGROUND_HEX);
    });

    it('syncs module layers under a generated root layer', () => {
        const workspace = syncModuleLayers(createZenWorkspaceDocument('greeble'), 'greeble', [
            { id: 'base', name: 'Base', order: 0 },
            { id: 'detail', name: 'Detail', order: 1, visible: false }
        ]);

        expect(workspace.layers.find((layer) => layer.id === 'greeble:root')?.name).toBe('Greeble Layers');
        expect(workspace.layers.find((layer) => layer.id === 'greeble:root')?.parentLayerId).toBe('zen:placements');
        expect(workspace.layers.find((layer) => layer.id === 'base')?.parentLayerId).toBe('greeble:root');
        expect(workspace.layers.find((layer) => layer.id === 'detail')?.visible).toBe(false);
    });

    it('spawns a scene entity when an asset enters the workspace', () => {
        const baseWorkspace = createZenWorkspaceDocument('scatter');
        const workspaceWithAsset = upsertAsset(baseWorkspace, {
            id: 'ART_TEST',
            name: 'Scatter Rocks',
            moduleId: 'scatter',
            kind: 'scene',
            mimeType: 'model/gltf-binary',
            size: 128,
            storagePath: 'artifacts/ART_TEST',
            extension: 'glb',
            createdAt: 1,
            updatedAt: 1,
            metadata: {}
        });

        const workspace = spawnSceneEntityFromAsset(workspaceWithAsset, workspaceWithAsset.assets[0], 'scatter:root');

        expect(workspace.entities).toHaveLength(1);
        expect(workspace.entities[0].assetId).toBe('ART_TEST');
        expect(workspace.entities[0].components['zen:transform']).toBeDefined();
    });

    it('updates viewport snapshots immutably', () => {
        const workspace = setViewportState(createZenWorkspaceDocument('atlas'), 'atlas', {
            domSize: { width: 1920, height: 1080 },
            camera: {
                position: [1, 2, 3],
                target: [0, 0, 0],
                up: [0, 1, 0],
                near: 0.1,
                far: 2000,
                fov: 35,
                zoom: 1
            }
        });

        expect(workspace.viewports.atlas.domSize).toEqual({ width: 1920, height: 1080 });
        expect(workspace.viewports.atlas.camera.position).toEqual([1, 2, 3]);
        expect(workspace.activeViewportModuleId).toBe('sculpt');
    });

    it('keeps universal modules on the shared viewport host while preserving shared camera state', () => {
        const sculptViewport = {
            position: [12, 8, 4] as [number, number, number],
            target: [1, 2, 3] as [number, number, number],
            up: [0, 1, 0] as [number, number, number],
            near: 0.5,
            far: 2500,
            fov: 30,
            zoom: 1.25
        };
        const workspace = setActiveModule(
            setViewportState(createZenWorkspaceDocument('sculpt'), 'sculpt', {
                camera: sculptViewport,
                domSize: { width: 1440, height: 900 },
                background: '#101010',
                navigationMode: 'orbit'
            }),
            'atlas'
        );

        expect(workspace.activeModuleId).toBe('atlas');
        expect(workspace.activeViewportModuleId).toBe('sculpt');
        expect(workspace.viewports.sculpt).toBeDefined();
        expect(workspace.viewports.sculpt.camera).toEqual(sculptViewport);
        expect(workspace.viewports.sculpt.domSize).toEqual({ width: 1440, height: 900 });
        expect(workspace.viewports.sculpt.background).toBe('#101010');
        expect(workspace.viewports.sculpt.navigationMode).toBe('orbit');
    });

    it('routes autopbr through the sculpt viewport host', () => {
        const workspace = createZenWorkspaceDocument('autopbr');

        expect(workspace.activeModuleId).toBe('autopbr');
        expect(workspace.activeViewportModuleId).toBe('sculpt');
        expect(workspace.viewports.sculpt).toBeDefined();
    });

    it('routes graphos through the sculpt viewport host', () => {
        const workspace = createZenWorkspaceDocument('graphos');

        expect(workspace.activeModuleId).toBe('graphos');
        expect(workspace.activeViewportModuleId).toBe('sculpt');
        expect(workspace.viewports.sculpt).toBeDefined();
    });

    it('routes tecton through the sculpt viewport host', () => {
        const workspace = createZenWorkspaceDocument('tecton');

        expect(workspace.activeModuleId).toBe('tecton');
        expect(workspace.activeViewportModuleId).toBe('sculpt');
        expect(workspace.viewports.sculpt).toBeDefined();
    });

    it('supports ECS-style layer moves and component patching for scene entities', () => {
        const baseWorkspace = createZenWorkspaceDocument('scatter');
        const workspaceWithAsset = upsertAsset(baseWorkspace, {
            id: 'ART_MOVE',
            name: 'Moved Rock',
            moduleId: 'scatter',
            kind: 'scene',
            mimeType: 'model/gltf-binary',
            size: 64,
            storagePath: 'artifacts/ART_MOVE',
            extension: 'glb',
            createdAt: 1,
            updatedAt: 1,
            metadata: {}
        });
        const spawnedWorkspace = spawnSceneEntityFromAsset(workspaceWithAsset, workspaceWithAsset.assets[0], 'scatter:root');
        const entityId = spawnedWorkspace.entities[0].id;
        const movedWorkspace = moveEntityToLayer(spawnedWorkspace, entityId, 'zen:assets');
        const patchedWorkspace = patchEntityComponents(movedWorkspace, entityId, {
            physics: {
                body: 'dynamic',
                mass: 12
            }
        });

        expect(patchedWorkspace.entities[0].layerId).toBe('zen:assets');
        expect(patchedWorkspace.entities[0].components.physics).toEqual({
            body: 'dynamic',
            mass: 12
        });
    });

    it('binds materials through the shared entity selection path', () => {
        const baseWorkspace = createZenWorkspaceDocument('sculpt');
        const workspaceWithAsset = upsertAsset(baseWorkspace, {
            id: 'ART_MAT',
            name: 'Material Target',
            moduleId: 'sculpt',
            kind: 'scene',
            mimeType: 'model/gltf-binary',
            size: 64,
            storagePath: 'artifacts/ART_MAT',
            extension: 'glb',
            createdAt: 1,
            updatedAt: 1,
            metadata: {}
        });
        const spawnedWorkspace = spawnSceneEntityFromAsset(workspaceWithAsset, workspaceWithAsset.assets[0], 'sculpt:root');
        const entityId = spawnedWorkspace.entities[0].id;
        const selectedWorkspace = setActiveSceneSelection(spawnedWorkspace, {
            activeAssetId: 'ART_MAT',
            activeEntityId: entityId,
            activeLayerId: 'sculpt:root'
        });
        const materialWorkspace = setActiveMaterial(
            bindMaterialToEntity(selectedWorkspace, entityId, 'MAT_CLAY'),
            'MAT_CLAY'
        );

        expect(materialWorkspace.activeMaterialId).toBe('MAT_CLAY');
        expect(
            (materialWorkspace.entities[0].components['zen:material-binding'] as { materialId: string | null }).materialId
        ).toBe('MAT_CLAY');
    });

    it('allows scene selection to be cleared explicitly', () => {
        const selectedWorkspace = setActiveSceneSelection(createZenWorkspaceDocument('sculpt'), {
            activeAssetId: 'ART_TEST',
            activeEntityId: 'entity_test',
            activeLayerId: 'sculpt:root'
        });
        const clearedWorkspace = setActiveSceneSelection(selectedWorkspace, {
            activeAssetId: null,
            activeEntityId: null,
            activeLayerId: null
        });

        expect(clearedWorkspace.activeAssetId).toBeNull();
        expect(clearedWorkspace.activeEntityId).toBeNull();
        expect(clearedWorkspace.activeLayerId).toBeNull();
    });

    it('removes scene entities cleanly from the ECS document', () => {
        const baseWorkspace = createZenWorkspaceDocument('sculpt');
        const withAsset = upsertAsset(baseWorkspace, {
            id: 'ART_REMOVE',
            name: 'Delete Target',
            moduleId: 'sculpt',
            kind: 'scene',
            mimeType: 'model/gltf-binary',
            size: 32,
            storagePath: 'artifacts/ART_REMOVE',
            extension: 'glb',
            createdAt: 1,
            updatedAt: 1,
            metadata: {}
        });
        const spawnedWorkspace = spawnSceneEntityFromAsset(withAsset, withAsset.assets[0], 'sculpt:root');
        const entityId = spawnedWorkspace.entities[0].id;
        const selectedWorkspace = setActiveSceneSelection(spawnedWorkspace, {
            activeAssetId: 'ART_REMOVE',
            activeEntityId: entityId,
            activeLayerId: 'sculpt:root'
        });
        const removedWorkspace = removeEntity(selectedWorkspace, entityId);

        expect(removedWorkspace.entities).toHaveLength(0);
        expect(removedWorkspace.activeEntityId).toBeNull();
        expect(removedWorkspace.activeMaterialId).toBeNull();
    });
});
