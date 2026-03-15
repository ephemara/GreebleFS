import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import {
  Effect,
  EffectState,
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
import { useSettingsStore } from './store/settingsStore';
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

function getNativeWindowEffects(platform: RuntimePlatform): {
  effects: Effect[];
  state?: EffectState;
  radius?: number;
} | null {
  switch (platform) {
    case 'macos':
      return {
        effects: [Effect.Sidebar],
        state: EffectState.Active,
        radius: 14,
      };
    case 'windows':
      return {
        effects: [Effect.Blur],
      };
    default:
      return null;
  }
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
    y: args.workArea.position.y + args.workArea.size.height - height - physPad,
    healedHeight,
  };
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
  const refreshFolderPluginsRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([]);

  const settings = useSettingsStore(s => s.settings.terminal);
  const appearance = useSettingsStore(s => s.settings.appearance);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);
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
  });
  const shellEffectStyle = getOverlayEffectStyle({
    phase: overlayPhase,
    direction: overlayAnimationDirection,
    presetId: activeAnimationPresetId,
    durationMs: appAnimationDurationMs,
    intensity: appAnimationIntensity,
    accentColor: accent,
  });
  const combinedShellTransform = typeof shellAnimationStyle.transform === 'string'
    ? `${shellAnimationStyle.transform} scale(${clampedAppZoom})`
    : `scale(${clampedAppZoom})`;

  // ── Boot store ──
  useEffect(() => { initStore(); }, [initStore]);

  useEffect(() => {
    ensureFontFamilyLoaded(resolvedAppearance.fonts.ui);
    ensureFontFamilyLoaded(resolvedAppearance.fonts.mono);
  }, [resolvedAppearance.fonts.mono, resolvedAppearance.fonts.ui]);

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
      refreshFolderPlugins,
      resolvedAppearance,
    ],
  );
  const panelLookup = useMemo(
    () => new Map(panelDefinitions.map(panel => [panel.id, panel])),
    [panelDefinitions],
  );
  const defaultOpenPanelIds = useMemo(
    () => panelDefinitions.filter(panel => panel.defaultOpen).map(panel => panel.id),
    [panelDefinitions],
  );
  const openPanels = openPanelIds
    .map(id => panelLookup.get(id))
    .filter((panel): panel is OverlayPanelDefinition => Boolean(panel));

  useEffect(() => {
    if (hasInitializedPanelLayoutRef.current) {
      return;
    }

    hasInitializedPanelLayoutRef.current = true;
    setOpenPanelIds(defaultOpenPanelIds);
    if (defaultOpenPanelIds.length > 0) {
      setActivePanelId(current => current ?? defaultOpenPanelIds[0]);
    }
  }, [defaultOpenPanelIds]);

  useEffect(() => {
    const availablePanelIds = panelDefinitions.map(panel => panel.id);
    setOpenPanelIds(current => syncOpenPanelIds(current, availablePanelIds, defaultOpenPanelIds));
    setActivePanelId(current => {
      if (!current) return null;
      return panelLookup.has(current) ? current : null;
    });
  }, [defaultOpenPanelIds, panelDefinitions, panelLookup]);

  useEffect(() => {
    if (activePanelId) return;
    if (openPanelIds.length === 0) return;
    setActivePanelId(openPanelIds[0]);
  }, [activePanelId, openPanelIds]);

  const handleTogglePanel = useCallback((panelId: string) => {
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
  }, []);

  const handleClosePanel = useCallback((panelId: string) => {
    setOpenPanelIds(current => {
      const next = current.filter(id => id !== panelId);
      setActivePanelId(active => (active === panelId ? getNextActivePanelId(current, panelId) : active));
      return next;
    });
  }, []);

  const handleReorderPanels = useCallback((draggedId: string, targetId: string) => {
    setOpenPanelIds(current => reorderPanelIds(current, draggedId, targetId));
  }, []);

  const handleOpenSettings = useCallback(() => {
    setOpenPanelIds(current => (current.includes('settings') ? current : [...current, 'settings']));
    setActivePanelId('settings');
  }, []);

  useEffect(() => {
    const windowEffects = getNativeWindowEffects(runtimePlatform);

    if (!windowEffects) {
      return;
    }

    let cancelled = false;

    const syncWindowEffects = async () => {
      try {
        const win = getCurrentWindow();
        const shouldApplyEffects = appBlur && overlayPhase === 'open';
        if (!shouldApplyEffects) {
          await win.clearEffects();
          return;
        }
        await win.setEffects(windowEffects);
      } catch (error) {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to apply native window blur', error);
        }
      }
    };

    syncWindowEffects();

    return () => {
      cancelled = true;
    };
  }, [appBlur, overlayPhase, runtimePlatform]);

  return (
    <div
      className="overlay-window-host w-screen h-screen overflow-hidden"
      style={{
        ...(resolvedAppearance.cssVars as CSSProperties),
        backgroundColor: 'transparent',
      }}
    >
      <div
        className="absolute left-0 bottom-0"
        style={{
          ...shellAnimationStyle,
          width: scaledWidth,
          height: scaledHeight,
          transform: combinedShellTransform,
          transformOrigin: 'bottom left',
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
            borderTop: `1px solid ${accent}40`,
          }}
        >
          {shellEffectStyle && <div aria-hidden style={shellEffectStyle} />}

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* ══ Grab handle ══ */}
            <div
              className="h-[4px] shrink-0 cursor-ns-resize select-none"
              style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
              onPointerDown={e => {
                if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('North').catch(() => {}); }
              }}
            />

            {/* ══ App-level Top Bar ══ */}
            <TopBar
              appearance={resolvedAppearance}
              panels={panelDefinitions}
              openPanelIds={openPanelIds}
              activePanelId={activePanelId}
              onPanelSelect={setActivePanelId}
              onPanelToggle={handleTogglePanel}
              onPanelClose={handleClosePanel}
              onPanelReorder={handleReorderPanels}
              onOpenSettings={handleOpenSettings}
              onClose={() => { void hideOverlay(); }}
              accent={accent}
              blur={appBlur}
              onBlurChange={(v) => updateAppearance({ appBlur: v })}
              blurPlatform={runtimePlatform}
            />

            {/* ══ Content ══ */}
            <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <OverlayViewportDock
                accent={accent}
                border={theme.palette.border}
                muted={theme.palette.textMuted}
                text={theme.palette.textPrimary}
                opacity={clampedAppOpacity}
                onOpacityChange={(v) => updateAppearance({ appOpacity: clampValue(v, APP_OPACITY_MIN, APP_OPACITY_MAX) })}
                zoom={clampedAppZoom}
                onZoomChange={(v) => updateAppearance({ appZoom: clampValue(v, APP_ZOOM_MIN, APP_ZOOM_MAX) })}
                blur={appBlur}
                onBlurChange={(v) => updateAppearance({ appBlur: v })}
                blurPlatform={runtimePlatform}
              />
              {panelDefinitions.map(panel => {
                const isPanelOpen = openPanelIds.includes(panel.id);
                const isActive = panel.id === activePanelId;
                const shouldMount = panel.keepMounted ? true : isPanelOpen && isActive;

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

              {openPanels.length === 0 && (
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
                  No panels are open. Use the panel menu to bring one back.
                </div>
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
            top: -8,
            right: 'calc(100% + 8px)',
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
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: 6,
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: 'linear-gradient(180deg, rgba(14,16,28,0.86), rgba(10,12,22,0.8))',
        boxShadow: '0 10px 24px rgba(0,0,0,0.24)',
        backdropFilter: 'blur(12px)',
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

function TopBar({ appearance, panels, openPanelIds, activePanelId, onPanelSelect, onPanelToggle, onPanelClose, onPanelReorder, onOpenSettings, onClose, accent, blur, onBlurChange, blurPlatform }: {
  appearance: ResolvedOverlayAppearance;
  panels: OverlayPanelDefinition[];
  openPanelIds: string[];
  activePanelId: string | null;
  onPanelSelect: (panelId: string | null) => void;
  onPanelToggle: (panelId: string) => void;
  onPanelClose: (panelId: string) => void;
  onPanelReorder: (draggedId: string, targetId: string) => void;
  onOpenSettings: () => void;
  onClose: () => void;
  accent: string;
  blur: boolean;
  onBlurChange: (v: boolean) => void;
  blurPlatform: RuntimePlatform;
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
  const isSettingsActive = activePanelId === 'settings';
  const supportsNativeBlur = blurPlatform === 'macos' || blurPlatform === 'windows';
  const openPanels = useMemo(
    () => openPanelIds
      .map(id => panels.find(panel => panel.id === id))
      .filter((panel): panel is OverlayPanelDefinition => Boolean(panel)),
    [openPanelIds, panels],
  );

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

  const panelMenu = (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: 260,
      background: MENU_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      boxShadow: appearance.theme.effects.shadow,
      padding: 8,
      zIndex: 50,
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

      {panels.map(panel => {
        const isOpen = openPanelIds.includes(panel.id);
        const isActive = panel.id === activePanelId;
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
              gap: 10,
              padding: '10px 12px',
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
            }}
            >
              <Check size={13} />
            </span>
            <span style={{ display: 'flex', color: isActive ? accent : MUTED }}>{panel.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>{panel.label}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
                {panel.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: 44,
      flexShrink: 0,
      background: `linear-gradient(180deg, ${BG}, ${appearance.theme.palette.appBackgroundAlt})`,
      borderBottom: `1px solid ${accent}24`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.2)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        borderRight: `1px solid ${BORDER}`,
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
      }}>
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
            Overlay Shell
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
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

        <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden', background: 'rgba(0,0,0,0.08)' }}>
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
                  borderBottom: `2px solid ${isActive ? accent : 'transparent'}`,
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
        </div>
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

        <kbd style={{
          fontSize: 9, fontFamily: monoFont,
          background: 'rgba(255,255,255,0.04)',
          padding: '2px 6px', borderRadius: 999,
          border: `1px solid rgba(255,255,255,0.07)`,
          color: MUTED, userSelect: 'none', marginRight: 2,
        }}>
          Ctrl+Space
        </kbd>
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
