import { ZEN_APP_REGISTRY } from '../core/zen/moduleRegistry';
import { ZEN_MODULE_RUNTIME_BINDINGS } from '../core/zen/runtimeRegistry';
import type { ZenModuleId } from '../core/zen/types';

export type KainAccelerationLane =
    | 'workspace-intelligence'
    | 'import-ts'
    | 'gpu-artifacts'
    | 'native-ui'
    | 'host-runtime-bridge';

export type BrowserDeliveryStatus =
    | 'browser-first'
    | 'hybrid-bridge'
    | 'desktop-bound';

export interface KainCommandRecipe {
    id: string;
    label: string;
    summary: string;
    commandPreview: string;
    generatedOutputs: string[];
}

export interface KainModuleAccelerationProfile {
    moduleId: ZenModuleId;
    moduleName: string;
    category: string;
    lane: KainAccelerationLane;
    browserDeliveryStatus: BrowserDeliveryStatus;
    tauriCommandCount: number;
    rationale: string;
    nextStep: string;
    generatedOutputs: string[];
    blockers: string[];
    recipeIds: string[];
}

export interface KainShippabilitySnapshot {
    browserFirstCount: number;
    hybridBridgeCount: number;
    desktopBoundCount: number;
    primaryBlockers: string[];
    recommendedFocus: string[];
}

export const KAIN_COMMAND_RECIPES: KainCommandRecipe[] = [
    {
        id: 'doctor',
        label: 'Kain Doctor',
        summary: 'Verify the live Kain toolchain before treating any downstream lane as trustworthy.',
        commandPreview: 'cargo run -q -p cli --bin kain -- doctor',
        generatedOutputs: ['toolchain status', 'target matrix', 'runtime capability snapshot']
    },
    {
        id: 'import-ts',
        label: 'TypeScript Import',
        summary: 'Use Kain as a semantic ingestion lane for selected frontend modules instead of hand-porting them blindly.',
        commandPreview: 'cargo run -q -p cli --bin kain -- import-ts tidus/src/frontend/src/apps/<module> --output tidus/.generated/<module>.kn',
        generatedOutputs: ['imported Kain source', 'migration baseline', 'diffable semantic seam']
    },
    {
        id: 'gpu-artifacts',
        label: 'GPU Artifacts',
        summary: 'Move shader or compute-heavy seams into Kain-owned artifact generation rather than inline string shaders.',
        commandPreview: 'cargo run -q -p cli --bin kain -- gpu-artifacts src/<shader>.kn --output generated/gpu/<module>',
        generatedOutputs: ['SPIR-V or target shader output', 'reflection JSON', 'host wrapper metadata']
    },
    {
        id: 'build-native-ui',
        label: 'Native UI Materialization',
        summary: 'Materialize editor shells or operator tools through Kain when the feature wants a first-class tool host.',
        commandPreview: 'cargo run -q -p cli --bin kain -- build native-ui src/main.kn --app-name tidus-tool',
        generatedOutputs: ['native UI bundle', 'runtime contracts', 'desktop launcher artifacts']
    }
];

interface KainModuleOverride {
    lane: KainAccelerationLane;
    rationale: string;
    nextStep: string;
    generatedOutputs: string[];
    recipeIds: string[];
    blockers?: string[];
    browserDeliveryStatus?: BrowserDeliveryStatus;
}

const KAIN_MODULE_OVERRIDES: Partial<Record<ZenModuleId, KainModuleOverride>> = {
    genius: {
        lane: 'workspace-intelligence',
        rationale: 'Acts as the repo-facing acceleration cockpit that explains how each module should consume Kain rather than hiding the integration logic in chat.',
        nextStep: 'Keep the dev cockpit data-driven and use it to drive concrete migration slices instead of adding another disconnected assistant experiment.',
        generatedOutputs: ['module acceleration map', 'browser ship blockers', 'repo-local Kain diagnostics'],
        recipeIds: ['doctor'],
        browserDeliveryStatus: 'browser-first'
    },
    sculpt: {
        lane: 'host-runtime-bridge',
        rationale: 'Direct sculpt interaction is still anchored to Tauri commands and backend mesh mutation, so the fastest Kain win is shared runtime contracts and staged import rather than pretending it is browser-native already.',
        nextStep: 'Define a Kain-owned sculpt runtime contract, then collapse the highest-value brush and mesh update seams onto a browser-capable host path.',
        generatedOutputs: ['runtime contract metadata', 'import baseline for sculpt UI', 'host bridge inventory'],
        recipeIds: ['doctor', 'import-ts', 'build-native-ui'],
        blockers: ['Heavy reliance on Tauri sculpt commands keeps the current sculpt lane desktop-bound.']
    },
    rig: {
        lane: 'host-runtime-bridge',
        rationale: 'Rigging currently depends on Rust IK and skinning commands, so Kain should own the semantic orchestration and generated bindings before browser parity is claimed.',
        nextStep: 'Lift solver contracts into Kain-facing metadata and keep only the genuinely performance-critical math in host lanes.',
        generatedOutputs: ['solver contracts', 'binding metadata', 'imported rig tool shell'],
        recipeIds: ['doctor', 'import-ts']
    },
    graphos: {
        lane: 'gpu-artifacts',
        rationale: 'Graph-authored material work is a strong fit for Kain-owned shader and reflection output instead of ad-hoc frontend shader strings.',
        nextStep: 'Pick one graph or paint kernel and move it through `gpu-artifacts` as the canonical shader-contract spike.',
        generatedOutputs: ['shader artifacts', 'reflection metadata', 'material host wrapper'],
        recipeIds: ['doctor', 'gpu-artifacts']
    },
    painter: {
        lane: 'gpu-artifacts',
        rationale: 'Painter is materially about surface kernels, texture processing, and host/runtime contracts, which aligns with Kain shader and runtime metadata lanes.',
        nextStep: 'Start with one normal-map or brush-processing seam and replace inline shader ownership with Kain-generated artifacts.',
        generatedOutputs: ['surface kernel artifacts', 'texture processing contracts', 'reflection JSON'],
        recipeIds: ['doctor', 'gpu-artifacts']
    },
    tecton: {
        lane: 'import-ts',
        rationale: 'The landscape tool is mostly browser-rendered and should be normalized into a Kain-informed orchestration layer before any new AI generation work lands.',
        nextStep: 'Remove the ad-hoc frontend-only model call seam and replace it with deterministic Kain-authored terrain recipes plus explicit runtime contracts.',
        generatedOutputs: ['terrain recipe baseline', 'imported module shell', 'deterministic config contract'],
        recipeIds: ['doctor', 'import-ts'],
        blockers: ['`KTecton` still carries a direct frontend `@google/genai` dependency that is not a shippable long-term architecture.']
    }
};

const RECIPE_IDS_BY_LANE: Record<KainAccelerationLane, string[]> = {
    'workspace-intelligence': ['doctor'],
    'import-ts': ['doctor', 'import-ts'],
    'gpu-artifacts': ['doctor', 'gpu-artifacts'],
    'native-ui': ['doctor', 'build-native-ui'],
    'host-runtime-bridge': ['doctor', 'import-ts', 'build-native-ui']
};

const GENERATED_OUTPUTS_BY_LANE: Record<KainAccelerationLane, string[]> = {
    'workspace-intelligence': ['diagnostic snapshots', 'module planning metadata'],
    'import-ts': ['imported Kain source', 'migration baseline'],
    'gpu-artifacts': ['shader bundles', 'reflection metadata'],
    'native-ui': ['native editor shell', 'runtime contracts'],
    'host-runtime-bridge': ['runtime bindings', 'host-backed semantic contracts']
};

const dedupeStrings = (items: string[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item)) {
            return false;
        }
        seen.add(item);
        return true;
    });
};

const inferLane = (moduleId: ZenModuleId): KainAccelerationLane => {
    if (moduleId === 'genius') {
        return 'workspace-intelligence';
    }

    const binding = ZEN_MODULE_RUNTIME_BINDINGS[moduleId];
    if (!binding) {
        return 'import-ts';
    }

    if (binding.interactionMode === 'surface-operator') {
        return 'gpu-artifacts';
    }

    if (binding.tauriCommands.length >= 4 || binding.interactionMode === 'direct-manipulation') {
        return 'host-runtime-bridge';
    }

    if (binding.subjectMode === 'simulation-target') {
        return 'native-ui';
    }

    return 'import-ts';
};

const inferBrowserDeliveryStatus = (moduleId: ZenModuleId): BrowserDeliveryStatus => {
    const binding = ZEN_MODULE_RUNTIME_BINDINGS[moduleId];
    if (!binding) {
        return 'browser-first';
    }

    if (binding.tauriCommands.length === 0) {
        return 'browser-first';
    }

    if (binding.tauriCommands.length <= 2 && binding.supportsSharedViewport) {
        return 'hybrid-bridge';
    }

    return 'desktop-bound';
};

const inferDefaultBlockers = (moduleId: ZenModuleId): string[] => {
    const binding = ZEN_MODULE_RUNTIME_BINDINGS[moduleId];
    if (!binding) {
        return [];
    }

    const blockers: string[] = [];

    if (binding.tauriCommands.length > 0) {
        blockers.push(`${binding.tauriCommands.length} Tauri command seams still need browser-safe host replacement or web adapters.`);
    }

    if (!binding.supportsSharedViewport) {
        blockers.push('This lane does not currently participate in the universal browser viewport contract.');
    }

    if (binding.subjectMode === 'simulation-target') {
        blockers.push('Simulation state needs deterministic serialization before browser shippability claims are credible.');
    }

    return blockers;
};

export const getKainModuleAccelerationProfiles = (): KainModuleAccelerationProfile[] => {
    const moduleIds = Object.keys(ZEN_APP_REGISTRY) as ZenModuleId[];

    return moduleIds
        .filter((moduleId) => moduleId !== 'unknown')
        .map((moduleId) => {
            const appDefinition = ZEN_APP_REGISTRY[moduleId];
            const binding = ZEN_MODULE_RUNTIME_BINDINGS[moduleId];
            const override = KAIN_MODULE_OVERRIDES[moduleId];
            const lane = override?.lane ?? inferLane(moduleId);
            const browserDeliveryStatus = override?.browserDeliveryStatus ?? inferBrowserDeliveryStatus(moduleId);

            return {
                moduleId,
                moduleName: appDefinition.name,
                category: appDefinition.category,
                lane,
                browserDeliveryStatus,
                tauriCommandCount: binding?.tauriCommands.length ?? 0,
                rationale: override?.rationale ?? `${appDefinition.name} should use the ${lane} lane because its runtime binding and authoring surface already describe a clean migration seam.`,
                nextStep: override?.nextStep ?? `Prove one ${lane} slice for ${appDefinition.name} and keep the result tied to the existing Zen module registry instead of building a parallel tool surface.`,
                generatedOutputs: override?.generatedOutputs ?? GENERATED_OUTPUTS_BY_LANE[lane],
                blockers: dedupeStrings([
                    ...(override?.blockers ?? []),
                    ...inferDefaultBlockers(moduleId)
                ]),
                recipeIds: override?.recipeIds ?? RECIPE_IDS_BY_LANE[lane]
            };
        })
        .sort((left, right) => {
            const statusRank: Record<BrowserDeliveryStatus, number> = {
                'desktop-bound': 0,
                'hybrid-bridge': 1,
                'browser-first': 2
            };

            return statusRank[left.browserDeliveryStatus] - statusRank[right.browserDeliveryStatus];
        });
};

export const getKainShippabilitySnapshot = (): KainShippabilitySnapshot => {
    const profiles = getKainModuleAccelerationProfiles();

    const primaryBlockers = dedupeStrings(
        profiles
            .filter((profile) => profile.browserDeliveryStatus !== 'browser-first')
            .flatMap((profile) => profile.blockers)
    ).slice(0, 6);

    const recommendedFocus = profiles
        .filter((profile) => profile.moduleId !== 'genius')
        .slice(0, 4)
        .map((profile) => `${profile.moduleName}: ${profile.nextStep}`);

    return {
        browserFirstCount: profiles.filter((profile) => profile.browserDeliveryStatus === 'browser-first').length,
        hybridBridgeCount: profiles.filter((profile) => profile.browserDeliveryStatus === 'hybrid-bridge').length,
        desktopBoundCount: profiles.filter((profile) => profile.browserDeliveryStatus === 'desktop-bound').length,
        primaryBlockers,
        recommendedFocus
    };
};

