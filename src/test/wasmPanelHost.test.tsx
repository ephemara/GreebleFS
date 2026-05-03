import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => path,
}));

vi.mock('../runtime/externalRuntimeBackend', () => ({
  callRuntimeAction: vi.fn(),
  getRuntimePackage: vi.fn(async () => null),
  prepareRuntimePackage: vi.fn(),
  readRuntimeArtifactBytes: vi.fn(),
}));

vi.mock('../runtime/extensionHostApi', () => ({
  createExtensionHostClient: () => ({
    call: vi.fn(async () => null),
    events: {
      subscribe: vi.fn(async () => ({
        subscription: { subscriptionId: 'test-subscription' },
        unsubscribe: vi.fn(),
      })),
      unsubscribe: vi.fn(async () => null),
    },
  }),
}));

import { WasmPanelHost, type WasmPanelHostContext } from '../components/WasmPanelHost';
import { getRuntimePackage } from '../runtime/externalRuntimeBackend';

function createContext(runtimeId: string): WasmPanelHostContext {
  return {
    runtimeId,
    panelId: 'test-panel',
    appearanceId: 'default',
    densityToken: 'dense',
    cssVariables: {},
    assetUrls: {},
    size: { width: 320, height: 180 },
  };
}

describe('WasmPanelHost', () => {
  it('does not reboot the runtime when only the onEvent callback identity changes', async () => {
    const runtimeId = `missing-runtime-${Date.now()}`;
    const firstOnEvent = vi.fn();
    const secondOnEvent = vi.fn();

    const { rerender } = render(
      <WasmPanelHost
        runtimeId={runtimeId}
        context={createContext(runtimeId)}
        onEvent={firstOnEvent}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        `runtime package ${runtimeId} could not be resolved`,
      );
    });

    rerender(
      <WasmPanelHost
        runtimeId={runtimeId}
        context={createContext(runtimeId)}
        onEvent={secondOnEvent}
      />,
    );

    await new Promise((resolve) => window.setTimeout(resolve, 20));

    expect(getRuntimePackage).toHaveBeenCalledTimes(1);
    expect(secondOnEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error' }),
    );
  });
});
