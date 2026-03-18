import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import {
  getCurrentWindow,
  PhysicalSize,
  PhysicalPosition,
  primaryMonitor,
} from '@tauri-apps/api/window';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import {
  buildBuiltInCatalog,
  createBuiltInPanelDefinitions,
  createFolderPluginPanelDefinitions,
  type OverlayPanelDefinition,
} from './panels/panelRegistry';
import { PluginsManager } from './components/PluginsManager';
import { pluginSystemConfig } from './config/plugins';
import {
  isFrontendPluginFile,
  loadPluginFromSource,
  type LoadedOverlayPlugin,
  type OverlayPluginApi,
  type OverlayPluginContext,
  type PluginBackendResult,
  type PluginFileEntry,
} from './components/pluginRuntime';
import { listen } from '@tauri-apps/api/event';
import { Check, Droplet, GripVertical, LayoutGrid, Settings2, Terminal as TerminalIcon, X } from 'lucide-react';
import { ensureFontFamilyLoaded, resolveOverlayAppearance, type ResolvedOverlayAppearance } from './config/appearance';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  getNextLayoutProfileId,
  getPanelsBySide,
  getPinnedPanelIds,
  getTabbedOpenPanelIds,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LayoutPinnedPanel,
  type LayoutProfile,
} from './config/layoutProfiles';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  getOverlayAnimationStyle,
  getOverlayEffectStyle,
  type OverlayAnimationDirection,
  type OverlayAnimationPhase,
  type OverlayAnimationPresetId,
} from './config/overlayAnimations';
import { detectClientPlatform, type RuntimePlatform } from './config/platform';
import { getNextActivePanelId, reorderPanelIds, syncOpenPanelIds, togglePanelId } from './components/panelUtils';
import { OverlayScrollArea } from './components/OverlayScrollArea';
import { useSettingsStore, type OverlayWindowAnchor } from './store/settingsStore';
import { useTerminalStore } from './store/terminalStore';

const LOGICAL_PADDING = 12;
const APP_OPACITY_MIN = 0.15;
const APP_OPACITY_MAX = 1;
const APP_ZOOM_MIN = 0.7;
const APP_ZOOM_MAX = 1.35;

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function parseExternalArgs(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map(value => value.trim())
    .filter(Boolean);
}

async function ensureDir(path: string): Promise<void> {
  try {
    await invoke('fs_list_dir', { path, showHidden: false });
  } catch {
    await invoke('fs_create_dir', { path });
  }
}

interface OverlayWindowLayout {
  width: number;
  height: number;
  x: number;
  y: number;
  healedHeight: number | null;
}

function computeOverlayWindowLayout(args: {
  workArea: { position: PhysicalPosition; size: PhysicalSize };
  scaleFactor: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: OverlayWindowAnchor;
}): OverlayWindowLayout {
  const physPad = Math.round(LOGICAL_PADDING * args.scaleFactor);
  const availableLogicalHeight = Math.max(Math.round(args.workArea.size.height / args.scaleFactor) - LOGICAL_PADDING * 2, 150);
  const rawTargetHeight = args.overlayHeight > 0 ? args.overlayHeight : 420;
  const healedHeight = rawTargetHeight >= availableLogicalHeight - 4 ? 420 : null;
  const logicalHeight = healedHeight ?? rawTargetHeight;
  const height = Math.min(
    Math.round(logicalHeight * args.scaleFactor),
    args.workArea.size.height - physPad * 2,
  );
  const isTopAnchored = args.overlayAnchor === 'top';

  const savedPhysWidth = args.overlayWidth > 0
    ? Math.round(args.overlayWidth * args.scaleFactor)
    : null;
  const width = savedPhysWidth
    ? Math.min(savedPhysWidth, args.workArea.size.width - physPad * 2)
    : args.workArea.size.width - physPad * 2;

  return {
    width: Math.max(width, 400),
    height,
    x: args.workArea.position.x + physPad,
    y: isTopAnchored
      ? args.workArea.position.y + physPad
      : args.workArea.position.y + args.workArea.size.height - height - physPad,
    healedHeight,
  };
}

function LayoutPinnedPanelSlot({
  panel,
  definition,
}: {
  panel: LayoutPinnedPanel;
  definition: OverlayPanelDefinition;
}) {
  return (
    <div
      style={{
        flexBasis: panel.size,
        width: panel.size,
        minWidth: panel.size,
        maxWidth: panel.size,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {definition.render()}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [overlayPhase, setOverlayPhase] = useState<OverlayAnimationPhase>('closed');
  const [overlayAnimationDirection, setOverlayAnimationDirection] = useState<OverlayAnimationDirection>('enter');
  const [activeAnimationPresetId, setActiveAnimationPresetId] = useState<OverlayAnimationPresetId>('spring-lift');
  const [activePanelId, setActivePanelId] = useState<string | null>('terminal');
  const [folderPlugins, setFolderPlugins] = useState<LoadedOverlayPlugin[]>([]);
  const [folderPluginsError, setFolderPluginsError] = useState<string | null>(null);
  const [folderPluginsLoading, setFolderPluginsLoading] = useState(true);
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const overlayPhaseRef = useRef<OverlayAnimationPhase>('closed');
  overlayPhaseRef.current = overlayPhase;
  const overlayVisibleRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastToggleAtRef = useRef(0);
  const isProgrammaticResizeRef = useRef(false);
  const interactionLockUntilRef = useRef(0);
  const pluginSignatureRef = useRef('');
  const hasInitializedPanelLayoutRef = useRef(false);
  const lastAppliedLayoutProfileIdRef = useRef<string | null>(null);
  const dragHideRestoreRef = useRef(false);
  const refreshFolderPluginsRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([]);
  const [layoutManifest, setLayoutManifest] = useState(BUILT_IN_LAYOUT_MANIFEST);
  const [layoutConfigSource, setLayoutConfigSource] = useState<string | null>(null);

  const settings = useSettingsStore(s => s.settings.terminal);
  const appearance = useSettingsStore(s => s.settings.appearance);
  const layoutSettings = useSettingsStore(s => s.settings.layout);
  const updateTerminal = useSettingsStore(s => s.updateTerminal);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);
  const updateLayout = useSettingsStore(s => s.updateLayout);
  const updateSystem = useSettingsStore(s => s.updateSystem);
  const { initStore, addDirectoryBookmark } = useTerminalStore();
  const resolvedAppearance = useMemo(
    () => resolveOverlayAppearance({
      activeThemeId: appearance.activeThemeId,
      customThemes: appearance.customThemes,
      uiFontFamily: appearance.uiFontFamily,
      monoFontFamily: settings.fontFamily,
    }),
    [appearance.activeThemeId, appearance.customThemes, appearance.uiFontFamily, settings.fontFamily],
  );
  const theme = resolvedAppearance.theme;
  const accent = theme.palette.accent;
  const isOverlayVisible = overlayPhase !== 'closed';
  overlayVisibleRef.current = isOverlayVisible;
  const appOpacity = appearance.appOpacity ?? 1.0;
  const appZoom = appearance.appZoom ?? 1.0;
  const appBlur = appearance.appBlur ?? true;
  const animationsEnabled = appearance.animations ?? true;
  const appOpenAnimation = animationsEnabled ? (appearance.appOpenAnimation ?? 'spring-lift') : 'none';
  const appCloseAnimation = animationsEnabled ? (appearance.appCloseAnimation ?? 'burn') : 'none';
  const appAnimationDurationMs = animationsEnabled
    ? clampOverlayAnimationDuration(appearance.appAnimationDurationMs ?? 320)
    : 140;
  const appAnimationIntensity = clampOverlayAnimationIntensity(appearance.appAnimationIntensity ?? 1);
  const clampedAppOpacity = clampValue(appOpacity, APP_OPACITY_MIN, APP_OPACITY_MAX);
  const clampedAppZoom = clampValue(appZoom, APP_ZOOM_MIN, APP_ZOOM_MAX);
  const overlayAnchor = settings.overlayAnchor === 'top' ? 'top' : 'bottom';
  const isTopAnchored = overlayAnchor === 'top';
  const scaledWidth = `${100 / clampedAppZoom}%`;
  const scaledHeight = `${100 / clampedAppZoom}%`;
  const shellBackgroundColor = appBlur ? theme.palette.shellBackground : theme.palette.shellBackgroundSolid;
  const shellAnimationStyle = getOverlayAnimationStyle({
    phase: overlayPhase,
    direction: overlayAnimationDirection,
    presetId: activeAnimationPresetId,
    baseOpacity: clampedAppOpacity,
    intensity: appAnimationIntensity,
    durationMs: appAnimationDurationMs,
    verticalOrigin: overlayAnchor,
  });
  const shellEffectStyle = getOverlayEffectStyle({
    phase: overlayPhase,
    direction: overlayAnimationDirection,
    presetId: activeAnimationPresetId,
    durationMs: appAnimationDurationMs,
    intensity: appAnimationIntensity,
    accentColor: accent,
    verticalOrigin: overlayAnchor,
  });
  const combinedShellTransform = typeof shellAnimationStyle.transform === 'string'
    ? `${shellAnimationStyle.transform} scale(${clampedAppZoom})`
    : `scale(${clampedAppZoom})`;
  const activeLayoutProfile = useMemo(
    () => resolveLayoutProfile(layoutManifest, layoutSettings.activeProfileId),
    [layoutManifest, layoutSettings.activeProfileId],
  );
  const pinnedExplorerPanel = useMemo(
    () => activeLayoutProfile.pinnedPanels.find(panel => panel.panelId === 'explorer') ?? null,
    [activeLayoutProfile],
  );

  // ── Boot store ──
  useEffect(() => { initStore(); }, [initStore]);

  useEffect(() => {
    let cancelled = false;

    invoke<boolean>('startup_get_launch_at_startup')
      .then(enabled => {
        if (!cancelled) {
          updateSystem({ launchAtStartup: enabled });
        }
      })
      .catch(error => {
        console.warn('OverlayTerm: failed to sync startup registration', error);
      });

    return () => {
      cancelled = true;
    };
  }, [updateSystem]);

  useEffect(() => {
    ensureFontFamilyLoaded(resolvedAppearance.fonts.ui);
    ensureFontFamilyLoaded(resolvedAppearance.fonts.mono);
  }, [resolvedAppearance.fonts.mono, resolvedAppearance.fonts.ui]);

  useEffect(() => {
    let cancelled = false;

    loadExternalLayoutManifest(layoutSettings.configPath)
      .then(result => {
        if (cancelled) {
          return;
        }
        setLayoutManifest(result.manifest);
        setLayoutConfigSource(result.sourcePath);
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to load layout manifest', error);
          setLayoutManifest(BUILT_IN_LAYOUT_MANIFEST);
          setLayoutConfigSource(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layoutSettings.configPath]);

  useEffect(() => {
    if (layoutSettings.activeProfileId === activeLayoutProfile.id) {
      return;
    }
    updateLayout({ activeProfileId: activeLayoutProfile.id });
  }, [activeLayoutProfile.id, layoutSettings.activeProfileId, updateLayout]);

  const clearAnimationClock = useCallback(() => {
    if (animationTimerRef.current !== null) {
      window.clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const markOverlayRuntimePhase = useCallback((phase: OverlayAnimationPhase, visible: boolean) => {
    overlayPhaseRef.current = phase;
    overlayVisibleRef.current = visible;
  }, []);

  useEffect(() => () => {
    clearAnimationClock();
  }, [clearAnimationClock]);

  // ── Position & show ──
  const positionAndShow = useCallback(async () => {
    clearAnimationClock();
    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await primaryMonitor();
      if (!monitor) return;

      const store = useSettingsStore.getState().settings.terminal;
      const layout = computeOverlayWindowLayout({
        workArea: monitor.workArea,
        scaleFactor,
        overlayHeight: store.overlayHeight,
        overlayWidth: store.overlayWidth,
        overlayAnchor: store.overlayAnchor === 'top' ? 'top' : 'bottom',
      });

      setOverlayAnimationDirection('enter');
      setActiveAnimationPresetId(appOpenAnimation);
      markOverlayRuntimePhase('opening', true);
      interactionLockUntilRef.current = Date.now() + appAnimationDurationMs + 80;
      setOverlayPhase('closed');
      if (layout.healedHeight !== null && layout.healedHeight !== store.overlayHeight) {
        useSettingsStore.getState().updateTerminal({ overlayHeight: layout.healedHeight });
      }
      isProgrammaticResizeRef.current = true;
      await win.setSize(new PhysicalSize(layout.width, layout.height));
      await win.setPosition(new PhysicalPosition(layout.x, layout.y));
      await win.show();
      await win.setPosition(new PhysicalPosition(layout.x, layout.y));
      await win.setFocus();
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = null;
        void win.setPosition(new PhysicalPosition(layout.x, layout.y)).catch(() => {});
        isProgrammaticResizeRef.current = false;
        markOverlayRuntimePhase('opening', true);
        setOverlayPhase('opening');
        animationTimerRef.current = window.setTimeout(() => {
          markOverlayRuntimePhase('open', true);
          setOverlayPhase('open');
          animationTimerRef.current = null;
        }, appAnimationDurationMs);
      });
    } catch (e) {
      isProgrammaticResizeRef.current = false;
      markOverlayRuntimePhase('closed', false);
      console.warn('OverlayTerm: failed to position/show', e);
    }
  }, [appAnimationDurationMs, appOpenAnimation, clearAnimationClock, markOverlayRuntimePhase]);

  const handleToggleOverlayAnchor = useCallback(() => {
    updateTerminal({
      overlayAnchor: overlayAnchor === 'top' ? 'bottom' : 'top',
    });
  }, [overlayAnchor, updateTerminal]);

  const hideOverlay = useCallback(async () => {
    const currentPhase = overlayPhaseRef.current;
    if (currentPhase !== 'open') {
      return;
    }

    clearAnimationClock();
    setOverlayAnimationDirection('exit');
    setActiveAnimationPresetId(appCloseAnimation);
    markOverlayRuntimePhase('closing', true);
    interactionLockUntilRef.current = Date.now() + appAnimationDurationMs + 80;
    setOverlayPhase('closing');
    animationTimerRef.current = window.setTimeout(async () => {
      animationTimerRef.current = null;
      markOverlayRuntimePhase('closed', false);
      setOverlayPhase('closed');
      try {
        await getCurrentWindow().hide();
      } catch {
        // Ignore hide failures during teardown.
      }
    }, appAnimationDurationMs);
  }, [appAnimationDurationMs, appCloseAnimation, clearAnimationClock, markOverlayRuntimePhase]);

  const hideOverlayForDrag = useCallback(async () => {
    const currentPhase = overlayPhaseRef.current;
    if (currentPhase !== 'open') {
      return;
    }

    dragHideRestoreRef.current = true;
    clearAnimationClock();
    markOverlayRuntimePhase('closed', false);
    setOverlayPhase('closed');
    try {
      await getCurrentWindow().hide();
    } catch {
      // Ignore hide failures during drag teardown.
    }
  }, [clearAnimationClock, markOverlayRuntimePhase]);

  const restoreOverlayAfterDrag = useCallback(() => {
    if (!dragHideRestoreRef.current) {
      return;
    }
    dragHideRestoreRef.current = false;
    void positionAndShow();
  }, [positionAndShow]);

  const handleDragStartCapture = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const source = (event.target as HTMLElement | null)?.closest('[data-overlay-drag-source="file"]');
    if (!source) {
      return;
    }
    void hideOverlayForDrag();
  }, [hideOverlayForDrag]);

  const handleDragEndCapture = useCallback(() => {
    restoreOverlayAfterDrag();
  }, [restoreOverlayAfterDrag]);

  const handleDropCapture = useCallback(() => {
    restoreOverlayAfterDrag();
  }, [restoreOverlayAfterDrag]);

  const toggle = useCallback(() => {
    const now = Date.now();
    if (now < interactionLockUntilRef.current) {
      return;
    }
    if (now - lastToggleAtRef.current < 220) {
      return;
    }
    lastToggleAtRef.current = now;

    const currentPhase = overlayPhaseRef.current;
    if (currentPhase === 'opening' || currentPhase === 'closing') {
      return;
    }
    if (!overlayVisibleRef.current || currentPhase === 'closed') {
      void positionAndShow();
      return;
    }
    void hideOverlay();
  }, [positionAndShow, hideOverlay]);

  // ── Listen for Rust Ctrl+Space event ──
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen('overlay://toggle-request', () => toggle())
      .then(fn => { unlisten = fn; })
      .catch(err => console.warn('overlay listen failed:', err));
    return () => { unlisten?.(); };
  }, [toggle]);

  // ── Escape to close ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayVisibleRef.current) { e.preventDefault(); void hideOverlay(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hideOverlay]);

  useEffect(() => {
    if (!overlayVisibleRef.current) {
      return;
    }

    let cancelled = false;

    const repositionOverlay = async () => {
      try {
        const win = getCurrentWindow();
        const scaleFactor = await win.scaleFactor();
        const monitor = await primaryMonitor();
        if (!monitor || cancelled) {
          return;
        }

        const store = useSettingsStore.getState().settings.terminal;
        const layout = computeOverlayWindowLayout({
          workArea: monitor.workArea,
          scaleFactor,
          overlayHeight: store.overlayHeight,
          overlayWidth: store.overlayWidth,
          overlayAnchor: store.overlayAnchor === 'top' ? 'top' : 'bottom',
        });

        if (layout.healedHeight !== null && layout.healedHeight !== store.overlayHeight) {
          useSettingsStore.getState().updateTerminal({ overlayHeight: layout.healedHeight });
        }

        isProgrammaticResizeRef.current = true;
        await win.setSize(new PhysicalSize(layout.width, layout.height));
        await win.setPosition(new PhysicalPosition(layout.x, layout.y));
      } catch (error) {
        console.warn('OverlayTerm: failed to re-anchor overlay', error);
      } finally {
        isProgrammaticResizeRef.current = false;
      }
    };

    void repositionOverlay();

    return () => {
      cancelled = true;
    };
  }, [overlayAnchor]);

  // ── Persist resize ──
  useEffect(() => {
    const unlistenResize = getCurrentWindow().onResized(async ev => {
      if (isProgrammaticResizeRef.current || !overlayVisibleRef.current) {
        return;
      }
      const factor = await getCurrentWindow().scaleFactor();
      const logH = Math.round(ev.payload.height / factor);
      const logW = Math.round(ev.payload.width / factor);
      useSettingsStore.getState().updateTerminal({
        overlayHeight: Math.max(logH, 150),
        overlayWidth:  Math.max(logW, 300),
      });
    });
    return () => { unlistenResize.then(fn => fn()); };
  }, []);

  // ── Explorer → Terminal bridge ──
  const handleOpenInTerminal = useCallback(async (path: string) => {
    if (settings.preferredOpenMode === 'external') {
      await invoke('terminal_open_external', {
        request: {
          workingDir: path,
          profile: settings.externalTerminalProfile,
          executable: settings.externalTerminalCommand || null,
          args: parseExternalArgs(settings.externalTerminalArgs),
          shell: settings.shell,
        },
      }).catch(error => {
        console.warn('OverlayTerm: failed to open external terminal', error);
      });
      hideOverlay();
      return;
    }

    setActivePanelId('terminal');
    // Small delay so the terminal tab renders before we inject the cd
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('overlayterm:cdinject', { detail: path }));
    }, 80);
  }, [hideOverlay, settings.externalTerminalArgs, settings.externalTerminalCommand, settings.externalTerminalProfile, settings.preferredOpenMode, settings.shell]);

  const handleAddBookmark = useCallback(async (name: string, path: string) => {
    await addDirectoryBookmark({ id: crypto.randomUUID(), name, value: path });
  }, [addDirectoryBookmark]);

  const openPluginsFolder = useCallback(async () => {
    await ensureDir(pluginSystemConfig.pluginsDirectory);
    await invoke('fs_open_file', { path: pluginSystemConfig.pluginsDirectory });
  }, []);

  const createPluginApi = useCallback((plugin: OverlayPluginContext): OverlayPluginApi => ({
    invoke,
    event: TauriEvent,
    window: TauriWindow,
    fs: TauriFs,
    refreshPlugins: async () => {
      await refreshFolderPluginsRef.current(true);
    },
    openPluginsFolder,
    runBackend: async (entry, args = []) => invoke<PluginBackendResult>('plugin_run_backend', {
      pluginsRoot: pluginSystemConfig.pluginsDirectory,
      pluginId: plugin.id,
      entry,
      args,
    }),
  }), [openPluginsFolder]);

  const refreshFolderPlugins = useCallback(async (force = false) => {
    if (force) {
      pluginSignatureRef.current = '';
    }

    setFolderPluginsLoading(prev => prev && !force);
    setFolderPluginsError(null);
    try {
      await ensureDir(pluginSystemConfig.pluginsDirectory);
      const listed = await invoke<PluginFileEntry[]>('fs_list_dir', {
        path: pluginSystemConfig.pluginsDirectory,
        showHidden: false,
      });
      const files = listed
        .filter(isFrontendPluginFile)
        .sort((left, right) => left.name.localeCompare(right.name));
      const nextSignature = files.map(file => `${file.path}:${file.modified}`).join('|');

      if (!force && nextSignature === pluginSignatureRef.current) {
        setFolderPluginsLoading(false);
        return;
      }

      pluginSignatureRef.current = nextSignature;
      const loaded = await Promise.all(files.map(async file => {
        const source = await invoke<string>('fs_read_text_file', { path: file.path });
        return loadPluginFromSource(source, file, createPluginApi);
      }));

      setFolderPlugins(loaded);
    } catch (error) {
      setFolderPlugins([]);
      setFolderPluginsError(String(error));
    } finally {
      setFolderPluginsLoading(false);
    }
  }, [createPluginApi]);

  useEffect(() => {
    refreshFolderPluginsRef.current = refreshFolderPlugins;
  }, [refreshFolderPlugins]);

  useEffect(() => {
    void refreshFolderPlugins(true);
  }, [refreshFolderPlugins]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshFolderPlugins();
    }, pluginSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [refreshFolderPlugins]);

  const panelDefinitions = useMemo<OverlayPanelDefinition[]>(
    () => [
      ...createBuiltInPanelDefinitions({
        appearance: resolvedAppearance,
        explorerLayoutMode: pinnedExplorerPanel?.mode ?? 'full',
        isOpen: isOverlayVisible,
        hideOverlay,
        onOpenInTerminal: handleOpenInTerminal,
        onAddBookmark: handleAddBookmark,
        renderPluginsManager: () => (
          <PluginsManager
            appearance={resolvedAppearance}
            builtInCatalog={buildBuiltInCatalog()}
            plugins={folderPlugins}
            isLoading={folderPluginsLoading}
            error={folderPluginsError}
            onRefreshPlugins={() => refreshFolderPlugins(true)}
            onOpenPluginsFolder={openPluginsFolder}
            createPluginApi={createPluginApi}
          />
        ),
      }),
      ...createFolderPluginPanelDefinitions({
        appearance: resolvedAppearance,
        plugins: folderPlugins,
        createPluginApi,
      }),
    ],
    [
      createPluginApi,
      folderPlugins,
      folderPluginsError,
      folderPluginsLoading,
      handleAddBookmark,
      handleOpenInTerminal,
      hideOverlay,
      isOverlayVisible,
      openPluginsFolder,
      pinnedExplorerPanel?.mode,
      refreshFolderPlugins,
      resolvedAppearance,
    ],
  );
  const panelLookup = useMemo(
    () => new Map(panelDefinitions.map(panel => [panel.id, panel])),
    [panelDefinitions],
  );
  const pinnedPanelIds = useMemo(
    () => getPinnedPanelIds(activeLayoutProfile),
    [activeLayoutProfile],
  );
  const defaultOpenPanelIds = useMemo(
    () => Array.from(
      new Set([
        ...panelDefinitions.filter(panel => panel.defaultOpen).map(panel => panel.id),
        ...activeLayoutProfile.behavior.enforcedOpenPanelIds,
      ]),
    ).filter(panelId => panelLookup.has(panelId)),
    [activeLayoutProfile.behavior.enforcedOpenPanelIds, panelDefinitions, panelLookup],
  );
  const tabbedOpenPanelIds = useMemo(
    () => getTabbedOpenPanelIds(activeLayoutProfile, openPanelIds),
    [activeLayoutProfile, openPanelIds],
  );
  const openPanels = useMemo(
    () => tabbedOpenPanelIds
      .map(id => panelLookup.get(id))
      .filter((panel): panel is OverlayPanelDefinition => Boolean(panel)),
    [panelLookup, tabbedOpenPanelIds],
  );
  const leftPinnedPanels = useMemo(
    () => getPanelsBySide(activeLayoutProfile, 'left')
      .map(panel => ({ panel, definition: panelLookup.get(panel.panelId) }))
      .filter((entry): entry is { panel: LayoutPinnedPanel; definition: OverlayPanelDefinition } => Boolean(entry.definition)),
    [activeLayoutProfile, panelLookup],
  );
  const rightPinnedPanels = useMemo(
    () => getPanelsBySide(activeLayoutProfile, 'right')
      .map(panel => ({ panel, definition: panelLookup.get(panel.panelId) }))
      .filter((entry): entry is { panel: LayoutPinnedPanel; definition: OverlayPanelDefinition } => Boolean(entry.definition)),
    [activeLayoutProfile, panelLookup],
  );

  useEffect(() => {
    if (hasInitializedPanelLayoutRef.current) {
      return;
    }

    hasInitializedPanelLayoutRef.current = true;
    lastAppliedLayoutProfileIdRef.current = activeLayoutProfile.id;
    setOpenPanelIds(defaultOpenPanelIds);
    if (defaultOpenPanelIds.length > 0) {
      setActivePanelId(current => current ?? defaultOpenPanelIds[0]);
    }
  }, [defaultOpenPanelIds]);

  useEffect(() => {
    const availablePanelIds = panelDefinitions.map(panel => panel.id);
    setOpenPanelIds(current => syncOpenPanelIds(current, availablePanelIds, defaultOpenPanelIds));
  }, [defaultOpenPanelIds, panelDefinitions]);

  useEffect(() => {
    if (!hasInitializedPanelLayoutRef.current) {
      return;
    }

    if (lastAppliedLayoutProfileIdRef.current === activeLayoutProfile.id) {
      return;
    }

    lastAppliedLayoutProfileIdRef.current = activeLayoutProfile.id;

    const availablePanelIds = panelDefinitions.map(panel => panel.id);
    setOpenPanelIds(current => syncOpenPanelIds(current, availablePanelIds, defaultOpenPanelIds));
    setActivePanelId(current => {
      if (current && (tabbedOpenPanelIds.includes(current) || pinnedPanelIds.includes(current))) {
        return current;
      }

      return activeLayoutProfile.behavior.defaultActivePanelId && panelLookup.has(activeLayoutProfile.behavior.defaultActivePanelId)
        ? activeLayoutProfile.behavior.defaultActivePanelId
        : defaultOpenPanelIds[0] ?? null;
    });
  }, [
    activeLayoutProfile.behavior.defaultActivePanelId,
    activeLayoutProfile.id,
    defaultOpenPanelIds,
    panelDefinitions,
    panelLookup,
    pinnedPanelIds,
    tabbedOpenPanelIds,
  ]);

  useEffect(() => {
    if (tabbedOpenPanelIds.length === 0) {
      if (activePanelId !== null) {
        setActivePanelId(null);
      }
      return;
    }

    if (activePanelId && tabbedOpenPanelIds.includes(activePanelId) && panelLookup.has(activePanelId)) {
      return;
    }

    const preferredPanelId = tabbedOpenPanelIds.includes(activeLayoutProfile.behavior.defaultActivePanelId)
      ? activeLayoutProfile.behavior.defaultActivePanelId
      : tabbedOpenPanelIds[0];

    if (preferredPanelId && activePanelId !== preferredPanelId) {
      setActivePanelId(preferredPanelId);
    }
  }, [activeLayoutProfile.behavior.defaultActivePanelId, activePanelId, panelLookup, tabbedOpenPanelIds]);

  const handleTogglePanel = useCallback((panelId: string) => {
    if (pinnedPanelIds.includes(panelId)) {
      setOpenPanelIds(current => (current.includes(panelId) ? current : [...current, panelId]));
      return;
    }

    setOpenPanelIds(current => {
      const next = togglePanelId(current, panelId);
      const isOpening = !current.includes(panelId);

      setActivePanelId(active => {
        if (isOpening) return panelId;
        if (active === panelId) return getNextActivePanelId(current, panelId);
        return active;
      });

      return next;
    });
  }, [pinnedPanelIds]);

  const handleClosePanel = useCallback((panelId: string) => {
    if (pinnedPanelIds.includes(panelId)) {
      return;
    }

    setOpenPanelIds(current => {
      const next = current.filter(id => id !== panelId);
      setActivePanelId(active => (active === panelId ? getNextActivePanelId(current, panelId) : active));
      return next;
    });
  }, [pinnedPanelIds]);

  const handleReorderPanels = useCallback((draggedId: string, targetId: string) => {
    setOpenPanelIds(current => reorderPanelIds(current, draggedId, targetId));
  }, []);

  const handleOpenSettings = useCallback(() => {
    setOpenPanelIds(current => (current.includes('settings') ? current : [...current, 'settings']));
    setActivePanelId('settings');
  }, []);

  const handleCycleLayout = useCallback(() => {
    updateLayout({
      activeProfileId: getNextLayoutProfileId(layoutManifest, activeLayoutProfile.id),
    });
  }, [activeLayoutProfile.id, layoutManifest, updateLayout]);

  useEffect(() => {
    let cancelled = false;

    const syncNativeBlur = async () => {
      try {
        await invoke('window_set_blur', {
          enabled: appBlur && overlayPhase !== 'closed',
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to apply native window blur', error);
        }
      }
    };

    syncNativeBlur();

    return () => {
      cancelled = true;
    };
  }, [appBlur, overlayPhase]);

  const activeContentPanel = activePanelId ? panelLookup.get(activePanelId) ?? null : null;
  const chromeBar = (
    <TopBar
      appearance={resolvedAppearance}
      layoutProfile={activeLayoutProfile}
      layoutSourcePath={layoutConfigSource}
      panels={panelDefinitions}
      openPanelIds={openPanelIds}
      pinnedPanelIds={pinnedPanelIds}
      activePanelId={activePanelId}
      onPanelSelect={setActivePanelId}
      onPanelToggle={handleTogglePanel}
      onPanelClose={handleClosePanel}
      onPanelReorder={handleReorderPanels}
      onOpenSettings={handleOpenSettings}
      onCycleLayout={handleCycleLayout}
      onToggleOverlayAnchor={handleToggleOverlayAnchor}
      onClose={() => { void hideOverlay(); }}
      accent={accent}
      opacity={clampedAppOpacity}
      onOpacityChange={(v) => updateAppearance({ appOpacity: clampValue(v, APP_OPACITY_MIN, APP_OPACITY_MAX) })}
      zoom={clampedAppZoom}
      onZoomChange={(v) => updateAppearance({ appZoom: clampValue(v, APP_ZOOM_MIN, APP_ZOOM_MAX) })}
      showViewportControls={activeLayoutProfile.controlDock.enabled}
      blur={appBlur}
      onBlurChange={(v) => updateAppearance({ appBlur: v })}
      blurPlatform={runtimePlatform}
      overlayAnchor={overlayAnchor}
    />
  );

  return (
    <div
      className="overlay-window-host w-full h-full overflow-hidden"
      style={{
        ...(resolvedAppearance.cssVars as CSSProperties),
        backgroundColor: 'transparent',
      }}
      onDragStartCapture={handleDragStartCapture}
      onDragEndCapture={handleDragEndCapture}
      onDropCapture={handleDropCapture}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: isTopAnchored ? 0 : 'auto',
          bottom: isTopAnchored ? 'auto' : 0,
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            ...shellAnimationStyle,
            transform: combinedShellTransform,
            transformOrigin: isTopAnchored ? 'top left' : 'bottom left',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              width: '100%',
              height: '100%',
              backgroundColor: shellBackgroundColor,
              backgroundImage: theme.effects.backgroundImage,
              backgroundSize: theme.effects.backgroundSize,
              backgroundPosition: theme.effects.backgroundPosition,
              color: theme.palette.textPrimary,
              fontFamily: resolvedAppearance.fonts.ui,
              boxShadow: theme.effects.overlayShadow,
              borderTop: isTopAnchored ? 'none' : `1px solid ${accent}40`,
              borderBottom: isTopAnchored ? `1px solid ${accent}40` : 'none',
              borderTopLeftRadius: isTopAnchored ? 0 : 18,
              borderTopRightRadius: isTopAnchored ? 0 : 18,
              borderBottomLeftRadius: isTopAnchored ? 18 : 0,
              borderBottomRightRadius: isTopAnchored ? 18 : 0,
            }}
          >
            {shellEffectStyle && <div aria-hidden style={shellEffectStyle} />}

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {!isTopAnchored && (
                <div
                  className="h-[4px] shrink-0 cursor-ns-resize select-none"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
                  onPointerDown={e => {
                    if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('North').catch(() => {}); }
                  }}
                />
              )}

              {activeLayoutProfile.chrome.barPosition === 'top' && chromeBar}

              {/* ══ Content ══ */}
              <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {leftPinnedPanels.map(({ panel, definition }) => (
                  <LayoutPinnedPanelSlot key={`${panel.side}:${panel.panelId}`} panel={panel} definition={definition} />
                ))}

                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                  {panelDefinitions.map(panel => {
                    const isPanelOpen = openPanelIds.includes(panel.id);
                    const isActive = panel.id === activePanelId;
                    const isPinned = pinnedPanelIds.includes(panel.id);
                    const shouldMount = !isPinned && (panel.keepMounted ? true : isPanelOpen && isActive);

                    if (!shouldMount) return null;

                    return (
                      <div
                        key={panel.id}
                        style={{
                          flex: 1,
                          display: isPanelOpen && isActive ? 'flex' : 'none',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        {panel.render()}
                      </div>
                    );
                  })}

                  {!activeContentPanel && openPanels.length === 0 && (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.palette.textMuted,
                      fontSize: 13,
                      background: theme.palette.appBackground,
                      fontFamily: resolvedAppearance.fonts.ui,
                    }}
                    >
                      No tabbed panels are open. Use the panel menu to bring one back.
                    </div>
                  )}
                </div>

                {rightPinnedPanels.map(({ panel, definition }) => (
                  <LayoutPinnedPanelSlot key={`${panel.side}:${panel.panelId}`} panel={panel} definition={definition} />
                ))}
              </div>

              {activeLayoutProfile.chrome.barPosition === 'bottom' && chromeBar}

              {isTopAnchored && (
                <div
                  className="h-[4px] shrink-0 cursor-ns-resize select-none"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
                  onPointerDown={e => {
                    if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('South').catch(() => {}); }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function CompactScrubberControl({
  label,
  title,
  value,
  min,
  max,
  step,
  accent,
  border,
  muted,
  text,
  active,
  onActiveChange,
  onChange,
  onReset,
}: {
  label: string;
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accent: string;
  border: string;
  muted: string;
  text: string;
  active: boolean;
  onActiveChange: (next: boolean) => void;
  onChange: (value: number) => void;
  onReset: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleWheelAdjust = useCallback((event: { deltaY: number; shiftKey: boolean; preventDefault: () => void }) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    const multiplier = event.shiftKey ? 3 : 1;
    onChange(clampValue(value + (step * direction * multiplier), min, max));
  }, [max, min, onChange, step, value]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onActiveChange(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [active, onActiveChange]);

  const normalizedValue = (value - min) / (max - min);

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        title={title}
        onClick={() => onActiveChange(!active)}
        onDoubleClick={onReset}
        onWheel={handleWheelAdjust}
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          border: `1px solid ${active ? accent : border}`,
          background: active ? `${accent}18` : 'rgba(255,255,255,0.025)',
          color: active ? text : muted,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: active ? `0 0 0 1px ${accent}18 inset` : 'none',
        }}
      >
        <span style={{ fontSize: 8, lineHeight: 1, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 8, lineHeight: 1, color: active ? accent : text }}>
          {formatPercent(value)}
        </span>
      </button>

      {active && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 52,
            padding: '8px 6px',
            borderRadius: 12,
            border: `1px solid ${border}`,
            background: 'linear-gradient(180deg, rgba(12,14,24,0.94), rgba(8,10,18,0.92))',
            boxShadow: '0 12px 28px rgba(0,0,0,0.34)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 8, color: muted, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {label}
          </span>
          <div style={{ position: 'relative', width: 22, height: 118, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                width: 4,
                height: 110,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${normalizedValue * 100}%`,
                  background: `linear-gradient(180deg, ${accent}aa, ${accent})`,
                }}
              />
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={event => onChange(parseFloat(event.target.value))}
              onWheel={handleWheelAdjust}
              style={{
                width: 110,
                height: 22,
                margin: 0,
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                cursor: 'ns-resize',
                accentColor: accent,
                background: 'transparent',
              }}
            />
          </div>
          <button
            onClick={onReset}
            style={{
              width: '100%',
              height: 20,
              borderRadius: 8,
              border: `1px solid ${border}`,
              background: 'rgba(255,255,255,0.025)',
              color: text,
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function OverlayViewportDock({
  accent,
  border,
  muted,
  text,
  opacity,
  onOpacityChange,
  zoom,
  onZoomChange,
  blur,
  onBlurChange,
  blurPlatform,
}: {
  accent: string;
  border: string;
  muted: string;
  text: string;
  opacity: number;
  onOpacityChange: (v: number) => void;
  zoom: number;
  onZoomChange: (v: number) => void;
  blur: boolean;
  onBlurChange: (v: boolean) => void;
  blurPlatform: RuntimePlatform;
}) {
  const supportsNativeBlur = blurPlatform === 'macos' || blurPlatform === 'windows';
  const [activeControl, setActiveControl] = useState<'opacity' | 'zoom' | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <button
        onClick={() => onBlurChange(!blur)}
        title={supportsNativeBlur
          ? (blur ? 'Disable native window blur' : 'Enable native window blur')
          : 'Native blur is currently only available on macOS and Windows'}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: blur ? `${accent}22` : 'rgba(255,255,255,0.03)',
          border: `1px solid ${blur ? accent : border}`,
          color: blur ? accent : muted,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.15s',
          opacity: supportsNativeBlur ? 1 : 0.65,
          boxShadow: blur ? `0 0 0 1px ${accent}18 inset` : 'none',
        }}
      >
        <Droplet size={12} />
      </button>

      <CompactScrubberControl
        label="Op"
        title="Adjust window opacity."
        value={opacity}
        min={APP_OPACITY_MIN}
        max={APP_OPACITY_MAX}
        step={0.02}
        accent={accent}
        border={border}
        muted={muted}
        text={text}
        active={activeControl === 'opacity'}
        onActiveChange={next => setActiveControl(next ? 'opacity' : null)}
        onChange={onOpacityChange}
        onReset={() => onOpacityChange(1)}
      />

      <CompactScrubberControl
        label="Zm"
        title="Adjust window zoom."
        value={zoom}
        min={APP_ZOOM_MIN}
        max={APP_ZOOM_MAX}
        step={0.025}
        accent={accent}
        border={border}
        muted={muted}
        text={text}
        active={activeControl === 'zoom'}
        onActiveChange={next => setActiveControl(next ? 'zoom' : null)}
        onChange={onZoomChange}
        onReset={() => onZoomChange(1)}
      />
    </div>
  );
}

function TopBar({
  appearance,
  layoutProfile,
  layoutSourcePath,
  panels,
  openPanelIds,
  pinnedPanelIds,
  activePanelId,
  onPanelSelect,
  onPanelToggle,
  onPanelClose,
  onPanelReorder,
  onOpenSettings,
  onCycleLayout,
  onToggleOverlayAnchor,
  onClose,
  accent,
  opacity,
  onOpacityChange,
  zoom,
  onZoomChange,
  showViewportControls,
  blur,
  onBlurChange,
  blurPlatform,
  overlayAnchor,
}: {
  appearance: ResolvedOverlayAppearance;
  layoutProfile: LayoutProfile;
  layoutSourcePath: string | null;
  panels: OverlayPanelDefinition[];
  openPanelIds: string[];
  pinnedPanelIds: string[];
  activePanelId: string | null;
  onPanelSelect: (panelId: string | null) => void;
  onPanelToggle: (panelId: string) => void;
  onPanelClose: (panelId: string) => void;
  onPanelReorder: (draggedId: string, targetId: string) => void;
  onOpenSettings: () => void;
  onCycleLayout: () => void;
  onToggleOverlayAnchor: () => void;
  onClose: () => void;
  accent: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
  showViewportControls: boolean;
  blur: boolean;
  onBlurChange: (v: boolean) => void;
  blurPlatform: RuntimePlatform;
  overlayAnchor: OverlayWindowAnchor;
}) {
  const BG = appearance.theme.palette.topBarBackground;
  const MENU_BG = appearance.theme.palette.topBarMenuBackground;
  const BORDER = appearance.theme.palette.border;
  const MUTED = appearance.theme.palette.textMuted;
  const TEXT = appearance.theme.palette.textPrimary;
  const uiFont = appearance.fonts.ui;
  const monoFont = appearance.fonts.mono;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const isSettingsActive = activePanelId === 'settings';
  const supportsNativeBlur = blurPlatform === 'macos' || blurPlatform === 'windows';
  const isBottomBar = layoutProfile.chrome.barPosition === 'bottom';
  const openPanels = useMemo(
    () => getTabbedOpenPanelIds(layoutProfile, openPanelIds)
      .map(id => panels.find(panel => panel.id === id))
      .filter((panel): panel is OverlayPanelDefinition => Boolean(panel)),
    [layoutProfile, openPanelIds, panels],
  );
  const panelMenuWidth = Math.max(220, Math.min(320, viewportSize.width - 28));
  const panelMenuMaxHeight = Math.max(220, Math.min(540, viewportSize.height - 96));
  const compactPanelMenu = panelMenuWidth < 250;
  const nextOverlayAnchor = overlayAnchor === 'top' ? 'bottom' : 'top';
  const layoutButtonTitle = layoutSourcePath
    ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`
    : `Cycle Layout (${layoutProfile.label})\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`;

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const panelMenu = (
    <div style={{
      position: 'absolute',
      top: isBottomBar ? 'auto' : 'calc(100% + 8px)',
      bottom: isBottomBar ? 'calc(100% + 8px)' : 'auto',
      right: 0,
      width: panelMenuWidth,
      maxWidth: 'calc(100vw - 16px)',
      maxHeight: panelMenuMaxHeight,
      background: MENU_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      boxShadow: appearance.theme.effects.shadow,
      padding: 8,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
    }}
    >
      <div style={{
        padding: '6px 8px 10px',
        fontSize: 10,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
      }}
      >
        Available Panels
      </div>

      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ paddingRight: 2 }}>
        {panels.map(panel => {
          const isOpen = openPanelIds.includes(panel.id);
          const isActive = panel.id === activePanelId;
          const isPinned = pinnedPanelIds.includes(panel.id);
          const helperLabel = isPinned ? `Pinned by ${layoutProfile.label}` : panel.description;
          return (
            <button
              key={panel.id}
              onClick={() => {
                onPanelToggle(panel.id);
                setIsMenuOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: compactPanelMenu ? 8 : 10,
                padding: compactPanelMenu ? '9px 10px' : '10px 12px',
                border: 'none',
                borderRadius: 10,
                background: isActive ? `${accent}16` : 'transparent',
                color: TEXT,
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 4,
              }}
            >
              <span style={{
                width: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isOpen ? accent : 'transparent',
                flexShrink: 0,
              }}
              >
                <Check size={13} />
              </span>
              <span style={{ display: 'flex', color: isActive ? accent : MUTED, flexShrink: 0 }}>{panel.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: compactPanelMenu ? 11 : 12, fontWeight: 700 }}>{panel.label}</span>
                  {isPinned && (
                    <span style={{
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: accent,
                    }}
                    >
                      Pinned
                    </span>
                  )}
                </span>
                {!compactPanelMenu && (
                  <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
                    {helperLabel}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </OverlayScrollArea>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: 44,
      flexShrink: 0,
      background: `linear-gradient(180deg, ${BG}, ${appearance.theme.palette.appBackgroundAlt})`,
      borderBottom: isBottomBar ? 'none' : `1px solid ${accent}24`,
      borderTop: isBottomBar ? `1px solid ${accent}24` : 'none',
      boxShadow: isBottomBar
        ? 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 -8px 18px rgba(0,0,0,0.2)'
        : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.2)',
    }}>
      <button
        onClick={onCycleLayout}
        onContextMenu={event => {
          event.preventDefault();
          onToggleOverlayAnchor();
        }}
        title={layoutButtonTitle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          border: 'none',
          borderRight: `1px solid ${BORDER}`,
          flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${accent}24`,
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 0 1px ${accent}18 inset`,
        }}>
          <TerminalIcon size={10} style={{ color: accent }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEXT, fontFamily: uiFont, userSelect: 'none' }}>
            Snapyard
          </span>
          <span style={{ marginTop: 4, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, userSelect: 'none' }}>
            {layoutProfile.label}
          </span>
        </div>
      </button>

      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
        {layoutProfile.chrome.showSettingsShortcut && (
          <button
            onClick={onOpenSettings}
            title="Open Settings"
            style={{
              height: '100%',
              width: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isSettingsActive
                ? `linear-gradient(180deg, ${accent}32, ${accent}14)`
                : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              border: 'none',
              borderRight: `1px solid ${BORDER}`,
              borderLeft: `1px solid ${isSettingsActive ? `${accent}40` : BORDER}`,
              color: isSettingsActive ? TEXT : MUTED,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: isSettingsActive ? `inset 0 -2px 0 ${accent}, inset 0 0 0 1px ${accent}18` : 'inset 0 -2px 0 transparent',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s, border-color 0.15s',
            }}
          >
            <Settings2 size={14} style={{ color: isSettingsActive ? accent : MUTED }} />
          </button>
        )}

        <OverlayScrollArea direction="horizontal" style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.08)' }} contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}>
          {openPanels.map(panel => {
            const isActive = panel.id === activePanelId;
            const isDragged = draggedPanelId === panel.id;
            return (
              <button
                key={panel.id}
                draggable
                onClick={() => onPanelSelect(panel.id)}
                onDragStart={() => setDraggedPanelId(panel.id)}
                onDragEnd={() => setDraggedPanelId(null)}
                onDragOver={event => {
                  event.preventDefault();
                }}
                onDrop={event => {
                  event.preventDefault();
                  if (draggedPanelId && draggedPanelId !== panel.id) {
                    onPanelReorder(draggedPanelId, panel.id);
                  }
                  setDraggedPanelId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 12px',
                  cursor: 'pointer',
                  background: isActive ? `linear-gradient(180deg, ${accent}18, transparent)` : 'transparent',
                  border: 'none',
                  borderBottom: isBottomBar ? 'none' : `2px solid ${isActive ? accent : 'transparent'}`,
                  borderTop: isBottomBar ? `2px solid ${isActive ? accent : 'transparent'}` : 'none',
                  borderRight: `1px solid ${BORDER}`,
                  color: isActive ? TEXT : MUTED,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: uiFont,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
                  flexShrink: 0,
                  userSelect: 'none',
                  opacity: isDragged ? 0.45 : 1,
                }}
              >
                <span style={{ display: 'flex', color: isActive ? accent : MUTED }}>
                  <GripVertical size={11} />
                </span>
                <span style={{ display: 'flex', color: isActive ? accent : MUTED }}>{panel.icon}</span>
                <span>{panel.label}</span>
                {isActive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />}
                <span
                  onClick={event => {
                    event.stopPropagation();
                    onPanelClose(panel.id);
                  }}
                  title={`Close ${panel.label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    color: MUTED,
                  }}
                >
                  <X size={11} />
                </span>
              </button>
            );
          })}
        </OverlayScrollArea>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        borderLeft: `1px solid ${BORDER}`,
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.14), rgba(255,255,255,0.02))',
      }}>
        {layoutProfile.chrome.showPanelMenu && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginRight: 4 }}>
            <button
              onClick={() => setIsMenuOpen(open => !open)}
              title="Toggle Panels"
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isMenuOpen
                  ? `linear-gradient(180deg, ${accent}22, ${accent}12)`
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isMenuOpen ? `${accent}55` : BORDER}`,
                borderRadius: 6,
                color: isMenuOpen ? TEXT : MUTED,
                cursor: 'pointer',
                boxShadow: isMenuOpen ? `0 0 0 1px ${accent}22 inset` : 'none',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >
              <LayoutGrid size={12} style={{ color: isMenuOpen ? accent : MUTED }} />
            </button>

            {isMenuOpen && panelMenu}
          </div>
        )}

        {layoutProfile.chrome.showBlurToggle && showViewportControls && (
          <OverlayViewportDock
            accent={accent}
            border={BORDER}
            muted={MUTED}
            text={TEXT}
            opacity={opacity}
            onOpacityChange={onOpacityChange}
            zoom={zoom}
            onZoomChange={onZoomChange}
            blur={blur}
            onBlurChange={onBlurChange}
            blurPlatform={blurPlatform}
          />
        )}

        {layoutProfile.chrome.showBlurToggle && !showViewportControls && (
          <button
            onClick={() => onBlurChange(!blur)}
            title={supportsNativeBlur
              ? (blur ? 'Disable native window blur' : 'Enable native window blur')
              : 'Native blur is currently only available on macOS and Windows'}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              background: blur ? `${accent}22` : 'rgba(255,255,255,0.025)',
              border: `1px solid ${blur ? accent : BORDER}`,
              color: blur ? accent : MUTED,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
              opacity: supportsNativeBlur ? 1 : 0.65,
            }}
          >
            <Droplet size={12} />
          </button>
        )}

        {!layoutProfile.chrome.showBlurToggle && showViewportControls && (
          <OverlayViewportDock
            accent={accent}
            border={BORDER}
            muted={MUTED}
            text={TEXT}
            opacity={opacity}
            onOpacityChange={onOpacityChange}
            zoom={zoom}
            onZoomChange={onZoomChange}
            blur={blur}
            onBlurChange={onBlurChange}
            blurPlatform={blurPlatform}
          />
        )}

        {layoutProfile.chrome.showShortcutBadge && (
          <kbd style={{
            fontSize: 9, fontFamily: monoFont,
            background: 'rgba(255,255,255,0.04)',
            padding: '2px 6px', borderRadius: 999,
            border: `1px solid rgba(255,255,255,0.07)`,
            color: MUTED, userSelect: 'none', marginRight: 2,
          }}>
            Ctrl+Space
          </kbd>
        )}
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: MUTED, padding: 6, borderRadius: 5, display: 'flex', alignItems: 'center',
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; e.currentTarget.style.color = appearance.theme.palette.danger; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = MUTED; }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default App;
