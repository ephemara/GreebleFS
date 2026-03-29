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

  it('falls back to polling when native watch registration fails after the event listener starts', async () => {
    const unlisten = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(listen).mockResolvedValue(unlisten);
    vi.spyOn(commands, 'pluginWatchDirectory').mockRejectedValue(new Error('watch unavailable'));

    const { unmount } = renderHook(() => useFolderPluginRuntime('windows'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Plugin watcher unavailable, falling back to polling:',
        expect.any(Error),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(pluginSystemConfig.fallbackScanIntervalMs + 10);
    });

    await waitFor(() => {
      expect(pluginPackages.discoverOverlayPlugins).toHaveBeenCalledTimes(2);
    });

    unmount();
  });
});
