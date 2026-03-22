import React from 'react';
import { Terminal as TerminalIcon, FolderOpen, GitBranch, StickyNote, Camera, Puzzle, SlidersHorizontal } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import TerminalOverlay from '../components/TerminalOverlay';
import { FileExplorer } from '../components/FileExplorer';
import { GitManager } from '../components/GitManager';
import { NotesManager } from '../components/NotesManager';
import { ScreenshotsManager } from '../components/ScreenshotsManager';
import { FolderPluginRenderer } from '../components/PluginsManager';
import { SettingsPage } from '../components/SettingsPage';
import type { LoadedOverlayAnimation } from '../components/animationRuntime';
import type { LoadedOverlayShader } from '../components/shaderRuntime';
import type { ExplorerLayoutMode } from '../config/layoutProfiles';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginContext,
} from '../components/pluginRuntime';

export interface PanelCatalogEntry {
  id: string;
  label: string;
  description: string;
  kind: 'built-in-panel' | 'folder-plugin';
  example?: boolean;
}

export interface OverlayPanelDefinition {
  id: string;
  label: string;
  kind: 'built-in-panel' | 'folder-plugin';
  icon: React.ReactNode;
  description: string;
  defaultOpen: boolean;
  keepMounted?: boolean;
  render: () => React.ReactNode;
}

export function createBuiltInPanelDefinitions({
  appearance,
  explorerLayoutMode,
  explorerRepoPicker,
  isOpen,
  hideOverlay,
  pluginCommands,
  pluginExplorerActions,
  onOpenInTerminal,
  onAddBookmark,
  onRequestRepositoryImport,
  pendingRepositoryImports,
  onPendingRepositoryImportsHandled,
  themePackages,
  themePackagesDirectory,
  themePackagesLoading,
  themePackagesError,
  onRefreshThemes,
  onOpenThemesFolder,
  shaders,
  shaderDiagnostics,
  shadersDirectory,
  shadersLoading,
  shadersError,
  onRefreshShaders,
  onOpenShadersFolder,
  animations,
  animationDiagnostics,
  animationsDirectory,
  animationsLoading,
  animationsError,
  onRefreshAnimations,
  onOpenAnimationsFolder,
  renderPluginsManager,
}: {
  appearance: ResolvedOverlayAppearance;
  explorerLayoutMode?: ExplorerLayoutMode;
  explorerRepoPicker?: {
    active: boolean;
    allowMultiple: boolean;
    requestId: number;
    onConfirm: (paths: string[]) => void;
    onCancel: () => void;
  } | null;
  isOpen: boolean;
  hideOverlay: () => void;
  pluginCommands: OverlayPluginCommandContribution[];
  pluginExplorerActions: OverlayPluginExplorerActionContribution[];
  onOpenInTerminal: (path: string) => void;
  onAddBookmark: (name: string, path: string) => Promise<void>;
  onRequestRepositoryImport: () => void;
  pendingRepositoryImports: string[];
  onPendingRepositoryImportsHandled: () => void;
  themePackages: LoadedOverlayThemePackage[];
  themePackagesDirectory: string;
  themePackagesLoading: boolean;
  themePackagesError: string | null;
  onRefreshThemes: () => Promise<void>;
  onOpenThemesFolder: () => Promise<void>;
  shaders: LoadedOverlayShader[];
  shaderDiagnostics: LoadedOverlayShader[];
  shadersDirectory: string;
  shadersLoading: boolean;
  shadersError: string | null;
  onRefreshShaders: () => Promise<void>;
  onOpenShadersFolder: () => Promise<void>;
  animations: LoadedOverlayAnimation[];
  animationDiagnostics: LoadedOverlayAnimation[];
  animationsDirectory: string;
  animationsLoading: boolean;
  animationsError: string | null;
  onRefreshAnimations: () => Promise<void>;
  onOpenAnimationsFolder: () => Promise<void>;
  renderPluginsManager: () => React.ReactNode;
}): OverlayPanelDefinition[] {
  const accent = appearance.theme.palette.accent;

  return [
    {
      id: 'terminal',
      label: 'Terminal',
      kind: 'built-in-panel',
      icon: <TerminalIcon size={12} />,
      description: 'Primary command workspace.',
      defaultOpen: true,
      keepMounted: true,
      render: () => (
        <TerminalOverlay
          isOpen={isOpen}
          onClose={hideOverlay}
          embedded
          appearance={appearance}
          pluginCommands={pluginCommands}
        />
      ),
    },
    {
      id: 'explorer',
      label: 'Explorer',
      kind: 'built-in-panel',
      icon: <FolderOpen size={12} />,
      description: 'File browser and asset navigation.',
      defaultOpen: true,
      keepMounted: true,
      render: () => (
        <FileExplorer
          appearance={appearance}
          layoutMode={explorerLayoutMode}
          repositoryPicker={explorerRepoPicker}
          theme={{
            accent,
            bg: appearance.theme.palette.shellBackground,
            bgPanel: appearance.theme.palette.panelBackground,
            text: appearance.theme.palette.textPrimary,
            border: appearance.theme.palette.border,
            textMuted: appearance.theme.palette.textMuted,
          }}
          onOpenInTerminal={onOpenInTerminal}
          onAddBookmark={onAddBookmark}
          pluginActions={pluginExplorerActions}
        />
      ),
    },
    {
      id: 'git',
      label: 'Source',
      kind: 'built-in-panel',
      icon: <GitBranch size={12} />,
      description: 'Git tools and diff management.',
      defaultOpen: true,
      render: () => (
        <GitManager
          appearance={appearance}
          pendingRepositoryImports={pendingRepositoryImports}
          onPendingRepositoryImportsHandled={onPendingRepositoryImportsHandled}
          onRequestRepositoryImport={onRequestRepositoryImport}
        />
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      kind: 'built-in-panel',
      icon: <StickyNote size={12} />,
      description: 'Scratchpads and structured notes.',
      defaultOpen: true,
      render: () => <NotesManager appearance={appearance} />,
    },
    {
      id: 'screenshots',
      label: 'Screenshots',
      kind: 'built-in-panel',
      icon: <Camera size={12} />,
      description: 'Built-in example plugin for capture and clipboard workflows.',
      defaultOpen: true,
      render: () => <ScreenshotsManager appearance={appearance} />,
    },
    {
      id: 'settings',
      label: 'Settings',
      kind: 'built-in-panel',
      icon: <SlidersHorizontal size={12} />,
      description: 'Application-wide appearance, terminal, and explorer settings.',
      defaultOpen: false,
      render: () => (
        <SettingsPage
          appearance={appearance}
          themePackages={themePackages}
          themePackagesDirectory={themePackagesDirectory}
          themePackagesLoading={themePackagesLoading}
          themePackagesError={themePackagesError}
          onRefreshThemes={onRefreshThemes}
          onOpenThemesFolder={onOpenThemesFolder}
          shaders={shaders}
          shaderDiagnostics={shaderDiagnostics}
          shadersDirectory={shadersDirectory}
          shadersLoading={shadersLoading}
          shadersError={shadersError}
          onRefreshShaders={onRefreshShaders}
          onOpenShadersFolder={onOpenShadersFolder}
          animations={animations}
          animationDiagnostics={animationDiagnostics}
          animationsDirectory={animationsDirectory}
          animationsLoading={animationsLoading}
          animationsError={animationsError}
          onRefreshAnimations={onRefreshAnimations}
          onOpenAnimationsFolder={onOpenAnimationsFolder}
        />
      ),
    },
    {
      id: 'plugins',
      label: 'Plugins',
      kind: 'built-in-panel',
      icon: <Puzzle size={12} />,
      description: 'Plugin browser and drop-in loader workspace.',
      defaultOpen: true,
      render: renderPluginsManager,
    },
  ];
}

export function createFolderPluginPanelDefinitions({
  appearance,
  plugins,
  createPluginApi,
}: {
  appearance: ResolvedOverlayAppearance;
  plugins: LoadedOverlayPlugin[];
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
}): OverlayPanelDefinition[] {
  return plugins.map(plugin => ({
    id: plugin.id,
    label: plugin.name,
    kind: 'folder-plugin',
    icon: <Puzzle size={12} />,
    description: plugin.description ?? `Folder plugin loaded from ${plugin.filePath}.`,
    defaultOpen: plugin.defaultOpen,
    keepMounted: plugin.keepMounted,
    render: () => (
      <FolderPluginRenderer
        plugin={plugin}
        appearance={appearance}
        createPluginApi={createPluginApi}
        hostMode="panel-tab"
      />
    ),
  }));
}

export function buildBuiltInCatalog(): PanelCatalogEntry[] {
  return [
    {
      id: 'terminal',
      label: 'Terminal',
      description: 'Built-in panel plugin for terminal sessions.',
      kind: 'built-in-panel',
    },
    {
      id: 'explorer',
      label: 'Explorer',
      description: 'Built-in panel plugin for file browsing.',
      kind: 'built-in-panel',
    },
    {
      id: 'git',
      label: 'Source',
      description: 'Built-in panel plugin for Git workflows.',
      kind: 'built-in-panel',
    },
    {
      id: 'notes',
      label: 'Notes',
      description: 'Built-in panel plugin for note taking.',
      kind: 'built-in-panel',
    },
    {
      id: 'screenshots',
      label: 'Screenshots',
      description: 'Built-in example plugin showing capture, clipboard, and file IO.',
      kind: 'built-in-panel',
      example: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Built-in panel plugin for application-wide settings.',
      kind: 'built-in-panel',
    },
    {
      id: 'plugins',
      label: 'Plugins',
      description: 'Built-in panel plugin for managing folder plugins.',
      kind: 'built-in-panel',
    },
  ];
}
