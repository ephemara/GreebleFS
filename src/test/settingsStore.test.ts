/**
 * Settings store tests
 * Tests the Zustand store logic in isolation — no Tauri, no DOM.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, defaultSettings, mergeSettingsWithDefaults } from '../store/settingsStore';

beforeEach(() => {
  useSettingsStore.getState().resetToDefaults();
});

describe('useSettingsStore — initial state', () => {
  it('has the correct default terminal settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.cursorBlink).toBe(true);
    expect(settings.terminal.scrollback).toBe(10000);
    expect(settings.terminal.overlayHeight).toBe(420);
    expect(settings.terminal.overlayAnchor).toBe('bottom');
    expect(settings.terminal.fontSize).toBe(13);
    expect(settings.terminal.preferredOpenMode).toBe('integrated');
    expect(settings.terminal.externalTerminalProfile).toBe('auto');
  });

  it('has the correct default python settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.python.preferredInterpreterPath).toBe('');
    expect(settings.python.runtimeRoot).toBe('');
    expect(settings.python.bootstrapPackages).toBe('');
    expect(settings.python.autoUpgradePip).toBe(true);
    expect(settings.python.createBoilerplate).toBe(true);
  });

  it('has the correct default explorer settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.explorer.showHiddenFiles).toBe(false);
    expect(settings.explorer.sortBy).toBe('name');
    expect(settings.explorer.sortOrder).toBe('asc');
    expect(settings.explorer.viewMode).toBe('list');
    expect(settings.explorer.folderClickMode).toBe('double');
  });

  it('has the correct default appearance settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.theme).toBe('dark');
    expect(settings.appearance.activeThemeId).toBe('operator');
    expect(settings.appearance.uiFontFamily).toBe('Inter, system-ui, sans-serif');
    expect(settings.appearance.useNativeOsIcons).toBe(false);
    expect(settings.appearance.animations).toBe(true);
    expect(settings.appearance.panelTransparency).toBe(0);
    expect(settings.appearance.appBlurStrength).toBe(18);
    expect(settings.appearance.appOpenAnimation).toBe('spring-lift');
    expect(settings.appearance.appCloseAnimation).toBe('burn');
    expect(settings.appearance.appAnimationDurationMs).toBe(320);
    expect(settings.appearance.appAnimationIntensity).toBe(1);
  });

  it('has the correct default layout settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.layout.activeProfileId).toBe(defaultSettings.layout.activeProfileId);
    expect(settings.layout.configPath).toBe('');
  });
});

describe('useSettingsStore.updateTerminal()', () => {
  it('updates a single terminal setting without touching others', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({ preferredOpenMode: 'external' });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.preferredOpenMode).toBe('external');
    expect(settings.terminal.fontSize).toBe(13);
    expect(settings.terminal.cursorBlink).toBe(true);
  });

  it('updates overlayHeight and overlayWidth independently', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({ overlayHeight: 600 });
    expect(useSettingsStore.getState().settings.terminal.overlayHeight).toBe(600);
    expect(useSettingsStore.getState().settings.terminal.overlayWidth).toBe(-1);

    store.updateTerminal({ overlayWidth: 1400 });
    expect(useSettingsStore.getState().settings.terminal.overlayWidth).toBe(1400);
  });

  it('updates overlayAnchor without disturbing the saved size', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({ overlayHeight: 600, overlayWidth: 1400, overlayAnchor: 'top' });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.overlayAnchor).toBe('top');
    expect(settings.terminal.overlayHeight).toBe(600);
    expect(settings.terminal.overlayWidth).toBe(1400);
  });

  it('updates external terminal fields together', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({
      preferredOpenMode: 'external',
      externalTerminalProfile: 'custom',
      externalTerminalCommand: 'wt.exe',
      externalTerminalArgs: '--focus',
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.preferredOpenMode).toBe('external');
    expect(settings.terminal.externalTerminalProfile).toBe('custom');
    expect(settings.terminal.externalTerminalCommand).toBe('wt.exe');
    expect(settings.terminal.externalTerminalArgs).toBe('--focus');
  });

  it('updates cursor settings', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({ cursorBlink: false, cursorStyle: 'block' });
    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.cursorBlink).toBe(false);
    expect(settings.terminal.cursorStyle).toBe('block');
  });
});

describe('useSettingsStore.updatePython()', () => {
  it('updates python runtime settings without mutating other sections', () => {
    const store = useSettingsStore.getState();
    const beforeTerminal = { ...store.settings.terminal };

    store.updatePython({
      preferredInterpreterPath: 'C:\\Python311\\python.exe',
      bootstrapPackages: 'numpy\nonnxruntime',
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.python.preferredInterpreterPath).toBe('C:\\Python311\\python.exe');
    expect(settings.python.bootstrapPackages).toBe('numpy\nonnxruntime');
    expect(settings.terminal).toEqual(beforeTerminal);
  });
});

describe('useSettingsStore.updateExplorer()', () => {
  it('toggles hidden files', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ showHiddenFiles: true });
    expect(useSettingsStore.getState().settings.explorer.showHiddenFiles).toBe(true);
  });

  it('updates viewMode', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ viewMode: 'grid' });
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('grid');
  });

  it('updates folderClickMode', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ folderClickMode: 'single' });
    expect(useSettingsStore.getState().settings.explorer.folderClickMode).toBe('single');
  });

  it('does not mutate other setting sections', () => {
    const store = useSettingsStore.getState();
    const beforeTerminal = { ...useSettingsStore.getState().settings.terminal };
    store.updateExplorer({ showHiddenFiles: true });
    expect(useSettingsStore.getState().settings.terminal).toEqual(beforeTerminal);
  });
});

describe('useSettingsStore.updateLayout()', () => {
  it('updates layout settings without mutating unrelated sections', () => {
    const store = useSettingsStore.getState();
    const beforeAppearance = { ...store.settings.appearance };

    store.updateLayout({
      activeProfileId: 'navigator-bottom',
      configPath: 'M:\\layouts\\snapyard.layouts.toml',
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.layout.activeProfileId).toBe('navigator-bottom');
    expect(settings.layout.configPath).toBe('M:\\layouts\\snapyard.layouts.toml');
    expect(settings.appearance).toEqual(beforeAppearance);
  });
});

describe('useSettingsStore.resetToDefaults()', () => {
  it('restores all settings to defaults after changes', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({ preferredOpenMode: 'external', fontSize: 16 });
    store.updateAppearance({ activeThemeId: 'dracula' });
    store.updateExplorer({ showHiddenFiles: true });
    store.resetToDefaults();

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.preferredOpenMode).toBe(defaultSettings.terminal.preferredOpenMode);
    expect(settings.terminal.fontSize).toBe(defaultSettings.terminal.fontSize);
    expect(settings.appearance.activeThemeId).toBe(defaultSettings.appearance.activeThemeId);
    expect(settings.explorer.showHiddenFiles).toBe(defaultSettings.explorer.showHiddenFiles);
  });
});

describe('useSettingsStore.updateAppearance()', () => {
  it('updates the native OS icon preference', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({ useNativeOsIcons: true });

    expect(useSettingsStore.getState().settings.appearance.useNativeOsIcons).toBe(true);
  });

  it('clamps visual tuning into the supported range', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({
      appOpacity: 8,
      panelTransparency: 4,
      appZoom: -3,
      appBlurStrength: 400,
    });

    const { appearance } = useSettingsStore.getState().settings;
    expect(appearance.appOpacity).toBe(1);
    expect(appearance.panelTransparency).toBe(1);
    expect(appearance.appZoom).toBe(0.7);
    expect(appearance.appBlurStrength).toBe(32);
  });
});

describe('useSettingsStore.importSettings()', () => {
  it('imports partial settings without losing unspecified sections', () => {
    const store = useSettingsStore.getState();
    store.importSettings({
      terminal: { ...defaultSettings.terminal, fontSize: 15 },
      appearance: { ...defaultSettings.appearance, activeThemeId: 'nord' },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.fontSize).toBe(15);
    expect(settings.appearance.activeThemeId).toBe('nord');
    expect(settings.explorer).toEqual(defaultSettings.explorer);
  });

  it('migrates legacy terminal theme and font fields on import', () => {
    const store = useSettingsStore.getState();
    store.importSettings({
      terminal: {
        ...defaultSettings.terminal,
        fontSize: 15,
        colorTheme: 'catppuccin',
        uiFont: 'Geist, Inter, system-ui, sans-serif',
      } as typeof defaultSettings.terminal & { colorTheme: string; uiFont: string },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.fontSize).toBe(15);
    expect(settings.appearance.activeThemeId).toBe('catppuccin');
    expect(settings.appearance.uiFontFamily).toBe('Geist, Inter, system-ui, sans-serif');
  });
});

describe('useSettingsStore.exportSettings()', () => {
  it('returns a deep copy of the current settings', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({ activeThemeId: 'catppuccin', appCloseAnimation: 'fizzle' });
    const exported = store.exportSettings();

    expect(exported.appearance.activeThemeId).toBe('catppuccin');
    expect(exported.appearance.appCloseAnimation).toBe('fizzle');
    expect(exported).toEqual(useSettingsStore.getState().settings);
  });
});

describe('mergeSettingsWithDefaults()', () => {
  it('fills in newly added sections for older persisted settings', () => {
    const merged = mergeSettingsWithDefaults({
      terminal: {
        ...defaultSettings.terminal,
        colorTheme: 'dracula',
        uiFont: 'Geist, Inter, system-ui, sans-serif',
      } as typeof defaultSettings.terminal & { colorTheme: string; uiFont: string },
      appearance: { appZoom: 1.1 } as typeof defaultSettings.appearance,
    });

    expect(merged.appearance.activeThemeId).toBe('dracula');
    expect(merged.appearance.uiFontFamily).toBe('Geist, Inter, system-ui, sans-serif');
    expect(merged.appearance.appZoom).toBe(1.1);
    expect(merged.appearance.useNativeOsIcons).toBe(defaultSettings.appearance.useNativeOsIcons);
    expect(merged.appearance.panelTransparency).toBe(defaultSettings.appearance.panelTransparency);
    expect(merged.appearance.appBlurStrength).toBe(defaultSettings.appearance.appBlurStrength);
    expect(merged.appearance.appOpenAnimation).toBe(defaultSettings.appearance.appOpenAnimation);
    expect(merged.appearance.appCloseAnimation).toBe(defaultSettings.appearance.appCloseAnimation);
    expect(merged.terminal.overlayAnchor).toBe(defaultSettings.terminal.overlayAnchor);
    expect(merged.screenshots).toEqual(defaultSettings.screenshots);
    expect(merged.layout).toEqual(defaultSettings.layout);
  });

  it('clamps imported animation tuning into a supported range', () => {
    const merged = mergeSettingsWithDefaults({
      appearance: {
        appAnimationDurationMs: 5000,
        appAnimationIntensity: 0.1,
      } as typeof defaultSettings.appearance,
    });

    expect(merged.appearance.appAnimationDurationMs).toBeLessThanOrEqual(1200);
    expect(merged.appearance.appAnimationIntensity).toBeGreaterThanOrEqual(0.55);
  });

  it('normalizes unsupported explorer folder click modes back to the default', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        folderClickMode: 'triple-click',
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.folderClickMode).toBe(defaultSettings.explorer.folderClickMode);
  });
});
