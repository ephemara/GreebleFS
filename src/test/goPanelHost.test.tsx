import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const { buildGoRuntimePackageMock, callGoSidecarActionMock } = vi.hoisted(() => ({
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
  callGoSidecarActionMock: vi.fn(async ({ actionId }: { actionId: string }) => ({
    runtimeId: 'peer-sidecar',
    actionId,
    result: { ok: true, fromPeer: true },
  })),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(async () => new Uint8Array(8)),
}));

vi.mock('../runtime/goRuntimeBackend', () => ({
  buildGoRuntimePackage: buildGoRuntimePackageMock,
  callGoSidecarAction: callGoSidecarActionMock,
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
  callGoSidecarActionMock.mockClear();
  if (typeof window !== 'undefined') {
    delete (window as Window & { __greeblefsRuntimeHostBridge?: unknown }).__greeblefsRuntimeHostBridge;
  }
  (window as unknown as { Go?: unknown }).Go = FakeGoInstance;
  (globalThis as { WebAssembly: unknown }).WebAssembly = {
    instantiate: vi.fn(async () => ({ instance: { exports: {} } })),
  };
});

afterEach(() => {
  (window as Window & { Go?: unknown }).Go = originalGo;
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

  it('mounts two panels for the same runtime id with disambiguated bridge tokens', async () => {
    const { container, unmount } = render(
      <div>
        <GoPanelHost runtimeId="sample-panel" context={makeContext()} />
        <GoPanelHost runtimeId="sample-panel" context={makeContext()} />
      </div>,
    );

    await waitFor(() => {
      const tokens = Array.from(
        container.querySelectorAll<HTMLElement>('[data-runtime-id="sample-panel"]'),
      )
        .map(el => el.getAttribute('data-bridge-token'))
        .filter((token): token is string => Boolean(token));
      expect(tokens.length).toBe(2);
      expect(new Set(tokens).size).toBe(2);
    });

    const registry = (window as Window & {
      __greeblefsRuntimeHostBridge?: Record<string, unknown>;
    }).__greeblefsRuntimeHostBridge;
    expect(Object.keys(registry ?? {}).length).toBe(2);

    unmount();
  });

  it('rejects callRuntimeAction targeting the panel\'s own runtime id', async () => {
    render(<GoPanelHost runtimeId="sample-panel" context={makeContext()} />);

    await waitFor(() => {
      const registry = (window as Window & {
        __greeblefsRuntimeHostBridge?: Record<string, { bridge: { callRuntimeAction: Function } }>;
      }).__greeblefsRuntimeHostBridge;
      expect(registry && Object.keys(registry).length).toBeGreaterThan(0);
    });

    const registry = (window as Window & {
      __greeblefsRuntimeHostBridge?: Record<
        string,
        { bridge: { callRuntimeAction: (id: string, action: string) => Promise<unknown> } }
      >;
    }).__greeblefsRuntimeHostBridge!;
    const entry = Object.values(registry)[0]!;

    await expect(entry.bridge.callRuntimeAction('sample-panel', 'noop')).rejects.toThrow(
      /cannot call their own actions/i,
    );
    expect(callGoSidecarActionMock).not.toHaveBeenCalled();
  });

  it('routes a peer-targeted callRuntimeAction through the sidecar backend', async () => {
    render(<GoPanelHost runtimeId="sample-panel" context={makeContext()} />);

    await waitFor(() => {
      const registry = (window as Window & {
        __greeblefsRuntimeHostBridge?: Record<string, unknown>;
      }).__greeblefsRuntimeHostBridge;
      expect(registry && Object.keys(registry).length).toBeGreaterThan(0);
    });

    const registry = (window as Window & {
      __greeblefsRuntimeHostBridge?: Record<
        string,
        {
          bridge: {
            callRuntimeAction: <T>(id: string, action: string, payload?: unknown) => Promise<T>;
          };
        }
      >;
    }).__greeblefsRuntimeHostBridge!;
    const entry = Object.values(registry)[0]!;

    const result = await entry.bridge.callRuntimeAction<{ ok: boolean; fromPeer: boolean }>(
      'peer-sidecar',
      'do.work',
      { input: 7 },
    );
    expect(result).toEqual({ ok: true, fromPeer: true });
    expect(callGoSidecarActionMock).toHaveBeenCalledTimes(1);
    expect(callGoSidecarActionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        runtimeId: 'peer-sidecar',
        actionId: 'do.work',
        payload: { input: 7 },
      }),
    );
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
