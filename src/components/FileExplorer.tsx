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
  Suspense, useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useShallow } from 'zustand/react/shallow';
import type { EditorProps as MonacoEditorProps } from '@monaco-editor/react';
import {
  ChevronRight, ChevronLeft, ArrowUp, Search, RefreshCw,
  X, Star, StarOff, Terminal,
  Trash2, Copy, Scissors, Clipboard, Edit3, ExternalLink,
  Shield, Eye, AlertTriangle, Loader, Puzzle,
  FilePlus, FolderPlus, CopyPlus,
} from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import type { OverlayPluginExplorerActionContribution } from '../config/pluginContributions';
import { getExplorerRailWidthBounds } from '../config/explorerRail';
import { getFolderIconSrc } from '../config/folderIcons';
import { getBuiltInIconTheme, resolveFileIconSrc, resolveIconSrc } from '../config/iconTheme';
import type { ExplorerLayoutMode } from '../config/layoutProfiles';
import {
  explorerViewModes,
  getExplorerViewModeDefinition,
  resolveEffectiveExplorerViewMode,
  stepExplorerViewMode,
  type ExplorerViewModeDefinition,
} from '../config/explorerViewModes';
import {
  DEFAULT_NATIVE_ICON_SIZE,
  getNativeIconCacheKey,
  type OverlayNativeIconRequest,
  type OverlayNativeIconResponse,
} from '../config/nativeIcons';
import {
  detectClientPlatform,
  getFallbackExplorerPath,
  getPlatformPathSeparator,
  joinPlatformPath,
  type RuntimePlatform,
} from '../config/platform';
import {
  recordExplorerPerformanceSample,
  type ExplorerPerformanceMetadata,
  type ExplorerPerformanceMetricId,
} from '../config/performanceTelemetry';
import {
  finalizePendingExplorerMetricSamples,
  getRuntimeCachePolicyTelemetryMetadata,
  type FsRuntimeCachePolicy,
  type PendingExplorerMetricSample,
  type RuntimeCachePolicyTelemetryMetadata,
} from '../config/runtimeCachePolicy';
import {
  getExplorerSearchTelemetryMetadata,
  type FileSearchResponse,
} from '../config/searchTelemetry';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ExplorerSideRail } from './explorer/ExplorerSideRail';
import { removeExplorerBookmarksByPath, upsertExplorerBookmark } from './explorer/explorerRailState';
import {
  getRepositoryPickerConfirmLabel,
  resolveRepositoryPickerConfirmationPaths,
} from './explorer/repositoryPickerState';
import { ResizablePane } from './ResizablePane';
import { useExplorerStore, type ExplorerDocumentViewMode } from '../store/explorerStore';
import { useSettingsStore } from '../store/settingsStore';
import { shouldOpenExplorerEntryOnTrigger } from './fileExplorerClickBehavior';
import type { DocumentPreviewKind } from './documentPreview';
import {
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
const EXPLORER_SEARCH_SCOPE = 'primary_file_explorer';
const EXPLORER_LAYOUT_WHEEL_STEP_THROTTLE_MS = 140;

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

interface FileEntry {
  name: string; path: string; is_dir: boolean;
  size: number; modified: number; extension: string;
  is_hidden: boolean; is_symlink: boolean;
}
interface FileSearchResult extends FileEntry {
  relative_path: string;
  snippet: string;
  line_number: number | null;
  match_kind: 'name' | 'content' | 'name_and_content';
}
interface DriveInfo {
  letter: string; label: string;
  total_bytes: number; free_bytes: number; drive_type: string;
}
interface EntryStorageInfo {
  path: string;
  bytes: number;
  is_dir: boolean;
  is_complete: boolean;
}
interface ViewportMetrics {
  scrollTop: number;
  clientHeight: number;
  clientWidth: number;
}
interface ContextMenuState { visible: boolean; x: number; y: number; entry: FileEntry | null; }
interface RenameState    { active: boolean; path: string; name: string; }
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
  | { type: 'model3d'; path: string; format: ModelPreviewFormat; name: string; size: number };
interface NewItemState   { visible: boolean; kind: 'file'|'folder'; }
interface ExplorerClipboard { action:'copy'|'cut'; entries: FileEntry[]; }
interface FileTransferResult { source_path: string; destination_path: string; operation: 'copy' | 'move'; }
type FileTransferOperation = 'copy' | 'move';
type ExplorerDragIntent = 'internal' | 'native-out';
type ExplorerSortKey = 'name' | 'size' | 'date' | 'type';

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

function resolveExplorerDragIntent(event: Pick<React.DragEvent, 'altKey'>): ExplorerDragIntent {
  return event.altKey ? 'native-out' : 'internal';
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
  return /^[A-Za-z]:$/.test(path) ? `${path}\\` : path;
}

function isLikelyExplorerPathInput(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
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
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }}
      onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
      draggable={false}
    />
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface CtxItem { label: string; icon: React.ReactNode; danger?: boolean; divider?: boolean; action: () => void; }

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
      background:'#1a1c25', border:`1px solid ${EXP.border}`,
      borderRadius:8, boxShadow:'0 16px 48px rgba(0,0,0,0.8)',
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
            onMouseEnter={e => (e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.06)')}
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
}: {
  preview: PreviewState;
  width: number;
  onClose: () => void;
  onWidthChange: (width: number) => void;
  onTextChange: (path: string, content: string) => void;
  onCopyPath: (path: string) => void;
  viewMode: ExplorerDocumentViewMode;
  onViewModeChange: (mode: ExplorerDocumentViewMode) => void;
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
      onWidthChange(Math.max(220, Math.min(800, startW.current + delta)));
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
  const copyPathLabel = copiedPath === preview.path ? 'Copied' : 'Copy Path';
  const supportsRenderedPreview = preview.type === 'text' && preview.renderKind !== 'none';

  return (
    <div style={{ width, background:EXP.panel, borderLeft:`1px solid ${EXP.border}`, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', position:'relative' }}>
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
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, padding:'8px 12px 8px 16px', borderBottom:`1px solid ${EXP.border}`, background:EXP.sidebar, flexShrink:0 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:11, color:EXP.text, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {previewTitle}
          </div>
          {preview.type !== 'none' && (
            <div
              title={preview.path}
              style={{ marginTop:2, fontSize:9, color:EXP.muted2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}
            >
              {preview.path}
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {supportsRenderedPreview && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 2, borderRadius: 7, border: `1px solid ${EXP.border}`, background: 'rgba(255,255,255,0.03)' }}>
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
                      borderRadius: 5,
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: active ? EXP.text : EXP.muted,
                      background: active ? `${EXP.accent}22` : 'transparent',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
          {preview.type !== 'none' && (
            <button
              onClick={() => {
                onCopyPath(preview.path);
                setCopiedPath(preview.path);
              }}
              style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:`1px solid ${EXP.border}`, borderRadius:6, cursor:'pointer', color:EXP.muted, padding:'4px 8px', fontSize:10 }}
            >
              <Copy size={11} />
              {copyPathLabel}
            </button>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:EXP.muted, padding:2 }}><X size={13} /></button>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {preview.type === 'image' && preview.content && (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', padding:16, boxSizing:'border-box' }}>
            <img
              src={preview.content}   /* data-URI — always works */
              alt="preview"
              style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:6, boxShadow:'0 4px 24px rgba(0,0,0,0.6)' }}
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
      </div>
      {preview.type === 'text' && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'4px 10px', borderTop:`1px solid ${EXP.border}`, background:EXP.sidebar, fontSize:10, color:EXP.muted }}>
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
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#171a22', color: EXP.muted, fontSize: 11 }}>
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
    <div style={{ width: '100%', height: '100%', background: '#090d12', display: 'grid', placeItems: 'center' }}>
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
      style={{ background:'#1e2130', border:`1px solid ${EXP.accent}`, borderRadius:4, color:EXP.text, fontSize:12, padding:'2px 6px', outline:'none', width:'100%', boxSizing:'border-box' }}
    />
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteDialog({ entry, onConfirm, onCancel }: { entry: FileEntry; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#1a1c25', border:`1px solid ${EXP.border}`, borderRadius:12, padding:24, minWidth:320, boxShadow:'0 24px 64px rgba(0,0,0,0.9)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <AlertTriangle size={18} style={{ color:EXP.red }} />
          <span style={{ color:EXP.text, fontWeight:600, fontSize:14 }}>Delete Permanently</span>
        </div>
        <p style={{ color:EXP.muted, fontSize:12, marginBottom:20, lineHeight:1.5 }}>
          Delete <strong style={{ color:EXP.text }}>{entry.name}</strong>? This cannot be undone.
        </p>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ background:'rgba(255,255,255,0.06)', border:`1px solid ${EXP.border}`, borderRadius:6, color:EXP.text, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ background:'rgba(248,113,113,0.2)', border:`1px solid rgba(248,113,113,0.4)`, borderRadius:6, color:EXP.red, padding:'6px 14px', fontSize:12, cursor:'pointer', fontWeight:600 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main FileExplorer ────────────────────────────────────────────────────────

interface FileExplorerProps {
  theme: { accent: string; bg: string; bgPanel: string; text: string; border: string; textMuted: string };
  appearance?: ResolvedOverlayAppearance;
  onOpenInTerminal: (path: string) => void;
  onAddBookmark: (name: string, path: string) => void;
  pluginActions?: OverlayPluginExplorerActionContribution[];
  layoutMode?: ExplorerLayoutMode;
  repositoryPicker?: {
    active: boolean;
    allowMultiple: boolean;
    requestId: number;
    onConfirm: (paths: string[]) => void;
    onCancel: () => void;
  } | null;
}

export function FileExplorer({
  theme,
  appearance,
  onOpenInTerminal,
  onAddBookmark,
  pluginActions = [],
  layoutMode = 'full',
  repositoryPicker = null,
}: FileExplorerProps) {
  const accent = theme.accent;
  const {
    explorerSettings,
    appearanceSettings,
    updateExplorerSettings,
  } = useSettingsStore(useShallow(state => ({
    explorerSettings: state.settings.explorer,
    appearanceSettings: state.settings.appearance,
    updateExplorerSettings: state.updateExplorer,
  })));
  const {
    explorerRail,
    updateExplorerSession,
    updateExplorerRail,
  } = useExplorerStore(useShallow(state => ({
    explorerRail: state.rail,
    updateExplorerSession: state.updateSession,
    updateExplorerRail: state.updateRail,
  })));
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const isCompactDock = layoutMode === 'compact-dock';
  const sidebarBounds = getExplorerRailWidthBounds(isCompactDock);
  const uiFont = appearance?.fonts.ui ?? 'Inter,system-ui,sans-serif';
  const themeIconTheme = appearance?.theme.assets?.iconTheme ?? getBuiltInIconTheme();
  const useNativeOsIcons = appearanceSettings.useNativeOsIcons;
  const showHidden = explorerSettings.showHiddenFiles;
  const viewMode = explorerSettings.viewMode;
  const folderClickMode = explorerSettings.folderClickMode;
  // Session is only used to seed the explorer's local state. Avoid subscribing to it
  // so high-frequency local changes (typing, resizing) don't force extra store-driven renders.
  const initialSessionRef = useRef(useExplorerStore.getState().session);
  const initialSession = initialSessionRef.current;
  const initialSessionPathRef = useRef(initialSession.currentPath.trim());

  const [currentPath,  setCurrentPath]  = useState(() => initialSession.currentPath);
  const [history,      setHistory]      = useState<string[]>(() => initialSession.history);
  const [historyIdx,   setHistoryIdx]   = useState(() => initialSession.historyIdx);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const width = typeof initialSession.sidebarWidth === 'number'
      ? initialSession.sidebarWidth
      : sidebarBounds.defaultWidth;
    return Math.max(sidebarBounds.minWidth, Math.min(sidebarBounds.maxWidth, width));
  });
  const [previewWidth, setPreviewWidth] = useState(() => {
    if (typeof initialSession.previewWidth === 'number') {
      return Math.max(220, Math.min(800, initialSession.previewWidth));
    }
    return 380;
  });
  const [entries,      setEntries]      = useState<FileEntry[]>([]);
  const [entrySizes,   setEntrySizes]   = useState<Record<string, EntryStorageInfo>>({});
  const [entrySizeLoadingPaths, setEntrySizeLoadingPaths] = useState<Set<string>>(() => new Set());
  const [nativeIconMap, setNativeIconMap] = useState<Record<string, string | null>>({});
  const [nativeIconLoadingKeys, setNativeIconLoadingKeys] = useState<Set<string>>(() => new Set());
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
  const [preview,      setPreview]      = useState<PreviewState>({ type:'none', path:'' });
  const [ctxMenu,      setCtxMenu]      = useState<ContextMenuState>({ visible:false, x:0, y:0, entry:null });
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [rename,       setRename]       = useState<RenameState>({ active:false, path:'', name:'' });
  const [deleteTarget, setDeleteTarget] = useState<FileEntry|null>(null);
  const [clipboard,    setClipboard]    = useState<ExplorerClipboard|null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [newItem,      setNewItem]      = useState<NewItemState>({ visible:false, kind:'folder' });
  const [newItemName,  setNewItemName]  = useState('');
  const [dragOver,     setDragOver]     = useState<string|null>(null); // path being dragged over
  const [windowDropState, setWindowDropState] = useState<{ active: boolean; count: number }>({ active: false, count: 0 });
  const lastSelected   = useRef<string|null>(null);
  const previewRef = useRef(preview);
  const previewSaveTimer = useRef<number | null>(null);
  const searchRequestIdRef = useRef(0);
  const searchFocusRequestIdRef = useRef(0);
  const initialInteractiveRecordedRef = useRef(false);
  const explorerMountStartedAtRef = useRef(getExplorerPerformanceNow());
  const runtimeCachePolicyTelemetryMetadataRef = useRef<RuntimeCachePolicyTelemetryMetadata>(
    getRuntimeCachePolicyTelemetryMetadata(null, isTauri() ? 'pending' : 'unavailable'),
  );
  const pendingExplorerMetricSamplesRef = useRef<PendingExplorerMetricSample[]>([]);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');

  const mainRef = useRef<HTMLDivElement>(null);
  const explorerViewportRef = useRef<HTMLDivElement>(null);
  const layoutMenuAnchorRef = useRef<HTMLDivElement>(null);
  const lastLayoutWheelAtRef = useRef(0);
  const previewWarmupStartedRef = useRef(false);
  const previewWarmupTimerRef = useRef<number | null>(null);
  const [explorerViewportMetrics, setExplorerViewportMetrics] = useState<ViewportMetrics>({
    scrollTop: 0,
    clientHeight: 0,
    clientWidth: 0,
  });

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    if (!showLayoutMenu) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (layoutMenuAnchorRef.current?.contains(event.target as Node)) {
        return;
      }
      setShowLayoutMenu(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [showLayoutMenu]);

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
    if (!isTauri()) {
      runtimeCachePolicyTelemetryMetadataRef.current = getRuntimeCachePolicyTelemetryMetadata(null, 'unavailable');
      flushPendingExplorerMetrics(runtimeCachePolicyTelemetryMetadataRef.current);
      return undefined;
    }

    let disposed = false;
    void invoke<FsRuntimeCachePolicy>('fs_get_runtime_cache_policy')
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
    if (isCompactDock) {
      setSidebarWidth(current => Math.max(sidebarBounds.minWidth, Math.min(current, sidebarBounds.maxWidth)));
      setPreview({ type: 'none', path: '' });
    }
  }, [isCompactDock, sidebarBounds.maxWidth, sidebarBounds.minWidth]);

  useEffect(() => {
    updateExplorerSession({
      currentPath,
      history,
      historyIdx,
      sidebarWidth,
      previewWidth,
      search,
      searchIncludeContent,
      documentViewMode,
    });
  }, [
    currentPath,
    history,
    historyIdx,
    documentViewMode,
    previewWidth,
    search,
    searchIncludeContent,
    sidebarWidth,
    updateExplorerSession,
  ]);

  // ── Boot ──
  useEffect(() => {
    setDrivesLoading(true);
    invoke<DriveInfo[]>('fs_get_drives')
      .then(ds => setDrives(ds))
      .catch(() => setDrives([]))
      .finally(() => setDrivesLoading(false));
    const restoredPath = initialSessionPathRef.current;

    if (restoredPath) {
      navigate(restoredPath, false).catch(() => {
        initialSessionPathRef.current = '';
        setCurrentPath('');
        setHistory([]);
        setHistoryIdx(-1);
        updateExplorerSession({
          currentPath: '',
          history: [],
          historyIdx: -1,
        });

        const preferredPath = explorerSettings.defaultPath.trim();
        const bootstrapPath = preferredPath && preferredPath !== '.' ? preferredPath : null;

        if (bootstrapPath) {
          navigate(bootstrapPath).catch(() => {
            invoke<string>('fs_get_home_dir')
              .then(home => navigate(home))
              .catch(() => navigate(getFallbackExplorerPath(runtimePlatform)));
          });
        } else {
          invoke<string>('fs_get_home_dir')
            .then(home => navigate(home))
            .catch(() => navigate(getFallbackExplorerPath(runtimePlatform)));
        }
      });

      return;
    }

    const preferredPath = explorerSettings.defaultPath.trim();
    const bootstrapPath = preferredPath && preferredPath !== '.' ? preferredPath : null;

    if (bootstrapPath) {
      navigate(bootstrapPath).catch(() => {
        invoke<string>('fs_get_home_dir')
          .then(home => navigate(home))
          .catch(() => navigate(getFallbackExplorerPath(runtimePlatform)));
      });
    } else {
      invoke<string>('fs_get_home_dir')
        .then(home => navigate(home))
        .catch(() => navigate(getFallbackExplorerPath(runtimePlatform)));
    }

  }, [explorerSettings.defaultPath, runtimePlatform]);

  // ── Navigate ──
  const navigate = useCallback(async (path: string, push = true) => {
    const startedAt = getExplorerPerformanceNow();
    const normalizedPath = normalizeExplorerPath(path);
    setCurrentPath(normalizedPath); setSelected(new Set()); setSearch(''); setSearchResults([]); setSearchLoading(false); setError(null);
    setEntrySizeLoadingPaths(new Set());
    setAddressEditing(false);
    setAddressDraft('');
    if (push) { setHistory(h => [...h.slice(0, historyIdx + 1), normalizedPath]); setHistoryIdx(i => i + 1); }
    setLoading(true);
    try {
      const nextEntries = await invoke<FileEntry[]>('fs_list_dir', { path: normalizedPath, showHidden });
      setEntries(nextEntries);
      recordExplorerMetric({
        metricId: 'explorer_navigation',
        durationMs: getExplorerPerformanceNow() - startedAt,
        metadata: {
          entryCount: nextEntries.length,
          pathDepth: normalizedPath.split(/[\\/]/).filter(Boolean).length,
          showHidden,
          success: true,
        },
      });
    }
    catch (e) {
      setError(String(e)); setEntries([]);
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
    finally { setLoading(false); }
  }, [historyIdx, recordExplorerMetric, showHidden]);

  const runSearch = useCallback(async (query: string, requestId: number) => {
    const trimmed = query.trim();
    if (!trimmed || !currentPath) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const startedAt = getExplorerPerformanceNow();
    try {
      const response = await invoke<FileSearchResponse<FileSearchResult>>('fs_search_entries_with_diagnostics', {
        path: currentPath,
        query: trimmed,
        showHidden,
        includeContent: searchIncludeContent,
        limit: 250,
        requestId,
        requestScope: EXPLORER_SEARCH_SCOPE,
      });
      const results = response.results;
      if (searchRequestIdRef.current === requestId) {
        setSearchResults(results);
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
      if (searchRequestIdRef.current === requestId) {
        setSearchResults([]);
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
      if (searchRequestIdRef.current === requestId) {
        setSearchLoading(false);
      }
    }
  }, [currentPath, recordExplorerMetric, searchIncludeContent, showHidden]);

  const refresh = useCallback(async () => {
    if (!currentPath) return;
    const entriesToInvalidate = search.trim() ? searchResults : entries;
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
    try { setEntries(await invoke<FileEntry[]>('fs_list_dir_uncached', { path: currentPath, showHidden })); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
    if (search.trim()) {
      const requestId = ++searchRequestIdRef.current;
      void runSearch(search, requestId);
    }
  }, [currentPath, entries, search, searchResults, showHidden, runSearch]);

  useEffect(() => { refresh(); }, [showHidden]);

  useEffect(() => {
    if (!currentPath || !isTauri()) {
      return undefined;
    }

    void invoke('fs_watch_entry_size_root', { path: currentPath }).catch(error => {
      console.warn('OverlayTerm: failed to watch entry size root', error);
    });

    return () => {
      void invoke('fs_unwatch_entry_size_root', { path: currentPath }).catch(() => {});
    };
  }, [currentPath]);

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
        void invoke('fs_cancel_search_entries', {
          path: currentPath,
          requestId,
          requestScope: EXPLORER_SEARCH_SCOPE,
        }).catch(() => {});
      }
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
    if (currentPath) {
      void invoke('fs_cancel_search_entries', {
        path: currentPath,
        requestId,
        requestScope: EXPLORER_SEARCH_SCOPE,
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
  }, [search, runSearch]);

  const goBack    = () => { if (historyIdx > 0) { setHistoryIdx(i=>i-1); navigate(history[historyIdx-1], false); } };
  const goForward = () => { if (historyIdx < history.length-1) { setHistoryIdx(i=>i+1); navigate(history[historyIdx+1], false); } };
  const goUp      = () => {
    if (!currentPath) return;
    const sep = currentPath.includes('/') ? '/' : '\\';
    const parts = currentPath.replace(/[/\\]+$/, '').split(/[/\\]/);
    if (parts.length > 1) { parts.pop(); const p = parts.join(sep); navigate(p.endsWith(':') ? p+'\\' : p || sep); }
  };

  const beginAddressEdit = useCallback(() => {
    setAddressDraft(search.trim() ? search : currentPath);
    setAddressEditing(true);
  }, [currentPath, search]);

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

    setAddressDraft(trimmed);
    setSearch(trimmed);
  }, [currentPath, navigate, runtimePlatform, search]);

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
  const visibleEntries = useMemo(
    () => [...(isSearchActive ? searchResults : entries)].sort((left, right) => (
      compareExplorerEntries(
        left,
        right,
        explorerSettings.sortBy,
        explorerSettings.sortOrder,
      )
    )),
    [
      entries,
      explorerSettings.sortBy,
      explorerSettings.sortOrder,
      isSearchActive,
      searchResults,
    ],
  );
  const bookmarkPathSet = useMemo(() => new Set(
    explorerRail.nodes
      .filter((node): node is typeof explorerRail.nodes[number] & { kind: 'bookmark'; path: string } => node.kind === 'bookmark')
      .map((node) => node.path),
  ), [explorerRail.nodes]);
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
  const goHome = useCallback(() => {
    invoke<string>('fs_get_home_dir').then(p => navigate(p)).catch(() => {});
  }, [navigate]);
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

  const selectedEntries = useMemo(
    () => visibleEntries.filter(entry => selected.has(entry.path)),
    [visibleEntries, selected],
  );
  const activeDragPathsRef = useRef<string[]>([]);
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
    setDeleteTarget(null);
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

  const queueClipboard = useCallback((action: 'copy' | 'cut', entry?: FileEntry) => {
    const entriesForAction = resolveEntriesForAction(entry);
    if (entriesForAction.length === 0) return;
    setClipboard({ action, entries: entriesForAction });
  }, [resolveEntriesForAction]);

  const openAsAdmin = useCallback(async (path: string) => {
    await invoke('fs_open_as_admin', { path }).catch(e => setError(String(e)));
  }, []);

  const transferIntoDirectory = useCallback(async (
    targetDir: string,
    sources: string[],
    operation: FileTransferOperation,
  ): Promise<FileTransferResult[]> => {
    if (sources.length === 0) return [];
    return invoke<FileTransferResult[]>('fs_transfer_items', {
      targetDir,
      sources,
      operation,
    });
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
      await invoke('fs_write_file', { path, content: contentAtSave });
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
  }, [flushPreviewTextSave]);

  const previewEntry = useCallback(async (entry: FileEntry, focusTarget: EditorSearchFocusTarget | null = null) => {
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
        const dataUri = await invoke<string>('fs_read_file_base64', { path: entry.path });
        setPreview({ type:'image', path:entry.path, name:entry.name, content:dataUri });
      } catch(e) { setError(`Image load failed: ${e}`); }
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
        const content = await invoke<string>('fs_read_text_file', { path: entry.path });
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
      } catch {
        setPreview({ type: 'none', path: '' });
      }
      finally { setPreviewLoading(false); }
      return;
    }

    setPreview({ type: 'none', path: '' });
  }, [flushPreviewTextSave]);

  const openEntry = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      navigate(entry.path);
      return;
    }
    const ext = getEntryExtension(entry);
    const focusTarget = getSearchFocusTarget(entry);

    if (isEditableTextEntry(entry)) {
      await previewEntry(entry, focusTarget);
      return;
    }

    if (getModelPreviewFormat(ext) || isImagePreviewExtension(ext)) {
      await previewEntry(entry, focusTarget);
      return;
    }

    if (isExecutableExtension(ext)) {
      await invoke('fs_open_file', { path: entry.path }).catch(e => setError(String(e)));
      return;
    }

    await invoke('fs_open_file', { path: entry.path }).catch(e => setError(String(e)));
  }, [getSearchFocusTarget, navigate, previewEntry]);

  // ── Duplicate ──
  const duplicate = useCallback(async (entry: FileEntry) => {
    try {
      await transferIntoDirectory(currentPath, [entry.path], 'copy');
      refresh();
    }
    catch(e) { setError(String(e)); }
  }, [currentPath, refresh, transferIntoDirectory]);

  // ── Clipboard (system) ──
  const copyToSysClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

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
      await invoke('fs_rename', { oldPath, newPath });
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

  // ── Delete ──
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await invoke('fs_delete', { path: deleteTarget.path, recursive: deleteTarget.is_dir });
      if (preview.path === deleteTarget.path) setPreview({ type:'none', path:'' });
      if (previewSaveTimer.current) {
        window.clearTimeout(previewSaveTimer.current);
        previewSaveTimer.current = null;
      }
      setDeleteTarget(null); refresh();
    } catch(e) { setError(String(e)); }
  };

  // ── Context menu builder ──
  const buildCtxItems = useCallback((entry: FileEntry): CtxItem[] => {
    const isBookmarked = bookmarkPathSet.has(entry.path);
    const parentPath = entry.path.replace(/[/\\\\][^/\\\\]+$/, '');
    const stem = entry.name.replace(/\.[^.]+$/, '');
    const matchedPluginActions = pluginActions
      .filter(action => (
        action.appliesTo === 'any'
        || (action.appliesTo === 'directory' && entry.is_dir)
        || (action.appliesTo === 'file' && !entry.is_dir)
      ))
      .map(action => ({
        label: `${action.pluginName}: ${action.label}`,
        icon: <Puzzle size={13} />,
        action: () => {
          const resolvedCommand = resolvePluginCommandTemplate(action.command, {
            path: entry.path,
            name: entry.name,
            parent: parentPath,
            extension: entry.extension,
            stem,
            isDirectory: entry.is_dir,
            pluginId: action.pluginId,
            pluginName: action.pluginName,
          });
          dispatchTerminalCommand(resolvedCommand, action.runOnSelect);
        },
      }));

    return [
      { label:'Open',               icon:<ExternalLink size={13}/>, action:() => openEntry(entry) },
      { label: entry.is_dir ? 'Open Folder as Admin' : 'Open as Admin', icon:<Shield size={13}/>, action:() => openAsAdmin(entry.path) },
      ...(entry.is_dir ? [{ label:'Open in Terminal', icon:<Terminal size={13}/>, action:() => onOpenInTerminal(entry.path) }] : []),
      { label:'Reveal in Explorer', icon:<Eye size={13}/>,          action:() => invoke('fs_reveal_in_explorer', { path:entry.path }).catch(e=>setError(String(e))) },
      { label:'Copy Path',          icon:<Copy size={13}/>,         action:() => copyToSysClipboard(entry.path) },
      { label: '', icon:null, divider:true, action:()=>{} },
      { label:'Copy',               icon:<Copy size={13}/>,         action:() => queueClipboard('copy', entry) },
      { label:'Cut',                icon:<Scissors size={13}/>,     action:() => queueClipboard('cut', entry) },
      { label:'Duplicate',          icon:<CopyPlus size={13}/>,     action:() => duplicate(entry) },
      { label:'Rename (F2)',        icon:<Edit3 size={13}/>,        action:() => setRename({ active:true, path:entry.path, name:entry.name }) },
      { label: '', icon:null, divider:true, action:()=>{} },
      { label: isBookmarked ? 'Remove Bookmark' : 'Add to Bookmarks', icon: isBookmarked ? <StarOff size={13}/> : <Star size={13}/>, action:() => {
        if (isBookmarked) {
          updateExplorerRail(removeExplorerBookmarksByPath(explorerRail, entry.path));
        } else {
          const result = upsertExplorerBookmark(explorerRail, {
            path: entry.path,
            name: entry.name,
            isDirectory: entry.is_dir,
          });
          updateExplorerRail(result.snapshot);
          if (result.created) {
            handleBookmarkCreated(entry.name, entry.path);
          }
        }
      }},
      ...(matchedPluginActions.length > 0 ? [{ label: '', icon:null, divider:true, action:()=>{} }, ...matchedPluginActions] : []),
      { label: '', icon:null, divider:true, action:()=>{} },
      { label:'Delete', icon:<Trash2 size={13}/>, danger:true, action:() => setDeleteTarget(entry) },
    ];
  }, [bookmarkPathSet, duplicate, explorerRail, handleBookmarkCreated, onOpenInTerminal, openAsAdmin, openEntry, pluginActions, queueClipboard, updateExplorerRail]);

  const buildEmptyCtxItems = useCallback((): CtxItem[] => {
    return [
      { label:'New Folder', icon:<FolderPlus size={13}/>, action:() => openNew('folder') },
      { label:'New File...', icon:<FilePlus size={13}/>, action:() => openNew('file') },
      { label:'Open Folder as Admin', icon:<Shield size={13}/>, action:() => openAsAdmin(currentPath) },
      ...(clipboard ? [{ label:'Paste', icon:<Clipboard size={13}/>, action:() => paste() }] : []),
      { label:'Refresh', icon:<RefreshCw size={13}/>, action:() => refresh() },
    ];
  }, [clipboard, currentPath, openAsAdmin, paste, refresh]);

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
    if (plainClick && !entry.is_dir) {
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
      if (e.key === 'Backspace' && document.activeElement === mainRef.current) goUp();
      if (e.key === 'F5') refresh();
      if (e.key === 'F2' && selected.size === 1) {
        const entry = visibleEntries.find(en => selected.has(en.path));
        if (entry) setRename({ active:true, path:entry.path, name:entry.name });
      }
      if (e.key === 'Escape') { setClipboard(null); setNewItem({ visible:false, kind:'folder' }); }
      if (e.key === 'Delete' && selected.size > 0) {
        const first = visibleEntries.find(en => selected.has(en.path));
        if (first) setDeleteTarget(first);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelected(new Set(visibleEntries.map(f => f.path)));
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (selectedEntries.length > 0) {
          void copyToSysClipboard(selectedEntries.map(entry => entry.path).join('\n'));
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        queueClipboard('copy');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        queueClipboard('cut');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        void paste();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [addressEditing, beginAddressEdit, newItem.visible, paste, queueClipboard, refresh, rename.active, selectedEntries, visibleEntries]);

  // ── Breadcrumbs ──
  const crumbs: { label:string; path:string }[] = [];
  if (/^[A-Za-z]:/.test(currentPath)) {
    const drive = currentPath.slice(0, 2) + '\\';
    crumbs.push({ label:drive, path:drive });
    const parts = currentPath.replace(/[/\\]+$/, '').split(/[/\\]/).filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      crumbs.push({ label:parts[i], path:parts.slice(0, i+1).join('\\') });
    }
  }

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
        await invoke('fs_create_dir', { path: joinPlatformPath(base, name, runtimePlatform) });
      } else {
        await invoke('fs_write_file', { path: joinPlatformPath(base, name, runtimePlatform), content: '' });
      }
      refresh();
    } catch(e) { setError(String(e)); }
    finally { setNewItem({ visible:false, kind:'folder' }); }
  };

  // ── Drag and Drop ──
  const onDragStart = (e: React.DragEvent, entry: FileEntry) => {
    const dragEntries = resolveEntriesForAction(entry);
    const dragPaths = dragEntries.map(item => item.path);
    const dragIntent = resolveExplorerDragIntent(e);
    activeDragPathsRef.current = dragPaths;
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
    }
    e.dataTransfer.effectAllowed = dragIntent === 'native-out' ? 'copy' : 'copyMove';
  };

  const onDragEnd = () => {
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

  const selectedViewModeDefinition = useMemo(
    () => getExplorerViewModeDefinition(viewMode),
    [viewMode],
  );
  const effectiveViewMode = resolveEffectiveExplorerViewMode(viewMode, {
    isCompactDock,
    isSearchActive,
  });
  const effectiveViewModeDefinition = useMemo(
    () => getExplorerViewModeDefinition(effectiveViewMode),
    [effectiveViewMode],
  );
  const activeGridMetrics = effectiveViewModeDefinition.grid;
  const activeRowMetrics = effectiveViewModeDefinition.rows;
  const activeNewItemHeight = effectiveViewModeDefinition.presentation === 'grid'
    ? activeGridMetrics?.newItemHeight ?? EXPLORER_LIST_ROW_HEIGHT
    : activeRowMetrics?.newItemHeight ?? EXPLORER_LIST_ROW_HEIGHT;
  const hasPreview = !isCompactDock && preview.type !== 'none';
  const searchModeLabel = searchIncludeContent ? 'Recursive search + text' : 'Recursive search (names only)';

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
      const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      if (now - lastLayoutWheelAtRef.current < EXPLORER_LAYOUT_WHEEL_STEP_THROTTLE_MS) {
        return;
      }
      lastLayoutWheelAtRef.current = now;

      const direction = event.deltaY < 0 ? 'larger' : 'smaller';
      const nextMode = stepExplorerViewMode(viewMode, direction);
      if (nextMode !== viewMode) {
        updateExplorerSettings({ viewMode: nextMode });
      }
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [isCompactDock, updateExplorerSettings, viewMode]);

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
      setEntrySizeLoadingPaths(current => (current.size === 0 ? current : new Set()));
      return;
    }

    const shouldMeasureDirectories = !isSearchActive;
    const pendingFiles = virtualizedEntries
      .filter(entry => !entry.is_dir && !entrySizes[entry.path] && !entrySizeLoadingPaths.has(entry.path))
      .slice(0, 12);
    const pendingDirectories = shouldMeasureDirectories
      ? virtualizedEntries
        .filter(entry => entry.is_dir && !entrySizes[entry.path] && !entrySizeLoadingPaths.has(entry.path))
        .slice(0, 1)
      : [];

    const nextBatch = (pendingFiles.length > 0 ? pendingFiles : pendingDirectories).slice(0, 12);
    const unresolvedPaths = nextBatch.map(entry => entry.path);

    if (unresolvedPaths.length === 0) {
      setEntrySizeLoadingPaths(current => (current.size === 0 ? current : new Set()));
      return;
    }

    setEntrySizeLoadingPaths(current => {
      const next = new Set(current);
      for (const path of unresolvedPaths) {
        next.add(path);
      }
      return next;
    });

    const startedAt = getExplorerPerformanceNow();
    void invoke<EntryStorageInfo[]>('fs_measure_entry_sizes', {
      paths: unresolvedPaths,
      forceRefresh: false,
    })
      .then(results => {
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
        setEntrySizes(current => {
          const next = { ...current };
          for (const result of results) {
            next[result.path] = result;
          }
          return next;
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
      setNativeIconLoadingKeys(current => (current.size === 0 ? current : new Set()));
      return;
    }

    const pendingEntries = virtualizedEntries
      .map(entry => ({
        entry,
        key: getNativeIconCacheKey(entry.path, DEFAULT_NATIVE_ICON_SIZE),
      }))
      .filter(({ key }) => nativeIconMap[key] === undefined && !nativeIconLoadingKeys.has(key))
      .slice(0, 48);

    if (pendingEntries.length === 0) {
      setNativeIconLoadingKeys(current => (current.size === 0 ? current : new Set()));
      return;
    }

    const pendingKeys = pendingEntries.map(item => item.key);
    const requests = pendingEntries.map(item => getNativeIconRequest(item.entry));

    setNativeIconLoadingKeys(current => {
      const next = new Set(current);
      for (const key of pendingKeys) {
        next.add(key);
      }
      return next;
    });

    const startedAt = getExplorerPerformanceNow();
    void invoke<OverlayNativeIconResponse[]>('fs_resolve_native_icons', { requests })
      .then(results => {
        recordExplorerMetric({
          metricId: 'explorer_native_icon_batch',
          durationMs: getExplorerPerformanceNow() - startedAt,
          metadata: {
            pathCount: pendingKeys.length,
            resultCount: results.length,
            success: true,
          },
        });
        setNativeIconMap(current => {
          const next = { ...current };
          for (const result of results) {
            next[getNativeIconCacheKey(result.path, DEFAULT_NATIVE_ICON_SIZE)] = result.src ?? null;
          }
          return next;
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
        recordExplorerMetric({
          metricId: 'explorer_native_icon_batch',
          durationMs: getExplorerPerformanceNow() - startedAt,
          metadata: {
            pathCount: pendingKeys.length,
            resultCount: 0,
            success: false,
          },
        });
        setNativeIconMap(current => {
          const next = { ...current };
          for (const key of pendingKeys) {
            next[key] = null;
          }
          return next;
        });
        setNativeIconLoadingKeys(current => {
          const next = new Set(current);
          for (const key of pendingKeys) {
            next.delete(key);
          }
          return next.size === current.size ? current : next;
        });
      });
  }, [loading, nativeIconLoadingKeys, nativeIconMap, recordExplorerMetric, useNativeOsIcons, virtualizedEntries]);

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

  return (
    <div
      data-overlay-explorer
      style={{ flex:1, display:'flex', overflow:'hidden', background:EXP.bg, color:EXP.text, fontFamily:uiFont, position:'relative' }}
      onClick={() => { setSelected(new Set()); setCtxMenu(c => ({...c, visible:false})); }}
      onContextMenu={e => { e.preventDefault(); setCtxMenu(c => ({...c, visible:false})); }}
    >
      {/* ══ SIDEBAR ══ */}
      <ResizablePane
        size={sidebarWidth}
        minSize={sidebarBounds.minWidth}
        maxSize={sidebarBounds.maxWidth}
        onSizeChange={setSidebarWidth}
        borderColor={`${accent}55`}
        style={{
          borderRight: `1px solid ${EXP.border}`,
          background: EXP.sidebar,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <ExplorerSideRail
          accent={accent}
          sidebarWidth={sidebarWidth}
          currentPath={currentPath}
          drives={drives}
          drivesLoading={drivesLoading}
          isCompactDock={isCompactDock}
          onNavigate={navigate}
          onGoHome={goHome}
          onBookmarkCreated={handleBookmarkCreated}
          resolveDroppedSources={resolveDroppedBookmarkSources}
        />
      </ResizablePane>

      {/* ══ MAIN ══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:isCompactDock ? '6px 8px' : '6px 10px', background:EXP.panel, borderBottom:`1px solid ${EXP.border}`, flexShrink:0 }}>
          {[
            { icon:<ChevronLeft size={14}/>,  action:goBack,    disabled:historyIdx<=0,                  title:'Back' },
            { icon:<ChevronRight size={14}/>, action:goForward, disabled:historyIdx>=history.length-1,   title:'Forward' },
            { icon:<ArrowUp size={14}/>,      action:goUp,      disabled:false,                          title:'Up' },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} disabled={btn.disabled} title={btn.title}
              style={{ background:'none', border:'none', cursor:btn.disabled?'default':'pointer', color:btn.disabled?EXP.muted2:EXP.muted, padding:5, borderRadius:5, display:'flex', alignItems:'center' }}
              onMouseEnter={e => !btn.disabled && (e.currentTarget.style.background='rgba(255,255,255,0.06)', e.currentTarget.style.color=EXP.text)}
              onMouseLeave={e => (e.currentTarget.style.background='transparent', e.currentTarget.style.color=btn.disabled?EXP.muted2:EXP.muted)}
            >{btn.icon}</button>
          ))}

          {/* Omnibox */}
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
              background: EXP.bg,
              borderRadius: 6,
              border: `1px solid ${EXP.border}`,
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
                  fontSize: 11,
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
                          onClick={e => {
                            e.stopPropagation();
                            navigate(c.path);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: i === crumbs.length - 1 ? EXP.text : EXP.muted,
                            fontSize: 11,
                            fontWeight: i === crumbs.length - 1 ? 600 : 400,
                            padding: '0 2px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {c.label}
                        </button>
                      </React.Fragment>
                    ))
                  ) : (
                    <span style={{ fontSize: 11, color: EXP.muted, whiteSpace: 'nowrap' }}>Search or enter a path</span>
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
                        borderRadius: 999,
                        border: `1px solid ${EXP.border}`,
                        background: `${accent}12`,
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

          {/* Include text */}
          <button
            onClick={() => setSearchIncludeContent(v => !v)}
            title={searchIncludeContent ? 'Include file text in search (on)' : 'Include file text in search (off)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: searchIncludeContent ? `${accent}22` : 'none',
              border: `1px solid ${searchIncludeContent ? `${accent}66` : EXP.border}`,
              cursor: 'pointer',
              color: searchIncludeContent ? accent : EXP.muted,
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = searchIncludeContent ? `${accent}28` : 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = searchIncludeContent ? `${accent}22` : 'transparent')}
          >
            <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>Aa</span>
            <span style={{ display: isCompactDock ? 'none' : 'inline' }}>Text</span>
          </button>

          {/* Toolbar buttons */}
          {!isCompactDock && (
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
                onClick={() => setShowLayoutMenu(current => !current)}
                title={`Explorer layout: ${selectedViewModeDefinition.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: showLayoutMenu ? `${accent}18` : 'none',
                  border: `1px solid ${showLayoutMenu ? `${accent}55` : 'transparent'}`,
                  cursor: 'pointer',
                  color: showLayoutMenu ? EXP.text : EXP.muted,
                  padding: '4px 8px',
                  borderRadius: 7,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = showLayoutMenu ? `${accent}18` : 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = showLayoutMenu ? `${accent}18` : 'transparent')}
              >
                <ExplorerLayoutGlyph mode={selectedViewModeDefinition} accent={accent} active={showLayoutMenu} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {selectedViewModeDefinition.shortLabel}
                </span>
              </button>
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
                    borderRadius: 12,
                    border: `1px solid ${EXP.border}`,
                    background: '#1b1f27',
                    boxShadow: '0 18px 42px rgba(0,0,0,0.42)',
                    padding: 8,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {explorerViewModes.map(mode => {
                      const active = viewMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            updateExplorerSettings({ viewMode: mode.id });
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
                            background: active ? `${accent}24` : 'transparent',
                            color: active ? EXP.text : EXP.muted,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
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
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${EXP.border}`, fontSize: 10, color: EXP.muted2 }}>
                    Ctrl/Cmd + wheel steps through layouts from icons to details.
                  </div>
                </div>
              )}
            </div>
          )}

          <button onClick={() => updateExplorerSettings({ showHiddenFiles: !showHidden })} title="Toggle hidden files"
            style={{ background:showHidden?`${accent}22`:'none', border:'none', cursor:'pointer', color:showHidden?accent:EXP.muted, padding:5, borderRadius:5, display:'flex' }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.06)')}
            onMouseLeave={e=>(e.currentTarget.style.background=showHidden?`${accent}22`:'transparent')}
          ><Eye size={14}/></button>

          <button onClick={refresh} title="Refresh (F5)"
            style={{ background:'none', border:'none', cursor:'pointer', color:EXP.muted, padding:5, borderRadius:5, display:'flex' }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.06)')}
            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
          ><RefreshCw size={14}/></button>

          <div style={{ width:1, height:16, background:EXP.border }} />

          <button onClick={() => openNew('folder')} title="New Folder"
            style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:EXP.muted, padding:'4px 7px', borderRadius:5, fontSize:11 }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.06)', (e.currentTarget.style.color=EXP.text))}
            onMouseLeave={e=>(e.currentTarget.style.background='transparent', (e.currentTarget.style.color=EXP.muted))}
          ><FolderPlus size={13}/> Folder</button>

          <button onClick={() => openNew('file')} title="New File"
            style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:EXP.muted, padding:'4px 7px', borderRadius:5, fontSize:11 }}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.06)', (e.currentTarget.style.color=EXP.text))}
            onMouseLeave={e=>(e.currentTarget.style.background='transparent', (e.currentTarget.style.color=EXP.muted))}
          ><FilePlus size={13}/> File</button>

          {clipboard && (
            <button onClick={paste} title={`Paste ${clipboard.entries.length} item${clipboard.entries.length === 1 ? '' : 's'} (Ctrl+V)`}
              style={{ display:'flex', alignItems:'center', gap:4, background:`${accent}22`, border:`1px solid ${accent}44`, borderRadius:5, cursor:'pointer', color:accent, padding:'3px 8px', fontSize:11 }}>
              <Clipboard size={12}/> Paste {clipboard.entries.length > 1 ? clipboard.entries.length : ''}
            </button>
          )}
        </div>

        {repositoryPicker?.active && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: `${accent}10`,
              borderBottom: `1px solid ${EXP.border}`,
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
                  title={currentPath}
                >
                  Current folder: {currentPath}
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
                borderRadius: 8,
                border: `1px solid ${canConfirmRepositorySelection ? accent : EXP.border}`,
                background: canConfirmRepositorySelection ? accent : 'rgba(255,255,255,0.04)',
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
                borderRadius: 8,
                border: `1px solid ${EXP.border}`,
                background: 'rgba(255,255,255,0.04)',
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
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            viewportStyle={{ padding: 0 }}
            viewportRef={explorerViewportRef}
          >
          <div ref={mainRef} tabIndex={0}
            style={{ minHeight: '100%', outline:'none' }}
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
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, color:EXP.muted, fontSize:12 }}>
                {isSearchActive ? `No results for "${search.trim()}"` : 'Empty folder'}
              </div>
            )}

            {/* Grid view */}
            {newItem.visible && virtualWindow.kind === 'grid' && activeGridMetrics && (
              <div style={{ padding: `0 ${activeGridMetrics.padding}px ${activeGridMetrics.padding}px`, boxSizing: 'border-box' }}>
                <div
                  style={{
                    background: `${accent}10`,
                    border: `1px solid ${accent}`,
                    borderRadius: activeGridMetrics.tileRadius,
                    padding: activeGridMetrics.iconSize <= 46 ? '8px 6px 6px' : '10px 8px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    height: activeGridMetrics.newItemHeight,
                    boxSizing: 'border-box',
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
                    style={{ background: '#1e2130', border: `1px solid ${accent}`, borderRadius: 4, color: EXP.text, fontSize: 11, padding: '2px 6px', outline: 'none', width: '100%', boxSizing: 'border-box' as const }}
                  />
                </div>
              </div>
            )}

            {!loading && virtualWindow.kind === 'grid' && activeGridMetrics && (
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
                  }}
                >
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
                          background: isDrop ? `${accent}18` : isSel ? `${accent}10` : 'transparent',
                          border: `1px solid ${isDrop ? accent : isSel ? `${accent}88` : 'transparent'}`,
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
                          transition: 'background 0.12s ease, border-color 0.12s ease, transform 0.12s ease',
                        }}
                        onMouseEnter={e => {
                          if (!isSel && !isDrop) {
                            const target = e.currentTarget as HTMLDivElement;
                            target.style.background = 'rgba(255,255,255,0.035)';
                            target.style.borderColor = 'rgba(255,255,255,0.08)';
                            target.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSel && !isDrop) {
                            const target = e.currentTarget as HTMLDivElement;
                            target.style.background = 'transparent';
                            target.style.borderColor = 'transparent';
                            target.style.transform = 'translateY(0)';
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
                          }}
                        >
                          <SvgIcon src={iconSrc} size={activeGridMetrics.iconSize} />
                        </div>
                        {isRenaming
                          ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active: false, path: '', name: '' })} />
                          : (
                            <span
                              style={{
                                fontSize: 11,
                                textAlign: 'center',
                                color: EXP.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: activeGridMetrics.nameLines,
                                WebkitBoxOrient: 'vertical',
                                width: '100%',
                                lineHeight: 1.28,
                              }}
                            >
                              {entry.name}
                            </span>
                          )
                        }
                        <span style={{ fontSize: 9, textAlign: 'center', color: EXP.muted2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', marginTop: -2 }}>
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

            {newItem.visible && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'list' && (
              <div
                style={{
                  height: activeRowMetrics?.newItemHeight ?? 42,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 12px',
                  borderBottom: `1px solid ${EXP.border}`,
                  background: `${accent}11`,
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
                  style={{ background: '#1e2130', border: `1px solid ${accent}`, borderRadius: 4, color: EXP.text, fontSize: 12, padding: '2px 6px', outline: 'none', flex: 1 }}
                />
              </div>
            )}

            {!loading && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'list' && (
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
                        borderBottom: `1px solid ${EXP.border}`,
                        background: isDrop ? `${accent}22` : isSel ? EXP.selected : 'transparent',
                        cursor: 'pointer',
                        opacity: entry.is_hidden ? 0.5 : 1,
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => { if (!isSel && !isDrop) (e.currentTarget as HTMLDivElement).style.background = EXP.cardHov; }}
                      onMouseLeave={e => { if (!isSel && !isDrop) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
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
                                {entry.is_symlink && <span style={{ fontSize: 9, color: EXP.muted, background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>symlink</span>}
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

            {newItem.visible && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'table' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  <tr style={{ background: `${accent}11`, borderBottom: `1px solid ${EXP.border}`, height: activeRowMetrics?.newItemHeight ?? 42 }}>
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
                          style={{ background: '#1e2130', border: `1px solid ${accent}`, borderRadius: 4, color: EXP.text, fontSize: 12, padding: '2px 6px', outline: 'none', flex: 1 }}
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

            {!loading && virtualWindow.kind === 'list' && effectiveViewModeDefinition.presentation === 'table' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: EXP.panel, position: 'sticky', top: 0, zIndex: 2 }}>
                    {[
                      { key: 'name', label: 'Name' },
                      { key: 'size', label: 'Size' },
                      { key: 'date', label: 'Modified' },
                      { key: 'type', label: 'Type' },
                    ].map(column => (
                      <th key={column.key} style={{ padding: '6px 12px', textAlign: 'left', color: EXP.muted, fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: `1px solid ${EXP.border}` }}>
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
                        style={{ background: isDrop ? `${accent}22` : isSel ? EXP.selected : 'transparent', cursor: 'pointer', opacity: entry.is_hidden ? 0.5 : 1, userSelect: 'none', borderBottom: `1px solid ${EXP.border}`, height: virtualWindow.rowHeight }}
                        onMouseEnter={e => { if (!isSel && !isDrop) (e.currentTarget as HTMLTableRowElement).style.background = EXP.cardHov; }}
                        onMouseLeave={e => { if (!isSel && !isDrop) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
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
                                    {entry.is_symlink && <span style={{ fontSize: 9, color: EXP.muted, background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>symlink</span>}
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
              onClose={() => { void closePreview(); }}
            />
          )}
        </div>

        {/* Status bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'3px 12px', background:EXP.sidebar, borderTop:`1px solid ${EXP.border}`, fontSize:10, color:EXP.muted, flexShrink:0 }}>
          <span>{visibleEntries.length} item{visibleEntries.length!==1?'s':''}</span>
          {selected.size > 0 && <span style={{ color:accent }}>{selected.size} selected</span>}
          {!isCompactDock && (
            <span>
              View: <span style={{ color: EXP.text }}>{selectedViewModeDefinition.label}</span>
              {effectiveViewMode !== viewMode ? ` -> ${effectiveViewModeDefinition.label}` : ''}
            </span>
          )}
          {search && <span>{searchModeLabel}: "<span style={{ color:EXP.text }}>{search}</span>"</span>}
          <div style={{ flex:1 }} />
          {clipboard && (
            <span style={{ color:EXP.muted2 }}>
              {clipboard.action === 'copy' ? 'Copy' : 'Move'} queue: {clipboard.entries[0]?.name}
              {clipboard.entries.length > 1 ? ` +${clipboard.entries.length - 1} more` : ''} — ready (Ctrl+V)
            </span>
          )}
          {previewLoading && <span style={{ color:accent, display:'flex', alignItems:'center', gap:4 }}><Loader size={9} style={{ animation:'spin 1s linear infinite' }} /> Loading…</span>}
        </div>
      </div>

      {/* Context menu */}
      <ContextMenu state={ctxMenu} items={ctxMenu.entry ? buildCtxItems(ctxMenu.entry) : buildEmptyCtxItems()} onClose={() => setCtxMenu(c => ({...c, visible:false}))} />

      {/* Delete dialog */}
      {deleteTarget && <DeleteDialog entry={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />}

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default FileExplorer;
