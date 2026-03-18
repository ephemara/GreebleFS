/**
 * FileExplorer — UE5-feel file explorer
 *
 * v2 changes vs v1:
 *  ✓ Custom SVG icon theme (user's K_OS Icons — one SVG per file type + folder variants)
 *  ✓ Ctrl+C / Ctrl+V system clipboard (navigator.clipboard)
 *  ✓ Resizable preview pane (drag handle)
 *  ✓ Images loaded via fs_read_file_base64 (data-URI) — no asset-protocol issues
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Editor from '@monaco-editor/react';
import {
  ChevronRight, ChevronLeft, ArrowUp, Search, RefreshCw,
  Grid, List, X, Star, StarOff, HardDrive, Terminal,
  Trash2, Copy, Scissors, Clipboard, Edit3, ExternalLink,
  Shield, Eye, AlertTriangle, Loader, Home,
  FilePlus, FolderPlus, CopyPlus,
} from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { getFolderIconSrc } from '../config/folderIcons';
import type { ExplorerLayoutMode } from '../config/layoutProfiles';
import { detectClientPlatform, getFallbackExplorerPath, getPlatformPathSeparator, joinPlatformPath } from '../config/platform';
import { useSettingsStore } from '../store/settingsStore';

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
interface FsBookmark { id: string; name: string; path: string; }
interface ContextMenuState { visible: boolean; x: number; y: number; entry: FileEntry | null; }
interface RenameState    { active: boolean; path: string; name: string; }
interface PreviewState   { type: 'image'|'text'|'none'; path: string; content?: string; language?: string; }
interface NewItemState   { visible: boolean; kind: 'file'|'folder'; }
interface ExplorerClipboard { action:'copy'|'cut'; entries: FileEntry[]; }
interface FileTransferResult { source_path: string; destination_path: string; operation: 'copy' | 'move'; }
type FileTransferOperation = 'copy' | 'move';
interface ExplorerEditorTab {
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  error: string | null;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const EXP = {
  bg:      'var(--overlay-bg-app)', panel:   'var(--overlay-bg-panel)', sidebar: 'var(--overlay-bg-sidebar)',
  card:    'var(--overlay-bg-card)', cardHov: 'var(--overlay-bg-card-hover)',
  border:  'var(--overlay-border)',
  accent:  'var(--overlay-accent)', accent2: 'var(--overlay-accent)',
  text:    'var(--overlay-text-primary)', muted:   'var(--overlay-text-muted)', muted2: 'var(--overlay-text-dim)',
  selected:'var(--overlay-bg-selection)', selBord: 'var(--overlay-accent)',
  red:     'var(--overlay-danger)', green:   'var(--overlay-success)', yellow:  'var(--overlay-warning)',
};

// ─── Icon theme mapping ───────────────────────────────────────────────────────
// Maps extension / special filename → icon filename (no path, no ext — we add /icons/*.svg)

const ICON_BASE = '/icons/';

const EXT_ICON: Record<string, string> = {
  // Languages
  rs: 'rust', py: 'python', js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  cs: 'csharp', java: 'java', go: 'go', rb: 'ruby', php: 'php',
  swift: 'swift', kt: 'kotlin', dart: 'dart', lua: 'lua',
  zig: 'zig', ex: 'elixir', exs: 'elixir', hs: 'haskell',
  r: 'r', rmd: 'r', scala: 'scala', sc: 'scala',
  clj: 'clojure', cljs: 'clojure', erl: 'erlang', hrl: 'erlang',
  ml: 'ocaml', mli: 'ocaml',
  // Web
  html: 'html', htm: 'html', css: 'css', scss: 'scss',
  sass: 'sass', less: 'less',
  // Data / config
  json: 'json', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', xml: 'xml', ini: 'ini', cfg: 'ini',
  // Docs
  md: 'markdown', mdx: 'markdown', txt: 'txt', pdf: 'pdf',
  // Shaders / graphics
  glsl: 'glsl', hlsl: 'hlsl', wgsl: 'wgsl', vert: 'glsl', frag: 'glsl', spv: 'spv',
  // Build / infra
  dockerfile: 'dockerfile', makefile: 'makefile',
  gitignore: 'gitignore', env: 'env', editorconfig: 'editorconfig',
  // Scripts
  sh: 'shell', bash: 'shell', zsh: 'shell',
  ps1: 'powershell', psm1: 'powershell',
  bat: 'exe', cmd: 'exe',
  // Executables / packages
  exe: 'exe', msi: 'exe', dmg: 'dmg',
  deb: 'deb', rpm: 'deb', app: 'app',
  dll: 'dll', so: 'dll', dylib: 'dll',
  // Archives
  zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip', bz2: 'zip', xz: 'zip',
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
  webp: 'image', bmp: 'image', ico: 'image', svg: 'image',
  tiff: 'image', tif: 'image', avif: 'image',
  // Video
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video',
  wmv: 'video', flv: 'video', webm: 'video',
  // Audio
  mp3: 'audio', wav: 'audio', flac: 'audio', ogg: 'audio',
  m4a: 'audio', aac: 'audio', opus: 'audio',
  // Fonts
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
  // 3D / UE5
  fbx: 'model3d', obj: 'model3d', glb: 'model3d', gltf: 'model3d',
  uasset: 'uasset', uproject: 'uproject',
  // Data
  sql: 'sql', db: 'database', sqlite: 'database', csv: 'database',
  // Misc
  log: 'log', lock: 'lock', kain: 'kain', ink: 'ink', gradle: 'gradle',
  npm: 'npm',
};

const FILENAME_ICON: Record<string, string> = {
  'dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'rakefile': 'ruby',
  'cmake': 'cmake',
  '.gitignore': 'gitignore',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.env': 'env',
  '.env.local': 'env',
  '.editorconfig': 'editorconfig',
  'package.json': 'npm',
  'package-lock.json': 'npm',
  'cargo.toml': 'rust',
  'cargo.lock': 'rust',
};

function getIconSrc(
  entry: FileEntry,
  open = false,
  folderConfig?: Parameters<typeof getFolderIconSrc>[2],
): string {
  if (entry.is_dir) {
    return getFolderIconSrc(entry.path, open, folderConfig);
  }
  // Check exact filename first
  const fnLower = entry.name.toLowerCase();
  if (FILENAME_ICON[fnLower]) return `${ICON_BASE}${FILENAME_ICON[fnLower]}.svg`;
  // Check extension
  const ext = entry.extension.toLowerCase();
  const extIcon = EXT_ICON[ext];
  if (extIcon) return `${ICON_BASE}${extIcon}.svg`;
  return `${ICON_BASE}txt.svg`;
}

// ─── Extension sets (for preview logic only) ─────────────────────────────────

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','tif','avif']);
const CODE_EXTS  = new Set(['ts','tsx','js','jsx','rs','py','go','c','cpp','h','hpp','cs','java','rb','php','swift','kt','vue','html','css','scss','json','toml','yaml','yml','xml','md','sh','ps1','bat','lua','sql','zig','env','dart','glsl','wgsl','hlsl','ini','txt','kain','ink','log']);
const EXEC_EXTS  = new Set(['exe','msi','bat','cmd','ps1','sh','app','dmg']);

function monacoLang(ext: string): string {
  const map: Record<string, string> = {
    ts:'typescript', tsx:'typescript', js:'javascript', jsx:'javascript',
    rs:'rust', py:'python', go:'go', c:'c', cpp:'cpp', h:'cpp',
    cs:'csharp', java:'java', rb:'ruby', php:'php', swift:'swift', kt:'kotlin',
    vue:'html', html:'html', css:'css', scss:'scss', json:'json', toml:'toml',
    yaml:'yaml', yml:'yaml', xml:'xml', md:'markdown', sh:'shell',
    ps1:'powershell', bat:'bat', lua:'lua', sql:'sql', zig:'zig', ini:'ini',
    env:'shell', dart:'dart', glsl:'glsl', wgsl:'wgsl', hlsl:'hlsl',
    kain:'plaintext', ink:'plaintext', log:'plaintext',
  };
  return map[ext] || 'plaintext';
}

function isEditableTextEntry(entry: FileEntry): boolean {
  if (entry.is_dir) return false;
  const ext = entry.extension.toLowerCase();
  if (IMAGE_EXTS.has(ext) || EXEC_EXTS.has(ext)) return false;
  return CODE_EXTS.has(ext) || entry.size < 2 * 1024 * 1024;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024**3)   return `${(bytes/1024**2).toFixed(1)} MB`;
  return `${(bytes/1024**3).toFixed(2)} GB`;
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

// ─── Resizable Preview Panel ──────────────────────────────────────────────────

function PreviewPanel({ preview, onClose }: { preview: PreviewState; onClose: () => void }) {
  const [width, setWidth] = useState(380);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(380);

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
      setWidth(Math.max(220, Math.min(800, startW.current + delta)));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px 8px 16px', borderBottom:`1px solid ${EXP.border}`, background:EXP.sidebar, flexShrink:0 }}>
        <span style={{ fontSize:10, color:EXP.muted, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>Preview</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:EXP.muted, padding:2 }}><X size={13} /></button>
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
        {preview.type === 'text' && (
          <Editor
            height="100%"
            language={preview.language || 'plaintext'}
            value={preview.content || ''}
            theme="vs-dark"
            options={{ readOnly:true, minimap:{enabled:false}, scrollBeyondLastLine:false, fontSize:12, lineNumbers:'on', wordWrap:'on', padding:{top:8}, renderLineHighlight:'none', overviewRulerLanes:0 }}
          />
        )}
      </div>
    </div>
  );
}

function EditorTabsPanel({
  tabs,
  activePath,
  onSelect,
  onCloseTab,
  onChangeContent,
}: {
  tabs: ExplorerEditorTab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, content: string) => void;
}) {
  const [width, setWidth] = useState(540);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(540);
  const activeTab = tabs.find(tab => tab.path === activePath) ?? null;

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      setWidth(Math.max(320, Math.min(1000, startW.current + delta)));
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  return (
    <div style={{ width, background: EXP.panel, borderLeft: `1px solid ${EXP.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          cursor: 'col-resize', zIndex: 10,
          background: 'transparent',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = `${EXP.accent}55`)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />
      <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'stretch', minHeight: 38, overflowX: 'auto', overflowY: 'hidden', borderBottom: `1px solid ${EXP.border}`, background: EXP.sidebar }}>
        {tabs.map(tab => {
          const isActive = tab.path === activePath;
          return (
            <button
              key={tab.path}
              onClick={() => onSelect(tab.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                minWidth: 150,
                maxWidth: 260,
                padding: '0 10px',
                border: 'none',
                borderRight: `1px solid ${EXP.border}`,
                borderTop: `2px solid ${isActive ? EXP.accent : 'transparent'}`,
                background: isActive ? `${EXP.accent}20` : 'transparent',
                color: isActive ? EXP.text : EXP.muted,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{tab.name}</span>
              {tab.isSaving && <span style={{ width: 6, height: 6, borderRadius: '50%', background: EXP.accent, opacity: 0.85 }} />}
              {tab.isDirty && !tab.isSaving && <span style={{ width: 6, height: 6, borderRadius: '50%', background: EXP.yellow, opacity: 0.85 }} />}
              <span
                onClick={event => {
                  event.stopPropagation();
                  onCloseTab(tab.path);
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: 4, color: EXP.muted }}
              >
                <X size={10} />
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab && (
          <Editor
            height="100%"
            language={activeTab.language || 'plaintext'}
            value={activeTab.content}
            theme="vs-dark"
            onChange={value => onChangeContent(activeTab.path, value ?? '')}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              lineNumbers: 'on',
              wordWrap: 'on',
              padding: { top: 8 },
            }}
          />
        )}
      </div>
      {activeTab && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 10px', borderTop: `1px solid ${EXP.border}`, background: EXP.sidebar, fontSize: 10, color: EXP.muted }}>
          <span>{activeTab.content.length} chars · {activeTab.content.split(/\s+/).filter(Boolean).length} words · {activeTab.content.split('\n').length} lines</span>
          <span style={{ color: activeTab.error ? EXP.red : activeTab.isDirty ? EXP.yellow : EXP.green }}>
            {activeTab.error ? 'Save failed' : activeTab.isSaving ? 'Saving…' : activeTab.isDirty ? 'Pending auto-save' : 'Auto-saved'}
          </span>
        </div>
      )}
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
  layoutMode?: ExplorerLayoutMode;
}

export function FileExplorer({ theme, appearance, onOpenInTerminal, onAddBookmark, layoutMode = 'full' }: FileExplorerProps) {
  const accent = theme.accent;
  const explorerSettings = useSettingsStore(s => s.settings.explorer);
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const isCompactDock = layoutMode === 'compact-dock';
  const uiFont = appearance?.fonts.ui ?? 'Inter,system-ui,sans-serif';

  const [currentPath,  setCurrentPath]  = useState('');
  const [history,      setHistory]      = useState<string[]>([]);
  const [historyIdx,   setHistoryIdx]   = useState(-1);
  const [sidebarWidth, setSidebarWidth] = useState(isCompactDock ? 180 : 220);
  const [entries,      setEntries]      = useState<FileEntry[]>([]);
  const [searchResults, setSearchResults] = useState<FileSearchResult[]>([]);
  const [drives,       setDrives]       = useState<DriveInfo[]>([]);
  const [bookmarks,    setBookmarks]    = useState<FsBookmark[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string|null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [viewMode,     setViewMode]     = useState<'grid'|'list'>(isCompactDock ? 'list' : 'grid');
  const [search,       setSearch]       = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchIncludeContent, setSearchIncludeContent] = useState(true);
  const [showHidden,   setShowHidden]   = useState(false);
  const [preview,      setPreview]      = useState<PreviewState>({ type:'none', path:'' });
  const [ctxMenu,      setCtxMenu]      = useState<ContextMenuState>({ visible:false, x:0, y:0, entry:null });
  const [rename,       setRename]       = useState<RenameState>({ active:false, path:'', name:'' });
  const [deleteTarget, setDeleteTarget] = useState<FileEntry|null>(null);
  const [clipboard,    setClipboard]    = useState<ExplorerClipboard|null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editorTabs, setEditorTabs] = useState<ExplorerEditorTab[]>([]);
  const [activeEditorPath, setActiveEditorPath] = useState<string | null>(null);
  const [newItem,      setNewItem]      = useState<NewItemState>({ visible:false, kind:'folder' });
  const [newItemName,  setNewItemName]  = useState('');
  const [dragOver,     setDragOver]     = useState<string|null>(null); // path being dragged over
  const [windowDropState, setWindowDropState] = useState<{ active: boolean; count: number }>({ active: false, count: 0 });
  const lastSelected   = useRef<string|null>(null);
  const editorTabsRef = useRef<ExplorerEditorTab[]>([]);
  const editorSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const searchRequestIdRef = useRef(0);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');

  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editorTabsRef.current = editorTabs;
  }, [editorTabs]);

  useEffect(() => {
    return () => {
      editorSaveTimers.current.forEach(timer => window.clearTimeout(timer));
      editorSaveTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (isCompactDock) {
      setSidebarWidth(current => Math.min(current, 200));
      setViewMode('list');
      setPreview({ type: 'none', path: '' });
    }
  }, [isCompactDock]);

  useEffect(() => {
    if (editorTabs.length === 0) {
      setActiveEditorPath(null);
      return;
    }
    if (!activeEditorPath || !editorTabs.some(tab => tab.path === activeEditorPath)) {
      setActiveEditorPath(editorTabs[editorTabs.length - 1].path);
    }
  }, [editorTabs, activeEditorPath]);

  // ── Boot ──
  useEffect(() => {
    invoke<DriveInfo[]>('fs_get_drives').then(ds => setDrives(ds)).catch(() => {});
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

    try { const s = localStorage.getItem('fs-bookmarks-v2'); if (s) setBookmarks(JSON.parse(s)); } catch {}
  }, [explorerSettings.defaultPath, runtimePlatform]);

  useEffect(() => { localStorage.setItem('fs-bookmarks-v2', JSON.stringify(bookmarks)); }, [bookmarks]);

  // ── Navigate ──
  const navigate = useCallback(async (path: string, push = true) => {
    const normalizedPath = normalizeExplorerPath(path);
    setCurrentPath(normalizedPath); setSelected(new Set()); setSearch(''); setSearchResults([]); setSearchLoading(false); setError(null);
    setAddressEditing(false);
    setAddressDraft('');
    if (push) { setHistory(h => [...h.slice(0, historyIdx + 1), normalizedPath]); setHistoryIdx(i => i + 1); }
    setLoading(true);
    try { setEntries(await invoke<FileEntry[]>('fs_list_dir', { path: normalizedPath, showHidden })); }
    catch (e) { setError(String(e)); setEntries([]); }
    finally { setLoading(false); }
  }, [historyIdx, showHidden]);

  const runSearch = useCallback(async (query: string, requestId: number) => {
    const trimmed = query.trim();
    if (!trimmed || !currentPath) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await invoke<FileSearchResult[]>('fs_search_entries', {
        path: currentPath,
        query: trimmed,
        showHidden,
        includeContent: searchIncludeContent,
        limit: 250,
      });
      if (searchRequestIdRef.current === requestId) {
        setSearchResults(results);
      }
    } catch (searchError) {
      if (searchRequestIdRef.current === requestId) {
        setSearchResults([]);
        setError(`Search failed: ${searchError}`);
      }
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setSearchLoading(false);
      }
    }
  }, [currentPath, searchIncludeContent, showHidden]);

  const refresh = useCallback(async () => {
    if (!currentPath) return;
    setLoading(true);
    try { setEntries(await invoke<FileEntry[]>('fs_list_dir', { path: currentPath, showHidden })); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
    if (search.trim()) {
      const requestId = ++searchRequestIdRef.current;
      void runSearch(search, requestId);
    }
  }, [currentPath, showHidden, search, runSearch]);

  useEffect(() => { refresh(); }, [showHidden]);

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
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestIdRef.current;
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
  const visibleEntries = useMemo(
    () => (isSearchActive ? searchResults : entries),
    [isSearchActive, searchResults, entries],
  );

  const selectedEntries = useMemo(
    () => visibleEntries.filter(entry => selected.has(entry.path)),
    [visibleEntries, selected],
  );

  const resolveEntriesForAction = useCallback((entry?: FileEntry) => {
    if (!entry) return selectedEntries;
    if (selected.has(entry.path) && selectedEntries.length > 0) {
      return selectedEntries;
    }
    return [entry];
  }, [selected, selectedEntries]);

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
  const previewEntry = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      setPreview({ type: 'none', path: '' });
      return;
    }
    const ext = entry.extension.toLowerCase();

    if (IMAGE_EXTS.has(ext)) {
      setPreviewLoading(true);
      try {
        const dataUri = await invoke<string>('fs_read_file_base64', { path: entry.path });
        setPreview({ type:'image', path:entry.path, content:dataUri });
      } catch(e) { setError(`Image load failed: ${e}`); }
      finally { setPreviewLoading(false); }
      return;
    }

    if (isEditableTextEntry(entry)) {
      setPreviewLoading(true);
      try {
        const content = await invoke<string>('fs_read_text_file', { path: entry.path });
        setPreview({ type:'text', path:entry.path, content, language:monacoLang(ext) });
      } catch {
        setPreview({ type: 'none', path: '' });
      }
      finally { setPreviewLoading(false); }
      return;
    }

    setPreview({ type: 'none', path: '' });
  }, []);

  const persistEditorTab = useCallback(async (path: string) => {
    const tab = editorTabsRef.current.find(candidate => candidate.path === path);
    if (!tab) return;

    const contentAtSave = tab.content;
    setEditorTabs(prev => prev.map(candidate => (
      candidate.path === path
        ? { ...candidate, isSaving: true, error: null }
        : candidate
    )));

    try {
      await invoke('fs_write_file', { path, content: contentAtSave });
      setEditorTabs(prev => prev.map(candidate => {
        if (candidate.path !== path) return candidate;
        const isStillSame = candidate.content === contentAtSave;
        return {
          ...candidate,
          isSaving: false,
          isDirty: !isStillSame,
          lastSavedAt: isStillSame ? Date.now() : candidate.lastSavedAt,
          error: null,
        };
      }));
    } catch (saveError) {
      setEditorTabs(prev => prev.map(candidate => (
        candidate.path === path
          ? { ...candidate, isSaving: false, error: String(saveError) }
          : candidate
      )));
      setError(`Save failed for ${tab.name}: ${saveError}`);
    }
  }, []);

  const queueEditorSave = useCallback((path: string) => {
    const existing = editorSaveTimers.current.get(path);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      editorSaveTimers.current.delete(path);
      void persistEditorTab(path);
    }, 700);
    editorSaveTimers.current.set(path, timer);
  }, [persistEditorTab]);

  const openEditorTab = useCallback(async (entry: FileEntry) => {
    const existing = editorTabsRef.current.find(tab => tab.path === entry.path);
    if (existing) {
      setActiveEditorPath(existing.path);
      return;
    }
    const ext = entry.extension.toLowerCase();
    setPreviewLoading(true);
    try {
      const content = await invoke<string>('fs_read_text_file', { path: entry.path });
      setEditorTabs(prev => [...prev, {
        path: entry.path,
        name: entry.name,
        language: monacoLang(ext),
        content,
        isDirty: false,
        isSaving: false,
        lastSavedAt: Date.now(),
        error: null,
      }]);
      setActiveEditorPath(entry.path);
    } catch (openError) {
      setError(`Failed to open editor tab: ${openError}`);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closeEditorTab = useCallback((path: string) => {
    const timer = editorSaveTimers.current.get(path);
    if (timer) {
      window.clearTimeout(timer);
      editorSaveTimers.current.delete(path);
    }
    const target = editorTabsRef.current.find(tab => tab.path === path);
    if (target?.isDirty) {
      void invoke('fs_write_file', { path, content: target.content }).catch(saveError => {
        setError(`Save failed while closing ${target.name}: ${saveError}`);
      });
    }
    setEditorTabs(prev => {
      const idx = prev.findIndex(tab => tab.path === path);
      if (idx < 0) return prev;
      const next = prev.filter(tab => tab.path !== path);
      if (activeEditorPath === path) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[idx] ?? null;
        setActiveEditorPath(fallback ? fallback.path : null);
      }
      return next;
    });
  }, [activeEditorPath]);

  const updateEditorTabContent = useCallback((path: string, content: string) => {
    setEditorTabs(prev => prev.map(tab => (
      tab.path === path
        ? { ...tab, content, isDirty: true, error: null }
        : tab
    )));
    queueEditorSave(path);
  }, [queueEditorSave]);

  const openEntry = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      navigate(entry.path);
      return;
    }
    const ext = entry.extension.toLowerCase();

    if (isEditableTextEntry(entry)) {
      await openEditorTab(entry);
      return;
    }

    if (IMAGE_EXTS.has(ext)) {
      await previewEntry(entry);
      return;
    }

    if (EXEC_EXTS.has(ext)) {
      await invoke('fs_open_file', { path: entry.path }).catch(e => setError(String(e)));
      return;
    }

    await invoke('fs_open_file', { path: entry.path }).catch(e => setError(String(e)));
  }, [navigate, openEditorTab, previewEntry]);

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
      await invoke('fs_rename', { oldPath, newPath });
      const pendingTimer = editorSaveTimers.current.get(oldPath);
      if (pendingTimer) {
        window.clearTimeout(pendingTimer);
        editorSaveTimers.current.delete(oldPath);
      }
      setEditorTabs(prev => prev.map(tab => (
        tab.path === oldPath
          ? { ...tab, path: newPath, name: newName, error: null }
          : tab
      )));
      if (activeEditorPath === oldPath) {
        setActiveEditorPath(newPath);
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
      closeEditorTab(deleteTarget.path);
      setDeleteTarget(null); refresh();
    } catch(e) { setError(String(e)); }
  };

  // ── Context menu builder ──
  const buildCtxItems = useCallback((entry: FileEntry): CtxItem[] => {
    const isBookmarked = bookmarks.some(b => b.path === entry.path);
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
        if (isBookmarked) setBookmarks(b => b.filter(bk => bk.path !== entry.path));
        else { setBookmarks(b => [...b, { id:crypto.randomUUID(), name:entry.name, path:entry.path }]); onAddBookmark(entry.name, entry.path); }
      }},
      { label: '', icon:null, divider:true, action:()=>{} },
      { label:'Delete', icon:<Trash2 size={13}/>, danger:true, action:() => setDeleteTarget(entry) },
    ];
  }, [bookmarks, openAsAdmin, openEntry, duplicate, onOpenInTerminal, onAddBookmark, paste, queueClipboard]);

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
    if (plainClick && !entry.is_dir) {
      void previewEntry(entry);
    }
  };

  // ── Keyboard ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (rename.active || newItem.visible || addressEditing) return;
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        queueClipboard('copy');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        queueClipboard('cut');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') paste();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [addressEditing, beginAddressEdit, newItem.visible, paste, queueClipboard, refresh, rename.active, selected, visibleEntries]);

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
    e.dataTransfer.setData('text/plain', dragEntries[0]?.path ?? entry.path);
    e.dataTransfer.setData('application/x-overlayterm-paths', JSON.stringify(dragEntries.map(item => item.path)));
    const toFileUri = (value: string) => {
      const normalized = value.replace(/\\/g, '/');
      return normalized.startsWith('/')
        ? `file://${encodeURI(normalized)}`
        : `file:///${encodeURI(normalized)}`;
    };
    const uriList = dragEntries.map(item => toFileUri(item.path)).join('\r\n');
    e.dataTransfer.setData('text/uri-list', uriList);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const onDragOver = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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
    if (sources.length === 0) return;
    try {
      await transferIntoDirectory(targetDir, sources, 'move');
      refresh();
    } catch(e) { setError(String(e)); }
  };

  const activeEditorTab = useMemo(
    () => editorTabs.find(tab => tab.path === activeEditorPath) ?? null,
    [editorTabs, activeEditorPath],
  );
  const effectiveViewMode = isCompactDock || isSearchActive ? 'list' : viewMode;
  const showEditorPane = !isCompactDock && editorTabs.length > 0;
  const hasPreview = !isCompactDock && !showEditorPane && preview.type !== 'none';
  const searchModeLabel = searchIncludeContent ? 'Recursive search + text' : 'Recursive search (names only)';

  const renderSearchMetadata = (entry: FileEntry) => {
    if (!isSearchActive) return null;
    const searchEntry = entry as FileSearchResult;
    const matchLabel = searchEntry.match_kind === 'name_and_content'
      ? 'Name + content'
      : searchEntry.match_kind === 'content'
        ? 'Content match'
        : 'Name match';

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:4, minWidth:0 }}>
        <div style={{ fontSize:9, color:EXP.muted2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {searchEntry.relative_path || searchEntry.path}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
          {searchEntry.line_number != null && (
            <span style={{ fontSize:9, color:accent, fontFamily:'monospace', flexShrink:0 }}>L{searchEntry.line_number}</span>
          )}
          {searchEntry.snippet && (
            <span style={{ fontSize:9, color:EXP.text, opacity:0.88, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {searchEntry.snippet}
            </span>
          )}
        </div>
        <div style={{ fontSize:9, color:EXP.muted, letterSpacing:'0.03em', textTransform:'uppercase' }}>
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

  return (
    <div
      style={{ flex:1, display:'flex', overflow:'hidden', background:EXP.bg, color:EXP.text, fontFamily:uiFont, position:'relative' }}
      onClick={() => { setSelected(new Set()); setCtxMenu(c => ({...c, visible:false})); }}
      onContextMenu={e => { e.preventDefault(); setCtxMenu(c => ({...c, visible:false})); }}
    >
      {/* ══ SIDEBAR ══ */}
      <div style={{ width:sidebarWidth, background:EXP.sidebar, borderRight:`1px solid ${EXP.border}`, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', position:'relative' }}>
        
        {/* Drag Handle */}
        <div
          onMouseDown={e => {
            e.preventDefault();
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMouseMove = (me: MouseEvent) => setSidebarWidth(
              Math.max(isCompactDock ? 160 : 150, Math.min(isCompactDock ? 320 : 600, startW + (me.clientX - startX))),
            );
            const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
            window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
          }}
          style={{ position:'absolute', right:0, top:0, bottom:0, width:4, cursor:'col-resize', zIndex:10, background:'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = `${accent}55`}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        />

        {/* Drives */}
        <div style={{ padding:isCompactDock ? '8px 10px 4px' : '10px 12px 4px' }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:EXP.muted }}>Drives</span>
        </div>
        {drives.map(d => {
          const used = d.total_bytes > 0 ? (d.total_bytes - d.free_bytes) / d.total_bytes : 0;
          const isActive = currentPath.toUpperCase().startsWith(d.letter.toUpperCase());
          return (
            <button key={d.letter} onClick={() => navigate(d.letter)}
              style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:isCompactDock ? '5px 10px' : '5px 12px', background: isActive ? `${accent}18` : 'transparent', borderLeft:`2px solid ${isActive ? accent : 'transparent'}`, border:'none', cursor:'pointer', color:EXP.text, textAlign:'left' }}
            >
              <HardDrive size={13} style={{ color: isActive ? accent : EXP.muted, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                  <span style={{ fontWeight:500 }}>{d.label}</span>
                  <span style={{ color:EXP.muted, fontSize:10 }}>{d.letter}</span>
                </div>
                <div style={{ height:2, background:'rgba(255,255,255,0.06)', borderRadius:1, marginTop:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${used*100}%`, background: used>0.9 ? EXP.red : accent, borderRadius:1 }} />
                </div>
              </div>
            </button>
          );
        })}

        <div style={{ height:1, background:EXP.border, margin:'6px 0' }} />

        {/* Bookmarks */}
        <div style={{ padding:isCompactDock ? '4px 10px' : '4px 12px' }}>
          <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:EXP.muted }}>Bookmarks</span>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {/* Home quick-link */}
          <button
            onClick={() => invoke<string>('fs_get_home_dir').then(p => navigate(p)).catch(() => {})}
            style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:isCompactDock ? '5px 10px' : '5px 12px', background:'transparent', border:'none', cursor:'pointer', color:EXP.muted, textAlign:'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Home size={12} style={{ color:accent }} />
            <span style={{ fontSize:11 }}>Home</span>
          </button>

          {bookmarks.map(bk => (
            <div key={bk.id} style={{ display:'flex', alignItems:'center' }}>
              <button
                onClick={() => navigate(bk.path)}
                style={{ display:'flex', alignItems:'center', gap:8, flex:1, padding:isCompactDock ? '5px 10px' : '5px 12px', background: currentPath === bk.path ? `${accent}18` : 'transparent', border:'none', cursor:'pointer', color: currentPath === bk.path ? EXP.text : EXP.muted, textAlign:'left', borderLeft:`2px solid ${currentPath===bk.path ? accent : 'transparent'}` }}
                onMouseEnter={e => { if(currentPath!==bk.path) e.currentTarget.style.background='rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if(currentPath!==bk.path) e.currentTarget.style.background='transparent'; }}
              >
                <Star size={11} style={{ color:EXP.yellow }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bk.name}</div>
                  <div style={{ fontSize:9, color:EXP.muted2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace' }}>{bk.path}</div>
                </div>
              </button>
              <button onClick={() => setBookmarks(b => b.filter(b2 => b2.id !== bk.id))}
                style={{ background:'none', border:'none', cursor:'pointer', color:EXP.muted2, padding:'5px 8px', flexShrink:0 }}
                onMouseEnter={e => (e.currentTarget.style.color = EXP.red)}
                onMouseLeave={e => (e.currentTarget.style.color = EXP.muted2)}
              ><X size={10} /></button>
            </div>
          ))}
          {bookmarks.length === 0 && <p style={{ fontSize:10, color:EXP.muted2, padding:'4px 14px' }}>Right-click folder → Bookmark</p>}
        </div>
      </div>

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
            <button onClick={() => setViewMode(v => v==='grid'?'list':'grid')} title="Toggle view (Grid/List)"
              style={{ background:'none', border:'none', cursor:'pointer', color:EXP.muted, padding:5, borderRadius:5, display:'flex' }}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.06)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
            >{viewMode==='grid' ? <List size={14}/> : <Grid size={14}/>}</button>
          )}

          <button onClick={() => setShowHidden(h=>!h)} title="Toggle hidden files"
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

        {/* Error bar */}
        {error && (
          <div style={{ background:'rgba(248,113,113,0.12)', borderBottom:`1px solid rgba(248,113,113,0.3)`, padding:'6px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ color:EXP.red, fontSize:11 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background:'none', border:'none', cursor:'pointer', color:EXP.red }}><X size={12}/></button>
          </div>
        )}

        {/* File area + preview */}
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          <div ref={mainRef} tabIndex={0}
            style={{ flex:1, overflowY:'auto', padding: effectiveViewMode==='grid'?12:0, outline:'none' }}
            onDragOver={e => { e.preventDefault(); setDragOver('__main__'); }}
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
            {/* Inline new-item row */}
            {newItem.visible && effectiveViewMode === 'grid' && (
              <div style={{ background:EXP.card, border:`1px solid ${accent}`, borderRadius:8, padding:8, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <SvgIcon src={newItem.kind==='folder' ? '/icons/folder.svg' : '/icons/txt.svg'} size={36} />
                <input
                  autoFocus value={newItemName} onChange={e=>setNewItemName(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter') commitNew(); if(e.key==='Escape') setNewItem({visible:false,kind:'folder'}); }}
                  onBlur={commitNew}
                  placeholder={newItem.kind === 'folder' ? 'folder name' : 'name.ext'}
                  style={{ background:'#1e2130', border:`1px solid ${accent}`, borderRadius:4, color:EXP.text, fontSize:11, padding:'2px 6px', outline:'none', width:'100%', boxSizing:'border-box' as const }}
                />
              </div>
            )}

            {!loading && effectiveViewMode === 'grid' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:6 }}>
                {visibleEntries.map(entry => {
                  const isSel = selected.has(entry.path);
                  const isDrop = dragOver === entry.path && entry.is_dir;
                  const isRenaming = rename.active && rename.path === entry.path;
                  const iconSrc = getIconSrc(entry, isSel || isDrop, {
                    rules: explorerSettings.folderIconRules,
                    defaultIcon: explorerSettings.defaultFolderIcon,
                  });
                  return (
                    <div key={entry.path}
                      draggable
                      data-overlay-drag-source="file"
                      onDragStart={e => onDragStart(e, entry)}
                      onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
                      onClick={e => onEntryClick(e, entry)}
                      onDoubleClick={() => openEntry(entry)}
                      onContextMenu={e => onRightClick(e, entry)}
                      title={getSearchTooltip(entry)}
                      style={{
                        background: isDrop ? `${accent}33` : isSel ? EXP.selected : EXP.card,
                        border:`1px solid ${isDrop ? accent : isSel ? EXP.selBord : EXP.border}`,
                        borderRadius:8, padding:8, cursor:'pointer',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                        opacity:entry.is_hidden?0.5:1, userSelect:'none',
                        transition:'background 0.1s, border-color 0.1s',
                      }}
                      onMouseEnter={e => { if(!isSel && !isDrop)(e.currentTarget as HTMLDivElement).style.background=EXP.cardHov; }}
                      onMouseLeave={e => { if(!isSel && !isDrop)(e.currentTarget as HTMLDivElement).style.background=EXP.card; }}
                      >
                        <div style={{ width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:6, overflow:'hidden', flexShrink:0 }}>
                          <SvgIcon src={iconSrc} size={36} />
                        </div>
                        {isRenaming
                          ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active:false, path:'', name:'' })} />
                          : <span style={{ fontSize:10, textAlign:'center', color:EXP.text, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', width:'100%', lineHeight:1.3 }}>{entry.name}</span>
                        }
                        {renderSearchMetadata(entry)}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Inline new-item row in list mode */}
            {newItem.visible && effectiveViewMode === 'list' && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}><tbody>
                <tr style={{ background:`${accent}11`, borderBottom:`1px solid ${EXP.border}` }}>
                  <td style={{ padding:'4px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <SvgIcon src={newItem.kind==='folder' ? '/icons/folder.svg' : '/icons/txt.svg'} size={16} />
                      <input autoFocus value={newItemName} onChange={e=>setNewItemName(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter') commitNew(); if(e.key==='Escape') setNewItem({visible:false,kind:'folder'}); }}
                        onBlur={commitNew}
                        placeholder={newItem.kind === 'folder' ? 'folder name' : 'notes.md / app.py'}
                        style={{ background:'#1e2130', border:`1px solid ${accent}`, borderRadius:4, color:EXP.text, fontSize:12, padding:'2px 6px', outline:'none', flex:1 }}
                      />
                    </div>
                  </td>
                  <td/><td/><td/>
                </tr>
              </tbody></table>
            )}

            {!loading && effectiveViewMode === 'list' && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:EXP.panel, position:'sticky', top:0, zIndex:2 }}>
                    {['Name','Size','Modified','Type'].map(col => (
                      <th key={col} style={{ padding:'6px 12px', textAlign:'left', color:EXP.muted, fontWeight:600, fontSize:10, letterSpacing:'0.06em', textTransform:'uppercase', borderBottom:`1px solid ${EXP.border}` }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map(entry => {
                    const isSel = selected.has(entry.path);
                    const isDrop = dragOver === entry.path && entry.is_dir;
                    const isRenaming = rename.active && rename.path === entry.path;
                    const iconSrc = getIconSrc(entry, isSel || isDrop, {
                      rules: explorerSettings.folderIconRules,
                      defaultIcon: explorerSettings.defaultFolderIcon,
                    });
                    return (
                    <tr key={entry.path}
                        draggable
                        data-overlay-drag-source="file"
                        onDragStart={e => onDragStart(e, entry)}
                        onDragOver={entry.is_dir ? e => onDragOver(e, entry.path) : undefined}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={entry.is_dir ? e => onDrop(e, entry.path) : undefined}
                        onClick={e => onEntryClick(e, entry)}
                        onDoubleClick={() => openEntry(entry)}
                        onContextMenu={e => onRightClick(e, entry)}
                        title={getSearchTooltip(entry)}
                        style={{ background:isDrop?`${accent}22`:isSel?EXP.selected:'transparent', cursor:'pointer', opacity:entry.is_hidden?0.5:1, userSelect:'none', borderBottom:`1px solid ${EXP.border}` }}
                        onMouseEnter={e => { if(!isSel && !isDrop)(e.currentTarget as HTMLTableRowElement).style.background=EXP.cardHov; }}
                        onMouseLeave={e => { if(!isSel && !isDrop)(e.currentTarget as HTMLTableRowElement).style.background='transparent'; }}
                      >
                        <td style={{ padding:'4px 12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <SvgIcon src={iconSrc} size={16} />
                            {isRenaming
                              ? <RenameInput state={rename} onCommit={commitRename} onCancel={() => setRename({ active:false, path:'', name:'' })} />
                              : <span style={{ color: isSel?EXP.text:entry.is_dir?EXP.yellow:EXP.text, fontWeight:entry.is_dir?500:400 }}>{entry.name}</span>
                            }
                            {entry.is_symlink && <span style={{ fontSize:9, color:EXP.muted, background:'rgba(255,255,255,0.06)', borderRadius:3, padding:'1px 4px' }}>symlink</span>}
                          </div>
                          {renderSearchMetadata(entry)}
                        </td>
                        <td style={{ padding:'4px 12px', color:EXP.muted, fontFamily:'monospace', whiteSpace:'nowrap' }}>{entry.is_dir ? '—' : formatSize(entry.size)}</td>
                        <td style={{ padding:'4px 12px', color:EXP.muted, whiteSpace:'nowrap' }}>{formatDate(entry.modified)}</td>
                        <td style={{ padding:'4px 12px', color:EXP.muted2 }}>{entry.is_dir ? 'Folder' : (entry.extension.toUpperCase()||'File')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Side pane */}
          {showEditorPane && (
            <EditorTabsPanel
              tabs={editorTabs}
              activePath={activeEditorTab?.path ?? null}
              onSelect={setActiveEditorPath}
              onCloseTab={closeEditorTab}
              onChangeContent={updateEditorTabContent}
            />
          )}
          {hasPreview && <PreviewPanel preview={preview} onClose={() => setPreview({ type:'none', path:'' })} />}
        </div>

        {/* Status bar */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'3px 12px', background:EXP.sidebar, borderTop:`1px solid ${EXP.border}`, fontSize:10, color:EXP.muted, flexShrink:0 }}>
          <span>{visibleEntries.length} item{visibleEntries.length!==1?'s':''}</span>
          {selected.size > 0 && <span style={{ color:accent }}>{selected.size} selected</span>}
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
