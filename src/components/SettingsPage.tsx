import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Camera,
  Clipboard,
  Copy,
  CopyPlus,
  Cpu,
  Database,
  Download,
  Edit3,
  Eraser,
  ExternalLink,
  Eye,
  FilePlus,
  FolderOpen,
  FolderPlus,
  GitBranch,
  HardDrive,
  Home,
  Image,
  Info,
  LayoutGrid,
  Loader2,
  MonitorPlay,
  Music,
  Palette,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Settings2,
  Shield,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Tags,
  Terminal,
  TerminalSquare,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
} from "@/components/AppIcons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useShallow } from "zustand/react/shallow";
import { PremiumSlider } from "./PremiumSlider";
import type { LoadedOverlayAnimation } from "./animationRuntime";
import {
  getOverlayWallpaperKindLabel,
  type LoadedOverlayWallpaper,
} from "./wallpaperRuntime";
import {
  normalizeShaderControlValue,
  resolveShaderComputedUniforms,
  resolveShaderControlValues,
  type LoadedOverlayShader,
  type OverlayShaderControlDefinition,
  type OverlayShaderShellContext,
} from "./shaderRuntime";
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  overlayThemePresets,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from "../config/appearance";
import {
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getExternalTerminalProfileOptions,
  getIntegratedTerminalProfileOptions,
  getIntegratedTerminalProfileTemplate,
  type ExternalTerminalProfile,
  type IntegratedTerminalProfile,
} from "../config/platform";
import {
  getGpuTierModeLabel,
  gpuRuntimeTierOptions,
} from "../config/gpuRuntime";
import {
  accelerationRoutingModeOptions,
  accelerationWorkloadCatalog,
  getAccelerationRoutingModeLabel,
  resolveAccelerationProviderForWorkload,
} from "../config/accelerationRuntime";
import {
  buildManagedPythonPipInstallCommand,
  createAccelerationAutoInstallPlan,
  createPythonRuntimeConfig,
  shouldAutoInstallAccelerationPackages,
} from "../config/python";
import {
  formatLocalModelEstimatedFootprint,
  getCapabilityModels,
  getLocalModelCapabilityDefinition,
  getLocalModelDefinition,
  getLocalModelDefinitionByProviderModelId,
  getLocalModelHardwareProfile,
  localModelBackendOptions,
  localModelCapabilityCatalog,
  localModelDefinitions,
  normalizeLocalModelBackendPreference,
  semanticIndexingCapabilityId,
  type LocalModelBackendPreference,
} from "../config/localModels";
import {
  beginCloudAuth,
  clearCloudProviderConfiguration,
  disconnectCloudAccount,
  createExplorerDir,
  getExplorerDrives,
  getExplorerHomeDir,
  listCloudAccounts,
  listExplorerSavedSearches,
  listExplorerDir,
  openExplorerPath,
  pollCloudAuth,
  setCloudProviderConfiguration,
  type ExplorerDriveInfo,
  type ExplorerSavedSearch,
  type ExplorerCloudAccountSummary,
  type ExplorerCloudAccountsSnapshot,
  type ExplorerCloudProviderConfigurationSource,
  type ExplorerCloudProviderId,
} from "../runtime/explorerBackend";
import { openExplorerPicker } from "../runtime/explorerPicker";
import {
  createDefaultFolderIconRules,
  FOLDER_ICON_OPTIONS,
  normalizeFolderIconMatcher,
  type FolderIconRule,
} from "../config/folderIcons";
import {
  explorerViewModes,
  getExplorerViewModeDefinition,
} from "../config/explorerViewModes";
import { clampVideoHoverScrubFrameCount } from "../config/explorerThumbnails";
import {
  EXPLORER_MENU_CONTEXT_KINDS,
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  createExplorerMenuSubmenuEntry,
  createLegacyExplorerActionContextMenuContributions,
  normalizeExplorerActionContributions,
  moveExplorerMenuLayoutEntry,
  normalizePluginContextMenuContributions,
  placeExplorerMenuLayoutEntry,
  removeExplorerMenuLayoutEntry,
  sortExplorerMenuLayoutEntries,
  upsertExplorerMenuSubmenuEntry,
  withExplorerMenuLayoutEntryEnabled,
  withExplorerMenuLayoutEntryParent,
  withExplorerMenuLayoutEntryPlacement,
  type ExplorerCommandDefinition,
  type ExplorerMenuContextKind,
  type ExplorerMenuContextLayout,
  type ExplorerMenuFallbackBucket,
  type ExplorerMenuInvocationContext,
  type ExplorerMenuInvocationEntry,
  type ExplorerMenuLayoutEntry,
  type ExplorerMenuQuickSlot,
} from "../config/explorerContextMenu";
import {
  actionPackSystemConfig,
  type LoadedActionPack,
  type LoadedExplorerAction,
} from "../config/actionPacks";
import { getBuiltInIconTheme } from "../config/iconTheme";
import {
  animationSystemConfig,
  resolvePreferredAnimationId,
} from "../config/animations";
import {
  clampInteractionMotionIntensity,
  formatInteractionMotionModifierControlValue,
  getInteractionMotionProfileModifierControls,
  interactionMotionModuleCatalog,
  interactionMotionPresetOptions,
  interactionMotionSurfaceCatalog,
  normalizeInteractionMotionModuleOverride,
  normalizeInteractionMotionPresetId,
  resolveInteractionMotionModifierValues,
  resolveInteractionMotionModuleProfileId,
} from "../config/interactionMotion";
import {
  getLayoutDynamicsPreset,
  layoutDynamicsSurfaceCatalog,
  resolveLayoutDynamicsPresetId,
} from "../config/layoutDynamics";
import {
  getOverlayWallpaperFitModeLabel,
  overlayWallpaperFitModes,
  wallpaperSystemConfig,
} from "../config/wallpapers";
import {
  getManagedContentDirectory,
  managedContentDirectoryCatalog,
  type ManagedContentDirectoryId,
} from "../config/appContentDirectories";
import {
  settingsSectionCatalog,
  type SettingsPageArchetype,
  type SettingsSectionKey,
  type SettingsSectionShellHints,
} from "../config/settingsNavigation";
import {
  getMobileRemoteAccessModeDefinition,
  mobileAccessExternalLinks,
  mobileRemoteAccessModeDefinitions,
} from "../config/mobileAccess";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { usePersistentPanelSize } from "./ResizablePane";
import { InteractionMotionLab } from "../animation/MotionLab";
import {
  useInteractionMotionController,
  type InteractionMotionBinding,
} from "../animation/interactionMotion";
import { MobileShareConnectionCards } from "./MobileShareConnectionCards";
import { MobileShareQrDialog } from "./MobileShareQrDialog";
import { OverlayActionButton } from "./OverlayActionButton";
import { SettingsShell } from "./settings/SettingsShell";
import {
  InfoBubble,
  SettingsRowDescriptionProvider,
  useSettingsRowDescriptionsVisible,
} from "./settings/SettingsPrimitives";
import { AppearanceSettingsSection } from "./settings/sections/AppearanceSettingsSection";
import { IconSettingsSection } from "./settings/sections/IconSettingsSection";
import { SystemSettingsSection } from "./settings/sections/SystemSettingsSection";
import { ContextMenusSettingsSection } from "./settings/sections/ContextMenusSettingsSection";
import { LayoutDynamicsSettingsSection } from "./settings/sections/LayoutDynamicsSettingsSection";
import {
  BUILT_IN_LAYOUT_MANIFEST,
  getWorkbenchShellFamilyForLayoutProfile,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LoadedLayoutManifest,
} from "../config/layoutProfiles";
import type { LoadedOverlayThemePackage } from "../config/themePackages";
import {
  createThemeBundleManifestFromThemeDefinition,
  parseImportedThemeBundle,
  serializeThemeBundle,
  upsertCustomThemeBundle,
  type OverlayThemeBundleManifest,
} from "../config/themePackages";
import {
  themeAppearancePackSystemConfig,
  themeEnginePackSystemConfig,
  themeInteractionMotionPackSystemConfig,
  themeRecipePackSystemConfig,
  themeShellRendererPackSystemConfig,
  type LoadedThemeAppearancePack,
  type LoadedThemeEnginePack,
  type LoadedThemeInteractionMotionPack,
  type LoadedThemeRecipePack,
  type LoadedThemeShellRendererPack,
} from "../config/themeBundlePacks";
import type { LoadedOverlayTopBarPackage } from "../config/topBarPackages";
import type { LoadedExplorerHomePack } from "../config/homePackages";
import {
  createBuiltInExplorerMenuPack,
  type LoadedExplorerMenuPack,
} from "../config/menuPacks";
import {
  DEFAULT_SOUND_PACK_ID,
  overlaySoundEffectCatalog,
  resolveLoadedSoundPack,
  soundPackSystemConfig,
  type LoadedOverlaySoundPack,
} from "../config/soundPacks";
import {
  iconThemeSystemConfig,
  normalizeIconThemePackageSelectionId,
  resolveLoadedIconThemePackage,
  type LoadedIconThemePackage,
} from "../config/iconThemePackages";
import {
  createExplorerHomeHost,
  createExplorerHomeLaunchpadItems,
  createExplorerHomeQuickAccessItems,
  resolveExplorerHomePackSelection,
} from "./home/ExplorerHomeSurface";
import type {
  ExplorerHomeBookmarkItem,
  ExplorerHomeUsageEntry,
} from "./home/homePackRuntime";
import {
  getTopBarControlLabel,
  getTopBarNavigationModeLabel,
  getTopBarSourceLabel,
  getTopBarStyleLabel,
  resolveActiveTopBarSelection,
  type LoadedOverlayTopBarDefinition,
} from "../config/topBars";
import {
  getOverlayShaderSurfaceLabel,
  getShaderEnabledSurfaceIds,
  getShaderPerformanceProfile,
  resolvePreferredShaderId,
  shaderPerformanceProfiles,
} from "../config/shaders";
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
} from "../config/overlayAnimations";
import {
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  overlayVisualControls,
} from "../config/overlayWindow";
import {
  loadExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from "../config/performanceTelemetry";
import {
  formatHotkeyLabel,
  getHotkeyBindingDefinition,
  hotkeyBindingDefinitions,
  normalizeKeybindingValue,
  type HotkeyBindingKey,
} from "../config/hotkeys";
import {
  buildExplorerCustomizeCatalog,
  resolveExplorerChromeCommandLabel,
  type ExplorerCustomizeCatalogEntry,
} from "../config/explorerCustomizeCatalog";
import {
  screenshotFeatureConfig,
  type ScreenshotCaptureModeId,
  type ScreenshotOutputActionId,
} from "../config/screenshots";
import {
  dispatchTerminalCommand,
  type OverlayPluginContextMenuContribution,
  type OverlayPluginExplorerActionContribution,
} from "../config/pluginContributions";
import {
  useSettingsStore,
  resolveSystemPresentationState,
  type TerminalWindowMode,
} from "../store/settingsStore";
import { useExplorerStore } from "../store/explorerStore";
import { useExplorerTaskSnapshots } from "../store/explorerTaskStore";
import {
  refreshMobileShareTailscaleStatus,
  setMobileShareTailscaleStatus,
  startMobileShareSession,
  stopMobileShareSession,
  useMobileShareStore,
} from "../store/mobileShareStore";
import {
  refreshAccelerationRuntimeStatus,
  useAccelerationRuntimeStore,
} from "../store/accelerationRuntimeStore";
import { useGpuRuntimeStore } from "../store/gpuRuntimeStore";
import { useTerminalStore } from "../store/terminalStore";
import {
  commands,
  unwrapTauriResult,
  type LinuxDisplayBackendPreference,
  type LinuxDisplayBackendStatus,
} from "../runtime/tauriClient";
import {
  connectTailscale,
  disconnectTailscale,
} from "../runtime/tailscaleBackend";
import {
  clearTelemetrySessions,
  exportTelemetrySupportBundle,
  getTelemetryStatus,
  type OverlayTelemetrySessionStatus,
} from "../runtime/telemetryBackend";
import {
  bootstrapManagedPythonRuntime,
  getManagedPythonRuntimeStatus,
} from "../runtime/pythonRuntimeBackend";
import {
  getLocalModelCatalogStatus,
  prewarmLocalModel,
  type LocalModelCatalogStatus,
} from "../runtime/modelManagementBackend";
import {
  clearExplorerHomeUsage,
  listExplorerHomeUsage,
  type ExplorerHomeUsageSnapshotValue,
} from "../runtime/homeBackend";
import {
  ensureNativeNotificationPermission,
  getNativeNotificationPermissionState,
  sendNativeNotification,
  type NativeNotificationPermissionState,
} from "../runtime/nativeNotifications";
import { previewSoundEffect } from "../runtime/soundEffects";
import {
  buildExplorerRuntimeMenu,
  type ExplorerMenuRuntimeEnvironment,
  type ExplorerRuntimeMenuNode,
} from "./explorer/explorerMenuRuntime";

function ThemeBadge({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className="rounded px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
      style={{
        border: `1px solid ${active ? "currentColor" : "var(--overlay-workbench-settings-badge-border)"}`,
        background: active
          ? "var(--overlay-workbench-chrome-button-active-bg)"
          : "var(--overlay-workbench-settings-badge-bg)",
      }}
    >
      {label}
    </span>
  );
}

function renderSettingsContextMenuIcon(iconName?: string): ReactNode {
  switch (iconName) {
    case "Clipboard":
      return <Clipboard size={13} />;
    case "Copy":
      return <Copy size={13} />;
    case "CopyPlus":
      return <CopyPlus size={13} />;
    case "Edit3":
      return <Edit3 size={13} />;
    case "Eraser":
      return <Eraser size={13} />;
    case "ExternalLink":
      return <ExternalLink size={13} />;
    case "Eye":
      return <Eye size={13} />;
    case "FilePlus":
      return <FilePlus size={13} />;
    case "FolderPlus":
      return <FolderPlus size={13} />;
    case "Info":
      return <Info size={13} />;
    case "Pencil":
      return <Pencil size={13} />;
    case "RefreshCw":
      return <RefreshCw size={13} />;
    case "RotateCcw":
      return <RotateCcw size={13} />;
    case "Save":
      return <Save size={13} />;
    case "Scissors":
      return <Scissors size={13} />;
    case "Shield":
      return <Shield size={13} />;
    case "Sliders":
      return <Sliders size={13} />;
    case "Sparkles":
      return <Sparkles size={13} />;
    case "Star":
      return <Star size={13} />;
    case "Tags":
      return <Tags size={13} />;
    case "Terminal":
      return <Terminal size={13} />;
    case "Trash2":
      return <Trash2 size={13} />;
    case "Undo2":
      return <Undo2 size={13} />;
    default:
      return <Puzzle size={13} />;
  }
}

function createSettingsContextMenuPreviewEntry(
  path: string,
  options?: Partial<ExplorerMenuInvocationEntry>,
): ExplorerMenuInvocationEntry {
  const normalizedPath = path.trim();
  const segments = normalizedPath.split(/[\\/]/).filter(Boolean);
  const name = options?.name ?? segments[segments.length - 1] ?? normalizedPath;
  const isDirectory = options?.isDirectory ?? false;
  const extension = isDirectory
    ? ""
    : (options?.extension ?? name.split(".").pop()?.toLowerCase() ?? "");

  return {
    path: normalizedPath,
    name,
    parentPath:
      options?.parentPath ?? normalizedPath.replace(/[\\/][^\\/]+$/, "") ?? "",
    extension,
    stem: isDirectory ? name : (options?.stem ?? name.replace(/\.[^.]+$/, "")),
    isDirectory,
  };
}

function buildSettingsContextMenuPreviewInvocation(
  contextKind: ExplorerMenuContextKind,
): ExplorerMenuInvocationContext {
  const currentLocation = "/workspace/greeblefs-demo";
  const fileEntry = createSettingsContextMenuPreviewEntry(
    "/workspace/greeblefs-demo/notes/alpha.txt",
  );
  const secondFileEntry = createSettingsContextMenuPreviewEntry(
    "/workspace/greeblefs-demo/notes/beta.ts",
  );
  const previewEntry = createSettingsContextMenuPreviewEntry(
    "/workspace/greeblefs-demo/renders/preview.png",
  );

  const baseInvocation: ExplorerMenuInvocationContext = {
    kind: contextKind,
    currentLocation,
    selectedEntries: [],
    primaryEntry: null,
    searchResult: null,
    previewTarget: null,
    previewContext: null,
    inputModality: "mouse",
    reducedMotion: false,
    capabilities: {
      mouse: true,
      touch: false,
      pen: false,
      keyboard: true,
    },
  };

  switch (contextKind) {
    case "background":
      return baseInvocation;
    case "multi-select":
      return {
        ...baseInvocation,
        selectedEntries: [fileEntry, secondFileEntry],
        primaryEntry: fileEntry,
      };
    case "search-result":
      return {
        ...baseInvocation,
        selectedEntries: [fileEntry],
        primaryEntry: fileEntry,
        searchResult: {
          query: "alpha notes",
          searchMode: "semantic",
        },
      };
    case "preview-pane":
      return {
        ...baseInvocation,
        selectedEntries: [previewEntry],
        primaryEntry: previewEntry,
        previewTarget: previewEntry,
        previewContext: {
          previewKind: "image",
          workflowTabId: "preview",
          workflowBaseMode: "preview",
        },
      };
    case "entry":
    default:
      return {
        ...baseInvocation,
        selectedEntries: [fileEntry],
        primaryEntry: fileEntry,
      };
  }
}

function resolveContextMenuCommandSourceLabel(
  command: ExplorerCommandDefinition,
): string {
  if (command.source === "action") {
    return `Action · ${command.packName}`;
  }
  if (command.source === "plugin") {
    return `Plugin · ${command.pluginName}`;
  }
  if (command.source === "preview") {
    return "Preview Lane";
  }
  return "Built-In";
}

function getContextMenuPreviewPathKey(path: string[]): string {
  return path.length > 0 ? path.join("/") : "root";
}

function resolveContextMenuPreviewPanels(
  rootNodes: ExplorerRuntimeMenuNode[],
  openSubmenuPath: string[],
): {
  panels: ExplorerRuntimeMenuNode[][];
  resolvedPath: string[];
} {
  const panels: ExplorerRuntimeMenuNode[][] = [rootNodes];
  const resolvedPath: string[] = [];
  let currentNodes = rootNodes;

  for (const submenuId of openSubmenuPath) {
    const submenuNode = currentNodes.find(
      (node): node is Extract<ExplorerRuntimeMenuNode, { kind: "submenu" }> =>
        node.kind === "submenu" && node.id === submenuId,
    );
    if (!submenuNode) {
      break;
    }
    panels.push(submenuNode.children);
    resolvedPath.push(submenuId);
    currentNodes = submenuNode.children;
  }

  return { panels, resolvedPath };
}

function ExplorerContextMenuPreviewPanels({
  nodes,
  density,
  showDescriptions,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: ExplorerRuntimeMenuNode[];
  density: "compact" | "balanced" | "touch";
  showDescriptions: boolean;
  selectedNodeId: string | null;
  onSelectNode?: (node: ExplorerRuntimeMenuNode) => void;
}) {
  const [openSubmenuPath, setOpenSubmenuPath] = useState<string[]>([]);
  const panelState = useMemo(
    () => resolveContextMenuPreviewPanels(nodes, openSubmenuPath),
    [nodes, openSubmenuPath],
  );

  useEffect(() => {
    setOpenSubmenuPath([]);
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div
        className="rounded border px-4 py-6 text-[11px] opacity-50"
        style={{
          borderColor: "var(--overlay-workbench-settings-card-border)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        This context currently resolves to an empty menu.
      </div>
    );
  }

  const panelWidth =
    density === "touch" ? 280 : density === "compact" ? 228 : 248;

  return (
    <div className="flex min-h-0 gap-3 overflow-x-auto pb-1">
      {panelState.panels.map((panelNodes, panelIndex) => {
        const panelPath = panelState.resolvedPath.slice(0, panelIndex);
        const panelKey = getContextMenuPreviewPathKey(panelPath);

        return (
          <div
            key={panelKey}
            className="shrink-0 rounded border py-1"
            style={{
              width: panelWidth,
              minHeight: 220,
              borderColor: "var(--overlay-explorer-preview-border)",
              background: "var(--overlay-explorer-preview-bg)",
              boxShadow: "var(--overlay-explorer-ctx-menu-shadow)",
              backdropFilter: "blur(14px)",
            }}
          >
            {panelNodes.map((node) => {
              if (node.kind === "separator") {
                return (
                  <div
                    key={node.id}
                    style={{
                      height: 1,
                      margin: "4px 0",
                      background: "var(--overlay-explorer-preview-border)",
                    }}
                  />
                );
              }

              const isSubmenuOpen =
                panelState.resolvedPath[panelIndex] === node.id;
              const isSelected = selectedNodeId === node.id;
              const panelPrefix = panelState.resolvedPath.slice(0, panelIndex);

              return (
                <button
                  key={node.id}
                  type="button"
                  onMouseEnter={() => {
                    if (node.kind === "submenu") {
                      setOpenSubmenuPath([...panelPrefix, node.id]);
                    } else {
                      setOpenSubmenuPath(panelPrefix);
                    }
                  }}
                  onClick={() => {
                    if (node.kind === "submenu") {
                      setOpenSubmenuPath([...panelPrefix, node.id]);
                    }
                    onSelectNode?.(node);
                  }}
                  className="w-full border-0 text-left"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: density === "touch" ? 12 : 10,
                    padding:
                      density === "compact"
                        ? "6px 10px"
                        : density === "touch"
                          ? "10px 14px"
                          : "7px 12px",
                    background:
                      isSubmenuOpen || isSelected
                        ? "var(--overlay-explorer-chip-active-bg)"
                        : "transparent",
                    color:
                      node.tone === "danger"
                        ? "var(--overlay-explorer-danger-text)"
                        : "var(--overlay-text-primary)",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      opacity: 0.78,
                    }}
                  >
                    {renderSettingsContextMenuIcon(node.iconName)}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span>{node.label}</span>
                    {showDescriptions &&
                    node.kind === "command" &&
                    node.description ? (
                      <span
                        style={{
                          color: "var(--overlay-text-muted)",
                          fontSize: 10,
                          lineHeight: 1.2,
                        }}
                      >
                        {node.description}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "var(--overlay-text-muted)",
                      fontSize: 10,
                    }}
                  >
                    {node.kind === "command" && node.shortcutId ? (
                      <span>{node.shortcutId}</span>
                    ) : null}
                    {node.kind === "submenu" ? (
                      <span style={{ opacity: isSubmenuOpen ? 1 : 0.72 }}>
                        ▶
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function getThemePreviewBackground(
  theme: OverlayThemeDefinition,
  previewUrl?: string,
): string {
  if (previewUrl) {
    return [
      "linear-gradient(180deg, rgba(5,10,18,0.1) 0%, rgba(5,10,18,0.72) 100%)",
      `url("${previewUrl}")`,
    ].join(", ");
  }

  return [
    `radial-gradient(circle at 18% 20%, ${theme.palette.accentSoft || `${theme.palette.accent}33`}, transparent 28%)`,
    `linear-gradient(135deg, ${theme.palette.appBackgroundAlt} 0%, ${theme.palette.appBackground} 52%, ${theme.palette.panelBackground} 100%)`,
  ].join(", ");
}

function clampThemeDescription(text: string | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
}

function getThemePackageSourceBadgeLabel(
  sourceKind: LoadedOverlayThemePackage["sourceKind"],
): string {
  switch (sourceKind) {
    case "plugin-package":
      return "Plugin Package";
    case "vscode-theme-directory":
      return "VS Code Folder";
    case "vscode-theme-vsix":
      return "VS Code VSIX";
    default:
      return "Theme Folder";
  }
}

function getIconThemePackageSourceBadgeLabel(
  sourceKind: LoadedIconThemePackage["sourceKind"],
): string {
  switch (sourceKind) {
    case "built-in":
      return "Built-In";
    case "vscode-icon-theme-directory":
      return "VS Code Folder";
    case "vscode-icon-theme-vsix":
      return "VS Code VSIX";
    default:
      return "Pack";
  }
}

type ThemeCatalogSectionId = "official-pilot" | "built-in" | "legacy-archive";

function resolveThemeCatalogSectionId(
  theme: OverlayThemeDefinition,
  packageInfo: LoadedOverlayThemePackage | undefined,
): ThemeCatalogSectionId {
  if (theme.source === "built-in") {
    return "built-in";
  }

  if (packageInfo?.catalog.isOfficialPilot) {
    return "official-pilot";
  }

  return "legacy-archive";
}

function getThemeCatalogBadgeLabel(
  sectionId: ThemeCatalogSectionId,
  packageInfo: LoadedOverlayThemePackage | undefined,
): string {
  if (sectionId === "built-in") {
    return "Built-In";
  }

  return packageInfo?.catalog.badgeLabel ?? "Package";
}

function getThemeCatalogSectionTitle(sectionId: ThemeCatalogSectionId): string {
  switch (sectionId) {
    case "official-pilot":
      return "Official Pilot Suite";
    case "built-in":
      return "Built-In Baselines";
    case "legacy-archive":
      return "Legacy / Lab Archive";
  }
}

function getThemeCatalogSectionSubtitle(
  sectionId: ThemeCatalogSectionId,
): string {
  switch (sectionId) {
    case "official-pilot":
      return "The current pilot set. These are the front-of-house themes that should feel full-screen, readable, and intentional.";
    case "built-in":
      return "Bundled baseline themes stay visible and supported as stable defaults for the app and dock.";
    case "legacy-archive":
      return "Older experiments, transitional shells, and archive material remain selectable without reading like the primary product.";
  }
}

function getThemeCatalogEntrySortRank(
  packageInfo: LoadedOverlayThemePackage | undefined,
): number {
  return packageInfo?.catalog.sortRank ?? 0;
}

function getThemeCatalogCardOpacity(sectionId: ThemeCatalogSectionId): number {
  if (sectionId === "legacy-archive") {
    return 0.82;
  }

  if (sectionId === "built-in") {
    return 0.96;
  }

  return 1;
}

function ThemeCatalogCard({
  themeOption,
  packageInfo,
  active,
  sectionId,
  onSelect,
  motionBinding,
}: {
  themeOption: OverlayThemeDefinition;
  packageInfo: LoadedOverlayThemePackage | undefined;
  active: boolean;
  sectionId: ThemeCatalogSectionId;
  onSelect: (themeId: string) => void;
  motionBinding?: InteractionMotionBinding;
}) {
  const description = clampThemeDescription(
    packageInfo?.description ?? themeOption.description,
  );
  const previewBackground = getThemePreviewBackground(
    themeOption,
    packageInfo?.previewUrl,
  );
  const compiledEngineManifest = packageInfo?.compiledEngineManifest;
  const defaultLayoutPrimitive = compiledEngineManifest?.defaultLayoutPrimitive;
  const defaultNavigationPattern =
    compiledEngineManifest?.defaultNavigationPattern;
  const defaultAnimationProfile =
    compiledEngineManifest?.defaultAnimationProfile;
  const defaultIconPack = compiledEngineManifest?.defaultIconPack;
  const defaultRenderStyle = compiledEngineManifest?.defaultRenderStyle;
  const workbenchPreset = themeOption.workbench?.preset;
  const explorerPreset = themeOption.explorer?.preset;
  const dockPreset =
    themeOption.dock?.workbench?.preset ??
    themeOption.dock?.explorer?.preset ??
    null;
  const capabilityLabels = [
    workbenchPreset ? `Workbench ${workbenchPreset}` : null,
    explorerPreset ? `Explorer ${explorerPreset}` : null,
    dockPreset ? `Dock ${dockPreset}` : null,
    themeOption.dock?.workbench || themeOption.dock?.explorer
      ? "Dock Ready"
      : null,
    packageInfo?.capabilitySummary.icons ? "Icons" : null,
    packageInfo?.capabilitySummary.shaders
      ? `Shaders ${packageInfo.capabilitySummary.shaders}`
      : null,
    packageInfo?.capabilitySummary.animations
      ? `Motion ${packageInfo.capabilitySummary.animations}`
      : null,
    packageInfo?.capabilitySummary.visuals
      ? `Visuals ${packageInfo.capabilitySummary.visuals}`
      : null,
    compiledEngineManifest?.capabilitySummary.designTokens
      ? `Tokens ${compiledEngineManifest.capabilitySummary.designTokens}`
      : null,
    packageInfo?.capabilitySummary.themeRenderer ? "Renderer V2" : null,
  ]
    .filter((value): value is string => Boolean(value))
    .slice(0, 10);

  return (
    <button
      type="button"
      data-theme-catalog-theme-id={themeOption.id}
      onClick={() => onSelect(themeOption.id)}
      className="overflow-hidden rounded text-left transition-opacity hover:opacity-100"
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        opacity: getThemeCatalogCardOpacity(sectionId),
        background: themeOption.palette.appBackground,
        border: `1px solid ${active ? themeOption.palette.accent : themeOption.palette.border}`,
        color: themeOption.palette.textPrimary,
        boxShadow: active
          ? `0 0 0 1px ${themeOption.palette.accent}40 inset`
          : "none",
        ...motionBinding?.motionStyle,
      }}
    >
      <div
        className="relative w-full"
        style={{
          minHeight: sectionId === "official-pilot" ? "11rem" : "6.75rem",
          backgroundImage: previewBackground,
          backgroundSize: packageInfo?.previewUrl ? "cover" : "100% 100%",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <div className="flex flex-wrap items-center gap-1">
            <ThemeBadge
              label={getThemeSourceLabel(themeOption)}
              active={active}
            />
            {packageInfo ? (
              <ThemeBadge
                label={getThemePackageSourceBadgeLabel(packageInfo.sourceKind)}
                active={active}
              />
            ) : null}
            <ThemeBadge
              label={getThemeCatalogBadgeLabel(sectionId, packageInfo)}
              active={active}
            />
          </div>
          {packageInfo ? (
            <div className="flex items-center gap-1">
              {packageInfo?.warnings.length ? (
                <ThemeBadge label={`Warnings ${packageInfo.warnings.length}`} />
              ) : null}
              <ThemeBadge label={`v${packageInfo.version}`} active={active} />
              {packageInfo.author ? (
                <ThemeBadge label={packageInfo.author} />
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: themeOption.palette.accent }}
            />
            <div className="truncate text-[11px] font-semibold">
              {themeOption.name}
            </div>
          </div>
          {active && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] opacity-75">
              Live
            </span>
          )}
        </div>
      </div>
      <div
        className={
          sectionId === "legacy-archive"
            ? "space-y-2 px-3 py-2.5"
            : "space-y-2 px-3 py-3"
        }
      >
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] opacity-55">
          <span>{themeOption.id}</span>
          {packageInfo?.sourceLabel ? (
            <>
              <span aria-hidden="true">•</span>
              <span>{packageInfo.sourceLabel}</span>
            </>
          ) : null}
          {packageInfo?.homepage ? (
            <span>
              •{" "}
              {packageInfo.homepage
                .replace(/^https?:\/\//, "")
                .replace(/\/$/, "")}
            </span>
          ) : null}
        </div>
        {description ? (
          <p
            className={
              sectionId === "official-pilot"
                ? "min-h-[3rem] text-[11px] leading-4 opacity-75"
                : "min-h-[2.5rem] text-[11px] leading-4 opacity-70"
            }
          >
            {description}
          </p>
        ) : (
          <p className="min-h-[2.5rem] text-[11px] leading-4 opacity-35">
            No package summary provided yet.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {defaultLayoutPrimitive ? (
            <ThemeBadge
              label={`Layout ${defaultLayoutPrimitive.kind}`}
              active={active}
            />
          ) : null}
          {defaultNavigationPattern ? (
            <ThemeBadge
              label={`Nav ${defaultNavigationPattern.kind}`}
              active={active}
            />
          ) : null}
          {defaultIconPack ? (
            <ThemeBadge
              label={`Icons ${defaultIconPack.style}`}
              active={active}
            />
          ) : null}
          {defaultRenderStyle ? (
            <ThemeBadge
              label={`Render ${defaultRenderStyle.kind}`}
              active={active}
            />
          ) : null}
          {compiledEngineManifest?.supportsHotSwappingRenderStyles ? (
            <ThemeBadge label="Live Swap Ready" active={active} />
          ) : compiledEngineManifest ? (
            <ThemeBadge label="Static Render" active={active} />
          ) : null}
          {themeOption.defaultShaderId ? (
            <ThemeBadge
              label={`Shader ${themeOption.defaultShaderId}`}
              active={active}
            />
          ) : null}
          {themeOption.defaultOpenAnimationId ? (
            <ThemeBadge
              label={`Open ${themeOption.defaultOpenAnimationId}`}
              active={active}
            />
          ) : null}
          {themeOption.defaultCloseAnimationId ? (
            <ThemeBadge
              label={`Close ${themeOption.defaultCloseAnimationId}`}
              active={active}
            />
          ) : null}
          {defaultAnimationProfile ? (
            <ThemeBadge
              label={`Profile ${defaultAnimationProfile.id}`}
              active={active}
            />
          ) : null}
          {capabilityLabels.map((label) => (
            <ThemeBadge key={`${themeOption.id}-${label}`} label={label} />
          ))}
          {(packageInfo?.tags ?? []).slice(0, 3).map((tag) => (
            <ThemeBadge key={`${themeOption.id}-tag-${tag}`} label={tag} />
          ))}
        </div>
        {packageInfo?.warnings.length ? (
          <div
            className="rounded border px-2.5 py-2 text-[10px] leading-4"
            style={{
              borderColor: "rgba(245,158,11,0.32)",
              background: "rgba(245,158,11,0.12)",
              color: "#fde68a",
            }}
          >
            {packageInfo.warnings.map((warning) => (
              <div key={`${themeOption.id}-${warning}`}>{warning}</div>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function ThemeCatalogSection({
  sectionId,
  themes,
  activeThemeId,
  onSelect,
  themePackageLookup,
  createThemeCardMotion,
}: {
  sectionId: ThemeCatalogSectionId;
  themes: OverlayThemeDefinition[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
}) {
  if (themes.length === 0) {
    return null;
  }

  const isOfficialSuite = sectionId === "official-pilot";
  const sectionStyle =
    sectionId === "official-pilot"
      ? {
          borderColor: "rgba(125,211,255,0.34)",
          background:
            "linear-gradient(180deg, rgba(16,22,34,0.94) 0%, rgba(10,14,24,0.98) 100%)",
        }
      : sectionId === "built-in"
        ? {
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
          }
        : {
            borderColor: "rgba(148,163,184,0.18)",
            background: "rgba(255,255,255,0.018)",
            opacity: 0.92,
          };

  const sortedThemes = [...themes].sort((left, right) => {
    const leftPackageInfo = themePackageLookup.get(left.id);
    const rightPackageInfo = themePackageLookup.get(right.id);
    const leftWeight = getThemeCatalogEntrySortRank(leftPackageInfo);
    const rightWeight = getThemeCatalogEntrySortRank(rightPackageInfo);
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return left.name.localeCompare(right.name);
  });

  return (
    <section
      data-theme-catalog-group={sectionId}
      className="rounded border p-3"
      style={sectionStyle}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-65">
            {isOfficialSuite ? (
              <Sparkles size={11} />
            ) : (
              <LayoutGrid size={11} />
            )}
            <span>{getThemeCatalogSectionTitle(sectionId)}</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-48">
            {getThemeCatalogSectionSubtitle(sectionId)}
          </p>
        </div>
        <ThemeBadge
          label={`${themes.length} theme${themes.length === 1 ? "" : "s"}`}
          active={isOfficialSuite}
        />
      </div>
      <div
        className={
          isOfficialSuite
            ? "grid grid-cols-1 gap-4 xl:grid-cols-2"
            : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
        }
      >
        {sortedThemes.map((themeOption, index) => {
          const packageInfo = themePackageLookup.get(themeOption.id);
          const active = activeThemeId === themeOption.id;
          const themeSectionId = resolveThemeCatalogSectionId(
            themeOption,
            packageInfo,
          );

          return (
            <ThemeCatalogCard
              key={getThemeCatalogEntryKey(themeOption, packageInfo, index)}
              themeOption={themeOption}
              packageInfo={packageInfo}
              active={active}
              sectionId={themeSectionId}
              onSelect={onSelect}
              motionBinding={createThemeCardMotion?.(active)}
            />
          );
        })}
      </div>
    </section>
  );
}

function getThemeCatalogEntryKey(
  theme: OverlayThemeDefinition,
  packageInfo: LoadedOverlayThemePackage | undefined,
  index: number,
): string {
  const sourceKind = packageInfo?.sourceKind ?? theme.source ?? "built-in";
  const sourceLabel =
    packageInfo?.sourceLabel ?? packageInfo?.directoryPath ?? "catalog";
  return `${theme.id}:${sourceKind}:${sourceLabel}:${index}`;
}

function ThemeCatalogGrid({
  themes,
  activeThemeId,
  onSelect,
  themePackageLookup,
  createThemeCardMotion,
}: {
  themes: OverlayThemeDefinition[];
  activeThemeId: string | null;
  onSelect: (themeId: string) => void;
  themePackageLookup: Map<string, LoadedOverlayThemePackage>;
  createThemeCardMotion?: (active: boolean) => InteractionMotionBinding;
}) {
  const catalogSections = useMemo(() => {
    const groupedThemes: Record<
      ThemeCatalogSectionId,
      OverlayThemeDefinition[]
    > = {
      "official-pilot": [],
      "built-in": [],
      "legacy-archive": [],
    };

    themes.forEach((themeOption) => {
      const packageInfo = themePackageLookup.get(themeOption.id);
      const sectionId = resolveThemeCatalogSectionId(themeOption, packageInfo);
      groupedThemes[sectionId].push(themeOption);
    });

    return (["official-pilot", "built-in", "legacy-archive"] as const).map(
      (sectionId) => ({
        sectionId,
        themes: groupedThemes[sectionId],
      }),
    );
  }, [themes, themePackageLookup]);

  return (
    <div className="space-y-4">
      {catalogSections.map((section) => (
        <ThemeCatalogSection
          key={section.sectionId}
          sectionId={section.sectionId}
          themes={section.themes}
          activeThemeId={activeThemeId}
          onSelect={onSelect}
          themePackageLookup={themePackageLookup}
          createThemeCardMotion={createThemeCardMotion}
        />
      ))}
    </div>
  );
}

function summarizeTopBarControls(
  topBar: LoadedOverlayTopBarDefinition,
): string {
  const prioritizedControls = [
    ...topBar.navigationShortcuts,
    ...topBar.leadingControls,
    ...topBar.trailingControls,
  ];

  const labels = Array.from(
    new Set(
      prioritizedControls.map((controlId) => getTopBarControlLabel(controlId)),
    ),
  );

  return labels.slice(0, 4).join(" · ");
}

function TopBarCatalogCard({
  topBar,
  active,
  border,
  accent,
  text,
  muted,
  onClick,
}: {
  topBar: LoadedOverlayTopBarDefinition;
  active: boolean;
  border: string;
  accent: string;
  text: string;
  muted: string;
  onClick: () => void;
}) {
  const controlSummary = summarizeTopBarControls(topBar);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border p-3 text-left transition-colors"
      style={{
        borderColor: active ? accent : border,
        background: active ? `${accent}12` : "rgba(255,255,255,0.03)",
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : "none",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold">{topBar.name}</div>
          <div className="mt-1 text-[11px] leading-4 opacity-55">
            {topBar.description}
          </div>
        </div>
        {active ? <ThemeBadge label="Pinned" active /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ThemeBadge
          label={getTopBarSourceLabel(topBar.source)}
          active={active}
        />
        <ThemeBadge
          label={getTopBarStyleLabel(topBar.topBarStyle)}
          active={active}
        />
        <ThemeBadge
          label={getTopBarNavigationModeLabel(topBar.navigationMode)}
          active={active}
        />
        {topBar.tags.slice(0, 2).map((tag) => (
          <ThemeBadge key={`${topBar.id}-${tag}`} label={tag} />
        ))}
      </div>
      {controlSummary ? (
        <div
          className="mt-3 text-[10px] uppercase tracking-[0.12em]"
          style={{ color: active ? accent : muted }}
        >
          {controlSummary}
        </div>
      ) : null}
    </button>
  );
}

type ThemeBundleCatalogSourceKind = "standalone" | "theme-contributed";

interface ThemeBundleCatalogEntry<
  TPack extends {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    warnings: string[];
    localId?: string;
  },
> {
  pack: TPack;
  sourceKind: ThemeBundleCatalogSourceKind;
  sourceLabel: string;
  sourceThemeId?: string;
}

interface ThemeBundleCatalogCardOption {
  id: string;
  name: string;
  description?: string;
  badges: string[];
  summary?: string;
  sourceKind: ThemeBundleCatalogSourceKind;
  sourceLabel: string;
  tags: string[];
  warnings: string[];
}

function buildThemeBundleCatalogEntries<
  TPack extends {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    warnings: string[];
    localId?: string;
  },
>(
  standalonePacks: readonly TPack[],
  themePackages: readonly LoadedOverlayThemePackage[],
  selectLocalPacks: (
    themePackage: LoadedOverlayThemePackage,
  ) => readonly TPack[],
): ThemeBundleCatalogEntry<TPack>[] {
  const entryMap = new Map<string, ThemeBundleCatalogEntry<TPack>>();

  for (const pack of standalonePacks) {
    entryMap.set(pack.id, {
      pack,
      sourceKind: "standalone",
      sourceLabel: "Standalone",
    });
  }

  for (const themePackage of themePackages) {
    for (const pack of selectLocalPacks(themePackage)) {
      entryMap.set(pack.id, {
        pack,
        sourceKind: "theme-contributed",
        sourceLabel: themePackage.name,
        sourceThemeId: themePackage.id,
      });
    }
  }

  return [...entryMap.values()].sort((left, right) =>
    left.pack.name.localeCompare(right.pack.name),
  );
}

function findThemeBundleCatalogPack<
  TPack extends { id: string; localId?: string },
>(
  packs: readonly TPack[],
  requestedId: string | null | undefined,
): TPack | null {
  const trimmedId = requestedId?.trim();
  if (!trimmedId) {
    return null;
  }

  return (
    packs.find((pack) => pack.id === trimmedId || pack.localId === trimmedId) ??
    null
  );
}

function findThemeBundleCatalogEntry<
  TPack extends {
    id: string;
    localId?: string;
    name: string;
    description?: string;
    tags: string[];
    warnings: string[];
  },
>(
  entries: readonly ThemeBundleCatalogEntry<TPack>[],
  requestedId: string | null | undefined,
): ThemeBundleCatalogEntry<TPack> | null {
  const trimmedId = requestedId?.trim();
  if (!trimmedId) {
    return null;
  }

  return (
    entries.find(
      (entry) =>
        entry.pack.id === trimmedId || entry.pack.localId === trimmedId,
    ) ?? null
  );
}

function findEmbeddedThemeBundleManifestPack<
  TPack extends { id?: string; name?: string },
>(
  packs: readonly TPack[] | undefined,
  requestedId: string | null | undefined,
): TPack | null {
  const trimmedId = requestedId?.trim();
  if (!trimmedId) {
    return null;
  }

  return packs?.find((pack) => pack.id?.trim() === trimmedId) ?? null;
}

function resolveThemeBundlePackSelectionLabel<
  TPack extends {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    warnings: string[];
    localId?: string;
  },
  TEmbedded extends { id?: string; name?: string },
>(args: {
  requestedId: string | null | undefined;
  entries: readonly ThemeBundleCatalogEntry<TPack>[];
  activeThemeLocalPacks?: readonly TPack[];
  embeddedPacks?: readonly TEmbedded[];
  emptyLabel?: string;
}): string {
  const trimmedId = args.requestedId?.trim();
  if (!trimmedId) {
    return args.emptyLabel ?? "None";
  }

  const localMatch = findThemeBundleCatalogPack(
    args.activeThemeLocalPacks ?? [],
    trimmedId,
  );
  if (localMatch) {
    return localMatch.name;
  }

  const catalogMatch = findThemeBundleCatalogEntry(args.entries, trimmedId);
  if (catalogMatch) {
    return catalogMatch.pack.name;
  }

  const embeddedMatch = findEmbeddedThemeBundleManifestPack(
    args.embeddedPacks,
    trimmedId,
  );
  if (embeddedMatch?.name?.trim()) {
    return embeddedMatch.name.trim();
  }

  return trimmedId;
}

function getThemeBundleCatalogSourceBadgeLabel(
  sourceKind: ThemeBundleCatalogSourceKind,
  sourceLabel: string,
): string {
  return sourceKind === "standalone" ? "Standalone" : sourceLabel;
}

function ThemeBundlePackCatalogCard({
  option,
  active,
  border,
  accent,
  text,
  muted,
  onClick,
}: {
  option: ThemeBundleCatalogCardOption;
  active: boolean;
  border: string;
  accent: string;
  text: string;
  muted: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded border p-3 text-left transition-colors"
      style={{
        borderColor: active ? accent : border,
        background: active ? `${accent}12` : "rgba(255,255,255,0.03)",
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : "none",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold">{option.name}</div>
          {option.description ? (
            <div className="mt-1 text-[11px] leading-4 opacity-55">
              {option.description}
            </div>
          ) : null}
        </div>
        {active ? <ThemeBadge label="Pinned" active /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ThemeBadge
          label={getThemeBundleCatalogSourceBadgeLabel(
            option.sourceKind,
            option.sourceLabel,
          )}
          active={active}
        />
        {option.badges.map((badge) => (
          <ThemeBadge
            key={`${option.id}-${badge}`}
            label={badge}
            active={active}
          />
        ))}
        {option.tags.slice(0, 2).map((tag) => (
          <ThemeBadge key={`${option.id}-tag-${tag}`} label={tag} />
        ))}
        {option.warnings.length > 0 ? (
          <ThemeBadge label={`${option.warnings.length} warnings`} />
        ) : null}
      </div>

      {option.summary ? (
        <div
          className="mt-3 text-[10px] uppercase tracking-[0.12em]"
          style={{ color: active ? accent : muted }}
        >
          {option.summary}
        </div>
      ) : null}
    </button>
  );
}

function countThemeBundleCatalogEntriesBySource<
  TPack extends {
    id: string;
    name: string;
    description?: string;
    tags: string[];
    warnings: string[];
    localId?: string;
  },
>(
  entries: readonly ThemeBundleCatalogEntry<TPack>[],
): { standaloneCount: number; themeContributedCount: number } {
  return entries.reduce(
    (counts, entry) => {
      if (entry.sourceKind === "standalone") {
        counts.standaloneCount += 1;
      } else {
        counts.themeContributedCount += 1;
      }
      return counts;
    },
    {
      standaloneCount: 0,
      themeContributedCount: 0,
    },
  );
}

function hasThemeBundlePackSelection<
  TPack extends {
    id: string;
    localId?: string;
    name: string;
    description?: string;
    tags: string[];
    warnings: string[];
  },
  TEmbedded extends { id?: string; name?: string },
>(args: {
  requestedId: string | null | undefined;
  entries: readonly ThemeBundleCatalogEntry<TPack>[];
  activeThemeLocalPacks?: readonly TPack[];
  embeddedPacks?: readonly TEmbedded[];
}): boolean {
  const trimmedId = args.requestedId?.trim();
  if (!trimmedId) {
    return true;
  }

  return Boolean(
    findThemeBundleCatalogPack(args.activeThemeLocalPacks ?? [], trimmedId) ||
    findThemeBundleCatalogEntry(args.entries, trimmedId) ||
    findEmbeddedThemeBundleManifestPack(args.embeddedPacks, trimmedId),
  );
}

function ThemeBundlePackSettingsSection({
  icon,
  title,
  subtitle,
  catalogTitle,
  catalogDescription,
  directoryPath,
  currentLabel,
  modeLabel,
  loading,
  catalogCountLabel,
  standaloneCount,
  themeContributedCount,
  followThemeDetail,
  followThemeDescription,
  followThemeResolvedLabel,
  followThemeSourceLabel,
  followThemeActive,
  activeOptionId,
  options,
  emptyCatalogMessage,
  pinnedSelectionMissingMessage,
  error,
  errorLabel,
  warnings,
  warningsLabel,
  onFollowTheme,
  onSelect,
  onRefresh,
  onOpenFolder,
  border,
  accent,
  text,
  muted,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  catalogTitle: string;
  catalogDescription: ReactNode;
  directoryPath: string;
  currentLabel: string;
  modeLabel: string;
  loading: boolean;
  catalogCountLabel: string;
  standaloneCount: number;
  themeContributedCount: number;
  followThemeDetail: string;
  followThemeDescription: string;
  followThemeResolvedLabel: string;
  followThemeSourceLabel: string;
  followThemeActive: boolean;
  activeOptionId: string | null;
  options: readonly ThemeBundleCatalogCardOption[];
  emptyCatalogMessage: string;
  pinnedSelectionMissingMessage?: string | null;
  error?: string | null;
  errorLabel: string;
  warnings: readonly string[];
  warningsLabel: string;
  onFollowTheme: () => void;
  onSelect: (id: string) => void;
  onRefresh: () => void | Promise<void>;
  onOpenFolder: () => void | Promise<void>;
  border: string;
  accent: string;
  text: string;
  muted: string;
}) {
  return (
    <section
      className="rounded border p-4"
      style={{ borderColor: border, background: "rgba(255,255,255,0.03)" }}
    >
      <SectionTitle icon={icon} title={title} subtitle={subtitle} />

      <div className="mt-4 space-y-4">
        <div
          className="rounded border p-3"
          style={{ borderColor: border, background: "rgba(255,255,255,0.025)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                {catalogTitle}
              </div>
              <div className="mt-1 text-[11px] opacity-40">
                {catalogDescription}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  border: `1px solid ${border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                <RefreshCw size={10} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void onOpenFolder()}
                className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  border: `1px solid ${accent}`,
                  background: `${accent}18`,
                  color: text,
                }}
              >
                Open Folder
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.04)",
                color: text,
              }}
            >
              Current: {currentLabel}
            </span>
            <span
              className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.04)",
                color: muted,
              }}
            >
              Mode: {modeLabel}
            </span>
            <span
              className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.04)",
                color: muted,
              }}
            >
              {loading ? "Scanning Catalog" : catalogCountLabel}
            </span>
            <span
              className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.04)",
                color: muted,
              }}
            >
              Standalone: {standaloneCount}
            </span>
            <span
              className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.04)",
                color: muted,
              }}
            >
              Theme Contributed: {themeContributedCount}
            </span>
          </div>

          <div
            className="mt-3 rounded border px-3 py-2 text-[11px]"
            style={{
              borderColor: `${accent}33`,
              background: `${accent}10`,
              color: text,
            }}
          >
            {followThemeDetail}
          </div>

          <div
            className="mt-3 rounded border px-3 py-2 text-[11px]"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.025)",
              color: muted,
            }}
          >
            Standalone packs refresh from <code>{directoryPath}</code>.
            Theme-contributed packs still refresh from the active theme bundle
            pipeline.
          </div>

          {error ? (
            <div
              className="mt-3 rounded border px-3 py-2 text-[11px]"
              style={{
                borderColor: "#7f1d1d",
                background: "rgba(127,29,29,0.18)",
                color: "#fecaca",
              }}
            >
              {errorLabel}: {error}
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div
              className="mt-3 rounded border px-3 py-3 text-[11px]"
              style={{
                borderColor: "#854d0e",
                background: "rgba(133,77,14,0.18)",
                color: "#fde68a",
              }}
            >
              <div className="font-semibold uppercase tracking-[0.12em]">
                {warningsLabel}
              </div>
              <div className="mt-2 space-y-1.5">
                {warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            </div>
          ) : null}

          {pinnedSelectionMissingMessage ? (
            <div
              className="mt-3 rounded border px-3 py-2 text-[11px]"
              style={{
                borderColor: "#854d0e",
                background: "rgba(133,77,14,0.18)",
                color: "#fde68a",
              }}
            >
              {pinnedSelectionMissingMessage}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
            Selection
          </label>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <button
              type="button"
              onClick={onFollowTheme}
              className="w-full rounded border p-3 text-left transition-colors"
              style={{
                borderColor: followThemeActive ? accent : border,
                background: followThemeActive
                  ? `${accent}12`
                  : "rgba(255,255,255,0.03)",
                color: text,
                boxShadow: followThemeActive
                  ? `inset 0 0 0 1px ${accent}22`
                  : "none",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold">Follow Theme</div>
                  <div className="mt-1 text-[11px] leading-4 opacity-55">
                    {followThemeDescription}
                  </div>
                </div>
                {followThemeActive ? (
                  <ThemeBadge label="Active" active />
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ThemeBadge
                  label={`Resolved ${followThemeResolvedLabel}`}
                  active={followThemeActive}
                />
                <ThemeBadge label={followThemeSourceLabel} />
                <ThemeBadge label="Theme Default" />
              </div>
            </button>

            {options.length > 0 ? (
              options.map((option) => (
                <ThemeBundlePackCatalogCard
                  key={option.id}
                  option={option}
                  active={!followThemeActive && option.id === activeOptionId}
                  border={border}
                  accent={accent}
                  text={text}
                  muted={muted}
                  onClick={() => onSelect(option.id)}
                />
              ))
            ) : (
              <div
                className="rounded border px-3 py-3 text-[11px] opacity-45"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {emptyCatalogMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ColorToken({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className="flex flex-col gap-1 rounded border p-2"
      style={{
        borderColor: "var(--overlay-workbench-settings-card-border)",
        background: "var(--overlay-workbench-settings-card-bg)",
      }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-50">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-9 rounded border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-[10px] outline-none"
        />
      </div>
    </label>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-60">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-4 opacity-40">{subtitle}</p>
      </div>
    </div>
  );
}

type RgbColor = { r: number; g: number; b: number };

function parseCssColorToRgb(color: string | undefined): RgbColor | null {
  const trimmed = color?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }

  const channels = rgbMatch[1]
    .split(",")
    .slice(0, 3)
    .map((channel) => Number.parseFloat(channel.trim()));

  if (
    channels.length < 3 ||
    channels.some((channel) => Number.isNaN(channel))
  ) {
    return null;
  }

  return {
    r: channels[0] ?? 0,
    g: channels[1] ?? 0,
    b: channels[2] ?? 0,
  };
}

function getRelativeColorLuminance(color: RgbColor): number {
  const normalize = (channel: number) => {
    const srgb = Math.max(0, Math.min(255, channel)) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * normalize(color.r) +
    0.7152 * normalize(color.g) +
    0.0722 * normalize(color.b)
  );
}

function resolveSettingsFormColorScheme(
  backgroundColor: string,
  textColor: string,
): "light" | "dark" {
  const backgroundRgb = parseCssColorToRgb(backgroundColor);
  if (backgroundRgb) {
    return getRelativeColorLuminance(backgroundRgb) < 0.42 ? "dark" : "light";
  }

  const textRgb = parseCssColorToRgb(textColor);
  if (textRgb) {
    return getRelativeColorLuminance(textRgb) > 0.58 ? "dark" : "light";
  }

  return "dark";
}

function RangeField({
  label,
  description,
  min,
  max,
  step,
  value,
  valueLabel,
  onChange,
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <label
      className="rounded border p-3"
      style={{
        borderColor: "var(--overlay-workbench-settings-card-border)",
        background: "var(--overlay-workbench-settings-card-bg)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            {label}
          </div>
          <p className="mt-1 text-[11px] opacity-40">{description}</p>
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {valueLabel}
        </span>
      </div>
      <div className="mt-3">
        <PremiumSlider
          ariaLabel={label}
          ariaValueText={valueLabel}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
        />
      </div>
    </label>
  );
}

function formatShaderControlValue(
  control: OverlayShaderControlDefinition,
  value: number,
): string {
  if (control.formatValue) {
    return control.formatValue(value);
  }

  if (control.step >= 1) {
    return `${Math.round(value)}`;
  }

  const decimals = `${control.step}`.split(".")[1]?.length ?? 2;
  return value.toFixed(Math.min(decimals, 3));
}

function ShortcutField({
  bindingKey,
  value,
  onCommit,
}: {
  bindingKey: HotkeyBindingKey;
  value: string;
  onCommit: (value: string) => void;
}) {
  const definition = getHotkeyBindingDefinition(bindingKey);
  return (
    <ShortcutEditorCard
      label={definition.label}
      description={definition.description}
      scopeLabel={definition.scope}
      value={value}
      defaultValue={definition.defaultValue}
      onCommit={onCommit}
      resetLabel="Reset"
    />
  );
}

function formatExplorerChromeSurfaceLabel(
  surfaceId: ExplorerCustomizeCatalogEntry["surfaces"][number],
): string {
  switch (surfaceId) {
    case "explorerTopbar":
      return "Top Bar";
    case "explorerToolbar":
      return "Toolbar";
    case "workspaceHeader":
      return "Workspace";
    case "railHeader":
      return "Sources Rail";
    case "previewHeader":
      return "Preview";
    case "explorerStatusBar":
      return "Status Bar";
    default:
      return surfaceId;
  }
}

function ShortcutEditorCard({
  label,
  description,
  scopeLabel,
  value,
  defaultValue,
  onCommit,
  resetLabel = "Reset",
}: {
  label: string;
  description: string;
  scopeLabel: string;
  value: string;
  defaultValue: string;
  onCommit: (value: string) => void;
  resetLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const showInlineDescriptions = useSettingsRowDescriptionsVisible();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    const normalized = normalizeKeybindingValue(draft, defaultValue);
    setDraft(normalized);
    onCommit(normalized);
  }, [defaultValue, draft, onCommit]);

  return (
    <label
      className="rounded border p-3"
      style={{
        borderColor: "var(--overlay-workbench-settings-card-border)",
        background: "var(--overlay-workbench-settings-card-bg)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
              {label}
            </div>
            {showInlineDescriptions ? null : (
              <InfoBubble
                description={description}
                label={`About ${label}`}
              />
            )}
          </div>
          {showInlineDescriptions ? (
            <p className="mt-1 text-[11px] opacity-45">{description}</p>
          ) : null}
        </div>
        <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          {scopeLabel}
        </span>
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(value);
          }
        }}
        className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] opacity-45">
        <span>Live value: {formatHotkeyLabel(value)}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(defaultValue);
            onCommit(defaultValue);
          }}
          className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {resetLabel}
        </button>
      </div>
    </label>
  );
}

function CommandShortcutField({
  label,
  description,
  surfaces,
  value,
  onCommit,
}: {
  label: string;
  description: string;
  surfaces: ExplorerCustomizeCatalogEntry["surfaces"];
  value: string;
  onCommit: (value: string) => void;
}) {
  const scopeLabel = surfaces
    .map((surfaceId) => formatExplorerChromeSurfaceLabel(surfaceId))
    .join(" · ");
  return (
    <ShortcutEditorCard
      label={label}
      description={description}
      scopeLabel={scopeLabel || "Explorer"}
      value={value}
      defaultValue=""
      onCommit={onCommit}
      resetLabel="Clear"
    />
  );
}

function parseMatcherInput(value: string): string[] {
  return value
    .split(",")
    .map((part) => normalizeFolderIconMatcher(part))
    .filter(Boolean);
}

function stringifyMatchers(matchers: string[]): string {
  return matchers.join(", ");
}

const legacySettingsExtractionKeepalive = {
  getIconThemePackageSourceBadgeLabel,
  ThemeCatalogGrid,
  ColorToken,
  parseMatcherInput,
  stringifyMatchers,
};
void legacySettingsExtractionKeepalive;

const DEFAULT_LOADED_LAYOUT_MANIFEST: LoadedLayoutManifest = {
  manifest: BUILT_IN_LAYOUT_MANIFEST,
  sourcePath: null,
  sourceType: "built-in",
  sourceError: null,
};

function SettingsRailButton({
  active,
  icon,
  label,
  subtitle,
  summary,
  accent,
  border,
  text,
  muted,
  onClick,
  motionBinding,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  subtitle: string;
  summary: string;
  accent: string;
  border: string;
  text: string;
  muted: string;
  onClick: () => void;
  motionBinding?: InteractionMotionBinding;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={subtitle}
      className="w-full rounded px-2 py-2 text-left transition-colors"
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        border: `1px solid ${active ? `${accent}88` : border}`,
        background: active
          ? "var(--overlay-workbench-chrome-button-active-bg)"
          : "var(--overlay-workbench-settings-rail-bg)",
        color: text,
        boxShadow: active ? `inset 0 0 0 1px ${accent}22` : "none",
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{
            background: active
              ? "var(--overlay-workbench-chrome-button-active-bg)"
              : "var(--overlay-workbench-settings-badge-bg)",
            color: active ? accent : muted,
            border: `1px solid ${active ? `${accent}55` : "var(--overlay-workbench-settings-badge-border)"}`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em]">
            {label}
          </div>
          <div
            className="mt-0.5 text-[10px] leading-4"
            style={{ color: active ? accent : muted }}
          >
            {summary}
          </div>
        </div>
      </div>
    </button>
  );
}

function getSettingsSectionIcon(sectionKey: SettingsSectionKey): ReactNode {
  switch (sectionKey) {
    case "overview":
      return <Sparkles size={14} />;
    case "system":
      return <Settings2 size={14} />;
    case "models":
      return <Bot size={14} />;
    case "terminal":
      return <TerminalSquare size={14} />;
    case "explorer":
      return <FolderOpen size={14} />;
    case "context-menus":
      return <Puzzle size={14} />;
    case "home":
      return <Home size={14} />;
    case "layouts":
      return <LayoutGrid size={14} />;
    case "hotkeys":
      return <SlidersHorizontal size={14} />;
    case "cloud":
      return <HardDrive size={14} />;
    case "mobile":
      return <ShieldCheck size={14} />;
    case "screenshots":
      return <Camera size={14} />;
    case "audio":
      return <Music size={14} />;
    case "appearance":
      return <Palette size={14} />;
    case "appearance-packs":
      return <Sparkles size={14} />;
    case "theme-recipes":
      return <LayoutGrid size={14} />;
    case "theme-engines":
      return <Cpu size={14} />;
    case "shell-renderers":
      return <MonitorPlay size={14} />;
    case "top-bars":
      return <SlidersHorizontal size={14} />;
    case "icons":
      return <Image size={14} />;
    case "wallpapers":
      return <MonitorPlay size={14} />;
    case "shaders":
      return <Sparkles size={14} />;
    case "animations":
      return <RotateCcw size={14} />;
    case "interaction-motion":
      return <Sparkles size={14} />;
    case "layout-dynamics":
      return <LayoutGrid size={14} />;
    case "theme-json":
      return <Type size={14} />;
  }

  return <Settings2 size={14} />;
}

interface SettingsSectionContentContext {
  effectiveThemeName: string;
  activeLayoutLabel: string;
  workspaceRootCount: number;
  installedModelCount: number;
  localModelCacheFootprint: string;
  semanticIndexModelSummary: string;
  launchAtStartup: boolean;
  startMobileShareOnBoot: boolean;
  systemPresentationState: ReturnType<typeof resolveSystemPresentationState>;
  platform: "windows" | "macos" | "linux" | "unknown";
  terminalWindowMode: TerminalWindowMode;
  terminalPreferredOpenMode: "integrated" | "external";
  terminalCursorStyle: string;
  explorerViewModeLabel: string;
  explorerFolderClickMode: "single" | "double";
  explorerThumbnailsEnabled: boolean;
  activeMenuPackSummary: string;
  availableMenuPacksCount: number;
  customizedContextMenuContextCount: number;
  homePackSummary: string;
  layoutProfileCount: number;
  zenFocusMode: boolean;
  hotkeyLabels: string[];
  connectedCloudAccountCount: number;
  configuredCloudProviderCount: number;
  mobileRemoteAccessSummary: string;
  screenshotDefaultCaptureMode: ScreenshotCaptureModeId;
  screenshotDefaultOutputAction: ScreenshotOutputActionId;
  screenshotShowGrid: boolean;
  audioFolderCount: number;
  soundPackSelectionSummary: string;
  availableSoundPacksCount: number;
  soundEffectsEnabled: boolean;
  nativeNotificationsEnabled: boolean;
  appearancePackSelectionSummary: string;
  availableAppearancePacksCount: number;
  availableWallpapersCount: number;
  themeWallpaperAvailable: boolean;
  wallpaperFailureCount: number;
  themeRecipeSelectionSummary: string;
  availableThemeRecipePacksCount: number;
  themeEngineSelectionSummary: string;
  availableThemeEnginePacksCount: number;
  shellRendererSelectionSummary: string;
  availableShellRenderersCount: number;
  availableShadersCount: number;
  shaderPerformanceLabel: string;
  shaderFailureCount: number;
  availableAnimationsCount: number;
  animationFailureCount: number;
  interactionMotionEnabled: boolean;
  interactionMotionProfileLabel: string;
  interactionMotionSurfaceCount: number;
  layoutDynamicsEnabled: boolean;
  layoutDynamicsProfileLabel: string;
  layoutDynamicsSurfaceCount: number;
  topBarSelectionSummary: string;
  availableTopBarsCount: number;
  followThemeTopBarDetail: string;
  iconThemeSelectionSummary: string;
  appOpacity: number;
  panelTransparency: number;
  appZoom: number;
  appBlurStrength: number;
}

function getSettingsSectionContent(
  sectionKey: SettingsSectionKey,
  context: SettingsSectionContentContext,
): { summary: string; detail: string } {
  switch (sectionKey) {
    case "overview":
      return {
        summary: `${context.effectiveThemeName} · ${context.activeLayoutLabel} · ${context.workspaceRootCount} workspace roots`,
        detail:
          "Orient new operators quickly: learn the panel handoff flow, jump into key settings areas, and open the authoring folders that define the release surface.",
      };
    case "system":
      return {
        summary: [
          context.launchAtStartup ? "Startup on" : "Startup off",
          context.startMobileShareOnBoot ? "Mobile boot on" : "Mobile boot off",
          context.systemPresentationState.trayVisible ? "Tray on" : "Tray off",
          context.systemPresentationState.taskbarVisible
            ? "Taskbar on"
            : "Taskbar off",
        ].join(" · "),
        detail: `Handle machine-level behavior like login launch and the ${context.systemPresentationState.recoveryPath === "tray" ? "tray" : context.platform === "macos" ? "Dock" : "taskbar"} recovery path in one place.`,
      };
    case "models":
      return {
        summary: `${context.installedModelCount} installed · ${context.semanticIndexModelSummary} · ${context.localModelCacheFootprint}`,
        detail:
          "Manage the shared local-model cache, prewarm curated models, and route semantic indexing plus future local inference lanes through explicit backend and model bindings.",
      };
    case "terminal":
      return {
        summary: `${context.terminalWindowMode === "windowed" ? "application" : "dock"} mode · ${context.terminalPreferredOpenMode} · ${context.terminalCursorStyle} cursor`,
        detail:
          "Control the integrated terminal, its typography, and how commands hand off to external shells.",
      };
    case "explorer":
      return {
        summary: `${context.explorerViewModeLabel} · ${context.explorerFolderClickMode === "single" ? "Single-click folders" : "Double-click folders"} · ${context.explorerThumbnailsEnabled ? "Rich thumbnails" : "Icons only"}`,
        detail:
          "Shape the file browser around your machine, including content-browser layout modes, folder activation behavior, and thumbnail policy without mixing in icon-pack management.",
      };
    case "context-menus":
      return {
        summary: `${context.activeMenuPackSummary} · ${context.availableMenuPacksCount} pack${context.availableMenuPacksCount === 1 ? "" : "s"} · ${context.customizedContextMenuContextCount} customized context${context.customizedContextMenuContextCount === 1 ? "" : "s"}`,
        detail:
          "Author explorer context menus as a first-class system: menu packs, context-aware layout overrides, renderer selection, and future shareable menu setups all live here.",
      };
    case "home":
      return {
        summary: context.homePackSummary,
        detail:
          "Home is now an app-owned explorer surface with pack selection, preset routing, usage telemetry, and a dedicated runtime-authored customization lane.",
      };
    case "layouts":
      return {
        summary: `${context.activeLayoutLabel} · ${context.layoutProfileCount} profiles · ${context.zenFocusMode ? "Zen on" : "Zen off"}`,
        detail:
          "Switch between shell profiles, point at external manifests, and control the workbench shape at the layout level.",
      };
    case "hotkeys":
      return {
        summary: context.hotkeyLabels.join(" · "),
        detail:
          "Keep the overlay easy to summon, control shell presentation, and remap the primary focus toggles without digging through raw config.",
      };
    case "cloud":
      return {
        summary: `${context.connectedCloudAccountCount} connected · ${context.configuredCloudProviderCount}/2 providers configured`,
        detail:
          "Manage provider credentials from Settings or the runtime environment, keep account tokens off the settings store, and surface each connected account as an explorer drive.",
      };
    case "mobile":
      return {
        summary: context.mobileRemoteAccessSummary,
        detail:
          "Choose whether the mobile PWA launches over the local network or a tailnet URL, then manage Tailscale status and phone-facing remote access from one place.",
      };
    case "screenshots":
      return {
        summary: `${context.screenshotDefaultCaptureMode === "monitor" ? "Full monitor default" : "Area snip default"} · ${formatScreenshotOutputActionLabel(context.screenshotDefaultOutputAction)} · ${context.screenshotShowGrid ? "Grid on" : "Grid off"}`,
        detail:
          "Set the default screenshot landing path and decide how the built-in capture tool behaves before and after a proof action.",
      };
    case "audio":
      return {
        summary: `${context.soundPackSelectionSummary} · ${context.soundEffectsEnabled ? "FX on" : "FX muted"} · ${context.nativeNotificationsEnabled ? "Native notices on" : "Native notices off"} · ${context.audioFolderCount} VST folder${context.audioFolderCount === 1 ? "" : "s"}`,
        detail: `Route shell sound packs, cue categories, and OS-native notifications through the same settings-backed audio lane, then add extra ${context.platform === "macos" ? "Audio Unit / VST-style" : "VST3"} discovery paths for workbench audio integrations.`,
      };
    case "appearance":
      return {
        summary: `${context.effectiveThemeName} · ${formatOverlayVisualControlValue("opacity", context.appOpacity)} OP · ${formatOverlayVisualControlValue("panelTransparency", context.panelTransparency)} PT · ${formatOverlayVisualControlValue("zoom", context.appZoom)} ZM · ${formatOverlayVisualControlValue("blurStrength", context.appBlurStrength)} BL`,
        detail:
          "Tune the shell look and feel, from engine-driven recipes and palette tokens to blur, transparency, UI typography, and the theme bundle catalog that orchestrates the modular authored lanes.",
      };
    case "appearance-packs":
      return {
        summary: `${context.appearancePackSelectionSummary} · ${context.availableAppearancePacksCount} packs`,
        detail:
          "Appearance packs own palette, fonts, visuals, and shell identity primitives. Leave them on Follow Theme to respect the active bundle, or pin one to start mixing shells intentionally.",
      };
    case "theme-recipes":
      return {
        summary: `${context.themeRecipeSelectionSummary} · ${context.availableThemeRecipePacksCount} packs`,
        detail:
          "Theme recipe packs own workbench, explorer, and dock recipe lanes. Pin one when you want to swap the shell composition language without changing the whole bundle.",
      };
    case "theme-engines":
      return {
        summary: `${context.themeEngineSelectionSummary} · ${context.availableThemeEnginePacksCount} packs`,
        detail:
          "Theme engine packs own design tokens, render styles, layout primitives, and compatibility defaults. This is the deeper presentation/runtime lane behind the visible shell.",
      };
    case "shell-renderers":
      return {
        summary: `${context.shellRendererSelectionSummary} · ${context.availableShellRenderersCount} renderers`,
        detail:
          "Shell renderers control the runtime renderer module itself. Leave Follow Theme on for bundle defaults, or pin a renderer when you want the shell runtime to break away from the bundle.",
      };
    case "top-bars":
      return {
        summary: `${context.topBarSelectionSummary} · ${context.availableTopBarsCount} variants`,
        detail: context.followThemeTopBarDetail,
      };
    case "icons":
      return {
        summary: context.iconThemeSelectionSummary,
        detail:
          "Choose a dedicated icon theme independently from the active shell theme, keep folder rules in one place, and decide when OS-native icons should still fill gaps.",
      };
    case "wallpapers":
      return {
        summary: `${context.availableWallpapersCount} catalog items${context.themeWallpaperAvailable ? " · theme default available" : ""}${context.wallpaperFailureCount > 0 ? ` · ${context.wallpaperFailureCount} errors` : ""}`,
        detail:
          "Wallpapers stay in the theme system, can be overridden per user, and still render underneath shader and visual layers instead of replacing them.",
      };
    case "shaders":
      return {
        summary: `${context.availableShadersCount} profiles · ${context.shaderPerformanceLabel}${context.shaderFailureCount > 0 ? ` · ${context.shaderFailureCount} errors` : ""}`,
        detail: `Default mode is ${context.shaderPerformanceLabel.toLowerCase()}, which keeps automatic theme shaders off until you explicitly choose a profile and keeps the live preview budgeted.`,
      };
    case "animations":
      return {
        summary: `${context.availableAnimationsCount} modules${context.animationFailureCount > 0 ? ` · ${context.animationFailureCount} errors` : ""}`,
        detail:
          "Browse built-in and authored animation modules, assign the live open/close bindings, and manage the animation authoring folder.",
      };
    case "interaction-motion":
      return {
        summary: `${context.interactionMotionProfileLabel} · ${context.interactionMotionEnabled ? "Live" : "Disabled"} · ${context.interactionMotionSurfaceCount} surfaces`,
        detail:
          "Control shell micro-interactions separately from window transitions, including presets, per-surface toggles, and the Motion Lab preview harness.",
      };
    case "layout-dynamics":
      return {
        summary: `${context.layoutDynamicsProfileLabel} · ${context.layoutDynamicsEnabled ? "Live" : "Disabled"} · ${context.layoutDynamicsSurfaceCount} surfaces`,
        detail:
          "Control the shell-wide layout-authoring physics runtime, including shared presets, surface overrides, and the live layout-dynamics lab harness.",
      };
    case "theme-json":
      return {
        summary: "Direct JSON editing",
        detail:
          "Paste, tweak, and version theme bundle manifests directly when the picker surfaces are not enough.",
      };
  }

  return {
    summary: String(sectionKey),
    detail: "Configure this settings slice.",
  };
}

function formatScreenshotOutputActionLabel(
  action: ScreenshotOutputActionId,
): string {
  if (action === "save-copy") {
    return "Save + Copy";
  }

  return action === "save" ? "Save" : "Copy";
}

function formatNativeNotificationPermissionLabel(
  permission: NativeNotificationPermissionState,
): string {
  switch (permission) {
    case "granted":
      return "Granted";
    case "denied":
      return "Denied";
    case "default":
      return "Prompt Required";
    case "unavailable":
      return "Unavailable";
  }
}

function OverviewCard({
  title,
  subtitle,
  badges,
  children,
  motionBinding,
}: {
  title: string;
  subtitle: string;
  badges?: string[];
  children: ReactNode;
  motionBinding?: InteractionMotionBinding;
}) {
  return (
    <div
      className="rounded border p-3"
      {...motionBinding?.motionDataAttributes}
      onPointerEnter={motionBinding?.onPointerEnter}
      onPointerLeave={motionBinding?.onPointerLeave}
      onPointerDown={motionBinding?.onPointerDown}
      onPointerUp={motionBinding?.onPointerUp}
      onPointerCancel={motionBinding?.onPointerCancel}
      style={{
        borderColor: "var(--overlay-workbench-settings-card-border)",
        background: "var(--overlay-workbench-settings-card-bg)",
        ...motionBinding?.motionStyle,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            {title}
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-45">{subtitle}</p>
        </div>
        {badges && badges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  borderColor: "var(--overlay-workbench-settings-badge-border)",
                  background: "var(--overlay-workbench-settings-badge-bg)",
                }}
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const EMPTY_CLOUD_ACCOUNTS_SNAPSHOT: ExplorerCloudAccountsSnapshot = {
  accounts: [],
  providers: [],
};

const CLOUD_PROVIDER_IDS = [
  "google-drive",
  "dropbox",
] as const satisfies readonly ExplorerCloudProviderId[];
const DROPBOX_CALLBACK_URI = "http://localhost:53682/callback";

type CloudProviderCredentialDraft = {
  clientId: string;
  clientSecret: string;
};

type CloudProviderCredentialDraftMap = Record<
  ExplorerCloudProviderId,
  CloudProviderCredentialDraft
>;

function getCloudProviderLabel(provider: ExplorerCloudProviderId): string {
  return provider === "google-drive" ? "Google Drive" : "Dropbox";
}

function createEmptyCloudProviderCredentialDrafts(): CloudProviderCredentialDraftMap {
  return {
    "google-drive": { clientId: "", clientSecret: "" },
    dropbox: { clientId: "", clientSecret: "" },
  };
}

function getCloudProviderConfigurationSourceLabel(
  source: ExplorerCloudProviderConfigurationSource,
): string {
  switch (source) {
    case "settings":
      return "Saved in Settings";
    case "environment":
      return "Bundled / Environment";
    default:
      return "Not Configured";
  }
}

function getHomeEntryLabel(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  if (!trimmed) {
    return "Home";
  }

  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}

function formatModelCacheBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatModelTimestamp(epochMs: number | null | undefined): string {
  if (
    typeof epochMs !== "number" ||
    !Number.isFinite(epochMs) ||
    epochMs <= 0
  ) {
    return "Not warmed yet";
  }

  return new Date(epochMs).toLocaleString();
}

function mapExplorerHomeUsageEntries(
  records: ExplorerHomeUsageSnapshotValue["mostUsed"],
): ExplorerHomeUsageEntry[] {
  return records.map(
    (record: ExplorerHomeUsageSnapshotValue["mostUsed"][number]) => ({
      path: record.path,
      label: getHomeEntryLabel(record.path),
      openCount: record.openCount,
      lastOpenedAt: record.lastOpenedAt,
    }),
  );
}

function mapExplorerHomeBookmarks(
  rail: ReturnType<typeof useExplorerStore.getState>["rail"],
): ExplorerHomeBookmarkItem[] {
  return rail.nodes
    .filter(
      (
        node,
      ): node is (typeof rail.nodes)[number] & {
        kind: "bookmark";
        path: string;
      } => node.kind === "bookmark",
    )
    .map((node) => ({
      id: node.id,
      label: node.name,
      path: node.path,
      color: node.color,
      categoryIds: node.categoryIds,
    }));
}

const explorerMenuQuickSlotOptions: ExplorerMenuQuickSlot[] = [
  "none",
  "primary",
  "secondary",
  "quick-left",
  "quick-right",
];

const explorerMenuFallbackBucketOptions: ExplorerMenuFallbackBucket[] = [
  "default",
  "touch",
  "keyboard",
  "reduced-motion",
  "overflow",
];

const explorerMenuGroupOptions: Array<
  Extract<ExplorerMenuLayoutEntry, { kind: "group-slot" }>["group"]
> = [
  "create",
  "open",
  "action",
  "system",
  "clipboard",
  "organize",
  "library",
  "plugin",
  "danger",
];

export function SettingsPage({
  appearance,
  topBarPackages,
  topBarPackagesDirectory,
  topBarPackagesLoading,
  topBarPackagesError,
  topBarPackagesWarnings,
  homePacks = [],
  menuPacks = [],
  actionPacks = [],
  actions = [],
  homePacksDirectory = "",
  menuPacksDirectory = "",
  actionsDirectory = actionPackSystemConfig.actionsDirectory,
  homePacksLoading = false,
  menuPacksLoading = false,
  actionsLoading = false,
  homePacksError = null,
  menuPacksError = null,
  actionsError = null,
  homePacksWarnings = [],
  menuPacksWarnings = [],
  actionsWarnings = [],
  themePackages,
  themePackagesDirectory,
  themePackagesLoading,
  themePackagesError,
  themePackagesWarnings,
  appearancePacks = [],
  appearancePacksDirectory = themeAppearancePackSystemConfig.appearancesDirectory,
  appearancePacksLoading = false,
  appearancePacksError = null,
  appearancePacksWarnings = [],
  interactionMotionPacks = [],
  interactionMotionPacksDirectory = themeInteractionMotionPackSystemConfig.interactionMotionDirectory,
  interactionMotionPacksLoading = false,
  interactionMotionPacksError = null,
  interactionMotionPacksWarnings = [],
  shellRenderers = [],
  shellRenderersDirectory = themeShellRendererPackSystemConfig.shellRenderersDirectory,
  shellRenderersLoading = false,
  shellRenderersError = null,
  shellRenderersWarnings = [],
  themeRecipePacks = [],
  themeRecipePacksDirectory = themeRecipePackSystemConfig.themeRecipesDirectory,
  themeRecipePacksLoading = false,
  themeRecipePacksError = null,
  themeRecipePacksWarnings = [],
  themeEnginePacks = [],
  themeEnginePacksDirectory = themeEnginePackSystemConfig.themeEnginesDirectory,
  themeEnginePacksLoading = false,
  themeEnginePacksError = null,
  themeEnginePacksWarnings = [],
  iconThemePackages = [],
  iconThemePackagesDirectory = iconThemeSystemConfig.iconThemesDirectory,
  iconThemePackagesLoading = false,
  iconThemePackagesError = null,
  iconThemePackagesWarnings = [],
  soundPacks = [],
  soundPacksDirectory = soundPackSystemConfig.soundPacksDirectory,
  soundPacksLoading = false,
  soundPacksError = null,
  soundPacksWarnings = [],
  onRefreshTopBars,
  onOpenTopBarsFolder,
  onRefreshHomePacks = async () => {},
  onRefreshMenuPacks = async () => {},
  onRefreshActions = async () => {},
  onOpenHomePacksFolder = async () => {},
  onOpenMenuPacksFolder = async () => {},
  onOpenActionsFolder = async () => {},
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
  pluginContextMenuItems = [],
  pluginExplorerActions = [],
}: {
  appearance: ResolvedOverlayAppearance;
  topBarPackages: LoadedOverlayTopBarPackage[];
  topBarPackagesDirectory: string;
  topBarPackagesLoading: boolean;
  topBarPackagesError: string | null;
  topBarPackagesWarnings: string[];
  homePacks?: LoadedExplorerHomePack[];
  menuPacks?: LoadedExplorerMenuPack[];
  actionPacks?: LoadedActionPack[];
  actions?: LoadedExplorerAction[];
  homePacksDirectory?: string;
  menuPacksDirectory?: string;
  actionsDirectory?: string;
  homePacksLoading?: boolean;
  menuPacksLoading?: boolean;
  actionsLoading?: boolean;
  homePacksError?: string | null;
  menuPacksError?: string | null;
  actionsError?: string | null;
  homePacksWarnings?: string[];
  menuPacksWarnings?: string[];
  actionsWarnings?: string[];
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
  onRefreshTopBars: () => Promise<void>;
  onOpenTopBarsFolder: () => Promise<void>;
  onRefreshHomePacks?: () => Promise<void>;
  onRefreshMenuPacks?: () => Promise<void>;
  onRefreshActions?: () => Promise<void>;
  onOpenHomePacksFolder?: () => Promise<void>;
  onOpenMenuPacksFolder?: () => Promise<void>;
  onOpenActionsFolder?: () => Promise<void>;
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
  onSetWindowMode?: (mode: TerminalWindowMode) => Promise<void> | void;
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  pluginExplorerActions?: OverlayPluginExplorerActionContribution[];
}) {
  const platform = useMemo(() => detectClientPlatform(), []);
  const platformLabel = useMemo(() => {
    if (platform === "windows") return "Windows";
    if (platform === "macos") return "macOS";
    if (platform === "linux") return "Linux";
    return "the OS";
  }, [platform]);
  const [
    nativeNotificationPermissionState,
    setNativeNotificationPermissionState,
  ] = useState<NativeNotificationPermissionState>("unavailable");
  const [
    nativeNotificationPermissionLoading,
    setNativeNotificationPermissionLoading,
  ] = useState(false);
  const [nativeNotificationFeedback, setNativeNotificationFeedback] = useState<
    string | null
  >(null);
  const {
    activeSection,
    activeContextMenuComposerContext,
    setActiveSection,
    setActiveContextMenuComposerContext,
    settings,
    updateTerminal,
    updatePython,
    updateExplorer,
    updateHome,
    updateAppearance,
    applyThemeSelection: applyThemeSelectionWithDefaults,
    applyDockThemeSelection: applyDockThemeSelectionWithDefaults,
    updateLayout,
    updateKeybindings,
    setCommandKeybinding,
    updateScreenshots,
    updateSystem,
    updateMobile,
    updateModels,
    updateAudio,
    setHomePackState,
    setHomePresetSelection,
    resetToDefaults,
    showAllDescriptionsBySection,
    setShowAllDescriptions,
  } = useSettingsStore(
    useShallow((state) => ({
      activeSection: state.activeSection,
      activeContextMenuComposerContext: state.activeContextMenuComposerContext,
      setActiveSection: state.setActiveSection,
      setActiveContextMenuComposerContext:
        state.setActiveContextMenuComposerContext,
      settings: state.settings,
      updateTerminal: state.updateTerminal,
      updatePython: state.updatePython,
      updateExplorer: state.updateExplorer,
      updateHome: state.updateHome,
      updateAppearance: state.updateAppearance,
      applyThemeSelection: state.applyThemeSelection,
      applyDockThemeSelection: state.applyDockThemeSelection,
      updateLayout: state.updateLayout,
      updateKeybindings: state.updateKeybindings,
      setCommandKeybinding: state.setCommandKeybinding,
      updateScreenshots: state.updateScreenshots,
      updateSystem: state.updateSystem,
      updateMobile: state.updateMobile,
      updateModels: state.updateModels,
      updateAudio: state.updateAudio,
      setHomePackState: state.setHomePackState,
      setHomePresetSelection: state.setHomePresetSelection,
      resetToDefaults: state.resetToDefaults,
      showAllDescriptionsBySection: state.showAllDescriptionsBySection,
      setShowAllDescriptions: state.setShowAllDescriptions,
    })),
  );
  const showAllDescriptionsForActiveSection =
    showAllDescriptionsBySection[activeSection] ?? false;
  const refreshNativeNotificationPermission = useCallback(async () => {
    setNativeNotificationPermissionLoading(true);
    try {
      const nextPermission = await getNativeNotificationPermissionState();
      setNativeNotificationPermissionState(nextPermission);
    } finally {
      setNativeNotificationPermissionLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNativeNotificationPermission();
  }, [refreshNativeNotificationPermission]);
  const systemPresentationState = useMemo(
    () => resolveSystemPresentationState(settings.system),
    [settings.system],
  );
  const {
    mobileSharePhase,
    mobileShareSession,
    mobileShareNotice,
    mobileShareError,
    tailscaleStatus,
  } = useMobileShareStore(
    useShallow((state) => ({
      mobileSharePhase: state.phase,
      mobileShareSession: state.session,
      mobileShareNotice: state.lastNotice,
      mobileShareError: state.lastError,
      tailscaleStatus: state.tailscaleStatus,
    })),
  );
  const {
    snapshot: gpuRuntimeSnapshot,
    hydrationState: gpuRuntimeHydrationState,
    hydrationError: gpuRuntimeHydrationError,
    subscriptionState: gpuRuntimeSubscriptionState,
    subscriptionError: gpuRuntimeSubscriptionError,
  } = useGpuRuntimeStore(
    useShallow((state) => ({
      snapshot: state.snapshot,
      hydrationState: state.hydrationState,
      hydrationError: state.hydrationError,
      subscriptionState: state.subscriptionState,
      subscriptionError: state.subscriptionError,
    })),
  );
  const {
    snapshot: accelerationRuntimeSnapshot,
    hydrationState: accelerationRuntimeHydrationState,
    hydrationError: accelerationRuntimeHydrationError,
  } = useAccelerationRuntimeStore(
    useShallow((state) => ({
      snapshot: state.snapshot,
      hydrationState: state.hydrationState,
      hydrationError: state.hydrationError,
    })),
  );
  const { directoryBookmarks, addDirectoryBookmark } = useTerminalStore(
    useShallow((state) => ({
      directoryBookmarks: state.directoryBookmarks,
      addDirectoryBookmark: state.addDirectoryBookmark,
    })),
  );
  const explorerRail = useExplorerStore((state) => state.rail);
  const explorerCurrentPath = useExplorerStore(
    (state) => state.session.currentPath,
  );
  const homeTasks = useExplorerTaskSnapshots();

  const integratedShellProfileOptions = useMemo(
    () => getIntegratedTerminalProfileOptions(platform),
    [platform],
  );
  const externalProfileOptions = useMemo(
    () => getExternalTerminalProfileOptions(platform),
    [platform],
  );
  const [themeDraft, setThemeDraft] = useState("");
  const [themeImportError, setThemeImportError] = useState<string | null>(null);
  const [folderIconSearch, setFolderIconSearch] = useState("");
  const [startupSyncPending, setStartupSyncPending] = useState(false);
  const [startupSyncError, setStartupSyncError] = useState<string | null>(null);
  const [linuxDisplayBackendSyncPending, setLinuxDisplayBackendSyncPending] =
    useState(false);
  const [linuxDisplayBackendSyncError, setLinuxDisplayBackendSyncError] =
    useState<string | null>(null);
  const [linuxDisplayBackendStatus, setLinuxDisplayBackendStatus] =
    useState<LinuxDisplayBackendStatus | null>(null);
  const [telemetryStatus, setTelemetryStatus] =
    useState<OverlayTelemetrySessionStatus | null>(null);
  const [telemetryStatusPending, setTelemetryStatusPending] = useState(false);
  const [telemetryStatusError, setTelemetryStatusError] = useState<
    string | null
  >(null);
  const [telemetryNotice, setTelemetryNotice] = useState<string | null>(null);
  const [telemetryActionPending, setTelemetryActionPending] = useState<
    "export" | "clear" | null
  >(null);
  const [localModelStatus, setLocalModelStatus] =
    useState<LocalModelCatalogStatus | null>(null);
  const [localModelStatusPending, setLocalModelStatusPending] = useState(false);
  const [localModelStatusError, setLocalModelStatusError] = useState<
    string | null
  >(null);
  const [localModelNotice, setLocalModelNotice] = useState<string | null>(null);
  const [modelPrewarmPendingId, setModelPrewarmPendingId] = useState<
    string | null
  >(null);
  const [accelerationInstallPending, setAccelerationInstallPending] =
    useState(false);
  const [semanticOverrideRootPathDraft, setSemanticOverrideRootPathDraft] =
    useState("");
  const [semanticOverrideModelIdDraft, setSemanticOverrideModelIdDraft] =
    useState<string | null>(
      settings.models.capabilityBindings[semanticIndexingCapabilityId]
        ?.modelId ?? null,
    );
  const [
    semanticOverrideBackendPreferenceDraft,
    setSemanticOverrideBackendPreferenceDraft,
  ] = useState<LocalModelBackendPreference>(
    normalizeLocalModelBackendPreference(
      settings.models.capabilityBindings[semanticIndexingCapabilityId]
        ?.backendPreference,
    ),
  );
  const [homeUserPath, setHomeUserPath] = useState("");
  const [homeUsageSnapshot, setHomeUsageSnapshot] =
    useState<ExplorerHomeUsageSnapshotValue>({
      mostUsed: [],
      recent: [],
    });
  const [homeSavedSearches, setHomeSavedSearches] = useState<
    ExplorerSavedSearch[]
  >([]);
  const [homeDrives, setHomeDrives] = useState<ExplorerDriveInfo[]>([]);
  const [accelerationProbePending, setAccelerationProbePending] =
    useState(false);
  const [accelerationProbeNotice, setAccelerationProbeNotice] = useState<
    string | null
  >(null);
  const [accelerationProbeError, setAccelerationProbeError] = useState<
    string | null
  >(null);
  const [overviewNotice, setOverviewNotice] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [cloudSnapshot, setCloudSnapshot] =
    useState<ExplorerCloudAccountsSnapshot>(EMPTY_CLOUD_ACCOUNTS_SNAPSHOT);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudAuthProvider, setCloudAuthProvider] =
    useState<ExplorerCloudProviderId | null>(null);
  const [cloudCredentialDrafts, setCloudCredentialDrafts] =
    useState<CloudProviderCredentialDraftMap>(() =>
      createEmptyCloudProviderCredentialDrafts(),
    );
  const [cloudCredentialBusyProvider, setCloudCredentialBusyProvider] =
    useState<ExplorerCloudProviderId | null>(null);
  const [cloudCredentialBusyAction, setCloudCredentialBusyAction] = useState<
    "save" | "clear" | null
  >(null);
  const [tailscaleStatusPending, setTailscaleStatusPending] = useState(false);
  const [tailscaleActionPending, setTailscaleActionPending] = useState<
    "connect" | "disconnect" | null
  >(null);
  const [tailscaleNotice, setTailscaleNotice] = useState<string | null>(null);
  const [tailscaleError, setTailscaleError] = useState<string | null>(null);
  const [tailscaleAuthKeyDraft, setTailscaleAuthKeyDraft] = useState("");
  const [mobileQrDialogOpen, setMobileQrDialogOpen] = useState(false);
  const [wallpaperNotice, setWallpaperNotice] = useState<string | null>(null);
  const [wallpaperImportError, setWallpaperImportError] = useState<
    string | null
  >(null);
  const [layoutManifestState, setLayoutManifestState] =
    useState<LoadedLayoutManifest>(DEFAULT_LOADED_LAYOUT_MANIFEST);
  const [railWidth, setRailWidth] = usePersistentPanelSize(
    "overlayterm-settings-rail-width",
    236,
    190,
    320,
  );
  const availableLinuxDisplayBackends =
    linuxDisplayBackendStatus?.availableBackends ?? [];
  const linuxDisplayBackendStatusSummary = useMemo(() => {
    if (platform !== "linux") {
      return null;
    }

    if (linuxDisplayBackendSyncPending && linuxDisplayBackendStatus == null) {
      return "Reading Linux display backend status...";
    }

    if (linuxDisplayBackendSyncError) {
      return `Linux display backend sync failed: ${linuxDisplayBackendSyncError}`;
    }

    if (linuxDisplayBackendStatus == null) {
      return "Linux display backend status is unavailable.";
    }

    const availableBackendsLabel =
      availableLinuxDisplayBackends.length > 0
        ? availableLinuxDisplayBackends.join(", ")
        : "none detected";

    return [
      `session ${linuxDisplayBackendStatus.sessionBackend ?? "unknown"}`,
      `active backend ${linuxDisplayBackendStatus.activeBackend ?? "unknown"}`,
      `available launch backends ${availableBackendsLabel}`,
      linuxDisplayBackendStatus.autoX11FallbackActive
        ? "auto X11 fallback active for NVIDIA/WebKit"
        : "auto fallback inactive",
      "restart required after changes",
    ].join(" · ");
  }, [
    availableLinuxDisplayBackends,
    linuxDisplayBackendStatus,
    linuxDisplayBackendSyncError,
    linuxDisplayBackendSyncPending,
    platform,
  ]);
  const gpuRuntimeDiagnosticsSummary = useMemo(() => {
    const adapterLabel = gpuRuntimeSnapshot.adapterName ?? "not detected";
    const backendLabel = gpuRuntimeSnapshot.backendName ?? "n/a";
    const adapterTypeLabel = gpuRuntimeSnapshot.adapterType ?? "unknown";
    const queueLabel = `${gpuRuntimeSnapshot.queueDepth} queued`;
    const computeLabel = gpuRuntimeSnapshot.computeAvailable
      ? "compute ready"
      : "compute unavailable";
    const rendererLabel = gpuRuntimeSnapshot.softwareRenderer
      ? "software renderer"
      : "hardware renderer";
    return `${adapterLabel} · ${adapterTypeLabel} · ${backendLabel} · ${rendererLabel} · ${computeLabel} · ${queueLabel}`;
  }, [gpuRuntimeSnapshot]);
  const gpuRuntimeFeedStatus = useMemo(() => {
    if (
      gpuRuntimeHydrationState === "loading" ||
      gpuRuntimeSubscriptionState === "loading"
    ) {
      return "Refreshing native GPU runtime diagnostics...";
    }

    if (gpuRuntimeHydrationError) {
      return `GPU runtime hydration failed: ${gpuRuntimeHydrationError}`;
    }

    if (gpuRuntimeSubscriptionError) {
      return `GPU runtime event subscription failed: ${gpuRuntimeSubscriptionError}`;
    }

    if (gpuRuntimeSnapshot.runtimeError) {
      return `Runtime note: ${gpuRuntimeSnapshot.runtimeError}`;
    }

    return `Configured ${getGpuTierModeLabel(settings.system.gpuTierMode)} · effective ${getGpuTierModeLabel(gpuRuntimeSnapshot.effectiveTier)}.`;
  }, [
    gpuRuntimeHydrationError,
    gpuRuntimeHydrationState,
    gpuRuntimeSnapshot.effectiveTier,
    gpuRuntimeSnapshot.runtimeError,
    gpuRuntimeSubscriptionError,
    gpuRuntimeSubscriptionState,
    settings.system.gpuTierMode,
  ]);
  const accelerationProviderSummary = useMemo(() => {
    const readyProviders = accelerationRuntimeSnapshot.providers.filter(
      (provider) => provider.ready,
    );
    if (readyProviders.length === 0) {
      return "No accelerator providers are currently ready; CPU fallback remains active.";
    }

    return readyProviders
      .map((provider) => `${provider.label} ready`)
      .join(" · ");
  }, [accelerationRuntimeSnapshot.providers]);
  const accelerationPipelineStatus = useMemo(() => {
    if (accelerationRuntimeHydrationState === "loading") {
      return "Refreshing acceleration pipeline diagnostics...";
    }

    if (accelerationRuntimeHydrationError) {
      return `Acceleration runtime hydration failed: ${accelerationRuntimeHydrationError}`;
    }

    if (accelerationProbeError) {
      return `CUDA/AI probe failed: ${accelerationProbeError}`;
    }

    if (accelerationProbeNotice) {
      return accelerationProbeNotice;
    }

    if (accelerationRuntimeSnapshot.pythonProbeError) {
      return `Python probe note: ${accelerationRuntimeSnapshot.pythonProbeError}`;
    }

    return `Routing ${getAccelerationRoutingModeLabel(settings.system.accelerationRoutingMode)} · ${accelerationProviderSummary}`;
  }, [
    accelerationProviderSummary,
    accelerationProbeError,
    accelerationProbeNotice,
    accelerationRuntimeHydrationError,
    accelerationRuntimeHydrationState,
    accelerationRuntimeSnapshot.pythonProbeError,
    settings.system.accelerationRoutingMode,
  ]);
  const accelerationWorkloadRoutes = useMemo(
    () =>
      accelerationWorkloadCatalog.map((definition) => ({
        definition,
        resolution: resolveAccelerationProviderForWorkload(
          accelerationRuntimeSnapshot,
          definition.id,
          settings.system.accelerationRoutingMode,
        ),
      })),
    [accelerationRuntimeSnapshot, settings.system.accelerationRoutingMode],
  );
  const activeLayoutProfile = useMemo(
    () =>
      resolveLayoutProfile(
        layoutManifestState.manifest,
        settings.layout.activeProfileId,
      ),
    [layoutManifestState.manifest, settings.layout.activeProfileId],
  );
  const revealIntegratedTerminalPanel = useCallback(() => {
    const currentPanelState = settings.layout.panelStateByProfile[
      activeLayoutProfile.id
    ] ?? {
      openPanelIds: [],
      activePanelId: null,
      dismissedPanelIds: [],
    };

    updateLayout({
      panelStateByProfile: {
        ...settings.layout.panelStateByProfile,
        [activeLayoutProfile.id]: {
          openPanelIds: Array.from(
            new Set([...currentPanelState.openPanelIds, "terminal"]),
          ),
          activePanelId: "terminal",
          dismissedPanelIds: currentPanelState.dismissedPanelIds.filter(
            (panelId) => panelId !== "terminal",
          ),
        },
      },
    });
  }, [
    activeLayoutProfile.id,
    settings.layout.panelStateByProfile,
    updateLayout,
  ]);
  const managedPythonRuntimeConfig = useMemo(
    () => createPythonRuntimeConfig(settings.python),
    [settings.python],
  );
  const accelerationAutoInstallPlan = useMemo(
    () =>
      createAccelerationAutoInstallPlan({
        routingMode: settings.system.accelerationRoutingMode,
        currentPackageInput: settings.python.bootstrapPackages,
      }),
    [
      settings.python.bootstrapPackages,
      settings.system.accelerationRoutingMode,
    ],
  );
  const accelerationInstallRecommended = useMemo(
    () =>
      shouldAutoInstallAccelerationPackages(
        accelerationRuntimeSnapshot.pythonProbe,
      ),
    [accelerationRuntimeSnapshot.pythonProbe],
  );
  const accelerationInstallButtonLabel = useMemo(() => {
    if (accelerationAutoInstallPlan == null) {
      return "Download AI Packages";
    }

    return accelerationAutoInstallPlan.presetId === "cuda-ai-indexing"
      ? "Download CUDA Packages"
      : "Download AI Packages";
  }, [accelerationAutoInstallPlan]);
  const handleProbeAccelerationPipeline = useCallback(async () => {
    setAccelerationProbePending(true);
    setAccelerationProbeNotice(null);
    setAccelerationProbeError(null);
    try {
      const snapshot = await refreshAccelerationRuntimeStatus({
        config: managedPythonRuntimeConfig,
        routingMode: settings.system.accelerationRoutingMode,
        startSidecarIfNeeded: true,
      });
      const readyProviders = snapshot.providers.filter(
        (provider) => provider.ready,
      );
      setAccelerationProbeNotice(
        readyProviders.length > 0
          ? `Probe complete · ${readyProviders.map((provider) => provider.label).join(", ")} ready.`
          : "Probe complete · no accelerator provider reported ready, CPU fallback remains active.",
      );
    } catch (error) {
      setAccelerationProbeError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setAccelerationProbePending(false);
    }
  }, [managedPythonRuntimeConfig, settings.system.accelerationRoutingMode]);
  const handleQueueAccelerationInstall = useCallback(async () => {
    if (accelerationAutoInstallPlan == null) {
      setAccelerationProbeError(
        "No managed AI package preset is available for the current routing mode.",
      );
      return;
    }

    setAccelerationInstallPending(true);
    setAccelerationProbeNotice(null);
    setAccelerationProbeError(null);

    try {
      const runtimeConfig = createPythonRuntimeConfig({
        ...settings.python,
        bootstrapPackages: accelerationAutoInstallPlan.packageInput,
      });

      if (
        settings.python.bootstrapPackages.trim() !==
        accelerationAutoInstallPlan.packageInput
      ) {
        updatePython({
          bootstrapPackages: accelerationAutoInstallPlan.packageInput,
        });
      }

      revealIntegratedTerminalPanel();

      let runtimeStatus = await getManagedPythonRuntimeStatus(runtimeConfig);
      if (!runtimeStatus.ready || !runtimeStatus.managedPythonPath.trim()) {
        const bootstrapResponse =
          await bootstrapManagedPythonRuntime(runtimeConfig);
        runtimeStatus = bootstrapResponse.status;
      }

      const installCommand = buildManagedPythonPipInstallCommand({
        managedPythonPath: runtimeStatus.managedPythonPath,
        shell: settings.terminal.shell,
        platform,
        packages: accelerationAutoInstallPlan.packages,
      });
      if (!installCommand) {
        throw new Error("Unable to build the managed Python install command.");
      }

      dispatchTerminalCommand(installCommand, true);
      setAccelerationProbeNotice(
        `Opened Terminal and queued ${accelerationAutoInstallPlan.presetLabel} for install.`,
      );
      setAccelerationProbeError(null);
    } catch (error) {
      setAccelerationProbeError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setAccelerationInstallPending(false);
    }
  }, [
    accelerationAutoInstallPlan,
    platform,
    revealIntegratedTerminalPanel,
    settings.python,
    settings.terminal.shell,
    updatePython,
  ]);
  const cudaProviderStatus = useMemo(
    () =>
      accelerationRuntimeSnapshot.providers.find(
        (provider) => provider.providerKind === "cudaPython",
      ) ?? null,
    [accelerationRuntimeSnapshot.providers],
  );
  const cudaProviderReady =
    cudaProviderStatus?.ready === true ||
    cudaProviderStatus?.available === true;
  const semanticIndexingCapability = useMemo(
    () => getLocalModelCapabilityDefinition(semanticIndexingCapabilityId),
    [],
  );
  const semanticIndexingBinding = useMemo(
    () =>
      settings.models.capabilityBindings[semanticIndexingCapabilityId] ?? {
        modelId: semanticIndexingCapability?.defaultModelId ?? null,
        backendPreference:
          semanticIndexingCapability?.defaultBackendPreference ?? "auto",
      },
    [
      semanticIndexingCapability?.defaultBackendPreference,
      semanticIndexingCapability?.defaultModelId,
      settings.models.capabilityBindings,
    ],
  );
  const semanticIndexingModels = useMemo(
    () => getCapabilityModels(semanticIndexingCapabilityId),
    [],
  );
  const localModelStatusById = useMemo(
    () =>
      new Map(
        (localModelStatus?.models ?? []).map(
          (entry) => [entry.modelId, entry] as const,
        ),
      ),
    [localModelStatus],
  );
  const semanticIndexOverrideEntries = useMemo(
    () =>
      Object.entries(settings.models.semanticIndexRootOverrides).sort(
        ([leftPath], [rightPath]) => leftPath.localeCompare(rightPath),
      ),
    [settings.models.semanticIndexRootOverrides],
  );
  const refreshLocalModels = useCallback(
    async (startIfNeeded = true) => {
      setLocalModelStatusPending(true);
      setLocalModelStatusError(null);
      try {
        const response = await getLocalModelCatalogStatus(
          {},
          { config: managedPythonRuntimeConfig, startIfNeeded },
        );
        setLocalModelStatus(response.result);
      } catch (error) {
        setLocalModelStatusError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setLocalModelStatusPending(false);
      }
    },
    [managedPythonRuntimeConfig],
  );
  const handlePrewarmLocalModel = useCallback(
    async (
      modelId: string,
      capabilityId: string | null,
      backendPreference: LocalModelBackendPreference,
    ) => {
      setModelPrewarmPendingId(modelId);
      setLocalModelNotice(null);
      setLocalModelStatusError(null);
      try {
        const response = await prewarmLocalModel(
          {
            modelId,
            capabilityId,
            backendPreference,
          },
          { config: managedPythonRuntimeConfig, startIfNeeded: true },
        );
        setLocalModelNotice(response.result.message);
        setLocalModelStatus(
          await getLocalModelCatalogStatus(
            {},
            { config: managedPythonRuntimeConfig, startIfNeeded: true },
          ).then((result) => result.result),
        );
      } catch (error) {
        setLocalModelStatusError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setModelPrewarmPendingId(null);
      }
    },
    [managedPythonRuntimeConfig],
  );
  const handleUpdateModelCapabilityBinding = useCallback(
    (
      capabilityId: string,
      updates: {
        modelId?: string | null;
        backendPreference?: LocalModelBackendPreference;
      },
    ) => {
      const currentBinding = settings.models.capabilityBindings[
        capabilityId
      ] ?? {
        modelId: null,
        backendPreference: "auto" as LocalModelBackendPreference,
      };
      updateModels({
        capabilityBindings: {
          ...settings.models.capabilityBindings,
          [capabilityId]: {
            modelId: updates.modelId ?? currentBinding.modelId,
            backendPreference:
              updates.backendPreference ?? currentBinding.backendPreference,
          },
        },
      });
    },
    [settings.models.capabilityBindings, updateModels],
  );
  const handleApplySemanticIndexOverride = useCallback(() => {
    const normalizedRootPath = semanticOverrideRootPathDraft.trim();
    if (!normalizedRootPath) {
      setLocalModelStatusError("Semantic index override requires a root path.");
      return;
    }

    updateModels({
      semanticIndexRootOverrides: {
        ...settings.models.semanticIndexRootOverrides,
        [normalizedRootPath]: {
          modelId: semanticOverrideModelIdDraft,
          backendPreference: semanticOverrideBackendPreferenceDraft,
        },
      },
    });
    setLocalModelNotice(
      `Saved semantic index override for ${normalizedRootPath}.`,
    );
    setSemanticOverrideRootPathDraft("");
  }, [
    semanticOverrideBackendPreferenceDraft,
    semanticOverrideModelIdDraft,
    semanticOverrideRootPathDraft,
    settings.models.semanticIndexRootOverrides,
    updateModels,
  ]);
  const handleRemoveSemanticIndexOverride = useCallback(
    (rootPath: string) => {
      const nextOverrides = { ...settings.models.semanticIndexRootOverrides };
      delete nextOverrides[rootPath];
      updateModels({ semanticIndexRootOverrides: nextOverrides });
    },
    [settings.models.semanticIndexRootOverrides, updateModels],
  );
  const handleOpenLocalModelCache = useCallback(async () => {
    const cacheRoot = localModelStatus?.cacheRoot?.trim();
    if (!cacheRoot) {
      setLocalModelStatusError(
        "Model cache location is unavailable until the managed Python runtime is ready.",
      );
      return;
    }
    try {
      await createExplorerDir(cacheRoot).catch(() => {});
      await openExplorerPath(cacheRoot);
    } catch (error) {
      setLocalModelStatusError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [localModelStatus?.cacheRoot]);

  useEffect(() => {
    setSemanticOverrideModelIdDraft(semanticIndexingBinding.modelId);
    setSemanticOverrideBackendPreferenceDraft(
      normalizeLocalModelBackendPreference(
        semanticIndexingBinding.backendPreference,
      ),
    );
  }, [
    semanticIndexingBinding.backendPreference,
    semanticIndexingBinding.modelId,
  ]);

  useEffect(() => {
    if (activeSection !== "models") {
      return;
    }

    if (localModelStatus == null && !localModelStatusPending) {
      void refreshLocalModels(true);
    }
  }, [
    activeSection,
    localModelStatus,
    localModelStatusPending,
    refreshLocalModels,
  ]);

  useEffect(() => {
    let disposed = false;
    void getExplorerHomeDir()
      .then((path) => {
        if (!disposed) {
          setHomeUserPath(path.trim());
        }
      })
      .catch(() => {
        if (!disposed) {
          setHomeUserPath("");
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "home") {
      return;
    }

    let disposed = false;
    void Promise.all([
      listExplorerHomeUsage().catch(() => ({ mostUsed: [], recent: [] })),
      listExplorerSavedSearches().catch(() => []),
      getExplorerDrives().catch(() => []),
    ]).then(([usageSnapshot, savedSearchesSnapshot, drivesSnapshot]) => {
      if (disposed) {
        return;
      }

      setHomeUsageSnapshot(usageSnapshot);
      setHomeSavedSearches(savedSearchesSnapshot);
      setHomeDrives(drivesSnapshot);
    });

    return () => {
      disposed = true;
    };
  }, [activeSection]);

  const wallpaperFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeContextMenuContext = activeContextMenuComposerContext;
  const [
    contextMenuCommandDraftByContext,
    setContextMenuCommandDraftByContext,
  ] = useState<Partial<Record<ExplorerMenuContextKind, string>>>({});
  const [contextMenuGroupDraftByContext, setContextMenuGroupDraftByContext] =
    useState<
      Partial<
        Record<
          ExplorerMenuContextKind,
          Extract<ExplorerMenuLayoutEntry, { kind: "group-slot" }>["group"]
        >
      >
    >({});
  const [selectedContextMenuEntryId, setSelectedContextMenuEntryId] = useState<
    string | null
  >(null);
  const [contextMenuCommandBrowserQuery, setContextMenuCommandBrowserQuery] =
    useState("");
  const [draggedContextMenuEntryId, setDraggedContextMenuEntryId] = useState<
    string | null
  >(null);
  const contextMenuCommandCatalog = useMemo(
    () =>
      [
        ...BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
        ...normalizeExplorerActionContributions(actions),
        ...normalizePluginContextMenuContributions([
          ...pluginContextMenuItems,
          ...createLegacyExplorerActionContextMenuContributions(
            pluginExplorerActions,
          ),
        ]),
      ].sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }
        return left.id.localeCompare(right.id);
      }),
    [actions, pluginContextMenuItems, pluginExplorerActions],
  );
  const contextMenuCommandLookup = useMemo(
    () =>
      new Map(
        contextMenuCommandCatalog.map(
          (command) => [command.id, command] as const,
        ),
      ),
    [contextMenuCommandCatalog],
  );
  const menuPackLookup = useMemo(
    () => new Map(menuPacks.map((pack) => [pack.id, pack] as const)),
    [menuPacks],
  );
  const activeMenuPack = useMemo(() => {
    const requestedId = settings.explorer.activeMenuPackId;
    if (requestedId && menuPackLookup.has(requestedId)) {
      return menuPackLookup.get(requestedId) ?? null;
    }
    return menuPacks[0] ?? null;
  }, [menuPackLookup, menuPacks, settings.explorer.activeMenuPackId]);
  const activeContextMenuLayout = useMemo<ExplorerMenuContextLayout>(
    () =>
      settings.explorer.contextMenuLayoutOverridesByContext[
        activeContextMenuContext
      ] ??
      activeMenuPack?.contexts[activeContextMenuContext] ?? {
        renderer: "classic",
        entries: [],
      },
    [
      activeContextMenuContext,
      activeMenuPack,
      settings.explorer.contextMenuLayoutOverridesByContext,
    ],
  );
  const activeContextMenuEntries = useMemo(
    () => sortExplorerMenuLayoutEntries(activeContextMenuLayout.entries),
    [activeContextMenuLayout.entries],
  );
  const activeContextMenuSubmenus = useMemo(
    () =>
      activeContextMenuEntries.filter(
        (
          entry,
        ): entry is Extract<ExplorerMenuLayoutEntry, { kind: "submenu" }> =>
          entry.kind === "submenu",
      ),
    [activeContextMenuEntries],
  );
  const activeContextMenuCommandIds = useMemo(
    () =>
      new Set(
        activeContextMenuEntries
          .filter(
            (
              entry,
            ): entry is Extract<ExplorerMenuLayoutEntry, { kind: "command" }> =>
              entry.kind === "command",
          )
          .map((entry) => entry.commandId),
      ),
    [activeContextMenuEntries],
  );
  const availableContextMenuCommandsForActiveContext = useMemo(
    () =>
      contextMenuCommandCatalog.filter(
        (command) =>
          command.contexts.includes(activeContextMenuContext) &&
          !activeContextMenuCommandIds.has(command.id),
      ),
    [
      activeContextMenuCommandIds,
      activeContextMenuContext,
      contextMenuCommandCatalog,
    ],
  );
  const selectedContextMenuEntry = useMemo(
    () =>
      activeContextMenuEntries.find(
        (entry) => entry.id === selectedContextMenuEntryId,
      ) ?? null,
    [activeContextMenuEntries, selectedContextMenuEntryId],
  );
  const filteredContextMenuBrowserCommands = useMemo(() => {
    const normalizedQuery = contextMenuCommandBrowserQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return availableContextMenuCommandsForActiveContext;
    }

    return availableContextMenuCommandsForActiveContext.filter((command) => {
      const haystack = [
        command.title,
        command.description ?? "",
        command.id,
        command.group,
        command.source,
        resolveContextMenuCommandSourceLabel(command),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [
    availableContextMenuCommandsForActiveContext,
    contextMenuCommandBrowserQuery,
  ]);
  const contextMenuPreviewInvocation = useMemo(
    () => buildSettingsContextMenuPreviewInvocation(activeContextMenuContext),
    [activeContextMenuContext],
  );
  const contextMenuPreviewTargetPath = useMemo(
    () =>
      contextMenuPreviewInvocation.primaryEntry?.path ??
      contextMenuPreviewInvocation.previewTarget?.path ??
      contextMenuPreviewInvocation.currentLocation,
    [contextMenuPreviewInvocation],
  );
  const previewRuntimePlatform = platform === "unknown" ? "linux" : platform;
  const contextMenuPreviewEnvironment = useMemo<ExplorerMenuRuntimeEnvironment>(
    () => ({
      currentPath: contextMenuPreviewInvocation.currentLocation,
      currentPathIsCloud: false,
      currentPathIsHome: false,
      currentLocationSupportsMutation: true,
      currentPathIsArchiveVirtual: false,
      userHomePath: "/home/ephemara",
      runtimePlatform: previewRuntimePlatform,
      clipboardAvailable: true,
      canCreateDirectory: true,
      canCreateFile: true,
      revealPathLabel: "Reveal in Explorer",
      propertiesLabel: "Properties",
      supportsNativeOpenWith: true,
      supportsOpenWithSystemPicker: true,
      supportsNativeProperties: true,
      openWithProgramsByPath: {
        [contextMenuPreviewTargetPath]: {
          status: "ready",
          error: null,
          requestId: null,
          requestedAtEpochMs: null,
          catalog: {
            defaultProgram: {
              name:
                previewRuntimePlatform === "macos" ? "Preview" : "Default App",
              path:
                previewRuntimePlatform === "macos"
                  ? "com.apple.Preview"
                  : "/usr/bin/xdg-open",
              icon: null,
              isDefault: true,
            },
            recommendedPrograms: [
              {
                name: "VS Code",
                path: "/usr/bin/code",
                icon: null,
                isDefault: false,
              },
            ],
            otherPrograms: [],
          },
        },
      },
      supportsNativeIntegration: () => true,
      isCloudExplorerPath: () => false,
      isExplorerArchiveVirtualPath: () => false,
      isSemanticSearchTextLikeExtension: (extension) =>
        ["txt", "ts", "md", "json"].includes(extension.toLowerCase()),
      isExplorerArchiveEntry: (entry) =>
        ["zip", "tar", "gz"].includes(entry.extension.toLowerCase()),
      isBookmarked: () => false,
      canRunAudioBatch: () => false,
      openEntry: () => undefined,
      openWithSystemPicker: async () => undefined,
      openWithProgram: async () => undefined,
      openAsAdmin: async () => undefined,
      openInTerminal: () => undefined,
      openInFilesystemAquarium: () => undefined,
      sendToMobileDownload: async () => undefined,
      revealExplorerPath: async () => undefined,
      openExplorerPropertiesPanel: () => undefined,
      copyToSysClipboard: () => undefined,
      queueClipboard: () => undefined,
      requestTransferDestination: () => undefined,
      extractArchive: () => undefined,
      duplicateEntries: () => undefined,
      findSimilar: async () => undefined,
      startRename: () => undefined,
      openTagDialog: () => undefined,
      toggleBookmark: () => undefined,
      openTrashDialog: () => undefined,
      openNew: () => undefined,
      paste: () => undefined,
      refresh: async () => undefined,
      navigate: async () => undefined,
      openSettingsSection: (section) =>
        setActiveSection(section as SettingsSectionKey),
      openContextMenuComposer: (context) => {
        setActiveContextMenuComposerContext(context);
        setActiveSection("context-menus");
      },
      runAudioBatch: async () => undefined,
      executeActionCommand: async () => undefined,
      executePluginCommand: async () => undefined,
      onError: () => undefined,
    }),
    [
      contextMenuPreviewInvocation,
      contextMenuPreviewTargetPath,
      previewRuntimePlatform,
      setActiveContextMenuComposerContext,
      setActiveSection,
    ],
  );
  const contextMenuPreviewMenu = useMemo(
    () =>
      buildExplorerRuntimeMenu({
        invocation: contextMenuPreviewInvocation,
        menuPacks:
          menuPacks.length > 0 ? menuPacks : [createBuiltInExplorerMenuPack()],
        activeMenuPackId: activeMenuPack?.id ?? null,
        layoutOverridesByContext:
          settings.explorer.contextMenuLayoutOverridesByContext,
        themeRendererPreference: activeContextMenuLayout.renderer ?? "classic",
        actions,
        pluginContextMenuItems: [
          ...pluginContextMenuItems,
          ...createLegacyExplorerActionContextMenuContributions(
            pluginExplorerActions,
          ),
        ],
        includeEditMenuCommand: false,
        environment: contextMenuPreviewEnvironment,
      }),
    [
      actions,
      activeContextMenuLayout.renderer,
      activeMenuPack?.id,
      contextMenuPreviewEnvironment,
      contextMenuPreviewInvocation,
      menuPacks,
      pluginContextMenuItems,
      pluginExplorerActions,
      settings.explorer.contextMenuLayoutOverridesByContext,
    ],
  );

  useEffect(() => {
    setDraggedContextMenuEntryId(null);
    setContextMenuCommandBrowserQuery("");
  }, [activeContextMenuContext]);

  useEffect(() => {
    if (activeContextMenuEntries.length === 0) {
      if (selectedContextMenuEntryId != null) {
        setSelectedContextMenuEntryId(null);
      }
      return;
    }

    if (
      selectedContextMenuEntryId == null ||
      !activeContextMenuEntries.some(
        (entry) => entry.id === selectedContextMenuEntryId,
      )
    ) {
      setSelectedContextMenuEntryId(activeContextMenuEntries[0]?.id ?? null);
    }
  }, [activeContextMenuEntries, selectedContextMenuEntryId]);

  const availableAnimations = useMemo(
    () => animations.filter((animation) => !animation.error),
    [animations],
  );
  const availableWallpapers = useMemo(
    () => wallpapers.filter((wallpaper) => !wallpaper.error),
    [wallpapers],
  );
  const themePackageLookup = useMemo(
    () => new Map(themePackages.map((pkg) => [pkg.id, pkg] as const)),
    [themePackages],
  );
  const customThemeBundleLookup = useMemo(
    () =>
      new Map(
        settings.appearance.customThemeBundles
          .filter(
            (bundle): bundle is OverlayThemeBundleManifest & { id: string } =>
              typeof bundle.id === "string" && bundle.id.trim().length > 0,
          )
          .map((bundle) => [bundle.id.trim(), bundle] as const),
      ),
    [settings.appearance.customThemeBundles],
  );
  const activeManagedThemeId = settings.appearance.activeThemeId;
  const activeThemePackage = useMemo(
    () => themePackageLookup.get(activeManagedThemeId) ?? null,
    [activeManagedThemeId, themePackageLookup],
  );
  const activeThemeBundleManifest = useMemo(
    () =>
      customThemeBundleLookup.get(activeManagedThemeId) ??
      activeThemePackage?.manifest ??
      createThemeBundleManifestFromThemeDefinition(appearance.baseTheme),
    [
      activeManagedThemeId,
      activeThemePackage,
      appearance.baseTheme,
      customThemeBundleLookup,
    ],
  );
  const editableThemeBundle = useMemo(() => {
    const synthesizedBundle = createThemeBundleManifestFromThemeDefinition(
      appearance.baseTheme,
    );
    return {
      ...activeThemeBundleManifest,
      appearancePackId: synthesizedBundle.appearancePackId,
      interactionMotionPackId: synthesizedBundle.interactionMotionPackId,
      themeRecipeId: synthesizedBundle.themeRecipeId,
      themeEngineId: synthesizedBundle.themeEngineId,
      embedded: synthesizedBundle.embedded,
    } satisfies OverlayThemeBundleManifest;
  }, [activeThemeBundleManifest, appearance.baseTheme]);
  const availableAppearancePackEntries = useMemo(
    () =>
      buildThemeBundleCatalogEntries(
        appearancePacks,
        themePackages,
        (themePackage) => themePackage.localCatalogs?.appearancePacks ?? [],
      ),
    [appearancePacks, themePackages],
  );
  const availableRecipePackEntries = useMemo(
    () =>
      buildThemeBundleCatalogEntries(
        themeRecipePacks,
        themePackages,
        (themePackage) => themePackage.localCatalogs?.themeRecipePacks ?? [],
      ),
    [themePackages, themeRecipePacks],
  );
  const availableThemeEngineEntries = useMemo(
    () =>
      buildThemeBundleCatalogEntries(
        themeEnginePacks,
        themePackages,
        (themePackage) => themePackage.localCatalogs?.themeEnginePacks ?? [],
      ),
    [themeEnginePacks, themePackages],
  );
  const availableShellRendererEntries = useMemo(
    () =>
      buildThemeBundleCatalogEntries(
        shellRenderers,
        themePackages,
        (themePackage) => themePackage.localCatalogs?.shellRenderers ?? [],
      ),
    [shellRenderers, themePackages],
  );
  const availableInteractionMotionPackEntries = useMemo(
    () =>
      buildThemeBundleCatalogEntries(
        interactionMotionPacks,
        themePackages,
        (themePackage) =>
          themePackage.localCatalogs?.interactionMotionPacks ?? [],
      ),
    [interactionMotionPacks, themePackages],
  );
  const availableSoundPackEntries = useMemo(
    () =>
      buildThemeBundleCatalogEntries(
        soundPacks,
        themePackages,
        (themePackage) => themePackage.localCatalogs?.soundPacks ?? [],
      ),
    [soundPacks, themePackages],
  );
  const availableSoundPackCatalog = useMemo(
    () => availableSoundPackEntries.map((entry) => entry.pack),
    [availableSoundPackEntries],
  );
  const activeThemeLocalCatalogs = activeThemePackage?.localCatalogs;
  const effectiveThemeBundleManifest = editableThemeBundle;
  const activeThemeBundleLabel =
    activeThemeBundleManifest.name?.trim() || appearance.baseTheme.name;
  const soundPackThemeDefaultLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId:
          effectiveThemeBundleManifest.soundPackId ??
          appearance.baseTheme.defaultSoundPackId ??
          DEFAULT_SOUND_PACK_ID,
        entries: availableSoundPackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.soundPacks,
        emptyLabel: "GreebleFS Default",
      }),
    [
      activeThemeLocalCatalogs?.soundPacks,
      appearance.baseTheme.defaultSoundPackId,
      availableSoundPackEntries,
      effectiveThemeBundleManifest.soundPackId,
    ],
  );
  const appearancePackThemeDefaultLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId: effectiveThemeBundleManifest.appearancePackId,
        entries: availableAppearancePackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.appearancePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.appearancePacks,
        emptyLabel: "Built-In Appearance",
      }),
    [
      activeThemeLocalCatalogs?.appearancePacks,
      availableAppearancePackEntries,
      effectiveThemeBundleManifest.appearancePackId,
      effectiveThemeBundleManifest.embedded?.appearancePacks,
    ],
  );
  const themeRecipeThemeDefaultLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId: effectiveThemeBundleManifest.themeRecipeId,
        entries: availableRecipePackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.themeRecipePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.themeRecipes,
        emptyLabel: "Built-In Recipe",
      }),
    [
      activeThemeLocalCatalogs?.themeRecipePacks,
      availableRecipePackEntries,
      effectiveThemeBundleManifest.embedded?.themeRecipes,
      effectiveThemeBundleManifest.themeRecipeId,
    ],
  );
  const themeEngineThemeDefaultLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId: effectiveThemeBundleManifest.themeEngineId,
        entries: availableThemeEngineEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.themeEnginePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.themeEngines,
        emptyLabel: "Built-In Engine",
      }),
    [
      activeThemeLocalCatalogs?.themeEnginePacks,
      availableThemeEngineEntries,
      effectiveThemeBundleManifest.embedded?.themeEngines,
      effectiveThemeBundleManifest.themeEngineId,
    ],
  );
  const shellRendererThemeDefaultLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId: effectiveThemeBundleManifest.rendererId,
        entries: availableShellRendererEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.shellRenderers,
        emptyLabel: "Default Renderer",
      }),
    [
      activeThemeLocalCatalogs?.shellRenderers,
      availableShellRendererEntries,
      effectiveThemeBundleManifest.rendererId,
    ],
  );
  const interactionMotionPackThemeDefaultLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId: effectiveThemeBundleManifest.interactionMotionPackId,
        entries: availableInteractionMotionPackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.interactionMotionPacks,
        embeddedPacks:
          effectiveThemeBundleManifest.embedded?.interactionMotionPacks,
        emptyLabel: "Built-In Motion",
      }),
    [
      activeThemeLocalCatalogs?.interactionMotionPacks,
      availableInteractionMotionPackEntries,
      effectiveThemeBundleManifest.embedded?.interactionMotionPacks,
      effectiveThemeBundleManifest.interactionMotionPackId,
    ],
  );
  const appearancePackSelectionLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId:
          settings.appearance.activeAppearancePackId ??
          effectiveThemeBundleManifest.appearancePackId,
        entries: availableAppearancePackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.appearancePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.appearancePacks,
        emptyLabel: "Built-In Appearance",
      }),
    [
      activeThemeLocalCatalogs?.appearancePacks,
      availableAppearancePackEntries,
      effectiveThemeBundleManifest.appearancePackId,
      effectiveThemeBundleManifest.embedded?.appearancePacks,
      settings.appearance.activeAppearancePackId,
    ],
  );
  const themeRecipeSelectionLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId:
          settings.appearance.activeThemeRecipeId ??
          effectiveThemeBundleManifest.themeRecipeId,
        entries: availableRecipePackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.themeRecipePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.themeRecipes,
        emptyLabel: "Built-In Recipe",
      }),
    [
      activeThemeLocalCatalogs?.themeRecipePacks,
      availableRecipePackEntries,
      effectiveThemeBundleManifest.embedded?.themeRecipes,
      effectiveThemeBundleManifest.themeRecipeId,
      settings.appearance.activeThemeRecipeId,
    ],
  );
  const themeEngineSelectionLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId:
          settings.appearance.activeThemeEngineId ??
          effectiveThemeBundleManifest.themeEngineId,
        entries: availableThemeEngineEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.themeEnginePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.themeEngines,
        emptyLabel: "Built-In Engine",
      }),
    [
      activeThemeLocalCatalogs?.themeEnginePacks,
      availableThemeEngineEntries,
      effectiveThemeBundleManifest.embedded?.themeEngines,
      effectiveThemeBundleManifest.themeEngineId,
      settings.appearance.activeThemeEngineId,
    ],
  );
  const shellRendererSelectionLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId:
          settings.appearance.activeShellRendererId ??
          effectiveThemeBundleManifest.rendererId,
        entries: availableShellRendererEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.shellRenderers,
        emptyLabel: "Default Renderer",
      }),
    [
      activeThemeLocalCatalogs?.shellRenderers,
      availableShellRendererEntries,
      effectiveThemeBundleManifest.rendererId,
      settings.appearance.activeShellRendererId,
    ],
  );
  const soundPackSelectionLabel = useMemo(
    () =>
      resolveThemeBundlePackSelectionLabel({
        requestedId:
          settings.audio.activeSoundPackId ??
          effectiveThemeBundleManifest.soundPackId ??
          appearance.baseTheme.defaultSoundPackId ??
          DEFAULT_SOUND_PACK_ID,
        entries: availableSoundPackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.soundPacks,
        emptyLabel: "GreebleFS Default",
      }),
    [
      activeThemeLocalCatalogs?.soundPacks,
      appearance.baseTheme.defaultSoundPackId,
      availableSoundPackEntries,
      effectiveThemeBundleManifest.soundPackId,
      settings.audio.activeSoundPackId,
    ],
  );
  const resolvedPreviewSoundPack = useMemo(
    () =>
      resolveLoadedSoundPack(
        availableSoundPackCatalog,
        settings.audio.activeSoundPackId ??
          effectiveThemeBundleManifest.soundPackId ??
          appearance.baseTheme.defaultSoundPackId ??
          DEFAULT_SOUND_PACK_ID,
      ) ??
      resolveLoadedSoundPack(availableSoundPackCatalog, DEFAULT_SOUND_PACK_ID),
    [
      appearance.baseTheme.defaultSoundPackId,
      availableSoundPackCatalog,
      effectiveThemeBundleManifest.soundPackId,
      settings.audio.activeSoundPackId,
    ],
  );
  const soundPackSelectionSummary = `${settings.audio.activeSoundPackId == null ? "Follow Theme" : "Pinned"} · ${soundPackSelectionLabel}`;
  const appearancePackSelectionSummary = `${settings.appearance.activeAppearancePackId == null ? "Follow Theme" : "Pinned"} · ${appearancePackSelectionLabel}`;
  const themeRecipeSelectionSummary = `${settings.appearance.activeThemeRecipeId == null ? "Follow Theme" : "Pinned"} · ${themeRecipeSelectionLabel}`;
  const themeEngineSelectionSummary = `${settings.appearance.activeThemeEngineId == null ? "Follow Theme" : "Pinned"} · ${themeEngineSelectionLabel}`;
  const shellRendererSelectionSummary = `${settings.appearance.activeShellRendererId == null ? "Follow Theme" : "Pinned"} · ${shellRendererSelectionLabel}`;
  const soundPackCatalogCounts = useMemo(
    () => countThemeBundleCatalogEntriesBySource(availableSoundPackEntries),
    [availableSoundPackEntries],
  );
  const appearancePackCatalogCounts = useMemo(
    () =>
      countThemeBundleCatalogEntriesBySource(availableAppearancePackEntries),
    [availableAppearancePackEntries],
  );
  const themeRecipeCatalogCounts = useMemo(
    () => countThemeBundleCatalogEntriesBySource(availableRecipePackEntries),
    [availableRecipePackEntries],
  );
  const themeEngineCatalogCounts = useMemo(
    () => countThemeBundleCatalogEntriesBySource(availableThemeEngineEntries),
    [availableThemeEngineEntries],
  );
  const shellRendererCatalogCounts = useMemo(
    () => countThemeBundleCatalogEntriesBySource(availableShellRendererEntries),
    [availableShellRendererEntries],
  );
  const interactionMotionPackCatalogCounts = useMemo(
    () =>
      countThemeBundleCatalogEntriesBySource(
        availableInteractionMotionPackEntries,
      ),
    [availableInteractionMotionPackEntries],
  );
  const appearancePackPinnedSelectionMissing = useMemo(
    () =>
      settings.appearance.activeAppearancePackId != null &&
      !hasThemeBundlePackSelection({
        requestedId: settings.appearance.activeAppearancePackId,
        entries: availableAppearancePackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.appearancePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.appearancePacks,
      }),
    [
      activeThemeLocalCatalogs?.appearancePacks,
      availableAppearancePackEntries,
      effectiveThemeBundleManifest.embedded?.appearancePacks,
      settings.appearance.activeAppearancePackId,
    ],
  );
  const themeRecipePinnedSelectionMissing = useMemo(
    () =>
      settings.appearance.activeThemeRecipeId != null &&
      !hasThemeBundlePackSelection({
        requestedId: settings.appearance.activeThemeRecipeId,
        entries: availableRecipePackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.themeRecipePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.themeRecipes,
      }),
    [
      activeThemeLocalCatalogs?.themeRecipePacks,
      availableRecipePackEntries,
      effectiveThemeBundleManifest.embedded?.themeRecipes,
      settings.appearance.activeThemeRecipeId,
    ],
  );
  const themeEnginePinnedSelectionMissing = useMemo(
    () =>
      settings.appearance.activeThemeEngineId != null &&
      !hasThemeBundlePackSelection({
        requestedId: settings.appearance.activeThemeEngineId,
        entries: availableThemeEngineEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.themeEnginePacks,
        embeddedPacks: effectiveThemeBundleManifest.embedded?.themeEngines,
      }),
    [
      activeThemeLocalCatalogs?.themeEnginePacks,
      availableThemeEngineEntries,
      effectiveThemeBundleManifest.embedded?.themeEngines,
      settings.appearance.activeThemeEngineId,
    ],
  );
  const shellRendererPinnedSelectionMissing = useMemo(
    () =>
      settings.appearance.activeShellRendererId != null &&
      !hasThemeBundlePackSelection({
        requestedId: settings.appearance.activeShellRendererId,
        entries: availableShellRendererEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.shellRenderers,
      }),
    [
      activeThemeLocalCatalogs?.shellRenderers,
      availableShellRendererEntries,
      settings.appearance.activeShellRendererId,
    ],
  );
  const soundPackPinnedSelectionMissing = useMemo(
    () =>
      settings.audio.activeSoundPackId != null &&
      !hasThemeBundlePackSelection({
        requestedId: settings.audio.activeSoundPackId,
        entries: availableSoundPackEntries,
        activeThemeLocalPacks: activeThemeLocalCatalogs?.soundPacks,
      }),
    [
      activeThemeLocalCatalogs?.soundPacks,
      availableSoundPackEntries,
      settings.audio.activeSoundPackId,
    ],
  );
  const activeAppearancePackCardId = useMemo(
    () =>
      findThemeBundleCatalogEntry(
        availableAppearancePackEntries,
        settings.appearance.activeAppearancePackId,
      )?.pack.id ?? settings.appearance.activeAppearancePackId,
    [
      availableAppearancePackEntries,
      settings.appearance.activeAppearancePackId,
    ],
  );
  const activeThemeRecipeCardId = useMemo(
    () =>
      findThemeBundleCatalogEntry(
        availableRecipePackEntries,
        settings.appearance.activeThemeRecipeId,
      )?.pack.id ?? settings.appearance.activeThemeRecipeId,
    [availableRecipePackEntries, settings.appearance.activeThemeRecipeId],
  );
  const activeThemeEngineCardId = useMemo(
    () =>
      findThemeBundleCatalogEntry(
        availableThemeEngineEntries,
        settings.appearance.activeThemeEngineId,
      )?.pack.id ?? settings.appearance.activeThemeEngineId,
    [availableThemeEngineEntries, settings.appearance.activeThemeEngineId],
  );
  const activeShellRendererCardId = useMemo(
    () =>
      findThemeBundleCatalogEntry(
        availableShellRendererEntries,
        settings.appearance.activeShellRendererId,
      )?.pack.id ?? settings.appearance.activeShellRendererId,
    [availableShellRendererEntries, settings.appearance.activeShellRendererId],
  );
  const activeSoundPackCardId = useMemo(
    () =>
      findThemeBundleCatalogEntry(
        availableSoundPackEntries,
        settings.audio.activeSoundPackId,
      )?.pack.id ?? settings.audio.activeSoundPackId,
    [availableSoundPackEntries, settings.audio.activeSoundPackId],
  );
  const soundPackFollowThemeDetail = `${activeThemeBundleLabel} currently resolves the sound-pack lane to ${soundPackThemeDefaultLabel}.`;
  const appearancePackFollowThemeDetail = `${activeThemeBundleLabel} currently resolves the appearance lane to ${appearancePackThemeDefaultLabel}.`;
  const themeRecipeFollowThemeDetail = `${activeThemeBundleLabel} currently resolves the recipe lane to ${themeRecipeThemeDefaultLabel}.`;
  const themeEngineFollowThemeDetail = `${activeThemeBundleLabel} currently resolves the theme engine lane to ${themeEngineThemeDefaultLabel}.`;
  const shellRendererFollowThemeDetail = effectiveThemeBundleManifest.rendererId
    ? `${activeThemeBundleLabel} currently resolves the renderer lane to ${shellRendererThemeDefaultLabel}.`
    : `${activeThemeBundleLabel} does not pin a renderer pack, so the shell is using its built-in renderer runtime.`;
  const appearancePackCardOptions = useMemo(
    () =>
      availableAppearancePackEntries.map(
        ({ pack, sourceKind, sourceLabel }) =>
          ({
            id: pack.id,
            name: pack.name,
            description: pack.description,
            badges: [
              pack.appearance.palette?.accent ? "Accent" : null,
              pack.appearance.fonts?.ui ? "UI Font" : null,
              pack.appearance.visuals?.length
                ? `Visuals ${pack.appearance.visuals.length}`
                : null,
            ].filter((value): value is string => Boolean(value)),
            summary: [
              pack.appearance.palette?.accent
                ? `Accent ${pack.appearance.palette.accent}`
                : null,
              pack.appearance.fonts?.ui
                ? `UI ${pack.appearance.fonts.ui}`
                : null,
              pack.appearance.visuals?.length
                ? `Visuals ${pack.appearance.visuals.length}`
                : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
            sourceKind,
            sourceLabel,
            tags: pack.tags,
            warnings: pack.warnings,
          }) satisfies ThemeBundleCatalogCardOption,
      ),
    [availableAppearancePackEntries],
  );
  const themeRecipeCardOptions = useMemo(
    () =>
      availableRecipePackEntries.map(
        ({ pack, sourceKind, sourceLabel }) =>
          ({
            id: pack.id,
            name: pack.name,
            description: pack.description,
            badges: [
              pack.recipe.workbench ? "Workbench" : null,
              pack.recipe.explorer ? "Explorer" : null,
              pack.recipe.dock ? "Dock" : null,
            ].filter((value): value is string => Boolean(value)),
            summary: [
              pack.recipe.workbench ? "Workbench" : null,
              pack.recipe.explorer ? "Explorer" : null,
              pack.recipe.dock ? "Dock" : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
            sourceKind,
            sourceLabel,
            tags: pack.tags,
            warnings: pack.warnings,
          }) satisfies ThemeBundleCatalogCardOption,
      ),
    [availableRecipePackEntries],
  );
  const themeEngineCardOptions = useMemo(
    () =>
      availableThemeEngineEntries.map(
        ({ pack, sourceKind, sourceLabel }) =>
          ({
            id: pack.id,
            name: pack.name,
            description: pack.description,
            badges: [
              pack.engineManifest.renderStyles.length > 0
                ? `Render ${pack.engineManifest.renderStyles.length}`
                : null,
              pack.engineManifest.designTokens.length > 0
                ? `Tokens ${pack.engineManifest.designTokens.length}`
                : null,
              pack.engineManifest.compatibility.shellBlueprints.length > 0
                ? `Shell ${pack.engineManifest.compatibility.shellBlueprints.length}`
                : null,
            ].filter((value): value is string => Boolean(value)),
            summary: [
              pack.engineManifest.renderStyles.length > 0
                ? `${pack.engineManifest.renderStyles.length} render styles`
                : null,
              pack.engineManifest.designTokens.length > 0
                ? `${pack.engineManifest.designTokens.length} tokens`
                : null,
              pack.engineManifest.compatibility.shellBlueprints.length > 0
                ? `${pack.engineManifest.compatibility.shellBlueprints.length} shell targets`
                : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
            sourceKind,
            sourceLabel,
            tags: pack.tags,
            warnings: pack.warnings,
          }) satisfies ThemeBundleCatalogCardOption,
      ),
    [availableThemeEngineEntries],
  );
  const shellRendererCardOptions = useMemo(
    () =>
      availableShellRendererEntries.map(
        ({ pack, sourceKind, sourceLabel }) =>
          ({
            id: pack.id,
            name: pack.name,
            description: pack.description ?? pack.renderer?.description,
            badges: [
              pack.renderer?.fallbackRuntime
                ? `Runtime ${pack.renderer.fallbackRuntime}`
                : null,
              pack.renderer?.supportsLiveSwap ? "Live Swap" : null,
              pack.renderer?.capabilities.wallpaperScene ? "Wallpaper" : null,
              pack.renderer?.capabilities.customScreens ? "Screens" : null,
            ].filter((value): value is string => Boolean(value)),
            summary: [
              pack.renderer?.fallbackRuntime
                ? `Runtime ${pack.renderer.fallbackRuntime}`
                : null,
              pack.renderer?.supportsLiveSwap ? "Live swap" : null,
              pack.renderer?.capabilities.wallpaperScene
                ? "Wallpaper scene"
                : null,
              pack.renderer?.capabilities.customScreens
                ? "Custom screens"
                : null,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" · "),
            sourceKind,
            sourceLabel,
            tags: pack.tags,
            warnings: [
              ...pack.warnings,
              ...(pack.renderer?.error ? [pack.renderer.error] : []),
            ],
          }) satisfies ThemeBundleCatalogCardOption,
      ),
    [availableShellRendererEntries],
  );
  const soundPackCardOptions = useMemo(
    () =>
      availableSoundPackEntries.map(({ pack, sourceKind, sourceLabel }) => {
        const cues = Object.values(pack.sounds);
        const synthCount = cues.filter((cue) => cue?.kind === "synth").length;
        const sampleCount = cues.filter((cue) => cue?.kind === "sample").length;
        const missingCueCount = overlaySoundEffectCatalog.length - cues.length;

        return {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          badges: [
            cues.length > 0 ? `FX ${cues.length}` : "No cues",
            synthCount > 0 ? `Synth ${synthCount}` : null,
            sampleCount > 0 ? `Sample ${sampleCount}` : null,
          ].filter((value): value is string => Boolean(value)),
          summary: [
            `Master ${Math.round(pack.masterVolume * 100)}%`,
            missingCueCount > 0
              ? `${missingCueCount} default fallback${missingCueCount === 1 ? "" : "s"}`
              : "Full cue set",
          ].join(" · "),
          sourceKind,
          sourceLabel,
          tags: pack.tags,
          warnings: pack.warnings,
        } satisfies ThemeBundleCatalogCardOption;
      }),
    [availableSoundPackEntries],
  );
  const normalizedActiveIconThemeId = useMemo(
    () =>
      normalizeIconThemePackageSelectionId(
        settings.appearance.activeIconThemeId,
      ),
    [settings.appearance.activeIconThemeId],
  );
  const iconThemePackageLookup = useMemo(
    () =>
      new Map(
        iconThemePackages.map(
          (pkg) =>
            [
              normalizeIconThemePackageSelectionId(pkg.id) ?? pkg.id,
              pkg,
            ] as const,
        ),
      ),
    [iconThemePackages],
  );
  const activeIconThemePackage = useMemo(
    () =>
      normalizedActiveIconThemeId
        ? (iconThemePackageLookup.get(normalizedActiveIconThemeId) ??
          resolveLoadedIconThemePackage(
            iconThemePackages,
            normalizedActiveIconThemeId,
          ))
        : null,
    [iconThemePackageLookup, iconThemePackages, normalizedActiveIconThemeId],
  );
  const availableShaders = useMemo(
    () => shaders.filter((shader) => !shader.error),
    [shaders],
  );
  const openAnimationOptions = useMemo(
    () => availableAnimations.filter((animation) => animation.open),
    [availableAnimations],
  );
  const closeAnimationOptions = useMemo(
    () => availableAnimations.filter((animation) => animation.close),
    [availableAnimations],
  );
  const availableOpenAnimationIds = useMemo(
    () => openAnimationOptions.map((animation) => animation.id),
    [openAnimationOptions],
  );
  const availableCloseAnimationIds = useMemo(
    () => closeAnimationOptions.map((animation) => animation.id),
    [closeAnimationOptions],
  );
  const animationFailures = useMemo(
    () => animationDiagnostics.filter((animation) => Boolean(animation.error)),
    [animationDiagnostics],
  );
  const wallpaperFailures = useMemo(
    () => wallpaperDiagnostics.filter((wallpaper) => Boolean(wallpaper.error)),
    [wallpaperDiagnostics],
  );
  const shaderFailures = useMemo(
    () => shaderDiagnostics.filter((shader) => Boolean(shader.error)),
    [shaderDiagnostics],
  );
  const availableShaderIds = useMemo(
    () => availableShaders.map((shader) => shader.id),
    [availableShaders],
  );
  const shaderPerformanceMode = settings.appearance.shaderPerformanceMode;
  const shaderPerformanceProfile = useMemo(
    () => getShaderPerformanceProfile(shaderPerformanceMode),
    [shaderPerformanceMode],
  );
  const appAppearance = appearance.app;
  const dockAppearance = appearance.dock;
  const resolvedTopBarSelection = useMemo(
    () =>
      resolveActiveTopBarSelection({
        requestedTopBarId: settings.appearance.activeTopBarId,
        theme: appearance.baseTheme,
        packageSources: [...topBarPackages, ...themePackages],
      }),
    [
      appearance.baseTheme,
      settings.appearance.activeTopBarId,
      themePackages,
      topBarPackages,
    ],
  );
  const availableTopBars = resolvedTopBarSelection.availableTopBars;
  const topBarCatalogLoading = topBarPackagesLoading || themePackagesLoading;
  const authoredTopBarCount = useMemo(
    () => topBarPackages.reduce((total, pkg) => total + pkg.topBars.length, 0),
    [topBarPackages],
  );
  const themeContributedTopBarCount = useMemo(
    () =>
      themePackages.reduce(
        (total, pkg) => total + (pkg.topBars?.length ?? 0),
        0,
      ),
    [themePackages],
  );
  const blurEnabled = settings.appearance.appBlur !== false;
  const activeWallpaperSelectionId =
    settings.appearance.activeWallpaperId ?? null;
  const themeWallpaperAvailable = Boolean(
    appAppearance.baseTheme.assets?.backgroundUrl,
  );
  const wallpaperSelectionSummary =
    activeWallpaperSelectionId == null
      ? themeWallpaperAvailable
        ? "Theme Default"
        : "No Wallpaper"
      : activeWallpaperSelectionId === wallpaperSystemConfig.noneWallpaperId
        ? "Disabled"
        : "Settings Override";
  const topBarSelectionSummary =
    settings.appearance.activeTopBarId == null
      ? `Follow Theme · ${resolvedTopBarSelection.topBar.name}`
      : resolvedTopBarSelection.explicitSelectionMissing
        ? `Pinned missing · ${resolvedTopBarSelection.topBar.name}`
        : `Pinned · ${resolvedTopBarSelection.topBar.name}`;
  const followThemeTopBarDetail =
    resolvedTopBarSelection.resolvedFrom === "theme-default"
      ? `${appearance.baseTheme.name} explicitly defaults to ${resolvedTopBarSelection.topBar.name}.`
      : resolvedTopBarSelection.resolvedFrom === "theme-legacy-style"
        ? `${appearance.baseTheme.name} does not declare a standalone top bar yet, so the shell falls back from that theme's legacy workbench top-bar style into ${resolvedTopBarSelection.topBar.name}.`
        : `${appearance.baseTheme.name} is currently using the built-in top-bar fallback ${resolvedTopBarSelection.topBar.name}.`;
  const semanticIndexingSelectedModel = useMemo(
    () =>
      getLocalModelDefinition(semanticIndexingBinding.modelId) ??
      getLocalModelDefinitionByProviderModelId(semanticIndexingBinding.modelId),
    [semanticIndexingBinding.modelId],
  );
  const semanticIndexingBackendLabel = useMemo(
    () =>
      localModelBackendOptions.find(
        (option) =>
          option.id ===
          normalizeLocalModelBackendPreference(
            semanticIndexingBinding.backendPreference,
          ),
      )?.label ?? "Auto",
    [semanticIndexingBinding.backendPreference],
  );
  const installedLocalModelCount =
    localModelStatus?.installedModelCount ??
    localModelStatus?.models.filter((model) => model.installed).length ??
    0;
  const localModelCacheFootprint = `${formatModelCacheBytes(localModelStatus?.totalCacheSizeBytes ?? 0)} cache`;
  const semanticIndexModelSummary = `${semanticIndexingSelectedModel?.label ?? "No model"} · ${semanticIndexingBackendLabel}`;
  const semanticIndexingSelectedModelStatus = useMemo(
    () =>
      semanticIndexingSelectedModel
        ? (localModelStatusById.get(semanticIndexingSelectedModel.id) ?? null)
        : null,
    [localModelStatusById, semanticIndexingSelectedModel],
  );
  const semanticIndexingSelectedHardwareProfile = useMemo(
    () =>
      getLocalModelHardwareProfile(
        semanticIndexingSelectedModel?.hardwareProfileId,
      ),
    [semanticIndexingSelectedModel?.hardwareProfileId],
  );
  const effectiveShaderId = useMemo(
    () =>
      resolvePreferredShaderId({
        availableShaderIds,
        userOverrideId: settings.appearance.activeShaderId,
        themeDefaultShaderId: appAppearance.baseTheme.defaultShaderId,
        performanceMode: shaderPerformanceMode,
      }),
    [
      appAppearance.baseTheme.defaultShaderId,
      availableShaderIds,
      shaderPerformanceMode,
      settings.appearance.activeShaderId,
    ],
  );
  const effectiveShader = useMemo(
    () =>
      availableShaders.find((shader) => shader.id === effectiveShaderId) ??
      null,
    [availableShaders, effectiveShaderId],
  );
  const enabledShaderSurfaces = useMemo(
    () => getShaderEnabledSurfaceIds(effectiveShader),
    [effectiveShader],
  );
  const effectiveShaderControlOverrides = useMemo(
    () =>
      effectiveShader
        ? (settings.appearance.shaderControlValues[effectiveShader.id] ?? {})
        : {},
    [effectiveShader, settings.appearance.shaderControlValues],
  );
  const shaderSettingsShellContext =
    useMemo<OverlayShaderShellContext | null>(() => {
      if (!effectiveShader) {
        return null;
      }

      return {
        id: effectiveShader.id,
        name: effectiveShader.name,
        filePath: effectiveShader.filePath,
        shaderRoot: effectiveShader.shaderRoot,
        source: effectiveShader.source,
        viewport: {
          width: typeof window === "undefined" ? 0 : window.innerWidth,
          height: typeof window === "undefined" ? 0 : window.innerHeight,
        },
        accentColor: appearance.theme.palette.accent,
        theme: appearance.theme,
        panelTransparency: settings.appearance.panelTransparency,
        blurStrength: settings.appearance.appBlurStrength,
        zoom: settings.appearance.appZoom,
        isSettingsActive: true,
        shaderControlValues: effectiveShaderControlOverrides,
      };
    }, [
      appearance.theme,
      effectiveShader,
      effectiveShaderControlOverrides,
      settings.appearance.appBlurStrength,
      settings.appearance.appZoom,
      settings.appearance.panelTransparency,
    ]);
  const effectiveShaderComputedUniforms = useMemo(
    () =>
      shaderSettingsShellContext
        ? resolveShaderComputedUniforms(
            effectiveShader,
            shaderSettingsShellContext,
          )
        : {},
    [effectiveShader, shaderSettingsShellContext],
  );
  const effectiveShaderControlValues = useMemo(
    () =>
      resolveShaderControlValues(
        effectiveShader,
        effectiveShaderControlOverrides,
        effectiveShaderComputedUniforms,
      ),
    [
      effectiveShader,
      effectiveShaderComputedUniforms,
      effectiveShaderControlOverrides,
    ],
  );
  const shaderSelectionSummary = settings.appearance.activeShaderId
    ? "Settings Override"
    : shaderPerformanceProfile.shellUsesThemeDefault
      ? appAppearance.baseTheme.defaultShaderId
        ? "Theme Default"
        : "Fallback"
      : `${shaderPerformanceProfile.label} Mode`;
  const effectiveOpenAnimationId = useMemo(
    () =>
      resolvePreferredAnimationId({
        availableAnimationIds: availableOpenAnimationIds,
        userOverrideId: settings.appearance.appOpenAnimation,
        themeDefaultAnimationId: appAppearance.baseTheme.defaultOpenAnimationId,
        fallbackAnimationId: animationSystemConfig.defaultOpenAnimationId,
      }),
    [
      appAppearance.baseTheme.defaultOpenAnimationId,
      availableOpenAnimationIds,
      settings.appearance.appOpenAnimation,
    ],
  );
  const effectiveCloseAnimationId = useMemo(
    () =>
      resolvePreferredAnimationId({
        availableAnimationIds: availableCloseAnimationIds,
        userOverrideId: settings.appearance.appCloseAnimation,
        themeDefaultAnimationId:
          appAppearance.baseTheme.defaultCloseAnimationId,
        fallbackAnimationId: animationSystemConfig.defaultCloseAnimationId,
      }),
    [
      appAppearance.baseTheme.defaultCloseAnimationId,
      availableCloseAnimationIds,
      settings.appearance.appCloseAnimation,
    ],
  );
  const shellTransitionsEnabled = settings.appearance.animations;
  const settingsInteractionMotion =
    useInteractionMotionController(appAppearance);
  const settingsCardTransition =
    "background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, opacity 0.16s ease";
  const themeInteractionMotionPresetId = useMemo(
    () =>
      normalizeInteractionMotionPresetId(
        appAppearance.baseTheme.interactionMotion?.defaultPresetId,
      ),
    [appAppearance.baseTheme.interactionMotion?.defaultPresetId],
  );
  const sharedInteractionMotionPresetId = useMemo(
    () =>
      normalizeInteractionMotionPresetId(
        settings.appearance.interactionMotionPresetId,
      ),
    [settings.appearance.interactionMotionPresetId],
  );
  const interactionMotionPresetGroups = useMemo(
    () => [
      {
        id: "system",
        label: "System Profiles",
        subtitle: "Fast shell defaults tuned for everyday UI interaction.",
        options: interactionMotionPresetOptions.filter(
          (option) => option.groupId === "system",
        ),
      },
      {
        id: "kcloner",
        label: "KCloner Motion Set",
        subtitle:
          "Cinema4D / MoGraph-flavored UI motion families pulled into the shell.",
        options: interactionMotionPresetOptions.filter(
          (option) => option.groupId === "kcloner",
        ),
      },
    ],
    [],
  );
  const interactionMotionModuleEditorStates = useMemo(
    () =>
      interactionMotionModuleCatalog.map((module) => {
        const moduleOverride = normalizeInteractionMotionModuleOverride(
          settings.appearance.interactionMotionModuleOverrides[module.id],
        );
        const effectivePresetId = resolveInteractionMotionModuleProfileId({
          moduleId: module.id,
          settings: settings.appearance,
          themeDefaultPresetId: themeInteractionMotionPresetId,
        });
        const effectiveProfile =
          interactionMotionPresetOptions.find(
            (option) => option.id === effectivePresetId,
          ) ?? interactionMotionPresetOptions[0];
        const modifierControls =
          getInteractionMotionProfileModifierControls(effectivePresetId);
        const modifierValues = resolveInteractionMotionModifierValues(
          effectivePresetId,
          moduleOverride.modifierValuesByPresetId[effectivePresetId],
        );

        return {
          module,
          moduleOverride,
          effectivePresetId,
          effectiveProfile,
          modifierControls,
          modifierValues,
        };
      }),
    [settings.appearance, themeInteractionMotionPresetId],
  );
  const effectiveInteractionMotionProfileLabel = useMemo(
    () =>
      interactionMotionModuleEditorStates
        .map(
          (state) => `${state.module.label}: ${state.effectiveProfile.label}`,
        )
        .join(" · "),
    [interactionMotionModuleEditorStates],
  );
  const effectiveLayoutDynamicsPresetLabel = useMemo(
    () =>
      getLayoutDynamicsPreset(
        resolveLayoutDynamicsPresetId({
          requestedPresetId: settings.appearance.layoutDynamicsPresetId,
          themeDefaultPresetId:
            appAppearance.baseTheme.layoutDynamics?.defaultPresetId ?? null,
        }),
      ).label,
    [
      appAppearance.baseTheme.layoutDynamics?.defaultPresetId,
      settings.appearance.layoutDynamicsPresetId,
    ],
  );
  const bindSettingsCardMotion = useCallback(
    (active = false) =>
      settingsInteractionMotion.bindSurface({
        surfaceId: "settingsCard",
        triggerState: active ? { activate: true } : undefined,
        baseTransition: settingsCardTransition,
      }),
    [settingsCardTransition, settingsInteractionMotion],
  );
  const setInteractionMotionModuleEnabled = useCallback(
    (
      moduleId: (typeof interactionMotionModuleCatalog)[number]["id"],
      enabled: boolean,
    ) => {
      const currentOverride = normalizeInteractionMotionModuleOverride(
        settings.appearance.interactionMotionModuleOverrides[moduleId],
      );
      updateAppearance({
        interactionMotionModuleOverrides: {
          ...settings.appearance.interactionMotionModuleOverrides,
          [moduleId]: {
            ...currentOverride,
            enabled,
          },
        },
      });
    },
    [settings.appearance.interactionMotionModuleOverrides, updateAppearance],
  );
  const setInteractionMotionModulePresetId = useCallback(
    (
      moduleId: (typeof interactionMotionModuleCatalog)[number]["id"],
      presetId: string | null,
    ) => {
      const currentOverride = normalizeInteractionMotionModuleOverride(
        settings.appearance.interactionMotionModuleOverrides[moduleId],
      );
      updateAppearance({
        interactionMotionModuleOverrides: {
          ...settings.appearance.interactionMotionModuleOverrides,
          [moduleId]: {
            ...currentOverride,
            presetId,
          },
        },
      });
    },
    [settings.appearance.interactionMotionModuleOverrides, updateAppearance],
  );
  const setInteractionMotionModuleIntensity = useCallback(
    (
      moduleId: (typeof interactionMotionModuleCatalog)[number]["id"],
      intensityMultiplier: number,
    ) => {
      const currentOverride = normalizeInteractionMotionModuleOverride(
        settings.appearance.interactionMotionModuleOverrides[moduleId],
      );
      updateAppearance({
        interactionMotionModuleOverrides: {
          ...settings.appearance.interactionMotionModuleOverrides,
          [moduleId]: {
            ...currentOverride,
            intensityMultiplier:
              clampInteractionMotionIntensity(intensityMultiplier),
          },
        },
      });
    },
    [settings.appearance.interactionMotionModuleOverrides, updateAppearance],
  );
  const setInteractionMotionModuleModifierValue = useCallback(
    (
      moduleId: (typeof interactionMotionModuleCatalog)[number]["id"],
      presetId: string,
      controlId: string,
      value: number,
    ) => {
      const currentOverride = normalizeInteractionMotionModuleOverride(
        settings.appearance.interactionMotionModuleOverrides[moduleId],
      );
      const nextModifierValuesByPresetId = {
        ...currentOverride.modifierValuesByPresetId,
        [presetId]: {
          ...(currentOverride.modifierValuesByPresetId[presetId] ?? {}),
          [controlId]: value,
        },
      };

      updateAppearance({
        interactionMotionModuleOverrides: {
          ...settings.appearance.interactionMotionModuleOverrides,
          [moduleId]: {
            ...currentOverride,
            modifierValuesByPresetId: nextModifierValuesByPresetId,
          },
        },
      });
    },
    [settings.appearance.interactionMotionModuleOverrides, updateAppearance],
  );
  const setInteractionMotionSurfaceEnabled = useCallback(
    (
      surfaceId: (typeof interactionMotionSurfaceCatalog)[number]["id"],
      enabled: boolean,
    ) => {
      const nextOverrides = {
        ...settings.appearance.interactionMotionSurfaceOverrides,
      };
      const currentOverride = nextOverrides[surfaceId];

      if (enabled) {
        if (
          currentOverride &&
          typeof currentOverride === "object" &&
          !Array.isArray(currentOverride)
        ) {
          const nextOverride = { ...currentOverride };
          delete nextOverride.enabled;
          if (Object.keys(nextOverride).length > 0) {
            nextOverrides[surfaceId] = nextOverride;
          } else {
            delete nextOverrides[surfaceId];
          }
        } else {
          delete nextOverrides[surfaceId];
        }
      } else if (
        currentOverride &&
        typeof currentOverride === "object" &&
        !Array.isArray(currentOverride)
      ) {
        nextOverrides[surfaceId] = {
          ...currentOverride,
          enabled: false,
        };
      } else {
        nextOverrides[surfaceId] = false;
      }

      updateAppearance({ interactionMotionSurfaceOverrides: nextOverrides });
    },
    [settings.appearance.interactionMotionSurfaceOverrides, updateAppearance],
  );
  const shellTransitionMotionCard = bindSettingsCardMotion();
  const interactionMotionCard = bindSettingsCardMotion(
    settings.appearance.interactionMotionEnabled,
  );

  useEffect(() => {
    ensureFontFamilyLoaded(appearance.fonts.ui);
    ensureFontFamilyLoaded(settings.terminal.fontFamily);
  }, [appearance.fonts.ui, settings.terminal.fontFamily]);

  useEffect(() => {
    setThemeDraft(serializeThemeBundle(editableThemeBundle));
  }, [editableThemeBundle]);

  useEffect(() => {
    let cancelled = false;

    loadExternalLayoutManifest(settings.layout.configPath)
      .then((result) => {
        if (!cancelled) {
          setLayoutManifestState(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn(
            "OverlayTerm: failed to load layout manifest in settings",
            error,
          );
          setLayoutManifestState({
            ...DEFAULT_LOADED_LAYOUT_MANIFEST,
            sourceError: String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.layout.configPath]);

  const persistThemeBundle = useCallback(
    (nextBundle: OverlayThemeBundleManifest) => {
      const requestedId =
        nextBundle.id?.trim() ||
        activeManagedThemeId ||
        appAppearance.baseTheme.id;
      const builtinIds = new Set(
        overlayThemePresets.map((themeDef) => themeDef.id),
      );
      const collidesWithManagedTheme =
        builtinIds.has(requestedId) || themePackageLookup.has(requestedId);
      const fallbackBundleName =
        activeThemeBundleManifest.name?.trim() || appAppearance.baseTheme.name;
      const customBundle = {
        ...nextBundle,
        id: collidesWithManagedTheme ? `${requestedId}-custom` : requestedId,
        name: collidesWithManagedTheme
          ? `${nextBundle.name?.trim() || fallbackBundleName} Custom`
          : nextBundle.name?.trim() || fallbackBundleName,
      } satisfies OverlayThemeBundleManifest;
      const nextCustomThemeBundles = upsertCustomThemeBundle(
        settings.appearance.customThemeBundles,
        customBundle,
      );
      updateAppearance({
        customThemeBundles: nextCustomThemeBundles,
        activeThemeId: customBundle.id,
      });
      setThemeDraft(serializeThemeBundle(customBundle));
      return customBundle;
    },
    [
      activeManagedThemeId,
      activeThemeBundleManifest.name,
      appAppearance.baseTheme.id,
      appAppearance.baseTheme.name,
      settings.appearance.customThemeBundles,
      themePackageLookup,
      updateAppearance,
    ],
  );

  const applyThemeSelection = useCallback(
    (themeId: string) => {
      applyThemeSelectionWithDefaults(themeId);
    },
    [applyThemeSelectionWithDefaults],
  );
  const applyDockThemeSelection = useCallback(
    (themeId: string) => {
      applyDockThemeSelectionWithDefaults(themeId);
    },
    [applyDockThemeSelectionWithDefaults],
  );
  const applyIconThemeSelection = useCallback(
    (iconThemeId: string | null) => {
      updateAppearance({ activeIconThemeId: iconThemeId });
    },
    [updateAppearance],
  );
  const setActiveMenuPackId = useCallback(
    (packId: string) => {
      updateExplorer({ activeMenuPackId: packId });
    },
    [updateExplorer],
  );
  const writeContextMenuLayoutOverride = useCallback(
    (
      contextKind: ExplorerMenuContextKind,
      nextLayout: ExplorerMenuContextLayout,
    ) => {
      updateExplorer({
        contextMenuLayoutOverridesByContext: {
          ...settings.explorer.contextMenuLayoutOverridesByContext,
          [contextKind]: {
            renderer: nextLayout.renderer,
            entries: sortExplorerMenuLayoutEntries(nextLayout.entries),
          },
        },
      });
    },
    [settings.explorer.contextMenuLayoutOverridesByContext, updateExplorer],
  );
  const updateContextMenuLayoutForContext = useCallback(
    (
      contextKind: ExplorerMenuContextKind,
      updater: (layout: ExplorerMenuContextLayout) => ExplorerMenuContextLayout,
    ) => {
      const baseLayout = settings.explorer.contextMenuLayoutOverridesByContext[
        contextKind
      ] ??
        activeMenuPack?.contexts[contextKind] ?? {
          renderer: "classic",
          entries: [],
        };
      writeContextMenuLayoutOverride(
        contextKind,
        updater({
          renderer: baseLayout.renderer ?? "classic",
          entries: [...baseLayout.entries],
        }),
      );
    },
    [
      activeMenuPack,
      settings.explorer.contextMenuLayoutOverridesByContext,
      writeContextMenuLayoutOverride,
    ],
  );
  const updateContextMenuEntriesForContext = useCallback(
    (
      contextKind: ExplorerMenuContextKind,
      updater: (
        entries: ExplorerMenuLayoutEntry[],
      ) => ExplorerMenuLayoutEntry[],
    ) => {
      updateContextMenuLayoutForContext(contextKind, (layout) => ({
        ...layout,
        entries: updater(layout.entries),
      }));
    },
    [updateContextMenuLayoutForContext],
  );
  const updateActiveContextMenuEntries = useCallback(
    (
      updater: (
        entries: ExplorerMenuLayoutEntry[],
      ) => ExplorerMenuLayoutEntry[],
    ) => {
      updateContextMenuEntriesForContext(activeContextMenuContext, updater);
    },
    [activeContextMenuContext, updateContextMenuEntriesForContext],
  );
  const toggleContextMenuLayoutEntryEnabled = useCallback(
    (entryId: string, enabled: boolean) => {
      updateActiveContextMenuEntries((entries) =>
        withExplorerMenuLayoutEntryEnabled(entries, entryId, enabled),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const moveContextMenuLayoutEntry = useCallback(
    (entryId: string, direction: "up" | "down") => {
      updateActiveContextMenuEntries((entries) =>
        moveExplorerMenuLayoutEntry(entries, entryId, direction),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const placeContextMenuLayoutEntryAt = useCallback(
    (
      entryId: string,
      targetParentEntryId: string | null,
      targetIndex: number,
    ) => {
      updateActiveContextMenuEntries((entries) =>
        placeExplorerMenuLayoutEntry(
          entries,
          entryId,
          targetParentEntryId,
          targetIndex,
        ),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuLayoutEntryParent = useCallback(
    (entryId: string, parentEntryId: string | null) => {
      updateActiveContextMenuEntries((entries) =>
        withExplorerMenuLayoutEntryParent(entries, entryId, parentEntryId),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuLayoutEntryQuickSlot = useCallback(
    (entryId: string, quickSlot: ExplorerMenuQuickSlot) => {
      updateActiveContextMenuEntries((entries) =>
        withExplorerMenuLayoutEntryPlacement(entries, entryId, { quickSlot }),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuLayoutEntryFallbackBucket = useCallback(
    (entryId: string, fallbackBucket: ExplorerMenuFallbackBucket) => {
      updateActiveContextMenuEntries((entries) =>
        withExplorerMenuLayoutEntryPlacement(entries, entryId, {
          fallbackBucket,
        }),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuSubmenuTitle = useCallback(
    (entryId: string, title: string) => {
      updateActiveContextMenuEntries((entries) => {
        const existingEntry = entries.find(
          (
            entry,
          ): entry is Extract<ExplorerMenuLayoutEntry, { kind: "submenu" }> =>
            entry.id === entryId && entry.kind === "submenu",
        );
        if (!existingEntry) {
          return entries;
        }
        return upsertExplorerMenuSubmenuEntry(entries, {
          ...existingEntry,
          title,
        });
      });
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuGroupSlotGroup = useCallback(
    (
      entryId: string,
      group: Extract<ExplorerMenuLayoutEntry, { kind: "group-slot" }>["group"],
    ) => {
      updateActiveContextMenuEntries((entries) =>
        sortExplorerMenuLayoutEntries(
          entries.map((entry) =>
            entry.id === entryId && entry.kind === "group-slot"
              ? { ...entry, group }
              : entry,
          ),
        ),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuGroupSlotSourceFilter = useCallback(
    (
      entryId: string,
      sourceFilter: Extract<
        ExplorerMenuLayoutEntry,
        { kind: "group-slot" }
      >["sourceFilter"],
    ) => {
      updateActiveContextMenuEntries((entries) =>
        sortExplorerMenuLayoutEntries(
          entries.map((entry) =>
            entry.id === entryId && entry.kind === "group-slot"
              ? { ...entry, sourceFilter }
              : entry,
          ),
        ),
      );
    },
    [updateActiveContextMenuEntries],
  );
  const removeContextMenuLayoutEntry = useCallback(
    (entryId: string) => {
      updateActiveContextMenuEntries((entries) =>
        removeExplorerMenuLayoutEntry(entries, entryId),
      );
      setSelectedContextMenuEntryId((current) =>
        current === entryId ? null : current,
      );
    },
    [updateActiveContextMenuEntries],
  );
  const setContextMenuRendererForActiveContext = useCallback(
    (renderer: ExplorerMenuContextLayout["renderer"]) => {
      updateContextMenuLayoutForContext(activeContextMenuContext, (layout) => ({
        ...layout,
        renderer,
      }));
    },
    [activeContextMenuContext, updateContextMenuLayoutForContext],
  );
  const resetContextMenuLayout = useCallback(() => {
    const nextOverrides = {
      ...settings.explorer.contextMenuLayoutOverridesByContext,
    };
    delete nextOverrides[activeContextMenuContext];
    updateExplorer({ contextMenuLayoutOverridesByContext: nextOverrides });
  }, [
    activeContextMenuContext,
    settings.explorer.contextMenuLayoutOverridesByContext,
    updateExplorer,
  ]);
  const resetAllContextMenuLayouts = useCallback(() => {
    updateExplorer({ contextMenuLayoutOverridesByContext: {} });
  }, [updateExplorer]);
  const resolveActiveContextMenuInsertionTarget = useCallback(
    (entries: ExplorerMenuLayoutEntry[]) => {
      const selectedEntry =
        selectedContextMenuEntryId == null
          ? null
          : (entries.find((entry) => entry.id === selectedContextMenuEntryId) ??
            null);

      if (!selectedEntry) {
        const rootEntries = entries.filter(
          (entry) => entry.parentEntryId == null,
        );
        return {
          parentEntryId: null as string | null,
          insertionIndex: rootEntries.length,
        };
      }

      if (selectedEntry.kind === "submenu") {
        const childEntries = entries.filter(
          (entry) => entry.parentEntryId === selectedEntry.id,
        );
        return {
          parentEntryId: selectedEntry.id,
          insertionIndex: childEntries.length,
        };
      }

      const siblingEntries = entries.filter(
        (entry) => entry.parentEntryId === selectedEntry.parentEntryId,
      );
      const selectedSiblingIndex = siblingEntries.findIndex(
        (entry) => entry.id === selectedEntry.id,
      );
      return {
        parentEntryId: selectedEntry.parentEntryId ?? null,
        insertionIndex:
          selectedSiblingIndex < 0
            ? siblingEntries.length
            : selectedSiblingIndex + 1,
      };
    },
    [selectedContextMenuEntryId],
  );
  const addContextMenuCommandEntry = useCallback(
    (requestedCommandId?: string) => {
      const commandId =
        requestedCommandId ??
        contextMenuCommandDraftByContext[activeContextMenuContext] ??
        availableContextMenuCommandsForActiveContext[0]?.id ??
        "";
      if (!commandId) {
        return;
      }

      let createdEntryId: string | null = null;
      updateActiveContextMenuEntries((entries) => {
        const existingEntry = entries.find(
          (entry) => entry.kind === "command" && entry.commandId === commandId,
        );
        if (existingEntry) {
          createdEntryId = existingEntry.id;
          return entries;
        }

        const insertionTarget =
          resolveActiveContextMenuInsertionTarget(entries);
        const nextOrder =
          Math.max(0, ...entries.map((entry) => entry.order)) + 10;
        const nextEntryId = `${activeContextMenuContext}.command.${commandId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}`;
        createdEntryId = nextEntryId;
        return placeExplorerMenuLayoutEntry(
          [
            ...entries,
            {
              id: nextEntryId,
              kind: "command",
              commandId,
              parentEntryId: insertionTarget.parentEntryId,
              order: nextOrder,
              enabled: true,
              quickSlot: "none",
              fallbackBucket: "default",
            },
          ],
          nextEntryId,
          insertionTarget.parentEntryId,
          insertionTarget.insertionIndex,
        );
      });

      if (createdEntryId) {
        setSelectedContextMenuEntryId(createdEntryId);
      }

      setContextMenuCommandDraftByContext((current) => ({
        ...current,
        [activeContextMenuContext]: "",
      }));
    },
    [
      activeContextMenuContext,
      availableContextMenuCommandsForActiveContext,
      contextMenuCommandDraftByContext,
      resolveActiveContextMenuInsertionTarget,
      updateActiveContextMenuEntries,
    ],
  );
  const insertContextMenuCommandEntryAt = useCallback(
    (
      commandId: string,
      target: { parentEntryId: string | null; insertionIndex: number },
    ) => {
      if (!commandId) {
        return;
      }

      let createdEntryId: string | null = null;
      updateActiveContextMenuEntries((entries) => {
        const existingEntry = entries.find(
          (entry) => entry.kind === "command" && entry.commandId === commandId,
        );
        if (existingEntry) {
          createdEntryId = existingEntry.id;
          return placeExplorerMenuLayoutEntry(
            entries,
            existingEntry.id,
            target.parentEntryId,
            target.insertionIndex,
          );
        }

        const nextOrder =
          Math.max(0, ...entries.map((entry) => entry.order)) + 10;
        const nextEntryId = `${activeContextMenuContext}.command.${commandId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${Date.now()}`;
        createdEntryId = nextEntryId;
        return placeExplorerMenuLayoutEntry(
          [
            ...entries,
            {
              id: nextEntryId,
              kind: "command",
              commandId,
              parentEntryId: target.parentEntryId,
              order: nextOrder,
              enabled: true,
              quickSlot: "none",
              fallbackBucket: "default",
            },
          ],
          nextEntryId,
          target.parentEntryId,
          target.insertionIndex,
        );
      });

      if (createdEntryId) {
        setSelectedContextMenuEntryId(createdEntryId);
      }
    },
    [activeContextMenuContext, updateActiveContextMenuEntries],
  );
  const addContextMenuSubmenu = useCallback(() => {
    let createdEntryId: string | null = null;
    updateActiveContextMenuEntries((entries) => {
      const insertionTarget = resolveActiveContextMenuInsertionTarget(entries);
      const nextOrder =
        Math.max(0, ...entries.map((entry) => entry.order)) + 10;
      const submenuEntry = createExplorerMenuSubmenuEntry({
        contextKind: activeContextMenuContext,
        title: "New Submenu",
        order: nextOrder,
      });
      createdEntryId = submenuEntry.id;
      return placeExplorerMenuLayoutEntry(
        upsertExplorerMenuSubmenuEntry(entries, {
          ...submenuEntry,
          parentEntryId: insertionTarget.parentEntryId,
        }),
        submenuEntry.id,
        insertionTarget.parentEntryId,
        insertionTarget.insertionIndex,
      );
    });

    if (createdEntryId) {
      setSelectedContextMenuEntryId(createdEntryId);
    }
  }, [
    activeContextMenuContext,
    resolveActiveContextMenuInsertionTarget,
    updateActiveContextMenuEntries,
  ]);
  const insertContextMenuSubmenuAt = useCallback(
    (target: { parentEntryId: string | null; insertionIndex: number }) => {
      let createdEntryId: string | null = null;
      updateActiveContextMenuEntries((entries) => {
        const nextOrder =
          Math.max(0, ...entries.map((entry) => entry.order)) + 10;
        const submenuEntry = createExplorerMenuSubmenuEntry({
          contextKind: activeContextMenuContext,
          title: "New Folder",
          order: nextOrder,
        });
        createdEntryId = submenuEntry.id;
        return placeExplorerMenuLayoutEntry(
          upsertExplorerMenuSubmenuEntry(entries, {
            ...submenuEntry,
            parentEntryId: target.parentEntryId,
          }),
          submenuEntry.id,
          target.parentEntryId,
          target.insertionIndex,
        );
      });

      if (createdEntryId) {
        setSelectedContextMenuEntryId(createdEntryId);
      }
    },
    [activeContextMenuContext, updateActiveContextMenuEntries],
  );
  const addContextMenuSeparator = useCallback(() => {
    let createdEntryId: string | null = null;
    updateActiveContextMenuEntries((entries) => {
      const insertionTarget = resolveActiveContextMenuInsertionTarget(entries);
      const nextOrder =
        Math.max(0, ...entries.map((entry) => entry.order)) + 10;
      const nextEntryId = `${activeContextMenuContext}.separator-${Date.now()}`;
      createdEntryId = nextEntryId;
      return placeExplorerMenuLayoutEntry(
        [
          ...entries,
          {
            id: nextEntryId,
            kind: "separator",
            parentEntryId: insertionTarget.parentEntryId,
            order: nextOrder,
            enabled: true,
            quickSlot: "none",
            fallbackBucket: "default",
          },
        ],
        nextEntryId,
        insertionTarget.parentEntryId,
        insertionTarget.insertionIndex,
      );
    });

    if (createdEntryId) {
      setSelectedContextMenuEntryId(createdEntryId);
    }
  }, [
    activeContextMenuContext,
    resolveActiveContextMenuInsertionTarget,
    updateActiveContextMenuEntries,
  ]);
  const insertContextMenuSeparatorAt = useCallback(
    (target: { parentEntryId: string | null; insertionIndex: number }) => {
      let createdEntryId: string | null = null;
      updateActiveContextMenuEntries((entries) => {
        const nextOrder =
          Math.max(0, ...entries.map((entry) => entry.order)) + 10;
        const nextEntryId = `${activeContextMenuContext}.separator-${Date.now()}`;
        createdEntryId = nextEntryId;
        return placeExplorerMenuLayoutEntry(
          [
            ...entries,
            {
              id: nextEntryId,
              kind: "separator",
              parentEntryId: target.parentEntryId,
              order: nextOrder,
              enabled: true,
              quickSlot: "none",
              fallbackBucket: "default",
            },
          ],
          nextEntryId,
          target.parentEntryId,
          target.insertionIndex,
        );
      });

      if (createdEntryId) {
        setSelectedContextMenuEntryId(createdEntryId);
      }
    },
    [activeContextMenuContext, updateActiveContextMenuEntries],
  );
  const addContextMenuGroupSlot = useCallback(() => {
    const group =
      contextMenuGroupDraftByContext[activeContextMenuContext] ?? "plugin";
    let createdEntryId: string | null = null;
    updateActiveContextMenuEntries((entries) => {
      const insertionTarget = resolveActiveContextMenuInsertionTarget(entries);
      const nextOrder =
        Math.max(0, ...entries.map((entry) => entry.order)) + 10;
      const nextEntryId = `${activeContextMenuContext}.group.${group}-${Date.now()}`;
      createdEntryId = nextEntryId;
      return placeExplorerMenuLayoutEntry(
        [
          ...entries,
          {
            id: nextEntryId,
            kind: "group-slot",
            group,
            sourceFilter: "any",
            parentEntryId: insertionTarget.parentEntryId,
            order: nextOrder,
            enabled: true,
            quickSlot: "none",
            fallbackBucket: "default",
          },
        ],
        nextEntryId,
        insertionTarget.parentEntryId,
        insertionTarget.insertionIndex,
      );
    });

    if (createdEntryId) {
      setSelectedContextMenuEntryId(createdEntryId);
    }
  }, [
    activeContextMenuContext,
    contextMenuGroupDraftByContext,
    resolveActiveContextMenuInsertionTarget,
    updateActiveContextMenuEntries,
  ]);
  const insertContextMenuGroupSlotAt = useCallback(
    (
      target: { parentEntryId: string | null; insertionIndex: number },
      requestedGroup?: Extract<
        ExplorerMenuLayoutEntry,
        { kind: "group-slot" }
      >["group"],
    ) => {
      const group =
        requestedGroup ??
        contextMenuGroupDraftByContext[activeContextMenuContext] ??
        "plugin";
      let createdEntryId: string | null = null;
      updateActiveContextMenuEntries((entries) => {
        const nextOrder =
          Math.max(0, ...entries.map((entry) => entry.order)) + 10;
        const nextEntryId = `${activeContextMenuContext}.group.${group}-${Date.now()}`;
        createdEntryId = nextEntryId;
        return placeExplorerMenuLayoutEntry(
          [
            ...entries,
            {
              id: nextEntryId,
              kind: "group-slot",
              group,
              sourceFilter: "any",
              parentEntryId: target.parentEntryId,
              order: nextOrder,
              enabled: true,
              quickSlot: "none",
              fallbackBucket: "default",
            },
          ],
          nextEntryId,
          target.parentEntryId,
          target.insertionIndex,
        );
      });

      if (createdEntryId) {
        setSelectedContextMenuEntryId(createdEntryId);
      }
    },
    [
      activeContextMenuContext,
      contextMenuGroupDraftByContext,
      updateActiveContextMenuEntries,
    ],
  );
  const selectContextMenuEntryFromRuntimeNode = useCallback(
    (node: ExplorerRuntimeMenuNode) => {
      if (activeContextMenuEntries.some((entry) => entry.id === node.id)) {
        setSelectedContextMenuEntryId(node.id);
        return;
      }

      if (node.kind === "command") {
        const matchingCommandEntry = activeContextMenuEntries.find(
          (entry) =>
            entry.kind === "command" && entry.commandId === node.commandId,
        );
        if (matchingCommandEntry) {
          setSelectedContextMenuEntryId(matchingCommandEntry.id);
        }
      }
    },
    [activeContextMenuEntries],
  );

  const updateThemePalette = useCallback(
    (patch: Partial<OverlayThemeDefinition["palette"]>) => {
      const baseEmbeddedAppearancePack = editableThemeBundle.embedded
        ?.appearancePacks?.[0] ?? {
        id: editableThemeBundle.appearancePackId ?? "appearance-base",
        name: `${activeThemeBundleLabel} Appearance`,
        extendsThemeId: appAppearance.baseTheme.extendsThemeId,
        palette: appAppearance.baseTheme.palette,
        effects: appAppearance.baseTheme.effects,
        xterm: appAppearance.baseTheme.xterm,
        fonts: appAppearance.baseTheme.fonts,
        visuals: appAppearance.baseTheme.visuals,
        cssVars: appAppearance.baseTheme.cssVars,
      };
      persistThemeBundle({
        ...editableThemeBundle,
        embedded: {
          ...editableThemeBundle.embedded,
          appearancePacks: [
            {
              ...baseEmbeddedAppearancePack,
              palette: {
                ...(baseEmbeddedAppearancePack.palette ?? {}),
                ...patch,
              },
            },
          ],
        },
      });
    },
    [
      activeThemeBundleLabel,
      appAppearance.baseTheme,
      editableThemeBundle,
      persistThemeBundle,
    ],
  );

  const applyThemeDraft = useCallback(() => {
    try {
      const importedThemeBundle = parseImportedThemeBundle(themeDraft);
      persistThemeBundle(importedThemeBundle);
      setThemeImportError(null);
    } catch (error) {
      setThemeImportError(`Theme import failed: ${String(error)}`);
    }
  }, [persistThemeBundle, themeDraft]);

  const seedDefaultBookmarks = useCallback(async () => {
    try {
      const home = await commands.fsGetHomeDir().then(unwrapTauriResult);
      const seeds = createDefaultDirectoryBookmarks(home, platform);
      for (const seed of seeds) {
        if (
          !directoryBookmarks.some((bookmark) => bookmark.value === seed.value)
        ) {
          await addDirectoryBookmark(seed);
        }
      }
    } catch (error) {
      console.warn("OverlayTerm: failed to seed default bookmarks", error);
    }
  }, [addDirectoryBookmark, directoryBookmarks, platform]);

  const ensureWorkspaceDirectory = useCallback(async (path: string) => {
    const normalizedPath = path.trim();
    if (!normalizedPath) {
      throw new Error("No workspace directory is configured yet.");
    }

    try {
      await listExplorerDir(normalizedPath, false);
    } catch {
      await createExplorerDir(normalizedPath);
    }
  }, []);

  const openWorkspaceDirectory = useCallback(
    async (label: string, path: string) => {
      setOverviewNotice(null);
      setOverviewError(null);

      try {
        await ensureWorkspaceDirectory(path);
        await openExplorerPath(path);
        setOverviewNotice(`Opened ${label}: ${path}`);
      } catch (error) {
        setOverviewError(`Failed to open ${label}: ${String(error)}`);
      }
    },
    [ensureWorkspaceDirectory],
  );

  const refreshCloudAccounts = useCallback(async () => {
    setCloudLoading(true);
    try {
      const snapshot = await listCloudAccounts();
      setCloudSnapshot(
        snapshot &&
          Array.isArray(snapshot.accounts) &&
          Array.isArray(snapshot.providers)
          ? snapshot
          : EMPTY_CLOUD_ACCOUNTS_SNAPSHOT,
      );
      setCloudError(null);
    } catch (error) {
      setCloudError(`Failed to load cloud accounts: ${String(error)}`);
    } finally {
      setCloudLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCloudAccounts();
  }, [refreshCloudAccounts]);

  const safeCloudSnapshot =
    cloudSnapshot &&
    Array.isArray(cloudSnapshot.accounts) &&
    Array.isArray(cloudSnapshot.providers)
      ? cloudSnapshot
      : EMPTY_CLOUD_ACCOUNTS_SNAPSHOT;

  useEffect(() => {
    const nextDrafts = createEmptyCloudProviderCredentialDrafts();
    for (const provider of safeCloudSnapshot.providers) {
      nextDrafts[provider.provider] = {
        clientId: provider.client_id ?? "",
        clientSecret: "",
      };
    }
    setCloudCredentialDrafts(nextDrafts);
  }, [safeCloudSnapshot.providers]);

  const updateCloudCredentialDraft = useCallback(
    (
      provider: ExplorerCloudProviderId,
      key: keyof CloudProviderCredentialDraft,
      value: string,
    ) => {
      setCloudCredentialDrafts((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          [key]: value,
        },
      }));
    },
    [],
  );

  const saveCloudProviderCredentials = useCallback(
    async (provider: ExplorerCloudProviderId) => {
      const draft = cloudCredentialDrafts[provider];
      setCloudError(null);
      setCloudNotice(null);
      setCloudCredentialBusyProvider(provider);
      setCloudCredentialBusyAction("save");
      try {
        await setCloudProviderConfiguration(
          provider,
          draft.clientId,
          draft.clientSecret.trim().length > 0 ? draft.clientSecret : null,
        );
        await refreshCloudAccounts();
        setCloudNotice(
          `Saved ${getCloudProviderLabel(provider)} provider credentials.`,
        );
      } catch (error) {
        setCloudError(
          `Failed to save ${getCloudProviderLabel(provider)} credentials: ${String(error)}`,
        );
      } finally {
        setCloudCredentialBusyProvider(null);
        setCloudCredentialBusyAction(null);
      }
    },
    [cloudCredentialDrafts, refreshCloudAccounts],
  );

  const clearSavedCloudProviderCredentials = useCallback(
    async (provider: ExplorerCloudProviderId) => {
      setCloudError(null);
      setCloudNotice(null);
      setCloudCredentialBusyProvider(provider);
      setCloudCredentialBusyAction("clear");
      try {
        await clearCloudProviderConfiguration(provider);
        await refreshCloudAccounts();
        setCloudNotice(
          `Cleared saved ${getCloudProviderLabel(provider)} provider credentials.`,
        );
      } catch (error) {
        setCloudError(
          `Failed to clear ${getCloudProviderLabel(provider)} credentials: ${String(error)}`,
        );
      } finally {
        setCloudCredentialBusyProvider(null);
        setCloudCredentialBusyAction(null);
      }
    },
    [refreshCloudAccounts],
  );

  const connectCloudProvider = useCallback(
    async (provider: ExplorerCloudProviderId) => {
      setCloudError(null);
      setCloudNotice(null);
      setCloudAuthProvider(provider);

      try {
        const session = await beginCloudAuth(provider);
        await openUrl(session.authorization_url);
        setCloudNotice(
          `Opened ${getCloudProviderLabel(provider)} in the system browser. Finish sign-in there and this page will update automatically.`,
        );

        const startedAt = Date.now();
        while (Date.now() - startedAt < 5 * 60_000) {
          const status = await pollCloudAuth(session.request_id);
          if (status.status === "pending") {
            await new Promise((resolve) => window.setTimeout(resolve, 1200));
            continue;
          }

          if (status.status === "completed") {
            await refreshCloudAccounts();
            const accountLabel =
              status.account?.email ||
              status.account?.display_name ||
              getCloudProviderLabel(provider);
            setCloudNotice(`Connected ${accountLabel}.`);
            return;
          }

          throw new Error(
            status.error ||
              `Authentication failed with status: ${status.status}`,
          );
        }

        throw new Error(
          "Timed out waiting for the browser sign-in flow to finish.",
        );
      } catch (error) {
        setCloudError(
          `Failed to connect ${getCloudProviderLabel(provider)}: ${String(error)}`,
        );
      } finally {
        setCloudAuthProvider(null);
      }
    },
    [refreshCloudAccounts],
  );

  const disconnectProviderAccount = useCallback(
    async (account: ExplorerCloudAccountSummary) => {
      setCloudError(null);
      setCloudNotice(null);
      try {
        await disconnectCloudAccount(account.id);
        await refreshCloudAccounts();
        setCloudNotice(
          `Disconnected ${account.email || account.display_name}.`,
        );
      } catch (error) {
        setCloudError(
          `Failed to disconnect ${account.email || account.display_name}: ${String(error)}`,
        );
      }
    },
    [refreshCloudAccounts],
  );

  const mobileRemoteAccessDefinition = useMemo(
    () => getMobileRemoteAccessModeDefinition(settings.mobile.remoteAccessMode),
    [settings.mobile.remoteAccessMode],
  );
  const mobileSharePending =
    mobileSharePhase === "starting" || mobileSharePhase === "stopping";
  const mobileShareRouteMismatch =
    mobileShareSession != null &&
    mobileShareSession.remoteAccessMode !== settings.mobile.remoteAccessMode;

  const refreshTailscaleStatus = useCallback(async () => {
    setTailscaleStatusPending(true);
    try {
      await refreshMobileShareTailscaleStatus();
      setTailscaleError(null);
    } catch (error) {
      setTailscaleError(`Failed to read Tailscale status: ${String(error)}`);
    } finally {
      setTailscaleStatusPending(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== "mobile") {
      return;
    }
    void refreshTailscaleStatus();
  }, [activeSection, refreshTailscaleStatus]);

  const connectMobileTailscale = useCallback(async () => {
    setTailscaleActionPending("connect");
    setTailscaleError(null);
    setTailscaleNotice(null);
    try {
      const status = await connectTailscale({
        hostname: settings.mobile.tailscaleHostname || null,
        loginServer: settings.mobile.tailscaleLoginServer || null,
        authKey: tailscaleAuthKeyDraft.trim() || null,
      });
      setMobileShareTailscaleStatus(status);
      setTailscaleAuthKeyDraft("");

      if (status.authUrl) {
        await openUrl(status.authUrl);
        setTailscaleNotice(
          "Opened the Tailscale browser login flow. Finish sign-in there, then refresh this page if the status does not update automatically.",
        );
      } else if (status.connected) {
        setTailscaleNotice(
          `Tailscale is connected${status.tailnetName ? ` to ${status.tailnetName}` : ""}.`,
        );
      } else {
        setTailscaleNotice(
          status.diagnosticMessage ?? "Tailscale updated its local state.",
        );
      }
    } catch (error) {
      setTailscaleError(`Failed to connect Tailscale: ${String(error)}`);
    } finally {
      setTailscaleActionPending(null);
    }
  }, [
    settings.mobile.tailscaleHostname,
    settings.mobile.tailscaleLoginServer,
    tailscaleAuthKeyDraft,
  ]);

  const disconnectMobileTailscale = useCallback(async () => {
    setTailscaleActionPending("disconnect");
    setTailscaleError(null);
    setTailscaleNotice(null);
    try {
      const status = await disconnectTailscale();
      setMobileShareTailscaleStatus(status);
      setTailscaleNotice(
        "Disconnected the local node from the active Tailscale session.",
      );
    } catch (error) {
      setTailscaleError(`Failed to disconnect Tailscale: ${String(error)}`);
    } finally {
      setTailscaleActionPending(null);
    }
  }, []);

  const startMobileShareFromSettings = useCallback(async () => {
    try {
      await startMobileShareSession({
        requestedPath: explorerCurrentPath,
        remoteAccessMode: settings.mobile.remoteAccessMode,
        copyPreferredUrl: true,
      });
    } catch {
      if (settings.mobile.remoteAccessMode === "tailscale") {
        setActiveSection("mobile");
      }
    }
  }, [explorerCurrentPath, setActiveSection, settings.mobile.remoteAccessMode]);

  const stopMobileShareFromSettings = useCallback(async () => {
    try {
      await stopMobileShareSession();
    } catch {}
  }, []);

  const openMobileQrDialogFromSettings = useCallback(async () => {
    setMobileQrDialogOpen(true);
    if (
      !mobileShareSession ||
      mobileShareSession.remoteAccessMode !== settings.mobile.remoteAccessMode
    ) {
      await startMobileShareFromSettings();
    }
  }, [
    mobileShareSession,
    settings.mobile.remoteAccessMode,
    startMobileShareFromSettings,
  ]);

  const handleWallpaperFileSelection = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (selectedFiles.length === 0) {
        return;
      }

      setWallpaperNotice(null);
      setWallpaperImportError(null);
      try {
        await onImportWallpaperFiles(selectedFiles);
        setWallpaperNotice(
          `Imported ${selectedFiles.length} wallpaper file${selectedFiles.length === 1 ? "" : "s"}.`,
        );
      } catch (error) {
        setWallpaperImportError(
          `Failed to import wallpaper files: ${String(error)}`,
        );
      }
    },
    [onImportWallpaperFiles],
  );

  const triggerWallpaperImport = useCallback(() => {
    wallpaperFileInputRef.current?.click();
  }, []);

  const effectiveTheme = appearance.theme;
  const editableTheme = appAppearance.baseTheme;
  const inputBackground = effectiveTheme.palette.inputBackground;
  const border = effectiveTheme.palette.border;
  const text = effectiveTheme.palette.textPrimary;
  const muted = effectiveTheme.palette.textMuted;
  const accent = effectiveTheme.palette.accent;
  const workbench = appearance.workbenchTheme;
  const settingsFormColorScheme = useMemo(
    () => resolveSettingsFormColorScheme(inputBackground, text),
    [inputBackground, text],
  );
  const settingsFieldStyle = useMemo<CSSProperties>(
    () => ({
      borderColor: border,
      backgroundColor: "var(--overlay-bg-input)",
      color: text,
      caretColor: text,
      colorScheme: settingsFormColorScheme,
    }),
    [border, settingsFormColorScheme, text],
  );
  const settingsMonoFieldStyle = useMemo<CSSProperties>(
    () => ({
      ...settingsFieldStyle,
      fontFamily: appearance.fonts.mono,
    }),
    [appearance.fonts.mono, settingsFieldStyle],
  );
  const settingsSelectStyle = useMemo<CSSProperties>(
    () => ({
      ...settingsFieldStyle,
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
      backgroundImage: [
        `linear-gradient(45deg, transparent 50%, ${muted} 50%)`,
        `linear-gradient(135deg, ${muted} 50%, transparent 50%)`,
      ].join(", "),
      backgroundPosition:
        "calc(100% - 16px) calc(50% - 2px), calc(100% - 11px) calc(50% - 2px)",
      backgroundSize: "5px 5px",
      backgroundRepeat: "no-repeat",
      paddingRight: "2.4rem",
    }),
    [muted, settingsFieldStyle],
  );
  const settingsMonoSelectStyle = useMemo<CSSProperties>(
    () => ({
      ...settingsSelectStyle,
      fontFamily: appearance.fonts.mono,
    }),
    [appearance.fonts.mono, settingsSelectStyle],
  );
  const themeIconTheme =
    activeIconThemePackage?.iconTheme ??
    editableTheme.assets?.iconTheme ??
    getBuiltInIconTheme();
  const iconThemeSelectionSummary = activeIconThemePackage
    ? `${activeIconThemePackage.name} · ${activeIconThemePackage.capabilitySummary.iconDefinitions} glyphs · ${activeIconThemePackage.capabilitySummary.uiIcons} UI overrides`
    : `Follow Theme Default · ${themeIconTheme.name}`;
  const homeQuickAccess = useMemo(
    () => createExplorerHomeQuickAccessItems(homeUserPath),
    [homeUserPath],
  );
  const homeBookmarks = useMemo(
    () => mapExplorerHomeBookmarks(explorerRail),
    [explorerRail],
  );
  const homeMostUsedFolders = useMemo(
    () => mapExplorerHomeUsageEntries(homeUsageSnapshot.mostUsed),
    [homeUsageSnapshot.mostUsed],
  );
  const homeRecentFolders = useMemo(
    () => mapExplorerHomeUsageEntries(homeUsageSnapshot.recent),
    [homeUsageSnapshot.recent],
  );
  const homeLaunchpad = useMemo(() => createExplorerHomeLaunchpadItems(), []);
  const homeSelection = useMemo(
    () =>
      resolveExplorerHomePackSelection({
        packs: homePacks,
        requestedPackId: settings.home.activePackId,
        themeDefaultPackId: appearance.baseTheme.defaultHomePackId,
      }),
    [
      appearance.baseTheme.defaultHomePackId,
      homePacks,
      settings.home.activePackId,
    ],
  );
  const activeHomePack = homeSelection.activePack;
  const activeHomePackState = useMemo<Record<string, unknown>>(
    () =>
      activeHomePack
        ? (settings.home.packStateById[activeHomePack.id] ?? {})
        : {},
    [activeHomePack, settings.home.packStateById],
  );
  const activeHomePresetId = activeHomePack
    ? (settings.home.activePresetIdByPackId[activeHomePack.id] ??
      activeHomePack.runtime.defaultPresetId ??
      null)
    : null;
  const homePackSummary = activeHomePack
    ? `${homeSelection.isFallback ? "Fallback" : "Active"} · ${activeHomePack.name} · ${settings.home.usageTrackingEnabled ? "Telemetry on" : "Telemetry off"}`
    : "No Home packs available";
  const homePackSettingsHost = useMemo(
    () =>
      activeHomePack
        ? createExplorerHomeHost(
            {
              appearance,
              activePresetId: activeHomePresetId,
              usageTrackingEnabled: settings.home.usageTrackingEnabled,
              quickAccess: homeQuickAccess,
              bookmarks: homeBookmarks,
              mostUsedFolders: homeMostUsedFolders,
              recentFolders: homeRecentFolders,
              savedSearches: homeSavedSearches,
              drives: homeDrives,
              tasks: homeTasks,
              launchpad: homeLaunchpad,
              packState: activeHomePackState,
              packWarnings: homeSelection.warnings,
              diagnostics: {
                isFallback: homeSelection.isFallback,
                authoredPackCount: homeSelection.authoredPackCount,
                selectedPackError: homeSelection.selectedPackError,
              },
            },
            {
              navigate: () => undefined,
              openSavedSearch: () => undefined,
              openPanel: () => undefined,
              openSettingsSection: setActiveSection,
              refresh: () => {
                void onRefreshHomePacks();
              },
              updatePackState: (updates) => {
                if (activeHomePack) {
                  setHomePackState(activeHomePack.id, {
                    ...activeHomePackState,
                    ...updates,
                  });
                }
              },
              setPreset: (presetId) => {
                if (activeHomePack) {
                  setHomePresetSelection(activeHomePack.id, presetId);
                }
              },
            },
          )
        : null,
    [
      activeHomePack,
      activeHomePackState,
      activeHomePresetId,
      appearance,
      homeBookmarks,
      homeDrives,
      homeLaunchpad,
      homeMostUsedFolders,
      homeQuickAccess,
      homeRecentFolders,
      homeSavedSearches,
      homeSelection.authoredPackCount,
      homeSelection.isFallback,
      homeSelection.selectedPackError,
      homeSelection.warnings,
      homeTasks,
      onRefreshHomePacks,
      setActiveSection,
      setHomePackState,
      setHomePresetSelection,
      settings.home.usageTrackingEnabled,
    ],
  );
  const handleResetHomeUsage = useCallback(async () => {
    const snapshot = await clearExplorerHomeUsage();
    setHomeUsageSnapshot(snapshot);
  }, []);
  const [performanceTelemetryRevision, setPerformanceTelemetryRevision] =
    useState(0);
  const PERFORMANCE_TELEMETRY_REFRESH_MS = 5000;
  const layoutSourceSummary = useMemo(() => {
    if (
      layoutManifestState.sourceType === "file" &&
      layoutManifestState.sourcePath
    ) {
      return `Loaded from ${layoutManifestState.sourcePath}`;
    }
    if (settings.layout.configPath.trim()) {
      return "Custom path failed, using built-in layouts";
    }
    return "Using built-in layouts with home-directory auto-probe";
  }, [
    layoutManifestState.sourcePath,
    layoutManifestState.sourceType,
    settings.layout.configPath,
  ]);
  useEffect(() => {
    if (activeSection !== "overview") {
      return;
    }

    const interval = window.setInterval(() => {
      setPerformanceTelemetryRevision((current) => current + 1);
    }, PERFORMANCE_TELEMETRY_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [activeSection]);
  const performanceSnapshot = useMemo(
    () => loadExplorerPerformanceSnapshot(),
    [performanceTelemetryRevision],
  );
  const performanceSummary = useMemo(
    () => summarizeExplorerPerformance(performanceSnapshot),
    [performanceSnapshot],
  );
  const overlayFrameTelemetry = performanceSummary.overlay_frame_time;
  const overlayFrameValue = useMemo(() => {
    if (overlayFrameTelemetry.count === 0) {
      return "Waiting for live sample";
    }

    const avgFps = overlayFrameTelemetry.latestMetadata.avgFps;
    const avgFrameMs = overlayFrameTelemetry.latestMetadata.avgFrameMs;
    const withinTarget = overlayFrameTelemetry.latestMetadata.withinTarget;
    const fpsLabel =
      typeof avgFps === "number" ? `${Math.round(avgFps)} fps` : "fps n/a";
    const avgLabel =
      typeof avgFrameMs === "number"
        ? `${avgFrameMs.toFixed(1)} ms avg`
        : "avg n/a";
    const p95Label =
      overlayFrameTelemetry.latestMs != null
        ? `${overlayFrameTelemetry.latestMs.toFixed(1)} ms p95`
        : "p95 n/a";
    const targetLabel =
      withinTarget === true
        ? "within 120 fps target"
        : withinTarget === false
          ? "over 120 fps budget"
          : "target status n/a";
    return `${fpsLabel} • ${avgLabel} • ${p95Label} • ${targetLabel}`;
  }, [overlayFrameTelemetry]);
  const filteredFolderIconOptions = useMemo(() => {
    const query = folderIconSearch.trim().toLowerCase();
    if (!query) {
      return FOLDER_ICON_OPTIONS;
    }

    return FOLDER_ICON_OPTIONS.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query),
    );
  }, [folderIconSearch]);
  const overviewStats = useMemo(
    () => [
      {
        id: "theme",
        label: "Theme",
        value: effectiveTheme.name,
      },
      {
        id: "layout",
        label: "Layout",
        value: activeLayoutProfile.label,
      },
      {
        id: "startup",
        label: "Startup",
        value: settings.system.launchAtStartup
          ? settings.system.startMobileShareOnBoot
            ? "Ready at sign-in + mobile live"
            : "Ready at sign-in"
          : "Manual launch",
      },
      {
        id: "source",
        label: "Source",
        value: "Explorer import + file actions live",
      },
      {
        id: "frames",
        label: "Frame Telemetry",
        value: overlayFrameValue,
      },
    ],
    [
      activeLayoutProfile.label,
      effectiveTheme.name,
      overlayFrameValue,
      settings.system.launchAtStartup,
      settings.system.startMobileShareOnBoot,
    ],
  );
  const overviewWorkflows = useMemo(
    () => [
      {
        id: "explorer-to-source",
        icon: <GitBranch size={13} />,
        title: "Explorer -> Source",
        description:
          "Navigate to a repo in Explorer, confirm it for Source, then stage, diff, commit, or quick ship without leaving the overlay.",
        actionLabel: "Explorer Settings",
        action: () => setActiveSection("explorer"),
      },
      {
        id: "terminal-and-layout",
        icon: <TerminalSquare size={13} />,
        title: "Terminal + Layouts",
        description:
          "Tune the shell, choose how external handoff behaves, and swap layout profiles so the overlay matches the machine you are driving.",
        actionLabel: "Terminal Settings",
        action: () => setActiveSection("terminal"),
      },
      {
        id: "plugins-and-assets",
        icon: <Puzzle size={13} />,
        title: "Plugins + Assets",
        description:
          "Drop plugins, themes, wallpapers, shaders, and animations into their workspace folders so GreebleFS can discover them as live runtime modules.",
        actionLabel: "Appearance Settings",
        action: () => setActiveSection("appearance"),
      },
      {
        id: "capture-proof",
        icon: <Camera size={13} />,
        title: "Screenshots + Proof",
        description:
          "Capture the current desktop, annotate details, and save or copy release proof from the built-in screenshot workflow.",
        actionLabel: "Screenshot Settings",
        action: () => setActiveSection("screenshots"),
      },
    ],
    [setActiveSection],
  );
  const workspaceRoots = useMemo(
    () =>
      managedContentDirectoryCatalog.map((entry) => ({
        id: entry.id,
        label: entry.label,
        path: getManagedContentDirectory(entry.id as ManagedContentDirectoryId),
        description: entry.description,
      })),
    [],
  );
  const settingsJumpCards = useMemo(
    () =>
      settingsSectionCatalog
        .filter((section) => section.featuredInOverview)
        .map((section) => ({
          id: section.key,
          title: section.label,
          summary: section.overviewSummary,
          action: () => setActiveSection(section.key as SettingsSectionKey),
        })),
    [setActiveSection],
  );
  const connectedCloudAccountCount = safeCloudSnapshot.accounts.filter(
    (account) => account.status === "connected",
  ).length;
  const configuredCloudProviderCount = safeCloudSnapshot.providers.filter(
    (provider) => provider.configured,
  ).length;

  const patchFolderRules = useCallback(
    (rules: FolderIconRule[]) => {
      updateExplorer({ folderIconRules: rules });
    },
    [updateExplorer],
  );

  const updateFolderRule = useCallback(
    (ruleId: string, patch: Partial<FolderIconRule>) => {
      patchFolderRules(
        settings.explorer.folderIconRules.map((rule) =>
          rule.id === ruleId ? { ...rule, ...patch } : rule,
        ),
      );
    },
    [patchFolderRules, settings.explorer.folderIconRules],
  );

  const removeFolderRule = useCallback(
    (ruleId: string) => {
      patchFolderRules(
        settings.explorer.folderIconRules.filter((rule) => rule.id !== ruleId),
      );
    },
    [patchFolderRules, settings.explorer.folderIconRules],
  );

  const addFolderRule = useCallback(() => {
    patchFolderRules([
      ...settings.explorer.folderIconRules,
      {
        id: `custom-${Date.now()}`,
        label: "Custom Rule",
        matchers: [],
        icon: settings.explorer.defaultFolderIcon,
      },
    ]);
  }, [
    patchFolderRules,
    settings.explorer.defaultFolderIcon,
    settings.explorer.folderIconRules,
  ]);

  const setLaunchAtStartup = useCallback(
    async (enabled: boolean) => {
      setStartupSyncPending(true);
      setStartupSyncError(null);
      try {
        const nextValue = await commands
          .startupSetLaunchAtStartup(enabled)
          .then(unwrapTauriResult);
        updateSystem({ launchAtStartup: nextValue });
      } catch (error) {
        setStartupSyncError(String(error));
      } finally {
        setStartupSyncPending(false);
      }
    },
    [updateSystem],
  );

  useEffect(() => {
    if (platform !== "linux") {
      setLinuxDisplayBackendStatus(null);
      setLinuxDisplayBackendSyncPending(false);
      setLinuxDisplayBackendSyncError(null);
      return;
    }

    let cancelled = false;
    setLinuxDisplayBackendSyncPending(true);
    setLinuxDisplayBackendSyncError(null);

    commands
      .startupGetLinuxDisplayBackendStatus()
      .then(unwrapTauriResult)
      .then((status) => {
        if (cancelled) {
          return;
        }

        setLinuxDisplayBackendStatus(status);
        updateSystem({
          linuxDisplayBackendPreference: status.preferredBackend,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setLinuxDisplayBackendStatus(null);
          setLinuxDisplayBackendSyncError(String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLinuxDisplayBackendSyncPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [platform, updateSystem]);

  useEffect(() => {
    if (activeSection !== "system") {
      return;
    }

    let cancelled = false;
    setTelemetryStatusPending(true);
    setTelemetryStatusError(null);

    getTelemetryStatus()
      .then((status) => {
        if (!cancelled) {
          setTelemetryStatus(status);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTelemetryStatus(null);
          setTelemetryStatusError(String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTelemetryStatusPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    settings.system.consumerDiagnosticsEnabled,
    settings.system.developerTelemetryCaptureMode,
    settings.system.developerTelemetryEnabled,
    settings.system.developerTelemetryMaxFileSizeMb,
    settings.system.developerTelemetryPayloadMode,
    settings.system.developerTelemetryWriteToFile,
  ]);

  const refreshTelemetryStatus = useCallback(async () => {
    setTelemetryStatusPending(true);
    setTelemetryStatusError(null);
    try {
      setTelemetryStatus(await getTelemetryStatus());
    } catch (error) {
      setTelemetryStatus(null);
      setTelemetryStatusError(String(error));
    } finally {
      setTelemetryStatusPending(false);
    }
  }, []);

  const handleTelemetryExport = useCallback(async () => {
    setTelemetryActionPending("export");
    setTelemetryNotice(null);
    setTelemetryStatusError(null);
    try {
      const result = await exportTelemetrySupportBundle();
      setTelemetryNotice(`Support bundle written to ${result.export_path}`);
      await refreshTelemetryStatus();
    } catch (error) {
      setTelemetryStatusError(String(error));
    } finally {
      setTelemetryActionPending(null);
    }
  }, [refreshTelemetryStatus]);

  const handleTelemetryClear = useCallback(async () => {
    setTelemetryActionPending("clear");
    setTelemetryNotice(null);
    setTelemetryStatusError(null);
    try {
      await clearTelemetrySessions();
      setTelemetryNotice("Telemetry sessions cleared.");
      await refreshTelemetryStatus();
    } catch (error) {
      setTelemetryStatusError(String(error));
    } finally {
      setTelemetryActionPending(null);
    }
  }, [refreshTelemetryStatus]);

  const setHideAppInTray = useCallback(
    (enabled: boolean) => {
      updateSystem({
        hideAppInTray: enabled,
        ...(enabled ? {} : { showInTaskbar: true }),
      });
    },
    [updateSystem],
  );

  const setShowInTaskbar = useCallback(
    (enabled: boolean) => {
      updateSystem({
        showInTaskbar: enabled,
        ...(enabled ? {} : { hideAppInTray: true }),
      });
    },
    [updateSystem],
  );

  const setLinuxDisplayBackendPreference = useCallback(
    async (preferredBackend: LinuxDisplayBackendPreference) => {
      setLinuxDisplayBackendSyncPending(true);
      setLinuxDisplayBackendSyncError(null);
      try {
        const nextStatus = await commands
          .startupSetLinuxDisplayBackendPreference(preferredBackend)
          .then(unwrapTauriResult);
        setLinuxDisplayBackendStatus(nextStatus);
        updateSystem({
          linuxDisplayBackendPreference: nextStatus.preferredBackend,
        });
      } catch (error) {
        setLinuxDisplayBackendSyncError(String(error));
      } finally {
        setLinuxDisplayBackendSyncPending(false);
      }
    },
    [updateSystem],
  );

  const setShaderControlValue = useCallback(
    (
      shader: LoadedOverlayShader,
      control: OverlayShaderControlDefinition,
      rawValue: number,
    ) => {
      const existingShaderValues =
        settings.appearance.shaderControlValues[shader.id] ?? {};
      const fallbackValue =
        typeof effectiveShaderComputedUniforms[control.id] === "number"
          ? (effectiveShaderComputedUniforms[control.id] as number)
          : control.defaultValue;
      const normalizedValue = normalizeShaderControlValue(
        control,
        rawValue,
        fallbackValue,
      );
      const defaultValue = resolveShaderControlValues(
        shader,
        undefined,
        effectiveShaderComputedUniforms,
      )[control.id];
      const nextShaderValues = { ...existingShaderValues };

      if (
        typeof defaultValue === "number" &&
        Math.abs(normalizedValue - defaultValue) < Number.EPSILON * 10
      ) {
        delete nextShaderValues[control.id];
      } else {
        nextShaderValues[control.id] = normalizedValue;
      }

      const nextShaderControlValues = {
        ...settings.appearance.shaderControlValues,
      };
      if (Object.keys(nextShaderValues).length === 0) {
        delete nextShaderControlValues[shader.id];
      } else {
        nextShaderControlValues[shader.id] = nextShaderValues;
      }

      updateAppearance({ shaderControlValues: nextShaderControlValues });
    },
    [
      effectiveShaderComputedUniforms,
      settings.appearance.shaderControlValues,
      updateAppearance,
    ],
  );

  const settingsSectionContext = useMemo<SettingsSectionContentContext>(
    () => ({
      effectiveThemeName: effectiveTheme.name,
      activeLayoutLabel: activeLayoutProfile.label,
      workspaceRootCount: workspaceRoots.length,
      installedModelCount: installedLocalModelCount,
      localModelCacheFootprint,
      semanticIndexModelSummary,
      launchAtStartup: settings.system.launchAtStartup,
      startMobileShareOnBoot: settings.system.startMobileShareOnBoot,
      systemPresentationState,
      platform: platform as SettingsSectionContentContext["platform"],
      terminalWindowMode: settings.terminal.windowMode,
      terminalPreferredOpenMode: settings.terminal.preferredOpenMode,
      terminalCursorStyle: settings.terminal.cursorStyle,
      explorerViewModeLabel: getExplorerViewModeDefinition(
        settings.explorer.viewMode,
      ).label,
      explorerFolderClickMode: settings.explorer.folderClickMode,
      explorerThumbnailsEnabled: settings.explorer.thumbnails.enabled,
      activeMenuPackSummary: activeMenuPack?.name ?? "No Menu Pack",
      availableMenuPacksCount: menuPacks.length,
      customizedContextMenuContextCount: Object.keys(
        settings.explorer.contextMenuLayoutOverridesByContext,
      ).length,
      homePackSummary,
      layoutProfileCount: layoutManifestState.manifest.profiles.length,
      zenFocusMode: settings.layout.zenFocusMode,
      hotkeyLabels: [
        settings.keybindings.terminalToggle,
        settings.keybindings.windowModeToggle,
        settings.keybindings.zenFocusModeToggle,
        settings.keybindings.mobileShareToggle,
      ].map(formatHotkeyLabel),
      connectedCloudAccountCount,
      configuredCloudProviderCount,
      mobileRemoteAccessSummary: [
        mobileRemoteAccessDefinition.label,
        settings.mobile.remoteAccessMode === "tailscale"
          ? "Tailnet delivery"
          : "Same-network delivery",
        settings.mobile.tailscaleHostname ? "custom hostname" : "auto hostname",
      ].join(" · "),
      screenshotDefaultCaptureMode: settings.screenshots.defaultCaptureMode,
      screenshotDefaultOutputAction: settings.screenshots.defaultOutputAction,
      screenshotShowGrid: settings.screenshots.showGrid,
      audioFolderCount: settings.audio.vst3AdditionalFolders.length,
      soundPackSelectionSummary,
      availableSoundPacksCount: availableSoundPackEntries.length,
      soundEffectsEnabled: settings.audio.soundEffectsEnabled,
      nativeNotificationsEnabled: settings.audio.nativeNotificationsEnabled,
      appearancePackSelectionSummary,
      availableAppearancePacksCount: availableAppearancePackEntries.length,
      availableWallpapersCount: availableWallpapers.length,
      themeWallpaperAvailable,
      wallpaperFailureCount: wallpaperFailures.length,
      themeRecipeSelectionSummary,
      availableThemeRecipePacksCount: availableRecipePackEntries.length,
      themeEngineSelectionSummary,
      availableThemeEnginePacksCount: availableThemeEngineEntries.length,
      shellRendererSelectionSummary,
      availableShellRenderersCount: availableShellRendererEntries.length,
      availableShadersCount: availableShaders.length,
      shaderPerformanceLabel: shaderPerformanceProfile.label,
      shaderFailureCount: shaderFailures.length,
      availableAnimationsCount: availableAnimations.length,
      animationFailureCount: animationFailures.length,
      interactionMotionEnabled: settings.appearance.interactionMotionEnabled,
      interactionMotionProfileLabel: effectiveInteractionMotionProfileLabel,
      interactionMotionSurfaceCount: interactionMotionSurfaceCatalog.length,
      layoutDynamicsEnabled: settings.appearance.layoutDynamicsEnabled,
      layoutDynamicsProfileLabel: effectiveLayoutDynamicsPresetLabel,
      layoutDynamicsSurfaceCount: layoutDynamicsSurfaceCatalog.length,
      topBarSelectionSummary,
      availableTopBarsCount: availableTopBars.length,
      followThemeTopBarDetail,
      iconThemeSelectionSummary,
      appOpacity: settings.appearance.appOpacity,
      panelTransparency: settings.appearance.panelTransparency,
      appZoom: settings.appearance.appZoom,
      appBlurStrength: settings.appearance.appBlurStrength,
    }),
    [
      activeLayoutProfile.label,
      animationFailures.length,
      availableAnimations.length,
      availableSoundPackEntries.length,
      availableShaders.length,
      availableTopBars.length,
      availableWallpapers.length,
      connectedCloudAccountCount,
      configuredCloudProviderCount,
      mobileRemoteAccessDefinition.label,
      effectiveTheme.name,
      effectiveInteractionMotionProfileLabel,
      effectiveLayoutDynamicsPresetLabel,
      followThemeTopBarDetail,
      homePackSummary,
      iconThemeSelectionSummary,
      activeMenuPack?.name,
      appearancePackSelectionSummary,
      availableAppearancePackEntries.length,
      availableRecipePackEntries.length,
      availableShellRendererEntries.length,
      installedLocalModelCount,
      interactionMotionSurfaceCatalog.length,
      layoutDynamicsSurfaceCatalog.length,
      layoutManifestState.manifest.profiles.length,
      localModelCacheFootprint,
      menuPacks.length,
      platform,
      semanticIndexModelSummary,
      shellRendererSelectionSummary,
      soundPackSelectionSummary,
      settings.audio.nativeNotificationsEnabled,
      settings.audio.soundEffectsEnabled,
      settings.audio.vst3AdditionalFolders.length,
      settings.appearance.appBlurStrength,
      settings.appearance.appOpacity,
      settings.appearance.interactionMotionEnabled,
      settings.appearance.layoutDynamicsEnabled,
      settings.appearance.appZoom,
      settings.appearance.layoutDynamicsPresetId,
      settings.appearance.panelTransparency,
      settings.explorer.contextMenuLayoutOverridesByContext,
      settings.explorer.folderClickMode,
      settings.explorer.thumbnails.enabled,
      settings.explorer.viewMode,
      settings.keybindings.terminalToggle,
      settings.keybindings.windowModeToggle,
      settings.keybindings.zenFocusModeToggle,
      settings.layout.zenFocusMode,
      settings.mobile.remoteAccessMode,
      settings.mobile.tailscaleHostname,
      settings.screenshots.defaultCaptureMode,
      settings.screenshots.defaultOutputAction,
      settings.screenshots.showGrid,
      settings.system.launchAtStartup,
      shaderFailures.length,
      shaderPerformanceProfile.label,
      systemPresentationState,
      themeEngineSelectionSummary,
      availableThemeEngineEntries.length,
      themeRecipeSelectionSummary,
      themeWallpaperAvailable,
      topBarSelectionSummary,
      workspaceRoots.length,
    ],
  );
  const activeExplorerChromeOverrideEntries = useMemo(() => {
    if (!settings.appearance.activeThemeId) {
      return [];
    }
    const themeOverrides =
      settings.explorer.chromeLayoutOverridesByThemeId[
        settings.appearance.activeThemeId
      ] ?? {};
    return Object.values(themeOverrides).flatMap(
      (snapshot) => snapshot.entries,
    );
  }, [
    settings.appearance.activeThemeId,
    settings.explorer.chromeLayoutOverridesByThemeId,
  ]);
  const explorerCustomizeCatalog = useMemo(
    () =>
      buildExplorerCustomizeCatalog({
        actions,
        persistedEntries: activeExplorerChromeOverrideEntries,
      }),
    [actions, activeExplorerChromeOverrideEntries],
  );
  const assignedExplorerCommandBindings = useMemo(
    () =>
      Object.entries(settings.keybindings.commandBindingsById)
        .map(([commandId, binding]) => {
          const matchingEntry =
            explorerCustomizeCatalog.find(
              (entry) => entry.commandId === commandId,
            ) ?? null;
          return {
            commandId,
            binding,
            label: resolveExplorerChromeCommandLabel(
              commandId,
              explorerCustomizeCatalog,
            ),
            description:
              matchingEntry?.description ??
              "The original explorer command is no longer loaded. Clear or rebind it from customize mode.",
            surfaces: matchingEntry?.surfaces ?? ["explorerToolbar"],
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label)),
    [explorerCustomizeCatalog, settings.keybindings.commandBindingsById],
  );

  const settingsSections = useMemo(
    () =>
      settingsSectionCatalog.map((section) => {
        const content = getSettingsSectionContent(
          section.key as SettingsSectionKey,
          settingsSectionContext,
        );
        return {
          key: section.key as SettingsSectionKey,
          label: section.label,
          subtitle: section.subtitle,
          summary: content.summary,
          detail: content.detail,
          archetype: section.archetype as SettingsPageArchetype,
          shell: section.shell,
          icon: getSettingsSectionIcon(section.key as SettingsSectionKey),
        };
      }),
    [settingsSectionContext],
  );
  const activeSectionMeta =
    settingsSections.find((section) => section.key === activeSection) ??
    settingsSections[0];
  const activeSectionShellHints =
    activeSectionMeta.shell as SettingsSectionShellHints | undefined;
  const ActiveHomePackSettingsComponent =
    activeHomePack?.runtime.settingsComponent ?? null;
  const selectedContextMenuCommand =
    selectedContextMenuEntry?.kind === "command"
      ? (contextMenuCommandLookup.get(selectedContextMenuEntry.commandId) ??
        null)
      : null;
  const selectedContextMenuSiblingEntries = selectedContextMenuEntry
    ? activeContextMenuEntries.filter(
        (entry) =>
          entry.parentEntryId === selectedContextMenuEntry.parentEntryId,
      )
    : [];
  const selectedContextMenuSiblingIndex = selectedContextMenuEntry
    ? selectedContextMenuSiblingEntries.findIndex(
        (entry) => entry.id === selectedContextMenuEntry.id,
      )
    : -1;
  const selectedContextMenuPreviewNodeId =
    selectedContextMenuEntry?.kind === "command"
      ? selectedContextMenuEntry.commandId
      : (selectedContextMenuEntry?.id ?? null);

  const renderContextMenuStructureBranch = (
    parentEntryId: string | null,
    depth = 0,
  ): ReactNode => {
    const branchEntries = activeContextMenuEntries.filter(
      (entry) => entry.parentEntryId === parentEntryId,
    );

    return (
      <div className="space-y-1.5">
        {branchEntries.map((entry, index) => {
          const resolvedCommand =
            entry.kind === "command"
              ? (contextMenuCommandLookup.get(entry.commandId) ?? null)
              : null;
          const isSelected = selectedContextMenuEntryId === entry.id;
          const title =
            entry.kind === "command"
              ? (resolvedCommand?.title ?? entry.commandId)
              : entry.kind === "submenu"
                ? entry.title
                : entry.kind === "group-slot"
                  ? `Group Slot · ${entry.group}`
                  : "Separator";

          return (
            <div key={entry.id} className="space-y-1.5">
              <button
                type="button"
                draggable
                onClick={() => setSelectedContextMenuEntryId(entry.id)}
                onDragStart={() => {
                  setDraggedContextMenuEntryId(entry.id);
                  setSelectedContextMenuEntryId(entry.id);
                }}
                onDragEnd={() => setDraggedContextMenuEntryId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (
                    !draggedContextMenuEntryId ||
                    draggedContextMenuEntryId === entry.id
                  ) {
                    return;
                  }
                  placeContextMenuLayoutEntryAt(
                    draggedContextMenuEntryId,
                    parentEntryId,
                    index,
                  );
                  setSelectedContextMenuEntryId(draggedContextMenuEntryId);
                  setDraggedContextMenuEntryId(null);
                }}
                className="w-full rounded border px-3 py-2 text-left"
                style={{
                  marginLeft: depth * 12,
                  borderColor: isSelected ? accent : border,
                  background: isSelected
                    ? `${accent}12`
                    : "rgba(255,255,255,0.03)",
                  color: text,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] opacity-40">⋮⋮</span>
                      <span className="text-[11px] font-semibold">{title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <ThemeBadge label={entry.kind} active={isSelected} />
                      {resolvedCommand ? (
                        <ThemeBadge
                          label={resolveContextMenuCommandSourceLabel(
                            resolvedCommand,
                          )}
                        />
                      ) : null}
                      {entry.kind === "group-slot" ? (
                        <ThemeBadge label={entry.sourceFilter ?? "any"} />
                      ) : null}
                    </div>
                  </div>
                  <div className="text-[10px] opacity-45">#{entry.order}</div>
                </div>
              </button>

              {entry.kind === "submenu" ? (
                <div className="space-y-1.5">
                  {renderContextMenuStructureBranch(entry.id, depth + 1)}
                </div>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!draggedContextMenuEntryId) {
              return;
            }
            placeContextMenuLayoutEntryAt(
              draggedContextMenuEntryId,
              parentEntryId,
              branchEntries.length,
            );
            setSelectedContextMenuEntryId(draggedContextMenuEntryId);
            setDraggedContextMenuEntryId(null);
          }}
          className="w-full rounded border border-dashed px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            marginLeft: depth * 12,
            borderColor: draggedContextMenuEntryId
              ? `${accent}77`
              : `${border}aa`,
            background: draggedContextMenuEntryId
              ? `${accent}10`
              : "rgba(255,255,255,0.02)",
            color: muted,
          }}
        >
          {parentEntryId == null
            ? "Drop To Append At Root"
            : "Drop To Append In Submenu"}
        </button>
      </div>
    );
  };

  const contextMenuComposerSurface = (
    <div
      className="rounded border p-3"
      style={{ borderColor: border, background: "rgba(255,255,255,0.025)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
            Context Menu Composer
          </div>
          <p className="mt-1 max-w-[760px] text-[11px] opacity-40">
            Edit the live explorer context menu visually: browse commands and
            actions, author folders and group slots, drag the structure into
            place, and inspect the exact layout override that this context will
            use.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void onRefreshMenuPacks()}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${border}`,
              background: "rgba(255,255,255,0.04)",
              color: text,
            }}
          >
            Refresh Packs
          </button>
          <button
            type="button"
            onClick={() => void onRefreshActions()}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${border}`,
              background: "rgba(255,255,255,0.04)",
              color: text,
            }}
          >
            Refresh Actions
          </button>
          <button
            type="button"
            onClick={() => void onOpenMenuPacksFolder()}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${accent}55`,
              background: `${accent}14`,
              color: text,
            }}
          >
            Open Menu Packs Folder
          </button>
          <button
            type="button"
            onClick={() => void onOpenActionsFolder()}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${accent}55`,
              background: `${accent}14`,
              color: text,
            }}
          >
            Open Actions Folder
          </button>
          <button
            type="button"
            onClick={resetContextMenuLayout}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${border}`,
              background: "rgba(255,255,255,0.04)",
              color: text,
            }}
          >
            Reset Context
          </button>
          <button
            type="button"
            onClick={resetAllContextMenuLayouts}
            className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{
              border: `1px solid ${border}`,
              background: "rgba(255,255,255,0.04)",
              color: text,
            }}
          >
            Reset All Overrides
          </button>
        </div>
      </div>

      {menuPacksWarnings.length > 0 ? (
        <div
          className="mt-3 rounded border px-3 py-2 text-[11px]"
          style={{
            borderColor: `${border}aa`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {menuPacksWarnings.map((warning) => (
            <div key={warning} className="opacity-55">
              {warning}
            </div>
          ))}
        </div>
      ) : null}
      {actionsWarnings.length > 0 ? (
        <div
          className="mt-3 rounded border px-3 py-2 text-[11px]"
          style={{
            borderColor: `${border}aa`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          {actionsWarnings.map((warning) => (
            <div key={warning} className="opacity-55">
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {EXPLORER_MENU_CONTEXT_KINDS.map((contextKind) => (
          <button
            key={contextKind}
            type="button"
            onClick={() => setActiveContextMenuComposerContext(contextKind)}
            className="rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{
              border: `1px solid ${activeContextMenuContext === contextKind ? accent : border}`,
              background:
                activeContextMenuContext === contextKind
                  ? `${accent}16`
                  : "rgba(255,255,255,0.03)",
              color: text,
            }}
          >
            {contextKind}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div
            className="rounded border p-3"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
              Pack And Renderer
            </div>
            <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              <span>Active Menu Pack</span>
              <select
                value={activeMenuPack?.id ?? ""}
                onChange={(event) => setActiveMenuPackId(event.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                {menuPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              <span>Context Renderer</span>
              <select
                value={activeContextMenuLayout.renderer ?? "classic"}
                onChange={(event) =>
                  setContextMenuRendererForActiveContext(
                    event.target.value as ExplorerMenuContextLayout["renderer"],
                  )
                }
                className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                {["classic", "hybrid", "radial", "sheet", "hud"].map(
                  (renderer) => (
                    <option key={renderer} value={renderer}>
                      {renderer}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] md:grid-cols-2 xl:grid-cols-1">
              <div
                className="rounded border px-3 py-2"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="font-semibold">
                  {activeMenuPack?.name ?? "No Pack Loaded"}
                </div>
                <div className="mt-1 opacity-55">
                  {menuPacksLoading
                    ? "Scanning menu packs…"
                    : `${menuPacks.length} pack${menuPacks.length === 1 ? "" : "s"} available`}
                </div>
                <div className="mt-1 text-[10px] opacity-45">
                  {menuPacksDirectory}
                </div>
                {menuPacksError ? (
                  <div
                    className="mt-1 text-[10px]"
                    style={{ color: "var(--overlay-danger)" }}
                  >
                    {menuPacksError}
                  </div>
                ) : null}
              </div>
              <div
                className="rounded border px-3 py-2"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="font-semibold">Action Catalog</div>
                <div className="mt-1 opacity-55">
                  {actionsLoading
                    ? "Scanning action packs…"
                    : `${actions.length} action${actions.length === 1 ? "" : "s"} across ${actionPacks.length} pack${actionPacks.length === 1 ? "" : "s"}`}
                </div>
                <div className="mt-1 text-[10px] opacity-45">
                  {actionsDirectory}
                </div>
                {actionsError ? (
                  <div
                    className="mt-1 text-[10px]"
                    style={{ color: "var(--overlay-danger)" }}
                  >
                    {actionsError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="rounded border p-3"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
              Quick Add
            </div>
            <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              <span>Add Command</span>
              <select
                value={
                  contextMenuCommandDraftByContext[activeContextMenuContext] ??
                  ""
                }
                onChange={(event) =>
                  setContextMenuCommandDraftByContext((current) => ({
                    ...current,
                    [activeContextMenuContext]: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                <option value="">
                  {availableContextMenuCommandsForActiveContext.length > 0
                    ? "Choose command…"
                    : "No more commands for this context"}
                </option>
                {availableContextMenuCommandsForActiveContext.map((command) => (
                  <option key={command.id} value={command.id}>
                    {command.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => addContextMenuCommandEntry()}
              className="mt-2 w-full rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                border: `1px solid ${border}`,
                background: "rgba(255,255,255,0.04)",
                color: text,
              }}
            >
              Add Command Node
            </button>
            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              <span>Add Group Slot</span>
              <select
                value={
                  contextMenuGroupDraftByContext[activeContextMenuContext] ??
                  "plugin"
                }
                onChange={(event) =>
                  setContextMenuGroupDraftByContext((current) => ({
                    ...current,
                    [activeContextMenuContext]: event.target
                      .value as (typeof explorerMenuGroupOptions)[number],
                  }))
                }
                className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                {explorerMenuGroupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addContextMenuGroupSlot}
              className="mt-2 w-full rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                border: `1px solid ${border}`,
                background: "rgba(255,255,255,0.04)",
                color: text,
              }}
            >
              Add Group Slot
            </button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addContextMenuSubmenu}
                className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  border: `1px solid ${border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                Create Folder
              </button>
              <button
                type="button"
                onClick={addContextMenuSeparator}
                className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{
                  border: `1px solid ${border}`,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                }}
              >
                Add Separator
              </button>
            </div>
          </div>

          <div
            className="rounded border p-3"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                Action Browser
              </div>
              <ThemeBadge
                label={`${filteredContextMenuBrowserCommands.length} visible`}
              />
            </div>
            <input
              value={contextMenuCommandBrowserQuery}
              onChange={(event) =>
                setContextMenuCommandBrowserQuery(event.target.value)
              }
              placeholder="Search commands, actions, plugins..."
              className="mt-2 w-full rounded border px-3 py-2 text-[12px]"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.04)",
                color: text,
              }}
            />
            <OverlayScrollArea
              style={{ marginTop: 12, maxHeight: 420 }}
              scrollbarStyle="themed"
              viewportStyle={{ paddingRight: 4 }}
            >
              <div className="space-y-2">
                {filteredContextMenuBrowserCommands.length === 0 ? (
                  <div
                    className="rounded border px-3 py-4 text-[11px] opacity-50"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    No commands match the current browser filter.
                  </div>
                ) : (
                  filteredContextMenuBrowserCommands.map((command) => (
                    <div
                      key={command.id}
                      className="rounded border px-3 py-2"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="opacity-70">
                              {renderSettingsContextMenuIcon(command.iconName)}
                            </span>
                            <span className="text-[11px] font-semibold">
                              {command.title}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <ThemeBadge
                              label={resolveContextMenuCommandSourceLabel(
                                command,
                              )}
                            />
                            <ThemeBadge label={command.group} />
                          </div>
                          {command.description ? (
                            <p className="mt-2 text-[11px] opacity-45">
                              {command.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => addContextMenuCommandEntry(command.id)}
                          className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{
                            border: `1px solid ${border}`,
                            background: "rgba(255,255,255,0.04)",
                            color: text,
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </OverlayScrollArea>
          </div>
        </div>

        <div className="space-y-3">
          <div
            className="rounded border p-3"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                  Live Preview
                </div>
                <div className="mt-1 text-[11px] opacity-45">
                  The runtime preview uses the active pack plus your current
                  override layer for <code>{activeContextMenuContext}</code>.
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <ThemeBadge
                  label={`Renderer ${contextMenuPreviewMenu.presentation.renderer}`}
                  active
                />
                <ThemeBadge
                  label={`Density ${contextMenuPreviewMenu.presentation.density}`}
                />
              </div>
            </div>
            <div
              className="mt-3 overflow-hidden rounded border p-3"
              style={{ borderColor: border, background: "rgba(0,0,0,0.16)" }}
            >
              <ExplorerContextMenuPreviewPanels
                nodes={contextMenuPreviewMenu.nodes}
                density={contextMenuPreviewMenu.presentation.density}
                showDescriptions={
                  contextMenuPreviewMenu.presentation.showDescriptions
                }
                selectedNodeId={selectedContextMenuPreviewNodeId}
                onSelectNode={selectContextMenuEntryFromRuntimeNode}
              />
            </div>
          </div>

          <div
            className="rounded border p-3"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                  Menu Structure
                </div>
                <div className="mt-1 text-[11px] opacity-45">
                  Drag rows to reorder them. Drop onto a submenu lane to move
                  items into that folder. Use the inspector to adjust placement,
                  quick slots, and buckets.
                </div>
              </div>
              <ThemeBadge
                label={`${activeContextMenuEntries.length} authored node${activeContextMenuEntries.length === 1 ? "" : "s"}`}
              />
            </div>
            <OverlayScrollArea
              style={{ marginTop: 12, maxHeight: 560 }}
              scrollbarStyle="themed"
              viewportStyle={{ paddingRight: 4 }}
            >
              {activeContextMenuEntries.length === 0 ? (
                <div
                  className="rounded border px-3 py-4 text-[11px] opacity-50"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  No entries defined for <code>{activeContextMenuContext}</code>
                  . Start by adding commands, folders, separators, or group
                  slots from the left lane.
                </div>
              ) : (
                renderContextMenuStructureBranch(null)
              )}
            </OverlayScrollArea>
          </div>
        </div>

        <div className="space-y-3">
          <div
            className="rounded border p-3"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
              Inspector
            </div>
            {selectedContextMenuEntry == null ? (
              <div
                className="mt-3 rounded border px-3 py-4 text-[11px] opacity-50"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                Select a node in the structure tree or click a concrete menu
                item in the live preview to edit it here.
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <div className="text-[13px] font-semibold">
                    {selectedContextMenuEntry.kind === "command"
                      ? (selectedContextMenuCommand?.title ??
                        selectedContextMenuEntry.commandId)
                      : selectedContextMenuEntry.kind === "submenu"
                        ? selectedContextMenuEntry.title
                        : selectedContextMenuEntry.kind === "group-slot"
                          ? `Group Slot · ${selectedContextMenuEntry.group}`
                          : "Separator"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <ThemeBadge label={selectedContextMenuEntry.kind} active />
                    {selectedContextMenuCommand ? (
                      <ThemeBadge
                        label={resolveContextMenuCommandSourceLabel(
                          selectedContextMenuCommand,
                        )}
                      />
                    ) : null}
                    {selectedContextMenuCommand ? (
                      <ThemeBadge
                        label={selectedContextMenuCommand.contexts.join(" + ")}
                      />
                    ) : null}
                  </div>
                  {selectedContextMenuCommand?.description ? (
                    <p className="mt-2 text-[11px] opacity-45">
                      {selectedContextMenuCommand.description}
                    </p>
                  ) : null}
                </div>

                <label
                  className="mt-3 flex items-center justify-between gap-3 rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <span>Enabled</span>
                  <input
                    type="checkbox"
                    checked={selectedContextMenuEntry.enabled !== false}
                    onChange={(event) =>
                      toggleContextMenuLayoutEntryEnabled(
                        selectedContextMenuEntry.id,
                        event.target.checked,
                      )
                    }
                  />
                </label>

                {selectedContextMenuEntry.kind === "submenu" ? (
                  <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                    <span>Folder Name</span>
                    <input
                      value={selectedContextMenuEntry.title}
                      onChange={(event) =>
                        setContextMenuSubmenuTitle(
                          selectedContextMenuEntry.id,
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    />
                  </label>
                ) : null}

                {selectedContextMenuEntry.kind === "group-slot" ? (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      <span>Group</span>
                      <select
                        value={selectedContextMenuEntry.group}
                        onChange={(event) =>
                          setContextMenuGroupSlotGroup(
                            selectedContextMenuEntry.id,
                            event.target
                              .value as (typeof explorerMenuGroupOptions)[number],
                          )
                        }
                        className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.04)",
                          color: text,
                        }}
                      >
                        {explorerMenuGroupOptions.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      <span>Source Filter</span>
                      <select
                        value={selectedContextMenuEntry.sourceFilter ?? "any"}
                        onChange={(event) =>
                          setContextMenuGroupSlotSourceFilter(
                            selectedContextMenuEntry.id,
                            event.target.value as Extract<
                              ExplorerMenuLayoutEntry,
                              { kind: "group-slot" }
                            >["sourceFilter"],
                          )
                        }
                        className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.04)",
                          color: text,
                        }}
                      >
                        {["any", "built-in", "plugin", "preview", "action"].map(
                          (sourceFilter) => (
                            <option key={sourceFilter} value={sourceFilter}>
                              {sourceFilter}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                    <span>Parent</span>
                    <select
                      value={selectedContextMenuEntry.parentEntryId ?? ""}
                      onChange={(event) =>
                        setContextMenuLayoutEntryParent(
                          selectedContextMenuEntry.id,
                          event.target.value || null,
                        )
                      }
                      className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      <option value="">Root</option>
                      {activeContextMenuSubmenus
                        .filter(
                          (submenu) =>
                            submenu.id !== selectedContextMenuEntry.id,
                        )
                        .map((submenu) => (
                          <option key={submenu.id} value={submenu.id}>
                            {submenu.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                    <span>Quick Slot</span>
                    <select
                      value={selectedContextMenuEntry.quickSlot ?? "none"}
                      onChange={(event) =>
                        setContextMenuLayoutEntryQuickSlot(
                          selectedContextMenuEntry.id,
                          event.target.value as ExplorerMenuQuickSlot,
                        )
                      }
                      className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {explorerMenuQuickSlotOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                    <span>Fallback Bucket</span>
                    <select
                      value={
                        selectedContextMenuEntry.fallbackBucket ?? "default"
                      }
                      onChange={(event) =>
                        setContextMenuLayoutEntryFallbackBucket(
                          selectedContextMenuEntry.id,
                          event.target.value as ExplorerMenuFallbackBucket,
                        )
                      }
                      className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {explorerMenuFallbackBucketOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      moveContextMenuLayoutEntry(
                        selectedContextMenuEntry.id,
                        "up",
                      )
                    }
                    disabled={selectedContextMenuSiblingIndex <= 0}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color:
                        selectedContextMenuSiblingIndex <= 0 ? muted : text,
                      opacity: selectedContextMenuSiblingIndex <= 0 ? 0.5 : 1,
                    }}
                  >
                    <ArrowUp size={11} />
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      moveContextMenuLayoutEntry(
                        selectedContextMenuEntry.id,
                        "down",
                      )
                    }
                    disabled={
                      selectedContextMenuSiblingIndex < 0 ||
                      selectedContextMenuSiblingIndex >=
                        selectedContextMenuSiblingEntries.length - 1
                    }
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color:
                        selectedContextMenuSiblingIndex < 0 ||
                        selectedContextMenuSiblingIndex >=
                          selectedContextMenuSiblingEntries.length - 1
                          ? muted
                          : text,
                      opacity:
                        selectedContextMenuSiblingIndex < 0 ||
                        selectedContextMenuSiblingIndex >=
                          selectedContextMenuSiblingEntries.length - 1
                          ? 0.5
                          : 1,
                    }}
                  >
                    <ArrowDown size={11} />
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      removeContextMenuLayoutEntry(selectedContextMenuEntry.id)
                    }
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    Remove
                  </button>
                  <span className="text-[10px] opacity-45">
                    Order {selectedContextMenuEntry.order}
                  </span>
                </div>
              </>
            )}
          </div>

          <div
            className="rounded border px-3 py-3 text-[11px]"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div className="font-semibold">Source Mix</div>
            <div className="mt-2 opacity-55">
              {pluginContextMenuItems.length} legacy plugin menu items
            </div>
            <div className="mt-1 opacity-55">
              {pluginExplorerActions.length} legacy plugin explorer actions
            </div>
            <div className="mt-1 opacity-55">
              {actions.filter((action) => action.pluginId != null).length}{" "}
              plugin-shipped authored actions
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  void contextMenuComposerSurface;

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        fontFamily: appearance.fonts.ui,
        colorScheme: settingsFormColorScheme,
      }}
    >
      <SettingsShell
        railWidth={railWidth}
        onRailWidthChange={setRailWidth}
        accent={accent}
        settingsStyle={workbench.settingsStyle}
        panelRadius={workbench.metrics.panelRadius}
        blurEnabled={blurEnabled}
        activeSectionKey={activeSectionMeta.key}
        activeArchetype={activeSectionMeta.archetype}
        preferredContentDensity={
          activeSectionShellHints?.preferredContentDensity
        }
        disableContentScroll={
          activeSectionShellHints?.disableContentScroll
        }
        rail={
          <>
            <div className="border-b px-4 py-3" style={{ borderColor: border }}>
              <div
                className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: muted }}
              >
                <SlidersHorizontal size={12} />
                <span>Workbench Settings</span>
              </div>
              <h1
                className="mt-1.5 text-[16px] font-semibold leading-none"
                style={{ color: text }}
              >
                Settings
              </h1>
            </div>

            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              viewportStyle={{ padding: "8px 10px 10px 10px" }}
            >
              <div className="space-y-2">
                {settingsSections.map((section) => (
                  <SettingsRailButton
                    key={section.key}
                    active={activeSection === section.key}
                    icon={section.icon}
                    label={section.label}
                    subtitle={section.subtitle}
                    summary={section.summary}
                    accent={accent}
                    border={border}
                    text={text}
                    muted={muted}
                    onClick={() => setActiveSection(section.key)}
                    motionBinding={bindSettingsCardMotion(
                      activeSection === section.key,
                    )}
                  />
                ))}
              </div>
            </OverlayScrollArea>
          </>
        }
        header={
          <div
            className="border-b px-4 py-3"
            data-settings-summary-header="true"
            style={{
              borderColor: "var(--overlay-workbench-settings-card-border)",
              borderRadius:
                workbench.settingsStyle === "floating" ||
                workbench.settingsStyle === "glass"
                  ? workbench.metrics.panelRadius
                  : 0,
              background: "var(--overlay-workbench-settings-card-bg)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="min-w-[240px] flex-1 text-[11px] leading-4"
                  style={{ color: muted }}
                >
                  {activeSectionMeta.detail}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                <span
                  className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    border:
                      "1px solid var(--overlay-workbench-settings-badge-border)",
                    color: muted,
                    background: "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  Theme · {effectiveTheme.name}
                </span>
                <span
                  className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    border:
                      "1px solid var(--overlay-workbench-settings-badge-border)",
                    color: muted,
                    background: "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  Layout · {activeLayoutProfile.label}
                </span>
                <span
                  className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    border:
                      "1px solid var(--overlay-workbench-settings-badge-border)",
                    color: muted,
                    background: "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  Startup ·{" "}
                  {settings.system.launchAtStartup ? "Enabled" : "Disabled"}
                </span>
                <span
                  className="rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                  style={{
                    border:
                      "1px solid var(--overlay-workbench-settings-badge-border)",
                    color: muted,
                    background: "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  Archetype · {activeSectionMeta.archetype}
                </span>
                <span
                  className="hidden rounded px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] xl:inline-flex"
                  style={{
                    border:
                      "1px solid var(--overlay-workbench-settings-badge-border)",
                    color: muted,
                    background: "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  {activeSectionMeta.summary}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setShowAllDescriptions(
                      activeSection,
                      !showAllDescriptionsForActiveSection,
                    )
                  }
                  aria-pressed={showAllDescriptionsForActiveSection}
                  title={
                    showAllDescriptionsForActiveSection
                      ? "Hide descriptions (use the (i) bubbles instead)"
                      : "Show every row description inline for this section"
                  }
                  className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    border: `1px solid ${
                      showAllDescriptionsForActiveSection
                        ? `${accent}88`
                        : "var(--overlay-workbench-settings-badge-border)"
                    }`,
                    color: text,
                    background: showAllDescriptionsForActiveSection
                      ? `${accent}1f`
                      : "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  <SlidersHorizontal size={12} />
                  {showAllDescriptionsForActiveSection
                    ? "Hide Descriptions"
                    : "Show Descriptions"}
                </button>
                <button
                  onClick={() => resetToDefaults()}
                  className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                  style={{
                    border:
                      "1px solid var(--overlay-workbench-settings-badge-border)",
                    color: text,
                    background: "var(--overlay-workbench-settings-badge-bg)",
                  }}
                >
                  <RotateCcw size={12} />
                  Reset Defaults
                </button>
              </div>
            </div>
          </div>
        }
      >
        <SettingsRowDescriptionProvider
          showDescriptions={showAllDescriptionsForActiveSection}
        >
        {activeSection === "overview" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: "var(--overlay-workbench-settings-card-border)",
              background: "var(--overlay-workbench-settings-card-bg)",
            }}
          >
            <SectionTitle
              icon={<Sparkles size={12} />}
              title="Overview"
              subtitle="First-run orientation, workspace roots, and the settings slices that matter most for a credible ship candidate."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-4"
                style={{
                  borderColor: `${accent}44`,
                  background: `${accent}0d`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[640px]">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: muted }}
                    >
                      GreebleFS Control Surface
                    </div>
                    <h2
                      className="mt-2 text-[18px] font-semibold"
                      style={{ color: text }}
                    >
                      Ship the shell, not a template.
                    </h2>
                    <p
                      className="mt-2 text-[12px] leading-5"
                      style={{ color: muted }}
                    >
                      GreebleFS is a desktop workbench with a live terminal,
                      file explorer, source-control rail, plugin host, theme and
                      motion authoring, and screenshot proof capture in one
                      surface.
                    </p>
                  </div>
                  <div className="grid min-w-[220px] flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    {overviewStats.map((stat) => (
                      <div
                        key={stat.id}
                        className="rounded border px-3 py-2"
                        style={{
                          borderColor: "rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.04)",
                        }}
                      >
                        <div
                          className="text-[9px] font-semibold uppercase tracking-[0.12em]"
                          style={{ color: muted }}
                        >
                          {stat.label}
                        </div>
                        <div
                          className="mt-1 text-[12px] font-semibold"
                          style={{ color: text }}
                        >
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <OverviewCard
                title="Core Workflows"
                subtitle="These are the panel handoffs operators need to understand on first contact."
                badges={["Explorer", "Source", "Plugins", "Screenshots"]}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {overviewWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="rounded border p-3"
                      style={{
                        borderColor: "rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div
                        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: muted }}
                      >
                        {workflow.icon}
                        <span>{workflow.title}</span>
                      </div>
                      <p
                        className="mt-2 text-[11px] leading-5"
                        style={{ color: muted }}
                      >
                        {workflow.description}
                      </p>
                      <button
                        type="button"
                        onClick={workflow.action}
                        className="mt-3 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${border}`,
                          background: "rgba(255,255,255,0.04)",
                          color: text,
                        }}
                      >
                        {workflow.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </OverviewCard>

              <OverviewCard
                title="Workspace Roots"
                subtitle="Open or create the directories that feed GreebleFS runtime discovery."
                badges={[`${workspaceRoots.length} roots`, "Create on demand"]}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {workspaceRoots.map((root) => (
                    <div
                      key={root.id}
                      className="rounded border p-3"
                      style={{
                        borderColor: "rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div
                            className="text-[11px] font-semibold"
                            style={{ color: text }}
                          >
                            {root.label}
                          </div>
                          <p
                            className="mt-1 text-[11px] leading-4"
                            style={{ color: muted }}
                          >
                            {root.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void openWorkspaceDirectory(root.label, root.path)
                          }
                          className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{
                            border: `1px solid ${accent}55`,
                            background: `${accent}16`,
                            color: text,
                          }}
                        >
                          Open {root.label} Folder
                        </button>
                      </div>
                      <div
                        className="mt-3 rounded border px-3 py-2 text-[10px]"
                        style={{
                          borderColor: "rgba(255,255,255,0.08)",
                          background: "rgba(0,0,0,0.12)",
                          color: muted,
                          fontFamily: appearance.fonts.mono,
                        }}
                      >
                        {root.path}
                      </div>
                    </div>
                  ))}
                </div>
                {overviewNotice ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: `${accent}44`,
                      background: `${accent}12`,
                      color: text,
                    }}
                  >
                    {overviewNotice}
                  </div>
                ) : null}
                {overviewError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#7f1d1d",
                      background: "rgba(127,29,29,0.18)",
                      color: "#fecaca",
                    }}
                  >
                    {overviewError}
                  </div>
                ) : null}
              </OverviewCard>

              <OverviewCard
                title="Settings Shortcuts"
                subtitle="Jump straight to the settings surfaces most likely to unblock a real release session."
                badges={["System", "Terminal", "Explorer", "Layouts"]}
              >
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {settingsJumpCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={card.action}
                      className="rounded px-3 py-3 text-left transition-colors"
                      style={{
                        border: `1px solid ${border}`,
                        background: "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <div className="text-[11px] font-semibold">
                        {card.title}
                      </div>
                      <div className="mt-1 text-[11px] opacity-45">
                        {card.summary}
                      </div>
                    </button>
                  ))}
                </div>
              </OverviewCard>
            </div>
          </section>
        )}

        {activeSection === "models" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<Bot size={12} />}
              title="Models"
              subtitle="Shared local-model management for semantic indexing now, with the same cache and capability routing ready for future inference, source separation, and other Python-backed AI lanes."
            />

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <OverviewCard
                  title="Managed Cache"
                  subtitle="Curated models download into the shared managed runtime cache so future AI features reuse one install surface."
                  badges={[
                    `${installedLocalModelCount} installed`,
                    localModelCacheFootprint,
                    localModelStatusPending ? "Refreshing" : "Ready",
                  ]}
                >
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        <Database size={11} />
                        <span>Cache Location</span>
                      </div>
                      <div
                        className="mt-1.5 break-all text-[11px]"
                        style={{
                          color: text,
                          fontFamily: appearance.fonts.mono,
                        }}
                      >
                        {localModelStatus?.cacheRoot ??
                          managedPythonRuntimeConfig?.runtimeRoot ??
                          "Initialize the managed Python runtime to resolve the cache root."}
                      </div>
                      {localModelStatus ? (
                        <div className="mt-1 text-[10px] opacity-45">
                          Python {localModelStatus.pythonVersion} · registry{" "}
                          {localModelStatus.registryRoot}
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] opacity-45">
                          Model cache metadata appears after the first catalog
                          refresh.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshLocalModels(true)}
                        disabled={localModelStatusPending}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${localModelStatusPending ? border : accent}`,
                          background: localModelStatusPending
                            ? "rgba(255,255,255,0.03)"
                            : `${accent}16`,
                          color: text,
                          opacity: localModelStatusPending ? 0.72 : 1,
                        }}
                      >
                        {localModelStatusPending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        Refresh Models
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleOpenLocalModelCache()}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${border}`,
                          background: "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <FolderOpen size={11} />
                        Open Cache Folder
                      </button>
                    </div>
                  </div>
                </OverviewCard>

                <OverviewCard
                  title="Acceleration Lane"
                  subtitle="Backend preferences stay explicit. CUDA is optional, and the UI only offers the NVIDIA lane when the acceleration runtime actually detects it."
                  badges={[
                    cudaProviderReady ? "CUDA ready" : "CUDA unavailable",
                    settings.system.accelerationRoutingMode,
                    cudaProviderStatus?.available
                      ? "provider detected"
                      : "cpu fallback",
                  ]}
                >
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        <Cpu size={11} />
                        <span>CUDA Python Provider</span>
                      </div>
                      <div className="mt-1.5 text-[11px]" style={{ color: text }}>
                        {cudaProviderStatus?.label ?? "CUDA Python Sidecar"}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 opacity-45">
                        {cudaProviderStatus?.detail ??
                          "The acceleration runtime has not reported a CUDA-ready provider yet, so CPU and ONNX remain the portable lanes."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleProbeAccelerationPipeline()}
                        disabled={accelerationProbePending}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${accelerationProbePending ? border : accent}`,
                          background: accelerationProbePending
                            ? "rgba(255,255,255,0.03)"
                            : `${accent}16`,
                          color: text,
                          opacity: accelerationProbePending ? 0.72 : 1,
                        }}
                      >
                        {accelerationProbePending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Cpu size={11} />
                        )}
                        Probe CUDA / AI
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQueueAccelerationInstall()}
                        disabled={
                          accelerationInstallPending ||
                          accelerationAutoInstallPlan == null
                        }
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${accelerationInstallPending || accelerationAutoInstallPlan == null ? border : accent}`,
                          background:
                            accelerationInstallPending ||
                            accelerationAutoInstallPlan == null
                              ? "rgba(255,255,255,0.03)"
                              : `${accent}16`,
                          color: text,
                          opacity:
                            accelerationInstallPending ||
                            accelerationAutoInstallPlan == null
                              ? 0.72
                              : 1,
                        }}
                      >
                        {accelerationInstallPending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Download size={11} />
                        )}
                        {accelerationInstallPending
                          ? "Opening Terminal…"
                          : accelerationInstallButtonLabel}
                      </button>
                    </div>

                    <div
                      className="rounded border px-3 py-2 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                        color: muted,
                      }}
                    >
                      {accelerationPipelineStatus}
                    </div>
                    <div
                      className="rounded border px-3 py-2 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                        color: muted,
                      }}
                    >
                      {accelerationInstallRecommended
                        ? "Blank runtime detected. Use Download to queue the recommended managed packages in Terminal."
                        : "Download uses the current acceleration routing mode, so CUDA packages only queue when you explicitly select the CUDA lane."}
                    </div>
                  </div>
                </OverviewCard>

                <OverviewCard
                  title="Active Semantic Lane"
                  subtitle="Semantic indexing is the first capability online, but the binding model is shared so future local-model features land on the same contract."
                  badges={[
                    semanticIndexingSelectedModel?.label ?? "No model",
                    semanticIndexingBackendLabel,
                    semanticIndexingSelectedHardwareProfile?.label ??
                      "Profile pending",
                  ]}
                >
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        <Bot size={11} />
                        <span>Current Active Model</span>
                      </div>
                      <div className="mt-1.5 text-[11px]" style={{ color: text }}>
                        {semanticIndexingSelectedModel?.label ??
                          "No semantic model selected"}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 opacity-45">
                        {semanticIndexingSelectedModel?.description ??
                          "Choose a curated embedding model below to drive semantic indexing and similarity search."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ThemeBadge
                          label={`Backend ${semanticIndexingBackendLabel}`}
                          active
                        />
                        <ThemeBadge
                          label={
                            semanticIndexingSelectedModelStatus?.installed
                              ? "Installed"
                              : "Not warmed"
                          }
                        />
                        {semanticIndexingSelectedHardwareProfile ? (
                          <ThemeBadge
                            label={
                              semanticIndexingSelectedHardwareProfile.label
                            }
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="text-[11px] opacity-55" style={{ color: muted }}>
                      {semanticIndexOverrideEntries.length > 0
                        ? `${semanticIndexOverrideEntries.length} per-root override${semanticIndexOverrideEntries.length === 1 ? "" : "s"} pinned for semantic indexing.`
                        : "No per-root semantic overrides yet; the default semantic binding applies to every local index root."}
                    </div>
                  </div>
                </OverviewCard>
              </div>

              {localModelNotice ? (
                <div
                  className="rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: `${accent}44`,
                    background: `${accent}12`,
                    color: text,
                  }}
                >
                  {localModelNotice}
                </div>
              ) : null}
              {localModelStatusError ? (
                <div
                  className="rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: "#7f1d1d",
                    background: "rgba(127,29,29,0.18)",
                    color: "#fecaca",
                  }}
                >
                  {localModelStatusError}
                </div>
              ) : null}

              <OverviewCard
                title="Capability Routing"
                subtitle="Model and backend bindings are capability-driven. Semantic indexing is live now; local inference and source separation stay visible so the settings surface does not have to be reinvented when those lanes arrive."
                badges={["Shared bindings", "Capability-first", "Future-ready"]}
              >
                <div
                  className="overflow-hidden rounded border"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  {localModelCapabilityCatalog.map((capability, capabilityIndex) => {
                    const binding = settings.models.capabilityBindings[
                      capability.id
                    ] ?? {
                      modelId: capability.defaultModelId,
                      backendPreference: capability.defaultBackendPreference,
                    };
                    const selectedModel =
                      getLocalModelDefinition(binding.modelId) ??
                      getLocalModelDefinitionByProviderModelId(binding.modelId);
                    const selectedModelStatus = selectedModel
                      ? (localModelStatusById.get(selectedModel.id) ?? null)
                      : null;
                    const capabilityModels = getCapabilityModels(capability.id);
                    const isActive = capability.availability === "active";

                    return (
                      <div
                        key={capability.id}
                        className={`px-3 py-3 ${capabilityIndex > 0 ? "border-t" : ""}`}
                        style={{ borderColor: border }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="text-[11px] font-semibold"
                                style={{ color: text }}
                              >
                                {capability.label}
                              </div>
                              <InfoBubble
                                description={capability.description}
                                label={`About ${capability.label}`}
                              />
                            </div>
                          </div>
                          <ThemeBadge
                            label={isActive ? "Active" : "Planned"}
                            active={isActive}
                          />
                        </div>

                        {isActive ? (
                          <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <label className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60 shrink-0">
                                Model
                              </span>
                              <select
                                aria-label={`${capability.label} model`}
                                value={binding.modelId ?? ""}
                                onChange={(event) =>
                                  handleUpdateModelCapabilityBinding(
                                    capability.id,
                                    {
                                      modelId: event.target.value || null,
                                    },
                                  )
                                }
                                className="min-w-0 flex-1 rounded border bg-transparent px-2 py-1.5 text-[11px] outline-none"
                                style={settingsSelectStyle}
                              >
                                {capabilityModels.map((model) => (
                                  <option key={model.id} value={model.id}>
                                    {model.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                Backend
                              </span>
                              {localModelBackendOptions
                                .filter((option) =>
                                  capability.backendOptionIds.includes(
                                    option.id,
                                  ),
                                )
                                .map((option) => {
                                  const active =
                                    binding.backendPreference === option.id;
                                  const disabled =
                                    option.id === "cuda" &&
                                    !cudaProviderReady;
                                  return (
                                    <button
                                      key={`${capability.id}-${option.id}`}
                                      type="button"
                                      aria-label={`Use ${option.label} backend for ${capability.label}`}
                                      onClick={() => {
                                        if (!disabled) {
                                          handleUpdateModelCapabilityBinding(
                                            capability.id,
                                            {
                                              backendPreference: option.id,
                                            },
                                          );
                                        }
                                      }}
                                      disabled={disabled}
                                      title={
                                        disabled
                                          ? "CUDA is unavailable until an NVIDIA-capable sidecar provider is detected."
                                          : option.description
                                      }
                                      className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                                      style={{
                                        border: `1px solid ${active ? accent : border}`,
                                        background: active
                                          ? `${accent}1f`
                                          : "rgba(255,255,255,0.03)",
                                        color: text,
                                        opacity: disabled ? 0.45 : 1,
                                        cursor: disabled
                                          ? "not-allowed"
                                          : "pointer",
                                      }}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                            </div>

                            <div
                              className="text-[10px] opacity-55 lg:col-span-2"
                              style={{ color: muted }}
                            >
                              {selectedModel?.label ?? "No model selected"} ·{" "}
                              {selectedModelStatus?.installed
                                ? "Installed"
                                : "Not warmed"}
                              {selectedModel
                                ? ` · ${formatLocalModelEstimatedFootprint(selectedModel.estimatedFootprintMb)}`
                                : ""}
                            </div>
                          </div>
                        ) : (
                          <div
                            className="mt-2 text-[11px] opacity-55"
                            style={{ color: muted }}
                          >
                            Curated models for this capability have not been
                            published yet. The shared cache and capability
                            binding system is already in place, so this lane can
                            come online without another settings refactor.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </OverviewCard>

              <OverviewCard
                title="Installed Model Catalog"
                subtitle="Curated models stay visible even before they are warmed so operators can see the intended hardware profile, backend bias, and cache footprint before downloading anything."
                badges={[
                  `${localModelDefinitions.length} curated`,
                  "Download on demand",
                  "Shared cache",
                ]}
              >
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {localModelDefinitions.map((model) => {
                    const status = localModelStatusById.get(model.id) ?? null;
                    const hardwareProfile = getLocalModelHardwareProfile(
                      model.hardwareProfileId,
                    );
                    const recommendedBackendLabel =
                      localModelBackendOptions.find(
                        (option) =>
                          option.id === model.recommendedBackendPreference,
                      )?.label ?? model.recommendedBackendPreference;
                    const prewarmDisabled =
                      modelPrewarmPendingId != null &&
                      modelPrewarmPendingId !== model.id;
                    const semanticModelActive =
                      semanticIndexingBinding.modelId === model.id;

                    return (
                      <div
                        key={model.id}
                        className="rounded border p-3"
                        style={{
                          borderColor: semanticModelActive
                            ? `${accent}66`
                            : border,
                          background: semanticModelActive
                            ? `${accent}0f`
                            : "rgba(255,255,255,0.025)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div
                              className="text-[11px] font-semibold"
                              style={{ color: text }}
                            >
                              {model.label}
                            </div>
                            <p className="mt-1 text-[11px] leading-4 opacity-45">
                              {model.description}
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {semanticModelActive ? (
                              <ThemeBadge
                                label="Active Semantic Model"
                                active
                              />
                            ) : null}
                            <ThemeBadge
                              label={
                                status?.installed ? "Installed" : "Not Warmed"
                              }
                              active={status?.installed === true}
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {hardwareProfile ? (
                            <ThemeBadge label={hardwareProfile.label} />
                          ) : null}
                          <ThemeBadge
                            label={`Recommend ${recommendedBackendLabel}`}
                          />
                          <ThemeBadge
                            label={formatLocalModelEstimatedFootprint(
                              model.estimatedFootprintMb,
                            )}
                          />
                          {model.tags.slice(0, 3).map((tag) => (
                            <ThemeBadge
                              key={`${model.id}-${tag}`}
                              label={tag}
                            />
                          ))}
                        </div>

                        <div
                          className="mt-3 rounded border px-3 py-3 text-[10px]"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.02)",
                            color: muted,
                          }}
                        >
                          <div style={{ fontFamily: appearance.fonts.mono }}>
                            {model.providerModelId}
                          </div>
                          <div className="mt-2">
                            Last warmed:{" "}
                            {formatModelTimestamp(status?.lastWarmedAtMs)}
                          </div>
                          <div className="mt-1">
                            Last used:{" "}
                            {formatModelTimestamp(status?.lastUsedAtMs)}
                          </div>
                          {status?.backendKinds.length ? (
                            <div className="mt-2">
                              Backends: {status.backendKinds.join(", ")}
                            </div>
                          ) : null}
                          {status?.providerKinds.length ? (
                            <div className="mt-1">
                              Providers: {status.providerKinds.join(", ")}
                            </div>
                          ) : null}
                          {status?.lastError ? (
                            <div
                              className="mt-2 rounded border px-2 py-1.5"
                              style={{
                                borderColor: "rgba(245,158,11,0.35)",
                                background: "rgba(245,158,11,0.08)",
                                color: text,
                              }}
                            >
                              {status.lastError}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateModelCapabilityBinding(
                                semanticIndexingCapabilityId,
                                { modelId: model.id },
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              border: `1px solid ${semanticModelActive ? accent : border}`,
                              background: semanticModelActive
                                ? `${accent}16`
                                : "rgba(255,255,255,0.03)",
                              color: text,
                            }}
                          >
                            <Bot size={11} />
                            {semanticModelActive
                              ? "Semantic Default"
                              : "Use For Semantic Indexing"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handlePrewarmLocalModel(
                                model.id,
                                model.capabilityIds[0] ??
                                  semanticIndexingCapabilityId,
                                normalizeLocalModelBackendPreference(
                                  model.recommendedBackendPreference,
                                ),
                              )
                            }
                            disabled={prewarmDisabled}
                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              border: `1px solid ${accent}`,
                              background: `${accent}16`,
                              color: text,
                              opacity: prewarmDisabled ? 0.52 : 1,
                            }}
                          >
                            {modelPrewarmPendingId === model.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Download size={11} />
                            )}
                            {status?.installed
                              ? "Rewarm Model"
                              : "Download / Prewarm"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </OverviewCard>

              {semanticIndexingCapability &&
              semanticIndexingCapability.supportsPerRootOverrides ? (
                <OverviewCard
                  title="Semantic Index Root Overrides"
                  subtitle="Pin a specific embedding model and backend for one local root without changing the global semantic default."
                  badges={[
                    "Per-root",
                    "Manual",
                    `${semanticIndexOverrideEntries.length} overrides`,
                  ]}
                >
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div
                      className="rounded border p-3"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.025)",
                      }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Create Override
                      </div>
                      <p className="mt-1 text-[11px] opacity-45">
                        Use this when one project root needs a different
                        embedding quality or a forced CPU/ONNX lane than the
                        rest of the machine.
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <label className="block">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            Root Path
                          </div>
                          <input
                            aria-label="Semantic index override root path"
                            value={semanticOverrideRootPathDraft}
                            onChange={(event) =>
                              setSemanticOverrideRootPathDraft(
                                event.target.value,
                              )
                            }
                            placeholder="/workspace/project"
                            className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                            style={settingsMonoFieldStyle}
                          />
                        </label>

                        <label className="block">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            Model
                          </div>
                          <select
                            aria-label="Semantic index override model"
                            value={semanticOverrideModelIdDraft ?? ""}
                            onChange={(event) =>
                              setSemanticOverrideModelIdDraft(
                                event.target.value || null,
                              )
                            }
                            className="mt-2 w-full rounded border px-3 py-2 text-[11px] outline-none"
                            style={settingsSelectStyle}
                          >
                            {semanticIndexingModels.map((model) => (
                              <option
                                key={`semantic-override-${model.id}`}
                                value={model.id}
                              >
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            Backend
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {localModelBackendOptions
                              .filter((option) =>
                                semanticIndexingCapability.backendOptionIds.includes(
                                  option.id,
                                ),
                              )
                              .map((option) => {
                                const active =
                                  semanticOverrideBackendPreferenceDraft ===
                                  option.id;
                                const disabled =
                                  option.id === "cuda" && !cudaProviderReady;
                                return (
                                  <button
                                    key={`semantic-override-backend-${option.id}`}
                                    type="button"
                                    aria-label={`Use ${option.label} backend for semantic index override`}
                                    onClick={() => {
                                      if (!disabled) {
                                        setSemanticOverrideBackendPreferenceDraft(
                                          option.id,
                                        );
                                      }
                                    }}
                                    disabled={disabled}
                                    className="rounded px-3 py-2 text-left transition-colors"
                                    style={{
                                      border: `1px solid ${active ? accent : border}`,
                                      background: active
                                        ? `${accent}16`
                                        : "rgba(255,255,255,0.03)",
                                      color: text,
                                      opacity: disabled ? 0.45 : 1,
                                      cursor: disabled
                                        ? "not-allowed"
                                        : "pointer",
                                    }}
                                  >
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                                      {option.label}
                                    </div>
                                    <div className="mt-1 text-[10px] leading-4 opacity-55">
                                      {option.description}
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleApplySemanticIndexOverride}
                            disabled={!semanticOverrideRootPathDraft.trim()}
                            className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              border: `1px solid ${accent}`,
                              background: `${accent}16`,
                              color: text,
                              opacity: semanticOverrideRootPathDraft.trim()
                                ? 1
                                : 0.5,
                            }}
                          >
                            <Plus size={11} />
                            Save Override
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded border p-3"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.025)",
                      }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Current Overrides
                      </div>
                      <p className="mt-1 text-[11px] opacity-45">
                        Overrides only affect future semantic index builds and
                        queries for the matching root path.
                      </p>

                      <div className="mt-3 space-y-2">
                        {semanticIndexOverrideEntries.length > 0 ? (
                          semanticIndexOverrideEntries.map(
                            ([rootPath, binding]) => {
                              const overrideModel =
                                getLocalModelDefinition(binding.modelId) ??
                                getLocalModelDefinitionByProviderModelId(
                                  binding.modelId,
                                );
                              const backendLabel =
                                localModelBackendOptions.find(
                                  (option) =>
                                    option.id === binding.backendPreference,
                                )?.label ?? binding.backendPreference;
                              return (
                                <div
                                  key={`semantic-override-entry-${rootPath}`}
                                  className="rounded border px-3 py-3"
                                  style={{
                                    borderColor: border,
                                    background: "rgba(255,255,255,0.02)",
                                  }}
                                >
                                  <div
                                    className="break-all text-[10px]"
                                    style={{
                                      color: muted,
                                      fontFamily: appearance.fonts.mono,
                                    }}
                                  >
                                    {rootPath}
                                  </div>
                                  <div
                                    className="mt-2 text-[11px]"
                                    style={{ color: text }}
                                  >
                                    {overrideModel?.label ??
                                      binding.modelId ??
                                      "No model"}{" "}
                                    · {backendLabel}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSemanticOverrideRootPathDraft(
                                          rootPath,
                                        );
                                        setSemanticOverrideModelIdDraft(
                                          binding.modelId,
                                        );
                                        setSemanticOverrideBackendPreferenceDraft(
                                          binding.backendPreference,
                                        );
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                      style={{
                                        border: `1px solid ${border}`,
                                        background: "rgba(255,255,255,0.03)",
                                        color: text,
                                      }}
                                    >
                                      <Bot size={11} />
                                      Load Into Editor
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRemoveSemanticIndexOverride(
                                          rootPath,
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                                      style={{
                                        border: `1px solid ${border}`,
                                        background: "rgba(255,255,255,0.03)",
                                        color: text,
                                      }}
                                    >
                                      <Trash2 size={11} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            },
                          )
                        ) : (
                          <div
                            className="rounded border px-3 py-3 text-[11px] opacity-45"
                            style={{
                              borderColor: border,
                              background: "rgba(255,255,255,0.02)",
                            }}
                          >
                            No semantic root overrides yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </OverviewCard>
              ) : null}
            </div>
          </section>
        )}

        {activeSection === "appearance" && (
          <AppearanceSettingsSection
            appearance={appearance}
            themePackageLookup={themePackageLookup}
            themePackagesDirectory={themePackagesDirectory}
            themePackagesCount={themePackages.length}
            themePackagesLoading={themePackagesLoading}
            themePackagesError={themePackagesError}
            themePackagesWarnings={themePackagesWarnings}
            editableTheme={editableTheme}
            appAppearanceName={appAppearance.baseTheme.name}
            dockAppearanceName={dockAppearance.baseTheme.name}
            activeThemeId={settings.appearance.activeThemeId}
            activeDockThemeId={settings.appearance.activeDockThemeId}
            dockThemeMode={settings.appearance.dockThemeMode}
            uiFontFamily={settings.appearance.uiFontFamily}
            appOpacity={settings.appearance.appOpacity}
            panelTransparency={settings.appearance.panelTransparency}
            appBlurStrength={settings.appearance.appBlurStrength}
            appZoom={settings.appearance.appZoom}
            appBlur={settings.appearance.appBlur}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
            onOpenThemesFolder={onOpenThemesFolder}
            onRefreshThemes={onRefreshThemes}
            onApplyThemeSelection={applyThemeSelection}
            onApplyDockThemeSelection={applyDockThemeSelection}
            onUpdateAppearance={updateAppearance}
            onUpdateThemePalette={updateThemePalette}
            createThemeCardMotion={bindSettingsCardMotion}
          />
        )}

        {activeSection === "appearance-packs" && (
          <ThemeBundlePackSettingsSection
            icon={<Sparkles size={12} />}
            title="Appearance Packs"
            subtitle="Palette, typography, visuals, and CSS-var identity packs that can follow the active theme bundle or stay pinned independently."
            catalogTitle="Appearance Pack Catalog"
            catalogDescription={
              <>
                Standalone appearance packs now live in{" "}
                <code>{appearancePacksDirectory}</code>. Theme bundles can still
                contribute local packs, so users can swap palette, fonts, and
                atmosphere without rebuilding the entire theme package.
              </>
            }
            directoryPath={appearancePacksDirectory}
            currentLabel={appearancePackSelectionLabel}
            modeLabel={
              settings.appearance.activeAppearancePackId == null
                ? "Follow Theme"
                : "Pinned"
            }
            loading={appearancePacksLoading}
            catalogCountLabel={`${availableAppearancePackEntries.length} pack${availableAppearancePackEntries.length === 1 ? "" : "s"}`}
            standaloneCount={appearancePackCatalogCounts.standaloneCount}
            themeContributedCount={
              appearancePackCatalogCounts.themeContributedCount
            }
            followThemeDetail={appearancePackFollowThemeDetail}
            followThemeDescription="Let the active theme bundle choose the appearance pack. Palette, typography, visuals, and CSS vars continue to resolve from the current theme composition."
            followThemeResolvedLabel={appearancePackThemeDefaultLabel}
            followThemeSourceLabel={activeThemeBundleLabel}
            followThemeActive={
              settings.appearance.activeAppearancePackId == null
            }
            activeOptionId={activeAppearancePackCardId}
            options={appearancePackCardOptions}
            emptyCatalogMessage="No standalone or theme-contributed appearance packs are available yet."
            pinnedSelectionMissingMessage={
              appearancePackPinnedSelectionMissing
                ? `The pinned appearance pack id ${settings.appearance.activeAppearancePackId} is no longer available, so the shell is temporarily following the active theme bundle until you pin another one.`
                : null
            }
            error={appearancePacksError}
            errorLabel="Appearance-pack scan failed"
            warnings={appearancePacksWarnings}
            warningsLabel="Appearance-pack warnings"
            onFollowTheme={() =>
              updateAppearance({ activeAppearancePackId: null })
            }
            onSelect={(packId) =>
              updateAppearance({ activeAppearancePackId: packId })
            }
            onRefresh={onRefreshAppearancePacks}
            onOpenFolder={onOpenAppearancePacksFolder}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
          />
        )}

        {activeSection === "theme-recipes" && (
          <ThemeBundlePackSettingsSection
            icon={<LayoutGrid size={12} />}
            title="Theme Recipes"
            subtitle="Workbench, explorer, and dock recipe packs that can follow the active theme bundle or stay pinned independently."
            catalogTitle="Theme Recipe Catalog"
            catalogDescription={
              <>
                Standalone theme recipe packs now live in{" "}
                <code>{themeRecipePacksDirectory}</code>. Theme bundles can
                still contribute local recipe packs, so users can swap
                workbench, explorer, and dock presentation lanes independently
                from palette or renderer choices.
              </>
            }
            directoryPath={themeRecipePacksDirectory}
            currentLabel={themeRecipeSelectionLabel}
            modeLabel={
              settings.appearance.activeThemeRecipeId == null
                ? "Follow Theme"
                : "Pinned"
            }
            loading={themeRecipePacksLoading}
            catalogCountLabel={`${availableRecipePackEntries.length} pack${availableRecipePackEntries.length === 1 ? "" : "s"}`}
            standaloneCount={themeRecipeCatalogCounts.standaloneCount}
            themeContributedCount={
              themeRecipeCatalogCounts.themeContributedCount
            }
            followThemeDetail={themeRecipeFollowThemeDetail}
            followThemeDescription="Let the active theme bundle choose the recipe pack. Workbench, explorer, and dock recipes continue to resolve from the current bundle composition."
            followThemeResolvedLabel={themeRecipeThemeDefaultLabel}
            followThemeSourceLabel={activeThemeBundleLabel}
            followThemeActive={settings.appearance.activeThemeRecipeId == null}
            activeOptionId={activeThemeRecipeCardId}
            options={themeRecipeCardOptions}
            emptyCatalogMessage="No standalone or theme-contributed recipe packs are available yet."
            pinnedSelectionMissingMessage={
              themeRecipePinnedSelectionMissing
                ? `The pinned theme recipe id ${settings.appearance.activeThemeRecipeId} is no longer available, so the shell is temporarily following the active theme bundle until you pin another one.`
                : null
            }
            error={themeRecipePacksError}
            errorLabel="Theme-recipe scan failed"
            warnings={themeRecipePacksWarnings}
            warningsLabel="Theme-recipe warnings"
            onFollowTheme={() =>
              updateAppearance({ activeThemeRecipeId: null })
            }
            onSelect={(packId) =>
              updateAppearance({ activeThemeRecipeId: packId })
            }
            onRefresh={onRefreshThemeRecipePacks}
            onOpenFolder={onOpenThemeRecipesFolder}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
          />
        )}

        {activeSection === "theme-engines" && (
          <ThemeBundlePackSettingsSection
            icon={<Cpu size={12} />}
            title="Theme Engines"
            subtitle="Design tokens, render styles, navigation/layout primitives, and engine-default packs that can follow the active theme bundle or stay pinned."
            catalogTitle="Theme Engine Catalog"
            catalogDescription={
              <>
                Standalone theme engine packs now live in{" "}
                <code>{themeEnginePacksDirectory}</code>. Theme bundles can
                still contribute local engines, so users can swap token graphs,
                render styles, and engine defaults without changing the entire
                bundle.
              </>
            }
            directoryPath={themeEnginePacksDirectory}
            currentLabel={themeEngineSelectionLabel}
            modeLabel={
              settings.appearance.activeThemeEngineId == null
                ? "Follow Theme"
                : "Pinned"
            }
            loading={themeEnginePacksLoading}
            catalogCountLabel={`${availableThemeEngineEntries.length} pack${availableThemeEngineEntries.length === 1 ? "" : "s"}`}
            standaloneCount={themeEngineCatalogCounts.standaloneCount}
            themeContributedCount={
              themeEngineCatalogCounts.themeContributedCount
            }
            followThemeDetail={themeEngineFollowThemeDetail}
            followThemeDescription="Let the active theme bundle choose the engine pack. Design tokens, render styles, layout primitives, navigation patterns, and engine defaults stay aligned to the current theme composition."
            followThemeResolvedLabel={themeEngineThemeDefaultLabel}
            followThemeSourceLabel={activeThemeBundleLabel}
            followThemeActive={settings.appearance.activeThemeEngineId == null}
            activeOptionId={activeThemeEngineCardId}
            options={themeEngineCardOptions}
            emptyCatalogMessage="No standalone or theme-contributed theme engines are available yet."
            pinnedSelectionMissingMessage={
              themeEnginePinnedSelectionMissing
                ? `The pinned theme engine id ${settings.appearance.activeThemeEngineId} is no longer available, so the shell is temporarily following the active theme bundle until you pin another one.`
                : null
            }
            error={themeEnginePacksError}
            errorLabel="Theme-engine scan failed"
            warnings={themeEnginePacksWarnings}
            warningsLabel="Theme-engine warnings"
            onFollowTheme={() =>
              updateAppearance({ activeThemeEngineId: null })
            }
            onSelect={(packId) =>
              updateAppearance({ activeThemeEngineId: packId })
            }
            onRefresh={onRefreshThemeEnginePacks}
            onOpenFolder={onOpenThemeEnginesFolder}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
          />
        )}

        {activeSection === "shell-renderers" && (
          <ThemeBundlePackSettingsSection
            icon={<MonitorPlay size={12} />}
            title="Shell Renderers"
            subtitle="Renderer modules that can follow the active theme bundle or stay pinned independently."
            catalogTitle="Shell Renderer Catalog"
            catalogDescription={
              <>
                Standalone shell renderers now live in{" "}
                <code>{shellRenderersDirectory}</code>. Theme bundles can still
                contribute local renderers, so users can pin a different runtime
                shell renderer without discarding the current theme bundle.
              </>
            }
            directoryPath={shellRenderersDirectory}
            currentLabel={shellRendererSelectionLabel}
            modeLabel={
              settings.appearance.activeShellRendererId == null
                ? "Follow Theme"
                : "Pinned"
            }
            loading={shellRenderersLoading}
            catalogCountLabel={`${availableShellRendererEntries.length} renderer${availableShellRendererEntries.length === 1 ? "" : "s"}`}
            standaloneCount={shellRendererCatalogCounts.standaloneCount}
            themeContributedCount={
              shellRendererCatalogCounts.themeContributedCount
            }
            followThemeDetail={shellRendererFollowThemeDetail}
            followThemeDescription="Let the active theme bundle choose the renderer lane. If the bundle omits a renderer, the shell falls back to the built-in workbench runtime."
            followThemeResolvedLabel={shellRendererThemeDefaultLabel}
            followThemeSourceLabel={activeThemeBundleLabel}
            followThemeActive={
              settings.appearance.activeShellRendererId == null
            }
            activeOptionId={activeShellRendererCardId}
            options={shellRendererCardOptions}
            emptyCatalogMessage="No standalone or theme-contributed shell renderers are available yet."
            pinnedSelectionMissingMessage={
              shellRendererPinnedSelectionMissing
                ? `The pinned shell renderer id ${settings.appearance.activeShellRendererId} is no longer available, so the shell is temporarily following the active theme bundle until you pin another one.`
                : null
            }
            error={shellRenderersError}
            errorLabel="Shell-renderer scan failed"
            warnings={shellRenderersWarnings}
            warningsLabel="Shell-renderer warnings"
            onFollowTheme={() =>
              updateAppearance({ activeShellRendererId: null })
            }
            onSelect={(packId) =>
              updateAppearance({ activeShellRendererId: packId })
            }
            onRefresh={onRefreshShellRenderers}
            onOpenFolder={onOpenShellRenderersFolder}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
          />
        )}

        {activeSection === "top-bars" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<SlidersHorizontal size={12} />}
              title="Top Bars"
              subtitle="Standalone shell chrome workflows that can follow theme defaults or stay pinned independently."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Top Bar Catalog
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Top bars now have their own authored storage root in{" "}
                      <code>{topBarPackagesDirectory}</code>. Built-ins always
                      stay available, standalone top-bar packages live there,
                      and theme bundles in <code>{themePackagesDirectory}</code>{" "}
                      can still contribute additional shell chrome workflows
                      without forcing users to swap the entire theme.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onRefreshTopBars()}
                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        border: `1px solid ${border}`,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      <RefreshCw size={10} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => void onOpenTopBarsFolder()}
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        border: `1px solid ${accent}`,
                        background: `${accent}18`,
                        color: text,
                      }}
                    >
                      Open Top Bars Folder
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    Current: {resolvedTopBarSelection.topBar.name}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    Mode:{" "}
                    {settings.appearance.activeTopBarId == null
                      ? "Follow Theme"
                      : "Pinned"}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    {topBarCatalogLoading
                      ? "Scanning Catalog"
                      : `Catalog: ${availableTopBars.length} top bars`}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    Standalone: {authoredTopBarCount}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    Theme Contributed: {themeContributedTopBarCount}
                  </span>
                </div>

                <div
                  className="mt-3 rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: `${accent}33`,
                    background: `${accent}10`,
                    color: text,
                  }}
                >
                  {followThemeTopBarDetail}
                </div>

                <div
                  className="mt-3 rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                    color: muted,
                  }}
                >
                  Standalone top bars refresh from{" "}
                  <code>{topBarPackagesDirectory}</code>. Theme-contributed top
                  bars still refresh from the theme bundle pipeline in{" "}
                  <code>{themePackagesDirectory}</code>.
                </div>

                {topBarPackagesError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#7f1d1d",
                      background: "rgba(127,29,29,0.18)",
                      color: "#fecaca",
                    }}
                  >
                    Top-bar package scan failed: {topBarPackagesError}
                  </div>
                ) : null}

                {topBarPackagesWarnings.length > 0 ? (
                  <div
                    className="mt-3 rounded border px-3 py-3 text-[11px]"
                    style={{
                      borderColor: "#854d0e",
                      background: "rgba(133,77,14,0.18)",
                      color: "#fde68a",
                    }}
                  >
                    <div className="font-semibold uppercase tracking-[0.12em]">
                      Top-bar warnings
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {topBarPackagesWarnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {resolvedTopBarSelection.explicitSelectionMissing ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#854d0e",
                      background: "rgba(133,77,14,0.18)",
                      color: "#fde68a",
                    }}
                  >
                    The pinned top bar id{" "}
                    <code>{settings.appearance.activeTopBarId}</code> is no
                    longer available, so the shell is temporarily following the
                    active theme fallback until you pin another one.
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Selection
                </label>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => updateAppearance({ activeTopBarId: null })}
                    className="w-full rounded border p-3 text-left transition-colors"
                    style={{
                      borderColor:
                        settings.appearance.activeTopBarId == null
                          ? accent
                          : border,
                      background:
                        settings.appearance.activeTopBarId == null
                          ? `${accent}12`
                          : "rgba(255,255,255,0.03)",
                      color: text,
                      boxShadow:
                        settings.appearance.activeTopBarId == null
                          ? `inset 0 0 0 1px ${accent}22`
                          : "none",
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold">
                          Follow Theme
                        </div>
                        <div className="mt-1 text-[11px] leading-4 opacity-55">
                          Let the current app theme choose the top bar. Theme
                          packages can publish explicit defaults, and older
                          themes still map through the legacy workbench top-bar
                          style fallback.
                        </div>
                      </div>
                      {settings.appearance.activeTopBarId == null ? (
                        <ThemeBadge label="Active" active />
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <ThemeBadge
                        label={`Resolved ${resolvedTopBarSelection.topBar.name}`}
                        active={settings.appearance.activeTopBarId == null}
                      />
                      <ThemeBadge label={appearance.baseTheme.name} />
                      <ThemeBadge
                        label={
                          resolvedTopBarSelection.resolvedFrom ===
                          "theme-default"
                            ? "Theme Default"
                            : resolvedTopBarSelection.resolvedFrom ===
                                "theme-legacy-style"
                              ? "Legacy Fallback"
                              : "Built-In Fallback"
                        }
                      />
                    </div>
                  </button>

                  {availableTopBars.map((topBar) => (
                    <TopBarCatalogCard
                      key={topBar.id}
                      topBar={topBar}
                      active={settings.appearance.activeTopBarId === topBar.id}
                      border={border}
                      accent={accent}
                      text={text}
                      muted={muted}
                      onClick={() =>
                        updateAppearance({ activeTopBarId: topBar.id })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "icons" && (
          <IconSettingsSection
            iconThemePackagesDirectory={iconThemePackagesDirectory}
            iconThemePackages={iconThemePackages}
            iconThemePackagesLoading={iconThemePackagesLoading}
            iconThemePackagesError={iconThemePackagesError}
            iconThemePackagesWarnings={iconThemePackagesWarnings}
            activeIconThemePackage={activeIconThemePackage}
            normalizedActiveIconThemeId={normalizedActiveIconThemeId}
            themeIconTheme={themeIconTheme}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
            platformLabel={platformLabel}
            filteredFolderIconOptions={filteredFolderIconOptions}
            folderIconSearch={folderIconSearch}
            onFolderIconSearchChange={setFolderIconSearch}
            useNativeOsIcons={settings.appearance.useNativeOsIcons}
            defaultFolderIcon={settings.explorer.defaultFolderIcon}
            folderIconRules={settings.explorer.folderIconRules}
            onRefreshIconThemes={onRefreshIconThemes}
            onOpenIconThemesFolder={onOpenIconThemesFolder}
            onApplyIconThemeSelection={applyIconThemeSelection}
            onToggleNativeOsIcons={(enabled) =>
              updateAppearance({ useNativeOsIcons: enabled })
            }
            onRestoreFolderRules={() =>
              updateExplorer({
                folderIconRules: createDefaultFolderIconRules(),
              })
            }
            onSetDefaultFolderIcon={(icon) =>
              updateExplorer({ defaultFolderIcon: icon })
            }
            onUpdateFolderRule={updateFolderRule}
            onRemoveFolderRule={removeFolderRule}
            onAddFolderRule={addFolderRule}
            settingsMonoFieldStyle={settingsMonoFieldStyle}
            settingsMonoSelectStyle={settingsMonoSelectStyle}
          />
        )}

        {activeSection === "wallpapers" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<MonitorPlay size={12} />}
              title="Wallpapers"
              subtitle="Theme-backed wallpaper defaults, user overrides, and authored live backgrounds that still stack with shader passes."
            />

            <input
              ref={wallpaperFileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.mp4,.webm,.mov,.m4v,.ogv,.ts,.tsx,.js,.jsx"
              multiple
              hidden
              onChange={(event) => {
                void handleWallpaperFileSelection(event);
              }}
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Wallpaper Stack
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Wallpapers render as the base pass. Theme gradients, theme
                      visuals, and shader surfaces stay above them, so animated
                      backgrounds and shader atmospherics can run together
                      instead of competing.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: accent,
                      background: `${accent}14`,
                      color: accent,
                    }}
                  >
                    {wallpaperSelectionSummary}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <div className="opacity-45">
                    {availableWallpapers.length} ready wallpapers
                    {themeWallpaperAvailable
                      ? " · theme wallpaper available"
                      : ""}
                    {wallpaperFailures.length > 0
                      ? ` · ${wallpaperFailures.length} failed loads`
                      : ""}
                    {wallpapersLoading ? " · refreshing…" : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onRefreshWallpapers()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <RefreshCw size={12} />
                      Refresh Wallpapers
                    </button>
                    <button
                      type="button"
                      onClick={triggerWallpaperImport}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: accent,
                        background: `${accent}16`,
                        color: text,
                      }}
                    >
                      <Plus size={12} />
                      Import Files
                    </button>
                    <button
                      type="button"
                      onClick={() => void onOpenWallpapersFolder()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: accent,
                        background: `${accent}16`,
                        color: text,
                      }}
                    >
                      <FolderOpen size={12} />
                      Open Folder
                    </button>
                  </div>
                </div>

                <div
                  className="mt-3 rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                    Authoring Folder
                  </div>
                  <div className="mt-1 break-all opacity-55">
                    {wallpapersDirectory}
                  </div>
                  {wallpapersError ? (
                    <div
                      className="mt-2 rounded border px-2 py-1.5 text-[10px]"
                      style={{
                        borderColor: "rgba(245,158,11,0.35)",
                        background: "rgba(245,158,11,0.08)",
                        color: text,
                      }}
                    >
                      {wallpapersError}
                    </div>
                  ) : null}
                </div>

                {wallpaperNotice ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: `${accent}44`,
                      background: `${accent}12`,
                      color: text,
                    }}
                  >
                    {wallpaperNotice}
                  </div>
                ) : null}
                {wallpaperImportError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#7f1d1d",
                      background: "rgba(127,29,29,0.18)",
                      color: "#fecaca",
                    }}
                  >
                    {wallpaperImportError}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_0.75fr]">
                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Live Assignment
                      </div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Following the theme keeps wallpaper selection inside the
                        theme system. A user override swaps only the base
                        wallpaper layer and leaves theme visuals plus shader
                        treatments intact.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: accent,
                        background: `${accent}14`,
                        color: accent,
                      }}
                    >
                      {getOverlayWallpaperFitModeLabel(
                        settings.appearance.wallpaperFitMode,
                      )}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateAppearance({ activeWallpaperId: null })
                      }
                      className="overflow-hidden rounded text-left transition-colors"
                      style={{
                        border: `1px solid ${activeWallpaperSelectionId == null ? accent : border}`,
                        background:
                          activeWallpaperSelectionId == null
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <div
                        className="h-24 w-full"
                        style={{
                          backgroundImage: editableTheme.assets?.backgroundUrl
                            ? `linear-gradient(180deg, rgba(5,10,18,0.18), rgba(5,10,18,0.72)), url("${editableTheme.assets.backgroundUrl}")`
                            : `linear-gradient(135deg, ${editableTheme.palette.appBackgroundAlt}, ${editableTheme.palette.appBackground})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                      <div className="space-y-1 px-3 py-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold">
                          <Palette size={13} />
                          <span>Follow Theme Wallpaper</span>
                        </div>
                        <p className="text-[10px] leading-4 opacity-55">
                          {themeWallpaperAvailable
                            ? `Use ${editableTheme.name}'s packaged wallpaper asset as the base render layer.`
                            : `${editableTheme.name} does not currently ship a wallpaper asset, so the base layer stays empty.`}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateAppearance({
                          activeWallpaperId:
                            wallpaperSystemConfig.noneWallpaperId,
                        })
                      }
                      className="overflow-hidden rounded text-left transition-colors"
                      style={{
                        border: `1px solid ${activeWallpaperSelectionId === wallpaperSystemConfig.noneWallpaperId ? accent : border}`,
                        background:
                          activeWallpaperSelectionId ===
                          wallpaperSystemConfig.noneWallpaperId
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <div
                        className="flex h-24 w-full items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${editableTheme.palette.appBackgroundAlt}, ${editableTheme.palette.panelBackground})`,
                        }}
                      >
                        <Image size={28} style={{ color: muted }} />
                      </div>
                      <div className="space-y-1 px-3 py-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold">
                          <Image size={13} />
                          <span>Disable Wallpaper Layer</span>
                        </div>
                        <p className="text-[10px] leading-4 opacity-55">
                          Keep the shell on theme gradients, theme visuals, and
                          shaders without any wallpaper asset at the base.
                        </p>
                      </div>
                    </button>

                    {availableWallpapers.map((wallpaper) => {
                      const active =
                        activeWallpaperSelectionId === wallpaper.id;
                      const previewBackground = wallpaper.previewUrl
                        ? `linear-gradient(180deg, rgba(5,10,18,0.14), rgba(5,10,18,0.72)), url("${wallpaper.previewUrl}")`
                        : `linear-gradient(135deg, ${editableTheme.palette.appBackgroundAlt}, ${editableTheme.palette.panelBackground})`;
                      return (
                        <button
                          key={wallpaper.id}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              activeWallpaperId: wallpaper.id,
                            })
                          }
                          className="overflow-hidden rounded text-left transition-colors"
                          style={{
                            border: `1px solid ${active ? accent : border}`,
                            background: active
                              ? `${accent}12`
                              : "rgba(255,255,255,0.03)",
                            color: text,
                          }}
                        >
                          <div
                            className="relative h-24 w-full"
                            style={{
                              backgroundImage: previewBackground,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          >
                            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2">
                              <ThemeBadge
                                label={getOverlayWallpaperKindLabel(
                                  wallpaper.kind,
                                )}
                                active={active}
                              />
                              <ThemeBadge
                                label={
                                  wallpaper.source === "theme-asset"
                                    ? "Theme"
                                    : "Library"
                                }
                              />
                            </div>
                            {!wallpaper.previewUrl ? (
                              <div className="absolute inset-0 flex items-center justify-center">
                                {wallpaper.kind === "video" ? (
                                  <MonitorPlay
                                    size={28}
                                    style={{ color: muted }}
                                  />
                                ) : wallpaper.kind === "live" ? (
                                  <Sparkles
                                    size={28}
                                    style={{ color: muted }}
                                  />
                                ) : (
                                  <Image size={28} style={{ color: muted }} />
                                )}
                              </div>
                            ) : null}
                          </div>
                          <div className="space-y-1 px-3 py-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold">
                              <span>{wallpaper.name}</span>
                              {active ? (
                                <ThemeBadge label="Live" active />
                              ) : null}
                            </div>
                            <p className="text-[10px] leading-4 opacity-55">
                              {wallpaper.description ??
                                `${getOverlayWallpaperKindLabel(wallpaper.kind)} wallpaper from ${wallpaper.source === "theme-asset" ? "the active theme" : "the wallpaper library"}.`}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <ThemeBadge label={wallpaper.group} />
                              {wallpaper.tags.slice(0, 2).map((tag) => (
                                <ThemeBadge
                                  key={`${wallpaper.id}-${tag}`}
                                  label={tag}
                                />
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.025)",
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Wallpaper Controls
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      These controls apply to both theme-provided wallpapers and
                      user overrides.
                    </p>
                    <div className="mt-3 space-y-2">
                      <RangeField
                        label="Wallpaper Opacity"
                        description="Fade the wallpaper base layer without turning off shader or theme passes above it."
                        min={overlayVisualControls.opacity.min}
                        max={overlayVisualControls.opacity.max}
                        step={overlayVisualControls.opacity.step}
                        value={settings.appearance.wallpaperOpacity}
                        valueLabel={formatOverlayVisualControlValue(
                          "opacity",
                          settings.appearance.wallpaperOpacity,
                        )}
                        onChange={(value) =>
                          updateAppearance({
                            wallpaperOpacity: clampOverlayVisualControlValue(
                              "opacity",
                              value,
                            ),
                          })
                        }
                      />

                      <div
                        className="rounded border p-3"
                        style={{
                          borderColor:
                            "var(--overlay-workbench-settings-card-border)",
                          background:
                            "var(--overlay-workbench-settings-card-bg)",
                        }}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          Wallpaper Fit
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {overlayWallpaperFitModes.map((mode) => {
                            const active =
                              settings.appearance.wallpaperFitMode === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() =>
                                  updateAppearance({
                                    wallpaperFitMode: mode.id,
                                  })
                                }
                                className="rounded px-3 py-2 text-left transition-colors"
                                style={{
                                  border: `1px solid ${active ? accent : border}`,
                                  background: active
                                    ? `${accent}14`
                                    : "rgba(255,255,255,0.03)",
                                  color: text,
                                }}
                              >
                                <div className="text-[11px] font-semibold">
                                  {mode.label}
                                </div>
                                <div className="mt-1 text-[10px] leading-4 opacity-55">
                                  {mode.description}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label
                        className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                        style={{ borderColor: border }}
                      >
                        <div>
                          <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                            Mute Wallpaper Audio
                          </div>
                          <p className="mt-1 text-[11px] opacity-40">
                            Keep imported video or live wallpapers silent unless
                            you explicitly want sound in the shell.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <VolumeX size={14} style={{ color: muted }} />
                          <input
                            type="checkbox"
                            checked={settings.appearance.wallpaperMuted}
                            onChange={(event) =>
                              updateAppearance({
                                wallpaperMuted: event.target.checked,
                              })
                            }
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  {wallpaperFailures.length > 0 ? (
                    <div
                      className="rounded border p-3"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.025)",
                      }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Load Errors
                      </div>
                      <div className="mt-3 space-y-2">
                        {wallpaperFailures.map((wallpaper) => (
                          <div
                            key={`wallpaper-error-${wallpaper.filePath}`}
                            className="rounded border px-3 py-2"
                            style={{
                              borderColor: "rgba(245,158,11,0.35)",
                              background: "rgba(245,158,11,0.08)",
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold">
                                {wallpaper.name}
                              </div>
                              <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">
                                Load Error
                              </span>
                            </div>
                            <div className="mt-1 break-all text-[10px] opacity-55">
                              {wallpaper.filePath}
                            </div>
                            <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">
                              {wallpaper.error}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "shaders" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<Sparkles size={12} />}
              title="Shaders"
              subtitle="Dedicated shell shader profiles with a separate authoring/runtime path from motion."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Shader Catalog
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Shader authoring lives in its own catalog now. Use this
                      page to browse built-ins plus folder-authored profiles,
                      inspect load failures, and choose whether the shell stays
                      in performance mode, follows the theme default, or uses a
                      user override.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    Shader
                  </span>
                </div>

                <div
                  className="mt-3 rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Shader Performance Mode
                      </div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Performance is the default. Balanced restores theme
                        shader defaults with a capped preview budget. Quality
                        spends more on the preview host when you want fidelity
                        over throughput.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: accent,
                        background: `${accent}14`,
                        color: accent,
                      }}
                    >
                      {shaderPerformanceProfile.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    {shaderPerformanceProfiles.map((profile) => {
                      const active = profile.id === shaderPerformanceMode;
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() =>
                            updateAppearance({
                              shaderPerformanceMode: profile.id,
                            })
                          }
                          className="rounded px-3 py-2 text-left transition-colors"
                          style={{
                            border: `1px solid ${active ? accent : border}`,
                            background: active
                              ? `${accent}16`
                              : "rgba(255,255,255,0.03)",
                            color: text,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold">
                              {profile.label}
                            </span>
                            {active ? (
                              <span
                                className="text-[9px] uppercase tracking-[0.14em]"
                                style={{ color: accent }}
                              >
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] opacity-45">
                            {profile.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <div className="opacity-45">
                    {availableShaders.length} ready profiles
                    {shaderFailures.length > 0
                      ? ` · ${shaderFailures.length} failed loads`
                      : ""}
                    {shadersLoading ? " · refreshing…" : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void onRefreshShaders()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <RefreshCw size={12} />
                      Refresh Shaders
                    </button>
                    <button
                      onClick={() => void onOpenShadersFolder()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: accent,
                        background: `${accent}16`,
                        color: text,
                      }}
                    >
                      <FolderOpen size={12} />
                      Open Folder
                    </button>
                  </div>
                </div>

                <div
                  className="mt-3 rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                    Authoring Folder
                  </div>
                  <div className="mt-1 break-all opacity-55">
                    {shadersDirectory}
                  </div>
                  {shadersError && (
                    <div
                      className="mt-2 rounded border px-2 py-1.5 text-[10px]"
                      style={{
                        borderColor: "rgba(245,158,11,0.35)",
                        background: "rgba(245,158,11,0.08)",
                        color: text,
                      }}
                    >
                      {shadersError}
                    </div>
                  )}
                </div>

                {shaderFailures.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {shaderFailures.map((shader) => (
                      <div
                        key={`shader-error-${shader.filePath}`}
                        className="rounded border px-3 py-2"
                        style={{
                          borderColor: "rgba(245,158,11,0.35)",
                          background: "rgba(245,158,11,0.08)",
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold">
                            {shader.name}
                          </div>
                          <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">
                            Load Error
                          </span>
                        </div>
                        <div className="mt-1 break-all text-[10px] opacity-55">
                          {shader.filePath}
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">
                          {shader.error}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Live Assignment
                      </div>
                      <p className="mt-1 text-[11px] opacity-40">
                        A user override wins over the active theme. Clearing the
                        override hands control back to the theme default when
                        performance mode allows it, and unresolved IDs collapse
                        safely to <code>none</code>.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: accent,
                        background: `${accent}14`,
                        color: accent,
                      }}
                    >
                      {shaderSelectionSummary}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateAppearance({
                          activeShaderId: null,
                          shaderPerformanceMode: "balanced",
                        })
                      }
                      className="rounded px-3 py-2 text-left transition-colors"
                      aria-pressed={
                        settings.appearance.activeShaderId == null &&
                        shaderPerformanceProfile.shellUsesThemeDefault &&
                        Boolean(editableTheme.defaultShaderId)
                      }
                      style={{
                        border: `1px solid ${settings.appearance.activeShaderId == null && shaderPerformanceProfile.shellUsesThemeDefault && Boolean(editableTheme.defaultShaderId) ? accent : border}`,
                        background:
                          settings.appearance.activeShaderId == null &&
                          shaderPerformanceProfile.shellUsesThemeDefault &&
                          Boolean(editableTheme.defaultShaderId)
                            ? `${accent}16`
                            : "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold">
                          Follow Theme Default
                        </span>
                        <span
                          className="text-[9px] uppercase tracking-[0.14em]"
                          style={{
                            color:
                              settings.appearance.activeShaderId == null &&
                              shaderPerformanceProfile.shellUsesThemeDefault &&
                              Boolean(editableTheme.defaultShaderId)
                                ? accent
                                : muted,
                          }}
                        >
                          {editableTheme.defaultShaderId ?? "none"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-45">
                        {editableTheme.defaultShaderId
                          ? `Active theme ${editableTheme.name} defaults to ${editableTheme.defaultShaderId}.`
                          : `Active theme ${editableTheme.name} does not define a shader, so the shell falls back to none.`}
                        {!shaderPerformanceProfile.shellUsesThemeDefault
                          ? " Performance mode keeps the theme default suspended until you switch to Balanced or Quality."
                          : ""}
                      </p>
                    </button>

                    {availableShaders.map((shader) => {
                      const overrideActive =
                        settings.appearance.activeShaderId === shader.id;
                      const effectiveActive = effectiveShaderId === shader.id;
                      const surfaceSummary = getShaderEnabledSurfaceIds(shader)
                        .map((surface) => getOverlayShaderSurfaceLabel(surface))
                        .join(" · ");
                      return (
                        <button
                          key={`shader-${shader.id}`}
                          type="button"
                          onClick={() =>
                            updateAppearance({ activeShaderId: shader.id })
                          }
                          className="rounded px-3 py-2 text-left transition-colors"
                          style={{
                            border: `1px solid ${overrideActive ? accent : border}`,
                            background: overrideActive
                              ? `${accent}16`
                              : "rgba(255,255,255,0.03)",
                            color: text,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold">
                              {shader.name}
                            </span>
                            <span
                              className="text-[9px] uppercase tracking-[0.14em]"
                              style={{ color: overrideActive ? accent : muted }}
                            >
                              {shader.group}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] opacity-45">
                            {shader.description ?? "Shell shader profile."}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.12em] opacity-55">
                            <span>{surfaceSummary || "No Surfaces"}</span>
                            {shader.controls.length > 0 && (
                              <span>{shader.controls.length} Controls</span>
                            )}
                            {effectiveActive && (
                              <span style={{ color: accent }}>Live</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.025)",
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Effective Shader
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-semibold">
                          {effectiveShader?.name ?? "None"}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {effectiveShader?.description ??
                            "No shader surfaces are currently active."}
                        </p>
                      </div>
                      <span
                        className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
                        style={{ borderColor: border, color: muted }}
                      >
                        {effectiveShader?.id ?? "none"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.12em]">
                      {(effectiveShader?.tags ?? []).map((tag) => (
                        <span
                          key={`shader-tag-${tag}`}
                          className="rounded border px-2 py-1"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.03)",
                            color: muted,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                      {(effectiveShader?.tags ?? []).length === 0 && (
                        <span className="opacity-45">No metadata tags</span>
                      )}
                    </div>
                  </div>

                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.025)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          Shader Controls
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          Shaders can expose their own live tweak set. Overrides
                          are stored per shader, so changing profiles does not
                          wipe a tuned setup for another one.
                        </p>
                      </div>
                      {effectiveShader &&
                        effectiveShader.controls.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextShaderControlValues = {
                                ...settings.appearance.shaderControlValues,
                              };
                              delete nextShaderControlValues[
                                effectiveShader.id
                              ];
                              updateAppearance({
                                shaderControlValues: nextShaderControlValues,
                              });
                            }}
                            className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              borderColor: border,
                              background: "rgba(255,255,255,0.04)",
                              color: muted,
                            }}
                          >
                            Reset Shader
                          </button>
                        )}
                    </div>

                    {effectiveShader && effectiveShader.controls.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {effectiveShader.controls.map((control) => (
                          <RangeField
                            key={`shader-control-${effectiveShader.id}-${control.id}`}
                            label={control.label}
                            description={
                              control.description ??
                              `Live ${effectiveShader.name} control.`
                            }
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={
                              effectiveShaderControlValues[control.id] ??
                              control.defaultValue ??
                              control.min
                            }
                            valueLabel={formatShaderControlValue(
                              control,
                              effectiveShaderControlValues[control.id] ??
                                control.defaultValue ??
                                control.min,
                            )}
                            onChange={(value) =>
                              setShaderControlValue(
                                effectiveShader,
                                control,
                                value,
                              )
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="mt-3 rounded border px-3 py-2 text-[11px] opacity-55"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        {effectiveShader
                          ? `${effectiveShader.name} does not expose live controls yet. Add a \`controls\` array in the shader module to surface tweakable sliders here.`
                          : "No shader is currently active, so there are no live controls to show."}
                      </div>
                    )}
                  </div>

                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.025)",
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Surface Coverage
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {(["background", "topBar", "border"] as const).map(
                        (surface) => {
                          const enabled =
                            enabledShaderSurfaces.includes(surface);
                          return (
                            <div
                              key={`shader-surface-${surface}`}
                              className="rounded border px-3 py-2"
                              style={{
                                borderColor: enabled ? `${accent}55` : border,
                                background: enabled
                                  ? `${accent}12`
                                  : "rgba(255,255,255,0.03)",
                                color: text,
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold">
                                  {getOverlayShaderSurfaceLabel(surface)}
                                </span>
                                <span
                                  className="text-[9px] uppercase tracking-[0.12em]"
                                  style={{ color: enabled ? accent : muted }}
                                >
                                  {enabled ? "Enabled" : "Off"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] opacity-45">
                                {enabled
                                  ? `${effectiveShader?.name ?? "Current shader"} actively renders this shell surface.`
                                  : `${effectiveShader?.name ?? "Current shader"} does not supply a renderer for this surface.`}
                              </p>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "animations" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<RotateCcw size={12} />}
              title="Animations"
              subtitle="Window open and close choreography lives here. Keep authored transition modules separate from shell interaction motion."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                {...shellTransitionMotionCard.motionDataAttributes}
                onPointerEnter={shellTransitionMotionCard.onPointerEnter}
                onPointerLeave={shellTransitionMotionCard.onPointerLeave}
                onPointerDown={shellTransitionMotionCard.onPointerDown}
                onPointerUp={shellTransitionMotionCard.onPointerUp}
                onPointerCancel={shellTransitionMotionCard.onPointerCancel}
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                  ...shellTransitionMotionCard.motionStyle,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Shell Transitions
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Keep window open and close choreography separate from
                      interaction motion. The shell now starts with transition
                      motion parked, so first-run `Ctrl+Space` feels cleaner and
                      more enterprise-leaning until you opt back into
                      theme-driven motion.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: shellTransitionsEnabled
                        ? `${accent}66`
                        : border,
                      background: shellTransitionsEnabled
                        ? `${accent}16`
                        : "rgba(255,255,255,0.04)",
                      color: shellTransitionsEnabled ? accent : text,
                    }}
                  >
                    {shellTransitionsEnabled
                      ? "Enabled"
                      : "Disabled by Default"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <div className="opacity-45">
                    {availableAnimations.length} ready modules
                    {animationFailures.length > 0
                      ? ` · ${animationFailures.length} failed loads`
                      : ""}
                    {animationsLoading ? " · refreshing…" : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void onRefreshAnimations()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.03)",
                        color: text,
                      }}
                    >
                      <RefreshCw size={12} />
                      Refresh Motion
                    </button>
                    <button
                      onClick={() => void onOpenAnimationsFolder()}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 transition-colors"
                      style={{
                        borderColor: accent,
                        background: `${accent}16`,
                        color: text,
                      }}
                    >
                      <FolderOpen size={12} />
                      Open Folder
                    </button>
                  </div>
                </div>

                <label
                  className="mt-3 flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <div>
                    <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                      Enable Shell Transition Motion
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      When off, `Ctrl+Space` opens and closes without the theme
                      open/close choreography. Theme defaults and your selected
                      motion modules stay parked and resume when you turn this
                      back on.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="Enable shell transition animations"
                      checked={shellTransitionsEnabled}
                      onChange={(event) =>
                        updateAppearance({ animations: event.target.checked })
                      }
                    />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        color: shellTransitionsEnabled ? accent : muted,
                      }}
                    >
                      {shellTransitionsEnabled ? "On" : "Off"}
                    </span>
                  </div>
                </label>

                <div
                  className="mt-3 rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                    Authoring Folder
                  </div>
                  <div className="mt-1 break-all opacity-55">
                    {animationsDirectory}
                  </div>
                  {animationsError && (
                    <div
                      className="mt-2 rounded border px-2 py-1.5 text-[10px]"
                      style={{
                        borderColor: "rgba(245,158,11,0.35)",
                        background: "rgba(245,158,11,0.08)",
                        color: text,
                      }}
                    >
                      {animationsError}
                    </div>
                  )}
                </div>

                {animationFailures.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {animationFailures.map((animation) => (
                      <div
                        key={`animation-error-${animation.filePath}`}
                        className="rounded border px-3 py-2"
                        style={{
                          borderColor: "rgba(245,158,11,0.35)",
                          background: "rgba(245,158,11,0.08)",
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold">
                            {animation.name}
                          </div>
                          <span className="text-[9px] uppercase tracking-[0.12em] opacity-55">
                            Load Error
                          </span>
                        </div>
                        <div className="mt-1 break-all text-[10px] opacity-55">
                          {animation.filePath}
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap text-[10px] leading-4 opacity-80">
                          {animation.error}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      Open Motion
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() =>
                          updateAppearance({ appOpenAnimation: null })
                        }
                        className="rounded px-3 py-2 text-left transition-colors"
                        style={{
                          border: `1px solid ${settings.appearance.appOpenAnimation == null ? accent : border}`,
                          background:
                            settings.appearance.appOpenAnimation == null
                              ? `${accent}16`
                              : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold">
                            Follow Theme Default
                          </span>
                          <span
                            className="text-[9px] uppercase tracking-[0.14em]"
                            style={{
                              color:
                                settings.appearance.appOpenAnimation == null
                                  ? accent
                                  : muted,
                            }}
                          >
                            {effectiveOpenAnimationId}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {editableTheme.defaultOpenAnimationId
                            ? `Active theme ${editableTheme.name} defaults open motion to ${editableTheme.defaultOpenAnimationId}.`
                            : `Active theme ${editableTheme.name} does not define open motion, so GreebleFS falls back to ${animationSystemConfig.defaultOpenAnimationId}.`}
                          {!shellTransitionsEnabled
                            ? " Shell transition motion is currently off, so this stays parked until you enable it."
                            : ""}
                        </p>
                      </button>
                      {openAnimationOptions.map((animation) => {
                        const active =
                          settings.appearance.appOpenAnimation === animation.id;
                        return (
                          <button
                            key={`open-${animation.id}`}
                            onClick={() =>
                              updateAppearance({
                                appOpenAnimation: animation.id,
                              })
                            }
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active
                                ? `${accent}16`
                                : "rgba(255,255,255,0.03)",
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">
                                {animation.name}
                              </span>
                              <span
                                className="text-[9px] uppercase tracking-[0.14em]"
                                style={{ color: active ? accent : muted }}
                              >
                                {animation.group}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {animation.description ??
                                "Authored window opening motion module."}
                            </p>
                          </button>
                        );
                      })}
                      {openAnimationOptions.length === 0 && (
                        <div
                          className="rounded border px-3 py-2 text-[11px] opacity-45"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          No open-capable motion modules loaded yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      Close Motion
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() =>
                          updateAppearance({ appCloseAnimation: null })
                        }
                        className="rounded px-3 py-2 text-left transition-colors"
                        style={{
                          border: `1px solid ${settings.appearance.appCloseAnimation == null ? accent : border}`,
                          background:
                            settings.appearance.appCloseAnimation == null
                              ? `${accent}16`
                              : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold">
                            Follow Theme Default
                          </span>
                          <span
                            className="text-[9px] uppercase tracking-[0.14em]"
                            style={{
                              color:
                                settings.appearance.appCloseAnimation == null
                                  ? accent
                                  : muted,
                            }}
                          >
                            {effectiveCloseAnimationId}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {editableTheme.defaultCloseAnimationId
                            ? `Active theme ${editableTheme.name} defaults close motion to ${editableTheme.defaultCloseAnimationId}.`
                            : `Active theme ${editableTheme.name} does not define close motion, so GreebleFS falls back to ${animationSystemConfig.defaultCloseAnimationId}.`}
                          {!shellTransitionsEnabled
                            ? " Shell transition motion is currently off, so this stays parked until you enable it."
                            : ""}
                        </p>
                      </button>
                      {closeAnimationOptions.map((animation) => {
                        const active =
                          settings.appearance.appCloseAnimation ===
                          animation.id;
                        return (
                          <button
                            key={`close-${animation.id}`}
                            onClick={() =>
                              updateAppearance({
                                appCloseAnimation: animation.id,
                              })
                            }
                            className="rounded px-3 py-2 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active
                                ? `${accent}16`
                                : "rgba(255,255,255,0.03)",
                              color: text,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">
                                {animation.name}
                              </span>
                              <span
                                className="text-[9px] uppercase tracking-[0.14em]"
                                style={{ color: active ? accent : muted }}
                              >
                                {animation.group}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {animation.description ??
                                "Authored window closing motion module."}
                            </p>
                          </button>
                        );
                      })}
                      {closeAnimationOptions.length === 0 && (
                        <div
                          className="rounded border px-3 py-2 text-[11px] opacity-45"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          No close-capable motion modules loaded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <RangeField
                    label="Animation Duration"
                    description="How long each open or close pass gets to play before the window settles."
                    min={140}
                    max={1200}
                    step={20}
                    value={settings.appearance.appAnimationDurationMs}
                    valueLabel={`${settings.appearance.appAnimationDurationMs}ms`}
                    onChange={(value) =>
                      updateAppearance({
                        appAnimationDurationMs:
                          clampOverlayAnimationDuration(value),
                      })
                    }
                  />
                  <RangeField
                    label="Animation Intensity"
                    description="Push the translation, breakup, and glow harder without changing the active recipe."
                    min={0.55}
                    max={1.8}
                    step={0.05}
                    value={settings.appearance.appAnimationIntensity}
                    valueLabel={`${settings.appearance.appAnimationIntensity.toFixed(2)}x`}
                    onChange={(value) =>
                      updateAppearance({
                        appAnimationIntensity:
                          clampOverlayAnimationIntensity(value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "interaction-motion" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<Sparkles size={12} />}
              title="Interaction Motion"
              subtitle="Shell micro-interactions live here: explorer entries, rail items, tabs, buttons, and settings cards. Window open/close animation stays in Animations."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Interaction Motion Pack Catalog
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Standalone motion packs now live in{" "}
                      <code>{interactionMotionPacksDirectory}</code>. Theme
                      bundles can still contribute local motion packs, while the
                      controls below keep handling lane-level preset routing and
                      per-surface tuning.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void onRefreshInteractionMotionPacks()}
                      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        border: `1px solid ${border}`,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      <RefreshCw size={10} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => void onOpenInteractionMotionPacksFolder()}
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        border: `1px solid ${accent}`,
                        background: `${accent}18`,
                        color: text,
                      }}
                    >
                      Open Folder
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    Theme Default: {interactionMotionPackThemeDefaultLabel}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    {interactionMotionPacksLoading
                      ? "Scanning Catalog"
                      : `Catalog: ${availableInteractionMotionPackEntries.length} packs`}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    Standalone:{" "}
                    {interactionMotionPackCatalogCounts.standaloneCount}
                  </span>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: muted,
                    }}
                  >
                    Theme Contributed:{" "}
                    {interactionMotionPackCatalogCounts.themeContributedCount}
                  </span>
                </div>

                <div
                  className="mt-3 rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: `${accent}33`,
                    background: `${accent}10`,
                    color: text,
                  }}
                >
                  {activeThemeBundleLabel} currently resolves the interaction
                  motion lane to {interactionMotionPackThemeDefaultLabel}.
                </div>

                {interactionMotionPacksError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#7f1d1d",
                      background: "rgba(127,29,29,0.18)",
                      color: "#fecaca",
                    }}
                  >
                    Interaction-motion pack scan failed:{" "}
                    {interactionMotionPacksError}
                  </div>
                ) : null}

                {interactionMotionPacksWarnings.length > 0 ? (
                  <div
                    className="mt-3 rounded border px-3 py-3 text-[11px]"
                    style={{
                      borderColor: "#854d0e",
                      background: "rgba(133,77,14,0.18)",
                      color: "#fde68a",
                    }}
                  >
                    <div className="font-semibold uppercase tracking-[0.12em]">
                      Interaction-motion warnings
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {interactionMotionPacksWarnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className="rounded border p-3"
                {...interactionMotionCard.motionDataAttributes}
                onPointerEnter={interactionMotionCard.onPointerEnter}
                onPointerLeave={interactionMotionCard.onPointerLeave}
                onPointerDown={interactionMotionCard.onPointerDown}
                onPointerUp={interactionMotionCard.onPointerUp}
                onPointerCancel={interactionMotionCard.onPointerCancel}
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                  ...interactionMotionCard.motionStyle,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Interaction Motion
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Shared resolver drives explorer entries, rail items,
                      preview workflow tabs, panel tabs, top-bar buttons, and
                      settings cards. Theme defaults still land first, and
                      settings overrides only step in when you ask for them.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: settings.appearance.interactionMotionEnabled
                        ? `${accent}66`
                        : border,
                      background: settings.appearance.interactionMotionEnabled
                        ? `${accent}16`
                        : "rgba(255,255,255,0.04)",
                      color: settings.appearance.interactionMotionEnabled
                        ? accent
                        : text,
                    }}
                  >
                    {settings.appearance.interactionMotionEnabled
                      ? "Live"
                      : "Disabled"}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          Resolver State
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          Chrome lane and file/folder lane resolve separately
                          now. Current live routing:{" "}
                          <strong>
                            {effectiveInteractionMotionProfileLabel}
                          </strong>
                          .
                        </p>
                      </div>
                      <label
                        className="inline-flex items-center gap-2 text-[11px] font-medium"
                        style={{ color: text }}
                      >
                        <input
                          type="checkbox"
                          aria-label="Enable interaction motion"
                          checked={settings.appearance.interactionMotionEnabled}
                          onChange={(event) =>
                            updateAppearance({
                              interactionMotionEnabled: event.target.checked,
                            })
                          }
                        />
                        <span>Enable Interaction Motion</span>
                      </label>
                    </div>

                    {sharedInteractionMotionPresetId && (
                      <div
                        className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2"
                        style={{
                          borderColor: `${accent}44`,
                          background: `${accent}0c`,
                        }}
                      >
                        <div>
                          <div
                            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: accent }}
                          >
                            Shared Legacy Fallback
                          </div>
                          <div className="mt-1 text-[10px] leading-4 opacity-55">
                            Old shared preset{" "}
                            <strong>{sharedInteractionMotionPresetId}</strong>{" "}
                            still exists. Module cards can override it, or clear
                            it so only theme + module routing remain.
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Clear shared interaction motion fallback"
                          onClick={() =>
                            updateAppearance({
                              interactionMotionPresetId: null,
                            })
                          }
                          className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                          style={{
                            border: `1px solid ${accent}66`,
                            background: `${accent}16`,
                            color: accent,
                          }}
                        >
                          Clear Shared Fallback
                        </button>
                      </div>
                    )}
                  </div>

                  <RangeField
                    label="Master Motion Intensity"
                    description="Global multiplier applied before each module lane and per-surface override. Use this as the broad shell-wide gain control."
                    min={0.25}
                    max={2.5}
                    step={0.05}
                    value={settings.appearance.interactionMotionIntensity}
                    valueLabel={`${settings.appearance.interactionMotionIntensity.toFixed(2)}x`}
                    onChange={(value) =>
                      updateAppearance({
                        interactionMotionIntensity:
                          clampInteractionMotionIntensity(value),
                      })
                    }
                  />

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {interactionMotionModuleEditorStates.map((moduleState) => {
                      const moduleEnabled =
                        moduleState.moduleOverride.enabled !== false;
                      const followLabel =
                        moduleState.moduleOverride.presetId == null
                          ? sharedInteractionMotionPresetId
                            ? `Following shared fallback ${sharedInteractionMotionPresetId}.`
                            : themeInteractionMotionPresetId
                              ? `Following theme default ${themeInteractionMotionPresetId}.`
                              : "Following the built-in subtle fallback."
                          : "Pinned by module settings.";

                      return (
                        <div
                          key={`interaction-motion-module-${moduleState.module.id}`}
                          className="rounded border p-3"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                {moduleState.module.label}
                              </div>
                              <p className="mt-1 text-[11px] leading-4 opacity-45">
                                {moduleState.module.description} Live preset:{" "}
                                <strong>
                                  {moduleState.effectiveProfile.label}
                                </strong>
                                . {followLabel}
                              </p>
                            </div>
                            <label
                              className="inline-flex items-center gap-2 text-[11px] font-medium"
                              style={{ color: text }}
                            >
                              <input
                                type="checkbox"
                                aria-label={`Enable ${moduleState.module.label} interaction motion`}
                                checked={moduleEnabled}
                                onChange={(event) =>
                                  setInteractionMotionModuleEnabled(
                                    moduleState.module.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span>Lane Enabled</span>
                            </label>
                          </div>

                          <div
                            className="mt-3 rounded border p-3"
                            style={{
                              borderColor: border,
                              background: "rgba(255,255,255,0.025)",
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                  Preset Studio
                                </div>
                                <div className="mt-1 text-[10px] leading-4 opacity-45">
                                  Pick motion family per lane. Files can bounce
                                  while chrome stays restrained, or vice versa.
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-label={`Follow theme interaction motion preset for ${moduleState.module.label}`}
                                onClick={() =>
                                  setInteractionMotionModulePresetId(
                                    moduleState.module.id,
                                    null,
                                  )
                                }
                                className="rounded px-3 py-2 text-left transition-colors"
                                style={{
                                  border: `1px solid ${moduleState.moduleOverride.presetId == null ? accent : border}`,
                                  background:
                                    moduleState.moduleOverride.presetId == null
                                      ? `${accent}16`
                                      : "rgba(255,255,255,0.03)",
                                  color: text,
                                  minWidth: "14rem",
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold">
                                    Follow Routing
                                  </span>
                                  <span
                                    className="text-[9px] font-semibold uppercase tracking-[0.12em]"
                                    style={{
                                      color:
                                        moduleState.moduleOverride.presetId ==
                                        null
                                          ? accent
                                          : muted,
                                    }}
                                  >
                                    Default Path
                                  </span>
                                </div>
                                <div className="mt-1 text-[10px] leading-4 opacity-50">
                                  {followLabel}
                                </div>
                              </button>
                            </div>

                            <div className="mt-4 space-y-3">
                              {interactionMotionPresetGroups.map((group) => (
                                <div
                                  key={`${moduleState.module.id}-${group.id}`}
                                  className="space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                        {group.label}
                                      </div>
                                      <div className="mt-1 text-[10px] leading-4 opacity-45">
                                        {group.subtitle}
                                      </div>
                                    </div>
                                    <span
                                      className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                                      style={{
                                        borderColor: border,
                                        background: "rgba(255,255,255,0.04)",
                                        color: muted,
                                      }}
                                    >
                                      {group.options.length} presets
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    {group.options.map((option) => {
                                      const active =
                                        moduleState.moduleOverride.presetId ===
                                        option.id;
                                      return (
                                        <button
                                          key={`interaction-motion-preset-${moduleState.module.id}-${option.id}`}
                                          type="button"
                                          aria-label={`Use ${option.label} interaction motion preset for ${moduleState.module.label}`}
                                          onClick={() =>
                                            setInteractionMotionModulePresetId(
                                              moduleState.module.id,
                                              option.id,
                                            )
                                          }
                                          className="rounded px-3 py-3 text-left transition-colors"
                                          style={{
                                            border: `1px solid ${active ? accent : border}`,
                                            background: active
                                              ? `${accent}16`
                                              : "rgba(255,255,255,0.03)",
                                            color: text,
                                          }}
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="text-[11px] font-semibold">
                                                {option.label}
                                              </div>
                                              <div
                                                className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                                                style={{
                                                  color: active
                                                    ? accent
                                                    : muted,
                                                }}
                                              >
                                                {group.label}
                                              </div>
                                            </div>
                                            {moduleState.effectivePresetId ===
                                              option.id && (
                                              <span
                                                className="rounded border px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em]"
                                                style={{
                                                  borderColor: `${accent}66`,
                                                  color: accent,
                                                }}
                                              >
                                                Live
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-2 text-[10px] leading-4 opacity-50">
                                            {option.description}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3">
                            <RangeField
                              label={`${moduleState.module.label} Intensity`}
                              description="Lane-specific multiplier after the master intensity. Use this to keep chrome restrained while files/icons go harder."
                              min={0.25}
                              max={2.5}
                              step={0.05}
                              value={
                                moduleState.moduleOverride.intensityMultiplier
                              }
                              valueLabel={`${moduleState.moduleOverride.intensityMultiplier.toFixed(2)}x`}
                              onChange={(value) =>
                                setInteractionMotionModuleIntensity(
                                  moduleState.module.id,
                                  value,
                                )
                              }
                            />
                          </div>

                          <div
                            className="mt-3 rounded border p-3"
                            style={{
                              borderColor: border,
                              background: "rgba(255,255,255,0.025)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                  Modifier Controls
                                </div>
                                <div className="mt-1 text-[10px] leading-4 opacity-45">
                                  Selected preset exposes its own tweak set,
                                  KCloner-style.
                                </div>
                              </div>
                              <span
                                className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                                style={{
                                  borderColor: border,
                                  background: "rgba(255,255,255,0.04)",
                                  color: muted,
                                }}
                              >
                                {moduleState.modifierControls.length > 0
                                  ? `${moduleState.modifierControls.length} knobs`
                                  : "No extra knobs"}
                              </span>
                            </div>

                            {moduleState.modifierControls.length > 0 ? (
                              <div className="mt-3 space-y-3">
                                {moduleState.modifierControls.map((control) => (
                                  <RangeField
                                    key={`${moduleState.module.id}-${moduleState.effectivePresetId}-${control.id}`}
                                    label={control.label}
                                    description={control.description}
                                    min={control.min}
                                    max={control.max}
                                    step={control.step}
                                    value={
                                      moduleState.modifierValues[control.id]
                                    }
                                    valueLabel={formatInteractionMotionModifierControlValue(
                                      control,
                                      moduleState.modifierValues[control.id],
                                    )}
                                    onChange={(value) =>
                                      setInteractionMotionModuleModifierValue(
                                        moduleState.module.id,
                                        moduleState.effectivePresetId,
                                        control.id,
                                        value,
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            ) : (
                              <div
                                className="mt-3 rounded border px-3 py-2 text-[10px] leading-4 opacity-55"
                                style={{
                                  borderColor: border,
                                  background: "rgba(255,255,255,0.02)",
                                }}
                              >
                                This profile stays simple. Switch to a KCloner
                                motion family to get a richer tweak set for this
                                lane.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          Surface Overrides
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          Disable motion on one surface without changing the
                          module preset or tweak values feeding the rest of that
                          lane.
                        </p>
                      </div>
                      <span
                        className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.04)",
                          color: muted,
                        }}
                      >
                        {interactionMotionSurfaceCatalog.length} surfaces
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {interactionMotionModuleCatalog.map((module) => (
                        <div
                          key={`interaction-motion-surface-group-${module.id}`}
                          className="rounded border p-3"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                {module.label}
                              </div>
                              <div className="mt-1 text-[10px] leading-4 opacity-45">
                                {module.description}
                              </div>
                            </div>
                            <span
                              className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]"
                              style={{
                                borderColor: border,
                                background: "rgba(255,255,255,0.04)",
                                color: muted,
                              }}
                            >
                              {module.surfaceIds.length} surfaces
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2">
                            {interactionMotionSurfaceCatalog
                              .filter(
                                (surface) => surface.moduleId === module.id,
                              )
                              .map((surface) => {
                                const override =
                                  settings.appearance
                                    .interactionMotionSurfaceOverrides[
                                    surface.id
                                  ];
                                const surfaceEnabled =
                                  typeof override === "boolean"
                                    ? override
                                    : override?.enabled !== false;
                                return (
                                  <label
                                    key={`interaction-motion-surface-${surface.id}`}
                                    className="flex items-start gap-3 rounded border px-3 py-2"
                                    style={{
                                      borderColor: surfaceEnabled
                                        ? border
                                        : `${accent}44`,
                                      background: surfaceEnabled
                                        ? "rgba(255,255,255,0.02)"
                                        : `${accent}0c`,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      aria-label={`Enable ${surface.label} interaction motion`}
                                      checked={surfaceEnabled}
                                      onChange={(event) =>
                                        setInteractionMotionSurfaceEnabled(
                                          surface.id,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                    <span style={{ minWidth: 0 }}>
                                      <span
                                        className="text-[11px] font-semibold"
                                        style={{ color: text }}
                                      >
                                        {surface.label}
                                      </span>
                                      <span className="mt-1 block text-[10px] leading-4 opacity-50">
                                        {surface.description}
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <InteractionMotionLab
                    appearance={appAppearance}
                    accent={accent}
                    border={border}
                    text={text}
                    muted={muted}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "layout-dynamics" && (
          <LayoutDynamicsSettingsSection
            appearance={appAppearance}
            layoutDynamicsEnabled={settings.appearance.layoutDynamicsEnabled}
            layoutDynamicsPresetId={settings.appearance.layoutDynamicsPresetId}
            layoutDynamicsIntensity={settings.appearance.layoutDynamicsIntensity}
            layoutDynamicsSurfaceOverrides={
              settings.appearance.layoutDynamicsSurfaceOverrides
            }
            topBarLayoutSnapshotsById={
              settings.appearance.topBarLayoutSnapshotsById
            }
            border={border}
            accent={accent}
            text={text}
            muted={muted}
            onUpdateAppearance={updateAppearance}
          />
        )}

        {activeSection === "hotkeys" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<TerminalSquare size={12} />}
              title="Hotkeys"
              subtitle="Keep the overlay opener configurable and expose the shell presentation toggles alongside the first global gesture controls."
            />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {hotkeyBindingDefinitions
                .filter(
                  (definition) =>
                    definition.scope === "global" ||
                    definition.scope === "gesture" ||
                    definition.key === "mobileShareToggle" ||
                    definition.key === "windowModeToggle" ||
                    definition.key === "zenFocusModeToggle" ||
                    definition.key === "toggleDeveloperTelemetryHud",
                )
                .map((definition) => (
                  <ShortcutField
                    key={definition.key}
                    bindingKey={definition.key}
                    value={settings.keybindings[definition.key]}
                    onCommit={(value) =>
                      updateKeybindings({ [definition.key]: value })
                    }
                  />
                ))}
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                Explorer Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                These bindings drive the file browser directly, keeping the
                content-browser flow on the same data-driven shortcut system as
                the rest of the app.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "newFile",
                      "newFolder",
                      "renameItem",
                      "deleteItem",
                      "duplicateItem",
                      "refreshExplorer",
                      "goBackDirectory",
                      "goForwardDirectory",
                      "goHomeDirectory",
                      "cycleExplorerSearchMode",
                      "findSimilarSelection",
                      "goUpDirectory",
                      "explorerMoveSelectionUp",
                      "explorerMoveSelectionDown",
                      "explorerMoveSelectionLeft",
                      "explorerMoveSelectionRight",
                      "toggleExplorerSources",
                      "cycleCollectionPreviewMode",
                      "cycleCollectionPreviewModeReverse",
                      "togglePreviewLock",
                      "copyPath",
                      "copySelection",
                      "cutSelection",
                      "pasteSelection",
                      "toggleHiddenFiles",
                      "toggleExplorerLayout",
                      "cycleConstellationLens",
                      "toggleConstellationRouteMode",
                      "toggleConstellationPinSelection",
                      "togglePreviewTerminal",
                      "searchExplorer",
                      "selectAllExplorer",
                      "clearExplorerSelection",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Explorer Ritual Bindings
                  </div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Use <code>Ctrl+Alt+Click</code> on any supported explorer
                    control anytime to assign a shared command hotkey instantly.
                    Dragging controls is only unlocked while customize mode is
                    on, but hotkey capture is always available.
                  </p>
                </div>
                <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
                  {assignedExplorerCommandBindings.length} bound
                </span>
              </div>
              {assignedExplorerCommandBindings.length > 0 ? (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {assignedExplorerCommandBindings.map((binding) => (
                    <CommandShortcutField
                      key={binding.commandId}
                      label={binding.label}
                      description={binding.description}
                      surfaces={binding.surfaces}
                      value={binding.binding}
                      onCommit={(value) =>
                        setCommandKeybinding(binding.commandId, value)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="mt-3 rounded border border-dashed px-3 py-4 text-[11px] opacity-55"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                >
                  No ritual bindings yet. Use <code>Ctrl+Alt+Click</code> on any
                  supported explorer control to capture one.
                </div>
              )}
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                Audio Workbench Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                Power-user bindings for the explorer audio preview and editor:
                playback, preview-edit switching, trim navigation, silence
                review, and fast clip export all route through the same
                settings-backed shortcut system.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "audioWorkbenchPlayPause",
                      "audioWorkbenchToggleEditMode",
                      "audioWorkbenchJumpToSelectionStart",
                      "audioWorkbenchJumpToSelectionEnd",
                      "audioWorkbenchPreviousSilence",
                      "audioWorkbenchNextSilence",
                      "audioWorkbenchExportClip",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                Python Workbench Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                Keyboard coverage for the Python preview lane: managed runs and
                terminal fallback stay on the same settings-backed shortcut
                system as the other explorer workbenches.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "pythonWorkbenchRunManaged",
                      "pythonWorkbenchRunInTerminal",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                Shader Workbench Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                Keyboard coverage for the explorer shader workbench: save,
                preview/edit mode switching, and scene host toggling all stay on
                the same settings-backed shortcut layer as the other inline
                workbenches.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "saveFile",
                      "shaderWorkbenchToggleEditMode",
                      "shaderWorkbenchToggleScene",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                Spreadsheet Workbench Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                Keyboard coverage for the spreadsheet preview/editor:
                preview-edit mode switching, sheet travel, sheet creation,
                formula focus, and save all stay inside the shared explorer
                shortcut system.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "saveFile",
                      "spreadsheetWorkbenchToggleEditMode",
                      "spreadsheetWorkbenchPreviousSheet",
                      "spreadsheetWorkbenchNextSheet",
                      "spreadsheetWorkbenchNewSheet",
                      "spreadsheetWorkbenchFocusFormulaBar",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                PDF Workbench Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                Keyboard coverage for the inline PDF workbench: page travel,
                zoom, save, and preview/edit mode switching all stay inside the
                shared explorer shortcut system.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "saveFile",
                      "pdfWorkbenchPreviousPage",
                      "pdfWorkbenchNextPage",
                      "pdfWorkbenchZoomIn",
                      "pdfWorkbenchZoomOut",
                      "pdfWorkbenchToggleEditMode",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
            <div
              className="mt-4 rounded border p-3"
              style={{
                borderColor: border,
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                Image Editor Hotkeys
              </div>
              <p className="mt-1 text-[11px] opacity-40">
                Keyboard coverage for the explorer image lane: save, cutout
                copy, undo, redo, and reset all stay on the same settings-backed
                shortcut layer as the rest of the shell.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {hotkeyBindingDefinitions
                  .filter((definition) =>
                    [
                      "saveFile",
                      "imageCutoutCopy",
                      "imageEditorUndo",
                      "imageEditorRedo",
                      "imageEditorReset",
                    ].includes(definition.key),
                  )
                  .map((definition) => (
                    <ShortcutField
                      key={definition.key}
                      bindingKey={definition.key}
                      value={settings.keybindings[definition.key]}
                      onCommit={(value) =>
                        updateKeybindings({ [definition.key]: value })
                      }
                    />
                  ))}
              </div>
            </div>
          </section>
        )}

        {activeSection === "terminal" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<TerminalSquare size={12} />}
              title="Terminal"
              subtitle="Application mode, dock mode, integrated shell defaults, and external terminal handoff."
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div
                className="space-y-3 md:col-span-2 rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Shell Presentation
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      `Ctrl+Space` always shows the current presentation mode.
                      Use{" "}
                      {formatHotkeyLabel(settings.keybindings.windowModeToggle)}{" "}
                      to swap between the dock-style overlay shell and a regular
                      desktop application window, and{" "}
                      {formatHotkeyLabel(
                        settings.keybindings.zenFocusModeToggle,
                      )}{" "}
                      to hide the shell top bar for a cleaner explorer-focused
                      pass.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {settings.terminal.windowMode === "windowed"
                      ? "Application Window"
                      : "Dock Overlay"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(
                    [
                      {
                        value: "overlay",
                        label: "Dock Mode",
                        description:
                          "Pins the shell to the monitor edge, keeps the hotkey-driven dock flow, and uses the current anchor behavior.",
                      },
                      {
                        value: "windowed",
                        label: "Application Mode",
                        description:
                          "Opens as a regular resizable desktop window with native minimize, maximize, and close controls.",
                      },
                    ] as const satisfies Array<{
                      value: TerminalWindowMode;
                      label: string;
                      description: string;
                    }>
                  ).map((option) => {
                    const active =
                      settings.terminal.windowMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          if (onSetWindowMode) {
                            void onSetWindowMode(option.value);
                            return;
                          }
                          updateTerminal({ windowMode: option.value });
                        }}
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {option.label}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      Windowed Width
                    </label>
                    <input
                      type="number"
                      min={720}
                      step={20}
                      value={settings.terminal.windowedWidth}
                      onChange={(event) =>
                        updateTerminal({
                          windowedWidth: Number(event.target.value),
                        })
                      }
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsFieldStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      Windowed Height
                    </label>
                    <input
                      type="number"
                      min={480}
                      step={20}
                      value={settings.terminal.windowedHeight}
                      onChange={(event) =>
                        updateTerminal({
                          windowedHeight: Number(event.target.value),
                        })
                      }
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsFieldStyle}
                    />
                  </div>
                </div>

                <label
                  className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <div>
                    <div className="font-medium">Show Terminal Sidebar</div>
                    <p className="mt-1 text-[10px] opacity-45">
                      Keeps the directories and command rail expanded when the
                      terminal opens. You can still tuck it away live from the
                      terminal header.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Show terminal sidebar"
                    checked={settings.terminal.showSidebar}
                    onChange={(event) =>
                      updateTerminal({ showSidebar: event.target.checked })
                    }
                  />
                </label>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Integrated Shell Profile
                </label>
                <select
                  aria-label="Integrated Shell Profile"
                  value={settings.terminal.shellProfile}
                  onChange={(event) => {
                    const nextProfile = event.target
                      .value as IntegratedTerminalProfile;
                    const template = getIntegratedTerminalProfileTemplate(
                      nextProfile,
                      platform,
                    );
                    updateTerminal({
                      shellProfile: nextProfile,
                      shellPath:
                        nextProfile === "custom"
                          ? settings.terminal.shellPath
                          : template.shellPath,
                      shellArgs:
                        nextProfile === "custom"
                          ? settings.terminal.shellArgs
                          : template.shellArgs,
                    });
                  }}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsSelectStyle}
                >
                  {integratedShellProfileOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] opacity-40">
                  {integratedShellProfileOptions.find(
                    (option) => option.id === settings.terminal.shellProfile,
                  )?.description ??
                    "Choose the shell profile the integrated terminal should launch."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Shell Path
                </label>
                <input
                  aria-label="Integrated Shell Path"
                  value={settings.terminal.shellPath}
                  disabled={settings.terminal.shellProfile === "auto"}
                  onChange={(event) =>
                    updateTerminal({ shellPath: event.target.value })
                  }
                  placeholder={
                    settings.terminal.shellProfile === "auto"
                      ? "Auto chooses the best installed shell"
                      : platform === "windows"
                        ? "pwsh.exe or C:\\Program Files\\PowerShell\\7\\pwsh.exe"
                        : "/bin/zsh"
                  }
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none disabled:opacity-45"
                  style={settingsMonoFieldStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Shell Args
                </label>
                <textarea
                  aria-label="Integrated Shell Args"
                  value={settings.terminal.shellArgs}
                  disabled={settings.terminal.shellProfile === "auto"}
                  onChange={(event) =>
                    updateTerminal({ shellArgs: event.target.value })
                  }
                  placeholder={
                    settings.terminal.shellProfile === "auto"
                      ? "Auto profile uses host defaults"
                      : platform === "windows"
                        ? "-NoLogo -NoProfile"
                        : "-l"
                  }
                  className="min-h-[92px] w-full rounded border px-3 py-2 text-[11px] outline-none disabled:opacity-45"
                  style={settingsMonoFieldStyle}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Effective Launch Command
                </label>
                <input
                  aria-label="Effective Launch Command"
                  readOnly
                  value={settings.terminal.shell}
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none opacity-80"
                  style={settingsMonoFieldStyle}
                />
                <p className="text-[11px] opacity-40">
                  {settings.terminal.shellProfile === "auto"
                    ? "Auto previews the preferred shell while the native host still falls back if PowerShell 7 is missing."
                    : "The integrated terminal, cwd sync, and in-terminal script runners all use this resolved shell command."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Terminal Font
                </label>
                <input
                  value={settings.terminal.fontFamily}
                  onChange={(event) =>
                    updateTerminal({ fontFamily: event.target.value })
                  }
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsMonoFieldStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Font Size
                </label>
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={settings.terminal.fontSize}
                  onChange={(event) =>
                    updateTerminal({ fontSize: Number(event.target.value) })
                  }
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsFieldStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Cursor Style
                </label>
                <select
                  aria-label="Cursor Style"
                  value={settings.terminal.cursorStyle}
                  onChange={(event) =>
                    updateTerminal({
                      cursorStyle: event.target
                        .value as typeof settings.terminal.cursorStyle,
                    })
                  }
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsSelectStyle}
                >
                  <option value="bar">Bar</option>
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Open Target
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["integrated", "external"] as const).map((mode) => {
                    const active = settings.terminal.preferredOpenMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() =>
                          updateTerminal({ preferredOpenMode: mode })
                        }
                        className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          background: active
                            ? `${accent}20`
                            : "rgba(255,255,255,0.04)",
                          color: active ? text : muted,
                          border: `1px solid ${active ? accent : border}`,
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  External Terminal Profile
                </label>
                <select
                  aria-label="External Terminal Profile"
                  value={settings.terminal.externalTerminalProfile}
                  onChange={(event) =>
                    updateTerminal({
                      externalTerminalProfile: event.target
                        .value as ExternalTerminalProfile,
                    })
                  }
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsSelectStyle}
                >
                  {externalProfileOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] opacity-40">
                  {externalProfileOptions.find(
                    (option) =>
                      option.id === settings.terminal.externalTerminalProfile,
                  )?.description ??
                    "Use a platform-appropriate terminal profile."}
                </p>
              </div>

              {(settings.terminal.externalTerminalProfile === "custom" ||
                settings.terminal.preferredOpenMode === "external") && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      External Command
                    </label>
                    <input
                      value={settings.terminal.externalTerminalCommand}
                      onChange={(event) =>
                        updateTerminal({
                          externalTerminalCommand: event.target.value,
                        })
                      }
                      className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                      External Args
                    </label>
                    <textarea
                      value={settings.terminal.externalTerminalArgs}
                      onChange={(event) =>
                        updateTerminal({
                          externalTerminalArgs: event.target.value,
                        })
                      }
                      className="min-h-[92px] w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                  </div>
                </>
              )}

              <label
                className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                style={{ borderColor: border }}
              >
                <span>Cursor Blink</span>
                <input
                  type="checkbox"
                  checked={settings.terminal.cursorBlink}
                  onChange={(event) =>
                    updateTerminal({ cursorBlink: event.target.checked })
                  }
                />
              </label>
            </div>
          </section>
        )}

        {activeSection === "layouts" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<LayoutGrid size={12} />}
              title="Layouts"
              subtitle="Drive the whole shell from a manifest instead of a single hardcoded chrome layout."
            />

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Manifest Path
                </label>
                <input
                  value={settings.layout.configPath}
                  onChange={(event) =>
                    updateLayout({ configPath: event.target.value })
                  }
                  placeholder="Leave blank to probe ~/.greeblefs/greeblefs.layouts.json or .toml"
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.04)",
                    color: text,
                    fontFamily: appearance.fonts.mono,
                  }}
                />
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <button
                    onClick={() => updateLayout({ configPath: "" })}
                    className="rounded px-2 py-1 font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    Use Auto Probe
                  </button>
                  <span
                    className="rounded border px-2 py-1 font-semibold uppercase tracking-[0.14em]"
                    style={{
                      borderColor: layoutManifestState.sourceError
                        ? "#f97316"
                        : accent,
                      background: layoutManifestState.sourceError
                        ? "rgba(249,115,22,0.12)"
                        : `${accent}12`,
                      color: layoutManifestState.sourceError ? "#fdba74" : text,
                    }}
                  >
                    {layoutManifestState.sourceType === "file"
                      ? "External Manifest"
                      : "Built In"}
                  </span>
                </div>
                <p className="text-[11px] opacity-40">{layoutSourceSummary}</p>
                {layoutManifestState.sourceError && (
                  <div
                    className="rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#7f1d1d",
                      background: "rgba(127,29,29,0.18)",
                      color: "#fecaca",
                    }}
                  >
                    Manifest load failed: {layoutManifestState.sourceError}
                  </div>
                )}
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Profiles
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Click a profile to switch the entire workbench layout. The
                      GreebleFS chrome button still cycles this same ordered
                      set.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {layoutManifestState.manifest.profiles.length} loaded
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {layoutManifestState.manifest.profiles.map((profile) => {
                    const active = profile.id === activeLayoutProfile.id;
                    const shellFamily =
                      getWorkbenchShellFamilyForLayoutProfile(profile);
                    return (
                      <button
                        key={profile.id}
                        onClick={() =>
                          updateLayout({
                            activeProfileId: profile.id,
                            followThemeDefaults: false,
                            lastProfileIdByShellFamily: {
                              ...settings.layout.lastProfileIdByShellFamily,
                              [shellFamily]: profile.id,
                            },
                          })
                        }
                        className="w-full rounded border px-3 py-3 text-left transition-colors"
                        style={{
                          borderColor: active ? accent : border,
                          background: active
                            ? `${accent}16`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold">
                              {profile.label}
                            </div>
                            <p className="mt-1 text-[11px] opacity-45">
                              {profile.description}
                            </p>
                          </div>
                          {active && (
                            <span
                              className="rounded border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
                              style={{ borderColor: accent, color: accent }}
                            >
                              Live
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[0.12em] opacity-70">
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Bar {profile.chrome.barPosition}
                          </span>
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Dock{" "}
                            {profile.controlDock.enabled
                              ? profile.controlDock.side
                              : "off"}
                          </span>
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Pinned {profile.pinnedPanels.length}
                          </span>
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Default {profile.behavior.defaultActivePanelId}
                          </span>
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Primary {profile.interaction.primaryAxisOwner}
                          </span>
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Command {profile.interaction.commandOwner}
                          </span>
                          <span
                            className="rounded border px-2 py-1"
                            style={{ borderColor: border }}
                          >
                            Back {profile.interaction.backBehavior}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "system" && (
          <SystemSettingsSection
            platform={platform}
            startupSyncPending={startupSyncPending}
            startupSyncError={startupSyncError}
            launchAtStartup={settings.system.launchAtStartup}
            startMobileShareOnBoot={settings.system.startMobileShareOnBoot}
            hideAppInTray={settings.system.hideAppInTray}
            showInTaskbar={settings.system.showInTaskbar}
            developerMode={settings.system.developerMode}
            developerTelemetryEnabled={
              settings.system.developerTelemetryEnabled
            }
            sourceTraceModeEnabled={settings.system.sourceTraceModeEnabled}
            consumerDiagnosticsEnabled={
              settings.system.consumerDiagnosticsEnabled
            }
            developerTelemetryCaptureMode={
              settings.system.developerTelemetryCaptureMode
            }
            developerTelemetryPayloadMode={
              settings.system.developerTelemetryPayloadMode
            }
            developerTelemetryMaxFileSizeMb={
              settings.system.developerTelemetryMaxFileSizeMb
            }
            developerTelemetryWriteToFile={
              settings.system.developerTelemetryWriteToFile
            }
            developerTelemetryShowInspector={
              settings.system.developerTelemetryShowInspector
            }
            consumerDiagnosticsIncludePluginRuntime={
              settings.system.consumerDiagnosticsIncludePluginRuntime
            }
            consumerDiagnosticsIncludeRendererRuntime={
              settings.system.consumerDiagnosticsIncludeRendererRuntime
            }
            consumerDiagnosticsIncludePerfSamples={
              settings.system.consumerDiagnosticsIncludePerfSamples
            }
            toggleDeveloperTelemetryHud={
              settings.keybindings.toggleDeveloperTelemetryHud
            }
            linuxDisplayBackendPreference={
              settings.system.linuxDisplayBackendPreference
            }
            availableLinuxDisplayBackends={availableLinuxDisplayBackends}
            linuxDisplayBackendStatus={linuxDisplayBackendStatus}
            linuxDisplayBackendSyncPending={linuxDisplayBackendSyncPending}
            linuxDisplayBackendStatusSummary={linuxDisplayBackendStatusSummary}
            telemetryStatusPending={telemetryStatusPending}
            telemetryStatusError={telemetryStatusError}
            telemetryStatus={telemetryStatus}
            telemetryActionPending={telemetryActionPending}
            telemetryNotice={telemetryNotice}
            systemPresentationState={systemPresentationState}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
            settingsSelectStyle={settingsSelectStyle}
            settingsFieldStyle={settingsFieldStyle}
            gpuRuntimeSnapshot={gpuRuntimeSnapshot}
            gpuTierMode={settings.system.gpuTierMode}
            gpuRuntimeDiagnosticsSummary={gpuRuntimeDiagnosticsSummary}
            gpuRuntimeFeedStatus={gpuRuntimeFeedStatus}
            gpuRuntimeTierOptions={gpuRuntimeTierOptions}
            gpuTierLabel={getGpuTierModeLabel(gpuRuntimeSnapshot.effectiveTier)}
            accelerationRoutingMode={settings.system.accelerationRoutingMode}
            accelerationRoutingModeOptions={accelerationRoutingModeOptions}
            accelerationProviderSummary={accelerationProviderSummary}
            accelerationPipelineStatus={accelerationPipelineStatus}
            accelerationInstallRecommended={accelerationInstallRecommended}
            accelerationInstallButtonLabel={accelerationInstallButtonLabel}
            accelerationProbePending={accelerationProbePending}
            accelerationInstallPending={accelerationInstallPending}
            accelerationAutoInstallPlanAvailable={
              accelerationAutoInstallPlan != null
            }
            accelerationRuntimeSnapshot={accelerationRuntimeSnapshot}
            accelerationWorkloadRoutes={accelerationWorkloadRoutes}
            onSetLaunchAtStartup={setLaunchAtStartup}
            onUpdateSystem={updateSystem}
            onSetHideAppInTray={setHideAppInTray}
            onSetShowInTaskbar={setShowInTaskbar}
            onProbeAccelerationPipeline={handleProbeAccelerationPipeline}
            onQueueAccelerationInstall={handleQueueAccelerationInstall}
            onSetLinuxDisplayBackendPreference={
              setLinuxDisplayBackendPreference
            }
            onRefreshTelemetryStatus={refreshTelemetryStatus}
            onTelemetryExport={handleTelemetryExport}
            onTelemetryClear={handleTelemetryClear}
          />
        )}

        {/*
            {false && activeSection === 'system' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Settings2 size={12} />}
                  title="System"
                  subtitle="Machine-level startup behavior and OS integration state."
                />

                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Launch At Startup</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Registers GreebleFS as a login item so the tray and overlay are available after sign-in.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.launchAtStartup}
                      disabled={startupSyncPending}
                      onChange={event => void setLaunchAtStartup(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Start Mobile Share On Boot</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        When the main desktop host launches, immediately bring the phone-facing mobile share online using the current Mobile routing mode and the active explorer path fallback.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.startMobileShareOnBoot}
                      onChange={event => updateSystem({ startMobileShareOnBoot: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Hide App In Tray</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Keeps a {platform === 'macos' ? 'menu bar' : 'system tray'} entry available so the overlay can stay resident when the main window is hidden.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.hideAppInTray}
                      onChange={event => setHideAppInTray(event.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Show In Taskbar</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Shows the main window in the {platform === 'macos' ? 'Dock' : 'taskbar'} while the shell is running so application mode behaves like a regular desktop app.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.showInTaskbar}
                      onChange={event => setShowInTaskbar(event.target.checked)}
                    />
                  </label>
                  <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">GPU Runtime</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Controls the native `wgpu` offload lane used for image thumbnails, image preview rendering, and audio analysis/spectrogram work. `Safe` forces CPU fallback.
                        </p>
                      </div>
                      <span
                        className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}
                      >
                        {getGpuTierModeLabel(gpuRuntimeSnapshot.effectiveTier)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                      {gpuRuntimeTierOptions.map(option => {
                        const active = settings.system.gpuTierMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateSystem({ gpuTierMode: option.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {option.label}
                            </div>
                            <p className="mt-2 text-[11px] leading-4 opacity-65">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}
                    >
                      {gpuRuntimeDiagnosticsSummary}
                    </div>
                    <div
                      className="mt-2 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}
                    >
                      {gpuRuntimeFeedStatus}
                    </div>
                    {gpuRuntimeSnapshot.workloads.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {gpuRuntimeSnapshot.workloads.map(workload => (
                          <span
                            key={workload.workloadId}
                            className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                            style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                          >
                            {workload.label} · {workload.ready ? 'GPU ready' : 'CPU fallback'} · exec {workload.executions} · fallback {workload.fallbackCount}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Acceleration Pipeline</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Cross-provider routing for CPU fallback, the native `wgpu` lane, and the Python-sidecar CUDA/AI lane. Future thumbnail, media, indexing, inference, and similarity features should resolve through this contract.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleProbeAccelerationPipeline()}
                          disabled={accelerationProbePending}
                          className="rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                          style={{
                            borderColor: accelerationProbePending ? border : accent,
                            background: accelerationProbePending ? 'rgba(255,255,255,0.03)' : `${accent}14`,
                            color: text,
                            opacity: accelerationProbePending ? 0.7 : 1,
                          }}
                        >
                          {accelerationProbePending ? 'Probing…' : 'Probe CUDA / AI'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleQueueAccelerationInstall()}
                          disabled={accelerationInstallPending || accelerationAutoInstallPlan == null}
                          className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                          style={{
                            borderColor: accelerationInstallPending || accelerationAutoInstallPlan == null ? border : accent,
                            background: accelerationInstallPending || accelerationAutoInstallPlan == null ? 'rgba(255,255,255,0.03)' : `${accent}14`,
                            color: text,
                            opacity: accelerationInstallPending || accelerationAutoInstallPlan == null ? 0.7 : 1,
                          }}
                        >
                          {accelerationInstallPending ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                          {accelerationInstallPending ? 'Opening Terminal…' : accelerationInstallButtonLabel}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                      {accelerationRoutingModeOptions.map(option => {
                        const active = settings.system.accelerationRoutingMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => updateSystem({ accelerationRoutingMode: option.id })}
                            className="rounded px-3 py-3 text-left transition-colors"
                            style={{
                              border: `1px solid ${active ? accent : border}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.03)',
                              color: text,
                            }}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {option.label}
                            </div>
                            <p className="mt-2 text-[11px] leading-4 opacity-65">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="mt-3 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: text }}
                    >
                      {accelerationProviderSummary}
                    </div>
                    <div
                      className="mt-2 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: muted }}
                    >
                      {accelerationPipelineStatus}
                    </div>
                    <div
                      className="mt-2 rounded border px-3 py-2 text-[11px]"
                      style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: muted }}
                    >
                      {accelerationInstallRecommended
                        ? 'Blank runtime detected. Use Download to queue the recommended managed packages in Terminal.'
                        : 'Download uses the current routing mode. Keep routing on Auto or CPU fallback if you do not want CUDA packages.'}
                    </div>

                    {accelerationRuntimeSnapshot.providers.length > 0 ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {accelerationRuntimeSnapshot.providers.map(provider => (
                          <div
                            key={provider.providerKind}
                            className="rounded border px-3 py-3"
                            style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                                {provider.label}
                              </div>
                              <span className="opacity-55">
                                {provider.ready ? 'Ready' : provider.available ? 'Detected' : 'Unavailable'}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] leading-4 opacity-70">
                              {provider.detail}
                            </p>
                            {provider.supportedWorkloadIds.length > 0 ? (
                              <div className="mt-2 text-[10px] uppercase tracking-[0.12em] opacity-50">
                                {provider.supportedWorkloadIds.join(' · ')}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {accelerationWorkloadRoutes.map(route => (
                        <div
                          key={route.definition.id}
                          className="rounded border px-3 py-3"
                          style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                              {route.definition.label}
                            </div>
                            <span className="opacity-55">
                              {route.resolution.provider?.label ?? route.resolution.providerKind}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-4 opacity-65">
                            {route.definition.description}
                          </p>
                          <div className="mt-2 text-[10px] uppercase tracking-[0.12em] opacity-50">
                            {route.resolution.ready
                              ? 'provider ready'
                              : route.resolution.available
                                ? 'provider detected'
                                : 'cpu fallback'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {accelerationRuntimeSnapshot.pythonProbe ? (
                      <div
                        className="mt-3 rounded border px-3 py-3 text-[11px]"
                        style={{ borderColor: border, background: 'rgba(255,255,255,0.02)', color: text }}
                      >
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                          Python CUDA Probe
                        </div>
                        <p className="mt-2 opacity-70">
                          {accelerationRuntimeSnapshot.pythonProbe.platform} · Python {accelerationRuntimeSnapshot.pythonProbe.pythonVersion}
                          {accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices
                            ? ` · CUDA_VISIBLE_DEVICES=${accelerationRuntimeSnapshot.pythonProbe.cudaVisibleDevices}`
                            : ''}
                        </p>
                        {accelerationRuntimeSnapshot.pythonProbe.torch.devices.length > 0 ? (
                          <p className="mt-2 opacity-65">
                            Torch devices: {accelerationRuntimeSnapshot.pythonProbe.torch.devices.map(device => device.name).join(', ')}
                          </p>
                        ) : null}
                        {accelerationRuntimeSnapshot.pythonProbe.optionalModules.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {accelerationRuntimeSnapshot.pythonProbe.optionalModules.map(module => (
                              <span
                                key={module.id}
                                className="rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                                style={{ borderColor: border, background: 'rgba(255,255,255,0.03)', color: text }}
                              >
                                {module.id} · {module.imported ? 'ready' : module.installed ? 'installed' : 'missing'}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Developer Mode</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Enables live watchers and hot reload for plugins, shaders, animations, and explorer metadata. Leave this off for the normal production path and use manual refresh actions instead.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.developerMode}
                      onChange={event => updateSystem({ developerMode: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="pr-4">
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Developer Telemetry</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Records frontend, bridge, native, and plugin/runtime spans into structured session traces for deep debugging in dev and installed builds.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.developerTelemetryEnabled}
                      onChange={event => updateSystem({ developerTelemetryEnabled: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="pr-4">
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Source Trace Mode</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Dev-only extra trace depth with source-aware stacks and callsites. Pressing {formatHotkeyLabel(settings.keybindings.toggleDeveloperTelemetryHud)} also arms this automatically when the HUD opens.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.sourceTraceModeEnabled}
                      onChange={event => updateSystem({ sourceTraceModeEnabled: event.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                    <div className="pr-4">
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Consumer Diagnostics</div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Keeps local diagnostic traces available for support bundles when themes, plugins, or renderers misbehave in production.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.system.consumerDiagnosticsEnabled}
                      onChange={event => updateSystem({ consumerDiagnosticsEnabled: event.target.checked })}
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Capture Mode</div>
                      <p className="mt-1 opacity-40">Raw keeps the deepest trace. Sampled trims noise. Perf-only records timing without full action detail.</p>
                      <select
                        aria-label="Telemetry Capture Mode"
                        value={settings.system.developerTelemetryCaptureMode}
                        onChange={event => updateSystem({
                          developerTelemetryCaptureMode: event.target.value as typeof settings.system.developerTelemetryCaptureMode,
                        })}
                        className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
                        style={settingsSelectStyle}
                      >
                        <option value="raw">Raw</option>
                        <option value="sampled">Sampled</option>
                        <option value="perf-only">Perf Only</option>
                      </select>
                    </label>
                    <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Payload Detail</div>
                      <p className="mt-1 opacity-40">Metadata-only avoids noisy args. Small payload mode preserves compact command details for debugging.</p>
                      <select
                        aria-label="Telemetry Payload Detail"
                        value={settings.system.developerTelemetryPayloadMode}
                        onChange={event => updateSystem({
                          developerTelemetryPayloadMode: event.target.value as typeof settings.system.developerTelemetryPayloadMode,
                        })}
                        className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
                        style={settingsSelectStyle}
                      >
                        <option value="metadata-only">Metadata Only</option>
                        <option value="metadata+small-payloads">Metadata + Small Payloads</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Max Session File</div>
                      <p className="mt-1 opacity-40">Hard cap before the native writer rolls to the next session file.</p>
                      <input
                        type="number"
                        min={8}
                        max={512}
                        step={1}
                        value={settings.system.developerTelemetryMaxFileSizeMb}
                        onChange={event => updateSystem({
                          developerTelemetryMaxFileSizeMb: Number(event.target.value),
                        })}
                        className="mt-3 w-full rounded border bg-transparent px-2 py-2 text-[11px]"
                        style={settingsFieldStyle}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Write Trace Files</div>
                        <p className="mt-1 opacity-40">Persist session JSONL traces to disk for later inspection and bundle export.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.developerTelemetryWriteToFile}
                        onChange={event => updateSystem({ developerTelemetryWriteToFile: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Show Inspector Surface</div>
                        <p className="mt-1 opacity-40">Keeps the live telemetry inspector lane available for future dev HUD and diagnostics UI.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.developerTelemetryShowInspector}
                        onChange={event => updateSystem({ developerTelemetryShowInspector: event.target.checked })}
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Plugin Runtime Diagnostics</div>
                        <p className="mt-1 opacity-40">Include plugin attribution and execution context in consumer bundles.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.consumerDiagnosticsIncludePluginRuntime}
                        onChange={event => updateSystem({ consumerDiagnosticsIncludePluginRuntime: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Renderer Diagnostics</div>
                        <p className="mt-1 opacity-40">Include renderer/theme execution context in exported support bundles.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.consumerDiagnosticsIncludeRendererRuntime}
                        onChange={event => updateSystem({ consumerDiagnosticsIncludeRendererRuntime: event.target.checked })}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="pr-4">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Perf Samples In Bundles</div>
                        <p className="mt-1 opacity-40">Keep performance timing summaries alongside trace files for support triage.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.system.consumerDiagnosticsIncludePerfSamples}
                        onChange={event => updateSystem({ consumerDiagnosticsIncludePerfSamples: event.target.checked })}
                      />
                    </label>
                  </div>
                  {platform === 'linux' && (
                    <label className="flex items-center justify-between gap-4 rounded border px-3 py-3 text-[11px]" style={{ borderColor: border }}>
                      <div className="min-w-0">
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Linux Display Backend</div>
                        <p className="mt-1 text-[11px] opacity-40">
                          Chooses whether GreebleFS launches through Auto selection, X11 fallback, or native Wayland. Auto will switch to X11 on NVIDIA Wayland sessions when XWayland is available.
                        </p>
                      </div>
                      <select
                        aria-label="Linux Display Backend"
                        value={settings.system.linuxDisplayBackendPreference}
                        disabled={linuxDisplayBackendSyncPending}
                        onChange={event => void setLinuxDisplayBackendPreference(
                          event.target.value as LinuxDisplayBackendPreference,
                        )}
                        className="min-w-[140px] rounded border bg-transparent px-2 py-1 text-[11px]"
                        style={settingsSelectStyle}
                      >
                        <option value="auto">Auto</option>
                        <option
                          value="x11"
                          disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('x11')}
                        >
                          X11
                        </option>
                        <option
                          value="wayland"
                          disabled={linuxDisplayBackendStatus != null && !availableLinuxDisplayBackends.includes('wayland')}
                        >
                          Wayland
                        </option>
                      </select>
                    </label>
                  )}
                  <div className="rounded border px-3 py-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-60">Telemetry Session</div>
                        <p className="mt-1 opacity-40">
                          {telemetryStatusPending
                            ? 'Refreshing telemetry session status...'
                            : telemetryStatusError
                              ? `Telemetry unavailable: ${telemetryStatusError}`
                              : telemetryStatus == null
                                ? 'No telemetry session has been created yet.'
                                : `Enabled ${telemetryStatus.config.developer_telemetry_enabled || telemetryStatus.config.consumer_diagnostics_enabled ? 'yes' : 'no'} · records ${telemetryStatus.recent_record_count} · session ${telemetryStatus.session_id} · file ${telemetryStatus.current_file_path ?? 'not started'}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void refreshTelemetryStatus()}
                          className="rounded border px-3 py-2 transition-colors"
                          style={{ borderColor: border }}
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTelemetryExport()}
                          disabled={telemetryActionPending != null}
                          className="rounded border px-3 py-2 transition-colors disabled:opacity-50"
                          style={{ borderColor: border }}
                        >
                          {telemetryActionPending === 'export' ? 'Exporting...' : 'Export Support Bundle'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTelemetryClear()}
                          disabled={telemetryActionPending != null}
                          className="rounded border px-3 py-2 transition-colors disabled:opacity-50"
                          style={{ borderColor: border, color: '#fca5a5' }}
                        >
                          {telemetryActionPending === 'clear' ? 'Clearing...' : 'Clear Sessions'}
                        </button>
                      </div>
                    </div>
                    {telemetryNotice ? (
                      <div className="mt-3 rounded border px-3 py-2" style={{ borderColor: border, color: text }}>
                        {telemetryNotice}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)', color: startupSyncError ? '#fda4af' : muted }}>
                    {startupSyncPending
                      ? 'Updating OS startup registration...'
                      : startupSyncError
                        ? `Startup registration failed: ${startupSyncError}`
                        : `Current status: startup ${settings.system.launchAtStartup ? 'enabled' : 'disabled'} · mobile share boot ${settings.system.startMobileShareOnBoot ? 'enabled' : 'disabled'} · tray ${systemPresentationState.trayVisible ? 'enabled' : 'disabled'} · ${platform === 'macos' ? 'Dock' : 'taskbar'} ${systemPresentationState.taskbarVisible ? 'enabled' : 'disabled'} · recovery path ${systemPresentationState.recoveryPath === 'tray' ? (platform === 'macos' ? 'Dock' : 'tray') : platform === 'macos' ? 'Dock' : 'taskbar'} · developer mode ${settings.system.developerMode ? 'enabled' : 'disabled'} · deep telemetry ${settings.system.developerTelemetryEnabled ? 'enabled' : 'disabled'} · source trace ${settings.system.sourceTraceModeEnabled ? 'enabled' : 'disabled'} · consumer diagnostics ${settings.system.consumerDiagnosticsEnabled ? 'enabled' : 'disabled'}${platform === 'linux' && linuxDisplayBackendStatusSummary ? ` · ${linuxDisplayBackendStatusSummary}` : ''}`}
                  </div>
                </div>
              </section>
            )}

            )}
            */}

        {activeSection === "explorer" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<FolderOpen size={12} />}
              title="Explorer"
              subtitle="Startup path, folder activation, visibility rules, and bookmark quality-of-life."
            />

            <div className="mt-4 space-y-3">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      File Clicking
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Choose how folders activate in the browser. Files still
                      preview on single click and open on double click.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {settings.explorer.folderClickMode === "single"
                      ? "Single Click"
                      : "Double Click"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(
                    [
                      {
                        value: "single",
                        label: "Single Click",
                        description:
                          "Open folders on the first plain click, closer to a content-browser flow.",
                      },
                      {
                        value: "double",
                        label: "Double Click",
                        description:
                          "Keep folders selection-first and require a second click to enter them.",
                      },
                    ] as const
                  ).map((option) => {
                    const active =
                      settings.explorer.folderClickMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateExplorer({ folderClickMode: option.value })
                        }
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {option.label}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Content Layout
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Match the explorer to a UE-style content browser. Ctrl/Cmd
                      + wheel in the explorer steps through these modes without
                      shrinking the whole UI.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {
                      getExplorerViewModeDefinition(settings.explorer.viewMode)
                        .label
                    }
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {explorerViewModes.map((option) => {
                    const active = settings.explorer.viewMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateExplorer({ viewMode: option.id })}
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {option.label}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Thumbnail Rendering
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Generated thumbnails replace file icons with native
                      previews for images, 3D models, code, shaders, audio
                      waveforms, and video posters. Video hover-scrub uses a
                      cached frame montage instead of live playback.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {settings.explorer.thumbnails.enabled
                      ? "Enabled"
                      : "Disabled"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <span>Enable Generated Thumbnails</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            enabled: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>Video Hover Scrub</span>
                    <input
                      type="checkbox"
                      checked={
                        settings.explorer.thumbnails.enableVideoHoverScrub
                      }
                      disabled={
                        !settings.explorer.thumbnails.enabled ||
                        !settings.explorer.thumbnails.includeVideo
                      }
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            enableVideoHoverScrub: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>Image Files</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.includeImages}
                      disabled={!settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            includeImages: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>3D Models</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.includeModels}
                      disabled={!settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            includeModels: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>Code Files</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.includeCode}
                      disabled={!settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            includeCode: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>Shader Files</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.includeShaders}
                      disabled={!settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            includeShaders: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>Audio Waveforms</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.includeAudio}
                      disabled={!settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            includeAudio: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      opacity: settings.explorer.thumbnails.enabled ? 1 : 0.55,
                    }}
                  >
                    <span>Video Posters</span>
                    <input
                      type="checkbox"
                      checked={settings.explorer.thumbnails.includeVideo}
                      disabled={!settings.explorer.thumbnails.enabled}
                      onChange={(event) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            includeVideo: event.target.checked,
                          },
                        })
                      }
                    />
                  </label>
                </div>

                <div
                  className="mt-3 rounded border px-3 py-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.03)",
                    opacity:
                      settings.explorer.thumbnails.enabled &&
                      settings.explorer.thumbnails.enableVideoHoverScrub &&
                      settings.explorer.thumbnails.includeVideo
                        ? 1
                        : 0.55,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Hover Montage Frames
                      </div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Cached frame count for each video hover-scrub sequence.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {settings.explorer.thumbnails.videoHoverScrubFrameCount}{" "}
                      frames
                    </span>
                  </div>
                  <div className="mt-3">
                    <PremiumSlider
                      ariaLabel="Hover Montage Frames"
                      ariaValueText={`${settings.explorer.thumbnails.videoHoverScrubFrameCount} frames`}
                      min={1}
                      max={10}
                      step={1}
                      value={
                        settings.explorer.thumbnails.videoHoverScrubFrameCount
                      }
                      disabled={
                        !settings.explorer.thumbnails.enabled ||
                        !settings.explorer.thumbnails.enableVideoHoverScrub ||
                        !settings.explorer.thumbnails.includeVideo
                      }
                      onChange={(value) =>
                        updateExplorer({
                          thumbnails: {
                            ...settings.explorer.thumbnails,
                            videoHoverScrubFrameCount:
                              clampVideoHoverScrubFrameCount(value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  Startup Path
                </label>
                <input
                  value={settings.explorer.defaultPath}
                  onChange={(event) =>
                    updateExplorer({ defaultPath: event.target.value })
                  }
                  className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.04)",
                    color: text,
                    fontFamily: appearance.fonts.mono,
                  }}
                />
                <p className="text-[11px] opacity-40">
                  Use `.` to prefer the detected home directory for the current
                  machine.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label
                  className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <span>Show Hidden Files</span>
                  <input
                    type="checkbox"
                    checked={settings.explorer.showHiddenFiles}
                    onChange={(event) =>
                      updateExplorer({ showHiddenFiles: event.target.checked })
                    }
                  />
                </label>
                <label
                  className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <div className="pr-4">
                    <div>Double-Click Empty Space to Go Up/Back</div>
                    <p className="mt-1 text-[10px] opacity-45">
                      Navigates to the parent directory when double-clicking on
                      empty space in the file area.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.explorer.doubleClickEmptyToGoBack}
                    onChange={(event) =>
                      updateExplorer({
                        doubleClickEmptyToGoBack: event.target.checked,
                      })
                    }
                  />
                </label>
                <label
                  className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <span>Confirm Delete</span>
                  <input
                    type="checkbox"
                    checked={settings.explorer.confirmDelete}
                    onChange={(event) =>
                      updateExplorer({ confirmDelete: event.target.checked })
                    }
                  />
                </label>
              </div>

              <div
                className="rounded border p-3"
                style={{ borderColor: border, background: `${accent}0d` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[760px]">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: muted }}
                    >
                      Context Menus
                    </div>
                    <p
                      className="mt-2 text-[12px] leading-5"
                      style={{ color: muted }}
                    >
                      Explorer context menus now have a dedicated settings
                      surface for menu packs, renderer selection, per-context
                      layout overrides, and future shareable menu setups. Use
                      that lane instead of digging through Explorer defaults.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection("context-menus")}
                    className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${accent}55`,
                      background: `${accent}14`,
                      color: text,
                    }}
                  >
                    Open Context Menus
                  </button>
                </div>
              </div>

              <button
                onClick={() => void seedDefaultBookmarks()}
                className="w-full rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  background: `${accent}18`,
                  color: text,
                  border: `1px solid ${accent}55`,
                }}
              >
                Seed Platform Bookmarks
              </button>
            </div>
          </section>
        )}

        {activeSection === "context-menus" && (
          <ContextMenusSettingsSection
            detail={activeSectionMeta.detail}
            appearance={appearance}
            border={border}
            accent={accent}
            text={text}
            muted={muted}
            settingsSelectStyle={settingsSelectStyle}
            settingsFieldStyle={settingsFieldStyle}
            activeMenuPack={activeMenuPack}
            menuPacks={menuPacks}
            customizedContextCount={
              Object.keys(settings.explorer.contextMenuLayoutOverridesByContext)
                .length
            }
            menuPacksWarnings={menuPacksWarnings}
            actionsWarnings={actionsWarnings}
            activeContextMenuContext={activeContextMenuContext}
            setActiveContextMenuComposerContext={
              setActiveContextMenuComposerContext
            }
            onRefreshMenuPacks={onRefreshMenuPacks}
            onRefreshActions={onRefreshActions}
            onOpenMenuPacksFolder={onOpenMenuPacksFolder}
            onOpenActionsFolder={onOpenActionsFolder}
            resetContextMenuLayout={resetContextMenuLayout}
            resetAllContextMenuLayouts={resetAllContextMenuLayouts}
            setActiveMenuPackId={(packId) =>
              updateExplorer({ activeMenuPackId: packId })
            }
            activeContextMenuLayout={activeContextMenuLayout}
            setContextMenuRendererForActiveContext={
              setContextMenuRendererForActiveContext
            }
            menuPacksLoading={menuPacksLoading}
            menuPacksDirectory={menuPacksDirectory}
            menuPacksError={menuPacksError}
            actionsLoading={actionsLoading}
            actions={actions}
            actionPacks={actionPacks}
            actionsDirectory={actionsDirectory}
            actionsError={actionsError}
            contextMenuCommandDraftByContext={contextMenuCommandDraftByContext}
            setContextMenuCommandDraftByContext={
              setContextMenuCommandDraftByContext
            }
            availableContextMenuCommandsForActiveContext={
              availableContextMenuCommandsForActiveContext
            }
            addContextMenuCommandEntry={addContextMenuCommandEntry}
            insertContextMenuCommandEntryAt={insertContextMenuCommandEntryAt}
            contextMenuGroupDraftByContext={contextMenuGroupDraftByContext}
            setContextMenuGroupDraftByContext={
              setContextMenuGroupDraftByContext
            }
            addContextMenuGroupSlot={addContextMenuGroupSlot}
            insertContextMenuGroupSlotAt={insertContextMenuGroupSlotAt}
            addContextMenuSubmenu={addContextMenuSubmenu}
            insertContextMenuSubmenuAt={insertContextMenuSubmenuAt}
            addContextMenuSeparator={addContextMenuSeparator}
            insertContextMenuSeparatorAt={insertContextMenuSeparatorAt}
            filteredContextMenuBrowserCommands={
              filteredContextMenuBrowserCommands
            }
            contextMenuCommandBrowserQuery={contextMenuCommandBrowserQuery}
            setContextMenuCommandBrowserQuery={
              setContextMenuCommandBrowserQuery
            }
            contextMenuPreviewMenu={contextMenuPreviewMenu}
            selectedContextMenuPreviewNodeId={selectedContextMenuPreviewNodeId}
            selectContextMenuEntryFromRuntimeNode={
              selectContextMenuEntryFromRuntimeNode
            }
            activeContextMenuEntries={activeContextMenuEntries}
            selectedContextMenuEntryId={selectedContextMenuEntryId}
            setSelectedContextMenuEntryId={setSelectedContextMenuEntryId}
            draggedContextMenuEntryId={draggedContextMenuEntryId}
            setDraggedContextMenuEntryId={setDraggedContextMenuEntryId}
            contextMenuCommandLookup={contextMenuCommandLookup}
            selectedContextMenuEntry={selectedContextMenuEntry}
            activeContextMenuSubmenus={activeContextMenuSubmenus}
            selectedContextMenuSiblingIndex={selectedContextMenuSiblingIndex}
            selectedContextMenuSiblingEntriesCount={
              selectedContextMenuSiblingEntries.length
            }
            toggleContextMenuLayoutEntryEnabled={
              toggleContextMenuLayoutEntryEnabled
            }
            setContextMenuSubmenuTitle={setContextMenuSubmenuTitle}
            setContextMenuGroupSlotGroup={setContextMenuGroupSlotGroup}
            setContextMenuGroupSlotSourceFilter={
              setContextMenuGroupSlotSourceFilter
            }
            setContextMenuLayoutEntryParent={setContextMenuLayoutEntryParent}
            setContextMenuLayoutEntryQuickSlot={
              setContextMenuLayoutEntryQuickSlot
            }
            setContextMenuLayoutEntryFallbackBucket={
              setContextMenuLayoutEntryFallbackBucket
            }
            moveContextMenuLayoutEntry={moveContextMenuLayoutEntry}
            removeContextMenuLayoutEntry={removeContextMenuLayoutEntry}
            placeContextMenuLayoutEntryAt={placeContextMenuLayoutEntryAt}
            legacyPluginMenuItemCount={pluginContextMenuItems.length}
            legacyPluginActionCount={pluginExplorerActions.length}
            authoredPluginActionCount={
              actions.filter((action) => action.pluginId != null).length
            }
          />
        )}

        {/*
            {false && activeSection === 'context-menus' && (
              <section className="rounded border p-4" style={{ borderColor: border, background: 'rgba(255,255,255,0.03)' }}>
                <SectionTitle
                  icon={<Puzzle size={12} />}
                  title="Context Menus"
                  subtitle={activeSectionMeta.detail}
                />

                <div className="mt-4 space-y-3">
                  <div className="rounded border p-3" style={{ borderColor: `${accent}44`, background: `${accent}0d` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-[760px]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: muted }}>Explorer Menu Runtime</div>
                        <p className="mt-2 text-[12px] leading-5" style={{ color: muted }}>
                          Context menus are now a first-class authored system. Menu packs define the structure, the command graph defines behavior, themes can steer renderer presentation, and user overrides own the composer layer for shareable setups and future renderer/layout packs.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {activeMenuPack?.name ?? 'No Pack'}
                        </span>
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {menuPacks.length} Pack{menuPacks.length === 1 ? '' : 's'}
                        </span>
                        <span className="rounded border px-2 py-1" style={{ borderColor: border, background: 'rgba(255,255,255,0.04)', color: text }}>
                          {Object.keys(settings.explorer.contextMenuLayoutOverridesByContext).length} Customized Context{Object.keys(settings.explorer.contextMenuLayoutOverridesByContext).length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                    <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Menu Packs</div>
                      <p className="mt-2 opacity-45">
                        Switch authored menu structures without touching command execution. This is the lane for future shared packs, curated defaults, and per-team context menu presets.
                      </p>
                    </div>
                    <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Composer Overrides</div>
                      <p className="mt-2 opacity-45">
                        Reorder nodes, create submenus, assign quick slots, and control fallback buckets per context without hardcoding any renderer-specific UI trees.
                      </p>
                    </div>
                    <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Renderer Growth</div>
                      <p className="mt-2 opacity-45">
                        Classic nested menus ship first, but this section is where radial, hybrid, sheet, HUD, and shared presentation recipes can expand without being buried under generic explorer settings.
                      </p>
                    </div>
                  </div>

                  {contextMenuComposerSurface}
                </div>
              </section>
            )}

            )}
            */}

        {activeSection === "home" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<Home size={12} />}
              title="Home"
              subtitle="Dedicated explorer landing surface with pack selection, preset routing, telemetry, and managed authoring."
            />

            <div className="mt-4 space-y-3">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: `${accent}44`,
                  background: `${accent}0d`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[760px]">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: muted }}
                    >
                      Explorer Home Runtime
                    </div>
                    <p
                      className="mt-2 text-[12px] leading-5"
                      style={{ color: muted }}
                    >
                      Home is no longer the OS home directory. It is now an
                      app-owned explorer surface at{" "}
                      <code>greeblefs://home</code> with pack switching, preset
                      state, and local usage telemetry that feeds most-used and
                      recent folder lanes.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {activeHomePack?.name ?? "No Pack"}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {settings.home.usageTrackingEnabled
                        ? "Usage Tracking On"
                        : "Usage Tracking Off"}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {homePacks.length} Pack{homePacks.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void onRefreshHomePacks()}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    border: `1px solid ${border}`,
                    background: "rgba(255,255,255,0.04)",
                    color: text,
                  }}
                >
                  Refresh Home Packs
                </button>
                <button
                  type="button"
                  onClick={() => void onOpenHomePacksFolder()}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    border: `1px solid ${accent}55`,
                    background: `${accent}16`,
                    color: text,
                  }}
                >
                  Open Home Packs Folder
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetHomeUsage()}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    border: `1px solid ${border}`,
                    background: "rgba(255,255,255,0.04)",
                    color: text,
                  }}
                >
                  Reset Usage Snapshot
                </button>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Managed Root
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Drop authored Home packs into{" "}
                      <code>{homePacksDirectory}</code>. Runtime discovery
                      follows the same managed-content flow as themes and other
                      shell assets.
                    </p>
                  </div>
                  <span
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {homePacksLoading ? "Scanning" : "Ready"}
                  </span>
                </div>
                <div
                  className="mt-3 rounded border px-3 py-2 text-[10px]"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.12)",
                    color: muted,
                    fontFamily: appearance.fonts.mono,
                  }}
                >
                  {homePacksDirectory}
                </div>
                {homePacksError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "#7f1d1d",
                      background: "rgba(127,29,29,0.18)",
                      color: "#fecaca",
                    }}
                  >
                    {homePacksError}
                  </div>
                ) : null}
                {[...new Set([...homePacksWarnings, ...homeSelection.warnings])]
                  .length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {[
                      ...new Set([
                        ...homePacksWarnings,
                        ...homeSelection.warnings,
                      ]),
                    ].map((warning) => (
                      <div
                        key={warning}
                        className="rounded border px-3 py-2 text-[11px]"
                        style={{
                          borderColor: "rgba(245,158,11,0.28)",
                          background: "rgba(120,53,15,0.18)",
                          color: "#fde68a",
                        }}
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_0.65fr]">
                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Home Pack
                      </div>
                      <p className="mt-1 text-[11px] opacity-40">
                        App themes can suggest a Home pack, but the Home
                        selection persists independently.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      Theme Suggestion ·{" "}
                      {appearance.baseTheme.defaultHomePackId ?? "None"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {homePacks.map((pack) => {
                      const active = activeHomePack?.id === pack.id;
                      return (
                        <button
                          key={pack.id}
                          type="button"
                          onClick={() => updateHome({ activePackId: pack.id })}
                          className="rounded px-3 py-3 text-left transition-colors"
                          style={{
                            border: `1px solid ${active ? accent : border}`,
                            background: active
                              ? `${accent}14`
                              : "rgba(255,255,255,0.03)",
                            color: text,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold">
                                {pack.name}
                              </div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-50">
                                {pack.sourceKind === "built-in"
                                  ? "Built-In"
                                  : "Home Folder"}
                              </div>
                            </div>
                            {pack.warnings.length > 0 ? (
                              <ThemeBadge
                                label={`${pack.warnings.length} warn`}
                              />
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] opacity-45">
                            {pack.description ?? "No description provided."}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Usage Telemetry
                  </div>
                  <p className="mt-1 text-[11px] opacity-40">
                    Successful local folder navigations feed the Home most-used
                    and recent lanes. Cloud and virtual paths are ignored.
                  </p>

                  <label
                    className="mt-3 flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <span>Enable local Home usage tracking</span>
                    <input
                      type="checkbox"
                      checked={settings.home.usageTrackingEnabled}
                      onChange={(event) =>
                        updateHome({
                          usageTrackingEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div
                      className="rounded border px-3 py-2"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div className="opacity-50">Most Used</div>
                      <div className="mt-1 font-semibold">
                        {homeMostUsedFolders.length}
                      </div>
                    </div>
                    <div
                      className="rounded border px-3 py-2"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div className="opacity-50">Recent</div>
                      <div className="mt-1 font-semibold">
                        {homeRecentFolders.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activeHomePack?.runtime.presets.length ? (
                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Preset
                      </div>
                      <p className="mt-1 text-[11px] opacity-40">
                        Presets let a single pack ship multiple home layouts
                        without changing the active pack itself.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {activeHomePresetId ?? "Default"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {activeHomePack.runtime.presets.map((preset) => {
                      const active = activeHomePresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setHomePresetSelection(activeHomePack.id, preset.id)
                          }
                          className="rounded px-3 py-3 text-left transition-colors"
                          style={{
                            border: `1px solid ${active ? accent : border}`,
                            background: active
                              ? `${accent}14`
                              : "rgba(255,255,255,0.03)",
                            color: text,
                          }}
                        >
                          <div className="text-[11px] font-semibold">
                            {preset.name}
                          </div>
                          <p className="mt-1 text-[11px] opacity-45">
                            {preset.description ??
                              `${preset.modules.length} host modules`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Telemetry Preview
                  </div>
                  <div className="mt-3 space-y-2">
                    {homeMostUsedFolders.slice(0, 4).map((entry) => (
                      <div
                        key={`most-used-${entry.path}`}
                        className="rounded border px-3 py-2 text-[11px]"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        <div className="font-semibold">{entry.label}</div>
                        <div className="mt-1 opacity-45">{entry.path}</div>
                      </div>
                    ))}
                    {homeMostUsedFolders.length === 0 ? (
                      <div
                        className="rounded border px-3 py-3 text-[11px] opacity-45"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        No usage data yet. Navigate through local folders from
                        Explorer Home or normal directory views to fill this in.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  className="rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Active Pack Settings
                  </div>
                  <div className="mt-3">
                    {ActiveHomePackSettingsComponent &&
                    activeHomePack &&
                    homePackSettingsHost ? (
                      <ActiveHomePackSettingsComponent
                        pack={activeHomePack.runtime}
                        host={homePackSettingsHost}
                      />
                    ) : (
                      <div
                        className="rounded border px-3 py-3 text-[11px] opacity-45"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.03)",
                        }}
                      >
                        The active Home pack does not expose custom settings
                        yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "cloud" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<HardDrive size={12} />}
              title="Cloud Accounts"
              subtitle="Browser-based OAuth for Google Drive and Dropbox, with one drive rail entry per connected account."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: `${accent}44`,
                  background: `${accent}0d`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[720px]">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: muted }}
                    >
                      Cloud Drive Integration
                    </div>
                    <p
                      className="mt-1 text-[11px] leading-5"
                      style={{ color: muted }}
                    >
                      Connected accounts appear in the explorer `Drives` rail as
                      first-class locations. Tokens stay in the OS keychain;
                      only lightweight account metadata is kept in app storage.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {connectedCloudAccountCount} Connected
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {configuredCloudProviderCount}/2 Providers Ready
                    </span>
                  </div>
                </div>
                {cloudNotice ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: `${accent}55`,
                      background: `${accent}10`,
                      color: text,
                    }}
                  >
                    {cloudNotice}
                  </div>
                ) : null}
                {cloudError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "rgba(248,113,113,0.4)",
                      background: "rgba(248,113,113,0.12)",
                      color: "#fecaca",
                    }}
                  >
                    {cloudError}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {CLOUD_PROVIDER_IDS.map((providerId) => {
                  const provider = safeCloudSnapshot.providers.find(
                    (item) => item.provider === providerId,
                  ) ?? {
                    provider: providerId,
                    configured: false,
                    missing_configuration: ["client ID"],
                    configuration_source: "none" as const,
                    client_id: null,
                    client_secret_present: false,
                  };
                  const providerAccounts = safeCloudSnapshot.accounts.filter(
                    (account) => account.provider === providerId,
                  );
                  const providerLabel = getCloudProviderLabel(providerId);
                  const providerBusy = cloudAuthProvider === providerId;
                  const providerCredentialBusy =
                    cloudCredentialBusyProvider === providerId;
                  const providerDraft = cloudCredentialDrafts[providerId];
                  const providerActionDisabled =
                    providerBusy || providerCredentialBusy;

                  return (
                    <div
                      key={providerId}
                      className="rounded border p-3"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.025)",
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-[520px]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                            {providerLabel}
                          </div>
                          <p className="mt-1 text-[11px] opacity-40">
                            {provider.configured
                              ? "Use the system browser to connect one or more accounts. Each connected account becomes its own explorer drive."
                              : "Save a client ID here to enable browser login without external environment variables."}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={
                            !provider.configured || providerActionDisabled
                          }
                          onClick={() => void connectCloudProvider(providerId)}
                          className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                          style={{
                            border: `1px solid ${provider.configured ? `${accent}55` : border}`,
                            background: provider.configured
                              ? `${accent}18`
                              : "rgba(255,255,255,0.04)",
                            color: provider.configured ? text : muted,
                            opacity: providerActionDisabled ? 0.7 : 1,
                          }}
                        >
                          {providerBusy
                            ? "Waiting..."
                            : providerAccounts.length > 0
                              ? "Connect Another"
                              : "Connect Account"}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                        <span
                          className="rounded border px-2 py-1"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.04)",
                            color: provider.configured ? text : "#fda4af",
                          }}
                        >
                          {provider.configured
                            ? "Configured"
                            : "Needs Credentials"}
                        </span>
                        <span
                          className="rounded border px-2 py-1"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.04)",
                            color: text,
                          }}
                        >
                          {getCloudProviderConfigurationSourceLabel(
                            provider.configuration_source,
                          )}
                        </span>
                        <span
                          className="rounded border px-2 py-1"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.04)",
                            color: text,
                          }}
                        >
                          {provider.client_secret_present
                            ? "Secret Stored"
                            : "No Secret"}
                        </span>
                        <span
                          className="rounded border px-2 py-1"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.04)",
                            color: text,
                          }}
                        >
                          {providerAccounts.length} account
                          {providerAccounts.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      {!provider.configured &&
                      provider.missing_configuration.length > 0 ? (
                        <div
                          className="mt-3 rounded border px-3 py-2 text-[11px]"
                          style={{
                            borderColor: "rgba(248,113,113,0.28)",
                            background: "rgba(248,113,113,0.08)",
                            color: "#fecaca",
                          }}
                        >
                          Missing: {provider.missing_configuration.join(", ")}
                        </div>
                      ) : null}

                      <div
                        className="mt-4 space-y-3 rounded border p-3"
                        style={{
                          borderColor: border,
                          background: "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                              {providerLabel} Client ID
                            </label>
                            <input
                              aria-label={`${providerLabel} client ID`}
                              value={providerDraft.clientId}
                              onChange={(event) =>
                                updateCloudCredentialDraft(
                                  providerId,
                                  "clientId",
                                  event.target.value,
                                )
                              }
                              placeholder={
                                providerId === "google-drive"
                                  ? "Google OAuth client ID"
                                  : "Dropbox app key / client ID"
                              }
                              className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                              style={{
                                borderColor: border,
                                background: "rgba(255,255,255,0.04)",
                                color: text,
                                fontFamily: appearance.fonts.mono,
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                              {providerLabel} Client Secret
                            </label>
                            <input
                              aria-label={`${providerLabel} client secret`}
                              type="password"
                              value={providerDraft.clientSecret}
                              onChange={(event) =>
                                updateCloudCredentialDraft(
                                  providerId,
                                  "clientSecret",
                                  event.target.value,
                                )
                              }
                              placeholder={
                                provider.client_secret_present
                                  ? "Stored in keychain. Type to replace or leave blank."
                                  : "Optional, depending on provider app setup"
                              }
                              className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                              style={{
                                borderColor: border,
                                background: "rgba(255,255,255,0.04)",
                                color: text,
                                fontFamily: appearance.fonts.mono,
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              providerActionDisabled ||
                              providerDraft.clientId.trim().length === 0
                            }
                            onClick={() =>
                              void saveCloudProviderCredentials(providerId)
                            }
                            className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              border: `1px solid ${accent}55`,
                              background: `${accent}18`,
                              color: text,
                              opacity: providerActionDisabled ? 0.7 : 1,
                            }}
                          >
                            {providerCredentialBusy &&
                            cloudCredentialBusyAction === "save"
                              ? "Saving..."
                              : "Save Credentials"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              providerActionDisabled ||
                              provider.configuration_source !== "settings"
                            }
                            onClick={() =>
                              void clearSavedCloudProviderCredentials(
                                providerId,
                              )
                            }
                            className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              border: `1px solid ${border}`,
                              background: "rgba(255,255,255,0.04)",
                              color: muted,
                              opacity: providerActionDisabled ? 0.7 : 1,
                            }}
                          >
                            {providerCredentialBusy &&
                            cloudCredentialBusyAction === "clear"
                              ? "Clearing..."
                              : "Clear Saved"}
                          </button>
                        </div>

                        <div
                          className="space-y-1 text-[11px] opacity-45"
                          style={{ color: muted }}
                        >
                          {providerId === "google-drive" ? (
                            <p>
                              Use a Google Cloud OAuth desktop client. This flow
                              uses the system browser, PKCE, and a localhost
                              callback. Bundled credentials can come from
                              ignored{" "}
                              <span
                                style={{ fontFamily: appearance.fonts.mono }}
                              >
                                .env
                              </span>{" "}
                              files at build time, or you can override them here
                              per machine.
                            </p>
                          ) : (
                            <p>
                              Register{" "}
                              <span
                                style={{ fontFamily: appearance.fonts.mono }}
                              >
                                {DROPBOX_CALLBACK_URI}
                              </span>{" "}
                              in the Dropbox App Console. The callback URI is
                              fixed so it can be whitelisted.
                            </p>
                          )}
                          <p>
                            Client secrets stay in the OS keychain when
                            provided. Leave the secret blank if your client type
                            does not require one.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {providerAccounts.length === 0 ? (
                          <div
                            className="rounded border px-3 py-3 text-[11px] opacity-45"
                            style={{
                              borderColor: border,
                              background: "rgba(255,255,255,0.02)",
                              color: muted,
                            }}
                          >
                            {cloudLoading
                              ? "Loading account state..."
                              : `No ${providerLabel} accounts connected yet.`}
                          </div>
                        ) : (
                          providerAccounts.map((account) => (
                            <div
                              key={account.id}
                              className="rounded border p-3"
                              style={{
                                borderColor: border,
                                background: "rgba(255,255,255,0.03)",
                              }}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="text-[11px] font-semibold"
                                    style={{ color: text }}
                                  >
                                    {account.display_name}
                                  </div>
                                  <div
                                    className="mt-1 text-[11px] opacity-45"
                                    style={{ color: muted }}
                                  >
                                    {account.email}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                                    <span
                                      className="rounded border px-2 py-1"
                                      style={{
                                        borderColor: border,
                                        background: "rgba(255,255,255,0.04)",
                                        color:
                                          account.status === "connected"
                                            ? text
                                            : "#fda4af",
                                      }}
                                    >
                                      {account.status}
                                    </span>
                                    <span
                                      className="rounded border px-2 py-1"
                                      style={{
                                        borderColor: border,
                                        background: "rgba(255,255,255,0.04)",
                                        color: text,
                                      }}
                                    >
                                      {account.drive_label}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void disconnectProviderAccount(account)
                                  }
                                  className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                  style={{
                                    border: `1px solid ${border}`,
                                    background: "rgba(255,255,255,0.04)",
                                    color: muted,
                                  }}
                                >
                                  Disconnect
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void refreshCloudAccounts()}
                className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                  border: `1px solid ${border}`,
                }}
              >
                <RefreshCw size={11} />
                Refresh Cloud Status
              </button>
            </div>
          </section>
        )}

        {activeSection === "mobile" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<ShieldCheck size={12} />}
              title="Mobile Access"
              subtitle="Serve the mobile PWA over the local network or a tailnet URL, then keep the desktop-hosted file explorer reachable from the phone."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: `${accent}44`,
                  background: `${accent}0d`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[760px]">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: muted }}
                    >
                      Mobile Delivery Path
                    </div>
                    <p
                      className="mt-1 text-[11px] leading-5"
                      style={{ color: muted }}
                    >
                      The mobile share launcher reads this section directly.
                      Pick the network path first, then start the share for the
                      current explorer folder when you want the phone shell to
                      come online.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {mobileRemoteAccessDefinition.label}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {settings.mobile.tailscaleHostname
                        ? "Custom Hostname"
                        : "Auto Hostname"}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: mobileShareSession ? text : muted,
                      }}
                    >
                      {mobileShareSession
                        ? "Share Live"
                        : mobileSharePending
                          ? "Updating"
                          : "Share Offline"}
                    </span>
                  </div>
                </div>

                {mobileShareNotice ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: `${accent}55`,
                      background: `${accent}10`,
                      color: text,
                    }}
                  >
                    {mobileShareNotice}
                  </div>
                ) : null}
                {mobileShareError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "rgba(248,113,113,0.4)",
                      background: "rgba(248,113,113,0.12)",
                      color: "#fecaca",
                    }}
                  >
                    {mobileShareError}
                  </div>
                ) : null}
                {mobileShareSession ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div
                      className="rounded border px-3 py-3 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Live Share Path
                      </div>
                      <div className="mt-2 opacity-75 break-all">
                        {mobileShareSession.sharePath}
                      </div>
                    </div>
                    <div
                      className="rounded border px-3 py-3 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Preferred Phone URL
                      </div>
                      <div className="mt-2 opacity-75 break-all">
                        {mobileShareSession.preferredUrl}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <OverlayActionButton
                    appearance={appearance}
                    tone="accent"
                    disabled={mobileSharePending}
                    onClick={() => void startMobileShareFromSettings()}
                  >
                    {mobileSharePhase === "starting"
                      ? "Starting..."
                      : mobileShareSession
                        ? `Restart ${mobileRemoteAccessDefinition.launchBadge} Share`
                        : `Start ${mobileRemoteAccessDefinition.launchBadge} Share`}
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone="neutral"
                    disabled={mobileSharePending}
                    onClick={() => void stopMobileShareFromSettings()}
                  >
                    {mobileSharePhase === "stopping"
                      ? "Stopping..."
                      : "Stop Mobile Share"}
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    tone="neutral"
                    disabled={mobileSharePending}
                    onClick={() => void openMobileQrDialogFromSettings()}
                  >
                    <Smartphone size={11} />
                    Show QR Codes
                  </OverlayActionButton>
                </div>

                {mobileShareRouteMismatch ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: `${accent}55`,
                      background: "rgba(255,255,255,0.03)",
                      color: text,
                    }}
                  >
                    The live share is still using{" "}
                    <span style={{ color: accent }}>
                      {
                        getMobileRemoteAccessModeDefinition(
                          mobileShareSession!.remoteAccessMode,
                        ).label
                      }
                    </span>
                    . Restart the share or use{" "}
                    <span style={{ color: accent }}>Show QR Codes</span> to
                    regenerate the pairing routes for the newly selected mode.
                  </div>
                ) : null}

                <div
                  className="mt-4 rounded border p-3"
                  style={{
                    borderColor: border,
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-[760px]">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        Pairing Codes
                      </div>
                      <p className="mt-1 text-[11px] leading-5 opacity-45">
                        The same QR surface is available here and from the phone
                        button. Keep it live in Settings when you want a stable
                        pairing handoff instead of relying on the top-bar
                        chrome.
                      </p>
                    </div>
                    <span
                      className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: mobileShareSession ? text : muted,
                      }}
                    >
                      {mobileShareSession ? "Codes Live" : "Awaiting Share"}
                    </span>
                  </div>

                  <div className="mt-3">
                    <MobileShareConnectionCards
                      appearance={appearance}
                      session={mobileShareSession}
                      emptyState={
                        <div
                          className="rounded border px-4 py-8 text-center"
                          style={{
                            borderColor: border,
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          <div
                            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: text }}
                          >
                            No Live QR Cards Yet
                          </div>
                          <p
                            className="mt-2 text-[11px] leading-5"
                            style={{ color: muted }}
                          >
                            Start the {mobileRemoteAccessDefinition.label} share
                            for the current explorer path and the pairing QR
                            cards will stay visible here.
                          </p>
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Remote Access Mode
                  </div>
                  <p className="mt-1 text-[11px] opacity-40">
                    `Local LAN` keeps the current hotspot or same-network path.
                    `Tailscale` makes the launcher prefer a tailnet URL and
                    tries to use a Tailscale-issued HTTPS certificate when the
                    tailnet is configured for it.
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {mobileRemoteAccessModeDefinitions.map((option) => {
                    const active =
                      settings.mobile.remoteAccessMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          updateMobile({ remoteAccessMode: option.id })
                        }
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {option.label}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[760px]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Mobile Theme
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Colors, fonts, icon theme, folder rules, and thumbnails
                      still come from the paired desktop shell. This lane only
                      shapes the mobile browse layout so the phone UI can feel
                      like a premium files app instead of a raw list.
                    </p>
                  </div>
                  <div
                    className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    {settings.mobile.layout.viewMode === "list"
                      ? "List"
                      : settings.mobile.layout.viewMode === "icons-l"
                        ? "Large Icons"
                        : settings.mobile.layout.viewMode === "icons-s"
                          ? "Compact Icons"
                          : "Medium Icons"}
                    {" · "}
                    UI {settings.mobile.layout.interfaceScale.toFixed(2)}x
                    {" · "}
                    {settings.mobile.layout.touchComfort}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                  <div className="space-y-4">
                    <div
                      className="rounded border p-3"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        <LayoutGrid size={12} />
                        View Mode
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
                        {[
                          { id: "icons-l", label: "Large Icons" },
                          { id: "icons-m", label: "Medium Icons" },
                          { id: "icons-s", label: "Compact Icons" },
                          { id: "list", label: "List" },
                        ].map((option) => {
                          const active =
                            settings.mobile.layout.viewMode === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                updateMobile({
                                  layout: {
                                    ...settings.mobile.layout,
                                    viewMode:
                                      option.id as typeof settings.mobile.layout.viewMode,
                                  },
                                })
                              }
                              className="rounded px-3 py-3 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active
                                  ? `${accent}14`
                                  : "rgba(255,255,255,0.03)",
                                color: text,
                              }}
                            >
                              <div className="text-[11px] font-semibold">
                                {option.label}
                              </div>
                              <div className="mt-1 text-[10px] opacity-45">
                                {option.id === "list"
                                  ? "Dense rows for long folders"
                                  : option.id === "icons-l"
                                    ? "Artwork-first browsing"
                                    : option.id === "icons-s"
                                      ? "More cards per screen"
                                      : "Balanced card density"}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          <span>Grid Zoom</span>
                          <span>
                            {settings.mobile.layout.gridZoom.toFixed(2)}x
                          </span>
                        </div>
                        <div className="mt-3">
                          <PremiumSlider
                            value={settings.mobile.layout.gridZoom}
                            min={0.7}
                            max={1.8}
                            step={0.05}
                            onChange={(value) =>
                              updateMobile({
                                layout: {
                                  ...settings.mobile.layout,
                                  gridZoom: value,
                                },
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          <span>Interface Scale</span>
                          <span>
                            {settings.mobile.layout.interfaceScale.toFixed(2)}x
                          </span>
                        </div>
                        <div className="mt-3">
                          <PremiumSlider
                            value={settings.mobile.layout.interfaceScale}
                            min={0.85}
                            max={1.6}
                            step={0.05}
                            onChange={(value) =>
                              updateMobile({
                                layout: {
                                  ...settings.mobile.layout,
                                  interfaceScale: value,
                                },
                              })
                            }
                          />
                        </div>
                        <div className="mt-2 text-[10px] opacity-45">
                          Scales typography, cards, previews, and row density
                          for the whole iPhone shell.
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          <span>Chrome Scale</span>
                          <span>
                            {settings.mobile.layout.chromeScale.toFixed(2)}x
                          </span>
                        </div>
                        <div className="mt-3">
                          <PremiumSlider
                            value={settings.mobile.layout.chromeScale}
                            min={0.85}
                            max={1.6}
                            step={0.05}
                            onChange={(value) =>
                              updateMobile({
                                layout: {
                                  ...settings.mobile.layout,
                                  chromeScale: value,
                                },
                              })
                            }
                          />
                        </div>
                        <div className="mt-2 text-[10px] opacity-45">
                          Tunes the top shell, sticky explorer header, action
                          strip, and bottom dock prominence.
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          <span>Page Gutter</span>
                          <span>{settings.mobile.layout.pagePadding}px</span>
                        </div>
                        <div className="mt-3">
                          <PremiumSlider
                            value={settings.mobile.layout.pagePadding}
                            min={10}
                            max={32}
                            step={1}
                            onChange={(value) =>
                              updateMobile({
                                layout: {
                                  ...settings.mobile.layout,
                                  pagePadding: Math.round(value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="mt-2 text-[10px] opacity-45">
                          Controls how edge-to-edge the phone surface feels once
                          safe-area padding is applied.
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded border p-3"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        <SlidersHorizontal size={12} />
                        Sorting
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {[
                          { id: "name", label: "Name" },
                          { id: "date", label: "Date" },
                          { id: "size", label: "Size" },
                          { id: "type", label: "Type" },
                        ].map((option) => {
                          const active =
                            settings.mobile.layout.sortBy === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                updateMobile({
                                  layout: {
                                    ...settings.mobile.layout,
                                    sortBy:
                                      option.id as typeof settings.mobile.layout.sortBy,
                                  },
                                })
                              }
                              className="rounded px-3 py-3 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active
                                  ? `${accent}14`
                                  : "rgba(255,255,255,0.03)",
                                color: text,
                              }}
                            >
                              <div className="text-[11px] font-semibold">
                                {option.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          {
                            id: "asc",
                            label: "Ascending",
                            icon: <ArrowUp size={12} />,
                          },
                          {
                            id: "desc",
                            label: "Descending",
                            icon: <ArrowDown size={12} />,
                          },
                        ].map((option) => {
                          const active =
                            settings.mobile.layout.sortOrder === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                updateMobile({
                                  layout: {
                                    ...settings.mobile.layout,
                                    sortOrder:
                                      option.id as typeof settings.mobile.layout.sortOrder,
                                  },
                                })
                              }
                              className="inline-flex items-center justify-center gap-2 rounded px-3 py-3 text-[11px] font-semibold transition-colors"
                              style={{
                                border: `1px solid ${active ? accent : border}`,
                                background: active
                                  ? `${accent}14`
                                  : "rgba(255,255,255,0.03)",
                                color: text,
                              }}
                            >
                              {option.icon}
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          Touch Comfort
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                          {[
                            {
                              id: "compact",
                              label: "Compact",
                              description:
                                "Tighter rows and controls when you want more content per screen.",
                            },
                            {
                              id: "balanced",
                              label: "Balanced",
                              description:
                                "Keeps a native-files feel without wasting vertical room.",
                            },
                            {
                              id: "comfortable",
                              label: "Comfortable",
                              description:
                                "Bigger touch targets and breathing room for handheld use.",
                            },
                          ].map((option) => {
                            const active =
                              settings.mobile.layout.touchComfort === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  updateMobile({
                                    layout: {
                                      ...settings.mobile.layout,
                                      touchComfort:
                                        option.id as typeof settings.mobile.layout.touchComfort,
                                    },
                                  })
                                }
                                className="rounded px-3 py-3 text-left transition-colors"
                                style={{
                                  border: `1px solid ${active ? accent : border}`,
                                  background: active
                                    ? `${accent}14`
                                    : "rgba(255,255,255,0.03)",
                                  color: text,
                                }}
                              >
                                <div className="text-[11px] font-semibold">
                                  {option.label}
                                </div>
                                <div className="mt-1 text-[10px] opacity-45">
                                  {option.description}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        id: "directoriesFirst",
                        title: "Directories First",
                        body: "Keep folder cards ahead of files so traversal feels like a real mobile explorer instead of a flat dump.",
                        active: settings.mobile.layout.directoriesFirst,
                      },
                      {
                        id: "showHiddenFiles",
                        title: "Show Hidden Files",
                        body: "Off by default so the phone opens into visible content instead of a wall of dotfiles and config folders.",
                        active: settings.mobile.layout.showHiddenFiles,
                      },
                      {
                        id: "showTabLabels",
                        title: "Show Dock Labels",
                        body: "Keep text labels under the bottom dock icons. Turn this off if you want a tighter Files-style navigation bar.",
                        active: settings.mobile.layout.showTabLabels,
                      },
                    ].map((toggle) => (
                      <button
                        key={toggle.id}
                        type="button"
                        onClick={() =>
                          updateMobile({
                            layout: {
                              ...settings.mobile.layout,
                              [toggle.id]: !toggle.active,
                            },
                          })
                        }
                        className="w-full rounded border px-3 py-3 text-left transition-colors"
                        style={{
                          borderColor: toggle.active ? `${accent}66` : border,
                          background: toggle.active
                            ? `${accent}12`
                            : "rgba(255,255,255,0.02)",
                          color: text,
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-semibold">
                              {toggle.title}
                            </div>
                            <div className="mt-1 text-[11px] leading-5 opacity-45">
                              {toggle.body}
                            </div>
                          </div>
                          <span
                            className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{
                              borderColor: toggle.active
                                ? `${accent}66`
                                : border,
                              background: "rgba(255,255,255,0.03)",
                              color: toggle.active ? accent : muted,
                            }}
                          >
                            {toggle.active ? "On" : "Off"}
                          </span>
                        </div>
                      </button>
                    ))}

                    <div
                      className="rounded border px-3 py-3 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                        <Type size={12} />
                        Current Mobile Layout
                      </div>
                      <div className="mt-3 space-y-2 opacity-75">
                        <div>View: {settings.mobile.layout.viewMode}</div>
                        <div>
                          Sort: {settings.mobile.layout.sortBy} ·{" "}
                          {settings.mobile.layout.sortOrder}
                        </div>
                        <div>
                          Grid Zoom:{" "}
                          {settings.mobile.layout.gridZoom.toFixed(2)}x
                        </div>
                        <div>
                          Interface Scale:{" "}
                          {settings.mobile.layout.interfaceScale.toFixed(2)}x
                        </div>
                        <div>
                          Chrome Scale:{" "}
                          {settings.mobile.layout.chromeScale.toFixed(2)}x
                        </div>
                        <div>
                          Page Gutter: {settings.mobile.layout.pagePadding}px
                        </div>
                        <div>
                          Touch Comfort: {settings.mobile.layout.touchComfort}
                        </div>
                        <div>
                          Folders First:{" "}
                          {settings.mobile.layout.directoriesFirst
                            ? "enabled"
                            : "disabled"}
                        </div>
                        <div>
                          Hidden Files:{" "}
                          {settings.mobile.layout.showHiddenFiles
                            ? "visible"
                            : "hidden"}
                        </div>
                        <div>
                          Dock Labels:{" "}
                          {settings.mobile.layout.showTabLabels
                            ? "shown"
                            : "icon only"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[760px]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Tailscale Control
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      This does not replace Tailscale itself. It uses the local
                      CLI if installed, lets you keep a hostname and optional
                      custom control server in settings, and surfaces the status
                      that matters for mobile share routing.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: tailscaleStatus?.cliAvailable ? text : "#fda4af",
                      }}
                    >
                      {tailscaleStatus?.cliAvailable
                        ? "CLI Ready"
                        : tailscaleStatusPending
                          ? "Checking"
                          : "CLI Missing"}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: tailscaleStatus?.connected ? text : muted,
                      }}
                    >
                      {tailscaleStatus?.connected
                        ? "Connected"
                        : tailscaleStatus?.running
                          ? "Running"
                          : "Disconnected"}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: tailscaleStatus?.certHttpsReady ? text : muted,
                      }}
                    >
                      {tailscaleStatus?.certHttpsReady
                        ? "HTTPS Ready"
                        : "HTTPS Pending"}
                    </span>
                  </div>
                </div>

                {tailscaleNotice ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: `${accent}55`,
                      background: `${accent}10`,
                      color: text,
                    }}
                  >
                    {tailscaleNotice}
                  </div>
                ) : null}
                {tailscaleError ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "rgba(248,113,113,0.4)",
                      background: "rgba(248,113,113,0.12)",
                      color: "#fecaca",
                    }}
                  >
                    {tailscaleError}
                  </div>
                ) : null}
                {!tailscaleError && tailscaleStatus?.diagnosticMessage ? (
                  <div
                    className="mt-3 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.03)",
                      color: text,
                    }}
                  >
                    {tailscaleStatus.diagnosticMessage}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label
                    className="rounded border px-3 py-3 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                      Hostname Override
                    </div>
                    <p className="mt-1 opacity-40">
                      Optional. Leave blank to keep whatever Tailscale currently
                      resolves for this machine.
                    </p>
                    <input
                      value={settings.mobile.tailscaleHostname}
                      onChange={(event) =>
                        updateMobile({ tailscaleHostname: event.target.value })
                      }
                      placeholder="ephemara-rig"
                      className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                  </label>
                  <label
                    className="rounded border px-3 py-3 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                      Control Server
                    </div>
                    <p className="mt-1 opacity-40">
                      Blank means stock Tailscale. Set a URL here later if you
                      want the UI to target a custom Headscale-style control
                      plane.
                    </p>
                    <input
                      value={settings.mobile.tailscaleLoginServer}
                      onChange={(event) =>
                        updateMobile({
                          tailscaleLoginServer: event.target.value,
                        })
                      }
                      placeholder="https://headscale.example.com"
                      className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
                      style={settingsMonoFieldStyle}
                    />
                  </label>
                </div>

                <label
                  className="mt-3 block rounded border px-3 py-3 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                    One-Time Auth Key
                  </div>
                  <p className="mt-1 opacity-40">
                    Optional. This input is not saved to the settings store. Use
                    it when you want to bring a disconnected node online without
                    stepping through the browser login flow.
                  </p>
                  <input
                    type="password"
                    value={tailscaleAuthKeyDraft}
                    onChange={(event) =>
                      setTailscaleAuthKeyDraft(event.target.value)
                    }
                    placeholder="tskey-..."
                    className="mt-3 w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={settingsMonoFieldStyle}
                  />
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={tailscaleActionPending != null}
                    onClick={() => void refreshTailscaleStatus()}
                    className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                      opacity: tailscaleActionPending != null ? 0.7 : 1,
                    }}
                  >
                    <RefreshCw size={11} />
                    Refresh Status
                  </button>
                  <button
                    type="button"
                    disabled={tailscaleActionPending != null}
                    onClick={() => void connectMobileTailscale()}
                    className="inline-flex items-center gap-2 rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${accent}55`,
                      background: `${accent}18`,
                      color: text,
                      opacity: tailscaleActionPending != null ? 0.7 : 1,
                    }}
                  >
                    {tailscaleActionPending === "connect" ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : null}
                    {tailscaleStatus?.connected
                      ? "Apply Hostname"
                      : "Connect Tailscale"}
                  </button>
                  <button
                    type="button"
                    disabled={tailscaleActionPending != null}
                    onClick={() => void disconnectMobileTailscale()}
                    className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                      opacity: tailscaleActionPending != null ? 0.7 : 1,
                    }}
                  >
                    {tailscaleActionPending === "disconnect"
                      ? "Disconnecting..."
                      : "Disconnect Node"}
                  </button>
                  {tailscaleStatus?.authUrl ? (
                    <button
                      type="button"
                      onClick={() => void openUrl(tailscaleStatus.authUrl!)}
                      className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        border: `1px solid ${border}`,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      Open Auth URL
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      void openUrl(mobileAccessExternalLinks.tailscaleDownload)
                    }
                    className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    Get Tailscale
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void openUrl(mobileAccessExternalLinks.tailscaleHttpsDocs)
                    }
                    className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      border: `1px solid ${border}`,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                    }}
                  >
                    HTTPS Docs
                  </button>
                </div>

                {tailscaleStatus ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div
                      className="rounded border px-3 py-3 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Resolved Tailnet Status
                      </div>
                      <div className="mt-2 space-y-1.5 opacity-75">
                        <div>
                          Version: {tailscaleStatus.version ?? "unknown"}
                        </div>
                        <div>
                          Backend: {tailscaleStatus.backendState ?? "unknown"}
                        </div>
                        <div>
                          DNS name: {tailscaleStatus.dnsName ?? "unavailable"}
                        </div>
                        <div>
                          IPv4: {tailscaleStatus.tailscaleIpv4 ?? "unavailable"}
                        </div>
                        <div>
                          Tailnet: {tailscaleStatus.tailnetName ?? "unknown"}
                        </div>
                        <div>
                          User:{" "}
                          {tailscaleStatus.userLoginName ??
                            tailscaleStatus.userDisplayName ??
                            "unknown"}
                        </div>
                      </div>
                    </div>
                    <div
                      className="rounded border px-3 py-3 text-[11px]"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Mobile Share Readiness
                      </div>
                      <div className="mt-2 space-y-1.5 opacity-75">
                        <div>
                          MagicDNS:{" "}
                          {tailscaleStatus.magicDnsEnabled
                            ? "enabled"
                            : "disabled"}
                        </div>
                        <div>
                          Cert domain:{" "}
                          {tailscaleStatus.certDomains[0] ?? "none yet"}
                        </div>
                        <div>
                          Peers: {tailscaleStatus.onlinePeerCount}/
                          {tailscaleStatus.peerCount} online
                        </div>
                        <div>
                          Health:{" "}
                          {tailscaleStatus.healthMessages.length > 0
                            ? tailscaleStatus.healthMessages[0]
                            : "no active warnings"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {activeSection === "audio" && (
          <div className="w-full space-y-6 pt-2 pb-6">
            <SectionTitle
              icon={<Music size={14} />}
              title="Audio Integration"
              subtitle={activeSectionMeta.detail}
            />
            <ThemeBundlePackSettingsSection
              icon={<Volume2 size={12} />}
              title="Sound Packs"
              subtitle="Theme-aware shell sound sets for button clicks, explorer travel, task lifecycle cues, and notification audio."
              catalogTitle="Sound Pack Catalog"
              catalogDescription={
                <>
                  Standalone sound packs live in{" "}
                  <code>{soundPacksDirectory}</code>. Theme bundles can still
                  pin a default sound pack or contribute local packs so the
                  shell voice follows the active theme identity.
                </>
              }
              directoryPath={soundPacksDirectory}
              currentLabel={soundPackSelectionLabel}
              modeLabel={
                settings.audio.activeSoundPackId == null
                  ? "Follow Theme"
                  : "Pinned"
              }
              loading={soundPacksLoading}
              catalogCountLabel={`${availableSoundPackEntries.length} pack${availableSoundPackEntries.length === 1 ? "" : "s"}`}
              standaloneCount={soundPackCatalogCounts.standaloneCount}
              themeContributedCount={
                soundPackCatalogCounts.themeContributedCount
              }
              followThemeDetail={soundPackFollowThemeDetail}
              followThemeDescription="Let the active theme bundle choose the shell sound pack. Shared buttons, explorer navigation, task cues, and notification audio stay aligned to the current theme composition."
              followThemeResolvedLabel={soundPackThemeDefaultLabel}
              followThemeSourceLabel={activeThemeBundleLabel}
              followThemeActive={settings.audio.activeSoundPackId == null}
              activeOptionId={activeSoundPackCardId}
              options={soundPackCardOptions}
              emptyCatalogMessage="No standalone or theme-contributed sound packs are available yet."
              pinnedSelectionMissingMessage={
                soundPackPinnedSelectionMissing
                  ? `The pinned sound pack id ${settings.audio.activeSoundPackId} is no longer available, so the shell is temporarily following the active theme bundle until you pin another one.`
                  : null
              }
              error={soundPacksError}
              errorLabel="Sound-pack scan failed"
              warnings={soundPacksWarnings}
              warningsLabel="Sound-pack warnings"
              onFollowTheme={() => updateAudio({ activeSoundPackId: null })}
              onSelect={(packId) => updateAudio({ activeSoundPackId: packId })}
              onRefresh={onRefreshSoundPacks}
              onOpenFolder={onOpenSoundPacksFolder}
              border={border}
              accent={accent}
              text={text}
              muted={muted}
            />

            <OverviewCard
              title="Sound Routing"
              subtitle="Choose which interaction groups can make noise, set the shell-wide cue volume, and audition the active pack without leaving Settings."
              badges={[
                resolvedPreviewSoundPack?.name ?? "GreebleFS Default",
                settings.audio.soundEffectsEnabled
                  ? "Effects enabled"
                  : "Effects muted",
                `${Math.round(settings.audio.soundEffectsVolume * 100)}% master`,
              ]}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Sound Effects
                      </div>
                      <p className="mt-1 opacity-45">
                        Master toggle for all shell cues. Explicit preview
                        buttons still audition the selected pack.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.audio.soundEffectsEnabled}
                      onChange={(event) =>
                        updateAudio({
                          soundEffectsEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Button Cues
                      </div>
                      <p className="mt-1 opacity-45">
                        Shared shell buttons, toolbar chrome, and action
                        triggers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.audio.buttonSoundsEnabled}
                      onChange={(event) =>
                        updateAudio({
                          buttonSoundsEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Navigation Cues
                      </div>
                      <p className="mt-1 opacity-45">
                        Explorer arrow-key travel, entry-open confirmations, and
                        motion through content.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.audio.navigationSoundsEnabled}
                      onChange={(event) =>
                        updateAudio({
                          navigationSoundsEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Task Cues
                      </div>
                      <p className="mt-1 opacity-45">
                        Copy, move, delete, archive, and other explorer task
                        lifecycle changes.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.audio.taskSoundsEnabled}
                      onChange={(event) =>
                        updateAudio({ taskSoundsEnabled: event.target.checked })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Notification Cues
                      </div>
                      <p className="mt-1 opacity-45">
                        Native notification pings, permission tests, and future
                        host-level alerts.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.audio.notificationSoundsEnabled}
                      onChange={(event) =>
                        updateAudio({
                          notificationSoundsEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <RangeField
                    label="Cue Volume"
                    description="Scales the entire sound-pack lane before per-cue gain and pack master volume apply."
                    min={0}
                    max={1}
                    step={0.01}
                    value={settings.audio.soundEffectsVolume}
                    valueLabel={`${Math.round(settings.audio.soundEffectsVolume * 100)}%`}
                    onChange={(value) =>
                      updateAudio({ soundEffectsVolume: value })
                    }
                  />

                  <div
                    className="rounded border p-3"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.025)",
                    }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                          Cue Preview
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          Preview buttons use the currently resolved pack, even
                          when the live shell is muted, so authored packs can be
                          auditioned safely.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <ThemeBadge
                          label={
                            resolvedPreviewSoundPack?.name ??
                            "GreebleFS Default"
                          }
                        />
                        <ThemeBadge
                          label={`${Object.keys(resolvedPreviewSoundPack?.sounds ?? {}).length}/${overlaySoundEffectCatalog.length} cues`}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {[
                        {
                          id: "shell-button-press" as const,
                          label: "Button Press",
                          description: "Shared shell chrome click.",
                        },
                        {
                          id: "explorer-selection-step" as const,
                          label: "Selection Step",
                          description: "Directional travel in explorer.",
                        },
                        {
                          id: "explorer-open-entry" as const,
                          label: "Open Entry",
                          description: "Open a file or enter a folder.",
                        },
                        {
                          id: "task-success" as const,
                          label: "Task Success",
                          description: "Completed file operation.",
                        },
                        {
                          id: "task-failure" as const,
                          label: "Task Failure",
                          description: "Failed or cancelled operation.",
                        },
                        {
                          id: "notification-info" as const,
                          label: "Notification Ping",
                          description: "Native notification companion cue.",
                        },
                      ].map((preview) => (
                        <button
                          key={preview.id}
                          type="button"
                          onClick={() => {
                            void previewSoundEffect(preview.id);
                          }}
                          className="rounded px-3 py-3 text-left transition-colors"
                          style={{
                            border: `1px solid ${border}`,
                            background: "rgba(255,255,255,0.03)",
                            color: text,
                          }}
                        >
                          <div className="text-[11px] font-semibold">
                            {preview.label}
                          </div>
                          <p className="mt-1 text-[11px] opacity-45">
                            {preview.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </OverviewCard>

            <OverviewCard
              title="Native Notifications"
              subtitle={`Use ${platformLabel} notifications for completed or failed explorer tasks, then keep permission and test routing visible from the same surface.`}
              badges={[
                formatNativeNotificationPermissionLabel(
                  nativeNotificationPermissionState,
                ),
                settings.audio.nativeNotificationsEnabled
                  ? "OS routing on"
                  : "OS routing off",
                nativeNotificationPermissionLoading
                  ? "Checking status"
                  : "Status live",
              ]}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Native Notifications
                      </div>
                      <p className="mt-1 opacity-45">
                        Allow host-level notifications for shell and explorer
                        events.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.audio.nativeNotificationsEnabled}
                      onChange={(event) =>
                        updateAudio({
                          nativeNotificationsEnabled: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Task Success Alerts
                      </div>
                      <p className="mt-1 opacity-45">
                        Send native confirmation when long-running explorer
                        tasks complete successfully.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        settings.audio.nativeTaskSuccessNotificationsEnabled
                      }
                      onChange={(event) =>
                        updateAudio({
                          nativeTaskSuccessNotificationsEnabled:
                            event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label
                    className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                    style={{ borderColor: border }}
                  >
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Task Failure Alerts
                      </div>
                      <p className="mt-1 opacity-45">
                        Surface failed or cancelled explorer tasks through the
                        host notification center.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={
                        settings.audio.nativeTaskFailureNotificationsEnabled
                      }
                      onChange={(event) =>
                        updateAudio({
                          nativeTaskFailureNotificationsEnabled:
                            event.target.checked,
                        })
                      }
                    />
                  </label>
                </div>

                <div
                  className="rounded border px-3 py-3 text-[11px]"
                  style={{
                    borderColor:
                      nativeNotificationPermissionState === "granted"
                        ? `${accent}55`
                        : border,
                    background:
                      nativeNotificationPermissionState === "granted"
                        ? `${accent}12`
                        : "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold uppercase tracking-[0.12em] opacity-60">
                        Permission Status
                      </div>
                      <p className="mt-1 opacity-50">
                        {nativeNotificationPermissionState === "granted"
                          ? `${platformLabel} notifications are ready to receive GreebleFS task alerts.`
                          : nativeNotificationPermissionState === "denied"
                            ? `${platformLabel} notification permission is currently denied. Re-enable it from the OS and then refresh here.`
                            : nativeNotificationPermissionState === "default"
                              ? `${platformLabel} has not granted notification permission yet. Request permission once, then send a test notification to confirm routing.`
                              : `Native notifications are not available in this runtime context, so GreebleFS will stay in-app only.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setNativeNotificationFeedback(null);
                          const granted =
                            await ensureNativeNotificationPermission();
                          await refreshNativeNotificationPermission();
                          setNativeNotificationFeedback(
                            granted
                              ? "Native notification permission granted."
                              : "Notification permission was not granted.",
                          );
                          void previewSoundEffect(
                            granted
                              ? "notification-success"
                              : "notification-error",
                          );
                        }}
                        className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${accent}55`,
                          background: `${accent}16`,
                          color: text,
                        }}
                      >
                        Request Permission
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNativeNotificationFeedback(null);
                          void refreshNativeNotificationPermission();
                        }}
                        className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${border}`,
                          background: "rgba(255,255,255,0.04)",
                          color: text,
                        }}
                      >
                        Refresh Status
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setNativeNotificationFeedback(null);
                          const sent = await sendNativeNotification({
                            title: "GreebleFS Native Notification Test",
                            body: "Host-native notifications and shell audio are wired up and ready.",
                            requestPermission: false,
                          });
                          await refreshNativeNotificationPermission();
                          setNativeNotificationFeedback(
                            sent
                              ? "Test notification sent to the OS notification center."
                              : "Native notification was not sent. Grant permission first or check whether this runtime exposes host notifications.",
                          );
                          void previewSoundEffect(
                            sent ? "notification-info" : "notification-error",
                          );
                        }}
                        className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          border: `1px solid ${border}`,
                          background: "rgba(255,255,255,0.04)",
                          color: text,
                        }}
                      >
                        Send Test Notification
                      </button>
                    </div>
                  </div>

                  {nativeNotificationFeedback ? (
                    <div
                      className="mt-3 rounded border px-3 py-2 text-[11px]"
                      style={{
                        borderColor:
                          nativeNotificationPermissionState === "granted"
                            ? `${accent}44`
                            : border,
                        background:
                          nativeNotificationPermissionState === "granted"
                            ? `${accent}10`
                            : "rgba(255,255,255,0.03)",
                      }}
                    >
                      {nativeNotificationFeedback}
                    </div>
                  ) : null}
                </div>
              </div>
            </OverviewCard>

            <OverviewCard
              title="VST3 Discovery Paths"
              subtitle="Platform standard fallback scans are automatic. Add arbitrary extra paths here for audio workbench discovery."
              badges={[
                `${settings.audio.vst3AdditionalFolders.length} extra path${settings.audio.vst3AdditionalFolders.length === 1 ? "" : "s"}`,
              ]}
            >
              <div className="space-y-2">
                {settings.audio.vst3AdditionalFolders.map((folder, i) => (
                  <div
                    key={folder}
                    className="flex items-center gap-2 rounded border px-3 py-2 text-[11px]"
                    style={{
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex-1 truncate opacity-80">{folder}</div>
                    <button
                      type="button"
                      className="shrink-0 p-1 font-semibold uppercase tracking-[0.14em]"
                      style={{ color: "#ef4444" }}
                      onClick={() => {
                        const clone = [...settings.audio.vst3AdditionalFolders];
                        clone.splice(i, 1);
                        updateAudio({ vst3AdditionalFolders: clone });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {settings.audio.vst3AdditionalFolders.length === 0 && (
                  <div className="py-2 text-[11px] font-style-italic opacity-40">
                    No additional scan paths configured. Default OS paths will
                    still be scanned.
                  </div>
                )}
                <div className="pt-2">
                  <button
                    type="button"
                    className="rounded border px-4 py-2 text-[10px] uppercase font-semibold tracking-[0.1em] transition-opacity hover:opacity-80"
                    style={{
                      borderColor: "rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.05)",
                    }}
                    onClick={async () => {
                      try {
                        const pickerResult = await openExplorerPicker({
                          kind: "openFolders",
                          presentation: "window",
                          title: "Add VST Scan Folders",
                          confirmLabel: "Add Folders",
                          allowCreateDirectory: false,
                          startPath:
                            settings.audio.vst3AdditionalFolders[
                              settings.audio.vst3AdditionalFolders.length - 1
                            ] ?? null,
                        });
                        const pickedFolders = Array.from(
                          new Set(
                            (pickerResult?.entries ?? [])
                              .map((entry) => entry.path.trim())
                              .filter(Boolean),
                          ),
                        );
                        if (pickedFolders.length === 0) {
                          return;
                        }

                        const nextFolders = [
                          ...settings.audio.vst3AdditionalFolders,
                        ];
                        pickedFolders.forEach((folderPath) => {
                          if (!nextFolders.includes(folderPath)) {
                            nextFolders.push(folderPath);
                          }
                        });
                        updateAudio({ vst3AdditionalFolders: nextFolders });
                      } catch (error) {
                        console.error(
                          "OverlayTerm: failed to open the VST folder picker",
                          error,
                        );
                      }
                    }}
                  >
                    Add Folder…
                  </button>
                </div>
              </div>
            </OverviewCard>
          </div>
        )}

        {activeSection === "screenshots" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<Camera size={12} />}
              title="Screenshots"
              subtitle="Default capture behavior, save path, and proof-session polish for the built-in screenshot workflow."
            />

            <div className="mt-4 space-y-4">
              <div
                className="rounded border p-3"
                style={{
                  borderColor: `${accent}44`,
                  background: `${accent}0d`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-[720px]">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: muted }}
                    >
                      Proof Capture Defaults
                    </div>
                    <p
                      className="mt-1 text-[11px] leading-5"
                      style={{ color: muted }}
                    >
                      The Screenshots panel now follows these defaults directly.
                      Pick whether a fresh capture opens as an area snip or a
                      full-screen proof pass, choose the primary output action,
                      and decide whether the tool clears back to the library
                      after a save.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {settings.screenshots.defaultCaptureMode === "monitor"
                        ? "Full Monitor Default"
                        : "Area Snip Default"}
                    </span>
                    <span
                      className="rounded border px-2 py-1"
                      style={{
                        borderColor: border,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      {formatScreenshotOutputActionLabel(
                        settings.screenshots.defaultOutputAction,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      Save Directory
                    </div>
                    <p className="mt-1 text-[11px] opacity-40">
                      Every saved or annotated capture lands here. The Settings
                      overview and the Screenshots panel both read from this
                      same path.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void openWorkspaceDirectory(
                          "Screenshots",
                          settings.screenshots.saveDirectory ||
                            screenshotFeatureConfig.defaultSaveDirectory,
                        )
                      }
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        border: `1px solid ${accent}55`,
                        background: `${accent}16`,
                        color: text,
                      }}
                    >
                      Open Save Folder
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateScreenshots({
                          saveDirectory:
                            screenshotFeatureConfig.defaultSaveDirectory,
                        })
                      }
                      className="rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        border: `1px solid ${border}`,
                        background: "rgba(255,255,255,0.04)",
                        color: text,
                      }}
                    >
                      Reset Directory
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
                    Folder Path
                  </label>
                  <input
                    value={settings.screenshots.saveDirectory}
                    onChange={(event) =>
                      updateScreenshots({ saveDirectory: event.target.value })
                    }
                    className="w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={{
                      borderColor: border,
                      background: "rgba(255,255,255,0.04)",
                      color: text,
                      fontFamily: appearance.fonts.mono,
                    }}
                  />
                  <p className="text-[11px] opacity-40">
                    OverlayTerm creates the folder on demand before the first
                    saved capture.
                  </p>
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Default Capture Mode
                  </div>
                  <p className="mt-1 text-[11px] opacity-40">
                    This sets how a fresh monitor preview behaves before the
                    operator does anything else in the screenshot tool.
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {screenshotFeatureConfig.captureModes.map((mode) => {
                    const active =
                      settings.screenshots.defaultCaptureMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          updateScreenshots({ defaultCaptureMode: mode.id })
                        }
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {mode.label}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {mode.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className="rounded border p-3"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                    Default Output Action
                  </div>
                  <p className="mt-1 text-[11px] opacity-40">
                    The screenshot toolbar promotes this action first for both
                    region captures and full-monitor proof runs.
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                  {screenshotFeatureConfig.outputActions.map((action) => {
                    const active =
                      settings.screenshots.defaultOutputAction === action.id;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() =>
                          updateScreenshots({ defaultOutputAction: action.id })
                        }
                        className="rounded px-3 py-3 text-left transition-colors"
                        style={{
                          border: `1px solid ${active ? accent : border}`,
                          background: active
                            ? `${accent}14`
                            : "rgba(255,255,255,0.03)",
                          color: text,
                        }}
                      >
                        <div className="text-[11px] font-semibold">
                          {formatScreenshotOutputActionLabel(action.id)}
                        </div>
                        <p className="mt-1 text-[11px] opacity-45">
                          {action.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label
                  className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <span>Show composition grid over the capture preview</span>
                  <input
                    type="checkbox"
                    aria-label="Show composition grid"
                    checked={settings.screenshots.showGrid}
                    onChange={(event) =>
                      updateScreenshots({ showGrid: event.target.checked })
                    }
                  />
                </label>
                <label
                  className="flex items-center justify-between rounded border px-3 py-2 text-[11px]"
                  style={{ borderColor: border }}
                >
                  <span>Jump back to the library after save actions</span>
                  <input
                    type="checkbox"
                    aria-label="Jump back to the library after save actions"
                    checked={settings.screenshots.closeEditorAfterAction}
                    onChange={(event) =>
                      updateScreenshots({
                        closeEditorAfterAction: event.target.checked,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {activeSection === "theme-json" && (
          <section
            className="rounded border p-4"
            style={{
              borderColor: border,
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <SectionTitle
              icon={<Palette size={12} />}
              title="Theme JSON"
              subtitle="Paste, tweak, or version a theme bundle manifest directly."
            />

            <div className="mt-4 space-y-2">
              <textarea
                value={themeDraft}
                onChange={(event) => {
                  setThemeDraft(event.target.value);
                  if (themeImportError) {
                    setThemeImportError(null);
                  }
                }}
                className="min-h-[280px] w-full rounded border px-3 py-3 text-[11px] outline-none"
                style={{
                  borderColor: border,
                  background: "rgba(255,255,255,0.04)",
                  color: text,
                  fontFamily: appearance.fonts.mono,
                }}
              />
              {themeImportError ? (
                <div
                  className="rounded border px-3 py-2 text-[11px]"
                  style={{
                    borderColor: "rgba(248,113,113,0.3)",
                    background: "rgba(127,29,29,0.28)",
                    color: "#fca5a5",
                  }}
                >
                  {themeImportError}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setThemeDraft(serializeThemeBundle(editableThemeBundle));
                    setThemeImportError(null);
                  }}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: text,
                    border: `1px solid ${border}`,
                  }}
                >
                  Reset Draft
                </button>
                <button
                  onClick={applyThemeDraft}
                  className="rounded px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background: `${accent}20`,
                    color: text,
                    border: `1px solid ${accent}`,
                  }}
                >
                  Import / Apply
                </button>
              </div>
            </div>
          </section>
        )}
        </SettingsRowDescriptionProvider>
      </SettingsShell>
      <MobileShareQrDialog
        open={mobileQrDialogOpen}
        appearance={appearance}
        phase={mobileSharePhase}
        session={mobileShareSession}
        remoteAccessMode={settings.mobile.remoteAccessMode}
        notice={mobileShareNotice}
        error={mobileShareError}
        showSettingsAction={false}
        onClose={() => setMobileQrDialogOpen(false)}
        onOpenMobileSettings={() => setMobileQrDialogOpen(false)}
        onStartOrRestartShare={startMobileShareFromSettings}
        onStopShare={stopMobileShareFromSettings}
      />
    </div>
  );
}
