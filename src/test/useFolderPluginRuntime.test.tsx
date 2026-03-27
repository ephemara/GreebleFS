import { act, renderHook, waitFor } from '@testing-library/react';
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(explorerBackend, 'listExplorerDir').mockResolvedValue(directoryEntries);
    vi.spyOn(pluginPackages, 'discoverOverlayPlugins').mockResolvedValue(emptyDiscoveryResult);
    vi.spyOn(commands, 'pluginWatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushPluginEffects() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it('registers the watcher and ignores debounced refreshes for ignored paths', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows'));
    await flushPluginEffects();

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
    await flushPluginEffects();

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

  it('treats watcher events without paths as refresh-worthy updates', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    renderHook(() => useFolderPluginRuntime('windows'));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    watchListener?.({
      payload: {
        paths: [],
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
    await flushPluginEffects();

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
    await flushPluginEffects();

    await waitFor(() => {
      expect(commands.pluginWatchDirectory).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalled();
      expect(commands.pluginUnwatchDirectory).toHaveBeenCalled();
    });
  });

  it('skips plugin rediscovery when the watched directory signature is unchanged', async () => {
    const { result } = renderHook(() => useFolderPluginRuntime('windows'));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });
    vi.mocked(explorerBackend.listExplorerDir).mockClear();
    vi.mocked(pluginPackages.discoverOverlayPlugins).mockClear();

    await act(async () => {
      await result.current.refreshFolderPlugins();
    });

    expect(explorerBackend.listExplorerDir).toHaveBeenCalled();
    expect(pluginPackages.discoverOverlayPlugins).not.toHaveBeenCalled();
  });
});
