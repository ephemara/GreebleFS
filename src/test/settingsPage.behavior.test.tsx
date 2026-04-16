import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayAnimations } from '../components/animationRuntime';
import { createBuiltInOverlayShaders } from '../components/shaderRuntime';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { resolveThemeCatalogPackageMetadata } from '../config/themeCatalogCuration';
import { pluginSystemConfig } from '../config/plugins';
import { screenshotFeatureConfig } from '../config/screenshots';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
import { useTerminalStore } from '../store/terminalStore';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type { OverlayPluginContextMenuContribution, OverlayPluginExplorerActionContribution } from '../config/pluginContributions';

function createThemePackageFixture(
  fixture: Omit<LoadedOverlayThemePackage, 'catalog'> & { catalog?: LoadedOverlayThemePackage['catalog'] },
): LoadedOverlayThemePackage {
  return {
    ...fixture,
    catalog: fixture.catalog ?? resolveThemeCatalogPackageMetadata(fixture.id),
  };
}

function findSectionButton(label: string): HTMLButtonElement {
  const button = screen.getAllByRole('button').find(entry => entry.textContent?.includes(label));
  if (!button) {
    throw new Error(`Unable to find button containing "${label}"`);
  }
  return button as HTMLButtonElement;
}

function renderSettingsPage(options?: {
  appearanceThemeId?: string;
  themePackages?: LoadedOverlayThemePackage[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  pluginExplorerActions?: OverlayPluginExplorerActionContribution[];
}) {
  const packageThemes = (options?.themePackages ?? []).map(pkg => pkg.theme);
  const appearanceSettings = useSettingsStore.getState().settings.appearance;
  const appearance = resolveOverlayAppearance({
    activeThemeId: options?.appearanceThemeId ?? appearanceSettings.activeThemeId,
    activeDockThemeId: appearanceSettings.activeDockThemeId,
    dockThemeMode: appearanceSettings.dockThemeMode,
    customThemes: appearanceSettings.customThemes,
    packageThemes,
    uiFontFamily: appearanceSettings.uiFontFamily,
    panelTransparency: appearanceSettings.panelTransparency,
  });

  render(
    <SettingsPage
      appearance={appearance}
      themePackages={options?.themePackages ?? []}
      themePackagesDirectory="themes"
      themePackagesLoading={false}
      themePackagesError={null}
      themePackagesWarnings={[]}
      onRefreshThemes={async () => {}}
      onOpenThemesFolder={async () => {}}
      shaders={createBuiltInOverlayShaders()}
      shaderDiagnostics={[]}
      shadersDirectory="shaders"
      shadersLoading={false}
      shadersError={null}
      onRefreshShaders={async () => {}}
      onOpenShadersFolder={async () => {}}
      animations={createBuiltInOverlayAnimations()}
      animationDiagnostics={[]}
      animationsDirectory="animations"
      animationsLoading={false}
      animationsError={null}
      onRefreshAnimations={async () => {}}
      onOpenAnimationsFolder={async () => {}}
      wallpapers={[]}
      wallpaperDiagnostics={[]}
      wallpapersDirectory="wallpapers"
      wallpapersLoading={false}
      wallpapersError={null}
      onRefreshWallpapers={async () => {}}
      onOpenWallpapersFolder={async () => {}}
      onImportWallpaperFiles={async () => {}}
      pluginContextMenuItems={options?.pluginContextMenuItems}
      pluginExplorerActions={options?.pluginExplorerActions}
    />,
  );
}

describe('SettingsPage behavior', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
    useExplorerStore.getState().resetSession();
    useTerminalStore.setState({
      isInitialized: true,
      directoryBookmarks: [],
      commandBookmarks: [],
    });

    vi.mocked(invoke).mockReset();
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });
  });

  it('lands on the overview section and can create then open a missing workspace root', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_list_dir') {
        const payload = args as { path?: string } | undefined;
        if (payload?.path === pluginSystemConfig.pluginsDirectory) {
          throw new Error('missing');
        }
        return [];
      }

      return null;
    });

    renderSettingsPage();

    expect(screen.getByText('GreebleFS Control Surface')).toBeInTheDocument();
    expect(screen.getByText('Core Workflows')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Terminal Settings' }));
    expect(screen.getByText('Application mode, dock mode, integrated shell defaults, and external terminal handoff.')).toBeInTheDocument();

    await user.click(findSectionButton('Overview'));
    await user.click(screen.getByRole('button', { name: 'Open Plugins Folder' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('fs_create_dir', { path: pluginSystemConfig.pluginsDirectory });
    });
    expect(invokeMock).toHaveBeenCalledWith('fs_open_file', { path: pluginSystemConfig.pluginsDirectory });
    expect(screen.getByText(`Opened Plugins: ${pluginSystemConfig.pluginsDirectory}`)).toBeInTheDocument();
  }, 30000);

  it('updates explorer click mode, restores folder rules, and seeds bookmarks without duplicates', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const homeDir = 'C:\\Users\\Alex';

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fs_get_home_dir') {
        return homeDir;
      }

      return null;
    });

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        explorer: {
          ...state.settings.explorer,
          folderClickMode: 'double',
          folderIconRules: [
            {
              id: 'custom-rule',
              label: 'Custom Rule',
              matchers: ['custom'],
              icon: 'folder_docs',
            },
          ],
        },
      },
    }));

    useTerminalStore.setState({
      isInitialized: true,
      directoryBookmarks: [
        { id: 'def-dir-home', name: 'Home', value: homeDir },
      ],
      commandBookmarks: [],
    });

    renderSettingsPage();

    await user.click(findSectionButton('Explorer'));
    expect(useSettingsStore.getState().settings.explorer.folderClickMode).toBe('double');

    await user.click(screen.getByRole('button', { name: /^Single Click/i }));
    expect(useSettingsStore.getState().settings.explorer.folderClickMode).toBe('single');

    await user.click(screen.getByRole('button', { name: 'Restore Rules' }));
    expect(useSettingsStore.getState().settings.explorer.folderIconRules).toHaveLength(
      createDefaultFolderIconRules().length,
    );

    await user.click(screen.getByRole('button', { name: 'Seed Platform Bookmarks' }));

    await waitFor(() => {
      expect(useTerminalStore.getState().directoryBookmarks).toHaveLength(3);
    });

    expect(useTerminalStore.getState().directoryBookmarks.map(bookmark => bookmark.value)).toEqual(
      expect.arrayContaining([
        homeDir,
        'C:\\Users\\Alex\\Desktop',
        'C:\\Users\\Alex\\Documents',
      ]),
    );
    expect(invokeMock).toHaveBeenCalledWith('fs_get_home_dir');
  }, 30000);

  it('lets the explorer context menu composer disable and reorder plugin menu items', async () => {
    const user = userEvent.setup();
    renderSettingsPage({
      pluginContextMenuItems: [
        {
          id: 'sample-plugin.context-menu.capture',
          pluginId: 'sample-plugin',
          pluginName: 'Sample Tools',
          title: 'Capture Memory Snapshot',
          contexts: ['entry'],
          appliesTo: 'file',
          group: 'plugin',
          defaultOrder: 650,
          execution: {
            kind: 'plugin-backend',
            entry: 'backend/capture-snapshot',
            args: ['{path}'],
          },
        },
      ],
    });

    await user.click(findSectionButton('Explorer'));
    expect(screen.getByText('Context Menu Composer')).toBeInTheDocument();
    expect(screen.getByText('Capture Memory Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Plugin · Sample Tools')).toBeInTheDocument();
    expect(screen.getByText('Backend · backend/capture-snapshot')).toBeInTheDocument();

    const contextMenuCheckboxes = screen.getAllByRole('checkbox');
    const pluginCheckbox = contextMenuCheckboxes[contextMenuCheckboxes.length - 1] as HTMLInputElement | undefined;
    if (!pluginCheckbox) {
      throw new Error('Expected plugin context menu checkbox');
    }

    expect(pluginCheckbox.checked).toBe(true);
    await user.click(pluginCheckbox);

    expect(useSettingsStore.getState().settings.explorer.contextMenuItemOverrides['sample-plugin.context-menu.capture']).toEqual({
      enabled: false,
      order: expect.any(Number),
    });

    await user.click(screen.getByRole('button', { name: 'Normalize Order' }));

    expect(useSettingsStore.getState().settings.explorer.contextMenuItemOverrides['sample-plugin.context-menu.capture']).toEqual({
      enabled: false,
      order: expect.any(Number),
    });
  });

  it('saves cloud provider credentials from settings and enables the provider login action', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const providerStates: Record<string, {
      provider: 'google-drive' | 'dropbox';
      configured: boolean;
      missing_configuration: string[];
      configuration_source: 'none' | 'settings' | 'environment';
      client_id: string | null;
      client_secret_present: boolean;
    }> = {
      'google-drive': {
        provider: 'google-drive',
        configured: false,
        missing_configuration: ['client ID'],
        configuration_source: 'none',
        client_id: null,
        client_secret_present: false,
      },
      dropbox: {
        provider: 'dropbox',
        configured: false,
        missing_configuration: ['client ID'],
        configuration_source: 'none',
        client_id: null,
        client_secret_present: false,
      },
    };

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'cloud_list_accounts') {
        return {
          accounts: [],
          providers: Object.values(providerStates),
        };
      }

      if (command === 'cloud_set_provider_configuration') {
        const payload = args as { provider?: 'google-drive' | 'dropbox'; clientId?: string; clientSecret?: string | null } | undefined;
        if (!payload?.provider) {
          throw new Error('missing provider');
        }
        providerStates[payload.provider] = {
          provider: payload.provider,
          configured: true,
          missing_configuration: [],
          configuration_source: 'settings',
          client_id: payload.clientId ?? null,
          client_secret_present: Boolean(payload.clientSecret),
        };
        return providerStates[payload.provider];
      }

      return null;
    });

    renderSettingsPage();

    await user.click(findSectionButton('Cloud'));
    const googleConnectButton = screen.getAllByRole('button', { name: 'Connect Account' })[0];
    expect(googleConnectButton).toBeDisabled();

    await user.type(screen.getByLabelText('Google Drive client ID'), 'google-client-id.apps.googleusercontent.com');
    await user.type(screen.getByLabelText('Google Drive client secret'), 'test-google-secret');
    await user.click(screen.getAllByRole('button', { name: 'Save Credentials' })[0]);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('cloud_set_provider_configuration', {
        provider: 'google-drive',
        clientId: 'google-client-id.apps.googleusercontent.com',
        clientSecret: 'test-google-secret',
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Saved in Settings')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Connect Account' })[0]).not.toBeDisabled();
    });
  });

  it('syncs startup registration, desktop visibility toggles, and commits hotkey edits', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'startup_set_launch_at_startup') {
        const payload = args as { enabled?: boolean } | undefined;
        return Boolean(payload?.enabled);
      }

      return null;
    });

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          hideAppInTray: true,
          showInTaskbar: false,
        },
      },
    }));

    renderSettingsPage();

    await user.click(findSectionButton('System'));
    const startupToggle = screen.getByRole('checkbox', { name: /launch at startup/i });

    await user.click(startupToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.launchAtStartup).toBe(true);
    });
    expect(invokeMock).toHaveBeenLastCalledWith('startup_set_launch_at_startup', { enabled: true });

    await user.click(startupToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.launchAtStartup).toBe(false);
    });
    expect(invokeMock).toHaveBeenLastCalledWith('startup_set_launch_at_startup', { enabled: false });

    const trayToggle = screen.getByRole('checkbox', { name: /hide app in tray/i });
    const taskbarToggle = screen.getByRole('checkbox', { name: /show in taskbar/i });

    await user.click(taskbarToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.showInTaskbar).toBe(true);
    });

    await user.click(trayToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.hideAppInTray).toBe(false);
    });

    await user.click(screen.getByRole('checkbox', { name: /show in taskbar/i }));
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.showInTaskbar).toBe(false);
      expect(useSettingsStore.getState().settings.system.hideAppInTray).toBe(true);
    });

    await user.click(findSectionButton('Hotkeys'));
    const toggleInput = screen.getByDisplayValue('Ctrl+Space');
    await user.clear(toggleInput);
    await user.type(toggleInput, 'Ctrl + Shift + Space');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.keybindings.terminalToggle).toBe('Ctrl+Shift+Space');
    });

    const windowModeInput = screen.getByDisplayValue('F11');
    await user.clear(windowModeInput);
    await user.type(windowModeInput, 'F10');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.keybindings.windowModeToggle).toBe('F10');
    });

    await user.click(screen.getAllByRole('button', { name: 'Reset' })[0]);
    expect(useSettingsStore.getState().settings.keybindings.terminalToggle).toBe('Ctrl+Space');
  }, 30000);

  it('can hand off the tray recovery path to taskbar visibility', async () => {
    const user = userEvent.setup();

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        system: {
          ...state.settings.system,
          hideAppInTray: true,
          showInTaskbar: false,
        },
      },
    }));

    renderSettingsPage();

    await user.click(findSectionButton('System'));
    await user.click(screen.getByRole('checkbox', { name: /hide app in tray/i }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.hideAppInTray).toBe(false);
      expect(useSettingsStore.getState().settings.system.showInTaskbar).toBe(true);
    });
  });

  it('restores the safe system defaults from the settings page reset action', async () => {
    const user = userEvent.setup();

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

    renderSettingsPage();

    await user.click(findSectionButton('System'));
    await user.click(screen.getByRole('button', { name: 'Reset Defaults' }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system).toEqual(defaultSettings.system);
    });
  }, 30000);

  it('switches the terminal between application and dock presentation and persists the windowed size', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    await user.click(findSectionButton('Terminal'));
    await user.click(screen.getByRole('button', { name: /Application Mode/ }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('windowed');
    });

    fireEvent.change(screen.getByDisplayValue('1440'), { target: { value: '1560' } });
    fireEvent.change(screen.getByDisplayValue('920'), { target: { value: '960' } });

    expect(useSettingsStore.getState().settings.terminal.windowedWidth).toBe(1560);
    expect(useSettingsStore.getState().settings.terminal.windowedHeight).toBe(960);

    await user.click(screen.getByRole('button', { name: /Dock Mode/ }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
  }, 30000);

  it('surfaces screenshot defaults in settings and opens the configured save folder', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const screenshotDir = 'D:\\Proofs\\OverlayTerm';

    invokeMock.mockImplementation(async () => []);

    renderSettingsPage();

    await user.click(findSectionButton('Screenshots'));

    expect(screen.getByText('Proof Capture Defaults')).toBeInTheDocument();

    const saveDirectoryInput = screen.getByDisplayValue(screenshotFeatureConfig.defaultSaveDirectory);
    fireEvent.change(saveDirectoryInput, { target: { value: screenshotDir } });

    await user.click(screen.getByRole('button', { name: /Full Monitor/i }));
    await user.click(screen.getByRole('button', { name: /^Copy\s/i }));
    await user.click(screen.getByRole('checkbox', { name: 'Show composition grid' }));
    await user.click(screen.getByRole('checkbox', { name: 'Jump back to the library after save actions' }));

    expect(useSettingsStore.getState().settings.screenshots.saveDirectory).toBe(screenshotDir);
    expect(useSettingsStore.getState().settings.screenshots.defaultCaptureMode).toBe('monitor');
    expect(useSettingsStore.getState().settings.screenshots.defaultOutputAction).toBe('copy');
    expect(useSettingsStore.getState().settings.screenshots.showGrid).toBe(false);
    expect(useSettingsStore.getState().settings.screenshots.closeEditorAfterAction).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Open Save Folder' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('fs_open_file', { path: screenshotDir });
    });
  }, 30000);

  it('renders packaged theme preview metadata and badges in the picker', async () => {
    const packageTheme = normalizeThemeDefinition({
      id: 'vista-glass',
      name: 'Vista Glass',
      source: 'package',
      description: 'Glossy Aero shell.',
      defaultShaderId: 'prism-wave',
      defaultOpenAnimationId: 'dissolve',
      defaultCloseAnimationId: 'burn',
      assets: {
        previewUrl: 'asset://localhost/themes/vista-glass/assets/preview.svg',
        backgroundUrl: 'asset://localhost/themes/vista-glass/assets/wallpaper.svg',
      },
      palette: {
        accent: '#7dd3ff',
      },
    } as never);
    const engineManifest = normalizeThemeManifestDraft({
      id: 'vista-glass',
      name: 'Vista Glass',
      designTokens: [
        {
          id: 'vista-accent',
          name: 'Vista Accent',
          kind: 'color',
          value: '#7dd3ff',
        },
      ],
      layoutPrimitives: [
        {
          id: 'vista-shell',
          name: 'Vista Shell',
          kind: 'dock',
          props: { chrome: 'frosted' },
        },
      ],
      navigationPatterns: [
        {
          id: 'vista-breadcrumbs',
          name: 'Vista Breadcrumbs',
          kind: 'palette',
          axis: 'horizontal',
          props: { searchFirst: 'true' },
        },
      ],
      animationProfiles: [
        {
          id: 'vista-bloom',
          name: 'Vista Bloom',
          durationMs: 260,
          easing: 'ease-out',
          intensity: 54,
        },
      ],
      iconPacks: [
        {
          id: 'vista-icons',
          name: 'Vista Icons',
          style: 'skeuomorphic',
        },
      ],
      renderStyles: [
        {
          id: 'vista-render',
          label: 'Vista Render',
          description: 'Vista shell render style',
          kind: 'vs-code-workbench',
          entryModule: 'renderers/vista.tsx',
          supportsLiveSwap: true,
        },
      ],
      defaultRenderStyleId: 'vista-render',
    });

    renderSettingsPage({
      appearanceThemeId: 'vista-glass',
      themePackages: [createThemePackageFixture({
        id: 'vista-glass',
        name: 'Vista Glass',
        version: 2,
        directoryPath: 'themes/vista-glass',
        manifestPath: 'themes/vista-glass/theme.json',
        sourceKind: 'theme-directory',
        sourceLabel: 'themes/vista-glass',
        description: 'Glossy Aero shell.',
        author: 'OverlayTerm Labs',
        homepage: 'https://overlayterm.local/themes/vista-glass',
        tags: ['glass', 'blue'],
        previewUrl: 'asset://localhost/themes/vista-glass/assets/preview.svg',
        capabilitySummary: {
          icons: true,
          wallpaper: true,
          dock: true,
          visuals: 2,
          shaders: 1,
          animations: 1,
          fonts: 2,
          themeRenderer: false,
        },
        warnings: [],
        theme: packageTheme,
        engineManifest,
        compiledEngineManifest: compileThemeEngineManifest(engineManifest),
      })],
    });

    await userEvent.setup().click(findSectionButton('Appearance'));

    expect((await screen.findAllByText('Vista Glass')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('OverlayTerm Labs')[0]).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Shaders 1')).toBeInTheDocument();
    expect(screen.getByText('Motion 1')).toBeInTheDocument();
    expect(screen.getByText('Visuals 2')).toBeInTheDocument();
    expect(screen.getByText('Tokens 1')).toBeInTheDocument();
    expect(screen.getByText('Layout dock')).toBeInTheDocument();
    expect(screen.getByText('Nav palette')).toBeInTheDocument();
    expect(screen.getByText('Icons skeuomorphic')).toBeInTheDocument();
    expect(screen.getByText('Render vs-code-workbench')).toBeInTheDocument();
    expect(screen.getByText('Profile vista-bloom')).toBeInTheDocument();
    expect(screen.getByText('Live Swap Ready')).toBeInTheDocument();
    expect(screen.getByText('Theme Folder')).toBeInTheDocument();
    expect(screen.getAllByText('themes/vista-glass').length).toBeGreaterThan(0);
    expect(screen.getByText('glass')).toBeInTheDocument();
  });

  it('applies package theme defaults when selecting a packaged theme', async () => {
    const user = userEvent.setup();
    const packageTheme = normalizeThemeDefinition({
      id: 'vista-glass',
      name: 'Vista Glass',
      source: 'package',
      description: 'Glossy Aero shell.',
      defaultShaderId: 'prism-wave',
      defaultOpenAnimationId: 'dissolve',
      defaultCloseAnimationId: 'burn',
      palette: {
        accent: '#7dd3ff',
      },
    } as never);

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
          activeShaderId: 'aurora-ribbon',
          appOpenAnimation: 'fizzle',
          appCloseAnimation: 'burn',
          useNativeOsIcons: true,
        },
      },
    }));

    renderSettingsPage({
      themePackages: [createThemePackageFixture({
        id: 'vista-glass',
        name: 'Vista Glass',
        version: 2,
        directoryPath: 'themes/vista-glass',
        manifestPath: 'themes/vista-glass/theme.json',
        sourceKind: 'theme-directory',
        sourceLabel: 'themes/vista-glass',
        tags: ['glass'],
        previewUrl: 'asset://localhost/themes/vista-glass/assets/preview.svg',
        capabilitySummary: {
          icons: true,
          wallpaper: true,
          dock: false,
          visuals: 2,
          shaders: 1,
          animations: 1,
          fonts: 2,
          themeRenderer: false,
        },
        warnings: [],
        theme: packageTheme,
      })],
    });

    await user.click(findSectionButton('Appearance'));
    await user.click((await screen.findByText('Vista Glass')).closest('button') as HTMLButtonElement);

    const appearanceSettings = useSettingsStore.getState().settings.appearance;
    expect(appearanceSettings.activeThemeId).toBe('vista-glass');
    expect(appearanceSettings.activeShaderId).toBeNull();
    expect(appearanceSettings.appOpenAnimation).toBeNull();
    expect(appearanceSettings.appCloseAnimation).toBeNull();
    expect(appearanceSettings.useNativeOsIcons).toBe(true);
  });

  it('applies the pilot light baseline when selecting the built-in default theme', async () => {
    const user = userEvent.setup();

    useSettingsStore.setState(state => ({
      settings: {
        ...state.settings,
        explorer: {
          ...state.settings.explorer,
          showHiddenFiles: true,
          viewMode: 'icons-l',
          experimentalViewMode: 'adaptive-semantic-grid',
          experimentalDensity: 0.66,
          folderClickMode: 'single',
        },
        appearance: {
          ...state.settings.appearance,
          activeThemeId: 'operator',
          dockThemeMode: 'override',
          activeDockThemeId: 'vista-glass',
          activeWallpaperId: 'aurora',
          activeShaderId: 'nebula-flow',
          uiFontFamily: 'Geist, Inter, system-ui, sans-serif',
          useNativeOsIcons: true,
          panelTransparency: 0.42,
          appZoom: 1.12,
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

    renderSettingsPage();

    await user.click(findSectionButton('Appearance'));
    const pilotLightCards = await screen.findAllByText('Pilot Light');
    await user.click(pilotLightCards[0].closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.appearance.activeThemeId).toBe('pilot-light');
    });

    const { settings } = useSettingsStore.getState();
    expect(settings.appearance.theme).toBe('light');
    expect(settings.appearance.dockThemeMode).toBe('follow-app');
    expect(settings.appearance.activeDockThemeId).toBeNull();
    expect(settings.appearance.activeWallpaperId).toBeNull();
    expect(settings.appearance.activeShaderId).toBeNull();
    expect(settings.appearance.uiFontFamily).toBe(defaultSettings.appearance.uiFontFamily);
    expect(settings.appearance.useNativeOsIcons).toBe(true);
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

  it('groups the theme catalog into built-ins, an official pilot suite, and a demoted archive', async () => {
    const user = userEvent.setup();

    renderSettingsPage({
      appearanceThemeId: 'cyber-nexus-hud',
      themePackages: [
        createThemePackageFixture({
          id: 'cyber-nexus-hud',
          name: 'Cyber Nexus HUD',
          version: 2,
          directoryPath: 'themes/cyber-nexus-hud',
          manifestPath: 'themes/cyber-nexus-hud/theme.json',
          sourceKind: 'theme-directory',
          sourceLabel: 'themes/cyber-nexus-hud',
          description: 'Neon pilot shell.',
          author: 'OverlayTerm Labs',
          previewUrl: 'asset://localhost/themes/cyber-nexus-hud/assets/preview.svg',
          tags: ['neon', 'pilot'],
          capabilitySummary: {
            icons: true,
            wallpaper: true,
            dock: true,
            visuals: 2,
            shaders: 1,
            animations: 1,
            fonts: 1,
            themeRenderer: true,
          },
          warnings: [],
          theme: normalizeThemeDefinition({
            id: 'cyber-nexus-hud',
            name: 'Cyber Nexus HUD',
            source: 'package',
            description: 'Neon pilot shell.',
            palette: {
              accent: '#7cfcff',
            },
          } as never),
        }),
        createThemePackageFixture({
          id: 'vector-monolith',
          name: 'Vector Monolith',
          version: 4,
          directoryPath: 'themes/vector-monolith',
          manifestPath: 'themes/vector-monolith/theme.json',
          sourceKind: 'theme-directory',
          sourceLabel: 'themes/vector-monolith',
          description: 'Three.js flagship shell.',
          author: 'OverlayTerm Labs',
          previewUrl: 'asset://localhost/themes/vector-monolith/assets/preview.svg',
          tags: ['3d', 'flagship'],
          capabilitySummary: {
            icons: true,
            wallpaper: true,
            dock: true,
            visuals: 4,
            shaders: 2,
            animations: 2,
            fonts: 1,
            themeRenderer: true,
          },
          warnings: [],
          theme: normalizeThemeDefinition({
            id: 'vector-monolith',
            name: 'Vector Monolith',
            source: 'package',
            description: 'Three.js flagship shell.',
            palette: {
              accent: '#a78bfa',
            },
          } as never),
        }),
        createThemePackageFixture({
          id: 'arcade-arcology',
          name: 'Arcade Arcology',
          version: 1,
          directoryPath: 'themes/arcade-arcology',
          manifestPath: 'themes/arcade-arcology/theme.json',
          sourceKind: 'theme-directory',
          sourceLabel: 'themes/arcade-arcology',
          description: 'Legacy archive shell.',
          author: 'OverlayTerm Labs',
          previewUrl: 'asset://localhost/themes/arcade-arcology/assets/preview.svg',
          tags: ['archive'],
          capabilitySummary: {
            icons: true,
            wallpaper: false,
            dock: false,
            visuals: 1,
            shaders: 0,
            animations: 0,
            fonts: 1,
            themeRenderer: false,
          },
          warnings: [],
          theme: normalizeThemeDefinition({
            id: 'arcade-arcology',
            name: 'Arcade Arcology',
            source: 'package',
            description: 'Legacy archive shell.',
            palette: {
              accent: '#f59e0b',
            },
          } as never),
        }),
      ],
    });

    await user.click(findSectionButton('Appearance'));

    const builtInSection = screen.getByText('Built-In Baselines').closest('section') as HTMLElement;
    const officialSection = screen.getByText('Official Pilot Suite').closest('section') as HTMLElement;
    const legacySection = screen.getByText('Legacy / Lab Archive').closest('section') as HTMLElement;

    expect(builtInSection).toBeInTheDocument();
    expect(officialSection).toBeInTheDocument();
    expect(legacySection).toBeInTheDocument();

    expect(within(builtInSection).getByText('Pilot Light')).toBeInTheDocument();
    expect(within(officialSection).getByText('Cyber Nexus HUD')).toBeInTheDocument();
    expect(within(officialSection).getAllByText('Pilot')[0]).toBeInTheDocument();
    expect(within(legacySection).getByText('Arcade Arcology')).toBeInTheDocument();

    const officialCard = within(officialSection).getByRole('button', { name: /Cyber Nexus HUD/i });
    const legacyCard = within(legacySection).getByRole('button', { name: /Arcade Arcology/i });

    expect(officialCard).toHaveStyle({ opacity: '1' });
    expect(legacyCard).toHaveStyle({ opacity: '0.82' });

    await user.click(officialCard);
    expect(useSettingsStore.getState().settings.appearance.activeThemeId).toBe('cyber-nexus-hud');

    await user.click(legacyCard);
    expect(useSettingsStore.getState().settings.appearance.activeThemeId).toBe('arcade-arcology');
  });

  it('stores a separate dock theme override from the appearance catalog', async () => {
    const user = userEvent.setup();
    const packageTheme = normalizeThemeDefinition({
      id: 'vista-glass',
      name: 'Vista Glass',
      source: 'package',
      description: 'Glossy Aero shell.',
      dock: {
        workbench: {
          preset: 'xmb',
        },
      },
      palette: {
        accent: '#7dd3ff',
      },
    } as never);

    renderSettingsPage({
      themePackages: [createThemePackageFixture({
        id: 'vista-glass',
        name: 'Vista Glass',
        version: 2,
        directoryPath: 'themes/vista-glass',
        manifestPath: 'themes/vista-glass/theme.json',
        sourceKind: 'theme-directory',
        sourceLabel: 'themes/vista-glass',
        tags: ['glass'],
        previewUrl: 'asset://localhost/themes/vista-glass/assets/preview.svg',
        capabilitySummary: {
          icons: true,
          wallpaper: true,
          dock: true,
          visuals: 2,
          shaders: 1,
          animations: 1,
          fonts: 2,
          themeRenderer: false,
        },
        warnings: [],
        theme: packageTheme,
      })],
    });

    await user.click(findSectionButton('Appearance'));
    await user.click(screen.getByRole('button', { name: 'Override Theme' }));

    const dockThemeButtons = screen.getAllByRole('button').filter(button =>
      button.textContent?.includes('Vista Glass'),
    );
    await user.click(dockThemeButtons[dockThemeButtons.length - 1] as HTMLButtonElement);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.appearance).toMatchObject({
        activeThemeId: defaultSettings.appearance.activeThemeId,
        dockThemeMode: 'override',
        activeDockThemeId: 'vista-glass',
      });
    });
  });
});
