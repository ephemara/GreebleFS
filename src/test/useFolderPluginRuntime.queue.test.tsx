import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';

import * as explorerBackend from '../runtime/explorerBackend';
import { commands } from '../runtime/tauriClient';
import * as pluginPackages from '../config/pluginPackages';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import type { ExplorerFileEntry } from '../runtime/explorerBackend';

const directoryEntries = [
  {
    name: 'example-plugin.tsx',
    path: 'plugins/example-plugin.tsx',
    is_dir: false,
    extension: 'tsx',
    modified: 1711111111111,
  },
] as ExplorerFileEntry[];

const emptyDiscoveryResult: pluginPackages.OverlayPluginDiscoveryResult = {
  plugins: [],
  themePackages: [],
  shaders: [],
  fonts: [],
  commands: [],
  actionPacks: [],
  actions: [],
  explorerActions: [],
  explorerViews: [],
  explorerWidgets: [],
  contextMenuItems: [],
  previewLanes: [],
  settingsSlots: [],
  workflows: [],
  warnings: [],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('useFolderPluginRuntime queued refreshes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(commands, 'pluginWatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  it('reruns discovery after a forced refresh is queued during an in-flight scan', async () => {
    const listSpy = vi
      .spyOn(explorerBackend, 'listExplorerDir')
      .mockResolvedValue(directoryEntries);
    const discoverSpy = vi
      .spyOn(pluginPackages, 'discoverOverlayPlugins')
      .mockResolvedValue(emptyDiscoveryResult);

    const { result } = renderHook(() => useFolderPluginRuntime('windows'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(discoverSpy).toHaveBeenCalled();
    });

    listSpy.mockClear();
    discoverSpy.mockClear();

    const firstList = createDeferred<typeof directoryEntries>();
    const firstDiscovery = createDeferred<typeof emptyDiscoveryResult>();

    listSpy
      .mockImplementationOnce(() => firstList.promise)
      .mockResolvedValue(directoryEntries);
    discoverSpy
      .mockImplementationOnce(() => firstDiscovery.promise)
      .mockResolvedValue(emptyDiscoveryResult);

    await act(async () => {
      const firstRefresh = result.current.refreshFolderPlugins(true);
      const queuedRefresh = result.current.refreshFolderPlugins(true);
      firstList.resolve(directoryEntries);
      await Promise.resolve();
      firstDiscovery.resolve(emptyDiscoveryResult);
      await firstRefresh;
      await queuedRefresh;
    });

    await waitFor(() => {
      expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(discoverSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(discoverSpy.mock.calls.length);
    });
  });
});
