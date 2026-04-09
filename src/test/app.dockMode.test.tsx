import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../panels/panelRegistry', () => ({
  createBuiltInPanelDefinitions: ({
    explorerLayoutMode,
  }: {
    explorerLayoutMode?: 'full' | 'compact-dock';
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
      render: () => <div data-testid="explorer-layout-mode">{explorerLayoutMode ?? 'full'}</div>,
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
    windowSetBlur: vi.fn(async () => undefined),
  },
}));

import App from '../App';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';

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
    setWindowMode('windowed');
  });

  it('renders the explorer in full mode for the application window and compact dock mode for dock mode', async () => {
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByTestId('explorer-layout-mode')).toHaveTextContent('full');

    await user.click(screen.getByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('compact-dock');

    await user.click(screen.getByTitle('Switch to Application Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('full');
  });

  it('foregrounds the explorer when switching from application mode into dock mode', async () => {
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
    expect(screen.queryByTestId('explorer-layout-mode')).toBeNull();

    await user.click(screen.getByTitle('Switch to Dock Mode'));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(screen.getByTestId('explorer-layout-mode')).toHaveTextContent('compact-dock');
    expect(screen.queryByTestId('terminal-panel')).not.toBeInTheDocument();
  });
});
