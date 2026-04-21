/**
 * FileExplorer — UE5-feel file explorer
 *
 * v2 changes vs v1:
 *  ✓ Theme-aware SVG icon system with canonical file and folder ids
 *  ✓ Ctrl+C / Ctrl+V system clipboard (navigator.clipboard)
 *  ✓ Resizable preview pane (drag handle)
 *  ✓ Images loaded via fs_read_file_base64 (data-URI) — no asset-protocol issues
 */

import React, {
  Suspense,
  startTransition,
  useDeferredValue,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useId,
  type CSSProperties,
} from "react";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useShallow } from "zustand/react/shallow";
import type { EditorProps as MonacoEditorProps } from "@monaco-editor/react";
import {
  ChevronRight,
  ChevronLeft,
  ArrowUp,
  Search,
  RefreshCw,
  X,
  Star,
  StarOff,
  Terminal,
  Trash2,
  Copy,
  Scissors,
  Clipboard,
  Edit3,
  ExternalLink,
  Shield,
  Eye,
  Info,
  Loader,
  Pin,
  PinOff,
  Puzzle,
  Sparkles,
  Waves,
  FilePlus,
  FolderPlus,
  CopyPlus,
  LayoutGrid,
  List,
  Save,
  SquareSplitHorizontal,
  Tags,
  Undo2,
  AlertTriangle,
} from "@/components/AppIcons";
import type { ResolvedOverlayAppearance } from "../config/appearance";
import {
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  createLegacyExplorerActionContextMenuContributions,
  isExplorerContextMenuItemEnabled,
  normalizePluginContextMenuContributions,
  sortExplorerContextMenuItems,
  type ExplorerContextMenuItemGroup,
} from "../config/explorerContextMenu";
import {
  getExplorerArchiveExtractToFolderLabel,
  isExplorerArchiveEntry,
  type ExplorerArchiveFormatDescriptor,
} from "../config/explorerArchives";
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from "../config/pluginContributions";
import { getExplorerRailWidthBounds } from "../config/explorerRail";
import {
  explorerExperimentalModes,
  getAdaptiveSemanticDensityPercent,
  getAdaptiveSemanticDensityStop,
  getExplorerExperimentalDensityDescriptor,
  getExplorerExperimentalModeDefinition,
  stepAdaptiveSemanticDensity,
  type AdaptiveSemanticDensityStopDefinition,
  type ExplorerExperimentalViewMode,
} from "../config/explorerExperimentalModes";
import {
  EXPLORER_PREVIEW_WIDTH_BOUNDS,
  getExplorerShellLayoutDefinition,
  getExplorerShellLayoutWidthSuggestion,
  type ExplorerPreviewPlacement,
  type ExplorerShellLayoutDefinition,
} from "../config/explorerShellLayouts";
import {
  applyExplorerThemeToAdaptiveDensityStop,
  applyExplorerThemeToGridMetrics,
  applyExplorerThemeToRowMetrics,
  resolveExplorerThemeRecipe,
  type ResolvedExplorerThemeRecipe,
} from "../config/explorerTheme";
import {
  explorerModeProfiles,
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
  type ExplorerModeProfileDefinition,
} from "../config/explorerModeProfiles";
import { getFolderIconSrc, resolveFolderIcon } from "../config/folderIcons";
import {
  getBuiltInIconTheme,
  resolveFileIcon,
  resolveFileIconSrc,
  resolveIconSrc,
  type OverlayResolvedIconTheme,
} from "../config/iconTheme";
import type { ExplorerLayoutMode } from "../config/layoutProfiles";
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
  type ExplorerViewPresentation,
} from "../config/explorerViewModes";
import { matchesKeybinding } from "../config/hotkeys";
import {
  DEFAULT_NATIVE_ICON_SIZE,
  getNativeIconCacheKey,
  type OverlayNativeIconRequest,
} from "../config/nativeIcons";
import {
  detectClientPlatform,
  getFallbackExplorerPath,
  getPlatformPathSeparator,
  joinPlatformPath,
  type RuntimePlatform,
} from "../config/platform";
import { pluginSystemConfig } from "../config/plugins";
import {
  getShaderPerformanceProfile,
  type ShaderPerformanceMode,
} from "../config/shaders";
import { requestPluginPanelOpen } from "../runtime/pluginPanelRequests";
import {
  listenToFileOperationsTransferCompleted,
  openFileOperationsWindow,
  publishFileOperationsTransferCompleted,
  type FileOperationsTransferCompletedEventDetail,
} from "../runtime/fileOperationsWindow";
import {
  recordExplorerPerformanceSample,
  type ExplorerPerformanceMetadata,
  type ExplorerPerformanceMetricId,
} from "../config/performanceTelemetry";
import {
  finalizePendingExplorerMetricSamples,
  getRuntimeCachePolicyTelemetryMetadata,
  type PendingExplorerMetricSample,
  type RuntimeCachePolicyTelemetryMetadata,
} from "../config/runtimeCachePolicy";
import { getExplorerSearchTelemetryMetadata } from "../config/searchTelemetry";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { AppPromptDialog } from "./AppModal";
import { ExplorerAudioWorkbench } from "./ExplorerAudioWorkbench";
import { ExplorerImageEditor } from "./ExplorerImageEditor";
import { ExplorerShaderWorkbench } from "./ExplorerShaderWorkbench";
import { ExplorerVideoEditor } from "./ExplorerVideoEditor";
import { ExplorerArchivePreview } from "./ExplorerArchivePreview";
import { ExplorerFolderPreview } from "./ExplorerFolderPreview";
import { ExplorerFontPreview } from "./ExplorerFontPreview";
import { ExplorerSpreadsheetWorkbench } from "./ExplorerSpreadsheetWorkbench";
import { ExplorerDocxWorkbench } from "./ExplorerDocxWorkbench";
import {
  ExplorerPdfWorkbench,
  type ExplorerPdfWorkbenchChromeState,
  type ExplorerPdfWorkbenchController,
} from "./ExplorerPdfWorkbench";
import { ExplorerSqlitePreview } from "./ExplorerSqlitePreview";
import {
  type ExplorerBatchRenameMode,
  type ExplorerBatchRenamePreviewRow,
} from "./explorerBatchRename";
import {
  appendExplorerJumpFilterCharacter,
  isExplorerJumpFilterPrintableKey,
  removeExplorerJumpFilterCharacter,
} from "./explorerJumpFilter";
import { ExplorerSideRail } from "./explorer/ExplorerSideRail";
import { ExplorerChromeSurface } from "./explorer/ExplorerChromeSurface";
import {
  buildConstellationFieldLayout,
  type ConstellationFieldBand,
  type ConstellationFieldNode,
} from "./explorer/constellationLayout";
import {
  CONSTELLATION_CAMERA_ZOOM_RANGE,
  clampConstellationCameraPan,
  centerConstellationCameraOnNode,
  createConstellationFitCamera,
  getConstellationFitZoom,
  getConstellationWheelZoom,
  zoomConstellationCameraAtViewportPoint,
  type ConstellationCameraState,
  type ConstellationViewportMetrics,
} from "./explorer/constellationCamera";
import { ExplorerTaskStatusBadge } from "./explorer/ExplorerTaskStatusBadge";
import TerminalOverlay, {
  type TerminalOverlayCommandRequest,
} from "./TerminalOverlay";
import {
  invalidateExplorerDirectoryResultCaches,
  loadCachedExplorerLocation,
  storeExplorerCachedLocation,
} from "./explorer/explorerDirectoryCache";
import {
  estimateStringPreviewCacheBytes,
  invalidateExplorerPreviewCache,
  readCachedExplorerPreview,
  storeCachedExplorerPreview,
} from "./explorer/explorerPreviewCache";
import {
  buildExplorerDraftPreservedMessage,
  clearExplorerEditDraft,
  createStringExplorerDraftSerializer,
  loadExplorerEditDraft,
  moveExplorerEditDraft,
  persistExplorerEditDraft,
} from "./explorer/explorerEditSession";
import {
  buildExplorerPreviewErrorFallback,
  buildExplorerPreviewLoadingFallback,
  buildExplorerUnsupportedPreviewFallback,
  resolveExplorerPreviewDescriptor,
} from "./explorer/explorerPreviewSystem";
import {
  probeExecutableTextScriptPreview,
  type ExplorerResolvedScriptPreview,
} from "./explorer/explorerScriptRuntime";
import {
  removeExplorerBookmarksByPath,
  upsertExplorerBookmark,
} from "./explorer/explorerRailState";
import {
  getRepositoryPickerConfirmLabel,
  resolveRepositoryPickerConfirmationPaths,
} from "./explorer/repositoryPickerState";
import { ResizablePane } from "./ResizablePane";
import {
  PRIMARY_EXPLORER_INSTANCE_ID,
  defaultExplorerSession,
  useExplorerStore,
  type ExplorerDocumentViewMode,
  type ExplorerInstanceId,
  type ExplorerPreviewSplitMode,
  type ExplorerPropertiesPanelSnapshot,
  type ExplorerPropertiesPanelTab,
  type ExplorerRecursiveSizeCacheEntry,
} from "../store/explorerStore";
import { useExplorerTaskProgressFeed } from "../store/explorerTaskStore";
import { useSettingsStore } from "../store/settingsStore";
import {
  shouldOpenExplorerEntryOnTrigger,
  shouldNavigateUpOnEmptyExplorerDoubleClick,
  shouldShowExplorerFolderOpenIcon,
} from "./fileExplorerClickBehavior";
import { resolveExplorerSearchScope } from "./fileExplorerSearchScope";
import type { DocumentPreviewKind } from "./documentPreview";
import {
  isAudioPreviewExtension,
  isEditableImagePreviewExtension,
  isExecutableBinaryExtension,
  isVideoPreviewExtension,
  type ModelPreviewFormat,
  type ShaderPreviewFormat,
} from "../config/filePreview";
import {
  EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG,
  canRenderExplorerThumbnail,
} from "../config/explorerThumbnails";
import {
  buildExplorerMonacoPreviewOptions,
  getExplorerTextPreviewMetrics,
} from "../config/explorerMonaco";
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
  type EditorSearchFocusTarget,
} from "./fileExplorerSearchFocus";
import { buildTerminalScriptRunCommand } from "./terminalCommandUtils";
import {
  dispatchTerminalCommand,
  resolvePluginCommandTemplate,
} from "../config/pluginContributions";
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
} from "../runtime/explorerBackend";
import { runExplorerAudioBatchProcess } from "../runtime/audioWorkbenchBackend";
import {
  openExplorerPdfPreviewDocument,
  type ExplorerPdfPreviewDocument,
  type ExplorerPdfSaveEditsOutput,
} from "../runtime/pdfPreviewBackend";
import {
  inspectExplorerShaderPreviewDocument,
  type ExplorerShaderPreviewCompileOutput,
  type ExplorerShaderPreviewDiagnostic,
  type ExplorerShaderPreviewEntryPoint,
  type ExplorerShaderPreviewStage,
} from "../runtime/shaderPreviewBackend";
import { commands, unwrapTauriResult } from "../runtime/tauriClient";
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
} from "../config/explorerChromeLayouts";

const LazyModelPreview = React.lazy(() =>
  import("./ModelPreview").then((module) => ({ default: module.ModelPreview })),
);

const LazyTextDocumentPreview = React.lazy(() =>
  import("./documentPreview").then((module) => ({
    default: module.TextDocumentPreview,
  })),
);

const LazyMonacoEditor = React.lazy(async () => {
  const module = await import("@monaco-editor/react");
  return { default: module.default as React.ComponentType<MonacoEditorProps> };
});

const EXPLORER_LIST_ROW_HEIGHT = 44;
const EXPLORER_LIST_SEARCH_ROW_HEIGHT = 72;
const EXPLORER_LIST_OVERSCAN = 8;
const EXPLORER_GRID_OVERSCAN_ROWS = 2;
const EXPLORER_LAYOUT_WHEEL_STEP_DELTA = 80;
const EXPLORER_THUMBNAIL_TYPE_BADGE_MIN_STAGE_PX = 36;
const EXPLORER_THUMBNAIL_TYPE_BADGE_KINDS = new Set<
  ExplorerEntryThumbnailData["kind"]
>(["code", "shader"]);
const EXPLORER_ENTRY_SIZE_BATCH_SETTLE_MS = 72;
const EXPLORER_NATIVE_ICON_BATCH_SETTLE_MS = 96;
const EXPLORER_IMAGE_TILE_THUMBNAIL_BATCH_SETTLE_MS = 88;
const EXPLORER_TEXT_DRAFT_SCOPE = "text";
const EXPLORER_SHADER_DRAFT_SCOPE = "shader";
const explorerStringDraftSerializer = createStringExplorerDraftSerializer();

type ExplorerDragPreviewContent = {
  primaryLabel: string;
  itemCount: number;
};

let transparentExplorerDragImage: HTMLCanvasElement | null = null;
let explorerDragPreviewCanvas: HTMLCanvasElement | null = null;

type ExplorerSearchCacheEntry = {
  results: FileSearchResult[];
  diagnostics: Awaited<
    ReturnType<ExplorerBackendContract["searchEntriesWithDiagnostics"]>
  >["diagnostics"];
};

const explorerSearchResultCache = new Map<
  string,
  Promise<ExplorerSearchCacheEntry> | ExplorerSearchCacheEntry
>();

function getExplorerSearchCacheKey(args: {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent: boolean;
}): string {
  return [
    args.path,
    args.query.trim().toLowerCase(),
    args.showHidden ? "hidden" : "visible",
    args.includeContent ? "content" : "names",
  ].join("::");
}

async function getOrLoadCachedExplorerSearchResults(
  key: string,
  loader: () => Promise<ExplorerSearchCacheEntry>,
): Promise<ExplorerSearchCacheEntry> {
  const cachedValue = explorerSearchResultCache.get(key);
  if (cachedValue) {
    return cachedValue instanceof Promise ? cachedValue : cachedValue;
  }

  const pending = loader()
    .then((results) => {
      explorerSearchResultCache.set(key, results);
      return results;
    })
    .catch((error) => {
      explorerSearchResultCache.delete(key);
      throw error;
    });
  explorerSearchResultCache.set(key, pending);
  return pending;
}

export function invalidateExplorerResultCaches(pathPrefix?: string): void {
  invalidateExplorerDirectoryResultCaches(pathPrefix);
  invalidateExplorerPreviewCache(pathPrefix);
  if (!pathPrefix) {
    explorerSearchResultCache.clear();
    return;
  }

  for (const key of explorerSearchResultCache.keys()) {
    if (
      key.startsWith(`${pathPrefix}::`) ||
      key.includes(`::${pathPrefix}::`)
    ) {
      explorerSearchResultCache.delete(key);
    }
  }
}

function readViewportMetrics(viewport: HTMLDivElement): ViewportMetrics {
  return {
    scrollTop: viewport.scrollTop,
    clientHeight: viewport.clientHeight,
    clientWidth: viewport.clientWidth,
  };
}

function getExplorerPerformanceNow(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function getDocumentPreviewKind(path: string): DocumentPreviewKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "md" || ext === "markdown" || ext === "mdx") {
    return "markdown";
  }
  if (ext === "html" || ext === "htm") {
    return "html";
  }
  return "none";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViewportMetrics {
  scrollTop: number;
  clientHeight: number;
  clientWidth: number;
}
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  entry: FileEntry | null;
}
interface RenameState {
  active: boolean;
  path: string;
  name: string;
}
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
  mode: "add" | "remove";
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
  | { type: "none"; path: string }
  | {
      type: "image";
      path: string;
      name: string;
      extension: string;
      content: string;
    }
  | {
      type: "spreadsheet";
      path: string;
      name: string;
      extension: string;
      size: number;
      fileKind: "workbook" | "tabular";
    }
  | {
      type: "audio";
      path: string;
      name: string;
      source: string;
      extension: string;
      mimeType: string | null;
      size: number;
    }
  | {
      type: "video";
      path: string;
      name: string;
      source: string;
      extension: string;
      mimeType: string | null;
      size: number;
    }
  | {
      type: "font";
      path: string;
      name: string;
      source: string;
      extension: string;
      size: number;
    }
  | {
      type: "sqlite";
      path: string;
      name: string;
      size: number;
    }
  | {
      type: "pdf";
      path: string;
      name: string;
      size: number;
      document: ExplorerPdfPreviewDocument;
    }
  | {
      type: "text";
      path: string;
      name: string;
      content: string;
      language: string;
      renderKind: DocumentPreviewKind;
      scriptPreview: ExplorerResolvedScriptPreview | null;
      focusTarget: EditorSearchFocusTarget | null;
      isDirty: boolean;
      isSaving: boolean;
      lastSavedAt: number | null;
      error: string | null;
    }
  | {
      type: "shader";
      path: string;
      name: string;
      size: number;
      format: ShaderPreviewFormat;
      editableSource: string | null;
      inspectionSource: string;
      isReadOnly: boolean;
      selectedScene: "sphere" | "fullscreen";
      selectedStage: ExplorerShaderPreviewStage | null;
      selectedEntryPoint: string | null;
      entryPoints: ExplorerShaderPreviewEntryPoint[];
      diagnostics: ExplorerShaderPreviewDiagnostic[];
      normalizedWgsl: string | null;
      previewAbi: string;
      supportsLivePreview: boolean;
      isDirty: boolean;
      isSaving: boolean;
      error: string | null;
    }
  | {
      type: "model3d";
      path: string;
      format: ModelPreviewFormat;
      name: string;
      size: number;
    }
  | {
      type: "folder";
      path: string;
      name: string;
    }
  | {
      type: "archive";
      path: string;
      name: string;
      size: number;
      descriptor: ExplorerArchiveFormatDescriptor;
    }
  | {
      type: "docx";
      path: string;
      name: string;
      extension: string;
      size: number;
    }
  | {
      type: "fallback";
      path: string;
      name: string;
      label: string;
      detail?: string;
    };
type PreviewCloseGuard = () => Promise<boolean>;
type PreviewSurfaceMode = "content" | "terminal";
type ExplorerShaderSelectionMemory = {
  selectedStage: ExplorerShaderPreviewStage | null;
  selectedEntryPoint: string | null;
};
type SpreadsheetWorkbenchStatus = {
  isDirty: boolean;
  isSaving: boolean;
};
interface NewItemState {
  visible: boolean;
  kind: "file" | "folder";
}
type ExplorerDragIntent = "internal" | "native-out";
type ExplorerSortKey = "name" | "size" | "date" | "type";
interface PendingExplorerTransferRequest {
  targetDir: string;
  sources: string[];
  operation: FileTransferOperation;
  collisionPolicy?: ExplorerFileTransferCollisionPolicy;
}

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

// ─── Palette ─────────────────────────────────────────────────────────────────

const EXP = {
  bg: "var(--overlay-bg-shell)",
  panel: "var(--overlay-bg-panel)",
  sidebar: "var(--overlay-bg-sidebar)",
  card: "var(--overlay-bg-card)",
  cardHov: "var(--overlay-bg-card-hover)",
  border: "var(--overlay-border)",
  accent: "var(--overlay-accent)",
  accent2: "var(--overlay-accent)",
  text: "var(--overlay-text-primary)",
  muted: "var(--overlay-text-muted)",
  muted2: "var(--overlay-text-dim)",
  selected: "var(--overlay-bg-selection)",
  selBord: "var(--overlay-accent)",
  red: "var(--overlay-danger)",
  green: "var(--overlay-success)",
  yellow: "var(--overlay-warning)",
};

function getPathLeaf(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "Home";
  }
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? trimmed) : trimmed;
}

function getPathParent(path: string): string | null {
  const trimmed = path.trim().replace(/[/\\]+$/, "");
  if (!trimmed) {
    return null;
  }

  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }

  const nextPath = trimmed.replace(/[/\\][^/\\]+$/, "");
  if (nextPath === trimmed) {
    return trimmed.startsWith("/") ? "/" : null;
  }

  if (/^[A-Za-z]:$/.test(nextPath)) {
    return `${nextPath}\\`;
  }

  return nextPath || (trimmed.startsWith("/") ? "/" : null);
}

function isSameOrDescendantPath(path: string, candidate: string): boolean {
  const normalizedPath = path.trim().replace(/[/\\]+$/, "");
  const normalizedCandidate = candidate.trim().replace(/[/\\]+$/, "");
  if (!normalizedPath || !normalizedCandidate) {
    return false;
  }

  if (normalizedPath === normalizedCandidate) {
    return true;
  }

  return (
    normalizedPath.startsWith(`${normalizedCandidate}/`) ||
    normalizedPath.startsWith(`${normalizedCandidate}\\`)
  );
}

function shouldRefreshExplorerForTransferEvent(
  currentPath: string,
  detail: FileOperationsTransferCompletedEventDetail,
): boolean {
  const normalizedCurrentPath = currentPath.trim();
  if (!normalizedCurrentPath) {
    return false;
  }

  if (normalizedCurrentPath === detail.targetDir.trim()) {
    return true;
  }

  return detail.sourcePaths.some((sourcePath) => {
    const parentPath = getPathParent(sourcePath);
    return (
      parentPath === normalizedCurrentPath ||
      isSameOrDescendantPath(normalizedCurrentPath, sourcePath)
    );
  });
}

function toolbarChipButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: disabled
      ? "var(--overlay-explorer-chip-bg)"
      : "var(--overlay-explorer-chip-active-bg)",
    border: `1px solid ${disabled ? "var(--overlay-explorer-chip-border)" : "var(--overlay-explorer-chip-active-border)"}`,
    cursor: disabled ? "default" : "pointer",
    color: disabled ? EXP.muted2 : "var(--overlay-explorer-chip-active-text)",
    padding: "4px 8px",
    borderRadius: "var(--overlay-explorer-control-radius)",
    fontSize: 10,
    fontWeight: 700,
    opacity: disabled ? 0.55 : 1,
    flexShrink: 0,
  };
}

function toolbarToggleButtonStyle(
  active: boolean,
  disabled = false,
): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: active
      ? "var(--overlay-explorer-chip-active-bg)"
      : "var(--overlay-explorer-chip-bg)",
    border: `1px solid ${active ? "var(--overlay-explorer-chip-active-border)" : "var(--overlay-explorer-chip-border)"}`,
    cursor: disabled ? "default" : "pointer",
    color: disabled
      ? EXP.muted2
      : active
        ? "var(--overlay-explorer-chip-active-text)"
        : EXP.muted,
    padding: "4px 8px",
    borderRadius: "var(--overlay-explorer-control-radius)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: disabled ? 0.55 : 1,
  };
}

function toolbarIconButtonStyle(disabled = false): CSSProperties {
  return {
    background: "var(--overlay-explorer-chip-bg)",
    border: "1px solid transparent",
    cursor: disabled ? "default" : "pointer",
    color: disabled ? EXP.muted2 : EXP.muted,
    padding: 5,
    borderRadius: "var(--overlay-explorer-control-radius)",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  };
}

function toolbarActionButtonStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "var(--overlay-explorer-chip-bg)",
    border: "1px solid transparent",
    cursor: "pointer",
    color: EXP.muted,
    padding: "4px 7px",
    borderRadius: "var(--overlay-explorer-control-radius)",
    fontSize: "var(--overlay-explorer-toolbar-font-size)",
    flexShrink: 0,
  };
}

interface ExplorerEntrySurfaceState {
  background: string;
  borderColor: string;
  boxShadow: string;
  transform: string;
}

function getExplorerEntryStateSurface(
  explorerTheme: ResolvedExplorerThemeRecipe,
  state: "idle" | "selected" | "drop",
): ExplorerEntrySurfaceState {
  if (state === "idle") {
    return {
      background: "transparent",
      borderColor: "transparent",
      boxShadow: "none",
      transform: "translateY(0)",
    };
  }

  if (state === "drop") {
    const dropShadow =
      explorerTheme.selectionStyle === "glow"
        ? "var(--overlay-explorer-item-focus-shadow)"
        : "var(--overlay-explorer-toolbar-shadow)";
    return {
      background: "var(--overlay-explorer-item-drop-bg)",
      borderColor: "var(--overlay-explorer-item-drop-border)",
      boxShadow: `${dropShadow}, 0 0 0 1px var(--overlay-explorer-item-drop-border)`,
      transform: "translateY(calc(var(--overlay-explorer-hover-lift) * -1))",
    };
  }

  return {
    background:
      explorerTheme.selectionStyle === "outline"
        ? "transparent"
        : "var(--overlay-explorer-item-selected-bg)",
    borderColor: "var(--overlay-explorer-item-selected-border)",
    boxShadow:
      explorerTheme.selectionStyle === "glow"
        ? "var(--overlay-explorer-item-focus-shadow)"
        : "none",
    transform: "translateY(0)",
  };
}

function getExplorerHoverSurface(
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerEntrySurfaceState {
  return {
    background: "var(--overlay-explorer-item-hover-bg)",
    borderColor: "var(--overlay-explorer-item-hover-border)",
    boxShadow:
      explorerTheme.hoverStyle === "glow"
        ? "var(--overlay-explorer-item-focus-shadow)"
        : "none",
    transform:
      explorerTheme.hoverStyle === "lift" || explorerTheme.hoverStyle === "glow"
        ? "translateY(calc(var(--overlay-explorer-hover-lift) * -1))"
        : "translateY(0)",
  };
}

function applyExplorerEntrySurface(
  target: HTMLElement,
  surface: ExplorerEntrySurfaceState,
): void {
  target.style.background = surface.background;
  target.style.borderColor = surface.borderColor;
  target.style.boxShadow = surface.boxShadow;
  target.style.transform = surface.transform;
}

function shouldIgnoreExplorerDragLeave(event: React.DragEvent): boolean {
  const currentTarget = event.currentTarget as HTMLElement | null;
  if (!currentTarget) {
    return false;
  }

  const relatedTarget = event.relatedTarget;
  if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return true;
  }

  if (typeof document === "undefined") {
    return false;
  }

  const elementAtPointer = document.elementFromPoint(
    event.clientX,
    event.clientY,
  );
  return (
    elementAtPointer instanceof Node && currentTarget.contains(elementAtPointer)
  );
}

const EXPLORER_MAIN_DROP_TARGET = "__main__";
const EXPLORER_DROP_TARGET_ATTRIBUTE = "data-overlay-drop-target-path";

type NativeDragDropPositionLike = {
  x: number;
  y: number;
  toLogical?: (scaleFactor: number) => { x: number; y: number };
};

type ExplorerSelectionNavigationDirection =
  | "up"
  | "down"
  | "left"
  | "right";

function resolveExplorerDropTargetPathFromPoint(
  position: NativeDragDropPositionLike,
  scaleFactor: number,
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const safeScaleFactor =
    Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const logicalPosition =
    typeof position.toLogical === "function"
      ? position.toLogical(safeScaleFactor)
      : {
          x: position.x / safeScaleFactor,
          y: position.y / safeScaleFactor,
        };
  const elementAtPointer = document.elementFromPoint(
    logicalPosition.x,
    logicalPosition.y,
  );
  if (!(elementAtPointer instanceof Element)) {
    return null;
  }

  const dropTarget = elementAtPointer.closest(
    `[${EXPLORER_DROP_TARGET_ATTRIBUTE}]`,
  );
  return dropTarget?.getAttribute(EXPLORER_DROP_TARGET_ATTRIBUTE) ?? null;
}

function matchesExplorerSelectionNavigationKeybinding(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  binding: string,
): boolean {
  return (
    matchesKeybinding(event, binding) ||
    (event.shiftKey &&
      matchesKeybinding(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: false,
        },
        binding,
      ))
  );
}

function resolveExplorerDirectionalSelectionIndex(args: {
  currentIndex: number;
  totalEntries: number;
  direction: ExplorerSelectionNavigationDirection;
  presentation: ExplorerViewPresentation;
  gridColumnCount: number;
}): number {
  if (args.totalEntries <= 0) {
    return -1;
  }

  const maxIndex = args.totalEntries - 1;
  const safeCurrentIndex = Math.max(0, Math.min(args.currentIndex, maxIndex));

  if (args.presentation !== "grid") {
    if (args.direction === "up") {
      return Math.max(0, safeCurrentIndex - 1);
    }
    if (args.direction === "down") {
      return Math.min(maxIndex, safeCurrentIndex + 1);
    }
    return safeCurrentIndex;
  }

  const gridStep = Math.max(1, args.gridColumnCount);
  switch (args.direction) {
    case "up":
      return Math.max(0, safeCurrentIndex - gridStep);
    case "down":
      return Math.min(maxIndex, safeCurrentIndex + gridStep);
    case "left":
      return Math.max(0, safeCurrentIndex - 1);
    case "right":
      return Math.min(maxIndex, safeCurrentIndex + 1);
    default:
      return safeCurrentIndex;
  }
}

const EXT_TYPE_LABEL: Record<string, string> = {
  // Rust / Systems
  rs: "Rust",
  c: "C",
  h: "C Header",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++ Header",
  hxx: "C++ Header",
  zig: "Zig",
  d: "D",
  nim: "Nim",
  odin: "Odin",
  v: "V",
  // JVM / managed
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  cs: "C#",
  fs: "F#",
  fsi: "F#",
  fsx: "F# Script",
  vb: "VB.NET",
  scala: "Scala",
  groovy: "Groovy",
  clj: "Clojure",
  cljs: "ClojureScript",
  cljc: "Clojure",
  // Scripting
  py: "Python",
  pyw: "Python",
  rb: "Ruby",
  rbw: "Ruby",
  php: "PHP",
  pl: "Perl",
  pm: "Perl",
  lua: "Lua",
  tcl: "Tcl",
  r: "R",
  // TypeScript / JavaScript
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  // Web
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  // Shell
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  fish: "Shell",
  ksh: "Shell",
  ps1: "PowerShell",
  bat: "Batch",
  cmd: "Command",
  // Functional
  hs: "Haskell",
  lhs: "Haskell",
  ml: "OCaml",
  mli: "OCaml",
  ex: "Elixir",
  exs: "Elixir",
  erl: "Erlang",
  hrl: "Erlang",
  elm: "Elm",
  purs: "PureScript",
  lisp: "Lisp",
  el: "Emacs Lisp",
  scm: "Scheme",
  rkt: "Racket",
  f: "Fortran",
  f90: "Fortran",
  f95: "Fortran",
  // Go / Swift / Dart
  go: "Go",
  swift: "Swift",
  dart: "Dart",
  // Shader
  glsl: "GLSL",
  hlsl: "HLSL",
  wgsl: "WGSL",
  vert: "Shader",
  frag: "Shader",
  comp: "Compute Shader",
  metal: "Metal",
  // Data / config
  json: "JSON",
  jsonc: "JSON",
  json5: "JSON5",
  jsonl: "JSON Lines",
  toml: "TOML",
  yaml: "YAML",
  yml: "YAML",
  xml: "XML",
  ini: "Config",
  cfg: "Config",
  conf: "Config",
  env: "Env",
  properties: "Properties",
  hcl: "HCL",
  tf: "Terraform",
  tfvars: "Terraform",
  nix: "Nix",
  dhall: "Dhall",
  ron: "RON",
  kdl: "KDL",
  pkl: "Pkl",
  graphql: "GraphQL",
  gql: "GraphQL",
  proto: "Protobuf",
  fbs: "FlatBuffers",
  capnp: "Cap'n Proto",
  // Docs / markup
  md: "Markdown",
  mdx: "MDX",
  markdown: "Markdown",
  rst: "reStructuredText",
  adoc: "AsciiDoc",
  tex: "LaTeX",
  latex: "LaTeX",
  txt: "Text",
  log: "Log",
  // DB
  sql: "SQL",
  psql: "PostgreSQL",
  cql: "CQL",
  db: "Database",
  sqlite: "SQLite",
  sqlite3: "SQLite",
  // PDF
  pdf: "PDF",
  // Spreadsheet
  csv: "CSV",
  tsv: "TSV",
  xls: "Spreadsheet",
  xlsx: "Spreadsheet",
  xlsm: "Spreadsheet",
  xlsb: "Spreadsheet",
  ods: "Spreadsheet",
  // Word processor / rich text
  docx: "Word Document",
  doc: "Word Document",
  rtf: "Rich Text",
  odt: "OpenDocument Text",
  pptx: "PowerPoint",
  ppt: "PowerPoint",
  odp: "OpenDocument Presentation",
  epub: "E-Book",
  // Font
  ttf: "Font",
  otf: "Font",
  woff: "Font",
  woff2: "Font",
  // 3D
  fbx: "3D Model",
  obj: "3D Model",
  glb: "3D Model",
  gltf: "3D Model",
  stl: "3D Model",
  uasset: "UE Asset",
  uproject: "UE Project",
  // Image
  jpg: "Image",
  jpeg: "Image",
  png: "Image",
  gif: "Image",
  webp: "Image",
  bmp: "Image",
  ico: "Image",
  svg: "Vector",
  tiff: "Image",
  tif: "Image",
  avif: "Image",
  heic: "Image",
  heif: "Image",
  jxl: "Image",
  psd: "Photoshop",
  ai: "Illustrator",
  xcf: "GIMP",
  // Video
  mp4: "Video",
  mkv: "Video",
  avi: "Video",
  mov: "Video",
  wmv: "Video",
  flv: "Video",
  webm: "Video",
  // Audio
  mp3: "Audio",
  wav: "Audio",
  flac: "Audio",
  ogg: "Audio",
  m4a: "Audio",
  aac: "Audio",
  opus: "Audio",
  aiff: "Audio",
  // Archive
  zip: "Archive",
  rar: "Archive",
  "7z": "Archive",
  tar: "Archive",
  gz: "Archive",
  bz2: "Archive",
  xz: "Archive",
  zst: "Archive",
  lz4: "Archive",
  deb: "Debian Package",
  rpm: "RPM Package",
  dmg: "Disk Image",
  iso: "Disk Image",
  // Binary
  exe: "Executable",
  msi: "Installer",
  dll: "Library",
  so: "Library",
  dylib: "Library",
  // Blockchain / emerging
  sol: "Solidity",
  move: "Move",
  cairo: "Cairo",
  vyper: "Vyper",
  // Subtitles
  srt: "Subtitles",
  vtt: "WebVTT",
  ass: "Subtitles",
  ssa: "Subtitles",
  // Misc
  lock: "Lockfile",
  diff: "Diff",
  patch: "Patch",
  pem: "Certificate",
  crt: "Certificate",
  cer: "Certificate",
  pub: "Public Key",
  asc: "PGP Key",
  wat: "WebAssembly",
  jl: "Julia",
  coffee: "CoffeeScript",
  cr: "Crystal",
  // GIS
  geojson: "GeoJSON",
  gpx: "GPS Track",
  kml: "KML",
  kmz: "KMZ",
  shp: "Shapefile",
  prj: "Projection",
  // Project-specific
  kain: "Kain",
  ink: "Ink",
};

const FILENAME_TYPE_LABEL: Record<string, string> = {
  dockerfile: "Docker",
  makefile: "Makefile",
  rakefile: "Ruby",
  cmake: "CMake",
  ".gitignore": "Git",
  ".gitattributes": "Git",
  ".gitmodules": "Git",
  ".env": "Environment",
  ".env.local": "Environment",
  ".editorconfig": "EditorConfig",
  "package.json": "NPM Package",
  "package-lock.json": "NPM Lockfile",
  "cargo.toml": "Cargo Manifest",
  "cargo.lock": "Cargo Lockfile",
};

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) ||
    Boolean(element.closest(".monaco-editor"))
  );
}

function resolveExplorerDragIntent(
  event: Pick<React.DragEvent, "shiftKey" | "altKey" | "ctrlKey">,
): ExplorerDragIntent {
  return event.shiftKey ? "internal" : "native-out";
}

function fitExplorerDragPreviewLabel(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  const ellipsis = "...";
  for (let index = value.length - 1; index > 0; index -= 1) {
    const nextValue = `${value.slice(0, index)}${ellipsis}`;
    if (context.measureText(nextValue).width <= maxWidth) {
      return nextValue;
    }
  }

  return ellipsis;
}

function drawExplorerDragPreviewRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.arcTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
    safeRadius,
  );
  context.lineTo(x + safeRadius, y + height);
  context.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  context.lineTo(x, y + safeRadius);
  context.arcTo(x, y, x + safeRadius, y, safeRadius);
  context.closePath();
}

function renderExplorerDragPreviewCanvas(
  content: ExplorerDragPreviewContent,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  if (!explorerDragPreviewCanvas) {
    explorerDragPreviewCanvas = document.createElement("canvas");
  }

  const label = content.primaryLabel.trim() || "Item";
  const additionalItemCount = Math.max(0, content.itemCount - 1);
  const badgeText = additionalItemCount > 0 ? `+${additionalItemCount}` : "";
  const paddingX = 12;
  const previewHeight = 34;
  const dotSize = 8;
  const gap = 8;
  const labelMaxWidth = 220;
  const badgeHorizontalPadding = 7;
  const badgeVerticalPadding = 4;
  const devicePixelRatio =
    typeof window === "undefined"
      ? 1
      : Math.max(1, window.devicePixelRatio || 1);

  const previewContext = explorerDragPreviewCanvas.getContext("2d");
  if (!previewContext) {
    explorerDragPreviewCanvas.width = 1;
    explorerDragPreviewCanvas.height = 1;
    return explorerDragPreviewCanvas;
  }

  previewContext.font = "600 13px system-ui";
  const fittedLabel = fitExplorerDragPreviewLabel(
    previewContext,
    label,
    labelMaxWidth,
  );
  const labelWidth = Math.ceil(previewContext.measureText(fittedLabel).width);
  const badgeWidth = badgeText
    ? Math.ceil(previewContext.measureText(badgeText).width) +
      badgeHorizontalPadding * 2
    : 0;
  const previewWidth =
    paddingX * 2 +
    dotSize +
    gap +
    labelWidth +
    (badgeText ? gap + badgeWidth : 0);

  explorerDragPreviewCanvas.width = Math.ceil(previewWidth * devicePixelRatio);
  explorerDragPreviewCanvas.height = Math.ceil(
    previewHeight * devicePixelRatio,
  );
  explorerDragPreviewCanvas.style.width = `${previewWidth}px`;
  explorerDragPreviewCanvas.style.height = `${previewHeight}px`;

  previewContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  previewContext.clearRect(0, 0, previewWidth, previewHeight);
  previewContext.font = "600 13px system-ui";
  previewContext.textBaseline = "middle";

  // Read drag preview theme tokens from CSS vars at paint time
  const dragPreviewStyles =
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement)
      : null;
  const dragPreviewBg =
    dragPreviewStyles
      ?.getPropertyValue("--overlay-explorer-drag-preview-bg")
      .trim() || "rgba(18,18,24,0.96)";
  const dragPreviewBorder =
    dragPreviewStyles
      ?.getPropertyValue("--overlay-explorer-drag-preview-border")
      .trim() || "rgba(255,255,255,0.14)";
  const dragPreviewDot =
    dragPreviewStyles
      ?.getPropertyValue("--overlay-explorer-drag-preview-dot")
      .trim() || "#5aa2ff";

  previewContext.shadowColor = "rgba(0, 0, 0, 0.35)";
  previewContext.shadowBlur = 12;
  previewContext.shadowOffsetY = 8;
  drawExplorerDragPreviewRoundedRect(
    previewContext,
    0.5,
    0.5,
    previewWidth - 1,
    previewHeight - 1,
    12,
  );
  previewContext.fillStyle = dragPreviewBg;
  previewContext.fill();
  previewContext.shadowColor = "transparent";
  previewContext.shadowBlur = 0;
  previewContext.shadowOffsetY = 0;
  previewContext.strokeStyle = dragPreviewBorder;
  previewContext.lineWidth = 1;
  previewContext.stroke();

  previewContext.beginPath();
  previewContext.arc(
    paddingX + dotSize / 2,
    previewHeight / 2,
    dotSize / 2,
    0,
    Math.PI * 2,
  );
  previewContext.fillStyle = dragPreviewDot;
  previewContext.fill();

  const labelX = paddingX + dotSize + gap;
  previewContext.fillStyle = "rgba(255, 255, 255, 0.96)";
  previewContext.fillText(fittedLabel, labelX, previewHeight / 2);

  if (badgeText) {
    const badgeX = labelX + labelWidth + gap;
    const badgeHeight = 13 + badgeVerticalPadding * 2;
    const badgeY = (previewHeight - badgeHeight) / 2;
    drawExplorerDragPreviewRoundedRect(
      previewContext,
      badgeX,
      badgeY,
      badgeWidth,
      badgeHeight,
      badgeHeight / 2,
    );
    previewContext.fillStyle = "rgba(255, 255, 255, 0.08)";
    previewContext.fill();
    previewContext.fillStyle = "rgba(255, 255, 255, 0.72)";
    previewContext.fillText(
      badgeText,
      badgeX + badgeHorizontalPadding,
      previewHeight / 2,
    );
  }

  return explorerDragPreviewCanvas;
}

function applyExplorerNativeFeelingDragImage(
  dataTransfer: DataTransfer | null | undefined,
  content: ExplorerDragPreviewContent,
): void {
  if (
    !dataTransfer ||
    typeof dataTransfer.setDragImage !== "function" ||
    typeof document === "undefined"
  ) {
    return;
  }

  const dragPreviewCanvas = renderExplorerDragPreviewCanvas(content);
  if (dragPreviewCanvas) {
    dataTransfer.setDragImage(dragPreviewCanvas, 18, 18);
    return;
  }

  if (!transparentExplorerDragImage) {
    transparentExplorerDragImage = document.createElement("canvas");
    transparentExplorerDragImage.width = 1;
    transparentExplorerDragImage.height = 1;
  }

  dataTransfer.setDragImage(transparentExplorerDragImage, 0, 0);
}

function resolveExplorerDropOperation(
  event: Pick<React.DragEvent, "altKey" | "ctrlKey">,
  platform: RuntimePlatform,
): FileTransferOperation {
  if (platform === "macos") {
    return event.altKey ? "copy" : "move";
  }

  return event.ctrlKey ? "copy" : "move";
}

function formatExplorerNativeDragError(error: unknown): string {
  const message = String(error);
  if (/access is denied|denied|elevat|privilege|administrator/i.test(message)) {
    return "Native file drag was blocked by Windows permissions. If GreebleFS is running as Administrator, drag targets like Explorer/Desktop must be elevated too.";
  }

  return message;
}

function getDefaultExplorerSortOrder(sortBy: ExplorerSortKey): "asc" | "desc" {
  return sortBy === "size" || sortBy === "date" ? "desc" : "asc";
}

function getEntryExtension(
  entry: Pick<FileEntry, "is_dir" | "name" | "extension">,
): string {
  if (entry.is_dir) {
    return "";
  }

  const normalizedExtension = (entry.extension ?? "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  if (normalizedExtension) {
    return normalizedExtension;
  }

  const lastDotIndex = entry.name.lastIndexOf(".");
  if (lastDotIndex <= 0 || lastDotIndex === entry.name.length - 1) {
    return "";
  }

  return entry.name.slice(lastDotIndex + 1).toLowerCase();
}

function getPreviewAssetUrl(filePath: string): string {
  if (typeof window === "undefined") {
    return filePath;
  }

  try {
    return convertFileSrc(filePath);
  } catch {
    const normalized = filePath.replace(/\\/g, "/");
    return normalized.startsWith("/")
      ? `file://${encodeURI(normalized)}`
      : `file:///${encodeURI(normalized)}`;
  }
}

function getEntryTypeLabel(
  entry: Pick<FileEntry, "is_dir" | "name" | "extension">,
): string {
  if (entry.is_dir) {
    return "Folder";
  }

  const filename = entry.name.toLowerCase();
  if (FILENAME_TYPE_LABEL[filename]) {
    return FILENAME_TYPE_LABEL[filename];
  }

  const extension = getEntryExtension(entry);
  if (!extension) {
    return "File";
  }

  return EXT_TYPE_LABEL[extension] ?? `${extension.toUpperCase()} File`;
}

const EXPLORER_ENTRY_TEXT_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

function compareExplorerEntryText(left: string, right: string): number {
  return EXPLORER_ENTRY_TEXT_COLLATOR.compare(left, right);
}

function compareExplorerEntries(
  left: FileEntry,
  right: FileEntry,
  sortBy: ExplorerSortKey,
  sortOrder: "asc" | "desc",
): number {
  if (left.is_dir !== right.is_dir) {
    return left.is_dir ? -1 : 1;
  }

  let comparison = 0;
  switch (sortBy) {
    case "size":
      comparison = left.size - right.size;
      break;
    case "date":
      comparison = left.modified - right.modified;
      break;
    case "type":
      comparison = compareExplorerEntryText(
        getEntryTypeLabel(left),
        getEntryTypeLabel(right),
      );
      break;
    case "name":
    default:
      comparison = compareExplorerEntryText(left.name, right.name);
      break;
  }

  if (comparison === 0) {
    comparison = compareExplorerEntryText(left.name, right.name);
  }

  return sortOrder === "asc" ? comparison : -comparison;
}

function sortExplorerEntries(
  entries: FileEntry[],
  sortBy: ExplorerSortKey,
  sortOrder: "asc" | "desc",
): FileEntry[] {
  if (entries.length <= 1) {
    return entries;
  }

  if (sortBy !== "type") {
    return [...entries].sort((left, right) =>
      compareExplorerEntries(left, right, sortBy, sortOrder),
    );
  }

  const decoratedEntries = entries.map((entry, index) => ({
    entry,
    index,
    typeLabel: getEntryTypeLabel(entry),
  }));

  decoratedEntries.sort((left, right) => {
    if (left.entry.is_dir !== right.entry.is_dir) {
      return left.entry.is_dir ? -1 : 1;
    }

    let comparison = compareExplorerEntryText(left.typeLabel, right.typeLabel);
    if (comparison === 0) {
      comparison = compareExplorerEntryText(left.entry.name, right.entry.name);
    }
    if (comparison === 0) {
      comparison = left.index - right.index;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return decoratedEntries.map(({ entry }) => entry);
}

function getIconSrc(
  entry: FileEntry,
  open = false,
  folderConfig?: Parameters<typeof getFolderIconSrc>[2],
  iconTheme = getBuiltInIconTheme(),
): string {
  if (entry.is_dir) {
    return getFolderIconSrc(entry.path, open, { ...folderConfig, iconTheme });
  }
  return resolveFileIconSrc(entry.name, getEntryExtension(entry), iconTheme);
}

function shouldPreferManagedExplorerIcon(
  entry: FileEntry,
  folderConfig: Parameters<typeof getFolderIconSrc>[2] | undefined,
  iconTheme = getBuiltInIconTheme(),
): boolean {
  if (entry.is_dir) {
    const resolution = resolveFolderIcon(entry.path, {
      ...folderConfig,
      iconTheme,
    });
    return (
      Boolean(resolution.matchedRule) || resolution.icon !== iconTheme.folder
    );
  }

  return (
    resolveFileIcon(entry.name, getEntryExtension(entry), iconTheme)
      .matchKind !== "default"
  );
}

function getNativeIconRequest(entry: FileEntry): OverlayNativeIconRequest {
  return {
    path: entry.path,
    size: DEFAULT_NATIVE_ICON_SIZE,
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeExplorerPath(path: string): string {
  if (path.startsWith("cloud://")) {
    return path.replace(/\/+$/, "") || path;
  }
  return /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
}

function getExplorerParentPath(path: string): string {
  if (path.startsWith("cloud://")) {
    const trimmed = path.replace(/\/+$/, "");
    const segments = trimmed.split("/");
    if (segments.length <= 5) {
      return trimmed;
    }
    return segments.slice(0, -1).join("/");
  }
  const normalized = path.replace(/[/\\]+$/, "");
  const parts = normalized.split(/[/\\]/);
  if (parts.length <= 1) {
    return normalized;
  }
  if (/^[A-Za-z]:$/.test(parts[0] ?? "")) {
    return `${parts.slice(0, -1).join("\\")}\\`;
  }
  return parts.slice(0, -1).join("/");
}

function buildAdaptiveSemanticBands(
  entries: FileEntry[],
  selectedPaths: Set<string>,
  currentPath: string,
  sortBy: ExplorerSortKey,
  sortOrder: "asc" | "desc",
): AdaptiveSemanticBand[] {
  const sortedEntries = entries;
  const folders = sortedEntries.filter((entry) => entry.is_dir);
  const files = sortedEntries.filter((entry) => !entry.is_dir);
  const primarySelectedEntry =
    sortedEntries.find((entry) => selectedPaths.has(entry.path)) ?? null;
  const selectedParentPath = primarySelectedEntry
    ? getExplorerParentPath(primarySelectedEntry.path)
    : currentPath;
  const selectedExtension = primarySelectedEntry
    ? getEntryExtension(primarySelectedEntry)
    : "";

  const contextPaths = new Set<string>();
  for (const entry of files) {
    if (selectedPaths.has(entry.path)) {
      contextPaths.add(entry.path);
      continue;
    }

    const sameParent = getExplorerParentPath(entry.path) === selectedParentPath;
    const sameExtension =
      selectedExtension.length > 0 &&
      getEntryExtension(entry) === selectedExtension;
    if (sameParent || sameExtension) {
      contextPaths.add(entry.path);
    }
  }

  const recentCandidates = files
    .filter((entry) => !contextPaths.has(entry.path))
    .sort((left, right) => right.modified - left.modified)
    .slice(0, 10);
  const recentPaths = new Set(recentCandidates.map((entry) => entry.path));
  const everythingElse = files.filter(
    (entry) => !contextPaths.has(entry.path) && !recentPaths.has(entry.path),
  );

  const bands: AdaptiveSemanticBand[] = [];

  if (folders.length > 0) {
    bands.push({
      id: "folders",
      label: "Folders",
      description: "Anchors and destinations stay visually dominant.",
      dominant: true,
      entries: folders,
    });
  }

  const contextEntries = files.filter((entry) => contextPaths.has(entry.path));
  if (contextEntries.length > 0) {
    bands.push({
      id: "context",
      label: "Local Context",
      description:
        "Selection-adjacent files stay close while you change density.",
      dominant: false,
      entries: contextEntries,
    });
  }

  const recentEntries = files.filter((entry) => recentPaths.has(entry.path));
  if (recentEntries.length > 0) {
    bands.push({
      id: "recent",
      label: "Recent Activity",
      description:
        "Fresh work stays elevated without replacing the folder map.",
      dominant: false,
      entries: sortExplorerEntries(recentEntries, sortBy, sortOrder),
    });
  }

  if (everythingElse.length > 0) {
    bands.push({
      id: "everything-else",
      label: "Everything Else",
      description: "Remaining files preserve the active explorer sort.",
      dominant: false,
      entries: everythingElse,
    });
  }

  return bands;
}

function buildTimelineSurfaceBands(
  entries: FileEntry[],
  density: number,
  sortBy: ExplorerSortKey,
  sortOrder: "asc" | "desc",
  nowMs = Date.now(),
): TimelineSurfaceBand[] {
  const now = new Date(nowMs);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const dayOfWeekOffset = (now.getDay() + 6) % 7;
  const startOfWeek = startOfToday - dayOfWeekOffset * 24 * 60 * 60 * 1000;
  const startOfLastWeek = startOfWeek - 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
  const lastThirtyDays = startOfToday - 30 * 24 * 60 * 60 * 1000;
  const lastNinetyDays = startOfToday - 90 * 24 * 60 * 60 * 1000;
  const densityStopId = getAdaptiveSemanticDensityStop(density).id;

  const bucketDefinitions: Array<{
    id: string;
    label: string;
    description: string;
    dominant: boolean;
    matches: (entry: FileEntry) => boolean;
  }> =
    densityStopId === "small-icons"
      ? [
          {
            id: "recent",
            label: "Recent",
            description:
              "Fresh work from the last month stays at the front of the timeline.",
            dominant: true,
            matches: (entry) => entry.modified >= lastThirtyDays,
          },
          {
            id: "this-year",
            label: "This Year",
            description:
              "Everything else from the current year remains grouped together.",
            dominant: false,
            matches: (entry) => entry.modified >= startOfYear,
          },
          {
            id: "archive",
            label: "Archive",
            description: "Older files collapse into a long-range archive band.",
            dominant: false,
            matches: () => true,
          },
        ]
      : densityStopId === "medium-icons"
        ? [
            {
              id: "last-90-days",
              label: "Last 90 Days",
              description:
                "Recent quarters stay compressed into one practical band.",
              dominant: true,
              matches: (entry) => entry.modified >= lastNinetyDays,
            },
            {
              id: "this-year",
              label: "This Year",
              description:
                "Current-year history remains visible without splitting too far.",
              dominant: false,
              matches: (entry) => entry.modified >= startOfYear,
            },
            {
              id: "archive",
              label: "Archive",
              description: "Older work folds into one archival lane.",
              dominant: false,
              matches: () => true,
            },
          ]
        : densityStopId === "large-icons"
          ? [
              {
                id: "today",
                label: "Today",
                description: "The freshest changes sit on the leading edge.",
                dominant: true,
                matches: (entry) => entry.modified >= startOfToday,
              },
              {
                id: "this-week",
                label: "This Week",
                description: "Current-week edits form the active work lane.",
                dominant: false,
                matches: (entry) => entry.modified >= startOfWeek,
              },
              {
                id: "this-month",
                label: "This Month",
                description:
                  "Monthly context keeps short-term history together.",
                dominant: false,
                matches: (entry) => entry.modified >= startOfMonth,
              },
              {
                id: "archive",
                label: "Archive",
                description: "Older work falls into a broader historical band.",
                dominant: false,
                matches: () => true,
              },
            ]
          : densityStopId === "rich-cards"
            ? [
                {
                  id: "today",
                  label: "Today",
                  description:
                    "Same-day edits remain closest to the front edge.",
                  dominant: true,
                  matches: (entry) => entry.modified >= startOfToday,
                },
                {
                  id: "yesterday",
                  label: "Yesterday",
                  description: "Yesterday forms its own recent handoff band.",
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfYesterday,
                },
                {
                  id: "this-week",
                  label: "This Week",
                  description:
                    "The rest of the week stays grouped as one burst window.",
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfWeek,
                },
                {
                  id: "this-month",
                  label: "This Month",
                  description: "Monthly context fills in the wider story arc.",
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfMonth,
                },
                {
                  id: "archive",
                  label: "Archive",
                  description:
                    "Older work remains visible as historical layers.",
                  dominant: false,
                  matches: () => true,
                },
              ]
            : densityStopId === "columns"
              ? [
                  {
                    id: "today",
                    label: "Today",
                    description: "Today stays isolated for quick scanning.",
                    dominant: true,
                    matches: (entry) => entry.modified >= startOfToday,
                  },
                  {
                    id: "yesterday",
                    label: "Yesterday",
                    description:
                      "Yesterday remains visible as a short handoff band.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfYesterday,
                  },
                  {
                    id: "this-week",
                    label: "This Week",
                    description: "This week becomes a compact activity lane.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfWeek,
                  },
                  {
                    id: "last-30-days",
                    label: "Last 30 Days",
                    description:
                      "Recent month-scale work stays separated from older history.",
                    dominant: false,
                    matches: (entry) => entry.modified >= lastThirtyDays,
                  },
                  {
                    id: "this-year",
                    label: "This Year",
                    description:
                      "Remaining current-year work keeps a broader historical lane.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfYear,
                  },
                  {
                    id: "archive",
                    label: "Archive",
                    description:
                      "Older work compacts into a long-tail archive.",
                    dominant: false,
                    matches: () => true,
                  },
                ]
              : [
                  {
                    id: "today",
                    label: "Today",
                    description:
                      "Same-day changes stay closest to the current moment.",
                    dominant: true,
                    matches: (entry) => entry.modified >= startOfToday,
                  },
                  {
                    id: "yesterday",
                    label: "Yesterday",
                    description:
                      "Yesterday keeps its own band for immediate recall.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfYesterday,
                  },
                  {
                    id: "this-week",
                    label: "This Week",
                    description:
                      "The current week remains readable as a dedicated lane.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfWeek,
                  },
                  {
                    id: "last-week",
                    label: "Last Week",
                    description:
                      "Last week is split out so short-term history does not blur.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfLastWeek,
                  },
                  {
                    id: "last-30-days",
                    label: "Last 30 Days",
                    description:
                      "The last month keeps a wider but still active band.",
                    dominant: false,
                    matches: (entry) => entry.modified >= lastThirtyDays,
                  },
                  {
                    id: "last-90-days",
                    label: "Last 90 Days",
                    description:
                      "Quarter-scale work remains separate from the archive.",
                    dominant: false,
                    matches: (entry) => entry.modified >= lastNinetyDays,
                  },
                  {
                    id: "this-year",
                    label: "This Year",
                    description:
                      "Current-year history stays visible before the archive drop-off.",
                    dominant: false,
                    matches: (entry) => entry.modified >= startOfYear,
                  },
                  {
                    id: "archive",
                    label: "Archive",
                    description:
                      "Older work compresses into a deep-time archive lane.",
                    dominant: false,
                    matches: () => true,
                  },
                ];

  const buckets = new Map<string, FileEntry[]>();
  const undatedEntries: FileEntry[] = [];
  for (const entry of entries) {
    if (!entry.modified) {
      undatedEntries.push(entry);
      continue;
    }

    const matchedBucket = bucketDefinitions.find((bucket) =>
      bucket.matches(entry),
    );
    if (!matchedBucket) {
      undatedEntries.push(entry);
      continue;
    }
    const bucketEntries = buckets.get(matchedBucket.id) ?? [];
    bucketEntries.push(entry);
    buckets.set(matchedBucket.id, bucketEntries);
  }

  const timelineBands = bucketDefinitions
    .map((bucket) => {
      const bucketEntries = buckets.get(bucket.id) ?? [];
      if (bucketEntries.length === 0) {
        return null;
      }
      return {
        id: bucket.id,
        label: bucket.label,
        description: bucket.description,
        dominant: bucket.dominant,
        entries: bucketEntries.sort((left, right) => {
          const dateComparison = compareExplorerEntries(
            left,
            right,
            "date",
            "desc",
          );
          return dateComparison !== 0
            ? dateComparison
            : compareExplorerEntries(left, right, sortBy, sortOrder);
        }),
      } satisfies TimelineSurfaceBand;
    })
    .filter((band): band is TimelineSurfaceBand => band != null);

  if (undatedEntries.length > 0) {
    timelineBands.push({
      id: "undated",
      label: "Undated",
      description:
        "Files without usable timestamps stay grouped at the tail of the surface.",
      dominant: false,
      entries: undatedEntries.sort((left, right) =>
        compareExplorerEntries(left, right, sortBy, sortOrder),
      ),
    });
  }

  return timelineBands;
}

function isLikelyExplorerPathInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("cloud://")) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || /^[A-Za-z]:$/.test(trimmed))
    return true;
  if (trimmed.startsWith("\\\\")) return true;
  if (trimmed.startsWith("~")) return true;
  if (/^[.]{1,2}[\\/]/.test(trimmed) || trimmed === "." || trimmed === "..")
    return true;
  return /[\\/]/.test(trimmed);
}

function resolveExplorerPathInput(
  input: string,
  currentPath: string,
  runtimePlatform: ReturnType<typeof detectClientPlatform>,
): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("cloud://")) {
    return normalizeExplorerPath(trimmed);
  }
  const separator = getPlatformPathSeparator(runtimePlatform);
  const normalizedSeparators = trimmed.replace(/[\\/]+/g, separator);

  if (/^[A-Za-z]:$/.test(normalizedSeparators)) {
    return `${normalizedSeparators}${separator}`;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {
    return normalizeExplorerPath(normalizedSeparators);
  }

  if (runtimePlatform !== "windows" && trimmed.startsWith("/")) {
    return normalizeExplorerPath(normalizedSeparators);
  }

  const basePath = currentPath || getFallbackExplorerPath(runtimePlatform);
  return normalizeExplorerPath(
    joinPlatformPath(basePath, normalizedSeparators, runtimePlatform),
  );
}

// ─── SvgIcon ──────────────────────────────────────────────────────────────────

function SvgIcon({ src, size = 20 }: { src: string; size?: number }) {
  return (
    <img
      src={src}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        flexShrink: 0,
        display: "block",
        transition:
          "width 0.18s cubic-bezier(0.22, 1, 0.36, 1), height 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.opacity = "0";
      }}
      draggable={false}
    />
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

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

function resolveContextMenuIcon(iconName?: string): React.ReactNode {
  switch (iconName) {
    case "Clipboard":
      return <Clipboard size={13} />;
    case "Copy":
      return <Copy size={13} />;
    case "CopyPlus":
      return <CopyPlus size={13} />;
    case "Edit3":
      return <Edit3 size={13} />;
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
    case "Puzzle":
      return <Puzzle size={13} />;
    case "RefreshCw":
      return <RefreshCw size={13} />;
    case "Scissors":
      return <Scissors size={13} />;
    case "Shield":
      return <Shield size={13} />;
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
    default:
      return <Puzzle size={13} />;
  }
}

function ContextMenu({
  state,
  items,
  onClose,
}: {
  state: ContextMenuState;
  items: CtxItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.visible) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => window.addEventListener("mousedown", h), 0);
    return () => window.removeEventListener("mousedown", h);
  }, [state.visible, onClose]);

  useEffect(() => {
    if (state.visible && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let newX = state.x;
      let newY = state.y;

      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 8;
      }
      if (newY + rect.height > window.innerHeight) {
        newY = window.innerHeight - rect.height - 8;
      }

      newX = Math.max(8, newX);
      newY = Math.max(8, newY);

      ref.current.style.left = `${newX}px`;
      ref.current.style.top = `${newY}px`;
      ref.current.style.opacity = "1";
    }
  }, [state]);

  if (!state.visible) return null;
  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: state.x,
        top: state.y,
        zIndex: 9999,
        opacity: 0,
        background: "var(--overlay-explorer-preview-bg)",
        border: "1px solid var(--overlay-explorer-preview-border)",
        borderRadius: "var(--overlay-explorer-panel-radius)",
        boxShadow: "var(--overlay-explorer-ctx-menu-shadow)",
        minWidth: 210,
        padding: "4px 0",
        fontFamily: "Inter,system-ui,sans-serif",
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div
            key={i}
            style={{ height: 1, background: EXP.border, margin: "3px 0" }}
          />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.action();
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "6px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: item.danger ? EXP.red : EXP.text,
              fontSize: 12,
              textAlign: "left",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = item.danger
                ? "var(--overlay-explorer-danger-soft-bg)"
                : "var(--overlay-explorer-chip-active-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span style={{ opacity: 0.7, display: "flex" }}>{item.icon}</span>
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

function ExplorerLayoutGlyph({
  mode,
  accent,
  active,
}: {
  mode: ExplorerViewModeDefinition;
  accent: string;
  active: boolean;
}) {
  const color = active ? accent : EXP.muted;
  const borderColor = active ? `${accent}66` : "rgba(255,255,255,0.14)";
  const baseCellStyle: React.CSSProperties = {
    borderRadius: 2,
    border: `1px solid ${borderColor}`,
    background: active ? `${accent}22` : "rgba(255,255,255,0.04)",
  };

  if (mode.presentation === "grid") {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 2,
        }}
      >
        <span style={baseCellStyle} />
        <span style={baseCellStyle} />
        <span style={baseCellStyle} />
        <span style={baseCellStyle} />
      </span>
    );
  }

  if (mode.presentation === "list") {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <span
            key={index}
            style={{
              height: 2,
              borderRadius: 999,
              background: color,
              opacity: index === 2 ? 0.7 : 1,
            }}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      style={{
        width: 14,
        height: 14,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 2,
      }}
    >
      <span
        style={{
          ...baseCellStyle,
          gridColumn: "1 / span 2",
          height: 3,
          alignSelf: "center",
        }}
      />
      <span style={baseCellStyle} />
      <span style={baseCellStyle} />
      <span style={baseCellStyle} />
      <span style={baseCellStyle} />
    </span>
  );
}

function ExplorerShellLayoutGlyph({
  layout,
  accent,
  active,
}: {
  layout: ExplorerShellLayoutDefinition;
  accent: string;
  active: boolean;
}) {
  const color = active ? accent : EXP.muted;
  const borderColor = active ? `${accent}66` : "rgba(255,255,255,0.14)";
  const cellBackground = active ? `${accent}1e` : "rgba(255,255,255,0.04)";

  return (
    <span
      style={{
        width: 14,
        height: 14,
        display: "grid",
        gridTemplateColumns: layout.defaultSourcesVisible ? "4px 1fr" : "1fr",
        gap: 2,
      }}
    >
      {layout.defaultSourcesVisible && (
        <span
          style={{
            borderRadius: 2,
            border: `1px solid ${borderColor}`,
            background: cellBackground,
          }}
        />
      )}
      <span
        style={{
          display: "grid",
          gridTemplateColumns:
            layout.previewPlacement === "leading"
              ? "1fr 2px 2fr"
              : "2fr 2px 1fr",
          gap: 2,
        }}
      >
        <span
          style={{
            borderRadius: 2,
            border: `1px solid ${borderColor}`,
            background: cellBackground,
          }}
        />
        <span
          style={{
            borderRadius: 999,
            background: color,
            opacity: 0.6,
          }}
        />
        <span
          style={{
            borderRadius: 2,
            border: `1px solid ${borderColor}`,
            background: cellBackground,
          }}
        />
      </span>
    </span>
  );
}

interface ExplorerExperimentalGlyphProps {
  active: boolean;
  accent: string;
  mode: ExplorerExperimentalViewMode | "all";
}

function ExplorerExperimentalGlyph({
  active,
  accent,
  mode,
}: ExplorerExperimentalGlyphProps) {
  const color = active ? accent : EXP.muted;
  const borderColor = active ? `${accent}66` : "rgba(255,255,255,0.16)";
  const fill = active ? `${accent}1f` : "rgba(255,255,255,0.05)";

  if (mode === "adaptive-semantic-grid") {
  return (
    <span
      style={{
        width: 14,
          height: 14,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            style={{
              borderRadius: 2,
              border: `1px solid ${borderColor}`,
              background: fill,
            }}
          />
        ))}
      </span>
    );
  }

  if (mode === "constellation") {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            position: "absolute",
            width: 2,
            height: 2,
            borderRadius: 999,
            background: color,
            left: 6,
            top: 6,
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            borderRadius: 999,
            background: color,
            left: 1,
            top: 3,
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            borderRadius: 999,
            background: color,
            left: 10,
            top: 2,
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            borderRadius: 999,
            background: color,
            left: 11,
            top: 10,
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            borderRadius: 999,
            background: color,
            left: 2,
            top: 11,
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 8,
            height: 1,
            background: color,
            opacity: 0.7,
            left: 2,
            top: 4,
            transform: "rotate(18deg)",
            transformOrigin: "left center",
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 7,
            height: 1,
            background: color,
            opacity: 0.45,
            left: 6,
            top: 7,
            transform: "rotate(38deg)",
            transformOrigin: "left center",
          }}
        />
        <span
          style={{
            position: "absolute",
            width: 7,
            height: 1,
            background: color,
            opacity: 0.4,
            left: 2,
            top: 10,
            transform: "rotate(-26deg)",
            transformOrigin: "left center",
          }}
      />
    </span>
  );
}

  if (mode === "timeline-surface") {
    return (
      <span
        style={{
          width: 14,
          height: 14,
          display: "grid",
          gridTemplateColumns: "4px 1fr",
          gap: 3,
          alignItems: "stretch",
        }}
      >
        <span style={{ borderRadius: 999, background: color, opacity: 0.8 }} />
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "1px 0",
          }}
        >
          <span
            style={{
              height: 2,
              borderRadius: 999,
              background: fill,
              border: `1px solid ${borderColor}`,
            }}
          />
          <span
            style={{
              height: 2,
              borderRadius: 999,
              background: fill,
              border: `1px solid ${borderColor}`,
              opacity: 0.82,
            }}
          />
          <span
            style={{
              height: 2,
              borderRadius: 999,
              background: fill,
              border: `1px solid ${borderColor}`,
              opacity: 0.68,
            }}
          />
        </span>
      </span>
    );
  }

  return <Sparkles size={14} strokeWidth={2} style={{ color }} />;
}

interface AdaptiveSemanticBand {
  id: string;
  label: string;
  description: string;
  dominant: boolean;
  entries: FileEntry[];
}

interface TimelineSurfaceBand {
  id: string;
  label: string;
  description: string;
  dominant: boolean;
  entries: FileEntry[];
}

const MONACO_FIND_WITH_ARGS_ACTION = "editor.actions.findWithArgs";

type MonacoEditorOptions = NonNullable<MonacoEditorProps["options"]>;
type EditorCursorPosition = {
  lineNumber: number;
  column: number;
};

function applyEditorSearchFocus(
  editor: any,
  monaco: any,
  focusTarget: EditorSearchFocusTarget | null,
) {
  editor.layout?.();

  if (!focusTarget) {
    return;
  }

  const model = editor.getModel?.();
  if (!model) {
    return;
  }

  const lineNumber = clampSearchFocusLine(
    focusTarget.lineNumber,
    model.getLineCount(),
  );
  const lineContent = model.getLineContent(lineNumber);
  const { startColumn, endColumn } = findSearchFocusColumns(
    lineContent,
    focusTarget.searchString,
  );

  if (focusTarget.searchString) {
    const range = new monaco.Range(
      lineNumber,
      startColumn,
      lineNumber,
      endColumn,
    );
    editor.setSelection?.(range);
    editor.revealRangeInCenter?.(range);
    editor.focus?.();
    void editor.getAction?.(MONACO_FIND_WITH_ARGS_ACTION)?.run({
      searchString: focusTarget.searchString,
      isRegex: false,
      matchWholeWord: false,
      isCaseSensitive: false,
      findInSelection: false,
    });
    return;
  }

  editor.setPosition?.({ lineNumber, column: 1 });
  editor.revealLineInCenter?.(lineNumber);
  editor.focus?.();
}

function SearchAwareCodeView({
  path,
  value,
  language,
  focusTarget,
  onChange,
  onCursorPositionChange,
  options,
}: {
  path: string;
  value: string;
  language: string;
  focusTarget: EditorSearchFocusTarget | null;
  onChange?: (value: string) => void;
  onCursorPositionChange?: (position: EditorCursorPosition) => void;
  options: MonacoEditorOptions;
}) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const cursorListenerRef = useRef<{ dispose(): void } | null>(null);

  const publishCursorPosition = useCallback(
    (editor: any) => {
      const position = editor.getPosition?.();
      if (!position) {
        return;
      }
      onCursorPositionChange?.({
        lineNumber: position.lineNumber,
        column: position.column,
      });
    },
    [onCursorPositionChange],
  );

  const handleMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      cursorListenerRef.current?.dispose?.();
      cursorListenerRef.current =
        editor.onDidChangeCursorPosition?.((event: { position: EditorCursorPosition }) => {
          onCursorPositionChange?.({
            lineNumber: event.position.lineNumber,
            column: event.position.column,
          });
        }) ?? null;
      publishCursorPosition(editor);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          editor.layout?.();
          applyEditorSearchFocus(editor, monaco, focusTarget);
          publishCursorPosition(editor);
        });
      });
    },
    [focusTarget, onCursorPositionChange, publishCursorPosition],
  );

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      applyEditorSearchFocus(editorRef.current, monacoRef.current, focusTarget);
      publishCursorPosition(editorRef.current);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusTarget?.requestId, path, publishCursorPosition, value]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    publishCursorPosition(editorRef.current);
  }, [path, publishCursorPosition, value]);

  useEffect(
    () => () => {
      cursorListenerRef.current?.dispose?.();
      cursorListenerRef.current = null;
    },
    [],
  );

  return (
    <Suspense fallback={<EditorFallback label="Loading editor…" />}>
      <LazyMonacoEditor
        path={path}
        height="100%"
        language={language || "plaintext"}
        value={value}
        theme="vs-dark"
        onMount={handleMount}
        saveViewState
        onChange={
          onChange ? (nextValue) => onChange(nextValue ?? "") : undefined
        }
        options={options}
      />
    </Suspense>
  );
}

function EditorFallback({ label }: { label: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "var(--overlay-explorer-code-bg)",
        color: EXP.muted,
        fontSize: 11,
      }}
    >
      {label}
    </div>
  );
}

const EXPLORER_PREVIEW_MODE_TOGGLE_OPTIONS = [
  { id: "preview", label: "Preview" },
  { id: "edit", label: "Edit" },
] as const satisfies ReadonlyArray<{
  id: ExplorerDocumentViewMode;
  label: string;
}>;

const EXPLORER_SCRIPT_RUN_MODE_TOGGLE_OPTIONS = [
  { id: "preview", label: "Run" },
  { id: "edit", label: "Edit" },
] as const satisfies ReadonlyArray<{
  id: ExplorerDocumentViewMode;
  label: string;
}>;

// ─── Resizable Preview Panel ──────────────────────────────────────────────────

function PreviewPanel({
  preview,
  width,
  placement,
  presentationMode,
  previewLocked,
  previewSurfaceMode,
  previewTerminalMounted,
  previewTerminalCommandRequest,
  previewTerminalWorkingDirectory,
  previewTerminalReportedWorkingDirectory,
  previewTerminalNamespace,
  onClose,
  onWidthChange,
  onTextChange,
  onTextSave,
  onShaderSourceChange,
  onShaderSelectionChange,
  onShaderCompileResult,
  onShaderSceneChange,
  onShaderSave,
  onRefreshPreviewEntry,
  onPdfDocumentChange,
  onPdfChromeStateChange,
  onRegisterCloseGuard,
  onCopyPath,
  onTogglePresentationMode,
  onTogglePreviewLock,
  onTogglePreviewTerminal,
  onRunTextScript,
  onStopTextScriptRun,
  onPreviewTerminalCommandHandled,
  onPreviewTerminalReportedWorkingDirectoryChange,
  viewMode,
  onViewModeChange,
  explorerTheme,
  blurEnabled,
  chromeLayoutId,
  chromeOverride,
  chromeEditMode,
  showHiddenFiles,
  editorSettings,
  shaderPerformanceMode,
  onOpenFolderPreviewEntry,
  onExtractArchive,
}: {
  preview: PreviewState;
  width: number;
  placement: ExplorerPreviewPlacement;
  presentationMode: ExplorerPreviewSplitMode;
  previewLocked: boolean;
  previewSurfaceMode: PreviewSurfaceMode;
  previewTerminalMounted: boolean;
  previewTerminalCommandRequest: TerminalOverlayCommandRequest | null;
  previewTerminalWorkingDirectory: string | null;
  previewTerminalReportedWorkingDirectory: string | null;
  previewTerminalNamespace: string;
  onClose: () => void;
  onWidthChange: (width: number) => void;
  onTextChange: (path: string, content: string) => void;
  onTextSave: (path: string) => Promise<boolean>;
  onShaderSourceChange: (path: string, content: string) => void;
  onShaderSelectionChange: (
    path: string,
    selection: Partial<ExplorerShaderSelectionMemory>,
  ) => void;
  onShaderCompileResult: (
    path: string,
    result: ExplorerShaderPreviewCompileOutput,
  ) => void;
  onShaderSceneChange: (path: string, scene: "sphere" | "fullscreen") => void;
  onShaderSave: (path: string) => Promise<void>;
  onRefreshPreviewEntry: () => void | Promise<void>;
  onPdfDocumentChange: (
    path: string,
    document: ExplorerPdfPreviewDocument,
  ) => void;
  onPdfChromeStateChange?: (
    state: ExplorerPdfWorkbenchChromeState | null,
  ) => void;
  onRegisterCloseGuard?: (guard: PreviewCloseGuard | null) => void;
  onCopyPath: (path: string) => void;
  onTogglePresentationMode: () => void;
  onTogglePreviewLock: () => void;
  onTogglePreviewTerminal: () => void;
  onRunTextScript: (
    path: string,
    scriptPreview: ExplorerResolvedScriptPreview,
  ) => Promise<void>;
  onStopTextScriptRun: () => void;
  onPreviewTerminalCommandHandled: (requestId: string) => void;
  onPreviewTerminalReportedWorkingDirectoryChange: (cwd: string) => void;
  viewMode: ExplorerDocumentViewMode;
  onViewModeChange: (mode: ExplorerDocumentViewMode) => void;
  explorerTheme: ResolvedExplorerThemeRecipe;
  blurEnabled: boolean;
  chromeLayoutId: ExplorerChromeLayoutId;
  chromeOverride?: ExplorerChromeOverrideSnapshot | null;
  chromeEditMode?: ExplorerChromeEditModeState;
  showHiddenFiles: boolean;
  editorSettings: import("../store/settingsStore").EditorSettings;
  shaderPerformanceMode: ShaderPerformanceMode;
  onOpenFolderPreviewEntry: (entry: FileEntry) => void;
  onExtractArchive: (mode: ExplorerArchiveExtractionMode) => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(width);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [pdfWorkbenchController, setPdfWorkbenchController] =
    useState<ExplorerPdfWorkbenchController | null>(null);
  const [pdfWorkbenchChromeState, setPdfWorkbenchChromeState] =
    useState<ExplorerPdfWorkbenchChromeState | null>(null);
  const [spreadsheetWorkbenchStatus, setSpreadsheetWorkbenchStatus] =
    useState<SpreadsheetWorkbenchStatus | null>(null);
  const [pdfPageInputValue, setPdfPageInputValue] = useState("1");
  const [textPreviewCursor, setTextPreviewCursor] = useState<EditorCursorPosition>({
    lineNumber: 1,
    column: 1,
  });
  const dragHandleSide = placement === "leading" ? "right" : "left";
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta =
        placement === "leading"
          ? e.clientX - startX.current
          : startX.current - e.clientX;
      onWidthChange(
        Math.max(
          EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
          Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, startW.current + delta),
        ),
      );
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onWidthChange, placement]);

  useEffect(() => {
    setCopiedPath(null);
  }, [preview.path]);

  useEffect(() => {
    setTextPreviewCursor({ lineNumber: 1, column: 1 });
  }, [preview.path, preview.type]);

  useEffect(() => {
    if (preview.type !== "pdf") {
      setPdfWorkbenchController(null);
      setPdfWorkbenchChromeState(null);
      setPdfPageInputValue("1");
      onPdfChromeStateChange?.(null);
      onRegisterCloseGuard?.(null);
      return;
    }

    setPdfWorkbenchController(null);
    setPdfWorkbenchChromeState(null);
    setPdfPageInputValue("1");
  }, [
    onPdfChromeStateChange,
    onRegisterCloseGuard,
    preview.path,
    preview.type,
  ]);

  useEffect(() => {
    if (preview.type !== "pdf" || !pdfWorkbenchChromeState) {
      return;
    }
    setPdfPageInputValue(String(pdfWorkbenchChromeState.activePageIndex + 1));
  }, [pdfWorkbenchChromeState, preview.type]);

  useEffect(() => {
    setSpreadsheetWorkbenchStatus(null);
  }, [preview.path, preview.type]);

  const previewTitle = preview.type === "none" ? "Preview" : preview.name;
  const isPdfPreview = preview.type === "pdf";
  const isShaderPreview = preview.type === "shader";
  const isSpreadsheetPreview = preview.type === "spreadsheet";
  const isVideoPreview = preview.type === "video";
  const isAudioPreview = preview.type === "audio";
  const isEditableImagePreview =
    preview.type === "image" &&
    isEditableImagePreviewExtension(preview.extension);
  const pdfPageCount = isPdfPreview
    ? (pdfWorkbenchChromeState?.pageCount ?? preview.document.pageCount)
    : 0;
  const pdfActivePageNumber = isPdfPreview
    ? (pdfWorkbenchChromeState?.activePageIndex ?? 0) + 1
    : 0;
  const pdfZoomPercent = isPdfPreview
    ? Math.round((pdfWorkbenchChromeState?.zoomScale ?? 1) * 100)
    : null;
  const previewStateLabel =
    preview.type === "text"
      ? preview.isSaving
        ? "Saving?"
        : preview.error
          ? "Error"
        : preview.isDirty
          ? "Unsaved"
          : "Saved"
      : preview.type === "shader"
        ? preview.error
          ? "Error"
          : preview.isSaving
            ? "Saving?"
            : preview.isDirty
              ? "Unsaved"
              : "Saved"
        : preview.type === "pdf"
          ? pdfWorkbenchChromeState?.isSaving
            ? "Saving?"
            : pdfWorkbenchChromeState?.error
              ? "Error"
              : pdfWorkbenchChromeState?.isDirty
                ? "Unsaved"
                : "Saved"
          : isSpreadsheetPreview
            ? spreadsheetWorkbenchStatus
              ? spreadsheetWorkbenchStatus.isSaving
                ? "Saving?"
                : spreadsheetWorkbenchStatus.isDirty
                  ? "Unsaved"
                  : "Saved"
              : null
            : preview.type === "fallback"
              ? "Unavailable"
              : null;
  const previewStateColor =
    preview.type === "text"
      ? preview.isSaving
        ? EXP.yellow
        : preview.isDirty
          ? EXP.red
          : EXP.green
      : preview.type === "shader"
        ? preview.isSaving
          ? EXP.yellow
          : preview.error || preview.isDirty
            ? EXP.red
            : EXP.green
        : preview.type === "pdf"
          ? pdfWorkbenchChromeState?.isSaving
            ? EXP.yellow
            : pdfWorkbenchChromeState?.error || pdfWorkbenchChromeState?.isDirty
              ? EXP.red
              : EXP.green
          : isSpreadsheetPreview
            ? spreadsheetWorkbenchStatus?.isSaving
              ? EXP.yellow
              : spreadsheetWorkbenchStatus?.isDirty
                ? EXP.red
                : EXP.green
            : EXP.green;
  const copyPathLabel = copiedPath === preview.path ? "Copied" : "Copy Path";
  const previewSplitToggleTitle =
    presentationMode === "pane"
      ? "Show inline preview"
      : "Split preview into pane";
  const previewLockToggleTitle = previewLocked
    ? "Unlock preview and resume live selection previews"
    : "Lock preview to the current item";
  const isPreviewTerminalMode = previewSurfaceMode === "terminal";
  const previewTerminalDisplayPath =
    previewTerminalReportedWorkingDirectory?.trim() ||
    previewTerminalWorkingDirectory ||
    "";
  const previewTerminalToggleTitle = isPreviewTerminalMode
    ? "Show file preview"
    : "Show preview terminal";
  const deferredPreviewTextContent = useDeferredValue(
    preview.type === "text" ? preview.content : "",
  );
  const isScriptTextPreview =
    preview.type === "text" && preview.scriptPreview != null;
  const supportsRenderedPreview =
    preview.type === "text" &&
    preview.scriptPreview == null &&
    preview.renderKind !== "none";
  const textPreviewMetrics =
    preview.type === "text"
      ? getExplorerTextPreviewMetrics(deferredPreviewTextContent)
      : null;
  const textPreviewShowsEditorCursor =
    preview.type === "text" && (!supportsRenderedPreview || viewMode === "edit");
  const supportsPreviewModeToggle =
    supportsRenderedPreview ||
    isScriptTextPreview ||
    isVideoPreview ||
    isAudioPreview ||
    isPdfPreview ||
    isShaderPreview ||
    isSpreadsheetPreview ||
    isEditableImagePreview;
  const previewHeaderRowStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      minWidth: 0,
      flexWrap: "wrap",
    }),
    [],
  );
  const previewChipButtonStyle = useCallback(
    (active = false, disabled = false): CSSProperties => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      border: "none",
      borderRadius: "var(--overlay-explorer-control-radius)",
      cursor: disabled ? "default" : "pointer",
      padding: "4px 8px",
      fontSize: 10,
      fontWeight: 700,
      color: disabled ? EXP.muted2 : active ? EXP.text : EXP.muted,
      background: active
        ? "var(--overlay-explorer-chip-active-bg)"
        : "transparent",
      opacity: disabled ? 0.6 : 1,
    }),
    [],
  );
  const previewChipInputStyle = useMemo<CSSProperties>(
    () => ({
      width: 42,
      border: "1px solid var(--overlay-explorer-chip-border)",
      borderRadius: "var(--overlay-explorer-control-radius)",
      background: "var(--overlay-bg-scrim)",
      color: EXP.text,
      padding: "4px 6px",
      fontSize: 10,
      fontWeight: 700,
      textAlign: "center",
      outline: "none",
    }),
    [],
  );
  const commitPdfPageInput = useCallback(() => {
    if (!isPdfPreview || !pdfWorkbenchController) {
      return;
    }

    const parsedPageNumber = Number.parseInt(pdfPageInputValue, 10);
    if (!Number.isFinite(parsedPageNumber)) {
      setPdfPageInputValue(String(pdfActivePageNumber));
      return;
    }

    const clampedPageNumber = Math.max(
      1,
      Math.min(pdfPageCount, parsedPageNumber),
    );
    pdfWorkbenchController.goToPage(clampedPageNumber - 1);
    setPdfPageInputValue(String(clampedPageNumber));
  }, [
    isPdfPreview,
    pdfActivePageNumber,
    pdfPageCount,
    pdfPageInputValue,
    pdfWorkbenchController,
  ]);
  const handlePdfWorkbenchChromeStateChange = useCallback(
    (state: ExplorerPdfWorkbenchChromeState) => {
      setPdfWorkbenchChromeState(state);
      onPdfChromeStateChange?.(state);
    },
    [onPdfChromeStateChange],
  );
  const handlePdfWorkbenchControllerChange = useCallback(
    (controller: ExplorerPdfWorkbenchController | null) => {
      setPdfWorkbenchController((current) =>
        current === controller ? current : controller,
      );
    },
    [],
  );
  const handlePdfWorkbenchDocumentChange = useCallback(
    (document: ExplorerPdfPreviewDocument) => {
      if (preview.type !== "pdf") {
        return;
      }
      onPdfDocumentChange(preview.path, document);
    },
    [onPdfDocumentChange, preview.path, preview.type],
  );
  const handlePdfWorkbenchSaved = useCallback(
    async (output: ExplorerPdfSaveEditsOutput) => {
      if (preview.type !== "pdf") {
        return;
      }
      onPdfDocumentChange(preview.path, output.document);
      await onRefreshPreviewEntry();
    },
    [onPdfDocumentChange, onRefreshPreviewEntry, preview.path, preview.type],
  );
  const getPreviewHeaderZoneStyle = useCallback(
    (zoneId: ExplorerChromeZoneId): CSSProperties => {
      switch (zoneId) {
        case "center":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
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
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            flex: 1,
          };
      }
    },
    [],
  );
  const previewChromeControlRegistry = useMemo<
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
        id: "previewIdentity",
        label: "Preview Identity",
        surfaces: ["previewHeader"],
        isVisible: () => true,
        render: () => (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: "var(--overlay-explorer-toolbar-font-size)",
                color: EXP.text,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {isPreviewTerminalMode ? "Terminal" : previewTitle}
            </div>
            {(isPreviewTerminalMode
              ? Boolean(previewTerminalDisplayPath)
              : preview.type !== "none") && (
              <div
                title={
                  isPreviewTerminalMode
                    ? previewTerminalDisplayPath
                    : preview.path
                }
                style={{
                  marginTop: 2,
                  fontSize: 9,
                  color: EXP.muted2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "monospace",
                }}
              >
                {isPreviewTerminalMode
                  ? previewTerminalDisplayPath
                  : preview.path}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "previewState",
        label: "Preview State",
        surfaces: ["previewHeader"],
        isVisible: () => previewLocked || (!isPreviewTerminalMode && Boolean(previewStateLabel)),
        render: () => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {previewLocked && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  color: EXP.accent,
                  padding: "3px 7px",
                  borderRadius: 999,
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                }}
              >
                <Pin size={9} />
                Locked
              </span>
            )}
            {!isPreviewTerminalMode && previewStateLabel ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: previewStateColor,
                  padding: "3px 7px",
                  borderRadius: 999,
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                }}
              >
                {previewStateLabel}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "previewModeToggle",
        label: "Preview Mode Toggle",
        surfaces: ["previewHeader"],
        isVisible: () =>
          (!isPreviewTerminalMode || isScriptTextPreview) &&
          supportsPreviewModeToggle,
        render: () => {
          if (preview.type === "shader") {
            const canSave = !preview.isReadOnly;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 2,
                  borderRadius: "var(--overlay-explorer-control-radius)",
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => onViewModeChange("preview")}
                  style={previewChipButtonStyle(viewMode === "preview")}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("edit")}
                  style={previewChipButtonStyle(viewMode === "edit")}
                >
                  Edit
                </button>
                <span
                  aria-hidden="true"
                  style={{
                    width: 1,
                    alignSelf: "stretch",
                    background: "var(--overlay-explorer-chip-border)",
                    opacity: 0.6,
                  }}
                />
                <button
                  type="button"
                  onClick={() => onShaderSceneChange(preview.path, "sphere")}
                  style={previewChipButtonStyle(
                    preview.selectedScene === "sphere",
                  )}
                >
                  Sphere
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onShaderSceneChange(preview.path, "fullscreen")
                  }
                  style={previewChipButtonStyle(
                    preview.selectedScene === "fullscreen",
                  )}
                >
                  Fullscreen
                </button>
                {canSave ? (
                  <button
                    type="button"
                    onClick={() => void onShaderSave(preview.path)}
                    disabled={!preview.isDirty || preview.isSaving}
                    style={previewChipButtonStyle(
                      preview.isDirty && !preview.isSaving,
                      !preview.isDirty || preview.isSaving,
                    )}
                  >
                    <Save size={11} />
                    Save
                  </button>
                ) : null}
              </div>
            );
          }

          if (preview.type === "image" && isEditableImagePreview) {
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 2,
                  borderRadius: "var(--overlay-explorer-control-radius)",
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                  flexWrap: "wrap",
                }}
              >
                {EXPLORER_PREVIEW_MODE_TOGGLE_OPTIONS.map((option) => {
                  const active = viewMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onViewModeChange(option.id)}
                      style={previewChipButtonStyle(active)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            );
          }

          if (preview.type === "spreadsheet") {
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 2,
                  borderRadius: "var(--overlay-explorer-control-radius)",
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                  flexWrap: "wrap",
                }}
              >
                {EXPLORER_PREVIEW_MODE_TOGGLE_OPTIONS.map((option) => {
                  const active = viewMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onViewModeChange(option.id)}
                      style={previewChipButtonStyle(active)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            );
          }

          if (preview.type === "text") {
            const previewModeOptions = isScriptTextPreview
              ? EXPLORER_SCRIPT_RUN_MODE_TOGGLE_OPTIONS
              : EXPLORER_PREVIEW_MODE_TOGGLE_OPTIONS;

            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 2,
                  borderRadius: "var(--overlay-explorer-control-radius)",
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                  flexWrap: "wrap",
                }}
              >
                {previewModeOptions.map((option) => {
                  const active = viewMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (
                          option.id === "preview" &&
                          preview.scriptPreview != null
                        ) {
                          void onRunTextScript(
                            preview.path,
                            preview.scriptPreview,
                          );
                          return;
                        }
                        onViewModeChange(option.id);
                        if (
                          option.id === "edit" &&
                          preview.scriptPreview != null
                        ) {
                          onStopTextScriptRun();
                        }
                      }}
                      style={previewChipButtonStyle(active)}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => void onTextSave(preview.path)}
                  disabled={!preview.isDirty || preview.isSaving}
                  style={previewChipButtonStyle(
                    preview.isDirty && !preview.isSaving,
                    !preview.isDirty || preview.isSaving,
                  )}
                >
                  <Save size={11} />
                  Save
                </button>
              </div>
            );
          }

          if (preview.type === "pdf") {
            const pdfIsEditMode = pdfWorkbenchChromeState?.isEditMode ?? false;
            const pdfIsSaving = pdfWorkbenchChromeState?.isSaving ?? false;
            const pdfIsDirty = pdfWorkbenchChromeState?.isDirty ?? false;
            const pdfFitMode = pdfWorkbenchChromeState?.fitMode ?? "fitWidth";
            const hasPdfController = Boolean(pdfWorkbenchController);
            const canGoPrevious = hasPdfController && pdfActivePageNumber > 1;
            const canGoNext =
              hasPdfController && pdfActivePageNumber < pdfPageCount;

            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 2,
                  borderRadius: "var(--overlay-explorer-control-radius)",
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => pdfWorkbenchController?.goToPreviousPage()}
                  disabled={!canGoPrevious}
                  style={previewChipButtonStyle(false, !canGoPrevious)}
                  title="Previous page"
                >
                  <ChevronLeft size={11} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pdfPageInputValue}
                  onChange={(event) =>
                    setPdfPageInputValue(
                      event.currentTarget.value.replace(/[^\d]/g, ""),
                    )
                  }
                  onBlur={commitPdfPageInput}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitPdfPageInput();
                    }
                  }}
                  aria-label="PDF page number"
                  style={previewChipInputStyle}
                />
                <span style={{ fontSize: 10, color: EXP.muted }}>
                  / {pdfPageCount}
                </span>
                <button
                  type="button"
                  onClick={() => pdfWorkbenchController?.goToNextPage()}
                  disabled={!canGoNext}
                  style={previewChipButtonStyle(false, !canGoNext)}
                  title="Next page"
                >
                  <ChevronRight size={11} />
                </button>
                <span
                  aria-hidden="true"
                  style={{
                    width: 1,
                    alignSelf: "stretch",
                    background: "var(--overlay-explorer-chip-border)",
                    opacity: 0.6,
                  }}
                />
                <button
                  type="button"
                  onClick={() => pdfWorkbenchController?.zoomOut()}
                  disabled={!hasPdfController}
                  style={previewChipButtonStyle(false, !hasPdfController)}
                  title="Zoom out"
                >
                  -
                </button>
                <span
                  style={{
                    minWidth: 48,
                    textAlign: "center",
                    fontSize: 10,
                    color: EXP.text,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pdfZoomPercent != null ? `${pdfZoomPercent}%` : "?"}
                </span>
                <button
                  type="button"
                  onClick={() => pdfWorkbenchController?.zoomIn()}
                  disabled={!hasPdfController}
                  style={previewChipButtonStyle(false, !hasPdfController)}
                  title="Zoom in"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => pdfWorkbenchController?.setFitMode("fitWidth")}
                  disabled={!hasPdfController}
                  style={previewChipButtonStyle(
                    pdfFitMode === "fitWidth",
                    !hasPdfController,
                  )}
                >
                  Fit W
                </button>
                <button
                  type="button"
                  onClick={() => pdfWorkbenchController?.setFitMode("fitPage")}
                  disabled={!hasPdfController}
                  style={previewChipButtonStyle(
                    pdfFitMode === "fitPage",
                    !hasPdfController,
                  )}
                >
                  Fit P
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pdfIsEditMode) {
                      pdfWorkbenchController?.toggleEditMode();
                    }
                  }}
                  disabled={!hasPdfController}
                  style={previewChipButtonStyle(
                    !pdfIsEditMode,
                    !hasPdfController,
                  )}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!pdfIsEditMode) {
                      pdfWorkbenchController?.toggleEditMode();
                    }
                  }}
                  disabled={!hasPdfController}
                  style={previewChipButtonStyle(
                    pdfIsEditMode,
                    !hasPdfController,
                  )}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void pdfWorkbenchController?.save()}
                  disabled={!hasPdfController || !pdfIsDirty || pdfIsSaving}
                  style={previewChipButtonStyle(
                    pdfIsDirty && !pdfIsSaving,
                    !hasPdfController || !pdfIsDirty || pdfIsSaving,
                  )}
                >
                  <Save size={11} />
                  Save
                </button>
              </div>
            );
          }

          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: 2,
                borderRadius: "var(--overlay-explorer-control-radius)",
                border: "1px solid var(--overlay-explorer-chip-border)",
                background: "var(--overlay-explorer-chip-bg)",
              }}
            >
              {EXPLORER_PREVIEW_MODE_TOGGLE_OPTIONS.map((option) => {
                const active = viewMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onViewModeChange(option.id)}
                    style={previewChipButtonStyle(active)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          );
        },
      },
      {
        id: "previewLockToggle",
        label: "Preview Lock Toggle",
        surfaces: ["previewHeader"],
        isVisible: () => preview.type !== "none",
        render: () => (
          <button
            type="button"
            onClick={onTogglePreviewLock}
            aria-label={previewLocked ? "Unlock preview" : "Lock preview"}
            aria-pressed={previewLocked}
            title={previewLockToggleTitle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: previewLocked
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              cursor: "pointer",
              color: previewLocked ? EXP.text : EXP.muted,
              width: 28,
              height: 28,
              padding: 0,
            }}
          >
            {previewLocked ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
        ),
      },
      {
        id: "previewCopyPath",
        label: "Preview Copy Path",
        surfaces: ["previewHeader"],
        isVisible: () => !isPreviewTerminalMode && preview.type !== "none",
        render: () => (
          <button
            type="button"
            onClick={() => {
              onCopyPath(preview.path);
              setCopiedPath(preview.path);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              cursor: "pointer",
              color: EXP.muted,
              padding: "4px 8px",
              fontSize: 10,
            }}
          >
            <Copy size={11} />
            {copyPathLabel}
          </button>
        ),
      },
      {
        id: "previewSplitToggle",
        label: "Preview Split Toggle",
        surfaces: ["previewHeader"],
        isVisible: () => preview.type !== "none",
        render: () => (
          <button
            type="button"
            onClick={onTogglePresentationMode}
            aria-label={previewSplitToggleTitle}
            aria-pressed={presentationMode === "pane"}
            title={previewSplitToggleTitle}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background:
                presentationMode === "pane"
                  ? "var(--overlay-explorer-chip-active-bg)"
                  : "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              cursor: "pointer",
              color: presentationMode === "pane" ? EXP.text : EXP.muted,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <SquareSplitHorizontal size={11} />
            Pane
          </button>
        ),
      },
      {
        id: "previewTerminalToggle",
        label: "Preview Terminal Toggle",
        surfaces: ["previewHeader"],
        isVisible: () =>
          preview.type !== "none" &&
          !isScriptTextPreview &&
          Boolean(previewTerminalWorkingDirectory),
        render: () => (
          <button
            type="button"
            onClick={onTogglePreviewTerminal}
            aria-label="Toggle preview terminal"
            aria-pressed={isPreviewTerminalMode}
            title={previewTerminalToggleTitle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: isPreviewTerminalMode
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              cursor: "pointer",
              color: isPreviewTerminalMode ? EXP.text : EXP.muted,
              width: 28,
              height: 28,
              padding: 0,
            }}
          >
            <Terminal size={12} />
          </button>
        ),
      },
      {
        id: "previewClose",
        label: "Preview Close",
        surfaces: ["previewHeader"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: EXP.muted,
              padding: 2,
            }}
          >
            <X size={13} />
          </button>
        ),
      },
    ],
    [
      copyPathLabel,
      commitPdfPageInput,
      isPdfPreview,
      isPreviewTerminalMode,
      onClose,
      onCopyPath,
      onTogglePresentationMode,
      onTogglePreviewLock,
      onTogglePreviewTerminal,
      onViewModeChange,
      pdfActivePageNumber,
      pdfPageCount,
      pdfPageInputValue,
      pdfWorkbenchChromeState,
      pdfWorkbenchController,
      pdfZoomPercent,
      placement,
      previewChipButtonStyle,
      previewChipInputStyle,
      preview,
      presentationMode,
      previewSplitToggleTitle,
      previewLockToggleTitle,
      previewStateColor,
      previewStateLabel,
      previewSurfaceMode,
      previewTerminalDisplayPath,
      previewTerminalToggleTitle,
      previewTerminalWorkingDirectory,
      previewTitle,
      isScriptTextPreview,
      onRunTextScript,
      onStopTextScriptRun,
      supportsRenderedPreview,
      supportsPreviewModeToggle,
      viewMode,
      previewLocked,
    ],
  );
  const previewChromeControlRegistryById = useMemo(
    () =>
      new Map(previewChromeControlRegistry.map((entry) => [entry.id, entry])),
    [previewChromeControlRegistry],
  );
  const previewHeaderSurface = useMemo(
    () =>
      resolveExplorerChromeSurfaceLayout({
        layoutId: chromeLayoutId,
        surfaceId: "previewHeader",
        controlDefinitions: previewChromeControlRegistry,
        override: chromeOverride,
        isControlVisible: (controlId, surfaceId) =>
          previewChromeControlRegistryById
            .get(controlId)
            ?.isVisible(surfaceId) ?? false,
      }),
    [
      chromeLayoutId,
      chromeOverride,
      previewChromeControlRegistry,
      previewChromeControlRegistryById,
    ],
  );
  const renderPreviewChromeControl = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) =>
      previewChromeControlRegistryById
        .get(placement.controlId)
        ?.render(placement) ?? null,
    [previewChromeControlRegistryById],
  );
  const previewGlassBlurStyle: CSSProperties = {
    backdropFilter:
      blurEnabled && explorerTheme.previewStyle === "glass"
        ? "blur(18px)"
        : "none",
    WebkitBackdropFilter:
      blurEnabled && explorerTheme.previewStyle === "glass"
        ? "blur(18px)"
        : "none",
  };
  const previewShellBaseStyle: CSSProperties = {
    width,
    background: "var(--overlay-explorer-preview-bg)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
  };
  const previewShellStyle: CSSProperties =
    presentationMode === "pane"
      ? {
          ...previewShellBaseStyle,
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          boxShadow: "var(--overlay-explorer-toolbar-shadow)",
          ...previewGlassBlurStyle,
        }
      : explorerTheme.previewStyle === "attached"
        ? {
            ...previewShellBaseStyle,
            ...(placement === "leading"
              ? {
                  borderRight:
                    "1px solid var(--overlay-explorer-preview-border)",
                }
              : {
                  borderLeft:
                    "1px solid var(--overlay-explorer-preview-border)",
                }),
          }
        : {
            ...previewShellBaseStyle,
            margin: "var(--overlay-explorer-chrome-inset)",
            ...(placement === "leading"
              ? { marginRight: 0 }
              : { marginLeft: 0 }),
            border: "1px solid var(--overlay-explorer-preview-border)",
            borderRadius: "var(--overlay-explorer-panel-radius)",
            boxShadow: "var(--overlay-explorer-toolbar-shadow)",
            ...previewGlassBlurStyle,
          };
  const getPreviewSurfaceLayerStyle = useCallback(
    (surfaceMode: PreviewSurfaceMode): CSSProperties => {
      const isContentSurface = surfaceMode === "content";
      const isVisible = isContentSurface
        ? preview.type === "none" || previewSurfaceMode === surfaceMode
        : preview.type !== "none" &&
          previewTerminalMounted &&
          previewSurfaceMode === surfaceMode;

      return {
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? "visible" : "hidden",
        pointerEvents: isVisible ? "auto" : "none",
        transition: "opacity 140ms ease",
      };
    },
    [preview.type, previewSurfaceMode, previewTerminalMounted],
  );

  return (
    <div
      data-overlay-explorer-plane="preview"
      data-overlay-explorer-preview-locked={previewLocked ? "true" : "false"}
      data-overlay-explorer-preview-split-mode={presentationMode}
      data-overlay-explorer-preview-surface-mode={previewSurfaceMode}
      style={previewShellStyle}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        data-overlay-explorer-preview-resize-handle="true"
        style={{
          position: "absolute",
          [dragHandleSide]: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: "col-resize",
          zIndex: 10,
          background: "transparent",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = `${EXP.accent}55`)
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      />
      {/* Header */}
      <div
        style={{
          padding:
            dragHandleSide === "left"
              ? "8px 12px 8px 16px"
              : "8px 16px 8px 12px",
          borderBottom: "1px solid var(--overlay-explorer-preview-border)",
          background: "var(--overlay-explorer-preview-header-bg)",
          flexShrink: 0,
        }}
      >
        <ExplorerChromeSurface
          surface={previewHeaderSurface}
          getRowStyle={() => previewHeaderRowStyle}
          getZoneStyle={getPreviewHeaderZoneStyle}
          renderControl={renderPreviewChromeControl}
          editMode={chromeEditMode}
        />
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div
          data-overlay-explorer-preview-surface="content"
          style={getPreviewSurfaceLayerStyle("content")}
        >
          {preview.type === "none" && <PreviewIdleState />}
          {preview.type === "image" && preview.content && (
            <ExplorerImageEditor
              imagePath={preview.path}
              imageName={preview.name}
              imageSource={preview.content}
              mode={isEditableImagePreview && viewMode === "edit" ? "edit" : "preview"}
              onSaved={onRefreshPreviewEntry}
            />
          )}
          {preview.type === "audio" && (
            <ExplorerAudioWorkbench
              audioPath={preview.path}
              audioName={preview.name}
              audioExtension={preview.extension}
              audioSize={preview.size}
              mode={viewMode}
              onExported={onRefreshPreviewEntry}
            />
          )}
          {preview.type === "video" && (
            <ExplorerVideoEditor
              videoPath={preview.path}
              videoName={preview.name}
              videoSource={preview.source}
              videoExtension={preview.extension}
              videoMimeType={preview.mimeType}
              videoSize={preview.size}
              mode={viewMode}
              onExported={onRefreshPreviewEntry}
            />
          )}
          {preview.type === "archive" && (
            <ExplorerArchivePreview
              archivePath={preview.path}
              archiveName={preview.name}
              archiveSize={preview.size}
              descriptor={preview.descriptor}
              onExtract={onExtractArchive}
            />
          )}
          {preview.type === "folder" && (
            <ExplorerFolderPreview
              folderPath={preview.path}
              folderName={preview.name}
              showHiddenFiles={showHiddenFiles}
              onOpenEntry={onOpenFolderPreviewEntry}
            />
          )}
          {preview.type === "font" && (
            <ExplorerFontPreview
              fontPath={preview.path}
              fontName={preview.name}
              fontSource={preview.source}
              fontExtension={preview.extension}
            />
          )}
          {preview.type === "pdf" && (
            <ExplorerPdfWorkbench
              document={preview.document}
              onSaved={handlePdfWorkbenchSaved}
              onDocumentChange={handlePdfWorkbenchDocumentChange}
              onChromeStateChange={handlePdfWorkbenchChromeStateChange}
              onControllerChange={handlePdfWorkbenchControllerChange}
              onRegisterCloseGuard={onRegisterCloseGuard}
            />
          )}
          {preview.type === "spreadsheet" && (
            <ExplorerSpreadsheetWorkbench
              path={preview.path}
              name={preview.name}
              sourceExtension={preview.extension}
              fileKind={preview.fileKind}
              mode={viewMode}
              onModeChange={onViewModeChange}
              onRefreshPreviewEntry={onRefreshPreviewEntry}
              onRegisterCloseGuard={onRegisterCloseGuard}
              onStatusChange={setSpreadsheetWorkbenchStatus}
            />
          )}
          {preview.type === "sqlite" && (
            <ExplorerSqlitePreview
              dbPath={preview.path}
              dbName={preview.name}
            />
          )}
          {preview.type === "docx" && (
            <ExplorerDocxWorkbench
              path={preview.path}
              name={preview.name}
              extension={preview.extension}
              onRefreshPreviewEntry={onRefreshPreviewEntry}
            />
          )}
          {preview.type === "shader" && (
            <ExplorerShaderWorkbench
              path={preview.path}
              name={preview.name}
              format={preview.format}
              editableSource={preview.editableSource}
              inspectionSource={preview.inspectionSource}
              isReadOnly={preview.isReadOnly}
              normalizedWgsl={preview.normalizedWgsl}
              diagnostics={preview.diagnostics}
              entryPoints={preview.entryPoints}
              selectedScene={preview.selectedScene}
              selectedStage={preview.selectedStage}
              selectedEntryPoint={preview.selectedEntryPoint}
              isDirty={preview.isDirty}
              isSaving={preview.isSaving}
              error={preview.error}
              viewMode={viewMode}
              editorSettings={editorSettings}
              shaderPerformanceMode={shaderPerformanceMode}
              onSourceChange={onShaderSourceChange}
              onSelectionChange={onShaderSelectionChange}
              onCompileResult={onShaderCompileResult}
              onRegisterCloseGuard={onRegisterCloseGuard}
            />
          )}
          {preview.type === "text" &&
            viewMode === "preview" &&
            supportsRenderedPreview && (
              <Suspense
                fallback={
                  <DocumentPreviewFallback label="Loading rendered preview…" />
                }
              >
                <LazyTextDocumentPreview
                  kind={preview.renderKind}
                  content={preview.content}
                  sourcePath={preview.path}
                />
              </Suspense>
            )}
          {preview.type === "text" &&
            (viewMode === "edit" ||
              (preview.scriptPreview == null && !supportsRenderedPreview)) && (
              <SearchAwareCodeView
                path={preview.path}
                value={preview.content || ""}
                language={preview.language || "plaintext"}
                focusTarget={preview.focusTarget}
                onChange={(value) => onTextChange(preview.path, value)}
                onCursorPositionChange={setTextPreviewCursor}
                options={buildExplorerMonacoPreviewOptions({
                  editorSettings,
                  lineCount: textPreviewMetrics?.lineCount ?? 1,
                  readOnly: false,
                  allowFolding: false,
                  topPadding: 8,
                })}
              />
            )}
          {preview.type === "model3d" && (
            <Suspense
              fallback={
                <ModelPreviewFallback
                  entryName={preview.name}
                  format={preview.format}
                />
              }
            >
              <LazyModelPreview
                entryName={preview.name}
                format={preview.format}
                sourcePath={preview.path}
                sourceBytes={preview.size}
              />
            </Suspense>
          )}
          {preview.type === "fallback" && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                padding: 24,
                textAlign: "center",
                color: EXP.muted,
                background: "var(--overlay-explorer-preview-bg)",
              }}
            >
              <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: EXP.text }}>
                  {preview.label}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                  {preview.detail}
                </div>
              </div>
            </div>
          )}
        </div>
        {previewTerminalMounted && preview.type !== "none" && (
          <div
            data-overlay-explorer-preview-surface="terminal"
            style={getPreviewSurfaceLayerStyle("terminal")}
          >
            <TerminalOverlay
              isOpen
              embedded
              onClose={() => {}}
              terminalIdNamespace={previewTerminalNamespace}
              workingDirectory={previewTerminalWorkingDirectory}
              consumeExplorerCwdSync={false}
              pendingCommandRequest={previewTerminalCommandRequest}
              onCommandRequestHandled={onPreviewTerminalCommandHandled}
              onReportedWorkingDirectoryChange={
                onPreviewTerminalReportedWorkingDirectoryChange
              }
            />
          </div>
        )}
      </div>
      {previewSurfaceMode === "content" && preview.type === "text" && (
        <div
          data-testid="text-preview-status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "4px 10px",
            borderTop: "1px solid var(--overlay-explorer-preview-border)",
            background: "var(--overlay-explorer-preview-header-bg)",
            fontSize: "var(--overlay-explorer-status-font-size)",
            color: EXP.muted,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span data-testid="text-preview-metrics">
              {textPreviewMetrics?.characterCount ?? 0} chars ·{" "}
              {textPreviewMetrics?.wordCount ?? 0} words ·{" "}
              {textPreviewMetrics?.lineCount ?? 1} lines
            </span>
            {textPreviewShowsEditorCursor && (
              <span data-testid="text-preview-cursor">
                Ln {textPreviewCursor.lineNumber}, Col {textPreviewCursor.column}
              </span>
            )}
          </div>
          <span
            style={{
              color: preview.error
                ? EXP.red
                : preview.isDirty
                  ? EXP.yellow
                  : EXP.green,
            }}
          >
            {preview.error
              ? "Save failed"
              : preview.isSaving
                ? "Saving…"
                : preview.isDirty
                  ? "Pending auto-save"
                  : "Auto-saved"}
          </span>
        </div>
      )}
      {previewSurfaceMode === "content" && preview.type === "shader" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "4px 10px",
            borderTop: "1px solid var(--overlay-explorer-preview-border)",
            background: "var(--overlay-explorer-preview-header-bg)",
            fontSize: "var(--overlay-explorer-status-font-size)",
            color: EXP.muted,
          }}
        >
          <span>
            {preview.entryPoints.length} entry points ·{" "}
            {preview.diagnostics.length} diagnostics
            {preview.selectedStage && preview.selectedEntryPoint
              ? ` · ${preview.selectedStage}:${preview.selectedEntryPoint}`
              : ""}
          </span>
          <span
            style={{
              color: preview.error
                ? EXP.red
                : preview.isSaving
                  ? EXP.yellow
                  : preview.isDirty
                    ? EXP.yellow
                    : preview.supportsLivePreview
                      ? EXP.green
                      : EXP.muted,
            }}
          >
            {preview.error
              ? "Save failed"
              : preview.isSaving
                ? "Saving…"
                : preview.isDirty
                  ? "Unsaved edits"
                  : preview.supportsLivePreview
                    ? "Preview ABI ready"
                    : "Inspection only"}
          </span>
        </div>
      )}
    </div>
  );
}

function DocumentPreviewFallback({ label }: { label: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "var(--overlay-explorer-preview-bg)",
        color: EXP.muted,
        fontSize: 11,
      }}
    >
      {label}
    </div>
  );
}

function PreviewIdleState() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--overlay-explorer-preview-bg)",
        color: EXP.muted,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          maxWidth: 420,
          display: "grid",
          gap: 14,
          justifyItems: "center",
          textAlign: "center",
          padding: "26px 28px",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          background: "var(--overlay-bg-scrim)",
          boxShadow: "var(--overlay-explorer-toolbar-shadow)",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "var(--overlay-explorer-chip-bg)",
            border: "1px solid var(--overlay-explorer-chip-border)",
            color: EXP.accent,
          }}
        >
          <Eye size={18} />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: EXP.text }}>
            Preview is standing by
          </div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: EXP.muted,
              maxWidth: 320,
            }}
          >
            Select any file or folder to bring it into view here.
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelPreviewFallback({
  entryName,
  format,
}: {
  entryName: string;
  format: ModelPreviewFormat;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--overlay-explorer-preview-bg)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          color: EXP.muted,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
        <span>Loading {format.toUpperCase()} Preview</span>
        <span
          style={{
            color: EXP.muted2,
            textTransform: "none",
            letterSpacing: 0,
            fontSize: 10,
          }}
        >
          {entryName}
        </span>
      </div>
    </div>
  );
}

// ─── Inline rename ────────────────────────────────────────────────────────────

function RenameInput({
  state,
  onCommit,
  onCancel,
}: {
  state: RenameState;
  onCommit: (n: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(state.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      const dot = state.name.lastIndexOf(".");
      ref.current.setSelectionRange(0, dot > 0 ? dot : state.name.length);
      ref.current.focus();
    }
  }, [state.name]);
  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => (val.trim() ? onCommit(val.trim()) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          val.trim() ? onCommit(val.trim()) : onCancel();
        }
        if (e.key === "Escape") onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "var(--overlay-explorer-input-bg)",
        border: "1px solid var(--overlay-explorer-input-border)",
        borderRadius: "var(--overlay-explorer-control-radius)",
        color: EXP.text,
        fontSize: 12,
        padding: "2px 6px",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
      }}
    />
  );
}

const ExplorerThumbnailImage = React.memo(function ExplorerThumbnailImage({
  entryName,
  hoverScrubEnabled,
  thumbnail,
}: {
  entryName: string;
  hoverScrubEnabled: boolean;
  thumbnail: ExplorerEntryThumbnailData;
}) {
  const hoverFrames = thumbnail.kind === "video" ? thumbnail.hoverFrames : [];
  const canAnimateHoverFrames = hoverScrubEnabled && hoverFrames.length > 1;
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  useEffect(() => {
    if (!canAnimateHoverFrames) {
      setActiveFrameIndex((current) => (current === 0 ? current : 0));
      return;
    }

    setActiveFrameIndex(0);
    const intervalId = window.setInterval(() => {
      setActiveFrameIndex((current) => (current + 1) % hoverFrames.length);
    }, thumbnail.hoverFrameDelayMs ?? EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.hoverFrameDelayMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [canAnimateHoverFrames, hoverFrames.length, thumbnail.hoverFrameDelayMs]);

  const imageSrc = canAnimateHoverFrames
    ? (hoverFrames[activeFrameIndex]?.imageDataUrl ?? thumbnail.posterDataUrl)
    : thumbnail.posterDataUrl;

  return (
    <img
      src={imageSrc}
      alt={`Thumbnail for ${entryName}`}
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
      }}
    />
  );
});

function getExplorerThumbnailTypeBadgeMetrics(stageSize: number) {
  const shellSize = Math.max(16, Math.min(28, Math.round(stageSize * 0.3)));
  const iconSize = Math.max(
    10,
    Math.min(18, shellSize - Math.max(4, Math.round(shellSize * 0.32))),
  );
  const inset = Math.max(3, Math.round(stageSize * 0.06));
  return { shellSize, iconSize, inset };
}

const ExplorerEntryThumbnailStageContent = React.memo(
  function ExplorerEntryThumbnailStageContent({
    entry,
    fallbackIconSize,
    fallbackIconSrc,
    hoverScrubEnabled,
    iconTheme = getBuiltInIconTheme(),
    stageSize,
    thumbnail,
  }: {
    entry: FileEntry;
    fallbackIconSize: number;
    fallbackIconSrc: string;
    hoverScrubEnabled: boolean;
    iconTheme?: OverlayResolvedIconTheme;
    stageSize: number;
    thumbnail: ExplorerEntryThumbnailData | null;
  }) {
    if (!thumbnail) {
      return <SvgIcon src={fallbackIconSrc} size={fallbackIconSize} />;
    }

    const shouldShowTypeBadge =
      stageSize >= EXPLORER_THUMBNAIL_TYPE_BADGE_MIN_STAGE_PX &&
      EXPLORER_THUMBNAIL_TYPE_BADGE_KINDS.has(thumbnail.kind);
    const typeBadgeSrc = shouldShowTypeBadge
      ? resolveFileIconSrc(entry.name, getEntryExtension(entry), iconTheme)
      : null;
    const badgeMetrics = getExplorerThumbnailTypeBadgeMetrics(stageSize);

    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        <ExplorerThumbnailImage
          entryName={entry.name}
          hoverScrubEnabled={hoverScrubEnabled}
          thumbnail={thumbnail}
        />
        {typeBadgeSrc ? (
          <div
            data-overlay-explorer-thumbnail-badge="true"
            data-overlay-explorer-thumbnail-badge-kind={thumbnail.kind}
            style={{
              position: "absolute",
              right: badgeMetrics.inset,
              bottom: badgeMetrics.inset,
              width: badgeMetrics.shellSize,
              height: badgeMetrics.shellSize,
              borderRadius: Math.max(
                6,
                Math.round(badgeMetrics.shellSize * 0.34),
              ),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border:
                "1px solid color-mix(in srgb, white 14%, transparent)",
              background:
                "color-mix(in srgb, var(--overlay-bg-shell-solid) 92%, black)",
              boxShadow:
                "0 6px 18px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08)",
              pointerEvents: "none",
            }}
          >
            <img
              src={typeBadgeSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{
                width: badgeMetrics.iconSize,
                height: badgeMetrics.iconSize,
                objectFit: "contain",
                display: "block",
              }}
              onError={(event) => {
                event.currentTarget.style.opacity = "0";
              }}
            />
          </div>
        ) : null}
      </div>
    );
  },
);

// ─── Trash confirm ────────────────────────────────────────────────────────────

function TrashDialog({
  entries,
  onConfirm,
  onDeletePermanently,
  onCancel,
}: {
  entries: FileEntry[];
  onConfirm: () => void;
  onDeletePermanently: () => void;
  onCancel: () => void;
}) {
  const primaryLabel =
    entries.length === 1
      ? (entries[0]?.name ?? "item")
      : `${entries.length} items`;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--overlay-explorer-modal-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--overlay-explorer-preview-bg)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          padding: 24,
          minWidth: 320,
          boxShadow: "var(--overlay-explorer-modal-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <Trash2 size={18} style={{ color: EXP.accent }} />
          <span style={{ color: EXP.text, fontWeight: 600, fontSize: 14 }}>
            Move to Trash
          </span>
        </div>
        <p
          style={{
            color: EXP.muted,
            fontSize: 12,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Move <strong style={{ color: EXP.text }}>{primaryLabel}</strong> to
          the GreebleFS trash? You can undo the most recent trash action from
          the toolbar.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: EXP.text,
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDeletePermanently}
            style={{
              background: "var(--overlay-explorer-danger-soft-bg)",
              border: "1px solid var(--overlay-explorer-danger-soft-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: EXP.red,
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Delete Permanently
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "var(--overlay-explorer-chip-active-bg)",
              border: "1px solid var(--overlay-explorer-chip-active-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: "var(--overlay-explorer-chip-active-text)",
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferConflictDialog({
  state,
  policy,
  onPolicyChange,
  onConfirm,
  onCancel,
}: {
  state: TransferConflictDialogState;
  policy: ExplorerFileTransferCollisionPolicy;
  onPolicyChange: (value: ExplorerFileTransferCollisionPolicy) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const actionLabel = state.operation === "move" ? "Move" : "Copy";
  const destinationLabel = getPathLeaf(state.targetDir) || state.targetDir;
  const visibleCollisions = state.collisions.slice(0, 6);
  const remainingCount = Math.max(
    0,
    state.collisions.length - visibleCollisions.length,
  );
  const options: Array<{
    value: ExplorerFileTransferCollisionPolicy;
    label: string;
    detail: string;
  }> = [
    {
      value: "replace",
      label: "Replace existing items",
      detail: "Overwrite matching files or folders at the destination.",
    },
    {
      value: "skip",
      label: "Skip duplicates",
      detail: "Leave matching destination items untouched.",
    },
    {
      value: "keep_both",
      label: "Keep both",
      detail: "Create collision-safe names for the incoming items.",
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--overlay-explorer-modal-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "min(920px, 94vw)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--overlay-explorer-preview-bg)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          padding: 20,
          boxShadow: "var(--overlay-explorer-modal-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <AlertTriangle size={18} style={{ color: EXP.yellow }} />
          <div style={{ color: EXP.text, fontWeight: 700, fontSize: 14 }}>
            Name conflict
          </div>
        </div>
        <p
          style={{
            color: EXP.muted,
            fontSize: 12,
            lineHeight: 1.55,
            margin: "0 0 14px",
          }}
        >
          {actionLabel}{" "}
          {state.collisions.length === 1
            ? "1 item has"
            : `${state.collisions.length} items have`}{" "}
          matching names in{" "}
          <strong style={{ color: EXP.text }}>{destinationLabel}</strong>.
          Choose how this transfer should handle duplicates.
        </p>
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {options.map((option) => {
            const active = policy === option.value;
            return (
              <label
                key={option.value}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${active ? "var(--overlay-explorer-chip-active-border)" : "var(--overlay-border)"}`,
                  background: active
                    ? "var(--overlay-explorer-chip-active-bg)"
                    : "var(--overlay-bg-panel)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  checked={active}
                  onChange={() => onPolicyChange(option.value)}
                  style={{ marginTop: 2 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: active
                        ? "var(--overlay-explorer-chip-active-text)"
                        : EXP.text,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {option.label}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      color: active
                        ? "var(--overlay-explorer-chip-active-text)"
                        : EXP.muted,
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {option.detail}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        <div
          style={{
            minHeight: 0,
            flex: 1,
            border: "1px solid var(--overlay-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <OverlayScrollArea style={{ maxHeight: "34vh" }}>
            <div
              style={{
                display: "grid",
                gap: 1,
                background: "var(--overlay-border)",
              }}
            >
              {visibleCollisions.map((collision) => (
                <div
                  key={`${collision.source_path}-${collision.destination_path}`}
                  style={{
                    display: "grid",
                    gap: 4,
                    background: "var(--overlay-bg-panel)",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      color: EXP.text,
                      fontSize: 11.5,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {collision.source_name}
                  </div>
                  <div
                    style={{
                      color: EXP.muted,
                      fontSize: 10.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Destination: {collision.destination_path}
                  </div>
                </div>
              ))}
              {remainingCount > 0 && (
                <div
                  style={{
                    background: "var(--overlay-bg-panel)",
                    color: EXP.muted,
                    fontSize: 11,
                    padding: "10px 12px",
                  }}
                >
                  +{remainingCount} more matching item
                  {remainingCount === 1 ? "" : "s"}
                </div>
              )}
            </div>
          </OverlayScrollArea>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 14,
          }}
        >
          <button onClick={onCancel} style={dialogSecondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "var(--overlay-explorer-chip-active-bg)",
              border: "1px solid var(--overlay-explorer-chip-active-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: "var(--overlay-explorer-chip-active-text)",
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {actionLabel} with{" "}
            {policy === "replace"
              ? "replace"
              : policy === "skip"
                ? "skip"
                : "keep both"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveSearchDialog({
  state,
  onChangeName,
  onConfirm,
  onCancel,
}: {
  state: SaveSearchState;
  onChangeName: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--overlay-explorer-modal-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--overlay-explorer-preview-bg)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          padding: 24,
          minWidth: 360,
          boxShadow: "var(--overlay-explorer-modal-shadow)",
        }}
      >
        <div
          style={{
            color: EXP.text,
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          Save Search
        </div>
        <input
          autoFocus
          value={state.name}
          onChange={(event) => onChangeName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConfirm();
            if (event.key === "Escape") onCancel();
          }}
          placeholder="Search name"
          style={{
            width: "100%",
            background: "var(--overlay-explorer-input-bg)",
            border: "1px solid var(--overlay-explorer-input-border)",
            borderRadius: "var(--overlay-explorer-control-radius)",
            color: EXP.text,
            fontSize: 12,
            padding: "8px 10px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              background: "var(--overlay-explorer-chip-bg)",
              border: "1px solid var(--overlay-explorer-chip-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: EXP.text,
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: "var(--overlay-explorer-chip-active-bg)",
              border: "1px solid var(--overlay-explorer-chip-active-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: "var(--overlay-explorer-chip-active-text)",
              padding: "6px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchRenameDialog({
  state,
  preview,
  onChange,
  onConfirm,
  onCancel,
}: {
  state: BatchRenameState;
  preview: ExplorerBatchRenamePreviewRow[];
  onChange: (updates: Partial<BatchRenameState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const previewCount = preview.length;
  const collisionCount = preview.filter((row) => row.collision).length;
  const validationError =
    preview.find((row) => row.validationError)?.validationError ?? null;
  const canCommit =
    previewCount > 0 && !validationError && collisionCount === 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--overlay-explorer-modal-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "min(1040px, 96vw)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--overlay-explorer-preview-bg)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          padding: 20,
          boxShadow: "var(--overlay-explorer-modal-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ color: EXP.text, fontWeight: 700, fontSize: 14 }}>
              Batch Rename
            </div>
            <div style={{ marginTop: 4, color: EXP.muted, fontSize: 11 }}>
              {state.mode === "regex"
                ? "Regex mode supports capture groups like $1 and ${name}. Tokens: {{date}}, {{index}}, {{parent}}."
                : "Literal mode replaces plain text in the filename stem and still expands tokens after replacement."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() =>
                onChange({ mode: state.mode === "regex" ? "literal" : "regex" })
              }
              style={
                state.mode === "regex"
                  ? dialogSecondaryButtonStyle
                  : dialogSecondaryButtonStyle
              }
              title="Toggle regex mode"
            >
              {state.mode === "regex" ? "Regex On" : "Regex Off"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={dialogSecondaryButtonStyle}
            >
              Close
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          <input
            value={state.findText}
            onChange={(event) => onChange({ findText: event.target.value })}
            placeholder={state.mode === "regex" ? "Find pattern" : "Find text"}
            style={dialogInputStyle}
          />
          <input
            value={state.replaceText}
            onChange={(event) => onChange({ replaceText: event.target.value })}
            placeholder="Replace with"
            style={dialogInputStyle}
          />
          <input
            value={state.prefix}
            onChange={(event) => onChange({ prefix: event.target.value })}
            placeholder="Prefix"
            style={dialogInputStyle}
          />
          <input
            value={state.suffix}
            onChange={(event) => onChange({ suffix: event.target.value })}
            placeholder="Suffix"
            style={dialogInputStyle}
          />
          <input
            value={state.startingNumber}
            onChange={(event) =>
              onChange({ startingNumber: Number(event.target.value) || 1 })
            }
            placeholder="Start #"
            type="number"
            style={dialogInputStyle}
          />
          <input
            value={state.padding}
            onChange={(event) =>
              onChange({ padding: Number(event.target.value) || 1 })
            }
            placeholder="Pad width"
            type="number"
            style={dialogInputStyle}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            color: EXP.muted,
            fontSize: 11,
          }}
        >
          <span>
            Capture groups:{" "}
            {state.mode === "regex" ? "$1..$99, ${name}" : "literal text"}
          </span>
          <span>
            Tokens: <code style={{ color: EXP.text }}>{"{{date}}"}</code>,{" "}
            <code style={{ color: EXP.text }}>{"{{index}}"}</code>,{" "}
            <code style={{ color: EXP.text }}>{"{{parent}}"}</code>
          </span>
          {previewCount > 0 && <span>{previewCount} files</span>}
          {collisionCount > 0 && (
            <span style={{ color: "var(--overlay-explorer-danger-text)" }}>
              {collisionCount} collision{collisionCount === 1 ? "" : "s"}
            </span>
          )}
          {validationError && (
            <span style={{ color: "var(--overlay-explorer-danger-text)" }}>
              {validationError}
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 14,
            border: "1px solid var(--overlay-border)",
            borderRadius: 12,
            overflow: "hidden",
            minHeight: 0,
            flex: 1,
          }}
        >
          <OverlayScrollArea style={{ maxHeight: "50vh" }}>
            <div
              style={{
                display: "grid",
                gap: 1,
                background: "var(--overlay-border)",
              }}
            >
              {preview.map((row) => (
                <div
                  key={row.sourcePath}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
                    gap: 12,
                    background: "var(--overlay-bg-panel)",
                    padding: "9px 12px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: EXP.muted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.currentName}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        color: EXP.muted2,
                        fontSize: 10,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.sourcePath}
                    </div>
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      color: EXP.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.nextName}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {row.collision && (
                      <span
                        style={{
                          color: "var(--overlay-explorer-danger-text)",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        Collision
                      </span>
                    )}
                    {row.validationError && (
                      <span
                        style={{
                          color: "var(--overlay-explorer-danger-text)",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {row.validationError}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </OverlayScrollArea>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 14,
          }}
        >
          <button onClick={onCancel} style={dialogSecondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canCommit}
            style={{
              background: canCommit
                ? "var(--overlay-explorer-chip-active-bg)"
                : "rgba(255,255,255,0.08)",
              border: "1px solid var(--overlay-explorer-chip-active-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: canCommit
                ? "var(--overlay-explorer-chip-active-text)"
                : EXP.muted,
              padding: "6px 14px",
              fontSize: 12,
              cursor: canCommit ? "pointer" : "not-allowed",
              fontWeight: 600,
              opacity: canCommit ? 1 : 0.7,
            }}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

function ExplorerPropertiesDialog({
  state,
  entries,
  primaryEntry,
  itemProperties,
  recursiveSummary,
  checksumResults,
  checksumLoadingPaths,
  checksumError,
  supportsNativeProperties,
  onTabChange,
  onCalculateChecksums,
  onCalculateRecursiveSize,
  onOpenNativeProperties,
  onClose,
}: {
  state: ExplorerPropertiesPanelSnapshot;
  entries: FileEntry[];
  primaryEntry: FileEntry | null;
  itemProperties: Record<string, ExplorerItemProperties>;
  recursiveSummary: {
    totalBytes: number;
    fileCount: number;
    folderCount: number;
    pending: boolean;
  } | null;
  checksumResults: Record<string, ExplorerChecksumInfo>;
  checksumLoadingPaths: Set<string>;
  checksumError: string | null;
  supportsNativeProperties: boolean;
  onTabChange: (tab: ExplorerPropertiesPanelTab) => void;
  onCalculateChecksums: () => void;
  onCalculateRecursiveSize: () => void;
  onOpenNativeProperties: (path: string) => void;
  onClose: () => void;
}) {
  const selectedCount = entries.length;
  const primaryProperties = primaryEntry
    ? (itemProperties[primaryEntry.path] ?? null)
    : null;
  const tabs: Array<{ id: ExplorerPropertiesPanelTab; label: string }> = [
    { id: "info", label: "Info" },
    { id: "permissions", label: "Permissions" },
    { id: "checksums", label: "Checksums" },
  ];
  const activeTab = state.tab;

  const panelBody = (() => {
    if (activeTab === "permissions") {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          {primaryProperties ? (
            <div
              style={{
                border: "1px solid var(--overlay-border)",
                borderRadius: 12,
                padding: 12,
                background: "var(--overlay-bg-panel)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ color: EXP.text, fontWeight: 700, fontSize: 12 }}>
                Native Permission Snapshot
              </div>
              <div style={{ color: EXP.muted, fontSize: 11 }}>
                Mode:{" "}
                <span style={{ color: EXP.text, fontFamily: "monospace" }}>
                  {primaryProperties.permissions.display}
                </span>
              </div>
              <div style={{ color: EXP.muted, fontSize: 11 }}>
                Read-only:{" "}
                <span style={{ color: EXP.text }}>
                  {primaryProperties.permissions.readonly ? "Yes" : "No"}
                </span>
              </div>
              {primaryProperties.permissions.unixModeOctal && (
                <div style={{ color: EXP.muted, fontSize: 11 }}>
                  Unix mode:{" "}
                  <span style={{ color: EXP.text, fontFamily: "monospace" }}>
                    {primaryProperties.permissions.unixModeOctal}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: EXP.muted, fontSize: 12, lineHeight: 1.5 }}>
              Loading native permission details for the current selection.
            </div>
          )}
          {supportsNativeProperties && primaryEntry && (
            <button
              type="button"
              onClick={() => onOpenNativeProperties(primaryEntry.path)}
              style={dialogSecondaryButtonStyle}
            >
              Open Native Properties
            </button>
          )}
          <div
            style={{
              border: "1px solid var(--overlay-border)",
              borderRadius: 12,
              padding: 12,
              background: "var(--overlay-bg-panel)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: EXP.text, fontWeight: 700, fontSize: 12 }}>
              Selection
            </div>
            <div style={{ color: EXP.muted, fontSize: 11 }}>
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </div>
            <div style={{ color: EXP.muted, fontSize: 11 }}>
              {entries.map((entry) => entry.path).join("\n")}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "checksums") {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={onCalculateChecksums}
              style={dialogSecondaryButtonStyle}
            >
              Calculate
            </button>
            <div style={{ color: EXP.muted, fontSize: 11 }}>
              Compute MD5 and SHA-256 on demand. Single files under 100MB
              auto-start when you open this tab.
            </div>
          </div>
          {checksumError && (
            <div
              style={{
                color: "var(--overlay-explorer-danger-text)",
                fontSize: 11,
              }}
            >
              {checksumError}
            </div>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            {entries.map((entry) => {
              const checksum = checksumResults[entry.path];
              const loading = checksumLoadingPaths.has(entry.path);
              return (
                <div
                  key={entry.path}
                  style={{
                    border: "1px solid var(--overlay-border)",
                    borderRadius: 12,
                    padding: 12,
                    background: "var(--overlay-bg-panel)",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: EXP.text,
                          fontSize: 12,
                          fontWeight: 700,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.name}
                      </div>
                      <div
                        style={{
                          color: EXP.muted,
                          fontSize: 10,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.path}
                      </div>
                    </div>
                    <div
                      style={{
                        color: loading ? EXP.text : EXP.muted,
                        fontSize: 11,
                      }}
                    >
                      {loading ? "Calculating…" : "Ready"}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, fontSize: 11 }}>
                    <div style={{ color: EXP.muted }}>
                      MD5:{" "}
                      <span
                        style={{ color: EXP.text, fontFamily: "monospace" }}
                      >
                        {checksum?.md5 ?? "—"}
                      </span>
                    </div>
                    <div style={{ color: EXP.muted }}>
                      SHA-256:{" "}
                      <span
                        style={{ color: EXP.text, fontFamily: "monospace" }}
                      >
                        {checksum?.sha256 ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gap: 8,
            border: "1px solid var(--overlay-border)",
            borderRadius: 12,
            padding: 12,
            background: "var(--overlay-bg-panel)",
          }}
        >
          <div style={{ color: EXP.text, fontWeight: 700, fontSize: 12 }}>
            {selectedCount === 1
              ? (primaryEntry?.name ?? "Selection")
              : `${selectedCount} items`}
          </div>
          <div
            style={{ color: EXP.muted, fontSize: 11, wordBreak: "break-all" }}
          >
            {entries.map((entry) => entry.path).join("\n")}
          </div>
        </div>
        {primaryEntry && (
          <div
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid var(--overlay-border)",
              borderRadius: 12,
              padding: 12,
              background: "var(--overlay-bg-panel)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: EXP.text, fontSize: 12, fontWeight: 700 }}>
                  {primaryEntry.name}
                </div>
                <div style={{ color: EXP.muted, fontSize: 10 }}>
                  {primaryEntry.is_dir ? "Folder" : "File"}
                </div>
              </div>
              <button
                type="button"
                onClick={onCalculateRecursiveSize}
                style={dialogSecondaryButtonStyle}
              >
                Calculate Recursive Size
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gap: 4,
                color: EXP.muted,
                fontSize: 11,
              }}
            >
              <div>
                Path:{" "}
                <span style={{ color: EXP.text, wordBreak: "break-all" }}>
                  {primaryEntry.path}
                </span>
              </div>
              <div>
                Size:{" "}
                <span style={{ color: EXP.text }}>
                  {formatSize(
                    recursiveSummary?.totalBytes ?? primaryEntry.size,
                  )}
                </span>
              </div>
              <div>
                Modified:{" "}
                <span style={{ color: EXP.text }}>
                  {formatDate(primaryEntry.modified)}
                </span>
              </div>
              {primaryProperties && (
                <>
                  <div>
                    Created:{" "}
                    <span style={{ color: EXP.text }}>
                      {primaryProperties.createdAtMs
                        ? new Date(
                            primaryProperties.createdAtMs,
                          ).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div>
                    Accessed:{" "}
                    <span style={{ color: EXP.text }}>
                      {primaryProperties.accessedAtMs
                        ? new Date(
                            primaryProperties.accessedAtMs,
                          ).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div>
                    Permissions:{" "}
                    <span style={{ color: EXP.text }}>
                      {primaryProperties.permissions.display}
                    </span>
                  </div>
                </>
              )}
              {recursiveSummary && (
                <div>
                  Recursive size:{" "}
                  <span style={{ color: EXP.text }}>
                    {formatSize(recursiveSummary.totalBytes)}
                  </span>
                  <span style={{ color: EXP.muted2 }}>
                    {" "}
                    · {recursiveSummary.fileCount} files ·{" "}
                    {recursiveSummary.folderCount} folders
                  </span>
                  {recursiveSummary.pending && (
                    <span style={{ color: EXP.muted2 }}> · updating…</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  })();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--overlay-explorer-modal-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "min(1020px, 96vw)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--overlay-explorer-preview-bg)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          padding: 20,
          boxShadow: "var(--overlay-explorer-modal-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ color: EXP.text, fontWeight: 700, fontSize: 14 }}>
              Properties
            </div>
            <div style={{ marginTop: 4, color: EXP.muted, fontSize: 11 }}>
              {selectedCount} item{selectedCount === 1 ? "" : "s"} in the drawer
              {state.loading ? " · updating…" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={dialogSecondaryButtonStyle}
          >
            Close
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              style={{
                background:
                  activeTab === tab.id
                    ? "var(--overlay-explorer-chip-active-bg)"
                    : "var(--overlay-explorer-chip-bg)",
                border:
                  activeTab === tab.id
                    ? "1px solid var(--overlay-explorer-chip-active-border)"
                    : "1px solid var(--overlay-explorer-chip-border)",
                borderRadius: "var(--overlay-explorer-control-radius)",
                color:
                  activeTab === tab.id
                    ? "var(--overlay-explorer-chip-active-text)"
                    : EXP.text,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ minHeight: 0, flex: 1 }}>
          <OverlayScrollArea style={{ maxHeight: "68vh" }}>
            <div style={{ display: "grid", gap: 12 }}>{panelBody}</div>
          </OverlayScrollArea>
        </div>
      </div>
    </div>
  );
}

function DuplicateFinderDialog({
  state,
  onCancelScan,
  onClose,
  onSelectPath,
  onRevealPath,
  onTrashPath,
  onDeletePath,
}: {
  state: DuplicateFinderState;
  onCancelScan: () => void;
  onClose: () => void;
  onSelectPath: (path: string) => void;
  onRevealPath: (path: string) => void;
  onTrashPath: (path: string) => void;
  onDeletePath: (path: string) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "var(--overlay-explorer-modal-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "min(1100px, 96vw)",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--overlay-explorer-preview-bg)",
          border: "1px solid var(--overlay-explorer-preview-border)",
          borderRadius: "var(--overlay-explorer-panel-radius)",
          padding: 20,
          boxShadow: "var(--overlay-explorer-modal-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ color: EXP.text, fontWeight: 700, fontSize: 14 }}>
              Duplicate Finder
            </div>
            <div style={{ marginTop: 4, color: EXP.muted, fontSize: 11 }}>
              {state.status
                ? `${state.status.groups.length} groups, ${state.status.scannedFileCount} files scanned`
                : state.loading
                  ? "Scanning current folder tree…"
                  : "Preparing duplicate scan…"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {state.loading && (
              <button onClick={onCancelScan} style={dialogSecondaryButtonStyle}>
                Cancel Scan
              </button>
            )}
            <button onClick={onClose} style={dialogSecondaryButtonStyle}>
              Close
            </button>
          </div>
        </div>
        <div
          style={{
            minHeight: 0,
            flex: 1,
            border: "1px solid var(--overlay-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <OverlayScrollArea style={{ maxHeight: "68vh" }}>
            <div style={{ display: "grid", gap: 12, padding: 12 }}>
              {state.status?.groups.map((group) => (
                <div
                  key={`${group.contentHash}-${group.fileSize}`}
                  style={{
                    border: "1px solid var(--overlay-border)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--overlay-bg-panel)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--overlay-border)",
                    }}
                  >
                    <span
                      style={{ color: EXP.text, fontSize: 12, fontWeight: 700 }}
                    >
                      {group.entries.length} duplicates
                    </span>
                    <span style={{ color: EXP.muted, fontSize: 11 }}>
                      {formatSize(group.fileSize)}
                    </span>
                  </div>
                  {group.entries.map((entry, index) => (
                    <div
                      key={entry.path}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 12,
                        padding: "9px 12px",
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid var(--overlay-border)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: EXP.text,
                            fontSize: 11.5,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {entry.name}
                        </div>
                        <div
                          style={{
                            marginTop: 3,
                            color: EXP.muted,
                            fontSize: 10,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {entry.path}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => onSelectPath(entry.path)}
                          style={dialogSecondaryButtonStyle}
                        >
                          Select
                        </button>
                        <button
                          onClick={() => onRevealPath(entry.path)}
                          style={dialogSecondaryButtonStyle}
                        >
                          Reveal
                        </button>
                        <button
                          onClick={() => onTrashPath(entry.path)}
                          style={dialogSecondaryButtonStyle}
                        >
                          Trash
                        </button>
                        <button
                          onClick={() => onDeletePath(entry.path)}
                          style={dialogDangerButtonStyle}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </OverlayScrollArea>
        </div>
      </div>
    </div>
  );
}

const dialogInputStyle: CSSProperties = {
  width: "100%",
  background: "var(--overlay-explorer-input-bg)",
  border: "1px solid var(--overlay-explorer-input-border)",
  borderRadius: "var(--overlay-explorer-control-radius)",
  color: EXP.text,
  fontSize: 12,
  padding: "8px 10px",
  outline: "none",
  boxSizing: "border-box",
};

const dialogSecondaryButtonStyle: CSSProperties = {
  background: "var(--overlay-explorer-chip-bg)",
  border: "1px solid var(--overlay-explorer-chip-border)",
  borderRadius: "var(--overlay-explorer-control-radius)",
  color: EXP.text,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

const dialogDangerButtonStyle: CSSProperties = {
  background: "var(--overlay-explorer-danger-soft-bg)",
  border: "1px solid var(--overlay-explorer-danger-soft-border)",
  borderRadius: "var(--overlay-explorer-control-radius)",
  color: EXP.red,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

// ─── Main FileExplorer ────────────────────────────────────────────────────────

interface FileExplorerProps {
  theme: {
    accent: string;
    bg: string;
    bgPanel: string;
    text: string;
    border: string;
    textMuted: string;
  };
  appearance?: ResolvedOverlayAppearance;
  explorerBackend?: ExplorerBackendContract;
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium?: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void;
  pluginActions?: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  layoutMode?: ExplorerLayoutMode;
  instanceId?: ExplorerInstanceId;
  workspacePaneCount?: 1 | 2 | 4;
  chromeControlSurface?: "toolbar" | "topbar";
  focusAddressBarSignal?: number;
  onWorkspaceRuntimeSnapshotChange?: (
    snapshot: ExplorerWorkspaceRuntimeSnapshot,
  ) => void;
  onWorkspaceSelectionTransferComplete?: (
    result: ExplorerWorkspaceSelectionTransferResult,
  ) => void;
  externalNavigationRequest?: ExplorerWorkspaceNavigationRequest | null;
  externalSelectionTransferRequest?: ExplorerWorkspaceSelectionTransferRequest | null;
  externalRefreshRequest?: ExplorerWorkspaceRefreshRequest | null;
  repositoryPicker?: {
    active: boolean;
    allowMultiple: boolean;
    requestId: number;
    onConfirm: (paths: string[]) => void;
    onCancel: () => void;
  } | null;
}

export interface ExplorerWorkspaceRuntimeSelectionEntry {
  path: string;
  name: string;
  is_dir: boolean;
}

export interface ExplorerWorkspaceRuntimeSnapshot {
  instanceId: ExplorerInstanceId;
  currentPath: string;
  currentPathIsCloud: boolean;
  selectedEntries: ExplorerWorkspaceRuntimeSelectionEntry[];
}

export interface ExplorerWorkspaceNavigationRequest {
  sequence: number;
  path: string;
  pushHistory?: boolean;
}

export interface ExplorerWorkspaceSelectionTransferRequest {
  sequence: number;
  targetDir: string;
  operation: FileTransferOperation;
}

export interface ExplorerWorkspaceRefreshRequest {
  sequence: number;
}

export interface ExplorerWorkspaceSelectionTransferResult {
  sequence: number;
  instanceId: ExplorerInstanceId;
  targetDir: string;
  operation: FileTransferOperation;
  sourcePaths: string[];
  success: boolean;
}

export function FileExplorer({
  theme,
  appearance,
  explorerBackend = explorerBackendContract,
  onOpenInTerminal,
  onOpenInFilesystemAquarium = () => undefined,
  onAddBookmark,
  pluginActions = [],
  pluginContextMenuItems = [],
  layoutMode = "full",
  instanceId = PRIMARY_EXPLORER_INSTANCE_ID,
  workspacePaneCount = 1,
  chromeControlSurface = "toolbar",
  focusAddressBarSignal = 0,
  onWorkspaceRuntimeSnapshotChange,
  onWorkspaceSelectionTransferComplete,
  externalNavigationRequest = null,
  externalSelectionTransferRequest = null,
  externalRefreshRequest = null,
  repositoryPicker = null,
}: FileExplorerProps) {
  const {
    applyBatchRenameRecipe: applyExplorerBatchRenameRecipe,
    calculateChecksums: calculateExplorerChecksums,
    calculateRecursiveSizes: calculateExplorerRecursiveSizes,
    cancelSearchEntries: cancelExplorerSearchEntries,
    cancelDuplicateScan: cancelExplorerDuplicateScan,
    fuzzyFilterEntries: fuzzyFilterExplorerEntries,
    createDir: createExplorerDir,
    createFile: createExplorerFile,
    deletePath: deleteExplorerPath,
    extractArchive: extractExplorerArchive,
    getDrives: getExplorerDrives,
    getHomeDir: getExplorerHomeDir,
    getItemProperties: getExplorerItemProperties,
    getRuntimeCachePolicy: getExplorerRuntimeCachePolicy,
    isCloudPath: isCloudExplorerPath,
    listLocation: listExplorerLocation,
    listLocationUncached: listExplorerLocationUncached,
    measureEntrySizes: measureExplorerEntrySizes,
    openArchive: openExplorerArchive,
    openPath: openExplorerPath,
    openWithDialog: openExplorerPathWithDialog,
    openPathAsAdmin: openExplorerPathAsAdmin,
    readFileBase64: readExplorerFileBase64,
    readEntryThumbnail: readExplorerEntryThumbnail,
    readTextFile: readExplorerTextFile,
    renamePath: renameExplorerPath,
    revealPath: revealExplorerPath,
    restoreRecentTrashAction: restoreExplorerTrashAction,
    showPathProperties: showExplorerPathProperties,
    listSavedSearches: listExplorerSavedSearches,
    deleteSavedSearch: deleteExplorerSavedSearch,
    listTags: listExplorerTags,
    planItemTransfer: planExplorerItemTransfer,
    searchEntriesWithDiagnostics: searchExplorerEntriesWithDiagnostics,
    saveSavedSearch: saveExplorerSavedSearch,
    setTagsForPaths: setExplorerTagsForPaths,
    supportsNativeDragOut,
    supportsNativeIntegration,
    supportsSearch,
    startDuplicateScan: startExplorerDuplicateScan,
    pollDuplicateScan: pollExplorerDuplicateScan,
    previewBatchRename: previewExplorerBatchRename,
    trashPaths: trashExplorerPaths,
    transferItems: transferExplorerItems,
    unwatchEntrySizeRoot: unwatchExplorerEntrySizeRoot,
    watchEntrySizeRoot: watchExplorerEntrySizeRoot,
    writeFile: writeExplorerFile,
  } = explorerBackend;
  const accent = theme.accent;
  const {
    explorerSettings,
    appearanceSettings,
    systemSettings,
    editorSettings,
    keybindings,
    clearExplorerChromeLayoutOverride,
    setExplorerChromeLayoutOverride,
    setExplorerModeProfileOverride,
    updateExplorerSettings,
  } = useSettingsStore(
    useShallow((state) => ({
      explorerSettings: state.settings.explorer,
      appearanceSettings: state.settings.appearance,
      systemSettings: state.settings.system,
      editorSettings: state.settings.editor,
      keybindings: state.settings.keybindings,
      clearExplorerChromeLayoutOverride:
        state.clearExplorerChromeLayoutOverride,
      setExplorerChromeLayoutOverride: state.setExplorerChromeLayoutOverride,
      setExplorerModeProfileOverride: state.setExplorerModeProfileOverride,
      updateExplorerSettings: state.updateExplorer,
    })),
  );
  const {
    chromeEditSession,
    explorerRail,
    closeChromeEditSession,
    updateExplorerSessionForInstance,
    updateExplorerRail,
    clipboard,
    jumpFilter,
    propertiesPanel,
    recursiveSizeCache,
    openChromeEditSession,
    registerChromeEditSurface,
    setClipboard,
    setChromeEditDraggingControl,
    setJumpFilter,
    setPropertiesPanel,
    setRecursiveSizeCacheEntry,
    unregisterChromeEditSurface,
    updateChromeEditDraft,
  } = useExplorerStore(
    useShallow((state) => ({
      chromeEditSession: state.chromeEditSession,
      explorerRail: state.rail,
      closeChromeEditSession: state.closeChromeEditSession,
      updateExplorerSessionForInstance: state.updateSessionForInstance,
      updateExplorerRail: state.updateRail,
      clipboard: state.clipboard,
      jumpFilter: state.jumpFilter,
      propertiesPanel: state.propertiesPanel,
      recursiveSizeCache: state.recursiveSizeCache,
      openChromeEditSession: state.openChromeEditSession,
      registerChromeEditSurface: state.registerChromeEditSurface,
      setClipboard: state.setClipboard,
      setChromeEditDraggingControl: state.setChromeEditDraggingControl,
      setJumpFilter: state.setJumpFilter,
      setPropertiesPanel: state.setPropertiesPanel,
      setRecursiveSizeCacheEntry: state.setRecursiveSizeCacheEntry,
      unregisterChromeEditSurface: state.unregisterChromeEditSurface,
      updateChromeEditDraft: state.updateChromeEditDraft,
    })),
  );
  const storedSourcesVisible = useExplorerStore(
    (state) =>
      state.sessions[instanceId]?.sourcesVisible ??
      defaultExplorerSession.sourcesVisible,
  );
  const storedPreviewEnabled = useExplorerStore(
    (state) =>
      state.sessions[instanceId]?.previewEnabled ??
      defaultExplorerSession.previewEnabled,
  );
  const storedPreviewLocked = useExplorerStore(
    (state) =>
      state.sessions[instanceId]?.previewLocked ??
      defaultExplorerSession.previewLocked,
  );
  const storedPreviewSplitMode = useExplorerStore(
    (state) =>
      state.sessions[instanceId]?.previewSplitMode ??
      defaultExplorerSession.previewSplitMode,
  );
  const storedShellLayoutId = useExplorerStore(
    (state) =>
      state.sessions[instanceId]?.shellLayoutId ??
      defaultExplorerSession.shellLayoutId,
  );
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const explorerSearchScopeId = useId();
  const explorerSearchScope = useMemo(
    () => resolveExplorerSearchScope(explorerSearchScopeId),
    [explorerSearchScopeId],
  );
  const isCompactDock = layoutMode === "dock";
  const showsGlobalChromeControls = chromeControlSurface === "topbar";
  const usesWorkspaceCompactChrome = workspacePaneCount > 1;
  const usesWorkspaceQuadChrome = workspacePaneCount === 4;
  const explorerTheme = useMemo(
    () => appearance?.explorerTheme ?? resolveExplorerThemeRecipe(appearance),
    [appearance],
  );
  const explorerChromeThemeId = useMemo(() => {
    const resolvedAppearanceThemeId = appearance?.baseTheme.id?.trim();
    if (resolvedAppearanceThemeId) {
      return resolvedAppearanceThemeId;
    }

    const activeThemeId = appearanceSettings.activeThemeId.trim();
    return activeThemeId || "operator";
  }, [appearance?.baseTheme.id, appearanceSettings.activeThemeId]);
  const sidebarBounds = getExplorerRailWidthBounds(isCompactDock);
  const uiFont = appearance?.fonts.ui ?? "Inter,system-ui,sans-serif";
  const themeIconTheme =
    appearance?.theme.assets?.iconTheme ?? getBuiltInIconTheme();
  const useNativeOsIcons = appearanceSettings.useNativeOsIcons;
  const explorerBlurEnabled = appearanceSettings.appBlur !== false;
  const shaderPerformanceMode = appearanceSettings.shaderPerformanceMode;
  const shaderPerformanceProfile = getShaderPerformanceProfile(shaderPerformanceMode);
  const showHidden = explorerSettings.showHiddenFiles;
  const explorerThumbnailSettings = explorerSettings.thumbnails;
  const viewMode = explorerSettings.viewMode;
  const gridZoom = explorerSettings.gridZoom;
  const experimentalViewMode = explorerSettings.experimentalViewMode;
  const experimentalDensity = explorerSettings.experimentalDensity;
  const folderClickMode = explorerSettings.folderClickMode;
  const doubleClickEmptyToGoBack = explorerSettings.doubleClickEmptyToGoBack;
  // Session is only used to seed the explorer's local state. Avoid subscribing to it
  // so high-frequency local changes (typing, resizing) don't force extra store-driven renders.
  const initialSessionRef = useRef(
    useExplorerStore.getState().getSession(instanceId),
  );
  const initialSession = initialSessionRef.current;
  const initialSessionPathRef = useRef(initialSession.currentPath.trim());
  const [currentPath, setCurrentPath] = useState(
    () => initialSession.currentPath,
  );
  const [history, setHistory] = useState<string[]>(
    () => initialSession.history,
  );
  const [historyIdx, setHistoryIdx] = useState(() => initialSession.historyIdx);
  const historyRef = useRef(history);
  const historyIdxRef = useRef(historyIdx);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const width =
      typeof initialSession.sidebarWidth === "number"
        ? initialSession.sidebarWidth
        : sidebarBounds.defaultWidth;
    return Math.max(
      sidebarBounds.minWidth,
      Math.min(sidebarBounds.maxWidth, width),
    );
  });
  const [previewWidth, setPreviewWidth] = useState(() => {
    if (typeof initialSession.previewWidth === "number") {
      return Math.max(
        EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
        Math.min(
          EXPLORER_PREVIEW_WIDTH_BOUNDS.max,
          initialSession.previewWidth,
        ),
      );
    }
    return Math.max(
      EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
      Math.min(
        EXPLORER_PREVIEW_WIDTH_BOUNDS.max,
        Math.round(explorerTheme.metrics.previewWidth),
      ),
    );
  });
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [entrySizes, setEntrySizes] = useState<
    Record<string, EntryStorageInfo>
  >({});
  const [entrySizeLoadingPaths, setEntrySizeLoadingPaths] = useState<
    Set<string>
  >(() => new Set());
  const [nativeIconMap, setNativeIconMap] = useState<
    Record<string, string | null>
  >({});
  const [nativeIconLoadingKeys, setNativeIconLoadingKeys] = useState<
    Set<string>
  >(() => new Set());
  const [entryThumbnailMap, setEntryThumbnailMap] = useState<
    Record<string, ExplorerEntryThumbnailData | null>
  >({});
  const [entryThumbnailLoadingPaths, setEntryThumbnailLoadingPaths] = useState<
    Set<string>
  >(() => new Set());
  const [videoHoverThumbnailLoadingPaths, setVideoHoverThumbnailLoadingPaths] =
    useState<Set<string>>(() => new Set());
  const [hoveredVideoThumbnailPath, setHoveredVideoThumbnailPath] = useState<
    string | null
  >(null);
  const previewLoadRequestIdRef = useRef(0);
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState(() => initialSession.search);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchIncludeContent, setSearchIncludeContent] = useState(
    () => initialSession.searchIncludeContent,
  );
  const [documentViewMode, setDocumentViewMode] =
    useState<ExplorerDocumentViewMode>(() => initialSession.documentViewMode);
  const [previewEnabled, setPreviewEnabled] = useState(
    () => initialSession.previewEnabled,
  );
  const [previewLocked, setPreviewLocked] = useState(
    () => initialSession.previewLocked,
  );
  const [previewSplitMode, setPreviewSplitMode] =
    useState<ExplorerPreviewSplitMode>(() => initialSession.previewSplitMode);
  const [sourcesVisible, setSourcesVisible] = useState(
    () => initialSession.sourcesVisible,
  );
  const [preview, setPreview] = useState<PreviewState>({
    type: "none",
    path: "",
  });
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    entry: null,
  });
  const [showModeProfileMenu, setShowModeProfileMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [rename, setRename] = useState<RenameState>({
    active: false,
    path: "",
    name: "",
  });
  const [deleteTargets, setDeleteTargets] = useState<FileEntry[]>([]);
  const [transferConflictDialog, setTransferConflictDialog] =
    useState<TransferConflictDialogState>({
      visible: false,
      collisions: [],
      targetDir: "",
      sources: [],
      operation: "copy",
    });
  const [transferConflictPolicy, setTransferConflictPolicy] =
    useState<ExplorerFileTransferCollisionPolicy>("keep_both");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSurfaceMode, setPreviewSurfaceMode] =
    useState<PreviewSurfaceMode>("content");
  const [previewTerminalMounted, setPreviewTerminalMounted] = useState(false);
  const [previewTerminalCommandRequest, setPreviewTerminalCommandRequest] =
    useState<TerminalOverlayCommandRequest | null>(null);
  const [
    previewTerminalReportedWorkingDirectory,
    setPreviewTerminalReportedWorkingDirectory,
  ] = useState<string | null>(null);
  const [pdfPreviewChromeState, setPdfPreviewChromeState] =
    useState<ExplorerPdfWorkbenchChromeState | null>(null);
  const [newItem, setNewItem] = useState<NewItemState>({
    visible: false,
    kind: "folder",
  });
  const [newItemName, setNewItemName] = useState("");
  const [tagDialog, setTagDialog] = useState<TagDialogState>({
    visible: false,
    mode: "add",
    paths: [],
    input: "",
    title: "Add Tags",
    description: "",
  });
  const [batchRename, setBatchRename] = useState<BatchRenameState>({
    visible: false,
    mode: "literal",
    findText: "",
    replaceText: "",
    prefix: "",
    suffix: "",
    startingNumber: 1,
    padding: 2,
  });
  const [batchRenamePreviewRows, setBatchRenamePreviewRows] = useState<
    ExplorerBatchRenamePreview[]
  >([]);
  const [propertiesChecksums, setPropertiesChecksums] = useState<
    Record<string, ExplorerChecksumInfo>
  >({});
  const [propertiesInfoByPath, setPropertiesInfoByPath] = useState<
    Record<string, ExplorerItemProperties>
  >({});
  const [propertiesChecksumLoadingPaths, setPropertiesChecksumLoadingPaths] =
    useState<Set<string>>(() => new Set());
  const [propertiesChecksumError, setPropertiesChecksumError] = useState<
    string | null
  >(null);
  const [saveSearchState, setSaveSearchState] = useState<SaveSearchState>({
    visible: false,
    name: "",
  });
  const [duplicateFinder, setDuplicateFinder] = useState<DuplicateFinderState>({
    visible: false,
    scanId: null,
    status: null,
    loading: false,
  });
  const [tagMetadata, setTagMetadata] = useState<ExplorerTagMetadataSnapshot>({
    tags: [],
    assignments: [],
  });
  const [savedSearches, setSavedSearches] = useState<ExplorerSavedSearch[]>([]);
  const [activeTagFilterIds, setActiveTagFilterIds] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null); // path being dragged over
  const [constellationCamera, setConstellationCamera] =
    useState<ConstellationCameraState>({
      x: 0,
      y: 0,
      zoom: CONSTELLATION_CAMERA_ZOOM_RANGE.default,
    });
  const [constellationIsPanning, setConstellationIsPanning] = useState(false);
  const dragOverRef = useRef<string | null>(null);
  const constellationViewportRef = useRef<HTMLDivElement | null>(null);
  const constellationPanGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    targetNodePath: string | null;
    moved: boolean;
  } | null>(null);
  const constellationSuppressClickPathRef = useRef<string | null>(null);
  const constellationCameraUserOwnedRef = useRef(false);
  const constellationSceneKeyRef = useRef<string | null>(null);
  const [windowDropState, setWindowDropState] = useState<{
    active: boolean;
    count: number;
  }>({ active: false, count: 0 });
  // `lastSelected` tracks the actively focused entry for keyboard traversal.
  // Range extension keeps its own anchor so repeated Shift+Arrow movement grows
  // from the original anchor instead of snapping to the first selected row.
  const lastSelected = useRef<string | null>(null);
  const selectionRangeAnchorPathRef = useRef<string | null>(null);
  const previewRef = useRef(preview);
  const previewCloseGuardRef = useRef<PreviewCloseGuard | null>(null);
  const previewReopenOnSelectionRef = useRef(false);
  const allowPreviewLoadWhileClosedRef = useRef(false);
  const previewSaveTimer = useRef<number | null>(null);
  const setExplorerDragOverTarget = useCallback((targetPath: string | null) => {
    dragOverRef.current = targetPath;
    setDragOver(targetPath);
  }, []);
  const shaderPreviewSelectionMemoryRef = useRef<
    Map<string, ExplorerShaderSelectionMemory>
  >(new Map());
  const lastPreviewTerminalShellReportedCwdRef = useRef<string | null>(null);
  const lastPreviewTerminalExplorerAppliedCwdRef = useRef<string | null>(null);
  const previewTerminalCommandSequenceRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const searchFocusRequestIdRef = useRef(0);
  const jumpFilterRequestIdRef = useRef(0);
  const batchRenamePreviewRequestIdRef = useRef(0);
  const recursiveSizeRequestIdRef = useRef(0);
  const propertiesChecksumRequestIdRef = useRef(0);
  const propertiesInfoRequestIdRef = useRef(0);
  const isExplorerMountedRef = useRef(false);
  const directoryLoadRequestIdRef = useRef(0);
  const pendingNavigationPathRef = useRef<string | null>(null);
  const pendingNavigationHistoryRef = useRef<string[] | null>(null);
  const pendingNavigationHistoryIdxRef = useRef<number | null>(null);
  const bootNavigationSequenceRef = useRef(0);
  const initialInteractiveRecordedRef = useRef(false);
  const explorerMountStartedAtRef = useRef(getExplorerPerformanceNow());
  const runtimeCachePolicyTelemetryMetadataRef =
    useRef<RuntimeCachePolicyTelemetryMetadata>(
      getRuntimeCachePolicyTelemetryMetadata(
        null,
        isTauri() ? "pending" : "unavailable",
      ),
    );
  const pendingExplorerMetricSamplesRef = useRef<PendingExplorerMetricSample[]>(
    [],
  );
  const pendingTransferRequestRef = useRef<{
    request: PendingExplorerTransferRequest;
    onSuccess?: (results: FileTransferResult[]) => Promise<void> | void;
    onCancel?: () => void;
  } | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");
  const [locationBreadcrumbs, setLocationBreadcrumbs] = useState<
    { label: string; path: string }[]
  >([]);
  const [locationParentPath, setLocationParentPath] = useState<string | null>(
    null,
  );
  const lastFocusAddressBarSignalRef = useRef(focusAddressBarSignal);
  const lastWorkspaceNavigationSequenceRef = useRef(0);
  const lastWorkspaceTransferSequenceRef = useRef(0);
  const lastWorkspaceRefreshSequenceRef = useRef(0);
  useExplorerTaskProgressFeed();

  const mainRef = useRef<HTMLDivElement>(null);
  const explorerViewportRef = useRef<HTMLDivElement | null>(null);
  const explorerViewportScrollTopRef = useRef(0);
  const modeProfileMenuAnchorRef = useRef<HTMLDivElement>(null);
  const layoutMenuAnchorRef = useRef<HTMLDivElement>(null);
  const layoutWheelDeltaAccumulatorRef = useRef(0);
  const previewWarmupStartedRef = useRef(false);
  const previewWarmupTimerRef = useRef<number | null>(null);
  const [zoomHudVisible, setZoomHudVisible] = useState(false);
  const zoomHudTimerRef = useRef<number | null>(null);
  const [experimentalHudVisible, setExperimentalHudVisible] = useState(false);
  const experimentalHudTimerRef = useRef<number | null>(null);
  const [localTreeRefreshRevision, setLocalTreeRefreshRevision] = useState(0);
  const [explorerViewportMetrics, setExplorerViewportMetrics] =
    useState<ViewportMetrics>({
      scrollTop: 0,
      clientHeight: 0,
      clientWidth: 0,
    });
  const currentPathIsCloud =
    currentPath.length > 0 && isCloudExplorerPath(currentPath);
  const previewTerminalNamespace = useMemo(
    () => `preview-${String(instanceId).replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    [instanceId],
  );
  const previewTerminalWorkingDirectory =
    currentPathIsCloud
      ? null
      : preview.type === "text" && preview.scriptPreview != null
        ? getPathParent(preview.path) ?? currentPath
        : currentPath;
  const previewPanelVisible =
    !isCompactDock && previewEnabled && !usesWorkspaceCompactChrome;
  const hasPreview = previewPanelVisible && preview.type !== "none";
  const isExperimentalViewEligible =
    !isCompactDock && search.trim().length === 0;

  useEffect(() => {
    setJumpFilter(null);
  }, [currentPath, setJumpFilter]);

  useEffect(() => {
    if (!currentPath || currentPathIsCloud) {
      return;
    }

    queueExplorerTerminalDirectorySync({
      path: currentPath,
      shell: useSettingsStore.getState().settings.terminal.shell,
      source: "navigation",
    });
  }, [currentPath, currentPathIsCloud]);

  const syncExplorerViewportSize = useCallback(
    (viewport?: HTMLDivElement | null) => {
      const target = viewport ?? explorerViewportRef.current;
      if (!target) {
        return;
      }
      const nextMetrics = readViewportMetrics(target);
      setExplorerViewportMetrics((current) =>
        current.clientHeight === nextMetrics.clientHeight &&
        current.clientWidth === nextMetrics.clientWidth
          ? current
          : {
              ...current,
              clientHeight: nextMetrics.clientHeight,
              clientWidth: nextMetrics.clientWidth,
            },
      );
    },
    [],
  );

  const commitExplorerViewportScrollTop = useCallback((scrollTop: number) => {
    explorerViewportScrollTopRef.current = scrollTop;
    setExplorerViewportMetrics((current) =>
      current.scrollTop === scrollTop ? current : { ...current, scrollTop },
    );
  }, []);

  const syncExplorerViewportScrollTop = useCallback(
    (viewport?: HTMLDivElement | null) => {
      const target = viewport ?? explorerViewportRef.current;
      if (!target) {
        return;
      }
      commitExplorerViewportScrollTop(target.scrollTop);
    },
    [commitExplorerViewportScrollTop],
  );

  const setExplorerViewportScrollTop = useCallback(
    (scrollTop: number) => {
      const viewport = explorerViewportRef.current;
      if (viewport && Math.abs(viewport.scrollTop - scrollTop) > 0.5) {
        viewport.scrollTop = scrollTop;
      }
      commitExplorerViewportScrollTop(scrollTop);
    },
    [commitExplorerViewportScrollTop],
  );

  const resetExplorerViewport = useCallback(() => {
    layoutWheelDeltaAccumulatorRef.current = 0;
    setExplorerViewportScrollTop(0);
  }, [setExplorerViewportScrollTop]);

  useEffect(() => {
    let disposed = false;
    void listExplorerSavedSearches()
      .then((records) => {
        if (!disposed) {
          setSavedSearches(records);
        }
      })
      .catch(() => {
        if (!disposed) {
          setSavedSearches([]);
        }
      });
    return () => {
      disposed = true;
    };
  }, [listExplorerSavedSearches]);

  useEffect(() => {
    if (currentPathIsCloud) {
      setTagMetadata({ tags: [], assignments: [] });
      return;
    }
    let disposed = false;
    const paths = Array.from(
      new Set([...entries, ...searchResults].map((entry) => entry.path)),
    ).slice(0, 500);
    void listExplorerTags(paths)
      .then((snapshot) => {
        if (!disposed) {
          setTagMetadata(snapshot);
        }
      })
      .catch(() => {
        if (!disposed) {
          setTagMetadata({ tags: [], assignments: [] });
        }
      });
    return () => {
      disposed = true;
    };
  }, [currentPathIsCloud, entries, listExplorerTags, searchResults]);

  useEffect(() => {
    setSourcesVisible(storedSourcesVisible);
  }, [storedSourcesVisible]);

  useEffect(() => {
    setPreviewEnabled(storedPreviewEnabled);
  }, [storedPreviewEnabled]);

  useEffect(() => {
    setPreviewLocked(storedPreviewLocked);
  }, [storedPreviewLocked]);

  useEffect(() => {
    setPreviewSplitMode(storedPreviewSplitMode);
  }, [storedPreviewSplitMode]);

  useEffect(() => {
    setSidebarWidth((current) =>
      Math.max(
        sidebarBounds.minWidth,
        Math.min(sidebarBounds.maxWidth, current),
      ),
    );
  }, [sidebarBounds.maxWidth, sidebarBounds.minWidth]);

  useEffect(() => {
    setPreviewWidth((current) =>
      Math.max(
        EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
        Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, current),
      ),
    );
  }, [explorerTheme.metrics.previewWidth]);

  const showExperimentalHud = useCallback(() => {
    setExperimentalHudVisible(true);
    if (experimentalHudTimerRef.current != null) {
      window.clearTimeout(experimentalHudTimerRef.current);
    }
    experimentalHudTimerRef.current = window.setTimeout(() => {
      setExperimentalHudVisible(false);
      experimentalHudTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    if (preview.type !== "pdf") {
      setPdfPreviewChromeState(null);
    }
  }, [preview.path, preview.type]);

  useEffect(() => {
    if (!showModeProfileMenu && !showLayoutMenu) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (modeProfileMenuAnchorRef.current?.contains(event.target as Node)) {
        return;
      }
      if (layoutMenuAnchorRef.current?.contains(event.target as Node)) {
        return;
      }
      setShowModeProfileMenu(false);
      setShowLayoutMenu(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [showLayoutMenu, showModeProfileMenu]);

  const flushPendingExplorerMetrics = useCallback(
    (runtimePolicyMetadata: RuntimeCachePolicyTelemetryMetadata) => {
      if (pendingExplorerMetricSamplesRef.current.length === 0) {
        return;
      }

      const pendingSamples = finalizePendingExplorerMetricSamples(
        pendingExplorerMetricSamplesRef.current,
        runtimePolicyMetadata,
      );
      pendingExplorerMetricSamplesRef.current = [];
      for (const sample of pendingSamples) {
        recordExplorerPerformanceSample(sample);
      }
    },
    [],
  );

  const recordExplorerMetric = useCallback(
    (input: {
      metricId: ExplorerPerformanceMetricId;
      durationMs: number;
      metadata?: ExplorerPerformanceMetadata;
    }) => {
      const runtimePolicyMetadata =
        runtimeCachePolicyTelemetryMetadataRef.current;
      if (
        isTauri() &&
        runtimePolicyMetadata.runtimeCachePolicyStatus === "pending"
      ) {
        pendingExplorerMetricSamplesRef.current.push({
          ...input,
          recordedAt: Date.now(),
        });
        return;
      }

      recordExplorerPerformanceSample({
        ...input,
        recordedAt: Date.now(),
        metadata: {
          ...runtimePolicyMetadata,
          ...(input.metadata ?? {}),
        },
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
        previewSaveTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isExplorerMountedRef.current = true;

    return () => {
      isExplorerMountedRef.current = false;
      searchRequestIdRef.current += 1;
      directoryLoadRequestIdRef.current += 1;
      recursiveSizeRequestIdRef.current += 1;
      propertiesChecksumRequestIdRef.current += 1;
      propertiesInfoRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      runtimeCachePolicyTelemetryMetadataRef.current =
        getRuntimeCachePolicyTelemetryMetadata(null, "unavailable");
      flushPendingExplorerMetrics(
        runtimeCachePolicyTelemetryMetadataRef.current,
      );
      return undefined;
    }

    let disposed = false;
    void getExplorerRuntimeCachePolicy()
      .then((policy) => {
        if (disposed) {
          return;
        }
        runtimeCachePolicyTelemetryMetadataRef.current =
          getRuntimeCachePolicyTelemetryMetadata(policy, "ready");
        flushPendingExplorerMetrics(
          runtimeCachePolicyTelemetryMetadataRef.current,
        );
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        runtimeCachePolicyTelemetryMetadataRef.current =
          getRuntimeCachePolicyTelemetryMetadata(null, "failed");
        flushPendingExplorerMetrics(
          runtimeCachePolicyTelemetryMetadataRef.current,
        );
      });

    return () => {
      disposed = true;
      flushPendingExplorerMetrics(
        runtimeCachePolicyTelemetryMetadataRef.current,
      );
    };
  }, [flushPendingExplorerMetrics]);

  useEffect(() => {
    updateExplorerSessionForInstance(instanceId, {
      currentPath,
      history,
      historyIdx,
      sidebarWidth,
      previewWidth,
      previewEnabled,
      previewLocked,
      previewSplitMode,
      search,
      searchIncludeContent,
      documentViewMode,
      sourcesVisible,
    });
  }, [
    currentPath,
    history,
    historyIdx,
    documentViewMode,
    previewEnabled,
    previewLocked,
    previewSplitMode,
    previewWidth,
    search,
    searchIncludeContent,
    sidebarWidth,
    sourcesVisible,
    instanceId,
    updateExplorerSessionForInstance,
  ]);

  // ── Navigate ──
  const navigate = useCallback(
    async (path: string, push = true) => {
      if (!isExplorerMountedRef.current) {
        return;
      }
      const startedAt = getExplorerPerformanceNow();
      const normalizedPath = normalizeExplorerPath(path);
      const requestId = directoryLoadRequestIdRef.current + 1;
      directoryLoadRequestIdRef.current = requestId;
      const isActiveDirectoryLoadRequest = () =>
        isExplorerMountedRef.current &&
        directoryLoadRequestIdRef.current === requestId;

      const nextHistory = push
        ? [
            ...historyRef.current.slice(0, historyIdxRef.current + 1),
            normalizedPath,
          ]
        : historyRef.current;
      const nextHistoryIdx = push
        ? historyIdxRef.current + 1
        : historyIdxRef.current;

      pendingNavigationPathRef.current = normalizedPath;
      pendingNavigationHistoryRef.current = nextHistory;
      pendingNavigationHistoryIdxRef.current = nextHistoryIdx;

      setAddressEditing(false);
      setAddressDraft("");
      setError(null);
      setLoading(true);
      try {
        const nextListing = await loadCachedExplorerLocation({
          path: normalizedPath,
          showHidden,
          listLocation: listExplorerLocation,
        });
        if (!isActiveDirectoryLoadRequest()) {
          return;
        }
        pendingNavigationPathRef.current = null;
        pendingNavigationHistoryRef.current = null;
        pendingNavigationHistoryIdxRef.current = null;
        historyRef.current = nextHistory;
        historyIdxRef.current = nextHistoryIdx;
        setCurrentPath(normalizedPath);
        setHistory(nextHistory);
        setHistoryIdx(nextHistoryIdx);
        setSelected(new Set());
        setSearch("");
        setSearchResults([]);
        setSearchLoading(false);
        setEntries(nextListing.entries);
        setEntrySizeLoadingPaths(new Set());
        setLocationBreadcrumbs(nextListing.breadcrumbs);
        setLocationParentPath(nextListing.parentPath);
        resetExplorerViewport();
        recordExplorerMetric({
          metricId: "explorer_navigation",
          durationMs: getExplorerPerformanceNow() - startedAt,
          metadata: {
            entryCount: nextListing.entries.length,
            pathDepth: nextListing.breadcrumbs.length,
            showHidden,
            success: true,
          },
        });
      } catch (e) {
        if (!isActiveDirectoryLoadRequest()) {
          return;
        }
        pendingNavigationPathRef.current = null;
        pendingNavigationHistoryRef.current = null;
        pendingNavigationHistoryIdxRef.current = null;
        setError(String(e));
        recordExplorerMetric({
          metricId: "explorer_navigation",
          durationMs: getExplorerPerformanceNow() - startedAt,
          metadata: {
            entryCount: 0,
            pathDepth: normalizedPath.split(/[\\/]/).filter(Boolean).length,
            showHidden,
            success: false,
          },
        });
      } finally {
        if (isActiveDirectoryLoadRequest()) {
          setLoading(false);
        }
      }
    },
    [
      listExplorerLocation,
      recordExplorerMetric,
      resetExplorerViewport,
      showHidden,
    ],
  );

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIdxRef.current = historyIdx;
  }, [historyIdx]);

  const runDeferredBootNavigation = useCallback(
    async (generation: number, path: string, push = true) => {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });
      if (
        !isExplorerMountedRef.current ||
        bootNavigationSequenceRef.current !== generation
      ) {
        return false;
      }
      await navigate(path, push);
      return true;
    },
    [navigate],
  );

  // ── Boot ──
  useEffect(() => {
    let disposed = false;
    const generation = bootNavigationSequenceRef.current + 1;
    bootNavigationSequenceRef.current = generation;

    const isActiveBootNavigation = () =>
      !disposed &&
      isExplorerMountedRef.current &&
      bootNavigationSequenceRef.current === generation;

    setDrivesLoading(true);
    getExplorerDrives()
      .then((nextDrives) => {
        if (!disposed) {
          setDrives(nextDrives);
        }
      })
      .catch(() => {
        if (!disposed) {
          setDrives([]);
        }
      })
      .finally(() => {
        if (!disposed) {
          setDrivesLoading(false);
        }
      });

    const navigateToResolvedHome = async () => {
      let fallbackPath = getFallbackExplorerPath(runtimePlatform);
      try {
        const resolvedHome = await getExplorerHomeDir();
        if (resolvedHome.trim()) {
          fallbackPath = resolvedHome;
        }
      } catch {
        // Keep the platform fallback path below.
      }
      if (!isActiveBootNavigation()) {
        return false;
      }
      return runDeferredBootNavigation(generation, fallbackPath);
    };

    const navigateToBootstrapPath = async (bootstrapPath: string) => {
      const navigated = await runDeferredBootNavigation(
        generation,
        bootstrapPath,
      );
      if (navigated || !isActiveBootNavigation()) {
        return navigated;
      }
      return navigateToResolvedHome();
    };

    const resetBootSession = () => {
      if (!isActiveBootNavigation()) {
        return;
      }
      initialSessionPathRef.current = "";
      setCurrentPath("");
      setHistory([]);
      setHistoryIdx(-1);
      updateExplorerSessionForInstance(instanceId, {
        currentPath: "",
        history: [],
        historyIdx: -1,
      });
    };

    const startBootNavigation = async () => {
      const restoredPath = initialSessionPathRef.current;
      if (restoredPath) {
        const restored = await runDeferredBootNavigation(
          generation,
          restoredPath,
          false,
        );
        if (restored || !isActiveBootNavigation()) {
          return;
        }
        resetBootSession();
      }

      const preferredPath = explorerSettings.defaultPath.trim();
      const bootstrapPath =
        preferredPath && preferredPath !== "." ? preferredPath : null;
      if (bootstrapPath) {
        await navigateToBootstrapPath(bootstrapPath);
        return;
      }
      await navigateToResolvedHome();
    };

    void startBootNavigation();

    return () => {
      disposed = true;
      if (bootNavigationSequenceRef.current === generation) {
        bootNavigationSequenceRef.current += 1;
      }
    };
  }, [
    explorerSettings.defaultPath,
    getExplorerDrives,
    getExplorerHomeDir,
    instanceId,
    runDeferredBootNavigation,
    runtimePlatform,
    updateExplorerSessionForInstance,
  ]);

  const runSearch = useCallback(
    async (query: string, requestId: number) => {
      const isActiveSearchRequest = () =>
        isExplorerMountedRef.current &&
        searchRequestIdRef.current === requestId;
      const trimmed = query.trim();
      if (!trimmed || !currentPath) {
        if (!isExplorerMountedRef.current) {
          return;
        }
        startTransition(() => {
          setSearchResults([]);
        });
        setSearchLoading(false);
        return;
      }

      if (!supportsSearch(currentPath)) {
        if (!isExplorerMountedRef.current) {
          return;
        }
        startTransition(() => {
          setSearchResults([]);
        });
        setSearchLoading(false);
        setError("Search is not available for cloud drives yet.");
        return;
      }

      if (!isExplorerMountedRef.current) {
        return;
      }
      setSearchLoading(true);
      const startedAt = getExplorerPerformanceNow();
      const searchCacheKey = getExplorerSearchCacheKey({
        path: currentPath,
        query: trimmed,
        showHidden,
        includeContent: searchIncludeContent,
      });
      try {
        const response = await getOrLoadCachedExplorerSearchResults(
          searchCacheKey,
          async () => {
            const nextResponse = await searchExplorerEntriesWithDiagnostics({
              path: currentPath,
              query: trimmed,
              showHidden,
              includeContent: searchIncludeContent,
              limit: 250,
              requestId,
              requestScope: explorerSearchScope,
            });
            return {
              results: nextResponse.results,
              diagnostics: nextResponse.diagnostics,
            };
          },
        );
        const results = response.results;
        if (isActiveSearchRequest()) {
          startTransition(() => {
            if (isActiveSearchRequest()) {
              setSearchResults(results);
            }
          });
          recordExplorerMetric({
            metricId: "explorer_search",
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              includeContent: searchIncludeContent,
              queryLength: trimmed.length,
              resultCount: results.length,
              success: true,
              ...getExplorerSearchTelemetryMetadata(response.diagnostics),
            },
          });
        }
      } catch (searchError) {
        if (isActiveSearchRequest()) {
          startTransition(() => {
            if (isActiveSearchRequest()) {
              setSearchResults([]);
            }
          });
          setError(`Search failed: ${searchError}`);
          recordExplorerMetric({
            metricId: "explorer_search",
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              includeContent: searchIncludeContent,
              queryLength: trimmed.length,
              resultCount: 0,
              success: false,
            },
          });
        }
      } finally {
        if (isActiveSearchRequest()) {
          setSearchLoading(false);
        }
      }
    },
    [
      currentPath,
      explorerSearchScope,
      recordExplorerMetric,
      searchIncludeContent,
      showHidden,
      supportsSearch,
    ],
  );

  const refresh = useCallback(async () => {
    const refreshPath = pendingNavigationPathRef.current?.trim() || currentPath;
    if (!refreshPath || !isExplorerMountedRef.current) return;
    const requestId = directoryLoadRequestIdRef.current + 1;
    directoryLoadRequestIdRef.current = requestId;
    const isActiveDirectoryLoadRequest = () =>
      isExplorerMountedRef.current &&
      directoryLoadRequestIdRef.current === requestId;
    const entriesToInvalidate = search.trim() ? searchResults : entries;
    const pendingNavigationPath = pendingNavigationPathRef.current;
    invalidateExplorerResultCaches(refreshPath);
    setLocalTreeRefreshRevision((current) => current + 1);
    setLoading(true);
    setEntrySizes((current) => {
      if (entriesToInvalidate.length === 0) {
        return current;
      }
      const next = { ...current };
      let changed = false;
      for (const entry of entriesToInvalidate) {
        if (next[entry.path]) {
          delete next[entry.path];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setEntrySizeLoadingPaths(new Set());
    setEntryThumbnailMap((current) => {
      if (entriesToInvalidate.length === 0) {
        return current;
      }
      const next = { ...current };
      let changed = false;
      for (const entry of entriesToInvalidate) {
        if (next[entry.path] !== undefined) {
          delete next[entry.path];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setEntryThumbnailLoadingPaths(new Set());
    setVideoHoverThumbnailLoadingPaths(new Set());
    setHoveredVideoThumbnailPath(null);
    try {
      const nextListing = await listExplorerLocationUncached(
        refreshPath,
        showHidden,
      );
      if (!isActiveDirectoryLoadRequest()) {
        return;
      }
      storeExplorerCachedLocation({
        path: refreshPath,
        showHidden,
        listing: nextListing,
      });
      startTransition(() => {
        if (isActiveDirectoryLoadRequest()) {
          if (pendingNavigationPath && refreshPath === pendingNavigationPath) {
            const pendingHistory =
              pendingNavigationHistoryRef.current ?? historyRef.current;
            const pendingHistoryIdx =
              pendingNavigationHistoryIdxRef.current ?? historyIdxRef.current;
            pendingNavigationPathRef.current = null;
            pendingNavigationHistoryRef.current = null;
            pendingNavigationHistoryIdxRef.current = null;
            historyRef.current = pendingHistory;
            historyIdxRef.current = pendingHistoryIdx;
            setCurrentPath(refreshPath);
            setHistory(pendingHistory);
            setHistoryIdx(pendingHistoryIdx);
          }
          setEntries(nextListing.entries);
          setLocationBreadcrumbs(nextListing.breadcrumbs);
          setLocationParentPath(nextListing.parentPath);
        }
      });
    } catch (e) {
      if (isActiveDirectoryLoadRequest()) {
        if (pendingNavigationPath && refreshPath === pendingNavigationPath) {
          pendingNavigationPathRef.current = null;
          pendingNavigationHistoryRef.current = null;
          pendingNavigationHistoryIdxRef.current = null;
        }
        setError(String(e));
      }
    } finally {
      if (isActiveDirectoryLoadRequest()) {
        setLoading(false);
      }
    }
    if (
      isActiveDirectoryLoadRequest() &&
      search.trim() &&
      supportsSearch(refreshPath)
    ) {
      const requestId = ++searchRequestIdRef.current;
      void runSearch(search, requestId);
    }
  }, [
    currentPath,
    entries,
    listExplorerLocationUncached,
    search,
    searchResults,
    showHidden,
    runSearch,
    supportsSearch,
  ]);

  useEffect(() => {
    refresh();
  }, [showHidden]);

  useEffect(() => {
    if (!externalNavigationRequest) {
      return;
    }
    if (
      externalNavigationRequest.sequence ===
      lastWorkspaceNavigationSequenceRef.current
    ) {
      return;
    }
    lastWorkspaceNavigationSequenceRef.current =
      externalNavigationRequest.sequence;
    if (
      !externalNavigationRequest.path.trim() ||
      externalNavigationRequest.path === currentPath
    ) {
      return;
    }
    void navigate(
      externalNavigationRequest.path,
      externalNavigationRequest.pushHistory ?? true,
    );
  }, [currentPath, externalNavigationRequest, navigate]);

  useEffect(() => {
    if (!externalRefreshRequest) {
      return;
    }
    if (
      externalRefreshRequest.sequence ===
      lastWorkspaceRefreshSequenceRef.current
    ) {
      return;
    }
    lastWorkspaceRefreshSequenceRef.current = externalRefreshRequest.sequence;
    void refresh();
  }, [externalRefreshRequest, refresh]);

  useEffect(() => {
    if (
      !currentPath ||
      currentPathIsCloud ||
      !isTauri() ||
      !systemSettings.developerMode
    ) {
      return undefined;
    }

    void watchExplorerEntrySizeRoot(currentPath).catch((error) => {
      console.warn("OverlayTerm: failed to watch entry size root", error);
    });

    return () => {
      void unwatchExplorerEntrySizeRoot(currentPath).catch(() => {});
    };
  }, [currentPath, currentPathIsCloud, systemSettings.developerMode]);

  useEffect(() => {
    if (initialInteractiveRecordedRef.current || !currentPath || loading) {
      return;
    }

    initialInteractiveRecordedRef.current = true;
    recordExplorerMetric({
      metricId: "explorer_first_interactive",
      durationMs:
        getExplorerPerformanceNow() - explorerMountStartedAtRef.current,
      metadata: {
        currentPathDepth: currentPath.split(/[\\/]/).filter(Boolean).length,
        entryCount: entries.length,
        hasError: Boolean(error),
        isSearchActive: search.trim().length > 0,
      },
    });
  }, [
    currentPath,
    entries.length,
    error,
    loading,
    recordExplorerMetric,
    search,
  ]);

  useEffect(() => {
    if (addressEditing) {
      return;
    }
    setAddressDraft(search.trim() ? search : currentPath);
  }, [addressEditing, currentPath, search]);

  useEffect(() => {
    if (!addressEditing) return;
    const timer = window.setTimeout(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addressEditing]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      const requestId = ++searchRequestIdRef.current;
      if (currentPath) {
        void cancelExplorerSearchEntries({
          path: currentPath,
          requestId,
          requestScope: explorerSearchScope,
        }).catch(() => {});
      }
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    if (!supportsSearch(currentPath)) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    if (currentPath) {
      void cancelExplorerSearchEntries({
        path: currentPath,
        requestId,
        requestScope: explorerSearchScope,
      }).catch(() => {});
    }
    setSearchResults([]);
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void runSearch(trimmed, requestId);
    }, 220);

    return () => {
      window.clearTimeout(timer);
      if (searchRequestIdRef.current === requestId) {
        setSearchLoading(false);
      }
    };
  }, [currentPath, explorerSearchScope, search, runSearch, supportsSearch]);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      setHistoryIdx((i) => i - 1);
      navigate(history[historyIdx - 1], false);
    }
  }, [history, historyIdx, navigate]);
  const goForward = useCallback(() => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx((i) => i + 1);
      navigate(history[historyIdx + 1], false);
    }
  }, [history, historyIdx, navigate]);
  const goUp = () => {
    if (!currentPath) return;
    if (currentPathIsCloud) {
      if (locationParentPath) {
        void navigate(locationParentPath);
      }
      return;
    }
    const sep = currentPath.includes("/") ? "/" : "\\";
    const parts = currentPath.replace(/[/\\]+$/, "").split(/[/\\]/);
    if (parts.length > 1) {
      parts.pop();
      const p = parts.join(sep);
      navigate(p.endsWith(":") ? p + "\\" : p || sep);
    }
  };

  const beginAddressEdit = useCallback(() => {
    setAddressDraft(search.trim() ? search : currentPath);
    setAddressEditing(true);
  }, [currentPath, search]);

  useEffect(() => {
    if (focusAddressBarSignal === lastFocusAddressBarSignalRef.current) {
      return;
    }

    lastFocusAddressBarSignalRef.current = focusAddressBarSignal;
    beginAddressEdit();
  }, [beginAddressEdit, focusAddressBarSignal]);

  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearch("");
    setSearchResults([]);
    setSearchLoading(false);
  }, []);

  const submitAddressDraft = useCallback(
    async (rawValue: string) => {
      const trimmed = rawValue.trim();
      setAddressEditing(false);

      if (!trimmed) {
        setAddressDraft(search.trim() ? search : currentPath);
        return;
      }

      if (isLikelyExplorerPathInput(trimmed)) {
        const resolvedPath = resolveExplorerPathInput(
          trimmed,
          currentPath,
          runtimePlatform,
        );
        setAddressDraft(resolvedPath);
        await navigate(resolvedPath);
        return;
      }

      if (!supportsSearch(currentPath)) {
        setAddressDraft(currentPath);
        setError("Search is not available for cloud drives yet.");
        return;
      }

      setAddressDraft(trimmed);
      setSearch(trimmed);
    },
    [currentPath, navigate, runtimePlatform, search, supportsSearch],
  );

  const isSearchActive = search.trim().length > 0;
  const explorerThumbnailRenderContext = isSearchActive ? "search" : "browse";
  const toggleSort = useCallback(
    (nextSortBy: ExplorerSortKey) => {
      const nextSortOrder =
        explorerSettings.sortBy === nextSortBy
          ? explorerSettings.sortOrder === "asc"
            ? "desc"
            : "asc"
          : getDefaultExplorerSortOrder(nextSortBy);

      updateExplorerSettings({
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      });
    },
    [
      explorerSettings.sortBy,
      explorerSettings.sortOrder,
      updateExplorerSettings,
    ],
  );
  const pathTagIdsByPath = useMemo(
    () =>
      new Map(
        tagMetadata.assignments.map(
          (assignment) => [assignment.path, assignment.tagIds] as const,
        ),
      ),
    [tagMetadata.assignments],
  );
  const filteredEntries = useMemo(
    () =>
      (isSearchActive ? searchResults : entries).filter((entry) => {
        if (activeTagFilterIds.length === 0) {
          return true;
        }
        const tagIds = pathTagIdsByPath.get(entry.path) ?? [];
        return activeTagFilterIds.every((tagId) => tagIds.includes(tagId));
      }),
    [
      activeTagFilterIds,
      entries,
      isSearchActive,
      pathTagIdsByPath,
      searchResults,
    ],
  );
  const baseVisibleEntries = useMemo(
    () =>
      sortExplorerEntries(
        filteredEntries,
        explorerSettings.sortBy,
        explorerSettings.sortOrder,
      ),
    [filteredEntries, explorerSettings.sortBy, explorerSettings.sortOrder],
  );
  const baseVisibleEntryLookup = useMemo(
    () => new Map(baseVisibleEntries.map((entry) => [entry.path, entry])),
    [baseVisibleEntries],
  );
  const visibleEntries = useMemo(
    () =>
      jumpFilter.active && jumpFilter.query.trim().length > 0
        ? jumpFilter.resultPaths
            .map((path) => baseVisibleEntryLookup.get(path))
            .filter((entry): entry is FileEntry => Boolean(entry))
        : baseVisibleEntries,
    [
      baseVisibleEntries,
      baseVisibleEntryLookup,
      jumpFilter.active,
      jumpFilter.query,
      jumpFilter.resultPaths,
    ],
  );
  const visibleEntryLookup = useMemo(
    () => new Map(visibleEntries.map((entry) => [entry.path, entry] as const)),
    [visibleEntries],
  );
  const visibleEntryIndexLookup = useMemo(
    () =>
      new Map(
        visibleEntries.map((entry, index) => [entry.path, index] as const),
      ),
    [visibleEntries],
  );
  const sourceEntryCount = isSearchActive
    ? searchResults.length
    : entries.length;
  const filteredEntryCount = visibleEntries.length;
  const experimentalSemanticBands = useMemo(
    () =>
      isExperimentalViewEligible &&
      (experimentalViewMode === "adaptive-semantic-grid" ||
        (experimentalViewMode === "off" &&
          (explorerTheme.preferredExperimentalViewMode ===
            "adaptive-semantic-grid" ||
            explorerTheme.preferredExperimentalViewMode === "constellation")) ||
        experimentalViewMode === "constellation")
        ? buildAdaptiveSemanticBands(
            visibleEntries,
            selected,
            currentPath,
            explorerSettings.sortBy,
            explorerSettings.sortOrder,
          )
        : [],
    [
      currentPath,
      explorerSettings.sortBy,
      explorerSettings.sortOrder,
      experimentalViewMode,
      explorerTheme.preferredExperimentalViewMode,
      isExperimentalViewEligible,
      selected,
      visibleEntries,
    ],
  );
  const bookmarkPathSet = useMemo(
    () =>
      new Set(
        explorerRail.nodes
          .filter(
            (
              node,
            ): node is (typeof explorerRail.nodes)[number] & {
              kind: "bookmark";
              path: string;
            } => node.kind === "bookmark",
          )
          .map((node) => node.path),
      ),
    [explorerRail.nodes],
  );
  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => selected.has(entry.path)),
    [visibleEntries, selected],
  );
  useEffect(() => {
    if (!onWorkspaceRuntimeSnapshotChange) {
      return;
    }
    onWorkspaceRuntimeSnapshotChange({
      instanceId,
      currentPath,
      currentPathIsCloud,
      selectedEntries: selectedEntries.map((entry) => ({
        path: entry.path,
        name: entry.name,
        is_dir: entry.is_dir,
      })),
    });
  }, [
    currentPath,
    currentPathIsCloud,
    instanceId,
    onWorkspaceRuntimeSnapshotChange,
    selectedEntries,
  ]);
  const selectedSizeSummary = useMemo(() => {
    const selectedSizeEntries = selectedEntries
      .map((entry) => entrySizes[entry.path])
      .filter((value): value is EntryStorageInfo => Boolean(value));
    if (selectedSizeEntries.length === 0) {
      return null;
    }
    const totalBytes = selectedSizeEntries.reduce(
      (sum, value) => sum + value.bytes,
      0,
    );
    return { totalBytes, count: selectedSizeEntries.length };
  }, [entrySizes, selectedEntries]);
  const propertiesPanelRecursiveSummary = useMemo(() => {
    const cacheEntries = propertiesPanel.targetPaths
      .map((path) => recursiveSizeCache[path])
      .filter((value): value is ExplorerRecursiveSizeCacheEntry =>
        Boolean(value),
      );
    if (cacheEntries.length === 0) {
      return null;
    }

    const totalBytes = cacheEntries.reduce(
      (sum, value) => sum + value.bytes,
      0,
    );
    const fileCount = cacheEntries.reduce(
      (sum, value) => sum + value.fileCount,
      0,
    );
    const folderCount = cacheEntries.reduce(
      (sum, value) => sum + value.folderCount,
      0,
    );
    const pending = cacheEntries.some((value) => value.pending);
    return { totalBytes, fileCount, folderCount, pending };
  }, [propertiesPanel.targetPaths, recursiveSizeCache]);
  const droppedSourceLookup = useMemo(() => {
    const lookup = new Map<
      string,
      { path: string; name: string; isDirectory: boolean }
    >();
    for (const entry of [...entries, ...searchResults]) {
      if (!lookup.has(entry.path)) {
        lookup.set(entry.path, {
          path: entry.path,
          name: entry.name,
          isDirectory: entry.is_dir,
        });
      }
    }
    return lookup;
  }, [entries, searchResults]);
  const duplicateEntryLookup = useMemo(() => {
    const lookup = new Map<string, FileEntry>();
    for (const entry of [...entries, ...searchResults]) {
      lookup.set(entry.path, entry);
    }
    for (const group of duplicateFinder.status?.groups ?? []) {
      for (const entry of group.entries) {
        if (!lookup.has(entry.path)) {
          lookup.set(entry.path, entry);
        }
      }
    }
    return lookup;
  }, [duplicateFinder.status?.groups, entries, searchResults]);
  const propertiesPanelEntries = useMemo(
    () =>
      propertiesPanel.targetPaths
        .map((path) => duplicateEntryLookup.get(path))
        .filter((entry): entry is FileEntry => Boolean(entry)),
    [duplicateEntryLookup, propertiesPanel.targetPaths],
  );
  const propertiesPanelPrimaryEntry = propertiesPanelEntries[0] ?? null;
  const propertiesPanelRequestScopeKey = useMemo(
    () =>
      propertiesPanel.visible
        ? `${propertiesPanel.tab}::${propertiesPanel.targetPaths.join("\u0000")}`
        : "hidden",
    [propertiesPanel.tab, propertiesPanel.targetPaths, propertiesPanel.visible],
  );
  useEffect(() => {
    recursiveSizeRequestIdRef.current += 1;
    propertiesChecksumRequestIdRef.current += 1;
    propertiesInfoRequestIdRef.current += 1;
  }, [propertiesPanelRequestScopeKey]);
  const runRecursiveSizeCalculation = useCallback(
    async (targetPaths?: string[]) => {
      const paths = (
        targetPaths ??
        (selectedEntries.length > 0
          ? selectedEntries.map((entry) => entry.path)
          : visibleEntries
              .filter((entry) => entry.is_dir)
              .map((entry) => entry.path))
      )
        .map((path) => path.trim())
        .filter(Boolean);
      if (paths.length === 0) {
        return;
      }

      if (!isExplorerMountedRef.current) {
        return;
      }

      const requestId = recursiveSizeRequestIdRef.current + 1;
      recursiveSizeRequestIdRef.current = requestId;
      const isActiveRecursiveSizeRequest = () =>
        isExplorerMountedRef.current &&
        recursiveSizeRequestIdRef.current === requestId;
      const activeTab = propertiesPanel.tab;
      setPropertiesPanel({
        loading: true,
        targetPaths: paths,
        tab: activeTab,
        visible: true,
      });
      for (const path of paths) {
        const existing = recursiveSizeCache[path];
        setRecursiveSizeCacheEntry(path, {
          bytes: existing?.bytes ?? 0,
          fileCount: existing?.fileCount ?? 0,
          folderCount: existing?.folderCount ?? 0,
          pending: true,
          updatedAt: Date.now(),
        });
      }

      try {
        const results = await calculateExplorerRecursiveSizes(paths, true);
        if (!isActiveRecursiveSizeRequest()) {
          return;
        }
        startTransition(() => {
          setEntrySizes((current) => {
            const next = { ...current };
            for (const result of results) {
              next[result.path] = result;
              setRecursiveSizeCacheEntry(result.path, {
                bytes: result.bytes,
                fileCount: result.is_dir ? 0 : 1,
                folderCount: result.is_dir ? 1 : 0,
                pending: false,
                updatedAt: Date.now(),
              });
            }
            return next;
          });
        });
      } catch (error) {
        if (isActiveRecursiveSizeRequest()) {
          setError(String(error));
        }
      } finally {
        if (isActiveRecursiveSizeRequest()) {
          setPropertiesPanel({
            loading: false,
            targetPaths: paths,
            tab: activeTab,
            visible: true,
          });
        }
      }
    },
    [
      calculateExplorerRecursiveSizes,
      propertiesPanel.tab,
      recursiveSizeCache,
      selectedEntries,
      setEntrySizes,
      setPropertiesPanel,
      setRecursiveSizeCacheEntry,
      setError,
      visibleEntries,
    ],
  );
  const runPropertiesChecksumCalculation = useCallback(
    async (targetPaths?: string[]) => {
      const paths = (targetPaths ?? propertiesPanel.targetPaths)
        .map((path) => path.trim())
        .filter(Boolean);
      if (paths.length === 0) {
        return;
      }

      if (!isExplorerMountedRef.current) {
        return;
      }

      const requestId = propertiesChecksumRequestIdRef.current + 1;
      propertiesChecksumRequestIdRef.current = requestId;
      const isActivePropertiesChecksumRequest = () =>
        isExplorerMountedRef.current &&
        propertiesChecksumRequestIdRef.current === requestId;
      const activeTab = propertiesPanel.tab;
      setPropertiesChecksumError(null);
      setPropertiesChecksumLoadingPaths(new Set(paths));
      setPropertiesPanel({
        loading: true,
        targetPaths: paths,
        tab: activeTab,
        visible: true,
      });

      try {
        for (const path of paths) {
          const entry = duplicateEntryLookup.get(path);
          if (entry?.is_dir) {
            continue;
          }

          const [checksumResult] = await calculateExplorerChecksums([path]);
          if (!isActivePropertiesChecksumRequest()) {
            return;
          }
          if (checksumResult) {
            setPropertiesChecksums((current) => ({
              ...current,
              [path]: checksumResult,
            }));
          }
        }
      } catch (error) {
        if (isActivePropertiesChecksumRequest()) {
          setPropertiesChecksumError(String(error));
        }
      } finally {
        if (isActivePropertiesChecksumRequest()) {
          setPropertiesChecksumLoadingPaths(new Set());
          setPropertiesPanel({
            loading: false,
            targetPaths: paths,
            tab: activeTab,
            visible: true,
          });
        }
      }
    },
    [
      calculateExplorerChecksums,
      duplicateEntryLookup,
      propertiesPanel.tab,
      propertiesPanel.targetPaths,
      setPropertiesPanel,
    ],
  );
  useEffect(() => {
    if (
      !propertiesPanel.visible ||
      propertiesPanel.tab !== "checksums" ||
      propertiesPanel.targetPaths.length !== 1
    ) {
      return;
    }

    const targetPath = propertiesPanel.targetPaths[0];
    if (
      !targetPath ||
      propertiesChecksumLoadingPaths.has(targetPath) ||
      propertiesChecksums[targetPath]
    ) {
      return;
    }

    const targetEntry = duplicateEntryLookup.get(targetPath);
    if (!targetEntry || targetEntry.is_dir) {
      return;
    }

    const measuredSize = entrySizes[targetPath]?.bytes ?? targetEntry.size;
    if (typeof measuredSize === "number" && measuredSize > 100 * 1024 * 1024) {
      return;
    }

    let cancelled = false;
    const checksumLaunchTimer = window.setTimeout(() => {
      if (!cancelled) {
        void runPropertiesChecksumCalculation([targetPath]);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(checksumLaunchTimer);
    };
  }, [
    duplicateEntryLookup,
    entrySizes,
    propertiesChecksumLoadingPaths,
    propertiesChecksums,
    propertiesPanel.targetPaths,
    propertiesPanel.tab,
    propertiesPanel.visible,
    runPropertiesChecksumCalculation,
  ]);
  useEffect(() => {
    if (!propertiesPanel.visible || propertiesPanel.targetPaths.length === 0) {
      return;
    }

    const targetPaths = propertiesPanel.targetPaths.filter(
      (path) => !isCloudExplorerPath(path),
    );
    if (targetPaths.length === 0) {
      return;
    }

    const requestId = propertiesInfoRequestIdRef.current + 1;
    propertiesInfoRequestIdRef.current = requestId;
    const isActivePropertiesInfoRequest = () =>
      isExplorerMountedRef.current &&
      propertiesInfoRequestIdRef.current === requestId;

    void Promise.all(
      targetPaths.map(async (path) => {
        if (propertiesInfoByPath[path]) {
          return null;
        }
        try {
          return await getExplorerItemProperties(path);
        } catch (error) {
          if (isActivePropertiesInfoRequest()) {
            setError(String(error));
          }
          return null;
        }
      }),
    ).then((results) => {
      if (!isActivePropertiesInfoRequest()) {
        return;
      }
      const nextEntries = results.filter(
        (entry): entry is ExplorerItemProperties => Boolean(entry),
      );
      if (nextEntries.length === 0) {
        return;
      }
      setPropertiesInfoByPath((current) => {
        const next = { ...current };
        for (const entry of nextEntries) {
          next[entry.path] = entry;
        }
        return next;
      });
    });
  }, [
    getExplorerItemProperties,
    isCloudExplorerPath,
    propertiesInfoByPath,
    propertiesPanel.targetPaths,
    propertiesPanel.visible,
    setError,
  ]);
  const goHome = useCallback(() => {
    getExplorerHomeDir()
      .then((p) => navigate(p))
      .catch(() => {});
  }, [navigate]);
  const toggleSearchScope = useCallback(() => {
    setSearchIncludeContent((value) => !value);
  }, []);
  const cycleSortKey = useCallback(() => {
    const order: ExplorerSortKey[] = ["name", "size", "date", "type"];
    const nextIndex =
      (order.indexOf(explorerSettings.sortBy) + 1) % order.length;
    updateExplorerSettings({
      sortBy: order[nextIndex],
      sortOrder: getDefaultExplorerSortOrder(order[nextIndex]),
    });
  }, [explorerSettings.sortBy, updateExplorerSettings]);
  const toggleSortOrder = useCallback(() => {
    updateExplorerSettings({
      sortOrder: explorerSettings.sortOrder === "asc" ? "desc" : "asc",
    });
  }, [explorerSettings.sortOrder, updateExplorerSettings]);
  const focusExplorerList = useCallback(() => {
    mainRef.current?.focus();
  }, []);
  const focusExplorerAddressBar = useCallback(() => {
    beginAddressEdit();
  }, [beginAddressEdit]);
  const focusExplorerPreview = useCallback(() => {
    previewRef.current = preview;
  }, [preview]);
  const scrollExplorerEntryIntoView = useCallback((targetPath: string) => {
    const targetElement = Array.from(
      mainRef.current?.querySelectorAll<HTMLElement>("[data-entry-path]") ?? [],
    ).find((element) => element.dataset.entryPath === targetPath);
    if (typeof targetElement?.scrollIntoView === "function") {
      targetElement.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, []);
  const selectAllVisibleEntries = useCallback(() => {
    setSelected(new Set(visibleEntries.map((entry) => entry.path)));
    const firstVisiblePath = visibleEntries[0]?.path ?? null;
    lastSelected.current = firstVisiblePath;
    selectionRangeAnchorPathRef.current = firstVisiblePath;
  }, [visibleEntries]);
  const clearExplorerSelection = useCallback(() => {
    setSelected(new Set());
    lastSelected.current = null;
    selectionRangeAnchorPathRef.current = null;
  }, []);
  const handleBookmarkCreated = useCallback(
    (name: string, path: string) => {
      void Promise.resolve(onAddBookmark(name, path)).catch(() => {});
    },
    [onAddBookmark],
  );
  const resolveDroppedBookmarkSources = useCallback(
    (paths: string[]) =>
      paths
        .filter(
          (path): path is string =>
            typeof path === "string" && path.trim().length > 0,
        )
        .map((path) => {
          const known = droppedSourceLookup.get(path);
          const fallbackName =
            path.split(/[\\/]/).filter(Boolean).pop() ?? path;
          const inferredDirectory =
            known?.isDirectory ?? !/\.[^\\/]+$/.test(fallbackName);
          return {
            path,
            name: known?.name ?? fallbackName,
            isDirectory: inferredDirectory,
          };
        }),
    [droppedSourceLookup],
  );
  const activeDragPathsRef = useRef<string[]>([]);
  const nativeDragPathsRef = useRef<string[]>([]);
  const nativeSameWindowDragPathsRef = useRef<string[]>([]);
  const isProcessElevatedRef = useRef(false);
  const lastObservedFileTransferNonceRef = useRef<string | null>(null);
  const selectedDirectoryEntries = useMemo(
    () => selectedEntries.filter((entry) => entry.is_dir),
    [selectedEntries],
  );
  const repositoryPickerConfirmationPaths = useMemo(
    () =>
      resolveRepositoryPickerConfirmationPaths({
        allowMultiple: repositoryPicker?.allowMultiple ?? true,
        currentPath,
        hasAnySelection: selectedEntries.length > 0,
        selectedDirectoryPaths: selectedDirectoryEntries.map(
          (entry) => entry.path,
        ),
      }),
    [
      currentPath,
      repositoryPicker?.allowMultiple,
      selectedDirectoryEntries,
      selectedEntries.length,
    ],
  );
  const canConfirmRepositorySelection =
    repositoryPickerConfirmationPaths.length > 0;
  const isRepositoryPickerUsingCurrentPath =
    selectedEntries.length === 0 &&
    repositoryPickerConfirmationPaths.length === 1 &&
    repositoryPickerConfirmationPaths[0] === currentPath.trim();
  const repositoryPickerConfirmLabel = useMemo(
    () =>
      getRepositoryPickerConfirmLabel({
        allowMultiple: repositoryPicker?.allowMultiple ?? true,
        currentPath,
        hasAnySelection: selectedEntries.length > 0,
        selectedDirectoryCount: selectedDirectoryEntries.length,
      }),
    [
      currentPath,
      repositoryPicker?.allowMultiple,
      selectedDirectoryEntries.length,
      selectedEntries.length,
    ],
  );

  useEffect(() => {
    if (!repositoryPicker?.active) {
      return;
    }
    setSelected(new Set());
    setCtxMenu({ visible: false, x: 0, y: 0, entry: null });
    setDeleteTargets([]);
  }, [repositoryPicker?.active, repositoryPicker?.requestId]);

  const getEntryStorageLabel = useCallback(
    (entry: FileEntry) => {
      const measuredInfo = entrySizes[entry.path];
      if (measuredInfo) {
        const formatted = formatSize(measuredInfo.bytes);
        return measuredInfo.is_complete || !entry.is_dir
          ? formatted
          : `${formatted}+`;
      }
      if (!entry.is_dir) {
        return formatSize(entry.size);
      }
      return "—";
    },
    [entrySizes],
  );

  const resolveEntriesForAction = useCallback(
    (entry?: FileEntry) => {
      if (!entry) return selectedEntries;
      if (selected.has(entry.path) && selectedEntries.length > 0) {
        return selectedEntries;
      }
      return [entry];
    },
    [selected, selectedEntries],
  );

  const requestTransferDestination = useCallback(
    (operation: FileTransferOperation, entry?: FileEntry) => {
      const sourcePaths = resolveEntriesForAction(entry).map(
        (item) => item.path,
      );
      if (sourcePaths.length === 0) {
        return;
      }

      void openFileOperationsWindow({
        view: "transfer",
        operation,
        sourcePaths,
        suggestedTargetDir: currentPath,
      });
    },
    [currentPath, resolveEntriesForAction],
  );

  const handleArchiveAction = useCallback(
    async (entry: FileEntry, mode: ExplorerArchiveExtractionMode) => {
      try {
        if (mode === "openCached") {
          const result = await openExplorerArchive(entry.path);
          navigate(result.outputPath);
          return;
        }

        await extractExplorerArchive({
          archivePath: entry.path,
          mode,
        });
        invalidateExplorerResultCaches();
        await refresh();
      } catch (archiveError) {
        setError(String(archiveError));
      }
    },
    [extractExplorerArchive, navigate, openExplorerArchive, refresh],
  );

  const resolveAudioBatchTargets = useCallback(
    (entry?: FileEntry) => {
      const entriesForAction = resolveEntriesForAction(entry);
      if (entriesForAction.length === 0) {
        return null;
      }
      const includesUnsupportedFile = entriesForAction.some(
        (candidate) =>
          !candidate.is_dir &&
          !isAudioPreviewExtension(getEntryExtension(candidate)),
      );
      const hasAudioCandidate = entriesForAction.some(
        (candidate) =>
          candidate.is_dir ||
          isAudioPreviewExtension(getEntryExtension(candidate)),
      );
      if (includesUnsupportedFile || !hasAudioCandidate) {
        return null;
      }
      return entriesForAction.map((candidate) => candidate.path);
    },
    [resolveEntriesForAction],
  );

  const handleAudioBatchAction = useCallback(
    async (mode: "convert" | "normalize", entry?: FileEntry) => {
      const inputPaths = resolveAudioBatchTargets(entry);
      if (!inputPaths) {
        return;
      }
      try {
        await runExplorerAudioBatchProcess({
          inputPaths,
          recurseDirectories: true,
          mode: mode === "convert" ? "convert" : "normalize",
          outputFormat: mode === "convert" ? "wav" : null,
          overwriteExisting: false,
          outputDirectory: null,
        });
        invalidateExplorerResultCaches();
        await refresh();
      } catch (audioBatchError) {
        setError(String(audioBatchError));
      }
    },
    [refresh, resolveAudioBatchTargets],
  );

  const shouldUseManagedIconSrc = useCallback(
    (entry: FileEntry) =>
      shouldPreferManagedExplorerIcon(
        entry,
        {
          rules: explorerSettings.folderIconRules,
          defaultIcon: explorerSettings.defaultFolderIcon,
        },
        themeIconTheme,
      ),
    [
      explorerSettings.defaultFolderIcon,
      explorerSettings.folderIconRules,
      themeIconTheme,
    ],
  );

  const getRenderableIconSrc = useCallback(
    (entry: FileEntry, open = false) => {
      const managedIconSrc = getIconSrc(
        entry,
        open,
        {
          rules: explorerSettings.folderIconRules,
          defaultIcon: explorerSettings.defaultFolderIcon,
        },
        themeIconTheme,
      );

      if (!useNativeOsIcons || shouldUseManagedIconSrc(entry)) {
        return managedIconSrc;
      }

      if (useNativeOsIcons) {
        const nativeIconSrc =
          nativeIconMap[
            getNativeIconCacheKey(entry.path, DEFAULT_NATIVE_ICON_SIZE)
          ];
        if (nativeIconSrc) {
          return nativeIconSrc;
        }
      }

      return managedIconSrc;
    },
    [
      explorerSettings.defaultFolderIcon,
      explorerSettings.folderIconRules,
      nativeIconMap,
      shouldUseManagedIconSrc,
      themeIconTheme,
      useNativeOsIcons,
    ],
  );

  const getExplorerEntryIconSrc = useCallback(
    (entry: FileEntry, isSelected: boolean, isDropTarget: boolean): string =>
      getRenderableIconSrc(
        entry,
        shouldShowExplorerFolderOpenIcon({
          isDirectory: entry.is_dir,
          isSelected,
          isDropTarget,
          folderClickMode,
        }),
      ),
    [folderClickMode, getRenderableIconSrc],
  );

  const canRenderEntryThumbnail = useCallback(
    (entry: FileEntry): boolean => {
      if (
        entry.is_dir ||
        currentPathIsCloud ||
        isCloudExplorerPath(entry.path)
      ) {
        return false;
      }
      return canRenderExplorerThumbnail(
        getEntryExtension(entry),
        entry.size,
        explorerThumbnailSettings,
        explorerThumbnailRenderContext,
      );
    },
    [
      currentPathIsCloud,
      explorerThumbnailRenderContext,
      explorerThumbnailSettings,
      isCloudExplorerPath,
    ],
  );

  const getRenderableEntryThumbnail = useCallback(
    (
      entry: FileEntry,
      minimumStageSize: number,
    ): ExplorerEntryThumbnailData | null => {
      if (
        minimumStageSize < EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.minStagePx ||
        !canRenderEntryThumbnail(entry)
      ) {
        return null;
      }
      return entryThumbnailMap[entry.path] ?? null;
    },
    [canRenderEntryThumbnail, entryThumbnailMap],
  );

  const queueClipboard = useCallback(
    (action: "copy" | "cut", entry?: FileEntry) => {
      const entriesForAction = resolveEntriesForAction(entry);
      if (entriesForAction.length === 0) return;
      setClipboard({
        action,
        entries: entriesForAction.map((item) => ({
          path: item.path,
          name: item.name,
          is_dir: item.is_dir,
        })),
      });
    },
    [resolveEntriesForAction, setClipboard],
  );

  const openAsAdmin = useCallback(async (path: string) => {
    await openExplorerPathAsAdmin(path).catch((e) => setError(String(e)));
  }, []);

  const openWithSystemPicker = useCallback(
    async (path: string) => {
      await openExplorerPathWithDialog(path).catch((error) =>
        setError(String(error)),
      );
    },
    [openExplorerPathWithDialog],
  );

  const openNativeProperties = useCallback(
    async (path: string) => {
      await showExplorerPathProperties(path).catch((error) =>
        setError(String(error)),
      );
    },
    [showExplorerPathProperties],
  );

  const openExplorerPropertiesPanel = useCallback(
    (paths: string[], tab: ExplorerPropertiesPanelTab = "info") => {
      const nextPaths = paths.map((path) => path.trim()).filter(Boolean);
      if (nextPaths.length === 0) {
        return;
      }

      setPropertiesChecksums({});
      setPropertiesChecksumLoadingPaths(new Set());
      setPropertiesChecksumError(null);
      setPropertiesPanel({
        loading: false,
        targetPaths: nextPaths,
        tab,
        visible: true,
      });
    },
    [setPropertiesPanel],
  );

  const openExplorerPropertiesForSelection = useCallback(() => {
    const nextPaths =
      selectedEntries.length > 0
        ? selectedEntries.map((entry) => entry.path)
        : currentPath
          ? [currentPath]
          : [];
    openExplorerPropertiesPanel(nextPaths);
  }, [currentPath, openExplorerPropertiesPanel, selectedEntries]);

  const transferIntoDirectory = useCallback(
    async (
      targetDir: string,
      sources: string[],
      operation: FileTransferOperation,
      collisionPolicy: ExplorerFileTransferCollisionPolicy = "keep_both",
    ): Promise<FileTransferResult[]> => {
      if (sources.length === 0) return [];
      void openFileOperationsWindow({ view: "tasks" });
      const results = await transferExplorerItems(
        targetDir,
        sources,
        operation,
        collisionPolicy,
      );
      if (results.some((result) => result.disposition === "transferred")) {
        invalidateExplorerResultCaches();
        await publishFileOperationsTransferCompleted({
          operation,
          results,
          sourcePaths: sources,
          targetDir,
        });
      }
      return results;
    },
    [publishFileOperationsTransferCompleted, transferExplorerItems],
  );

  const finalizeTransferResults = useCallback(
    (results: FileTransferResult[]) => {
      const skippedCount = results.filter(
        (result) => result.disposition === "skipped_existing",
      ).length;
      if (skippedCount > 0) {
        setError(
          `${skippedCount} item${skippedCount === 1 ? "" : "s"} skipped because matching names already exist at the destination.`,
        );
      }
    },
    [],
  );

  const executeTransferRequest = useCallback(
    async (
      request: PendingExplorerTransferRequest,
      options?: {
        onSuccess?: (results: FileTransferResult[]) => Promise<void> | void;
        onCancel?: () => void;
      },
    ): Promise<FileTransferResult[] | null> => {
      if (request.sources.length === 0) {
        return [];
      }

      const isLocalTransfer =
        !isCloudExplorerPath(request.targetDir) &&
        request.sources.every((source) => !isCloudExplorerPath(source));
      if (!request.collisionPolicy && isLocalTransfer) {
        const collisions = await planExplorerItemTransfer(
          request.targetDir,
          request.sources,
          request.operation,
        );
        if (collisions.length > 0) {
          pendingTransferRequestRef.current = {
            request,
            onSuccess: options?.onSuccess,
            onCancel: options?.onCancel,
          };
          setTransferConflictPolicy("keep_both");
          setTransferConflictDialog({
            visible: true,
            collisions,
            targetDir: request.targetDir,
            sources: request.sources,
            operation: request.operation,
          });
          return null;
        }
      }

      const results = await transferIntoDirectory(
        request.targetDir,
        request.sources,
        request.operation,
        request.collisionPolicy ?? "keep_both",
      );
      finalizeTransferResults(results);
      await options?.onSuccess?.(results);
      return results;
    },
    [finalizeTransferResults, planExplorerItemTransfer, transferIntoDirectory],
  );

  const resetTransferConflictDialog = useCallback(() => {
    pendingTransferRequestRef.current = null;
    setTransferConflictDialog({
      visible: false,
      collisions: [],
      targetDir: "",
      sources: [],
      operation: "copy",
    });
  }, []);

  const closeTransferConflictDialog = useCallback(() => {
    pendingTransferRequestRef.current?.onCancel?.();
    resetTransferConflictDialog();
  }, [resetTransferConflictDialog]);

  const confirmTransferConflictDialog = useCallback(() => {
    const pending = pendingTransferRequestRef.current;
    if (!pending) {
      resetTransferConflictDialog();
      return;
    }

    resetTransferConflictDialog();
    void executeTransferRequest(
      {
        ...pending.request,
        collisionPolicy: transferConflictPolicy,
      },
      {
        onSuccess: pending.onSuccess,
      },
    ).catch((transferError) => {
      setError(String(transferError));
    });
  }, [
    executeTransferRequest,
    resetTransferConflictDialog,
    transferConflictPolicy,
  ]);

  useEffect(() => {
    return listenToFileOperationsTransferCompleted((detail) => {
      if (lastObservedFileTransferNonceRef.current === detail.nonce) {
        return;
      }
      lastObservedFileTransferNonceRef.current = detail.nonce;
      if (shouldRefreshExplorerForTransferEvent(currentPath, detail)) {
        void refresh();
      }
    });
  }, [currentPath, refresh]);

  useEffect(() => {
    if (!isTauri()) {
      isProcessElevatedRef.current = false;
      return;
    }

    let cancelled = false;
    void commands
      .fsIsProcessElevated()
      .then((result) => {
        if (cancelled) return;
        isProcessElevatedRef.current = Boolean(unwrapTauriResult(result));
      })
      .catch(() => {
        if (cancelled) return;
        isProcessElevatedRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | null = null;
    let cachedScaleFactor: number | null = null;

    const getFallbackScaleFactor = () =>
      typeof window !== "undefined" &&
      Number.isFinite(window.devicePixelRatio) &&
      window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;

    const getWindowScaleFactor = async () => {
      if (
        cachedScaleFactor !== null &&
        Number.isFinite(cachedScaleFactor) &&
        cachedScaleFactor > 0
      ) {
        return cachedScaleFactor;
      }

      try {
        cachedScaleFactor = await win.scaleFactor();
      } catch {
        cachedScaleFactor = getFallbackScaleFactor();
      }

      return cachedScaleFactor;
    };

    const resolveNativeDropTargetPath = async (
      position: unknown,
    ): Promise<string | null> => {
      if (!position || typeof position !== "object") {
        return null;
      }

      const scaleFactor = await getWindowScaleFactor();
      return resolveExplorerDropTargetPathFromPoint(
        position as NativeDragDropPositionLike,
        scaleFactor,
      );
    };

    win
      .onDragDropEvent(async (event) => {
        if (disposed) return;

        // Detect internal drags (initiated from the explorer via fsStartNativeFileDrag).
        // When an internal native drag re-enters/drops on the same window, Tauri fires
        // onDragDropEvent instead of React onDrop.  We need to route the drop to the
        // specific folder the cursor is hovering over, not just currentPath.
        const internalDragPaths =
          activeDragPathsRef.current.length > 0
            ? activeDragPathsRef.current
            : nativeDragPathsRef.current.length > 0
              ? nativeDragPathsRef.current
              : nativeSameWindowDragPathsRef.current;
        const payloadPaths = (event.payload as any).paths || [];
        const normalizePath = (p: string) => {
          const collapsed = p.replace(/[\\/]+/g, "/").replace(/\/$/, "");
          return runtimePlatform === "windows"
            ? collapsed.toLowerCase()
            : collapsed;
        };
        const normalizedInternal = internalDragPaths.map(normalizePath);
        const normalizedPayload = payloadPaths.map(normalizePath);
        const payloadMatchesInternal =
          normalizedInternal.length > 0 &&
          normalizedPayload.length === normalizedInternal.length &&
          normalizedPayload.every((p: string) => normalizedInternal.includes(p));
        const hasPendingNativeSameWindowDrag =
          nativeSameWindowDragPathsRef.current.length > 0;

        if (
          hasPendingNativeSameWindowDrag &&
          normalizedPayload.length > 0 &&
          !payloadMatchesInternal
        ) {
          nativeSameWindowDragPathsRef.current = [];
        }

        const isInternalDrag =
          nativeSameWindowDragPathsRef.current.length > 0 ||
          nativeDragPathsRef.current.length > 0 ||
          (normalizedInternal.length > 0 &&
            (normalizedPayload.length === 0 || payloadMatchesInternal));

        if (event.payload.type === "enter" || event.payload.type === "over") {
          const hoveredTarget =
            (await resolveNativeDropTargetPath((event.payload as any).position)) ??
            null;
          setExplorerDragOverTarget(hoveredTarget);
        }

        if (event.payload.type === "enter") {
          // Suppress the "Import Files" banner for internal drags — it's only
          // relevant for files dragged in from other OS applications.
          if (!isInternalDrag) {
            setWindowDropState({
              active: true,
              count: payloadPaths.length,
            });
          }
          return;
        }

        if (event.payload.type === "leave") {
          setWindowDropState({ active: false, count: 0 });
          setExplorerDragOverTarget(null);
          return;
        }

        if (event.payload.type === "over") {
          return;
        }

        if (event.payload.type === "drop") {
          setWindowDropState({ active: false, count: 0 });
          const hoveredTarget =
            (await resolveNativeDropTargetPath((event.payload as any).position)) ??
            dragOverRef.current;
          setExplorerDragOverTarget(null);
          if (!currentPath) return;

          // For internal drags, resolve the target from the folder currently being
          // hovered. "__main__" or null means the drop landed on empty space in the
          // current directory.
          let targetDir = currentPath;
          const operation: "move" | "copy" = isInternalDrag ? "move" : "copy";

          if (
            hoveredTarget &&
            hoveredTarget !== EXPLORER_MAIN_DROP_TARGET
          ) {
            targetDir = hoveredTarget;
          }

          if (isInternalDrag) {
            activeDragPathsRef.current = [];
            nativeDragPathsRef.current = [];
            nativeSameWindowDragPathsRef.current = [];
          }

          try {
            await executeTransferRequest(
              {
                targetDir,
                sources: payloadPaths,
                operation,
              },
              {
                onSuccess: () => refresh(),
              },
            );
          } catch (error) {
            setError(String(error));
          }
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((error) => {
        console.warn(
          "OverlayTerm: failed to register drag-drop listener",
          error,
        );
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [currentPath, executeTransferRequest, refresh, setExplorerDragOverTarget]);

  // ── Open ──
  const getSearchFocusTarget = useCallback(
    (entry: FileEntry): EditorSearchFocusTarget | null => {
      if (!isSearchActive) {
        return null;
      }

      const searchEntry = entry as FileSearchResult;
      const nextRequestId = searchFocusRequestIdRef.current + 1;
      const target = createEditorSearchFocus(nextRequestId, search.trim(), {
        line_number: searchEntry.line_number ?? null,
        match_kind: searchEntry.match_kind,
      });

      if (target) {
        searchFocusRequestIdRef.current = nextRequestId;
      }

      return target;
    },
    [isSearchActive, search],
  );

  const persistPreviewText = useCallback(async (path: string) => {
    const currentPreview = previewRef.current;
    if (currentPreview.type !== "text" || currentPreview.path !== path) {
      return false;
    }

    const contentAtSave = currentPreview.content;
    setPreview((prev) =>
      prev.type === "text" && prev.path === path
        ? { ...prev, isSaving: true, error: null }
        : prev,
    );

    try {
      await writeExplorerFile(path, contentAtSave);
      invalidateExplorerResultCaches();
      clearExplorerEditDraft(
        EXPLORER_TEXT_DRAFT_SCOPE,
        path,
      );
      setPreview((prev) => {
        if (prev.type !== "text" || prev.path !== path) return prev;
        const isStillSame = prev.content === contentAtSave;
        return {
          ...prev,
          isSaving: false,
          isDirty: !isStillSame,
          lastSavedAt: isStillSame ? Date.now() : prev.lastSavedAt,
          error: null,
        };
      });
      return true;
    } catch (saveError) {
      persistExplorerEditDraft(
        EXPLORER_TEXT_DRAFT_SCOPE,
        path,
        contentAtSave,
        explorerStringDraftSerializer,
      );
      setPreview((prev) =>
        prev.type === "text" && prev.path === path
          ? {
              ...prev,
              isSaving: false,
              error: buildExplorerDraftPreservedMessage(saveError),
            }
          : prev,
      );
      setError(`Save failed for ${currentPreview.name}: ${saveError}`);
      return false;
    }
  }, []);

  const queuePreviewSave = useCallback(
    (path: string) => {
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
      }
      previewSaveTimer.current = window.setTimeout(() => {
        previewSaveTimer.current = null;
        void persistPreviewText(path);
      }, 700);
    },
    [persistPreviewText],
  );

  const flushPreviewTextSave = useCallback(async () => {
    const currentPreview = previewRef.current;
    if (currentPreview.type !== "text" || !currentPreview.isDirty) {
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
        previewSaveTimer.current = null;
      }
      return;
    }

    if (previewSaveTimer.current) {
      window.clearTimeout(previewSaveTimer.current);
      previewSaveTimer.current = null;
    }

    await persistPreviewText(currentPreview.path);
  }, [persistPreviewText]);

  const updatePreviewTextContent = useCallback(
    (path: string, content: string) => {
      persistExplorerEditDraft(
        EXPLORER_TEXT_DRAFT_SCOPE,
        path,
        content,
        explorerStringDraftSerializer,
      );
      setPreview((prev) =>
        prev.type === "text" && prev.path === path
          ? {
              ...prev,
              content,
              scriptPreview: prev.scriptPreview
                ? { ...prev.scriptPreview, content }
                : null,
              isDirty: true,
              error: null,
            }
          : prev,
      );
      queuePreviewSave(path);
    },
    [queuePreviewSave],
  );

  const persistShaderPreviewSource = useCallback(async (path: string) => {
    const currentPreview = previewRef.current;
    if (
      currentPreview.type !== "shader" ||
      currentPreview.path !== path ||
      currentPreview.isReadOnly ||
      currentPreview.editableSource == null
    ) {
      return;
    }

    const sourceAtSave = currentPreview.editableSource;
    setPreview((prev) =>
      prev.type === "shader" && prev.path === path
        ? { ...prev, isSaving: true, error: null }
        : prev,
    );

    try {
      await writeExplorerFile(path, sourceAtSave);
      invalidateExplorerResultCaches();
      clearExplorerEditDraft(
        EXPLORER_SHADER_DRAFT_SCOPE,
        path,
      );
      setPreview((prev) => {
        if (
          prev.type !== "shader" ||
          prev.path !== path ||
          prev.editableSource == null
        ) {
          return prev;
        }
        const isStillSame = prev.editableSource === sourceAtSave;
        return {
          ...prev,
          isSaving: false,
          isDirty: !isStillSame,
          error: null,
        };
      });
    } catch (saveError) {
      persistExplorerEditDraft(
        EXPLORER_SHADER_DRAFT_SCOPE,
        path,
        sourceAtSave,
        explorerStringDraftSerializer,
      );
      setPreview((prev) =>
        prev.type === "shader" && prev.path === path
          ? {
              ...prev,
              isSaving: false,
              error: buildExplorerDraftPreservedMessage(saveError),
            }
          : prev,
      );
      setError(`Save failed for ${currentPreview.name}: ${saveError}`);
    }
  }, []);

  const updateShaderPreviewContent = useCallback(
    (path: string, content: string) => {
      persistExplorerEditDraft(
        EXPLORER_SHADER_DRAFT_SCOPE,
        path,
        content,
        explorerStringDraftSerializer,
      );
      setPreview((prev) =>
        prev.type === "shader" && prev.path === path
          ? {
              ...prev,
              editableSource: content,
              inspectionSource: content,
              isDirty: true,
              error: null,
            }
          : prev,
      );
    },
    [],
  );

  const updateShaderPreviewSelection = useCallback(
    (path: string, selection: Partial<ExplorerShaderSelectionMemory>) => {
      const currentSelection = shaderPreviewSelectionMemoryRef.current.get(
        path,
      ) ?? {
        selectedStage: null,
        selectedEntryPoint: null,
      };
      const nextSelection = {
        selectedStage:
          selection.selectedStage !== undefined
            ? selection.selectedStage
            : currentSelection.selectedStage,
        selectedEntryPoint:
          selection.selectedEntryPoint !== undefined
            ? selection.selectedEntryPoint
            : currentSelection.selectedEntryPoint,
      };
      shaderPreviewSelectionMemoryRef.current.set(path, nextSelection);
      setPreview((prev) =>
        prev.type === "shader" && prev.path === path
          ? {
              ...prev,
              selectedStage: nextSelection.selectedStage,
              selectedEntryPoint: nextSelection.selectedEntryPoint,
            }
          : prev,
      );
    },
    [],
  );

  const updateShaderPreviewCompileResult = useCallback(
    (path: string, result: ExplorerShaderPreviewCompileOutput) => {
      const selection = {
        selectedStage: result.selectedStage,
        selectedEntryPoint: result.selectedEntryPoint,
      };
      shaderPreviewSelectionMemoryRef.current.set(path, selection);
      setPreview((prev) =>
        prev.type === "shader" && prev.path === path
          ? {
              ...prev,
              inspectionSource: result.inspectionSource,
              entryPoints: result.entryPoints,
              selectedStage: result.selectedStage,
              selectedEntryPoint: result.selectedEntryPoint,
              diagnostics: result.diagnostics,
              normalizedWgsl: result.normalizedWgsl,
              supportsLivePreview: result.supportsLivePreview,
              previewAbi: result.previewAbi,
            }
          : prev,
      );
    },
    [],
  );

  const updateShaderPreviewScene = useCallback(
    (path: string, scene: "sphere" | "fullscreen") => {
      setPreview((prev) =>
        prev.type === "shader" && prev.path === path
          ? { ...prev, selectedScene: scene }
          : prev,
      );
    },
    [],
  );

  const registerPreviewCloseGuard = useCallback(
    (guard: PreviewCloseGuard | null) => {
      previewCloseGuardRef.current = guard;
    },
    [],
  );

  const requestCurrentPreviewClose = useCallback(async (): Promise<boolean> => {
    const currentGuard = previewCloseGuardRef.current;
    if (!currentGuard) {
      return true;
    }

    return await currentGuard();
  }, []);

  const updatePdfPreviewDocument = useCallback(
    (path: string, document: ExplorerPdfPreviewDocument) => {
      setPreview((prev) =>
        prev.type === "pdf" && prev.path === path
          ? { ...prev, document }
          : prev,
      );
    },
    [],
  );

  const handlePdfPreviewChromeStateChange = useCallback(
    (state: ExplorerPdfWorkbenchChromeState | null) => {
      setPdfPreviewChromeState(state);
      if (state) {
        setDocumentViewMode(state.isEditMode ? "edit" : "preview");
      }
    },
    [],
  );
  const queuePreviewTerminalCommand = useCallback(
    (command: string) => {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) {
        return;
      }

      previewTerminalCommandSequenceRef.current += 1;
      setPreviewTerminalCommandRequest({
        id: `${previewTerminalNamespace}:${previewTerminalCommandSequenceRef.current}`,
        command: trimmedCommand,
        run: true,
      });
    },
    [previewTerminalNamespace],
  );
  const handlePreviewTerminalCommandHandled = useCallback(
    (requestId: string) => {
      setPreviewTerminalCommandRequest((current) =>
        current?.id === requestId ? null : current,
      );
    },
    [],
  );
  const stopPreviewTextScriptRun = useCallback(() => {
    setDocumentViewMode("edit");
    setPreviewSurfaceMode("content");
  }, []);
  const runPreviewTextScript = useCallback(
    async (path: string, scriptPreview: ExplorerResolvedScriptPreview) => {
      const currentPreview = previewRef.current;
      if (
        currentPreview.type !== "text" ||
        currentPreview.path !== path ||
        currentPreview.scriptPreview == null
      ) {
        return;
      }

      if (currentPreview.isDirty) {
        const didSave = await persistPreviewText(path);
        if (!didSave) {
          return;
        }
      }

      const command = buildTerminalScriptRunCommand({
        path,
        shell: useSettingsStore.getState().settings.terminal.shell,
        runner: scriptPreview.runner,
      });
      if (!command) {
        return;
      }

      setDocumentViewMode("preview");
      setPreviewTerminalMounted(true);
      setPreviewSurfaceMode("terminal");
      queuePreviewTerminalCommand(command);
    },
    [persistPreviewText, queuePreviewTerminalCommand],
  );
  const resetPreviewTerminalState = useCallback(() => {
    setPreviewSurfaceMode("content");
    setPreviewTerminalMounted(false);
    setPreviewTerminalCommandRequest(null);
    setPreviewTerminalReportedWorkingDirectory(null);
    lastPreviewTerminalShellReportedCwdRef.current = null;
    lastPreviewTerminalExplorerAppliedCwdRef.current = null;
  }, []);
  const clearPreviewSurface = useCallback(() => {
    previewCloseGuardRef.current = null;
    resetPreviewTerminalState();
    setPreview({ type: "none", path: "" });
    setPreviewLoading(false);
    setPdfPreviewChromeState(null);
    setPreviewLocked(false);
  }, [resetPreviewTerminalState]);
  const togglePreviewTerminal = useCallback(() => {
    if (!previewTerminalWorkingDirectory) {
      return;
    }
    setPreviewTerminalMounted(true);
    setPreviewSurfaceMode((current) =>
      current === "terminal" ? "content" : "terminal",
    );
  }, [previewTerminalWorkingDirectory]);
  const handlePreviewTerminalReportedWorkingDirectoryChange = useCallback(
    (cwd: string) => {
      const trimmedCwd = cwd.trim();
      if (!trimmedCwd) {
        return;
      }

      const normalizedReportedCwd = normalizeExplorerPath(trimmedCwd);
      if (
        !normalizedReportedCwd ||
        isCloudExplorerPath(normalizedReportedCwd)
      ) {
        return;
      }

      setPreviewTerminalReportedWorkingDirectory(trimmedCwd);
      if (
        lastPreviewTerminalShellReportedCwdRef.current === normalizedReportedCwd
      ) {
        return;
      }
      lastPreviewTerminalShellReportedCwdRef.current = normalizedReportedCwd;

      if (normalizeExplorerPath(currentPath) === normalizedReportedCwd) {
        return;
      }

      lastPreviewTerminalExplorerAppliedCwdRef.current = normalizedReportedCwd;
      void navigate(normalizedReportedCwd, true).catch(() => {});
    },
    [currentPath, navigate],
  );

  const closePreview = useCallback(async (): Promise<boolean> => {
    const shouldClose = await requestCurrentPreviewClose();
    if (!shouldClose) {
      return false;
    }

    previewLoadRequestIdRef.current += 1;
    previewCloseGuardRef.current = null;
    await flushPreviewTextSave();
    clearPreviewSurface();
    return true;
  }, [clearPreviewSurface, flushPreviewTextSave, requestCurrentPreviewClose]);

  useEffect(() => {
    if (isCompactDock) {
      setSidebarWidth((current) =>
        Math.max(
          sidebarBounds.minWidth,
          Math.min(current, sidebarBounds.maxWidth),
        ),
      );
      void closePreview();
    }
  }, [
    closePreview,
    isCompactDock,
    sidebarBounds.maxWidth,
    sidebarBounds.minWidth,
  ]);

  useEffect(() => {
    if (!previewEnabled) {
      void closePreview().then((didClose) => {
        if (!didClose && isExplorerMountedRef.current) {
          setPreviewEnabled(true);
        }
      });
    }
  }, [closePreview, previewEnabled]);

  useEffect(() => {
    if (!previewTerminalReportedWorkingDirectory) {
      return;
    }

    const normalizedCurrentPath = normalizeExplorerPath(currentPath);
    const normalizedReportedPath = normalizeExplorerPath(
      previewTerminalReportedWorkingDirectory,
    );
    if (
      lastPreviewTerminalExplorerAppliedCwdRef.current === normalizedCurrentPath
    ) {
      return;
    }
    if (normalizedReportedPath !== normalizedCurrentPath) {
      setPreviewTerminalReportedWorkingDirectory(null);
    }
  }, [currentPath, previewTerminalReportedWorkingDirectory]);

  const applyModeProfilePreset = useCallback(
    (nextModeProfile: ExplorerModeProfileDefinition) => {
      const nextLayout = getExplorerShellLayoutDefinition(
        nextModeProfile.paneLayoutId,
      );
      const suggestedWidths = getExplorerShellLayoutWidthSuggestion({
        layoutId: nextLayout.id,
        railWidth: explorerTheme.metrics.railWidth,
        railMinWidth: sidebarBounds.minWidth,
        railMaxWidth: sidebarBounds.maxWidth,
        previewWidth: explorerTheme.metrics.previewWidth,
        previewMinWidth: EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
        previewMaxWidth: EXPLORER_PREVIEW_WIDTH_BOUNDS.max,
      });

      setExplorerModeProfileOverride(explorerChromeThemeId, nextModeProfile.id);
      setSidebarWidth(suggestedWidths.sidebarWidth);
      setPreviewWidth(suggestedWidths.previewWidth);
      setShowModeProfileMenu(false);
    },
    [
      explorerChromeThemeId,
      explorerTheme.metrics.previewWidth,
      explorerTheme.metrics.railWidth,
      sidebarBounds.maxWidth,
      sidebarBounds.minWidth,
      setExplorerModeProfileOverride,
    ],
  );

  const togglePreviewEnabled = useCallback(async () => {
    previewReopenOnSelectionRef.current = false;
    allowPreviewLoadWhileClosedRef.current = false;
    if (previewEnabled) {
      const didClose = await closePreview();
      if (didClose) {
        setPreviewEnabled(false);
      }
      return;
    }

    setPreviewEnabled(true);
  }, [closePreview, previewEnabled]);

  const togglePreviewLock = useCallback(() => {
    if (preview.type === "none") {
      return;
    }
    setPreviewLocked((current) => !current);
  }, [preview.type]);

  const closePreviewPanel = useCallback(async () => {
    previewReopenOnSelectionRef.current = true;
    allowPreviewLoadWhileClosedRef.current = false;
    const didClose = await closePreview();
    if (didClose) {
      setPreviewEnabled(false);
    }
  }, [closePreview]);

  const previewEntry = useCallback(
    async (
      entry: FileEntry,
      focusTarget: EditorSearchFocusTarget | null = null,
      source: "explicit" | "selection" = "selection",
    ) => {
      const requestId = ++previewLoadRequestIdRef.current;
      const isCurrentPreviewRequest = () =>
        isExplorerMountedRef.current &&
        previewLoadRequestIdRef.current === requestId;
      const allowPreviewLoadWhileClosed =
        allowPreviewLoadWhileClosedRef.current;
      allowPreviewLoadWhileClosedRef.current = false;

      if ((!previewEnabled && !allowPreviewLoadWhileClosed) || isCompactDock) {
        if (isCurrentPreviewRequest()) {
          clearPreviewSurface();
        }
        return;
      }

      const currentPreview = previewRef.current;
      const selectionLockedToDifferentEntry =
        source === "selection" &&
        previewLocked &&
        currentPreview.type !== "none" &&
        currentPreview.path !== entry.path;
      if (selectionLockedToDifferentEntry) {
        return;
      }
      if (
        currentPreview.type === "text" &&
        currentPreview.path !== entry.path
      ) {
        await flushPreviewTextSave();
        if (!isCurrentPreviewRequest()) {
          return;
        }
      }
      if (
        currentPreview.type !== "none" &&
        currentPreview.type !== "text" &&
        currentPreview.path !== entry.path
      ) {
        const shouldCloseCurrentPreview = await requestCurrentPreviewClose();
        if (!shouldCloseCurrentPreview || !isCurrentPreviewRequest()) {
          return;
        }
      }
      const resolvedPreview = resolveExplorerPreviewDescriptor(entry, {
        assetUrlResolver: getPreviewAssetUrl,
        documentPreviewKindResolver: getDocumentPreviewKind,
      });
      if (
        resolvedPreview.kind === "text" ||
        resolvedPreview.kind === "unsupported"
      ) {
        const executableTextScriptProbe =
          await probeExecutableTextScriptPreview({
            entry,
            runtimePlatform,
            getItemProperties: getExplorerItemProperties,
            readTextFile: readExplorerTextFile,
          });
        if (!isCurrentPreviewRequest()) {
          return;
        }

        if (executableTextScriptProbe.kind === "script") {
          setDocumentViewMode("edit");
          const restoredDraft = loadExplorerEditDraft(
            EXPLORER_TEXT_DRAFT_SCOPE,
            entry.path,
            explorerStringDraftSerializer,
          );
          const resolvedContent =
            restoredDraft ?? executableTextScriptProbe.preview.content;
          const hasRestoredDraft =
            restoredDraft != null &&
            restoredDraft !== executableTextScriptProbe.preview.content;
          setPreview({
            type: "text",
            path: entry.path,
            name: entry.name,
            content: resolvedContent,
            language: executableTextScriptProbe.preview.language,
            renderKind: "none",
            scriptPreview: {
              ...executableTextScriptProbe.preview,
              content: resolvedContent,
            },
            focusTarget,
            isDirty: hasRestoredDraft,
            isSaving: false,
            lastSavedAt: hasRestoredDraft ? null : Date.now(),
            error: null,
          });
          setPreviewLoading(false);
          return;
        }

        if (executableTextScriptProbe.kind === "binary") {
          const fallback = buildExplorerUnsupportedPreviewFallback();
          setPreview({
            type: "fallback",
            path: entry.path,
            name: entry.name,
            label: fallback.label,
            detail: fallback.detail,
          });
          setPreviewLoading(false);
          return;
        }
      }

      switch (resolvedPreview.kind) {
        case "folder":
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "folder",
              path: entry.path,
              name: entry.name,
            });
            setPreviewLoading(false);
          }
          return;
        case "model3d":
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "model3d",
              path: entry.path,
              format: resolvedPreview.format,
              name: entry.name,
              size: entry.size,
            });
            setPreviewLoading(false);
          }
          return;
        case "archive":
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "archive",
              path: entry.path,
              name: entry.name,
              size: entry.size,
              descriptor: resolvedPreview.descriptor,
            });
            setPreviewLoading(false);
          }
          return;
        case "audio":
          setDocumentViewMode("preview");
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "audio",
              path: entry.path,
              name: entry.name,
              source: resolvedPreview.source,
              extension: resolvedPreview.extension,
              mimeType: resolvedPreview.mimeType,
              size: entry.size,
            });
            setPreviewLoading(false);
          }
          return;
        case "video":
          setDocumentViewMode("preview");
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "video",
              path: entry.path,
              name: entry.name,
              source: resolvedPreview.source,
              extension: resolvedPreview.extension,
              mimeType: resolvedPreview.mimeType,
              size: entry.size,
            });
            setPreviewLoading(false);
          }
          return;
        case "image": {
          setDocumentViewMode("preview");
          const loadingFallback =
            buildExplorerPreviewLoadingFallback(resolvedPreview);
          if (loadingFallback && isCurrentPreviewRequest()) {
            setPreviewLoading(true);
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: loadingFallback.label,
              detail: loadingFallback.detail,
            });
          }

          const previewCacheKey = `${resolvedPreview.kind}:${entry.path}`;
          const cachedDataUri = readCachedExplorerPreview<string>(
            previewCacheKey,
          );
          if (cachedDataUri != null) {
            if (isCurrentPreviewRequest()) {
              setPreview({
                type: "image",
                path: entry.path,
                name: entry.name,
                extension: resolvedPreview.extension,
                content: cachedDataUri,
              });
              setPreviewLoading(false);
            }
            return;
          }

          try {
            const dataUri = await readExplorerFileBase64(entry.path);
            storeCachedExplorerPreview({
              key: previewCacheKey,
              path: entry.path,
              value: dataUri,
              bytes: estimateStringPreviewCacheBytes(dataUri),
            });
            if (!isCurrentPreviewRequest()) {
              return;
            }
            setPreview({
              type: "image",
              path: entry.path,
              name: entry.name,
              extension: resolvedPreview.extension,
              content: dataUri,
            });
          } catch (error) {
            if (!isCurrentPreviewRequest()) {
              return;
            }
            const errorFallback = buildExplorerPreviewErrorFallback(
              resolvedPreview,
              error,
            );
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: errorFallback.label,
              detail: errorFallback.detail,
            });
          } finally {
            if (isCurrentPreviewRequest()) {
              setPreviewLoading(false);
            }
          }
          return;
        }
        case "font":
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "font",
              path: entry.path,
              name: entry.name,
              source: resolvedPreview.source,
              extension: resolvedPreview.extension,
              size: entry.size,
            });
            setPreviewLoading(false);
          }
          return;
        case "sqlite":
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "sqlite",
              path: entry.path,
              name: entry.name,
              size: entry.size,
            });
            setPreviewLoading(false);
          }
          return;
        case "pdf": {
          setDocumentViewMode("preview");
          if (
            currentPreview.type === "pdf" &&
            currentPreview.path === entry.path
          ) {
            if (isCurrentPreviewRequest()) {
              setPreview((prev) =>
                prev.type === "pdf" && prev.path === entry.path
                  ? {
                      ...prev,
                      name: entry.name,
                      size: entry.size,
                    }
                  : prev,
              );
              setPreviewLoading(false);
            }
            return;
          }

          const loadingFallback =
            buildExplorerPreviewLoadingFallback(resolvedPreview);
          if (loadingFallback && isCurrentPreviewRequest()) {
            setPreviewLoading(true);
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: loadingFallback.label,
              detail: loadingFallback.detail,
            });
          }

          try {
            const document = await openExplorerPdfPreviewDocument(entry.path);
            if (!isCurrentPreviewRequest()) {
              return;
            }
            setPreview({
              type: "pdf",
              path: entry.path,
              name: entry.name,
              size: entry.size,
              document,
            });
          } catch (error) {
            if (!isCurrentPreviewRequest()) {
              return;
            }
            const errorFallback = buildExplorerPreviewErrorFallback(
              resolvedPreview,
              error,
            );
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: errorFallback.label,
              detail: errorFallback.detail,
            });
          } finally {
            if (isCurrentPreviewRequest()) {
              setPreviewLoading(false);
            }
          }
          return;
        }
        case "spreadsheet":
          setDocumentViewMode("preview");
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "spreadsheet",
              path: entry.path,
              name: entry.name,
              extension: resolvedPreview.extension,
              size: entry.size,
              fileKind: resolvedPreview.fileKind,
            });
            setPreviewLoading(false);
          }
          return;
        case "docx":
          if (isCurrentPreviewRequest()) {
            setPreview({
              type: "docx",
              path: entry.path,
              name: entry.name,
              extension: resolvedPreview.extension,
              size: entry.size,
            });
            setPreviewLoading(false);
          }
          return;
        case "shader": {
          setDocumentViewMode("preview");
          const rememberedSelection =
            shaderPreviewSelectionMemoryRef.current.get(entry.path) ?? null;
          const loadingFallback =
            buildExplorerPreviewLoadingFallback(resolvedPreview);
          if (loadingFallback && isCurrentPreviewRequest()) {
            setPreviewLoading(true);
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: loadingFallback.label,
              detail: loadingFallback.detail,
            });
          }

          try {
            const document = await inspectExplorerShaderPreviewDocument(
              entry.path,
            );
            if (!isCurrentPreviewRequest()) {
              return;
            }

            const restoredDraft =
              document.editableSource == null
                ? null
                : loadExplorerEditDraft(
                    EXPLORER_SHADER_DRAFT_SCOPE,
                    entry.path,
                    explorerStringDraftSerializer,
                  );
            const resolvedEditableSource = restoredDraft ?? document.editableSource;
            const resolvedInspectionSource =
              restoredDraft ?? document.inspectionSource;
            const hasRestoredDraft =
              restoredDraft != null &&
              restoredDraft !== document.editableSource;
            const selectedStage =
              rememberedSelection?.selectedStage ?? document.selectedStage;
            const selectedEntryPoint =
              rememberedSelection?.selectedEntryPoint ??
              document.selectedEntryPoint;
            shaderPreviewSelectionMemoryRef.current.set(entry.path, {
              selectedStage,
              selectedEntryPoint,
            });
            setPreview({
              type: "shader",
              path: entry.path,
              name: entry.name,
              size: entry.size,
              format: resolvedPreview.format ?? document.format,
              editableSource: resolvedEditableSource,
              inspectionSource: resolvedInspectionSource,
              isReadOnly: document.isReadOnly,
              selectedScene:
                currentPreview.type === "shader" &&
                currentPreview.path === entry.path
                  ? currentPreview.selectedScene
                  : shaderPerformanceProfile.previewDefaultScene,
              selectedStage,
              selectedEntryPoint,
              entryPoints: document.entryPoints,
              diagnostics: document.diagnostics,
              normalizedWgsl: document.normalizedWgsl,
              previewAbi: document.previewAbi,
              supportsLivePreview: document.supportsLivePreview,
              isDirty: hasRestoredDraft,
              isSaving: false,
              error: null,
            });
          } catch (shaderError) {
            if (!isCurrentPreviewRequest()) {
              return;
            }
            const errorFallback = buildExplorerPreviewErrorFallback(
              resolvedPreview,
              shaderError,
            );
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: errorFallback.label,
              detail: errorFallback.detail,
            });
          } finally {
            if (isCurrentPreviewRequest()) {
              setPreviewLoading(false);
            }
          }
          return;
        }
        case "script": {
          setDocumentViewMode("edit");
          if (
            currentPreview.type === "text" &&
            currentPreview.path === entry.path
          ) {
            if (isCurrentPreviewRequest()) {
              setPreview((prev) =>
                prev.type === "text" && prev.path === entry.path
                  ? {
                      ...prev,
                      name: entry.name,
                      language: resolvedPreview.language,
                      renderKind: "none",
                      scriptPreview: prev.scriptPreview
                        ? {
                            ...prev.scriptPreview,
                            language: resolvedPreview.language,
                            runner: resolvedPreview.runner,
                          }
                        : {
                            language: resolvedPreview.language,
                            runner: resolvedPreview.runner,
                            content: prev.content,
                          },
                      focusTarget,
                    }
                  : prev,
              );
              setPreviewLoading(false);
            }
            return;
          }

          const loadingFallback =
            buildExplorerPreviewLoadingFallback(resolvedPreview);
          if (loadingFallback && isCurrentPreviewRequest()) {
            setPreviewLoading(true);
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: loadingFallback.label,
              detail: loadingFallback.detail,
            });
          }

          try {
            const previewCacheKey = `${resolvedPreview.kind}:${entry.path}`;
            let content = readCachedExplorerPreview<string>(previewCacheKey);
            if (content == null) {
              content = await readExplorerTextFile(entry.path);
              storeCachedExplorerPreview({
                key: previewCacheKey,
                path: entry.path,
                value: content,
                bytes: estimateStringPreviewCacheBytes(content),
              });
            }
            if (!isCurrentPreviewRequest()) {
              return;
            }

            const restoredDraft = loadExplorerEditDraft(
              EXPLORER_TEXT_DRAFT_SCOPE,
              entry.path,
              explorerStringDraftSerializer,
            );
            const resolvedContent = restoredDraft ?? content;
            const hasRestoredDraft =
              restoredDraft != null && restoredDraft !== content;
            setPreview({
              type: "text",
              path: entry.path,
              name: entry.name,
              content: resolvedContent,
              language: resolvedPreview.language,
              renderKind: "none",
              scriptPreview: {
                language: resolvedPreview.language,
                runner: resolvedPreview.runner,
                content: resolvedContent,
              },
              focusTarget,
              isDirty: hasRestoredDraft,
              isSaving: false,
              lastSavedAt: hasRestoredDraft ? null : Date.now(),
              error: null,
            });
          } catch (error) {
            if (!isCurrentPreviewRequest()) {
              return;
            }
            const errorFallback = buildExplorerPreviewErrorFallback(
              resolvedPreview,
              error,
            );
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: errorFallback.label,
              detail: errorFallback.detail,
            });
          } finally {
            if (isCurrentPreviewRequest()) {
              setPreviewLoading(false);
            }
          }
          return;
        }
        case "text": {
          setDocumentViewMode(
            resolvedPreview.renderKind === "html" ? "preview" : "edit",
          );
          if (
            currentPreview.type === "text" &&
            currentPreview.path === entry.path
          ) {
            if (isCurrentPreviewRequest()) {
              setPreview((prev) =>
                prev.type === "text" && prev.path === entry.path
                  ? {
                      ...prev,
                      name: entry.name,
                      language: resolvedPreview.language,
                      renderKind: resolvedPreview.renderKind,
                      scriptPreview: null,
                      focusTarget,
                    }
                  : prev,
              );
              setPreviewLoading(false);
            }
            return;
          }

          const loadingFallback =
            buildExplorerPreviewLoadingFallback(resolvedPreview);
          if (loadingFallback && isCurrentPreviewRequest()) {
            setPreviewLoading(true);
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: loadingFallback.label,
              detail: loadingFallback.detail,
            });
          }

          try {
            const previewCacheKey = `${resolvedPreview.kind}:${entry.path}`;
            let content = readCachedExplorerPreview<string>(previewCacheKey);
            if (content == null) {
              content = await readExplorerTextFile(entry.path);
              storeCachedExplorerPreview({
                key: previewCacheKey,
                path: entry.path,
                value: content,
                bytes: estimateStringPreviewCacheBytes(content),
              });
            }
            if (!isCurrentPreviewRequest()) {
              return;
            }

            const restoredDraft = loadExplorerEditDraft(
              EXPLORER_TEXT_DRAFT_SCOPE,
              entry.path,
              explorerStringDraftSerializer,
            );
            const resolvedContent = restoredDraft ?? content;
            const hasRestoredDraft =
              restoredDraft != null && restoredDraft !== content;
            setPreview({
              type: "text",
              path: entry.path,
              name: entry.name,
              content: resolvedContent,
              language: resolvedPreview.language,
              renderKind: resolvedPreview.renderKind,
              scriptPreview: null,
              focusTarget,
              isDirty: hasRestoredDraft,
              isSaving: false,
              lastSavedAt: hasRestoredDraft ? null : Date.now(),
              error: null,
            });
          } catch (error) {
            if (!isCurrentPreviewRequest()) {
              return;
            }
            const errorFallback = buildExplorerPreviewErrorFallback(
              resolvedPreview,
              error,
            );
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: errorFallback.label,
              detail: errorFallback.detail,
            });
          } finally {
            if (isCurrentPreviewRequest()) {
              setPreviewLoading(false);
            }
          }
          return;
        }
        case "unsupported": {
          if (isCurrentPreviewRequest()) {
            const fallback = buildExplorerUnsupportedPreviewFallback();
            setPreview({
              type: "fallback",
              path: entry.path,
              name: entry.name,
              label: fallback.label,
              detail: fallback.detail,
            });
            setPreviewLoading(false);
          }
          return;
        }
      }
    },
    [
      getDocumentPreviewKind,
      getExplorerItemProperties,
      getPreviewAssetUrl,
      flushPreviewTextSave,
      isCompactDock,
      openExplorerPdfPreviewDocument,
      clearPreviewSurface,
      previewRef,
      previewEnabled,
      readExplorerTextFile,
      requestCurrentPreviewClose,
      runtimePlatform,
      setDocumentViewMode,
      previewLocked,
    ],
  );

  const previewExplorerSelectionTarget = useCallback(
    (entry: FileEntry) => {
      if (repositoryPicker?.active || !previewEnabled || isCompactDock) {
        return;
      }
      void previewEntry(entry, getSearchFocusTarget(entry), "selection");
    },
    [
      getSearchFocusTarget,
      isCompactDock,
      previewEnabled,
      previewEntry,
      repositoryPicker?.active,
    ],
  );

  const selectVisibleEntryAtIndex = useCallback(
    (index: number, extendRange: boolean) => {
      if (visibleEntries.length === 0) return;

      const clampedIndex = Math.max(
        0,
        Math.min(index, visibleEntries.length - 1),
      );
      const nextEntry = visibleEntries[clampedIndex];
      if (!nextEntry) return;

      if (!extendRange) {
        setSelected(new Set([nextEntry.path]));
        lastSelected.current = nextEntry.path;
        selectionRangeAnchorPathRef.current = nextEntry.path;
        scrollExplorerEntryIntoView(nextEntry.path);
        previewExplorerSelectionTarget(nextEntry);
        return;
      }

      const anchorPath =
        selectionRangeAnchorPathRef.current ??
        lastSelected.current ??
        Array.from(selected)[0] ??
        nextEntry.path;
      const anchorIndex = visibleEntryIndexLookup.get(anchorPath) ?? -1;
      const rangeStart =
        anchorIndex >= 0 ? Math.min(anchorIndex, clampedIndex) : clampedIndex;
      const rangeEnd =
        anchorIndex >= 0 ? Math.max(anchorIndex, clampedIndex) : clampedIndex;

      setSelected(
        new Set(
          visibleEntries
            .slice(rangeStart, rangeEnd + 1)
            .map((entry) => entry.path),
        ),
      );
      lastSelected.current = nextEntry.path;
      selectionRangeAnchorPathRef.current =
        anchorIndex >= 0 ? anchorPath : nextEntry.path;
      scrollExplorerEntryIntoView(nextEntry.path);
      previewExplorerSelectionTarget(nextEntry);
    },
    [
      previewExplorerSelectionTarget,
      scrollExplorerEntryIntoView,
      selected,
      visibleEntryIndexLookup,
      visibleEntries,
    ],
  );

  const openEntry = useCallback(
    async (entry: FileEntry) => {
      if (entry.is_dir) {
        navigate(entry.path);
        return;
      }

      if (isExplorerArchiveEntry(entry)) {
        const canInlinePreview = previewEnabled && !isCompactDock;
        if (canInlinePreview) {
          await previewEntry(entry, null, "explicit");
        } else {
          await handleArchiveAction(entry, "openCached");
        }
        return;
      }

      const focusTarget = getSearchFocusTarget(entry);
      const canInlinePreview = previewEnabled && !isCompactDock;
      const entryExtension = getEntryExtension(entry);

      if (canInlinePreview && !isExecutableBinaryExtension(entryExtension)) {
        await previewEntry(entry, focusTarget, "explicit");
        return;
      }

      if (isExecutableBinaryExtension(entryExtension)) {
        await openExplorerPath(entry.path).catch((e) => setError(String(e)));
        return;
      }

      await openExplorerPath(entry.path).catch((e) => setError(String(e)));
    },
    [
      getSearchFocusTarget,
      handleArchiveAction,
      isCompactDock,
      navigate,
      openExplorerPath,
      previewEnabled,
      previewEntry,
    ],
  );

  const openFolderPreviewEntry = useCallback(
    async (entry: FileEntry) => {
      if (entry.is_dir) {
        await navigate(entry.path);
        await previewEntry(entry, null, "explicit");
        return;
      }

      const parentPath = getPathParent(entry.path);
      if (parentPath && parentPath !== currentPath) {
        await navigate(parentPath);
      }

      if (!isExplorerMountedRef.current) {
        return;
      }

      setSelected(new Set([entry.path]));
      lastSelected.current = entry.path;
      selectionRangeAnchorPathRef.current = entry.path;
      await previewEntry(entry, getSearchFocusTarget(entry), "explicit");
    },
    [currentPath, getSearchFocusTarget, navigate, previewEntry],
  );

  // ── Duplicate ──
  const duplicate = useCallback(
    async (entry: FileEntry) => {
      try {
        await executeTransferRequest(
          {
            targetDir: currentPath,
            sources: [entry.path],
            operation: "copy",
          },
          {
            onSuccess: () => refresh(),
          },
        );
      } catch (e) {
        setError(String(e));
      }
    },
    [currentPath, executeTransferRequest, refresh],
  );

  // ── Clipboard (system) ──
  const copyToSysClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  // ── Paste ──
  const paste = useCallback(async () => {
    if (!clipboard) return;
    try {
      await executeTransferRequest(
        {
          targetDir: currentPath,
          sources: clipboard.entries.map((entry) => entry.path),
          operation: clipboard.action === "cut" ? "move" : "copy",
        },
        {
          onSuccess: () => {
            if (clipboard.action === "cut") {
              setClipboard(null);
            }
            return refresh();
          },
        },
      );
    } catch (e) {
      setError(String(e));
    }
  }, [clipboard, currentPath, executeTransferRequest, refresh, setClipboard]);

  useEffect(() => {
    if (!externalSelectionTransferRequest) {
      return;
    }
    if (
      externalSelectionTransferRequest.sequence ===
      lastWorkspaceTransferSequenceRef.current
    ) {
      return;
    }
    lastWorkspaceTransferSequenceRef.current =
      externalSelectionTransferRequest.sequence;

    const targetDir = externalSelectionTransferRequest.targetDir.trim();
    const sourcePaths = selectedEntries.map((entry) => entry.path);
    if (!targetDir || sourcePaths.length === 0) {
      onWorkspaceSelectionTransferComplete?.({
        sequence: externalSelectionTransferRequest.sequence,
        instanceId,
        targetDir,
        operation: externalSelectionTransferRequest.operation,
        sourcePaths,
        success: false,
      });
      return;
    }

    void (async () => {
      try {
        const transferResults = await executeTransferRequest(
          {
            targetDir,
            sources: sourcePaths,
            operation: externalSelectionTransferRequest.operation,
          },
          {
            onSuccess: async () => {
              if (externalSelectionTransferRequest.operation === "move") {
                setSelected(new Set());
                if (sourcePaths.includes(previewRef.current.path)) {
                  clearPreviewSurface();
                }
              }
              await refresh();
            },
            onCancel: () => {
              onWorkspaceSelectionTransferComplete?.({
                sequence: externalSelectionTransferRequest.sequence,
                instanceId,
                targetDir,
                operation: externalSelectionTransferRequest.operation,
                sourcePaths,
                success: false,
              });
            },
          },
        );
        if (transferResults === null) {
          return;
        }
        onWorkspaceSelectionTransferComplete?.({
          sequence: externalSelectionTransferRequest.sequence,
          instanceId,
          targetDir,
          operation: externalSelectionTransferRequest.operation,
          sourcePaths,
          success: true,
        });
      } catch (transferError) {
        setError(String(transferError));
        onWorkspaceSelectionTransferComplete?.({
          sequence: externalSelectionTransferRequest.sequence,
          instanceId,
          targetDir,
          operation: externalSelectionTransferRequest.operation,
          sourcePaths,
          success: false,
        });
      }
    })();
  }, [
    clearPreviewSurface,
    externalSelectionTransferRequest,
    executeTransferRequest,
    instanceId,
    onWorkspaceSelectionTransferComplete,
    refresh,
    selectedEntries,
  ]);

  // ── Rename ──
  const commitRename = async (newName: string) => {
    const dir = rename.path.replace(/[/\\][^/\\]+$/, "");
    const sep = rename.path.includes("/") ? "/" : "\\";
    const oldPath = rename.path;
    const newPath = dir + sep + newName;
    try {
      const shouldResaveRenamedPreview =
        previewRef.current.path === oldPath &&
        previewRef.current.type === "text" &&
        previewRef.current.isDirty;
      const shouldMoveRenamedTextDraft =
        previewRef.current.path === oldPath &&
        previewRef.current.type === "text" &&
        previewRef.current.isDirty;
      const shouldMoveRenamedShaderDraft =
        previewRef.current.path === oldPath &&
        previewRef.current.type === "shader" &&
        previewRef.current.isDirty &&
        previewRef.current.editableSource != null;
      await renameExplorerPath(oldPath, newPath);
      invalidateExplorerResultCaches();
      if (shouldMoveRenamedTextDraft) {
        moveExplorerEditDraft(
          EXPLORER_TEXT_DRAFT_SCOPE,
          oldPath,
          newPath,
        );
      }
      if (shouldMoveRenamedShaderDraft) {
        moveExplorerEditDraft(
          EXPLORER_SHADER_DRAFT_SCOPE,
          oldPath,
          newPath,
        );
      }
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
        previewSaveTimer.current = null;
      }
      setPreview((prev) => {
        if (prev.type === "none" || prev.path !== oldPath) return prev;
        if (prev.type === "text") {
          return { ...prev, path: newPath, name: newName, error: null };
        }
        if (prev.type === "shader") {
          return { ...prev, path: newPath, name: newName, error: null };
        }
        if (prev.type === "image") {
          return { ...prev, path: newPath, name: newName };
        }
        return { ...prev, path: newPath, name: newName };
      });
      if (shouldResaveRenamedPreview) {
        queuePreviewSave(newPath);
      }
      setRename({ active: false, path: "", name: "" });
      refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const openTrashDialog = useCallback((targets: FileEntry[]) => {
    setDeleteTargets(targets);
  }, []);

  const closeTagDialog = useCallback(() => {
    setTagDialog({
      visible: false,
      mode: "add",
      paths: [],
      input: "",
      title: "Add Tags",
      description: "",
    });
  }, []);

  const openTagDialog = useCallback(
    (
      paths: string[],
      mode: "add" | "remove",
      options?: {
        title?: string;
        description?: string;
      },
    ) => {
      if (paths.length === 0) {
        return;
      }

      const fallbackTitle = mode === "add" ? "Add Tags" : "Remove Tags";
      const fallbackDescription =
        mode === "add"
          ? `Enter comma-separated tags for ${paths.length === 1 ? "the selected item" : `${paths.length} selected items`}.`
          : `Enter comma-separated tags to remove from ${paths.length === 1 ? "the selected item" : `${paths.length} selected items`}.`;

      setTagDialog({
        visible: true,
        mode,
        paths,
        input: "",
        title: options?.title ?? fallbackTitle,
        description: options?.description ?? fallbackDescription,
      });
    },
    [],
  );

  const applyTagsToPaths = useCallback(
    async (paths: string[], rawTagInput: string, mode: "add" | "remove") => {
      const tagNames = rawTagInput
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (tagNames.length === 0 || paths.length === 0) {
        return;
      }
      try {
        const snapshot = await setExplorerTagsForPaths({
          paths,
          tagNames,
          mode,
        });
        setTagMetadata(snapshot);
      } catch (tagError) {
        setError(String(tagError));
      }
    },
    [setExplorerTagsForPaths],
  );

  const submitTagDialog = useCallback(async () => {
    const trimmedInput = tagDialog.input.trim();
    const targetPaths = [...tagDialog.paths];
    const mode = tagDialog.mode;
    closeTagDialog();
    if (!trimmedInput || targetPaths.length === 0) {
      return;
    }
    await applyTagsToPaths(targetPaths, trimmedInput, mode);
  }, [
    applyTagsToPaths,
    closeTagDialog,
    tagDialog.input,
    tagDialog.mode,
    tagDialog.paths,
  ]);

  const recentLocations = useMemo(() => {
    const candidatePaths = history.slice(0, Math.max(0, historyIdx)).reverse();
    const unique = candidatePaths.filter(
      (path, index, collection) => path && collection.indexOf(path) === index,
    );
    return unique.slice(0, 3);
  }, [history, historyIdx]);
  const pinnedLocations = useMemo(() => {
    return explorerRail.nodes
      .filter(
        (
          node,
        ): node is (typeof explorerRail.nodes)[number] & {
          kind: "bookmark";
          path: string;
          name: string;
        } => node.kind === "bookmark",
      )
      .map((node) => ({
        path: node.path,
        label: node.name || getPathLeaf(node.path),
      }))
      .slice(0, 3);
  }, [explorerRail.nodes]);
  const currentFolderSizeSummary = useMemo(() => {
    const visibleSizes = visibleEntries
      .map((entry) => entrySizes[entry.path])
      .filter((value): value is EntryStorageInfo => Boolean(value));
    if (visibleSizes.length === 0) {
      return null;
    }
    const totalBytes = visibleSizes.reduce(
      (sum, value) => sum + value.bytes,
      0,
    );
    const fileCount = visibleSizes.filter((value) => !value.is_dir).length;
    const folderCount = visibleSizes.length - fileCount;
    return { totalBytes, fileCount, folderCount };
  }, [entrySizes, visibleEntries]);

  const batchRenameTargets = useMemo(
    () =>
      (selectedEntries.length > 0 ? selectedEntries : visibleEntries).filter(
        (entry) => !entry.is_dir,
      ),
    [selectedEntries, visibleEntries],
  );
  const batchRenameRecipe = useMemo<ExplorerBatchRenameRecipeInput>(
    () => ({
      sourcePaths: batchRenameTargets.map((entry) => entry.path),
      search: batchRename.findText,
      replacement: batchRename.replaceText,
      prefix: batchRename.prefix,
      suffix: batchRename.suffix,
      mode: batchRename.mode,
      startIndex: batchRename.startingNumber,
      indexPadding: batchRename.padding,
    }),
    [batchRename, batchRenameTargets],
  );
  const batchRenamePreview = useMemo(
    () => ({ rows: batchRenamePreviewRows }),
    [batchRenamePreviewRows],
  );

  useEffect(() => {
    if (!batchRename.visible) {
      return;
    }

    const requestId = batchRenamePreviewRequestIdRef.current + 1;
    batchRenamePreviewRequestIdRef.current = requestId;

    if (batchRenameRecipe.sourcePaths.length === 0) {
      setBatchRenamePreviewRows([]);
      return;
    }

    void previewExplorerBatchRename(batchRenameRecipe)
      .then((rows) => {
        if (batchRenamePreviewRequestIdRef.current !== requestId) {
          return;
        }
        setBatchRenamePreviewRows(rows);
      })
      .catch((previewError) => {
        if (batchRenamePreviewRequestIdRef.current !== requestId) {
          return;
        }
        setError(String(previewError));
        setBatchRenamePreviewRows([]);
      });
  }, [
    batchRename.visible,
    batchRenameRecipe,
    previewExplorerBatchRename,
    setError,
  ]);

  const commitBatchRename = useCallback(async () => {
    if (batchRenameRecipe.sourcePaths.length === 0) {
      setBatchRename((current) => ({ ...current, visible: false }));
      return;
    }
    try {
      const results = await applyExplorerBatchRenameRecipe(batchRenameRecipe);
      if (results.length === 0) {
        setBatchRename((current) => ({ ...current, visible: false }));
        return;
      }
      invalidateExplorerResultCaches();
      setBatchRename((current) => ({ ...current, visible: false }));
      refresh();
    } catch (renameError) {
      setError(String(renameError));
    }
  }, [applyExplorerBatchRenameRecipe, batchRenameRecipe, refresh, setError]);

  const saveCurrentSearch = useCallback(async () => {
    const name = saveSearchState.name.trim() || search.trim();
    if (!name || !currentPath || !search.trim()) {
      return;
    }
    try {
      const record = await saveExplorerSavedSearch({
        id: null,
        name,
        rootPath: currentPath,
        query: search.trim(),
        includeContent: searchIncludeContent,
        tagFilterIds: activeTagFilterIds,
      });
      setSavedSearches((current) => {
        const next = [
          record,
          ...current.filter((candidate) => candidate.id !== record.id),
        ];
        return next.sort((left, right) => right.updatedAt - left.updatedAt);
      });
      setSaveSearchState({ visible: false, name: "" });
    } catch (saveError) {
      setError(String(saveError));
    }
  }, [
    activeTagFilterIds,
    currentPath,
    saveExplorerSavedSearch,
    saveSearchState.name,
    search,
    searchIncludeContent,
  ]);

  const applySavedSearch = useCallback(
    async (savedSearch: ExplorerSavedSearch) => {
      if (savedSearch.rootPath !== currentPath) {
        await navigate(savedSearch.rootPath);
      }
      setSearch(savedSearch.query);
      setSearchIncludeContent(savedSearch.includeContent);
      setActiveTagFilterIds(savedSearch.tagFilterIds);
    },
    [currentPath, navigate],
  );

  const updateJumpFilterQuery = useCallback(
    (nextQuery: string) => {
      const trimmed = nextQuery.trim();
      if (!trimmed) {
        setJumpFilter(null);
        return;
      }

      const requestId = jumpFilterRequestIdRef.current + 1;
      jumpFilterRequestIdRef.current = requestId;
      const jumpFilterEntries = baseVisibleEntries.map((entry, index) => ({
        path: entry.path,
        name: entry.name,
        isDir: entry.is_dir,
        sortOrder: index,
      }));
      void fuzzyFilterExplorerEntries({
        query: trimmed,
        entries: jumpFilterEntries,
        limit: null,
      })
        .then((matches) => {
          if (jumpFilterRequestIdRef.current !== requestId) {
            return;
          }
          const resultPaths = matches.map((entry) => entry.path);
          setJumpFilter({
            active: true,
            query: trimmed,
            resultIndex: resultPaths.length > 0 ? 0 : -1,
            resultPaths,
          });
        })
        .catch((jumpFilterError) => {
          if (jumpFilterRequestIdRef.current !== requestId) {
            return;
          }
          setError(String(jumpFilterError));
          setJumpFilter({
            active: true,
            query: trimmed,
            resultIndex: -1,
            resultPaths: [],
          });
        });
    },
    [baseVisibleEntries, fuzzyFilterExplorerEntries, setError, setJumpFilter],
  );

  const moveJumpFilterSelection = useCallback(
    (direction: 1 | -1) => {
      if (!jumpFilter.active || jumpFilter.resultPaths.length === 0) {
        return;
      }

      const nextIndex =
        jumpFilter.resultIndex < 0
          ? 0
          : (jumpFilter.resultIndex +
              direction +
              jumpFilter.resultPaths.length) %
            jumpFilter.resultPaths.length;
      const nextPath = jumpFilter.resultPaths[nextIndex];
      if (!nextPath) {
        return;
      }

      setJumpFilter({
        active: true,
        query: jumpFilter.query,
        resultIndex: nextIndex,
        resultPaths: jumpFilter.resultPaths,
      });
      setSelected(new Set([nextPath]));
      lastSelected.current = nextPath;
      selectionRangeAnchorPathRef.current = nextPath;
      scrollExplorerEntryIntoView(nextPath);
      const nextEntry = visibleEntryLookup.get(nextPath) ?? null;
      if (nextEntry) {
        previewExplorerSelectionTarget(nextEntry);
      }
    },
    [
      jumpFilter.active,
      jumpFilter.query,
      jumpFilter.resultIndex,
      jumpFilter.resultPaths,
      previewExplorerSelectionTarget,
      setJumpFilter,
      scrollExplorerEntryIntoView,
      visibleEntryLookup,
    ],
  );

  const startDuplicateFinder = useCallback(async () => {
    if (!currentPath || currentPathIsCloud) {
      return;
    }
    setDuplicateFinder({
      visible: true,
      scanId: null,
      status: null,
      loading: true,
    });
    try {
      const response = await startExplorerDuplicateScan(currentPath);
      setDuplicateFinder({
        visible: true,
        scanId: response.scanId,
        status: null,
        loading: true,
      });
    } catch (scanError) {
      setError(String(scanError));
      setDuplicateFinder({
        visible: false,
        scanId: null,
        status: null,
        loading: false,
      });
    }
  }, [currentPath, currentPathIsCloud, startExplorerDuplicateScan]);

  useEffect(() => {
    if (!duplicateFinder.visible || !duplicateFinder.scanId) {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await pollExplorerDuplicateScan(
          duplicateFinder.scanId ?? "",
        );
        if (!cancelled) {
          setDuplicateFinder((current) => ({
            ...current,
            status,
            loading: !status.completed && !status.cancelled,
          }));
          if (!status.completed && !status.cancelled) {
            window.setTimeout(tick, 700);
          }
        }
      } catch (scanError) {
        if (!cancelled) {
          setError(String(scanError));
        }
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [
    duplicateFinder.scanId,
    duplicateFinder.visible,
    pollExplorerDuplicateScan,
  ]);

  const confirmTrash = async () => {
    if (deleteTargets.length === 0) return;
    try {
      await trashExplorerPaths(deleteTargets.map((entry) => entry.path));
      invalidateExplorerResultCaches();
      if (deleteTargets.some((entry) => preview.path === entry.path)) {
        clearPreviewSurface();
      }
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
        previewSaveTimer.current = null;
      }
      setDeleteTargets([]);
      refresh();
    } catch (deleteError) {
      setError(String(deleteError));
    }
  };

  const permanentlyDeleteTargets = async () => {
    if (deleteTargets.length === 0) return;
    try {
      for (const target of deleteTargets) {
        await deleteExplorerPath(target.path, target.is_dir);
      }
      invalidateExplorerResultCaches();
      setDeleteTargets([]);
      refresh();
    } catch (deleteError) {
      setError(String(deleteError));
    }
  };

  const undoTrash = useCallback(async () => {
    try {
      await restoreExplorerTrashAction();
      invalidateExplorerResultCaches();
      refresh();
    } catch (restoreError) {
      setError(String(restoreError));
    }
  }, [refresh, restoreExplorerTrashAction]);

  const revealPathLabel =
    runtimePlatform === "macos"
      ? "Reveal in Finder"
      : runtimePlatform === "linux"
        ? "Show in File Manager"
        : "Reveal in Explorer";
  const propertiesLabel =
    runtimePlatform === "macos" ? "Get Info" : "Properties";
  const supportsNativeOpenWith = runtimePlatform !== "linux";
  const supportsNativeProperties = runtimePlatform !== "linux";
  const resolvedPluginContextMenuItems = useMemo(
    () =>
      normalizePluginContextMenuContributions([
        ...pluginContextMenuItems,
        ...createLegacyExplorerActionContextMenuContributions(pluginActions),
      ]),
    [pluginActions, pluginContextMenuItems],
  );
  const finalizeContextMenuItems = useCallback(
    (items: CtxItem[]): CtxItem[] => {
      const visibleItems = items.filter((item) =>
        isExplorerContextMenuItemEnabled(
          item.id,
          explorerSettings.contextMenuItemOverrides,
        ),
      );
      const sortedItems = sortExplorerContextMenuItems(
        visibleItems,
        explorerSettings.contextMenuItemOverrides,
      );
      const finalizedItems: CtxItem[] = [];

      sortedItems.forEach((item, index) => {
        const previousItem = sortedItems[index - 1];
        if (previousItem && previousItem.group !== item.group) {
          finalizedItems.push({
            id: `divider-${previousItem.id}-${item.id}`,
            group: item.group,
            defaultOrder: item.defaultOrder - 1,
            label: "",
            icon: null,
            divider: true,
            action: () => undefined,
          });
        }
        finalizedItems.push(item);
      });

      return finalizedItems;
    },
    [explorerSettings.contextMenuItemOverrides],
  );
  const executePluginContextMenuItem = useCallback(
    async (
      contribution: ReturnType<
        typeof normalizePluginContextMenuContributions
      >[number],
      context: {
        path: string;
        name: string;
        parent: string;
        extension: string;
        stem: string;
        isDirectory: boolean;
      },
    ) => {
      if (contribution.execution.kind === "plugin-backend") {
        const resolvedArgs = contribution.execution.args.map((argument) =>
          resolvePluginCommandTemplate(argument, {
            ...context,
            pluginId: contribution.pluginId,
            pluginName: contribution.pluginName,
          }),
        );
        const result = await commands
          .pluginRunBackend(
            pluginSystemConfig.pluginsDirectory,
            contribution.pluginId,
            contribution.execution.entry,
            resolvedArgs,
          )
          .then(unwrapTauriResult);
        if (result.status !== 0) {
          const stderr =
            typeof result.stderr === "string" ? result.stderr.trim() : "";
          const stdout =
            typeof result.stdout === "string" ? result.stdout.trim() : "";
          throw new Error(
            stderr ||
              stdout ||
              `Plugin backend exited with status ${result.status}`,
          );
        }
        return;
      }

      if (contribution.execution.kind === "panel-request") {
        const resolvedPayload = Object.fromEntries(
          Object.entries(contribution.execution.payload).map(([key, value]) => [
            key,
            resolvePluginCommandTemplate(value, {
              ...context,
              pluginId: contribution.pluginId,
              pluginName: contribution.pluginName,
            }),
          ]),
        );
        requestPluginPanelOpen(
          contribution.execution.panelId,
          resolvedPayload,
          {
            source: "plugin-context-menu",
          },
        );
        return;
      }

      const resolvedCommand = resolvePluginCommandTemplate(
        contribution.execution.command,
        {
          ...context,
          pluginId: contribution.pluginId,
          pluginName: contribution.pluginName,
        },
      );
      dispatchTerminalCommand(
        resolvedCommand,
        contribution.execution.runOnSelect,
      );
    },
    [],
  );

  // ── Context menu builder ──
  const buildCtxItems = useCallback(
    (entry: FileEntry): CtxItem[] => {
      const isArchive = isExplorerArchiveEntry(entry);
      const isBookmarked = bookmarkPathSet.has(entry.path);
      const parentPath = entry.path.replace(/[/\\\\][^/\\\\]+$/, "");
      const stem = entry.name.replace(/\.[^.]+$/, "");
      const canUseNativeIntegration = supportsNativeIntegration(entry.path);
      const audioBatchTargets = resolveAudioBatchTargets(entry);
      const builtInItems = BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.flatMap(
        (item) => {
          if (!item.contexts.includes("entry")) {
            return [];
          }
          if (item.appliesTo === "directory" && !entry.is_dir) {
            return [];
          }
          if (item.appliesTo === "file" && entry.is_dir) {
            return [];
          }

          const sharedItem = {
            id: item.id,
            group: item.group,
            defaultOrder: item.defaultOrder,
            icon: resolveContextMenuIcon(item.iconName),
          };

          switch (item.execution.actionId) {
            case "open":
              return [
                {
                  ...sharedItem,
                  label: isArchive ? "Open Extracted Contents" : "Open",
                  action: () => openEntry(entry),
                },
              ];
            case "open-with":
              return supportsNativeOpenWith && canUseNativeIntegration
                ? [
                    {
                      ...sharedItem,
                      label: "Open With...",
                      action: () => openWithSystemPicker(entry.path),
                    },
                  ]
                : [];
            case "open-admin":
              return canUseNativeIntegration
                ? [
                    {
                      ...sharedItem,
                      label: entry.is_dir
                        ? "Open Folder as Admin"
                        : "Open as Admin",
                      action: () => openAsAdmin(entry.path),
                    },
                  ]
                : [];
            case "open-terminal":
              return entry.is_dir && !isCloudExplorerPath(entry.path)
                ? [
                    {
                      ...sharedItem,
                      label: "Open in Terminal",
                      action: () => onOpenInTerminal(entry.path),
                    },
                  ]
                : [];
            case "open-aquarium":
              return !isCloudExplorerPath(entry.path) &&
                (entry.is_dir || parentPath)
                ? [
                    {
                      ...sharedItem,
                      label: entry.is_dir
                        ? "Open Habitat in Filesystem Aquarium"
                        : "Open Parent Habitat in Filesystem Aquarium",
                      action: () =>
                        onOpenInFilesystemAquarium(
                          entry.is_dir ? entry.path : parentPath,
                        ),
                    },
                  ]
                : [];
            case "reveal":
              return canUseNativeIntegration
                ? [
                    {
                      ...sharedItem,
                      label: revealPathLabel,
                      action: () =>
                        revealExplorerPath(entry.path).catch((e) =>
                          setError(String(e)),
                        ),
                    },
                  ]
                : [];
            case "properties":
              return [
                {
                  ...sharedItem,
                  label: propertiesLabel,
                  action: () => openExplorerPropertiesPanel([entry.path]),
                },
              ];
            case "copy-path":
              return [
                {
                  ...sharedItem,
                  label: "Copy Path",
                  action: () => copyToSysClipboard(entry.path),
                },
              ];
            case "copy":
              return [
                {
                  ...sharedItem,
                  label: "Copy",
                  action: () => queueClipboard("copy", entry),
                },
              ];
            case "cut":
              return [
                {
                  ...sharedItem,
                  label: "Cut",
                  action: () => queueClipboard("cut", entry),
                },
              ];
            case "copy-to":
              return [
                {
                  ...sharedItem,
                  label: "Copy To...",
                  action: () => requestTransferDestination("copy", entry),
                },
              ];
            case "move-to":
              return [
                {
                  ...sharedItem,
                  label: "Move To...",
                  action: () => requestTransferDestination("move", entry),
                },
              ];
            case "extract-here":
              return isArchive
                ? [
                    {
                      ...sharedItem,
                      label: "Extract Here",
                      action: () => {
                        void handleArchiveAction(entry, "extractHere");
                      },
                    },
                  ]
                : [];
            case "extract-new-folder":
              return isArchive
                ? [
                    {
                      ...sharedItem,
                      label: getExplorerArchiveExtractToFolderLabel(entry),
                      action: () => {
                        void handleArchiveAction(entry, "extractToNewFolder");
                      },
                    },
                  ]
                : [];
            case "duplicate":
              return [
                {
                  ...sharedItem,
                  label: "Duplicate",
                  action: () => duplicate(entry),
                },
              ];
            case "rename":
              return [
                {
                  ...sharedItem,
                  label: "Rename (F2)",
                  action: () =>
                    setRename({
                      active: true,
                      path: entry.path,
                      name: entry.name,
                    }),
                },
              ];
            case "add-tags":
              return [
                {
                  ...sharedItem,
                  label: "Add Tags...",
                  action: () =>
                    openTagDialog([entry.path], "add", {
                      description: `Enter comma-separated tags to add to ${entry.name}.`,
                    }),
                },
              ];
            case "remove-tags":
              return [
                {
                  ...sharedItem,
                  label: "Remove Tags...",
                  action: () =>
                    openTagDialog([entry.path], "remove", {
                      description: `Enter comma-separated tags to remove from ${entry.name}.`,
                    }),
                },
              ];
            case "bookmark-toggle":
              return [
                {
                  ...sharedItem,
                  icon: isBookmarked ? (
                    <StarOff size={13} />
                  ) : (
                    <Star size={13} />
                  ),
                  label: isBookmarked ? "Remove Bookmark" : "Add to Bookmarks",
                  action: () => {
                    if (isBookmarked) {
                      updateExplorerRail(
                        removeExplorerBookmarksByPath(explorerRail, entry.path),
                      );
                      return;
                    }

                    const result = upsertExplorerBookmark(explorerRail, {
                      path: entry.path,
                      name: entry.name,
                      isDirectory: entry.is_dir,
                    });
                    updateExplorerRail(result.snapshot);
                    if (result.created) {
                      handleBookmarkCreated(entry.name, entry.path);
                    }
                  },
                },
              ];
            case "move-trash":
              return [
                {
                  ...sharedItem,
                  label: "Move to Trash",
                  danger: true,
                  action: () => openTrashDialog([entry]),
                },
              ];
            default:
              return [];
          }
        },
      );
      const audioBatchItems = audioBatchTargets
        ? [
            {
              id: "audio.batch-convert",
              group: "library" as const,
              defaultOrder: 336,
              icon: <Waves size={13} />,
              label: "Batch Convert Audio",
              action: () => {
                void handleAudioBatchAction("convert", entry);
              },
            },
            {
              id: "audio.batch-normalize",
              group: "library" as const,
              defaultOrder: 337,
              icon: <Sparkles size={13} />,
              label: "Batch Normalize Audio",
              action: () => {
                void handleAudioBatchAction("normalize", entry);
              },
            },
          ]
        : [];
      const pluginItems = resolvedPluginContextMenuItems
        .filter((item) => item.contexts.includes("entry"))
        .filter(
          (item) =>
            item.appliesTo === "any" ||
            (item.appliesTo === "directory" && entry.is_dir) ||
            (item.appliesTo === "file" && !entry.is_dir),
        )
        .map((item) => ({
          id: item.id,
          group: item.group,
          defaultOrder: item.defaultOrder,
          label: item.title,
          icon: resolveContextMenuIcon(item.iconName),
          action: () =>
            executePluginContextMenuItem(item, {
              path: entry.path,
              name: entry.name,
              parent: parentPath,
              extension: entry.extension,
              stem,
              isDirectory: entry.is_dir,
            }).catch((error) => setError(String(error))),
        }));

      return finalizeContextMenuItems([
        ...builtInItems,
        ...audioBatchItems,
        ...pluginItems,
      ]);
    },
    [
      bookmarkPathSet,
      copyToSysClipboard,
      duplicate,
      executePluginContextMenuItem,
      explorerRail,
      explorerSettings.contextMenuItemOverrides,
      finalizeContextMenuItems,
      handleArchiveAction,
      handleAudioBatchAction,
      handleBookmarkCreated,
      isCloudExplorerPath,
      onOpenInFilesystemAquarium,
      onOpenInTerminal,
      openAsAdmin,
      openEntry,
      openExplorerPropertiesPanel,
      openTagDialog,
      openTrashDialog,
      openWithSystemPicker,
      propertiesLabel,
      queueClipboard,
      requestTransferDestination,
      resolveAudioBatchTargets,
      resolvedPluginContextMenuItems,
      revealExplorerPath,
      revealPathLabel,
      supportsNativeIntegration,
      supportsNativeOpenWith,
      supportsNativeProperties,
      updateExplorerRail,
    ],
  );

  const buildEmptyCtxItems = useCallback((): CtxItem[] => {
    const canUseNativeIntegration = supportsNativeIntegration(currentPath);
    const pathSegments = currentPath.split(/[/\\]/).filter(Boolean);
    const pathName = pathSegments[pathSegments.length - 1] ?? currentPath;
    const pathParent = currentPath.replace(/[/\\][^/\\]+$/, "");
    const builtInItems = BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.flatMap(
      (item) => {
        if (!item.contexts.includes("background")) {
          return [];
        }

        const sharedItem = {
          id: item.id,
          group: item.group,
          defaultOrder: item.defaultOrder,
          icon: resolveContextMenuIcon(item.iconName),
        };

        switch (item.execution.actionId) {
          case "new-folder":
            return [
              {
                ...sharedItem,
                label: "New Folder",
                action: () => openNew("folder"),
              },
            ];
          case "new-file":
            return [
              {
                ...sharedItem,
                label: "New File...",
                action: () => openNew("file"),
              },
            ];
          case "paste":
            return clipboard
              ? [{ ...sharedItem, label: "Paste", action: () => paste() }]
              : [];
          case "open-aquarium":
            return !isCloudExplorerPath(currentPath)
              ? [
                  {
                    ...sharedItem,
                    label: "Open Habitat in Filesystem Aquarium",
                    action: () => onOpenInFilesystemAquarium(currentPath),
                  },
                ]
              : [];
          case "open-admin":
            return canUseNativeIntegration
              ? [
                  {
                    ...sharedItem,
                    label: "Open Folder as Admin",
                    action: () => openAsAdmin(currentPath),
                  },
                ]
              : [];
          case "reveal":
            return canUseNativeIntegration
              ? [
                  {
                    ...sharedItem,
                    label: revealPathLabel,
                    action: () =>
                      revealExplorerPath(currentPath).catch((e) =>
                        setError(String(e)),
                      ),
                  },
                ]
              : [];
          case "open-with":
            return supportsNativeOpenWith && canUseNativeIntegration
              ? [
                  {
                    ...sharedItem,
                    label: "Open With...",
                    action: () => openWithSystemPicker(currentPath),
                  },
                ]
              : [];
          case "properties":
            return [
              {
                ...sharedItem,
                label: propertiesLabel,
                action: () => openExplorerPropertiesPanel([currentPath]),
              },
            ];
          case "refresh":
            return [
              { ...sharedItem, label: "Refresh", action: () => refresh() },
            ];
          default:
            return [];
        }
      },
    );
    const pluginItems = resolvedPluginContextMenuItems
      .filter((item) => item.contexts.includes("background"))
      .map((item) => ({
        id: item.id,
        group: item.group,
        defaultOrder: item.defaultOrder,
        label: item.title,
        icon: resolveContextMenuIcon(item.iconName),
        action: () =>
          executePluginContextMenuItem(item, {
            path: currentPath,
            name: pathName,
            parent: pathParent,
            extension: "",
            stem: pathName,
            isDirectory: true,
          }).catch((error) => setError(String(error))),
      }));

    return finalizeContextMenuItems([...builtInItems, ...pluginItems]);
  }, [
    clipboard,
    currentPath,
    executePluginContextMenuItem,
    finalizeContextMenuItems,
    isCloudExplorerPath,
    onOpenInFilesystemAquarium,
    openAsAdmin,
    openExplorerPropertiesPanel,
    openWithSystemPicker,
    paste,
    propertiesLabel,
    refresh,
    resolvedPluginContextMenuItems,
    revealExplorerPath,
    revealPathLabel,
    supportsNativeIntegration,
    supportsNativeOpenWith,
    supportsNativeProperties,
  ]);

  // ── Right-click ──
  const onRightClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't lose multi-selection if right-clicking already-selected item
    setJumpFilter(null);
    if (!selected.has(entry.path)) {
      setSelected(new Set([entry.path]));
      lastSelected.current = entry.path;
      selectionRangeAnchorPathRef.current = entry.path;
    }
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, entry });
  };

  // ── Click with shift-select support ──
  const onEntryClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    mainRef.current?.focus();
    setJumpFilter(null);
    if (repositoryPicker?.active && !repositoryPicker.allowMultiple) {
      setSelected(new Set([entry.path]));
      lastSelected.current = entry.path;
      selectionRangeAnchorPathRef.current = entry.path;
      return;
    }
    const plainClick = !e.shiftKey && !e.ctrlKey && !e.metaKey;
    const shouldAutoReopenPreview =
      plainClick &&
      !previewEnabled &&
      previewReopenOnSelectionRef.current &&
      !isCompactDock;
    if (e.shiftKey) {
      const anchorPath =
        selectionRangeAnchorPathRef.current ?? lastSelected.current;
      const idx1 = anchorPath
        ? (visibleEntryIndexLookup.get(anchorPath) ?? -1)
        : -1;
      const idx2 = visibleEntryIndexLookup.get(entry.path) ?? -1;
      if (anchorPath && idx1 >= 0 && idx2 >= 0) {
        const [lo, hi] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        setSelected(
          new Set(visibleEntries.slice(lo, hi + 1).map((f) => f.path)),
        );
        selectionRangeAnchorPathRef.current = anchorPath;
      } else {
        setSelected(new Set([entry.path]));
        selectionRangeAnchorPathRef.current = entry.path;
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
        return next;
      });
      selectionRangeAnchorPathRef.current = entry.path;
    } else {
      setSelected(new Set([entry.path]));
      selectionRangeAnchorPathRef.current = entry.path;
    }
    lastSelected.current = entry.path;
    if (repositoryPicker?.active) {
      return;
    }
    if (
      shouldOpenExplorerEntryOnTrigger({
        isDirectory: entry.is_dir,
        trigger: "click",
        plainClick,
        folderClickMode,
      })
    ) {
      void openEntry(entry);
      return;
    }
    if ((previewEnabled || shouldAutoReopenPreview) && !isCompactDock) {
      if (shouldAutoReopenPreview) {
        previewReopenOnSelectionRef.current = false;
        allowPreviewLoadWhileClosedRef.current = true;
        setPreviewEnabled(true);
      }
      void previewEntry(entry, getSearchFocusTarget(entry), "selection");
    }
  };

  const onEntryDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (repositoryPicker?.active) {
        if (entry.is_dir) {
          void openEntry(entry);
        }
        return;
      }

      if (
        !shouldOpenExplorerEntryOnTrigger({
          isDirectory: entry.is_dir,
          trigger: "double-click",
          plainClick: true,
          folderClickMode,
        })
      ) {
        return;
      }

      void openEntry(entry);
    },
    [folderClickMode, openEntry, repositoryPicker?.active],
  );

  // ── Breadcrumbs ──
  const crumbs: { label: string; path: string }[] = locationBreadcrumbs;
  const locationTitle =
    crumbs.length > 0
      ? crumbs.map((crumb) => crumb.label).join(" / ")
      : currentPath || "Home";
  const locationLabel =
    crumbs[crumbs.length - 1]?.label ??
    (() => {
      if (!currentPathIsCloud) {
        return currentPath || "Home";
      }
      const cloudSegments = currentPath.split("/").filter(Boolean);
      return cloudSegments[cloudSegments.length - 1] ?? "Cloud";
    })();

  // ── Inline new item creation ──
  const openNew = (kind: "file" | "folder") => {
    setNewItemName(kind === "folder" ? "New Folder" : "untitled.txt");
    setNewItem({ visible: true, kind });
  };

  const commitNew = async () => {
    const name = newItemName.trim();
    if (!name) {
      setNewItem({ visible: false, kind: "folder" });
      return;
    }
    const base = currentPath.replace(/[/\\]+$/, "");
    try {
      if (newItem.kind === "folder") {
        if (currentPathIsCloud) {
          await createExplorerDir(`${base}/${name}`);
        } else {
          await createExplorerDir(
            joinPlatformPath(base, name, runtimePlatform),
          );
        }
      } else {
        await createExplorerFile(currentPath, name, "");
      }
      invalidateExplorerResultCaches();
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setNewItem({ visible: false, kind: "folder" });
    }
  };

  // ── Drag and Drop ──
  const onDragStart = (e: React.DragEvent<HTMLElement>, entry: FileEntry) => {
    const dragEntries = resolveEntriesForAction(entry);
    const dragPaths = dragEntries.map((item) => item.path);
    const requestedDragIntent = resolveExplorerDragIntent(e);
    const dragIntent =
      requestedDragIntent === "native-out" && !supportsNativeDragOut(dragPaths)
        ? "internal"
        : requestedDragIntent;
    activeDragPathsRef.current = dragPaths;
    nativeSameWindowDragPathsRef.current =
      dragIntent === "native-out" ? dragPaths : [];
    e.currentTarget.dataset.overlayDragIntent = dragIntent;
    // Keep explorer surface alive during native drag so in-app folder drops do not
    // collapse overlay shell before the drop target resolves.
    e.currentTarget.dataset.overlayDragHide = "false";
    applyExplorerNativeFeelingDragImage(e.dataTransfer, {
      primaryLabel: entry.name || getPathLeaf(entry.path) || "Item",
      itemCount: dragEntries.length,
    });
    e.dataTransfer.setData("text/plain", dragPaths[0] ?? entry.path);
    e.dataTransfer.setData(
      "application/x-overlayterm-paths",
      JSON.stringify(dragPaths),
    );
    e.dataTransfer.setData("application/x-overlayterm-drag-intent", dragIntent);
    if (dragIntent === "native-out") {
      const toFileUri = (value: string) => {
        const normalized = value.replace(/\\/g, "/");
        return normalized.startsWith("/")
          ? `file://${encodeURI(normalized)}`
          : `file:///${encodeURI(normalized)}`;
      };
      const uriList = dragPaths.map(toFileUri).join("\r\n");
      e.dataTransfer.setData("text/uri-list", uriList);
      if (isTauri() && dragPaths.length > 0) {
        if (runtimePlatform === "windows" && isProcessElevatedRef.current) {
          setError(
            "GreebleFS is running as Administrator, so Windows may block dragging files into normal Explorer/Desktop windows. Run GreebleFS without elevation for drag-out support.",
          );
        }
        nativeDragPathsRef.current = dragPaths;
        void commands
          .fsStartNativeFileDrag(dragPaths)
          .then((result) => {
            nativeDragPathsRef.current = [];
            unwrapTauriResult(result);
          })
          .catch((error) => {
            nativeDragPathsRef.current = [];
            const fallback = formatExplorerNativeDragError(error);
            if (runtimePlatform === "windows" && isProcessElevatedRef.current) {
              setError(
                "GreebleFS is running as Administrator, so Windows blocked native drag into a non-elevated target. Run GreebleFS without elevation for drag-out support.",
              );
              return;
            }
            setError(fallback);
          });
      }
    }
    e.dataTransfer.effectAllowed = "copyMove";
  };

  const onDragEnd = (e: React.DragEvent<HTMLElement>) => {
    const dragIntent = e.currentTarget.dataset.overlayDragIntent;
    delete e.currentTarget.dataset.overlayDragIntent;
    delete e.currentTarget.dataset.overlayDragHide;
    activeDragPathsRef.current = [];
    if (dragIntent !== "native-out") {
      nativeSameWindowDragPathsRef.current = [];
    }
    setExplorerDragOverTarget(null);
  };

  const onDragOver = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = resolveExplorerDropOperation(
      e,
      runtimePlatform,
    );
    setExplorerDragOverTarget(targetPath);
  };

  const onDragLeave = (e: React.DragEvent, targetPath: string) => {
    if (shouldIgnoreExplorerDragLeave(e)) {
      return;
    }
    e.stopPropagation();
    setDragOver((current) => {
      const next = current === targetPath ? null : current;
      dragOverRef.current = next;
      return next;
    });
  };

  const onDrop = async (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExplorerDragOverTarget(null);
    const payload = e.dataTransfer.getData("application/x-overlayterm-paths");
    let sources: string[] = [];
    if (payload) {
      try {
        sources = JSON.parse(payload) as string[];
      } catch {
        sources = [];
      }
    }
    if (sources.length === 0) {
      sources = [e.dataTransfer.getData("text/plain")].filter(Boolean);
    }
    if (sources.length === 0 && activeDragPathsRef.current.length > 0) {
      sources = [...activeDragPathsRef.current];
    }
    if (sources.length === 0 && nativeDragPathsRef.current.length > 0) {
      sources = [...nativeDragPathsRef.current];
    }
    if (sources.length === 0 && nativeSameWindowDragPathsRef.current.length > 0) {
      sources = [...nativeSameWindowDragPathsRef.current];
    }
    if (sources.length === 0) return;
    try {
      const results = await executeTransferRequest(
        {
          targetDir,
          sources,
          operation: resolveExplorerDropOperation(e, runtimePlatform),
        },
        {
          onSuccess: () => refresh(),
        },
      );
      if (results !== null) {
        activeDragPathsRef.current = [];
        nativeDragPathsRef.current = [];
        nativeSameWindowDragPathsRef.current = [];
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const effectiveModeProfile = useMemo(
    () =>
      resolveEffectiveExplorerModeProfile({
        themeOverrideModeProfileId:
          explorerSettings.modeProfileOverridesByThemeId[
            explorerChromeThemeId
          ] ?? null,
        themeDefaultModeProfileId: explorerTheme.defaultModeProfileId,
        legacyShellLayoutId: storedShellLayoutId,
      }),
    [
      explorerChromeThemeId,
      explorerSettings.modeProfileOverridesByThemeId,
      explorerTheme.defaultModeProfileId,
      storedShellLayoutId,
    ],
  );
  const effectiveChromeLayoutId = useMemo(
    () =>
      resolveExplorerModeProfileChromeLayoutId({
        modeProfile: effectiveModeProfile,
        themeChromeLayoutId: explorerTheme.chromeLayoutId,
      }),
    [effectiveModeProfile, explorerTheme.chromeLayoutId],
  );
  const persistedExplorerChromeOverride = useMemo(
    () =>
      explorerSettings.chromeLayoutOverridesByThemeId[explorerChromeThemeId]?.[
        effectiveChromeLayoutId
      ] ?? null,
    [
      effectiveChromeLayoutId,
      explorerChromeThemeId,
      explorerSettings.chromeLayoutOverridesByThemeId,
    ],
  );
  const explorerChromeOverride = useMemo(
    () =>
      chromeEditSession &&
      chromeEditSession.themeId === explorerChromeThemeId &&
      chromeEditSession.layoutId === effectiveChromeLayoutId
        ? chromeEditSession.draftOverride
        : persistedExplorerChromeOverride,
    [
      chromeEditSession,
      effectiveChromeLayoutId,
      explorerChromeThemeId,
      persistedExplorerChromeOverride,
    ],
  );
  const handleExplorerChromeControlMove = useCallback(
    (args: {
      controlId: ExplorerChromeControlId;
      targetSurfaceId: ExplorerChromeSurfaceId;
      targetZoneId: ExplorerChromeZoneId;
      targetIndex: number;
    }) => {
      if (!chromeEditSession) {
        return;
      }

      const registeredSurfaces = Object.values(
        chromeEditSession.registeredSurfaces,
      ).filter(
        (surface): surface is NonNullable<typeof surface> => surface != null,
      );
      updateChromeEditDraft(
        moveExplorerChromeControlInResolvedSurfaces({
          surfaces: registeredSurfaces,
          controlId: args.controlId,
          targetSurfaceId: args.targetSurfaceId,
          targetZoneId: args.targetZoneId,
          targetIndex: args.targetIndex,
        }),
      );
    },
    [chromeEditSession, updateChromeEditDraft],
  );
  const explorerChromeEditMode = useMemo(
    () =>
      chromeEditSession &&
      chromeEditSession.themeId === explorerChromeThemeId &&
      chromeEditSession.layoutId === effectiveChromeLayoutId
        ? {
            active: true,
            draggingControlId: chromeEditSession.draggingControlId,
            onRegisterSurface: registerChromeEditSurface,
            onUnregisterSurface: unregisterChromeEditSurface,
            onDragStart: setChromeEditDraggingControl,
            onDragEnd: () => setChromeEditDraggingControl(null),
            onMoveControl: handleExplorerChromeControlMove,
          }
        : undefined,
    [
      chromeEditSession,
      effectiveChromeLayoutId,
      explorerChromeThemeId,
      handleExplorerChromeControlMove,
      registerChromeEditSurface,
      setChromeEditDraggingControl,
      unregisterChromeEditSurface,
    ],
  );
  const beginExplorerChromeCustomization = useCallback(() => {
    openChromeEditSession({
      themeId: explorerChromeThemeId,
      layoutId: effectiveChromeLayoutId,
      initialOverride: persistedExplorerChromeOverride,
    });
  }, [
    effectiveChromeLayoutId,
    explorerChromeThemeId,
    openChromeEditSession,
    persistedExplorerChromeOverride,
  ]);
  const saveExplorerChromeCustomization = useCallback(() => {
    if (
      !chromeEditSession ||
      chromeEditSession.themeId !== explorerChromeThemeId ||
      chromeEditSession.layoutId !== effectiveChromeLayoutId
    ) {
      return;
    }

    if (chromeEditSession.draftOverride.entries.length > 0) {
      setExplorerChromeLayoutOverride(
        explorerChromeThemeId,
        effectiveChromeLayoutId,
        chromeEditSession.draftOverride,
      );
    } else {
      clearExplorerChromeLayoutOverride(
        explorerChromeThemeId,
        effectiveChromeLayoutId,
      );
    }

    closeChromeEditSession();
    setShowModeProfileMenu(false);
  }, [
    chromeEditSession,
    clearExplorerChromeLayoutOverride,
    closeChromeEditSession,
    effectiveChromeLayoutId,
    explorerChromeThemeId,
    setExplorerChromeLayoutOverride,
  ]);
  const resetExplorerChromeCustomization = useCallback(() => {
    if (!chromeEditSession) {
      return;
    }

    updateChromeEditDraft({ entries: [] });
    setChromeEditDraggingControl(null);
  }, [chromeEditSession, setChromeEditDraggingControl, updateChromeEditDraft]);
  const cancelExplorerChromeCustomization = useCallback(() => {
    closeChromeEditSession();
    setShowModeProfileMenu(false);
  }, [closeChromeEditSession]);
  useEffect(() => {
    if (
      chromeEditSession &&
      (chromeEditSession.themeId !== explorerChromeThemeId ||
        chromeEditSession.layoutId !== effectiveChromeLayoutId)
    ) {
      closeChromeEditSession();
    }
  }, [
    chromeEditSession,
    closeChromeEditSession,
    effectiveChromeLayoutId,
    explorerChromeThemeId,
  ]);
  const effectiveShellLayout = useMemo(
    () => getExplorerShellLayoutDefinition(effectiveModeProfile.paneLayoutId),
    [effectiveModeProfile.paneLayoutId],
  );
  const preferredViewMode =
    effectiveModeProfile.preferredViewMode ?? explorerTheme.preferredViewMode;
  const preferredExperimentalViewMode =
    effectiveModeProfile.preferredExperimentalViewMode ??
    explorerTheme.preferredExperimentalViewMode;
  const themedViewMode = useMemo(
    () =>
      viewMode === "details" && preferredViewMode
        ? preferredViewMode
        : viewMode,
    [preferredViewMode, viewMode],
  );
  const themedExperimentalViewMode = useMemo(
    () =>
      experimentalViewMode === "off" && preferredExperimentalViewMode
        ? preferredExperimentalViewMode
        : experimentalViewMode,
    [experimentalViewMode, preferredExperimentalViewMode],
  );
  const selectedViewModeDefinition = useMemo(
    () => getExplorerViewModeDefinition(themedViewMode),
    [themedViewMode],
  );
  const selectedExperimentalModeDefinition = useMemo(
    () =>
      themedExperimentalViewMode === "off"
        ? null
        : getExplorerExperimentalModeDefinition(themedExperimentalViewMode),
    [themedExperimentalViewMode],
  );
  const effectiveViewMode = resolveEffectiveExplorerViewMode(themedViewMode, {
    isCompactDock,
    isSearchActive,
  });
  const effectiveExperimentalViewMode = useMemo(
    () =>
      !isCompactDock && !isSearchActive && themedExperimentalViewMode !== "off"
        ? themedExperimentalViewMode
        : "off",
    [isCompactDock, isSearchActive, themedExperimentalViewMode],
  );
  const adaptiveDensityStop =
    useMemo<AdaptiveSemanticDensityStopDefinition | null>(
      () =>
        themedExperimentalViewMode === "adaptive-semantic-grid"
          ? applyExplorerThemeToAdaptiveDensityStop(
              getAdaptiveSemanticDensityStop(experimentalDensity),
              explorerTheme,
            )
          : null,
      [experimentalDensity, explorerTheme, themedExperimentalViewMode],
    );
  const experimentalDensityDescriptor = useMemo(
    () =>
      themedExperimentalViewMode === "off"
        ? null
        : getExplorerExperimentalDensityDescriptor(
            themedExperimentalViewMode,
            experimentalDensity,
          ),
    [experimentalDensity, themedExperimentalViewMode],
  );
  const effectiveViewModeDefinition = useMemo(
    () => getExplorerViewModeDefinition(effectiveViewMode),
    [effectiveViewMode],
  );
  const activeStatusViewLabel = useMemo(
    () =>
      effectiveExperimentalViewMode !== "off"
        ? (getExplorerExperimentalModeDefinition(effectiveExperimentalViewMode)
            ?.label ?? effectiveViewModeDefinition.label)
        : effectiveViewModeDefinition.label,
    [effectiveExperimentalViewMode, effectiveViewModeDefinition.label],
  );
  const activeGridMetrics = useMemo(
    () =>
      effectiveViewModeDefinition.presentation === "grid"
        ? applyExplorerThemeToGridMetrics(
            getExplorerGridMetricsForZoom(gridZoom),
            explorerTheme,
          )
        : effectiveViewModeDefinition.grid
          ? applyExplorerThemeToGridMetrics(
              effectiveViewModeDefinition.grid,
              explorerTheme,
            )
          : effectiveViewModeDefinition.grid,
    [effectiveViewModeDefinition, explorerTheme, gridZoom],
  );
  const activeRowMetrics = useMemo(
    () =>
      applyExplorerThemeToRowMetrics(
        effectiveViewModeDefinition.rows,
        explorerTheme,
      ),
    [effectiveViewModeDefinition.rows, explorerTheme],
  );
  const activeNewItemHeight =
    effectiveViewModeDefinition.presentation === "grid"
      ? (activeGridMetrics?.newItemHeight ?? EXPLORER_LIST_ROW_HEIGHT)
      : (activeRowMetrics?.newItemHeight ?? EXPLORER_LIST_ROW_HEIGHT);
  const shouldRenderRail = sourcesVisible;
  const openSourcesPanel = useCallback(() => {
    setSourcesVisible(true);
  }, []);
  const closeSourcesPanel = useCallback(() => {
    setSourcesVisible(false);
  }, []);
  const toggleSourcesPanel = useCallback(() => {
    if (shouldRenderRail) {
      closeSourcesPanel();
      return;
    }
    openSourcesPanel();
  }, [closeSourcesPanel, openSourcesPanel, shouldRenderRail]);
  const previewSplitIsPane = previewPanelVisible && previewSplitMode === "pane";
  const previewPlacement = effectiveShellLayout.previewPlacement;
  const previewModeLabel =
    preview.type === "text"
      ? preview.scriptPreview != null
        ? documentViewMode === "edit"
          ? "Script editor"
          : "Script run"
        : documentViewMode === "edit"
          ? "Text editor"
          : preview.renderKind === "markdown"
            ? "Text preview (markdown)"
            : "Text preview"
      : preview.type === "shader"
        ? documentViewMode === "edit"
          ? "Shader editor"
          : preview.selectedScene === "fullscreen"
            ? "Shader preview (fullscreen)"
            : "Shader preview (sphere)"
        : preview.type === "pdf"
          ? pdfPreviewChromeState?.isEditMode
            ? "PDF editor"
            : "PDF preview"
          : preview.type === "spreadsheet"
            ? documentViewMode === "edit"
              ? preview.fileKind === "tabular"
                ? "Tabular spreadsheet editor"
                : "Spreadsheet workbook editor"
              : preview.fileKind === "tabular"
                ? "Tabular spreadsheet preview"
                : "Spreadsheet workbook preview"
            : preview.type === "video"
              ? documentViewMode === "edit"
                ? "Video editor"
                : "Video preview"
            : preview.type === "audio"
              ? documentViewMode === "edit"
                ? "Audio editor"
                : "Audio preview"
              : preview.type === "folder"
                ? "Folder preview"
                : preview.type === "image"
                  ? documentViewMode === "edit" && isEditableImagePreviewExtension(preview.extension)
                    ? "Image editor"
                    : "Image preview"
                  : preview.type === "model3d"
                    ? "3D preview"
                    : "Preview";
  const searchModeLabel = searchIncludeContent
    ? "Recursive search + text"
    : "Recursive search (names only)";
  const gridZoomPercent = useMemo(
    () =>
      isExplorerGridMode(themedViewMode)
        ? getExplorerGridZoomPercent(gridZoom)
        : null,
    [gridZoom, themedViewMode],
  );
  const showToolbarLocationStrips =
    !isCompactDock && !usesWorkspaceCompactChrome;
  const showToolbarTextLabels = !isCompactDock && !usesWorkspaceQuadChrome;
  const usesConstellationCanvas = effectiveExperimentalViewMode === "constellation";
  const explorerFooterViewSwitcherButtons = useMemo(() => {
      const iconViewActive =
        themedExperimentalViewMode === "off" &&
        selectedViewModeDefinition.presentation === "grid";
      const listViewActive =
        themedExperimentalViewMode === "off" && themedViewMode === "list";

      return [
        {
          id: "icon-view",
          ariaLabel: "Switch explorer to icon view",
          title: "Icon view",
          active: iconViewActive,
          onClick: () =>
            updateExplorerSettings({
              experimentalViewMode: "off",
              viewMode: "icons-l",
              gridZoom: getExplorerGridZoomAnchor("icons-l"),
            }),
          icon: <LayoutGrid size={13} />,
        },
        {
          id: "list-view",
          ariaLabel: "Switch explorer to list view",
          title: "List view",
          active: listViewActive,
          onClick: () =>
            updateExplorerSettings({
              experimentalViewMode: "off",
              viewMode: "list",
            }),
          icon: <List size={13} />,
        },
        ...explorerExperimentalModes.map((mode) => {
          const active = themedExperimentalViewMode === mode.id;
          return {
            id: mode.id,
            ariaLabel: `Switch explorer to ${mode.label}`,
            title: mode.label,
            active,
            onClick: () => {
              updateExplorerSettings({
                experimentalViewMode: mode.id,
              });
              showExperimentalHud();
            },
            icon: (
              <ExplorerExperimentalGlyph
                accent={accent}
                active={active}
                mode={mode.id}
              />
            ),
          };
        }),
      ];
    }, [
      accent,
      selectedViewModeDefinition.presentation,
      showExperimentalHud,
      themedExperimentalViewMode,
      themedViewMode,
      updateExplorerSettings,
    ]);

  const showZoomHud = useCallback(() => {
    setZoomHudVisible(true);
    if (zoomHudTimerRef.current != null) {
      window.clearTimeout(zoomHudTimerRef.current);
    }
    zoomHudTimerRef.current = window.setTimeout(() => {
      setZoomHudVisible(false);
      zoomHudTimerRef.current = null;
    }, 900);
  }, []);

  const experimentalDensityPercent = useMemo(
    () =>
      themedExperimentalViewMode !== "off"
        ? getAdaptiveSemanticDensityPercent(experimentalDensity)
        : null,
    [experimentalDensity, themedExperimentalViewMode],
  );
  const constellationFieldLayout = useMemo(
    () =>
      effectiveExperimentalViewMode === "constellation"
        ? buildConstellationFieldLayout(
            experimentalSemanticBands,
            selected,
            experimentalDensity,
          )
        : null,
    [
      effectiveExperimentalViewMode,
      experimentalDensity,
      experimentalSemanticBands,
      selected,
    ],
  );
  const constellationFocusNode = useMemo(() => {
    if (!constellationFieldLayout) {
      return null;
    }
    return constellationFieldLayout.bands
      .flatMap((band) => band.nodes)
      .find((node) => selected.has(node.entry.path))
      ?? constellationFieldLayout.bands.find((band) => band.dominant)?.nodes[0]
      ?? constellationFieldLayout.bands[0]?.nodes[0]
      ?? null;
  }, [constellationFieldLayout, selected]);
  const getConstellationViewportMetrics = useCallback(() => {
    const viewport = constellationViewportRef.current;
    if (!viewport || !constellationFieldLayout) {
      return null;
    }
    const rect = viewport.getBoundingClientRect();
    const viewportWidth =
      viewport.clientWidth
      || rect.width
      || Math.min(constellationFieldLayout.width, 1280);
    const viewportHeight =
      viewport.clientHeight
      || rect.height
      || Math.min(constellationFieldLayout.height, 720);
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return null;
    }
    return {
      viewportWidth,
      viewportHeight,
    } satisfies ConstellationViewportMetrics;
  }, [constellationFieldLayout]);
  const getConstellationPreferredZoom = useCallback(
    (metrics: ConstellationViewportMetrics) => {
      if (!constellationFieldLayout) {
        return CONSTELLATION_CAMERA_ZOOM_RANGE.default;
      }
      const fitZoom = getConstellationFitZoom(constellationFieldLayout, metrics);
      return Math.max(
        fitZoom,
        Math.min(
          CONSTELLATION_CAMERA_ZOOM_RANGE.max,
          0.58 + (experimentalDensity * 0.28),
        ),
      );
    },
    [constellationFieldLayout, experimentalDensity],
  );
  const recenterConstellationCamera = useCallback(
    (mode: "fit" | "focus" = "focus") => {
      if (!constellationFieldLayout) {
        return;
      }
      const metrics = getConstellationViewportMetrics();
      if (!metrics) {
        return;
      }
      const nextCamera =
        mode === "fit" || !constellationFocusNode
          ? createConstellationFitCamera(constellationFieldLayout, metrics)
          : centerConstellationCameraOnNode(
              constellationFieldLayout,
              constellationFocusNode,
              metrics,
              getConstellationPreferredZoom(metrics),
            );
      setConstellationCamera((current) =>
        current.x === nextCamera.x
        && current.y === nextCamera.y
        && Math.abs(current.zoom - nextCamera.zoom) < 0.0001
          ? current
          : nextCamera,
      );
    },
    [
      constellationFieldLayout,
      constellationFocusNode,
      getConstellationPreferredZoom,
      getConstellationViewportMetrics,
    ],
  );
  const handleConstellationPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || !constellationFieldLayout) {
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        isEditableKeyboardTarget(target)
        || target?.closest('[data-overlay-constellation-ui="true"]')
      ) {
        return;
      }
      constellationPanGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: constellationCamera.x,
        originY: constellationCamera.y,
        targetNodePath:
          target?.closest("[data-overlay-constellation-node]")
            ?.getAttribute("data-overlay-constellation-node") ?? null,
        moved: false,
      };
    },
    [constellationCamera.x, constellationCamera.y, constellationFieldLayout],
  );
  const handleConstellationPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = constellationPanGestureRef.current;
      const metrics = getConstellationViewportMetrics();
      if (
        !gesture
        || gesture.pointerId !== event.pointerId
        || !metrics
        || !constellationFieldLayout
      ) {
        return;
      }
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      if (!gesture.moved) {
        if (Math.hypot(deltaX, deltaY) < 4) {
          return;
        }
        gesture.moved = true;
        constellationCameraUserOwnedRef.current = true;
        constellationViewportRef.current?.setPointerCapture?.(event.pointerId);
        setConstellationIsPanning(true);
      }
      event.preventDefault();
      setConstellationCamera((current) => {
        const nextPan = clampConstellationCameraPan(
          {
            x: gesture.originX + deltaX,
            y: gesture.originY + deltaY,
          },
          metrics,
          constellationFieldLayout,
          current.zoom,
        );
        return nextPan.x === current.x && nextPan.y === current.y
          ? current
          : {
              ...current,
              ...nextPan,
            };
      });
    },
    [constellationFieldLayout, getConstellationViewportMetrics],
  );
  const endConstellationPanGesture = useCallback(
    (pointerId: number | null) => {
      const gesture = constellationPanGestureRef.current;
      if (pointerId != null && gesture?.pointerId !== pointerId) {
        return;
      }
      if (
        gesture?.moved
        && gesture.targetNodePath
        && constellationSuppressClickPathRef.current !== gesture.targetNodePath
      ) {
        constellationSuppressClickPathRef.current = gesture.targetNodePath;
      }
      if (
        gesture?.pointerId != null
        && pointerId != null
        && constellationViewportRef.current?.hasPointerCapture?.(gesture.pointerId)
      ) {
        constellationViewportRef.current.releasePointerCapture(gesture.pointerId);
      }
      constellationPanGestureRef.current = null;
      setConstellationIsPanning(false);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!constellationFieldLayout || constellationPanGestureRef.current) {
      return;
    }
    const sceneKey = `${currentPath}::${effectiveExperimentalViewMode}`;
    if (constellationSceneKeyRef.current !== sceneKey) {
      constellationSceneKeyRef.current = sceneKey;
      constellationCameraUserOwnedRef.current = false;
      constellationSuppressClickPathRef.current = null;
    }

    const metrics = getConstellationViewportMetrics();
    if (!metrics) {
      return;
    }
    if (!constellationCameraUserOwnedRef.current) {
      recenterConstellationCamera("focus");
      return;
    }

    setConstellationCamera((current) => {
      const nextPan = clampConstellationCameraPan(
        current,
        metrics,
        constellationFieldLayout,
        current.zoom,
      );
      return nextPan.x === current.x && nextPan.y === current.y
        ? current
        : {
            ...current,
            ...nextPan,
          };
    });
  }, [
    constellationFieldLayout,
    currentPath,
    effectiveExperimentalViewMode,
    getConstellationViewportMetrics,
    recenterConstellationCamera,
    selected,
  ]);
  const handleConstellationWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (
        !constellationFieldLayout
        || event.ctrlKey
        || event.metaKey
        || Math.abs(event.deltaY) <= Math.abs(event.deltaX)
        || Math.abs(event.deltaY) < 2
      ) {
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        isEditableKeyboardTarget(target)
        || target?.closest('[data-overlay-constellation-ui="true"]')
      ) {
        return;
      }
      const metrics = getConstellationViewportMetrics();
      if (!metrics) {
        return;
      }
      event.preventDefault();
      constellationCameraUserOwnedRef.current = true;
      const rect = event.currentTarget.getBoundingClientRect();
      const focalPoint = {
        x: rect.width > 0 ? event.clientX - rect.left : metrics.viewportWidth / 2,
        y: rect.height > 0
          ? event.clientY - rect.top
          : metrics.viewportHeight / 2,
      };
      setConstellationCamera((current) => {
        const nextZoom = getConstellationWheelZoom(current.zoom, event.deltaY);
        if (Math.abs(nextZoom - current.zoom) < 0.0001) {
          return current;
        }
        return zoomConstellationCameraAtViewportPoint(
          current,
          nextZoom,
          focalPoint,
          metrics,
          constellationFieldLayout,
        );
      });
    },
    [constellationFieldLayout, getConstellationViewportMetrics],
  );
  const handleConstellationViewportDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest("[data-overlay-constellation-node]")
        || target?.closest('[data-overlay-constellation-ui="true"]')
      ) {
        return;
      }
      constellationCameraUserOwnedRef.current = false;
      recenterConstellationCamera("fit");
    },
    [recenterConstellationCamera],
  );
  const timelineSurfaceBands = useMemo(
    () =>
      effectiveExperimentalViewMode === "timeline-surface"
        ? buildTimelineSurfaceBands(
            visibleEntries,
            experimentalDensity,
            explorerSettings.sortBy,
            explorerSettings.sortOrder,
          )
        : [],
    [
      effectiveExperimentalViewMode,
      experimentalDensity,
      explorerSettings.sortBy,
      explorerSettings.sortOrder,
      visibleEntries,
    ],
  );
  const effectiveRailPosition = isCompactDock
    ? "left"
    : explorerTheme.railPosition;
  const idleEntrySurface = useMemo(
    () => getExplorerEntryStateSurface(explorerTheme, "idle"),
    [explorerTheme],
  );
  const selectedEntrySurface = useMemo(
    () => getExplorerEntryStateSurface(explorerTheme, "selected"),
    [explorerTheme],
  );
  const dropEntrySurface = useMemo(
    () => getExplorerEntryStateSurface(explorerTheme, "drop"),
    [explorerTheme],
  );
  const hoverEntrySurface = useMemo(
    () => getExplorerHoverSurface(explorerTheme),
    [explorerTheme],
  );
  const handleEntryPointerEnter = useCallback(
    (
      entry: FileEntry,
      target: HTMLElement,
      isSelected: boolean,
      isDropTarget: boolean,
    ) => {
      if (!isSelected && !isDropTarget) {
        applyExplorerEntrySurface(target, hoverEntrySurface);
      }
      if (
        explorerThumbnailSettings.enabled &&
        explorerThumbnailSettings.includeVideo &&
        explorerThumbnailSettings.enableVideoHoverScrub &&
        canRenderEntryThumbnail(entry) &&
        isVideoPreviewExtension(getEntryExtension(entry))
      ) {
        setHoveredVideoThumbnailPath(entry.path);
      }
    },
    [
      canRenderEntryThumbnail,
      explorerThumbnailSettings.enableVideoHoverScrub,
      explorerThumbnailSettings.enabled,
      explorerThumbnailSettings.includeVideo,
      hoverEntrySurface,
    ],
  );
  const handleEntryPointerLeave = useCallback(
    (
      entry: FileEntry,
      target: HTMLElement,
      isSelected: boolean,
      isDropTarget: boolean,
      restingSurface: ExplorerEntrySurfaceState = idleEntrySurface,
    ) => {
      if (!isSelected && !isDropTarget) {
        applyExplorerEntrySurface(target, restingSurface);
      }
      if (hoveredVideoThumbnailPath === entry.path) {
        setHoveredVideoThumbnailPath(null);
      }
    },
    [hoveredVideoThumbnailPath, idleEntrySurface],
  );
  const explorerRootStyle = useMemo<CSSProperties>(
    () => ({
      ...(explorerTheme.cssVars as CSSProperties),
      flex: 1,
      display: "flex",
      overflow: "hidden",
      background: "var(--overlay-explorer-root-bg)",
      color: EXP.text,
      fontFamily: uiFont,
      position: "relative",
      flexDirection: effectiveRailPosition === "right" ? "row-reverse" : "row",
    }),
    [effectiveRailPosition, explorerTheme.cssVars, uiFont],
  );
  const sidebarPaneStyle = useMemo<CSSProperties>(
    () => ({
      borderRight:
        effectiveRailPosition === "left"
          ? "1px solid var(--overlay-explorer-sidebar-border)"
          : "none",
      borderLeft:
        effectiveRailPosition === "right"
          ? "1px solid var(--overlay-explorer-sidebar-border)"
          : "none",
      background: "var(--overlay-explorer-sidebar-bg)",
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
    }),
    [effectiveRailPosition],
  );
  const toolbarContainerStyle = useMemo<CSSProperties>(() => {
    const usesFloatingShell =
      explorerTheme.toolbarStyle === "floating" ||
      explorerTheme.toolbarStyle === "glass";
    const usesInset =
      usesFloatingShell || explorerTheme.toolbarStyle === "minimal";
    const compactToolbarGap = usesWorkspaceQuadChrome
      ? 4
      : usesWorkspaceCompactChrome
        ? 6
        : "var(--overlay-explorer-toolbar-gap)";
    const compactToolbarPadding = usesWorkspaceQuadChrome
      ? "6px 8px"
      : usesWorkspaceCompactChrome
        ? "7px 9px"
        : "var(--overlay-explorer-toolbar-padding)";
    return {
      display: "flex",
      flexDirection: "column",
      gap: compactToolbarGap,
      padding: compactToolbarPadding,
      background:
        explorerTheme.toolbarStyle === "minimal"
          ? "transparent"
          : "var(--overlay-explorer-toolbar-bg)",
      borderTopWidth: usesFloatingShell ? 1 : 0,
      borderRightWidth: usesFloatingShell ? 1 : 0,
      borderLeftWidth: usesFloatingShell ? 1 : 0,
      borderBottomWidth:
        usesFloatingShell || explorerTheme.toolbarStyle === "minimal" ? 0 : 1,
      borderStyle:
        usesFloatingShell || explorerTheme.toolbarStyle !== "minimal"
          ? "solid"
          : "none",
      borderColor: "var(--overlay-explorer-toolbar-border)",
      borderRadius: usesFloatingShell
        ? "var(--overlay-explorer-panel-radius)"
        : 0,
      margin: usesInset
        ? usesWorkspaceCompactChrome
          ? "6px"
          : "var(--overlay-explorer-chrome-inset)"
        : 0,
      marginBottom: 0,
      boxShadow: usesFloatingShell
        ? "var(--overlay-explorer-toolbar-shadow)"
        : "none",
      backdropFilter:
        explorerBlurEnabled &&
        (explorerTheme.toolbarStyle === "glass" ||
          explorerTheme.toolbarStyle === "floating")
          ? "blur(18px)"
          : "none",
      WebkitBackdropFilter:
        explorerBlurEnabled &&
        (explorerTheme.toolbarStyle === "glass" ||
          explorerTheme.toolbarStyle === "floating")
          ? "blur(18px)"
          : "none",
      flexShrink: 0,
    };
  }, [
    explorerBlurEnabled,
    explorerTheme.toolbarStyle,
    usesWorkspaceCompactChrome,
    usesWorkspaceQuadChrome,
  ]);
  const toolbarPrimaryRowStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: usesWorkspaceQuadChrome
        ? 4
        : usesWorkspaceCompactChrome
          ? 6
          : "var(--overlay-explorer-toolbar-gap)",
      flexWrap: "wrap",
      minWidth: 0,
    }),
    [usesWorkspaceCompactChrome, usesWorkspaceQuadChrome],
  );
  const toolbarPrimaryControlsStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: usesWorkspaceQuadChrome ? 4 : 6,
      flexWrap: "wrap",
      minWidth: 0,
    }),
    [usesWorkspaceQuadChrome],
  );
  const toolbarSecondaryRowStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      justifyContent: usesWorkspaceCompactChrome ? "flex-start" : "space-between",
      gap: usesWorkspaceQuadChrome ? 4 : 8,
      flexWrap: "wrap",
      minWidth: 0,
    }),
    [usesWorkspaceCompactChrome, usesWorkspaceQuadChrome],
  );
  const toolbarSecondaryLocationGroupStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: usesWorkspaceQuadChrome ? 4 : 8,
      flex: 1,
      flexWrap: "wrap",
      minWidth: 0,
    }),
    [usesWorkspaceQuadChrome],
  );
  const toolbarSecondaryActionGroupStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: usesWorkspaceQuadChrome ? 4 : 6,
      flexWrap: "wrap",
      minWidth: 0,
    }),
    [usesWorkspaceQuadChrome],
  );
  const mainColumnStyle = useMemo<CSSProperties>(
    () => ({
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      minWidth: 0,
      overflow: "hidden",
      background: "var(--overlay-explorer-content-bg)",
    }),
    [],
  );
  const fileAreaStyle = useMemo<CSSProperties>(
    () => ({
      flex: 1,
      display: "flex",
      flexDirection: previewPlacement === "leading" ? "row-reverse" : "row",
      minHeight: 0,
      minWidth: 0,
      overflow: "hidden",
      background: "var(--overlay-explorer-content-bg)",
      gap: previewSplitIsPane ? 10 : 0,
      padding: previewSplitIsPane ? "10px" : 0,
      boxSizing: "border-box",
    }),
    [previewPlacement, previewSplitIsPane],
  );
  const contentPaneShellStyle = useMemo<CSSProperties>(
    () => ({
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "var(--overlay-explorer-content-bg)",
      ...(previewSplitIsPane
        ? {
            border: "1px solid var(--overlay-explorer-toolbar-border)",
            borderRadius: "var(--overlay-explorer-panel-radius)",
            boxShadow: "var(--overlay-explorer-toolbar-shadow)",
          }
        : {}),
    }),
    [previewSplitIsPane],
  );
  const batchRenameTargetCount = useMemo(
    () =>
      (selectedEntries.length > 0 ? selectedEntries : visibleEntries).filter(
        (entry) => !entry.is_dir,
      ).length,
    [selectedEntries, visibleEntries],
  );
  const isGlobalChromeSurfaceActive = useCallback(
    (surfaceId: ExplorerChromeSurfaceId) =>
      !isCompactDock &&
      ((surfaceId === "explorerTopbar" && showsGlobalChromeControls) ||
        (surfaceId === "explorerToolbar" && !showsGlobalChromeControls)),
    [isCompactDock, showsGlobalChromeControls],
  );
  const getExplorerChromeRowStyle = useCallback(
    (rowId: string): CSSProperties => {
      switch (rowId) {
        case "primary":
          return toolbarPrimaryRowStyle;
        case "secondary":
          return toolbarSecondaryRowStyle;
        default:
          return toolbarPrimaryRowStyle;
      }
    },
    [toolbarPrimaryRowStyle, toolbarSecondaryRowStyle],
  );
  const getExplorerChromeZoneStyle = useCallback(
    (zoneId: ExplorerChromeZoneId): CSSProperties => {
      switch (zoneId) {
        case "primaryStart":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            minWidth: 0,
          };
        case "primaryCenter":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flex: 1,
          };
        case "primaryEnd":
          return toolbarPrimaryControlsStyle;
        case "secondaryStart":
          return toolbarSecondaryLocationGroupStyle;
        case "secondaryEnd":
          return toolbarSecondaryActionGroupStyle;
        case "center":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flex: 1,
          };
        case "end":
          return {
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            flexWrap: "wrap",
            minWidth: 0,
          };
        case "start":
        default:
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            minWidth: 0,
          };
      }
    },
    [
      toolbarPrimaryControlsStyle,
      toolbarSecondaryActionGroupStyle,
      toolbarSecondaryLocationGroupStyle,
    ],
  );
  const getExplorerStatusBarRowStyle = useCallback(
    (): CSSProperties => ({
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      minWidth: 0,
      flexWrap: "nowrap",
    }),
    [],
  );
  const getExplorerStatusBarZoneStyle = useCallback(
    (zoneId: ExplorerChromeZoneId): CSSProperties => {
      switch (zoneId) {
        case "center":
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
          };
        case "end":
          return {
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            minWidth: 0,
            marginLeft: "auto",
            flexShrink: 0,
          };
        case "start":
        default:
          return {
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flexShrink: 0,
          };
      }
    },
    [],
  );
  const renderToolbarNavigationButton = useCallback(
    (input: {
      action: () => void;
      disabled: boolean;
      icon: React.ReactNode;
      title: string;
    }) => (
      <button
        type="button"
        onClick={input.action}
        disabled={input.disabled}
        title={input.title}
        style={toolbarIconButtonStyle(input.disabled)}
        onMouseEnter={(event) => {
          if (!input.disabled) {
            event.currentTarget.style.background =
              "var(--overlay-explorer-chip-active-bg)";
            event.currentTarget.style.color = EXP.text;
          }
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background =
            "var(--overlay-explorer-chip-bg)";
          event.currentTarget.style.color = input.disabled
            ? EXP.muted2
            : EXP.muted;
        }}
      >
        {input.icon}
      </button>
    ),
    [],
  );
  const explorerChromeControlRegistry = useMemo<
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
        id: "navigateBack",
        label: "Back",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () =>
          renderToolbarNavigationButton({
            action: goBack,
            disabled: historyIdx <= 0,
            icon: <ChevronLeft size={14} />,
            title: "Back",
          }),
      },
      {
        id: "navigateForward",
        label: "Forward",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () =>
          renderToolbarNavigationButton({
            action: goForward,
            disabled: historyIdx >= history.length - 1,
            icon: <ChevronRight size={14} />,
            title: "Forward",
          }),
      },
      {
        id: "navigateUp",
        label: "Up",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () =>
          renderToolbarNavigationButton({
            action: goUp,
            disabled: false,
            icon: <ArrowUp size={14} />,
            title: "Up",
          }),
      },
      {
        id: "addressBar",
        label: "Address Bar",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () => (
          <div
            onClick={() => {
              if (!addressEditing) {
                beginAddressEdit();
              }
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--overlay-explorer-omnibox-bg)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              border: "1px solid var(--overlay-explorer-omnibox-border)",
              padding: "3px 10px",
              overflow: "hidden",
              cursor: addressEditing ? "text" : "pointer",
              minWidth: 0,
            }}
          >
            {addressEditing ? (
              <input
                ref={addressInputRef}
                value={addressDraft}
                onChange={(e) => setAddressDraft(e.target.value)}
                onBlur={() => {
                  void submitAddressDraft(addressDraft);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitAddressDraft(addressDraft);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setAddressEditing(false);
                    setAddressDraft(search.trim() ? search : currentPath);
                  }
                }}
                placeholder="Search or enter path…"
                style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  outline: "none",
                  color: EXP.text,
                  fontSize: "var(--overlay-explorer-breadcrumb-font-size)",
                  minWidth: 0,
                }}
              />
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    minWidth: 0,
                    flex: 1,
                    overflow: "hidden",
                  }}
                >
                  {crumbs.length > 0 ? (
                    crumbs.map((c, i) => (
                      <React.Fragment key={c.path}>
                        {i > 0 && (
                          <ChevronRight
                            size={10}
                            style={{ color: EXP.muted2, flexShrink: 0 }}
                          />
                        )}
                        <button
                          type="button"
                          data-overlay-drop-target-path={c.path}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(c.path);
                          }}
                          onDragOver={(e) => onDragOver(e, c.path)}
                          onDragLeave={(e) => onDragLeave(e, c.path)}
                          onDrop={(e) => onDrop(e, c.path)}
                          style={{
                            border: "none",
                            cursor: "pointer",
                            color:
                              i === crumbs.length - 1 ? EXP.text : EXP.muted,
                            fontSize:
                              "var(--overlay-explorer-breadcrumb-font-size)",
                            fontWeight: i === crumbs.length - 1 ? 600 : 400,
                            padding:
                              explorerTheme.breadcrumbStyle === "plain"
                                ? "0 2px"
                                : "3px 8px",
                            borderRadius:
                              explorerTheme.breadcrumbStyle === "plain"
                                ? 4
                                : "var(--overlay-explorer-control-radius)",
                            background:
                              dragOver === c.path
                                ? "var(--overlay-explorer-chip-active-bg)"
                                : explorerTheme.breadcrumbStyle === "plain"
                                  ? "transparent"
                                  : i === crumbs.length - 1
                                    ? "var(--overlay-explorer-chip-active-bg)"
                                    : "var(--overlay-explorer-chip-bg)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            outline:
                              dragOver === c.path
                                ? `1px solid ${accent}`
                                : "none",
                          }}
                        >
                          {c.label}
                        </button>
                      </React.Fragment>
                    ))
                  ) : (
                    <span
                      style={{
                        fontSize:
                          "var(--overlay-explorer-breadcrumb-font-size)",
                        color: EXP.muted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Search or enter a path
                    </span>
                  )}
                </div>
                {isSearchActive && (
                  <>
                    <div
                      style={{
                        width: 1,
                        height: 14,
                        background: EXP.border,
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        maxWidth: isCompactDock ? 140 : 260,
                        padding: "2px 8px",
                        borderRadius: "var(--overlay-explorer-control-radius)",
                        border: "1px solid var(--overlay-explorer-chip-border)",
                        background: "var(--overlay-explorer-chip-active-bg)",
                        color: EXP.text,
                        fontSize: 10,
                        flexShrink: 0,
                        minWidth: 0,
                      }}
                    >
                      {searchLoading && (
                        <Loader
                          size={10}
                          style={{
                            color: EXP.muted2,
                            animation: "spin 1s linear infinite",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Search
                        size={10}
                        style={{ color: EXP.muted2, flexShrink: 0 }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        {search.trim()}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearSearch();
                        }}
                        title="Clear search"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: EXP.muted2,
                          padding: 0,
                          display: "flex",
                          flexShrink: 0,
                        }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ),
      },
      {
        id: "recentLocations",
        label: "Recent Locations",
        surfaces: ["explorerToolbar"],
        isVisible: () =>
          showToolbarLocationStrips && recentLocations.length > 0,
        render: () => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              minWidth: 0,
              maxWidth: isCompactDock ? 220 : 320,
              overflow: "hidden",
            }}
            title="Recent locations"
          >
            <span
              style={{
                fontSize: 10,
                color: EXP.muted2,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              Recent
            </span>
            {recentLocations.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                style={{
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-bg)",
                  color: EXP.muted,
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 10,
                  cursor: "pointer",
                  maxWidth: 96,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {getPathLeaf(path)}
              </button>
            ))}
          </div>
        ),
      },
      {
        id: "pinnedLocations",
        label: "Pinned Locations",
        surfaces: ["explorerToolbar"],
        isVisible: () =>
          showToolbarLocationStrips && pinnedLocations.length > 0,
        render: () => (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              minWidth: 0,
              maxWidth: isCompactDock ? 220 : 320,
              overflow: "hidden",
            }}
            title="Pinned locations"
          >
            <span
              style={{
                fontSize: 10,
                color: EXP.muted2,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              Pinned
            </span>
            {pinnedLocations.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                style={{
                  border: "1px solid var(--overlay-explorer-chip-border)",
                  background: "var(--overlay-explorer-chip-active-bg)",
                  color: EXP.text,
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 10,
                  cursor: "pointer",
                  maxWidth: 96,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ),
      },
      {
        id: "folderSizeSummary",
        label: "Folder Size Summary",
        surfaces: ["explorerToolbar"],
        isVisible: () =>
          showToolbarLocationStrips && Boolean(currentFolderSizeSummary),
        render: () =>
          currentFolderSizeSummary ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                minWidth: 0,
                maxWidth: isCompactDock ? 210 : 280,
                overflow: "hidden",
              }}
              title="Visible folder size summary"
            >
              <span
                style={{
                  fontSize: 10,
                  color: EXP.muted2,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                Size
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: EXP.text,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {formatSize(currentFolderSizeSummary.totalBytes)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: EXP.muted2,
                  whiteSpace: "nowrap",
                }}
              >
                {currentFolderSizeSummary.fileCount} files ·{" "}
                {currentFolderSizeSummary.folderCount} folders
              </span>
            </div>
          ) : null,
      },
      {
        id: "selectionSizeSummary",
        label: "Selection Size Summary",
        surfaces: ["explorerToolbar"],
        isVisible: () =>
          showToolbarLocationStrips &&
          Boolean(selectedSizeSummary) &&
          selected.size > 0,
        render: () =>
          selectedSizeSummary && selected.size > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
                minWidth: 0,
                maxWidth: isCompactDock ? 180 : 240,
                overflow: "hidden",
              }}
              title="Selected item size summary"
            >
              <span
                style={{
                  fontSize: 10,
                  color: EXP.muted2,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                Selected
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: EXP.text,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {formatSize(selectedSizeSummary.totalBytes)}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: EXP.muted2,
                  whiteSpace: "nowrap",
                }}
              >
                {selectedSizeSummary.count} measured
              </span>
            </div>
          ) : null,
      },
      {
        id: "pinLocation",
        label: "Pin Location",
        surfaces: ["explorerToolbar"],
        isVisible: () =>
          Boolean(currentPath) &&
          !currentPathIsCloud &&
          !usesWorkspaceCompactChrome,
        render: () => (
          <button
            type="button"
            onClick={() =>
              handleBookmarkCreated(getPathLeaf(currentPath), currentPath)
            }
            title="Pin this location to bookmarks"
            style={toolbarChipButtonStyle(false)}
          >
            <Star size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Pin
            </span>
          </button>
        ),
      },
      {
        id: "toggleSearchContent",
        label: "Toggle Search Content",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            onClick={() => {
              if (!currentPathIsCloud) {
                setSearchIncludeContent((v) => !v);
              }
            }}
            title={
              currentPathIsCloud
                ? "Cloud search is not available yet"
                : searchIncludeContent
                  ? "Include file text in search (on)"
                  : "Include file text in search (off)"
            }
            style={{
              ...toolbarToggleButtonStyle(
                searchIncludeContent,
                currentPathIsCloud,
              ),
              gap: 4,
              fontSize: "var(--overlay-explorer-toolbar-font-size)",
            }}
            onMouseEnter={(e) => {
              if (!currentPathIsCloud) {
                e.currentTarget.style.background =
                  "var(--overlay-explorer-chip-active-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!currentPathIsCloud) {
                e.currentTarget.style.background = searchIncludeContent
                  ? "var(--overlay-explorer-chip-active-bg)"
                  : "var(--overlay-explorer-chip-bg)";
              }
            }}
          >
            <span style={{ fontWeight: 700, letterSpacing: "0.02em" }}>Aa</span>
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Text
            </span>
          </button>
        ),
      },
      {
        id: "saveSearch",
        label: "Save Search",
        surfaces: ["explorerToolbar"],
        isVisible: () => !currentPathIsCloud && !usesWorkspaceQuadChrome,
        render: () => (
          <button
            type="button"
            onClick={() =>
              setSaveSearchState({
                visible: true,
                name: search.trim() || getPathLeaf(currentPath),
              })
            }
            disabled={!search.trim()}
            title="Save current search"
            style={toolbarChipButtonStyle(!search.trim())}
          >
            <Save size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Save Search
            </span>
          </button>
        ),
      },
      {
        id: "batchRename",
        label: "Batch Rename",
        surfaces: ["explorerToolbar"],
        isVisible: () => !currentPathIsCloud,
        render: () => (
          <button
            type="button"
            onClick={() =>
              setBatchRename((current) => ({
                ...current,
                visible: true,
                mode: current.mode ?? "literal",
              }))
            }
            disabled={batchRenameTargets.length === 0}
            title="Batch rename visible or selected files"
            style={toolbarChipButtonStyle(batchRenameTargets.length === 0)}
          >
            <Edit3 size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Batch Rename
            </span>
          </button>
        ),
      },
      {
        id: "tagSelection",
        label: "Tag Selection",
        surfaces: ["explorerToolbar"],
        isVisible: () => !currentPathIsCloud && !usesWorkspaceQuadChrome,
        render: () => (
          <button
            type="button"
            onClick={() =>
              openTagDialog(
                selectedEntries.map((entry) => entry.path),
                "add",
                {
                  title: "Tag Selection",
                  description: `Enter comma-separated tags to add to ${selectedEntries.length === 1 ? "the current selection" : `${selectedEntries.length} selected items`}.`,
                },
              )
            }
            disabled={selectedEntries.length === 0}
            title="Apply tags to the current selection"
            style={toolbarChipButtonStyle(selectedEntries.length === 0)}
          >
            <Tags size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Tag
            </span>
          </button>
        ),
      },
      {
        id: "duplicateScan",
        label: "Find Duplicates",
        surfaces: ["explorerToolbar"],
        isVisible: () => !currentPathIsCloud && !usesWorkspaceQuadChrome,
        render: () => (
          <button
            type="button"
            onClick={() => void startDuplicateFinder()}
            disabled={!currentPath}
            title="Scan the current folder tree for duplicates"
            style={toolbarChipButtonStyle(!currentPath)}
          >
            <Sparkles size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Duplicates
            </span>
          </button>
        ),
      },
      {
        id: "openPropertiesPanel",
        label: "Open Properties",
        surfaces: ["explorerToolbar"],
        isVisible: () => Boolean(currentPath),
        render: () => (
          <button
            type="button"
            onClick={openExplorerPropertiesForSelection}
            title={`Open the in-app ${propertiesLabel.toLowerCase()} panel`}
            style={toolbarChipButtonStyle(!currentPath)}
          >
            <Info size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              {propertiesLabel}
            </span>
          </button>
        ),
      },
      {
        id: "undoTrash",
        label: "Undo Trash",
        surfaces: ["explorerToolbar"],
        isVisible: () => !currentPathIsCloud,
        render: () => (
          <button
            type="button"
            onClick={() => void undoTrash()}
            title="Undo the most recent trash action"
            style={toolbarChipButtonStyle(false)}
          >
            <Undo2 size={11} />
            <span style={{ display: showToolbarTextLabels ? "inline" : "none" }}>
              Undo Trash
            </span>
          </button>
        ),
      },
      {
        id: "toggleSources",
        label: "Toggle Sources",
        surfaces: ["explorerToolbar", "explorerTopbar"],
        isVisible: (surfaceId) => isGlobalChromeSurfaceActive(surfaceId),
        render: () => (
          <button
            type="button"
            aria-pressed={shouldRenderRail}
            onClick={toggleSourcesPanel}
            title={
              shouldRenderRail
                ? "Hide the sources panel"
                : "Show the sources panel"
            }
            style={toolbarToggleButtonStyle(shouldRenderRail)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--overlay-explorer-chip-active-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = shouldRenderRail
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)")
            }
          >
            Sources
          </button>
        ),
      },
      {
        id: "focusAddressBar",
        label: "Focus Address Bar",
        surfaces: ["explorerToolbar", "explorerTopbar"],
        isVisible: (surfaceId) => isGlobalChromeSurfaceActive(surfaceId),
        render: () => {
          const active = addressEditing || isSearchActive;
          return (
            <button
              type="button"
              aria-pressed={active}
              onClick={focusExplorerAddressBar}
              title="Focus explorer search or path bar"
              style={toolbarToggleButtonStyle(active)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--overlay-explorer-chip-active-bg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = active
                  ? "var(--overlay-explorer-chip-active-bg)"
                  : "var(--overlay-explorer-chip-bg)")
              }
            >
              <Search size={12} />
              Search
            </button>
          );
        },
      },
      {
        id: "experimentalModes",
        label: "Experimental Modes",
        surfaces: ["explorerToolbar", "explorerTopbar"],
        isVisible: () => false,
        render: () => null,
      },
      {
        id: "shellLayout",
        label: "Explorer Mode",
        surfaces: ["explorerToolbar", "explorerTopbar"],
        isVisible: (surfaceId) =>
          !usesWorkspaceQuadChrome && isGlobalChromeSurfaceActive(surfaceId),
        render: () => (
          <div
            ref={modeProfileMenuAnchorRef}
            style={{ position: "relative" }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label={`Explorer mode: ${effectiveModeProfile.label}`}
              aria-haspopup="menu"
              aria-expanded={showModeProfileMenu}
              onClick={() => {
                setShowLayoutMenu(false);
                setShowModeProfileMenu((current) => !current);
              }}
              title={`Explorer mode: ${effectiveModeProfile.label}`}
              style={{
                ...toolbarToggleButtonStyle(showModeProfileMenu),
                color: showModeProfileMenu ? EXP.text : EXP.muted,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--overlay-explorer-chip-active-bg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = showModeProfileMenu
                  ? "var(--overlay-explorer-chip-active-bg)"
                  : "var(--overlay-explorer-chip-bg)")
              }
            >
              <ExplorerShellLayoutGlyph
                layout={effectiveShellLayout}
                accent={accent}
                active={showModeProfileMenu}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {effectiveModeProfile.shortLabel}
              </span>
            </button>
            {showModeProfileMenu && (
              <div
                role="menu"
                aria-label="Explorer modes menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 40,
                  minWidth: 280,
                  borderRadius: "var(--overlay-explorer-panel-radius)",
                  border: "1px solid var(--overlay-explorer-toolbar-border)",
                  background: "var(--overlay-explorer-toolbar-bg)",
                  boxShadow: "var(--overlay-explorer-popup-shadow-lg)",
                  padding: 8,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {explorerModeProfiles.map((modeProfile) => {
                    const active = effectiveModeProfile.id === modeProfile.id;
                    const paneLayout = getExplorerShellLayoutDefinition(
                      modeProfile.paneLayoutId,
                    );
                    return (
                      <button
                        key={modeProfile.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => applyModeProfilePreset(modeProfile)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "18px minmax(0, 1fr)",
                          gap: 10,
                          alignItems: "start",
                          width: "100%",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 10px",
                          background: active
                            ? "var(--overlay-explorer-chip-active-bg)"
                            : "transparent",
                          color: EXP.text,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background =
                              "var(--overlay-explorer-chip-bg)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            paddingTop: 1,
                          }}
                        >
                          <ExplorerShellLayoutGlyph
                            layout={paneLayout}
                            accent={accent}
                            active={active}
                          />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {modeProfile.label}
                          </span>
                          <span
                            style={{
                              display: "block",
                              marginTop: 2,
                              fontSize: 10,
                              color: EXP.muted2,
                              lineHeight: 1.35,
                            }}
                          >
                            {modeProfile.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop:
                      "1px solid var(--overlay-explorer-toolbar-border)",
                  }}
                >
                  {explorerChromeEditMode ? (
                    <>
                      <div style={{ fontSize: 10, color: EXP.muted2 }}>
                        Drag chrome controls across explorer surfaces, then save
                        the layout override for this theme.
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 8,
                        }}
                      >
                        <button
                          type="button"
                          onClick={saveExplorerChromeCustomization}
                          style={toolbarActionButtonStyle()}
                        >
                          <Save size={12} />
                          Save Layout
                        </button>
                        <button
                          type="button"
                          onClick={resetExplorerChromeCustomization}
                          style={toolbarActionButtonStyle()}
                        >
                          <RefreshCw size={12} />
                          Reset to Theme
                        </button>
                        <button
                          type="button"
                          onClick={cancelExplorerChromeCustomization}
                          style={toolbarActionButtonStyle()}
                        >
                          <X size={12} />
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 10, color: EXP.muted2 }}>
                        Modes rebalance the rail and preview panes without
                        mutating the live session shell preset.
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={beginExplorerChromeCustomization}
                          style={toolbarActionButtonStyle()}
                        >
                          <Edit3 size={12} />
                          Customize Layout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "viewLayout",
        label: "View Layout",
        surfaces: ["explorerToolbar", "explorerTopbar"],
        isVisible: (surfaceId) =>
          !usesWorkspaceQuadChrome && isGlobalChromeSurfaceActive(surfaceId),
        render: () => (
          <div
            ref={layoutMenuAnchorRef}
            style={{ position: "relative" }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label={`Explorer layout: ${selectedViewModeDefinition.label}`}
              aria-haspopup="menu"
              aria-expanded={showLayoutMenu}
              onClick={() => {
                setShowModeProfileMenu(false);
                setShowLayoutMenu((current) => !current);
              }}
              title={`Explorer layout: ${selectedViewModeDefinition.label}`}
              style={{
                ...toolbarToggleButtonStyle(showLayoutMenu),
                color: showLayoutMenu ? EXP.text : EXP.muted,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--overlay-explorer-chip-active-bg)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = showLayoutMenu
                  ? "var(--overlay-explorer-chip-active-bg)"
                  : "var(--overlay-explorer-chip-bg)")
              }
            >
              <ExplorerLayoutGlyph
                mode={selectedViewModeDefinition}
                accent={accent}
                active={showLayoutMenu}
              />
              <span
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {selectedViewModeDefinition.shortLabel}
                </span>
                {gridZoomPercent != null && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: showLayoutMenu ? EXP.text : EXP.muted2,
                    }}
                  >
                    {gridZoomPercent}%
                  </span>
                )}
              </span>
            </button>
            {zoomHudVisible && gridZoomPercent != null && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 45,
                  minWidth: 148,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: `1px solid ${accent}55`,
                  background: "var(--overlay-explorer-popup-bg)",
                  boxShadow: "var(--overlay-explorer-popup-shadow)",
                  backdropFilter: explorerBlurEnabled ? "blur(10px)" : "none",
                  WebkitBackdropFilter: explorerBlurEnabled
                    ? "blur(10px)"
                    : "none",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: EXP.text,
                    }}
                  >
                    {selectedViewModeDefinition.shortLabel}
                  </span>
                  <span
                    style={{ fontSize: 10, fontWeight: 700, color: accent }}
                  >
                    {gridZoomPercent}%
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    height: 5,
                    borderRadius: 999,
                    background: "var(--overlay-explorer-popup-item-hover-bg)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${gridZoomPercent}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                      transition: "width 0.14s ease",
                    }}
                  />
                </div>
              </div>
            )}
            {showLayoutMenu && (
              <div
                role="menu"
                aria-label="Explorer layout menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 40,
                  minWidth: 240,
                  borderRadius: "var(--overlay-explorer-panel-radius)",
                  border: "1px solid var(--overlay-explorer-toolbar-border)",
                  background: "var(--overlay-explorer-toolbar-bg)",
                  boxShadow: "var(--overlay-explorer-popup-shadow-lg)",
                  padding: 8,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {explorerViewModes.map((mode) => {
                    const active = themedViewMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          updateExplorerSettings(
                            isExplorerGridMode(mode.id)
                              ? {
                                  viewMode: mode.id,
                                  gridZoom: getExplorerGridZoomAnchor(mode.id),
                                }
                              : { viewMode: mode.id },
                          );
                          showZoomHud();
                          setShowLayoutMenu(false);
                        }}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "18px minmax(0, 1fr)",
                          gap: 10,
                          alignItems: "start",
                          width: "100%",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 10px",
                          background: active
                            ? "var(--overlay-explorer-chip-active-bg)"
                            : "transparent",
                          color: active ? EXP.text : EXP.muted,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background =
                              "var(--overlay-explorer-chip-bg)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <span
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            paddingTop: 1,
                          }}
                        >
                          <ExplorerLayoutGlyph
                            mode={mode}
                            accent={accent}
                            active={active}
                          />
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              fontWeight: 600,
                              color: active ? EXP.text : EXP.text,
                            }}
                          >
                            {mode.label}
                          </span>
                          <span
                            style={{
                              display: "block",
                              marginTop: 2,
                              fontSize: 10,
                              color: EXP.muted2,
                              lineHeight: 1.35,
                            }}
                          >
                            {mode.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop:
                      "1px solid var(--overlay-explorer-toolbar-border)",
                    fontSize: 10,
                    color: EXP.muted2,
                  }}
                >
                  Ctrl/Cmd + wheel moves through Small, M, L, XL, then row
                  layouts with live zoom feedback.
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "togglePreview",
        label: "Toggle Preview",
        surfaces: ["explorerToolbar", "explorerTopbar"],
        isVisible: (surfaceId) =>
          !usesWorkspaceCompactChrome &&
          isGlobalChromeSurfaceActive(surfaceId),
        render: () => (
          <button
            type="button"
            aria-pressed={previewEnabled}
            onClick={togglePreviewEnabled}
            title={
              previewEnabled
                ? "Turn off inline preview for previewable files"
                : "Turn on inline preview for previewable files"
            }
            style={toolbarToggleButtonStyle(previewEnabled)}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--overlay-explorer-chip-active-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = previewEnabled
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)")
            }
          >
            <Eye size={12} />
            {showToolbarTextLabels ? "Preview" : "P"}
          </button>
        ),
      },
      {
        id: "toggleHiddenFiles",
        label: "Toggle Hidden Files",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            onClick={() =>
              updateExplorerSettings({ showHiddenFiles: !showHidden })
            }
            title="Toggle hidden files"
            style={{
              ...toolbarIconButtonStyle(),
              background: showHidden
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)",
              color: showHidden
                ? "var(--overlay-explorer-chip-active-text)"
                : EXP.muted,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--overlay-explorer-chip-active-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = showHidden
                ? "var(--overlay-explorer-chip-active-bg)"
                : "var(--overlay-explorer-chip-bg)")
            }
          >
            <Eye size={14} />
          </button>
        ),
      },
      {
        id: "refresh",
        label: "Refresh",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            onClick={refresh}
            title="Refresh (F5)"
            style={toolbarIconButtonStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--overlay-explorer-chip-active-bg)";
              e.currentTarget.style.color = EXP.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "var(--overlay-explorer-chip-bg)";
              e.currentTarget.style.color = EXP.muted;
            }}
          >
            <RefreshCw size={14} />
          </button>
        ),
      },
      {
        id: "newFolder",
        label: "New Folder",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            onClick={() => openNew("folder")}
            title="New Folder"
            style={toolbarActionButtonStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--overlay-explorer-chip-active-bg)";
              e.currentTarget.style.color = EXP.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "var(--overlay-explorer-chip-bg)";
              e.currentTarget.style.color = EXP.muted;
            }}
          >
            <FolderPlus size={13} />
            Folder
          </button>
        ),
      },
      {
        id: "newFile",
        label: "New File",
        surfaces: ["explorerToolbar"],
        isVisible: () => true,
        render: () => (
          <button
            type="button"
            onClick={() => openNew("file")}
            title="New File"
            style={toolbarActionButtonStyle()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--overlay-explorer-chip-active-bg)";
              e.currentTarget.style.color = EXP.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "var(--overlay-explorer-chip-bg)";
              e.currentTarget.style.color = EXP.muted;
            }}
          >
            <FilePlus size={13} />
            File
          </button>
        ),
      },
      {
        id: "pasteClipboard",
        label: "Paste Clipboard",
        surfaces: ["explorerToolbar"],
        isVisible: () => Boolean(clipboard),
        render: () =>
          clipboard ? (
            <button
              type="button"
              onClick={paste}
              title={`Paste ${clipboard.entries.length} item${clipboard.entries.length === 1 ? "" : "s"} (Ctrl+V)`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "var(--overlay-explorer-chip-active-bg)",
                border: "1px solid var(--overlay-explorer-chip-active-border)",
                borderRadius: "var(--overlay-explorer-control-radius)",
                cursor: "pointer",
                color: "var(--overlay-explorer-chip-active-text)",
                padding: "3px 8px",
                fontSize: "var(--overlay-explorer-toolbar-font-size)",
              }}
            >
              <Clipboard size={12} />
              Paste{" "}
              {clipboard.entries.length > 1 ? clipboard.entries.length : ""}
            </button>
          ) : null,
      },
      {
        id: "statusItemCount",
        label: "Status Item Count",
        surfaces: ["explorerStatusBar"],
        isVisible: () => true,
        render: () => (
          <span>
            {filteredEntryCount} item{filteredEntryCount !== 1 ? "s" : ""}
            {sourceEntryCount !== filteredEntryCount && (
              <span style={{ color: EXP.muted2 }}>
                {` of ${sourceEntryCount}`}
              </span>
            )}
          </span>
        ),
      },
      {
        id: "statusSelectionSummary",
        label: "Status Selection Summary",
        surfaces: ["explorerStatusBar"],
        isVisible: () => selected.size > 0,
        render: () => (
          <span style={{ color: accent }}>{selected.size} selected</span>
        ),
      },
      {
        id: "statusModeProfile",
        label: "Status Mode Profile",
        surfaces: ["explorerStatusBar"],
        isVisible: () => !isCompactDock,
        render: () => (
          <span>
            Mode:{" "}
            <span style={{ color: EXP.text }}>
              {effectiveModeProfile.label}
            </span>
          </span>
        ),
      },
      {
        id: "statusViewSummary",
        label: "Status View Summary",
        surfaces: ["explorerStatusBar"],
        isVisible: () => !isCompactDock,
        render: () => (
          <span>
            View:{" "}
            <span style={{ color: EXP.text }}>{activeStatusViewLabel}</span>
          </span>
        ),
      },
      {
        id: "statusViewToggles",
        label: "Status View Toggles",
        surfaces: ["explorerStatusBar"],
        isVisible: () => !isCompactDock,
        render: () => {
          const footerViewSwitcherHostStyle: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 3,
            borderRadius: 999,
            border: "1px solid var(--overlay-explorer-chip-border)",
            background: "rgba(255,255,255,0.03)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          };

          const buildFooterViewSwitcherButtonStyle = (
            active: boolean,
          ): CSSProperties => ({
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 8,
            border: `1px solid ${active ? `${accent}66` : "transparent"}`,
            background: active
              ? "var(--overlay-explorer-chip-active-bg)"
              : "transparent",
            color: active ? EXP.text : EXP.muted,
            cursor: "pointer",
            transition:
              "background 0.14s ease, border-color 0.14s ease, color 0.14s ease",
          });

          return (
            <div style={{ position: "relative" }}>
              {experimentalHudVisible &&
                selectedExperimentalModeDefinition &&
                experimentalDensityPercent != null && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: "calc(100% + 8px)",
                      zIndex: 45,
                      minWidth: 168,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: `1px solid ${accent}55`,
                      background: "var(--overlay-explorer-popup-bg)",
                      boxShadow: "var(--overlay-explorer-popup-shadow)",
                      backdropFilter: explorerBlurEnabled
                        ? "blur(10px)"
                        : "none",
                      WebkitBackdropFilter: explorerBlurEnabled
                        ? "blur(10px)"
                        : "none",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: EXP.text,
                        }}
                      >
                        {experimentalDensityDescriptor?.shortLabel ??
                          selectedExperimentalModeDefinition.shortLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: accent,
                        }}
                      >
                        {experimentalDensityPercent}%
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        height: 5,
                        borderRadius: 999,
                        background:
                          "var(--overlay-explorer-popup-item-hover-bg)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${experimentalDensityPercent}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                          transition: "width 0.14s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              <div
                role="group"
                aria-label="Explorer footer view switcher"
                style={footerViewSwitcherHostStyle}
              >
                {explorerFooterViewSwitcherButtons.map((button) => (
                  <button
                    key={button.id}
                    type="button"
                    aria-label={button.ariaLabel}
                    aria-pressed={button.active}
                    title={button.title}
                    onClick={button.onClick}
                    data-overlay-explorer-view-switch={button.id}
                    style={buildFooterViewSwitcherButtonStyle(button.active)}
                  >
                    {button.icon}
                  </button>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        id: "statusPreviewSummary",
        label: "Status Preview Summary",
        surfaces: ["explorerStatusBar"],
        isVisible: () => !isCompactDock,
        render: () => (
          <span>
            Preview:{" "}
            <span style={{ color: previewEnabled ? accent : EXP.text }}>
              {previewEnabled ? "On" : "Off"}
            </span>
            {previewLocked && <span style={{ color: EXP.muted2 }}> · Locked</span>}
            {hasPreview && (
              <span
                style={{ color: EXP.muted2 }}
              >{` · ${previewModeLabel}: ${getPathLeaf(preview.path)}`}</span>
            )}
          </span>
        ),
      },
      {
        id: "statusLabsSummary",
        label: "Status Labs Summary",
        surfaces: ["explorerStatusBar"],
        isVisible: () => false,
        render: () => null,
      },
      {
        id: "statusSearchSummary",
        label: "Status Search Summary",
        surfaces: ["explorerStatusBar"],
        isVisible: () => Boolean(search),
        render: () =>
          search ? (
            <span>
              {searchModeLabel}:{" "}
              <span style={{ color: EXP.text }}>&quot;{search}&quot;</span>
              <span style={{ color: EXP.muted2 }}>
                {searchLoading
                  ? " · searching…"
                  : ` · ${filteredEntryCount} result${filteredEntryCount === 1 ? "" : "s"}`}
              </span>
              {activeTagFilterIds.length > 0 &&
                sourceEntryCount !== filteredEntryCount && (
                  <span
                    style={{ color: EXP.muted2 }}
                  >{` · ${sourceEntryCount - filteredEntryCount} hidden by tags`}</span>
                )}
            </span>
          ) : null,
      },
      {
        id: "statusTaskBadge",
        label: "Status Task Badge",
        surfaces: ["explorerStatusBar"],
        isVisible: () => false,
        render: () => null,
      },
      {
        id: "statusClipboardQueue",
        label: "Status Clipboard Queue",
        surfaces: ["explorerStatusBar"],
        isVisible: () => Boolean(clipboard),
        render: () =>
          clipboard ? (
            <span style={{ color: EXP.muted2 }}>
              {clipboard.action === "copy" ? "Copy" : "Move"} queue:{" "}
              {clipboard.entries[0]?.name}
              {clipboard.entries.length > 1
                ? ` +${clipboard.entries.length - 1} more`
                : ""}{" "}
              — ready (Ctrl+V)
            </span>
          ) : null,
      },
      {
        id: "statusPreviewLoading",
        label: "Status Preview Loading",
        surfaces: ["explorerStatusBar"],
        isVisible: () => previewLoading,
        render: () =>
          previewLoading ? (
            <span
              style={{
                color: accent,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Loader
                size={9}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Loading…
            </span>
          ) : null,
      },
    ],
    [
      accent,
      activeStatusViewLabel,
      addressDraft,
      addressEditing,
      applyModeProfilePreset,
      applyTagsToPaths,
      batchRenameTargetCount,
      beginExplorerChromeCustomization,
      beginAddressEdit,
      cancelExplorerChromeCustomization,
      clearSearch,
      clipboard,
      crumbs,
      currentFolderSizeSummary,
      currentPath,
      currentPathIsCloud,
      experimentalDensityDescriptor,
      experimentalDensityPercent,
      explorerTheme.breadcrumbStyle,
      effectiveChromeLayoutId,
      effectiveModeProfile,
      effectiveShellLayout,
      explorerFooterViewSwitcherButtons,
      focusExplorerAddressBar,
      goBack,
      goForward,
      goUp,
      gridZoomPercent,
      handleBookmarkCreated,
      history.length,
      historyIdx,
      isCompactDock,
      isGlobalChromeSurfaceActive,
      isSearchActive,
      navigate,
      openNew,
      openTagDialog,
      paste,
      pinnedLocations,
      previewEnabled,
      previewLoading,
      previewLocked,
      previewModeLabel,
      recentLocations,
      refresh,
      resetExplorerChromeCustomization,
      saveExplorerChromeCustomization,
      search,
      searchIncludeContent,
      searchLoading,
      selected.size,
      selectedEntries,
      selectedExperimentalModeDefinition,
      selectedSizeSummary,
      setAddressDraft,
      setAddressEditing,
      setBatchRename,
      setSaveSearchState,
      setSearchIncludeContent,
      setShowLayoutMenu,
      setShowModeProfileMenu,
      showExperimentalHud,
      showModeProfileMenu,
      showLayoutMenu,
      showToolbarLocationStrips,
      showToolbarTextLabels,
      showZoomHud,
      startDuplicateFinder,
      submitAddressDraft,
      toggleSourcesPanel,
      shouldRenderRail,
      togglePreviewEnabled,
      undoTrash,
      updateExplorerSettings,
      visibleEntries,
      zoomHudVisible,
      explorerBlurEnabled,
      explorerChromeEditMode,
      filteredEntryCount,
      hasPreview,
      isCompactDock,
      preview,
      searchModeLabel,
      sourceEntryCount,
      usesWorkspaceCompactChrome,
      usesWorkspaceQuadChrome,
    ],
  );
  const explorerChromeControlRegistryById = useMemo(
    () =>
      new Map(explorerChromeControlRegistry.map((entry) => [entry.id, entry])),
    [explorerChromeControlRegistry],
  );
  const explorerTopbarSurface = useMemo(
    () =>
      resolveExplorerChromeSurfaceLayout({
        layoutId: effectiveChromeLayoutId,
        surfaceId: "explorerTopbar",
        controlDefinitions: explorerChromeControlRegistry,
        override: explorerChromeOverride,
        isControlVisible: (controlId, surfaceId) =>
          explorerChromeControlRegistryById
            .get(controlId)
            ?.isVisible(surfaceId) ?? false,
      }),
    [
      explorerChromeControlRegistry,
      explorerChromeControlRegistryById,
      effectiveChromeLayoutId,
      explorerChromeOverride,
    ],
  );
  const explorerToolbarSurface = useMemo(
    () =>
      resolveExplorerChromeSurfaceLayout({
        layoutId: effectiveChromeLayoutId,
        surfaceId: "explorerToolbar",
        controlDefinitions: explorerChromeControlRegistry,
        override: explorerChromeOverride,
        isControlVisible: (controlId, surfaceId) =>
          explorerChromeControlRegistryById
            .get(controlId)
            ?.isVisible(surfaceId) ?? false,
      }),
    [
      explorerChromeControlRegistry,
      explorerChromeControlRegistryById,
      effectiveChromeLayoutId,
      explorerChromeOverride,
    ],
  );
  const explorerStatusBarSurface = useMemo(
    () =>
      resolveExplorerChromeSurfaceLayout({
        layoutId: effectiveChromeLayoutId,
        surfaceId: "explorerStatusBar",
        controlDefinitions: explorerChromeControlRegistry,
        override: explorerChromeOverride,
        isControlVisible: (controlId, surfaceId) =>
          explorerChromeControlRegistryById
            .get(controlId)
            ?.isVisible(surfaceId) ?? false,
      }),
    [
      explorerChromeControlRegistry,
      explorerChromeControlRegistryById,
      effectiveChromeLayoutId,
      explorerChromeOverride,
    ],
  );
  const renderExplorerChromeControl = useCallback(
    (placement: ExplorerChromeResolvedControlPlacement) =>
      explorerChromeControlRegistryById
        .get(placement.controlId)
        ?.render(placement) ?? null,
    [explorerChromeControlRegistryById],
  );
  const shouldRenderStatusBar =
    !usesWorkspaceCompactChrome &&
    explorerTheme.statusBarStyle !== "hidden";
  const statusBarStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "3px 12px",
      background: "var(--overlay-explorer-status-bg)",
      borderTop: "1px solid var(--overlay-explorer-status-border)",
      fontSize: "var(--overlay-explorer-status-font-size)",
      color: EXP.muted,
      flexShrink: 0,
      position: "relative",
      margin:
        explorerTheme.statusBarStyle === "floating"
          ? "0 var(--overlay-explorer-chrome-inset) var(--overlay-explorer-chrome-inset)"
          : 0,
      borderRadius:
        explorerTheme.statusBarStyle === "floating"
          ? "var(--overlay-explorer-panel-radius)"
          : 0,
      boxShadow:
        explorerTheme.statusBarStyle === "floating"
          ? "var(--overlay-explorer-toolbar-shadow)"
          : "none",
      backdropFilter:
        explorerBlurEnabled && explorerTheme.statusBarStyle === "floating"
          ? "blur(18px)"
          : "none",
      WebkitBackdropFilter:
        explorerBlurEnabled && explorerTheme.statusBarStyle === "floating"
          ? "blur(18px)"
          : "none",
    }),
    [
      explorerBlurEnabled,
      explorerTheme.statusBarStyle,
    ],
  );

  useEffect(
    () => () => {
      if (zoomHudTimerRef.current != null) {
        window.clearTimeout(zoomHudTimerRef.current);
      }
      if (experimentalHudTimerRef.current != null) {
        window.clearTimeout(experimentalHudTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const viewport = explorerViewportRef.current;
    if (!viewport) {
      return;
    }

    let rafId = 0;
    const updateScrollTop = () => {
      rafId = 0;
      syncExplorerViewportScrollTop(viewport);
    };

    const scheduleScrollUpdate = () => {
      if (rafId !== 0) {
        return;
      }
      rafId = window.requestAnimationFrame(updateScrollTop);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncExplorerViewportSize(viewport);
          })
        : null;

    resizeObserver?.observe(viewport);
    viewport.addEventListener("scroll", scheduleScrollUpdate, {
      passive: true,
    });
    syncExplorerViewportSize(viewport);
    syncExplorerViewportScrollTop(viewport);

    return () => {
      viewport.removeEventListener("scroll", scheduleScrollUpdate);
      resizeObserver?.disconnect();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [syncExplorerViewportScrollTop, syncExplorerViewportSize]);

  const handleExplorerLayoutWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (isCompactDock || !(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      if (
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        Math.abs(event.deltaY) < 6
      ) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-overlay-explorer-plane="preview"]')) {
        return;
      }
      if (
        !target?.closest(
          '[data-overlay-explorer-plane="file-area"], [data-overlay-explorer-plane="content-viewport"], .overlay-scroll-area__viewport, .overlay-scroll-area__content',
        )
      ) {
        return;
      }

      event.preventDefault();
      layoutWheelDeltaAccumulatorRef.current += event.deltaY;
      const accumulatedDelta = layoutWheelDeltaAccumulatorRef.current;
      const stepCount = Math.min(
        3,
        Math.floor(
          Math.abs(accumulatedDelta) / EXPLORER_LAYOUT_WHEEL_STEP_DELTA,
        ),
      );
      if (stepCount <= 0) {
        return;
      }

      const direction = accumulatedDelta < 0 ? "larger" : "smaller";
      layoutWheelDeltaAccumulatorRef.current -=
        Math.sign(accumulatedDelta) *
        stepCount *
        EXPLORER_LAYOUT_WHEEL_STEP_DELTA;

      if (effectiveExperimentalViewMode !== "off") {
        let nextDensity = experimentalDensity;
        for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
          const steppedDensity = stepAdaptiveSemanticDensity(
            nextDensity,
            direction,
          );
          if (steppedDensity === nextDensity) {
            break;
          }
          nextDensity = steppedDensity;
        }

        if (nextDensity !== experimentalDensity) {
          updateExplorerSettings({ experimentalDensity: nextDensity });
          showExperimentalHud();
        }
        return;
      }

      let nextMode = themedViewMode;
      let nextGridZoom = gridZoom;

      for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
        if (isExplorerGridMode(nextMode)) {
          const steppedZoom = stepExplorerGridZoom(nextGridZoom, direction);
          if (steppedZoom !== nextGridZoom) {
            nextGridZoom = steppedZoom;
            nextMode = getAdjacentExplorerGridMode(nextMode, direction);
            continue;
          }
        }

        const steppedMode = stepExplorerViewMode(nextMode, direction);
        if (steppedMode === nextMode) {
          break;
        }
        nextMode = steppedMode;
        if (isExplorerGridMode(nextMode)) {
          nextGridZoom = getExplorerGridZoomAnchor(nextMode);
        }
      }

      if (nextMode !== themedViewMode || nextGridZoom !== gridZoom) {
        updateExplorerSettings(
          isExplorerGridMode(nextMode)
            ? { viewMode: nextMode, gridZoom: nextGridZoom }
            : { viewMode: nextMode },
        );
        showZoomHud();
      }
    },
    [
      effectiveExperimentalViewMode,
      experimentalDensity,
      gridZoom,
      isCompactDock,
      showExperimentalHud,
      showZoomHud,
      themedViewMode,
      updateExplorerSettings,
    ],
  );

  useEffect(() => {
    if (repositoryPicker?.active) {
      if (previewWarmupTimerRef.current != null) {
        window.clearTimeout(previewWarmupTimerRef.current);
        previewWarmupTimerRef.current = null;
      }
      previewWarmupStartedRef.current = false;
      return;
    }

    if (previewWarmupStartedRef.current) {
      return;
    }

    previewWarmupStartedRef.current = true;
    previewWarmupTimerRef.current = window.setTimeout(() => {
      void import("@monaco-editor/react");
      void import("./documentPreview");
      void import("./ModelPreview");
    }, 1200);

    return () => {
      if (previewWarmupTimerRef.current != null) {
        window.clearTimeout(previewWarmupTimerRef.current);
        previewWarmupTimerRef.current = null;
      }
      previewWarmupStartedRef.current = false;
    };
  }, [repositoryPicker?.active]);
  const virtualizedViewportWidth = explorerViewportMetrics.clientWidth;
  const measuredVirtualizedViewportHeight = explorerViewportMetrics.clientHeight;
  const hasMeasuredExplorerViewportHeight =
    measuredVirtualizedViewportHeight > 0;
  const minimumVirtualizedViewportHeight =
    effectiveViewModeDefinition.presentation === "grid"
      ? (isSearchActive
          ? activeGridMetrics?.searchRowHeight
          : activeGridMetrics?.rowHeight) ?? EXPLORER_LIST_ROW_HEIGHT
      : (isSearchActive
          ? activeRowMetrics?.searchRowHeight
          : activeRowMetrics?.rowHeight) ?? EXPLORER_LIST_ROW_HEIGHT;
  const virtualizedViewportHeight = Math.max(
    measuredVirtualizedViewportHeight,
    minimumVirtualizedViewportHeight,
  );
  const virtualizedScrollTop = Math.max(
    0,
    explorerViewportMetrics.scrollTop -
      (newItem.visible ? activeNewItemHeight : 0),
  );

  const virtualWindow = useMemo(() => {
    if (
      effectiveViewModeDefinition.presentation === "grid" &&
      activeGridMetrics
    ) {
      const availableWidth = Math.max(
        0,
        virtualizedViewportWidth - activeGridMetrics.padding * 2,
      );
      const columns = Math.max(
        1,
        Math.floor(
          (availableWidth + activeGridMetrics.gap) /
            (activeGridMetrics.minWidth + activeGridMetrics.gap),
        ),
      );
      const rowHeight = isSearchActive
        ? activeGridMetrics.searchRowHeight
        : activeGridMetrics.rowHeight;
      const rowAdvance = rowHeight + activeGridMetrics.gap;
      const totalRows = Math.ceil(visibleEntries.length / columns);
      const contentHeight =
        totalRows * rowHeight +
        Math.max(0, totalRows - 1) * activeGridMetrics.gap;
      const maxScrollTop = Math.max(
        0,
        contentHeight - virtualizedViewportHeight,
      );
      if (!hasMeasuredExplorerViewportHeight) {
        return {
          kind: "grid" as const,
          columns,
          rowHeight,
          contentHeight,
          maxScrollTop,
          startRow: 0,
          endRow: totalRows,
          startIndex: 0,
          endIndex: visibleEntries.length,
          topSpacer: 0,
          bottomSpacer: 0,
        };
      }
      const clampedScrollTop = Math.min(virtualizedScrollTop, maxScrollTop);
      const startRow = Math.max(
        0,
        Math.floor(clampedScrollTop / rowAdvance) - EXPLORER_GRID_OVERSCAN_ROWS,
      );
      const endRow = Math.min(
        totalRows,
        Math.ceil((clampedScrollTop + virtualizedViewportHeight) / rowAdvance) +
          EXPLORER_GRID_OVERSCAN_ROWS,
      );
      const safeEndRow = Math.max(startRow, endRow);
      const startIndex = Math.min(visibleEntries.length, startRow * columns);
      const endIndex = Math.max(
        startIndex,
        Math.min(visibleEntries.length, safeEndRow * columns),
      );

      return {
        kind: "grid" as const,
        columns,
        rowHeight,
        contentHeight,
        maxScrollTop,
        startRow,
        endRow: safeEndRow,
        startIndex,
        endIndex,
        topSpacer: startRow * rowAdvance,
        bottomSpacer: Math.max(0, totalRows - safeEndRow) * rowAdvance,
      };
    }

    const rowHeight = isSearchActive
      ? (activeRowMetrics?.searchRowHeight ?? EXPLORER_LIST_SEARCH_ROW_HEIGHT)
      : (activeRowMetrics?.rowHeight ?? EXPLORER_LIST_ROW_HEIGHT);
    const totalRows = visibleEntries.length;
    const contentHeight = totalRows * rowHeight;
    const maxScrollTop = Math.max(0, contentHeight - virtualizedViewportHeight);
    if (!hasMeasuredExplorerViewportHeight) {
      return {
        kind: "list" as const,
        rowHeight,
        contentHeight,
        maxScrollTop,
        startRow: 0,
        endRow: totalRows,
        startIndex: 0,
        endIndex: visibleEntries.length,
        topSpacer: 0,
        bottomSpacer: 0,
      };
    }
    const clampedScrollTop = Math.min(virtualizedScrollTop, maxScrollTop);
    const startRow = Math.max(
      0,
      Math.floor(clampedScrollTop / rowHeight) - EXPLORER_LIST_OVERSCAN,
    );
    const endRow = Math.min(
      totalRows,
      Math.ceil((clampedScrollTop + virtualizedViewportHeight) / rowHeight) +
        EXPLORER_LIST_OVERSCAN,
    );
    const safeEndRow = Math.max(startRow, endRow);

    return {
      kind: "list" as const,
      rowHeight,
      contentHeight,
      maxScrollTop,
      startRow,
      endRow: safeEndRow,
      startIndex: startRow,
      endIndex: Math.max(startRow, safeEndRow),
      topSpacer: startRow * rowHeight,
      bottomSpacer: Math.max(0, totalRows - safeEndRow) * rowHeight,
    };
  }, [
    effectiveViewMode,
    effectiveViewModeDefinition.presentation,
    activeGridMetrics,
    activeRowMetrics,
    hasMeasuredExplorerViewportHeight,
    isSearchActive,
    virtualizedScrollTop,
    virtualizedViewportHeight,
    virtualizedViewportWidth,
    visibleEntries.length,
  ]);

  const virtualizedEntries = useMemo(
    () =>
      visibleEntries.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [virtualWindow.endIndex, virtualWindow.startIndex, visibleEntries],
  );
  const deferredVirtualizedEntries = useDeferredValue(virtualizedEntries);

  // ── Keyboard ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        rename.active ||
        newItem.visible ||
        addressEditing ||
        propertiesPanel.visible
      ) {
        if (propertiesPanel.visible && e.key === "Escape") {
          e.preventDefault();
          setPropertiesPanel(null);
        }
        return;
      }
      if (isEditableKeyboardTarget(e.target)) return;

      const isExplorerFocus = document.activeElement === mainRef.current;
      const selectedEntry =
        (lastSelected.current
          ? (visibleEntryLookup.get(lastSelected.current) ?? null)
          : null) ??
        (() => {
          for (const path of selected) {
            const entry = visibleEntryLookup.get(path);
            if (entry) {
              return entry;
            }
          }
          return null;
        })();
      const currentFocusIndex = (() => {
        if (lastSelected.current) {
          const rememberedIndex = visibleEntryIndexLookup.get(
            lastSelected.current,
          );
          if (rememberedIndex != null) return rememberedIndex;
        }
        for (const path of selected) {
          const selectedIndex = visibleEntryIndexLookup.get(path);
          if (selectedIndex != null) {
            return selectedIndex;
          }
        }
        return 0;
      })();

      if (
        matchesKeybinding(e, keybindings.calculateRecursiveSize) &&
        isExplorerFocus
      ) {
        e.preventDefault();
        void runRecursiveSizeCalculation();
        return;
      }

      const activeElement = document.activeElement;
      const isTypingInEmbeddedEditor =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement instanceof HTMLElement
          ? activeElement.isContentEditable ||
            activeElement.closest(".monaco-editor") != null
          : false;

      if (
        preview.type === "audio" &&
        !isTypingInEmbeddedEditor &&
        matchesKeybinding(e, keybindings.audioWorkbenchToggleEditMode)
      ) {
        e.preventDefault();
        setDocumentViewMode((current) =>
          current === "edit" ? "preview" : "edit",
        );
        return;
      }

      if (jumpFilter.active && e.key === "Escape") {
        e.preventDefault();
        setJumpFilter(null);
        return;
      }

      if (isExplorerFocus && isExplorerJumpFilterPrintableKey(e)) {
        e.preventDefault();
        updateJumpFilterQuery(
          appendExplorerJumpFilterCharacter(jumpFilter.query, e.key),
        );
        return;
      }

      if (jumpFilter.active && e.key === "Backspace") {
        e.preventDefault();
        const nextQuery = removeExplorerJumpFilterCharacter(jumpFilter.query);
        if (!nextQuery) {
          setJumpFilter(null);
        } else {
          updateJumpFilterQuery(nextQuery);
        }
        return;
      }

      if (
        jumpFilter.active &&
        (e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        e.preventDefault();
        moveJumpFilterSelection(
          e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 1,
        );
        return;
      }

      if (jumpFilter.active && e.key === "Enter") {
        e.preventDefault();
        const activeJumpPath =
          jumpFilter.resultPaths[jumpFilter.resultIndex] ??
          jumpFilter.resultPaths[0] ??
          null;
        const targetEntry =
          (activeJumpPath
            ? (visibleEntryLookup.get(activeJumpPath) ?? null)
            : null) ??
          selectedEntry ??
          visibleEntries[0] ??
          null;
        if (targetEntry) {
          setSelected(new Set([targetEntry.path]));
          lastSelected.current = targetEntry.path;
          selectionRangeAnchorPathRef.current = targetEntry.path;
          void openEntry(targetEntry);
        }
        return;
      }

      if (
        preview.type === "text" &&
        matchesKeybinding(e, keybindings.saveFile)
      ) {
        e.preventDefault();
        void persistPreviewText(preview.path);
        return;
      }
      if (
        preview.type === "shader" &&
        matchesKeybinding(e, keybindings.saveFile) &&
        !preview.isReadOnly &&
        preview.editableSource != null
      ) {
        e.preventDefault();
        void persistShaderPreviewSource(preview.path);
        return;
      }
      if (
        preview.type === "shader" &&
        !isTypingInEmbeddedEditor &&
        matchesKeybinding(e, keybindings.shaderWorkbenchToggleEditMode)
      ) {
        e.preventDefault();
        setDocumentViewMode((current) =>
          current === "edit" ? "preview" : "edit",
        );
        return;
      }
      if (
        preview.type === "shader" &&
        !isTypingInEmbeddedEditor &&
        matchesKeybinding(e, keybindings.shaderWorkbenchToggleScene)
      ) {
        e.preventDefault();
        updateShaderPreviewScene(
          preview.path,
          preview.selectedScene === "sphere" ? "fullscreen" : "sphere",
        );
        return;
      }

      if (matchesKeybinding(e, keybindings.searchExplorer)) {
        e.preventDefault();
        beginAddressEdit();
        return;
      }
      if (matchesKeybinding(e, keybindings.goUpDirectory) && isExplorerFocus) {
        e.preventDefault();
        goUp();
        return;
      }
      if (matchesKeybinding(e, keybindings.refreshExplorer)) {
        e.preventDefault();
        refresh();
        return;
      }
      if (
        matchesKeybinding(e, keybindings.goBackDirectory) &&
        isExplorerFocus
      ) {
        e.preventDefault();
        goBack();
        return;
      }
      if (
        matchesKeybinding(e, keybindings.goForwardDirectory) &&
        isExplorerFocus
      ) {
        e.preventDefault();
        goForward();
        return;
      }
      if (
        matchesKeybinding(e, keybindings.goHomeDirectory) &&
        isExplorerFocus
      ) {
        e.preventDefault();
        goHome();
        return;
      }
      if (matchesKeybinding(e, keybindings.renameItem) && selected.size === 1) {
        e.preventDefault();
        if (selectedEntry) {
          setRename({
            active: true,
            path: selectedEntry.path,
            name: selectedEntry.name,
          });
        }
        return;
      }
      if (matchesKeybinding(e, keybindings.deleteItem) && selected.size > 0) {
        e.preventDefault();
        if (selectedEntries.length > 0) {
          openTrashDialog(selectedEntries);
        }
        return;
      }
      if (matchesKeybinding(e, keybindings.newFolder)) {
        e.preventDefault();
        openNew("folder");
        return;
      }
      if (matchesKeybinding(e, keybindings.newFile)) {
        e.preventDefault();
        openNew("file");
        return;
      }
      if (
        matchesKeybinding(e, keybindings.duplicateItem) &&
        selected.size > 0 &&
        selectedEntry
      ) {
        e.preventDefault();
        void duplicate(selectedEntry);
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleHiddenFiles)) {
        e.preventDefault();
        updateExplorerSettings({ showHiddenFiles: !showHidden });
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleExplorerSearchScope)) {
        e.preventDefault();
        toggleSearchScope();
        return;
      }
      if (matchesKeybinding(e, keybindings.cycleExplorerSortKey)) {
        e.preventDefault();
        cycleSortKey();
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleExplorerSortOrder)) {
        e.preventDefault();
        toggleSortOrder();
        return;
      }
      if (matchesKeybinding(e, keybindings.focusExplorerList)) {
        e.preventDefault();
        focusExplorerList();
        return;
      }
      if (matchesKeybinding(e, keybindings.focusExplorerAddressBar)) {
        e.preventDefault();
        focusExplorerAddressBar();
        return;
      }
      if (matchesKeybinding(e, keybindings.focusExplorerPreview)) {
        e.preventDefault();
        focusExplorerPreview();
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleExplorerSources)) {
        e.preventDefault();
        toggleSourcesPanel();
        return;
      }
      if (matchesKeybinding(e, keybindings.togglePreviewLock) && hasPreview) {
        e.preventDefault();
        togglePreviewLock();
        return;
      }
      if (
        matchesKeybinding(e, keybindings.togglePreviewTerminal) &&
        hasPreview &&
        previewTerminalWorkingDirectory
      ) {
        e.preventDefault();
        togglePreviewTerminal();
        return;
      }
      if (
        matchesKeybinding(e, keybindings.openInTerminal) &&
        selectedEntry?.is_dir
      ) {
        e.preventDefault();
        onOpenInTerminal(selectedEntry.path);
        return;
      }
      if (matchesKeybinding(e, keybindings.revealInExplorer) && selectedEntry) {
        e.preventDefault();
        void revealExplorerPath(selectedEntry.path).catch((error) =>
          setError(String(error)),
        );
        return;
      }
      if (matchesKeybinding(e, keybindings.openAsAdmin) && selectedEntry) {
        e.preventDefault();
        void openAsAdmin(selectedEntry.path);
        return;
      }
      const moveSelectionUp = matchesExplorerSelectionNavigationKeybinding(
        e,
        keybindings.explorerMoveSelectionUp,
      );
      const moveSelectionDown = matchesExplorerSelectionNavigationKeybinding(
        e,
        keybindings.explorerMoveSelectionDown,
      );
      const moveSelectionLeft = matchesExplorerSelectionNavigationKeybinding(
        e,
        keybindings.explorerMoveSelectionLeft,
      );
      const moveSelectionRight = matchesExplorerSelectionNavigationKeybinding(
        e,
        keybindings.explorerMoveSelectionRight,
      );
      if (
        isExplorerFocus &&
        (moveSelectionUp ||
          moveSelectionDown ||
          moveSelectionLeft ||
          moveSelectionRight)
      ) {
        e.preventDefault();
        const direction: ExplorerSelectionNavigationDirection = moveSelectionUp
          ? "up"
          : moveSelectionDown
            ? "down"
            : moveSelectionLeft
              ? "left"
              : "right";
        const nextIndex = resolveExplorerDirectionalSelectionIndex({
          currentIndex: currentFocusIndex,
          totalEntries: visibleEntries.length,
          direction,
          presentation: effectiveViewModeDefinition.presentation,
          gridColumnCount:
            virtualWindow.kind === "grid" ? virtualWindow.columns : 1,
        });
        if (nextIndex < 0) {
          return;
        }
        selectVisibleEntryAtIndex(nextIndex, e.shiftKey);
        return;
      }
      if (matchesKeybinding(e, keybindings.selectAllExplorer)) {
        e.preventDefault();
        selectAllVisibleEntries();
        return;
      }
      if (matchesKeybinding(e, keybindings.clearExplorerSelection)) {
        e.preventDefault();
        clearExplorerSelection();
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleExplorerLayout)) {
        e.preventDefault();
        if (
          !isCompactDock &&
          !isSearchActive &&
          (experimentalViewMode !== "off" ||
            explorerTheme.preferredExperimentalViewMode != null)
        ) {
          const nextDensity = stepAdaptiveSemanticDensity(
            experimentalDensity,
            "larger",
          );
          if (nextDensity !== experimentalDensity) {
            updateExplorerSettings({ experimentalDensity: nextDensity });
            showExperimentalHud();
          }
          return;
        }
        const nextMode = stepExplorerViewMode(viewMode, "larger");
        if (nextMode !== viewMode) {
          updateExplorerSettings({ viewMode: nextMode });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        beginAddressEdit();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        beginAddressEdit();
        return;
      }
      if (e.key === "Escape") {
        setClipboard(null);
        setNewItem({ visible: false, kind: "folder" });
      }
      if (matchesKeybinding(e, keybindings.copyPath)) {
        e.preventDefault();
        if (selectedEntries.length > 0) {
          void copyToSysClipboard(
            selectedEntries.map((entry) => entry.path).join("\n"),
          );
        }
        return;
      }
      if (matchesKeybinding(e, keybindings.copySelection)) {
        e.preventDefault();
        queueClipboard("copy");
        return;
      }
      if (matchesKeybinding(e, keybindings.cutSelection)) {
        e.preventDefault();
        queueClipboard("cut");
        return;
      }
      if (matchesKeybinding(e, keybindings.pasteSelection)) {
        e.preventDefault();
        void paste();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [
    addressEditing,
    beginAddressEdit,
    clearExplorerSelection,
    duplicate,
    effectiveViewModeDefinition.presentation,
    experimentalDensity,
    experimentalViewMode,
    explorerTheme.preferredExperimentalViewMode,
    focusExplorerAddressBar,
    focusExplorerList,
    focusExplorerPreview,
    hasPreview,
    goBack,
    goForward,
    goHome,
    isCompactDock,
    isSearchActive,
    keybindings,
    moveJumpFilterSelection,
    newItem.visible,
    paste,
    persistPreviewText,
    persistShaderPreviewSource,
    preview,
    previewTerminalWorkingDirectory,
    queueClipboard,
    refresh,
    rename.active,
    selectVisibleEntryAtIndex,
    selectAllVisibleEntries,
    selected,
    selectedEntries,
    showExperimentalHud,
    showHidden,
    updateExplorerSettings,
    visibleEntryIndexLookup,
    visibleEntryLookup,
    viewMode,
    visibleEntries,
    toggleSourcesPanel,
    toggleSearchScope,
    togglePreviewTerminal,
    cycleSortKey,
    toggleSortOrder,
    togglePreviewLock,
    updateShaderPreviewScene,
    virtualWindow.columns,
    virtualWindow.kind,
  ]);

  const maxViewportScrollTop = useMemo(
    () =>
      Math.max(
        0,
        virtualWindow.contentHeight +
          (newItem.visible ? activeNewItemHeight : 0) -
          virtualizedViewportHeight,
      ),
    [
      activeNewItemHeight,
      newItem.visible,
      virtualWindow.contentHeight,
      virtualizedViewportHeight,
    ],
  );

  const lastViewportLayoutRef = useRef<{
    currentPath: string;
    effectiveViewMode: typeof effectiveViewMode;
    effectiveExperimentalViewMode: typeof effectiveExperimentalViewMode;
    gridZoom: number;
  } | null>(null);

  useLayoutEffect(() => {
    const previousLayout = lastViewportLayoutRef.current;
    const pathChanged =
      previousLayout != null && previousLayout.currentPath !== currentPath;
    const layoutChanged =
      previousLayout != null &&
      (previousLayout.effectiveViewMode !== effectiveViewMode ||
        previousLayout.effectiveExperimentalViewMode !==
          effectiveExperimentalViewMode ||
        previousLayout.gridZoom !== gridZoom);

    lastViewportLayoutRef.current = {
      currentPath,
      effectiveViewMode,
      effectiveExperimentalViewMode,
      gridZoom,
    };

    if (pathChanged) {
      resetExplorerViewport();
      return;
    }

    const currentScrollTop = explorerViewportScrollTopRef.current;
    const nextScrollTop = Math.min(currentScrollTop, maxViewportScrollTop);
    if (layoutChanged || nextScrollTop !== currentScrollTop) {
      setExplorerViewportScrollTop(nextScrollTop);
    }
  }, [
    currentPath,
    effectiveExperimentalViewMode,
    effectiveViewMode,
    gridZoom,
    maxViewportScrollTop,
    resetExplorerViewport,
    setExplorerViewportScrollTop,
  ]);

  useEffect(() => {
    if (loading || deferredVirtualizedEntries.length === 0) {
      return;
    }

    const shouldMeasureDirectories = !isSearchActive;
    const pendingFiles = deferredVirtualizedEntries
      .filter(
        (entry) =>
          !entry.is_dir &&
          !entrySizes[entry.path] &&
          !entrySizeLoadingPaths.has(entry.path),
      )
      .slice(0, 8);
    const pendingDirectories = shouldMeasureDirectories
      ? deferredVirtualizedEntries
          .filter(
            (entry) =>
              entry.is_dir &&
              !entrySizes[entry.path] &&
              !entrySizeLoadingPaths.has(entry.path),
          )
          .slice(0, 1)
      : [];

    const nextBatch = (
      pendingFiles.length > 0 ? pendingFiles : pendingDirectories
    ).slice(0, 8);
    const unresolvedPaths = nextBatch.map((entry) => entry.path);

    if (unresolvedPaths.length === 0) {
      return;
    }

    let disposed = false;
    const batchTimer = window.setTimeout(() => {
      setEntrySizeLoadingPaths((current) => {
        const next = new Set(current);
        let changed = false;
        for (const path of unresolvedPaths) {
          if (!next.has(path)) {
            next.add(path);
            changed = true;
          }
        }
        return changed ? next : current;
      });

      const startedAt = getExplorerPerformanceNow();
      void measureExplorerEntrySizes(unresolvedPaths, false)
        .then((results) => {
          if (disposed) {
            return;
          }

          recordExplorerMetric({
            metricId: "explorer_entry_size_batch",
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              directoryCount: nextBatch.filter((entry) => entry.is_dir).length,
              pathCount: unresolvedPaths.length,
              resultCount: results.length,
              success: true,
            },
          });

          startTransition(() => {
            setEntrySizes((current) => {
              const next = { ...current };
              for (const result of results) {
                next[result.path] = result;
              }
              return next;
            });
          });

          setEntrySizeLoadingPaths((current) => {
            if (current.size === 0) {
              return current;
            }
            const next = new Set(current);
            for (const path of unresolvedPaths) {
              next.delete(path);
            }
            return next.size === current.size ? current : next;
          });
        })
        .catch(() => {
          if (disposed) {
            return;
          }

          recordExplorerMetric({
            metricId: "explorer_entry_size_batch",
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              directoryCount: nextBatch.filter((entry) => entry.is_dir).length,
              pathCount: unresolvedPaths.length,
              resultCount: 0,
              success: false,
            },
          });

          setEntrySizeLoadingPaths((current) => {
            if (current.size === 0) {
              return current;
            }
            const next = new Set(current);
            for (const path of unresolvedPaths) {
              next.delete(path);
            }
            return next.size === current.size ? current : next;
          });
        });
    }, EXPLORER_ENTRY_SIZE_BATCH_SETTLE_MS);

    return () => {
      disposed = true;
      window.clearTimeout(batchTimer);
    };
  }, [
    effectiveViewMode,
    entrySizes,
    entrySizeLoadingPaths,
    isSearchActive,
    loading,
    recordExplorerMetric,
    deferredVirtualizedEntries,
  ]);

  useEffect(() => {
    if (
      !useNativeOsIcons ||
      loading ||
      deferredVirtualizedEntries.length === 0
    ) {
      return;
    }

    const pendingEntries = deferredVirtualizedEntries
      .filter((entry) => !shouldUseManagedIconSrc(entry))
      .map((entry) => ({
        entry,
        key: getNativeIconCacheKey(entry.path, DEFAULT_NATIVE_ICON_SIZE),
      }))
      .filter(
        ({ key }) =>
          nativeIconMap[key] === undefined && !nativeIconLoadingKeys.has(key),
      )
      .slice(0, 24);

    if (pendingEntries.length === 0) {
      return;
    }

    const pendingKeys = pendingEntries.map((item) => item.key);
    const requests = pendingEntries.map((item) =>
      getNativeIconRequest(item.entry),
    );

    let disposed = false;
    const batchTimer = window.setTimeout(() => {
      setNativeIconLoadingKeys((current) => {
        const next = new Set(current);
        let changed = false;
        for (const key of pendingKeys) {
          if (!next.has(key)) {
            next.add(key);
            changed = true;
          }
        }
        return changed ? next : current;
      });

      const startedAt = getExplorerPerformanceNow();
      void commands
        .fsResolveNativeIcons(
          requests.map((request) => ({
            ...request,
            size: request.size ?? null,
          })),
        )
        .then(unwrapTauriResult)
        .then((results) => {
          if (disposed) {
            return;
          }

          recordExplorerMetric({
            metricId: "explorer_native_icon_batch",
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              pathCount: pendingKeys.length,
              resultCount: results.length,
              success: true,
            },
          });

          startTransition(() => {
            setNativeIconMap((current) => {
              const next = { ...current };
              for (const result of results) {
                next[
                  getNativeIconCacheKey(result.path, DEFAULT_NATIVE_ICON_SIZE)
                ] = result.src ?? null;
              }
              return next;
            });
          });

          setNativeIconLoadingKeys((current) => {
            const next = new Set(current);
            for (const key of pendingKeys) {
              next.delete(key);
            }
            return next.size === current.size ? current : next;
          });
        })
        .catch(() => {
          if (disposed) {
            return;
          }

          recordExplorerMetric({
            metricId: "explorer_native_icon_batch",
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              pathCount: pendingKeys.length,
              resultCount: 0,
              success: false,
            },
          });

          startTransition(() => {
            setNativeIconMap((current) => {
              const next = { ...current };
              for (const key of pendingKeys) {
                next[key] = null;
              }
              return next;
            });
          });

          setNativeIconLoadingKeys((current) => {
            const next = new Set(current);
            for (const key of pendingKeys) {
              next.delete(key);
            }
            return next.size === current.size ? current : next;
          });
        });
    }, EXPLORER_NATIVE_ICON_BATCH_SETTLE_MS);

    return () => {
      disposed = true;
      window.clearTimeout(batchTimer);
    };
  }, [
    loading,
    nativeIconLoadingKeys,
    nativeIconMap,
    recordExplorerMetric,
    shouldUseManagedIconSrc,
    useNativeOsIcons,
    deferredVirtualizedEntries,
  ]);

  useEffect(() => {
    if (
      loading ||
      isSearchActive ||
      currentPathIsCloud ||
      (virtualWindow.kind === "grid"
        ? (activeGridMetrics?.iconStageSize ?? 0)
        : Math.max((activeRowMetrics?.iconSize ?? 16) + 12, 28)) <
        EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.minStagePx ||
      deferredVirtualizedEntries.length === 0
    ) {
      return;
    }

    const pendingEntries = deferredVirtualizedEntries
      .filter(
        (entry) =>
          canRenderEntryThumbnail(entry) &&
          entryThumbnailMap[entry.path] === undefined &&
          !entryThumbnailLoadingPaths.has(entry.path),
      )
      .slice(0, EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.batchSize);

    if (pendingEntries.length === 0) {
      return;
    }

    const pendingPaths = pendingEntries.map((entry) => entry.path);
    const batchTimer = window.setTimeout(() => {
      setEntryThumbnailLoadingPaths((current) => {
        const next = new Set(current);
        let changed = false;
        for (const path of pendingPaths) {
          if (!next.has(path)) {
            next.add(path);
            changed = true;
          }
        }
        return changed ? next : current;
      });

      void Promise.all(
        pendingEntries.map(async (entry) => {
          try {
            const thumbnail = await readExplorerEntryThumbnail({
              path: entry.path,
              maxWidth: EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.maxDimensionPx,
              maxHeight: EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.maxDimensionPx,
              includeVideoHoverScrub: false,
              videoHoverFrameCount: null,
            });
            return { path: entry.path, thumbnail };
          } catch {
            return { path: entry.path, thumbnail: null };
          }
        }),
      ).then((results) => {
        if (!isExplorerMountedRef.current) {
          return;
        }

        startTransition(() => {
          setEntryThumbnailMap((current) => {
            const next = { ...current };
            for (const result of results) {
              next[result.path] = result.thumbnail;
            }
            return next;
          });
        });

        setEntryThumbnailLoadingPaths((current) => {
          const next = new Set(current);
          for (const path of pendingPaths) {
            next.delete(path);
          }
          return next.size === current.size ? current : next;
        });
      });
    }, EXPLORER_IMAGE_TILE_THUMBNAIL_BATCH_SETTLE_MS);

    return () => {
      window.clearTimeout(batchTimer);
    };
  }, [
    activeGridMetrics,
    activeRowMetrics,
    canRenderEntryThumbnail,
    currentPathIsCloud,
    entryThumbnailLoadingPaths,
    entryThumbnailMap,
    isSearchActive,
    loading,
    readExplorerEntryThumbnail,
    virtualWindow.kind,
    deferredVirtualizedEntries,
  ]);

  useEffect(() => {
    if (
      !hoveredVideoThumbnailPath ||
      isSearchActive ||
      currentPathIsCloud ||
      !explorerThumbnailSettings.enabled ||
      !explorerThumbnailSettings.includeVideo ||
      !explorerThumbnailSettings.enableVideoHoverScrub
    ) {
      return;
    }

    const hoveredEntry = visibleEntryLookup.get(hoveredVideoThumbnailPath);
    if (
      !hoveredEntry ||
      !isVideoPreviewExtension(getEntryExtension(hoveredEntry))
    ) {
      return;
    }

    const existingThumbnail = entryThumbnailMap[hoveredVideoThumbnailPath];
    if ((existingThumbnail?.hoverFrames.length ?? 0) >= 2) {
      return;
    }
    if (videoHoverThumbnailLoadingPaths.has(hoveredVideoThumbnailPath)) {
      return;
    }

    let cancelled = false;
    const targetPath = hoveredVideoThumbnailPath;
    setVideoHoverThumbnailLoadingPaths((current) => {
      const next = new Set(current);
      next.add(targetPath);
      return next;
    });

    void readExplorerEntryThumbnail({
      path: targetPath,
      maxWidth: EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.maxDimensionPx,
      maxHeight: EXPLORER_ENTRY_THUMBNAIL_BATCH_CONFIG.maxDimensionPx,
      includeVideoHoverScrub: true,
      videoHoverFrameCount: explorerThumbnailSettings.videoHoverScrubFrameCount,
    })
      .then((thumbnail) => {
        if (cancelled || !isExplorerMountedRef.current) {
          return;
        }
        startTransition(() => {
          setEntryThumbnailMap((current) => ({
            ...current,
            [targetPath]: thumbnail,
          }));
        });
      })
      .catch(() => {
        if (cancelled || !isExplorerMountedRef.current) {
          return;
        }
        startTransition(() => {
          setEntryThumbnailMap((current) => ({
            ...current,
            [targetPath]: current[targetPath] ?? null,
          }));
        });
      })
      .finally(() => {
        if (cancelled || !isExplorerMountedRef.current) {
          return;
        }
        setVideoHoverThumbnailLoadingPaths((current) => {
          const next = new Set(current);
          next.delete(targetPath);
          return next.size === current.size ? current : next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentPathIsCloud,
    entryThumbnailMap,
    explorerThumbnailSettings.enableVideoHoverScrub,
    explorerThumbnailSettings.enabled,
    explorerThumbnailSettings.includeVideo,
    explorerThumbnailSettings.videoHoverScrubFrameCount,
    hoveredVideoThumbnailPath,
    isSearchActive,
    readExplorerEntryThumbnail,
    videoHoverThumbnailLoadingPaths,
    visibleEntryLookup,
  ]);

  useEffect(() => {
    if (!hoveredVideoThumbnailPath) {
      return;
    }
    if (
      isSearchActive ||
      currentPathIsCloud ||
      !explorerThumbnailSettings.enabled ||
      !explorerThumbnailSettings.includeVideo ||
      !explorerThumbnailSettings.enableVideoHoverScrub ||
      !visibleEntryLookup.has(hoveredVideoThumbnailPath)
    ) {
      setHoveredVideoThumbnailPath(null);
    }
  }, [
    currentPathIsCloud,
    explorerThumbnailSettings.enableVideoHoverScrub,
    explorerThumbnailSettings.enabled,
    explorerThumbnailSettings.includeVideo,
    hoveredVideoThumbnailPath,
    isSearchActive,
    visibleEntryLookup,
  ]);

  const renderSearchMetadata = (entry: FileEntry) => {
    if (!isSearchActive) return null;
    const searchEntry = entry as FileSearchResult;
    const matchLabel =
      searchEntry.match_kind === "name_and_content"
        ? "Name + content"
        : searchEntry.match_kind === "content"
          ? "Content match"
          : "Name match";

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          marginTop: 4,
          minWidth: 0,
          maxHeight: 42,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: EXP.muted2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {searchEntry.relative_path || searchEntry.path}
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}
        >
          {searchEntry.line_number != null && (
            <span
              style={{
                fontSize: 9,
                color: accent,
                fontFamily: "monospace",
                flexShrink: 0,
              }}
            >
              L{searchEntry.line_number}
            </span>
          )}
          {searchEntry.snippet && (
            <span
              style={{
                fontSize: 9,
                color: EXP.text,
                opacity: 0.88,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {searchEntry.snippet}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 9,
            color: EXP.muted,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {matchLabel}
        </div>
      </div>
    );
  };

  const getSearchTooltip = (entry: FileEntry) => {
    if (!isSearchActive) return undefined;
    const searchEntry = entry as FileSearchResult;
    const parts = [searchEntry.relative_path || searchEntry.path];
    if (searchEntry.line_number != null) {
      parts.push(`Line ${searchEntry.line_number}`);
    }
    if (searchEntry.snippet) {
      parts.push(searchEntry.snippet);
    }
    return parts.join("\n");
  };

  const renderEntryInlineMeta = (entry: FileEntry) => {
    const parts = [
      getEntryTypeLabel(entry),
      getEntryStorageLabel(entry),
      formatDate(entry.modified),
    ].filter(Boolean);
    return parts.join("  •  ");
  };

  const renderAdaptiveSemanticEntry = (
    entry: FileEntry,
    densityStop: AdaptiveSemanticDensityStopDefinition,
    options: { dominant: boolean },
  ) => {
    const isSel = selected.has(entry.path);
    const isDrop = dragOver === entry.path && entry.is_dir;
    const isRenaming = rename.active && rename.path === entry.path;
    const iconSrc = getExplorerEntryIconSrc(entry, isSel, isDrop);
    const tableThumbnailStageSize = densityStop.table
      ? Math.max(densityStop.table.iconSize + 10, 28)
      : 0;
    const tableThumbnail = densityStop.table
      ? getRenderableEntryThumbnail(entry, tableThumbnailStageSize)
      : null;
    const semanticTableBaseSurface: ExplorerEntrySurfaceState = {
      background: "var(--overlay-explorer-chip-bg)",
      borderColor: "var(--overlay-explorer-chip-border)",
      boxShadow: "none",
      transform: "translateY(0)",
    };
    const semanticTableRestingSurface = isDrop
      ? dropEntrySurface
      : isSel
        ? selectedEntrySurface
        : semanticTableBaseSurface;

    if (densityStop.presentation === "table" && densityStop.table) {
      return (
        <div
          key={entry.path}
          draggable
          data-overlay-drag-source="file"
          data-overlay-drop-target-path={entry.is_dir ? entry.path : undefined}
          onDragStart={(e) => onDragStart(e, entry)}
          onDragEnd={onDragEnd}
          onDragOver={
            entry.is_dir ? (e) => onDragOver(e, entry.path) : undefined
          }
          onDragLeave={(e) => onDragLeave(e, entry.path)}
          onDrop={entry.is_dir ? (e) => onDrop(e, entry.path) : undefined}
          onClick={(e) => onEntryClick(e, entry)}
          onDoubleClick={() => onEntryDoubleClick(entry)}
          onContextMenu={(e) => onRightClick(e, entry)}
          title={entry.path}
          style={{
            display: "grid",
            gridTemplateColumns: densityStop.table.showRichMeta
              ? "minmax(0, 2.3fr) minmax(110px, 0.9fr) minmax(120px, 0.9fr) minmax(96px, 0.7fr)"
              : "minmax(0, 2fr) minmax(120px, 0.85fr) minmax(96px, 0.7fr)",
            alignItems: "center",
            gap: 12,
            height: densityStop.table.rowHeight,
            padding: densityStop.table.showRichMeta ? "8px 14px" : "6px 14px",
            borderBottom: "1px solid var(--overlay-explorer-toolbar-border)",
            borderRadius: 10,
            background: semanticTableRestingSurface.background,
            border: `1px solid ${semanticTableRestingSurface.borderColor}`,
            cursor: "pointer",
            boxSizing: "border-box",
            userSelect: "none",
            boxShadow: semanticTableRestingSurface.boxShadow,
            transform: semanticTableRestingSurface.transform,
          }}
          onMouseEnter={(e) => {
            handleEntryPointerEnter(
              entry,
              e.currentTarget as HTMLDivElement,
              isSel,
              isDrop,
            );
          }}
          onMouseLeave={(e) => {
            handleEntryPointerLeave(
              entry,
              e.currentTarget as HTMLDivElement,
              isSel,
              isDrop,
              semanticTableBaseSurface,
            );
          }}
        >
          <div
            style={{
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: tableThumbnailStageSize,
                height: tableThumbnailStageSize,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: tableThumbnail ? 10 : undefined,
                border: tableThumbnail
                  ? "1px solid color-mix(in srgb, var(--overlay-border-strong) 42%, transparent)"
                  : undefined,
                background: tableThumbnail
                  ? "color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)"
                  : undefined,
                boxShadow: tableThumbnail
                  ? "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)"
                  : undefined,
              }}
            >
              <ExplorerEntryThumbnailStageContent
                entry={entry}
                fallbackIconSize={densityStop.table.iconSize}
                fallbackIconSrc={iconSrc}
                hoverScrubEnabled={hoveredVideoThumbnailPath === entry.path}
                iconTheme={themeIconTheme}
                stageSize={tableThumbnailStageSize}
                thumbnail={tableThumbnail}
              />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              {isRenaming ? (
                <RenameInput
                  state={rename}
                  onCommit={commitRename}
                  onCancel={() =>
                    setRename({ active: false, path: "", name: "" })
                  }
                />
              ) : (
                <>
                  <div
                    style={{
                      color: isSel
                        ? EXP.text
                        : entry.is_dir
                          ? EXP.yellow
                          : EXP.text,
                      fontWeight: entry.is_dir ? 650 : 560,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.name}
                  </div>
                  {densityStop.table.showRichMeta && (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 10,
                        color: EXP.muted2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {renderEntryInlineMeta(entry)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div
            style={{
              color: EXP.muted,
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {getEntryStorageLabel(entry)}
          </div>
          <div
            style={{
              color: EXP.muted,
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {formatDate(entry.modified)}
          </div>
          {densityStop.table.showRichMeta && (
            <div
              style={{
                color: EXP.muted2,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {getEntryTypeLabel(entry)}
            </div>
          )}
        </div>
      );
    }

    if (!densityStop.grid) {
      return null;
    }

    const dominantScale = options.dominant && entry.is_dir ? 1.12 : 1;
    const minHeight = Math.round(densityStop.grid.minHeight * dominantScale);
    const iconStageSize = Math.round(
      densityStop.grid.iconStageSize * dominantScale,
    );
    const iconSize = Math.round(densityStop.grid.iconSize * dominantScale);
    const isCards = densityStop.presentation === "cards";
    const gridThumbnail = getRenderableEntryThumbnail(
      entry,
      iconStageSize,
    );
    const semanticGridBaseSurface: ExplorerEntrySurfaceState = {
      background:
        options.dominant && entry.is_dir
          ? "linear-gradient(180deg, color-mix(in srgb, white 10%, transparent), color-mix(in srgb, white 4%, transparent))"
          : "var(--overlay-explorer-chip-bg)",
      borderColor: "var(--overlay-explorer-chip-border)",
      boxShadow: "none",
      transform: "translateY(0)",
    };
    const semanticGridRestingSurface = isDrop
      ? dropEntrySurface
      : isSel
        ? selectedEntrySurface
        : semanticGridBaseSurface;

    return (
      <div
        key={entry.path}
        draggable
        data-overlay-drag-source="file"
        data-overlay-drop-target-path={entry.is_dir ? entry.path : undefined}
        onDragStart={(e) => onDragStart(e, entry)}
        onDragEnd={onDragEnd}
        onDragOver={entry.is_dir ? (e) => onDragOver(e, entry.path) : undefined}
        onDragLeave={(e) => onDragLeave(e, entry.path)}
        onDrop={entry.is_dir ? (e) => onDrop(e, entry.path) : undefined}
        onClick={(e) => onEntryClick(e, entry)}
        onDoubleClick={() => onEntryDoubleClick(entry)}
        onContextMenu={(e) => onRightClick(e, entry)}
        title={entry.path}
        style={{
          minHeight,
          borderRadius: isCards ? 18 : 14,
          border: `1px solid ${semanticGridRestingSurface.borderColor}`,
          background: semanticGridRestingSurface.background,
          padding: isCards ? "14px" : iconSize <= 30 ? "10px 8px" : "12px 10px",
          display: "flex",
          flexDirection: isCards ? "row" : "column",
          alignItems: isCards ? "flex-start" : "center",
          justifyContent: "flex-start",
          gap: isCards ? 14 : 10,
          cursor: "pointer",
          overflow: "hidden",
          userSelect: "none",
          boxSizing: "border-box",
          boxShadow: semanticGridRestingSurface.boxShadow,
          transform: semanticGridRestingSurface.transform,
        }}
        onMouseEnter={(e) => {
          handleEntryPointerEnter(
            entry,
            e.currentTarget as HTMLDivElement,
            isSel,
            isDrop,
          );
        }}
        onMouseLeave={(e) => {
          handleEntryPointerLeave(
            entry,
            e.currentTarget as HTMLDivElement,
            isSel,
            isDrop,
            semanticGridBaseSurface,
          );
        }}
      >
        <div
          style={{
            width: iconStageSize,
            height: iconStageSize,
            minWidth: iconStageSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: isCards ? 16 : 12,
            background: gridThumbnail
              ? "color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)"
              : "rgba(255,255,255,0.04)",
            flexShrink: 0,
            overflow: "hidden",
            border: gridThumbnail
              ? "1px solid color-mix(in srgb, var(--overlay-border-strong) 42%, transparent)"
              : undefined,
            boxShadow: gridThumbnail
              ? "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)"
              : undefined,
          }}
        >
          <ExplorerEntryThumbnailStageContent
            entry={entry}
            fallbackIconSize={iconSize}
            fallbackIconSrc={iconSrc}
            hoverScrubEnabled={hoveredVideoThumbnailPath === entry.path}
            iconTheme={themeIconTheme}
            stageSize={iconStageSize}
            thumbnail={gridThumbnail}
          />
        </div>
        <div
          style={{
            minWidth: 0,
            width: "100%",
            textAlign: isCards ? "left" : "center",
          }}
        >
          {isRenaming ? (
            <RenameInput
              state={rename}
              onCommit={commitRename}
              onCancel={() => setRename({ active: false, path: "", name: "" })}
            />
          ) : (
            <>
              <div
                style={{
                  color: isSel
                    ? EXP.text
                    : entry.is_dir
                      ? EXP.yellow
                      : EXP.text,
                  fontWeight: entry.is_dir ? 650 : 560,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: densityStop.grid.titleLines,
                  WebkitBoxOrient: "vertical",
                  lineHeight: 1.28,
                }}
              >
                {entry.name}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  color: EXP.muted2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isCards
                  ? renderEntryInlineMeta(entry)
                  : getEntryTypeLabel(entry)}
              </div>
              {isCards && (
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: accent,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {entry.is_dir ? "Folder Anchor" : "Active File"}
                  </span>
                  <span style={{ fontSize: 9, color: EXP.muted }}>
                    {formatDate(entry.modified)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderExperimentalInlineNewItem = (iconSize: number) => {
    if (!newItem.visible) {
      return null;
    }

    return (
      <div style={{ padding: "0 14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderRadius: "var(--overlay-explorer-panel-radius)",
            border: "1px solid var(--overlay-explorer-item-selected-border)",
            background: "var(--overlay-explorer-item-selected-bg)",
            padding: "12px 14px",
          }}
        >
          <SvgIcon
            src={
              newItem.kind === "folder"
                ? (resolveIconSrc(themeIconTheme.folder, themeIconTheme) ??
                  "/icons/folder.svg")
                : resolveFileIconSrc("new-file.txt", "txt", themeIconTheme)
            }
            size={iconSize}
          />
          <input
            autoFocus
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNew();
              if (e.key === "Escape")
                setNewItem({ visible: false, kind: "folder" });
            }}
            onBlur={commitNew}
            placeholder={newItem.kind === "folder" ? "folder name" : "name.ext"}
            style={{
              background: "var(--overlay-explorer-input-bg)",
              border: "1px solid var(--overlay-explorer-input-border)",
              borderRadius: "var(--overlay-explorer-control-radius)",
              color: EXP.text,
              fontSize: 12,
              padding: "2px 6px",
              outline: "none",
              flex: 1,
            }}
          />
        </div>
      </div>
    );
  };

  const renderAdaptiveSemanticBand = (band: AdaptiveSemanticBand) => {
    if (!adaptiveDensityStop) {
      return null;
    }

    if (adaptiveDensityStop.presentation === "table") {
      const showRichMeta = adaptiveDensityStop.table?.showRichMeta ?? false;
      return (
        <section key={band.id} style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              padding: "0 12px",
              marginBottom: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: band.dominant ? accent : EXP.muted2,
                }}
              >
                {band.label}
              </div>
              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: EXP.muted,
                  maxWidth: 420,
                }}
              >
                {band.description}
              </div>
            </div>
            <div style={{ fontSize: 10, color: EXP.muted2 }}>
              {band.entries.length} items
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, padding: "0 12px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: showRichMeta
                  ? "minmax(0, 2.3fr) minmax(110px, 0.9fr) minmax(120px, 0.9fr) minmax(96px, 0.7fr)"
                  : "minmax(0, 2fr) minmax(120px, 0.85fr) minmax(96px, 0.7fr)",
                gap: 12,
                padding: "0 14px",
                color: EXP.muted2,
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <span>Name</span>
              <span>Size</span>
              <span>Modified</span>
              {showRichMeta && <span>Type</span>}
            </div>
            {band.entries.map((entry) =>
              renderAdaptiveSemanticEntry(entry, adaptiveDensityStop, {
                dominant: band.dominant,
              }),
            )}
          </div>
        </section>
      );
    }

    const gridMetrics = adaptiveDensityStop.grid!;
    const bandMinWidth = band.dominant
      ? Math.round(gridMetrics.minWidth * 1.12)
      : gridMetrics.minWidth;
    return (
      <section key={band.id} style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            padding: `0 ${gridMetrics.padding}px`,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: band.dominant ? accent : EXP.muted2,
              }}
            >
              {band.label}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                color: EXP.muted,
                maxWidth: 420,
              }}
            >
              {band.description}
            </div>
          </div>
          <div style={{ fontSize: 10, color: EXP.muted2 }}>
            {band.entries.length} items
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${bandMinWidth}px, 1fr))`,
            gap: gridMetrics.gap,
            padding: `0 ${gridMetrics.padding}px`,
            alignItems: "stretch",
          }}
        >
          {band.entries.map((entry) =>
            renderAdaptiveSemanticEntry(entry, adaptiveDensityStop, {
              dominant: band.dominant,
            }),
          )}
        </div>
      </section>
    );
  };

  const renderConstellationNode = (
    band: ConstellationFieldBand,
    node: ConstellationFieldNode,
  ) => {
    const isSel = selected.has(node.entry.path);
    const isDrop = dragOver === node.entry.path && node.entry.is_dir;
    const isRenaming = rename.active && rename.path === node.entry.path;
    const iconSrc = getExplorerEntryIconSrc(node.entry, isSel, isDrop);
    const showsLabel = node.labelVisible || isSel || isDrop;
    const highlightBackground = isDrop
      ? dropEntrySurface.background
      : isSel
        ? selectedEntrySurface.background
        : node.emphasis === "anchor"
          ? "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))"
          : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))";
    const restingTransform = isDrop
      ? dropEntrySurface.transform
      : isSel
        ? selectedEntrySurface.transform
        : idleEntrySurface.transform;
    const restingBorderColor = isDrop
      ? dropEntrySurface.borderColor
      : isSel
        ? selectedEntrySurface.borderColor
        : node.emphasis === "anchor"
          ? `${accent}66`
          : "rgba(255,255,255,0.12)";
    const restingBoxShadow = isDrop
      ? dropEntrySurface.boxShadow
      : isSel
        ? selectedEntrySurface.boxShadow
        : node.emphasis === "anchor"
          ? `0 16px 36px ${accent}1f`
          : "0 12px 24px rgba(0,0,0,0.18)";

    return (
      <div
        key={node.entry.path}
        draggable
        data-overlay-constellation-band={band.id}
        data-overlay-constellation-node={node.entry.path}
        data-overlay-constellation-emphasis={node.emphasis}
        data-overlay-drag-source="file"
        data-overlay-drop-target-path={
          node.entry.is_dir ? node.entry.path : undefined
        }
        onDragStart={(e) => {
          if (constellationPanGestureRef.current?.moved) {
            e.preventDefault();
            return;
          }
          onDragStart(e, node.entry);
        }}
        onDragEnd={onDragEnd}
        onDragOver={
          node.entry.is_dir
            ? (e) => onDragOver(e, node.entry.path)
            : undefined
        }
        onDragLeave={(e) => onDragLeave(e, node.entry.path)}
        onDrop={
          node.entry.is_dir
            ? (e) => onDrop(e, node.entry.path)
            : undefined
        }
        onClick={(e) => {
          if (constellationSuppressClickPathRef.current === node.entry.path) {
            constellationSuppressClickPathRef.current = null;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onEntryClick(e, node.entry);
        }}
        onDoubleClick={() => onEntryDoubleClick(node.entry)}
        onContextMenu={(e) => onRightClick(e, node.entry)}
        title={node.entry.path}
        style={{
          position: "absolute",
          left: node.x,
          top: node.y,
          transform: `translate(-50%, -50%) ${restingTransform}`,
          minWidth: showsLabel ? Math.max(92, node.size + 42) : node.size + 16,
          maxWidth: showsLabel ? 164 : node.size + 16,
          minHeight: node.size + 14,
          borderRadius: showsLabel ? 20 : 999,
          border: `1px solid ${restingBorderColor}`,
          background: highlightBackground,
          boxShadow: restingBoxShadow,
          color: EXP.text,
          cursor: "pointer",
          userSelect: "none",
          padding: showsLabel ? "8px 10px" : "7px",
          display: "flex",
          alignItems: "center",
          gap: showsLabel ? 8 : 0,
          transition:
            "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onMouseEnter={(e) => {
          handleEntryPointerEnter(
            node.entry,
            e.currentTarget as HTMLDivElement,
            isSel,
            isDrop,
          );
          if (!isSel && !isDrop) {
            e.currentTarget.style.transform = `translate(-50%, -50%) ${hoverEntrySurface.transform}`;
            e.currentTarget.style.borderColor = node.emphasis === "anchor"
              ? `${accent}88`
              : "rgba(255,255,255,0.18)";
            e.currentTarget.style.boxShadow = node.emphasis === "anchor"
              ? `0 20px 42px ${accent}2b`
              : "0 18px 34px rgba(0,0,0,0.22)";
          }
        }}
        onMouseLeave={(e) => {
          handleEntryPointerLeave(
            node.entry,
            e.currentTarget as HTMLDivElement,
            isSel,
            isDrop,
          );
          if (!isSel && !isDrop) {
            e.currentTarget.style.transform = `translate(-50%, -50%) ${restingTransform}`;
            e.currentTarget.style.background = highlightBackground;
            e.currentTarget.style.borderColor = restingBorderColor;
            e.currentTarget.style.boxShadow = restingBoxShadow;
          }
        }}
      >
        <div
          style={{
            width: node.size,
            height: node.size,
            minWidth: node.size,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: node.emphasis === "anchor"
              ? "rgba(255,255,255,0.11)"
              : "rgba(255,255,255,0.07)",
            overflow: "hidden",
            boxShadow: node.emphasis === "selected"
              ? `0 0 0 1px ${accent}55`
              : "none",
          }}
        >
          {(() => {
            const thumbnail = getRenderableEntryThumbnail(node.entry, node.size);
            return (
              <ExplorerEntryThumbnailStageContent
                entry={node.entry}
                fallbackIconSize={Math.max(14, node.size - 12)}
                fallbackIconSrc={iconSrc}
                hoverScrubEnabled={hoveredVideoThumbnailPath === node.entry.path}
                iconTheme={themeIconTheme}
                stageSize={node.size}
                thumbnail={thumbnail}
              />
            );
          })()}
        </div>
        {showsLabel && (
          <div style={{ minWidth: 0, flex: 1 }}>
            {isRenaming ? (
              <RenameInput
                state={rename}
                onCommit={commitRename}
                onCancel={() =>
                  setRename({ active: false, path: "", name: "" })
                }
              />
            ) : (
              <>
                <div
                  style={{
                    color: isSel
                      ? EXP.text
                      : node.entry.is_dir
                        ? EXP.yellow
                        : EXP.text,
                    fontWeight: node.entry.is_dir ? 620 : 540,
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {node.entry.name}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 9,
                    color: EXP.muted2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getEntryTypeLabel(node.entry)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderConstellationField = () => {
    if (!constellationFieldLayout) {
      return null;
    }

    const totalVisibleNodes = constellationFieldLayout.bands.reduce(
      (sum, band) => sum + band.nodes.length,
      0,
    );
    const zoomPercent = Math.round(constellationCamera.zoom * 100);
    const densityLabel = experimentalDensityDescriptor?.label ?? "Orbit";
    const hudCardStyle: CSSProperties = {
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(7, 10, 16, 0.68)",
      backdropFilter: explorerBlurEnabled ? "blur(16px)" : "none",
      WebkitBackdropFilter: explorerBlurEnabled ? "blur(16px)" : "none",
      boxShadow: "0 18px 42px rgba(0,0,0,0.22)",
      color: EXP.text,
      pointerEvents: "none",
    };

    return (
      <section style={{ minHeight: "100%", height: "100%", position: "relative" }}>
        <div
          ref={constellationViewportRef}
          role="group"
          aria-label="Constellation field"
          aria-roledescription="zoomable constellation canvas"
          data-overlay-constellation-viewport="true"
          data-overlay-constellation-zoom={String(zoomPercent)}
          onPointerDown={handleConstellationPointerDown}
          onPointerMove={handleConstellationPointerMove}
          onPointerUp={(event) => endConstellationPanGesture(event.pointerId)}
          onPointerCancel={(event) => endConstellationPanGesture(event.pointerId)}
          onLostPointerCapture={() => endConstellationPanGesture(null)}
          onWheel={handleConstellationWheel}
          onDoubleClick={handleConstellationViewportDoubleClick}
          style={{
            position: "relative",
            width: "100%",
            minHeight: "100%",
            height: "100%",
            borderRadius: previewSplitIsPane ? 28 : 0,
            border: previewSplitIsPane
              ? "1px solid var(--overlay-explorer-toolbar-border)"
              : "none",
            background:
              "radial-gradient(circle at 18% 22%, rgba(90, 130, 255, 0.16), transparent 24%), radial-gradient(circle at 78% 18%, rgba(255,255,255,0.09), transparent 18%), radial-gradient(circle at 54% 72%, rgba(95, 195, 255, 0.12), transparent 26%), linear-gradient(180deg, rgba(10, 13, 21, 0.98), rgba(5, 7, 12, 1))",
            overflow: "hidden",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.02), 0 18px 38px rgba(0,0,0,0.18)",
            cursor: constellationIsPanning ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          <div
            data-overlay-constellation-ui="true"
            style={{
              position: "absolute",
              inset: "18px 20px auto auto",
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                ...hudCardStyle,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "8px 12px",
                maxWidth: "min(520px, calc(100vw - 120px))",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: EXP.muted2,
                }}
              >
                Camera
              </span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{zoomPercent}%</span>
              <span style={{ fontSize: 11, color: EXP.muted2 }}>•</span>
              <span style={{ fontSize: 12, color: EXP.muted2 }}>Density</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{densityLabel}</span>
              <span style={{ fontSize: 11, color: EXP.muted2 }}>•</span>
              <span style={{ fontSize: 12, color: EXP.muted }}>
                {constellationFieldLayout.bands.length} bands
              </span>
              <span style={{ fontSize: 11, color: EXP.muted2 }}>•</span>
              <span style={{ fontSize: 12, color: EXP.muted }}>
                {totalVisibleNodes} visible
              </span>
            </div>
          </div>
          {newItem.visible && (
            <div
              data-overlay-constellation-ui="true"
              style={{
                position: "absolute",
                inset: "18px 18px auto 18px",
                zIndex: 4,
              }}
            >
              {renderExperimentalInlineNewItem(26)}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.07), transparent 28%), radial-gradient(circle at 78% 24%, rgba(255,255,255,0.05), transparent 24%), radial-gradient(circle at 50% 72%, rgba(255,255,255,0.04), transparent 34%)",
              opacity: 0.92,
              pointerEvents: "none",
            }}
          />
          <div
            data-overlay-constellation-world="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: constellationFieldLayout.width,
              height: constellationFieldLayout.height,
              transform: `translate3d(${constellationCamera.x}px, ${constellationCamera.y}px, 0) scale(${constellationCamera.zoom})`,
              transformOrigin: "top left",
              transition: constellationIsPanning
                ? "none"
                : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "transform",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px), radial-gradient(circle at center, rgba(255,255,255,0.05), transparent 62%)",
                backgroundSize: "82px 82px, 82px 82px, 100% 100%",
                backgroundPosition: "0 0, 0 0, center",
                maskImage:
                  "radial-gradient(circle at center, black 58%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(circle at center, black 58%, transparent 100%)",
                opacity: 0.8,
              }}
            />
            <svg
              viewBox={`0 0 ${constellationFieldLayout.width} ${constellationFieldLayout.height}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
            >
              <defs>
                <radialGradient id="explorer-constellation-cluster-glow">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
                  <stop offset="68%" stopColor={accent} stopOpacity="0.04" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </radialGradient>
              </defs>
              {constellationFieldLayout.bands.map((band) => (
                <g key={`cluster-${band.id}`}>
                  <circle
                    cx={band.centerX}
                    cy={band.centerY}
                    r={Math.max(64, band.radius * (band.dominant ? 0.44 : 0.34))}
                    fill="url(#explorer-constellation-cluster-glow)"
                    opacity={band.dominant ? 0.92 : 0.64}
                  />
                  <circle
                    cx={band.centerX}
                    cy={band.centerY}
                    r={band.dominant ? 9 : 7}
                    fill={accent}
                    fillOpacity={0.46}
                    stroke={accent}
                    strokeOpacity={0.68}
                  />
                </g>
              ))}
              {constellationFieldLayout.connections.map((connection) => (
                <line
                  key={connection.id}
                  x1={connection.fromX}
                  y1={connection.fromY}
                  x2={connection.toX}
                  y2={connection.toY}
                  stroke={connection.highlighted ? accent : "rgba(255,255,255,0.18)"}
                  strokeWidth={
                    connection.strength === "primary"
                      ? 1.35
                      : connection.strength === "bridge"
                        ? 1.1
                        : 0.8
                  }
                  strokeOpacity={
                    connection.highlighted
                      ? 0.88
                      : connection.strength === "secondary"
                        ? 0.26
                        : connection.strength === "bridge"
                          ? 0.34
                          : 0.52
                  }
                />
              ))}
            </svg>
            {constellationFieldLayout.bands.map((band) => (
              <div
                key={`chip-${band.id}`}
                style={{
                  position: "absolute",
                  left: band.chipX,
                  top: band.chipY,
                  transform: `translate(${band.chipAlign === "right" ? "-100%" : "0"}, -50%)`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  border: `1px solid ${band.dominant ? `${accent}44` : "rgba(255,255,255,0.12)"}`,
                  background: "rgba(12, 15, 22, 0.72)",
                  backdropFilter: explorerBlurEnabled ? "blur(12px)" : "none",
                  WebkitBackdropFilter: explorerBlurEnabled ? "blur(12px)" : "none",
                  padding: "8px 12px",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.16)",
                  color: EXP.text,
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: band.dominant ? accent : EXP.muted2,
                  }}
                >
                  {band.label}
                </span>
                <span style={{ fontSize: 11, color: EXP.muted }}>
                  {band.entries.length}
                </span>
                {band.hiddenEntryCount > 0 && (
                  <span style={{ fontSize: 10, color: accent }}>
                    +{band.hiddenEntryCount}
                  </span>
                )}
              </div>
            ))}
            {constellationFieldLayout.bands.map((band) =>
              band.nodes.map((node) => renderConstellationNode(band, node)),
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderTimelineSurfaceEntry = (entry: FileEntry) => {
    const isSel = selected.has(entry.path);
    const isDrop = dragOver === entry.path && entry.is_dir;
    const isRenaming = rename.active && rename.path === entry.path;
    const iconSrc = getExplorerEntryIconSrc(entry, isSel, isDrop);
    const thumbnail = getRenderableEntryThumbnail(entry, 42);
    const timelineBaseSurface: ExplorerEntrySurfaceState = {
      background: "var(--overlay-explorer-chip-bg)",
      borderColor: "var(--overlay-explorer-chip-border)",
      boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
      transform: "translateY(0)",
    };
    const timelineRestingSurface = isDrop
      ? dropEntrySurface
      : isSel
        ? selectedEntrySurface
        : timelineBaseSurface;
    return (
      <div
        key={entry.path}
        draggable
        data-overlay-drag-source="file"
        data-overlay-drop-target-path={entry.is_dir ? entry.path : undefined}
        onDragStart={(e) => onDragStart(e, entry)}
        onDragEnd={onDragEnd}
        onDragOver={entry.is_dir ? (e) => onDragOver(e, entry.path) : undefined}
        onDragLeave={(e) => onDragLeave(e, entry.path)}
        onDrop={entry.is_dir ? (e) => onDrop(e, entry.path) : undefined}
        onClick={(e) => onEntryClick(e, entry)}
        onDoubleClick={() => onEntryDoubleClick(entry)}
        onContextMenu={(e) => onRightClick(e, entry)}
        title={entry.path}
        style={{
          borderRadius: 18,
          border: `1px solid ${timelineRestingSurface.borderColor}`,
          background: timelineRestingSurface.background,
          boxShadow: timelineRestingSurface.boxShadow,
          padding: "12px 14px",
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          gap: 12,
          cursor: "pointer",
          userSelect: "none",
          minHeight: 92,
          transform: timelineRestingSurface.transform,
        }}
        onMouseEnter={(e) => {
          handleEntryPointerEnter(
            entry,
            e.currentTarget as HTMLDivElement,
            isSel,
            isDrop,
          );
        }}
        onMouseLeave={(e) => {
          handleEntryPointerLeave(
            entry,
            e.currentTarget as HTMLDivElement,
            isSel,
            isDrop,
            timelineBaseSurface,
          );
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            overflow: "hidden",
          }}
        >
          <ExplorerEntryThumbnailStageContent
            entry={entry}
            fallbackIconSize={24}
            fallbackIconSrc={iconSrc}
            hoverScrubEnabled={hoveredVideoThumbnailPath === entry.path}
            iconTheme={themeIconTheme}
            stageSize={42}
            thumbnail={thumbnail}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          {isRenaming ? (
            <RenameInput
              state={rename}
              onCommit={commitRename}
              onCancel={() => setRename({ active: false, path: "", name: "" })}
            />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      color: isSel
                        ? EXP.text
                        : entry.is_dir
                          ? EXP.yellow
                          : EXP.text,
                      fontWeight: entry.is_dir ? 650 : 560,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.name}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: EXP.muted2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {renderEntryInlineMeta(entry)}
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {entry.modified ? formatDate(entry.modified) : "Undated"}
                </div>
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: EXP.muted2,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {getEntryTypeLabel(entry)}
                </span>
                {entry.is_symlink && (
                  <span
                    style={{
                      fontSize: 9,
                      color: EXP.muted,
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 999,
                      padding: "2px 7px",
                    }}
                  >
                    symlink
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderTimelineSurfaceBand = (band: TimelineSurfaceBand) => {
    const timelineColumnWidth = Math.max(
      220,
      Math.round(332 - experimentalDensity * 120),
    );
    return (
      <section
        key={band.id}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(120px, 156px) minmax(0, 1fr)",
          gap: 18,
          marginBottom: 24,
          padding: "0 14px",
        }}
      >
        <div style={{ position: "relative", paddingLeft: 14 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              width: 2,
              borderRadius: 999,
              background: band.dominant ? accent : "rgba(255,255,255,0.10)",
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: band.dominant ? accent : EXP.muted2,
            }}
          >
            {band.label}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 11,
              color: EXP.muted,
              lineHeight: 1.45,
            }}
          >
            {band.description}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: EXP.muted2 }}>
            {band.entries.length} items
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${timelineColumnWidth}px, 1fr))`,
            gap: 12,
            alignItems: "stretch",
          }}
        >
          {band.entries.map(renderTimelineSurfaceEntry)}
        </div>
      </section>
    );
  };

  const hasResolvedExplorerLocation = currentPath.trim().length > 0;
  const showBlockingExplorerLoadingState =
    loading && !hasResolvedExplorerLocation;
  const shouldRenderExplorerContent = !showBlockingExplorerLoadingState;

  return (
    <div
      data-overlay-explorer
      data-overlay-explorer-view-mode={effectiveViewMode}
      data-overlay-explorer-experimental-mode={effectiveExperimentalViewMode}
      style={explorerRootStyle}
      onClick={() => {
        setSelected(new Set());
        setCtxMenu((c) => ({ ...c, visible: false }));
      }}
      onContextMenu={(e) => {
        const target = e.target instanceof HTMLElement ? e.target : null;
        if (
          target?.closest(
            'input, textarea, button, a, [contenteditable="true"], [role="button"]',
          )
        ) {
          return;
        }
        e.preventDefault();
        setSelected(new Set());
        setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, entry: null });
      }}
    >
      {/* ══ SIDEBAR ══ */}
      {shouldRenderRail && (
        <div
          data-overlay-explorer-plane="rail"
          style={{ display: "flex", minHeight: 0, minWidth: 0 }}
        >
          <ResizablePane
            size={sidebarWidth}
            minSize={sidebarBounds.minWidth}
            maxSize={sidebarBounds.maxWidth}
            onSizeChange={setSidebarWidth}
            borderColor={`${accent}55`}
            handleSide={effectiveRailPosition === "right" ? "left" : "right"}
            style={sidebarPaneStyle}
          >
            <ExplorerSideRail
              accent={accent}
              brandLabel={explorerTheme.railBrandLabel}
              sidebarWidth={sidebarWidth}
              currentPath={currentPath}
              locationTitle={locationTitle}
              locationLabel={locationLabel}
              drives={drives}
              drivesLoading={drivesLoading}
              showHiddenFiles={showHidden}
              isCompactDock={isCompactDock}
              savedSearches={savedSearches}
              availableTags={tagMetadata.tags}
              activeTagFilterIds={activeTagFilterIds}
              onNavigate={navigate}
              onGoHome={goHome}
              localTreeRefreshRevision={localTreeRefreshRevision}
              onOpenSavedSearch={(savedSearch) => {
                void applySavedSearch(savedSearch);
              }}
              onDeleteSavedSearch={(savedSearchId) => {
                void deleteExplorerSavedSearch(savedSearchId)
                  .then(() =>
                    setSavedSearches((current) =>
                      current.filter(
                        (savedSearch) => savedSearch.id !== savedSearchId,
                      ),
                    ),
                  )
                  .catch((deleteError) => setError(String(deleteError)));
              }}
              onToggleTagFilter={(tagId) =>
                setActiveTagFilterIds((current) =>
                  current.includes(tagId)
                    ? current.filter((candidate) => candidate !== tagId)
                    : [...current, tagId],
                )
              }
              onClearTagFilters={() => setActiveTagFilterIds([])}
              onBookmarkCreated={handleBookmarkCreated}
              resolveDroppedSources={resolveDroppedBookmarkSources}
              onCloseSources={closeSourcesPanel}
              chromeLayoutId={effectiveChromeLayoutId}
              chromeOverride={explorerChromeOverride}
              chromeEditMode={explorerChromeEditMode}
            />
          </ResizablePane>
        </div>
      )}

      {/* ══ MAIN ══ */}
      <div data-overlay-explorer-plane="main" style={mainColumnStyle}>
        {/* Toolbar */}
        <div
          data-overlay-explorer-plane="toolbar"
          style={toolbarContainerStyle}
        >
          {!shouldRenderRail && (
            <div
              data-overlay-explorer-panel-opener="sources"
              style={toolbarPrimaryRowStyle}
            >
              <button
                type="button"
                aria-label="Open sources panel"
                onClick={openSourcesPanel}
                title="Open the sources panel"
                style={toolbarToggleButtonStyle(false)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--overlay-explorer-chip-active-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    "var(--overlay-explorer-chip-bg)")
                }
              >
                {usesWorkspaceCompactChrome ? "Sources" : "Open Sources"}
              </button>
              {!usesWorkspaceCompactChrome && (
                <span style={{ fontSize: 10, color: EXP.muted2 }}>
                  Sources panel closed.
                </span>
              )}
            </div>
          )}
          {showsGlobalChromeControls && (
            <ExplorerChromeSurface
              surface={explorerTopbarSurface}
              getRowStyle={getExplorerChromeRowStyle}
              getZoneStyle={getExplorerChromeZoneStyle}
              renderControl={renderExplorerChromeControl}
              editMode={explorerChromeEditMode}
            />
          )}
          <ExplorerChromeSurface
            surface={explorerToolbarSurface}
            getRowStyle={getExplorerChromeRowStyle}
            getZoneStyle={getExplorerChromeZoneStyle}
            renderControl={renderExplorerChromeControl}
            editMode={explorerChromeEditMode}
          />
        </div>
        {repositoryPicker?.active && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              background: "var(--overlay-explorer-chip-active-bg)",
              borderBottom: "1px solid var(--overlay-explorer-toolbar-border)",
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: accent,
                }}
              >
                Repository Picker
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: EXP.muted }}>
                Select{" "}
                {repositoryPicker.allowMultiple
                  ? "one or more folders"
                  : "a folder"}{" "}
                in Explorer, then confirm them into Source Control.
                {selectedDirectoryEntries.length > 0
                  ? ` ${selectedDirectoryEntries.length} folder${selectedDirectoryEntries.length !== 1 ? "s" : ""} selected.`
                  : isRepositoryPickerUsingCurrentPath
                    ? " No folders selected yet, so OverlayTerm can add the current folder directly."
                    : " Only directories can be added."}
              </div>
              {isRepositoryPickerUsingCurrentPath ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: EXP.muted,
                    fontFamily:
                      appearance?.fonts.mono ??
                      'var(--overlay-font-mono, "Cascadia Code", Consolas, monospace)',
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={locationTitle}
                >
                  Current folder: {locationTitle}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() =>
                repositoryPicker.onConfirm(repositoryPickerConfirmationPaths)
              }
              disabled={!canConfirmRepositorySelection}
              style={{
                minHeight: 30,
                padding: "0 12px",
                borderRadius: "var(--overlay-explorer-control-radius)",
                border: `1px solid ${canConfirmRepositorySelection ? accent : EXP.border}`,
                background: canConfirmRepositorySelection
                  ? accent
                  : "var(--overlay-explorer-chip-bg)",
                color: canConfirmRepositorySelection
                  ? "var(--overlay-accent-contrast)"
                  : EXP.muted,
                cursor: canConfirmRepositorySelection ? "pointer" : "default",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {repositoryPickerConfirmLabel}
            </button>
            <button
              type="button"
              onClick={repositoryPicker.onCancel}
              style={{
                minHeight: 30,
                padding: "0 12px",
                borderRadius: "var(--overlay-explorer-control-radius)",
                border: "1px solid var(--overlay-explorer-chip-border)",
                background: "var(--overlay-explorer-chip-bg)",
                color: EXP.text,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error bar */}
        {error && (
          <div
            style={{
              background: "var(--overlay-explorer-danger-soft-bg)",
              borderBottom: `1px solid var(--overlay-explorer-danger-soft-border)`,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ color: EXP.red, fontSize: 11 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: EXP.red,
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* File area + preview */}
        <div
          data-overlay-explorer-plane="file-area"
          data-overlay-explorer-preview-split-mode={
            previewSplitIsPane ? "pane" : "inline"
          }
          style={fileAreaStyle}
          onWheel={handleExplorerLayoutWheel}
        >
          <div
            data-overlay-explorer-plane="content-shell"
            style={contentPaneShellStyle}
          >
            <OverlayScrollArea
              style={{ flex: 1, minHeight: 0 }}
              scrollbarStyle="explorer-file-list"
              viewportStyle={{
                padding: 0,
                ...(usesConstellationCanvas ? { overflow: "hidden" } : {}),
              }}
              contentStyle={
                usesConstellationCanvas
                  ? {
                      flex: "1 1 auto",
                      minHeight: "100%",
                    }
                  : undefined
              }
              viewportRef={explorerViewportRef}
            >
              <div
                ref={mainRef}
                data-overlay-explorer-plane="content-viewport"
                data-overlay-drop-target-path={EXPLORER_MAIN_DROP_TARGET}
                tabIndex={0}
                aria-busy={loading ? true : undefined}
                style={{
                  minHeight: "100%",
                  ...(usesConstellationCanvas ? { height: "100%" } : {}),
                  outline: "none",
                  background: "var(--overlay-explorer-content-bg)",
                  position: "relative",
                }}
                onClick={() => mainRef.current?.focus()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = resolveExplorerDropOperation(
                    e,
                    runtimePlatform,
                  );
                  setExplorerDragOverTarget(EXPLORER_MAIN_DROP_TARGET);
                }}
                onDragLeave={(e) => onDragLeave(e, EXPLORER_MAIN_DROP_TARGET)}
                onDrop={(e) => onDrop(e, currentPath)}
                onContextMenu={(e) => {
                  if (e.target !== e.currentTarget) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setCtxMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    entry: null,
                  });
                }}
                onDoubleClick={(e) => {
                  if (
                    !shouldNavigateUpOnEmptyExplorerDoubleClick({
                      enabled: doubleClickEmptyToGoBack,
                      target: e.target,
                      currentTarget: e.currentTarget,
                    })
                  ) {
                    return;
                  }

                  goUp();
                }}
              >
                {windowDropState.active && (
                  <div
                    style={{
                      position: "sticky",
                      top: 12,
                      zIndex: 5,
                      margin: "0 auto 12px",
                      width: "min(420px, calc(100% - 24px))",
                      border: `1px solid ${accent}`,
                      borderRadius: 10,
                      background: `linear-gradient(180deg, ${accent}20, rgba(16,18,26,0.92))`,
                      boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: accent,
                      }}
                    >
                      Import Files
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: EXP.text,
                      }}
                    >
                      Drop {windowDropState.count} item
                      {windowDropState.count === 1 ? "" : "s"} to copy into this
                      folder
                    </div>
                    <div
                      style={{ marginTop: 4, fontSize: 11, color: EXP.muted }}
                    >
                      External files are handled through the Rust transfer
                      pipeline.
                    </div>
                  </div>
                )}

                {showBlockingExplorerLoadingState && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 120,
                      gap: 10,
                      color: EXP.muted,
                    }}
                  >
                    <Loader
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <span style={{ fontSize: 12 }}>Loading…</span>
                  </div>
                )}

                {!loading && searchLoading && isSearchActive && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 120,
                      gap: 10,
                      color: EXP.muted,
                    }}
                  >
                    <Loader
                      size={16}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <span style={{ fontSize: 12 }}>Searching recursively…</span>
                  </div>
                )}

                {!loading && !searchLoading && visibleEntries.length === 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 120,
                      color: EXP.muted,
                      fontSize: 12,
                      textAlign: "center",
                      padding: "0 16px",
                    }}
                  >
                    {isSearchActive ? (
                      <span>
                        No results for "{search.trim()}"<br />
                        <span style={{ color: EXP.muted2, fontSize: 11 }}>
                          {searchIncludeContent
                            ? "Recursive text search is on."
                            : "Names-only search is on."}
                        </span>
                      </span>
                    ) : (
                      "Empty folder"
                    )}
                  </div>
                )}

                {shouldRenderExplorerContent &&
                  effectiveExperimentalViewMode === "adaptive-semantic-grid" &&
                  adaptiveDensityStop && (
                    <div style={{ minHeight: 0, padding: "14px 0 20px" }}>
                      {renderExperimentalInlineNewItem(
                        adaptiveDensityStop.presentation === "table"
                          ? (adaptiveDensityStop.table?.iconSize ?? 18)
                          : (adaptiveDensityStop.grid?.iconSize ?? 34),
                      )}

                      {experimentalSemanticBands.map(
                        renderAdaptiveSemanticBand,
                      )}
                    </div>
                  )}

                {shouldRenderExplorerContent &&
                  effectiveExperimentalViewMode === "constellation" && (
                    <div
                      style={{
                        minHeight: "100%",
                        height: "100%",
                        position: "relative",
                      }}
                    >
                      {renderConstellationField()}
                    </div>
                  )}

                {shouldRenderExplorerContent &&
                  effectiveExperimentalViewMode === "timeline-surface" && (
                    <div style={{ minHeight: 0, padding: "14px 0 24px" }}>
                      {renderExperimentalInlineNewItem(22)}
                      {timelineSurfaceBands.map(renderTimelineSurfaceBand)}
                    </div>
                  )}

                {/* Grid view */}
                {effectiveExperimentalViewMode === "off" &&
                  newItem.visible &&
                  virtualWindow.kind === "grid" &&
                  activeGridMetrics && (
                    <div
                      style={{
                        padding: `0 ${activeGridMetrics.padding}px ${activeGridMetrics.padding}px`,
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          background:
                            "var(--overlay-explorer-item-selected-bg)",
                          border:
                            "1px solid var(--overlay-explorer-item-selected-border)",
                          borderRadius: activeGridMetrics.tileRadius,
                          padding:
                            activeGridMetrics.iconSize <= 46
                              ? "8px 6px 6px"
                              : "10px 8px 8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 8,
                          height: activeGridMetrics.newItemHeight,
                          boxSizing: "border-box",
                          transition:
                            "border-radius 0.18s cubic-bezier(0.22, 1, 0.36, 1), padding 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
                        }}
                      >
                        <SvgIcon
                          src={
                            newItem.kind === "folder"
                              ? (resolveIconSrc(
                                  themeIconTheme.folder,
                                  themeIconTheme,
                                ) ?? "/icons/folder.svg")
                              : resolveFileIconSrc(
                                  "new-file.txt",
                                  "txt",
                                  themeIconTheme,
                                )
                          }
                          size={activeGridMetrics.iconSize}
                        />
                        <input
                          autoFocus
                          value={newItemName}
                          onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitNew();
                            if (e.key === "Escape")
                              setNewItem({ visible: false, kind: "folder" });
                          }}
                          onBlur={commitNew}
                          placeholder={
                            newItem.kind === "folder"
                              ? "folder name"
                              : "name.ext"
                          }
                          style={{
                            background: "var(--overlay-explorer-input-bg)",
                            border:
                              "1px solid var(--overlay-explorer-input-border)",
                            borderRadius:
                              "var(--overlay-explorer-control-radius)",
                            color: EXP.text,
                            fontSize: 11,
                            padding: "2px 6px",
                            outline: "none",
                            width: "100%",
                            boxSizing: "border-box" as const,
                          }}
                        />
                      </div>
                    </div>
                  )}

                {effectiveExperimentalViewMode === "off" &&
                  shouldRenderExplorerContent &&
                  virtualWindow.kind === "grid" &&
                  activeGridMetrics && (
                    <div style={{ minHeight: 0 }}>
                      <div style={{ height: virtualWindow.topSpacer }} />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${virtualWindow.columns}, minmax(0, 1fr))`,
                          gridAutoRows: `${virtualWindow.rowHeight}px`,
                          gap: activeGridMetrics.gap,
                          padding: `0 ${activeGridMetrics.padding}px`,
                          alignItems: "stretch",
                          transition: "gap 0.14s ease, padding 0.14s ease",
                        }}
                      >
                        {virtualizedEntries.map((entry) => {
                          const isSel = selected.has(entry.path);
                          const isDrop =
                            dragOver === entry.path && entry.is_dir;
                          const isRenaming =
                            rename.active && rename.path === entry.path;
                          const iconSrc = getExplorerEntryIconSrc(
                            entry,
                            isSel,
                            isDrop,
                          );
                          const thumbnail = getRenderableEntryThumbnail(
                            entry,
                            activeGridMetrics.iconStageSize,
                          );
                          return (
                            <div
                              key={entry.path}
                              draggable
                              data-entry-path={entry.path}
                              data-overlay-drag-source="file"
                              data-overlay-drop-target-path={
                                entry.is_dir ? entry.path : undefined
                              }
                              onDragStart={(e) => onDragStart(e, entry)}
                              onDragEnd={onDragEnd}
                              onDragOver={
                                entry.is_dir
                                  ? (e) => onDragOver(e, entry.path)
                                  : undefined
                              }
                              onDragLeave={(e) => onDragLeave(e, entry.path)}
                              onDrop={
                                entry.is_dir
                                  ? (e) => onDrop(e, entry.path)
                                  : undefined
                              }
                              onClick={(e) => onEntryClick(e, entry)}
                              onDoubleClick={() => onEntryDoubleClick(entry)}
                              onContextMenu={(e) => onRightClick(e, entry)}
                              title={getSearchTooltip(entry)}
                              style={{
                                background: isDrop
                                  ? dropEntrySurface.background
                                  : isSel
                                    ? selectedEntrySurface.background
                                    : idleEntrySurface.background,
                                border: `1px solid ${isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : idleEntrySurface.borderColor}`,
                                borderRadius: activeGridMetrics.tileRadius,
                                padding:
                                  activeGridMetrics.iconSize <= 46
                                    ? "8px 6px 6px"
                                    : "10px 8px 8px",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                gap: 8,
                                height: "100%",
                                minHeight: 0,
                                boxSizing: "border-box",
                                overflow: "hidden",
                                opacity: entry.is_hidden ? 0.5 : 1,
                                userSelect: "none",
                                boxShadow: isDrop
                                  ? dropEntrySurface.boxShadow
                                  : isSel
                                    ? selectedEntrySurface.boxShadow
                                    : idleEntrySurface.boxShadow,
                                transform: isDrop
                                  ? dropEntrySurface.transform
                                  : isSel
                                    ? selectedEntrySurface.transform
                                    : idleEntrySurface.transform,
                                transition:
                                  "background 0.14s ease, border-color 0.14s ease, transform 0.14s ease, border-radius 0.18s cubic-bezier(0.22, 1, 0.36, 1), padding 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
                              }}
                              onMouseEnter={(e) => {
                                handleEntryPointerEnter(
                                  entry,
                                  e.currentTarget as HTMLDivElement,
                                  isSel,
                                  isDrop,
                                );
                              }}
                              onMouseLeave={(e) => {
                                handleEntryPointerLeave(
                                  entry,
                                  e.currentTarget as HTMLDivElement,
                                  isSel,
                                  isDrop,
                                );
                              }}
                            >
                              <div
                                style={{
                                  width: activeGridMetrics.iconStageSize,
                                  height: activeGridMetrics.iconStageSize,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                  borderRadius: thumbnail
                                    ? Math.max(
                                        10,
                                        Math.round(
                                          activeGridMetrics.tileRadius * 0.72,
                                        ),
                                      )
                                    : undefined,
                                  border: thumbnail
                                    ? "1px solid color-mix(in srgb, var(--overlay-border-strong) 42%, transparent)"
                                    : undefined,
                                  background: thumbnail
                                    ? isSel
                                      ? "color-mix(in srgb, var(--overlay-bg-selection) 72%, var(--overlay-bg-panel))"
                                      : "color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)"
                                    : undefined,
                                  boxShadow: thumbnail
                                    ? "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)"
                                    : undefined,
                                  transition:
                                    "width 0.18s cubic-bezier(0.22, 1, 0.36, 1), height 0.18s cubic-bezier(0.22, 1, 0.36, 1)",
                                }}
                              >
                                <ExplorerEntryThumbnailStageContent
                                  entry={entry}
                                  fallbackIconSize={activeGridMetrics.iconSize}
                                  fallbackIconSrc={iconSrc}
                                  hoverScrubEnabled={
                                    hoveredVideoThumbnailPath === entry.path
                                  }
                                  iconTheme={themeIconTheme}
                                  stageSize={activeGridMetrics.iconStageSize}
                                  thumbnail={thumbnail}
                                />
                              </div>
                              {isRenaming ? (
                                <RenameInput
                                  state={rename}
                                  onCommit={commitRename}
                                  onCancel={() =>
                                    setRename({
                                      active: false,
                                      path: "",
                                      name: "",
                                    })
                                  }
                                />
                              ) : (
                                <span
                                  style={{
                                    fontSize:
                                      "var(--overlay-explorer-entry-title-size)",
                                    textAlign:
                                      explorerTheme.labelMode === "inline"
                                        ? "left"
                                        : "center",
                                    color: EXP.text,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "-webkit-box",
                                    WebkitLineClamp:
                                      activeGridMetrics.nameLines,
                                    WebkitBoxOrient: "vertical",
                                    width: "100%",
                                    lineHeight: 1.28,
                                    fontWeight:
                                      "var(--overlay-explorer-entry-title-weight)",
                                    letterSpacing:
                                      "var(--overlay-explorer-label-spacing)",
                                  }}
                                >
                                  {entry.name}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize:
                                    "var(--overlay-explorer-entry-meta-size)",
                                  textAlign:
                                    explorerTheme.labelMode === "inline"
                                      ? "left"
                                      : "center",
                                  color: EXP.muted2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  width: "100%",
                                  marginTop: -2,
                                }}
                              >
                                {getEntryStorageLabel(entry)}
                              </span>
                              {renderSearchMetadata(entry)}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ height: virtualWindow.bottomSpacer }} />
                    </div>
                  )}

                {effectiveExperimentalViewMode === "off" &&
                  newItem.visible &&
                  virtualWindow.kind === "list" &&
                  effectiveViewModeDefinition.presentation === "list" && (
                    <div
                      style={{
                        height: activeRowMetrics?.newItemHeight ?? 42,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "0 12px",
                        borderBottom:
                          "1px solid var(--overlay-explorer-toolbar-border)",
                        background: "var(--overlay-explorer-item-selected-bg)",
                        boxSizing: "border-box",
                      }}
                    >
                      <SvgIcon
                        src={
                          newItem.kind === "folder"
                            ? getIconSrc(
                                {
                                  name: "folder",
                                  path: currentPath,
                                  is_dir: true,
                                  size: 0,
                                  modified: 0,
                                  extension: "",
                                  is_hidden: false,
                                  is_symlink: false,
                                },
                                false,
                                {
                                  rules: explorerSettings.folderIconRules,
                                  defaultIcon:
                                    explorerSettings.defaultFolderIcon,
                                },
                                themeIconTheme,
                              )
                            : resolveFileIconSrc(
                                "new-file.txt",
                                "txt",
                                themeIconTheme,
                              )
                        }
                        size={activeRowMetrics?.iconSize ?? 16}
                      />
                      <input
                        autoFocus
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitNew();
                          if (e.key === "Escape")
                            setNewItem({ visible: false, kind: "folder" });
                        }}
                        onBlur={commitNew}
                        placeholder={
                          newItem.kind === "folder"
                            ? "folder name"
                            : "notes.md / app.py"
                        }
                        style={{
                          background: "var(--overlay-explorer-input-bg)",
                          border:
                            "1px solid var(--overlay-explorer-input-border)",
                          borderRadius:
                            "var(--overlay-explorer-control-radius)",
                          color: EXP.text,
                          fontSize: 12,
                          padding: "2px 6px",
                          outline: "none",
                          flex: 1,
                        }}
                      />
                    </div>
                  )}

                {effectiveExperimentalViewMode === "off" &&
                  shouldRenderExplorerContent &&
                  virtualWindow.kind === "list" &&
                  effectiveViewModeDefinition.presentation === "list" && (
                    <div style={{ minHeight: 0 }}>
                      <div style={{ height: virtualWindow.topSpacer }} />
                      {virtualizedEntries.map((entry) => {
                        const isSel = selected.has(entry.path);
                        const isDrop = dragOver === entry.path && entry.is_dir;
                        const isRenaming =
                          rename.active && rename.path === entry.path;
                        const iconSrc = getExplorerEntryIconSrc(
                          entry,
                          isSel,
                          isDrop,
                        );
                        const rowThumbnailStageSize = Math.max(
                          (activeRowMetrics?.iconSize ?? 16) + 12,
                          28,
                        );
                        const thumbnail = getRenderableEntryThumbnail(
                          entry,
                          rowThumbnailStageSize,
                        );
                        return (
                          <div
                            key={entry.path}
                            draggable
                            data-entry-path={entry.path}
                            data-overlay-drag-source="file"
                            data-overlay-drop-target-path={
                              entry.is_dir ? entry.path : undefined
                            }
                            onDragStart={(e) => onDragStart(e, entry)}
                            onDragEnd={onDragEnd}
                            onDragOver={
                              entry.is_dir
                                ? (e) => onDragOver(e, entry.path)
                                : undefined
                            }
                            onDragLeave={(e) => onDragLeave(e, entry.path)}
                            onDrop={
                              entry.is_dir
                                ? (e) => onDrop(e, entry.path)
                                : undefined
                            }
                            onClick={(e) => onEntryClick(e, entry)}
                            onDoubleClick={() => onEntryDoubleClick(entry)}
                            onContextMenu={(e) => onRightClick(e, entry)}
                            title={getSearchTooltip(entry)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              height: virtualWindow.rowHeight,
                              padding: "0 12px",
                              borderBottomWidth: 1,
                              borderBottomStyle: "solid",
                              borderBottomColor: isDrop
                                ? dropEntrySurface.borderColor
                                : isSel
                                  ? selectedEntrySurface.borderColor
                                  : "var(--overlay-explorer-toolbar-border)",
                              background: isDrop
                                ? dropEntrySurface.background
                                : isSel
                                  ? selectedEntrySurface.background
                                  : idleEntrySurface.background,
                              cursor: "pointer",
                              opacity: entry.is_hidden ? 0.5 : 1,
                              userSelect: "none",
                              boxSizing: "border-box",
                              boxShadow: isDrop
                                ? dropEntrySurface.boxShadow
                                : isSel
                                  ? selectedEntrySurface.boxShadow
                                  : idleEntrySurface.boxShadow,
                              transform: isDrop
                                ? dropEntrySurface.transform
                                : isSel
                                  ? selectedEntrySurface.transform
                                  : idleEntrySurface.transform,
                            }}
                            onMouseEnter={(e) => {
                              handleEntryPointerEnter(
                                entry,
                                e.currentTarget as HTMLDivElement,
                                isSel,
                                isDrop,
                              );
                            }}
                            onMouseLeave={(e) => {
                              handleEntryPointerLeave(
                                entry,
                                e.currentTarget as HTMLDivElement,
                                isSel,
                                isDrop,
                              );
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  width: rowThumbnailStageSize,
                                  height: rowThumbnailStageSize,
                                  minWidth: rowThumbnailStageSize,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  borderRadius: thumbnail ? 10 : undefined,
                                  border: thumbnail
                                    ? "1px solid color-mix(in srgb, var(--overlay-border-strong) 42%, transparent)"
                                    : undefined,
                                  background: thumbnail
                                    ? "color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)"
                                    : undefined,
                                  boxShadow: thumbnail
                                    ? "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)"
                                    : undefined,
                                  flexShrink: 0,
                                }}
                              >
                                <ExplorerEntryThumbnailStageContent
                                  entry={entry}
                                  fallbackIconSize={
                                    activeRowMetrics?.iconSize ?? 16
                                  }
                                  fallbackIconSrc={iconSrc}
                                  hoverScrubEnabled={
                                    hoveredVideoThumbnailPath === entry.path
                                  }
                                  iconTheme={themeIconTheme}
                                  stageSize={rowThumbnailStageSize}
                                  thumbnail={thumbnail}
                                />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                {isRenaming ? (
                                  <RenameInput
                                    state={rename}
                                    onCommit={commitRename}
                                    onCancel={() =>
                                      setRename({
                                        active: false,
                                        path: "",
                                        name: "",
                                      })
                                    }
                                  />
                                ) : (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      minWidth: 0,
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: isSel
                                          ? EXP.text
                                          : entry.is_dir
                                            ? EXP.yellow
                                            : EXP.text,
                                        fontWeight: entry.is_dir ? 600 : 450,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        minWidth: 0,
                                      }}
                                    >
                                      {entry.name}
                                    </span>
                                    {entry.is_symlink && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          color: EXP.muted,
                                          background:
                                            "var(--overlay-explorer-chip-bg)",
                                          borderRadius:
                                            "var(--overlay-explorer-control-radius)",
                                          padding: "1px 4px",
                                          flexShrink: 0,
                                        }}
                                      >
                                        symlink
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div
                                  style={{
                                    marginTop: 2,
                                    fontSize: 10,
                                    color: EXP.muted2,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {renderEntryInlineMeta(entry)}
                                </div>
                                {renderSearchMetadata(entry)}
                              </div>
                            </div>
                            <div
                              style={{
                                flexShrink: 0,
                                fontSize: 10,
                                color: EXP.muted,
                                whiteSpace: "nowrap",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              {getEntryTypeLabel(entry)}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ height: virtualWindow.bottomSpacer }} />
                    </div>
                  )}

                {effectiveExperimentalViewMode === "off" &&
                  newItem.visible &&
                  virtualWindow.kind === "list" &&
                  effectiveViewModeDefinition.presentation === "table" && (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                      }}
                    >
                      <tbody>
                        <tr
                          style={{
                            background:
                              "var(--overlay-explorer-item-selected-bg)",
                            borderBottom:
                              "1px solid var(--overlay-explorer-toolbar-border)",
                            height: activeRowMetrics?.newItemHeight ?? 42,
                            boxSizing: "border-box",
                          }}
                        >
                          <td style={{ padding: "4px 12px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <SvgIcon
                                src={
                                  newItem.kind === "folder"
                                    ? getIconSrc(
                                        {
                                          name: "folder",
                                          path: currentPath,
                                          is_dir: true,
                                          size: 0,
                                          modified: 0,
                                          extension: "",
                                          is_hidden: false,
                                          is_symlink: false,
                                        },
                                        false,
                                        {
                                          rules:
                                            explorerSettings.folderIconRules,
                                          defaultIcon:
                                            explorerSettings.defaultFolderIcon,
                                        },
                                        themeIconTheme,
                                      )
                                    : resolveFileIconSrc(
                                        "new-file.txt",
                                        "txt",
                                        themeIconTheme,
                                      )
                                }
                                size={activeRowMetrics?.iconSize ?? 16}
                              />
                              <input
                                autoFocus
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitNew();
                                  if (e.key === "Escape")
                                    setNewItem({
                                      visible: false,
                                      kind: "folder",
                                    });
                                }}
                                onBlur={commitNew}
                                placeholder={
                                  newItem.kind === "folder"
                                    ? "folder name"
                                    : "notes.md / app.py"
                                }
                                style={{
                                  background:
                                    "var(--overlay-explorer-input-bg)",
                                  border:
                                    "1px solid var(--overlay-explorer-input-border)",
                                  borderRadius:
                                    "var(--overlay-explorer-control-radius)",
                                  color: EXP.text,
                                  fontSize: 12,
                                  padding: "2px 6px",
                                  outline: "none",
                                  flex: 1,
                                }}
                              />
                            </div>
                          </td>
                          <td />
                          <td />
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  )}

                {effectiveExperimentalViewMode === "off" &&
                  shouldRenderExplorerContent &&
                  virtualWindow.kind === "list" &&
                  effectiveViewModeDefinition.presentation === "table" && (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                        tableLayout: "fixed",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "var(--overlay-explorer-toolbar-bg)",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          {[
                            { key: "name", label: "Name" },
                            { key: "size", label: "Size" },
                            { key: "date", label: "Modified" },
                            { key: "type", label: "Type" },
                          ].map((column) => (
                            <th
                              key={column.key}
                              style={{
                                padding: "6px 12px",
                                textAlign: "left",
                                color: EXP.muted,
                                fontWeight: 600,
                                fontSize: 10,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                borderBottom:
                                  "1px solid var(--overlay-explorer-toolbar-border)",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  toggleSort(column.key as ExplorerSortKey)
                                }
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color:
                                    explorerSettings.sortBy === column.key
                                      ? EXP.text
                                      : EXP.muted,
                                  cursor: "pointer",
                                  fontSize: 10,
                                  fontWeight: 600,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                }}
                              >
                                <span>{column.label}</span>
                                <span
                                  style={{
                                    color:
                                      explorerSettings.sortBy === column.key
                                        ? accent
                                        : EXP.muted2,
                                  }}
                                >
                                  {explorerSettings.sortBy === column.key
                                    ? explorerSettings.sortOrder === "asc"
                                      ? "↑"
                                      : "↓"
                                    : "·"}
                                </span>
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ height: virtualWindow.topSpacer }}>
                          <td
                            colSpan={4}
                            style={{ padding: 0, border: "none" }}
                          />
                        </tr>
                        {virtualizedEntries.map((entry) => {
                          const isSel = selected.has(entry.path);
                          const isDrop =
                            dragOver === entry.path && entry.is_dir;
                          const isRenaming =
                            rename.active && rename.path === entry.path;
                          const iconSrc = getExplorerEntryIconSrc(
                            entry,
                            isSel,
                            isDrop,
                          );
                          const rowThumbnailStageSize = Math.max(
                            (activeRowMetrics?.iconSize ?? 16) + 12,
                            28,
                          );
                          const thumbnail = getRenderableEntryThumbnail(
                            entry,
                            rowThumbnailStageSize,
                          );
                          const isDetailsMode = effectiveViewMode === "details";
                          return (
                            <tr
                              key={entry.path}
                              draggable
                              data-entry-path={entry.path}
                              data-overlay-drag-source="file"
                              data-overlay-drop-target-path={
                                entry.is_dir ? entry.path : undefined
                              }
                              onDragStart={(e) => onDragStart(e, entry)}
                              onDragEnd={onDragEnd}
                              onDragOver={
                                entry.is_dir
                                  ? (e) => onDragOver(e, entry.path)
                                  : undefined
                              }
                              onDragLeave={(e) => onDragLeave(e, entry.path)}
                              onDrop={
                                entry.is_dir
                                  ? (e) => onDrop(e, entry.path)
                                  : undefined
                              }
                              onClick={(e) => onEntryClick(e, entry)}
                              onDoubleClick={() => onEntryDoubleClick(entry)}
                              onContextMenu={(e) => onRightClick(e, entry)}
                              title={getSearchTooltip(entry)}
                              style={{
                                background: isDrop
                                  ? dropEntrySurface.background
                                  : isSel
                                    ? selectedEntrySurface.background
                                    : idleEntrySurface.background,
                                cursor: "pointer",
                                opacity: entry.is_hidden ? 0.5 : 1,
                                userSelect: "none",
                                borderBottom:
                                  "1px solid var(--overlay-explorer-toolbar-border)",
                                height: virtualWindow.rowHeight,
                                boxSizing: "border-box",
                                boxShadow: isDrop
                                  ? dropEntrySurface.boxShadow
                                  : isSel
                                    ? selectedEntrySurface.boxShadow
                                    : idleEntrySurface.boxShadow,
                                transform: isDrop
                                  ? dropEntrySurface.transform
                                  : isSel
                                    ? selectedEntrySurface.transform
                                    : idleEntrySurface.transform,
                              }}
                              onMouseEnter={(e) => {
                                handleEntryPointerEnter(
                                  entry,
                                  e.currentTarget as HTMLTableRowElement,
                                  isSel,
                                  isDrop,
                                );
                              }}
                              onMouseLeave={(e) => {
                                handleEntryPointerLeave(
                                  entry,
                                  e.currentTarget as HTMLTableRowElement,
                                  isSel,
                                  isDrop,
                                );
                              }}
                            >
                              <td
                                style={{
                                  padding: isDetailsMode
                                    ? "6px 12px"
                                    : "4px 12px",
                                  verticalAlign: "top",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: rowThumbnailStageSize,
                                      height: rowThumbnailStageSize,
                                      minWidth: rowThumbnailStageSize,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                      borderRadius: thumbnail ? 10 : undefined,
                                      border: thumbnail
                                        ? "1px solid color-mix(in srgb, var(--overlay-border-strong) 42%, transparent)"
                                        : undefined,
                                      background: thumbnail
                                        ? "color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)"
                                        : undefined,
                                      boxShadow: thumbnail
                                        ? "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)"
                                        : undefined,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <ExplorerEntryThumbnailStageContent
                                      entry={entry}
                                      fallbackIconSize={
                                        activeRowMetrics?.iconSize ?? 16
                                      }
                                      fallbackIconSrc={iconSrc}
                                      hoverScrubEnabled={
                                        hoveredVideoThumbnailPath ===
                                        entry.path
                                      }
                                      iconTheme={themeIconTheme}
                                      stageSize={rowThumbnailStageSize}
                                      thumbnail={thumbnail}
                                    />
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    {isRenaming ? (
                                      <RenameInput
                                        state={rename}
                                        onCommit={commitRename}
                                        onCancel={() =>
                                          setRename({
                                            active: false,
                                            path: "",
                                            name: "",
                                          })
                                        }
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 8,
                                          minWidth: 0,
                                        }}
                                      >
                                        <span
                                          style={{
                                            color: isSel
                                              ? EXP.text
                                              : entry.is_dir
                                                ? EXP.yellow
                                                : EXP.text,
                                            fontWeight: entry.is_dir
                                              ? 600
                                              : isDetailsMode
                                                ? 500
                                                : 400,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            minWidth: 0,
                                            flex: 1,
                                          }}
                                        >
                                          {entry.name}
                                        </span>
                                        {entry.is_symlink && (
                                          <span
                                            style={{
                                              fontSize: 9,
                                              color: EXP.muted,
                                              background:
                                                "var(--overlay-explorer-chip-bg)",
                                              borderRadius:
                                                "var(--overlay-explorer-control-radius)",
                                              padding: "1px 4px",
                                              flexShrink: 0,
                                            }}
                                          >
                                            symlink
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {isDetailsMode && !isRenaming && (
                                      <div
                                        style={{
                                          marginTop: 2,
                                          fontSize: 10,
                                          color: EXP.muted2,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {renderEntryInlineMeta(entry)}
                                      </div>
                                    )}
                                    {renderSearchMetadata(entry)}
                                  </div>
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: isDetailsMode
                                    ? "6px 12px"
                                    : "4px 12px",
                                  color: EXP.muted,
                                  fontFamily: "monospace",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {getEntryStorageLabel(entry)}
                              </td>
                              <td
                                style={{
                                  padding: isDetailsMode
                                    ? "6px 12px"
                                    : "4px 12px",
                                  color: EXP.muted,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {formatDate(entry.modified)}
                              </td>
                              <td
                                style={{
                                  padding: isDetailsMode
                                    ? "6px 12px"
                                    : "4px 12px",
                                  color: EXP.muted2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {getEntryTypeLabel(entry)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ height: virtualWindow.bottomSpacer }}>
                          <td
                            colSpan={4}
                            style={{ padding: 0, border: "none" }}
                          />
                        </tr>
                      </tbody>
                    </table>
                  )}
              </div>
            </OverlayScrollArea>
          </div>

          {/* Side pane */}
          {previewPanelVisible && (
            <PreviewPanel
              preview={preview}
              width={previewWidth}
              placement={previewPlacement}
              presentationMode={previewSplitMode}
              previewLocked={previewLocked}
              previewSurfaceMode={previewSurfaceMode}
              previewTerminalMounted={previewTerminalMounted}
              previewTerminalCommandRequest={previewTerminalCommandRequest}
              previewTerminalWorkingDirectory={previewTerminalWorkingDirectory}
              previewTerminalReportedWorkingDirectory={
                previewTerminalReportedWorkingDirectory
              }
              previewTerminalNamespace={previewTerminalNamespace}
              onWidthChange={setPreviewWidth}
              onTextChange={updatePreviewTextContent}
              onTextSave={persistPreviewText}
              onShaderSourceChange={updateShaderPreviewContent}
              onShaderSelectionChange={updateShaderPreviewSelection}
              onShaderCompileResult={updateShaderPreviewCompileResult}
              onShaderSceneChange={updateShaderPreviewScene}
              onShaderSave={persistShaderPreviewSource}
              onRefreshPreviewEntry={refresh}
              onPdfDocumentChange={updatePdfPreviewDocument}
              onPdfChromeStateChange={handlePdfPreviewChromeStateChange}
              onRegisterCloseGuard={registerPreviewCloseGuard}
              onCopyPath={copyToSysClipboard}
              onTogglePresentationMode={() =>
                setPreviewSplitMode((current) =>
                  current === "pane" ? "inline" : "pane",
                )
              }
              onTogglePreviewLock={togglePreviewLock}
              onTogglePreviewTerminal={togglePreviewTerminal}
              onRunTextScript={runPreviewTextScript}
              onStopTextScriptRun={stopPreviewTextScriptRun}
              onPreviewTerminalCommandHandled={
                handlePreviewTerminalCommandHandled
              }
              onPreviewTerminalReportedWorkingDirectoryChange={
                handlePreviewTerminalReportedWorkingDirectoryChange
              }
              viewMode={documentViewMode}
              onViewModeChange={setDocumentViewMode}
              explorerTheme={explorerTheme}
              blurEnabled={explorerBlurEnabled}
              chromeLayoutId={effectiveChromeLayoutId}
              chromeOverride={explorerChromeOverride}
              chromeEditMode={explorerChromeEditMode}
              showHiddenFiles={showHidden}
              editorSettings={editorSettings}
              shaderPerformanceMode={shaderPerformanceMode}
              onOpenFolderPreviewEntry={openFolderPreviewEntry}
              onExtractArchive={(mode) => {
                if (preview.type === "archive") {
                  void handleArchiveAction(
                    {
                      path: preview.path,
                      name: preview.name,
                      size: preview.size,
                      is_dir: false,
                      modified: Date.now(),
                      extension: getEntryExtension({
                        name: preview.name,
                        extension: "",
                        is_dir: false,
                      }),
                      is_hidden: false,
                      is_symlink: false,
                    },
                    mode,
                  );
                }
              }}
              onClose={() => {
                void closePreviewPanel();
              }}
            />
          )}
        </div>

        {/* Status bar */}
        {shouldRenderStatusBar && (
          <div data-overlay-explorer-plane="status" style={statusBarStyle}>
            <ExplorerChromeSurface
              surface={explorerStatusBarSurface}
              style={{ width: "100%", minWidth: 0 }}
              getRowStyle={getExplorerStatusBarRowStyle}
              getZoneStyle={getExplorerStatusBarZoneStyle}
              renderControl={renderExplorerChromeControl}
              editMode={explorerChromeEditMode}
            />
            <div
              data-overlay-explorer-status-task-anchor="true"
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "auto",
              }}
            >
              <ExplorerTaskStatusBadge
                accent={accent}
                text={EXP.text}
                muted={EXP.muted}
                border={EXP.border}
                danger={EXP.red}
                background="rgba(255,255,255,0.02)"
              />
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      <ContextMenu
        state={ctxMenu}
        items={
          ctxMenu.entry ? buildCtxItems(ctxMenu.entry) : buildEmptyCtxItems()
        }
        onClose={() => setCtxMenu((c) => ({ ...c, visible: false }))}
      />

      {deleteTargets.length > 0 && (
        <TrashDialog
          entries={deleteTargets}
          onConfirm={() => {
            void confirmTrash();
          }}
          onDeletePermanently={() => {
            void permanentlyDeleteTargets();
          }}
          onCancel={() => setDeleteTargets([])}
        />
      )}

      {transferConflictDialog.visible && (
        <TransferConflictDialog
          state={transferConflictDialog}
          policy={transferConflictPolicy}
          onPolicyChange={setTransferConflictPolicy}
          onConfirm={confirmTransferConflictDialog}
          onCancel={closeTransferConflictDialog}
        />
      )}

      {saveSearchState.visible && (
        <SaveSearchDialog
          state={saveSearchState}
          onChangeName={(name) =>
            setSaveSearchState((current) => ({ ...current, name }))
          }
          onConfirm={() => {
            void saveCurrentSearch();
          }}
          onCancel={() => setSaveSearchState({ visible: false, name: "" })}
        />
      )}

      <AppPromptDialog
        open={tagDialog.visible}
        title={tagDialog.title}
        description={tagDialog.description}
        icon={<Tags size={16} />}
        value={tagDialog.input}
        onChange={(value) =>
          setTagDialog((current) => ({ ...current, input: value }))
        }
        onSubmit={() => {
          void submitTagDialog();
        }}
        onCancel={closeTagDialog}
        submitLabel={tagDialog.mode === "add" ? "Apply Tags" : "Remove Tags"}
        placeholder="tag-one, tag-two"
      />

      {batchRename.visible && (
        <BatchRenameDialog
          state={batchRename}
          preview={batchRenamePreview.rows}
          onChange={(updates) =>
            setBatchRename((current) => ({ ...current, ...updates }))
          }
          onConfirm={() => {
            void commitBatchRename();
          }}
          onCancel={() =>
            setBatchRename((current) => ({ ...current, visible: false }))
          }
        />
      )}

      {duplicateFinder.visible && (
        <DuplicateFinderDialog
          state={duplicateFinder}
          onCancelScan={() => {
            if (duplicateFinder.scanId) {
              void cancelExplorerDuplicateScan(duplicateFinder.scanId);
            }
            setDuplicateFinder((current) => ({ ...current, loading: false }));
          }}
          onClose={() =>
            setDuplicateFinder({
              visible: false,
              scanId: null,
              status: null,
              loading: false,
            })
          }
          onSelectPath={(path) => {
            const parentPath = path.replace(/[/\\][^/\\]+$/, "");
            if (parentPath && parentPath !== currentPath) {
              void navigate(parentPath).finally(() => {
                setSelected(new Set([path]));
                lastSelected.current = path;
                selectionRangeAnchorPathRef.current = path;
              });
            } else {
              setSelected(new Set([path]));
              lastSelected.current = path;
              selectionRangeAnchorPathRef.current = path;
            }
          }}
          onRevealPath={(path) => {
            void revealExplorerPath(path).catch((revealError) =>
              setError(String(revealError)),
            );
          }}
          onTrashPath={(path) => {
            const entry = duplicateEntryLookup.get(path);
            if (entry) {
              openTrashDialog([entry]);
            }
          }}
          onDeletePath={(path) => {
            const entry = duplicateEntryLookup.get(path);
            if (entry) {
              setDeleteTargets([entry]);
            }
          }}
        />
      )}

      {propertiesPanel.visible && (
        <ExplorerPropertiesDialog
          state={propertiesPanel}
          entries={propertiesPanelEntries}
          primaryEntry={propertiesPanelPrimaryEntry}
          itemProperties={propertiesInfoByPath}
          recursiveSummary={propertiesPanelRecursiveSummary}
          checksumResults={propertiesChecksums}
          checksumLoadingPaths={propertiesChecksumLoadingPaths}
          checksumError={propertiesChecksumError}
          supportsNativeProperties={supportsNativeProperties}
          onTabChange={(tab) =>
            setPropertiesPanel({
              loading: propertiesPanel.loading,
              targetPaths: propertiesPanel.targetPaths,
              tab,
              visible: true,
            })
          }
          onCalculateChecksums={() => {
            void runPropertiesChecksumCalculation();
          }}
          onCalculateRecursiveSize={() => {
            void runRecursiveSizeCalculation();
          }}
          onOpenNativeProperties={openNativeProperties}
          onClose={() => setPropertiesPanel(null)}
        />
      )}

      {jumpFilter.active && jumpFilter.query && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 10001,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              display: "grid",
              gap: 6,
              minWidth: 240,
              maxWidth: 360,
              padding: "10px 12px",
              borderRadius: 16,
              border: "1px solid var(--overlay-explorer-toolbar-border)",
              background:
                "color-mix(in srgb, var(--overlay-explorer-preview-bg) 92%, transparent)",
              boxShadow: "var(--overlay-explorer-hud-shadow)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  color: EXP.text,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Jump Filter
              </div>
              <button
                type="button"
                onClick={() => setJumpFilter(null)}
                style={dialogSecondaryButtonStyle}
              >
                Clear
              </button>
            </div>
            <div
              style={{
                color: EXP.text,
                fontSize: 13,
                fontWeight: 600,
                wordBreak: "break-all",
              }}
            >
              {jumpFilter.query}
            </div>
            <div style={{ color: EXP.muted, fontSize: 11 }}>
              {jumpFilter.resultPaths.length === 0
                ? "No matching entries"
                : `${jumpFilter.resultPaths.length} match${jumpFilter.resultPaths.length === 1 ? "" : "es"} · item ${Math.max(0, jumpFilter.resultIndex) + 1} focused`}
            </div>
            <div style={{ color: EXP.muted2, fontSize: 10 }}>
              Type to filter, Backspace to edit, arrows to move, Enter to open,
              Esc to clear.
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default FileExplorer;
