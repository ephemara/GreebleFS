import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../panels/panelRegistry', () => ({
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

vi.mock('../components/WindowControls', () => ({
  WindowControls: () => null,
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

vi.mock('../config/themePackages', () => ({
  loadThemePackages: vi.fn(async () => ({
    packages: [],
    shaders: [],
    animations: [],
    directory: '/tmp/themes',
    warnings: [],
    sourceError: null,
  })),
  themeSystemConfig: {
    themesDirectory: '/tmp/themes',
  },
}));

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
  openExplorerPath: vi.fn(async () => undefined),
}));

vi.mock('../runtime/tauriClient', () => ({
  unwrapTauriResult: (value: unknown) => value,
  commands: {
    fsGetHomeDir: vi.fn(async () => '/tmp'),
    fsReadTextFile: vi.fn(async () => {
      throw new Error('missing');
    }),
    fsWriteFile: vi.fn(async () => undefined),
    startupGetLaunchAtStartup: vi.fn(async () => false),
    traySetVisible: vi.fn(async () => undefined),
    terminalOpenExternal: vi.fn(async () => undefined),
    windowApplyMode: vi.fn(async () => undefined),
    windowApplyWaylandDockLayout: vi.fn(async () => ({ status: 'ok', data: null })),
    windowSetTaskbarVisibility: vi.fn(async () => undefined),
    windowGetLinuxDisplayServer: vi.fn(async () => 'x11'),
    windowGetWaylandDockHostStatus: vi.fn(async () => ({ enabled: false, windowLabel: null })),
    windowSetBlur: vi.fn(async () => undefined),
  },
}));

import App from '../App';
import { commands } from '../runtime/tauriClient';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { SHOW_WINDOW_MODE_REQUEST_EVENT } from '../runtime/windowHost';

type MockWebviewWindow = {
  label: string;
  emit: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
};

function createMockWebviewWindow(label: string): MockWebviewWindow {
  return {
    label,
    emit: vi.fn(async () => undefined),
    listen: vi.fn().mockResolvedValue(() => {}),
    once: vi.fn().mockResolvedValue(() => {}),
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
      layout: {
        ...defaultSettings.layout,
        activeProfileId: 'overlay-classic',
        configPath: '/tmp/missing.layouts.json',
      },
    },
  }));
}

describe('App dock mode behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    mainHostWindow = createMockWebviewWindow('main');
    dockHostWindow = createMockWebviewWindow('dock');
    vi.mocked(getCurrentWebviewWindow).mockImplementation(() => mainHostWindow as never);
    vi.mocked(WebviewWindow.getByLabel).mockImplementation(async label => (
      label === 'dock' ? dockHostWindow as never : mainHostWindow as never
    ));
    vi.mocked(commands.traySetVisible).mockClear();
    vi.mocked(commands.windowApplyMode).mockClear();
    vi.mocked(commands.windowApplyWaylandDockLayout).mockClear();
    vi.mocked(commands.windowSetTaskbarVisibility).mockClear();
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
      expect(vi.mocked(commands.windowApplyMode)).toHaveBeenCalledWith(
        false,
        false,
        false,
        true,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
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
    expect(lastApplyModeCall?.[0]).toBe(false);
    expect(lastApplyModeCall?.[3]).toBe(false);
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
});
