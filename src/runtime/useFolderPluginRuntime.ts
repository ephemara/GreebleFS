import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as TauriNotification from '@tauri-apps/plugin-notification';
import * as TauriWindow from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  getPluginStorageDirectory,
  pluginSystemConfig,
  shouldRefreshForPluginWatchPaths,
} from '../config/plugins';
import * as pluginPackages from '../config/pluginPackages';
import {
  isFrontendPluginFile,
  type LoadedOverlayPlugin,
  type OverlayPluginApi,
  type OverlayPluginContext,
} from '../components/pluginRuntime';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import type { LoadedOverlayShader } from '../components/shaderRuntime';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import { getPlatformPathSeparator, joinPlatformPath, type RuntimePlatform } from '../config/platform';
import type { OverlayRegisteredFontContribution } from '../config/appearance';
import * as explorerBackend from './explorerBackend';
import type { PluginDirectoryWatchEvent } from '../generated/tauri';
import { ensureDir, getParentPath } from './overlayRuntimeUtils';
import { commands, unwrapTauriResult } from './tauriClient';

export interface UseFolderPluginRuntimeResult {
  folderPlugins: LoadedOverlayPlugin[];
  pluginContributedShaders: LoadedOverlayShader[];
  pluginThemePackages: LoadedOverlayThemePackage[];
  pluginFonts: OverlayRegisteredFontContribution[];
  pluginCommands: OverlayPluginCommandContribution[];
  pluginExplorerActions: OverlayPluginExplorerActionContribution[];
  folderPluginsError: string | null;
  folderPluginsLoading: boolean;
  openPluginsFolder: () => Promise<void>;
  refreshFolderPlugins: (force?: boolean) => Promise<void>;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
}

export interface UseFolderPluginRuntimeOptions {
  liveReloadEnabled?: boolean;
}

export function useFolderPluginRuntime(
  runtimePlatform: RuntimePlatform,
  options: UseFolderPluginRuntimeOptions = {},
): UseFolderPluginRuntimeResult {
  const liveReloadEnabled = options.liveReloadEnabled === true;
  const [folderPlugins, setFolderPlugins] = useState<LoadedOverlayPlugin[]>([]);
  const [pluginContributedShaders, setPluginContributedShaders] = useState<LoadedOverlayShader[]>([]);
  const [pluginThemePackages, setPluginThemePackages] = useState<LoadedOverlayThemePackage[]>([]);
  const [pluginFonts, setPluginFonts] = useState<OverlayRegisteredFontContribution[]>([]);
  const [pluginCommands, setPluginCommands] = useState<OverlayPluginCommandContribution[]>([]);
  const [pluginExplorerActions, setPluginExplorerActions] = useState<OverlayPluginExplorerActionContribution[]>([]);
  const [folderPluginsError, setFolderPluginsError] = useState<string | null>(null);
  const [folderPluginsLoading, setFolderPluginsLoading] = useState(true);

  const refreshFolderPluginsRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const pluginWatchDebounceTimerRef = useRef<number | null>(null);
  const pluginRefreshInFlightRef = useRef(false);
  const pluginRefreshQueuedForceRef = useRef(false);
  const pluginSignatureRef = useRef('');

  const openPluginsFolder = useCallback(async () => {
    await ensureDir(pluginSystemConfig.pluginsDirectory);
    await explorerBackend.openExplorerPath(pluginSystemConfig.pluginsDirectory);
  }, []);

  const createPluginApi = useCallback((plugin: OverlayPluginContext): OverlayPluginApi => {
    const appLocalData = TauriFs.BaseDirectory.AppLocalData;
    const separator = getPlatformPathSeparator(runtimePlatform);
    const storageRoot = getPluginStorageDirectory(plugin.id);
    const assetRoot = plugin.pluginDirectory;
    const resolveAssetPath = (relativePath: string) => {
      const trimmed = relativePath.trim().replace(/^[\\/]+/, '');
      return trimmed ? joinPlatformPath(assetRoot, trimmed, runtimePlatform) : assetRoot;
    };
    const resolveAssetUrl = (relativePath: string) => {
      const absolutePath = resolveAssetPath(relativePath);
      try {
        return convertFileSrc(absolutePath);
      } catch {
        const normalized = absolutePath.replace(/\\/g, '/');
        return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`;
      }
    };
    const resolveStoragePath = (relativePath?: string) => {
      const trimmed = relativePath?.trim().replace(/^[\\/]+/, '') ?? '';
      return trimmed ? joinPlatformPath(storageRoot, trimmed, runtimePlatform) : storageRoot;
    };
    const ensureStorageDir = async (relativePath?: string) => {
      const target = resolveStoragePath(relativePath);
      await TauriFs.mkdir(target, { baseDir: appLocalData, recursive: true });
      return target;
    };

    return {
      invoke,
      event: TauriEvent,
      window: TauriWindow,
      fs: TauriFs,
      notification: TauriNotification,
      storage: {
        rootDir: storageRoot,
        ensureDir: ensureStorageDir,
        readTextFile: async relativePath => TauriFs.readTextFile(resolveStoragePath(relativePath), { baseDir: appLocalData }),
        writeTextFile: async (relativePath, data) => {
          const target = resolveStoragePath(relativePath);
          const parent = getParentPath(target, separator);
          if (parent) {
            await TauriFs.mkdir(parent, { baseDir: appLocalData, recursive: true });
          }
          await TauriFs.writeTextFile(target, data, { baseDir: appLocalData });
        },
        writeFile: async (relativePath, data) => {
          const target = resolveStoragePath(relativePath);
          const parent = getParentPath(target, separator);
          if (parent) {
            await TauriFs.mkdir(parent, { baseDir: appLocalData, recursive: true });
          }
          await TauriFs.writeFile(target, data, { baseDir: appLocalData });
        },
      },
      assets: {
        rootDir: assetRoot,
        resolvePath: resolveAssetPath,
        resolveUrl: resolveAssetUrl,
      },
      refreshPlugins: async () => {
        await refreshFolderPluginsRef.current(true);
      },
      openPluginsFolder,
      runBackend: async (entry, args = []) => commands
        .pluginRunBackend(pluginSystemConfig.pluginsDirectory, plugin.id, entry, args)
        .then(unwrapTauriResult),
    };
  }, [openPluginsFolder, runtimePlatform]);

  const refreshFolderPlugins = useCallback(async (force = false) => {
    if (!isTauri()) {
      setFolderPlugins([]);
      setPluginContributedShaders([]);
      setPluginThemePackages([]);
      setPluginFonts([]);
      setPluginCommands([]);
      setPluginExplorerActions([]);
      setFolderPluginsError(null);
      setFolderPluginsLoading(false);
      return;
    }

    if (force) {
      pluginRefreshQueuedForceRef.current = true;
    }
    if (pluginRefreshInFlightRef.current) {
      return;
    }

    pluginRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || pluginRefreshQueuedForceRef.current;
        pluginRefreshQueuedForceRef.current = false;
        force = false;

        if (nextForce) {
          pluginSignatureRef.current = '';
        }

        setFolderPluginsLoading(prev => prev && !nextForce);
        setFolderPluginsError(null);
        try {
          await ensureDir(pluginSystemConfig.pluginsDirectory);
          const listed = await explorerBackend.listExplorerDir(pluginSystemConfig.pluginsDirectory, false);
          const nextSignature = listed
            .filter(entry => entry.is_dir || isFrontendPluginFile(entry))
            .sort((left, right) => left.name.localeCompare(right.name))
            .map(entry => `${entry.path}:${entry.modified}:${entry.is_dir ? 'dir' : 'file'}`)
            .join('|');

          if (!nextForce && nextSignature === pluginSignatureRef.current) {
            setFolderPluginsLoading(false);
            continue;
          }

          pluginSignatureRef.current = nextSignature;
          const discovered = await pluginPackages.discoverOverlayPlugins(createPluginApi);
          setFolderPlugins(discovered.plugins);
          setPluginContributedShaders(discovered.shaders);
          setPluginThemePackages(discovered.themePackages);
          setPluginFonts(discovered.fonts);
          setPluginCommands(discovered.commands);
          setPluginExplorerActions(discovered.explorerActions);
          setFolderPluginsError(discovered.warnings.length > 0 ? discovered.warnings.join('\n') : null);
        } catch (error) {
          setFolderPlugins([]);
          setPluginContributedShaders([]);
          setPluginThemePackages([]);
          setPluginFonts([]);
          setPluginCommands([]);
          setPluginExplorerActions([]);
          setFolderPluginsError(String(error));
        } finally {
          setFolderPluginsLoading(false);
        }
      } while (pluginRefreshQueuedForceRef.current);
    } finally {
      pluginRefreshInFlightRef.current = false;
    }
  }, [createPluginApi]);

  useEffect(() => {
    refreshFolderPluginsRef.current = refreshFolderPlugins;
  }, [refreshFolderPlugins]);

  const schedulePluginRefresh = useEffectEvent((force = true) => {
    if (pluginWatchDebounceTimerRef.current !== null) {
      window.clearTimeout(pluginWatchDebounceTimerRef.current);
    }

    pluginWatchDebounceTimerRef.current = window.setTimeout(() => {
      pluginWatchDebounceTimerRef.current = null;
      void refreshFolderPluginsRef.current(force);
    }, pluginSystemConfig.watchDebounceMs);
  });

  useEffect(() => {
    void refreshFolderPlugins(true);
  }, [refreshFolderPlugins]);

  useEffect(() => {
    if (!liveReloadEnabled) {
      return;
    }

    if (typeof window === 'undefined' || !isTauri()) {
      return;
    }

    let fallbackInterval: number | null = null;
    let fallbackIntervalMs: number = pluginSystemConfig.fallbackScanIntervalMs;
    let unlistenPlugins: (() => void) | null = null;
    let disposed = false;

    const clearFallbackPolling = () => {
      if (fallbackInterval !== null) {
        window.clearTimeout(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const queueFallbackPollingTick = () => {
      clearFallbackPolling();
      if (disposed) {
        return;
      }

      fallbackInterval = window.setTimeout(async () => {
        fallbackInterval = null;
        await refreshFolderPluginsRef.current(true);
        fallbackIntervalMs = Math.min(
          fallbackIntervalMs * 2,
          pluginSystemConfig.fallbackScanMaxIntervalMs,
        );
        queueFallbackPollingTick();
      }, fallbackIntervalMs);
    };

    const startFallbackPolling = () => {
      if (disposed) {
        return;
      }

      if (fallbackInterval !== null) {
        return;
      }

      fallbackIntervalMs = pluginSystemConfig.fallbackScanIntervalMs;
      queueFallbackPollingTick();
    };

    const startPluginWatcher = async () => {
      try {
        await ensureDir(pluginSystemConfig.pluginsDirectory);
        unlistenPlugins = await listen<PluginDirectoryWatchEvent>(pluginSystemConfig.watchEventName, (event) => {
          if (!shouldRefreshForPluginWatchPaths(event.payload.paths)) {
            return;
          }
          schedulePluginRefresh(true);
        });

        unwrapTauriResult(await commands.pluginWatchDirectory(
          pluginSystemConfig.pluginsDirectory,
          [...pluginSystemConfig.ignoredWatchDirectoryNames],
        ));

        if (disposed) {
          unlistenPlugins?.();
          unlistenPlugins = null;
          unwrapTauriResult(await commands.pluginUnwatchDirectory());
        }
      } catch (error) {
        unlistenPlugins?.();
        unlistenPlugins = null;
        if (disposed) {
          return;
        }
        console.warn('Plugin watcher unavailable, falling back to polling:', error);
        startFallbackPolling();
      }
    };

    void startPluginWatcher();

    return () => {
      disposed = true;
      if (pluginWatchDebounceTimerRef.current !== null) {
        window.clearTimeout(pluginWatchDebounceTimerRef.current);
        pluginWatchDebounceTimerRef.current = null;
      }
      clearFallbackPolling();
      unlistenPlugins?.();
      void commands.pluginUnwatchDirectory().then(unwrapTauriResult).catch(() => undefined);
    };
  }, [liveReloadEnabled, schedulePluginRefresh]);

  return {
    folderPlugins,
    pluginContributedShaders,
    pluginThemePackages,
    pluginFonts,
    pluginCommands,
    pluginExplorerActions,
    folderPluginsError,
    folderPluginsLoading,
    openPluginsFolder,
    refreshFolderPlugins,
    createPluginApi,
  };
}
