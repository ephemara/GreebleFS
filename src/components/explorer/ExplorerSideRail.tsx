import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { OverlayScrollArea } from '../OverlayScrollArea';
import { useExplorerStore } from '../../store/explorerStore';
import { ExplorerChromeSurface } from './ExplorerChromeSurface';
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
  setExplorerBookmarkSearchQuery,
  toggleExplorerBookmarkCategoryFilter,
  toggleExplorerBookmarkFolder,
  toggleExplorerRailSection,
  type ExplorerBookmarkImportPlan,
  type ExplorerBookmarkImportSource,
  type ExplorerBookmarkTreeNode,
} from './explorerRailState';
import {
  isCloudExplorerPath,
  listExplorerLocation,
  type ExplorerDriveInfo,
  type ExplorerFileEntry,
  type ExplorerSavedSearch,
  type ExplorerTagMetadataSnapshot,
} from '../../runtime/explorerBackend';
import { loadCachedExplorerLocation } from './explorerDirectoryCache';
import type {
  ExplorerChromeControlDefinition,
  ExplorerChromeControlId,
  ExplorerChromeLayoutId,
  ExplorerChromeOverrideSnapshot,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';
import { resolveExplorerChromeSurfaceLayout } from '../../config/explorerChromeLayouts';

interface ExplorerSideRailProps {
  accent: string;
  brandLabel: string;
  sidebarWidth: number;
  currentPath: string;
  locationTitle?: string;
  locationLabel?: string;
  drives: ExplorerDriveInfo[];
  drivesLoading: boolean;
  showHiddenFiles: boolean;
  isCompactDock: boolean;
  savedSearches?: ExplorerSavedSearch[];
  availableTags?: ExplorerTagMetadataSnapshot['tags'];
  activeTagFilterIds?: string[];
  onNavigate: (path: string) => void;
  onGoHome: () => void;
  onOpenSavedSearch?: (savedSearch: ExplorerSavedSearch) => void;
  onDeleteSavedSearch?: (savedSearchId: string) => void;
  onToggleTagFilter?: (tagId: string) => void;
  onClearTagFilters?: () => void;
  onBookmarkCreated: (name: string, path: string) => void;
  resolveDroppedSources: (paths: string[]) => ExplorerBookmarkImportSource[];
  chromeLayoutId: ExplorerChromeLayoutId;
  chromeOverride?: ExplorerChromeOverrideSnapshot | null;
  chromeEditMode?: {
    active: boolean;
    draggingControlId: ExplorerChromeControlId | null;
    onRegisterSurface?: (surface: ExplorerChromeResolvedSurface) => void;
    onUnregisterSurface?: (surfaceId: ExplorerChromeSurfaceId) => void;
    onDragStart: (controlId: ExplorerChromeControlId) => void;
    onDragEnd: () => void;
    onMoveControl: (args: {
      controlId: ExplorerChromeControlId;
      targetSurfaceId: ExplorerChromeSurfaceId;
      targetZoneId: ExplorerChromeZoneId;
      targetIndex: number;
    }) => void;
  };
}

interface TreeRowProps {
  accent: string;
  dense: boolean;
  manageMode: boolean;
  currentPath: string;
  row: ExplorerBookmarkTreeNode;
  dropTargetFolderId: string | null;
  onNavigate: (path: string) => void;
  onQueueFolderCreate: (parentId: string | null) => void;
  onRenameNode: (nodeId: string, nodeName: string) => void;
  onDropIntoFolder: (event: React.DragEvent, folderId: string | null) => void;
  onDragOverFolder: (event: React.DragEvent, folderId: string | null) => void;
  onDragLeaveFolder: () => void;
}

type LocalFolderTreeLoadState = {
  childFolders: ExplorerFileEntry[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
};

interface LocalFolderTreeRowProps {
  accent: string;
  dense: boolean;
  currentPath: string;
  path: string;
  depth: number;
  expandedFolderPaths: string[];
  folderChildrenByPath: Record<string, LocalFolderTreeLoadState>;
  onNavigate: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onRetryLoad: (path: string) => void;
}

const EXPLORER_RAIL_DENSE_WIDTH = 260;
const EXPLORER_RAIL_ULTRA_DENSE_WIDTH = 220;
const EXPLORER_RAIL_VERBOSE_DRAG_GUIDE_MIN_WIDTH = 320;

export function ExplorerSideRail({
  accent,
  brandLabel,
  sidebarWidth,
  currentPath,
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
  onOpenSavedSearch,
  onDeleteSavedSearch,
  onToggleTagFilter,
  onClearTagFilters,
  onBookmarkCreated,
  resolveDroppedSources,
  chromeLayoutId,
  chromeOverride,
  chromeEditMode,
}: ExplorerSideRailProps) {
  const rail = useExplorerStore((state) => state.rail);
  const persistence = useExplorerStore((state) => state.persistence);
  const updateRail = useExplorerStore((state) => state.updateRail);
  const restoreRailBackup = useExplorerStore((state) => state.restoreRailBackup);
  const clearPersistenceNotice = useExplorerStore((state) => state.clearPersistenceNotice);

  const dense = isCompactDock || sidebarWidth < EXPLORER_RAIL_DENSE_WIDTH;
  const ultraDense = isCompactDock || sidebarWidth < EXPLORER_RAIL_ULTRA_DENSE_WIDTH;
  const showVerboseDragGuide = !isCompactDock && sidebarWidth >= EXPLORER_RAIL_VERBOSE_DRAG_GUIDE_MIN_WIDTH;
  const [isManageMode, setIsManageMode] = useState(false);
  const [draftFolderParentId, setDraftFolderParentId] = useState<string | null | false>(false);
  const [draftFolderName, setDraftFolderName] = useState('New Folder');
  const [draftCategoryName, setDraftCategoryName] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeName, setEditingNodeName] = useState('');
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [importPlan, setImportPlan] = useState<ExplorerBookmarkImportPlan | null>(null);

  const deferredQuery = useDeferredValue(rail.searchQuery);
  const categories = useMemo(() => getAllExplorerBookmarkCategories(rail.customCategories), [rail.customCategories]);
  const bookmarkCount = useMemo(
    () => rail.nodes.filter((node) => node.kind === 'bookmark').length,
    [rail.nodes],
  );
  const locationTitle = locationTitleProp ?? (currentPath.trim() || 'Home');
  const locationLabel = locationLabelProp ?? getPathLeaf(locationTitle);
  const filteredRail = useMemo(() => ({
    ...rail,
    searchQuery: deferredQuery,
  }), [deferredQuery, rail]);
  const bookmarkTree = useMemo(() => buildExplorerBookmarkTree(filteredRail), [filteredRail]);
  const localDrives = useMemo(
    () => drives.filter((drive): drive is Extract<ExplorerDriveInfo, { kind: 'local' }> => drive.kind === 'local'),
    [drives],
  );
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<string[]>([]);
  const [folderChildrenByPath, setFolderChildrenByPath] = useState<Record<string, LocalFolderTreeLoadState>>({});

  const loadFolderChildren = useCallback(async (path: string) => {
    if (!path || isCloudExplorerPath(path)) {
      return;
    }
    const normalizedPath = normalizeLocalTreePath(path);
    setFolderChildrenByPath((current) => {
      const currentState = current[normalizedPath];
      if (currentState?.status === 'loading') {
        return current;
      }
      return {
        ...current,
        [normalizedPath]: {
          childFolders: currentState?.childFolders ?? [],
          status: 'loading',
          errorMessage: null,
        },
      };
    });

    try {
      const listing = await loadCachedExplorerLocation({
        path: normalizedPath,
        showHidden: showHiddenFiles,
        listLocation: listExplorerLocation,
      });
      const childFolders = listing.entries
        .filter((entry) => entry.is_dir)
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
      setFolderChildrenByPath((current) => ({
        ...current,
        [normalizedPath]: {
          childFolders,
          status: 'ready',
          errorMessage: null,
        },
      }));
    } catch (error) {
      setFolderChildrenByPath((current) => ({
        ...current,
        [normalizedPath]: {
          childFolders: current[normalizedPath]?.childFolders ?? [],
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }, [showHiddenFiles]);

  const toggleFolderExpand = useCallback((path: string) => {
    const normalizedPath = normalizeLocalTreePath(path);
    setExpandedFolderPaths((current) => {
      if (current.includes(normalizedPath)) {
        return current.filter((entry) => entry !== normalizedPath);
      }
      return [...current, normalizedPath];
    });
    if (!expandedFolderPaths.includes(normalizedPath)) {
      void loadFolderChildren(normalizedPath);
    }
  }, [expandedFolderPaths, loadFolderChildren]);

  useEffect(() => {
    setFolderChildrenByPath({});
  }, [showHiddenFiles, localDrives.map((drive) => drive.path).join('::')]);

  useEffect(() => {
    const knownDrivePaths = new Set(localDrives.map((drive) => normalizeLocalTreePath(drive.path)));
    setExpandedFolderPaths((current) => current.filter((path) => {
      const rootPath = getLocalTreeRootPath(path);
      return rootPath ? knownDrivePaths.has(rootPath) : false;
    }));
  }, [localDrives]);

  const currentPathAncestors = useMemo(() => {
    if (!currentPath || isCloudExplorerPath(currentPath)) {
      return [];
    }
    const ancestors = getLocalPathAncestors(currentPath);
    const rootPath = ancestors[0];
    if (!rootPath) {
      return [];
    }
    const knownDrivePaths = new Set(localDrives.map((drive) => normalizeLocalTreePath(drive.path)));
    return knownDrivePaths.has(rootPath) ? ancestors : [];
  }, [currentPath, localDrives]);

  useEffect(() => {
    if (currentPathAncestors.length === 0) {
      return;
    }

    setExpandedFolderPaths((current) => {
      const next = [...current];
      for (const ancestor of currentPathAncestors) {
        if (!next.includes(ancestor)) {
          next.push(ancestor);
        }
      }
      return next;
    });

    void (async () => {
      for (const ancestor of currentPathAncestors) {
        await loadFolderChildren(ancestor);
      }
    })();
  }, [currentPathAncestors, loadFolderChildren]);

  const handleBookmarkDrop = (event: React.DragEvent, targetFolderId: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetFolderId(null);

    const payload = event.dataTransfer.getData('application/x-overlayterm-paths');
    let droppedPaths: string[] = [];
    if (payload) {
      try {
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed)) {
          droppedPaths = parsed.filter((entry): entry is string => typeof entry === 'string');
        }
      } catch {
        droppedPaths = [];
      }
    }

    if (droppedPaths.length === 0) {
      const textPath = event.dataTransfer.getData('text/plain').trim();
      if (textPath) {
        droppedPaths = [textPath];
      }
    }

    const sources = resolveDroppedSources(droppedPaths);
    const nextPlan = planExplorerBookmarkImport(rail, sources, targetFolderId);
    if (nextPlan) {
      setImportPlan(nextPlan);
    }
  };

  const applyPlan = (mode: 'bookmark' | 'folder') => {
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
    setDraftFolderName('New Folder');
    setEditingNodeId(result.node.id);
    setEditingNodeName(result.node.name);
  };

  const commitDraftCategory = () => {
    const result = createExplorerCustomCategory(rail, draftCategoryName, accent);
    updateRail(result.snapshot);
    setDraftCategoryName('');
  };

  const commitNodeRename = () => {
    if (!editingNodeId) {
      return;
    }
    updateRail(renameExplorerBookmarkNode(rail, editingNodeId, editingNodeName));
    setEditingNodeId(null);
    setEditingNodeName('');
  };

  const railHeaderRowStyle = useMemo<React.CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
    flexWrap: 'wrap',
  }), []);
  const getRailHeaderZoneStyle = useCallback((zoneId: ExplorerChromeZoneId): React.CSSProperties => {
    switch (zoneId) {
      case 'center':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          flexWrap: 'wrap',
        };
      case 'end':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          minWidth: 0,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        };
      case 'start':
      default:
        return {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          minWidth: 0,
          flex: 1,
        };
    }
  }, []);
  const railChromeControlRegistry = useMemo<Array<ExplorerChromeControlDefinition & {
    isVisible: (surfaceId: ExplorerChromeSurfaceId) => boolean;
    render: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
  }>>(() => [
    {
      id: 'railIdentity',
      label: 'Rail Identity',
      surfaces: ['railHeader'],
      isVisible: () => true,
      render: () => (
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)', fontWeight: 700 }}>
            {brandLabel}
          </div>
          <div style={{ marginTop: 2, fontSize: 'var(--overlay-explorer-rail-title-size)', color: 'var(--overlay-text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {locationLabel}
          </div>
          <div title={locationTitle} style={{ marginTop: 3, fontSize: 9.5, color: 'var(--overlay-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {locationTitle}
          </div>
        </div>
      ),
    },
    {
      id: 'railBookmarkSummary',
      label: 'Rail Bookmark Summary',
      surfaces: ['railHeader'],
      isVisible: () => true,
      render: () => (
        <>
          <span style={railMetaPillStyle}>
            {bookmarkCount} pinned
          </span>
          {showVerboseDragGuide && (
            <span style={railMetaPillStyle}>
              Plain drag exports files. Shift keeps drag inside the explorer.
            </span>
          )}
        </>
      ),
    },
    {
      id: 'railManageToggle',
      label: 'Rail Manage Toggle',
      surfaces: ['railHeader'],
      isVisible: () => true,
      render: () => (
        <button
          type="button"
          aria-pressed={isManageMode}
          onClick={() => {
            setIsManageMode((current) => {
              const next = !current;
              if (!next) {
                setDraftFolderParentId(false);
                setDraftCategoryName('');
              }
              return next;
            });
          }}
          style={manageToggleButtonStyle(accent, isManageMode)}
        >
          {isManageMode ? 'Done' : 'Manage'}
        </button>
      ),
    },
  ], [accent, bookmarkCount, brandLabel, isManageMode, locationLabel, locationTitle, showVerboseDragGuide]);
  const railChromeControlRegistryById = useMemo(
    () => new Map(railChromeControlRegistry.map((entry) => [entry.id, entry])),
    [railChromeControlRegistry],
  );
  const railHeaderSurface = useMemo(
    () => resolveExplorerChromeSurfaceLayout({
      layoutId: chromeLayoutId,
      surfaceId: 'railHeader',
      controlDefinitions: railChromeControlRegistry,
      override: chromeOverride,
      isControlVisible: (controlId, surfaceId) => railChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ?? false,
    }),
    [chromeLayoutId, chromeOverride, railChromeControlRegistry, railChromeControlRegistryById],
  );
  const renderRailChromeControl = useCallback((placement: ExplorerChromeResolvedControlPlacement) => (
    railChromeControlRegistryById.get(placement.controlId)?.render(placement) ?? null
  ), [railChromeControlRegistryById]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--overlay-bg-sidebar)',
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(event) => handleBookmarkDrop(event, null)}
    >
      <div style={{ padding: dense ? '8px 8px 6px' : '12px 12px 10px', borderBottom: '1px solid var(--overlay-border)' }}>
        <ExplorerChromeSurface
          surface={railHeaderSurface}
          getRowStyle={() => railHeaderRowStyle}
          getZoneStyle={getRailHeaderZoneStyle}
          renderControl={renderRailChromeControl}
          editMode={chromeEditMode}
        />
        {persistence.message && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 8px',
              borderRadius: 9,
              border: `1px solid ${persistence.status === 'save-error' ? 'rgba(248,113,113,0.45)' : `${accent}44`}`,
              background: persistence.status === 'save-error' ? 'rgba(248,113,113,0.12)' : `${accent}14`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 10, lineHeight: 1.35, color: 'var(--overlay-text-primary)' }}>{persistence.message}</p>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'transparent',
                  border: `1px solid ${accent}55`,
                  borderRadius: 999,
                  color: accent,
                  fontSize: 10,
                  padding: '4px 9px',
                  cursor: 'pointer',
                }}
              >
                <Undo2 size={11} />
                Restore backup
              </button>
            )}
          </div>
        )}
      </div>

      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: dense ? 6 : 10 }}>
        <RailSection
          title="Quick Access"
          collapsed={isExplorerRailSectionCollapsed(rail, 'quick-access')}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, 'quick-access'))}
        >
          <button type="button" onClick={onGoHome} style={quickLinkButtonStyle(currentPath === '', accent, dense)}>
            <Home size={dense ? 12 : 13} style={{ color: accent, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={quickLinkTitleStyle}>Home</div>
              {!dense && <div style={quickLinkMetaStyle}>Jump to your user root.</div>}
            </div>
          </button>
        </RailSection>

        <RailSection
          title="Drives"
          collapsed={isExplorerRailSectionCollapsed(rail, 'drives')}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, 'drives'))}
        >
          {drivesLoading && (
            <div style={{ display: 'grid', gap: 4 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    height: dense ? 26 : 38,
                    borderRadius: 9,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--overlay-border)',
                  }}
                />
              ))}
            </div>
          )}

          {!drivesLoading && drives.map((drive) => {
            const isCloudDrive = drive.kind === 'cloud';
            const drivePath = drive.path;
            const isActive = isCloudDrive
              ? currentPath === drivePath || currentPath.startsWith(`${drivePath}/`)
              : currentPath.toUpperCase().startsWith(drive.path.toUpperCase());

            if (isCloudDrive) {
              return (
                <button
                  key={drive.id}
                  type="button"
                  onClick={() => onNavigate(drive.path)}
                  style={{
                    width: '100%',
                    padding: dense ? '5px 7px' : '8px 10px',
                    borderRadius: 9,
                    border: `1px solid ${isActive ? `${accent}66` : 'var(--overlay-border)'}`,
                    background: isActive ? `${accent}17` : 'var(--overlay-explorer-chip-bg)',
                    color: 'var(--overlay-text-primary)',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: dense ? 6 : 10,
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: 4,
                  }}
                >
                  <FolderTree size={dense ? 11 : 14} style={{ color: isActive ? accent : 'var(--overlay-text-muted)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: dense ? 9.5 : 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {drive.label}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--overlay-text-dim)', textTransform: 'uppercase' }}>
                        {drive.provider === 'google-drive' ? 'Drive' : 'Dropbox'}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 8.5, color: 'var(--overlay-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {drive.email}
                    </div>
                  </div>
                </button>
              );
            }

            const usedBytes = Math.max(drive.total_bytes - drive.free_bytes, 0);
            const usedRatio = drive.total_bytes > 0 ? usedBytes / drive.total_bytes : 0;
            const normalizedDrivePath = normalizeLocalTreePath(drive.path);
            const isExpanded = expandedFolderPaths.includes(normalizedDrivePath);
            return (
              <div key={drive.id} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    width: '100%',
                    padding: dense ? '5px 7px' : '8px 10px',
                    borderRadius: 9,
                    border: `1px solid ${isActive ? `${accent}66` : 'var(--overlay-border)'}`,
                    background: isActive ? `${accent}17` : 'var(--overlay-explorer-chip-bg)',
                    color: 'var(--overlay-text-primary)',
                    display: 'grid',
                    gridTemplateColumns: 'auto auto 1fr',
                    gap: dense ? 6 : 10,
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    aria-label={isExpanded ? `Collapse ${drive.label} folder tree` : `Expand ${drive.label} folder tree`}
                    onClick={() => toggleFolderExpand(normalizedDrivePath)}
                    style={treeIconButtonStyle}
                  >
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  <HardDrive size={dense ? 11 : 14} style={{ color: isActive ? accent : 'var(--overlay-text-muted)' }} />
                  <button
                    type="button"
                    onClick={() => onNavigate(drive.path)}
                    style={{
                      minWidth: 0,
                      background: 'transparent',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: dense ? 9.5 : 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {drive.label}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--overlay-text-dim)' }}>{drive.letter}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 4 }}>
                      <div style={{ width: `${Math.max(0, Math.min(usedRatio * 100, 100))}%`, height: '100%', background: usedRatio > 0.9 ? 'var(--overlay-danger)' : accent }} />
                    </div>
                    {!ultraDense && (
                      <div style={{ marginTop: 3, fontSize: 8.5, color: 'var(--overlay-text-dim)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{formatBytes(usedBytes)} used</span>
                        <span>{formatBytes(drive.total_bytes)} total</span>
                      </div>
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div role="tree" aria-label={`${drive.label} folder tree`} style={{ marginTop: 4 }}>
                    <LocalFolderTreeRow
                      accent={accent}
                      dense={dense}
                      currentPath={currentPath}
                      path={normalizedDrivePath}
                      depth={0}
                      expandedFolderPaths={expandedFolderPaths}
                      folderChildrenByPath={folderChildrenByPath}
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
          collapsed={isExplorerRailSectionCollapsed(rail, 'saved-searches')}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, 'saved-searches'))}
        >
          {savedSearches.length === 0 && (
            <div style={{ fontSize: 10, color: 'var(--overlay-text-dim)', padding: '4px 2px 2px' }}>
              Save a search from the explorer toolbar to pin it here.
            </div>
          )}
          {savedSearches.map((savedSearch) => (
            <div
              key={savedSearch.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
              }}
            >
              <button
                type="button"
                onClick={() => onOpenSavedSearch?.(savedSearch)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 8,
                  alignItems: 'center',
                  padding: dense ? '5px 7px' : '7px 9px',
                  borderRadius: 9,
                  border: '1px solid var(--overlay-border)',
                  background: 'var(--overlay-explorer-chip-bg)',
                  color: 'var(--overlay-text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Search size={dense ? 11 : 13} style={{ color: accent, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: dense ? 9.5 : 10.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {savedSearch.name}
                  </div>
                  {!dense && (
                    <div style={{ marginTop: 3, fontSize: 8.5, color: 'var(--overlay-text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {savedSearch.query}
                    </div>
                  )}
                </div>
              </button>
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
          collapsed={isExplorerRailSectionCollapsed(rail, 'tags')}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, 'tags'))}
        >
          {availableTags.length === 0 && (
            <div style={{ fontSize: 10, color: 'var(--overlay-text-dim)', padding: '4px 2px 2px' }}>
              Tag files from the explorer toolbar or context menu to filter them here.
            </div>
          )}
          {(activeTagFilterIds.length > 0 || availableTags.length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 9.5, color: 'var(--overlay-text-dim)', fontWeight: 600 }}>
                {activeTagFilterIds.length > 0 ? `${activeTagFilterIds.length} tag filter${activeTagFilterIds.length === 1 ? '' : 's'} active` : 'Tag filters'}
              </div>
              {activeTagFilterIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onClearTagFilters?.()}
                  style={{
                    border: '1px solid var(--overlay-border)',
                    borderRadius: 999,
                    padding: '3px 8px',
                    background: 'transparent',
                    color: 'var(--overlay-text-muted)',
                    fontSize: 9,
                    cursor: 'pointer',
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
                display: 'flex',
                flexWrap: 'wrap',
                gap: 5,
                marginBottom: availableTags.length > 0 ? 6 : 0,
              }}
            >
              <button
                type="button"
                onClick={() => onClearTagFilters?.()}
                style={categoryChipStyle(activeTagFilterIds.length === 0)}
              >
                All
              </button>
              {availableTags.map((tag) => {
                const active = activeTagFilterIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTagFilter?.(tag.id)}
                    style={{
                      ...categoryChipStyle(active),
                      borderColor: active ? accent : 'var(--overlay-border)',
                      color: active ? accent : 'var(--overlay-text-muted)',
                    }}
                  >
                    <Tag size={10} />
                    <span>{tag.label}</span>
                    <span style={{ color: 'var(--overlay-text-dim)' }}>{tag.pathCount}</span>
                  </button>
                );
              })}
            </div>
          )}
        </RailSection>

        <RailSection
          title="Bookmarks"
          collapsed={isExplorerRailSectionCollapsed(rail, 'bookmarks')}
          onToggle={() => updateRail(toggleExplorerRailSection(rail, 'bookmarks'))}
          grow
        >
          <div
            style={{
              padding: dense ? '6px 7px' : '8px 10px',
              borderRadius: 9,
              border: '1px solid var(--overlay-border)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={11} style={{ color: 'var(--overlay-text-dim)', flexShrink: 0 }} />
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
                <button type="button" aria-label="Clear bookmark search" onClick={() => updateRail(setExplorerBookmarkSearchQuery(rail, ''))} style={dismissButtonStyle}>
                  <X size={11} />
                </button>
              )}
            </div>

            {(isManageMode || rail.activeCategoryIds.length > 0 || draftCategoryName.length > 0) && (
              <div
                className={dense ? 'overlay-scrollbars-none' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 6,
                  flexWrap: dense ? 'nowrap' : 'wrap',
                  overflowX: dense ? 'auto' : 'visible',
                  overflowY: 'hidden',
                  paddingBottom: dense ? 2 : 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => updateRail(clearExplorerBookmarkCategoryFilters(rail))}
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
                      onClick={() => updateRail(toggleExplorerBookmarkCategoryFilter(rail, category.id))}
                      style={{
                        ...categoryChipStyle(active),
                        borderColor: active ? category.color : 'var(--overlay-border)',
                        color: active ? category.color : 'var(--overlay-text-muted)',
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: category.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: dense ? 64 : 110 }}>
                        {category.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {isManageMode && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  aria-label="Create bookmark folder"
                  onClick={() => {
                    setDraftFolderParentId(null);
                    setDraftFolderName('New Folder');
                  }}
                  style={draftPrimaryButtonStyle(accent)}
                >
                  New Group
                </button>
                <button
                  type="button"
                  aria-label="Create custom category"
                  onClick={() => setDraftCategoryName((current) => current || 'New Category')}
                  style={draftSecondaryButtonStyle}
                >
                  New Tag
                </button>
              </div>
            )}
          </div>

          {draftFolderParentId !== false && (
            <div style={draftPanelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderTree size={12} style={{ color: accent, flexShrink: 0 }} />
                <input
                  autoFocus
                  aria-label="New bookmark folder name"
                  value={draftFolderName}
                  onChange={(event) => setDraftFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitDraftFolder();
                    if (event.key === 'Escape') setDraftFolderParentId(false);
                  }}
                  style={searchInputStyle}
                />
              </div>
              <div style={draftActionRowStyle}>
                <button type="button" onClick={commitDraftFolder} style={draftPrimaryButtonStyle(accent)}>Create</button>
                <button type="button" onClick={() => setDraftFolderParentId(false)} style={draftSecondaryButtonStyle}>Cancel</button>
              </div>
            </div>
          )}

          {draftCategoryName && (
            <div style={draftPanelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={13} style={{ color: accent, flexShrink: 0 }} />
                <input
                  autoFocus
                  aria-label="New custom category name"
                  value={draftCategoryName}
                  onChange={(event) => setDraftCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitDraftCategory();
                    if (event.key === 'Escape') setDraftCategoryName('');
                  }}
                  style={searchInputStyle}
                />
              </div>
              <div style={draftActionRowStyle}>
                <button type="button" onClick={commitDraftCategory} style={draftPrimaryButtonStyle(accent)}>Save</button>
                <button type="button" onClick={() => setDraftCategoryName('')} style={draftSecondaryButtonStyle}>Cancel</button>
              </div>
            </div>
          )}

          {importPlan && (
            <div style={draftPanelStyle}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
                Add {importPlan.sources.length} item{importPlan.sources.length === 1 ? '' : 's'} to bookmarks
              </div>
              <div style={{ marginTop: 3, fontSize: 9.5, lineHeight: 1.35, color: 'var(--overlay-text-muted)' }}>
                {importPlan.note}
              </div>
              <div style={draftActionRowStyle}>
                <button type="button" onClick={() => applyPlan('bookmark')} style={draftPrimaryButtonStyle(accent)}>
                  Pin directly
                </button>
                <button type="button" onClick={() => applyPlan('folder')} style={draftSecondaryButtonStyle}>
                  Create group
                </button>
                <button type="button" onClick={() => setImportPlan(null)} style={draftSecondaryButtonStyle}>
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
              border: `1px dashed ${dropTargetFolderId === null ? `${accent}55` : 'transparent'}`,
              background: dropTargetFolderId === null ? `${accent}10` : 'var(--overlay-explorer-chip-bg)',
            }}
          >
            {bookmarkTree.length === 0 && (
              <div style={{ padding: dense ? '10px 8px' : '14px 10px', color: 'var(--overlay-text-dim)', fontSize: 9.5, lineHeight: 1.4 }}>
                Drag folders here to pin them. Open Manage when you want to organize groups, tags, or colors.
              </div>
            )}

            {bookmarkTree.map((row) => (
              <BookmarkTreeRow
                key={row.node.id}
                accent={accent}
                dense={dense}
                manageMode={isManageMode}
                currentPath={currentPath}
                row={row}
                dropTargetFolderId={dropTargetFolderId}
                onNavigate={onNavigate}
                onQueueFolderCreate={(parentId) => {
                  setDraftFolderParentId(parentId);
                  setDraftFolderName('New Folder');
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
        <div style={{ padding: dense ? '8px 10px' : '10px 12px', borderTop: '1px solid var(--overlay-border)', background: 'var(--overlay-explorer-chip-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus
              aria-label="Rename bookmark"
              value={editingNodeName}
              onChange={(event) => setEditingNodeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitNodeRename();
                if (event.key === 'Escape') {
                  setEditingNodeId(null);
                  setEditingNodeName('');
                }
              }}
              style={searchInputStyle}
            />
            <button type="button" onClick={commitNodeRename} style={draftPrimaryButtonStyle(accent)}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookmarkTreeRow({
  accent,
  dense,
  manageMode,
  currentPath,
  row,
  dropTargetFolderId,
  onNavigate,
  onQueueFolderCreate,
  onRenameNode,
  onDropIntoFolder,
  onDragOverFolder,
  onDragLeaveFolder,
}: TreeRowProps) {
  const rail = useExplorerStore((state) => state.rail);
  const updateRail = useExplorerStore((state) => state.updateRail);
  const isFolder = row.node.kind === 'folder';
  const isExpanded = isFolder ? isExplorerBookmarkFolderExpanded(rail, row.node.id) : false;
  const isDropTarget = dropTargetFolderId === row.node.id;
  const isActive = row.node.kind === 'bookmark' && currentPath === row.node.path;

  return (
    <div style={{ marginTop: 4 }}>
      <div
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isActive}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: dense ? '5px 6px' : '6px 8px',
          paddingLeft: dense ? 6 + row.depth * 14 : 8 + row.depth * 16,
          borderRadius: 10,
          border: `1px solid ${isDropTarget ? `${accent}66` : isActive ? `${accent}44` : 'transparent'}`,
          background: isDropTarget ? `${accent}14` : isActive ? `${accent}12` : 'transparent',
        }}
        onDragOver={isFolder ? (event) => onDragOverFolder(event, row.node.id) : undefined}
        onDragLeave={isFolder ? onDragLeaveFolder : undefined}
        onDrop={isFolder ? (event) => onDropIntoFolder(event, row.node.id) : undefined}
      >
        {isFolder ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse bookmark folder' : 'Expand bookmark folder'}
            onClick={() => updateRail(toggleExplorerBookmarkFolder(rail, row.node.id))}
            style={treeIconButtonStyle}
          >
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span style={{ width: 16, display: 'flex', justifyContent: 'center', color: 'var(--overlay-text-dim)' }}>
            <Star size={10} />
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            if (row.node.kind === 'bookmark') {
              onNavigate(row.node.path);
            } else {
              updateRail(toggleExplorerBookmarkFolder(rail, row.node.id));
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--overlay-text-primary)',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: row.node.color ?? accent, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={bookmarkTitleStyle}>{row.node.name}</div>
            {row.node.kind === 'bookmark' && (
              <div style={bookmarkMetaStyle}>{row.node.path}</div>
            )}
          </div>
        </button>

        {manageMode && isFolder && (
          <button type="button" aria-label="Create nested bookmark folder" onClick={() => onQueueFolderCreate(row.node.id)} style={treeIconButtonStyle}>
            <FolderPlus size={11} />
          </button>
        )}
        {manageMode && (
          <button type="button" aria-label="Rename bookmark node" onClick={() => onRenameNode(row.node.id, row.node.name)} style={treeIconButtonStyle}>
            <Pencil size={11} />
          </button>
        )}
        {manageMode && (
          <button type="button" aria-label="Cycle bookmark color" onClick={() => updateRail(cycleExplorerBookmarkNodeColor(rail, row.node.id))} style={treeIconButtonStyle}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: row.node.color ?? accent }} />
          </button>
        )}
        {manageMode && (
          <button type="button" aria-label="Remove bookmark node" onClick={() => updateRail(removeExplorerBookmarkNode(rail, row.node.id))} style={treeIconButtonStyle}>
            <X size={11} />
          </button>
        )}
      </div>

      {isFolder && isExpanded && row.children.map((child) => (
        <BookmarkTreeRow
          key={child.node.id}
          accent={accent}
          dense={dense}
          manageMode={manageMode}
          currentPath={currentPath}
          row={child}
          dropTargetFolderId={dropTargetFolderId}
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
  dense,
  currentPath,
  path,
  depth,
  expandedFolderPaths,
  folderChildrenByPath,
  onNavigate,
  onToggleExpand,
  onRetryLoad,
}: LocalFolderTreeRowProps) {
  const normalizedPath = normalizeLocalTreePath(path);
  const loadState = folderChildrenByPath[normalizedPath];
  const childFolders = loadState?.childFolders ?? [];

  if (loadState?.status === 'loading' || !loadState) {
    return (
      <div style={{ marginTop: 4, marginLeft: depth === 0 ? 0 : 12 + depth * 16, fontSize: 9, color: 'var(--overlay-text-dim)' }}>
        Loading folders…
      </div>
    );
  }

  if (loadState.status === 'error') {
    return (
      <div style={{ marginTop: 4, marginLeft: depth === 0 ? 0 : 12 + depth * 16 }}>
        <div style={localTreeFeedbackStyle}>
          <span>{loadState.errorMessage || 'Unable to load folders.'}</span>
          <button type="button" onClick={() => onRetryLoad(normalizedPath)} style={localTreeRetryButtonStyle}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (childFolders.length === 0) {
    return (
      <div style={{ marginTop: 4, marginLeft: depth === 0 ? 0 : 12 + depth * 16, fontSize: 9, color: 'var(--overlay-text-dim)' }}>
        No subfolders
      </div>
    );
  }

  return (
    <>
      {childFolders.map((childFolder) => {
        const childPath = normalizeLocalTreePath(childFolder.path);
        const childState = folderChildrenByPath[childPath];
        const isExpanded = expandedFolderPaths.includes(childPath);
        const isActive = isSameLocalPath(childPath, currentPath);
        const isAncestor = !isActive && isSameOrDescendantLocalPath(childPath, currentPath);
        const canExpand = isExpanded || childState?.status !== 'ready' || (childState.childFolders?.length ?? 0) > 0;

        return (
          <div key={childPath} style={{ marginTop: 4 }}>
            <div
              role="treeitem"
              aria-expanded={canExpand ? isExpanded : undefined}
              aria-selected={isActive}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: dense ? '5px 6px' : '6px 8px',
                paddingLeft: 8 + depth * 16,
                borderRadius: 10,
                border: `1px solid ${isActive ? `${accent}44` : 'transparent'}`,
                background: isActive ? `${accent}12` : isAncestor ? `${accent}0d` : 'transparent',
              }}
            >
              {canExpand ? (
                <button
                  type="button"
                  aria-label={isExpanded ? `Collapse ${childFolder.name}` : `Expand ${childFolder.name}`}
                  onClick={() => onToggleExpand(childPath)}
                  style={treeIconButtonStyle}
                >
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
              ) : (
                <span style={{ width: 20, flexShrink: 0 }} />
              )}

              <button
                type="button"
                onClick={() => onNavigate(childPath)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--overlay-text-primary)',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                {isExpanded ? (
                  <FolderOpen size={dense ? 11 : 13} style={{ color: isActive ? accent : 'var(--overlay-text-muted)', flexShrink: 0 }} />
                ) : (
                  <Folder size={dense ? 11 : 13} style={{ color: isActive ? accent : 'var(--overlay-text-muted)', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={bookmarkTitleStyle}>{childFolder.name || getPathLeaf(childPath)}</div>
                  {!dense && (
                    <div style={bookmarkMetaStyle}>{childPath}</div>
                  )}
                </div>
              </button>
            </div>

            {isExpanded && (
              <LocalFolderTreeRow
                accent={accent}
                dense={dense}
                currentPath={currentPath}
                path={childPath}
                depth={depth + 1}
                expandedFolderPaths={expandedFolderPaths}
                folderChildrenByPath={folderChildrenByPath}
                onNavigate={onNavigate}
                onToggleExpand={onToggleExpand}
                onRetryLoad={onRetryLoad}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function RailSection({
  title,
  collapsed,
  grow = false,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  grow?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', flex: grow ? 1 : undefined, minHeight: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '4px 7px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--overlay-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: 9.5,
          fontWeight: 700,
        }}
      >
        <span>{title}</span>
        {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 180ms ease, opacity 180ms ease',
          opacity: collapsed ? 0.55 : 1,
          minHeight: 0,
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return '0 B';
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
  const trimmed = path.replace(/[\\/]+$/, '');
  if (!trimmed) {
    return 'Home';
  }
  const segments = trimmed.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? trimmed;
}

function isWindowsLocalPath(path: string): boolean {
  return /^[A-Za-z]:/.test(path.trim());
}

function normalizeLocalTreePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\\`;
  }
  if (/^\/+$/.test(trimmed)) {
    return '/';
  }
  return isWindowsLocalPath(trimmed)
    ? trimmed.replace(/\//g, '\\').replace(/[\\]+$/, '')
    : trimmed.replace(/[\\/]+$/, '');
}

function getLocalPathComparisonKey(path: string): string {
  const normalized = normalizeLocalTreePath(path);
  return isWindowsLocalPath(normalized) ? normalized.toUpperCase() : normalized;
}

function isSameLocalPath(leftPath: string, rightPath: string): boolean {
  return getLocalPathComparisonKey(leftPath) === getLocalPathComparisonKey(rightPath);
}

function isSameOrDescendantLocalPath(candidateAncestorPath: string, candidatePath: string): boolean {
  const ancestor = normalizeLocalTreePath(candidateAncestorPath);
  const target = normalizeLocalTreePath(candidatePath);
  if (!ancestor || !target) {
    return false;
  }
  const ancestorKey = getLocalPathComparisonKey(ancestor);
  const targetKey = getLocalPathComparisonKey(target);
  if (ancestorKey === targetKey) {
    return true;
  }
  if (ancestor === '/') {
    return target.startsWith('/');
  }
  const separator = isWindowsLocalPath(ancestor) ? '\\' : '/';
  return targetKey.startsWith(`${ancestorKey}${separator}`);
}

function getLocalTreeRootPath(path: string): string | null {
  const ancestors = getLocalPathAncestors(path);
  return ancestors[0] ?? null;
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
    const remainder = normalized.slice(2).replace(/^\\+/, '');
    const parts = remainder.split(/\\/).filter(Boolean);
    const ancestors: string[] = [driveRoot];
    let currentPath = driveRoot;
    for (const part of parts) {
      currentPath = currentPath.endsWith('\\')
        ? `${currentPath}${part}`
        : `${currentPath}\\${part}`;
      ancestors.push(currentPath);
    }
    return ancestors;
  }

  if (normalized === '/') {
    return ['/'];
  }

  const parts = normalized.replace(/^\/+/, '').split('/').filter(Boolean);
  const ancestors: string[] = ['/'];
  let currentPath = '';
  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
    ancestors.push(currentPath);
  }
  return ancestors;
}

const dismissButtonStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'var(--overlay-explorer-chip-bg)',
  color: 'var(--overlay-text-dim)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const localTreeFeedbackStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'var(--overlay-explorer-chip-bg)',
  color: 'var(--overlay-text-dim)',
  fontSize: 9,
};

const localTreeRetryButtonStyle: React.CSSProperties = {
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'transparent',
  color: 'var(--overlay-text-primary)',
  fontSize: 9,
  padding: '3px 7px',
  cursor: 'pointer',
  flexShrink: 0,
};

const treeIconButtonStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'var(--overlay-explorer-chip-bg)',
  color: 'var(--overlay-text-dim)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

const railMetaPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minWidth: 0,
  maxWidth: '100%',
  borderRadius: 999,
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'var(--overlay-explorer-chip-bg)',
  color: 'var(--overlay-text-dim)',
  fontSize: 9,
  padding: '3px 8px',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: 'var(--overlay-text-primary)',
  fontSize: 10.5,
};

const quickLinkTitleStyle: React.CSSProperties = {
  fontSize: 'var(--overlay-explorer-breadcrumb-font-size)',
  fontWeight: 600,
  color: 'var(--overlay-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const quickLinkMetaStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 8.5,
  color: 'var(--overlay-text-dim)',
};

const bookmarkTitleStyle: React.CSSProperties = {
  fontSize: 'var(--overlay-explorer-breadcrumb-font-size)',
  fontWeight: 600,
  color: 'var(--overlay-text-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const bookmarkMetaStyle: React.CSSProperties = {
  marginTop: 2,
  fontSize: 8.5,
  color: 'var(--overlay-text-dim)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const draftPanelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 9px',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'var(--overlay-explorer-chip-bg)',
};

const draftActionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 5,
  marginTop: 6,
};

const draftSecondaryButtonStyle: React.CSSProperties = {
  borderRadius: 'var(--overlay-explorer-control-radius)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'var(--overlay-explorer-chip-bg)',
  color: 'var(--overlay-text-muted)',
  fontSize: 9.5,
  padding: '3px 8px',
  cursor: 'pointer',
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
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 'var(--overlay-explorer-control-radius)',
    border: `1px solid ${active ? 'var(--overlay-explorer-chip-active-border)' : 'var(--overlay-explorer-chip-border)'}`,
    background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)',
    color: active ? 'var(--overlay-explorer-chip-active-text)' : 'var(--overlay-text-muted)',
    fontSize: 9.5,
    padding: '3px 7px',
    cursor: 'pointer',
    maxWidth: '100%',
  };
}

function quickLinkButtonStyle(active: boolean, accent: string, dense: boolean): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: dense ? '5px 7px' : '8px 10px',
    borderRadius: 'var(--overlay-explorer-control-radius)',
    border: `1px solid ${active ? `${accent}55` : 'var(--overlay-explorer-chip-border)'}`,
    background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)',
    color: 'var(--overlay-text-primary)',
    cursor: 'pointer',
    textAlign: 'left',
  };
}

function manageToggleButtonStyle(accent: string, active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    border: `1px solid ${active ? `${accent}66` : 'var(--overlay-explorer-chip-border)'}`,
    background: active ? `${accent}18` : 'var(--overlay-explorer-chip-bg)',
    color: active ? accent : 'var(--overlay-text-primary)',
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '5px 10px',
    cursor: 'pointer',
    flexShrink: 0,
  };
}
