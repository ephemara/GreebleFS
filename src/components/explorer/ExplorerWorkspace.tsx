import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  MoreHorizontal,
  Plus,
  SquareSplitHorizontal,
  X,
} from "@/components/AppIcons";
import { useShallow } from "zustand/react/shallow";
import type { ResolvedOverlayAppearance } from "../../config/appearance";
import type { LoadedExplorerAction } from "../../config/actionPacks";
import { detectClientPlatform } from "../../config/platform";
import { matchesKeybinding } from "../../config/hotkeys";
import {
  buildExplorerCustomizeCatalog,
  getExplorerChromeCommandId,
  type ExplorerCustomizeCatalogEntry,
} from "../../config/explorerCustomizeCatalog";
import {
  type ExplorerChromeControlId,
  type ExplorerChromeControlDefinition,
  type ExplorerChromeResolvedControlPlacement,
  type ExplorerChromeSizeVariant,
  type ExplorerChromeSurfaceId,
} from "../../config/explorerChromeLayouts";
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActivityLaneContribution,
  OverlayPluginExplorerActionContribution,
  OverlayPluginExplorerViewContribution,
  OverlayPluginExplorerWidgetContribution,
  OverlayPluginPreviewLaneContribution,
  OverlayPluginWorkflowContribution,
} from "../../config/pluginContributions";
import type { ExplorerLayoutMode } from "../../config/layoutProfiles";
import type { LoadedExplorerLayoutDefinition } from "../../config/explorerLayouts";
import type { LoadedExplorerViewDefinition } from "../../config/explorerViews";
import type { LoadedExplorerWidgetDefinition } from "../../config/explorerWidgets";
import type { LoadedExplorerHomePack } from "../../config/homePackages";
import type { LoadedExplorerMenuPack } from "../../config/menuPacks";
import {
  EXPLORER_DRAG_DWELL_INDICATOR_HEIGHT_PX,
  EXPLORER_TAB_AUTO_OPEN_DELAY_MS,
} from "../../config/explorerDragInteractions";
import {
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
  type ExplorerModeProfileId,
} from "../../config/explorerModeProfiles";
import { isExplorerHomePath } from "../../config/explorerVirtualLocations";
import {
  resolveExplorerThemeRecipe,
  type OverlayExplorerWorkspaceTabStyle,
} from "../../config/explorerTheme";
import {
  getExplorerPaneLabel,
  getExplorerWorkspaceLayoutDefinition,
  getExplorerWorkspaceVisiblePaneIds,
  type ExplorerPaneId,
  type ExplorerWorkspaceLayoutMode,
} from "../../config/explorerWorkspaceLayouts";
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
  type ExplorerWorkspacePaneSnapshot,
  type ExplorerWorkspaceTabSnapshot,
} from "../../store/explorerStore";
import { useSettingsStore } from "../../store/settingsStore";
import type { SettingsSectionKey } from "../../config/settingsNavigation";
import type { ExplorerPickerRequest } from "../../runtime/explorerPicker";
import {
  executeExplorerAction,
  normalizeExplorerActionOutputTarget,
  type ExplorerActionExecutionInput,
} from "../../runtime/actionBackend";
import { dispatchExplorerWorkflowRequest } from "../../runtime/explorerWorkflowBridge";
import { recordExplorerActionRun } from "../../store/explorerActionRunStore";
import { openExplorerTaskCenter } from "../../store/explorerTaskStore";
import { ExplorerDragOverlay } from "./ExplorerDragOverlay";
import { ExplorerPopupSurface } from "./ExplorerPopupSurface";
import { resolveExplorerPopupSurfaceStyle } from "./explorerPopupStyles";
import { FileExplorer } from "../FileExplorer";
import type {
  ExplorerDockPreviewPolicy,
  ExplorerExternalChromeControlDefinition,
  ExplorerWorkspaceNavigationRequest,
  ExplorerWorkspaceRevealRequest,
  ExplorerWorkspaceRefreshRequest,
  ExplorerWorkspaceRuntimeSelectionEntry,
  ExplorerWorkspaceRuntimeSnapshot,
  ExplorerWorkspaceSelectionTransferRequest,
  ExplorerWorkspaceSelectionTransferResult,
} from "../FileExplorer";
import {
  clearExplorerDragInteractionTarget,
  createExplorerDropSurfaceBinding,
  doesExplorerPayloadMatchSharedDragSession,
  getExplorerSharedDragSession,
  getExplorerDragInteractionState,
  getExplorerDropScopeId,
  readExplorerPathsFromDataTransfer,
  shallowEqualExplorerDragSelection,
  updateExplorerDragInteractionFromPoint,
  useExplorerDragInteractionSelector,
} from "./explorerDragAndDrop";

export interface ExplorerWorkspaceProps {
  theme: {
    accent: string;
    bg: string;
    bgPanel: string;
    text: string;
    border: string;
    textMuted: string;
  };
  appearance?: ResolvedOverlayAppearance;
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium?: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void | Promise<void>;
  homePacks?: LoadedExplorerHomePack[];
  menuPacks?: LoadedExplorerMenuPack[];
  onOpenPanel?: (panelId: string) => void;
  onOpenSettingsSection?: (section: SettingsSectionKey) => void;
  actions?: LoadedExplorerAction[];
  pluginActions?: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  pluginExplorerActivityLanes?: OverlayPluginExplorerActivityLaneContribution[];
  pluginExplorerViews?: OverlayPluginExplorerViewContribution[];
  pluginExplorerWidgets?: OverlayPluginExplorerWidgetContribution[];
  pluginPreviewLanes?: OverlayPluginPreviewLaneContribution[];
  pluginWorkflows?: OverlayPluginWorkflowContribution[];
  explorerLayouts?: LoadedExplorerLayoutDefinition[];
  explorerViews?: LoadedExplorerViewDefinition[];
  explorerWidgets?: LoadedExplorerWidgetDefinition[];
  layoutMode?: ExplorerLayoutMode;
  dockPreviewPolicy?: ExplorerDockPreviewPolicy;
  defaultModeProfileId?: ExplorerModeProfileId | null;
  shellDefaultExplorerLayoutId?: string | null;
  chromeControlSurface?: "toolbar" | "topbar";
  explorerPicker?: ExplorerPickerRequest | null;
  onExplorerPickerConfirm?: (result: {
    currentDirectory: string;
    entries: Array<{ path: string; name: string; kind: "file" | "folder" }>;
  }) => void;
  onExplorerPickerCancel?: () => void;
}

function getPathLeaf(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || isExplorerHomePath(trimmed)) {
    return "Home";
  }
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? trimmed) : trimmed;
}

function getPathParent(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  const normalizedPath = trimmed.replace(/[\\/]+$/, "");
  const parts = normalizedPath.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 1) {
    return normalizedPath.startsWith("/") ? "/" : "";
  }
  return `${normalizedPath.startsWith("/") ? "/" : ""}${parts
    .slice(0, -1)
    .join("/")}`;
}

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return "";
  }
  return name.slice(dotIndex + 1).toLowerCase();
}

function getFileStem(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) {
    return name;
  }
  return name.slice(0, dotIndex);
}

function getPaneShortLabel(paneId: ExplorerPaneId): string {
  return getExplorerPaneLabel(paneId).replace("Pane ", "P");
}

function getWorkspacePaneDisplayLabel(
  pane: ExplorerWorkspacePaneSnapshot,
  currentPath: string,
): string {
  if (currentPath.trim()) {
    return getPathLeaf(currentPath);
  }
  return pane.title.trim() || "Explorer";
}

function getPreferredWorkspaceTabPaneId(
  tab: ExplorerWorkspaceTabSnapshot,
): ExplorerPaneId {
  const visiblePaneIds = getExplorerWorkspaceVisiblePaneIds(tab.layoutMode);
  if (visiblePaneIds.includes(tab.focusedPane) && tab.panes[tab.focusedPane]) {
    return tab.focusedPane;
  }

  return (
    visiblePaneIds.find((paneId) => tab.panes[paneId] != null) ??
    (["pane-1", "pane-2", "pane-3", "pane-4"] as ExplorerPaneId[]).find(
      (paneId) => tab.panes[paneId] != null,
    ) ??
    "pane-1"
  );
}

function resolvePaneAccent(active: boolean): React.CSSProperties {
  return active
    ? {
        borderColor: "var(--overlay-accent)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in srgb, var(--overlay-accent) 52%, transparent)",
      }
    : {
        borderColor: "var(--overlay-border)",
        boxShadow: "none",
      };
}

function getNextVisiblePaneId(
  visiblePaneIds: ExplorerPaneId[],
  paneId: ExplorerPaneId,
): ExplorerPaneId | null {
  const currentIndex = visiblePaneIds.indexOf(paneId);
  if (currentIndex === -1 || visiblePaneIds.length <= 1) {
    return null;
  }
  return visiblePaneIds[(currentIndex + 1) % visiblePaneIds.length] ?? null;
}

function getPreviousVisiblePaneId(
  visiblePaneIds: ExplorerPaneId[],
  paneId: ExplorerPaneId,
): ExplorerPaneId | null {
  const currentIndex = visiblePaneIds.indexOf(paneId);
  if (currentIndex === -1 || visiblePaneIds.length <= 1) {
    return null;
  }
  return (
    visiblePaneIds[
      (currentIndex - 1 + visiblePaneIds.length) % visiblePaneIds.length
    ] ?? null
  );
}

function getWorkspaceHeaderControlSizing(
  sizeVariant: ExplorerChromeSizeVariant | undefined,
) {
  const normalizedSizeVariant = sizeVariant ?? "regular";
  const compact = normalizedSizeVariant === "compact";
  const wide = normalizedSizeVariant === "wide";
  return {
    sizeVariant: normalizedSizeVariant,
    compact,
    wide,
    stripGap: wide ? 10 : compact ? 5 : 7,
    controlHeight: wide ? 34 : compact ? 26 : 30,
    paneButtonPadding: wide
      ? "5px 11px"
      : compact
        ? "3px 7px"
        : "4px 9px",
    layoutButtonPadding: wide
      ? "7px 12px"
      : compact
        ? "4px 7px"
        : "6px 10px",
    tabChipPadding: wide
      ? "7px 9px 7px 11px"
      : compact
        ? "4px 6px 4px 8px"
        : "6px 8px 6px 10px",
    tabLabelMaxWidth: wide ? 220 : compact ? 120 : 180,
    iconSize: wide ? 14 : compact ? 11 : 13,
  };
}

function sameSelectionEntry(
  left: ExplorerWorkspaceRuntimeSelectionEntry,
  right: ExplorerWorkspaceRuntimeSelectionEntry,
): boolean {
  return (
    left.path === right.path &&
    left.name === right.name &&
    left.is_dir === right.is_dir
  );
}

function sameRuntimeSnapshot(
  left: ExplorerWorkspaceRuntimeSnapshot | null | undefined,
  right: ExplorerWorkspaceRuntimeSnapshot,
): boolean {
  if (!left) {
    return false;
  }
  if (
    left.instanceId !== right.instanceId ||
    left.currentPath !== right.currentPath ||
    left.currentPathIsCloud !== right.currentPathIsCloud ||
    left.selectedEntries.length !== right.selectedEntries.length
  ) {
    return false;
  }
  return left.selectedEntries.every((entry, index) =>
    sameSelectionEntry(entry, right.selectedEntries[index] ?? entry),
  );
}

export function ExplorerWorkspace({
  theme,
  appearance,
  onOpenInTerminal,
  onOpenInFilesystemAquarium = () => undefined,
  onAddBookmark,
  homePacks = [],
  menuPacks = [],
  onOpenPanel = () => undefined,
  onOpenSettingsSection = () => undefined,
  actions = [],
  pluginActions = [],
  pluginContextMenuItems = [],
  pluginExplorerActivityLanes = [],
  pluginExplorerViews = [],
  pluginExplorerWidgets = [],
  pluginPreviewLanes = [],
  pluginWorkflows = [],
  explorerLayouts = [],
  explorerViews = [],
  explorerWidgets = [],
  layoutMode = "full",
  dockPreviewPolicy,
  defaultModeProfileId = null,
  shellDefaultExplorerLayoutId = null,
  chromeControlSurface = "toolbar",
  explorerPicker = null,
  onExplorerPickerConfirm = () => undefined,
  onExplorerPickerCancel = () => undefined,
}: ExplorerWorkspaceProps) {
  const {
    sessions,
    workspace,
    chromeEditSession,
    pendingOpenRequest,
    createWorkspaceTab,
    duplicateWorkspaceTab,
    closeWorkspaceTab,
    focusWorkspaceTab,
    setWorkspaceColumnSplitRatio,
    setWorkspaceLayoutMode,
    setWorkspaceRowSplitRatio,
    setFocusedPane,
  } = useExplorerStore(
    useShallow((state) => ({
      sessions: state.sessions,
      workspace: state.workspace,
      chromeEditSession: state.chromeEditSession,
      pendingOpenRequest: state.pendingOpenRequest,
      createWorkspaceTab: state.createWorkspaceTab,
      duplicateWorkspaceTab: state.duplicateWorkspaceTab,
      closeWorkspaceTab: state.closeWorkspaceTab,
      focusWorkspaceTab: state.focusWorkspaceTab,
      setWorkspaceColumnSplitRatio: state.setWorkspaceColumnSplitRatio,
      setWorkspaceLayoutMode: state.setWorkspaceLayoutMode,
      setWorkspaceRowSplitRatio: state.setWorkspaceRowSplitRatio,
      setFocusedPane: state.setFocusedPane,
    })),
  );
  const {
    activeThemeId,
    modeProfileOverridesByThemeId,
    chromeLayoutOverridesByThemeId,
    commandBindingsById,
  } = useSettingsStore(
    useShallow((state) => ({
      activeThemeId: state.settings.appearance.activeThemeId,
      modeProfileOverridesByThemeId:
        state.settings.explorer.modeProfileOverridesByThemeId,
      chromeLayoutOverridesByThemeId:
        state.settings.explorer.chromeLayoutOverridesByThemeId,
      commandBindingsById: state.settings.keybindings.commandBindingsById,
    })),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const paneSurfaceRef = useRef<HTMLDivElement>(null);
  const commandSequenceRef = useRef(0);
  const paneActionsMenuRef = useRef<HTMLDivElement>(null);
  const [linkedNavigationEnabled, setLinkedNavigationEnabled] = useState(false);
  const [paneActionsMenuOpen, setPaneActionsMenuOpen] = useState(false);
  const [runtimeSnapshotsByInstanceId, setRuntimeSnapshotsByInstanceId] =
    useState<Record<string, ExplorerWorkspaceRuntimeSnapshot>>({});
  const [navigationRequestsByInstanceId, setNavigationRequestsByInstanceId] =
    useState<Record<string, ExplorerWorkspaceNavigationRequest>>({});
  const [revealRequestsByInstanceId, setRevealRequestsByInstanceId] = useState<
    Record<string, ExplorerWorkspaceRevealRequest>
  >({});
  const [
    selectionTransferRequestsByInstanceId,
    setSelectionTransferRequestsByInstanceId,
  ] = useState<Record<string, ExplorerWorkspaceSelectionTransferRequest>>({});
  const [refreshRequestsByInstanceId, setRefreshRequestsByInstanceId] =
    useState<Record<string, ExplorerWorkspaceRefreshRequest>>({});
  const lastPendingOpenSequenceRef = useRef(0);

  const explorerTheme = useMemo(
    () => appearance?.explorerTheme ?? resolveExplorerThemeRecipe(appearance),
    [appearance],
  );
  const workspaceTabsTheme = explorerTheme.workspaceTabs;
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const explorerChromeThemeId = useMemo(() => {
    const resolvedAppearanceThemeId = appearance?.baseTheme.id?.trim();
    if (resolvedAppearanceThemeId) {
      return resolvedAppearanceThemeId;
    }

    const trimmedActiveThemeId = activeThemeId.trim();
    return trimmedActiveThemeId || "operator";
  }, [appearance?.baseTheme.id, activeThemeId]);

  const workspaceTabs = workspace.tabs;
  const activeWorkspaceTab = useMemo(
    () =>
      workspaceTabs.find((tab) => tab.id === workspace.activeWorkspaceTabId) ??
      workspaceTabs[0] ??
      null,
    [workspace.activeWorkspaceTabId, workspaceTabs],
  );
  const workspaceLayout = useMemo(
    () => getExplorerWorkspaceLayoutDefinition(activeWorkspaceTab?.layoutMode),
    [activeWorkspaceTab?.layoutMode],
  );
  const visiblePaneIds = useMemo(
    () => getExplorerWorkspaceVisiblePaneIds(activeWorkspaceTab?.layoutMode),
    [activeWorkspaceTab?.layoutMode],
  );
  const activePane = useMemo(
    () =>
      activeWorkspaceTab &&
      visiblePaneIds.includes(activeWorkspaceTab.focusedPane) &&
      activeWorkspaceTab.panes[activeWorkspaceTab.focusedPane]
        ? activeWorkspaceTab.focusedPane
        : (visiblePaneIds.find(
            (paneId) => activeWorkspaceTab?.panes[paneId] != null,
          ) ??
          visiblePaneIds[0] ??
          "pane-1"),
    [activeWorkspaceTab, visiblePaneIds],
  );
  const activePaneSnapshot = activeWorkspaceTab?.panes[activePane] ?? null;
  const resolveWorkspaceDragPayload = useCallback(
    (dataTransfer: DataTransfer | null | undefined) => {
      const sharedDragSession = getExplorerSharedDragSession();
      const sourcePaths = readExplorerPathsFromDataTransfer({
        dataTransfer,
        fallbackPaths: sharedDragSession?.paths ?? [],
      });
      const payloadMatchesSharedDrag =
        sourcePaths.length === 0
          ? Boolean(sharedDragSession?.paths.length)
          : doesExplorerPayloadMatchSharedDragSession({
              payloadPaths: sourcePaths,
              platform: runtimePlatform,
              session: sharedDragSession,
            });
      const isInternalDrag =
        Boolean(sharedDragSession) &&
        (sourcePaths.length === 0 || payloadMatchesSharedDrag);
      return {
        sourceKind: isInternalDrag ? "internal" : "external",
        operation: isInternalDrag ? "move" : "copy",
        sourcePaths,
      } as const;
    },
    [runtimePlatform],
  );
  const onWorkspaceDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const dragPayload = resolveWorkspaceDragPayload(event.dataTransfer);
      const hit = updateExplorerDragInteractionFromPoint({
        pointer: { x: event.clientX, y: event.clientY },
        sourceKind: dragPayload.sourceKind,
        sourcePaths: dragPayload.sourcePaths,
        operation: event.shiftKey ? "copy" : dragPayload.operation,
        platform: runtimePlatform,
        externalWindowItemCount:
          dragPayload.sourceKind === "external"
            ? dragPayload.sourcePaths.length
            : 0,
      });
      if (!hit || !hit.surfaceId.startsWith("workspace-tab-")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const interactionState = getExplorerDragInteractionState();
      event.dataTransfer.dropEffect = interactionState.valid
        ? event.shiftKey
          ? "copy"
          : dragPayload.operation
        : "none";
    },
    [resolveWorkspaceDragPayload, runtimePlatform],
  );
  const onWorkspaceDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const relatedTarget = event.relatedTarget;
      if (
        relatedTarget instanceof Node &&
        event.currentTarget.contains(relatedTarget)
      ) {
        return;
      }
      const interactionState = getExplorerDragInteractionState();
      if (interactionState.targetSurfaceId?.startsWith("workspace-tab-")) {
        clearExplorerDragInteractionTarget();
      }
    },
    [],
  );
  const workspacePaneCount = visiblePaneIds.length as 1 | 2 | 3 | 4;
  const workspaceDragState = useExplorerDragInteractionSelector(
    (state) => ({
      valid: state.valid,
      targetSurfaceId: state.targetSurfaceId,
      dwellSurfaceId: state.dwellSurfaceId,
      dwellProgress: state.dwellProgress,
    }),
    shallowEqualExplorerDragSelection,
  );
  const commanderTargetPaneId = useMemo(
    () =>
      visiblePaneIds.length === 2
        ? getNextVisiblePaneId(visiblePaneIds, activePane)
        : null,
    [activePane, visiblePaneIds],
  );
  const commanderTargetPaneSnapshot = commanderTargetPaneId
    ? (activeWorkspaceTab?.panes[commanderTargetPaneId] ?? null)
    : null;
  const activeRuntime = activePaneSnapshot
    ? (runtimeSnapshotsByInstanceId[activePaneSnapshot.instanceId] ?? null)
    : null;
  const commanderTargetRuntime = commanderTargetPaneSnapshot
    ? (runtimeSnapshotsByInstanceId[commanderTargetPaneSnapshot.instanceId] ??
      null)
    : null;
  const activePanePath =
    activeRuntime?.currentPath ??
    (activePaneSnapshot
      ? (sessions[activePaneSnapshot.instanceId]?.currentPath ?? "")
      : "");
  const commanderTargetPath =
    commanderTargetRuntime?.currentPath ??
    (commanderTargetPaneSnapshot
      ? (sessions[commanderTargetPaneSnapshot.instanceId]?.currentPath ?? "")
      : "");
  const commanderSelectionCount = activeRuntime?.selectedEntries.length ?? 0;
  const canUseCommanderActions = Boolean(
    activePaneSnapshot &&
    commanderTargetPaneId &&
    commanderTargetPaneSnapshot &&
    activePanePath.trim() &&
    commanderTargetPath.trim(),
  );
  const commanderSummaryText = useMemo(() => {
    if (!canUseCommanderActions || !commanderTargetPaneId) {
      return null;
    }
    const targetLeaf = getPathLeaf(commanderTargetPath);
    if (commanderSelectionCount > 0) {
      return `${commanderSelectionCount} selected -> ${getPaneShortLabel(commanderTargetPaneId)} · ${targetLeaf}`;
    }
    return `${getPaneShortLabel(commanderTargetPaneId)} · ${targetLeaf}`;
  }, [
    canUseCommanderActions,
    commanderSelectionCount,
    commanderTargetPaneId,
    commanderTargetPath,
  ]);
  const legacyShellLayoutId =
    sessions[activePaneSnapshot?.instanceId ?? PRIMARY_EXPLORER_INSTANCE_ID]
      ?.shellLayoutId ?? defaultExplorerSession.shellLayoutId;
  const effectiveModeProfile = useMemo(
    () =>
      resolveEffectiveExplorerModeProfile({
        themeOverrideModeProfileId:
          modeProfileOverridesByThemeId[explorerChromeThemeId] ?? null,
        themeDefaultModeProfileId:
          defaultModeProfileId ?? explorerTheme.defaultModeProfileId,
        legacyShellLayoutId,
      }),
    [
      defaultModeProfileId,
      explorerChromeThemeId,
      explorerTheme.defaultModeProfileId,
      legacyShellLayoutId,
      modeProfileOverridesByThemeId,
    ],
  );
  const explorerChromeLayoutId = useMemo(
    () =>
      resolveExplorerModeProfileChromeLayoutId({
        modeProfile: effectiveModeProfile,
        themeChromeLayoutId: explorerTheme.chromeLayoutId,
      }),
    [effectiveModeProfile, explorerTheme.chromeLayoutId],
  );
  const persistedExplorerChromeOverride = useMemo(
    () =>
      chromeLayoutOverridesByThemeId[explorerChromeThemeId]?.[
        explorerChromeLayoutId
      ] ?? null,
    [
      chromeLayoutOverridesByThemeId,
      explorerChromeLayoutId,
      explorerChromeThemeId,
    ],
  );
  const explorerChromeOverride = useMemo(
    () =>
      chromeEditSession &&
      chromeEditSession.themeId === explorerChromeThemeId &&
      chromeEditSession.layoutId === explorerChromeLayoutId
        ? chromeEditSession.draftOverride
        : persistedExplorerChromeOverride,
    [
      chromeEditSession,
      explorerChromeLayoutId,
      explorerChromeThemeId,
      persistedExplorerChromeOverride,
    ],
  );
  const workspaceCustomizeCatalog = useMemo(
    () =>
      buildExplorerCustomizeCatalog({
        actions,
        widgets: explorerWidgets,
        pluginWidgets: pluginExplorerWidgets,
        persistedEntries: explorerChromeOverride?.entries ?? null,
      }),
    [actions, explorerChromeOverride, explorerWidgets, pluginExplorerWidgets],
  );
  const workspaceCustomizeCatalogByControlId = useMemo(
    () =>
      new Map(
        workspaceCustomizeCatalog.map((entry) => [entry.controlId, entry] as const),
      ),
    [workspaceCustomizeCatalog],
  );
  const workspaceLayoutMode = activeWorkspaceTab?.layoutMode ?? "single";
  const workspaceColumnSplitRatio = activeWorkspaceTab?.columnSplitRatio ?? 0.5;
  const workspaceRowSplitRatio = activeWorkspaceTab?.rowSplitRatio ?? 0.5;

  const nextCommandSequence = useCallback(() => {
    commandSequenceRef.current += 1;
    return commandSequenceRef.current;
  }, []);
  const publishRuntimeSnapshot = useCallback(
    (snapshot: ExplorerWorkspaceRuntimeSnapshot) => {
      setRuntimeSnapshotsByInstanceId((current) => {
        const previous = current[snapshot.instanceId];
        if (sameRuntimeSnapshot(previous, snapshot)) {
          return current;
        }
        return {
          ...current,
          [snapshot.instanceId]: snapshot,
        };
      });
    },
    [],
  );
  const issueNavigationRequest = useCallback(
    (instanceId: string, path: string, pushHistory = true) => {
      const trimmedPath = path.trim();
      if (!instanceId.trim() || !trimmedPath) {
        return;
      }
      setNavigationRequestsByInstanceId((current) => ({
        ...current,
        [instanceId]: {
          sequence: nextCommandSequence(),
          path: trimmedPath,
          pushHistory,
        },
      }));
    },
    [nextCommandSequence],
  );
  const issueSelectionTransferRequest = useCallback(
    (
      instanceId: string,
      targetDir: string,
      operation: ExplorerWorkspaceSelectionTransferRequest["operation"],
    ) => {
      const trimmedTargetDir = targetDir.trim();
      if (!instanceId.trim() || !trimmedTargetDir) {
        return;
      }
      setSelectionTransferRequestsByInstanceId((current) => ({
        ...current,
        [instanceId]: {
          sequence: nextCommandSequence(),
          targetDir: trimmedTargetDir,
          operation,
        },
      }));
    },
    [nextCommandSequence],
  );
  const issueRefreshRequest = useCallback(
    (instanceId: string) => {
      if (!instanceId.trim()) {
        return;
      }
      setRefreshRequestsByInstanceId((current) => ({
        ...current,
        [instanceId]: {
          sequence: nextCommandSequence(),
        },
      }));
    },
    [nextCommandSequence],
  );
  useEffect(() => {
    if (!pendingOpenRequest) {
      return;
    }
    if (pendingOpenRequest.sequence === lastPendingOpenSequenceRef.current) {
      return;
    }

    lastPendingOpenSequenceRef.current = pendingOpenRequest.sequence;
    const targetInstanceId =
      activePaneSnapshot?.instanceId ?? PRIMARY_EXPLORER_INSTANCE_ID;
    setRevealRequestsByInstanceId((current) => ({
      ...current,
      [targetInstanceId]: pendingOpenRequest,
    }));
  }, [activePaneSnapshot?.instanceId, pendingOpenRequest]);
  const ensureWorkspaceLayout = useCallback(
    (nextLayoutMode: ExplorerWorkspaceLayoutMode) => {
      setWorkspaceLayoutMode(nextLayoutMode);
    },
    [setWorkspaceLayoutMode],
  );
  const duplicateActiveTab = useCallback(() => {
    if (!activeWorkspaceTab) {
      return;
    }
    duplicateWorkspaceTab(activeWorkspaceTab.id);
  }, [activeWorkspaceTab, duplicateWorkspaceTab]);
  const createTabInFocusedPane = useCallback(() => {
    createWorkspaceTab({
      sourceWorkspaceTabId: activeWorkspaceTab?.id,
    });
  }, [activeWorkspaceTab?.id, createWorkspaceTab]);
  const closeActiveTab = useCallback(() => {
    if (!activeWorkspaceTab) {
      return;
    }
    closeWorkspaceTab(activeWorkspaceTab.id);
  }, [activeWorkspaceTab, closeWorkspaceTab]);
  const focusNextPane = useCallback(() => {
    const nextPaneId = getNextVisiblePaneId(visiblePaneIds, activePane);
    if (!nextPaneId) {
      return;
    }
    setFocusedPane(nextPaneId);
  }, [activePane, setFocusedPane, visiblePaneIds]);
  const focusPreviousPane = useCallback(() => {
    const previousPaneId = getPreviousVisiblePaneId(visiblePaneIds, activePane);
    if (!previousPaneId) {
      return;
    }
    setFocusedPane(previousPaneId);
  }, [activePane, setFocusedPane, visiblePaneIds]);
  const togglePaneActionsMenu = useCallback(() => {
    setPaneActionsMenuOpen((current) => !current);
  }, []);
  const cycleWorkspaceLayout = useCallback(() => {
    const orderedLayouts: ExplorerWorkspaceLayoutMode[] = [
      "single",
      "split",
      "triple",
      "quad",
    ];
    const currentIndex = orderedLayouts.indexOf(workspaceLayoutMode);
    const nextLayout =
      orderedLayouts[(currentIndex + 1) % orderedLayouts.length] ?? "single";
    ensureWorkspaceLayout(nextLayout);
  }, [ensureWorkspaceLayout, workspaceLayoutMode]);
  const nudgeWorkspaceSplit = useCallback(
    (delta: number): boolean => {
      if (workspaceLayout.supportsColumnSplit) {
        setWorkspaceColumnSplitRatio(workspaceColumnSplitRatio + delta);
        return true;
      }
      if (workspaceLayout.supportsRowSplit) {
        setWorkspaceRowSplitRatio(workspaceRowSplitRatio + delta);
        return true;
      }
      return false;
    },
    [
      setWorkspaceColumnSplitRatio,
      setWorkspaceRowSplitRatio,
      workspaceColumnSplitRatio,
      workspaceLayout.supportsColumnSplit,
      workspaceLayout.supportsRowSplit,
      workspaceRowSplitRatio,
    ],
  );
  const resetWorkspaceSplit = useCallback((): boolean => {
    let updated = false;
    if (workspaceLayout.supportsColumnSplit) {
      setWorkspaceColumnSplitRatio(0.5);
      updated = true;
    }
    if (workspaceLayout.supportsRowSplit) {
      setWorkspaceRowSplitRatio(0.5);
      updated = true;
    }
    return updated;
  }, [
    setWorkspaceColumnSplitRatio,
    setWorkspaceRowSplitRatio,
    workspaceLayout.supportsColumnSplit,
    workspaceLayout.supportsRowSplit,
  ]);
  const syncCommanderTargetToActivePane = useCallback(() => {
    if (!commanderTargetPaneSnapshot || !activePanePath.trim()) {
      return;
    }
    if (activePanePath === commanderTargetPath) {
      return;
    }
    issueNavigationRequest(
      commanderTargetPaneSnapshot.instanceId,
      activePanePath,
      true,
    );
  }, [
    activePanePath,
    commanderTargetPaneSnapshot,
    commanderTargetPath,
    issueNavigationRequest,
  ]);
  const copySelectionToCommanderTarget = useCallback(() => {
    if (!activePaneSnapshot || !commanderTargetPath.trim()) {
      return;
    }
    issueSelectionTransferRequest(
      activePaneSnapshot.instanceId,
      commanderTargetPath,
      "copy",
    );
  }, [activePaneSnapshot, commanderTargetPath, issueSelectionTransferRequest]);
  const moveSelectionToCommanderTarget = useCallback(() => {
    if (!activePaneSnapshot || !commanderTargetPath.trim()) {
      return;
    }
    issueSelectionTransferRequest(
      activePaneSnapshot.instanceId,
      commanderTargetPath,
      "move",
    );
  }, [activePaneSnapshot, commanderTargetPath, issueSelectionTransferRequest]);
  const handleWorkspaceSelectionTransferComplete = useCallback(
    (result: ExplorerWorkspaceSelectionTransferResult) => {
      if (!result.success) {
        return;
      }
      const targetInstanceIds = new Set<string>();
      for (const workspaceTab of workspaceTabs) {
        for (const paneId of [
          "pane-1",
          "pane-2",
          "pane-3",
          "pane-4",
        ] as ExplorerPaneId[]) {
          const pane = workspaceTab.panes[paneId];
          if (!pane) {
            continue;
          }
          const runtimePath =
            runtimeSnapshotsByInstanceId[pane.instanceId]?.currentPath;
          const sessionPath = sessions[pane.instanceId]?.currentPath ?? "";
          if ((runtimePath ?? sessionPath) === result.targetDir) {
            targetInstanceIds.add(pane.instanceId);
          }
        }
      }
      for (const instanceId of targetInstanceIds) {
        issueRefreshRequest(instanceId);
      }
    },
    [
      issueRefreshRequest,
      runtimeSnapshotsByInstanceId,
      sessions,
      workspaceTabs,
    ],
  );

  useEffect(() => {
    const liveInstanceIds = new Set<string>();
    for (const workspaceTab of workspaceTabs) {
      for (const paneId of [
        "pane-1",
        "pane-2",
        "pane-3",
        "pane-4",
      ] as ExplorerPaneId[]) {
        const pane = workspaceTab.panes[paneId];
        if (pane) {
          liveInstanceIds.add(pane.instanceId);
        }
      }
    }
    setRuntimeSnapshotsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) =>
        liveInstanceIds.has(instanceId),
      );
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
    setNavigationRequestsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) =>
        liveInstanceIds.has(instanceId),
      );
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
    setSelectionTransferRequestsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) =>
        liveInstanceIds.has(instanceId),
      );
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
    setRefreshRequestsByInstanceId((current) => {
      const nextEntries = Object.entries(current).filter(([instanceId]) =>
        liveInstanceIds.has(instanceId),
      );
      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [workspaceTabs]);

  useEffect(() => {
    if (
      !linkedNavigationEnabled ||
      visiblePaneIds.length !== 2 ||
      !commanderTargetPaneSnapshot
    ) {
      return;
    }
    if (!activePanePath.trim() || !commanderTargetPath.trim()) {
      return;
    }
    if (activePanePath === commanderTargetPath) {
      return;
    }
    issueNavigationRequest(
      commanderTargetPaneSnapshot.instanceId,
      activePanePath,
      true,
    );
  }, [
    activePanePath,
    commanderTargetPath,
    commanderTargetPaneSnapshot,
    issueNavigationRequest,
    linkedNavigationEnabled,
    visiblePaneIds.length,
  ]);
  useEffect(() => {
    if (!paneActionsMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (paneActionsMenuRef.current?.contains(targetNode)) {
        return;
      }
      if (
        targetElement?.closest(
          '[data-overlay-explorer-floating-surface-group="explorer-workspace-menu"]',
        )
      ) {
        return;
      }
      setPaneActionsMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [paneActionsMenuOpen]);
  useEffect(() => {
    setPaneActionsMenuOpen(false);
  }, [activePane, activeWorkspaceTab?.id, activeWorkspaceTab?.layoutMode]);

  const columnSplitPercent = Math.round(workspaceColumnSplitRatio * 100);
  const rowSplitPercent = Math.round(workspaceRowSplitRatio * 100);
  const commanderButtonsDisabled =
    !canUseCommanderActions || commanderSelectionCount === 0;
  const renderWorkspaceTabStrip = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) => {
      const sizing = getWorkspaceHeaderControlSizing(placement.sizeVariant);

      return (
        <div
          aria-label="Workspace tab strip"
          style={{
            ...workspaceTabStripRootStyle(workspaceTabsTheme.style),
            display: "flex",
            alignItems: "center",
            gap: sizing.stripGap,
            minWidth: 0,
            width: "100%",
            padding: sizing.compact ? "2px 0" : "3px 0",
          }}
        >
          {workspaceTabsTheme.showPaneSwitcher && visiblePaneIds.length > 1 ? (
            <div
              aria-label="Workspace panes"
              role="group"
              style={{
                ...paneSwitcherGroupStyle,
                gap: sizing.compact ? 4 : 6,
                flexShrink: 0,
                flexWrap: "nowrap",
              }}
            >
              {visiblePaneIds.map((paneId) => (
                <button
                  key={paneId}
                  type="button"
                  onClick={() => setFocusedPane(paneId)}
                  title={`Focus ${getExplorerPaneLabel(paneId)}`}
                  style={{
                    ...paneSwitcherButtonStyle(
                      activePane === paneId,
                      theme.accent,
                      workspaceTabsTheme.style,
                    ),
                    minWidth: sizing.compact ? 30 : sizing.wide ? 44 : 38,
                    minHeight: sizing.controlHeight,
                    padding: sizing.paneButtonPadding,
                    fontSize: sizing.compact ? 9 : 10,
                  }}
                >
                  <span>{getPaneShortLabel(paneId)}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div
            className="overlay-scrollbars-none"
            aria-label="Workspace tabs"
            style={{
              ...workspaceTabLaneStyle(workspaceTabsTheme.style),
              display: "flex",
              alignItems: "center",
              gap:
                workspaceTabsTheme.style === "windows"
                  ? 0
                  : sizing.compact
                    ? 4
                    : 6,
              minWidth: 0,
              flex: 1,
              overflowX: "auto",
              paddingBottom: workspaceTabsTheme.style === "windows" ? 0 : 1,
            }}
          >
            {workspaceTabs.map((tab) => {
              const preferredPaneId = getPreferredWorkspaceTabPaneId(tab);
              const preferredPane = tab.panes[preferredPaneId];
              const currentPath = preferredPane
                ? (runtimeSnapshotsByInstanceId[preferredPane.instanceId]
                    ?.currentPath ??
                  sessions[preferredPane.instanceId]?.currentPath)
                : "";
              const isActive = activeWorkspaceTab?.id === tab.id;
              const tabPaneCount = getExplorerWorkspaceVisiblePaneIds(
                tab.layoutMode,
              ).length;
              const tabLabel = preferredPane
                ? getWorkspacePaneDisplayLabel(preferredPane, currentPath)
                : "Explorer";
              const tabDropBinding =
                preferredPane && currentPath.trim()
                  ? createExplorerDropSurfaceBinding({
                      surfaceId: `workspace-tab-${tab.id}`,
                      scopeId: getExplorerDropScopeId(preferredPane.instanceId),
                      role: "navigation-target",
                      targetPath: currentPath,
                      autoOpenDelayMs: EXPLORER_TAB_AUTO_OPEN_DELAY_MS,
                      onAutoOpen: () => focusWorkspaceTab(tab.id),
                      label: tabLabel,
                    })
                  : null;
              const tabSurfaceId = `workspace-tab-${tab.id}`;
              const isDropTarget =
                workspaceDragState.valid &&
                workspaceDragState.targetSurfaceId === tabSurfaceId;
              const isDwellTarget =
                workspaceDragState.dwellSurfaceId === tabSurfaceId;
              return (
                <div
                  key={tab.id}
                  style={{
                    ...workspaceTabChipStyle(
                      isActive,
                      theme.accent,
                      workspaceTabsTheme.style,
                      isDropTarget,
                    ),
                    padding: sizing.tabChipPadding,
                  }}
                >
                  <button
                    type="button"
                    ref={tabDropBinding?.ref}
                    data-overlay-explorer-drop-scope-id={
                      tabDropBinding?.["data-overlay-explorer-drop-scope-id"]
                    }
                    data-overlay-explorer-drop-surface-role={
                      tabDropBinding?.[
                        "data-overlay-explorer-drop-surface-role"
                      ]
                    }
                    data-overlay-explorer-drop-surface-id={
                      tabDropBinding?.["data-overlay-explorer-drop-surface-id"]
                    }
                    data-overlay-drop-target-path={
                      tabDropBinding?.["data-overlay-drop-target-path"]
                    }
                    onClick={() => focusWorkspaceTab(tab.id)}
                    title={currentPath || tabLabel}
                    style={{
                      ...workspaceTabButtonStyle(
                        isActive,
                        workspaceTabsTheme.style,
                        isDropTarget,
                      ),
                      gap:
                        workspaceTabsTheme.style === "windows"
                          ? sizing.compact
                            ? 4
                            : 6
                          : sizing.compact
                            ? 5
                            : 7,
                    }}
                  >
                    {workspaceTabsTheme.showLeadingStatusDot ? (
                      <span
                        style={{
                          width: sizing.compact ? 5 : 6,
                          height: sizing.compact ? 5 : 6,
                          borderRadius: 999,
                          background: isActive
                            ? theme.accent
                            : "rgba(255,255,255,0.35)",
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <span
                      style={{
                        maxWidth: sizing.tabLabelMaxWidth,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: sizing.wide ? 12 : sizing.compact ? 10 : 11.5,
                        fontWeight: 600,
                      }}
                    >
                      {tabLabel}
                    </span>
                    {workspaceTabsTheme.showPaneCountBadge && tabPaneCount > 1 ? (
                      <span
                        style={{
                          ...paneSwitcherCountStyle(
                            isActive,
                            theme.accent,
                            workspaceTabsTheme.style,
                          ),
                          fontSize: sizing.compact ? 8 : 9,
                        }}
                      >
                        {tabPaneCount}
                      </span>
                    ) : null}
                    {workspaceTabsTheme.showActiveIndicator && isActive ? (
                      <span
                        aria-hidden="true"
                        style={workspaceTabActiveIndicatorStyle(
                          workspaceTabsTheme.style,
                          theme.accent,
                        )}
                      />
                    ) : null}
                    {isDwellTarget ? (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          left: 10,
                          right: 10,
                          bottom: 7,
                          height: EXPLORER_DRAG_DWELL_INDICATOR_HEIGHT_PX,
                          borderRadius: 999,
                          overflow: "hidden",
                          background: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            width: `${Math.max(
                              0,
                              Math.min(100, workspaceDragState.dwellProgress * 100),
                            )}%`,
                            height: "100%",
                            borderRadius: 999,
                            background:
                              "color-mix(in srgb, var(--overlay-accent) 90%, white 10%)",
                            transition: "width 60ms linear",
                          }}
                        />
                      </span>
                    ) : null}
                  </button>
                  {workspaceTabs.length > 1 &&
                  workspaceTabsTheme.closeButtonMode !== "never" &&
                  (workspaceTabsTheme.closeButtonMode === "always" || isActive) ? (
                    <button
                      type="button"
                      onClick={() => closeWorkspaceTab(tab.id)}
                      title="Close tab"
                      style={{
                        ...workspaceTabIconButtonStyle(
                          workspaceTabsTheme.style,
                          isActive,
                        ),
                        width: sizing.compact ? 18 : 20,
                        height: sizing.compact ? 18 : 20,
                      }}
                    >
                      <X size={sizing.compact ? 10 : 11} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [
      activePane,
      activeWorkspaceTab?.id,
      closeWorkspaceTab,
      focusWorkspaceTab,
      runtimeSnapshotsByInstanceId,
      sessions,
      setFocusedPane,
      workspaceTabsTheme,
      theme.accent,
      visiblePaneIds,
      workspaceTabs,
      workspaceDragState.dwellProgress,
      workspaceDragState.dwellSurfaceId,
      workspaceDragState.targetSurfaceId,
      workspaceDragState.valid,
    ],
  );
  const renderWorkspaceNewTabControl = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) => {
      const sizing = getWorkspaceHeaderControlSizing(placement.sizeVariant);
      return (
        <button
          type="button"
          aria-label="New workspace tab"
          onClick={createTabInFocusedPane}
          title="New workspace tab"
          style={{
            ...toolbarButtonStyle,
            width: sizing.controlHeight,
            height: sizing.controlHeight,
          }}
        >
          <Plus size={sizing.iconSize} />
        </button>
      );
    },
    [createTabInFocusedPane],
  );
  const renderWorkspacePaneActionsMenuControl = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) => {
      const sizing = getWorkspaceHeaderControlSizing(placement.sizeVariant);
      return (
        <div ref={paneActionsMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={paneActionsMenuOpen}
            aria-label="Workspace pane actions"
            onClick={() => setPaneActionsMenuOpen((current) => !current)}
            title="Workspace pane actions"
            style={{
              ...toolbarButtonStyle,
              width: sizing.controlHeight,
              height: sizing.controlHeight,
            }}
          >
            <MoreHorizontal size={sizing.iconSize} />
          </button>
          <ExplorerPopupSurface
            anchorRef={paneActionsMenuRef}
            open={paneActionsMenuOpen}
            surfaceGroup="explorer-workspace-menu"
            role="menu"
            aria-label="Workspace pane actions"
            style={workspaceOverflowMenuStyle}
          >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  duplicateActiveTab();
                  setPaneActionsMenuOpen(false);
                }}
                disabled={!activeWorkspaceTab}
                style={workspaceOverflowMenuItemStyle(
                  false,
                  !activeWorkspaceTab,
                )}
              >
                <CopyPlus size={12} />
                Duplicate Workspace Tab
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeActiveTab();
                  setPaneActionsMenuOpen(false);
                }}
                disabled={!activeWorkspaceTab || workspaceTabs.length <= 1}
                style={workspaceOverflowMenuItemStyle(
                  false,
                  !activeWorkspaceTab || workspaceTabs.length <= 1,
                )}
              >
                <X size={12} />
                Close Workspace Tab
              </button>
              {visiblePaneIds.length > 1 ? (
                <>
                  <div style={workspaceOverflowDividerStyle} />
                  <div style={workspaceOverflowLabelStyle}>Pane</div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      focusNextPane();
                      setPaneActionsMenuOpen(false);
                    }}
                    style={workspaceOverflowMenuItemStyle(false, false)}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>→</span>
                    Focus Next Pane
                  </button>
                </>
              ) : null}
              {commanderTargetPaneId ? (
                <>
                  <div style={workspaceOverflowDividerStyle} />
                  <div style={workspaceOverflowLabelStyle}>Commander</div>
                  {commanderSummaryText ? (
                    <div style={workspaceOverflowSummaryStyle(theme.accent)}>
                      {commanderSummaryText}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      syncCommanderTargetToActivePane();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={!canUseCommanderActions}
                    style={workspaceOverflowMenuItemStyle(
                      false,
                      !canUseCommanderActions,
                    )}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>↺</span>
                    Sync Target Pane
                  </button>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={linkedNavigationEnabled}
                    onClick={() => {
                      setLinkedNavigationEnabled((current) => !current);
                      setPaneActionsMenuOpen(false);
                    }}
                    style={workspaceOverflowMenuItemStyle(
                      linkedNavigationEnabled,
                      false,
                    )}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>
                      {linkedNavigationEnabled ? "●" : "○"}
                    </span>
                    Linked Navigation
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copySelectionToCommanderTarget();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={commanderButtonsDisabled}
                    style={workspaceOverflowMenuItemStyle(
                      false,
                      commanderButtonsDisabled,
                    )}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>⎘</span>
                    Copy Selection To Pane
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      moveSelectionToCommanderTarget();
                      setPaneActionsMenuOpen(false);
                    }}
                    disabled={commanderButtonsDisabled}
                    style={workspaceOverflowMenuItemStyle(
                      false,
                      commanderButtonsDisabled,
                    )}
                  >
                    <span style={workspaceOverflowLeadingGlyphStyle}>⇄</span>
                    Move Selection To Pane
                  </button>
                </>
              ) : null}
              {workspaceLayout.supportsColumnSplit ||
              workspaceLayout.supportsRowSplit ? (
                <>
                  <div style={workspaceOverflowDividerStyle} />
                  <div style={workspaceOverflowLabelStyle}>Split</div>
                  <div style={workspaceOverflowMetaStyle}>
                    {workspaceLayout.supportsColumnSplit
                      ? `Cols ${columnSplitPercent}%`
                      : "Cols off"}
                    {workspaceLayout.supportsRowSplit
                      ? ` · Rows ${rowSplitPercent}%`
                      : ""}
                  </div>
                  {workspaceLayout.supportsColumnSplit ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceColumnSplitRatio(
                            workspaceColumnSplitRatio - 0.05,
                          );
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <ChevronLeft size={12} />
                        Narrow First Column
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceColumnSplitRatio(0.5);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <SquareSplitHorizontal size={12} />
                        Reset Column Split
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceColumnSplitRatio(
                            workspaceColumnSplitRatio + 0.05,
                          );
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <ChevronRight size={12} />
                        Widen First Column
                      </button>
                    </>
                  ) : null}
                  {workspaceLayout.supportsRowSplit ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceRowSplitRatio(
                            workspaceRowSplitRatio - 0.05,
                          );
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <span style={workspaceOverflowLeadingGlyphStyle}>↑</span>
                        Reduce Top Row
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceRowSplitRatio(0.5);
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <span style={workspaceOverflowLeadingGlyphStyle}>↕</span>
                        Reset Row Split
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setWorkspaceRowSplitRatio(
                            workspaceRowSplitRatio + 0.05,
                          );
                          setPaneActionsMenuOpen(false);
                        }}
                        style={workspaceOverflowMenuItemStyle(false, false)}
                      >
                        <span style={workspaceOverflowLeadingGlyphStyle}>↓</span>
                        Expand Top Row
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
          </ExplorerPopupSurface>
        </div>
      );
    },
    [
      activeWorkspaceTab,
      canUseCommanderActions,
      closeActiveTab,
      columnSplitPercent,
      commanderButtonsDisabled,
      commanderSummaryText,
      commanderTargetPaneId,
      copySelectionToCommanderTarget,
      duplicateActiveTab,
      focusNextPane,
      linkedNavigationEnabled,
      moveSelectionToCommanderTarget,
      paneActionsMenuOpen,
      rowSplitPercent,
      setLinkedNavigationEnabled,
      setWorkspaceColumnSplitRatio,
      setWorkspaceRowSplitRatio,
      syncCommanderTargetToActivePane,
      theme.accent,
      visiblePaneIds,
      workspaceColumnSplitRatio,
      workspaceLayout,
      workspaceRowSplitRatio,
      workspaceTabs.length,
    ],
  );
  const renderWorkspacePaneCountsControl = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) => {
      const sizing = getWorkspaceHeaderControlSizing(placement.sizeVariant);
      return (
        <div
          aria-label="Workspace layout"
          role="group"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: sizing.compact ? 3 : 4,
            padding: sizing.compact ? 2 : 3,
            borderRadius: 999,
            border: "1px solid var(--overlay-border)",
            background:
              "color-mix(in srgb, var(--overlay-explorer-chip-bg) 86%, black 14%)",
            flexShrink: 0,
          }}
        >
          {(["single", "split", "triple", "quad"] as const).map((layoutId) => {
            const layoutDefinition = getExplorerWorkspaceLayoutDefinition(layoutId);
            const isActiveLayout = workspaceLayoutMode === layoutId;
            return (
              <button
                key={layoutId}
                type="button"
                aria-pressed={isActiveLayout}
                onClick={() => ensureWorkspaceLayout(layoutId)}
                title={
                  isActiveLayout
                    ? `${layoutDefinition.shortLabel} active`
                    : `Switch workspace to ${layoutDefinition.label}`
                }
                style={{
                  ...paneActionButtonStyle(isActiveLayout, theme.accent),
                  minHeight: sizing.controlHeight,
                  padding: sizing.layoutButtonPadding,
                  fontSize: sizing.compact ? 9.5 : 10.5,
                }}
              >
                {layoutDefinition.shortLabel}
              </button>
            );
          })}
        </div>
      );
    },
    [ensureWorkspaceLayout, theme.accent, workspaceLayoutMode],
  );
  const toWorkspaceActionInvocationEntry = useCallback(
    (entry: ExplorerWorkspaceRuntimeSelectionEntry) => ({
      path: entry.path,
      name: entry.name,
      parentPath: getPathParent(entry.path),
      extension: entry.is_dir ? "" : getFileExtension(entry.name),
      stem: entry.is_dir ? entry.name : getFileStem(entry.name),
      isDirectory: entry.is_dir,
    }),
    [],
  );
  const buildWorkspaceActionExecutionRequest = useCallback(
    (
      action: LoadedExplorerAction,
      runtimeContext: {
        invocation: ExplorerActionExecutionInput["context"];
        primaryEntry: ReturnType<typeof toWorkspaceActionInvocationEntry> | null;
        targetEntries: ReturnType<typeof toWorkspaceActionInvocationEntry>[];
      },
    ): ExplorerActionExecutionInput | null => {
      if (!action.execution) {
        return null;
      }
      return {
      packId: action.packId,
      actionId: action.actionId,
      actionTitle: action.title,
      actionDirectory: action.directoryPath,
      execution: {
        runner: action.execution.runner,
        entry: action.execution.entry,
        args: [...action.execution.args],
        env: { ...action.execution.env },
        interpreter: action.execution.interpreter ?? null,
      },
      outputTarget: normalizeExplorerActionOutputTarget(
        action.presentation.outputTarget,
      ),
      timeoutMs: null,
      context: {
        kind: runtimeContext.invocation.kind,
        currentLocation: runtimeContext.invocation.currentLocation,
        selectedEntries: runtimeContext.targetEntries,
        primaryEntry: runtimeContext.primaryEntry,
        searchResult: null,
        previewTarget: null,
        previewContext: null,
        inputModality: runtimeContext.invocation.inputModality,
        reducedMotion: runtimeContext.invocation.reducedMotion,
        capabilities: runtimeContext.invocation.capabilities,
        runtimePlatform,
      },
      };
    },
    [runtimePlatform, toWorkspaceActionInvocationEntry],
  );
  const buildWorkspaceChromeActionRuntimeContext = useCallback(
    (
      inputModality: ExplorerActionExecutionInput["context"]["inputModality"] =
        "keyboard",
    ) => {
      const targetEntries = (activeRuntime?.selectedEntries ?? []).map(
        toWorkspaceActionInvocationEntry,
      );
      const primaryEntry = targetEntries[0] ?? null;
      const invocationKind: ExplorerActionExecutionInput["context"]["kind"] =
        targetEntries.length > 1
          ? "multi-select"
          : targetEntries.length === 1
            ? "entry"
            : "background";
      const reducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const touchCapable =
        typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
      return {
        invocation: {
          kind: invocationKind,
          currentLocation: activePanePath,
          selectedEntries: targetEntries,
          primaryEntry,
          searchResult: null,
          previewTarget: null,
          previewContext: null,
          inputModality,
          reducedMotion,
          capabilities: {
            mouse: true,
            touch: touchCapable,
            pen: false,
            keyboard: true,
          },
          runtimePlatform,
        },
        primaryEntry,
        targetEntries,
      };
    },
    [activePanePath, activeRuntime?.selectedEntries, runtimePlatform, toWorkspaceActionInvocationEntry],
  );
  const canExecuteWorkspaceChromeAction = useCallback(
    (action: LoadedExplorerAction): boolean => {
      const runtimeContext = buildWorkspaceChromeActionRuntimeContext();
      if (!action.contexts.includes(runtimeContext.invocation.kind)) {
        return false;
      }

      const targetEntries = runtimeContext.targetEntries;
      const { selection } = action;
      const count = targetEntries.length;
      if (selection.minCount != null && count < selection.minCount) {
        return false;
      }
      if (selection.maxCount != null && count > selection.maxCount) {
        return false;
      }
      if (count === 0) {
        return selection.minCount == null || selection.minCount === 0;
      }
      if (
        !selection.allowFiles &&
        targetEntries.some((entry) => !entry.isDirectory)
      ) {
        return false;
      }
      if (
        !selection.allowDirectories &&
        targetEntries.some((entry) => entry.isDirectory)
      ) {
        return false;
      }
      if (selection.extensions.length === 0) {
        return true;
      }
      return targetEntries.every((entry) => {
        if (entry.isDirectory) {
          return selection.allowDirectories;
        }
        return selection.extensions.includes(entry.extension.toLowerCase());
      });
    },
    [buildWorkspaceChromeActionRuntimeContext],
  );
  const executeWorkspaceChromeActionControl = useCallback(
    async (
      action: LoadedExplorerAction,
      inputModality: ExplorerActionExecutionInput["context"]["inputModality"] =
        "keyboard",
    ) => {
      const runtimeContext =
        buildWorkspaceChromeActionRuntimeContext(inputModality);
      if (action.presentation.kind === "workflow") {
        dispatchExplorerWorkflowRequest({
          kind: "open",
          workflowId: action.presentation.workflowId ?? "",
          payload: action.presentation.workflowPayload ?? null,
          source: "workspace-action",
          pluginId: action.pluginId ?? null,
          targetPaneId: activePaneSnapshot?.instanceId ?? null,
          workspaceTabId: activeWorkspaceTab?.id ?? null,
          contextKind: runtimeContext.invocation.kind,
        });
        return;
      }

      const startedAt = Date.now();
      const outputTarget = action.presentation.outputTarget;
      const executionRequest = buildWorkspaceActionExecutionRequest(
        action,
        runtimeContext,
      );
      if (!executionRequest) {
        return;
      }

      try {
        const result = await executeExplorerAction(executionRequest);
        const finishedAt = Date.now();
        const runStatus = result.launchedInNativeTerminal
          ? "launched"
          : result.success
            ? "succeeded"
            : "failed";

        if (outputTarget !== "silent" || !result.success) {
          recordExplorerActionRun({
            id: `${result.packId}:${result.actionId}:${startedAt}`,
            packId: result.packId,
            actionId: result.actionId,
            actionTitle: result.actionTitle,
            actionDirectory: action.directoryPath,
            currentLocation: runtimeContext.invocation.currentLocation,
            selectedPaths: runtimeContext.targetEntries.map((entry) => entry.path),
            outputTarget,
            status: runStatus,
            startedAt,
            finishedAt,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
            runtimeUsed: result.runtimeUsed,
            commandDisplay: result.commandDisplay,
            workingDirectory: result.workingDirectory,
            stdout: result.stdout,
            stderr: result.stderr,
            launchedInNativeTerminal: result.launchedInNativeTerminal,
          });
        }

        if (
          result.success &&
          !result.launchedInNativeTerminal &&
          activePaneSnapshot?.instanceId
        ) {
          issueRefreshRequest(activePaneSnapshot.instanceId);
        }

        if (
          outputTarget === "task-center" ||
          outputTarget === "preview-terminal" ||
          !result.success
        ) {
          openExplorerTaskCenter();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordExplorerActionRun({
          id: `${action.packId}:${action.actionId}:${startedAt}`,
          packId: action.packId,
          actionId: action.actionId,
          actionTitle: action.title,
          actionDirectory: action.directoryPath,
          currentLocation: runtimeContext.invocation.currentLocation,
          selectedPaths: runtimeContext.targetEntries.map((entry) => entry.path),
          outputTarget,
          status: "failed",
          startedAt,
          finishedAt: Date.now(),
          exitCode: null,
          timedOut: false,
          runtimeUsed:
            action.execution?.interpreter ??
            action.execution?.runner ??
            "interpreter",
          commandDisplay: action.execution?.entry ?? action.title,
          workingDirectory: runtimeContext.invocation.currentLocation,
          stdout: "",
          stderr: message,
          launchedInNativeTerminal: false,
        });
        openExplorerTaskCenter();
      }
    },
    [
      activePaneSnapshot?.instanceId,
      activeWorkspaceTab?.id,
      buildWorkspaceActionExecutionRequest,
      buildWorkspaceChromeActionRuntimeContext,
      issueRefreshRequest,
    ],
  );
  const renderWorkspaceActionChromeControl = useCallback(
    (
      catalogEntry: ExplorerCustomizeCatalogEntry,
      placement: ExplorerChromeResolvedControlPlacement,
    ) => {
      const sizeVariant = placement.sizeVariant ?? "regular";
      const wantsIcon = placement.showIcon ?? true;
      const wantsLabel = placement.showLabel ?? true;
      const showIcon = wantsIcon || !wantsLabel;
      const showLabel = wantsLabel || !wantsIcon;
      const iconSize =
        sizeVariant === "wide" ? 14 : sizeVariant === "compact" ? 10 : 12;
      const isMissing = catalogEntry.source === "missing-action";
      const action = catalogEntry.action;
      const disabled =
        isMissing || !action || !canExecuteWorkspaceChromeAction(action);

      return (
        <button
          type="button"
          disabled={disabled}
          title={catalogEntry.description}
          onClick={() => {
            if (!action || disabled) {
              return;
            }
            void executeWorkspaceChromeActionControl(action, "mouse");
          }}
          style={{
            ...paneActionButtonStyle(false, theme.accent, disabled),
            justifyContent: showLabel ? "flex-start" : "center",
            gap: showIcon && showLabel ? 6 : 0,
            padding:
              sizeVariant === "wide"
                ? "7px 12px"
                : sizeVariant === "compact"
                  ? "4px 8px"
                  : "5px 10px",
            minHeight:
              sizeVariant === "wide" ? 32 : sizeVariant === "compact" ? 24 : 28,
            minWidth: showLabel
              ? sizeVariant === "wide"
                ? 132
                : 84
              : undefined,
            background: isMissing
              ? "color-mix(in srgb, #f59e0b 12%, black 4%)"
              : undefined,
            border: isMissing
              ? "1px solid color-mix(in srgb, #f59e0b 58%, transparent)"
              : undefined,
            color: disabled ? "var(--overlay-text-dim)" : undefined,
            overflow: "hidden",
          }}
        >
          {showIcon ? (
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isMissing ? <X size={iconSize} /> : <Plus size={iconSize} />}
            </span>
          ) : null}
          {showLabel ? (
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {catalogEntry.label}
            </span>
          ) : null}
        </button>
      );
    },
    [
      canExecuteWorkspaceChromeAction,
      executeWorkspaceChromeActionControl,
      theme.accent,
    ],
  );
  const mapWorkspaceChromeSurfacesToUnifiedHeader = useCallback(
    (
      surfaces: ExplorerChromeSurfaceId[],
    ): ExplorerChromeSurfaceId[] => {
      const nextSurfaces = new Set<ExplorerChromeSurfaceId>();
      for (const surfaceId of surfaces) {
        if (surfaceId === "workspaceHeader") {
          nextSurfaces.add("explorerTopbar");
          nextSurfaces.add("explorerToolbar");
          continue;
        }
        nextSurfaces.add(surfaceId);
      }
      return [...nextSurfaces];
    },
    [],
  );
  const workspaceChromeActionRegistry = useMemo<
    Array<
      ExplorerChromeControlDefinition & {
        isVisible: (surfaceId: ExplorerChromeSurfaceId) => boolean;
        render: (
          placement: ExplorerChromeResolvedControlPlacement,
        ) => React.ReactNode;
      }
    >
  >(
    () =>
      workspaceCustomizeCatalog
        .filter(
          (entry) =>
            entry.source !== "built-in" &&
            entry.surfaces.includes("workspaceHeader"),
        )
        .map((entry) => ({
          id: entry.controlId,
          label: entry.label,
          surfaces: mapWorkspaceChromeSurfacesToUnifiedHeader(entry.surfaces),
          isVisible: (surfaceId) =>
            mapWorkspaceChromeSurfacesToUnifiedHeader(entry.surfaces).includes(
              surfaceId,
            ),
          render: (placement) =>
            renderWorkspaceActionChromeControl(entry, placement),
        })),
    [
      mapWorkspaceChromeSurfacesToUnifiedHeader,
      renderWorkspaceActionChromeControl,
      workspaceCustomizeCatalog,
    ],
  );
  const workspaceChromeControlRegistry = useMemo<
    Array<
      ExplorerChromeControlDefinition & {
        isVisible: (surfaceId: ExplorerChromeSurfaceId) => boolean;
        render: (
          placement: ExplorerChromeResolvedControlPlacement,
        ) => React.ReactNode;
      }
    >
  >(
    () => [
      {
        id: "workspaceTabStrip",
        label: "Workspace Tabs",
        surfaces: ["explorerTopbar", "explorerToolbar"],
        isVisible: () => true,
        render: renderWorkspaceTabStrip,
      },
      {
        id: "workspacePaneCounts",
        label: "Workspace Layout",
        surfaces: ["explorerTopbar", "explorerToolbar"],
        isVisible: () => true,
        render: renderWorkspacePaneCountsControl,
      },
      {
        id: "workspaceTabs",
        label: "Workspace Tabs",
        surfaces: ["explorerTopbar", "explorerToolbar"],
        isVisible: () => false,
        render: () => null,
      },
      {
        id: "workspaceNewTab",
        label: "New Tab",
        surfaces: ["explorerTopbar", "explorerToolbar"],
        isVisible: () => true,
        render: renderWorkspaceNewTabControl,
      },
      {
        id: "workspacePaneActionsMenu",
        label: "Pane Actions Menu",
        surfaces: ["explorerTopbar", "explorerToolbar"],
        isVisible: () => true,
        render: renderWorkspacePaneActionsMenuControl,
      },
      {
        id: "workspaceSplitToggle",
        label: "Workspace Layout",
        surfaces: ["explorerTopbar", "explorerToolbar"],
        isVisible: () => false,
        render: () => null,
      },
      ...workspaceChromeActionRegistry,
    ],
    [
      activePane,
      activeWorkspaceTab,
      actions,
      canUseCommanderActions,
      closeActiveTab,
      closeWorkspaceTab,
      columnSplitPercent,
      commanderButtonsDisabled,
      commanderSummaryText,
      commanderTargetPaneId,
      copySelectionToCommanderTarget,
      createTabInFocusedPane,
      duplicateActiveTab,
      ensureWorkspaceLayout,
      focusNextPane,
      focusWorkspaceTab,
      linkedNavigationEnabled,
      moveSelectionToCommanderTarget,
      paneActionsMenuOpen,
      renderWorkspaceNewTabControl,
      renderWorkspacePaneActionsMenuControl,
      renderWorkspacePaneCountsControl,
      renderWorkspaceTabStrip,
      rowSplitPercent,
      runtimeSnapshotsByInstanceId,
      sessions,
      setFocusedPane,
      setPaneActionsMenuOpen,
      setWorkspaceColumnSplitRatio,
      setWorkspaceRowSplitRatio,
      syncCommanderTargetToActivePane,
      theme.accent,
      visiblePaneIds,
      workspaceChromeActionRegistry,
      workspaceColumnSplitRatio,
      workspaceLayoutMode,
      workspaceLayout.supportsColumnSplit,
      workspaceLayout.supportsRowSplit,
      workspaceRowSplitRatio,
      workspaceTabs,
    ],
  );
  const activateWorkspaceChromeCommand = useCallback(
    (controlId: ExplorerChromeControlId): boolean => {
      const catalogEntry = workspaceCustomizeCatalogByControlId.get(controlId);
      if (
        catalogEntry &&
        catalogEntry.source !== "built-in" &&
        catalogEntry.action
      ) {
        if (!canExecuteWorkspaceChromeAction(catalogEntry.action)) {
          return false;
        }
        void executeWorkspaceChromeActionControl(catalogEntry.action, "keyboard");
        return true;
      }

      switch (controlId) {
        case "workspaceTabStrip":
          return false;
        case "workspacePaneCounts":
          cycleWorkspaceLayout();
          return true;
        case "workspaceMode":
        case "workspaceLayoutHint":
        case "workspaceSplitToggle":
          cycleWorkspaceLayout();
          return true;
        case "workspaceNewTab":
          createTabInFocusedPane();
          return true;
        case "workspacePaneActionsMenu":
          togglePaneActionsMenu();
          return true;
        case "workspaceDuplicateTab":
          if (!activeWorkspaceTab) {
            return false;
          }
          duplicateActiveTab();
          return true;
        case "workspaceFocusLeft":
          if (visiblePaneIds.length <= 1) {
            return false;
          }
          focusPreviousPane();
          return true;
        case "workspaceFocusRight":
          if (visiblePaneIds.length <= 1) {
            return false;
          }
          focusNextPane();
          return true;
        case "workspaceSyncPath":
          if (!commanderTargetPaneSnapshot || !activePanePath.trim()) {
            return false;
          }
          syncCommanderTargetToActivePane();
          return true;
        case "workspaceLinkNavigation":
          if (!commanderTargetPaneId) {
            return false;
          }
          setLinkedNavigationEnabled((current) => !current);
          return true;
        case "workspaceCopyToPane":
          if (commanderButtonsDisabled) {
            return false;
          }
          copySelectionToCommanderTarget();
          return true;
        case "workspaceMoveToPane":
          if (commanderButtonsDisabled) {
            return false;
          }
          moveSelectionToCommanderTarget();
          return true;
        case "workspaceSwapPane":
          if (
            !activePaneSnapshot ||
            !commanderTargetPaneSnapshot ||
            !activePanePath.trim() ||
            !commanderTargetPath.trim()
          ) {
            return false;
          }
          issueNavigationRequest(
            activePaneSnapshot.instanceId,
            commanderTargetPath,
            true,
          );
          issueNavigationRequest(
            commanderTargetPaneSnapshot.instanceId,
            activePanePath,
            true,
          );
          return true;
        case "workspaceCloseTab":
          if (!activeWorkspaceTab || workspaceTabs.length <= 1) {
            return false;
          }
          closeActiveTab();
          return true;
        case "workspaceSplitNudgeLeft":
          return nudgeWorkspaceSplit(-0.05);
        case "workspaceSplitReset":
          return resetWorkspaceSplit();
        case "workspaceSplitNudgeRight":
          return nudgeWorkspaceSplit(0.05);
        default:
          return false;
      }
    },
    [
      activePanePath,
      activePaneSnapshot,
      activeWorkspaceTab,
      closeActiveTab,
      commanderButtonsDisabled,
      commanderTargetPaneId,
      commanderTargetPaneSnapshot,
      commanderTargetPath,
      canExecuteWorkspaceChromeAction,
      copySelectionToCommanderTarget,
      createTabInFocusedPane,
      cycleWorkspaceLayout,
      duplicateActiveTab,
      executeWorkspaceChromeActionControl,
      focusNextPane,
      focusPreviousPane,
      issueNavigationRequest,
      moveSelectionToCommanderTarget,
      nudgeWorkspaceSplit,
      resetWorkspaceSplit,
      syncCommanderTargetToActivePane,
      togglePaneActionsMenu,
      visiblePaneIds.length,
      workspaceCustomizeCatalogByControlId,
      workspaceTabs.length,
    ],
  );
  const workspaceCommandControlIdByCommandId = useMemo(
    () =>
      new Map(
        workspaceChromeControlRegistry.map(
          (entry) => [getExplorerChromeCommandId(entry.id), entry.id] as const,
        ),
      ),
    [workspaceChromeControlRegistry],
  );
  const triggerWorkspaceChromeCommandBinding = useCallback(
    (commandId: string): boolean => {
      const controlId = workspaceCommandControlIdByCommandId.get(commandId);
      return controlId ? activateWorkspaceChromeCommand(controlId) : false;
    },
    [activateWorkspaceChromeCommand, workspaceCommandControlIdByCommandId],
  );
  const externalWorkspaceChromeControls = useMemo<
    ExplorerExternalChromeControlDefinition[]
  >(
    () =>
      workspaceChromeControlRegistry.map((entry) => ({
        ...entry,
        activate: () => {
          activateWorkspaceChromeCommand(entry.id);
        },
      })),
    [activateWorkspaceChromeCommand, workspaceChromeControlRegistry],
  );
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const workspaceOwnsKeyboard =
        activeElement instanceof Node &&
        containerRef.current?.contains(activeElement) === true;
      if (!workspaceOwnsKeyboard) {
        return;
      }
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable)
      ) {
        return;
      }
      for (const [commandId, binding] of Object.entries(commandBindingsById)) {
        if (!binding || !matchesKeybinding(event, binding)) {
          continue;
        }
        if (triggerWorkspaceChromeCommandBinding(commandId)) {
          event.preventDefault();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [commandBindingsById, triggerWorkspaceChromeCommandBinding]);

  const renderPane = useCallback(
    (
      pane: ExplorerPaneId,
      paneSnapshot: ExplorerWorkspacePaneSnapshot | null,
    ) => {
      const isActivePane = activePane === pane;
      if (!paneSnapshot) {
        return (
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              border: "1px dashed var(--overlay-border)",
              borderRadius: 14,
              background: "var(--overlay-bg-panel)",
              color: "var(--overlay-text-muted)",
            }}
            onMouseDown={() => setFocusedPane(pane)}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: "grid",
                placeItems: "center",
              }}
            >
              <div
                style={{
                  border: "1px solid var(--overlay-border)",
                  borderRadius: 999,
                  padding: "8px 14px",
                  background: "var(--overlay-explorer-chip-bg)",
                  color: "var(--overlay-text-primary)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Pane unavailable
              </div>
            </div>
          </div>
        );
      }

      return (
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--overlay-border)",
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--overlay-bg-panel)",
            ...resolvePaneAccent(isActivePane),
          }}
          onMouseDown={() => setFocusedPane(pane)}
        >
          <FileExplorer
            key={paneSnapshot.instanceId}
            appearance={appearance}
            chromeControlSurface={chromeControlSurface}
            externalNavigationRequest={
              navigationRequestsByInstanceId[paneSnapshot.instanceId] ?? null
            }
            externalRevealRequest={
              revealRequestsByInstanceId[paneSnapshot.instanceId] ?? null
            }
            externalRefreshRequest={
              refreshRequestsByInstanceId[paneSnapshot.instanceId] ?? null
            }
            externalSelectionTransferRequest={
              selectionTransferRequestsByInstanceId[paneSnapshot.instanceId] ??
              null
            }
            instanceId={paneSnapshot.instanceId}
            workspaceTabId={activeWorkspaceTab?.id ?? null}
            layoutMode={layoutMode}
            dockPreviewPolicy={dockPreviewPolicy}
            defaultModeProfileId={defaultModeProfileId}
            shellDefaultExplorerLayoutId={shellDefaultExplorerLayoutId}
            renderDragOverlayHost={false}
            workspacePaneCount={workspacePaneCount}
            isActiveWorkspacePane={isActivePane}
            onWorkspaceRuntimeSnapshotChange={publishRuntimeSnapshot}
            onWorkspaceSelectionTransferComplete={
              handleWorkspaceSelectionTransferComplete
            }
            actions={actions}
            pluginActions={pluginActions}
            pluginContextMenuItems={pluginContextMenuItems}
            pluginExplorerActivityLanes={pluginExplorerActivityLanes}
            pluginExplorerViews={pluginExplorerViews}
            pluginExplorerWidgets={pluginExplorerWidgets}
            pluginPreviewLanes={pluginPreviewLanes}
            pluginWorkflows={pluginWorkflows}
            explorerPicker={isActivePane ? explorerPicker : null}
            onExplorerPickerConfirm={onExplorerPickerConfirm}
            onExplorerPickerCancel={onExplorerPickerCancel}
            theme={theme}
            onAddBookmark={onAddBookmark}
            explorerLayouts={explorerLayouts}
            explorerViews={explorerViews}
            explorerWidgets={explorerWidgets}
            homePacks={homePacks}
            menuPacks={menuPacks}
            onOpenPanel={onOpenPanel}
            onOpenSettingsSection={onOpenSettingsSection}
            onOpenInFilesystemAquarium={onOpenInFilesystemAquarium}
            onOpenInTerminal={onOpenInTerminal}
            externalChromeControls={
              isActivePane ? externalWorkspaceChromeControls : []
            }
          />
        </div>
      );
    },
    [
      activePane,
      appearance,
      chromeControlSurface,
      handleWorkspaceSelectionTransferComplete,
      dockPreviewPolicy,
      layoutMode,
      navigationRequestsByInstanceId,
      onAddBookmark,
      pendingOpenRequest,
      actions,
      defaultModeProfileId,
      explorerLayouts,
      explorerViews,
      explorerWidgets,
      externalWorkspaceChromeControls,
      homePacks,
      onOpenInFilesystemAquarium,
      onOpenInTerminal,
      onOpenPanel,
      onOpenSettingsSection,
      onExplorerPickerCancel,
      onExplorerPickerConfirm,
      pluginActions,
      pluginContextMenuItems,
      pluginExplorerActivityLanes,
      pluginExplorerViews,
      pluginExplorerWidgets,
      pluginPreviewLanes,
      pluginWorkflows,
      publishRuntimeSnapshot,
      refreshRequestsByInstanceId,
      revealRequestsByInstanceId,
      explorerPicker,
      selectionTransferRequestsByInstanceId,
      setFocusedPane,
      theme,
      workspacePaneCount,
    ],
  );

  const startColumnResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startRatio = workspaceColumnSplitRatio;
      const width =
        paneSurfaceRef.current?.getBoundingClientRect().width ??
        containerRef.current?.getBoundingClientRect().width ??
        1;
      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setWorkspaceColumnSplitRatio(startRatio + delta / width);
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [setWorkspaceColumnSplitRatio, workspaceColumnSplitRatio],
  );
  const startRowResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startRatio = workspaceRowSplitRatio;
      const height =
        paneSurfaceRef.current?.getBoundingClientRect().height ??
        containerRef.current?.getBoundingClientRect().height ??
        1;
      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY;
        setWorkspaceRowSplitRatio(startRatio + delta / height);
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [setWorkspaceRowSplitRatio, workspaceRowSplitRatio],
  );
  const renderColumnHandle = useCallback(
    (key: string) => (
      <div key={key} style={splitHandleStyle} onMouseDown={startColumnResize}>
        <div style={splitHandleInnerStyle} />
      </div>
    ),
    [startColumnResize],
  );
  const renderRowHandle = useCallback(
    (key: string) => (
      <div
        key={key}
        style={{
          ...splitHandleStyle,
          width: "100%",
          height: 8,
          cursor: "row-resize",
        }}
        onMouseDown={startRowResize}
      >
        <div style={{ ...splitHandleInnerStyle, width: "100%", height: 2 }} />
      </div>
    ),
    [startRowResize],
  );

  return (
    <div
      ref={containerRef}
      onDragOver={onWorkspaceDragOver}
      onDragLeave={onWorkspaceDragLeave}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        gap: 10,
      }}
    >
      {workspaceLayoutMode === "single" ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          {renderPane("pane-1", activeWorkspaceTab?.panes["pane-1"] ?? null)}
        </div>
      ) : workspaceLayoutMode === "split" ? (
        <div
          ref={paneSurfaceRef}
          style={{ display: "flex", flex: 1, minHeight: 0, gap: 10 }}
        >
          <div
            style={{
              flex: workspaceColumnSplitRatio,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            {renderPane("pane-1", activeWorkspaceTab?.panes["pane-1"] ?? null)}
          </div>
          {renderColumnHandle("split-column")}
          <div
            style={{
              flex: 1 - workspaceColumnSplitRatio,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            {renderPane("pane-2", activeWorkspaceTab?.panes["pane-2"] ?? null)}
          </div>
        </div>
      ) : workspaceLayoutMode === "triple" ? (
        <div
          ref={paneSurfaceRef}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            gap: 10,
          }}
        >
          <div style={{ flex: workspaceRowSplitRatio, minHeight: 0 }}>
            {renderPane("pane-1", activeWorkspaceTab?.panes["pane-1"] ?? null)}
          </div>
          {renderRowHandle("triple-row")}
          <div
            style={{
              display: "flex",
              minHeight: 0,
              flex: 1 - workspaceRowSplitRatio,
              gap: 10,
            }}
          >
            <div
              style={{
                flex: workspaceColumnSplitRatio,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPane(
                "pane-2",
                activeWorkspaceTab?.panes["pane-2"] ?? null,
              )}
            </div>
            {renderColumnHandle("triple-column")}
            <div
              style={{
                flex: 1 - workspaceColumnSplitRatio,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPane(
                "pane-3",
                activeWorkspaceTab?.panes["pane-3"] ?? null,
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={paneSurfaceRef}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              minHeight: 0,
              flex: workspaceRowSplitRatio,
              gap: 10,
            }}
          >
            <div
              style={{
                flex: workspaceColumnSplitRatio,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPane(
                "pane-1",
                activeWorkspaceTab?.panes["pane-1"] ?? null,
              )}
            </div>
            {renderColumnHandle("quad-column-top")}
            <div
              style={{
                flex: 1 - workspaceColumnSplitRatio,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPane(
                "pane-2",
                activeWorkspaceTab?.panes["pane-2"] ?? null,
              )}
            </div>
          </div>
          {renderRowHandle("quad-row")}
          <div
            style={{
              display: "flex",
              minHeight: 0,
              flex: 1 - workspaceRowSplitRatio,
              gap: 10,
            }}
          >
            <div
              style={{
                flex: workspaceColumnSplitRatio,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPane(
                "pane-3",
                activeWorkspaceTab?.panes["pane-3"] ?? null,
              )}
            </div>
            {renderColumnHandle("quad-column-bottom")}
            <div
              style={{
                flex: 1 - workspaceColumnSplitRatio,
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {renderPane(
                "pane-4",
                activeWorkspaceTab?.panes["pane-4"] ?? null,
              )}
            </div>
          </div>
        </div>
      )}
      <ExplorerDragOverlay />
    </div>
  );
}

const toolbarButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 999,
  border: "1px solid var(--overlay-border)",
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-text-primary)",
  cursor: "pointer",
};

const paneSwitcherGroupStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  flexWrap: "wrap",
};

function paneSwitcherButtonStyle(
  active: boolean,
  accent: string,
  tabStyle: OverlayExplorerWorkspaceTabStyle,
): React.CSSProperties {
  const windowsStyle = tabStyle === "windows";
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 38,
    padding: "4px 9px",
    borderRadius: windowsStyle ? 8 : 999,
    border: `1px solid ${active ? `${accent}66` : "var(--overlay-border)"}`,
    background: active
      ? windowsStyle
        ? "color-mix(in srgb, var(--overlay-bg-panel) 96%, white 4%)"
        : `${accent}18`
      : windowsStyle
        ? "rgba(255,255,255,0.025)"
        : "var(--overlay-explorer-chip-bg)",
    color: active ? "var(--overlay-text-primary)" : "var(--overlay-text-muted)",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function paneSwitcherCountStyle(
  active: boolean,
  accent: string,
  tabStyle: OverlayExplorerWorkspaceTabStyle,
): React.CSSProperties {
  const windowsStyle = tabStyle === "windows";
  return {
    minWidth: 16,
    padding: "1px 5px",
    borderRadius: windowsStyle ? 6 : 999,
    background: active
      ? windowsStyle
        ? "rgba(255,255,255,0.09)"
        : `${accent}24`
      : "rgba(255,255,255,0.08)",
    color: active ? "var(--overlay-text-primary)" : "var(--overlay-text-dim)",
    fontSize: 9,
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function workspaceTabChipStyle(
  active: boolean,
  accent: string,
  tabStyle: OverlayExplorerWorkspaceTabStyle,
  dropTarget = false,
): React.CSSProperties {
  const windowsStyle = tabStyle === "windows";
  const underlineStyle = tabStyle === "underline";
  const segmentStyle = tabStyle === "segment";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: windowsStyle ? 4 : 6,
    minWidth: 0,
    padding: "6px 8px 6px 10px",
    borderRadius: windowsStyle ? "10px 10px 0 0" : tabStyle === "capsule" ? 999 : 10,
    border: windowsStyle
      ? `1px solid ${dropTarget ? `${accent}92` : active ? "color-mix(in srgb, var(--overlay-border) 50%, white 50%)" : "var(--overlay-border)"}`
      : `1px solid ${dropTarget ? `${accent}92` : active ? `${accent}66` : "var(--overlay-border)"}`,
    borderBottom: windowsStyle
      ? `1px solid ${active ? "color-mix(in srgb, var(--overlay-bg-panel) 92%, white 8%)" : "transparent"}`
      : underlineStyle
        ? `2px solid ${active ? accent : "transparent"}`
        : undefined,
    background: dropTarget
      ? `color-mix(in srgb, ${accent} 18%, var(--overlay-explorer-chip-bg))`
      : windowsStyle
        ? active
          ? "color-mix(in srgb, var(--overlay-bg-panel) 96%, white 4%)"
          : "rgba(255,255,255,0.025)"
      : underlineStyle
        ? "transparent"
      : segmentStyle
        ? active
          ? "color-mix(in srgb, var(--overlay-accent) 12%, transparent)"
          : "rgba(255,255,255,0.02)"
      : active
        ? `${accent}1b`
        : "var(--overlay-explorer-chip-bg)",
    boxShadow: dropTarget
      ? `0 0 0 1px ${accent}2a, 0 12px 28px ${accent}24`
      : undefined,
    marginRight: windowsStyle ? 2 : 0,
  };
}

function workspaceTabButtonStyle(
  active: boolean,
  tabStyle: OverlayExplorerWorkspaceTabStyle,
  dropTarget = false,
): React.CSSProperties {
  const windowsStyle = tabStyle === "windows";
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: active ? "var(--overlay-text-primary)" : "var(--overlay-text-muted)",
    cursor: "pointer",
    padding: 0,
    position: "relative",
    minHeight: windowsStyle ? 20 : undefined,
    transform: dropTarget ? "translateY(-1px) scale(1.02)" : "none",
    transition:
      "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), color 160ms ease",
  };
}

function workspaceTabIconButtonStyle(
  tabStyle: OverlayExplorerWorkspaceTabStyle,
  active: boolean,
): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 20,
    borderRadius: tabStyle === "windows" ? 6 : 999,
    border: "none",
    background:
      tabStyle === "windows" && active
        ? "rgba(255,255,255,0.06)"
        : "transparent",
    color: active ? "var(--overlay-text-muted)" : "var(--overlay-text-dim)",
    cursor: "pointer",
    flexShrink: 0,
  };
}

function workspaceTabStripRootStyle(
  tabStyle: OverlayExplorerWorkspaceTabStyle,
): React.CSSProperties {
  return tabStyle === "windows"
    ? {
        alignItems: "flex-end",
      }
    : {};
}

function workspaceTabLaneStyle(
  tabStyle: OverlayExplorerWorkspaceTabStyle,
): React.CSSProperties {
  return tabStyle === "windows"
    ? {
        alignItems: "flex-end",
        paddingTop: 4,
      }
    : {};
}

function workspaceTabActiveIndicatorStyle(
  tabStyle: OverlayExplorerWorkspaceTabStyle,
  accent: string,
): React.CSSProperties {
  return {
    position: "absolute",
    left: tabStyle === "windows" ? 0 : 8,
    right: tabStyle === "windows" ? 0 : 8,
    bottom: tabStyle === "windows" ? -7 : -5,
    height: 2,
    borderRadius: 999,
    background: accent,
    pointerEvents: "none",
  };
}

function paneActionButtonStyle(
  active: boolean,
  accent: string,
  disabled = false,
): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : "var(--overlay-border)"}`,
    background: active ? `${accent}18` : "var(--overlay-explorer-chip-bg)",
    color: active ? "var(--overlay-text-primary)" : "var(--overlay-text-muted)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 10.5,
    fontWeight: 700,
    opacity: disabled ? 0.45 : 1,
  };
}

const workspaceOverflowMenuStyle: React.CSSProperties = {
  ...resolveExplorerPopupSurfaceStyle({
    minWidth: 240,
  }),
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

function workspaceOverflowMenuItemStyle(
  active: boolean,
  disabled: boolean,
): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    minWidth: 0,
    border: "none",
    borderRadius: 10,
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : "transparent",
    color: disabled ? "var(--overlay-text-dim)" : "var(--overlay-text-primary)",
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "7px 9px",
    fontSize: 11,
    fontWeight: 600,
    textAlign: "left",
    opacity: disabled ? 0.5 : 1,
  };
}

const workspaceOverflowDividerStyle: React.CSSProperties = {
  height: 1,
  margin: "4px 0 1px",
  background: "var(--overlay-border)",
  opacity: 0.8,
};

const workspaceOverflowLabelStyle: React.CSSProperties = {
  padding: "2px 9px 0",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--overlay-text-dim)",
};

const workspaceOverflowLeadingGlyphStyle: React.CSSProperties = {
  width: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function workspaceOverflowSummaryStyle(accent: string): React.CSSProperties {
  return {
    padding: "2px 9px 4px",
    fontSize: 10,
    fontWeight: 600,
    color: accent,
  };
}

const workspaceOverflowMetaStyle: React.CSSProperties = {
  padding: "2px 9px 4px",
  fontSize: 10,
  fontWeight: 600,
  color: "var(--overlay-text-dim)",
  whiteSpace: "nowrap",
};

const splitHandleStyle: React.CSSProperties = {
  width: 8,
  borderRadius: 999,
  cursor: "col-resize",
  background: "transparent",
  position: "relative",
  flexShrink: 0,
};

const splitHandleInnerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  margin: "auto",
  width: 2,
  height: "100%",
  borderRadius: 999,
  background: "color-mix(in srgb, var(--overlay-border) 85%, transparent)",
};
