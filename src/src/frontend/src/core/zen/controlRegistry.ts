import { getZenRuntimeBinding } from './runtimeRegistry';
import { ZenModuleId, ZenWorkspaceDocument } from './types';
import { ZEN_VIEWPORT_GROUP_HOSTS, getZenViewportGroupId } from './moduleRegistry';

export type ZenControlPhase = 'down' | 'up';
export type ZenSharedGizmoMode = 'translate' | 'rotate' | 'scale';
export type ZenSharedTransformSpace = 'world' | 'local';
export type ZenViewportPointerPolicy = 'default-orbit' | 'tool-primary-alt-orbit' | 'passive-overlay';

export type ZenControlActionId =
    | 'camera.focus'
    | 'camera.orbit.hold'
    | 'history.undo'
    | 'history.redo'
    | 'gizmo.translate'
    | 'gizmo.rotate'
    | 'gizmo.scale'
    | 'layer.prev'
    | 'layer.next'
    | 'menu.quick.hold'
    | 'menu.quick.toggle'
    | 'menu.brush.toggle'
    | 'menu.alpha.toggle'
    | 'canvas.pan.hold'
    | 'canvas.frame'
    | 'graphos.menu.layer.toggle'
    | 'graphos.menu.material.toggle'
    | 'graphos.sim.wind.toggle'
    | 'sculpt.mask.hold'
    | 'sculpt.radius.decrease'
    | 'sculpt.radius.increase'
    | 'sculpt.symmetry.toggle'
    | 'tool.slot.0'
    | 'tool.slot.1'
    | 'tool.slot.2'
    | 'tool.slot.3'
    | 'tool.slot.4'
    | 'tool.slot.5'
    | 'tool.slot.6'
    | 'tool.slot.7'
    | 'tool.slot.8'
    | 'tool.slot.9';

export interface ZenControlBinding {
    actionId: ZenControlActionId;
    key?: string;
    code?: string;
    primaryModifier?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    phases?: ZenControlPhase[];
    preventDefault?: boolean;
    allowRepeat?: boolean;
}

export interface ZenControlInteractionState {
    pressedActions: ZenControlActionId[];
    orbitModifierActive: boolean;
    gizmoMode: ZenSharedGizmoMode;
    transformSpace: ZenSharedTransformSpace;
    snapEnabled: boolean;
    lastActionId: ZenControlActionId | null;
    lastActionModuleId: ZenModuleId | null;
    updatedAt: number;
}

export interface ZenControlDispatchContext {
    actionId: ZenControlActionId;
    phase: ZenControlPhase;
    keyboardEvent: KeyboardEvent;
    sourceModuleId: ZenModuleId;
    targetModuleId: ZenModuleId;
    document: ZenWorkspaceDocument;
    interaction: ZenControlInteractionState;
}

export type ZenControlHandlerResolver = (context: ZenControlDispatchContext) => boolean | void;

export interface ZenControlProfile {
    moduleId: ZenModuleId;
    label: string;
    inheritsFrom: string[];
    cameraSystem: 'shared-viewport-orbit' | 'canvas-pan-zoom' | 'studio-stage';
    gizmoSystem: 'shared-transform' | 'none';
    primaryCrates: string[];
    tauriCommands: string[];
    bindings: ZenControlBinding[];
    notes: string[];
}

export interface ZenResolvedControlProfile extends Omit<ZenControlProfile, 'inheritsFrom' | 'bindings'> {
    inheritsFrom: string[];
    bindings: ZenControlBinding[];
}

export const ZEN_SHARED_CONTROL_STACK = {
    input: ['k-os-game-input'],
    camera: ['k-os-game-camera'],
    gizmo: ['k-os-gizmo'],
    history: ['k-os-undo']
} as const;

const ZEN_CONTROL_BINDING_PRESETS: Record<string, ZenControlBinding[]> = {
    sharedViewportNavigation: [
        { actionId: 'camera.focus', key: 'f' },
        { actionId: 'camera.orbit.hold', key: 'alt', phases: ['down', 'up'] },
        { actionId: 'history.undo', key: 'z', primaryModifier: true, shiftKey: false },
        { actionId: 'history.redo', key: 'z', primaryModifier: true, shiftKey: true },
        { actionId: 'history.redo', key: 'y', primaryModifier: true }
    ],
    sharedTransformGizmo: [
        { actionId: 'gizmo.translate', key: 'w' },
        { actionId: 'gizmo.rotate', key: 'e' },
        { actionId: 'gizmo.scale', key: 'r' }
    ],
    sharedLayerNavigation: [
        { actionId: 'layer.prev', key: 'arrowup', preventDefault: true },
        { actionId: 'layer.next', key: 'arrowdown', preventDefault: true }
    ],
    sculptWorkflow: [
        { actionId: 'menu.quick.toggle', key: 'q' },
        { actionId: 'menu.brush.toggle', key: 'b' },
        { actionId: 'menu.alpha.toggle', key: 'a', primaryModifier: false },
        { actionId: 'sculpt.mask.hold', key: 'control', phases: ['down', 'up'], preventDefault: false },
        { actionId: 'sculpt.radius.decrease', key: '[' },
        { actionId: 'sculpt.radius.increase', key: ']' },
        { actionId: 'sculpt.symmetry.toggle', key: 'x' },
        { actionId: 'tool.slot.1', key: '1' },
        { actionId: 'tool.slot.2', key: '2' },
        { actionId: 'tool.slot.3', key: '3' },
        { actionId: 'tool.slot.4', key: '4' },
        { actionId: 'tool.slot.5', key: '5' },
        { actionId: 'tool.slot.6', key: '6' },
        { actionId: 'tool.slot.7', key: '7' },
        { actionId: 'tool.slot.8', key: '8' },
        { actionId: 'tool.slot.9', key: '9' },
        { actionId: 'tool.slot.0', key: '0' }
    ],
    greebleWorkflow: [
        { actionId: 'menu.quick.hold', key: 'space', phases: ['down', 'up'], preventDefault: true }
    ],
    painterWorkflow: [
        { actionId: 'menu.quick.hold', key: 'q', phases: ['down', 'up'] }
    ],
    graphosWorkflow: [
        { actionId: 'canvas.pan.hold', key: 'space', phases: ['down', 'up'], preventDefault: true },
        { actionId: 'menu.quick.toggle', key: 'q' },
        { actionId: 'menu.brush.toggle', key: 'b' },
        { actionId: 'graphos.menu.layer.toggle', key: 'l' },
        { actionId: 'graphos.menu.material.toggle', key: 'm' },
        { actionId: 'menu.alpha.toggle', key: 'a' },
        { actionId: 'graphos.sim.wind.toggle', key: 'w' },
        { actionId: 'canvas.frame', key: 'f' }
    ]
} as const;

const ZEN_MODULE_CONTROL_PROFILES: Record<ZenModuleId, Omit<ZenControlProfile, 'primaryCrates' | 'tauriCommands'>> = {
    sculpt: {
        moduleId: 'sculpt',
        label: 'K-Sculpt Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedTransformGizmo', 'sharedLayerNavigation', 'sculptWorkflow'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'shared-transform',
        bindings: [],
        notes: [
            'Acts as the universal viewport host for editor-mode modules.',
            'Shares gizmo mode and orbit intent with overlays instead of owning private key listeners.'
        ]
    },
    greeble: {
        moduleId: 'greeble',
        label: 'K-Greeble Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedTransformGizmo', 'sharedLayerNavigation', 'greebleWorkflow'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'shared-transform',
        bindings: [],
        notes: [
            'IMM-style placement now borrows the host viewport controls instead of freelancing its own listeners.'
        ]
    },
    scatter: {
        moduleId: 'scatter',
        label: 'K-Scatter Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedTransformGizmo'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'shared-transform',
        bindings: [],
        notes: ['Procedural scattering should reuse the same orbit/history vocabulary as sculpt and greeble.']
    },
    atlas: {
        moduleId: 'atlas',
        label: 'K-Atlas Shared Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Atlas uses the shared viewport host for camera behavior while it works on surface data.']
    },
    painter: {
        moduleId: 'painter',
        label: 'K-Painter Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'painterWorkflow'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Painter keeps one quick-menu/orbit vocabulary whether mounted standalone or over the shared viewport.']
    },
    cloner: {
        moduleId: 'cloner',
        label: 'K-Cloner Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedTransformGizmo'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'shared-transform',
        bindings: [],
        notes: ['Cloner should inherit the same transform and history system used by the rest of the suite.']
    },
    rig: {
        moduleId: 'rig',
        label: 'K-Rig Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedTransformGizmo'],
        cameraSystem: 'studio-stage',
        gizmoSystem: 'shared-transform',
        bindings: [],
        notes: ['Rig keeps the same orbit modifier and gizmo mode vocabulary when it owns a standalone stage.']
    },
    quantum: {
        moduleId: 'quantum',
        label: 'K-Quantum Shared Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Simulation modules should still honor shared viewport navigation and history gestures.']
    },
    graphos: {
        moduleId: 'graphos',
        label: 'K-Graphos Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedLayerNavigation', 'graphosWorkflow'],
        cameraSystem: 'canvas-pan-zoom',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Graphos overlays its canvas but now resolves its hotkeys through the same shared dispatch path.']
    },
    autopbr: {
        moduleId: 'autopbr',
        label: 'K-Sample Shared Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Sampling/material apps use the same orbit and history backbone.']
    },
    inspect: {
        moduleId: 'inspect',
        label: 'Inspector Shared Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Inspector reads shared interaction state rather than inventing its own controls.']
    },
    tecton: {
        moduleId: 'tecton',
        label: 'K-Tecton Shared Controls',
        inheritsFrom: ['sharedViewportNavigation', 'sharedTransformGizmo'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'shared-transform',
        bindings: [],
        notes: ['Landscape authoring should obey the same editor camera vocabulary as sculpt.']
    },
    chronos: {
        moduleId: 'chronos',
        label: 'K-Chronos Shared Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Sequencer views should still share the suite history and focus actions.']
    },
    genius: {
        moduleId: 'genius',
        label: 'K-Genius Developer Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Developer tooling should reuse the same shared dispatch path and avoid bespoke keyboard islands.']
    },
    bevy: {
        moduleId: 'bevy',
        label: 'Bevy Leash Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: ['Bevy remains slaved to the same history/camera command vocabulary through the leash bridge.']
    },
    unknown: {
        moduleId: 'unknown',
        label: 'Fallback Shared Controls',
        inheritsFrom: ['sharedViewportNavigation'],
        cameraSystem: 'shared-viewport-orbit',
        gizmoSystem: 'none',
        bindings: [],
        notes: []
    }
};

const ZEN_VIEWPORT_POINTER_POLICIES: Partial<Record<ZenModuleId, ZenViewportPointerPolicy>> = {
    greeble: 'tool-primary-alt-orbit',
    scatter: 'tool-primary-alt-orbit',
    cloner: 'tool-primary-alt-orbit',
    atlas: 'passive-overlay',
    painter: 'passive-overlay',
    rig: 'passive-overlay',
    quantum: 'passive-overlay',
    graphos: 'passive-overlay',
    autopbr: 'passive-overlay',
    inspect: 'passive-overlay',
    chronos: 'passive-overlay',
    bevy: 'passive-overlay'
};

const toControlKey = (value?: string): string => {
    const normalized = (value ?? '').toLowerCase();
    switch (normalized) {
        case ' ':
        case 'spacebar':
            return 'space';
        case 'esc':
            return 'escape';
        default:
            return normalized;
    }
};

const uniqueValues = <T>(values: T[]): T[] => Array.from(new Set(values));

export const createZenControlInteractionState = (): ZenControlInteractionState => ({
    pressedActions: [],
    orbitModifierActive: false,
    gizmoMode: 'translate',
    transformSpace: 'world',
    snapEnabled: false,
    lastActionId: null,
    lastActionModuleId: null,
    updatedAt: 0
});

export const clearZenControlInteractionState = (
    interaction: ZenControlInteractionState
): ZenControlInteractionState => ({
    ...interaction,
    pressedActions: [],
    orbitModifierActive: false,
    updatedAt: Date.now()
});

export const reduceZenControlInteractionState = (
    interaction: ZenControlInteractionState,
    actionId: ZenControlActionId,
    phase: ZenControlPhase,
    sourceModuleId: ZenModuleId
): ZenControlInteractionState => {
    const pressedActionSet = new Set(interaction.pressedActions);
    if (phase === 'down') {
        pressedActionSet.add(actionId);
    } else {
        pressedActionSet.delete(actionId);
    }

    let gizmoMode = interaction.gizmoMode;
    let transformSpace = interaction.transformSpace;
    let snapEnabled = interaction.snapEnabled;
    let orbitModifierActive = interaction.orbitModifierActive;

    if (actionId === 'camera.orbit.hold') {
        orbitModifierActive = phase === 'down';
    }

    if (phase === 'down') {
        if (actionId === 'gizmo.translate' || actionId === 'gizmo.rotate' || actionId === 'gizmo.scale') {
            gizmoMode = actionId.replace('gizmo.', '') as ZenSharedGizmoMode;
        }
    }

    return {
        ...interaction,
        pressedActions: Array.from(pressedActionSet),
        orbitModifierActive,
        gizmoMode,
        transformSpace,
        snapEnabled,
        lastActionId: phase === 'down' ? actionId : interaction.lastActionId,
        lastActionModuleId: phase === 'down' ? sourceModuleId : interaction.lastActionModuleId,
        updatedAt: Date.now()
    };
};

export const shouldIgnoreZenKeyboardEvent = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;
    if (!target) {
        return false;
    }

    const tagName = target.tagName;
    return tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT'
        || target.isContentEditable;
};

export const matchesZenControlBinding = (
    binding: ZenControlBinding,
    event: KeyboardEvent,
    phase: ZenControlPhase
): boolean => {
    const phases = binding.phases ?? ['down'];
    if (!phases.includes(phase)) {
        return false;
    }

    if (phase === 'down' && event.repeat && !binding.allowRepeat) {
        return false;
    }

    if (binding.key && toControlKey(event.key) !== toControlKey(binding.key)) {
        return false;
    }

    if (binding.code && event.code.toLowerCase() !== binding.code.toLowerCase()) {
        return false;
    }

    if (binding.primaryModifier !== undefined && (event.ctrlKey || event.metaKey) !== binding.primaryModifier) {
        return false;
    }

    if (binding.ctrlKey !== undefined && event.ctrlKey !== binding.ctrlKey) {
        return false;
    }

    if (binding.metaKey !== undefined && event.metaKey !== binding.metaKey) {
        return false;
    }

    if (binding.altKey !== undefined && event.altKey !== binding.altKey) {
        return false;
    }

    if (binding.shiftKey !== undefined && event.shiftKey !== binding.shiftKey) {
        return false;
    }

    return true;
};

export const resolveZenViewportControlHostModuleId = (moduleId: ZenModuleId): ZenModuleId =>
    ZEN_VIEWPORT_GROUP_HOSTS[getZenViewportGroupId(moduleId)] ?? moduleId;

export const resolveZenViewportPointerPolicy = (
    moduleId: ZenModuleId
): ZenViewportPointerPolicy => ZEN_VIEWPORT_POINTER_POLICIES[moduleId] ?? 'default-orbit';

export const resolveZenControlProfile = (moduleId: ZenModuleId): ZenResolvedControlProfile => {
    const runtimeBinding = getZenRuntimeBinding(moduleId);
    const profile = ZEN_MODULE_CONTROL_PROFILES[moduleId] ?? ZEN_MODULE_CONTROL_PROFILES.unknown;
    const presetBindings = profile.inheritsFrom.flatMap((presetId) => ZEN_CONTROL_BINDING_PRESETS[presetId] ?? []);
    const primaryCrates = uniqueValues([
        ...ZEN_SHARED_CONTROL_STACK.input,
        ...ZEN_SHARED_CONTROL_STACK.camera,
        ...(profile.gizmoSystem === 'shared-transform' ? ZEN_SHARED_CONTROL_STACK.gizmo : []),
        ...ZEN_SHARED_CONTROL_STACK.history,
        ...(runtimeBinding?.primaryCrates ?? [])
    ]);
    const tauriCommands = uniqueValues([
        ...(runtimeBinding?.tauriCommands ?? [])
    ]);

    return {
        ...profile,
        inheritsFrom: profile.inheritsFrom,
        primaryCrates,
        tauriCommands,
        bindings: [...presetBindings, ...profile.bindings]
    };
};

export const resolveZenControlBindings = (moduleId: ZenModuleId): ZenControlBinding[] =>
    resolveZenControlProfile(moduleId).bindings;
