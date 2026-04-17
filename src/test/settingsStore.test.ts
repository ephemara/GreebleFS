/**
 * Settings store tests
 * Tests the Zustand store logic in isolation — no Tauri, no DOM.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, defaultSettings, mergeSettingsWithDefaults, resolveSystemPresentationState } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
import { overlayWindowGeometry } from '../config/overlayWindow';
import { defaultExplorerThumbnailSettings } from '../config/explorerThumbnails';

beforeEach(() => {
  useSettingsStore.getState().resetToDefaults();
  useExplorerStore.getState().resetSession();
});

describe('resolveSystemPresentationState()', () => {
  it('tracks tray/taskbar visibility and the recovery path', () => {
    expect(resolveSystemPresentationState(defaultSettings.system)).toEqual({
      trayVisible: true,
      taskbarVisible: true,
      hasVisibleEntryPoint: true,
      recoveryPath: 'tray',
    });

    expect(resolveSystemPresentationState({
      ...defaultSettings.system,
      hideAppInTray: false,
      showInTaskbar: true,
    })).toEqual({
      trayVisible: false,
      taskbarVisible: true,
      hasVisibleEntryPoint: true,
      recoveryPath: 'taskbar',
    });
  });
});

describe('useSettingsStore — initial state', () => {
  it('has the correct default terminal settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.showSidebar).toBe(true);
    expect(settings.terminal.cursorBlink).toBe(true);
    expect(settings.terminal.scrollback).toBe(10000);
    expect(settings.terminal.overlayHeight).toBe(overlayWindowGeometry.defaultHeight);
    expect(settings.terminal.overlayWidth).toBe(overlayWindowGeometry.defaultWidth);
    expect(settings.terminal.overlayAnchor).toBe('bottom');
    expect(settings.terminal.windowMode).toBe('windowed');
    expect(settings.terminal.windowedWidth).toBe(1440);
    expect(settings.terminal.windowedHeight).toBe(920);
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
    expect(settings.explorer.viewMode).toBe(defaultSettings.explorer.viewMode);
    expect(settings.explorer.gridZoom).toBe(defaultSettings.explorer.gridZoom);
    expect(settings.explorer.experimentalViewMode).toBe('off');
    expect(settings.explorer.experimentalDensity).toBe(defaultSettings.explorer.experimentalDensity);
    expect(settings.explorer.folderClickMode).toBe('double');
    expect(settings.explorer.thumbnails).toEqual(defaultExplorerThumbnailSettings);
    expect(settings.explorer.modeProfileOverridesByThemeId).toEqual({});
    expect(settings.explorer.chromeLayoutOverridesByThemeId).toEqual({});
  });

  it('has the correct default appearance settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.theme).toBe('dark');
    expect(settings.appearance.activeThemeId).toBe('pilot-dark');
    expect(settings.appearance.dockThemeMode).toBe('follow-app');
    expect(settings.appearance.activeDockThemeId).toBeNull();
    expect(settings.appearance.activeWallpaperId).toBeNull();
    expect(settings.appearance.wallpaperFitMode).toBe('cover');
    expect(settings.appearance.wallpaperOpacity).toBe(1);
    expect(settings.appearance.wallpaperMuted).toBe(true);
    expect(settings.appearance.activeShaderId).toBeNull();
    expect(settings.appearance.shaderControlValues).toEqual({});
    expect(settings.appearance.uiFontFamily).toBe('system-ui, sans-serif');
    expect(settings.appearance.useNativeOsIcons).toBe(false);
    expect(settings.appearance.animations).toBe(true);
    expect(settings.appearance.panelTransparency).toBe(0);
    expect(settings.appearance.appBlur).toBe(false);
    expect(settings.appearance.appBlurStrength).toBe(18);
    expect(settings.appearance.appOpenAnimation).toBeNull();
    expect(settings.appearance.appCloseAnimation).toBeNull();
    expect(settings.appearance.appAnimationDurationMs).toBe(320);
    expect(settings.appearance.appAnimationIntensity).toBe(1);
  });

  it('has the correct default layout settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.layout.activeProfileId).toBe(defaultSettings.layout.activeProfileId);
    expect(settings.layout.configPath).toBe('');
  });

  it('has safe default system visibility settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.system.launchAtStartup).toBe(false);
    expect(settings.system.hideAppInTray).toBe(true);
    expect(settings.system.showInTaskbar).toBe(true);
    expect(settings.system.devTelemetryHudVisible).toBe(true);
    expect(settings.system.linuxDisplayBackendPreference).toBe('auto');
  });

  it('has the correct default hotkey settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.keybindings.toggleDeveloperTelemetryHud).toBe('Ctrl+Alt+D');
    expect(settings.keybindings.terminalToggle).toBe('Ctrl+Space');
    expect(settings.keybindings.terminalFocus).toBe('Ctrl+J');
    expect(settings.keybindings.windowModeToggle).toBe('F11');
    expect(settings.keybindings.commandPalette).toBe('Ctrl+Shift+P');
  });

  it('has the correct default screenshot settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.screenshots.saveDirectory).toBe(defaultSettings.screenshots.saveDirectory);
    expect(settings.screenshots.defaultCaptureMode).toBe('region');
    expect(settings.screenshots.defaultOutputAction).toBe('save-copy');
    expect(settings.screenshots.showGrid).toBe(true);
    expect(settings.screenshots.closeEditorAfterAction).toBe(true);
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
    expect(useSettingsStore.getState().settings.terminal.overlayWidth).toBe(overlayWindowGeometry.defaultWidth);

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

  it('updates window mode without disturbing overlay sizing', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({
      windowMode: 'windowed',
      windowedWidth: 1680,
      windowedHeight: 980,
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.windowMode).toBe('windowed');
    expect(settings.terminal.windowedWidth).toBe(1680);
    expect(settings.terminal.windowedHeight).toBe(980);
    expect(settings.terminal.overlayHeight).toBe(overlayWindowGeometry.defaultHeight);
    expect(settings.terminal.overlayWidth).toBe(overlayWindowGeometry.defaultWidth);
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

  it('stores terminal sidebar visibility independently from other terminal settings', () => {
    const store = useSettingsStore.getState();
    store.updateTerminal({ showSidebar: false });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.showSidebar).toBe(false);
    expect(settings.terminal.fontSize).toBe(13);
    expect(settings.terminal.windowMode).toBe('windowed');
  });
});

describe('useSettingsStore.updatePython()', () => {
  it('updates python runtime settings without mutating other sections', () => {
    const store = useSettingsStore.getState();
    const beforeTerminal = { ...store.settings.terminal };

    store.updatePython({
      preferredInterpreterPath: 'C:\\Python311\\python.exe',
      bootstrapPackages: 'requests\nrich',
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.python.preferredInterpreterPath).toBe('C:\\Python311\\python.exe');
    expect(settings.python.bootstrapPackages).toBe('requests\nrich');
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
    store.updateExplorer({ viewMode: 'icons-l' });
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('icons-l');
    expect(useSettingsStore.getState().settings.explorer.gridZoom).toBe(defaultSettings.explorer.gridZoom);
  });

  it('preserves the first-class list view mode', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ viewMode: 'list' });
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('list');
  });

  it('stores custom grid zoom between icon presets', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ viewMode: 'icons-m', gridZoom: 0.18 });
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('icons-m');
    expect(useSettingsStore.getState().settings.explorer.gridZoom).toBe(0.18);
  });

  it('stores experimental explorer mode and density independently from normal view mode', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({
      experimentalViewMode: 'adaptive-semantic-grid',
      experimentalDensity: 0.6,
    });

    const { explorer } = useSettingsStore.getState().settings;
    expect(explorer.experimentalViewMode).toBe('adaptive-semantic-grid');
    expect(explorer.experimentalDensity).toBe(0.6);
    expect(explorer.viewMode).toBe(defaultSettings.explorer.viewMode);
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

  it('stores chrome layout overrides independently from explorer session state', () => {
    useExplorerStore.getState().updateSession({
      shellLayoutId: 'focus',
      sidebarWidth: 244,
      previewWidth: 420,
      sourcesVisible: false,
    });

    useSettingsStore.getState().setExplorerChromeLayoutOverride('operator', 'default', {
      entries: [
        {
          controlId: 'refresh',
          surfaceId: 'explorerToolbar',
          zone: 'primaryStart',
          order: 5,
        },
      ],
    });

    expect(useSettingsStore.getState().settings.explorer.chromeLayoutOverridesByThemeId.operator?.default?.entries).toEqual([
      {
        controlId: 'refresh',
        surfaceId: 'explorerToolbar',
        zone: 'primaryStart',
        order: 5,
      },
    ]);
    expect(useExplorerStore.getState().session.shellLayoutId).toBe('focus');
    expect(useExplorerStore.getState().session.sidebarWidth).toBe(244);
    expect(useExplorerStore.getState().session.previewWidth).toBe(420);
    expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
  });

  it('stores mode profile overrides independently from explorer session state', () => {
    useExplorerStore.getState().updateSession({
      shellLayoutId: 'focus',
      sidebarWidth: 244,
      previewWidth: 420,
      sourcesVisible: false,
    });

    useSettingsStore.getState().setExplorerModeProfileOverride('operator', 'inspector');

    expect(useSettingsStore.getState().settings.explorer.modeProfileOverridesByThemeId).toEqual({
      operator: 'inspector',
    });
    expect(useExplorerStore.getState().session.shellLayoutId).toBe('focus');
    expect(useExplorerStore.getState().session.sidebarWidth).toBe(244);
    expect(useExplorerStore.getState().session.previewWidth).toBe(420);
    expect(useExplorerStore.getState().session.sourcesVisible).toBe(false);
  });
});

describe('useSettingsStore.updateLayout()', () => {
  it('updates layout settings without mutating unrelated sections', () => {
    const store = useSettingsStore.getState();
    const beforeAppearance = { ...store.settings.appearance };

    store.updateLayout({
      activeProfileId: 'navigator-bottom',
      configPath: 'M:\\layouts\\greeble.layouts.toml',
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.layout.activeProfileId).toBe('navigator-bottom');
    expect(settings.layout.configPath).toBe('M:\\layouts\\greeble.layouts.toml');
    expect(settings.appearance).toEqual(beforeAppearance);
  });

  it('keeps explorer anchors intact when switching layout profiles', () => {
    useExplorerStore.getState().updateSession({
      currentPath: 'M:\\OverlayTerm\\src',
      history: ['M:\\OverlayTerm', 'M:\\OverlayTerm\\src'],
      historyIdx: 1,
    });

    const beforeSession = { ...useExplorerStore.getState().session, history: [...useExplorerStore.getState().session.history] };
    useSettingsStore.getState().updateLayout({ activeProfileId: 'navigator-bottom' });

    const { session } = useExplorerStore.getState();
    expect(session.currentPath).toBe(beforeSession.currentPath);
    expect(session.history).toEqual(beforeSession.history);
    expect(session.historyIdx).toBe(beforeSession.historyIdx);
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

  it('restores the system entry points to the safe defaults when recovering from corrupted state', () => {
    const store = useSettingsStore.getState();

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          launchAtStartup: true,
          hideAppInTray: false,
          showInTaskbar: false,
        },
      },
    }));

    store.resetToDefaults();

    const { settings } = useSettingsStore.getState();
    expect(settings.system).toEqual(defaultSettings.system);
  });
});

describe('useSettingsStore.updateSystem()', () => {
  it('keeps at least one desktop entry point enabled', () => {
    const store = useSettingsStore.getState();

    store.updateSystem({ hideAppInTray: false, showInTaskbar: true });
    expect(useSettingsStore.getState().settings.system.hideAppInTray).toBe(false);
    expect(useSettingsStore.getState().settings.system.showInTaskbar).toBe(true);

    store.updateSystem({ showInTaskbar: false });
    expect(useSettingsStore.getState().settings.system.hideAppInTray).toBe(true);
    expect(useSettingsStore.getState().settings.system.showInTaskbar).toBe(false);
  });

  it('stores a normalized Linux display backend preference', () => {
    const store = useSettingsStore.getState();

    store.updateSystem({ linuxDisplayBackendPreference: 'x11' });
    expect(useSettingsStore.getState().settings.system.linuxDisplayBackendPreference).toBe('x11');

    store.updateSystem({ linuxDisplayBackendPreference: 'invalid' as never });
    expect(useSettingsStore.getState().settings.system.linuxDisplayBackendPreference).toBe('auto');
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

  it('stores shader control overrides without mutating other appearance fields', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({
      shaderControlValues: {
        'aurora-ribbon': {
          intensity: 0.72,
        },
      },
    });

    const { appearance } = useSettingsStore.getState().settings;
    expect(appearance.shaderControlValues['aurora-ribbon']?.intensity).toBe(0.72);
    expect(appearance.activeThemeId).toBe(defaultSettings.appearance.activeThemeId);
  });

  it('stores dock theme selection independently from the application theme', () => {
    const store = useSettingsStore.getState();
    store.applyDockThemeSelection('dock-burnished');

    const { appearance } = useSettingsStore.getState().settings;
    expect(appearance.activeThemeId).toBe(defaultSettings.appearance.activeThemeId);
    expect(appearance.dockThemeMode).toBe('override');
    expect(appearance.activeDockThemeId).toBe('dock-burnished');
  });

  it('allows clearing motion overrides back to theme-managed defaults', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({
      appOpenAnimation: 'spring-lift',
      appCloseAnimation: 'burn',
    });
    store.updateAppearance({
      appOpenAnimation: null,
      appCloseAnimation: null,
    });

    const { appearance } = useSettingsStore.getState().settings;
    expect(appearance.appOpenAnimation).toBeNull();
    expect(appearance.appCloseAnimation).toBeNull();
  });
});

describe('useSettingsStore.applyThemeSelection()', () => {
  it('applies pilot theme defaults across appearance and layout without mutating explorer session state', () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        explorer: {
          ...state.settings.explorer,
          showHiddenFiles: true,
          viewMode: 'icons-l',
          experimentalViewMode: 'adaptive-semantic-grid',
          experimentalDensity: 0.64,
          folderClickMode: 'single',
        },
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
          dockThemeMode: 'override',
          activeDockThemeId: 'dock-burnished',
          activeWallpaperId: 'wallpaper-lab',
          activeShaderId: 'nebula-flow',
          uiFontFamily: 'Geist, Inter, system-ui, sans-serif',
          useNativeOsIcons: true,
          panelTransparency: 0.48,
          appZoom: 1.16,
          appBlur: true,
          appOpenAnimation: 'spring-lift',
          appCloseAnimation: 'burn',
        },
        layout: {
          ...state.settings.layout,
          activeProfileId: 'navigator-bottom',
        },
      },
    }));
    useExplorerStore.getState().updateSession({
      currentPath: '/workspace',
      history: ['/workspace'],
      historyIdx: 0,
      shellLayoutId: 'focus',
      sidebarWidth: 244,
      previewWidth: 420,
      previewEnabled: false,
      sourcesVisible: false,
    });

    useSettingsStore.getState().applyThemeSelection('pilot-light');

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.activeThemeId).toBe('pilot-light');
    expect(settings.appearance.theme).toBe('light');
    expect(settings.appearance.dockThemeMode).toBe('follow-app');
    expect(settings.appearance.activeDockThemeId).toBeNull();
    expect(settings.appearance.activeWallpaperId).toBeNull();
    expect(settings.appearance.activeShaderId).toBeNull();
    expect(settings.appearance.uiFontFamily).toBe(defaultSettings.appearance.uiFontFamily);
    expect(settings.appearance.useNativeOsIcons).toBe(false);
    expect(settings.appearance.panelTransparency).toBe(0);
    expect(settings.appearance.appZoom).toBe(1);
    expect(settings.appearance.appBlur).toBe(false);
    expect(settings.appearance.appOpenAnimation).toBeNull();
    expect(settings.appearance.appCloseAnimation).toBeNull();
    expect(settings.explorer.showHiddenFiles).toBe(false);
    expect(settings.explorer.viewMode).toBe('details');
    expect(settings.explorer.experimentalViewMode).toBe('off');
    expect(settings.explorer.experimentalDensity).toBe(defaultSettings.explorer.experimentalDensity);
    expect(settings.explorer.folderClickMode).toBe('double');
    expect(settings.layout.activeProfileId).toBe(defaultSettings.layout.activeProfileId);

    const { session } = useExplorerStore.getState();
    expect(session.currentPath).toBe('/workspace');
    expect(session.history).toEqual(['/workspace']);
    expect(session.historyIdx).toBe(0);
    expect(session.shellLayoutId).toBe('focus');
    expect(session.sidebarWidth).toBe(244);
    expect(session.previewWidth).toBe(420);
    expect(session.previewEnabled).toBe(false);
    expect(session.sourcesVisible).toBe(false);
  });

  it('clears theme-managed overrides for package themes without resetting pilot layout state', () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        explorer: {
          ...state.settings.explorer,
          showHiddenFiles: true,
          viewMode: 'icons-l',
        },
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
          activeShaderId: 'nebula-flow',
          appOpenAnimation: 'spring-lift',
          appCloseAnimation: 'burn',
          useNativeOsIcons: true,
        },
        layout: {
          ...state.settings.layout,
          activeProfileId: 'navigator-bottom',
        },
      },
    }));
    useExplorerStore.getState().updateSession({
      currentPath: '/workspace',
      history: ['/workspace'],
      historyIdx: 0,
      shellLayoutId: 'focus',
      sidebarWidth: 244,
      previewWidth: 420,
      previewEnabled: false,
      sourcesVisible: false,
    });

    useSettingsStore.getState().applyThemeSelection('vista-glass', { forceManagedIcons: true });

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.activeThemeId).toBe('vista-glass');
    expect(settings.appearance.activeShaderId).toBeNull();
    expect(settings.appearance.appOpenAnimation).toBeNull();
    expect(settings.appearance.appCloseAnimation).toBeNull();
    expect(settings.appearance.useNativeOsIcons).toBe(false);
    expect(settings.explorer.showHiddenFiles).toBe(true);
    expect(settings.explorer.viewMode).toBe('icons-l');
    expect(settings.layout.activeProfileId).toBe('navigator-bottom');

    const { session } = useExplorerStore.getState();
    expect(session.currentPath).toBe('/workspace');
    expect(session.history).toEqual(['/workspace']);
    expect(session.historyIdx).toBe(0);
    expect(session.shellLayoutId).toBe('focus');
    expect(session.sidebarWidth).toBe(244);
    expect(session.previewWidth).toBe(420);
    expect(session.previewEnabled).toBe(false);
    expect(session.sourcesVisible).toBe(false);
  });
});

describe('useSettingsStore.updateScreenshots()', () => {
  it('normalizes invalid screenshot preference updates and preserves valid toggles', () => {
    const store = useSettingsStore.getState();
    store.updateScreenshots({
      defaultCaptureMode: 'monitor',
      defaultOutputAction: 'copy',
      showGrid: false,
      closeEditorAfterAction: false,
    });

    store.updateScreenshots({
      defaultCaptureMode: 'bad-mode' as never,
      defaultOutputAction: 'bad-action' as never,
      saveDirectory: '   ',
    });

    const { screenshots } = useSettingsStore.getState().settings;
    expect(screenshots.defaultCaptureMode).toBe('monitor');
    expect(screenshots.defaultOutputAction).toBe('copy');
    expect(screenshots.showGrid).toBe(false);
    expect(screenshots.closeEditorAfterAction).toBe(false);
    expect(screenshots.saveDirectory).toBe(defaultSettings.screenshots.saveDirectory);
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
    expect(settings.appearance.dockThemeMode).toBe(defaultSettings.appearance.dockThemeMode);
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
    store.updateAppearance({
      activeThemeId: 'catppuccin',
      dockThemeMode: 'override',
      activeDockThemeId: 'dock-burnished',
      appCloseAnimation: 'fizzle',
    });
    const exported = store.exportSettings();

    expect(exported.appearance.activeThemeId).toBe('catppuccin');
    expect(exported.appearance.dockThemeMode).toBe('override');
    expect(exported.appearance.activeDockThemeId).toBe('dock-burnished');
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
    expect(merged.appearance.dockThemeMode).toBe(defaultSettings.appearance.dockThemeMode);
    expect(merged.appearance.activeDockThemeId).toBe(defaultSettings.appearance.activeDockThemeId);
    expect(merged.appearance.activeShaderId).toBeNull();
    expect(merged.appearance.uiFontFamily).toBe('Geist, Inter, system-ui, sans-serif');
    expect(merged.appearance.appZoom).toBe(1.1);
    expect(merged.appearance.useNativeOsIcons).toBe(defaultSettings.appearance.useNativeOsIcons);
    expect(merged.appearance.panelTransparency).toBe(defaultSettings.appearance.panelTransparency);
    expect(merged.appearance.appBlurStrength).toBe(defaultSettings.appearance.appBlurStrength);
    expect(merged.appearance.appOpenAnimation).toBe(defaultSettings.appearance.appOpenAnimation);
    expect(merged.appearance.appCloseAnimation).toBe(defaultSettings.appearance.appCloseAnimation);
    expect(merged.terminal.overlayAnchor).toBe(defaultSettings.terminal.overlayAnchor);
    expect(merged.terminal.windowMode).toBe(defaultSettings.terminal.windowMode);
    expect(merged.terminal.windowedWidth).toBe(defaultSettings.terminal.windowedWidth);
    expect(merged.terminal.windowedHeight).toBe(defaultSettings.terminal.windowedHeight);
    expect(merged.system.hideAppInTray).toBe(defaultSettings.system.hideAppInTray);
    expect(merged.system.showInTaskbar).toBe(defaultSettings.system.showInTaskbar);
    expect(merged.screenshots).toEqual(defaultSettings.screenshots);
    expect(merged.layout).toEqual(defaultSettings.layout);
    expect(merged.explorer.contextMenuItemOverrides).toEqual(defaultSettings.explorer.contextMenuItemOverrides);
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

  it('normalizes blank motion overrides to theme-following null values', () => {
    const merged = mergeSettingsWithDefaults({
      appearance: {
        appOpenAnimation: '   ' as never,
        appCloseAnimation: '' as never,
      } as unknown as typeof defaultSettings.appearance,
    });

    expect(merged.appearance.appOpenAnimation).toBeNull();
    expect(merged.appearance.appCloseAnimation).toBeNull();
  });

  it('normalizes unsupported explorer folder click modes back to the default', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        folderClickMode: 'triple-click',
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.folderClickMode).toBe(defaultSettings.explorer.folderClickMode);
  });

  it('maps legacy explorer grid mode and preserves persisted row layout presets', () => {
    const mergedGrid = mergeSettingsWithDefaults({
      explorer: {
        viewMode: 'grid',
      } as unknown as typeof defaultSettings.explorer,
    });
    const mergedList = mergeSettingsWithDefaults({
      explorer: {
        viewMode: 'list',
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(mergedGrid.explorer.viewMode).toBe('icons-l');
    expect(mergedGrid.explorer.gridZoom).toBe(defaultSettings.explorer.gridZoom);
    expect(mergedList.explorer.viewMode).toBe('list');
  });

  it('fills in new experimental explorer fields for older persisted settings', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        viewMode: 'icons-l',
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.experimentalViewMode).toBe('off');
    expect(merged.explorer.experimentalDensity).toBe(defaultSettings.explorer.experimentalDensity);
  });

  it('normalizes explorer thumbnail settings when importing older explorer payloads', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        thumbnails: {
          enabled: false,
          includeImages: false,
          includeCode: false,
          includeShaders: false,
          includeAudio: false,
          includeVideo: false,
          enableVideoHoverScrub: false,
          videoHoverScrubFrameCount: 99,
        },
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.thumbnails).toEqual({
      enabled: false,
      includeImages: false,
      includeCode: false,
      includeShaders: false,
      includeAudio: false,
      includeVideo: false,
      enableVideoHoverScrub: false,
      videoHoverScrubFrameCount: 10,
    });
  });

  it('normalizes malformed context menu overrides into a safe sortable map', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        contextMenuItemOverrides: {
          'built-in.open': { enabled: false, order: 27.6 },
          '': { enabled: true },
          'broken-shape': 'nope',
          'plugin.action': { enabled: 'yes', order: Number.NaN },
        },
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.contextMenuItemOverrides).toEqual({
      'built-in.open': { enabled: false, order: 28 },
    });
  });

  it('normalizes unsupported window presentation values back to safe defaults', () => {
    const merged = mergeSettingsWithDefaults({
      terminal: {
        windowMode: 'panel-godmode',
        windowedWidth: 160,
        windowedHeight: 140,
      } as unknown as typeof defaultSettings.terminal,
    });

    expect(merged.terminal.windowMode).toBe(defaultSettings.terminal.windowMode);
    expect(merged.terminal.windowedWidth).toBeGreaterThanOrEqual(720);
    expect(merged.terminal.windowedHeight).toBeGreaterThanOrEqual(480);
  });
});
