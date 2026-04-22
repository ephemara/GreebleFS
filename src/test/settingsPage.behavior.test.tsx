import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayAnimations } from '../components/animationRuntime';
import { getBuiltInExplorerHomePacks } from '../components/home/builtInHomePacks';
import { createBuiltInOverlayShaders } from '../components/shaderRuntime';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { homePackSystemConfig, type LoadedExplorerHomePack } from '../config/homePackages';
import { resolveThemeCatalogPackageMetadata } from '../config/themeCatalogCuration';
import { pluginSystemConfig } from '../config/plugins';
import { screenshotFeatureConfig } from '../config/screenshots';
import { topBarSystemConfig, type LoadedOverlayTopBarPackage } from '../config/topBarPackages';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
import { createLoadedTopBarDefinition } from '../config/topBars';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { useAccelerationRuntimeStore } from '../store/accelerationRuntimeStore';
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

const BUILT_IN_HOME_PACK_FIXTURES: LoadedExplorerHomePack[] = getBuiltInExplorerHomePacks().map(runtime => ({
  id: runtime.id,
  name: runtime.name,
  version: 1,
  directoryPath: `builtin:${runtime.id}`,
  manifestPath: `builtin:${runtime.id}:manifest`,
  sourceKind: 'built-in',
  sourceLabel: 'built-in',
  description: runtime.description,
  author: undefined,
  homepage: undefined,
  tags: [],
  warnings: [],
  runtime,
}));

function findSectionButton(label: string): HTMLButtonElement {
  const button = screen.getAllByRole('button').find(entry => entry.textContent?.includes(label));
  if (!button) {
    throw new Error(`Unable to find button containing "${label}"`);
  }
  return button as HTMLButtonElement;
}

function renderSettingsPage(options?: {
  appearanceThemeId?: string;
  topBarPackages?: LoadedOverlayTopBarPackage[];
  homePacks?: LoadedExplorerHomePack[];
  themePackages?: LoadedOverlayThemePackage[];
  onRefreshTopBars?: () => Promise<void>;
  onOpenTopBarsFolder?: () => Promise<void>;
  onRefreshHomePacks?: () => Promise<void>;
  onOpenHomePacksFolder?: () => Promise<void>;
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
      topBarPackages={options?.topBarPackages ?? []}
      topBarPackagesDirectory={topBarSystemConfig.topBarsDirectory}
      topBarPackagesLoading={false}
      topBarPackagesError={null}
      topBarPackagesWarnings={[]}
      homePacks={options?.homePacks ?? BUILT_IN_HOME_PACK_FIXTURES}
      homePacksDirectory={homePackSystemConfig.homePacksDirectory}
      homePacksLoading={false}
      homePacksError={null}
      homePacksWarnings={[]}
      themePackages={options?.themePackages ?? []}
      themePackagesDirectory="themes"
      themePackagesLoading={false}
      themePackagesError={null}
      themePackagesWarnings={[]}
      onRefreshTopBars={options?.onRefreshTopBars ?? (async () => {})}
      onOpenTopBarsFolder={options?.onOpenTopBarsFolder ?? (async () => {})}
      onRefreshHomePacks={options?.onRefreshHomePacks ?? (async () => {})}
      onOpenHomePacksFolder={options?.onOpenHomePacksFolder ?? (async () => {})}
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
    useSettingsStore.setState({ activeSection: 'overview' });
    useExplorerStore.getState().resetSession();
    useAccelerationRuntimeStore.setState(state => ({
      ...state,
      snapshot: {
        ...state.snapshot,
        providers: [],
        pythonProbe: null,
        pythonProbeAttempted: false,
        pythonProbeError: null,
        pythonSidecarRunning: false,
        pythonSidecarActionAvailable: false,
      },
      hydrationState: 'ready',
      hydrationError: null,
    }));
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

  it('lands directly on the icons section when deep-linked through the settings store', () => {
    useSettingsStore.getState().setActiveSection('icons');

    renderSettingsPage();

    expect(screen.getByText('Choose a dedicated icon theme independently from the active shell theme, keep folder rules in one place, and decide when OS-native icons should still fill gaps.')).toBeInTheDocument();
  });

  it('renders the models section, keeps CUDA disabled without an NVIDIA provider, and saves semantic root overrides', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'python_sidecar_call') {
        const request = (args as { request?: { actionId?: string } } | undefined)?.request;
        if (request?.actionId === 'models.catalog_status') {
          return {
            runtimeStatus: {
              runtimeRoot: '/tmp/python-runtime',
            },
            sidecar: {
              running: true,
              actionIds: ['models.catalog_status'],
            },
            requestId: 'models-1',
            actionId: 'models.catalog_status',
            resultJson: JSON.stringify({
              pythonVersion: '3.11.9',
              cacheRoot: '/tmp/python-runtime/cache/models',
              huggingFaceCacheRoot: '/tmp/python-runtime/cache/models/huggingface',
              registryRoot: '/tmp/python-runtime/cache/models/registry',
              totalCacheSizeBytes: 128 * 1024 * 1024,
              installedModelCount: 1,
              models: [
                {
                  modelId: 'semantic-minilm-l6-v2',
                  installed: true,
                  backendKinds: ['onnx'],
                  providerKinds: ['cpu'],
                  lastWarmedAtMs: 1713798000000,
                  lastUsedAtMs: 1713798300000,
                  lastError: null,
                },
                {
                  modelId: 'semantic-bge-base-en-v1_5',
                  installed: false,
                  backendKinds: [],
                  providerKinds: [],
                  lastWarmedAtMs: null,
                  lastUsedAtMs: null,
                  lastError: null,
                },
                {
                  modelId: 'semantic-bge-large-en-v1_5',
                  installed: false,
                  backendKinds: [],
                  providerKinds: [],
                  lastWarmedAtMs: null,
                  lastUsedAtMs: null,
                  lastError: null,
                },
              ],
            }),
          };
        }
      }

      return null;
    });

    renderSettingsPage();

    await user.click(findSectionButton('Models'));

    expect(await screen.findByText('Current Active Model')).toBeInTheDocument();
    expect(screen.getByText('Managed Cache')).toBeInTheDocument();
    expect(screen.getAllByText('MiniLM L6 v2').length).toBeGreaterThan(0);

    const cudaButton = screen.getByRole('button', {
      name: 'Use CUDA backend for Semantic Indexing',
    });
    expect(cudaButton).toBeDisabled();

    await user.click(screen.getByRole('button', {
      name: 'Use ONNX backend for Semantic Indexing',
    }));
    expect(
      useSettingsStore.getState().settings.models.capabilityBindings['semantic-indexing']?.backendPreference,
    ).toBe('onnx');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Semantic Indexing model' }),
      'semantic-bge-base-en-v1_5',
    );
    expect(
      useSettingsStore.getState().settings.models.capabilityBindings['semantic-indexing']?.modelId,
    ).toBe('semantic-bge-base-en-v1_5');

    await user.type(
      screen.getByLabelText('Semantic index override root path'),
      '/workspace/demo',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Semantic index override model' }),
      'semantic-minilm-l6-v2',
    );
    await user.click(screen.getByRole('button', {
      name: 'Use CPU backend for semantic index override',
    }));
    await user.click(screen.getByRole('button', { name: 'Save Override' }));

    expect(
      useSettingsStore.getState().settings.models.semanticIndexRootOverrides['/workspace/demo'],
    ).toEqual({
      modelId: 'semantic-minilm-l6-v2',
      backendPreference: 'cpu',
    });
  }, 30000);

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
    expect(screen.getByRole('button', { name: 'Open Notes Folder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Home Packs Folder' })).toBeInTheDocument();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('fs_create_dir', { path: pluginSystemConfig.pluginsDirectory });
    });
    expect(invokeMock).toHaveBeenCalledWith('fs_open_file', { path: pluginSystemConfig.pluginsDirectory });
    expect(screen.getByText(`Opened Plugins: ${pluginSystemConfig.pluginsDirectory}`)).toBeInTheDocument();
  }, 30000);

  it('opens the standalone top-bars folder from the dedicated settings section', async () => {
    const user = userEvent.setup();
    const openTopBarsFolder = vi.fn(async () => {});

    renderSettingsPage({
      onOpenTopBarsFolder: openTopBarsFolder,
    });

    await user.click(findSectionButton('Top Bars'));
    await user.click(screen.getByRole('button', { name: 'Open Top Bars Folder' }));

    expect(openTopBarsFolder).toHaveBeenCalledTimes(1);
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

    await user.click(findSectionButton('Icons'));
    await user.click(screen.getByRole('button', { name: 'Restore Rules' }));
    expect(useSettingsStore.getState().settings.explorer.folderIconRules).toHaveLength(
      createDefaultFolderIconRules().length,
    );

    await user.click(findSectionButton('Explorer'));
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

  it('toggles empty-space double-click navigation setting', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(findSectionButton('Explorer'));

    const toggle = screen.getByRole('checkbox', {
      name: /double-click empty space to go up\/back/i,
    });

    expect(useSettingsStore.getState().settings.explorer.doubleClickEmptyToGoBack).toBe(false);

    await user.click(toggle);
    expect(useSettingsStore.getState().settings.explorer.doubleClickEmptyToGoBack).toBe(true);

    await user.click(toggle);
    expect(useSettingsStore.getState().settings.explorer.doubleClickEmptyToGoBack).toBe(false);
  });

  it('prioritizes core settings ahead of appearance sections in the rail', () => {
    renderSettingsPage();

    const orderedLabels = [
      'Overview',
      'System',
      'Models',
      'Terminal',
      'Explorer',
      'Home',
      'Layouts',
      'Hotkeys',
      'Cloud',
      'Screenshots',
      'Audio',
      'Appearance',
      'Top Bars',
      'Icons',
      'Wallpapers',
      'Shaders',
      'Animations',
      'Interaction Motion',
      'Theme JSON',
    ];
    const orderedButtons = orderedLabels.map(findSectionButton);

    for (let index = 0; index < orderedButtons.length - 1; index += 1) {
      expect(
        orderedButtons[index]?.compareDocumentPosition(orderedButtons[index + 1] as Node)
          & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('updates interaction motion settings and exposes motion-lab preview surfaces', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    await user.click(findSectionButton('Animations'));
    expect(screen.queryByRole('checkbox', {
      name: /enable interaction motion/i,
    })).not.toBeInTheDocument();

    await user.click(findSectionButton('Interaction Motion'));

    const enabledToggle = screen.getByRole('checkbox', {
      name: /enable interaction motion/i,
    });
    const shellChromeToggle = screen.getByRole('checkbox', {
      name: /enable shell chrome interaction motion/i,
    });
    const fileItemsToggle = screen.getByRole('checkbox', {
      name: /enable files & folders interaction motion/i,
    });
    const explorerSurfaceToggle = screen.getByRole('checkbox', {
      name: /enable explorer entries interaction motion/i,
    });

    expect(enabledToggle).toBeChecked();
    expect(shellChromeToggle).toBeChecked();
    expect(fileItemsToggle).toBeChecked();
    expect(explorerSurfaceToggle).toBeChecked();

    await user.click(screen.getByRole('button', {
      name: /use spring interaction motion preset for shell chrome/i,
    }));
    expect(useSettingsStore.getState().settings.appearance.interactionMotionModuleOverrides.shellChrome).toMatchObject({
      presetId: 'spring',
    });

    await user.click(screen.getByRole('button', {
      name: /use bounce interaction motion preset for files & folders/i,
    }));
    expect(useSettingsStore.getState().settings.appearance.interactionMotionModuleOverrides.fileItems).toMatchObject({
      presetId: 'bounce',
    });

    fireEvent.change(screen.getByRole('slider', { name: /squash/i }), {
      target: { value: '1.6' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /step/i }), {
      target: { value: '0.18' },
    });
    expect(
      useSettingsStore.getState().settings.appearance.interactionMotionModuleOverrides.fileItems,
    ).toMatchObject({
      modifierValuesByPresetId: {
        bounce: {
          squash: 1.6,
          step: 0.18,
        },
      },
    });

    await user.click(explorerSurfaceToggle);
    expect(useSettingsStore.getState().settings.appearance.interactionMotionSurfaceOverrides.explorerEntry).toBe(false);

    await user.click(enabledToggle);
    expect(useSettingsStore.getState().settings.appearance.interactionMotionEnabled).toBe(false);

    await user.click(enabledToggle);
    expect(useSettingsStore.getState().settings.appearance.interactionMotionEnabled).toBe(true);

    const motionLabEntry = screen.getByText('Idle folder').closest('button');
    expect(motionLabEntry).not.toBeNull();
    expect(motionLabEntry).toHaveAttribute('data-interaction-motion-surface', 'explorerEntry');
  }, 30000);

  it('applies themed select styling in terminal and system settings', async () => {
    const user = userEvent.setup();
    renderSettingsPage({ appearanceThemeId: 'monokai' });

    await user.click(findSectionButton('Terminal'));

    const cursorStyleSelect = screen.getByRole('combobox', { name: 'Cursor Style' });
    const externalProfileSelect = screen.getByRole('combobox', { name: 'External Terminal Profile' });

    expect(cursorStyleSelect.style.appearance).toBe('none');
    expect(cursorStyleSelect.style.colorScheme).toBe('dark');
    expect(cursorStyleSelect.style.backgroundImage).not.toBe('');
    expect(externalProfileSelect.style.appearance).toBe('none');
    expect(externalProfileSelect.style.colorScheme).toBe('dark');

    await user.click(findSectionButton('System'));

    const telemetryCaptureSelect = screen.getByRole('combobox', { name: 'Telemetry Capture Mode' });
    expect(telemetryCaptureSelect.style.appearance).toBe('none');
    expect(telemetryCaptureSelect.style.colorScheme).toBe('dark');
    expect(telemetryCaptureSelect.style.backgroundImage).not.toBe('');
  });

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

    const zenFocusInput = screen.getByDisplayValue('Ctrl+Alt+Z');
    await user.clear(zenFocusInput);
    await user.type(zenFocusInput, 'Ctrl + Shift + Z');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.keybindings.zenFocusModeToggle).toBe('Ctrl+Shift+Z');
    });

    const toggleHotkeyCard = screen.getByText('Toggle Main Window').closest('label');
    if (!toggleHotkeyCard) {
      throw new Error('Missing Toggle Main Window hotkey card');
    }
    await user.click(within(toggleHotkeyCard).getByRole('button', { name: 'Reset' }));
    expect(useSettingsStore.getState().settings.keybindings.terminalToggle)
      .toBe(defaultSettings.keybindings.terminalToggle);
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

  it('syncs and updates the Linux display backend preference through the native startup config', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    let preferredBackend: 'auto' | 'x11' | 'wayland' = 'auto';

    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Linux x86_64',
    });

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'startup_get_linux_display_backend_status') {
        return {
          availableBackends: ['wayland', 'x11'],
          sessionBackend: 'wayland',
          activeBackend: 'x11',
          preferredBackend,
          autoX11FallbackActive: true,
        };
      }

      if (command === 'startup_set_linux_display_backend_preference') {
        preferredBackend = ((args as { preferredBackend?: typeof preferredBackend } | undefined)?.preferredBackend ?? 'auto');
        return {
          availableBackends: ['wayland', 'x11'],
          sessionBackend: 'wayland',
          activeBackend: preferredBackend === 'wayland' ? 'wayland' : 'x11',
          preferredBackend,
          autoX11FallbackActive: preferredBackend === 'auto',
        };
      }

      return null;
    });

    renderSettingsPage();

    await user.click(findSectionButton('System'));
    const backendSelect = await screen.findByLabelText('Linux Display Backend');
    expect((backendSelect as HTMLSelectElement).value).toBe('auto');
    expect(screen.getByText(/auto X11 fallback active/i)).toBeInTheDocument();

    await user.selectOptions(backendSelect, 'wayland');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.linuxDisplayBackendPreference).toBe('wayland');
    });
    expect(invokeMock).toHaveBeenCalledWith('startup_set_linux_display_backend_preference', {
      preferredBackend: 'wayland',
    });
  });

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

    const sidebarToggle = screen.getByRole('checkbox', { name: 'Show terminal sidebar' });
    expect(sidebarToggle).toBeChecked();

    await user.click(sidebarToggle);

    expect(useSettingsStore.getState().settings.terminal.showSidebar).toBe(false);

    await user.click(screen.getByRole('button', { name: /Dock Mode/ }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.terminal.windowMode).toBe('overlay');
    });
    expect(useSettingsStore.getState().settings.terminal.showSidebar).toBe(false);
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

  it('lets users pin a standalone top bar from the dedicated settings section', async () => {
    const user = userEvent.setup();
    const packageTopBar = createLoadedTopBarDefinition(
      {
        id: 'launcher-rail',
        name: 'Launcher Rail',
        description: 'A compact package-owned launcher strip.',
        topBarStyle: 'floating',
        navigationMode: 'summary',
      },
      {
        source: 'theme-package',
        sourceLabel: 'Cyber Nexus HUD',
        sourceThemeId: 'cyber-nexus-hud',
      },
    );

    renderSettingsPage({
      themePackages: [createThemePackageFixture({
        id: 'cyber-nexus-hud',
        name: 'Cyber Nexus HUD',
        version: 4,
        directoryPath: 'themes/cyber-nexus-hud',
        manifestPath: 'themes/cyber-nexus-hud/theme.json',
        sourceKind: 'theme-directory',
        sourceLabel: 'themes/cyber-nexus-hud',
        tags: ['pilot'],
        previewUrl: 'asset://localhost/themes/cyber-nexus-hud/assets/preview.svg',
        capabilitySummary: {
          icons: true,
          wallpaper: true,
          dock: false,
          visuals: 2,
          shaders: 1,
          animations: 1,
          fonts: 1,
          themeRenderer: false,
          topBars: 1,
        },
        warnings: [],
        theme: normalizeThemeDefinition({
          id: 'cyber-nexus-hud',
          name: 'Cyber Nexus HUD',
          source: 'package',
          defaultTopBarId: packageTopBar.id,
        } as never),
        topBars: [packageTopBar],
      })],
    });

    await user.click(findSectionButton('Top Bars'));
    expect(screen.getByText('Standalone shell chrome workflows that can follow theme defaults or stay pinned independently.')).toBeInTheDocument();

    await user.click(findSectionButton('Launcher Rail'));
    expect(useSettingsStore.getState().settings.appearance.activeTopBarId).toBe(packageTopBar.id);

    const followThemeButtons = screen.getAllByRole('button').filter(button =>
      button.textContent?.includes('Follow Theme'),
    );
    await user.click(followThemeButtons[followThemeButtons.length - 1] as HTMLButtonElement);
    expect(useSettingsStore.getState().settings.appearance.activeTopBarId).toBeNull();
  });

  it('shows theme import failures inline instead of using a browser alert', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    await user.click(findSectionButton('Theme JSON'));

    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, { target: { value: '{ invalid json' } });
    await user.click(screen.getByRole('button', { name: 'Import / Apply' }));

    expect(await screen.findByText(/Theme import failed:/)).toBeInTheDocument();
  });
});
