import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import type { AccelerationRuntimeStatusSnapshot } from '../generated/tauri';
import {
  getAccelerationRuntimeStatus,
  type ManagedAccelerationRuntimeRequest,
} from '../runtime/accelerationRuntimeBackend';

type AccelerationRuntimeStoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AccelerationRuntimeStoreState {
  snapshot: AccelerationRuntimeStatusSnapshot;
  hydrationState: AccelerationRuntimeStoreStatus;
  hydrationError: string | null;
  replaceSnapshot: (snapshot: AccelerationRuntimeStatusSnapshot) => void;
  setHydrationState: (state: AccelerationRuntimeStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
}

const DEFAULT_ACCELERATION_RUNTIME_SNAPSHOT: AccelerationRuntimeStatusSnapshot = {
  routingMode: 'auto',
  lastRefreshedAtEpochMs: 0,
  nativeGpu: {
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
  },
  pythonSidecarRunning: false,
  pythonSidecarActionAvailable: false,
  pythonProbeAttempted: false,
  pythonProbeError: null,
  pythonProbe: null,
  providers: [],
};

let hydrationPromise: Promise<void> | null = null;
let lastHydratedRequestSignature = '';

export const useAccelerationRuntimeStore = create<AccelerationRuntimeStoreState>((set) => ({
  snapshot: DEFAULT_ACCELERATION_RUNTIME_SNAPSHOT,
  hydrationState: 'idle',
  hydrationError: null,
  replaceSnapshot: (snapshot) => set({ snapshot }),
  setHydrationState: (hydrationState) => set({ hydrationState }),
  setHydrationError: (hydrationError) => set({
    hydrationError,
    hydrationState: hydrationError ? 'error' : 'ready',
  }),
}));

function buildRequestSignature(request: ManagedAccelerationRuntimeRequest): string {
  return JSON.stringify({
    routingMode: request.routingMode,
    startSidecarIfNeeded: request.startSidecarIfNeeded ?? false,
    config: request.config ?? null,
  });
}

async function hydrateAccelerationRuntime(
  request: ManagedAccelerationRuntimeRequest,
): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const requestSignature = buildRequestSignature(request);
  if (
    hydrationPromise
    && requestSignature === lastHydratedRequestSignature
  ) {
    return hydrationPromise;
  }

  lastHydratedRequestSignature = requestSignature;
  const store = useAccelerationRuntimeStore.getState();
  store.setHydrationState('loading');
  store.setHydrationError(null);

  hydrationPromise = getAccelerationRuntimeStatus(request)
    .then((snapshot) => {
      useAccelerationRuntimeStore.getState().replaceSnapshot(snapshot);
      useAccelerationRuntimeStore.getState().setHydrationState('ready');
    })
    .catch((error) => {
      useAccelerationRuntimeStore
        .getState()
        .setHydrationError(error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      hydrationPromise = null;
    });

  return hydrationPromise;
}

export async function refreshAccelerationRuntimeStatus(
  request: ManagedAccelerationRuntimeRequest,
): Promise<AccelerationRuntimeStatusSnapshot> {
  const snapshot = await getAccelerationRuntimeStatus(request);
  useAccelerationRuntimeStore.getState().replaceSnapshot(snapshot);
  useAccelerationRuntimeStore.getState().setHydrationState('ready');
  useAccelerationRuntimeStore.getState().setHydrationError(null);
  lastHydratedRequestSignature = buildRequestSignature(request);
  return snapshot;
}

export function useAccelerationRuntimeFeed(
  request: ManagedAccelerationRuntimeRequest,
): void {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      void hydrateAccelerationRuntime(request);
    }
  }, [
    request.routingMode,
    request.startSidecarIfNeeded,
    request.config?.preferredInterpreterPath,
    request.config?.runtimeRoot,
    request.config?.bootstrapPackages,
    request.config?.autoUpgradePip,
    request.config?.createBoilerplate,
  ]);
}
