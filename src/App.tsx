import {
  useDeferredValue,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useShallow } from 'zustand/react/shallow';
import {
  currentMonitor,
  getCurrentWindow,
  monitorFromPoint,
  primaryMonitor,
} from '@tauri-apps/api/window';
import {
  buildWorkbenchSurfaceDefinitions,
  createBuiltInPanelDefinitions,
  createFolderPluginPanelDefinitions,
  type OverlayPanelDefinition,
} from './panels/panelRegistry';
import { FolderPluginRenderer, PluginsManager } from './components/PluginsManager';
import {
  CommandPalette,
  type OverlayCommandPaletteAction,
  type OverlayCommandPaletteStatusMessage,
} from './components/CommandPalette';
import { animationSystemConfig, resolvePreferredAnimationId } from './config/animations';
import {
  getManagedContentDirectory,
  getManagedContentPrimaryDirectory,
  managedContentDirectoryCatalog,
  type ManagedContentDirectoryId,
} from './config/appContentDirectories';
import { buildManagedContentDirectoryStackSignature } from './config/managedContentDirectoryStacks';
import {
  createLookdevPresetManifestFromScopeSnapshot,
  loadLookdevPresets,
  lookdevPresetSystemConfig,
  resolveLookdevPresetForWindowMode,
  type LoadedLookdevPreset,
} from './config/lookdevPresets';
import { wallpaperSystemConfig } from './config/wallpapers';
import {
  groupPanelsForWorkbenchNavigation,
  resolveWorkbenchRenderRuntime,
} from './config/workbenchRenderRuntime';
import {
  recordOverlayFrameTelemetry,
  shouldFlushOverlayFrameWindow,
  summarizeOverlayFrameWindow,
  type OverlayFrameTelemetryStats,
} from './config/frameTelemetry';
import {
  createBuiltInOverlayAnimations,
  isFrontendAnimationFile,
  loadAnimationFromSource,
  mergeOverlayAnimations,
  resolveAnimationDurationMs,
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
  WallpaperBackgroundLayer,
  createMediaWallpaperFromFile,
  createThemeAssetWallpaper,
  isFrontendWallpaperFile,
  isMediaWallpaperFile,
  loadWallpaperFromSource,
  resolveActiveWallpaper,
  type LoadedOverlayWallpaper,
  type OverlayWallpaperRenderContext,
  type ResolvedWallpaperSelection,
} from './components/wallpaperRuntime';
import {
  ThemeRendererBoundary,
  overlayThemeRendererApiVersion,
  type OverlayThemeRendererHost,
  type OverlayThemeRendererPanel,
} from './components/themeRendererRuntime';
import { getBuiltInExplorerHomePacks } from './components/home/builtInHomePacks';
import {
  normalizeThemeRendererShellLayout,
  type OverlayThemeRendererShellModel,
} from './components/themeRendererShellModel';
import {
  ChevronDown,
  IconThemeProvider,
  LayoutGrid,
  Search,
  Settings2,
  Terminal as TerminalIcon,
} from '@/components/AppIcons';
import {
  ensureFontFamilyLoaded,
  resolveOverlayAppearance,
  setOverlayPluginFonts,
} from './config/appearance';
import {
  iconThemeSystemConfig,
  loadIconThemePackages as discoverIconThemePackages,
  resolveLoadedIconThemePackage,
  type LoadedIconThemePackage,
} from './config/iconThemePackages';
import {
  loadTopBarPackages as discoverTopBarPackages,
  topBarSystemConfig,
  type LoadedOverlayTopBarPackage,
} from './config/topBarPackages';
import {
  dockPresentationSystemConfig,
  loadDockPresentationPackages as discoverDockPresentationPackages,
  resolveActiveDockPresentation,
  type DockPresentationPackageSourceLike,
  type DockPlacementMode,
  type LoadedDockPresentationPackage,
} from './config/dockPresentations';
import {
  estimateDockTerminalGridFromSize,
  formatDockTerminalGrid,
  type DockTerminalGrid,
} from './config/dockTerminalGrid';
import {
  actionPackSystemConfig,
  loadExplorerActionPacks as discoverExplorerActionPacks,
  type LoadedActionPack,
  type LoadedExplorerAction,
} from './config/actionPacks';
import {
  homePackSystemConfig,
  loadExplorerHomePacks as discoverExplorerHomePacks,
  type LoadedExplorerHomePack,
} from './config/homePackages';
import {
  DEFAULT_SOUND_PACK_ID,
  loadSoundPacks as discoverSoundPacks,
  resolveLoadedSoundPack,
  soundPackSystemConfig,
  type LoadedOverlaySoundPack,
} from './config/soundPacks';
import {
  loadExplorerMenuPacks as discoverExplorerMenuPacks,
  menuPackSystemConfig,
  type LoadedExplorerMenuPack,
} from './config/menuPacks';
import {
  collectExplorerLayoutsFromPackages,
  collectUniqueExplorerLayouts,
  loadExplorerLayoutPackages as discoverExplorerLayoutPackages,
  explorerLayoutSystemConfig,
  type LoadedExplorerLayoutDefinition,
  type LoadedExplorerLayoutPackage,
} from './config/explorerLayouts';
import {
  discoverManagedExplorerViews,
  explorerViewSystemConfig,
  type LoadedExplorerViewDefinition,
} from './config/explorerViews';
import {
  discoverManagedExplorerWidgets,
  explorerWidgetSystemConfig,
  type LoadedExplorerWidgetDefinition,
} from './config/explorerWidgets';
import {
  createEmptyGlobalThemeBundleCatalogs,
  loadThemePackages as discoverThemePackages,
  resolveLoadedThemePackages,
  resolveThemeBundleManifests,
  themeSystemConfig,
  type OverlayThemeBundleManifest,
  type GlobalThemeBundleCatalogs,
  type LoadedOverlayThemePackage,
} from './config/themePackages';
import { dispatchTerminalCommand } from './config/pluginContributions';
import {
  describeGlobalSearchPaletteStatus,
  globalSearchPaletteConfig,
} from './config/globalSearch';
import {
  formatHotkeyLabel,
  isEventTargetInsideLocalAppZoomHotkeyScope,
  matchesKeybinding,
  matchesWheelHotkey,
  shouldArmNonPassiveWheelHotkeyListener,
} from './config/hotkeys';
import { createMobileShareThemeSnapshot } from './config/mobileTheme';
import {
  getOverlayColorAlpha,
  withOverlayColorAlpha,
} from './config/colorUtils';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  getLayoutProfilesForShellFamily,
  getNextLayoutProfileIdInShellFamily,
  getPanelsBySide,
  getPinnedPanelIds,
  getTabbedOpenPanelIds,
  getWorkbenchShellFamilyForLayoutProfile,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LayoutPinnedPanel,
} from './config/layoutProfiles';
import {
  areIdeWorkbenchLayoutStatesEqual,
  type DockStackPlacement,
  clearExternalizedDockSurface,
  collectExternalizedSurfaceIds,
  collectSurfaceIdsFromDockNode,
  collectSurfaceIdsFromFloatingNodes,
  externalizeDockSurface,
  focusDockSurface,
  getExternalizedSurfaceWindowId,
  hideDockSurface,
  isDockSurfaceExternalized,
  normalizeIdeWorkbenchLayoutState,
  reorderDockSurfaceTabs,
  restoreExternalizedDockSurface,
  resolvePrimaryIdeWorkbenchSurfaceId,
  type IdeWorkbenchLayoutState,
} from './config/ideWorkbenchLayout';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  type OverlayAnimationDirection,
  type OverlayAnimationPhase,
} from './config/overlayAnimations';
import {
  computeDockPresentationWindowLayout,
  clampOverlayVisualControlValue,
  type OverlayWindowBounds,
  overlayWindowGeometry,
  overlayVisualControls,
  panelWindowGeometry,
} from './config/overlayWindow';
import { resolveConditionalBlurFilter } from './config/chromeEffects';
import { detectClientPlatform, joinPlatformPath } from './config/platform';
import type { LayoutDynamicsAuthoringSnapshot } from './config/layoutDynamics';
import { resolveActiveTopBarSelection } from './config/topBars';
import { resolveOverlayShellEffectsPolicy } from './config/workbenchPerformance';
import {
  settingsSectionCatalog,
  type SettingsSectionKey,
} from './config/settingsNavigation';
import {
  buildUsrProfileSettingsVariantOverrides,
  getUsrProfileSettingsVariant,
  usrProfileSettingsVariants,
} from './config/usrProfileSettingsVariants';
import {
  isExplorerVirtualPath,
} from './config/explorerVirtualLocations';
import { OverlayShellScene } from './components/OverlayShellScene';
import { LookdevOverlay } from './components/lookdev/LookdevOverlay';
import { shouldExplorerZoomScopeOwnWheelGesture } from './components/explorer/useExplorerZoomGestureRouter';
import { derivePanelOpenState, reorderPanelIds } from './components/panelUtils';
import { WorkbenchNavigationSurface } from './components/WorkbenchNavigationSurface';
import { WorkbenchIdeShell } from './components/WorkbenchIdeShell';
import { WorkbenchTopBar } from './components/WorkbenchTopBar';
import { DevPerformanceHud } from './components/DevPerformanceHud';
import { useGlobalShortcut } from './input/GlobalShortcuts';
import {
  buildThemeVisualStyle,
  computeOverlayWindowConstraints,
  computePanelWindowConstraints,
  computePanelWindowLayout,
  ensureDir,
  parseExternalArgs,
  type PanelWindowLayout,
} from './runtime/overlayRuntimeUtils';
import { bindDeferredUnlisten } from './runtime/deferredUnlisten';
import {
  FILESYSTEM_AQUARIUM_PANEL_ID,
  requestFilesystemAquariumOpen,
} from './runtime/filesystemAquariumBridge';
import {
  PLUGIN_PANEL_OPEN_REQUEST_EVENT,
  type PluginPanelOpenRequest,
} from './runtime/pluginPanelRequests';
import { publishSyncedOverlayAppearanceSnapshot } from './runtime/appearanceSync';
import { openFileOperationsWindow } from './runtime/fileOperationsWindow';
import {
  LOOKDEV_APPLY_PRESET_EVENT,
  LOOKDEV_OPEN_OVERLAY_EVENT,
  LOOKDEV_REFRESH_PRESETS_EVENT,
  LOOKDEV_TOGGLE_OVERLAY_EVENT,
  type LookdevApplyPresetEventDetail,
} from './runtime/lookdevEvents';
import {
  LOOKDEV_SECONDARY_WINDOW_ID,
  createLookdevSecondaryWindowOpenRequest,
  isLookdevSecondaryWindowDescriptor,
  parseLookdevSecondaryWindowPayload,
} from './runtime/lookdevWindow';
import {
  listenToExplorerPickerRequests,
  openExplorerPicker,
  publishExplorerPickerResult,
  type ExplorerPickerRequest,
} from './runtime/explorerPicker';
import {
  closeSecondaryWindow,
  createSecondaryWindowOpenRequest,
  createWorkbenchSurfaceSecondaryWindowId,
  dockBackSecondaryWindow,
  focusSecondaryWindow,
  listenToSecondaryWindowClosed,
  listenToSecondaryWindowDescriptorUpdates,
  listenToSecondaryWindowDockBack,
  listSecondaryWindowDescriptors,
  openSecondaryWindow,
  parseSecondaryWindowPayload,
  type SecondaryWindowDescriptor,
} from './runtime/secondaryWindows';
import {
  listExplorerDir,
  openExplorerPath,
  queueExplorerTerminalDirectorySync,
  writeExplorerFile,
} from './runtime/explorerBackend';
import type { ExplorerTaskSnapshot } from './runtime/explorerBackend';
import { installFrontendTelemetryObservers } from './runtime/telemetry';
import { buildTelemetryConfigFromSettings, configureTelemetry } from './runtime/telemetryBackend';
import { commands, unwrapTauriResult } from './runtime/tauriClient';
import { executeVsCodeCommand } from './runtime/vscodeBridgeBackend';
import {
  loadKainUiGraph,
  type KainUiGraph,
} from './runtime/kainUiGraph';
import {
  loadKainManifest,
  type KainAppManifest,
} from './runtime/kainManifest';
import {
  loadKainUiScaffold,
  type KainUiScaffold,
} from './runtime/kainUiScaffold';
import {
  loadKainLatticeCatalog,
  type KainLatticeCatalog,
} from './runtime/kainLatticeCatalog';
import {
  loadKainFfiCatalog,
  type KainFfiCatalog,
} from './runtime/kainFfiCatalog';
import { sendNativeNotification } from './runtime/nativeNotifications';
import {
  applyLookdevScopedOverridesToSettings,
  captureLookdevScopedOverridesFromSettings,
} from './runtime/lookdevRuntime';
import { configureSoundEffectsRuntime, playSoundEffect } from './runtime/soundEffects';
import { useFolderPluginRuntime } from './runtime/useFolderPluginRuntime';
import {
  MAIN_WINDOW_HOST_LABEL,
  DOCK_WINDOW_HOST_LABEL,
  SHOW_WINDOW_MODE_REQUEST_EVENT,
  TOGGLE_OVERLAY_REQUEST_EVENT,
  emitWindowEventToHost,
  getCurrentWindowHostRole,
  hasSeparateWaylandDockHost,
  isWindowHostResponsibleForMode,
  resolvePresentationHostLabel,
  shouldForceMainWindowStartupMode,
  shouldRegisterGlobalShortcutForHost,
  type WindowHostRole,
} from './runtime/windowHost';
import {
  clearCompletedExplorerTasks,
  retryFailedExplorerTasks,
  useExplorerTaskProgressFeed,
  useExplorerTaskSnapshots,
} from './store/explorerTaskStore';
import { useCommandPaletteStore } from './store/commandPaletteStore';
import { useGlobalSearchStore } from './store/globalSearchStore';
import {
  startMobileShareSession,
  stopMobileShareSession,
  useMobileShareStore,
} from './store/mobileShareStore';
import {
  setActiveMobileShareThemeSnapshot,
  syncMobileShareThemeSnapshot,
} from './runtime/mobileShareThemeRuntime';
import { createPythonRuntimeConfig } from './config/python';
import {
  mergeSettingsWithDefaults,
  useSettingsStore,
  resolveSystemPresentationState,
  type LayoutPanelState,
  type OverlayWindowAnchor,
  type TerminalWindowMode,
} from './store/settingsStore';
import {
  createUsrProfile,
  deleteUsrProfile,
  duplicateUsrProfile,
  getUsrProfileSettingSliceKeys,
  getUsrProfileSharedSettingSliceKeys,
  getUsrProfileRuntimeRevision,
  getUsrProfileRuntimeSnapshot,
  installUsrProfileSettingsPersistence,
  renameUsrProfile,
  subscribeToUsrProfileRuntime,
  switchUsrProfile,
} from './runtime/usrProfiles';
import { useExplorerStore } from './store/explorerStore';
import { useLookdevStore } from './store/lookdevStore';
import { useAccelerationRuntimeFeed } from './store/accelerationRuntimeStore';
import { useGpuRuntimeFeed } from './store/gpuRuntimeStore';
import { useTerminalStore } from './store/terminalStore';
import type { GlobalSearchResultValue } from './runtime/globalSearchBackend';

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

const APP_THEME_BUNDLE_OVERRIDE_ID = 'settings:active-theme-bundle-overrides';
const DOCK_THEME_BUNDLE_OVERRIDE_ID = 'settings:active-dock-theme-bundle-overrides';
const ANNOUNCED_EXPLORER_TASK_KINDS = new Set<ExplorerTaskSnapshot['kind']>([
  'copy',
  'move',
  'delete',
  'trash',
  'extractArchive',
  'audioTransform',
  'audioBatchProcess',
]);

function shouldAnnounceExplorerTask(task: ExplorerTaskSnapshot): boolean {
  return ANNOUNCED_EXPLORER_TASK_KINDS.has(task.kind);
}

function getExplorerTaskKindLabel(task: ExplorerTaskSnapshot): string {
  switch (task.kind) {
    case 'copy':
      return 'Copy';
    case 'move':
      return 'Move';
    case 'delete':
      return 'Delete';
    case 'trash':
      return 'Trash';
    case 'extractArchive':
      return 'Archive Extract';
    case 'audioTransform':
      return 'Audio Transform';
    case 'audioBatchProcess':
      return 'Audio Batch';
    default:
      return task.title || 'Explorer Task';
  }
}

function buildExplorerTaskNotificationPayload(task: ExplorerTaskSnapshot): { title: string; body: string } {
  const kindLabel = getExplorerTaskKindLabel(task);
  if (task.status === 'succeeded') {
    return {
      title: `${kindLabel} Complete`,
      body: task.detail?.trim() || task.title || 'The explorer task finished successfully.',
    };
  }

  if (task.status === 'cancelled') {
    return {
      title: `${kindLabel} Cancelled`,
      body: task.detail?.trim() || task.title || 'The explorer task was cancelled.',
    };
  }

  return {
    title: `${kindLabel} Failed`,
    body: task.errorMessage?.trim() || task.detail?.trim() || task.title || 'The explorer task did not finish successfully.',
  };
}

function hasPinnedThemeBundleLaneOverrides(overrides: {
  activeAppearancePackId?: string | null;
  activeThemeRecipeId?: string | null;
  activeThemeEngineId?: string | null;
  activeShellRendererId?: string | null;
}): boolean {
  return Boolean(
    overrides.activeAppearancePackId
    || overrides.activeThemeRecipeId
    || overrides.activeThemeEngineId
    || overrides.activeShellRendererId,
  );
}

function createPinnedThemeBundleOverrideManifest(args: {
  id: string;
  name: string;
  extendsThemeId: string;
  activeAppearancePackId?: string | null;
  activeThemeRecipeId?: string | null;
  activeThemeEngineId?: string | null;
  activeShellRendererId?: string | null;
}): OverlayThemeBundleManifest {
  return {
    version: 1,
    id: args.id,
    name: args.name,
    extends: args.extendsThemeId,
    appearancePackId: args.activeAppearancePackId ?? undefined,
    themeRecipeId: args.activeThemeRecipeId ?? undefined,
    themeEngineId: args.activeThemeEngineId ?? undefined,
    rendererId: args.activeShellRendererId ?? undefined,
  };
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampUnit(value: number): number {
  return clampValue(value, 0, 1);
}

function getParentDirectoryPath(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const parentPath = trimmed.replace(/[/\\][^/\\]+$/, '');
  if (parentPath === trimmed) {
    return path;
  }
  if (/^[A-Za-z]:$/.test(parentPath)) {
    return `${parentPath}\\`;
  }
  return parentPath || '/';
}

function sanitizeImportedWallpaperFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  const rawBase = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;
  const rawExtension = dotIndex >= 0 ? fileName.slice(dotIndex + 1) : '';
  const safeBase = rawBase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'wallpaper';
  const safeExtension = rawExtension
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase;
}

function isThemeAssetDuplicatedInEffects(backgroundUrl: string | undefined, backgroundImage: string | undefined): boolean {
  if (!backgroundUrl || !backgroundImage) {
    return false;
  }

  const trimmedBackgroundImage = backgroundImage.trim();
  return trimmedBackgroundImage === `url("${backgroundUrl}")`
    || trimmedBackgroundImage === `url('${backgroundUrl}')`
    || trimmedBackgroundImage === `url(${backgroundUrl})`;
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

function resolveShellBackgroundColor(
  translucentColor: string,
  solidColor: string,
  blurStrength: number,
): string {
  const normalizedStrength = overlayVisualControls.blurStrength.max > 0
    ? clampOverlayVisualControlValue('blurStrength', blurStrength) / overlayVisualControls.blurStrength.max
    : 0;
  const solidAlpha = getOverlayColorAlpha(solidColor, 0.96);
  const translucentAlpha = getOverlayColorAlpha(translucentColor, Math.min(0.82, solidAlpha));
  const minimumGlassAlpha = Math.max(0.16, translucentAlpha * 0.45);
  const targetAlpha = solidAlpha - ((solidAlpha - minimumGlassAlpha) * normalizedStrength);
  return withOverlayColorAlpha(translucentColor, targetAlpha);
}

function resolveWindowedModeApplyGeometry(args: {
  layout: PanelWindowLayout;
  shouldRestoreMaximizedWindow: boolean;
  shouldSeedRestoreBoundsBeforeMaximize: boolean;
}): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (
    !args.shouldRestoreMaximizedWindow
    || args.shouldSeedRestoreBoundsBeforeMaximize
  ) {
    return {
      x: args.layout.x,
      y: args.layout.y,
      width: args.layout.width,
      height: args.layout.height,
    };
  }

  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
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
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        contain: 'layout paint style',
        isolation: 'isolate',
      }}
    >
      {definition.render()}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

interface AppProps {
  secondaryWindowDescriptor?: SecondaryWindowDescriptor | null;
}

function App({ secondaryWindowDescriptor = null }: AppProps = {}) {
  const dedicatedSecondaryWindowPayload = parseSecondaryWindowPayload<{ panelId?: string }>(
    secondaryWindowDescriptor?.payloadJson,
  );
  const dedicatedLookdevWindowPayload = parseLookdevSecondaryWindowPayload(
    secondaryWindowDescriptor?.payloadJson,
  );
  const dedicatedSecondarySurfaceId = secondaryWindowDescriptor?.dockTarget?.surfaceId
    ?? dedicatedSecondaryWindowPayload?.panelId
    ?? null;
  const isDedicatedSecondaryWindowHost = secondaryWindowDescriptor != null;
  const isDedicatedLookdevSecondaryWindow = isLookdevSecondaryWindowDescriptor(
    secondaryWindowDescriptor,
  );
  const isDedicatedSecondaryWorkbenchSurfaceWindow = Boolean(
    isDedicatedSecondaryWindowHost
    && dedicatedSecondarySurfaceId
    && (
      secondaryWindowDescriptor.surfaceKind === 'panel'
      || secondaryWindowDescriptor.surfaceKind === 'plugin-panel'
    ),
  );
  const [overlayPhase, setOverlayPhase] = useState<OverlayAnimationPhase>(
    isDedicatedSecondaryWindowHost ? 'open' : 'closed',
  );
  const [overlayAnimationDirection, setOverlayAnimationDirection] = useState<OverlayAnimationDirection>('enter');
  const [activeAnimation, setActiveAnimation] = useState<LoadedOverlayAnimation | null>(null);
  const [authoredAnimations, setAuthoredAnimations] = useState<LoadedOverlayAnimation[]>([]);
  const [authoredAnimationsError, setAuthoredAnimationsError] = useState<string | null>(null);
  const [authoredAnimationsLoading, setAuthoredAnimationsLoading] = useState(true);
  const [authoredShaders, setAuthoredShaders] = useState<LoadedOverlayShader[]>([]);
  const [authoredShadersError, setAuthoredShadersError] = useState<string | null>(null);
  const [authoredShadersLoading, setAuthoredShadersLoading] = useState(true);
  const [authoredWallpapers, setAuthoredWallpapers] = useState<LoadedOverlayWallpaper[]>([]);
  const [authoredWallpapersError, setAuthoredWallpapersError] = useState<string | null>(null);
  const [authoredWallpapersLoading, setAuthoredWallpapersLoading] = useState(true);
  const [themeContributedAnimations, setThemeContributedAnimations] = useState<LoadedOverlayAnimation[]>([]);
  const [themeContributedShaders, setThemeContributedShaders] = useState<LoadedOverlayShader[]>([]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLookdevSecondaryWindowOpen, setIsLookdevSecondaryWindowOpen] = useState(false);
  const [latestOverlayFrameStats, setLatestOverlayFrameStats] = useState<OverlayFrameTelemetryStats | null>(null);
  const [themeRendererViewport, setThemeRendererViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }));
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const currentWindowHostRole = useMemo<WindowHostRole>(() => getCurrentWindowHostRole(), []);
  const [linuxDisplayServer, setLinuxDisplayServer] = useState<'unknown' | 'wayland' | 'x11'>('unknown');
  const [linuxDisplayServerResolved, setLinuxDisplayServerResolved] = useState(runtimePlatform !== 'linux');
  const [waylandDockHostEnabled, setWaylandDockHostEnabled] = useState(false);
  const [waylandDockHostStatusResolved, setWaylandDockHostStatusResolved] = useState(runtimePlatform !== 'linux');
  const builtInAnimations = useMemo(() => createBuiltInOverlayAnimations(), []);
  const builtInShaders = useMemo(() => createBuiltInOverlayShaders(), []);
  const overlayPhaseRef = useRef<OverlayAnimationPhase>(
    isDedicatedSecondaryWindowHost ? 'open' : 'closed',
  );
  overlayPhaseRef.current = overlayPhase;
  const overlayVisibleRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationCommitTimerRef = useRef<number | null>(null);
  const lastTerminalFocusAtRef = useRef(0);
  const isProgrammaticResizeRef = useRef(false);
  const runtimeOverlayBoundsRef = useRef<OverlayWindowBounds | null>(null);
  const dockResizeReanchorTimerRef = useRef<number | null>(null);
  const dockResizeTelemetryHideTimerRef = useRef<number | null>(null);
  const lastResolvedMonitorPointRef = useRef<{ x: number; y: number } | null>(null);
  const interactionLockUntilRef = useRef(0);
  const windowModeRef = useRef<TerminalWindowMode>('overlay');
  const windowPresentationApplyGenerationRef = useRef(0);
  const pendingExternalizedWindowIdsRef = useRef(new Set<string>());
  const lastWindowedMaximizedRef = useRef(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [dockResizeTelemetry, setDockResizeTelemetry] = useState<{
    grid: DockTerminalGrid;
    edgeSize: number;
    edgeWidth: number;
    updatedAt: number;
  } | null>(null);
  const [desktopPresentationSynced, setDesktopPresentationSynced] = useState(false);
  const animationSignatureRef = useRef('');
  const shaderSignatureRef = useRef('');
  const wallpaperSignatureRef = useRef('');
  const topBarPackagesSignatureRef = useRef('');
  const dockPresentationPackagesSignatureRef = useRef('');
  const explorerLayoutPackagesSignatureRef = useRef('');
  const explorerViewsSignatureRef = useRef('');
  const explorerWidgetsSignatureRef = useRef('');
  const themePackagesSignatureRef = useRef('');
  const iconThemePackagesSignatureRef = useRef('');
  const soundPacksSignatureRef = useRef('');
  const homePacksSignatureRef = useRef('');
  const menuPacksSignatureRef = useRef('');
  const actionPacksSignatureRef = useRef('');
  const lookdevPresetsSignatureRef = useRef('');
  const authoredAnimationsRefreshInFlightRef = useRef(false);
  const authoredAnimationsRefreshQueuedRef = useRef(false);
  const authoredShadersRefreshInFlightRef = useRef(false);
  const authoredShadersRefreshQueuedRef = useRef(false);
  const authoredWallpapersRefreshInFlightRef = useRef(false);
  const authoredWallpapersRefreshQueuedRef = useRef(false);
  const topBarPackagesRefreshInFlightRef = useRef(false);
  const topBarPackagesRefreshQueuedRef = useRef(false);
  const dockPresentationPackagesRefreshInFlightRef = useRef(false);
  const dockPresentationPackagesRefreshQueuedRef = useRef(false);
  const explorerLayoutPackagesRefreshInFlightRef = useRef(false);
  const explorerLayoutPackagesRefreshQueuedRef = useRef(false);
  const explorerViewsRefreshInFlightRef = useRef(false);
  const explorerViewsRefreshQueuedRef = useRef(false);
  const explorerWidgetsRefreshInFlightRef = useRef(false);
  const explorerWidgetsRefreshQueuedRef = useRef(false);
  const themePackagesRefreshInFlightRef = useRef(false);
  const themePackagesRefreshQueuedRef = useRef(false);
  const iconThemePackagesRefreshInFlightRef = useRef(false);
  const iconThemePackagesRefreshQueuedRef = useRef(false);
  const soundPacksRefreshInFlightRef = useRef(false);
  const soundPacksRefreshQueuedRef = useRef(false);
  const homePacksRefreshInFlightRef = useRef(false);
  const homePacksRefreshQueuedRef = useRef(false);
  const menuPacksRefreshInFlightRef = useRef(false);
  const menuPacksRefreshQueuedRef = useRef(false);
  const actionPacksRefreshInFlightRef = useRef(false);
  const actionPacksRefreshQueuedRef = useRef(false);
  const lookdevPresetsRefreshInFlightRef = useRef(false);
  const lookdevPresetsRefreshQueuedRef = useRef(false);
  const lookdevSecondaryWindowSessionInitializedRef = useRef(false);
  const allowLookdevWindowCloseRef = useRef(false);
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
  const activatePanelRef = useRef<(panelId: string) => void>(() => undefined);
  const openSettingsSectionRef = useRef<(section: SettingsSectionKey) => void>(() => undefined);
  const zenFocusRestorePanelIdRef = useRef<string | null>(null);
  // Tracks whether the overlay has been dragged away from its anchor position
  const isFreefloatingRef = useRef(false);
  const [layoutManifest, setLayoutManifest] = useState(BUILT_IN_LAYOUT_MANIFEST);
  const [layoutConfigSource, setLayoutConfigSource] = useState<string | null>(null);
  const [topBarPackages, setTopBarPackages] = useState<LoadedOverlayTopBarPackage[]>([]);
  const [topBarPackagesLoading, setTopBarPackagesLoading] = useState(true);
  const [topBarPackagesError, setTopBarPackagesError] = useState<string | null>(null);
  const [topBarPackagesWarnings, setTopBarPackagesWarnings] = useState<string[]>([]);
  const [dockPresentationPackages, setDockPresentationPackages] = useState<LoadedDockPresentationPackage[]>([]);
  const [dockPresentationPackagesLoading, setDockPresentationPackagesLoading] = useState(true);
  const [dockPresentationPackagesError, setDockPresentationPackagesError] = useState<string | null>(null);
  const [dockPresentationPackagesWarnings, setDockPresentationPackagesWarnings] = useState<string[]>([]);
  const [explorerLayoutPackages, setExplorerLayoutPackages] = useState<LoadedExplorerLayoutPackage[]>([]);
  const [explorerLayoutPackagesLoading, setExplorerLayoutPackagesLoading] = useState(true);
  const [explorerLayoutPackagesError, setExplorerLayoutPackagesError] = useState<string | null>(null);
  const [explorerLayoutPackagesWarnings, setExplorerLayoutPackagesWarnings] = useState<string[]>([]);
  const [authoredExplorerViews, setAuthoredExplorerViews] = useState<LoadedExplorerViewDefinition[]>([]);
  const [explorerViewsLoading, setExplorerViewsLoading] = useState(true);
  const [explorerViewsError, setExplorerViewsError] = useState<string | null>(null);
  const [explorerViewsWarnings, setExplorerViewsWarnings] = useState<string[]>([]);
  const [authoredExplorerWidgets, setAuthoredExplorerWidgets] = useState<LoadedExplorerWidgetDefinition[]>([]);
  const [explorerWidgetsLoading, setExplorerWidgetsLoading] = useState(true);
  const [explorerWidgetsError, setExplorerWidgetsError] = useState<string | null>(null);
  const [explorerWidgetsWarnings, setExplorerWidgetsWarnings] = useState<string[]>([]);
  const [themePackages, setThemePackages] = useState<LoadedOverlayThemePackage[]>([]);
  const [themePackagesLoading, setThemePackagesLoading] = useState(true);
  const [themePackagesError, setThemePackagesError] = useState<string | null>(null);
  const [themePackagesWarnings, setThemePackagesWarnings] = useState<string[]>([]);
  const [themeBundleDependencyCatalogs, setThemeBundleDependencyCatalogs] = useState<GlobalThemeBundleCatalogs>(
    () => createEmptyGlobalThemeBundleCatalogs(),
  );
  const [iconThemePackages, setIconThemePackages] = useState<LoadedIconThemePackage[]>([]);
  const [iconThemePackagesLoading, setIconThemePackagesLoading] = useState(true);
  const [iconThemePackagesError, setIconThemePackagesError] = useState<string | null>(null);
  const [iconThemePackagesWarnings, setIconThemePackagesWarnings] = useState<string[]>([]);
  const [soundPacks, setSoundPacks] = useState<LoadedOverlaySoundPack[]>([]);
  const [soundPacksLoading, setSoundPacksLoading] = useState(true);
  const [soundPacksError, setSoundPacksError] = useState<string | null>(null);
  const [soundPacksWarnings, setSoundPacksWarnings] = useState<string[]>([]);
  const [authoredHomePacks, setAuthoredHomePacks] = useState<LoadedExplorerHomePack[]>([]);
  const [homePacksLoading, setHomePacksLoading] = useState(true);
  const [homePacksError, setHomePacksError] = useState<string | null>(null);
  const [homePacksWarnings, setHomePacksWarnings] = useState<string[]>([]);
  const [menuPacks, setMenuPacks] = useState<LoadedExplorerMenuPack[]>([]);
  const [menuPacksLoading, setMenuPacksLoading] = useState(true);
  const [menuPacksError, setMenuPacksError] = useState<string | null>(null);
  const [menuPacksWarnings, setMenuPacksWarnings] = useState<string[]>([]);
  const [actionPacks, setActionPacks] = useState<LoadedActionPack[]>([]);
  const [actionPacksLoading, setActionPacksLoading] = useState(true);
  const [actionPacksError, setActionPacksError] = useState<string | null>(null);
  const [actionPacksWarnings, setActionPacksWarnings] = useState<string[]>([]);
  const [usrProfileRuntimeSnapshot, setUsrProfileRuntimeSnapshot] =
    useState(getUsrProfileRuntimeSnapshot);
  const [usrProfileRuntimeRevision, setUsrProfileRuntimeRevision] = useState(
    getUsrProfileRuntimeRevision,
  );
  const [kainUiGraph, setKainUiGraph] = useState<KainUiGraph | null>(null);
  const [kainUiGraphError, setKainUiGraphError] = useState<string | null>(null);
  const [kainManifest, setKainManifest] = useState<KainAppManifest | null>(null);
  const [kainManifestError, setKainManifestError] = useState<string | null>(null);
  const [kainUiScaffold, setKainUiScaffold] = useState<KainUiScaffold | null>(null);
  const [kainUiScaffoldError, setKainUiScaffoldError] = useState<string | null>(null);
  const [kainLatticeCatalog, setKainLatticeCatalog] = useState<KainLatticeCatalog | null>(null);
  const [kainLatticeCatalogError, setKainLatticeCatalogError] = useState<string | null>(null);
  const [kainFfiCatalog, setKainFfiCatalog] = useState<KainFfiCatalog | null>(null);
  const [kainFfiCatalogError, setKainFfiCatalogError] = useState<string | null>(null);
  const [themeRendererRuntimeError, setThemeRendererRuntimeError] = useState<string | null>(null);
  const [activeExplorerPickerRequest, setActiveExplorerPickerRequest] =
    useState<ExplorerPickerRequest | null>(null);
  const [pendingRepositoryImports, setPendingRepositoryImports] = useState<string[]>([]);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [topBarCustomizeActive, setTopBarCustomizeActive] = useState(false);
  const deferredCommandPaletteQuery = useDeferredValue(commandPaletteQuery);
  const explorerTasks = useExplorerTaskSnapshots();
  useExplorerTaskProgressFeed();
  const explorerTaskTransitionReadyRef = useRef(false);
  const previousExplorerTasksByIdRef = useRef<Record<string, ExplorerTaskSnapshot>>({});
  const hasAppliedUsrProfileRefreshRef = useRef(false);
  const usrProfileContentRefreshTimerRef = useRef<number | null>(null);
  const usrProfileContentRefreshCallbacksRef = useRef<{
    refreshTopBarPackages: (force?: boolean) => Promise<void>;
    refreshDockPresentationPackages: (force?: boolean) => Promise<void>;
    refreshExplorerLayoutPackages: (force?: boolean) => Promise<void>;
    refreshExplorerWidgets: (force?: boolean) => Promise<void>;
    refreshHomePacks: (force?: boolean) => Promise<void>;
    refreshLookdevPresets: (force?: boolean) => Promise<void>;
    refreshMenuPacks: (force?: boolean) => Promise<void>;
    refreshFolderPlugins: (force?: boolean) => Promise<void>;
  } | null>(null);

  useEffect(() => {
    void installUsrProfileSettingsPersistence();
    return subscribeToUsrProfileRuntime((snapshot) => {
      setUsrProfileRuntimeSnapshot(snapshot);
      setUsrProfileRuntimeRevision(getUsrProfileRuntimeRevision());
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncViewport = () => {
      setThemeRendererViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const {
    settings,
    presentationSettings,
    dockSettings,
    appearance,
    keybindings,
    layoutSettings,
    explorerSettings,
    pluginSettings,
    mobileSettings,
    pythonSettings,
    audioSettings,
    systemSettings,
    setActiveSection,
    updateAppearance,
    updateExplorer,
    updatePresentation,
    updateDock,
    updateLayout,
    updateMobile,
    updateSystem,
  } = useSettingsStore(useShallow(state => ({
    settings: state.settings.terminal,
    presentationSettings: state.settings.presentation,
    dockSettings: state.settings.dock,
    appearance: state.settings.appearance,
    keybindings: state.settings.keybindings,
    layoutSettings: state.settings.layout,
    explorerSettings: state.settings.explorer,
    pluginSettings: state.settings.plugins,
    mobileSettings: state.settings.mobile,
    pythonSettings: state.settings.python,
    audioSettings: state.settings.audio,
    systemSettings: state.settings.system,
    setActiveSection: state.setActiveSection,
    updateAppearance: state.updateAppearance,
    updateExplorer: state.updateExplorer,
    updatePresentation: state.updatePresentation,
    updateDock: state.updateDock,
    updateLayout: state.updateLayout,
    updateMobile: state.updateMobile,
    updateSystem: state.updateSystem,
  })));
  useGpuRuntimeFeed(systemSettings.gpuTierMode);
  useAccelerationRuntimeFeed({
    config: createPythonRuntimeConfig(pythonSettings),
    routingMode: systemSettings.accelerationRoutingMode,
    startSidecarIfNeeded: false,
  });
  const {
    mobileSharePhase,
    mobileShareSession,
    mobileShareNotice,
    mobileShareError,
  } = useMobileShareStore(useShallow(state => ({
    mobileSharePhase: state.phase,
    mobileShareSession: state.session,
    mobileShareNotice: state.lastNotice,
    mobileShareError: state.lastError,
  })));
  const settingsPersistApi = (useSettingsStore as typeof useSettingsStore & {
    persist?: {
      hasHydrated?: () => boolean;
      onFinishHydration?: (callback: () => void) => () => void;
    };
  }).persist;
  const [settingsHydrated, setSettingsHydrated] = useState(
    () => settingsPersistApi?.hasHydrated?.() ?? true,
  );
  const mobileShareBootEvaluationRef = useRef(false);
  const usrProfileRuntimeActiveProfileId =
    usrProfileRuntimeSnapshot?.activeProfileId ?? "default";
  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    let cancelled = false;
    void loadKainUiGraph({
      profileId: usrProfileRuntimeActiveProfileId,
      revision: usrProfileRuntimeRevision,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setKainUiGraph(result.graph);
      setKainUiGraphError(result.error);
    });
    void loadKainManifest({
      profileId: usrProfileRuntimeActiveProfileId,
      revision: usrProfileRuntimeRevision,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setKainManifest(result.manifest);
      setKainManifestError(result.error);
    });
    void loadKainUiScaffold({
      profileId: usrProfileRuntimeActiveProfileId,
      revision: usrProfileRuntimeRevision,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setKainUiScaffold(result.scaffold);
      setKainUiScaffoldError(result.error);
    });
    void loadKainLatticeCatalog({
      profileId: usrProfileRuntimeActiveProfileId,
      revision: usrProfileRuntimeRevision,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setKainLatticeCatalog(result.catalog);
      setKainLatticeCatalogError(result.error);
    });
    void loadKainFfiCatalog({
      profileId: usrProfileRuntimeActiveProfileId,
      revision: usrProfileRuntimeRevision,
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setKainFfiCatalog(result.catalog);
      setKainFfiCatalogError(result.error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    settingsHydrated,
    usrProfileRuntimeActiveProfileId,
    usrProfileRuntimeRevision,
  ]);
  const {
    lookdevPresets,
    lookdevSelectedPresetId,
    lookdevActiveAppliedPresetId,
    lookdevDraftSession,
    lookdevIsOpen,
  } = useLookdevStore(useShallow((state) => ({
    lookdevPresets: state.presets,
    lookdevSelectedPresetId: state.selectedPresetId,
    lookdevActiveAppliedPresetId: state.activeAppliedPresetId,
    lookdevDraftSession: state.draftSession,
    lookdevIsOpen: state.isOpen,
  })));
  const isLookdevSurfaceOpen = lookdevIsOpen
    || isLookdevSecondaryWindowOpen
    || isDedicatedLookdevSecondaryWindow;

  useEffect(() => {
    if (settingsPersistApi?.hasHydrated?.()) {
      setSettingsHydrated(true);
      return;
    }

    return settingsPersistApi?.onFinishHydration?.(() => {
      setSettingsHydrated(true);
    });
  }, [settingsPersistApi]);
  const {
    initStore: initTerminalStore,
    addDirectoryBookmark,
  } = useTerminalStore(useShallow(state => ({
    initStore: state.initStore,
    addDirectoryBookmark: state.addDirectoryBookmark,
  })));
  const {
    explorerCurrentPath,
    explorerSessions,
    explorerRailNodes,
    requestOpenInExplorer,
  } = useExplorerStore(useShallow(state => ({
    explorerCurrentPath: state.session.currentPath,
    explorerSessions: state.sessions,
    explorerRailNodes: state.rail.nodes,
    requestOpenInExplorer: state.requestOpenInExplorer,
  })));
  const {
    lastQuickFilterId: commandPaletteLastQuickFilterId,
    pinnedActionIds: commandPalettePinnedActionIds,
    recentActionIds: commandPaletteRecentActionIds,
    pruneActionIds: pruneCommandPaletteActionIds,
    recordActionUsage: recordCommandPaletteActionUsage,
    setLastQuickFilterId: setCommandPaletteQuickFilterId,
    togglePinnedActionId: toggleCommandPalettePinnedActionId,
  } = useCommandPaletteStore(useShallow(state => ({
    lastQuickFilterId: state.lastQuickFilterId,
    pinnedActionIds: state.pinnedActionIds,
    recentActionIds: state.recentActionIds,
    pruneActionIds: state.pruneActionIds,
    recordActionUsage: state.recordActionUsage,
    setLastQuickFilterId: state.setLastQuickFilterId,
    togglePinnedActionId: state.togglePinnedActionId,
  })));
  const {
    openPaletteSession: openGlobalSearchPaletteSession,
    closePaletteSession: closeGlobalSearchPaletteSession,
    startScan: startGlobalSearchScan,
    cancelScan: cancelGlobalSearchScan,
    setQuery: setGlobalSearchQuery,
    clearQuery: clearGlobalSearchQuery,
    results: globalSearchResults,
    status: globalSearchStatus,
    isSearching: isGlobalSearchSearching,
    lastError: globalSearchLastError,
  } = useGlobalSearchStore(useShallow(state => ({
    openPaletteSession: state.openPaletteSession,
    closePaletteSession: state.closePaletteSession,
    startScan: state.startScan,
    cancelScan: state.cancelScan,
    setQuery: state.setQuery,
    clearQuery: state.clearQuery,
    results: state.results,
    status: state.status,
    isSearching: state.isSearching,
    lastError: state.lastError,
  })));
  const {
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
    pluginExplorerActivityLanes,
    pluginExplorerViews,
    pluginExplorerWidgets,
    pluginPreviewLanes,
    pluginSettingsSlots,
    pluginWorkflows,
    folderPluginsError,
    folderPluginsLoading,
    openPluginsFolder,
    openPackagesFolder,
    refreshFolderPlugins,
    setPluginEnabled,
    createPluginApi,
  } = useFolderPluginRuntime(runtimePlatform, { liveReloadEnabled: systemSettings.developerMode });
  const liveReloadEnabled = systemSettings.developerMode;
  const builtInHomePacks = useMemo<LoadedExplorerHomePack[]>(() => (
    getBuiltInExplorerHomePacks().map((runtime) => ({
      id: runtime.id,
      name: runtime.name,
      version: 1,
      directoryPath: runtime.packRoot,
      manifestPath: runtime.filePath,
      sourceKind: 'built-in',
      sourceLabel: 'built-in',
      description: runtime.description,
      tags: ['built-in', 'home-pack'],
      warnings: runtime.error ? [runtime.error] : [],
      runtime,
    }))
  ), []);
  const combinedHomePacks = useMemo(() => {
    const packMap = new Map<string, LoadedExplorerHomePack>();
    for (const pack of builtInHomePacks) {
      packMap.set(pack.id, pack);
    }
    for (const pack of authoredHomePacks) {
      packMap.set(pack.id, pack);
    }
    for (const pack of resolveLoadedThemePackages(
      [...themePackages, ...pluginThemePackages],
      {
        ...themeBundleDependencyCatalogs,
        iconThemePackages,
        wallpapers: authoredWallpapers,
      },
    ).flatMap(themePackage => themePackage.localCatalogs?.homePacks ?? [])) {
      packMap.set(pack.id, pack);
    }
    return [...packMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [
    authoredHomePacks,
    authoredWallpapers,
    builtInHomePacks,
    iconThemePackages,
    pluginThemePackages,
    themeBundleDependencyCatalogs,
    themePackages,
  ]);
  const combinedThemePackages = useMemo(
    () => resolveLoadedThemePackages(
      [...themePackages, ...pluginThemePackages],
      {
        ...themeBundleDependencyCatalogs,
        iconThemePackages,
        wallpapers: authoredWallpapers,
      },
    ),
    [
      authoredWallpapers,
      iconThemePackages,
      pluginThemePackages,
      themeBundleDependencyCatalogs,
      themePackages,
    ],
  );
  const combinedMenuPacks = useMemo(() => {
    const packMap = new Map<string, LoadedExplorerMenuPack>();
    for (const pack of menuPacks) {
      packMap.set(pack.id, pack);
    }
    for (const themePackage of combinedThemePackages) {
      for (const pack of themePackage.localCatalogs?.menuPacks ?? []) {
        packMap.set(pack.id, pack);
      }
    }
    return [...packMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [combinedThemePackages, menuPacks]);
  const combinedExplorerLayouts = useMemo<LoadedExplorerLayoutDefinition[]>(() => {
    const themedLayouts = combinedThemePackages.flatMap(
      themePackage => themePackage.localCatalogs?.explorerLayouts ?? [],
    );
    return collectUniqueExplorerLayouts(
      collectExplorerLayoutsFromPackages(explorerLayoutPackages),
      themedLayouts,
    );
  }, [combinedThemePackages, explorerLayoutPackages]);
  const combinedActionPacks = useMemo(() => {
    const packMap = new Map<string, LoadedActionPack>();
    for (const pack of actionPacks ?? []) {
      packMap.set(pack.id, pack);
    }
    for (const pack of pluginActionPacks ?? []) {
      packMap.set(pack.id, pack);
    }
    return [...packMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [actionPacks, pluginActionPacks]);
  const combinedExplorerActions = useMemo(() => {
    const actionMap = new Map<string, LoadedExplorerAction>();
    for (const action of combinedActionPacks.flatMap(pack => pack.actions)) {
      actionMap.set(action.id, action);
    }
    for (const action of pluginActions ?? []) {
      actionMap.set(action.id, action);
    }
    return [...actionMap.values()].sort((left, right) => left.title.localeCompare(right.title));
  }, [combinedActionPacks, pluginActions]);
  const combinedSoundPacks = useMemo(() => {
    const packMap = new Map<string, LoadedOverlaySoundPack>();
    for (const pack of soundPacks) {
      packMap.set(pack.id, pack);
    }
    for (const themePackage of combinedThemePackages) {
      for (const pack of themePackage.localCatalogs?.soundPacks ?? []) {
        packMap.set(pack.id, pack);
      }
    }
    return [...packMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [combinedThemePackages, soundPacks]);
  const combinedTopBarPackageSources = useMemo(
    () => [...topBarPackages, ...combinedThemePackages],
    [combinedThemePackages, topBarPackages],
  );
  const combinedDockPresentationPackageSources = useMemo<DockPresentationPackageSourceLike[]>(
    () => [
      ...dockPresentationPackages,
      ...combinedThemePackages.filter(
        (packageSource): packageSource is LoadedOverlayThemePackage & DockPresentationPackageSourceLike =>
          Array.isArray((packageSource as DockPresentationPackageSourceLike).dockPresentations),
      ),
    ],
    [combinedThemePackages, dockPresentationPackages],
  );
  const selectedIconTheme = useMemo(() => {
    return resolveLoadedIconThemePackage(iconThemePackages, appearance.activeIconThemeId)?.iconTheme ?? null;
  }, [appearance.activeIconThemeId, iconThemePackages]);
  const hasPinnedThemeBundleOverrides = useMemo(() => hasPinnedThemeBundleLaneOverrides({
    activeAppearancePackId: appearance.activeAppearancePackId,
    activeThemeRecipeId: appearance.activeThemeRecipeId,
    activeThemeEngineId: appearance.activeThemeEngineId,
    activeShellRendererId: appearance.activeShellRendererId,
  }), [
    appearance.activeAppearancePackId,
    appearance.activeShellRendererId,
    appearance.activeThemeEngineId,
    appearance.activeThemeRecipeId,
  ]);
  const appThemeOverrideManifest = useMemo(() => {
    const baseThemeId = appearance.activeThemeId.trim();
    if (!hasPinnedThemeBundleOverrides || !baseThemeId) {
      return null;
    }

    return createPinnedThemeBundleOverrideManifest({
      id: APP_THEME_BUNDLE_OVERRIDE_ID,
      name: 'Pinned Theme Lane Overrides',
      extendsThemeId: baseThemeId,
      activeAppearancePackId: appearance.activeAppearancePackId,
      activeThemeRecipeId: appearance.activeThemeRecipeId,
      activeThemeEngineId: appearance.activeThemeEngineId,
      activeShellRendererId: appearance.activeShellRendererId,
    });
  }, [
    appearance.activeAppearancePackId,
    appearance.activeShellRendererId,
    appearance.activeThemeEngineId,
    appearance.activeThemeId,
    appearance.activeThemeRecipeId,
    hasPinnedThemeBundleOverrides,
  ]);
  const dockThemeOverrideManifest = useMemo(() => {
    const baseDockThemeId = appearance.activeDockThemeId?.trim();
    if (!hasPinnedThemeBundleOverrides || appearance.dockThemeMode !== 'override' || !baseDockThemeId) {
      return null;
    }

    return createPinnedThemeBundleOverrideManifest({
      id: DOCK_THEME_BUNDLE_OVERRIDE_ID,
      name: 'Pinned Dock Theme Lane Overrides',
      extendsThemeId: baseDockThemeId,
      activeAppearancePackId: appearance.activeAppearancePackId,
      activeThemeRecipeId: appearance.activeThemeRecipeId,
      activeThemeEngineId: appearance.activeThemeEngineId,
      activeShellRendererId: appearance.activeShellRendererId,
    });
  }, [
    appearance.activeAppearancePackId,
    appearance.activeDockThemeId,
    appearance.activeShellRendererId,
    appearance.activeThemeEngineId,
    appearance.activeThemeRecipeId,
    appearance.dockThemeMode,
    hasPinnedThemeBundleOverrides,
  ]);
  const effectiveCustomThemeBundles = useMemo(() => [
    ...appearance.customThemeBundles,
    ...(appThemeOverrideManifest ? [appThemeOverrideManifest] : []),
    ...(dockThemeOverrideManifest ? [dockThemeOverrideManifest] : []),
  ], [appearance.customThemeBundles, appThemeOverrideManifest, dockThemeOverrideManifest]);
  const kainUiTheme = kainUiGraph?.theme;
  const kainUiThemeForcesSelection = kainUiTheme?.selectionMode === "force";
  const effectiveActiveThemeId =
    appThemeOverrideManifest?.id ??
    (kainUiThemeForcesSelection ? kainUiTheme?.activeThemeId : undefined) ??
    appearance.activeThemeId;
  const effectiveActiveDockThemeId =
    dockThemeOverrideManifest?.id ??
    (kainUiThemeForcesSelection ? kainUiTheme?.activeDockThemeId : undefined) ??
    appearance.activeDockThemeId;
  const effectivePanelTransparency = kainUiTheme?.panelTransparency ?? appearance.panelTransparency;
  const resolvedCustomBundleThemes = useMemo(
    () => resolveThemeBundleManifests(
      effectiveCustomThemeBundles,
      {
        ...themeBundleDependencyCatalogs,
        appearancePacks: [
          ...themeBundleDependencyCatalogs.appearancePacks,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.appearancePacks ?? []),
        ],
        interactionMotionPacks: [
          ...themeBundleDependencyCatalogs.interactionMotionPacks,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.interactionMotionPacks ?? []),
        ],
        shellRenderers: [
          ...themeBundleDependencyCatalogs.shellRenderers,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.shellRenderers ?? []),
        ],
        themeRecipePacks: [
          ...themeBundleDependencyCatalogs.themeRecipePacks,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.themeRecipePacks ?? []),
        ],
        themeEnginePacks: [
          ...themeBundleDependencyCatalogs.themeEnginePacks,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.themeEnginePacks ?? []),
        ],
        iconThemePackages: [
          ...iconThemePackages,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.iconThemePackages ?? []),
        ],
        wallpapers: [
          ...authoredWallpapers,
          ...combinedThemePackages.flatMap(pkg => pkg.localCatalogs?.wallpapers ?? []),
        ],
      },
    ),
    [
      authoredWallpapers,
      combinedThemePackages,
      effectiveCustomThemeBundles,
      iconThemePackages,
      themeBundleDependencyCatalogs,
    ],
  );
  const resolvedPackageThemes = useMemo(
    () => [...combinedThemePackages.map(pkg => pkg.theme), ...resolvedCustomBundleThemes],
    [combinedThemePackages, resolvedCustomBundleThemes],
  );
  const windowMode: TerminalWindowMode = presentationSettings.windowMode === 'dock' ? 'overlay' : 'windowed';
  const zenFocusMode = layoutSettings.zenFocusMode === true;
  windowModeRef.current = windowMode;
  const resolvedAppearance = useMemo(
    () => resolveOverlayAppearance({
      activeThemeId: effectiveActiveThemeId,
      activeDockThemeId: effectiveActiveDockThemeId,
      dockThemeMode: appearance.dockThemeMode,
      customThemes: appearance.customThemes,
      packageThemes: resolvedPackageThemes,
      selectedIconTheme,
      uiFontFamily: appearance.uiFontFamily,
      monoFontFamily: settings.fontFamily,
      panelTransparency: effectivePanelTransparency,
      windowMode,
    }),
    [
      appearance.customThemes,
      appearance.dockThemeMode,
      effectivePanelTransparency,
      appearance.uiFontFamily,
      effectiveActiveDockThemeId,
      effectiveActiveThemeId,
      selectedIconTheme,
      resolvedPackageThemes,
      settings.fontFamily,
      windowMode,
    ],
  );
  const theme = resolvedAppearance.theme;
  const accent = theme.palette.accent;
  useEffect(() => {
    if (isDedicatedSecondaryWindowHost) {
      return;
    }

    publishSyncedOverlayAppearanceSnapshot(resolvedAppearance);
  }, [isDedicatedSecondaryWindowHost, resolvedAppearance]);
  const resolvedSoundPack = useMemo(() => {
    const requestedSoundPackId = audioSettings.activeSoundPackId
      ?? resolvedAppearance.baseTheme.defaultSoundPackId
      ?? DEFAULT_SOUND_PACK_ID;
    return resolveLoadedSoundPack(combinedSoundPacks, requestedSoundPackId)
      ?? resolveLoadedSoundPack(combinedSoundPacks, DEFAULT_SOUND_PACK_ID);
  }, [
    audioSettings.activeSoundPackId,
    combinedSoundPacks,
    resolvedAppearance.baseTheme.defaultSoundPackId,
  ]);
  const resolvedDockPresentation = useMemo(
    () => resolveActiveDockPresentation({
      requestedPresentationId: dockSettings.activePresentationId,
      placementMode: dockSettings.placementMode,
      edgeSize: dockSettings.edgeSize,
      edgeWidth: dockSettings.edgeWidth,
      defaultTerminalRows: dockSettings.defaultTerminalRows,
      defaultTerminalColumns: dockSettings.defaultTerminalColumns,
      floatingBounds: dockSettings.floatingBounds,
      topBarId: dockSettings.topBarId,
      previewEnabled: dockSettings.previewEnabled,
      previewSplitMode: dockSettings.previewSplitMode,
      packageSources: combinedDockPresentationPackageSources,
    }),
    [
      combinedDockPresentationPackageSources,
      dockSettings.activePresentationId,
      dockSettings.defaultTerminalColumns,
      dockSettings.defaultTerminalRows,
      dockSettings.edgeSize,
      dockSettings.edgeWidth,
      dockSettings.floatingBounds,
      dockSettings.placementMode,
      dockSettings.previewEnabled,
      dockSettings.previewSplitMode,
      dockSettings.topBarId,
    ],
  );
  useEffect(() => {
    configureSoundEffectsRuntime({
      enabled: audioSettings.soundEffectsEnabled,
      volume: audioSettings.soundEffectsVolume,
      pack: resolvedSoundPack ?? null,
      groupEnabled: {
        button: audioSettings.buttonSoundsEnabled,
        navigation: audioSettings.navigationSoundsEnabled,
        task: audioSettings.taskSoundsEnabled,
        notification: audioSettings.notificationSoundsEnabled,
      },
    });
  }, [
    audioSettings.buttonSoundsEnabled,
    audioSettings.navigationSoundsEnabled,
    audioSettings.notificationSoundsEnabled,
    audioSettings.soundEffectsEnabled,
    audioSettings.soundEffectsVolume,
    audioSettings.taskSoundsEnabled,
    resolvedSoundPack,
  ]);

  useEffect(() => {
    const nextTasksById = Object.fromEntries(
      explorerTasks.map(task => [task.id, task] as const),
    );

    if (!explorerTaskTransitionReadyRef.current) {
      previousExplorerTasksByIdRef.current = nextTasksById;
      explorerTaskTransitionReadyRef.current = true;
      return;
    }

    const previousTasksById = previousExplorerTasksByIdRef.current;
    previousExplorerTasksByIdRef.current = nextTasksById;

    for (const task of explorerTasks) {
      if (!shouldAnnounceExplorerTask(task)) {
        continue;
      }

      const previousTask = previousTasksById[task.id];
      if (!previousTask) {
        if (task.status === 'running') {
          void playSoundEffect('task-start');
        }
        continue;
      }

      if (previousTask.status === task.status) {
        continue;
      }

      if (task.status === 'running') {
        void playSoundEffect('task-start');
        continue;
      }

      if (task.status === 'succeeded') {
        void playSoundEffect('task-success');
        if (audioSettings.nativeNotificationsEnabled && audioSettings.nativeTaskSuccessNotificationsEnabled) {
          const notification = buildExplorerTaskNotificationPayload(task);
          void sendNativeNotification({
            ...notification,
            requestPermission: false,
          });
        }
        continue;
      }

      if (task.status === 'failed' || task.status === 'cancelled') {
        void playSoundEffect('task-failure');
        if (audioSettings.nativeNotificationsEnabled && audioSettings.nativeTaskFailureNotificationsEnabled) {
          const notification = buildExplorerTaskNotificationPayload(task);
          void sendNativeNotification({
            ...notification,
            requestPermission: false,
          });
        }
      }
    }
  }, [
    audioSettings.nativeNotificationsEnabled,
    audioSettings.nativeTaskFailureNotificationsEnabled,
    audioSettings.nativeTaskSuccessNotificationsEnabled,
    explorerTasks,
  ]);
  const workbench = resolvedAppearance.workbenchTheme;
  const mobileShareThemeSnapshot = useMemo(
    () => createMobileShareThemeSnapshot(resolvedAppearance, {
      folderIconRules: explorerSettings.folderIconRules,
      defaultFolderIcon: explorerSettings.defaultFolderIcon,
      layout: mobileSettings.layout,
      pluginSettingsById: pluginSettings.valuesByPluginId,
    }),
    [
      resolvedAppearance,
      explorerSettings.defaultFolderIcon,
      explorerSettings.folderIconRules,
      mobileSettings.layout,
      pluginSettings.valuesByPluginId,
    ],
  );
  const resolvedTopBarSelection = useMemo(
    () => resolveActiveTopBarSelection({
      requestedTopBarId:
        windowMode === 'overlay'
          ? (resolvedDockPresentation.topBarId ?? appearance.activeTopBarId)
          : appearance.activeTopBarId,
      theme: resolvedAppearance.baseTheme,
      packageSources: combinedTopBarPackageSources,
    }),
    [
      appearance.activeTopBarId,
      combinedTopBarPackageSources,
      resolvedDockPresentation.topBarId,
      resolvedAppearance.baseTheme,
      windowMode,
    ],
  );
  const resolvedTopBarLayoutSnapshot = useMemo(
    () => appearance.topBarLayoutSnapshotsById[resolvedTopBarSelection.topBar.id] ?? null,
    [appearance.topBarLayoutSnapshotsById, resolvedTopBarSelection.topBar.id],
  );
  const handleCommitTopBarLayoutSnapshot = useCallback(
    (snapshot: LayoutDynamicsAuthoringSnapshot) => {
      const nextSnapshotsById = {
        ...appearance.topBarLayoutSnapshotsById,
      };
      if (snapshot.entries.length === 0) {
        delete nextSnapshotsById[resolvedTopBarSelection.topBar.id];
      } else {
        nextSnapshotsById[resolvedTopBarSelection.topBar.id] = snapshot;
      }
      updateAppearance({
        topBarLayoutSnapshotsById: nextSnapshotsById,
      });
    },
    [
      appearance.topBarLayoutSnapshotsById,
      resolvedTopBarSelection.topBar.id,
      updateAppearance,
    ],
  );
  const handleToggleTopBarCustomize = useCallback(() => {
    setTopBarCustomizeActive((active) => !active);
  }, []);
  useEffect(() => {
    setTopBarCustomizeActive(false);
  }, [resolvedTopBarSelection.topBar.id]);
  const isOverlayVisible = overlayPhase !== 'closed';
  overlayVisibleRef.current = isOverlayVisible;
  const isWindowedMode = windowMode === 'windowed';
  const startupPresentationShownRef = useRef(false);
  const usesSeparateWaylandDockHost = hasSeparateWaylandDockHost({
    runtimePlatform,
    linuxDisplayServer,
    waylandDockHostEnabled,
  });
  const presentationHostLabel = resolvePresentationHostLabel({
    windowMode,
    useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
  });
  const shouldForceWindowedStartupMode = shouldForceMainWindowStartupMode({
    runtimePlatform,
    linuxDisplayServer,
    useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
    windowMode,
    hostRole: currentWindowHostRole,
  });
  const isCurrentWindowPresentationHost = isWindowHostResponsibleForMode({
    hostRole: currentWindowHostRole,
    windowMode,
    useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
  });
  // The dedicated Wayland dock host must stay on the layer-shell geometry path
  // even during cross-window handoff, before its local persisted windowMode has
  // rehydrated to `overlay`.
  const currentHostUsesWaylandDockLayerShell = currentWindowHostRole === DOCK_WINDOW_HOST_LABEL;
  const isWaylandOverlaySession = runtimePlatform === 'linux'
    && linuxDisplayServer === 'wayland'
    && !isWindowedMode
    && !usesSeparateWaylandDockHost;
  const shouldWaitForWindowRouting = runtimePlatform === 'linux'
    && (!linuxDisplayServerResolved || (linuxDisplayServer === 'wayland' && !waylandDockHostStatusResolved));
  const canResizeOverlayShell = !currentHostUsesWaylandDockLayerShell;
  const beginWindowPresentationApply = useCallback(() => {
    windowPresentationApplyGenerationRef.current += 1;
    return windowPresentationApplyGenerationRef.current;
  }, []);
  const isWindowPresentationApplyCurrent = useCallback((
    generation: number,
    expectedMode: TerminalWindowMode,
  ) => {
    if (generation !== windowPresentationApplyGenerationRef.current) {
      return false;
    }
    if (expectedMode === 'overlay' && currentHostUsesWaylandDockLayerShell) {
      return true;
    }
    return windowModeRef.current === expectedMode;
  }, [currentHostUsesWaylandDockLayerShell]);

  useEffect(() => {
    setActiveMobileShareThemeSnapshot(mobileShareThemeSnapshot);
    void syncMobileShareThemeSnapshot(mobileShareThemeSnapshot);
  }, [mobileShareThemeSnapshot]);
  const systemPresentationState = useMemo(
    () => resolveSystemPresentationState(systemSettings),
    [systemSettings],
  );
  const shouldSkipTaskbar = !systemPresentationState.taskbarVisible;
  const appOpacity = kainUiTheme?.appOpacity ?? appearance.appOpacity ?? 1.0;
  const panelTransparency = effectivePanelTransparency ?? overlayVisualControls.panelTransparency.defaultValue;
  const appZoom = appearance.appZoom ?? kainUiTheme?.appZoom ?? 1.0;
  const appBlur = appearance.appBlur ?? true;
  const appBlurStrength = kainUiTheme?.blurStrengthPx ?? appearance.appBlurStrength ?? overlayVisualControls.blurStrength.defaultValue;
  const animationsEnabled = appearance.animations ?? false;
  const appAnimationDurationMs = animationsEnabled
    ? clampOverlayAnimationDuration(appearance.appAnimationDurationMs ?? 320)
    : 140;
  const appAnimationIntensity = clampOverlayAnimationIntensity(appearance.appAnimationIntensity ?? 1);
  const clampedAppOpacity = clampOverlayVisualControlValue('opacity', appOpacity);
  const clampedPanelTransparency = clampOverlayVisualControlValue('panelTransparency', panelTransparency);
  const clampedAppZoom = clampOverlayVisualControlValue('zoom', appZoom);
  const clampedAppBlurStrength = clampOverlayVisualControlValue('blurStrength', appBlurStrength);
  const shellEffectsPolicy = useMemo(
    () => resolveOverlayShellEffectsPolicy({
      runtimePlatform,
      frameStats: latestOverlayFrameStats,
      requestedBlurEnabled: appBlur,
      requestedBlurStrength: clampedAppBlurStrength,
    }),
    [appBlur, clampedAppBlurStrength, latestOverlayFrameStats, runtimePlatform],
  );
  const effectiveShellBlurEnabled = shellEffectsPolicy.blurEnabled;
  const effectiveShellBlurStrength = shellEffectsPolicy.blurStrength;
  const wallpaperOpacity = clampOverlayVisualControlValue('opacity', appearance.wallpaperOpacity ?? 1);
  const dockPlacementMode: DockPlacementMode =
    currentHostUsesWaylandDockLayerShell &&
    resolvedDockPresentation.placementMode === 'floating'
      ? (resolvedDockPresentation.presentation.defaultPlacement === 'top-edge'
          ? 'top-edge'
          : 'bottom-edge')
      : resolvedDockPresentation.placementMode;
  const overlayAnchor: OverlayWindowAnchor = dockPlacementMode === 'top-edge' ? 'top' : 'bottom';
  const dockIsFloating = !isWindowedMode && dockPlacementMode === 'floating';
  const isTopAnchored = !isWindowedMode && overlayAnchor === 'top';
  const dockTopBarHeight = windowMode === 'overlay'
    ? Math.max(30, workbench.metrics.chromeHeight - 8)
    : workbench.metrics.chromeHeight;
  const dockTerminalGrid = useMemo(
    () => estimateDockTerminalGridFromSize({
      edgeSize: resolvedDockPresentation.edgeSize,
      edgeWidth: resolvedDockPresentation.edgeWidth,
      terminalFontSize: settings.fontSize,
      dockTopBarHeight,
    }),
    [
      dockTopBarHeight,
      resolvedDockPresentation.edgeSize,
      resolvedDockPresentation.edgeWidth,
      settings.fontSize,
    ],
  );
  const activeDockResizeGrid = dockResizeTelemetry?.grid ?? dockTerminalGrid;
  const effectiveWindowZoom = clampedAppZoom;
  const scaledWidth = `${100 / effectiveWindowZoom}%`;
  const scaledHeight = `${100 / effectiveWindowZoom}%`;
  const shellBackgroundColor = effectiveShellBlurEnabled
    ? resolveShellBackgroundColor(theme.palette.shellBackground, theme.palette.shellBackgroundSolid, effectiveShellBlurStrength)
    : theme.palette.shellBackgroundSolid;
  const shellBackdropFilter = resolveConditionalBlurFilter({
    enabled: effectiveShellBlurEnabled,
    blurPx: effectiveShellBlurStrength,
    saturateBoost: shellEffectsPolicy.tier === 'full' ? 0.35 : 0.18,
  });
  const availableAnimations = useMemo(
    () => mergeOverlayAnimations(builtInAnimations, [...authoredAnimations, ...themeContributedAnimations]),
    [authoredAnimations, builtInAnimations, themeContributedAnimations],
  );
  const availableShaders = useMemo(
    () => mergeOverlayShaders(builtInShaders, [...authoredShaders, ...themeContributedShaders, ...pluginContributedShaders]),
    [authoredShaders, builtInShaders, pluginContributedShaders, themeContributedShaders],
  );
  const availableWallpapers = useMemo(() => {
    const wallpaperById = new Map<string, LoadedOverlayWallpaper>();
    [...authoredWallpapers]
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach(wallpaper => {
        const existing = wallpaperById.get(wallpaper.id);
        if (!existing || (existing.error && !wallpaper.error)) {
          wallpaperById.set(wallpaper.id, wallpaper);
        }
      });
    return Array.from(wallpaperById.values());
  }, [authoredWallpapers]);
  const themeWallpaper = useMemo(() => {
    const assetUrl = resolvedAppearance.baseTheme.assets?.backgroundUrl;
    if (!assetUrl) {
      return null;
    }

    return createThemeAssetWallpaper({
      themeId: resolvedAppearance.baseTheme.id,
      themeName: resolvedAppearance.baseTheme.name,
      assetUrl,
    });
  }, [
    resolvedAppearance.baseTheme.assets?.backgroundUrl,
    resolvedAppearance.baseTheme.id,
    resolvedAppearance.baseTheme.name,
  ]);
  const wallpaperSelection = useMemo(() => resolveActiveWallpaper({
    availableWallpapers,
    userOverrideId: appearance.activeWallpaperId,
    themeWallpaper,
  }), [appearance.activeWallpaperId, availableWallpapers, themeWallpaper]);
  const activeWallpaper = wallpaperSelection.wallpaper;
  const shellWallpaperContext = useMemo<OverlayWallpaperRenderContext>(() => ({
    wallpaper: activeWallpaper ?? themeWallpaper ?? {
      id: wallpaperSystemConfig.noneWallpaperId,
      name: 'No Wallpaper',
      filePath: 'builtin:none',
      wallpaperRoot: 'builtin',
      source: 'theme-asset',
      kind: 'image',
    },
    theme,
    viewport: {
      width: themeRendererViewport.width,
      height: themeRendererViewport.height,
    },
    fitMode: appearance.wallpaperFitMode ?? 'cover',
    opacity: wallpaperOpacity,
    muted: appearance.wallpaperMuted !== false,
    motionEnabled: animationsEnabled,
  }), [
    activeWallpaper,
    animationsEnabled,
    appearance.wallpaperFitMode,
    appearance.wallpaperMuted,
    theme,
    themeWallpaper,
    themeRendererViewport.height,
    themeRendererViewport.width,
    wallpaperOpacity,
  ]);
  const shellThemeEffectBackgroundImage = isThemeAssetDuplicatedInEffects(
    resolvedAppearance.baseTheme.assets?.backgroundUrl,
    theme.effects.backgroundImage,
  )
    ? undefined
    : theme.effects.backgroundImage;
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
      performanceMode: appearance.shaderPerformanceMode,
    }),
    [appearance.activeShaderId, appearance.shaderPerformanceMode, availableShadersById, resolvedAppearance.baseTheme.defaultShaderId],
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
  const activeLayoutProfile = useMemo(
    () => resolveLayoutProfile(layoutManifest, layoutSettings.activeProfileId),
    [layoutManifest, layoutSettings.activeProfileId],
  );
  const activePinnedPanelIds = useMemo(
    () => getPinnedPanelIds(activeLayoutProfile),
    [activeLayoutProfile],
  );
  const explorerPanelLayoutMode = windowMode === 'overlay' ? 'dock' : 'full';
  const explorerDefaultModeProfileId = activeLayoutProfile.shellBlueprint === 'ide-workbench'
    ? 'inspector'
    : null;
  const explorerShellDefaultLayoutId = activeLayoutProfile.shellBlueprint === 'ide-workbench'
    ? 'inspector'
    : null;
  const activeThemeRenderer = resolvedAppearance.baseTheme.themeRenderer ?? null;
  const renderRuntime = useMemo(
    () => resolveWorkbenchRenderRuntime(
      resolvedAppearance,
      activeLayoutProfile,
      activeThemeRenderer?.error
        || themeRendererRuntimeError
        || (activeThemeRenderer && activeThemeRenderer.apiVersion !== overlayThemeRendererApiVersion)
        ? activeThemeRenderer?.fallbackRuntime
        : null,
    ),
    [activeLayoutProfile, activeThemeRenderer, resolvedAppearance, themeRendererRuntimeError],
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
    const isPinned = activePinnedPanelIds.includes(panelId);

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
  }, [activeLayoutProfile.id, activePinnedPanelIds]);
  const handleRequestRepositoryImport = useCallback(() => {
    setPendingRepositoryImports([]);
    void openExplorerPicker({
      kind: 'openFolders',
      presentation: 'window',
      title: 'Import Git Repositories',
      confirmLabel: 'Add Repositories',
      allowCreateDirectory: false,
      startPath: explorerCurrentPath || null,
    })
      .then((pickerResult) => {
        const normalizedPaths = Array.from(
          new Set(
            (pickerResult?.entries ?? [])
              .map(entry => entry.path.trim())
              .filter(Boolean),
          ),
        );
        if (normalizedPaths.length === 0) {
          return;
        }
        setPendingRepositoryImports(normalizedPaths);
        setPanelOpenStateDirectly('git');
      })
      .catch((error) => {
        console.error('OverlayTerm: failed to open repository import picker', error);
      });
  }, [explorerCurrentPath, setPanelOpenStateDirectly]);
  const handleEmbeddedExplorerPickerCancel = useCallback(() => {
    if (!activeExplorerPickerRequest) {
      return;
    }

    const fallbackDirectory =
      activeExplorerPickerRequest.startPath
      ?? explorerCurrentPath
      ?? joinPlatformPath(
        runtimePlatform === 'windows' ? 'C:\\' : '/',
        '',
      );

    setActiveExplorerPickerRequest(null);
    void publishExplorerPickerResult({
      cancelled: true,
      currentDirectory: fallbackDirectory,
      nonce: activeExplorerPickerRequest.nonce,
    });
  }, [activeExplorerPickerRequest, explorerCurrentPath, runtimePlatform]);
  const handleEmbeddedExplorerPickerConfirm = useCallback((result: {
    currentDirectory: string;
    entries: Array<{ path: string; name: string; kind: 'file' | 'folder' }>;
  }) => {
    if (!activeExplorerPickerRequest) {
      return;
    }

    setActiveExplorerPickerRequest(null);
    void publishExplorerPickerResult({
      currentDirectory: result.currentDirectory,
      entries: result.entries,
      nonce: activeExplorerPickerRequest.nonce,
    });
  }, [activeExplorerPickerRequest]);
  const handleRepositoryImportsHandled = useCallback(() => {
    setPendingRepositoryImports([]);
  }, []);

  useEffect(() => {
    return listenToExplorerPickerRequests((request) => {
      if (request.presentation !== 'embedded') {
        return;
      }

      setActiveExplorerPickerRequest(request);
      setPanelOpenStateDirectly('explorer');
    });
  }, [setPanelOpenStateDirectly]);

  // ── Boot store ──
  useEffect(() => { initTerminalStore(); }, [initTerminalStore]);

  useEffect(() => {
    installFrontendTelemetryObservers();
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    void configureTelemetry(buildTelemetryConfigFromSettings());
  }, [
    systemSettings.consumerDiagnosticsEnabled,
    systemSettings.consumerDiagnosticsIncludePerfSamples,
    systemSettings.consumerDiagnosticsIncludePluginRuntime,
    systemSettings.consumerDiagnosticsIncludeRendererRuntime,
    systemSettings.developerTelemetryCaptureMode,
    systemSettings.developerTelemetryEnabled,
    systemSettings.developerTelemetryMaxFileSizeMb,
    systemSettings.developerTelemetryPayloadMode,
    systemSettings.developerTelemetryShowInspector,
    systemSettings.developerTelemetryWriteToFile,
  ]);

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
    if (currentWindowHostRole === DOCK_WINDOW_HOST_LABEL) {
      return;
    }

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
  }, [currentWindowHostRole, updateSystem]);

  useEffect(() => {
    if (currentWindowHostRole === DOCK_WINDOW_HOST_LABEL || runtimePlatform !== 'linux') {
      return;
    }

    let cancelled = false;

    commands.startupGetLinuxDisplayBackendStatus()
      .then(unwrapTauriResult)
      .then(status => {
        if (!cancelled) {
          updateSystem({
            linuxDisplayBackendPreference: status.preferredBackend,
            linuxNvidiaWebkitWorkaroundMode: status.nvidiaWebkitWorkaroundMode,
          });
        }
      })
      .catch(error => {
        console.warn('OverlayTerm: failed to sync Linux display backend preference', error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentWindowHostRole, runtimePlatform, updateSystem]);

  useEffect(() => {
    if (!isTauri() || !shouldForceWindowedStartupMode) {
      return;
    }

    const persistedWindowMode = useSettingsStore.getState().settings.presentation.windowMode;
    if (persistedWindowMode !== 'dock') {
      return;
    }

    console.warn(
      'GreebleFS: forcing Linux Wayland startup back to windowed mode because the separate dock host can strand the main window during launch.',
    );
    updatePresentation({ windowMode: 'windowed' });
  }, [shouldForceWindowedStartupMode, updatePresentation]);

  useEffect(() => {
    if (!isTauri()) {
      setDesktopPresentationSynced(true);
      return;
    }

    if (currentWindowHostRole === DOCK_WINDOW_HOST_LABEL) {
      setDesktopPresentationSynced(true);
      return;
    }

    let cancelled = false;
    setDesktopPresentationSynced(false);

    const syncDesktopPresentation = async () => {
      try {
        const results = await Promise.allSettled([
          commands.traySetVisible(systemPresentationState.trayVisible).then(unwrapTauriResult),
          commands.windowSetTaskbarVisibility(systemPresentationState.taskbarVisible).then(unwrapTauriResult),
        ]);
        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failures.length > 0) {
          throw failures[0].reason;
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to sync desktop presentation', error);
        }
      } finally {
        if (!cancelled) {
          setDesktopPresentationSynced(true);
        }
      }
    };

    void syncDesktopPresentation();

    return () => {
      cancelled = true;
    };
  }, [currentWindowHostRole, systemPresentationState.taskbarVisible, systemPresentationState.trayVisible]);

  useEffect(() => {
    setOverlayPluginFonts(pluginFonts);
  }, [pluginFonts]);

  useEffect(() => {
    ensureFontFamilyLoaded(resolvedAppearance.fonts.ui);
    ensureFontFamilyLoaded(resolvedAppearance.fonts.mono);
  }, [resolvedAppearance.fonts.mono, resolvedAppearance.fonts.ui]);

  useEffect(() => {
    setThemeRendererRuntimeError(null);
  }, [activeThemeRenderer?.filePath, resolvedAppearance.baseTheme.id]);

  useEffect(() => {
    if (!activeThemeRenderer || activeThemeRenderer.apiVersion === overlayThemeRendererApiVersion) {
      return;
    }

    console.warn(
      `OverlayTerm: theme renderer "${activeThemeRenderer.name}" targets apiVersion ${activeThemeRenderer.apiVersion}, but the host supports ${overlayThemeRendererApiVersion}. Falling back to the built-in shell.`,
    );
  }, [activeThemeRenderer]);

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
  }, []);

  const markOverlayRuntimePhase = useCallback((phase: OverlayAnimationPhase, visible: boolean) => {
    overlayPhaseRef.current = phase;
    overlayVisibleRef.current = visible;
  }, []);

  const isCurrentHostWindowVisible = useCallback(async () => {
    if (!isTauri()) {
      return overlayVisibleRef.current;
    }

    const currentWindow = getCurrentWindow() as ReturnType<typeof getCurrentWindow> & {
      isVisible?: () => Promise<boolean>;
      is_visible?: () => Promise<boolean>;
    };
    if (typeof currentWindow.isVisible === 'function') {
      return currentWindow.isVisible().catch(() => false);
    }
    if (typeof currentWindow.is_visible === 'function') {
      return currentWindow.is_visible().catch(() => false);
    }

    return overlayVisibleRef.current;
  }, []);

  const hideCurrentHostImmediately = useCallback(async () => {
    if (isDedicatedSecondaryWindowHost) {
      return;
    }

    clearAnimationClock();
    dragHideRestoreRef.current = false;
    setIsCommandPaletteOpen(false);
    markOverlayRuntimePhase('closed', false);
    setOverlayPhase('closed');
    try {
      await getCurrentWindow().hide();
    } catch {
      // Ignore hide failures during host handoff and shutdown.
    }
  }, [clearAnimationClock, markOverlayRuntimePhase]);

  const openWithoutMonitorLayout = useCallback(async (win: ReturnType<typeof getCurrentWindow>) => {
    await win.show();
    await win.unminimize().catch(() => {});
    await win.setFocus();
    markOverlayRuntimePhase('open', true);
    setOverlayPhase('open');
  }, [markOverlayRuntimePhase]);

  const resolvePreferredMonitor = useCallback(async () => {
    const rememberMonitor = (
      monitor: Awaited<ReturnType<typeof currentMonitor>>,
    ) => {
      if (!monitor) {
        return monitor;
      }

      lastResolvedMonitorPointRef.current = {
        x: monitor.workArea.position.x + Math.max(24, Math.round(monitor.workArea.size.width * 0.1)),
        y: monitor.workArea.position.y + Math.max(24, Math.round(monitor.workArea.size.height * 0.1)),
      };
      return monitor;
    };

    const liveMonitor = await currentMonitor().catch(() => null);
    if (liveMonitor) {
      return rememberMonitor(liveMonitor);
    }

    const win = getCurrentWindow();
    const liveWindowPosition = await win.outerPosition().catch(() => null);
    if (liveWindowPosition) {
      const pointedMonitor = await monitorFromPoint(
        liveWindowPosition.x + 24,
        liveWindowPosition.y + 24,
      ).catch(() => null);
      if (pointedMonitor) {
        return rememberMonitor(pointedMonitor);
      }
    }

    if (lastResolvedMonitorPointRef.current) {
      const rememberedMonitor = await monitorFromPoint(
        lastResolvedMonitorPointRef.current.x,
        lastResolvedMonitorPointRef.current.y,
      ).catch(() => null);
      if (rememberedMonitor) {
        return rememberMonitor(rememberedMonitor);
      }
    }

    if (runtimeOverlayBoundsRef.current) {
      const overlayMonitor = await monitorFromPoint(
        runtimeOverlayBoundsRef.current.x + 24,
        runtimeOverlayBoundsRef.current.y + 24,
      ).catch(() => null);
      if (overlayMonitor) {
        return rememberMonitor(overlayMonitor);
      }
    }

    return rememberMonitor(await primaryMonitor().catch(() => null));
  }, []);

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
    const stopResizeListener = bindDeferredUnlisten(win.onResized(() => {
      void sync();
    }), {
      onError: error => {
        console.warn('OverlayTerm: failed to manage window resize listener', error);
      },
    });

    return () => {
      cancelled = true;
      stopResizeListener();
    };
  }, [isWindowedMode]);

  useEffect(() => {
    if (!isTauri() || runtimePlatform !== 'linux') {
      setLinuxDisplayServer('unknown');
      setLinuxDisplayServerResolved(true);
      return;
    }

    let cancelled = false;
    setLinuxDisplayServerResolved(false);
    commands.windowGetLinuxDisplayServer()
      .then(displayServer => {
        if (cancelled) {
          return;
        }

        setLinuxDisplayServer(
          displayServer === 'wayland' || displayServer === 'x11'
            ? displayServer
            : 'unknown',
        );
        setLinuxDisplayServerResolved(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLinuxDisplayServer('unknown');
          setLinuxDisplayServerResolved(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimePlatform]);

  useEffect(() => {
    if (!isTauri() || runtimePlatform !== 'linux') {
      setWaylandDockHostEnabled(false);
      setWaylandDockHostStatusResolved(true);
      return;
    }

    if (!linuxDisplayServerResolved) {
      setWaylandDockHostStatusResolved(false);
      return;
    }

    if (linuxDisplayServer !== 'wayland') {
      setWaylandDockHostEnabled(false);
      setWaylandDockHostStatusResolved(true);
      return;
    }

    let cancelled = false;
    setWaylandDockHostStatusResolved(false);
    commands.windowGetWaylandDockHostStatus()
      .then(status => {
        if (cancelled) {
          return;
        }

        setWaylandDockHostEnabled(Boolean(status.enabled));
        setWaylandDockHostStatusResolved(true);
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('OverlayTerm: failed to resolve Wayland dock host status', error);
          setWaylandDockHostEnabled(false);
          setWaylandDockHostStatusResolved(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [linuxDisplayServer, linuxDisplayServerResolved, runtimePlatform]);

  const resolveDockOverlayLayout = useCallback((args: {
    monitor: NonNullable<Awaited<ReturnType<typeof currentMonitor>>>;
    scaleFactor: number;
    currentBounds?: OverlayWindowBounds | null;
  }) => {
    const store = useSettingsStore.getState().settings.dock;
    const requestedPlacement = store.placementMode ?? resolvedDockPresentation.placementMode;
    const effectivePlacement: DockPlacementMode =
      currentHostUsesWaylandDockLayerShell && requestedPlacement === 'floating'
        ? (resolvedDockPresentation.presentation.defaultPlacement === 'top-edge'
            ? 'top-edge'
            : 'bottom-edge')
        : requestedPlacement;

    return computeDockPresentationWindowLayout({
      workArea: args.monitor.workArea,
      scaleFactor: args.scaleFactor,
      placementMode: effectivePlacement,
      edgeSize: store.edgeSize,
      edgeWidth: store.edgeWidth,
      floatingBounds: store.floatingBounds,
      currentBounds: args.currentBounds ?? null,
    });
  }, [
    currentHostUsesWaylandDockLayerShell,
    resolvedDockPresentation.placementMode,
    resolvedDockPresentation.presentation.defaultPlacement,
  ]);

  const applyDockOverlayLayout = useCallback(async (args: {
    monitor: NonNullable<Awaited<ReturnType<typeof currentMonitor>>>;
    scaleFactor: number;
    currentBounds?: OverlayWindowBounds | null;
    deferMs?: number;
    isApplyCurrent?: () => boolean;
  }) => {
    const layout = resolveDockOverlayLayout(args);
    const constraints = computeOverlayWindowConstraints({
      workArea: args.monitor.workArea,
      scaleFactor: args.scaleFactor,
    });
    const store = useSettingsStore.getState().settings.dock;

    if (layout.healedHeight !== null && layout.healedHeight !== store.edgeSize) {
      useSettingsStore.getState().updateDock({ edgeSize: layout.healedHeight });
    }

    const nextRuntimeBounds = isWaylandOverlaySession
      ? (args.currentBounds ?? runtimeOverlayBoundsRef.current ?? {
          width: layout.width,
          height: layout.height,
          x: layout.x,
          y: layout.y,
        })
      : {
          width: layout.width,
          height: layout.height,
          x: layout.x,
          y: layout.y,
        };
    runtimeOverlayBoundsRef.current = nextRuntimeBounds;

    if (args.deferMs && args.deferMs > 0) {
      await new Promise(resolve => window.setTimeout(resolve, args.deferMs));
    }

    if (args.isApplyCurrent && !args.isApplyCurrent()) {
      return layout;
    }

    if (currentHostUsesWaylandDockLayerShell) {
      unwrapTauriResult(await commands.windowApplyWaylandDockLayout(
        layout.placementMode === 'top-edge' ? 'top' : 'bottom',
        args.monitor.name ?? null,
        layout.width,
        layout.height,
      ));
      return layout;
    }

    if (isWaylandOverlaySession) {
      return layout;
    }

    isProgrammaticResizeRef.current = true;
    try {
      unwrapTauriResult(await commands.windowApplyMode({
        decorations: false,
        alwaysOnTop: true,
        shadow: false,
        skipTaskbar: shouldSkipTaskbar,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        minWidth: constraints.minWidth,
        minHeight: constraints.minHeight,
        maxWidth: constraints.maxWidth,
        maxHeight: constraints.maxHeight,
      }));
    } finally {
      isProgrammaticResizeRef.current = false;
    }

    return layout;
  }, [currentHostUsesWaylandDockLayerShell, isWaylandOverlaySession, resolveDockOverlayLayout, shouldSkipTaskbar]);

  // ── Position & show ──
  const positionAndShow = useCallback(async () => {
    const applyGeneration = beginWindowPresentationApply();
    clearAnimationClock();
    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await resolvePreferredMonitor();
      if (!monitor) {
        await openWithoutMonitorLayout(win);
        return;
      }
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'overlay')) {
        return;
      }

      const dockStore = useSettingsStore.getState().settings.dock;
      const shouldRestoreFloatingBounds =
        dockStore.placementMode === 'floating' && !currentHostUsesWaylandDockLayerShell;
      const rememberedBounds = shouldRestoreFloatingBounds
        ? (runtimeOverlayBoundsRef.current ?? dockStore.floatingBounds)
        : null;
      const layout = resolveDockOverlayLayout({
        monitor,
        scaleFactor,
        currentBounds: rememberedBounds,
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
      markOverlayRuntimePhase('opening', true);
      interactionLockUntilRef.current = Date.now() + nextDurationMs + 80;
      setOverlayPhase('closed');
      if (layout.healedHeight !== null && layout.healedHeight !== dockStore.edgeSize) {
        useSettingsStore.getState().updateDock({ edgeSize: layout.healedHeight });
      }
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'overlay')) {
        return;
      }
      await applyDockOverlayLayout({
        monitor,
        scaleFactor,
        currentBounds: rememberedBounds,
        isApplyCurrent: () => isWindowPresentationApplyCurrent(applyGeneration, 'overlay'),
      });
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'overlay')) {
        isProgrammaticResizeRef.current = false;
        return;
      }
      await win.show();
      await win.setFocus();
      if (runtimePlatform === 'linux' && !isWaylandOverlaySession) {
        await applyDockOverlayLayout({
          monitor,
          scaleFactor,
          currentBounds: {
            width: layout.width,
            height: layout.height,
            x: layout.x,
            y: layout.y,
          },
          deferMs: 34,
          isApplyCurrent: () => isWindowPresentationApplyCurrent(applyGeneration, 'overlay'),
        });
      }

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
        runtimeOverlayBoundsRef.current = isWaylandOverlaySession
          ? (runtimeOverlayBoundsRef.current ?? {
              width: layout.width,
              height: layout.height,
              x: layout.x,
              y: layout.y,
            })
          : {
              width: layout.width,
              height: layout.height,
              x: layout.x,
              y: layout.y,
            };
        isProgrammaticResizeRef.current = false;
        markOverlayRuntimePhase('opening', true);
        setOverlayPhase('opening');
        animationTimerRef.current = window.setTimeout(() => {
          markOverlayRuntimePhase('open', true);
          setOverlayPhase('open');
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
      console.warn('OverlayTerm: failed to position/show', e);
    }
  }, [
    appAnimationDurationMs,
    applyDockOverlayLayout,
    beginWindowPresentationApply,
    clearAnimationClock,
    currentHostUsesWaylandDockLayerShell,
    isWaylandOverlaySession,
    isWindowPresentationApplyCurrent,
    markOverlayRuntimePhase,
    openWithoutMonitorLayout,
    resolveAnimationById,
    resolveDockOverlayLayout,
    resolvedOpenAnimationId,
    runtimePlatform,
  ]);

  const showWindowedPanel = useCallback(async () => {
    if (isDedicatedSecondaryWindowHost) {
      return;
    }

    const applyGeneration = beginWindowPresentationApply();
    clearAnimationClock();
    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await resolvePreferredMonitor();
      if (!monitor) {
        await openWithoutMonitorLayout(win);
        return;
      }
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'windowed')) {
        return;
      }

      const store = useSettingsStore.getState().settings.terminal;
      const layout = computePanelWindowLayout({
        workArea: monitor.workArea,
        scaleFactor,
        windowedWidth: store.windowedWidth,
        windowedHeight: store.windowedHeight,
      });
      const constraints = computePanelWindowConstraints({
        workArea: monitor.workArea,
        scaleFactor,
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

      const currentlyMaximized = await win.isMaximized().catch(() => false);
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'windowed')) {
        return;
      }
      const shouldSeedRestoreBoundsBeforeMaximize = lastWindowedMaximizedRef.current;
      const shouldRestoreMaximizedWindow =
        shouldSeedRestoreBoundsBeforeMaximize || currentlyMaximized;
      const applyGeometry = resolveWindowedModeApplyGeometry({
        layout,
        shouldRestoreMaximizedWindow,
        shouldSeedRestoreBoundsBeforeMaximize,
      });
      isProgrammaticResizeRef.current = true;

      if (isTauri()) {
        unwrapTauriResult(await commands.windowApplyMode({
          decorations: false,
          alwaysOnTop: false,
          shadow: false,
          skipTaskbar: shouldSkipTaskbar,
          x: applyGeometry.x,
          y: applyGeometry.y,
          width: applyGeometry.width,
          height: applyGeometry.height,
          minWidth: constraints.minWidth,
          minHeight: constraints.minHeight,
          maxWidth: constraints.maxWidth,
          maxHeight: constraints.maxHeight,
        }));
      }
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'windowed')) {
        isProgrammaticResizeRef.current = false;
        return;
      }
      await win.show();
      await win.unminimize().catch(() => {});
      await win.setFocus();
      if (!isWindowPresentationApplyCurrent(applyGeneration, 'windowed')) {
        isProgrammaticResizeRef.current = false;
        return;
      }
      if (shouldRestoreMaximizedWindow) {
        await win.maximize().catch(() => {});
        setIsWindowMaximized(true);
      } else {
        setIsWindowMaximized(false);
      }
      lastWindowedMaximizedRef.current = false;

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
        animationTimerRef.current = window.setTimeout(() => {
          markOverlayRuntimePhase('open', true);
          setOverlayPhase('open');
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
      console.warn('OverlayTerm: failed to show regular window mode', error);
    }
  }, [
    appAnimationDurationMs,
    beginWindowPresentationApply,
    clearAnimationClock,
    isWindowPresentationApplyCurrent,
    markOverlayRuntimePhase,
    openWithoutMonitorLayout,
    resolveAnimationById,
    resolvedOpenAnimationId,
  ]);

  const showCurrentPresentation = useCallback(async () => {
    if (isDedicatedSecondaryWindowHost) {
      return;
    }

    if (shouldWaitForWindowRouting) {
      return;
    }

    const activeWindowMode = windowModeRef.current;
    const activePresentationHostLabel = resolvePresentationHostLabel({
      windowMode: activeWindowMode,
      useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
    });
    if (usesSeparateWaylandDockHost && currentWindowHostRole !== activePresentationHostLabel) {
      await emitWindowEventToHost(
        activePresentationHostLabel,
        SHOW_WINDOW_MODE_REQUEST_EVENT,
        activeWindowMode,
      );
      return;
    }

    if (activeWindowMode === 'windowed') {
      await showWindowedPanel();
      return;
    }

    await positionAndShow();
  }, [
    currentWindowHostRole,
    isDedicatedSecondaryWindowHost,
    positionAndShow,
    shouldWaitForWindowRouting,
    showWindowedPanel,
    usesSeparateWaylandDockHost,
  ]);

  const handleOpenInFilesystemAquarium: (path: string) => void = useCallback((path: string) => {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return;
    }

    requestFilesystemAquariumOpen(trimmedPath);
    setPanelOpenStateDirectly(FILESYSTEM_AQUARIUM_PANEL_ID);
    if (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed') {
      void showCurrentPresentation();
    }
  }, [setPanelOpenStateDirectly, showCurrentPresentation]);

  const handleSetDockPlacementMode = useCallback((placementMode: DockPlacementMode) => {
    isFreefloatingRef.current = placementMode === 'floating';
    updateDock({ placementMode });
  }, [updateDock]);

  const handleToggleOverlayAnchor = useCallback(() => {
    const nextPlacement: DockPlacementMode = overlayAnchor === 'top'
      ? 'bottom-edge'
      : 'top-edge';
    handleSetDockPlacementMode(nextPlacement);
  }, [handleSetDockPlacementMode, overlayAnchor]);

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
    markOverlayRuntimePhase('closing', true);
    interactionLockUntilRef.current = Date.now() + nextDurationMs + 80;
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
    }, nextDurationMs);
  }, [appAnimationDurationMs, clearAnimationClock, markOverlayRuntimePhase, resolveAnimationById, resolvedCloseAnimationId]);

  const requestWindowModeChange = useCallback(async (nextWindowMode: TerminalWindowMode) => {
    const currentWindowMode = windowModeRef.current;
    if (currentWindowMode === nextWindowMode) {
      return;
    }

    const currentPresentationHost = resolvePresentationHostLabel({
      windowMode: currentWindowMode,
      useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
    });
    const nextPresentationHost = resolvePresentationHostLabel({
      windowMode: nextWindowMode,
      useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
    });
    const shouldCarryVisibleSession = overlayVisibleRef.current || await isCurrentHostWindowVisible();

    if (isTauri() && currentWindowMode === 'windowed' && nextWindowMode === 'overlay') {
      const currentWindow = getCurrentWindow();
      const wasWindowedMaximized = await currentWindow.isMaximized().catch(
        () => lastWindowedMaximizedRef.current,
      );
      lastWindowedMaximizedRef.current = wasWindowedMaximized;
      if (wasWindowedMaximized) {
        await currentWindow.unmaximize().catch(() => {});
        setIsWindowMaximized(false);
      } else {
        lastWindowedMaximizedRef.current = false;
      }
    }

    windowPresentationApplyGenerationRef.current += 1;
    windowModeRef.current = nextWindowMode;
    updatePresentation({
      windowMode: nextWindowMode === 'overlay' ? 'dock' : 'windowed',
    });
    if (nextWindowMode === 'overlay') {
      setPanelOpenStateDirectly('explorer');
    }

    if (
      usesSeparateWaylandDockHost
      && currentWindowHostRole === currentPresentationHost
      && currentPresentationHost !== nextPresentationHost
    ) {
      if (shouldCarryVisibleSession) {
        await emitWindowEventToHost(
          nextPresentationHost,
          SHOW_WINDOW_MODE_REQUEST_EVENT,
          nextWindowMode,
        );
      }
      await hideCurrentHostImmediately();
      return;
    }

    if (
      shouldCarryVisibleSession
      && (currentPresentationHost === nextPresentationHost || currentWindowHostRole === nextPresentationHost)
    ) {
      if (nextWindowMode === 'windowed') {
        await showWindowedPanel();
      } else {
        await positionAndShow();
      }
    }
  }, [
    currentWindowHostRole,
    hideCurrentHostImmediately,
    isCurrentHostWindowVisible,
    positionAndShow,
    setPanelOpenStateDirectly,
    showWindowedPanel,
    updatePresentation,
    usesSeparateWaylandDockHost,
  ]);

  const handleToggleOverlayRequest = useCallback(() => {
    if (shouldWaitForWindowRouting) {
      return;
    }

    if (usesSeparateWaylandDockHost && !isCurrentWindowPresentationHost) {
      void emitWindowEventToHost(
        presentationHostLabel,
        TOGGLE_OVERLAY_REQUEST_EVENT,
      );
      return;
    }

    const currentPhase = overlayPhaseRef.current;
    if (currentPhase === 'open' || currentPhase === 'opening') {
      void hideOverlay();
      return;
    }

    void showCurrentPresentation();
  }, [
    hideOverlay,
    isCurrentWindowPresentationHost,
    presentationHostLabel,
    shouldWaitForWindowRouting,
    showCurrentPresentation,
    usesSeparateWaylandDockHost,
  ]);

  useGlobalShortcut(
    keybindings.terminalToggle,
    handleToggleOverlayRequest,
    isTauri()
      && !isDedicatedSecondaryWindowHost
      && shouldRegisterGlobalShortcutForHost(currentWindowHostRole),
  );

  useEffect(() => {
    if (
      !isTauri()
      || isDedicatedSecondaryWindowHost
      || !desktopPresentationSynced
      || startupPresentationShownRef.current
      || shouldWaitForWindowRouting
    ) {
      return;
    }

    let cancelled = false;
    const startupTimer = window.setTimeout(() => {
      const syncInitialPresentation = async () => {
        const win = getCurrentWindow();
        const visible = await isCurrentHostWindowVisible();
        if (
          cancelled
          || overlayVisibleRef.current
          || overlayPhaseRef.current !== 'closed'
        ) {
          return;
        }

        startupPresentationShownRef.current = true;
        if (usesSeparateWaylandDockHost && !isCurrentWindowPresentationHost) {
          if (visible) {
            await win.hide().catch(() => {});
          }
          return;
        }

        if (visible) {
          await win.hide().catch(() => {});
        }
        await showCurrentPresentation();
      };

      void syncInitialPresentation();
    }, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
    };
  }, [
    desktopPresentationSynced,
    isDedicatedSecondaryWindowHost,
    isCurrentHostWindowVisible,
    isCurrentWindowPresentationHost,
    shouldWaitForWindowRouting,
    showCurrentPresentation,
      usesSeparateWaylandDockHost,
    ]);

  useEffect(() => {
    if (
      !isTauri()
      || isDedicatedSecondaryWindowHost
      || !usesSeparateWaylandDockHost
      || shouldWaitForWindowRouting
      || isCurrentWindowPresentationHost
    ) {
      return;
    }

    let cancelled = false;
    void isCurrentHostWindowVisible().then(visible => {
      if (cancelled || (!visible && !overlayVisibleRef.current)) {
        return;
      }

      void hideCurrentHostImmediately();
    });

    return () => {
      cancelled = true;
    };
  }, [
    hideCurrentHostImmediately,
    isDedicatedSecondaryWindowHost,
    isCurrentHostWindowVisible,
    isCurrentWindowPresentationHost,
    shouldWaitForWindowRouting,
    usesSeparateWaylandDockHost,
  ]);

  useEffect(() => {
    if (!isTauri() || isDedicatedSecondaryWindowHost) {
      return;
    }

    const stopToggleListener = bindDeferredUnlisten(
      listen(TOGGLE_OVERLAY_REQUEST_EVENT, () => {
        handleToggleOverlayRequest();
      }),
      {
        onError: error => {
          console.warn('OverlayTerm: failed to listen for toggle requests', error);
        },
      },
    );

    const stopShowWindowModeListener = bindDeferredUnlisten(
      listen<TerminalWindowMode>(SHOW_WINDOW_MODE_REQUEST_EVENT, event => {
        const nextWindowMode = event.payload === 'windowed' ? 'windowed' : 'overlay';
        const shouldAcceptWaylandDockShowRequest = currentWindowHostRole === DOCK_WINDOW_HOST_LABEL
          && nextWindowMode === 'overlay';
        const targetHostLabel = resolvePresentationHostLabel({
          windowMode: nextWindowMode,
          useSeparateWaylandDockHost: usesSeparateWaylandDockHost,
        });
        if (!shouldAcceptWaylandDockShowRequest && currentWindowHostRole !== targetHostLabel) {
          return;
        }

        if (nextWindowMode === 'windowed') {
          void showWindowedPanel();
          return;
        }

        void positionAndShow();
      }),
      {
        onError: error => {
          console.warn('OverlayTerm: failed to listen for window mode show requests', error);
        },
      },
    );

    return () => {
      stopToggleListener();
      stopShowWindowModeListener();
    };
  }, [
    currentWindowHostRole,
    handleToggleOverlayRequest,
    isDedicatedSecondaryWindowHost,
    positionAndShow,
    showWindowedPanel,
    usesSeparateWaylandDockHost,
  ]);

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

  const syncWindowPresentation = useCallback(async (mode: TerminalWindowMode) => {
    if (
      !isTauri()
      || isDedicatedSecondaryWindowHost
      || !overlayVisibleRef.current
      || !isCurrentWindowPresentationHost
    ) {
      return;
    }

    const applyGeneration = beginWindowPresentationApply();
    try {
      const win = getCurrentWindow();
      const scaleFactor = await win.scaleFactor();
      const monitor = await resolvePreferredMonitor();
      if (!monitor) {
        return;
      }
      if (!isWindowPresentationApplyCurrent(applyGeneration, mode)) {
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
        const constraints = computePanelWindowConstraints({
          workArea: monitor.workArea,
          scaleFactor,
        });
        const currentlyMaximized = await win.isMaximized().catch(() => false);
        // When we come back from dock mode after a maximized app session,
        // Windows keeps the dock-sized restore rect unless we seed a real
        // app-mode rectangle before maximizing again.
        const shouldSeedRestoreBoundsBeforeMaximize = lastWindowedMaximizedRef.current;
        const shouldRestoreMaximizedWindow =
          shouldSeedRestoreBoundsBeforeMaximize || currentlyMaximized;
        const applyGeometry = resolveWindowedModeApplyGeometry({
          layout,
          shouldRestoreMaximizedWindow,
          shouldSeedRestoreBoundsBeforeMaximize,
        });
        if (!isWindowPresentationApplyCurrent(applyGeneration, 'windowed')) {
          return;
        }
        isProgrammaticResizeRef.current = true;
        try {
          unwrapTauriResult(await commands.windowApplyMode({
            decorations: false,
            alwaysOnTop: false,
            shadow: false,
            skipTaskbar: shouldSkipTaskbar,
            x: applyGeometry.x,
            y: applyGeometry.y,
            width: applyGeometry.width,
            height: applyGeometry.height,
            minWidth: constraints.minWidth,
            minHeight: constraints.minHeight,
            maxWidth: constraints.maxWidth,
            maxHeight: constraints.maxHeight,
          }));
          if (!isWindowPresentationApplyCurrent(applyGeneration, 'windowed')) {
            return;
          }
          if (shouldRestoreMaximizedWindow) {
            await win.maximize().catch(() => {});
            setIsWindowMaximized(true);
          } else {
            setIsWindowMaximized(false);
          }
          lastWindowedMaximizedRef.current = false;
        } finally {
          isProgrammaticResizeRef.current = false;
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

      const dockStore = useSettingsStore.getState().settings.dock;
      const shouldRestoreFloatingBounds =
        dockStore.placementMode === 'floating' && !currentHostUsesWaylandDockLayerShell;

      if (!isWindowPresentationApplyCurrent(applyGeneration, 'overlay')) {
        return;
      }
      await applyDockOverlayLayout({
        monitor,
        scaleFactor,
        currentBounds: shouldRestoreFloatingBounds
          ? (runtimeOverlayBoundsRef.current ?? dockStore.floatingBounds)
          : null,
        isApplyCurrent: () => isWindowPresentationApplyCurrent(applyGeneration, 'overlay'),
      });
    } catch (error) {
      console.warn('OverlayTerm: failed to transition window presentation', error);
    }
  }, [
    applyDockOverlayLayout,
    beginWindowPresentationApply,
    currentHostUsesWaylandDockLayerShell,
    isDedicatedSecondaryWindowHost,
    isCurrentWindowPresentationHost,
    isWindowPresentationApplyCurrent,
    shouldSkipTaskbar,
  ]);

  const handleToggleWindowMode = useCallback(() => {
    const nextWindowMode = windowMode === 'windowed' ? 'overlay' : 'windowed';
    void requestWindowModeChange(nextWindowMode);
  }, [requestWindowModeChange, windowMode]);

  const handleToggleZenFocusMode = useCallback(() => {
    updateLayout({
      zenFocusMode: !layoutSettings.zenFocusMode,
    });
  }, [layoutSettings.zenFocusMode, updateLayout]);

  const handleOpenCommandPalette = useCallback(() => {
    if (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed') {
      void showCurrentPresentation();
    }
    setIsCommandPaletteOpen(true);
  }, [showCurrentPresentation]);

  const handleCloseCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const dragSource = target?.closest<HTMLElement>('[data-overlay-drag-source="file"]');
    if (!dragSource) {
      return;
    }
    if (dragSource.dataset.overlayDragIntent !== 'native-out' || dragSource.dataset.overlayDragHide !== 'true') {
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
    if (
      !isTauri()
      || isDedicatedSecondaryWindowHost
      || !overlayVisibleRef.current
      || !isCurrentWindowPresentationHost
    ) {
      return;
    }

    void syncWindowPresentation(windowMode);
  }, [isCurrentWindowPresentationHost, isDedicatedSecondaryWindowHost, syncWindowPresentation, windowMode]);

  useEffect(() => {
    if (!isTauri() || isDedicatedSecondaryWindowHost) {
      return;
    }

    return bindDeferredUnlisten(
      getCurrentWindow().onCloseRequested(async event => {
        event.preventDefault();
        const currentPhase = overlayPhaseRef.current;
        if (currentPhase === 'open') {
          await hideOverlay();
          return;
        }
        await getCurrentWindow().hide().catch(() => {});
      }),
      {
        onError: error => {
          console.warn('OverlayTerm: failed to intercept close requests', error);
        },
      },
    );
  }, [hideOverlay, isDedicatedSecondaryWindowHost]);

  useEffect(() => {
    if (!overlayVisibleRef.current || windowMode !== 'overlay' || !isCurrentWindowPresentationHost) {
      return;
    }
    if (dockResizeReanchorTimerRef.current != null) {
      return;
    }

    let cancelled = false;
    const applyGeneration = windowPresentationApplyGenerationRef.current;

    const repositionOverlay = async () => {
      try {
        const win = getCurrentWindow();
        const scaleFactor = await win.scaleFactor();
        const monitor = await resolvePreferredMonitor();
        if (
          !monitor
          || cancelled
          || !isWindowPresentationApplyCurrent(applyGeneration, 'overlay')
        ) {
          return;
        }

        await applyDockOverlayLayout({
          monitor,
          scaleFactor,
          currentBounds: runtimeOverlayBoundsRef.current,
          isApplyCurrent: () => (
            !cancelled && isWindowPresentationApplyCurrent(applyGeneration, 'overlay')
          ),
        });
      } catch (error) {
        console.warn('OverlayTerm: failed to re-anchor overlay', error);
      }
    };

    void repositionOverlay();

    return () => {
      cancelled = true;
    };
  }, [
    applyDockOverlayLayout,
    dockPlacementMode,
    dockSettings.edgeSize,
    dockSettings.edgeWidth,
    dockSettings.floatingBounds,
    isCurrentWindowPresentationHost,
    isWindowPresentationApplyCurrent,
    overlayAnchor,
    windowMode,
    resolvePreferredMonitor,
  ]);

  useEffect(() => {
    if ((!isOverlayVisible && !isWindowedMode) || typeof window === 'undefined' || !isTauri()) {
      return;
    }

    const visualControlWheelBindings = [
      keybindings.zoomAdjust,
      keybindings.opacityAdjust,
    ];
    const activeWheelModifierState = {
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    };
    const wheelListenerOptions: AddEventListenerOptions = {
      passive: false,
      capture: true,
    };
    const keyboardListenerOptions: AddEventListenerOptions = {
      capture: true,
    };
    let isWheelListenerAttached = false;

    const handleWheelZoom = (event: WheelEvent) => {
      if (
        shouldExplorerZoomScopeOwnWheelGesture({
          event,
          binding: keybindings.zoomAdjust,
          target: event.target,
        })
      ) {
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

    const syncWheelModifierState = (
      event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
    ) => {
      activeWheelModifierState.ctrlKey = event.ctrlKey;
      activeWheelModifierState.metaKey = event.metaKey;
      activeWheelModifierState.altKey = event.altKey;
      activeWheelModifierState.shiftKey = event.shiftKey;
    };
    const attachWheelListener = () => {
      if (isWheelListenerAttached) {
        return;
      }
      window.addEventListener('wheel', handleWheelZoom, wheelListenerOptions);
      isWheelListenerAttached = true;
    };
    const detachWheelListener = () => {
      if (!isWheelListenerAttached) {
        return;
      }
      window.removeEventListener('wheel', handleWheelZoom, wheelListenerOptions);
      isWheelListenerAttached = false;
    };
    const syncWheelListenerAttachment = () => {
      if (shouldArmNonPassiveWheelHotkeyListener(
        activeWheelModifierState,
        visualControlWheelBindings,
      )) {
        attachWheelListener();
        return;
      }
      detachWheelListener();
    };
    const handleWheelShortcutKeyChange = (event: KeyboardEvent) => {
      syncWheelModifierState(event);
      syncWheelListenerAttachment();
    };
    const handleWheelShortcutBlur = () => {
      activeWheelModifierState.ctrlKey = false;
      activeWheelModifierState.metaKey = false;
      activeWheelModifierState.altKey = false;
      activeWheelModifierState.shiftKey = false;
      detachWheelListener();
    };

    // A permanent non-passive wheel listener forces WebView scrolling through JS.
    // Keep it armed only while a real visual-control wheel shortcut can fire.
    window.addEventListener('keydown', handleWheelShortcutKeyChange, keyboardListenerOptions);
    window.addEventListener('keyup', handleWheelShortcutKeyChange, keyboardListenerOptions);
    window.addEventListener('blur', handleWheelShortcutBlur);
    syncWheelListenerAttachment();
    return () => {
      detachWheelListener();
      window.removeEventListener('keydown', handleWheelShortcutKeyChange, keyboardListenerOptions);
      window.removeEventListener('keyup', handleWheelShortcutKeyChange, keyboardListenerOptions);
      window.removeEventListener('blur', handleWheelShortcutBlur);
    };
  }, [isOverlayVisible, isWindowedMode, keybindings.opacityAdjust, keybindings.zoomAdjust]);

  // ── Persist resize ──
  useEffect(() => {
    const stopResizeListener = bindDeferredUnlisten(getCurrentWindow().onResized(async ev => {
      if (
        currentHostUsesWaylandDockLayerShell
        || !isCurrentWindowPresentationHost
        || isProgrammaticResizeRef.current
        || !overlayVisibleRef.current
      ) {
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
          windowedHeight: Math.max(logH, panelWindowGeometry.minHeight),
          windowedWidth: Math.max(logW, panelWindowGeometry.minWidth),
        });
        return;
      }

      const position = await win.outerPosition().catch(() => runtimeOverlayBoundsRef.current ?? { x: 0, y: 0 });
      const currentBounds = {
        width: ev.payload.width,
        height: ev.payload.height,
        x: position.x,
        y: position.y,
      };
      const dockStore = useSettingsStore.getState().settings.dock;
      const nextOverlayHeight = Math.max(logH, overlayWindowGeometry.minHeight);
      const nextOverlayWidth = Math.max(logW, overlayWindowGeometry.minWidth);
      const nextGrid = estimateDockTerminalGridFromSize({
        edgeSize: nextOverlayHeight,
        edgeWidth: nextOverlayWidth,
        terminalFontSize: useSettingsStore.getState().settings.terminal.fontSize,
        dockTopBarHeight,
      });
      setDockResizeTelemetry({
        grid: nextGrid,
        edgeSize: nextOverlayHeight,
        edgeWidth: nextOverlayWidth,
        updatedAt: Date.now(),
      });
      if (dockResizeTelemetryHideTimerRef.current != null) {
        window.clearTimeout(dockResizeTelemetryHideTimerRef.current);
      }
      dockResizeTelemetryHideTimerRef.current = window.setTimeout(() => {
        dockResizeTelemetryHideTimerRef.current = null;
        setDockResizeTelemetry(null);
      }, 1400);
      if (dockStore.placementMode === 'floating') {
        isFreefloatingRef.current = true;
        runtimeOverlayBoundsRef.current = currentBounds;
        useSettingsStore.getState().updateDock({
          edgeSize: nextOverlayHeight,
          edgeWidth: nextOverlayWidth,
          defaultTerminalRows: nextGrid.rows,
          defaultTerminalColumns: nextGrid.columns,
          floatingBounds: currentBounds,
        });
        return;
      }

      isFreefloatingRef.current = false;
      runtimeOverlayBoundsRef.current = currentBounds;
      if (
        nextOverlayHeight !== dockStore.edgeSize ||
        nextOverlayWidth !== dockStore.edgeWidth ||
        nextGrid.rows !== dockStore.defaultTerminalRows ||
        nextGrid.columns !== dockStore.defaultTerminalColumns
      ) {
        useSettingsStore.getState().updateDock({
          edgeSize: nextOverlayHeight,
          edgeWidth: nextOverlayWidth,
          defaultTerminalRows: nextGrid.rows,
          defaultTerminalColumns: nextGrid.columns,
        });
      }
      if (dockResizeReanchorTimerRef.current != null) {
        window.clearTimeout(dockResizeReanchorTimerRef.current);
      }
      dockResizeReanchorTimerRef.current = window.setTimeout(() => {
        dockResizeReanchorTimerRef.current = null;
        void (async () => {
          const monitor = await resolvePreferredMonitor();
          if (!monitor || !overlayVisibleRef.current || windowModeRef.current !== 'overlay') {
            return;
          }
          await applyDockOverlayLayout({
            monitor,
            scaleFactor: await getCurrentWindow().scaleFactor().catch(() => factor),
            currentBounds: runtimeOverlayBoundsRef.current,
            isApplyCurrent: () => (
              overlayVisibleRef.current && windowModeRef.current === 'overlay'
            ),
          });
        })();
      }, 220);
    }), {
      onError: error => {
        console.warn('OverlayTerm: failed to manage presentation resize listener', error);
      },
    });
    return stopResizeListener;
  }, [
    applyDockOverlayLayout,
    currentHostUsesWaylandDockLayerShell,
    dockTopBarHeight,
    isCurrentWindowPresentationHost,
    resolvePreferredMonitor,
  ]);

  useEffect(() => {
    const stopMoveListener = bindDeferredUnlisten(getCurrentWindow().onMoved(async ev => {
      if (
        currentHostUsesWaylandDockLayerShell
        || !isCurrentWindowPresentationHost
        || isProgrammaticResizeRef.current
        || !overlayVisibleRef.current
        || windowModeRef.current !== 'overlay'
      ) {
        return;
      }
      const win = getCurrentWindow();
      const size = await win.outerSize().catch(() => runtimeOverlayBoundsRef.current ?? { width: 0, height: 0 });
      const currentBounds = {
        width: size.width,
        height: size.height,
        x: ev.payload.x,
        y: ev.payload.y,
      };
      const dockStore = useSettingsStore.getState().settings.dock;
      if (dockStore.placementMode === 'floating') {
        isFreefloatingRef.current = true;
        runtimeOverlayBoundsRef.current = currentBounds;
        useSettingsStore.getState().updateDock({
          floatingBounds: currentBounds,
        });
        return;
      }

      isFreefloatingRef.current = false;
      runtimeOverlayBoundsRef.current = currentBounds;
      const scaleFactor = await win.scaleFactor().catch(() => 1);
      const monitor = await resolvePreferredMonitor();
      if (monitor) {
        await applyDockOverlayLayout({
          monitor,
          scaleFactor,
          currentBounds,
          isApplyCurrent: () => (
            overlayVisibleRef.current && windowModeRef.current === 'overlay'
          ),
        });
      }
    }), {
      onError: error => {
        console.warn('OverlayTerm: failed to manage presentation move listener', error);
      },
    });
    return stopMoveListener;
  }, [applyDockOverlayLayout, currentHostUsesWaylandDockLayerShell, isCurrentWindowPresentationHost, resolvePreferredMonitor]);

  useEffect(() => () => {
    if (dockResizeReanchorTimerRef.current != null) {
      window.clearTimeout(dockResizeReanchorTimerRef.current);
      dockResizeReanchorTimerRef.current = null;
    }
    if (dockResizeTelemetryHideTimerRef.current != null) {
      window.clearTimeout(dockResizeTelemetryHideTimerRef.current);
      dockResizeTelemetryHideTimerRef.current = null;
    }
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
    queueExplorerTerminalDirectorySync({
      path,
      shell: settings.shell,
      source: 'open-terminal',
    });
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

  const refreshIconThemePackages = useCallback(async (force = false) => {
    if (!isTauri()) {
      const result = await discoverIconThemePackages();
      setIconThemePackages(result.packages);
      setIconThemePackagesError(null);
      setIconThemePackagesWarnings([]);
      setIconThemePackagesLoading(false);
      return;
    }

    if (force) {
      iconThemePackagesRefreshQueuedRef.current = true;
    }
    if (iconThemePackagesRefreshInFlightRef.current) {
      iconThemePackagesRefreshQueuedRef.current = true;
      return;
    }

    iconThemePackagesRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || iconThemePackagesRefreshQueuedRef.current;
        iconThemePackagesRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          iconThemePackagesSignatureRef.current = '';
        }

        setIconThemePackagesLoading(prev => prev && !nextForce);
        try {
          await ensureDir(iconThemeSystemConfig.iconThemesDirectory);
          const listed = await listExplorerDir(iconThemeSystemConfig.iconThemesDirectory, false);
          const nextSignature = listed
            .map(entry => `${entry.path}:${entry.modified}`)
            .sort()
            .join('|');

          if (!nextForce && nextSignature === iconThemePackagesSignatureRef.current) {
            setIconThemePackagesLoading(false);
            continue;
          }

          iconThemePackagesSignatureRef.current = nextSignature;
          const result = await discoverIconThemePackages();
          setIconThemePackages(result.packages);
          setIconThemePackagesError(result.sourceError);
          setIconThemePackagesWarnings(result.warnings);
        } catch (error) {
          setIconThemePackages([]);
          setIconThemePackagesError(String(error));
          setIconThemePackagesWarnings([]);
        } finally {
          setIconThemePackagesLoading(false);
        }
      } while (iconThemePackagesRefreshQueuedRef.current);
    } finally {
      iconThemePackagesRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshSoundPacks = useCallback(async (force = false) => {
    if (!isTauri()) {
      const result = await discoverSoundPacks();
      setSoundPacks(result.packs);
      setSoundPacksError(result.sourceError);
      setSoundPacksWarnings(result.warnings);
      setSoundPacksLoading(false);
      return;
    }

    if (force) {
      soundPacksRefreshQueuedRef.current = true;
    }
    if (soundPacksRefreshInFlightRef.current) {
      soundPacksRefreshQueuedRef.current = true;
      return;
    }

    soundPacksRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || soundPacksRefreshQueuedRef.current;
        soundPacksRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          soundPacksSignatureRef.current = '';
        }

        setSoundPacksLoading(prev => prev && !nextForce);
        try {
          await ensureDir(soundPackSystemConfig.soundPacksDirectory);
          const listed = await listExplorerDir(soundPackSystemConfig.soundPacksDirectory, false);
          const nextSignature = listed
            .map(entry => `${entry.path}:${entry.modified}`)
            .sort()
            .join('|');

          if (!nextForce && nextSignature === soundPacksSignatureRef.current) {
            setSoundPacksLoading(false);
            continue;
          }

          soundPacksSignatureRef.current = nextSignature;
          const result = await discoverSoundPacks();
          setSoundPacks(result.packs);
          setSoundPacksError(result.sourceError);
          setSoundPacksWarnings(result.warnings);
        } catch (error) {
          const fallbackResult = await discoverSoundPacks();
          setSoundPacks(fallbackResult.packs);
          setSoundPacksError(String(error));
          setSoundPacksWarnings(fallbackResult.warnings);
        } finally {
          setSoundPacksLoading(false);
        }
      } while (soundPacksRefreshQueuedRef.current);
    } finally {
      soundPacksRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshHomePacks = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredHomePacks([]);
      setHomePacksError(null);
      setHomePacksWarnings([]);
      setHomePacksLoading(false);
      return;
    }

    if (force) {
      homePacksRefreshQueuedRef.current = true;
    }
    if (homePacksRefreshInFlightRef.current) {
      homePacksRefreshQueuedRef.current = true;
      return;
    }

    homePacksRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || homePacksRefreshQueuedRef.current;
        homePacksRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          homePacksSignatureRef.current = '';
        }

        setHomePacksLoading((prev) => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('homePacks'));
          const nextSignature = await buildManagedContentDirectoryStackSignature('homePacks');

          if (!nextForce && nextSignature === homePacksSignatureRef.current) {
            setHomePacksLoading(false);
            continue;
          }

          homePacksSignatureRef.current = nextSignature;
          const result = await discoverExplorerHomePacks();
          setAuthoredHomePacks(result.packs);
          setHomePacksError(result.sourceError);
          setHomePacksWarnings(result.warnings);
        } catch (error) {
          setAuthoredHomePacks([]);
          setHomePacksError(String(error));
          setHomePacksWarnings([]);
        } finally {
          setHomePacksLoading(false);
        }
      } while (homePacksRefreshQueuedRef.current);
    } finally {
      homePacksRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshMenuPacks = useCallback(async (force = false) => {
    if (!isTauri()) {
      setMenuPacks([]);
      setMenuPacksError(null);
      setMenuPacksWarnings([]);
      setMenuPacksLoading(false);
      return;
    }

    if (force) {
      menuPacksRefreshQueuedRef.current = true;
    }
    if (menuPacksRefreshInFlightRef.current) {
      menuPacksRefreshQueuedRef.current = true;
      return;
    }

    menuPacksRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || menuPacksRefreshQueuedRef.current;
        menuPacksRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          menuPacksSignatureRef.current = '';
        }

        setMenuPacksLoading((prev) => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('menuPacks'));
          const nextSignature = await buildManagedContentDirectoryStackSignature('menuPacks');

          if (!nextForce && nextSignature === menuPacksSignatureRef.current) {
            setMenuPacksLoading(false);
            continue;
          }

          menuPacksSignatureRef.current = nextSignature;
          const result = await discoverExplorerMenuPacks();
          setMenuPacks(result.packs);
          setMenuPacksError(result.sourceError);
          setMenuPacksWarnings(result.warnings);
        } catch (error) {
          setMenuPacks([]);
          setMenuPacksError(String(error));
          setMenuPacksWarnings([]);
        } finally {
          setMenuPacksLoading(false);
        }
      } while (menuPacksRefreshQueuedRef.current);
    } finally {
      menuPacksRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshActionPacks = useCallback(async (force = false) => {
    if (!isTauri()) {
      setActionPacks([]);
      setActionPacksError(null);
      setActionPacksWarnings([]);
      setActionPacksLoading(false);
      return;
    }

    if (force) {
      actionPacksRefreshQueuedRef.current = true;
    }
    if (actionPacksRefreshInFlightRef.current) {
      actionPacksRefreshQueuedRef.current = true;
      return;
    }

    actionPacksRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || actionPacksRefreshQueuedRef.current;
        actionPacksRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          actionPacksSignatureRef.current = '';
        }

        setActionPacksLoading(prev => prev && !nextForce);
        try {
          await ensureDir(actionPackSystemConfig.actionsDirectory);
          const listed = await listExplorerDir(actionPackSystemConfig.actionsDirectory, false);
          const nextSignature = listed
            .map(entry => `${entry.path}:${entry.modified}`)
            .sort()
            .join('|');

          if (!nextForce && nextSignature === actionPacksSignatureRef.current) {
            setActionPacksLoading(false);
            continue;
          }

          actionPacksSignatureRef.current = nextSignature;
          const result = await discoverExplorerActionPacks();
          setActionPacks(result.packs);
          setActionPacksError(result.sourceError);
          setActionPacksWarnings(result.warnings);
        } catch (error) {
          setActionPacks([]);
          setActionPacksError(String(error));
          setActionPacksWarnings([]);
        } finally {
          setActionPacksLoading(false);
        }
      } while (actionPacksRefreshQueuedRef.current);
    } finally {
      actionPacksRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshThemePackages = useCallback(async (force = false) => {
    if (!isTauri()) {
      setThemePackages([]);
      setThemeContributedShaders([]);
      setThemeContributedAnimations([]);
      setThemePackagesError(null);
      setThemePackagesWarnings([]);
      setThemeBundleDependencyCatalogs(createEmptyGlobalThemeBundleCatalogs());
      setThemePackagesLoading(false);
      return;
    }

    if (force) {
      themePackagesRefreshQueuedRef.current = true;
    }
    if (themePackagesRefreshInFlightRef.current) {
      themePackagesRefreshQueuedRef.current = true;
      return;
    }

    themePackagesRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || themePackagesRefreshQueuedRef.current;
        themePackagesRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          themePackagesSignatureRef.current = '';
        }

        setThemePackagesLoading(prev => prev && !nextForce);
        try {
          await ensureDir(themeSystemConfig.themesDirectory);
          const listed = await listExplorerDir(themeSystemConfig.themesDirectory, false);
          const nextSignature = listed
            .map(entry => `${entry.path}:${entry.modified}`)
            .sort()
            .join('|');

          if (!nextForce && nextSignature === themePackagesSignatureRef.current) {
            setThemePackagesLoading(false);
            continue;
          }

          themePackagesSignatureRef.current = nextSignature;
          const result = await discoverThemePackages();
          setThemePackages(result.packages);
          setThemeContributedShaders(result.shaders);
          setThemeContributedAnimations(result.animations);
          setThemePackagesError(result.sourceError);
          setThemePackagesWarnings(result.warnings);
          setThemeBundleDependencyCatalogs(result.dependencyCatalogs);
        } catch (error) {
          setThemePackages([]);
          setThemeContributedShaders([]);
          setThemeContributedAnimations([]);
          setThemePackagesError(String(error));
          setThemePackagesWarnings([]);
          setThemeBundleDependencyCatalogs(createEmptyGlobalThemeBundleCatalogs());
        } finally {
          setThemePackagesLoading(false);
        }
      } while (themePackagesRefreshQueuedRef.current);
    } finally {
      themePackagesRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshTopBarPackages = useCallback(async (force = false) => {
    if (!isTauri()) {
      setTopBarPackages([]);
      setTopBarPackagesError(null);
      setTopBarPackagesWarnings([]);
      setTopBarPackagesLoading(false);
      return;
    }

    if (force) {
      topBarPackagesRefreshQueuedRef.current = true;
    }
    if (topBarPackagesRefreshInFlightRef.current) {
      topBarPackagesRefreshQueuedRef.current = true;
      return;
    }

    topBarPackagesRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || topBarPackagesRefreshQueuedRef.current;
        topBarPackagesRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          topBarPackagesSignatureRef.current = '';
        }

        setTopBarPackagesLoading(prev => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('topBars'));
          const nextSignature = await buildManagedContentDirectoryStackSignature('topBars');

          if (!nextForce && nextSignature === topBarPackagesSignatureRef.current) {
            setTopBarPackagesLoading(false);
            continue;
          }

          topBarPackagesSignatureRef.current = nextSignature;
          const result = await discoverTopBarPackages();
          setTopBarPackages(result.packages);
          setTopBarPackagesError(result.sourceError);
          setTopBarPackagesWarnings(result.warnings);
        } catch (error) {
          setTopBarPackages([]);
          setTopBarPackagesError(String(error));
          setTopBarPackagesWarnings([]);
        } finally {
          setTopBarPackagesLoading(false);
        }
      } while (topBarPackagesRefreshQueuedRef.current);
    } finally {
      topBarPackagesRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshDockPresentationPackages = useCallback(async (force = false) => {
    if (!isTauri()) {
      setDockPresentationPackages([]);
      setDockPresentationPackagesError(null);
      setDockPresentationPackagesWarnings([]);
      setDockPresentationPackagesLoading(false);
      return;
    }

    if (force) {
      dockPresentationPackagesRefreshQueuedRef.current = true;
    }
    if (dockPresentationPackagesRefreshInFlightRef.current) {
      dockPresentationPackagesRefreshQueuedRef.current = true;
      return;
    }

    dockPresentationPackagesRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || dockPresentationPackagesRefreshQueuedRef.current;
        dockPresentationPackagesRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          dockPresentationPackagesSignatureRef.current = '';
        }

        setDockPresentationPackagesLoading(prev => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('dockPresentations'));
          const nextSignature = await buildManagedContentDirectoryStackSignature(
            'dockPresentations',
          );

          if (!nextForce && nextSignature === dockPresentationPackagesSignatureRef.current) {
            setDockPresentationPackagesLoading(false);
            continue;
          }

          dockPresentationPackagesSignatureRef.current = nextSignature;
          const result = await discoverDockPresentationPackages();
          setDockPresentationPackages(result.packages);
          setDockPresentationPackagesError(result.sourceError);
          setDockPresentationPackagesWarnings(result.warnings);
        } catch (error) {
          setDockPresentationPackages([]);
          setDockPresentationPackagesError(String(error));
          setDockPresentationPackagesWarnings([]);
        } finally {
          setDockPresentationPackagesLoading(false);
        }
      } while (dockPresentationPackagesRefreshQueuedRef.current);
    } finally {
      dockPresentationPackagesRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshExplorerLayoutPackages = useCallback(async (force = false) => {
    if (!isTauri()) {
      setExplorerLayoutPackages([]);
      setExplorerLayoutPackagesError(null);
      setExplorerLayoutPackagesWarnings([]);
      setExplorerLayoutPackagesLoading(false);
      return;
    }

    if (force) {
      explorerLayoutPackagesRefreshQueuedRef.current = true;
    }
    if (explorerLayoutPackagesRefreshInFlightRef.current) {
      explorerLayoutPackagesRefreshQueuedRef.current = true;
      return;
    }

    explorerLayoutPackagesRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || explorerLayoutPackagesRefreshQueuedRef.current;
        explorerLayoutPackagesRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          explorerLayoutPackagesSignatureRef.current = '';
        }

        setExplorerLayoutPackagesLoading(prev => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('explorerLayouts'));
          const nextSignature = await buildManagedContentDirectoryStackSignature(
            'explorerLayouts',
          );

          if (!nextForce && nextSignature === explorerLayoutPackagesSignatureRef.current) {
            setExplorerLayoutPackagesLoading(false);
            continue;
          }

          explorerLayoutPackagesSignatureRef.current = nextSignature;
          const result = await discoverExplorerLayoutPackages();
          setExplorerLayoutPackages(result.packages);
          setExplorerLayoutPackagesError(result.sourceError);
          setExplorerLayoutPackagesWarnings(result.warnings);
        } catch (error) {
          setExplorerLayoutPackages([]);
          setExplorerLayoutPackagesError(String(error));
          setExplorerLayoutPackagesWarnings([]);
        } finally {
          setExplorerLayoutPackagesLoading(false);
        }
      } while (explorerLayoutPackagesRefreshQueuedRef.current);
    } finally {
      explorerLayoutPackagesRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshExplorerViews = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredExplorerViews([]);
      setExplorerViewsError(null);
      setExplorerViewsWarnings([]);
      setExplorerViewsLoading(false);
      return;
    }

    if (force) {
      explorerViewsRefreshQueuedRef.current = true;
    }
    if (explorerViewsRefreshInFlightRef.current) {
      explorerViewsRefreshQueuedRef.current = true;
      return;
    }

    explorerViewsRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || explorerViewsRefreshQueuedRef.current;
        explorerViewsRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          explorerViewsSignatureRef.current = '';
        }

        setExplorerViewsLoading(prev => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('explorerViews'));
          const nextSignature = await buildManagedContentDirectoryStackSignature(
            'explorerViews',
          );

          if (!nextForce && nextSignature === explorerViewsSignatureRef.current) {
            setExplorerViewsLoading(false);
            continue;
          }

          explorerViewsSignatureRef.current = nextSignature;
          const result = await discoverManagedExplorerViews();
          setAuthoredExplorerViews(result.packages);
          setExplorerViewsError(result.sourceError);
          setExplorerViewsWarnings(result.warnings);
        } catch (error) {
          setAuthoredExplorerViews([]);
          setExplorerViewsError(String(error));
          setExplorerViewsWarnings([]);
        } finally {
          setExplorerViewsLoading(false);
        }
      } while (explorerViewsRefreshQueuedRef.current);
    } finally {
      explorerViewsRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshExplorerWidgets = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredExplorerWidgets([]);
      setExplorerWidgetsError(null);
      setExplorerWidgetsWarnings([]);
      setExplorerWidgetsLoading(false);
      return;
    }

    if (force) {
      explorerWidgetsRefreshQueuedRef.current = true;
    }
    if (explorerWidgetsRefreshInFlightRef.current) {
      explorerWidgetsRefreshQueuedRef.current = true;
      return;
    }

    explorerWidgetsRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || explorerWidgetsRefreshQueuedRef.current;
        explorerWidgetsRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          explorerWidgetsSignatureRef.current = '';
        }

        setExplorerWidgetsLoading(prev => prev && !nextForce);
        try {
          await ensureDir(getManagedContentPrimaryDirectory('explorerWidgets'));
          const nextSignature = await buildManagedContentDirectoryStackSignature(
            'explorerWidgets',
          );

          if (!nextForce && nextSignature === explorerWidgetsSignatureRef.current) {
            setExplorerWidgetsLoading(false);
            continue;
          }

          explorerWidgetsSignatureRef.current = nextSignature;
          const result = await discoverManagedExplorerWidgets();
          setAuthoredExplorerWidgets(result.packages);
          setExplorerWidgetsError(result.sourceError);
          setExplorerWidgetsWarnings(result.warnings);
        } catch (error) {
          setAuthoredExplorerWidgets([]);
          setExplorerWidgetsError(String(error));
          setExplorerWidgetsWarnings([]);
        } finally {
          setExplorerWidgetsLoading(false);
        }
      } while (explorerWidgetsRefreshQueuedRef.current);
    } finally {
      explorerWidgetsRefreshInFlightRef.current = false;
    }
  }, []);

  const refreshLookdevPresets = useCallback(async (force = false) => {
    const lookdevStore = useLookdevStore.getState();
    if (!isTauri()) {
      lookdevStore.setCatalogState({
        presets: [],
        presetsDirectory: lookdevPresetSystemConfig.presetsDirectory,
        presetsLoading: false,
        presetsError: null,
        presetsWarnings: [],
      });
      return;
    }

    if (force) {
      lookdevPresetsRefreshQueuedRef.current = true;
    }
    if (lookdevPresetsRefreshInFlightRef.current) {
      lookdevPresetsRefreshQueuedRef.current = true;
      return;
    }

    lookdevPresetsRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || lookdevPresetsRefreshQueuedRef.current;
        lookdevPresetsRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          lookdevPresetsSignatureRef.current = '';
        }

        lookdevStore.setCatalogState({ presetsLoading: true });
        try {
          await ensureDir(getManagedContentPrimaryDirectory('lookdevPresets'));
          const nextSignature = await buildManagedContentDirectoryStackSignature('lookdevPresets');

          if (!nextForce && nextSignature === lookdevPresetsSignatureRef.current) {
            lookdevStore.setCatalogState({ presetsLoading: false });
            continue;
          }

          lookdevPresetsSignatureRef.current = nextSignature;
          const result = await loadLookdevPresets();
          lookdevStore.setCatalogState({
            presets: result.presets,
            presetsDirectory: result.directory,
            presetsError: result.sourceError,
            presetsWarnings: result.warnings,
          });

          const refreshedState = useLookdevStore.getState();
          const nextSelectedPresetId = refreshedState.selectedPresetId
            && result.presets.some((preset) => preset.id === refreshedState.selectedPresetId)
            ? refreshedState.selectedPresetId
            : (result.presets[0]?.id ?? null);
          if (refreshedState.selectedPresetId !== nextSelectedPresetId) {
            refreshedState.setSelectedPresetId(nextSelectedPresetId);
          }
          if (
            refreshedState.activeAppliedPresetId
            && !result.presets.some((preset) => preset.id === refreshedState.activeAppliedPresetId)
          ) {
            refreshedState.clearActiveAppliedPresetId();
          }
        } catch (error) {
          lookdevStore.setCatalogState({
            presets: [],
            presetsDirectory: lookdevPresetSystemConfig.presetsDirectory,
            presetsError: String(error),
            presetsWarnings: [],
          });
        } finally {
          lookdevStore.setCatalogState({ presetsLoading: false });
        }
      } while (lookdevPresetsRefreshQueuedRef.current);
    } finally {
      lookdevPresetsRefreshInFlightRef.current = false;
    }
  }, []);

  usrProfileContentRefreshCallbacksRef.current = {
    refreshTopBarPackages,
    refreshDockPresentationPackages,
    refreshExplorerLayoutPackages,
    refreshExplorerWidgets,
    refreshHomePacks,
    refreshLookdevPresets,
    refreshMenuPacks,
    refreshFolderPlugins,
  };

  useEffect(() => {
    if (!hasAppliedUsrProfileRefreshRef.current) {
      hasAppliedUsrProfileRefreshRef.current = true;
      return;
    }

    if (usrProfileContentRefreshTimerRef.current !== null) {
      window.clearTimeout(usrProfileContentRefreshTimerRef.current);
    }

    usrProfileContentRefreshTimerRef.current = window.setTimeout(() => {
      usrProfileContentRefreshTimerRef.current = null;
      const callbacks = usrProfileContentRefreshCallbacksRef.current;
      if (!callbacks) {
        return;
      }

      void Promise.all([
        callbacks.refreshTopBarPackages(false),
        callbacks.refreshDockPresentationPackages(false),
        callbacks.refreshExplorerLayoutPackages(false),
        callbacks.refreshExplorerWidgets(false),
        callbacks.refreshHomePacks(false),
        callbacks.refreshLookdevPresets(false),
        callbacks.refreshMenuPacks(false),
        callbacks.refreshFolderPlugins(false),
      ]);
    }, 0);

    return () => {
      if (usrProfileContentRefreshTimerRef.current !== null) {
        window.clearTimeout(usrProfileContentRefreshTimerRef.current);
        usrProfileContentRefreshTimerRef.current = null;
      }
    };
  }, [usrProfileRuntimeRevision]);

  const refreshTopBarCatalog = useCallback(async () => {
    await Promise.all([
      refreshTopBarPackages(true),
      refreshThemePackages(true),
    ]);
  }, [refreshThemePackages, refreshTopBarPackages]);

  const refreshSoundPackCatalog = useCallback(async () => {
    await Promise.all([
      refreshSoundPacks(true),
      refreshThemePackages(true),
    ]);
  }, [refreshSoundPacks, refreshThemePackages]);

  const openManagedContentDirectory = useCallback(async (directoryId: ManagedContentDirectoryId) => {
    if (!isTauri()) {
      return;
    }

    const directoryPath = getManagedContentPrimaryDirectory(directoryId);
    await ensureDir(directoryPath);
    await openExplorerPath(directoryPath);
  }, []);

  const openIconThemesFolder = useCallback(async () => {
    await openManagedContentDirectory('iconThemes');
  }, [openManagedContentDirectory]);

  const openSoundPacksFolder = useCallback(async () => {
    await openManagedContentDirectory('soundPacks');
  }, [openManagedContentDirectory]);

  const openHomePacksFolder = useCallback(async () => {
    await openManagedContentDirectory('homePacks');
  }, [openManagedContentDirectory]);

  const openMenuPacksFolder = useCallback(async () => {
    await openManagedContentDirectory('menuPacks');
  }, [openManagedContentDirectory]);

  const openActionsFolder = useCallback(async () => {
    await openManagedContentDirectory('actions');
  }, [openManagedContentDirectory]);

  const openThemesFolder = useCallback(async () => {
    await openManagedContentDirectory('themes');
  }, [openManagedContentDirectory]);

  const openAppearancePacksFolder = useCallback(async () => {
    await openManagedContentDirectory('appearancePacks');
  }, [openManagedContentDirectory]);

  const openTopBarsFolder = useCallback(async () => {
    await openManagedContentDirectory('topBars');
  }, [openManagedContentDirectory]);

  const openInteractionMotionPacksFolder = useCallback(async () => {
    await openManagedContentDirectory('interactionMotionPacks');
  }, [openManagedContentDirectory]);

  const openAnimationsFolder = useCallback(async () => {
    await openManagedContentDirectory('animations');
  }, [openManagedContentDirectory]);

  const openShadersFolder = useCallback(async () => {
    await openManagedContentDirectory('shaders');
  }, [openManagedContentDirectory]);

  const openWallpapersFolder = useCallback(async () => {
    await openManagedContentDirectory('wallpapers');
  }, [openManagedContentDirectory]);

  const openShellRenderersFolder = useCallback(async () => {
    await openManagedContentDirectory('shellRenderers');
  }, [openManagedContentDirectory]);

  const openThemeRecipesFolder = useCallback(async () => {
    await openManagedContentDirectory('themeRecipes');
  }, [openManagedContentDirectory]);

  const openThemeEnginesFolder = useCallback(async () => {
    await openManagedContentDirectory('themeEngines');
  }, [openManagedContentDirectory]);

  const openUsrProfilesRootFolder = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    const profilesRoot = getUsrProfileRuntimeSnapshot()?.profilesRoot;
    if (!profilesRoot) {
      return;
    }

    await ensureDir(profilesRoot);
    await openExplorerPath(profilesRoot);
  }, []);

  const openUsrProfileFolder = useCallback(async (profileId: string) => {
    if (!isTauri()) {
      return;
    }

    const snapshot = getUsrProfileRuntimeSnapshot();
    const profile = snapshot?.profiles.find((entry) => entry.id === profileId);
    if (!profile) {
      return;
    }

    await ensureDir(profile.directoryPath);
    await openExplorerPath(profile.directoryPath);
  }, []);

  const handleSwitchUsrProfile = useCallback(async (profileId: string) => {
    await switchUsrProfile(profileId, useSettingsStore.getState().settings);
  }, []);

  const handleCreateUsrProfile = useCallback(async (
    name: string,
    seedSettingsJson?: string | null,
  ) => {
    await createUsrProfile({
      name,
      activate: true,
      seedSettingsJson:
        typeof seedSettingsJson === 'string' && seedSettingsJson.trim().length > 0
          ? seedSettingsJson
          : JSON.stringify(useSettingsStore.getState().settings),
    });
  }, []);

  const handleCreateUsrProfileFromVariant = useCallback(async (
    variantId: string,
    name: string,
  ) => {
    const variant = getUsrProfileSettingsVariant(variantId);
    if (!variant) {
      return;
    }

    const seededSettings = mergeSettingsWithDefaults(
      buildUsrProfileSettingsVariantOverrides(variant),
    );
    await createUsrProfile({
      name,
      activate: true,
      seedSettingsJson: JSON.stringify(seededSettings),
    });
  }, []);

  const handleDuplicateUsrProfile = useCallback(
    async (profileId: string, name: string) => {
      await duplicateUsrProfile({
        sourceProfileId: profileId,
        name,
        activate: true,
        currentSettings: useSettingsStore.getState().settings,
      });
    },
    [],
  );

  const handleRenameUsrProfile = useCallback(
    async (profileId: string, name: string) => {
      await renameUsrProfile({ profileId, name });
    },
    [],
  );

  const handleDeleteUsrProfile = useCallback(
    async (profileId: string) => {
      const snapshot = getUsrProfileRuntimeSnapshot();
      const fallbackProfileId =
        snapshot?.profiles.find((profile) => profile.id !== profileId)?.id ?? null;
      await deleteUsrProfile({
        profileId,
        fallbackProfileId,
      });
    },
    [],
  );

  const refreshAuthoredWallpapers = useCallback(async (force = false) => {
    if (!isTauri()) {
      setAuthoredWallpapers([]);
      setAuthoredWallpapersError(null);
      setAuthoredWallpapersLoading(false);
      return;
    }

    if (force) {
      authoredWallpapersRefreshQueuedRef.current = true;
    }
    if (authoredWallpapersRefreshInFlightRef.current) {
      authoredWallpapersRefreshQueuedRef.current = true;
      return;
    }

    authoredWallpapersRefreshInFlightRef.current = true;
    try {
      do {
        const nextForce = force || authoredWallpapersRefreshQueuedRef.current;
        authoredWallpapersRefreshQueuedRef.current = false;
        force = false;

        if (nextForce) {
          wallpaperSignatureRef.current = '';
        }

        setAuthoredWallpapersLoading(prev => prev && !nextForce);
        setAuthoredWallpapersError(null);
        try {
          await ensureDir(wallpaperSystemConfig.wallpapersDirectory);
          const listed = await listExplorerDir(wallpaperSystemConfig.wallpapersDirectory, false);
          const files = listed
            .filter(file => isFrontendWallpaperFile(file) || isMediaWallpaperFile(file))
            .sort((left, right) => left.name.localeCompare(right.name));
          const nextSignature = files.map(file => `${file.path}:${file.modified}`).join('|');

          if (!nextForce && nextSignature === wallpaperSignatureRef.current) {
            setAuthoredWallpapersLoading(false);
            continue;
          }

          wallpaperSignatureRef.current = nextSignature;
          const loaded = await Promise.all(files.map(async file => {
            if (isMediaWallpaperFile(file)) {
              return createMediaWallpaperFromFile(file);
            }

            const source = await commands.fsReadTextFile(file.path).then(unwrapTauriResult);
            return loadWallpaperFromSource(source, file);
          }));

          setAuthoredWallpapers(loaded);
        } catch (error) {
          setAuthoredWallpapers([]);
          setAuthoredWallpapersError(String(error));
        } finally {
          setAuthoredWallpapersLoading(false);
        }
      } while (authoredWallpapersRefreshQueuedRef.current);
    } finally {
      authoredWallpapersRefreshInFlightRef.current = false;
    }
  }, []);

  const importWallpaperFiles = useCallback(async (files: File[]) => {
    if (!isTauri() || files.length === 0) {
      return;
    }

    await ensureDir(wallpaperSystemConfig.wallpapersDirectory);
    await Promise.all(files.map(async (file, index) => {
      const timestamp = `${Date.now()}-${index}`;
      const safeFileName = sanitizeImportedWallpaperFileName(file.name);
      const targetPath = joinPlatformPath(
        wallpaperSystemConfig.wallpapersDirectory,
        `${timestamp}-${safeFileName}`,
        runtimePlatform,
      );
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      await writeExplorerFile(targetPath, bytes);
    }));
    await refreshAuthoredWallpapers(true);
  }, [refreshAuthoredWallpapers, runtimePlatform]);

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
    if (!isOverlayVisible) {
      return;
    }
    void refreshAuthoredWallpapers(true);
  }, [isOverlayVisible, refreshAuthoredWallpapers]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !animationSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshAuthoredAnimations();
    }, animationSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshAuthoredAnimations]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !shaderSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshAuthoredShaders();
    }, shaderSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshAuthoredShaders]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !wallpaperSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshAuthoredWallpapers();
    }, wallpaperSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshAuthoredWallpapers]);

  useEffect(() => {
    void refreshIconThemePackages(true);
  }, [refreshIconThemePackages]);

  useEffect(() => {
    void refreshSoundPacks(true);
  }, [refreshSoundPacks]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !iconThemeSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshIconThemePackages();
    }, iconThemeSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshIconThemePackages]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !soundPackSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSoundPacks();
    }, soundPackSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshSoundPacks]);

  useEffect(() => {
    void refreshHomePacks(true);
  }, [refreshHomePacks]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !homePackSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshHomePacks();
    }, homePackSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshHomePacks]);

  useEffect(() => {
    void refreshMenuPacks(true);
  }, [refreshMenuPacks]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !menuPackSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshMenuPacks();
    }, menuPackSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshMenuPacks]);

  useEffect(() => {
    void refreshActionPacks(true);
  }, [refreshActionPacks]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !actionPackSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshActionPacks();
    }, actionPackSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshActionPacks]);

  useEffect(() => {
    void refreshThemePackages(true);
  }, [refreshThemePackages]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !themeSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshThemePackages();
    }, themeSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshThemePackages]);

  useEffect(() => {
    void refreshTopBarPackages(true);
  }, [refreshTopBarPackages]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !topBarSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshTopBarPackages();
    }, topBarSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshTopBarPackages]);

  useEffect(() => {
    void refreshDockPresentationPackages(true);
  }, [refreshDockPresentationPackages]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !dockPresentationSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshDockPresentationPackages();
    }, dockPresentationSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshDockPresentationPackages]);

  useEffect(() => {
    void refreshExplorerLayoutPackages(true);
  }, [refreshExplorerLayoutPackages]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !explorerLayoutSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshExplorerLayoutPackages();
    }, explorerLayoutSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshExplorerLayoutPackages]);

  useEffect(() => {
    void refreshExplorerViews(true);
  }, [refreshExplorerViews]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !explorerViewSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshExplorerViews();
    }, explorerViewSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshExplorerViews]);

  useEffect(() => {
    void refreshExplorerWidgets(true);
  }, [refreshExplorerWidgets]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !explorerWidgetSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshExplorerWidgets();
    }, explorerWidgetSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshExplorerWidgets]);

  useEffect(() => {
    void refreshLookdevPresets(true);
  }, [refreshLookdevPresets]);

  useEffect(() => {
    if (!isOverlayVisible || !liveReloadEnabled || !lookdevPresetSystemConfig.runtimeAssetPollingEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshLookdevPresets();
    }, lookdevPresetSystemConfig.scanIntervalMs);

    return () => window.clearInterval(interval);
  }, [isOverlayVisible, liveReloadEnabled, refreshLookdevPresets]);

  const panelDefinitions: OverlayPanelDefinition[] = useMemo(
    () => [
      ...createBuiltInPanelDefinitions({
        appearance: resolvedAppearance,
        explorerChromeControlSurface: 'toolbar',
        explorerLayoutMode: explorerPanelLayoutMode,
        explorerDockPreviewPolicy: resolvedDockPresentation.previewPolicy,
        explorerDefaultModeProfileId,
        explorerShellDefaultLayoutId,
        explorerPicker: activeExplorerPickerRequest,
        isOpen: isOverlayVisible,
        hideOverlay,
        pluginCommands,
        actionPacks: combinedActionPacks,
        actions: combinedExplorerActions,
        pluginExplorerActions,
        pluginContextMenuItems,
        pluginExplorerActivityLanes,
        pluginExplorerViews,
        pluginExplorerWidgets,
        pluginPreviewLanes,
        pluginSettingsSlots,
        pluginWorkflows,
        pluginsLoading: folderPluginsLoading,
        pluginsError: folderPluginsError,
        onRefreshPlugins: refreshFolderPlugins,
        onOpenPluginsFolder: openPluginsFolder,
        onOpenInTerminal: handleOpenInTerminal,
        onOpenInFilesystemAquarium: handleOpenInFilesystemAquarium,
        onAddBookmark: handleAddBookmark,
        onRequestRepositoryImport: handleRequestRepositoryImport,
        pendingRepositoryImports,
        onPendingRepositoryImportsHandled: handleRepositoryImportsHandled,
        topBarPackages,
        topBarPackagesDirectory: getManagedContentPrimaryDirectory('topBars'),
        topBarPackagesLoading,
        topBarPackagesError,
        topBarPackagesWarnings,
        usrProfileRuntimeSnapshot,
        usrProfileSettingSliceKeys: getUsrProfileSettingSliceKeys(),
        usrProfileSharedSettingSliceKeys: getUsrProfileSharedSettingSliceKeys(),
        usrProfileSettingsVariants,
        kainUiGraph,
        kainUiGraphError,
        kainManifest,
        kainManifestError,
        kainUiScaffold,
        kainUiScaffoldError,
        kainLatticeCatalog,
        kainLatticeCatalogError,
        kainFfiCatalog,
        kainFfiCatalogError,
        onSwitchUsrProfile: handleSwitchUsrProfile,
        onCreateUsrProfile: handleCreateUsrProfile,
        onCreateUsrProfileFromVariant: handleCreateUsrProfileFromVariant,
        onDuplicateUsrProfile: handleDuplicateUsrProfile,
        onRenameUsrProfile: handleRenameUsrProfile,
        onDeleteUsrProfile: handleDeleteUsrProfile,
        onOpenUsrProfilesRootFolder: openUsrProfilesRootFolder,
        onOpenUsrProfileFolder: openUsrProfileFolder,
        dockPresentationPackages,
        dockPresentationPackagesDirectory: getManagedContentPrimaryDirectory('dockPresentations'),
        dockPresentationPackagesLoading,
        dockPresentationPackagesError,
        dockPresentationPackagesWarnings,
        explorerLayouts: combinedExplorerLayouts,
        explorerViews: authoredExplorerViews,
        explorerWidgets: authoredExplorerWidgets,
        explorerLayoutsDirectory: getManagedContentPrimaryDirectory('explorerLayouts'),
        explorerLayoutsLoading: explorerLayoutPackagesLoading,
        explorerLayoutsError: explorerLayoutPackagesError,
        explorerLayoutsWarnings: explorerLayoutPackagesWarnings,
        explorerWidgetsDirectory: getManagedContentPrimaryDirectory('explorerWidgets'),
        explorerWidgetsLoading,
        explorerWidgetsError,
        explorerWidgetsWarnings,
        homePacks: combinedHomePacks,
        menuPacks: combinedMenuPacks,
        actionsDirectory: actionPackSystemConfig.actionsDirectory,
        homePacksDirectory: getManagedContentPrimaryDirectory('homePacks'),
        menuPacksDirectory: getManagedContentPrimaryDirectory('menuPacks'),
        actionsLoading: actionPacksLoading,
        homePacksLoading,
        menuPacksLoading,
        actionsError: actionPacksError,
        homePacksError,
        menuPacksError,
        actionsWarnings: actionPacksWarnings,
        homePacksWarnings,
        menuPacksWarnings,
        themePackages: combinedThemePackages,
        themePackagesDirectory: themeSystemConfig.themesDirectory,
        themePackagesLoading,
        themePackagesError,
        themePackagesWarnings,
        appearancePacks: themeBundleDependencyCatalogs.appearancePacks,
        appearancePacksDirectory: getManagedContentDirectory('appearancePacks'),
        appearancePacksLoading: themePackagesLoading,
        appearancePacksError: themePackagesError,
        appearancePacksWarnings: themeBundleDependencyCatalogs.warnings,
        interactionMotionPacks: themeBundleDependencyCatalogs.interactionMotionPacks,
        interactionMotionPacksDirectory: getManagedContentDirectory('interactionMotionPacks'),
        interactionMotionPacksLoading: themePackagesLoading,
        interactionMotionPacksError: themePackagesError,
        interactionMotionPacksWarnings: themeBundleDependencyCatalogs.warnings,
        shellRenderers: themeBundleDependencyCatalogs.shellRenderers,
        shellRenderersDirectory: getManagedContentDirectory('shellRenderers'),
        shellRenderersLoading: themePackagesLoading,
        shellRenderersError: themePackagesError,
        shellRenderersWarnings: themeBundleDependencyCatalogs.warnings,
        themeRecipePacks: themeBundleDependencyCatalogs.themeRecipePacks,
        themeRecipePacksDirectory: getManagedContentDirectory('themeRecipes'),
        themeRecipePacksLoading: themePackagesLoading,
        themeRecipePacksError: themePackagesError,
        themeRecipePacksWarnings: themeBundleDependencyCatalogs.warnings,
        themeEnginePacks: themeBundleDependencyCatalogs.themeEnginePacks,
        themeEnginePacksDirectory: getManagedContentDirectory('themeEngines'),
        themeEnginePacksLoading: themePackagesLoading,
        themeEnginePacksError: themePackagesError,
        themeEnginePacksWarnings: themeBundleDependencyCatalogs.warnings,
        onRefreshTopBars: refreshTopBarCatalog,
        onOpenTopBarsFolder: openTopBarsFolder,
        onRefreshDockPresentations: () => refreshDockPresentationPackages(true),
        onOpenDockPresentationsFolder: () => openManagedContentDirectory('dockPresentations'),
        onRefreshActions: () => refreshActionPacks(true),
        onOpenActionsFolder: openActionsFolder,
        onRefreshHomePacks: () => refreshHomePacks(true),
        onRefreshMenuPacks: () => refreshMenuPacks(true),
        onOpenHomePacksFolder: openHomePacksFolder,
        onOpenMenuPacksFolder: openMenuPacksFolder,
        onRefreshAppearancePacks: refreshThemePackages,
        onOpenAppearancePacksFolder: openAppearancePacksFolder,
        onRefreshInteractionMotionPacks: refreshThemePackages,
        onOpenInteractionMotionPacksFolder: openInteractionMotionPacksFolder,
        onRefreshShellRenderers: refreshThemePackages,
        onOpenShellRenderersFolder: openShellRenderersFolder,
        onRefreshThemeRecipePacks: refreshThemePackages,
        onOpenThemeRecipesFolder: openThemeRecipesFolder,
        onRefreshThemeEnginePacks: refreshThemePackages,
        onOpenThemeEnginesFolder: openThemeEnginesFolder,
        iconThemePackages,
        iconThemePackagesDirectory: iconThemeSystemConfig.iconThemesDirectory,
        iconThemePackagesLoading,
        iconThemePackagesError,
        iconThemePackagesWarnings,
        soundPacks,
        soundPacksDirectory: soundPackSystemConfig.soundPacksDirectory,
        soundPacksLoading,
        soundPacksError,
        soundPacksWarnings,
        onRefreshThemes: refreshThemePackages,
        onOpenThemesFolder: openThemesFolder,
        onRefreshIconThemes: () => refreshIconThemePackages(true),
        onOpenIconThemesFolder: openIconThemesFolder,
        onRefreshSoundPacks: refreshSoundPackCatalog,
        onOpenSoundPacksFolder: openSoundPacksFolder,
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
        wallpapers: availableWallpapers,
        wallpaperDiagnostics: authoredWallpapers.filter(wallpaper => Boolean(wallpaper.error)),
        wallpapersDirectory: wallpaperSystemConfig.wallpapersDirectory,
        wallpapersLoading: authoredWallpapersLoading,
        wallpapersError: authoredWallpapersError,
        onRefreshWallpapers: () => refreshAuthoredWallpapers(true),
        onOpenWallpapersFolder: openWallpapersFolder,
        onImportWallpaperFiles: importWallpaperFiles,
        onSetWindowMode: requestWindowModeChange,
        onActivatePanel: (panelId) => activatePanelRef.current(panelId),
        onOpenSettingsSection: (section) => openSettingsSectionRef.current(section),
        onExplorerPickerConfirm: handleEmbeddedExplorerPickerConfirm,
        onExplorerPickerCancel: handleEmbeddedExplorerPickerCancel,
        renderPluginsManager: () => (
          <PluginsManager
            appearance={resolvedAppearance}
            plugins={folderPlugins}
            previewLanes={pluginPreviewLanes}
            isLoading={folderPluginsLoading}
            error={folderPluginsError}
            onRefreshPlugins={() => refreshFolderPlugins(true)}
            onOpenPluginsFolder={openPluginsFolder}
            onOpenPackagesFolder={openPackagesFolder}
            onSetPluginEnabled={(plugin, enabled) => {
              setPluginEnabled(plugin.enablementKey ?? plugin.id, enabled);
            }}
            createPluginApi={createPluginApi}
          />
        ),
      }),
      ...createFolderPluginPanelDefinitions({
        appearance: resolvedAppearance,
        plugins: enabledFolderPlugins,
        createPluginApi,
      }),
    ],
    [
      createPluginApi,
      enabledFolderPlugins,
      folderPlugins,
      folderPluginsError,
      folderPluginsLoading,
      handleAddBookmark,
      handleEmbeddedExplorerPickerCancel,
      handleEmbeddedExplorerPickerConfirm,
      handleOpenInTerminal,
      handleOpenInFilesystemAquarium,
      handleCreateUsrProfile,
      handleDeleteUsrProfile,
      handleDuplicateUsrProfile,
      handleRepositoryImportsHandled,
      handleRequestRepositoryImport,
      handleRenameUsrProfile,
      handleSwitchUsrProfile,
      hideOverlay,
      isOverlayVisible,
      activeExplorerPickerRequest,
      authoredAnimations,
      authoredAnimationsError,
      authoredAnimationsLoading,
      authoredShaders,
      authoredShadersError,
      authoredShadersLoading,
      authoredWallpapers,
      authoredWallpapersError,
      authoredWallpapersLoading,
      availableAnimations,
      availableWallpapers,
      availableShaders,
      actionPacksError,
      actionPacksLoading,
      actionPacksWarnings,
      combinedActionPacks,
      combinedExplorerLayouts,
      combinedExplorerActions,
      combinedHomePacks,
      authoredExplorerViews,
      authoredExplorerWidgets,
      explorerWidgetsError,
      explorerWidgetsLoading,
      explorerWidgetsWarnings,
      pluginContributedShaders,
      pluginCommands,
      pluginActionPacks,
      pluginActions,
      pluginExplorerActions,
      pluginContextMenuItems,
      pluginExplorerActivityLanes,
      pluginExplorerViews,
      pluginExplorerWidgets,
      pluginPreviewLanes,
      openAnimationsFolder,
      openAppearancePacksFolder,
      openActionsFolder,
      openHomePacksFolder,
      openInteractionMotionPacksFolder,
      openMenuPacksFolder,
      openPackagesFolder,
      openShellRenderersFolder,
      openShadersFolder,
      openThemeEnginesFolder,
      openThemeRecipesFolder,
      openUsrProfileFolder,
      openUsrProfilesRootFolder,
      openPluginsFolder,
      openTopBarsFolder,
      openWallpapersFolder,
      openIconThemesFolder,
      openThemesFolder,
      openManagedContentDirectory,
      pendingRepositoryImports,
      refreshIconThemePackages,
      refreshTopBarCatalog,
      topBarPackages,
      topBarPackagesError,
      topBarPackagesLoading,
      topBarPackagesWarnings,
      dockPresentationPackages,
      dockPresentationPackagesError,
      dockPresentationPackagesLoading,
      dockPresentationPackagesWarnings,
      refreshActionPacks,
      refreshDockPresentationPackages,
      refreshThemePackages,
      refreshAuthoredAnimations,
      refreshAuthoredWallpapers,
      refreshAuthoredShaders,
      refreshFolderPlugins,
      requestWindowModeChange,
      resolvedDockPresentation.previewPolicy,
      resolvedAppearance,
      setPluginEnabled,
      combinedThemePackages,
      combinedMenuPacks,
      themeBundleDependencyCatalogs,
      iconThemePackages,
      importWallpaperFiles,
      explorerDefaultModeProfileId,
      explorerShellDefaultLayoutId,
      explorerLayoutPackagesError,
      explorerLayoutPackagesLoading,
      explorerLayoutPackagesWarnings,
      explorerPanelLayoutMode,
      iconThemePackagesError,
      iconThemePackagesLoading,
      iconThemePackagesWarnings,
      themePackagesError,
      themePackagesLoading,
      themePackagesWarnings,
      homePacksError,
      homePacksLoading,
      homePacksWarnings,
      refreshHomePacks,
      menuPacksError,
      menuPacksLoading,
      menuPacksWarnings,
      refreshMenuPacks,
      kainUiGraph,
      kainUiGraphError,
      kainManifest,
      kainManifestError,
      kainUiScaffold,
      kainUiScaffoldError,
      kainLatticeCatalog,
      kainLatticeCatalogError,
      kainFfiCatalog,
      kainFfiCatalogError,
      usrProfileRuntimeSnapshot,
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
  const workbenchSurfaceDefinitions = useMemo(
    () => buildWorkbenchSurfaceDefinitions(panelDefinitions),
    [panelDefinitions],
  );
  const workbenchSurfaceLookup = useMemo(
    () => new Map(workbenchSurfaceDefinitions.map(surface => [surface.id, surface] as const)),
    [workbenchSurfaceDefinitions],
  );
  const workbenchSurfaceSeeds = useMemo(
    () => workbenchSurfaceDefinitions.map(surface => ({
      id: surface.id,
      defaultDockPlacement: surface.defaultDockPlacement,
      defaultOrder: surface.defaultOrder,
      defaultVisibility: surface.defaultVisibility,
      ideRole: surface.ideRole,
    })),
    [workbenchSurfaceDefinitions],
  );
  const activeShellFamily = useMemo(
    () => getWorkbenchShellFamilyForLayoutProfile(activeLayoutProfile),
    [activeLayoutProfile],
  );
  const activeShellUsesIdeWorkbench = activeLayoutProfile.shellBlueprint === 'ide-workbench';
  const resolvedIdeWorkbenchLayoutState = useMemo(
    () => normalizeIdeWorkbenchLayoutState(
      layoutSettings.shellStateByProfile[activeLayoutProfile.id],
      workbenchSurfaceSeeds,
    ),
    [activeLayoutProfile.id, layoutSettings.shellStateByProfile, workbenchSurfaceSeeds],
  );
  const ideWorkbenchOpenSurfaceIds = useMemo(
    () => uniquePanelIds([
      ...collectSurfaceIdsFromDockNode(resolvedIdeWorkbenchLayoutState.rootDockNode),
      ...collectSurfaceIdsFromFloatingNodes(resolvedIdeWorkbenchLayoutState.floatingNodes),
      ...collectExternalizedSurfaceIds(resolvedIdeWorkbenchLayoutState),
    ]),
    [
      resolvedIdeWorkbenchLayoutState,
      resolvedIdeWorkbenchLayoutState.floatingNodes,
      resolvedIdeWorkbenchLayoutState.rootDockNode,
    ],
  );
  const ideWorkbenchActiveSurfaceId = useMemo(
    () => resolvePrimaryIdeWorkbenchSurfaceId(resolvedIdeWorkbenchLayoutState),
    [resolvedIdeWorkbenchLayoutState],
  );
  const pinnedPanelIds = useMemo(
    () => activePinnedPanelIds,
    [activePinnedPanelIds],
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
  const updateActiveIdeWorkbenchLayoutState = useCallback((nextState: IdeWorkbenchLayoutState) => {
    const currentSettingsState = useSettingsStore.getState();
    const currentShellStateByProfile = currentSettingsState.settings.layout.shellStateByProfile;
    const currentStoredState = normalizeIdeWorkbenchLayoutState(
      currentShellStateByProfile[activeLayoutProfile.id],
      workbenchSurfaceSeeds,
    );
    if (areIdeWorkbenchLayoutStatesEqual(currentStoredState, nextState)) {
      return;
    }

    currentSettingsState.updateLayout({
      shellStateByProfile: {
        ...currentShellStateByProfile,
        [activeLayoutProfile.id]: nextState,
      },
    });
  }, [activeLayoutProfile.id, workbenchSurfaceSeeds]);
  useEffect(() => {
    if (isDedicatedSecondaryWindowHost || !activeShellUsesIdeWorkbench || !isTauri()) {
      return undefined;
    }

    const externalizedSurfaceIds = collectExternalizedSurfaceIds(resolvedIdeWorkbenchLayoutState);
    if (externalizedSurfaceIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const reconcileTimer = window.setTimeout(() => {
      void listSecondaryWindowDescriptors()
        .then((descriptors) => {
          if (cancelled) {
            return;
          }

          const liveWindowIds = new Set(descriptors.map(descriptor => descriptor.windowId));
          const pendingWindowIds = pendingExternalizedWindowIdsRef.current;
          let nextLayoutState = resolvedIdeWorkbenchLayoutState;
          let changed = false;

          for (const surfaceId of externalizedSurfaceIds) {
            const windowId = getExternalizedSurfaceWindowId(nextLayoutState, surfaceId);
            if (!windowId || liveWindowIds.has(windowId) || pendingWindowIds.has(windowId)) {
              continue;
            }

            nextLayoutState = restoreExternalizedDockSurface(
              nextLayoutState,
              surfaceId,
              workbenchSurfaceSeeds,
            );
            changed = true;
          }

          if (changed) {
            updateActiveIdeWorkbenchLayoutState(nextLayoutState);
          }
        })
        .catch((error) => {
          console.error('GreebleFS: failed to reconcile secondary workbench windows', error);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(reconcileTimer);
    };
  }, [
    activeShellUsesIdeWorkbench,
    isDedicatedSecondaryWindowHost,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);
  const focusExternalizedWorkbenchSurface = useCallback((surfaceId: string): boolean => {
    if (!activeShellUsesIdeWorkbench || !isDockSurfaceExternalized(resolvedIdeWorkbenchLayoutState, surfaceId)) {
      return false;
    }

    const windowId = getExternalizedSurfaceWindowId(resolvedIdeWorkbenchLayoutState, surfaceId);
    if (!windowId) {
      return false;
    }

    updateActiveIdeWorkbenchLayoutState(
      focusDockSurface(resolvedIdeWorkbenchLayoutState, surfaceId, workbenchSurfaceSeeds),
    );
    void focusSecondaryWindow(windowId).catch((error) => {
      console.error('GreebleFS: failed to focus externalized workbench surface', error);
      updateActiveIdeWorkbenchLayoutState(
        restoreExternalizedDockSurface(
          resolvedIdeWorkbenchLayoutState,
          surfaceId,
          workbenchSurfaceSeeds,
        ),
      );
    });
    return true;
  }, [
    activeShellUsesIdeWorkbench,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);
  const closeExternalizedWorkbenchSurface = useCallback((surfaceId: string): boolean => {
    const windowId = getExternalizedSurfaceWindowId(resolvedIdeWorkbenchLayoutState, surfaceId);
    if (!windowId) {
      return false;
    }

    void closeSecondaryWindow(windowId).catch(() => undefined);
    return true;
  }, [resolvedIdeWorkbenchLayoutState]);
  const openWorkbenchSurfaceInNativeWindow = useCallback(async (
    surfaceId: string,
    options?: {
      restorePlacement?: DockStackPlacement | null;
    },
  ) => {
    const surface = workbenchSurfaceLookup.get(surfaceId);
    const allowedPresentations = surface?.allowedPresentations ?? [];
    if (
      !surface
      || surface.id === 'explorer'
      || !allowedPresentations.includes('native-window')
    ) {
      return;
    }

    const windowId = createWorkbenchSurfaceSecondaryWindowId(surfaceId);
    const surfaceKind = surface.kind === 'folder-plugin' ? 'plugin-panel' : 'panel';
    const restorePlacement = options?.restorePlacement
      ?? surface.defaultDockPlacement;
    const request = createSecondaryWindowOpenRequest({
      windowId,
      surfaceKind,
      presentation: 'tool-window',
      title: surface.label,
      dockTarget: activeShellUsesIdeWorkbench
        ? {
          surfaceId,
          restorePlacement,
        }
        : null,
      payload: {
        panelId: surfaceId,
      },
    });
    const nextIdeLayoutState = activeShellUsesIdeWorkbench
      ? externalizeDockSurface(
        resolvedIdeWorkbenchLayoutState,
        surfaceId,
        windowId,
        restorePlacement,
      )
      : null;

    if (nextIdeLayoutState) {
      pendingExternalizedWindowIdsRef.current.add(windowId);
      updateActiveIdeWorkbenchLayoutState(nextIdeLayoutState);
    }

    try {
      await openSecondaryWindow(request);
    } catch (error) {
      if (nextIdeLayoutState) {
        updateActiveIdeWorkbenchLayoutState(
          restoreExternalizedDockSurface(nextIdeLayoutState, surfaceId, workbenchSurfaceSeeds),
        );
      }
      console.error('GreebleFS: failed to open native workbench surface window', error);
    } finally {
      pendingExternalizedWindowIdsRef.current.delete(windowId);
    }
  }, [
    activeShellUsesIdeWorkbench,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceLookup,
    workbenchSurfaceSeeds,
  ]);
  useEffect(() => {
    if (typeof window === 'undefined' || isDedicatedSecondaryWindowHost) {
      return undefined;
    }

    const handlePluginPanelOpenRequest = (request: PluginPanelOpenRequest | null | undefined) => {
      const panelId = request?.panelId?.trim();
      if (!panelId) {
        return;
      }

      if (request?.presentation === 'native-window') {
        void openWorkbenchSurfaceInNativeWindow(panelId);
      } else if (request?.presentation === 'dock-window') {
        const windowId = getExternalizedSurfaceWindowId(resolvedIdeWorkbenchLayoutState, panelId);
        if (activeShellUsesIdeWorkbench && windowId) {
          void dockBackSecondaryWindow(windowId).catch(() => undefined);
        } else {
          activatePanelRef.current(panelId);
        }
      } else if (activeShellUsesIdeWorkbench && isDockSurfaceExternalized(resolvedIdeWorkbenchLayoutState, panelId)) {
        updateActiveIdeWorkbenchLayoutState(
          restoreExternalizedDockSurface(
            resolvedIdeWorkbenchLayoutState,
            panelId,
            workbenchSurfaceSeeds,
          ),
        );
      } else {
        activatePanelRef.current(panelId);
      }

      if (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed') {
        void showCurrentPresentation();
      }
    };

    const handleBrowserPluginPanelOpenRequest = (event: Event) => {
      handlePluginPanelOpenRequest((event as CustomEvent<PluginPanelOpenRequest>).detail);
    };

    window.addEventListener(PLUGIN_PANEL_OPEN_REQUEST_EVENT, handleBrowserPluginPanelOpenRequest);

    let stopTauriPluginPanelListener: (() => void) | null = null;
    if (isTauri()) {
      stopTauriPluginPanelListener = bindDeferredUnlisten(
        listen<PluginPanelOpenRequest>(PLUGIN_PANEL_OPEN_REQUEST_EVENT, (event) => {
          handlePluginPanelOpenRequest(event.payload);
        }),
      );
    }

    return () => {
      window.removeEventListener(PLUGIN_PANEL_OPEN_REQUEST_EVENT, handleBrowserPluginPanelOpenRequest);
      stopTauriPluginPanelListener?.();
    };
  }, [
    activeShellUsesIdeWorkbench,
    isDedicatedSecondaryWindowHost,
    openWorkbenchSurfaceInNativeWindow,
    resolvedIdeWorkbenchLayoutState,
    showCurrentPresentation,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);
  useEffect(() => {
    if (isDedicatedSecondaryWindowHost) {
      return undefined;
    }

    const stopListeningForDockBack = listenToSecondaryWindowDockBack((detail) => {
      const surfaceId = detail.dockTarget.surfaceId.trim();
      if (!surfaceId || !activeShellUsesIdeWorkbench) {
        return;
      }

      updateActiveIdeWorkbenchLayoutState(
        restoreExternalizedDockSurface(
          resolvedIdeWorkbenchLayoutState,
          surfaceId,
          workbenchSurfaceSeeds,
        ),
      );
    });
    const stopListeningForClosed = listenToSecondaryWindowClosed((detail) => {
      const surfaceId = detail.descriptor.dockTarget?.surfaceId?.trim();
      if (!surfaceId || !activeShellUsesIdeWorkbench) {
        return;
      }

      pendingExternalizedWindowIdsRef.current.delete(detail.windowId);
      const shouldRestoreExternalizedSurface = detail.closeReason === 'open-failed'
        || detail.closeReason === 'stale-descriptor';
      updateActiveIdeWorkbenchLayoutState(
        shouldRestoreExternalizedSurface
          ? restoreExternalizedDockSurface(
            resolvedIdeWorkbenchLayoutState,
            surfaceId,
            workbenchSurfaceSeeds,
          )
          : clearExternalizedDockSurface(
            resolvedIdeWorkbenchLayoutState,
            surfaceId,
            { hidden: true },
          ),
      );
    });

    return () => {
      stopListeningForDockBack();
      stopListeningForClosed();
    };
  }, [
    activeShellUsesIdeWorkbench,
    isDedicatedSecondaryWindowHost,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);
  useEffect(() => {
    if (isDedicatedSecondaryWindowHost || !isTauri()) {
      return undefined;
    }

    let cancelled = false;
    void listSecondaryWindowDescriptors()
      .then((descriptors) => {
        if (cancelled) {
          return;
        }

        setIsLookdevSecondaryWindowOpen(
          descriptors.some((descriptor) => descriptor.windowId === LOOKDEV_SECONDARY_WINDOW_ID),
        );
      })
      .catch(() => undefined);

    const stopListeningForDescriptors = listenToSecondaryWindowDescriptorUpdates((descriptor) => {
      if (descriptor.windowId !== LOOKDEV_SECONDARY_WINDOW_ID) {
        return;
      }

      setIsLookdevSecondaryWindowOpen(true);
    });
    const stopListeningForClosed = listenToSecondaryWindowClosed((detail) => {
      if (detail.windowId !== LOOKDEV_SECONDARY_WINDOW_ID) {
        return;
      }

      setIsLookdevSecondaryWindowOpen(false);
    });

    return () => {
      cancelled = true;
      stopListeningForDescriptors();
      stopListeningForClosed();
    };
  }, [isDedicatedSecondaryWindowHost]);
  useEffect(() => {
    if (!activeShellUsesIdeWorkbench) {
      return;
    }

    const currentShellState = layoutSettings.shellStateByProfile[activeLayoutProfile.id];
    if (currentShellState && areIdeWorkbenchLayoutStatesEqual(
      normalizeIdeWorkbenchLayoutState(currentShellState, workbenchSurfaceSeeds),
      resolvedIdeWorkbenchLayoutState,
    )) {
      return;
    }

    updateLayout({
      shellStateByProfile: {
        ...layoutSettings.shellStateByProfile,
        [activeLayoutProfile.id]: resolvedIdeWorkbenchLayoutState,
      },
    });
  }, [
    activeLayoutProfile.id,
    activeShellUsesIdeWorkbench,
    layoutSettings.shellStateByProfile,
    resolvedIdeWorkbenchLayoutState,
    updateLayout,
    workbenchSurfaceSeeds,
  ]);
  useEffect(() => {
    const lastProfileId = layoutSettings.lastProfileIdByShellFamily[activeShellFamily];
    if (lastProfileId === activeLayoutProfile.id) {
      return;
    }

    updateLayout({
      lastProfileIdByShellFamily: {
        ...layoutSettings.lastProfileIdByShellFamily,
        [activeShellFamily]: activeLayoutProfile.id,
      },
    });
  }, [
    activeLayoutProfile.id,
    activeShellFamily,
    layoutSettings.lastProfileIdByShellFamily,
    updateLayout,
  ]);
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
  useEffect(() => {
    if (windowMode !== 'overlay' || openPanelIds.includes('explorer')) {
      return;
    }

    setPanelOpenStateDirectly('explorer');
  }, [openPanelIds, setPanelOpenStateDirectly, windowMode]);
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
  const activeWorkbenchOpenPanelIds = activeShellUsesIdeWorkbench
    ? ideWorkbenchOpenSurfaceIds
    : openPanelIds;
  const activeWorkbenchActivePanelId = activeShellUsesIdeWorkbench
    ? ideWorkbenchActiveSurfaceId
    : activePanelId;
  const activeWorkbenchPinnedPanelIds = activeShellUsesIdeWorkbench
    ? []
    : pinnedPanelIds;
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
    activePanelId: activeWorkbenchActivePanelId,
    openPanelCount: activeWorkbenchOpenPanelIds.length,
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
      setLatestOverlayFrameStats(stats);
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

  useEffect(() => {
    if (!zenFocusMode) {
      const restorePanelId = zenFocusRestorePanelIdRef.current;
      zenFocusRestorePanelIdRef.current = null;

      if (!restorePanelId || restorePanelId === 'explorer' || !availablePanelIds.includes(restorePanelId)) {
        return;
      }

      updateActiveLayoutPanelState(current => ({
        ...current,
        openPanelIds: uniquePanelIds([...current.openPanelIds, restorePanelId]),
        activePanelId: restorePanelId,
        dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== restorePanelId),
      }));
      return;
    }

    if (!availablePanelIds.includes('explorer')) {
      return;
    }

    if (activePanelId && activePanelId !== 'explorer' && zenFocusRestorePanelIdRef.current == null) {
      zenFocusRestorePanelIdRef.current = activePanelId;
    }

    if (activePanelId === 'explorer' && openPanelIds.includes('explorer')) {
      return;
    }

    updateActiveLayoutPanelState(current => ({
      ...current,
      openPanelIds: uniquePanelIds([...current.openPanelIds, 'explorer']),
      activePanelId: 'explorer',
      dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== 'explorer'),
    }));
  }, [activePanelId, availablePanelIds, openPanelIds, updateActiveLayoutPanelState, zenFocusMode]);

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

  const handleTopBarSelectPanel = useCallback((panelId: string | null) => {
    if (!panelId) {
      return;
    }

    if (activeShellUsesIdeWorkbench) {
      if (focusExternalizedWorkbenchSurface(panelId)) {
        return;
      }

      updateActiveIdeWorkbenchLayoutState(
        focusDockSurface(resolvedIdeWorkbenchLayoutState, panelId, workbenchSurfaceSeeds),
      );
      return;
    }

    handleSelectPanel(panelId);
  }, [
    activeShellUsesIdeWorkbench,
    focusExternalizedWorkbenchSurface,
    handleSelectPanel,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);
  const handleTopBarTogglePanel = useCallback((panelId: string) => {
    if (activeShellUsesIdeWorkbench) {
      if (focusExternalizedWorkbenchSurface(panelId)) {
        return;
      }

      if (panelId === 'explorer') {
        updateActiveIdeWorkbenchLayoutState(
          focusDockSurface(resolvedIdeWorkbenchLayoutState, panelId, workbenchSurfaceSeeds),
        );
        return;
      }

      updateActiveIdeWorkbenchLayoutState(
        activeWorkbenchOpenPanelIds.includes(panelId)
          ? hideDockSurface(resolvedIdeWorkbenchLayoutState, panelId)
          : focusDockSurface(resolvedIdeWorkbenchLayoutState, panelId, workbenchSurfaceSeeds),
      );
      return;
    }

    handleTogglePanel(panelId);
  }, [
    activeShellUsesIdeWorkbench,
    activeWorkbenchOpenPanelIds,
    focusExternalizedWorkbenchSurface,
    handleTogglePanel,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);
  const handleTopBarClosePanel = useCallback((panelId: string) => {
    if (activeShellUsesIdeWorkbench) {
      if (closeExternalizedWorkbenchSurface(panelId)) {
        return;
      }

      if (panelId === 'explorer') {
        updateActiveIdeWorkbenchLayoutState(
          focusDockSurface(resolvedIdeWorkbenchLayoutState, panelId, workbenchSurfaceSeeds),
        );
        return;
      }

      updateActiveIdeWorkbenchLayoutState(hideDockSurface(resolvedIdeWorkbenchLayoutState, panelId));
      return;
    }

    handleClosePanel(panelId);
  }, [
    activeShellUsesIdeWorkbench,
    closeExternalizedWorkbenchSurface,
    handleClosePanel,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    workbenchSurfaceSeeds,
  ]);

  const handleReorderPanels = useCallback((draggedId: string, targetId: string) => {
    if (activeShellUsesIdeWorkbench) {
      updateActiveIdeWorkbenchLayoutState(
        reorderDockSurfaceTabs(resolvedIdeWorkbenchLayoutState, draggedId, targetId),
      );
      return;
    }

    updateActiveLayoutPanelState(current => ({
      ...current,
      openPanelIds: reorderPanelIds(tabbedOpenPanelIds, draggedId, targetId),
    }));
  }, [
    activeShellUsesIdeWorkbench,
    resolvedIdeWorkbenchLayoutState,
    tabbedOpenPanelIds,
    updateActiveIdeWorkbenchLayoutState,
    updateActiveLayoutPanelState,
  ]);

  const handleOpenSettingsSection = useCallback((section: SettingsSectionKey) => {
    setActiveSection(section);
    if (activeShellUsesIdeWorkbench) {
      if (focusExternalizedWorkbenchSurface('settings')) {
        return;
      }

      updateActiveIdeWorkbenchLayoutState(
        focusDockSurface(resolvedIdeWorkbenchLayoutState, 'settings', workbenchSurfaceSeeds),
      );
      return;
    }

    updateActiveLayoutPanelState(current => ({
      openPanelIds: uniquePanelIds([...current.openPanelIds, 'settings']),
      activePanelId: 'settings',
      dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== 'settings'),
    }));
  }, [
    activeShellUsesIdeWorkbench,
    focusExternalizedWorkbenchSurface,
    resolvedIdeWorkbenchLayoutState,
    setActiveSection,
    updateActiveIdeWorkbenchLayoutState,
    updateActiveLayoutPanelState,
    workbenchSurfaceSeeds,
  ]);
  openSettingsSectionRef.current = handleOpenSettingsSection;

  const handleOpenSettings = useCallback(() => {
    handleOpenSettingsSection('overview');
  }, [handleOpenSettingsSection]);

  const lookdevApplyCallbacks = useMemo(() => ({
    updateAppearance,
    updateExplorer,
    updateDock,
    updatePresentation,
  }), [
    updateAppearance,
    updateDock,
    updateExplorer,
    updatePresentation,
  ]);

  const handleRestoreLookdevBaseline = useCallback(() => {
    const draftSession = useLookdevStore.getState().draftSession;
    if (!draftSession) {
      useLookdevStore.getState().closeSession();
      return;
    }

    applyLookdevScopedOverridesToSettings(
      captureLookdevScopedOverridesFromSettings(draftSession.baseline),
      lookdevApplyCallbacks,
    );
    useLookdevStore.getState().closeSession();
  }, [lookdevApplyCallbacks]);

  const closeDedicatedLookdevWindow = useCallback(async () => {
    if (!secondaryWindowDescriptor || !isDedicatedLookdevSecondaryWindow) {
      return;
    }

    allowLookdevWindowCloseRef.current = true;
    try {
      await closeSecondaryWindow(secondaryWindowDescriptor.windowId).catch(() => undefined);
    } finally {
      allowLookdevWindowCloseRef.current = false;
    }
  }, [isDedicatedLookdevSecondaryWindow, secondaryWindowDescriptor]);

  useEffect(() => {
    if (!isTauri() || !isDedicatedLookdevSecondaryWindow) {
      return;
    }

    return bindDeferredUnlisten(
      getCurrentWindow().onCloseRequested(async event => {
        if (allowLookdevWindowCloseRef.current) {
          return;
        }

        event.preventDefault();
        handleRestoreLookdevBaseline();
        await closeDedicatedLookdevWindow();
      }),
      {
        onError: error => {
          console.warn('GreebleFS: failed to intercept lookdev close requests', error);
        },
      },
    );
  }, [
    closeDedicatedLookdevWindow,
    handleRestoreLookdevBaseline,
    isDedicatedLookdevSecondaryWindow,
  ]);

  const handleApplyLookdevPresetById = useCallback((presetId?: string | null) => {
    const lookdevState = useLookdevStore.getState();
    const targetPresetId = presetId?.trim()
      || lookdevState.selectedPresetId
      || lookdevState.activeAppliedPresetId;
    if (!targetPresetId) {
      return false;
    }

    const targetPreset = lookdevState.presets.find((preset) => preset.id === targetPresetId) ?? null;
    if (!targetPreset) {
      lookdevState.clearActiveAppliedPresetId();
      return false;
    }

    const resolvedRuntimeOverrides = resolveLookdevPresetForWindowMode(
      targetPreset.manifest,
      presentationSettings.windowMode,
    );
    applyLookdevScopedOverridesToSettings(
      {
        ...resolvedRuntimeOverrides,
        presentation: undefined,
      },
      lookdevApplyCallbacks,
    );
    lookdevState.setSelectedPresetId(targetPreset.id);
    lookdevState.setActiveAppliedPresetId(targetPreset.id);
    return true;
  }, [lookdevApplyCallbacks, presentationSettings.windowMode]);

  const openLocalLookdevSession = useCallback((args?: {
    requestedPresetId?: string | null;
    presetOverride?: LoadedLookdevPreset | null;
  }) => {
    const lookdevState = useLookdevStore.getState();
    const targetPresetId = args?.requestedPresetId?.trim()
      || lookdevState.selectedPresetId
      || lookdevState.activeAppliedPresetId;
    const targetPreset = args?.presetOverride
      ?? (targetPresetId
      ? lookdevState.presets.find((preset) => preset.id === targetPresetId) ?? null
      : null);
    const liveSettingsSnapshot = {
      appearance,
      explorer: explorerSettings,
      dock: dockSettings,
      presentation: presentationSettings,
    };
    const defaultDraftManifest = createLookdevPresetManifestFromScopeSnapshot({
      id: 'live-lookdev-session',
      name: 'Live Lookdev Session',
      description: 'Ephemeral lookdev draft built from the current live shell state.',
      scope: presentationSettings.windowMode === 'dock' ? 'dock' : 'windowed',
      scopedOverrides: captureLookdevScopedOverridesFromSettings(liveSettingsSnapshot),
    });

    setIsCommandPaletteOpen(false);
    lookdevState.openSession({
      baseline: liveSettingsSnapshot,
      initialWindowMode: presentationSettings.windowMode,
      preset: targetPreset,
      draftManifest: targetPreset?.manifest ?? defaultDraftManifest,
    });
    if (
      !isDedicatedSecondaryWindowHost
      && (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed')
    ) {
      void showCurrentPresentation();
    }
  }, [
    appearance,
    dockSettings,
    explorerSettings,
    isDedicatedSecondaryWindowHost,
    presentationSettings,
    showCurrentPresentation,
  ]);

  const handleOpenLookdevOverlay = useCallback(async (requestedPresetId?: string | null) => {
    const lookdevState = useLookdevStore.getState();
    const targetPresetId = requestedPresetId?.trim()
      || lookdevState.selectedPresetId
      || lookdevState.activeAppliedPresetId;
    const targetPreset = targetPresetId
      ? lookdevState.presets.find((preset) => preset.id === targetPresetId) ?? null
      : null;

    if (isDedicatedLookdevSecondaryWindow) {
      openLocalLookdevSession({
        requestedPresetId,
        presetOverride: targetPreset,
      });
      return;
    }

    if (isTauri()) {
      setIsCommandPaletteOpen(false);
      await openSecondaryWindow(
        createLookdevSecondaryWindowOpenRequest({
          presetId: requestedPresetId,
          preset: targetPreset,
        }),
      );
      return;
    }

    openLocalLookdevSession({
      requestedPresetId,
      presetOverride: targetPreset,
    });
  }, [
    isDedicatedLookdevSecondaryWindow,
    openLocalLookdevSession,
  ]);

  const handleToggleLookdevOverlay = useCallback(async () => {
    if (isDedicatedLookdevSecondaryWindow) {
      handleRestoreLookdevBaseline();
      await closeDedicatedLookdevWindow();
      return;
    }

    if (isTauri()) {
      try {
        const lookdevDescriptor = (await listSecondaryWindowDescriptors())
          .find((descriptor) => descriptor.windowId === LOOKDEV_SECONDARY_WINDOW_ID);
        if (lookdevDescriptor) {
          await closeSecondaryWindow(lookdevDescriptor.windowId).catch(() => undefined);
          return;
        }
      } catch {
        // Fall through to the open path when descriptor reconciliation is unavailable.
      }
    }

    if (useLookdevStore.getState().isOpen) {
      handleRestoreLookdevBaseline();
      return;
    }

    await handleOpenLookdevOverlay();
  }, [
    closeDedicatedLookdevWindow,
    handleOpenLookdevOverlay,
    handleRestoreLookdevBaseline,
    isDedicatedLookdevSecondaryWindow,
  ]);

  useEffect(() => {
    if (!isDedicatedLookdevSecondaryWindow || lookdevSecondaryWindowSessionInitializedRef.current) {
      return;
    }

    lookdevSecondaryWindowSessionInitializedRef.current = true;
    openLocalLookdevSession({
      requestedPresetId: dedicatedLookdevWindowPayload?.presetId,
      presetOverride: dedicatedLookdevWindowPayload?.preset ?? null,
    });
  }, [
    dedicatedLookdevWindowPayload?.preset,
    dedicatedLookdevWindowPayload?.presetId,
    isDedicatedLookdevSecondaryWindow,
    openLocalLookdevSession,
  ]);

  useEffect(() => {
    if (lookdevDraftSession || !lookdevActiveAppliedPresetId) {
      return;
    }

    const activeRuntimePreset = lookdevPresets.find(
      (preset) => preset.id === lookdevActiveAppliedPresetId,
    );
    if (!activeRuntimePreset) {
      useLookdevStore.getState().clearActiveAppliedPresetId();
      return;
    }

    const resolvedRuntimeOverrides = resolveLookdevPresetForWindowMode(
      activeRuntimePreset.manifest,
      presentationSettings.windowMode,
    );
    applyLookdevScopedOverridesToSettings(
      {
        ...resolvedRuntimeOverrides,
        presentation: undefined,
      },
      lookdevApplyCallbacks,
    );
  }, [
    lookdevActiveAppliedPresetId,
    lookdevApplyCallbacks,
    lookdevDraftSession,
    lookdevPresets,
    presentationSettings.windowMode,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || isDedicatedSecondaryWindowHost) {
      return;
    }

    const handleOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<LookdevApplyPresetEventDetail>).detail;
      void handleOpenLookdevOverlay(detail?.presetId);
    };
    const handleToggleEvent = () => {
      void handleToggleLookdevOverlay();
    };
    const handleApplyEvent = (event: Event) => {
      const detail = (event as CustomEvent<LookdevApplyPresetEventDetail>).detail;
      handleApplyLookdevPresetById(detail?.presetId);
    };
    const handleRefreshEvent = () => {
      void refreshLookdevPresets(true);
    };

    window.addEventListener(LOOKDEV_OPEN_OVERLAY_EVENT, handleOpenEvent);
    window.addEventListener(LOOKDEV_TOGGLE_OVERLAY_EVENT, handleToggleEvent);
    window.addEventListener(LOOKDEV_APPLY_PRESET_EVENT, handleApplyEvent);
    window.addEventListener(LOOKDEV_REFRESH_PRESETS_EVENT, handleRefreshEvent);
    return () => {
      window.removeEventListener(LOOKDEV_OPEN_OVERLAY_EVENT, handleOpenEvent);
      window.removeEventListener(LOOKDEV_TOGGLE_OVERLAY_EVENT, handleToggleEvent);
      window.removeEventListener(LOOKDEV_APPLY_PRESET_EVENT, handleApplyEvent);
      window.removeEventListener(LOOKDEV_REFRESH_PRESETS_EVENT, handleRefreshEvent);
    };
  }, [
    handleApplyLookdevPresetById,
    handleOpenLookdevOverlay,
    handleToggleLookdevOverlay,
    isDedicatedSecondaryWindowHost,
    refreshLookdevPresets,
  ]);

  const handleActivatePanel = useCallback((panelId: string) => {
    if (!panelLookup.has(panelId)) {
      return;
    }

    if (activeShellUsesIdeWorkbench) {
      if (focusExternalizedWorkbenchSurface(panelId)) {
        return;
      }

      updateActiveIdeWorkbenchLayoutState(
        focusDockSurface(resolvedIdeWorkbenchLayoutState, panelId, workbenchSurfaceSeeds),
      );
      return;
    }

    if (pinnedPanelIds.includes(panelId)) {
      return;
    }

    updateActiveLayoutPanelState(current => ({
      openPanelIds: uniquePanelIds([...current.openPanelIds, panelId]),
      activePanelId: panelId,
      dismissedPanelIds: current.dismissedPanelIds.filter(id => id !== panelId),
    }));
  }, [
    activeShellUsesIdeWorkbench,
    focusExternalizedWorkbenchSurface,
    panelLookup,
    pinnedPanelIds,
    resolvedIdeWorkbenchLayoutState,
    updateActiveIdeWorkbenchLayoutState,
    updateActiveLayoutPanelState,
    workbenchSurfaceSeeds,
  ]);
  activatePanelRef.current = handleActivatePanel;

  const handleOpenTerminalPanel = useCallback(() => {
    const now = Date.now();
    if (now - lastTerminalFocusAtRef.current < 220) {
      return;
    }
    lastTerminalFocusAtRef.current = now;

    setIsCommandPaletteOpen(false);
    handleActivatePanel('terminal');
    if (!overlayVisibleRef.current || overlayPhaseRef.current === 'closed') {
      void showCurrentPresentation();
    }
  }, [handleActivatePanel, showCurrentPresentation]);

  openTerminalPanelRef.current = handleOpenTerminalPanel;

  const handleSelectLayoutProfile = useCallback((profileId: string) => {
    const targetProfile = resolveLayoutProfile(layoutManifest, profileId);
    const targetShellFamily = getWorkbenchShellFamilyForLayoutProfile(targetProfile);
    updateLayout({
      activeProfileId: targetProfile.id,
      followThemeDefaults: false,
      lastProfileIdByShellFamily: {
        ...layoutSettings.lastProfileIdByShellFamily,
        [targetShellFamily]: targetProfile.id,
      },
    });
  }, [layoutManifest, layoutSettings.lastProfileIdByShellFamily, updateLayout]);
  const handleToggleShellMode = useCallback(() => {
    const targetShellFamily = activeShellFamily === 'ide' ? 'classic' : 'ide';
    const familyProfiles = getLayoutProfilesForShellFamily(layoutManifest, targetShellFamily);
    if (familyProfiles.length === 0) {
      return;
    }

    const requestedProfileId = layoutSettings.lastProfileIdByShellFamily[targetShellFamily];
    const nextProfile = familyProfiles.find(profile => profile.id === requestedProfileId) ?? familyProfiles[0];
    handleSelectLayoutProfile(nextProfile.id);
  }, [
    activeShellFamily,
    handleSelectLayoutProfile,
    layoutManifest,
    layoutSettings.lastProfileIdByShellFamily,
  ]);
  const handleCycleLayout = useCallback(() => {
    handleSelectLayoutProfile(getNextLayoutProfileIdInShellFamily(layoutManifest, activeLayoutProfile.id));
  }, [activeLayoutProfile.id, handleSelectLayoutProfile, layoutManifest]);
  const availableLayoutProfiles = layoutManifest.profiles;

  const handleStartMobileShareQuiet = useCallback(async () => {
    try {
      await startMobileShareSession({
        requestedPath: explorerCurrentPath,
        remoteAccessMode: mobileSettings.remoteAccessMode,
        copyPreferredUrl: true,
      });
    } catch (error) {
      if (mobileSettings.remoteAccessMode === 'tailscale') {
        handleOpenSettingsSection('mobile');
      }
      throw error;
    }
  }, [
    explorerCurrentPath,
    handleOpenSettingsSection,
    mobileSettings.remoteAccessMode,
  ]);

  const handleStopMobileShareQuiet = useCallback(async () => {
    await stopMobileShareSession();
  }, []);

  const handleStartMobileShare = useCallback(async () => {
    try {
      const session = await startMobileShareSession({
        requestedPath: explorerCurrentPath,
        remoteAccessMode: mobileSettings.remoteAccessMode,
        copyPreferredUrl: true,
      });

      window.alert(
        `Mobile share is live.\n\nPath: ${session.sharePath}\nAccess: ${mobileSettings.remoteAccessMode === 'tailscale' ? 'Tailscale' : 'LAN'}\nURL: ${session.preferredUrl}\n\nThe URL was copied to your clipboard when available.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (mobileSettings.remoteAccessMode === 'tailscale') {
        handleOpenSettingsSection('mobile');
      }
      window.alert(`Failed to start mobile share.\n\n${message}`);
    }
  }, [
    explorerCurrentPath,
    handleOpenSettingsSection,
    mobileSettings.remoteAccessMode,
  ]);

  const handleStopMobileShare = useCallback(async () => {
    try {
      await stopMobileShareSession();
      window.alert('Mobile share stopped.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      window.alert(`Failed to stop mobile share.\n\n${message}`);
    }
  }, []);

  const handleSetMobileShareRemoteAccessMode = useCallback((mode: 'lan' | 'tailscale') => {
    updateMobile({ remoteAccessMode: mode });
  }, [updateMobile]);

  const handleToggleMobileShare = useCallback(async () => {
    if (mobileSharePhase === 'starting' || mobileSharePhase === 'stopping') {
      return;
    }

    if (mobileSharePhase === 'running') {
      try {
        await stopMobileShareSession();
      } catch {
        // Shared store state already captures the failure for the popover/settings surface.
      }
      return;
    }

    try {
      await startMobileShareSession({
        requestedPath: explorerCurrentPath,
        remoteAccessMode: mobileSettings.remoteAccessMode,
        copyPreferredUrl: true,
      });
    } catch {
      if (mobileSettings.remoteAccessMode === 'tailscale') {
        handleOpenSettingsSection('mobile');
      }
    }
  }, [
    explorerCurrentPath,
    handleOpenSettingsSection,
      mobileSharePhase,
      mobileSettings.remoteAccessMode,
    ]);

  const dispatchExplorerLayoutCommand = useCallback((eventName: string) => {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: false,
        cancelable: true,
      }),
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
        || Boolean(target?.closest('.monaco-editor'))
      ) {
        return;
      }

      const matchesAppZoomIn = matchesKeybinding(event, keybindings.appZoomIn);
      const matchesAppZoomOut = matchesKeybinding(event, keybindings.appZoomOut);

      if (
        !isEventTargetInsideLocalAppZoomHotkeyScope(target)
        && (matchesAppZoomIn || matchesAppZoomOut)
      ) {
        const zoomDirection = matchesAppZoomIn
          ? 1
          : -1;
        const currentAppZoom =
          useSettingsStore.getState().settings.appearance.appZoom
          ?? overlayVisualControls.zoom.defaultValue;
        const nextAppZoom = clampOverlayVisualControlValue(
          'zoom',
          currentAppZoom + overlayVisualControls.zoom.step * zoomDirection,
        );

        event.preventDefault();
        event.stopPropagation();
        updateAppearance({ appZoom: nextAppZoom });
        return;
      }

      if (matchesKeybinding(event, keybindings.commandPalette)) {
        event.preventDefault();
        event.stopPropagation();
        handleOpenCommandPalette();
        return;
      }

      if (matchesKeybinding(event, keybindings.windowModeToggle)) {
        event.preventDefault();
        event.stopPropagation();
        handleToggleWindowMode();
        return;
      }

      if (matchesKeybinding(event, keybindings.zenFocusModeToggle)) {
        event.preventDefault();
        event.stopPropagation();
        handleToggleZenFocusMode();
        return;
      }

      if (matchesKeybinding(event, keybindings.mobileShareToggle)) {
        event.preventDefault();
        event.stopPropagation();
        void handleToggleMobileShare();
        return;
      }

      if (matchesKeybinding(event, keybindings.toggleLookdevOverlay)) {
        event.preventDefault();
        event.stopPropagation();
        void handleToggleLookdevOverlay();
        return;
      }

      if (matchesKeybinding(event, keybindings.closeTab)) {
        event.preventDefault();
        event.stopPropagation();

        const panelIdToClose = activeWorkbenchActivePanelId;
        if (
          panelIdToClose
          && panelIdToClose !== 'explorer'
          && !activeWorkbenchPinnedPanelIds.includes(panelIdToClose)
          && !activeLayoutProfile.behavior.enforcedOpenPanelIds.includes(panelIdToClose)
        ) {
          handleTopBarClosePanel(panelIdToClose);
        }
        return;
      }

      if (matchesKeybinding(event, keybindings.toggleExplorerCustomize)) {
        event.preventDefault();
        event.stopPropagation();
        handleActivatePanel('explorer');
        dispatchExplorerLayoutCommand('greeblefs:toggle-explorer-customize');
        return;
      }

      if (matchesKeybinding(event, keybindings.openExplorerLayoutSwitcher)) {
        event.preventDefault();
        event.stopPropagation();
        handleActivatePanel('explorer');
        dispatchExplorerLayoutCommand('greeblefs:open-explorer-layout-switcher');
        return;
      }

      const developerTelemetryAllowed = Boolean(import.meta.env.DEV) || systemSettings.developerMode;
      if (!developerTelemetryAllowed || !matchesKeybinding(event, keybindings.toggleDeveloperTelemetryHud)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const currentSystemSettings = useSettingsStore.getState().settings.system;
      const nextHudVisible = !currentSystemSettings.devTelemetryHudVisible;
      useSettingsStore.getState().updateSystem({
        devTelemetryHudVisible: nextHudVisible,
        sourceTraceModeEnabled: nextHudVisible,
        ...(nextHudVisible ? { developerTelemetryEnabled: true } : {}),
      });
    };

    window.addEventListener('keydown', handleKeydown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeydown, { capture: true });
  }, [
    activeLayoutProfile.behavior.enforcedOpenPanelIds,
    activeWorkbenchActivePanelId,
    activeWorkbenchPinnedPanelIds,
    handleOpenCommandPalette,
    dispatchExplorerLayoutCommand,
    handleActivatePanel,
    handleTopBarClosePanel,
    handleToggleLookdevOverlay,
    handleToggleMobileShare,
    handleToggleWindowMode,
    handleToggleZenFocusMode,
    keybindings.appZoomIn,
    keybindings.appZoomOut,
    keybindings.closeTab,
    keybindings.commandPalette,
    keybindings.mobileShareToggle,
    keybindings.openExplorerLayoutSwitcher,
    keybindings.toggleLookdevOverlay,
    keybindings.toggleDeveloperTelemetryHud,
    keybindings.toggleExplorerCustomize,
    keybindings.windowModeToggle,
    keybindings.zenFocusModeToggle,
    systemSettings.developerMode,
    updateAppearance,
  ]);

  useEffect(() => {
    if (!settingsHydrated || mobileShareBootEvaluationRef.current) {
      return;
    }

    if (currentWindowHostRole !== MAIN_WINDOW_HOST_LABEL) {
      return;
    }

    mobileShareBootEvaluationRef.current = true;
    if (!systemSettings.startMobileShareOnBoot || !isTauri()) {
      return;
    }

    void startMobileShareSession({
      requestedPath: explorerCurrentPath,
      remoteAccessMode: mobileSettings.remoteAccessMode,
      copyPreferredUrl: false,
    }).catch((error) => {
      console.warn('GreebleFS: failed to auto-start mobile share on boot', error);
    });
  }, [
    currentWindowHostRole,
    explorerCurrentPath,
    mobileSettings.remoteAccessMode,
    settingsHydrated,
    systemSettings.startMobileShareOnBoot,
  ]);

  const globalSearchPriorityPaths = useMemo(() => {
    const candidatePaths = [
      ...Object.values(explorerSessions).map((session) => session.currentPath),
      ...explorerRailNodes
        .filter(
          (
            node,
          ): node is (typeof explorerRailNodes)[number] & {
            kind: 'bookmark';
            path: string;
          } => node.kind === 'bookmark' && typeof node.path === 'string',
        )
        .map((node) => node.path),
    ];

    return candidatePaths.filter((path) => {
      const trimmedPath = path.trim();
      return (
        trimmedPath.length > 0
        && !trimmedPath.startsWith('cloud://')
        && !isExplorerVirtualPath(trimmedPath)
      );
    });
  }, [explorerRailNodes, explorerSessions]);

  const handleOpenGlobalSearchResult = useCallback((result: GlobalSearchResultValue) => {
    handleActivatePanel('explorer');
    requestOpenInExplorer({
      directoryPath: result.isDir ? result.path : getParentDirectoryPath(result.path),
      selectionPath: result.isDir ? null : result.path,
      pushHistory: true,
    });
  }, [handleActivatePanel, requestOpenInExplorer]);

  const commandPaletteStatusMessage =
    useMemo<OverlayCommandPaletteStatusMessage | null>(() => (
      describeGlobalSearchPaletteStatus({
        status: globalSearchStatus,
        lastError: globalSearchLastError,
        isSearching: isGlobalSearchSearching,
        query: commandPaletteQuery,
      })
    ), [
      commandPaletteQuery,
      globalSearchLastError,
      globalSearchStatus,
      isGlobalSearchSearching,
    ]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      void openGlobalSearchPaletteSession();
      return;
    }

    closeGlobalSearchPaletteSession();
    clearGlobalSearchQuery();
  }, [
    clearGlobalSearchQuery,
    closeGlobalSearchPaletteSession,
    isCommandPaletteOpen,
    openGlobalSearchPaletteSession,
  ]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    setGlobalSearchQuery(deferredCommandPaletteQuery, globalSearchPriorityPaths);
  }, [
    deferredCommandPaletteQuery,
    globalSearchPriorityPaths,
    isCommandPaletteOpen,
    setGlobalSearchQuery,
  ]);

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
        subtitle: 'Jump to the settings overview.',
        group: 'App',
        kind: 'command',
        keywords: ['preferences', 'config', 'appearance', 'overview'],
        badge: 'App',
        onSelect: handleOpenSettings,
      },
      {
        id: 'open-explorer-task-center',
        title: 'Open Task Center',
        subtitle: 'Open the dedicated file operations window.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'tasks', 'operations', 'transfers', 'history'],
        badge: 'Tasks',
        onSelect: () => {
          handleActivatePanel('explorer');
          void openFileOperationsWindow({ view: 'tasks' });
        },
      },
      {
        id: 'retry-failed-explorer-tasks',
        title: 'Retry Failed Explorer Tasks',
        subtitle: 'Re-run retryable failed or cancelled explorer operations.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'tasks', 'retry', 'failed'],
        badge: 'Retry',
        onSelect: () => {
          handleActivatePanel('explorer');
          void retryFailedExplorerTasks();
        },
      },
      {
        id: 'explorer-customize-layout-ui',
        title: 'Explorer: Customize Layout UI',
        subtitle: 'Open the ZBrush-style explorer chrome authoring mode.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'customize', 'layout', 'zbrush', 'chrome', 'buttons'],
        badge: 'Customize',
        shortcutLabel: formatHotkeyLabel(keybindings.toggleExplorerCustomize),
        onSelect: () => {
          handleActivatePanel('explorer');
          dispatchExplorerLayoutCommand('greeblefs:open-explorer-customize');
        },
      },
      {
        id: 'explorer-open-layout-switcher',
        title: 'Explorer: Open Layout Switcher',
        subtitle: 'Choose, save, or reset the active explorer layout without a hardcoded top-bar button.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'layout', 'switcher', 'canonical', 'reset', 'preset'],
        badge: 'Layouts',
        shortcutLabel: formatHotkeyLabel(keybindings.openExplorerLayoutSwitcher),
        onSelect: () => {
          handleActivatePanel('explorer');
          dispatchExplorerLayoutCommand('greeblefs:open-explorer-layout-switcher');
        },
      },
      {
        id: 'explorer-reset-layout-ui-canonical',
        title: 'Explorer: Reset Layout UI To Canonical',
        subtitle: 'Clear layout customization state and restore canonical explorer chrome.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'layout', 'reset', 'canonical', 'customize'],
        badge: 'Reset',
        onSelect: () => {
          handleActivatePanel('explorer');
          dispatchExplorerLayoutCommand('greeblefs:reset-layout-ui-to-canonical');
        },
      },
      {
        id: 'explorer-save-current-layout',
        title: 'Explorer: Save Current Layout',
        subtitle: 'Persist the active explorer layout package and chrome snapshot.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'layout', 'save', 'customize', 'chrome'],
        badge: 'Save',
        onSelect: () => {
          handleActivatePanel('explorer');
          dispatchExplorerLayoutCommand('greeblefs:save-current-explorer-layout');
        },
      },
      {
        id: 'clear-completed-explorer-tasks',
        title: 'Clear Completed Explorer Tasks',
        subtitle: 'Remove completed explorer tasks from recent history.',
        group: 'Explorer',
        kind: 'command',
        keywords: ['explorer', 'tasks', 'clear', 'history', 'completed'],
        badge: 'Clear',
        onSelect: () => {
          handleActivatePanel('explorer');
          void clearCompletedExplorerTasks();
        },
      },
      {
        id: 'lookdev-open-overlay',
        title: isLookdevSurfaceOpen ? 'Focus Lookdev Window' : 'Open Lookdev Window',
        subtitle: 'Open the semantic shell lookdev tool window beside the live workbench.',
        group: 'Lookdev',
        kind: 'command',
        keywords: ['lookdev', 'theme', 'customize', 'shell', 'window', 'dock', 'app'],
        badge: 'Lookdev',
        shortcutLabel: formatHotkeyLabel(keybindings.toggleLookdevOverlay),
        onSelect: () => {
          void handleOpenLookdevOverlay();
        },
      },
      {
        id: 'lookdev-toggle-overlay',
        title: isLookdevSurfaceOpen ? 'Close Lookdev Window' : 'Toggle Lookdev Window',
        subtitle: isLookdevSurfaceOpen
          ? 'Close the current lookdev draft and restore the baseline session state.'
          : 'Toggle the compact lookdev tool window beside the current shell.',
        group: 'Lookdev',
        kind: 'command',
        keywords: ['lookdev', 'toggle', 'close', 'open', 'window', 'draft'],
        badge: isLookdevSurfaceOpen ? 'Close' : 'Lookdev',
        shortcutLabel: formatHotkeyLabel(keybindings.toggleLookdevOverlay),
        onSelect: () => {
          void handleToggleLookdevOverlay();
        },
      },
      ...((() => {
        const activeLookdevCommandPresetId = lookdevSelectedPresetId || lookdevActiveAppliedPresetId;
        const activeLookdevCommandPreset = activeLookdevCommandPresetId
          ? lookdevPresets.find((preset) => preset.id === activeLookdevCommandPresetId) ?? null
          : null;
        if (!activeLookdevCommandPreset) {
          return [];
        }

        return [{
          id: 'lookdev-apply-selected-preset',
          title: `Apply Lookdev Preset: ${activeLookdevCommandPreset.name}`,
          subtitle: 'Reapply the selected lookdev preset against the current dock/app mode resolver.',
          group: 'Lookdev',
          kind: 'command',
          keywords: [
            'lookdev',
            'preset',
            'apply',
            activeLookdevCommandPreset.id,
            activeLookdevCommandPreset.name,
          ],
          badge: 'Preset',
          onSelect: () => {
            handleApplyLookdevPresetById(activeLookdevCommandPreset.id);
          },
        } satisfies OverlayCommandPaletteAction];
      })()),
      {
        id: 'refresh-plugins',
        title: 'Refresh Plugins',
        subtitle: 'Rescan legacy and package plugins, then reload their contributions.',
        group: 'App',
        kind: 'command',
        keywords: ['plugins', 'reload', 'rescan'],
        badge: 'Refresh',
        onSelect: () => refreshFolderPlugins(true),
      },
      {
        id: 'refresh-themes',
        title: 'Refresh Themes',
        subtitle: 'Reload theme packages and theme contributions.',
        group: 'App',
        kind: 'command',
        keywords: ['themes', 'reload'],
        badge: 'Refresh',
        onSelect: refreshThemePackages,
      },
      {
        id: 'refresh-shaders',
        title: 'Refresh Shaders',
        subtitle: 'Reload authored shaders and plugin shader contributions.',
        group: 'App',
        kind: 'command',
        keywords: ['shaders', 'reload'],
        badge: 'Refresh',
        onSelect: () => refreshAuthoredShaders(true),
      },
      {
        id: 'refresh-animations',
        title: 'Refresh Animations',
        subtitle: 'Reload authored animations.',
        group: 'App',
        kind: 'command',
        keywords: ['animations', 'reload'],
        badge: 'Refresh',
        onSelect: () => refreshAuthoredAnimations(true),
      },
      {
        id: 'refresh-wallpapers',
        title: 'Refresh Wallpapers',
        subtitle: 'Reload imported and authored wallpapers.',
        group: 'App',
        kind: 'command',
        keywords: ['wallpapers', 'backgrounds', 'reload'],
        badge: 'Refresh',
        onSelect: () => refreshAuthoredWallpapers(true),
      },
      {
        id: 'start-mobile-share',
        title: mobileSharePhase === 'running' ? 'Restart Mobile Share' : 'Start Mobile Share',
        subtitle: mobileSettings.remoteAccessMode === 'tailscale'
          ? 'Serve the mobile PWA for the current explorer folder over the configured tailnet path.'
          : 'Serve the mobile PWA for the current explorer folder over the LAN share tunnel.',
        group: 'Mobile',
        kind: 'command',
        keywords: ['mobile', 'pwa', 'ios', 'iphone', 'share', 'lan', 'remote', 'tailscale', 'tailnet'],
        badge: mobileSharePhase === 'running'
          ? 'Live'
          : mobileSettings.remoteAccessMode === 'tailscale' ? 'Tailnet' : 'Mobile',
        shortcutLabel: formatHotkeyLabel(keybindings.mobileShareToggle),
        onSelect: handleStartMobileShare,
      },
      {
        id: 'stop-mobile-share',
        title: 'Stop Mobile Share',
        subtitle: 'Shut down the active mobile PWA share server.',
        group: 'Mobile',
        kind: 'command',
        keywords: ['mobile', 'pwa', 'ios', 'iphone', 'share', 'lan', 'stop'],
        badge: 'Mobile',
        shortcutLabel: formatHotkeyLabel(keybindings.mobileShareToggle),
        onSelect: handleStopMobileShare,
      },
      {
        id: 'cycle-layout',
        title: 'Cycle Layout',
        subtitle: `Switch from ${activeLayoutProfile.label} to the next layout profile.`,
        group: 'Layout',
        kind: 'command',
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
        kind: 'command',
        keywords: ['dock', 'window', 'mode', 'overlay', 'app'],
        badge: windowMode === 'windowed' ? 'Dock' : 'App',
        shortcutLabel: formatHotkeyLabel(keybindings.windowModeToggle),
        onSelect: handleToggleWindowMode,
      },
      {
        id: 'toggle-zen-focus-mode',
        title: zenFocusMode ? 'Exit Zen Focus Mode' : 'Enter Zen Focus Mode',
        subtitle: zenFocusMode
          ? 'Restore the shell top bar and return to the normal chrome pass.'
          : 'Hide the shell top bar and foreground the explorer for a cleaner browsing surface.',
        group: 'Layout',
        kind: 'command',
        keywords: ['zen', 'focus', 'chrome', 'top bar', 'immersive', 'explorer'],
        badge: zenFocusMode ? 'Zen On' : 'Zen Off',
        shortcutLabel: formatHotkeyLabel(keybindings.zenFocusModeToggle),
        onSelect: handleToggleZenFocusMode,
      },
      ...(windowMode === 'overlay'
        ? resolvedDockPresentation.presentation.allowedPlacements.map((placement) => {
            const placementLabel =
              placement === 'floating'
                ? 'Floating'
                : placement === 'top-edge'
                  ? 'Top Edge'
                  : 'Bottom Edge';
            return {
              id: `set-dock-placement:${placement}`,
              title: `Dock Placement: ${placementLabel}`,
              subtitle:
                placement === 'floating'
                  ? 'Restore the dock shell as a draggable freeform window.'
                  : `Anchor the dock shell to the ${placement === 'top-edge' ? 'top' : 'bottom'} edge.`,
              group: 'Layout',
              kind: 'command',
              keywords: ['dock', 'placement', 'float', 'floating', 'top', 'bottom', 'edge'],
              badge: dockPlacementMode === placement ? 'Active' : 'Dock',
              onSelect: () => handleSetDockPlacementMode(placement),
            } satisfies OverlayCommandPaletteAction;
          })
        : []),
    ];

    const settingsSectionActions = settingsSectionCatalog
      .filter(section => section.key !== 'overview')
      .map<OverlayCommandPaletteAction>(section => ({
        id: `open-settings-section:${section.key}`,
        title: `Open ${section.label} Settings`,
        subtitle: section.overviewSummary,
        group: 'Settings',
        kind: 'command',
        keywords: [
          section.key,
          section.label,
          section.subtitle,
          section.overviewSummary,
          ...section.keywords,
        ],
        badge: 'Section',
        onSelect: () => handleOpenSettingsSection(section.key as SettingsSectionKey),
      }));

    const managedContentDirectoryActions = managedContentDirectoryCatalog.map<OverlayCommandPaletteAction>(entry => ({
      id: `open-managed-content-folder:${entry.id}`,
      title: `Open ${entry.label} Folder`,
      subtitle: entry.description,
      group: 'Content',
      kind: 'command',
      keywords: [entry.id, entry.label, entry.description, ...entry.keywords],
      badge: 'Folder',
      onSelect: () => void openManagedContentDirectory(entry.id as ManagedContentDirectoryId),
    }));

    const panelActions = panelDefinitions
      .filter(panel => !pinnedPanelIds.includes(panel.id))
      .map<OverlayCommandPaletteAction>(panel => ({
        id: `panel:${panel.id}`,
        title: `Open ${panel.label}`,
        subtitle: panel.description,
        group: panel.kind === 'folder-plugin' ? 'Plugin Panels' : 'Panels',
        kind: panel.kind === 'folder-plugin' ? 'plugin' : 'panel',
        keywords: [panel.id, panel.label, panel.description],
        badge: panel.kind === 'folder-plugin' ? 'Plugin' : 'Panel',
        onSelect: () => handleActivatePanel(panel.id),
      }));

    const pluginCommandActions = pluginCommands.map<OverlayCommandPaletteAction>(command => ({
      id: `plugin-command:${command.id}`,
      title: command.name,
      subtitle: command.description || command.command,
      group: 'Plugin Commands',
      kind: 'plugin',
      keywords: [command.pluginName, command.command, command.description ?? ''],
      badge: command.pluginName,
      onSelect: () => {
        if (command.vscodeCommand) {
          void executeVsCodeCommand(command.vscodeCommand).catch((error) => {
            console.error('Failed to execute VS Code command', error);
          });
          return;
        }
        dispatchTerminalCommand(command.command, command.runOnSelect);
      },
    }));

    const globalSearchFileActions = commandPaletteQuery.trim().length > 0
      ? globalSearchResults.map<OverlayCommandPaletteAction>((result) => ({
        id: `global-search-result:${result.path}`,
        title: result.name,
        subtitle: result.path,
        group: result.isDir ? 'Folders' : 'Files',
        kind: 'file',
        keywords: [
          'global search',
          result.path,
          result.extension ?? '',
          result.isDir ? 'folder' : 'file',
        ],
        badge: result.isDir ? 'Folder' : (result.extension?.toUpperCase() || 'File'),
        onSelect: () => handleOpenGlobalSearchResult(result),
      }))
      : [];

    const globalSearchControlAction: OverlayCommandPaletteAction = {
      id: 'global-search-toggle-scan',
      title: globalSearchStatus?.isScanInProgress || globalSearchStatus?.isCommitting
        ? 'Cancel Global Search Scan'
        : globalSearchStatus?.isIndexValid && globalSearchStatus.indexedItemCount > 0
          ? 'Rebuild Global Search Index'
          : 'Build Global Search Index',
      subtitle: globalSearchStatus?.isScanInProgress || globalSearchStatus?.isCommitting
        ? 'Stop the active machine-wide filename indexing pass.'
        : 'Index local drive roots so the command palette can jump to files instantly.',
      group: 'Search',
      kind: 'command',
      keywords: ['global search', 'files', 'index', 'scan', 'reindex', 'palette'],
      badge: 'Search',
      onSelect: () => (
        globalSearchStatus?.isScanInProgress || globalSearchStatus?.isCommitting
          ? cancelGlobalSearchScan()
          : startGlobalSearchScan()
      ),
    };

    return [
      ...globalSearchFileActions,
      globalSearchControlAction,
      ...builtInActions,
      ...settingsSectionActions,
      ...managedContentDirectoryActions,
      ...panelActions,
      ...pluginCommandActions,
    ];
  }, [
    activeLayoutProfile.label,
    cancelGlobalSearchScan,
    commandPaletteQuery,
    dispatchExplorerLayoutCommand,
    globalSearchResults,
    globalSearchStatus,
    handleActivatePanel,
    handleApplyLookdevPresetById,
    handleCycleLayout,
    handleOpenGlobalSearchResult,
    handleOpenLookdevOverlay,
    handleOpenSettings,
    handleOpenSettingsSection,
    handleStartMobileShare,
    handleStopMobileShare,
    handleSetDockPlacementMode,
    handleToggleZenFocusMode,
    handleToggleLookdevOverlay,
    handleToggleWindowMode,
    keybindings.mobileShareToggle,
    keybindings.openExplorerLayoutSwitcher,
    keybindings.toggleLookdevOverlay,
    keybindings.toggleExplorerCustomize,
    keybindings.windowModeToggle,
    keybindings.zenFocusModeToggle,
    lookdevActiveAppliedPresetId,
    isLookdevSurfaceOpen,
    lookdevPresets,
    lookdevSelectedPresetId,
    dockPlacementMode,
    overlayAnchor,
    openManagedContentDirectory,
    pinnedPanelIds,
    panelDefinitions,
    pluginCommands,
    mobileSharePhase,
    mobileSettings.remoteAccessMode,
    refreshAuthoredAnimations,
    refreshAuthoredWallpapers,
    refreshAuthoredShaders,
    refreshFolderPlugins,
    refreshThemePackages,
    resolvedDockPresentation.presentation.allowedPlacements,
    startGlobalSearchScan,
    windowMode,
    zenFocusMode,
  ]);

  const persistentCommandPaletteActionIds = useMemo(
    () => commandPaletteActions
      .filter((action) => action.kind !== 'file')
      .map((action) => action.id),
    [commandPaletteActions],
  );

  useEffect(() => {
    pruneCommandPaletteActionIds(persistentCommandPaletteActionIds);
  }, [persistentCommandPaletteActionIds, pruneCommandPaletteActionIds]);

  const interactiveCommandPaletteActions = useMemo<OverlayCommandPaletteAction[]>(
    () => commandPaletteActions.map((action) => ({
      ...action,
      onSelect: () => {
        if (action.kind !== 'file') {
          recordCommandPaletteActionUsage(action.id);
        }
        return action.onSelect();
      },
    })),
    [commandPaletteActions, recordCommandPaletteActionUsage],
  );

  useEffect(() => {
    let cancelled = false;

    const syncNativeBlur = async () => {
      try {
        unwrapTauriResult(await commands.windowSetBlur(
          effectiveShellBlurEnabled && overlayPhase !== 'closed',
          effectiveShellBlurStrength,
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
  }, [effectiveShellBlurEnabled, effectiveShellBlurStrength, overlayPhase]);

  const activeContentPanel = activePanelId ? panelLookup.get(activePanelId) ?? null : null;
  const usesNavigationSidebar = renderRuntime.launcherPlacement === 'sidebar';
  const usesInsetContentShell = renderRuntime.contentLayout !== 'tabbed';
  const contentStagePadding = renderRuntime.contentLayout === 'desktop-card'
    ? 14
    : usesNavigationSidebar
      ? 10
      : 0;
  const contentShellStyle: CSSProperties = usesInsetContentShell
    ? {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        contain: 'layout paint style',
        isolation: 'isolate',
        margin: contentStagePadding,
        border: '1px solid var(--overlay-workbench-chrome-border)',
        borderRadius: workbench.metrics.panelRadius,
        background: renderRuntime.contentLayout === 'desktop-card'
          ? 'var(--overlay-workbench-shell-bg)'
          : 'var(--overlay-bg-panel)',
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        backdropFilter: effectiveShellBlurEnabled && workbench.panelStyle === 'glass'
          ? resolveConditionalBlurFilter({ enabled: true, blurPx: Math.min(effectiveShellBlurStrength, 18) })
          : 'none',
        WebkitBackdropFilter: effectiveShellBlurEnabled && workbench.panelStyle === 'glass'
          ? resolveConditionalBlurFilter({ enabled: true, blurPx: Math.min(effectiveShellBlurStrength, 18) })
          : 'none',
      }
    : {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        contain: 'layout paint style',
        isolation: 'isolate',
      };
  const shellShaderContext = useMemo<OverlayShaderShellContext>(() => ({
    ...(activeShader ?? {
      id: shaderSystemConfig.fallbackShaderId,
      name: 'None',
      filePath: 'builtin:none',
      shaderRoot: 'builtin',
      source: 'built-in' as const,
    }),
    viewport: {
      width: themeRendererViewport.width,
      height: themeRendererViewport.height,
    },
    accentColor: accent,
    theme,
    panelTransparency: clampedPanelTransparency,
    blurStrength: effectiveShellBlurStrength,
    zoom: clampedAppZoom,
    isSettingsActive: activePanelId === 'settings',
    shaderControlValues: activeShaderControlValues,
  }), [
    activePanelId,
    activeShader,
    activeShaderControlValues,
    accent,
    clampedAppZoom,
    clampedPanelTransparency,
    effectiveShellBlurStrength,
    theme,
    themeRendererViewport.height,
    themeRendererViewport.width,
  ]);
  const renderWallpaperBackground = useCallback((contextOverrides?: Partial<OverlayWallpaperRenderContext>) => (
    <WallpaperBackgroundLayer
      wallpaper={activeWallpaper}
      context={{
        ...shellWallpaperContext,
        ...(contextOverrides ?? {}),
      }}
    />
  ), [activeWallpaper, shellWallpaperContext]);
  const renderWallpaperBackdropStack = useCallback(() => (
    <>
      {renderWallpaperBackground()}
      {shellEffectsPolicy.showThemeEffectBackdrop && shellThemeEffectBackgroundImage ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: shellThemeEffectBackgroundImage,
            backgroundSize: theme.effects.backgroundSize,
            backgroundPosition: theme.effects.backgroundPosition,
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : null}
    </>
  ), [
    renderWallpaperBackground,
    shellEffectsPolicy.showThemeEffectBackdrop,
    shellThemeEffectBackgroundImage,
    theme.effects.backgroundPosition,
    theme.effects.backgroundSize,
  ]);
  const renderPanelBody = useCallback((panel: OverlayPanelDefinition, isActive: boolean) => {
    if (panel.kind === 'folder-plugin') {
      return (
        <FolderPluginRenderer
          plugin={enabledFolderPlugins.find(candidate => candidate.id === panel.id) ?? {
            id: panel.id,
            name: panel.label,
            filePath: '',
            pluginRoot: '',
            pluginDirectory: '',
            backendDirectory: '',
            enablementKey: panel.id,
            modified: 0,
            enabled: true,
            defaultOpen: panel.defaultOpen ?? false,
            keepMounted: panel.keepMounted ?? false,
            component: null,
            error: 'Plugin definition not found.',
            diagnostics: {
              sourceKind: 'file-plugin',
              sourceLabel: panel.label,
              category: 'General',
              tags: [],
              testFiles: [],
              warnings: ['Plugin definition not found.'],
              capabilities: {
                panel: true,
                themes: 0,
                shaders: 0,
                fonts: 0,
                commands: 0,
                actions: 0,
                explorerActions: 0,
                contextMenuItems: 0,
                previewLanes: 0,
                settingsSlots: 0,
              },
            },
          }}
          appearance={resolvedAppearance}
          createPluginApi={createPluginApi}
          hostMode="panel-tab"
          isActive={isActive}
        />
      );
    }

    return panel.render();
  }, [createPluginApi, enabledFolderPlugins, resolvedAppearance]);
  const renderManagedPanelSurface = useCallback((
    panelId: string,
    options?: {
      forceMount?: boolean;
      forceVisible?: boolean;
      style?: CSSProperties;
    },
  ) => {
    const panel = panelLookup.get(panelId);
    if (!panel) {
      return null;
    }

    const isPanelOpen = openPanelIds.includes(panel.id);
    const isActive = panel.id === activePanelId;
    const isPinned = pinnedPanelIds.includes(panel.id);
    const shouldMount = options?.forceMount
      ?? (!isPinned && (panel.keepMounted ? isPanelOpen : isPanelOpen && isActive));

    if (!shouldMount) {
      return null;
    }

    const shouldDisplay = options?.forceVisible ?? (isPinned || (isPanelOpen && isActive));
    return (
      <div
        key={`panel-surface:${panel.id}`}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          display: shouldDisplay ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
          contain: 'layout paint style',
          isolation: 'isolate',
          ...(options?.style ?? {}),
        }}
      >
        {renderPanelBody(panel, isActive)}
      </div>
    );
  }, [
    activePanelId,
    openPanelIds,
    panelLookup,
    pinnedPanelIds,
    renderPanelBody,
  ]);
  const renderWorkbenchIdeSurfaceBody = useCallback((surfaceId: string, isActive: boolean) => {
    const panel = panelLookup.get(surfaceId);
    if (!panel) {
      return null;
    }

    return renderPanelBody(panel, isActive);
  }, [panelLookup, renderPanelBody]);
  const dedicatedSecondaryWorkbenchSurfaceDefinition = dedicatedSecondarySurfaceId
    ? workbenchSurfaceLookup.get(dedicatedSecondarySurfaceId) ?? null
    : null;
  const dedicatedLookdevWindowContent = isDedicatedLookdevSecondaryWindow
    ? (
      <LookdevOverlay
        appearance={resolvedAppearance}
        themePackages={combinedThemePackages}
        topBarPackages={topBarPackages}
        dockPresentationPackages={dockPresentationPackages}
        menuPacks={combinedMenuPacks}
        actions={combinedExplorerActions}
        onRefreshLookdevPresets={() => refreshLookdevPresets(true)}
        onRefreshThemes={() => refreshThemePackages(true)}
        onRefreshTopBars={() => refreshTopBarCatalog()}
        onRefreshDockPresentations={() => refreshDockPresentationPackages(true)}
        onRefreshMenuPacks={() => refreshMenuPacks(true)}
        onOpenSettingsSection={handleOpenSettingsSection}
        onToggleTopBarCustomize={handleToggleTopBarCustomize}
        hostMode="secondary-window"
        forceVisible
        runtimePlatform={runtimePlatform}
        isWindowMaximized={isWindowMaximized}
        sourceWindowLabel={secondaryWindowDescriptor?.sourceWindowLabel ?? null}
        onRequestCloseWindow={() => closeDedicatedLookdevWindow()}
      />
    )
    : null;
  const dedicatedSecondaryWorkbenchWindowContent = isDedicatedSecondaryWorkbenchSurfaceWindow
    && dedicatedSecondarySurfaceId
    ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          background: theme.palette.panelBackground,
          color: theme.palette.textPrimary,
          fontFamily: resolvedAppearance.fonts.ui,
        }}
      >
        <div
          onPointerDown={(event) => {
            if (
              event.button !== 0
              || (event.target instanceof HTMLElement
                && event.target.closest('[data-gfs-window-drag-exclusion="true"]'))
            ) {
              return;
            }

            void getCurrentWindow().startDragging().catch(() => undefined);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 38,
            padding: '0 12px',
            borderBottom: `1px solid ${theme.palette.border}`,
            background: theme.palette.appBackgroundAlt,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              minWidth: 0,
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {secondaryWindowDescriptor?.title
              ?? dedicatedSecondaryWorkbenchSurfaceDefinition?.label
              ?? 'Workbench Surface'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {secondaryWindowDescriptor?.dockTarget ? (
              <button
                type="button"
                data-gfs-window-drag-exclusion="true"
                onClick={() => {
                  void dockBackSecondaryWindow(secondaryWindowDescriptor.windowId).catch(() => undefined);
                }}
                style={{
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: `1px solid ${theme.palette.border}`,
                  background: 'var(--overlay-workbench-chrome-button-bg)',
                  color: theme.palette.textPrimary,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Dock Back
              </button>
            ) : null}
            <button
              type="button"
              data-gfs-window-drag-exclusion="true"
              onClick={() => {
                if (!secondaryWindowDescriptor) {
                  return;
                }

                void closeSecondaryWindow(secondaryWindowDescriptor.windowId).catch(() => undefined);
              }}
              style={{
                height: 24,
                padding: '0 10px',
                borderRadius: 999,
                border: `1px solid ${theme.palette.border}`,
                background: 'var(--overlay-workbench-chrome-button-bg)',
                color: theme.palette.textPrimary,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {dedicatedSecondaryWorkbenchSurfaceDefinition
            ? renderWorkbenchIdeSurfaceBody(dedicatedSecondarySurfaceId, true)
            : (
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: '100%',
                  height: '100%',
                  padding: 24,
                  color: theme.palette.textMuted,
                  fontSize: 12,
                }}
              >
                This native workbench surface is no longer available.
              </div>
            )}
        </div>
      </div>
    )
    : null;
  const dedicatedSecondaryWindowContent = dedicatedLookdevWindowContent
    ?? dedicatedSecondaryWorkbenchWindowContent;
  const renderPinnedPanelSurface = useCallback((side: 'left' | 'right') => {
    const entries = side === 'left' ? leftPinnedPanels : rightPinnedPanels;
    return entries.map(({ panel, definition }) => (
      <LayoutPinnedPanelSlot key={`${panel.side}:${panel.panelId}`} panel={panel} definition={definition} />
    ));
  }, [leftPinnedPanels, rightPinnedPanels]);
  const defaultNavigationSurface = !activeShellUsesIdeWorkbench && usesNavigationSidebar ? (
    <WorkbenchNavigationSurface
      appearance={resolvedAppearance}
      runtime={renderRuntime}
      panels={panelDefinitions}
      pinnedPanelIds={activeWorkbenchPinnedPanelIds}
      activePanelId={activeWorkbenchActivePanelId}
      openPanelIds={activeWorkbenchOpenPanelIds}
      onActivatePanel={handleActivatePanel}
    />
  ) : null;
  const classicContentSurface = (
    <div style={contentShellStyle}>
      {panelDefinitions.map(panel => renderManagedPanelSurface(panel.id))}

      {!activeContentPanel && openPanels.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.palette.textMuted,
          fontSize: 13,
          background: usesInsetContentShell ? 'transparent' : theme.palette.shellBackground,
          fontFamily: resolvedAppearance.fonts.ui,
          padding: 24,
          textAlign: 'center',
        }}
        >
          {usesNavigationSidebar
            ? 'Choose a panel from the launcher to bring its surface forward.'
            : 'No tabbed panels are open. Use the panel menu to bring one back.'}
        </div>
      )}
    </div>
  );
  const classicWorkbenchContent = (
    <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {renderPinnedPanelSurface('left')}

      <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
        {defaultNavigationSurface}
        {classicContentSurface}
      </div>

      {renderPinnedPanelSurface('right')}
    </div>
  );
  const ideWorkbenchContent = (
    <WorkbenchIdeShell
      appearance={resolvedAppearance}
      surfaces={workbenchSurfaceDefinitions}
      surfaceSeeds={workbenchSurfaceSeeds}
      layoutState={resolvedIdeWorkbenchLayoutState}
      onLayoutStateChange={updateActiveIdeWorkbenchLayoutState}
      onRequestFocusSurface={focusExternalizedWorkbenchSurface}
      onRequestExternalizeSurface={(surfaceId, placement) => {
        void openWorkbenchSurfaceInNativeWindow(surfaceId, {
          restorePlacement: placement,
        });
      }}
      renderSurfaceBody={renderWorkbenchIdeSurfaceBody}
    />
  );
  const defaultContentSurface = activeShellUsesIdeWorkbench
    ? ideWorkbenchContent
    : classicContentSurface;
  const defaultWorkbenchContent = activeShellUsesIdeWorkbench
    ? ideWorkbenchContent
    : classicWorkbenchContent;
  const themeRendererApiSupported = !activeThemeRenderer
    || activeThemeRenderer.apiVersion === overlayThemeRendererApiVersion;
  const themeRendererOwnsWindowChrome = Boolean(
    activeThemeRenderer?.surfaceOwnership.chrome,
  );
  const shouldBypassThemeRendererForWindowedChrome = isWindowedMode
    && themeRendererOwnsWindowChrome;
  const canRenderThemeRenderer = Boolean(activeThemeRenderer?.component)
    && !activeThemeRenderer?.error
    && !themeRendererRuntimeError
    && themeRendererApiSupported
    && !shouldBypassThemeRendererForWindowedChrome;
  const themeRenderer = canRenderThemeRenderer ? activeThemeRenderer : null;
  const effectiveThemeRendererSurfaceOwnership = themeRenderer?.surfaceOwnership ?? null;
  const themeRendererControlsWallpaper = Boolean(
    themeRenderer
      && (themeRenderer.capabilities.wallpaperScene || themeRenderer.surfaceOwnership.wallpaper),
  );
  const themeRendererDefaultWorkbenchContent = (
    <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {!effectiveThemeRendererSurfaceOwnership?.pinnedPanels && renderPinnedPanelSurface('left')}

      <div style={{ position: 'relative', flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
        {!effectiveThemeRendererSurfaceOwnership?.launcher && defaultNavigationSurface}
        {activeShellUsesIdeWorkbench ? ideWorkbenchContent : classicContentSurface}
      </div>

      {!effectiveThemeRendererSurfaceOwnership?.pinnedPanels && renderPinnedPanelSurface('right')}
    </div>
  );
  const topBarShaderLayer = shellEffectsPolicy.showTopBarShader
    ? (
      <ShaderSurfaceLayer
        shader={activeShader}
        shellContext={shellShaderContext}
        surface="topBar"
      />
      )
    : null;
  const commonWorkbenchTopBarProps = {
    appearance: resolvedAppearance,
    renderRuntime,
    layoutProfile: activeLayoutProfile,
    layoutSourcePath: layoutConfigSource,
    availableLayoutProfiles,
    panels: panelDefinitions,
    openPanelIds: activeWorkbenchOpenPanelIds,
    pinnedPanelIds: activeWorkbenchPinnedPanelIds,
    activePanelId: activeWorkbenchActivePanelId,
    onPanelSelect: handleTopBarSelectPanel,
    onPanelToggle: handleTopBarTogglePanel,
    onPanelClose: handleTopBarClosePanel,
    onPanelReorder: handleReorderPanels,
    onOpenSettings: handleOpenSettings,
    onToggleShellMode: handleToggleShellMode,
    onSelectLayoutProfile: handleSelectLayoutProfile,
    onCycleLayout: handleCycleLayout,
    onSetWindowMode: (mode: TerminalWindowMode) => {
      void requestWindowModeChange(mode);
    },
    onOpenCommandPalette: handleOpenCommandPalette,
    onToggleOverlayAnchor: handleToggleOverlayAnchor,
    dockPlacementMode,
    dockAllowedPlacements: resolvedDockPresentation.presentation.allowedPlacements,
    dockEdgeSize: resolvedDockPresentation.edgeSize,
    dockEdgeWidth: resolvedDockPresentation.edgeWidth,
    dockDefaultTerminalRows: resolvedDockPresentation.defaultTerminalRows,
    dockDefaultTerminalColumns: resolvedDockPresentation.defaultTerminalColumns,
    dockTerminalGrid: activeDockResizeGrid,
    dockTerminalFontSize: settings.fontSize,
    dockTopBarHeight,
    dockPreviewEnabled: resolvedDockPresentation.previewPolicy.enabled,
    dockPreviewSplitMode: resolvedDockPresentation.previewPolicy.splitMode,
    onSetDockPlacementMode: handleSetDockPlacementMode,
    onUpdateDockSettings: updateDock,
    onOpenDockSettings: () => handleOpenSettingsSection('dock'),
    onClose: () => {
      void hideOverlay();
    },
    accent,
    blur: effectiveShellBlurEnabled,
    blurStrength: effectiveShellBlurStrength,
    blurPlatform: runtimePlatform,
    appOpacity: clampedAppOpacity,
    panelTransparency: clampedPanelTransparency,
    appZoom: clampedAppZoom,
    onUpdateAppearanceVisuals: updateAppearance,
    windowMode,
    overlayAnchor,
    surfaceOwnership: effectiveThemeRendererSurfaceOwnership,
    commandPaletteShortcutLabel: formatHotkeyLabel(keybindings.commandPalette),
    mobileShareShortcutLabel: formatHotkeyLabel(keybindings.mobileShareToggle),
    toggleShortcutLabel: formatHotkeyLabel(keybindings.terminalToggle),
    mobileShareRemoteAccessMode: mobileSettings.remoteAccessMode,
    mobileSharePhase,
    mobileShareSession,
    mobileShareError,
    mobileShareNotice,
    onToggleMobileShare: handleToggleMobileShare,
    onStartMobileShare: handleStartMobileShareQuiet,
    onStopMobileShare: handleStopMobileShareQuiet,
    onSetMobileShareRemoteAccessMode: handleSetMobileShareRemoteAccessMode,
    onOpenMobileSettings: () => handleOpenSettingsSection('mobile'),
    zenFocusMode,
    zenFocusShortcutLabel: formatHotkeyLabel(keybindings.zenFocusModeToggle),
    onToggleZenFocusMode: handleToggleZenFocusMode,
    topBarShaderLayer,
    topBarDefinition: resolvedTopBarSelection.topBar,
    topBarCustomizeActive,
    onToggleTopBarCustomize: handleToggleTopBarCustomize,
    topBarLayoutSnapshot: resolvedTopBarLayoutSnapshot,
    onCommitTopBarLayoutSnapshot: handleCommitTopBarLayoutSnapshot,
  };
  const chromeBar = (
    <WorkbenchTopBar {...commonWorkbenchTopBarProps} />
  );
  const chromeContentSurface = (
    <WorkbenchTopBar
      {...commonWorkbenchTopBarProps}
      surfaceMode="content-only"
    />
  );
  const windowControlsSurface = (
    <WorkbenchTopBar
      {...commonWorkbenchTopBarProps}
      surfaceMode="window-controls-only"
    />
  );
  const dockResizeTelemetryHud = !isWindowedMode && dockResizeTelemetry ? (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        left: '50%',
        top: isTopAnchored ? 'auto' : 12,
        bottom: isTopAnchored ? 12 : 'auto',
        transform: 'translateX(-50%)',
        zIndex: 42,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: workbench.metrics.controlRadius,
        border: `1px solid ${accent}66`,
        background: 'var(--overlay-workbench-chrome-menu-bg)',
        color: theme.palette.textPrimary,
        fontFamily: resolvedAppearance.fonts.mono,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        pointerEvents: 'none',
      }}
    >
      <span>{formatDockTerminalGrid(dockResizeTelemetry.grid)}</span>
      <span style={{ color: theme.palette.textMuted }}>
        {Math.round(dockResizeTelemetry.edgeWidth)}px x {Math.round(dockResizeTelemetry.edgeSize)}px
      </span>
    </div>
  ) : null;
  const defaultShellBody = (
    <>
      {dockResizeTelemetryHud}
      {!isWindowedMode && !dockIsFloating && !isTopAnchored && canResizeOverlayShell && (
        <div
          className="h-[4px] shrink-0 cursor-ns-resize select-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
          onPointerDown={e => {
            if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('North').catch(() => {}); }
          }}
        />
      )}

      {!zenFocusMode && (isWindowedMode || activeLayoutProfile.chrome.barPosition === 'top') && chromeBar}

      {defaultWorkbenchContent}

      {!zenFocusMode && !isWindowedMode && activeLayoutProfile.chrome.barPosition === 'bottom' && chromeBar}

      {!isWindowedMode && !dockIsFloating && isTopAnchored && canResizeOverlayShell && (
        <div
          className="h-[4px] shrink-0 cursor-ns-resize select-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
          onPointerDown={e => {
            if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('South').catch(() => {}); }
          }}
        />
      )}
    </>
  );
  const themeRendererDefaultShellBody = (
    <>
      {dockResizeTelemetryHud}
      {!isWindowedMode && !dockIsFloating && !isTopAnchored && canResizeOverlayShell && (
        <div
          className="h-[4px] shrink-0 cursor-ns-resize select-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
          onPointerDown={e => {
            if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('North').catch(() => {}); }
          }}
        />
      )}

      {!zenFocusMode && !effectiveThemeRendererSurfaceOwnership?.chrome && (isWindowedMode || activeLayoutProfile.chrome.barPosition === 'top') && chromeBar}

      {themeRendererDefaultWorkbenchContent}

      {!zenFocusMode && !effectiveThemeRendererSurfaceOwnership?.chrome && !isWindowedMode && activeLayoutProfile.chrome.barPosition === 'bottom' && chromeBar}

      {!isWindowedMode && !dockIsFloating && isTopAnchored && canResizeOverlayShell && (
        <div
          className="h-[4px] shrink-0 cursor-ns-resize select-none"
          style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}99 30%, ${accent} 50%, ${accent}99 70%, transparent 100%)` }}
          onPointerDown={e => {
            if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('South').catch(() => {}); }
          }}
        />
      )}
    </>
  );
  const themeRendererPanels = useMemo<OverlayThemeRendererPanel[]>(
    () => panelDefinitions.map(panel => ({
      id: panel.id,
      label: panel.label,
      description: panel.description,
      kind: panel.kind,
      icon: panel.icon,
      navigation: panel.navigation,
      defaultOpen: panel.defaultOpen,
      keepMounted: panel.keepMounted ?? false,
      isActive: panel.id === activePanelId,
      isOpen: openPanelIds.includes(panel.id),
      isPinned: pinnedPanelIds.includes(panel.id),
    })),
    [activePanelId, openPanelIds, panelDefinitions, pinnedPanelIds],
  );
  const themeRendererLauncherPanels = useMemo(
    () => themeRendererPanels
      .filter(panel => !panel.isPinned)
      .map(panel => ({
        ...panel,
        activate: () => handleActivatePanel(panel.id),
      })),
    [handleActivatePanel, themeRendererPanels],
  );
  const themeRendererLauncherGroups = useMemo(() => {
    const panelById = new Map(themeRendererLauncherPanels.map(panel => [panel.id, panel] as const));
    return groupPanelsForWorkbenchNavigation(themeRendererPanels.filter(panel => !panel.isPinned))
      .map(group => ({
        ...group,
        panels: group.panels
          .map(panel => panelById.get(panel.id))
          .filter((panel): panel is typeof themeRendererLauncherPanels[number] => Boolean(panel)),
      }));
  }, [themeRendererLauncherPanels, themeRendererPanels]);
  const themeRendererUtilityActions = useMemo(
    () => [
      {
        id: 'cycle-layout',
        label: activeLayoutProfile.label,
        title: `Cycle layout (${activeLayoutProfile.label})`,
        icon: <LayoutGrid size={12} />,
        isVisible: true,
        onSelect: handleCycleLayout,
      },
      {
        id: 'command-palette',
        label: 'Commands',
        title: `Open command palette (${formatHotkeyLabel(keybindings.commandPalette)})`,
        icon: <Search size={12} />,
        isVisible: true,
        onSelect: handleOpenCommandPalette,
      },
      {
        id: 'open-settings',
        label: 'Settings',
        title: 'Open Settings',
        icon: <Settings2 size={12} />,
        isVisible: true,
        onSelect: handleOpenSettings,
      },
      {
        id: 'toggle-window-mode',
        label: windowMode === 'overlay' ? 'Dock' : 'App',
        title: windowMode === 'overlay' ? 'Switch to application mode' : 'Switch to dock mode',
        icon: <TerminalIcon size={12} />,
        isActive: windowMode === 'overlay',
        isVisible: true,
        onSelect: () => { void requestWindowModeChange(windowMode === 'overlay' ? 'windowed' : 'overlay'); },
      },
      {
        id: 'toggle-zen-focus-mode',
        label: zenFocusMode ? 'Zen On' : 'Zen Off',
        title: zenFocusMode ? 'Exit zen focus mode' : 'Enter zen focus mode',
        icon: <LayoutGrid size={12} />,
        isActive: zenFocusMode,
        isVisible: true,
        onSelect: handleToggleZenFocusMode,
      },
      {
        id: 'toggle-overlay-anchor',
        label: overlayAnchor === 'top' ? 'Top Edge' : 'Bottom Edge',
        title: `Dock overlay to the ${overlayAnchor === 'top' ? 'bottom' : 'top'} edge`,
        icon: <ChevronDown size={12} />,
        isVisible: windowMode === 'overlay',
        onSelect: handleToggleOverlayAnchor,
      },
    ],
    [
      activeLayoutProfile.label,
      handleCycleLayout,
      handleOpenCommandPalette,
      handleOpenSettings,
      handleToggleOverlayAnchor,
      handleToggleZenFocusMode,
      keybindings.commandPalette,
      overlayAnchor,
      windowMode,
      zenFocusMode,
    ],
  );
  const themeRendererShellModel = useMemo<OverlayThemeRendererShellModel>(() => {
    const leftPinnedWidth = leftPinnedPanels.length > 0
      ? Math.max(...leftPinnedPanels.map(entry => entry.panel.size))
      : 0;
    const rightPinnedWidth = rightPinnedPanels.length > 0
      ? Math.max(...rightPinnedPanels.map(entry => entry.panel.size))
      : 0;
    const normalizedLayout = normalizeThemeRendererShellLayout({
      viewportWidth: themeRendererViewport.width,
      viewportHeight: themeRendererViewport.height,
      shellInset: resolvedAppearance.workbenchTheme.metrics.shellInset,
      panelGap: resolvedAppearance.workbenchTheme.metrics.panelGap,
      contentInnerPadding: contentStagePadding,
      chromeHeight: zenFocusMode ? 0 : resolvedAppearance.workbenchTheme.metrics.chromeHeight,
      launcherVisible: renderRuntime.launcherPlacement === 'sidebar' && themeRendererLauncherGroups.length > 0,
      launcherWidth: renderRuntime.navigationRailWidth,
      leftPinnedWidth,
      rightPinnedWidth,
    });

    return {
      layout: normalizedLayout,
      launcher: {
        railWidth: normalizedLayout.regions.launcher.width,
        groups: themeRendererLauncherGroups,
        panels: themeRendererLauncherPanels,
      },
      chrome: {
        utilityActions: themeRendererUtilityActions.filter(action => action.isVisible),
      },
    };
  }, [
    contentStagePadding,
    leftPinnedPanels,
    renderRuntime.launcherPlacement,
    renderRuntime.navigationRailWidth,
    resolvedAppearance.workbenchTheme.metrics.chromeHeight,
    resolvedAppearance.workbenchTheme.metrics.panelGap,
    resolvedAppearance.workbenchTheme.metrics.shellInset,
    rightPinnedPanels,
    themeRendererLauncherGroups,
    themeRendererLauncherPanels,
    themeRendererUtilityActions,
    themeRendererViewport.height,
    themeRendererViewport.width,
    zenFocusMode,
  ]);
  const themeRendererUtilityActionSurface = useMemo(() => {
    const actions = themeRendererShellModel.chrome.utilityActions;
    if (actions.length === 0) {
      return null;
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {actions.map(action => (
          <button
            key={action.id}
            type="button"
            title={action.title}
            onClick={action.onSelect}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 34,
              padding: '8px 12px',
              borderRadius: 999,
              border: `1px solid ${action.isActive ? `${accent}66` : `${theme.palette.border}44`}`,
              background: action.isActive
                ? `linear-gradient(180deg, ${accent}26, ${accent}14)`
                : 'rgba(12, 16, 28, 0.18)',
              color: theme.palette.textPrimary,
              fontFamily: resolvedAppearance.fonts.ui,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              backdropFilter: effectiveShellBlurEnabled
                ? resolveConditionalBlurFilter({
                    enabled: true,
                    blurPx: Math.min(effectiveShellBlurStrength, 12),
                    saturateBoost: 0.18,
                  })
                : undefined,
              WebkitBackdropFilter: effectiveShellBlurEnabled
                ? resolveConditionalBlurFilter({
                    enabled: true,
                    blurPx: Math.min(effectiveShellBlurStrength, 12),
                    saturateBoost: 0.18,
                  })
                : undefined,
              boxShadow: action.isActive ? `0 12px 28px ${accent}22` : 'none',
            }}
          >
            {action.icon ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: action.isActive ? accent : theme.palette.textMuted,
                }}
              >
                {action.icon}
              </span>
            ) : null}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }, [
    accent,
    effectiveShellBlurEnabled,
    effectiveShellBlurStrength,
    resolvedAppearance.fonts.ui,
    theme.palette.border,
    theme.palette.textMuted,
    theme.palette.textPrimary,
    themeRendererShellModel.chrome.utilityActions,
  ]);
  const themeRendererHost = useMemo<OverlayThemeRendererHost>(() => ({
    appearance: resolvedAppearance,
    theme,
    layoutProfile: activeLayoutProfile,
    renderRuntime,
    layout: {
      windowMode,
      overlayAnchor,
      isWindowMaximized,
      shellBackgroundColor,
      shellBackdropFilter,
      usesNavigationSidebar,
      usesInsetContentShell,
      contentStagePadding,
      scaledWidth,
      scaledHeight,
    },
    shellModel: themeRendererShellModel,
    panels: themeRendererPanels,
    activePanelId,
    openPanelIds,
    pinnedPanelIds,
    wallpaper: {
      activeWallpaper,
      themeWallpaper,
      selection: wallpaperSelection as ResolvedWallpaperSelection,
      renderContext: shellWallpaperContext,
      renderBackground: renderWallpaperBackground,
      renderBackdropStack: renderWallpaperBackdropStack,
    },
    activatePanel: handleActivatePanel,
    openPanel: handleActivatePanel,
    closePanel: handleClosePanel,
    togglePanel: handleTogglePanel,
    openSettings: handleOpenSettings,
    renderDefaultChromeSurface: () => chromeBar,
    renderChromeBar: () => chromeBar,
    renderChromeContentSurface: () => chromeContentSurface,
    renderWindowControlsSurface: () => windowControlsSurface,
    renderUtilityActionsSurface: () => themeRendererUtilityActionSurface,
    renderDefaultNavigationSurface: () => defaultNavigationSurface,
    renderPanelSurface: renderManagedPanelSurface,
    renderPinnedPanels: renderPinnedPanelSurface,
    renderDefaultContentSurface: () => defaultContentSurface,
    renderDefaultShellBody: () => themeRendererDefaultShellBody,
  }), [
    activeLayoutProfile,
    activePanelId,
    activeWallpaper,
    chromeBar,
    chromeContentSurface,
    contentStagePadding,
    defaultNavigationSurface,
    defaultShellBody,
    defaultContentSurface,
    themeRendererDefaultShellBody,
    handleActivatePanel,
    handleClosePanel,
    handleOpenSettings,
    handleTogglePanel,
    isWindowMaximized,
    openPanelIds,
    overlayAnchor,
    pinnedPanelIds,
    renderManagedPanelSurface,
    renderPinnedPanelSurface,
    renderRuntime,
    renderWallpaperBackdropStack,
    renderWallpaperBackground,
    resolvedAppearance,
    scaledHeight,
    scaledWidth,
    shellBackdropFilter,
    shellBackgroundColor,
    shellWallpaperContext,
    theme,
    themeRendererPanels,
    themeRendererShellModel,
    themeRendererUtilityActionSurface,
    themeWallpaper,
    usesInsetContentShell,
    usesNavigationSidebar,
    wallpaperSelection,
    windowMode,
    windowControlsSurface,
  ]);
  const shellBody = canRenderThemeRenderer
    ? (
      <ThemeRendererBoundary
        renderer={themeRenderer!}
        fallback={defaultShellBody}
        onError={error => setThemeRendererRuntimeError(String(error))}
        render={RendererComponent => (
          <RendererComponent
            renderer={themeRenderer!}
            host={themeRendererHost}
          />
        )}
      />
      )
    : defaultShellBody;
  const shellUsesFreeformFrame = isWindowedMode || dockIsFloating;
  const shellSceneFrameStyle = useMemo<CSSProperties>(() => ({
    position: 'absolute',
    left: 0,
    top: shellUsesFreeformFrame ? 0 : (isTopAnchored ? 0 : 'auto'),
    bottom: shellUsesFreeformFrame ? 'auto' : (isTopAnchored ? 'auto' : 0),
    width: scaledWidth,
    height: scaledHeight,
  }), [isTopAnchored, scaledHeight, scaledWidth, shellUsesFreeformFrame]);
  const shellSceneContainerStyle = useMemo<CSSProperties>(() => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
    backgroundColor: shellBackgroundColor,
    backdropFilter: shellBackdropFilter,
    WebkitBackdropFilter: shellBackdropFilter,
    color: theme.palette.textPrimary,
    fontFamily: resolvedAppearance.fonts.ui,
    boxShadow: isWindowedMode && isWindowMaximized ? 'none' : 'var(--overlay-workbench-shell-shadow)',
    borderTop: shellUsesFreeformFrame
      ? (isWindowMaximized ? 'none' : '1px solid var(--overlay-workbench-chrome-border)')
      : (isTopAnchored ? 'none' : '1px solid var(--overlay-workbench-chrome-border)'),
    borderBottom: shellUsesFreeformFrame
      ? (isWindowMaximized ? 'none' : '1px solid var(--overlay-workbench-chrome-border)')
      : (isTopAnchored ? '1px solid var(--overlay-workbench-chrome-border)' : 'none'),
    borderLeft: shellUsesFreeformFrame && !isWindowMaximized ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
    borderRight: shellUsesFreeformFrame && !isWindowMaximized ? '1px solid var(--overlay-workbench-chrome-border)' : 'none',
    borderTopLeftRadius: shellUsesFreeformFrame ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? 0 : workbench.metrics.panelRadius),
    borderTopRightRadius: shellUsesFreeformFrame ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? 0 : workbench.metrics.panelRadius),
    borderBottomLeftRadius: shellUsesFreeformFrame ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? workbench.metrics.panelRadius : 0),
    borderBottomRightRadius: shellUsesFreeformFrame ? (isWindowMaximized ? 0 : workbench.metrics.panelRadius) : (isTopAnchored ? workbench.metrics.panelRadius : 0),
    isolation: 'isolate',
  }), [
    isTopAnchored,
    isWindowMaximized,
    resolvedAppearance.fonts.ui,
    shellBackgroundColor,
    shellBackdropFilter,
    shellUsesFreeformFrame,
    theme.palette.textPrimary,
    workbench.metrics.panelRadius,
  ]);
  const shellSceneBackgroundLayers = useMemo(() => (
    <>
      {!themeRendererControlsWallpaper && shellEffectsPolicy.showWallpaperBackdrop ? renderWallpaperBackdropStack() : null}
      {shellEffectsPolicy.showBackgroundShader ? (
        <ShaderSurfaceLayer
          shader={activeShader}
          shellContext={shellShaderContext}
          surface="background"
        />
      ) : null}
      {shellEffectsPolicy.showThemeVisuals
        ? (theme.visuals ?? []).map(layer => (
          <div key={layer.id} aria-hidden style={buildThemeVisualStyle(layer)} />
        ))
        : null}
      {shellEffectsPolicy.showBorderShader ? (
        <ShaderSurfaceLayer
          shader={activeShader}
          shellContext={shellShaderContext}
          surface="border"
        />
      ) : null}
    </>
  ), [
    activeShader,
    renderWallpaperBackdropStack,
    shellEffectsPolicy.showBackgroundShader,
    shellEffectsPolicy.showBorderShader,
    shellEffectsPolicy.showThemeVisuals,
    shellEffectsPolicy.showWallpaperBackdrop,
    shellShaderContext,
    theme.visuals,
    themeRendererControlsWallpaper,
  ]);
  const shellSceneContentLayer = useMemo(() => (
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {shellBody}
    </div>
  ), [shellBody]);
  const shellSceneTransformOrigin = isWindowedMode
    ? 'top left'
    : (dockIsFloating ? 'center center' : (isTopAnchored ? 'top left' : 'bottom left'));
  const devHudEnabled = (Boolean(import.meta.env.DEV) || systemSettings.developerMode)
    && systemSettings.devTelemetryHudVisible;
  if (isDedicatedSecondaryWindowHost && dedicatedSecondaryWindowContent) {
    return (
      <IconThemeProvider iconTheme={resolvedAppearance.theme.assets?.iconTheme}>
        <div
          className="overlay-window-host w-full h-full overflow-hidden"
          style={{
            ...(resolvedAppearance.cssVars as CSSProperties),
            position: 'relative',
            backgroundColor: theme.palette.panelBackground,
          }}
        >
          {dedicatedSecondaryWindowContent}
        </div>
      </IconThemeProvider>
    );
  }

  return (
    <IconThemeProvider iconTheme={resolvedAppearance.theme.assets?.iconTheme}>
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
        <OverlayShellScene
          animation={shellAnimation}
          phase={overlayPhase}
          direction={overlayAnimationDirection}
          durationMs={shellAnimationDurationMs}
          baseOpacity={clampedAppOpacity}
          intensity={appAnimationIntensity}
          verticalOrigin={overlayAnchor}
          accentColor={accent}
          blurStrength={effectiveShellBlurStrength}
          zoom={effectiveWindowZoom}
          theme={theme}
          viewportWidth={themeRendererViewport.width}
          viewportHeight={themeRendererViewport.height}
          frameStyle={shellSceneFrameStyle}
          transformOrigin={shellSceneTransformOrigin}
          containerStyle={shellSceneContainerStyle}
          backgroundLayers={shellSceneBackgroundLayers}
          contentLayer={shellSceneContentLayer}
          showAnimationOverlay={shellEffectsPolicy.showAnimationOverlay}
        />
        <DevPerformanceHud
          enabled={devHudEnabled}
          appearance={resolvedAppearance}
          activePanelLabel={activePanelId ?? 'none'}
          openPanelCount={openPanelIds.length}
          frameStats={latestOverlayFrameStats}
          sourceTraceEnabled={systemSettings.sourceTraceModeEnabled}
        />
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          appearance={resolvedAppearance}
          blurEnabled={effectiveShellBlurEnabled}
          actions={interactiveCommandPaletteActions}
          shortcutLabel={formatHotkeyLabel(keybindings.commandPalette)}
          queryPlaceholder={globalSearchPaletteConfig.commandPalettePlaceholder}
          statusMessage={commandPaletteStatusMessage}
          pinnedActionIds={commandPalettePinnedActionIds}
          recentActionIds={commandPaletteRecentActionIds}
          defaultQuickFilterId={commandPaletteLastQuickFilterId}
          onQueryChange={setCommandPaletteQuery}
          onQuickFilterChange={setCommandPaletteQuickFilterId}
          onTogglePinnedAction={toggleCommandPalettePinnedActionId}
          onClose={handleCloseCommandPalette}
        />
        <LookdevOverlay
          appearance={resolvedAppearance}
          themePackages={combinedThemePackages}
          topBarPackages={topBarPackages}
          dockPresentationPackages={dockPresentationPackages}
          menuPacks={combinedMenuPacks}
          actions={combinedExplorerActions}
          onRefreshLookdevPresets={() => refreshLookdevPresets(true)}
          onRefreshThemes={() => refreshThemePackages(true)}
          onRefreshTopBars={() => refreshTopBarPackages(true)}
          onRefreshDockPresentations={() => refreshDockPresentationPackages(true)}
          onRefreshMenuPacks={() => refreshMenuPacks(true)}
          onOpenSettingsSection={handleOpenSettingsSection}
          onToggleTopBarCustomize={handleToggleTopBarCustomize}
        />
      </div>
    </IconThemeProvider>
  );
}

export default App;
