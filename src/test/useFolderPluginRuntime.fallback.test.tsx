import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';

import * as explorerBackend from '../runtime/explorerBackend';
import * as pluginPackages from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import { commands } from '../runtime/tauriClient';
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
  contextMenuItems: [],
  previewLanes: [],
  warnings: [],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
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

  it('falls back to polling without waiting for watcher cleanup to settle', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unwatchDeferred = createDeferred<{ status: 'ok'; data: null }>();
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));
    vi.spyOn(commands, 'pluginUnwatchDirectory').mockReturnValue(unwatchDeferred.promise);

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(unlisten).toHaveBeenCalled();
      expect(vi.mocked(commands.pluginUnwatchDirectory).mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);
    });

    await waitFor(() => {
      expect(vi.mocked(explorerBackend.listExplorerDir).mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    unwatchDeferred.resolve({ status: 'ok', data: null });
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
      expect(vi.mocked(explorerBackend.listExplorerDir).mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });
  });

  it('retries watcher cleanup on unmount after a cleanup failure', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));
    vi.spyOn(commands, 'pluginUnwatchDirectory')
      .mockRejectedValueOnce(new Error('cleanup failed'))
      .mockResolvedValueOnce({ status: 'ok', data: null });

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(unlisten).toHaveBeenCalled();
      expect(vi.mocked(commands.pluginUnwatchDirectory).mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher cleanup failed before fallback:',
        expect.any(Error),
      );
    });

    unmount();

    await waitFor(() => {
      expect(vi.mocked(commands.pluginUnwatchDirectory).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('retries watcher cleanup when unmount races an in-flight cleanup failure', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const firstCleanup = createDeferred<{ status: 'ok'; data: null }>();
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));
    vi.spyOn(commands, 'pluginUnwatchDirectory')
      .mockReturnValueOnce(firstCleanup.promise)
      .mockResolvedValueOnce({ status: 'ok', data: null });

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
      expect(unlisten).toHaveBeenCalled();
      expect(vi.mocked(commands.pluginUnwatchDirectory).mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    unmount();

    await act(async () => {
      firstCleanup.reject(new Error('cleanup failed'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher cleanup failed before fallback:',
        expect.any(Error),
      );
      expect(vi.mocked(commands.pluginUnwatchDirectory).mock.calls.length).toBeGreaterThanOrEqual(2);
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

    const callsBeforeUnmount = vi.mocked(explorerBackend.listExplorerDir).mock.calls.length;
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanMaxIntervalMs + 100);
    });

    expect(vi.mocked(explorerBackend.listExplorerDir).mock.calls.length).toBe(callsBeforeUnmount);
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

    const baselineCallCount = vi.mocked(explorerBackend.listExplorerDir).mock.calls.length;
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
        expect(vi.mocked(explorerBackend.listExplorerDir).mock.calls.length).toBeGreaterThanOrEqual(
          baselineCallCount + index + 1,
        );
      });
    }
  });
});
