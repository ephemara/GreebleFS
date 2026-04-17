This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where content has been compressed (code blocks are separated by ⋮---- delimiter).

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Content has been compressed - code blocks are separated by ⋮---- delimiter
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
constellationLayout.ts
ExplorerChromeSurface.tsx
explorerDirectoryCache.ts
explorerRailState.ts
ExplorerSideRail.tsx
ExplorerTaskCenterContent.tsx
ExplorerTaskStatusBadge.tsx
ExplorerWorkspace.tsx
repositoryPickerState.ts
```

# Files

## File: constellationLayout.ts
```typescript
import type { ExplorerFileEntry as FileEntry } from '../../runtime/explorerBackend';
⋮----
export interface ConstellationOrbitBandInput {
  id: string;
  label: string;
  description: string;
  dominant: boolean;
  entries: FileEntry[];
}
⋮----
export interface ConstellationOrbitNode {
  entry: FileEntry;
  x: number;
  y: number;
  size: number;
  labelVisible: boolean;
  emphasis: 'anchor' | 'selected' | 'satellite';
}
⋮----
export interface ConstellationOrbitBand extends ConstellationOrbitBandInput {
  nodes: ConstellationOrbitNode[];
  hiddenEntryCount: number;
}
⋮----
interface PositionedConstellationEntry {
  entry: FileEntry;
  hash: number;
  emphasis: ConstellationOrbitNode['emphasis'];
  sourceIndex: number;
}
⋮----
interface ConstellationOrbitLane {
  width: number;
  height: number;
  slotOffset: number;
  reverseDirection: boolean;
}
⋮----
export function buildConstellationOrbitBands(
  bands: readonly ConstellationOrbitBandInput[],
  selectedPaths: ReadonlySet<string>,
  density: number,
): ConstellationOrbitBand[]
⋮----
function buildConstellationOrbitLanes(
  nodeCount: number,
  density: number,
  dominant: boolean,
): ConstellationOrbitLane[]
⋮----
function projectConstellationOrbitPoint(
  slotIndex: number,
  slotCount: number,
  lane: ConstellationOrbitLane,
  entryHash: number,
):
⋮----
function getConstellationOrbitSlotProgress(slotIndex: number): number
⋮----
function projectStadiumOrbitProgress(
  progress: number,
  width: number,
  height: number,
):
⋮----
function hashExplorerString(value: string): number
⋮----
function clampConstellationPoint(point:
⋮----
function clamp(value: number, min: number, max: number): number
⋮----
function wrapUnitInterval(value: number): number
```

## File: ExplorerChromeSurface.tsx
```typescript
import React, { useEffect, type CSSProperties } from 'react';
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeResolvedSurface,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';
⋮----
interface ExplorerChromeSurfaceProps {
  surface: ExplorerChromeResolvedSurface;
  style?: CSSProperties;
  getRowStyle?: (rowId: string) => CSSProperties | undefined;
  getZoneStyle?: (zoneId: ExplorerChromeZoneId) => CSSProperties | undefined;
  renderControl: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
  editMode?: {
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
⋮----
export function ExplorerChromeSurface({
  surface,
  style,
  getRowStyle,
  getZoneStyle,
  renderControl,
  editMode,
}: ExplorerChromeSurfaceProps)
⋮----
const renderDropTarget = (
    zoneId: ExplorerChromeZoneId,
    targetIndex: number,
) =>
onDragOver=
onDrop=
⋮----
style=
⋮----
if (!editModeActive || !editMode)
```

## File: explorerDirectoryCache.ts
```typescript
import type {
  ExplorerBackendContract,
  ExplorerLocationListing,
} from '../../runtime/explorerBackend';
⋮----
export function getExplorerDirectoryCacheKey(path: string, showHidden: boolean): string
⋮----
export async function loadCachedExplorerLocation(args: {
  path: string;
  showHidden: boolean;
  listLocation: ExplorerBackendContract['listLocation'];
  forceRefresh?: boolean;
}): Promise<ExplorerLocationListing>
⋮----
export function storeExplorerCachedLocation(args: {
  path: string;
  showHidden: boolean;
  listing: ExplorerLocationListing;
}): void
⋮----
export function invalidateExplorerDirectoryResultCaches(pathPrefix?: string): void
```

## File: explorerRailState.ts
```typescript
import {
  explorerBookmarkCategoryPresets,
  explorerBookmarkColorOptions,
  explorerRailSectionOrder,
  normalizeExplorerRailViewMode,
  type ExplorerRailSectionId,
  type ExplorerRailViewMode,
} from '../../config/explorerRail';
⋮----
export interface ExplorerBookmarkCategory {
  id: string;
  name: string;
  color: string;
  kind: 'custom';
  createdAt: number;
}
⋮----
export type ExplorerBookmarkTargetKind = 'directory' | 'file';
⋮----
interface ExplorerBookmarkNodeBase {
  id: string;
  kind: 'folder' | 'bookmark';
  parentId: string | null;
  name: string;
  color: string | null;
  categoryIds: string[];
  createdAt: number;
  updatedAt: number;
}
⋮----
export interface ExplorerBookmarkFolderNode extends ExplorerBookmarkNodeBase {
  kind: 'folder';
}
⋮----
export interface ExplorerBookmarkLeafNode extends ExplorerBookmarkNodeBase {
  kind: 'bookmark';
  path: string;
  targetKind: ExplorerBookmarkTargetKind;
}
⋮----
export type ExplorerBookmarkNode = ExplorerBookmarkFolderNode | ExplorerBookmarkLeafNode;
⋮----
export interface ExplorerRailSnapshot {
  customCategories: ExplorerBookmarkCategory[];
  nodes: ExplorerBookmarkNode[];
  collapsedSectionIds: ExplorerRailSectionId[];
  expandedFolderIds: string[];
  activeCategoryIds: string[];
  searchQuery: string;
  viewMode: ExplorerRailViewMode;
  autoExpandToOpenFolder: boolean;
}
⋮----
export interface ExplorerBookmarkTreeNode {
  node: ExplorerBookmarkNode;
  depth: number;
  children: ExplorerBookmarkTreeNode[];
  matchesFilter: boolean;
  containsMatch: boolean;
}
⋮----
export interface LegacyExplorerBookmark {
  id?: string;
  name?: string;
  path?: string;
}
⋮----
export interface ExplorerBookmarkImportSource {
  path: string;
  name: string;
  isDirectory: boolean;
  color?: string | null;
}
⋮----
export interface ExplorerBookmarkImportPlan {
  sources: ExplorerBookmarkImportSource[];
  suggestedMode: 'bookmark' | 'folder';
  suggestedParentId: string | null;
  suggestedCategoryIds: string[];
  suggestedColor: string | null;
  suggestedName: string;
  targetFolderId: string | null;
  note: string;
}
⋮----
export interface ExplorerRailFilterState {
  query: string;
  activeCategoryIds: string[];
}
⋮----
export function createDefaultExplorerRailSnapshot(): ExplorerRailSnapshot
⋮----
export function getAllExplorerBookmarkCategories(customCategories: ExplorerBookmarkCategory[])
⋮----
export function normalizeExplorerRailSnapshot(value: unknown): ExplorerRailSnapshot
⋮----
export function migrateLegacyExplorerBookmarks(legacyValue: unknown): ExplorerBookmarkNode[]
⋮----
export function isExplorerRailSectionCollapsed(snapshot: ExplorerRailSnapshot, sectionId: ExplorerRailSectionId): boolean
⋮----
export function toggleExplorerRailSection(snapshot: ExplorerRailSnapshot, sectionId: ExplorerRailSectionId): ExplorerRailSnapshot
⋮----
export function isExplorerBookmarkFolderExpanded(snapshot: ExplorerRailSnapshot, folderId: string): boolean
⋮----
export function toggleExplorerBookmarkFolder(snapshot: ExplorerRailSnapshot, folderId: string): ExplorerRailSnapshot
⋮----
export function setExplorerBookmarkSearchQuery(snapshot: ExplorerRailSnapshot, query: string): ExplorerRailSnapshot
⋮----
export function setExplorerRailViewMode(snapshot: ExplorerRailSnapshot, viewMode: ExplorerRailViewMode): ExplorerRailSnapshot
⋮----
export function setExplorerRailAutoExpandToOpenFolder(
  snapshot: ExplorerRailSnapshot,
  autoExpandToOpenFolder: boolean,
): ExplorerRailSnapshot
⋮----
export function toggleExplorerBookmarkCategoryFilter(snapshot: ExplorerRailSnapshot, categoryId: string): ExplorerRailSnapshot
⋮----
export function clearExplorerBookmarkCategoryFilters(snapshot: ExplorerRailSnapshot): ExplorerRailSnapshot
⋮----
export function createExplorerBookmarkFolder(
  snapshot: ExplorerRailSnapshot,
  options: { parentId?: string | null; name?: string; color?: string | null; categoryIds?: string[] } = {},
):
⋮----
export function renameExplorerBookmarkNode(snapshot: ExplorerRailSnapshot, nodeId: string, nextName: string): ExplorerRailSnapshot
⋮----
export function cycleExplorerBookmarkNodeColor(snapshot: ExplorerRailSnapshot, nodeId: string): ExplorerRailSnapshot
⋮----
export function removeExplorerBookmarkNode(snapshot: ExplorerRailSnapshot, nodeId: string): ExplorerRailSnapshot
⋮----
export function moveExplorerBookmarkNode(snapshot: ExplorerRailSnapshot, nodeId: string, parentId: string | null): ExplorerRailSnapshot
⋮----
export function createExplorerCustomCategory(
  snapshot: ExplorerRailSnapshot,
  name: string,
  color: string = explorerBookmarkColorOptions[0]?.value ?? '#7dd3fc',
):
⋮----
export function upsertExplorerBookmark(
  snapshot: ExplorerRailSnapshot,
  source: ExplorerBookmarkImportSource,
  options: {
    parentId?: string | null;
    categoryIds?: string[];
    color?: string | null;
  } = {},
):
⋮----
export function removeExplorerBookmarksByPath(snapshot: ExplorerRailSnapshot, path: string): ExplorerRailSnapshot
⋮----
export function planExplorerBookmarkImport(
  snapshot: ExplorerRailSnapshot,
  sources: ExplorerBookmarkImportSource[],
  targetFolderId: string | null,
): ExplorerBookmarkImportPlan | null
⋮----
export function applyExplorerBookmarkImportPlan(
  snapshot: ExplorerRailSnapshot,
  plan: ExplorerBookmarkImportPlan,
  mode: 'bookmark' | 'folder' = plan.suggestedMode,
):
⋮----
export function buildExplorerBookmarkTree(
  snapshot: ExplorerRailSnapshot,
  filters: ExplorerRailFilterState = {
    query: snapshot.searchQuery,
    activeCategoryIds: snapshot.activeCategoryIds,
  },
): ExplorerBookmarkTreeNode[]
⋮----
const buildChildren = (parentId: string | null, depth: number): ExplorerBookmarkTreeNode[] =>
⋮----
export function doesBookmarkNodeMatchFilters(node: ExplorerBookmarkNode, filters: ExplorerRailFilterState): boolean
⋮----
export function hasActiveExplorerFilters(filters: ExplorerRailFilterState): boolean
⋮----
export function inferBookmarkCategoryIds(
  source: { path: string; name: string; isDirectory: boolean },
  customCategories: ExplorerBookmarkCategory[],
): string[]
⋮----
export function suggestBookmarkColor(categoryIds: string[]): string | null
⋮----
function normalizeCustomCategory(value: unknown, now: number): ExplorerBookmarkCategory | null
⋮----
function normalizeNode(
  value: unknown,
  now: number,
  validCategoryIds: Set<string>,
): ExplorerBookmarkNode | null
⋮----
function compareBookmarkNodes(a: ExplorerBookmarkNode, b: ExplorerBookmarkNode): number
⋮----
function normalizeCategoryIds(categoryIds: string[]): string[]
⋮----
function collectDescendantIds(nodes: ExplorerBookmarkNode[], nodeId: string): string[]
⋮----
const visit = (parentId: string) =>
⋮----
function findSuggestedFolderParent(snapshot: ExplorerRailSnapshot, categoryIds: string[]): string | null
⋮----
function getLeafNameFromPath(path: string): string
⋮----
function isExplorerRailSectionId(value: unknown): value is ExplorerRailSectionId
⋮----
function createStableId(prefix: string): string
⋮----
function asRecord(value: unknown): Record<string, unknown> | null
```

## File: ExplorerSideRail.tsx
```typescript
import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
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
  setExplorerRailAutoExpandToOpenFolder,
  setExplorerBookmarkSearchQuery,
  setExplorerRailViewMode,
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
import { invalidateExplorerDirectoryResultCaches, loadCachedExplorerLocation } from './explorerDirectoryCache';
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
import {
  explorerRailViewModes,
  getExplorerRailViewModeDefinition,
  type ExplorerRailViewModeDefinition,
} from '../../config/explorerRail';
⋮----
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
  focusModeActive?: boolean;
  onOpenSavedSearch?: (savedSearch: ExplorerSavedSearch) => void;
  onDeleteSavedSearch?: (savedSearchId: string) => void;
  onToggleTagFilter?: (tagId: string) => void;
  onClearTagFilters?: () => void;
  onBookmarkCreated: (name: string, path: string) => void;
  onEnterFocusMode?: () => void;
  resolveDroppedSources: (paths: string[]) => ExplorerBookmarkImportSource[];
  localTreeRefreshRevision?: number;
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
⋮----
interface TreeRowProps {
  accent: string;
  compactTree: boolean;
  dense: boolean;
  viewMode: ExplorerRailViewModeDefinition;
  showSupportingMeta: boolean;
  treeIndentStep: number;
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
⋮----
type LocalFolderTreeLoadState = {
  childFolders: ExplorerFileEntry[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
};
⋮----
interface LocalFolderTreeRowProps {
  accent: string;
  compactTree: boolean;
  dense: boolean;
  viewMode: ExplorerRailViewModeDefinition;
  currentPath: string;
  path: string;
  depth: number;
  expandedFolderPaths: string[];
  folderChildrenByPath: Record<string, LocalFolderTreeLoadState>;
  showSupportingMeta: boolean;
  treeIndentStep: number;
  onNavigate: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onRetryLoad: (path: string) => void;
}
⋮----
const handleBookmarkDrop = (event: React.DragEvent, targetFolderId: string | null) =>
⋮----
const applyPlan = (mode: 'bookmark' | 'folder') =>
⋮----
const commitDraftFolder = () =>
⋮----
const commitDraftCategory = () =>
⋮----
const commitNodeRename = () =>
⋮----
setIsManageMode((current) =>
⋮----
style=
⋮----
<div style=

⋮----
setDraftFolderParentId(null);
setDraftFolderName('New Folder');
⋮----
<button type="button" onClick=
⋮----
event.preventDefault();
setDropTargetFolderId(null);
⋮----
onDragLeave=
⋮----
setDraftFolderParentId(parentId);
⋮----
setEditingNodeId(nodeId);
setEditingNodeName(nodeName);
setIsManageMode(true);
⋮----
event.stopPropagation();
setDropTargetFolderId(folderId);
⋮----
onDragLeaveFolder=
⋮----
onDragOver=
⋮----
onClick=
⋮----
onNavigate(row.node.path);
⋮----
<section style=
⋮----
if (relevantPaths.length === 0)
⋮----
if (allowedPaths.has(path))
```

## File: ExplorerTaskCenterContent.tsx
```typescript
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  XCircle,
} from 'lucide-react';
import {
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  openExplorerPath,
  restoreExplorerTrashAction,
  revealExplorerPath,
  type ExplorerTaskSnapshot,
} from '../../runtime/explorerBackend';
import {
  cancelExplorerTaskById,
  retryExplorerTaskById,
} from '../../store/explorerTaskStore';
⋮----
interface ExplorerTaskCenterContentProps {
  accent: string;
  border: string;
  danger: string;
  emptyMessage?: string;
  headerActions?: ReactNode;
  muted: string;
  tasks: ExplorerTaskSnapshot[];
  text: string;
  title?: string;
}
⋮----
export function getExplorerTaskSummary(task: ExplorerTaskSnapshot): string
⋮----
function TaskStatusIcon({
  task,
  accent,
  danger,
}: {
  accent: string;
  danger: string;
  task: ExplorerTaskSnapshot;
})
⋮----
onClick=
```

## File: ExplorerTaskStatusBadge.tsx
```typescript
import { useEffect, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Check,
  FolderOpen,
  LoaderCircle,
  X,
} from 'lucide-react';
import type { ExplorerTaskSnapshot } from '../../runtime/explorerBackend';
import { openFileOperationsWindow } from '../../runtime/fileOperationsWindow';
import {
  closeExplorerTaskCenter,
  toggleExplorerTaskCenter,
  useExplorerTaskCenterOpen,
  useExplorerTaskSnapshots,
} from '../../store/explorerTaskStore';
import {
  ExplorerTaskCenterContent,
  getExplorerTaskSummary,
} from './ExplorerTaskCenterContent';
⋮----
interface ExplorerTaskStatusBadgeProps {
  accent: string;
  background?: string;
  border: string;
  danger: string;
  muted: string;
  text: string;
}
⋮----
const handlePointerDown = (event: MouseEvent) =>
⋮----
void openFileOperationsWindow(
closeExplorerTaskCenter();
```

## File: ExplorerWorkspace.tsx
```typescript
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clipboard, CopyPlus, Plus, SquareSplitHorizontal, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import type { ResolvedOverlayAppearance } from '../../config/appearance';
import {
  moveExplorerChromeControlInResolvedSurfaces,
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlId,
  type ExplorerChromeControlDefinition,
  type ExplorerChromeResolvedControlPlacement,
  type ExplorerChromeSurfaceId,
  type ExplorerChromeZoneId,
} from '../../config/explorerChromeLayouts';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../../config/pluginContributions';
import type { ExplorerLayoutMode } from '../../config/layoutProfiles';
import {
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
} from '../../config/explorerModeProfiles';
import { resolveExplorerThemeRecipe } from '../../config/explorerTheme';
import {
  createEmptyExplorerPaneRecord,
  getExplorerPaneLabel,
  getExplorerWorkspaceLayoutDefinition,
  getExplorerWorkspaceVisiblePaneIds,
  type ExplorerPaneId,
  type ExplorerWorkspaceLayoutMode,
} from '../../config/explorerWorkspaceLayouts';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
  type ExplorerTabSnapshot,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { ExplorerChromeSurface } from './ExplorerChromeSurface';
import { FileExplorer } from '../FileExplorer';
import type {
  ExplorerWorkspaceNavigationRequest,
  ExplorerWorkspaceRefreshRequest,
  ExplorerWorkspaceRuntimeSelectionEntry,
  ExplorerWorkspaceRuntimeSnapshot,
  ExplorerWorkspaceSelectionTransferRequest,
  ExplorerWorkspaceSelectionTransferResult,
} from '../FileExplorer';
⋮----
interface ExplorerWorkspaceProps {
  theme: { accent: string; bg: string; bgPanel: string; text: string; border: string; textMuted: string };
  appearance?: ResolvedOverlayAppearance;
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium?: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void | Promise<void>;
  pluginActions?: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  layoutMode?: ExplorerLayoutMode;
  chromeControlSurface?: 'toolbar' | 'topbar';
  repositoryPicker?: {
    active: boolean;
    allowMultiple: boolean;
    requestId: number;
    onConfirm: (paths: string[]) => void;
    onCancel: () => void;
  } | null;
}
⋮----
function getPathLeaf(path: string): string
⋮----
function getPaneShortLabel(paneId: ExplorerPaneId): string
⋮----
function getTabDisplayLabel(tab: ExplorerTabSnapshot, currentPath: string): string
⋮----
function resolvePaneAccent(active: boolean): React.CSSProperties
⋮----
function getNextVisiblePaneId(
  visiblePaneIds: ExplorerPaneId[],
  paneId: ExplorerPaneId,
): ExplorerPaneId | null
⋮----
function sameSelectionEntry(
  left: ExplorerWorkspaceRuntimeSelectionEntry,
  right: ExplorerWorkspaceRuntimeSelectionEntry,
): boolean
⋮----
function sameRuntimeSnapshot(
  left: ExplorerWorkspaceRuntimeSnapshot | null | undefined,
  right: ExplorerWorkspaceRuntimeSnapshot,
): boolean
⋮----

⋮----
const onMouseMove = (moveEvent: MouseEvent) =>
const onMouseUp = () =>
```

## File: repositoryPickerState.ts
```typescript
export interface RepositoryPickerConfirmationArgs {
  allowMultiple: boolean;
  currentPath: string;
  hasAnySelection: boolean;
  selectedDirectoryPaths: string[];
}
⋮----
export function resolveRepositoryPickerConfirmationPaths({
  allowMultiple,
  currentPath,
  hasAnySelection,
  selectedDirectoryPaths,
}: RepositoryPickerConfirmationArgs): string[]
⋮----
export function getRepositoryPickerConfirmLabel(args: {
  allowMultiple: boolean;
  currentPath: string;
  hasAnySelection: boolean;
  selectedDirectoryCount: number;
}): string
⋮----
function sanitizeRepositoryPickerPaths(paths: string[]): string[]
```
