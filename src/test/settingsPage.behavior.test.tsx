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
import { createBuiltInExplorerMenuPack, menuPackSystemConfig, type LoadedExplorerMenuPack } from '../config/menuPacks';
import { recordExplorerPerformanceSample, resetExplorerPerformanceSnapshot } from '../config/performanceTelemetry';
import { resolveThemeCatalogPackageMetadata } from '../config/themeCatalogCuration';
import { pluginSystemConfig } from '../config/plugins';
import { topBarSystemConfig, type LoadedOverlayTopBarPackage } from '../config/topBarPackages';
import {
  themeAppearancePackSystemConfig,
  themeEnginePackSystemConfig,
  themeRecipePackSystemConfig,
  themeShellRendererPackSystemConfig,
  type LoadedThemeAppearancePack,
  type LoadedThemeEnginePack,
  type LoadedThemeRecipePack,
  type LoadedThemeShellRendererPack,
} from '../config/themeBundlePacks';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
import * as explorerPickerRuntime from '../runtime/explorerPicker';
import { createLoadedTopBarDefinition } from '../config/topBars';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { useAccelerationRuntimeStore } from '../store/accelerationRuntimeStore';
import { useExplorerStore } from '../store/explorerStore';
import { useGpuRuntimeStore } from '../store/gpuRuntimeStore';
import { resetMobileShareState, useMobileShareStore } from '../store/mobileShareStore';
import { useTerminalStore } from '../store/terminalStore';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
  OverlayPluginSettingsSlotContribution,
} from '../config/pluginContributions';
import type { OverlayPluginSettingsFieldDefinition } from '../config/pluginSettings';

const { qrCodeToDataUrlMock } = vi.hoisted(() => ({
  qrCodeToDataUrlMock: vi.fn(async (url: string) => `data:image/png;base64,${Buffer.from(url).toString('base64')}`),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: qrCodeToDataUrlMock,
  },
}));

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

const BUILT_IN_MENU_PACK_FIXTURES: LoadedExplorerMenuPack[] = [
  createBuiltInExplorerMenuPack(),
];

function findSectionButton(label: string): HTMLButtonElement {
  const button = screen.getAllByRole('button').find(entry => entry.textContent?.includes(label));
  if (!button) {
    throw new Error(`Unable to find button containing "${label}"`);
  }
  return button as HTMLButtonElement;
}

function assignRect(
  element: Element,
  rect: Partial<DOMRectReadOnly>,
): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    width: rect.width ?? 100,
    height: rect.height ?? 24,
    top: rect.top ?? 0,
    right: rect.right ?? ((rect.left ?? 0) + (rect.width ?? 100)),
    bottom: rect.bottom ?? ((rect.top ?? 0) + (rect.height ?? 24)),
    left: rect.left ?? 0,
    toJSON: () => ({}),
  } as DOMRectReadOnly);
}

function renderSettingsPage(options?: {
  appearanceThemeId?: string;
  topBarPackages?: LoadedOverlayTopBarPackage[];
  homePacks?: LoadedExplorerHomePack[];
  menuPacks?: LoadedExplorerMenuPack[];
  themePackages?: LoadedOverlayThemePackage[];
  appearancePacks?: LoadedThemeAppearancePack[];
  themeRecipePacks?: LoadedThemeRecipePack[];
  themeEnginePacks?: LoadedThemeEnginePack[];
  shellRenderers?: LoadedThemeShellRendererPack[];
  onRefreshTopBars?: () => Promise<void>;
  onOpenTopBarsFolder?: () => Promise<void>;
  onRefreshHomePacks?: () => Promise<void>;
  onOpenHomePacksFolder?: () => Promise<void>;
  pluginSettingsSlots?: OverlayPluginSettingsSlotContribution[];
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

  return render(
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
      menuPacks={options?.menuPacks ?? BUILT_IN_MENU_PACK_FIXTURES}
      menuPacksDirectory={menuPackSystemConfig.menuPacksDirectory}
      menuPacksLoading={false}
      menuPacksError={null}
      menuPacksWarnings={[]}
      themePackages={options?.themePackages ?? []}
      themePackagesDirectory="themes"
      themePackagesLoading={false}
      themePackagesError={null}
      themePackagesWarnings={[]}
      appearancePacks={options?.appearancePacks ?? []}
      appearancePacksDirectory={themeAppearancePackSystemConfig.appearancesDirectory}
      appearancePacksLoading={false}
      appearancePacksError={null}
      appearancePacksWarnings={[]}
      shellRenderers={options?.shellRenderers ?? []}
      shellRenderersDirectory={themeShellRendererPackSystemConfig.shellRenderersDirectory}
      shellRenderersLoading={false}
      shellRenderersError={null}
      shellRenderersWarnings={[]}
      themeRecipePacks={options?.themeRecipePacks ?? []}
      themeRecipePacksDirectory={themeRecipePackSystemConfig.themeRecipesDirectory}
      themeRecipePacksLoading={false}
      themeRecipePacksError={null}
      themeRecipePacksWarnings={[]}
      themeEnginePacks={options?.themeEnginePacks ?? []}
      themeEnginePacksDirectory={themeEnginePackSystemConfig.themeEnginesDirectory}
      themeEnginePacksLoading={false}
      themeEnginePacksError={null}
      themeEnginePacksWarnings={[]}
      onRefreshTopBars={options?.onRefreshTopBars ?? (async () => {})}
      onOpenTopBarsFolder={options?.onOpenTopBarsFolder ?? (async () => {})}
      onRefreshHomePacks={options?.onRefreshHomePacks ?? (async () => {})}
      onOpenHomePacksFolder={options?.onOpenHomePacksFolder ?? (async () => {})}
      onRefreshMenuPacks={async () => {}}
      onOpenMenuPacksFolder={async () => {}}
      onRefreshAppearancePacks={async () => {}}
      onOpenAppearancePacksFolder={async () => {}}
      onRefreshShellRenderers={async () => {}}
      onOpenShellRenderersFolder={async () => {}}
      onRefreshThemeRecipePacks={async () => {}}
      onOpenThemeRecipesFolder={async () => {}}
      onRefreshThemeEnginePacks={async () => {}}
      onOpenThemeEnginesFolder={async () => {}}
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
      pluginSettingsSlots={options?.pluginSettingsSlots}
      pluginsLoading={false}
      pluginsError={null}
      onRefreshPlugins={async () => {}}
      onOpenPluginsFolder={async () => {}}
      pluginContextMenuItems={options?.pluginContextMenuItems}
      pluginExplorerActions={options?.pluginExplorerActions}
    />,
  );
}

const TEST_PLUGIN_SETTINGS_FIELDS: OverlayPluginSettingsFieldDefinition[] = [
  {
    id: 'enabled',
    label: 'Enabled',
    description: 'Turn the plugin lane on or off.',
    kind: 'boolean',
    options: [],
    order: 10,
    keywords: ['toggle'],
    defaultValue: false,
  },
  {
    id: 'label',
    label: 'Label',
    description: 'Small visible label stored in the shared plugin settings lane.',
    kind: 'text',
    options: [],
    order: 20,
    keywords: ['text'],
    defaultValue: 'hello',
  },
];

const TEST_PLUGIN_SETTINGS_SLOT: OverlayPluginSettingsSlotContribution = {
  id: 'test.plugin.settings.main',
  pluginId: 'test-plugin',
  pluginName: 'Test Plugin',
  title: 'Main Slot',
  description: 'Primary plugin-owned settings surface.',
  iconName: 'puzzle',
  keywords: ['plugin', 'settings'],
  order: 10,
  rendererEntry: null,
  defaults: {
    enabled: false,
    label: 'hello',
  },
  fields: TEST_PLUGIN_SETTINGS_FIELDS,
  component: null,
};

const TEST_GALLERY_PLUGIN_SETTINGS_SLOT: OverlayPluginSettingsSlotContribution = {
  id: 'gallery.plugin.settings.main',
  pluginId: 'gallery-plugin',
  pluginName: 'Gallery Plugin',
  title: 'Gallery Settings',
  description: 'Gallery plugin settings generated from manifest fields.',
  iconName: 'Images',
  keywords: ['gallery', 'folders', 'extensions'],
  order: 30,
  rendererEntry: null,
  defaults: {
    rootPaths: '',
    fileExtensions: 'jpg, jpeg, png',
    resultLimit: 240,
    includeHidden: false,
  },
  fields: [
    {
      id: 'rootPaths',
      label: 'Folder Paths',
      description: 'Folders to include in the gallery.',
      kind: 'path-list',
      options: [],
      order: 10,
      keywords: ['folder'],
      defaultValue: '',
    },
    {
      id: 'fileExtensions',
      label: 'File Types',
      description: 'Image file extensions.',
      kind: 'extension-list',
      options: [
        { value: 'jpg', label: 'JPG' },
        { value: 'jpeg', label: 'JPEG' },
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
      ],
      order: 20,
      keywords: ['extensions'],
      defaultValue: 'jpg, jpeg, png',
    },
    {
      id: 'resultLimit',
      label: 'Result Limit',
      description: 'Maximum gallery results.',
      kind: 'number',
      options: [],
      order: 30,
      keywords: ['limit'],
      defaultValue: 240,
      min: 24,
      max: 500,
      step: 24,
    },
    {
      id: 'includeHidden',
      label: 'Include Hidden Files',
      description: 'Include hidden indexed files.',
      kind: 'boolean',
      options: [],
      order: 40,
      keywords: ['hidden'],
      defaultValue: false,
    },
  ],
  component: null,
};

describe('SettingsPage behavior', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
    useSettingsStore.setState({ activeSection: 'overview' });
    useExplorerStore.getState().resetSession();
    resetMobileShareState();
    resetExplorerPerformanceSnapshot(window.localStorage);
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
    useGpuRuntimeStore.setState(state => ({
      ...state,
      snapshot: {
        ...state.snapshot,
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
      },
      hydrationState: 'ready',
      hydrationError: null,
      subscriptionState: 'ready',
      subscriptionError: null,
    }));
    useTerminalStore.setState({
      isInitialized: true,
      directoryBookmarks: [],
      commandBookmarks: [],
    });

    vi.mocked(invoke).mockReset();
    qrCodeToDataUrlMock.mockClear();
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

  it('advertises VS Code folder and .vsix compatibility in theme settings copy', async () => {
    const user = userEvent.setup();

    renderSettingsPage({
      themePackages: [
        createThemePackageFixture({
          id: 'vscode-monokai',
          name: 'VS Code Monokai',
          version: 1,
          directoryPath: 'themes/monokai.vsix',
          manifestPath: '/cache/monokai/extension/themes/monokai.json',
          sourceKind: 'vscode-theme-vsix',
          sourceLabel: 'VS Code .vsix · themes/monokai.vsix',
          description: 'Imported from a VS Code color theme.',
          tags: ['vscode-compatibility'],
          warnings: [],
          capabilitySummary: {
            icons: false,
            wallpaper: false,
            dock: false,
            visuals: 0,
            shaders: 0,
            animations: 0,
            fonts: 0,
            themeRenderer: false,
            topBars: 0,
          },
          theme: normalizeThemeDefinition({
            id: 'vscode-monokai',
            name: 'VS Code Monokai',
            extendsThemeId: 'pilot-dark',
          }),
        }),
      ],
    });

    await user.click(findSectionButton('Appearance'));

    expect(screen.getByText(/VS Code color-theme folders, or/i)).toBeInTheDocument();
    expect(screen.getAllByText((_, node) =>
      node?.tagName.toLowerCase() === 'p'
      && (node.textContent?.includes('cached .vsix extracts never masquerade as authored bundles') ?? false),
    )[0]).toBeInTheDocument();
    expect(screen.getByText('VS Code VSIX')).toBeInTheDocument();
  });

  it('routes migrated sections through the shared settings shell archetypes', async () => {
    const user = userEvent.setup();
    const { container } = renderSettingsPage();
    const shell = container.querySelector('[data-settings-shell="true"]');
    const content = container.querySelector('[data-settings-shell-content="true"]');

    expect(shell).not.toBeNull();
    expect(content).not.toBeNull();
    expect((content as HTMLElement).style.maxWidth).toBe('');

    await user.click(findSectionButton('Appearance'));
    expect(content).toHaveAttribute('data-settings-active-section', 'appearance');
    expect(content).toHaveAttribute('data-settings-active-archetype', 'catalog-inspector');
    expect(container.querySelector('[data-settings-catalog-grid]')).not.toBeNull();
    expect(container.querySelector('[data-appearance-layout="compact-theme-catalog"]')).not.toBeNull();
    expect(container.querySelector('[data-theme-catalog-density="compact"]')).not.toBeNull();
    expect(container.querySelector('[data-settings-inspector="Theme Inspector"]')).not.toBeNull();

    await user.click(findSectionButton('System'));
    expect(content).toHaveAttribute('data-settings-active-section', 'system');
    expect(content).toHaveAttribute('data-settings-active-archetype', 'rows');
    expect(container.querySelector('[data-settings-row="Launch At Startup"]')).not.toBeNull();

    await user.click(findSectionButton('Context Menus'));
    expect(content).toHaveAttribute('data-settings-active-section', 'context-menus');
    expect(content).toHaveAttribute('data-settings-active-archetype', 'tool-editor');
    expect(screen.getByText('Context Menu Composer')).toBeInTheDocument();
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

  it('only injects the managed AI install command after the operator clicks Download', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const injectedCommands: Array<{ command: string; run?: boolean }> = [];
    const activeProfileId = useSettingsStore.getState().settings.layout.activeProfileId;

    useSettingsStore.setState({
      activeSection: 'system',
      settings: {
        ...useSettingsStore.getState().settings,
        system: {
          ...useSettingsStore.getState().settings.system,
          accelerationRoutingMode: 'preferCuda',
        },
        python: {
          ...useSettingsStore.getState().settings.python,
          bootstrapPackages: '',
        },
      },
    });
    useAccelerationRuntimeStore.setState(state => ({
      ...state,
      snapshot: {
        ...state.snapshot,
        pythonProbeAttempted: true,
        pythonSidecarRunning: true,
        pythonSidecarActionAvailable: true,
        pythonProbeError: null,
        pythonProbe: {
          pythonVersion: '3.11.9',
          platform: 'Windows',
          cudaVisibleDevices: null,
          cudaHome: null,
          cudaPath: null,
          torch: {
            installed: false,
            imported: null,
            importError: null,
            version: null,
            cudaAvailable: null,
            cudaVersion: null,
            cudnnAvailable: null,
            deviceCount: null,
            devices: [],
          },
          onnxruntime: {
            installed: false,
            imported: null,
            importError: null,
            availableProviders: null,
            providerError: null,
          },
          optionalModules: [
            { id: 'numpy', installed: false, imported: null, importError: null, version: null },
            { id: 'PIL', installed: false, imported: null, importError: null, version: null },
            { id: 'sentence_transformers', installed: false, imported: null, importError: null, version: null },
            { id: 'transformers', installed: false, imported: null, importError: null, version: null },
            { id: 'tokenizers', installed: false, imported: null, importError: null, version: null },
            { id: 'optimum', installed: false, imported: null, importError: null, version: null },
            { id: 'faiss', installed: false, imported: null, importError: null, version: null },
          ],
        },
        providers: [
          {
            providerKind: 'cpu',
            label: 'CPU Fallback',
            origin: 'native',
            available: true,
            ready: true,
            detail: 'fallback',
            supportedWorkloadIds: ['thumbnails'],
          },
          {
            providerKind: 'cudaPython',
            label: 'CUDA Python Sidecar',
            origin: 'python-sidecar',
            available: true,
            ready: false,
            detail: 'missing packages',
            supportedWorkloadIds: ['aiIndexing', 'localInference', 'similaritySearch'],
          },
        ],
      },
      hydrationState: 'ready',
      hydrationError: null,
    }));

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'python_get_runtime_status') {
        return {
          runtimeRoot: 'C:\\Python Runtime',
          envDir: 'C:\\Python Runtime\\env',
          scriptsDir: 'C:\\Python Runtime\\scripts',
          tempDir: 'C:\\Python Runtime\\temp',
          logsDir: 'C:\\Python Runtime\\logs',
          managedPythonPath: 'C:\\Python Runtime\\env\\Scripts\\python.exe',
          envExists: true,
          ready: true,
          managedPythonVersion: '3.11.9',
          managedPipVersion: '25.0',
          preferredInterpreterPath: null,
          bootstrapPackages: [],
          interpreterHint: 'Python 3.11 is preferred',
          baseInterpreter: null,
          discoveredInterpreters: [],
          boilerplate: {
            readmePath: 'C:\\Python Runtime\\README.md',
            requirementsPath: 'C:\\Python Runtime\\requirements.txt',
            packageDir: 'C:\\Python Runtime\\overlayterm_runtime',
            helloScriptPath: 'C:\\Python Runtime\\scripts\\hello_runtime.py',
            probeScriptPath: 'C:\\Python Runtime\\scripts\\onnx_probe.py',
          },
        };
      }

      return null;
    });

    const listener = (event: Event) => {
      injectedCommands.push((event as CustomEvent<{ command: string; run?: boolean }>).detail);
    };
    window.addEventListener('overlayterm:cmdinject', listener);

    try {
      renderSettingsPage();

      const downloadButton = await screen.findByRole('button', { name: 'Download CUDA Packages' });
      expect(injectedCommands).toHaveLength(0);

      await user.click(downloadButton);

      await waitFor(() => {
        expect(injectedCommands).toHaveLength(1);
      });

      expect(injectedCommands[0]?.run).toBe(true);
      expect(injectedCommands[0]?.command).toContain("python.exe' -m pip install");
      expect(injectedCommands[0]?.command).toContain("'onnxruntime-gpu'");
      expect(injectedCommands[0]?.command).toContain("'faiss-cpu'");
      expect(useSettingsStore.getState().settings.python.bootstrapPackages).toContain('onnxruntime-gpu');
      expect(useSettingsStore.getState().settings.python.bootstrapPackages).toContain('faiss-cpu');
      expect(useSettingsStore.getState().settings.layout.panelStateByProfile[activeProfileId]?.activePanelId).toBe('terminal');
      expect(useSettingsStore.getState().settings.layout.panelStateByProfile[activeProfileId]?.openPanelIds).toContain('terminal');
    } finally {
      window.removeEventListener('overlayterm:cmdinject', listener);
    }
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

  it('pins modular theme bundle lanes from their dedicated settings sections', async () => {
    const user = userEvent.setup();
    const engineManifest = normalizeThemeManifestDraft({
      id: 'steel-engine',
      name: 'Steel Engine',
      designTokens: [],
      layoutPrimitives: [],
      navigationPatterns: [],
      animationProfiles: [],
      iconPacks: [],
      renderStyles: [],
    });

    renderSettingsPage({
      appearancePacks: [
        {
          id: 'retro-burst',
          localId: 'retro-burst',
          name: 'Retro Burst',
          version: 1,
          directoryPath: 'appearance-packs/retro-burst',
          manifestPath: 'appearance-packs/retro-burst/appearance.json',
          description: 'Warm CRT palette.',
          tags: ['retro'],
          warnings: [],
          appearance: {
            id: 'retro-burst',
            name: 'Retro Burst',
            palette: {
              accent: '#ff8f3f',
            },
            fonts: {
              ui: 'IBM Plex Sans',
            },
          },
        },
      ],
      themeRecipePacks: [
        {
          id: 'glass-cockpit',
          localId: 'glass-cockpit',
          name: 'Glass Cockpit',
          version: 1,
          directoryPath: 'theme-recipes/glass-cockpit',
          manifestPath: 'theme-recipes/glass-cockpit/theme-recipe.json',
          description: 'Workbench-forward chrome recipe.',
          tags: ['glass'],
          warnings: [],
          recipe: {
            workbench: {} as never,
          },
        },
      ],
      themeEnginePacks: [
        {
          id: 'steel-engine',
          localId: 'steel-engine',
          name: 'Steel Engine',
          version: 1,
          directoryPath: 'theme-engines/steel-engine',
          manifestPath: 'theme-engines/steel-engine/theme-engine.json',
          description: 'Neutral engine defaults.',
          tags: ['engine'],
          warnings: [],
          composition: {},
          engineManifest,
          compiledEngineManifest: compileThemeEngineManifest(engineManifest),
        },
      ],
      shellRenderers: [
        {
          id: 'cinema-shell',
          localId: 'cinema-shell',
          name: 'Cinema Shell',
          version: 1,
          directoryPath: 'shell-renderers/cinema-shell',
          manifestPath: 'shell-renderers/cinema-shell/shell-renderer.json',
          description: 'Media-forward shell renderer.',
          tags: ['renderer'],
          warnings: [],
          entryModule: 'index.tsx',
        },
      ],
    });

    await user.click(findSectionButton('Appearance Packs'));
    await user.click(screen.getByRole('button', { name: /retro burst/i }));
    expect(useSettingsStore.getState().settings.appearance.activeAppearancePackId).toBe('retro-burst');

    await user.click(findSectionButton('Theme Recipes'));
    await user.click(screen.getByRole('button', { name: /glass cockpit/i }));
    expect(useSettingsStore.getState().settings.appearance.activeThemeRecipeId).toBe('glass-cockpit');

    await user.click(findSectionButton('Theme Engines'));
    await user.click(screen.getByRole('button', { name: /steel engine/i }));
    expect(useSettingsStore.getState().settings.appearance.activeThemeEngineId).toBe('steel-engine');

    await user.click(findSectionButton('Shell Renderers'));
    await user.click(screen.getByRole('button', { name: /cinema shell/i }));
    expect(useSettingsStore.getState().settings.appearance.activeShellRendererId).toBe('cinema-shell');

    const followThemeRendererButton = screen.getByText('Resolved Default Renderer').closest('button');
    if (!followThemeRendererButton) {
      throw new Error('Missing Follow Theme renderer button');
    }
    await user.click(followThemeRendererButton);
    expect(useSettingsStore.getState().settings.appearance.activeShellRendererId).toBeNull();
  }, 30000);

  it('keeps the live mobile QR cards visible in settings', async () => {
    useMobileShareStore.setState({
      phase: 'running',
      session: {
        sharePath: '/tmp/greeble-mobile',
        remoteAccessMode: 'lan',
        startedAt: Date.now(),
        preferredUrl: 'https://my.rig:8080',
        result: {
          address: 'http://192.168.1.4:8080',
          preferred_address: 'https://my.rig:8080',
          mdns_address: 'my.rig:8080',
          ios_address: 'https://my.rig:8080',
          tailscale_address: 'https://greeble-node.tailnet.ts.net:8080',
          tailscale_https_ready: true,
        },
        connectionTargets: [
          {
            id: 'lan-secure',
            label: 'LAN HTTPS',
            description: 'Local-network HTTPS route for Safari and nearby devices.',
            kind: 'lan',
            url: 'https://my.rig:8080',
            isPreferred: true,
          },
          {
            id: 'tailnet',
            label: 'Tailnet',
            description: 'Remote path over the active tailnet when Tailscale is connected.',
            kind: 'tailscale',
            url: 'https://greeble-node.tailnet.ts.net:8080',
            isPreferred: false,
          },
        ],
      },
      lastNotice: null,
      lastError: null,
      tailscaleStatus: null,
    });
    useSettingsStore.getState().setActiveSection('mobile');

    renderSettingsPage();

    expect(await screen.findByAltText('QR code for LAN HTTPS')).toBeInTheDocument();
    expect(await screen.findByAltText('QR code for Tailnet')).toBeInTheDocument();
    const showQrCodesButton = screen.getByRole('button', { name: /show qr codes/i });
    const copyUrlButton = screen.getAllByRole('button', { name: /copy url/i })[0];

    expect(showQrCodesButton).toHaveAttribute('data-interaction-motion-surface', 'actionButton');
    expect(copyUrlButton).toHaveAttribute('data-interaction-motion-surface', 'actionButton');

    const idleShowQrCodesButtonBoxShadow = showQrCodesButton.style.boxShadow;
    fireEvent.pointerEnter(showQrCodesButton);
    expect(showQrCodesButton.style.boxShadow).not.toBe(idleShowQrCodesButtonBoxShadow);

    const idleCopyUrlButtonBoxShadow = copyUrlButton.style.boxShadow;
    fireEvent.pointerEnter(copyUrlButton);
    expect(copyUrlButton.style.boxShadow).not.toBe(idleCopyUrlButtonBoxShadow);

    fireEvent.click(showQrCodesButton);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /close/i }))
      .toHaveAttribute('data-interaction-motion-surface', 'actionButton');
  }, 30000);

  it('shows a non-blocking Tailscale DNS note when Windows denies local DNS changes', async () => {
    const invokeMock = vi.mocked(invoke);
    const tailscaleStatus = {
      cliAvailable: true,
      version: '1.96.3',
      backendState: 'Running',
      connected: true,
      running: true,
      authUrl: null,
      hostname: 'TAYK47',
      dnsName: 'tayk47.tail04e752.ts.net',
      tailscaleIpv4: '100.79.119.3',
      tailscaleIpv6: 'fd7a:115c:a1e0::7901:7703',
      tailnetName: 'taylorofkipp@gmail.com',
      tailnetDomain: 'tail04e752.ts.net',
      magicDnsEnabled: true,
      certDomains: ['tayk47.tail04e752.ts.net'],
      certHttpsReady: true,
      peerCount: 7,
      onlinePeerCount: 1,
      userLoginName: 'taylorofkipp@gmail.com',
      userDisplayName: 'Taylor K',
      healthMessages: [],
      diagnosticMessage:
        'Windows blocked Tailscale from overriding local DNS, but mobile share can still use the active tailnet route at tayk47.tail04e752.ts.net.',
    };

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'tailscale_get_status') {
        return tailscaleStatus;
      }

      return null;
    });

    useSettingsStore.getState().setActiveSection('mobile');
    useMobileShareStore.setState({
      phase: 'idle',
      session: null,
      lastNotice: null,
      lastError: null,
      tailscaleStatus,
    });

    renderSettingsPage();

    expect(await screen.findByText(/Windows blocked Tailscale from overriding local DNS/i))
      .toBeInTheDocument();
    expect(screen.getByText(/Health:/i)).toHaveTextContent('Health: no active warnings');
    expect(screen.queryByText(/Access is denied\./i)).not.toBeInTheDocument();
  });

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

  it('organizes the settings rail into compact preference groups', () => {
    renderSettingsPage();

    const orderedCategories = [
      'Start',
      'Core Features',
      'Pipelines',
      'Connectivity',
      'Appearance',
      'Motion & Rendering',
      'Authoring',
    ];
    const allCategoryNodes = Array.from(document.querySelectorAll('[data-settings-rail-category]')) as HTMLElement[];
    const orderedCategoryNodes = orderedCategories.map(label => (
      allCategoryNodes.find(node => node.getAttribute('data-settings-rail-category') === label) ?? null
    ));

    orderedCategoryNodes.forEach(node => expect(node).not.toBeNull());

    for (let index = 0; index < orderedCategoryNodes.length - 1; index += 1) {
      const currentCategoryNode = orderedCategoryNodes[index];
      const nextCategoryNode = orderedCategoryNodes[index + 1];
      expect(currentCategoryNode).not.toBeNull();
      expect(nextCategoryNode).not.toBeNull();
      expect(
        (currentCategoryNode as HTMLElement).compareDocumentPosition(nextCategoryNode as Node)
          & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    const appearanceCategory = allCategoryNodes.find(node => node.getAttribute('data-settings-rail-category') === 'Appearance') ?? null;
    expect(appearanceCategory).not.toBeNull();
    expect(appearanceCategory).toContainElement(findSectionButton('Appearance'));
    expect(appearanceCategory).toContainElement(findSectionButton('Top Bars'));
    expect(appearanceCategory).toContainElement(findSectionButton('Icons'));

    const pipelineCategory = allCategoryNodes.find(node => node.getAttribute('data-settings-rail-category') === 'Pipelines') ?? null;
    expect(pipelineCategory).not.toBeNull();
    expect(pipelineCategory).toContainElement(findSectionButton('Models'));
    expect(pipelineCategory).toContainElement(findSectionButton('Audio'));

    const orderedButtons = [
      findSectionButton('System'),
      findSectionButton('Terminal'),
      findSectionButton('Explorer'),
      findSectionButton('Appearance'),
      findSectionButton('Shaders'),
      findSectionButton('Theme JSON'),
    ];

    for (let index = 0; index < orderedButtons.length - 1; index += 1) {
      expect(
        orderedButtons[index]?.compareDocumentPosition(orderedButtons[index + 1] as Node)
          & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('lets settings and plugin rail categories collapse through the shared disclosure group', async () => {
    const user = userEvent.setup();
    renderSettingsPage({
      pluginSettingsSlots: [TEST_PLUGIN_SETTINGS_SLOT],
    });

    const appearanceCategory = Array.from(
      document.querySelectorAll('[data-settings-rail-category]'),
    ).find(
      (node) => node.getAttribute('data-settings-rail-category') === 'Appearance',
    ) as HTMLElement | undefined;

    expect(appearanceCategory).toBeDefined();
    const appearanceToggle = within(appearanceCategory as HTMLElement).getByRole('button', {
      name: /appearance \d+ sections?/i,
    });
    expect(appearanceToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(appearanceToggle);

    expect(appearanceToggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(appearanceCategory as HTMLElement).queryByRole('button', {
        name: /^Top Bars$/i,
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Plugins Path' }));

    const pluginCategory = Array.from(
      document.querySelectorAll('[data-settings-rail-category]'),
    ).find(
      (node) => node.getAttribute('data-settings-rail-category') === 'Test Plugin',
    ) as HTMLElement | undefined;

    expect(pluginCategory).toBeDefined();
    const pluginToggle = within(pluginCategory as HTMLElement).getByRole('button', {
      name: /test plugin 1 slot/i,
    });
    expect(pluginToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(pluginToggle);

    expect(pluginToggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(pluginCategory as HTMLElement).queryByRole('button', {
        name: /main slot/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps the disabled screenshot suite out of the visible settings UI', () => {
    renderSettingsPage();

    const settingsShellText = document.body.textContent ?? '';

    expect(screen.queryByRole('button', { name: /screenshots/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Screenshots \+ Proof/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/screenshot proof/i)).not.toBeInTheDocument();
    expect(settingsShellText).not.toMatch(/screenshots/i);
  });

  it('splits the settings rail into settings and plugins paths', async () => {
    const user = userEvent.setup();
    renderSettingsPage({
      pluginSettingsSlots: [TEST_PLUGIN_SETTINGS_SLOT],
    });

    expect(screen.getByRole('button', { name: 'Settings Path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plugins Path' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /main slot/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Plugins Path' }));

    expect(screen.getByRole('button', { name: /main slot/i })).toBeInTheDocument();
    const pluginCategory = Array.from(
      document.querySelectorAll('[data-settings-rail-category]'),
    ).find(
      (node) => node.getAttribute('data-settings-rail-category') === 'Test Plugin',
    );
    expect(pluginCategory).not.toBeNull();
    expect(pluginCategory).toContainElement(
      screen.getByRole('button', { name: /main slot/i }),
    );
  });

  it('persists generated plugin settings through the shared settings store lane', async () => {
    const user = userEvent.setup();
    renderSettingsPage({
      pluginSettingsSlots: [TEST_PLUGIN_SETTINGS_SLOT],
    });

    await user.click(screen.getByRole('button', { name: 'Plugins Path' }));

    const enabledToggle = screen.getByRole('checkbox', { name: /enabled/i });
    const labelInput = screen.getByRole('textbox', { name: /label/i });

    expect(
      useSettingsStore.getState().settings.plugins.valuesByPluginId['test-plugin'],
    ).toBeUndefined();

    await user.click(enabledToggle);
    await user.clear(labelInput);
    await user.type(labelInput, 'smoke-lane');

    expect(
      useSettingsStore.getState().settings.plugins.valuesByPluginId['test-plugin'],
    ).toMatchObject({
      enabled: true,
      label: 'smoke-lane',
    });
  });

  it('renders plugin folder pickers, shared sliders, toggles, and extension buttons', async () => {
    const user = userEvent.setup();
    const openExplorerPickerMock = vi
      .spyOn(explorerPickerRuntime, 'openExplorerPicker')
      .mockResolvedValue({
        cancelled: false,
        completedAt: Date.now(),
        currentDirectory: 'C:/Pictures',
        entries: [
          { kind: 'folder', name: 'Pictures', path: 'C:/Pictures' },
          { kind: 'folder', name: 'Reference', path: 'D:/Reference' },
        ],
        nonce: 'picker-gallery-1',
      });

    renderSettingsPage({
      pluginSettingsSlots: [TEST_GALLERY_PLUGIN_SETTINGS_SLOT],
    });

    await user.click(screen.getByRole('button', { name: 'Plugins Path' }));

    expect(screen.getByText('Folder Paths')).toBeInTheDocument();
    expect(screen.getByText('File Types')).toBeInTheDocument();
    expect(screen.queryByText('Stored Payload')).not.toBeInTheDocument();
    expect(screen.queryByText('Field Catalog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add folder/i }));

    expect(openExplorerPickerMock).toHaveBeenCalledWith({
      kind: 'openFolders',
      presentation: 'window',
      title: 'Add Folder Paths',
      confirmLabel: 'Add Folders',
      allowCreateDirectory: true,
      startPath: null,
    });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.plugins.valuesByPluginId['gallery-plugin']).toMatchObject({
        rootPaths: 'C:/Pictures\nD:/Reference',
      });
    });

    const webpToggle = screen.getByRole('checkbox', { name: '.webp' });
    expect(webpToggle).not.toBeChecked();
    await user.click(webpToggle);

    const customExtensionsInput = screen.getByRole('textbox', { name: /custom extensions/i });
    await user.type(customExtensionsInput, 'heic, exr');

    expect(useSettingsStore.getState().settings.plugins.valuesByPluginId['gallery-plugin']).toMatchObject({
      fileExtensions: 'jpg, jpeg, png, webp, heic, exr',
    });

    const includeHiddenToggle = screen.getByRole('checkbox', { name: /include hidden files/i });
    await user.click(includeHiddenToggle);

    expect(useSettingsStore.getState().settings.plugins.valuesByPluginId['gallery-plugin']).toMatchObject({
      includeHidden: true,
    });
    expect(screen.getByRole('slider', { name: /result limit/i })).toBeInTheDocument();
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

    const squashSlider = screen.getByRole('slider', { name: /squash/i });
    squashSlider.focus();
    for (let stepIndex = 0; stepIndex < 12; stepIndex += 1) {
      await user.keyboard('{ArrowRight}');
    }

    const stepSlider = screen.getByRole('slider', { name: /step/i });
    stepSlider.focus();
    for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) {
      await user.keyboard('{ArrowRight}');
    }
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

  it('shows ZBrush-style layout customization actions before collapsed advanced physics', async () => {
    const user = userEvent.setup();

    useSettingsStore.getState().updateAppearance({
      layoutDynamicsPresetId: 'heavy-orbit',
      layoutDynamicsIntensity: 1.5,
      layoutDynamicsSurfaceOverrides: {
        workbenchTopBar: { enabled: false },
      },
      topBarLayoutSnapshotsById: {
        default: {
          entries: [
            {
              nodeId: 'search',
              bandId: 'leading',
              x: 24,
              y: 0,
            },
          ],
        },
      },
    });

    renderSettingsPage();

    await user.click(findSectionButton('Layout Customization'));

    expect(
      screen.getByRole('button', { name: /open explorer customize/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reset layout ui to canonical/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save current layout/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/movable surfaces/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Top Bar$/i).length).toBeGreaterThan(0);

    const advancedPhysics = document.querySelector(
      '[data-layout-customization-advanced]',
    ) as HTMLDetailsElement | null;
    expect(advancedPhysics).not.toBeNull();
    expect(advancedPhysics).not.toHaveAttribute('open');

    await user.click(
      advancedPhysics?.querySelector('summary') as HTMLElement,
    );

    const enabledToggle = screen.getByRole('checkbox', {
      name: /enable layout dynamics/i,
    });
    const explorerTopBarToggle = screen.getByRole('checkbox', {
      name: /enable explorer top bar layout dynamics/i,
    });

    expect(enabledToggle).toBeChecked();
    expect(explorerTopBarToggle).toBeChecked();

    const sharedIntensitySlider = screen.getByRole('slider', {
      name: /shared intensity/i,
    });
    sharedIntensitySlider.focus();
    for (let stepIndex = 0; stepIndex < 4; stepIndex += 1) {
      await user.keyboard('{ArrowRight}');
    }
    expect(
      useSettingsStore.getState().settings.appearance.layoutDynamicsIntensity,
    ).toBeGreaterThan(1);

    await user.click(explorerTopBarToggle);
    expect(
      useSettingsStore.getState().settings.appearance.layoutDynamicsSurfaceOverrides
        .explorerTopbar,
    ).toMatchObject({ enabled: false });

    await user.click(
      screen.getByRole('button', {
        name: /reset layout ui to canonical/i,
      }),
    );
    const resetSettings = useSettingsStore.getState().settings;
    expect(resetSettings.appearance.topBarLayoutSnapshotsById).toEqual({});
    expect(resetSettings.appearance.layoutDynamicsSurfaceOverrides).toEqual({});
    expect(resetSettings.appearance.layoutDynamicsPresetId).toBeNull();

    expect(
      document.querySelector(
        '[data-layout-dynamics-surface="settings-layout-dynamics-band"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '[data-layout-dynamics-surface="settings-layout-dynamics-free-2d"]',
      ),
    ).not.toBeNull();
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

  it('reveals developer test proof surfaces when the toggle is enabled', async () => {
    const user = userEvent.setup();

    useGpuRuntimeStore.setState(state => ({
      ...state,
      snapshot: {
        ...state.snapshot,
        effectiveTier: 'discrete',
        adapterName: 'Quadro RTX 3000',
        adapterType: 'discrete-gpu',
        backendName: 'vulkan',
        computeAvailable: true,
        workloads: [
          {
            workloadId: 'imageThumbnail',
            label: 'Image Thumbnail',
            ready: true,
            supportedTiers: ['integrated', 'discrete'],
            executions: 14,
            fallbackCount: 1,
            cachePolicy: 'reuse-artifacts',
            kernelLabels: ['thumbnail-rgba8', 'sampler-linear'],
            lastExecutionPath: 'gpu-discrete',
            lastFallbackReason: null,
            lastError: null,
          },
        ],
      },
    }));
    recordExplorerPerformanceSample({
      metricId: 'explorer_search',
      durationMs: 42,
      recordedAt: Date.UTC(2026, 3, 28, 16, 5, 0),
      metadata: {
        semanticSearch: true,
        semanticQueryKind: 'nearest-neighbor',
        semanticBackendKind: 'sqlite-vss',
        semanticProviderKind: 'cudaPython',
        semanticIndexedFileCount: 128,
        semanticIndexedChunkCount: 2048,
        semanticStaleIndex: false,
        semanticForcedCpu: false,
        resultCount: 24,
      },
    });

    renderSettingsPage();

    await user.click(findSectionButton('System'));
    expect(screen.queryByText('Developer Test Proofs')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Developer Test Settings' }));

    expect(await screen.findByText('Developer Test Proofs')).toBeInTheDocument();
    expect(screen.getByText('GPU Workload Proof')).toBeInTheDocument();
    expect(screen.getByText('Semantic Search Proof')).toBeInTheDocument();
    expect(screen.getAllByText(/Quadro RTX 3000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Image Thumbnail')).toBeInTheDocument();
    expect(screen.getAllByText(/exec 14/).length).toBeGreaterThan(0);
    expect(screen.getByText(/sqlite-vss \/ cudaPython/)).toBeInTheDocument();
    expect(screen.getAllByText(/nearest-neighbor/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Latest proof recorded 2026-04-28T16:05:00.000Z/)).toBeInTheDocument();
  });

  it('lets the dedicated context menu composer add plugin menu items and edit them inline on the menu row', async () => {
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

    await user.click(findSectionButton('Context Menus'));
    expect(screen.getByText('Context Menu Composer')).toBeInTheDocument();
    expect(screen.getByText('Menu Canvas')).toBeInTheDocument();
    expect(screen.getByText('Menu Library')).toBeInTheDocument();
    const activePackSelect = screen.getByRole('combobox', { name: 'Active Menu Pack' });
    expect(activePackSelect).toHaveValue(BUILT_IN_MENU_PACK_FIXTURES[0]?.id ?? '');

    const addCommandSelect = screen.getByRole('combobox', { name: 'Add Command' });
    await user.selectOptions(addCommandSelect, 'sample-plugin.context-menu.capture');
    await user.click(screen.getByRole('button', { name: 'Insert Command' }));

    expect(screen.getAllByText('Capture Memory Snapshot').length).toBeGreaterThan(0);

    const initialPluginEntry = useSettingsStore
      .getState()
      .settings.explorer.contextMenuLayoutOverridesByContext.entry?.entries
      .find((entry) => entry.kind === 'command' && entry.commandId === 'sample-plugin.context-menu.capture');
    expect(initialPluginEntry).toMatchObject({
      kind: 'command',
      commandId: 'sample-plugin.context-menu.capture',
      enabled: true,
    });
    if (!initialPluginEntry) {
      throw new Error('Expected plugin command entry override');
    }

    const enabledToggle = screen.getByRole('checkbox');
    expect(enabledToggle).toBeChecked();
    await user.click(enabledToggle);

    const disabledPluginEntry = useSettingsStore
      .getState()
      .settings.explorer.contextMenuLayoutOverridesByContext.entry?.entries
      .find((entry) => entry.kind === 'command' && entry.commandId === 'sample-plugin.context-menu.capture');
    expect(disabledPluginEntry).toMatchObject({
      kind: 'command',
      commandId: 'sample-plugin.context-menu.capture',
      enabled: false,
    });
    if (!disabledPluginEntry) {
      throw new Error('Expected disabled plugin command entry override');
    }

    await user.click(enabledToggle);
    const moveUpButton = screen.getByRole('button', { name: 'Nudge Up' });
    expect(moveUpButton).toBeEnabled();
  }, 30000);

  it('adds new command nodes into the selected folder inside the menu canvas', async () => {
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

    await user.click(findSectionButton('Context Menus'));
    await user.click(screen.getByRole('button', { name: 'Create Folder' }));

    const createdFolderEntry = useSettingsStore
      .getState()
      .settings.explorer.contextMenuLayoutOverridesByContext.entry?.entries
      .find((entry) => entry.kind === 'submenu');
    expect(createdFolderEntry).toBeDefined();

    const addCommandSelect = screen.getByRole('combobox', { name: 'Add Command' });
    await user.selectOptions(addCommandSelect, 'sample-plugin.context-menu.capture');
    await user.click(screen.getByRole('button', { name: 'Insert Command' }));

    const nestedCommandEntry = useSettingsStore
      .getState()
      .settings.explorer.contextMenuLayoutOverridesByContext.entry?.entries
      .find((entry) => entry.kind === 'command' && entry.commandId === 'sample-plugin.context-menu.capture');

    expect(nestedCommandEntry).toMatchObject({
      kind: 'command',
      commandId: 'sample-plugin.context-menu.capture',
      parentEntryId: createdFolderEntry?.id,
    });
  }, 30000);

  it('drops library commands into the open folder panel inside the menu canvas', async () => {
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

    await user.click(findSectionButton('Context Menus'));
    await user.click(screen.getByRole('button', { name: 'Create Folder' }));

    const createdFolderEntry = useSettingsStore
      .getState()
      .settings.explorer.contextMenuLayoutOverridesByContext.entry?.entries
      .find((entry) => entry.kind === 'submenu');
    if (!createdFolderEntry) {
      throw new Error('Expected created folder entry');
    }

    await waitFor(() => {
      expect(
        document.querySelectorAll('[data-draggable-panel-runtime-list-id]').length,
      ).toBeGreaterThanOrEqual(2);
    });

    const folderPanelList = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-draggable-panel-runtime-list-id]',
      ),
    ).find(
      (element) =>
        element.dataset.draggablePanelList !== 'context-menu-editor-root',
    );
    const folderEmptyState = document.querySelector<HTMLElement>(
      `[data-context-menu-canvas-empty="${createdFolderEntry.id}"]`,
    );
    if (
      !(folderPanelList instanceof HTMLElement) ||
      !(folderEmptyState instanceof HTMLElement)
    ) {
      throw new Error('Expected open folder panel in context menu canvas');
    }

    assignRect(folderPanelList, { top: 0, left: 0, width: 260, height: 220 });

    await user.type(
      screen.getByPlaceholderText('Search actions, commands, folders...'),
      'Capture',
    );

    const dragHandle = screen.getByRole('button', {
      name: 'Drag Capture Memory Snapshot into menu',
    });

    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => folderEmptyState),
    });

    try {
      fireEvent.pointerDown(dragHandle, {
        button: 0,
        pointerId: 7,
        clientX: 18,
        clientY: 18,
      });
      fireEvent.pointerMove(window, {
        pointerId: 7,
        clientX: 120,
        clientY: 84,
      });
      fireEvent.pointerUp(window, {
        pointerId: 7,
        clientX: 120,
        clientY: 84,
      });
    } finally {
      if (originalElementFromPoint) {
        Object.defineProperty(document, 'elementFromPoint', {
          configurable: true,
          value: originalElementFromPoint,
        });
      } else {
        Reflect.deleteProperty(document, 'elementFromPoint');
      }
    }

    const nestedCommandEntry = useSettingsStore
      .getState()
      .settings.explorer.contextMenuLayoutOverridesByContext.entry?.entries
      .find(
        (entry) =>
          entry.kind === 'command' &&
          entry.commandId === 'sample-plugin.context-menu.capture',
      );

    expect(nestedCommandEntry).toMatchObject({
      kind: 'command',
      commandId: 'sample-plugin.context-menu.capture',
      parentEntryId: createdFolderEntry.id,
    });
  }, 30000);

  it('opens the dedicated context menu section from the explorer CTA', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    await user.click(findSectionButton('Explorer'));
    await user.click(screen.getByRole('button', { name: 'Open Context Menus' }));

    expect(screen.getByText('Context Menu Composer')).toBeInTheDocument();
    expect(screen.getByText('Menu Canvas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Composer' })).toBeInTheDocument();
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

    const mobileBootToggle = screen.getByRole('checkbox', { name: /start mobile share on boot/i });

    await user.click(mobileBootToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.startMobileShareOnBoot).toBe(true);
    });

    await user.click(mobileBootToggle);
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.startMobileShareOnBoot).toBe(false);
    });

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
    expect(screen.getByText('Zoom App In')).toBeInTheDocument();
    expect(screen.getByText('Zoom App Out')).toBeInTheDocument();
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

    const mobileShareInput = screen.getByDisplayValue('Ctrl+Alt+Shift+M');
    await user.clear(mobileShareInput);
    await user.type(mobileShareInput, 'Ctrl + Alt + M');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.keybindings.mobileShareToggle).toBe('Ctrl+Alt+M');
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

    let workaroundMode: 'auto' | 'force-on' | 'force-off' = 'auto';

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'startup_get_linux_display_backend_status') {
        return {
          availableBackends: ['wayland', 'x11'],
          sessionBackend: 'wayland',
          activeBackend: 'x11',
          preferredBackend,
          autoX11FallbackActive: true,
          nvidiaGpuDetected: true,
          nvidiaWebkitWorkaroundMode: workaroundMode,
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
          nvidiaGpuDetected: true,
          nvidiaWebkitWorkaroundMode: workaroundMode,
        };
      }

      if (command === 'startup_set_linux_nvidia_webkit_workaround_mode') {
        workaroundMode = ((args as { workaroundMode?: typeof workaroundMode } | undefined)?.workaroundMode ?? 'auto');
        return {
          availableBackends: ['wayland', 'x11'],
          sessionBackend: 'wayland',
          activeBackend: 'x11',
          preferredBackend,
          autoX11FallbackActive: preferredBackend === 'auto',
          nvidiaGpuDetected: true,
          nvidiaWebkitWorkaroundMode: workaroundMode,
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

    const workaroundSelect = await screen.findByLabelText('NVIDIA WebKit Workaround');
    expect((workaroundSelect as HTMLSelectElement).value).toBe('auto');

    await user.selectOptions(workaroundSelect, 'force-off');

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.system.linuxNvidiaWebkitWorkaroundMode).toBe('force-off');
    });
    expect(invokeMock).toHaveBeenCalledWith('startup_set_linux_nvidia_webkit_workaround_mode', {
      workaroundMode: 'force-off',
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

  it('routes VST scan folder selection through the explorer picker window', async () => {
    const user = userEvent.setup();
    const openExplorerPickerMock = vi
      .spyOn(explorerPickerRuntime, 'openExplorerPicker')
      .mockResolvedValue({
        cancelled: false,
        completedAt: Date.now(),
        currentDirectory: '/plugins',
        entries: [
          { kind: 'folder', name: 'Glue', path: '/plugins/glue' },
          { kind: 'folder', name: 'Synth Rack', path: '/plugins/synth-rack' },
          { kind: 'folder', name: 'Synth Rack', path: '/plugins/synth-rack' },
        ],
        nonce: 'picker-audio-1',
      });

    useSettingsStore.getState().updateAudio({
      vst3AdditionalFolders: ['/plugins/glue'],
    });

    renderSettingsPage();

    await user.click(findSectionButton('Audio'));
    await user.click(screen.getByRole('button', { name: /Add Folder/i }));

    expect(openExplorerPickerMock).toHaveBeenCalledWith({
      kind: 'openFolders',
      presentation: 'window',
      title: 'Add VST Scan Folders',
      confirmLabel: 'Add Folders',
      allowCreateDirectory: false,
      startPath: '/plugins/glue',
    });

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.audio.vst3AdditionalFolders).toEqual([
        '/plugins/glue',
        '/plugins/synth-rack',
      ]);
    });
  });

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

  it('starts shell transition motion disabled and lets the animations panel enable it without clearing theme-driven selections', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    await user.click(findSectionButton('Animations'));

    const toggle = screen.getByRole('checkbox', { name: 'Enable shell transition animations' });
    expect(toggle).not.toBeChecked();
    expect(useSettingsStore.getState().settings.appearance.animations).toBe(false);
    expect(screen.getByText('Disabled by Default')).toBeInTheDocument();

    await user.click(toggle);

    expect(useSettingsStore.getState().settings.appearance.animations).toBe(true);
    expect(toggle).toBeChecked();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
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

    const dockThemeButtons = screen.getAllByRole('button', {
      name: /Vista Glass/i,
    });
    await user.click(dockThemeButtons[dockThemeButtons.length - 1] as HTMLButtonElement);

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.appearance).toMatchObject({
        activeThemeId: defaultSettings.appearance.activeThemeId,
        dockThemeMode: 'override',
        activeDockThemeId: 'vista-glass',
      });
    });
  }, 10000);

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

  it('imports a theme bundle manifest and persists it as a custom theme bundle', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    await user.click(findSectionButton('Theme JSON'));

    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({
          version: 1,
          id: 'sunset-inline',
          name: 'Sunset Inline',
          extends: 'operator',
          appearancePackId: 'appearance-base',
          embedded: {
            appearancePacks: [
              {
                id: 'appearance-base',
                name: 'Sunset Inline Appearance',
                extendsThemeId: 'operator',
                palette: {
                  accent: '#ff7a00',
                },
              },
            ],
          },
        }, null, 2),
      },
    });

    await user.click(screen.getByRole('button', { name: 'Import / Apply' }));

    await waitFor(() => {
      const appearanceSettings = useSettingsStore.getState().settings.appearance;
      expect(appearanceSettings.activeThemeId).toBe('sunset-inline');
      expect(appearanceSettings.customThemeBundles).toHaveLength(1);
      expect(appearanceSettings.customThemeBundles[0]?.id).toBe('sunset-inline');
      expect(appearanceSettings.customThemeBundles[0]?.embedded?.appearancePacks?.[0]?.palette?.accent).toBe('#ff7a00');
    });

    expect(screen.queryByText(/Theme import failed:/)).not.toBeInTheDocument();
  });

  it('rejects legacy monolithic theme JSON with a clear unsupported-format error', async () => {
    const user = userEvent.setup();

    renderSettingsPage();

    await user.click(findSectionButton('Theme JSON'));

    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({
          id: 'legacy-theme',
          name: 'Legacy Theme',
          palette: {
            accent: '#ff00aa',
          },
        }, null, 2),
      },
    });
    await user.click(screen.getByRole('button', { name: 'Import / Apply' }));

    expect(await screen.findByText(/Legacy monolithic theme JSON is unsupported/)).toBeInTheDocument();
    expect(useSettingsStore.getState().settings.appearance.customThemeBundles).toEqual([]);
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
