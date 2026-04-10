import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayAnimations } from '../components/animationRuntime';
import { createBuiltInOverlayShaders } from '../components/shaderRuntime';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { pluginSystemConfig } from '../config/plugins';
import { screenshotFeatureConfig } from '../config/screenshots';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
import { useSettingsStore } from '../store/settingsStore';
import { useTerminalStore } from '../store/terminalStore';
import type { LoadedOverlayThemePackage } from '../config/themePackages';

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
}) {
  const packageThemes = (options?.themePackages ?? []).map(pkg => pkg.theme);
  const appearance = resolveOverlayAppearance({
    activeThemeId: options?.appearanceThemeId ?? 'operator',
    packageThemes,
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
    />,
  );
}

describe('SettingsPage behavior', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
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

    expect(screen.getByText('OverlayTerm Control Surface')).toBeInTheDocument();
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
      themePackages: [{
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
          visuals: 2,
          shaders: 1,
          animations: 1,
          fonts: 2,
        },
        warnings: [],
        theme: packageTheme,
        engineManifest,
        compiledEngineManifest: compileThemeEngineManifest(engineManifest),
      }],
    });

    await userEvent.setup().click(findSectionButton('Appearance'));

    expect(await screen.findByText('Vista Glass')).toBeInTheDocument();
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
      themePackages: [{
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
          visuals: 2,
          shaders: 1,
          animations: 1,
          fonts: 2,
        },
        warnings: [],
        theme: packageTheme,
      }],
    });

    await user.click(findSectionButton('Appearance'));
    await user.click((await screen.findByText('Vista Glass')).closest('button') as HTMLButtonElement);

    const appearanceSettings = useSettingsStore.getState().settings.appearance;
    expect(appearanceSettings.activeThemeId).toBe('vista-glass');
    expect(appearanceSettings.activeShaderId).toBeNull();
    expect(appearanceSettings.appOpenAnimation).toBeNull();
    expect(appearanceSettings.appCloseAnimation).toBeNull();
    expect(appearanceSettings.useNativeOsIcons).toBe(false);
  });
});
