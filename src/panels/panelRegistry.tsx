import React from 'react';
import { Terminal as TerminalIcon, FolderOpen, GitBranch, StickyNote, Camera, Puzzle, SlidersHorizontal, HardDrive } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import TerminalOverlay from '../components/TerminalOverlay';
import { ExplorerWorkspace } from '../components/explorer/ExplorerWorkspace';
import { FolderPluginRenderer } from '../components/PluginsManager';
import type { LoadedOverlayAnimation } from '../components/animationRuntime';
import type { LoadedOverlayShader } from '../components/shaderRuntime';
import type { LoadedOverlayWallpaper } from '../components/wallpaperRuntime';
import type { ExplorerLayoutMode } from '../config/layoutProfiles';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type { TerminalWindowMode } from '../store/settingsStore';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginContext,
} from '../components/pluginRuntime';

const LazyGitManager = React.lazy(async () => {
  const module = await import('../components/GitManager');
  return { default: module.GitManager };
});

const LazyNotesManager = React.lazy(async () => {
  const module = await import('../components/NotesManager');
  return { default: module.NotesManager };
});

const LazyScreenshotsManager = React.lazy(async () => {
  const module = await import('../components/ScreenshotsManager');
  return { default: module.ScreenshotsManager };
});

const LazySettingsPage = React.lazy(async () => {
  const module = await import('../components/SettingsPage');
  return { default: module.SettingsPage };
});

const LazyStoragePanel = React.lazy(async () => {
  const module = await import('../components/StoragePanel');
  return { default: module.StoragePanel };
});

function DeferredPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={(
      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          color: 'var(--overlay-text-muted)',
          fontSize: 12,
          background: 'var(--overlay-bg-panel)',
        }}
      >
        Loading panel...
      </div>
    )}
    >
      {children}
    </React.Suspense>
  );
}

// Prevent keep-mounted heavy panels from rerendering on unrelated App state updates.
const MemoTerminalOverlay = React.memo(TerminalOverlay);
MemoTerminalOverlay.displayName = 'MemoTerminalOverlay';
const MemoExplorerWorkspace = React.memo(ExplorerWorkspace);
MemoExplorerWorkspace.displayName = 'MemoExplorerWorkspace';

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
  navigation?: {
    groupId: string;
    groupLabel: string;
    groupOrder?: number;
    itemOrder?: number;
  };
  render: () => React.ReactNode;
}

export function createBuiltInPanelDefinitions({
  appearance,
  explorerChromeControlSurface,
  explorerLayoutMode,
  explorerRepoPicker,
  isOpen,
  hideOverlay,
  pluginCommands,
  pluginExplorerActions,
  pluginContextMenuItems,
  onOpenInTerminal,
  onOpenInFilesystemAquarium,
  onAddBookmark,
  onRequestRepositoryImport,
  pendingRepositoryImports,
  onPendingRepositoryImportsHandled,
  themePackages,
  themePackagesDirectory,
  themePackagesLoading,
  themePackagesError,
  themePackagesWarnings,
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
  wallpapers,
  wallpaperDiagnostics,
  wallpapersDirectory,
  wallpapersLoading,
  wallpapersError,
  onRefreshWallpapers,
  onOpenWallpapersFolder,
  onImportWallpaperFiles,
  onSetWindowMode,
  renderPluginsManager,
}: {
  appearance: ResolvedOverlayAppearance;
  explorerChromeControlSurface?: 'toolbar' | 'topbar';
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
  pluginContextMenuItems: OverlayPluginContextMenuContribution[];
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium: (path: string) => void;
  onAddBookmark: (name: string, path: string) => Promise<void>;
  onRequestRepositoryImport: () => void;
  pendingRepositoryImports: string[];
  onPendingRepositoryImportsHandled: () => void;
  themePackages: LoadedOverlayThemePackage[];
  themePackagesDirectory: string;
  themePackagesLoading: boolean;
  themePackagesError: string | null;
  themePackagesWarnings: string[];
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
  wallpapers: LoadedOverlayWallpaper[];
  wallpaperDiagnostics: LoadedOverlayWallpaper[];
  wallpapersDirectory: string;
  wallpapersLoading: boolean;
  wallpapersError: string | null;
  onRefreshWallpapers: () => Promise<void>;
  onOpenWallpapersFolder: () => Promise<void>;
  onImportWallpaperFiles: (files: File[]) => Promise<void>;
  onSetWindowMode: (mode: TerminalWindowMode) => Promise<void> | void;
  renderPluginsManager: () => React.ReactNode;
}): OverlayPanelDefinition[] {
  const accent = appearance.theme.palette.accent;
  const explorerTheme = {
    accent,
    bg: appearance.theme.palette.shellBackground,
    bgPanel: appearance.theme.palette.panelBackground,
    text: appearance.theme.palette.textPrimary,
    border: appearance.theme.palette.border,
    textMuted: appearance.theme.palette.textMuted,
  };

  return [
    {
      id: 'explorer',
      label: 'Explorer',
      kind: 'built-in-panel',
      icon: <FolderOpen size={12} />,
      description: 'File browser and asset navigation.',
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'browse',
        groupLabel: 'Browse',
        groupOrder: 10,
        itemOrder: 10,
      },
      render: () => (
        <MemoExplorerWorkspace
          appearance={appearance}
          chromeControlSurface={explorerChromeControlSurface}
          layoutMode={explorerLayoutMode}
          repositoryPicker={explorerRepoPicker}
          theme={explorerTheme}
          onOpenInTerminal={onOpenInTerminal}
          onOpenInFilesystemAquarium={onOpenInFilesystemAquarium}
          onAddBookmark={onAddBookmark}
          pluginActions={pluginExplorerActions}
          pluginContextMenuItems={pluginContextMenuItems}
        />
      ),
    },
    {
      id: 'storage',
      label: 'Storage',
      kind: 'built-in-panel',
      icon: <HardDrive size={12} />,
      description: 'Drive treemap, storage forensics, and destructive cleanup.',
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'browse',
        groupLabel: 'Browse',
        groupOrder: 10,
        itemOrder: 20,
      },
      render: () => (
        <DeferredPanel>
          <LazyStoragePanel />
        </DeferredPanel>
      ),
    },
    {
      id: 'terminal',
      label: 'Terminal',
      kind: 'built-in-panel',
      icon: <TerminalIcon size={12} />,
      description: 'Primary command workspace.',
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
        groupOrder: 20,
        itemOrder: 10,
      },
      render: () => (
        <MemoTerminalOverlay
          isOpen={isOpen}
          onClose={hideOverlay}
          embedded
          appearance={appearance}
          pluginCommands={pluginCommands}
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
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
        groupOrder: 20,
        itemOrder: 20,
      },
      render: () => (
        <DeferredPanel>
          <LazyGitManager
            appearance={appearance}
            pendingRepositoryImports={pendingRepositoryImports}
            onPendingRepositoryImportsHandled={onPendingRepositoryImportsHandled}
            onRequestRepositoryImport={onRequestRepositoryImport}
          />
        </DeferredPanel>
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      kind: 'built-in-panel',
      icon: <StickyNote size={12} />,
      description: 'Scratchpads and structured notes.',
      defaultOpen: true,
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
        groupOrder: 20,
        itemOrder: 30,
      },
      render: () => (
        <DeferredPanel>
          <LazyNotesManager appearance={appearance} />
        </DeferredPanel>
      ),
    },
    {
      id: 'screenshots',
      label: 'Screenshots',
      kind: 'built-in-panel',
      icon: <Camera size={12} />,
      description: 'Built-in example plugin for capture and clipboard workflows.',
      defaultOpen: true,
      navigation: {
        groupId: 'capture',
        groupLabel: 'Capture',
        groupOrder: 30,
        itemOrder: 10,
      },
      render: () => (
        <DeferredPanel>
          <LazyScreenshotsManager appearance={appearance} />
        </DeferredPanel>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      kind: 'built-in-panel',
      icon: <SlidersHorizontal size={12} />,
      description: 'Application-wide appearance, terminal, and explorer settings.',
      defaultOpen: false,
      navigation: {
        groupId: 'system',
        groupLabel: 'System',
        groupOrder: 50,
        itemOrder: 10,
      },
      render: () => (
        <DeferredPanel>
          <LazySettingsPage
            appearance={appearance}
            themePackages={themePackages}
            themePackagesDirectory={themePackagesDirectory}
            themePackagesLoading={themePackagesLoading}
            themePackagesError={themePackagesError}
            themePackagesWarnings={themePackagesWarnings}
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
            wallpapers={wallpapers}
            wallpaperDiagnostics={wallpaperDiagnostics}
            wallpapersDirectory={wallpapersDirectory}
            wallpapersLoading={wallpapersLoading}
            wallpapersError={wallpapersError}
            onRefreshWallpapers={onRefreshWallpapers}
            onOpenWallpapersFolder={onOpenWallpapersFolder}
            onImportWallpaperFiles={onImportWallpaperFiles}
            onSetWindowMode={onSetWindowMode}
            pluginContextMenuItems={pluginContextMenuItems}
            pluginExplorerActions={pluginExplorerActions}
          />
        </DeferredPanel>
      ),
    },
    {
      id: 'plugins',
      label: 'Plugins',
      kind: 'built-in-panel',
      icon: <Puzzle size={12} />,
      description: 'Plugin browser and drop-in loader workspace.',
      defaultOpen: true,
      navigation: {
        groupId: 'extensions',
        groupLabel: 'Extensions',
        groupOrder: 40,
        itemOrder: 10,
      },
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
    navigation: {
      groupId: 'extensions',
      groupLabel: 'Extensions',
      groupOrder: 40,
    },
    render: () => (
      <FolderPluginRenderer
        plugin={plugin}
        appearance={appearance}
        createPluginApi={createPluginApi}
        hostMode="panel-tab"
        isActive
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
      id: 'storage',
      label: 'Storage',
      description: 'Built-in panel plugin for storage scanning and cleanup.',
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
