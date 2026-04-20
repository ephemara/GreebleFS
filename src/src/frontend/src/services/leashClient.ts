import type { ZenModuleId } from '../core/zen/types';

type LeashCommandName =
    | 'leash_cam_rotate'
    | 'leash_cam_zoom'
    | 'leash_undo'
    | 'leash_redo'
    | 'leash_snapshot'
    | 'leash_symmetry'
    | 'leash_wireframe';

type InvokeFn = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

export const ZEN_LEASH_COMMANDS = {
    camera: {
        rotate: 'leash_cam_rotate',
        zoom: 'leash_cam_zoom'
    },
    history: {
        undo: 'leash_undo',
        redo: 'leash_redo',
        snapshot: 'leash_snapshot'
    },
    sculpt: {
        symmetry: 'leash_symmetry',
        wireframe: 'leash_wireframe'
    }
} as const satisfies Record<string, Record<string, LeashCommandName>>;

const isTauriRuntime = (): boolean =>
    typeof window !== 'undefined' && '__TAURI__' in window;

let cachedInvoke: InvokeFn | null = null;

const getInvoke = async (): Promise<InvokeFn | null> => {
    if (cachedInvoke) {
        return cachedInvoke;
    }

    if (!isTauriRuntime()) {
        return null;
    }

    try {
        const tauri = await import('@tauri-apps/api/core');
        cachedInvoke = tauri.invoke as InvokeFn;
        return cachedInvoke;
    } catch (error) {
        console.warn('[leashClient] Failed to load Tauri invoke bridge.', error);
        return null;
    }
};

const invokeLeashCommand = async <T = unknown>(
    command: LeashCommandName,
    args?: Record<string, unknown>,
    moduleId: ZenModuleId | 'shared' = 'shared'
): Promise<T | null> => {
    const invoke = await getInvoke();
    if (!invoke) {
        return null;
    }

    try {
        return await invoke<T>(command, args);
    } catch (error) {
        console.warn(`[leashClient] ${moduleId} failed to invoke ${command}.`, error);
        return null;
    }
};

export const leashClient = {
    cameraRotate: (dx: number, dy: number, moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.camera.rotate, { dx, dy }, moduleId),
    cameraZoom: (delta: number, moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.camera.zoom, { delta }, moduleId),
    historyUndo: (moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.history.undo, undefined, moduleId),
    historyRedo: (moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.history.redo, undefined, moduleId),
    historySnapshot: (moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.history.snapshot, undefined, moduleId),
    setSymmetry: (axis: number, moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.sculpt.symmetry, { axis }, moduleId),
    setWireframe: (enabled: boolean, moduleId: ZenModuleId | 'shared' = 'shared') =>
        invokeLeashCommand(ZEN_LEASH_COMMANDS.sculpt.wireframe, { enabled }, moduleId)
};
