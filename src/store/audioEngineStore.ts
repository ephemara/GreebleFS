import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import type {
  ExplorerAudioDeckId,
  ExplorerAudioDeckState,
  ExplorerAudioEngineStateSnapshot,
} from '../runtime/audioWorkbenchBackend';
import {
  getExplorerAudioEngineState,
  listenToExplorerAudioEngineState,
  pauseExplorerAudioDeck,
  playExplorerAudioDeck,
  prepareExplorerAudioEngine,
  seekExplorerAudioDeck,
  setExplorerArmedAudioDeck,
  setExplorerAudioDeckGain,
  setExplorerAudioDeckRate,
  setExplorerAudioLoopRegion,
  stopExplorerAudioDeck,
  syncExplorerSelectionToArmedDeck,
  unloadExplorerAudioDeck,
  loadExplorerAudioDeck,
  loadExplorerAudioDeckPlugin,
  clearExplorerAudioDeckPlugin,
} from '../runtime/audioWorkbenchBackend';

type AudioEngineStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AudioEngineStoreState {
  snapshot: ExplorerAudioEngineStateSnapshot;
  hydrationState: AudioEngineStoreStatus;
  hydrationError: string | null;
  subscriptionState: AudioEngineStoreStatus;
  subscriptionError: string | null;
  replaceSnapshot: (snapshot: ExplorerAudioEngineStateSnapshot) => void;
  setHydrationState: (state: AudioEngineStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
  setSubscriptionState: (state: AudioEngineStoreStatus) => void;
  setSubscriptionError: (message: string | null) => void;
}

const EMPTY_DECK_STATE = (deckId: ExplorerAudioDeckId): ExplorerAudioDeckState => ({
  deckId,
  loadedPath: null,
  loadedName: null,
  durationSeconds: 0,
  currentTimeSeconds: 0,
  gainLinear: 1,
  rate: 1,
  isPlaying: false,
  isLoading: false,
  isBuffering: false,
  peakMeterLinear: 0,
  rmsMeterLinear: 0,
  loopRegion: {
    startSeconds: 0,
    endSeconds: 0,
    enabled: false,
  },
  error: null,
  activePluginPath: null,
  vstParameters: [],
});

const DEFAULT_AUDIO_ENGINE_SNAPSHOT: ExplorerAudioEngineStateSnapshot = {
  ready: false,
  engineError: null,
  armedDeck: 'a',
  outputSampleRateHz: null,
  outputChannels: null,
  decks: [EMPTY_DECK_STATE('a'), EMPTY_DECK_STATE('b')],
};

let hydrationPromise: Promise<void> | null = null;
let subscriptionPromise: Promise<void> | null = null;
let subscriptionReady = false;

export const useAudioEngineStore = create<AudioEngineStoreState>((set) => ({
  snapshot: DEFAULT_AUDIO_ENGINE_SNAPSHOT,
  hydrationState: 'idle',
  hydrationError: null,
  subscriptionState: 'idle',
  subscriptionError: null,
  replaceSnapshot: (snapshot) => set({ snapshot }),
  setHydrationState: (hydrationState) => set({ hydrationState }),
  setHydrationError: (hydrationError) =>
    set({
      hydrationError,
      hydrationState: hydrationError ? 'error' : 'ready',
    }),
  setSubscriptionState: (subscriptionState) => set({ subscriptionState }),
  setSubscriptionError: (subscriptionError) =>
    set({
      subscriptionError,
      subscriptionState: subscriptionError ? 'error' : 'ready',
    }),
}));

async function ensureAudioEngineHydration(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  const store = useAudioEngineStore.getState();
  store.setHydrationState('loading');
  store.setHydrationError(null);

  hydrationPromise = (async () => {
    const existingState = await getExplorerAudioEngineState();
    const snapshot = existingState.ready ? existingState : await prepareExplorerAudioEngine();
    useAudioEngineStore.getState().replaceSnapshot(snapshot);
    useAudioEngineStore.getState().setHydrationState('ready');
  })()
    .catch((error) => {
      useAudioEngineStore
        .getState()
        .setHydrationError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

async function ensureAudioEngineSubscription(): Promise<void> {
  if (!isTauri() || subscriptionReady) {
    return;
  }

  if (subscriptionPromise) {
    return subscriptionPromise;
  }

  const store = useAudioEngineStore.getState();
  store.setSubscriptionState('loading');
  store.setSubscriptionError(null);

  subscriptionPromise = listenToExplorerAudioEngineState((event) => {
    useAudioEngineStore.getState().replaceSnapshot(event.state);
  })
    .then(() => {
      subscriptionReady = true;
      useAudioEngineStore.getState().setSubscriptionState('ready');
    })
    .catch((error) => {
      useAudioEngineStore
        .getState()
        .setSubscriptionError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      subscriptionPromise = null;
    });

  return subscriptionPromise;
}

async function ensureAudioEngineFeed(): Promise<void> {
  await ensureAudioEngineHydration();
  await ensureAudioEngineSubscription();
}

export function useAudioEngineFeed(): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      void ensureAudioEngineFeed();
    }
  }, []);
}

export function useAudioEngineSnapshot(): ExplorerAudioEngineStateSnapshot {
  return useAudioEngineStore((state) => state.snapshot);
}

export function getAudioDeckState(
  snapshot: ExplorerAudioEngineStateSnapshot,
  deckId: ExplorerAudioDeckId,
): ExplorerAudioDeckState {
  return (
    snapshot.decks.find((deck) => deck.deckId === deckId) ?? EMPTY_DECK_STATE(deckId)
  );
}

function commitAudioSnapshot(snapshot: ExplorerAudioEngineStateSnapshot): ExplorerAudioEngineStateSnapshot {
  useAudioEngineStore.getState().replaceSnapshot(snapshot);
  return snapshot;
}

export async function armAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await setExplorerArmedAudioDeck({ deckId }));
}

export async function loadSelectionIntoAudioDeck(
  deckId: ExplorerAudioDeckId,
  inputPath: string,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await loadExplorerAudioDeck({ deckId, inputPath }));
}

export async function syncSelectionIntoArmedAudioDeck(
  inputPath: string,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await syncExplorerSelectionToArmedDeck({ inputPath }));
}

export async function playAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await playExplorerAudioDeck({ deckId }));
}

export async function pauseAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await pauseExplorerAudioDeck({ deckId }));
}

export async function stopAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await stopExplorerAudioDeck({ deckId }));
}

export async function unloadAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await unloadExplorerAudioDeck({ deckId }));
}

export async function seekAudioDeck(
  deckId: ExplorerAudioDeckId,
  positionSeconds: number,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await seekExplorerAudioDeck({ deckId, positionSeconds }));
}

export async function setAudioDeckLoopRegion(
  deckId: ExplorerAudioDeckId,
  startSeconds: number,
  endSeconds: number,
  enabled: boolean,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(
    await setExplorerAudioLoopRegion({
      deckId,
      startSeconds,
      endSeconds,
      enabled,
    }),
  );
}

export async function setAudioDeckGain(
  deckId: ExplorerAudioDeckId,
  gainLinear: number,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await setExplorerAudioDeckGain({ deckId, gainLinear }));
}

export async function setAudioDeckRate(
  deckId: ExplorerAudioDeckId,
  rate: number,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await setExplorerAudioDeckRate({ deckId, rate }));
}

/** Load a VST3 plugin onto a deck (stores path, future: interrogates parameters). */
export async function loadAudioDeckPlugin(
  deckId: ExplorerAudioDeckId,
  pluginPath: string,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await loadExplorerAudioDeckPlugin({ deckId, pluginPath }));
}

/** Remove the currently loaded VST3 plugin from a deck. */
export async function clearAudioDeckPlugin(
  deckId: ExplorerAudioDeckId,
): Promise<ExplorerAudioEngineStateSnapshot> {
  return commitAudioSnapshot(await clearExplorerAudioDeckPlugin({ deckId }));
}
