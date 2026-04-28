/**
 * Settings Store - Data-driven configuration system
 * NO HARDCODED PATHS - Everything configurable via JSON
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeThemeDefinition, type OverlayThemeDefinition } from '../config/appearance';
import { type OverlayThemeBundleManifest } from '../config/themePackages';
import {
  createDefaultFolderIconRules,
  DEFAULT_FOLDER_ICON_VALUE,
  type FolderIconRule,
  type FolderIconValue,
} from '../config/folderIcons';
import {
  getDefaultIntegratedTerminalProfile,
  getDefaultIntegratedShell,
  getIntegratedTerminalProfileTemplate,
  inferIntegratedTerminalProfileFromShell,
  normalizeIntegratedTerminalProfile,
  resolveIntegratedTerminalShellCommand,
  type ExternalTerminalProfile,
  type IntegratedTerminalProfile,
} from '../config/platform';
import {
  getExplorerGridZoomAnchor,
  isExplorerGridMode,
  normalizeExplorerGridZoom,
  normalizeExplorerViewMode,
  type ExplorerViewMode,
} from '../config/explorerViewModes';
import {
  DEFAULT_ADAPTIVE_SEMANTIC_DENSITY,
  normalizeAdaptiveSemanticDensity,
  normalizeExplorerExperimentalViewMode,
  type ExplorerExperimentalViewMode,
} from '../config/explorerExperimentalModes';
import {
  normalizeExplorerChromeLayoutId,
  normalizeExplorerChromeOverrideSnapshot,
  normalizeExplorerChromeOverrideSnapshotMap,
  type ExplorerChromeLayoutId,
  type ExplorerChromeOverrideSnapshot,
} from '../config/explorerChromeLayouts';
import {
  normalizeExplorerModeProfileId,
  type ExplorerModeProfileId,
} from '../config/explorerModeProfiles';
import { EXPLORER_CANONICAL_LAYOUT_ID } from '../config/explorerLayouts';
import {
  normalizeExplorerCollectionPreviewMode,
  type ExplorerCollectionPreviewMode,
} from '../config/explorerCollectionPreviewModes';
import {
  defaultExplorerThumbnailSettings,
  normalizeExplorerThumbnailSettings,
  type ExplorerThumbnailSettings,
} from '../config/explorerThumbnails';
import {
  normalizePreferredWorkbenchByExtensionMap,
  normalizePreferredWorkbenchId,
  normalizeWorkbenchExtensionKey,
  type ExplorerPreferredWorkbenchByExtension,
} from '../config/explorerWorkbenches';
import {
  EXPLORER_MENU_CONTEXT_KINDS,
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  normalizeExplorerMenuContextLayoutOverrideMap,
  normalizeExplorerContextMenuItemOverrideMap,
  sortExplorerContextMenuItems,
  type ExplorerMenuContextKind,
  type ExplorerMenuContextLayoutOverrideMap,
  type ExplorerMenuLayoutEntry,
  type ExplorerContextMenuItemOverrideMap,
} from '../config/explorerContextMenu';
import { DEFAULT_EXPLORER_MENU_PACK_ID } from '../config/menuPacks';
import {
  createDefaultKeybindingSettings,
  normalizeKeybindingValue,
  normalizeKeybindingSettings,
  type HotkeyBindingSettings,
} from '../config/hotkeys';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  type OverlayAnimationPresetId,
} from '../config/overlayAnimations';
import {
  clampInteractionMotionIntensity,
  normalizeInteractionMotionModuleOverrideMap,
  normalizeInteractionMotionPresetId,
  normalizeInteractionMotionSurfaceOverrideMap,
  type OverlayInteractionMotionModuleOverrideMap,
  type OverlayInteractionMotionSurfaceOverrideMap,
} from '../config/interactionMotion';
import {
  clampLayoutDynamicsIntensity,
  createDefaultLayoutDynamicsSettings,
  normalizeLayoutDynamicsPresetId,
  normalizeLayoutDynamicsSurfaceOverrideMap,
  normalizeLayoutDynamicsTopBarLayoutMap,
  type LayoutDynamicsAuthoringSnapshot,
  type LayoutDynamicsSurfaceOverrideMap,
} from '../config/layoutDynamics';
import {
  clampOverlayVisualControlValue,
  overlayVisualControls,
  overlayWindowGeometry,
} from '../config/overlayWindow';
import { normalizeGpuTierMode, type GpuTierMode } from '../config/gpuRuntime';
import {
  normalizeAccelerationRoutingMode,
  type AccelerationRoutingMode,
} from '../config/accelerationRuntime';
import {
  createDefaultLocalModelCapabilityBindings,
  normalizeLocalModelCapabilityBindingMap,
  normalizeLocalModelRootOverrideMap,
  semanticIndexingCapabilityId,
  type LocalModelCapabilityBindingMap,
  type LocalModelRootOverrideMap,
} from '../config/localModels';
import { shaderSystemConfig, type ShaderPerformanceMode } from '../config/shaders';
import {
  normalizeOverlayWallpaperFitMode,
  type OverlayWallpaperFitMode,
} from '../config/wallpapers';
import {
  isScreenshotCaptureModeId,
  isScreenshotOutputActionId,
  screenshotFeatureConfig,
  type ScreenshotCaptureModeId,
  type ScreenshotOutputActionId,
} from '../config/screenshots';
import { isLegacyScreenshotDirectory } from '../config/appContentDirectories';
import {
  normalizeSettingsRailPathKey,
  normalizeSettingsSectionKey,
  type SettingsRailPathKey,
  type SettingsSectionKey,
} from '../config/settingsNavigation';
import { normalizeIconThemePackageSelectionId } from '../config/iconThemePackages';
import {
  normalizeOverlayPluginSettingsValueMap,
  type OverlayPluginSettingsValue,
} from '../config/pluginSettings';
import {
  normalizeMobileRemoteAccessMode,
  type MobileRemoteAccessMode,
} from '../config/mobileAccess';
import {
  defaultMobileLayoutSettings,
  normalizeMobileLayoutSettings,
  type MobileLayoutSettings,
} from '../config/mobileLayout';
import { EXPLORER_HOME_PATH } from '../config/explorerVirtualLocations';
import {
  DEFAULT_PILOT_ACCENT_COLOR,
  DEFAULT_PILOT_DARK_THEME_ID,
  DEFAULT_PILOT_LAYOUT_PROFILE_ID,
  DEFAULT_PILOT_UI_FONT_FAMILY,
  getThemeSelectionDefaults,
} from '../config/pilotThemeContract';
import type { IdeWorkbenchLayoutState } from '../config/ideWorkbenchLayout';
import { DEFAULT_IDE_LAYOUT_PROFILE_ID, type WorkbenchShellFamilyId } from '../config/layoutProfiles';

// ============================================================================
// TYPES
// ============================================================================

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  cursorStyle: 'line' | 'block' | 'underline';
  autoSave: 'off' | 'afterDelay' | 'onFocusChange';
  autoSaveDelay: number;
  formatOnSave: boolean;
  formatOnPaste: boolean;
}

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  shell: string;
  shellProfile: IntegratedTerminalProfile;
  shellPath: string;
  shellArgs: string;
  integratedHost: IntegratedTerminalHost;
  showSidebar: boolean;
  cursorBlink: boolean;
  cursorStyle: 'bar' | 'block' | 'underline';
  scrollback: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: OverlayWindowAnchor;
  windowMode: TerminalWindowMode;
  windowedWidth: number;
  windowedHeight: number;
  preferredOpenMode: 'integrated' | 'external';
  externalTerminalProfile: ExternalTerminalProfile;
  externalTerminalCommand: string;
  externalTerminalArgs: string;
}

export type IntegratedTerminalHost = 'go-pty-panel' | 'xterm';

export interface PythonSettings {
  preferredInterpreterPath: string;
  runtimeRoot: string;
  bootstrapPackages: string;
  autoUpgradePip: boolean;
  createBoilerplate: boolean;
}

export interface ModelsSettings {
  capabilityBindings: LocalModelCapabilityBindingMap;
  semanticIndexRootOverrides: LocalModelRootOverrideMap;
}

export type ExplorerFolderClickMode = 'single' | 'double';

export interface ExplorerSettings {
  defaultPath: string;
  showHiddenFiles: boolean;
  sortBy: 'name' | 'size' | 'date' | 'type';
  sortOrder: 'asc' | 'desc';
  viewMode: ExplorerViewMode;
  gridZoom: number;
  experimentalViewMode: ExplorerExperimentalViewMode;
  experimentalDensity: number;
  folderClickMode: ExplorerFolderClickMode;
  doubleClickEmptyToGoBack: boolean;
  confirmDelete: boolean;
  defaultFolderIcon: FolderIconValue;
  folderIconRules: FolderIconRule[];
  thumbnails: ExplorerThumbnailSettings;
  collectionPreviewMode: ExplorerCollectionPreviewMode;
  followThemeExplorerLayout: boolean;
  activeExplorerLayoutId: string | null;
  layoutUiResetRevision: number;
  modeProfileOverridesByThemeId: Record<string, ExplorerModeProfileId>;
  chromeLayoutOverridesByThemeId: Record<string, Record<string, ExplorerChromeOverrideSnapshot>>;
  activeMenuPackId: string | null;
  contextMenuLayoutOverridesByContext: ExplorerMenuContextLayoutOverrideMap;
  contextMenuItemOverrides: ExplorerContextMenuItemOverrideMap;
  preferredWorkbenchByExtension: ExplorerPreferredWorkbenchByExtension;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  activeThemeId: string;
  dockThemeMode: DockThemeMode;
  activeDockThemeId: string | null;
  activeAppearancePackId: string | null;
  activeThemeRecipeId: string | null;
  activeThemeEngineId: string | null;
  activeShellRendererId: string | null;
  activeTopBarId: string | null;
  activeIconThemeId: string | null;
  customThemes: OverlayThemeDefinition[];
  customThemeBundles: OverlayThemeBundleManifest[];
  activeWallpaperId?: string | null;
  wallpaperFitMode: OverlayWallpaperFitMode;
  wallpaperOpacity: number;
  wallpaperMuted: boolean;
  activeShaderId?: string | null;
  shaderPerformanceMode: ShaderPerformanceMode;
  shaderControlValues: Record<string, Record<string, number>>;
  uiFontFamily: string;
  useNativeOsIcons: boolean;
  accentColor: string;
  sidebarPosition: 'left' | 'right';
  activityBarPosition: 'side' | 'top';
  compactMode: boolean;
  animations: boolean;
  appOpacity: number;
  panelTransparency: number;
  appZoom: number;
  appBlur: boolean;
  appBlurStrength: number;
  appOpenAnimation: OverlayAnimationPresetId | null;
  appCloseAnimation: OverlayAnimationPresetId | null;
  appAnimationDurationMs: number;
  appAnimationIntensity: number;
  interactionMotionEnabled: boolean;
  interactionMotionPresetId: string | null;
  interactionMotionIntensity: number;
  interactionMotionModuleOverrides: OverlayInteractionMotionModuleOverrideMap;
  interactionMotionSurfaceOverrides: OverlayInteractionMotionSurfaceOverrideMap;
  layoutDynamicsEnabled: boolean;
  layoutDynamicsPresetId: string | null;
  layoutDynamicsIntensity: number;
  layoutDynamicsSurfaceOverrides: LayoutDynamicsSurfaceOverrideMap;
  topBarLayoutSnapshotsById: Record<string, LayoutDynamicsAuthoringSnapshot>;
}

export interface HomeSettings {
  activePackId: string | null;
  usageTrackingEnabled: boolean;
  packStateById: Record<string, Record<string, unknown>>;
  activePresetIdByPackId: Record<string, string | null>;
}

export interface SystemSettings {
  launchAtStartup: boolean;
  startMobileShareOnBoot: boolean;
  hideAppInTray: boolean;
  showInTaskbar: boolean;
  gpuTierMode: GpuTierMode;
  accelerationRoutingMode: AccelerationRoutingMode;
  developerMode: boolean;
  devTelemetryHudVisible: boolean;
  sourceTraceModeEnabled: boolean;
  developerTelemetryEnabled: boolean;
  developerTelemetryCaptureMode: DeveloperTelemetryCaptureMode;
  developerTelemetryWriteToFile: boolean;
  developerTelemetryShowInspector: boolean;
  developerTelemetryPayloadMode: DeveloperTelemetryPayloadMode;
  developerTelemetryMaxFileSizeMb: number;
  consumerDiagnosticsEnabled: boolean;
  consumerDiagnosticsIncludePluginRuntime: boolean;
  consumerDiagnosticsIncludeRendererRuntime: boolean;
  consumerDiagnosticsIncludePerfSamples: boolean;
  linuxDisplayBackendPreference: LinuxDisplayBackendPreference;
  linuxNvidiaWebkitWorkaroundMode: LinuxNvidiaWebkitWorkaroundMode;
}

export interface ScreenshotSettings {
  saveDirectory: string;
  defaultCaptureMode: ScreenshotCaptureModeId;
  defaultOutputAction: ScreenshotOutputActionId;
  showGrid: boolean;
  closeEditorAfterAction: boolean;
}

export interface MobileSettings {
  remoteAccessMode: MobileRemoteAccessMode;
  tailscaleLoginServer: string;
  tailscaleHostname: string;
  layout: MobileLayoutSettings;
}

export interface PluginSettingsCatalog {
  valuesByPluginId: Record<string, Record<string, OverlayPluginSettingsValue>>;
}

export type KeybindingSettings = HotkeyBindingSettings;
export type DockThemeMode = 'follow-app' | 'override';
export type LinuxDisplayBackendPreference = 'auto' | 'wayland' | 'x11';
export type LinuxNvidiaWebkitWorkaroundMode = 'auto' | 'force-on' | 'force-off';
export type DeveloperTelemetryCaptureMode = 'raw' | 'sampled' | 'perf-only';
export type DeveloperTelemetryPayloadMode = 'metadata-only' | 'metadata+small-payloads';

export interface PolyGeminiSettings {
  serverUrl: string;
  serverPort: number;
  autoStart: boolean;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export type OverlayWindowAnchor = 'top' | 'bottom';
export type TerminalWindowMode = 'overlay' | 'windowed';

export interface LayoutSettings {
  activeProfileId: string;
  configPath: string;
  panelStateByProfile: Record<string, LayoutPanelState>;
  shellStateByProfile: Record<string, IdeWorkbenchLayoutState>;
  lastProfileIdByShellFamily: Partial<Record<WorkbenchShellFamilyId, string>>;
  followThemeDefaults: boolean;
  zenFocusMode: boolean;
}

export interface AudioSettings {
  activeSoundPackId: string | null;
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
  buttonSoundsEnabled: boolean;
  navigationSoundsEnabled: boolean;
  taskSoundsEnabled: boolean;
  notificationSoundsEnabled: boolean;
  nativeNotificationsEnabled: boolean;
  nativeTaskSuccessNotificationsEnabled: boolean;
  nativeTaskFailureNotificationsEnabled: boolean;
  vst3AdditionalFolders: string[];
}

export interface LayoutPanelState {
  openPanelIds: string[];
  activePanelId: string | null;
  dismissedPanelIds: string[];
}

export interface Settings {
  editor: EditorSettings;
  terminal: TerminalSettings;
  python: PythonSettings;
  models: ModelsSettings;
  explorer: ExplorerSettings;
  home: HomeSettings;
  appearance: AppearanceSettings;
  system: SystemSettings;
  mobile: MobileSettings;
  screenshots: ScreenshotSettings;
  keybindings: KeybindingSettings;
  polygemini: PolyGeminiSettings;
  layout: LayoutSettings;
  audio: AudioSettings;
  plugins: PluginSettingsCatalog;
}

export const SETTINGS_STORAGE_KEY = 'ultacode-settings';

type LegacyImportedTerminalSettings = Partial<TerminalSettings> & {
  colorTheme?: string;
  uiFont?: string;
};

type LegacyImportedAppearanceSettings = Partial<AppearanceSettings> & {
  uiFont?: string;
};

type LegacyImportedSettings = Partial<Settings> & {
  terminal?: LegacyImportedTerminalSettings;
  appearance?: LegacyImportedAppearanceSettings;
};

// ============================================================================
// DEFAULTS
// ============================================================================

const getDefaultPath = (): string => {
  return EXPLORER_HOME_PATH;
};

const defaultLayoutDynamicsSettings = createDefaultLayoutDynamicsSettings();
const defaultIntegratedTerminalProfile = getDefaultIntegratedTerminalProfile();
const defaultIntegratedTerminalTemplate = getIntegratedTerminalProfileTemplate(
  defaultIntegratedTerminalProfile,
);

export function normalizeOverlayWindowAnchor(value: unknown): OverlayWindowAnchor {
  return value === 'top' ? 'top' : 'bottom';
}

export function normalizeTerminalWindowMode(value: unknown): TerminalWindowMode {
  return value === 'overlay' ? 'overlay' : 'windowed';
}

export function normalizeIntegratedTerminalHost(value: unknown): IntegratedTerminalHost {
  return value === 'xterm' ? 'xterm' : 'go-pty-panel';
}

export function normalizeDockThemeMode(value: unknown): DockThemeMode {
  return value === 'override' ? 'override' : 'follow-app';
}

export function normalizeLinuxDisplayBackendPreference(value: unknown): LinuxDisplayBackendPreference {
  return value === 'wayland' || value === 'x11' ? value : 'auto';
}

export function normalizeLinuxNvidiaWebkitWorkaroundMode(value: unknown): LinuxNvidiaWebkitWorkaroundMode {
  return value === 'force-on' || value === 'force-off' ? value : 'auto';
}

export function normalizeDeveloperTelemetryCaptureMode(value: unknown): DeveloperTelemetryCaptureMode {
  return value === 'sampled' || value === 'perf-only' ? value : 'raw';
}

export function normalizeDeveloperTelemetryPayloadMode(value: unknown): DeveloperTelemetryPayloadMode {
  return value === 'metadata-only' ? value : 'metadata+small-payloads';
}

function normalizeShaderPerformanceMode(value: unknown): ShaderPerformanceMode {
  return value === 'balanced' || value === 'quality'
    ? value
    : shaderSystemConfig.defaultPerformanceMode;
}

function normalizeTelemetryFileSizeMb(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(512, Math.round(value)));
}

export function normalizeExplorerFolderClickMode(value: unknown): ExplorerFolderClickMode {
  return value === 'single' ? 'single' : 'double';
}

function normalizeExplorerModeProfileOverrideMap(
  value: unknown,
): Record<string, ExplorerModeProfileId> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([themeId, modeProfileId]) => {
        const trimmedThemeId = themeId.trim();
        if (!trimmedThemeId) {
          return null;
        }

        return [trimmedThemeId, normalizeExplorerModeProfileId(modeProfileId)] as const;
      })
      .filter((entry): entry is readonly [string, ExplorerModeProfileId] => entry != null),
  );
}

function normalizeExplorerSettings(
  base: ExplorerSettings,
  updates?: Partial<ExplorerSettings>,
): ExplorerSettings {
  const nextViewMode = normalizeExplorerViewMode(updates?.viewMode ?? base.viewMode);
  const hasExplicitGridZoom = updates != null && Object.prototype.hasOwnProperty.call(updates, 'gridZoom');
  const nextExperimentalViewMode = normalizeExplorerExperimentalViewMode(
    updates?.experimentalViewMode ?? base.experimentalViewMode,
  );
  const hasExplicitExperimentalDensity = updates != null && Object.prototype.hasOwnProperty.call(updates, 'experimentalDensity');
  const hasExplicitModeProfileOverrides = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'modeProfileOverridesByThemeId');
  const hasExplicitChromeLayoutOverrides = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'chromeLayoutOverridesByThemeId');
  const hasExplicitFollowThemeExplorerLayout = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'followThemeExplorerLayout');
  const hasExplicitActiveExplorerLayoutId = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'activeExplorerLayoutId');
  const hasExplicitLayoutUiResetRevision = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'layoutUiResetRevision');
  const hasExplicitActiveMenuPackId = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'activeMenuPackId');
  const hasExplicitContextMenuLayoutOverrides = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'contextMenuLayoutOverridesByContext');
  const hasExplicitContextMenuItemOverrides = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'contextMenuItemOverrides');
  const hasExplicitThumbnailSettings = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'thumbnails');
  const hasExplicitPreferredWorkbenchByExtension = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'preferredWorkbenchByExtension');

  return {
    ...base,
    ...updates,
    viewMode: nextViewMode,
    gridZoom: hasExplicitGridZoom
      ? normalizeExplorerGridZoom(updates?.gridZoom, nextViewMode)
      : (updates?.viewMode && isExplorerGridMode(nextViewMode)
          ? getExplorerGridZoomAnchor(nextViewMode)
          : base.gridZoom),
    experimentalViewMode: nextExperimentalViewMode,
    experimentalDensity: hasExplicitExperimentalDensity
      ? normalizeAdaptiveSemanticDensity(updates?.experimentalDensity)
      : base.experimentalDensity,
    folderClickMode: normalizeExplorerFolderClickMode(updates?.folderClickMode ?? base.folderClickMode),
    doubleClickEmptyToGoBack: updates?.doubleClickEmptyToGoBack ?? base.doubleClickEmptyToGoBack,
    thumbnails: hasExplicitThumbnailSettings
      ? normalizeExplorerThumbnailSettings(updates?.thumbnails)
      : base.thumbnails,
    collectionPreviewMode: normalizeExplorerCollectionPreviewMode(
      updates?.collectionPreviewMode ?? base.collectionPreviewMode,
    ),
    followThemeExplorerLayout: hasExplicitFollowThemeExplorerLayout
      ? updates?.followThemeExplorerLayout !== false
      : base.followThemeExplorerLayout,
    activeExplorerLayoutId: hasExplicitActiveExplorerLayoutId
      ? normalizeExplorerLayoutSelectionId(updates?.activeExplorerLayoutId)
      : base.activeExplorerLayoutId,
    layoutUiResetRevision: hasExplicitLayoutUiResetRevision
      ? normalizeSettingsRevision(updates?.layoutUiResetRevision)
      : normalizeSettingsRevision(base.layoutUiResetRevision),
    modeProfileOverridesByThemeId: hasExplicitModeProfileOverrides
      ? normalizeExplorerModeProfileOverrideMap(updates?.modeProfileOverridesByThemeId)
      : base.modeProfileOverridesByThemeId,
    chromeLayoutOverridesByThemeId: hasExplicitChromeLayoutOverrides
      ? normalizeExplorerChromeOverrideSnapshotMap(updates?.chromeLayoutOverridesByThemeId)
      : base.chromeLayoutOverridesByThemeId,
    activeMenuPackId: hasExplicitActiveMenuPackId
      ? normalizeExplorerMenuPackId(updates?.activeMenuPackId)
      : base.activeMenuPackId,
    contextMenuLayoutOverridesByContext: hasExplicitContextMenuLayoutOverrides
      ? normalizeExplorerMenuContextLayoutOverrideMap(updates?.contextMenuLayoutOverridesByContext)
      : base.contextMenuLayoutOverridesByContext,
    contextMenuItemOverrides: hasExplicitContextMenuItemOverrides
      ? normalizeExplorerContextMenuItemOverrideMap(updates?.contextMenuItemOverrides)
      : base.contextMenuItemOverrides,
    preferredWorkbenchByExtension: hasExplicitPreferredWorkbenchByExtension
      ? normalizePreferredWorkbenchByExtensionMap(
          updates?.preferredWorkbenchByExtension,
        )
      : base.preferredWorkbenchByExtension,
  };
}

function normalizeSettingsRevision(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function normalizeExplorerLayoutSelectionId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return value === null ? null : null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeExplorerMenuPackId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return value === null ? null : null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeExplorerMenuComposerContext(
  value: unknown,
): ExplorerMenuContextKind {
  return EXPLORER_MENU_CONTEXT_KINDS.includes(value as ExplorerMenuContextKind)
    ? (value as ExplorerMenuContextKind)
    : 'entry';
}

function buildLegacyLayoutEntriesForContext(
  contextKind: ExplorerMenuContextKind,
  overrides: ExplorerContextMenuItemOverrideMap,
): ExplorerMenuLayoutEntry[] {
  const legacyTarget = contextKind === 'background' ? 'background' : 'entry';
  return sortExplorerContextMenuItems(
    BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.filter((item) => {
      if (!item.contexts.includes(contextKind)) {
        return false;
      }
      if (legacyTarget === 'background') {
        return item.contexts.includes('background');
      }
      return item.contexts.includes('entry');
    }),
    overrides,
  ).map((item, index) => ({
    id: `${contextKind}.legacy.${item.id}`,
    kind: 'command' as const,
    commandId: item.id,
    parentEntryId: null,
    order: (index + 1) * 10,
    enabled: overrides[item.id]?.enabled ?? true,
    quickSlot: 'none',
    fallbackBucket: 'default',
  }));
}

function migrateLegacyContextMenuOverridesToLayouts(
  overrides: ExplorerContextMenuItemOverrideMap,
): ExplorerMenuContextLayoutOverrideMap {
  const normalizedOverrides = normalizeExplorerContextMenuItemOverrideMap(overrides);
  if (Object.keys(normalizedOverrides).length === 0) {
    return {};
  }

  const entryLayout = buildLegacyLayoutEntriesForContext('entry', normalizedOverrides);
  const backgroundLayout = buildLegacyLayoutEntriesForContext('background', normalizedOverrides);
  const result: ExplorerMenuContextLayoutOverrideMap = {};
  if (entryLayout.length > 0) {
    result.entry = {
      renderer: 'classic',
      entries: entryLayout,
    };
  }
  if (backgroundLayout.length > 0) {
    result.background = {
      renderer: 'classic',
      entries: backgroundLayout,
    };
  }
  return result;
}

function normalizeHomePackId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return value === null ? null : null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeHomePackStateById(
  value: unknown,
): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([packId, packState]) => {
        const normalizedPackId = packId.trim();
        if (!normalizedPackId || !packState || typeof packState !== 'object' || Array.isArray(packState)) {
          return null;
        }

        return [normalizedPackId, { ...(packState as Record<string, unknown>) }] as const;
      })
      .filter((entry): entry is readonly [string, Record<string, unknown>] => entry != null),
  );
}

function normalizeHomePresetSelectionMap(
  value: unknown,
): Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([packId, presetId]) => {
        const normalizedPackId = packId.trim();
        if (!normalizedPackId) {
          return null;
        }

        return [normalizedPackId, normalizeHomePackId(presetId)] as const;
      })
      .filter((entry): entry is readonly [string, string | null] => entry != null),
  );
}

function normalizeHomeSettings(
  base: HomeSettings,
  updates?: Partial<HomeSettings>,
): HomeSettings {
  const hasExplicitPackStateById = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'packStateById');
  const hasExplicitActivePresetIdByPackId = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'activePresetIdByPackId');

  return {
    ...base,
    ...updates,
    activePackId: normalizeHomePackId(updates?.activePackId ?? base.activePackId),
    usageTrackingEnabled: updates?.usageTrackingEnabled ?? base.usageTrackingEnabled,
    packStateById: hasExplicitPackStateById
      ? normalizeHomePackStateById(updates?.packStateById)
      : base.packStateById,
    activePresetIdByPackId: hasExplicitActivePresetIdByPackId
      ? normalizeHomePresetSelectionMap(updates?.activePresetIdByPackId)
      : base.activePresetIdByPackId,
  };
}

function normalizeSavedWindowDimension(value: unknown, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(Math.round(value), min);
}

function normalizeTerminalShellText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTerminalSettings(
  base: TerminalSettings,
  updates?: Partial<TerminalSettings>,
): TerminalSettings {
  const merged = { ...base, ...updates };
  const hasExplicitShellProfile = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'shellProfile');
  const hasExplicitShellPath = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'shellPath');
  const hasExplicitShellArgs = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'shellArgs');
  const hasExplicitLegacyShell = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'shell');

  const baseShellProfile = normalizeIntegratedTerminalProfile(base.shellProfile);
  const baseShellPath = normalizeTerminalShellText(base.shellPath);
  const baseShellArgs = normalizeTerminalShellText(base.shellArgs);

  const normalizedShellConfig = hasExplicitLegacyShell
    && !hasExplicitShellProfile
    && !hasExplicitShellPath
    && !hasExplicitShellArgs
    ? inferIntegratedTerminalProfileFromShell({
      shell: normalizeTerminalShellText(updates?.shell ?? ''),
    })
    : {
      shellProfile: hasExplicitShellProfile
        ? normalizeIntegratedTerminalProfile(updates?.shellProfile)
        : baseShellProfile,
      shellPath: hasExplicitShellPath
        ? normalizeTerminalShellText(updates?.shellPath)
        : baseShellPath,
      shellArgs: hasExplicitShellArgs
        ? normalizeTerminalShellText(updates?.shellArgs)
        : baseShellArgs,
    };

  const normalizedShellProfile = normalizeIntegratedTerminalProfile(
    normalizedShellConfig.shellProfile,
  );
  const shellTemplate = getIntegratedTerminalProfileTemplate(
    normalizedShellProfile,
  );
  const normalizedShellPath = normalizedShellConfig.shellPath || shellTemplate.shellPath;
  const normalizedShellArgs = normalizedShellConfig.shellArgs || shellTemplate.shellArgs;

  return {
    ...merged,
    shellProfile: normalizedShellProfile,
    shellPath: normalizedShellPath,
    shellArgs: normalizedShellArgs,
    integratedHost: normalizeIntegratedTerminalHost(
      merged.integratedHost ?? base.integratedHost,
    ),
    shell: resolveIntegratedTerminalShellCommand({
      profile: normalizedShellProfile,
      shellPath: normalizedShellPath,
      shellArgs: normalizedShellArgs,
    }),
    showSidebar: merged.showSidebar !== false,
    overlayHeight: normalizeSavedWindowDimension(
      merged.overlayHeight,
      base.overlayHeight,
      overlayWindowGeometry.minHeight,
    ),
    overlayWidth: normalizeSavedWindowDimension(
      merged.overlayWidth,
      base.overlayWidth,
      overlayWindowGeometry.minWidth,
    ),
    overlayAnchor: normalizeOverlayWindowAnchor(merged.overlayAnchor ?? base.overlayAnchor),
    windowMode: normalizeTerminalWindowMode(merged.windowMode ?? base.windowMode),
    windowedWidth: normalizeSavedWindowDimension(merged.windowedWidth, base.windowedWidth, 720),
    windowedHeight: normalizeSavedWindowDimension(merged.windowedHeight, base.windowedHeight, 480),
  };
}

function normalizeModelsSettings(
  base: ModelsSettings,
  updates?: Partial<ModelsSettings>,
): ModelsSettings {
  const hasExplicitCapabilityBindings = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'capabilityBindings');
  const hasExplicitSemanticIndexRootOverrides = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'semanticIndexRootOverrides');

  return {
    capabilityBindings: hasExplicitCapabilityBindings
      ? normalizeLocalModelCapabilityBindingMap(updates?.capabilityBindings)
      : base.capabilityBindings,
    semanticIndexRootOverrides: hasExplicitSemanticIndexRootOverrides
      ? normalizeLocalModelRootOverrideMap(
        updates?.semanticIndexRootOverrides,
        semanticIndexingCapabilityId,
      )
      : base.semanticIndexRootOverrides,
  };
}

function createMemoryStorage(): Storage {
  const storage = new Map<string, string>();

  return {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };
}

function isStorageLike(value: unknown): value is Storage {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as Storage).getItem === 'function'
    && typeof (value as Storage).setItem === 'function'
    && typeof (value as Storage).removeItem === 'function',
  );
}

function getSettingsStorage(): Storage {
  if (typeof window !== 'undefined' && isStorageLike(window.localStorage)) {
    return window.localStorage;
  }

  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    const candidate = globalThis.localStorage;
    if (isStorageLike(candidate)) {
      return candidate;
    }
  }

  return createMemoryStorage();
}

export function normalizeSystemSettings(
  base: SystemSettings,
  updates?: Partial<SystemSettings>,
): SystemSettings {
  const merged = { ...base, ...updates };
  const normalized: SystemSettings = {
    launchAtStartup: Boolean(merged.launchAtStartup),
    startMobileShareOnBoot: Boolean(merged.startMobileShareOnBoot),
    hideAppInTray: merged.hideAppInTray !== false,
    showInTaskbar: Boolean(merged.showInTaskbar),
    gpuTierMode: normalizeGpuTierMode(merged.gpuTierMode),
    accelerationRoutingMode: normalizeAccelerationRoutingMode(merged.accelerationRoutingMode),
    developerMode: Boolean(merged.developerMode),
    devTelemetryHudVisible: merged.devTelemetryHudVisible !== false,
    sourceTraceModeEnabled: Boolean(merged.sourceTraceModeEnabled),
    developerTelemetryEnabled: Boolean(merged.developerTelemetryEnabled),
    developerTelemetryCaptureMode: normalizeDeveloperTelemetryCaptureMode(
      merged.developerTelemetryCaptureMode,
    ),
    developerTelemetryWriteToFile: merged.developerTelemetryWriteToFile !== false,
    developerTelemetryShowInspector: merged.developerTelemetryShowInspector !== false,
    developerTelemetryPayloadMode: normalizeDeveloperTelemetryPayloadMode(
      merged.developerTelemetryPayloadMode,
    ),
    developerTelemetryMaxFileSizeMb: normalizeTelemetryFileSizeMb(
      merged.developerTelemetryMaxFileSizeMb,
      base.developerTelemetryMaxFileSizeMb,
    ),
    consumerDiagnosticsEnabled: Boolean(merged.consumerDiagnosticsEnabled),
    consumerDiagnosticsIncludePluginRuntime:
      merged.consumerDiagnosticsIncludePluginRuntime !== false,
    consumerDiagnosticsIncludeRendererRuntime:
      merged.consumerDiagnosticsIncludeRendererRuntime !== false,
    consumerDiagnosticsIncludePerfSamples:
      merged.consumerDiagnosticsIncludePerfSamples !== false,
    linuxDisplayBackendPreference: normalizeLinuxDisplayBackendPreference(
      merged.linuxDisplayBackendPreference,
    ),
    linuxNvidiaWebkitWorkaroundMode: normalizeLinuxNvidiaWebkitWorkaroundMode(
      merged.linuxNvidiaWebkitWorkaroundMode,
    ),
  };

  const hideAppInTrayUpdated = updates != null && Object.prototype.hasOwnProperty.call(updates, 'hideAppInTray');
  const showInTaskbarUpdated = updates != null && Object.prototype.hasOwnProperty.call(updates, 'showInTaskbar');

  // Keep at least one desktop entry point visible so the overlay is always recoverable.
  if (!resolveSystemPresentationState(normalized).hasVisibleEntryPoint) {
    if (showInTaskbarUpdated && !hideAppInTrayUpdated) {
      normalized.hideAppInTray = true;
    } else if (hideAppInTrayUpdated && !showInTaskbarUpdated) {
      normalized.showInTaskbar = true;
    } else {
      normalized.hideAppInTray = true;
    }
  }

  return normalized;
}

export interface SystemPresentationState {
  trayVisible: boolean;
  taskbarVisible: boolean;
  hasVisibleEntryPoint: boolean;
  recoveryPath: 'tray' | 'taskbar';
}

export function resolveSystemPresentationState(system: SystemSettings): SystemPresentationState {
  const trayVisible = system.hideAppInTray !== false;
  const taskbarVisible = system.showInTaskbar !== false;

  return {
    trayVisible,
    taskbarVisible,
    hasVisibleEntryPoint: trayVisible || taskbarVisible,
    recoveryPath: trayVisible ? 'tray' : 'taskbar',
  };
}

function normalizeAppearanceSettings(
  base: AppearanceSettings,
  updates?: Partial<AppearanceSettings>,
): AppearanceSettings {
  const merged = { ...base, ...updates };
  const hasExplicitLayoutDynamicsPresetId = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'layoutDynamicsPresetId');
  return {
    ...merged,
    customThemes: (merged.customThemes ?? base.customThemes).map(theme => normalizeThemeDefinition(theme)),
    customThemeBundles: Array.isArray(merged.customThemeBundles)
      ? merged.customThemeBundles
      : base.customThemeBundles,
    dockThemeMode: normalizeDockThemeMode(merged.dockThemeMode ?? base.dockThemeMode),
    activeDockThemeId: typeof merged.activeDockThemeId === 'string'
      ? merged.activeDockThemeId.trim() || null
      : merged.activeDockThemeId === null
        ? null
        : base.activeDockThemeId ?? null,
    activeAppearancePackId: typeof merged.activeAppearancePackId === 'string'
      ? merged.activeAppearancePackId.trim() || null
      : merged.activeAppearancePackId === null
        ? null
        : base.activeAppearancePackId ?? null,
    activeThemeRecipeId: typeof merged.activeThemeRecipeId === 'string'
      ? merged.activeThemeRecipeId.trim() || null
      : merged.activeThemeRecipeId === null
        ? null
        : base.activeThemeRecipeId ?? null,
    activeThemeEngineId: typeof merged.activeThemeEngineId === 'string'
      ? merged.activeThemeEngineId.trim() || null
      : merged.activeThemeEngineId === null
        ? null
        : base.activeThemeEngineId ?? null,
    activeShellRendererId: typeof merged.activeShellRendererId === 'string'
      ? merged.activeShellRendererId.trim() || null
      : merged.activeShellRendererId === null
        ? null
        : base.activeShellRendererId ?? null,
    activeTopBarId: typeof merged.activeTopBarId === 'string'
      ? merged.activeTopBarId.trim() || null
      : merged.activeTopBarId === null
        ? null
        : base.activeTopBarId ?? null,
    activeIconThemeId: normalizeIconThemePackageSelectionId(
      typeof merged.activeIconThemeId === 'string'
        ? merged.activeIconThemeId
        : merged.activeIconThemeId === null
          ? null
          : base.activeIconThemeId ?? null,
    ),
    activeWallpaperId: typeof merged.activeWallpaperId === 'string'
      ? merged.activeWallpaperId.trim() || null
      : merged.activeWallpaperId === null
        ? null
        : base.activeWallpaperId ?? null,
    wallpaperFitMode: normalizeOverlayWallpaperFitMode(merged.wallpaperFitMode ?? base.wallpaperFitMode),
    wallpaperOpacity: clampOverlayVisualControlValue('opacity', merged.wallpaperOpacity),
    wallpaperMuted: merged.wallpaperMuted !== false,
    activeShaderId: typeof merged.activeShaderId === 'string'
      ? merged.activeShaderId.trim() || null
      : merged.activeShaderId === null
        ? null
        : base.activeShaderId ?? null,
    shaderPerformanceMode: normalizeShaderPerformanceMode(merged.shaderPerformanceMode ?? base.shaderPerformanceMode),
    shaderControlValues: normalizeShaderControlValuesMap(merged.shaderControlValues ?? base.shaderControlValues),
    animations: typeof merged.animations === 'boolean' ? merged.animations : base.animations,
    appOpacity: clampOverlayVisualControlValue('opacity', merged.appOpacity),
    panelTransparency: clampOverlayVisualControlValue('panelTransparency', merged.panelTransparency),
    appZoom: clampOverlayVisualControlValue('zoom', merged.appZoom),
    appBlurStrength: clampOverlayVisualControlValue('blurStrength', merged.appBlurStrength),
    appOpenAnimation: typeof merged.appOpenAnimation === 'string'
      ? merged.appOpenAnimation.trim() || null
      : merged.appOpenAnimation === null
        ? null
        : base.appOpenAnimation ?? null,
    appCloseAnimation: typeof merged.appCloseAnimation === 'string'
      ? merged.appCloseAnimation.trim() || null
      : merged.appCloseAnimation === null
        ? null
        : base.appCloseAnimation ?? null,
    appAnimationDurationMs: clampOverlayAnimationDuration(merged.appAnimationDurationMs),
    appAnimationIntensity: clampOverlayAnimationIntensity(merged.appAnimationIntensity),
    interactionMotionEnabled: merged.interactionMotionEnabled !== false,
    interactionMotionPresetId: normalizeInteractionMotionPresetId(merged.interactionMotionPresetId)
      ?? normalizeInteractionMotionPresetId(base.interactionMotionPresetId)
      ?? null,
    interactionMotionIntensity: clampInteractionMotionIntensity(
      merged.interactionMotionIntensity,
      base.interactionMotionIntensity,
    ),
    interactionMotionModuleOverrides: normalizeInteractionMotionModuleOverrideMap(
      merged.interactionMotionModuleOverrides ?? base.interactionMotionModuleOverrides,
    ),
    interactionMotionSurfaceOverrides: normalizeInteractionMotionSurfaceOverrideMap(
      merged.interactionMotionSurfaceOverrides ?? base.interactionMotionSurfaceOverrides,
    ),
    layoutDynamicsEnabled: merged.layoutDynamicsEnabled !== false,
    layoutDynamicsPresetId: hasExplicitLayoutDynamicsPresetId
      ? normalizeLayoutDynamicsPresetId(updates?.layoutDynamicsPresetId)
      : (normalizeLayoutDynamicsPresetId(base.layoutDynamicsPresetId) ?? null),
    layoutDynamicsIntensity: clampLayoutDynamicsIntensity(
      merged.layoutDynamicsIntensity,
    ),
    layoutDynamicsSurfaceOverrides: normalizeLayoutDynamicsSurfaceOverrideMap(
      merged.layoutDynamicsSurfaceOverrides ?? base.layoutDynamicsSurfaceOverrides,
    ),
    topBarLayoutSnapshotsById: normalizeLayoutDynamicsTopBarLayoutMap(
      merged.topBarLayoutSnapshotsById ?? base.topBarLayoutSnapshotsById,
    ),
  };
}

function normalizeShaderControlValuesMap(
  value: unknown,
): Record<string, Record<string, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalizedEntries = Object.entries(value as Record<string, unknown>)
    .map(([shaderId, controlMap]) => {
      const trimmedShaderId = shaderId.trim();
      if (!trimmedShaderId || !controlMap || typeof controlMap !== 'object' || Array.isArray(controlMap)) {
        return null;
      }

      const normalizedControls = Object.fromEntries(
        Object.entries(controlMap as Record<string, unknown>)
          .filter(([controlId, controlValue]) => (
            typeof controlId === 'string'
            && controlId.trim().length > 0
            && typeof controlValue === 'number'
            && Number.isFinite(controlValue)
          ))
          .map(([controlId, controlValue]) => [controlId.trim(), controlValue as number]),
      );

      return Object.keys(normalizedControls).length > 0
        ? [trimmedShaderId, normalizedControls]
        : null;
    })
    .filter((entry): entry is [string, Record<string, number>] => Array.isArray(entry));

  return Object.fromEntries(normalizedEntries);
}

function normalizeMobileSettings(
  base: MobileSettings,
  updates?: Partial<MobileSettings>,
): MobileSettings {
  const merged = { ...base, ...updates };
  const hasExplicitLayout = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'layout');
  return {
    remoteAccessMode: normalizeMobileRemoteAccessMode(
      merged.remoteAccessMode ?? base.remoteAccessMode,
    ),
    tailscaleLoginServer: typeof merged.tailscaleLoginServer === 'string'
      ? merged.tailscaleLoginServer.trim()
      : base.tailscaleLoginServer,
    tailscaleHostname: typeof merged.tailscaleHostname === 'string'
      ? merged.tailscaleHostname.trim()
      : base.tailscaleHostname,
    layout: hasExplicitLayout
      ? normalizeMobileLayoutSettings(base.layout, updates?.layout)
      : base.layout,
  };
}

function normalizeScreenshotSettings(
  base: ScreenshotSettings,
  updates?: Partial<ScreenshotSettings>,
): ScreenshotSettings {
  const merged = { ...base, ...updates };
  const trimmedSaveDirectory = typeof merged.saveDirectory === 'string'
    ? merged.saveDirectory.trim()
    : '';

  return {
    saveDirectory: trimmedSaveDirectory || base.saveDirectory,
    defaultCaptureMode: isScreenshotCaptureModeId(merged.defaultCaptureMode)
      ? merged.defaultCaptureMode
      : base.defaultCaptureMode,
    defaultOutputAction: isScreenshotOutputActionId(merged.defaultOutputAction)
      ? merged.defaultOutputAction
      : base.defaultOutputAction,
    showGrid: merged.showGrid !== false,
    closeEditorAfterAction: merged.closeEditorAfterAction !== false,
  };
}

export function normalizeAudioSettings(
  base: AudioSettings,
  updates?: Partial<AudioSettings>,
): AudioSettings {
  const merged = { ...base, ...updates };
  return {
    activeSoundPackId: typeof merged.activeSoundPackId === 'string'
      ? merged.activeSoundPackId.trim() || null
      : merged.activeSoundPackId === null
        ? null
        : base.activeSoundPackId,
    soundEffectsEnabled: merged.soundEffectsEnabled !== false,
    soundEffectsVolume: typeof merged.soundEffectsVolume === 'number' && Number.isFinite(merged.soundEffectsVolume)
      ? Math.min(Math.max(merged.soundEffectsVolume, 0), 1)
      : base.soundEffectsVolume,
    buttonSoundsEnabled: merged.buttonSoundsEnabled !== false,
    navigationSoundsEnabled: merged.navigationSoundsEnabled !== false,
    taskSoundsEnabled: merged.taskSoundsEnabled !== false,
    notificationSoundsEnabled: merged.notificationSoundsEnabled !== false,
    nativeNotificationsEnabled: merged.nativeNotificationsEnabled !== false,
    nativeTaskSuccessNotificationsEnabled: merged.nativeTaskSuccessNotificationsEnabled !== false,
    nativeTaskFailureNotificationsEnabled: merged.nativeTaskFailureNotificationsEnabled !== false,
    vst3AdditionalFolders: Array.isArray(merged.vst3AdditionalFolders)
      ? merged.vst3AdditionalFolders.filter((s): s is string => typeof s === 'string')
      : base.vst3AdditionalFolders,
  };
}

export const defaultSettings: Settings = {
  editor: {
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
    tabSize: 2,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',
    cursorBlinking: 'smooth',
    cursorStyle: 'line',
    autoSave: 'afterDelay',
    autoSaveDelay: 1000,
    formatOnSave: true,
    formatOnPaste: false,
  },
  terminal: {
    fontSize: 13,
    fontFamily: 'JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace',
    shell: getDefaultIntegratedShell(),
    shellProfile: defaultIntegratedTerminalProfile,
    shellPath: defaultIntegratedTerminalTemplate.shellPath,
    shellArgs: defaultIntegratedTerminalTemplate.shellArgs,
    integratedHost: 'go-pty-panel',
    showSidebar: true,
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 10000,
    overlayHeight: overlayWindowGeometry.defaultHeight,
    overlayWidth: overlayWindowGeometry.defaultWidth,
    overlayAnchor: 'bottom',
    windowMode: 'windowed',
    windowedWidth: 1440,
    windowedHeight: 920,
    preferredOpenMode: 'integrated',
    externalTerminalProfile: 'auto',
    externalTerminalCommand: '',
    externalTerminalArgs: '',
  },
  python: {
    preferredInterpreterPath: '',
    runtimeRoot: '',
    bootstrapPackages: '',
    autoUpgradePip: true,
    createBoilerplate: true,
  },
  models: {
    capabilityBindings: createDefaultLocalModelCapabilityBindings(),
    semanticIndexRootOverrides: {},
  },
  explorer: {
    defaultPath: getDefaultPath(),
    showHiddenFiles: false,
    sortBy: 'name',
    sortOrder: 'asc',
    viewMode: 'details',
    gridZoom: getExplorerGridZoomAnchor('icons-l'),
    experimentalViewMode: 'off',
    experimentalDensity: DEFAULT_ADAPTIVE_SEMANTIC_DENSITY,
    folderClickMode: 'double',
    doubleClickEmptyToGoBack: false,
    confirmDelete: true,
    defaultFolderIcon: DEFAULT_FOLDER_ICON_VALUE,
    folderIconRules: createDefaultFolderIconRules(),
    thumbnails: defaultExplorerThumbnailSettings,
    collectionPreviewMode: 'list',
    followThemeExplorerLayout: true,
    activeExplorerLayoutId: null,
    layoutUiResetRevision: 0,
    modeProfileOverridesByThemeId: {},
    chromeLayoutOverridesByThemeId: {},
    activeMenuPackId: DEFAULT_EXPLORER_MENU_PACK_ID,
    contextMenuLayoutOverridesByContext: {},
    contextMenuItemOverrides: {},
    preferredWorkbenchByExtension: {},
  },
  home: {
    activePackId: null,
    usageTrackingEnabled: true,
    packStateById: {},
    activePresetIdByPackId: {},
  },
  appearance: {
    theme: 'dark',
    activeThemeId: DEFAULT_PILOT_DARK_THEME_ID,
    dockThemeMode: 'follow-app',
    activeDockThemeId: null,
    activeAppearancePackId: null,
    activeThemeRecipeId: null,
    activeThemeEngineId: null,
    activeShellRendererId: null,
    activeTopBarId: null,
    activeIconThemeId: null,
    customThemes: [],
    customThemeBundles: [],
    activeWallpaperId: null,
    wallpaperFitMode: 'cover',
    wallpaperOpacity: overlayVisualControls.opacity.defaultValue,
    wallpaperMuted: true,
    activeShaderId: null,
    shaderPerformanceMode: shaderSystemConfig.defaultPerformanceMode,
    shaderControlValues: {},
    uiFontFamily: DEFAULT_PILOT_UI_FONT_FAMILY,
    useNativeOsIcons: false,
    accentColor: DEFAULT_PILOT_ACCENT_COLOR,
    sidebarPosition: 'left',
    activityBarPosition: 'side',
    compactMode: false,
    animations: false,
    appOpacity: overlayVisualControls.opacity.defaultValue,
    panelTransparency: overlayVisualControls.panelTransparency.defaultValue,
    appZoom: overlayVisualControls.zoom.defaultValue,
    appBlur: false,
    appBlurStrength: overlayVisualControls.blurStrength.defaultValue,
    appOpenAnimation: null,
    appCloseAnimation: null,
    appAnimationDurationMs: 320,
    appAnimationIntensity: 1.0,
    interactionMotionEnabled: true,
    interactionMotionPresetId: null,
    interactionMotionIntensity: 1.0,
    interactionMotionModuleOverrides: {},
    interactionMotionSurfaceOverrides: {},
    layoutDynamicsEnabled: defaultLayoutDynamicsSettings.enabled,
    layoutDynamicsPresetId: defaultLayoutDynamicsSettings.presetId,
    layoutDynamicsIntensity: defaultLayoutDynamicsSettings.intensity,
    layoutDynamicsSurfaceOverrides:
      defaultLayoutDynamicsSettings.surfaceOverrides,
    topBarLayoutSnapshotsById:
      defaultLayoutDynamicsSettings.topBarLayoutsById,
  },
  system: {
    launchAtStartup: false,
    startMobileShareOnBoot: false,
    hideAppInTray: true,
    showInTaskbar: true,
    gpuTierMode: 'auto',
    accelerationRoutingMode: 'auto',
    developerMode: false,
    devTelemetryHudVisible: true,
    sourceTraceModeEnabled: false,
    developerTelemetryEnabled: false,
    developerTelemetryCaptureMode: 'raw',
    developerTelemetryWriteToFile: true,
    developerTelemetryShowInspector: true,
    developerTelemetryPayloadMode: 'metadata+small-payloads',
    developerTelemetryMaxFileSizeMb: 64,
    consumerDiagnosticsEnabled: false,
    consumerDiagnosticsIncludePluginRuntime: true,
    consumerDiagnosticsIncludeRendererRuntime: true,
    consumerDiagnosticsIncludePerfSamples: true,
    linuxDisplayBackendPreference: 'auto',
    linuxNvidiaWebkitWorkaroundMode: 'auto',
  },
  mobile: {
    remoteAccessMode: 'lan',
    tailscaleLoginServer: '',
    tailscaleHostname: '',
    layout: defaultMobileLayoutSettings,
  },
  screenshots: {
    saveDirectory: screenshotFeatureConfig.defaultSaveDirectory,
    defaultCaptureMode: screenshotFeatureConfig.defaultCaptureMode,
    defaultOutputAction: screenshotFeatureConfig.defaultOutputAction,
    showGrid: true,
    closeEditorAfterAction: true,
  },
  keybindings: createDefaultKeybindingSettings(),
  polygemini: {
    serverUrl: 'http://localhost',
    serverPort: 8090,
    autoStart: false,
    defaultModel: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 8192,
  },
  layout: {
    activeProfileId: DEFAULT_PILOT_LAYOUT_PROFILE_ID,
    configPath: '',
    panelStateByProfile: {},
    shellStateByProfile: {},
    lastProfileIdByShellFamily: {
      classic: DEFAULT_PILOT_LAYOUT_PROFILE_ID,
      ide: DEFAULT_IDE_LAYOUT_PROFILE_ID,
    },
    followThemeDefaults: true,
    zenFocusMode: false,
  },
  audio: {
    activeSoundPackId: null,
    soundEffectsEnabled: true,
    soundEffectsVolume: 0.72,
    buttonSoundsEnabled: true,
    navigationSoundsEnabled: true,
    taskSoundsEnabled: true,
    notificationSoundsEnabled: true,
    nativeNotificationsEnabled: true,
    nativeTaskSuccessNotificationsEnabled: true,
    nativeTaskFailureNotificationsEnabled: true,
    vst3AdditionalFolders: [],
  },
  plugins: {
    valuesByPluginId: {},
  },
};

function normalizeLayoutPanelState(value: unknown): LayoutPanelState {
  const source = value && typeof value === 'object' ? value as Partial<LayoutPanelState> : {};
  return {
    openPanelIds: Array.isArray(source.openPanelIds)
      ? source.openPanelIds.filter((entry): entry is string => typeof entry === 'string')
      : [],
    activePanelId: typeof source.activePanelId === 'string' ? source.activePanelId : null,
    dismissedPanelIds: Array.isArray(source.dismissedPanelIds)
      ? source.dismissedPanelIds.filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
}

function normalizePanelStateByProfile(value: unknown): Record<string, LayoutPanelState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([profileId, panelState]) => [
      profileId,
      normalizeLayoutPanelState(panelState),
    ]),
  );
}

function normalizeShellStateByProfile(value: unknown): Record<string, IdeWorkbenchLayoutState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([profileId, layoutState]) => (
        typeof profileId === 'string'
        && profileId.trim().length > 0
        && layoutState != null
        && typeof layoutState === 'object'
        && !Array.isArray(layoutState)
      ))
      .map(([profileId, layoutState]) => [profileId, layoutState as IdeWorkbenchLayoutState]),
  );
}

function normalizeLastProfileIdByShellFamily(
  value: unknown,
  fallback: Partial<Record<WorkbenchShellFamilyId, string>>,
): Partial<Record<WorkbenchShellFamilyId, string>> {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<WorkbenchShellFamilyId, unknown>>
    : {};
  const nextClassic = typeof source.classic === 'string' && source.classic.trim().length > 0
    ? source.classic.trim()
    : fallback.classic;
  const nextIde = typeof source.ide === 'string' && source.ide.trim().length > 0
    ? source.ide.trim()
    : fallback.ide;

  return {
    ...(nextClassic ? { classic: nextClassic } : {}),
    ...(nextIde ? { ide: nextIde } : {}),
  };
}

function normalizeLayoutSettings(
  base: LayoutSettings,
  updates?: Partial<LayoutSettings>,
): LayoutSettings {
  const merged = { ...base, ...updates };
  const hasExplicitPanelStateByProfile = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'panelStateByProfile');
  const hasExplicitShellStateByProfile = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'shellStateByProfile');
  const hasExplicitLastProfileIdByShellFamily = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'lastProfileIdByShellFamily');

  return {
    activeProfileId: typeof merged.activeProfileId === 'string' && merged.activeProfileId.trim().length > 0
      ? merged.activeProfileId.trim()
      : base.activeProfileId,
    configPath: typeof merged.configPath === 'string' ? merged.configPath : base.configPath,
    panelStateByProfile: hasExplicitPanelStateByProfile
      ? normalizePanelStateByProfile(updates?.panelStateByProfile)
      : base.panelStateByProfile,
    shellStateByProfile: hasExplicitShellStateByProfile
      ? normalizeShellStateByProfile(updates?.shellStateByProfile)
      : base.shellStateByProfile,
    lastProfileIdByShellFamily: hasExplicitLastProfileIdByShellFamily
      ? normalizeLastProfileIdByShellFamily(
        updates?.lastProfileIdByShellFamily,
        base.lastProfileIdByShellFamily,
      )
      : base.lastProfileIdByShellFamily,
    followThemeDefaults: typeof merged.followThemeDefaults === 'boolean'
      ? merged.followThemeDefaults
      : base.followThemeDefaults,
    zenFocusMode: merged.zenFocusMode === true,
  };
}

function normalizePluginSettingsValuesByPluginId(
  value: unknown,
): Record<string, Record<string, OverlayPluginSettingsValue>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(
      ([pluginId, pluginValues]) => {
        const trimmedPluginId = pluginId.trim();
        if (!trimmedPluginId) {
          return [];
        }

        return [[
          trimmedPluginId,
          normalizeOverlayPluginSettingsValueMap(pluginValues),
        ]];
      },
    ),
  );
}

function normalizePluginSettingsCatalog(
  base: PluginSettingsCatalog,
  updates?: Partial<PluginSettingsCatalog>,
): PluginSettingsCatalog {
  const hasExplicitValuesByPluginId =
    updates != null &&
    Object.prototype.hasOwnProperty.call(updates, 'valuesByPluginId');

  return {
    valuesByPluginId: hasExplicitValuesByPluginId
      ? normalizePluginSettingsValuesByPluginId(updates?.valuesByPluginId)
      : base.valuesByPluginId,
  };
}

function mergeSettings(base: Settings, imported?: LegacyImportedSettings): Settings {
  const importedAppearance = imported?.appearance;
  const importedTerminal = imported?.terminal;
  const legacyThemeId = importedAppearance?.activeThemeId ?? importedTerminal?.colorTheme;
  const legacyUiFont = importedAppearance?.uiFontFamily ?? importedAppearance?.uiFont ?? importedTerminal?.uiFont;
  const { uiFont: _legacyAppearanceUiFont, ...importedAppearanceSettings } = importedAppearance ?? {};

  const importedScreenshots = imported?.screenshots;
  const migratedImportedScreenshots = importedScreenshots && isLegacyScreenshotDirectory(importedScreenshots.saveDirectory)
    ? {
        ...importedScreenshots,
        saveDirectory: base.screenshots.saveDirectory,
      }
    : importedScreenshots;
  const normalizedLegacyContextMenuItemOverrides = normalizeExplorerContextMenuItemOverrideMap(
    imported?.explorer?.contextMenuItemOverrides ?? base.explorer.contextMenuItemOverrides,
  );
  const normalizedImportedContextMenuLayouts = normalizeExplorerMenuContextLayoutOverrideMap(
    imported?.explorer?.contextMenuLayoutOverridesByContext ?? base.explorer.contextMenuLayoutOverridesByContext,
  );
  const migratedContextMenuLayouts = Object.keys(normalizedImportedContextMenuLayouts).length > 0
    ? normalizedImportedContextMenuLayouts
    : migrateLegacyContextMenuOverridesToLayouts(normalizedLegacyContextMenuItemOverrides);

  return {
    ...base,
    ...imported,
    editor: { ...base.editor, ...imported?.editor },
    terminal: normalizeTerminalSettings(base.terminal, importedTerminal),
    python: { ...base.python, ...(imported as Partial<Settings> | undefined)?.python },
    models: normalizeModelsSettings(base.models, (imported as Partial<Settings> | undefined)?.models),
    explorer: {
      ...base.explorer,
      ...imported?.explorer,
      viewMode: normalizeExplorerViewMode(imported?.explorer?.viewMode ?? base.explorer.viewMode),
      collectionPreviewMode: normalizeExplorerCollectionPreviewMode(
        imported?.explorer?.collectionPreviewMode ?? base.explorer.collectionPreviewMode,
      ),
      gridZoom: normalizeExplorerGridZoom(
        imported?.explorer?.gridZoom,
        normalizeExplorerViewMode(imported?.explorer?.viewMode ?? base.explorer.viewMode),
      ),
      experimentalViewMode: normalizeExplorerExperimentalViewMode(
        imported?.explorer?.experimentalViewMode ?? base.explorer.experimentalViewMode,
      ),
      experimentalDensity: normalizeAdaptiveSemanticDensity(
        imported?.explorer?.experimentalDensity ?? base.explorer.experimentalDensity,
      ),
      folderClickMode: normalizeExplorerFolderClickMode(imported?.explorer?.folderClickMode ?? base.explorer.folderClickMode),
      doubleClickEmptyToGoBack: imported?.explorer?.doubleClickEmptyToGoBack ?? base.explorer.doubleClickEmptyToGoBack,
      thumbnails: normalizeExplorerThumbnailSettings(
        imported?.explorer?.thumbnails ?? base.explorer.thumbnails,
      ),
      modeProfileOverridesByThemeId: normalizeExplorerModeProfileOverrideMap(
        imported?.explorer?.modeProfileOverridesByThemeId ?? base.explorer.modeProfileOverridesByThemeId,
      ),
      chromeLayoutOverridesByThemeId: normalizeExplorerChromeOverrideSnapshotMap(
        imported?.explorer?.chromeLayoutOverridesByThemeId ?? base.explorer.chromeLayoutOverridesByThemeId,
      ),
      activeMenuPackId: normalizeExplorerMenuPackId(
        imported?.explorer?.activeMenuPackId ?? base.explorer.activeMenuPackId,
      ) ?? base.explorer.activeMenuPackId,
      contextMenuLayoutOverridesByContext: migratedContextMenuLayouts,
      contextMenuItemOverrides: normalizedLegacyContextMenuItemOverrides,
      preferredWorkbenchByExtension: normalizePreferredWorkbenchByExtensionMap(
        imported?.explorer?.preferredWorkbenchByExtension ??
          base.explorer.preferredWorkbenchByExtension,
      ),
    },
    home: normalizeHomeSettings(base.home, (imported as Partial<Settings> | undefined)?.home),
    appearance: {
      ...normalizeAppearanceSettings(base.appearance, {
        ...importedAppearanceSettings,
        activeThemeId: legacyThemeId ?? base.appearance.activeThemeId,
        uiFontFamily: legacyUiFont ?? base.appearance.uiFontFamily,
      }),
    },
    system: normalizeSystemSettings(base.system, (imported as Partial<Settings> | undefined)?.system),
    mobile: normalizeMobileSettings(base.mobile, (imported as Partial<Settings> | undefined)?.mobile),
    screenshots: normalizeScreenshotSettings(base.screenshots, migratedImportedScreenshots),
    keybindings: normalizeKeybindingSettings({ ...base.keybindings, ...imported?.keybindings }),
    polygemini: { ...base.polygemini, ...imported?.polygemini },
    layout: normalizeLayoutSettings(base.layout, (imported as Partial<Settings> | undefined)?.layout),
    audio: normalizeAudioSettings(base.audio, (imported as Partial<Settings> | undefined)?.audio),
    plugins: normalizePluginSettingsCatalog(
      base.plugins,
      (imported as Partial<Settings> | undefined)?.plugins,
    ),
  };
}

export function mergeSettingsWithDefaults(imported?: LegacyImportedSettings): Settings {
  return mergeSettings(defaultSettings, imported);
}

// ============================================================================
// STORE
// ============================================================================

interface SettingsState {
  settings: Settings;
  isOpen: boolean;
  activeRailPath: SettingsRailPathKey;
  activeSection: SettingsSectionKey;
  activePluginSettingsSlotId: string | null;
  activeContextMenuComposerContext: ExplorerMenuContextKind;
  /** Per-section preference for whether SettingsRow descriptions render
   * inline (verbose) or only inside hover-only `InfoBubble` glyphs (compact,
   * the default). Driven by the section header "Show descriptions" toggle.
   */
  showAllDescriptionsBySection: Partial<Record<SettingsSectionKey, boolean>>;
  
  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  setActiveRailPath: (path: SettingsRailPathKey) => void;
  setActiveSection: (section: SettingsSectionKey) => void;
  setActivePluginSettingsSlotId: (slotId: string | null) => void;
  setActiveContextMenuComposerContext: (
    context: ExplorerMenuContextKind,
  ) => void;
  setShowAllDescriptions: (
    section: SettingsSectionKey,
    visible: boolean,
  ) => void;
  
  // Update settings
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateTerminal: (updates: Partial<TerminalSettings>) => void;
  updatePython: (updates: Partial<PythonSettings>) => void;
  updateModels: (updates: Partial<ModelsSettings>) => void;
  updateExplorer: (updates: Partial<ExplorerSettings>) => void;
  setPreferredWorkbenchForExtension: (
    extension: string,
    workbenchId: string,
  ) => void;
  clearPreferredWorkbenchForExtension: (extension: string) => void;
  updateHome: (updates: Partial<HomeSettings>) => void;
  setHomePackState: (packId: string, state: Record<string, unknown>) => void;
  setHomePresetSelection: (packId: string, presetId: string | null) => void;
  setFollowThemeExplorerLayout: (followTheme: boolean) => void;
  setActiveExplorerLayoutId: (layoutId: string | null) => void;
  restoreCanonicalExplorerLayout: () => void;
  resetLayoutCustomizationToCanonical: () => void;
  setExplorerModeProfileOverride: (themeId: string, modeProfileId: ExplorerModeProfileId) => void;
  clearExplorerModeProfileOverride: (themeId: string) => void;
  setExplorerChromeLayoutOverride: (
    themeId: string,
    layoutId: ExplorerChromeLayoutId,
    snapshot: ExplorerChromeOverrideSnapshot,
  ) => void;
  clearExplorerChromeLayoutOverride: (
    themeId: string,
    layoutId: ExplorerChromeLayoutId,
  ) => void;
  updateAppearance: (updates: Partial<AppearanceSettings>) => void;
  applyThemeSelection: (
    themeId: string,
    options?: {
      forceManagedIcons?: boolean;
    },
  ) => void;
  applyDockThemeSelection: (themeId: string) => void;
  updateSystem: (updates: Partial<SystemSettings>) => void;
  updateMobile: (updates: Partial<MobileSettings>) => void;
  updateScreenshots: (updates: Partial<ScreenshotSettings>) => void;
  updateKeybindings: (updates: Partial<KeybindingSettings>) => void;
  updatePolyGemini: (updates: Partial<PolyGeminiSettings>) => void;
  updateLayout: (updates: Partial<LayoutSettings>) => void;
  updateAudio: (updates: Partial<AudioSettings>) => void;
  updatePlugins: (updates: Partial<PluginSettingsCatalog>) => void;
  setPluginSettingsValues: (
    pluginId: string,
    values: Record<string, unknown>,
  ) => void;
  patchPluginSettings: (
    pluginId: string,
    values: Record<string, unknown>,
  ) => void;
  setPluginSettingValue: (
    pluginId: string,
    settingId: string,
    value: unknown,
  ) => void;
  resetPluginSettings: (pluginId: string, settingIds?: string[]) => void;
  clearPluginSettings: (pluginId: string) => void;
  setCommandKeybinding: (commandId: string, value: string) => void;
  
  // Bulk operations
  resetToDefaults: () => void;
  importSettings: (settings: LegacyImportedSettings) => void;
  exportSettings: () => Settings;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isOpen: false,
      activeRailPath: 'settings',
      activeSection: 'overview',
      activePluginSettingsSlotId: null,
      activeContextMenuComposerContext: 'entry',
      showAllDescriptionsBySection: {},
      
      openSettings: () => set({ isOpen: true }),
      closeSettings: () => set({ isOpen: false }),
      setActiveRailPath: (path) => set({
        activeRailPath: normalizeSettingsRailPathKey(path),
      }),
      setActiveSection: (section) => set({ activeSection: normalizeSettingsSectionKey(section) }),
      setActivePluginSettingsSlotId: (slotId) => set({
        activePluginSettingsSlotId:
          typeof slotId === 'string' && slotId.trim().length > 0
            ? slotId.trim()
            : null,
      }),
      setActiveContextMenuComposerContext: (context) => set({
        activeContextMenuComposerContext:
          normalizeExplorerMenuComposerContext(context),
      }),
      setShowAllDescriptions: (section, visible) => set((state) => ({
        showAllDescriptionsBySection: {
          ...state.showAllDescriptionsBySection,
          [normalizeSettingsSectionKey(section)]: visible,
        },
      })),
      
      updateEditor: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          editor: { ...state.settings.editor, ...updates },
        },
      })),
      
      updateTerminal: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          terminal: normalizeTerminalSettings(state.settings.terminal, updates),
        },
      })),

      updatePython: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          python: { ...state.settings.python, ...updates },
        },
      })),

      updateModels: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          models: normalizeModelsSettings(state.settings.models, updates),
        },
      })),
      
      updateExplorer: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          explorer: normalizeExplorerSettings(state.settings.explorer, updates),
        },
      })),

      setPreferredWorkbenchForExtension: (extension, workbenchId) =>
        set((state) => {
          const normalizedExtension = normalizeWorkbenchExtensionKey(extension);
          const normalizedWorkbenchId =
            normalizePreferredWorkbenchId(workbenchId);
          if (!normalizedExtension || !normalizedWorkbenchId) {
            return state;
          }

          return {
            settings: {
              ...state.settings,
              explorer: normalizeExplorerSettings(state.settings.explorer, {
                preferredWorkbenchByExtension: {
                  ...state.settings.explorer.preferredWorkbenchByExtension,
                  [normalizedExtension]: normalizedWorkbenchId,
                },
              }),
            },
          };
        }),

      clearPreferredWorkbenchForExtension: (extension) =>
        set((state) => {
          const normalizedExtension = normalizeWorkbenchExtensionKey(extension);
          if (!normalizedExtension) {
            return state;
          }

          const nextPreferences = {
            ...state.settings.explorer.preferredWorkbenchByExtension,
          };
          delete nextPreferences[normalizedExtension];

          return {
            settings: {
              ...state.settings,
              explorer: normalizeExplorerSettings(state.settings.explorer, {
                preferredWorkbenchByExtension: nextPreferences,
              }),
            },
          };
        }),

      updateHome: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          home: normalizeHomeSettings(state.settings.home, updates),
        },
      })),

      setHomePackState: (packId, packState) => set((state) => {
        const normalizedPackId = packId.trim();
        if (!normalizedPackId) {
          return state;
        }

        return {
          settings: {
            ...state.settings,
            home: normalizeHomeSettings(state.settings.home, {
              packStateById: {
                ...state.settings.home.packStateById,
                [normalizedPackId]: { ...packState },
              },
            }),
          },
        };
      }),

      setHomePresetSelection: (packId, presetId) => set((state) => {
        const normalizedPackId = packId.trim();
        if (!normalizedPackId) {
          return state;
        }

        return {
          settings: {
            ...state.settings,
            home: normalizeHomeSettings(state.settings.home, {
              activePresetIdByPackId: {
                ...state.settings.home.activePresetIdByPackId,
                [normalizedPackId]: normalizeHomePackId(presetId),
              },
            }),
          },
        };
      }),

      setFollowThemeExplorerLayout: (followTheme) => set((state) => ({
        settings: {
          ...state.settings,
          explorer: normalizeExplorerSettings(state.settings.explorer, {
            followThemeExplorerLayout: followTheme,
          }),
        },
      })),

      setActiveExplorerLayoutId: (layoutId) => set((state) => ({
        settings: {
          ...state.settings,
          explorer: normalizeExplorerSettings(state.settings.explorer, {
            activeExplorerLayoutId: layoutId,
            followThemeExplorerLayout: false,
          }),
        },
      })),

      restoreCanonicalExplorerLayout: () => set((state) => ({
        settings: {
          ...state.settings,
          explorer: normalizeExplorerSettings(state.settings.explorer, {
            followThemeExplorerLayout: false,
            activeExplorerLayoutId: EXPLORER_CANONICAL_LAYOUT_ID,
          }),
        },
      })),

      resetLayoutCustomizationToCanonical: () => set((state) => {
        const defaultLayoutDynamics = createDefaultLayoutDynamicsSettings();
        return {
          settings: {
            ...state.settings,
            explorer: normalizeExplorerSettings(state.settings.explorer, {
              followThemeExplorerLayout: false,
              activeExplorerLayoutId: EXPLORER_CANONICAL_LAYOUT_ID,
              chromeLayoutOverridesByThemeId: {},
              layoutUiResetRevision:
                normalizeSettingsRevision(state.settings.explorer.layoutUiResetRevision) + 1,
            }),
            appearance: normalizeAppearanceSettings(state.settings.appearance, {
              layoutDynamicsEnabled: defaultLayoutDynamics.enabled,
              layoutDynamicsPresetId: defaultLayoutDynamics.presetId,
              layoutDynamicsIntensity: defaultLayoutDynamics.intensity,
              layoutDynamicsSurfaceOverrides:
                defaultLayoutDynamics.surfaceOverrides,
              topBarLayoutSnapshotsById:
                defaultLayoutDynamics.topBarLayoutsById,
            }),
          },
        };
      }),

      setExplorerModeProfileOverride: (themeId, modeProfileId) => set((state) => {
        const trimmedThemeId = themeId.trim();
        if (!trimmedThemeId) {
          return state;
        }

        return {
          settings: {
            ...state.settings,
            explorer: {
              ...state.settings.explorer,
              modeProfileOverridesByThemeId: normalizeExplorerModeProfileOverrideMap({
                ...state.settings.explorer.modeProfileOverridesByThemeId,
                [trimmedThemeId]: normalizeExplorerModeProfileId(modeProfileId),
              }),
            },
          },
        };
      }),

      clearExplorerModeProfileOverride: (themeId) => set((state) => {
        const trimmedThemeId = themeId.trim();
        if (!trimmedThemeId) {
          return state;
        }

        const nextModeProfileOverridesByThemeId = {
          ...state.settings.explorer.modeProfileOverridesByThemeId,
        };
        delete nextModeProfileOverridesByThemeId[trimmedThemeId];

        return {
          settings: {
            ...state.settings,
            explorer: {
              ...state.settings.explorer,
              modeProfileOverridesByThemeId: normalizeExplorerModeProfileOverrideMap(
                nextModeProfileOverridesByThemeId,
              ),
            },
          },
        };
      }),

      setExplorerChromeLayoutOverride: (themeId, layoutId, snapshot) => set((state) => {
        const trimmedThemeId = themeId.trim();
        if (!trimmedThemeId) {
          return state;
        }

        const normalizedLayoutId = normalizeExplorerChromeLayoutId(layoutId);
        const normalizedSnapshot = normalizeExplorerChromeOverrideSnapshot(snapshot);
        const nextOverridesByThemeId = normalizeExplorerChromeOverrideSnapshotMap({
          ...state.settings.explorer.chromeLayoutOverridesByThemeId,
          [trimmedThemeId]: {
            ...(state.settings.explorer.chromeLayoutOverridesByThemeId[trimmedThemeId] ?? {}),
            [normalizedLayoutId]: normalizedSnapshot,
          },
        });

        return {
          settings: {
            ...state.settings,
            explorer: {
              ...state.settings.explorer,
              chromeLayoutOverridesByThemeId: nextOverridesByThemeId,
            },
          },
        };
      }),

      clearExplorerChromeLayoutOverride: (themeId, layoutId) => set((state) => {
        const trimmedThemeId = themeId.trim();
        if (!trimmedThemeId) {
          return state;
        }

        const normalizedLayoutId = normalizeExplorerChromeLayoutId(layoutId);
        const themeOverrides = { ...(state.settings.explorer.chromeLayoutOverridesByThemeId[trimmedThemeId] ?? {}) };
        delete themeOverrides[normalizedLayoutId];

        const nextOverridesByThemeId = { ...state.settings.explorer.chromeLayoutOverridesByThemeId };
        if (Object.keys(themeOverrides).length > 0) {
          nextOverridesByThemeId[trimmedThemeId] = themeOverrides;
        } else {
          delete nextOverridesByThemeId[trimmedThemeId];
        }

        return {
          settings: {
            ...state.settings,
            explorer: {
              ...state.settings.explorer,
              chromeLayoutOverridesByThemeId: normalizeExplorerChromeOverrideSnapshotMap(nextOverridesByThemeId),
            },
          },
        };
      }),
      
      updateAppearance: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          appearance: normalizeAppearanceSettings(state.settings.appearance, updates),
        },
      })),

      applyThemeSelection: (themeId, options) => {
        const normalizedThemeId = themeId.trim();
        if (!normalizedThemeId) {
          return;
        }

        const themeDefaults = getThemeSelectionDefaults(normalizedThemeId);
        set((state) => {
          const appearanceUpdates: Partial<AppearanceSettings> = {
            activeThemeId: normalizedThemeId,
            activeShaderId: null,
            appOpenAnimation: null,
            appCloseAnimation: null,
            interactionMotionPresetId: null,
            ...(themeDefaults?.appearance ?? {}),
            ...(options?.forceManagedIcons ? { useNativeOsIcons: false } : {}),
          };

          return {
            settings: {
              ...state.settings,
              appearance: normalizeAppearanceSettings(state.settings.appearance, appearanceUpdates),
              explorer: themeDefaults?.explorer
                ? normalizeExplorerSettings(state.settings.explorer, themeDefaults.explorer)
                : state.settings.explorer,
              layout: state.settings.layout.followThemeDefaults && themeDefaults?.layout
                ? normalizeLayoutSettings(state.settings.layout, themeDefaults.layout)
                : state.settings.layout,
            },
          };
        });
      },

      applyDockThemeSelection: (themeId) => {
        const normalizedThemeId = themeId.trim();
        if (!normalizedThemeId) {
          return;
        }

        set((state) => ({
          settings: {
            ...state.settings,
            appearance: normalizeAppearanceSettings(state.settings.appearance, {
              dockThemeMode: 'override',
              activeDockThemeId: normalizedThemeId,
            }),
          },
        }));
      },

      updateSystem: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          system: normalizeSystemSettings(state.settings.system, updates),
        },
      })),

      updateMobile: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          mobile: normalizeMobileSettings(state.settings.mobile, updates),
        },
      })),

      updateScreenshots: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          screenshots: normalizeScreenshotSettings(state.settings.screenshots, updates),
        },
      })),
      
      updateKeybindings: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          keybindings: normalizeKeybindingSettings({ ...state.settings.keybindings, ...updates }),
        },
      })),

      setCommandKeybinding: (commandId, value) => set((state) => {
        const normalizedCommandId = commandId.trim();
        if (!normalizedCommandId) {
          return state;
        }

        const normalizedValue = normalizeKeybindingValue(value, '');
        const nextCommandBindingsById = {
          ...state.settings.keybindings.commandBindingsById,
        };
        if (normalizedValue) {
          nextCommandBindingsById[normalizedCommandId] = normalizedValue;
        } else {
          delete nextCommandBindingsById[normalizedCommandId];
        }

        return {
          settings: {
            ...state.settings,
            keybindings: normalizeKeybindingSettings({
              ...state.settings.keybindings,
              commandBindingsById: nextCommandBindingsById,
            }),
          },
        };
      }),
      
      updatePolyGemini: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          polygemini: { ...state.settings.polygemini, ...updates },
        },
      })),

      updateLayout: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          layout: normalizeLayoutSettings(state.settings.layout, updates),
        },
      })),

      updateAudio: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          audio: normalizeAudioSettings(state.settings.audio, updates),
        },
      })),

      updatePlugins: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          plugins: normalizePluginSettingsCatalog(state.settings.plugins, updates),
        },
      })),

      setPluginSettingsValues: (pluginId, values) => set((state) => {
        const normalizedPluginId = pluginId.trim();
        if (!normalizedPluginId) {
          return state;
        }

        const normalizedValues =
          normalizeOverlayPluginSettingsValueMap(values);
        const nextValuesByPluginId = {
          ...state.settings.plugins.valuesByPluginId,
        };
        if (Object.keys(normalizedValues).length > 0) {
          nextValuesByPluginId[normalizedPluginId] = normalizedValues;
        } else {
          delete nextValuesByPluginId[normalizedPluginId];
        }

        return {
          settings: {
            ...state.settings,
            plugins: normalizePluginSettingsCatalog(state.settings.plugins, {
              valuesByPluginId: nextValuesByPluginId,
            }),
          },
        };
      }),

      patchPluginSettings: (pluginId, values) => set((state) => {
        const normalizedPluginId = pluginId.trim();
        if (!normalizedPluginId) {
          return state;
        }

        const nextPluginValues = {
          ...(state.settings.plugins.valuesByPluginId[normalizedPluginId] ?? {}),
          ...normalizeOverlayPluginSettingsValueMap(values),
        };
        const nextValuesByPluginId = {
          ...state.settings.plugins.valuesByPluginId,
        };
        if (Object.keys(nextPluginValues).length > 0) {
          nextValuesByPluginId[normalizedPluginId] = nextPluginValues;
        } else {
          delete nextValuesByPluginId[normalizedPluginId];
        }

        return {
          settings: {
            ...state.settings,
            plugins: normalizePluginSettingsCatalog(state.settings.plugins, {
              valuesByPluginId: nextValuesByPluginId,
            }),
          },
        };
      }),

      setPluginSettingValue: (pluginId, settingId, value) => set((state) => {
        const normalizedPluginId = pluginId.trim();
        const normalizedSettingId = settingId.trim();
        if (!normalizedPluginId || !normalizedSettingId) {
          return state;
        }

        const nextPluginValues = {
          ...(state.settings.plugins.valuesByPluginId[normalizedPluginId] ?? {}),
        };
        const sanitizedValue = normalizeOverlayPluginSettingsValueMap({
          [normalizedSettingId]: value,
        })[normalizedSettingId];
        if (sanitizedValue === undefined) {
          delete nextPluginValues[normalizedSettingId];
        } else {
          nextPluginValues[normalizedSettingId] = sanitizedValue;
        }

        const nextValuesByPluginId = {
          ...state.settings.plugins.valuesByPluginId,
        };
        if (Object.keys(nextPluginValues).length > 0) {
          nextValuesByPluginId[normalizedPluginId] = nextPluginValues;
        } else {
          delete nextValuesByPluginId[normalizedPluginId];
        }

        return {
          settings: {
            ...state.settings,
            plugins: normalizePluginSettingsCatalog(state.settings.plugins, {
              valuesByPluginId: nextValuesByPluginId,
            }),
          },
        };
      }),

      resetPluginSettings: (pluginId, settingIds) => set((state) => {
        const normalizedPluginId = pluginId.trim();
        if (!normalizedPluginId) {
          return state;
        }

        if (!Array.isArray(settingIds) || settingIds.length === 0) {
          const nextValuesByPluginId = {
            ...state.settings.plugins.valuesByPluginId,
          };
          delete nextValuesByPluginId[normalizedPluginId];
          return {
            settings: {
              ...state.settings,
              plugins: normalizePluginSettingsCatalog(state.settings.plugins, {
                valuesByPluginId: nextValuesByPluginId,
              }),
            },
          };
        }

        const nextPluginValues = {
          ...(state.settings.plugins.valuesByPluginId[normalizedPluginId] ?? {}),
        };
        settingIds
          .map((settingId) => settingId.trim())
          .filter((settingId) => settingId.length > 0)
          .forEach((settingId) => {
            delete nextPluginValues[settingId];
          });

        const nextValuesByPluginId = {
          ...state.settings.plugins.valuesByPluginId,
        };
        if (Object.keys(nextPluginValues).length > 0) {
          nextValuesByPluginId[normalizedPluginId] = nextPluginValues;
        } else {
          delete nextValuesByPluginId[normalizedPluginId];
        }

        return {
          settings: {
            ...state.settings,
            plugins: normalizePluginSettingsCatalog(state.settings.plugins, {
              valuesByPluginId: nextValuesByPluginId,
            }),
          },
        };
      }),

      clearPluginSettings: (pluginId) => set((state) => {
        const normalizedPluginId = pluginId.trim();
        if (!normalizedPluginId) {
          return state;
        }

        const nextValuesByPluginId = {
          ...state.settings.plugins.valuesByPluginId,
        };
        delete nextValuesByPluginId[normalizedPluginId];

        return {
          settings: {
            ...state.settings,
            plugins: normalizePluginSettingsCatalog(state.settings.plugins, {
              valuesByPluginId: nextValuesByPluginId,
            }),
          },
        };
      }),
      
      resetToDefaults: () => set(() => ({
        settings: {
          ...defaultSettings,
          system: normalizeSystemSettings(defaultSettings.system),
        },
        activeRailPath: 'settings',
        activePluginSettingsSlotId: null,
        activeContextMenuComposerContext: 'entry',
      })),
      
      importSettings: (imported) => set((state) => ({
        settings: mergeSettings(state.settings, imported),
      })),
      
      exportSettings: () => get().settings,
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => getSettingsStorage()),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsState> | undefined;
        const persistedShowAll = persisted?.showAllDescriptionsBySection;
        const sanitizedShowAll: Partial<Record<SettingsSectionKey, boolean>> = {};
        if (persistedShowAll && typeof persistedShowAll === 'object') {
          for (const [key, value] of Object.entries(persistedShowAll)) {
            if (typeof value === 'boolean') {
              sanitizedShowAll[normalizeSettingsSectionKey(key)] = value;
            }
          }
        }
        return {
          ...currentState,
          ...persisted,
          activeRailPath: normalizeSettingsRailPathKey(
            persisted?.activeRailPath ?? currentState.activeRailPath,
          ),
          activeSection: normalizeSettingsSectionKey(persisted?.activeSection ?? currentState.activeSection),
          activePluginSettingsSlotId:
            typeof persisted?.activePluginSettingsSlotId === 'string'
            && persisted.activePluginSettingsSlotId.trim().length > 0
              ? persisted.activePluginSettingsSlotId.trim()
              : currentState.activePluginSettingsSlotId,
          activeContextMenuComposerContext: normalizeExplorerMenuComposerContext(
            persisted?.activeContextMenuComposerContext
              ?? currentState.activeContextMenuComposerContext,
          ),
          showAllDescriptionsBySection: sanitizedShowAll,
          settings: mergeSettingsWithDefaults(persisted?.settings),
        };
      },
    }
  )
);

installSettingsStorageSync();

function installSettingsStorageSync(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const marker = '__greeblefs_settings_storage_sync_installed__';
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  if (globalState[marker]) {
    return;
  }
  globalState[marker] = true;

  window.addEventListener('storage', event => {
    if (event.key !== SETTINGS_STORAGE_KEY || event.newValue === event.oldValue) {
      return;
    }

    const persistApi = (useSettingsStore as typeof useSettingsStore & {
      persist?: { rehydrate?: () => Promise<void> | void };
    }).persist;
    void persistApi?.rehydrate?.();
  });
}
