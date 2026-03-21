import { useState, useEffect, useEffectEvent, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
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
  createBuiltInPanelDefinitions,
  createFolderPluginPanelDefinitions,
  type OverlayPanelDefinition,
} from './panels/panelRegistry';
import { PluginsManager } from './components/PluginsManager';
import { animationSystemConfig } from './config/animations';
import { getPluginStorageDirectory, pluginSystemConfig } from './config/plugins';
import {
  AnimationOverlayLayer,
  createBuiltInOverlayAnimations,
  isFrontendAnimationFile,
  loadAnimationFromSource,
  mergeOverlayAnimations,
  resolveAnimationDurationMs,
  resolveAnimationShellStyle,
  type AnimationFileEntry,
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
  type ShaderFileEntry,
} from './components/shaderRuntime';
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
import { loadThemePackages as discoverThemePackages, themeSystemConfig, type LoadedOverlayThemePackage } from './config/themePackages';
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
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  overlayVisualControls,
} from './config/overlayWindow';
import { detectClientPlatform, getPlatformPathSeparator, joinPlatformPath, type RuntimePlatform } from './config/platform';
import { derivePanelOpenState, reorderPanelIds } from './components/panelUtils';
import { OverlayScrollArea } from './components/OverlayScrollArea';
import { useGlobalShortcut } from './input/GlobalShortcuts';
import { useSettingsStore, type LayoutPanelState, type OverlayWindowAnchor } from './store/settingsStore';
import { useTerminalStore } from './store/terminalStore';

const LOGICAL_PADDING = 12;

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

function parseExternalArgs(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map(value => value.trim())
    .filter(Boolean);
}

function getParentPath(path: string, separator: string): string {
  let normalized = path.replace(/[\\/]+/g, separator);
  while (normalized.endsWith(separator)) {
    normalized = normalized.slice(0, -separator.length);
  }
  const index = normalized.lastIndexOf(separator);
  return index > 0 ? normalized.slice(0, index) : '';
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

interface PluginDirectoryWatchEvent {
  root: string;
  kind: string;
  paths: string[];
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

function getThemeVisualAnimation(layer: NonNullable<ResolvedOverlayAppearance['theme']['visuals']>[number]): string | undefined {
  if (!layer.animation) {
    return undefined;
  }

  const durationMs = typeof layer.animation.durationMs === 'number' ? layer.animation.durationMs : 18000;
  const easing = layer.animation.easing ?? 'ease-in-out';
  const direction = layer.animation.direction ?? 'alternate';
  return `overlay-theme-visual-${layer.animation.kind} ${durationMs}ms ${easing} infinite ${direction}`;
}

function buildThemeVisualStyle(layer: NonNullable<ResolvedOverlayAppearance['theme']['visuals']>[number]): CSSProperties {
  return {
    position: 'absolute',
    inset: layer.inset ?? '0',
    pointerEvents: 'none',
    backgroundImage: layer.backgroundImage,
    backgroundSize: layer.backgroundSize ?? 'cover',
    backgroundPosition: layer.backgroundPosition ?? 'center',
    backgroundRepeat: layer.backgroundRepeat ?? 'no-repeat',
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
    filter: layer.filter ?? 'none',
    mixBlendMode: (layer.blendMode as CSSProperties['mixBlendMode']) ?? 'normal',
    animation: getThemeVisualAnimation(layer),
    willChange: layer.animation ? 'transform, opacity' : undefined,
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
  const [folderPlugins, setFolderPlugins] = useState<LoadedOverlayPlugin[]>([]);
  const [folderPluginsError, setFolderPluginsError] = useState<string | null>(null);
  const [folderPluginsLoading, setFolderPluginsLoading] = useState(true);
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
  const lastToggleAtRef = useRef(0);
  const isProgrammaticResizeRef = useRef(false);
  const interactionLockUntilRef = useRef(0);
  const animationSignatureRef = useRef('');
  const shaderSignatureRef = useRef('');
  const pluginSignatureRef = useRef('');
  const dragHideRestoreRef = useRef(false);
  const refreshFolderPluginsRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);
  const pluginWatchDebounceTimerRef = useRef<number | null>(null);
  const [layoutManifest, setLayoutManifest] = useState(BUILT_IN_LAYOUT_MANIFEST);
  const [layoutConfigSource, setLayoutConfigSource] = useState<string | null>(null);
  const [themePackages, setThemePackages] = useState<LoadedOverlayThemePackage[]>([]);
  const [themePackagesLoading, setThemePackagesLoading] = useState(true);
  const [themePackagesError, setThemePackagesError] = useState<string | null>(null);
  const [repositoryPickerRequestId, setRepositoryPickerRequestId] = useState(0);
  const [isRepositoryPickerActive, setIsRepositoryPickerActive] = useState(false);
  const [pendingRepositoryImports, setPendingRepositoryImports] = useState<string[]>([]);

  const settings = useSettingsStore(s => s.settings.terminal);
  const appearance = useSettingsStore(s => s.settings.appearance);
  const keybindings = useSettingsStore(s => s.settings.keybindings);
  const layoutSettings = useSettingsStore(s => s.settings.layout);
  const systemSettings = useSettingsStore(s => s.settings.system);
  const updateTerminal = useSettingsStore(s => s.updateTerminal);
  const updateAppearance = useSettingsStore(s => s.updateAppearance);
  const updateLayout = useSettingsStore(s => s.updateLayout);
  const updateSystem = useSettingsStore(s => s.updateSystem);
  const { initStore, addDirectoryBookmark } = useTerminalStore();
  const resolvedPackageThemes = useMemo(
    () => themePackages.map(pkg => pkg.theme),
    [themePackages],
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
  const isOverlayVisible = overlayPhase !== 'closed';
  overlayVisibleRef.current = isOverlayVisible;
  const appOpacity = appearance.appOpacity ?? 1.0;
  const panelTransparency = appearance.panelTransparency ?? overlayVisualControls.panelTransparency.defaultValue;
  const appZoom = appearance.appZoom ?? 1.0;
  const appBlur = appearance.appBlur ?? true;
  const appBlurStrength = appearance.appBlurStrength ?? overlayVisualControls.blurStrength.defaultValue;
  const animationsEnabled = appearance.animations ?? true;
  const appOpenAnimation = animationsEnabled
    ? (appearance.appOpenAnimation ?? animationSystemConfig.defaultOpenAnimationId)
    : 'none';
  const appCloseAnimation = animationsEnabled
    ? (appearance.appCloseAnimation ?? animationSystemConfig.defaultCloseAnimationId)
    : 'none';
  const appAnimationDurationMs = animationsEnabled
    ? clampOverlayAnimationDuration(appearance.appAnimationDurationMs ?? 320)
    : 140;
  const appAnimationIntensity = clampOverlayAnimationIntensity(appearance.appAnimationIntensity ?? 1);
  const clampedAppOpacity = clampOverlayVisualControlValue('opacity', appOpacity);
  const clampedPanelTransparency = clampOverlayVisualControlValue('panelTransparency', panelTransparency);
  const clampedAppZoom = clampOverlayVisualControlValue('zoom', appZoom);
  const clampedAppBlurStrength = clampOverlayVisualControlValue('blurStrength', appBlurStrength);
  const overlayAnchor: OverlayWindowAnchor = settings.overlayAnchor === 'top' ? 'top' : 'bottom';
  const isTopAnchored = overlayAnchor === 'top';
  const scaledWidth = `${100 / clampedAppZoom}%`;
  const scaledHeight = `${100 / clampedAppZoom}%`;
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
    () => mergeOverlayAnimations(builtInAnimations, authoredAnimations),
    [authoredAnimations, builtInAnimations],
  );
  const availableShaders = useMemo(
    () => mergeOverlayShaders(builtInShaders, authoredShaders),
    [authoredShaders, builtInShaders],
  );
  const availableAnimationsById = useMemo(
    () => new Map(availableAnimations.map(animation => [animation.id, animation])),
    [availableAnimations],
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
    overlayAnimationDirection === 'exit' ? appCloseAnimation : appOpenAnimation,
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
    zoom: clampedAppZoom,
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
    clampedAppZoom,
    overlayAnimationDirection,
    overlayAnchor,
    overlayPhase,
    shellAnimation,
    shellAnimationDurationMs,
    theme,
  ]);
  const shellAnimationStyle = resolveAnimationShellStyle(shellAnimation, shellAnimationContext);
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
    if (!isTauri()) {
      return;
    }

    invoke('tray_set_visible', { visible: systemSettings.hideAppInTray }).catch(error => {
      console.warn('OverlayTerm: failed to sync tray visibility', error);
    });
  }, [systemSettings.hideAppInTray]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    invoke('window_set_taskbar_visibility', { visible: systemSettings.showInTaskbar }).catch(error => {
      console.warn('OverlayTerm: failed to sync taskbar visibility', error);
    });
  }, [systemSettings.showInTaskbar]);

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
      const nextAnimation = resolveAnimationById(
        appOpenAnimation,
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
      isProgrammaticResizeRef.current = true;
      await win.setSize(new PhysicalSize(layout.width, layout.height));
      await win.setPosition(new PhysicalPosition(layout.x, layout.y));
      await win.show();
      await win.setPosition(new PhysicalPosition(layout.x, layout.y));
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
        void win.setPosition(new PhysicalPosition(layout.x, layout.y)).catch(() => {});
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
  }, [appAnimationDurationMs, appOpenAnimation, clearAnimationClock, markOverlayRuntimePhase, resolveAnimationById, startAnimationProgress]);

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
    const nextAnimation = resolveAnimationById(
      appCloseAnimation,
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
  }, [appAnimationDurationMs, appCloseAnimation, clearAnimationClock, markOverlayRuntimePhase, resolveAnimationById, startAnimationProgress]);

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

  const handleDragStart = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const source = (event.target as HTMLElement | null)?.closest('[data-overlay-drag-source="file"]');
    if (!source) {
      return;
    }

    const dragIntent = event.dataTransfer.getData('application/x-overlayterm-drag-intent');
    if (dragIntent !== 'native-out') {
      return;
    }

    const payload = event.dataTransfer.getData('application/x-overlayterm-paths');
    if (!payload) {
      return;
    }

    let paths: string[] = [];
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        paths = parsed.filter((entry): entry is string => typeof entry === 'string');
      }
    } catch {
      paths = [];
    }

    if (paths.length === 0) {
      return;
    }

    void (async () => {
      try {
        await hideOverlayForDrag();
        await invoke('fs_start_native_file_drag', { paths });
      } catch (error) {
        console.warn('OverlayTerm: failed to start native file drag', error);
      } finally {
        restoreOverlayAfterDrag();
      }
    })();
  }, [hideOverlayForDrag, restoreOverlayAfterDrag]);

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

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen('overlay://toggle-request', () => toggle())
      .then(fn => { unlisten = fn; })
      .catch(err => console.warn('overlay listen failed:', err));
    return () => { unlisten?.(); };
  }, [toggle]);

  useEffect(() => {
    if (!isTauri() || !import.meta.env.DEV) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!overlayVisibleRef.current && overlayPhaseRef.current === 'closed') {
        void positionAndShow();
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [positionAndShow]);

  useGlobalShortcut(keybindings.terminalToggle, toggle, true);

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

  useEffect(() => {
    if (!isOverlayVisible || typeof window === 'undefined' || !isTauri()) {
      return;
    }

    const handleWheelZoom = (event: WheelEvent) => {
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

  const openPluginsFolder = useCallback(async () => {
    await ensureDir(pluginSystemConfig.pluginsDirectory);
    await invoke('fs_open_file', { path: pluginSystemConfig.pluginsDirectory });
  }, []);

  const refreshThemePackages = useCallback(async () => {
    if (!isTauri()) {
      setThemePackages([]);
      setThemePackagesError(null);
      setThemePackagesLoading(false);
      return;
    }

    setThemePackagesLoading(true);
    try {
      await ensureDir(themeSystemConfig.themesDirectory);
      const result = await discoverThemePackages();
      setThemePackages(result.packages);
      setThemePackagesError(result.sourceError);
    } catch (error) {
      setThemePackages([]);
      setThemePackagesError(String(error));
    } finally {
      setThemePackagesLoading(false);
    }
  }, []);

  const openThemesFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    await ensureDir(themeSystemConfig.themesDirectory);
    await invoke('fs_open_file', { path: themeSystemConfig.themesDirectory });
  }, []);

  const openAnimationsFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    await ensureDir(animationSystemConfig.animationsDirectory);
    await invoke('fs_open_file', { path: animationSystemConfig.animationsDirectory });
  }, []);

  const openShadersFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    await ensureDir(shaderSystemConfig.shadersDirectory);
    await invoke('fs_open_file', { path: shaderSystemConfig.shadersDirectory });
  }, []);

  const refreshAuthoredAnimations = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredAnimations([]);
      setAuthoredAnimationsError(null);
      setAuthoredAnimationsLoading(false);
      return;
    }

    if (force) {
      animationSignatureRef.current = '';
    }

    setAuthoredAnimationsLoading(prev => prev && !force);
    setAuthoredAnimationsError(null);
    try {
      await ensureDir(animationSystemConfig.animationsDirectory);
      const listed = await invoke<AnimationFileEntry[]>('fs_list_dir', {
        path: animationSystemConfig.animationsDirectory,
        showHidden: false,
      });
      const files = listed
        .filter(isFrontendAnimationFile)
        .sort((left, right) => left.name.localeCompare(right.name));
      const nextSignature = files.map(file => `${file.path}:${file.modified}`).join('|');

      if (!force && nextSignature === animationSignatureRef.current) {
        setAuthoredAnimationsLoading(false);
        return;
      }

      animationSignatureRef.current = nextSignature;
      const loaded = await Promise.all(files.map(async file => {
        const source = await invoke<string>('fs_read_text_file', { path: file.path });
        return loadAnimationFromSource(source, file);
      }));

      setAuthoredAnimations(loaded);
    } catch (error) {
      setAuthoredAnimations([]);
      setAuthoredAnimationsError(String(error));
    } finally {
      setAuthoredAnimationsLoading(false);
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
      shaderSignatureRef.current = '';
    }

    setAuthoredShadersLoading(prev => prev && !force);
    setAuthoredShadersError(null);
    try {
      await ensureDir(shaderSystemConfig.shadersDirectory);
      const listed = await invoke<ShaderFileEntry[]>('fs_list_dir', {
        path: shaderSystemConfig.shadersDirectory,
        showHidden: false,
      });
      const files = listed
        .filter(isFrontendShaderFile)
        .sort((left, right) => left.name.localeCompare(right.name));
      const nextSignature = files.map(file => `${file.path}:${file.modified}`).join('|');

      if (!force && nextSignature === shaderSignatureRef.current) {
        setAuthoredShadersLoading(false);
        return;
      }

      shaderSignatureRef.current = nextSignature;
      const loaded = await Promise.all(files.map(async file => {
        const source = await invoke<string>('fs_read_text_file', { path: file.path });
        return loadShaderFromSource(source, file);
      }));

      setAuthoredShaders(loaded);
    } catch (error) {
      setAuthoredShaders([]);
      setAuthoredShadersError(String(error));
    } finally {
      setAuthoredShadersLoading(false);
    }
  }, []);

  const createPluginApi = useCallback((plugin: OverlayPluginContext): OverlayPluginApi => {
    const appLocalData = TauriFs.BaseDirectory.AppLocalData;
    const separator = getPlatformPathSeparator(runtimePlatform);
    const storageRoot = getPluginStorageDirectory(plugin.id);
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
    };
  }, [openPluginsFolder, runtimePlatform]);

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
    void refreshAuthoredAnimations(true);
  }, [refreshAuthoredAnimations]);

  useEffect(() => {
    void refreshAuthoredShaders(true);
  }, [refreshAuthoredShaders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshAuthoredAnimations();
    }, animationSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [refreshAuthoredAnimations]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshAuthoredShaders();
    }, shaderSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [refreshAuthoredShaders]);

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
    if (typeof window === 'undefined' || !isTauri()) {
      return;
    }

    let fallbackInterval: number | null = null;
    let unlistenPlugins: (() => void) | null = null;
    let disposed = false;

    const clearFallbackPolling = () => {
      if (fallbackInterval !== null) {
        window.clearInterval(fallbackInterval);
        fallbackInterval = null;
      }
    };

    const startFallbackPolling = () => {
      if (fallbackInterval !== null) {
        return;
      }

      fallbackInterval = window.setInterval(() => {
        void refreshFolderPluginsRef.current();
      }, pluginSystemConfig.fallbackScanIntervalMs);
    };

    const startPluginWatcher = async () => {
      try {
        await ensureDir(pluginSystemConfig.pluginsDirectory);
        unlistenPlugins = await listen<PluginDirectoryWatchEvent>(pluginSystemConfig.watchEventName, () => {
          schedulePluginRefresh(true);
        });

        await invoke('plugin_watch_directory', { path: pluginSystemConfig.pluginsDirectory });

        if (disposed) {
          unlistenPlugins?.();
          unlistenPlugins = null;
          await invoke('plugin_unwatch_directory');
        }
      } catch (error) {
        unlistenPlugins?.();
        unlistenPlugins = null;
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
      void invoke('plugin_unwatch_directory').catch(() => undefined);
    };
  }, [schedulePluginRefresh]);

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
        onOpenInTerminal: handleOpenInTerminal,
        onAddBookmark: handleAddBookmark,
        onRequestRepositoryImport: handleRequestRepositoryImport,
        pendingRepositoryImports,
        onPendingRepositoryImportsHandled: handleRepositoryImportsHandled,
        themePackages,
        themePackagesDirectory: themeSystemConfig.themesDirectory,
        themePackagesLoading,
        themePackagesError,
        onRefreshThemes: refreshThemePackages,
        onOpenThemesFolder: openThemesFolder,
        shaders: availableShaders,
        shaderDiagnostics: authoredShaders.filter(shader => Boolean(shader.error)),
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
      themePackages,
      themePackagesError,
      themePackagesLoading,
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
          strength: clampedAppBlurStrength,
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
      overlayAnchor={overlayAnchor}
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
              backdropFilter: shellBackdropFilter,
              WebkitBackdropFilter: shellBackdropFilter,
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
  const [activeControl, setActiveControl] = useState<'opacity' | 'panelTransparency' | 'zoom' | 'blur' | null>(null);

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
  overlayAnchor,
  toggleShortcutLabel,
  topBarShaderLayer,
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
  overlayAnchor: OverlayWindowAnchor;
  toggleShortcutLabel: string;
  topBarShaderLayer?: React.ReactNode;
}) {
  const BG = appearance.theme.palette.topBarBackground;
  const MENU_BG = appearance.theme.palette.topBarMenuBackground;
  const BORDER = appearance.theme.palette.border;
  const MUTED = appearance.theme.palette.textMuted;
  const TEXT = appearance.theme.palette.textPrimary;
  const uiFont = appearance.fonts.ui;
  const monoFont = appearance.fonts.mono;
  const CHROME_HEIGHT = 36;
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
      height: panelMenuHeight,
      maxHeight: panelMenuMaxHeight,
      background: MENU_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      boxShadow: appearance.theme.effects.shadow,
      padding: 6,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}
    >
      <div style={{
        padding: '8px 10px 10px',
        fontSize: 10,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 700,
        borderBottom: `1px solid ${BORDER}`,
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
                    border: `1px solid ${isActive ? `${accent}30` : 'transparent'}`,
                    borderRadius: 9,
                    background: isActive
                      ? `${accent}16`
                      : isOpen
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(255,255,255,0.015)',
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
                    borderRadius: 999,
                    border: `1px solid ${isPinned || isOpen ? `${accent}36` : `${BORDER}`}`,
                    background: isPinned || isOpen ? `${accent}12` : 'rgba(255,255,255,0.02)',
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

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'stretch',
      height: CHROME_HEIGHT,
      flexShrink: 0,
      background: `linear-gradient(180deg, ${BG}, ${appearance.theme.palette.appBackgroundAlt})`,
      borderBottom: isBottomBar ? 'none' : `1px solid ${accent}24`,
      borderTop: isBottomBar ? `1px solid ${accent}24` : 'none',
      boxShadow: isBottomBar
        ? 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 -8px 18px rgba(0,0,0,0.2)'
        : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 18px rgba(0,0,0,0.2)',
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {topBarShaderLayer}
      </div>
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
          gap: 8,
          padding: '0 12px',
          border: 'none',
          borderRight: `1px solid ${BORDER}`,
          flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01))',
          cursor: 'pointer',
          height: '100%',
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${accent}24`,
          border: `1px solid ${accent}55`,
          boxShadow: `0 0 0 1px ${accent}18 inset`,
        }}>
          <TerminalIcon size={10} style={{ color: accent }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, lineHeight: 1 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEXT, fontFamily: uiFont, userSelect: 'none' }}>
            Greeble
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 18,
            padding: '0 6px',
            borderRadius: 999,
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.03)',
            fontSize: 8,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: MUTED,
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}>
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
              width: 40,
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
              padding: 0,
            }}
          >
            <Settings2 size={12} style={{ color: isSettingsActive ? accent : MUTED }} />
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
                  gap: 6,
                  padding: '0 10px',
                  cursor: 'pointer',
                  background: isActive ? `linear-gradient(180deg, ${accent}18, transparent)` : 'transparent',
                  border: 'none',
                  borderBottom: isBottomBar ? 'none' : `2px solid ${isActive ? accent : 'transparent'}`,
                  borderTop: isBottomBar ? `2px solid ${isActive ? accent : 'transparent'}` : 'none',
                  borderRight: `1px solid ${BORDER}`,
                  color: isActive ? TEXT : MUTED,
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: uiFont,
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
                  flexShrink: 0,
                  userSelect: 'none',
                  opacity: isDragged ? 0.45 : 1,
                  height: '100%',
                }}
              >
                <span style={{ display: 'flex', color: isActive ? accent : MUTED }}>
                  <GripVertical size={10} />
                </span>
                <span style={{ display: 'flex', color: isActive ? accent : MUTED }}>{panel.icon}</span>
                <span>{panel.label}</span>
                {isActive && <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />}
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
                width: 22,
                height: 22,
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

        {layoutProfile.chrome.showShortcutBadge && (
          <kbd style={{
            fontSize: 8, fontFamily: monoFont,
            background: 'rgba(255,255,255,0.04)',
            padding: '1px 5px', borderRadius: 999,
            border: `1px solid rgba(255,255,255,0.07)`,
            color: MUTED, userSelect: 'none', marginRight: 2,
          }}>
            {toggleShortcutLabel}
          </kbd>
        )}
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: MUTED, padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center',
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; e.currentTarget.style.color = appearance.theme.palette.danger; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = MUTED; }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export default App;
