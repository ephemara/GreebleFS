import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import { pluginSystemConfig } from '../config/plugins';
import { commands } from '../runtime/tauriClient';
import * as pluginPackages from '../config/pluginPackages';
import * as explorerBackend from '../runtime/explorerBackend';
import type { ExplorerFileEntry } from '../runtime/explorerBackend';
import { useSettingsStore } from '../store/settingsStore';

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
  settingsSlots: [],
  warnings: [],
};

describe('useFolderPluginRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useSettingsStore.getState().resetToDefaults();
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

  it('defaults to manual refresh mode when live reload is disabled', async () => {
    renderHook(() => useFolderPluginRuntime('windows'));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    expect(listen).not.toHaveBeenCalled();
    expect(commands.pluginWatchDirectory).not.toHaveBeenCalled();
  });

  it('registers the watcher and ignores debounced refreshes for ignored paths', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
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

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
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

  it('coalesces multiple relevant watch events into one debounced refresh', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    watchListener?.({
      payload: {
        paths: ['plugins/example-plugin.tsx'],
      },
    });
    watchListener?.({
      payload: {
        paths: ['plugins/example-plugin/src/runtime.ts'],
      },
    });

    await vi.advanceTimersByTimeAsync(pluginSystemConfig.watchDebounceMs - 50);
    expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60);

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes when watcher payloads mix ignored and relevant paths', async () => {
    let watchListener: ((event: { payload: { paths: string[] } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(async (_eventName, handler) => {
      watchListener = handler as typeof watchListener;
      return () => {};
    });

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    watchListener?.({
      payload: {
        paths: [
          'plugins/node_modules/example-plugin/dist/index.js',
          'plugins/example-plugin.tsx',
        ],
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

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
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

  it('keeps initial discovery running when watcher startup fails', async () => {
    vi.mocked(listen).mockRejectedValueOnce(new Error('listen unavailable'));

    renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });
  });

  it('does not start fallback polling after unmount when watcher startup fails late', async () => {
    const watchFailure = new Error('watch unavailable');
    let rejectWatch: ((error: Error) => void) | undefined;
    vi.mocked(commands.pluginWatchDirectory).mockImplementationOnce(
      () => new Promise((_resolve, reject) => {
        rejectWatch = reject as (error: Error) => void;
      }),
    );

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
    await flushPluginEffects();

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    unmount();

    await act(async () => {
      rejectWatch?.(watchFailure);
      await Promise.resolve();
    });

    await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);

    expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
  });

  it('cleans up the listener and unwatches the directory on unmount', async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows', { liveReloadEnabled: true }));
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

  it('binds a plugin-scoped settings controller into the plugin api', async () => {
    const { result } = renderHook(() => useFolderPluginRuntime('windows'));
    await flushPluginEffects();

    const api = result.current.createPluginApi({
      id: 'notes-tools',
      name: 'Notes Tools',
      filePath: 'plugins/notes-tools/index.tsx',
      pluginRoot: pluginSystemConfig.pluginsDirectory,
      pluginDirectory: 'plugins/notes-tools',
      backendDirectory: 'plugins/notes-tools/backend',
    });

    act(() => {
      api.settings?.setValue('density', 'compact');
      api.settings?.patchValues({
        autoWrap: true,
      });
    });

    expect(api.settings?.pluginId).toBe('notes-tools');
    expect(api.settings?.getStoredValues()).toEqual({
      density: 'compact',
      autoWrap: true,
    });
    expect(
      useSettingsStore.getState().settings.plugins.valuesByPluginId['notes-tools'],
    ).toEqual({
      density: 'compact',
      autoWrap: true,
    });
  });
});
