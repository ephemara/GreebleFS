/**
 * Settings Store - Data-driven configuration system
 * NO HARDCODED PATHS - Everything configurable via JSON
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeThemeDefinition, type OverlayThemeDefinition } from '../config/appearance';
import {
  createDefaultFolderIconRules,
  DEFAULT_FOLDER_ICON_VALUE,
  type FolderIconRule,
  type FolderIconValue,
} from '../config/folderIcons';
import {
  getDefaultIntegratedShell,
  type ExternalTerminalProfile,
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
import {
  normalizeExplorerContextMenuItemOverrideMap,
  type ExplorerContextMenuItemOverrideMap,
} from '../config/explorerContextMenu';
import {
  createDefaultKeybindingSettings,
  normalizeKeybindingSettings,
  type HotkeyBindingSettings,
} from '../config/hotkeys';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  type OverlayAnimationPresetId,
} from '../config/overlayAnimations';
import {
  clampOverlayVisualControlValue,
  overlayVisualControls,
  overlayWindowGeometry,
} from '../config/overlayWindow';
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
  DEFAULT_PILOT_ACCENT_COLOR,
  DEFAULT_PILOT_DARK_THEME_ID,
  DEFAULT_PILOT_LAYOUT_PROFILE_ID,
  DEFAULT_PILOT_UI_FONT_FAMILY,
  getThemeSelectionDefaults,
} from '../config/pilotThemeContract';

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

export interface PythonSettings {
  preferredInterpreterPath: string;
  runtimeRoot: string;
  bootstrapPackages: string;
  autoUpgradePip: boolean;
  createBoilerplate: boolean;
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
  confirmDelete: boolean;
  defaultFolderIcon: FolderIconValue;
  folderIconRules: FolderIconRule[];
  modeProfileOverridesByThemeId: Record<string, ExplorerModeProfileId>;
  chromeLayoutOverridesByThemeId: Record<string, Record<string, ExplorerChromeOverrideSnapshot>>;
  contextMenuItemOverrides: ExplorerContextMenuItemOverrideMap;
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  activeThemeId: string;
  dockThemeMode: DockThemeMode;
  activeDockThemeId: string | null;
  customThemes: OverlayThemeDefinition[];
  activeWallpaperId?: string | null;
  wallpaperFitMode: OverlayWallpaperFitMode;
  wallpaperOpacity: number;
  wallpaperMuted: boolean;
  activeShaderId?: string | null;
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
}

export interface SystemSettings {
  launchAtStartup: boolean;
  hideAppInTray: boolean;
  showInTaskbar: boolean;
  developerMode: boolean;
}

export interface ScreenshotSettings {
  saveDirectory: string;
  defaultCaptureMode: ScreenshotCaptureModeId;
  defaultOutputAction: ScreenshotOutputActionId;
  showGrid: boolean;
  closeEditorAfterAction: boolean;
}

export type KeybindingSettings = HotkeyBindingSettings;
export type DockThemeMode = 'follow-app' | 'override';

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
  explorer: ExplorerSettings;
  appearance: AppearanceSettings;
  system: SystemSettings;
  screenshots: ScreenshotSettings;
  keybindings: KeybindingSettings;
  polygemini: PolyGeminiSettings;
  layout: LayoutSettings;
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
  // Return current working directory - will be set by Tauri on first load
  // This is safer than guessing user paths
  return '.';
};

export function normalizeOverlayWindowAnchor(value: unknown): OverlayWindowAnchor {
  return value === 'top' ? 'top' : 'bottom';
}

export function normalizeTerminalWindowMode(value: unknown): TerminalWindowMode {
  return value === 'overlay' ? 'overlay' : 'windowed';
}

export function normalizeDockThemeMode(value: unknown): DockThemeMode {
  return value === 'override' ? 'override' : 'follow-app';
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
  const hasExplicitContextMenuItemOverrides = updates != null
    && Object.prototype.hasOwnProperty.call(updates, 'contextMenuItemOverrides');

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
    modeProfileOverridesByThemeId: hasExplicitModeProfileOverrides
      ? normalizeExplorerModeProfileOverrideMap(updates?.modeProfileOverridesByThemeId)
      : base.modeProfileOverridesByThemeId,
    chromeLayoutOverridesByThemeId: hasExplicitChromeLayoutOverrides
      ? normalizeExplorerChromeOverrideSnapshotMap(updates?.chromeLayoutOverridesByThemeId)
      : base.chromeLayoutOverridesByThemeId,
    contextMenuItemOverrides: hasExplicitContextMenuItemOverrides
      ? normalizeExplorerContextMenuItemOverrideMap(updates?.contextMenuItemOverrides)
      : base.contextMenuItemOverrides,
  };
}

function normalizeSavedWindowDimension(value: unknown, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(Math.round(value), min);
}

function normalizeTerminalSettings(
  base: TerminalSettings,
  updates?: Partial<TerminalSettings>,
): TerminalSettings {
  const merged = { ...base, ...updates };
  return {
    ...merged,
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
    hideAppInTray: merged.hideAppInTray !== false,
    showInTaskbar: Boolean(merged.showInTaskbar),
    developerMode: Boolean(merged.developerMode),
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
  return {
    ...merged,
    customThemes: (merged.customThemes ?? base.customThemes).map(theme => normalizeThemeDefinition(theme)),
    dockThemeMode: normalizeDockThemeMode(merged.dockThemeMode ?? base.dockThemeMode),
    activeDockThemeId: typeof merged.activeDockThemeId === 'string'
      ? merged.activeDockThemeId.trim() || null
      : merged.activeDockThemeId === null
        ? null
        : base.activeDockThemeId ?? null,
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
    shaderControlValues: normalizeShaderControlValuesMap(merged.shaderControlValues ?? base.shaderControlValues),
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
    confirmDelete: true,
    defaultFolderIcon: DEFAULT_FOLDER_ICON_VALUE,
    folderIconRules: createDefaultFolderIconRules(),
    modeProfileOverridesByThemeId: {},
    chromeLayoutOverridesByThemeId: {},
    contextMenuItemOverrides: {},
  },
  appearance: {
    theme: 'dark',
    activeThemeId: DEFAULT_PILOT_DARK_THEME_ID,
    dockThemeMode: 'follow-app',
    activeDockThemeId: null,
    customThemes: [],
    activeWallpaperId: null,
    wallpaperFitMode: 'cover',
    wallpaperOpacity: overlayVisualControls.opacity.defaultValue,
    wallpaperMuted: true,
    activeShaderId: null,
    shaderControlValues: {},
    uiFontFamily: DEFAULT_PILOT_UI_FONT_FAMILY,
    useNativeOsIcons: false,
    accentColor: DEFAULT_PILOT_ACCENT_COLOR,
    sidebarPosition: 'left',
    activityBarPosition: 'side',
    compactMode: false,
    animations: true,
    appOpacity: overlayVisualControls.opacity.defaultValue,
    panelTransparency: overlayVisualControls.panelTransparency.defaultValue,
    appZoom: overlayVisualControls.zoom.defaultValue,
    appBlur: false,
    appBlurStrength: overlayVisualControls.blurStrength.defaultValue,
    appOpenAnimation: null,
    appCloseAnimation: null,
    appAnimationDurationMs: 320,
    appAnimationIntensity: 1.0,
  },
  system: {
    launchAtStartup: false,
    hideAppInTray: true,
    showInTaskbar: true,
    developerMode: false,
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

  return {
    ...base,
    ...imported,
    editor: { ...base.editor, ...imported?.editor },
    terminal: normalizeTerminalSettings(base.terminal, importedTerminal),
    python: { ...base.python, ...(imported as Partial<Settings> | undefined)?.python },
    explorer: {
      ...base.explorer,
      ...imported?.explorer,
      viewMode: normalizeExplorerViewMode(imported?.explorer?.viewMode ?? base.explorer.viewMode),
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
      modeProfileOverridesByThemeId: normalizeExplorerModeProfileOverrideMap(
        imported?.explorer?.modeProfileOverridesByThemeId ?? base.explorer.modeProfileOverridesByThemeId,
      ),
      chromeLayoutOverridesByThemeId: normalizeExplorerChromeOverrideSnapshotMap(
        imported?.explorer?.chromeLayoutOverridesByThemeId ?? base.explorer.chromeLayoutOverridesByThemeId,
      ),
      contextMenuItemOverrides: normalizeExplorerContextMenuItemOverrideMap(
        imported?.explorer?.contextMenuItemOverrides ?? base.explorer.contextMenuItemOverrides,
      ),
    },
    appearance: {
      ...normalizeAppearanceSettings(base.appearance, {
        ...importedAppearanceSettings,
        activeThemeId: legacyThemeId ?? base.appearance.activeThemeId,
        uiFontFamily: legacyUiFont ?? base.appearance.uiFontFamily,
      }),
    },
    system: normalizeSystemSettings(base.system, (imported as Partial<Settings> | undefined)?.system),
    screenshots: normalizeScreenshotSettings(base.screenshots, migratedImportedScreenshots),
    keybindings: normalizeKeybindingSettings({ ...base.keybindings, ...imported?.keybindings }),
    polygemini: { ...base.polygemini, ...imported?.polygemini },
    layout: {
      ...base.layout,
      ...(imported as Partial<Settings> | undefined)?.layout,
      panelStateByProfile: normalizePanelStateByProfile(
        (imported as Partial<Settings> | undefined)?.layout?.panelStateByProfile ?? base.layout.panelStateByProfile,
      ),
    },
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
  activeSection: string;
  
  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  setActiveSection: (section: string) => void;
  
  // Update settings
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateTerminal: (updates: Partial<TerminalSettings>) => void;
  updatePython: (updates: Partial<PythonSettings>) => void;
  updateExplorer: (updates: Partial<ExplorerSettings>) => void;
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
  updateScreenshots: (updates: Partial<ScreenshotSettings>) => void;
  updateKeybindings: (updates: Partial<KeybindingSettings>) => void;
  updatePolyGemini: (updates: Partial<PolyGeminiSettings>) => void;
  updateLayout: (updates: Partial<LayoutSettings>) => void;
  
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
      activeSection: 'editor',
      
      openSettings: () => set({ isOpen: true }),
      closeSettings: () => set({ isOpen: false }),
      setActiveSection: (section) => set({ activeSection: section }),
      
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
      
      updateExplorer: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          explorer: normalizeExplorerSettings(state.settings.explorer, updates),
        },
      })),

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
              layout: themeDefaults?.layout
                ? { ...state.settings.layout, ...themeDefaults.layout }
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
      
      updatePolyGemini: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          polygemini: { ...state.settings.polygemini, ...updates },
        },
      })),

      updateLayout: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          layout: { ...state.settings.layout, ...updates },
        },
      })),
      
      resetToDefaults: () => set(() => ({
        settings: {
          ...defaultSettings,
          system: normalizeSystemSettings(defaultSettings.system),
        },
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
        return {
          ...currentState,
          ...persisted,
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
