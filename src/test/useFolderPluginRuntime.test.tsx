import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import { pluginSystemConfig } from '../config/plugins';
import { commands } from '../runtime/tauriClient';
import * as pluginPackages from '../config/pluginPackages';
import * as explorerBackend from '../runtime/explorerBackend';

const directoryEntries = [
  {
    name: 'example-plugin.tsx',
    path: 'plugins/example-plugin.tsx',
    is_dir: false,
    extension: 'tsx',
    modified: 1711111111111,
  },
];

const emptyDiscoveryResult: pluginPackages.OverlayPluginDiscoveryResult = {
  plugins: [],
  themePackages: [],
  shaders: [],
  fonts: [],
  commands: [],
  explorerActions: [],
  warnings: [],
};

describe('useFolderPluginRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(explorerBackend, 'listExplorerDir').mockResolvedValue(directoryEntries);
    vi.spyOn(pluginPackages, 'discoverOverlayPlugins').mockResolvedValue(emptyDiscoveryResult);
    vi.spyOn(commands, 'pluginWatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the watcher and ignores debounced refreshes for ignored paths', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows'));

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(commands.pluginWatchDirectory).toHaveBeenCalledWith(
        pluginSystemConfig.pluginsDirectory,
        [...pluginSystemConfig.ignoredWatchDirectoryNames],
      );
    });

    watchListener?.({
      payload: {
        paths: ['plugins/node_modules/example-plugin/dist/index.js'],
      },
    });

    await vi.advanceTimersByTimeAsync(pluginSystemConfig.watchDebounceMs + 10);

    expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('forces a debounced refresh when a relevant watch event arrives', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    renderHook(() => useFolderPluginRuntime('windows'));

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    watchListener?.({
      payload: {
        paths: ['plugins/example-plugin.tsx'],
      },
    });

    await vi.advanceTimersByTimeAsync(pluginSystemConfig.watchDebounceMs + 10);

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(2);
    });
  });

  it('falls back to polling when watcher startup fails', async () => {
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValueOnce(new Error('watch unavailable'));

    renderHook(() => useFolderPluginRuntime('windows'));

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(2);
    });
  });

  it('cleans up the listener and unwatches the directory on unmount', async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows'));

    await waitFor(() => {
      expect(commands.pluginWatchDirectory).toHaveBeenCalledTimes(1);
    });

    unmount();

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalledTimes(1);
      expect(commands.pluginUnwatchDirectory).toHaveBeenCalled();
    });
  });
});
