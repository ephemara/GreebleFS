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
assets/
  react.svg
components/
  explorer/
    constellationLayout.ts
    ExplorerChromeSurface.tsx
    explorerDirectoryCache.ts
    explorerRailState.ts
    ExplorerSideRail.tsx
    ExplorerTaskCenterContent.tsx
    ExplorerTaskStatusBadge.tsx
    ExplorerWorkspace.tsx
    repo-map.md
    repositoryPickerState.ts
  animationRuntime.tsx
  AppModal.tsx
  CommandPalette.tsx
  DevPerformanceHud.tsx
  documentPreview.tsx
  ExplorerAudioWorkbench.tsx
  explorerBatchRename.ts
  explorerChecksums.ts
  ExplorerImageEditor.tsx
  explorerJumpFilter.ts
  ExplorerVideoEditor.tsx
  FileExplorer.tsx
  fileExplorerClickBehavior.ts
  fileExplorerSearchFocus.ts
  fileExplorerSearchScope.ts
  GitManager.tsx
  gitManager.utils.ts
  ModelPreview.tsx
  modelPreview.utils.ts
  NotesManager.tsx
  OverlayScrollArea.tsx
  panelUtils.ts
  pluginRuntime.tsx
  PluginsManager.tsx
  ResizablePane.tsx
  ScreenshotsManager.tsx
  screenshotsUtils.ts
  SettingsPage.tsx
  shaderRuntime.tsx
  terminalCommandUtils.ts
  TerminalOverlay.tsx
  terminalPaneLayout.ts
  themeRendererRuntime.tsx
  themeRendererShellModel.ts
  wallpaperRuntime.tsx
  WindowControls.tsx
  WorkbenchNavigationSurface.tsx
config/
  animations.ts
  appContentDirectories.ts
  appearance.ts
  canonicalIconTheme.json
  explorerArchives.ts
  explorerChromeLayouts.ts
  explorerContextMenu.ts
  explorerExperimentalModes.ts
  explorerModeProfiles.ts
  explorerRail.ts
  explorerShellLayouts.ts
  explorerTheme.ts
  explorerThumbnails.ts
  explorerViewModes.ts
  explorerWorkspaceLayouts.ts
  filePreview.ts
  folderIcons.ts
  frameTelemetry.ts
  hotkeys.ts
  iconTheme.ts
  layoutProfiles.ts
  nativeIcons.ts
  notes.ts
  overlayAnimations.ts
  overlayWindow.ts
  performanceTelemetry.ts
  pilotThemeContract.ts
  platform.ts
  pluginContributions.ts
  pluginPackages.ts
  plugins.ts
  python.ts
  runtimeAssetPolling.ts
  runtimeCachePolicy.ts
  screenshots.ts
  searchTelemetry.ts
  shaders.ts
  shellBlueprints.ts
  themeCatalogCuration.ts
  themeEngineBindings.ts
  themePackages.ts
  wallpapers.ts
  workbenchPresets.ts
  workbenchRenderRuntime.ts
  workbenchTheme.ts
contracts/
  themeEngine.ts
generated/
  tauri.ts
input/
  GlobalShortcuts.ts
panels/
  panelRegistry.tsx
runtime/
  audioWorkbenchBackend.ts
  documentInteractionGuards.ts
  explorerBackend.ts
  fileOperationsWindow.ts
  filesystemAquariumBridge.ts
  globalErrorPanel.ts
  imageEditorRuntime.ts
  moduleRuntime.ts
  moduleRuntime.worker.ts
  moduleRuntimeCore.ts
  overlayRuntimeUtils.ts
  pluginPanelRequests.ts
  tauriClient.ts
  themeEngineBackend.ts
  useFolderPluginRuntime.ts
  videoEditorBackend.ts
  windowHost.ts
  workerHost.ts
store/
  audioEngineStore.ts
  explorerStore.ts
  explorerTaskStore.ts
  settingsStore.ts
  terminalStore.ts
test/
  browser/
    animationRuntime.browser.test.tsx
    fileExplorer.latency.browser.test.tsx
    fileExplorer.repositoryPicker.browser.test.tsx
    shaderRuntime.browser.test.tsx
  browser-proof/
    mocks/
      appTauriCore.ts
      appTauriWindow.ts
      globalShortcut.ts
      monacoReact.tsx
      notification.ts
      opener.ts
      pluginFs.ts
      pluginStore.ts
      shell.ts
      tauriCore.ts
      tauriEvent.ts
      tauriWindow.ts
    fileExplorer.repositoryPicker.fixtureData.ts
    fileExplorer.repositoryPicker.page.tsx
  helpers/
    runtimeFixtures.tsx
  animationRuntime.boundary.test.tsx
  animationRuntime.edge.test.ts
  animationRuntime.test.ts
  app.dockMode.test.tsx
  appContentDirectories.test.ts
  appearance.test.ts
  browser.setup.ts
  commandPalette.test.tsx
  constellationLayout.test.ts
  documentInteractionGuards.test.ts
  documentPreview.test.tsx
  explorerArchives.test.ts
  explorerAudioWorkbench.test.tsx
  explorerBackend.bindings.test.ts
  explorerBatchRename.test.ts
  explorerChromeLayouts.test.ts
  explorerContextMenu.test.ts
  explorerExperimentalModes.test.ts
  explorerImageEditor.test.tsx
  explorerMetadata.test.ts
  explorerRail.performance.test.ts
  explorerRailState.test.ts
  explorerSideRail.test.tsx
  explorerStore.test.ts
  explorerTaskStore.test.tsx
  explorerTheme.test.ts
  explorerThumbnails.test.ts
  explorerVideoEditor.test.tsx
  explorerViewModes.test.ts
  ExplorerWorkspace.test.tsx
  fileExplorer.searchTelemetry.test.tsx
  fileExplorer.utils.test.ts
  fileExplorer.viewModes.test.tsx
  fileExplorerClickBehavior.test.ts
  fileExplorerSearchFocus.edge.test.ts
  fileExplorerSearchFocus.test.ts
  fileExplorerSearchScope.test.ts
  fileOperationsWindow.test.ts
  filePreview.test.ts
  filesystemAquariumBridge.test.ts
  folderIcons.test.ts
  frameTelemetry.test.ts
  gitManager.behavior.test.tsx
  gitManager.utils.test.ts
  globalErrorPanel.test.ts
  globalShortcuts.test.tsx
  hotkeys.test.ts
  layoutProfiles.edge.test.ts
  layoutProfiles.test.ts
  modelPreview.utils.test.ts
  moduleRuntime.workerBridge.test.ts
  notesConfig.test.ts
  overlayAnimations.test.ts
  overlayScrollArea.test.tsx
  overlayWindow.test.ts
  panelRegistry.test.tsx
  panelUtils.test.ts
  performanceTelemetry.test.ts
  platform.test.ts
  pluginContributions.test.ts
  pluginPackages.test.ts
  pluginPanelRequests.test.ts
  pluginRuntime.edge.test.ts
  pluginRuntime.test.ts
  pluginsManager.test.tsx
  pluginWatchPaths.test.ts
  pythonConfig.test.ts
  repositoryPickerState.test.ts
  resizablePane.test.tsx
  runPlatformTauri.test.ts
  runtimeCachePolicy.test.ts
  screenshotsManager.test.tsx
  screenshotsUtils.test.ts
  searchTelemetry.test.ts
  settingsPage.behavior.test.tsx
  settingsPage.shaders.test.tsx
  settingsStore.test.ts
  setup.tsx
  shaderRuntime.boundary.test.tsx
  shaderRuntime.edge.test.ts
  shaderRuntime.test.ts
  shaderSystem.test.ts
  sourceRepositoryImportFlow.integration.test.tsx
  terminalCommandUtils.test.ts
  terminalOverlay.test.tsx
  terminalPaneLayout.test.ts
  terminalStore.test.ts
  themeCatalogCuration.test.ts
  themeEngineBackend.test.ts
  themeEngineCatalog.regression.test.ts
  themePackageExplorerRecipe.test.ts
  themePackages.inheritance.test.ts
  themePackages.test.ts
  themeRendererCatalogContract.test.ts
  themeRendererPackages.test.ts
  themeRendererRuntime.test.tsx
  themeRendererShellModel.test.ts
  useFolderPluginRuntime.fallback.test.tsx
  useFolderPluginRuntime.queue.test.tsx
  useFolderPluginRuntime.test.tsx
  vibeCapsule.pluginPackage.test.ts
  wallpaperRuntime.test.ts
  WindowControls.test.tsx
  workbenchPresets.test.ts
  workbenchPresetThemes.test.ts
  workbenchRenderRuntime.test.ts
  workbenchTheme.test.ts
types/
  imgEditorRuntime.d.ts
windows/
  FileOperationsWindowApp.tsx
App.css
App.tsx
index.css
main.tsx
vite-env.d.ts
```

# Files

## File: assets/react.svg
````xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Zm-6.365 70.984c-1.4.463-2.836.91-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14Zm-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a156.726 156.726 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345a134.17 134.17 0 0 1 1.386 6.193ZM87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a156.923 156.923 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a134.668 134.668 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94ZM50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a134.718 134.718 0 0 1-6.318-1.979Zm12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144.318 144.318 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160.342 160.342 0 0 1-1.76-7.887Zm110.427 27.268a347.8 347.8 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381.151 381.151 0 0 0-7.365-13.322Zm-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322.04 322.04 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18ZM82.802 87.83a323.167 323.167 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a321.524 321.524 0 0 0-7.848 12.897Zm8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321.187 321.187 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147Zm37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486Zm52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382.417 382.417 0 0 0 7.859-13.026a347.403 347.403 0 0 0 7.425-13.565Zm-16.898 8.101a358.557 358.557 0 0 1-12.281 19.815a329.4 329.4 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310.202 310.202 0 0 1-12.513-19.846h.001a307.41 307.41 0 0 1-10.923-20.627a310.278 310.278 0 0 1 10.89-20.637l-.001.001a307.318 307.318 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329.357 329.357 0 0 1 12.335 19.695a358.489 358.489 0 0 1 11.036 20.54a329.472 329.472 0 0 1-11 20.722Zm22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026c-.344 1.668-.73 3.367-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a160.789 160.789 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3ZM128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86Z"></path></svg>
````

## File: components/explorer/constellationLayout.ts
````typescript
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
````

## File: components/explorer/ExplorerChromeSurface.tsx
````typescript
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
````

## File: components/explorer/explorerDirectoryCache.ts
````typescript
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
````

## File: components/explorer/explorerRailState.ts
````typescript
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
````

## File: components/explorer/ExplorerSideRail.tsx
````typescript
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
````

## File: components/explorer/ExplorerTaskCenterContent.tsx
````typescript
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
````

## File: components/explorer/ExplorerTaskStatusBadge.tsx
````typescript
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
````

## File: components/explorer/ExplorerWorkspace.tsx
````typescript
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
````

## File: components/explorer/repo-map.md
````markdown
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
````

## File: components/explorer/repositoryPickerState.ts
````typescript
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
````

## File: components/animationRuntime.tsx
````typescript
import React, { type CSSProperties } from 'react';
⋮----
import type { OverlayThemeDefinition } from '../config/appearance';
import { animationSystemConfig } from '../config/animations';
import {
  getOverlayAnimationStyle,
  getOverlayEffectStyle,
  overlayAnimationPresets,
  type OverlayAnimationDirection,
  type OverlayAnimationPhase,
  type OverlayAnimationPreset,
  type OverlayAnimationVerticalOrigin,
} from '../config/overlayAnimations';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
⋮----
export interface AnimationFileEntry extends RuntimeFileEntry {}
⋮----
export type OverlayAnimationSource = 'built-in' | 'folder';
⋮----
export interface OverlayAnimationContext {
  id: string;
  name: string;
  filePath: string;
  animationRoot: string;
  source: OverlayAnimationSource;
}
⋮----
export interface OverlayAnimationRenderContext {
  animation: OverlayAnimationContext;
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  progress: number;
  durationMs: number;
  baseOpacity: number;
  intensity: number;
  verticalOrigin: OverlayAnimationVerticalOrigin;
  accentColor: string;
  blurStrength: number;
  zoom: number;
  theme: OverlayThemeDefinition;
  viewport: {
    width: number;
    height: number;
    anchoredTo: OverlayAnimationVerticalOrigin;
  };
}
⋮----
export interface OverlayAnimationOverlayProps {
  context: OverlayAnimationRenderContext;
}
⋮----
export interface OverlayAnimationVariantDefinition {
  durationMs?: number;
  resolveShellStyle?: (context: OverlayAnimationRenderContext) => CSSProperties | null | undefined;
  renderOverlay?: React.ComponentType<OverlayAnimationOverlayProps>;
}
⋮----
export interface OverlayAnimationDefinition {
  id?: string;
  name?: string;
  description?: string;
  group?: string;
  tags?: string[];
  open?: OverlayAnimationVariantDefinition;
  close?: OverlayAnimationVariantDefinition;
}
⋮----
export interface LoadedOverlayAnimation extends OverlayAnimationContext {
  modified: number;
  description?: string;
  group: string;
  tags: string[];
  open: OverlayAnimationVariantDefinition | null;
  close: OverlayAnimationVariantDefinition | null;
  error: string | null;
}
⋮----
export interface LoadAnimationFromSourceOptions {
  context?: Partial<OverlayAnimationContext>;
}
⋮----
export function defineAnimation(definition: OverlayAnimationDefinition): OverlayAnimationDefinition
⋮----
export function clamp01(value: number): number
⋮----
export function lerp(from: number, to: number, progress: number): number
⋮----
export function useAnimationContextRef<T>(value: T): React.MutableRefObject<T>
⋮----
export function isFrontendAnimationFile(entry: AnimationFileEntry): boolean
⋮----
export function deriveAnimationId(name: string): string
⋮----
export function deriveAnimationName(name: string): string
⋮----
export async function loadAnimationFromSource(
  source: string,
  entry: AnimationFileEntry,
  options?: LoadAnimationFromSourceOptions,
): Promise<LoadedOverlayAnimation>
⋮----
export function createBuiltInOverlayAnimations(): LoadedOverlayAnimation[]
⋮----
export function mergeOverlayAnimations(
  builtInAnimations: LoadedOverlayAnimation[],
  authoredAnimations: LoadedOverlayAnimation[],
): LoadedOverlayAnimation[]
⋮----
export function resolveAnimationVariant(
  animation: LoadedOverlayAnimation,
  direction: OverlayAnimationDirection,
): OverlayAnimationVariantDefinition | null
⋮----
export function resolveAnimationDurationMs(
  animation: LoadedOverlayAnimation | null,
  direction: OverlayAnimationDirection,
  fallbackDurationMs: number,
): number
⋮----
export function resolveAnimationShellStyle(
  animation: LoadedOverlayAnimation | null,
  context: OverlayAnimationRenderContext,
): CSSProperties
⋮----
export function AnimationOverlayLayer({
  animation,
  context,
}: {
  animation: LoadedOverlayAnimation | null;
  context: OverlayAnimationRenderContext;
})
⋮----
function createBuiltInAnimationVariant(
  preset: OverlayAnimationPreset,
): OverlayAnimationVariantDefinition
⋮----
const BuiltInEffectLayer = (
⋮----
function executeAnimationModule(code: string): unknown
⋮----
function normalizeAnimationExport(
  exported: unknown,
  fallbackContext: OverlayAnimationContext,
): OverlayAnimationDefinition
⋮----
function normalizeVariant(
  variant: OverlayAnimationVariantDefinition | undefined,
  label: 'open' | 'close',
): OverlayAnimationVariantDefinition | null
⋮----
class AnimationOverlayBoundary extends React.Component<
⋮----
constructor(props:
⋮----
static getDerivedStateFromError():
⋮----
override componentDidCatch(error: unknown)
⋮----
override componentDidUpdate(prevProps:
⋮----
override render()
````

## File: components/AppModal.tsx
````typescript
import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
⋮----
type AppDialogTone = 'accent' | 'danger';
⋮----
interface AppDialogFrameProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  width?: number | string;
  onClose?: () => void;
  closeOnBackdrop?: boolean;
}
⋮----
interface AppPromptDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  value: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  tone?: AppDialogTone;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}
⋮----
interface AppConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AppDialogTone;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}
⋮----
````

## File: components/CommandPalette.tsx
````typescript
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { OverlayScrollArea } from './OverlayScrollArea';
⋮----
export interface OverlayCommandPaletteAction {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  keywords?: string[];
  badge?: string;
  onSelect: () => void | Promise<void>;
}
⋮----
const handler = (event: KeyboardEvent) =>
````

## File: components/DevPerformanceHud.tsx
````typescript
import { useEffect, useRef, useState } from 'react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { OverlayFrameTelemetryStats } from '../config/frameTelemetry';
import {
  readFrontendWorkerTelemetrySnapshot,
  subscribeFrontendWorkerTelemetry,
  type FrontendWorkerTelemetrySnapshot,
} from '../runtime/workerHost';
⋮----
interface DevPerformanceHudSnapshot {
  navigationMs: number | null;
  longTaskCount: number;
  longTaskDurationMs: number | null;
  firstInputDelayMs: number | null;
  inpMs: number | null;
  cls: number | null;
  memoryUsedMb: number | null;
  memoryLimitMb: number | null;
  workerActiveTaskCount: number;
  workerFallbackCount: number;
  workerErrorCount: number;
  workerLastDurationMs: number | null;
}
⋮----
interface DevPerformanceHudProps {
  enabled: boolean;
  appearance: ResolvedOverlayAppearance;
  activePanelLabel: string;
  openPanelCount: number;
  frameStats: OverlayFrameTelemetryStats | null;
}
⋮----
const applyWorkerSnapshot = (workerSnapshot: FrontendWorkerTelemetrySnapshot) =>
````

## File: components/documentPreview.tsx
````typescript
import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
⋮----
export type DocumentPreviewKind = 'none' | 'markdown' | 'html';
⋮----
export function getDocumentPreviewKind(path: string): DocumentPreviewKind
⋮----
export function renderDocumentPreviewHtml(kind: DocumentPreviewKind, content: string): string
````

## File: components/ExplorerAudioWorkbench.tsx
````typescript
import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  AudioLines,
  Pause,
  Play,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  EXPLORER_AUDIO_EXPORT_FORMATS,
  getExplorerAudioExportFormatDefinition,
} from '../config/filePreview';
import {
  analyzeExplorerAudioPreview,
  exportExplorerAudioTransform,
  type ExplorerAudioPreviewAnalysis,
} from '../runtime/audioWorkbenchBackend';
import {
  getAudioDeckState,
  loadSelectionIntoAudioDeck,
  pauseAudioDeck,
  playAudioDeck,
  seekAudioDeck,
  setAudioDeckGain,
  setAudioDeckLoopRegion,
  setAudioDeckRate,
  stopAudioDeck,
  useAudioEngineFeed,
  useAudioEngineSnapshot,
} from '../store/audioEngineStore';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';
⋮----
type ExplorerAudioWorkbenchProps = {
  audioPath: string;
  audioName: string;
  audioExtension: string;
  audioSize: number;
  onExported?: (outputPath: string) => Promise<void> | void;
};
⋮----
type ExportDialogMode = 'clip' | 'normalized' | 'convert' | 'overwrite' | null;
type TimelineDragMode = 'playhead' | 'selectionStart' | 'selectionEnd';
type ExportState = 'idle' | 'running' | 'saved' | 'error';
⋮----
function clamp(value: number, min: number, max: number): number
⋮----
function formatDuration(seconds: number): string
⋮----
function formatDb(value: number | null | undefined): string
⋮----
function formatSize(bytes: number): string
⋮----
function buildAudioOutputPath(
  sourcePath: string,
  suffix: string,
  extension: string,
): string
⋮----
function toolbarButtonStyle(
  emphasis: 'default' | 'primary' | 'danger' = 'default',
): CSSProperties
⋮----
function metricCardStyle(): CSSProperties
⋮----
function syncPlayhead(nextTime: number)
⋮----
function updateSelection(nextStart: number, nextEnd: number)
⋮----
function resolveTimeFromClientX(clientX: number): number
⋮----
function beginTimelineDrag(mode: TimelineDragMode, clientX: number)
⋮----
const applyTime = (nextTime: number) =>
⋮----
const handlePointerMove = (event: MouseEvent)
const handlePointerUp = () =>
⋮----
async function togglePreviewDeckPlayback()
⋮----
async function clearLoopRegion()
⋮----
async function handleStopPlayback()
⋮----
async function handleGainChange(value: number)
⋮----
async function handleRateChange(value: number)
⋮----
function openExportDialog(mode: Exclude<ExportDialogMode, null>)
⋮----
async function submitExport(mode: Exclude<ExportDialogMode, null>)
⋮----
async function submitOverwriteOriginal()
⋮----
<div style=
⋮----

⋮----
onClick=
⋮----
onConfirm=
````

## File: components/explorerBatchRename.ts
````typescript
import type { ExplorerFileEntry } from '../runtime/explorerBackend';
⋮----
export type ExplorerBatchRenameMode = 'literal' | 'regex';
⋮----
export interface ExplorerBatchRenameRecipe {
  mode: ExplorerBatchRenameMode;
  findText: string;
  replaceText: string;
  prefix: string;
  suffix: string;
  startingNumber: number;
  padding: number;
}
⋮----
export interface ExplorerBatchRenamePreviewRow {
  sourcePath: string;
  currentName: string;
  nextName: string;
  destinationPath: string;
  collision: boolean;
  validationError: string | null;
}
⋮----
export interface ExplorerBatchRenamePreviewResult {
  rows: ExplorerBatchRenamePreviewRow[];
  validationError: string | null;
}
⋮----
interface SplitEntryName {
  stem: string;
  extension: string;
}
⋮----
export function buildExplorerBatchRenamePreview(
  entries: ExplorerFileEntry[],
  recipe: ExplorerBatchRenameRecipe,
): ExplorerBatchRenamePreviewResult
⋮----
function validateBatchRenameRecipe(recipe: ExplorerBatchRenameRecipe): string | null
⋮----
// Use the same matcher for preview and apply so the preview stays exact.
⋮----
function applyRenameTransform(stem: string, recipe: ExplorerBatchRenameRecipe): string
⋮----
function applyRenameTokens(
  value: string,
  context: { date: string; index: string; parent: string },
): string
⋮----
function formatLocalDateToken(date: Date): string
⋮----
function formatSequenceNumber(value: number, padding: number): string
⋮----
function normalizeRegexReplacement(value: string): string
⋮----
function splitEntryName(name: string): SplitEntryName
⋮----
function getPathParent(path: string): string
⋮----
function getPathLeaf(path: string): string
⋮----
function joinPath(parentPath: string, leafName: string): string
````

## File: components/explorerChecksums.ts
````typescript
export interface ExplorerChecksumResult {
  md5: string;
  sha256: string;
}
⋮----
export async function calculateExplorerChecksumsFromBase64(base64: string): Promise<ExplorerChecksumResult>
⋮----
function base64ToBytes(base64: string): Uint8Array
⋮----
async function digestSha256(bytes: Uint8Array): Promise<string>
⋮----
function digestMd5(bytes: Uint8Array): string
⋮----
function md5Round(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  ac: number,
  round: number,
  extra: number = 0,
): number
⋮----
function addUnsigned(left: number, right: number): number
⋮----
function rotateLeft(value: number, bits: number): number
⋮----
function bytesToMd5Words(bytes: Uint8Array): number[]
⋮----
function wordsToBytes(words: number[]): Uint8Array
⋮----
function bytesToHex(bytes: Uint8Array): string
````

## File: components/ExplorerImageEditor.tsx
````typescript
import { useEffect, useId, useRef, useState } from 'react';
import {
  Circle,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import { writeExplorerFile } from '../runtime/explorerBackend';
import {
  initExplorerImageEditor,
  type ExplorerImageEditorHandle,
} from '../runtime/imageEditorRuntime';
⋮----
type ExplorerImageEditorProps = {
  imagePath: string;
  imageName: string;
  imageSource: string;
  onSaved?: () => Promise<void> | void;
};
⋮----
type ImageEditorSaveState = 'loading' | 'saved' | 'dirty' | 'saving' | 'error';
⋮----
function getImageExtension(name: string): string
⋮----
function getImageEditorContentType(name: string): string | null
⋮----
function cloneEditorState<T>(state: T): T
⋮----
async function blobToByteArray(blob: Blob): Promise<number[]>
⋮----
function toolbarButtonStyle(variant: 'primary' | 'default' | 'danger' = 'default')
⋮----
function clearSaveResetTimer()
⋮----
function scheduleSavedStateReset()
⋮----
function updateDirtyState(editorOverride?: ExplorerImageEditorHandle | null)
⋮----
const syncDirtyState = ()
⋮----
async function handleSave()
⋮----
async function handleReset()
⋮----
async function handleUndo()
⋮----
async function handleRedo()
⋮----
async function handleAddText()
⋮----
async function handleAddSquare()
⋮----
async function handleAddCircle()
⋮----
function handleDeleteSelection()
⋮----
function handleZoomIn()
⋮----
function handleResetZoom()
⋮----
<button type="button" onClick=
````

## File: components/explorerJumpFilter.ts
````typescript
import type { ExplorerFileEntry } from '../runtime/explorerBackend';
⋮----
export interface ExplorerJumpFilterState {
  query: string;
  active: boolean;
  resultIndex: number;
}
⋮----
export interface ExplorerJumpFilterMatch {
  entry: ExplorerFileEntry;
  score: number;
  originalIndex: number;
}
⋮----
export function isExplorerJumpFilterPrintableKey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean
⋮----
export function appendExplorerJumpFilterCharacter(query: string, key: string): string
⋮----
export function removeExplorerJumpFilterCharacter(query: string): string
⋮----
export function filterExplorerEntriesForJump(
  entries: ExplorerFileEntry[],
  query: string,
): ExplorerFileEntry[]
⋮----
function scoreExplorerJumpEntry(entry: ExplorerFileEntry, query: string): number | null
⋮----
function scoreFuzzyText(value: string, query: string): number | null
````

## File: components/ExplorerVideoEditor.tsx
````typescript
import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Clapperboard,
  Pause,
  Play,
  RotateCcw,
  Save,
  Scissors,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { AppPromptDialog } from './AppModal';
import {
  createExplorerVideoPreviewProxy,
  exportExplorerVideoTrim,
  resolveExplorerVideoPreviewSource,
  type ExplorerVideoPreviewSource,
} from '../runtime/videoEditorBackend';
⋮----
type ExplorerVideoEditorProps = {
  videoPath: string;
  videoName: string;
  videoSource: string;
  videoExtension: string;
  videoMimeType: string | null;
  videoSize: number;
  onExported?: (outputPath: string) => Promise<void> | void;
};
⋮----
type VideoExportState = 'idle' | 'exporting' | 'saved' | 'error';
type TimelineDragMode = 'playhead' | 'trimStart' | 'trimEnd';
⋮----
function clamp(value: number, min: number, max: number): number
⋮----
function formatTimelineTimestamp(seconds: number): string
⋮----
function formatSize(bytes: number): string
⋮----
function getVideoPlaybackErrorLabel(videoError: MediaError | null): string
⋮----
function buildVideoPlaybackUrl(sourcePath: string): string
⋮----
export function buildTrimmedVideoOutputPath(sourcePath: string): string
⋮----
function buildTimelineTicks(duration: number): number[]
⋮----
function toolbarButtonStyle(active = false, emphasis: 'default' | 'primary' = 'default'): CSSProperties
⋮----
async function loadPreviewSource()
⋮----
async function ensurePlaybackProxy()
⋮----
function syncCurrentTime(nextTime: number)
⋮----
function updateTrimRange(nextStart: number, nextEnd: number)
⋮----
function resolveTimeFromClientX(clientX: number): number
⋮----
function beginTimelineDrag(mode: TimelineDragMode, clientX: number)
⋮----
const applyTime = (nextTime: number) =>
⋮----
const handlePointerMove = (event: MouseEvent) =>
const handlePointerUp = () =>
⋮----
async function togglePlayback()
⋮----
async function submitExport()
⋮----
onPause=
⋮----
onError=
⋮----
<source src=
⋮----
event.stopPropagation();
beginTimelineDrag('trimStart', event.clientX);
⋮----
placeholder=
⋮----
void submitExport();
⋮----
onCancel=
````

## File: components/FileExplorer.tsx
````typescript
/**
 * FileExplorer — UE5-feel file explorer
 *
 * v2 changes vs v1:
 *  ✓ Theme-aware SVG icon system with canonical file and folder ids
 *  ✓ Ctrl+C / Ctrl+V system clipboard (navigator.clipboard)
 *  ✓ Resizable preview pane (drag handle)
 *  ✓ Images loaded via fs_read_file_base64 (data-URI) — no asset-protocol issues
 */
⋮----
import React, {
  Suspense, startTransition, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useId, type CSSProperties,
} from 'react';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useShallow } from 'zustand/react/shallow';
import type { EditorProps as MonacoEditorProps } from '@monaco-editor/react';
import {
  ChevronRight, ChevronLeft, ArrowUp, Search, RefreshCw,
  X, Star, StarOff, Terminal,
  Trash2, Copy, Scissors, Clipboard, Edit3, ExternalLink,
  Shield, Eye, Info, Loader, Puzzle, Sparkles,
  Waves, FilePlus, FolderPlus, CopyPlus, Save, Tags, Undo2, AlertTriangle,
} from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  createLegacyExplorerActionContextMenuContributions,
  isExplorerContextMenuItemEnabled,
  normalizePluginContextMenuContributions,
  sortExplorerContextMenuItems,
  type ExplorerContextMenuItemGroup,
} from '../config/explorerContextMenu';
import {
  getExplorerArchiveExtractToFolderLabel,
  isExplorerArchiveEntry,
} from '../config/explorerArchives';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import { getExplorerRailWidthBounds } from '../config/explorerRail';
import {
  explorerExperimentalModes,
  getAdaptiveSemanticDensityPercent,
  getAdaptiveSemanticDensityStop,
  getExplorerExperimentalDensityDescriptor,
  getExplorerExperimentalModeDefinition,
  stepAdaptiveSemanticDensity,
  type AdaptiveSemanticDensityStopDefinition,
  type ExplorerExperimentalViewMode,
} from '../config/explorerExperimentalModes';
import {
  EXPLORER_PREVIEW_WIDTH_BOUNDS,
  getExplorerShellLayoutDefinition,
  getExplorerShellLayoutWidthSuggestion,
  type ExplorerShellLayoutDefinition,
} from '../config/explorerShellLayouts';
import {
  applyExplorerThemeToAdaptiveDensityStop,
  applyExplorerThemeToGridMetrics,
  applyExplorerThemeToRowMetrics,
  resolveExplorerThemeRecipe,
  type ResolvedExplorerThemeRecipe,
} from '../config/explorerTheme';
import {
  explorerModeProfiles,
  getExplorerModeProfileDefinition,
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
  type ExplorerModeProfileDefinition,
} from '../config/explorerModeProfiles';
import { getFolderIconSrc, resolveFolderIcon } from '../config/folderIcons';
import { getBuiltInIconTheme, resolveFileIcon, resolveFileIconSrc, resolveIconSrc } from '../config/iconTheme';
import type { ExplorerLayoutMode } from '../config/layoutProfiles';
import {
  getAdjacentExplorerGridMode,
  getExplorerGridMetricsForZoom,
  getExplorerGridZoomAnchor,
  getExplorerGridZoomPercent,
  explorerViewModes,
  getExplorerViewModeDefinition,
  isExplorerGridMode,
  resolveEffectiveExplorerViewMode,
  stepExplorerGridZoom,
  stepExplorerViewMode,
  type ExplorerViewModeDefinition,
} from '../config/explorerViewModes';
import { matchesKeybinding } from '../config/hotkeys';
import {
  DEFAULT_NATIVE_ICON_SIZE,
  getNativeIconCacheKey,
  type OverlayNativeIconRequest,
} from '../config/nativeIcons';
import {
  detectClientPlatform,
  getFallbackExplorerPath,
  getPlatformPathSeparator,
  joinPlatformPath,
  type RuntimePlatform,
} from '../config/platform';
import { pluginSystemConfig } from '../config/plugins';
import {
  requestPluginPanelOpen,
} from '../runtime/pluginPanelRequests';
import {
  listenToFileOperationsTransferCompleted,
  openFileOperationsWindow,
  publishFileOperationsTransferCompleted,
  type FileOperationsTransferCompletedEventDetail,
} from '../runtime/fileOperationsWindow';
import {
  recordExplorerPerformanceSample,
  type ExplorerPerformanceMetadata,
  type ExplorerPerformanceMetricId,
} from '../config/performanceTelemetry';
import {
  finalizePendingExplorerMetricSamples,
  getRuntimeCachePolicyTelemetryMetadata,
  type PendingExplorerMetricSample,
  type RuntimeCachePolicyTelemetryMetadata,
} from '../config/runtimeCachePolicy';
import {
  getExplorerSearchTelemetryMetadata,
} from '../config/searchTelemetry';
import { OverlayScrollArea } from './OverlayScrollArea';
import { AppPromptDialog } from './AppModal';
import { ExplorerAudioWorkbench } from './ExplorerAudioWorkbench';
import { ExplorerImageEditor } from './ExplorerImageEditor';
import { ExplorerVideoEditor } from './ExplorerVideoEditor';
import {
  type ExplorerBatchRenameMode,
  type ExplorerBatchRenamePreviewRow,
} from './explorerBatchRename';
import {
  appendExplorerJumpFilterCharacter,
  isExplorerJumpFilterPrintableKey,
  removeExplorerJumpFilterCharacter,
} from './explorerJumpFilter';
import { ExplorerSideRail } from './explorer/ExplorerSideRail';
import { ExplorerChromeSurface } from './explorer/ExplorerChromeSurface';
import {
  buildConstellationOrbitBands,
  type ConstellationOrbitBand,
} from './explorer/constellationLayout';
import { ExplorerTaskStatusBadge } from './explorer/ExplorerTaskStatusBadge';
import {
  invalidateExplorerDirectoryResultCaches,
  loadCachedExplorerLocation,
  storeExplorerCachedLocation,
} from './explorer/explorerDirectoryCache';
import { removeExplorerBookmarksByPath, upsertExplorerBookmark } from './explorer/explorerRailState';
import {
  getRepositoryPickerConfirmLabel,
  resolveRepositoryPickerConfirmationPaths,
} from './explorer/repositoryPickerState';
import { ResizablePane } from './ResizablePane';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
  type ExplorerDocumentViewMode,
  type ExplorerInstanceId,
  type ExplorerPropertiesPanelSnapshot,
  type ExplorerPropertiesPanelTab,
  type ExplorerRecursiveSizeCacheEntry,
} from '../store/explorerStore';
import {
  useExplorerTaskProgressFeed,
} from '../store/explorerTaskStore';
import { useSettingsStore } from '../store/settingsStore';
import { shouldOpenExplorerEntryOnTrigger } from './fileExplorerClickBehavior';
import { resolveExplorerSearchScope } from './fileExplorerSearchScope';
import type { DocumentPreviewKind } from './documentPreview';
import {
  getAudioPreviewMimeType,
  getModelPreviewFormat,
  getMonacoLanguage,
  getVideoPreviewMimeType,
  isAudioPreviewExtension,
  isEditableTextExtension,
  isExecutableExtension,
  isImagePreviewExtension,
  isVideoPreviewExtension,
  type ModelPreviewFormat,
} from '../config/filePreview';
import {
  EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG,
  canRenderExplorerThumbnail,
} from '../config/explorerThumbnails';
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
  type EditorSearchFocusTarget,
} from './fileExplorerSearchFocus';
import { dispatchTerminalCommand, resolvePluginCommandTemplate } from '../config/pluginContributions';
import {
  explorerBackendContract,
  type ExplorerBatchRenamePreview,
  type ExplorerBatchRenameRecipeInput,
  type ExplorerBackendContract,
  type ExplorerChecksumInfo,
  type ExplorerDuplicateScan,
  type ExplorerDriveInfo as DriveInfo,
  type ExplorerEntryThumbnailData,
  type ExplorerEntryStorageInfo as EntryStorageInfo,
  type ExplorerFileEntry as FileEntry,
  type ExplorerFileTransferCollision,
  type ExplorerFileTransferCollisionPolicy,
  type ExplorerFileTransferOperation as FileTransferOperation,
  type ExplorerFileTransferResult as FileTransferResult,
  type ExplorerFileSearchResult as FileSearchResult,
  type ExplorerArchiveExtractionMode,
  type ExplorerItemProperties,
  type ExplorerSavedSearch,
  type ExplorerTagMetadataSnapshot,
  queueExplorerTerminalDirectorySync,
} from '../runtime/explorerBackend';
import { runExplorerAudioBatchProcess } from '../runtime/audioWorkbenchBackend';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import {
  moveExplorerChromeControlInResolvedSurfaces,
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlId,
  type ExplorerChromeControlDefinition,
  type ExplorerChromeLayoutId,
  type ExplorerChromeOverrideSnapshot,
  type ExplorerChromeResolvedControlPlacement,
  type ExplorerChromeResolvedSurface,
  type ExplorerChromeSurfaceId,
  type ExplorerChromeZoneId,
} from '../config/explorerChromeLayouts';
⋮----
type ExplorerDragPreviewContent = {
  primaryLabel: string;
  itemCount: number;
};
⋮----
type ExplorerSearchCacheEntry = {
  results: FileSearchResult[];
  diagnostics: Awaited<ReturnType<ExplorerBackendContract['searchEntriesWithDiagnostics']>>['diagnostics'];
};
⋮----
function getExplorerSearchCacheKey(args: {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent: boolean;
}): string
⋮----
async function getOrLoadCachedExplorerSearchResults(
  key: string,
  loader: () => Promise<ExplorerSearchCacheEntry>,
): Promise<ExplorerSearchCacheEntry>
⋮----
export function invalidateExplorerResultCaches(pathPrefix?: string): void
⋮----
function readViewportMetrics(viewport: HTMLDivElement): ViewportMetrics
⋮----
function areViewportMetricsEqual(left: ViewportMetrics, right: ViewportMetrics): boolean
⋮----
function getExplorerPerformanceNow(): number
⋮----
function getDocumentPreviewKind(path: string): DocumentPreviewKind
⋮----
// ─── Types ────────────────────────────────────────────────────────────────────
⋮----
interface ViewportMetrics {
  scrollTop: number;
  clientHeight: number;
  clientWidth: number;
}
interface ContextMenuState { visible: boolean; x: number; y: number; entry: FileEntry | null; }
interface RenameState    { active: boolean; path: string; name: string; }
interface BatchRenameState {
  visible: boolean;
  mode: ExplorerBatchRenameMode;
  findText: string;
  replaceText: string;
  prefix: string;
  suffix: string;
  startingNumber: number;
  padding: number;
}
interface SaveSearchState {
  visible: boolean;
  name: string;
}
interface TagDialogState {
  visible: boolean;
  mode: 'add' | 'remove';
  paths: string[];
  input: string;
  title: string;
  description: string;
}
interface DuplicateFinderState {
  visible: boolean;
  scanId: string | null;
  status: ExplorerDuplicateScan | null;
  loading: boolean;
}
interface TransferConflictDialogState {
  visible: boolean;
  collisions: ExplorerFileTransferCollision[];
  targetDir: string;
  sources: string[];
  operation: FileTransferOperation;
}
type PreviewState =
  | { type: 'none'; path: string }
  | { type: 'image'; path: string; name: string; content: string }
  | { type: 'audio'; path: string; name: string; source: string; extension: string; mimeType: string | null; size: number }
  | { type: 'video'; path: string; name: string; source: string; extension: string; mimeType: string | null; size: number }
  | {
      type: 'text';
      path: string;
      name: string;
      content: string;
      language: string;
      renderKind: DocumentPreviewKind;
      focusTarget: EditorSearchFocusTarget | null;
      isDirty: boolean;
      isSaving: boolean;
      lastSavedAt: number | null;
      error: string | null;
    }
  | { type: 'model3d'; path: string; format: ModelPreviewFormat; name: string; size: number }
  | { type: 'fallback'; path: string; name: string; label: string; detail?: string };
interface NewItemState   { visible: boolean; kind: 'file'|'folder'; }
type ExplorerDragIntent = 'internal' | 'native-out';
type ExplorerSortKey = 'name' | 'size' | 'date' | 'type';
interface PendingExplorerTransferRequest {
  targetDir: string;
  sources: string[];
  operation: FileTransferOperation;
  collisionPolicy?: ExplorerFileTransferCollisionPolicy;
}
⋮----
interface ExplorerChromeEditModeState {
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
}
⋮----
// ─── Palette ─────────────────────────────────────────────────────────────────
⋮----
function getPathLeaf(path: string): string
⋮----
function getPathParent(path: string): string | null
⋮----
function isSameOrDescendantPath(path: string, candidate: string): boolean
⋮----
function shouldRefreshExplorerForTransferEvent(
  currentPath: string,
  detail: FileOperationsTransferCompletedEventDetail,
): boolean
⋮----
function toolbarChipButtonStyle(disabled: boolean): CSSProperties
⋮----
function toolbarToggleButtonStyle(active: boolean, disabled = false): CSSProperties
⋮----
function toolbarIconButtonStyle(disabled = false): CSSProperties
⋮----
function toolbarActionButtonStyle(): CSSProperties
⋮----
interface ExplorerEntrySurfaceState {
  background: string;
  borderColor: string;
  boxShadow: string;
  transform: string;
}
⋮----
function getExplorerEntryStateSurface(
  explorerTheme: ResolvedExplorerThemeRecipe,
  state: 'idle' | 'selected' | 'drop',
): ExplorerEntrySurfaceState
⋮----
function getExplorerHoverSurface(
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerEntrySurfaceState
⋮----
function applyExplorerEntrySurface(
  target: HTMLElement,
  surface: ExplorerEntrySurfaceState,
): void
⋮----
function shouldIgnoreExplorerDragLeave(event: React.DragEvent): boolean
⋮----
function isEditableKeyboardTarget(target: EventTarget | null): boolean
⋮----
function resolveExplorerDragIntent(event: Pick<React.DragEvent, 'altKey'>): ExplorerDragIntent
⋮----
function fitExplorerDragPreviewLabel(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string
⋮----
function drawExplorerDragPreviewRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void
⋮----
function renderExplorerDragPreviewCanvas(content: ExplorerDragPreviewContent): HTMLCanvasElement | null
⋮----
function applyExplorerNativeFeelingDragImage(
  dataTransfer: DataTransfer | null | undefined,
  content: ExplorerDragPreviewContent,
): void
⋮----
function resolveExplorerDropOperation(
  event: Pick<React.DragEvent, 'altKey' | 'ctrlKey'>,
  platform: RuntimePlatform,
): FileTransferOperation
⋮----
function formatExplorerNativeDragError(error: unknown): string
⋮----
function getDefaultExplorerSortOrder(sortBy: ExplorerSortKey): 'asc' | 'desc'
⋮----
function getEntryExtension(entry: Pick<FileEntry, 'is_dir' | 'name' | 'extension'>): string
⋮----
function getPreviewAssetUrl(filePath: string): string
⋮----
function getEntryTypeLabel(entry: Pick<FileEntry, 'is_dir' | 'name' | 'extension'>): string
⋮----
function compareExplorerEntryText(left: string, right: string): number
⋮----
function compareExplorerEntries(
  left: FileEntry,
  right: FileEntry,
  sortBy: ExplorerSortKey,
  sortOrder: 'asc' | 'desc',
): number
⋮----
function sortExplorerEntries(
  entries: FileEntry[],
  sortBy: ExplorerSortKey,
  sortOrder: 'asc' | 'desc',
): FileEntry[]
⋮----
function getIconSrc(
  entry: FileEntry,
  open = false,
  folderConfig?: Parameters<typeof getFolderIconSrc>[2],
  iconTheme = getBuiltInIconTheme(),
): string
⋮----
function shouldPreferManagedExplorerIcon(
  entry: FileEntry,
  folderConfig: Parameters<typeof getFolderIconSrc>[2] | undefined,
  iconTheme = getBuiltInIconTheme(),
): boolean
⋮----
function getNativeIconRequest(entry: FileEntry): OverlayNativeIconRequest
⋮----
// ─── Extension sets (for preview logic only) ─────────────────────────────────
⋮----
function isEditableTextEntry(entry: FileEntry): boolean
⋮----
function formatSize(bytes: number): string
⋮----
function formatDate(ms: number): string
⋮----
function normalizeExplorerPath(path: string): string
⋮----
function getExplorerParentPath(path: string): string
⋮----
function buildAdaptiveSemanticBands(
  entries: FileEntry[],
  selectedPaths: Set<string>,
  currentPath: string,
  sortBy: ExplorerSortKey,
  sortOrder: 'asc' | 'desc',
): AdaptiveSemanticBand[]
⋮----
function buildTimelineSurfaceBands(
  entries: FileEntry[],
  density: number,
  sortBy: ExplorerSortKey,
  sortOrder: 'asc' | 'desc',
  nowMs = Date.now(),
): TimelineSurfaceBand[]
⋮----
function isLikelyExplorerPathInput(value: string): boolean
⋮----
function resolveExplorerPathInput(
  input: string,
  currentPath: string,
  runtimePlatform: ReturnType<typeof detectClientPlatform>,
): string
⋮----
// ─── SvgIcon ──────────────────────────────────────────────────────────────────
⋮----
function SvgIcon(
⋮----
// ─── Context menu ─────────────────────────────────────────────────────────────
⋮----
interface CtxItem {
  id: string;
  group: ExplorerContextMenuItemGroup;
  defaultOrder: number;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
  action: () => void | Promise<void>;
}
⋮----
function resolveContextMenuIcon(iconName?: string): React.ReactNode
⋮----
const h = (e: MouseEvent) =>
⋮----
<button key=
⋮----
onMouseLeave=
⋮----
// ─── Resizable Preview Panel ──────────────────────────────────────────────────
⋮----
const onMouseDown = (e: React.MouseEvent) =>
⋮----
const move = (e: MouseEvent) =>
⋮----
const delta = startX.current - e.clientX; // dragging left grows the panel
⋮----
const up = () =>
⋮----
onCopyPath(preview.path);
setCopiedPath(preview.path);
⋮----
{/* Drag handle */}
⋮----
onMouseEnter=
⋮----
{/* Header */}
⋮----
{/* Content */}
⋮----
// ─── Inline rename ────────────────────────────────────────────────────────────
⋮----
<input ref=
⋮----
// ─── Trash confirm ────────────────────────────────────────────────────────────
⋮----
<button onClick=
⋮----
// ─── Main FileExplorer ────────────────────────────────────────────────────────
⋮----
// Session is only used to seed the explorer's local state. Avoid subscribing to it
// so high-frequency local changes (typing, resizing) don't force extra store-driven renders.
⋮----
const [dragOver,     setDragOver]     = useState<string|null>(null); // path being dragged over
⋮----
const handlePointerDown = (event: MouseEvent) =>
⋮----
// ── Navigate ──
⋮----
const isActiveDirectoryLoadRequest = () => (
      isExplorerMountedRef.current && directoryLoadRequestIdRef.current === requestId
    );
⋮----
// ── Boot ──
⋮----
const isActiveBootNavigation = () => (
      !disposed
      && isExplorerMountedRef.current
      && bootNavigationSequenceRef.current === generation
    );
⋮----
const navigateToResolvedHome = async () =>
⋮----
// Keep the platform fallback path below.
⋮----
const navigateToBootstrapPath = async (bootstrapPath: string) =>
⋮----
const resetBootSession = () =>
⋮----
const startBootNavigation = async () =>
⋮----
const isActiveSearchRequest = () => (
      isExplorerMountedRef.current && searchRequestIdRef.current === requestId
    );
⋮----
const goUp      = () =>
⋮----
// ── Open ──
⋮----
// ── Duplicate ──
⋮----
// ── Clipboard (system) ──
⋮----
// ── Paste ──
⋮----
// ── Rename ──
const commitRename = async (newName: string) =>
⋮----
const tick = async () =>
⋮----
const confirmTrash = async () =>
⋮----
const permanentlyDeleteTargets = async () =>
⋮----
// ── Context menu builder ──
⋮----
action: () =>
⋮----
// ── Right-click ──
⋮----
// Don't lose multi-selection if right-clicking already-selected item
⋮----
// ── Click with shift-select support ──
⋮----
// ── Keyboard ──
⋮----
// ── Breadcrumbs ──
⋮----
// ── Inline new item creation ──
⋮----
// ── Drag and Drop ──
⋮----
const onDragLeave = (e: React.DragEvent, targetPath: string) =>
⋮----
const onDrop = async (e: React.DragEvent, targetDir: string) =>
⋮----
style=
⋮----
onDragOver=
⋮----
onDrop=
⋮----
updateExplorerSettings(
setShowExperimentalMenu(false);
⋮----
setShowLayoutMenu(false);
setShowModeProfileMenu(current
⋮----
...toolbarToggleButtonStyle(showModeProfileMenu),
⋮----
setShowModeProfileMenu(false);
⋮----
setShowLayoutMenu(current
⋮----
...toolbarToggleButtonStyle(showLayoutMenu),
⋮----
const updateMetrics = () =>
⋮----
const scheduleMetricsUpdate = () =>
⋮----
onDragStart=
⋮----
onDoubleClick=
⋮----
handleEntryPointerEnter(entry, e.currentTarget as HTMLDivElement, isSel, isDrop);
⋮----
handleEntryPointerLeave(entry, e.currentTarget as HTMLDivElement, isSel, isDrop);
⋮----
? <RenameInput state=
⋮----
handleEntryPointerEnter(node.entry, e.currentTarget as HTMLDivElement, isSel, isDrop);
⋮----

⋮----
{/* ══ SIDEBAR ══ */}
⋮----
{/* ══ MAIN ══ */}
⋮----
{/* Toolbar */}
⋮----
{/* File area + preview */}
⋮----
onClick=
⋮----
onDragLeave=
⋮----
title=
⋮----
{/* Side pane */}
⋮----
{/* Status bar */}
⋮----
{/* Context menu */}
⋮----
onCancel=
⋮----
onSelectPath=
````

## File: components/fileExplorerClickBehavior.ts
````typescript
import type { ExplorerFolderClickMode } from '../store/settingsStore';
⋮----
export type ExplorerActivationTrigger = 'click' | 'double-click';
⋮----
export function shouldOpenExplorerEntryOnTrigger({
  isDirectory,
  trigger,
  plainClick,
  folderClickMode,
}: {
  isDirectory: boolean;
  trigger: ExplorerActivationTrigger;
  plainClick: boolean;
  folderClickMode: ExplorerFolderClickMode;
}): boolean
````

## File: components/fileExplorerSearchFocus.ts
````typescript
export type ExplorerSearchMatchKind = 'name' | 'content' | 'name_and_content';
⋮----
export interface EditorSearchFocusTarget {
  requestId: number;
  lineNumber: number | null;
  searchString: string | null;
}
⋮----
interface SearchFocusSource {
  line_number: number | null;
  match_kind: ExplorerSearchMatchKind | null | undefined;
}
⋮----
export function createEditorSearchFocus(
  requestId: number,
  searchQuery: string,
  source: SearchFocusSource,
): EditorSearchFocusTarget | null
⋮----
export function clampSearchFocusLine(lineNumber: number | null | undefined, lineCount: number): number
⋮----
export function findSearchFocusColumns(
  lineContent: string,
  searchString: string | null,
):
````

## File: components/fileExplorerSearchScope.ts
````typescript
function normalizeScopeToken(value: string): string
⋮----
export function resolveExplorerSearchScope(instanceId: string): string
````

## File: components/GitManager.tsx
````typescript
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorProps } from '@monaco-editor/react';
import { AlertTriangle, ChevronDown, ChevronUp, Download, FolderGit2, GitBranch, GitCommit, Plus, RefreshCw, Rocket, Search, Upload, X } from 'lucide-react';
import { multiplyColorAlpha, type ResolvedOverlayAppearance } from '../config/appearance';
import { recordExplorerPerformanceSample } from '../config/performanceTelemetry';
import { OverlayScrollArea } from './OverlayScrollArea';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { useSettingsStore } from '../store/settingsStore';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import {
  type GitFileStatus,
  mergeGitStatusWithStats,
  parseGitNumstat,
  parseGitStatus,
  summarizeGitFiles,
} from './gitManager.utils';
⋮----
interface RepoState {
  path: string;
  name: string;
  branch: string;
  status: GitFileStatus[];
  lastCommit: string;
  loadedAt: number;
}
⋮----
interface RepoBadgeState {
  changeCount: number;
  conflictedCount: number;
  loadedAt: number;
  error: string | null;
}
⋮----
interface DiffViewState {
  content: string;
  hunkLines: number[];
}
⋮----
interface ResolvedRepositoryImport {
  requestedPath: string;
  repoPath: string;
  comparablePath: string;
}
⋮----
interface RepositoryImportDialogState {
  visible: boolean;
  path: string;
}
⋮----
type GitManagerConfirmationAction =
  | { kind: 'discard'; file: GitFileStatus }
  | { kind: 'resolve'; file: GitFileStatus; side: ConflictResolutionSide };
⋮----
interface GitManagerConfirmationState {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'accent' | 'danger';
  action: GitManagerConfirmationAction | null;
}
⋮----
type ChangeFilter = 'all' | 'staged' | 'unstaged' | 'untracked';
⋮----
interface GitManagerProps {
  appearance?: ResolvedOverlayAppearance;
  pendingRepositoryImports?: string[];
  onPendingRepositoryImportsHandled?: () => void;
  onRequestRepositoryImport?: () => void;
}
⋮----
const isDocumentVisible = ()
⋮----
const runLoad = async () =>
⋮----
const mergeBadgeEntries = (nextEntries: readonly (readonly [string, RepoBadgeState])[]) =>
⋮----
const syncBadgeSubset = async (targetRepos: string[]) =>
⋮----
const syncBadges = async (forceAll = false) =>
⋮----
const scheduleBadgeSync = async (forceAll = false) =>
⋮----
const handleVisibilityChange = () =>
⋮----
const canonicalizeStoredRepos = async () =>
⋮----
// Force an immediate layout so Monaco knows its real size after the
// scale-zoom CSS transform has settled on the parent shell.
const scheduleLayout = () =>
⋮----
// CSS scale() transforms don't fire ResizeObserver inside the scaled element,
// so Monaco won't remeasure when the user changes the global zoom level.
// We subscribe to appZoom from the store and call layout() manually when it changes.
⋮----
const updateViewportHeight = () =>
⋮----
<span title=
⋮----
<button type="button" onClick=
⋮----

⋮----
<button onClick=
⋮----
onClick=
⋮----
<button key=
⋮----
const normalized = path.replace(/[\\/]+$/, '');
const match = normalized.match(/^(.*)[\\/][^\\/]+$/);
⋮----
return /\u0000/.test(content);
⋮----
if (
    result
    && typeof result === 'object'
    && 'status' in result
    && (result.status === 'ok' || result.status === 'error')
)
⋮----
if (file.kind === 'added') return 'Added';
⋮----
if (file.kind === 'conflicted')
⋮----
if (file.isStaged && file.hasUnstagedChanges)
⋮----
if (file.isUntracked)
````

## File: components/gitManager.utils.ts
````typescript
export type GitFileKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted';
⋮----
export interface GitFileStatus {
  file: string;
  originalFile: string | null;
  statusText: string;
  stagedCode: string;
  unstagedCode: string;
  isStaged: boolean;
  hasUnstagedChanges: boolean;
  isUntracked: boolean;
  kind: GitFileKind;
  stagedAdditions: number;
  stagedDeletions: number;
  unstagedAdditions: number;
  unstagedDeletions: number;
  additions: number;
  deletions: number;
}
⋮----
export interface GitNumstatEntry {
  path: string;
  additions: number;
  deletions: number;
  isBinary: boolean;
}
⋮----
export interface GitSummary {
  totalFiles: number;
  stagedFiles: number;
  unstagedFiles: number;
  untrackedFiles: number;
  conflictedFiles: number;
  additions: number;
  deletions: number;
}
⋮----
export function parseGitStatus(output: string): GitFileStatus[]
⋮----
export function parseGitNumstat(output: string): GitNumstatEntry[]
⋮----
export function mergeGitStatusWithStats(
  statuses: GitFileStatus[],
  unstagedStats: GitNumstatEntry[],
  stagedStats: GitNumstatEntry[],
): GitFileStatus[]
⋮----
export function summarizeGitFiles(files: GitFileStatus[]): GitSummary
⋮----
function deriveGitFileKind(statusText: string): GitFileKind
⋮----
function buildStatsMap(entries: GitNumstatEntry[]): Map<string,
⋮----
function sumStatsForPaths(
  map: Map<string, { additions: number; deletions: number }>,
  paths: string[],
):
⋮----
function splitGitRenamePath(rawPath: string): [string | null, string]
⋮----
function normalizeGitPath(path: string): string
⋮----
function unquoteGitPath(path: string): string
````

## File: components/ModelPreview.tsx
````typescript
import { useEffect, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
⋮----
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
  MODEL_PREVIEW_PROXY_CONFIG,
  type ModelPreviewFormat,
} from '../config/filePreview';
import {
  collectNormalizedBounds,
  decodeDataUrlToUint8Array,
  normalizeModelForPreview,
} from './modelPreview.utils';
import {
  detectClientPlatform,
  getPlatformPathSeparator,
  joinPlatformPath,
} from '../config/platform';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
⋮----
type ModelPreviewProps = {
  entryName: string;
  format: ModelPreviewFormat;
  sourcePath: string;
  sourceBytes: number;
};
⋮----
type LoadedPreviewResult = {
  object: THREE.Object3D;
  proxyNotice: string | null;
};
⋮----
type ModelGeometryStats = {
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
};
⋮----
type DisposableObject = THREE.Object3D & {
  geometry?: { dispose?: () => void };
  material?: THREE.Material | THREE.Material[];
};
⋮----
const resize = () =>
⋮----
const animate = () =>
⋮----
const resetView = () =>
````

## File: components/modelPreview.utils.ts
````typescript
import type { ModelPreviewFormat } from '../config/filePreview';
⋮----
export function decodeDataUrlToUint8Array(dataUrl: string): Uint8Array
⋮----
export function getModelPreviewRotation(format: ModelPreviewFormat): THREE.Euler
⋮----
export function normalizeModelForPreview(
  object: THREE.Object3D,
  format: ModelPreviewFormat,
  targetSize = TARGET_MODEL_SIZE,
): THREE.Group
⋮----
export function collectNormalizedBounds(object: THREE.Object3D): THREE.Box3
⋮----
export function parseDiffuseTexturePath(path: string): string
````

## File: components/NotesManager.tsx
````typescript
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StickyNote, ListTodo, Bug, MessageSquareText,
  Plus, Trash2, Pin, PinOff, Search, X, Check,
  Clock, Tag, Star, StarOff, Copy,
  ArrowUpDown,
} from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  getManagedNoteCategoryDirectory,
  joinManagedNotePath,
} from '../config/notes';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  createExplorerDir,
  deleteExplorerPath,
  listExplorerDir,
  readExplorerTextFile,
  writeExplorerFile,
} from '../runtime/explorerBackend';
⋮----
// ─── Constants ─────────────────────────────────────────────────────────────────
⋮----
// ─── Types ─────────────────────────────────────────────────────────────────────
⋮----
type NoteCategory = 'notes' | 'todos' | 'bugs' | 'prompts';
⋮----
interface NoteEntry {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  created: number;   // unix ms
  modified: number;  // unix ms
  pinned: boolean;
  starred: boolean;
  tags: string[];
  color: string;     // accent color override
  // to-do specific
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  // bug specific
  severity?: 'minor' | 'major' | 'critical' | 'blocker';
  status?: 'open' | 'in-progress' | 'resolved' | 'closed';
}
⋮----
created: number;   // unix ms
modified: number;  // unix ms
⋮----
color: string;     // accent color override
// to-do specific
⋮----
// bug specific
⋮----
type SortMode = 'modified' | 'created' | 'alpha' | 'priority';
⋮----
// ─── Category Config ───────────────────────────────────────────────────────────
⋮----
interface CategoryConfig {
  id: NoteCategory;
  label: string;
  icon: React.ReactNode;
  folder: string;
  color: string;
  placeholder: string;
}
⋮----
// ─── Helpers ───────────────────────────────────────────────────────────────────
⋮----
function slugify(str: string): string
⋮----
function formatDate(ts: number): string
⋮----
function generateId(): string
⋮----
// Serialize a NoteEntry to a markdown file with YAML-ish frontmatter
function serializeNote(note: NoteEntry): string
⋮----
// Parse a markdown file back into a NoteEntry
function deserializeNote(raw: string): NoteEntry | null
⋮----
function getCategoryPath(cat: NoteCategory): string
⋮----
function getNoteFilename(note: NoteEntry): string
⋮----
// ─── Storage Layer ─────────────────────────────────────────────────────────────
⋮----
async function ensureDir(path: string): Promise<void>
⋮----
async function loadAllNotes(category: NoteCategory): Promise<NoteEntry[]>
⋮----
} catch { /* skip corrupt files */ }
⋮----
async function saveNote(note: NoteEntry): Promise<void>
⋮----
async function deleteNoteFile(note: NoteEntry): Promise<void>
⋮----
} catch { /* already gone */ }
⋮----
// When renaming, delete old file and write new one
async function renameAndSave(oldNote: NoteEntry, newNote: NoteEntry): Promise<void>
⋮----
// ─── Component ─────────────────────────────────────────────────────────────────
⋮----
// ── State ──
⋮----
// ── Load entries when category changes ──
⋮----
// ── Auto-save debounced ──
⋮----
// ── Create new entry ──
⋮----
// ── Update entry ──
⋮----
// ── Delete entry ──
⋮----
// ── Duplicate entry ──
⋮----
// ── Rename commit ──
⋮----
// ── Filtering & sorting ──
⋮----
// Sort
⋮----
// Pinned always first
⋮----
// ── Tag management for selected note ──
⋮----
// ── Keyboard shortcut: Ctrl+N for new ──
⋮----
const handler = (e: KeyboardEvent) =>
⋮----
// ─── Render ──────────────────────────────────────────────────────────────────
⋮----
{/* ══ LEFT: Category Sidebar ══ */}
⋮----
{/* Active indicator */}
⋮----
{/* ══ MIDDLE: Entry List ══ */}
⋮----
{/* List Header */}
⋮----
{/* Star filter */}
⋮----
{/* Sort menu */}
⋮----
onClick=
⋮----
{/* Tag filter pills */}
⋮----
{/* Entry List */}
⋮----
onToggleStar=
⋮----
onDelete=
onDuplicate=
⋮----
{/* ══ RIGHT: Editor ══ */}
⋮----
{/* Close sort menu on outside click */}
⋮----
// ─── Entry List Item ───────────────────────────────────────────────────────────
⋮----
onMouseEnter=
⋮----
{/* Title row */}
⋮----
{/* To-do checkbox */}
⋮----
onClick={e => { e.stopPropagation(); /* handled in editor */ }}
⋮----
{/* Bug status dot */}
⋮----
{/* Title */}
⋮----
onKeyDown=
⋮----
{/* Star */}
⋮----
{/* Preview text */}
⋮----
{/* Bottom row: meta + actions */}
⋮----
<Clock size=
⋮----
{/* Priority badge */}
⋮----
{/* Severity badge */}
⋮----
{/* Hover actions */}
⋮----
// ─── Empty Editor State ────────────────────────────────────────────────────────
⋮----
// ─── Note Editor ───────────────────────────────────────────────────────────────
⋮----
const handleTagSubmit = () =>
⋮----
{/* Editor Header */}
⋮----
{/* Title */}
⋮----
{/* Metadata Row */}
⋮----
{/* To-Do: Priority selector */}
⋮----
{/* Bug: Severity & status */}
⋮----
{/* Editor Body */}
⋮----
onChange=
⋮----
{/* Status Bar */}
````

## File: components/OverlayScrollArea.tsx
````typescript
import React, { useCallback, useRef } from 'react';
⋮----
type OverlayScrollDirection = 'vertical' | 'horizontal' | 'both';
⋮----
interface OverlayScrollAreaProps {
  children: React.ReactNode;
  direction?: OverlayScrollDirection;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  style?: React.CSSProperties;
  viewportStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  viewportRef?: React.Ref<HTMLDivElement>;
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
}
⋮----
export function OverlayScrollArea({
  children,
  direction = 'vertical',
  className,
  viewportClassName,
  contentClassName,
  style,
  viewportStyle,
  contentStyle,
  viewportRef,
  onViewportScroll,
}: OverlayScrollAreaProps)
⋮----
className=
⋮----
function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T>
````

## File: components/panelUtils.ts
````typescript
export function reorderPanelIds(ids: string[], draggedId: string, targetId: string): string[]
⋮----
export function togglePanelId(ids: string[], panelId: string): string[]
⋮----
export function syncOpenPanelIds(
  openIds: string[],
  availableIds: string[],
  defaultOpenIds: string[],
): string[]
⋮----
export function derivePanelOpenState(args: {
  savedOpenIds: string[];
  dismissedPanelIds: string[];
  availableIds: string[],
  defaultOpenIds: string[],
  enforcedOpenIds: string[],
}): string[]
⋮----
export function getNextActivePanelId(openIds: string[], closedId: string): string | null
````

## File: components/pluginRuntime.tsx
````typescript
import React from 'react';
⋮----
import {
  getPluginBackendDirectory,
  getPluginDirectory,
  pluginSystemConfig,
} from '../config/plugins';
import type { OverlayThemeDefinition } from '../config/appearance';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModuleGraph,
  isSupportedRuntimeFile,
  transpileRuntimeModuleGraph,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleSourceResolver,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
import {
  getPluginPanelOpenRequestEvent,
  readPluginPanelOpenRequest,
  requestPluginPanelOpen,
} from '../runtime/pluginPanelRequests';
⋮----
export interface PluginFileEntry extends RuntimeFileEntry {}
⋮----
export interface OverlayPluginContext {
  id: string;
  name: string;
  filePath: string;
  pluginRoot: string;
  pluginDirectory: string;
  backendDirectory: string;
}
⋮----
export interface OverlayPluginApi {
  invoke: typeof TauriCore.invoke;
  event: typeof TauriEvent;
  window: typeof TauriWindow;
  fs: typeof TauriFs;
  notification: typeof TauriNotification;
  storage?: OverlayPluginStorageApi;
  assets?: OverlayPluginAssetsApi;
  refreshPlugins: () => Promise<void>;
  openPluginsFolder: () => Promise<void>;
  runBackend: (entry: string, args?: string[]) => Promise<PluginBackendResult>;
}
⋮----
export interface OverlayPluginStorageApi {
  rootDir: string;
  ensureDir: (relativePath?: string) => Promise<string>;
  readTextFile: (relativePath: string) => Promise<string>;
  writeTextFile: (relativePath: string, data: string) => Promise<void>;
  writeFile: (relativePath: string, data: Uint8Array) => Promise<void>;
}
⋮----
export interface OverlayPluginAssetsApi {
  rootDir: string;
  resolvePath: (relativePath: string) => string;
  resolveUrl: (relativePath: string) => string;
}
⋮----
export interface OverlayPluginHostContext {
  mode: 'panel-tab' | 'manager-preview';
  width: number;
  height: number;
  zoom: number;
  compact: boolean;
  density: 'compact' | 'regular';
}
⋮----
export interface OverlayPluginProps {
  plugin: OverlayPluginContext;
  api: OverlayPluginApi;
  host?: OverlayPluginHostContext;
  appearance: {
    theme: OverlayThemeDefinition;
    fonts: {
      ui: string;
      mono: string;
    };
    cssVars: Record<string, string>;
  };
}
⋮----
export interface OverlayPluginDefinition {
  id?: string;
  name?: string;
  description?: string;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  component: React.ComponentType<OverlayPluginProps>;
}
⋮----
export type OverlayPluginSourceKind = 'file-plugin' | 'package-plugin';
⋮----
export interface OverlayPluginCapabilitySummary {
  panel: boolean;
  themes: number;
  shaders: number;
  fonts: number;
  commands: number;
  explorerActions: number;
  contextMenuItems: number;
}
⋮----
export interface OverlayPluginDiagnostics {
  sourceKind: OverlayPluginSourceKind;
  sourceLabel: string;
  manifestPath?: string;
  warnings: string[];
  capabilities: OverlayPluginCapabilitySummary;
}
⋮----
export interface LoadedOverlayPlugin extends OverlayPluginContext {
  description?: string;
  modified: number;
  defaultOpen: boolean;
  keepMounted: boolean;
  component: React.ComponentType<OverlayPluginProps> | null;
  error: string | null;
  diagnostics: OverlayPluginDiagnostics;
}
⋮----
export interface PluginBackendResult {
  stdout: string;
  stderr: string;
  status: number;
}
⋮----
export interface LoadPluginFromSourceOptions {
  context?: Partial<OverlayPluginContext>;
  defaults?: Partial<Pick<OverlayPluginDefinition, 'id' | 'name' | 'description' | 'defaultOpen' | 'keepMounted'>>;
  diagnostics?: Partial<OverlayPluginDiagnostics>;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}
⋮----
export function definePlugin(definition: OverlayPluginDefinition): OverlayPluginDefinition
⋮----
export function isFrontendPluginFile(entry: PluginFileEntry): boolean
⋮----
export function derivePluginId(name: string): string
⋮----
export function derivePluginName(name: string): string
⋮----
export async function loadPluginFromSource(
  source: string,
  entry: PluginFileEntry,
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
  options?: LoadPluginFromSourceOptions,
): Promise<LoadedOverlayPlugin>
⋮----
async function transpilePluginGraph(
  entryModulePath: string,
  source: string,
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver,
): Promise<RuntimeModuleGraph>
⋮----
function executePluginModuleGraph(graph: RuntimeModuleGraph): unknown
⋮----
function normalizePluginExport(
  exported: unknown,
  fallbackContext: OverlayPluginContext,
): OverlayPluginDefinition
⋮----
function unwrapModuleExport(exported: unknown): unknown
````

## File: components/PluginsManager.tsx
````typescript
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Blocks, FolderOpen, LoaderCircle, Puzzle, RefreshCw, TriangleAlert } from 'lucide-react';
import { pluginSystemConfig } from '../config/plugins';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';
import type {
  LoadedOverlayPlugin,
  OverlayPluginApi,
  OverlayPluginContext,
  OverlayPluginHostContext,
} from './pluginRuntime';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
⋮----
type FolderPluginHostMode = 'panel-tab' | 'manager-preview';
⋮----
type FolderPluginHostLayout = {
  viewportPadding: number;
  maxWidth: number;
  framed: boolean;
};
⋮----
export interface PluginsManagerProps {
  appearance?: ResolvedOverlayAppearance;
  plugins: LoadedOverlayPlugin[];
  isLoading: boolean;
  error: string | null;
  onRefreshPlugins: () => Promise<void> | void;
  onOpenPluginsFolder: () => Promise<void>;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
}
⋮----
export interface FolderPluginRendererProps {
  plugin: LoadedOverlayPlugin;
  appearance?: ResolvedOverlayAppearance;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
  hostMode?: FolderPluginHostMode;
  isActive?: boolean;
}
⋮----
<button onClick=
⋮----
onClick=
⋮----
const syncHostSize = () =>
⋮----
const runSync = ()
⋮----
constructor(props:
⋮----
static getDerivedStateFromError(error: unknown)
⋮----
override componentDidUpdate(prevProps:
````

## File: components/ResizablePane.tsx
````typescript
import React, { useEffect, useMemo, useState } from 'react';
⋮----
export function clampPanelSize(value: number, minSize: number, maxSize: number): number
⋮----
export function usePersistentPanelSize(
  storageKey: string,
  initialSize: number,
  minSize: number,
  maxSize: number,
): [number, React.Dispatch<React.SetStateAction<number>>]
⋮----
// Ignore storage failures; the panel can still resize for the current session.
⋮----
export function ResizablePane({
  size,
  minSize,
  maxSize,
  onSizeChange,
  borderColor,
  handleSide = 'right',
  children,
  style,
}: {
  size: number;
  minSize: number;
  maxSize: number;
onSizeChange: (nextSize: number)
⋮----
const onMouseMove = (moveEvent: MouseEvent) =>
const onMouseUp = () =>
````

## File: components/ScreenshotsManager.tsx
````typescript
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
  type Monitor as TauriMonitor,
} from '@tauri-apps/api/window';
⋮----
import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  LoaderCircle,
  Monitor,
  MousePointer2,
  RefreshCw,
  Save,
  Search,
  Maximize2,
  Square,
  ArrowUpRight,
  Type,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { useSettingsStore } from '../store/settingsStore';
import { screenshotFeatureConfig } from '../config/screenshots';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  getSelectionHandleAtPoint,
  isPointInSelection,
  moveSelection,
  isSupportedScreenshotEntry,
  normalizeSelection,
  resizeSelection,
  selectionToPixelRect,
  sortScreenshotEntries,
  type Point2D,
  type RectSelection,
  type SelectionHandle,
  type ScreenshotEntryLike,
} from './screenshotsUtils';
import { OverlayScrollArea } from './OverlayScrollArea';
import { AppConfirmDialog } from './AppModal';
import {
  createExplorerDir,
  deleteExplorerPath,
  listExplorerDir,
  openExplorerPath,
  revealExplorerPath,
} from '../runtime/explorerBackend';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
⋮----
// ─── Annotation types ─────────────────────────────────────────────────────────
⋮----
type AnnotationTool = 'select' | 'rect' | 'arrow' | 'text';
⋮----
type RectAnnotation  = { type: 'rect';  x1: number; y1: number; x2: number; y2: number; color: string; lw: number; };
type ArrowAnnotation = { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; };
type TextAnnotation  = { type: 'text';  x:  number; y:  number; text: string; color: string; size: number; };
type Annotation = RectAnnotation | ArrowAnnotation | TextAnnotation;
⋮----
type NativeScreenshotRegion = { x: number; y: number; width: number; height: number };
type NativeScreenshotAnnotation =
  | { type: 'rect'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number };
⋮----
type SelectionInteraction =
  | { kind: 'draw'; origin: Point2D }
  | { kind: 'move'; origin: Point2D; initialSelection: RectSelection }
  | { kind: 'resize'; origin: Point2D; initialSelection: RectSelection; handle: Exclude<SelectionHandle, 'move'> };
⋮----
// ─── Types ────────────────────────────────────────────────────────────────────
⋮----
type FileEntry = ScreenshotEntryLike & {
  size: number;
  is_hidden?: boolean;
  is_symlink?: boolean;
};
⋮----
type ScreenshotItem = FileEntry & { previewUrl: string | null };
⋮----
type ScreenshotOutputActionId =
  typeof screenshotFeatureConfig.outputActions[number]['id'];
⋮----
type MonitorCapture = {
  id: string;
  label: string;
  logicalX: number;
  logicalY: number;
  logicalWidth: number;
  logicalHeight: number;
  physicalX: number;
  physicalY: number;
  physicalWidth: number;
  physicalHeight: number;
  scaleFactor: number;
  captureId: string | null;
  previewUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  isActive: boolean;
};
⋮----
// ─── Palette constants ────────────────────────────────────────────────────────
⋮----
// ─── Helpers ──────────────────────────────────────────────────────────────────
⋮----
async function ensureDir(path: string): Promise<void>
⋮----
function toMonitorCapture(monitor: TauriMonitor, activeId: string | null): MonitorCapture
⋮----
function formatFileSize(size: number): string
⋮----
function clamp(v: number, lo: number, hi: number)
⋮----
function scalePreviewPointToImage(
  point: Point2D,
  rendered: { width: number; height: number },
  image: { width: number; height: number },
): Point2D
⋮----
function annotationToImageSpace(
  annotation: Annotation,
  rendered: { width: number; height: number },
  image: { width: number; height: number },
): NativeScreenshotAnnotation
⋮----
function getSelectionHandleLayout(selection: RectSelection)
⋮----
function formatToolbarActionLabel(
  action: ScreenshotOutputActionId,
  scope: 'region' | 'monitor' | 'annotated',
): string
⋮----
function buildGridOverlay(accent: string): React.CSSProperties
⋮----
// Draw annotations onto a canvas context
function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation)
⋮----
// Skip degenerate arrows — this was causing draw errors with zero-length vectors
⋮----
// Redraws the full canvas from stable refs — used by both the state effect and ResizeObserver
function redrawCanvas(
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  liveAnnotation: Annotation | null,
)
⋮----
// ─── Main Component ───────────────────────────────────────────────────────────
⋮----
// ── Refs ──
// containerRef: the SINGLE coordinate origin for all pointer events and overlay children.
⋮----
// Stable refs used inside pointer handlers and ResizeObserver to avoid stale closures
⋮----
// Cached at pointerDown — never re-read during a drag
⋮----
// ── State ──
⋮----
// Keep stable refs in sync with state — these are what pointer handlers + ResizeObserver read
⋮----
// ── Derived: selection in physical px ──
⋮----
// ── Gallery ──
⋮----
// ── Capture all monitors ──
⋮----
// ── Canvas: sync pixel dimensions to CSS layout size ──
// Uses useLayoutEffect so dimensions are set before paint, eliminating the
// default 300×150 canvas offset that caused coordinate desync.
⋮----
const syncSize = () =>
⋮----
// Redraw using stable refs — never stale
⋮----
}, [activeMonitorId]); // Re-bind when monitor changes (new capture resets canvas)
⋮----
// ── Canvas redraw when annotation state changes ──
⋮----
// ── Coordinate helper: get position relative to container ──
// Always reads from containerRef, NOT from e.currentTarget, to guarantee
// the same origin is used across down/move/up events.
⋮----
// ── Pointer events ──
⋮----
// Cache the EXACT rect at pointerdown — reused for the entire drag gesture.
// Always use containerRef.current to guarantee we measure the image container,
// not any ancestor that might forward the event.
⋮----
// Use the CACHED rect from pointerDown — never re-measure during drag
⋮----
// Update ref synchronously so ResizeObserver always has current state
⋮----
// Only commit arrow/rect if they have meaningful length
⋮----
// selection stays until user clears it
⋮----
// ── Actions ──
⋮----
// ── Save annotated ──
⋮----
// ─── Tool content ──────────────────────────────────────────────────────────
⋮----
{/* Monitor tabs */}
⋮----
{/* Annotation toolbar */}
⋮----
<button type="button" title="Undo" onClick=
⋮----
{/* Preview area */}
⋮----
/*
           * COORDINATE ORIGIN — this div is the single source of truth for all
           * pointer coordinates and absolutely-positioned overlays (canvas, selection).
           *
           * Sizing strategy:
           *   - We let CSS aspect-ratio + max constraints do layout.
           *   - We do NOT apply padding, margin, or border that would shift the
           *     interior coordinate space — only the outer div has padding.
           *   - The canvas's pixel dimensions are synced via useLayoutEffect+ResizeObserver
           *     so they always match the CSS box exactly.
           */
⋮----
// Use explicit max constraints so the container never overflows its parent
⋮----
// touch-action none is REQUIRED for Pointer Events to work correctly on touch/pen
⋮----
// Prevent the browser from applying any fractional sub-pixel offset
⋮----
// Ensure this establishes its own stacking context so overlays z-stack correctly
⋮----
<div aria-label="Screenshot composition grid" data-testid="screenshot-grid" style=
⋮----
{/* Annotation canvas — pixel dimensions kept in sync by useLayoutEffect */}
⋮----
// Width/height CSS attrs are set by useLayoutEffect; explicitly
// stretch to 100% so it fills even before ResizeObserver fires
⋮----
{/* Text input overlay */}
⋮----
{/* Selection overlay — only in select mode */}
⋮----
{/* Dark vignette outside selection */}
⋮----
{/* Selection rect — uses normalizedSel (always positive x/y/w/h) */}
⋮----
{/* Action bar */}
⋮----
<button type="button" onClick=
⋮----

⋮----
// ─── Library content ───────────────────────────────────────────────────────
⋮----
<div style=
⋮----
// ─── Root ──────────────────────────────────────────────────────────────────
⋮----
{/* Side rail */}
⋮----
{/* Content area */}
⋮----
{/* Top toolbar */}
⋮----
{/* Status / error bar */}
⋮----
{/* Main panel */}
⋮----
// ─── Sub-components ───────────────────────────────────────────────────────────
````

## File: components/screenshotsUtils.ts
````typescript
import { screenshotFeatureConfig } from '../config/screenshots';
⋮----
export interface ScreenshotEntryLike {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  extension: string;
}
⋮----
export interface RectSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}
⋮----
export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
⋮----
export interface RenderedSize {
  width: number;
  height: number;
}
⋮----
export interface PixelSize {
  width: number;
  height: number;
}
⋮----
export type SelectionHandle =
  | 'move'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'north-east'
  | 'north-west'
  | 'south-east'
  | 'south-west';
⋮----
export interface Point2D {
  x: number;
  y: number;
}
⋮----
export function isSupportedScreenshotEntry(entry: ScreenshotEntryLike): boolean
⋮----
export function sortScreenshotEntries<T extends ScreenshotEntryLike>(entries: T[]): T[]
⋮----
export function normalizeSelection(selection: RectSelection): RectSelection
⋮----
export function createFullSelection(rendered: RenderedSize): RectSelection
⋮----
export function createInsetSelection(
  rendered: RenderedSize,
  insetRatio: number = screenshotFeatureConfig.editor.defaultInsetRatio,
): RectSelection
⋮----
export function clampSelectionToBounds(
  selection: RectSelection,
  rendered: RenderedSize,
  minSize: number = screenshotFeatureConfig.editor.minSelectionSize,
): RectSelection
⋮----
export function moveSelection(
  selection: RectSelection,
  deltaX: number,
  deltaY: number,
  rendered: RenderedSize,
): RectSelection
⋮----
export function resizeSelection(
  selection: RectSelection,
  handle: Exclude<SelectionHandle, 'move'>,
  deltaX: number,
  deltaY: number,
  rendered: RenderedSize,
  minSize: number = screenshotFeatureConfig.editor.minSelectionSize,
): RectSelection
⋮----
export function isPointInSelection(point: Point2D, selection: RectSelection): boolean
⋮----
export function getSelectionHandleAtPoint(
  point: Point2D,
  selection: RectSelection,
  handleRadius: number,
): SelectionHandle | null
⋮----
export function areSelectionsEqual(left: RectSelection | null, right: RectSelection | null): boolean
⋮----
export function roundSelection(selection: RectSelection): RectSelection
⋮----
export function selectionToMonitorRect(
  selection: RectSelection,
  rendered: RenderedSize,
  monitor: MonitorBounds,
): RectSelection
⋮----
export function selectionToPixelRect(
  selection: RectSelection,
  rendered: RenderedSize,
  image: PixelSize,
): RectSelection
⋮----
function clamp(value: number, min: number, max: number): number
````

## File: components/SettingsPage.tsx
````typescript
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Camera, FolderOpen, GitBranch, HardDrive, Image, LayoutGrid, MonitorPlay, Palette, Plus, Puzzle, RefreshCw, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, TerminalSquare, Trash2, Type, VolumeX } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useShallow } from 'zustand/react/shallow';
import type { LoadedOverlayAnimation } from './animationRuntime';
import { getOverlayWallpaperKindLabel, type LoadedOverlayWallpaper } from './wallpaperRuntime';
import {
  normalizeShaderControlValue,
  resolveShaderComputedUniforms,
  resolveShaderControlValues,
  type LoadedOverlayShader,
  type OverlayShaderControlDefinition,
  type OverlayShaderShellContext,
} from './shaderRuntime';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  overlayFontCatalog,
  overlayThemePresets,
  parseImportedTheme,
  serializeTheme,
  upsertCustomTheme,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import {
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getExternalTerminalProfileOptions,
  type ExternalTerminalProfile,
} from '../config/platform';
import {
  beginCloudAuth,
  clearCloudProviderConfiguration,
  disconnectCloudAccount,
  createExplorerDir,
  listCloudAccounts,
  listExplorerDir,
  openExplorerPath,
  pollCloudAuth,
  setCloudProviderConfiguration,
  type ExplorerCloudAccountSummary,
  type ExplorerCloudAccountsSnapshot,
  type ExplorerCloudProviderConfigurationSource,
  type ExplorerCloudProviderId,
} from '../runtime/explorerBackend';
import {
  createDefaultFolderIconRules,
  FOLDER_ICON_OPTIONS,
  getNamedFolderIconSrc,
  normalizeFolderIconMatcher,
  type FolderIconRule,
  type FolderIconValue,
} from '../config/folderIcons';
import {
  explorerViewModes,
  getExplorerViewModeDefinition,
} from '../config/explorerViewModes';
import { clampVideoHoverScrubFrameCount } from '../config/explorerThumbnails';
import {
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  buildExplorerContextMenuOverrideMap,
  createLegacyExplorerActionContextMenuContributions,
  isExplorerContextMenuItemEnabled,
  moveExplorerContextMenuItem,
  normalizePluginContextMenuContributions,
  sortExplorerContextMenuItems,
  withExplorerContextMenuItemEnabled,
} from '../config/explorerContextMenu';
import { getBuiltInIconTheme } from '../config/iconTheme';
import { animationSystemConfig, resolvePreferredAnimationId } from '../config/animations';
import {
  getOverlayWallpaperFitModeLabel,
  overlayWallpaperFitModes,
  wallpaperSystemConfig,
} from '../config/wallpapers';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LoadedLayoutManifest,
} from '../config/layoutProfiles';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import { pluginSystemConfig } from '../config/plugins';
import {
  getOverlayShaderSurfaceLabel,
  getShaderEnabledSurfaceIds,
  resolvePreferredShaderId,
} from '../config/shaders';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
} from '../config/overlayAnimations';
import {
  clampOverlayVisualControlValue,
  formatOverlayVisualControlValue,
  overlayVisualControls,
} from '../config/overlayWindow';
import {
  loadExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from '../config/performanceTelemetry';
import {
  formatHotkeyLabel,
  getHotkeyBindingDefinition,
  hotkeyBindingDefinitions,
  normalizeKeybindingValue,
  type HotkeyBindingKey,
} from '../config/hotkeys';
import { screenshotFeatureConfig, type ScreenshotOutputActionId } from '../config/screenshots';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import { useSettingsStore, resolveSystemPresentationState, type TerminalWindowMode } from '../store/settingsStore';
import { useTerminalStore } from '../store/terminalStore';
import {
  commands,
  unwrapTauriResult,
  type LinuxDisplayBackendPreference,
  type LinuxDisplayBackendStatus,
} from '../runtime/tauriClient';
⋮----
function ThemeBadge(
⋮----
if (previewUrl)
⋮----
function clampThemeDescription(text: string | undefined): string | null
⋮----
function getThemePackageSourceBadgeLabel(sourceKind: LoadedOverlayThemePackage['sourceKind']): string
⋮----
type ThemeCatalogSectionId = 'official-pilot' | 'built-in' | 'legacy-archive';
⋮----
function resolveThemeCatalogSectionId(
  theme: OverlayThemeDefinition,
  packageInfo: LoadedOverlayThemePackage | undefined,
): ThemeCatalogSectionId
⋮----
function getThemeCatalogBadgeLabel(
  sectionId: ThemeCatalogSectionId,
  packageInfo: LoadedOverlayThemePackage | undefined,
): string
⋮----
function getThemeCatalogSectionTitle(sectionId: ThemeCatalogSectionId): string
⋮----
function getThemeCatalogSectionSubtitle(sectionId: ThemeCatalogSectionId): string
⋮----
function getThemeCatalogEntrySortRank(packageInfo: LoadedOverlayThemePackage | undefined): number
⋮----
function getThemeCatalogCardOpacity(sectionId: ThemeCatalogSectionId): number
⋮----
onClick=
⋮----
<ThemeBadge label=

⋮----
key=
⋮----
<input type="color" value=
⋮----
onChange=
⋮----
if (control.formatValue)
⋮----
valueLabel=
⋮----
src=
⋮----
value=
````

## File: components/shaderRuntime.tsx
````typescript
import React, { type CSSProperties, useEffect, useMemo, useRef } from 'react';
⋮----
import type { OverlayThemeDefinition } from '../config/appearance';
import {
  shaderSystemConfig,
  type OverlayShaderSurfaceId,
} from '../config/shaders';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
⋮----
export interface ShaderFileEntry extends RuntimeFileEntry {}
⋮----
export type OverlayShaderSource = 'built-in' | 'folder';
⋮----
export interface OverlayShaderContext {
  id: string;
  name: string;
  filePath: string;
  shaderRoot: string;
  source: OverlayShaderSource;
}
⋮----
export interface OverlayShaderUniformMap {
  [key: string]: unknown;
}
⋮----
export interface OverlayShaderControlDefinition {
  id: string;
  label: string;
  description?: string;
  type?: 'slider';
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  formatValue?: (value: number) => string;
}
⋮----
export interface OverlayShaderShellContext extends OverlayShaderContext {
  viewport: {
    width: number;
    height: number;
  };
  accentColor: string;
  theme: OverlayThemeDefinition;
  panelTransparency: number;
  blurStrength: number;
  zoom: number;
  isSettingsActive: boolean;
  shaderControlValues: Record<string, number>;
}
⋮----
export interface OverlayShaderRenderContext extends OverlayShaderShellContext {
  surface: OverlayShaderSurfaceId;
  sharedUniforms: OverlayShaderUniformMap;
}
⋮----
export interface OverlayShaderSurfaceProps {
  context: OverlayShaderRenderContext;
}
⋮----
export interface OverlayShaderSurfaceDefinition {
  resolveStyle?: (context: OverlayShaderRenderContext) => CSSProperties | null | undefined;
  render?: React.ComponentType<OverlayShaderSurfaceProps>;
}
⋮----
export interface OverlayShaderDefinition {
  id?: string;
  name?: string;
  description?: string;
  group?: string;
  tags?: string[];
  controls?: OverlayShaderControlDefinition[];
  resolveSharedUniforms?: (
    context: OverlayShaderShellContext,
  ) => OverlayShaderUniformMap | null | undefined;
  background?: OverlayShaderSurfaceDefinition;
  topBar?: OverlayShaderSurfaceDefinition;
  border?: OverlayShaderSurfaceDefinition;
}
⋮----
export interface LoadedOverlayShader extends OverlayShaderContext {
  modified: number;
  description?: string;
  group: string;
  tags: string[];
  controls: OverlayShaderControlDefinition[];
  resolveSharedUniforms?: OverlayShaderDefinition['resolveSharedUniforms'];
  background: OverlayShaderSurfaceDefinition | null;
  topBar: OverlayShaderSurfaceDefinition | null;
  border: OverlayShaderSurfaceDefinition | null;
  error: string | null;
}
⋮----
export interface LoadShaderFromSourceOptions {
  context?: Partial<OverlayShaderContext>;
}
⋮----
export function defineShader(definition: OverlayShaderDefinition): OverlayShaderDefinition
⋮----
export function clamp01(value: number): number
⋮----
export function lerp(from: number, to: number, progress: number): number
⋮----
export function isFrontendShaderFile(entry: ShaderFileEntry): boolean
⋮----
export function deriveShaderId(name: string): string
⋮----
export function deriveShaderName(name: string): string
⋮----
export async function loadShaderFromSource(
  source: string,
  entry: ShaderFileEntry,
  options?: LoadShaderFromSourceOptions,
): Promise<LoadedOverlayShader>
⋮----
export function createBuiltInOverlayShaders(): LoadedOverlayShader[]
⋮----
export function mergeOverlayShaders(
  builtInShaders: LoadedOverlayShader[],
  authoredShaders: LoadedOverlayShader[],
): LoadedOverlayShader[]
⋮----
export function resolveShaderComputedUniforms(
  shader: LoadedOverlayShader | null,
  shellContext: OverlayShaderShellContext,
): OverlayShaderUniformMap
⋮----
function getStepPrecision(step: number): number
⋮----
export function normalizeShaderControlValue(
  control: OverlayShaderControlDefinition,
  value: number,
  fallbackValue?: number,
): number
⋮----
export function resolveShaderControlValues(
  shader: LoadedOverlayShader | null,
  persistedValues?: Record<string, number> | null,
  computedUniforms?: OverlayShaderUniformMap,
): Record<string, number>
⋮----
export function resolveShaderSharedUniforms(
  shader: LoadedOverlayShader | null,
  shellContext: OverlayShaderShellContext,
): OverlayShaderUniformMap
⋮----
export function buildShaderRenderContext(args: {
  shader: LoadedOverlayShader | null;
  shellContext: OverlayShaderShellContext;
  surface: OverlayShaderSurfaceId;
}): OverlayShaderRenderContext
⋮----
export function resolveShaderSurfaceStyle(
  shader: LoadedOverlayShader | null,
  context: OverlayShaderRenderContext,
): CSSProperties
⋮----
function ensureBuiltInShaderAnimationStyles(): void
⋮----
function createBuiltInShader(definition: OverlayShaderDefinition &
⋮----
function executeShaderModule(code: string): unknown
⋮----
function normalizeShaderExport(
  exported: unknown,
  fallbackContext: OverlayShaderContext,
): OverlayShaderDefinition
⋮----
function normalizeControlDefinitions(
  controls: OverlayShaderControlDefinition[] | undefined,
): OverlayShaderControlDefinition[]
⋮----
function normalizeControlDefinition(control: OverlayShaderControlDefinition): OverlayShaderControlDefinition
⋮----
function normalizeSurfaceDefinition(
  surface: OverlayShaderSurfaceDefinition | undefined,
  label: OverlayShaderSurfaceId,
): OverlayShaderSurfaceDefinition | null
⋮----
type CanvasAnimatorListener = (nowMs: number) => void;
⋮----
// One shared animator for all canvas-backed shader surfaces.
⋮----
const tick = (nowMs: number) =>
⋮----
// Skip heavy canvas draws while hidden; keep the animator alive so it resumes smoothly.
⋮----
const startIfNeeded = () =>
⋮----
subscribe(listener: CanvasAnimatorListener)
⋮----
const render = (nowMs: number) =>
⋮----
// Resizing a canvas resets all context state; set these every frame to keep it correct.
⋮----
constructor(props:
⋮----
static getDerivedStateFromError():
⋮----
override componentDidCatch(error: unknown)
⋮----
override componentDidUpdate(prevProps:
⋮----
override render()
````

## File: components/terminalCommandUtils.ts
````typescript
function escapeSingleQuotedPath(path: string): string
⋮----
function shellExecutableName(shell: string): string
⋮----
export function buildTerminalCdCommand(path: string, shell: string): string
````

## File: components/TerminalOverlay.tsx
````typescript
/**
 * TerminalOverlay — UE5 Content Drawer-style native terminal
 *
 * Features:
 *  ✓ Full colour-theme system (Operator, Dracula, Nord, Monokai, GitHub Dark, Catppuccin)
 *  ✓ UI-wide font selection (Inter, JetBrains Mono, Geist, etc.)
 *  ✓ Solid docked appearance — no blur, heavy accent top border
 *  ✓ Compact icon-rail sidebar + expandable panel
 *  ✓ Chrome-style tabs with rename on double-click
 *  ✓ Drag-to-resize via native Tauri startResizeDragging
 *  ✓ Status bar
 */
⋮----
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  X,
  Terminal as TerminalIcon,
  Bot,
  Folder,
  Play,
  Hash,
  Plus,
  Rocket,
  Trash2,
  TerminalSquare,
  ChevronLeft,
  ChevronRight,
  Zap,
  Circle,
  Copy,
  Eraser,
  RotateCcw,
  SplitSquareHorizontal,
  SplitSquareVertical,
  SquarePlus,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
⋮----
import {
  ensureFontFamilyLoaded,
  multiplyColorAlpha,
  resolveOverlayAppearance,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import type { ResolvedWorkbenchThemeRecipe } from '../config/workbenchTheme';
import {
  buildManagedPythonReplCommand,
  createPythonRuntimeConfig,
  formatCommandOutput,
  pythonQuickPackagePresets,
  pythonExamplePresets,
  summarizeInterpreter,
  type PythonActionResponse,
  type PythonExamplePreset,
  type PythonRuntimeStatus,
} from '../config/python';
import { detectClientPlatform, type RuntimePlatform } from '../config/platform';
import { useExplorerStore } from '../store/explorerStore';
import { useTerminalStore, type Bookmark } from '../store/terminalStore';
import { buildTerminalCdCommand } from './terminalCommandUtils';
import {
  dispatchTerminalCommand,
  type OverlayPluginCommandContribution,
  type OverlayTerminalCommandInjectionDetail,
} from '../config/pluginContributions';
import { useSettingsStore } from '../store/settingsStore';
import { OverlayScrollArea } from './OverlayScrollArea';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import {
  collectTerminalPaneGeometry,
  collectTerminalPaneIds,
  countTerminalPanes,
  createTerminalPaneLayout,
  describeTerminalPaneLayout,
  getImmediatePaneSplitDirection,
  removeTerminalPaneFromLayout,
  splitTerminalPaneLayout,
  updateTerminalPaneSplitRatio,
  type TerminalPaneFrame,
  type TerminalPaneLayoutNode,
  type TerminalPaneSplitHandle,
  type TerminalSplitDirection,
} from './terminalPaneLayout';
⋮----
export type ThemeId = 'operator' | 'dracula' | 'nord' | 'monokai' | 'github-dark' | 'catppuccin';
⋮----
interface Theme {
  name: string;
  bg: string;
  bgPanel: string;
  bgTerm: string;
  statusBg?: string;
  accent: string;
  text: string;
  textMuted: string;
  border: string;
  // xterm colours
  xt: {
    background: string; foreground: string; cursor: string;
    black: string; red: string; green: string; yellow: string;
    blue: string; magenta: string; cyan: string; white: string;
    brightBlack: string; brightRed: string; brightGreen: string;
    brightYellow: string; brightBlue: string; brightMagenta: string;
    brightCyan: string; brightWhite: string;
  };
}
⋮----
// xterm colours
⋮----
function themeFromAppearance(
  theme: OverlayThemeDefinition,
  workbenchTheme: ResolvedWorkbenchThemeRecipe,
): Theme
⋮----
// ─── UI Font catalogue ────────────────────────────────────────────────────────
⋮----
// Inject Google Fonts link on demand
⋮----
function ensureFont(font: string)
⋮----
// ─── Types ────────────────────────────────────────────────────────────────────
⋮----
interface TerminalPaneSession {
  id: string;
  label: string;
  createdAt: number;
}
interface Tab {
  id: string;
  label: string;
  layout: TerminalPaneLayoutNode;
  activePaneId: string;
  lastSplitDirection: TerminalSplitDirection;
  broadcastInput: boolean;
  createdAt: number;
}
interface TerminalPaneTelemetry {
  outputBytes: number;
  outputLines: number;
  lastOutputAt: number | null;
  lastFocusAt: number | null;
  rows: number | null;
  cols: number | null;
}
type SidebarPanel = 'dirs' | 'cmds' | 'python' | null;
type SidebarPanelId = Exclude<SidebarPanel, null>;
⋮----
function createPaneTelemetry(): TerminalPaneTelemetry
⋮----
function getShellDisplayLabel(shell: string): string
⋮----
function countPayloadLines(payload: string): number
⋮----
interface TerminalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders as embedded panel (no outer slide animation, no grab handle) */
  embedded?: boolean;
  appearance?: ResolvedOverlayAppearance;
  pluginCommands?: OverlayPluginCommandContribution[];
}
⋮----
/** When true, renders as embedded panel (no outer slide animation, no grab handle) */
⋮----
// ─── XTerm registry ───────────────────────────────────────────────────────────
⋮----
interface XTermEntry { xterm: XTerm; fitAddon: FitAddon; unlisten: () => void; }
⋮----
function destroyXterm(id: string)
⋮----
function collectTerminalBufferText(xterm: XTerm): string
⋮----
async function copyTextToClipboard(text: string): Promise<boolean>
⋮----
// Fall back to execCommand for environments without clipboard permissions.
⋮----
function formatCopiedLineLabel(text: string): string
⋮----
interface TerminalToolbarAction {
  id: string;
  label: string;
  title: string;
  icon?: ComponentType<{ size?: number }>;
  separator?: true;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'default';
}
⋮----
interface TerminalActionToolbarProps {
  actions: TerminalToolbarAction[];
  theme: Theme;
  detail: string;
}
⋮----
// ─── XTermPane ────────────────────────────────────────────────────────────────
⋮----
interface XTermPaneProps {
  id: string;
  visible: boolean;
  active: boolean;
  theme: Theme;
  onReady?: (id: string) => void;
  onFocus?: (id: string) => void;
  onData?: (id: string, data: string) => void;
  onOutput?: (id: string, payload: string) => void;
  onResize?: (id: string, rows: number, cols: number) => void;
}
⋮----
function XTermPane({
  id,
  visible,
  active,
  theme,
  onReady,
  onFocus,
  onData,
  onOutput,
  onResize,
}: XTermPaneProps)
⋮----
const scheduleFit = () =>
⋮----
const flushBufferedOutput = () =>
⋮----
const scheduleBufferedFlush = () =>
⋮----
const handlePointerDown = ()
⋮----
// ─── Bookmark chip ────────────────────────────────────────────────────────────
⋮----
interface ChipProps {
  bm: Bookmark; icon: React.ReactNode; accentStyle: string;
  onPrimary: () => void; onRun?: () => void; onDelete?: () => void;
}
⋮----
// ─── Mini adder ───────────────────────────────────────────────────────────────
⋮----
<input value=
⋮----
disabled=
⋮----
// ─── Sidebar content ──────────────────────────────────────────────────────────
⋮----
onConfirm=
onCancel=
⋮----
onPrimary=
⋮----
// ─── Main component ───────────────────────────────────────────────────────────
⋮----
const handler = (e: Event) =>
⋮----
const clampRatio = (nextRatio: number)
⋮----
const updateFromPointer = (clientX: number, clientY: number) =>
⋮----
const handlePointerMove = (moveEvent: PointerEvent) =>
const handlePointerUp = () =>
⋮----
onMouseDown=
⋮----
onClick=
⋮----
const owner = findTabForPane(id);
if (owner)
focusPane(owner.id, id);
⋮----
e.preventDefault();
⋮----
const onMouseUp = () =>
window.removeEventListener('mouseup', onMouseUp);
⋮----
onPointerDown=
⋮----
setActiveTabId(tab.id);
focusPane(tab.id, tab.activePaneId);
⋮----
onDoubleClick=
````

## File: components/terminalPaneLayout.ts
````typescript
export type TerminalSplitDirection = "columns" | "rows";
⋮----
export interface TerminalPaneLeafNode {
  kind: "leaf";
  paneId: string;
}
⋮----
export interface TerminalPaneSplitNode {
  kind: "split";
  splitId: string;
  direction: TerminalSplitDirection;
  ratio: number;
  first: TerminalPaneLayoutNode;
  second: TerminalPaneLayoutNode;
}
⋮----
export type TerminalPaneLayoutNode =
  | TerminalPaneLeafNode
  | TerminalPaneSplitNode;
⋮----
export interface TerminalPaneSplitResult {
  layout: TerminalPaneLayoutNode;
  inserted: boolean;
}
⋮----
export interface TerminalPaneRemoveResult {
  layout: TerminalPaneLayoutNode | null;
  removed: boolean;
  fallbackPaneId: string | null;
}
⋮----
export interface TerminalPaneFrame {
  paneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
⋮----
export interface TerminalPaneSplitHandle {
  splitId: string;
  direction: TerminalSplitDirection;
  x: number;
  y: number;
  width: number;
  height: number;
  containerX: number;
  containerY: number;
  containerWidth: number;
  containerHeight: number;
}
⋮----
export interface TerminalPaneGeometry {
  frames: TerminalPaneFrame[];
  handles: TerminalPaneSplitHandle[];
}
⋮----
export function clampTerminalSplitRatio(value: number): number
⋮----
export function createTerminalPaneLayout(
  paneId: string,
): TerminalPaneLayoutNode
⋮----
export function collectTerminalPaneIds(
  layout: TerminalPaneLayoutNode,
): string[]
⋮----
export function countTerminalPanes(layout: TerminalPaneLayoutNode): number
⋮----
export function describeTerminalPaneLayout(
  layout: TerminalPaneLayoutNode,
): string
⋮----
export function collectTerminalPaneGeometry(
  layout: TerminalPaneLayoutNode,
  box: { x: number; y: number; width: number; height: number } = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  },
): TerminalPaneGeometry
⋮----
export function getImmediatePaneSplitDirection(
  layout: TerminalPaneLayoutNode,
  paneId: string,
  parentDirection: TerminalSplitDirection | null = null,
): TerminalSplitDirection | null
⋮----
export function splitTerminalPaneLayout(
  layout: TerminalPaneLayoutNode,
  targetPaneId: string,
  direction: TerminalSplitDirection,
  newPaneId: string,
  createSplitId: () => string,
): TerminalPaneSplitResult
⋮----
export function updateTerminalPaneSplitRatio(
  layout: TerminalPaneLayoutNode,
  splitId: string,
  ratio: number,
): TerminalPaneLayoutNode
⋮----
export function removeTerminalPaneFromLayout(
  layout: TerminalPaneLayoutNode,
  targetPaneId: string,
): TerminalPaneRemoveResult
````

## File: components/themeRendererRuntime.tsx
````typescript
import React from 'react';
⋮----
import type { OverlayThemeDefinition, ResolvedOverlayAppearance } from '../config/appearance';
import type { LayoutProfile } from '../config/layoutProfiles';
import type {
  ResolvedWorkbenchRenderRuntime,
  WorkbenchNavigationMetadata,
  WorkbenchRenderRuntimeKind,
} from '../config/workbenchRenderRuntime';
import type {
  LoadedOverlayWallpaper,
  OverlayWallpaperRenderContext,
  ResolvedWallpaperSelection,
} from './wallpaperRuntime';
import type { OverlayPanelDefinition } from '../panels/panelRegistry';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModuleGraph,
  transpileRuntimeModuleGraph,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleSourceResolver,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
import {
  defaultOverlayThemeRendererSurfaceOwnership,
  normalizeOverlayThemeRendererSurfaceOwnership,
  type OverlayThemeRendererShellModel,
  type OverlayThemeRendererSurfaceOwnership,
} from './themeRendererShellModel';
⋮----
export interface ThemeRendererFileEntry extends RuntimeFileEntry {}
⋮----
export interface OverlayThemeRendererCapabilities {
  customScreens: boolean;
  wallpaperScene: boolean;
  surfaceAdapters: boolean;
}
⋮----
export interface OverlayThemeRendererContext {
  id: string;
  name: string;
  filePath: string;
  rendererRoot: string;
  entryModule: string;
}
⋮----
export interface OverlayThemeRendererPanel {
  id: string;
  label: string;
  description: string;
  kind: OverlayPanelDefinition['kind'];
  icon: React.ReactNode;
  navigation?: WorkbenchNavigationMetadata;
  defaultOpen: boolean;
  keepMounted: boolean;
  isActive: boolean;
  isOpen: boolean;
  isPinned: boolean;
}
⋮----
export interface OverlayThemeRendererLayoutContext {
  windowMode: 'overlay' | 'windowed';
  overlayAnchor: 'top' | 'bottom';
  isWindowMaximized: boolean;
  shellBackgroundColor: string;
  shellBackdropFilter: string;
  usesNavigationSidebar: boolean;
  usesInsetContentShell: boolean;
  contentStagePadding: number;
  scaledWidth: string;
  scaledHeight: string;
}
⋮----
export interface OverlayThemeRendererWallpaperContext {
  activeWallpaper: LoadedOverlayWallpaper | null;
  themeWallpaper: LoadedOverlayWallpaper | null;
  selection: ResolvedWallpaperSelection;
  renderContext: OverlayWallpaperRenderContext;
  renderBackground: (contextOverrides?: Partial<OverlayWallpaperRenderContext>) => React.ReactNode;
  renderBackdropStack: () => React.ReactNode;
}
⋮----
export interface OverlayThemeRendererHost {
  appearance: ResolvedOverlayAppearance;
  theme: OverlayThemeDefinition;
  layoutProfile: LayoutProfile;
  renderRuntime: ResolvedWorkbenchRenderRuntime;
  layout: OverlayThemeRendererLayoutContext;
  shellModel: OverlayThemeRendererShellModel;
  panels: OverlayThemeRendererPanel[];
  activePanelId: string | null;
  openPanelIds: string[];
  pinnedPanelIds: string[];
  wallpaper: OverlayThemeRendererWallpaperContext;
  activatePanel: (panelId: string) => void;
  openPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  togglePanel: (panelId: string) => void;
  openSettings: () => void;
  renderDefaultChromeSurface: () => React.ReactNode;
  renderChromeBar: () => React.ReactNode;
  renderUtilityActionsSurface: () => React.ReactNode;
  renderDefaultNavigationSurface: () => React.ReactNode;
  renderPanelSurface: (
    panelId: string,
    options?: {
      forceMount?: boolean;
      forceVisible?: boolean;
      style?: React.CSSProperties;
    },
  ) => React.ReactNode;
  renderPinnedPanels: (side: 'left' | 'right') => React.ReactNode;
  renderDefaultContentSurface: () => React.ReactNode;
  renderDefaultShellBody: () => React.ReactNode;
}
⋮----
export interface OverlayThemeRendererProps {
  renderer: OverlayThemeRendererContext;
  host: OverlayThemeRendererHost;
}
⋮----
export interface OverlayThemeRendererDefinition {
  id?: string;
  name?: string;
  description?: string;
  apiVersion?: number;
  supportsLiveSwap?: boolean;
  fallbackRuntime?: WorkbenchRenderRuntimeKind;
  capabilities?: Partial<OverlayThemeRendererCapabilities>;
  surfaceOwnership?: Partial<OverlayThemeRendererSurfaceOwnership>;
  component: React.ComponentType<OverlayThemeRendererProps>;
}
⋮----
export interface LoadedOverlayThemeRenderer extends OverlayThemeRendererContext {
  description?: string;
  apiVersion: number;
  supportsLiveSwap: boolean;
  fallbackRuntime: WorkbenchRenderRuntimeKind | null;
  capabilities: OverlayThemeRendererCapabilities;
  surfaceOwnership: OverlayThemeRendererSurfaceOwnership;
  component: React.ComponentType<OverlayThemeRendererProps> | null;
  error: string | null;
}
⋮----
export interface LoadThemeRendererFromSourceOptions {
  context?: Partial<OverlayThemeRendererContext>;
  defaults?: Partial<Omit<OverlayThemeRendererDefinition, 'component'>>;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}
⋮----
export function defineThemeRenderer(
  definition: OverlayThemeRendererDefinition,
): OverlayThemeRendererDefinition
⋮----
export function deriveThemeRendererId(name: string): string
⋮----
export function deriveThemeRendererName(name: string): string
⋮----
export async function loadThemeRendererFromSource(
  source: string,
  entry: ThemeRendererFileEntry,
  options?: LoadThemeRendererFromSourceOptions,
): Promise<LoadedOverlayThemeRenderer>
⋮----
export function ThemeRendererBoundary({
  renderer,
  render,
  fallback,
  onError,
}: {
  renderer: LoadedOverlayThemeRenderer;
render: (component: React.ComponentType<OverlayThemeRendererProps>)
⋮----
function executeThemeRendererModuleGraph(graph: RuntimeModuleGraph): unknown
⋮----
function normalizeThemeRendererExport(
  exported: unknown,
  fallbackContext: OverlayThemeRendererContext,
): OverlayThemeRendererDefinition
⋮----
class ThemeRendererErrorBoundary extends React.Component<
⋮----
constructor(props: {
    rendererName: string;
    children: React.ReactNode;
    fallback: React.ReactNode;
onError?: (error: Error)
⋮----
static getDerivedStateFromError():
⋮----
override componentDidCatch(error: Error)
⋮----
override componentDidUpdate(prevProps:
⋮----
override render()
````

## File: components/themeRendererShellModel.ts
````typescript
import type { ReactNode } from 'react';
⋮----
export interface OverlayThemeRendererSurfaceOwnership {
  chrome: boolean;
  launcher: boolean;
  contentFrame: boolean;
  pinnedPanels: boolean;
  wallpaper: boolean;
}
⋮----
export function normalizeOverlayThemeRendererSurfaceOwnership(
  value: Partial<OverlayThemeRendererSurfaceOwnership> | undefined,
): OverlayThemeRendererSurfaceOwnership
⋮----
export interface OverlayThemeRendererLayoutRegion {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}
⋮----
export interface OverlayThemeRendererShellLayoutModel {
  viewportWidth: number;
  viewportHeight: number;
  shellInset: number;
  panelGap: number;
  contentInnerPadding: number;
  regions: {
    chrome: OverlayThemeRendererLayoutRegion;
    launcher: OverlayThemeRendererLayoutRegion;
    content: OverlayThemeRendererLayoutRegion;
    pinnedLeft: OverlayThemeRendererLayoutRegion;
    pinnedRight: OverlayThemeRendererLayoutRegion;
  };
}
⋮----
export interface NormalizeThemeRendererShellLayoutArgs {
  viewportWidth: number;
  viewportHeight: number;
  shellInset: number;
  panelGap: number;
  contentInnerPadding: number;
  chromeHeight: number;
  launcherVisible: boolean;
  launcherWidth: number;
  leftPinnedWidth: number;
  rightPinnedWidth: number;
}
⋮----
export interface OverlayThemeRendererShellLauncherPanelModel {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  isActive: boolean;
  isOpen: boolean;
  isPinned: boolean;
  activate: () => void;
}
⋮----
export interface OverlayThemeRendererShellLauncherGroupModel {
  id: string;
  label: string;
  order: number;
  panels: OverlayThemeRendererShellLauncherPanelModel[];
}
⋮----
export interface OverlayThemeRendererShellLauncherModel {
  railWidth: number;
  groups: OverlayThemeRendererShellLauncherGroupModel[];
  panels: OverlayThemeRendererShellLauncherPanelModel[];
}
⋮----
export interface OverlayThemeRendererShellChromeActionModel {
  id: string;
  label: string;
  title: string;
  icon?: ReactNode;
  isActive?: boolean;
  isVisible: boolean;
  onSelect: () => void;
}
⋮----
export interface OverlayThemeRendererShellChromeModel {
  utilityActions: OverlayThemeRendererShellChromeActionModel[];
}
⋮----
export interface OverlayThemeRendererShellModel {
  layout: OverlayThemeRendererShellLayoutModel;
  launcher: OverlayThemeRendererShellLauncherModel;
  chrome: OverlayThemeRendererShellChromeModel;
}
⋮----
function clamp(value: number, min: number, max: number): number
⋮----
function createHiddenRegion(): OverlayThemeRendererLayoutRegion
⋮----
function shrinkWidths(
  widths: {
    launcher: number;
    pinnedLeft: number;
    pinnedRight: number;
  },
  overflow: number,
):
⋮----
export function normalizeThemeRendererShellLayout(
  args: NormalizeThemeRendererShellLayoutArgs,
): OverlayThemeRendererShellLayoutModel
````

## File: components/wallpaperRuntime.tsx
````typescript
import React, { type CSSProperties } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
⋮----
import type { OverlayThemeDefinition } from '../config/appearance';
import {
  normalizeOverlayWallpaperFitMode,
  wallpaperSystemConfig,
  type OverlayWallpaperFitMode,
} from '../config/wallpapers';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
⋮----
export interface WallpaperFileEntry extends RuntimeFileEntry {}
⋮----
export type OverlayWallpaperSource = 'folder' | 'theme-asset';
export type OverlayWallpaperKind = 'image' | 'video' | 'live';
⋮----
export interface OverlayWallpaperContext {
  id: string;
  name: string;
  filePath: string;
  wallpaperRoot: string;
  source: OverlayWallpaperSource;
  kind: OverlayWallpaperKind;
  assetUrl?: string;
  previewUrl?: string;
}
⋮----
export interface OverlayWallpaperRenderContext {
  wallpaper: OverlayWallpaperContext;
  theme: OverlayThemeDefinition;
  viewport: {
    width: number;
    height: number;
  };
  fitMode: OverlayWallpaperFitMode;
  opacity: number;
  muted: boolean;
  motionEnabled: boolean;
}
⋮----
export interface OverlayWallpaperBackgroundProps {
  context: OverlayWallpaperRenderContext;
}
⋮----
export interface OverlayWallpaperDefinition {
  id?: string;
  name?: string;
  description?: string;
  group?: string;
  tags?: string[];
  previewUrl?: string;
  renderBackground: React.ComponentType<OverlayWallpaperBackgroundProps>;
}
⋮----
export interface LoadedOverlayWallpaper extends OverlayWallpaperContext {
  modified: number;
  description?: string;
  group: string;
  tags: string[];
  renderBackground: React.ComponentType<OverlayWallpaperBackgroundProps> | null;
  error: string | null;
}
⋮----
export interface LoadWallpaperFromSourceOptions {
  context?: Partial<OverlayWallpaperContext>;
}
⋮----
export interface ResolvedWallpaperSelection {
  wallpaper: LoadedOverlayWallpaper | null;
  source: 'theme' | 'user' | 'none';
  effectiveId: string | null;
}
⋮----
export function defineWallpaper(definition: OverlayWallpaperDefinition): OverlayWallpaperDefinition
⋮----
export function clamp01(value: number): number
⋮----
export function lerp(from: number, to: number, progress: number): number
⋮----
export function useWallpaperContextRef<T>(value: T): React.MutableRefObject<T>
⋮----
export function isFrontendWallpaperFile(entry: WallpaperFileEntry): boolean
⋮----
export function isMediaWallpaperFile(entry: WallpaperFileEntry): boolean
⋮----
export function isSupportedWallpaperFile(entry: WallpaperFileEntry): boolean
⋮----
export function deriveWallpaperId(name: string): string
⋮----
export function deriveWallpaperName(name: string): string
⋮----
export function getOverlayWallpaperKindLabel(kind: OverlayWallpaperKind): string
⋮----
export function resolveWallpaperAssetUrl(filePath: string): string
⋮----
function detectWallpaperKindFromExtension(extension: string): OverlayWallpaperKind
⋮----
function getFitObjectStyle(fitMode: OverlayWallpaperFitMode): CSSProperties['objectFit']
⋮----
const ImageWallpaperBackground = (
⋮----
export function createThemeAssetWallpaper(args: {
  themeId: string;
  themeName: string;
  assetUrl: string;
  filePath?: string;
}): LoadedOverlayWallpaper
⋮----
export function resolveActiveWallpaper(args: {
  availableWallpapers: Iterable<LoadedOverlayWallpaper>;
  userOverrideId?: string | null;
  themeWallpaper?: LoadedOverlayWallpaper | null;
}): ResolvedWallpaperSelection
⋮----
function executeWallpaperModule(code: string): unknown
⋮----
function normalizeWallpaperExport(
  exported: unknown,
  fallbackContext: OverlayWallpaperContext,
): OverlayWallpaperDefinition
⋮----
class WallpaperBackgroundBoundary extends React.Component<
⋮----
constructor(props:
⋮----
static getDerivedStateFromError():
⋮----
override componentDidCatch(error: unknown)
⋮----
override componentDidUpdate(prevProps:
⋮----
override render()
````

## File: components/WindowControls.tsx
````typescript
/**
 * WindowControls - Platform-adaptive traffic light / title bar buttons.
 *
 * - macOS: coloured dot cluster (top-left), matching native HIG sizing.
 * - Windows / Linux: horizontal strip (top-right), Win11-style.
 *
 * The component is fully self-contained and communicates exclusively
 * via the Tauri WebviewWindow API — no Rust commands needed.
 */
⋮----
import { useCallback, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type RuntimePlatform } from '../config/platform';
⋮----
interface WindowControlsProps {
  platform: RuntimePlatform;
  isMaximized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  /** Accent color for hover tints (Windows) */
  accent?: string;
  textMuted?: string;
}
⋮----
/** Accent color for hover tints (Windows) */
⋮----
// ─── macOS traffic lights ──────────────────────────────────────────────────────
⋮----
function MacOSDot({
  color,
  hoverColor,
  symbol,
  title,
  onClick,
}: {
  color: string;
  hoverColor: string;
  symbol: string;
  title: string;
onClick: ()
⋮----
onMouseEnter=
⋮----
onMouseLeave=
⋮----
// Prevent the drag region from swallowing click events on the dots
⋮----
// ─── Windows / Linux controls ─────────────────────────────────────────────────
⋮----
onMouseDown=
⋮----
// ─── Public component ─────────────────────────────────────────────────────────
⋮----
// Default close hides the window (overlay app - don't quit on X)
````

## File: components/WorkbenchNavigationSurface.tsx
````typescript
import { useMemo } from 'react';
⋮----
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  groupPanelsForWorkbenchNavigation,
  type ResolvedWorkbenchRenderRuntime,
} from '../config/workbenchRenderRuntime';
import { OverlayScrollArea } from './OverlayScrollArea';
import type { OverlayPanelDefinition } from '../panels/panelRegistry';
⋮----
interface WorkbenchNavigationSurfaceProps {
  appearance: ResolvedOverlayAppearance;
  runtime: ResolvedWorkbenchRenderRuntime;
  panels: OverlayPanelDefinition[];
  pinnedPanelIds: string[];
  activePanelId: string | null;
  openPanelIds: string[];
  onActivatePanel: (panelId: string) => void;
}
````

## File: config/animations.ts
````typescript
import { getManagedContentDirectory } from './appContentDirectories';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
⋮----
export function resolveAnimationsDirectory(): string
⋮----
get animationsDirectory(): string
⋮----
export type FrontendAnimationExtension =
  typeof animationSystemConfig.frontendExtensions[number];
⋮----
export function resolvePreferredAnimationId(args: {
  availableAnimationIds: Iterable<string>;
  userOverrideId?: string | null;
  themeDefaultAnimationId?: string | null;
  fallbackAnimationId?: string;
}): string
````

## File: config/appContentDirectories.ts
````typescript
import { isTauri } from '@tauri-apps/api/core';
import { appLocalDataDir, homeDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, rename } from '@tauri-apps/plugin-fs';
⋮----
export type ManagedContentDirectoryId =
  | 'plugins'
  | 'themes'
  | 'shaders'
  | 'animations'
  | 'wallpapers'
  | 'notes'
  | 'screenshots';
⋮----
function readDirectoryOverride(id: ManagedContentDirectoryId): string | null
⋮----
function normalizePathForComparison(path: string): string
⋮----
function shouldUseReleaseManagedDirectories(): boolean
⋮----
async function buildReleaseManagedDirectoryMap(): Promise<Record<ManagedContentDirectoryId, string>>
⋮----
async function buildLegacyHomeDirectoryMap(): Promise<Record<ManagedContentDirectoryId, string>>
⋮----
function replaceTrailingDirectoryName(path: string, fromName: string, toName: string): string | null
⋮----
async function buildLegacyReleaseDirectoryMap(): Promise<Partial<Record<ManagedContentDirectoryId, string>>>
⋮----
async function migrateLegacyDirectory(
  legacyDirectory: string | undefined,
  nextDirectory: string,
): Promise<void>
⋮----
export async function initializeManagedContentDirectories(): Promise<void>
⋮----
export function getManagedContentDirectory(id: ManagedContentDirectoryId): string
⋮----
export function isLegacyScreenshotDirectory(path: string | null | undefined): boolean
````

## File: config/appearance.ts
````typescript
import type {
  ThemeChromeStyle as GeneratedThemeChromeStyle,
  ThemeDensity as GeneratedThemeDensity,
  ThemeIconStyle as GeneratedThemeIconStyle,
  ThemeMotionStyle as GeneratedThemeMotionStyle,
  ThemePresentation as GeneratedThemePresentation,
} from '../generated/tauri';
import {
  normalizeExplorerThemeRecipe,
  resolveExplorerThemeRecipe,
  type OverlayExplorerThemeRecipe,
  type ResolvedExplorerThemeRecipe,
} from './explorerTheme';
import {
  normalizeWorkbenchThemeRecipe,
  resolveWorkbenchThemeRecipe,
  type OverlayWorkbenchThemeRecipe,
  type ResolvedWorkbenchThemeRecipe,
} from './workbenchTheme';
import {
  compileThemeEngineManifest,
  type CompiledThemeEngineManifest,
  type ExplorerThemeManifest,
} from '../runtime/themeEngineBackend';
import type { LoadedOverlayThemeRenderer } from '../components/themeRendererRuntime';
import type { OverlayShellBlueprintId } from './shellBlueprints';
import { mergeResolvedIconThemes, type OverlayResolvedIconTheme } from './iconTheme';
import { clampOverlayVisualControlValue } from './overlayWindow';
import {
  DEFAULT_PILOT_DARK_THEME_ID,
  DEFAULT_PILOT_LIGHT_THEME_ID,
  DEFAULT_PILOT_MONO_FONT_FAMILY,
  DEFAULT_PILOT_UI_FONT_FAMILY,
  pilotDockExplorerThemeRecipe,
  pilotDockWorkbenchThemeRecipe,
  pilotExplorerThemeRecipe,
  pilotWorkbenchThemeRecipe,
} from './pilotThemeContract';
⋮----
export interface OverlayXTermTheme {
  background: string;
  foreground: string;
  cursor: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}
⋮----
export interface OverlayThemePalette {
  appBackground: string;
  appBackgroundAlt: string;
  shellBackground: string;
  shellBackgroundSolid: string;
  topBarBackground: string;
  topBarMenuBackground: string;
  sidebarBackground: string;
  panelBackground: string;
  panelAltBackground: string;
  cardBackground: string;
  cardHoverBackground: string;
  contextMenuBackground: string;
  inputBackground: string;
  terminalBackground: string;
  selectionBackground: string;
  scrimBackground: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentContrast: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  note: string;
  todo: string;
  bug: string;
  prompt: string;
}
⋮----
export interface OverlayThemeEffects {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  shadow: string;
  overlayShadow: string;
}
⋮----
export type OverlayThemeSource = 'built-in' | 'custom' | 'package';
⋮----
export interface OverlayThemeVisualAnimation {
  kind: 'drift' | 'pulse' | 'pan';
  durationMs?: number;
  easing?: string;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
}
⋮----
export interface OverlayThemeVisualLayer {
  id: string;
  backgroundImage: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  opacity?: number;
  blendMode?: string;
  filter?: string;
  inset?: string;
  animation?: OverlayThemeVisualAnimation;
}
⋮----
export interface OverlayThemeAssets {
  packageRoot?: string;
  manifestPath?: string;
  backgroundUrl?: string;
  previewUrl?: string;
  iconTheme?: OverlayResolvedIconTheme;
  iconEntries?: Record<string, string>;
}
⋮----
export interface OverlayThemeFonts {
  ui?: string;
  mono?: string;
}
⋮----
export type OverlayThemeDensity = GeneratedThemeDensity;
export type OverlayThemeChromeStyle = GeneratedThemeChromeStyle;
export type OverlayThemeIconStyle = GeneratedThemeIconStyle;
export type OverlayThemeMotionStyle = GeneratedThemeMotionStyle;
⋮----
export interface OverlayThemeCompatibility {
  shellBlueprints?: OverlayShellBlueprintId[];
  tags?: string[];
}
⋮----
export type OverlayThemePresentation = Partial<GeneratedThemePresentation>;
⋮----
export interface OverlayThemeDefinition {
  id: string;
  name: string;
  description?: string;
  defaultShaderId?: string;
  defaultOpenAnimationId?: string;
  defaultCloseAnimationId?: string;
  palette: OverlayThemePalette;
  effects: OverlayThemeEffects;
  xterm: OverlayXTermTheme;
  source?: OverlayThemeSource;
  extendsThemeId?: string;
  fonts?: OverlayThemeFonts;
  assets?: OverlayThemeAssets;
  visuals?: OverlayThemeVisualLayer[];
  cssVars?: Record<string, string>;
  presentation?: OverlayThemePresentation;
  compatibility?: OverlayThemeCompatibility;
  workbench?: OverlayWorkbenchThemeRecipe;
  explorer?: OverlayExplorerThemeRecipe;
  dock?: {
    workbench?: OverlayWorkbenchThemeRecipe;
    explorer?: OverlayExplorerThemeRecipe;
  };
  engineManifest?: ExplorerThemeManifest;
  compiledEngineManifest?: CompiledThemeEngineManifest;
  themeRenderer?: LoadedOverlayThemeRenderer;
}
⋮----
export interface OverlayAppearanceSelection {
  activeThemeId?: string;
  activeDockThemeId?: string | null;
  dockThemeMode?: 'follow-app' | 'override';
  customThemes?: OverlayThemeDefinition[];
  packageThemes?: OverlayThemeDefinition[];
  uiFontFamily?: string;
  monoFontFamily?: string;
  panelTransparency?: number;
  windowMode?: 'overlay' | 'windowed';
}
⋮----
export interface ResolvedOverlayAppearanceChannel {
  theme: OverlayThemeDefinition;
  baseTheme: OverlayThemeDefinition;
  fonts: {
    ui: string;
    mono: string;
  };
  workbenchTheme: ResolvedWorkbenchThemeRecipe;
  explorerTheme: ResolvedExplorerThemeRecipe;
}
⋮----
export interface ResolvedOverlayAppearance {
  mode: 'overlay' | 'windowed';
  theme: OverlayThemeDefinition;
  baseTheme: OverlayThemeDefinition;
  themes: OverlayThemeDefinition[];
  fonts: {
    ui: string;
    mono: string;
  };
  workbenchTheme: ResolvedWorkbenchThemeRecipe;
  explorerTheme: ResolvedExplorerThemeRecipe;
  cssVars: Record<string, string>;
  panelTransparency: number;
  app: ResolvedOverlayAppearanceChannel;
  dock: ResolvedOverlayAppearanceChannel;
}
⋮----
export interface OverlayFontOption {
  id: string;
  name: string;
  family: string;
}
⋮----
export interface OverlayRegisteredFontContribution extends OverlayFontOption {
  faceName?: string;
  sourceUrl: string;
  format?: string;
  style?: string;
  weight?: string;
}
⋮----
function getPrimaryFontFamily(fontFamily: string): string | null
⋮----
function getPluginFontsStyleElement(): HTMLStyleElement | null
⋮----
export function setOverlayPluginFonts(fonts: OverlayRegisteredFontContribution[]): void
⋮----
export function ensureFontFamilyLoaded(fontFamily: string): void
⋮----
function clampUnitInterval(value: number): number
⋮----
function formatAlphaComponent(value: number): string
⋮----
export function multiplyColorAlpha(color: string, alphaMultiplier: number): string
⋮----
function applyPanelTransparency(
  theme: OverlayThemeDefinition,
  panelTransparency: number,
): OverlayThemeDefinition
⋮----
function createTheme(
  id: string,
  name: string,
  description: string,
  palette: Partial<OverlayThemePalette>,
  effects: Partial<OverlayThemeEffects>,
  xterm: Partial<OverlayXTermTheme>,
  options?: {
    fonts?: OverlayThemeFonts;
    compatibility?: OverlayThemeCompatibility;
    presentation?: OverlayThemePresentation;
    workbench?: OverlayWorkbenchThemeRecipe;
    explorer?: OverlayExplorerThemeRecipe;
    dock?: OverlayThemeDefinition['dock'];
  },
): OverlayThemeDefinition
⋮----
function normalizeThemeVisualLayer(
  layer: OverlayThemeVisualLayer,
  index: number,
): OverlayThemeVisualLayer
⋮----
function mergeThemeAssets(
  fallbackAssets?: OverlayThemeAssets,
  themeAssets?: OverlayThemeAssets,
): OverlayThemeAssets | undefined
⋮----
function normalizeDockThemeOverrides(
  dock: OverlayThemeDefinition['dock'],
  fallbackDock: OverlayThemeDefinition['dock'],
): OverlayThemeDefinition['dock'] | undefined
⋮----
function resolveThemeOrFallback(
  themeLookup: Map<string, OverlayThemeDefinition>,
  themeId: string | null | undefined,
): OverlayThemeDefinition
⋮----
function createDockResolvedThemeDefinition(theme: OverlayThemeDefinition): OverlayThemeDefinition
⋮----
function createResolvedCssVars(args: {
  theme: OverlayThemeDefinition;
  fonts: {
    ui: string;
    mono: string;
  };
  panelTransparency: number;
  workbenchTheme: ResolvedWorkbenchThemeRecipe;
}): Record<string, string>
⋮----
function resolveAppearanceChannel(args: {
  baseTheme: OverlayThemeDefinition;
  themes: OverlayThemeDefinition[];
  uiFontFamily?: string;
  monoFontFamily?: string;
  panelTransparency: number;
}): ResolvedOverlayAppearanceChannel
⋮----
export function normalizeThemeDefinition(
  theme: Partial<OverlayThemeDefinition>,
  fallbackTheme?: OverlayThemeDefinition,
): OverlayThemeDefinition
⋮----
// Only inherit these recipe overrides from an explicit parent theme.
// The generic fallback theme is a data seed, not a workbench/explorer style parent.
⋮----
export function upsertCustomTheme(
  customThemes: OverlayThemeDefinition[],
  nextTheme: OverlayThemeDefinition,
): OverlayThemeDefinition[]
⋮----
export function parseImportedTheme(source: string): OverlayThemeDefinition
⋮----
export function serializeTheme(theme: OverlayThemeDefinition): string
⋮----
export function resolveOverlayAppearance(selection?: OverlayAppearanceSelection): ResolvedOverlayAppearance
⋮----
export function getThemeSourceLabel(theme: OverlayThemeDefinition): string
⋮----
export function isThemeCompatibleWithShellBlueprint(
  theme: OverlayThemeDefinition,
  shellBlueprint: OverlayShellBlueprintId,
): boolean
````

## File: config/canonicalIconTheme.json
````json
{
  "name": "GreebleFS Canonical Icons",
  "version": 1,
  "description": "Canonical stock icon ids, icon files, and matcher tables for GreebleFS themes.",
  "file": "txt",
  "folder": "folder",
  "folderExpanded": "folder_open",
  "iconDefinitions": {
    "app": { "iconPath": "./icons/app.svg" },
    "archive": { "iconPath": "./icons/archive.svg" },
    "audio": { "iconPath": "./icons/audio.svg" },
    "c": { "iconPath": "./icons/c.svg" },
    "clojure": { "iconPath": "./icons/clojure.svg" },
    "cmake": { "iconPath": "./icons/cmake.svg" },
    "cpp": { "iconPath": "./icons/cpp.svg" },
    "csharp": { "iconPath": "./icons/csharp.svg" },
    "css": { "iconPath": "./icons/css.svg" },
    "dart": { "iconPath": "./icons/dart.svg" },
    "database": { "iconPath": "./icons/database.svg" },
    "deb": { "iconPath": "./icons/deb.svg" },
    "dll": { "iconPath": "./icons/dll.svg" },
    "dmg": { "iconPath": "./icons/dmg.svg" },
    "dockerfile": { "iconPath": "./icons/dockerfile.svg" },
    "editorconfig": { "iconPath": "./icons/editorconfig.svg" },
    "elixir": { "iconPath": "./icons/elixir.svg" },
    "env": { "iconPath": "./icons/env.svg" },
    "erlang": { "iconPath": "./icons/erlang.svg" },
    "exe": { "iconPath": "./icons/exe.svg" },
    "folder": { "iconPath": "./icons/folder.svg" },
    "folder_open": { "iconPath": "./icons/folder_open.svg" },
    "folder_ai": { "iconPath": "./icons/folder_ai.svg" },
    "folder_ai_open": { "iconPath": "./icons/folder_ai_open.svg" },
    "folder_api": { "iconPath": "./icons/folder_api.svg" },
    "folder_api_open": { "iconPath": "./icons/folder_api_open.svg" },
    "folder_assets": { "iconPath": "./icons/folder_assets.svg" },
    "folder_assets_open": { "iconPath": "./icons/folder_assets_open.svg" },
    "folder_build": { "iconPath": "./icons/folder_build.svg" },
    "folder_build_open": { "iconPath": "./icons/folder_build_open.svg" },
    "folder_components": { "iconPath": "./icons/folder_components.svg" },
    "folder_components_open": { "iconPath": "./icons/folder_components_open.svg" },
    "folder_config": { "iconPath": "./icons/folder_config.svg" },
    "folder_config_open": { "iconPath": "./icons/folder_config_open.svg" },
    "folder_database": { "iconPath": "./icons/folder_database.svg" },
    "folder_database_open": { "iconPath": "./icons/folder_database_open.svg" },
    "folder_docs": { "iconPath": "./icons/folder_docs.svg" },
    "folder_docs_open": { "iconPath": "./icons/folder_docs_open.svg" },
    "folder_engine": { "iconPath": "./icons/folder_engine.svg" },
    "folder_engine_open": { "iconPath": "./icons/folder_engine_open.svg" },
    "folder_packages": { "iconPath": "./icons/folder_packages.svg" },
    "folder_packages_open": { "iconPath": "./icons/folder_packages_open.svg" },
    "folder_plugins": { "iconPath": "./icons/folder_plugins.svg" },
    "folder_plugins_open": { "iconPath": "./icons/folder_plugins_open.svg" },
    "folder_public": { "iconPath": "./icons/folder_public.svg" },
    "folder_public_open": { "iconPath": "./icons/folder_public_open.svg" },
    "folder_scripts": { "iconPath": "./icons/folder_scripts.svg" },
    "folder_scripts_open": { "iconPath": "./icons/folder_scripts_open.svg" },
    "folder_src": { "iconPath": "./icons/folder_src.svg" },
    "folder_src_open": { "iconPath": "./icons/folder_src_open.svg" },
    "folder_test": { "iconPath": "./icons/folder_test.svg" },
    "folder_test_open": { "iconPath": "./icons/folder_test_open.svg" },
    "font": { "iconPath": "./icons/font.svg" },
    "git": { "iconPath": "./icons/git.svg" },
    "gitignore": { "iconPath": "./icons/gitignore.svg" },
    "glsl": { "iconPath": "./icons/glsl.svg" },
    "go": { "iconPath": "./icons/go.svg" },
    "gradle": { "iconPath": "./icons/gradle.svg" },
    "haskell": { "iconPath": "./icons/haskell.svg" },
    "hlsl": { "iconPath": "./icons/hlsl.svg" },
    "html": { "iconPath": "./icons/html.svg" },
    "image": { "iconPath": "./icons/image.svg" },
    "ini": { "iconPath": "./icons/ini.svg" },
    "ink": { "iconPath": "./icons/ink.svg" },
    "java": { "iconPath": "./icons/java.svg" },
    "javascript": { "iconPath": "./icons/javascript.svg" },
    "json": { "iconPath": "./icons/json.svg" },
    "kain": { "iconPath": "./icons/kain.svg" },
    "kotlin": { "iconPath": "./icons/kotlin.svg" },
    "less": { "iconPath": "./icons/less.svg" },
    "lock": { "iconPath": "./icons/lock.svg" },
    "log": { "iconPath": "./icons/log.svg" },
    "lua": { "iconPath": "./icons/lua.svg" },
    "makefile": { "iconPath": "./icons/makefile.svg" },
    "markdown": { "iconPath": "./icons/markdown.svg" },
    "model3d": { "iconPath": "./icons/model3d.svg" },
    "npm": { "iconPath": "./icons/npm.svg" },
    "ocaml": { "iconPath": "./icons/ocaml.svg" },
    "pdf": { "iconPath": "./icons/pdf.svg" },
    "php": { "iconPath": "./icons/php.svg" },
    "powershell": { "iconPath": "./icons/powershell.svg" },
    "python": { "iconPath": "./icons/python.svg" },
    "r": { "iconPath": "./icons/r.svg" },
    "ruby": { "iconPath": "./icons/ruby.svg" },
    "rust": { "iconPath": "./icons/rust.svg" },
    "sass": { "iconPath": "./icons/sass.svg" },
    "scala": { "iconPath": "./icons/scala.svg" },
    "scss": { "iconPath": "./icons/scss.svg" },
    "shell": { "iconPath": "./icons/shell.svg" },
    "spv": { "iconPath": "./icons/spv.svg" },
    "sql": { "iconPath": "./icons/sql.svg" },
    "swift": { "iconPath": "./icons/swift.svg" },
    "toml": { "iconPath": "./icons/toml.svg" },
    "txt": { "iconPath": "./icons/txt.svg" },
    "typescript": { "iconPath": "./icons/typescript.svg" },
    "uasset": { "iconPath": "./icons/uasset.svg" },
    "uproject": { "iconPath": "./icons/uproject.svg" },
    "video": { "iconPath": "./icons/video.svg" },
    "wgsl": { "iconPath": "./icons/wgsl.svg" },
    "xml": { "iconPath": "./icons/xml.svg" },
    "yaml": { "iconPath": "./icons/yaml.svg" },
    "zig": { "iconPath": "./icons/zig.svg" },
    "zip": { "iconPath": "./icons/zip.svg" }
  },
  "fileExtensions": {
    "7z": "zip",
    "aac": "audio",
    "app": "app",
    "avi": "video",
    "avif": "image",
    "bash": "shell",
    "bat": "exe",
    "bmp": "image",
    "bz2": "zip",
    "c": "c",
    "cc": "cpp",
    "cfg": "ini",
    "clj": "clojure",
    "cljs": "clojure",
    "cmd": "exe",
    "conf": "ini",
    "cpp": "cpp",
    "cs": "csharp",
    "css": "css",
    "csv": "database",
    "cxx": "cpp",
    "dae": "model3d",
    "dart": "dart",
    "db": "database",
    "deb": "deb",
    "dmg": "dmg",
    "dll": "dll",
    "env": "env",
    "erl": "erlang",
    "ex": "elixir",
    "exs": "elixir",
    "exe": "exe",
    "fbx": "model3d",
    "fish": "shell",
    "flac": "audio",
    "flv": "video",
    "frag": "glsl",
    "gif": "image",
    "glb": "model3d",
    "gltf": "model3d",
    "glsl": "glsl",
    "go": "go",
    "gradle": "gradle",
    "gz": "zip",
    "h": "c",
    "hpp": "cpp",
    "hrl": "erlang",
    "hs": "haskell",
    "hlsl": "hlsl",
    "htm": "html",
    "html": "html",
    "ico": "image",
    "ini": "ini",
    "ink": "ink",
    "jar": "java",
    "java": "java",
    "jpeg": "image",
    "jpg": "image",
    "js": "javascript",
    "json": "json",
    "json5": "json",
    "jsonc": "json",
    "kain": "kain",
    "kn": "kain",
    "kt": "kotlin",
    "kts": "kotlin",
    "less": "less",
    "lock": "lock",
    "log": "log",
    "lua": "lua",
    "m4a": "audio",
    "md": "markdown",
    "mdown": "markdown",
    "mdx": "markdown",
    "mk": "makefile",
    "mkv": "video",
    "ml": "ocaml",
    "mli": "ocaml",
    "mov": "video",
    "mp3": "audio",
    "mp4": "video",
    "msi": "exe",
    "obj": "model3d",
    "ocaml": "ocaml",
    "ogg": "audio",
    "otf": "font",
    "opus": "audio",
    "pdf": "pdf",
    "php": "php",
    "phtml": "php",
    "png": "image",
    "ps1": "powershell",
    "psd1": "powershell",
    "psm1": "powershell",
    "py": "python",
    "r": "r",
    "rar": "zip",
    "rb": "ruby",
    "rpm": "deb",
    "rs": "rust",
    "sass": "sass",
    "scala": "scala",
    "scss": "scss",
    "sh": "shell",
    "so": "dll",
    "spec": "txt",
    "spv": "spv",
    "sql": "sql",
    "sqlite": "database",
    "sqlite3": "database",
    "svg": "image",
    "swift": "swift",
    "tar": "zip",
    "tex": "txt",
    "tif": "image",
    "tiff": "image",
    "toml": "toml",
    "ts": "typescript",
    "tsx": "typescript",
    "ttf": "font",
    "txt": "txt",
    "uasset": "uasset",
    "uproject": "uproject",
    "vert": "glsl",
    "wav": "audio",
    "webm": "video",
    "webp": "image",
    "wgsl": "wgsl",
    "woff": "font",
    "woff2": "font",
    "wmv": "video",
    "xml": "xml",
    "xz": "zip",
    "yaml": "yaml",
    "yml": "yaml",
    "zig": "zig",
    "zip": "zip",
    "zsh": "shell"
  },
  "fileNames": {
    ".editorconfig": "editorconfig",
    ".env": "env",
    ".env.local": "env",
    ".gitattributes": "git",
    ".gitignore": "gitignore",
    ".gitmodules": "git",
    "cargo.lock": "rust",
    "cargo.toml": "rust",
    "cmake": "cmake",
    "dockerfile": "dockerfile",
    "makefile": "makefile",
    "package-lock.json": "npm",
    "package.json": "npm",
    "rakefile": "ruby"
  },
  "folderNames": {
    ".config": "folder_config",
    "__tests__": "folder_test",
    "agents": "folder_ai",
    "ai": "folder_ai",
    "api": "folder_api",
    "app": "folder_src",
    "apps": "folder_src",
    "assets": "folder_assets",
    "backend": "folder_api",
    "bin": "folder_build",
    "build": "folder_build",
    "client": "folder_public",
    "cli": "folder_scripts",
    "component": "folder_components",
    "components": "folder_components",
    "config": "folder_config",
    "configs": "folder_config",
    "configuration": "folder_config",
    "coverage": "folder_test",
    "data": "folder_database",
    "database": "folder_database",
    "db": "folder_database",
    "dist": "folder_build",
    "doc": "folder_docs",
    "docs": "folder_docs",
    "documentation": "folder_docs",
    "editor": "folder_engine",
    "engine": "folder_engine",
    "extensions": "folder_plugins",
    "fixtures": "folder_test",
    "fonts": "folder_assets",
    "frontend": "folder_public",
    "guides": "folder_docs",
    "hooks": "folder_components",
    "icons": "folder_assets",
    "images": "folder_assets",
    "integrations": "folder_plugins",
    "layouts": "folder_components",
    "lib": "folder_src",
    "libs": "folder_src",
    "media": "folder_assets",
    "migrations": "folder_database",
    "mocks": "folder_test",
    "modules": "folder_packages",
    "node_modules": "folder_packages",
    "out": "folder_build",
    "output": "folder_build",
    "package": "folder_packages",
    "packages": "folder_packages",
    "pages": "folder_components",
    "plugins": "folder_plugins",
    "prompts": "folder_ai",
    "public": "folder_public",
    "reference": "folder_docs",
    "release": "folder_build",
    "resources": "folder_assets",
    "routes": "folder_components",
    "runtime": "folder_engine",
    "schemas": "folder_database",
    "script": "folder_scripts",
    "scripts": "folder_scripts",
    "server": "folder_api",
    "services": "folder_api",
    "settings": "folder_config",
    "source": "folder_src",
    "sources": "folder_src",
    "spec": "folder_test",
    "specs": "folder_test",
    "src": "folder_src",
    "state": "folder_components",
    "static": "folder_assets",
    "storage": "folder_database",
    "store": "folder_components",
    "styles": "folder_assets",
    "target": "folder_build",
    "task": "folder_api",
    "tasks": "folder_api",
    "test": "folder_test",
    "tests": "folder_test",
    "themes": "folder_assets",
    "third_party": "folder_packages",
    "tooling": "folder_scripts",
    "tools": "folder_scripts",
    "ui": "folder_components",
    "vendor": "folder_packages",
    "views": "folder_components",
    "web": "folder_public",
    "worker": "folder_api",
    "workers": "folder_api"
  },
  "folderNamesExpanded": {
    ".config": "folder_config_open",
    "__tests__": "folder_test_open",
    "agents": "folder_ai_open",
    "ai": "folder_ai_open",
    "api": "folder_api_open",
    "app": "folder_src_open",
    "apps": "folder_src_open",
    "assets": "folder_assets_open",
    "backend": "folder_api_open",
    "bin": "folder_build_open",
    "build": "folder_build_open",
    "client": "folder_public_open",
    "cli": "folder_scripts_open",
    "component": "folder_components_open",
    "components": "folder_components_open",
    "config": "folder_config_open",
    "configs": "folder_config_open",
    "configuration": "folder_config_open",
    "coverage": "folder_test_open",
    "data": "folder_database_open",
    "database": "folder_database_open",
    "db": "folder_database_open",
    "dist": "folder_build_open",
    "doc": "folder_docs_open",
    "docs": "folder_docs_open",
    "documentation": "folder_docs_open",
    "editor": "folder_engine_open",
    "engine": "folder_engine_open",
    "extensions": "folder_plugins_open",
    "fixtures": "folder_test_open",
    "fonts": "folder_assets_open",
    "frontend": "folder_public_open",
    "guides": "folder_docs_open",
    "hooks": "folder_components_open",
    "icons": "folder_assets_open",
    "images": "folder_assets_open",
    "integrations": "folder_plugins_open",
    "layouts": "folder_components_open",
    "lib": "folder_src_open",
    "libs": "folder_src_open",
    "media": "folder_assets_open",
    "migrations": "folder_database_open",
    "mocks": "folder_test_open",
    "modules": "folder_packages_open",
    "node_modules": "folder_packages_open",
    "out": "folder_build_open",
    "output": "folder_build_open",
    "package": "folder_packages_open",
    "packages": "folder_packages_open",
    "pages": "folder_components_open",
    "plugins": "folder_plugins_open",
    "prompts": "folder_ai_open",
    "public": "folder_public_open",
    "reference": "folder_docs_open",
    "release": "folder_build_open",
    "resources": "folder_assets_open",
    "routes": "folder_components_open",
    "runtime": "folder_engine_open",
    "schemas": "folder_database_open",
    "script": "folder_scripts_open",
    "scripts": "folder_scripts_open",
    "server": "folder_api_open",
    "services": "folder_api_open",
    "settings": "folder_config_open",
    "source": "folder_src_open",
    "sources": "folder_src_open",
    "spec": "folder_test_open",
    "specs": "folder_test_open",
    "src": "folder_src_open",
    "state": "folder_components_open",
    "static": "folder_assets_open",
    "storage": "folder_database_open",
    "store": "folder_components_open",
    "styles": "folder_assets_open",
    "target": "folder_build_open",
    "task": "folder_api_open",
    "tasks": "folder_api_open",
    "test": "folder_test_open",
    "tests": "folder_test_open",
    "themes": "folder_assets_open",
    "third_party": "folder_packages_open",
    "tooling": "folder_scripts_open",
    "tools": "folder_scripts_open",
    "ui": "folder_components_open",
    "vendor": "folder_packages_open",
    "views": "folder_components_open",
    "web": "folder_public_open",
    "worker": "folder_api_open",
    "workers": "folder_api_open"
  }
}
````

## File: config/explorerArchives.ts
````typescript
import type { FileEntry } from '../generated/tauri';
⋮----
export type ExplorerArchiveFormatId =
  | 'zip'
  | 'seven-zip'
  | 'tar'
  | 'tar-gzip'
  | 'tar-bzip2'
  | 'tar-xz'
  | 'gzip'
  | 'bzip2'
  | 'xz';
⋮----
export interface ExplorerArchiveFormatDescriptor {
  id: ExplorerArchiveFormatId;
  suffixes: readonly string[];
  label: string;
}
⋮----
function getArchiveFileName(value: string | Pick<FileEntry, 'name'>): string
⋮----
export function getExplorerArchiveDescriptor(
  value: string | Pick<FileEntry, 'name' | 'is_dir'>,
): ExplorerArchiveFormatDescriptor | null
⋮----
export function isExplorerArchiveEntry(entry: Pick<FileEntry, 'name' | 'is_dir'>): boolean
⋮----
export function getExplorerArchiveDefaultFolderName(value: string | Pick<FileEntry, 'name'>): string
⋮----
export function getExplorerArchiveExtractToFolderLabel(
  value: string | Pick<FileEntry, 'name'>,
): string
````

## File: config/explorerChromeLayouts.ts
````typescript
export type ExplorerChromeSurfaceId =
  | 'explorerTopbar'
  | 'explorerToolbar'
  | 'workspaceHeader'
  | 'railHeader'
  | 'previewHeader'
  | 'explorerStatusBar';
⋮----
export type ExplorerChromeZoneId =
  | 'start'
  | 'center'
  | 'end'
  | 'primaryStart'
  | 'primaryCenter'
  | 'primaryEnd'
  | 'secondaryStart'
  | 'secondaryEnd';
⋮----
export type BuiltInExplorerChromeLayoutId = 'default' | 'focused-search';
export type ExplorerChromeLayoutId = BuiltInExplorerChromeLayoutId | (string & {});
⋮----
export type BuiltInExplorerChromeControlId =
  | 'navigateBack'
  | 'navigateForward'
  | 'navigateUp'
  | 'addressBar'
  | 'recentLocations'
  | 'pinnedLocations'
  | 'folderSizeSummary'
  | 'selectionSizeSummary'
  | 'pinLocation'
  | 'toggleSearchContent'
  | 'saveSearch'
  | 'batchRename'
  | 'openPropertiesPanel'
  | 'tagSelection'
  | 'duplicateScan'
  | 'undoTrash'
  | 'toggleSources'
  | 'focusAddressBar'
  | 'experimentalModes'
  | 'shellLayout'
  | 'viewLayout'
  | 'togglePreview'
  | 'toggleHiddenFiles'
  | 'refresh'
  | 'newFolder'
  | 'newFile'
  | 'pasteClipboard'
  | 'workspacePaneCounts'
  | 'workspaceMode'
  | 'workspaceCommanderSummary'
  | 'workspaceLayoutHint'
  | 'workspaceTabs'
  | 'workspaceNewTab'
  | 'workspaceDuplicateTab'
  | 'workspaceFocusLeft'
  | 'workspaceFocusRight'
  | 'workspaceMoveTab'
  | 'workspaceSyncPath'
  | 'workspaceLinkNavigation'
  | 'workspaceCopyToPane'
  | 'workspaceMoveToPane'
  | 'workspaceSwapPane'
  | 'workspaceSplitToggle'
  | 'workspaceCloseTab'
  | 'workspaceSplitSummary'
  | 'workspaceSplitNudgeLeft'
  | 'workspaceSplitReset'
  | 'workspaceSplitNudgeRight'
  | 'railIdentity'
  | 'railBookmarkSummary'
  | 'railFocusModeToggle'
  | 'railManageToggle'
  | 'previewIdentity'
  | 'previewState'
  | 'previewModeToggle'
  | 'previewCopyPath'
  | 'previewClose'
  | 'statusItemCount'
  | 'statusSelectionSummary'
  | 'statusModeProfile'
  | 'statusViewSummary'
  | 'statusPreviewSummary'
  | 'statusLabsSummary'
  | 'statusSearchSummary'
  | 'statusTaskBadge'
  | 'statusClipboardQueue'
  | 'statusPreviewLoading';
⋮----
export type ExplorerChromeControlId = BuiltInExplorerChromeControlId | `plugin:${string}`;
⋮----
export interface ExplorerChromeControlDefinition {
  id: ExplorerChromeControlId;
  label: string;
  surfaces: ExplorerChromeSurfaceId[];
}
⋮----
export interface ExplorerChromeSlotDefinition {
  zone: ExplorerChromeZoneId;
  order: number;
  grow?: number;
  shrink?: number;
  collapsePriority?: number;
  overflowEligible?: boolean;
}
⋮----
export interface ExplorerChromeLayoutDefinition {
  id: ExplorerChromeLayoutId;
  label: string;
  placements: Partial<Record<ExplorerChromeControlId, Partial<Record<ExplorerChromeSurfaceId, ExplorerChromeSlotDefinition>>>>;
}
⋮----
export interface ExplorerChromeOverrideEntry {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
  zone: ExplorerChromeZoneId;
  order: number;
}
⋮----
export interface ExplorerChromeOverrideSnapshot {
  entries: ExplorerChromeOverrideEntry[];
}
⋮----
export interface ExplorerChromeResolvedControlPlacement extends ExplorerChromeSlotDefinition {
  controlId: ExplorerChromeControlId;
  surfaceId: ExplorerChromeSurfaceId;
}
⋮----
export interface ExplorerChromeResolvedZone {
  id: ExplorerChromeZoneId;
  controls: ExplorerChromeResolvedControlPlacement[];
}
⋮----
export interface ExplorerChromeResolvedRow {
  id: string;
  zones: ExplorerChromeResolvedZone[];
}
⋮----
export interface ExplorerChromeResolvedSurface {
  surfaceId: ExplorerChromeSurfaceId;
  rows: ExplorerChromeResolvedRow[];
  visibleControlIds: ExplorerChromeControlId[];
}
⋮----
interface ExplorerChromeSurfaceDefinition {
  id: ExplorerChromeSurfaceId;
  rows: Array<{
    id: string;
    zones: ExplorerChromeZoneId[];
  }>;
}
⋮----
function isExplorerChromeSurfaceId(value: unknown): value is ExplorerChromeSurfaceId
⋮----
function isExplorerChromeZoneId(value: unknown): value is ExplorerChromeZoneId
⋮----
function isValidZoneForSurface(surfaceId: ExplorerChromeSurfaceId, zone: ExplorerChromeZoneId): boolean
⋮----
function asFiniteInteger(value: unknown): number | null
⋮----
function asTrimmedString(value: unknown): string | null
⋮----
export function normalizeExplorerChromeLayoutId(value: unknown): ExplorerChromeLayoutId
⋮----
export function getExplorerChromeSurfaceDefinition(
  surfaceId: ExplorerChromeSurfaceId,
): ExplorerChromeSurfaceDefinition
⋮----
export function getExplorerChromeLayoutDefinition(
  layoutId?: ExplorerChromeLayoutId | null,
): ExplorerChromeLayoutDefinition
⋮----
export function normalizeExplorerChromeOverrideSnapshot(
  value: unknown,
): ExplorerChromeOverrideSnapshot
⋮----
export function normalizeExplorerChromeOverrideSnapshotMap(
  value: unknown,
): Record<string, Record<string, ExplorerChromeOverrideSnapshot>>
⋮----
function getOverridePlacementMap(
  override?: ExplorerChromeOverrideSnapshot | null,
): Map<ExplorerChromeControlId, ExplorerChromeOverrideEntry>
⋮----
function getBasePlacement(
  layout: ExplorerChromeLayoutDefinition,
  controlId: ExplorerChromeControlId,
  surfaceId: ExplorerChromeSurfaceId,
): ExplorerChromeResolvedControlPlacement | null
⋮----
function getOverridePlacement(
  overridePlacementMap: Map<ExplorerChromeControlId, ExplorerChromeOverrideEntry>,
  controlId: ExplorerChromeControlId,
  surfaceId: ExplorerChromeSurfaceId,
  basePlacement: ExplorerChromeResolvedControlPlacement | null,
): ExplorerChromeResolvedControlPlacement | null
⋮----
function collectResolvedSurfacePlacements(
  surface: ExplorerChromeResolvedSurface,
): ExplorerChromeResolvedControlPlacement[]
⋮----
export function createExplorerChromeOverrideSnapshotFromResolvedSurfaces(
  surfaces: ExplorerChromeResolvedSurface[],
): ExplorerChromeOverrideSnapshot
⋮----
export function moveExplorerChromeControlInResolvedSurfaces(input: {
  surfaces: ExplorerChromeResolvedSurface[];
  controlId: ExplorerChromeControlId;
  targetSurfaceId: ExplorerChromeSurfaceId;
  targetZoneId: ExplorerChromeZoneId;
  targetIndex: number;
}): ExplorerChromeOverrideSnapshot
⋮----
export function resolveExplorerChromeSurfaceLayout(input: {
  layoutId?: ExplorerChromeLayoutId | null;
  surfaceId: ExplorerChromeSurfaceId;
  controlDefinitions: ExplorerChromeControlDefinition[];
  override?: ExplorerChromeOverrideSnapshot | null;
isControlVisible?: (controlId: ExplorerChromeControlId, surfaceId: ExplorerChromeSurfaceId)
````

## File: config/explorerContextMenu.ts
````typescript
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from './pluginContributions';
⋮----
export type ExplorerContextMenuTarget = 'entry' | 'background';
export type ExplorerContextMenuItemGroup =
  | 'create'
  | 'open'
  | 'system'
  | 'clipboard'
  | 'organize'
  | 'library'
  | 'plugin'
  | 'danger';
⋮----
export type ExplorerBuiltInContextMenuActionId =
  | 'open'
  | 'open-with'
  | 'open-admin'
  | 'open-terminal'
  | 'open-aquarium'
  | 'reveal'
  | 'properties'
  | 'copy-path'
  | 'new-folder'
  | 'new-file'
  | 'paste'
  | 'copy'
  | 'cut'
  | 'copy-to'
  | 'move-to'
  | 'extract-here'
  | 'extract-new-folder'
  | 'duplicate'
  | 'rename'
  | 'add-tags'
  | 'remove-tags'
  | 'bookmark-toggle'
  | 'move-trash'
  | 'refresh';
⋮----
export interface ExplorerContextMenuItemOverride {
  enabled?: boolean;
  order?: number;
}
⋮----
export type ExplorerContextMenuItemOverrideMap = Record<string, ExplorerContextMenuItemOverride>;
⋮----
export interface ExplorerContextMenuCatalogItemBase {
  id: string;
  title: string;
  description?: string;
  contexts: ExplorerContextMenuTarget[];
  appliesTo: 'any' | 'file' | 'directory';
  group: ExplorerContextMenuItemGroup;
  defaultOrder: number;
  source: 'built-in' | 'plugin';
  iconName?: string;
}
⋮----
export interface ExplorerBuiltInContextMenuCatalogItem extends ExplorerContextMenuCatalogItemBase {
  source: 'built-in';
  execution: {
    kind: 'built-in';
    actionId: ExplorerBuiltInContextMenuActionId;
  };
}
⋮----
export interface ExplorerResolvedPluginContextMenuContribution extends ExplorerContextMenuCatalogItemBase {
  source: 'plugin';
  pluginId: string;
  pluginName: string;
  execution: OverlayPluginContextMenuContribution['execution'];
}
⋮----
export type ExplorerContextMenuCatalogItem =
  | ExplorerBuiltInContextMenuCatalogItem
  | ExplorerResolvedPluginContextMenuContribution;
⋮----
export interface ExplorerSortableContextMenuItem {
  id: string;
  defaultOrder: number;
}
⋮----
function sanitizeContextMenuString(value: unknown, fallback = ''): string
⋮----
function sanitizeContextMenuContexts(value: unknown): ExplorerContextMenuTarget[]
⋮----
function sanitizeContextMenuAppliesTo(value: unknown): 'any' | 'file' | 'directory'
⋮----
function sanitizeContextMenuExecution(
  execution: unknown,
): OverlayPluginContextMenuContribution['execution'] | null
⋮----
export function normalizeExplorerContextMenuItemOverrideMap(
  value: unknown,
): ExplorerContextMenuItemOverrideMap
⋮----
export function isExplorerContextMenuItemEnabled(
  itemId: string,
  overrides: ExplorerContextMenuItemOverrideMap,
): boolean
⋮----
export function resolveExplorerContextMenuItemOrder(
  itemId: string,
  defaultOrder: number,
  overrides: ExplorerContextMenuItemOverrideMap,
): number
⋮----
export function sortExplorerContextMenuItems<TItem extends ExplorerSortableContextMenuItem>(
  items: TItem[],
  overrides: ExplorerContextMenuItemOverrideMap,
): TItem[]
⋮----
export function buildExplorerContextMenuOverrideMap(
  orderedItems: ExplorerSortableContextMenuItem[],
  previousOverrides: ExplorerContextMenuItemOverrideMap,
): ExplorerContextMenuItemOverrideMap
⋮----
export function withExplorerContextMenuItemEnabled(
  overrides: ExplorerContextMenuItemOverrideMap,
  item: ExplorerSortableContextMenuItem,
  enabled: boolean,
): ExplorerContextMenuItemOverrideMap
⋮----
export function moveExplorerContextMenuItem(
  orderedItems: ExplorerSortableContextMenuItem[],
  overrides: ExplorerContextMenuItemOverrideMap,
  itemId: string,
  direction: 'up' | 'down',
): ExplorerContextMenuItemOverrideMap
⋮----
export function createLegacyExplorerActionContextMenuContributions(
  actions: OverlayPluginExplorerActionContribution[],
): OverlayPluginContextMenuContribution[]
⋮----
export function normalizePluginContextMenuContributions(
  contributions: ReadonlyArray<OverlayPluginContextMenuContribution | null | undefined>,
): ExplorerResolvedPluginContextMenuContribution[]
````

## File: config/explorerExperimentalModes.ts
````typescript
export type ExplorerExperimentalViewMode =
  | 'off'
  | 'adaptive-semantic-grid'
  | 'constellation'
  | 'timeline-surface';
⋮----
export type AdaptiveSemanticDensityStopId =
  | 'small-icons'
  | 'medium-icons'
  | 'large-icons'
  | 'rich-cards'
  | 'columns'
  | 'details';
⋮----
export type AdaptiveSemanticPresentation = 'grid' | 'cards' | 'table';
⋮----
export interface AdaptiveSemanticGridMetrics {
  minWidth: number;
  gap: number;
  padding: number;
  minHeight: number;
  iconSize: number;
  iconStageSize: number;
  titleLines: number;
}
⋮----
export interface AdaptiveSemanticTableMetrics {
  rowHeight: number;
  iconSize: number;
  showRichMeta: boolean;
}
⋮----
export interface AdaptiveSemanticDensityStopDefinition {
  id: AdaptiveSemanticDensityStopId;
  label: string;
  shortLabel: string;
  description: string;
  density: number;
  presentation: AdaptiveSemanticPresentation;
  grid?: AdaptiveSemanticGridMetrics;
  table?: AdaptiveSemanticTableMetrics;
}
⋮----
export interface ExplorerExperimentalModeDefinition {
  id: Exclude<ExplorerExperimentalViewMode, 'off'>;
  label: string;
  shortLabel: string;
  description: string;
  densityAxisLabel: string;
  available: boolean;
}
⋮----
export interface ExplorerExperimentalDensityDescriptor {
  label: string;
  shortLabel: string;
  description: string;
}
⋮----
export function normalizeExplorerExperimentalViewMode(value: unknown): ExplorerExperimentalViewMode
⋮----
export function normalizeAdaptiveSemanticDensity(value: unknown): number
⋮----
export function getExplorerExperimentalModeDefinition(
  mode: Exclude<ExplorerExperimentalViewMode, 'off'>,
): ExplorerExperimentalModeDefinition
⋮----
export function getAdaptiveSemanticDensityStopId(
  density: number,
): AdaptiveSemanticDensityStopId
⋮----
export function getAdaptiveSemanticDensityStop(
  density: number,
): AdaptiveSemanticDensityStopDefinition
⋮----
export function getAdaptiveSemanticDensityPercent(density: number): number
⋮----
export function getExplorerExperimentalDensityDescriptor(
  mode: Exclude<ExplorerExperimentalViewMode, 'off'>,
  density: number,
): ExplorerExperimentalDensityDescriptor
⋮----
export function stepAdaptiveSemanticDensity(
  currentDensity: number,
  direction: 'larger' | 'smaller',
): number
⋮----
function clamp(value: number, min: number, max: number): number
````

## File: config/explorerModeProfiles.ts
````typescript
import {
  getExplorerShellLayoutDefinition,
  type ExplorerShellLayoutId,
} from './explorerShellLayouts';
import {
  defaultExplorerChromeLayoutId,
  normalizeExplorerChromeLayoutId,
  type ExplorerChromeLayoutId,
} from './explorerChromeLayouts';
import type { ExplorerExperimentalViewMode } from './explorerExperimentalModes';
import type { ExplorerViewMode } from './explorerViewModes';
⋮----
export type BuiltInExplorerModeProfileId = 'balanced' | 'navigator' | 'focus' | 'inspector';
export type ExplorerModeProfileId = BuiltInExplorerModeProfileId | (string & {});
export type ExplorerModeViewBias = 'balanced' | 'browsing' | 'content-focus' | 'preview-heavy';
⋮----
export interface ExplorerModeProfileDefinition {
  id: ExplorerModeProfileId;
  label: string;
  shortLabel: string;
  description: string;
  paneLayoutId: ExplorerShellLayoutId;
  chromeLayoutId: ExplorerChromeLayoutId;
  viewBias: ExplorerModeViewBias;
  preferredViewMode?: ExplorerViewMode;
  preferredExperimentalViewMode?: ExplorerExperimentalViewMode;
}
⋮----
function asTrimmedString(value: unknown): string | null
⋮----
export function normalizeExplorerModeProfileId(value: unknown): ExplorerModeProfileId
⋮----
export function getExplorerModeProfileDefinition(
  modeProfileId?: ExplorerModeProfileId | null,
): ExplorerModeProfileDefinition
⋮----
export function mapLegacyShellLayoutIdToExplorerModeProfileId(
  shellLayoutId?: ExplorerShellLayoutId | null,
): ExplorerModeProfileId
⋮----
export function resolveEffectiveExplorerModeProfileId(input: {
  themeOverrideModeProfileId?: ExplorerModeProfileId | null;
  themeDefaultModeProfileId?: ExplorerModeProfileId | null;
  legacyShellLayoutId?: ExplorerShellLayoutId | null;
}): ExplorerModeProfileId
⋮----
export function resolveEffectiveExplorerModeProfile(input: {
  themeOverrideModeProfileId?: ExplorerModeProfileId | null;
  themeDefaultModeProfileId?: ExplorerModeProfileId | null;
  legacyShellLayoutId?: ExplorerShellLayoutId | null;
}): ExplorerModeProfileDefinition
⋮----
export function resolveExplorerModeProfileChromeLayoutId(input: {
  modeProfile?: Pick<ExplorerModeProfileDefinition, 'chromeLayoutId'> | null;
  themeChromeLayoutId?: ExplorerChromeLayoutId | null;
}): ExplorerChromeLayoutId
````

## File: config/explorerRail.ts
````typescript
export type ExplorerRailSectionId = 'quick-access' | 'drives' | 'saved-searches' | 'tags' | 'bookmarks';
⋮----
export type ExplorerRailViewMode = 'default' | 'compact' | 'tree';
export type ExplorerRailSectionChrome = 'carded' | 'compact' | 'tree';
export type ExplorerRailRowChrome = 'carded' | 'compact' | 'tree';
export type ExplorerRailHierarchyGuideStyle = 'none' | 'soft' | 'strong';
export type ExplorerRailActiveBranchStyle = 'soft' | 'bold' | 'lane';
export type ExplorerRailIconTone = 'muted' | 'contrast' | 'accented';
⋮----
export interface ExplorerRailWidthBounds {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}
⋮----
export interface ExplorerBookmarkCategoryPreset {
  id: string;
  name: string;
  color: string;
  keywords: string[];
}
⋮----
export interface ExplorerBookmarkColorOption {
  id: string;
  value: string;
}
⋮----
export interface ExplorerRailViewModePresentation {
  sectionChrome: ExplorerRailSectionChrome;
  rowChrome: ExplorerRailRowChrome;
  hierarchyGuideStyle: ExplorerRailHierarchyGuideStyle;
  activeBranchStyle: ExplorerRailActiveBranchStyle;
  iconTone: ExplorerRailIconTone;
}
⋮----
export interface ExplorerRailViewModeDefinition {
  id: ExplorerRailViewMode;
  label: string;
  shortLabel: string;
  description: string;
  useCompactChrome: boolean;
  hideSupportingMeta: boolean;
  flattenDriveRows: boolean;
  hideDriveCapacity: boolean;
  treeIndentStep: number;
  presentation: ExplorerRailViewModePresentation;
}
⋮----
export function getExplorerRailWidthBounds(isCompactDock: boolean): ExplorerRailWidthBounds
⋮----
export function normalizeExplorerRailViewMode(value: unknown): ExplorerRailViewMode
⋮----
export function getExplorerRailViewModeDefinition(value: unknown): ExplorerRailViewModeDefinition
````

## File: config/explorerShellLayouts.ts
````typescript
export type ExplorerShellLayoutId = 'balanced' | 'navigator' | 'focus' | 'inspector';
export type ExplorerPreviewPlacement = 'leading' | 'trailing';
⋮----
export interface ExplorerShellLayoutDefinition {
  id: ExplorerShellLayoutId;
  label: string;
  shortLabel: string;
  description: string;
  showRail: boolean;
  previewPlacement: ExplorerPreviewPlacement;
  railWidthMultiplier: number;
  previewWidthMultiplier: number;
}
⋮----
export interface ExplorerShellLayoutWidthSuggestion {
  sidebarWidth: number;
  previewWidth: number;
}
⋮----
export interface ExplorerShellLayoutWidthInputs {
  layoutId: ExplorerShellLayoutId;
  railWidth: number;
  railMinWidth: number;
  railMaxWidth: number;
  previewWidth: number;
  previewMinWidth: number;
  previewMaxWidth: number;
}
⋮----
function clampRoundedWidth(value: number, min: number, max: number): number
⋮----
export function isExplorerShellLayoutId(value: unknown): value is ExplorerShellLayoutId
⋮----
export function getExplorerShellLayoutDefinition(
  value: unknown,
): ExplorerShellLayoutDefinition
⋮----
export function getExplorerShellLayoutWidthSuggestion(
  inputs: ExplorerShellLayoutWidthInputs,
): ExplorerShellLayoutWidthSuggestion
````

## File: config/explorerTheme.ts
````typescript
import type { ResolvedOverlayAppearance } from './appearance';
import type {
  ThemeDensity,
  ThemeIconStyle,
  ThemeMotionStyle,
} from '../generated/tauri';
import type {
  AdaptiveSemanticDensityStopDefinition,
  ExplorerExperimentalViewMode,
} from './explorerExperimentalModes';
import type {
  ExplorerGridMetrics,
  ExplorerRowMetrics,
  ExplorerViewMode,
} from './explorerViewModes';
import {
  readThemeNumberProp,
  readThemeStringProp,
  resolveThemeEngineBindings,
} from './themeEngineBindings';
import {
  defaultExplorerChromeLayoutId,
  normalizeExplorerChromeLayoutId,
  type ExplorerChromeLayoutId,
} from './explorerChromeLayouts';
import {
  defaultExplorerModeProfileId,
  normalizeExplorerModeProfileId,
  type ExplorerModeProfileId,
} from './explorerModeProfiles';
⋮----
export type OverlayExplorerThemePreset = 'workbench' | 'xmb' | 'channel-grid' | 'custom';
export type OverlayExplorerToolbarStyle = 'solid' | 'glass' | 'floating' | 'minimal';
export type OverlayExplorerBreadcrumbStyle = 'plain' | 'segmented' | 'capsule';
export type OverlayExplorerSelectionStyle = 'fill' | 'outline' | 'glow';
export type OverlayExplorerHoverStyle = 'fill' | 'lift' | 'glow';
export type OverlayExplorerPreviewStyle = 'attached' | 'floating' | 'glass';
export type OverlayExplorerStatusBarStyle = 'solid' | 'floating' | 'hidden';
export type OverlayExplorerLabelMode = 'stacked' | 'inline';
export type OverlayExplorerRailPosition = 'left' | 'right';
⋮----
export interface OverlayExplorerThemeMetrics {
  railWidth?: number;
  previewWidth?: number;
  chromeInset?: number;
  toolbarPaddingX?: number;
  toolbarPaddingY?: number;
  toolbarGap?: number;
  controlRadius?: number;
  panelRadius?: number;
  spacingScale?: number;
  gridScale?: number;
  rowHeightScale?: number;
  iconScale?: number;
  hoverLiftPx?: number;
}
⋮----
export interface OverlayExplorerThemeSurfaces {
  rootBackground?: string;
  contentBackground?: string;
  sidebarBackground?: string;
  sidebarBorder?: string;
  toolbarBackground?: string;
  toolbarBorder?: string;
  toolbarShadow?: string;
  omniboxBackground?: string;
  omniboxBorder?: string;
  previewBackground?: string;
  previewHeaderBackground?: string;
  previewBorder?: string;
  statusBarBackground?: string;
  statusBarBorder?: string;
  itemHoverBackground?: string;
  itemHoverBorder?: string;
  itemSelectedBackground?: string;
  itemSelectedBorder?: string;
  itemDropBackground?: string;
  itemDropBorder?: string;
  itemFocusShadow?: string;
  inputBackground?: string;
  inputBorder?: string;
  chipBackground?: string;
  chipBorder?: string;
  chipActiveBackground?: string;
  chipActiveBorder?: string;
  chipActiveText?: string;
}
⋮----
export interface OverlayExplorerThemeTypography {
  railEyebrowSize?: number;
  railTitleSize?: number;
  toolbarFontSize?: number;
  breadcrumbFontSize?: number;
  entryTitleSize?: number;
  entryMetaSize?: number;
  statusFontSize?: number;
  entryTitleWeight?: number;
  labelLetterSpacing?: string;
}
⋮----
export interface OverlayExplorerThemeRecipe {
  preset?: OverlayExplorerThemePreset;
  chromeLayoutId?: ExplorerChromeLayoutId;
  defaultModeProfileId?: ExplorerModeProfileId;
  layoutPrimitiveId?: string;
  navigationPatternId?: string;
  renderStyleId?: string;
  railPosition?: OverlayExplorerRailPosition;
  railBrandLabel?: string;
  toolbarStyle?: OverlayExplorerToolbarStyle;
  breadcrumbStyle?: OverlayExplorerBreadcrumbStyle;
  selectionStyle?: OverlayExplorerSelectionStyle;
  hoverStyle?: OverlayExplorerHoverStyle;
  previewStyle?: OverlayExplorerPreviewStyle;
  statusBarStyle?: OverlayExplorerStatusBarStyle;
  labelMode?: OverlayExplorerLabelMode;
  preferredViewMode?: ExplorerViewMode;
  preferredExperimentalViewMode?: ExplorerExperimentalViewMode;
  metrics?: OverlayExplorerThemeMetrics;
  surfaces?: OverlayExplorerThemeSurfaces;
  typography?: OverlayExplorerThemeTypography;
  cssVars?: Record<string, string>;
}
⋮----
export interface ResolvedExplorerThemeRecipe {
  preset: OverlayExplorerThemePreset;
  chromeLayoutId: ExplorerChromeLayoutId;
  defaultModeProfileId: ExplorerModeProfileId | null;
  layoutPrimitiveId: string | null;
  navigationPatternId: string | null;
  renderStyleId: string | null;
  railPosition: OverlayExplorerRailPosition;
  railBrandLabel: string;
  toolbarStyle: OverlayExplorerToolbarStyle;
  breadcrumbStyle: OverlayExplorerBreadcrumbStyle;
  selectionStyle: OverlayExplorerSelectionStyle;
  hoverStyle: OverlayExplorerHoverStyle;
  previewStyle: OverlayExplorerPreviewStyle;
  statusBarStyle: OverlayExplorerStatusBarStyle;
  labelMode: OverlayExplorerLabelMode;
  preferredViewMode: ExplorerViewMode | null;
  preferredExperimentalViewMode: ExplorerExperimentalViewMode | null;
  metrics: Required<OverlayExplorerThemeMetrics>;
  surfaces: Required<OverlayExplorerThemeSurfaces>;
  typography: Required<OverlayExplorerThemeTypography>;
  cssVars: Record<string, string>;
}
⋮----
function clampNumber(value: number, min: number, max: number): number
⋮----
function asFiniteNumber(value: unknown): number | undefined
⋮----
function asTrimmedString(value: unknown): string | undefined
⋮----
function isExplorerViewMode(value: unknown): value is ExplorerViewMode
⋮----
function isExplorerExperimentalViewMode(value: unknown): value is ExplorerExperimentalViewMode
⋮----
function normalizeCssVarRecord(value: Record<string, unknown> | undefined): Record<string, string>
⋮----
function compactObject<T extends object>(input: T | undefined): Partial<T>
⋮----
export function normalizeExplorerThemeRecipe(
  recipe?: OverlayExplorerThemeRecipe,
  fallback?: OverlayExplorerThemeRecipe,
): OverlayExplorerThemeRecipe | undefined
⋮----
function inferPreset(appearance?: ResolvedOverlayAppearance): OverlayExplorerThemePreset
⋮----
function createPresetRecipe(preset: OverlayExplorerThemePreset): OverlayExplorerThemeRecipe
⋮----
function inferExplorerPresetFromEngine(appearance?: ResolvedOverlayAppearance): OverlayExplorerThemePreset | undefined
⋮----
function getDensitySpacingScale(density: ThemeDensity | null | undefined): number
⋮----
function getIconStyleScale(iconStyle: ThemeIconStyle | null | undefined): number
⋮----
function getHoverLiftFromMotion(motionStyle: ThemeMotionStyle | null | undefined): number
⋮----
function createExplorerStyleSeed(
  appearance?: ResolvedOverlayAppearance,
): Pick<
  OverlayExplorerThemeRecipe,
  'toolbarStyle' | 'breadcrumbStyle' | 'selectionStyle' | 'hoverStyle' | 'previewStyle' | 'statusBarStyle' | 'labelMode'
> {
  const chromeStyle = appearance?.baseTheme.compiledEngineManifest?.manifest.presentation.chromeStyle;
switch (chromeStyle)
⋮----
function createExplorerEngineRecipe(
  appearance?: ResolvedOverlayAppearance,
): OverlayExplorerThemeRecipe
⋮----
function formatLength(value: number): string
⋮----
function resolveMetrics(
  presetMetrics: OverlayExplorerThemeMetrics | undefined,
  overrideMetrics: OverlayExplorerThemeMetrics | undefined,
): Required<OverlayExplorerThemeMetrics>
⋮----
function resolveSurfaces(
  presetSurfaces: OverlayExplorerThemeSurfaces | undefined,
  overrideSurfaces: OverlayExplorerThemeSurfaces | undefined,
): Required<OverlayExplorerThemeSurfaces>
⋮----
function resolveTypography(
  presetTypography: OverlayExplorerThemeTypography | undefined,
  overrideTypography: OverlayExplorerThemeTypography | undefined,
): Required<OverlayExplorerThemeTypography>
⋮----
export function resolveExplorerThemeRecipe(
  appearance?: ResolvedOverlayAppearance,
): ResolvedExplorerThemeRecipe
⋮----
export function applyExplorerThemeToGridMetrics(
  metrics: ExplorerGridMetrics,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerGridMetrics
⋮----
export function applyExplorerThemeToRowMetrics(
  metrics: ExplorerRowMetrics | undefined,
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerRowMetrics | undefined
⋮----
export function applyExplorerThemeToAdaptiveDensityStop(
  densityStop: AdaptiveSemanticDensityStopDefinition | null,
  explorerTheme: ResolvedExplorerThemeRecipe,
): AdaptiveSemanticDensityStopDefinition | null
````

## File: config/explorerThumbnails.ts
````typescript
import {
  isAudioPreviewExtension,
  isEditableTextExtension,
  isImagePreviewExtension,
  isVideoPreviewExtension,
} from './filePreview';
⋮----
export interface ExplorerThumbnailSettings {
  enabled: boolean;
  includeImages: boolean;
  includeCode: boolean;
  includeShaders: boolean;
  includeAudio: boolean;
  includeVideo: boolean;
  enableVideoHoverScrub: boolean;
  videoHoverScrubFrameCount: number;
}
⋮----
export function normalizeExplorerThumbnailSettings(
  value: unknown,
): ExplorerThumbnailSettings
⋮----
export function isShaderThumbnailExtension(extension: string): boolean
⋮----
export function canRenderExplorerThumbnail(
  extension: string,
  size: number,
  settings: ExplorerThumbnailSettings,
): boolean
⋮----
export function clampVideoHoverScrubFrameCount(value: unknown): number
````

## File: config/explorerViewModes.ts
````typescript
export type ExplorerViewMode =
  | 'icons-xl'
  | 'icons-l'
  | 'icons-m'
  | 'icons-s'
  | 'columns'
  | 'list'
  | 'details';
⋮----
export type ExplorerViewPresentation = 'grid' | 'table' | 'list';
export type ExplorerViewWheelDirection = 'larger' | 'smaller';
⋮----
export interface ExplorerGridMetrics {
  minWidth: number;
  gap: number;
  padding: number;
  rowHeight: number;
  searchRowHeight: number;
  newItemHeight: number;
  iconSize: number;
  iconStageSize: number;
  tileRadius: number;
  nameLines: number;
}
⋮----
export interface ExplorerRowMetrics {
  rowHeight: number;
  searchRowHeight: number;
  newItemHeight: number;
  iconSize: number;
}
⋮----
export interface ExplorerViewModeDefinition {
  id: ExplorerViewMode;
  label: string;
  shortLabel: string;
  description: string;
  presentation: ExplorerViewPresentation;
  zoomOrder: number;
  grid?: ExplorerGridMetrics;
  rows?: ExplorerRowMetrics;
}
⋮----
export function isExplorerViewMode(value: unknown): value is ExplorerViewMode
⋮----
export function normalizeExplorerViewMode(value: unknown): ExplorerViewMode
⋮----
export function getExplorerViewModeDefinition(mode: ExplorerViewMode): ExplorerViewModeDefinition
⋮----
export function isExplorerGridMode(mode: ExplorerViewMode): mode is 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s'
⋮----
export function getExplorerGridZoomAnchor(mode: ExplorerViewMode): number
⋮----
export function normalizeExplorerGridZoom(value: unknown, fallbackMode: ExplorerViewMode = 'icons-l'): number
⋮----
export function stepExplorerGridZoom(currentZoom: number, direction: ExplorerViewWheelDirection): number
⋮----
export function getNearestExplorerGridMode(gridZoom: number): 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s'
⋮----
export function getAdjacentExplorerGridMode(
  currentMode: ExplorerViewMode,
  direction: ExplorerViewWheelDirection,
): 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s'
⋮----
export function getExplorerGridMetricsForZoom(gridZoom: number): ExplorerGridMetrics
⋮----
export function getExplorerGridZoomPercent(gridZoom: number): number
⋮----
export function stepExplorerViewMode(
  currentMode: ExplorerViewMode,
  direction: ExplorerViewWheelDirection,
): ExplorerViewMode
⋮----
export function resolveEffectiveExplorerViewMode(
  requestedMode: ExplorerViewMode,
  options: {
    isCompactDock: boolean;
    isSearchActive: boolean;
  },
): ExplorerViewMode
⋮----
function clamp(value: number, min: number, max: number): number
⋮----
function lerp(start: number, end: number, t: number): number
````

## File: config/explorerWorkspaceLayouts.ts
````typescript
export type ExplorerPaneId = 'pane-1' | 'pane-2' | 'pane-3' | 'pane-4';
export type ExplorerWorkspaceLayoutMode = 'single' | 'split' | 'quad';
⋮----
export interface ExplorerWorkspaceLayoutDefinition {
  id: ExplorerWorkspaceLayoutMode;
  label: string;
  shortLabel: string;
  description: string;
  visiblePaneIds: ExplorerPaneId[];
  supportsColumnSplit: boolean;
  supportsRowSplit: boolean;
}
⋮----
export function normalizeExplorerWorkspaceLayoutMode(
  value: unknown,
): ExplorerWorkspaceLayoutMode
⋮----
export function getExplorerWorkspaceLayoutDefinition(
  layoutMode?: ExplorerWorkspaceLayoutMode | null,
): ExplorerWorkspaceLayoutDefinition
⋮----
export function getExplorerWorkspaceVisiblePaneIds(
  layoutMode?: ExplorerWorkspaceLayoutMode | null,
): ExplorerPaneId[]
⋮----
export function normalizeExplorerPaneId(value: unknown): ExplorerPaneId
⋮----
export function getExplorerPaneIndex(paneId: ExplorerPaneId): number
⋮----
export function getExplorerPaneLabel(paneId: ExplorerPaneId): string
⋮----
export function createEmptyExplorerPaneRecord<T>(
  factory: () => T,
): Record<ExplorerPaneId, T>
⋮----
export function clampExplorerWorkspaceAxisRatio(value: unknown): number
````

## File: config/filePreview.ts
````typescript
export type ModelPreviewFormat = "fbx" | "glb" | "gltf" | "obj" | "stl";
export type ExplorerAudioExportFormatId = "mp3" | "wav" | "flac" | "ogg";
⋮----
export interface ExplorerAudioExportFormatDefinition {
  id: ExplorerAudioExportFormatId;
  label: string;
  extension: string;
  mimeType: string;
}
⋮----
export function isImagePreviewExtension(extension: string): boolean
⋮----
export function isExecutableExtension(extension: string): boolean
⋮----
export function isAudioPreviewExtension(extension: string): boolean
⋮----
export function isVideoPreviewExtension(extension: string): boolean
⋮----
export function getAudioPreviewMimeType(extension: string): string | null
⋮----
export function getExplorerAudioExportFormatDefinition(
  formatId: string,
): ExplorerAudioExportFormatDefinition | null
⋮----
export function isDirectAudioPreviewExtension(extension: string): boolean
⋮----
export function getVideoPreviewMimeType(extension: string): string | null
⋮----
export function getModelPreviewFormat(
  extension: string,
): ModelPreviewFormat | null
⋮----
export function getMonacoLanguage(extension: string): string
⋮----
export function isEditableTextExtension(
  extension: string,
  size: number,
): boolean
⋮----
function normalizeExtension(extension: string): string
````

## File: config/folderIcons.ts
````typescript
import {
  getBuiltInIconTheme,
  resolveIconSrc,
  type OverlayResolvedIconTheme,
} from './iconTheme';
⋮----
export type GeneratedFolderIconPair = {
  closed: string;
  open: string | null;
};
⋮----
function isFolderIconId(iconId: string): boolean
⋮----
export type FolderIconValue = typeof BUILT_IN_FOLDER_ICON_IDS[number];
⋮----
export interface FolderIconRule {
  id: string;
  label: string;
  matchers: string[];
  icon: FolderIconValue;
}
⋮----
export interface FolderIconOption {
  value: FolderIconValue;
  label: string;
  closedSrc: string;
  openSrc: string;
}
⋮----
export interface FolderIconResolverConfig {
  rules?: readonly FolderIconRule[];
  defaultIcon?: FolderIconValue;
  iconTheme?: OverlayResolvedIconTheme;
}
⋮----
export interface FolderIconResolution {
  icon: FolderIconValue;
  matchedRule: FolderIconRule | null;
}
⋮----
function titleCase(value: string): string
⋮----
function splitCamelCase(value: string): string
⋮----
export function normalizeFolderIconMatcher(value: string): string
⋮----
function tokenizeSegment(value: string): string[]
⋮----
function buildSegmentVariants(segment: string): string[]
⋮----
function buildCandidateMatchers(folderPath: string): string[]
⋮----
function cloneRule(rule: FolderIconRule): FolderIconRule
⋮----
function buildLabelForIcon(iconId: string): string
⋮----
function buildRuleId(iconId: string): string
⋮----
function groupMatchersByIcon(folderNames: Record<string, string>): Map<FolderIconValue, string[]>
⋮----
function createFolderRulesFromNames(folderNames: Record<string, string>): FolderIconRule[]
⋮----
export function createDefaultFolderIconRules(): FolderIconRule[]
⋮----
function resolveOpenFolderIconId(icon: FolderIconValue, iconTheme: OverlayResolvedIconTheme): string
⋮----
function getIconPair(icon: FolderIconValue, iconTheme?: OverlayResolvedIconTheme): GeneratedFolderIconPair
⋮----
function buildThemeRules(iconTheme?: OverlayResolvedIconTheme): FolderIconRule[]
⋮----
function getEffectiveRules(
  rules: readonly FolderIconRule[] | undefined,
  iconTheme?: OverlayResolvedIconTheme,
): readonly FolderIconRule[]
⋮----
function getOptionLabel(icon: FolderIconValue): string
⋮----
export function getNamedFolderIconSrc(
  icon: FolderIconValue,
  open = false,
  iconTheme?: OverlayResolvedIconTheme,
): string
⋮----
function findMatchingRule(folderPath: string, rules: readonly FolderIconRule[]): FolderIconRule | null
⋮----
export function resolveFolderIcon(
  folderPath: string,
  config: FolderIconResolverConfig = {},
): FolderIconResolution
⋮----
export function resolveFolderIconPair(folderPath: string, config: FolderIconResolverConfig =
⋮----
export function getFolderIconSrc(folderPath: string, open = false, config: FolderIconResolverConfig =
````

## File: config/frameTelemetry.ts
````typescript
import { recordExplorerPerformanceSample } from './performanceTelemetry';
import type { ExplorerPerformanceSample } from './performanceTelemetry';
⋮----
export interface OverlayFrameTelemetryStats {
  avgFrameMs: number;
  avgFps: number;
  p95FrameMs: number;
  worstFrameMs: number;
  frameCount: number;
  overBudgetCount: number;
  withinTarget: boolean;
  windowDurationMs: number;
}
⋮----
export function shouldFlushOverlayFrameWindow(frameCount: number, windowDurationMs: number): boolean
⋮----
export function summarizeOverlayFrameWindow(
  frameDurations: readonly number[],
  windowDurationMs: number,
): OverlayFrameTelemetryStats | null
⋮----
export function recordOverlayFrameTelemetry(
  stats: OverlayFrameTelemetryStats,
  metadata: Record<string, string | number | boolean | null> = {},
): ExplorerPerformanceSample
⋮----
function roundMetric(value: number): number
````

## File: config/hotkeys.ts
````typescript
export type HotkeyBindingKey =
  | 'toggleDeveloperTelemetryHud'
  | 'commandPalette'
  | 'terminalFocus'
  | 'terminalToggle'
  | 'windowModeToggle'
  | 'saveFile'
  | 'newFile'
  | 'newFolder'
  | 'renameItem'
  | 'deleteItem'
  | 'duplicateItem'
  | 'refreshExplorer'
  | 'goBackDirectory'
  | 'goForwardDirectory'
  | 'goHomeDirectory'
  | 'clearExplorerSearch'
  | 'toggleExplorerSearchScope'
  | 'cycleExplorerSortKey'
  | 'toggleExplorerSortOrder'
  | 'focusExplorerList'
  | 'focusExplorerAddressBar'
  | 'focusExplorerPreview'
  | 'openInTerminal'
  | 'calculateRecursiveSize'
  | 'revealInExplorer'
  | 'openAsAdmin'
  | 'goUpDirectory'
  | 'copyPath'
  | 'copySelection'
  | 'cutSelection'
  | 'pasteSelection'
  | 'toggleHiddenFiles'
  | 'toggleExplorerLayout'
  | 'selectAllExplorer'
  | 'clearExplorerSelection'
  | 'searchExplorer'
  | 'closeTab'
  | 'find'
  | 'replace'
  | 'zoomAdjust'
  | 'opacityAdjust';
⋮----
export interface HotkeyBindingDefinition {
  key: HotkeyBindingKey;
  label: string;
  description: string;
  defaultValue: string;
  scope: 'global' | 'gesture' | 'local';
}
⋮----
export type HotkeyBindingSettings = Record<HotkeyBindingKey, string>;
⋮----
export function createDefaultKeybindingSettings(): HotkeyBindingSettings
⋮----
export function normalizeKeybindingValue(value: unknown, fallback: string): string
⋮----
export function normalizeKeybindingSettings(
  value: Partial<Record<HotkeyBindingKey, unknown>> | undefined,
): HotkeyBindingSettings
⋮----
export function getHotkeyBindingDefinition(key: HotkeyBindingKey): HotkeyBindingDefinition
⋮----
export function formatHotkeyLabel(value: string): string
⋮----
function normalizeGestureToken(token: string): string
⋮----
function normalizeKeyToken(token: string): string
⋮----
export function matchesKeybinding(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  binding: string,
): boolean
⋮----
export function matchesWheelHotkey(
  event: Pick<WheelEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  binding: string,
): boolean
````

## File: config/iconTheme.ts
````typescript
import canonicalIconThemeJson from './canonicalIconTheme.json';
⋮----
export interface OverlayIconDefinition {
  iconPath?: string;
}
⋮----
export interface OverlayIconThemeManifest {
  name?: string;
  version?: number;
  description?: string;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  iconDefinitions?: Record<string, OverlayIconDefinition | string>;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
}
⋮----
export interface OverlayResolvedIconTheme {
  name: string;
  version: number;
  description?: string;
  file: string;
  folder: string;
  folderExpanded: string;
  iconDefinitions: Record<string, string>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
}
⋮----
export interface OverlayFileIconResolution {
  iconId: string;
  matchKind: 'fileName' | 'extension' | 'default';
}
⋮----
function normalizeIconId(value: string): string
⋮----
function normalizeMatcherMap(source: Record<string, string> | undefined): Record<string, string>
⋮----
function normalizeIconDefinitions(
  source: Record<string, OverlayIconDefinition | string> | undefined,
  resolvePath: (iconPath: string) => string,
): Record<string, string>
⋮----
function normalizeThemeManifest(
  source: OverlayIconThemeManifest,
  resolvePath: (iconPath: string) => string,
): OverlayResolvedIconTheme
⋮----
function resolveBuiltInIconPath(iconPath: string): string
⋮----
export function getBuiltInIconTheme(): OverlayResolvedIconTheme
⋮----
export function parseIconThemeManifest(source: string): OverlayIconThemeManifest
⋮----
export function resolveIconThemeManifest(
  source: OverlayIconThemeManifest,
  resolvePath: (iconPath: string) => string,
): OverlayResolvedIconTheme
⋮----
export function createResolvedIconThemeFromEntries(iconDefinitions: Record<string, string>): OverlayResolvedIconTheme
⋮----
export function mergeResolvedIconThemes(
  baseTheme: OverlayResolvedIconTheme,
  overrideTheme?: OverlayResolvedIconTheme,
): OverlayResolvedIconTheme
⋮----
export function resolveIconSrc(iconId: string, iconTheme?: OverlayResolvedIconTheme): string | undefined
⋮----
export function resolveFileIconId(
  entryName: string,
  extension: string,
  iconTheme?: OverlayResolvedIconTheme,
): string
⋮----
export function resolveFileIcon(
  entryName: string,
  extension: string,
  iconTheme?: OverlayResolvedIconTheme,
): OverlayFileIconResolution
⋮----
export function resolveFileIconSrc(
  entryName: string,
  extension: string,
  iconTheme?: OverlayResolvedIconTheme,
): string
````

## File: config/layoutProfiles.ts
````typescript
import { parse as parseToml } from 'smol-toml';
import type {
  LayoutBackBehavior as GeneratedLayoutBackBehavior,
  ExplorerLayoutMode as GeneratedExplorerLayoutMode,
  LayoutBarPosition as GeneratedLayoutBarPosition,
  LayoutBehaviorConfig as GeneratedLayoutBehaviorConfig,
  LayoutChromeConfig as GeneratedLayoutChromeConfig,
  LayoutControlDockConfig as GeneratedLayoutControlDockConfig,
  LayoutDockSide as GeneratedLayoutDockSide,
  LayoutInteractionConfig as GeneratedLayoutInteractionConfig,
  LayoutModeExitTarget as GeneratedLayoutModeExitTarget,
  LayoutManifest as GeneratedLayoutManifest,
  LayoutProgressOwner as GeneratedLayoutProgressOwner,
  LayoutPinnedPanel as GeneratedLayoutPinnedPanel,
  LayoutProfile as GeneratedLayoutProfile,
  LayoutSurfaceOwner as GeneratedLayoutSurfaceOwner,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import {
  normalizeShellBlueprintId,
  type OverlayShellBlueprintId,
} from './shellBlueprints';
⋮----
export type LayoutBarPosition = GeneratedLayoutBarPosition;
export type LayoutDockSide = GeneratedLayoutDockSide;
export type ExplorerLayoutMode = GeneratedExplorerLayoutMode;
⋮----
export type LayoutPinnedPanel = GeneratedLayoutPinnedPanel;
⋮----
export type LayoutChromeConfig = GeneratedLayoutChromeConfig;
⋮----
export type LayoutControlDockConfig = GeneratedLayoutControlDockConfig;
⋮----
export type LayoutBehaviorConfig = GeneratedLayoutBehaviorConfig;
⋮----
export type LayoutSurfaceOwner = GeneratedLayoutSurfaceOwner;
⋮----
export type LayoutBackBehavior = GeneratedLayoutBackBehavior;
⋮----
export type LayoutModeExitTarget = GeneratedLayoutModeExitTarget;
⋮----
export type LayoutProgressOwner = GeneratedLayoutProgressOwner;
⋮----
export type LayoutInteractionConfig = GeneratedLayoutInteractionConfig;
⋮----
export type LayoutProfile = Omit<GeneratedLayoutProfile, 'shellBlueprint'> & { shellBlueprint: OverlayShellBlueprintId };
⋮----
export type LayoutManifest = Omit<GeneratedLayoutManifest, 'profiles'> & {
  profiles: LayoutProfile[];
};
⋮----
type LooseRecord = Record<string, unknown>;
⋮----
function clampNumber(value: number, min: number, max: number): number
⋮----
function asRecord(value: unknown): LooseRecord | null
⋮----
function asString(value: unknown, fallback: string): string
⋮----
function asBoolean(value: unknown, fallback: boolean): boolean
⋮----
function asNumber(value: unknown, fallback: number): number
⋮----
function asStringArray(value: unknown, fallback: string[]): string[]
⋮----
function normalizeLayoutSurfaceOwner(value: unknown, fallback: LayoutSurfaceOwner): LayoutSurfaceOwner
⋮----
function normalizeLayoutBackBehavior(value: unknown, fallback: LayoutBackBehavior): LayoutBackBehavior
⋮----
function normalizeLayoutModeExitTarget(value: unknown, fallback: LayoutModeExitTarget): LayoutModeExitTarget
⋮----
function normalizeLayoutProgressOwner(value: unknown, fallback: LayoutProgressOwner): LayoutProgressOwner
⋮----
function normalizeLayoutInteraction(
  input: unknown,
  fallback: LayoutInteractionConfig,
): LayoutInteractionConfig
⋮----
function normalizePinnedPanel(input: unknown): LayoutPinnedPanel | null
⋮----
function normalizeLayoutProfile(input: unknown, fallback: LayoutProfile, fallbackOrder: number): LayoutProfile
⋮----
function sortProfiles(profiles: LayoutProfile[]): LayoutProfile[]
⋮----
export function normalizeLayoutManifest(input: unknown): LayoutManifest
⋮----
export function getDefaultLayoutProfile(manifest: LayoutManifest = BUILT_IN_LAYOUT_MANIFEST): LayoutProfile
⋮----
export function resolveLayoutProfile(
  manifest: LayoutManifest,
  activeProfileId: string | null | undefined,
): LayoutProfile
⋮----
export function getNextLayoutProfileId(
  manifest: LayoutManifest,
  activeProfileId: string | null | undefined,
): string
⋮----
export function getPinnedPanelIds(profile: LayoutProfile): string[]
⋮----
export function isPanelPinned(profile: LayoutProfile, panelId: string): boolean
⋮----
export function getTabbedOpenPanelIds(profile: LayoutProfile, openPanelIds: string[]): string[]
⋮----
export function getPanelsBySide(profile: LayoutProfile, side: LayoutDockSide): LayoutPinnedPanel[]
⋮----
export function buildDefaultLayoutConfigCandidates(homeDir: string): string[]
⋮----
function parseLayoutManifestText(text: string, filePath: string): LayoutManifest
⋮----
export interface LoadedLayoutManifest {
  manifest: LayoutManifest;
  sourcePath: string | null;
  sourceType: 'built-in' | 'file';
  sourceError: string | null;
}
⋮----
export async function loadExternalLayoutManifest(preferredPath?: string | null): Promise<LoadedLayoutManifest>
````

## File: config/nativeIcons.ts
````typescript
export interface OverlayNativeIconRequest {
  path: string;
  size?: number;
}
⋮----
export interface OverlayNativeIconResponse {
  path: string;
  src?: string | null;
}
⋮----
export function getNativeIconCacheKey(path: string, size = DEFAULT_NATIVE_ICON_SIZE): string
````

## File: config/notes.ts
````typescript
import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
⋮----
export type ManagedNoteCategoryId = keyof typeof noteCategoryDirectoryNames;
⋮----
export function getManagedNotesRootDirectory(): string
⋮----
export function getManagedNoteCategoryDirectory(category: ManagedNoteCategoryId): string
⋮----
export function joinManagedNotePath(directory: string, fileName: string): string
````

## File: config/overlayAnimations.ts
````typescript
import type { CSSProperties } from 'react';
⋮----
export type OverlayAnimationPresetId = string;
⋮----
export type OverlayAnimationDirection = 'enter' | 'exit';
export type OverlayAnimationPhase = 'closed' | 'opening' | 'open' | 'closing';
export type OverlayAnimationVerticalOrigin = 'top' | 'bottom';
⋮----
interface MotionShape {
  translateYPercent: number;
  scale: number;
  rotateDeg: number;
  opacity: number;
  blurPx: number;
  saturate: number;
}
⋮----
export interface OverlayAnimationPreset {
  id: OverlayAnimationPresetId;
  label: string;
  description: string;
  group: 'motion' | 'effect';
  enterFrom: MotionShape;
  exitTo: MotionShape;
  enterEasing: string;
  exitEasing: string;
  effect: 'none' | 'dissolve' | 'burn' | 'fizzle';
}
⋮----
export function getOverlayAnimationPreset(id: OverlayAnimationPresetId): OverlayAnimationPreset
⋮----
export function clampOverlayAnimationDuration(value: number): number
⋮----
export function clampOverlayAnimationIntensity(value: number): number
⋮----
function scaleMotionShape(shape: MotionShape, intensity: number): MotionShape
⋮----
function getVerticalDirectionSign(origin: OverlayAnimationVerticalOrigin | undefined): number
⋮----
export function getOverlayAnimationTransition(args: {
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  presetId: OverlayAnimationPresetId;
  durationMs: number;
}): string
⋮----
export function getOverlayAnimationStyle(args: {
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  presetId: OverlayAnimationPresetId;
  baseOpacity: number;
  intensity: number;
  durationMs: number;
  verticalOrigin?: OverlayAnimationVerticalOrigin;
}): CSSProperties
⋮----
export function getOverlayEffectStyle(args: {
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  presetId: OverlayAnimationPresetId;
  durationMs: number;
  intensity: number;
  accentColor: string;
  verticalOrigin?: OverlayAnimationVerticalOrigin;
}): CSSProperties | null
````

## File: config/overlayWindow.ts
````typescript
export interface OverlayVisualControlDefinition {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue: (value: number) => string;
}
⋮----
export interface OverlayWindowBounds {
  width: number;
  height: number;
  x: number;
  y: number;
}
⋮----
export interface OverlayWindowLayout extends OverlayWindowBounds {
  healedHeight: number | null;
}
⋮----
type OverlayWindowArea = {
  position: { x: number; y: number };
  size: { width: number; height: number };
};
⋮----
function formatPercentValue(value: number): string
⋮----
function formatPixelValue(value: number): string
⋮----
export type OverlayVisualControlKey = keyof typeof overlayVisualControls;
⋮----
export function clampOverlayVisualControlValue(
  key: OverlayVisualControlKey,
  value: number,
): number
⋮----
export function formatOverlayVisualControlValue(
  key: OverlayVisualControlKey,
  value: number,
): string
⋮----
function clampValue(value: number, min: number, max: number): number
⋮----
function resolvePhysicalPadding(scaleFactor: number): number
⋮----
export function computeOverlayWindowLayout(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: 'top' | 'bottom';
}): OverlayWindowLayout
⋮----
export function computeAnchoredOverlayWindowLayout(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: 'top' | 'bottom';
  currentBounds?: OverlayWindowBounds | null;
}): OverlayWindowLayout
⋮----
export function clampOverlayWindowBoundsToWorkArea(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  bounds: OverlayWindowBounds;
}): OverlayWindowBounds
````

## File: config/performanceTelemetry.ts
````typescript
export type ExplorerPerformanceMetricId = keyof typeof explorerPerformanceBudgets;
⋮----
export type ExplorerPerformanceMetadataValue = string | number | boolean | null;
export type ExplorerPerformanceMetadata = Record<string, ExplorerPerformanceMetadataValue>;
⋮----
export interface ExplorerPerformanceSample {
  metricId: ExplorerPerformanceMetricId;
  durationMs: number;
  recordedAt: number;
  metadata: ExplorerPerformanceMetadata;
}
⋮----
export interface ExplorerPerformanceSnapshot {
  version: number;
  samples: Record<ExplorerPerformanceMetricId, ExplorerPerformanceSample[]>;
}
⋮----
export interface ExplorerPerformanceSummary {
  metricId: ExplorerPerformanceMetricId;
  label: string;
  targetMs: number;
  count: number;
  latestMs: number | null;
  avgMs: number | null;
  p95Ms: number | null;
  bestMs: number | null;
  worstMs: number | null;
  overBudgetCount: number;
  latestAt: number | null;
  latestMetadata: ExplorerPerformanceMetadata;
}
⋮----
export function loadExplorerPerformanceSnapshot(storage: Storage | null = getStorage()): ExplorerPerformanceSnapshot
⋮----
export function resetExplorerPerformanceSnapshot(storage: Storage | null = getStorage()): ExplorerPerformanceSnapshot
⋮----
export function recordExplorerPerformanceSample(
  input: {
    metricId: ExplorerPerformanceMetricId;
    durationMs: number;
    recordedAt?: number;
    metadata?: ExplorerPerformanceMetadata;
  },
  storage: Storage | null = getStorage(),
): ExplorerPerformanceSnapshot
⋮----
export function summarizeExplorerPerformance(
  snapshot: ExplorerPerformanceSnapshot = loadExplorerPerformanceSnapshot(),
): Record<ExplorerPerformanceMetricId, ExplorerPerformanceSummary>
⋮----
function summarizeMetric(
  metricId: ExplorerPerformanceMetricId,
  samples: ExplorerPerformanceSample[],
): ExplorerPerformanceSummary
⋮----
function schedulePersist(storage: Storage | null): void
⋮----
function persistSnapshot(storage: Storage): void
⋮----
// Ignore storage failures. Telemetry is best-effort only.
⋮----
function createDefaultExplorerPerformanceSnapshot(): ExplorerPerformanceSnapshot
⋮----
function normalizeExplorerPerformanceSnapshot(value: Partial<ExplorerPerformanceSnapshot> | null | undefined): ExplorerPerformanceSnapshot
⋮----
function normalizeSamples(value: unknown, metricId: ExplorerPerformanceMetricId): ExplorerPerformanceSample[]
⋮----
function normalizeSample(value: unknown, metricId: ExplorerPerformanceMetricId): ExplorerPerformanceSample | null
⋮----
function normalizeDurationMs(value: unknown): number
⋮----
function normalizeRecordedAt(value: unknown): number
⋮----
function normalizeMetadata(value: unknown): ExplorerPerformanceMetadata
⋮----
function isMetadataValue(value: unknown): value is ExplorerPerformanceMetadataValue
⋮----
function cloneSnapshot(snapshot: ExplorerPerformanceSnapshot): ExplorerPerformanceSnapshot
⋮----
function roundMetric(value: number): number
⋮----
function getStorage(): Storage | null
⋮----
function createMetricRecord<T>(factory: (metricId: ExplorerPerformanceMetricId) => T): Record<ExplorerPerformanceMetricId, T>
````

## File: config/pilotThemeContract.ts
````typescript
import { DEFAULT_ADAPTIVE_SEMANTIC_DENSITY } from './explorerExperimentalModes';
import type { OverlayExplorerThemeRecipe } from './explorerTheme';
import type { ExplorerShellLayoutId } from './explorerShellLayouts';
import type { ExplorerViewMode } from './explorerViewModes';
import type { OverlayWallpaperFitMode } from './wallpapers';
import type { OverlayWorkbenchThemeRecipe } from './workbenchTheme';
⋮----
export interface ThemeSelectionAppearanceDefaults {
  theme?: 'dark' | 'light' | 'system';
  dockThemeMode?: 'follow-app' | 'override';
  activeDockThemeId?: string | null;
  activeWallpaperId?: string | null;
  wallpaperFitMode?: OverlayWallpaperFitMode;
  wallpaperOpacity?: number;
  wallpaperMuted?: boolean;
  activeShaderId?: string | null;
  uiFontFamily?: string;
  useNativeOsIcons?: boolean;
  appOpacity?: number;
  panelTransparency?: number;
  appZoom?: number;
  appBlur?: boolean;
  appBlurStrength?: number;
  appOpenAnimation?: string | null;
  appCloseAnimation?: string | null;
}
⋮----
export interface ThemeSelectionExplorerDefaults {
  showHiddenFiles?: boolean;
  viewMode?: ExplorerViewMode;
  experimentalViewMode?: 'off' | 'adaptive-semantic-grid' | 'constellation' | 'timeline-surface';
  experimentalDensity?: number;
  folderClickMode?: 'single' | 'double';
}
⋮----
export interface ThemeSelectionExplorerSessionDefaults {
  sidebarWidth?: number | null;
  previewWidth?: number | null;
  previewEnabled?: boolean;
  shellLayoutId?: ExplorerShellLayoutId;
  sourcesVisible?: boolean;
}
⋮----
export interface ThemeSelectionLayoutDefaults {
  activeProfileId?: string;
}
⋮----
export interface ThemeSelectionDefaults {
  appearance?: ThemeSelectionAppearanceDefaults;
  explorer?: ThemeSelectionExplorerDefaults;
  explorerSession?: ThemeSelectionExplorerSessionDefaults;
  layout?: ThemeSelectionLayoutDefaults;
}
⋮----
function createBuiltInThemeSelectionDefaults(
  themeMode: 'dark' | 'light',
  overrides?: ThemeSelectionDefaults,
): ThemeSelectionDefaults
⋮----
export function getThemeSelectionDefaults(
  themeId: string | null | undefined,
): ThemeSelectionDefaults | null
⋮----
export function isPilotThemeId(themeId: string | null | undefined): boolean
````

## File: config/platform.ts
````typescript
export type RuntimePlatform = 'windows' | 'macos' | 'linux' | 'unknown';
⋮----
export type ExternalTerminalProfile =
  | 'auto'
  | 'system'
  | 'windows-terminal'
  | 'pwsh'
  | 'powershell'
  | 'cmd'
  | 'terminal'
  | 'iterm'
  | 'gnome-terminal'
  | 'konsole'
  | 'xterm'
  | 'custom';
⋮----
export interface ExternalTerminalProfileOption {
  id: ExternalTerminalProfile;
  label: string;
  description: string;
}
⋮----
export interface BookmarkSeed {
  id: string;
  name: string;
  value: string;
}
⋮----
function readClientPlatformSource(): string
⋮----
export function detectClientPlatform(): RuntimePlatform
⋮----
export function getDefaultIntegratedShell(platform = detectClientPlatform()): string
⋮----
export function getExternalTerminalProfileOptions(
  platform = detectClientPlatform(),
): ExternalTerminalProfileOption[]
⋮----
export function getPlatformPathSeparator(platform = detectClientPlatform()): '/' | '\\'
⋮----
export function joinPlatformPath(
  base: string,
  segment: string,
  platform = detectClientPlatform(),
): string
⋮----
export function getFallbackExplorerPath(platform = detectClientPlatform()): string
⋮----
export function createDefaultDirectoryBookmarks(
  homeDir?: string,
  platform = detectClientPlatform(),
): BookmarkSeed[]
⋮----
export function createDefaultCommandBookmarks(): BookmarkSeed[]
````

## File: config/pluginContributions.ts
````typescript
export interface OverlayPluginCommandContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  name: string;
  command: string;
  description?: string;
  runOnSelect: boolean;
}
⋮----
export interface OverlayPluginExplorerActionContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  label: string;
  command: string;
  description?: string;
  appliesTo: 'any' | 'file' | 'directory';
  runOnSelect: boolean;
}
⋮----
export type OverlayPluginContextMenuContributionExecution =
  | {
    kind: 'terminal-template';
    command: string;
    runOnSelect: boolean;
  }
  | {
    kind: 'plugin-backend';
    entry: string;
    args: string[];
  }
  | {
    kind: 'panel-request';
    panelId: string;
    payload: Record<string, string>;
  };
⋮----
export interface OverlayPluginContextMenuContribution {
  id: string;
  pluginId: string;
  pluginName: string;
  title: string;
  description?: string;
  contexts: Array<'entry' | 'background'>;
  appliesTo: 'any' | 'file' | 'directory';
  group?: string;
  defaultOrder?: number;
  iconName?: string;
  execution: OverlayPluginContextMenuContributionExecution;
}
⋮----
export interface OverlayPluginCommandContext {
  path: string;
  name: string;
  parent: string;
  extension: string;
  stem: string;
  isDirectory: boolean;
  pluginId: string;
  pluginName: string;
}
⋮----
export interface OverlayTerminalCommandInjectionDetail {
  command: string;
  run?: boolean;
}
⋮----
export function resolvePluginCommandTemplate(
  template: string,
  context: OverlayPluginCommandContext,
): string
⋮----
export function dispatchTerminalCommand(command: string, run = false): void
````

## File: config/pluginPackages.ts
````typescript
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';
⋮----
import type { OverlayRegisteredFontContribution } from './appearance';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from './pluginContributions';
import { joinPlatformPath } from './platform';
import { pluginSystemConfig } from './plugins';
import { type LoadedOverlayThemePackage, loadThemePackagesFromDirectoryEntries } from './themePackages';
import { type LoadedOverlayShader, loadShaderFromSource } from '../components/shaderRuntime';
import {
  type LoadedOverlayPlugin,  
  type OverlayPluginApi,
  type OverlayPluginCapabilitySummary,
  type OverlayPluginContext,
  type PluginFileEntry,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import type { RuntimeRelativeModuleSourceResolver } from '../runtime/moduleRuntime';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
⋮----
interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}
⋮----
type LooseRecord = Record<string, unknown>;
⋮----
interface PluginPackageFontManifest {
  id?: string;
  name?: string;
  family?: string;
  faceName?: string;
  src: string;
  format?: string;
  style?: string;
  weight?: string;
}
⋮----
interface PluginPackageCommandManifest {
  id?: string;
  name?: string;
  command: string;
  description?: string;
  runOnSelect?: boolean;
}
⋮----
interface PluginPackageExplorerActionManifest {
  id?: string;
  label?: string;
  command: string;
  description?: string;
  appliesTo?: 'any' | 'file' | 'directory';
  runOnSelect?: boolean;
}
⋮----
interface PluginPackageContextMenuItemManifest {
  id?: string;
  title?: string;
  label?: string;
  description?: string;
  contexts?: Array<'entry' | 'background'>;
  appliesTo?: 'any' | 'file' | 'directory';
  group?: string;
  order?: number;
  iconName?: string;
  command?: string;
  runOnSelect?: boolean;
  backend?: {
    entry?: string;
    args?: string[];
  };
  panelRequest?: {
    panelId?: string;
    payload?: Record<string, string>;
  };
}
⋮----
interface PluginPackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  entry?: string;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  contributions?: {
    themes?: string[];
    shaders?: string[];
    fonts?: PluginPackageFontManifest[];
    commands?: PluginPackageCommandManifest[];
    explorerActions?: PluginPackageExplorerActionManifest[];
    contextMenuItems?: PluginPackageContextMenuItemManifest[];
  };
}
⋮----
interface PluginPackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: PluginPackageManifest;
}
⋮----
export interface OverlayPluginDiscoveryResult {
  plugins: LoadedOverlayPlugin[];
  themePackages: LoadedOverlayThemePackage[];
  shaders: LoadedOverlayShader[];
  fonts: OverlayRegisteredFontContribution[];
  commands: OverlayPluginCommandContribution[];
  explorerActions: OverlayPluginExplorerActionContribution[];
  contextMenuItems: OverlayPluginContextMenuContribution[];
  warnings: string[];
}
⋮----
function asRecord(value: unknown): LooseRecord | null
⋮----
function asString(value: unknown, fallback = ''): string
⋮----
function asBoolean(value: unknown): boolean | undefined
⋮----
function asStringArray(value: unknown): string[]
⋮----
function asStringRecord(value: unknown): Record<string, string>
⋮----
function asFontManifestArray(value: unknown): PluginPackageFontManifest[]
⋮----
function asCommandManifestArray(value: unknown): PluginPackageCommandManifest[]
⋮----
function asExplorerActionManifestArray(value: unknown): PluginPackageExplorerActionManifest[]
⋮----
function asContextMenuItemManifestArray(value: unknown): PluginPackageContextMenuItemManifest[]
⋮----
function parsePluginManifestText(text: string, filePath: string): PluginPackageManifest
⋮----
function normalizeRelativePath(relativePath: string): string
⋮----
function normalizePackageComparisonPath(path: string): string
⋮----
function normalizePackageRuntimeModulePath(path: string): string | null
⋮----
function getPackageRelativePath(directoryPath: string, filePath: string): string | null
⋮----
function resolvePackageRuntimeModuleImportPath(
  fromModuleRelativePath: string,
  specifier: string,
): string | null
⋮----
function buildPackageRuntimeModuleCandidates(relativePath: string): string[]
⋮----
function isSafeRelativePath(relativePath: string): boolean
⋮----
function getBaseName(filePath: string): string
⋮----
function getParentDirectory(filePath: string): string
⋮----
function deriveIdFromName(name: string, fallback: string): string
⋮----
function deriveDisplayNameFromFilePath(filePath: string): string
⋮----
function derivePackageId(record: PluginPackageRecord): string
⋮----
function derivePackageName(record: PluginPackageRecord): string
⋮----
function toAssetUrl(filePath: string): string
⋮----
function inferFontFormat(filePath: string): string
⋮----
async function readPluginManifest(directoryPath: string): Promise<
⋮----
async function listDirectory(path: string): Promise<FileEntry[]>
⋮----
async function resolveRelativeFileEntry(baseDirectory: string, relativePath: string): Promise<FileEntry | null>
⋮----
async function resolvePackagePanelEntry(record: PluginPackageRecord): Promise<FileEntry | null>
⋮----
function createPluginRelativeModuleSourceResolver(
  packageDirectoryPath: string,
): RuntimeRelativeModuleSourceResolver
⋮----
async function resolveThemeDirectories(record: PluginPackageRecord): Promise<Array<
⋮----
async function resolveShaderEntries(record: PluginPackageRecord): Promise<FileEntry[]>
⋮----
async function loadPluginPackage(
  record: PluginPackageRecord,
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
): Promise<OverlayPluginDiscoveryResult>
⋮----
export async function discoverOverlayPlugins(
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
): Promise<OverlayPluginDiscoveryResult>
````

## File: config/plugins.ts
````typescript
import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
⋮----
export function resolvePluginsDirectory(): string
⋮----
get pluginsDirectory(): string
⋮----
export type FrontendPluginExtension =
  typeof pluginSystemConfig.frontendExtensions[number];
⋮----
export function getPluginDirectory(pluginId: string): string
⋮----
export function getPluginBackendDirectory(pluginId: string): string
⋮----
export function getPluginStorageDirectory(pluginId: string): string
⋮----
export function normalizePluginWatchPathSegments(path: string): string[]
⋮----
export function isIgnoredPluginWatchPath(path: string): boolean
⋮----
export function shouldRefreshForPluginWatchPaths(paths: string[]): boolean
````

## File: config/python.ts
````typescript
import type { RuntimePlatform } from './platform';
⋮----
export interface PythonRuntimeConfig {
  preferredInterpreterPath: string | null;
  runtimeRoot: string | null;
  bootstrapPackages: string | null;
  autoUpgradePip: boolean | null;
  createBoilerplate: boolean | null;
}
⋮----
export interface PythonInterpreterDescriptor {
  id: string;
  label: string;
  command: string;
  args: string[];
  source: string;
  preferred: boolean;
  recommended: boolean;
  executable: string;
  version: string;
  major: number;
  minor: number;
  micro: number;
}
⋮----
export interface PythonBoilerplateFiles {
  readmePath: string;
  requirementsPath: string;
  packageDir: string;
  helloScriptPath: string;
  probeScriptPath: string;
}
⋮----
export interface PythonRuntimeStatus {
  runtimeRoot: string;
  envDir: string;
  scriptsDir: string;
  tempDir: string;
  logsDir: string;
  managedPythonPath: string;
  envExists: boolean;
  ready: boolean;
  managedPythonVersion: string | null;
  managedPipVersion: string | null;
  preferredInterpreterPath: string | null;
  bootstrapPackages: string[];
  interpreterHint: string;
  baseInterpreter: PythonInterpreterDescriptor | null;
  discoveredInterpreters: PythonInterpreterDescriptor[];
  boilerplate: PythonBoilerplateFiles;
}
⋮----
export interface PythonCommandResult {
  command: string;
  workingDirectory: string;
  exitCode: number;
  success: boolean;
  stdout: string;
  stderr: string;
}
⋮----
export interface PythonActionResponse {
  status: PythonRuntimeStatus;
  result: PythonCommandResult;
}
⋮----
export type PythonExecutionMode = 'inline' | 'script' | 'module';
⋮----
export interface PythonQuickPackagePreset {
  id: string;
  label: string;
  description: string;
  packages: string[];
}
⋮----
export interface PythonExamplePreset {
  id: string;
  label: string;
  mode: PythonExecutionMode;
  entry: string;
  description: string;
}
⋮----
export function parseMultilineValues(raw: string): string[]
⋮----
export function createPythonRuntimeConfig(settings: {
  preferredInterpreterPath: string;
  runtimeRoot: string;
  bootstrapPackages: string;
  autoUpgradePip: boolean;
  createBoilerplate: boolean;
}): PythonRuntimeConfig
⋮----
export function summarizeInterpreter(interpreter: PythonInterpreterDescriptor | null): string
⋮----
export function formatCommandOutput(result: PythonCommandResult): string
⋮----
function quotePowerShellLiteral(value: string): string
⋮----
function quotePosixLiteral(value: string): string
⋮----
export function buildManagedPythonReplCommand(
  managedPythonPath: string,
  shell: string,
  platform: RuntimePlatform,
): string
````

## File: config/runtimeAssetPolling.ts
````typescript
function parseBooleanEnv(value: string | undefined): boolean | null
⋮----
export function resolveRuntimeAssetPollingEnabled(): boolean
````

## File: config/runtimeCachePolicy.ts
````typescript
import type {
  ExplorerPerformanceMetadata,
  ExplorerPerformanceMetricId,
} from './performanceTelemetry';
⋮----
export interface FsRuntimeCachePolicy {
  dirListCacheTtlMs: number;
  searchNameIndexCacheTtlMs: number;
  searchContentIndexCacheTtlMs: number;
  entrySizeCacheTtlMs: number;
  entrySizeScanBudgetMs: number;
  searchContentIndexTotalBytesBudget: number;
  maxSearchContentFileBytes: number;
  searchMaxIndexedEntries: number;
}
⋮----
export type RuntimeCachePolicyTelemetryStatus = 'pending' | 'ready' | 'failed' | 'unavailable';
⋮----
export type RuntimeCachePolicyTelemetryMetadata = ExplorerPerformanceMetadata & {
  runtimeCachePolicyStatus: RuntimeCachePolicyTelemetryStatus;
  runtimeCachePolicyFingerprint: string | null;
};
⋮----
export interface PendingExplorerMetricSample {
  metricId: ExplorerPerformanceMetricId;
  durationMs: number;
  recordedAt: number;
  metadata?: ExplorerPerformanceMetadata;
}
⋮----
export function buildRuntimeCachePolicyFingerprint(policy: FsRuntimeCachePolicy): string
⋮----
export function getRuntimeCachePolicyTelemetryMetadata(
  policy: FsRuntimeCachePolicy | null,
  status: RuntimeCachePolicyTelemetryStatus,
): RuntimeCachePolicyTelemetryMetadata
⋮----
export function finalizePendingExplorerMetricSamples(
  samples: readonly PendingExplorerMetricSample[],
  runtimePolicyMetadata: RuntimeCachePolicyTelemetryMetadata,
): PendingExplorerMetricSample[]
````

## File: config/screenshots.ts
````typescript
import { getManagedContentDirectory } from './appContentDirectories';
⋮----
get defaultSaveDirectory(): string
⋮----
export type SupportedScreenshotExtension =
  typeof screenshotFeatureConfig.supportedExtensions[number];
export type ScreenshotCaptureModeId =
  typeof screenshotCaptureModes[number]['id'];
export type ScreenshotOutputActionId =
  typeof screenshotOutputActions[number]['id'];
⋮----
export function isScreenshotCaptureModeId(value: unknown): value is ScreenshotCaptureModeId
⋮----
export function isScreenshotOutputActionId(value: unknown): value is ScreenshotOutputActionId
````

## File: config/searchTelemetry.ts
````typescript
import type { ExplorerPerformanceMetadata } from './performanceTelemetry';
⋮----
export type FileSearchExecutionStrategy =
  | 'name_index_cache_hit'
  | 'content_index_cache_hit'
  | 'live_scan';
⋮----
export type FileSearchContentCacheStatus =
  | 'not_requested'
  | 'cache_hit'
  | 'warmed'
  | 'disabled'
  | 'over_budget_fallback'
  | 'read_failure_fallback';
⋮----
export interface FileSearchDiagnostics {
  executionStrategy: FileSearchExecutionStrategy;
  contentCacheStatus: FileSearchContentCacheStatus;
  scannedEntryCount: number;
  indexedEntryCount: number;
  contentCacheStoredFileCount: number;
  contentCacheStoredByteCount: number;
  truncatedByScanBudget: boolean;
}
⋮----
export interface FileSearchResponse<Result> {
  results: Result[];
  diagnostics: FileSearchDiagnostics;
}
⋮----
export function getExplorerSearchTelemetryMetadata(
  diagnostics: FileSearchDiagnostics,
): ExplorerPerformanceMetadata
````

## File: config/shaders.ts
````typescript
import { getManagedContentDirectory } from './appContentDirectories';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
⋮----
export type OverlayShaderSurfaceId = typeof overlayShaderSurfaces[number]['id'];
⋮----
export function resolveShadersDirectory(): string
⋮----
get shadersDirectory(): string
⋮----
export type FrontendShaderExtension =
  typeof shaderSystemConfig.frontendExtensions[number];
⋮----
export function getOverlayShaderSurfaceLabel(surface: OverlayShaderSurfaceId): string
⋮----
export function getShaderEnabledSurfaceIds(shader: {
  background?: unknown;
  topBar?: unknown;
  border?: unknown;
} | null | undefined): OverlayShaderSurfaceId[]
⋮----
export function resolvePreferredShaderId(args: {
  availableShaderIds: Iterable<string>;
  userOverrideId?: string | null;
  themeDefaultShaderId?: string | null;
  fallbackShaderId?: string;
}): string
````

## File: config/shellBlueprints.ts
````typescript
import type {
  ShellBlueprint as GeneratedShellBlueprint,
  ShellBlueprintId as GeneratedShellBlueprintId,
  ShellNavigationModel as GeneratedShellNavigationModel,
  ShellSurfaceStyle as GeneratedShellSurfaceStyle,
} from '../generated/tauri';
⋮----
export type OverlayShellBlueprintId = GeneratedShellBlueprintId;
export type OverlayShellNavigationModel = GeneratedShellNavigationModel;
export type OverlayShellSurfaceStyle = GeneratedShellSurfaceStyle;
export type OverlayShellBlueprint = GeneratedShellBlueprint;
⋮----
export function getShellBlueprint(
  blueprintId: string | null | undefined,
): OverlayShellBlueprint
⋮----
export function normalizeShellBlueprintId(
  value: unknown,
  fallback: OverlayShellBlueprintId = 'classic-dock',
): OverlayShellBlueprintId
````

## File: config/themeCatalogCuration.ts
````typescript
export type ThemeCatalogTierId = 'official-pilot' | 'legacy-lab' | 'archive';
⋮----
export interface ThemeCatalogTierDefinition {
  id: ThemeCatalogTierId;
  label: string;
  description: string;
  badgeLabel: string;
  order: number;
}
⋮----
export interface ThemeCatalogPackageMetadata {
  tierId: ThemeCatalogTierId;
  tierLabel: string;
  tierDescription: string;
  tierOrder: number;
  badgeLabel: string;
  sortRank: number;
  suiteId: string | null;
  suiteLabel: string | null;
  suiteDescription: string | null;
  isOfficialPilot: boolean;
}
⋮----
interface ThemeCatalogPackageOverride {
  tierId: ThemeCatalogTierId;
  sortRank?: number;
  badgeLabel?: string;
  suiteLabel?: string;
  suiteDescription?: string;
}
⋮----
function normalizeThemeCatalogId(themeId: string): string
⋮----
export function resolveThemeCatalogPackageMetadata(themeId: string): ThemeCatalogPackageMetadata
⋮----
export interface ThemeCatalogComparablePackage {
  id: string;
  name: string;
  catalog: ThemeCatalogPackageMetadata;
}
⋮----
export function compareThemeCatalogPackages(left: ThemeCatalogComparablePackage, right: ThemeCatalogComparablePackage): number
````

## File: config/themeEngineBindings.ts
````typescript
import type { ThemePresentation, ThemeValue } from '../generated/tauri';
import type {
  CompiledThemeEngineManifest,
  ExplorerThemeLayoutPrimitive,
  ExplorerThemeNavigationPattern,
  ExplorerThemeRenderStyleManifest,
} from '../runtime/themeEngineBackend';
⋮----
export interface ThemeEngineRecipeBindingIds {
  layoutPrimitiveId?: string;
  navigationPatternId?: string;
  renderStyleId?: string;
}
⋮----
export interface ResolvedThemeEngineBindings {
  presentation: ThemePresentation | null;
  layoutPrimitive: ExplorerThemeLayoutPrimitive | null;
  navigationPattern: ExplorerThemeNavigationPattern | null;
  renderStyle: ExplorerThemeRenderStyleManifest | null;
}
⋮----
function asTrimmedString(value: unknown): string | undefined
⋮----
function pickThemeEngineEntry<T extends { id: string }>(
  lookup: Record<string, T>,
  fallback: T | null,
  preferredId?: string,
): T | null
⋮----
export function resolveThemeEngineBindings(
  compiledEngineManifest?: CompiledThemeEngineManifest,
  preferredIds?: ThemeEngineRecipeBindingIds,
): ResolvedThemeEngineBindings
⋮----
export function readThemeNumberProp(
  props: Partial<Record<string, ThemeValue>> | undefined,
  key: string,
): number | undefined
⋮----
export function readThemeBooleanProp(
  props: Partial<Record<string, ThemeValue>> | undefined,
  key: string,
): boolean | undefined
⋮----
export function readThemeStringProp(
  props: Partial<Record<string, ThemeValue>> | undefined,
  key: string,
): string | undefined
````

## File: config/themePackages.ts
````typescript
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';
⋮----
import {
  normalizeThemeDefinition,
  overlayThemePresets,
  type OverlayThemeAssets,
  type OverlayThemeCompatibility,
  type OverlayThemeDefinition,
  type OverlayThemePresentation,
  type OverlayThemeVisualLayer,
} from './appearance';
import {
  compileThemeEngineManifest,
  normalizeThemeManifestDraft,
  type CompiledThemeEngineManifest,
  type ExplorerThemeManifest,
} from '../runtime/themeEngineBackend';
import { type LoadedOverlayAnimation, loadAnimationFromSource, deriveAnimationId, deriveAnimationName } from '../components/animationRuntime';
import {
  loadThemeRendererFromSource,
  type LoadedOverlayThemeRenderer,
} from '../components/themeRendererRuntime';
import {
  createResolvedIconThemeFromEntries,
  getBuiltInIconTheme,
  mergeResolvedIconThemes,
  parseIconThemeManifest,
  resolveIconThemeManifest,
  type OverlayResolvedIconTheme,
} from './iconTheme';
import { type LoadedOverlayShader, loadShaderFromSource, deriveShaderId, deriveShaderName, isFrontendShaderFile } from '../components/shaderRuntime';
import { isFrontendAnimationFile } from '../components/animationRuntime';
import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
import { OVERLAY_SHELL_BLUEPRINTS } from './shellBlueprints';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import type { WorkbenchRenderRuntimeKind } from './workbenchRenderRuntime';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import type { RuntimeRelativeModuleSourceResolver } from '../runtime/moduleRuntime';
import {
  compareThemeCatalogPackages,
  resolveThemeCatalogPackageMetadata,
  type ThemeCatalogPackageMetadata,
} from './themeCatalogCuration';
⋮----
interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}
⋮----
type LooseRecord = Record<string, unknown>;
⋮----
type ShellBlueprintId = NonNullable<OverlayThemeCompatibility['shellBlueprints']>[number];
⋮----
export interface OverlayThemePackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  extends?: string;
  theme?: Partial<OverlayThemeDefinition>;
  assets?: {
    background?: string;
    preview?: string;
    iconsDirectory?: string;
    iconTheme?: string;
    iconAliases?: Record<string, string>;
  };
  contributions?: {
    shaders?: string[];
    animations?: string[];
  };
  visuals?: OverlayThemeVisualLayer[];
  cssVars?: Record<string, string>;
  fonts?: {
    ui?: string;
    mono?: string;
  };
  presentation?: OverlayThemePresentation;
  compatibility?: OverlayThemeCompatibility;
  designTokens?: ExplorerThemeManifest['designTokens'];
  layoutPrimitives?: ExplorerThemeManifest['layoutPrimitives'];
  navigationPatterns?: ExplorerThemeManifest['navigationPatterns'];
  animationProfiles?: ExplorerThemeManifest['animationProfiles'];
  iconPacks?: ExplorerThemeManifest['iconPacks'];
  renderStyles?: ExplorerThemeManifest['renderStyles'];
  defaultLayoutPrimitiveId?: ExplorerThemeManifest['defaultLayoutPrimitiveId'];
  defaultNavigationPatternId?: ExplorerThemeManifest['defaultNavigationPatternId'];
  defaultAnimationProfileId?: ExplorerThemeManifest['defaultAnimationProfileId'];
  defaultIconPackId?: ExplorerThemeManifest['defaultIconPackId'];
  defaultRenderStyleId?: ExplorerThemeManifest['defaultRenderStyleId'];
  themeRenderer?: {
    entryModule?: string;
    apiVersion?: number;
    supportsLiveSwap?: boolean;
    fallbackRuntime?: WorkbenchRenderRuntimeKind;
    capabilities?: {
      customScreens?: boolean;
      wallpaperScene?: boolean;
      surfaceAdapters?: boolean;
    };
  };
}
⋮----
interface OverlayThemePackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: OverlayThemePackageManifest;
}
⋮----
export interface ThemePackageDirectoryEntry {
  name: string;
  path: string;
}
⋮----
export interface LoadedOverlayThemePackage {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'theme-directory' | 'plugin-package';
  sourceLabel: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  previewUrl?: string;
  warnings: string[];
  catalog: ThemeCatalogPackageMetadata;
  capabilitySummary: {
    icons: boolean;
    wallpaper: boolean;
    dock: boolean;
    visuals: number;
    shaders: number;
    animations: number;
    fonts: number;
    themeRenderer: boolean;
  };
  theme: OverlayThemeDefinition;
  engineManifest?: ExplorerThemeManifest;
  compiledEngineManifest?: CompiledThemeEngineManifest;
  themeRenderer?: LoadedOverlayThemeRenderer;
}
⋮----
export interface ThemePackageLoadResult {
  packages: LoadedOverlayThemePackage[];
  shaders: LoadedOverlayShader[];
  animations: LoadedOverlayAnimation[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}
⋮----
export interface ThemePackageLoadOptions {
  sourceKind?: LoadedOverlayThemePackage['sourceKind'];
  sourceLabel?: string;
}
⋮----
get themesDirectory(): string
⋮----
function resolveThemesDirectory(): string
⋮----
function asRecord(value: unknown): LooseRecord | null
⋮----
function asString(value: unknown, fallback = ''): string
⋮----
function asStringRecord(value: unknown): Record<string, string>
⋮----
function isWorkbenchRenderRuntimeKind(value: unknown): value is WorkbenchRenderRuntimeKind
⋮----
function parseThemeCompatibility(value: unknown): OverlayThemeCompatibility | undefined
⋮----
function derivePackageId(record: OverlayThemePackageRecord): string
⋮----
function derivePackageName(record: OverlayThemePackageRecord): string
⋮----
function toAssetUrl(filePath: string): string
⋮----
function shouldInlineThemeAsset(filePath: string): boolean
⋮----
async function toInlineAssetUrl(filePath: string): Promise<string>
⋮----
async function resolveThemePackageAssetUrl(filePath: string): Promise<string>
⋮----
function normalizePackageAssetPath(assetPath: string): string
⋮----
function normalizePackageComparisonPath(path: string): string
⋮----
function normalizePackageRuntimeModulePath(path: string): string | null
⋮----
function getPackageRelativePath(directoryPath: string, filePath: string): string | null
⋮----
function resolvePackageRuntimeModuleImportPath(
  fromModuleRelativePath: string,
  specifier: string,
): string | null
⋮----
function buildPackageRuntimeModuleCandidates(relativePath: string): string[]
⋮----
function parseThemeManifestText(text: string, filePath: string): OverlayThemePackageManifest
⋮----
async function readPackageManifest(directoryPath: string): Promise<
⋮----
async function resolveIconEntries(directoryPath: string, iconsDirectory: string, aliases: Record<string, string>): Promise<Record<string, string>>
⋮----
async function resolvePackageIconTheme(
  directoryPath: string,
  iconThemePath: string,
): Promise<OverlayResolvedIconTheme>
⋮----
function createRelativeFileEntry(directoryPath: string, relativePath: string): FileEntry
⋮----
function createThemeRendererRelativeModuleSourceResolver(
  directoryPath: string,
): RuntimeRelativeModuleSourceResolver
⋮----
async function resolvePackageRuntimeEntries(
  directoryPath: string,
  explicitPaths: string[] | undefined,
  defaultDirectoryName: string,
  filterEntry: (entry: FileEntry) => boolean,
): Promise<FileEntry[]>
⋮----
function mergeVisualLayers(
  baseVisuals: OverlayThemeVisualLayer[] | undefined,
  packageVisuals: OverlayThemeVisualLayer[] | undefined,
): OverlayThemeVisualLayer[] | undefined
⋮----
function mergeThemeAssets(
  baseAssets: OverlayThemeAssets | undefined,
  packageAssets: OverlayThemeAssets | undefined,
): OverlayThemeAssets | undefined
⋮----
function buildThemeEngineManifest(
  packageId: string,
  packageName: string,
  manifest: OverlayThemePackageManifest,
  resolvedTheme?: OverlayThemeDefinition,
): ExplorerThemeManifest | undefined
⋮----
async function buildPackageTheme(
  record: OverlayThemePackageRecord,
  packageMap: Map<string, OverlayThemePackageRecord>,
  cache: Map<string, OverlayThemeDefinition>,
  stack: string[] = [],
): Promise<OverlayThemeDefinition>
⋮----
export async function loadThemePackagesFromDirectoryEntries(
  directoryEntries: ThemePackageDirectoryEntry[],
  directoryLabel = themeSystemConfig.themesDirectory,
  options?: ThemePackageLoadOptions,
): Promise<ThemePackageLoadResult>
⋮----
export async function loadThemePackages(): Promise<ThemePackageLoadResult>
````

## File: config/wallpapers.ts
````typescript
import { getManagedContentDirectory } from './appContentDirectories';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
⋮----
export type OverlayWallpaperFitMode = 'cover' | 'contain' | 'fill';
⋮----
export function resolveWallpapersDirectory(): string
⋮----
get wallpapersDirectory(): string
⋮----
export function normalizeOverlayWallpaperFitMode(value: unknown): OverlayWallpaperFitMode
⋮----
export function getOverlayWallpaperFitModeLabel(mode: OverlayWallpaperFitMode): string
````

## File: config/workbenchPresets.ts
````typescript
import {
  OVERLAY_WORKBENCH_PRESETS as GENERATED_OVERLAY_WORKBENCH_PRESETS,
  type ThemeDensity as GeneratedThemeDensity,
  type WorkbenchInputMode as GeneratedWorkbenchInputMode,
  type WorkbenchInputProfile as GeneratedWorkbenchInputProfile,
  type WorkbenchPanelBinding as GeneratedWorkbenchPanelBinding,
  type WorkbenchPreset as GeneratedWorkbenchPreset,
  type WorkbenchRegionId as GeneratedWorkbenchRegionId,
  type WorkbenchWindowMode as GeneratedWorkbenchWindowMode,
  type WorkbenchWindowProfile as GeneratedWorkbenchWindowProfile,
} from '../generated/tauri';
import {
  getShellBlueprint,
  normalizeShellBlueprintId,
  type OverlayShellBlueprintId,
  type OverlayShellNavigationModel,
} from './shellBlueprints';
⋮----
export type WorkbenchRegionId = GeneratedWorkbenchRegionId;
export type WorkbenchWindowMode = GeneratedWorkbenchWindowMode;
export type WorkbenchInputMode = GeneratedWorkbenchInputMode;
export type WorkbenchDensityMode = GeneratedThemeDensity;
export type WorkbenchWindowAnchor = 'top' | 'bottom' | 'left' | 'right' | 'center';
⋮----
export type WorkbenchPanelBinding = GeneratedWorkbenchPanelBinding;
export type WorkbenchWindowProfile = GeneratedWorkbenchWindowProfile;
export type WorkbenchInputProfile = GeneratedWorkbenchInputProfile;
export type WorkbenchPreset = GeneratedWorkbenchPreset;
⋮----
type LooseRecord = Record<string, unknown>;
type GeneratedWorkbenchPresetConstant = (typeof GENERATED_OVERLAY_WORKBENCH_PRESETS)[number];
⋮----
function asRecord(value: unknown): LooseRecord | null
⋮----
function asString(value: unknown, fallback: string): string
⋮----
function asBoolean(value: unknown, fallback: boolean): boolean
⋮----
function asNumber(value: unknown, fallback: number): number
⋮----
function normalizeWindowMode(value: unknown, fallback: WorkbenchWindowMode): WorkbenchWindowMode
⋮----
function normalizeInputMode(value: unknown, fallback: WorkbenchInputMode): WorkbenchInputMode
⋮----
function normalizeWindowAnchor(value: unknown, fallback?: WorkbenchWindowAnchor): WorkbenchWindowAnchor | undefined
⋮----
function normalizeDensityMode(value: unknown, fallback: WorkbenchDensityMode): WorkbenchDensityMode
⋮----
function normalizeRegionId(value: unknown, fallback: WorkbenchRegionId): WorkbenchRegionId
⋮----
function normalizeNavigationModel(
  value: unknown,
  shellBlueprint: OverlayShellBlueprintId,
): OverlayShellNavigationModel
⋮----
function normalizePanelBinding(
  input: unknown,
  fallback: WorkbenchPanelBinding,
): WorkbenchPanelBinding
⋮----
function cloneWorkbenchPreset(preset: GeneratedWorkbenchPresetConstant): WorkbenchPreset
⋮----
export function normalizeWorkbenchPreset(
  input: unknown,
  fallback: WorkbenchPreset = BUILT_IN_WORKBENCH_PRESETS[0],
): WorkbenchPreset
⋮----
export function resolveWorkbenchPreset(
  presetId: string | null | undefined,
): WorkbenchPreset
⋮----
export function getWorkbenchPresetsForShellBlueprint(
  shellBlueprint: OverlayShellBlueprintId,
): WorkbenchPreset[]
````

## File: config/workbenchRenderRuntime.ts
````typescript
import type { ThemeRenderStyleKind } from '../generated/tauri';
import type { ResolvedOverlayAppearance } from './appearance';
import type { LayoutProfile } from './layoutProfiles';
import { resolveThemeEngineBindings } from './themeEngineBindings';
import type { OverlayShellBlueprintId } from './shellBlueprints';
⋮----
export type WorkbenchRenderRuntimeKind =
  | 'workbench-tabs'
  | 'cross-axis-media'
  | 'channel-launcher'
  | 'desktop-stack';
⋮----
export type WorkbenchNavigationSurfaceKind =
  | 'tabs'
  | 'cross-axis'
  | 'launcher-grid'
  | 'launcher-list';
⋮----
export type WorkbenchContentLayoutKind =
  | 'tabbed'
  | 'spotlight'
  | 'desktop-card';
⋮----
export interface ResolvedWorkbenchRenderRuntime {
  kind: WorkbenchRenderRuntimeKind;
  label: string;
  description: string;
  renderStyleId: string | null;
  renderStyleKind: ThemeRenderStyleKind | null;
  layoutPrimitiveId: string | null;
  navigationPatternId: string | null;
  shellBlueprint: OverlayShellBlueprintId;
  navigationSurface: WorkbenchNavigationSurfaceKind;
  contentLayout: WorkbenchContentLayoutKind;
  launcherPlacement: 'hidden' | 'sidebar';
  navigationRailWidth: number;
  showTabStrip: boolean;
  showExplorerShortcut: boolean;
  showSettingsShortcut: boolean;
  preferLargeLauncherTargets: boolean;
  useGroupedNavigation: boolean;
}
⋮----
export interface WorkbenchNavigationMetadata {
  groupId: string;
  groupLabel: string;
  groupOrder?: number;
  itemOrder?: number;
}
⋮----
export interface WorkbenchNavigationPanelDescriptor {
  id: string;
  label: string;
  description: string;
  navigation?: WorkbenchNavigationMetadata;
}
⋮----
export interface WorkbenchNavigationGroup<TPanel extends WorkbenchNavigationPanelDescriptor = WorkbenchNavigationPanelDescriptor> {
  id: string;
  label: string;
  order: number;
  panels: TPanel[];
}
⋮----
export function getWorkbenchNavigationRailWidth(runtime: Pick<ResolvedWorkbenchRenderRuntime, 'kind'>): number
⋮----
function compareGroupOrder(
  left: WorkbenchNavigationGroup,
  right: WorkbenchNavigationGroup,
): number
⋮----
function comparePanelOrder(
  left: WorkbenchNavigationPanelDescriptor,
  right: WorkbenchNavigationPanelDescriptor,
): number
⋮----
export function groupPanelsForWorkbenchNavigation<TPanel extends WorkbenchNavigationPanelDescriptor>(
  panels: readonly TPanel[],
): WorkbenchNavigationGroup<TPanel>[]
⋮----
function resolveRuntimeKind(
  renderStyleKind: ThemeRenderStyleKind | null,
  shellBlueprint: OverlayShellBlueprintId,
  navigationPatternKind: string | null,
  layoutPrimitiveKind: string | null,
): WorkbenchRenderRuntimeKind
⋮----
function buildResolvedWorkbenchRuntime(
  runtimeKind: WorkbenchRenderRuntimeKind,
  appearance: ResolvedOverlayAppearance,
  layoutProfile: LayoutProfile,
  renderStyleKind: ThemeRenderStyleKind | null,
  engineBindings: ReturnType<typeof resolveThemeEngineBindings>,
): ResolvedWorkbenchRenderRuntime
⋮----
export function resolveWorkbenchRenderRuntime(
  appearance: ResolvedOverlayAppearance,
  layoutProfile: LayoutProfile,
  forcedRuntimeKind?: WorkbenchRenderRuntimeKind | null,
): ResolvedWorkbenchRenderRuntime
````

## File: config/workbenchTheme.ts
````typescript
import type {
  ThemeChromeStyle,
  ThemeDensity,
} from '../generated/tauri';
import type { OverlayThemeDefinition } from './appearance';
import {
  readThemeNumberProp,
  resolveThemeEngineBindings,
} from './themeEngineBindings';
⋮----
export type OverlayWorkbenchThemePreset = 'workbench' | 'xmb' | 'channel-grid' | 'custom';
export type OverlayWorkbenchChromeStyle = 'solid' | 'glass' | 'floating' | 'minimal';
export type OverlayWorkbenchPanelStyle = 'solid' | 'glass' | 'floating';
export type OverlayWorkbenchTabStyle = 'underline' | 'capsule' | 'segment';
⋮----
export interface OverlayWorkbenchThemeMetrics {
  chromeHeight?: number;
  controlRadius?: number;
  panelRadius?: number;
  shellInset?: number;
  commandPaletteWidth?: number;
  commandPaletteTopInset?: number;
  pagePadding?: number;
  panelGap?: number;
}
⋮----
export interface OverlayWorkbenchThemeSurfaces {
  shellBackground?: string;
  chromeBackground?: string;
  chromeMenuBackground?: string;
  chromeBorder?: string;
  chromeButtonBackground?: string;
  chromeButtonHoverBackground?: string;
  chromeButtonActiveBackground?: string;
  chromeButtonActiveBorder?: string;
  chromeTabBackground?: string;
  chromeTabActiveBackground?: string;
  chromeTabBorder?: string;
  shellShadow?: string;
  commandPaletteScrimBackground?: string;
  commandPaletteBackground?: string;
  commandPaletteBorder?: string;
  commandPaletteInputBackground?: string;
  commandPaletteItemBackground?: string;
  commandPaletteItemActiveBackground?: string;
  settingsBackground?: string;
  settingsRailBackground?: string;
  settingsCardBackground?: string;
  settingsCardBorder?: string;
  settingsBadgeBackground?: string;
  settingsBadgeBorder?: string;
  terminalBackground?: string;
  terminalPanelBackground?: string;
  terminalPaneBackground?: string;
  terminalBorder?: string;
  terminalStatusBackground?: string;
}
⋮----
export interface OverlayWorkbenchThemeTypography {
  chromeLabelSize?: number;
  chromeMetaSize?: number;
  tabLabelSize?: number;
  pageTitleSize?: number;
  pageBodySize?: number;
  badgeSize?: number;
  labelLetterSpacing?: string;
}
⋮----
export interface OverlayWorkbenchThemeRecipe {
  preset?: OverlayWorkbenchThemePreset;
  brandLabel?: string;
  layoutPrimitiveId?: string;
  navigationPatternId?: string;
  renderStyleId?: string;
  topBarStyle?: OverlayWorkbenchChromeStyle;
  panelStyle?: OverlayWorkbenchPanelStyle;
  commandPaletteStyle?: OverlayWorkbenchPanelStyle;
  terminalStyle?: OverlayWorkbenchPanelStyle;
  settingsStyle?: OverlayWorkbenchPanelStyle;
  tabStyle?: OverlayWorkbenchTabStyle;
  metrics?: OverlayWorkbenchThemeMetrics;
  surfaces?: OverlayWorkbenchThemeSurfaces;
  typography?: OverlayWorkbenchThemeTypography;
  cssVars?: Record<string, string>;
}
⋮----
export interface ResolvedWorkbenchThemeRecipe {
  preset: OverlayWorkbenchThemePreset;
  brandLabel: string;
  layoutPrimitiveId: string | null;
  navigationPatternId: string | null;
  renderStyleId: string | null;
  topBarStyle: OverlayWorkbenchChromeStyle;
  panelStyle: OverlayWorkbenchPanelStyle;
  commandPaletteStyle: OverlayWorkbenchPanelStyle;
  terminalStyle: OverlayWorkbenchPanelStyle;
  settingsStyle: OverlayWorkbenchPanelStyle;
  tabStyle: OverlayWorkbenchTabStyle;
  metrics: Required<OverlayWorkbenchThemeMetrics>;
  surfaces: Required<OverlayWorkbenchThemeSurfaces>;
  typography: Required<OverlayWorkbenchThemeTypography>;
  cssVars: Record<string, string>;
}
⋮----
function clampNumber(value: number, min: number, max: number): number
⋮----
function asFiniteNumber(value: unknown): number | undefined
⋮----
function asTrimmedString(value: unknown): string | undefined
⋮----
function normalizeCssVarRecord(value: Record<string, unknown> | undefined): Record<string, string>
⋮----
function compactObject<T extends object>(input: T | undefined): Partial<T>
⋮----
export function normalizeWorkbenchThemeRecipe(
  recipe?: OverlayWorkbenchThemeRecipe,
  fallback?: OverlayWorkbenchThemeRecipe,
): OverlayWorkbenchThemeRecipe | undefined
⋮----
function inferWorkbenchPreset(theme: OverlayThemeDefinition): OverlayWorkbenchThemePreset
⋮----
function getPresetRecipe(preset: OverlayWorkbenchThemePreset): OverlayWorkbenchThemeRecipe
⋮----
function inferWorkbenchPresetFromEngine(theme: OverlayThemeDefinition): OverlayWorkbenchThemePreset | undefined
⋮----
function createWorkbenchStyleSeed(
  chromeStyle: ThemeChromeStyle | null | undefined,
): Pick<
  OverlayWorkbenchThemeRecipe,
  'topBarStyle' | 'panelStyle' | 'commandPaletteStyle' | 'terminalStyle' | 'settingsStyle'
> {
switch (chromeStyle)
⋮----
function getDensityMetricDelta(density: ThemeDensity | null | undefined): number
⋮----
function createWorkbenchEngineRecipe(theme: OverlayThemeDefinition): OverlayWorkbenchThemeRecipe
⋮----
function formatLength(value: number): string
⋮----
export function resolveWorkbenchThemeRecipe(
  theme: OverlayThemeDefinition,
): ResolvedWorkbenchThemeRecipe
````

## File: contracts/themeEngine.ts
````typescript
type LooseRecord = Record<string, unknown>;
⋮----
export type ThemeTokenScale = Record<string, string | number>;
⋮----
export interface ThemeDesignTokens {
  color: ThemeTokenScale;
  typography: ThemeTokenScale;
  spacing: ThemeTokenScale;
  radius: ThemeTokenScale;
  shadow: ThemeTokenScale;
  motion: ThemeTokenScale;
}
⋮----
export type ThemeLayoutPrimitiveKind = 'stack' | 'grid' | 'split' | 'dock' | 'freeform';
⋮----
export interface ThemeLayoutPrimitive {
  id: string;
  name: string;
  kind: ThemeLayoutPrimitiveKind;
  props: Record<string, string | number | boolean>;
}
⋮----
export type ThemeNavigationPatternKind = 'xmb' | 'tabbed' | 'hierarchy' | 'palette' | 'spatial' | 'custom';
⋮----
export interface ThemeNavigationPattern {
  id: string;
  name: string;
  kind: ThemeNavigationPatternKind;
  axis: 'horizontal' | 'vertical' | 'both';
  props: Record<string, string | number | boolean>;
}
⋮----
export interface ThemeAnimationProfile {
  id: string;
  name: string;
  durationMs: number;
  easing: string;
  intensity: number;
}
⋮----
export interface ThemeIconPack {
  id: string;
  name: string;
  style: 'system' | 'vector' | 'pixel' | 'skeuomorphic' | 'custom';
}
⋮----
export interface ThemeRenderStyle {
  id: string;
  name: string;
  entryClassName?: string;
  description?: string;
}
⋮----
export interface ThemeEngineManifest {
  schemaVersion: number;
  designTokens: ThemeDesignTokens;
  layoutPrimitives: ThemeLayoutPrimitive[];
  navigationPatterns: ThemeNavigationPattern[];
  animationProfiles: ThemeAnimationProfile[];
  iconPacks: ThemeIconPack[];
  renderStyles: ThemeRenderStyle[];
  defaults: {
    layoutPrimitiveId?: string;
    navigationPatternId?: string;
    animationProfileId?: string;
    iconPackId?: string;
    renderStyleId?: string;
  };
}
⋮----
export interface ThemeEngineManifestInput {
  schemaVersion?: unknown;
  designTokens?: unknown;
  layoutPrimitives?: unknown;
  navigationPatterns?: unknown;
  animationProfiles?: unknown;
  iconPacks?: unknown;
  renderStyles?: unknown;
  defaults?: unknown;
  defaultLayoutPrimitiveId?: unknown;
  defaultNavigationPatternId?: unknown;
  defaultAnimationProfileId?: unknown;
  defaultIconPackId?: unknown;
  defaultRenderStyleId?: unknown;
}
⋮----
export interface CompiledThemeEngineContract {
  themeId: string;
  schemaVersion: number;
  manifest: ThemeEngineManifest;
  maps: {
    layoutPrimitives: Map<string, ThemeLayoutPrimitive>;
    navigationPatterns: Map<string, ThemeNavigationPattern>;
    animationProfiles: Map<string, ThemeAnimationProfile>;
    iconPacks: Map<string, ThemeIconPack>;
    renderStyles: Map<string, ThemeRenderStyle>;
  };
  defaults: {
    layoutPrimitive?: ThemeLayoutPrimitive;
    navigationPattern?: ThemeNavigationPattern;
    animationProfile?: ThemeAnimationProfile;
    iconPack?: ThemeIconPack;
    renderStyle?: ThemeRenderStyle;
  };
}
⋮----
export interface ThemeEngineCapabilitySummary {
  designTokens: number;
  layoutPrimitives: number;
  navigationPatterns: number;
  animationProfiles: number;
  iconPacks: number;
  renderStyles: number;
}
⋮----
function asRecord(value: unknown): LooseRecord | null
⋮----
function asString(value: unknown): string
⋮----
function asNumber(value: unknown, fallback: number): number
⋮----
function asTokenScale(value: unknown): ThemeTokenScale
⋮----
function normalizeDesignTokens(value: unknown): ThemeDesignTokens
⋮----
function createId(value: unknown, fallbackPrefix: string, index: number): string
⋮----
function asPrimitiveProps(value: unknown): Record<string, string | number | boolean>
⋮----
function normalizeLayoutPrimitives(value: unknown): ThemeLayoutPrimitive[]
⋮----
function normalizeNavigationPatterns(value: unknown): ThemeNavigationPattern[]
⋮----
function normalizeAnimationProfiles(value: unknown): ThemeAnimationProfile[]
⋮----
function normalizeIconPacks(value: unknown): ThemeIconPack[]
⋮----
function normalizeRenderStyles(value: unknown): ThemeRenderStyle[]
⋮----
export function normalizeThemeEngineManifest(input?: ThemeEngineManifestInput): ThemeEngineManifest
⋮----
export function compileThemeEngineContract(
  input: ThemeEngineManifestInput | undefined,
  themeId: string,
): CompiledThemeEngineContract
⋮----
export function summarizeThemeEngineCapabilities(
  contract: CompiledThemeEngineContract,
): ThemeEngineCapabilitySummary
````

## File: generated/tauri.ts
````typescript
// This file was generated by [tauri-specta](https://github.com/oscartbeaumont/tauri-specta). Do not edit this file manually.
⋮----
/** user-defined commands **/
⋮----
async terminalSpawn(id: string, workingDir: string | null, shell: string | null, rows: number | null, cols: number | null) : Promise<Result<null, string>>
async terminalWrite(id: string, data: string) : Promise<Result<null, string>>
async terminalWriteMany(writes: TerminalWriteRequest[]) : Promise<Result<null, string>>
async terminalResize(id: string, rows: number, cols: number) : Promise<Result<null, string>>
async terminalKill(id: string) : Promise<Result<null, string>>
async terminalRegisterShellIntegration(request: TerminalShellIntegrationRequest) : Promise<Result<TerminalShellIntegrationState, string>>
async terminalSyncCwd(id: string, cwd: string) : Promise<Result<TerminalShellIntegrationState, string>>
async terminalSetPromptState(id: string, atPrompt: boolean, reportedCwd: string | null) : Promise<Result<TerminalShellIntegrationState, string>>
async terminalOpenExternal(request: ExternalTerminalRequest) : Promise<Result<null, string>>
async cloudListAccounts() : Promise<Result<CloudAccountsSnapshot, string>>
async cloudSetProviderConfiguration(provider: CloudProviderId, clientId: string, clientSecret: string | null) : Promise<Result<CloudProviderConfigurationStatus, string>>
async cloudClearProviderConfiguration(provider: CloudProviderId) : Promise<Result<CloudProviderConfigurationStatus, string>>
async cloudBeginAuth(provider: CloudProviderId) : Promise<Result<CloudAuthSession, string>>
async cloudPollAuth(requestId: string) : Promise<Result<CloudAuthStatus, string>>
async cloudDisconnectAccount(accountId: string) : Promise<Result<null, string>>
async cloudListDir(path: string) : Promise<Result<CloudDirectoryListing, string>>
async cloudOpenFile(path: string) : Promise<Result<null, string>>
async cloudReadTextFile(path: string) : Promise<Result<string, string>>
async cloudReadFileBase64(path: string) : Promise<Result<string, string>>
async cloudWriteFile(path: string, content: FsWriteFileContent) : Promise<Result<null, string>>
async cloudCreateFile(parentPath: string, name: string, content: FsWriteFileContent) : Promise<Result<null, string>>
async cloudCreateDirectory(parentPath: string, name: string) : Promise<Result<null, string>>
async cloudRenamePath(path: string, newName: string) : Promise<Result<null, string>>
async cloudDeletePath(path: string) : Promise<Result<null, string>>
async cloudTransferItems(targetDir: string, sources: string[], operation: FileTransferOperation) : Promise<Result<FileTransferResult[], string>>
async fsListDir(path: string, showHidden: boolean) : Promise<Result<FileEntry[], string>>
async fsGetDrives() : Promise<Result<DriveInfo[], string>>
async fsMeasureEntrySizes(paths: string[], forceRefresh: boolean | null) : Promise<Result<EntryStorageInfo[], string>>
async fsCalculateRecursiveSizes(paths: string[], forceRefresh: boolean | null) : Promise<Result<EntryStorageInfo[], string>>
async fsCalculateChecksums(paths: string[]) : Promise<Result<FsChecksumEntryInfo[], string>>
async fsGetItemProperties(path: string) : Promise<Result<FsItemPropertiesInfo, string>>
async fsWatchEntrySizeRoot(path: string) : Promise<Result<null, string>>
async fsUnwatchEntrySizeRoot(path: string) : Promise<Result<null, string>>
async fsReadTextFile(path: string) : Promise<Result<string, string>>
async fsOpenFile(path: string) : Promise<Result<null, string>>
async fsOpenArchive(path: string) : Promise<Result<FsArchiveExtractionResult, string>>
async fsExtractArchive(request: FsArchiveExtractionRequest) : Promise<Result<FsArchiveExtractionResult, string>>
async audioAnalyzePreview(inputPath: string) : Promise<Result<AudioPreviewAnalysis, string>>
async audioExportTransform(request: AudioTransformRequest) : Promise<Result<AudioTransformResult, string>>
async audioBatchProcess(request: AudioBatchProcessRequest) : Promise<Result<AudioBatchProcessResult, string>>
async audioEnginePrepare() : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineGetState() : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineLoadDeck(request: AudioEngineLoadDeckRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineUnloadDeck(request: AudioEngineDeckRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineSetArmedDeck(request: AudioEngineSetArmedDeckRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEnginePlay(request: AudioEngineDeckRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEnginePause(request: AudioEngineDeckRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineStop(request: AudioEngineDeckRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineSeek(request: AudioEngineSeekRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineSetLoopRegion(request: AudioEngineLoopRegionRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineSetGain(request: AudioEngineGainRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineSetRate(request: AudioEngineRateRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async audioEngineSyncSelectionToArmedDeck(request: AudioEngineSyncSelectionRequest) : Promise<Result<AudioEngineStateSnapshot, string>>
async fsOpenWithDialog(path: string) : Promise<Result<null, string>>
async fsOpenAsAdmin(path: string) : Promise<Result<null, string>>
async fsRevealInExplorer(path: string) : Promise<Result<null, string>>
async fsShowItemProperties(path: string) : Promise<Result<null, string>>
async fsDelete(path: string, recursive: boolean) : Promise<Result<null, string>>
async fsRename(oldPath: string, newPath: string) : Promise<Result<null, string>>
async fsMove(src: string, dst: string) : Promise<Result<null, string>>
async fsCopy(src: string, dst: string) : Promise<Result<null, string>>
async fsTrash(paths: string[]) : Promise<Result<ExplorerTrashActionRecord, string>>
async fsRestoreRecentTrashAction() : Promise<Result<ExplorerTrashRestoreResult | null, string>>
async fsBatchRenamePreview(recipe: FsBatchRenameRecipe) : Promise<Result<FsBatchRenamePreviewRow[], string>>
async fsBatchRenameApply(recipe: FsBatchRenameRecipe) : Promise<Result<FsBatchRenameResult[], string>>
async fsBatchRename(items: FsBatchRenameItem[]) : Promise<Result<FsBatchRenameResult[], string>>
async fsFindDuplicatesStart(rootPath: string) : Promise<Result<ExplorerDuplicateScanStartResponse, string>>
async fsFindDuplicatesPoll(scanId: string) : Promise<Result<ExplorerDuplicateScanStatus, string>>
async fsFindDuplicatesCancel(scanId: string) : Promise<Result<null, string>>
async fsPlanTransferItems(targetDir: string, sources: string[], operation: FileTransferOperation) : Promise<Result<FileTransferCollision[], string>>
async fsTransferItems(targetDir: string, sources: string[], operation: FileTransferOperation, collisionPolicy: FileTransferCollisionPolicy | null) : Promise<Result<FileTransferResult[], string>>
async fsListExplorerTasks() : Promise<Result<ExplorerTaskRecord[], string>>
async fsClearExplorerTaskHistory(scope: ExplorerTaskHistoryClearScope) : Promise<Result<null, string>>
async fsRetryExplorerTask(taskId: string) : Promise<Result<ExplorerTaskRecord, string>>
async fsCancelExplorerTask(taskId: string) : Promise<Result<ExplorerTaskRecord, string>>
async fsCreateDir(path: string) : Promise<Result<null, string>>
async fsReadFileBase64(path: string) : Promise<Result<string, string>>
async fsReadImageThumbnail(path: string, maxWidth: number, maxHeight: number) : Promise<Result<string, string>>
async fsReadEntryThumbnail(request: ExplorerEntryThumbnailRequest) : Promise<Result<ExplorerEntryThumbnail, string>>
async fsWriteFile(path: string, content: FsWriteFileContent) : Promise<Result<null, string>>
async fsGetRuntimeCachePolicy() : Promise<FsRuntimeCachePolicy>
async fsListDirUncached(path: string, showHidden: boolean) : Promise<Result<FileEntry[], string>>
async fsCancelSearchEntries(path: string, requestId: number | null, requestScope: string | null) : Promise<Result<null, string>>
async fsSearchEntries(path: string, query: string, showHidden: boolean, includeContent: boolean, limit: number | null, requestId: number | null, requestScope: string | null) : Promise<Result<FileSearchResult[], string>>
async fsSearchEntriesWithDiagnostics(path: string, query: string, showHidden: boolean, includeContent: boolean, limit: number | null, requestId: number | null, requestScope: string | null) : Promise<Result<FileSearchResponse, string>>
async fsFuzzyFilterEntries(request: FsJumpFilterRequest) : Promise<Result<FsJumpFilterMatch[], string>>
async gitExec(repoPath: string, args: string[]) : Promise<Result<string, string>>
async fsGetHomeDir() : Promise<Result<string, string>>
async fsIsProcessElevated() : Promise<Result<boolean, string>>
async explorerTagsList(paths: string[] | null) : Promise<Result<ExplorerTagSnapshot, string>>
async explorerTagsSetForPaths(request: ExplorerTagMutationRequest) : Promise<Result<ExplorerTagSnapshot, string>>
async explorerSavedSearchesList() : Promise<Result<ExplorerSavedSearchRecord[], string>>
async explorerSavedSearchesSave(request: ExplorerSavedSearchSaveRequest) : Promise<Result<ExplorerSavedSearchRecord, string>>
async explorerSavedSearchesDelete(id: string) : Promise<Result<null, string>>
async fsResolveNativeIcons(requests: NativeIconRequest[]) : Promise<Result<NativeIconResponse[], string>>
async fsStartNativeFileDrag(paths: string[]) : Promise<Result<null, string>>
async screenshotCapturePreview(x: number, y: number, width: number, height: number) : Promise<Result<ScreenshotPreview, string>>
async screenshotSaveRegion(captureId: string, x: number, y: number, width: number, height: number, directory: string, filePrefix: string | null, copyToClipboard: boolean | null) : Promise<Result<SavedScreenshot, string>>
async screenshotExportAnnotated(captureId: string, selection: ScreenshotRegion | null, annotations: ScreenshotAnnotation[], directory: string | null, filePrefix: string | null, copyToClipboard: boolean | null) : Promise<Result<ScreenshotAnnotatedExportResult, string>>
async screenshotCopyRegionToClipboard(captureId: string, x: number, y: number, width: number, height: number) : Promise<Result<null, string>>
async screenshotCopyImageToClipboard(path: string) : Promise<Result<null, string>>
async screenshotReadGalleryThumbnail(path: string, maxWidth: number, maxHeight: number) : Promise<Result<string, string>>
async pythonGetRuntimeStatus(config: PythonRuntimeConfig | null) : Promise<Result<PythonRuntimeStatus, string>>
async pythonBootstrapRuntime(config: PythonRuntimeConfig | null) : Promise<Result<PythonActionResponse, string>>
async pythonInstallPackages(request: PythonPackageInstallRequest) : Promise<Result<PythonActionResponse, string>>
async pythonExecute(request: PythonExecutionRequest) : Promise<Result<PythonActionResponse, string>>
async pluginRunBackend(pluginsRoot: string, pluginId: string, entry: string, args: string[]) : Promise<Result<PluginBackendResult, string>>
async pluginWatchDirectory(path: string, ignoredDirectories: string[]) : Promise<Result<null, string>>
async pluginUnwatchDirectory() : Promise<Result<null, string>>
async videoCreatePreviewProxy(inputPath: string) : Promise<Result<ResolvedVideoPreviewSource, string>>
async videoExportTrim(request: VideoTrimExportRequest) : Promise<Result<VideoTrimExportResult, string>>
async videoResolvePreviewSource(inputPath: string) : Promise<Result<ResolvedVideoPreviewSource, string>>
async startupGetLaunchAtStartup() : Promise<Result<boolean, string>>
async startupGetLinuxDisplayBackendStatus() : Promise<Result<LinuxDisplayBackendStatus, string>>
async startupSetLaunchAtStartup(enabled: boolean) : Promise<Result<boolean, string>>
async startupSetLinuxDisplayBackendPreference(preferredBackend: LinuxDisplayBackendPreference) : Promise<Result<LinuxDisplayBackendStatus, string>>
async traySetVisible(visible: boolean) : Promise<Result<null, string>>
async windowGetLinuxDisplayServer() : Promise<string | null>
async windowGetWaylandDockHostStatus() : Promise<WaylandDockHostStatus>
async windowSetBlur(enabled: boolean, strength: number | null) : Promise<Result<null, string>>
async windowSetTaskbarVisibility(visible: boolean) : Promise<Result<null, string>>
/**
 * Atomically apply all window presentation properties in one IPC call.
 * This prevents the race condition where decorations/alwaysOnTop are set
 * separately from geometry, causing the WM to see intermediate invalid states.
 */
async windowApplyMode(decorations: boolean, alwaysOnTop: boolean, shadow: boolean, skipTaskbar: boolean, x: number, y: number, width: number, height: number) : Promise<Result<null, string>>
async windowApplyWaylandDockLayout(anchor: WaylandDockAnchor, monitorName: string | null, width: number, height: number) : Promise<Result<null, string>>
async domainListShellBlueprints() : Promise<ShellBlueprint[]>
async domainListThemeManifests() : Promise<ThemeManifest[]>
async domainListWorkbenchPresets() : Promise<WorkbenchPreset[]>
⋮----
/** user-defined events **/
⋮----
/** user-defined constants **/
⋮----
/** user-defined types **/
⋮----
export type AudioBatchProcessMode = "convert" | "normalize"
export type AudioBatchProcessRequest = { inputPaths: string[]; recurseDirectories: boolean | null; mode: AudioBatchProcessMode; outputFormat: string | null; overwriteExisting: boolean | null; outputDirectory: string | null }
export type AudioBatchProcessResult = { taskId: string; processedPaths: string[]; skippedPaths: string[]; failedPaths: string[]; outputDirectory: string | null; soxBinary: string }
export type AudioDeckId = "a" | "b"
export type AudioDeckState = { deckId: AudioDeckId; loadedPath: string | null; loadedName: string | null; durationSeconds: number; currentTimeSeconds: number; gainLinear: number; rate: number; isPlaying: boolean; isLoading: boolean; isBuffering: boolean; peakMeterLinear: number; rmsMeterLinear: number; loopRegion: AudioEngineLoopRegion; error: string | null }
export type AudioEngineDeckRequest = { deckId: AudioDeckId }
export type AudioEngineGainRequest = { deckId: AudioDeckId; gainLinear: number }
export type AudioEngineLoadDeckRequest = { deckId: AudioDeckId; inputPath: string }
export type AudioEngineLoopRegion = { startSeconds: number; endSeconds: number; enabled: boolean }
export type AudioEngineLoopRegionRequest = { deckId: AudioDeckId; startSeconds: number; endSeconds: number; enabled: boolean }
export type AudioEngineRateRequest = { deckId: AudioDeckId; rate: number }
export type AudioEngineSeekRequest = { deckId: AudioDeckId; positionSeconds: number }
export type AudioEngineSetArmedDeckRequest = { deckId: AudioDeckId }
export type AudioEngineStateEvent = { state: AudioEngineStateSnapshot }
export type AudioEngineStateSnapshot = { ready: boolean; engineError: string | null; armedDeck: AudioDeckId; outputSampleRateHz: number | null; outputChannels: number | null; decks: AudioDeckState[] }
export type AudioEngineSyncSelectionRequest = { inputPath: string }
export type AudioPreviewAnalysis = { inputPath: string; durationSeconds: number; sampleRateHz: number | null; channels: number | null; encoding: string | null; bitsPerSample: number | null; containerType: string | null; peakLevel: number; rmsLevel: number; loudnessDb: number | null; headroomDb: number | null; waveformBuckets: AudioWaveformBucket[]; spectralBands: number[] }
export type AudioTransformMode = "exportClip" | "exportNormalized" | "convertFormat" | "overwriteOriginal"
export type AudioTransformRequest = { inputPath: string; outputPath: string | null; overwriteExisting: boolean; mode: AudioTransformMode; trimStartSeconds: number | null; trimEndSeconds: number | null; fadeInSeconds: number | null; fadeOutSeconds: number | null; normalize: boolean | null; outputFormat: string | null; generateSpectrogram: boolean | null }
export type AudioTransformResult = { taskId: string; outputPath: string; spectrogramPath: string | null; durationSeconds: number | null; outputFormat: string; overwrittenOriginal: boolean; soxBinary: string }
export type AudioWaveformBucket = { index: number; peakLevel: number; rmsLevel: number }
export type CloudAccountStatus = "connected" | "expired" | "error"
export type CloudAccountSummary = { id: string; provider: CloudProviderId; display_name: string; email: string; avatar_url: string | null; connected_at: number; status: CloudAccountStatus; drive_label: string; root_path: string }
export type CloudAccountsSnapshot = { accounts: CloudAccountSummary[]; providers: CloudProviderConfigurationStatus[] }
export type CloudAuthSession = { request_id: string; provider: CloudProviderId; authorization_url: string }
export type CloudAuthStatus = { status: string; account: CloudAccountSummary | null; error: string | null }
export type CloudBreadcrumb = { label: string; path: string }
export type CloudDirectoryListing = { path: string; parent_path: string | null; breadcrumbs: CloudBreadcrumb[]; entries: FileEntry[] }
export type CloudProviderConfigurationSource = "none" | "settings" | "environment"
export type CloudProviderConfigurationStatus = { provider: CloudProviderId; configured: boolean; missing_configuration: string[]; configuration_source: CloudProviderConfigurationSource; client_id: string | null; client_secret_present: boolean }
export type CloudProviderId = "google-drive" | "dropbox"
export type DriveInfo = { letter: string; label: string; total_bytes: number; free_bytes: number; drive_type: string }
export type EntryStorageInfo = { path: string; bytes: number; is_dir: boolean; is_complete: boolean }
export type ExplorerDuplicateGroup = { fileSize: number; contentHash: string; entries: FileEntry[] }
export type ExplorerDuplicateScanStartResponse = { scanId: string }
export type ExplorerDuplicateScanStatus = { scanId: string; rootPath: string; scannedFileCount: number; candidateFileCount: number; completed: boolean; cancelled: boolean; error: string | null; groups: ExplorerDuplicateGroup[] }
export type ExplorerEntryThumbnail = { kind: ExplorerThumbnailKind; posterDataUrl: string; hoverFrames: ExplorerVideoHoverFrame[]; hoverFrameDelayMs: number | null }
export type ExplorerEntryThumbnailRequest = { path: string; maxWidth: number; maxHeight: number; includeVideoHoverScrub: boolean | null; videoHoverFrameCount: number | null }
export type ExplorerLayoutMode = "full" | "dock"
export type ExplorerPathTagAssignment = { path: string; tagIds: string[]; tagLabels: string[] }
export type ExplorerSavedSearchRecord = { id: string; name: string; rootPath: string; query: string; includeContent: boolean; tagFilterIds: string[]; createdAt: number; updatedAt: number }
export type ExplorerSavedSearchSaveRequest = { id: string | null; name: string; rootPath: string; query: string; includeContent: boolean; tagFilterIds: string[] }
export type ExplorerTagMutationMode = "add" | "remove" | "replace"
export type ExplorerTagMutationRequest = { paths: string[]; tagNames: string[]; mode: ExplorerTagMutationMode }
export type ExplorerTagRecord = { id: string; label: string; color: string | null; pathCount: number }
export type ExplorerTagSnapshot = { tags: ExplorerTagRecord[]; assignments: ExplorerPathTagAssignment[] }
export type ExplorerTaskHistoryClearScope = "completed" | "failed" | "finished"
export type ExplorerTaskKind = "copy" | "move" | "delete" | "trash" | "batchRename" | "duplicateScan" | "extractArchive" | "recursiveSize" | "checksum" | "audioTransform" | "audioBatchProcess"
export type ExplorerTaskProgressEvent = { taskId: string; task: ExplorerTaskRecord }
export type ExplorerTaskRecord = { id: string; kind: ExplorerTaskKind; status: ExplorerTaskStatus; title: string; detail: string; progressCurrent: number | null; progressTotal: number | null; startedAt: number; finishedAt: number | null; sourcePaths: string[]; destinationPath: string | null; errorMessage: string | null; canRetry: boolean; canCancel: boolean; canRevealOutput: boolean; canOpenOutput: boolean; canUndo: boolean; schedulerTask: YaziSchedulerTaskSnap | null }
export type ExplorerTaskStatus = "running" | "succeeded" | "failed" | "cancelled"
export type ExplorerThumbnailKind = "image" | "code" | "shader" | "audio" | "video"
export type ExplorerTrashActionRecord = { id: string; trashedAt: number; entries: ExplorerTrashedEntryRecord[] }
export type ExplorerTrashRestoreResult = { restoredPaths: string[]; missingPaths: string[] }
export type ExplorerTrashedEntryRecord = { originalPath: string; trashPath: string; isDir: boolean }
export type ExplorerVideoHoverFrame = { imageDataUrl: string; timestampSeconds: number }
export type ExternalTerminalRequest = { workingDir: string; profile: string | null; executable: string | null; args: string[] | null; shell: string | null }
export type FileEntry = { name: string; path: string; is_dir: boolean; size: number; modified: number; extension: string; is_hidden: boolean; is_symlink: boolean }
export type FileSearchContentCacheStatus = "not_requested" | "cache_hit" | "warmed" | "disabled" | "over_budget_fallback" | "read_failure_fallback"
export type FileSearchDiagnostics = { executionStrategy: FileSearchExecutionStrategy; contentCacheStatus: FileSearchContentCacheStatus; scannedEntryCount: number; indexedEntryCount: number; contentCacheStoredFileCount: number; contentCacheStoredByteCount: number; truncatedByScanBudget: boolean }
export type FileSearchExecutionStrategy = "name_index_cache_hit" | "content_index_cache_hit" | "live_scan"
export type FileSearchMatchKind = "name" | "content" | "name_and_content"
export type FileSearchResponse = { results: FileSearchResult[]; diagnostics: FileSearchDiagnostics }
export type FileSearchResult = { name: string; path: string; relative_path: string; is_dir: boolean; size: number; modified: number; extension: string; is_hidden: boolean; is_symlink: boolean; match_kind: FileSearchMatchKind; snippet: string; line_number: number | null }
export type FileTransferCollision = { source_path: string; source_name: string; destination_path: string; operation: FileTransferOperation; destination_exists: boolean; destination_is_dir: boolean }
export type FileTransferCollisionPolicy = "keep_both" | "replace" | "skip"
export type FileTransferDisposition = "transferred" | "skipped_existing"
export type FileTransferOperation = "copy" | "move"
export type FileTransferResult = { source_path: string; destination_path: string; operation: FileTransferOperation; collision_policy: FileTransferCollisionPolicy; disposition: FileTransferDisposition }
export type FsArchiveExtractionMode = "openCached" | "extractHere" | "extractToNewFolder"
export type FsArchiveExtractionRequest = { archivePath: string; mode: FsArchiveExtractionMode }
export type FsArchiveExtractionResult = { outputPath: string; extractedEntryCount: number; reusedCachedOutput: boolean }
export type FsBatchRenameItem = { sourcePath: string; destinationPath: string }
export type FsBatchRenameMode = "literal" | "regex"
export type FsBatchRenamePreviewRow = { sourcePath: string; currentName: string; nextName: string; destinationPath: string; collision: boolean; validationError: string | null }
export type FsBatchRenameRecipe = { sourcePaths: string[]; search: string; replacement: string; prefix: string; suffix: string; mode: FsBatchRenameMode; startIndex: number | null; indexPadding: number | null }
export type FsBatchRenameResult = { sourcePath: string; destinationPath: string }
export type FsChecksumEntryInfo = { path: string; bytes: number; isDir: boolean; md5: string | null; sha256: string | null; error: string | null }
export type FsItemPropertiesInfo = { path: string; name: string; isDir: boolean; isSymlink: boolean; bytes: number; modifiedAtMs: number | null; createdAtMs: number | null; accessedAtMs: number | null; permissions: FsPermissionInfo }
export type FsJumpFilterEntry = { path: string; name: string; isDir: boolean; sortOrder: number }
export type FsJumpFilterMatch = { path: string; name: string; isDir: boolean; sortOrder: number; score: number; matchedIndices: number[] }
export type FsJumpFilterRequest = { query: string; entries: FsJumpFilterEntry[]; limit: number | null }
export type FsPermissionInfo = { readonly: boolean; display: string; unixMode: number | null; unixModeOctal: string | null }
export type FsRuntimeCachePolicy = { dirListCacheTtlMs: number; searchNameIndexCacheTtlMs: number; searchContentIndexCacheTtlMs: number; entrySizeCacheTtlMs: number; entrySizeScanBudgetMs: number; searchContentIndexTotalBytesBudget: number; maxSearchContentFileBytes: number; searchMaxIndexedEntries: number }
export type FsWriteFileContent = { kind: "text"; value: string } | { kind: "bytes"; value: number[] }
export type LayoutBackBehavior = "overlay-first" | "history-first"
export type LayoutBarPosition = "top" | "bottom"
export type LayoutBehaviorConfig = { cycleOrder: number; defaultActivePanelId: string; enforcedOpenPanelIds: string[] }
export type LayoutChromeConfig = { barPosition: LayoutBarPosition; showSettingsShortcut: boolean; showPanelMenu: boolean; showBlurToggle: boolean; showShortcutBadge: boolean }
export type LayoutControlDockConfig = { enabled: boolean; side: LayoutDockSide; inset: number }
export type LayoutDockSide = "left" | "right"
export type LayoutInteractionConfig = { primaryAxisOwner: LayoutSurfaceOwner; commandOwner: LayoutSurfaceOwner; backBehavior: LayoutBackBehavior; modeExitTarget: LayoutModeExitTarget; progressOwner: LayoutProgressOwner; preserveFocusAnchor: boolean; preserveSelectionAnchor: boolean; preserveLocationAnchor: boolean }
export type LayoutManifest = { version: number; extendsBuiltIns: boolean; profiles: LayoutProfile[] }
export type LayoutModeExitTarget = "last-browse-target" | "shell-default"
export type LayoutPinnedPanel = { panelId: string; side: LayoutDockSide; size: number; mode: ExplorerLayoutMode }
export type LayoutProfile = { id: string; label: string; description: string; shellBlueprint: ShellBlueprintId; chrome: LayoutChromeConfig; controlDock: LayoutControlDockConfig; pinnedPanels: LayoutPinnedPanel[]; behavior: LayoutBehaviorConfig; interaction: LayoutInteractionConfig }
export type LayoutProgressOwner = "inline" | "session" | "history"
export type LayoutSurfaceOwner = "active-panel" | "pinned-rail" | "chrome" | "session"
export type LinuxDisplayBackend = "wayland" | "x11"
export type LinuxDisplayBackendPreference = "auto" | "wayland" | "x11"
export type LinuxDisplayBackendStatus = { availableBackends: LinuxDisplayBackend[]; sessionBackend: LinuxDisplayBackend | null; activeBackend: LinuxDisplayBackend | null; preferredBackend: LinuxDisplayBackendPreference; autoX11FallbackActive: boolean }
export type NativeIconRequest = { path: string; size: number | null }
export type NativeIconResponse = { path: string; src: string | null }
export type PluginBackendResult = { stdout: string; stderr: string; status: number }
export type PluginDirectoryWatchEvent = { root: string; kind: string; paths: string[] }
export type PythonActionResponse = { status: PythonRuntimeStatus; result: PythonCommandResult }
export type PythonBoilerplateFiles = { readmePath: string; requirementsPath: string; packageDir: string; helloScriptPath: string; probeScriptPath: string }
export type PythonCommandResult = { command: string; workingDirectory: string; exitCode: number; success: boolean; stdout: string; stderr: string }
export type PythonExecutionMode = "inline" | "script" | "module"
export type PythonExecutionRequest = { config: PythonRuntimeConfig | null; executionMode: PythonExecutionMode; entry: string; arguments: string[] | null; workingDirectory: string | null; environment: Partial<{ [key in string]: string }> | null; useManagedEnvironment: boolean | null }
export type PythonInterpreterDescriptor = { id: string; label: string; command: string; args: string[]; source: string; preferred: boolean; recommended: boolean; executable: string; version: string; major: number; minor: number; micro: number }
export type PythonPackageInstallRequest = { config: PythonRuntimeConfig | null; packageInput: string; persistToRequirements: boolean | null }
export type PythonRuntimeConfig = { preferredInterpreterPath: string | null; runtimeRoot: string | null; bootstrapPackages: string | null; autoUpgradePip: boolean | null; createBoilerplate: boolean | null }
export type PythonRuntimeStatus = { runtimeRoot: string; envDir: string; scriptsDir: string; tempDir: string; logsDir: string; managedPythonPath: string; envExists: boolean; ready: boolean; managedPythonVersion: string | null; managedPipVersion: string | null; preferredInterpreterPath: string | null; bootstrapPackages: string[]; interpreterHint: string; baseInterpreter: PythonInterpreterDescriptor | null; discoveredInterpreters: PythonInterpreterDescriptor[]; boilerplate: PythonBoilerplateFiles }
export type ResolvedVideoPreviewSource = { sourcePath: string; sourceKind: VideoPreviewSourceKind; mimeType: string | null; generatedFromPath: string | null }
export type SavedScreenshot = { path: string; file_name: string; created_at: number }
export type ScreenshotAnnotatedExportResult = { saved: SavedScreenshot | null; copiedToClipboard: boolean }
export type ScreenshotAnnotation = { type: "rect"; x1: number; y1: number; x2: number; y2: number; color: string; lw: number } | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; color: string; lw: number } | { type: "text"; x: number; y: number; text: string; color: string; size: number }
export type ScreenshotPreview = { captureId: string; previewUrl: string; imageWidth: number; imageHeight: number }
export type ScreenshotRegion = { x: number; y: number; width: number; height: number }
export type ShellBlueprint = { id: ShellBlueprintId; label: string; description: string; navigationModel: ShellNavigationModel; surfaceStyle: ShellSurfaceStyle; supportsPinnedPanels: boolean; supportsViewportDock: boolean; supportsPanelTabs: boolean; supportsDualScreen: boolean }
export type ShellBlueprintId = "classic-dock" | "xmb-cross-media" | "retro-desktop" | "tile-start" | "handheld-dual-screen"
export type ShellNavigationModel = "tabs" | "cross-axis" | "desktop" | "tiles" | "stacked-dual-pane"
export type ShellSurfaceStyle = "glass" | "solid" | "skeuomorphic" | "flat" | "pixel"
export type TerminalShellIntegrationRequest = { id: string; shellKind: TerminalShellKind | null; supportsAutoCd: boolean | null; atPrompt: boolean | null; reportedCwd: string | null }
export type TerminalShellIntegrationState = { shellKind: TerminalShellKind; supportsAutoCd: boolean; atPrompt: boolean; reportedCwd: string | null; pendingCwd: string | null; lastSyncedCwd: string | null }
export type TerminalShellIntegrationStateEvent = { id: string; state: TerminalShellIntegrationState; appliedCwd: string | null }
export type TerminalShellKind = "bash" | "zsh" | "fish" | "powerShell" | "cmd" | "unknown"
export type TerminalWriteRequest = { id: string; data: string }
export type ThemeAnimationProfile = { id: string; name: string; durationMs: number; easing: string; intensity: number }
export type ThemeChromeStyle = "minimal" | "ornate" | "floating" | "system"
export type ThemeCompatibility = { shellBlueprints: ShellBlueprintId[]; tags: string[] }
export type ThemeDensity = "compact" | "comfortable" | "immersive"
export type ThemeValue = string | number | boolean | null | ThemeValue[] | { [key: string]: ThemeValue };
export type ThemeDesignToken = { id: string; name: string; kind: ThemeTokenKind; value: ThemeValue }
export type ThemeIconPackManifest = { id: string; name: string; style: ThemeIconPackStyle }
export type ThemeIconPackStyle = "system" | "vector" | "pixel" | "skeuomorphic" | "custom"
export type ThemeIconStyle = "system" | "vector" | "pixel" | "skeuomorphic"
export type ThemeLayoutPrimitive = { id: string; name: string; kind: ThemeLayoutPrimitiveKind; props: Partial<{ [key in string]: ThemeValue }> }
export type ThemeLayoutPrimitiveKind = "stack" | "grid" | "split" | "dock" | "freeform"
export type ThemeManifest = { id: string; name: string; extends: string | null; presentation: ThemePresentation; compatibility: ThemeCompatibility; designTokens: ThemeDesignToken[]; layoutPrimitives: ThemeLayoutPrimitive[]; navigationPatterns: ThemeNavigationPattern[]; animationProfiles: ThemeAnimationProfile[]; iconPacks: ThemeIconPackManifest[]; renderStyles: ThemeRenderStyleManifest[]; defaultLayoutPrimitiveId: string | null; defaultNavigationPatternId: string | null; defaultAnimationProfileId: string | null; defaultIconPackId: string | null; defaultRenderStyleId: string | null }
export type ThemeMotionStyle = "snappy" | "fluid" | "dramatic" | "instant"
export type ThemeNavigationAxis = "horizontal" | "vertical" | "both"
export type ThemeNavigationPattern = { id: string; name: string; kind: ThemeNavigationPatternKind; axis: ThemeNavigationAxis; props: Partial<{ [key in string]: ThemeValue }> }
export type ThemeNavigationPatternKind = "xmb" | "tabbed" | "hierarchy" | "palette" | "spatial" | "custom"
export type ThemePresentation = { density: ThemeDensity; chromeStyle: ThemeChromeStyle; iconStyle: ThemeIconStyle; motionStyle: ThemeMotionStyle; cornerRadius: number; panelSpacing: number }
export type ThemeRenderStyleKind = "vs-code-workbench" | "ps-3-xmb" | "ios-springboard" | "wii-channels" | "desktop-window-manager" | "custom"
export type ThemeRenderStyleManifest = { id: string; label: string; kind: ThemeRenderStyleKind; entryModule: string; supportsLiveSwap: boolean; description: string | null }
export type ThemeTokenKind = "color" | "typography" | "spacing" | "radius" | "shadow" | "motion"
export type VideoPreviewSourceKind = "direct" | "proxy"
export type VideoTrimExportRequest = { inputPath: string; outputPath: string; startTimeSeconds: number; endTimeSeconds: number; overwriteExisting: boolean }
export type VideoTrimExportResult = { outputPath: string; startTimeSeconds: number; endTimeSeconds: number; durationSeconds: number; ffmpegBinary: string }
export type WaylandDockAnchor = "top" | "bottom"
export type WaylandDockHostStatus = { enabled: boolean; windowLabel: string | null }
export type WorkbenchInputMode = "keyboard" | "pointer" | "controller" | "touch"
export type WorkbenchInputProfile = { mode: WorkbenchInputMode; density: ThemeDensity; directionalNavigation: boolean; pointerGestures: boolean }
export type WorkbenchPanelBinding = { panelId: string; region: WorkbenchRegionId; order: number; defaultOpen: boolean; preferredSize: number | null }
export type WorkbenchPreset = { id: string; label: string; description: string; shellBlueprint: ShellBlueprintId; navigationModel: ShellNavigationModel; preferredThemeIds: string[]; panelBindings: WorkbenchPanelBinding[]; windowProfile: WorkbenchWindowProfile; inputProfile: WorkbenchInputProfile }
export type WorkbenchRegionId = "primary" | "secondary" | "rail" | "dock" | "desktop" | "modal"
export type WorkbenchWindowMode = "overlay" | "windowed" | "fullscreen"
export type WorkbenchWindowProfile = { mode: WorkbenchWindowMode; anchor: string | null; aspectRatio: string | null }
export type YaziBindingManifest = { version: string; entries: YaziBindingManifestEntry[] }
export type YaziBindingManifestEntry = { crateName: YaziCrateName; status: YaziBindingStatus; exportedTypes: string[]; notes: string[] }
export type YaziBindingStatus = "direct" | "bridged" | "planned" | "internal"
export type YaziCrateName = "yazi-actor" | "yazi-adapter" | "yazi-binding" | "yazi-boot" | "yazi-build" | "yazi-cli" | "yazi-codegen" | "yazi-config" | "yazi-core" | "yazi-dds" | "yazi-emulator" | "yazi-ffi" | "yazi-fm" | "yazi-fs" | "yazi-macro" | "yazi-packing" | "yazi-parser" | "yazi-plugin" | "yazi-proxy" | "yazi-scheduler" | "yazi-sftp" | "yazi-shared" | "yazi-shim" | "yazi-term" | "yazi-tty" | "yazi-vfs" | "yazi-watcher" | "yazi-widgets"
export type YaziFsErrorDto = { kind: string; code: number | null; message: string | null }
export type YaziFsFolderStageDto = { state: "loading" } | { state: "loaded" } | { state: "failed"; error: YaziFsErrorDto }
export type YaziFsSortBy = "none" | "mtime" | "btime" | "extension" | "alphabetical" | "natural" | "size" | "random"
export type YaziFsSortFallback = "alphabetical" | "natural"
export type YaziParserHiddenOpt = { state: YaziParserHiddenOptState }
export type YaziParserHiddenOptState = "none" | "show" | "hide" | "toggle"
export type YaziParserSortOpt = { by: YaziFsSortBy | null; reverse: boolean | null; dirFirst: boolean | null; sensitive: boolean | null; translit: boolean | null; fallback: YaziFsSortFallback | null }
export type YaziParserTaskSummary = { total: number; success: number; failed: number; percent: number | null }
export type YaziSchedulerFetchProg = { state: boolean | null }
export type YaziSchedulerFileProgCopy = { totalFiles: number; successFiles: number; failedFiles: number; totalBytes: number; processedBytes: number; collected: boolean | null; cleaned: boolean | null }
export type YaziSchedulerFileProgCut = { totalFiles: number; successFiles: number; failedFiles: number; totalBytes: number; processedBytes: number; collected: boolean | null; cleaned: boolean | null }
export type YaziSchedulerFileProgDelete = { totalFiles: number; successFiles: number; failedFiles: number; totalBytes: number; processedBytes: number; collected: boolean | null; cleaned: boolean | null }
export type YaziSchedulerFileProgDownload = { totalFiles: number; successFiles: number; failedFiles: number; totalBytes: number; processedBytes: number; collected: boolean | null; cleaned: boolean | null }
export type YaziSchedulerFileProgHardlink = { total: number; success: number; failed: number; collected: boolean | null }
export type YaziSchedulerFileProgLink = { state: boolean | null }
export type YaziSchedulerFileProgTrash = { state: boolean | null; cleaned: boolean | null }
export type YaziSchedulerFileProgUpload = { totalFiles: number; successFiles: number; failedFiles: number; totalBytes: number; processedBytes: number; collected: boolean | null; cleaned: boolean | null }
export type YaziSchedulerPluginProgEntry = { state: boolean | null }
export type YaziSchedulerPreloadProg = { state: boolean | null }
export type YaziSchedulerProcessProgBg = { state: boolean | null }
export type YaziSchedulerProcessProgBlock = { state: boolean | null }
export type YaziSchedulerProcessProgOrphan = { state: boolean | null }
export type YaziSchedulerSizeProg = { done: boolean }
export type YaziSchedulerTaskProg = ({ kind: "fileCopy" } & YaziSchedulerFileProgCopy) | ({ kind: "fileCut" } & YaziSchedulerFileProgCut) | ({ kind: "fileLink" } & YaziSchedulerFileProgLink) | ({ kind: "fileHardlink" } & YaziSchedulerFileProgHardlink) | ({ kind: "fileDelete" } & YaziSchedulerFileProgDelete) | ({ kind: "fileTrash" } & YaziSchedulerFileProgTrash) | ({ kind: "fileDownload" } & YaziSchedulerFileProgDownload) | ({ kind: "fileUpload" } & YaziSchedulerFileProgUpload) | ({ kind: "pluginEntry" } & YaziSchedulerPluginProgEntry) | ({ kind: "fetch" } & YaziSchedulerFetchProg) | ({ kind: "preload" } & YaziSchedulerPreloadProg) | ({ kind: "size" } & YaziSchedulerSizeProg) | ({ kind: "processBlock" } & YaziSchedulerProcessProgBlock) | ({ kind: "processOrphan" } & YaziSchedulerProcessProgOrphan) | ({ kind: "processBg" } & YaziSchedulerProcessProgBg)
export type YaziSchedulerTaskSnap = { name: string; prog: YaziSchedulerTaskProg }
⋮----
/** tauri-specta globals **/
⋮----
import { invoke as TAURI_INVOKE } from "@tauri-apps/api/core";
⋮----
import { type WebviewWindow as __WebviewWindow__ } from "@tauri-apps/api/webviewWindow";
⋮----
type __EventObj__<T> = {
	listen: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.listen<T>>;
	once: (
		cb: TAURI_API_EVENT.EventCallback<T>,
	) => ReturnType<typeof TAURI_API_EVENT.once<T>>;
	emit: null extends T
		? (payload?: T) => ReturnType<typeof TAURI_API_EVENT.emit>
		: (payload: T) => ReturnType<typeof TAURI_API_EVENT.emit>;
};
⋮----
export type Result<T, E> =
	| { status: "ok"; data: T }
	| { status: "error"; error: E };
⋮----
export function __makeEvents__<T extends Record<string, any>>(
	mappings: Record<keyof T, string>,
)
````

## File: input/GlobalShortcuts.ts
````typescript
import { useEffect, useEffectEvent, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { isRegistered, register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { normalizeKeybindingValue } from '../config/hotkeys';
⋮----
export function useGlobalShortcut(shortcut: string, callback: () => void, enabled: boolean = true)
⋮----
const registerShortcut = async () =>
````

## File: panels/panelRegistry.tsx
````typescript
import React from 'react';
import { Terminal as TerminalIcon, FolderOpen, GitBranch, StickyNote, Camera, Puzzle, SlidersHorizontal } from 'lucide-react';
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
⋮----
// Prevent keep-mounted heavy panels from rerendering on unrelated App state updates.
````

## File: runtime/audioWorkbenchBackend.ts
````typescript
import type {
  AudioBatchProcessRequest,
  AudioBatchProcessResult,
  AudioDeckId,
  AudioDeckState,
  AudioEngineDeckRequest,
  AudioEngineGainRequest,
  AudioEngineLoadDeckRequest,
  AudioEngineLoopRegionRequest,
  AudioEngineRateRequest,
  AudioEngineSeekRequest,
  AudioEngineSetArmedDeckRequest,
  AudioEngineStateEvent,
  AudioEngineStateSnapshot,
  AudioEngineSyncSelectionRequest,
  AudioPreviewAnalysis,
  AudioTransformRequest,
  AudioTransformResult,
} from '../generated/tauri';
import { commands, events, unwrapTauriResult } from './tauriClient';
⋮----
export type ExplorerAudioDeckId = AudioDeckId;
export type ExplorerAudioDeckState = AudioDeckState;
export type ExplorerAudioEngineStateEvent = AudioEngineStateEvent;
export type ExplorerAudioEngineStateSnapshot = AudioEngineStateSnapshot;
export type ExplorerAudioPreviewAnalysis = AudioPreviewAnalysis;
export type ExplorerAudioTransformInput = AudioTransformRequest;
export type ExplorerAudioTransformOutput = AudioTransformResult;
export type ExplorerAudioBatchInput = AudioBatchProcessRequest;
export type ExplorerAudioBatchOutput = AudioBatchProcessResult;
⋮----
export async function analyzeExplorerAudioPreview(
  inputPath: string,
): Promise<ExplorerAudioPreviewAnalysis>
⋮----
export async function exportExplorerAudioTransform(
  request: ExplorerAudioTransformInput,
): Promise<ExplorerAudioTransformOutput>
⋮----
export async function runExplorerAudioBatchProcess(
  request: ExplorerAudioBatchInput,
): Promise<ExplorerAudioBatchOutput>
⋮----
export async function prepareExplorerAudioEngine(): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function getExplorerAudioEngineState(): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function loadExplorerAudioDeck(
  request: AudioEngineLoadDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function syncExplorerSelectionToArmedDeck(
  request: AudioEngineSyncSelectionRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function unloadExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setExplorerArmedAudioDeck(
  request: AudioEngineSetArmedDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function playExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function pauseExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function stopExplorerAudioDeck(
  request: AudioEngineDeckRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function seekExplorerAudioDeck(
  request: AudioEngineSeekRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setExplorerAudioLoopRegion(
  request: AudioEngineLoopRegionRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setExplorerAudioDeckGain(
  request: AudioEngineGainRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setExplorerAudioDeckRate(
  request: AudioEngineRateRequest,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function listenToExplorerAudioEngineState(
  listener: (event: ExplorerAudioEngineStateEvent) => void,
): Promise<() => void>
````

## File: runtime/documentInteractionGuards.ts
````typescript
function isEditableElement(element: HTMLElement): boolean
⋮----
export function resolveEventTargetElement(target: EventTarget | null): HTMLElement | null
⋮----
export function shouldAllowNativeContextMenu(target: EventTarget | null): boolean
⋮----
export function shouldAllowDocumentSelection(target: EventTarget | null): boolean
````

## File: runtime/explorerBackend.ts
````typescript
import type { FileSearchResponse } from '../config/searchTelemetry';
import type { FsRuntimeCachePolicy } from '../config/runtimeCachePolicy';
import { commands, events, unwrapTauriResult } from './tauriClient';
import { useExplorerStore } from '../store/explorerStore';
import {
  type CloudAccountStatus,
  type CloudAccountSummary,
  type CloudAccountsSnapshot,
  type CloudAuthSession,
  type CloudAuthStatus,
  type CloudBreadcrumb,
  type CloudProviderConfigurationSource,
  type CloudProviderConfigurationStatus,
  type CloudProviderId,
  type DriveInfo,
  type EntryStorageInfo,
  type ExplorerDuplicateScanStartResponse,
  type ExplorerDuplicateScanStatus,
  type ExplorerEntryThumbnail,
  type ExplorerEntryThumbnailRequest,
  type ExplorerSavedSearchRecord,
  type ExplorerSavedSearchSaveRequest,
  type FsBatchRenameMode,
  type FsArchiveExtractionMode,
  type FsArchiveExtractionRequest,
  type FsArchiveExtractionResult,
  type FsBatchRenamePreviewRow,
  type FsBatchRenameRecipe,
  type ExplorerTaskHistoryClearScope,
  type ExplorerTaskKind,
  type ExplorerTagMutationRequest,
  type ExplorerTaskRecord,
  type ExplorerTagSnapshot,
  type ExplorerTrashActionRecord,
  type ExplorerTrashRestoreResult,
  type ExplorerTaskProgressEvent,
  type ExplorerTaskStatus,
  type FileEntry,
  type FileSearchResult,
  type FileTransferCollision,
  type FileTransferCollisionPolicy,
  type FileTransferDisposition,
  type FileTransferOperation,
  type FileTransferResult,
  type FsChecksumEntryInfo,
  type FsItemPropertiesInfo,
  type FsJumpFilterEntry,
  type FsJumpFilterMatch,
  type FsJumpFilterRequest,
  type FsWriteFileContent,
  type FsBatchRenameItem,
  type FsBatchRenameResult,
  type TerminalShellIntegrationRequest,
  type TerminalShellIntegrationState,
  type TerminalShellIntegrationStateEvent,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';
⋮----
export type ExplorerFileEntry = FileEntry;
export type ExplorerFileSearchResult = FileSearchResult;
export type ExplorerEntryStorageInfo = EntryStorageInfo;
export type ExplorerFileTransferOperation = FileTransferOperation;
export type ExplorerFileTransferResult = FileTransferResult;
export type ExplorerFileTransferCollision = FileTransferCollision;
export type ExplorerFileTransferCollisionPolicy = FileTransferCollisionPolicy;
export type ExplorerFileTransferDisposition = FileTransferDisposition;
export type ExplorerTaskProgress = ExplorerTaskProgressEvent;
export type ExplorerTaskSnapshot = ExplorerTaskRecord;
export type ExplorerSchedulerTask = YaziSchedulerTaskSnap;
export type ExplorerTaskHistoryScope = ExplorerTaskHistoryClearScope;
export type ExplorerTaskKindValue = ExplorerTaskKind;
export type ExplorerTaskStatusValue = ExplorerTaskStatus;
export type ExplorerWritableContent = string | number[];
export type ExplorerCloudProviderId = CloudProviderId;
export type ExplorerCloudAccountStatus = CloudAccountStatus;
export type ExplorerCloudAccountSummary = CloudAccountSummary;
export type ExplorerCloudAccountsSnapshot = CloudAccountsSnapshot;
export type ExplorerCloudAuthSession = CloudAuthSession;
export type ExplorerCloudAuthStatus = CloudAuthStatus;
export type ExplorerCloudProviderConfigurationSource = CloudProviderConfigurationSource;
export type ExplorerCloudProviderConfigurationStatus = CloudProviderConfigurationStatus;
export type ExplorerTagMetadataSnapshot = ExplorerTagSnapshot;
export type ExplorerTagMutation = ExplorerTagMutationRequest;
export type ExplorerSavedSearch = ExplorerSavedSearchRecord;
export type ExplorerSavedSearchInput = ExplorerSavedSearchSaveRequest;
export type ExplorerArchiveExtractionMode = FsArchiveExtractionMode;
export type ExplorerArchiveExtractionInput = FsArchiveExtractionRequest;
export type ExplorerArchiveExtractionOutcome = FsArchiveExtractionResult;
export type ExplorerTrashAction = ExplorerTrashActionRecord;
export type ExplorerTrashRestore = ExplorerTrashRestoreResult;
export type ExplorerBatchRenameItem = FsBatchRenameItem;
export type ExplorerBatchRenameResult = FsBatchRenameResult;
export type ExplorerBatchRenameModeValue = FsBatchRenameMode;
export type ExplorerBatchRenameRecipeInput = FsBatchRenameRecipe;
export type ExplorerBatchRenamePreview = FsBatchRenamePreviewRow;
export type ExplorerDuplicateScanStart = ExplorerDuplicateScanStartResponse;
export type ExplorerDuplicateScan = ExplorerDuplicateScanStatus;
export type ExplorerEntryThumbnailData = ExplorerEntryThumbnail;
export type ExplorerEntryThumbnailInput = ExplorerEntryThumbnailRequest;
export type ExplorerChecksumInfo = FsChecksumEntryInfo;
export type ExplorerItemProperties = FsItemPropertiesInfo;
export type ExplorerJumpFilterEntryInput = FsJumpFilterEntry;
export type ExplorerJumpFilterInput = FsJumpFilterRequest;
export type ExplorerJumpFilterResult = FsJumpFilterMatch;
export type ExplorerTerminalShellIntegrationInput = TerminalShellIntegrationRequest;
export type ExplorerTerminalShellIntegration = TerminalShellIntegrationState;
export type ExplorerTerminalShellIntegrationEvent = TerminalShellIntegrationStateEvent;
⋮----
export type ExplorerLocationBreadcrumb = {
  label: string;
  path: string;
};
⋮----
export type ExplorerLocationListing = {
  kind: 'local' | 'cloud';
  path: string;
  parentPath: string | null;
  breadcrumbs: ExplorerLocationBreadcrumb[];
  entries: ExplorerFileEntry[];
};
⋮----
export type ExplorerLocalDriveInfo = DriveInfo & {
  kind: 'local';
  id: string;
  path: string;
};
⋮----
export type ExplorerCloudDriveInfo = {
  kind: 'cloud';
  id: string;
  path: string;
  label: string;
  provider: ExplorerCloudProviderId;
  accountId: string;
  email: string;
  status: ExplorerCloudAccountStatus;
  avatarUrl: string | null;
};
⋮----
export type ExplorerDriveInfo = ExplorerLocalDriveInfo | ExplorerCloudDriveInfo;
⋮----
function toWritablePayload(content: ExplorerWritableContent): FsWriteFileContent
⋮----
export function isCloudExplorerPath(path: string): boolean
⋮----
function buildLocalBreadcrumbs(path: string): ExplorerLocationBreadcrumb[]
⋮----
function getLocalParentPath(path: string): string | null
⋮----
function getCloudParentPath(path: string): string | null
⋮----
function toExplorerCloudBreadcrumbs(breadcrumbs: CloudBreadcrumb[]): ExplorerLocationBreadcrumb[]
⋮----
function getLeafName(path: string): string
⋮----
function getParentDir(path: string): string
⋮----
function toLocalDriveInfo(drive: DriveInfo): ExplorerLocalDriveInfo
⋮----
function toCloudDriveInfo(account: CloudAccountSummary): ExplorerCloudDriveInfo
⋮----
export type ExplorerBackendContract = {
  listDir: typeof listExplorerDir;
  listDirUncached: typeof listExplorerDirUncached;
  listLocation: typeof listExplorerLocation;
  listLocationUncached: typeof listExplorerLocationUncached;
  getDrives: typeof getExplorerDrives;
  measureEntrySizes: typeof measureExplorerEntrySizes;
  calculateRecursiveSizes: typeof calculateExplorerRecursiveSizes;
  calculateChecksums: typeof calculateExplorerChecksums;
  getItemProperties: typeof getExplorerItemProperties;
  fuzzyFilterEntries: typeof fuzzyFilterExplorerEntries;
  getRuntimeCachePolicy: typeof getExplorerRuntimeCachePolicy;
  getHomeDir: typeof getExplorerHomeDir;
  searchEntriesWithDiagnostics: typeof searchExplorerEntriesWithDiagnostics;
  cancelSearchEntries: typeof cancelExplorerSearchEntries;
  watchEntrySizeRoot: typeof watchExplorerEntrySizeRoot;
  unwatchEntrySizeRoot: typeof unwatchExplorerEntrySizeRoot;
  planItemTransfer: typeof planExplorerItemTransfer;
  openPath: typeof openExplorerPath;
  openArchive: typeof openExplorerArchive;
  openWithDialog: typeof openExplorerPathWithDialog;
  revealPath: typeof revealExplorerPath;
  showPathProperties: typeof showExplorerPathProperties;
  openPathAsAdmin: typeof openExplorerPathAsAdmin;
  createDir: typeof createExplorerDir;
  createFile: typeof createExplorerFile;
  extractArchive: typeof extractExplorerArchive;
  transferItems: typeof transferExplorerItems;
  listTasks: typeof listExplorerTasks;
  clearTaskHistory: typeof clearExplorerTaskHistory;
  retryTask: typeof retryExplorerTask;
  cancelTask: typeof cancelExplorerTask;
  writeFile: typeof writeExplorerFile;
  readTextFile: typeof readExplorerTextFile;
  readFileBase64: typeof readExplorerFileBase64;
  readImageThumbnail: typeof readExplorerImageThumbnail;
  readEntryThumbnail: typeof readExplorerEntryThumbnail;
  renamePath: typeof renameExplorerPath;
  deletePath: typeof deleteExplorerPath;
  trashPaths: typeof trashExplorerPaths;
  restoreRecentTrashAction: typeof restoreExplorerTrashAction;
  batchRename: typeof batchRenameExplorerPaths;
  previewBatchRename: typeof previewBatchRenameExplorerPaths;
  applyBatchRenameRecipe: typeof applyBatchRenameExplorerRecipe;
  startDuplicateScan: typeof startExplorerDuplicateScan;
  pollDuplicateScan: typeof pollExplorerDuplicateScan;
  cancelDuplicateScan: typeof cancelExplorerDuplicateScan;
  listTags: typeof listExplorerTags;
  setTagsForPaths: typeof setExplorerTagsForPaths;
  listSavedSearches: typeof listExplorerSavedSearches;
  saveSavedSearch: typeof saveExplorerSavedSearch;
  deleteSavedSearch: typeof deleteExplorerSavedSearch;
  isCloudPath: typeof isCloudExplorerPath;
  supportsSearch: typeof supportsExplorerSearch;
  supportsNativeIntegration: typeof supportsExplorerNativeIntegration;
  supportsNativeDragOut: typeof supportsExplorerNativeDragOut;
  registerTerminalShellIntegration: typeof registerExplorerTerminalShellIntegration;
  syncTerminalCwd: typeof syncExplorerTerminalCwd;
  setTerminalPromptState: typeof setExplorerTerminalPromptState;
};
⋮----
export function queueExplorerTerminalDirectorySync(args: {
  path: string;
  shell?: string | null;
  source?: 'navigation' | 'open-terminal';
}): void
⋮----
export async function listExplorerLocation(
  path: string,
  showHidden: boolean,
): Promise<ExplorerLocationListing>
⋮----
export async function listExplorerLocationUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerLocationListing>
⋮----
export async function listExplorerDir(path: string, showHidden: boolean): Promise<ExplorerFileEntry[]>
⋮----
export async function listExplorerDirUncached(
  path: string,
  showHidden: boolean,
): Promise<ExplorerFileEntry[]>
⋮----
export async function getExplorerDrives(): Promise<ExplorerDriveInfo[]>
⋮----
export async function measureExplorerEntrySizes(
  paths: string[],
  forceRefresh = false,
): Promise<ExplorerEntryStorageInfo[]>
⋮----
export async function calculateExplorerRecursiveSizes(
  paths: string[],
  forceRefresh = false,
): Promise<ExplorerEntryStorageInfo[]>
⋮----
export async function calculateExplorerChecksums(
  paths: string[],
): Promise<ExplorerChecksumInfo[]>
⋮----
export async function getExplorerItemProperties(path: string): Promise<ExplorerItemProperties>
⋮----
export async function fuzzyFilterExplorerEntries(
  request: ExplorerJumpFilterInput,
): Promise<ExplorerJumpFilterResult[]>
⋮----
export async function getExplorerRuntimeCachePolicy(): Promise<FsRuntimeCachePolicy>
⋮----
export async function getExplorerHomeDir(): Promise<string>
⋮----
export async function searchExplorerEntriesWithDiagnostics(args: {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent?: boolean;
  limit?: number;
  requestId?: number;
  requestScope?: string;
}): Promise<FileSearchResponse<ExplorerFileSearchResult>>
⋮----
export async function cancelExplorerSearchEntries(args: {
  path: string;
  requestId?: number;
  requestScope?: string;
}): Promise<void>
⋮----
export async function watchExplorerEntrySizeRoot(path: string): Promise<void>
⋮----
export async function unwatchExplorerEntrySizeRoot(path: string): Promise<void>
⋮----
export async function openExplorerPath(path: string): Promise<void>
⋮----
export async function openExplorerArchive(path: string): Promise<ExplorerArchiveExtractionOutcome>
⋮----
export async function openExplorerPathWithDialog(path: string): Promise<void>
⋮----
export async function revealExplorerPath(path: string): Promise<void>
⋮----
export async function showExplorerPathProperties(path: string): Promise<void>
⋮----
export async function openExplorerPathAsAdmin(path: string): Promise<void>
⋮----
export async function createExplorerDir(path: string): Promise<void>
⋮----
export async function extractExplorerArchive(
  request: ExplorerArchiveExtractionInput,
): Promise<ExplorerArchiveExtractionOutcome>
⋮----
export async function createExplorerFile(
  parentPath: string,
  name: string,
  content: ExplorerWritableContent = '',
): Promise<void>
⋮----
export async function transferExplorerItems(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
  collisionPolicy: ExplorerFileTransferCollisionPolicy = 'keep_both',
): Promise<ExplorerFileTransferResult[]>
⋮----
export async function planExplorerItemTransfer(
  targetDir: string,
  sources: string[],
  operation: ExplorerFileTransferOperation,
): Promise<ExplorerFileTransferCollision[]>
⋮----
export async function listExplorerTasks(): Promise<ExplorerTaskSnapshot[]>
⋮----
export async function clearExplorerTaskHistory(scope: ExplorerTaskHistoryScope): Promise<void>
⋮----
export async function retryExplorerTask(taskId: string): Promise<ExplorerTaskSnapshot>
⋮----
export async function cancelExplorerTask(taskId: string): Promise<ExplorerTaskSnapshot>
⋮----
export async function writeExplorerFile(
  path: string,
  content: ExplorerWritableContent,
): Promise<void>
⋮----
export async function readExplorerTextFile(path: string): Promise<string>
⋮----
export async function readExplorerFileBase64(path: string): Promise<string>
⋮----
export async function readExplorerImageThumbnail(
  path: string,
  maxWidth: number,
  maxHeight: number,
): Promise<string>
⋮----
export async function readExplorerEntryThumbnail(
  request: ExplorerEntryThumbnailInput,
): Promise<ExplorerEntryThumbnailData>
⋮----
export async function renameExplorerPath(oldPath: string, newPath: string): Promise<void>
⋮----
export async function deleteExplorerPath(path: string, recursive: boolean): Promise<void>
⋮----
export async function trashExplorerPaths(paths: string[]): Promise<ExplorerTrashAction>
⋮----
export async function restoreExplorerTrashAction(): Promise<ExplorerTrashRestore | null>
⋮----
export async function batchRenameExplorerPaths(
  items: ExplorerBatchRenameItem[],
): Promise<ExplorerBatchRenameResult[]>
⋮----
export async function previewBatchRenameExplorerPaths(
  recipe: ExplorerBatchRenameRecipeInput,
): Promise<ExplorerBatchRenamePreview[]>
⋮----
export async function applyBatchRenameExplorerRecipe(
  recipe: ExplorerBatchRenameRecipeInput,
): Promise<ExplorerBatchRenameResult[]>
⋮----
export async function startExplorerDuplicateScan(rootPath: string): Promise<ExplorerDuplicateScanStart>
⋮----
export async function pollExplorerDuplicateScan(scanId: string): Promise<ExplorerDuplicateScan>
⋮----
export async function cancelExplorerDuplicateScan(scanId: string): Promise<void>
⋮----
export async function listExplorerTags(paths: string[] = []): Promise<ExplorerTagMetadataSnapshot>
⋮----
export async function setExplorerTagsForPaths(
  request: ExplorerTagMutation,
): Promise<ExplorerTagMetadataSnapshot>
⋮----
export async function listExplorerSavedSearches(): Promise<ExplorerSavedSearch[]>
⋮----
export async function saveExplorerSavedSearch(
  request: ExplorerSavedSearchInput,
): Promise<ExplorerSavedSearch>
⋮----
export async function deleteExplorerSavedSearch(id: string): Promise<void>
⋮----
export function supportsExplorerSearch(path: string): boolean
⋮----
export function supportsExplorerNativeIntegration(path: string): boolean
⋮----
export function supportsExplorerNativeDragOut(paths: string[]): boolean
⋮----
export async function listCloudAccounts(): Promise<ExplorerCloudAccountsSnapshot>
⋮----
export async function setCloudProviderConfiguration(
  provider: ExplorerCloudProviderId,
  clientId: string,
  clientSecret: string | null,
): Promise<ExplorerCloudProviderConfigurationStatus>
⋮----
export async function clearCloudProviderConfiguration(
  provider: ExplorerCloudProviderId,
): Promise<ExplorerCloudProviderConfigurationStatus>
⋮----
export async function beginCloudAuth(provider: ExplorerCloudProviderId): Promise<ExplorerCloudAuthSession>
⋮----
export async function pollCloudAuth(requestId: string): Promise<ExplorerCloudAuthStatus>
⋮----
export async function disconnectCloudAccount(accountId: string): Promise<void>
⋮----
export async function registerExplorerTerminalShellIntegration(
  request: ExplorerTerminalShellIntegrationInput,
): Promise<ExplorerTerminalShellIntegration>
⋮----
export async function syncExplorerTerminalCwd(
  id: string,
  cwd: string,
): Promise<ExplorerTerminalShellIntegration>
⋮----
export async function setExplorerTerminalPromptState(
  id: string,
  atPrompt: boolean,
  reportedCwd: string | null = null,
): Promise<ExplorerTerminalShellIntegration>
⋮----
export async function listenToExplorerTaskProgress(
  listener: (event: ExplorerTaskProgress) => void,
): Promise<() => void>
⋮----
function getSchedulerTaskProgressPercent(task: ExplorerSchedulerTask): number | null
⋮----
function didSchedulerTaskFail(task: ExplorerSchedulerTask): boolean
⋮----
function isSchedulerTaskFinished(task: ExplorerSchedulerTask): boolean
⋮----
export function getExplorerTaskProgressPercent(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): number | null
⋮----
export function didExplorerTaskFail(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): boolean
⋮----
export function isExplorerTaskFinished(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): boolean
⋮----
export function getExplorerTaskStatusLabel(task: ExplorerTaskSnapshot | ExplorerSchedulerTask): string
````

## File: runtime/fileOperationsWindow.ts
````typescript
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type {
  ExplorerFileTransferOperation,
  ExplorerFileTransferResult,
} from './explorerBackend';
⋮----
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
⋮----
getItem(key: string): string | null;
setItem(key: string, value: string): void;
⋮----
interface BrowserEventTargetLike {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  dispatchEvent(event: Event): boolean;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}
⋮----
addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
dispatchEvent(event: Event): boolean;
removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
⋮----
export interface FileOperationsTaskWindowRequest {
  nonce: string;
  requestedAt: number;
  sourceWindowLabel: string | null;
  view: 'tasks';
}
⋮----
export interface FileOperationsTransferWindowRequest {
  nonce: string;
  operation: ExplorerFileTransferOperation;
  requestedAt: number;
  sourcePaths: string[];
  sourceWindowLabel: string | null;
  suggestedTargetDir: string | null;
  view: 'transfer';
}
⋮----
export type FileOperationsWindowRequest =
  | FileOperationsTaskWindowRequest
  | FileOperationsTransferWindowRequest;
⋮----
export interface FileOperationsTransferCompletedEventDetail {
  completedAt: number;
  destinationPaths: string[];
  nonce: string;
  operation: ExplorerFileTransferOperation;
  results: ExplorerFileTransferResult[];
  sourcePaths: string[];
  targetDir: string;
}
⋮----
export function isCurrentFileOperationsWindow(): boolean
⋮----
export function describeFileOperationsWindowRequest(
  request: FileOperationsWindowRequest | null | undefined,
): string
⋮----
export function createFileOperationsWindowRequest(
  value: {
    operation?: ExplorerFileTransferOperation;
    sourcePaths?: string[];
    suggestedTargetDir?: string | null;
    view: 'tasks' | 'transfer';
  },
): FileOperationsWindowRequest | null
⋮----
export function readFileOperationsWindowRequest(
  storage?: StorageLike | null,
): FileOperationsWindowRequest | null
⋮----
export function readFileOperationsTransferCompletedEvent(
  storage?: StorageLike | null,
): FileOperationsTransferCompletedEventDetail | null
⋮----
export async function openFileOperationsWindow(
  value: {
    operation?: ExplorerFileTransferOperation;
    sourcePaths?: string[];
    suggestedTargetDir?: string | null;
    view: 'tasks' | 'transfer';
  },
): Promise<FileOperationsWindowRequest | null>
⋮----
export async function publishFileOperationsTransferCompleted(
  value: {
    operation: ExplorerFileTransferOperation;
    results: ExplorerFileTransferResult[];
    sourcePaths: string[];
    targetDir: string;
  },
): Promise<FileOperationsTransferCompletedEventDetail | null>
⋮----
export function listenToFileOperationsWindowRequests(
  listener: (request: FileOperationsWindowRequest) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void
⋮----
export function listenToFileOperationsTransferCompleted(
  listener: (detail: FileOperationsTransferCompletedEventDetail) => void,
  options?: {
    storage?: StorageLike | null;
    target?: BrowserEventTargetLike | null;
  },
): () => void
⋮----
function createFileOperationsTransferCompletedEvent(value: {
  operation: ExplorerFileTransferOperation;
  results: ExplorerFileTransferResult[];
  sourcePaths: string[];
  targetDir: string;
}): FileOperationsTransferCompletedEventDetail | null
⋮----
function parseFileOperationsWindowRequest(value: unknown): FileOperationsWindowRequest | null
⋮----
function parseFileOperationsTransferCompletedEvent(
  value: unknown,
): FileOperationsTransferCompletedEventDetail | null
⋮----
function isExplorerFileTransferResult(value: unknown): value is ExplorerFileTransferResult
⋮----
function registerCrossWindowListener<T>(args: {
  eventName: string;
listener: (value: T)
⋮----
const handleBrowserEvent = (event: Event) =>
const handleStorageEvent = (event: Event) =>
⋮----
// Ignore malformed cross-window payloads.
⋮----
async function broadcastWindowEvent<T>(eventName: string, payload: T): Promise<void>
⋮----
// Browser and non-window test environments fall back to local dispatch only.
⋮----
function dispatchBrowserCustomEvent<T>(eventName: string, detail: T): void
⋮----
function getBrowserLocalStorage(): StorageLike | null
⋮----
function getBrowserWindow(): BrowserEventTargetLike | null
⋮----
function getCurrentWindowLabel(): string | null
⋮----
function getCurrentWindowUrl(): string
⋮----
async function invokeOptionalWindowMethod(
  windowHandle: object,
  methodName: 'setFocus' | 'show',
): Promise<void>
⋮----
// Best-effort only. Window restoration should not surface as an unhandled rejection.
⋮----
function normalizeOptionalPath(value: unknown): string | null
⋮----
function persistJsonValue(key: string, value: unknown): void
⋮----
// Persisting the latest window payload is best-effort only.
````

## File: runtime/filesystemAquariumBridge.ts
````typescript
export interface FilesystemAquariumOpenRequest {
  path: string;
  requestedAt: number;
  nonce: string;
  source: 'explorer';
}
⋮----
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
⋮----
getItem(key: string): string | null;
setItem(key: string, value: string): void;
⋮----
export function createFilesystemAquariumOpenRequest(path: string): FilesystemAquariumOpenRequest
⋮----
export function readFilesystemAquariumOpenRequest(
  storage?: StorageLike | null,
): FilesystemAquariumOpenRequest | null
⋮----
export function requestFilesystemAquariumOpen(
  path: string,
  options?: {
    storage?: StorageLike | null;
    target?: Pick<Window, 'dispatchEvent'> | null;
  },
): FilesystemAquariumOpenRequest | null
⋮----
// Persisting the last request is best-effort only.
⋮----
function getBrowserLocalStorage(): StorageLike | null
⋮----
function getBrowserWindow(): Window | null
````

## File: runtime/globalErrorPanel.ts
````typescript
interface GlobalErrorPanelRecord {
  title: string;
  detail: string;
  count: number;
  updatedAt: string;
}
⋮----
function ensureHost(): HTMLDivElement
⋮----
function createButton(label: string): HTMLButtonElement
⋮----
function renderPanel(host: HTMLDivElement, record: GlobalErrorPanelRecord): void
⋮----
function formatTimestamp(date: Date): string
⋮----
function formatObjectDetail(value: Record<string, unknown>): string
⋮----
export function formatGlobalErrorDetail(value: unknown): string
⋮----
export function reportGlobalError(title: string, detail: string): void
⋮----
export function resetGlobalErrorPanel(): void
````

## File: runtime/imageEditorRuntime.ts
````typescript
import type {
  ExplorerImageEditorHandle,
  ExplorerImageEditorOptions,
} from '@img-editor-runtime';
⋮----
export async function initExplorerImageEditor(
  containerId: string,
  options: ExplorerImageEditorOptions = {},
): Promise<ExplorerImageEditorHandle>
````

## File: runtime/moduleRuntime.ts
````typescript
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  executeRuntimeModuleGraph,
  isSupportedRuntimeFile,
  transpileRuntimeModuleGraphLocal,
  transpileRuntimeModuleSourceLocal,
  unwrapRuntimeModuleExport,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleResolveArgs,
  type RuntimeRelativeModuleSourceResolver,
  type RuntimeResolvedRelativeModuleSource,
} from './moduleRuntimeCore';
import { runFrontendWorkerTask } from './workerHost';
⋮----
export async function transpileRuntimeModuleSource(
  source: string,
  prependCode = '',
): Promise<string>
⋮----
export async function transpileRuntimeModuleGraph(args: {
  entryModulePath: string;
  entrySource: string;
  prependCode?: string;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}): Promise<RuntimeModuleGraph>
````

## File: runtime/moduleRuntime.worker.ts
````typescript
import { transpileRuntimeModuleSourceLocal } from './moduleRuntimeCore';
⋮----
interface WorkerRequestEnvelope {
  kind: 'request';
  requestId: number;
  taskType: string;
  payload: unknown;
}
⋮----
interface WorkerResponseEnvelope {
  kind: 'response';
  requestId: number;
  success: boolean;
  payload?: unknown;
  error?: string;
}
⋮----
interface TranspileRuntimeModuleSourceTask {
  source: string;
  prependCode?: string;
}
⋮----
function isTranspileRuntimeModuleSourceTask(value: unknown): value is TranspileRuntimeModuleSourceTask
⋮----
async function handleRequest(message: WorkerRequestEnvelope): Promise<WorkerResponseEnvelope>
````

## File: runtime/moduleRuntimeCore.ts
````typescript
export interface RuntimeFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  extension: string;
}
⋮----
export interface RuntimeRelativeModuleResolveArgs {
  fromModulePath: string;
  specifier: string;
}
⋮----
export interface RuntimeResolvedRelativeModuleSource {
  modulePath: string;
  source: string;
}
⋮----
export type RuntimeRelativeModuleSourceResolver = (
  args: RuntimeRelativeModuleResolveArgs,
) => Promise<RuntimeResolvedRelativeModuleSource | null>;
⋮----
export interface RuntimeModuleGraph {
  entryModulePath: string;
  moduleCodeByPath: Record<string, string>;
  relativeSpecifierResolutionsByModulePath: Record<string, Record<string, string>>;
}
⋮----
export type RuntimeModuleSourceTranspiler = (
  source: string,
  prependCode: string,
) => Promise<string>;
⋮----
function loadTypeScriptModule(): Promise<typeof import('typescript')>
⋮----
export function isSupportedRuntimeFile(
  entry: RuntimeFileEntry,
  extensions: readonly string[],
): boolean
⋮----
export function deriveRuntimeModuleId(name: string, fallback = 'module'): string
⋮----
export function deriveRuntimeModuleName(name: string, fallback = 'Module'): string
⋮----
export async function transpileRuntimeModuleSourceLocal(
  source: string,
  prependCode = '',
): Promise<string>
⋮----
function extractRuntimeRequireSpecifiers(code: string): string[]
⋮----
function isRelativeRuntimeSpecifier(specifier: string): boolean
⋮----
export async function transpileRuntimeModuleGraphLocal(args: {
  entryModulePath: string;
  entrySource: string;
  prependCode?: string;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
  transpileModuleSource?: RuntimeModuleSourceTranspiler;
}): Promise<RuntimeModuleGraph>
⋮----
const compileModule = async (modulePath: string, source: string): Promise<void> =>
⋮----
export function executeRuntimeModule(
  code: string,
  allowedModules: Record<string, unknown>,
): unknown
⋮----
const require = (specifier: string) =>
⋮----
export function executeRuntimeModuleGraph(
  graph: RuntimeModuleGraph,
  allowedModules: Record<string, unknown>,
): unknown
⋮----
const executeModuleByPath = (modulePath: string): unknown =>
⋮----
export function unwrapRuntimeModuleExport(
  exported: unknown,
  preferredKeys: string[] = [],
): unknown
````

## File: runtime/overlayRuntimeUtils.ts
````typescript
import type { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
import type { CSSProperties } from 'react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { clampOverlayVisualControlValue, overlayVisualControls } from '../config/overlayWindow';
⋮----
export interface PanelWindowLayout {
  width: number;
  height: number;
  x: number;
  y: number;
  healedWidth: number | null;
  healedHeight: number | null;
}
⋮----
export function parseExternalArgs(raw: string): string[]
⋮----
export function getParentPath(path: string, separator: string): string
⋮----
export async function ensureDir(path: string): Promise<void>
⋮----
export function computePanelWindowLayout(args: {
  workArea: { position: PhysicalPosition; size: PhysicalSize };
  scaleFactor: number;
  windowedWidth: number;
  windowedHeight: number;
}): PanelWindowLayout
⋮----
function getThemeVisualAnimation(layer: NonNullable<ResolvedOverlayAppearance['theme']['visuals']>[number]): string | undefined
⋮----
export function buildThemeVisualStyle(
  layer: NonNullable<ResolvedOverlayAppearance['theme']['visuals']>[number],
): CSSProperties
⋮----
export function resolveShellBackgroundColor(
  translucentColor: string,
  solidColor: string,
  blurStrength: number,
  parseColor: (color: string) => { alpha: number } | null,
  withColorAlpha: (color: string, alpha: number) => string,
): string
````

## File: runtime/pluginPanelRequests.ts
````typescript
export interface PluginPanelOpenRequest {
  panelId: string;
  payload: Record<string, string>;
  requestedAt: number;
  nonce: string;
  source: 'plugin-context-menu' | 'plugin-runtime' | 'host';
}
⋮----
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
⋮----
getItem(key: string): string | null;
setItem(key: string, value: string): void;
⋮----
export function getPluginPanelOpenRequestStorageKey(panelId: string): string
⋮----
export function getPluginPanelOpenRequestEvent(panelId: string): string
⋮----
export function createPluginPanelOpenRequest(
  panelId: string,
  payload: Record<string, string>,
  source: PluginPanelOpenRequest['source'] = 'host',
): PluginPanelOpenRequest | null
⋮----
export function readPluginPanelOpenRequest(
  panelId: string,
  storage?: StorageLike | null,
): PluginPanelOpenRequest | null
⋮----
export function requestPluginPanelOpen(
  panelId: string,
  payload: Record<string, string>,
  options?: {
    storage?: StorageLike | null;
    source?: PluginPanelOpenRequest['source'];
    target?: Pick<Window, 'dispatchEvent'> | null;
  },
): PluginPanelOpenRequest | null
⋮----
// Persisting the last request is best-effort only.
⋮----
function asStringRecord(value: unknown): Record<string, string>
⋮----
function normalizePluginPanelPayload(payload: Record<string, string>): Record<string, string>
⋮----
function getBrowserLocalStorage(): StorageLike | null
⋮----
function getBrowserWindow(): Window | null
````

## File: runtime/tauriClient.ts
````typescript
import { invoke } from '@tauri-apps/api/core';
⋮----
import type { Result } from '../generated/tauri';
⋮----
export interface WaylandDockHostStatus {
  enabled: boolean;
  windowLabel: string | null;
}
⋮----
export type WaylandDockAnchor = 'top' | 'bottom';
⋮----
export function unwrapTauriResult<T>(result: Result<T, string>): T
````

## File: runtime/themeEngineBackend.ts
````typescript
import { commands } from './tauriClient';
import type {
  ThemeAnimationProfile,
  ThemeCompatibility,
  ThemeDesignToken,
  ThemeIconPackManifest,
  ThemeLayoutPrimitive,
  ThemeManifest,
  ThemeNavigationPattern,
  ThemePresentation,
  ThemeRenderStyleManifest,
  WorkbenchPreset,
} from '../generated/tauri';
⋮----
export type ExplorerThemeManifest = ThemeManifest;
export type ExplorerThemePresentation = ThemePresentation;
export type ExplorerThemeCompatibility = ThemeCompatibility;
export type ExplorerThemeDesignToken = ThemeDesignToken;
export type ExplorerThemeLayoutPrimitive = ThemeLayoutPrimitive;
export type ExplorerThemeNavigationPattern = ThemeNavigationPattern;
export type ExplorerThemeAnimationProfile = ThemeAnimationProfile;
export type ExplorerThemeIconPackManifest = ThemeIconPackManifest;
export type ExplorerThemeRenderStyleManifest = ThemeRenderStyleManifest;
export type ExplorerWorkbenchPreset = WorkbenchPreset;
⋮----
type ExplorerThemeRenderStyleDraft = Pick<
  ExplorerThemeRenderStyleManifest,
  'id' | 'label' | 'kind' | 'entryModule' | 'supportsLiveSwap'
> & Partial<Pick<ExplorerThemeRenderStyleManifest, 'description'>>;
⋮----
type ExplorerThemeManifestDraft = Omit<
  Partial<ExplorerThemeManifest>,
  | 'presentation'
  | 'compatibility'
  | 'designTokens'
  | 'layoutPrimitives'
  | 'navigationPatterns'
  | 'animationProfiles'
  | 'iconPacks'
  | 'renderStyles'
> & Pick<ExplorerThemeManifest, 'id' | 'name'> & {
  presentation?: Partial<ExplorerThemePresentation>;
  compatibility?: {
    shellBlueprints?: readonly unknown[];
    tags?: readonly unknown[];
  };
  designTokens?: readonly ExplorerThemeDesignToken[];
  layoutPrimitives?: readonly ExplorerThemeLayoutPrimitive[];
  navigationPatterns?: readonly ExplorerThemeNavigationPattern[];
  animationProfiles?: readonly ExplorerThemeAnimationProfile[];
  iconPacks?: readonly ExplorerThemeIconPackManifest[];
  renderStyles?: readonly ExplorerThemeRenderStyleDraft[];
};
⋮----
export interface CompiledThemeEngineManifest {
  manifest: ExplorerThemeManifest;
  designTokenLookup: Record<string, ExplorerThemeDesignToken>;
  layoutPrimitiveLookup: Record<string, ExplorerThemeLayoutPrimitive>;
  navigationPatternLookup: Record<string, ExplorerThemeNavigationPattern>;
  animationProfileLookup: Record<string, ExplorerThemeAnimationProfile>;
  iconPackLookup: Record<string, ExplorerThemeIconPackManifest>;
  renderStyleLookup: Record<string, ExplorerThemeRenderStyleManifest>;
  defaultDesignToken: ExplorerThemeDesignToken | null;
  defaultLayoutPrimitive: ExplorerThemeLayoutPrimitive | null;
  defaultNavigationPattern: ExplorerThemeNavigationPattern | null;
  defaultAnimationProfile: ExplorerThemeAnimationProfile | null;
  defaultIconPack: ExplorerThemeIconPackManifest | null;
  defaultRenderStyle: ExplorerThemeRenderStyleManifest | null;
  capabilitySummary: {
    designTokens: number;
    layoutPrimitives: number;
    navigationPatterns: number;
    animationProfiles: number;
    iconPacks: number;
    renderStyles: number;
  };
  supportsHotSwappingRenderStyles: boolean;
}
⋮----
export interface ThemeEngineCatalog {
  manifests: ExplorerThemeManifest[];
  presets: ExplorerWorkbenchPreset[];
}
⋮----
export async function listThemeEngineCatalog(): Promise<ThemeEngineCatalog>
⋮----
function createLookup<T extends
⋮----
function pickDefault<T extends { id: string }>(
  entries: readonly T[],
  lookup: Record<string, T>,
  preferredId?: string | null,
): T | null
⋮----
export function compileThemeEngineManifest(manifestInput: ExplorerThemeManifestDraft): CompiledThemeEngineManifest
⋮----
export function normalizeThemeManifestDraft(
  draft: ExplorerThemeManifestDraft,
): ExplorerThemeManifest
````

## File: runtime/useFolderPluginRuntime.ts
````typescript
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
⋮----
import { convertFileSrc } from '@tauri-apps/api/core';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  getPluginStorageDirectory,
  pluginSystemConfig,
  shouldRefreshForPluginWatchPaths,
} from '../config/plugins';
⋮----
import {
  isFrontendPluginFile,
  type LoadedOverlayPlugin,
  type OverlayPluginApi,
  type OverlayPluginContext,
} from '../components/pluginRuntime';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from '../config/pluginContributions';
import type { LoadedOverlayShader } from '../components/shaderRuntime';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import { getPlatformPathSeparator, joinPlatformPath, type RuntimePlatform } from '../config/platform';
import type { OverlayRegisteredFontContribution } from '../config/appearance';
⋮----
import type { PluginDirectoryWatchEvent } from '../generated/tauri';
import { ensureDir, getParentPath } from './overlayRuntimeUtils';
import { commands, unwrapTauriResult } from './tauriClient';
⋮----
export interface UseFolderPluginRuntimeResult {
  folderPlugins: LoadedOverlayPlugin[];
  pluginContributedShaders: LoadedOverlayShader[];
  pluginThemePackages: LoadedOverlayThemePackage[];
  pluginFonts: OverlayRegisteredFontContribution[];
  pluginCommands: OverlayPluginCommandContribution[];
  pluginExplorerActions: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems: OverlayPluginContextMenuContribution[];
  folderPluginsError: string | null;
  folderPluginsLoading: boolean;
  openPluginsFolder: () => Promise<void>;
  refreshFolderPlugins: (force?: boolean) => Promise<void>;
  createPluginApi: (plugin: OverlayPluginContext) => OverlayPluginApi;
}
⋮----
export interface UseFolderPluginRuntimeOptions {
  liveReloadEnabled?: boolean;
}
⋮----
export function useFolderPluginRuntime(
  runtimePlatform: RuntimePlatform,
  options: UseFolderPluginRuntimeOptions = {},
): UseFolderPluginRuntimeResult
⋮----
const resolveAssetPath = (relativePath: string) =>
const resolveAssetUrl = (relativePath: string) =>
const resolveStoragePath = (relativePath?: string) =>
const ensureStorageDir = async (relativePath?: string) =>
⋮----
const clearFallbackPolling = () =>
⋮----
const queueFallbackPollingTick = () =>
⋮----
const startFallbackPolling = () =>
⋮----
const cleanupPluginWatcher = async () =>
⋮----
const startPluginWatcher = async () =>
````

## File: runtime/videoEditorBackend.ts
````typescript
import {
  type ResolvedVideoPreviewSource,
  type VideoTrimExportRequest,
  type VideoTrimExportResult,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';
⋮----
export type ExplorerVideoPreviewSource = ResolvedVideoPreviewSource;
export type ExplorerVideoTrimExportInput = VideoTrimExportRequest;
export type ExplorerVideoTrimExportOutput = VideoTrimExportResult;
⋮----
export async function createExplorerVideoPreviewProxy(
  inputPath: string,
): Promise<ExplorerVideoPreviewSource>
⋮----
export async function resolveExplorerVideoPreviewSource(
  inputPath: string,
): Promise<ExplorerVideoPreviewSource>
⋮----
export async function exportExplorerVideoTrim(
  request: ExplorerVideoTrimExportInput,
): Promise<ExplorerVideoTrimExportOutput>
````

## File: runtime/windowHost.ts
````typescript
import { isTauri } from '@tauri-apps/api/core';
import { WebviewWindow, getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { TerminalWindowMode } from '../store/settingsStore';
⋮----
export type WindowHostRole = typeof MAIN_WINDOW_HOST_LABEL | typeof DOCK_WINDOW_HOST_LABEL | 'unknown';
⋮----
export function normalizeWindowHostRole(label: string | null | undefined): WindowHostRole
⋮----
export function getCurrentWindowHostRole(): WindowHostRole
⋮----
export function hasSeparateWaylandDockHost(args: {
  runtimePlatform: string;
  linuxDisplayServer: 'unknown' | 'wayland' | 'x11';
  waylandDockHostEnabled: boolean;
}): boolean
⋮----
export function resolvePresentationHostLabel(args: {
  windowMode: TerminalWindowMode;
  useSeparateWaylandDockHost: boolean;
}): typeof MAIN_WINDOW_HOST_LABEL | typeof DOCK_WINDOW_HOST_LABEL
⋮----
export function isWindowHostResponsibleForMode(args: {
  hostRole: WindowHostRole;
  windowMode: TerminalWindowMode;
  useSeparateWaylandDockHost: boolean;
}): boolean
⋮----
export function shouldRegisterGlobalShortcutForHost(hostRole: WindowHostRole): boolean
⋮----
export async function emitWindowEventToHost<TPayload>(
  label: typeof MAIN_WINDOW_HOST_LABEL | typeof DOCK_WINDOW_HOST_LABEL,
  eventName: string,
  payload?: TPayload,
): Promise<boolean>
````

## File: runtime/workerHost.ts
````typescript
export type FrontendWorkerLaneId = 'runtime-module';
⋮----
export interface FrontendWorkerLaneTelemetry {
  activeTaskCount: number;
  completedTaskCount: number;
  errorCount: number;
  fallbackCount: number;
  lastDurationMs: number | null;
  lastError: string | null;
  workerAvailable: boolean;
}
⋮----
export interface FrontendWorkerTelemetrySnapshot {
  lanes: Record<FrontendWorkerLaneId, FrontendWorkerLaneTelemetry>;
}
⋮----
interface WorkerRequestEnvelope {
  kind: 'request';
  requestId: number;
  taskType: string;
  payload: unknown;
}
⋮----
interface WorkerResponseEnvelope {
  kind: 'response';
  requestId: number;
  success: boolean;
  payload?: unknown;
  error?: string;
}
⋮----
interface PendingWorkerTask {
  startedAt: number;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}
⋮----
interface WorkerLaneDefinition {
  createWorker: () => Worker;
}
⋮----
function createEmptyLaneTelemetry(): FrontendWorkerLaneTelemetry
⋮----
function getPerformanceNow(): number
⋮----
function isWorkerRuntimeDisabled(): boolean
⋮----
function updateLaneTelemetry(
  laneId: FrontendWorkerLaneId,
  updater: (current: FrontendWorkerLaneTelemetry) => FrontendWorkerLaneTelemetry,
): void
⋮----
class WorkerLaneRuntime
⋮----
constructor(
    private readonly laneId: FrontendWorkerLaneId,
    definition: WorkerLaneDefinition,
)
⋮----
async runTask<Result>(taskType: string, payload: unknown, fallback: () => Promise<Result>): Promise<Result>
⋮----
private getOrCreateWorker(): Worker | null
⋮----
private async runFallbackTask<Result>(fallback: () => Promise<Result>, error: unknown): Promise<Result>
⋮----
export async function runFrontendWorkerTask<Result>(args: {
  laneId: FrontendWorkerLaneId;
  taskType: string;
  payload: unknown;
fallback: ()
⋮----
export function readFrontendWorkerTelemetrySnapshot(): FrontendWorkerTelemetrySnapshot
⋮----
export function subscribeFrontendWorkerTelemetry(
  listener: (snapshot: FrontendWorkerTelemetrySnapshot) => void,
): () => void
⋮----
export function resetFrontendWorkerTelemetryForTests(): void
````

## File: store/audioEngineStore.ts
````typescript
import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import type {
  ExplorerAudioDeckId,
  ExplorerAudioDeckState,
  ExplorerAudioEngineStateSnapshot,
} from '../runtime/audioWorkbenchBackend';
import {
  getExplorerAudioEngineState,
  listenToExplorerAudioEngineState,
  pauseExplorerAudioDeck,
  playExplorerAudioDeck,
  prepareExplorerAudioEngine,
  seekExplorerAudioDeck,
  setExplorerArmedAudioDeck,
  setExplorerAudioDeckGain,
  setExplorerAudioDeckRate,
  setExplorerAudioLoopRegion,
  stopExplorerAudioDeck,
  syncExplorerSelectionToArmedDeck,
  unloadExplorerAudioDeck,
  loadExplorerAudioDeck,
} from '../runtime/audioWorkbenchBackend';
⋮----
type AudioEngineStoreStatus = 'idle' | 'loading' | 'ready' | 'error';
⋮----
interface AudioEngineStoreState {
  snapshot: ExplorerAudioEngineStateSnapshot;
  hydrationState: AudioEngineStoreStatus;
  hydrationError: string | null;
  subscriptionState: AudioEngineStoreStatus;
  subscriptionError: string | null;
  replaceSnapshot: (snapshot: ExplorerAudioEngineStateSnapshot) => void;
  setHydrationState: (state: AudioEngineStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
  setSubscriptionState: (state: AudioEngineStoreStatus) => void;
  setSubscriptionError: (message: string | null) => void;
}
⋮----
const EMPTY_DECK_STATE = (deckId: ExplorerAudioDeckId): ExplorerAudioDeckState => (
⋮----
async function ensureAudioEngineHydration(): Promise<void>
⋮----
async function ensureAudioEngineSubscription(): Promise<void>
⋮----
async function ensureAudioEngineFeed(): Promise<void>
⋮----
export function useAudioEngineFeed(): void
⋮----
export function useAudioEngineSnapshot(): ExplorerAudioEngineStateSnapshot
⋮----
export function getAudioDeckState(
  snapshot: ExplorerAudioEngineStateSnapshot,
  deckId: ExplorerAudioDeckId,
): ExplorerAudioDeckState
⋮----
function commitAudioSnapshot(snapshot: ExplorerAudioEngineStateSnapshot): ExplorerAudioEngineStateSnapshot
⋮----
export async function armAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function loadSelectionIntoAudioDeck(
  deckId: ExplorerAudioDeckId,
  inputPath: string,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function syncSelectionIntoArmedAudioDeck(
  inputPath: string,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function playAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function pauseAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function stopAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function unloadAudioDeck(deckId: ExplorerAudioDeckId): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function seekAudioDeck(
  deckId: ExplorerAudioDeckId,
  positionSeconds: number,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setAudioDeckLoopRegion(
  deckId: ExplorerAudioDeckId,
  startSeconds: number,
  endSeconds: number,
  enabled: boolean,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setAudioDeckGain(
  deckId: ExplorerAudioDeckId,
  gainLinear: number,
): Promise<ExplorerAudioEngineStateSnapshot>
⋮----
export async function setAudioDeckRate(
  deckId: ExplorerAudioDeckId,
  rate: number,
): Promise<ExplorerAudioEngineStateSnapshot>
````

## File: store/explorerStore.ts
````typescript
import { create } from 'zustand';
import {
  createDefaultExplorerRailSnapshot,
  defaultExplorerRailSnapshot,
  migrateLegacyExplorerBookmarks,
  normalizeExplorerRailSnapshot,
  type ExplorerRailSnapshot,
} from '../components/explorer/explorerRailState';
import {
  getExplorerShellLayoutDefinition,
  type ExplorerShellLayoutId,
} from '../config/explorerShellLayouts';
import {
  clampExplorerWorkspaceAxisRatio,
  createEmptyExplorerPaneRecord,
  defaultExplorerWorkspaceAxisRatio,
  defaultExplorerWorkspaceLayoutMode,
  explorerPaneIds,
  getExplorerWorkspaceVisiblePaneIds,
  normalizeExplorerPaneId,
  normalizeExplorerWorkspaceLayoutMode,
  type ExplorerPaneId,
  type ExplorerWorkspaceLayoutMode,
} from '../config/explorerWorkspaceLayouts';
import {
  normalizeExplorerChromeLayoutId,
  normalizeExplorerChromeOverrideSnapshot,
  type ExplorerChromeControlId,
  type ExplorerChromeLayoutId,
  type ExplorerChromeOverrideSnapshot,
  type ExplorerChromeResolvedSurface,
  type ExplorerChromeSurfaceId,
} from '../config/explorerChromeLayouts';
⋮----
// Vitest runs in a browser-like environment; keep persistence synchronous so unit tests
// can assert immediately after calling store actions.
⋮----
export type ExplorerDocumentViewMode = 'edit' | 'preview';
export type ExplorerInstanceId = string;
export type ExplorerClipboardAction = 'copy' | 'cut';
⋮----
export interface ExplorerClipboardEntry {
  path: string;
  name: string;
  is_dir: boolean;
}
⋮----
export interface ExplorerClipboardSnapshot {
  action: ExplorerClipboardAction;
  entries: ExplorerClipboardEntry[];
}
⋮----
export interface ExplorerTabSnapshot {
  id: string;
  instanceId: ExplorerInstanceId;
  pane: ExplorerPaneId;
  title: string;
}
⋮----
export interface ExplorerWorkspaceSnapshot {
  tabs: ExplorerTabSnapshot[];
  activeTabIdByPane: Record<ExplorerPaneId, string | null>;
  layoutMode: ExplorerWorkspaceLayoutMode;
  focusedPane: ExplorerPaneId;
  columnSplitRatio: number;
  rowSplitRatio: number;
  nextTabOrdinal: number;
}
⋮----
export interface ExplorerSessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
  sidebarWidth: number | null;
  previewWidth: number | null;
  previewEnabled: boolean;
  shellLayoutId: ExplorerShellLayoutId;
  search: string;
  searchIncludeContent: boolean;
  documentViewMode: ExplorerDocumentViewMode;
  sourcesVisible: boolean;
  sourcesRailPinnedOpen: boolean;
}
⋮----
export type ExplorerPropertiesPanelTab = 'info' | 'permissions' | 'checksums';
⋮----
export interface ExplorerJumpFilterSnapshot {
  active: boolean;
  query: string;
  resultIndex: number;
  resultPaths: string[];
}
⋮----
export interface ExplorerPropertiesPanelSnapshot {
  loading: boolean;
  targetPaths: string[];
  tab: ExplorerPropertiesPanelTab;
  visible: boolean;
}
⋮----
export interface ExplorerPendingTerminalCwdSync {
  path: string;
  shell: string | null;
  source: 'navigation' | 'open-terminal';
  updatedAt: number;
}
⋮----
export interface ExplorerRecursiveSizeCacheEntry {
  bytes: number;
  fileCount: number;
  folderCount: number;
  pending: boolean;
  updatedAt: number;
}
⋮----
export interface ExplorerPersistenceNotice {
  status: 'ready' | 'legacy-imported' | 'backup-restored' | 'corrupted-reset' | 'restored-backup' | 'save-error';
  message: string | null;
  hasBackup: boolean;
}
⋮----
export interface ExplorerChromeEditSession {
  themeId: string;
  layoutId: ExplorerChromeLayoutId;
  draftOverride: ExplorerChromeOverrideSnapshot;
  draggingControlId: ExplorerChromeControlId | null;
  registeredSurfaces: Partial<Record<ExplorerChromeSurfaceId, ExplorerChromeResolvedSurface>>;
}
⋮----
function cloneExplorerSessionSnapshot(session: ExplorerSessionSnapshot): ExplorerSessionSnapshot
⋮----
function cloneExplorerTabSnapshot(tab: ExplorerTabSnapshot): ExplorerTabSnapshot
⋮----
function cloneExplorerWorkspaceSnapshot(
  workspace: ExplorerWorkspaceSnapshot,
): ExplorerWorkspaceSnapshot
⋮----
function createDefaultExplorerSessions(): Record<ExplorerInstanceId, ExplorerSessionSnapshot>
⋮----
function createDefaultExplorerWorkspace(): ExplorerWorkspaceSnapshot
⋮----
function getPrimaryExplorerSession(
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerSessionSnapshot
⋮----
export interface PersistedExplorerState {
  version: number;
  session?: ExplorerSessionSnapshot;
  sessions?: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
  workspace?: ExplorerWorkspaceSnapshot;
  rail: ExplorerRailSnapshot;
}
⋮----
interface ExplorerStoreState {
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
  session: ExplorerSessionSnapshot;
  workspace: ExplorerWorkspaceSnapshot;
  rail: ExplorerRailSnapshot;
  jumpFilter: ExplorerJumpFilterSnapshot;
  propertiesPanel: ExplorerPropertiesPanelSnapshot;
  pendingTerminalCwdSync: ExplorerPendingTerminalCwdSync | null;
  recursiveSizeCache: Record<string, ExplorerRecursiveSizeCacheEntry>;
  clipboard: ExplorerClipboardSnapshot | null;
  persistence: ExplorerPersistenceNotice;
  chromeEditSession: ExplorerChromeEditSession | null;
  getSession: (instanceId?: ExplorerInstanceId) => ExplorerSessionSnapshot;
  updateSession: (updates: Partial<ExplorerSessionSnapshot>) => void;
  updateSessionForInstance: (instanceId: ExplorerInstanceId, updates: Partial<ExplorerSessionSnapshot>) => void;
  resetSession: () => void;
  resetSessionForInstance: (instanceId: ExplorerInstanceId) => void;
  copySession: (sourceInstanceId: ExplorerInstanceId, targetInstanceId: ExplorerInstanceId) => void;
  createWorkspaceTab: (args?: {
    sourceInstanceId?: ExplorerInstanceId;
    pane?: ExplorerPaneId;
    title?: string;
    activate?: boolean;
  }) => ExplorerTabSnapshot;
  closeWorkspaceTab: (tabId: string) => void;
  focusWorkspaceTab: (tabId: string) => void;
  moveWorkspaceTabToPane: (tabId: string, pane: ExplorerPaneId) => void;
  updateWorkspaceTabTitle: (tabId: string, title: string) => void;
  setWorkspaceLayoutMode: (layoutMode: ExplorerWorkspaceLayoutMode) => void;
  setFocusedPane: (pane: ExplorerPaneId) => void;
  setWorkspaceColumnSplitRatio: (splitRatio: number) => void;
  setWorkspaceRowSplitRatio: (splitRatio: number) => void;
  setClipboard: (clipboard: ExplorerClipboardSnapshot | null) => void;
  updateRail: (updates: Partial<ExplorerRailSnapshot> | ((current: ExplorerRailSnapshot) => ExplorerRailSnapshot)) => void;
  replaceRail: (nextRail: ExplorerRailSnapshot) => void;
  restoreRailBackup: () => void;
  clearPersistenceNotice: () => void;
  setJumpFilter: (updates: Partial<ExplorerJumpFilterSnapshot> | null) => void;
  setPropertiesPanel: (updates: Partial<ExplorerPropertiesPanelSnapshot> | null) => void;
  setPendingTerminalCwdSync: (nextSync: ExplorerPendingTerminalCwdSync | null) => void;
  setRecursiveSizeCacheEntry: (path: string, entry: ExplorerRecursiveSizeCacheEntry | null) => void;
  openChromeEditSession: (args: {
    themeId: string;
    layoutId: ExplorerChromeLayoutId;
    initialOverride?: ExplorerChromeOverrideSnapshot | null;
  }) => void;
  updateChromeEditDraft: (draftOverride: ExplorerChromeOverrideSnapshot) => void;
  setChromeEditDraggingControl: (controlId: ExplorerChromeControlId | null) => void;
  registerChromeEditSurface: (surface: ExplorerChromeResolvedSurface) => void;
  unregisterChromeEditSurface: (surfaceId: ExplorerChromeSurfaceId) => void;
  closeChromeEditSession: () => void;
}
⋮----
interface ExplorerHydrationResult {
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>;
  session: ExplorerSessionSnapshot;
  workspace: ExplorerWorkspaceSnapshot;
  rail: ExplorerRailSnapshot;
  clipboard: ExplorerClipboardSnapshot | null;
  persistence: ExplorerPersistenceNotice;
}
⋮----
export function normalizeExplorerSessionSnapshot(value: unknown): ExplorerSessionSnapshot
⋮----
function normalizeExplorerSessionsSnapshot(
  value: unknown,
  legacyPrimarySession?: unknown,
): Record<ExplorerInstanceId, ExplorerSessionSnapshot>
⋮----
function createActiveWorkspaceTabRecord(): Record<ExplorerPaneId, string | null>
⋮----
function choosePaneForHiddenTab(
  tabsByPane: Record<ExplorerPaneId, ExplorerTabSnapshot[]>,
  visiblePaneIds: ExplorerPaneId[],
): ExplorerPaneId
⋮----
function normalizeExplorerWorkspaceSnapshot(
  value: unknown,
  sessions: Record<ExplorerInstanceId, ExplorerSessionSnapshot>,
): ExplorerWorkspaceSnapshot
⋮----
function chooseFocusedPaneAfterTabRemoval(args: {
  workspace: ExplorerWorkspaceSnapshot;
  nextTabs: ExplorerTabSnapshot[];
  nextActiveTabIdByPane: Record<ExplorerPaneId, string | null>;
  removedPane: ExplorerPaneId;
}): ExplorerPaneId
⋮----
export function loadExplorerPersistedState(storage: Storage | null = getStorage()): ExplorerHydrationResult
⋮----
// Ignore invalid legacy payloads. The new store can safely start empty.
⋮----
export function persistExplorerState(
  state: PersistedExplorerState,
  storage: Storage | null = getStorage(),
):
⋮----
const persistLatest = (successNotice?: Partial<ExplorerPersistenceNotice>) =>
⋮----
const persistLatestNow = (successNotice?: Partial<ExplorerPersistenceNotice>) =>
⋮----
const schedulePersistLatest = (successNotice?: Partial<ExplorerPersistenceNotice>) =>
⋮----
// Best-effort flush so the latest session isn't lost on close/navigation.
const installFlushListeners = () =>
⋮----
const flush = ()
⋮----
function loadExplorerBackup(storage: Storage | null = getStorage()): Omit<ExplorerHydrationResult, 'persistence'> | null
⋮----
function normalizeOptionalNumber(value: unknown): number | null
⋮----
function getStorage(): Storage | null
⋮----
function installExplorerStorageSync(): void
⋮----
function asRecord(value: unknown): Record<string, unknown> | null
````

## File: store/explorerTaskStore.ts
````typescript
import { isTauri } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  cancelExplorerTask,
  clearExplorerTaskHistory,
  listExplorerTasks,
  listenToExplorerTaskProgress,
  retryExplorerTask,
  type ExplorerTaskHistoryScope,
  type ExplorerTaskSnapshot,
} from '../runtime/explorerBackend';
⋮----
type ExplorerTaskStoreStatus = 'idle' | 'loading' | 'ready' | 'error';
⋮----
interface ExplorerTaskStoreState {
  tasks: Record<string, ExplorerTaskSnapshot>;
  taskOrder: string[];
  subscriptionState: ExplorerTaskStoreStatus;
  subscriptionError: string | null;
  hydrationState: ExplorerTaskStoreStatus;
  hydrationError: string | null;
  isTaskCenterOpen: boolean;
  replaceTasks: (tasks: ExplorerTaskSnapshot[]) => void;
  upsertTask: (task: ExplorerTaskSnapshot) => void;
  pruneTasks: (scope: ExplorerTaskHistoryScope) => void;
  setSubscriptionError: (message: string | null) => void;
  setSubscriptionState: (state: ExplorerTaskStoreStatus) => void;
  setHydrationError: (message: string | null) => void;
  setHydrationState: (state: ExplorerTaskStoreStatus) => void;
  setTaskCenterOpen: (open: boolean) => void;
}
⋮----
function sortExplorerTasks(tasks: ExplorerTaskSnapshot[]): ExplorerTaskSnapshot[]
⋮----
function normalizeTaskCollection(tasks: ExplorerTaskSnapshot[]): Pick<ExplorerTaskStoreState, 'tasks' | 'taskOrder'>
⋮----
function shouldPruneTask(task: ExplorerTaskSnapshot, scope: ExplorerTaskHistoryScope): boolean
⋮----
async function ensureExplorerTaskHydration(): Promise<void>
⋮----
async function ensureExplorerTaskProgressSubscription(): Promise<void>
⋮----
async function ensureExplorerTaskFeed(): Promise<void>
⋮----
export function useExplorerTaskProgressFeed(): void
⋮----
export function useExplorerTaskSnapshots(): ExplorerTaskSnapshot[]
⋮----
export function useExplorerTaskCenterOpen(): boolean
⋮----
export function openExplorerTaskCenter(): void
⋮----
export function closeExplorerTaskCenter(): void
⋮----
export function toggleExplorerTaskCenter(): void
⋮----
export async function retryExplorerTaskById(taskId: string): Promise<ExplorerTaskSnapshot>
⋮----
export async function cancelExplorerTaskById(taskId: string): Promise<ExplorerTaskSnapshot>
⋮----
export async function clearExplorerTaskHistoryInStore(scope: ExplorerTaskHistoryScope): Promise<void>
⋮----
export async function retryFailedExplorerTasks(): Promise<ExplorerTaskSnapshot[]>
⋮----
export async function clearCompletedExplorerTasks(): Promise<void>
````

## File: store/settingsStore.ts
````typescript
/**
 * Settings Store - Data-driven configuration system
 * NO HARDCODED PATHS - Everything configurable via JSON
 */
⋮----
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { normalizeThemeDefinition, type OverlayThemeDefinition } from '../config/appearance';
import {
  createDefaultFolderIconRules,
  DEFAULT_FOLDER_ICON_VALUE,
  type FolderIconRule,
  type FolderIconValue,
} from '../config/folderIcons';
import {
  getDefaultIntegratedShell,
  type ExternalTerminalProfile,
} from '../config/platform';
import {
  getExplorerGridZoomAnchor,
  isExplorerGridMode,
  normalizeExplorerGridZoom,
  normalizeExplorerViewMode,
  type ExplorerViewMode,
} from '../config/explorerViewModes';
import {
  DEFAULT_ADAPTIVE_SEMANTIC_DENSITY,
  normalizeAdaptiveSemanticDensity,
  normalizeExplorerExperimentalViewMode,
  type ExplorerExperimentalViewMode,
} from '../config/explorerExperimentalModes';
import {
  normalizeExplorerChromeLayoutId,
  normalizeExplorerChromeOverrideSnapshot,
  normalizeExplorerChromeOverrideSnapshotMap,
  type ExplorerChromeLayoutId,
  type ExplorerChromeOverrideSnapshot,
} from '../config/explorerChromeLayouts';
import {
  normalizeExplorerModeProfileId,
  type ExplorerModeProfileId,
} from '../config/explorerModeProfiles';
import {
  defaultExplorerThumbnailSettings,
  normalizeExplorerThumbnailSettings,
  type ExplorerThumbnailSettings,
} from '../config/explorerThumbnails';
import {
  normalizeExplorerContextMenuItemOverrideMap,
  type ExplorerContextMenuItemOverrideMap,
} from '../config/explorerContextMenu';
import {
  createDefaultKeybindingSettings,
  normalizeKeybindingSettings,
  type HotkeyBindingSettings,
} from '../config/hotkeys';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  type OverlayAnimationPresetId,
} from '../config/overlayAnimations';
import {
  clampOverlayVisualControlValue,
  overlayVisualControls,
  overlayWindowGeometry,
} from '../config/overlayWindow';
import {
  normalizeOverlayWallpaperFitMode,
  type OverlayWallpaperFitMode,
} from '../config/wallpapers';
import {
  isScreenshotCaptureModeId,
  isScreenshotOutputActionId,
  screenshotFeatureConfig,
  type ScreenshotCaptureModeId,
  type ScreenshotOutputActionId,
} from '../config/screenshots';
import { isLegacyScreenshotDirectory } from '../config/appContentDirectories';
import {
  DEFAULT_PILOT_ACCENT_COLOR,
  DEFAULT_PILOT_DARK_THEME_ID,
  DEFAULT_PILOT_LAYOUT_PROFILE_ID,
  DEFAULT_PILOT_UI_FONT_FAMILY,
  getThemeSelectionDefaults,
} from '../config/pilotThemeContract';
⋮----
// ============================================================================
// TYPES
// ============================================================================
⋮----
export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  cursorStyle: 'line' | 'block' | 'underline';
  autoSave: 'off' | 'afterDelay' | 'onFocusChange';
  autoSaveDelay: number;
  formatOnSave: boolean;
  formatOnPaste: boolean;
}
⋮----
export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  shell: string;
  showSidebar: boolean;
  cursorBlink: boolean;
  cursorStyle: 'bar' | 'block' | 'underline';
  scrollback: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: OverlayWindowAnchor;
  windowMode: TerminalWindowMode;
  windowedWidth: number;
  windowedHeight: number;
  preferredOpenMode: 'integrated' | 'external';
  externalTerminalProfile: ExternalTerminalProfile;
  externalTerminalCommand: string;
  externalTerminalArgs: string;
}
⋮----
export interface PythonSettings {
  preferredInterpreterPath: string;
  runtimeRoot: string;
  bootstrapPackages: string;
  autoUpgradePip: boolean;
  createBoilerplate: boolean;
}
⋮----
export type ExplorerFolderClickMode = 'single' | 'double';
⋮----
export interface ExplorerSettings {
  defaultPath: string;
  showHiddenFiles: boolean;
  sortBy: 'name' | 'size' | 'date' | 'type';
  sortOrder: 'asc' | 'desc';
  viewMode: ExplorerViewMode;
  gridZoom: number;
  experimentalViewMode: ExplorerExperimentalViewMode;
  experimentalDensity: number;
  folderClickMode: ExplorerFolderClickMode;
  confirmDelete: boolean;
  defaultFolderIcon: FolderIconValue;
  folderIconRules: FolderIconRule[];
  thumbnails: ExplorerThumbnailSettings;
  modeProfileOverridesByThemeId: Record<string, ExplorerModeProfileId>;
  chromeLayoutOverridesByThemeId: Record<string, Record<string, ExplorerChromeOverrideSnapshot>>;
  contextMenuItemOverrides: ExplorerContextMenuItemOverrideMap;
}
⋮----
export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  activeThemeId: string;
  dockThemeMode: DockThemeMode;
  activeDockThemeId: string | null;
  customThemes: OverlayThemeDefinition[];
  activeWallpaperId?: string | null;
  wallpaperFitMode: OverlayWallpaperFitMode;
  wallpaperOpacity: number;
  wallpaperMuted: boolean;
  activeShaderId?: string | null;
  shaderControlValues: Record<string, Record<string, number>>;
  uiFontFamily: string;
  useNativeOsIcons: boolean;
  accentColor: string;
  sidebarPosition: 'left' | 'right';
  activityBarPosition: 'side' | 'top';
  compactMode: boolean;
  animations: boolean;
  appOpacity: number;
  panelTransparency: number;
  appZoom: number;
  appBlur: boolean;
  appBlurStrength: number;
  appOpenAnimation: OverlayAnimationPresetId | null;
  appCloseAnimation: OverlayAnimationPresetId | null;
  appAnimationDurationMs: number;
  appAnimationIntensity: number;
}
⋮----
export interface SystemSettings {
  launchAtStartup: boolean;
  hideAppInTray: boolean;
  showInTaskbar: boolean;
  developerMode: boolean;
  devTelemetryHudVisible: boolean;
  linuxDisplayBackendPreference: LinuxDisplayBackendPreference;
}
⋮----
export interface ScreenshotSettings {
  saveDirectory: string;
  defaultCaptureMode: ScreenshotCaptureModeId;
  defaultOutputAction: ScreenshotOutputActionId;
  showGrid: boolean;
  closeEditorAfterAction: boolean;
}
⋮----
export type KeybindingSettings = HotkeyBindingSettings;
export type DockThemeMode = 'follow-app' | 'override';
export type LinuxDisplayBackendPreference = 'auto' | 'wayland' | 'x11';
⋮----
export interface PolyGeminiSettings {
  serverUrl: string;
  serverPort: number;
  autoStart: boolean;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}
⋮----
export type OverlayWindowAnchor = 'top' | 'bottom';
export type TerminalWindowMode = 'overlay' | 'windowed';
⋮----
export interface LayoutSettings {
  activeProfileId: string;
  configPath: string;
  panelStateByProfile: Record<string, LayoutPanelState>;
}
⋮----
export interface LayoutPanelState {
  openPanelIds: string[];
  activePanelId: string | null;
  dismissedPanelIds: string[];
}
⋮----
export interface Settings {
  editor: EditorSettings;
  terminal: TerminalSettings;
  python: PythonSettings;
  explorer: ExplorerSettings;
  appearance: AppearanceSettings;
  system: SystemSettings;
  screenshots: ScreenshotSettings;
  keybindings: KeybindingSettings;
  polygemini: PolyGeminiSettings;
  layout: LayoutSettings;
}
⋮----
type LegacyImportedTerminalSettings = Partial<TerminalSettings> & {
  colorTheme?: string;
  uiFont?: string;
};
⋮----
type LegacyImportedAppearanceSettings = Partial<AppearanceSettings> & {
  uiFont?: string;
};
⋮----
type LegacyImportedSettings = Partial<Settings> & {
  terminal?: LegacyImportedTerminalSettings;
  appearance?: LegacyImportedAppearanceSettings;
};
⋮----
// ============================================================================
// DEFAULTS
// ============================================================================
⋮----
const getDefaultPath = (): string =>
⋮----
// Return current working directory - will be set by Tauri on first load
// This is safer than guessing user paths
⋮----
export function normalizeOverlayWindowAnchor(value: unknown): OverlayWindowAnchor
⋮----
export function normalizeTerminalWindowMode(value: unknown): TerminalWindowMode
⋮----
export function normalizeDockThemeMode(value: unknown): DockThemeMode
⋮----
export function normalizeLinuxDisplayBackendPreference(value: unknown): LinuxDisplayBackendPreference
⋮----
export function normalizeExplorerFolderClickMode(value: unknown): ExplorerFolderClickMode
⋮----
function normalizeExplorerModeProfileOverrideMap(
  value: unknown,
): Record<string, ExplorerModeProfileId>
⋮----
function normalizeExplorerSettings(
  base: ExplorerSettings,
  updates?: Partial<ExplorerSettings>,
): ExplorerSettings
⋮----
function normalizeSavedWindowDimension(value: unknown, fallback: number, min: number): number
⋮----
function normalizeTerminalSettings(
  base: TerminalSettings,
  updates?: Partial<TerminalSettings>,
): TerminalSettings
⋮----
function createMemoryStorage(): Storage
⋮----
get length()
clear()
getItem(key: string)
key(index: number)
removeItem(key: string)
setItem(key: string, value: string)
⋮----
function isStorageLike(value: unknown): value is Storage
⋮----
function getSettingsStorage(): Storage
⋮----
export function normalizeSystemSettings(
  base: SystemSettings,
  updates?: Partial<SystemSettings>,
): SystemSettings
⋮----
// Keep at least one desktop entry point visible so the overlay is always recoverable.
⋮----
export interface SystemPresentationState {
  trayVisible: boolean;
  taskbarVisible: boolean;
  hasVisibleEntryPoint: boolean;
  recoveryPath: 'tray' | 'taskbar';
}
⋮----
export function resolveSystemPresentationState(system: SystemSettings): SystemPresentationState
⋮----
function normalizeAppearanceSettings(
  base: AppearanceSettings,
  updates?: Partial<AppearanceSettings>,
): AppearanceSettings
⋮----
function normalizeShaderControlValuesMap(
  value: unknown,
): Record<string, Record<string, number>>
⋮----
function normalizeScreenshotSettings(
  base: ScreenshotSettings,
  updates?: Partial<ScreenshotSettings>,
): ScreenshotSettings
⋮----
function normalizeLayoutPanelState(value: unknown): LayoutPanelState
⋮----
function normalizePanelStateByProfile(value: unknown): Record<string, LayoutPanelState>
⋮----
function mergeSettings(base: Settings, imported?: LegacyImportedSettings): Settings
⋮----
export function mergeSettingsWithDefaults(imported?: LegacyImportedSettings): Settings
⋮----
// ============================================================================
// STORE
// ============================================================================
⋮----
interface SettingsState {
  settings: Settings;
  isOpen: boolean;
  activeSection: string;
  
  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  setActiveSection: (section: string) => void;
  
  // Update settings
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateTerminal: (updates: Partial<TerminalSettings>) => void;
  updatePython: (updates: Partial<PythonSettings>) => void;
  updateExplorer: (updates: Partial<ExplorerSettings>) => void;
  setExplorerModeProfileOverride: (themeId: string, modeProfileId: ExplorerModeProfileId) => void;
  clearExplorerModeProfileOverride: (themeId: string) => void;
  setExplorerChromeLayoutOverride: (
    themeId: string,
    layoutId: ExplorerChromeLayoutId,
    snapshot: ExplorerChromeOverrideSnapshot,
  ) => void;
  clearExplorerChromeLayoutOverride: (
    themeId: string,
    layoutId: ExplorerChromeLayoutId,
  ) => void;
  updateAppearance: (updates: Partial<AppearanceSettings>) => void;
  applyThemeSelection: (
    themeId: string,
    options?: {
      forceManagedIcons?: boolean;
    },
  ) => void;
  applyDockThemeSelection: (themeId: string) => void;
  updateSystem: (updates: Partial<SystemSettings>) => void;
  updateScreenshots: (updates: Partial<ScreenshotSettings>) => void;
  updateKeybindings: (updates: Partial<KeybindingSettings>) => void;
  updatePolyGemini: (updates: Partial<PolyGeminiSettings>) => void;
  updateLayout: (updates: Partial<LayoutSettings>) => void;
  
  // Bulk operations
  resetToDefaults: () => void;
  importSettings: (settings: LegacyImportedSettings) => void;
  exportSettings: () => Settings;
}
⋮----
// Actions
⋮----
// Update settings
⋮----
// Bulk operations
⋮----
function installSettingsStorageSync(): void
````

## File: store/terminalStore.ts
````typescript
import { create } from 'zustand';
import { LazyStore } from '@tauri-apps/plugin-store';
import {
    createDefaultCommandBookmarks,
    createDefaultDirectoryBookmarks,
} from '../config/platform';
⋮----
export interface Bookmark {
    id: string;
    name: string;
    value: string; // The directory path or the execution command
}
⋮----
value: string; // The directory path or the execution command
⋮----
interface TerminalStoreState {
    isInitialized: boolean;
    directoryBookmarks: Bookmark[];
    commandBookmarks: Bookmark[];

    // Actions
    initStore: () => Promise<void>;

    // Directory Bookmarks
    addDirectoryBookmark: (bookmark: Bookmark) => Promise<void>;
    updateDirectoryBookmark: (bookmark: Bookmark) => Promise<void>;
    removeDirectoryBookmark: (id: string) => Promise<void>;

    // Command Bookmarks
    addCommandBookmark: (bookmark: Bookmark) => Promise<void>;
    updateCommandBookmark: (bookmark: Bookmark) => Promise<void>;
    removeCommandBookmark: (id: string) => Promise<void>;
}
⋮----
// Actions
⋮----
// Directory Bookmarks
⋮----
// Command Bookmarks
⋮----
// Initialize the Tauri Store on disk
⋮----
// Initial defaults to inject if the store is empty (first run)
⋮----
// Migration or First Run
⋮----
// --- Directory Actions ---
⋮----
// --- Command Actions ---
````

## File: test/browser/animationRuntime.browser.test.tsx
````typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AnimationOverlayLayer,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
  type OverlayAnimationRenderContext,
} from '../../components/animationRuntime';
import { resolveOverlayAppearance } from '../../config/appearance';
⋮----
function createAnimationContext(): OverlayAnimationRenderContext
⋮----
function createAnimation(overrides: Partial<LoadedOverlayAnimation>): LoadedOverlayAnimation
````

## File: test/browser/fileExplorer.latency.browser.test.tsx
````typescript
import { useEffect, useMemo, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildExplorerBatchRenamePreview, type ExplorerBatchRenameRecipe } from '../../components/explorerBatchRename';
import { useExplorerStore, type ExplorerRecursiveSizeCacheEntry } from '../../store/explorerStore';
⋮----
interface FixtureEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}
⋮----
const handler = (event: KeyboardEvent) =>
````

## File: test/browser/fileExplorer.repositoryPicker.browser.test.tsx
````typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer } from '../../components/FileExplorer';
import { resolveOverlayAppearance } from '../../config/appearance';
import { EXPLORER_PERFORMANCE_HISTORY_KEY } from '../../config/performanceTelemetry';
import { createDefaultExplorerRailSnapshot } from '../../components/explorer/explorerRailState';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useExplorerStore } from '../../store/explorerStore';
⋮----
interface TestFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}
⋮----
function buildEntrySizeResults(paths: string[])
⋮----
function resetOverlayTermStorage(storage: Storage)
⋮----
function renderRepositoryPicker(options?: {
  allowMultiple?: boolean;
  requestId?: number;
onConfirm?: (paths: string[])
⋮----
onOpenInFilesystemAquarium=
⋮----
onAddBookmark=
````

## File: test/browser/shaderRuntime.browser.test.tsx
````typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ShaderSurfaceLayer,
  createBuiltInOverlayShaders,
  resolveShaderSharedUniforms,
  resolveShaderSurfaceStyle,
  type LoadedOverlayShader,
  type OverlayShaderRenderContext,
  type OverlayShaderShellContext,
} from '../../components/shaderRuntime';
import { resolveOverlayAppearance } from '../../config/appearance';
⋮----
function createShellContext(): OverlayShaderShellContext
⋮----
function createRenderContext(): OverlayShaderRenderContext
⋮----
function createShader(overrides: Partial<LoadedOverlayShader>): LoadedOverlayShader
````

## File: test/browser-proof/mocks/appTauriCore.ts
````typescript
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
⋮----
export function convertFileSrc(path: string): string
⋮----
export function isTauri(): boolean
⋮----
function createEntry(
  name: string,
  path: string,
  is_dir: boolean,
  extension = '',
  size = 0,
)
````

## File: test/browser-proof/mocks/appTauriWindow.ts
````typescript
export async function availableMonitors()
⋮----
export async function currentMonitor()
⋮----
export function getCurrentWindow()
⋮----
export async function primaryMonitor()
⋮----
export class PhysicalSize
⋮----
export class PhysicalPosition
````

## File: test/browser-proof/mocks/globalShortcut.ts
````typescript
export async function register()
⋮----
export async function unregister()
⋮----
export async function isRegistered()
⋮----
export async function unregisterAll()
````

## File: test/browser-proof/mocks/monacoReact.tsx
````typescript
export default function MonacoReactMock()
````

## File: test/browser-proof/mocks/notification.ts
````typescript
export async function requestPermission()
⋮----
export async function isPermissionGranted()
⋮----
export async function sendNotification()
````

## File: test/browser-proof/mocks/opener.ts
````typescript
export async function open()
````

## File: test/browser-proof/mocks/pluginFs.ts
````typescript
export async function mkdir()
⋮----
export async function readTextFile()
⋮----
export async function writeTextFile()
⋮----
export async function writeFile()
````

## File: test/browser-proof/mocks/pluginStore.ts
````typescript
export class LazyStore
⋮----
async get()
⋮----
async set()
⋮----
async save()
⋮----
constructor(_name: string)
````

## File: test/browser-proof/mocks/shell.ts
````typescript
export async function open()
````

## File: test/browser-proof/mocks/tauriCore.ts
````typescript
import {
  buildEntrySizeResults,
  EXPLORER_ENTRIES,
  REPO_ROOT,
  RUNTIME_POLICY,
} from '../fileExplorer.repositoryPicker.fixtureData';
⋮----
export async function invoke<T>(command: string, args?: unknown): Promise<T>
⋮----
export function convertFileSrc(path: string): string
⋮----
export function isTauri(): boolean
````

## File: test/browser-proof/mocks/tauriEvent.ts
````typescript
export async function listen()
⋮----
export async function emit()
````

## File: test/browser-proof/mocks/tauriWindow.ts
````typescript
export async function availableMonitors()
⋮----
export async function currentMonitor()
⋮----
export function getCurrentWindow()
⋮----
export async function primaryMonitor()
⋮----
export class PhysicalSize
⋮----
export class PhysicalPosition
````

## File: test/browser-proof/fileExplorer.repositoryPicker.fixtureData.ts
````typescript
export interface ProofFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}
⋮----
export function buildEntrySizeResults(paths: string[])
````

## File: test/browser-proof/fileExplorer.repositoryPicker.page.tsx
````typescript
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { FileExplorer } from '../../components/FileExplorer';
import { resolveOverlayAppearance } from '../../config/appearance';
import { createDefaultExplorerRailSnapshot } from '../../components/explorer/explorerRailState';
import { EXPLORER_PERFORMANCE_HISTORY_KEY } from '../../config/performanceTelemetry';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
  useExplorerStore,
} from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
⋮----
function resetProofState()
⋮----
const resetScenario = (nextAllowMultiple: boolean) =>
⋮----
onOpenInFilesystemAquarium=
⋮----
onAddBookmark=
````

## File: test/helpers/runtimeFixtures.tsx
````typescript
import { resolveOverlayAppearance } from '../../config/appearance';
import type { OverlayAnimationRenderContext } from '../../components/animationRuntime';
import type { LoadedOverlayAnimation } from '../../components/animationRuntime';
import type { LoadedOverlayShader } from '../../components/shaderRuntime';
import type { OverlayShaderRenderContext, OverlayShaderShellContext } from '../../components/shaderRuntime';
⋮----
export function createThrowingComponent(message = 'unit test render failure')
⋮----
export function createAnimationRenderContext(
  overrides: Partial<OverlayAnimationRenderContext> = {},
): OverlayAnimationRenderContext
⋮----
export function createShaderShellContext(
  overrides: Partial<OverlayShaderShellContext> = {},
): OverlayShaderShellContext
⋮----
export function createShaderRenderContext(
  overrides: Partial<OverlayShaderRenderContext> = {},
): OverlayShaderRenderContext
⋮----
export function makeLoadedAnimation(
  overrides: Partial<LoadedOverlayAnimation> = {},
): LoadedOverlayAnimation
⋮----
export function makeLoadedShader(
  overrides: Partial<LoadedOverlayShader> = {},
): LoadedOverlayShader
````

## File: test/animationRuntime.boundary.test.tsx
````typescript
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnimationOverlayLayer,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
} from '../components/animationRuntime';
import { createAnimationRenderContext, createThrowingComponent } from './helpers/runtimeFixtures';
⋮----
function makeAnimation(overrides: Partial<LoadedOverlayAnimation> =
````

## File: test/animationRuntime.edge.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { loadAnimationFromSource } from '../components/animationRuntime';
````

## File: test/animationRuntime.test.ts
````typescript
import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  createBuiltInOverlayAnimations,
  loadAnimationFromSource,
  mergeOverlayAnimations,
} from '../components/animationRuntime';
````

## File: test/app.dockMode.test.tsx
````typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
⋮----
import App from '../App';
import { commands } from '../runtime/tauriClient';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { SHOW_WINDOW_MODE_REQUEST_EVENT } from '../runtime/windowHost';
⋮----
type MockWebviewWindow = {
  label: string;
  close: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  listen: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  setFocus: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
};
⋮----
function createMockWebviewWindow(label: string): MockWebviewWindow
⋮----
function setWindowMode(mode: 'overlay' | 'windowed')
````

## File: test/appContentDirectories.test.ts
````typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getManagedContentDirectory } from '../config/appContentDirectories';
````

## File: test/appearance.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  ensureFontFamilyLoaded,
  getThemeSourceLabel,
  isThemeCompatibleWithShellBlueprint,
  normalizeThemeDefinition,
  overlayFontCatalog,
  overlayThemePresets,
  parseImportedTheme,
  resolveOverlayAppearance,
  serializeTheme,
  setOverlayPluginFonts,
  upsertCustomTheme,
  type OverlayThemeDefinition,
} from '../config/appearance';
````

## File: test/browser.setup.ts
````typescript
import { cleanup } from '@testing-library/react';
⋮----
const createMockWebviewWindow = (label: string) => (
⋮----
const ensureWebviewWindow = (label: string) =>
⋮----
class MockWebviewWindow
⋮----
constructor(label: string)
⋮----
const resetMockWebviewWindows = () =>
⋮----
constructor(_name: string)
````

## File: test/commandPalette.test.tsx
````typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, type OverlayCommandPaletteAction } from '../components/CommandPalette';
import { resolveOverlayAppearance } from '../config/appearance';
⋮----
appearance=
````

## File: test/constellationLayout.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  buildConstellationOrbitBands,
  type ConstellationOrbitBandInput,
} from '../components/explorer/constellationLayout';
import type { ExplorerFileEntry as FileEntry } from '../runtime/explorerBackend';
⋮----
function makeEntry(index: number, overrides: Partial<FileEntry> =
````

## File: test/documentInteractionGuards.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import {
  resolveEventTargetElement,
  shouldAllowDocumentSelection,
  shouldAllowNativeContextMenu,
} from '../runtime/documentInteractionGuards';
````

## File: test/documentPreview.test.tsx
````typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextDocumentPreview, getDocumentPreviewKind, renderDocumentPreviewHtml } from '../components/documentPreview';
````

## File: test/explorerArchives.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  getExplorerArchiveDefaultFolderName,
  getExplorerArchiveDescriptor,
  getExplorerArchiveExtractToFolderLabel,
  isExplorerArchiveEntry,
} from '../config/explorerArchives';
````

## File: test/explorerAudioWorkbench.test.tsx
````typescript
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerAudioWorkbench } from '../components/ExplorerAudioWorkbench';
import type { ExplorerAudioEngineStateSnapshot } from '../runtime/audioWorkbenchBackend';
````

## File: test/explorerBackend.bindings.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import {
  YAZI_BINDINGS_MANIFEST,
  events,
  type ExplorerTaskProgressEvent,
  type ExplorerTaskRecord,
  type YaziSchedulerTaskProg,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';
import {
  cancelExplorerSearchEntries,
  cancelExplorerTask,
  clearExplorerTaskHistory,
  extractExplorerArchive,
  didExplorerTaskFail,
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  isExplorerTaskFinished,
  listExplorerTasks,
  listenToExplorerTaskProgress,
  openExplorerArchive,
  retryExplorerTask,
  searchExplorerEntriesWithDiagnostics,
  type ExplorerTaskProgress,
} from '../runtime/explorerBackend';
import { commands } from '../runtime/tauriClient';
⋮----
function makeSchedulerTask(
  overrides: Partial<Extract<YaziSchedulerTaskProg, { kind: 'fileCopy' }>> = {},
): YaziSchedulerTaskSnap
⋮----
function makeTaskRecord(
  status: ExplorerTaskRecord['status'],
  overrides: Partial<ExplorerTaskRecord> = {},
): ExplorerTaskRecord
````

## File: test/explorerBatchRename.test.ts
````typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExplorerBatchRenamePreview } from '../components/explorerBatchRename';
````

## File: test/explorerChromeLayouts.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  moveExplorerChromeControlInResolvedSurfaces,
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlDefinition,
} from '../config/explorerChromeLayouts';
````

## File: test/explorerContextMenu.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { normalizePluginContextMenuContributions } from '../config/explorerContextMenu';
import type { OverlayPluginContextMenuContribution } from '../config/pluginContributions';
````

## File: test/explorerExperimentalModes.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  getExplorerExperimentalDensityDescriptor,
  getExplorerExperimentalModeDefinition,
} from '../config/explorerExperimentalModes';
````

## File: test/explorerImageEditor.test.tsx
````typescript
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerImageEditor } from '../components/ExplorerImageEditor';
⋮----
function createMockEditorHarness()
⋮----
emit(eventName: string, payload?: unknown)
setState(nextState: object)
````

## File: test/explorerMetadata.test.ts
````typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { calculateExplorerChecksumsFromBase64 } from '../components/explorerChecksums';
import { useExplorerStore } from '../store/explorerStore';
````

## File: test/explorerRail.performance.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  buildExplorerBookmarkTree,
  createDefaultExplorerRailSnapshot,
  createExplorerBookmarkFolder,
  upsertExplorerBookmark,
} from '../components/explorer/explorerRailState';
````

## File: test/explorerRailState.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  applyExplorerBookmarkImportPlan,
  buildExplorerBookmarkTree,
  createDefaultExplorerRailSnapshot,
  createExplorerBookmarkFolder,
  createExplorerCustomCategory,
  inferBookmarkCategoryIds,
  normalizeExplorerRailSnapshot,
  planExplorerBookmarkImport,
  toggleExplorerBookmarkCategoryFilter,
} from '../components/explorer/explorerRailState';
````

## File: test/explorerSideRail.test.tsx
````typescript
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listExplorerLocation } from '../runtime/explorerBackend';
import { invalidateExplorerDirectoryResultCaches } from '../components/explorer/explorerDirectoryCache';
⋮----
import { ExplorerSideRail } from '../components/explorer/ExplorerSideRail';
import { createDefaultExplorerRailSnapshot, normalizeExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import { useExplorerStore } from '../store/explorerStore';
⋮----
function createDataTransfer(payloads: Record<string, string>)
⋮----
function enableAutoExpandToOpenFolder()
⋮----
resolveDroppedSources=
````

## File: test/explorerStore.test.ts
````typescript
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
  PRIMARY_EXPLORER_TAB_ID,
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerWorkspace,
  defaultExplorerSession,
  loadExplorerPersistedState,
  persistExplorerState,
  useExplorerStore,
} from '../store/explorerStore';
import { createDefaultExplorerRailSnapshot, createExplorerBookmarkFolder } from '../components/explorer/explorerRailState';
````

## File: test/explorerTaskStore.test.tsx
````typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
⋮----
import type { ExplorerTaskSnapshot } from '../runtime/explorerBackend';
⋮----
function makeTask(
  id: string,
  status: ExplorerTaskSnapshot['status'],
  overrides: Partial<ExplorerTaskSnapshot> = {},
): ExplorerTaskSnapshot
````

## File: test/explorerTheme.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import {
  applyExplorerThemeToAdaptiveDensityStop,
  applyExplorerThemeToGridMetrics,
  applyExplorerThemeToRowMetrics,
  resolveExplorerThemeRecipe,
} from '../config/explorerTheme';
import { getAdaptiveSemanticDensityStop } from '../config/explorerExperimentalModes';
import { getExplorerGridMetricsForZoom } from '../config/explorerViewModes';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
````

## File: test/explorerThumbnails.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG,
  canRenderExplorerThumbnail,
  clampVideoHoverScrubFrameCount,
  defaultExplorerThumbnailSettings,
  isShaderThumbnailExtension,
  normalizeExplorerThumbnailSettings,
} from '../config/explorerThumbnails';
````

## File: test/explorerVideoEditor.test.tsx
````typescript
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerVideoEditor, buildTrimmedVideoOutputPath } from '../components/ExplorerVideoEditor';
````

## File: test/explorerViewModes.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  getAdjacentExplorerGridMode,
  getExplorerGridMetricsForZoom,
  getNearestExplorerGridMode,
  getExplorerViewModeDefinition,
  normalizeExplorerGridZoom,
  normalizeExplorerViewMode,
  resolveEffectiveExplorerViewMode,
  stepExplorerGridZoom,
  stepExplorerViewMode,
} from '../config/explorerViewModes';
````

## File: test/ExplorerWorkspace.test.tsx
````typescript
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { defaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  defaultExplorerWorkspace,
  useExplorerStore,
} from '../store/explorerStore';
import type {
  ExplorerWorkspaceRuntimeSnapshot,
  ExplorerWorkspaceSelectionTransferResult,
} from '../components/FileExplorer';
⋮----
import { ExplorerWorkspace } from '../components/explorer/ExplorerWorkspace';
⋮----
function getWorkspaceControl(controlId: string)
⋮----
function getWorkspaceButton(controlId: string): HTMLButtonElement | null
⋮----
function getWorkspaceLayoutButton(label: string): HTMLButtonElement
⋮----
function getRenderedFileExplorerProps(instanceId: string)
⋮----
function emitRuntimeSnapshot(
  instanceId: string,
  snapshot: Omit<ExplorerWorkspaceRuntimeSnapshot, 'instanceId'>,
)
⋮----
function emitSelectionTransferComplete(
  instanceId: string,
  result: ExplorerWorkspaceSelectionTransferResult,
)
⋮----
onAddBookmark=
````

## File: test/fileExplorer.searchTelemetry.test.tsx
````typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer, invalidateExplorerResultCaches } from '../components/FileExplorer';
import { resolveOverlayAppearance } from '../config/appearance';
import type { FileSearchDiagnostics } from '../config/searchTelemetry';
import {
  EXPLORER_PERFORMANCE_HISTORY_KEY,
  loadExplorerPerformanceSnapshot,
  resetExplorerPerformanceSnapshot,
} from '../config/performanceTelemetry';
import type { FsRuntimeCachePolicy } from '../config/runtimeCachePolicy';
import { createDefaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from '../store/explorerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
⋮----
interface TestFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
  is_hidden: boolean;
  is_symlink: boolean;
}
⋮----
interface TestFileSearchResult extends TestFileEntry {
  relative_path: string;
  match_kind: 'name' | 'content' | 'name_and_content';
  snippet: string | null;
  line_number: number | null;
}
⋮----
function buildEntrySizeResults(paths: string[])
⋮----
function resetOverlayTermStorage(storage: Storage)
⋮----
function renderExplorer()
⋮----
onOpenInFilesystemAquarium=
⋮----
onAddBookmark=
⋮----
function installExplorerBackendMock(diagnostics: FileSearchDiagnostics)
````

## File: test/fileExplorer.utils.test.ts
````typescript
/**
 * Unit tests for pure-function utilities extracted from FileExplorer.tsx
 *
 * All tests in this file are deterministic — no network, no Tauri IPC.
 * They test the exact logic that drives how files are displayed, typed, and sorted.
 */
⋮----
import { describe, it, expect } from 'vitest';
⋮----
// ─── Replicate pure helpers from FileExplorer (DRY violation is intentional
//     here: we test the contract, not the implementation reference) ─────────────
⋮----
interface FileEntry {
  name: string; path: string; is_dir: boolean;
  size: number; modified: number; extension: string;
  is_hidden: boolean; is_symlink: boolean;
}
⋮----
function makeEntry(overrides: Partial<FileEntry> =
⋮----
function fileColor(entry: FileEntry): string
⋮----
function monacoLang(ext: string): string
⋮----
function formatSize(bytes: number): string
⋮----
function formatDate(ms: number): string
⋮----
// Simulates the directory-first sort from the Rust backend
function sortEntries(entries: FileEntry[]): FileEntry[]
⋮----
function typeLabel(entry: FileEntry): string
⋮----
function sortEntriesBy(
  entries: FileEntry[],
  sortBy: 'name' | 'size' | 'date' | 'type',
  sortOrder: 'asc' | 'desc',
): FileEntry[]
⋮----
// Simulates search filter
function filterEntries(entries: FileEntry[], query: string): FileEntry[]
⋮----
// ─── Tests ────────────────────────────────────────────────────────────────────
⋮----
// A directory named "images.jpg" should still be yellow
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
// Should contain the year 2023
⋮----
const a = formatDate(1000000000000); // 2001
const b = formatDate(1700000000000); // 2023
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
const dir  = (name: string) => makeEntry(
const file = (name: string, ext = 'txt') => makeEntry(
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
// package.json (no 'c'), README.md (no), src (has 'c'? no - wait 'src' -> s,r,c YES)
// Cargo.toml (has 'c'), vite.config.ts (has 'c')
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
// An image should not be in CODE_EXTS
⋮----
// Archives should not be in AUDIO/VIDEO
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
function parseBreadcrumbs(currentPath: string):
⋮----
// ─────────────────────────────────────────────────────────────────────────────
⋮----
function isLikelyExplorerPathInput(value: string): boolean
````

## File: test/fileExplorer.viewModes.test.tsx
````typescript
import React from 'react';
import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
⋮----
import { FileExplorer, invalidateExplorerResultCaches } from '../components/FileExplorer';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { createDefaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import {
  EXPLORER_LEGACY_BOOKMARKS_KEY,
  EXPLORER_STATE_BACKUP_KEY,
  EXPLORER_STATE_STORAGE_KEY,
} from '../store/explorerStore';
import { useSettingsStore } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
⋮----
function createDataTransfer()
⋮----
function createDeferred<T>()
⋮----
function resetOverlayTermStorage(storage: Storage)
⋮----
function renderExplorer(options: {
  appearance?: ReturnType<typeof resolveOverlayAppearance>;
  chromeControlSurface?: 'toolbar' | 'topbar';
  layoutMode?: 'full' | 'dock';
} =
⋮----
onAddBookmark=
⋮----
function getChromeControl(controlId: string)
⋮----
function getExplorerViewport(anchorText: string)
⋮----
function dispatchLayoutWheel(anchorText: string, deltaY: number)
⋮----
function dispatchLayoutWheelOnElement(element: Element, deltaY: number)
⋮----
function dispatchLayoutWheelOnFileArea(deltaY: number)
⋮----
function getEntryIconSrc(entryName: string): string
⋮----
onOpenInTerminal=
⋮----
get()
````

## File: test/fileExplorerClickBehavior.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { shouldOpenExplorerEntryOnTrigger } from '../components/fileExplorerClickBehavior';
````

## File: test/fileExplorerSearchFocus.edge.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
} from '../components/fileExplorerSearchFocus';
````

## File: test/fileExplorerSearchFocus.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
} from '../components/fileExplorerSearchFocus';
````

## File: test/fileExplorerSearchScope.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { resolveExplorerSearchScope } from '../components/fileExplorerSearchScope';
````

## File: test/fileOperationsWindow.test.ts
````typescript
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
⋮----
import {
  FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT,
  FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY,
  FILE_OPERATIONS_WINDOW_LABEL,
  FILE_OPERATIONS_WINDOW_REQUEST_EVENT,
  FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY,
  createFileOperationsWindowRequest,
  listenToFileOperationsTransferCompleted,
  listenToFileOperationsWindowRequests,
  openFileOperationsWindow,
  publishFileOperationsTransferCompleted,
  readFileOperationsTransferCompletedEvent,
  readFileOperationsWindowRequest,
} from '../runtime/fileOperationsWindow';
````

## File: test/filePreview.test.ts
````typescript
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  EXPLORER_AUDIO_EXPORT_FORMATS,
  getAudioPreviewMimeType,
  getExplorerAudioExportFormatDefinition,
  getModelPreviewFormat,
  getMonacoLanguage,
  getVideoPreviewMimeType,
  isDirectAudioPreviewExtension,
  isAudioPreviewExtension,
  isEditableTextExtension,
  isExecutableExtension,
  isImagePreviewExtension,
  isVideoPreviewExtension,
} from "../config/filePreview";
````

## File: test/filesystemAquariumBridge.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
⋮----
import {
  FILESYSTEM_AQUARIUM_OPEN_REQUEST_EVENT,
  FILESYSTEM_AQUARIUM_OPEN_REQUEST_STORAGE_KEY,
  createFilesystemAquariumOpenRequest,
  readFilesystemAquariumOpenRequest,
  requestFilesystemAquariumOpen,
} from '../runtime/filesystemAquariumBridge';
⋮----
function createMemoryStorage()
⋮----
getItem(key: string)
setItem(key: string, value: string)
````

## File: test/folderIcons.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import {
  BUILT_IN_FOLDER_ICON_RULES,
  createDefaultFolderIconRules,
  DEFAULT_FOLDER_ICON_VALUE,
  getFolderIconSrc,
  getNamedFolderIconSrc,
  resolveFolderIconPair,
} from '../config/folderIcons';
````

## File: test/frameTelemetry.test.ts
````typescript
import {
  OVERLAY_FRAME_TARGET_MS,
  shouldFlushOverlayFrameWindow,
  summarizeOverlayFrameWindow,
} from '../config/frameTelemetry';
````

## File: test/gitManager.behavior.test.tsx
````typescript
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { GitManager } from '../components/GitManager';
import { resolveOverlayAppearance } from '../config/appearance';
import { recordExplorerPerformanceSample } from '../config/performanceTelemetry';
import { useSettingsStore } from '../store/settingsStore';
⋮----
observe()
disconnect()
⋮----
const statusCalls = () => invokeMock.mock.calls.filter(([command, args]) => command === 'git_exec' && (args as
````

## File: test/gitManager.utils.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  mergeGitStatusWithStats,
  parseGitNumstat,
  parseGitStatus,
  summarizeGitFiles,
} from '../components/gitManager.utils';
````

## File: test/globalErrorPanel.test.ts
````typescript
import { afterEach, describe, expect, it } from 'vitest';
⋮----
import {
  formatGlobalErrorDetail,
  reportGlobalError,
  resetGlobalErrorPanel,
} from '../runtime/globalErrorPanel';
````

## File: test/globalShortcuts.test.tsx
````typescript
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useGlobalShortcut } from '../input/GlobalShortcuts';
````

## File: test/hotkeys.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  createDefaultKeybindingSettings,
  matchesKeybinding,
  matchesWheelHotkey,
  normalizeKeybindingSettings,
  normalizeKeybindingValue,
} from '../config/hotkeys';
````

## File: test/layoutProfiles.edge.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  buildDefaultLayoutConfigCandidates,
  getNextLayoutProfileId,
  normalizeLayoutManifest,
} from '../config/layoutProfiles';
````

## File: test/layoutProfiles.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  getNextLayoutProfileId,
  getPinnedPanelIds,
  getTabbedOpenPanelIds,
  normalizeLayoutManifest,
  resolveLayoutProfile,
} from '../config/layoutProfiles';
````

## File: test/modelPreview.utils.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import { decodeDataUrlToUint8Array, getModelPreviewRotation, normalizeModelForPreview, collectNormalizedBounds } from '../components/modelPreview.utils';
````

## File: test/moduleRuntime.workerBridge.test.ts
````typescript
import {
  transpileRuntimeModuleGraph,
  transpileRuntimeModuleSource,
} from '../runtime/moduleRuntime';
import {
  readFrontendWorkerTelemetrySnapshot,
  resetFrontendWorkerTelemetryForTests,
} from '../runtime/workerHost';
````

## File: test/notesConfig.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  getManagedNoteCategoryDirectory,
  getManagedNotesRootDirectory,
  joinManagedNotePath,
} from '../config/notes';
````

## File: test/overlayAnimations.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  OVERLAY_ANIMATION_DURATION_MAX,
  OVERLAY_ANIMATION_DURATION_MIN,
  OVERLAY_ANIMATION_INTENSITY_MAX,
  OVERLAY_ANIMATION_INTENSITY_MIN,
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  getOverlayAnimationPreset,
  getOverlayAnimationStyle,
  getOverlayAnimationTransition,
  getOverlayEffectStyle,
} from '../config/overlayAnimations';
````

## File: test/overlayScrollArea.test.tsx
````typescript
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlayScrollArea } from '../components/OverlayScrollArea';
⋮----
function getViewport(container: HTMLElement, direction: 'horizontal' | 'vertical'): HTMLDivElement
````

## File: test/overlayWindow.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  computeAnchoredOverlayWindowLayout,
  clampOverlayWindowBoundsToWorkArea,
  computeOverlayWindowLayout,
  overlayWindowGeometry,
} from '../config/overlayWindow';
````

## File: test/panelRegistry.test.tsx
````typescript
import { describe, expect, it, vi } from 'vitest';
⋮----
import { createBuiltInPanelDefinitions } from '../panels/panelRegistry';
````

## File: test/panelUtils.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  getNextActivePanelId,
  reorderPanelIds,
  syncOpenPanelIds,
  togglePanelId,
} from '../components/panelUtils';
````

## File: test/performanceTelemetry.test.ts
````typescript
import {
  EXPLORER_PERFORMANCE_HISTORY_KEY,
  loadExplorerPerformanceSnapshot,
  recordExplorerPerformanceSample,
  resetExplorerPerformanceSnapshot,
  summarizeExplorerPerformance,
} from '../config/performanceTelemetry';
⋮----
function createInMemoryStorage(): Storage
⋮----
get length()
⋮----
// Vitest's Node environment does not provide a full localStorage implementation.
````

## File: test/platform.test.ts
````typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultCommandBookmarks,
  createDefaultDirectoryBookmarks,
  detectClientPlatform,
  getDefaultIntegratedShell,
  getExternalTerminalProfileOptions,
  getFallbackExplorerPath,
  getPlatformPathSeparator,
  joinPlatformPath,
} from '../config/platform';
````

## File: test/pluginContributions.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import {
  dispatchTerminalCommand,
  resolvePluginCommandTemplate,
} from '../config/pluginContributions';
````

## File: test/pluginPackages.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverOverlayPlugins } from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';
````

## File: test/pluginPanelRequests.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
⋮----
import {
  PLUGIN_PANEL_OPEN_REQUEST_EVENT,
  createPluginPanelOpenRequest,
  getPluginPanelOpenRequestStorageKey,
  readPluginPanelOpenRequest,
  requestPluginPanelOpen,
} from '../runtime/pluginPanelRequests';
⋮----
function createMemoryStorage()
⋮----
getItem(key: string)
setItem(key: string, value: string)
````

## File: test/pluginRuntime.edge.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { loadPluginFromSource } from '../components/pluginRuntime';
⋮----
const hostApiFactory = () => (
````

## File: test/pluginRuntime.test.ts
````typescript
import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import {
  definePlugin,
  derivePluginId,
  derivePluginName,
  isFrontendPluginFile,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import { pluginSystemConfig } from '../config/plugins';
⋮----
const component = ()
````

## File: test/pluginsManager.test.tsx
````typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import PluginsManager from '../components/PluginsManager';
import { pluginSystemConfig } from '../config/plugins';
import { joinPlatformPath } from '../config/platform';
⋮----
function makeAppearance()
⋮----
appearance=
⋮----
const PluginView = ({
      plugin,
      host,
    }: {
      plugin: { name: string };
      host?: { zoom?: number };
}) => <div>workspace:
⋮----
onOpenPluginsFolder=
````

## File: test/pluginWatchPaths.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import {
  getPluginBackendDirectory,
  getPluginDirectory,
  getPluginStorageDirectory,
  isIgnoredPluginWatchPath,
  normalizePluginWatchPathSegments,
  shouldRefreshForPluginWatchPaths,
} from '../config/plugins';
````

## File: test/pythonConfig.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  buildManagedPythonReplCommand,
  createPythonRuntimeConfig,
  formatCommandOutput,
  parseMultilineValues,
} from '../config/python';
````

## File: test/repositoryPickerState.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  getRepositoryPickerConfirmLabel,
  resolveRepositoryPickerConfirmationPaths,
} from '../components/explorer/repositoryPickerState';
````

## File: test/resizablePane.test.tsx
````typescript
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clampPanelSize, usePersistentPanelSize } from '../components/ResizablePane';
⋮----
function PanelSizeHarness()
````

## File: test/runPlatformTauri.test.ts
````typescript
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLinuxGraphicsEnvironment,
  buildManagedContentDirectoryEnvironment,
} from '../../scripts/run-platform-tauri.mjs';
````

## File: test/runtimeCachePolicy.test.ts
````typescript
import {
  buildRuntimeCachePolicyFingerprint,
  finalizePendingExplorerMetricSamples,
  getRuntimeCachePolicyTelemetryMetadata,
  type FsRuntimeCachePolicy,
} from '../config/runtimeCachePolicy';
````

## File: test/screenshotsManager.test.tsx
````typescript
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
} from '@tauri-apps/api/window';
import type { Monitor as TauriMonitor } from '@tauri-apps/api/window';
import { ScreenshotsManager } from '../components/ScreenshotsManager';
import { joinPlatformPath } from '../config/platform';
import { screenshotFeatureConfig } from '../config/screenshots';
import { useSettingsStore } from '../store/settingsStore';
import { useExplorerTaskStore } from '../store/explorerTaskStore';
⋮----
function makeGalleryEntry(name: string)
⋮----
observe()
disconnect()
⋮----
/*
        name: 'Delete M:\\Assets\\OverlayTerm\\notes\\new-note_1775861948830-jzyb4i.md',
        prog: {
          kind: 'fileDelete',
          totalFiles: 1,
          successFiles: 0,
          failedFiles: 0,
          totalBytes: 100,
          processedBytes: 0,
          collected: null,
          cleaned: null,
        },
      },
      */
````

## File: test/screenshotsUtils.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  clampSelectionToBounds,
  createInsetSelection,
  getSelectionHandleAtPoint,
  moveSelection,
  isSupportedScreenshotEntry,
  normalizeSelection,
  resizeSelection,
  selectionToPixelRect,
  selectionToMonitorRect,
  sortScreenshotEntries,
} from '../components/screenshotsUtils';
````

## File: test/searchTelemetry.test.ts
````typescript
import {
  getExplorerSearchTelemetryMetadata,
  type FileSearchDiagnostics,
} from '../config/searchTelemetry';
````

## File: test/settingsPage.behavior.test.tsx
````typescript
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayAnimations } from '../components/animationRuntime';
import { createBuiltInOverlayShaders } from '../components/shaderRuntime';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { createDefaultFolderIconRules } from '../config/folderIcons';
import { resolveThemeCatalogPackageMetadata } from '../config/themeCatalogCuration';
import { pluginSystemConfig } from '../config/plugins';
import { screenshotFeatureConfig } from '../config/screenshots';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
import { defaultSettings, useSettingsStore } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
import { useTerminalStore } from '../store/terminalStore';
import type { LoadedOverlayThemePackage } from '../config/themePackages';
import type { OverlayPluginContextMenuContribution, OverlayPluginExplorerActionContribution } from '../config/pluginContributions';
⋮----
function createThemePackageFixture(
  fixture: Omit<LoadedOverlayThemePackage, 'catalog'> & { catalog?: LoadedOverlayThemePackage['catalog'] },
): LoadedOverlayThemePackage
⋮----
function findSectionButton(label: string): HTMLButtonElement
⋮----
onRefreshThemes=
onOpenThemesFolder=
⋮----
onRefreshShaders=
onOpenShadersFolder=
⋮----
onRefreshAnimations=
onOpenAnimationsFolder=
⋮----
onRefreshWallpapers=
onOpenWallpapersFolder=
onImportWallpaperFiles=
````

## File: test/settingsPage.shaders.test.tsx
````typescript
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsPage } from '../components/SettingsPage';
import { createBuiltInOverlayShaders, type LoadedOverlayShader } from '../components/shaderRuntime';
import { resolveOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';
⋮----
function findButtonByText(label: string): HTMLButtonElement
⋮----
onRefreshThemes=
onOpenThemesFolder=
⋮----
onRefreshShaders=
onOpenShadersFolder=
⋮----
onRefreshAnimations=
onOpenAnimationsFolder=
⋮----
onRefreshWallpapers=
onOpenWallpapersFolder=
onImportWallpaperFiles=
````

## File: test/settingsStore.test.ts
````typescript
/**
 * Settings store tests
 * Tests the Zustand store logic in isolation — no Tauri, no DOM.
 */
⋮----
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, defaultSettings, mergeSettingsWithDefaults, resolveSystemPresentationState } from '../store/settingsStore';
import { useExplorerStore } from '../store/explorerStore';
import { overlayWindowGeometry } from '../config/overlayWindow';
import { defaultExplorerThumbnailSettings } from '../config/explorerThumbnails';
````

## File: test/setup.tsx
````typescript
// Vitest global setup — runs before every test file
⋮----
// Provide a resilient in-memory Storage so persistence-heavy tests work even if
// the runtime lacks a real DOM localStorage (e.g., Node with an invalid
// --localstorage-file flag).
const createMemoryStorage = (): Storage =>
⋮----
get length()
⋮----
const storageLike = (candidate: unknown): candidate is Storage
⋮----
// Avoid invoking Node's experimental localStorage getter, which emits a
// warning when --localstorage-file lacks a path. Inspect the descriptor
// instead; if it is an accessor or not storage-like, replace it with a
// quiet in-memory implementation.
⋮----
(descriptor && typeof descriptor.get === 'function'); // accessor triggers warning
⋮----
// ─── Mock the entire @tauri-apps/* surface ───────────────────────────────────
// We are testing logic / rendering only. Real Tauri IPC is NOT available in
// jsdom, so every `invoke`, `listen`, etc. must be stubbed.
⋮----
const createMockWebviewWindow = (label: string) => (
⋮----
const ensureMockWebviewWindow = (label: string) =>
⋮----
class MockWebviewWindow
⋮----
constructor(label: string)
⋮----
function resetMockWebviewWindowRegistry()
⋮----
constructor(_name: string)
⋮----
// Monaco editor — heavy and irrelevant for unit tests
⋮----
// Silence console.warn / console.error during tests (keeps output clean)
````

## File: test/shaderRuntime.boundary.test.tsx
````typescript
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShaderSurfaceLayer,
  resolveShaderSurfaceStyle,
  type LoadedOverlayShader,
} from '../components/shaderRuntime';
import { createShaderRenderContext, createShaderShellContext, createThrowingComponent } from './helpers/runtimeFixtures';
⋮----
function makeShader(overrides: Partial<LoadedOverlayShader> =
````

## File: test/shaderRuntime.edge.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { loadShaderFromSource } from '../components/shaderRuntime';
````

## File: test/shaderRuntime.test.ts
````typescript
import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  createBuiltInOverlayShaders,
  loadShaderFromSource,
  mergeOverlayShaders,
  resolveShaderControlValues,
  resolveShaderSharedUniforms,
} from '../components/shaderRuntime';
import { resolveOverlayAppearance } from '../config/appearance';
````

## File: test/shaderSystem.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { resolveOverlayAppearance } from '../config/appearance';
import { resolvePreferredShaderId } from '../config/shaders';
````

## File: test/sourceRepositoryImportFlow.integration.test.tsx
````typescript
import { useMemo, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { GitManager } from '../components/GitManager';
import { resolveOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';
⋮----
const handleRequestRepositoryImport = () =>
⋮----
const handleConfirmRepositoryImport = () =>
⋮----
const handleRepositoryImportsHandled = () =>
````

## File: test/terminalCommandUtils.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { buildTerminalCdCommand } from '../components/terminalCommandUtils';
````

## File: test/terminalOverlay.test.tsx
````typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useExplorerStore } from '../store/explorerStore';
⋮----
class MockXtermLine
⋮----
constructor(private readonly text: string)
⋮----
translateToString(): string
⋮----
constructor()
⋮----
getSelection(): string
⋮----
emitData(data: string): void
⋮----
import TerminalOverlay from '../components/TerminalOverlay';
import { useSettingsStore } from '../store/settingsStore';
⋮----
observe()
disconnect()
````

## File: test/terminalPaneLayout.test.ts
````typescript
import { describe, expect, it } from "vitest";
⋮----
import {
  clampTerminalSplitRatio,
  collectTerminalPaneIds,
  createTerminalPaneLayout,
  getImmediatePaneSplitDirection,
  removeTerminalPaneFromLayout,
  splitTerminalPaneLayout,
  updateTerminalPaneSplitRatio,
} from "../components/terminalPaneLayout";
````

## File: test/terminalStore.test.ts
````typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultCommandBookmarks } from '../config/platform';
import { useTerminalStore, type Bookmark } from '../store/terminalStore';
⋮----
function makeBookmark(id: string, name: string, value: string): Bookmark
````

## File: test/themeCatalogCuration.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  compareThemeCatalogPackages,
  resolveThemeCatalogPackageMetadata,
} from '../config/themeCatalogCuration';
import { loadThemePackagesFromDirectoryEntries } from '../config/themePackages';
````

## File: test/themeEngineBackend.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { OVERLAY_THEME_MANIFESTS, type WorkbenchPreset } from '../generated/tauri';
import { commands } from '../runtime/tauriClient';
import {
  compileThemeEngineManifest,
  listThemeEngineCatalog,
  normalizeThemeManifestDraft,
} from '../runtime/themeEngineBackend';
````

## File: test/themeEngineCatalog.regression.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
⋮----
import type { WorkbenchPreset } from '../generated/tauri';
import { commands } from '../runtime/tauriClient';
import {
  compileThemeEngineManifest,
  listThemeEngineCatalog,
  normalizeThemeManifestDraft,
} from '../runtime/themeEngineBackend';
````

## File: test/themePackageExplorerRecipe.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadThemePackagesFromDirectoryEntries } from '../config/themePackages';
````

## File: test/themePackages.inheritance.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
⋮----
import { loadThemePackagesFromDirectoryEntries } from '../config/themePackages';
````

## File: test/themePackages.test.ts
````typescript
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadThemePackages, loadThemePackagesFromDirectoryEntries, themeSystemConfig } from '../config/themePackages';
````

## File: test/themeRendererCatalogContract.test.ts
````typescript
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
⋮----
import { describe, expect, it } from 'vitest';
⋮----
import { loadThemeRendererFromSource } from '../components/themeRendererRuntime';
⋮----
function listThemeRendererEntries(): Array<
⋮----
async function filesystemRelativeModuleSourceResolver({
    fromModulePath,
    specifier,
  }: {
    fromModulePath: string;
    specifier: string;
})
````

## File: test/themeRendererPackages.test.ts
````typescript
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
⋮----
import { describe, expect, it } from 'vitest';
⋮----
import { loadThemeRendererFromSource } from '../components/themeRendererRuntime';
⋮----
function createFilesystemRelativeModuleSourceResolver()
````

## File: test/themeRendererRuntime.test.tsx
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import {
  loadThemeRendererFromSource,
  overlayThemeRendererApiVersion,
} from '../components/themeRendererRuntime';
````

## File: test/themeRendererShellModel.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import { normalizeThemeRendererShellLayout } from '../components/themeRendererShellModel';
````

## File: test/useFolderPluginRuntime.fallback.test.tsx
````typescript
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
⋮----
import { pluginSystemConfig } from '../config/plugins';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import { commands } from '../runtime/tauriClient';
import type { ExplorerFileEntry } from '../runtime/explorerBackend';
⋮----
function createDeferred<T>()
````

## File: test/useFolderPluginRuntime.queue.test.tsx
````typescript
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
⋮----
import { commands } from '../runtime/tauriClient';
⋮----
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import type { ExplorerFileEntry } from '../runtime/explorerBackend';
⋮----
function createDeferred<T>()
````

## File: test/useFolderPluginRuntime.test.tsx
````typescript
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import { pluginSystemConfig } from '../config/plugins';
import { commands } from '../runtime/tauriClient';
⋮----
import type { ExplorerFileEntry } from '../runtime/explorerBackend';
⋮----
async function flushPluginEffects()
````

## File: test/vibeCapsule.pluginPackage.test.ts
````typescript
import { readdir, readFile, stat } from 'fs/promises';
import { extname, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
⋮----
import { discoverOverlayPlugins } from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';
⋮----
type MockFileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
};
⋮----
function toWorkspacePath(relativePath: string): string
⋮----
async function listMockDirectory(relativePath: string): Promise<MockFileEntry[]>
````

## File: test/wallpaperRuntime.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  createThemeAssetWallpaper,
  resolveActiveWallpaper,
  type LoadedOverlayWallpaper,
} from '../components/wallpaperRuntime';
import { wallpaperSystemConfig } from '../config/wallpapers';
⋮----
function createWallpaper(id: string): LoadedOverlayWallpaper
````

## File: test/WindowControls.test.tsx
````typescript
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WindowControls } from '../components/WindowControls';
⋮----
function restoreTauriWindowMock(): void
````

## File: test/workbenchPresets.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_WORKBENCH_PRESETS,
  getWorkbenchPresetsForShellBlueprint,
  normalizeWorkbenchPreset,
  resolveWorkbenchPreset,
} from '../config/workbenchPresets';
````

## File: test/workbenchPresetThemes.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import { BUILT_IN_WORKBENCH_PRESETS, normalizeWorkbenchPreset } from '../config/workbenchPresets';
````

## File: test/workbenchRenderRuntime.test.ts
````typescript
import { describe, expect, it } from 'vitest';
⋮----
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { BUILT_IN_LAYOUT_MANIFEST, resolveLayoutProfile } from '../config/layoutProfiles';
import {
  groupPanelsForWorkbenchNavigation,
  resolveWorkbenchRenderRuntime,
} from '../config/workbenchRenderRuntime';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
````

## File: test/workbenchTheme.test.ts
````typescript
import { describe, expect, it } from 'vitest';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { compileThemeEngineManifest, normalizeThemeManifestDraft } from '../runtime/themeEngineBackend';
````

## File: types/imgEditorRuntime.d.ts
````typescript
export type ExplorerImageEditorCanvasEventHandler = (payload?: unknown) => void;
⋮----
export type ExplorerImageEditorHandle = {
    canvas: {
      on: (eventName: string, handler: ExplorerImageEditorCanvasEventHandler) => void;
      off: (eventName: string, handler: ExplorerImageEditorCanvasEventHandler) => void;
    };
    historyManager: {
      getFullState: () => unknown;
      loadStateFromFullState: (state: unknown) => Promise<void>;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
    };
    imageManager: {
      exportCanvasAsImageFile: (options?: {
        fileName?: string;
        contentType?: string;
        exportAsBlob?: boolean;
      }) => Promise<{
        image: Blob | File | string;
        format: string;
        contentType: string;
        fileName: string;
      } | null>;
    };
    textManager: {
      addText: () => unknown;
    };
    shapeManager: {
      add: (options?: { presetKey?: string }) => Promise<unknown>;
    };
    deletionManager: {
      deleteSelectedObjects: () => unknown;
    };
    zoomManager: {
      zoom: (scale?: number) => void;
      resetZoom: () => void;
    };
    canvasManager: {
      updateCanvas: () => void;
    };
    destroy: () => void;
  };
⋮----
export type ExplorerImageEditorOptions = {
    editorContainerWidth?: string;
    editorContainerHeight?: string;
    canvasWrapperWidth?: string;
    canvasWrapperHeight?: string;
    canvasCSSWidth?: string;
    canvasCSSHeight?: string;
    adaptCanvasToContainerOnResize?: boolean;
    canvasDragging?: boolean;
    mouseWheelZooming?: boolean;
    undoRedoByHotKeys?: boolean;
    copyObjectsByHotkey?: boolean;
    pasteImageFromClipboard?: boolean;
    selectAllByHotkey?: boolean;
    deleteObjectsByHotkey?: boolean;
    resetObjectFitByDoubleClick?: boolean;
    defaultScale?: number;
    minZoom?: number;
    maxZoom?: number;
    scaleType?: 'contain' | 'cover';
    showToolbar?: boolean;
    overlayMaskColor?: string;
    keyboardIgnoreSelectors?: string[];
    initialImage?: {
      source: string;
      scale?: 'scale-montage' | 'image-contain' | 'image-cover';
      withoutSave?: boolean;
    };
  };
⋮----
export default function initEditor(
    containerId: string,
    options?: ExplorerImageEditorOptions,
  ): Promise<ExplorerImageEditorHandle>;
````

## File: windows/FileOperationsWindowApp.tsx
````typescript
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  FolderPlus,
  LoaderCircle,
  MoveRight,
  RefreshCw,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  ensureFontFamilyLoaded,
  resolveOverlayAppearance,
  setOverlayPluginFonts,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import { detectClientPlatform } from '../config/platform';
import {
  loadThemePackages,
  type LoadedOverlayThemePackage,
} from '../config/themePackages';
import {
  createExplorerDir,
  getExplorerDrives,
  getExplorerHomeDir,
  listExplorerLocation,
  listExplorerLocationUncached,
  openExplorerPath,
  transferExplorerItems,
  type ExplorerDriveInfo,
  type ExplorerLocationListing,
} from '../runtime/explorerBackend';
import {
  describeFileOperationsWindowRequest,
  listenToFileOperationsWindowRequests,
  openFileOperationsWindow,
  publishFileOperationsTransferCompleted,
  readFileOperationsWindowRequest,
  type FileOperationsWindowRequest,
} from '../runtime/fileOperationsWindow';
import { useFolderPluginRuntime } from '../runtime/useFolderPluginRuntime';
import {
  useExplorerTaskProgressFeed,
  useExplorerTaskSnapshots,
} from '../store/explorerTaskStore';
import { useSettingsStore } from '../store/settingsStore';
import { ExplorerTaskCenterContent } from '../components/explorer/ExplorerTaskCenterContent';
⋮----
type FileOperationsView = 'tasks' | 'transfer';
⋮----
function getPathLeaf(path: string): string
⋮----
function joinDestinationPath(parentPath: string, childName: string): string
⋮----
function isTransferRequest(
  request: FileOperationsWindowRequest | null,
): request is Extract<FileOperationsWindowRequest,
⋮----
const handleResize = ()
⋮----
onClick=
⋮----
event.preventDefault();
navigateToPath(pathInput);
⋮----
<ActionButton onClick=
````

## File: App.css
````css
html, body, #root {
⋮----
.overlay-window-host {
⋮----
/* Shared scroll system for overlay panels */
.overlay-scroll-area {
⋮----
.overlay-scroll-area__viewport {
⋮----
.overlay-scroll-area__viewport::-webkit-scrollbar {
⋮----
.overlay-scroll-area__viewport--vertical {
⋮----
.overlay-scroll-area__viewport--horizontal {
⋮----
.overlay-scroll-area__viewport--both {
⋮----
.overlay-scroll-area__viewport--explorer-file-list {
⋮----
.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar {
⋮----
.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar-track {
⋮----
.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar-thumb {
⋮----
.overlay-scroll-area__viewport--explorer-file-list:hover::-webkit-scrollbar-thumb {
⋮----
.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar-corner {
⋮----
.overlay-scroll-area__content {
⋮----
.custom-scrollbar,
⋮----
.custom-scrollbar::-webkit-scrollbar,
⋮----
.source-tab {
⋮----
/* ── Git diff line decorations (Monaco plaintext mode with custom coloring) ── */
⋮----
.source-diff-line--added {
⋮----
.source-diff-line--deleted {
⋮----
.source-diff-line--hunk {
⋮----
/* Inline text coloring overrides — must beat Monaco's span rules */
.source-diff-text--added,
⋮----
.source-diff-text--deleted,
⋮----
.source-diff-text--hunk,
````

## File: App.tsx
````typescript
import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useShallow } from 'zustand/react/shallow';
import {
  currentMonitor,
  getCurrentWindow,
  monitorFromPoint,
  primaryMonitor,
} from '@tauri-apps/api/window';
import {
  createBuiltInPanelDefinitions,
  createFolderPluginPanelDefinitions,
  type OverlayPanelDefinition,
} from './panels/panelRegistry';
import { FolderPluginRenderer, PluginsManager } from './components/PluginsManager';
import { CommandPalette, type OverlayCommandPaletteAction } from './components/CommandPalette';
import { animationSystemConfig, resolvePreferredAnimationId } from './config/animations';
import { wallpaperSystemConfig } from './config/wallpapers';
import {
  groupPanelsForWorkbenchNavigation,
  resolveWorkbenchRenderRuntime,
  type ResolvedWorkbenchRenderRuntime,
} from './config/workbenchRenderRuntime';
import {
  recordOverlayFrameTelemetry,
  shouldFlushOverlayFrameWindow,
  summarizeOverlayFrameWindow,
  type OverlayFrameTelemetryStats,
} from './config/frameTelemetry';
import {
  pluginSystemConfig,
} from './config/plugins';
import {
  AnimationOverlayLayer,
  createBuiltInOverlayAnimations,
  isFrontendAnimationFile,
  loadAnimationFromSource,
  mergeOverlayAnimations,
  resolveAnimationDurationMs,
  resolveAnimationShellStyle,
  type LoadedOverlayAnimation,
} from './components/animationRuntime';
import { shaderSystemConfig, resolvePreferredShaderId } from './config/shaders';
import {
  ShaderSurfaceLayer,
  createBuiltInOverlayShaders,
  isFrontendShaderFile,
  loadShaderFromSource,
  mergeOverlayShaders,
  resolveShaderControlValues,
  type LoadedOverlayShader,
  type OverlayShaderShellContext,
} from './components/shaderRuntime';
import {
  WallpaperBackgroundLayer,
  createMediaWallpaperFromFile,
  createThemeAssetWallpaper,
  isFrontendWallpaperFile,
  isMediaWallpaperFile,
  loadWallpaperFromSource,
  resolveActiveWallpaper,
  type LoadedOverlayWallpaper,
  type OverlayWallpaperRenderContext,
  type ResolvedWallpaperSelection,
} from './components/wallpaperRuntime';
import {
  ThemeRendererBoundary,
  overlayThemeRendererApiVersion,
  type OverlayThemeRendererHost,
  type OverlayThemeRendererPanel,
} from './components/themeRendererRuntime';
import {
  normalizeThemeRendererShellLayout,
  type OverlayThemeRendererShellModel,
  type OverlayThemeRendererSurfaceOwnership,
} from './components/themeRendererShellModel';
import {
  Check,
  ChevronDown,
  Droplet,
  LayoutGrid,
  Search,
  Settings2,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';
import {
  ensureFontFamilyLoaded,
  resolveOverlayAppearance,
  setOverlayPluginFonts,
  type ResolvedOverlayAppearance,
} from './config/appearance';
import { loadThemePackages as discoverThemePackages, themeSystemConfig, type LoadedOverlayThemePackage } from './config/themePackages';
import { dispatchTerminalCommand } from './config/pluginContributions';
import { formatHotkeyLabel, matchesKeybinding, matchesWheelHotkey } from './config/hotkeys';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  getNextLayoutProfileId,
  getPanelsBySide,
  getPinnedPanelIds,
  getTabbedOpenPanelIds,
  loadExternalLayoutManifest,
  resolveLayoutProfile,
  type LayoutPinnedPanel,
  type LayoutProfile,
} from './config/layoutProfiles';
import {
  clampOverlayAnimationDuration,
  clampOverlayAnimationIntensity,
  type OverlayAnimationDirection,
  type OverlayAnimationPhase,
} from './config/overlayAnimations';
import {
  computeAnchoredOverlayWindowLayout,
  clampOverlayVisualControlValue,
  type OverlayWindowBounds,
  overlayWindowGeometry,
  overlayVisualControls,
} from './config/overlayWindow';
import { detectClientPlatform, joinPlatformPath, type RuntimePlatform } from './config/platform';
import { derivePanelOpenState, reorderPanelIds } from './components/panelUtils';
import { OverlayScrollArea } from './components/OverlayScrollArea';
import { WorkbenchNavigationSurface } from './components/WorkbenchNavigationSurface';
import { WindowControls } from './components/WindowControls';
import { DevPerformanceHud } from './components/DevPerformanceHud';
import { useGlobalShortcut } from './input/GlobalShortcuts';
import {
  buildThemeVisualStyle,
  computePanelWindowLayout,
  ensureDir,
  parseExternalArgs,
} from './runtime/overlayRuntimeUtils';
import {
  FILESYSTEM_AQUARIUM_PANEL_ID,
  requestFilesystemAquariumOpen,
} from './runtime/filesystemAquariumBridge';
import {
  PLUGIN_PANEL_OPEN_REQUEST_EVENT,
  type PluginPanelOpenRequest,
} from './runtime/pluginPanelRequests';
import { openFileOperationsWindow } from './runtime/fileOperationsWindow';
import {
  listExplorerDir,
  openExplorerPath,
  queueExplorerTerminalDirectorySync,
  writeExplorerFile,
} from './runtime/explorerBackend';
import { commands, unwrapTauriResult } from './runtime/tauriClient';
import { useFolderPluginRuntime } from './runtime/useFolderPluginRuntime';
import {
  DOCK_WINDOW_HOST_LABEL,
  SHOW_WINDOW_MODE_REQUEST_EVENT,
  TOGGLE_OVERLAY_REQUEST_EVENT,
  emitWindowEventToHost,
  getCurrentWindowHostRole,
  hasSeparateWaylandDockHost,
  isWindowHostResponsibleForMode,
  resolvePresentationHostLabel,
  shouldRegisterGlobalShortcutForHost,
  type WindowHostRole,
} from './runtime/windowHost';
import {
  clearCompletedExplorerTasks,
  retryFailedExplorerTasks,
} from './store/explorerTaskStore';
import {
  useSettingsStore,
  resolveSystemPresentationState,
  type LayoutPanelState,
  type OverlayWindowAnchor,
  type TerminalWindowMode,
} from './store/settingsStore';
import { useTerminalStore } from './store/terminalStore';
⋮----
function clampValue(value: number, min: number, max: number): number
⋮----
function clampUnit(value: number): number
⋮----
function resolveConditionalBlurFilter(args: {
  enabled: boolean;
  blurPx: number;
  saturateBoost?: number;
}): string
⋮----
function sanitizeImportedWallpaperFileName(fileName: string): string
⋮----
function isThemeAssetDuplicatedInEffects(backgroundUrl: string | undefined, backgroundImage: string | undefined): boolean
⋮----
function applyWheelVisualControlAdjust(args: {
  event: WheelEvent;
  binding: string;
  currentValue: number;
  min: number;
  max: number;
  step: number;
  direction: 1 | -1;
  multiplier: number;
onChange: (value: number)
⋮----
function parseHexColor(color: string):
⋮----
function parseFunctionalColor(color: string):
⋮----
function parseColor(color: string):
⋮----
function withColorAlpha(color: string, alpha: number): string
⋮----
function getColorAlpha(color: string, fallback: number): number
⋮----
function resolveShellBackgroundColor(
  translucentColor: string,
  solidColor: string,
  blurStrength: number,
): string
⋮----
function uniquePanelIds(ids: string[]): string[]
⋮----
function areStringArraysEqual(left: string[], right: string[]): boolean
⋮----
function areLayoutPanelStatesEqual(left: LayoutPanelState, right: LayoutPanelState): boolean
⋮----
function sanitizeLayoutPanelState(
  panelState: LayoutPanelState | undefined,
  availablePanelIds: string[],
  pinnedPanelIds: string[],
): LayoutPanelState
⋮----
const normalizeIds = (ids: string[]) => uniquePanelIds(
    ids.filter(id => availableSet.has(id) && !pinnedSet.has(id)),
  );
⋮----
function resolveActiveTabPanelId(args: {
  activePanelId: string | null;
  openPanelIds: string[];
  defaultActivePanelId: string;
}): string | null
⋮----
function LayoutPinnedPanelSlot({
  panel,
  definition,
}: {
  panel: LayoutPinnedPanel;
  definition: OverlayPanelDefinition;
})
⋮----
// ─── Main App ─────────────────────────────────────────────────────────────────
⋮----
// Tracks whether the overlay has been dragged away from its anchor position
⋮----
const syncViewport = () =>
⋮----
// The dedicated Wayland dock host must stay on the layer-shell geometry path
// even during cross-window handoff, before its local persisted windowMode has
// rehydrated to `overlay`.
⋮----
// ── Boot store ──
⋮----
const syncDesktopPresentation = async () =>
⋮----
const tick = (frameNow: number) =>
⋮----
// Ignore hide failures during host handoff and shutdown.
⋮----
const rememberMonitor = (
      monitor: Awaited<ReturnType<typeof currentMonitor>>,
) =>
⋮----
const sync = async () =>
⋮----
// ── Position & show ──
⋮----
const commitOpenPhase = () =>
⋮----
// Atomic: set decorations + geometry in one call
⋮----
// Already maximized — just set the presentation flags, skip geometry
⋮----
const handlePluginPanelOpenRequest = (event: Event) =>
⋮----
// Ignore hide failures during teardown.
⋮----
const syncInitialPresentation = async () =>
⋮----
// Ignore hide failures during drag teardown.
⋮----
const handleKeydown = (event: KeyboardEvent) =>
⋮----
const repositionOverlay = async () =>
⋮----
const handleWheelZoom = (event: WheelEvent) =>
⋮----
// ── Persist resize ──
⋮----
// ── Explorer → Terminal bridge ──
⋮----
const flushWindow = () =>
⋮----
const syncNativeBlur = async () =>
⋮----

⋮----
onBlurChange=
⋮----
commandPaletteShortcutLabel=
⋮----
onSelect: () =>
⋮----
// ─── TopBar ───────────────────────────────────────────────────────────────────
⋮----
const handlePointerDown = (event: PointerEvent) =>
⋮----
const handleResize = () =>
⋮----
onPanelSelect(panel.id);
⋮----
setIsMenuOpen(false);
onSetWindowMode(windowMode === 'windowed' ? 'overlay' : 'windowed');
⋮----
title=
⋮----
onClick=
⋮----
onDragEnd=
⋮----
event.stopPropagation();
onPanelClose(panel.id);
````

## File: index.css
````css
html, body {
⋮----
#root {
````

## File: main.tsx
````typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
⋮----
import {
    shouldAllowDocumentSelection,
    shouldAllowNativeContextMenu,
} from "./runtime/documentInteractionGuards";
import {
    formatGlobalErrorDetail,
    reportGlobalError,
} from "./runtime/globalErrorPanel";
import { initializeManagedContentDirectories } from "./config/appContentDirectories";
import { FILE_OPERATIONS_WINDOW_LABEL } from "./runtime/fileOperationsWindow";
⋮----
// Disable default browser context menu globally for Tauri
⋮----
// Disable text selection on double-click
⋮----
async function resolveBootstrapComponent()
⋮----
// Fall back to the main app bootstrap when the webview label is unavailable.
⋮----
async function bootstrapApp()
````

## File: vite-env.d.ts
````typescript
/// <reference types="vite/client" />
````
