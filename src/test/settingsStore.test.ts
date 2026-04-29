/**
 * Settings store tests
 * Tests the Zustand store logic in isolation — no Tauri, no DOM.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, defaultSettings, mergeSettingsWithDefaults, resolveSystemPresentationState } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
import { defaultMobileLayoutSettings } from '../config/mobileLayout';
import { overlayWindowGeometry } from '../config/overlayWindow';
import { defaultExplorerThumbnailSettings } from '../config/explorerThumbnails';
import {
  createDefaultIdeWorkbenchLayoutState,
  type WorkbenchSurfaceLayoutSeed,
} from '../config/ideWorkbenchLayout';
import { semanticIndexingCapabilityId } from '../config/localModels';
import { DEFAULT_EXPLORER_MENU_PACK_ID } from '../config/menuPacks';
import { EXPLORER_CANONICAL_LAYOUT_ID } from '../config/explorerLayouts';
import {
  inferIntegratedTerminalProfileFromShell,
  normalizeIntegratedTerminalProfile,
  resolveIntegratedTerminalShellCommand,
} from '../config/platform';

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
  it('defaults to the built-in settings rail path', () => {
    const storeState = useSettingsStore.getState();
    expect(storeState.activeRailPath).toBe('settings');
    expect(storeState.activePluginSettingsSlotId).toBeNull();
  });

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
    expect(settings.terminal.shell).toBe(defaultSettings.terminal.shell);
    expect(settings.terminal.shellProfile).toBe(defaultSettings.terminal.shellProfile);
    expect(settings.terminal.shellPath).toBe(defaultSettings.terminal.shellPath);
    expect(settings.terminal.shellArgs).toBe(defaultSettings.terminal.shellArgs);
    expect(settings.terminal.preferredOpenMode).toBe('integrated');
    expect(settings.terminal.externalTerminalProfile).toBe('auto');
    expect(settings.terminal.integratedHost).toBe(defaultSettings.terminal.integratedHost);
  });

  it('has the correct default python settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.python.preferredInterpreterPath).toBe('');
    expect(settings.python.runtimeRoot).toBe('');
    expect(settings.python.bootstrapPackages).toBe('');
    expect(settings.python.autoUpgradePip).toBe(true);
    expect(settings.python.createBoilerplate).toBe(true);
  });

  it('has the correct default local model settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.models.capabilityBindings[semanticIndexingCapabilityId]).toEqual({
      modelId: 'semantic-minilm-l6-v2',
      backendPreference: 'auto',
    });
    expect(settings.models.semanticIndexRootOverrides).toEqual({});
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
    expect(settings.explorer.doubleClickEmptyToGoBack).toBe(false);
    expect(settings.explorer.thumbnails).toEqual(defaultExplorerThumbnailSettings);
    expect(settings.explorer.collectionPreviewMode).toBe('list');
    expect(settings.explorer.modeProfileOverridesByThemeId).toEqual({});
    expect(settings.explorer.chromeLayoutOverridesByThemeId).toEqual({});
    expect(settings.explorer.followThemeExplorerLayout).toBe(true);
    expect(settings.explorer.activeExplorerLayoutId).toBeNull();
    expect(settings.explorer.activeMenuPackId).toBe(DEFAULT_EXPLORER_MENU_PACK_ID);
    expect(settings.explorer.contextMenuLayoutOverridesByContext).toEqual({});
    expect(settings.explorer.preferredWorkbenchByExtension).toEqual({});
  });

  it('has the correct default appearance settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.theme).toBe('dark');
    expect(settings.appearance.activeThemeId).toBe('pilot-dark');
    expect(settings.appearance.dockThemeMode).toBe('follow-app');
    expect(settings.appearance.activeDockThemeId).toBeNull();
    expect(settings.appearance.activeIconThemeId).toBeNull();
    expect(settings.appearance.activeWallpaperId).toBeNull();
    expect(settings.appearance.wallpaperFitMode).toBe('cover');
    expect(settings.appearance.wallpaperOpacity).toBe(1);
    expect(settings.appearance.wallpaperMuted).toBe(true);
    expect(settings.appearance.activeShaderId).toBeNull();
    expect(settings.appearance.shaderPerformanceMode).toBe('performance');
    expect(settings.appearance.shaderControlValues).toEqual({});
    expect(settings.appearance.uiFontFamily).toBe('system-ui, sans-serif');
    expect(settings.appearance.useNativeOsIcons).toBe(false);
    expect(settings.appearance.animations).toBe(false);
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
    expect(settings.layout.zenFocusMode).toBe(false);
  });

  it('has safe default system visibility settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.system.launchAtStartup).toBe(false);
    expect(settings.system.startMobileShareOnBoot).toBe(false);
    expect(settings.system.hideAppInTray).toBe(true);
    expect(settings.system.showInTaskbar).toBe(true);
    expect(settings.system.gpuTierMode).toBe('auto');
    expect(settings.system.developerTestSettingsEnabled).toBe(false);
    expect(settings.system.devTelemetryHudVisible).toBe(true);
    expect(settings.system.sourceTraceModeEnabled).toBe(false);
    expect(settings.system.developerTelemetryEnabled).toBe(false);
    expect(settings.system.developerTelemetryCaptureMode).toBe('raw');
    expect(settings.system.developerTelemetryWriteToFile).toBe(true);
    expect(settings.system.developerTelemetryShowInspector).toBe(true);
    expect(settings.system.developerTelemetryPayloadMode).toBe('metadata+small-payloads');
    expect(settings.system.developerTelemetryMaxFileSizeMb).toBe(64);
    expect(settings.system.consumerDiagnosticsEnabled).toBe(false);
    expect(settings.system.consumerDiagnosticsIncludePluginRuntime).toBe(true);
    expect(settings.system.consumerDiagnosticsIncludeRendererRuntime).toBe(true);
    expect(settings.system.consumerDiagnosticsIncludePerfSamples).toBe(true);
    expect(settings.system.linuxDisplayBackendPreference).toBe('auto');
  });

  it('has the correct default hotkey settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.keybindings.toggleDeveloperTelemetryHud).toBe('Ctrl+Alt+D');
    expect(settings.keybindings.terminalToggle).toBe('Ctrl+Space');
    expect(settings.keybindings.terminalFocus).toBe('Ctrl+J');
    expect(settings.keybindings.windowModeToggle).toBe('F11');
    expect(settings.keybindings.zenFocusModeToggle).toBe('Ctrl+Alt+Z');
    expect(settings.keybindings.commandPalette).toBe('Ctrl+Shift+P');
    expect(settings.keybindings.mobileShareToggle).toBe('Ctrl+Alt+Shift+M');
    expect(settings.keybindings.explorerMoveSelectionUp).toBe('ArrowUp');
    expect(settings.keybindings.explorerMoveSelectionDown).toBe('ArrowDown');
    expect(settings.keybindings.explorerMoveSelectionLeft).toBe('ArrowLeft');
    expect(settings.keybindings.explorerMoveSelectionRight).toBe('ArrowRight');
    expect(settings.keybindings.toggleExplorerSources).toBe('Ctrl+B');
    expect(settings.keybindings.toggleExplorerCustomize).toBe('Ctrl+Alt+C');
    expect(settings.keybindings.openExplorerLayoutSwitcher).toBe('Ctrl+Alt+E');
    expect(settings.keybindings.cycleCollectionPreviewMode).toBe('Ctrl+Alt+V');
    expect(settings.keybindings.cycleCollectionPreviewModeReverse).toBe('Ctrl+Alt+Shift+V');
    expect(settings.keybindings.copySelection).toBe('Ctrl+C');
    expect(settings.keybindings.cutSelection).toBe('Ctrl+X');
    expect(settings.keybindings.pasteSelection).toBe('Ctrl+V');
    expect(settings.keybindings.togglePreviewLock).toBe('Ctrl+Alt+P');
    expect(settings.keybindings.togglePreviewTerminal).toBe('Ctrl+Alt+T');
    expect(settings.keybindings.pdfWorkbenchPreviousPage).toBe('PageUp');
    expect(settings.keybindings.pdfWorkbenchNextPage).toBe('PageDown');
    expect(settings.keybindings.pdfWorkbenchZoomIn).toBe('Ctrl+=');
    expect(settings.keybindings.pdfWorkbenchZoomOut).toBe('Ctrl+-');
    expect(settings.keybindings.pdfWorkbenchToggleEditMode).toBe('E');
    expect(settings.keybindings.shaderWorkbenchToggleEditMode).toBe('E');
    expect(settings.keybindings.shaderWorkbenchToggleScene).toBe('F');
    expect(settings.keybindings.spreadsheetWorkbenchToggleEditMode).toBe('E');
    expect(settings.keybindings.spreadsheetWorkbenchPreviousSheet).toBe('Ctrl+PageUp');
    expect(settings.keybindings.spreadsheetWorkbenchNextSheet).toBe('Ctrl+PageDown');
    expect(settings.keybindings.spreadsheetWorkbenchNewSheet).toBe('Shift+F11');
    expect(settings.keybindings.spreadsheetWorkbenchFocusFormulaBar).toBe('F2');
    expect(settings.keybindings.audioWorkbenchPlayPause).toBe('Space');
    expect(settings.keybindings.audioWorkbenchToggleEditMode).toBe('E');
    expect(settings.keybindings.audioWorkbenchJumpToSelectionStart).toBe('I');
    expect(settings.keybindings.audioWorkbenchJumpToSelectionEnd).toBe('O');
    expect(settings.keybindings.audioWorkbenchPreviousSilence).toBe('Shift+ArrowLeft');
    expect(settings.keybindings.audioWorkbenchNextSilence).toBe('Shift+ArrowRight');
    expect(settings.keybindings.audioWorkbenchExportClip).toBe('Ctrl+Shift+S');
    expect(settings.keybindings.pythonWorkbenchRunManaged).toBe('F9');
    expect(settings.keybindings.pythonWorkbenchRunInTerminal).toBe('Ctrl+F9');
    expect(settings.keybindings.imageCutoutCopy).toBe('Ctrl+C');
    expect(settings.keybindings.imageCutoutDeselect).toBe('Ctrl+D');
    expect(settings.keybindings.imageEditorUndo).toBe('Ctrl+Z');
    expect(settings.keybindings.imageEditorRedo).toBe('Ctrl+Shift+Z');
    expect(settings.keybindings.imageEditorReset).toBe('Escape');
    expect(settings.keybindings.commandBindingsById).toEqual({});
  });

  it('has the correct default screenshot settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.screenshots.saveDirectory).toBe(defaultSettings.screenshots.saveDirectory);
    expect(settings.screenshots.defaultCaptureMode).toBe('region');
    expect(settings.screenshots.defaultOutputAction).toBe('save-copy');
    expect(settings.screenshots.showGrid).toBe(true);
    expect(settings.screenshots.closeEditorAfterAction).toBe(true);
  });

  it('has the correct default audio settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.audio.activeSoundPackId).toBeNull();
    expect(settings.audio.soundEffectsEnabled).toBe(true);
    expect(settings.audio.soundEffectsVolume).toBe(0.72);
    expect(settings.audio.buttonSoundsEnabled).toBe(true);
    expect(settings.audio.navigationSoundsEnabled).toBe(true);
    expect(settings.audio.taskSoundsEnabled).toBe(true);
    expect(settings.audio.notificationSoundsEnabled).toBe(true);
    expect(settings.audio.nativeNotificationsEnabled).toBe(true);
    expect(settings.audio.nativeTaskSuccessNotificationsEnabled).toBe(true);
    expect(settings.audio.nativeTaskFailureNotificationsEnabled).toBe(true);
    expect(settings.audio.vst3AdditionalFolders).toEqual([]);
  });

  it('has safe default mobile access settings', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.mobile.remoteAccessMode).toBe('lan');
    expect(settings.mobile.tailscaleLoginServer).toBe('');
    expect(settings.mobile.tailscaleHostname).toBe('');
    expect(settings.mobile.layout).toEqual(defaultMobileLayoutSettings);
  });

  it('starts with an empty plugin settings catalog', () => {
    const { settings } = useSettingsStore.getState();
    expect(settings.plugins.valuesByPluginId).toEqual({});
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

  it('updates integrated shell profile fields and keeps the resolved shell string in sync', () => {
    const store = useSettingsStore.getState();
    const shellPath = String.raw`C:\Program Files\PowerShell\7\pwsh.exe`;
    const shellArgs = '-NoLogo -NoProfile';
    const normalizedProfile = normalizeIntegratedTerminalProfile('pwsh');
    store.updateTerminal({
      shellProfile: 'pwsh',
      shellPath,
      shellArgs,
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.terminal.shellProfile).toBe(normalizedProfile);
    expect(settings.terminal.shellPath).toBe(shellPath);
    expect(settings.terminal.shellArgs).toBe(shellArgs);
    expect(settings.terminal.shell).toBe(resolveIntegratedTerminalShellCommand({
      profile: normalizedProfile,
      shellPath,
      shellArgs,
    }));
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

describe('useSettingsStore.setCommandKeybinding()', () => {
  it('stores normalized explorer command hotkeys and clears them when blanked', () => {
    const store = useSettingsStore.getState();

    store.setCommandKeybinding(
      ' explorer-control:refresh ',
      ' Ctrl + Shift + R ',
    );

    expect(
      useSettingsStore.getState().settings.keybindings.commandBindingsById,
    ).toEqual({
      'explorer-control:refresh': 'Ctrl+Shift+R',
    });

    store.setCommandKeybinding('explorer-control:refresh', '   ');

    expect(
      useSettingsStore.getState().settings.keybindings.commandBindingsById,
    ).toEqual({});
  });

  it('ignores empty command ids', () => {
    const store = useSettingsStore.getState();

    store.setCommandKeybinding('   ', 'Ctrl+Alt+K');

    expect(
      useSettingsStore.getState().settings.keybindings.commandBindingsById,
    ).toEqual({});
  });
});

describe('useSettingsStore.updateMobile()', () => {
  it('updates the mobile remote-access mode and trims tailscale fields', () => {
    const store = useSettingsStore.getState();
    store.updateMobile({
      remoteAccessMode: 'tailscale',
      tailscaleLoginServer: ' https://headscale.example.com ',
      tailscaleHostname: ' greeble-rig ',
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.mobile.remoteAccessMode).toBe('tailscale');
    expect(settings.mobile.tailscaleLoginServer).toBe('https://headscale.example.com');
    expect(settings.mobile.tailscaleHostname).toBe('greeble-rig');
  });

  it('normalizes the mobile layout subtree without disturbing the route settings', () => {
    const store = useSettingsStore.getState();
    store.updateMobile({
      layout: {
        ...store.settings.mobile.layout,
        viewMode: 'list',
        gridZoom: 9,
        interfaceScale: 1.9,
        chromeScale: 0.4,
        pagePadding: 99,
        touchComfort: 'compact',
        showHiddenFiles: true,
        sortBy: 'size',
        sortOrder: 'desc',
        directoriesFirst: false,
        showTabLabels: false,
      },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.mobile.remoteAccessMode).toBe('lan');
    expect(settings.mobile.layout.viewMode).toBe('list');
    expect(settings.mobile.layout.gridZoom).toBe(2.6);
    expect(settings.mobile.layout.interfaceScale).toBe(1.6);
    expect(settings.mobile.layout.chromeScale).toBe(0.85);
    expect(settings.mobile.layout.pagePadding).toBe(32);
    expect(settings.mobile.layout.touchComfort).toBe('compact');
    expect(settings.mobile.layout.showHiddenFiles).toBe(true);
    expect(settings.mobile.layout.sortBy).toBe('size');
    expect(settings.mobile.layout.sortOrder).toBe('desc');
    expect(settings.mobile.layout.directoriesFirst).toBe(false);
    expect(settings.mobile.layout.showTabLabels).toBe(false);
  });
});

describe('mergeSettingsWithDefaults()', () => {
  it('normalizes invalid gpu tier imports back to auto', () => {
    const merged = mergeSettingsWithDefaults({
      system: {
        gpuTierMode: 'warp-speed' as never,
      } as unknown as typeof defaultSettings.system,
    });

    expect(merged.system.gpuTierMode).toBe('auto');
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

  it('persists oversized grid zoom above the legacy icons-xl ceiling', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ viewMode: 'icons-xl', gridZoom: 2.4 });
    expect(useSettingsStore.getState().settings.explorer.viewMode).toBe('icons-xl');
    expect(useSettingsStore.getState().settings.explorer.gridZoom).toBe(2.4);
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

  it('updates and normalizes the shared collection preview mode', () => {
    const store = useSettingsStore.getState();
    store.updateExplorer({ collectionPreviewMode: 'orbit' });
    expect(useSettingsStore.getState().settings.explorer.collectionPreviewMode).toBe('orbit');

    store.updateExplorer({ collectionPreviewMode: 'bogus' as never });
    expect(useSettingsStore.getState().settings.explorer.collectionPreviewMode).toBe('list');
  });

  it('stores preferred workbenches by normalized extension', () => {
    const store = useSettingsStore.getState();

    store.setPreferredWorkbenchForExtension(' .TXT ', ' mock-plugin.preview-lane.notes ');

    expect(useSettingsStore.getState().settings.explorer.preferredWorkbenchByExtension).toEqual({
      txt: 'mock-plugin.preview-lane.notes',
    });
  });

  it('clears preferred workbenches by normalized extension', () => {
    const store = useSettingsStore.getState();

    store.setPreferredWorkbenchForExtension('txt', 'mock-plugin.preview-lane.notes');
    store.clearPreferredWorkbenchForExtension('.TXT');

    expect(useSettingsStore.getState().settings.explorer.preferredWorkbenchByExtension).toEqual({});
  });

  it('normalizes imported preferred workbench maps and drops invalid entries', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        ...defaultSettings.explorer,
        preferredWorkbenchByExtension: {
          ' .MD ': ' markdown-workbench ',
          '': 'ignored',
          png: '',
        },
      },
    });

    expect(merged.explorer.preferredWorkbenchByExtension).toEqual({
      md: 'markdown-workbench',
    });
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
        hidden: false,
        sizeVariant: undefined,
        widthPx: undefined,
        showLabel: undefined,
        showIcon: undefined,
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

  it('pins the active explorer layout independently from legacy chrome overrides', () => {
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

    useSettingsStore.getState().setFollowThemeExplorerLayout(false);
    useSettingsStore.getState().setActiveExplorerLayoutId('user:focus-wide');

    const { explorer } = useSettingsStore.getState().settings;
    expect(explorer.followThemeExplorerLayout).toBe(false);
    expect(explorer.activeExplorerLayoutId).toBe('user:focus-wide');
    expect(explorer.chromeLayoutOverridesByThemeId.operator?.default?.entries).toHaveLength(1);
  });

  it('restores the canonical explorer layout without mutating explorer session geometry', () => {
    useExplorerStore.getState().updateSession({
      shellLayoutId: 'focus',
      sidebarWidth: 312,
      previewWidth: 488,
    });

    useSettingsStore.getState().setFollowThemeExplorerLayout(false);
    useSettingsStore.getState().setActiveExplorerLayoutId('user:focus-wide');
    useSettingsStore.getState().restoreCanonicalExplorerLayout();

    const { explorer } = useSettingsStore.getState().settings;
    expect(explorer.followThemeExplorerLayout).toBe(false);
    expect(explorer.activeExplorerLayoutId).toBe(EXPLORER_CANONICAL_LAYOUT_ID);
    expect(useExplorerStore.getState().session.shellLayoutId).toBe('focus');
    expect(useExplorerStore.getState().session.sidebarWidth).toBe(312);
    expect(useExplorerStore.getState().session.previewWidth).toBe(488);
  });

  it('resets layout customization to canonical without changing theme identity', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({
      activeThemeId: 'operator-dark',
      activeIconThemeId: 'lucide-stroke',
      activeWallpaperId: 'wallpaper:studio',
      activeTopBarId: 'classic-topbar',
      layoutDynamicsEnabled: false,
      layoutDynamicsPresetId: 'heavy-orbit',
      layoutDynamicsIntensity: 1.75,
      layoutDynamicsSurfaceOverrides: {
        explorerTopbar: {
          enabled: false,
          presetId: 'soft-snap',
          intensityMultiplier: 0.5,
        },
      },
      topBarLayoutSnapshotsById: {
        'classic-topbar': {
          entries: [
            {
              nodeId: 'search',
              bandId: 'primary',
              x: 42,
              y: 8,
            },
          ],
        },
      },
    });
    store.setExplorerChromeLayoutOverride('operator-dark', 'default', {
      entries: [
        {
          controlId: 'refresh',
          surfaceId: 'explorerToolbar',
          zone: 'primaryStart',
          order: 5,
        },
      ],
    });
    store.setFollowThemeExplorerLayout(false);
    store.setActiveExplorerLayoutId(EXPLORER_CANONICAL_LAYOUT_ID);

    const beforeRevision =
      useSettingsStore.getState().settings.explorer.layoutUiResetRevision;
    useSettingsStore.getState().resetLayoutCustomizationToCanonical();

    const { appearance, explorer } = useSettingsStore.getState().settings;
    expect(explorer.followThemeExplorerLayout).toBe(false);
    expect(explorer.activeExplorerLayoutId).toBe(EXPLORER_CANONICAL_LAYOUT_ID);
    expect(explorer.chromeLayoutOverridesByThemeId).toEqual({});
    expect(explorer.layoutUiResetRevision).toBe(beforeRevision + 1);
    expect(appearance.topBarLayoutSnapshotsById).toEqual({});
    expect(appearance.layoutDynamicsEnabled).toBe(true);
    expect(appearance.layoutDynamicsPresetId).toBeNull();
    expect(appearance.layoutDynamicsIntensity).toBe(1);
    expect(appearance.layoutDynamicsSurfaceOverrides).toEqual({});
    expect(appearance.activeThemeId).toBe('operator-dark');
    expect(appearance.activeIconThemeId).toBe('lucide_stroke');
    expect(appearance.activeWallpaperId).toBe('wallpaper:studio');
    expect(appearance.activeTopBarId).toBe('classic-topbar');
  });
});

describe('useSettingsStore.updateLayout()', () => {
  const ideWorkbenchSeeds: WorkbenchSurfaceLayoutSeed[] = [
    {
      id: 'explorer',
      defaultDockPlacement: 'center',
      defaultOrder: 10,
      defaultVisibility: 'visible',
    },
    {
      id: 'terminal',
      defaultDockPlacement: 'bottom-panel',
      defaultOrder: 20,
      defaultVisibility: 'collapsed',
    },
    {
      id: 'settings',
      defaultDockPlacement: 'right-sidebar',
      defaultOrder: 30,
      defaultVisibility: 'hidden',
    },
  ];

  it('updates layout settings without mutating unrelated sections', () => {
    const store = useSettingsStore.getState();
    const beforeAppearance = { ...store.settings.appearance };

    store.updateLayout({
      activeProfileId: 'navigator-bottom',
      configPath: 'M:\\layouts\\greeble.layouts.toml',
      zenFocusMode: true,
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.layout.activeProfileId).toBe('navigator-bottom');
    expect(settings.layout.configPath).toBe('M:\\layouts\\greeble.layouts.toml');
    expect(settings.layout.zenFocusMode).toBe(true);
    expect(settings.appearance).toEqual(beforeAppearance);
  });

  it('stores zen focus mode without disturbing the saved layout panel state', () => {
    const store = useSettingsStore.getState();
    store.updateLayout({
      panelStateByProfile: {
        'overlay-classic': {
          openPanelIds: ['terminal'],
          activePanelId: 'terminal',
          dismissedPanelIds: ['explorer'],
        },
      },
    });

    store.updateLayout({ zenFocusMode: true });

    const { layout } = useSettingsStore.getState().settings;
    expect(layout.zenFocusMode).toBe(true);
    expect(layout.panelStateByProfile['overlay-classic']).toEqual({
      openPanelIds: ['terminal'],
      activePanelId: 'terminal',
      dismissedPanelIds: ['explorer'],
    });
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

  it('stores IDE shell state separately from classic panel state and shell-family selection', () => {
    const store = useSettingsStore.getState();
    const ideShellState = createDefaultIdeWorkbenchLayoutState(ideWorkbenchSeeds);

    store.updateLayout({
      panelStateByProfile: {
        'overlay-classic': {
          openPanelIds: ['explorer', 'terminal'],
          activePanelId: 'terminal',
          dismissedPanelIds: ['settings'],
        },
      },
      shellStateByProfile: {
        'workbench-ide': ideShellState,
      },
      lastProfileIdByShellFamily: {
        classic: 'overlay-classic',
        ide: 'workbench-ide',
      },
    });

    const { layout } = useSettingsStore.getState().settings;

    expect(layout.panelStateByProfile['overlay-classic']).toEqual({
      openPanelIds: ['explorer', 'terminal'],
      activePanelId: 'terminal',
      dismissedPanelIds: ['settings'],
    });
    expect(layout.shellStateByProfile['workbench-ide']).toEqual(ideShellState);
    expect(layout.lastProfileIdByShellFamily).toEqual({
      classic: 'overlay-classic',
      ide: 'workbench-ide',
    });
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

  it('stores the developer test settings toggle as persisted system state', () => {
    const store = useSettingsStore.getState();

    expect(store.settings.system.developerTestSettingsEnabled).toBe(false);

    store.updateSystem({ developerTestSettingsEnabled: true });
    expect(useSettingsStore.getState().settings.system.developerTestSettingsEnabled).toBe(true);

    store.resetToDefaults();
    expect(useSettingsStore.getState().settings.system.developerTestSettingsEnabled).toBe(false);
  });

  it('stores a normalized Linux display backend preference', () => {
    const store = useSettingsStore.getState();

    store.updateSystem({ linuxDisplayBackendPreference: 'x11' });
    expect(useSettingsStore.getState().settings.system.linuxDisplayBackendPreference).toBe('x11');

    store.updateSystem({ linuxDisplayBackendPreference: 'invalid' as never });
    expect(useSettingsStore.getState().settings.system.linuxDisplayBackendPreference).toBe('auto');
  });

  it('stores a normalized Linux NVIDIA WebKit workaround mode', () => {
    const store = useSettingsStore.getState();

    expect(useSettingsStore.getState().settings.system.linuxNvidiaWebkitWorkaroundMode).toBe('auto');

    store.updateSystem({ linuxNvidiaWebkitWorkaroundMode: 'force-off' });
    expect(useSettingsStore.getState().settings.system.linuxNvidiaWebkitWorkaroundMode).toBe('force-off');

    store.updateSystem({ linuxNvidiaWebkitWorkaroundMode: 'force-on' });
    expect(useSettingsStore.getState().settings.system.linuxNvidiaWebkitWorkaroundMode).toBe('force-on');

    store.updateSystem({ linuxNvidiaWebkitWorkaroundMode: 'invalid' as never });
    expect(useSettingsStore.getState().settings.system.linuxNvidiaWebkitWorkaroundMode).toBe('auto');
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

  it('stores icon theme selection independently, normalizes ids, and clears blanks back to null', () => {
    const store = useSettingsStore.getState();
    store.updateAppearance({ activeIconThemeId: ' Zen ' });
    expect(useSettingsStore.getState().settings.appearance.activeIconThemeId).toBe('zen');

    store.updateAppearance({ activeIconThemeId: '   ' });
    expect(useSettingsStore.getState().settings.appearance.activeIconThemeId).toBeNull();
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
      previewLocked: true,
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
    expect(session.previewLocked).toBe(true);
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
      previewLocked: true,
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
    expect(session.previewLocked).toBe(true);
    expect(session.sourcesVisible).toBe(false);
  });

  it('resets stale wallpaper, shader, blur, and zoom overrides when switching into andromeda', () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'pilot-dark',
          activeWallpaperId: 'wallpaper-lab',
          activeShaderId: 'nebula-flow',
          shaderPerformanceMode: 'quality',
          panelTransparency: 0.52,
          appBlur: true,
          appZoom: 1.14,
        },
      },
    }));

    useSettingsStore.getState().applyThemeSelection('andromeda');

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.activeThemeId).toBe('andromeda');
    expect(settings.appearance.theme).toBe('dark');
    expect(settings.appearance.activeWallpaperId).toBeNull();
    expect(settings.appearance.activeShaderId).toBeNull();
    expect(settings.appearance.shaderPerformanceMode).toBe('performance');
    expect(settings.appearance.panelTransparency).toBe(0);
    expect(settings.appearance.appBlur).toBe(false);
    expect(settings.appearance.appZoom).toBe(1);
  });
});

describe('useSettingsStore.updateModels()', () => {
  it('updates capability bindings and semantic root overrides independently from the rest of settings', () => {
    const store = useSettingsStore.getState();
    store.updateModels({
      capabilityBindings: {
        ...store.settings.models.capabilityBindings,
        [semanticIndexingCapabilityId]: {
          modelId: 'semantic-bge-base-en-v1_5',
          backendPreference: 'onnx',
        },
      },
      semanticIndexRootOverrides: {
        '/workspace/demo': {
          modelId: 'semantic-minilm-l6-v2',
          backendPreference: 'cpu',
        },
      },
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.models.capabilityBindings[semanticIndexingCapabilityId]).toEqual({
      modelId: 'semantic-bge-base-en-v1_5',
      backendPreference: 'onnx',
    });
    expect(settings.models.semanticIndexRootOverrides['/workspace/demo']).toEqual({
      modelId: 'semantic-minilm-l6-v2',
      backendPreference: 'cpu',
    });
    expect(settings.python.runtimeRoot).toBe(defaultSettings.python.runtimeRoot);
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

  it('migrates a legacy integrated shell string into the new shell profile fields on import', () => {
    const store = useSettingsStore.getState();
    const legacyShell = '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -NoLogo -NoProfile';
    const inferredProfile = inferIntegratedTerminalProfileFromShell({ shell: legacyShell });
    store.importSettings({
      terminal: {
        shell: legacyShell,
      } as typeof defaultSettings.terminal,
    });

    const { terminal } = useSettingsStore.getState().settings;
    expect(terminal.shellProfile).toBe(
      normalizeIntegratedTerminalProfile(inferredProfile.shellProfile),
    );
    expect(terminal.shellPath).toBe(inferredProfile.shellPath);
    expect(terminal.shellArgs).toBe(inferredProfile.shellArgs);
    expect(terminal.shell).toBe(resolveIntegratedTerminalShellCommand({
      profile: inferredProfile.shellProfile,
      shellPath: inferredProfile.shellPath,
      shellArgs: inferredProfile.shellArgs,
    }));
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

describe('useSettingsStore plugin settings actions', () => {
  it('stores, patches, and resets plugin-owned values in one namespaced slice', () => {
    const store = useSettingsStore.getState();

    store.setPluginSettingsValues('notes-tools', {
      autoWrap: true,
      density: 'cozy',
      ignoredFn: () => 'nope',
    });
    expect(useSettingsStore.getState().settings.plugins.valuesByPluginId).toEqual({
      'notes-tools': {
        autoWrap: true,
        density: 'cozy',
      },
    });

    store.patchPluginSettings('notes-tools', {
      density: 'compact',
      tabSize: 4,
    });
    expect(
      useSettingsStore.getState().settings.plugins.valuesByPluginId[
        'notes-tools'
      ],
    ).toEqual({
      autoWrap: true,
      density: 'compact',
      tabSize: 4,
    });

    store.setPluginSettingValue('notes-tools', 'tabSize', Number.NaN);
    expect(
      useSettingsStore.getState().settings.plugins.valuesByPluginId[
        'notes-tools'
      ],
    ).toEqual({
      autoWrap: true,
      density: 'compact',
    });

    store.resetPluginSettings('notes-tools', ['density']);
    expect(
      useSettingsStore.getState().settings.plugins.valuesByPluginId[
        'notes-tools'
      ],
    ).toEqual({
      autoWrap: true,
    });

    store.clearPluginSettings('notes-tools');
    expect(useSettingsStore.getState().settings.plugins.valuesByPluginId).toEqual(
      {},
    );
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
    expect(merged.appearance.activeIconThemeId).toBe(defaultSettings.appearance.activeIconThemeId);
    expect(merged.appearance.activeShaderId).toBeNull();
    expect(merged.appearance.uiFontFamily).toBe('Geist, Inter, system-ui, sans-serif');
    expect(merged.appearance.appZoom).toBe(1.1);
    expect(merged.appearance.useNativeOsIcons).toBe(defaultSettings.appearance.useNativeOsIcons);
    expect(merged.appearance.panelTransparency).toBe(defaultSettings.appearance.panelTransparency);
    expect(merged.appearance.appBlurStrength).toBe(defaultSettings.appearance.appBlurStrength);
    expect(merged.appearance.appOpenAnimation).toBe(defaultSettings.appearance.appOpenAnimation);
    expect(merged.appearance.appCloseAnimation).toBe(defaultSettings.appearance.appCloseAnimation);
    expect(merged.terminal.shellProfile).toBe(defaultSettings.terminal.shellProfile);
    expect(merged.terminal.shellPath).toBe(defaultSettings.terminal.shellPath);
    expect(merged.terminal.shellArgs).toBe(defaultSettings.terminal.shellArgs);
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

  it('normalizes icon theme ids by canonicalizing case and collapsing blank values to null', () => {
    const trimmed = mergeSettingsWithDefaults({
      appearance: {
        activeIconThemeId: ' Zen ',
      } as typeof defaultSettings.appearance,
    });
    const blank = mergeSettingsWithDefaults({
      appearance: {
        activeIconThemeId: '   ',
      } as typeof defaultSettings.appearance,
    });

    expect(trimmed.appearance.activeIconThemeId).toBe('zen');
    expect(blank.appearance.activeIconThemeId).toBeNull();
  });

  it('normalizes unsupported explorer folder click modes back to the default', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        folderClickMode: 'triple-click',
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.folderClickMode).toBe(defaultSettings.explorer.folderClickMode);
  });

  it('normalizes unsupported collection preview modes back to the default', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        collectionPreviewMode: 'mosaic-bad',
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.collectionPreviewMode).toBe(defaultSettings.explorer.collectionPreviewMode);
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
      includeModels: true,
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

  it('migrates legacy flat context-menu overrides into layout overrides when no menu-layout overrides exist', () => {
    const merged = mergeSettingsWithDefaults({
      explorer: {
        contextMenuItemOverrides: {
          'built-in.open': { enabled: false, order: 30 },
          'built-in.open-with': { order: 10 },
        },
      } as unknown as typeof defaultSettings.explorer,
    });

    expect(merged.explorer.activeMenuPackId).toBe(DEFAULT_EXPLORER_MENU_PACK_ID);
    expect(merged.explorer.contextMenuLayoutOverridesByContext.entry?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'command',
          commandId: 'built-in.open',
          enabled: false,
        }),
        expect.objectContaining({
          kind: 'command',
          commandId: 'built-in.open-with',
        }),
      ]),
    );
  });

  it('normalizes imported local model bindings and semantic root overrides', () => {
    const merged = mergeSettingsWithDefaults({
      models: {
        capabilityBindings: {
          [semanticIndexingCapabilityId]: {
            modelId: 'semantic-bge-large-en-v1_5',
            backendPreference: 'cuda',
          },
          'broken-capability': {
            modelId: 'ignored-model',
            backendPreference: 'bogus',
          },
        },
        semanticIndexRootOverrides: {
          '   /workspace/demo   ': {
            modelId: 'semantic-minilm-l6-v2',
            backendPreference: 'cpu',
          },
          '': {
            modelId: 'semantic-bge-base-en-v1_5',
            backendPreference: 'onnx',
          },
        },
      } as unknown as typeof defaultSettings.models,
    });

    expect(merged.models.capabilityBindings[semanticIndexingCapabilityId]).toEqual({
      modelId: 'semantic-bge-large-en-v1_5',
      backendPreference: 'cuda',
    });
    expect(merged.models.semanticIndexRootOverrides).toEqual({
      '/workspace/demo': {
        modelId: 'semantic-minilm-l6-v2',
        backendPreference: 'cpu',
      },
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

  it('sanitizes imported plugin settings into stable JSON-safe values', () => {
    const merged = mergeSettingsWithDefaults({
      plugins: {
        valuesByPluginId: {
          ' notes-tools ': {
            autoWrap: true,
            density: 'compact',
            invalidNumber: Number.NaN,
            nested: {
              showMinimap: false,
            },
          },
          '': {
            broken: true,
          },
        },
      },
    } as unknown as Parameters<typeof mergeSettingsWithDefaults>[0]);

    expect(merged.plugins.valuesByPluginId).toEqual({
      'notes-tools': {
        autoWrap: true,
        density: 'compact',
        nested: {
          showMinimap: false,
        },
      },
    });
  });
});
