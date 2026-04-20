import {
    ZenModuleId,
    ZenSequencerSourceInput,
    ZenSequencerSourceState,
    ZenSequencerState,
    ZenSequencerTransportPatch
} from './types';
import { getZenAppDefinition } from './moduleRegistry';

const DEFAULT_FPS = 30;

const clampSequencerTime = (time: number, duration: number, loop: boolean): number => {
    if (duration <= 0) return 0;
    if (!loop) return Math.max(0, Math.min(time, duration));
    const wrapped = time % duration;
    return wrapped < 0 ? wrapped + duration : wrapped;
};

const resolveAvailableSourceModuleId = (state: ZenSequencerState): ZenModuleId | null => {
    const activeSourceModuleId = state.activeSourceModuleId;
    const activeSource = activeSourceModuleId ? state.sources[activeSourceModuleId] : null;

    if (activeSource?.available) {
        return activeSourceModuleId;
    }

    const fallbackSource = Object.values(state.sources).find((source): source is ZenSequencerSourceState => Boolean(source?.available));
    return fallbackSource?.moduleId ?? null;
};

const syncTransportFromActiveSource = (state: ZenSequencerState): ZenSequencerState => {
    const activeSourceModuleId = resolveAvailableSourceModuleId(state);
    if (!activeSourceModuleId) {
        return {
            ...state,
            activeSourceModuleId: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0
        };
    }

    const activeSource = state.sources[activeSourceModuleId]!;

    return {
        ...state,
        activeSourceModuleId,
        duration: Math.max(0, activeSource.duration),
        fps: Math.max(1, activeSource.fps || DEFAULT_FPS),
        loop: activeSource.loop,
        currentTime: clampSequencerTime(state.currentTime, Math.max(0, activeSource.duration), activeSource.loop)
    };
};

export const createZenSequencerState = (): ZenSequencerState => ({
    activeSourceModuleId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    fps: DEFAULT_FPS,
    playbackRate: 1,
    loop: true,
    lastUpdated: Date.now(),
    sources: {}
});

export const syncZenSequencerSource = (
    state: ZenSequencerState,
    moduleId: ZenModuleId,
    input: ZenSequencerSourceInput
): ZenSequencerState => {
    const existing = state.sources[moduleId];
    const nextSource: ZenSequencerSourceState = {
        moduleId,
        label: input.label ?? existing?.label ?? getZenAppDefinition(moduleId)?.name ?? moduleId.toUpperCase(),
        duration: Math.max(0, input.duration ?? existing?.duration ?? 0),
        fps: Math.max(1, input.fps ?? existing?.fps ?? DEFAULT_FPS),
        loop: input.loop ?? existing?.loop ?? true,
        available: input.available ?? existing?.available ?? true,
        updatedAt: Date.now()
    };

    let nextState: ZenSequencerState = {
        ...state,
        lastUpdated: Date.now(),
        sources: {
            ...state.sources,
            [moduleId]: nextSource
        }
    };

    if (!nextState.activeSourceModuleId && nextSource.available) {
        nextState = {
            ...nextState,
            activeSourceModuleId: moduleId
        };
    }

    return syncTransportFromActiveSource(nextState);
};

export const setZenSequencerActiveSource = (
    state: ZenSequencerState,
    moduleId: ZenModuleId | null
): ZenSequencerState => {
    if (!moduleId) {
        return {
            ...state,
            activeSourceModuleId: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            lastUpdated: Date.now()
        };
    }

    const source = state.sources[moduleId];
    if (!source || !source.available) {
        return state;
    }

    return syncTransportFromActiveSource({
        ...state,
        activeSourceModuleId: moduleId,
        lastUpdated: Date.now()
    });
};

export const patchZenSequencerTransport = (
    state: ZenSequencerState,
    patch: ZenSequencerTransportPatch
): ZenSequencerState => {
    const nextState: ZenSequencerState = {
        ...state,
        ...patch,
        fps: patch.fps !== undefined ? Math.max(1, patch.fps) : state.fps,
        playbackRate: patch.playbackRate !== undefined ? Math.max(0.01, patch.playbackRate) : state.playbackRate,
        lastUpdated: Date.now()
    };

    const syncedState = syncTransportFromActiveSource(nextState);
    const nextTime = patch.currentTime !== undefined ? patch.currentTime : syncedState.currentTime;

    return {
        ...syncedState,
        currentTime: clampSequencerTime(nextTime, syncedState.duration, syncedState.loop),
        isPlaying: syncedState.duration > 0 ? syncedState.isPlaying : false
    };
};

export const advanceZenSequencer = (
    state: ZenSequencerState,
    deltaSeconds: number
): ZenSequencerState => {
    if (!state.isPlaying || state.duration <= 0) {
        return state;
    }

    const safeDelta = Math.max(0, Math.min(deltaSeconds, 0.1));
    if (safeDelta === 0) {
        return state;
    }

    const nextTime = state.currentTime + (safeDelta * state.playbackRate);

    if (!state.loop && nextTime >= state.duration) {
        return {
            ...state,
            isPlaying: false,
            currentTime: state.duration,
            lastUpdated: Date.now()
        };
    }

    return {
        ...state,
        currentTime: clampSequencerTime(nextTime, state.duration, state.loop),
        lastUpdated: Date.now()
    };
};
