/**
 * Settings Store - Data-driven configuration system
 * NO HARDCODED PATHS - Everything configurable via JSON
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
} from '../config/overlayWindow';
import { screenshotFeatureConfig } from '../config/screenshots';
import { getDefaultLayoutProfile } from '../config/layoutProfiles';

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
  overlayWidth: number;  // -1 means "full monitor work area width minus padding"
  overlayAnchor: OverlayWindowAnchor;
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
  viewMode: 'list' | 'grid';
  folderClickMode: ExplorerFolderClickMode;
  confirmDelete: boolean;
  defaultFolderIcon: FolderIconValue;
  folderIconRules: FolderIconRule[];
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  activeThemeId: string;
  customThemes: OverlayThemeDefinition[];
  activeShaderId?: string | null;
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
  appOpenAnimation: OverlayAnimationPresetId;
  appCloseAnimation: OverlayAnimationPresetId;
  appAnimationDurationMs: number;
  appAnimationIntensity: number;
}

export interface SystemSettings {
  launchAtStartup: boolean;
  hideAppInTray: boolean;
  showInTaskbar: boolean;
}

export interface ScreenshotSettings {
  saveDirectory: string;
}

export type KeybindingSettings = HotkeyBindingSettings;

export interface PolyGeminiSettings {
  serverUrl: string;
  serverPort: number;
  autoStart: boolean;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export type OverlayWindowAnchor = 'top' | 'bottom';

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

export function normalizeExplorerFolderClickMode(value: unknown): ExplorerFolderClickMode {
  return value === 'single' ? 'single' : 'double';
}

function isDevEnvironment(): boolean {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  return env?.DEV === true;
}

function normalizeSystemSettings(
  base: SystemSettings,
  updates?: Partial<SystemSettings>,
): SystemSettings {
  const merged = { ...base, ...updates };
  const normalized: SystemSettings = {
    launchAtStartup: Boolean(merged.launchAtStartup),
    hideAppInTray: merged.hideAppInTray !== false,
    showInTaskbar: Boolean(merged.showInTaskbar),
  };

  // Keep at least one desktop entry point visible so the overlay is always recoverable.
  if (!normalized.hideAppInTray && !normalized.showInTaskbar) {
    normalized.hideAppInTray = true;
  }

  return normalized;
}

function normalizeAppearanceSettings(
  base: AppearanceSettings,
  updates?: Partial<AppearanceSettings>,
): AppearanceSettings {
  const merged = { ...base, ...updates };
  return {
    ...merged,
    customThemes: (merged.customThemes ?? base.customThemes).map(theme => normalizeThemeDefinition(theme)),
    activeShaderId: typeof merged.activeShaderId === 'string'
      ? merged.activeShaderId.trim() || null
      : merged.activeShaderId === null
        ? null
        : base.activeShaderId ?? null,
    appOpacity: clampOverlayVisualControlValue('opacity', merged.appOpacity),
    panelTransparency: clampOverlayVisualControlValue('panelTransparency', merged.panelTransparency),
    appZoom: clampOverlayVisualControlValue('zoom', merged.appZoom),
    appBlurStrength: clampOverlayVisualControlValue('blurStrength', merged.appBlurStrength),
    appAnimationDurationMs: clampOverlayAnimationDuration(merged.appAnimationDurationMs),
    appAnimationIntensity: clampOverlayAnimationIntensity(merged.appAnimationIntensity),
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
    overlayHeight: 420,
    overlayWidth: -1,
    overlayAnchor: 'bottom',
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
    viewMode: 'list',
    folderClickMode: 'double',
    confirmDelete: true,
    defaultFolderIcon: DEFAULT_FOLDER_ICON_VALUE,
    folderIconRules: createDefaultFolderIconRules(),
  },
  appearance: {
    theme: 'dark',
    activeThemeId: 'operator',
    customThemes: [],
    activeShaderId: null,
    uiFontFamily: 'Inter, system-ui, sans-serif',
    useNativeOsIcons: false,
    accentColor: '#6366f1',
    sidebarPosition: 'left',
    activityBarPosition: 'side',
    compactMode: false,
    animations: true,
    appOpacity: overlayVisualControls.opacity.defaultValue,
    panelTransparency: overlayVisualControls.panelTransparency.defaultValue,
    appZoom: overlayVisualControls.zoom.defaultValue,
    appBlur: true,
    appBlurStrength: overlayVisualControls.blurStrength.defaultValue,
    appOpenAnimation: 'spring-lift',
    appCloseAnimation: 'burn',
    appAnimationDurationMs: 320,
    appAnimationIntensity: 1.0,
  },
  system: {
    launchAtStartup: false,
    hideAppInTray: true,
    showInTaskbar: isDevEnvironment(),
  },
  screenshots: {
    saveDirectory: screenshotFeatureConfig.defaultSaveDirectory,
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
    activeProfileId: getDefaultLayoutProfile().id,
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

  return {
    ...base,
    ...imported,
    editor: { ...base.editor, ...imported?.editor },
    terminal: {
      ...base.terminal,
      ...importedTerminal,
      overlayAnchor: normalizeOverlayWindowAnchor(importedTerminal?.overlayAnchor ?? base.terminal.overlayAnchor),
    },
    python: { ...base.python, ...(imported as Partial<Settings> | undefined)?.python },
    explorer: {
      ...base.explorer,
      ...imported?.explorer,
      folderClickMode: normalizeExplorerFolderClickMode(imported?.explorer?.folderClickMode ?? base.explorer.folderClickMode),
    },
    appearance: {
      ...normalizeAppearanceSettings(base.appearance, {
        ...importedAppearanceSettings,
        activeThemeId: legacyThemeId ?? base.appearance.activeThemeId,
        uiFontFamily: legacyUiFont ?? base.appearance.uiFontFamily,
      }),
    },
    system: normalizeSystemSettings(base.system, (imported as Partial<Settings> | undefined)?.system),
    screenshots: { ...base.screenshots, ...imported?.screenshots },
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
  updateAppearance: (updates: Partial<AppearanceSettings>) => void;
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
          terminal: { ...state.settings.terminal, ...updates },
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
          explorer: { ...state.settings.explorer, ...updates },
        },
      })),
      
      updateAppearance: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          appearance: normalizeAppearanceSettings(state.settings.appearance, updates),
        },
      })),

      updateSystem: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          system: normalizeSystemSettings(state.settings.system, updates),
        },
      })),

      updateScreenshots: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          screenshots: { ...state.settings.screenshots, ...updates },
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
      
      resetToDefaults: () => set((state) => ({
        settings: {
          ...defaultSettings,
          system: normalizeSystemSettings(defaultSettings.system, state.settings.system),
        },
      })),
      
      importSettings: (imported) => set((state) => ({
        settings: mergeSettings(state.settings, imported),
      })),
      
      exportSettings: () => get().settings,
    }),
    {
      name: 'ultacode-settings',
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
