import React from 'react';
import { Terminal as TerminalIcon, FolderOpen, GitBranch, StickyNote, Puzzle, HardDrive, Settings2, Cpu, ThemedPanelIcon } from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { LoadedActionPack, LoadedExplorerAction } from '../config/actionPacks';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActivityLaneContribution,
  OverlayPluginExplorerActionContribution,
  OverlayPluginExplorerViewContribution,
  OverlayPluginExplorerWidgetContribution,
  OverlayPluginPreviewLaneContribution,
  OverlayPluginSettingsSlotContribution,
  OverlayPluginWorkflowContribution,
} from '../config/pluginContributions';
import TerminalOverlay from '../components/TerminalOverlay';
import { ExplorerWorkspace } from '../components/explorer/ExplorerWorkspace';
import type { ExplorerDockPreviewPolicy } from '../components/FileExplorer';
import { FolderPluginRenderer } from '../components/PluginsManager';
import type { LoadedOverlayAnimation } from '../components/animationRuntime';
import type { LoadedOverlayShader } from '../components/shaderRuntime';
import type { LoadedOverlayWallpaper } from '../components/wallpaperRuntime';
import type { ExplorerLayoutMode } from '../config/layoutProfiles';
import type { ExplorerModeProfileId } from '../config/explorerModeProfiles';
import type { LoadedExplorerHomePack } from '../config/homePackages';
import type { LoadedExplorerMenuPack } from '../config/menuPacks';
import type { LoadedOverlaySoundPack } from '../config/soundPacks';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type {
  LoadedThemeAppearancePack,
  LoadedThemeEnginePack,
  LoadedThemeInteractionMotionPack,
  LoadedThemeRecipePack,
  LoadedThemeShellRendererPack,
} from '../config/themeBundlePacks';
import type { LoadedOverlayTopBarPackage } from '../config/topBarPackages';
import type { LoadedDockPresentationPackage } from '../config/dockPresentations';
import type { LoadedExplorerLayoutDefinition } from '../config/explorerLayouts';
import type { LoadedExplorerViewDefinition } from '../config/explorerViews';
import type { LoadedExplorerWidgetDefinition } from '../config/explorerWidgets';
import {
  iconThemeSystemConfig,
  type LoadedIconThemePackage,
} from '../config/iconThemePackages';
import type {
  DockStackPlacement,
  WorkbenchSurfaceDefaultVisibility,
  WorkbenchSurfaceIdeRole,
} from '../config/ideWorkbenchLayout';
import {
  buildBuiltInPanelCatalogFromLattice,
  getBuiltInPanelLatticeDescriptor,
  type BuiltInPanelId,
  type BuiltInPanelLatticeDescriptor,
} from '../config/panelLatticeRegistry';
import type { TerminalWindowMode } from '../store/settingsStore';
import type { SettingsSectionKey } from '../config/settingsNavigation';
import type { ExplorerPickerRequest } from '../runtime/explorerPicker';
import type { UsrProfileRuntimeSnapshot } from '../runtime/usrProfiles';
import type { KainUiGraph } from '../runtime/kainUiGraph';
import type { KainAppManifest } from '../runtime/kainManifest';
import type { KainUiScaffold } from '../runtime/kainUiScaffold';
import type { KainLatticeCatalog } from '../runtime/kainLatticeCatalog';
import type { KainFfiCatalog } from '../runtime/kainFfiCatalog';
import type { KainPluginCatalog } from '../runtime/kainPluginCatalog';
import type { UsrProfileSettingsVariantDefinition } from '../config/usrProfileSettingsVariants';
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

const LazySettingsPage = React.lazy(async () => {
  const module = await import('../components/SettingsPage');
  return { default: module.SettingsPage };
});

const LazyStoragePanel = React.lazy(async () => {
  const module = await import('../components/StoragePanel');
  return { default: module.StoragePanel };
});

const LazyGoRuntimeSmokePanel = React.lazy(async () => {
  const module = await import('../components/GoRuntimeSmokePanel');
  return { default: module.GoRuntimeSmokePanel };
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

export type WorkbenchSurfacePresentation = 'stack' | 'floating' | 'native-window';

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
  dock?: {
    defaultPlacement: DockStackPlacement;
    defaultOrder: number;
    defaultVisibility: WorkbenchSurfaceDefaultVisibility;
    allowedPresentations?: WorkbenchSurfacePresentation[];
    railShortcut?: boolean;
    ideRole?: WorkbenchSurfaceIdeRole;
    ideNavigationTier?: 'primary' | 'secondary';
  };
  render: () => React.ReactNode;
}

export interface WorkbenchSurfaceDefinition {
  id: string;
  label: string;
  kind: 'built-in-panel' | 'folder-plugin';
  icon: React.ReactNode;
  description: string;
  keepMounted: boolean;
  navigation?: OverlayPanelDefinition['navigation'];
  defaultDockPlacement: DockStackPlacement;
  defaultOrder: number;
  defaultVisibility: WorkbenchSurfaceDefaultVisibility;
  allowedPresentations: WorkbenchSurfacePresentation[];
  railShortcut: boolean;
  ideRole: WorkbenchSurfaceIdeRole;
  ideNavigationTier: 'primary' | 'secondary';
  render: () => React.ReactNode;
}

function createWorkbenchSurfaceDefinition(
  panel: OverlayPanelDefinition,
): WorkbenchSurfaceDefinition {
  const allowedPresentations = panel.dock?.allowedPresentations ?? ['stack', 'floating'];
  const supportsNativeWindow = panel.id !== 'explorer' && !allowedPresentations.includes('native-window');
  return {
    id: panel.id,
    label: panel.label,
    kind: panel.kind,
    icon: panel.icon,
    description: panel.description,
    keepMounted: panel.keepMounted === true,
    navigation: panel.navigation,
    defaultDockPlacement: panel.dock?.defaultPlacement ?? 'right-sidebar',
    defaultOrder: panel.dock?.defaultOrder ?? panel.navigation?.itemOrder ?? 999,
    defaultVisibility: panel.dock?.defaultVisibility ?? 'hidden',
    allowedPresentations: supportsNativeWindow
      ? [...allowedPresentations, 'native-window']
      : allowedPresentations,
    railShortcut: panel.dock?.railShortcut ?? true,
    ideRole: panel.dock?.ideRole ?? 'utility',
    ideNavigationTier: panel.dock?.ideNavigationTier ?? 'secondary',
    render: panel.render,
  };
}

export function buildWorkbenchSurfaceDefinitions(
  panels: OverlayPanelDefinition[],
): WorkbenchSurfaceDefinition[] {
  return panels
    .map(createWorkbenchSurfaceDefinition)
    .sort((left, right) => {
      if (left.defaultOrder !== right.defaultOrder) {
        return left.defaultOrder - right.defaultOrder;
      }
      return left.label.localeCompare(right.label);
    });
}

const BUILT_IN_PANEL_FALLBACK_ICONS = {
  explorer: FolderOpen,
  storage: HardDrive,
  terminal: TerminalIcon,
  git: GitBranch,
  notes: StickyNote,
  'go-sample-panel': Cpu,
  settings: Settings2,
  plugins: Puzzle,
} satisfies Record<BuiltInPanelId, React.ElementType>;

function buildBuiltInPanelIcon(descriptor: BuiltInPanelLatticeDescriptor): React.ReactNode {
  return (
    <ThemedPanelIcon
      panelId={descriptor.id}
      fallbackSlotId={descriptor.icon.fallbackSlotId}
      fallbackIcon={BUILT_IN_PANEL_FALLBACK_ICONS[descriptor.id]}
      size={12}
    />
  );
}

function applyBuiltInPanelLatticeDescriptor(
  panel: OverlayPanelDefinition,
): OverlayPanelDefinition {
  const descriptor = getBuiltInPanelLatticeDescriptor(panel.id);
  if (!descriptor) {
    return panel;
  }

  return {
    ...panel,
    id: descriptor.id,
    label: descriptor.label,
    description: descriptor.description,
    defaultOpen: descriptor.defaultOpen,
    keepMounted: descriptor.keepMounted,
    icon: buildBuiltInPanelIcon(descriptor),
    navigation: { ...descriptor.navigation },
    dock: {
      defaultPlacement: descriptor.dock.defaultPlacement,
      defaultOrder: descriptor.dock.defaultOrder,
      defaultVisibility: descriptor.dock.defaultVisibility,
      allowedPresentations: [...descriptor.dock.allowedPresentations],
      railShortcut: descriptor.dock.railShortcut,
      ideRole: descriptor.dock.ideRole,
      ideNavigationTier: descriptor.dock.ideNavigationTier,
    },
  };
}

export function createBuiltInPanelDefinitions({
  appearance,
  explorerChromeControlSurface,
  explorerLayoutMode,
  explorerDockPreviewPolicy,
  explorerDefaultModeProfileId,
  explorerShellDefaultLayoutId,
  explorerPicker,
  isOpen,
  hideOverlay,
  pluginCommands,
  actionPacks = [],
  actions = [],
  pluginExplorerActions,
  pluginContextMenuItems,
  pluginExplorerActivityLanes = [],
  pluginExplorerViews = [],
  pluginExplorerWidgets = [],
  pluginPreviewLanes = [],
  pluginSettingsSlots = [],
  pluginWorkflows = [],
  pluginsLoading = false,
  pluginsError = null,
  onRefreshPlugins = async () => {},
  onOpenPluginsFolder = async () => {},
  onOpenInTerminal,
  onOpenInFilesystemAquarium,
  onAddBookmark,
  onRequestRepositoryImport,
  pendingRepositoryImports,
  onPendingRepositoryImportsHandled,
  topBarPackages,
  topBarPackagesDirectory,
  topBarPackagesLoading,
  topBarPackagesError,
  topBarPackagesWarnings,
  usrProfileRuntimeSnapshot = null,
  usrProfileSettingSliceKeys = [],
  usrProfileSharedSettingSliceKeys = [],
  usrProfileSettingsVariants = [],
  kainUiGraph = null,
  kainUiGraphError = null,
  kainManifest = null,
  kainManifestError = null,
  kainUiScaffold = null,
  kainUiScaffoldError = null,
  kainLatticeCatalog = null,
  kainLatticeCatalogError = null,
  kainFfiCatalog = null,
  kainFfiCatalogError = null,
  kainPluginCatalog = null,
  kainPluginCatalogError = null,
  onSwitchUsrProfile = async () => {},
  onCreateUsrProfile = async () => {},
  onCreateUsrProfileFromVariant = async () => {},
  onDuplicateUsrProfile = async () => {},
  onRenameUsrProfile = async () => {},
  onDeleteUsrProfile = async () => {},
  onOpenUsrProfilesRootFolder = async () => {},
  onOpenUsrProfileFolder = async () => {},
  dockPresentationPackages = [],
  dockPresentationPackagesDirectory = '',
  dockPresentationPackagesLoading = false,
  dockPresentationPackagesError = null,
  dockPresentationPackagesWarnings = [],
  explorerLayouts,
  explorerViews = [],
  explorerWidgets = [],
  homePacks = [],
  menuPacks = [],
  actionsDirectory = '',
  homePacksDirectory = '',
  menuPacksDirectory = '',
  actionsLoading = false,
  homePacksLoading = false,
  menuPacksLoading = false,
  actionsError = null,
  homePacksError = null,
  menuPacksError = null,
  actionsWarnings = [],
  homePacksWarnings = [],
  menuPacksWarnings = [],
  themePackages,
  themePackagesDirectory,
  themePackagesLoading,
  themePackagesError,
  themePackagesWarnings,
  appearancePacks = [],
  appearancePacksDirectory = '',
  appearancePacksLoading = false,
  appearancePacksError = null,
  appearancePacksWarnings = [],
  interactionMotionPacks = [],
  interactionMotionPacksDirectory = '',
  interactionMotionPacksLoading = false,
  interactionMotionPacksError = null,
  interactionMotionPacksWarnings = [],
  shellRenderers = [],
  shellRenderersDirectory = '',
  shellRenderersLoading = false,
  shellRenderersError = null,
  shellRenderersWarnings = [],
  themeRecipePacks = [],
  themeRecipePacksDirectory = '',
  themeRecipePacksLoading = false,
  themeRecipePacksError = null,
  themeRecipePacksWarnings = [],
  themeEnginePacks = [],
  themeEnginePacksDirectory = '',
  themeEnginePacksLoading = false,
  themeEnginePacksError = null,
  themeEnginePacksWarnings = [],
  onRefreshTopBars,
  onOpenTopBarsFolder,
  onRefreshDockPresentations = async () => {},
  onOpenDockPresentationsFolder = async () => {},
  onRefreshActions = async () => {},
  onOpenActionsFolder = async () => {},
  onRefreshHomePacks = async () => {},
  onRefreshMenuPacks = async () => {},
  onOpenHomePacksFolder = async () => {},
  onOpenMenuPacksFolder = async () => {},
  onRefreshAppearancePacks = async () => {},
  onOpenAppearancePacksFolder = async () => {},
  onRefreshInteractionMotionPacks = async () => {},
  onOpenInteractionMotionPacksFolder = async () => {},
  onRefreshShellRenderers = async () => {},
  onOpenShellRenderersFolder = async () => {},
  onRefreshThemeRecipePacks = async () => {},
  onOpenThemeRecipesFolder = async () => {},
  onRefreshThemeEnginePacks = async () => {},
  onOpenThemeEnginesFolder = async () => {},
  iconThemePackages = [],
  iconThemePackagesDirectory = iconThemeSystemConfig.iconThemesDirectory,
  iconThemePackagesLoading = false,
  iconThemePackagesError = null,
  iconThemePackagesWarnings = [],
  soundPacks = [],
  soundPacksDirectory = '',
  soundPacksLoading = false,
  soundPacksError = null,
  soundPacksWarnings = [],
  onRefreshThemes,
  onOpenThemesFolder,
  onRefreshIconThemes = async () => {},
  onOpenIconThemesFolder = async () => {},
  onRefreshSoundPacks = async () => {},
  onOpenSoundPacksFolder = async () => {},
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
  onActivatePanel = () => {},
  onOpenSettingsSection = () => {},
  onExplorerPickerConfirm = () => undefined,
  onExplorerPickerCancel = () => undefined,
  renderPluginsManager,
}: {
  appearance: ResolvedOverlayAppearance;
  explorerChromeControlSurface?: 'toolbar' | 'topbar';
  explorerLayoutMode?: ExplorerLayoutMode;
  explorerDockPreviewPolicy?: ExplorerDockPreviewPolicy;
  explorerDefaultModeProfileId?: ExplorerModeProfileId | null;
  explorerShellDefaultLayoutId?: string | null;
  explorerPicker?: ExplorerPickerRequest | null;
  onExplorerPickerConfirm?: (result: {
    currentDirectory: string;
    entries: Array<{ path: string; name: string; kind: 'file' | 'folder' }>;
  }) => void;
  onExplorerPickerCancel?: () => void;
  isOpen: boolean;
  hideOverlay: () => void;
  pluginCommands: OverlayPluginCommandContribution[];
  actionPacks?: LoadedActionPack[];
  actions?: LoadedExplorerAction[];
  pluginExplorerActions: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems: OverlayPluginContextMenuContribution[];
  pluginExplorerActivityLanes?: OverlayPluginExplorerActivityLaneContribution[];
  pluginExplorerViews?: OverlayPluginExplorerViewContribution[];
  pluginExplorerWidgets?: OverlayPluginExplorerWidgetContribution[];
  pluginPreviewLanes?: OverlayPluginPreviewLaneContribution[];
  pluginSettingsSlots?: OverlayPluginSettingsSlotContribution[];
  pluginWorkflows?: OverlayPluginWorkflowContribution[];
  pluginsLoading?: boolean;
  pluginsError?: string | null;
  onRefreshPlugins?: () => Promise<void>;
  onOpenPluginsFolder?: () => Promise<void>;
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium: (path: string) => void;
  onAddBookmark: (name: string, path: string) => Promise<void>;
  onRequestRepositoryImport: () => void;
  pendingRepositoryImports: string[];
  onPendingRepositoryImportsHandled: () => void;
  topBarPackages: LoadedOverlayTopBarPackage[];
  topBarPackagesDirectory: string;
  topBarPackagesLoading: boolean;
  topBarPackagesError: string | null;
  topBarPackagesWarnings: string[];
  usrProfileRuntimeSnapshot?: UsrProfileRuntimeSnapshot | null;
  usrProfileSettingSliceKeys?: readonly string[];
  usrProfileSharedSettingSliceKeys?: readonly string[];
  usrProfileSettingsVariants?: readonly UsrProfileSettingsVariantDefinition[];
  kainUiGraph?: KainUiGraph | null;
  kainUiGraphError?: string | null;
  kainManifest?: KainAppManifest | null;
  kainManifestError?: string | null;
  kainUiScaffold?: KainUiScaffold | null;
  kainUiScaffoldError?: string | null;
  kainLatticeCatalog?: KainLatticeCatalog | null;
  kainLatticeCatalogError?: string | null;
  kainFfiCatalog?: KainFfiCatalog | null;
  kainFfiCatalogError?: string | null;
  kainPluginCatalog?: KainPluginCatalog | null;
  kainPluginCatalogError?: string | null;
  onSwitchUsrProfile?: (profileId: string) => Promise<void>;
  onCreateUsrProfile?: (name: string, seedSettingsJson?: string | null) => Promise<void>;
  onCreateUsrProfileFromVariant?: (variantId: string, name: string) => Promise<void>;
  onDuplicateUsrProfile?: (
    profileId: string,
    name: string,
  ) => Promise<void>;
  onRenameUsrProfile?: (profileId: string, name: string) => Promise<void>;
  onDeleteUsrProfile?: (profileId: string) => Promise<void>;
  onOpenUsrProfilesRootFolder?: () => Promise<void>;
  onOpenUsrProfileFolder?: (profileId: string) => Promise<void>;
  dockPresentationPackages?: LoadedDockPresentationPackage[];
  dockPresentationPackagesDirectory?: string;
  dockPresentationPackagesLoading?: boolean;
  dockPresentationPackagesError?: string | null;
  dockPresentationPackagesWarnings?: string[];
  explorerLayouts: LoadedExplorerLayoutDefinition[];
  explorerViews?: LoadedExplorerViewDefinition[];
  explorerWidgets?: LoadedExplorerWidgetDefinition[];
  explorerLayoutsDirectory: string;
  explorerLayoutsLoading: boolean;
  explorerLayoutsError: string | null;
  explorerLayoutsWarnings: string[];
  explorerWidgetsDirectory?: string;
  explorerWidgetsLoading?: boolean;
  explorerWidgetsError?: string | null;
  explorerWidgetsWarnings?: string[];
  homePacks?: LoadedExplorerHomePack[];
  menuPacks?: LoadedExplorerMenuPack[];
  actionsDirectory?: string;
  homePacksDirectory?: string;
  menuPacksDirectory?: string;
  actionsLoading?: boolean;
  homePacksLoading?: boolean;
  menuPacksLoading?: boolean;
  actionsError?: string | null;
  homePacksError?: string | null;
  menuPacksError?: string | null;
  actionsWarnings?: string[];
  homePacksWarnings?: string[];
  menuPacksWarnings?: string[];
  themePackages: LoadedOverlayThemePackage[];
  themePackagesDirectory: string;
  themePackagesLoading: boolean;
  themePackagesError: string | null;
  themePackagesWarnings: string[];
  appearancePacks?: LoadedThemeAppearancePack[];
  appearancePacksDirectory?: string;
  appearancePacksLoading?: boolean;
  appearancePacksError?: string | null;
  appearancePacksWarnings?: string[];
  interactionMotionPacks?: LoadedThemeInteractionMotionPack[];
  interactionMotionPacksDirectory?: string;
  interactionMotionPacksLoading?: boolean;
  interactionMotionPacksError?: string | null;
  interactionMotionPacksWarnings?: string[];
  shellRenderers?: LoadedThemeShellRendererPack[];
  shellRenderersDirectory?: string;
  shellRenderersLoading?: boolean;
  shellRenderersError?: string | null;
  shellRenderersWarnings?: string[];
  themeRecipePacks?: LoadedThemeRecipePack[];
  themeRecipePacksDirectory?: string;
  themeRecipePacksLoading?: boolean;
  themeRecipePacksError?: string | null;
  themeRecipePacksWarnings?: string[];
  themeEnginePacks?: LoadedThemeEnginePack[];
  themeEnginePacksDirectory?: string;
  themeEnginePacksLoading?: boolean;
  themeEnginePacksError?: string | null;
  themeEnginePacksWarnings?: string[];
  onRefreshTopBars: () => Promise<void>;
  onOpenTopBarsFolder: () => Promise<void>;
  onRefreshDockPresentations?: () => Promise<void>;
  onOpenDockPresentationsFolder?: () => Promise<void>;
  onRefreshActions?: () => Promise<void>;
  onOpenActionsFolder?: () => Promise<void>;
  onRefreshHomePacks?: () => Promise<void>;
  onRefreshMenuPacks?: () => Promise<void>;
  onOpenHomePacksFolder?: () => Promise<void>;
  onOpenMenuPacksFolder?: () => Promise<void>;
  onRefreshAppearancePacks?: () => Promise<void>;
  onOpenAppearancePacksFolder?: () => Promise<void>;
  onRefreshInteractionMotionPacks?: () => Promise<void>;
  onOpenInteractionMotionPacksFolder?: () => Promise<void>;
  onRefreshShellRenderers?: () => Promise<void>;
  onOpenShellRenderersFolder?: () => Promise<void>;
  onRefreshThemeRecipePacks?: () => Promise<void>;
  onOpenThemeRecipesFolder?: () => Promise<void>;
  onRefreshThemeEnginePacks?: () => Promise<void>;
  onOpenThemeEnginesFolder?: () => Promise<void>;
  iconThemePackages?: LoadedIconThemePackage[];
  iconThemePackagesDirectory?: string;
  iconThemePackagesLoading?: boolean;
  iconThemePackagesError?: string | null;
  iconThemePackagesWarnings?: string[];
  soundPacks?: LoadedOverlaySoundPack[];
  soundPacksDirectory?: string;
  soundPacksLoading?: boolean;
  soundPacksError?: string | null;
  soundPacksWarnings?: string[];
  onRefreshThemes: () => Promise<void>;
  onOpenThemesFolder: () => Promise<void>;
  onRefreshIconThemes?: () => Promise<void>;
  onOpenIconThemesFolder?: () => Promise<void>;
  onRefreshSoundPacks?: () => Promise<void>;
  onOpenSoundPacksFolder?: () => Promise<void>;
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
  onActivatePanel?: (panelId: string) => void;
  onOpenSettingsSection?: (section: SettingsSectionKey) => void;
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

  const panels: OverlayPanelDefinition[] = [
    {
      id: 'explorer',
      label: 'Explorer',
      kind: 'built-in-panel',
      icon: <ThemedPanelIcon panelId="explorer" fallbackSlotId="folder_open" fallbackIcon={FolderOpen} size={12} />,
      description: 'File browser and asset navigation.',
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'browse',
        groupLabel: 'Browse',
        groupOrder: 10,
        itemOrder: 10,
      },
      dock: {
        defaultPlacement: 'center',
        defaultOrder: 10,
        defaultVisibility: 'visible',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'explorer-core',
        ideNavigationTier: 'primary',
      },
      render: () => (
        <MemoExplorerWorkspace
          appearance={appearance}
          chromeControlSurface={explorerChromeControlSurface}
          layoutMode={explorerLayoutMode}
          dockPreviewPolicy={explorerDockPreviewPolicy}
          defaultModeProfileId={explorerDefaultModeProfileId}
          shellDefaultExplorerLayoutId={explorerShellDefaultLayoutId}
          explorerPicker={explorerPicker}
          theme={explorerTheme}
          onOpenInTerminal={onOpenInTerminal}
          onOpenInFilesystemAquarium={onOpenInFilesystemAquarium}
          onAddBookmark={onAddBookmark}
          explorerLayouts={explorerLayouts}
          homePacks={homePacks}
          menuPacks={menuPacks}
          actions={actions}
          onOpenPanel={onActivatePanel}
          onOpenSettingsSection={onOpenSettingsSection}
          onExplorerPickerConfirm={onExplorerPickerConfirm}
          onExplorerPickerCancel={onExplorerPickerCancel}
          pluginActions={pluginExplorerActions}
          pluginContextMenuItems={pluginContextMenuItems}
          pluginExplorerActivityLanes={pluginExplorerActivityLanes}
          pluginExplorerViews={pluginExplorerViews}
          pluginExplorerWidgets={pluginExplorerWidgets}
          pluginPreviewLanes={pluginPreviewLanes}
          pluginWorkflows={pluginWorkflows}
          explorerViews={explorerViews}
          explorerWidgets={explorerWidgets}
        />
      ),
    },
    {
      id: 'storage',
      label: 'Storage',
      kind: 'built-in-panel',
      icon: <ThemedPanelIcon panelId="storage" fallbackSlotId="hard_drive" fallbackIcon={HardDrive} size={12} />,
      description: 'Drive treemap, storage forensics, and destructive cleanup.',
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'browse',
        groupLabel: 'Browse',
        groupOrder: 10,
        itemOrder: 20,
      },
      dock: {
        defaultPlacement: 'right-sidebar',
        defaultOrder: 20,
        defaultVisibility: 'hidden',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'secondary',
      },
      render: () => (
        <DeferredPanel>
          <LazyStoragePanel appearance={appearance} />
        </DeferredPanel>
      ),
    },
    {
      id: 'terminal',
      label: 'Terminal',
      kind: 'built-in-panel',
      icon: <ThemedPanelIcon panelId="terminal" fallbackSlotId="terminal_square" fallbackIcon={TerminalIcon} size={12} />,
      description: 'Primary command workspace.',
      defaultOpen: true,
      keepMounted: true,
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
        groupOrder: 20,
        itemOrder: 10,
      },
      dock: {
        defaultPlacement: 'bottom-panel',
        defaultOrder: 10,
        defaultVisibility: 'collapsed',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'primary',
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
      icon: <ThemedPanelIcon panelId="git" fallbackSlotId="git_branch" fallbackIcon={GitBranch} size={12} />,
      description: 'Git tools and diff management.',
      defaultOpen: true,
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
        groupOrder: 20,
        itemOrder: 20,
      },
      dock: {
        defaultPlacement: 'bottom-panel',
        defaultOrder: 20,
        defaultVisibility: 'collapsed',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'primary',
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
      icon: <ThemedPanelIcon panelId="notes" fallbackSlotId="sticky_note" fallbackIcon={StickyNote} size={12} />,
      description: 'Scratchpads and structured notes.',
      defaultOpen: true,
      navigation: {
        groupId: 'work',
        groupLabel: 'Work',
        groupOrder: 20,
        itemOrder: 30,
      },
      dock: {
        defaultPlacement: 'right-sidebar',
        defaultOrder: 30,
        defaultVisibility: 'hidden',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'secondary',
      },
      render: () => (
        <DeferredPanel>
          <LazyNotesManager appearance={appearance} />
        </DeferredPanel>
      ),
    },
    {
      id: 'go-sample-panel',
      label: 'Go Wasm',
      kind: 'built-in-panel',
      icon: <ThemedPanelIcon panelId="go-sample-panel" fallbackSlotId="cpu" fallbackIcon={Cpu} size={12} />,
      description: 'Interactive smoke test for the Go/Wasm panel runtime and host event bus.',
      defaultOpen: false,
      keepMounted: true,
      navigation: {
        groupId: 'labs',
        groupLabel: 'Labs',
        groupOrder: 45,
        itemOrder: 10,
      },
      dock: {
        defaultPlacement: 'right-sidebar',
        defaultOrder: 45,
        defaultVisibility: 'hidden',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'secondary',
      },
      render: () => (
        <DeferredPanel>
          <LazyGoRuntimeSmokePanel appearance={appearance} />
        </DeferredPanel>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      kind: 'built-in-panel',
      icon: <ThemedPanelIcon panelId="settings" fallbackSlotId="settings2" fallbackIcon={Settings2} size={12} />,
      description: 'Application-wide appearance, terminal, and explorer settings.',
      defaultOpen: false,
      navigation: {
        groupId: 'system',
        groupLabel: 'System',
        groupOrder: 50,
        itemOrder: 10,
      },
      dock: {
        defaultPlacement: 'right-sidebar',
        defaultOrder: 50,
        defaultVisibility: 'hidden',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'secondary',
      },
      render: () => (
        <DeferredPanel>
          <LazySettingsPage
            appearance={appearance}
            topBarPackages={topBarPackages}
            topBarPackagesDirectory={topBarPackagesDirectory}
            topBarPackagesLoading={topBarPackagesLoading}
            topBarPackagesError={topBarPackagesError}
            topBarPackagesWarnings={topBarPackagesWarnings}
            usrProfileRuntimeSnapshot={usrProfileRuntimeSnapshot}
            usrProfileSettingSliceKeys={usrProfileSettingSliceKeys}
            usrProfileSharedSettingSliceKeys={usrProfileSharedSettingSliceKeys}
            usrProfileSettingsVariants={usrProfileSettingsVariants}
            kainUiGraph={kainUiGraph}
            kainUiGraphError={kainUiGraphError}
            kainManifest={kainManifest}
            kainManifestError={kainManifestError}
            kainUiScaffold={kainUiScaffold}
            kainUiScaffoldError={kainUiScaffoldError}
            kainLatticeCatalog={kainLatticeCatalog}
            kainLatticeCatalogError={kainLatticeCatalogError}
            kainFfiCatalog={kainFfiCatalog}
            kainFfiCatalogError={kainFfiCatalogError}
            kainPluginCatalog={kainPluginCatalog}
            kainPluginCatalogError={kainPluginCatalogError}
            onSwitchUsrProfile={onSwitchUsrProfile}
            onCreateUsrProfile={onCreateUsrProfile}
            onCreateUsrProfileFromVariant={onCreateUsrProfileFromVariant}
            onDuplicateUsrProfile={onDuplicateUsrProfile}
            onRenameUsrProfile={onRenameUsrProfile}
            onDeleteUsrProfile={onDeleteUsrProfile}
            onOpenUsrProfilesRootFolder={onOpenUsrProfilesRootFolder}
            onOpenUsrProfileFolder={onOpenUsrProfileFolder}
            dockPresentationPackages={dockPresentationPackages}
            dockPresentationPackagesDirectory={dockPresentationPackagesDirectory}
            dockPresentationPackagesLoading={dockPresentationPackagesLoading}
            dockPresentationPackagesError={dockPresentationPackagesError}
            dockPresentationPackagesWarnings={dockPresentationPackagesWarnings}
            homePacks={homePacks}
            menuPacks={menuPacks}
            actionPacks={actionPacks}
            actions={actions}
            actionsDirectory={actionsDirectory}
            homePacksDirectory={homePacksDirectory}
            menuPacksDirectory={menuPacksDirectory}
            actionsLoading={actionsLoading}
            homePacksLoading={homePacksLoading}
            menuPacksLoading={menuPacksLoading}
            actionsError={actionsError}
            homePacksError={homePacksError}
            menuPacksError={menuPacksError}
            actionsWarnings={actionsWarnings}
            homePacksWarnings={homePacksWarnings}
            menuPacksWarnings={menuPacksWarnings}
            themePackages={themePackages}
            themePackagesDirectory={themePackagesDirectory}
            themePackagesLoading={themePackagesLoading}
            themePackagesError={themePackagesError}
            themePackagesWarnings={themePackagesWarnings}
            appearancePacks={appearancePacks}
            appearancePacksDirectory={appearancePacksDirectory}
            appearancePacksLoading={appearancePacksLoading}
            appearancePacksError={appearancePacksError}
            appearancePacksWarnings={appearancePacksWarnings}
            interactionMotionPacks={interactionMotionPacks}
            interactionMotionPacksDirectory={interactionMotionPacksDirectory}
            interactionMotionPacksLoading={interactionMotionPacksLoading}
            interactionMotionPacksError={interactionMotionPacksError}
            interactionMotionPacksWarnings={interactionMotionPacksWarnings}
            shellRenderers={shellRenderers}
            shellRenderersDirectory={shellRenderersDirectory}
            shellRenderersLoading={shellRenderersLoading}
            shellRenderersError={shellRenderersError}
            shellRenderersWarnings={shellRenderersWarnings}
            themeRecipePacks={themeRecipePacks}
            themeRecipePacksDirectory={themeRecipePacksDirectory}
            themeRecipePacksLoading={themeRecipePacksLoading}
            themeRecipePacksError={themeRecipePacksError}
            themeRecipePacksWarnings={themeRecipePacksWarnings}
            themeEnginePacks={themeEnginePacks}
            themeEnginePacksDirectory={themeEnginePacksDirectory}
            themeEnginePacksLoading={themeEnginePacksLoading}
            themeEnginePacksError={themeEnginePacksError}
            themeEnginePacksWarnings={themeEnginePacksWarnings}
            onRefreshTopBars={onRefreshTopBars}
            onOpenTopBarsFolder={onOpenTopBarsFolder}
            onRefreshDockPresentations={onRefreshDockPresentations}
            onOpenDockPresentationsFolder={onOpenDockPresentationsFolder}
            onRefreshActions={onRefreshActions}
            onOpenActionsFolder={onOpenActionsFolder}
            onRefreshHomePacks={onRefreshHomePacks}
            onRefreshMenuPacks={onRefreshMenuPacks}
            onOpenHomePacksFolder={onOpenHomePacksFolder}
            onOpenMenuPacksFolder={onOpenMenuPacksFolder}
            onRefreshAppearancePacks={onRefreshAppearancePacks}
            onOpenAppearancePacksFolder={onOpenAppearancePacksFolder}
            onRefreshInteractionMotionPacks={onRefreshInteractionMotionPacks}
            onOpenInteractionMotionPacksFolder={onOpenInteractionMotionPacksFolder}
            onRefreshShellRenderers={onRefreshShellRenderers}
            onOpenShellRenderersFolder={onOpenShellRenderersFolder}
            onRefreshThemeRecipePacks={onRefreshThemeRecipePacks}
            onOpenThemeRecipesFolder={onOpenThemeRecipesFolder}
            onRefreshThemeEnginePacks={onRefreshThemeEnginePacks}
            onOpenThemeEnginesFolder={onOpenThemeEnginesFolder}
            iconThemePackages={iconThemePackages}
            iconThemePackagesDirectory={iconThemePackagesDirectory}
            iconThemePackagesLoading={iconThemePackagesLoading}
            iconThemePackagesError={iconThemePackagesError}
            iconThemePackagesWarnings={iconThemePackagesWarnings}
            soundPacks={soundPacks}
            soundPacksDirectory={soundPacksDirectory}
            soundPacksLoading={soundPacksLoading}
            soundPacksError={soundPacksError}
            soundPacksWarnings={soundPacksWarnings}
            onRefreshThemes={onRefreshThemes}
            onOpenThemesFolder={onOpenThemesFolder}
            onRefreshIconThemes={onRefreshIconThemes}
            onOpenIconThemesFolder={onOpenIconThemesFolder}
            onRefreshSoundPacks={onRefreshSoundPacks}
            onOpenSoundPacksFolder={onOpenSoundPacksFolder}
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
            pluginSettingsSlots={pluginSettingsSlots}
            pluginsLoading={pluginsLoading}
            pluginsError={pluginsError}
            onRefreshPlugins={onRefreshPlugins}
            onOpenPluginsFolder={onOpenPluginsFolder}
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
      icon: <ThemedPanelIcon panelId="plugins" fallbackSlotId="puzzle" fallbackIcon={Puzzle} size={12} />,
      description: 'Plugin browser and drop-in loader workspace.',
      defaultOpen: true,
      navigation: {
        groupId: 'extensions',
        groupLabel: 'Extensions',
        groupOrder: 40,
        itemOrder: 10,
      },
      dock: {
        defaultPlacement: 'right-sidebar',
        defaultOrder: 60,
        defaultVisibility: 'hidden',
        allowedPresentations: ['stack', 'floating'],
        railShortcut: true,
        ideRole: 'utility',
        ideNavigationTier: 'secondary',
      },
      render: renderPluginsManager,
    },
  ];

  return panels.map(applyBuiltInPanelLatticeDescriptor);
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
  return plugins
    .filter(plugin => plugin.enabled !== false && (plugin.component != null || plugin.error))
    .map(plugin => ({
    id: plugin.id,
    label: plugin.name,
    kind: 'folder-plugin',
    icon: <ThemedPanelIcon panelId={plugin.id} fallbackSlotId="puzzle" fallbackIcon={Puzzle} size={12} />,
    description: plugin.description ?? `Folder plugin loaded from ${plugin.filePath}.`,
    defaultOpen: plugin.defaultOpen,
    keepMounted: plugin.keepMounted,
    navigation: {
      groupId: 'extensions',
      groupLabel: 'Extensions',
      groupOrder: 40,
    },
    dock: {
      defaultPlacement: 'right-sidebar',
      defaultOrder: 200,
      defaultVisibility: 'hidden',
      allowedPresentations: ['stack', 'floating'],
      railShortcut: true,
      ideRole: 'utility',
      ideNavigationTier: 'secondary',
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
  return buildBuiltInPanelCatalogFromLattice();
}
