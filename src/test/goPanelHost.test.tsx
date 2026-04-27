import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const { buildGoRuntimePackageMock } = vi.hoisted(() => ({
  buildGoRuntimePackageMock: vi.fn(async () => ({
    runtimeId: 'sample-panel',
    artifactPath: '/tmp/sample-panel.wasm',
    artifactKind: 'sample-panel.wasm',
    cacheKey: 'fake-cache-key',
    cacheHit: true,
    toolchainVersion: '1.24.0',
    mode: 'release',
    target: 'js-wasm',
    sourceSignature: 'deadbeef',
    stdout: '',
    stderr: '',
  })),
}));

vi.mock('../runtime/goRuntimeBackend', () => ({
  buildGoRuntimePackage: buildGoRuntimePackageMock,
  callGoSidecarAction: vi.fn(),
}));

import { GoPanelHost, type GoPanelHostContext, type GoPanelHostEvent } from '../components/GoPanelHost';

function makeContext(): GoPanelHostContext {
  return {
    runtimeId: 'sample-panel',
    panelId: 'go-sample-panel',
    appearanceId: 'pilot-dark',
    densityToken: 'comfortable',
    cssVariables: { '--panel-bg': '#000' },
    assetUrls: {},
    size: { width: 360, height: 240 },
  };
}

const originalGo = (window as Window & { Go?: unknown }).Go;
const originalFetch = window.fetch;
const originalWebAssembly = (globalThis as { WebAssembly?: unknown }).WebAssembly;

class FakeGoInstance {
  importObject = {} as WebAssembly.Imports;
  argv: string[] = [];
  exit = vi.fn();
  run = vi.fn(async () => {
    // Simulate a long-running runtime: never resolve unless `exit` is called.
    await new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (this.exit.mock.calls.length > 0) {
          clearInterval(interval);
          resolve();
        }
      }, 5);
    });
  });
}

beforeEach(() => {
  buildGoRuntimePackageMock.mockClear();
  (window as unknown as { Go?: unknown }).Go = FakeGoInstance;
  window.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch;
  (globalThis as { WebAssembly: unknown }).WebAssembly = {
    instantiate: vi.fn(async () => ({ instance: { exports: {} } })),
  };
});

afterEach(() => {
  (window as Window & { Go?: unknown }).Go = originalGo;
  window.fetch = originalFetch;
  (globalThis as { WebAssembly?: unknown }).WebAssembly = originalWebAssembly;
});

describe('GoPanelHost', () => {
  it('mounts a wasm-panel runtime, emits a `ready` event, and exposes a host bridge token', async () => {
    const events: GoPanelHostEvent[] = [];
    const { unmount } = render(
      <GoPanelHost
        runtimeId="sample-panel"
        context={makeContext()}
        onEvent={event => events.push(event)}
      />,
    );

    await waitFor(() => {
      expect(buildGoRuntimePackageMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(events.some(event => event.kind === 'ready')).toBe(true);
    });

    const bridgeRegistry = (window as Window & { __greeblefsRuntimeHostBridge?: Record<string, unknown> })
      .__greeblefsRuntimeHostBridge;
    expect(bridgeRegistry, 'host bridge registry must be installed during mount').toBeDefined();
    expect(Object.keys(bridgeRegistry ?? {}).length).toBeGreaterThan(0);

    unmount();

    await waitFor(() => {
      const cleaned = (window as Window & { __greeblefsRuntimeHostBridge?: Record<string, unknown> })
        .__greeblefsRuntimeHostBridge;
      expect(Object.keys(cleaned ?? {}).length).toBe(0);
    });
  });

  it('renders an error fallback when the runtime build fails', async () => {
    buildGoRuntimePackageMock.mockRejectedValueOnce(new Error('toolchain missing'));

    const events: GoPanelHostEvent[] = [];
    const { findByRole } = render(
      <GoPanelHost
        runtimeId="sample-panel"
        context={makeContext()}
        onEvent={event => events.push(event)}
      />,
    );

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('toolchain missing');
    expect(events.some(event => event.kind === 'error')).toBe(true);
  });
});
