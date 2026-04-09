import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useShallow } from 'zustand/react/shallow';
import {
  getCurrentWindow,
  PhysicalSize,
  PhysicalPosition,
  primaryMonitor,
} from '@tauri-apps/api/window';
import {
  createBuiltInPanelDefinitions,
  createFolderPluginPanelDefinitions,
  type OverlayPanelDefinition,
} from './panels/panelRegistry';
import { FolderPluginRenderer, PluginsManager } from './components/PluginsManager';
import { CommandPalette, type OverlayCommandPaletteAction } from './components/CommandPalette';
import { animationSystemConfig, resolvePreferredAnimationId } from './config/animations';
import {
  recordOverlayFrameTelemetry,
  shouldFlushOverlayFrameWindow,
  summarizeOverlayFrameWindow,
} from './config/frameTelemetry';
import {
  pluginSystemConfig,
} from './config/plugins';
import {
  AnimationOverlayLayer,
  createBuiltInOverlayAnimations,
  isFrontendAnimationFile,
  loadAnimationFromSource,
  mergeOverlayAnimations,
  resolveAnimationDurationMs,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
} from './components/animationRuntime';
import { shaderSystemConfig, resolvePreferredShaderId } from './config/shaders';
import {
  ShaderSurfaceLayer,
  createBuiltInOverlayShaders,
  isFrontendShaderFile,
  loadShaderFromSource,
  mergeOverlayShaders,
  resolveShaderControlValues,
  type LoadedOverlayShader,
  type OverlayShaderShellContext,
} from './components/shaderRuntime';
import {
  Check,
  ChevronDown,
  Droplet,
  LayoutGrid,
  Search,
  Settings2,
  SlidersHorizontal,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import {
  ensureFontFamilyLoaded,
  resolveOverlayAppearance,
  setOverlayPluginFonts,
  type ResolvedOverlayAppearance,
} from './config/appearance';
import { loadThemePackages as discoverThemePackages, themeSystemConfig, type LoadedOverlayThemePackage } from './config/themePackages';
import { dispatchTerminalCommand } from './config/pluginContributions';
import { formatHotkeyLabel, matchesWheelHotkey } from './config/hotkeys';
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
  type OverlayAnimationDirection,
  type OverlayAnimationPhase,
} from './config/overlayAnimations';
import {
  clampOverlayWindowBoundsToWorkArea,
  computeOverlayWindowLayout,
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  type OverlayWindowBounds,
  overlayWindowGeometry,
  overlayVisualControls,
} from './config/overlayWindow';
import { detectClientPlatform, type RuntimePlatform } from './config/platform';
import { derivePanelOpenState, reorderPanelIds } from './components/panelUtils';
import { OverlayScrollArea } from './components/OverlayScrollArea';
import { WindowControls } from './components/WindowControls';
import { useGlobalShortcut } from './input/GlobalShortcuts';
import {
  buildThemeVisualStyle,
  computePanelWindowLayout,
  ensureDir,
  parseExternalArgs,
} from './runtime/overlayRuntimeUtils';
import { listExplorerDir, openExplorerPath } from './runtime/explorerBackend';
import { commands, unwrapTauriResult } from './runtime/tauriClient';
import { useFolderPluginRuntime } from './runtime/useFolderPluginRuntime';
import {
  useSettingsStore,
  type LayoutPanelState,
  type OverlayWindowAnchor,
  type TerminalWindowMode,
} from './store/settingsStore';
import { useTerminalStore } from './store/terminalStore';

const FRAME_PROBE_OUTPUT_PATH = (() => {
  if (typeof window !== 'undefined') {
    const value = new URLSearchParams(window.location.search).get('frameProbeFile')?.trim();
    if (value) {
      return value;
    }
  }

  return (
    import.meta.env as { VITE_OVERLAYTERM_FRAME_PROBE_FILE?: string }
  ).VITE_OVERLAYTERM_FRAME_PROBE_FILE?.trim() ?? '';
})();

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampUnit(value: number): number {
  return clampValue(value, 0, 1);
}

function applyWheelVisualControlAdjust(args: {
  event: WheelEvent;
  binding: string;
  currentValue: number;
  min: number;
  max: number;
  step: number;
  direction: 1 | -1;
  multiplier: number;
  onChange: (value: number) => void;
}): boolean {
  if (!matchesWheelHotkey(args.event, args.binding) || args.event.deltaY === 0) {
    return false;
  }

  args.event.preventDefault();
  const nextValue = clampValue(
    args.currentValue + (args.step * args.direction * args.multiplier),
    args.min,
    args.max,
  );
  args.onChange(nextValue);
  return true;
}

function parseHexColor(color: string): { red: number; green: number; blue: number; alpha: number } | null {
  const match = color.trim().match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (!match) {
    return null;
  }

  const value = match[1];
  if (value.length === 3 || value.length === 4) {
    const [red, green, blue, alpha = 'f'] = value.split('');
    return {
      red: parseInt(red + red, 16),
      green: parseInt(green + green, 16),
      blue: parseInt(blue + blue, 16),
      alpha: parseInt(alpha + alpha, 16) / 255,
    };
  }

  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
    alpha: value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1,
  };
}

function parseFunctionalColor(color: string): { red: number; green: number; blue: number; alpha: number } | null {
  const match = color.trim().match(/^rgba?\((.+)\)$/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map(part => part.trim());
  if (parts.length < 3) {
    return null;
  }

  const red = Number(parts[0]);
  const green = Number(parts[1]);
  const blue = Number(parts[2]);
  const alpha = parts[3] === undefined ? 1 : Number(parts[3]);
  if ([red, green, blue, alpha].some(part => Number.isNaN(part))) {
    return null;
  }

  return { red, green, blue, alpha };
}

function parseColor(color: string): { red: number; green: number; blue: number; alpha: number } | null {
  return parseFunctionalColor(color) ?? parseHexColor(color);
}

function withColorAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) {
    return color;
  }

  return `rgba(${parsed.red}, ${parsed.green}, ${parsed.blue}, ${clampUnit(alpha).toFixed(3)})`;
}

function getColorAlpha(color: string, fallback: number): number {
  return parseColor(color)?.alpha ?? fallback;
}

function resolveShellBackgroundColor(
  translucentColor: string,
  solidColor: string,
  blurStrength: number,
): string {
  const normalizedStrength = overlayVisualControls.blurStrength.max > 0
    ? clampOverlayVisualControlValue('blurStrength', blurStrength) / overlayVisualControls.blurStrength.max
    : 0;
  const solidAlpha = getColorAlpha(solidColor, 0.96);
  const translucentAlpha = getColorAlpha(translucentColor, Math.min(0.82, solidAlpha));
  const minimumGlassAlpha = Math.max(0.16, translucentAlpha * 0.45);
  const targetAlpha = solidAlpha - ((solidAlpha - minimumGlassAlpha) * normalizedStrength);
  return withColorAlpha(translucentColor, targetAlpha);
}

const EMPTY_LAYOUT_PANEL_STATE: LayoutPanelState = {
  openPanelIds: [],
  activePanelId: null,
  dismissedPanelIds: [],
};

function uniquePanelIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areLayoutPanelStatesEqual(left: LayoutPanelState, right: LayoutPanelState): boolean {
  return left.activePanelId === right.activePanelId
    && areStringArraysEqual(left.openPanelIds, right.openPanelIds)
    && areStringArraysEqual(left.dismissedPanelIds, right.dismissedPanelIds);
}

function sanitizeLayoutPanelState(
  panelState: LayoutPanelState | undefined,
  availablePanelIds: string[],
  pinnedPanelIds: string[],
): LayoutPanelState {
  const source = panelState ?? EMPTY_LAYOUT_PANEL_STATE;
  const availableSet = new Set(availablePanelIds);
  const pinnedSet = new Set(pinnedPanelIds);
  const normalizeIds = (ids: string[]) => uniquePanelIds(
    ids.filter(id => availableSet.has(id) && !pinnedSet.has(id)),
  );

  const activePanelId = source.activePanelId && availableSet.has(source.activePanelId) && !pinnedSet.has(source.activePanelId)
    ? source.activePanelId
    : null;

  return {
    openPanelIds: normalizeIds(source.openPanelIds),
    activePanelId,
    dismissedPanelIds: normalizeIds(source.dismissedPanelIds),
  };
}

function resolveActiveTabPanelId(args: {
  activePanelId: string | null;
  openPanelIds: string[];
  defaultActivePanelId: string;
}): string | null {
  if (args.openPanelIds.length === 0) {
    return null;
  }

  if (args.activePanelId && args.openPanelIds.includes(args.activePanelId)) {
    return args.activePanelId;
  }

  if (args.defaultActivePanelId && args.openPanelIds.includes(args.defaultActivePanelId)) {
    return args.defaultActivePanelId;
  }

  return args.openPanelIds[0] ?? null;
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
  const [activeAnimation, setActiveAnimation] = useState<LoadedOverlayAnimation | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [authoredAnimations, setAuthoredAnimations] = useState<LoadedOverlayAnimation[]>([]);
  const [authoredAnimationsError, setAuthoredAnimationsError] = useState<string | null>(null);
  const [authoredAnimationsLoading, setAuthoredAnimationsLoading] = useState(true);
  const [authoredShaders, setAuthoredShaders] = useState<LoadedOverlayShader[]>([]);
  const [authoredShadersError, setAuthoredShadersError] = useState<string | null>(null);
  const [authoredShadersLoading, setAuthoredShadersLoading] = useState(true);
  const [themeContributedAnimations, setThemeContributedAnimations] = useState<LoadedOverlayAnimation[]>([]);
  const [themeContributedShaders, setThemeContributedShaders] = useState<LoadedOverlayShader[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const builtInAnimations = useMemo(() => createBuiltInOverlayAnimations(), []);
  const builtInShaders = useMemo(() => createBuiltInOverlayShaders(), []);
  const overlayPhaseRef = useRef<OverlayAnimationPhase>('closed');
  overlayPhaseRef.current = overlayPhase;
  const overlayVisibleRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationCommitTimerRef = useRef<number | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  const lastTerminalFocusAtRef = useRef(0);
  const isProgrammaticResizeRef = useRef(false);
  const runtimeOverlayBoundsRef = useRef<OverlayWindowBounds | null>(null);
  const interactionLockUntilRef = useRef(0);
  const windowModeRef = useRef<TerminalWindowMode>('overlay');
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const animationSignatureRef = useRef('');
  const shaderSignatureRef = useRef('');
  const authoredAnimationsRefreshInFlightRef = useRef(false);
  const authoredAnimationsRefreshQueuedRef = useRef(false);
  const authoredShadersRefreshInFlightRef = useRef(false);
  const authoredShadersRefreshQueuedRef = useRef(false);
  const frameTelemetryContextRef = useRef<{
    activePanelId: string | null;
    openPanelCount: number;
    windowMode: TerminalWindowMode;
  }>({
    activePanelId: null,
    openPanelCount: 0,
    windowMode: 'overlay',
  });
  const dragHideRestoreRef = useRef(false);
  const openTerminalPanelRef = useRef<() => void>(() => undefined);
  // Tracks whether the overlay has been dragged away from its anchor position
  const isFreefloatingRef = useRef(false);
  const [layoutManifest, setLayoutManifest] = useState(BUILT_IN_LAYOUT_MANIFEST);
  const [layoutConfigSource, setLayoutConfigSource] = useState<string | null>(null);
  const [themePackages, setThemePackages] = useState<LoadedOverlayThemePackage[]>([]);
  const [themePackagesLoading, setThemePackagesLoading] = useState(true);
  const [themePackagesError, setThemePackagesError] = useState<string | null>(null);
  const [themePackagesWarnings, setThemePackagesWarnings] = useState<string[]>([]);
  const [repositoryPickerRequestId, setRepositoryPickerRequestId] = useState(0);
  const [isRepositoryPickerActive, setIsRepositoryPickerActive] = useState(false);
  const [pendingRepositoryImports, setPendingRepositoryImports] = useState<string[]>([]);

  const {
    settings,
    appearance,
    keybindings,
    layoutSettings,
    systemSettings,
    updateTerminal,
    updateAppearance,
    updateLayout,
    updateSystem,
  } = useSettingsStore(useShallow(state => ({
    settings: state.settings.terminal,
    appearance: state.settings.appearance,
    keybindings: state.settings.keybindings,
    layoutSettings: state.settings.layout,
    systemSettings: state.settings.system,
    updateTerminal: state.updateTerminal,
    updateAppearance: state.updateAppearance,
    updateLayout: state.updateLayout,
    updateSystem: state.updateSystem,
  })));
  const {
    initStore: initTerminalStore,
    addDirectoryBookmark,
  } = useTerminalStore(useShallow(state => ({
    initStore: state.initStore,
    addDirectoryBookmark: state.addDirectoryBookmark,
  })));
  const {
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
  } = useFolderPluginRuntime(runtimePlatform);
  const combinedThemePackages = useMemo(
    () => [...themePackages, ...pluginThemePackages],
    [pluginThemePackages, themePackages],
  );
  const resolvedPackageThemes = useMemo(
    () => combinedThemePackages.map(pkg => pkg.theme),
    [combinedThemePackages],
  );
  const resolvedAppearance = useMemo(
    () => resolveOverlayAppearance({
      activeThemeId: appearance.activeThemeId,
      customThemes: appearance.customThemes,
      packageThemes: resolvedPackageThemes,
      uiFontFamily: appearance.uiFontFamily,
      monoFontFamily: settings.fontFamily,
      panelTransparency: appearance.panelTransparency,
    }),
    [appearance.activeThemeId, appearance.customThemes, appearance.panelTransparency, appearance.uiFontFamily, resolvedPackageThemes, settings.fontFamily],
  );
  const theme = resolvedAppearance.theme;
  const accent = theme.palette.accent;
  const workbench = resolvedAppearance.workbenchTheme;
  const isOverlayVisible = overlayPhase !== 'closed';
  overlayVisibleRef.current = isOverlayVisible;
  const windowMode: TerminalWindowMode = settings.windowMode === 'windowed' ? 'windowed' : 'overlay';
  windowModeRef.current = windowMode;
  const isWindowedMode = windowMode === 'windowed';
  const shouldShowInTaskbar = systemSettings.showInTaskbar || isWindowedMode;
  const appOpacity = appearance.appOpacity ?? 1.0;
  const panelTransparency = appearance.panelTransparency ?? overlayVisualControls.panelTransparency.defaultValue;
  const appZoom = appearance.appZoom ?? 1.0;
  const appBlur = appearance.appBlur ?? true;
  const appBlurStrength = appearance.appBlurStrength ?? overlayVisualControls.blurStrength.defaultValue;
  const animationsEnabled = appearance.animations ?? true;
  const appAnimationDurationMs = animationsEnabled
    ? clampOverlayAnimationDuration(appearance.appAnimationDurationMs ?? 320)
    : 140;
  const appAnimationIntensity = clampOverlayAnimationIntensity(appearance.appAnimationIntensity ?? 1);
  const clampedAppOpacity = clampOverlayVisualControlValue('opacity', appOpacity);
  const clampedPanelTransparency = clampOverlayVisualControlValue('panelTransparency', panelTransparency);
  const clampedAppZoom = clampOverlayVisualControlValue('zoom', appZoom);
  const clampedAppBlurStrength = clampOverlayVisualControlValue('blurStrength', appBlurStrength);
  const overlayAnchor: OverlayWindowAnchor = settings.overlayAnchor === 'top' ? 'top' : 'bottom';
  const isTopAnchored = !isWindowedMode && overlayAnchor === 'top';
  const effectiveWindowZoom = isWindowedMode && isWindowMaximized ? 1 : clampedAppZoom;
  const scaledWidth = `${100 / effectiveWindowZoom}%`;
  const scaledHeight = `${100 / effectiveWindowZoom}%`;
  const shellBackgroundColor = appBlur
    ? resolveShellBackgroundColor(theme.palette.shellBackground, theme.palette.shellBackgroundSolid, clampedAppBlurStrength)
    : theme.palette.shellBackgroundSolid;
  const blurStrengthRatio = overlayVisualControls.blurStrength.max > 0
    ? clampedAppBlurStrength / overlayVisualControls.blurStrength.max
    : 0;
  const shellBackdropFilter = appBlur && clampedAppBlurStrength > 0
    ? `blur(${clampedAppBlurStrength}px) saturate(${(1.05 + blurStrengthRatio * 0.35).toFixed(2)})`
    : 'none';
  const availableAnimations = useMemo(
    () => mergeOverlayAnimations(builtInAnimations, [...authoredAnimations, ...themeContributedAnimations]),
    [authoredAnimations, builtInAnimations, themeContributedAnimations],
  );
  const availableShaders = useMemo(
    () => mergeOverlayShaders(builtInShaders, [...authoredShaders, ...themeContributedShaders, ...pluginContributedShaders]),
    [authoredShaders, builtInShaders, pluginContributedShaders, themeContributedShaders],
  );
  const availableAnimationsById = useMemo(
    () => new Map(availableAnimations.map(animation => [animation.id, animation])),
    [availableAnimations],
  );
  const resolvedOpenAnimationId = useMemo(
    () => animationsEnabled
      ? resolvePreferredAnimationId({
          availableAnimationIds: availableAnimationsById.keys(),
          userOverrideId: appearance.appOpenAnimation,
          themeDefaultAnimationId: resolvedAppearance.baseTheme.defaultOpenAnimationId,
          fallbackAnimationId: animationSystemConfig.defaultOpenAnimationId,
        })
      : 'none',
    [animationsEnabled, appearance.appOpenAnimation, availableAnimationsById, resolvedAppearance.baseTheme.defaultOpenAnimationId],
  );
  const resolvedCloseAnimationId = useMemo(
    () => animationsEnabled
      ? resolvePreferredAnimationId({
          availableAnimationIds: availableAnimationsById.keys(),
          userOverrideId: appearance.appCloseAnimation,
          themeDefaultAnimationId: resolvedAppearance.baseTheme.defaultCloseAnimationId,
          fallbackAnimationId: animationSystemConfig.defaultCloseAnimationId,
        })
      : 'none',
    [animationsEnabled, appearance.appCloseAnimation, availableAnimationsById, resolvedAppearance.baseTheme.defaultCloseAnimationId],
  );
  const availableShadersById = useMemo(
    () => new Map(availableShaders.map(shader => [shader.id, shader])),
    [availableShaders],
  );
  const resolvedShaderId = useMemo(
    () => resolvePreferredShaderId({
      availableShaderIds: availableShadersById.keys(),
      userOverrideId: appearance.activeShaderId,
      themeDefaultShaderId: resolvedAppearance.baseTheme.defaultShaderId,
      fallbackShaderId: shaderSystemConfig.fallbackShaderId,
    }),
    [appearance.activeShaderId, availableShadersById, resolvedAppearance.baseTheme.defaultShaderId],
  );
  const activeShader = availableShadersById.get(resolvedShaderId)
    ?? availableShadersById.get(shaderSystemConfig.fallbackShaderId)
    ?? builtInShaders[0]
    ?? null;
  const activeShaderControlValues = useMemo(
    () => resolveShaderControlValues(
      activeShader,
      appearance.shaderControlValues?.[resolvedShaderId],
    ),
    [activeShader, appearance.shaderControlValues, resolvedShaderId],
  );
  const resolveAnimationById = useCallback((id: string, fallbackId: string) => (
    availableAnimationsById.get(id)
      ?? availableAnimationsById.get(fallbackId)
      ?? builtInAnimations[0]
      ?? null
  ), [availableAnimationsById, builtInAnimations]);
  const shellAnimation = activeAnimation ?? resolveAnimationById(
    overlayAnimationDirection === 'exit' ? resolvedCloseAnimationId : resolvedOpenAnimationId,
    overlayAnimationDirection === 'exit'
      ? animationSystemConfig.defaultCloseAnimationId
      : animationSystemConfig.defaultOpenAnimationId,
  );
  const shellAnimationDurationMs = resolveAnimationDurationMs(
    shellAnimation,
    overlayAnimationDirection,
    appAnimationDurationMs,
  );
  const shellAnimationContext = useMemo(() => ({
    animation: shellAnimation ?? {
      id: animationSystemConfig.defaultOpenAnimationId,
      name: 'Animation',
      filePath: 'builtin:animation',
      animationRoot: 'builtin',
      source: 'built-in' as const,
    },
    phase: overlayPhase,
    direction: overlayAnimationDirection,
    progress: animationProgress,
    durationMs: shellAnimationDurationMs,
    baseOpacity: clampedAppOpacity,
    intensity: appAnimationIntensity,
    verticalOrigin: overlayAnchor,
    accentColor: accent,
    blurStrength: clampedAppBlurStrength,
    zoom: effectiveWindowZoom,
    theme,
    viewport: {
      width: typeof window === 'undefined' ? 0 : window.innerWidth,
      height: typeof window === 'undefined' ? 0 : window.innerHeight,
      anchoredTo: overlayAnchor,
    },
  }), [
    accent,
    animationProgress,
    appAnimationIntensity,
    clampedAppBlurStrength,
    clampedAppOpacity,
    effectiveWindowZoom,
    overlayAnimationDirection,
    overlayAnchor,
    overlayPhase,
    shellAnimation,
    shellAnimationDurationMs,
    theme,
  ]);
  const shellAnimationStyle = resolveAnimationShellStyle(shellAnimation, shellAnimationContext);
  const combinedShellTransform = typeof shellAnimationStyle.transform === 'string'
    ? `${shellAnimationStyle.transform} scale(${effectiveWindowZoom})`
    : `scale(${effectiveWindowZoom})`;
  const activeLayoutProfile = useMemo(
    () => resolveLayoutProfile(layoutManifest, layoutSettings.activeProfileId),
    [layoutManifest, layoutSettings.activeProfileId],
  );
  const pinnedExplorerPanel = useMemo(
    () => activeLayoutProfile.pinnedPanels.find(panel => panel.panelId === 'explorer') ?? null,
    [activeLayoutProfile],
  );
  const setPanelOpenStateDirectly = useCallback((panelId: string) => {
    const settingsState = useSettingsStore.getState();
    const currentByProfile = settingsState.settings.layout.panelStateByProfile;
    const currentState = currentByProfile[activeLayoutProfile.id] ?? EMPTY_LAYOUT_PANEL_STATE;
    const openPanelIds = Array.isArray(currentState.openPanelIds)
      ? currentState.openPanelIds.filter((value): value is string => typeof value === 'string')
      : [];
    const dismissedPanelIds = Array.isArray(currentState.dismissedPanelIds)
      ? currentState.dismissedPanelIds.filter((value): value is string => typeof value === 'string')
      : [];
    const activePanelId = typeof currentState.activePanelId === 'string' ? currentState.activePanelId : null;
    const isPinned = activeLayoutProfile.pinnedPanels.some(panel => panel.panelId === panelId);

    settingsState.updateLayout({
      panelStateByProfile: {
        ...currentByProfile,
        [activeLayoutProfile.id]: {
          openPanelIds: uniquePanelIds([...openPanelIds, panelId]),
          activePanelId: isPinned ? activePanelId : panelId,
          dismissedPanelIds: dismissedPanelIds.filter(id => id !== panelId),
        },
      },
    });
  }, [activeLayoutProfile.id, activeLayoutProfile.pinnedPanels]);
  const handleRequestRepositoryImport = useCallback(() => {
    setPendingRepositoryImports([]);
    setRepositoryPickerRequestId(current => current + 1);
    setIsRepositoryPickerActive(true);
    setPanelOpenStateDirectly('explorer');
  }, [setPanelOpenStateDirectly]);
  const handleCancelRepositoryImport = useCallback(() => {
    setIsRepositoryPickerActive(false);
  }, []);
  const handleConfirmRepositoryImport = useCallback((paths: string[]) => {
    const normalizedPaths = Array.from(new Set(paths.map(path => path.trim()).filter(Boolean)));
    setIsRepositoryPickerActive(false);
    if (normalizedPaths.length === 0) {
      return;
    }
    setPendingRepositoryImports(normalizedPaths);
    setPanelOpenStateDirectly('git');
  }, [setPanelOpenStateDirectly]);
  const handleRepositoryImportsHandled = useCallback(() => {
    setPendingRepositoryImports([]);
  }, []);

  // ── Boot store ──
  useEffect(() => { initTerminalStore(); }, [initTerminalStore]);

  useEffect(() => {
    if (!FRAME_PROBE_OUTPUT_PATH || !isTauri()) {
      return;
    }

    void commands.fsWriteFile(FRAME_PROBE_OUTPUT_PATH, {
      kind: 'text',
      value: JSON.stringify({
        status: 'boot',
        recordedAt: Date.now(),
      }, null, 2),
    }).then(unwrapTauriResult).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    commands.startupGetLaunchAtStartup()
      .then(unwrapTauriResult)
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
    if (!isTauri()) {
      return;
    }

    commands.traySetVisible(systemSettings.hideAppInTray).then(unwrapTauriResult).catch(error => {
      console.warn('OverlayTerm: failed to sync tray visibility', error);
    });
  }, [systemSettings.hideAppInTray]);

  useEffect(() => {
    setOverlayPluginFonts(pluginFonts);
  }, [pluginFonts]);

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
    if (animationCommitTimerRef.current !== null) {
      window.clearTimeout(animationCommitTimerRef.current);
      animationCommitTimerRef.current = null;
    }
    if (progressFrameRef.current !== null) {
      window.cancelAnimationFrame(progressFrameRef.current);
      progressFrameRef.current = null;
    }
  }, []);

  const startAnimationProgress = useCallback((durationMs: number) => {
    setAnimationProgress(0);
    const safeDurationMs = Math.max(durationMs, 1);
    const startedAt = performance.now();

    const tick = (frameNow: number) => {
      const nextProgress = clampValue((frameNow - startedAt) / safeDurationMs, 0, 1);
      setAnimationProgress(nextProgress);
      if (nextProgress >= 1) {
        progressFrameRef.current = null;
        return;
      }
      progressFrameRef.current = window.requestAnimationFrame(tick);
    };

    progressFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const markOverlayRuntimePhase = useCallback((phase: OverlayAnimationPhase, visible: boolean) => {
    overlayPhaseRef.current = phase;
    overlayVisibleRef.current = visible;
  }, []);

  const openWithoutMonitorLayout = useCallback(async (win: ReturnType<typeof getCurrentWindow>) => {
    await win.show();
    await win.unminimize().catch(() => {});
    await win.setFocus();
    markOverlayRuntimePhase('open', true);
    setOverlayPhase('open');
    setAnimationProgress(1);
  }, [markOverlayRuntimePhase]);

  useEffect(() => () => {
    clearAnimationClock();
  }, [clearAnimationClock]);

  useEffect(() => {
    if (!isWindowedMode || !isTauri()) {
      setIsWindowMaximized(false);
      return;
    }

    let cancelled = false;
    const win = getCurrentWindow();
    const sync = async () => {
      const nextValue = await win.isMaximized().catch(() => false);
      if (!cancelled) {
        setIsWindowMaximized(nextValue);
      }
    };

    void sync();
    const unlistenResize = win.onResized(() => {
      void sync();
    });

    return () => {
      cancelled = true;
      void unlistenResize.then(unlisten => unlisten());
    };
  }, [isWindowedMode]);

  // ── Position & show ──
  const positionAndShow = useCallback(async () => {
    clearAnimationClock();
    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await primaryMonitor();
      if (!monitor) {
        await openWithoutMonitorLayout(win);
        return;
      }

      const store = useSettingsStore.getState().settings.terminal;
      const rememberedBounds = isFreefloatingRef.current ? runtimeOverlayBoundsRef.current : null;
      const layout = rememberedBounds
        ? {
            ...clampOverlayWindowBoundsToWorkArea({
              workArea: monitor.workArea,
              scaleFactor,
              bounds: rememberedBounds,
            }),
            healedHeight: null,
          }
        : computeOverlayWindowLayout({
            workArea: monitor.workArea,
            scaleFactor,
            overlayHeight: store.overlayHeight,
            overlayWidth: store.overlayWidth,
            overlayAnchor: store.overlayAnchor === 'top' ? 'top' : 'bottom',
          });
      const nextAnimation = resolveAnimationById(
        resolvedOpenAnimationId,
        animationSystemConfig.defaultOpenAnimationId,
      );
      const nextDurationMs = resolveAnimationDurationMs(
        nextAnimation,
        'enter',
        appAnimationDurationMs,
      );

      setOverlayAnimationDirection('enter');
      setActiveAnimation(nextAnimation);
      setAnimationProgress(0);
      markOverlayRuntimePhase('opening', true);
      interactionLockUntilRef.current = Date.now() + nextDurationMs + 80;
      setOverlayPhase('closed');
      if (layout.healedHeight !== null && layout.healedHeight !== store.overlayHeight) {
        useSettingsStore.getState().updateTerminal({ overlayHeight: layout.healedHeight });
      }
      runtimeOverlayBoundsRef.current = {
        width: layout.width,
        height: layout.height,
        x: layout.x,
        y: layout.y,
      };
      isProgrammaticResizeRef.current = true;

      // Atomic: set all window properties + geometry in one IPC call, then show
      if (isTauri()) {
        await commands.windowApplyMode(
          false,
          true,
          false,
          !shouldShowInTaskbar,
          layout.x,
          layout.y,
          layout.width,
          layout.height,
        ).catch(() => {});
      }
      await win.show();
      await win.setFocus();

      let committedOpenPhase = false;
      const commitOpenPhase = () => {
        if (committedOpenPhase) {
          return;
        }
        committedOpenPhase = true;
        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (animationCommitTimerRef.current !== null) {
          window.clearTimeout(animationCommitTimerRef.current);
          animationCommitTimerRef.current = null;
        }
        runtimeOverlayBoundsRef.current = {
          width: layout.width,
          height: layout.height,
          x: layout.x,
          y: layout.y,
        };
        isProgrammaticResizeRef.current = false;
        markOverlayRuntimePhase('opening', true);
        setOverlayPhase('opening');
        startAnimationProgress(nextDurationMs);
        animationTimerRef.current = window.setTimeout(() => {
          markOverlayRuntimePhase('open', true);
          setOverlayPhase('open');
          setAnimationProgress(1);
          animationTimerRef.current = null;
        }, nextDurationMs);
      };
      animationFrameRef.current = window.requestAnimationFrame(() => {
        commitOpenPhase();
      });
      animationCommitTimerRef.current = window.setTimeout(() => {
        commitOpenPhase();
      }, 24);
    } catch (e) {
      isProgrammaticResizeRef.current = false;
      markOverlayRuntimePhase('closed', false);
      setAnimationProgress(0);
      console.warn('OverlayTerm: failed to position/show', e);
    }
  }, [appAnimationDurationMs, clearAnimationClock, markOverlayRuntimePhase, openWithoutMonitorLayout, resolveAnimationById, resolvedOpenAnimationId, shouldShowInTaskbar, startAnimationProgress]);

  const showWindowedPanel = useCallback(async () => {
    clearAnimationClock();
    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await primaryMonitor();
      if (!monitor) {
        await openWithoutMonitorLayout(win);
        return;
      }

      const store = useSettingsStore.getState().settings.terminal;
      const layout = computePanelWindowLayout({
        workArea: monitor.workArea,
        scaleFactor,
        windowedWidth: store.windowedWidth,
        windowedHeight: store.windowedHeight,
      });
      const nextAnimation = resolveAnimationById(
        resolvedOpenAnimationId,
        animationSystemConfig.defaultOpenAnimationId,
      );
      const nextDurationMs = resolveAnimationDurationMs(
        nextAnimation,
        'enter',
        appAnimationDurationMs,
      );

      setOverlayAnimationDirection('enter');
      setActiveAnimation(nextAnimation);
      setAnimationProgress(0);
      markOverlayRuntimePhase('opening', true);
      interactionLockUntilRef.current = Date.now() + nextDurationMs + 80;
      setOverlayPhase('closed');
      if (
        (layout.healedWidth !== null && layout.healedWidth !== store.windowedWidth)
        || (layout.healedHeight !== null && layout.healedHeight !== store.windowedHeight)
      ) {
        useSettingsStore.getState().updateTerminal({
          ...(layout.healedWidth !== null ? { windowedWidth: layout.healedWidth } : {}),
          ...(layout.healedHeight !== null ? { windowedHeight: layout.healedHeight } : {}),
        });
      }

      const isMaximized = await win.isMaximized().catch(() => false);
      isProgrammaticResizeRef.current = true;

      // Atomic: set decorations + geometry in one call
      if (isTauri() && !isMaximized) {
        await commands.windowApplyMode(
          false,
          false,
          false,
          false,
          layout.x,
          layout.y,
          layout.width,
          layout.height,
        ).catch(() => {});
      } else if (isTauri()) {
        // Already maximized — just set the presentation flags, skip geometry
        await commands.windowApplyMode(
          false,
          false,
          false,
          false,
          0, 0, 0, 0,
        ).catch(() => {});
      }
      await win.show();
      await win.unminimize().catch(() => {});
      await win.setFocus();

      let committedOpenPhase = false;
      const commitOpenPhase = () => {
        if (committedOpenPhase) {
          return;
        }
        committedOpenPhase = true;
        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (animationCommitTimerRef.current !== null) {
          window.clearTimeout(animationCommitTimerRef.current);
          animationCommitTimerRef.current = null;
        }
        isProgrammaticResizeRef.current = false;
        markOverlayRuntimePhase('opening', true);
        setOverlayPhase('opening');
        startAnimationProgress(nextDurationMs);
        animationTimerRef.current = window.setTimeout(() => {
          markOverlayRuntimePhase('open', true);
          setOverlayPhase('open');
          setAnimationProgress(1);
          animationTimerRef.current = null;
        }, nextDurationMs);
      };
      animationFrameRef.current = window.requestAnimationFrame(() => {
        commitOpenPhase();
      });
      animationCommitTimerRef.current = window.setTimeout(() => {
        commitOpenPhase();
      }, 24);
    } catch (error) {
      isProgrammaticResizeRef.current = false;
      markOverlayRuntimePhase('closed', false);
      setAnimationProgress(0);
      console.warn('OverlayTerm: failed to show regular window mode', error);
    }
  }, [
    appAnimationDurationMs,
    clearAnimationClock,
    markOverlayRuntimePhase,
    openWithoutMonitorLayout,
    resolveAnimationById,
    resolvedOpenAnimationId,
    startAnimationProgress,
  ]);

  const showCurrentPresentation = useCallback(() => {
    if (windowModeRef.current === 'windowed') {
      void showWindowedPanel();
      return;
    }

    void positionAndShow();
  }, [positionAndShow, showWindowedPanel]);

  const handleToggleOverlayAnchor = useCallback(() => {
    updateTerminal({
      overlayAnchor: overlayAnchor === 'top' ? 'bottom' : 'top',
    });
  }, [overlayAnchor, updateTerminal]);

  const hideOverlay = useCallback(async () => {
    const currentPhase = overlayPhaseRef.current;
    if (currentPhase === 'closed' || currentPhase === 'closing') {
      return;
    }

    clearAnimationClock();
    const nextAnimation = resolveAnimationById(
      resolvedCloseAnimationId,
      animationSystemConfig.defaultCloseAnimationId,
    );
    const nextDurationMs = resolveAnimationDurationMs(
      nextAnimation,
      'exit',
      appAnimationDurationMs,
    );
    setOverlayAnimationDirection('exit');
    setActiveAnimation(nextAnimation);
    setAnimationProgress(0);
    markOverlayRuntimePhase('closing', true);
    interactionLockUntilRef.current = Date.now() + nextDurationMs + 80;
    setOverlayPhase('closing');
    startAnimationProgress(nextDurationMs);
    animationTimerRef.current = window.setTimeout(async () => {
      animationTimerRef.current = null;
      markOverlayRuntimePhase('closed', false);
      setOverlayPhase('closed');
      setAnimationProgress(0);
      try {
        await getCurrentWindow().hide();
      } catch {
        // Ignore hide failures during teardown.
      }
    }, nextDurationMs);
  }, [appAnimationDurationMs, clearAnimationClock, markOverlayRuntimePhase, resolveAnimationById, resolvedCloseAnimationId, startAnimationProgress]);

  const handleToggleOverlayRequest = useCallback(() => {
    const currentPhase = overlayPhaseRef.current;
    if (currentPhase === 'open' || currentPhase === 'opening') {
      void hideOverlay();
      return;
    }

    showCurrentPresentation();
  }, [hideOverlay, showCurrentPresentation]);

  useGlobalShortcut(keybindings.terminalToggle, handleToggleOverlayRequest, isTauri());

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let cancelled = false;
    const startupTimer = window.setTimeout(() => {
      const syncInitialPresentation = async () => {
        const visible = (await getCurrentWindow().isVisible?.().catch(() => false)) ?? false;
        if (
          cancelled
          || !visible
          || overlayVisibleRef.current
          || overlayPhaseRef.current !== 'closed'
        ) {
          return;
        }

        handleToggleOverlayRequest();
      };

      void syncInitialPresentation();
    }, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
    };
  }, [handleToggleOverlayRequest]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | null = null;
    listen('overlay://toggle-request', () => {
      handleToggleOverlayRequest();
    }).then(listener => {
      unlisten = listener;
    }).catch(error => {
      console.warn('OverlayTerm: failed to listen for toggle requests', error);
    });

    return () => {
      unlisten?.();
    };
  }, [handleToggleOverlayRequest]);

  const hideOverlayForDrag = useCallback(async () => {
    const currentPhase = overlayPhaseRef.current;
    if (currentPhase !== 'open') {
      return;
    }

    dragHideRestoreRef.current = true;
    clearAnimationClock();
    markOverlayRuntimePhase('closed', false);
    setOverlayPhase('closed');
    setAnimationProgress(0);
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

  const syncWindowPresentation = useCallback(async (mode: TerminalWindowMode) => {
    if (!isTauri() || !overlayVisibleRef.current) {
      return;
    }

    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await primaryMonitor();
      if (!monitor) {
        return;
      }

      if (mode === 'windowed') {
        const store = useSettingsStore.getState().settings.terminal;
        const layout = computePanelWindowLayout({
          workArea: monitor.workArea,
          scaleFactor,
          windowedWidth: store.windowedWidth,
          windowedHeight: store.windowedHeight,
        });
        const isMaximized = await win.isMaximized().catch(() => false);
        if (!isMaximized) {
          isProgrammaticResizeRef.current = true;
          await commands.windowApplyMode(
            false,
            false,
            false,
            false,
            layout.x,
            layout.y,
            layout.width,
            layout.height,
          ).catch(() => {});
        }
        if (
          (layout.healedWidth !== null && layout.healedWidth !== store.windowedWidth)
          || (layout.healedHeight !== null && layout.healedHeight !== store.windowedHeight)
        ) {
          useSettingsStore.getState().updateTerminal({
            ...(layout.healedWidth !== null ? { windowedWidth: layout.healedWidth } : {}),
            ...(layout.healedHeight !== null ? { windowedHeight: layout.healedHeight } : {}),
          });
        }
        return;
      }

      const store = useSettingsStore.getState().settings.terminal;
      const rememberedBounds = isFreefloatingRef.current ? runtimeOverlayBoundsRef.current : null;
      const layout = rememberedBounds
        ? {
            ...clampOverlayWindowBoundsToWorkArea({
              workArea: monitor.workArea,
              scaleFactor,
              bounds: rememberedBounds,
            }),
            healedHeight: null,
          }
        : computeOverlayWindowLayout({
            workArea: monitor.workArea,
            scaleFactor,
            overlayHeight: store.overlayHeight,
            overlayWidth: store.overlayWidth,
            overlayAnchor: store.overlayAnchor === 'top' ? 'top' : 'bottom',
          });

      if (layout.healedHeight !== null && layout.healedHeight !== store.overlayHeight) {
        useSettingsStore.getState().updateTerminal({ overlayHeight: layout.healedHeight });
      }

      runtimeOverlayBoundsRef.current = {
        width: layout.width,
        height: layout.height,
        x: layout.x,
        y: layout.y,
      };
      isProgrammaticResizeRef.current = true;
      await commands.windowApplyMode(
        false,
        true,
        false,
        !shouldShowInTaskbar,
        layout.x,
        layout.y,
        layout.width,
        layout.height,
      ).catch(() => {});
    } catch (error) {
      console.warn('OverlayTerm: failed to transition window presentation', error);
    } finally {
      isProgrammaticResizeRef.current = false;
    }
  }, [shouldShowInTaskbar]);

  const handleToggleWindowMode = useCallback(() => {
    updateTerminal({
      windowMode: windowMode === 'windowed' ? 'overlay' : 'windowed',
    });
  }, [updateTerminal, windowMode]);

  const handleOpenCommandPalette = useCallback(() => {
    if (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed') {
      showCurrentPresentation();
    }
    setIsCommandPaletteOpen(true);
  }, [showCurrentPresentation]);

  const handleCloseCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest('[data-overlay-drag-source="file"]')) {
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

  useEffect(() => {
    if (!isTauri() || !overlayVisibleRef.current) {
      return;
    }

    void syncWindowPresentation(windowMode);
  }, [syncWindowPresentation, windowMode]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | null = null;
    getCurrentWindow().onCloseRequested(async event => {
      event.preventDefault();
      const currentPhase = overlayPhaseRef.current;
      if (currentPhase === 'open') {
        await hideOverlay();
        return;
      }
      await getCurrentWindow().hide().catch(() => {});
    }).then(listener => {
      unlisten = listener;
    }).catch(error => {
      console.warn('OverlayTerm: failed to intercept close requests', error);
    });

    return () => {
      unlisten?.();
    };
  }, [hideOverlay]);

  useEffect(() => {
    if (!overlayVisibleRef.current || windowMode !== 'overlay') {
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
        const rememberedBounds = runtimeOverlayBoundsRef.current;
        const baseLayout = rememberedBounds
          ? clampOverlayWindowBoundsToWorkArea({
              workArea: monitor.workArea,
              scaleFactor,
              bounds: rememberedBounds,
            })
          : computeOverlayWindowLayout({
              workArea: monitor.workArea,
              scaleFactor,
              overlayHeight: store.overlayHeight,
              overlayWidth: store.overlayWidth,
              overlayAnchor: store.overlayAnchor === 'top' ? 'top' : 'bottom',
            });
        const anchoredLayout = computeOverlayWindowLayout({
          workArea: monitor.workArea,
          scaleFactor,
          overlayHeight: Math.round(baseLayout.height / scaleFactor),
          overlayWidth: Math.round(baseLayout.width / scaleFactor),
          overlayAnchor: store.overlayAnchor === 'top' ? 'top' : 'bottom',
        });
        const layout = {
          ...baseLayout,
          y: anchoredLayout.y,
          healedHeight: anchoredLayout.healedHeight,
        };

        if (layout.healedHeight !== null && layout.healedHeight !== store.overlayHeight) {
          useSettingsStore.getState().updateTerminal({ overlayHeight: layout.healedHeight });
        }

        runtimeOverlayBoundsRef.current = {
          width: layout.width,
          height: layout.height,
          x: layout.x,
          y: layout.y,
        };
        isProgrammaticResizeRef.current = true;
        await commands.windowApplyMode(
          false, true, false, !shouldShowInTaskbar,
          layout.x, layout.y, layout.width, layout.height,
        ).catch(() => {});

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
  }, [overlayAnchor, windowMode]);

  useEffect(() => {
    if (!isOverlayVisible || typeof window === 'undefined' || !isTauri()) {
      return;
    }

    const handleWheelZoom = (event: WheelEvent) => {
      const eventTarget = event.target instanceof HTMLElement ? event.target : null;
      if (eventTarget?.closest('[data-overlay-explorer]') && (event.ctrlKey || event.metaKey)) {
        return;
      }

      const direction: 1 | -1 = event.deltaY < 0 ? 1 : -1;
      const multiplier = event.shiftKey ? 3 : 1;
      const appearanceState = useSettingsStore.getState().settings.appearance;

      if (applyWheelVisualControlAdjust({
        event,
        binding: keybindings.zoomAdjust,
        currentValue: appearanceState.appZoom ?? 1,
        min: overlayVisualControls.zoom.min,
        max: overlayVisualControls.zoom.max,
        step: overlayVisualControls.zoom.step,
        direction,
        multiplier,
        onChange: value => {
          useSettingsStore.getState().updateAppearance({ appZoom: value });
        },
      })) {
        return;
      }

      applyWheelVisualControlAdjust({
        event,
        binding: keybindings.opacityAdjust,
        currentValue: appearanceState.appOpacity ?? 1,
        min: overlayVisualControls.opacity.min,
        max: overlayVisualControls.opacity.max,
        step: overlayVisualControls.opacity.step,
        direction,
        multiplier,
        onChange: value => {
          useSettingsStore.getState().updateAppearance({ appOpacity: value });
        },
      });
    };

    window.addEventListener('wheel', handleWheelZoom, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', handleWheelZoom, { capture: true });
  }, [isOverlayVisible, keybindings.opacityAdjust, keybindings.zoomAdjust]);

  // ── Persist resize ──
  useEffect(() => {
    const unlistenResize = getCurrentWindow().onResized(async ev => {
      if (isProgrammaticResizeRef.current || !overlayVisibleRef.current) {
        return;
      }
      const win = getCurrentWindow();
      const factor = await win.scaleFactor();
      const logH = Math.round(ev.payload.height / factor);
      const logW = Math.round(ev.payload.width / factor);
      if (windowModeRef.current === 'windowed') {
        const maximized = await win.isMaximized().catch(() => false);
        setIsWindowMaximized(maximized);
        if (maximized) {
          return;
        }

        useSettingsStore.getState().updateTerminal({
          windowedHeight: Math.max(logH, 480),
          windowedWidth: Math.max(logW, 720),
        });
        return;
      }

      const position = await win.outerPosition().catch(() => runtimeOverlayBoundsRef.current ?? { x: 0, y: 0 });
      runtimeOverlayBoundsRef.current = {
        width: ev.payload.width,
        height: ev.payload.height,
        x: position.x,
        y: position.y,
      };
      const store = useSettingsStore.getState().settings.terminal;
      const nextOverlayHeight = Math.max(logH, overlayWindowGeometry.minHeight);
      const nextOverlayWidth = Math.max(logW, overlayWindowGeometry.minWidth);
      if (nextOverlayHeight !== store.overlayHeight || nextOverlayWidth !== store.overlayWidth) {
        useSettingsStore.getState().updateTerminal({
          overlayHeight: nextOverlayHeight,
          overlayWidth: nextOverlayWidth,
        });
      }
    });
    return () => { unlistenResize.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const unlistenMove = getCurrentWindow().onMoved(async ev => {
      if (isProgrammaticResizeRef.current || !overlayVisibleRef.current || windowModeRef.current !== 'overlay') {
        return;
      }
      const win = getCurrentWindow();
      const size = await win.outerSize().catch(() => runtimeOverlayBoundsRef.current ?? { width: 0, height: 0 });
      runtimeOverlayBoundsRef.current = {
        width: size.width,
        height: size.height,
        x: ev.payload.x,
        y: ev.payload.y,
      };
    });
    return () => { unlistenMove.then(fn => fn()); };
  }, []);

  // ── Explorer → Terminal bridge ──
  const handleOpenInTerminal = useCallback(async (path: string) => {
    if (settings.preferredOpenMode === 'external') {
      await commands.terminalOpenExternal({
        workingDir: path,
        profile: settings.externalTerminalProfile,
        executable: settings.externalTerminalCommand || null,
        args: parseExternalArgs(settings.externalTerminalArgs),
        shell: settings.shell,
      }).then(unwrapTauriResult).catch(error => {
        console.warn('OverlayTerm: failed to open external terminal', error);
      });
      hideOverlay();
      return;
    }

    const settingsState = useSettingsStore.getState();
    const currentLayout = settingsState.settings.layout;
    const currentPanelState = currentLayout.panelStateByProfile[activeLayoutProfile.id] ?? EMPTY_LAYOUT_PANEL_STATE;

    settingsState.updateLayout({
      panelStateByProfile: {
        ...currentLayout.panelStateByProfile,
        [activeLayoutProfile.id]: {
          openPanelIds: uniquePanelIds([...currentPanelState.openPanelIds, 'terminal']),
          activePanelId: 'terminal',
          dismissedPanelIds: currentPanelState.dismissedPanelIds.filter(id => id !== 'terminal'),
        },
      },
    });
    // Small delay so the terminal tab renders before we inject the cd
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('overlayterm:cdinject', { detail: path }));
    }, 80);
  }, [
    hideOverlay,
    settings.externalTerminalArgs,
    settings.externalTerminalCommand,
    settings.externalTerminalProfile,
    settings.preferredOpenMode,
    settings.shell,
    activeLayoutProfile.id,
  ]);

  const handleAddBookmark = useCallback(async (name: string, path: string) => {
    await addDirectoryBookmark({ id: crypto.randomUUID(), name, value: path });
  }, [addDirectoryBookmark]);

  const refreshThemePackages = useCallback(async () => {
    if (!isTauri()) {
      setThemePackages([]);
      setThemeContributedShaders([]);
      setThemeContributedAnimations([]);
      setThemePackagesError(null);
      setThemePackagesWarnings([]);
      setThemePackagesLoading(false);
      return;
    }

    setThemePackagesLoading(true);
    try {
      await ensureDir(themeSystemConfig.themesDirectory);
      const result = await discoverThemePackages();
      setThemePackages(result.packages);
      setThemeContributedShaders(result.shaders);
      setThemeContributedAnimations(result.animations);
      setThemePackagesError(result.sourceError);
      setThemePackagesWarnings(result.warnings);
    } catch (error) {
      setThemePackages([]);
      setThemeContributedShaders([]);
      setThemeContributedAnimations([]);
      setThemePackagesError(String(error));
      setThemePackagesWarnings([]);
    } finally {
      setThemePackagesLoading(false);
    }
  }, []);

  const openThemesFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    await ensureDir(themeSystemConfig.themesDirectory);
    await openExplorerPath(themeSystemConfig.themesDirectory);
  }, []);

  const openAnimationsFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    await ensureDir(animationSystemConfig.animationsDirectory);
    await openExplorerPath(animationSystemConfig.animationsDirectory);
  }, []);

  const openShadersFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    await ensureDir(shaderSystemConfig.shadersDirectory);
    await openExplorerPath(shaderSystemConfig.shadersDirectory);
  }, []);

  const refreshAuthoredAnimations = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredAnimations([]);
      setAuthoredAnimationsError(null);
      setAuthoredAnimationsLoading(false);
      return;
    }

    if (force) {
      authoredAnimationsRefreshQueuedRef.current = true;
    }
    if (authoredAnimationsRefreshInFlightRef.current) {
      authoredAnimationsRefreshQueuedRef.current = true;
      return;
    }

    authoredAnimationsRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || authoredAnimationsRefreshQueuedRef.current;
        authoredAnimationsRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          animationSignatureRef.current = '';
        }

        setAuthoredAnimationsLoading(prev => prev && !nextForce);
        setAuthoredAnimationsError(null);
        try {
          await ensureDir(animationSystemConfig.animationsDirectory);
          const listed = await listExplorerDir(animationSystemConfig.animationsDirectory, false);
          const files = listed
            .filter(isFrontendAnimationFile)
            .sort((left, right) => left.name.localeCompare(right.name));
          const nextSignature = files.map(file => `${file.path}:${file.modified}`).join('|');

          if (!nextForce && nextSignature === animationSignatureRef.current) {
            setAuthoredAnimationsLoading(false);
            continue;
          }

          animationSignatureRef.current = nextSignature;
          const loaded = await Promise.all(files.map(async file => {
            const source = await commands.fsReadTextFile(file.path).then(unwrapTauriResult);
            return loadAnimationFromSource(source, file);
          }));

          setAuthoredAnimations(loaded);
        } catch (error) {
          setAuthoredAnimations([]);
          setAuthoredAnimationsError(String(error));
        } finally {
          setAuthoredAnimationsLoading(false);
        }
      } while (authoredAnimationsRefreshQueuedRef.current);
    } finally {
      authoredAnimationsRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshAuthoredShaders = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredShaders([]);
      setAuthoredShadersError(null);
      setAuthoredShadersLoading(false);
      return;
    }

    if (force) {
      authoredShadersRefreshQueuedRef.current = true;
    }
    if (authoredShadersRefreshInFlightRef.current) {
      authoredShadersRefreshQueuedRef.current = true;
      return;
    }

    authoredShadersRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || authoredShadersRefreshQueuedRef.current;
        authoredShadersRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          shaderSignatureRef.current = '';
        }

        setAuthoredShadersLoading(prev => prev && !nextForce);
        setAuthoredShadersError(null);
        try {
          await ensureDir(shaderSystemConfig.shadersDirectory);
          const listed = await listExplorerDir(shaderSystemConfig.shadersDirectory, false);
          const files = listed
            .filter(isFrontendShaderFile)
            .sort((left, right) => left.name.localeCompare(right.name));
          const nextSignature = files.map(file => `${file.path}:${file.modified}`).join('|');

          if (!nextForce && nextSignature === shaderSignatureRef.current) {
            setAuthoredShadersLoading(false);
            continue;
          }

          shaderSignatureRef.current = nextSignature;
          const loaded = await Promise.all(files.map(async file => {
            const source = await commands.fsReadTextFile(file.path).then(unwrapTauriResult);
            return loadShaderFromSource(source, file);
          }));

          setAuthoredShaders(loaded);
        } catch (error) {
          setAuthoredShaders([]);
          setAuthoredShadersError(String(error));
        } finally {
          setAuthoredShadersLoading(false);
        }
      } while (authoredShadersRefreshQueuedRef.current);
    } finally {
      authoredShadersRefreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isOverlayVisible) {
      return;
    }
    void refreshAuthoredAnimations(true);
  }, [isOverlayVisible, refreshAuthoredAnimations]);

  useEffect(() => {
    if (!isOverlayVisible) {
      return;
    }
    void refreshAuthoredShaders(true);
  }, [isOverlayVisible, refreshAuthoredShaders]);

  useEffect(() => {
    if (!isOverlayVisible || !animationSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshAuthoredAnimations();
    }, animationSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, refreshAuthoredAnimations]);

  useEffect(() => {
    if (!isOverlayVisible || !shaderSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshAuthoredShaders();
    }, shaderSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, refreshAuthoredShaders]);

  useEffect(() => {
    void refreshThemePackages();
  }, [refreshThemePackages]);

  const panelDefinitions = useMemo<OverlayPanelDefinition[]>(
    () => [
      ...createBuiltInPanelDefinitions({
        appearance: resolvedAppearance,
        explorerLayoutMode: pinnedExplorerPanel?.mode ?? 'full',
        explorerRepoPicker: isRepositoryPickerActive
          ? {
              active: true,
              allowMultiple: true,
              requestId: repositoryPickerRequestId,
              onConfirm: handleConfirmRepositoryImport,
              onCancel: handleCancelRepositoryImport,
            }
          : null,
        isOpen: isOverlayVisible,
        hideOverlay,
        pluginCommands,
        pluginExplorerActions,
        onOpenInTerminal: handleOpenInTerminal,
        onAddBookmark: handleAddBookmark,
        onRequestRepositoryImport: handleRequestRepositoryImport,
        pendingRepositoryImports,
        onPendingRepositoryImportsHandled: handleRepositoryImportsHandled,
        themePackages: combinedThemePackages,
        themePackagesDirectory: themeSystemConfig.themesDirectory,
        themePackagesLoading,
        themePackagesError,
        themePackagesWarnings,
        onRefreshThemes: refreshThemePackages,
        onOpenThemesFolder: openThemesFolder,
        shaders: availableShaders,
        shaderDiagnostics: [...authoredShaders, ...pluginContributedShaders].filter(shader => Boolean(shader.error)),
        shadersDirectory: shaderSystemConfig.shadersDirectory,
        shadersLoading: authoredShadersLoading,
        shadersError: authoredShadersError,
        onRefreshShaders: () => refreshAuthoredShaders(true),
        onOpenShadersFolder: openShadersFolder,
        animations: availableAnimations,
        animationDiagnostics: authoredAnimations.filter(animation => Boolean(animation.error)),
        animationsDirectory: animationSystemConfig.animationsDirectory,
        animationsLoading: authoredAnimationsLoading,
        animationsError: authoredAnimationsError,
        onRefreshAnimations: () => refreshAuthoredAnimations(true),
        onOpenAnimationsFolder: openAnimationsFolder,
        renderPluginsManager: () => (
          <PluginsManager
            appearance={resolvedAppearance}
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
      handleCancelRepositoryImport,
      handleConfirmRepositoryImport,
      handleOpenInTerminal,
      handleRepositoryImportsHandled,
      handleRequestRepositoryImport,
      hideOverlay,
      isOverlayVisible,
      isRepositoryPickerActive,
      authoredAnimations,
      authoredAnimationsError,
      authoredAnimationsLoading,
      authoredShaders,
      authoredShadersError,
      authoredShadersLoading,
      availableAnimations,
      availableShaders,
      pluginContributedShaders,
      pluginCommands,
      pluginExplorerActions,
      openAnimationsFolder,
      openShadersFolder,
      openPluginsFolder,
      openThemesFolder,
      pendingRepositoryImports,
      pinnedExplorerPanel?.mode,
      refreshThemePackages,
      refreshAuthoredAnimations,
      refreshAuthoredShaders,
      refreshFolderPlugins,
      repositoryPickerRequestId,
      resolvedAppearance,
      combinedThemePackages,
      themePackagesError,
      themePackagesLoading,
      themePackagesWarnings,
    ],
  );
  const panelLookup = useMemo(
    () => new Map(panelDefinitions.map(panel => [panel.id, panel])),
    [panelDefinitions],
  );
  const availablePanelIds = useMemo(
    () => panelDefinitions.map(panel => panel.id),
    [panelDefinitions],
  );
  const pinnedPanelIds = useMemo(
    () => getPinnedPanelIds(activeLayoutProfile),
    [activeLayoutProfile],
  );
  const defaultOpenPanelIds = useMemo(
    () => uniquePanelIds(
      panelDefinitions
        .filter(panel => panel.defaultOpen && panelLookup.has(panel.id))
        .map(panel => panel.id),
    ),
    [panelDefinitions, panelLookup],
  );
  const savedPanelState = useMemo(
    () => sanitizeLayoutPanelState(
      layoutSettings.panelStateByProfile[activeLayoutProfile.id],
      availablePanelIds,
      pinnedPanelIds,
    ),
    [activeLayoutProfile.id, availablePanelIds, layoutSettings.panelStateByProfile, pinnedPanelIds],
  );
  const openPanelIds = useMemo(
    () => derivePanelOpenState({
      savedOpenIds: savedPanelState.openPanelIds,
      dismissedPanelIds: savedPanelState.dismissedPanelIds,
      availableIds: availablePanelIds,
      defaultOpenIds: defaultOpenPanelIds,
      enforcedOpenIds: activeLayoutProfile.behavior.enforcedOpenPanelIds,
    }),
    [
      activeLayoutProfile.behavior.enforcedOpenPanelIds,
      availablePanelIds,
      defaultOpenPanelIds,
      savedPanelState.dismissedPanelIds,
      savedPanelState.openPanelIds,
    ],
  );
  const tabbedOpenPanelIds = useMemo(
    () => getTabbedOpenPanelIds(activeLayoutProfile, openPanelIds),
    [activeLayoutProfile, openPanelIds],
  );
  const activePanelId = useMemo(
    () => resolveActiveTabPanelId({
      activePanelId: savedPanelState.activePanelId,
      openPanelIds: tabbedOpenPanelIds,
      defaultActivePanelId: activeLayoutProfile.behavior.defaultActivePanelId,
    }),
    [activeLayoutProfile.behavior.defaultActivePanelId, savedPanelState.activePanelId, tabbedOpenPanelIds],
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
  frameTelemetryContextRef.current = {
    activePanelId,
    openPanelCount: openPanelIds.length,
    windowMode: settings.windowMode,
  };

  useEffect(() => {
    if (!isOverlayVisible || typeof window === 'undefined') {
      return;
    }

    let rafId = 0;
    let disposed = false;
    let windowStartedAt = 0;
    let lastTimestamp = 0;
    let frameDurations: number[] = [];

    const flushWindow = () => {
      if (lastTimestamp <= windowStartedAt) {
        return;
      }

      const stats = summarizeOverlayFrameWindow(frameDurations, lastTimestamp - windowStartedAt);
      if (!stats) {
        return;
      }

      const context = frameTelemetryContextRef.current;
      const sample = recordOverlayFrameTelemetry(stats, {
        activePanelId: context.activePanelId ?? 'none',
        isWindowed: context.windowMode === 'windowed',
        openPanelCount: context.openPanelCount,
      });
      if (FRAME_PROBE_OUTPUT_PATH && isTauri()) {
        void commands.fsWriteFile(FRAME_PROBE_OUTPUT_PATH, {
          kind: 'text',
          value: JSON.stringify(sample, null, 2),
        }).then(unwrapTauriResult).catch(() => undefined);
      }
      frameDurations = [];
      windowStartedAt = lastTimestamp;
    };

    const tick = (timestamp: number) => {
      if (disposed) {
        return;
      }

      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
        windowStartedAt = timestamp;
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      if (delta > 0 && delta <= 250) {
        frameDurations.push(delta);
      }

      const windowDurationMs = timestamp - windowStartedAt;
      if (shouldFlushOverlayFrameWindow(frameDurations.length, windowDurationMs)) {
        flushWindow();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      flushWindow();
    };
  }, [isOverlayVisible]);

  const deriveOpenPanelIdsFromState = useCallback((panelState: LayoutPanelState) => derivePanelOpenState({
    savedOpenIds: panelState.openPanelIds,
    dismissedPanelIds: panelState.dismissedPanelIds,
    availableIds: availablePanelIds,
    defaultOpenIds: defaultOpenPanelIds,
    enforcedOpenIds: activeLayoutProfile.behavior.enforcedOpenPanelIds,
  }), [activeLayoutProfile.behavior.enforcedOpenPanelIds, availablePanelIds, defaultOpenPanelIds]);

  const resolveActivePanelIdFromState = useCallback((panelState: LayoutPanelState) => resolveActiveTabPanelId({
    activePanelId: panelState.activePanelId,
    openPanelIds: getTabbedOpenPanelIds(activeLayoutProfile, deriveOpenPanelIdsFromState(panelState)),
    defaultActivePanelId: activeLayoutProfile.behavior.defaultActivePanelId,
  }), [activeLayoutProfile, deriveOpenPanelIdsFromState]);

  const updateActiveLayoutPanelState = useCallback((updater: (current: LayoutPanelState) => LayoutPanelState) => {
    const settingsState = useSettingsStore.getState();
    const currentByProfile = settingsState.settings.layout.panelStateByProfile;
    const currentState = sanitizeLayoutPanelState(
      currentByProfile[activeLayoutProfile.id],
      availablePanelIds,
      pinnedPanelIds,
    );
    const nextState = sanitizeLayoutPanelState(
      updater(currentState),
      availablePanelIds,
      pinnedPanelIds,
    );

    if (areLayoutPanelStatesEqual(currentState, nextState)) {
      return;
    }

    settingsState.updateLayout({
      panelStateByProfile: {
        ...currentByProfile,
        [activeLayoutProfile.id]: nextState,
      },
    });
  }, [activeLayoutProfile.id, availablePanelIds, pinnedPanelIds]);

  const handleSelectPanel = useCallback((panelId: string | null) => {
    if (!panelId || pinnedPanelIds.includes(panelId) || !panelLookup.has(panelId)) {
      return;
    }

    updateActiveLayoutPanelState(current => ({
      ...current,
      activePanelId: panelId,
    }));
  }, [panelLookup, pinnedPanelIds, updateActiveLayoutPanelState]);

  const handleTogglePanel = useCallback((panelId: string) => {
    if (pinnedPanelIds.includes(panelId) || !panelLookup.has(panelId)) {
      return;
    }

    const isCurrentlyOpen = openPanelIds.includes(panelId);

    updateActiveLayoutPanelState(current => {
      if (isCurrentlyOpen) {
        const nextState: LayoutPanelState = {
          openPanelIds: current.openPanelIds.filter(id => id !== panelId),
          activePanelId: current.activePanelId === panelId ? null : current.activePanelId,
          dismissedPanelIds: uniquePanelIds([...current.dismissedPanelIds, panelId]),
        };

        return {
          ...nextState,
          activePanelId: resolveActivePanelIdFromState(nextState),
        };
      }

      return {
        openPanelIds: uniquePanelIds([...current.openPanelIds, panelId]),
        activePanelId: panelId,
        dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== panelId),
      };
    });
  }, [openPanelIds, panelLookup, pinnedPanelIds, resolveActivePanelIdFromState, updateActiveLayoutPanelState]);

  const handleClosePanel = useCallback((panelId: string) => {
    if (pinnedPanelIds.includes(panelId) || !panelLookup.has(panelId)) {
      return;
    }

    updateActiveLayoutPanelState(current => {
      const nextState: LayoutPanelState = {
        openPanelIds: current.openPanelIds.filter(id => id !== panelId),
        activePanelId: current.activePanelId === panelId ? null : current.activePanelId,
        dismissedPanelIds: uniquePanelIds([...current.dismissedPanelIds, panelId]),
      };

      return {
        ...nextState,
        activePanelId: resolveActivePanelIdFromState(nextState),
      };
    });
  }, [panelLookup, pinnedPanelIds, resolveActivePanelIdFromState, updateActiveLayoutPanelState]);

  const handleReorderPanels = useCallback((draggedId: string, targetId: string) => {
    updateActiveLayoutPanelState(current => ({
      ...current,
      openPanelIds: reorderPanelIds(tabbedOpenPanelIds, draggedId, targetId),
    }));
  }, [tabbedOpenPanelIds, updateActiveLayoutPanelState]);

  const handleOpenSettings = useCallback(() => {
    updateActiveLayoutPanelState(current => ({
      openPanelIds: uniquePanelIds([...current.openPanelIds, 'settings']),
      activePanelId: 'settings',
      dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== 'settings'),
    }));
  }, [updateActiveLayoutPanelState]);

  const handleActivatePanel = useCallback((panelId: string) => {
    if (!panelLookup.has(panelId) || pinnedPanelIds.includes(panelId)) {
      return;
    }

    updateActiveLayoutPanelState(current => ({
      openPanelIds: uniquePanelIds([...current.openPanelIds, panelId]),
      activePanelId: panelId,
      dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== panelId),
    }));
  }, [panelLookup, pinnedPanelIds, updateActiveLayoutPanelState]);

  const handleOpenTerminalPanel = useCallback(() => {
    const now = Date.now();
    if (now - lastTerminalFocusAtRef.current < 220) {
      return;
    }
    lastTerminalFocusAtRef.current = now;

    setIsCommandPaletteOpen(false);
    handleActivatePanel('terminal');
    if (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed') {
      showCurrentPresentation();
    }
  }, [handleActivatePanel, showCurrentPresentation]);

  openTerminalPanelRef.current = handleOpenTerminalPanel;

  const handleCycleLayout = useCallback(() => {
    updateLayout({
      activeProfileId: getNextLayoutProfileId(layoutManifest, activeLayoutProfile.id),
    });
  }, [activeLayoutProfile.id, layoutManifest, updateLayout]);

  useEffect(() => {
    if (!isOverlayVisible && isCommandPaletteOpen) {
      setIsCommandPaletteOpen(false);
    }
  }, [isCommandPaletteOpen, isOverlayVisible]);

  const commandPaletteActions = useMemo<OverlayCommandPaletteAction[]>(() => {
    const builtInActions: OverlayCommandPaletteAction[] = [
      {
        id: 'open-settings',
        title: 'Open Settings',
        subtitle: 'Jump to the settings panel.',
        group: 'App',
        keywords: ['preferences', 'config', 'appearance'],
        badge: 'App',
        onSelect: handleOpenSettings,
      },
      {
        id: 'refresh-plugins',
        title: 'Refresh Plugins',
        subtitle: 'Rescan legacy and package plugins, then reload their contributions.',
        group: 'App',
        keywords: ['plugins', 'reload', 'rescan'],
        badge: 'Refresh',
        onSelect: () => refreshFolderPlugins(true),
      },
      {
        id: 'open-plugins-folder',
        title: 'Open Plugins Folder',
        subtitle: pluginSystemConfig.pluginsDirectory,
        group: 'App',
        keywords: ['plugins', 'folder'],
        badge: 'Folder',
        onSelect: openPluginsFolder,
      },
      {
        id: 'refresh-themes',
        title: 'Refresh Themes',
        subtitle: 'Reload theme packages and theme contributions.',
        group: 'App',
        keywords: ['themes', 'reload'],
        badge: 'Refresh',
        onSelect: refreshThemePackages,
      },
      {
        id: 'refresh-shaders',
        title: 'Refresh Shaders',
        subtitle: 'Reload authored shaders and plugin shader contributions.',
        group: 'App',
        keywords: ['shaders', 'reload'],
        badge: 'Refresh',
        onSelect: () => refreshAuthoredShaders(true),
      },
      {
        id: 'refresh-animations',
        title: 'Refresh Animations',
        subtitle: 'Reload authored animations.',
        group: 'App',
        keywords: ['animations', 'reload'],
        badge: 'Refresh',
        onSelect: () => refreshAuthoredAnimations(true),
      },
      {
        id: 'cycle-layout',
        title: 'Cycle Layout',
        subtitle: `Switch from ${activeLayoutProfile.label} to the next layout profile.`,
        group: 'Layout',
        keywords: ['layout', 'profiles', 'dock'],
        badge: 'Layout',
        onSelect: handleCycleLayout,
      },
      {
        id: 'toggle-window-mode',
        title: windowMode === 'windowed' ? 'Switch To Dock Mode' : 'Switch To Application Mode',
        subtitle: windowMode === 'windowed'
          ? 'Pin the shell back to a monitor edge and restore dock behavior.'
          : 'Open the shell as a regular desktop window.',
        group: 'Layout',
        keywords: ['dock', 'window', 'mode', 'overlay', 'app'],
        badge: windowMode === 'windowed' ? 'Dock' : 'App',
        onSelect: handleToggleWindowMode,
      },
      ...(windowMode === 'overlay'
        ? [{
            id: 'toggle-dock-edge',
            title: `Dock To ${overlayAnchor === 'top' ? 'Bottom' : 'Top'} Edge`,
            subtitle: `Move the dock shell from the ${overlayAnchor} edge to the ${overlayAnchor === 'top' ? 'bottom' : 'top'} edge.`,
            group: 'Layout',
            keywords: ['dock', 'anchor', 'top', 'bottom', 'edge'],
            badge: 'Edge',
            onSelect: handleToggleOverlayAnchor,
          } satisfies OverlayCommandPaletteAction]
        : []),
    ];

    const panelActions = panelDefinitions
      .filter(panel => !pinnedPanelIds.includes(panel.id))
      .map<OverlayCommandPaletteAction>(panel => ({
        id: `panel:${panel.id}`,
        title: `Open ${panel.label}`,
        subtitle: panel.description,
        group: panel.kind === 'folder-plugin' ? 'Plugin Panels' : 'Panels',
        keywords: [panel.id, panel.label, panel.description],
        badge: panel.kind === 'folder-plugin' ? 'Plugin' : 'Panel',
        onSelect: () => handleActivatePanel(panel.id),
      }));

    const pluginCommandActions = pluginCommands.map<OverlayCommandPaletteAction>(command => ({
      id: `plugin-command:${command.id}`,
      title: command.name,
      subtitle: command.description || command.command,
      group: 'Plugin Commands',
      keywords: [command.pluginName, command.command, command.description ?? ''],
      badge: command.pluginName,
      onSelect: () => dispatchTerminalCommand(command.command, command.runOnSelect),
    }));

    return [
      ...builtInActions,
      ...panelActions,
      ...pluginCommandActions,
    ];
  }, [
    activeLayoutProfile.label,
    handleActivatePanel,
    handleCycleLayout,
    handleOpenSettings,
    handleToggleOverlayAnchor,
    handleToggleWindowMode,
    overlayAnchor,
    openPluginsFolder,
    pinnedPanelIds,
    panelDefinitions,
    pluginCommands,
    refreshAuthoredAnimations,
    refreshAuthoredShaders,
    refreshFolderPlugins,
    refreshThemePackages,
    windowMode,
  ]);

  useEffect(() => {
    let cancelled = false;

    const syncNativeBlur = async () => {
      try {
        unwrapTauriResult(await commands.windowSetBlur(
          appBlur && overlayPhase !== 'closed',
          clampedAppBlurStrength,
        ));
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
  }, [appBlur, clampedAppBlurStrength, overlayPhase]);

  const activeContentPanel = activePanelId ? panelLookup.get(activePanelId) ?? null : null;
  const shellShaderContext = useMemo<OverlayShaderShellContext>(() => ({
    ...(activeShader ?? {
      id: shaderSystemConfig.fallbackShaderId,
      name: 'None',
      filePath: 'builtin:none',
      shaderRoot: 'builtin',
      source: 'built-in' as const,
    }),
    viewport: {
      width: typeof window === 'undefined' ? 0 : window.innerWidth,
      height: typeof window === 'undefined' ? 0 : window.innerHeight,
    },
    accentColor: accent,
    theme,
    panelTransparency: clampedPanelTransparency,
    blurStrength: clampedAppBlurStrength,
    zoom: clampedAppZoom,
    isSettingsActive: activePanelId === 'settings',
    shaderControlValues: activeShaderControlValues,
  }), [
    activePanelId,
    activeShader,
    activeShaderControlValues,
    accent,
    clampedAppBlurStrength,
    clampedAppZoom,
    clampedPanelTransparency,
    theme,
  ]);
  const chromeBar = (
    <TopBar
      appearance={resolvedAppearance}
      layoutProfile={activeLayoutProfile}
      layoutProfiles={layoutManifest.profiles}
      layoutSourcePath={layoutConfigSource}
      panels={panelDefinitions}
      openPanelIds={openPanelIds}
      pinnedPanelIds={pinnedPanelIds}
      activePanelId={activePanelId}
      onPanelSelect={handleSelectPanel}
      onPanelToggle={handleTogglePanel}
      onPanelClose={handleClosePanel}
      onPanelReorder={handleReorderPanels}
      onOpenSettings={handleOpenSettings}
      onCycleLayout={handleCycleLayout}
      onSelectLayoutProfile={(profileId) => updateLayout({ activeProfileId: profileId })}
      onSetWindowMode={(mode) => updateTerminal({ windowMode: mode })}
      onOpenCommandPalette={handleOpenCommandPalette}
      onToggleOverlayAnchor={handleToggleOverlayAnchor}
      onClose={() => { void hideOverlay(); }}
      accent={accent}
      opacity={clampedAppOpacity}
      onOpacityChange={(v) => updateAppearance({ appOpacity: clampOverlayVisualControlValue('opacity', v) })}
      panelTransparency={clampedPanelTransparency}
      onPanelTransparencyChange={(v) => updateAppearance({ panelTransparency: clampOverlayVisualControlValue('panelTransparency', v) })}
      zoom={clampedAppZoom}
      onZoomChange={(v) => updateAppearance({ appZoom: clampOverlayVisualControlValue('zoom', v) })}
      showViewportControls={activeLayoutProfile.controlDock.enabled}
      blur={appBlur}
      onBlurChange={(v) => updateAppearance({ appBlur: v })}
      blurStrength={clampedAppBlurStrength}
      onBlurStrengthChange={(v) => updateAppearance({ appBlurStrength: clampOverlayVisualControlValue('blurStrength', v) })}
      blurPlatform={runtimePlatform}
      windowMode={windowMode}
      overlayAnchor={overlayAnchor}
      commandPaletteShortcutLabel={formatHotkeyLabel(keybindings.commandPalette)}
      toggleShortcutLabel={formatHotkeyLabel(keybindings.terminalToggle)}
      topBarShaderLayer={(
        <ShaderSurfaceLayer
          shader={activeShader}
          shellContext={shellShaderContext}
          surface="topBar"
        />
      )}
    />
  );

  return (
    <div
      className="overlay-window-host w-full h-full overflow-hidden"
      style={{
        ...(resolvedAppearance.cssVars as CSSProperties),
        position: 'relative',
        backgroundColor: 'transparent',
      }}
      onDragStart={handleDragStart}
      onDragEndCapture={handleDragEndCapture}
      onDropCapture={handleDropCapture}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: isWindowedMode ? 0 : (isTopAnchored ? 0 : 'auto'),
          bottom: isWindowedMode ? 'auto' : (isTopAnchored ? 'auto' : 0),
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
            transformOrigin: isWindowedMode ? 'center center' : (isTopAnchored ? 'top left' : 'bottom left'),
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
              backdropFilter: shellBackdropFilter,
              WebkitBackdropFilter: shellBackdropFilter,
              color: theme.palette.textPrimary,
              fontFamily: resolvedAppearance.fonts.ui,
              boxShadow: isWindowedMode && isWindowMaximized ? 'none' : 'var(--overlay-workbench-shell-shadow)',
              borderTop: isWindowedMode
                ? (isWindowMaximized ? 'none' : '1px solid var(--overlay-workbench-chrome-border)')
                : (isTopAnchored ? 'none' : '1px solid var(--overlay-workbench-chrome-border)'),
              borderBottom: isWindowedMode
                ? (isWindowMaximized ? 'none' : '1px solid var(--overlay-workbench-chrome-border)')
                : (isTopAnchored ? '1px solid var(--overlay-workbench-chrome-border)' : 'none'),
              borderLeft: isWindowedMode && !isWindowMaximized ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
              borderRight: isWindowedMode && !isWindowMaximized ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
              borderTopLeftRadius: isWindowedMode ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? 0 : workbench.metrics.panelRadius),
              borderTopRightRadius: isWindowedMode ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? 0 : workbench.metrics.panelRadius),
              borderBottomLeftRadius: isWindowedMode ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? workbench.metrics.panelRadius : 0),
              borderBottomRightRadius: isWindowedMode ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? workbench.metrics.panelRadius : 0),
            }}
          >
            <ShaderSurfaceLayer
              shader={activeShader}
              shellContext={shellShaderContext}
              surface="background"
            />
            {(theme.visuals ?? []).map(layer => (
              <div key={layer.id} aria-hidden style={buildThemeVisualStyle(layer)} />
            ))}
            <ShaderSurfaceLayer
              shader={activeShader}
              shellContext={shellShaderContext}
              surface="border"
            />
            <AnimationOverlayLayer
              animation={shellAnimation}
              context={shellAnimationContext}
            />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {!isWindowedMode && !isTopAnchored && (
                <div
                  className="h-[4px] shrink-0 cursor-ns-resize select-none"
                  style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
                  onPointerDown={e => {
                    if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('North').catch(() => {}); }
                  }}
                />
              )}

              {(isWindowedMode || activeLayoutProfile.chrome.barPosition === 'top') && chromeBar}

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
                    // keepMounted means "stay mounted while open, even when not the active tab".
                    // Closed panels should unmount to avoid background work.
                    const shouldMount = !isPinned && (panel.keepMounted ? isPanelOpen : isPanelOpen && isActive);

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
                        {panel.kind === 'folder-plugin'
                          ? (
                            <FolderPluginRenderer
                              plugin={folderPlugins.find(candidate => candidate.id === panel.id) ?? {
                                id: panel.id,
                                name: panel.label,
                                filePath: '',
                                pluginRoot: '',
                                pluginDirectory: '',
                                backendDirectory: '',
                                modified: 0,
                                defaultOpen: panel.defaultOpen ?? false,
                                keepMounted: panel.keepMounted ?? false,
                                component: null,
                                error: 'Plugin definition not found.',
                                diagnostics: {
                                  sourceKind: 'file-plugin',
                                  sourceLabel: panel.label,
                                  warnings: ['Plugin definition not found.'],
                                  capabilities: {
                                    panel: true,
                                    themes: 0,
                                    shaders: 0,
                                    fonts: 0,
                                    commands: 0,
                                    explorerActions: 0,
                                  },
                                },
                              }}
                              appearance={resolvedAppearance}
                              createPluginApi={createPluginApi}
                              hostMode="panel-tab"
                              isActive={isActive}
                            />
                          )
                          : panel.render()}
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
                      background: theme.palette.shellBackground,
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

              {!isWindowedMode && activeLayoutProfile.chrome.barPosition === 'bottom' && chromeBar}

              {!isWindowedMode && isTopAnchored && (
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
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        appearance={resolvedAppearance}
        actions={commandPaletteActions}
        shortcutLabel={formatHotkeyLabel(keybindings.commandPalette)}
        onClose={handleCloseCommandPalette}
      />
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
  formatValue,
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
  formatValue: (value: number) => string;
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
          {formatValue(value)}
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
  panelTransparency,
  onPanelTransparencyChange,
  zoom,
  onZoomChange,
  blur,
  onBlurChange,
  blurStrength,
  onBlurStrengthChange,
  blurPlatform,
}: {
  accent: string;
  border: string;
  muted: string;
  text: string;
  opacity: number;
  onOpacityChange: (v: number) => void;
  panelTransparency: number;
  onPanelTransparencyChange: (v: number) => void;
  zoom: number;
  onZoomChange: (v: number) => void;
  blur: boolean;
  onBlurChange: (v: boolean) => void;
  blurStrength: number;
  onBlurStrengthChange: (v: number) => void;
  blurPlatform: RuntimePlatform;
}) {
  const supportsNativeBlur = blurPlatform === 'macos' || blurPlatform === 'windows';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeControl, setActiveControl] = useState<'opacity' | 'panelTransparency' | 'zoom' | 'blur' | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      setActiveControl(null);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <button
        onClick={() => setIsOpen(open => !open)}
        title="Open surface controls"
        style={{
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen ? `${accent}18` : 'rgba(255,255,255,0.025)',
          border: `1px solid ${isOpen ? accent : border}`,
          color: isOpen ? text : muted,
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: isOpen ? `0 0 0 1px ${accent}18 inset` : 'none',
        }}
      >
        <SlidersHorizontal size={11} style={{ color: isOpen ? accent : muted }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 220,
            padding: 8,
            borderRadius: 12,
            border: `1px solid ${border}`,
            background: 'linear-gradient(180deg, rgba(12,14,24,0.96), rgba(8,10,18,0.94))',
            boxShadow: '0 12px 28px rgba(0,0,0,0.34)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 60,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 4px 4px' }}>
            <span style={{ fontSize: 9, color: muted, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Surface
            </span>
            <button
              onClick={() => onBlurChange(!blur)}
              title={supportsNativeBlur
                ? (blur ? 'Disable native window blur' : 'Enable native window blur')
                : 'Native blur is currently only available on macOS and Windows'}
              style={{
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 8px',
                borderRadius: 6,
                border: `1px solid ${blur ? accent : border}`,
                background: blur ? `${accent}18` : 'rgba(255,255,255,0.025)',
                color: blur ? text : muted,
                cursor: 'pointer',
                opacity: supportsNativeBlur ? 1 : 0.65,
              }}
            >
              <Droplet size={11} style={{ color: blur ? accent : muted }} />
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Blur
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0 2px 2px' }}>
            <CompactScrubberControl
              label="Op"
              title="Adjust window opacity."
              value={opacity}
              min={overlayVisualControls.opacity.min}
              max={overlayVisualControls.opacity.max}
              step={overlayVisualControls.opacity.step}
              accent={accent}
              border={border}
              muted={muted}
              text={text}
              formatValue={value => formatOverlayVisualControlValue('opacity', value)}
              active={activeControl === 'opacity'}
              onActiveChange={next => setActiveControl(next ? 'opacity' : null)}
              onChange={onOpacityChange}
              onReset={() => onOpacityChange(overlayVisualControls.opacity.defaultValue)}
            />

            <CompactScrubberControl
              label="Pt"
              title="Adjust panel transparency without dimming the panel content."
              value={panelTransparency}
              min={overlayVisualControls.panelTransparency.min}
              max={overlayVisualControls.panelTransparency.max}
              step={overlayVisualControls.panelTransparency.step}
              accent={accent}
              border={border}
              muted={muted}
              text={text}
              formatValue={value => formatOverlayVisualControlValue('panelTransparency', value)}
              active={activeControl === 'panelTransparency'}
              onActiveChange={next => setActiveControl(next ? 'panelTransparency' : null)}
              onChange={onPanelTransparencyChange}
              onReset={() => onPanelTransparencyChange(overlayVisualControls.panelTransparency.defaultValue)}
            />

            <CompactScrubberControl
              label="Bl"
              title="Adjust glass blur strength."
              value={blurStrength}
              min={overlayVisualControls.blurStrength.min}
              max={overlayVisualControls.blurStrength.max}
              step={overlayVisualControls.blurStrength.step}
              accent={accent}
              border={border}
              muted={muted}
              text={text}
              formatValue={value => formatOverlayVisualControlValue('blurStrength', value)}
              active={activeControl === 'blur'}
              onActiveChange={next => setActiveControl(next ? 'blur' : null)}
              onChange={onBlurStrengthChange}
              onReset={() => onBlurStrengthChange(overlayVisualControls.blurStrength.defaultValue)}
            />

            <CompactScrubberControl
              label="Zm"
              title="Adjust window zoom."
              value={zoom}
              min={overlayVisualControls.zoom.min}
              max={overlayVisualControls.zoom.max}
              step={overlayVisualControls.zoom.step}
              accent={accent}
              border={border}
              muted={muted}
              text={text}
              formatValue={value => formatOverlayVisualControlValue('zoom', value)}
              active={activeControl === 'zoom'}
              onActiveChange={next => setActiveControl(next ? 'zoom' : null)}
              onChange={onZoomChange}
              onReset={() => onZoomChange(overlayVisualControls.zoom.defaultValue)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({
  appearance,
  layoutProfile,
  layoutProfiles,
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
  onSelectLayoutProfile,
  onSetWindowMode,
  onOpenCommandPalette,
  onToggleOverlayAnchor,
  onClose,
  accent,
  opacity,
  onOpacityChange,
  panelTransparency,
  onPanelTransparencyChange,
  zoom,
  onZoomChange,
  showViewportControls,
  blur,
  onBlurChange,
  blurStrength,
  onBlurStrengthChange,
  blurPlatform,
  windowMode,
  overlayAnchor,
  commandPaletteShortcutLabel,
  toggleShortcutLabel,
  topBarShaderLayer,
}: {
  appearance: ResolvedOverlayAppearance;
  layoutProfile: LayoutProfile;
  layoutProfiles: LayoutProfile[];
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
  onSelectLayoutProfile: (profileId: string) => void;
  onSetWindowMode: (mode: TerminalWindowMode) => void;
  onOpenCommandPalette: () => void;
  onToggleOverlayAnchor: () => void;
  onClose: () => void;
  accent: string;
  opacity: number;
  onOpacityChange: (value: number) => void;
  panelTransparency: number;
  onPanelTransparencyChange: (value: number) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
  showViewportControls: boolean;
  blur: boolean;
  onBlurChange: (v: boolean) => void;
  blurStrength: number;
  onBlurStrengthChange: (value: number) => void;
  blurPlatform: RuntimePlatform;
  windowMode: TerminalWindowMode;
  overlayAnchor: OverlayWindowAnchor;
  commandPaletteShortcutLabel: string;
  toggleShortcutLabel: string;
  topBarShaderLayer?: React.ReactNode;
}) {
  const BORDER = appearance.theme.palette.border;
  const MUTED = appearance.theme.palette.textMuted;
  const TEXT = appearance.theme.palette.textPrimary;
  const workbench = appearance.workbenchTheme;
  const uiFont = appearance.fonts.ui;
  const monoFont = appearance.fonts.mono;
  const CHROME_HEIGHT = workbench.metrics.chromeHeight;
  const usesFloatingTopBar = workbench.topBarStyle === 'floating' || workbench.topBarStyle === 'glass';
  const usesInsetTopBar = usesFloatingTopBar || workbench.topBarStyle === 'minimal';
  const menuRef = useRef<HTMLDivElement | null>(null);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const isExplorerActive = activePanelId === 'explorer';
  const isSettingsActive = activePanelId === 'settings';
  const supportsNativeBlur = blurPlatform === 'macos' || blurPlatform === 'windows';
  const isBottomBar = layoutProfile.chrome.barPosition === 'bottom';
  const isWindowedMode = windowMode === 'windowed';
  const windowedChromeTopInset = isWindowedMode && blurPlatform === 'windows' && !isWindowMaximized ? 10 : 0;
  const openPanels = useMemo(
    () => getTabbedOpenPanelIds(layoutProfile, openPanelIds)
      .map(id => panels.find(panel => panel.id === id))
      .filter((panel): panel is OverlayPanelDefinition => Boolean(panel)),
    [layoutProfile, openPanelIds, panels],
  );
  const tabPanels = useMemo(
    () => openPanels.filter(panel => panel.id !== 'explorer' && panel.id !== 'settings'),
    [openPanels],
  );
  const panelGroups = useMemo(() => {
    const builtInPanels = panels.filter(panel => panel.kind === 'built-in-panel');
    const pluginPanels = panels.filter(panel => panel.kind === 'folder-plugin');

    return [
      builtInPanels.length > 0 ? { id: 'core', label: 'Core Panels', panels: builtInPanels } : null,
      pluginPanels.length > 0 ? { id: 'plugins', label: 'Plugin Panels', panels: pluginPanels } : null,
    ].filter((group): group is { id: string; label: string; panels: OverlayPanelDefinition[] } => Boolean(group));
  }, [panels]);
  const panelMenuWidth = Math.max(236, Math.min(292, viewportSize.width - 24));
  const panelMenuMaxHeight = Math.max(190, Math.min(440, viewportSize.height - 92));
  const compactPanelMenu = panelMenuWidth < 264 || viewportSize.height < 640;
  const panelMenuRowHeight = compactPanelMenu ? 42 : 52;
  const panelMenuHeight = Math.max(
    190,
    Math.min(
      panelMenuMaxHeight,
      52 + panelGroups.length * 26 + panels.length * panelMenuRowHeight,
    ),
  );
  const showPanelDescriptions = !compactPanelMenu && panelMenuHeight > 290;
  const nextOverlayAnchor = overlayAnchor === 'top' ? 'bottom' : 'top';
  const layoutMenuWidth = Math.max(220, Math.min(320, viewportSize.width - 24));
  const layoutMenuMaxHeight = Math.max(180, Math.min(360, viewportSize.height - 92));
  const layoutButtonTitle = isWindowedMode
    ? (layoutSourcePath
      ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}`
      : `Cycle Layout (${layoutProfile.label})`)
    : (layoutSourcePath
      ? `Cycle Layout (${layoutProfile.label})\n${layoutSourcePath}\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`
      : `Cycle Layout (${layoutProfile.label})\nRight-click: dock overlay to the ${nextOverlayAnchor} edge`);
  const shouldShowLeadingWindowControls = isWindowedMode && blurPlatform === 'macos';
  const shouldShowTrailingWindowControls = isWindowedMode && blurPlatform !== 'macos';

  const handleStartWindowDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isWindowedMode || event.button !== 0 || !isTauri()) {
      return;
    }

    event.preventDefault();
    getCurrentWindow().startDragging().catch(() => {});
  }, [isWindowedMode]);

  const handleMinimizeWindow = useCallback(() => {
    if (!isWindowedMode || !isTauri()) {
      return;
    }

    getCurrentWindow().minimize().catch(() => {});
  }, [isWindowedMode]);

  const handleToggleMaximize = useCallback(async () => {
    if (!isWindowedMode || !isTauri()) {
      return;
    }

    const win = getCurrentWindow();
    const maximized = await win.isMaximized().catch(() => false);
    if (maximized) {
      await win.unmaximize().catch(() => {});
      setIsWindowMaximized(false);
      return;
    }

    await win.maximize().catch(() => {});
    setIsWindowMaximized(true);
  }, [isWindowedMode]);

  useEffect(() => {
    if (!isMenuOpen && !isLayoutMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
      if (!layoutMenuRef.current?.contains(target)) {
        setIsLayoutMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isLayoutMenuOpen, isMenuOpen]);

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

  useEffect(() => {
    if (!isWindowedMode || !isTauri()) {
      setIsWindowMaximized(false);
      return;
    }

    let cancelled = false;
    const win = getCurrentWindow();
    const sync = async () => {
      const nextValue = await win.isMaximized().catch(() => false);
      if (!cancelled) {
        setIsWindowMaximized(nextValue);
      }
    };

    void sync();
    const unlistenResize = win.onResized(() => {
      void sync();
    });

    return () => {
      cancelled = true;
      void unlistenResize.then(unlisten => unlisten());
    };
  }, [isWindowedMode]);

  const panelMenu = (
    <div style={{
      position: 'absolute',
      top: isBottomBar ? 'auto' : 'calc(100% + 8px)',
      bottom: isBottomBar ? 'calc(100% + 8px)' : 'auto',
      right: 0,
      width: panelMenuWidth,
      maxWidth: 'calc(100vw - 16px)',
      height: panelMenuHeight,
      maxHeight: panelMenuMaxHeight,
      background: 'var(--overlay-workbench-chrome-menu-bg)',
      border: '1px solid var(--overlay-workbench-chrome-border)',
      borderRadius: workbench.metrics.panelRadius,
      boxShadow: 'var(--overlay-workbench-shell-shadow)',
      padding: 6,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backdropFilter: workbench.topBarStyle === 'glass' ? 'blur(18px)' : 'none',
      WebkitBackdropFilter: workbench.topBarStyle === 'glass' ? 'blur(18px)' : 'none',
    }}
    >
      <div style={{
        padding: '8px 10px 10px',
        fontSize: 10,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
        borderBottom: '1px solid var(--overlay-workbench-chrome-border)',
      }}
      >
        <div>Panels</div>
        <div style={{ marginTop: 4, fontSize: 9, letterSpacing: '0.04em', textTransform: 'none', fontWeight: 500 }}>
          {openPanels.length} open
          {panelGroups.some(group => group.id === 'plugins') ? ` • ${panelGroups.find(group => group.id === 'plugins')?.panels.length ?? 0} plugins` : ''}
        </div>
      </div>

      <OverlayScrollArea
        style={{ flex: 1, minHeight: 0 }}
        viewportStyle={{ paddingRight: 2, paddingTop: 6 }}
        contentStyle={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}
      >
        {panelGroups.map(group => (
          <div key={group.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              padding: '0 6px',
              fontSize: 9,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}
            >
              {group.label}
            </div>

            {group.panels.map(panel => {
              const isOpen = openPanelIds.includes(panel.id);
              const isActive = panel.id === activePanelId;
              const isPinned = pinnedPanelIds.includes(panel.id);
              const helperLabel = isPinned ? `Docked by ${layoutProfile.label}` : panel.description;
              const statusLabel = isPinned ? 'Docked' : isOpen ? 'Open' : panel.kind === 'folder-plugin' ? 'Plugin' : 'Closed';

              return (
                <button
                  key={panel.id}
                  onClick={() => {
                    if (!isPinned) {
                      if (isOpen) {
                        onPanelSelect(panel.id);
                      } else {
                        onPanelToggle(panel.id);
                      }
                    }
                    setIsMenuOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: compactPanelMenu ? 8 : 10,
                    padding: compactPanelMenu ? '8px 10px' : '9px 10px',
                    border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : 'transparent'}`,
                    borderRadius: 9,
                    background: isActive
                      ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                      : isOpen
                        ? 'var(--overlay-workbench-chrome-tab-bg)'
                        : 'var(--overlay-workbench-chrome-button-bg)',
                    color: TEXT,
                    cursor: isPinned ? 'default' : 'pointer',
                    textAlign: 'left',
                    minHeight: compactPanelMenu ? 40 : 48,
                  }}
                >
                  <span style={{
                    width: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isOpen || isPinned ? accent : 'transparent',
                    flexShrink: 0,
                  }}
                  >
                    <Check size={12} />
                  </span>
                  <span style={{ display: 'flex', color: isActive ? accent : MUTED, flexShrink: 0 }}>{panel.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: compactPanelMenu ? 11 : 12, fontWeight: 700, color: TEXT }}>{panel.label}</span>
                      {isActive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
                    </span>
                    {showPanelDescriptions && (
                      <span style={{
                        display: 'block',
                        marginTop: 2,
                        fontSize: 10,
                        color: MUTED,
                        lineHeight: 1.35,
                      }}
                      >
                        {helperLabel}
                      </span>
                    )}
                  </span>
                  <span style={{
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: isPinned || isOpen ? accent : MUTED,
                    padding: '3px 6px',
                    borderRadius: workbench.metrics.controlRadius,
                    border: `1px solid ${isPinned || isOpen ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                    background: isPinned || isOpen ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-chrome-button-bg)',
                    flexShrink: 0,
                  }}
                  >
                    {statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </OverlayScrollArea>
    </div>
  );

  const layoutMenu = (
    <div style={{
      position: 'absolute',
      top: isBottomBar ? 'auto' : 'calc(100% + 8px)',
      bottom: isBottomBar ? 'calc(100% + 8px)' : 'auto',
      left: 0,
      width: layoutMenuWidth,
      maxWidth: 'calc(100vw - 16px)',
      maxHeight: layoutMenuMaxHeight,
      background: 'var(--overlay-workbench-chrome-menu-bg)',
      border: '1px solid var(--overlay-workbench-chrome-border)',
      borderRadius: workbench.metrics.panelRadius,
      boxShadow: 'var(--overlay-workbench-shell-shadow)',
      padding: 6,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backdropFilter: workbench.topBarStyle === 'glass' ? 'blur(18px)' : 'none',
      WebkitBackdropFilter: workbench.topBarStyle === 'glass' ? 'blur(18px)' : 'none',
    }}
    >
      <div style={{
        padding: '8px 10px 10px',
        fontSize: 10,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
        borderBottom: '1px solid var(--overlay-workbench-chrome-border)',
      }}
      >
        <div>Layouts</div>
        <div style={{ marginTop: 4, fontSize: 9, letterSpacing: '0.04em', textTransform: 'none', fontWeight: 500 }}>
          {layoutProfile.label}
          {layoutSourcePath ? ` • ${layoutSourcePath}` : ''}
        </div>
      </div>

      <OverlayScrollArea
        style={{ flex: 1, minHeight: 0 }}
        viewportStyle={{ paddingRight: 2, paddingTop: 6 }}
        contentStyle={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}
      >
        {layoutProfiles.map(profile => {
          const isActive = profile.id === layoutProfile.id;
          return (
            <button
              key={profile.id}
              onClick={() => {
                if (!isActive) {
                  onSelectLayoutProfile(profile.id);
                }
                setIsLayoutMenuOpen(false);
              }}
              title={profile.description}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                border: `1px solid ${isActive ? 'var(--overlay-workbench-chrome-button-active-border)' : 'transparent'}`,
                borderRadius: 10,
                background: isActive ? 'var(--overlay-workbench-chrome-tab-active-bg)' : 'var(--overlay-workbench-chrome-button-bg)',
                color: TEXT,
                cursor: isActive ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                width: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? accent : 'transparent',
                flexShrink: 0,
                paddingTop: 2,
              }}
              >
                <Check size={12} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isActive ? TEXT : MUTED }}>
                  {profile.label}
                </span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 10, lineHeight: 1.45, color: MUTED }}>
                  {profile.description}
                </span>
              </span>
            </button>
          );
        })}
      </OverlayScrollArea>
    </div>
  );

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'stretch',
      height: CHROME_HEIGHT + windowedChromeTopInset,
      flexShrink: 0,
      paddingTop: windowedChromeTopInset,
      boxSizing: 'border-box',
      margin: usesInsetTopBar ? 'var(--overlay-workbench-shell-inset)' : 0,
      background: workbench.topBarStyle === 'minimal'
        ? 'transparent'
        : `linear-gradient(180deg, var(--overlay-workbench-chrome-bg), ${appearance.theme.palette.appBackgroundAlt})`,
      borderBottom: usesFloatingTopBar || workbench.topBarStyle === 'minimal'
        ? 'none'
        : (isBottomBar ? 'none' : '1px solid var(--overlay-workbench-chrome-border)'),
      borderTop: usesFloatingTopBar || workbench.topBarStyle === 'minimal'
        ? 'none'
        : (isBottomBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none'),
      border: usesFloatingTopBar ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
      borderRadius: usesInsetTopBar ? workbench.metrics.panelRadius : 0,
      boxShadow: usesFloatingTopBar
        ? 'var(--overlay-workbench-shell-shadow)'
        : (isBottomBar
            ? 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 -8px 18px rgba(0,0,0,0.2)'
            : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.2)'),
      overflow: 'hidden',
      backdropFilter: workbench.topBarStyle === 'glass' ? 'blur(18px)' : 'none',
      WebkitBackdropFilter: workbench.topBarStyle === 'glass' ? 'blur(18px)' : 'none',
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {topBarShaderLayer}
      </div>
      {shouldShowLeadingWindowControls && (
        <div style={{ borderRight: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <WindowControls
            platform={blurPlatform}
            isMaximized={isWindowMaximized}
            onMinimize={handleMinimizeWindow}
            onMaximize={() => { void handleToggleMaximize(); }}
            onClose={onClose}
            textMuted={MUTED}
          />
        </div>
      )}
      <button
        onClick={onCycleLayout}
        onContextMenu={event => {
          event.preventDefault();
          if (!isWindowedMode) {
            onToggleOverlayAnchor();
          }
        }}
        title={layoutButtonTitle}
        style={{
          width: 36,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRight: `1px solid ${BORDER}`,
          flexShrink: 0,
          background: 'var(--overlay-workbench-chrome-button-bg)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: workbench.metrics.controlRadius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${accent}1e`,
          border: `1px solid ${accent}40`,
        }}>
          <TerminalIcon size={10} style={{ color: accent }} />
        </div>
      </button>

      <div ref={layoutMenuRef} style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        borderRight: `1px solid ${BORDER}`,
        flexShrink: 0,
        background: 'var(--overlay-workbench-chrome-button-bg)',
      }}>
        <button
          onClick={() => {
            setIsLayoutMenuOpen(open => !open);
            setIsMenuOpen(false);
          }}
          title={layoutButtonTitle}
          style={{
            height: 24,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 9px',
            borderRadius: workbench.metrics.controlRadius,
            border: `1px solid ${isLayoutMenuOpen ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
            background: isLayoutMenuOpen
              ? 'var(--overlay-workbench-chrome-button-active-bg)'
              : 'var(--overlay-workbench-chrome-button-bg)',
            color: TEXT,
            fontSize: 'var(--overlay-workbench-chrome-meta-size)',
            fontWeight: 700,
            letterSpacing: 'var(--overlay-workbench-label-spacing)',
            textTransform: 'uppercase',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: isLayoutMenuOpen ? `0 0 0 1px ${accent}18 inset` : 'none',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
          }}
        >
          <span>{layoutProfile.label}</span>
          <ChevronDown size={11} style={{ color: isLayoutMenuOpen ? accent : MUTED }} />
        </button>
        {isLayoutMenuOpen && layoutMenu}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 6px',
        borderRight: `1px solid ${BORDER}`,
        flexShrink: 0,
        background: 'var(--overlay-workbench-chrome-button-bg)',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => {
              setIsLayoutMenuOpen(false);
              setIsMenuOpen(false);
              onSetWindowMode(windowMode === 'windowed' ? 'overlay' : 'windowed');
            }}
            onContextMenu={event => {
              event.preventDefault();
            }}
            title={windowMode === 'windowed' ? 'Switch to Dock Mode' : 'Switch to Application Mode'}
            style={{
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 7px',
              borderRadius: workbench.metrics.controlRadius,
              border: `1px solid ${windowMode === 'overlay' ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
              background: windowMode === 'overlay'
                ? 'var(--overlay-workbench-chrome-button-active-bg)'
                : 'var(--overlay-workbench-chrome-button-bg)',
              color: windowMode === 'overlay' ? TEXT : MUTED,
              fontSize: 'var(--overlay-workbench-chrome-meta-size)',
              fontWeight: 700,
              letterSpacing: 'var(--overlay-workbench-label-spacing)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
              boxShadow: windowMode === 'overlay' ? `0 0 0 1px ${accent}18 inset` : 'none',
            }}
          >
            <span>{windowMode === 'windowed' ? 'Dock' : 'App'}</span>
          </button>
        </div>

        {windowMode === 'overlay' && (
          <button
            onClick={onToggleOverlayAnchor}
            title={`Docked to ${overlayAnchor === 'top' ? 'top' : 'bottom'} edge`}
            style={{
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 7px',
              borderRadius: workbench.metrics.controlRadius,
              border: '1px solid var(--overlay-workbench-chrome-border)',
              background: 'var(--overlay-workbench-chrome-button-bg)',
              color: MUTED,
              fontSize: 'var(--overlay-workbench-chrome-meta-size)',
              fontWeight: 700,
              letterSpacing: 'var(--overlay-workbench-label-spacing)',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, color 0.15s',
            }}
          >
            <span>{overlayAnchor === 'top' ? 'Top Edge' : 'Bottom Edge'}</span>
          </button>
        )}

        {layoutProfile.chrome.showPanelMenu && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginRight: 4 }}>
            <button
              onClick={() => {
                setIsMenuOpen(open => !open);
                setIsLayoutMenuOpen(false);
              }}
              title="Toggle Panels"
              style={{
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isMenuOpen
                  ? 'var(--overlay-workbench-chrome-button-active-bg)'
                  : 'var(--overlay-workbench-chrome-button-bg)',
                border: `1px solid ${isMenuOpen ? 'var(--overlay-workbench-chrome-button-active-border)' : 'var(--overlay-workbench-chrome-border)'}`,
                borderRadius: workbench.metrics.controlRadius,
                color: isMenuOpen ? TEXT : MUTED,
                cursor: 'pointer',
                boxShadow: isMenuOpen ? `0 0 0 1px ${accent}22 inset` : 'none',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >
              <LayoutGrid size={11} style={{ color: isMenuOpen ? accent : MUTED }} />
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
            panelTransparency={panelTransparency}
            onPanelTransparencyChange={onPanelTransparencyChange}
            zoom={zoom}
            onZoomChange={onZoomChange}
            blur={blur}
            onBlurChange={onBlurChange}
            blurStrength={blurStrength}
            onBlurStrengthChange={onBlurStrengthChange}
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
              width: 22,
              height: 22,
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
            <Droplet size={11} />
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
            panelTransparency={panelTransparency}
            onPanelTransparencyChange={onPanelTransparencyChange}
            zoom={zoom}
            onZoomChange={onZoomChange}
            blur={blur}
            onBlurChange={onBlurChange}
            blurStrength={blurStrength}
            onBlurStrengthChange={onBlurStrengthChange}
            blurPlatform={blurPlatform}
          />
        )}

        <button
          onClick={onOpenCommandPalette}
          title={`Open Command Palette (${commandPaletteShortcutLabel})`}
          style={{
            width: 22,
              height: 22,
              padding: 0,
              background: 'var(--overlay-workbench-chrome-button-bg)',
              border: '1px solid var(--overlay-workbench-chrome-border)',
              color: MUTED,
              borderRadius: workbench.metrics.controlRadius,
              display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Search size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
        {layoutProfile.chrome.showSettingsShortcut && (
          <button
            onClick={onOpenSettings}
            title="Open Settings"
            style={{
              height: '100%',
              width: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isSettingsActive
                ? 'var(--overlay-workbench-chrome-tab-active-bg)'
                : 'var(--overlay-workbench-chrome-tab-bg)',
              border: 'none',
              borderRight: `1px solid ${BORDER}`,
              borderLeft: `1px solid ${isSettingsActive ? 'var(--overlay-workbench-chrome-button-active-border)' : BORDER}`,
              color: isSettingsActive ? TEXT : MUTED,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: isSettingsActive ? `inset 0 -2px 0 ${accent}, inset 0 0 0 1px ${accent}18` : 'inset 0 -2px 0 transparent',
              transition: 'background 0.15s, color 0.15s, box-shadow 0.15s, border-color 0.15s',
              padding: 0,
            }}
          >
            <Settings2 size={12} style={{ color: isSettingsActive ? accent : MUTED }} />
          </button>
        )}

        <button
          onClick={() => onPanelSelect('explorer')}
          title="Open Explorer"
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 14px',
            background: isExplorerActive
              ? 'var(--overlay-workbench-chrome-tab-active-bg)'
              : 'var(--overlay-workbench-chrome-tab-bg)',
            border: 'none',
            borderRight: `1px solid ${BORDER}`,
            color: isExplorerActive ? TEXT : MUTED,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: isExplorerActive ? `inset 0 -2px 0 ${accent}, inset 0 0 0 1px ${accent}18` : 'inset 0 -2px 0 transparent',
            transition: 'background 0.15s, color 0.15s, box-shadow 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ display: 'flex', color: isExplorerActive ? accent : MUTED }}>
            {panels.find(panel => panel.id === 'explorer')?.icon ?? <TerminalIcon size={12} />}
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>Explorer</span>
          {isExplorerActive && <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />}
        </button>

          <OverlayScrollArea direction="horizontal" style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.08)' }} contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}>
          {tabPanels.map(panel => {
            const isActive = panel.id === activePanelId;
            const isDragged = draggedPanelId === panel.id;
            const isPersistentTab = layoutProfile.behavior.enforcedOpenPanelIds.includes(panel.id);
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
                  gap: 6,
                  padding: '0 9px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--overlay-workbench-chrome-tab-active-bg)' : (workbench.tabStyle === 'segment' ? 'var(--overlay-workbench-chrome-tab-bg)' : 'transparent'),
                  border: 'none',
                  borderBottom: isBottomBar ? 'none' : `2px solid ${isActive ? accent : 'transparent'}`,
                  borderTop: isBottomBar ? `2px solid ${isActive ? accent : 'transparent'}` : 'none',
                  borderRight: `1px solid ${BORDER}`,
                  color: isActive ? TEXT : MUTED,
                  fontSize: 'var(--overlay-workbench-tab-label-size)',
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: uiFont,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
                  flexShrink: 0,
                  userSelect: 'none',
                  opacity: isDragged ? 0.45 : 1,
                  height: '100%',
                  borderRadius: workbench.tabStyle === 'capsule' ? workbench.metrics.controlRadius : 0,
                  margin: workbench.tabStyle === 'capsule' ? '4px 4px' : 0,
                }}
              >
                <span style={{ display: 'flex', color: isActive ? accent : MUTED }}>{panel.icon}</span>
                <span>{panel.label}</span>
                {isActive && <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />}
                {isActive && !isPersistentTab && (
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
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      color: MUTED,
                    }}
                  >
                    <X size={10} />
                  </span>
                )}
              </button>
            );
          })}
        </OverlayScrollArea>
      </div>

      {isWindowedMode && (
        <div
          data-tauri-drag-region
          onPointerDown={handleStartWindowDrag}
          onDoubleClick={() => { void handleToggleMaximize(); }}
          title="Drag Window"
          style={{
            width: 72,
            minWidth: 72,
            flexShrink: 0,
            borderLeft: `1px solid ${BORDER}`,
            background: 'var(--overlay-workbench-chrome-button-bg)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        />
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        borderLeft: `1px solid ${BORDER}`,
        flexShrink: 0,
        background: 'var(--overlay-workbench-chrome-button-bg)',
      }}>
        {layoutProfile.chrome.showShortcutBadge && !isWindowedMode && (
          <kbd style={{
            fontSize: 'var(--overlay-workbench-chrome-meta-size)', fontFamily: monoFont,
            background: 'var(--overlay-workbench-chrome-button-bg)',
            padding: '1px 4px', borderRadius: workbench.metrics.controlRadius,
            border: '1px solid var(--overlay-workbench-chrome-border)',
            color: MUTED, userSelect: 'none',
          }}>
            {toggleShortcutLabel}
          </kbd>
        )}

        {shouldShowTrailingWindowControls && (
          <WindowControls
            platform={blurPlatform}
            isMaximized={isWindowMaximized}
            onMinimize={handleMinimizeWindow}
            onMaximize={() => { void handleToggleMaximize(); }}
            onClose={onClose}
            textMuted={MUTED}
          />
        )}

        {!isWindowedMode && (
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: MUTED, padding: 4, borderRadius: workbench.metrics.controlRadius, display: 'flex', alignItems: 'center',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; e.currentTarget.style.color = appearance.theme.palette.danger; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = MUTED; }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
