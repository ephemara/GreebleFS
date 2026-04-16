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
  Suspense, startTransition, useState, useEffect, useRef, useCallback, useMemo, useId, type CSSProperties,
} from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useShallow } from 'zustand/react/shallow';
import type { EditorProps as MonacoEditorProps } from '@monaco-editor/react';
import {
  ChevronRight, ChevronLeft, ArrowUp, Search, RefreshCw,
  X, Star, StarOff, Terminal,
  Trash2, Copy, Scissors, Clipboard, Edit3, ExternalLink,
  Shield, Eye, Info, Loader, Puzzle, Sparkles,
  FilePlus, FolderPlus, CopyPlus, Save, Tags, Undo2,
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
  resolveEffectiveExplorerModeProfile,
  resolveExplorerModeProfileChromeLayoutId,
  type ExplorerModeProfileDefinition,
} from '../config/explorerModeProfiles';
import { getFolderIconSrc } from '../config/folderIcons';
import { getBuiltInIconTheme, resolveFileIconSrc, resolveIconSrc } from '../config/iconTheme';
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
} from '../store/explorerStore';
import {
  useExplorerTaskProgressFeed,
} from '../store/explorerTaskStore';
import { useSettingsStore } from '../store/settingsStore';
import { shouldOpenExplorerEntryOnTrigger } from './fileExplorerClickBehavior';
import { resolveExplorerSearchScope } from './fileExplorerSearchScope';
import type { DocumentPreviewKind } from './documentPreview';
import {
  EXPLORER_IMAGE_TILE_PREVIEW_CONFIG,
  getModelPreviewFormat,
  getMonacoLanguage,
  isEditableTextExtension,
  isExecutableExtension,
  isImagePreviewExtension,
  type ModelPreviewFormat,
} from '../config/filePreview';
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
  type EditorSearchFocusTarget,
} from './fileExplorerSearchFocus';
import { dispatchTerminalCommand, resolvePluginCommandTemplate } from '../config/pluginContributions';
import {
  explorerBackendContract,
  type ExplorerBatchRenameItem,
  type ExplorerBackendContract,
  type ExplorerDuplicateScan,
  type ExplorerDriveInfo as DriveInfo,
  type ExplorerEntryStorageInfo as EntryStorageInfo,
  type ExplorerFileEntry as FileEntry,
  type ExplorerFileTransferOperation as FileTransferOperation,
  type ExplorerFileTransferResult as FileTransferResult,
  type ExplorerFileSearchResult as FileSearchResult,
  type ExplorerSavedSearch,
  type ExplorerTagMetadataSnapshot,
} from '../runtime/explorerBackend';
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

const LazyModelPreview = React.lazy(() =>
  import('./ModelPreview').then(module => ({ default: module.ModelPreview })),
);

const LazyTextDocumentPreview = React.lazy(() =>
  import('./documentPreview').then(module => ({ default: module.TextDocumentPreview })),
);

const LazyMonacoEditor = React.lazy(async () => {
  const module = await import('@monaco-editor/react');
  return { default: module.default as React.ComponentType<MonacoEditorProps> };
});

const EXPLORER_LIST_ROW_HEIGHT = 44;
const EXPLORER_LIST_SEARCH_ROW_HEIGHT = 72;
const EXPLORER_LIST_OVERSCAN = 8;
const EXPLORER_GRID_OVERSCAN_ROWS = 2;
const EXPLORER_LAYOUT_WHEEL_STEP_DELTA = 80;
const EXPLORER_ENTRY_SIZE_BATCH_SETTLE_MS = 72;
const EXPLORER_NATIVE_ICON_BATCH_SETTLE_MS = 96;
const EXPLORER_IMAGE_TILE_THUMBNAIL_BATCH_SETTLE_MS = 88;

type ExplorerSearchCacheEntry = {
  results: FileSearchResult[];
  diagnostics: Awaited<ReturnType<ExplorerBackendContract['searchEntriesWithDiagnostics']>>['diagnostics'];
};

const explorerSearchResultCache = new Map<string, Promise<ExplorerSearchCacheEntry> | ExplorerSearchCacheEntry>();

function getExplorerSearchCacheKey(args: {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent: boolean;
}): string {
  return [
    args.path,
    args.query.trim().toLowerCase(),
    args.showHidden ? 'hidden' : 'visible',
    args.includeContent ? 'content' : 'names',
  ].join('::');
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
  if (!pathPrefix) {
    explorerSearchResultCache.clear();
    return;
  }

  for (const key of explorerSearchResultCache.keys()) {
    if (key.startsWith(`${pathPrefix}::`) || key.includes(`::${pathPrefix}::`)) {
      explorerSearchResultCache.delete(key);
    }
  }
}

function getExplorerPerformanceNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function getDocumentPreviewKind(path: string): DocumentPreviewKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') {
    return 'markdown';
  }
  if (ext === 'html' || ext === 'htm') {
    return 'html';
  }
  return 'none';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViewportMetrics {
  scrollTop: number;
  clientHeight: number;
  clientWidth: number;
}
interface ContextMenuState { visible: boolean; x: number; y: number; entry: FileEntry | null; }
interface RenameState    { active: boolean; path: string; name: string; }
interface BatchRenameState {
  visible: boolean;
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
interface DuplicateFinderState {
  visible: boolean;
  scanId: string | null;
  status: ExplorerDuplicateScan | null;
  loading: boolean;
}
type PreviewState =
  | { type: 'none'; path: string }
  | { type: 'image'; path: string; name: string; content: string }
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
  bg:      'var(--overlay-bg-shell)', panel:   'var(--overlay-bg-panel)', sidebar: 'var(--overlay-bg-sidebar)',
  card:    'var(--overlay-bg-card)', cardHov: 'var(--overlay-bg-card-hover)',
  border:  'var(--overlay-border)',
  accent:  'var(--overlay-accent)', accent2: 'var(--overlay-accent)',
  text:    'var(--overlay-text-primary)', muted:   'var(--overlay-text-muted)', muted2: 'var(--overlay-text-dim)',
  selected:'var(--overlay-bg-selection)', selBord: 'var(--overlay-accent)',
  red:     'var(--overlay-danger)', green:   'var(--overlay-success)', yellow:  'var(--overlay-warning)',
};

function getPathLeaf(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return 'Home';
  }
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? trimmed) : trimmed;
}

function toolbarChipButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: disabled ? 'var(--overlay-explorer-chip-bg)' : 'var(--overlay-explorer-chip-active-bg)',
    border: `1px solid ${disabled ? 'var(--overlay-explorer-chip-border)' : 'var(--overlay-explorer-chip-active-border)'}`,
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? EXP.muted2 : 'var(--overlay-explorer-chip-active-text)',
    padding: '4px 8px',
    borderRadius: 'var(--overlay-explorer-control-radius)',
    fontSize: 10,
    fontWeight: 700,
    opacity: disabled ? 0.55 : 1,
    flexShrink: 0,
  };
}

function toolbarToggleButtonStyle(active: boolean, disabled = false): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)',
    border: `1px solid ${active ? 'var(--overlay-explorer-chip-active-border)' : 'var(--overlay-explorer-chip-border)'}`,
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? EXP.muted2 : (active ? 'var(--overlay-explorer-chip-active-text)' : EXP.muted),
    padding: '4px 8px',
    borderRadius: 'var(--overlay-explorer-control-radius)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    opacity: disabled ? 0.55 : 1,
  };
}

function toolbarIconButtonStyle(disabled = false): CSSProperties {
  return {
    background: 'var(--overlay-explorer-chip-bg)',
    border: '1px solid transparent',
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? EXP.muted2 : EXP.muted,
    padding: 5,
    borderRadius: 'var(--overlay-explorer-control-radius)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  };
}

function toolbarActionButtonStyle(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--overlay-explorer-chip-bg)',
    border: '1px solid transparent',
    cursor: 'pointer',
    color: EXP.muted,
    padding: '4px 7px',
    borderRadius: 'var(--overlay-explorer-control-radius)',
    fontSize: 'var(--overlay-explorer-toolbar-font-size)',
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
  state: 'idle' | 'selected' | 'drop',
): ExplorerEntrySurfaceState {
  if (state === 'idle') {
    return {
      background: 'transparent',
      borderColor: 'transparent',
      boxShadow: 'none',
      transform: 'translateY(0)',
    };
  }

  if (state === 'drop') {
    return {
      background: 'var(--overlay-explorer-item-drop-bg)',
      borderColor: 'var(--overlay-explorer-item-drop-border)',
      boxShadow: explorerTheme.selectionStyle === 'glow'
        ? 'var(--overlay-explorer-item-focus-shadow)'
        : 'none',
      transform: 'translateY(0)',
    };
  }

  return {
    background: explorerTheme.selectionStyle === 'outline'
      ? 'transparent'
      : 'var(--overlay-explorer-item-selected-bg)',
    borderColor: 'var(--overlay-explorer-item-selected-border)',
    boxShadow: explorerTheme.selectionStyle === 'glow'
      ? 'var(--overlay-explorer-item-focus-shadow)'
      : 'none',
    transform: 'translateY(0)',
  };
}

function getExplorerHoverSurface(
  explorerTheme: ResolvedExplorerThemeRecipe,
): ExplorerEntrySurfaceState {
  return {
    background: 'var(--overlay-explorer-item-hover-bg)',
    borderColor: 'var(--overlay-explorer-item-hover-border)',
    boxShadow: explorerTheme.hoverStyle === 'glow'
      ? 'var(--overlay-explorer-item-focus-shadow)'
      : 'none',
    transform: explorerTheme.hoverStyle === 'lift' || explorerTheme.hoverStyle === 'glow'
      ? 'translateY(calc(var(--overlay-explorer-hover-lift) * -1))'
      : 'translateY(0)',
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

const EXT_TYPE_LABEL: Record<string, string> = {
  rs: 'Rust',
  py: 'Python',
  js: 'JavaScript',
  jsx: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  c: 'C',
  h: 'C Header',
  hpp: 'C++ Header',
  cs: 'C#',
  java: 'Java',
  go: 'Go',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  dart: 'Dart',
  lua: 'Lua',
  zig: 'Zig',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  ini: 'Config',
  cfg: 'Config',
  md: 'Markdown',
  mdx: 'Markdown',
  txt: 'Text',
  pdf: 'PDF',
  glsl: 'GLSL',
  hlsl: 'HLSL',
  wgsl: 'WGSL',
  vert: 'Shader',
  frag: 'Shader',
  ps1: 'PowerShell',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  bat: 'Batch',
  cmd: 'Command',
  exe: 'Executable',
  msi: 'Installer',
  dmg: 'Disk Image',
  dll: 'Library',
  so: 'Library',
  dylib: 'Library',
  zip: 'Archive',
  rar: 'Archive',
  '7z': 'Archive',
  tar: 'Archive',
  gz: 'Archive',
  bz2: 'Archive',
  xz: 'Archive',
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  gif: 'Image',
  webp: 'Image',
  bmp: 'Image',
  ico: 'Image',
  svg: 'Vector',
  tiff: 'Image',
  tif: 'Image',
  avif: 'Image',
  mp4: 'Video',
  mkv: 'Video',
  avi: 'Video',
  mov: 'Video',
  wmv: 'Video',
  flv: 'Video',
  webm: 'Video',
  mp3: 'Audio',
  wav: 'Audio',
  flac: 'Audio',
  ogg: 'Audio',
  m4a: 'Audio',
  aac: 'Audio',
  opus: 'Audio',
  ttf: 'Font',
  otf: 'Font',
  woff: 'Font',
  woff2: 'Font',
  fbx: '3D Model',
  obj: '3D Model',
  glb: '3D Model',
  gltf: '3D Model',
  uasset: 'UE Asset',
  uproject: 'UE Project',
  sql: 'SQL',
  db: 'Database',
  sqlite: 'Database',
  csv: 'CSV',
  log: 'Log',
  lock: 'Lockfile',
  kain: 'Kain',
  ink: 'Ink',
};

const FILENAME_TYPE_LABEL: Record<string, string> = {
  'dockerfile': 'Docker',
  'makefile': 'Makefile',
  'rakefile': 'Ruby',
  'cmake': 'CMake',
  '.gitignore': 'Git',
  '.gitattributes': 'Git',
  '.gitmodules': 'Git',
  '.env': 'Environment',
  '.env.local': 'Environment',
  '.editorconfig': 'EditorConfig',
  'package.json': 'NPM Package',
  'package-lock.json': 'NPM Lockfile',
  'cargo.toml': 'Cargo Manifest',
  'cargo.lock': 'Cargo Lockfile',
};

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  return element.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
    || Boolean(element.closest('.monaco-editor'));
}

function resolveExplorerDragIntent(event: Pick<React.DragEvent, 'shiftKey'>): ExplorerDragIntent {
  return event.shiftKey ? 'internal' : 'native-out';
}

function resolveExplorerDropOperation(
  event: Pick<React.DragEvent, 'altKey' | 'ctrlKey'>,
  platform: RuntimePlatform,
): FileTransferOperation {
  if (platform === 'macos') {
    return event.altKey ? 'copy' : 'move';
  }

  return event.ctrlKey ? 'copy' : 'move';
}

function formatExplorerNativeDragError(error: unknown): string {
  const message = String(error);
  if (/access is denied|denied|elevat|privilege|administrator/i.test(message)) {
    return 'Native file drag was blocked by Windows permissions. If GreebleFS is running as Administrator, drag targets like Explorer/Desktop must be elevated too.';
  }

  return message;
}

function getDefaultExplorerSortOrder(sortBy: ExplorerSortKey): 'asc' | 'desc' {
  return sortBy === 'size' || sortBy === 'date' ? 'desc' : 'asc';
}

function getEntryExtension(entry: Pick<FileEntry, 'is_dir' | 'name' | 'extension'>): string {
  if (entry.is_dir) {
    return '';
  }

  const normalizedExtension = (entry.extension ?? '').trim().replace(/^\./, '').toLowerCase();
  if (normalizedExtension) {
    return normalizedExtension;
  }

  const lastDotIndex = entry.name.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === entry.name.length - 1) {
    return '';
  }

  return entry.name.slice(lastDotIndex + 1).toLowerCase();
}

function getEntryTypeLabel(entry: Pick<FileEntry, 'is_dir' | 'name' | 'extension'>): string {
  if (entry.is_dir) {
    return 'Folder';
  }

  const filename = entry.name.toLowerCase();
  if (FILENAME_TYPE_LABEL[filename]) {
    return FILENAME_TYPE_LABEL[filename];
  }

  const extension = getEntryExtension(entry);
  if (!extension) {
    return 'File';
  }

  return EXT_TYPE_LABEL[extension] ?? `${extension.toUpperCase()} File`;
}

function compareExplorerEntries(
  left: FileEntry,
  right: FileEntry,
  sortBy: ExplorerSortKey,
  sortOrder: 'asc' | 'desc',
): number {
  if (left.is_dir !== right.is_dir) {
    return left.is_dir ? -1 : 1;
  }

  let comparison = 0;
  switch (sortBy) {
    case 'size':
      comparison = left.size - right.size;
      break;
    case 'date':
      comparison = left.modified - right.modified;
      break;
    case 'type':
      comparison = getEntryTypeLabel(left).localeCompare(getEntryTypeLabel(right), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      break;
    case 'name':
    default:
      comparison = left.name.localeCompare(right.name, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      break;
  }

  if (comparison === 0) {
    comparison = left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  }

  return sortOrder === 'asc' ? comparison : -comparison;
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

function getNativeIconRequest(entry: FileEntry): OverlayNativeIconRequest {
  return {
    path: entry.path,
    size: DEFAULT_NATIVE_ICON_SIZE,
  };
}

// ─── Extension sets (for preview logic only) ─────────────────────────────────

function isEditableTextEntry(entry: FileEntry): boolean {
  if (entry.is_dir) return false;
  const ext = getEntryExtension(entry);
  return isEditableTextExtension(ext, entry.size);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024**3)   return `${(bytes/1024**2).toFixed(1)} MB`;
  if (bytes < 1024**4)   return `${(bytes/1024**3).toFixed(2)} GB`;
  return `${(bytes/1024**4).toFixed(2)} TB`;
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

function normalizeExplorerPath(path: string): string {
  if (path.startsWith('cloud://')) {
    return path.replace(/\/+$/, '') || path;
  }
  return /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
}

function getExplorerParentPath(path: string): string {
  if (path.startsWith('cloud://')) {
    const trimmed = path.replace(/\/+$/, '');
    const segments = trimmed.split('/');
    if (segments.length <= 5) {
      return trimmed;
    }
    return segments.slice(0, -1).join('/');
  }
  const normalized = path.replace(/[/\\]+$/, '');
  const parts = normalized.split(/[/\\]/);
  if (parts.length <= 1) {
    return normalized;
  }
  if (/^[A-Za-z]:$/.test(parts[0] ?? '')) {
    return `${parts.slice(0, -1).join('\\')}\\`;
  }
  return parts.slice(0, -1).join('/');
}

function buildAdaptiveSemanticBands(
  entries: FileEntry[],
  selectedPaths: Set<string>,
  currentPath: string,
  sortBy: ExplorerSortKey,
  sortOrder: 'asc' | 'desc',
): AdaptiveSemanticBand[] {
  const sortedEntries = entries;
  const folders = sortedEntries.filter((entry) => entry.is_dir);
  const files = sortedEntries.filter((entry) => !entry.is_dir);
  const primarySelectedEntry = sortedEntries.find((entry) => selectedPaths.has(entry.path)) ?? null;
  const selectedParentPath = primarySelectedEntry ? getExplorerParentPath(primarySelectedEntry.path) : currentPath;
  const selectedExtension = primarySelectedEntry ? getEntryExtension(primarySelectedEntry) : '';

  const contextPaths = new Set<string>();
  for (const entry of files) {
    if (selectedPaths.has(entry.path)) {
      contextPaths.add(entry.path);
      continue;
    }

    const sameParent = getExplorerParentPath(entry.path) === selectedParentPath;
    const sameExtension = selectedExtension.length > 0 && getEntryExtension(entry) === selectedExtension;
    if (sameParent || sameExtension) {
      contextPaths.add(entry.path);
    }
  }

  const recentCandidates = files
    .filter((entry) => !contextPaths.has(entry.path))
    .sort((left, right) => right.modified - left.modified)
    .slice(0, 10);
  const recentPaths = new Set(recentCandidates.map((entry) => entry.path));
  const everythingElse = files.filter((entry) => !contextPaths.has(entry.path) && !recentPaths.has(entry.path));

  const bands: AdaptiveSemanticBand[] = [];

  if (folders.length > 0) {
    bands.push({
      id: 'folders',
      label: 'Folders',
      description: 'Anchors and destinations stay visually dominant.',
      dominant: true,
      entries: folders,
    });
  }

  const contextEntries = files.filter((entry) => contextPaths.has(entry.path));
  if (contextEntries.length > 0) {
    bands.push({
      id: 'context',
      label: 'Local Context',
      description: 'Selection-adjacent files stay close while you change density.',
      dominant: false,
      entries: contextEntries,
    });
  }

  const recentEntries = files.filter((entry) => recentPaths.has(entry.path));
  if (recentEntries.length > 0) {
    bands.push({
      id: 'recent',
      label: 'Recent Activity',
      description: 'Fresh work stays elevated without replacing the folder map.',
      dominant: false,
      entries: recentEntries.sort((left, right) => compareExplorerEntries(left, right, sortBy, sortOrder)),
    });
  }

  if (everythingElse.length > 0) {
    bands.push({
      id: 'everything-else',
      label: 'Everything Else',
      description: 'Remaining files preserve the active explorer sort.',
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
  sortOrder: 'asc' | 'desc',
  nowMs = Date.now(),
): TimelineSurfaceBand[] {
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
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
  }> = densityStopId === 'small-icons'
    ? [
        {
          id: 'recent',
          label: 'Recent',
          description: 'Fresh work from the last month stays at the front of the timeline.',
          dominant: true,
          matches: (entry) => entry.modified >= lastThirtyDays,
        },
        {
          id: 'this-year',
          label: 'This Year',
          description: 'Everything else from the current year remains grouped together.',
          dominant: false,
          matches: (entry) => entry.modified >= startOfYear,
        },
        {
          id: 'archive',
          label: 'Archive',
          description: 'Older files collapse into a long-range archive band.',
          dominant: false,
          matches: () => true,
        },
      ]
    : densityStopId === 'medium-icons'
      ? [
          {
            id: 'last-90-days',
            label: 'Last 90 Days',
            description: 'Recent quarters stay compressed into one practical band.',
            dominant: true,
            matches: (entry) => entry.modified >= lastNinetyDays,
          },
          {
            id: 'this-year',
            label: 'This Year',
            description: 'Current-year history remains visible without splitting too far.',
            dominant: false,
            matches: (entry) => entry.modified >= startOfYear,
          },
          {
            id: 'archive',
            label: 'Archive',
            description: 'Older work folds into one archival lane.',
            dominant: false,
            matches: () => true,
          },
        ]
      : densityStopId === 'large-icons'
        ? [
            {
              id: 'today',
              label: 'Today',
              description: 'The freshest changes sit on the leading edge.',
              dominant: true,
              matches: (entry) => entry.modified >= startOfToday,
            },
            {
              id: 'this-week',
              label: 'This Week',
              description: 'Current-week edits form the active work lane.',
              dominant: false,
              matches: (entry) => entry.modified >= startOfWeek,
            },
            {
              id: 'this-month',
              label: 'This Month',
              description: 'Monthly context keeps short-term history together.',
              dominant: false,
              matches: (entry) => entry.modified >= startOfMonth,
            },
            {
              id: 'archive',
              label: 'Archive',
              description: 'Older work falls into a broader historical band.',
              dominant: false,
              matches: () => true,
            },
          ]
        : densityStopId === 'rich-cards'
          ? [
              {
                id: 'today',
                label: 'Today',
                description: 'Same-day edits remain closest to the front edge.',
                dominant: true,
                matches: (entry) => entry.modified >= startOfToday,
              },
              {
                id: 'yesterday',
                label: 'Yesterday',
                description: 'Yesterday forms its own recent handoff band.',
                dominant: false,
                matches: (entry) => entry.modified >= startOfYesterday,
              },
              {
                id: 'this-week',
                label: 'This Week',
                description: 'The rest of the week stays grouped as one burst window.',
                dominant: false,
                matches: (entry) => entry.modified >= startOfWeek,
              },
              {
                id: 'this-month',
                label: 'This Month',
                description: 'Monthly context fills in the wider story arc.',
                dominant: false,
                matches: (entry) => entry.modified >= startOfMonth,
              },
              {
                id: 'archive',
                label: 'Archive',
                description: 'Older work remains visible as historical layers.',
                dominant: false,
                matches: () => true,
              },
            ]
          : densityStopId === 'columns'
            ? [
                {
                  id: 'today',
                  label: 'Today',
                  description: 'Today stays isolated for quick scanning.',
                  dominant: true,
                  matches: (entry) => entry.modified >= startOfToday,
                },
                {
                  id: 'yesterday',
                  label: 'Yesterday',
                  description: 'Yesterday remains visible as a short handoff band.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfYesterday,
                },
                {
                  id: 'this-week',
                  label: 'This Week',
                  description: 'This week becomes a compact activity lane.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfWeek,
                },
                {
                  id: 'last-30-days',
                  label: 'Last 30 Days',
                  description: 'Recent month-scale work stays separated from older history.',
                  dominant: false,
                  matches: (entry) => entry.modified >= lastThirtyDays,
                },
                {
                  id: 'this-year',
                  label: 'This Year',
                  description: 'Remaining current-year work keeps a broader historical lane.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfYear,
                },
                {
                  id: 'archive',
                  label: 'Archive',
                  description: 'Older work compacts into a long-tail archive.',
                  dominant: false,
                  matches: () => true,
                },
              ]
            : [
                {
                  id: 'today',
                  label: 'Today',
                  description: 'Same-day changes stay closest to the current moment.',
                  dominant: true,
                  matches: (entry) => entry.modified >= startOfToday,
                },
                {
                  id: 'yesterday',
                  label: 'Yesterday',
                  description: 'Yesterday keeps its own band for immediate recall.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfYesterday,
                },
                {
                  id: 'this-week',
                  label: 'This Week',
                  description: 'The current week remains readable as a dedicated lane.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfWeek,
                },
                {
                  id: 'last-week',
                  label: 'Last Week',
                  description: 'Last week is split out so short-term history does not blur.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfLastWeek,
                },
                {
                  id: 'last-30-days',
                  label: 'Last 30 Days',
                  description: 'The last month keeps a wider but still active band.',
                  dominant: false,
                  matches: (entry) => entry.modified >= lastThirtyDays,
                },
                {
                  id: 'last-90-days',
                  label: 'Last 90 Days',
                  description: 'Quarter-scale work remains separate from the archive.',
                  dominant: false,
                  matches: (entry) => entry.modified >= lastNinetyDays,
                },
                {
                  id: 'this-year',
                  label: 'This Year',
                  description: 'Current-year history stays visible before the archive drop-off.',
                  dominant: false,
                  matches: (entry) => entry.modified >= startOfYear,
                },
                {
                  id: 'archive',
                  label: 'Archive',
                  description: 'Older work compresses into a deep-time archive lane.',
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

    const matchedBucket = bucketDefinitions.find((bucket) => bucket.matches(entry));
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
          const dateComparison = compareExplorerEntries(left, right, 'date', 'desc');
          return dateComparison !== 0
            ? dateComparison
            : compareExplorerEntries(left, right, sortBy, sortOrder);
        }),
      } satisfies TimelineSurfaceBand;
    })
    .filter((band): band is TimelineSurfaceBand => band != null);

  if (undatedEntries.length > 0) {
    timelineBands.push({
      id: 'undated',
      label: 'Undated',
      description: 'Files without usable timestamps stay grouped at the tail of the surface.',
      dominant: false,
      entries: undatedEntries.sort((left, right) => compareExplorerEntries(left, right, sortBy, sortOrder)),
    });
  }

  return timelineBands;
}

function isLikelyExplorerPathInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('cloud://')) return true;
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || /^[A-Za-z]:$/.test(trimmed)) return true;
  if (trimmed.startsWith('\\\\')) return true;
  if (trimmed.startsWith('~')) return true;
  if (/^[.]{1,2}[\\/]/.test(trimmed) || trimmed === '.' || trimmed === '..') return true;
  return /[\\/]/.test(trimmed);
}

function resolveExplorerPathInput(
  input: string,
  currentPath: string,
  runtimePlatform: ReturnType<typeof detectClientPlatform>,
): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('cloud://')) {
    return normalizeExplorerPath(trimmed);
  }
  const separator = getPlatformPathSeparator(runtimePlatform);
  const normalizedSeparators = trimmed.replace(/[\\/]+/g, separator);

  if (/^[A-Za-z]:$/.test(normalizedSeparators)) {
    return `${normalizedSeparators}${separator}`;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return normalizeExplorerPath(normalizedSeparators);
  }

  if (runtimePlatform !== 'windows' && trimmed.startsWith('/')) {
    return normalizeExplorerPath(normalizedSeparators);
  }

  const basePath = currentPath || getFallbackExplorerPath(runtimePlatform);
  return normalizeExplorerPath(joinPlatformPath(basePath, normalizedSeparators, runtimePlatform));
}

// ─── SvgIcon ──────────────────────────────────────────────────────────────────

function SvgIcon({ src, size = 20 }: { src: string; size?: number }) {
  return (
    <img
      src={src}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
        transition: 'width 0.18s cubic-bezier(0.22, 1, 0.36, 1), height 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
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
    case 'Clipboard':
      return <Clipboard size={13} />;
    case 'Copy':
      return <Copy size={13} />;
    case 'CopyPlus':
      return <CopyPlus size={13} />;
    case 'Edit3':
      return <Edit3 size={13} />;
    case 'ExternalLink':
      return <ExternalLink size={13} />;
    case 'Eye':
      return <Eye size={13} />;
    case 'FilePlus':
      return <FilePlus size={13} />;
    case 'FolderPlus':
      return <FolderPlus size={13} />;
    case 'Info':
      return <Info size={13} />;
    case 'Puzzle':
      return <Puzzle size={13} />;
    case 'RefreshCw':
      return <RefreshCw size={13} />;
    case 'Scissors':
      return <Scissors size={13} />;
    case 'Shield':
      return <Shield size={13} />;
    case 'Sparkles':
      return <Sparkles size={13} />;
    case 'Star':
      return <Star size={13} />;
    case 'Tags':
      return <Tags size={13} />;
    case 'Terminal':
      return <Terminal size={13} />;
    case 'Trash2':
      return <Trash2 size={13} />;
    default:
      return <Puzzle size={13} />;
  }
}

function ContextMenu({ state, items, onClose }: { state: ContextMenuState; items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!state.visible) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(() => window.addEventListener('mousedown', h), 0);
    return () => window.removeEventListener('mousedown', h);
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
      ref.current.style.opacity = '1';
    }
  }, [state]);

  if (!state.visible) return null;
  return (
    <div ref={ref} style={{
      position:'fixed', left:state.x, top:state.y, zIndex:9999, opacity: 0,
      background:'var(--overlay-explorer-preview-bg)', border:'1px solid var(--overlay-explorer-preview-border)',
      borderRadius:'var(--overlay-explorer-panel-radius)', boxShadow:'0 16px 48px rgba(0,0,0,0.8)',
      minWidth:210, padding:'4px 0', fontFamily:'Inter,system-ui,sans-serif',
    }}>
      {items.map((item, i) => item.divider
        ? <div key={i} style={{ height:1, background:EXP.border, margin:'3px 0' }} />
        : (
          <button key={i} onClick={() => { item.action(); onClose(); }}
            style={{
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'6px 14px', background:'transparent', border:'none',
              cursor:'pointer', color:item.danger ? EXP.red : EXP.text,
              fontSize:12, textAlign:'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.1)' : 'var(--overlay-explorer-chip-active-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ opacity:0.7, display:'flex' }}>{item.icon}</span>
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

function ExplorerLayoutGlyph({ mode, accent, active }: {
  mode: ExplorerViewModeDefinition;
  accent: string;
  active: boolean;
}) {
  const color = active ? accent : EXP.muted;
  const borderColor = active ? `${accent}66` : 'rgba(255,255,255,0.14)';
  const baseCellStyle: React.CSSProperties = {
    borderRadius: 2,
    border: `1px solid ${borderColor}`,
    background: active ? `${accent}22` : 'rgba(255,255,255,0.04)',
  };

  if (mode.presentation === 'grid') {
    return (
      <span style={{ width: 14, height: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        <span style={baseCellStyle} />
        <span style={baseCellStyle} />
        <span style={baseCellStyle} />
        <span style={baseCellStyle} />
      </span>
    );
  }

  if (mode.presentation === 'list') {
    return (
      <span style={{ width: 14, height: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
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
    <span style={{ width: 14, height: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
      <span style={{ ...baseCellStyle, gridColumn: '1 / span 2', height: 3, alignSelf: 'center' }} />
      <span style={baseCellStyle} />
      <span style={baseCellStyle} />
      <span style={baseCellStyle} />
      <span style={baseCellStyle} />
    </span>
  );
}

function ExplorerShellLayoutGlyph({ layout, accent, active }: {
  layout: ExplorerShellLayoutDefinition;
  accent: string;
  active: boolean;
}) {
  const color = active ? accent : EXP.muted;
  const borderColor = active ? `${accent}66` : 'rgba(255,255,255,0.14)';
  const cellBackground = active ? `${accent}1e` : 'rgba(255,255,255,0.04)';

  return (
    <span style={{ width: 14, height: 14, display: 'grid', gridTemplateColumns: layout.showRail ? '4px 1fr' : '1fr', gap: 2 }}>
      {layout.showRail && (
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
          display: 'grid',
          gridTemplateColumns: layout.previewPlacement === 'leading' ? '1fr 2px 2fr' : '2fr 2px 1fr',
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
  mode: ExplorerExperimentalViewMode | 'all';
}

function ExplorerExperimentalGlyph({ active, accent, mode }: ExplorerExperimentalGlyphProps) {
  const color = active ? accent : EXP.muted;
  const borderColor = active ? `${accent}66` : 'rgba(255,255,255,0.16)';
  const fill = active ? `${accent}1f` : 'rgba(255,255,255,0.05)';

  if (mode === 'adaptive-semantic-grid') {
    return (
      <span style={{ width: 14, height: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
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

  if (mode === 'constellation') {
    return (
      <span style={{ width: 14, height: 14, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ position: 'absolute', width: 2, height: 2, borderRadius: 999, background: color, left: 6, top: 6 }} />
        <span style={{ position: 'absolute', width: 1, height: 1, borderRadius: 999, background: color, left: 1, top: 3 }} />
        <span style={{ position: 'absolute', width: 1, height: 1, borderRadius: 999, background: color, left: 10, top: 2 }} />
        <span style={{ position: 'absolute', width: 1, height: 1, borderRadius: 999, background: color, left: 11, top: 10 }} />
        <span style={{ position: 'absolute', width: 1, height: 1, borderRadius: 999, background: color, left: 2, top: 11 }} />
        <span style={{ position: 'absolute', width: 8, height: 1, background: color, opacity: 0.7, left: 2, top: 4, transform: 'rotate(18deg)', transformOrigin: 'left center' }} />
        <span style={{ position: 'absolute', width: 7, height: 1, background: color, opacity: 0.45, left: 6, top: 7, transform: 'rotate(38deg)', transformOrigin: 'left center' }} />
        <span style={{ position: 'absolute', width: 7, height: 1, background: color, opacity: 0.4, left: 2, top: 10, transform: 'rotate(-26deg)', transformOrigin: 'left center' }} />
      </span>
    );
  }

  if (mode === 'timeline-surface') {
    return (
      <span style={{ width: 14, height: 14, display: 'grid', gridTemplateColumns: '4px 1fr', gap: 3, alignItems: 'stretch' }}>
        <span style={{ borderRadius: 999, background: color, opacity: 0.8 }} />
        <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1px 0' }}>
          <span style={{ height: 2, borderRadius: 999, background: fill, border: `1px solid ${borderColor}` }} />
          <span style={{ height: 2, borderRadius: 999, background: fill, border: `1px solid ${borderColor}`, opacity: 0.82 }} />
          <span style={{ height: 2, borderRadius: 999, background: fill, border: `1px solid ${borderColor}`, opacity: 0.68 }} />
        </span>
      </span>
    );
  }

  return (
    <Sparkles
      size={14}
      strokeWidth={2}
      style={{ color }}
    />
  );
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

const MONACO_FIND_WITH_ARGS_ACTION = 'editor.actions.findWithArgs';

type MonacoEditorOptions = MonacoEditorProps['options'];

function applyEditorSearchFocus(editor: any, monaco: any, focusTarget: EditorSearchFocusTarget | null) {
  editor.layout?.();

  if (!focusTarget) {
    return;
  }

  const model = editor.getModel?.();
  if (!model) {
    return;
  }

  const lineNumber = clampSearchFocusLine(focusTarget.lineNumber, model.getLineCount());
  const lineContent = model.getLineContent(lineNumber);
  const { startColumn, endColumn } = findSearchFocusColumns(lineContent, focusTarget.searchString);

  if (focusTarget.searchString) {
    const range = new monaco.Range(lineNumber, startColumn, lineNumber, endColumn);
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
  value,
  language,
  readOnly,
  focusTarget,
  onChange,
  options,
}: {
  value: string;
  language: string;
  readOnly: boolean;
  focusTarget: EditorSearchFocusTarget | null;
  onChange?: (value: string) => void;
  options: MonacoEditorOptions;
}) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    window.requestAnimationFrame(() => {
      applyEditorSearchFocus(editor, monaco, focusTarget);
    });
  }, [focusTarget]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      applyEditorSearchFocus(editorRef.current, monacoRef.current, focusTarget);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusTarget?.requestId, value]);

  return (
    <Suspense fallback={<EditorFallback label="Loading editor…" />}>
      <LazyMonacoEditor
        height="100%"
        language={language || 'plaintext'}
        value={value}
        theme="vs-dark"
        onMount={handleMount}
        onChange={onChange ? nextValue => onChange(nextValue ?? '') : undefined}
        options={{
          automaticLayout: true,
          readOnly,
          ...options,
        }}
      />
    </Suspense>
  );
}

function EditorFallback({ label }: { label: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#0f131a', color: EXP.muted, fontSize: 11 }}>
      {label}
    </div>
  );
}

// ─── Resizable Preview Panel ──────────────────────────────────────────────────

function PreviewPanel({
  preview,
  width,
  onClose,
  onWidthChange,
  onTextChange,
  onCopyPath,
  viewMode,
  onViewModeChange,
  explorerTheme,
  blurEnabled,
  chromeLayoutId,
  chromeOverride,
  chromeEditMode,
}: {
  preview: PreviewState;
  width: number;
  onClose: () => void;
  onWidthChange: (width: number) => void;
  onTextChange: (path: string, content: string) => void;
  onCopyPath: (path: string) => void;
  viewMode: ExplorerDocumentViewMode;
  onViewModeChange: (mode: ExplorerDocumentViewMode) => void;
  explorerTheme: ResolvedExplorerThemeRecipe;
  blurEnabled: boolean;
  chromeLayoutId: ExplorerChromeLayoutId;
  chromeOverride?: ExplorerChromeOverrideSnapshot | null;
  chromeEditMode?: ExplorerChromeEditModeState;
}) {
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(width);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = width;
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // dragging left grows the panel
      onWidthChange(
        Math.max(
          EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
          Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, startW.current + delta),
        ),
      );
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [onWidthChange]);

  useEffect(() => {
    setCopiedPath(null);
  }, [preview.path]);

  const previewTitle = preview.type === 'none' ? 'Preview' : preview.name;
  const previewStateLabel = preview.type === 'text'
    ? (preview.isSaving ? 'Saving?' : preview.isDirty ? 'Unsaved' : 'Saved')
    : preview.type === 'fallback'
      ? 'Unavailable'
      : null;
  const copyPathLabel = copiedPath === preview.path ? 'Copied' : 'Copy Path';
  const supportsRenderedPreview = preview.type === 'text' && preview.renderKind !== 'none';
  const previewHeaderRowStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
    flexWrap: 'wrap',
  }), []);
  const getPreviewHeaderZoneStyle = useCallback((zoneId: ExplorerChromeZoneId): CSSProperties => {
    switch (zoneId) {
      case 'center':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
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
          alignItems: 'center',
          gap: 8,
          minWidth: 0,
          flex: 1,
        };
    }
  }, []);
  const previewChromeControlRegistry = useMemo<Array<ExplorerChromeControlDefinition & {
    isVisible: (surfaceId: ExplorerChromeSurfaceId) => boolean;
    render: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
  }>>(() => [
    {
      id: 'previewIdentity',
      label: 'Preview Identity',
      surfaces: ['previewHeader'],
      isVisible: () => true,
      render: () => (
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 'var(--overlay-explorer-toolbar-font-size)', color: EXP.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {previewTitle}
          </div>
          {preview.type !== 'none' && (
            <div
              title={preview.path}
              style={{ marginTop: 2, fontSize: 9, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}
            >
              {preview.path}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'previewState',
      label: 'Preview State',
      surfaces: ['previewHeader'],
      isVisible: () => Boolean(previewStateLabel),
      render: () => (
        previewStateLabel ? (
          <span style={{ fontSize: 9, fontWeight: 700, color: preview.type === 'text' && preview.isSaving ? EXP.yellow : (preview.type === 'text' && preview.isDirty ? EXP.red : EXP.green), padding: '3px 7px', borderRadius: 999, border: '1px solid var(--overlay-explorer-chip-border)', background: 'var(--overlay-explorer-chip-bg)' }}>
            {previewStateLabel}
          </span>
        ) : null
      ),
    },
    {
      id: 'previewModeToggle',
      label: 'Preview Mode Toggle',
      surfaces: ['previewHeader'],
      isVisible: () => supportsRenderedPreview,
      render: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 2, borderRadius: 'var(--overlay-explorer-control-radius)', border: '1px solid var(--overlay-explorer-chip-border)', background: 'var(--overlay-explorer-chip-bg)' }}>
          {([
            { id: 'edit', label: 'Edit' },
            { id: 'preview', label: 'Preview' },
          ] as const).map(option => {
            const active = viewMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onViewModeChange(option.id)}
                style={{
                  border: 'none',
                  borderRadius: 'var(--overlay-explorer-control-radius)',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: active ? EXP.text : EXP.muted,
                  background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'transparent',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: 'previewCopyPath',
      label: 'Preview Copy Path',
      surfaces: ['previewHeader'],
      isVisible: () => preview.type !== 'none',
      render: () => (
        <button
          type="button"
          onClick={() => {
            onCopyPath(preview.path);
            setCopiedPath(preview.path);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--overlay-explorer-chip-bg)', border: '1px solid var(--overlay-explorer-chip-border)', borderRadius: 'var(--overlay-explorer-control-radius)', cursor: 'pointer', color: EXP.muted, padding: '4px 8px', fontSize: 10 }}
        >
          <Copy size={11} />
          {copyPathLabel}
        </button>
      ),
    },
    {
      id: 'previewClose',
      label: 'Preview Close',
      surfaces: ['previewHeader'],
      isVisible: () => true,
      render: () => (
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: EXP.muted, padding: 2 }}>
          <X size={13} />
        </button>
      ),
    },
  ], [
    copyPathLabel,
    onClose,
    onCopyPath,
    onViewModeChange,
    preview,
    previewStateLabel,
    previewTitle,
    supportsRenderedPreview,
    viewMode,
  ]);
  const previewChromeControlRegistryById = useMemo(
    () => new Map(previewChromeControlRegistry.map((entry) => [entry.id, entry])),
    [previewChromeControlRegistry],
  );
  const previewHeaderSurface = useMemo(
    () => resolveExplorerChromeSurfaceLayout({
      layoutId: chromeLayoutId,
      surfaceId: 'previewHeader',
      controlDefinitions: previewChromeControlRegistry,
      override: chromeOverride,
      isControlVisible: (controlId, surfaceId) => previewChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ?? false,
    }),
    [chromeLayoutId, chromeOverride, previewChromeControlRegistry, previewChromeControlRegistryById],
  );
  const renderPreviewChromeControl = useCallback((placement: ExplorerChromeResolvedControlPlacement) => (
    previewChromeControlRegistryById.get(placement.controlId)?.render(placement) ?? null
  ), [previewChromeControlRegistryById]);
  const previewShellStyle: CSSProperties = explorerTheme.previewStyle === 'attached'
    ? {
        width,
        background: 'var(--overlay-explorer-preview-bg)',
        borderLeft: '1px solid var(--overlay-explorer-preview-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
      }
    : {
        width,
        margin: 'var(--overlay-explorer-chrome-inset)',
        marginLeft: 0,
        background: 'var(--overlay-explorer-preview-bg)',
        border: '1px solid var(--overlay-explorer-preview-border)',
        borderRadius: 'var(--overlay-explorer-panel-radius)',
        boxShadow: 'var(--overlay-explorer-toolbar-shadow)',
        backdropFilter: blurEnabled && explorerTheme.previewStyle === 'glass' ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: blurEnabled && explorerTheme.previewStyle === 'glass' ? 'blur(18px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
      };

  return (
    <div data-overlay-explorer-plane="preview" style={previewShellStyle}>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position:'absolute', left:0, top:0, bottom:0, width:4,
          cursor:'col-resize', zIndex:10,
          background:'transparent',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = `${EXP.accent}55`)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />
      {/* Header */}
      <div style={{ padding: '8px 12px 8px 16px', borderBottom: '1px solid var(--overlay-explorer-preview-border)', background: 'var(--overlay-explorer-preview-header-bg)', flexShrink: 0 }}>
        <ExplorerChromeSurface
          surface={previewHeaderSurface}
          getRowStyle={() => previewHeaderRowStyle}
          getZoneStyle={getPreviewHeaderZoneStyle}
          renderControl={renderPreviewChromeControl}
          editMode={chromeEditMode}
        />
      </div>
      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {preview.type === 'image' && preview.content && (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:16, boxSizing:'border-box' }}>
            <img
              src={preview.content}   /* data-URI — always works */
              alt="preview"
              style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:'var(--overlay-explorer-control-radius)', boxShadow:'0 4px 24px rgba(0,0,0,0.6)' }}
            />
          </div>
        )}
        {preview.type === 'text' && viewMode === 'preview' && supportsRenderedPreview && (
          <Suspense fallback={<DocumentPreviewFallback label="Loading rendered preview…" />}>
            <LazyTextDocumentPreview kind={preview.renderKind} content={preview.content} />
          </Suspense>
        )}
        {preview.type === 'text' && (!supportsRenderedPreview || viewMode === 'edit') && (
          <SearchAwareCodeView
            value={preview.content || ''}
            language={preview.language || 'plaintext'}
            readOnly={false}
            focusTarget={preview.focusTarget}
            onChange={value => onTextChange(preview.path, value)}
            options={{ minimap:{enabled:false}, scrollBeyondLastLine:false, fontSize:12, lineNumbers:'on', wordWrap:'on', padding:{top:8}, overviewRulerLanes:0 }}
          />
        )}
        {preview.type === 'model3d' && (
          <Suspense fallback={<ModelPreviewFallback entryName={preview.name} format={preview.format} />}>
            <LazyModelPreview
              entryName={preview.name}
              format={preview.format}
              sourcePath={preview.path}
              sourceBytes={preview.size}
            />
          </Suspense>
        )}
        {preview.type === 'fallback' && (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: EXP.muted, background: 'var(--overlay-explorer-preview-bg)' }}>
            <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: EXP.text }}>{preview.label}</div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>{preview.detail}</div>
            </div>
          </div>
        )}
      </div>
      {preview.type === 'text' && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'4px 10px', borderTop:'1px solid var(--overlay-explorer-preview-border)', background:'var(--overlay-explorer-preview-header-bg)', fontSize:'var(--overlay-explorer-status-font-size)', color:EXP.muted }}>
          <span>{preview.content.length} chars · {preview.content.split(/\s+/).filter(Boolean).length} words · {preview.content.split('\n').length} lines</span>
          <span style={{ color: preview.error ? EXP.red : preview.isDirty ? EXP.yellow : EXP.green }}>
            {preview.error ? 'Save failed' : preview.isSaving ? 'Saving…' : preview.isDirty ? 'Pending auto-save' : 'Auto-saved'}
          </span>
        </div>
      )}
    </div>
  );
}

function DocumentPreviewFallback({ label }: { label: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'var(--overlay-explorer-preview-bg)', color: EXP.muted, fontSize: 11 }}>
      {label}
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
    <div style={{ width: '100%', height: '100%', background: 'var(--overlay-explorer-preview-bg)', display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: EXP.muted, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading {format.toUpperCase()} Preview</span>
        <span style={{ color: EXP.muted2, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>{entryName}</span>
      </div>
    </div>
  );
}

// ─── Inline rename ────────────────────────────────────────────────────────────

function RenameInput({ state, onCommit, onCancel }: { state: RenameState; onCommit: (n: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(state.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      const dot = state.name.lastIndexOf('.');
      ref.current.setSelectionRange(0, dot > 0 ? dot : state.name.length);
      ref.current.focus();
    }
  }, [state.name]);
  return (
    <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => val.trim() ? onCommit(val.trim()) : onCancel()}
      onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); val.trim() ? onCommit(val.trim()) : onCancel(); } if (e.key==='Escape') onCancel(); }}
      onClick={e => e.stopPropagation()}
      style={{ background:'var(--overlay-explorer-input-bg)', border:'1px solid var(--overlay-explorer-input-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:EXP.text, fontSize:12, padding:'2px 6px', outline:'none', width:'100%', boxSizing:'border-box' }}
    />
  );
}

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
  const primaryLabel = entries.length === 1 ? entries[0]?.name ?? 'item' : `${entries.length} items`;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--overlay-explorer-preview-bg)', border:'1px solid var(--overlay-explorer-preview-border)', borderRadius:'var(--overlay-explorer-panel-radius)', padding:24, minWidth:320, boxShadow:'0 24px 64px rgba(0,0,0,0.9)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <Trash2 size={18} style={{ color:EXP.accent }} />
          <span style={{ color:EXP.text, fontWeight:600, fontSize:14 }}>Move to Trash</span>
        </div>
        <p style={{ color:EXP.muted, fontSize:12, marginBottom:20, lineHeight:1.5 }}>
          Move <strong style={{ color:EXP.text }}>{primaryLabel}</strong> to the GreebleFS trash? You can undo the most recent trash action from the toolbar.
        </p>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ background:'var(--overlay-explorer-chip-bg)', border:'1px solid var(--overlay-explorer-chip-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:EXP.text, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>Cancel</button>
          <button onClick={onDeletePermanently} style={{ background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.28)', borderRadius:'var(--overlay-explorer-control-radius)', color:EXP.red, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>Delete Permanently</button>
          <button onClick={onConfirm} style={{ background:'var(--overlay-explorer-chip-active-bg)', border:'1px solid var(--overlay-explorer-chip-active-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:'var(--overlay-explorer-chip-active-text)', padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:600 }}>Move to Trash</button>
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
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--overlay-explorer-preview-bg)', border:'1px solid var(--overlay-explorer-preview-border)', borderRadius:'var(--overlay-explorer-panel-radius)', padding:24, minWidth:360, boxShadow:'0 24px 64px rgba(0,0,0,0.9)' }}>
        <div style={{ color:EXP.text, fontWeight:700, fontSize:14, marginBottom:12 }}>Save Search</div>
        <input
          autoFocus
          value={state.name}
          onChange={(event) => onChangeName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onConfirm();
            if (event.key === 'Escape') onCancel();
          }}
          placeholder="Search name"
          style={{ width:'100%', background:'var(--overlay-explorer-input-bg)', border:'1px solid var(--overlay-explorer-input-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:EXP.text, fontSize:12, padding:'8px 10px', outline:'none', boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={onCancel} style={{ background:'var(--overlay-explorer-chip-bg)', border:'1px solid var(--overlay-explorer-chip-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:EXP.text, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ background:'var(--overlay-explorer-chip-active-bg)', border:'1px solid var(--overlay-explorer-chip-active-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:'var(--overlay-explorer-chip-active-text)', padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:600 }}>Save</button>
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
  preview: Array<{ entry: FileEntry; nextName: string }>;
  onChange: (updates: Partial<BatchRenameState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'min(920px, 94vw)', maxHeight:'82vh', display:'flex', flexDirection:'column', background:'var(--overlay-explorer-preview-bg)', border:'1px solid var(--overlay-explorer-preview-border)', borderRadius:'var(--overlay-explorer-panel-radius)', padding:20, boxShadow:'0 24px 64px rgba(0,0,0,0.9)' }}>
        <div style={{ color:EXP.text, fontWeight:700, fontSize:14, marginBottom:12 }}>Batch Rename</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:10 }}>
          <input value={state.findText} onChange={(event) => onChange({ findText: event.target.value })} placeholder="Find text" style={dialogInputStyle} />
          <input value={state.replaceText} onChange={(event) => onChange({ replaceText: event.target.value })} placeholder="Replace with" style={dialogInputStyle} />
          <input value={state.prefix} onChange={(event) => onChange({ prefix: event.target.value })} placeholder="Prefix" style={dialogInputStyle} />
          <input value={state.suffix} onChange={(event) => onChange({ suffix: event.target.value })} placeholder="Suffix" style={dialogInputStyle} />
          <input value={state.startingNumber} onChange={(event) => onChange({ startingNumber: Number(event.target.value) || 1 })} placeholder="Start #" type="number" style={dialogInputStyle} />
          <input value={state.padding} onChange={(event) => onChange({ padding: Number(event.target.value) || 1 })} placeholder="Pad width" type="number" style={dialogInputStyle} />
        </div>
        <div style={{ marginTop:14, border:'1px solid var(--overlay-border)', borderRadius:12, overflow:'hidden', minHeight:0, flex:1 }}>
          <OverlayScrollArea style={{ maxHeight:'46vh' }}>
            <div style={{ display:'grid', gap:1, background:'var(--overlay-border)' }}>
              {preview.map(({ entry, nextName }) => (
                <div key={entry.path} style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap:12, background:'var(--overlay-bg-panel)', padding:'9px 12px' }}>
                  <span style={{ color:EXP.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{entry.name}</span>
                  <span style={{ color:EXP.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nextName}</span>
                </div>
              ))}
            </div>
          </OverlayScrollArea>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
          <button onClick={onCancel} style={{ background:'var(--overlay-explorer-chip-bg)', border:'1px solid var(--overlay-explorer-chip-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:EXP.text, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ background:'var(--overlay-explorer-chip-active-bg)', border:'1px solid var(--overlay-explorer-chip-active-border)', borderRadius:'var(--overlay-explorer-control-radius)', color:'var(--overlay-explorer-chip-active-text)', padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:600 }}>Rename</button>
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
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'min(1100px, 96vw)', maxHeight:'86vh', display:'flex', flexDirection:'column', background:'var(--overlay-explorer-preview-bg)', border:'1px solid var(--overlay-explorer-preview-border)', borderRadius:'var(--overlay-explorer-panel-radius)', padding:20, boxShadow:'0 24px 64px rgba(0,0,0,0.9)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:14 }}>
          <div>
            <div style={{ color:EXP.text, fontWeight:700, fontSize:14 }}>Duplicate Finder</div>
            <div style={{ marginTop:4, color:EXP.muted, fontSize:11 }}>
              {state.status
                ? `${state.status.groups.length} groups, ${state.status.scannedFileCount} files scanned`
                : (state.loading ? 'Scanning current folder tree…' : 'Preparing duplicate scan…')}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {state.loading && <button onClick={onCancelScan} style={dialogSecondaryButtonStyle}>Cancel Scan</button>}
            <button onClick={onClose} style={dialogSecondaryButtonStyle}>Close</button>
          </div>
        </div>
        <div style={{ minHeight:0, flex:1, border:'1px solid var(--overlay-border)', borderRadius:12, overflow:'hidden' }}>
          <OverlayScrollArea style={{ maxHeight:'68vh' }}>
            <div style={{ display:'grid', gap:12, padding:12 }}>
              {state.status?.groups.map((group) => (
                <div key={`${group.contentHash}-${group.fileSize}`} style={{ border:'1px solid var(--overlay-border)', borderRadius:12, overflow:'hidden', background:'var(--overlay-bg-panel)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'10px 12px', borderBottom:'1px solid var(--overlay-border)' }}>
                    <span style={{ color:EXP.text, fontSize:12, fontWeight:700 }}>{group.entries.length} duplicates</span>
                    <span style={{ color:EXP.muted, fontSize:11 }}>{formatSize(group.fileSize)}</span>
                  </div>
                  {group.entries.map((entry, index) => (
                    <div key={entry.path} style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) auto', gap:12, padding:'9px 12px', borderTop:index === 0 ? 'none' : '1px solid var(--overlay-border)' }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ color:EXP.text, fontSize:11.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{entry.name}</div>
                        <div style={{ marginTop:3, color:EXP.muted, fontSize:10, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{entry.path}</div>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => onSelectPath(entry.path)} style={dialogSecondaryButtonStyle}>Select</button>
                        <button onClick={() => onRevealPath(entry.path)} style={dialogSecondaryButtonStyle}>Reveal</button>
                        <button onClick={() => onTrashPath(entry.path)} style={dialogSecondaryButtonStyle}>Trash</button>
                        <button onClick={() => onDeletePath(entry.path)} style={dialogDangerButtonStyle}>Delete</button>
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
  width: '100%',
  background: 'var(--overlay-explorer-input-bg)',
  border: '1px solid var(--overlay-explorer-input-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  color: EXP.text,
  fontSize: 12,
  padding: '8px 10px',
  outline: 'none',
  boxSizing: 'border-box',
};

const dialogSecondaryButtonStyle: CSSProperties = {
  background: 'var(--overlay-explorer-chip-bg)',
  border: '1px solid var(--overlay-explorer-chip-border)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  color: EXP.text,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};

const dialogDangerButtonStyle: CSSProperties = {
  background: 'rgba(248,113,113,0.12)',
  border: '1px solid rgba(248,113,113,0.28)',
  borderRadius: 'var(--overlay-explorer-control-radius)',
  color: EXP.red,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
};

// ─── Main FileExplorer ────────────────────────────────────────────────────────

interface FileExplorerProps {
  theme: { accent: string; bg: string; bgPanel: string; text: string; border: string; textMuted: string };
  appearance?: ResolvedOverlayAppearance;
  explorerBackend?: ExplorerBackendContract;
  onOpenInTerminal: (path: string) => void;
  onOpenInFilesystemAquarium?: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void;
  pluginActions?: OverlayPluginExplorerActionContribution[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  layoutMode?: ExplorerLayoutMode;
  instanceId?: ExplorerInstanceId;
  chromeControlSurface?: 'toolbar' | 'topbar';
  focusAddressBarSignal?: number;
  onWorkspaceRuntimeSnapshotChange?: (snapshot: ExplorerWorkspaceRuntimeSnapshot) => void;
  onWorkspaceSelectionTransferComplete?: (result: ExplorerWorkspaceSelectionTransferResult) => void;
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
  layoutMode = 'full',
  instanceId = PRIMARY_EXPLORER_INSTANCE_ID,
  chromeControlSurface = 'toolbar',
  focusAddressBarSignal = 0,
  onWorkspaceRuntimeSnapshotChange,
  onWorkspaceSelectionTransferComplete,
  externalNavigationRequest = null,
  externalSelectionTransferRequest = null,
  externalRefreshRequest = null,
  repositoryPicker = null,
}: FileExplorerProps) {
  const {
    cancelSearchEntries: cancelExplorerSearchEntries,
    cancelDuplicateScan: cancelExplorerDuplicateScan,
    batchRename: batchRenameExplorerPaths,
    createDir: createExplorerDir,
    createFile: createExplorerFile,
    deletePath: deleteExplorerPath,
    getDrives: getExplorerDrives,
    getHomeDir: getExplorerHomeDir,
    getRuntimeCachePolicy: getExplorerRuntimeCachePolicy,
    isCloudPath: isCloudExplorerPath,
    listLocation: listExplorerLocation,
    listLocationUncached: listExplorerLocationUncached,
    measureEntrySizes: measureExplorerEntrySizes,
    openPath: openExplorerPath,
    openWithDialog: openExplorerPathWithDialog,
    openPathAsAdmin: openExplorerPathAsAdmin,
    readFileBase64: readExplorerFileBase64,
    readImageThumbnail: readExplorerImageThumbnail,
    readTextFile: readExplorerTextFile,
    renamePath: renameExplorerPath,
    revealPath: revealExplorerPath,
    restoreRecentTrashAction: restoreExplorerTrashAction,
    showPathProperties: showExplorerPathProperties,
    listSavedSearches: listExplorerSavedSearches,
    deleteSavedSearch: deleteExplorerSavedSearch,
    listTags: listExplorerTags,
    searchEntriesWithDiagnostics: searchExplorerEntriesWithDiagnostics,
    saveSavedSearch: saveExplorerSavedSearch,
    setTagsForPaths: setExplorerTagsForPaths,
    supportsNativeDragOut,
    supportsNativeIntegration,
    supportsSearch,
    startDuplicateScan: startExplorerDuplicateScan,
    pollDuplicateScan: pollExplorerDuplicateScan,
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
    keybindings,
    clearExplorerChromeLayoutOverride,
    setExplorerChromeLayoutOverride,
    setExplorerModeProfileOverride,
    updateExplorerSettings,
  } = useSettingsStore(useShallow(state => ({
    explorerSettings: state.settings.explorer,
    appearanceSettings: state.settings.appearance,
    systemSettings: state.settings.system,
    keybindings: state.settings.keybindings,
    clearExplorerChromeLayoutOverride: state.clearExplorerChromeLayoutOverride,
    setExplorerChromeLayoutOverride: state.setExplorerChromeLayoutOverride,
    setExplorerModeProfileOverride: state.setExplorerModeProfileOverride,
    updateExplorerSettings: state.updateExplorer,
  })));
  const {
    chromeEditSession,
    explorerRail,
    closeChromeEditSession,
    updateExplorerSessionForInstance,
    updateExplorerRail,
    clipboard,
    openChromeEditSession,
    registerChromeEditSurface,
    setClipboard,
    setChromeEditDraggingControl,
    unregisterChromeEditSurface,
    updateChromeEditDraft,
  } = useExplorerStore(useShallow(state => ({
    chromeEditSession: state.chromeEditSession,
    explorerRail: state.rail,
    closeChromeEditSession: state.closeChromeEditSession,
    updateExplorerSessionForInstance: state.updateSessionForInstance,
    updateExplorerRail: state.updateRail,
    clipboard: state.clipboard,
    openChromeEditSession: state.openChromeEditSession,
    registerChromeEditSurface: state.registerChromeEditSurface,
    setClipboard: state.setClipboard,
    setChromeEditDraggingControl: state.setChromeEditDraggingControl,
    unregisterChromeEditSurface: state.unregisterChromeEditSurface,
    updateChromeEditDraft: state.updateChromeEditDraft,
  })));
  const storedSourcesVisible = useExplorerStore(
    state => state.sessions[instanceId]?.sourcesVisible ?? defaultExplorerSession.sourcesVisible,
  );
  const storedPreviewEnabled = useExplorerStore(
    state => state.sessions[instanceId]?.previewEnabled ?? defaultExplorerSession.previewEnabled,
  );
  const storedShellLayoutId = useExplorerStore(
    state => state.sessions[instanceId]?.shellLayoutId ?? defaultExplorerSession.shellLayoutId,
  );
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const explorerSearchScopeId = useId();
  const explorerSearchScope = useMemo(
    () => resolveExplorerSearchScope(explorerSearchScopeId),
    [explorerSearchScopeId],
  );
  const isCompactDock = layoutMode === 'dock';
  const showsGlobalChromeControls = chromeControlSurface === 'topbar';
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
    return activeThemeId || 'operator';
  }, [appearance?.baseTheme.id, appearanceSettings.activeThemeId]);
  const sidebarBounds = getExplorerRailWidthBounds(isCompactDock);
  const uiFont = appearance?.fonts.ui ?? 'Inter,system-ui,sans-serif';
  const themeIconTheme = appearance?.theme.assets?.iconTheme ?? getBuiltInIconTheme();
  const useNativeOsIcons = appearanceSettings.useNativeOsIcons;
  const explorerBlurEnabled = appearanceSettings.appBlur !== false;
  const showHidden = explorerSettings.showHiddenFiles;
  const viewMode = explorerSettings.viewMode;
  const gridZoom = explorerSettings.gridZoom;
  const experimentalViewMode = explorerSettings.experimentalViewMode;
  const experimentalDensity = explorerSettings.experimentalDensity;
  const folderClickMode = explorerSettings.folderClickMode;
  // Session is only used to seed the explorer's local state. Avoid subscribing to it
  // so high-frequency local changes (typing, resizing) don't force extra store-driven renders.
  const initialSessionRef = useRef(useExplorerStore.getState().getSession(instanceId));
  const initialSession = initialSessionRef.current;
  const initialSessionPathRef = useRef(initialSession.currentPath.trim());
  const [currentPath,  setCurrentPath]  = useState(() => initialSession.currentPath);
  const [history,      setHistory]      = useState<string[]>(() => initialSession.history);
  const [historyIdx,   setHistoryIdx]   = useState(() => initialSession.historyIdx);
  const historyRef = useRef(history);
  const historyIdxRef = useRef(historyIdx);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const width = typeof initialSession.sidebarWidth === 'number'
      ? initialSession.sidebarWidth
      : sidebarBounds.defaultWidth;
    return Math.max(sidebarBounds.minWidth, Math.min(sidebarBounds.maxWidth, width));
  });
  const [previewWidth, setPreviewWidth] = useState(() => {
    if (typeof initialSession.previewWidth === 'number') {
      return Math.max(
        EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
        Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, initialSession.previewWidth),
      );
    }
    return Math.max(
      EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
      Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, Math.round(explorerTheme.metrics.previewWidth)),
    );
  });
  const [entries,      setEntries]      = useState<FileEntry[]>([]);
  const [entrySizes,   setEntrySizes]   = useState<Record<string, EntryStorageInfo>>({});
  const [entrySizeLoadingPaths, setEntrySizeLoadingPaths] = useState<Set<string>>(() => new Set());
  const [nativeIconMap, setNativeIconMap] = useState<Record<string, string | null>>({});
  const [nativeIconLoadingKeys, setNativeIconLoadingKeys] = useState<Set<string>>(() => new Set());
  const [imageThumbnailMap, setImageThumbnailMap] = useState<Record<string, string | null>>({});
  const [imageThumbnailLoadingPaths, setImageThumbnailLoadingPaths] = useState<Set<string>>(() => new Set());
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
  const [drives,       setDrives]       = useState<DriveInfo[]>([]);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string|null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [search,       setSearch]       = useState(() => initialSession.search);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchIncludeContent, setSearchIncludeContent] = useState(() => initialSession.searchIncludeContent);
  const [documentViewMode, setDocumentViewMode] = useState<ExplorerDocumentViewMode>(() => initialSession.documentViewMode);
  const [previewEnabled, setPreviewEnabled] = useState(() => initialSession.previewEnabled);
  const [sourcesVisible, setSourcesVisible] = useState(() => initialSession.sourcesVisible);
  const [preview,      setPreview]      = useState<PreviewState>({ type:'none', path:'' });
  const [ctxMenu,      setCtxMenu]      = useState<ContextMenuState>({ visible:false, x:0, y:0, entry:null });
  const [showModeProfileMenu, setShowModeProfileMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showExperimentalMenu, setShowExperimentalMenu] = useState(false);
  const [rename,       setRename]       = useState<RenameState>({ active:false, path:'', name:'' });
  const [deleteTargets, setDeleteTargets] = useState<FileEntry[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [newItem,      setNewItem]      = useState<NewItemState>({ visible:false, kind:'folder' });
  const [newItemName,  setNewItemName]  = useState('');
  const [batchRename, setBatchRename] = useState<BatchRenameState>({
    visible: false,
    findText: '',
    replaceText: '',
    prefix: '',
    suffix: '',
    startingNumber: 1,
    padding: 2,
  });
  const [saveSearchState, setSaveSearchState] = useState<SaveSearchState>({ visible: false, name: '' });
  const [duplicateFinder, setDuplicateFinder] = useState<DuplicateFinderState>({
    visible: false,
    scanId: null,
    status: null,
    loading: false,
  });
  const [tagMetadata, setTagMetadata] = useState<ExplorerTagMetadataSnapshot>({ tags: [], assignments: [] });
  const [savedSearches, setSavedSearches] = useState<ExplorerSavedSearch[]>([]);
  const [activeTagFilterIds, setActiveTagFilterIds] = useState<string[]>([]);
  const [dragOver,     setDragOver]     = useState<string|null>(null); // path being dragged over
  const [windowDropState, setWindowDropState] = useState<{ active: boolean; count: number }>({ active: false, count: 0 });
  const lastSelected   = useRef<string|null>(null);
  const previewRef = useRef(preview);
  const previewSaveTimer = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  const searchFocusRequestIdRef = useRef(0);
  const isExplorerMountedRef = useRef(false);
  const directoryLoadRequestIdRef = useRef(0);
  const bootNavigationSequenceRef = useRef(0);
  const initialInteractiveRecordedRef = useRef(false);
  const explorerMountStartedAtRef = useRef(getExplorerPerformanceNow());
  const runtimeCachePolicyTelemetryMetadataRef = useRef<RuntimeCachePolicyTelemetryMetadata>(
    getRuntimeCachePolicyTelemetryMetadata(null, isTauri() ? 'pending' : 'unavailable'),
  );
  const pendingExplorerMetricSamplesRef = useRef<PendingExplorerMetricSample[]>([]);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [locationBreadcrumbs, setLocationBreadcrumbs] = useState<{ label: string; path: string }[]>([]);
  const [locationParentPath, setLocationParentPath] = useState<string | null>(null);
  const lastFocusAddressBarSignalRef = useRef(focusAddressBarSignal);
  const lastWorkspaceNavigationSequenceRef = useRef(0);
  const lastWorkspaceTransferSequenceRef = useRef(0);
  const lastWorkspaceRefreshSequenceRef = useRef(0);
  useExplorerTaskProgressFeed();

  const mainRef = useRef<HTMLDivElement>(null);
  const explorerViewportRef = useRef<HTMLDivElement>(null);
  const modeProfileMenuAnchorRef = useRef<HTMLDivElement>(null);
  const layoutMenuAnchorRef = useRef<HTMLDivElement>(null);
  const experimentalMenuAnchorRef = useRef<HTMLDivElement>(null);
  const layoutWheelDeltaAccumulatorRef = useRef(0);
  const previewWarmupStartedRef = useRef(false);
  const previewWarmupTimerRef = useRef<number | null>(null);
  const [zoomHudVisible, setZoomHudVisible] = useState(false);
  const zoomHudTimerRef = useRef<number | null>(null);
  const [experimentalHudVisible, setExperimentalHudVisible] = useState(false);
  const experimentalHudTimerRef = useRef<number | null>(null);
  const [explorerViewportMetrics, setExplorerViewportMetrics] = useState<ViewportMetrics>({
    scrollTop: 0,
    clientHeight: 0,
    clientWidth: 0,
  });
  const currentPathIsCloud = currentPath.length > 0 && isCloudExplorerPath(currentPath);
  const isExperimentalViewEligible = !isCompactDock && search.trim().length === 0;

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
    const paths = Array.from(new Set([...entries, ...searchResults].map((entry) => entry.path))).slice(0, 500);
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
    setSidebarWidth(current => Math.max(sidebarBounds.minWidth, Math.min(sidebarBounds.maxWidth, current)));
  }, [sidebarBounds.maxWidth, sidebarBounds.minWidth]);

  useEffect(() => {
    setPreviewWidth(current => Math.max(EXPLORER_PREVIEW_WIDTH_BOUNDS.min, Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, current)));
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
    if (!showModeProfileMenu && !showLayoutMenu && !showExperimentalMenu) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (modeProfileMenuAnchorRef.current?.contains(event.target as Node)) {
        return;
      }
      if (layoutMenuAnchorRef.current?.contains(event.target as Node)) {
        return;
      }
      if (experimentalMenuAnchorRef.current?.contains(event.target as Node)) {
        return;
      }
      setShowModeProfileMenu(false);
      setShowLayoutMenu(false);
      setShowExperimentalMenu(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [showExperimentalMenu, showLayoutMenu, showModeProfileMenu]);

  const flushPendingExplorerMetrics = useCallback((
    runtimePolicyMetadata: RuntimeCachePolicyTelemetryMetadata,
  ) => {
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
  }, []);

  const recordExplorerMetric = useCallback((input: {
    metricId: ExplorerPerformanceMetricId;
    durationMs: number;
    metadata?: ExplorerPerformanceMetadata;
  }) => {
    const runtimePolicyMetadata = runtimeCachePolicyTelemetryMetadataRef.current;
    if (isTauri() && runtimePolicyMetadata.runtimeCachePolicyStatus === 'pending') {
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
  }, []);

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
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      runtimeCachePolicyTelemetryMetadataRef.current = getRuntimeCachePolicyTelemetryMetadata(null, 'unavailable');
      flushPendingExplorerMetrics(runtimeCachePolicyTelemetryMetadataRef.current);
      return undefined;
    }

    let disposed = false;
    void getExplorerRuntimeCachePolicy()
      .then((policy) => {
        if (disposed) {
          return;
        }
        runtimeCachePolicyTelemetryMetadataRef.current = getRuntimeCachePolicyTelemetryMetadata(policy, 'ready');
        flushPendingExplorerMetrics(runtimeCachePolicyTelemetryMetadataRef.current);
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        runtimeCachePolicyTelemetryMetadataRef.current = getRuntimeCachePolicyTelemetryMetadata(null, 'failed');
        flushPendingExplorerMetrics(runtimeCachePolicyTelemetryMetadataRef.current);
      });

    return () => {
      disposed = true;
      flushPendingExplorerMetrics(runtimeCachePolicyTelemetryMetadataRef.current);
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
    previewWidth,
    search,
    searchIncludeContent,
    sidebarWidth,
    sourcesVisible,
    instanceId,
    updateExplorerSessionForInstance,
  ]);

  // ── Navigate ──
  const navigate = useCallback(async (path: string, push = true) => {
    if (!isExplorerMountedRef.current) {
      return;
    }
    const startedAt = getExplorerPerformanceNow();
    const normalizedPath = normalizeExplorerPath(path);
    const requestId = directoryLoadRequestIdRef.current + 1;
    directoryLoadRequestIdRef.current = requestId;
    const isActiveDirectoryLoadRequest = () => (
      isExplorerMountedRef.current && directoryLoadRequestIdRef.current === requestId
    );
    setCurrentPath(normalizedPath); setSelected(new Set()); setSearch(''); setSearchResults([]); setSearchLoading(false); setError(null);
    setEntrySizeLoadingPaths(new Set());
    setAddressEditing(false);
    setAddressDraft('');
    if (push) {
      const nextHistory = [...historyRef.current.slice(0, historyIdxRef.current + 1), normalizedPath];
      const nextHistoryIdx = historyIdxRef.current + 1;
      historyRef.current = nextHistory;
      historyIdxRef.current = nextHistoryIdx;
      setHistory(nextHistory);
      setHistoryIdx(nextHistoryIdx);
    }
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
      startTransition(() => {
        if (isActiveDirectoryLoadRequest()) {
          setEntries(nextListing.entries);
        }
      });
      if (!isActiveDirectoryLoadRequest()) {
        return;
      }
      setLocationBreadcrumbs(nextListing.breadcrumbs);
      setLocationParentPath(nextListing.parentPath);
      recordExplorerMetric({
        metricId: 'explorer_navigation',
        durationMs: getExplorerPerformanceNow() - startedAt,
        metadata: {
          entryCount: nextListing.entries.length,
          pathDepth: nextListing.breadcrumbs.length,
          showHidden,
          success: true,
        },
      });
    }
    catch (e) {
      if (!isActiveDirectoryLoadRequest()) {
        return;
      }
      setError(String(e));
      startTransition(() => {
        if (isActiveDirectoryLoadRequest()) {
          setEntries([]);
        }
      });
      setLocationBreadcrumbs([]);
      setLocationParentPath(null);
      recordExplorerMetric({
        metricId: 'explorer_navigation',
        durationMs: getExplorerPerformanceNow() - startedAt,
        metadata: {
          entryCount: 0,
          pathDepth: normalizedPath.split(/[\\/]/).filter(Boolean).length,
          showHidden,
          success: false,
        },
      });
    }
    finally {
      if (isActiveDirectoryLoadRequest()) {
        setLoading(false);
      }
    }
  }, [isCloudExplorerPath, listExplorerLocation, recordExplorerMetric, showHidden]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIdxRef.current = historyIdx;
  }, [historyIdx]);

  const runDeferredBootNavigation = useCallback(async (
    generation: number,
    path: string,
    push = true,
  ) => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    if (!isExplorerMountedRef.current || bootNavigationSequenceRef.current !== generation) {
      return false;
    }
    await navigate(path, push);
    return true;
  }, [navigate]);

  // ── Boot ──
  useEffect(() => {
    let disposed = false;
    const generation = bootNavigationSequenceRef.current + 1;
    bootNavigationSequenceRef.current = generation;

    const isActiveBootNavigation = () => (
      !disposed
      && isExplorerMountedRef.current
      && bootNavigationSequenceRef.current === generation
    );

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
      const navigated = await runDeferredBootNavigation(generation, bootstrapPath);
      if (navigated || !isActiveBootNavigation()) {
        return navigated;
      }
      return navigateToResolvedHome();
    };

    const resetBootSession = () => {
      if (!isActiveBootNavigation()) {
        return;
      }
      initialSessionPathRef.current = '';
      setCurrentPath('');
      setHistory([]);
      setHistoryIdx(-1);
      updateExplorerSessionForInstance(instanceId, {
        currentPath: '',
        history: [],
        historyIdx: -1,
      });
    };

    const startBootNavigation = async () => {
      const restoredPath = initialSessionPathRef.current;
      if (restoredPath) {
        const restored = await runDeferredBootNavigation(generation, restoredPath, false);
        if (restored || !isActiveBootNavigation()) {
          return;
        }
        resetBootSession();
      }

      const preferredPath = explorerSettings.defaultPath.trim();
      const bootstrapPath = preferredPath && preferredPath !== '.' ? preferredPath : null;
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
  }, [explorerSettings.defaultPath, getExplorerDrives, getExplorerHomeDir, instanceId, runDeferredBootNavigation, runtimePlatform, updateExplorerSessionForInstance]);

  const runSearch = useCallback(async (query: string, requestId: number) => {
    const isActiveSearchRequest = () => (
      isExplorerMountedRef.current && searchRequestIdRef.current === requestId
    );
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
      setError('Search is not available for cloud drives yet.');
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
          metricId: 'explorer_search',
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
          metricId: 'explorer_search',
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
  }, [currentPath, explorerSearchScope, recordExplorerMetric, searchIncludeContent, showHidden, supportsSearch]);

  const refresh = useCallback(async () => {
    if (!currentPath || !isExplorerMountedRef.current) return;
    const requestId = directoryLoadRequestIdRef.current + 1;
    directoryLoadRequestIdRef.current = requestId;
    const isActiveDirectoryLoadRequest = () => (
      isExplorerMountedRef.current && directoryLoadRequestIdRef.current === requestId
    );
    const entriesToInvalidate = search.trim() ? searchResults : entries;
    invalidateExplorerResultCaches(currentPath);
    setLoading(true);
    setEntrySizes(current => {
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
    setImageThumbnailMap(current => {
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
    setImageThumbnailLoadingPaths(new Set());
    try {
      const nextListing = await listExplorerLocationUncached(currentPath, showHidden);
      if (!isActiveDirectoryLoadRequest()) {
        return;
      }
      storeExplorerCachedLocation({
        path: currentPath,
        showHidden,
        listing: nextListing,
      });
      startTransition(() => {
        if (isActiveDirectoryLoadRequest()) {
          setEntries(nextListing.entries);
        }
      });
      if (!isActiveDirectoryLoadRequest()) {
        return;
      }
      setLocationBreadcrumbs(nextListing.breadcrumbs);
      setLocationParentPath(nextListing.parentPath);
    }
    catch (e) {
      if (isActiveDirectoryLoadRequest()) {
        setError(String(e));
      }
    }
    finally {
      if (isActiveDirectoryLoadRequest()) {
        setLoading(false);
      }
    }
    if (isActiveDirectoryLoadRequest() && search.trim() && supportsSearch(currentPath)) {
      const requestId = ++searchRequestIdRef.current;
      void runSearch(search, requestId);
    }
  }, [currentPath, entries, listExplorerLocationUncached, search, searchResults, showHidden, runSearch, supportsSearch]);

  useEffect(() => { refresh(); }, [showHidden]);

  useEffect(() => {
    if (!externalNavigationRequest) {
      return;
    }
    if (externalNavigationRequest.sequence === lastWorkspaceNavigationSequenceRef.current) {
      return;
    }
    lastWorkspaceNavigationSequenceRef.current = externalNavigationRequest.sequence;
    if (!externalNavigationRequest.path.trim() || externalNavigationRequest.path === currentPath) {
      return;
    }
    void navigate(externalNavigationRequest.path, externalNavigationRequest.pushHistory ?? true);
  }, [currentPath, externalNavigationRequest, navigate]);

  useEffect(() => {
    if (!externalRefreshRequest) {
      return;
    }
    if (externalRefreshRequest.sequence === lastWorkspaceRefreshSequenceRef.current) {
      return;
    }
    lastWorkspaceRefreshSequenceRef.current = externalRefreshRequest.sequence;
    void refresh();
  }, [externalRefreshRequest, refresh]);

  useEffect(() => {
    if (!currentPath || currentPathIsCloud || !isTauri() || !systemSettings.developerMode) {
      return undefined;
    }

    void watchExplorerEntrySizeRoot(currentPath).catch(error => {
      console.warn('OverlayTerm: failed to watch entry size root', error);
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
      metricId: 'explorer_first_interactive',
      durationMs: getExplorerPerformanceNow() - explorerMountStartedAtRef.current,
      metadata: {
        currentPathDepth: currentPath.split(/[\\/]/).filter(Boolean).length,
        entryCount: entries.length,
        hasError: Boolean(error),
        isSearchActive: search.trim().length > 0,
      },
    });
  }, [currentPath, entries.length, error, loading, recordExplorerMetric, search]);

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

  const goBack = useCallback(() => { if (historyIdx > 0) { setHistoryIdx(i => i - 1); navigate(history[historyIdx - 1], false); } }, [history, historyIdx, navigate]);
  const goForward = useCallback(() => { if (historyIdx < history.length - 1) { setHistoryIdx(i => i + 1); navigate(history[historyIdx + 1], false); } }, [history, historyIdx, navigate]);
  const goUp      = () => {
    if (!currentPath) return;
    if (currentPathIsCloud) {
      if (locationParentPath) {
        void navigate(locationParentPath);
      }
      return;
    }
    const sep = currentPath.includes('/') ? '/' : '\\';
    const parts = currentPath.replace(/[/\\]+$/, '').split(/[/\\]/);
    if (parts.length > 1) { parts.pop(); const p = parts.join(sep); navigate(p.endsWith(':') ? p+'\\' : p || sep); }
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
    setSearch('');
    setSearchResults([]);
    setSearchLoading(false);
  }, []);

  const submitAddressDraft = useCallback(async (rawValue: string) => {
    const trimmed = rawValue.trim();
    setAddressEditing(false);

    if (!trimmed) {
      setAddressDraft(search.trim() ? search : currentPath);
      return;
    }

    if (isLikelyExplorerPathInput(trimmed)) {
      const resolvedPath = resolveExplorerPathInput(trimmed, currentPath, runtimePlatform);
      setAddressDraft(resolvedPath);
      await navigate(resolvedPath);
      return;
    }

    if (!supportsSearch(currentPath)) {
      setAddressDraft(currentPath);
      setError('Search is not available for cloud drives yet.');
      return;
    }

    setAddressDraft(trimmed);
    setSearch(trimmed);
  }, [currentPath, navigate, runtimePlatform, search, supportsSearch]);

  const isSearchActive = search.trim().length > 0;
  const toggleSort = useCallback((nextSortBy: ExplorerSortKey) => {
    const nextSortOrder = explorerSettings.sortBy === nextSortBy
      ? (explorerSettings.sortOrder === 'asc' ? 'desc' : 'asc')
      : getDefaultExplorerSortOrder(nextSortBy);

    updateExplorerSettings({
      sortBy: nextSortBy,
      sortOrder: nextSortOrder,
    });
  }, [
    explorerSettings.sortBy,
    explorerSettings.sortOrder,
    updateExplorerSettings,
  ]);
  const pathTagIdsByPath = useMemo(() => new Map(
    tagMetadata.assignments.map((assignment) => [assignment.path, assignment.tagIds] as const),
  ), [tagMetadata.assignments]);
  const filteredEntries = useMemo(
    () => (isSearchActive ? searchResults : entries).filter((entry) => {
      if (activeTagFilterIds.length === 0) {
        return true;
      }
      const tagIds = pathTagIdsByPath.get(entry.path) ?? [];
      return activeTagFilterIds.every((tagId) => tagIds.includes(tagId));
    }),
    [activeTagFilterIds, entries, isSearchActive, pathTagIdsByPath, searchResults],
  );
  const visibleEntries = useMemo(
    () => [...filteredEntries].sort((left, right) => (
      compareExplorerEntries(
        left,
        right,
        explorerSettings.sortBy,
        explorerSettings.sortOrder,
      )
    )),
    [
      filteredEntries,
      explorerSettings.sortBy,
      explorerSettings.sortOrder,
    ],
  );
  const sourceEntryCount = isSearchActive ? searchResults.length : entries.length;
  const filteredEntryCount = visibleEntries.length;
  const experimentalSemanticBands = useMemo(
    () => (isExperimentalViewEligible
      && (
        experimentalViewMode === 'adaptive-semantic-grid'
        || (
          experimentalViewMode === 'off'
          && (
            explorerTheme.preferredExperimentalViewMode === 'adaptive-semantic-grid'
            || explorerTheme.preferredExperimentalViewMode === 'constellation'
          )
        )
        || experimentalViewMode === 'constellation'
      )
      ? buildAdaptiveSemanticBands(
        visibleEntries,
        selected,
        currentPath,
        explorerSettings.sortBy,
        explorerSettings.sortOrder,
      )
      : []),
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
  const bookmarkPathSet = useMemo(() => new Set(
    explorerRail.nodes
      .filter((node): node is typeof explorerRail.nodes[number] & { kind: 'bookmark'; path: string } => node.kind === 'bookmark')
      .map((node) => node.path),
  ), [explorerRail.nodes]);
  const selectedEntries = useMemo(
    () => visibleEntries.filter(entry => selected.has(entry.path)),
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
    const totalBytes = selectedSizeEntries.reduce((sum, value) => sum + value.bytes, 0);
    return { totalBytes, count: selectedSizeEntries.length };
  }, [entrySizes, selectedEntries]);
  const droppedSourceLookup = useMemo(() => {
    const lookup = new Map<string, { path: string; name: string; isDirectory: boolean }>();
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
  const goHome = useCallback(() => {
    getExplorerHomeDir().then(p => navigate(p)).catch(() => {});
  }, [navigate]);
  const toggleSearchScope = useCallback(() => {
    setSearchIncludeContent(value => !value);
  }, []);
  const cycleSortKey = useCallback(() => {
    const order: ExplorerSortKey[] = ['name', 'size', 'date', 'type'];
    const nextIndex = (order.indexOf(explorerSettings.sortBy) + 1) % order.length;
    updateExplorerSettings({ sortBy: order[nextIndex], sortOrder: getDefaultExplorerSortOrder(order[nextIndex]) });
  }, [explorerSettings.sortBy, updateExplorerSettings]);
  const toggleSortOrder = useCallback(() => {
    updateExplorerSettings({ sortOrder: explorerSettings.sortOrder === 'asc' ? 'desc' : 'asc' });
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
  const selectAllVisibleEntries = useCallback(() => {
    setSelected(new Set(visibleEntries.map(entry => entry.path)));
  }, [visibleEntries]);
  const clearExplorerSelection = useCallback(() => {
    setSelected(new Set());
    lastSelected.current = null;
  }, []);

  const selectVisibleEntryAtIndex = useCallback((index: number, extendRange: boolean) => {
    if (visibleEntries.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, visibleEntries.length - 1));
    const nextEntry = visibleEntries[clampedIndex];
    if (!nextEntry) return;

    if (!extendRange) {
      setSelected(new Set([nextEntry.path]));
      lastSelected.current = nextEntry.path;
      return;
    }

    const anchorPath = lastSelected.current ?? Array.from(selected)[0] ?? nextEntry.path;
    const anchorIndex = visibleEntries.findIndex(entry => entry.path === anchorPath);
    const rangeStart = anchorIndex >= 0 ? Math.min(anchorIndex, clampedIndex) : clampedIndex;
    const rangeEnd = anchorIndex >= 0 ? Math.max(anchorIndex, clampedIndex) : clampedIndex;

    setSelected(new Set(visibleEntries.slice(rangeStart, rangeEnd + 1).map(entry => entry.path)));
    lastSelected.current = anchorPath;
  }, [selected, visibleEntries]);
  const handleBookmarkCreated = useCallback((name: string, path: string) => {
    void Promise.resolve(onAddBookmark(name, path)).catch(() => {});
  }, [onAddBookmark]);
  const resolveDroppedBookmarkSources = useCallback((paths: string[]) => paths
    .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
    .map((path) => {
      const known = droppedSourceLookup.get(path);
      const fallbackName = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
      const inferredDirectory = known?.isDirectory ?? !/\.[^\\/]+$/.test(fallbackName);
      return {
        path,
        name: known?.name ?? fallbackName,
        isDirectory: inferredDirectory,
      };
    }), [droppedSourceLookup]);
  const activeDragPathsRef = useRef<string[]>([]);
  const isProcessElevatedRef = useRef(false);
  const selectedDirectoryEntries = useMemo(
    () => selectedEntries.filter(entry => entry.is_dir),
    [selectedEntries],
  );
  const repositoryPickerConfirmationPaths = useMemo(() => resolveRepositoryPickerConfirmationPaths({
    allowMultiple: repositoryPicker?.allowMultiple ?? true,
    currentPath,
    hasAnySelection: selectedEntries.length > 0,
    selectedDirectoryPaths: selectedDirectoryEntries.map(entry => entry.path),
  }), [
    currentPath,
    repositoryPicker?.allowMultiple,
    selectedDirectoryEntries,
    selectedEntries.length,
  ]);
  const canConfirmRepositorySelection = repositoryPickerConfirmationPaths.length > 0;
  const isRepositoryPickerUsingCurrentPath = (
    selectedEntries.length === 0
    && repositoryPickerConfirmationPaths.length === 1
    && repositoryPickerConfirmationPaths[0] === currentPath.trim()
  );
  const repositoryPickerConfirmLabel = useMemo(() => getRepositoryPickerConfirmLabel({
    allowMultiple: repositoryPicker?.allowMultiple ?? true,
    currentPath,
    hasAnySelection: selectedEntries.length > 0,
    selectedDirectoryCount: selectedDirectoryEntries.length,
  }), [currentPath, repositoryPicker?.allowMultiple, selectedDirectoryEntries.length, selectedEntries.length]);

  useEffect(() => {
    if (!repositoryPicker?.active) {
      return;
    }
    setSelected(new Set());
    setCtxMenu({ visible: false, x: 0, y: 0, entry: null });
    setDeleteTargets([]);
  }, [repositoryPicker?.active, repositoryPicker?.requestId]);

  const getEntryStorageLabel = useCallback((entry: FileEntry) => {
    const measuredInfo = entrySizes[entry.path];
    if (measuredInfo) {
      const formatted = formatSize(measuredInfo.bytes);
      return measuredInfo.is_complete || !entry.is_dir ? formatted : `${formatted}+`;
    }
    if (!entry.is_dir) {
      return formatSize(entry.size);
    }
    return '—';
  }, [entrySizes]);

  const resolveEntriesForAction = useCallback((entry?: FileEntry) => {
    if (!entry) return selectedEntries;
    if (selected.has(entry.path) && selectedEntries.length > 0) {
      return selectedEntries;
    }
    return [entry];
  }, [selected, selectedEntries]);

  const getRenderableIconSrc = useCallback((entry: FileEntry, open = false) => {
    if (useNativeOsIcons) {
      const nativeIconSrc = nativeIconMap[getNativeIconCacheKey(entry.path, DEFAULT_NATIVE_ICON_SIZE)];
      if (nativeIconSrc) {
        return nativeIconSrc;
      }
    }

    return getIconSrc(entry, open, {
      rules: explorerSettings.folderIconRules,
      defaultIcon: explorerSettings.defaultFolderIcon,
    }, themeIconTheme);
  }, [
    explorerSettings.defaultFolderIcon,
    explorerSettings.folderIconRules,
    nativeIconMap,
    themeIconTheme,
    useNativeOsIcons,
  ]);

  const getGridEntryThumbnailSrc = useCallback((entry: FileEntry): string | null => {
    if (entry.is_dir || currentPathIsCloud) {
      return null;
    }
    if (!isImagePreviewExtension(getEntryExtension(entry))) {
      return null;
    }
    return imageThumbnailMap[entry.path] ?? null;
  }, [currentPathIsCloud, imageThumbnailMap]);

  const queueClipboard = useCallback((action: 'copy' | 'cut', entry?: FileEntry) => {
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
  }, [resolveEntriesForAction, setClipboard]);

  const openAsAdmin = useCallback(async (path: string) => {
    await openExplorerPathAsAdmin(path).catch(e => setError(String(e)));
  }, []);

  const openWithSystemPicker = useCallback(async (path: string) => {
    await openExplorerPathWithDialog(path).catch(error => setError(String(error)));
  }, [openExplorerPathWithDialog]);

  const showNativeProperties = useCallback(async (path: string) => {
    await showExplorerPathProperties(path).catch(error => setError(String(error)));
  }, [showExplorerPathProperties]);

  const transferIntoDirectory = useCallback(async (
    targetDir: string,
    sources: string[],
    operation: FileTransferOperation,
  ): Promise<FileTransferResult[]> => {
    if (sources.length === 0) return [];
    const results = await transferExplorerItems(targetDir, sources, operation);
    invalidateExplorerResultCaches();
    return results;
  }, [transferExplorerItems]);

  useEffect(() => {
    if (!isTauri()) {
      isProcessElevatedRef.current = false;
      return;
    }

    let cancelled = false;
    void commands.fsIsProcessElevated()
      .then(result => {
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

    win.onDragDropEvent(async event => {
      if (disposed) return;

      if (event.payload.type === 'enter') {
        setWindowDropState({ active: true, count: event.payload.paths.length });
        return;
      }

      if (event.payload.type === 'leave') {
        setWindowDropState({ active: false, count: 0 });
        return;
      }

      if (event.payload.type === 'drop') {
        setWindowDropState({ active: false, count: 0 });
        if (!currentPath) return;
        try {
          await transferIntoDirectory(currentPath, event.payload.paths, 'copy');
          refresh();
        } catch (error) {
          setError(String(error));
        }
      }
    }).then(fn => {
      unlisten = fn;
    }).catch(error => {
      console.warn('OverlayTerm: failed to register drag-drop listener', error);
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [currentPath, refresh, transferIntoDirectory]);

  // ── Open ──
  const getSearchFocusTarget = useCallback((entry: FileEntry): EditorSearchFocusTarget | null => {
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
  }, [isSearchActive, search]);

  const persistPreviewText = useCallback(async (path: string) => {
    const currentPreview = previewRef.current;
    if (currentPreview.type !== 'text' || currentPreview.path !== path) return;

    const contentAtSave = currentPreview.content;
    setPreview(prev => (
      prev.type === 'text' && prev.path === path
        ? { ...prev, isSaving: true, error: null }
        : prev
    ));

    try {
      await writeExplorerFile(path, contentAtSave);
      invalidateExplorerResultCaches();
      setPreview(prev => {
        if (prev.type !== 'text' || prev.path !== path) return prev;
        const isStillSame = prev.content === contentAtSave;
        return {
          ...prev,
          isSaving: false,
          isDirty: !isStillSame,
          lastSavedAt: isStillSame ? Date.now() : prev.lastSavedAt,
          error: null,
        };
      });
    } catch (saveError) {
      setPreview(prev => (
        prev.type === 'text' && prev.path === path
          ? { ...prev, isSaving: false, error: String(saveError) }
          : prev
      ));
      setError(`Save failed for ${currentPreview.name}: ${saveError}`);
    }
  }, []);

  const queuePreviewSave = useCallback((path: string) => {
    if (previewSaveTimer.current) {
      window.clearTimeout(previewSaveTimer.current);
    }
    previewSaveTimer.current = window.setTimeout(() => {
      previewSaveTimer.current = null;
      void persistPreviewText(path);
    }, 700);
  }, [persistPreviewText]);

  const flushPreviewTextSave = useCallback(async () => {
    const currentPreview = previewRef.current;
    if (currentPreview.type !== 'text' || !currentPreview.isDirty) {
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

  const updatePreviewTextContent = useCallback((path: string, content: string) => {
    setPreview(prev => (
      prev.type === 'text' && prev.path === path
        ? { ...prev, content, isDirty: true, error: null }
        : prev
    ));
    queuePreviewSave(path);
  }, [queuePreviewSave]);

  const closePreview = useCallback(async () => {
    await flushPreviewTextSave();
    setPreview({ type: 'none', path: '' });
    setPreviewLoading(false);
  }, [flushPreviewTextSave]);

  useEffect(() => {
    if (isCompactDock) {
      setSidebarWidth(current => Math.max(sidebarBounds.minWidth, Math.min(current, sidebarBounds.maxWidth)));
      void closePreview();
    }
  }, [closePreview, isCompactDock, sidebarBounds.maxWidth, sidebarBounds.minWidth]);

  useEffect(() => {
    if (!previewEnabled) {
      void closePreview();
    }
  }, [closePreview, previewEnabled]);

  const applyModeProfilePreset = useCallback((nextModeProfile: ExplorerModeProfileDefinition) => {
    const nextLayout = getExplorerShellLayoutDefinition(nextModeProfile.paneLayoutId);
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
  }, [
    explorerChromeThemeId,
    explorerTheme.metrics.previewWidth,
    explorerTheme.metrics.railWidth,
    sidebarBounds.maxWidth,
    sidebarBounds.minWidth,
    setExplorerModeProfileOverride,
  ]);

  const togglePreviewEnabled = useCallback(() => {
    if (previewEnabled) {
      setPreviewEnabled(false);
      void closePreview();
      return;
    }

    setPreviewEnabled(true);
  }, [closePreview, previewEnabled]);

  const previewEntry = useCallback(async (entry: FileEntry, focusTarget: EditorSearchFocusTarget | null = null) => {
    if (!previewEnabled || isCompactDock) {
      setPreview({ type: 'none', path: '' });
      return;
    }

    if (entry.is_dir) {
      setPreview({ type: 'none', path: '' });
      return;
    }

    const currentPreview = previewRef.current;
    if (currentPreview.type === 'text' && currentPreview.path !== entry.path) {
      await flushPreviewTextSave();
    }

    const ext = getEntryExtension(entry);

    const modelFormat = getModelPreviewFormat(ext);

    if (modelFormat) {
      setPreview({ type:'model3d', path:entry.path, format:modelFormat, name:entry.name, size: entry.size });
      return;
    }

    if (isImagePreviewExtension(ext)) {
      setPreviewLoading(true);
      try {
        const dataUri = await readExplorerFileBase64(entry.path);
        setPreview({ type:'image', path:entry.path, name:entry.name, content:dataUri });
      } catch (error) {
        setPreview({
          type: 'fallback',
          path: entry.path,
          name: entry.name,
          label: 'Image preview unavailable',
          detail: String(error),
        });
      }
      finally { setPreviewLoading(false); }
      return;
    }

    if (isEditableTextEntry(entry)) {
      const renderKind = getDocumentPreviewKind(entry.path);
      if (currentPreview.type === 'text' && currentPreview.path === entry.path) {
        setPreview(prev => (
          prev.type === 'text' && prev.path === entry.path
            ? { ...prev, name: entry.name, language: getMonacoLanguage(ext), renderKind, focusTarget }
            : prev
        ));
        return;
      }
      setPreviewLoading(true);
      try {
        const content = await readExplorerTextFile(entry.path);
        setPreview({
          type:'text',
          path:entry.path,
          name:entry.name,
          content,
          language:getMonacoLanguage(ext),
          renderKind,
          focusTarget,
          isDirty: false,
          isSaving: false,
          lastSavedAt: Date.now(),
          error: null,
        });
      } catch (error) {
        setPreview({
          type: 'fallback',
          path: entry.path,
          name: entry.name,
          label: 'Text preview unavailable',
          detail: String(error),
        });
      }
      finally { setPreviewLoading(false); }
      return;
    }
    setPreview({
      type: 'fallback',
      path: entry.path,
      name: entry.name,
      label: 'Preview unavailable',
      detail: 'No inline preview is available for this file type.',
    });
  }, [flushPreviewTextSave, isCompactDock, previewEnabled]);

  const openEntry = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      navigate(entry.path);
      return;
    }
    const ext = getEntryExtension(entry);
    const focusTarget = getSearchFocusTarget(entry);
    const canInlinePreview = previewEnabled && !isCompactDock;

    if (canInlinePreview && isEditableTextEntry(entry)) {
      await previewEntry(entry, focusTarget);
      return;
    }

    if (canInlinePreview && (getModelPreviewFormat(ext) || isImagePreviewExtension(ext))) {
      await previewEntry(entry, focusTarget);
      return;
    }

    if (isExecutableExtension(ext)) {
      await openExplorerPath(entry.path).catch(e => setError(String(e)));
      return;
    }

    await openExplorerPath(entry.path).catch(e => setError(String(e)));
  }, [getSearchFocusTarget, isCompactDock, navigate, openExplorerPath, previewEnabled, previewEntry]);

  // ── Duplicate ──
  const duplicate = useCallback(async (entry: FileEntry) => {
    try {
      await transferIntoDirectory(currentPath, [entry.path], 'copy');
      refresh();
    }
    catch(e) { setError(String(e)); }
  }, [currentPath, refresh, transferIntoDirectory]);

  // ── Clipboard (system) ──
  const copyToSysClipboard = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  }, []);

  // ── Paste ──
  const paste = useCallback(async () => {
    if (!clipboard) return;
    try {
      await transferIntoDirectory(
        currentPath,
        clipboard.entries.map(entry => entry.path),
        clipboard.action === 'cut' ? 'move' : 'copy',
      );
      if (clipboard.action === 'cut') {
        setClipboard(null);
      }
      refresh();
    } catch(e) { setError(String(e)); }
  }, [clipboard, currentPath, refresh, transferIntoDirectory]);

  useEffect(() => {
    if (!externalSelectionTransferRequest) {
      return;
    }
    if (externalSelectionTransferRequest.sequence === lastWorkspaceTransferSequenceRef.current) {
      return;
    }
    lastWorkspaceTransferSequenceRef.current = externalSelectionTransferRequest.sequence;

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
        await transferIntoDirectory(
          targetDir,
          sourcePaths,
          externalSelectionTransferRequest.operation,
        );
        if (externalSelectionTransferRequest.operation === 'move') {
          setSelected(new Set());
          if (sourcePaths.includes(previewRef.current.path)) {
            setPreview({ type: 'none', path: '' });
            setPreviewLoading(false);
          }
        }
        await refresh();
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
    externalSelectionTransferRequest,
    instanceId,
    onWorkspaceSelectionTransferComplete,
    refresh,
    selectedEntries,
    transferIntoDirectory,
  ]);

  // ── Rename ──
  const commitRename = async (newName: string) => {
    const dir = rename.path.replace(/[/\\][^/\\]+$/, '');
    const sep = rename.path.includes('/') ? '/' : '\\';
    const oldPath = rename.path;
    const newPath = dir + sep + newName;
    try {
      const shouldResaveRenamedPreview = previewRef.current.type === 'text'
        && previewRef.current.path === oldPath
        && previewRef.current.isDirty;
      await renameExplorerPath(oldPath, newPath);
      invalidateExplorerResultCaches();
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
        previewSaveTimer.current = null;
      }
      setPreview(prev => {
        if (prev.type === 'none' || prev.path !== oldPath) return prev;
        if (prev.type === 'text') {
          return { ...prev, path: newPath, name: newName, error: null };
        }
        if (prev.type === 'image') {
          return { ...prev, path: newPath, name: newName };
        }
        return { ...prev, path: newPath, name: newName };
      });
      if (shouldResaveRenamedPreview) {
        queuePreviewSave(newPath);
      }
      setRename({ active:false, path:'', name:'' });
      refresh();
    }
    catch(e) { setError(String(e)); }
  };

  const openTrashDialog = useCallback((targets: FileEntry[]) => {
    setDeleteTargets(targets);
  }, []);

  const applyTagsToPaths = useCallback(async (
    paths: string[],
    rawTagInput: string,
    mode: 'add' | 'remove',
  ) => {
    const tagNames = rawTagInput
      .split(',')
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
  }, [setExplorerTagsForPaths]);

  const recentLocations = useMemo(() => {
    const candidatePaths = history.slice(0, Math.max(0, historyIdx)).reverse();
    const unique = candidatePaths.filter((path, index, collection) => path && collection.indexOf(path) === index);
    return unique.slice(0, 3);
  }, [history, historyIdx]);
  const pinnedLocations = useMemo(() => {
    return explorerRail.nodes
      .filter((node): node is typeof explorerRail.nodes[number] & { kind: 'bookmark'; path: string; name: string } => node.kind === 'bookmark')
      .map((node) => ({ path: node.path, label: node.name || getPathLeaf(node.path) }))
      .slice(0, 3);
  }, [explorerRail.nodes]);
  const currentFolderSizeSummary = useMemo(() => {
    const visibleSizes = visibleEntries
      .map((entry) => entrySizes[entry.path])
      .filter((value): value is EntryStorageInfo => Boolean(value));
    if (visibleSizes.length === 0) {
      return null;
    }
    const totalBytes = visibleSizes.reduce((sum, value) => sum + value.bytes, 0);
    const fileCount = visibleSizes.filter((value) => !value.is_dir).length;
    const folderCount = visibleSizes.length - fileCount;
    return { totalBytes, fileCount, folderCount };
  }, [entrySizes, visibleEntries]);

  const batchRenamePreview = useMemo(() => {
    const renameTargets = (selectedEntries.length > 0 ? selectedEntries : visibleEntries)
      .filter((entry) => !entry.is_dir);
    return renameTargets.map((entry, index) => {
      const extensionMatch = entry.name.match(/(\.[^.]+)$/);
      const extension = extensionMatch?.[1] ?? '';
      const stem = extension ? entry.name.slice(0, -extension.length) : entry.name;
      const replacedStem = batchRename.findText
        ? stem.split(batchRename.findText).join(batchRename.replaceText)
        : stem;
      const numbering = String(batchRename.startingNumber + index).padStart(
        Math.max(1, batchRename.padding),
        '0',
      );
      const nextName = `${batchRename.prefix}${replacedStem}${batchRename.suffix}${numbering}${extension}`;
      const separator = entry.path.includes('\\') ? '\\' : '/';
      const parentPath = entry.path.replace(/[/\\][^/\\]+$/, '');
      return {
        entry,
        nextName,
        destinationPath: `${parentPath}${separator}${nextName}`,
      };
    });
  }, [batchRename, selectedEntries, visibleEntries]);

  const commitBatchRename = useCallback(async () => {
    const items = batchRenamePreview
      .filter(({ entry, destinationPath }) => entry.path !== destinationPath)
      .map(({ entry, destinationPath }): ExplorerBatchRenameItem => ({
        sourcePath: entry.path,
        destinationPath,
      }));
    if (items.length === 0) {
      setBatchRename((current) => ({ ...current, visible: false }));
      return;
    }
    try {
      await batchRenameExplorerPaths(items);
      invalidateExplorerResultCaches();
      setBatchRename((current) => ({ ...current, visible: false }));
      refresh();
    } catch (renameError) {
      setError(String(renameError));
    }
  }, [batchRenameExplorerPaths, batchRenamePreview, refresh]);

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
        const next = [record, ...current.filter((candidate) => candidate.id !== record.id)];
        return next.sort((left, right) => right.updatedAt - left.updatedAt);
      });
      setSaveSearchState({ visible: false, name: '' });
    } catch (saveError) {
      setError(String(saveError));
    }
  }, [activeTagFilterIds, currentPath, saveExplorerSavedSearch, saveSearchState.name, search, searchIncludeContent]);

  const applySavedSearch = useCallback(async (savedSearch: ExplorerSavedSearch) => {
    if (savedSearch.rootPath !== currentPath) {
      await navigate(savedSearch.rootPath);
    }
    setSearch(savedSearch.query);
    setSearchIncludeContent(savedSearch.includeContent);
    setActiveTagFilterIds(savedSearch.tagFilterIds);
  }, [currentPath, navigate]);

  const startDuplicateFinder = useCallback(async () => {
    if (!currentPath || currentPathIsCloud) {
      return;
    }
    setDuplicateFinder({ visible: true, scanId: null, status: null, loading: true });
    try {
      const response = await startExplorerDuplicateScan(currentPath);
      setDuplicateFinder({ visible: true, scanId: response.scanId, status: null, loading: true });
    } catch (scanError) {
      setError(String(scanError));
      setDuplicateFinder({ visible: false, scanId: null, status: null, loading: false });
    }
  }, [currentPath, currentPathIsCloud, startExplorerDuplicateScan]);

  useEffect(() => {
    if (!duplicateFinder.visible || !duplicateFinder.scanId) {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await pollExplorerDuplicateScan(duplicateFinder.scanId ?? '');
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
  }, [duplicateFinder.scanId, duplicateFinder.visible, pollExplorerDuplicateScan]);

  const confirmTrash = async () => {
    if (deleteTargets.length === 0) return;
    try {
      await trashExplorerPaths(deleteTargets.map((entry) => entry.path));
      invalidateExplorerResultCaches();
      if (deleteTargets.some((entry) => preview.path === entry.path)) {
        setPreview({ type: 'none', path: '' });
        setPreviewLoading(false);
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

  const revealPathLabel = runtimePlatform === 'macos'
    ? 'Reveal in Finder'
    : runtimePlatform === 'linux'
      ? 'Show in File Manager'
      : 'Reveal in Explorer';
  const propertiesLabel = runtimePlatform === 'macos' ? 'Get Info' : 'Properties';
  const supportsNativeOpenWith = runtimePlatform !== 'linux';
  const supportsNativeProperties = runtimePlatform !== 'linux';
  const resolvedPluginContextMenuItems = useMemo(
    () => normalizePluginContextMenuContributions([
      ...pluginContextMenuItems,
      ...createLegacyExplorerActionContextMenuContributions(pluginActions),
    ]),
    [pluginActions, pluginContextMenuItems],
  );
  const finalizeContextMenuItems = useCallback((items: CtxItem[]): CtxItem[] => {
    const visibleItems = items.filter(item => isExplorerContextMenuItemEnabled(
      item.id,
      explorerSettings.contextMenuItemOverrides,
    ));
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
          label: '',
          icon: null,
          divider: true,
          action: () => undefined,
        });
      }
      finalizedItems.push(item);
    });

    return finalizedItems;
  }, [explorerSettings.contextMenuItemOverrides]);
  const executePluginContextMenuItem = useCallback(async (
    contribution: ReturnType<typeof normalizePluginContextMenuContributions>[number],
    context: {
      path: string;
      name: string;
      parent: string;
      extension: string;
      stem: string;
      isDirectory: boolean;
    },
  ) => {
    if (contribution.execution.kind === 'plugin-backend') {
      const resolvedArgs = contribution.execution.args.map(argument => resolvePluginCommandTemplate(argument, {
        ...context,
        pluginId: contribution.pluginId,
        pluginName: contribution.pluginName,
      }));
      const result = await commands
        .pluginRunBackend(
          pluginSystemConfig.pluginsDirectory,
          contribution.pluginId,
          contribution.execution.entry,
          resolvedArgs,
        )
        .then(unwrapTauriResult);
      if (result.status !== 0) {
        throw new Error(result.stderr.trim() || `Plugin backend exited with status ${result.status}`);
      }
      return;
    }

    if (contribution.execution.kind === 'panel-request') {
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
      requestPluginPanelOpen(contribution.execution.panelId, resolvedPayload, {
        source: 'plugin-context-menu',
      });
      return;
    }

    const resolvedCommand = resolvePluginCommandTemplate(contribution.execution.command, {
      ...context,
      pluginId: contribution.pluginId,
      pluginName: contribution.pluginName,
    });
    dispatchTerminalCommand(resolvedCommand, contribution.execution.runOnSelect);
  }, []);

  // ── Context menu builder ──
  const buildCtxItems = useCallback((entry: FileEntry): CtxItem[] => {
    const isBookmarked = bookmarkPathSet.has(entry.path);
    const parentPath = entry.path.replace(/[/\\\\][^/\\\\]+$/, '');
    const stem = entry.name.replace(/\.[^.]+$/, '');
    const canUseNativeIntegration = supportsNativeIntegration(entry.path);
    const builtInItems = BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.flatMap(item => {
      if (!item.contexts.includes('entry')) {
        return [];
      }
      if (item.appliesTo === 'directory' && !entry.is_dir) {
        return [];
      }
      if (item.appliesTo === 'file' && entry.is_dir) {
        return [];
      }

      const sharedItem = {
        id: item.id,
        group: item.group,
        defaultOrder: item.defaultOrder,
        icon: resolveContextMenuIcon(item.iconName),
      };

      switch (item.execution.actionId) {
        case 'open':
          return [{ ...sharedItem, label: 'Open', action: () => openEntry(entry) }];
        case 'open-with':
          return supportsNativeOpenWith && canUseNativeIntegration
            ? [{ ...sharedItem, label: 'Open With...', action: () => openWithSystemPicker(entry.path) }]
            : [];
        case 'open-admin':
          return canUseNativeIntegration
            ? [{
              ...sharedItem,
              label: entry.is_dir ? 'Open Folder as Admin' : 'Open as Admin',
              action: () => openAsAdmin(entry.path),
            }]
            : [];
        case 'open-terminal':
          return entry.is_dir && !isCloudExplorerPath(entry.path)
            ? [{ ...sharedItem, label: 'Open in Terminal', action: () => onOpenInTerminal(entry.path) }]
            : [];
        case 'open-aquarium':
          return !isCloudExplorerPath(entry.path) && (entry.is_dir || parentPath)
            ? [{
              ...sharedItem,
              label: entry.is_dir ? 'Open Habitat in Filesystem Aquarium' : 'Open Parent Habitat in Filesystem Aquarium',
              action: () => onOpenInFilesystemAquarium(entry.is_dir ? entry.path : parentPath),
            }]
            : [];
        case 'reveal':
          return canUseNativeIntegration
            ? [{ ...sharedItem, label: revealPathLabel, action: () => revealExplorerPath(entry.path).catch(e => setError(String(e))) }]
            : [];
        case 'properties':
          return supportsNativeProperties && canUseNativeIntegration
            ? [{ ...sharedItem, label: propertiesLabel, action: () => showNativeProperties(entry.path) }]
            : [];
        case 'copy-path':
          return [{ ...sharedItem, label: 'Copy Path', action: () => copyToSysClipboard(entry.path) }];
        case 'copy':
          return [{ ...sharedItem, label: 'Copy', action: () => queueClipboard('copy', entry) }];
        case 'cut':
          return [{ ...sharedItem, label: 'Cut', action: () => queueClipboard('cut', entry) }];
        case 'duplicate':
          return [{ ...sharedItem, label: 'Duplicate', action: () => duplicate(entry) }];
        case 'rename':
          return [{ ...sharedItem, label: 'Rename (F2)', action: () => setRename({ active: true, path: entry.path, name: entry.name }) }];
        case 'add-tags':
          return [{
            ...sharedItem,
            label: 'Add Tags...',
            action: () => {
              const input = window.prompt('Add tags (comma-separated):', '');
              if (input) {
                void applyTagsToPaths([entry.path], input, 'add');
              }
            },
          }];
        case 'remove-tags':
          return [{
            ...sharedItem,
            label: 'Remove Tags...',
            action: () => {
              const input = window.prompt('Remove tags (comma-separated):', '');
              if (input) {
                void applyTagsToPaths([entry.path], input, 'remove');
              }
            },
          }];
        case 'bookmark-toggle':
          return [{
            ...sharedItem,
            icon: isBookmarked ? <StarOff size={13} /> : <Star size={13} />,
            label: isBookmarked ? 'Remove Bookmark' : 'Add to Bookmarks',
            action: () => {
              if (isBookmarked) {
                updateExplorerRail(removeExplorerBookmarksByPath(explorerRail, entry.path));
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
          }];
        case 'move-trash':
          return [{
            ...sharedItem,
            label: 'Move to Trash',
            danger: true,
            action: () => openTrashDialog([entry]),
          }];
        default:
          return [];
      }
    });
    const pluginItems = resolvedPluginContextMenuItems
      .filter(item => item.contexts.includes('entry'))
      .filter(item => (
        item.appliesTo === 'any'
        || (item.appliesTo === 'directory' && entry.is_dir)
        || (item.appliesTo === 'file' && !entry.is_dir)
      ))
      .map(item => ({
        id: item.id,
        group: item.group,
        defaultOrder: item.defaultOrder,
        label: item.title,
        icon: resolveContextMenuIcon(item.iconName),
        action: () => executePluginContextMenuItem(item, {
          path: entry.path,
          name: entry.name,
          parent: parentPath,
          extension: entry.extension,
          stem,
          isDirectory: entry.is_dir,
        }).catch(error => setError(String(error))),
      }));

    return finalizeContextMenuItems([
      ...builtInItems,
      ...pluginItems,
    ]);
  }, [applyTagsToPaths, bookmarkPathSet, copyToSysClipboard, duplicate, executePluginContextMenuItem, explorerRail, explorerSettings.contextMenuItemOverrides, finalizeContextMenuItems, handleBookmarkCreated, isCloudExplorerPath, onOpenInFilesystemAquarium, onOpenInTerminal, openAsAdmin, openEntry, openTrashDialog, openWithSystemPicker, propertiesLabel, queueClipboard, resolvedPluginContextMenuItems, revealExplorerPath, revealPathLabel, showNativeProperties, supportsNativeIntegration, supportsNativeOpenWith, supportsNativeProperties, updateExplorerRail]);

  const buildEmptyCtxItems = useCallback((): CtxItem[] => {
    const canUseNativeIntegration = supportsNativeIntegration(currentPath);
    const pathSegments = currentPath.split(/[/\\]/).filter(Boolean);
    const pathName = pathSegments[pathSegments.length - 1] ?? currentPath;
    const pathParent = currentPath.replace(/[/\\][^/\\]+$/, '');
    const builtInItems = BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.flatMap(item => {
      if (!item.contexts.includes('background')) {
        return [];
      }

      const sharedItem = {
        id: item.id,
        group: item.group,
        defaultOrder: item.defaultOrder,
        icon: resolveContextMenuIcon(item.iconName),
      };

      switch (item.execution.actionId) {
        case 'new-folder':
          return [{ ...sharedItem, label: 'New Folder', action: () => openNew('folder') }];
        case 'new-file':
          return [{ ...sharedItem, label: 'New File...', action: () => openNew('file') }];
        case 'paste':
          return clipboard ? [{ ...sharedItem, label: 'Paste', action: () => paste() }] : [];
        case 'open-aquarium':
          return !isCloudExplorerPath(currentPath)
            ? [{ ...sharedItem, label: 'Open Habitat in Filesystem Aquarium', action: () => onOpenInFilesystemAquarium(currentPath) }]
            : [];
        case 'open-admin':
          return canUseNativeIntegration
            ? [{ ...sharedItem, label: 'Open Folder as Admin', action: () => openAsAdmin(currentPath) }]
            : [];
        case 'reveal':
          return canUseNativeIntegration
            ? [{ ...sharedItem, label: revealPathLabel, action: () => revealExplorerPath(currentPath).catch(e => setError(String(e))) }]
            : [];
        case 'open-with':
          return supportsNativeOpenWith && canUseNativeIntegration
            ? [{ ...sharedItem, label: 'Open With...', action: () => openWithSystemPicker(currentPath) }]
            : [];
        case 'properties':
          return supportsNativeProperties && canUseNativeIntegration
            ? [{ ...sharedItem, label: propertiesLabel, action: () => showNativeProperties(currentPath) }]
            : [];
        case 'refresh':
          return [{ ...sharedItem, label: 'Refresh', action: () => refresh() }];
        default:
          return [];
      }
    });
    const pluginItems = resolvedPluginContextMenuItems
      .filter(item => item.contexts.includes('background'))
      .map(item => ({
        id: item.id,
        group: item.group,
        defaultOrder: item.defaultOrder,
        label: item.title,
        icon: resolveContextMenuIcon(item.iconName),
        action: () => executePluginContextMenuItem(item, {
          path: currentPath,
          name: pathName,
          parent: pathParent,
          extension: '',
          stem: pathName,
          isDirectory: true,
        }).catch(error => setError(String(error))),
      }));

    return finalizeContextMenuItems([
      ...builtInItems,
      ...pluginItems,
    ]);
  }, [clipboard, currentPath, executePluginContextMenuItem, finalizeContextMenuItems, isCloudExplorerPath, onOpenInFilesystemAquarium, openAsAdmin, openWithSystemPicker, paste, propertiesLabel, refresh, resolvedPluginContextMenuItems, revealExplorerPath, revealPathLabel, showNativeProperties, supportsNativeIntegration, supportsNativeOpenWith, supportsNativeProperties]);

  // ── Right-click ──
  const onRightClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault(); e.stopPropagation();
    // Don't lose multi-selection if right-clicking already-selected item
    if (!selected.has(entry.path)) setSelected(new Set([entry.path]));
    setCtxMenu({ visible:true, x:e.clientX, y:e.clientY, entry });
  };

  // ── Click with shift-select support ──
  const onEntryClick = (e: React.MouseEvent, entry: FileEntry) => {
    e.stopPropagation();
    mainRef.current?.focus();
    if (repositoryPicker?.active && !repositoryPicker.allowMultiple) {
      setSelected(new Set([entry.path]));
      lastSelected.current = entry.path;
      return;
    }
    const plainClick = !e.shiftKey && !e.ctrlKey && !e.metaKey;
    if (e.shiftKey && lastSelected.current) {
      const idx1 = visibleEntries.findIndex(f => f.path === lastSelected.current);
      const idx2 = visibleEntries.findIndex(f => f.path === entry.path);
      if (idx1 >= 0 && idx2 >= 0) {
        const [lo, hi] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        setSelected(new Set(visibleEntries.slice(lo, hi + 1).map(f => f.path)));
      } else {
        setSelected(new Set([entry.path]));
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
        return next;
      });
    } else {
      setSelected(new Set([entry.path]));
    }
    lastSelected.current = entry.path;
    if (repositoryPicker?.active) {
      return;
    }
    if (shouldOpenExplorerEntryOnTrigger({
      isDirectory: entry.is_dir,
      trigger: 'click',
      plainClick,
      folderClickMode,
    })) {
      void openEntry(entry);
      return;
    }
    if (previewEnabled && !isCompactDock && plainClick && !entry.is_dir) {
      void previewEntry(entry, getSearchFocusTarget(entry));
    }
  };

  const onEntryDoubleClick = useCallback((entry: FileEntry) => {
    if (repositoryPicker?.active) {
      if (entry.is_dir) {
        void openEntry(entry);
      }
      return;
    }

    if (!shouldOpenExplorerEntryOnTrigger({
      isDirectory: entry.is_dir,
      trigger: 'double-click',
      plainClick: true,
      folderClickMode,
    })) {
      return;
    }

    void openEntry(entry);
  }, [folderClickMode, openEntry, repositoryPicker?.active]);

  // ── Keyboard ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (rename.active || newItem.visible || addressEditing) return;
      if (isEditableKeyboardTarget(e.target)) return;

      const isExplorerFocus = document.activeElement === mainRef.current;
      const selectedEntry = visibleEntries.find(en => selected.has(en.path)) ?? null;
      const currentFocusIndex = (() => {
        const selectedIndex = visibleEntries.findIndex(entry => selected.has(entry.path));
        if (selectedIndex >= 0) return selectedIndex;
        if (lastSelected.current) {
          const rememberedIndex = visibleEntries.findIndex(entry => entry.path === lastSelected.current);
          if (rememberedIndex >= 0) return rememberedIndex;
        }
        return 0;
      })();

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
      if (matchesKeybinding(e, keybindings.goBackDirectory) && isExplorerFocus) {
        e.preventDefault();
        goBack();
        return;
      }
      if (matchesKeybinding(e, keybindings.goForwardDirectory) && isExplorerFocus) {
        e.preventDefault();
        goForward();
        return;
      }
      if (matchesKeybinding(e, keybindings.goHomeDirectory) && isExplorerFocus) {
        e.preventDefault();
        goHome();
        return;
      }
      if (matchesKeybinding(e, keybindings.renameItem) && selected.size === 1) {
        e.preventDefault();
        if (selectedEntry) {
          setRename({ active: true, path: selectedEntry.path, name: selectedEntry.name });
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
        openNew('folder');
        return;
      }
      if (matchesKeybinding(e, keybindings.newFile)) {
        e.preventDefault();
        openNew('file');
        return;
      }
      if (matchesKeybinding(e, keybindings.duplicateItem) && selected.size > 0 && selectedEntry) {
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
      if (matchesKeybinding(e, keybindings.openInTerminal) && selectedEntry?.is_dir) {
        e.preventDefault();
        onOpenInTerminal(selectedEntry.path);
        return;
      }
      if (matchesKeybinding(e, keybindings.revealInExplorer) && selectedEntry) {
        e.preventDefault();
        void revealExplorerPath(selectedEntry.path).catch(error => setError(String(error)));
        return;
      }
      if (matchesKeybinding(e, keybindings.openAsAdmin) && selectedEntry) {
        e.preventDefault();
        void openAsAdmin(selectedEntry.path);
        return;
      }
      if (isExplorerFocus && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const nextIndex = e.key === 'ArrowDown' ? currentFocusIndex + 1 : currentFocusIndex - 1;
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
          !isCompactDock
          && !isSearchActive
          && (experimentalViewMode !== 'off' || explorerTheme.preferredExperimentalViewMode != null)
        ) {
          const nextDensity = stepAdaptiveSemanticDensity(experimentalDensity, 'larger');
          if (nextDensity !== experimentalDensity) {
            updateExplorerSettings({ experimentalDensity: nextDensity });
            showExperimentalHud();
          }
          return;
        }
        const nextMode = stepExplorerViewMode(viewMode, 'larger');
        if (nextMode !== viewMode) {
          updateExplorerSettings({ viewMode: nextMode });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        beginAddressEdit();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        beginAddressEdit();
        return;
      }
      if (e.key === 'Escape') { setClipboard(null); setNewItem({ visible:false, kind:'folder' }); }
      if (matchesKeybinding(e, keybindings.copyPath)) {
        e.preventDefault();
        if (selectedEntries.length > 0) {
          void copyToSysClipboard(selectedEntries.map(entry => entry.path).join('\n'));
        }
        return;
      }
      if (matchesKeybinding(e, keybindings.copySelection)) {
        e.preventDefault();
        queueClipboard('copy');
        return;
      }
      if (matchesKeybinding(e, keybindings.cutSelection)) {
        e.preventDefault();
        queueClipboard('cut');
        return;
      }
      if (matchesKeybinding(e, keybindings.pasteSelection)) {
        e.preventDefault();
        void paste();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [addressEditing, beginAddressEdit, clearExplorerSelection, duplicate, experimentalDensity, experimentalViewMode, explorerTheme.preferredExperimentalViewMode, focusExplorerAddressBar, focusExplorerList, focusExplorerPreview, goBack, goForward, goHome, isCompactDock, isSearchActive, keybindings, newItem.visible, paste, queueClipboard, refresh, rename.active, selectAllVisibleEntries, selected, selectedEntries, showExperimentalHud, showHidden, updateExplorerSettings, viewMode, visibleEntries, toggleSearchScope, cycleSortKey, toggleSortOrder]);

  // ── Breadcrumbs ──
  const crumbs: { label:string; path:string }[] = locationBreadcrumbs;
  const locationTitle = crumbs.length > 0
    ? crumbs.map((crumb) => crumb.label).join(' / ')
    : (currentPath || 'Home');
  const locationLabel = crumbs[crumbs.length - 1]?.label
    ?? (() => {
      if (!currentPathIsCloud) {
        return currentPath || 'Home';
      }
      const cloudSegments = currentPath.split('/').filter(Boolean);
      return cloudSegments[cloudSegments.length - 1] ?? 'Cloud';
    })();

  // ── Inline new item creation ──
  const openNew = (kind: 'file' | 'folder') => {
    setNewItemName(kind === 'folder' ? 'New Folder' : 'untitled.txt');
    setNewItem({ visible:true, kind });
  };

  const commitNew = async () => {
    const name = newItemName.trim();
    if (!name) { setNewItem({ visible:false, kind:'folder' }); return; }
    const base = currentPath.replace(/[/\\]+$/, '');
    try {
      if (newItem.kind === 'folder') {
        if (currentPathIsCloud) {
          await createExplorerDir(`${base}/${name}`);
        } else {
          await createExplorerDir(joinPlatformPath(base, name, runtimePlatform));
        }
      } else {
        await createExplorerFile(currentPath, name, '');
      }
      invalidateExplorerResultCaches();
      refresh();
    } catch(e) { setError(String(e)); }
    finally { setNewItem({ visible:false, kind:'folder' }); }
  };

  // ── Drag and Drop ──
  const onDragStart = (e: React.DragEvent<HTMLElement>, entry: FileEntry) => {
    const dragEntries = resolveEntriesForAction(entry);
    const dragPaths = dragEntries.map(item => item.path);
    const requestedDragIntent = resolveExplorerDragIntent(e);
    const dragIntent = requestedDragIntent === 'native-out' && !supportsNativeDragOut(dragPaths)
      ? 'internal'
      : requestedDragIntent;
    activeDragPathsRef.current = dragPaths;
    e.currentTarget.dataset.overlayDragIntent = dragIntent;
    e.dataTransfer.setData('text/plain', dragPaths[0] ?? entry.path);
    e.dataTransfer.setData('application/x-overlayterm-paths', JSON.stringify(dragPaths));
    e.dataTransfer.setData('application/x-overlayterm-drag-intent', dragIntent);
    if (dragIntent === 'native-out') {
      const toFileUri = (value: string) => {
        const normalized = value.replace(/\\/g, '/');
        return normalized.startsWith('/')
          ? `file://${encodeURI(normalized)}`
          : `file:///${encodeURI(normalized)}`;
      };
      const uriList = dragPaths.map(toFileUri).join('\r\n');
      e.dataTransfer.setData('text/uri-list', uriList);
      if (isTauri() && dragPaths.length > 0) {
        if (runtimePlatform === 'windows' && isProcessElevatedRef.current) {
          setError('GreebleFS is running as Administrator, so Windows may block dragging files into normal Explorer/Desktop windows. Run GreebleFS without elevation for drag-out support.');
        }
        void commands.fsStartNativeFileDrag(dragPaths)
          .then(result => {
            unwrapTauriResult(result);
          })
          .catch(error => {
            const fallback = formatExplorerNativeDragError(error);
            if (runtimePlatform === 'windows' && isProcessElevatedRef.current) {
              setError('GreebleFS is running as Administrator, so Windows blocked native drag into a non-elevated target. Run GreebleFS without elevation for drag-out support.');
              return;
            }
            setError(fallback);
          });
      }
    }
    if (requestedDragIntent === 'native-out' && dragIntent === 'internal') {
      setError('Native drag-out is only available for local filesystem items. Cloud files still drag inside the explorer.');
    }
    e.dataTransfer.effectAllowed = dragIntent === 'native-out' ? 'copy' : 'copyMove';
  };

  const onDragEnd = (e: React.DragEvent<HTMLElement>) => {
    delete e.currentTarget.dataset.overlayDragIntent;
    activeDragPathsRef.current = [];
    setDragOver(null);
  };

  const onDragOver = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = resolveExplorerDropOperation(e, runtimePlatform);
    setDragOver(targetPath);
  };

  const onDrop = async (e: React.DragEvent, targetDir: string) => {
    e.preventDefault();
    setDragOver(null);
    const payload = e.dataTransfer.getData('application/x-overlayterm-paths');
    let sources: string[] = [];
    if (payload) {
      try {
        sources = JSON.parse(payload) as string[];
      } catch {
        sources = [];
      }
    }
    if (sources.length === 0) {
      sources = [e.dataTransfer.getData('text/plain')].filter(Boolean);
    }
    if (sources.length === 0 && activeDragPathsRef.current.length > 0) {
      sources = [...activeDragPathsRef.current];
    }
    if (sources.length === 0) return;
    try {
      await transferIntoDirectory(targetDir, sources, resolveExplorerDropOperation(e, runtimePlatform));
      activeDragPathsRef.current = [];
      refresh();
    } catch(e) { setError(String(e)); }
  };

  const effectiveModeProfile = useMemo(
    () => resolveEffectiveExplorerModeProfile({
      themeOverrideModeProfileId: explorerSettings.modeProfileOverridesByThemeId[explorerChromeThemeId] ?? null,
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
    () => resolveExplorerModeProfileChromeLayoutId({
      modeProfile: effectiveModeProfile,
      themeChromeLayoutId: explorerTheme.chromeLayoutId,
    }),
    [effectiveModeProfile, explorerTheme.chromeLayoutId],
  );
  const persistedExplorerChromeOverride = useMemo(
    () => explorerSettings.chromeLayoutOverridesByThemeId[explorerChromeThemeId]?.[effectiveChromeLayoutId] ?? null,
    [
      effectiveChromeLayoutId,
      explorerChromeThemeId,
      explorerSettings.chromeLayoutOverridesByThemeId,
    ],
  );
  const explorerChromeOverride = useMemo(
    () => (
      chromeEditSession
      && chromeEditSession.themeId === explorerChromeThemeId
      && chromeEditSession.layoutId === effectiveChromeLayoutId
        ? chromeEditSession.draftOverride
        : persistedExplorerChromeOverride
    ),
    [
      chromeEditSession,
      effectiveChromeLayoutId,
      explorerChromeThemeId,
      persistedExplorerChromeOverride,
    ],
  );
  const handleExplorerChromeControlMove = useCallback((args: {
    controlId: ExplorerChromeControlId;
    targetSurfaceId: ExplorerChromeSurfaceId;
    targetZoneId: ExplorerChromeZoneId;
    targetIndex: number;
  }) => {
    if (!chromeEditSession) {
      return;
    }

    const registeredSurfaces = Object.values(chromeEditSession.registeredSurfaces)
      .filter((surface): surface is NonNullable<typeof surface> => surface != null);
    updateChromeEditDraft(moveExplorerChromeControlInResolvedSurfaces({
      surfaces: registeredSurfaces,
      controlId: args.controlId,
      targetSurfaceId: args.targetSurfaceId,
      targetZoneId: args.targetZoneId,
      targetIndex: args.targetIndex,
    }));
  }, [chromeEditSession, updateChromeEditDraft]);
  const explorerChromeEditMode = useMemo(
    () => (
      chromeEditSession
      && chromeEditSession.themeId === explorerChromeThemeId
      && chromeEditSession.layoutId === effectiveChromeLayoutId
        ? {
          active: true,
          draggingControlId: chromeEditSession.draggingControlId,
          onRegisterSurface: registerChromeEditSurface,
          onUnregisterSurface: unregisterChromeEditSurface,
          onDragStart: setChromeEditDraggingControl,
          onDragEnd: () => setChromeEditDraggingControl(null),
          onMoveControl: handleExplorerChromeControlMove,
        }
        : undefined
    ),
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
      !chromeEditSession
      || chromeEditSession.themeId !== explorerChromeThemeId
      || chromeEditSession.layoutId !== effectiveChromeLayoutId
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
      clearExplorerChromeLayoutOverride(explorerChromeThemeId, effectiveChromeLayoutId);
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
      chromeEditSession
      && (
        chromeEditSession.themeId !== explorerChromeThemeId
        || chromeEditSession.layoutId !== effectiveChromeLayoutId
      )
    ) {
      closeChromeEditSession();
    }
  }, [chromeEditSession, closeChromeEditSession, effectiveChromeLayoutId, explorerChromeThemeId]);
  const effectiveShellLayout = useMemo(
    () => getExplorerShellLayoutDefinition(effectiveModeProfile.paneLayoutId),
    [effectiveModeProfile.paneLayoutId],
  );
  const preferredViewMode = effectiveModeProfile.preferredViewMode ?? explorerTheme.preferredViewMode;
  const preferredExperimentalViewMode = effectiveModeProfile.preferredExperimentalViewMode
    ?? explorerTheme.preferredExperimentalViewMode;
  const themedViewMode = useMemo(
    () => (
      viewMode === 'details' && preferredViewMode
        ? preferredViewMode
        : viewMode
    ),
    [preferredViewMode, viewMode],
  );
  const themedExperimentalViewMode = useMemo(
    () => (
      experimentalViewMode === 'off' && preferredExperimentalViewMode
        ? preferredExperimentalViewMode
        : experimentalViewMode
    ),
    [experimentalViewMode, preferredExperimentalViewMode],
  );
  const selectedViewModeDefinition = useMemo(
    () => getExplorerViewModeDefinition(themedViewMode),
    [themedViewMode],
  );
  const selectedExperimentalModeDefinition = useMemo(
    () => (themedExperimentalViewMode === 'off'
      ? null
      : getExplorerExperimentalModeDefinition(themedExperimentalViewMode)),
    [themedExperimentalViewMode],
  );
  const effectiveViewMode = resolveEffectiveExplorerViewMode(themedViewMode, {
    isCompactDock,
    isSearchActive,
  });
  const effectiveExperimentalViewMode = useMemo(
    () => (
      !isCompactDock
      && !isSearchActive
      && themedExperimentalViewMode !== 'off'
        ? themedExperimentalViewMode
        : 'off'
    ),
    [isCompactDock, isSearchActive, themedExperimentalViewMode],
  );
  const adaptiveDensityStop = useMemo<AdaptiveSemanticDensityStopDefinition | null>(
    () => (themedExperimentalViewMode === 'adaptive-semantic-grid'
      ? applyExplorerThemeToAdaptiveDensityStop(getAdaptiveSemanticDensityStop(experimentalDensity), explorerTheme)
      : null),
    [experimentalDensity, explorerTheme, themedExperimentalViewMode],
  );
  const experimentalDensityDescriptor = useMemo(
    () => (themedExperimentalViewMode === 'off'
      ? null
      : getExplorerExperimentalDensityDescriptor(themedExperimentalViewMode, experimentalDensity)),
    [experimentalDensity, themedExperimentalViewMode],
  );
  const effectiveViewModeDefinition = useMemo(
    () => getExplorerViewModeDefinition(effectiveViewMode),
    [effectiveViewMode],
  );
  const activeGridMetrics = useMemo(
    () => (
      effectiveViewModeDefinition.presentation === 'grid'
        ? applyExplorerThemeToGridMetrics(getExplorerGridMetricsForZoom(gridZoom), explorerTheme)
        : (effectiveViewModeDefinition.grid
            ? applyExplorerThemeToGridMetrics(effectiveViewModeDefinition.grid, explorerTheme)
            : effectiveViewModeDefinition.grid)
    ),
    [effectiveViewModeDefinition, explorerTheme, gridZoom],
  );
  const activeRowMetrics = useMemo(
    () => applyExplorerThemeToRowMetrics(effectiveViewModeDefinition.rows, explorerTheme),
    [effectiveViewModeDefinition.rows, explorerTheme],
  );
  const activeNewItemHeight = effectiveViewModeDefinition.presentation === 'grid'
    ? activeGridMetrics?.newItemHeight ?? EXPLORER_LIST_ROW_HEIGHT
    : activeRowMetrics?.newItemHeight ?? EXPLORER_LIST_ROW_HEIGHT;
  const shouldRenderRail = sourcesVisible && (isCompactDock || effectiveShellLayout.showRail);
  const hasPreview = !isCompactDock && previewEnabled && preview.type !== 'none';
  const previewModeLabel = preview.type === 'text'
    ? (preview.renderKind === 'markdown' ? 'Text preview (markdown)' : 'Text preview')
    : preview.type === 'image'
      ? 'Image preview'
      : preview.type === 'model3d'
        ? '3D preview'
        : 'Preview';
  const searchModeLabel = searchIncludeContent ? 'Recursive search + text' : 'Recursive search (names only)';
  const gridZoomPercent = useMemo(
    () => (isExplorerGridMode(themedViewMode) ? getExplorerGridZoomPercent(gridZoom) : null),
    [gridZoom, themedViewMode],
  );
  const showToolbarLocationStrips = !isCompactDock;

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
    () => (themedExperimentalViewMode !== 'off'
      ? getAdaptiveSemanticDensityPercent(experimentalDensity)
      : null),
    [experimentalDensity, themedExperimentalViewMode],
  );
  const constellationOrbitBands = useMemo(
    () => (effectiveExperimentalViewMode === 'constellation'
      ? buildConstellationOrbitBands(experimentalSemanticBands, selected, experimentalDensity)
      : []),
    [effectiveExperimentalViewMode, experimentalDensity, experimentalSemanticBands, selected],
  );
  const timelineSurfaceBands = useMemo(
    () => (effectiveExperimentalViewMode === 'timeline-surface'
      ? buildTimelineSurfaceBands(
        visibleEntries,
        experimentalDensity,
        explorerSettings.sortBy,
        explorerSettings.sortOrder,
      )
      : []),
    [
      effectiveExperimentalViewMode,
      experimentalDensity,
      explorerSettings.sortBy,
      explorerSettings.sortOrder,
      visibleEntries,
    ],
  );
  const effectiveRailPosition = isCompactDock ? 'left' : explorerTheme.railPosition;
  const idleEntrySurface = useMemo(
    () => getExplorerEntryStateSurface(explorerTheme, 'idle'),
    [explorerTheme],
  );
  const selectedEntrySurface = useMemo(
    () => getExplorerEntryStateSurface(explorerTheme, 'selected'),
    [explorerTheme],
  );
  const dropEntrySurface = useMemo(
    () => getExplorerEntryStateSurface(explorerTheme, 'drop'),
    [explorerTheme],
  );
  const hoverEntrySurface = useMemo(
    () => getExplorerHoverSurface(explorerTheme),
    [explorerTheme],
  );
  const explorerRootStyle = useMemo<CSSProperties>(() => ({
    ...(explorerTheme.cssVars as CSSProperties),
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    background: 'var(--overlay-explorer-root-bg)',
    color: EXP.text,
    fontFamily: uiFont,
    position: 'relative',
    flexDirection: effectiveRailPosition === 'right' ? 'row-reverse' : 'row',
  }), [effectiveRailPosition, explorerTheme.cssVars, uiFont]);
  const sidebarPaneStyle = useMemo<CSSProperties>(() => ({
    borderRight: effectiveRailPosition === 'left'
      ? '1px solid var(--overlay-explorer-sidebar-border)'
      : 'none',
    borderLeft: effectiveRailPosition === 'right'
      ? '1px solid var(--overlay-explorer-sidebar-border)'
      : 'none',
    background: 'var(--overlay-explorer-sidebar-bg)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }), [effectiveRailPosition]);
  const toolbarContainerStyle = useMemo<CSSProperties>(() => {
    const usesFloatingShell = explorerTheme.toolbarStyle === 'floating' || explorerTheme.toolbarStyle === 'glass';
    const usesInset = usesFloatingShell || explorerTheme.toolbarStyle === 'minimal';
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--overlay-explorer-toolbar-gap)',
      padding: 'var(--overlay-explorer-toolbar-padding)',
      background: explorerTheme.toolbarStyle === 'minimal'
        ? 'transparent'
        : 'var(--overlay-explorer-toolbar-bg)',
      borderTopWidth: usesFloatingShell ? 1 : 0,
      borderRightWidth: usesFloatingShell ? 1 : 0,
      borderLeftWidth: usesFloatingShell ? 1 : 0,
      borderBottomWidth: usesFloatingShell || explorerTheme.toolbarStyle === 'minimal' ? 0 : 1,
      borderStyle: usesFloatingShell || explorerTheme.toolbarStyle !== 'minimal' ? 'solid' : 'none',
      borderColor: 'var(--overlay-explorer-toolbar-border)',
      borderRadius: usesFloatingShell ? 'var(--overlay-explorer-panel-radius)' : 0,
      margin: usesInset ? 'var(--overlay-explorer-chrome-inset)' : 0,
      marginBottom: 0,
      boxShadow: usesFloatingShell ? 'var(--overlay-explorer-toolbar-shadow)' : 'none',
      backdropFilter: explorerBlurEnabled && (explorerTheme.toolbarStyle === 'glass' || explorerTheme.toolbarStyle === 'floating')
        ? 'blur(18px)'
        : 'none',
      WebkitBackdropFilter: explorerBlurEnabled && (explorerTheme.toolbarStyle === 'glass' || explorerTheme.toolbarStyle === 'floating')
        ? 'blur(18px)'
        : 'none',
      flexShrink: 0,
    };
  }, [explorerBlurEnabled, explorerTheme.toolbarStyle]);
  const toolbarPrimaryRowStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--overlay-explorer-toolbar-gap)',
    flexWrap: 'wrap',
    minWidth: 0,
  }), []);
  const toolbarPrimaryControlsStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
    minWidth: 0,
  }), []);
  const toolbarSecondaryRowStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    minWidth: 0,
  }), []);
  const toolbarSecondaryLocationGroupStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
    minWidth: 0,
  }), []);
  const toolbarSecondaryActionGroupStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    minWidth: 0,
  }), []);
  const mainColumnStyle = useMemo<CSSProperties>(() => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--overlay-explorer-content-bg)',
  }), []);
  const fileAreaStyle = useMemo<CSSProperties>(() => ({
    flex: 1,
    display: 'flex',
    flexDirection: effectiveShellLayout.previewPlacement === 'leading' ? 'row-reverse' : 'row',
    overflow: 'hidden',
    background: 'var(--overlay-explorer-content-bg)',
  }), [effectiveShellLayout.previewPlacement]);
  const batchRenameTargetCount = useMemo(
    () => (selectedEntries.length > 0 ? selectedEntries : visibleEntries).filter((entry) => !entry.is_dir).length,
    [selectedEntries, visibleEntries],
  );
  const isGlobalChromeSurfaceActive = useCallback((surfaceId: ExplorerChromeSurfaceId) => (
    !isCompactDock
    && (
      (surfaceId === 'explorerTopbar' && showsGlobalChromeControls)
      || (surfaceId === 'explorerToolbar' && !showsGlobalChromeControls)
    )
  ), [isCompactDock, showsGlobalChromeControls]);
  const getExplorerChromeRowStyle = useCallback((rowId: string): CSSProperties => {
    switch (rowId) {
      case 'primary':
        return toolbarPrimaryRowStyle;
      case 'secondary':
        return toolbarSecondaryRowStyle;
      default:
        return toolbarPrimaryRowStyle;
    }
  }, [toolbarPrimaryRowStyle, toolbarSecondaryRowStyle]);
  const getExplorerChromeZoneStyle = useCallback((zoneId: ExplorerChromeZoneId): CSSProperties => {
    switch (zoneId) {
      case 'primaryStart':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          minWidth: 0,
        };
      case 'primaryCenter':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          flex: 1,
        };
      case 'primaryEnd':
        return toolbarPrimaryControlsStyle;
      case 'secondaryStart':
        return toolbarSecondaryLocationGroupStyle;
      case 'secondaryEnd':
        return toolbarSecondaryActionGroupStyle;
      case 'center':
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          flex: 1,
        };
      case 'end':
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          flexWrap: 'wrap',
          minWidth: 0,
        };
      case 'start':
      default:
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          minWidth: 0,
        };
    }
  }, [
    toolbarPrimaryControlsStyle,
    toolbarSecondaryActionGroupStyle,
    toolbarSecondaryLocationGroupStyle,
  ]);
  const renderToolbarNavigationButton = useCallback((input: {
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
          event.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)';
          event.currentTarget.style.color = EXP.text;
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
        event.currentTarget.style.color = input.disabled ? EXP.muted2 : EXP.muted;
      }}
    >
      {input.icon}
    </button>
  ), []);
  const explorerChromeControlRegistry = useMemo<Array<ExplorerChromeControlDefinition & {
    isVisible: (surfaceId: ExplorerChromeSurfaceId) => boolean;
    render: (placement: ExplorerChromeResolvedControlPlacement) => React.ReactNode;
  }>>(() => [
    {
      id: 'navigateBack',
      label: 'Back',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => renderToolbarNavigationButton({
        action: goBack,
        disabled: historyIdx <= 0,
        icon: <ChevronLeft size={14} />,
        title: 'Back',
      }),
    },
    {
      id: 'navigateForward',
      label: 'Forward',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => renderToolbarNavigationButton({
        action: goForward,
        disabled: historyIdx >= history.length - 1,
        icon: <ChevronRight size={14} />,
        title: 'Forward',
      }),
    },
    {
      id: 'navigateUp',
      label: 'Up',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => renderToolbarNavigationButton({
        action: goUp,
        disabled: false,
        icon: <ArrowUp size={14} />,
        title: 'Up',
      }),
    },
    {
      id: 'addressBar',
      label: 'Address Bar',
      surfaces: ['explorerToolbar'],
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
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--overlay-explorer-omnibox-bg)',
            borderRadius: 'var(--overlay-explorer-control-radius)',
            border: '1px solid var(--overlay-explorer-omnibox-border)',
            padding: '3px 10px',
            overflow: 'hidden',
            cursor: addressEditing ? 'text' : 'pointer',
            minWidth: 0,
          }}
        >
          {addressEditing ? (
            <input
              ref={addressInputRef}
              value={addressDraft}
              onChange={e => setAddressDraft(e.target.value)}
              onBlur={() => { void submitAddressDraft(addressDraft); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitAddressDraft(addressDraft);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setAddressEditing(false);
                  setAddressDraft(search.trim() ? search : currentPath);
                }
              }}
              placeholder="Search or enter path…"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: EXP.text,
                fontSize: 'var(--overlay-explorer-breadcrumb-font-size)',
                minWidth: 0,
              }}
            />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                {crumbs.length > 0 ? (
                  crumbs.map((c, i) => (
                    <React.Fragment key={c.path}>
                      {i > 0 && <ChevronRight size={10} style={{ color: EXP.muted2, flexShrink: 0 }} />}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          navigate(c.path);
                        }}
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          color: i === crumbs.length - 1 ? EXP.text : EXP.muted,
                          fontSize: 'var(--overlay-explorer-breadcrumb-font-size)',
                          fontWeight: i === crumbs.length - 1 ? 600 : 400,
                          padding: explorerTheme.breadcrumbStyle === 'plain' ? '0 2px' : '3px 8px',
                          borderRadius: explorerTheme.breadcrumbStyle === 'plain'
                            ? 4
                            : 'var(--overlay-explorer-control-radius)',
                          background: explorerTheme.breadcrumbStyle === 'plain'
                            ? 'transparent'
                            : (i === crumbs.length - 1
                                ? 'var(--overlay-explorer-chip-active-bg)'
                                : 'var(--overlay-explorer-chip-bg)'),
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {c.label}
                      </button>
                    </React.Fragment>
                  ))
                ) : (
                  <span style={{ fontSize: 'var(--overlay-explorer-breadcrumb-font-size)', color: EXP.muted, whiteSpace: 'nowrap' }}>Search or enter a path</span>
                )}
              </div>
              {isSearchActive && (
                <>
                  <div style={{ width: 1, height: 14, background: EXP.border, flexShrink: 0 }} />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      maxWidth: isCompactDock ? 140 : 260,
                      padding: '2px 8px',
                      borderRadius: 'var(--overlay-explorer-control-radius)',
                      border: '1px solid var(--overlay-explorer-chip-border)',
                      background: 'var(--overlay-explorer-chip-active-bg)',
                      color: EXP.text,
                      fontSize: 10,
                      flexShrink: 0,
                      minWidth: 0,
                    }}
                  >
                    {searchLoading && <Loader size={10} style={{ color: EXP.muted2, animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
                    <Search size={10} style={{ color: EXP.muted2, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {search.trim()}
                    </span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        clearSearch();
                      }}
                      title="Clear search"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: EXP.muted2, padding: 0, display: 'flex', flexShrink: 0 }}
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
      id: 'recentLocations',
      label: 'Recent Locations',
      surfaces: ['explorerToolbar'],
      isVisible: () => showToolbarLocationStrips && recentLocations.length > 0,
      render: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 0, maxWidth: isCompactDock ? 220 : 320, overflow: 'hidden' }} title="Recent locations">
          <span style={{ fontSize: 10, color: EXP.muted2, fontWeight: 700, flexShrink: 0 }}>Recent</span>
          {recentLocations.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              style={{
                border: '1px solid var(--overlay-explorer-chip-border)',
                background: 'var(--overlay-explorer-chip-bg)',
                color: EXP.muted,
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 10,
                cursor: 'pointer',
                maxWidth: 96,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
      id: 'pinnedLocations',
      label: 'Pinned Locations',
      surfaces: ['explorerToolbar'],
      isVisible: () => showToolbarLocationStrips && pinnedLocations.length > 0,
      render: () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 0, maxWidth: isCompactDock ? 220 : 320, overflow: 'hidden' }} title="Pinned locations">
          <span style={{ fontSize: 10, color: EXP.muted2, fontWeight: 700, flexShrink: 0 }}>Pinned</span>
          {pinnedLocations.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              style={{
                border: '1px solid var(--overlay-explorer-chip-border)',
                background: 'var(--overlay-explorer-chip-active-bg)',
                color: EXP.text,
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 10,
                cursor: 'pointer',
                maxWidth: 96,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
      id: 'folderSizeSummary',
      label: 'Folder Size Summary',
      surfaces: ['explorerToolbar'],
      isVisible: () => showToolbarLocationStrips && Boolean(currentFolderSizeSummary),
      render: () => currentFolderSizeSummary ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 0, maxWidth: isCompactDock ? 210 : 280, overflow: 'hidden' }} title="Visible folder size summary">
          <span style={{ fontSize: 10, color: EXP.muted2, fontWeight: 700, flexShrink: 0 }}>Size</span>
          <span style={{ fontSize: 10, color: EXP.text, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {formatSize(currentFolderSizeSummary.totalBytes)}
          </span>
          <span style={{ fontSize: 10, color: EXP.muted2, whiteSpace: 'nowrap' }}>
            {currentFolderSizeSummary.fileCount} files · {currentFolderSizeSummary.folderCount} folders
          </span>
        </div>
      ) : null,
    },
    {
      id: 'selectionSizeSummary',
      label: 'Selection Size Summary',
      surfaces: ['explorerToolbar'],
      isVisible: () => showToolbarLocationStrips && Boolean(selectedSizeSummary) && selected.size > 0,
      render: () => selectedSizeSummary && selected.size > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 0, maxWidth: isCompactDock ? 180 : 240, overflow: 'hidden' }} title="Selected item size summary">
          <span style={{ fontSize: 10, color: EXP.muted2, fontWeight: 700, flexShrink: 0 }}>Selected</span>
          <span style={{ fontSize: 10, color: EXP.text, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {formatSize(selectedSizeSummary.totalBytes)}
          </span>
          <span style={{ fontSize: 10, color: EXP.muted2, whiteSpace: 'nowrap' }}>
            {selectedSizeSummary.count} measured
          </span>
        </div>
      ) : null,
    },
    {
      id: 'pinLocation',
      label: 'Pin Location',
      surfaces: ['explorerToolbar'],
      isVisible: () => Boolean(currentPath) && !currentPathIsCloud,
      render: () => (
        <button
          type="button"
          onClick={() => handleBookmarkCreated(getPathLeaf(currentPath), currentPath)}
          title="Pin this location to bookmarks"
          style={toolbarChipButtonStyle(false)}
        >
          <Star size={11} />
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Pin</span>
        </button>
      ),
    },
    {
      id: 'toggleSearchContent',
      label: 'Toggle Search Content',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => (
        <button
          type="button"
          onClick={() => {
            if (!currentPathIsCloud) {
              setSearchIncludeContent(v => !v);
            }
          }}
          title={currentPathIsCloud ? 'Cloud search is not available yet' : (searchIncludeContent ? 'Include file text in search (on)' : 'Include file text in search (off)')}
          style={{
            ...toolbarToggleButtonStyle(searchIncludeContent, currentPathIsCloud),
            gap: 4,
            fontSize: 'var(--overlay-explorer-toolbar-font-size)',
          }}
          onMouseEnter={e => {
            if (!currentPathIsCloud) {
              e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)';
            }
          }}
          onMouseLeave={e => {
            if (!currentPathIsCloud) {
              e.currentTarget.style.background = searchIncludeContent ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)';
            }
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>Aa</span>
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Text</span>
        </button>
      ),
    },
    {
      id: 'saveSearch',
      label: 'Save Search',
      surfaces: ['explorerToolbar'],
      isVisible: () => !currentPathIsCloud,
      render: () => (
        <button
          type="button"
          onClick={() => setSaveSearchState({ visible: true, name: search.trim() || getPathLeaf(currentPath) })}
          disabled={!search.trim()}
          title="Save current search"
          style={toolbarChipButtonStyle(!search.trim())}
        >
          <Save size={11} />
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Save Search</span>
        </button>
      ),
    },
    {
      id: 'batchRename',
      label: 'Batch Rename',
      surfaces: ['explorerToolbar'],
      isVisible: () => !currentPathIsCloud,
      render: () => (
        <button
          type="button"
          onClick={() => setBatchRename((current) => ({ ...current, visible: true }))}
          disabled={batchRenameTargetCount === 0}
          title="Batch rename visible or selected files"
          style={toolbarChipButtonStyle(batchRenameTargetCount === 0)}
        >
          <Edit3 size={11} />
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Batch Rename</span>
        </button>
      ),
    },
    {
      id: 'tagSelection',
      label: 'Tag Selection',
      surfaces: ['explorerToolbar'],
      isVisible: () => !currentPathIsCloud,
      render: () => (
        <button
          type="button"
          onClick={() => {
            const input = window.prompt('Add tags to the current selection (comma-separated):', '');
            if (input) {
              void applyTagsToPaths(selectedEntries.map((entry) => entry.path), input, 'add');
            }
          }}
          disabled={selectedEntries.length === 0}
          title="Apply tags to the current selection"
          style={toolbarChipButtonStyle(selectedEntries.length === 0)}
        >
          <Tags size={11} />
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Tag</span>
        </button>
      ),
    },
    {
      id: 'duplicateScan',
      label: 'Find Duplicates',
      surfaces: ['explorerToolbar'],
      isVisible: () => !currentPathIsCloud,
      render: () => (
        <button
          type="button"
          onClick={() => void startDuplicateFinder()}
          disabled={!currentPath}
          title="Scan the current folder tree for duplicates"
          style={toolbarChipButtonStyle(!currentPath)}
        >
          <Sparkles size={11} />
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Duplicates</span>
        </button>
      ),
    },
    {
      id: 'undoTrash',
      label: 'Undo Trash',
      surfaces: ['explorerToolbar'],
      isVisible: () => !currentPathIsCloud,
      render: () => (
        <button
          type="button"
          onClick={() => void undoTrash()}
          title="Undo the most recent trash action"
          style={toolbarChipButtonStyle(false)}
        >
          <Undo2 size={11} />
          <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Undo Trash</span>
        </button>
      ),
    },
    {
      id: 'toggleSources',
      label: 'Toggle Sources',
      surfaces: ['explorerToolbar', 'explorerTopbar'],
      isVisible: surfaceId => isGlobalChromeSurfaceActive(surfaceId),
      render: () => (
        <button
          type="button"
          aria-pressed={sourcesVisible}
          onClick={() => setSourcesVisible(current => !current)}
          title={sourcesVisible ? 'Hide explorer sources' : 'Show explorer sources'}
          style={toolbarToggleButtonStyle(sourcesVisible)}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = sourcesVisible ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
        >
          Sources
        </button>
      ),
    },
    {
      id: 'focusAddressBar',
      label: 'Focus Address Bar',
      surfaces: ['explorerToolbar', 'explorerTopbar'],
      isVisible: surfaceId => isGlobalChromeSurfaceActive(surfaceId),
      render: () => {
        const active = addressEditing || isSearchActive;
        return (
          <button
            type="button"
            aria-pressed={active}
            onClick={focusExplorerAddressBar}
            title="Focus explorer search or path bar"
            style={toolbarToggleButtonStyle(active)}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = active ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
          >
            <Search size={12} />
            Search
          </button>
        );
      },
    },
    {
      id: 'experimentalModes',
      label: 'Experimental Modes',
      surfaces: ['explorerToolbar', 'explorerTopbar'],
      isVisible: surfaceId => isGlobalChromeSurfaceActive(surfaceId),
      render: () => (
        <div
          ref={experimentalMenuAnchorRef}
          style={{ position: 'relative' }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`Experimental view modes: ${selectedExperimentalModeDefinition?.label ?? 'Off'}`}
            aria-haspopup="menu"
            aria-expanded={showExperimentalMenu}
            onClick={() => {
              setShowModeProfileMenu(false);
              setShowLayoutMenu(false);
              setShowExperimentalMenu(current => !current);
            }}
            title={selectedExperimentalModeDefinition?.label ?? 'Experimental view modes'}
            style={{
              ...toolbarToggleButtonStyle(showExperimentalMenu),
              color: showExperimentalMenu ? EXP.text : EXP.muted,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = showExperimentalMenu ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
          >
            <ExplorerExperimentalGlyph
              accent={accent}
              active={showExperimentalMenu || themedExperimentalViewMode !== 'off'}
              mode={selectedExperimentalModeDefinition?.id ?? 'all'}
            />
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {selectedExperimentalModeDefinition?.shortLabel ?? 'Labs'}
              </span>
              {experimentalDensityPercent != null && (
                <span style={{ fontSize: 9, fontWeight: 700, color: showExperimentalMenu ? EXP.text : EXP.muted2 }}>
                  {experimentalDensityPercent}%
                </span>
              )}
            </span>
          </button>
          {experimentalHudVisible && selectedExperimentalModeDefinition && experimentalDensityPercent != null && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 45,
                minWidth: 168,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${accent}55`,
                background: 'rgba(15,18,24,0.94)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
                backdropFilter: explorerBlurEnabled ? 'blur(10px)' : 'none',
                WebkitBackdropFilter: explorerBlurEnabled ? 'blur(10px)' : 'none',
                pointerEvents: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: EXP.text }}>
                  {experimentalDensityDescriptor?.shortLabel ?? selectedExperimentalModeDefinition.shortLabel}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent }}>
                  {experimentalDensityPercent}%
                </span>
              </div>
              <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${experimentalDensityPercent}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                    transition: 'width 0.14s ease',
                  }}
                />
              </div>
            </div>
          )}
          {showExperimentalMenu && (
            <div
              role="menu"
              aria-label="Explorer experimental modes menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 40,
                minWidth: 280,
                borderRadius: 'var(--overlay-explorer-panel-radius)',
                border: '1px solid var(--overlay-explorer-toolbar-border)',
                background: 'var(--overlay-explorer-toolbar-bg)',
                boxShadow: '0 18px 42px rgba(0,0,0,0.42)',
                padding: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={themedExperimentalViewMode === 'off'}
                  onClick={() => {
                    updateExplorerSettings({ experimentalViewMode: 'off' });
                    setShowExperimentalMenu(false);
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '18px minmax(0, 1fr)',
                    gap: 10,
                    alignItems: 'start',
                    width: '100%',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: themedExperimentalViewMode === 'off' ? 'var(--overlay-explorer-chip-active-bg)' : 'transparent',
                    color: EXP.text,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 1 }}>
                    <Puzzle size={14} style={{ color: themedExperimentalViewMode === 'off' ? accent : EXP.muted }} />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>Standard Explorer</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: EXP.muted2, lineHeight: 1.35 }}>
                      Keep using the normal explorer layout chain.
                    </span>
                  </span>
                </button>
                {explorerExperimentalModes.map(mode => {
                  const active = themedExperimentalViewMode === mode.id;
                  const disabled = !mode.available;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) {
                          return;
                        }
                        updateExplorerSettings({ experimentalViewMode: mode.id });
                        showExperimentalHud();
                        setShowExperimentalMenu(false);
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '18px minmax(0, 1fr)',
                        gap: 10,
                        alignItems: 'start',
                        width: '100%',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 10px',
                        background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'transparent',
                        color: disabled ? EXP.muted2 : EXP.text,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        opacity: disabled ? 0.7 : 1,
                      }}
                      onMouseEnter={e => {
                        if (!active && !disabled) {
                          e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active && !disabled) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 1 }}>
                        <ExplorerExperimentalGlyph accent={accent} active={active} mode={mode.id} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>
                          {mode.label}
                          {!mode.available && <span style={{ marginLeft: 6, fontSize: 10, color: EXP.muted2 }}>Coming soon</span>}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: EXP.muted2, lineHeight: 1.35 }}>
                          {mode.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--overlay-explorer-toolbar-border)', fontSize: 10, color: EXP.muted2 }}>
                Experimental layouts keep Ctrl/Cmd + wheel inside a mode-specific detail scale.
              </div>
              {themedExperimentalViewMode !== 'off' && effectiveExperimentalViewMode === 'off' && (
                <div style={{ marginTop: 6, fontSize: 10, color: EXP.muted2 }}>
                  Temporarily falling back to the normal explorer while search is active or the dock is compact.
                </div>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'shellLayout',
      label: 'Explorer Mode',
      surfaces: ['explorerToolbar', 'explorerTopbar'],
      isVisible: surfaceId => isGlobalChromeSurfaceActive(surfaceId),
      render: () => (
        <div
          ref={modeProfileMenuAnchorRef}
          style={{ position: 'relative' }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`Explorer mode: ${effectiveModeProfile.label}`}
            aria-haspopup="menu"
            aria-expanded={showModeProfileMenu}
            onClick={() => {
              setShowExperimentalMenu(false);
              setShowLayoutMenu(false);
              setShowModeProfileMenu(current => !current);
            }}
            title={`Explorer mode: ${effectiveModeProfile.label}`}
            style={{
              ...toolbarToggleButtonStyle(showModeProfileMenu),
              color: showModeProfileMenu ? EXP.text : EXP.muted,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = showModeProfileMenu ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
          >
            <ExplorerShellLayoutGlyph layout={effectiveShellLayout} accent={accent} active={showModeProfileMenu} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {effectiveModeProfile.shortLabel}
            </span>
          </button>
          {showModeProfileMenu && (
            <div
              role="menu"
              aria-label="Explorer modes menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 40,
                minWidth: 280,
                borderRadius: 'var(--overlay-explorer-panel-radius)',
                border: '1px solid var(--overlay-explorer-toolbar-border)',
                background: 'var(--overlay-explorer-toolbar-bg)',
                boxShadow: '0 18px 42px rgba(0,0,0,0.42)',
                padding: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {explorerModeProfiles.map((modeProfile) => {
                  const active = effectiveModeProfile.id === modeProfile.id;
                  const paneLayout = getExplorerShellLayoutDefinition(modeProfile.paneLayoutId);
                  return (
                    <button
                      key={modeProfile.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => applyModeProfilePreset(modeProfile)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '18px minmax(0, 1fr)',
                        gap: 10,
                        alignItems: 'start',
                        width: '100%',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 10px',
                        background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'transparent',
                        color: EXP.text,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 1 }}>
                        <ExplorerShellLayoutGlyph layout={paneLayout} accent={accent} active={active} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>
                          {modeProfile.label}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: EXP.muted2, lineHeight: 1.35 }}>
                          {modeProfile.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--overlay-explorer-toolbar-border)' }}>
                {explorerChromeEditMode ? (
                  <>
                    <div style={{ fontSize: 10, color: EXP.muted2 }}>
                      Drag chrome controls across explorer surfaces, then save the layout override for this theme.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
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
                      Modes rebalance the rail and preview panes without mutating the live session shell preset.
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
      id: 'viewLayout',
      label: 'View Layout',
      surfaces: ['explorerToolbar', 'explorerTopbar'],
      isVisible: surfaceId => isGlobalChromeSurfaceActive(surfaceId),
      render: () => (
        <div
          ref={layoutMenuAnchorRef}
          style={{ position: 'relative' }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`Explorer layout: ${selectedViewModeDefinition.label}`}
            aria-haspopup="menu"
            aria-expanded={showLayoutMenu}
            onClick={() => {
              setShowModeProfileMenu(false);
              setShowExperimentalMenu(false);
              setShowLayoutMenu(current => !current);
            }}
            title={`Explorer layout: ${selectedViewModeDefinition.label}`}
            style={{
              ...toolbarToggleButtonStyle(showLayoutMenu),
              color: showLayoutMenu ? EXP.text : EXP.muted,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = showLayoutMenu ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
          >
            <ExplorerLayoutGlyph mode={selectedViewModeDefinition} accent={accent} active={showLayoutMenu} />
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {selectedViewModeDefinition.shortLabel}
              </span>
              {gridZoomPercent != null && (
                <span style={{ fontSize: 9, fontWeight: 700, color: showLayoutMenu ? EXP.text : EXP.muted2 }}>
                  {gridZoomPercent}%
                </span>
              )}
            </span>
          </button>
          {zoomHudVisible && gridZoomPercent != null && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 45,
                minWidth: 148,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${accent}55`,
                background: 'rgba(15,18,24,0.94)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
                backdropFilter: explorerBlurEnabled ? 'blur(10px)' : 'none',
                WebkitBackdropFilter: explorerBlurEnabled ? 'blur(10px)' : 'none',
                pointerEvents: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: EXP.text }}>
                  {selectedViewModeDefinition.shortLabel}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: accent }}>
                  {gridZoomPercent}%
                </span>
              </div>
              <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${gridZoomPercent}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${accent}99, ${accent})`,
                    transition: 'width 0.14s ease',
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
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 40,
                minWidth: 240,
                borderRadius: 'var(--overlay-explorer-panel-radius)',
                border: '1px solid var(--overlay-explorer-toolbar-border)',
                background: 'var(--overlay-explorer-toolbar-bg)',
                boxShadow: '0 18px 42px rgba(0,0,0,0.42)',
                padding: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {explorerViewModes.map(mode => {
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
                            ? { viewMode: mode.id, gridZoom: getExplorerGridZoomAnchor(mode.id) }
                            : { viewMode: mode.id },
                        );
                        showZoomHud();
                        setShowLayoutMenu(false);
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '18px minmax(0, 1fr)',
                        gap: 10,
                        alignItems: 'start',
                        width: '100%',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 10px',
                        background: active ? 'var(--overlay-explorer-chip-active-bg)' : 'transparent',
                        color: active ? EXP.text : EXP.muted,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'center', paddingTop: 1 }}>
                        <ExplorerLayoutGlyph mode={mode} accent={accent} active={active} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: active ? EXP.text : EXP.text }}>
                          {mode.label}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: EXP.muted2, lineHeight: 1.35 }}>
                          {mode.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--overlay-explorer-toolbar-border)', fontSize: 10, color: EXP.muted2 }}>
                Ctrl/Cmd + wheel moves through Small, M, L, XL, then row layouts with live zoom feedback.
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'togglePreview',
      label: 'Toggle Preview',
      surfaces: ['explorerToolbar', 'explorerTopbar'],
      isVisible: surfaceId => isGlobalChromeSurfaceActive(surfaceId),
      render: () => (
        <button
          type="button"
          aria-pressed={previewEnabled}
          onClick={togglePreviewEnabled}
          title={previewEnabled
            ? 'Turn off inline preview for previewable files'
            : 'Turn on inline preview for previewable files'}
          style={toolbarToggleButtonStyle(previewEnabled)}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = previewEnabled ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
        >
          <Eye size={12} />
          Preview
        </button>
      ),
    },
    {
      id: 'toggleHiddenFiles',
      label: 'Toggle Hidden Files',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => (
        <button
          type="button"
          onClick={() => updateExplorerSettings({ showHiddenFiles: !showHidden })}
          title="Toggle hidden files"
          style={{
            ...toolbarIconButtonStyle(),
            background: showHidden ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)',
            color: showHidden ? 'var(--overlay-explorer-chip-active-text)' : EXP.muted,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = showHidden ? 'var(--overlay-explorer-chip-active-bg)' : 'var(--overlay-explorer-chip-bg)')}
        >
          <Eye size={14} />
        </button>
      ),
    },
    {
      id: 'refresh',
      label: 'Refresh',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => (
        <button
          type="button"
          onClick={refresh}
          title="Refresh (F5)"
          style={toolbarIconButtonStyle()}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)';
            e.currentTarget.style.color = EXP.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
            e.currentTarget.style.color = EXP.muted;
          }}
        >
          <RefreshCw size={14} />
        </button>
      ),
    },
    {
      id: 'newFolder',
      label: 'New Folder',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => (
        <button
          type="button"
          onClick={() => openNew('folder')}
          title="New Folder"
          style={toolbarActionButtonStyle()}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)';
            e.currentTarget.style.color = EXP.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
            e.currentTarget.style.color = EXP.muted;
          }}
        >
          <FolderPlus size={13} />
          Folder
        </button>
      ),
    },
    {
      id: 'newFile',
      label: 'New File',
      surfaces: ['explorerToolbar'],
      isVisible: () => true,
      render: () => (
        <button
          type="button"
          onClick={() => openNew('file')}
          title="New File"
          style={toolbarActionButtonStyle()}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-active-bg)';
            e.currentTarget.style.color = EXP.text;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
            e.currentTarget.style.color = EXP.muted;
          }}
        >
          <FilePlus size={13} />
          File
        </button>
      ),
    },
    {
      id: 'pasteClipboard',
      label: 'Paste Clipboard',
      surfaces: ['explorerToolbar'],
      isVisible: () => Boolean(clipboard),
      render: () => clipboard ? (
        <button
          type="button"
          onClick={paste}
          title={`Paste ${clipboard.entries.length} item${clipboard.entries.length === 1 ? '' : 's'} (Ctrl+V)`}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--overlay-explorer-chip-active-bg)', border: '1px solid var(--overlay-explorer-chip-active-border)', borderRadius: 'var(--overlay-explorer-control-radius)', cursor: 'pointer', color: 'var(--overlay-explorer-chip-active-text)', padding: '3px 8px', fontSize: 'var(--overlay-explorer-toolbar-font-size)' }}
        >
          <Clipboard size={12} />
          Paste {clipboard.entries.length > 1 ? clipboard.entries.length : ''}
        </button>
      ) : null,
    },
    {
      id: 'statusItemCount',
      label: 'Status Item Count',
      surfaces: ['explorerStatusBar'],
      isVisible: () => true,
      render: () => (
        <span>
          {filteredEntryCount} item{filteredEntryCount !== 1 ? 's' : ''}
          {sourceEntryCount !== filteredEntryCount && (
            <span style={{ color: EXP.muted2 }}>
              {` of ${sourceEntryCount}`}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'statusSelectionSummary',
      label: 'Status Selection Summary',
      surfaces: ['explorerStatusBar'],
      isVisible: () => selected.size > 0,
      render: () => (
        <span style={{ color: accent }}>
          {selected.size} selected
        </span>
      ),
    },
    {
      id: 'statusModeProfile',
      label: 'Status Mode Profile',
      surfaces: ['explorerStatusBar'],
      isVisible: () => !isCompactDock,
      render: () => (
        <span>
          Mode: <span style={{ color: EXP.text }}>{effectiveModeProfile.label}</span>
        </span>
      ),
    },
    {
      id: 'statusViewSummary',
      label: 'Status View Summary',
      surfaces: ['explorerStatusBar'],
      isVisible: () => !isCompactDock,
      render: () => (
        <span>
          View: <span style={{ color: EXP.text }}>{selectedViewModeDefinition.label}</span>
          {effectiveViewMode !== themedViewMode ? ` -> ${effectiveViewModeDefinition.label}` : ''}
        </span>
      ),
    },
    {
      id: 'statusPreviewSummary',
      label: 'Status Preview Summary',
      surfaces: ['explorerStatusBar'],
      isVisible: () => !isCompactDock,
      render: () => (
        <span>
          Preview: <span style={{ color: previewEnabled ? accent : EXP.text }}>{previewEnabled ? 'On' : 'Off'}</span>
          {hasPreview && (
            <span style={{ color: EXP.muted2 }}>{` · ${previewModeLabel}: ${getPathLeaf(preview.path)}`}</span>
          )}
        </span>
      ),
    },
    {
      id: 'statusLabsSummary',
      label: 'Status Labs Summary',
      surfaces: ['explorerStatusBar'],
      isVisible: () => Boolean(selectedExperimentalModeDefinition),
      render: () => (
        selectedExperimentalModeDefinition ? (
          <span>
            Labs: <span style={{ color: EXP.text }}>{selectedExperimentalModeDefinition.label}</span>
            {experimentalDensityDescriptor ? ` · ${experimentalDensityDescriptor.label}` : ''}
            {effectiveExperimentalViewMode === 'off' ? ' (fallback)' : ''}
          </span>
        ) : null
      ),
    },
    {
      id: 'statusSearchSummary',
      label: 'Status Search Summary',
      surfaces: ['explorerStatusBar'],
      isVisible: () => Boolean(search),
      render: () => (
        search ? (
          <span>
            {searchModeLabel}: <span style={{ color: EXP.text }}>&quot;{search}&quot;</span>
            <span style={{ color: EXP.muted2 }}>{searchLoading ? ' · searching…' : ` · ${filteredEntryCount} result${filteredEntryCount === 1 ? '' : 's'}`}</span>
            {activeTagFilterIds.length > 0 && sourceEntryCount !== filteredEntryCount && (
              <span style={{ color: EXP.muted2 }}>{` · ${sourceEntryCount - filteredEntryCount} hidden by tags`}</span>
            )}
          </span>
        ) : null
      ),
    },
    {
      id: 'statusTaskBadge',
      label: 'Status Task Badge',
      surfaces: ['explorerStatusBar'],
      isVisible: () => true,
      render: () => (
        <ExplorerTaskStatusBadge
          accent={accent}
          text={EXP.text}
          muted={EXP.muted}
          border={EXP.border}
          danger={EXP.red}
          background="rgba(255,255,255,0.02)"
        />
      ),
    },
    {
      id: 'statusClipboardQueue',
      label: 'Status Clipboard Queue',
      surfaces: ['explorerStatusBar'],
      isVisible: () => Boolean(clipboard),
      render: () => (
        clipboard ? (
          <span style={{ color: EXP.muted2 }}>
            {clipboard.action === 'copy' ? 'Copy' : 'Move'} queue: {clipboard.entries[0]?.name}
            {clipboard.entries.length > 1 ? ` +${clipboard.entries.length - 1} more` : ''} — ready (Ctrl+V)
          </span>
        ) : null
      ),
    },
    {
      id: 'statusPreviewLoading',
      label: 'Status Preview Loading',
      surfaces: ['explorerStatusBar'],
      isVisible: () => previewLoading,
      render: () => (
        previewLoading ? (
          <span style={{ color: accent, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Loader size={9} style={{ animation: 'spin 1s linear infinite' }} />
            Loading…
          </span>
        ) : null
      ),
    },
  ], [
    accent,
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
    effectiveExperimentalViewMode,
    experimentalDensityDescriptor,
    experimentalDensityPercent,
    explorerTheme.breadcrumbStyle,
    effectiveChromeLayoutId,
    effectiveModeProfile,
    effectiveShellLayout,
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
    paste,
    pinnedLocations,
    previewEnabled,
    previewLoading,
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
    selectedViewModeDefinition,
    setAddressDraft,
    setAddressEditing,
    setBatchRename,
    setSaveSearchState,
    setSearchIncludeContent,
    setShowExperimentalMenu,
    setShowLayoutMenu,
    setShowModeProfileMenu,
    setSourcesVisible,
    showExperimentalHud,
    showModeProfileMenu,
    showExperimentalMenu,
    showLayoutMenu,
    showToolbarLocationStrips,
    showZoomHud,
    sourcesVisible,
    startDuplicateFinder,
    submitAddressDraft,
    themedExperimentalViewMode,
    themedViewMode,
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
  ]);
  const explorerChromeControlRegistryById = useMemo(
    () => new Map(explorerChromeControlRegistry.map((entry) => [entry.id, entry])),
    [explorerChromeControlRegistry],
  );
  const explorerTopbarSurface = useMemo(
    () => resolveExplorerChromeSurfaceLayout({
      layoutId: effectiveChromeLayoutId,
      surfaceId: 'explorerTopbar',
      controlDefinitions: explorerChromeControlRegistry,
      override: explorerChromeOverride,
      isControlVisible: (controlId, surfaceId) => explorerChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ?? false,
    }),
    [
      explorerChromeControlRegistry,
      explorerChromeControlRegistryById,
      effectiveChromeLayoutId,
      explorerChromeOverride,
    ],
  );
  const explorerToolbarSurface = useMemo(
    () => resolveExplorerChromeSurfaceLayout({
      layoutId: effectiveChromeLayoutId,
      surfaceId: 'explorerToolbar',
      controlDefinitions: explorerChromeControlRegistry,
      override: explorerChromeOverride,
      isControlVisible: (controlId, surfaceId) => explorerChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ?? false,
    }),
    [
      explorerChromeControlRegistry,
      explorerChromeControlRegistryById,
      effectiveChromeLayoutId,
      explorerChromeOverride,
    ],
  );
  const explorerStatusBarSurface = useMemo(
    () => resolveExplorerChromeSurfaceLayout({
      layoutId: effectiveChromeLayoutId,
      surfaceId: 'explorerStatusBar',
      controlDefinitions: explorerChromeControlRegistry,
      override: explorerChromeOverride,
      isControlVisible: (controlId, surfaceId) => explorerChromeControlRegistryById.get(controlId)?.isVisible(surfaceId) ?? false,
    }),
    [
      explorerChromeControlRegistry,
      explorerChromeControlRegistryById,
      effectiveChromeLayoutId,
      explorerChromeOverride,
    ],
  );
  const renderExplorerChromeControl = useCallback((placement: ExplorerChromeResolvedControlPlacement) => (
    explorerChromeControlRegistryById.get(placement.controlId)?.render(placement) ?? null
  ), [explorerChromeControlRegistryById]);
  const shouldRenderStatusBar = explorerTheme.statusBarStyle !== 'hidden';
  const statusBarStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '3px 12px',
    background: 'var(--overlay-explorer-status-bg)',
    borderTop: '1px solid var(--overlay-explorer-status-border)',
    fontSize: 'var(--overlay-explorer-status-font-size)',
    color: EXP.muted,
    flexShrink: 0,
    margin: explorerTheme.statusBarStyle === 'floating'
      ? '0 var(--overlay-explorer-chrome-inset) var(--overlay-explorer-chrome-inset)'
      : 0,
    borderRadius: explorerTheme.statusBarStyle === 'floating'
      ? 'var(--overlay-explorer-panel-radius)'
      : 0,
    boxShadow: explorerTheme.statusBarStyle === 'floating'
      ? 'var(--overlay-explorer-toolbar-shadow)'
      : 'none',
    backdropFilter: explorerBlurEnabled && explorerTheme.statusBarStyle === 'floating' ? 'blur(18px)' : 'none',
    WebkitBackdropFilter: explorerBlurEnabled && explorerTheme.statusBarStyle === 'floating' ? 'blur(18px)' : 'none',
  }), [explorerBlurEnabled, explorerTheme.statusBarStyle]);

  useEffect(() => () => {
    if (zoomHudTimerRef.current != null) {
      window.clearTimeout(zoomHudTimerRef.current);
    }
    if (experimentalHudTimerRef.current != null) {
      window.clearTimeout(experimentalHudTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const viewport = explorerViewportRef.current;
    if (!viewport) {
      return;
    }

    let rafId = 0;
    const updateMetrics = () => {
      rafId = 0;
      setExplorerViewportMetrics(current => {
        const next = {
          scrollTop: viewport.scrollTop,
          clientHeight: viewport.clientHeight,
          clientWidth: viewport.clientWidth,
        };

        if (
          current.scrollTop === next.scrollTop
          && current.clientHeight === next.clientHeight
          && current.clientWidth === next.clientWidth
        ) {
          return current;
        }

        return next;
      });
    };

    const scheduleMetricsUpdate = () => {
      if (rafId !== 0) {
        return;
      }
      rafId = window.requestAnimationFrame(updateMetrics);
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleMetricsUpdate)
      : null;

    resizeObserver?.observe(viewport);
    viewport.addEventListener('scroll', scheduleMetricsUpdate, { passive: true });
    scheduleMetricsUpdate();

    return () => {
      viewport.removeEventListener('scroll', scheduleMetricsUpdate);
      resizeObserver?.disconnect();
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = explorerViewportRef.current;
    if (!viewport || isCompactDock) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (isEditableKeyboardTarget(event.target)) {
        return;
      }
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || Math.abs(event.deltaY) < 6) {
        return;
      }

      event.preventDefault();
      layoutWheelDeltaAccumulatorRef.current += event.deltaY;
      const accumulatedDelta = layoutWheelDeltaAccumulatorRef.current;
      const stepCount = Math.min(
        3,
        Math.floor(Math.abs(accumulatedDelta) / EXPLORER_LAYOUT_WHEEL_STEP_DELTA),
      );
      if (stepCount <= 0) {
        return;
      }

      const direction = accumulatedDelta < 0 ? 'larger' : 'smaller';
      layoutWheelDeltaAccumulatorRef.current -= (
        Math.sign(accumulatedDelta)
        * stepCount
        * EXPLORER_LAYOUT_WHEEL_STEP_DELTA
      );

      if (effectiveExperimentalViewMode !== 'off') {
        let nextDensity = experimentalDensity;
        for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
          const steppedDensity = stepAdaptiveSemanticDensity(nextDensity, direction);
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
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      layoutWheelDeltaAccumulatorRef.current = 0;
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [
    effectiveExperimentalViewMode,
    experimentalDensity,
    gridZoom,
    isCompactDock,
    showExperimentalHud,
    showZoomHud,
    themedViewMode,
    updateExplorerSettings,
  ]);

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
      void import('@monaco-editor/react');
      void import('./documentPreview');
      void import('./ModelPreview');
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
  const virtualizedViewportHeight = explorerViewportMetrics.clientHeight;
  const virtualizedScrollTop = Math.max(
    0,
    explorerViewportMetrics.scrollTop - (newItem.visible ? activeNewItemHeight : 0),
  );

  const virtualWindow = useMemo(() => {
    if (effectiveViewModeDefinition.presentation === 'grid' && activeGridMetrics) {
      const availableWidth = Math.max(0, virtualizedViewportWidth - activeGridMetrics.padding * 2);
      const columns = Math.max(
        1,
        Math.floor((availableWidth + activeGridMetrics.gap) / (activeGridMetrics.minWidth + activeGridMetrics.gap)),
      );
      const rowHeight = isSearchActive ? activeGridMetrics.searchRowHeight : activeGridMetrics.rowHeight;
      const totalRows = Math.ceil(visibleEntries.length / columns);
      const startRow = Math.max(0, Math.floor(virtualizedScrollTop / rowHeight) - EXPLORER_GRID_OVERSCAN_ROWS);
      const endRow = Math.min(
        totalRows,
        Math.ceil((virtualizedScrollTop + virtualizedViewportHeight) / rowHeight) + EXPLORER_GRID_OVERSCAN_ROWS,
      );

      return {
        kind: 'grid' as const,
        columns,
        rowHeight,
        startRow,
        endRow,
        startIndex: startRow * columns,
        endIndex: Math.min(visibleEntries.length, endRow * columns),
        topSpacer: startRow * rowHeight,
        bottomSpacer: Math.max(0, totalRows - endRow) * rowHeight,
      };
    }

    const rowHeight = isSearchActive
      ? activeRowMetrics?.searchRowHeight ?? EXPLORER_LIST_SEARCH_ROW_HEIGHT
      : activeRowMetrics?.rowHeight ?? EXPLORER_LIST_ROW_HEIGHT;
    const totalRows = visibleEntries.length;
    const startRow = Math.max(0, Math.floor(virtualizedScrollTop / rowHeight) - EXPLORER_LIST_OVERSCAN);
    const endRow = Math.min(
      totalRows,
      Math.ceil((virtualizedScrollTop + virtualizedViewportHeight) / rowHeight) + EXPLORER_LIST_OVERSCAN,
    );

    return {
      kind: 'list' as const,
      rowHeight,
      startRow,
      endRow,
      startIndex: startRow,
      endIndex: endRow,
      topSpacer: startRow * rowHeight,
      bottomSpacer: Math.max(0, totalRows - endRow) * rowHeight,
    };
  }, [
    effectiveViewMode,
    effectiveViewModeDefinition.presentation,
    activeGridMetrics,
    activeRowMetrics,
    isSearchActive,
    virtualizedScrollTop,
    virtualizedViewportHeight,
    virtualizedViewportWidth,
    visibleEntries.length,
  ]);

  const virtualizedEntries = useMemo(
    () => visibleEntries.slice(virtualWindow.startIndex, virtualWindow.endIndex),
    [virtualWindow.endIndex, virtualWindow.startIndex, visibleEntries],
  );

  useEffect(() => {
    if (loading || virtualizedEntries.length === 0) {
      return;
    }

    const shouldMeasureDirectories = !isSearchActive;
    const pendingFiles = virtualizedEntries
      .filter(entry => !entry.is_dir && !entrySizes[entry.path] && !entrySizeLoadingPaths.has(entry.path))
      .slice(0, 8);
    const pendingDirectories = shouldMeasureDirectories
      ? virtualizedEntries
        .filter(entry => entry.is_dir && !entrySizes[entry.path] && !entrySizeLoadingPaths.has(entry.path))
        .slice(0, 1)
      : [];

    const nextBatch = (pendingFiles.length > 0 ? pendingFiles : pendingDirectories).slice(0, 8);
    const unresolvedPaths = nextBatch.map(entry => entry.path);

    if (unresolvedPaths.length === 0) {
      return;
    }

    let disposed = false;
    const batchTimer = window.setTimeout(() => {
      setEntrySizeLoadingPaths(current => {
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
        .then(results => {
          if (disposed) {
            return;
          }

          recordExplorerMetric({
            metricId: 'explorer_entry_size_batch',
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              directoryCount: nextBatch.filter((entry) => entry.is_dir).length,
              pathCount: unresolvedPaths.length,
              resultCount: results.length,
              success: true,
            },
          });

          startTransition(() => {
            setEntrySizes(current => {
              const next = { ...current };
              for (const result of results) {
                next[result.path] = result;
              }
              return next;
            });
          });

          setEntrySizeLoadingPaths(current => {
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
            metricId: 'explorer_entry_size_batch',
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              directoryCount: nextBatch.filter((entry) => entry.is_dir).length,
              pathCount: unresolvedPaths.length,
              resultCount: 0,
              success: false,
            },
          });

          setEntrySizeLoadingPaths(current => {
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
    virtualizedEntries,
  ]);

  useEffect(() => {
    if (!useNativeOsIcons || loading || virtualizedEntries.length === 0) {
      return;
    }

    const pendingEntries = virtualizedEntries
      .map(entry => ({
        entry,
        key: getNativeIconCacheKey(entry.path, DEFAULT_NATIVE_ICON_SIZE),
      }))
      .filter(({ key }) => nativeIconMap[key] === undefined && !nativeIconLoadingKeys.has(key))
      .slice(0, 24);

    if (pendingEntries.length === 0) {
      return;
    }

    const pendingKeys = pendingEntries.map(item => item.key);
    const requests = pendingEntries.map(item => getNativeIconRequest(item.entry));

    let disposed = false;
    const batchTimer = window.setTimeout(() => {
      setNativeIconLoadingKeys(current => {
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
      void commands.fsResolveNativeIcons(
        requests.map(request => ({
          ...request,
          size: request.size ?? null,
        })),
      )
        .then(unwrapTauriResult)
        .then(results => {
          if (disposed) {
            return;
          }

          recordExplorerMetric({
            metricId: 'explorer_native_icon_batch',
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              pathCount: pendingKeys.length,
              resultCount: results.length,
              success: true,
            },
          });

          startTransition(() => {
            setNativeIconMap(current => {
              const next = { ...current };
              for (const result of results) {
                next[getNativeIconCacheKey(result.path, DEFAULT_NATIVE_ICON_SIZE)] = result.src ?? null;
              }
              return next;
            });
          });

          setNativeIconLoadingKeys(current => {
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
            metricId: 'explorer_native_icon_batch',
            durationMs: getExplorerPerformanceNow() - startedAt,
            metadata: {
              pathCount: pendingKeys.length,
              resultCount: 0,
              success: false,
            },
          });

          startTransition(() => {
            setNativeIconMap(current => {
              const next = { ...current };
              for (const key of pendingKeys) {
                next[key] = null;
              }
              return next;
            });
          });

          setNativeIconLoadingKeys(current => {
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
  }, [loading, nativeIconLoadingKeys, nativeIconMap, recordExplorerMetric, useNativeOsIcons, virtualizedEntries]);

  useEffect(() => {
    if (
      loading
      || currentPathIsCloud
      || virtualWindow.kind !== 'grid'
      || !activeGridMetrics
      || activeGridMetrics.iconStageSize < EXPLORER_IMAGE_TILE_PREVIEW_CONFIG.minStagePx
      || virtualizedEntries.length === 0
    ) {
      return;
    }

    const pendingEntries = virtualizedEntries
      .filter((entry) => {
        if (entry.is_dir || isCloudExplorerPath(entry.path)) {
          return false;
        }
        if (!isImagePreviewExtension(getEntryExtension(entry))) {
          return false;
        }
        return imageThumbnailMap[entry.path] === undefined && !imageThumbnailLoadingPaths.has(entry.path);
      })
      .slice(0, EXPLORER_IMAGE_TILE_PREVIEW_CONFIG.batchSize);

    if (pendingEntries.length === 0) {
      return;
    }

    const pendingPaths = pendingEntries.map(entry => entry.path);
    const batchTimer = window.setTimeout(() => {
      setImageThumbnailLoadingPaths(current => {
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
            const src = await readExplorerImageThumbnail(
              entry.path,
              EXPLORER_IMAGE_TILE_PREVIEW_CONFIG.maxDimensionPx,
              EXPLORER_IMAGE_TILE_PREVIEW_CONFIG.maxDimensionPx,
            );
            return { path: entry.path, src };
          } catch {
            return { path: entry.path, src: null };
          }
        }),
      ).then(results => {
        if (!isExplorerMountedRef.current) {
          return;
        }

        startTransition(() => {
          setImageThumbnailMap(current => {
            const next = { ...current };
            for (const result of results) {
              next[result.path] = result.src;
            }
            return next;
          });
        });

        setImageThumbnailLoadingPaths(current => {
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
    currentPathIsCloud,
    imageThumbnailMap,
    loading,
    readExplorerImageThumbnail,
    virtualWindow.kind,
    virtualizedEntries,
  ]);

  const renderSearchMetadata = (entry: FileEntry) => {
    if (!isSearchActive) return null;
    const searchEntry = entry as FileSearchResult;
    const matchLabel = searchEntry.match_kind === 'name_and_content'
      ? 'Name + content'
      : searchEntry.match_kind === 'content'
        ? 'Content match'
        : 'Name match';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, minWidth: 0, maxHeight: 42, overflow: 'hidden' }}>
        <div style={{ fontSize: 9, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {searchEntry.relative_path || searchEntry.path}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {searchEntry.line_number != null && (
            <span style={{ fontSize: 9, color: accent, fontFamily: 'monospace', flexShrink: 0 }}>L{searchEntry.line_number}</span>
          )}
          {searchEntry.snippet && (
            <span style={{ fontSize: 9, color: EXP.text, opacity: 0.88, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              {searchEntry.snippet}
            </span>
          )}
        </div>
        <div style={{ fontSize: 9, color: EXP.muted, letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
    return parts.join('\n');
  };

  const renderEntryInlineMeta = (entry: FileEntry) => {
    const parts = [
      getEntryTypeLabel(entry),
      getEntryStorageLabel(entry),
      formatDate(entry.modified),
    ].filter(Boolean);
    return parts.join('  •  ');
  };

  const renderAdaptiveSemanticEntry = (
    entry: FileEntry,
    densityStop: AdaptiveSemanticDensityStopDefinition,
    options: { dominant: boolean },
  ) => {
    const isSel = selected.has(entry.path);
    const isDrop = dragOver === entry.path && entry.is_dir;
    const isRenaming = rename.active && rename.path === entry.path;
    const iconSrc = getRenderableIconSrc(entry, isSel || isDrop);

    if (densityStop.presentation === 'table' && densityStop.table) {
      return (
        <div
          key={entry.path}
          draggable
          data-overlay-drag-source="file"
          onDragStart={e => onDragStart(e, entry)}
          onDragEnd={onDragEnd}
          onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
          onDragLeave={() => setDragOver(null)}
          onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
          onClick={e => onEntryClick(e, entry)}
          onDoubleClick={() => onEntryDoubleClick(entry)}
          onContextMenu={e => onRightClick(e, entry)}
          title={entry.path}
          style={{
            display: 'grid',
            gridTemplateColumns: densityStop.table.showRichMeta
              ? 'minmax(0, 2.3fr) minmax(110px, 0.9fr) minmax(120px, 0.9fr) minmax(96px, 0.7fr)'
              : 'minmax(0, 2fr) minmax(120px, 0.85fr) minmax(96px, 0.7fr)',
            alignItems: 'center',
            gap: 12,
            minHeight: densityStop.table.rowHeight,
            padding: densityStop.table.showRichMeta ? '8px 14px' : '6px 14px',
            borderBottom: '1px solid var(--overlay-explorer-toolbar-border)',
            borderRadius: 10,
            background: isDrop ? dropEntrySurface.background : isSel ? selectedEntrySurface.background : 'var(--overlay-explorer-chip-bg)',
            border: `1px solid ${isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : 'var(--overlay-explorer-chip-border)'}`,
            cursor: 'pointer',
            userSelect: 'none',
            boxShadow: isDrop ? dropEntrySurface.boxShadow : isSel ? selectedEntrySurface.boxShadow : 'none',
            transform: isDrop ? dropEntrySurface.transform : isSel ? selectedEntrySurface.transform : 'translateY(0)',
          }}
          onMouseEnter={e => {
            if (!isSel && !isDrop) {
              applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, hoverEntrySurface);
            }
          }}
          onMouseLeave={e => {
            if (!isSel && !isDrop) {
              applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, idleEntrySurface);
            }
          }}
        >
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: densityStop.table.iconSize + 10, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <SvgIcon src={iconSrc} size={densityStop.table.iconSize} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              {isRenaming
                ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
                : (
                  <>
                    <div style={{ color: isSel ? EXP.text : entry.is_dir ? EXP.yellow : EXP.text, fontWeight: entry.is_dir ? 650 : 560, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </div>
                    {densityStop.table.showRichMeta && (
                      <div style={{ marginTop: 3, fontSize: 10, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {renderEntryInlineMeta(entry)}
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
          <div style={{ color: EXP.muted, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getEntryStorageLabel(entry)}
          </div>
          <div style={{ color: EXP.muted, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {formatDate(entry.modified)}
          </div>
          {densityStop.table.showRichMeta && (
            <div style={{ color: EXP.muted2, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
    const iconStageSize = Math.round(densityStop.grid.iconStageSize * dominantScale);
    const iconSize = Math.round(densityStop.grid.iconSize * dominantScale);
    const isCards = densityStop.presentation === 'cards';

    return (
      <div
        key={entry.path}
        draggable
        data-overlay-drag-source="file"
        onDragStart={e => onDragStart(e, entry)}
        onDragEnd={onDragEnd}
        onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
        onDragLeave={() => setDragOver(null)}
        onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
        onClick={e => onEntryClick(e, entry)}
        onDoubleClick={() => onEntryDoubleClick(entry)}
        onContextMenu={e => onRightClick(e, entry)}
        title={entry.path}
        style={{
          minHeight,
          borderRadius: isCards ? 18 : 14,
          border: `1px solid ${isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : 'var(--overlay-explorer-chip-border)'}`,
          background: isDrop
            ? dropEntrySurface.background
            : isSel
              ? selectedEntrySurface.background
              : options.dominant && entry.is_dir
                ? 'linear-gradient(180deg, color-mix(in srgb, white 10%, transparent), color-mix(in srgb, white 4%, transparent))'
                : 'var(--overlay-explorer-chip-bg)',
          padding: isCards ? '14px' : (iconSize <= 30 ? '10px 8px' : '12px 10px'),
          display: 'flex',
          flexDirection: isCards ? 'row' : 'column',
          alignItems: isCards ? 'flex-start' : 'center',
          justifyContent: 'flex-start',
          gap: isCards ? 14 : 10,
          cursor: 'pointer',
          overflow: 'hidden',
          userSelect: 'none',
          boxSizing: 'border-box',
          boxShadow: isDrop ? dropEntrySurface.boxShadow : isSel ? selectedEntrySurface.boxShadow : 'none',
          transform: isDrop ? dropEntrySurface.transform : isSel ? selectedEntrySurface.transform : 'translateY(0)',
        }}
        onMouseEnter={e => {
          if (!isSel && !isDrop) {
            applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, hoverEntrySurface);
          }
        }}
        onMouseLeave={e => {
          if (!isSel && !isDrop) {
            applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, idleEntrySurface);
          }
        }}
      >
        <div
          style={{
            width: iconStageSize,
            height: iconStageSize,
            minWidth: iconStageSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: isCards ? 16 : 12,
            background: 'rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}
        >
          <SvgIcon src={iconSrc} size={iconSize} />
        </div>
        <div style={{ minWidth: 0, width: '100%', textAlign: isCards ? 'left' : 'center' }}>
          {isRenaming
            ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
            : (
              <>
                <div
                  style={{
                    color: isSel ? EXP.text : entry.is_dir ? EXP.yellow : EXP.text,
                    fontWeight: entry.is_dir ? 650 : 560,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: densityStop.grid.titleLines,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.28,
                  }}
                >
                  {entry.name}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isCards ? renderEntryInlineMeta(entry) : getEntryTypeLabel(entry)}
                </div>
                {isCards && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: accent, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {entry.is_dir ? 'Folder Anchor' : 'Active File'}
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
      <div style={{ padding: '0 14px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderRadius: 'var(--overlay-explorer-panel-radius)',
            border: '1px solid var(--overlay-explorer-item-selected-border)',
            background: 'var(--overlay-explorer-item-selected-bg)',
            padding: '12px 14px',
          }}
        >
          <SvgIcon
            src={newItem.kind === 'folder'
              ? (resolveIconSrc(themeIconTheme.folder, themeIconTheme) ?? '/icons/folder.svg')
              : resolveFileIconSrc('new-file.txt', 'txt', themeIconTheme)}
            size={iconSize}
          />
          <input
            autoFocus
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitNew();
              if (e.key === 'Escape') setNewItem({ visible: false, kind: 'folder' });
            }}
            onBlur={commitNew}
            placeholder={newItem.kind === 'folder' ? 'folder name' : 'name.ext'}
            style={{
              background: 'var(--overlay-explorer-input-bg)',
              border: '1px solid var(--overlay-explorer-input-border)',
              borderRadius: 'var(--overlay-explorer-control-radius)',
              color: EXP.text,
              fontSize: 12,
              padding: '2px 6px',
              outline: 'none',
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

    if (adaptiveDensityStop.presentation === 'table') {
      const showRichMeta = adaptiveDensityStop.table?.showRichMeta ?? false;
      return (
        <section
          key={band.id}
          style={{ marginBottom: 18 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '0 12px', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: band.dominant ? accent : EXP.muted2 }}>
                {band.label}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: EXP.muted, maxWidth: 420 }}>
                {band.description}
              </div>
            </div>
            <div style={{ fontSize: 10, color: EXP.muted2 }}>{band.entries.length} items</div>
          </div>
          <div style={{ display: 'grid', gap: 8, padding: '0 12px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: showRichMeta
                  ? 'minmax(0, 2.3fr) minmax(110px, 0.9fr) minmax(120px, 0.9fr) minmax(96px, 0.7fr)'
                  : 'minmax(0, 2fr) minmax(120px, 0.85fr) minmax(96px, 0.7fr)',
                gap: 12,
                padding: '0 14px',
                color: EXP.muted2,
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <span>Name</span>
              <span>Size</span>
              <span>Modified</span>
              {showRichMeta && <span>Type</span>}
            </div>
            {band.entries.map((entry) => renderAdaptiveSemanticEntry(entry, adaptiveDensityStop, { dominant: band.dominant }))}
          </div>
        </section>
      );
    }

    const gridMetrics = adaptiveDensityStop.grid!;
    const bandMinWidth = band.dominant ? Math.round(gridMetrics.minWidth * 1.12) : gridMetrics.minWidth;
    return (
      <section
        key={band.id}
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: `0 ${gridMetrics.padding}px`, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: band.dominant ? accent : EXP.muted2 }}>
              {band.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: EXP.muted, maxWidth: 420 }}>
              {band.description}
            </div>
          </div>
          <div style={{ fontSize: 10, color: EXP.muted2 }}>{band.entries.length} items</div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${bandMinWidth}px, 1fr))`,
            gap: gridMetrics.gap,
            padding: `0 ${gridMetrics.padding}px`,
            alignItems: 'stretch',
          }}
        >
          {band.entries.map((entry) => renderAdaptiveSemanticEntry(entry, adaptiveDensityStop, { dominant: band.dominant }))}
        </div>
      </section>
    );
  };

  const renderConstellationOrbitBand = (band: ConstellationOrbitBand) => {
    const fieldHeight = band.dominant
      ? Math.round(258 + Math.min(92, band.nodes.length * 7) + experimentalDensity * 40)
      : Math.round(220 + Math.min(74, band.nodes.length * 6) + experimentalDensity * 32);
    return (
      <section
        key={band.id}
        style={{ marginBottom: 22 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '0 14px', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: band.dominant ? accent : EXP.muted2 }}>
              {band.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: EXP.muted, maxWidth: 460 }}>
              {band.description}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: EXP.muted2, fontSize: 10 }}>
            <span>{band.entries.length} stars</span>
            {band.hiddenEntryCount > 0 && (
              <span style={{ color: accent }}>+{band.hiddenEntryCount} hidden by density</span>
            )}
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            minHeight: fieldHeight,
            margin: '0 14px',
            borderRadius: 22,
            border: '1px solid var(--overlay-explorer-toolbar-border)',
            background: 'linear-gradient(180deg, color-mix(in srgb, var(--overlay-accent) 10%, transparent), rgba(9, 12, 18, 0.82))',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <defs>
              <radialGradient id={`explorer-constellation-core-${band.id}`}>
                <stop offset="0%" stopColor={accent} stopOpacity="0.26" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill={`url(#explorer-constellation-core-${band.id})`} />
            {band.nodes.map((node) => (
              <line
                key={`line-${node.entry.path}`}
                x1="50"
                y1="50"
                x2={node.x}
                y2={node.y}
                stroke={node.emphasis === 'selected' ? accent : 'rgba(255,255,255,0.18)'}
                strokeOpacity={node.emphasis === 'satellite' ? 0.42 : 0.82}
                strokeWidth={node.emphasis === 'anchor' ? 0.55 : 0.35}
              />
            ))}
            <circle cx="50" cy="50" r="8.5" fill={accent} fillOpacity="0.12" stroke={accent} strokeOpacity="0.44" />
            <circle cx="50" cy="50" r="2.2" fill={accent} fillOpacity="0.88" />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 184,
              maxWidth: 'calc(100% - 64px)',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10, 12, 18, 0.76)',
              backdropFilter: explorerBlurEnabled ? 'blur(12px)' : 'none',
              WebkitBackdropFilter: explorerBlurEnabled ? 'blur(12px)' : 'none',
              padding: '14px 16px',
              textAlign: 'center',
              boxShadow: '0 16px 34px rgba(0,0,0,0.22)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent }}>
              Orbit Map
            </div>
            <div style={{ marginTop: 6, fontSize: 14, fontWeight: 650, color: EXP.text }}>
              {band.label}
            </div>
            <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.45, color: EXP.muted }}>
              {band.description}
            </div>
          </div>
          {band.nodes.map((node) => {
            const isSel = selected.has(node.entry.path);
            const isDrop = dragOver === node.entry.path && node.entry.is_dir;
            const isRenaming = rename.active && rename.path === node.entry.path;
            const iconSrc = getRenderableIconSrc(node.entry, isSel || isDrop);
            const highlightBackground = node.emphasis === 'anchor'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))'
              : 'var(--overlay-explorer-chip-bg)';
            return (
              <div
                key={node.entry.path}
                draggable
                data-overlay-constellation-band={band.id}
                data-overlay-constellation-node={node.entry.path}
                data-overlay-constellation-emphasis={node.emphasis}
                data-overlay-drag-source="file"
                onDragStart={e => onDragStart(e, node.entry)}
                onDragEnd={onDragEnd}
                onDragOver={node.entry.is_dir ? e => onDragOver(e, node.entry.path) : undefined}
                onDragLeave={() => setDragOver(null)}
                onDrop={node.entry.is_dir ? e => onDrop(e, node.entry.path) : undefined}
                onClick={e => onEntryClick(e, node.entry)}
                onDoubleClick={() => onEntryDoubleClick(node.entry)}
                onContextMenu={e => onRightClick(e, node.entry)}
                title={node.entry.path}
                style={{
                  position: 'absolute',
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: `translate(-50%, -50%) ${isDrop ? dropEntrySurface.transform : isSel ? selectedEntrySurface.transform : idleEntrySurface.transform}`,
                  minWidth: node.labelVisible ? Math.max(88, node.size + 42) : node.size + 18,
                  maxWidth: 172,
                  minHeight: node.size + 14,
                  borderRadius: 999,
                  border: `1px solid ${isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : node.emphasis === 'anchor' ? `${accent}55` : 'var(--overlay-explorer-chip-border)'}`,
                  background: isDrop
                    ? dropEntrySurface.background
                    : isSel
                      ? selectedEntrySurface.background
                      : highlightBackground,
                  boxShadow: isDrop
                    ? dropEntrySurface.boxShadow
                    : isSel
                      ? selectedEntrySurface.boxShadow
                      : node.emphasis === 'anchor'
                        ? `0 12px 26px ${accent}18`
                        : '0 8px 16px rgba(0,0,0,0.14)',
                  color: EXP.text,
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: node.labelVisible ? '8px 12px' : '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
                onMouseEnter={e => {
                  if (!isSel && !isDrop) {
                    applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, hoverEntrySurface);
                    e.currentTarget.style.transform = `translate(-50%, -50%) ${hoverEntrySurface.transform}`;
                  }
                }}
                onMouseLeave={e => {
                  if (!isSel && !isDrop) {
                    applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, idleEntrySurface);
                    e.currentTarget.style.transform = `translate(-50%, -50%) ${idleEntrySurface.transform}`;
                    e.currentTarget.style.background = highlightBackground;
                    e.currentTarget.style.borderColor = node.emphasis === 'anchor'
                      ? `${accent}55`
                      : 'var(--overlay-explorer-chip-border)';
                    e.currentTarget.style.boxShadow = node.emphasis === 'anchor'
                      ? `0 12px 26px ${accent}18`
                      : '0 8px 16px rgba(0,0,0,0.14)';
                  }
                }}
              >
                <div
                  style={{
                    width: node.size,
                    height: node.size,
                    minWidth: node.size,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <SvgIcon src={iconSrc} size={Math.max(14, node.size - 12)} />
                </div>
                {node.labelVisible && (
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {isRenaming
                      ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
                      : (
                        <>
                          <div style={{ color: isSel ? EXP.text : node.entry.is_dir ? EXP.yellow : EXP.text, fontWeight: node.entry.is_dir ? 650 : 560, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {node.entry.name}
                          </div>
                          <div style={{ marginTop: 3, fontSize: 10, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getEntryTypeLabel(node.entry)}
                          </div>
                        </>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderTimelineSurfaceEntry = (entry: FileEntry) => {
    const isSel = selected.has(entry.path);
    const isDrop = dragOver === entry.path && entry.is_dir;
    const isRenaming = rename.active && rename.path === entry.path;
    const iconSrc = getRenderableIconSrc(entry, isSel || isDrop);
    return (
      <div
        key={entry.path}
        draggable
        data-overlay-drag-source="file"
        onDragStart={e => onDragStart(e, entry)}
        onDragEnd={onDragEnd}
        onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
        onDragLeave={() => setDragOver(null)}
        onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
        onClick={e => onEntryClick(e, entry)}
        onDoubleClick={() => onEntryDoubleClick(entry)}
        onContextMenu={e => onRightClick(e, entry)}
        title={entry.path}
        style={{
          borderRadius: 18,
          border: `1px solid ${isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : 'var(--overlay-explorer-chip-border)'}`,
          background: isDrop ? dropEntrySurface.background : isSel ? selectedEntrySurface.background : 'var(--overlay-explorer-chip-bg)',
          boxShadow: isDrop ? dropEntrySurface.boxShadow : isSel ? selectedEntrySurface.boxShadow : '0 10px 24px rgba(0,0,0,0.12)',
          padding: '12px 14px',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 12,
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 92,
        }}
        onMouseEnter={e => {
          if (!isSel && !isDrop) {
            applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, hoverEntrySurface);
          }
        }}
        onMouseLeave={e => {
          if (!isSel && !isDrop) {
            applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, idleEntrySurface);
            e.currentTarget.style.background = 'var(--overlay-explorer-chip-bg)';
            e.currentTarget.style.borderColor = 'var(--overlay-explorer-chip-border)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.12)';
          }
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          <SvgIcon src={iconSrc} size={24} />
        </div>
        <div style={{ minWidth: 0 }}>
          {isRenaming
            ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
            : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: isSel ? EXP.text : entry.is_dir ? EXP.yellow : EXP.text, fontWeight: entry.is_dir ? 650 : 560, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {renderEntryInlineMeta(entry)}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {entry.modified ? formatDate(entry.modified) : 'Undated'}
                  </div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: EXP.muted2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {getEntryTypeLabel(entry)}
                  </span>
                  {entry.is_symlink && (
                    <span style={{ fontSize: 9, color: EXP.muted, background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '2px 7px' }}>
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
    const timelineColumnWidth = Math.max(220, Math.round(332 - experimentalDensity * 120));
    return (
      <section
        key={band.id}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(120px, 156px) minmax(0, 1fr)',
          gap: 18,
          marginBottom: 24,
          padding: '0 14px',
        }}
      >
        <div style={{ position: 'relative', paddingLeft: 14 }}>
          <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 2, borderRadius: 999, background: band.dominant ? accent : 'rgba(255,255,255,0.10)' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: band.dominant ? accent : EXP.muted2 }}>
            {band.label}
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: EXP.muted, lineHeight: 1.45 }}>
            {band.description}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: EXP.muted2 }}>
            {band.entries.length} items
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${timelineColumnWidth}px, 1fr))`,
            gap: 12,
            alignItems: 'stretch',
          }}
        >
          {band.entries.map(renderTimelineSurfaceEntry)}
        </div>
      </section>
    );
  };

  return (
    <div
      data-overlay-explorer
      data-overlay-explorer-view-mode={effectiveViewMode}
      data-overlay-explorer-experimental-mode={effectiveExperimentalViewMode}
      style={explorerRootStyle}
      onClick={() => { setSelected(new Set()); setCtxMenu(c => ({...c, visible:false})); }}
      onContextMenu={e => {
        const target = e.target instanceof HTMLElement ? e.target : null;
        if (target?.closest('input, textarea, button, a, [contenteditable="true"], [role="button"]')) {
          return;
        }
        e.preventDefault();
        setSelected(new Set());
        setCtxMenu({ visible:true, x:e.clientX, y:e.clientY, entry:null });
      }}
    >
      {/* ══ SIDEBAR ══ */}
      {shouldRenderRail && (
        <div data-overlay-explorer-plane="rail" style={{ display: 'flex', minHeight: 0, minWidth: 0 }}>
          <ResizablePane
            size={sidebarWidth}
            minSize={sidebarBounds.minWidth}
            maxSize={sidebarBounds.maxWidth}
            onSizeChange={setSidebarWidth}
            borderColor={`${accent}55`}
            handleSide={effectiveRailPosition === 'right' ? 'left' : 'right'}
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
              onOpenSavedSearch={(savedSearch) => { void applySavedSearch(savedSearch); }}
              onDeleteSavedSearch={(savedSearchId) => {
                void deleteExplorerSavedSearch(savedSearchId)
                  .then(() => setSavedSearches((current) => current.filter((savedSearch) => savedSearch.id !== savedSearchId)))
                  .catch((deleteError) => setError(String(deleteError)));
              }}
              onToggleTagFilter={(tagId) => setActiveTagFilterIds((current) => (
                current.includes(tagId)
                  ? current.filter((candidate) => candidate !== tagId)
                  : [...current, tagId]
              ))}
              onClearTagFilters={() => setActiveTagFilterIds([])}
              onBookmarkCreated={handleBookmarkCreated}
              resolveDroppedSources={resolveDroppedBookmarkSources}
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
        <div data-overlay-explorer-plane="toolbar" style={toolbarContainerStyle}>
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
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'var(--overlay-explorer-chip-active-bg)',
              borderBottom: '1px solid var(--overlay-explorer-toolbar-border)',
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent }}>
                Repository Picker
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: EXP.muted }}>
                Select {repositoryPicker.allowMultiple ? 'one or more folders' : 'a folder'} in Explorer, then confirm them into Source Control.
                {selectedDirectoryEntries.length > 0
                  ? ` ${selectedDirectoryEntries.length} folder${selectedDirectoryEntries.length !== 1 ? 's' : ''} selected.`
                  : isRepositoryPickerUsingCurrentPath
                    ? ' No folders selected yet, so OverlayTerm can add the current folder directly.'
                  : ' Only directories can be added.'}
              </div>
              {isRepositoryPickerUsingCurrentPath ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: EXP.muted,
                    fontFamily: appearance?.fonts.mono ?? 'var(--overlay-font-mono, "Cascadia Code", Consolas, monospace)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={locationTitle}
                >
                  Current folder: {locationTitle}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => repositoryPicker.onConfirm(repositoryPickerConfirmationPaths)}
              disabled={!canConfirmRepositorySelection}
              style={{
                minHeight: 30,
                padding: '0 12px',
                borderRadius: 'var(--overlay-explorer-control-radius)',
                border: `1px solid ${canConfirmRepositorySelection ? accent : EXP.border}`,
                background: canConfirmRepositorySelection ? accent : 'var(--overlay-explorer-chip-bg)',
                color: canConfirmRepositorySelection ? '#fff' : EXP.muted,
                cursor: canConfirmRepositorySelection ? 'pointer' : 'default',
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
                padding: '0 12px',
                borderRadius: 'var(--overlay-explorer-control-radius)',
                border: '1px solid var(--overlay-explorer-chip-border)',
                background: 'var(--overlay-explorer-chip-bg)',
                color: EXP.text,
                cursor: 'pointer',
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
          <div style={{ background:'rgba(248,113,113,0.12)', borderBottom:`1px solid rgba(248,113,113,0.3)`, padding:'6px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ color:EXP.red, fontSize:11 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background:'none', border:'none', cursor:'pointer', color:EXP.red }}><X size={12}/></button>
          </div>
        )}

        {/* File area + preview */}
        <div data-overlay-explorer-plane="file-area" style={fileAreaStyle}>
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            viewportStyle={{ padding: 0 }}
            viewportRef={explorerViewportRef}
          >
          <div
            ref={mainRef}
            data-overlay-explorer-plane="content-viewport"
            tabIndex={0}
            style={{ minHeight: '100%', outline:'none', background:'var(--overlay-explorer-content-bg)' }}
            onClick={() => mainRef.current?.focus()}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = resolveExplorerDropOperation(e, runtimePlatform);
              setDragOver('__main__');
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => onDrop(e, currentPath)}
            onContextMenu={e => {
              if (e.target !== e.currentTarget) return;
              e.preventDefault();
              e.stopPropagation();
              setCtxMenu({ visible:true, x:e.clientX, y:e.clientY, entry:null });
            }}
          >
            {windowDropState.active && (
              <div style={{
                position:'sticky',
                top:12,
                zIndex:5,
                margin:'0 auto 12px',
                width:'min(420px, calc(100% - 24px))',
                border:`1px solid ${accent}`,
                borderRadius:10,
                background:`linear-gradient(180deg, ${accent}20, rgba(16,18,26,0.92))`,
                boxShadow:'0 18px 48px rgba(0,0,0,0.35)',
                padding:'14px 16px',
                textAlign:'center',
              }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:accent }}>
                  Import Files
                </div>
                <div style={{ marginTop:6, fontSize:13, fontWeight:600, color:EXP.text }}>
                  Drop {windowDropState.count} item{windowDropState.count === 1 ? '' : 's'} to copy into this folder
                </div>
                <div style={{ marginTop:4, fontSize:11, color:EXP.muted }}>
                  External files are handled through the Rust transfer pipeline.
                </div>
              </div>
            )}

            {loading && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, gap:10, color:EXP.muted }}>
                <Loader size={16} style={{ animation:'spin 1s linear infinite' }} />
                <span style={{ fontSize:12 }}>Loading…</span>
              </div>
            )}

            {!loading && searchLoading && isSearchActive && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, gap:10, color:EXP.muted }}>
                <Loader size={16} style={{ animation:'spin 1s linear infinite' }} />
                <span style={{ fontSize:12 }}>Searching recursively…</span>
              </div>
            )}

            {!loading && !searchLoading && visibleEntries.length === 0 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, color:EXP.muted, fontSize:12, textAlign:'center', padding: '0 16px' }}>
                {isSearchActive
                  ? (
                    <span>
                      No results for "{search.trim()}"<br />
                      <span style={{ color: EXP.muted2, fontSize: 11 }}>
                        {searchIncludeContent ? 'Recursive text search is on.' : 'Names-only search is on.'}
                      </span>
                    </span>
                  )
                  : 'Empty folder'}
              </div>
            )}

            {!loading && effectiveExperimentalViewMode === 'adaptive-semantic-grid' && adaptiveDensityStop && (
              <div style={{ minHeight: 0, padding: '14px 0 20px' }}>
                {renderExperimentalInlineNewItem(
                  adaptiveDensityStop.presentation === 'table'
                    ? adaptiveDensityStop.table?.iconSize ?? 18
                    : adaptiveDensityStop.grid?.iconSize ?? 34,
                )}

                <div style={{ padding: '0 14px 16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 'var(--overlay-explorer-panel-radius)',
                      border: '1px solid var(--overlay-explorer-toolbar-border)',
                      background: 'var(--overlay-explorer-toolbar-bg)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent }}>
                        Adaptive Semantic Grid
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: EXP.text, fontWeight: 600 }}>
                        {adaptiveDensityStop.label}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: EXP.muted, maxWidth: 520 }}>
                        {adaptiveDensityStop.description}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: EXP.muted2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {selectedExperimentalModeDefinition?.densityAxisLabel ?? 'Density'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>
                        {experimentalDensityPercent ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {experimentalSemanticBands.map(renderAdaptiveSemanticBand)}
              </div>
            )}

            {!loading && effectiveExperimentalViewMode === 'constellation' && (
              <div style={{ minHeight: 0, padding: '14px 0 24px' }}>
                {renderExperimentalInlineNewItem(26)}
                <div style={{ padding: '0 14px 18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 20,
                      border: '1px solid var(--overlay-explorer-toolbar-border)',
                      background: 'linear-gradient(180deg, color-mix(in srgb, var(--overlay-accent) 14%, transparent), var(--overlay-explorer-toolbar-bg))',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent }}>
                        Constellation View
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: EXP.text, fontWeight: 600 }}>
                        {experimentalDensityDescriptor?.label ?? 'Orbit'}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: EXP.muted, maxWidth: 520 }}>
                        {experimentalDensityDescriptor?.description ?? 'Cluster files by relationship and navigate the orbit field.'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: EXP.muted2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {selectedExperimentalModeDefinition?.densityAxisLabel ?? 'Link Density'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>
                        {experimentalDensityPercent ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>
                {constellationOrbitBands.map(renderConstellationOrbitBand)}
              </div>
            )}

            {!loading && effectiveExperimentalViewMode === 'timeline-surface' && (
              <div style={{ minHeight: 0, padding: '14px 0 24px' }}>
                {renderExperimentalInlineNewItem(22)}
                <div style={{ padding: '0 14px 18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 20,
                      border: '1px solid var(--overlay-explorer-toolbar-border)',
                      background: 'linear-gradient(180deg, color-mix(in srgb, var(--overlay-accent) 10%, transparent), var(--overlay-explorer-toolbar-bg))',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent }}>
                        Timeline Surface
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: EXP.text, fontWeight: 600 }}>
                        {experimentalDensityDescriptor?.label ?? 'Months'}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: EXP.muted, maxWidth: 520 }}>
                        {experimentalDensityDescriptor?.description ?? 'Browse folders and files as time-banded activity surfaces.'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: EXP.muted2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {selectedExperimentalModeDefinition?.densityAxisLabel ?? 'Granularity'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>
                        {experimentalDensityPercent ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>
                {timelineSurfaceBands.map(renderTimelineSurfaceBand)}
              </div>
            )}

            {/* Grid view */}
            {effectiveExperimentalViewMode === 'off' && newItem.visible && virtualWindow.kind === 'grid' && activeGridMetrics && (
              <div style={{ padding: `0 ${activeGridMetrics.padding}px ${activeGridMetrics.padding}px`, boxSizing: 'border-box' }}>
                <div
                  style={{
                    background: 'var(--overlay-explorer-item-selected-bg)',
                    border: '1px solid var(--overlay-explorer-item-selected-border)',
                    borderRadius: activeGridMetrics.tileRadius,
                    padding: activeGridMetrics.iconSize <= 46 ? '8px 6px 6px' : '10px 8px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    height: activeGridMetrics.newItemHeight,
                    boxSizing: 'border-box',
                    transition: 'border-radius 0.18s cubic-bezier(0.22, 1, 0.36, 1), padding 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <SvgIcon
                    src={newItem.kind === 'folder'
                      ? (resolveIconSrc(themeIconTheme.folder, themeIconTheme) ?? '/icons/folder.svg')
                      : resolveFileIconSrc('new-file.txt', 'txt', themeIconTheme)}
                    size={activeGridMetrics.iconSize}
                  />
                  <input
                    autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') setNewItem({ visible: false, kind: 'folder' }); }}
                    onBlur={commitNew}
                    placeholder={newItem.kind === 'folder' ? 'folder name' : 'name.ext'}
                    style={{ background: 'var(--overlay-explorer-input-bg)', border: '1px solid var(--overlay-explorer-input-border)', borderRadius: 'var(--overlay-explorer-control-radius)', color: EXP.text, fontSize: 11, padding: '2px 6px', outline: 'none', width: '100%', boxSizing: 'border-box' as const }}
                  />
                </div>
              </div>
            )}

            {effectiveExperimentalViewMode === 'off' && !loading && virtualWindow.kind === 'grid' && activeGridMetrics && (
              <div style={{ minHeight: 0 }}>
                <div style={{ height: virtualWindow.topSpacer }} />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${virtualWindow.columns}, minmax(0, 1fr))`,
                    gridAutoRows: `${virtualWindow.rowHeight}px`,
                    gap: activeGridMetrics.gap,
                    padding: `0 ${activeGridMetrics.padding}px`,
                    alignItems: 'stretch',
                    transition: 'gap 0.14s ease, padding 0.14s ease',
                  }}
                >
                  {virtualizedEntries.map(entry => {
                    const isSel = selected.has(entry.path);
                    const isDrop = dragOver === entry.path && entry.is_dir;
                    const isRenaming = rename.active && rename.path === entry.path;
                    const iconSrc = getRenderableIconSrc(entry, isSel || isDrop);
                    const thumbnailSrc = getGridEntryThumbnailSrc(entry);
                    return (
                      <div
                        key={entry.path}
                        draggable
                        data-overlay-drag-source="file"
                        onDragStart={e => onDragStart(e, entry)}
                        onDragEnd={onDragEnd}
                        onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
                        onClick={e => onEntryClick(e, entry)}
                        onDoubleClick={() => onEntryDoubleClick(entry)}
                        onContextMenu={e => onRightClick(e, entry)}
                        title={getSearchTooltip(entry)}
                        style={{
                          background: isDrop ? dropEntrySurface.background : isSel ? selectedEntrySurface.background : idleEntrySurface.background,
                          border: `1px solid ${isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : idleEntrySurface.borderColor}`,
                          borderRadius: activeGridMetrics.tileRadius,
                          padding: activeGridMetrics.iconSize <= 46 ? '8px 6px 6px' : '10px 8px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 8,
                          height: '100%',
                          minHeight: 0,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          opacity: entry.is_hidden ? 0.5 : 1,
                          userSelect: 'none',
                          boxShadow: isDrop ? dropEntrySurface.boxShadow : isSel ? selectedEntrySurface.boxShadow : idleEntrySurface.boxShadow,
                          transform: isDrop ? dropEntrySurface.transform : isSel ? selectedEntrySurface.transform : idleEntrySurface.transform,
                          transition: 'background 0.14s ease, border-color 0.14s ease, transform 0.14s ease, border-radius 0.18s cubic-bezier(0.22, 1, 0.36, 1), padding 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                        onMouseEnter={e => {
                          if (!isSel && !isDrop) {
                            applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, hoverEntrySurface);
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSel && !isDrop) {
                            applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, idleEntrySurface);
                          }
                        }}
                      >
                        <div
                          style={{
                            width: activeGridMetrics.iconStageSize,
                            height: activeGridMetrics.iconStageSize,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0,
                            borderRadius: thumbnailSrc ? Math.max(10, Math.round(activeGridMetrics.tileRadius * 0.72)) : undefined,
                            border: thumbnailSrc ? '1px solid color-mix(in srgb, var(--overlay-border-strong) 42%, transparent)' : undefined,
                            background: thumbnailSrc
                              ? (isSel
                                  ? 'color-mix(in srgb, var(--overlay-bg-selection) 72%, var(--overlay-bg-panel))'
                                  : 'color-mix(in srgb, var(--overlay-bg-panel) 86%, transparent)')
                              : undefined,
                            boxShadow: thumbnailSrc ? 'inset 0 1px 0 color-mix(in srgb, white 8%, transparent)' : undefined,
                            transition: 'width 0.18s cubic-bezier(0.22, 1, 0.36, 1), height 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        >
                          {thumbnailSrc ? (
                            <img
                              src={thumbnailSrc}
                              alt={`Thumbnail for ${entry.name}`}
                              draggable={false}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <SvgIcon src={iconSrc} size={activeGridMetrics.iconSize} />
                          )}
                        </div>
                        {isRenaming
                          ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
                          : (
                            <span
                              style={{
                                fontSize: 'var(--overlay-explorer-entry-title-size)',
                                textAlign: explorerTheme.labelMode === 'inline' ? 'left' : 'center',
                                color: EXP.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: activeGridMetrics.nameLines,
                                WebkitBoxOrient: 'vertical',
                                width: '100%',
                                lineHeight: 1.28,
                                fontWeight: 'var(--overlay-explorer-entry-title-weight)',
                                letterSpacing: 'var(--overlay-explorer-label-spacing)',
                              }}
                            >
                              {entry.name}
                            </span>
                          )
                        }
                        <span style={{ fontSize: 'var(--overlay-explorer-entry-meta-size)', textAlign: explorerTheme.labelMode === 'inline' ? 'left' : 'center', color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', marginTop: -2 }}>
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

            {effectiveExperimentalViewMode === 'off' && newItem.visible && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'list' && (
              <div
                style={{
                  height: activeRowMetrics?.newItemHeight ?? 42,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 12px',
                  borderBottom: '1px solid var(--overlay-explorer-toolbar-border)',
                  background: 'var(--overlay-explorer-item-selected-bg)',
                }}
              >
                <SvgIcon
                  src={newItem.kind === 'folder'
                    ? getIconSrc({ name: 'folder', path: currentPath, is_dir: true, size: 0, modified: 0, extension: '', is_hidden: false, is_symlink: false }, false, {
                      rules: explorerSettings.folderIconRules,
                      defaultIcon: explorerSettings.defaultFolderIcon,
                    }, themeIconTheme)
                    : resolveFileIconSrc('new-file.txt', 'txt', themeIconTheme)}
                  size={activeRowMetrics?.iconSize ?? 16}
                />
                <input
                  autoFocus
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') setNewItem({ visible: false, kind: 'folder' }); }}
                  onBlur={commitNew}
                  placeholder={newItem.kind === 'folder' ? 'folder name' : 'notes.md / app.py'}
                  style={{ background: 'var(--overlay-explorer-input-bg)', border: '1px solid var(--overlay-explorer-input-border)', borderRadius: 'var(--overlay-explorer-control-radius)', color: EXP.text, fontSize: 12, padding: '2px 6px', outline: 'none', flex: 1 }}
                />
              </div>
            )}

            {effectiveExperimentalViewMode === 'off' && !loading && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'list' && (
              <div style={{ minHeight: 0 }}>
                <div style={{ height: virtualWindow.topSpacer }} />
                {virtualizedEntries.map(entry => {
                  const isSel = selected.has(entry.path);
                  const isDrop = dragOver === entry.path && entry.is_dir;
                  const isRenaming = rename.active && rename.path === entry.path;
                  const iconSrc = getRenderableIconSrc(entry, isSel || isDrop);
                  return (
                    <div
                      key={entry.path}
                      draggable
                      data-overlay-drag-source="file"
                      onDragStart={e => onDragStart(e, entry)}
                      onDragEnd={onDragEnd}
                      onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
                      onClick={e => onEntryClick(e, entry)}
                      onDoubleClick={() => onEntryDoubleClick(entry)}
                      onContextMenu={e => onRightClick(e, entry)}
                      title={getSearchTooltip(entry)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        minHeight: virtualWindow.rowHeight,
                        padding: '0 12px',
                        borderBottomWidth: 1,
                        borderBottomStyle: 'solid',
                        borderBottomColor: isDrop ? dropEntrySurface.borderColor : isSel ? selectedEntrySurface.borderColor : 'var(--overlay-explorer-toolbar-border)',
                        background: isDrop ? dropEntrySurface.background : isSel ? selectedEntrySurface.background : idleEntrySurface.background,
                        cursor: 'pointer',
                        opacity: entry.is_hidden ? 0.5 : 1,
                        userSelect: 'none',
                        boxShadow: isDrop ? dropEntrySurface.boxShadow : isSel ? selectedEntrySurface.boxShadow : idleEntrySurface.boxShadow,
                        transform: isDrop ? dropEntrySurface.transform : isSel ? selectedEntrySurface.transform : idleEntrySurface.transform,
                      }}
                      onMouseEnter={e => { if (!isSel && !isDrop) applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, hoverEntrySurface); }}
                      onMouseLeave={e => { if (!isSel && !isDrop) applyExplorerEntrySurface(e.currentTarget as HTMLDivElement, idleEntrySurface); }}
                    >
                      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <SvgIcon src={iconSrc} size={activeRowMetrics?.iconSize ?? 16} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          {isRenaming
                            ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
                            : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span style={{ color: isSel ? EXP.text : entry.is_dir ? EXP.yellow : EXP.text, fontWeight: entry.is_dir ? 600 : 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                                  {entry.name}
                                </span>
                                {entry.is_symlink && <span style={{ fontSize: 9, color: EXP.muted, background: 'var(--overlay-explorer-chip-bg)', borderRadius: 'var(--overlay-explorer-control-radius)', padding: '1px 4px', flexShrink: 0 }}>symlink</span>}
                              </div>
                            )}
                          <div style={{ marginTop: 2, fontSize: 10, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {renderEntryInlineMeta(entry)}
                          </div>
                          {renderSearchMetadata(entry)}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, fontSize: 10, color: EXP.muted, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {getEntryTypeLabel(entry)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ height: virtualWindow.bottomSpacer }} />
              </div>
            )}

            {effectiveExperimentalViewMode === 'off' && newItem.visible && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'table' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  <tr style={{ background: 'var(--overlay-explorer-item-selected-bg)', borderBottom: '1px solid var(--overlay-explorer-toolbar-border)', height: activeRowMetrics?.newItemHeight ?? 42 }}>
                    <td style={{ padding: '4px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SvgIcon src={newItem.kind === 'folder' ? getIconSrc({ name: 'folder', path: currentPath, is_dir: true, size: 0, modified: 0, extension: '', is_hidden: false, is_symlink: false }, false, {
                          rules: explorerSettings.folderIconRules,
                          defaultIcon: explorerSettings.defaultFolderIcon,
                        }, themeIconTheme) : resolveFileIconSrc('new-file.txt', 'txt', themeIconTheme)} size={activeRowMetrics?.iconSize ?? 16} />
                        <input autoFocus value={newItemName} onChange={e => setNewItemName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') setNewItem({ visible: false, kind: 'folder' }); }}
                          onBlur={commitNew}
                          placeholder={newItem.kind === 'folder' ? 'folder name' : 'notes.md / app.py'}
                          style={{ background: 'var(--overlay-explorer-input-bg)', border: '1px solid var(--overlay-explorer-input-border)', borderRadius: 'var(--overlay-explorer-control-radius)', color: EXP.text, fontSize: 12, padding: '2px 6px', outline: 'none', flex: 1 }}
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

            {effectiveExperimentalViewMode === 'off' && !loading && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'table' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: 'var(--overlay-explorer-toolbar-bg)', position: 'sticky', top: 0, zIndex: 2 }}>
                    {[
                      { key: 'name', label: 'Name' },
                      { key: 'size', label: 'Size' },
                      { key: 'date', label: 'Modified' },
                      { key: 'type', label: 'Type' },
                    ].map(column => (
                      <th key={column.key} style={{ padding: '6px 12px', textAlign: 'left', color: EXP.muted, fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid var(--overlay-explorer-toolbar-border)' }}>
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key as ExplorerSortKey)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: explorerSettings.sortBy === column.key ? EXP.text : EXP.muted,
                            cursor: 'pointer',
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}
                        >
                          <span>{column.label}</span>
                          <span style={{ color: explorerSettings.sortBy === column.key ? accent : EXP.muted2 }}>
                            {explorerSettings.sortBy === column.key
                              ? explorerSettings.sortOrder === 'asc' ? '↑' : '↓'
                              : '·'}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ height: virtualWindow.topSpacer }}>
                    <td colSpan={4} style={{ padding: 0, border: 'none' }} />
                  </tr>
                  {virtualizedEntries.map(entry => {
                    const isSel = selected.has(entry.path);
                    const isDrop = dragOver === entry.path && entry.is_dir;
                    const isRenaming = rename.active && rename.path === entry.path;
                    const iconSrc = getRenderableIconSrc(entry, isSel || isDrop);
                    const isDetailsMode = effectiveViewMode === 'details';
                    return (
                      <tr
                        key={entry.path}
                        draggable
                        data-overlay-drag-source="file"
                        onDragStart={e => onDragStart(e, entry)}
                        onDragEnd={onDragEnd}
                        onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
                        onClick={e => onEntryClick(e, entry)}
                        onDoubleClick={() => onEntryDoubleClick(entry)}
                        onContextMenu={e => onRightClick(e, entry)}
                        title={getSearchTooltip(entry)}
                        style={{ background: isDrop ? dropEntrySurface.background : isSel ? selectedEntrySurface.background : idleEntrySurface.background, cursor: 'pointer', opacity: entry.is_hidden ? 0.5 : 1, userSelect: 'none', borderBottom: '1px solid var(--overlay-explorer-toolbar-border)', height: virtualWindow.rowHeight, boxShadow: isDrop ? dropEntrySurface.boxShadow : isSel ? selectedEntrySurface.boxShadow : idleEntrySurface.boxShadow, transform: isDrop ? dropEntrySurface.transform : isSel ? selectedEntrySurface.transform : idleEntrySurface.transform }}
                        onMouseEnter={e => { if (!isSel && !isDrop) applyExplorerEntrySurface(e.currentTarget as HTMLTableRowElement, hoverEntrySurface); }}
                        onMouseLeave={e => { if (!isSel && !isDrop) applyExplorerEntrySurface(e.currentTarget as HTMLTableRowElement, idleEntrySurface); }}
                      >
                        <td style={{ padding: isDetailsMode ? '6px 12px' : '4px 12px', verticalAlign: 'top', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                            <SvgIcon src={iconSrc} size={activeRowMetrics?.iconSize ?? 16} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              {isRenaming
                                ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
                                : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span style={{ color: isSel ? EXP.text : entry.is_dir ? EXP.yellow : EXP.text, fontWeight: entry.is_dir ? 600 : isDetailsMode ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                                      {entry.name}
                                    </span>
                                    {entry.is_symlink && <span style={{ fontSize: 9, color: EXP.muted, background: 'var(--overlay-explorer-chip-bg)', borderRadius: 'var(--overlay-explorer-control-radius)', padding: '1px 4px', flexShrink: 0 }}>symlink</span>}
                                  </div>
                                )}
                              {isDetailsMode && !isRenaming && (
                                <div style={{ marginTop: 2, fontSize: 10, color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {renderEntryInlineMeta(entry)}
                                </div>
                              )}
                              {renderSearchMetadata(entry)}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: isDetailsMode ? '6px 12px' : '4px 12px', color: EXP.muted, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getEntryStorageLabel(entry)}</td>
                        <td style={{ padding: isDetailsMode ? '6px 12px' : '4px 12px', color: EXP.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDate(entry.modified)}</td>
                        <td style={{ padding: isDetailsMode ? '6px 12px' : '4px 12px', color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEntryTypeLabel(entry)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ height: virtualWindow.bottomSpacer }}>
                    <td colSpan={4} style={{ padding: 0, border: 'none' }} />
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          </OverlayScrollArea>

          {/* Side pane */}
          {hasPreview && (
            <PreviewPanel
              preview={preview}
              width={previewWidth}
              onWidthChange={setPreviewWidth}
              onTextChange={updatePreviewTextContent}
              onCopyPath={copyToSysClipboard}
              viewMode={documentViewMode}
              onViewModeChange={setDocumentViewMode}
              explorerTheme={explorerTheme}
              blurEnabled={explorerBlurEnabled}
              chromeLayoutId={effectiveChromeLayoutId}
              chromeOverride={explorerChromeOverride}
              chromeEditMode={explorerChromeEditMode}
              onClose={() => { void closePreview(); }}
            />
          )}
        </div>

        {/* Status bar */}
        {shouldRenderStatusBar && (
          <div data-overlay-explorer-plane="status" style={statusBarStyle}>
            <ExplorerChromeSurface
              surface={explorerStatusBarSurface}
              getRowStyle={getExplorerChromeRowStyle}
              getZoneStyle={getExplorerChromeZoneStyle}
              renderControl={renderExplorerChromeControl}
              editMode={explorerChromeEditMode}
            />
          </div>
        )}
      </div>

      {/* Context menu */}
      <ContextMenu state={ctxMenu} items={ctxMenu.entry ? buildCtxItems(ctxMenu.entry) : buildEmptyCtxItems()} onClose={() => setCtxMenu(c => ({...c, visible:false}))} />

      {deleteTargets.length > 0 && (
        <TrashDialog
          entries={deleteTargets}
          onConfirm={() => { void confirmTrash(); }}
          onDeletePermanently={() => { void permanentlyDeleteTargets(); }}
          onCancel={() => setDeleteTargets([])}
        />
      )}

      {saveSearchState.visible && (
        <SaveSearchDialog
          state={saveSearchState}
          onChangeName={(name) => setSaveSearchState((current) => ({ ...current, name }))}
          onConfirm={() => { void saveCurrentSearch(); }}
          onCancel={() => setSaveSearchState({ visible: false, name: '' })}
        />
      )}

      {batchRename.visible && (
        <BatchRenameDialog
          state={batchRename}
          preview={batchRenamePreview}
          onChange={(updates) => setBatchRename((current) => ({ ...current, ...updates }))}
          onConfirm={() => { void commitBatchRename(); }}
          onCancel={() => setBatchRename((current) => ({ ...current, visible: false }))}
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
          onClose={() => setDuplicateFinder({ visible: false, scanId: null, status: null, loading: false })}
          onSelectPath={(path) => {
            const parentPath = path.replace(/[/\\][^/\\]+$/, '');
            if (parentPath && parentPath !== currentPath) {
              void navigate(parentPath).finally(() => setSelected(new Set([path])));
            } else {
              setSelected(new Set([path]));
            }
          }}
          onRevealPath={(path) => { void revealExplorerPath(path).catch((revealError) => setError(String(revealError))); }}
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

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default FileExplorer;
