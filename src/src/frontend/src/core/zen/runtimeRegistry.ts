import { ZenModuleId } from './types';

export interface ZenRuntimeBinding {
    moduleId: ZenModuleId;
    subjectMode: 'shared-scene-entity' | 'material-target' | 'simulation-target';
    interactionMode: 'direct-manipulation' | 'procedural-operator' | 'surface-operator' | 'simulation-operator';
    primaryCrates: string[];
    tauriCommands: string[];
    supportsSharedViewport: boolean;
    supportsSharedLayers: boolean;
    supportsSharedMaterials: boolean;
    notes: string[];
}

export const ZEN_SHARED_RUNTIME_STACK = {
    scene: ['zen-scene', 'k-os-scene', 'k-os-scene-runtime'],
    runtime: ['zen-runtime', 'zen-core'],
    materials: ['k-os-material'],
    assets: ['k-os-asset-pipeline', 'zen-assets'],
    viewport: ['k-os-gpu-pipeline', 'zen-render']
} as const;

export const ZEN_MODULE_RUNTIME_BINDINGS: Record<ZenModuleId, ZenRuntimeBinding> = {
    sculpt: {
        moduleId: 'sculpt',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'direct-manipulation',
        primaryCrates: ['k-os-sculpt', 'k-os-scene-runtime', 'zen-runtime'],
        tauriCommands: [
            'init_sculpt_mesh',
            'apply_brush',
            'update_sculpt_positions',
            'get_sculpt_positions',
            'dispose_sculpt_mesh'
        ],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Owns the canonical viewport host today.',
            'Should mutate the active shared mesh subject instead of private layer meshes.'
        ]
    },
    greeble: {
        moduleId: 'greeble',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'procedural-operator',
        primaryCrates: ['k-os-scene-runtime', 'k-os-mesh-processing', 'zen-runtime'],
        tauriCommands: ['optimize_mesh', 'simplify_mesh', 'generate_lod_chain'],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Should consume the active scene entity as its operator subject.',
            'IMM-style placement should author new ECS entities under shared placement layers.'
        ]
    },
    scatter: {
        moduleId: 'scatter',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'procedural-operator',
        primaryCrates: ['k-os-scatter', 'k-os-scene-runtime', 'zen-runtime'],
        tauriCommands: [
            'poisson_disk_scatter',
            'poisson_disk_surface',
            'physics_drop_scatter',
            'cluster_scatter',
            'organic_scatter'
        ],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Scatter outputs should be authored as child entities or instance groups in shared scene space.'
        ]
    },
    atlas: {
        moduleId: 'atlas',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'surface-operator',
        primaryCrates: ['k-os-asset-pipeline', 'k-os-gpu-pipeline', 'zen-runtime'],
        tauriCommands: ['unwrap_mesh_xatlas', 'classify_mesh', 'unwrap_and_optimize'],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'UV and material edits should attach to the selected shared mesh subject, not an Atlas-local clone.'
        ]
    },
    painter: {
        moduleId: 'painter',
        subjectMode: 'material-target',
        interactionMode: 'surface-operator',
        primaryCrates: ['k-os-material', 'k-os-baking', 'zen-runtime'],
        tauriCommands: ['generate_pbr_maps', 'generate_normal_map'],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Painter should operate on the active entity material binding and texture set, not a startup mount menu.'
        ]
    },
    cloner: {
        moduleId: 'cloner',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'procedural-operator',
        primaryCrates: ['k-os-scene-runtime', 'k-os-animation', 'zen-runtime'],
        tauriCommands: ['optimize_mesh', 'generate_lod_chain'],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Cloner should emit clone entities or instance components bound to the active subject.'
        ]
    },
    rig: {
        moduleId: 'rig',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'direct-manipulation',
        primaryCrates: ['k-os-rig', 'k-os-animation', 'k-os-scene-runtime'],
        tauriCommands: [
            'create_biped_skeleton',
            'fit_skeleton_to_mesh',
            'compute_skin_weights_geodesic',
            'solve_ik_fabrik',
            'update_skeleton_matrices'
        ],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: false,
        notes: [
            'Rig should bind to the selected scene entity and emit rig/skin components into the shared ECS.'
        ]
    },
    quantum: {
        moduleId: 'quantum',
        subjectMode: 'simulation-target',
        interactionMode: 'simulation-operator',
        primaryCrates: ['k-os-sim', 'zen-runtime', 'k-os-scene-runtime'],
        tauriCommands: [],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: false,
        notes: [
            'Simulation caches should still anchor to shared scene entities and layers even when authored procedurally.'
        ]
    },
    graphos: {
        moduleId: 'graphos',
        subjectMode: 'material-target',
        interactionMode: 'surface-operator',
        primaryCrates: ['k-os-material'],
        tauriCommands: [],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Graph authoring should render as an overlay canvas over the shared viewport host.',
            'Should feed the same material binding model as painter and autopbr.'
        ]
    },
    autopbr: {
        moduleId: 'autopbr',
        subjectMode: 'material-target',
        interactionMode: 'surface-operator',
        primaryCrates: ['k-os-material', 'k-os-baking'],
        tauriCommands: ['generate_pbr_maps', 'generate_normal_map'],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Acts on material bindings rather than scene-local material copies.',
            'Should sample and assign materials against the active shared layer/entity target.'
        ]
    },
    inspect: {
        moduleId: 'inspect',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'direct-manipulation',
        primaryCrates: ['zen-runtime'],
        tauriCommands: [],
        supportsSharedViewport: false,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: ['Inspector should read the same subject/material binding state as every other tool.']
    },
    tecton: {
        moduleId: 'tecton',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'procedural-operator',
        primaryCrates: ['k-os-sim', 'k-os-scene-runtime', 'zen-runtime'],
        tauriCommands: [],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: [
            'Landscape authoring should materialize directly inside the shared scene viewport.',
            'Terrain generation parameters should live in module state so the viewport host can rebuild the active landscape deterministically.'
        ]
    },
    genius: {
        moduleId: 'genius',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'procedural-operator',
        primaryCrates: ['kain-driver', 'kain-ui', 'kain-ui-native', 'kain-3D'],
        tauriCommands: ['get_kain_integration_status', 'run_kain_doctor_diagnostic'],
        supportsSharedViewport: false,
        supportsSharedLayers: false,
        supportsSharedMaterials: false,
        notes: [
            'Acts as the Kain-facing development cockpit for this repo, not as another scene authority.',
            'Should stay data-driven and point future agents toward concrete migration slices and diagnostics.'
        ]
    },
    chronos: {
        moduleId: 'chronos',
        subjectMode: 'simulation-target',
        interactionMode: 'simulation-operator',
        primaryCrates: ['k-os-animation', 'zen-runtime'],
        tauriCommands: [],
        supportsSharedViewport: true,
        supportsSharedLayers: true,
        supportsSharedMaterials: false,
        notes: [
            'Chronos and Quantum now share a canonical simulation document and should author the same shared viewport subject.',
            'Timeline state should orchestrate shared scene subjects, not per-app scenes.'
        ]
    },
    bevy: {
        moduleId: 'bevy',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'direct-manipulation',
        primaryCrates: ['k-os-bevy', 'k-os-scene-runtime'],
        tauriCommands: [
            'sync_bevy_window',
            'set_bevy_visible',
            'leash_cursor',
            'leash_cam_rotate',
            'leash_cam_zoom'
        ],
        supportsSharedViewport: false,
        supportsSharedLayers: true,
        supportsSharedMaterials: true,
        notes: ['Bevy remains a backend host path, not a separate scene authority.']
    },
    unknown: {
        moduleId: 'unknown',
        subjectMode: 'shared-scene-entity',
        interactionMode: 'direct-manipulation',
        primaryCrates: [],
        tauriCommands: [],
        supportsSharedViewport: false,
        supportsSharedLayers: false,
        supportsSharedMaterials: false,
        notes: []
    }
};

export const getZenRuntimeBinding = (moduleId: ZenModuleId): ZenRuntimeBinding | undefined =>
    ZEN_MODULE_RUNTIME_BINDINGS[moduleId];
