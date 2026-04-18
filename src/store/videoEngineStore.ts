import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import type { ExplorerVideoEngineStateSnapshot } from '../runtime/videoEngineBackend';
import {
  getExplorerVideoEngineState,
  listenToExplorerVideoEngineState,
  loadExplorerVideoSource,
  pauseExplorerVideo,
  playExplorerVideo,
  prepareExplorerVideoEngine,
  seekExplorerVideo,
  setExplorerVideoLoopRegion,
  stopExplorerVideo,
} from '../runtime/videoEngineBackend';

type VideoEngineStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface VideoEngineStoreState {
  snapshot: ExplorerVideoEngineStateSnapshot;
  hydrationState: VideoEngineStoreStatus;
  hydrationError: string | null;
  subscriptionState: VideoEngineStoreStatus;
  subscriptionError: string | null;
  replaceSnapshot: (snapshot: ExplorerVideoEngineStateSnapshot) => void;
  setHydrationState: (state: VideoEngineStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
  setSubscriptionState: (state: VideoEngineStoreStatus) => void;
  setSubscriptionError: (message: string | null) => void;
}

const DEFAULT_VIDEO_ENGINE_SNAPSHOT: ExplorerVideoEngineStateSnapshot = {
  ready: false,
  engineError: null,
  loadedPath: null,
  loadedName: null,
  durationSeconds: 0,
  widthPx: null,
  heightPx: null,
  frameRate: null,
  hasAudioTrack: false,
  currentTimeSeconds: 0,
  isPlaying: false,
  isLoading: false,
  playbackBackend: 'webviewMediaElement',
  loopRegion: {
    startSeconds: 0,
    endSeconds: 0,
    enabled: false,
  },
  audioTransportReady: false,
  audioTransportError: null,
};

let hydrationPromise: Promise<void> | null = null;
let subscriptionPromise: Promise<void> | null = null;
let subscriptionReady = false;

export const useVideoEngineStore = create<VideoEngineStoreState>((set) => ({
  snapshot: DEFAULT_VIDEO_ENGINE_SNAPSHOT,
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

async function ensureVideoEngineHydration(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  const store = useVideoEngineStore.getState();
  store.setHydrationState('loading');
  store.setHydrationError(null);

  hydrationPromise = (async () => {
    const existingState = await getExplorerVideoEngineState();
    const snapshot = existingState.ready ? existingState : await prepareExplorerVideoEngine();
    useVideoEngineStore.getState().replaceSnapshot(snapshot);
    useVideoEngineStore.getState().setHydrationState('ready');
  })()
    .catch((error) => {
      useVideoEngineStore
        .getState()
        .setHydrationError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

async function ensureVideoEngineSubscription(): Promise<void> {
  if (!isTauri() || subscriptionReady) {
    return;
  }

  if (subscriptionPromise) {
    return subscriptionPromise;
  }

  const store = useVideoEngineStore.getState();
  store.setSubscriptionState('loading');
  store.setSubscriptionError(null);

  subscriptionPromise = listenToExplorerVideoEngineState((event) => {
    useVideoEngineStore.getState().replaceSnapshot(event.state);
  })
    .then(() => {
      subscriptionReady = true;
      useVideoEngineStore.getState().setSubscriptionState('ready');
    })
    .catch((error) => {
      useVideoEngineStore
        .getState()
        .setSubscriptionError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      subscriptionPromise = null;
    });

  return subscriptionPromise;
}

async function ensureVideoEngineFeedReady(): Promise<void> {
  await ensureVideoEngineHydration();
  await ensureVideoEngineSubscription();
}

export function useVideoEngineFeed(): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      void ensureVideoEngineFeedReady();
    }
  }, []);
}

export function useVideoEngineSnapshot(): ExplorerVideoEngineStateSnapshot {
  return useVideoEngineStore((state) => state.snapshot);
}

function commitVideoSnapshot(
  snapshot: ExplorerVideoEngineStateSnapshot,
): ExplorerVideoEngineStateSnapshot {
  useVideoEngineStore.getState().replaceSnapshot(snapshot);
  return snapshot;
}

export async function loadVideoSource(
  inputPath: string,
): Promise<ExplorerVideoEngineStateSnapshot> {
  return commitVideoSnapshot(await loadExplorerVideoSource({ inputPath }));
}

export async function playVideo(): Promise<ExplorerVideoEngineStateSnapshot> {
  return commitVideoSnapshot(await playExplorerVideo());
}

export async function pauseVideo(): Promise<ExplorerVideoEngineStateSnapshot> {
  return commitVideoSnapshot(await pauseExplorerVideo());
}

export async function stopVideo(): Promise<ExplorerVideoEngineStateSnapshot> {
  return commitVideoSnapshot(await stopExplorerVideo());
}

export async function seekVideo(
  positionSeconds: number,
): Promise<ExplorerVideoEngineStateSnapshot> {
  return commitVideoSnapshot(await seekExplorerVideo({ positionSeconds }));
}

export async function setVideoLoopRegion(
  startSeconds: number,
  endSeconds: number,
  enabled: boolean,
): Promise<ExplorerVideoEngineStateSnapshot> {
  return commitVideoSnapshot(
    await setExplorerVideoLoopRegion({
      startSeconds,
      endSeconds,
      enabled,
    }),
  );
}
