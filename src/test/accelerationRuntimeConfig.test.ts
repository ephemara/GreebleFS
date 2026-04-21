import { describe, expect, it } from 'vitest';
import {
  getAccelerationRoutingModeLabel,
  resolveAccelerationProviderForWorkload,
} from '../config/accelerationRuntime';

describe('accelerationRuntime config', () => {
  it('prefers CUDA for AI indexing when the CUDA provider is ready', () => {
    const resolution = resolveAccelerationProviderForWorkload({
      providers: [
        {
          providerKind: 'cpu',
          label: 'CPU Fallback',
          available: true,
          ready: true,
          supportedWorkloadIds: ['aiIndexing', 'localInference'],
        },
        {
          providerKind: 'cudaPython',
          label: 'CUDA Python Sidecar',
          available: true,
          ready: true,
          supportedWorkloadIds: ['aiIndexing', 'localInference', 'similaritySearch'],
        },
      ],
    }, 'aiIndexing', 'auto');

    expect(resolution.providerKind).toBe('cudaPython');
    expect(resolution.ready).toBe(true);
  });

  it('forces CPU routing in cpuOnly mode', () => {
    const resolution = resolveAccelerationProviderForWorkload({
      providers: [
        {
          providerKind: 'cpu',
          label: 'CPU Fallback',
          available: true,
          ready: true,
          supportedWorkloadIds: ['thumbnails'],
        },
        {
          providerKind: 'wgpu',
          label: 'Native WGPU',
          available: true,
          ready: true,
          supportedWorkloadIds: ['thumbnails'],
        },
      ],
    }, 'thumbnails', 'cpuOnly');

    expect(resolution.providerKind).toBe('cpu');
  });

  it('returns a readable label for routing modes', () => {
    expect(getAccelerationRoutingModeLabel('preferCuda')).toBe('Prefer CUDA');
  });
});
