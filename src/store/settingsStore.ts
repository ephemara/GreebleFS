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
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  type OverlayAnimationPresetId,
} from '../config/overlayAnimations';
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
  preferredOpenMode: 'integrated' | 'external';
  externalTerminalProfile: ExternalTerminalProfile;
  externalTerminalCommand: string;
  externalTerminalArgs: string;
}

export interface ExplorerSettings {
  defaultPath: string;
  showHiddenFiles: boolean;
  sortBy: 'name' | 'size' | 'date' | 'type';
  sortOrder: 'asc' | 'desc';
  viewMode: 'list' | 'grid';
  confirmDelete: boolean;
  defaultFolderIcon: FolderIconValue;
  folderIconRules: FolderIconRule[];
}

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  activeThemeId: string;
  customThemes: OverlayThemeDefinition[];
  uiFontFamily: string;
  accentColor: string;
  sidebarPosition: 'left' | 'right';
  activityBarPosition: 'side' | 'top';
  compactMode: boolean;
  animations: boolean;
  appOpacity: number;
  appZoom: number;
  appBlur: boolean;
  appOpenAnimation: OverlayAnimationPresetId;
  appCloseAnimation: OverlayAnimationPresetId;
  appAnimationDurationMs: number;
  appAnimationIntensity: number;
}

export interface SystemSettings {
  launchAtStartup: boolean;
}

export interface ScreenshotSettings {
  saveDirectory: string;
}

export interface KeybindingSettings {
  commandPalette: string;
  terminalToggle: string;
  saveFile: string;
  newFile: string;
  closeTab: string;
  find: string;
  replace: string;
}

export interface PolyGeminiSettings {
  serverUrl: string;
  serverPort: number;
  autoStart: boolean;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

export interface LayoutSettings {
  activeProfileId: string;
  configPath: string;
}

export interface Settings {
  editor: EditorSettings;
  terminal: TerminalSettings;
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
    preferredOpenMode: 'integrated',
    externalTerminalProfile: 'auto',
    externalTerminalCommand: '',
    externalTerminalArgs: '',
  },
  explorer: {
    defaultPath: getDefaultPath(),
    showHiddenFiles: false,
    sortBy: 'name',
    sortOrder: 'asc',
    viewMode: 'list',
    confirmDelete: true,
    defaultFolderIcon: DEFAULT_FOLDER_ICON_VALUE,
    folderIconRules: createDefaultFolderIconRules(),
  },
  appearance: {
    theme: 'dark',
    activeThemeId: 'operator',
    customThemes: [],
    uiFontFamily: 'Inter, system-ui, sans-serif',
    accentColor: '#6366f1',
    sidebarPosition: 'left',
    activityBarPosition: 'side',
    compactMode: false,
    animations: true,
    appOpacity: 1.0,
    appZoom: 1.0,
    appBlur: true,
    appOpenAnimation: 'spring-lift',
    appCloseAnimation: 'burn',
    appAnimationDurationMs: 320,
    appAnimationIntensity: 1.0,
  },
  system: {
    launchAtStartup: false,
  },
  screenshots: {
    saveDirectory: screenshotFeatureConfig.defaultSaveDirectory,
  },
  keybindings: {
    commandPalette: 'Ctrl+K',
    terminalToggle: 'Ctrl+Space',
    saveFile: 'Ctrl+S',
    newFile: 'Ctrl+N',
    closeTab: 'Ctrl+W',
    find: 'Ctrl+F',
    replace: 'Ctrl+H',
  },
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
  },
};

function mergeSettings(base: Settings, imported?: LegacyImportedSettings): Settings {
  const importedAppearance = imported?.appearance;
  const importedTerminal = imported?.terminal;
  const legacyThemeId = importedAppearance?.activeThemeId ?? importedTerminal?.colorTheme;
  const legacyUiFont = importedAppearance?.uiFontFamily ?? importedAppearance?.uiFont ?? importedTerminal?.uiFont;

  return {
    ...base,
    ...imported,
    editor: { ...base.editor, ...imported?.editor },
    terminal: {
      ...base.terminal,
      ...importedTerminal,
    },
    explorer: { ...base.explorer, ...imported?.explorer },
    appearance: {
      ...base.appearance,
      ...importedAppearance,
      activeThemeId: legacyThemeId ?? base.appearance.activeThemeId,
      uiFontFamily: legacyUiFont ?? base.appearance.uiFontFamily,
      customThemes: (importedAppearance?.customThemes ?? base.appearance.customThemes).map(normalizeThemeDefinition),
      appAnimationDurationMs: clampOverlayAnimationDuration(importedAppearance?.appAnimationDurationMs ?? base.appearance.appAnimationDurationMs),
      appAnimationIntensity: clampOverlayAnimationIntensity(importedAppearance?.appAnimationIntensity ?? base.appearance.appAnimationIntensity),
    },
    system: { ...base.system, ...(imported as Partial<Settings> | undefined)?.system },
    screenshots: { ...base.screenshots, ...imported?.screenshots },
    keybindings: { ...base.keybindings, ...imported?.keybindings },
    polygemini: { ...base.polygemini, ...imported?.polygemini },
    layout: { ...base.layout, ...(imported as Partial<Settings> | undefined)?.layout },
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
      
      updateExplorer: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          explorer: { ...state.settings.explorer, ...updates },
        },
      })),
      
      updateAppearance: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          appearance: { ...state.settings.appearance, ...updates },
        },
      })),

      updateSystem: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          system: { ...state.settings.system, ...updates },
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
          keybindings: { ...state.settings.keybindings, ...updates },
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
          system: state.settings.system,
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
