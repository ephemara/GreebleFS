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

vi.mock('../components/NotesManager', () => ({
  NotesManager: () => null,
}));

vi.mock('../components/ScreenshotsManager', () => ({
  ScreenshotsManager: () => null,
}));

vi.mock('../components/PluginsManager', () => ({
  FolderPluginRenderer: () => null,
}));

vi.mock('../components/SettingsPage', () => ({
  SettingsPage: () => null,
}));

import { createBuiltInPanelDefinitions } from '../panels/panelRegistry';

describe('createBuiltInPanelDefinitions', () => {
  it('keeps the explorer panel mounted so tab switches do not reset its state', () => {
    const panels = createBuiltInPanelDefinitions({
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
      explorerRepoPicker: null,
      isOpen: true,
      hideOverlay: () => {},
      pluginCommands: [],
      pluginExplorerActions: [],
      onOpenInTerminal: () => {},
      onAddBookmark: async () => {},
      onRequestRepositoryImport: () => {},
      pendingRepositoryImports: [],
      onPendingRepositoryImportsHandled: () => {},
      themePackages: [],
      themePackagesDirectory: 'themes',
      themePackagesLoading: false,
      themePackagesError: null,
      themePackagesWarnings: [],
      onRefreshThemes: async () => {},
      onOpenThemesFolder: async () => {},
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
      renderPluginsManager: () => null,
    });

    const explorer = panels.find(panel => panel.id === 'explorer');

    expect(explorer?.keepMounted).toBe(true);
  });

  it('forwards repository picker and source-control handoff props to the explorer and git panels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onRequestRepositoryImport = vi.fn();
    const onPendingRepositoryImportsHandled = vi.fn();
    const repositoryPicker = {
      active: true,
      allowMultiple: true,
      requestId: 7,
      onConfirm,
      onCancel,
    };
    const pendingRepositoryImports = ['C:\\repo\\nested'];

    const panels = createBuiltInPanelDefinitions({
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
      explorerRepoPicker: repositoryPicker,
      isOpen: true,
      hideOverlay: () => {},
      pluginCommands: [],
      pluginExplorerActions: [],
      onOpenInTerminal: () => {},
      onAddBookmark: async () => {},
      onRequestRepositoryImport,
      pendingRepositoryImports,
      onPendingRepositoryImportsHandled,
      themePackages: [],
      themePackagesDirectory: 'themes',
      themePackagesLoading: false,
      themePackagesError: null,
      themePackagesWarnings: [],
      onRefreshThemes: async () => {},
      onOpenThemesFolder: async () => {},
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
      renderPluginsManager: () => null,
    });

    const explorer = panels.find(panel => panel.id === 'explorer');
    const git = panels.find(panel => panel.id === 'git');

    const explorerElement = explorer?.render() as React.ReactElement<{ repositoryPicker: typeof repositoryPicker }>;
    const gitElement = git?.render() as React.ReactElement<{
      pendingRepositoryImports: string[];
      onPendingRepositoryImportsHandled: () => void;
      onRequestRepositoryImport: () => void;
    }>;

    expect(explorerElement.props.repositoryPicker).toBe(repositoryPicker);
    expect(gitElement.props.pendingRepositoryImports).toEqual(pendingRepositoryImports);
    expect(gitElement.props.onPendingRepositoryImportsHandled).toBe(onPendingRepositoryImportsHandled);
    expect(gitElement.props.onRequestRepositoryImport).toBe(onRequestRepositoryImport);
  });
});
