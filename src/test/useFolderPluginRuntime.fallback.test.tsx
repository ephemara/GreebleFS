import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';

import * as explorerBackend from '../runtime/explorerBackend';
import * as pluginPackages from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import { commands } from '../runtime/tauriClient';

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe('useFolderPluginRuntime fallback polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(explorerBackend, 'listExplorerDir').mockResolvedValue(directoryEntries);
    vi.spyOn(pluginPackages, 'discoverOverlayPlugins').mockResolvedValue(emptyDiscoveryResult);
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to polling only after failed watcher cleanup finishes', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unwatchDeferred = createDeferred<{ status: 'ok'; data: null }>();
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockReturnValue(unwatchDeferred.promise);

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(unlisten).toHaveBeenCalled();
      expect(commands.pluginUnwatchDirectory).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);
    });

    expect(explorerBackend.listExplorerDir).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalledWith(
      'Plugin watcher unavailable, falling back to polling:',
      expect.any(Error),
    );

    unwatchDeferred.resolve({ status: 'ok', data: null });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);
    });

    await waitFor(() => {
      expect(explorerBackend.listExplorerDir).toHaveBeenCalledTimes(2);
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    unmount();
  });

  it('falls back to polling even if watcher cleanup fails', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockRejectedValue(new Error('cleanup failed'));

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(unlisten).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher cleanup failed before fallback:',
        expect.any(Error),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);
    });

    await waitFor(() => {
      expect(explorerBackend.listExplorerDir).toHaveBeenCalledTimes(2);
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });
  });

  it('clears the fallback polling loop on unmount before the next scan fires', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanMaxIntervalMs + 100);
    });

    expect(explorerBackend.listExplorerDir).toHaveBeenCalledTimes(1);
    expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalled();
    expect(commands.pluginUnwatchDirectory).toHaveBeenCalled();
  });

  it('caps fallback polling at the configured maximum interval', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listen).mockResolvedValue(() => {});
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    const expectedCallCounts = [2, 3, 4, 5, 6];
    const pollingIntervals = [
      pluginSystemConfig.fallbackScanIntervalMs,
      pluginSystemConfig.fallbackScanIntervalMs * 2,
      pluginSystemConfig.fallbackScanIntervalMs * 4,
      pluginSystemConfig.fallbackScanMaxIntervalMs,
      pluginSystemConfig.fallbackScanMaxIntervalMs,
    ];

    for (let index = 0; index < pollingIntervals.length; index += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(pollingIntervals[index]);
      });

      await waitFor(() => {
        expect(explorerBackend.listExplorerDir).toHaveBeenCalledTimes(expectedCallCounts[index]);
      });
    }
  });
});
