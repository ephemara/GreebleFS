import { emit } from '@tauri-apps/api/event';
import { describe, expect, it, vi } from 'vitest';

import {
  PLUGIN_PANEL_OPEN_REQUEST_EVENT,
  createPluginPanelOpenRequest,
  getPluginPanelOpenRequestStorageKey,
  readPluginPanelOpenRequest,
  requestPluginPanelOpen,
  requestPluginPanelWindowDock,
  requestPluginPanelWindowOpen,
} from '../runtime/pluginPanelRequests';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('pluginPanelRequests', () => {
  it('creates normalized plugin panel open requests', () => {
    const request = createPluginPanelOpenRequest('  sketchfab  ', {
      destinationPath: ' /tmp/assets ',
    }, 'plugin-context-menu');

    expect(request?.panelId).toBe('sketchfab');
    expect(request?.payload).toEqual({ destinationPath: '/tmp/assets' });
    expect(request?.presentation).toBe('docked');
    expect(request?.source).toBe('plugin-context-menu');
    expect(request?.nonce).toBeTruthy();
  });

  it('persists and dispatches plugin panel open requests', () => {
    const storage = createMemoryStorage();
    const dispatchEvent = vi.fn();

    const request = requestPluginPanelOpen('sketchfab', {
      destinationPath: ' /tmp/library ',
    }, {
      storage,
      source: 'plugin-context-menu',
      target: { dispatchEvent },
    });

    expect(request?.panelId).toBe('sketchfab');
    expect(request?.presentation).toBe('docked');
    expect(readPluginPanelOpenRequest('sketchfab', storage)?.payload.destinationPath).toBe('/tmp/library');
    expect(readPluginPanelOpenRequest('sketchfab', storage)?.presentation).toBe('docked');
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect((dispatchEvent.mock.calls[0]?.[0] as CustomEvent).type).toBe(PLUGIN_PANEL_OPEN_REQUEST_EVENT);
    expect((dispatchEvent.mock.calls[1]?.[0] as CustomEvent).type).toContain('sketchfab');
    expect(vi.mocked(emit)).toHaveBeenCalledWith(
      PLUGIN_PANEL_OPEN_REQUEST_EVENT,
      expect.objectContaining({ panelId: 'sketchfab', presentation: 'docked' }),
    );
  });

  it('returns null for malformed persisted plugin panel requests', () => {
    const storage = createMemoryStorage();
    storage.setItem(getPluginPanelOpenRequestStorageKey('sketchfab'), '{"panelId":"","payload":{}}');

    expect(readPluginPanelOpenRequest('sketchfab', storage)).toBeNull();
  });

  it('supports explicit native-window and dock-window plugin panel presentations', () => {
    const openRequest = requestPluginPanelWindowOpen('sketchfab', { mode: 'preview' }, {
      storage: createMemoryStorage(),
      target: { dispatchEvent: vi.fn() },
    });
    const dockRequest = requestPluginPanelWindowDock('sketchfab', {}, {
      storage: createMemoryStorage(),
      target: { dispatchEvent: vi.fn() },
    });

    expect(openRequest?.presentation).toBe('native-window');
    expect(dockRequest?.presentation).toBe('dock-window');
  });
});
