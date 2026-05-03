import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderTree,
  HardDrive,
  Home,
  Pencil,
  Search,
  Star,
  Tag,
  Undo2,
  X,
} from "@/components/AppIcons";
import { OverlayScrollArea } from "../OverlayScrollArea";
import {
  useInteractionMotionController,
  type InteractionMotionBinding,
} from "../../animation/interactionMotion";
import type { ResolvedOverlayAppearance } from "../../config/appearance";
import { matchesKeybinding } from "../../config/hotkeys";
import { useExplorerStore } from "../../store/explorerStore";
import { useSettingsStore } from "../../store/settingsStore";
import {
  ExplorerChromeSurface,
  type ExplorerChromeSurfaceLayoutDynamics,
} from "./ExplorerChromeSurface";
import {
  applyExplorerBookmarkImportPlan,
  buildExplorerBookmarkTree,
  clearExplorerBookmarkCategoryFilters,
  createExplorerBookmarkFolder,
  createExplorerCustomCategory,
  cycleExplorerBookmarkNodeColor,
  getAllExplorerBookmarkCategories,
  isExplorerBookmarkFolderExpanded,
  isExplorerRailSectionCollapsed,
  planExplorerBookmarkImport,
  removeExplorerBookmarkNode,
  renameExplorerBookmarkNode,
  setExplorerRailAutoExpandToOpenFolder,
  setExplorerBookmarkSearchQuery,
  setExplorerRailViewMode,
  toggleExplorerBookmarkCategoryFilter,
  toggleExplorerBookmarkFolder,
  toggleExplorerRailSection,
  type ExplorerBookmarkImportPlan,
  type ExplorerBookmarkImportSource,
  type ExplorerBookmarkTreeNode,
} from "./explorerRailState";
import {
  isCloudExplorerPath,
  listExplorerLocation,
  type ExplorerDriveInfo,
  type ExplorerFileEntry,
  type ExplorerSavedSearch,
  type ExplorerTagMetadataSnapshot,
} from "../../runtime/explorerBackend";
import {
  invalidateExplorerDirectoryResultCaches,
  loadCachedExplorerLocation,
} from "./explorerDirectoryCache";
import type {
  ExplorerChromeControlDefinition,
  ExplorerChromeControlId,
  ExplorerChromeLayoutId,
  ExplorerChromeOverrideSnapshot,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from "../../config/explorerChromeLayouts";
import { resolveExplorerChromeSurfaceLayout } from "../../config/explorerChromeLayouts";
import { getExplorerChromeCommandId } from "../../config/explorerCustomizeCatalog";
import {
  explorerRailViewModes,
  getExplorerRailViewModeDefinition,
  type ExplorerRailViewModeDefinition,
} from "../../config/explorerRail";
import { isExplorerHomePath } from "../../config/explorerVirtualLocations";
import {
  createExplorerDropSurfaceBinding,
  getExplorerDropBindingElementProps,
  getExplorerSharedDragSession,
  readExplorerPathsFromDataTransfer,
  shallowEqualExplorerDragSelection,
  useExplorerDragInteractionSelector,
} from "./explorerDragAndDrop";

interface ExplorerSideRailProps {
  appearance?: Pick<ResolvedOverlayAppearance, "baseTheme"> | null;
  accent: string;
  brandLabel: string;
  sidebarWidth: number;
  currentPath: string;
  dropScopeId?: string;
  locationTitle?: string;
  locationLabel?: string;
  drives: ExplorerDriveInfo[];
  drivesLoading: boolean;
  showHiddenFiles: boolean;
  isCompactDock: boolean;
  savedSearches?: ExplorerSavedSearch[];
  availableTags?: ExplorerTagMetadataSnapshot["tags"];
  activeTagFilterIds?: string[];
  onNavigate: (path: string) => void;
  onGoHome: () => void;
  onOpenSavedSearch?: (savedSearch: ExplorerSavedSearch) => void;
  onDeleteSavedSearch?: (savedSearchId: string) => void;
  onToggleTagFilter?: (tagId: string) => void;
  onClearTagFilters?: () => void;
  onBookmarkCreated: (name: string, path: string) => void;
  onCloseSources?: () => void;
  resolveDroppedSources: (paths: string[]) => ExplorerBookmarkImportSource[];
  localTreeRefreshRevision?: number;
  chromeLayoutId: ExplorerChromeLayoutId;
  chromeOverride?: ExplorerChromeOverrideSnapshot | null;
  railHeaderLayoutDynamics?: ExplorerChromeSurfaceLayoutDynamics;
  chromeEditMode?: {
    active: boolean;
    draggingControlId: ExplorerChromeControlId | null;
    highlightedDropTarget?: {
      surfaceId: ExplorerChromeSurfaceId;
      zoneId: ExplorerChromeZoneId;
      targetIndex: number;
      offsetPx: number;
    } | null;
    selectedControlId?: ExplorerChromeControlId | null;
    pendingHotkeyControlId?: ExplorerChromeControlId | null;
    onRegisterSurface?: (surface: ExplorerChromeResolvedSurface) => void;
    onUnregisterSurface?: (surfaceId: ExplorerChromeSurfaceId) => void;
    onDragStart: (controlId: ExplorerChromeControlId) => void;
    onDragEnd: () => void;
    onBeginPointerDrag?: (args: {
      controlId: ExplorerChromeControlId;
      pointerId: number;
      sourceKind: "placed";
      startPoint: { x: number; y: number };
      onTap?: (controlId: ExplorerChromeControlId) => void;
    }) => void;
    onSetHighlightedDropTarget?: (
      target: {
        surfaceId: ExplorerChromeSurfaceId;
        zoneId: ExplorerChromeZoneId;
        targetIndex: number;
        offsetPx: number;
      } | null,
    ) => void;
    onSetSelectedControl?: (controlId: ExplorerChromeControlId | null) => void;
    onSetPendingHotkeyControl?: (
      controlId: ExplorerChromeControlId | null,
    ) => void;
    onRequestHotkeyCapture?: (controlId: ExplorerChromeControlId) => void;
    onMoveControl: (args: {
      controlId: ExplorerChromeControlId;
      targetSurfaceId: ExplorerChromeSurfaceId;
      targetZoneId: ExplorerChromeZoneId;
      targetIndex: number;
      targetOffsetPx?: number;
    }) => void;
    onRemoveControl?: (controlId: ExplorerChromeControlId) => void;
  };
}

interface TreeRowProps {
  accent: string;
  bindRailMotion: (
    active?: boolean,
    motionStepIndex?: number,
  ) => InteractionMotionBinding;
  compactTree: boolean;
  dense: boolean;
  viewMode: ExplorerRailViewModeDefinition;
  showSupportingMeta: boolean;
  treeIndentStep: number;
  manageMode: boolean;
  currentPath: string;
  dropScopeId: string;
  row: ExplorerBookmarkTreeNode;
  dropTargetFolderId: string | null;
  activeFileDropTargetPath: string | null;
  activeFileDropSurfaceId: string | null;
  activeFileDwellSurfaceId: string | null;
  activeFileDwellProgress: number;
  onNavigate: (path: string) => void;
  onQueueFolderCreate: (parentId: string | null) => void;
  onRenameNode: (nodeId: string, nodeName: string) => void;
  onDropIntoFolder: (event: React.DragEvent, folderId: string | null) => void;
  onDragOverFolder: (event: React.DragEvent, folderId: string | null) => void;
  onDragLeaveFolder: () => void;
}

type LocalFolderTreeLoadState = {
  childFolders: ExplorerFileEntry[];
  status: "idle" | "loading" | "ready" | "error";
  errorMessage: string | null;
};

interface LocalFolderTreeRowProps {
  accent: string;
  bindRailMotion: (
    active?: boolean,
    motionStepIndex?: number,
  ) => InteractionMotionBinding;
  compactTree: boolean;
  dense: boolean;
  viewMode: ExplorerRailViewModeDefinition;
  currentPath: string;
  dropScopeId: string;
  path: string;
  depth: number;
  expandedFolderPaths: string[];
  folderChildrenByPath: Record<string, LocalFolderTreeLoadState>;
  showSupportingMeta: boolean;
  treeIndentStep: number;
  activeFileDropTargetPath: string | null;
  activeFileDropSurfaceId: string | null;
  activeFileDwellSurfaceId: string | null;
  activeFileDwellProgress: number;
  onNavigate: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onRetryLoad: (path: string) => void;
}

const EXPLORER_RAIL_DENSE_WIDTH = 260;
const EXPLORER_RAIL_ULTRA_DENSE_WIDTH = 220;
const EXPLORER_RAIL_VERBOSE_DRAG_GUIDE_MIN_WIDTH = 320;

export function ExplorerSideRail({
  appearance,
  accent,
  brandLabel,
  sidebarWidth,
  currentPath,
  dropScopeId = "explorer-drop-standalone",
  locationTitle: locationTitleProp,
  locationLabel: locationLabelProp,
  drives,
  drivesLoading,
  showHiddenFiles,
  isCompactDock,
  savedSearches = [],
  availableTags = [],
  activeTagFilterIds = [],
  onNavigate,
  onGoHome,
  onCloseSources,
  onOpenSavedSearch,
  onDeleteSavedSearch,
  onToggleTagFilter,
  onClearTagFilters,
  onBookmarkCreated,
  resolveDroppedSources,
  localTreeRefreshRevision = 0,
  chromeLayoutId,
  chromeOverride,
  railHeaderLayoutDynamics,
  chromeEditMode,
}: ExplorerSideRailProps) {
  const railRootRef = useRef<HTMLDivElement>(null);
  const rail = useExplorerStore((state) => state.rail);
  const persistence = useExplorerStore((state) => state.persistence);
  const updateRail = useExplorerStore((state) => state.updateRail);
  const restoreRailBackup = useExplorerStore(
    (state) => state.restoreRailBackup,
  );
  const clearPersistenceNotice = useExplorerStore(
    (state) => state.clearPersistenceNotice,
  );
  const commandBindingsById = useSettingsStore(
    (state) => state.settings.keybindings.commandBindingsById,
  );
  const interactionMotion = useInteractionMotionController(appearance);
  const activeFileDropState = useExplorerDragInteractionSelector(
    (state) => ({
      scopeId: state.scopeId,
      targetPath: state.valid ? state.targetPath : null,
      targetSurfaceId: state.valid ? state.targetSurfaceId : null,
      dwellSurfaceId:
        state.scopeId === dropScopeId ? state.dwellSurfaceId : null,
      dwellProgress: state.scopeId === dropScopeId ? state.dwellProgress : 0,
    }),
    shallowEqualExplorerDragSelection,
  );
  const activeFileDropTargetPath =
    activeFileDropState.scopeId === dropScopeId
      ? activeFileDropState.targetPath
      : null;
  const activeFileDropSurfaceId =
    activeFileDropState.scopeId === dropScopeId
      ? activeFileDropState.targetSurfaceId
      : null;
  const railItemTransition =
    "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease, opacity 160ms ease";
  const bindRailMotion = useCallback(
    (active = false, motionStepIndex = 0) =>
      interactionMotion.bindSurface({
        surfaceId: "explorerRailItem",
        triggerState: active ? { activate: true } : undefined,
        motionStepIndex,
        baseTransition: railItemTransition,
      }),
    [interactionMotion, railItemTransition],
  );

  const railViewMode = useMemo<ExplorerRailViewModeDefinition>(
    () => getExplorerRailViewModeDefinition(rail.viewMode),
    [rail.viewMode],
  );
  const autoExpandToOpenFolder = rail.autoExpandToOpenFolder === true;
  const dense =
    isCompactDock ||
    sidebarWidth < EXPLORER_RAIL_DENSE_WIDTH ||
    railViewMode.useCompactChrome;
  const ultraDense =
    isCompactDock || sidebarWidth < EXPLORER_RAIL_ULTRA_DENSE_WIDTH;
  const compactTree = dense || railViewMode.hideSupportingMeta;
  const showSupportingMeta = !ultraDense && !railViewMode.hideSupportingMeta;
  const showDriveCapacity = !ultraDense && !railViewMode.hideDriveCapacity;
  const showVerboseDragGuide =
    !isCompactDock &&
    sidebarWidth >= EXPLORER_RAIL_VERBOSE_DRAG_GUIDE_MIN_WIDTH &&
    railViewMode.id === "default";
  const [isManageMode, setIsManageMode] = useState(false);
  const [draftFolderParentId, setDraftFolderParentId] = useState<
    string | null | false
  >(false);
  const [draftFolderName, setDraftFolderName] = useState("New Folder");
  const [draftCategoryName, setDraftCategoryName] = useState("");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeName, setEditingNodeName] = useState("");
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(
    null,
  );
  const [importPlan, setImportPlan] =
    useState<ExplorerBookmarkImportPlan | null>(null);
  const toggleRailManageMode = useCallback(() => {
    setIsManageMode((current) => {
      const next = !current;
      if (!next) {
        setDraftFolderParentId(false);
        setDraftCategoryName("");
      }
      return next;
    });
  }, []);

  const deferredQuery = useDeferredValue(rail.searchQuery);
  const categories = useMemo(
    () => getAllExplorerBookmarkCategories(rail.customCategories),
    [rail.customCategories],
  );
  const bookmarkCount = useMemo(
    () => rail.nodes.filter((node) => node.kind === "bookmark").length,
    [rail.nodes],
  );
  const currentPathIsHome = isExplorerHomePath(currentPath);
  const locationTitle =
    locationTitleProp ??
    (currentPathIsHome ? "Home" : currentPath.trim() || "Home");
  const locationLabel = locationLabelProp ?? getPathLeaf(locationTitle);
  const normalizedBrandLabel = brandLabel.trim();
  const showBrandLabel =
    normalizedBrandLabel.length > 0 &&
    !["explorer", "overlayterm"].includes(normalizedBrandLabel.toLowerCase());
  const filteredRail = useMemo(
    () => ({
      ...rail,
      searchQuery: deferredQuery,
    }),
    [deferredQuery, rail],
  );
  const bookmarkTree = useMemo(
    () => buildExplorerBookmarkTree(filteredRail),
    [filteredRail],
  );
  const localDrives = useMemo(
    () =>
      drives.filter(
        (drive): drive is Extract<ExplorerDriveInfo, { kind: "local" }> =>
          drive.kind === "local",
      ),
    [drives],
  );
  const localDrivePaths = useMemo(
    () =>
      localDrives
        .map((drive) => normalizeLocalTreePath(drive.path))
        .filter(Boolean),
    [localDrives],
  );
  const activeLocalDrivePath = useMemo(
    () => resolveMostSpecificLocalDrivePath(currentPath, localDrivePaths),
    [currentPath, localDrivePaths],
  );
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<string[]>([]);
  const [folderChildrenByPath, setFolderChildrenByPath] = useState<
    Record<string, LocalFolderTreeLoadState>
  >({});
  const folderChildrenByPathRef = useRef<
    Record<string, LocalFolderTreeLoadState>
  >({});
  const lastLocalTreeRefreshRevisionRef = useRef(localTreeRefreshRevision);
  const shouldForceRefreshLocalTree =
    lastLocalTreeRefreshRevisionRef.current !== localTreeRefreshRevision;
  const updateFolderChildrenByPath = useCallback(
    (
      nextState:
        | Record<string, LocalFolderTreeLoadState>
        | ((
            current: Record<string, LocalFolderTreeLoadState>,
          ) => Record<string, LocalFolderTreeLoadState>),
    ) => {
      setFolderChildrenByPath((current) => {
        const resolvedNextState =
          typeof nextState === "function" ? nextState(current) : nextState;
        folderChildrenByPathRef.current = resolvedNextState;
        return resolvedNextState;
      });
    },
    [],
  );

  const loadFolderChildren = useCallback(
    async (path: string, options?: { forceRefresh?: boolean }) => {
      if (!path || isCloudExplorerPath(path)) {
        return;
      }
      const normalizedPath = normalizeLocalTreePath(path);
      const forceRefresh = options?.forceRefresh === true;
      const currentState = folderChildrenByPathRef.current[normalizedPath];
      if (
        currentState?.status === "loading" ||
        (currentState?.status === "ready" && !forceRefresh)
      ) {
        return;
      }
      updateFolderChildrenByPath((current) => {
        return {
          ...current,
          [normalizedPath]: {
            childFolders: current[normalizedPath]?.childFolders ?? [],
            status: "loading",
            errorMessage: null,
          },
        };
      });

      try {
        const listing = await loadCachedExplorerLocation({
          path: normalizedPath,
          showHidden: showHiddenFiles,
          listLocation: listExplorerLocation,
          forceRefresh,
        });
        const childFolders = listing.entries
          .filter((entry) => entry.is_dir)
          .sort((left, right) =>
            left.name.localeCompare(right.name, undefined, {
              sensitivity: "base",
            }),
          );
        updateFolderChildrenByPath((current) => ({
          ...current,
          [normalizedPath]: {
            childFolders,
            status: "ready",
            errorMessage: null,
          },
        }));
      } catch (error) {
        updateFolderChildrenByPath((current) => ({
          ...current,
          [normalizedPath]: {
            childFolders: current[normalizedPath]?.childFolders ?? [],
            status: "error",
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [showHiddenFiles, updateFolderChildrenByPath],
  );

  const toggleFolderExpand = useCallback(
    (path: string) => {
      const normalizedPath = normalizeLocalTreePath(path);
      let shouldLoad = false;
      setExpandedFolderPaths((current) => {
        if (current.includes(normalizedPath)) {
          return current.filter((entry) => entry !== normalizedPath);
        }
        shouldLoad = true;
        return [...current, normalizedPath];
      });
      if (shouldLoad) {
        void loadFolderChildren(normalizedPath);
      }
    },
    [loadFolderChildren],
  );

  useEffect(() => {
    updateFolderChildrenByPath({});
  }, [localDrivePaths, showHiddenFiles, updateFolderChildrenByPath]);

  useEffect(() => {
    setExpandedFolderPaths((current) =>
      current.filter((path) => {
        return (
          resolveMostSpecificLocalDrivePath(path, localDrivePaths) !== null
        );
      }),
    );
  }, [localDrivePaths]);

  const currentPathAncestors = useMemo(() => {
    if (!currentPath || isCloudExplorerPath(currentPath)) {
      return [];
    }
    const ancestors = getLocalPathAncestors(currentPath);
    const matchedDrivePath = resolveMostSpecificLocalDrivePath(
      currentPath,
      localDrivePaths,
    );
    if (!matchedDrivePath) {
      return [];
    }
    const matchedDriveIndex = ancestors.findIndex((ancestor) =>
      isSameLocalPath(ancestor, matchedDrivePath),
    );
    return matchedDriveIndex >= 0 ? ancestors.slice(matchedDriveIndex) : [];
  }, [currentPath, localDrivePaths]);

  const autoExpandedFolderPaths = useMemo(
    () => normalizeLocalTreePathList(currentPathAncestors),
    [currentPathAncestors],
  );
  const effectiveExpandedFolderPaths = useMemo(
    () =>
      autoExpandToOpenFolder
        ? mergeNormalizedLocalTreePathLists(
            expandedFolderPaths,
            autoExpandedFolderPaths,
          )
        : expandedFolderPaths,
    [autoExpandToOpenFolder, autoExpandedFolderPaths, expandedFolderPaths],
  );

  useEffect(() => {
    updateFolderChildrenByPath((current) =>
      pruneLocalFolderTreeState(current, effectiveExpandedFolderPaths),
    );
  }, [effectiveExpandedFolderPaths, updateFolderChildrenByPath]);

  useEffect(() => {
    if (!shouldForceRefreshLocalTree) {
      return;
    }
    lastLocalTreeRefreshRevisionRef.current = localTreeRefreshRevision;
    updateFolderChildrenByPath({});
    const refreshTargets = effectiveExpandedFolderPaths;
    if (refreshTargets.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      for (const folderPath of refreshTargets) {
        if (cancelled) {
          return;
        }
        invalidateExplorerDirectoryResultCaches(folderPath);
        await loadFolderChildren(folderPath, { forceRefresh: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveExpandedFolderPaths,
    loadFolderChildren,
    localTreeRefreshRevision,
    shouldForceRefreshLocalTree,
    updateFolderChildrenByPath,
  ]);

  useEffect(() => {
    const folderPathsToLoad = effectiveExpandedFolderPaths;
    if (folderPathsToLoad.length === 0) {
      return;
    }

    const forceRefresh = shouldForceRefreshLocalTree;
    let cancelled = false;
    void (async () => {
      for (const ancestor of folderPathsToLoad) {
        if (cancelled) {
          return;
        }
        await loadFolderChildren(ancestor, { forceRefresh });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveExpandedFolderPaths,
    loadFolderChildren,
    localTreeRefreshRevision,
  ]);

  const handleBookmarkDrop = (
    event: React.DragEvent,
    targetFolderId: string | null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetFolderId(null);
    const droppedPaths = readExplorerPathsFromDataTransfer({
      dataTransfer: event.dataTransfer,
      fallbackPaths: getExplorerSharedDragSession()?.paths ?? [],
    });

    const sources = resolveDroppedSources(droppedPaths);
    const nextPlan = planExplorerBookmarkImport(rail, sources, targetFolderId);
    if (nextPlan) {
      setImportPlan(nextPlan);
    }
  };

  const applyPlan = (mode: "bookmark" | "folder") => {
    if (!importPlan) {
      return;
    }

    const result = applyExplorerBookmarkImportPlan(rail, importPlan, mode);
    updateRail(result.snapshot);
    for (const node of result.createdNodes) {
      onBookmarkCreated(node.name, node.path);
    }
    setImportPlan(null);
  };

  const commitDraftFolder = () => {
    if (draftFolderParentId === false) {
      return;
    }

    const result = createExplorerBookmarkFolder(rail, {
      parentId: draftFolderParentId || null,
      name: draftFolderName,
      color: accent,
    });
    updateRail(result.snapshot);
    setDraftFolderParentId(false);
    setDraftFolderName("New Folder");
    setEditingNodeId(result.node.id);
    setEditingNodeName(result.node.name);
  };

  const commitDraftCategory = () => {
    const result = createExplorerCustomCategory(
      rail,
      draftCategoryName,
      accent,
    );
    updateRail(result.snapshot);
    setDraftCategoryName("");
  };

  const commitNodeRename = () => {
    if (!editingNodeId) {
      return;
    }
    updateRail(
      renameExplorerBookmarkNode(rail, editingNodeId, editingNodeName),
    );
    setEditingNodeId(null);
    setEditingNodeName("");
  };

  const railHeaderRowStyle = useMemo<React.CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
      minWidth: 0,
      flexWrap: "wrap",
    }),
    [],
  );
  const getRailHeaderZoneStyle = useCallback(
    (zoneId: ExplorerChromeZoneId): React.CSSProperties => {
      switch (zoneId) {
        case "center":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            flexWrap: "wrap",
          };
        case "end":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            minWidth: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          };
        case "start":
        default:
          return {
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            minWidth: 0,
            flex: 1,
          };
      }
    },
    [],
  );
  const railChromeControlRegistry = useMemo<
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
        id: "railIdentity",
        label: "Rail Identity",
        surfaces: ["railHeader"],
        isVisible: () => true,
        render: () => (
          <div style={{ minWidth: 0, flex: 1 }}>
            {showBrandLabel && (
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--overlay-text-dim)",
                  fontWeight: 700,
                }}
              >
                {normalizedBrandLabel}
              </div>
            )}
            <div
              style={{
                marginTop: 2,
                fontSize: "var(--overlay-explorer-rail-title-size)",
                color: "var(--overlay-text-primary)",
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {locationLabel}
            </div>
            {showSupportingMeta && (
              <div
                title={locationTitle}
                style={{
                  marginTop: 3,
                  fontSize: 9.5,
                  color: "var(--overlay-text-dim)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {locationTitle}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "railBookmarkSummary",
        label: "Rail Bookmark Summary",
        surfaces: ["railHeader"],
        isVisible: () => true,
        render: () => (
          <>
            <span style={railMetaPillStyle}>{bookmarkCount} pinned</span>
            {showVerboseDragGuide && (
              <span style={railMetaPillStyle}>
                Plain drag stays inside the explorer. Hold Alt to drag files
                out.
              </span>
            )}
          </>
        ),
      },
      {
        id: "railClose",
        label: "Rail Close",
        surfaces: ["railHeader"],
        isVisible: () => typeof onCloseSources === "function",
        render: () => (
          <button
            type="button"
            onClick={() => onCloseSources?.()}
            title="Close the sources panel"
            style={manageToggleButtonStyle(accent, false)}
          >
            Close
          </button>
        ),
      },
      {
        id: "railManageToggle",
        label: "Rail Manage Toggle",
        surfaces: ["railHeader"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            aria-pressed={isManageMode}
            onClick={toggleRailManageMode}
            style={manageToggleButtonStyle(accent, isManageMode)}
          >
            {isManageMode ? "Done" : "Manage"}
          </button>
        ),
      },
    ],
    [
      accent,
      bookmarkCount,
      brandLabel,
      isManageMode,
      locationLabel,
      locationTitle,
      onCloseSources,
      normalizedBrandLabel,
      showBrandLabel,
      showSupportingMeta,
      showVerboseDragGuide,
      toggleRailManageMode,
    ],
  );
  const railChromeControlRegistryById = useMemo(
    () => new Map(railChromeControlRegistry.map((entry) => [entry.id, entry])),
    [railChromeControlRegistry],
  );
  const activateRailChromeCommand = useCallback(
    (controlId: ExplorerChromeControlId): boolean => {
      switch (controlId) {
        case "railIdentity":
          onGoHome();
          return true;
        case "railBookmarkSummary":
          updateRail(toggleExplorerRailSection(rail, "bookmarks"));
          return true;
        case "railClose":
          if (typeof onCloseSources !== "function") {
            return false;
          }
          onCloseSources();
          return true;
        case "railManageToggle":
          toggleRailManageMode();
          return true;
        default:
          return false;
      }
    },
    [onCloseSources, onGoHome, rail, toggleRailManageMode, updateRail],
  );
  const railCommandControlIdByCommandId = useMemo(
    () =>
      new Map(
        railChromeControlRegistry.map(
          (entry) => [getExplorerChromeCommandId(entry.id), entry.id] as const,
        ),
      ),
    [railChromeControlRegistry],
  );
  const triggerRailChromeCommandBinding = useCallback(
    (commandId: string): boolean => {
      const controlId = railCommandControlIdByCommandId.get(commandId);
      return controlId ? activateRailChromeCommand(controlId) : false;
    },
    [activateRailChromeCommand, railCommandControlIdByCommandId],
  );
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const railOwnsKeyboard =
        activeElement instanceof Node &&
        railRootRef.current?.contains(activeElement) === true;
      if (!railOwnsKeyboard) {
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
        if (triggerRailChromeCommandBinding(commandId)) {
          event.preventDefault();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [commandBindingsById, triggerRailChromeCommandBinding]);
  const railHeaderSurface = useMemo(
    () =>
      resolveExplorerChromeSurfaceLayout({
        layoutId: chromeLayoutId,
        surfaceId: "railHeader",
        controlDefinitions: railChromeControlRegistry,
        override: chromeOverride,
        isControlVisible: (controlId, surfaceId) =>
          railChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ??
          false,
      }),
    [
      chromeLayoutId,
      chromeOverride,
      railChromeControlRegistry,
      railChromeControlRegistryById,
    ],
  );
  const renderRailChromeControl = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) =>
      railChromeControlRegistryById
        .get(placement.controlId)
        ?.render(placement) ?? null,
    [railChromeControlRegistryById],
  );

  return (
    <div
      ref={railRootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "var(--overlay-bg-sidebar)",
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => handleBookmarkDrop(event, null)}
    >
      <div
        style={{
          padding: dense ? "8px 8px 6px" : "12px 12px 10px",
          borderBottom: "1px solid var(--overlay-border)",
        }}
      >
        <ExplorerChromeSurface
          surface={railHeaderSurface}
          getRowStyle={() => railHeaderRowStyle}
          getZoneStyle={getRailHeaderZoneStyle}
          renderControl={renderRailChromeControl}
          layoutDynamics={railHeaderLayoutDynamics}
          editMode={chromeEditMode}
        />
        <div
          role="group"
          aria-label="Side rail view mode"
          style={railViewModeGroupStyle}
        >
          {explorerRailViewModes.map((mode) => {
            const active = rail.viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                aria-label={`${mode.label} side rail view`}
                title={mode.description}
                onClick={() =>
                  updateRail((current) =>
                    setExplorerRailViewMode(current, mode.id),
                  )
                }
                style={railViewModeButtonStyle(accent, active)}
              >
                {dense ? mode.shortLabel : mode.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={autoExpandToOpenFolder}
            aria-label="Toggle expand to open folder"
            title={
              autoExpandToOpenFolder
                ? "Expand to Open Folder is on. The rail follows the open path automatically."
                : "Expand to Open Folder is off. Only the chevrons expand the rail tree."
            }
            onClick={() =>
              updateRail((current) =>
                setExplorerRailAutoExpandToOpenFolder(
                  current,
                  !current.autoExpandToOpenFolder,
                ),
              )
            }
            style={railViewModeButtonStyle(accent, autoExpandToOpenFolder)}
          >
            Auto
          </button>
        </div>
        {persistence.message && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              borderRadius: 9,
              border: `1px solid ${persistence.status === "save-error" ? "rgba(248,113,113,0.45)" : `${accent}44`}`,
              background:
                persistence.status === "save-error"
                  ? "rgba(248,113,113,0.12)"
                  : `${accent}14`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  lineHeight: 1.35,
                  color: "var(--overlay-text-primary)",
                }}
              >
                {persistence.message}
              </p>
              <button
                type="button"
                aria-label="Dismiss explorer state notice"
                onClick={clearPersistenceNotice}
                style={dismissButtonStyle}
              >
                <X size={11} />
              </button>
            </div>
            {persistence.hasBackup && (
              <button
                type="button"
                onClick={restoreRailBackup}
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "transparent",
                  border: `1px solid ${accent}55`,
                  borderRadius: 999,
                  color: accent,
                  fontSize: 10,
                  padding: "4px 9px",
                  cursor: "pointer",
                }}
              >
                <Undo2 size={11} />
                Restore backup
              </button>
            )}
          </div>
        )}
      </div>

      <OverlayScrollArea
        style={{ flex: 1, minHeight: 0 }}
        viewportStyle={{ padding: dense ? 6 : 10 }}
      >
        <RailSection
          title="Quick Access"
          viewMode={railViewMode}
          collapsed={isExplorerRailSectionCollapsed(rail, "quick-access")}
          onToggle={() =>
            updateRail(toggleExplorerRailSection(rail, "quick-access"))
          }
        >
          {(() => {
            const homeMotion = bindRailMotion(currentPathIsHome, 0);
            return (
              <button
                type="button"
                onClick={onGoHome}
                {...homeMotion.motionDataAttributes}
                onPointerEnter={homeMotion.onPointerEnter}
                onPointerLeave={homeMotion.onPointerLeave}
                onPointerDown={homeMotion.onPointerDown}
                onPointerUp={homeMotion.onPointerUp}
                onPointerCancel={homeMotion.onPointerCancel}
                style={{
                  ...quickLinkButtonStyle(
                    currentPathIsHome,
                    accent,
                    dense,
                    railViewMode,
                  ),
                  ...homeMotion.motionStyle,
                }}
              >
                <Home
                  size={dense ? 12 : 13}
                  style={{ color: accent, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={bookmarkTitleStyle(railViewMode, "default")}>
                    Home
                  </div>
                  {showSupportingMeta && (
                    <div style={bookmarkMetaStyle(railViewMode)}>
                      Open the explorer home surface.
                    </div>
                  )}
                </div>
              </button>
            );
          })()}
        </RailSection>

        <RailSection
          title="Drives"
          viewMode={railViewMode}
          collapsed={isExplorerRailSectionCollapsed(rail, "drives")}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, "drives"))}
        >
          {drivesLoading && (
            <div style={{ display: "grid", gap: 4 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    height: dense ? 26 : 38,
                    borderRadius: 9,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--overlay-border)",
                  }}
                />
              ))}
            </div>
          )}

          {!drivesLoading &&
            drives.map((drive, index) => {
              const isCloudDrive = drive.kind === "cloud";
              const drivePath = drive.path;
              const isActive = isCloudDrive
                ? currentPath === drivePath ||
                  currentPath.startsWith(`${drivePath}/`)
                : activeLocalDrivePath !== null &&
                  isSameLocalPath(drive.path, activeLocalDrivePath);

              if (isCloudDrive) {
                const cloudDriveMotion = bindRailMotion(isActive, index);
                return (
                  <button
                    key={drive.id}
                    type="button"
                    onClick={() => onNavigate(drive.path)}
                    {...cloudDriveMotion.motionDataAttributes}
                    onPointerEnter={cloudDriveMotion.onPointerEnter}
                    onPointerLeave={cloudDriveMotion.onPointerLeave}
                    onPointerDown={cloudDriveMotion.onPointerDown}
                    onPointerUp={cloudDriveMotion.onPointerUp}
                    onPointerCancel={cloudDriveMotion.onPointerCancel}
                    style={{
                      ...getRailSelectableRowStyle({
                        accent,
                        viewMode: railViewMode,
                        dense,
                        state: isActive ? "active" : "idle",
                      }),
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      alignItems: "center",
                      cursor: "pointer",
                      marginBottom: 4,
                      ...cloudDriveMotion.motionStyle,
                    }}
                  >
                    <FolderTree
                      size={dense ? 11 : 14}
                      style={{
                        color: resolveRailIconColor(
                          railViewMode,
                          accent,
                          isActive ? "active" : "default",
                        ),
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            ...bookmarkTitleStyle(
                              railViewMode,
                              isActive ? "active" : "default",
                            ),
                            fontSize: dense ? 9.5 : 11,
                          }}
                        >
                          {drive.label}
                        </span>
                        <span
                          style={{
                            ...bookmarkMetaStyle(railViewMode),
                            marginTop: 0,
                            textTransform: "uppercase",
                          }}
                        >
                          {drive.provider === "google-drive"
                            ? "Drive"
                            : "Dropbox"}
                        </span>
                      </div>
                      {showSupportingMeta && (
                        <div
                          style={{
                            ...bookmarkMetaStyle(railViewMode),
                            marginTop: 4,
                          }}
                        >
                          {drive.email}
                        </div>
                      )}
                    </div>
                  </button>
                );
              }

              const totalBytes = getLocalDriveTotalBytes(drive);
              const freeBytes = getLocalDriveFreeBytes(drive);
              const usedBytes = Math.max(totalBytes - freeBytes, 0);
              const usedRatio =
                totalBytes > 0 ? usedBytes / totalBytes : 0;
              const normalizedDrivePath = normalizeLocalTreePath(drive.path);
              const isExpanded =
                effectiveExpandedFolderPaths.includes(normalizedDrivePath);
              const driveRowMotion = bindRailMotion(
                isActive || isExpanded,
                index,
              );
              return (
                <div key={drive.id} style={{ marginBottom: 4 }}>
                  <div
                    {...driveRowMotion.motionDataAttributes}
                    onPointerEnter={driveRowMotion.onPointerEnter}
                    onPointerLeave={driveRowMotion.onPointerLeave}
                    onPointerDown={driveRowMotion.onPointerDown}
                    onPointerUp={driveRowMotion.onPointerUp}
                    onPointerCancel={driveRowMotion.onPointerCancel}
                    style={{
                      ...getRailSelectableRowStyle({
                        accent,
                        viewMode: railViewMode,
                        dense,
                        state: isActive ? "active" : "idle",
                        flattened: railViewMode.flattenDriveRows,
                      }),
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "auto auto 1fr",
                      alignItems: "center",
                      ...driveRowMotion.motionStyle,
                    }}
                  >
                    <button
                      type="button"
                      aria-label={
                        isExpanded
                          ? `Collapse ${drive.label} folder tree`
                          : `Expand ${drive.label} folder tree`
                      }
                      onClick={() => toggleFolderExpand(normalizedDrivePath)}
                      style={treeIconButtonStyle(
                        railViewMode,
                        isExpanded || isActive,
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown size={11} />
                      ) : (
                        <ChevronRight size={11} />
                      )}
                    </button>
                    <HardDrive
                      size={dense ? 11 : 14}
                      style={{
                        color: resolveRailIconColor(
                          railViewMode,
                          accent,
                          isActive ? "active" : "default",
                        ),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onNavigate(drive.path)}
                      style={{
                        minWidth: 0,
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            ...bookmarkTitleStyle(
                              railViewMode,
                              isActive
                                ? "active"
                                : isExpanded
                                  ? "ancestor"
                                  : "default",
                            ),
                            fontSize: dense ? 9.5 : 11,
                          }}
                        >
                          {drive.label}
                        </span>
                        <span
                          style={{
                            ...bookmarkMetaStyle(railViewMode),
                            marginTop: 0,
                          }}
                        >
                          {getDriveCompactLabel(drive)}
                        </span>
                      </div>
                      {showDriveCapacity && totalBytes > 0 && (
                        <>
                          <div
                            style={{
                              height: 3,
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              overflow: "hidden",
                              marginTop: 4,
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(0, Math.min(usedRatio * 100, 100))}%`,
                                height: "100%",
                                background:
                                  usedRatio > 0.9
                                    ? "var(--overlay-danger)"
                                    : accent,
                              }}
                            />
                          </div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 8.5,
                              color: "var(--overlay-text-dim)",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <span>{formatBytes(usedBytes)} used</span>
                            <span>{formatBytes(totalBytes)} total</span>
                          </div>
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      role="tree"
                      aria-label={`${drive.label} folder tree`}
                      style={{ marginTop: 4 }}
                    >
                      <LocalFolderTreeRow
                        accent={accent}
                        bindRailMotion={bindRailMotion}
                        compactTree={compactTree}
                        dense={dense}
                        viewMode={railViewMode}
                        currentPath={currentPath}
                        dropScopeId={dropScopeId}
                        path={normalizedDrivePath}
                        depth={0}
                        expandedFolderPaths={effectiveExpandedFolderPaths}
                        folderChildrenByPath={folderChildrenByPath}
                        showSupportingMeta={showSupportingMeta}
                        treeIndentStep={railViewMode.treeIndentStep}
                        activeFileDropTargetPath={activeFileDropTargetPath}
                        activeFileDropSurfaceId={activeFileDropSurfaceId}
                        activeFileDwellSurfaceId={
                          activeFileDropState.dwellSurfaceId
                        }
                        activeFileDwellProgress={
                          activeFileDropState.dwellProgress
                        }
                        onNavigate={onNavigate}
                        onToggleExpand={toggleFolderExpand}
                        onRetryLoad={loadFolderChildren}
                      />
                    </div>
                  )}
                </div>
              );
            })}
        </RailSection>

        <RailSection
          title="Saved Searches"
          viewMode={railViewMode}
          collapsed={isExplorerRailSectionCollapsed(rail, "saved-searches")}
          onToggle={() =>
            updateRail(toggleExplorerRailSection(rail, "saved-searches"))
          }
        >
          {savedSearches.length === 0 && (
            <div
              style={{
                fontSize: 10,
                color: "var(--overlay-text-dim)",
                padding: "4px 2px 2px",
              }}
            >
              Save a search from the explorer toolbar to pin it here.
            </div>
          )}
          {savedSearches.map((savedSearch, index) => (
            <div
              key={savedSearch.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              {(() => {
                const savedSearchMotion = bindRailMotion(false, index);
                return (
                  <button
                    type="button"
                    onClick={() => onOpenSavedSearch?.(savedSearch)}
                    {...savedSearchMotion.motionDataAttributes}
                    onPointerEnter={savedSearchMotion.onPointerEnter}
                    onPointerLeave={savedSearchMotion.onPointerLeave}
                    onPointerDown={savedSearchMotion.onPointerDown}
                    onPointerUp={savedSearchMotion.onPointerUp}
                    onPointerCancel={savedSearchMotion.onPointerCancel}
                    style={{
                      ...getRailSelectableRowStyle({
                        accent,
                        viewMode: railViewMode,
                        dense,
                        state: "idle",
                      }),
                      flex: 1,
                      minWidth: 0,
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      alignItems: "center",
                      cursor: "pointer",
                      textAlign: "left",
                      ...savedSearchMotion.motionStyle,
                    }}
                  >
                    <Search
                      size={dense ? 11 : 13}
                      style={{ color: accent, flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          ...bookmarkTitleStyle(railViewMode, "default"),
                          fontSize: dense ? 9.5 : 10.5,
                        }}
                      >
                        {savedSearch.name}
                      </div>
                      {showSupportingMeta && (
                        <div
                          style={{
                            ...bookmarkMetaStyle(railViewMode),
                            marginTop: 3,
                          }}
                        >
                          {savedSearch.query}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })()}
              {onDeleteSavedSearch && (
                <button
                  type="button"
                  onClick={() => onDeleteSavedSearch(savedSearch.id)}
                  style={dismissButtonStyle}
                  aria-label={`Delete saved search ${savedSearch.name}`}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </RailSection>

        <RailSection
          title="Tags"
          viewMode={railViewMode}
          collapsed={isExplorerRailSectionCollapsed(rail, "tags")}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, "tags"))}
        >
          {availableTags.length === 0 && (
            <div
              style={{
                fontSize: 10,
                color: "var(--overlay-text-dim)",
                padding: "4px 2px 2px",
              }}
            >
              Tag files from the explorer toolbar or context menu to filter them
              here.
            </div>
          )}
          {(activeTagFilterIds.length > 0 || availableTags.length > 0) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  color: "var(--overlay-text-dim)",
                  fontWeight: 600,
                }}
              >
                {activeTagFilterIds.length > 0
                  ? `${activeTagFilterIds.length} tag filter${activeTagFilterIds.length === 1 ? "" : "s"} active`
                  : "Tag filters"}
              </div>
              {activeTagFilterIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearTagFilters?.()}
                  style={{
                    border: "1px solid var(--overlay-border)",
                    borderRadius: 999,
                    padding: "3px 8px",
                    background: "transparent",
                    color: "var(--overlay-text-muted)",
                    fontSize: 9,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {(activeTagFilterIds.length > 0 || availableTags.length > 0) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 5,
                marginBottom: availableTags.length > 0 ? 6 : 0,
              }}
            >
              {(() => {
                const allTagsMotion = bindRailMotion(
                  activeTagFilterIds.length === 0,
                  0,
                );
                return (
                  <button
                    type="button"
                    onClick={() => onClearTagFilters?.()}
                    {...allTagsMotion.motionDataAttributes}
                    onPointerEnter={allTagsMotion.onPointerEnter}
                    onPointerLeave={allTagsMotion.onPointerLeave}
                    onPointerDown={allTagsMotion.onPointerDown}
                    onPointerUp={allTagsMotion.onPointerUp}
                    onPointerCancel={allTagsMotion.onPointerCancel}
                    style={{
                      ...categoryChipStyle(activeTagFilterIds.length === 0),
                      ...allTagsMotion.motionStyle,
                    }}
                  >
                    All
                  </button>
                );
              })()}
              {availableTags.map((tag, index) => {
                const active = activeTagFilterIds.includes(tag.id);
                const tagMotion = bindRailMotion(active, index + 1);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTagFilter?.(tag.id)}
                    {...tagMotion.motionDataAttributes}
                    onPointerEnter={tagMotion.onPointerEnter}
                    onPointerLeave={tagMotion.onPointerLeave}
                    onPointerDown={tagMotion.onPointerDown}
                    onPointerUp={tagMotion.onPointerUp}
                    onPointerCancel={tagMotion.onPointerCancel}
                    style={{
                      ...categoryChipStyle(active),
                      borderColor: active ? accent : "var(--overlay-border)",
                      color: active ? accent : "var(--overlay-text-muted)",
                      ...tagMotion.motionStyle,
                    }}
                  >
                    <Tag size={10} />
                    <span>{tag.label}</span>
                    <span style={{ color: "var(--overlay-text-dim)" }}>
                      {tag.pathCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </RailSection>

        <RailSection
          title="Bookmarks"
          viewMode={railViewMode}
          collapsed={isExplorerRailSectionCollapsed(rail, "bookmarks")}
          onToggle={() =>
            updateRail(toggleExplorerRailSection(rail, "bookmarks"))
          }
          grow
        >
          <div
            style={{
              padding: dense ? "6px 7px" : "8px 10px",
              borderRadius: 9,
              border: "1px solid var(--overlay-border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Search
                size={11}
                style={{ color: "var(--overlay-text-dim)", flexShrink: 0 }}
              />
              <input
                aria-label="Search bookmarks"
                value={rail.searchQuery}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => {
                    updateRail(setExplorerBookmarkSearchQuery(rail, nextValue));
                  });
                }}
                placeholder="Search bookmarks"
                style={searchInputStyle}
              />
              {rail.searchQuery && (
                <button
                  type="button"
                  aria-label="Clear bookmark search"
                  onClick={() =>
                    updateRail(setExplorerBookmarkSearchQuery(rail, ""))
                  }
                  style={dismissButtonStyle}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {(isManageMode ||
              rail.activeCategoryIds.length > 0 ||
              draftCategoryName.length > 0) && (
              <div
                className={dense ? "overlay-scrollbars-none" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginTop: 6,
                  flexWrap: dense ? "nowrap" : "wrap",
                  overflowX: dense ? "auto" : "visible",
                  overflowY: "hidden",
                  paddingBottom: dense ? 2 : 0,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    updateRail(clearExplorerBookmarkCategoryFilters(rail))
                  }
                  style={categoryChipStyle(rail.activeCategoryIds.length === 0)}
                >
                  All
                </button>
                {categories.map((category) => {
                  const active = rail.activeCategoryIds.includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() =>
                        updateRail(
                          toggleExplorerBookmarkCategoryFilter(
                            rail,
                            category.id,
                          ),
                        )
                      }
                      style={{
                        ...categoryChipStyle(active),
                        borderColor: active
                          ? category.color
                          : "var(--overlay-border)",
                        color: active
                          ? category.color
                          : "var(--overlay-text-muted)",
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: category.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: dense ? 64 : 110,
                        }}
                      >
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {isManageMode && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  aria-label="Create bookmark folder"
                  onClick={() => {
                    setDraftFolderParentId(null);
                    setDraftFolderName("New Folder");
                  }}
                  style={draftPrimaryButtonStyle(accent)}
                >
                  New Group
                </button>
                <button
                  type="button"
                  aria-label="Create custom category"
                  onClick={() =>
                    setDraftCategoryName((current) => current || "New Category")
                  }
                  style={draftSecondaryButtonStyle}
                >
                  New Tag
                </button>
              </div>
            )}
          </div>

          {draftFolderParentId !== false && (
            <div style={draftPanelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FolderTree
                  size={12}
                  style={{ color: accent, flexShrink: 0 }}
                />
                <input
                  autoFocus
                  aria-label="New bookmark folder name"
                  value={draftFolderName}
                  onChange={(event) => setDraftFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitDraftFolder();
                    if (event.key === "Escape") setDraftFolderParentId(false);
                  }}
                  style={searchInputStyle}
                />
              </div>
              <div style={draftActionRowStyle}>
                <button
                  type="button"
                  onClick={commitDraftFolder}
                  style={draftPrimaryButtonStyle(accent)}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setDraftFolderParentId(false)}
                  style={draftSecondaryButtonStyle}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {draftCategoryName && (
            <div style={draftPanelStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag size={13} style={{ color: accent, flexShrink: 0 }} />
                <input
                  autoFocus
                  aria-label="New custom category name"
                  value={draftCategoryName}
                  onChange={(event) => setDraftCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitDraftCategory();
                    if (event.key === "Escape") setDraftCategoryName("");
                  }}
                  style={searchInputStyle}
                />
              </div>
              <div style={draftActionRowStyle}>
                <button
                  type="button"
                  onClick={commitDraftCategory}
                  style={draftPrimaryButtonStyle(accent)}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setDraftCategoryName("")}
                  style={draftSecondaryButtonStyle}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {importPlan && (
            <div style={draftPanelStyle}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "var(--overlay-text-primary)",
                }}
              >
                Add {importPlan.sources.length} item
                {importPlan.sources.length === 1 ? "" : "s"} to bookmarks
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 9.5,
                  lineHeight: 1.35,
                  color: "var(--overlay-text-muted)",
                }}
              >
                {importPlan.note}
              </div>
              <div style={draftActionRowStyle}>
                <button
                  type="button"
                  onClick={() => applyPlan("bookmark")}
                  style={draftPrimaryButtonStyle(accent)}
                >
                  Pin directly
                </button>
                <button
                  type="button"
                  onClick={() => applyPlan("folder")}
                  style={draftSecondaryButtonStyle}
                >
                  Create group
                </button>
                <button
                  type="button"
                  onClick={() => setImportPlan(null)}
                  style={draftSecondaryButtonStyle}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div
            role="tree"
            aria-label="Bookmarks tree"
            onDragOver={(event) => {
              event.preventDefault();
              setDropTargetFolderId(null);
            }}
            onDragLeave={() => setDropTargetFolderId(null)}
            onDrop={(event) => handleBookmarkDrop(event, null)}
            style={{
              flex: 1,
              minHeight: 120,
              marginTop: 8,
              padding: 3,
              borderRadius: 10,
              border: `1px dashed ${dropTargetFolderId === null ? `${accent}55` : "transparent"}`,
              background:
                dropTargetFolderId === null
                  ? `${accent}10`
                  : "var(--overlay-explorer-chip-bg)",
            }}
          >
            {bookmarkTree.length === 0 && (
              <div
                style={{
                  padding: dense ? "10px 8px" : "14px 10px",
                  color: "var(--overlay-text-dim)",
                  fontSize: 9.5,
                  lineHeight: 1.4,
                }}
              >
                Drag folders here to pin them. Open Manage when you want to
                organize groups, tags, or colors.
              </div>
            )}

            {bookmarkTree.map((row) => (
              <BookmarkTreeRow
                key={row.node.id}
                accent={accent}
                bindRailMotion={bindRailMotion}
                compactTree={compactTree}
                dense={dense}
                viewMode={railViewMode}
                showSupportingMeta={showSupportingMeta}
                treeIndentStep={railViewMode.treeIndentStep}
                manageMode={isManageMode}
                currentPath={currentPath}
                dropScopeId={dropScopeId}
                row={row}
                dropTargetFolderId={dropTargetFolderId}
                activeFileDropTargetPath={activeFileDropTargetPath}
                activeFileDropSurfaceId={activeFileDropSurfaceId}
                activeFileDwellSurfaceId={activeFileDropState.dwellSurfaceId}
                activeFileDwellProgress={activeFileDropState.dwellProgress}
                onNavigate={onNavigate}
                onQueueFolderCreate={(parentId) => {
                  setDraftFolderParentId(parentId);
                  setDraftFolderName("New Folder");
                }}
                onRenameNode={(nodeId, nodeName) => {
                  setEditingNodeId(nodeId);
                  setEditingNodeName(nodeName);
                  setIsManageMode(true);
                }}
                onDragOverFolder={(event, folderId) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTargetFolderId(folderId);
                }}
                onDragLeaveFolder={() => setDropTargetFolderId(null)}
                onDropIntoFolder={handleBookmarkDrop}
              />
            ))}
          </div>
        </RailSection>
      </OverlayScrollArea>

      {editingNodeId && (
        <div
          style={{
            padding: dense ? "8px 10px" : "10px 12px",
            borderTop: "1px solid var(--overlay-border)",
            background: "var(--overlay-explorer-chip-bg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              autoFocus
              aria-label="Rename bookmark"
              value={editingNodeName}
              onChange={(event) => setEditingNodeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitNodeRename();
                if (event.key === "Escape") {
                  setEditingNodeId(null);
                  setEditingNodeName("");
                }
              }}
              style={searchInputStyle}
            />
            <button
              type="button"
              onClick={commitNodeRename}
              style={draftPrimaryButtonStyle(accent)}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookmarkTreeRow({
  accent,
  bindRailMotion,
  compactTree,
  dense,
  viewMode,
  showSupportingMeta,
  treeIndentStep,
  manageMode,
  currentPath,
  dropScopeId,
  row,
  dropTargetFolderId,
  activeFileDropTargetPath,
  activeFileDropSurfaceId,
  activeFileDwellSurfaceId,
  activeFileDwellProgress,
  onNavigate,
  onQueueFolderCreate,
  onRenameNode,
  onDropIntoFolder,
  onDragOverFolder,
  onDragLeaveFolder,
}: TreeRowProps) {
  const rail = useExplorerStore((state) => state.rail);
  const updateRail = useExplorerStore((state) => state.updateRail);
  const isFolder = row.node.kind === "folder";
  const isExpanded = isFolder
    ? isExplorerBookmarkFolderExpanded(rail, row.node.id)
    : false;
  const bookmarkPath = row.node.kind === "bookmark" ? row.node.path : null;
  const bookmarkSurfaceId =
    bookmarkPath !== null ? `explorer-rail-bookmark:${row.node.id}` : null;
  const bookmarkFileDropBinding = bookmarkPath
    ? createExplorerDropSurfaceBinding({
        surfaceId: bookmarkSurfaceId!,
        scopeId: dropScopeId,
        role: "navigation-target",
        targetPath: bookmarkPath,
        onAutoOpen: () => onNavigate(bookmarkPath),
        label: row.node.name,
      })
    : null;
  const isDropTarget =
    dropTargetFolderId === row.node.id ||
    (bookmarkPath !== null && activeFileDropTargetPath === bookmarkPath);
  const isFileDropTarget =
    bookmarkSurfaceId !== null && activeFileDropSurfaceId === bookmarkSurfaceId;
  const isDwellTarget =
    bookmarkSurfaceId !== null &&
    activeFileDwellSurfaceId === bookmarkSurfaceId;
  const isActive =
    bookmarkPath !== null && isSameLocalPath(currentPath, bookmarkPath);
  const rowState: RailSelectableRowState =
    isDropTarget || isFileDropTarget
      ? "drop-target"
      : isActive
        ? "active"
        : isFolder && isExpanded
          ? "ancestor"
          : "idle";
  const rowMotion = bindRailMotion(rowState !== "idle");

  return (
    <div style={{ marginTop: 4 }}>
      <div
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isActive}
        data-rail-row-state={rowState}
        {...rowMotion.motionDataAttributes}
        onPointerEnter={rowMotion.onPointerEnter}
        onPointerLeave={rowMotion.onPointerLeave}
        onPointerDown={rowMotion.onPointerDown}
        onPointerUp={rowMotion.onPointerUp}
        onPointerCancel={rowMotion.onPointerCancel}
        style={{
          ...getRailSelectableRowStyle({
            accent,
            viewMode,
            dense,
            state: rowState,
            treeDepth: row.depth,
          }),
          position: "relative",
          display: "flex",
          alignItems: "center",
          paddingLeft: (compactTree ? 6 : 8) + row.depth * treeIndentStep,
          ...rowMotion.motionStyle,
          transform: isFileDropTarget
            ? "translateY(-1px) scale(1.015)"
            : rowMotion.motionStyle.transform,
          boxShadow: isFileDropTarget
            ? `0 0 0 1px ${accent}2a, 0 12px 26px ${accent}24`
            : rowMotion.motionStyle.boxShadow,
        }}
        {...getExplorerDropBindingElementProps(bookmarkFileDropBinding)}
        onDragOver={
          isFolder ? (event) => onDragOverFolder(event, row.node.id) : undefined
        }
        onDragLeave={isFolder ? onDragLeaveFolder : undefined}
        onDrop={
          isFolder ? (event) => onDropIntoFolder(event, row.node.id) : undefined
        }
      >
        {isDwellTarget ? (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 5,
              height: 3,
              borderRadius: 999,
              overflow: "hidden",
              background: "rgba(255,255,255,0.08)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${Math.max(0, Math.min(100, activeFileDwellProgress * 100))}%`,
                height: "100%",
                borderRadius: 999,
                background:
                  "color-mix(in srgb, var(--overlay-accent) 90%, white 10%)",
                transition: "width 60ms linear",
              }}
            />
          </span>
        ) : null}
        {isFolder ? (
          <button
            type="button"
            aria-label={
              isExpanded ? "Collapse bookmark folder" : "Expand bookmark folder"
            }
            onClick={() =>
              updateRail(toggleExplorerBookmarkFolder(rail, row.node.id))
            }
            style={treeIconButtonStyle(viewMode, isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )}
          </button>
        ) : (
          <span
            style={{
              width: compactTree ? 14 : 16,
              display: "flex",
              justifyContent: "center",
              color: resolveRailIconColor(
                viewMode,
                accent,
                isActive ? "active" : "default",
              ),
            }}
          >
            <Star size={10} />
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            if (row.node.kind === "bookmark") {
              onNavigate(row.node.path);
            } else {
              updateRail(toggleExplorerBookmarkFolder(rail, row.node.id));
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: viewMode.presentation.rowChrome === "compact" ? 6 : 8,
            background: "transparent",
            border: "none",
            color: "var(--overlay-text-primary)",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: viewMode.presentation.rowChrome === "tree" ? 3 : 8,
              height: viewMode.presentation.rowChrome === "tree" ? 18 : 8,
              borderRadius: 999,
              background: row.node.color ?? accent,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={bookmarkTitleStyle(
                viewMode,
                isActive ? "active" : isExpanded ? "ancestor" : "default",
              )}
            >
              {row.node.name}
            </div>
            {showSupportingMeta && row.node.kind === "bookmark" && (
              <div style={bookmarkMetaStyle(viewMode)}>{row.node.path}</div>
            )}
          </div>
        </button>

        {manageMode && isFolder && (
          <button
            type="button"
            aria-label="Create nested bookmark folder"
            onClick={() => onQueueFolderCreate(row.node.id)}
            style={treeIconButtonStyle(viewMode, false)}
          >
            <FolderPlus size={11} />
          </button>
        )}
        {manageMode && (
          <button
            type="button"
            aria-label="Rename bookmark node"
            onClick={() => onRenameNode(row.node.id, row.node.name)}
            style={treeIconButtonStyle(viewMode, false)}
          >
            <Pencil size={11} />
          </button>
        )}
        {manageMode && (
          <button
            type="button"
            aria-label="Cycle bookmark color"
            onClick={() =>
              updateRail(cycleExplorerBookmarkNodeColor(rail, row.node.id))
            }
            style={treeIconButtonStyle(viewMode, false)}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 999,
                background: row.node.color ?? accent,
              }}
            />
          </button>
        )}
        {manageMode && (
          <button
            type="button"
            aria-label="Remove bookmark node"
            onClick={() =>
              updateRail(removeExplorerBookmarkNode(rail, row.node.id))
            }
            style={treeIconButtonStyle(viewMode, false)}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {isFolder &&
        isExpanded &&
        row.children.map((child) => (
          <BookmarkTreeRow
            key={child.node.id}
            accent={accent}
            bindRailMotion={bindRailMotion}
            compactTree={compactTree}
            dense={dense}
            viewMode={viewMode}
            showSupportingMeta={showSupportingMeta}
            treeIndentStep={treeIndentStep}
            manageMode={manageMode}
            currentPath={currentPath}
            dropScopeId={dropScopeId}
            row={child}
            dropTargetFolderId={dropTargetFolderId}
            activeFileDropTargetPath={activeFileDropTargetPath}
            activeFileDropSurfaceId={activeFileDropSurfaceId}
            activeFileDwellSurfaceId={activeFileDwellSurfaceId}
            activeFileDwellProgress={activeFileDwellProgress}
            onNavigate={onNavigate}
            onQueueFolderCreate={onQueueFolderCreate}
            onRenameNode={onRenameNode}
            onDragOverFolder={onDragOverFolder}
            onDragLeaveFolder={onDragLeaveFolder}
            onDropIntoFolder={onDropIntoFolder}
          />
        ))}
    </div>
  );
}

function LocalFolderTreeRow({
  accent,
  bindRailMotion,
  compactTree,
  dense,
  viewMode,
  currentPath,
  dropScopeId,
  path,
  depth,
  expandedFolderPaths,
  folderChildrenByPath,
  showSupportingMeta,
  treeIndentStep,
  activeFileDropTargetPath,
  activeFileDropSurfaceId,
  activeFileDwellSurfaceId,
  activeFileDwellProgress,
  onNavigate,
  onToggleExpand,
  onRetryLoad,
}: LocalFolderTreeRowProps) {
  const normalizedPath = normalizeLocalTreePath(path);
  const loadState = folderChildrenByPath[normalizedPath];
  const childFolders = loadState?.childFolders ?? [];
  const feedbackIndent =
    depth === 0 ? 0 : (compactTree ? 10 : 12) + depth * treeIndentStep;
  const virtualScrollerRef = useRef<HTMLDivElement | null>(null);
  const canVirtualizeLocalTreeChildren =
    childFolders.length > 120 &&
    childFolders.every(
      (childFolder) =>
        !expandedFolderPaths.includes(normalizeLocalTreePath(childFolder.path)),
    );
  const localTreeVirtualizer = useVirtualizer({
    count: childFolders.length,
    estimateSize: () => (dense ? 32 : 38),
    getScrollElement: () => virtualScrollerRef.current,
    overscan: 10,
  });

  if (loadState?.status === "loading" || !loadState) {
    return (
      <div
        style={{
          marginTop: 4,
          marginLeft: feedbackIndent,
          fontSize: 9,
          color: "var(--overlay-text-dim)",
        }}
      >
        Loading folders…
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div style={{ marginTop: 4, marginLeft: feedbackIndent }}>
        <div style={localTreeFeedbackStyle}>
          <span>{loadState.errorMessage || "Unable to load folders."}</span>
          <button
            type="button"
            onClick={() => onRetryLoad(normalizedPath)}
            style={localTreeRetryButtonStyle}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (childFolders.length === 0) {
    return (
      <div
        style={{
          marginTop: 4,
          marginLeft: feedbackIndent,
          fontSize: 9,
          color: "var(--overlay-text-dim)",
        }}
      >
        No subfolders
      </div>
    );
  }

  const virtualRows = canVirtualizeLocalTreeChildren
    ? localTreeVirtualizer.getVirtualItems()
    : null;
  const renderedChildFolders = virtualRows
    ? virtualRows
        .map((virtualRow) => ({
          childFolder: childFolders[virtualRow.index],
          virtualRow,
        }))
        .filter(
          (
            entry,
          ): entry is {
            childFolder: ExplorerFileEntry;
            virtualRow: NonNullable<typeof virtualRows>[number];
          } => Boolean(entry.childFolder),
        )
    : childFolders.map((childFolder) => ({ childFolder, virtualRow: null }));

  return (
    <div
      ref={canVirtualizeLocalTreeChildren ? virtualScrollerRef : undefined}
      data-overlay-explorer-local-tree-virtualized={
        canVirtualizeLocalTreeChildren ? "true" : undefined
      }
      style={
        canVirtualizeLocalTreeChildren
          ? {
              maxHeight: 420,
              overflow: "auto",
              position: "relative",
              contain: "layout paint",
            }
          : undefined
      }
    >
      <div
        style={
          canVirtualizeLocalTreeChildren
            ? {
                height: localTreeVirtualizer.getTotalSize(),
                position: "relative",
              }
            : undefined
        }
      >
      {renderedChildFolders.map(({ childFolder, virtualRow }) => {
        const childPath = normalizeLocalTreePath(childFolder.path);
        const localTreeSurfaceId = `explorer-rail-local-tree:${childPath}`;
        const childState = folderChildrenByPath[childPath];
        const isExpanded = expandedFolderPaths.includes(childPath);
        const normalizedCurrentPath = normalizeLocalTreePath(currentPath);
        const isSameAsCurrentPath =
          getLocalPathComparisonKey(childPath) ===
          getLocalPathComparisonKey(normalizedCurrentPath);
        const branchRelation = getLocalPathBranchRelation(
          childPath,
          normalizedCurrentPath,
        );
        const isStrictDescendant = branchRelation === "descendant";
        const isOpenPathLeaf =
          isExpanded &&
          branchRelation !== "none" &&
          childState?.status === "ready" &&
          (childState.childFolders?.length ?? 0) === 0;
        const isActive = isSameAsCurrentPath || isOpenPathLeaf;
        const isAncestor = !isActive && (isStrictDescendant || isExpanded);
        const localTreeDropBinding = createExplorerDropSurfaceBinding({
          surfaceId: localTreeSurfaceId,
          scopeId: dropScopeId,
          role: "navigation-target",
          targetPath: childPath,
          onAutoOpen: () => onNavigate(childPath),
          label: childFolder.name || getPathLeaf(childPath),
        });
        const isDropTarget = activeFileDropTargetPath === childPath;
        const isSurfaceDropTarget =
          activeFileDropSurfaceId === localTreeSurfaceId;
        const isDwellTarget = activeFileDwellSurfaceId === localTreeSurfaceId;
        const rowState: RailSelectableRowState =
          isDropTarget || isSurfaceDropTarget
            ? "drop-target"
            : isActive
              ? "active"
              : isAncestor || isExpanded
                ? "ancestor"
                : "idle";
        const canExpand =
          isExpanded ||
          childState?.status !== "ready" ||
          (childState.childFolders?.length ?? 0) > 0;
        const rowMotion = bindRailMotion(rowState !== "idle");

        return (
          <div
            key={childPath}
            style={{
              marginTop: virtualRow ? 0 : 4,
              ...(virtualRow
                ? {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }
                : null),
            }}
          >
            <div
              role="treeitem"
              aria-expanded={canExpand ? isExpanded : undefined}
              aria-selected={isActive}
              data-rail-row-state={rowState}
              {...getExplorerDropBindingElementProps(localTreeDropBinding)}
              {...rowMotion.motionDataAttributes}
              onPointerEnter={rowMotion.onPointerEnter}
              onPointerLeave={rowMotion.onPointerLeave}
              onPointerDown={rowMotion.onPointerDown}
              onPointerUp={rowMotion.onPointerUp}
              onPointerCancel={rowMotion.onPointerCancel}
              style={{
                ...getRailSelectableRowStyle({
                  accent,
                  viewMode,
                  dense,
                  state: rowState,
                  treeDepth: depth,
                }),
                position: "relative",
                display: "flex",
                alignItems: "center",
                paddingLeft: (compactTree ? 6 : 8) + depth * treeIndentStep,
                ...rowMotion.motionStyle,
                transform: isSurfaceDropTarget
                  ? "translateY(-1px) scale(1.015)"
                  : rowMotion.motionStyle.transform,
                boxShadow: isSurfaceDropTarget
                  ? `0 0 0 1px ${accent}2a, 0 12px 26px ${accent}24`
                  : rowMotion.motionStyle.boxShadow,
              }}
            >
              {isDwellTarget ? (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    bottom: 5,
                    height: 3,
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.08)",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${Math.max(0, Math.min(100, activeFileDwellProgress * 100))}%`,
                      height: "100%",
                      borderRadius: 999,
                      background:
                        "color-mix(in srgb, var(--overlay-accent) 90%, white 10%)",
                      transition: "width 60ms linear",
                    }}
                  />
                </span>
              ) : null}
              {canExpand ? (
                <button
                  type="button"
                  aria-label={
                    isExpanded
                      ? `Collapse ${childFolder.name}`
                      : `Expand ${childFolder.name}`
                  }
                  onClick={() => onToggleExpand(childPath)}
                  style={treeIconButtonStyle(viewMode, isExpanded || isActive)}
                >
                  {isExpanded ? (
                    <ChevronDown size={11} />
                  ) : (
                    <ChevronRight size={11} />
                  )}
                </button>
              ) : (
                <span style={{ width: compactTree ? 18 : 20, flexShrink: 0 }} />
              )}

              <button
                type="button"
                onClick={() => onNavigate(childPath)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: viewMode.presentation.rowChrome === "compact" ? 6 : 8,
                  background: "transparent",
                  border: "none",
                  color: "var(--overlay-text-primary)",
                  cursor: "pointer",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                {isExpanded ? (
                  <FolderOpen
                    size={dense ? 11 : 13}
                    style={{
                      color: resolveRailIconColor(
                        viewMode,
                        accent,
                        isActive
                          ? "active"
                          : isAncestor
                            ? "ancestor"
                            : "default",
                      ),
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Folder
                    size={dense ? 11 : 13}
                    style={{
                      color: resolveRailIconColor(
                        viewMode,
                        accent,
                        isActive
                          ? "active"
                          : isAncestor
                            ? "ancestor"
                            : "default",
                      ),
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={bookmarkTitleStyle(
                      viewMode,
                      isActive ? "active" : isAncestor ? "ancestor" : "default",
                    )}
                  >
                    {childFolder.name || getPathLeaf(childPath)}
                  </div>
                  {showSupportingMeta && (
                    <div style={bookmarkMetaStyle(viewMode)}>{childPath}</div>
                  )}
                </div>
              </button>
            </div>

            {isExpanded && (
              <LocalFolderTreeRow
                accent={accent}
                bindRailMotion={bindRailMotion}
                compactTree={compactTree}
                dense={dense}
                viewMode={viewMode}
                currentPath={currentPath}
                dropScopeId={dropScopeId}
                path={childPath}
                depth={depth + 1}
                expandedFolderPaths={expandedFolderPaths}
                folderChildrenByPath={folderChildrenByPath}
                showSupportingMeta={showSupportingMeta}
                treeIndentStep={treeIndentStep}
                activeFileDropTargetPath={activeFileDropTargetPath}
                activeFileDropSurfaceId={activeFileDropSurfaceId}
                activeFileDwellSurfaceId={activeFileDwellSurfaceId}
                activeFileDwellProgress={activeFileDwellProgress}
                onNavigate={onNavigate}
                onToggleExpand={onToggleExpand}
                onRetryLoad={onRetryLoad}
              />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function RailSection({
  title,
  viewMode,
  collapsed,
  grow = false,
  onToggle,
  children,
}: {
  title: string;
  viewMode: ExplorerRailViewModeDefinition;
  collapsed: boolean;
  grow?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={railSectionStyle(viewMode, grow)}>
      <button
        type="button"
        onClick={onToggle}
        style={railSectionHeaderButtonStyle(viewMode)}
      >
        <span>{title}</span>
        {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: collapsed ? "0fr" : "1fr",
          transition: "grid-template-rows 180ms ease, opacity 180ms ease",
          opacity: collapsed ? 0.55 : 1,
          minHeight: 0,
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getPathLeaf(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  if (!trimmed || isExplorerHomePath(trimmed)) {
    return "Home";
  }
  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}

function getLocalDriveTotalBytes(drive: ExplorerDriveInfo): number {
  if (drive.kind !== "local") {
    return 0;
  }
  const legacyTotalBytes = (drive as { total_bytes?: unknown }).total_bytes;
  if (typeof drive.totalBytes === "number") {
    return drive.totalBytes;
  }
  return typeof legacyTotalBytes === "number" ? legacyTotalBytes : 0;
}

function getLocalDriveFreeBytes(drive: ExplorerDriveInfo): number {
  if (drive.kind !== "local") {
    return 0;
  }
  const legacyFreeBytes = (drive as { free_bytes?: unknown }).free_bytes;
  if (typeof drive.freeBytes === "number") {
    return drive.freeBytes;
  }
  return typeof legacyFreeBytes === "number" ? legacyFreeBytes : 0;
}

function getDriveCompactLabel(drive: ExplorerDriveInfo): string {
  const legacyLetter = (drive as { letter?: unknown }).letter;
  if (typeof legacyLetter === "string" && legacyLetter.trim().length > 0) {
    return legacyLetter;
  }
  return getPathLeaf(drive.path) || drive.id;
}

function isWindowsLocalPath(path: string): boolean {
  return /^[A-Za-z]:/.test(path.trim());
}

function normalizeLocalTreePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\\`;
  }
  if (/^\/+$/.test(trimmed)) {
    return "/";
  }
  return isWindowsLocalPath(trimmed)
    ? trimmed.replace(/\//g, "\\").replace(/[\\]+$/, "")
    : trimmed.replace(/[\\/]+$/, "");
}

function getLocalPathComparisonKey(path: string): string {
  const normalized = normalizeLocalTreePath(path);
  return isWindowsLocalPath(normalized) ? normalized.toUpperCase() : normalized;
}

function getLocalPathBranchRelation(
  candidateAncestorPath: string,
  candidatePath: string,
): "same" | "descendant" | "none" {
  const ancestor = normalizeLocalTreePath(candidateAncestorPath);
  const target = normalizeLocalTreePath(candidatePath);
  if (!ancestor || !target) {
    return "none";
  }

  const ancestorKey = getLocalPathComparisonKey(ancestor);
  const targetKey = getLocalPathComparisonKey(target);
  if (ancestorKey === targetKey) {
    return "same";
  }
  if (ancestor === "/") {
    return target.startsWith("/") ? "descendant" : "none";
  }

  const separator = isWindowsLocalPath(ancestor) ? "\\" : "/";
  const pathBoundaryPrefix = ancestorKey.endsWith(separator)
    ? ancestorKey
    : `${ancestorKey}${separator}`;
  return targetKey.startsWith(pathBoundaryPrefix) ? "descendant" : "none";
}

function isSameLocalPath(leftPath: string, rightPath: string): boolean {
  return getLocalPathBranchRelation(leftPath, rightPath) === "same";
}

function isSameOrDescendantLocalPath(
  candidateAncestorPath: string,
  candidatePath: string,
): boolean {
  return (
    getLocalPathBranchRelation(candidateAncestorPath, candidatePath) !== "none"
  );
}

function resolveMostSpecificLocalDrivePath(
  candidatePath: string,
  availableDrivePaths: string[],
): string | null {
  const normalizedCandidatePath = normalizeLocalTreePath(candidatePath);
  if (!normalizedCandidatePath) {
    return null;
  }

  let bestMatch: string | null = null;
  for (const drivePath of availableDrivePaths) {
    if (
      !drivePath ||
      !isSameOrDescendantLocalPath(drivePath, normalizedCandidatePath)
    ) {
      continue;
    }
    if (!bestMatch || drivePath.length > bestMatch.length) {
      bestMatch = drivePath;
    }
  }

  return bestMatch;
}

function getLocalPathAncestors(path: string): string[] {
  const normalized = normalizeLocalTreePath(path);
  if (!normalized) {
    return [];
  }

  if (isWindowsLocalPath(normalized)) {
    const driveRoot = `${normalized.slice(0, 2)}\\`;
    if (normalized === driveRoot) {
      return [driveRoot];
    }
    const remainder = normalized.slice(2).replace(/^\\+/, "");
    const parts = remainder.split(/\\/).filter(Boolean);
    const ancestors: string[] = [driveRoot];
    let currentPath = driveRoot;
    for (const part of parts) {
      currentPath = currentPath.endsWith("\\")
        ? `${currentPath}${part}`
        : `${currentPath}\\${part}`;
      ancestors.push(currentPath);
    }
    return ancestors;
  }

  if (normalized === "/") {
    return ["/"];
  }

  const parts = normalized.replace(/^\/+/, "").split("/").filter(Boolean);
  const ancestors: string[] = ["/"];
  let currentPath = "";
  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
    ancestors.push(currentPath);
  }
  return ancestors;
}

function normalizeLocalTreePathList(paths: string[]): string[] {
  return mergeNormalizedLocalTreePathLists(paths);
}

function mergeNormalizedLocalTreePathLists(
  ...pathLists: string[][]
): string[] {
  const nextPaths: string[] = [];
  const seenKeys = new Set<string>();
  for (const pathList of pathLists) {
    for (const path of pathList) {
      const normalizedPath = normalizeLocalTreePath(path);
      if (!normalizedPath) {
        continue;
      }
      const comparisonKey = getLocalPathComparisonKey(normalizedPath);
      if (seenKeys.has(comparisonKey)) {
        continue;
      }
      seenKeys.add(comparisonKey);
      nextPaths.push(normalizedPath);
    }
  }
  return nextPaths;
}

function pruneLocalFolderTreeState(
  current: Record<string, LocalFolderTreeLoadState>,
  relevantPaths: string[],
): Record<string, LocalFolderTreeLoadState> {
  if (relevantPaths.length === 0) {
    return Object.keys(current).length === 0 ? current : {};
  }

  const allowedPaths = new Set(relevantPaths);
  let changed = false;
  const next: Record<string, LocalFolderTreeLoadState> = {};
  for (const [path, state] of Object.entries(current)) {
    if (allowedPaths.has(path)) {
      next[path] = state;
      continue;
    }
    changed = true;
  }
  return changed ? next : current;
}

type RailSelectableRowState = "idle" | "ancestor" | "active" | "drop-target";
type RailTextEmphasis = "default" | "ancestor" | "active";

const dismissButtonStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "var(--overlay-explorer-control-radius)",
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-text-dim)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

const localTreeFeedbackStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 8px",
  borderRadius: "var(--overlay-explorer-control-radius)",
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-text-dim)",
  fontSize: 9,
};

const localTreeRetryButtonStyle: React.CSSProperties = {
  borderRadius: "var(--overlay-explorer-control-radius)",
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "transparent",
  color: "var(--overlay-text-primary)",
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
  flexShrink: 0,
};

const railMetaPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minWidth: 0,
  maxWidth: "100%",
  borderRadius: 999,
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-text-dim)",
  fontSize: 9,
  padding: "3px 8px",
};

const railViewModeGroupStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "var(--overlay-text-primary)",
  fontSize: 10.5,
};

const draftPanelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "8px 9px",
  borderRadius: "var(--overlay-explorer-control-radius)",
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "var(--overlay-explorer-chip-bg)",
};

const draftActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 5,
  marginTop: 6,
};

const draftSecondaryButtonStyle: React.CSSProperties = {
  borderRadius: "var(--overlay-explorer-control-radius)",
  border: "1px solid var(--overlay-explorer-chip-border)",
  background: "var(--overlay-explorer-chip-bg)",
  color: "var(--overlay-text-muted)",
  fontSize: 9.5,
  padding: "3px 8px",
  cursor: "pointer",
};

function draftPrimaryButtonStyle(accent: string): React.CSSProperties {
  return {
    ...draftSecondaryButtonStyle,
    borderColor: `${accent}66`,
    color: accent,
    background: `${accent}14`,
  };
}

function categoryChipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: "var(--overlay-explorer-control-radius)",
    border: `1px solid ${active ? "var(--overlay-explorer-chip-active-border)" : "var(--overlay-explorer-chip-border)"}`,
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : "var(--overlay-explorer-chip-bg)",
    color: active
      ? "var(--overlay-explorer-chip-active-text)"
      : "var(--overlay-text-muted)",
    fontSize: 9.5,
    padding: "3px 7px",
    cursor: "pointer",
    maxWidth: "100%",
  };
}

function railSectionStyle(
  viewMode: ExplorerRailViewModeDefinition,
  grow: boolean,
): React.CSSProperties {
  const sectionChrome = viewMode.presentation.sectionChrome;
  return {
    marginBottom: sectionChrome === "compact" ? 4 : 8,
    display: "flex",
    flexDirection: "column",
    flex: grow ? 1 : undefined,
    minHeight: 0,
    padding:
      sectionChrome === "carded"
        ? 6
        : sectionChrome === "tree"
          ? "0 0 0 8px"
          : 0,
    borderRadius: sectionChrome === "carded" ? 14 : 0,
    border:
      sectionChrome === "carded"
        ? "1px solid var(--overlay-explorer-chip-border)"
        : sectionChrome === "tree"
          ? "1px solid transparent"
          : "none",
    background:
      sectionChrome === "carded"
        ? "rgba(255,255,255,0.025)"
        : sectionChrome === "tree"
          ? "linear-gradient(180deg, rgba(255,255,255,0.025), transparent)"
          : "transparent",
  };
}

function railSectionHeaderButtonStyle(
  viewMode: ExplorerRailViewModeDefinition,
): React.CSSProperties {
  const sectionChrome = viewMode.presentation.sectionChrome;
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: sectionChrome === "compact" ? "3px 5px" : "4px 7px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color:
      sectionChrome === "tree"
        ? "var(--overlay-text-primary)"
        : "var(--overlay-text-muted)",
    textTransform: "uppercase",
    letterSpacing: sectionChrome === "tree" ? "0.14em" : "0.1em",
    fontSize: sectionChrome === "compact" ? 9 : 9.5,
    fontWeight: sectionChrome === "tree" ? 800 : 700,
  };
}

function resolveRailIconColor(
  viewMode: ExplorerRailViewModeDefinition,
  accent: string,
  emphasis: RailTextEmphasis | "drop-target",
): string {
  if (emphasis === "active" || emphasis === "drop-target") {
    return accent;
  }
  if (emphasis === "ancestor") {
    return viewMode.presentation.iconTone === "accented"
      ? `${accent}cc`
      : "var(--overlay-text-primary)";
  }
  if (viewMode.presentation.iconTone === "contrast") {
    return "var(--overlay-text-primary)";
  }
  if (viewMode.presentation.iconTone === "accented") {
    return `${accent}aa`;
  }
  return "var(--overlay-text-muted)";
}

function getRailSelectableRowStyle(args: {
  accent: string;
  viewMode: ExplorerRailViewModeDefinition;
  dense: boolean;
  state: RailSelectableRowState;
  flattened?: boolean;
  treeDepth?: number;
}): React.CSSProperties {
  const {
    accent,
    viewMode,
    dense,
    state,
    flattened = false,
    treeDepth = 0,
  } = args;
  const rowChrome = viewMode.presentation.rowChrome;
  const isActive = state === "active";
  const isAncestor = state === "ancestor";
  const isDropTarget = state === "drop-target";
  const paddingY = dense ? 5 : rowChrome === "carded" ? 8 : 6;
  const paddingX = dense ? 6 : rowChrome === "carded" ? 9 : 8;
  const baseBorder =
    rowChrome === "compact"
      ? "rgba(255,255,255,0.05)"
      : flattened || rowChrome === "tree"
        ? "transparent"
        : "var(--overlay-explorer-chip-border)";
  const baseBackground =
    rowChrome === "carded"
      ? "var(--overlay-explorer-chip-bg)"
      : rowChrome === "compact"
        ? "rgba(255,255,255,0.015)"
        : "transparent";
  const stateBackground = isDropTarget
    ? `${accent}16`
    : isActive
      ? rowChrome === "tree"
        ? `linear-gradient(90deg, ${accent}26, transparent 82%)`
        : `${accent}18`
      : isAncestor
        ? rowChrome === "tree"
          ? `linear-gradient(90deg, ${accent}12, transparent 84%)`
          : `${accent}0d`
        : baseBackground;

  return {
    gap: rowChrome === "compact" ? 5 : 6,
    padding: `${paddingY}px ${paddingX}px`,
    borderRadius: rowChrome === "carded" ? 12 : rowChrome === "tree" ? 10 : 8,
    border: `1px solid ${isDropTarget ? `${accent}77` : isActive ? `${accent}55` : baseBorder}`,
    background: stateBackground,
    boxShadow:
      viewMode.presentation.activeBranchStyle === "lane" || rowChrome === "tree"
        ? `inset ${isActive ? 3 : isAncestor ? 1.5 : 0}px 0 0 ${isActive || isAncestor ? accent : "transparent"}`
        : viewMode.presentation.activeBranchStyle === "bold" && isActive
          ? `inset 0 0 0 1px ${accent}44`
          : "none",
    position: "relative",
    marginLeft: rowChrome === "tree" ? Math.max(treeDepth - 1, 0) * 2 : 0,
  };
}

function treeIconButtonStyle(
  viewMode: ExplorerRailViewModeDefinition,
  active: boolean,
): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    borderRadius:
      viewMode.presentation.rowChrome === "tree"
        ? 999
        : "var(--overlay-explorer-control-radius)",
    border: `1px solid ${active ? "var(--overlay-explorer-chip-active-border)" : "var(--overlay-explorer-chip-border)"}`,
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : viewMode.presentation.rowChrome === "tree"
        ? "rgba(255,255,255,0.025)"
        : "var(--overlay-explorer-chip-bg)",
    color: active ? "var(--overlay-text-primary)" : "var(--overlay-text-dim)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  };
}

function bookmarkTitleStyle(
  viewMode: ExplorerRailViewModeDefinition,
  emphasis: RailTextEmphasis,
): React.CSSProperties {
  return {
    fontSize: "var(--overlay-explorer-breadcrumb-font-size)",
    fontWeight:
      emphasis === "active"
        ? 800
        : emphasis === "ancestor"
          ? 700
          : viewMode.presentation.rowChrome === "compact"
            ? 600
            : 650,
    color:
      emphasis === "active"
        ? "var(--overlay-text-primary)"
        : emphasis === "ancestor" && viewMode.presentation.rowChrome === "tree"
          ? "rgba(255,255,255,0.92)"
          : "var(--overlay-text-primary)",
    letterSpacing:
      viewMode.presentation.rowChrome === "compact" ? "0.01em" : "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function bookmarkMetaStyle(
  viewMode: ExplorerRailViewModeDefinition,
): React.CSSProperties {
  return {
    marginTop: 2,
    fontSize: viewMode.presentation.rowChrome === "compact" ? 8 : 8.5,
    color:
      viewMode.presentation.rowChrome === "tree"
        ? "rgba(255,255,255,0.58)"
        : "var(--overlay-text-dim)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

function quickLinkButtonStyle(
  active: boolean,
  accent: string,
  dense: boolean,
  viewMode: ExplorerRailViewModeDefinition,
): React.CSSProperties {
  return {
    ...getRailSelectableRowStyle({
      accent,
      viewMode,
      dense,
      state: active ? "active" : "idle",
    }),
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 7,
    color: "var(--overlay-text-primary)",
    cursor: "pointer",
    textAlign: "left",
  };
}

function manageToggleButtonStyle(
  accent: string,
  active: boolean,
): React.CSSProperties {
  return {
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : "var(--overlay-explorer-chip-border)"}`,
    background: active ? `${accent}18` : "var(--overlay-explorer-chip-bg)",
    color: active ? accent : "var(--overlay-text-primary)",
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "5px 10px",
    cursor: "pointer",
    flexShrink: 0,
  };
}

function railViewModeButtonStyle(
  accent: string,
  active: boolean,
): React.CSSProperties {
  return {
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : "var(--overlay-explorer-chip-border)"}`,
    background: active ? `${accent}14` : "var(--overlay-explorer-chip-bg)",
    color: active ? accent : "var(--overlay-text-muted)",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.04em",
    padding: "4px 9px",
    cursor: "pointer",
    flexShrink: 0,
  };
}
