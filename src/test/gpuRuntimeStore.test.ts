import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runtime/gpuRuntimeBackend', () => ({
  configureGpuRuntime: vi.fn(),
  getGpuRuntimeStatus: vi.fn(),
  listenToGpuRuntimeStatus: vi.fn(),
}));

import { configureGpuRuntime } from '../runtime/gpuRuntimeBackend';
import { applyGpuRuntimeMode, useGpuRuntimeStore } from '../store/gpuRuntimeStore';

const DEFAULT_SNAPSHOT = {
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
};

describe('gpuRuntimeStore', () => {
  beforeEach(() => {
    vi.mocked(configureGpuRuntime).mockReset();
    useGpuRuntimeStore.setState({
      snapshot: DEFAULT_SNAPSHOT,
      hydrationState: 'idle',
      hydrationError: null,
      subscriptionState: 'idle',
      subscriptionError: null,
    });
  });

  it('commits the configured runtime snapshot into the store', async () => {
    vi.mocked(configureGpuRuntime).mockResolvedValue({
      configuredMode: 'integrated',
      effectiveTier: 'integrated',
      adapterName: 'Test iGPU',
      adapterType: 'integrated-gpu',
      backendName: 'Vulkan',
      softwareRenderer: false,
      computeAvailable: true,
      queueDepth: 0,
      runtimeError: null,
      workloads: [],
    });

    await applyGpuRuntimeMode('integrated');

    expect(useGpuRuntimeStore.getState().snapshot.configuredMode).toBe('integrated');
    expect(useGpuRuntimeStore.getState().snapshot.effectiveTier).toBe('integrated');
    expect(useGpuRuntimeStore.getState().snapshot.adapterName).toBe('Test iGPU');
    expect(useGpuRuntimeStore.getState().hydrationState).toBe('ready');
  });
});
