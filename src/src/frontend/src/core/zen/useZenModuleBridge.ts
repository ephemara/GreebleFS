import { useCallback, useEffect } from 'react';
import {
    ZenLayerInput,
    ZenModuleId,
    ZenSequencerSourceInput,
    ZenSequencerTransportPatch,
    ZenViewportRuntimeSession
} from './types';
import { useZenWorkspaceStore } from './store';

export const useZenModuleBridge = (
    moduleId: ZenModuleId,
    initialModuleState?: Record<string, unknown>
) => {
    const ensureModuleLayer = useZenWorkspaceStore((state) => state.ensureModuleLayer);
    const syncLayers = useZenWorkspaceStore((state) => state.syncModuleLayers);
    const registerViewportSession = useZenWorkspaceStore((state) => state.registerViewportSession);
    const unregisterViewportSession = useZenWorkspaceStore((state) => state.unregisterViewportSession);
    const refreshViewportState = useZenWorkspaceStore((state) => state.refreshViewportState);
    const patchModuleState = useZenWorkspaceStore((state) => state.setModuleState);
    const setActiveSelection = useZenWorkspaceStore((state) => state.setActiveSelection);
    const syncSequencerSource = useZenWorkspaceStore((state) => state.syncSequencerSource);
    const setActiveSequencerSource = useZenWorkspaceStore((state) => state.setActiveSequencerSource);
    const patchSequencerTransport = useZenWorkspaceStore((state) => state.patchSequencerTransport);

    useEffect(() => {
        ensureModuleLayer(moduleId);
    }, [ensureModuleLayer, moduleId]);

    useEffect(() => {
        if (initialModuleState) {
            patchModuleState(moduleId, initialModuleState);
        }
    }, [initialModuleState, moduleId, patchModuleState]);

    const connectViewport = useCallback((runtime: ZenViewportRuntimeSession) => {
        registerViewportSession(moduleId, runtime);

        const sync = () => refreshViewportState(moduleId);
        const controls = runtime.controls as any;

        controls?.addEventListener?.('change', sync);
        window.addEventListener('resize', sync);

        sync();

        return () => {
            controls?.removeEventListener?.('change', sync);
            window.removeEventListener('resize', sync);
            unregisterViewportSession(moduleId);
        };
    }, [moduleId, refreshViewportState, registerViewportSession, unregisterViewportSession]);

    const publishLayers = useCallback((layers: ZenLayerInput[]) => {
        syncLayers(moduleId, layers);
    }, [moduleId, syncLayers]);

    const publishState = useCallback((state: Record<string, unknown>) => {
        patchModuleState(moduleId, state);
    }, [moduleId, patchModuleState]);

    const publishSelection = useCallback((selection: { activeAssetId?: string | null; activeEntityId?: string | null; activeLayerId?: string | null }) => {
        setActiveSelection(selection);
    }, [setActiveSelection]);

    const publishSequencerSource = useCallback((source: ZenSequencerSourceInput) => {
        syncSequencerSource(moduleId, source);
    }, [moduleId, syncSequencerSource]);

    const focusSequencerSource = useCallback(() => {
        setActiveSequencerSource(moduleId);
    }, [moduleId, setActiveSequencerSource]);

    const updateSequencerTransport = useCallback((patch: ZenSequencerTransportPatch) => {
        patchSequencerTransport(patch);
    }, [patchSequencerTransport]);

    return {
        connectViewport,
        publishLayers,
        publishState,
        publishSelection,
        publishSequencerSource,
        focusSequencerSource,
        updateSequencerTransport
    };
};
