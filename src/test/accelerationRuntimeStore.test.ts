import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runtime/accelerationRuntimeBackend', () => ({
  getAccelerationRuntimeStatus: vi.fn(),
}));

import { getAccelerationRuntimeStatus } from '../runtime/accelerationRuntimeBackend';
import type { ManagedAccelerationRuntimeStatusSnapshot } from '../runtime/accelerationRuntimeBackend';
import {
  refreshAccelerationRuntimeStatus,
  useAccelerationRuntimeStore,
} from '../store/accelerationRuntimeStore';

const DEFAULT_SNAPSHOT = {
  routingMode: 'auto' as const,
  lastRefreshedAtEpochMs: 1,
  nativeGpu: {
    configuredMode: 'auto' as const,
    effectiveTier: 'safe' as const,
    adapterName: null,
    adapterType: null,
    backendName: null,
    softwareRenderer: false,
    computeAvailable: false,
    queueDepth: 0,
    runtimeError: null,
    workloads: [],
  },
  pythonSidecarRunning: true,
  pythonSidecarActionAvailable: true,
  pythonProbeAttempted: true,
  pythonProbeError: null,
  pythonProbe: null,
  providers: [
    {
      providerKind: 'cpu' as const,
      label: 'CPU Fallback',
      origin: 'native',
      available: true,
      ready: true,
      detail: 'fallback',
      supportedWorkloadIds: ['thumbnails' as const],
    },
  ],
} satisfies ManagedAccelerationRuntimeStatusSnapshot;

describe('accelerationRuntimeStore', () => {
  beforeEach(() => {
    vi.mocked(getAccelerationRuntimeStatus).mockReset();
    useAccelerationRuntimeStore.setState({
      snapshot: DEFAULT_SNAPSHOT,
      hydrationState: 'idle',
      hydrationError: null,
    });
  });

  it('commits refreshed acceleration snapshots into the store', async () => {
    vi.mocked(getAccelerationRuntimeStatus).mockResolvedValue({
      ...DEFAULT_SNAPSHOT,
      routingMode: 'preferCuda',
      providers: [
        ...DEFAULT_SNAPSHOT.providers,
        {
          providerKind: 'cudaPython',
          label: 'CUDA Python Sidecar',
          origin: 'python-sidecar',
          available: true,
          ready: true,
          detail: 'cuda ready',
          supportedWorkloadIds: ['aiIndexing' as const],
        },
      ],
    });

    await refreshAccelerationRuntimeStatus({
      config: null,
      routingMode: 'preferCuda',
      startSidecarIfNeeded: true,
    });

    expect(useAccelerationRuntimeStore.getState().snapshot.routingMode).toBe('preferCuda');
    expect(useAccelerationRuntimeStore.getState().snapshot.providers).toHaveLength(2);
    expect(useAccelerationRuntimeStore.getState().hydrationState).toBe('ready');
  });
});
