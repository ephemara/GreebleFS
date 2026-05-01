import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../panels/panelRegistry', () => ({
  buildWorkbenchSurfaceDefinitions: (panels: Array<{
    id: string;
    label: string;
    render: unknown;
    dock?: {
      defaultDockPlacement?: string;
      defaultOrder?: number;
      defaultVisibility?: string;
      ideRole?: string;
    };
  }>) => panels.map((panel, index) => ({
    id: panel.id,
    label: panel.label,
    defaultDockPlacement: panel.dock?.defaultDockPlacement ?? 'center',
    defaultOrder: panel.dock?.defaultOrder ?? index,
    defaultVisibility: panel.dock?.defaultVisibility ?? 'hidden',
    ideRole: panel.dock?.ideRole ?? 'utility',
    render: panel.render,
  })),
  createBuiltInPanelDefinitions: ({
    appearance,
    explorerLayoutMode,
  }: {
    appearance?: {
      theme: {
        id: string;
      };
    };
    explorerLayoutMode?: 'full' | 'dock';
  }) => [
    {
      id: 'explorer',
      label: 'Explorer',
      description: 'File browser',
      kind: 'built-in-panel',
      icon: null,
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'browse',
        groupLabel: 'Browse',
      },
      render: () => (
        <div>
          <div data-testid="explorer-layout-mode">{explorerLayoutMode ?? 'full'}</div>
          <div data-testid="explorer-theme-id">{appearance?.theme.id ?? 'missing-theme'}</div>
        </div>
      ),
    },
    {
      id: 'terminal',
      label: 'Terminal',
      description: 'Terminal',
      kind: 'built-in-panel',
      icon: null,
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
      },
      render: () => <div data-testid="terminal-panel">terminal</div>,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Settings',
      kind: 'built-in-panel',
      icon: null,
      defaultOpen: false,
      keepMounted: true,
      render: () => <div data-testid="settings-panel">settings</div>,
    },
  ],
  createFolderPluginPanelDefinitions: () => [],
}));

vi.mock('../components/PluginsManager', () => ({
  FolderPluginRenderer: () => null,
  PluginsManager: () => null,
}));

vi.mock('../components/WorkbenchNavigationSurface', () => ({
  WorkbenchNavigationSurface: () => null,
}));

vi.mock('../components/OverlayShellScene', () => ({
  OverlayShellScene: ({
    zoom,
    contentLayer,
  }: {
    zoom: number;
    contentLayer: ReactNode;
  }) => (
    <div data-testid="overlay-shell-scene" data-zoom={String(zoom)}>
      {contentLayer}
    </div>
  ),
}));

vi.mock('../components/WindowControls', () => ({
  WindowControls: ({
    isMaximized,
    onClose,
    onMaximize,
    onMinimize,
  }: {
    isMaximized?: boolean;
    onClose?: () => void;
    onMaximize?: () => void;
    onMinimize?: () => void;
  }) => (
    <div data-testid="window-controls">
      <button title="Minimize" type="button" onClick={onMinimize}>-</button>
      <button
        title={isMaximized ? 'Restore Down' : 'Maximize'}
        type="button"
        onClick={onMaximize}
      >
        []
      </button>
      <button title="Close" type="button" onClick={onClose}>x</button>
    </div>
  ),
}));

vi.mock('../components/animationRuntime', () => ({
  AnimationOverlayLayer: () => null,
  createBuiltInOverlayAnimations: () => [],
  isFrontendAnimationFile: () => false,
  loadAnimationFromSource: vi.fn(),
  mergeOverlayAnimations: (_builtIn: unknown[], contributed: unknown[]) => contributed,
  resolveAnimationDurationMs: () => 0,
  resolveAnimationShellStyle: () => ({}),
}));

vi.mock('../components/shaderRuntime', () => ({
  ShaderSurfaceLayer: () => null,
  createBuiltInOverlayShaders: () => [],
  isFrontendShaderFile: () => false,
  loadShaderFromSource: vi.fn(),
  mergeOverlayShaders: (_builtIn: unknown[], contributed: unknown[]) => contributed,
  resolveShaderControlValues: () => ({}),
}));

vi.mock('../config/themePackages', async importOriginal => {
  const actual = await importOriginal<typeof import('../config/themePackages')>();
  const dependencyCatalogs = actual.createEmptyGlobalThemeBundleCatalogs();

  return {
    ...actual,
    loadThemePackages: vi.fn(async () => ({
      packages: [],
      shaders: [],
      animations: [],
      directory: '/tmp/themes',
      warnings: [],
      sourceError: null,
      dependencyCatalogs,
    })),
    themeSystemConfig: {
      ...actual.themeSystemConfig,
      themesDirectory: '/tmp/themes',
    },
  };
});

vi.mock('../runtime/useFolderPluginRuntime', () => ({
  useFolderPluginRuntime: () => ({
    folderPlugins: [],
    pluginContributedShaders: [],
    pluginThemePackages: [],
    pluginFonts: [],
    pluginCommands: [],
    pluginExplorerActions: [],
    pluginContextMenuItems: [],
    folderPluginsError: null,
    folderPluginsLoading: false,
    openPluginsFolder: vi.fn(async () => {}),
    refreshFolderPlugins: vi.fn(async () => {}),
    createPluginApi: vi.fn(() => ({})),
  }),
}));

vi.mock('../runtime/explorerBackend', () => ({
  listExplorerDir: vi.fn(async () => []),
  listExplorerTasks: vi.fn(async () => []),
  listenToExplorerTaskProgress: vi.fn(async () => () => {}),
  openExplorerPath: vi.fn(async () => undefined),
  getExplorerHomeDir: vi.fn(async () => '/tmp'),
}));

vi.mock('../runtime/tauriClient', () => ({
  unwrapTauriResult: (value: unknown) => value,
  events: {
    gpuRuntimeStatusEvent: {
      listen: vi.fn().mockResolvedValue(() => {}),
    },
    telemetryRecordEvent: {
      listen: vi.fn().mockResolvedValue(() => {}),
    },
  },
  commands: {
    fsGetHomeDir: vi.fn(async () => '/tmp'),
    fsReadTextFile: vi.fn(async () => {
      throw new Error('missing');
    }),
    fsWriteFile: vi.fn(async () => undefined),
    startupGetLaunchAtStartup: vi.fn(async () => false),
    startupGetLinuxDisplayBackendStatus: vi.fn(async () => ({
      status: 'ok',
      data: {
        availableBackends: ['x11'],
        sessionBackend: 'x11',
        activeBackend: 'x11',
        preferredBackend: 'auto',
        autoX11FallbackActive: false,
        nvidiaGpuDetected: false,
        nvidiaWebkitWorkaroundMode: 'force-off',
      },
    })),
    traySetVisible: vi.fn(async () => undefined),
    terminalOpenExternal: vi.fn(async () => undefined),
    windowApplyMode: vi.fn(async () => undefined),
    windowApplyWaylandDockLayout: vi.fn(async () => ({ status: 'ok', data: null })),
    windowSetTaskbarVisibility: vi.fn(async () => undefined),
    windowGetLinuxDisplayServer: vi.fn(async () => 'x11'),
    windowGetWaylandDockHostStatus: vi.fn(async () => ({ enabled: false, windowLabel: null })),
    windowSetBlur: vi.fn(async () => undefined),
    telemetryConfigure: vi.fn(async () => undefined),
    gpuRuntimeGetStatus: vi.fn(async () => ({
      configuredMode: 'auto',
      effectiveTier: 'safe',
      adapterName: null,
      adapterType: null,
      backendName: null,
      softwareRenderer: false,
      computeAvailable: false,
      queueDepth: 0,
      runtimeError: null,
      workloads: [],
    })),
    gpuRuntimeConfigure: vi.fn(async () => ({
      configuredMode: 'auto',
      effectiveTier: 'safe',
      adapterName: null,
      adapterType: null,
      backendName: null,
      softwareRenderer: false,
      computeAvailable: false,
      queueDepth: 0,
      runtimeError: null,
      workloads: [],
    })),
    lanShareStart: vi.fn(async () => ({
      address: 'http://192.168.1.20:55000',
      preferred_address: 'https://sfm.local:443',
      mdns_address: 'sfm.local:55000',
      ios_address: 'https://sfm.local:443',
      tailscale_address: null,
      tailscale_https_ready: false,
    })),
    lanShareStop: vi.fn(async () => undefined),
  },
}));

import App from '../App';
import * as appearanceModule from '../config/appearance';
import { LOCAL_APP_ZOOM_HOTKEY_SCOPE_ATTRIBUTE } from '../config/hotkeys';
import { overlayVisualControls, panelWindowGeometry } from '../config/overlayWindow';
import { overlayThemeRendererApiVersion } from '../components/themeRendererRuntime';
import { commands } from '../runtime/tauriClient';
import { resetMobileShareState } from '../store/mobileShareStore';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { SHOW_WINDOW_MODE_REQUEST_EVENT } from '../runtime/windowHost';

type MockWebviewWindow = {
  label: string;
  close: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  setFocus: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
};

function createMockWebviewWindow(label: string): MockWebviewWindow {
  return {
    label,
    close: vi.fn(async () => undefined),
    emit: vi.fn(async () => undefined),
    hide: vi.fn(async () => undefined),
    listen: vi.fn().mockResolvedValue(() => {}),
    once: vi.fn().mockImplementation(async (_event: string, handler?: () => void | Promise<void>) => {
      await handler?.();
      return () => {};
    }),
    setFocus: vi.fn(async () => undefined),
    show: vi.fn(async () => undefined),
  };
}

let mainHostWindow: MockWebviewWindow;
let dockHostWindow: MockWebviewWindow;

function setWindowMode(mode: 'overlay' | 'windowed') {
  useSettingsStore.setState(state => ({
    settings: {
      ...state.settings,
      ...defaultSettings,
      terminal: {
        ...defaultSettings.terminal,
        windowMode: mode,
      },
      presentation: {
        ...defaultSettings.presentation,
        windowMode: mode === 'overlay' ? 'dock' : 'windowed',
      },
      layout: {
        ...defaultSettings.layout,
        activeProfileId: 'overlay-classic',
        configPath: '/tmp/missing.layouts.json',
      },
    },
  }));
}

function setNavigatorPlatform(platform: string) {
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: platform,
  });
}

describe('App dock mode behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    resetMobileShareState();
    mainHostWindow = createMockWebviewWindow('main');
    dockHostWindow = createMockWebviewWindow('dock');
    vi.mocked(getCurrentWebviewWindow).mockImplementation(() => mainHostWindow as never);
    vi.mocked(WebviewWindow.getByLabel).mockImplementation(async label => (
      label === 'dock' ? dockHostWindow as never : mainHostWindow as never
    ));
    const currentWindow = getCurrentWindow();
    vi.mocked(currentWindow.isMaximized).mockReset();
    vi.mocked(currentWindow.isMaximized).mockResolvedValue(false);
    vi.mocked(currentWindow.maximize).mockClear();
    vi.mocked(currentWindow.unmaximize).mockClear();
    vi.mocked(commands.traySetVisible).mockClear();
    vi.mocked(commands.windowApplyMode).mockClear();
    vi.mocked(commands.windowApplyWaylandDockLayout).mockClear();
    vi.mocked(commands.windowSetTaskbarVisibility).mockClear();
    vi.mocked(commands.telemetryConfigure).mockClear();
    vi.mocked(commands.gpuRuntimeGetStatus).mockClear();
    vi.mocked(commands.gpuRuntimeConfigure).mockClear();
    vi.mocked(commands.lanShareStart).mockClear();
    vi.mocked(commands.lanShareStop).mockClear();
    vi.mocked(commands.startupGetLinuxDisplayBackendStatus).mockResolvedValue({
      status: 'ok',
      data: {
        availableBackends: ['x11'],
        sessionBackend: 'x11',
        activeBackend: 'x11',
        preferredBackend: 'auto',
        autoX11FallbackActive: false,
        nvidiaGpuDetected: false,
        nvidiaWebkitWorkaroundMode: 'force-off',
      },
    });
    vi.mocked(commands.windowGetLinuxDisplayServer).mockResolvedValue('x11');
    vi.mocked(commands.windowGetWaylandDockHostStatus).mockResolvedValue({ enabled: false, windowLabel: null });
    setWindowMode('windowed');
  });

  it('renders the explorer in full mode for the application window and dock mode for dock mode', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByTestId('explorer-layout-mode')).toHaveTextContent('full');
    expect(screen.getByTestId('explorer-theme-id')).toHaveTextContent(defaultSettings.appearance.activeThemeId);

    await user.click(screen.getByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('dock');
    expect(screen.getByTestId('explorer-theme-id')).toHaveTextContent(defaultSettings.appearance.activeThemeId);

    await user.click(screen.getByTitle('Switch to Application Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');
    expect(screen.getByTestId('explorer-theme-id')).toHaveTextContent(defaultSettings.appearance.activeThemeId);
  });

  it('switches the active appearance channel when dock mode uses an override theme', async () => {
    const user = userEvent.setup();

    setWindowMode('windowed');
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
          dockThemeMode: 'override',
          activeDockThemeId: 'dock-burnished',
          customThemes: [
            {
              id: 'dock-burnished',
              name: 'Dock Burnished',
              palette: {
                accent: '#ff8a00',
              },
            } as typeof state.settings.appearance.customThemes[number],
          ],
        },
      },
    }));

    render(<App />);

    expect(await screen.findByTestId('explorer-theme-id')).toHaveTextContent('operator');

    await user.click(screen.getByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(screen.getByTestId('explorer-theme-id')).toHaveTextContent('dock-burnished');

    await user.click(screen.getByTitle('Switch to Application Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });
    expect(screen.getByTestId('explorer-theme-id')).toHaveTextContent('operator');
  });

  it('keeps application mode out of the taskbar when that setting is disabled', async () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          showInTaskbar: false,
        },
      },
    }));

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(commands.windowApplyMode)).toHaveBeenCalledWith(expect.objectContaining({
        decorations: false,
        alwaysOnTop: false,
        shadow: false,
        skipTaskbar: true,
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        minWidth: expect.any(Number),
        minHeight: expect.any(Number),
        maxWidth: expect.any(Number),
        maxHeight: expect.any(Number),
      }));
    });
    expect(vi.mocked(commands.windowSetTaskbarVisibility)).toHaveBeenCalledWith(false);
    expect(vi.mocked(commands.traySetVisible)).toHaveBeenCalledWith(true);
  });

  it('preserves the taskbar preference when switching back from dock mode', async () => {
    const user = userEvent.setup();

    setWindowMode('overlay');
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          showInTaskbar: true,
        },
      },
    }));

    render(<App />);

    expect(await screen.findByTestId('explorer-layout-mode')).toHaveTextContent('dock');

    await user.click(screen.getByTitle('Switch to Application Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });
    const lastApplyModeCall = vi.mocked(commands.windowApplyMode).mock.lastCall;
    expect(lastApplyModeCall?.[0]?.decorations).toBe(false);
    expect(lastApplyModeCall?.[0]?.skipTaskbar).toBe(false);
  });

  it('hides the tray icon when the persisted system setting disables it', async () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          hideAppInTray: false,
          showInTaskbar: true,
        },
      },
    }));

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(commands.traySetVisible)).toHaveBeenCalledWith(false);
    });
  });

  it('keeps the explorer foregrounded when switching between application and dock mode', async () => {
    const user = userEvent.setup();

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        layout: {
          ...state.settings.layout,
          panelStateByProfile: {
            ...state.settings.layout.panelStateByProfile,
            'overlay-classic': {
              openPanelIds: ['terminal'],
              activePanelId: 'terminal',
              dismissedPanelIds: ['explorer'],
            },
          },
        },
      },
    }));

    render(<App />);

    expect(await screen.findByTestId('terminal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');

    await user.click(screen.getByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('dock');

    await user.click(screen.getByTitle('Switch to Application Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');
  });

  it('foregrounds the explorer when dock mode is enabled through a direct settings update', async () => {
    render(<App />);

    expect(await screen.findByTestId('terminal-panel')).toBeInTheDocument();
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');

    useSettingsStore.getState().updateTerminal({ windowMode: 'overlay' });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('dock');

    useSettingsStore.getState().updateTerminal({ windowMode: 'windowed' });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');
  });

  it('hides the top bar and foregrounds explorer while zen focus mode is enabled', async () => {
    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        layout: {
          ...state.settings.layout,
          panelStateByProfile: {
            ...state.settings.layout.panelStateByProfile,
            'overlay-classic': {
              openPanelIds: ['terminal'],
              activePanelId: 'terminal',
              dismissedPanelIds: ['explorer'],
            },
          },
        },
      },
    }));

    render(<App />);

    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();

    useSettingsStore.getState().updateLayout({ zenFocusMode: true });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.layout.zenFocusMode).toBe(true);
      expect(useSettingsStore.getState().settings.layout.panelStateByProfile['overlay-classic']?.activePanelId).toBe('explorer');
    });
    expect(screen.queryByTitle('Switch to Dock Mode')).toBeNull();
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');

    useSettingsStore.getState().updateLayout({ zenFocusMode: false });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.layout.zenFocusMode).toBe(false);
      expect(useSettingsStore.getState().settings.layout.panelStateByProfile['overlay-classic']?.activePanelId).toBe('terminal');
    });
    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();
  });

  it('toggles zen focus mode from the local keybinding', async () => {
    render(<App />);

    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.layout.zenFocusMode).toBe(true);
    });
    expect(screen.queryByTitle('Switch to Dock Mode')).toBeNull();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, altKey: true });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.layout.zenFocusMode).toBe(false);
    });
    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();
  });

  it('toggles the mobile share from the local keybinding', async () => {
    render(<App />);

    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'M', ctrlKey: true, altKey: true, shiftKey: true });

    await waitFor(() => {
      expect(vi.mocked(commands.lanShareStart)).toHaveBeenCalledWith(
        '/tmp',
        'mobile',
        null,
        'lan',
      );
    });

    fireEvent.keyDown(window, { key: 'M', ctrlKey: true, altKey: true, shiftKey: true });

    await waitFor(() => {
      expect(vi.mocked(commands.lanShareStop)).toHaveBeenCalled();
    });
  });

  it('adjusts the global app zoom from ctrl-plus and ctrl-minus', async () => {
    render(<App />);

    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();
    const baselineZoom = useSettingsStore.getState().settings.appearance.appZoom;

    fireEvent.keyDown(window, { key: '+', ctrlKey: true, shiftKey: true });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.appearance.appZoom).toBeCloseTo(
        baselineZoom + overlayVisualControls.zoom.step,
        5,
      );
    });

    fireEvent.keyDown(window, { key: '-', ctrlKey: true });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.appearance.appZoom).toBeCloseTo(
        baselineZoom,
        5,
      );
    });
  });

  it('yields ctrl-plus app zoom to local zoom-owned surfaces', async () => {
    render(<App />);

    expect(await screen.findByTitle('Switch to Dock Mode')).toBeInTheDocument();
    const baselineZoom = useSettingsStore.getState().settings.appearance.appZoom;
    const localZoomScope = document.createElement('div');
    const localZoomTarget = document.createElement('button');
    localZoomScope.setAttribute(LOCAL_APP_ZOOM_HOTKEY_SCOPE_ATTRIBUTE, 'true');
    localZoomScope.appendChild(localZoomTarget);
    document.body.appendChild(localZoomScope);

    try {
      fireEvent.keyDown(localZoomTarget, {
        key: '+',
        ctrlKey: true,
        shiftKey: true,
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().settings.appearance.appZoom).toBe(
          baselineZoom,
        );
      });
    } finally {
      localZoomScope.remove();
    }
  });

  it('falls back to the host chrome in app mode when a theme renderer owns dock chrome', async () => {
    setWindowMode('overlay');
    const baseTheme = appearanceModule.resolveOverlayAppearance({
      activeThemeId: defaultSettings.appearance.activeThemeId,
      activeDockThemeId: defaultSettings.appearance.activeDockThemeId,
      dockThemeMode: defaultSettings.appearance.dockThemeMode,
      customThemes: defaultSettings.appearance.customThemes,
      uiFontFamily: defaultSettings.appearance.uiFontFamily,
      panelTransparency: defaultSettings.appearance.panelTransparency,
      windowMode: 'overlay',
    }).baseTheme;

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'test-windowed-chrome-renderer-theme',
          customThemes: [
            {
              ...baseTheme,
              id: 'test-windowed-chrome-renderer-theme',
              name: 'Test Windowed Chrome Renderer Theme',
              source: 'custom',
              themeRenderer: {
                id: 'test-windowed-chrome-renderer',
                name: 'Test Windowed Chrome Renderer',
                filePath: '/tmp/test-windowed-chrome-renderer.tsx',
                rendererRoot: '/tmp',
                entryModule: 'index.tsx',
                apiVersion: overlayThemeRendererApiVersion,
                supportsLiveSwap: true,
                fallbackRuntime: null,
                capabilities: {
                  customScreens: true,
                  wallpaperScene: false,
                  surfaceAdapters: true,
                },
                surfaceOwnership: {
                  chrome: true,
                  launcher: true,
                  contentFrame: true,
                  pinnedPanels: false,
                  wallpaper: false,
                },
                component: ({ host }: { host: { layout: { windowMode: string } } }) => (
                  <div data-testid={`renderer-shell:${host.layout.windowMode}`}>renderer shell</div>
                ),
                error: null,
              },
            },
          ],
        },
      },
    }));

    render(<App />);

    expect(await screen.findByTestId('renderer-shell:overlay')).toBeInTheDocument();

    useSettingsStore.getState().updatePresentation({ windowMode: 'windowed' });

    await waitFor(() => {
      expect(screen.queryByTestId('renderer-shell:windowed')).toBeNull();
      expect(screen.getByTitle('Maximize')).toBeInTheDocument();
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    });
  });

  it('restores a real app window after leaving dock mode from a maximized app state', async () => {
    const user = userEvent.setup();
    const currentWindow = getCurrentWindow();
    let isMaximized = false;
    vi.mocked(currentWindow.isMaximized).mockImplementation(async () => isMaximized);
    vi.mocked(currentWindow.maximize).mockImplementation(async () => {
      isMaximized = true;
    });
    vi.mocked(currentWindow.unmaximize).mockImplementation(async () => {
      isMaximized = false;
    });

    render(<App />);

    expect(await screen.findByTestId('explorer-layout-mode')).toHaveTextContent('full');

    isMaximized = true;
    await user.click(screen.getByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(currentWindow.unmaximize).toHaveBeenCalled();
      expect(useSettingsStore.getState().settings.presentation.windowMode).toBe('dock');
    });

    await user.click(screen.getByTitle('Switch to Application Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.presentation.windowMode).toBe('windowed');
      expect(currentWindow.maximize).toHaveBeenCalled();
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
      expect(screen.getByTestId('window-controls')).toBeInTheDocument();
    });

    expect(vi.mocked(commands.windowApplyMode)).toHaveBeenLastCalledWith(expect.objectContaining({
      width: panelWindowGeometry.defaultWidth,
      height: panelWindowGeometry.defaultHeight,
      x: Math.round((1920 - panelWindowGeometry.defaultWidth) / 2),
      y: Math.round((1080 - panelWindowGeometry.defaultHeight) / 2),
    }));
  });

  it('keeps the configured app zoom while a windowed app is maximized', async () => {
    setWindowMode('windowed');
    const currentWindow = getCurrentWindow();
    vi.mocked(currentWindow.isMaximized).mockResolvedValue(true);
    useSettingsStore.getState().updateAppearance({ appZoom: 0.82 });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('overlay-shell-scene')).toHaveAttribute('data-zoom', '0.82');
    });
  });

  it('reapplies window mode once when syncing tray and taskbar changes', async () => {
    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(commands.windowApplyMode)).toHaveBeenCalled();
    });

    await new Promise(resolve => window.setTimeout(resolve, 120));
    const baselineApplyModeCalls = vi.mocked(commands.windowApplyMode).mock.calls.length;

    useSettingsStore.getState().updateSystem({
      showInTaskbar: false,
    });

    await waitFor(() => {
      expect(vi.mocked(commands.windowSetTaskbarVisibility)).toHaveBeenLastCalledWith(false);
    });

    await new Promise(resolve => window.setTimeout(resolve, 120));
    expect(vi.mocked(commands.windowApplyMode).mock.calls.length).toBe(baselineApplyModeCalls + 1);
  });

  it('routes dock handoff to the dedicated dock host on Wayland', async () => {
    const user = userEvent.setup();

    setNavigatorPlatform('Linux x86_64');
    vi.mocked(commands.windowGetLinuxDisplayServer).mockResolvedValue('wayland');
    vi.mocked(commands.windowGetWaylandDockHostStatus).mockResolvedValue({
      enabled: true,
      windowLabel: 'dock',
    });

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(commands.windowApplyMode)).toHaveBeenCalled();
    });

    await user.click(await screen.findByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(dockHostWindow.emit).toHaveBeenCalledWith(
        SHOW_WINDOW_MODE_REQUEST_EVENT,
        'overlay',
      );
    });
  });

  it('uses the dedicated Wayland dock layout command on the dock host', async () => {
    setNavigatorPlatform('Linux x86_64');
    vi.mocked(commands.windowGetLinuxDisplayServer).mockResolvedValue('wayland');
    vi.mocked(commands.windowGetWaylandDockHostStatus).mockResolvedValue({
      enabled: true,
      windowLabel: 'dock',
    });
    vi.mocked(getCurrentWebviewWindow).mockImplementation(() => dockHostWindow as never);
    setWindowMode('overlay');

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(commands.windowApplyWaylandDockLayout)).toHaveBeenCalled();
    });
  });

  it('keeps the dock host on the layer-shell path during overlay handoff before mode rehydrate', async () => {
    const listeners = new Map<string, (event: { payload: unknown }) => void>();

    setNavigatorPlatform('Linux x86_64');
    vi.mocked(commands.windowGetLinuxDisplayServer).mockResolvedValue('wayland');
    vi.mocked(commands.windowGetWaylandDockHostStatus).mockResolvedValue({
      enabled: true,
      windowLabel: 'dock',
    });
    vi.mocked(getCurrentWebviewWindow).mockImplementation(() => dockHostWindow as never);
    vi.mocked(listen).mockImplementation(async (eventName, handler) => {
      listeners.set(String(eventName), handler as (event: { payload: unknown }) => void);
      return () => {
        listeners.delete(String(eventName));
      };
    });
    setWindowMode('windowed');

    render(<App />);

    await waitFor(() => {
      expect(vi.mocked(commands.windowGetWaylandDockHostStatus)).toHaveBeenCalled();
      expect(vi.mocked(listen).mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(listeners.get(SHOW_WINDOW_MODE_REQUEST_EVENT)).toBeDefined();
    });

    const baselineApplyModeCalls = vi.mocked(commands.windowApplyMode).mock.calls.length;
    listeners.get(SHOW_WINDOW_MODE_REQUEST_EVENT)?.({ payload: 'overlay' });

    await waitFor(() => {
      expect(vi.mocked(commands.windowApplyWaylandDockLayout)).toHaveBeenCalled();
    });
    expect(vi.mocked(commands.windowApplyMode).mock.calls.length).toBe(baselineApplyModeCalls);
  });
});
