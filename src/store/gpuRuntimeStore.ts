import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import type { GpuRuntimeStatusSnapshot } from '../generated/tauri';
import { getGpuRuntimeStatus, configureGpuRuntime, listenToGpuRuntimeStatus } from '../runtime/gpuRuntimeBackend';
import type { GpuTierMode } from '../config/gpuRuntime';

type GpuRuntimeStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface GpuRuntimeStoreState {
  snapshot: GpuRuntimeStatusSnapshot;
  hydrationState: GpuRuntimeStoreStatus;
  hydrationError: string | null;
  subscriptionState: GpuRuntimeStoreStatus;
  subscriptionError: string | null;
  replaceSnapshot: (snapshot: GpuRuntimeStatusSnapshot) => void;
  setHydrationState: (state: GpuRuntimeStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
  setSubscriptionState: (state: GpuRuntimeStoreStatus) => void;
  setSubscriptionError: (message: string | null) => void;
}

const DEFAULT_GPU_RUNTIME_SNAPSHOT: GpuRuntimeStatusSnapshot = {
  configuredMode: 'auto',
  effectiveTier: 'safe',
  adapterName: null,
  adapterType: null,
  backendName: null,
  softwareRenderer: false,
  computeAvailable: false,
  queueDepth: 0,
  runtimeError: null,
  workloads: [],
};

let hydrationPromise: Promise<void> | null = null;
let subscriptionPromise: Promise<void> | null = null;
let subscriptionReady = false;
let lastConfiguredMode: GpuTierMode | null = null;

function formatGpuRuntimeStoreError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isGpuRuntimeBridgeUnavailableError(error: unknown): boolean {
  const message = formatGpuRuntimeStoreError(error);
  return (
    message.includes("Cannot read properties of undefined (reading 'invoke')") ||
    message.includes("Cannot read properties of undefined (reading 'listen')") ||
    message.includes("Cannot read properties of undefined (reading 'metadata')")
  );
}

export const useGpuRuntimeStore = create<GpuRuntimeStoreState>((set) => ({
  snapshot: DEFAULT_GPU_RUNTIME_SNAPSHOT,
  hydrationState: 'idle',
  hydrationError: null,
  subscriptionState: 'idle',
  subscriptionError: null,
  replaceSnapshot: (snapshot) => set({ snapshot }),
  setHydrationState: (hydrationState) => set({ hydrationState }),
  setHydrationError: (hydrationError) => set({
    hydrationError,
    hydrationState: hydrationError ? 'error' : 'ready',
  }),
  setSubscriptionState: (subscriptionState) => set({ subscriptionState }),
  setSubscriptionError: (subscriptionError) => set({
    subscriptionError,
    subscriptionState: subscriptionError ? 'error' : 'ready',
  }),
}));

async function hydrateGpuRuntimeStatus(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  if (hydrationPromise) {
    return hydrationPromise;
  }

  const store = useGpuRuntimeStore.getState();
  store.setHydrationState('loading');
  store.setHydrationError(null);

  hydrationPromise = getGpuRuntimeStatus()
    .then((snapshot) => {
      useGpuRuntimeStore.getState().replaceSnapshot(snapshot);
      useGpuRuntimeStore.getState().setHydrationState('ready');
    })
    .catch((error) => {
      const state = useGpuRuntimeStore.getState();
      if (isGpuRuntimeBridgeUnavailableError(error)) {
        state.setHydrationError(null);
        state.setHydrationState('ready');
        return;
      }
      state.setHydrationError(formatGpuRuntimeStoreError(error));
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

async function ensureGpuRuntimeSubscription(): Promise<void> {
  if (!isTauri() || subscriptionReady) {
    return;
  }

  if (subscriptionPromise) {
    return subscriptionPromise;
  }

  const store = useGpuRuntimeStore.getState();
  store.setSubscriptionState('loading');
  store.setSubscriptionError(null);

  subscriptionPromise = listenToGpuRuntimeStatus((event) => {
    useGpuRuntimeStore.getState().replaceSnapshot(event.state);
  })
    .then(() => {
      subscriptionReady = true;
      useGpuRuntimeStore.getState().setSubscriptionState('ready');
    })
    .catch((error) => {
      const state = useGpuRuntimeStore.getState();
      if (isGpuRuntimeBridgeUnavailableError(error)) {
        subscriptionReady = true;
        state.setSubscriptionError(null);
        state.setSubscriptionState('ready');
        return;
      }
      state.setSubscriptionError(formatGpuRuntimeStoreError(error));
    })
    .finally(() => {
      subscriptionPromise = null;
    });

  return subscriptionPromise;
}

export async function applyGpuRuntimeMode(mode: GpuTierMode): Promise<GpuRuntimeStatusSnapshot> {
  const snapshot = await configureGpuRuntime(mode);
  lastConfiguredMode = mode;
  useGpuRuntimeStore.getState().replaceSnapshot(snapshot);
  useGpuRuntimeStore.getState().setHydrationState('ready');
  return snapshot;
}

async function ensureGpuRuntimeFeed(mode: GpuTierMode): Promise<void> {
  await hydrateGpuRuntimeStatus();
  await ensureGpuRuntimeSubscription();

  const snapshot = useGpuRuntimeStore.getState().snapshot;
  if (lastConfiguredMode === mode && snapshot.configuredMode === mode) {
    return;
  }

  await applyGpuRuntimeMode(mode);
}

export function useGpuRuntimeFeed(mode: GpuTierMode): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      void ensureGpuRuntimeFeed(mode).catch((error) => {
        if (isGpuRuntimeBridgeUnavailableError(error)) {
          useGpuRuntimeStore.getState().setHydrationError(null);
          useGpuRuntimeStore.getState().setHydrationState('ready');
          return;
        }
        useGpuRuntimeStore.getState().setHydrationError(formatGpuRuntimeStoreError(error));
      });
    }
  }, [mode]);
}
