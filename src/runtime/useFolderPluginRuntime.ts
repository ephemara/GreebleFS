import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as TauriNotification from '@tauri-apps/plugin-notification';
import * as TauriWindow from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { LoadedActionPack, LoadedExplorerAction } from '../config/actionPacks';
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
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
  OverlayPluginPreviewLaneContribution,
  OverlayPluginSettingsSlotContribution,
  OverlayPluginWorkflowContribution,
} from '../config/pluginContributions';
import type { LoadedOverlayShader } from '../components/shaderRuntime';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import { getPlatformPathSeparator, joinPlatformPath, type RuntimePlatform } from '../config/platform';
import type { OverlayRegisteredFontContribution } from '../config/appearance';
import * as explorerBackend from './explorerBackend';
import type { PluginDirectoryWatchEvent } from '../generated/tauri';
import { ensureDir, getParentPath } from './overlayRuntimeUtils';
import { commands, unwrapTauriResult } from './tauriClient';
import {
  createExtensionHostClient,
  type ExecutionContextSnapshot,
} from './extensionHostApi';
import { createPluginIndexApi } from './pluginIndexApi';
import { createOverlayPluginRuntimeSettingsController } from './pluginSettingsRuntime';
import { dispatchExplorerWorkflowRequest } from './explorerWorkflowBridge';
import { useSettingsStore } from '../store/settingsStore';

export interface UseFolderPluginRuntimeResult {
  folderPlugins: LoadedOverlayPlugin[];
  enabledFolderPlugins: LoadedOverlayPlugin[];
  pluginContributedShaders: LoadedOverlayShader[];
  pluginThemePackages: LoadedOverlayThemePackage[];
  pluginFonts: OverlayRegisteredFontContribution[];
  pluginCommands: OverlayPluginCommandContribution[];
  pluginActionPacks: LoadedActionPack[];
  pluginActions: LoadedExplorerAction[];
  pluginExplorerActions: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems: OverlayPluginContextMenuContribution[];
  pluginPreviewLanes: OverlayPluginPreviewLaneContribution[];
  pluginSettingsSlots: OverlayPluginSettingsSlotContribution[];
  pluginWorkflows: OverlayPluginWorkflowContribution[];
  folderPluginsError: string | null;
  folderPluginsLoading: boolean;
  openPluginsFolder: () => Promise<void>;
  refreshFolderPlugins: (force?: boolean) => Promise<void>;
  setPluginEnabled: (pluginId: string, enabled: boolean) => void;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
}

export interface UseFolderPluginRuntimeOptions {
  liveReloadEnabled?: boolean;
}

function createPluginEnablementSignature(
  disabledPluginIds: ReadonlySet<string>,
): string {
  return [...disabledPluginIds].sort().join('|');
}

export function useFolderPluginRuntime(
  runtimePlatform: RuntimePlatform,
  options: UseFolderPluginRuntimeOptions = {},
): UseFolderPluginRuntimeResult {
  const liveReloadEnabled = options.liveReloadEnabled === true;
  const [folderPlugins, setFolderPlugins] = useState<LoadedOverlayPlugin[]>([]);
  const [enabledFolderPlugins, setEnabledFolderPlugins] = useState<LoadedOverlayPlugin[]>([]);
  const [pluginContributedShaders, setPluginContributedShaders] = useState<LoadedOverlayShader[]>([]);
  const [pluginThemePackages, setPluginThemePackages] = useState<LoadedOverlayThemePackage[]>([]);
  const [pluginFonts, setPluginFonts] = useState<OverlayRegisteredFontContribution[]>([]);
  const [pluginCommands, setPluginCommands] = useState<OverlayPluginCommandContribution[]>([]);
  const [pluginActionPacks, setPluginActionPacks] = useState<LoadedActionPack[]>([]);
  const [pluginActions, setPluginActions] = useState<LoadedExplorerAction[]>([]);
  const [pluginExplorerActions, setPluginExplorerActions] = useState<OverlayPluginExplorerActionContribution[]>([]);
  const [pluginContextMenuItems, setPluginContextMenuItems] = useState<OverlayPluginContextMenuContribution[]>([]);
  const [pluginPreviewLanes, setPluginPreviewLanes] = useState<OverlayPluginPreviewLaneContribution[]>([]);
  const [pluginSettingsSlots, setPluginSettingsSlots] = useState<OverlayPluginSettingsSlotContribution[]>([]);
  const [pluginWorkflows, setPluginWorkflows] = useState<OverlayPluginWorkflowContribution[]>([]);
  const [folderPluginsError, setFolderPluginsError] = useState<string | null>(null);
  const [folderPluginsLoading, setFolderPluginsLoading] = useState(true);

  const refreshFolderPluginsRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const pluginWatchDebounceTimerRef = useRef<number | null>(null);
  const pluginRefreshInFlightRef = useRef(false);
  const pluginRefreshQueuedForceRef = useRef(false);
  const pluginSignatureRef = useRef('');
  const pluginEnablementByPluginId = useSettingsStore(
    state => state.settings.plugins.enablementByPluginId,
  );
  const setPluginEnabled = useSettingsStore(state => state.setPluginEnabled);
  const disabledPluginIds = useMemo(
    () => new Set(
      Object.entries(pluginEnablementByPluginId)
        .filter(([, enabled]) => enabled === false)
        .map(([pluginId]) => pluginId),
    ),
    [pluginEnablementByPluginId],
  );
  const pluginEnablementSignature = useMemo(
    () => createPluginEnablementSignature(disabledPluginIds),
    [disabledPluginIds],
  );
  const disabledPluginIdsRef = useRef<ReadonlySet<string>>(disabledPluginIds);
  disabledPluginIdsRef.current = disabledPluginIds;

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
    const settingsController =
      createOverlayPluginRuntimeSettingsController(plugin.id);
    const indexApi = createPluginIndexApi();

    const createBoundPluginApi = (
      executionContext: ExecutionContextSnapshot | null,
    ): OverlayPluginApi => ({
      invoke,
      event: TauriEvent,
      window: TauriWindow,
      fs: TauriFs,
      notification: TauriNotification,
      host: createExtensionHostClient({
        callerPluginId: plugin.id,
        getExecutionContext: () => executionContext,
      }),
      index: indexApi,
      settings: {
        pluginId: plugin.id,
        getStoredValues: settingsController.getStoredValues,
        getValue: settingsController.getValue,
        setValue: settingsController.setValue,
        patchValues: settingsController.patchValues,
        resetValues: settingsController.resetValues,
        subscribe: settingsController.subscribe,
      },
      workflows: {
        open: async (workflowId, options) => {
          dispatchExplorerWorkflowRequest({
            kind: 'open',
            workflowId,
            payload: options?.payload ?? null,
            titleOverride: options?.titleOverride ?? null,
            source: 'plugin-api',
            pluginId: plugin.id,
            targetPaneId: executionContext?.paneId ?? null,
            workspaceTabId: executionContext?.workspaceTabId ?? null,
          });
        },
        close: async () => {
          dispatchExplorerWorkflowRequest({
            kind: 'close',
            targetPaneId: executionContext?.paneId ?? null,
            workspaceTabId: executionContext?.workspaceTabId ?? null,
          });
        },
      },
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
      bindExecutionContext: (nextExecutionContext) =>
        createBoundPluginApi(nextExecutionContext),
    });

    return createBoundPluginApi(null);
  }, [openPluginsFolder, runtimePlatform]);

  const refreshFolderPlugins = useCallback(async (force = false) => {
    if (!isTauri()) {
      setFolderPlugins([]);
      setEnabledFolderPlugins([]);
      setPluginContributedShaders([]);
      setPluginThemePackages([]);
      setPluginFonts([]);
      setPluginCommands([]);
      setPluginActionPacks([]);
      setPluginActions([]);
      setPluginExplorerActions([]);
      setPluginContextMenuItems([]);
      setPluginPreviewLanes([]);
      setPluginSettingsSlots([]);
      setPluginWorkflows([]);
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
          const discoveryDisabledPluginIds = disabledPluginIdsRef.current;
          const discoveryEnablementSignature =
            createPluginEnablementSignature(discoveryDisabledPluginIds);
          const discovered = await pluginPackages.discoverOverlayPlugins(createPluginApi, {
            disabledPluginIds: discoveryDisabledPluginIds,
          });
          if (
            discoveryEnablementSignature !==
            createPluginEnablementSignature(disabledPluginIdsRef.current)
          ) {
            pluginRefreshQueuedForceRef.current = true;
            continue;
          }

          setFolderPlugins(discovered.plugins);
          setEnabledFolderPlugins(
            discovered.plugins.filter(plugin => plugin.enabled !== false),
          );
          setPluginContributedShaders(discovered.shaders);
          setPluginThemePackages(discovered.themePackages);
          setPluginFonts(discovered.fonts);
          setPluginCommands(discovered.commands);
          setPluginActionPacks(discovered.actionPacks);
          setPluginActions(discovered.actions);
          setPluginExplorerActions(discovered.explorerActions);
          setPluginContextMenuItems(discovered.contextMenuItems);
          setPluginPreviewLanes(discovered.previewLanes);
          setPluginSettingsSlots(discovered.settingsSlots);
          setPluginWorkflows(discovered.workflows);
          setFolderPluginsError(discovered.warnings.length > 0 ? discovered.warnings.join('\n') : null);
        } catch (error) {
          setFolderPlugins([]);
          setEnabledFolderPlugins([]);
          setPluginContributedShaders([]);
          setPluginThemePackages([]);
          setPluginFonts([]);
          setPluginCommands([]);
          setPluginActionPacks([]);
          setPluginActions([]);
          setPluginExplorerActions([]);
          setPluginContextMenuItems([]);
          setPluginPreviewLanes([]);
          setPluginSettingsSlots([]);
          setPluginWorkflows([]);
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
  }, [pluginEnablementSignature, refreshFolderPlugins]);

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
    let pluginWatchCleanupRequired = false;
    let pluginWatchCleanupInFlight = false;
    let pluginWatchCleanupRetryRequested = false;
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
        await refreshFolderPluginsRef.current(false);
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

    const cleanupPluginWatcher = async () => {
      if (!pluginWatchCleanupRequired) {
        return;
      }

      if (pluginWatchCleanupInFlight) {
        pluginWatchCleanupRetryRequested = true;
        return;
      }

      pluginWatchCleanupInFlight = true;
      try {
        do {
          pluginWatchCleanupRetryRequested = false;
          try {
            unwrapTauriResult(await commands.pluginUnwatchDirectory());
            pluginWatchCleanupRequired = false;
          } catch (error) {
            console.warn('Plugin watcher cleanup failed before fallback:', error);
          }
        } while (pluginWatchCleanupRequired && pluginWatchCleanupRetryRequested);
      } finally {
        pluginWatchCleanupInFlight = false;
      }
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

        pluginWatchCleanupRequired = true;
        unwrapTauriResult(await commands.pluginWatchDirectory(
          pluginSystemConfig.pluginsDirectory,
          [...pluginSystemConfig.ignoredWatchDirectoryNames],
        ));

        if (disposed) {
          unlistenPlugins?.();
          unlistenPlugins = null;
          void cleanupPluginWatcher();
        }
      } catch (error) {
        unlistenPlugins?.();
        unlistenPlugins = null;
        void cleanupPluginWatcher();
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
      void cleanupPluginWatcher();
    };
  }, [liveReloadEnabled, schedulePluginRefresh]);

  return {
    folderPlugins,
    enabledFolderPlugins,
    pluginContributedShaders,
    pluginThemePackages,
    pluginFonts,
    pluginCommands,
    pluginActionPacks,
    pluginActions,
    pluginExplorerActions,
    pluginContextMenuItems,
    pluginPreviewLanes,
    pluginSettingsSlots,
    pluginWorkflows,
    folderPluginsError,
    folderPluginsLoading,
    openPluginsFolder,
    refreshFolderPlugins,
    setPluginEnabled,
    createPluginApi,
  };
}
