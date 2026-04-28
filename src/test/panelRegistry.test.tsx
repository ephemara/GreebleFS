import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/TerminalOverlay', () => ({
  default: () => null,
}));

vi.mock('../components/FileExplorer', () => ({
  FileExplorer: () => null,
}));

vi.mock('../components/GitManager', () => ({
  GitManager: () => null,
}));

vi.mock('../components/StoragePanel', () => ({
  StoragePanel: () => null,
}));

vi.mock('../components/NotesManager', () => ({
  NotesManager: () => null,
}));

vi.mock('../components/ScreenshotsManager', () => ({
  ScreenshotsManager: () => null,
}));

vi.mock('../components/GoRuntimeSmokePanel', () => ({
  GoRuntimeSmokePanel: () => null,
}));

vi.mock('../components/PluginsManager', () => ({
  FolderPluginRenderer: () => null,
}));

vi.mock('../components/SettingsPage', () => ({
  SettingsPage: () => null,
}));

import {
  buildBuiltInCatalog,
  buildWorkbenchSurfaceDefinitions,
  createBuiltInPanelDefinitions,
  createFolderPluginPanelDefinitions,
} from '../panels/panelRegistry';
import { iconThemeSystemConfig } from '../config/iconThemePackages';
import { topBarSystemConfig } from '../config/topBarPackages';

function createBuiltInPanelDefinitionArgs(
  overrides: Partial<Parameters<typeof createBuiltInPanelDefinitions>[0]> = {},
): Parameters<typeof createBuiltInPanelDefinitions>[0] {
  return {
    appearance: {
      theme: {
        palette: {
          accent: '#44ff88',
          appBackground: '#0a0a0a',
          panelBackground: '#101010',
          textPrimary: '#f5f5f5',
          border: '#2a2a2a',
          textMuted: '#9a9a9a',
        },
      },
    } as never,
    explorerLayoutMode: 'full',
    explorerPicker: null,
    isOpen: true,
    hideOverlay: () => {},
    pluginCommands: [],
    pluginExplorerActions: [],
    pluginContextMenuItems: [],
    onOpenInFilesystemAquarium: () => {},
    onOpenInTerminal: () => {},
    onAddBookmark: async () => {},
    onRequestRepositoryImport: () => {},
    pendingRepositoryImports: [],
    onPendingRepositoryImportsHandled: () => {},
    topBarPackages: [],
    topBarPackagesDirectory: topBarSystemConfig.topBarsDirectory,
    topBarPackagesLoading: false,
    topBarPackagesError: null,
    topBarPackagesWarnings: [],
    explorerLayouts: [],
    explorerLayoutsDirectory: 'explorer-layouts',
    explorerLayoutsLoading: false,
    explorerLayoutsError: null,
    explorerLayoutsWarnings: [],
    themePackages: [],
    themePackagesDirectory: 'themes',
    themePackagesLoading: false,
    themePackagesError: null,
    themePackagesWarnings: [],
    onRefreshThemes: async () => {},
    onOpenThemesFolder: async () => {},
    onRefreshTopBars: async () => {},
    onOpenTopBarsFolder: async () => {},
    iconThemePackages: [],
    iconThemePackagesDirectory: iconThemeSystemConfig.iconThemesDirectory,
    iconThemePackagesLoading: false,
    iconThemePackagesError: null,
    iconThemePackagesWarnings: [],
    onRefreshIconThemes: async () => {},
    onOpenIconThemesFolder: async () => {},
    shaders: [],
    shaderDiagnostics: [],
    shadersDirectory: 'shaders',
    shadersLoading: false,
    shadersError: null,
    onRefreshShaders: async () => {},
    onOpenShadersFolder: async () => {},
    animations: [],
    animationDiagnostics: [],
    animationsDirectory: 'animations',
    animationsLoading: false,
    animationsError: null,
    onRefreshAnimations: async () => {},
    onOpenAnimationsFolder: async () => {},
    wallpapers: [],
    wallpaperDiagnostics: [],
    wallpapersDirectory: 'wallpapers',
    wallpapersLoading: false,
    wallpapersError: null,
    onRefreshWallpapers: async () => {},
    onOpenWallpapersFolder: async () => {},
    onImportWallpaperFiles: async () => {},
    onSetWindowMode: async () => {},
    renderPluginsManager: () => null,
    ...overrides,
  };
}

function createPanelsForTest(
  overrides: Partial<Parameters<typeof createBuiltInPanelDefinitions>[0]> = {},
) {
  return createBuiltInPanelDefinitions(createBuiltInPanelDefinitionArgs(overrides));
}

describe('createBuiltInPanelDefinitions', () => {
  it('keeps the explorer panel mounted so tab switches do not reset its state', () => {
    const panels = createBuiltInPanelDefinitions(createBuiltInPanelDefinitionArgs());

    const explorer = panels.find(panel => panel.id === 'explorer');

    expect(explorer?.keepMounted).toBe(true);
  });

  it('registers storage as a first-class browse panel and keeps it mounted', () => {
    const panels = createBuiltInPanelDefinitions(createBuiltInPanelDefinitionArgs());

    const storage = panels.find(panel => panel.id === 'storage');

    expect(storage?.defaultOpen).toBe(true);
    expect(storage?.keepMounted).toBe(true);
    expect(storage?.navigation).toMatchObject({
      groupId: 'browse',
      itemOrder: 20,
    });
  });

  it('includes storage in the built-in panel catalog', () => {
    const catalog = buildBuiltInCatalog();
    expect(catalog.find((entry) => entry.id === 'storage')).toMatchObject({
      id: 'storage',
      label: 'Storage',
      kind: 'built-in-panel',
    });
  });

  it('registers the Go/Wasm smoke panel in both the shell definitions and panel catalog', () => {
    const panels = createPanelsForTest();
    const smokePanel = panels.find(panel => panel.id === 'go-sample-panel');
    const catalog = buildBuiltInCatalog();

    expect(smokePanel).toMatchObject({
      id: 'go-sample-panel',
      label: 'Go Wasm',
      keepMounted: true,
      dock: {
        defaultPlacement: 'right-sidebar',
        defaultVisibility: 'hidden',
      },
      navigation: {
        groupId: 'labs',
        groupLabel: 'Labs',
      },
    });
    expect(catalog.find(entry => entry.id === 'go-sample-panel')).toMatchObject({
      id: 'go-sample-panel',
      label: 'Go Wasm',
      kind: 'built-in-panel',
    });
  });

  it('forwards repository picker and source-control handoff props to the explorer and git panels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onRequestRepositoryImport = vi.fn();
    const onPendingRepositoryImportsHandled = vi.fn();
    const explorerPicker = {
      allowCreateDirectory: false,
      allowedExtensions: [],
      confirmLabel: 'Add Repositories',
      defaultExtension: null,
      initialFileName: null,
      kind: 'openFolders' as const,
      nonce: 'picker-7',
      presentation: 'embedded' as const,
      requestedAt: 7,
      sourceWindowLabel: 'main',
      startPath: 'C:\\repo',
      title: 'Import Git Repositories',
    };
    const pendingRepositoryImports = ['C:\\repo\\nested'];

    const panels = createBuiltInPanelDefinitions(createBuiltInPanelDefinitionArgs({
      explorerPicker,
      onRequestRepositoryImport,
      pendingRepositoryImports,
      onPendingRepositoryImportsHandled,
      onExplorerPickerConfirm: onConfirm,
      onExplorerPickerCancel: onCancel,
    }));

    const explorer = panels.find(panel => panel.id === 'explorer');
    const git = panels.find(panel => panel.id === 'git');

    const explorerElement = explorer?.render() as React.ReactElement<{ explorerPicker: typeof explorerPicker }>;
    const gitPanelElement = git?.render() as React.ReactElement<{ children: React.ReactNode }>;
    const gitElement = gitPanelElement.props.children as React.ReactElement<{
      pendingRepositoryImports: string[];
      onPendingRepositoryImportsHandled: () => void;
      onRequestRepositoryImport: () => void;
    }>;

    expect(explorerElement.props.explorerPicker).toBe(explorerPicker);
    expect(gitElement.props.pendingRepositoryImports).toEqual(pendingRepositoryImports);
    expect(gitElement.props.onPendingRepositoryImportsHandled).toBe(onPendingRepositoryImportsHandled);
    expect(gitElement.props.onRequestRepositoryImport).toBe(onRequestRepositoryImport);
  });

  it('biases IDE workbench surface defaults around explorer core and secondary utilities', () => {
    const surfaces = buildWorkbenchSurfaceDefinitions(createPanelsForTest());

    const explorer = surfaces.find(surface => surface.id === 'explorer');
    const terminal = surfaces.find(surface => surface.id === 'terminal');
    const git = surfaces.find(surface => surface.id === 'git');
    const storage = surfaces.find(surface => surface.id === 'storage');
    const settings = surfaces.find(surface => surface.id === 'settings');

    expect(explorer).toMatchObject({
      defaultDockPlacement: 'center',
      defaultVisibility: 'visible',
      ideRole: 'explorer-core',
      ideNavigationTier: 'primary',
    });
    expect(terminal).toMatchObject({
      defaultDockPlacement: 'bottom-panel',
      defaultVisibility: 'collapsed',
      ideRole: 'utility',
      ideNavigationTier: 'primary',
    });
    expect(git).toMatchObject({
      defaultDockPlacement: 'bottom-panel',
      defaultVisibility: 'collapsed',
      ideRole: 'utility',
      ideNavigationTier: 'primary',
    });
    expect(storage).toMatchObject({
      defaultDockPlacement: 'right-sidebar',
      defaultVisibility: 'hidden',
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    });
    expect(settings).toMatchObject({
      defaultDockPlacement: 'right-sidebar',
      defaultVisibility: 'hidden',
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    });
  });

  it('normalizes folder-plugin surfaces as hidden secondary utilities in IDE mode', () => {
    const pluginPanels = createFolderPluginPanelDefinitions({
      appearance: {
        theme: {
          palette: {
            accent: '#44ff88',
            appBackground: '#0a0a0a',
            panelBackground: '#101010',
            textPrimary: '#f5f5f5',
            border: '#2a2a2a',
            textMuted: '#9a9a9a',
          },
        },
      } as never,
      plugins: [
        {
          id: 'plugin.catalog',
          name: 'Plugin Catalog',
          description: 'Custom extension workspace.',
          defaultOpen: true,
          keepMounted: false,
          filePath: '/tmp/plugin.catalog',
        } as never,
      ],
      createPluginApi: () => ({}) as never,
    });

    const [surface] = buildWorkbenchSurfaceDefinitions(pluginPanels);

    expect(surface).toMatchObject({
      id: 'plugin.catalog',
      defaultDockPlacement: 'right-sidebar',
      defaultVisibility: 'hidden',
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
    });
  });
});
