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

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
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
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import {
  ensureFontFamilyLoaded,
  multiplyColorAlpha,
  resolveOverlayAppearance,
  type OverlayThemeDefinition,
  type ResolvedOverlayAppearance,
} from '../config/appearance';
import {
  createPythonRuntimeConfig,
  formatCommandOutput,
  pythonExamplePresets,
  summarizeInterpreter,
  type PythonActionResponse,
  type PythonExamplePreset,
  type PythonRuntimeStatus,
} from '../config/python';
import { useTerminalStore, type Bookmark } from '../store/terminalStore';
import { useSettingsStore } from '../store/settingsStore';
import { OverlayScrollArea } from './OverlayScrollArea';

export type ThemeId = 'operator' | 'dracula' | 'nord' | 'monokai' | 'github-dark' | 'catppuccin';

interface Theme {
  name: string;
  bg: string;
  bgPanel: string;
  bgTerm: string;
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

function themeFromAppearance(theme: OverlayThemeDefinition): Theme {
  return {
    name: theme.name,
    bg: theme.palette.shellBackground,
    bgPanel: theme.palette.panelBackground,
    bgTerm: multiplyColorAlpha(theme.palette.terminalBackground, 0.78),
    accent: theme.palette.accent,
    text: theme.palette.textPrimary,
    textMuted: theme.palette.textMuted,
    border: theme.palette.border,
    xt: theme.xterm,
  };
}

const THEMES: Record<ThemeId, Theme> = {
  operator: {
    name: 'Operator',
    bg: '#07070f', bgPanel: '#0b0b18', bgTerm: '#05050e',
    accent: '#6366f1', text: '#e2e2f0', textMuted: 'rgba(226,226,240,0.4)', border: 'rgba(255,255,255,0.06)',
    xt: {
      background: '#05050e', foreground: '#c9d1d9', cursor: '#6366f1',
      black: '#161b22', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
      blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
      brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
      brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
    },
  },
  dracula: {
    name: 'Dracula',
    bg: '#1e1f29', bgPanel: '#22233a', bgTerm: '#191a26',
    accent: '#bd93f9', text: '#f8f8f2', textMuted: 'rgba(248,248,242,0.45)', border: 'rgba(189,147,249,0.12)',
    xt: {
      background: '#191a26', foreground: '#f8f8f2', cursor: '#bd93f9',
      black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
      blue: '#6272a4', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
      brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
      brightCyan: '#a4ffff', brightWhite: '#ffffff',
    },
  },
  nord: {
    name: 'Nord',
    bg: '#1c1f26', bgPanel: '#21252e', bgTerm: '#181c24',
    accent: '#88c0d0', text: '#eceff4', textMuted: 'rgba(236,239,244,0.45)', border: 'rgba(136,192,208,0.12)',
    xt: {
      background: '#181c24', foreground: '#d8dee9', cursor: '#88c0d0',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
      blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb', brightWhite: '#eceff4',
    },
  },
  monokai: {
    name: 'Monokai',
    bg: '#1a1b18', bgPanel: '#1f2018', bgTerm: '#161712',
    accent: '#e6db74', text: '#f8f8f2', textMuted: 'rgba(248,248,242,0.45)', border: 'rgba(230,219,116,0.12)',
    xt: {
      background: '#161712', foreground: '#f8f8f2', cursor: '#f8f8f2',
      black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#e6db74',
      blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
      brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e',
      brightYellow: '#e6db74', brightBlue: '#66d9ef', brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
    },
  },
  'github-dark': {
    name: 'GitHub Dark',
    bg: '#0d1117', bgPanel: '#161b22', bgTerm: '#0a0e14',
    accent: '#58a6ff', text: '#c9d1d9', textMuted: 'rgba(201,209,217,0.4)', border: 'rgba(48,54,61,0.8)',
    xt: {
      background: '#0a0e14', foreground: '#c9d1d9', cursor: '#58a6ff',
      black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
      blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
      brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
      brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
    },
  },
  catppuccin: {
    name: 'Catppuccin',
    bg: '#1e1e2e', bgPanel: '#24273a', bgTerm: '#181825',
    accent: '#cba6f7', text: '#cdd6f4', textMuted: 'rgba(205,214,244,0.45)', border: 'rgba(203,166,247,0.12)',
    xt: {
      background: '#181825', foreground: '#cdd6f4', cursor: '#cba6f7',
      black: '#313244', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#cba6f7', cyan: '#89dceb', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#cba6f7',
      brightCyan: '#89dceb', brightWhite: '#a6adc8',
    },
  },
};

// ─── UI Font catalogue ────────────────────────────────────────────────────────

const UI_FONTS = [
  { name: 'Inter',          value: 'Inter, system-ui, sans-serif' },
  { name: 'Geist',          value: 'Geist, Inter, system-ui, sans-serif' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { name: 'Fira Code',      value: 'Fira Code, monospace' },
  { name: 'IBM Plex Mono',  value: '"IBM Plex Mono", monospace' },
  { name: 'System Default', value: 'system-ui, sans-serif' },
];

// Inject Google Fonts link on demand
const loadedFonts = new Set<string>();
function ensureFont(font: string) {
  const name = font.split(',')[0].trim().replace(/['"]/g, '');
  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const safeName = encodeURIComponent(name);
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${safeName}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

void THEMES;
void UI_FONTS;
void ensureFont;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tab { id: string; label: string; }
type SidebarPanel = 'dirs' | 'cmds' | 'python' | null;
type SidebarPanelId = Exclude<SidebarPanel, null>;

const TERMINAL_SIDEBAR_ITEMS: {
  id: SidebarPanelId;
  icon: ComponentType<{ size?: number }>;
  title: string;
  accent?: 'success' | 'default';
}[] = [
  { id: 'dirs', icon: Folder, title: 'Directories' },
  { id: 'cmds', icon: Zap, title: 'Commands', accent: 'success' },
  { id: 'python', icon: Bot, title: 'Python' },
];

interface TerminalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders as embedded panel (no outer slide animation, no grab handle) */
  embedded?: boolean;
  appearance?: ResolvedOverlayAppearance;
}

// ─── XTerm registry ───────────────────────────────────────────────────────────

interface XTermEntry { xterm: XTerm; fitAddon: FitAddon; unlisten: () => void; }
const xtermRegistry = new Map<string, XTermEntry>();

function destroyXterm(id: string) {
  const e = xtermRegistry.get(id);
  if (!e) return;
  e.unlisten(); e.xterm.dispose();
  invoke('terminal_kill', { id }).catch(() => {});
  xtermRegistry.delete(id);
}

function collectTerminalBufferText(xterm: XTerm): string {
  const lines: string[] = [];
  const buffer = xterm.buffer.active;
  for (let index = 0; index < buffer.length; index += 1) {
    const line = buffer.getLine(index);
    if (!line) continue;
    lines.push(line.translateToString(true));
  }
  return lines.join('\n').trimEnd();
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand for environments without clipboard permissions.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const didCopy = document.execCommand('copy');
    document.body.removeChild(textarea);
    return didCopy;
  } catch {
    return false;
  }
}

function formatCopiedLineLabel(text: string): string {
  const lineCount = text.split(/\r?\n/g).filter(line => line.length > 0).length;
  return `${Math.max(lineCount, 1)} line${lineCount === 1 ? '' : 's'}`;
}

interface TerminalToolbarAction {
  id: string;
  label: string;
  title: string;
  icon: ComponentType<{ size?: number }>;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'default';
}

interface TerminalActionToolbarProps {
  actions: TerminalToolbarAction[];
  theme: Theme;
  detail: string;
}

function TerminalActionToolbar({ actions, theme, detail }: TerminalActionToolbarProps) {
  return (
    <div
      className="flex items-center gap-1 px-2 shrink-0 border-b"
      style={{ height: 32, background: theme.bgPanel, borderColor: theme.border }}
    >
      {actions.map(action => {
        const Icon = action.icon;
        const isAccent = action.tone === 'accent';
        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              color: action.disabled
                ? theme.textMuted
                : isAccent
                  ? theme.accent
                  : theme.text,
              background: action.disabled
                ? 'transparent'
                : isAccent
                  ? `${theme.accent}18`
                  : 'rgba(255,255,255,0.04)',
              border: `1px solid ${action.disabled ? theme.border : isAccent ? `${theme.accent}44` : theme.border}`,
            }}
          >
            <Icon size={11} />
            <span>{action.label}</span>
          </button>
        );
      })}

      <div className="flex-1" />

      <span
        className="text-[9px] select-none"
        style={{ color: theme.textMuted }}
      >
        {detail}
      </span>
    </div>
  );
}

// ─── XTermPane ────────────────────────────────────────────────────────────────

interface XTermPaneProps { id: string; visible: boolean; theme: Theme; onReady?: (id: string) => void; }

function XTermPane({ id, visible, theme, onReady }: XTermPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef   = useRef(false);
  const settings     = useSettingsStore(s => s.settings.terminal);

  const boot = useCallback(async () => {
    if (!containerRef.current || mountedRef.current) return;
    mountedRef.current = true;

    const term = new XTerm({
      theme: {
        ...theme.xt,
        cursorAccent: theme.bgTerm,
        selectionBackground: theme.accent + '44',
        selectionForeground: '#ffffff',
      },
      fontFamily:        settings.fontFamily || 'JetBrains Mono, Fira Code, monospace',
      fontSize:          settings.fontSize   || 13,
      lineHeight:        1.35,
      letterSpacing:     0.3,
      cursorBlink:       settings.cursorBlink  ?? true,
      cursorStyle:       settings.cursorStyle   || 'bar',
      scrollback:        settings.scrollback    || 10000,
      allowTransparency: false,
      convertEol:        true,
      scrollOnUserInput: true,
    });

    const fit      = new FitAddon();
    const webLinks = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    term.open(containerRef.current);
    fit.fit();

    try {
      await invoke('terminal_spawn', { id, rows: term.rows, cols: term.cols });
    } catch (e) {
      term.writeln('\r\n\x1b[31mFailed to spawn PTY:\x1b[0m ' + String(e));
    }

    const unlisten = await listen<string>(`terminal-output-${id}`, ev => term.write(ev.payload));
    term.onData(data => invoke('terminal_write', { id, data }).catch(() => {}));
    term.onResize(({ rows: r, cols: c }) =>
      invoke('terminal_resize', { id, rows: r, cols: c }).catch(() => {}));

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(containerRef.current!);

    xtermRegistry.set(id, {
      xterm: term, fitAddon: fit,
      unlisten: () => { unlisten(); ro.disconnect(); },
    });
    onReady?.(id);
    term.focus();
  }, [id, onReady, settings, theme]);

  useEffect(() => {
    if (visible) {
      const raf = requestAnimationFrame(() => boot());
      return () => cancelAnimationFrame(raf);
    }
  }, [visible, boot]);

  useEffect(() => {
    if (visible) {
      const entry = xtermRegistry.get(id);
      if (entry) {
        requestAnimationFrame(() => entry.fitAddon.fit());
        requestAnimationFrame(() => entry.xterm.focus());
      }
    }
  }, [visible, id]);

  useEffect(() => () => {
    mountedRef.current = false;
    destroyXterm(id);
  }, [id]);

  return (
    <div
      ref={containerRef}
      style={{
        display: visible ? 'block' : 'none',
        padding: '6px 8px',
        boxSizing: 'border-box',
      }}
      className="absolute inset-0"
    />
  );
}

// ─── Bookmark chip ────────────────────────────────────────────────────────────

interface ChipProps {
  bm: Bookmark; icon: React.ReactNode; accentStyle: string;
  onPrimary: () => void; onRun?: () => void; onDelete: () => void;
}
function BookmarkChip({ bm, icon, accentStyle, onPrimary, onRun, onDelete }: ChipProps) {
  return (
    <div className="group flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.06] transition-colors">
      <span className="shrink-0 opacity-60" style={{ color: accentStyle }}>{icon}</span>
      <button onClick={onPrimary} className="flex-1 min-w-0 text-left">
        <span className="block text-[11px] font-medium opacity-80 group-hover:opacity-100 truncate transition-opacity" style={{ color: 'inherit' }}>{bm.name}</span>
        <span className="block text-[9px] opacity-25 font-mono truncate group-hover:opacity-50 transition-opacity">{bm.value}</span>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onRun && (
          <button onClick={onRun} className="p-1 rounded hover:bg-white/10 transition-all" title="Run" style={{ color: accentStyle }}>
            <Play size={10} />
          </button>
        )}
        <button onClick={onDelete} className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Mini adder ───────────────────────────────────────────────────────────────

interface AdderProps { ph1: string; ph2: string; accent: string; onConfirm: (n: string, v: string) => void; onCancel: () => void; }
function MiniAdder({ ph1, ph2, accent, onConfirm, onCancel }: AdderProps) {
  const [n, setN] = useState('');
  const [v, setV] = useState('');
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' && n.trim() && v.trim()) onConfirm(n.trim(), v.trim());
    if (e.key === 'Escape') onCancel();
  };
  return (
    <div className="mx-1 my-1 rounded border p-2 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}>
      <input autoFocus value={n} onChange={e => setN(e.target.value)} onKeyDown={onKey}
        placeholder={ph1} className="w-full bg-transparent text-[11px] text-white outline-none placeholder:opacity-30 border-b border-white/10 pb-1" />
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={onKey}
        placeholder={ph2} className="w-full bg-transparent text-[10px] text-white/60 font-mono outline-none placeholder:opacity-30" />
      <div className="flex justify-end gap-1 pt-0.5">
        <button onClick={onCancel} className="text-[9px] opacity-40 hover:opacity-75 px-1.5 py-0.5 rounded transition-colors">Cancel</button>
        <button onClick={() => n.trim() && v.trim() && onConfirm(n.trim(), v.trim())} disabled={!n.trim() || !v.trim()}
          style={{ background: accent + '33', color: accent }}
          className="text-[9px] px-1.5 py-0.5 rounded disabled:opacity-30 hover:opacity-90 transition-all">Add</button>
      </div>
    </div>
  );
}

interface PythonSidebarContentProps {
  theme: Theme;
  emitToTerminal: (label: string, body: string, tone?: 'info' | 'success' | 'error') => void;
  announce: (message: string) => void;
}

function PythonSidebarContent({ theme, emitToTerminal, announce }: PythonSidebarContentProps) {
  const pythonSettings = useSettingsStore(s => s.settings.python);
  const runtimeConfig = useMemo(
    () => createPythonRuntimeConfig(pythonSettings),
    [pythonSettings],
  );
  const [status, setStatus] = useState<PythonRuntimeStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);

    try {
      const nextStatus = await invoke<PythonRuntimeStatus>('python_get_runtime_status', {
        config: runtimeConfig,
      });
      setStatus(nextStatus);
    } catch (error) {
      const errorText = String(error);
      setStatusError(errorText);
      announce(`Python status failed: ${errorText}`);
    } finally {
      setLoadingStatus(false);
    }
  }, [announce, runtimeConfig]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const runAction = useCallback(async (
    label: string,
    factory: () => Promise<PythonActionResponse>,
  ) => {
    setPendingAction(label);
    setStatusError(null);

    try {
      const response = await factory();
      setStatus(response.status);
      emitToTerminal('Python', formatCommandOutput(response.result), response.result.success ? 'success' : 'error');
      announce(label);
      return response;
    } catch (error) {
      const errorText = String(error);
      setStatusError(errorText);
      emitToTerminal('Python', `${label} failed\n\n${errorText}`, 'error');
      announce(`${label} failed`);
      return null;
    } finally {
      setPendingAction(null);
    }
  }, [announce, emitToTerminal]);

  const bootstrapRuntime = useCallback(async () => {
    await runAction('Bootstrapped Python runtime', () =>
      invoke<PythonActionResponse>('python_bootstrap_runtime', {
        config: runtimeConfig,
      }));
  }, [runAction, runtimeConfig]);

  const installConfiguredPackages = useCallback(async () => {
    await runAction('Installed configured Python packages', () =>
      invoke<PythonActionResponse>('python_install_packages', {
        request: {
          config: runtimeConfig,
          packageInput: pythonSettings.bootstrapPackages,
          persistToRequirements: true,
        },
      }));
  }, [pythonSettings.bootstrapPackages, runAction, runtimeConfig]);

  const runPreset = useCallback(async (preset: PythonExamplePreset) => {
    await runAction(`Ran ${preset.label}`, () =>
      invoke<PythonActionResponse>('python_execute', {
        request: {
          config: runtimeConfig,
          executionMode: preset.mode,
          entry: preset.entry,
          arguments: [],
          workingDirectory: null,
          environment: {},
          useManagedEnvironment: true,
        },
      }));
  }, [runAction, runtimeConfig]);

  const buttonStyle = {
    border: `1px solid ${theme.border}`,
    background: 'rgba(255,255,255,0.04)',
    color: theme.text,
  } as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: theme.border }}>
        <span className="text-[10px] font-bold tracking-widest uppercase opacity-30">Python</span>
        <button
          onClick={() => void refreshStatus()}
          disabled={loadingStatus || Boolean(pendingAction)}
          className="px-2 py-1 rounded text-[9px] uppercase tracking-[0.18em] disabled:opacity-35"
          style={{ ...buttonStyle, color: theme.textMuted }}
          title="Refresh managed Python status"
        >
          Refresh
        </button>
      </div>

      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ paddingTop: 8, paddingBottom: 8 }}>
        <div className="px-3 space-y-3">
          <div
            className="rounded border px-3 py-2"
            style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
              Managed Runtime
            </div>
            <div className="mt-2 text-[11px]" style={{ color: theme.text }}>
              {loadingStatus ? 'Checking runtime…' : status?.ready ? 'Managed env ready' : 'Bootstrap required'}
            </div>
            <div className="mt-1 text-[10px]" style={{ color: theme.textMuted }}>
              {summarizeInterpreter(status?.baseInterpreter ?? null)}
            </div>
            <div className="mt-1 text-[10px] font-mono break-all" style={{ color: theme.textMuted }}>
              {status?.managedPythonPath ?? 'Managed interpreter not created yet'}
            </div>
            {statusError && (
              <div className="mt-2 text-[10px]" style={{ color: '#f87171' }}>
                {statusError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => void bootstrapRuntime()}
              disabled={Boolean(pendingAction)}
              className="flex items-center justify-between rounded px-2.5 py-2 text-[10px] font-medium disabled:opacity-35"
              style={buttonStyle}
              title="Create or repair the managed Python environment"
            >
              <span>Bootstrap Runtime</span>
              <Rocket size={11} />
            </button>

            <button
              type="button"
              onClick={() => void installConfiguredPackages()}
              disabled={Boolean(pendingAction) || !pythonSettings.bootstrapPackages.trim()}
              className="flex items-center justify-between rounded px-2.5 py-2 text-[10px] font-medium disabled:opacity-35"
              style={buttonStyle}
              title="Install the packages configured in Python settings"
            >
              <span>Install Configured Packages</span>
              <Play size={11} />
            </button>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
              Quick Runs
            </div>
            <div className="space-y-2">
              {pythonExamplePresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void runPreset(preset)}
                  disabled={Boolean(pendingAction) || !status?.ready}
                  className="w-full rounded border px-2.5 py-2 text-left disabled:opacity-35"
                  style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.03)' }}
                  title={preset.description}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium" style={{ color: theme.text }}>
                      {preset.label}
                    </span>
                    <Play size={10} style={{ color: theme.accent }} />
                  </div>
                  <div className="mt-1 text-[9px]" style={{ color: theme.textMuted }}>
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded border px-3 py-2" style={{ borderColor: theme.border, background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
              Package Queue
            </div>
            <div className="mt-2 text-[10px] font-mono whitespace-pre-wrap break-words" style={{ color: theme.text }}>
              {pythonSettings.bootstrapPackages.trim() || 'No configured packages yet'}
            </div>
          </div>
        </div>
      </OverlayScrollArea>
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

interface SidebarContentProps {
  panel: SidebarPanel; theme: Theme; appearance: ResolvedOverlayAppearance;
  injectCmd: (cmd: string) => void;
  injectCd:  (path: string) => void;
  emitToTerminal: (label: string, body: string, tone?: 'info' | 'success' | 'error') => void;
  announce: (message: string) => void;
}

function SidebarContent({ panel, theme, appearance, injectCmd, injectCd, emitToTerminal, announce }: SidebarContentProps) {
  const {
    directoryBookmarks, commandBookmarks,
    addDirectoryBookmark, removeDirectoryBookmark,
    addCommandBookmark,  removeCommandBookmark,
  } = useTerminalStore();

  const [addingDir, setAddingDir] = useState(false);
  const [addingCmd, setAddingCmd] = useState(false);

  const labelClass = 'text-[10px] font-bold tracking-widest uppercase opacity-30';

  if (panel === 'dirs') return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: theme.border }}>
        <span className={labelClass}>Directories</span>
        <button onClick={() => { setAddingDir(d => !d); setAddingCmd(false); }}
          className="p-0.5 rounded hover:bg-white/10 opacity-40 hover:opacity-100 transition-all">
          <Plus size={11} />
        </button>
      </div>
      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ paddingTop: 4, paddingBottom: 4 }}>
        {addingDir && (
          <MiniAdder ph1="Name (e.g. Project)" ph2="Path (e.g. ~/code/project)" accent={theme.accent}
            onConfirm={async (n, v) => { await addDirectoryBookmark({ id: crypto.randomUUID(), name: n, value: v }); setAddingDir(false); }}
            onCancel={() => setAddingDir(false)} />
        )}
        {directoryBookmarks.length === 0 && !addingDir && (
          <p className="text-[9px] opacity-20 px-3 py-2">No directories yet — click + to add</p>
        )}
        {directoryBookmarks.map(bm => (
          <BookmarkChip key={bm.id} bm={bm} icon={<Folder size={10} />} accentStyle={theme.accent}
            onPrimary={() => injectCd(bm.value)}
            onDelete={() => removeDirectoryBookmark(bm.id)} />
        ))}
      </OverlayScrollArea>
    </div>
  );

  if (panel === 'cmds') return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: theme.border }}>
        <span className={labelClass}>Commands</span>
        <button onClick={() => { setAddingCmd(c => !c); setAddingDir(false); }}
          className="p-0.5 rounded hover:bg-white/10 opacity-40 hover:opacity-100 transition-all">
          <Plus size={11} />
        </button>
      </div>
      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ paddingTop: 4, paddingBottom: 4 }}>
        {addingCmd && (
          <MiniAdder ph1="Name (e.g. Build)" ph2="Command (e.g. npm run build)" accent={theme.accent}
            onConfirm={async (n, v) => { await addCommandBookmark({ id: crypto.randomUUID(), name: n, value: v }); setAddingCmd(false); }}
            onCancel={() => setAddingCmd(false)} />
        )}
        {commandBookmarks.length === 0 && !addingCmd && (
          <p className="text-[9px] opacity-20 px-3 py-2">No commands yet — click + to add</p>
        )}
        {commandBookmarks.map(bm => (
          <BookmarkChip key={bm.id} bm={bm} icon={<Hash size={10} />} accentStyle={appearance.theme.palette.success}
            onPrimary={() => injectCmd(bm.value)}
            onRun={() => injectCmd(bm.value + '\r')}
            onDelete={() => removeCommandBookmark(bm.id)} />
        ))}
      </OverlayScrollArea>
    </div>
  );

  if (panel === 'python') return (
    <PythonSidebarContent theme={theme} emitToTerminal={emitToTerminal} announce={announce} />
  );

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TerminalOverlay({ isOpen, onClose, embedded = false, appearance: appearanceProp }: TerminalOverlayProps) {
  const settings = useSettingsStore(s => s.settings.terminal);
  const appearanceSettings = useSettingsStore(s => s.settings.appearance);
  const keybindings = useSettingsStore(s => s.settings.keybindings);
  const appearance = useMemo(
    () => appearanceProp ?? resolveOverlayAppearance({
      activeThemeId: appearanceSettings.activeThemeId,
      customThemes: appearanceSettings.customThemes,
      uiFontFamily: appearanceSettings.uiFontFamily,
      monoFontFamily: settings.fontFamily,
      panelTransparency: appearanceSettings.panelTransparency,
    }),
    [appearanceProp, appearanceSettings.activeThemeId, appearanceSettings.customThemes, appearanceSettings.panelTransparency, appearanceSettings.uiFontFamily, settings.fontFamily],
  );
  const theme = useMemo(() => themeFromAppearance(appearance.theme), [appearance.theme]);
  const uiFont = appearance.fonts.ui;

  useEffect(() => {
    ensureFontFamilyLoaded(uiFont);
    ensureFontFamilyLoaded(settings.fontFamily);
  }, [settings.fontFamily, uiFont]);

  // ── Tabs ──
  const [tabs, setTabs]         = useState<Tab[]>([{ id: 'overlay-0', label: 'pwsh' }]);
  const [activeId, setActiveId] = useState('overlay-0');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');

  // ── Sidebar ──
  const [activePanel, setActivePanel] = useState<SidebarPanel>('dirs');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [readyTerminalIds, setReadyTerminalIds] = useState<string[]>([]);
  const [terminalActionMessage, setTerminalActionMessage] = useState<string | null>(null);
  const actionMessageTimerRef = useRef<number | null>(null);

  // ── Store init ──
  const { initStore } = useTerminalStore();
  useEffect(() => { initStore(); }, [initStore]);

  // ── Mount guard ──
  const hasMountedRef = useRef(false);
  if (isOpen && !hasMountedRef.current) hasMountedRef.current = true;

  const setTransientActionMessage = useCallback((message: string) => {
    setTerminalActionMessage(message);
    if (actionMessageTimerRef.current !== null) {
      window.clearTimeout(actionMessageTimerRef.current);
    }
    actionMessageTimerRef.current = window.setTimeout(() => {
      setTerminalActionMessage(null);
      actionMessageTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => () => {
    if (actionMessageTimerRef.current !== null) {
      window.clearTimeout(actionMessageTimerRef.current);
    }
  }, []);

  // ── PTY helpers ──
  const injectCmd = useCallback(async (data: string) => {
    try { await invoke('terminal_write', { id: activeId, data: data + '\r' }); }
    catch (e) { console.error('inject cmd failed', e); }
  }, [activeId]);

  const injectCd = useCallback(async (path: string) => injectCmd(`cd '${path}'`), [injectCmd]);

  const emitToActiveTerminal = useCallback((
    label: string,
    body: string,
    tone: 'info' | 'success' | 'error' = 'info',
  ) => {
    const entry = xtermRegistry.get(activeId);
    if (!entry) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }

    const tonePrefix = tone === 'error'
      ? '\x1b[31m'
      : tone === 'success'
        ? '\x1b[32m'
        : '\x1b[36m';
    const normalized = body.trim().replace(/\r?\n/g, '\r\n');

    entry.xterm.write(`\r\n${tonePrefix}[${label}]\x1b[0m\r\n${normalized}\r\n`);
    entry.xterm.focus();
  }, [activeId, setTransientActionMessage]);

  const markTerminalReady = useCallback((id: string) => {
    setReadyTerminalIds(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const clearTerminalReady = useCallback((id: string) => {
    setReadyTerminalIds(prev => prev.filter(value => value !== id));
  }, []);

  const copyActiveTerminalOutput = useCallback(async () => {
    const entry = xtermRegistry.get(activeId);
    if (!entry) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }

    const selectedText = entry.xterm.getSelection().trim();
    const output = selectedText || collectTerminalBufferText(entry.xterm);
    if (!output) {
      setTransientActionMessage('No terminal output to copy');
      return;
    }

    const copied = await copyTextToClipboard(output);
    if (copied) {
      setTransientActionMessage(`Copied ${selectedText ? 'selection' : formatCopiedLineLabel(output)}`);
    } else {
      setTransientActionMessage('Clipboard write failed');
    }
    entry.xterm.focus();
  }, [activeId, setTransientActionMessage]);

  const clearActiveTerminal = useCallback(() => {
    const entry = xtermRegistry.get(activeId);
    if (!entry) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }
    entry.xterm.clear();
    entry.xterm.focus();
    setTransientActionMessage('Cleared terminal viewport');
  }, [activeId, setTransientActionMessage]);

  const restartActiveTerminal = useCallback(async () => {
    const entry = xtermRegistry.get(activeId);
    if (!entry) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }

    clearTerminalReady(activeId);

    try {
      await invoke('terminal_kill', { id: activeId });
      entry.xterm.reset();
      await invoke('terminal_spawn', { id: activeId, rows: entry.xterm.rows, cols: entry.xterm.cols });
      markTerminalReady(activeId);
      setTransientActionMessage(`Restarted ${tabs.find(tab => tab.id === activeId)?.label ?? 'terminal'}`);
    } catch (error) {
      setTransientActionMessage(`Restart failed: ${String(error)}`);
    }

    requestAnimationFrame(() => {
      entry.fitAddon.fit();
      entry.xterm.focus();
    });
  }, [activeId, clearTerminalReady, markTerminalReady, setTransientActionMessage, tabs]);

  // ── Listen for cd-inject from FileExplorer (must be after injectCd is defined) ──
  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent<string>).detail;
      if (path) injectCd(path);
    };
    window.addEventListener('overlayterm:cdinject', handler);
    return () => window.removeEventListener('overlayterm:cdinject', handler);
  }, [injectCd]);

  // ── Tab management ──
  const newTab = () => {
    const id  = `overlay-${Date.now()}`;
    const num = tabs.length + 1;
    setTabs(t => [...t, { id, label: `pwsh (${num})` }]);
    setActiveId(id);
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    destroyXterm(id);
    clearTerminalReady(id);
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) { onClose(); return prev; }
      if (activeId === id) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const startRename = (id: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation(); setRenamingId(id); setRenameVal(label);
  };

  const commitRename = () => {
    if (renamingId && renameVal.trim())
      setTabs(t => t.map(tab => tab.id === renamingId ? { ...tab, label: renameVal.trim() } : tab));
    setRenamingId(null);
  };

  // ── Sidebar toggle ──
  const togglePanel = (p: SidebarPanel) => {
    if (activePanel === p && sidebarOpen) { setSidebarOpen(false); setActivePanel(null); }
    else { setActivePanel(p); setSidebarOpen(true); }
  };

  const slideClass = isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0';
  const activeTabLabel = tabs.find(tab => tab.id === activeId)?.label ?? 'terminal';
  const activeTerminalReady = readyTerminalIds.includes(activeId) || xtermRegistry.has(activeId);
  const terminalToolbarActions = useMemo<TerminalToolbarAction[]>(() => ([
    {
      id: 'copy-output',
      label: 'Copy Output',
      title: 'Copy the selected text or the full scrollback buffer',
      icon: Copy,
      onClick: () => { void copyActiveTerminalOutput(); },
      disabled: !activeTerminalReady,
      tone: 'accent',
    },
    {
      id: 'clear-terminal',
      label: 'Clear',
      title: 'Clear the active terminal viewport',
      icon: Eraser,
      onClick: clearActiveTerminal,
      disabled: !activeTerminalReady,
    },
    {
      id: 'restart-terminal',
      label: 'Restart',
      title: 'Restart the active terminal session',
      icon: RotateCcw,
      onClick: () => { void restartActiveTerminal(); },
      disabled: !activeTerminalReady,
    },
  ]), [activeTerminalReady, clearActiveTerminal, copyActiveTerminalOutput, restartActiveTerminal]);
  const terminalToolbarDetail = terminalActionMessage
    ?? (activeTerminalReady ? `${activeTabLabel} ready` : `${activeTabLabel} starting...`);

  if (embedded) {
    // Embedded mode: render as a plain flex column, no outer animation/chrome
    return (
      <div
        className="flex flex-col overflow-hidden"
        style={{ flex: 1, background: theme.bg, color: theme.text, fontFamily: uiFont }}
      >
        {/* ══ Tab bar (inner terminal tabs) ══ */}
        <div
          className="flex items-stretch shrink-0 border-b"
          style={{ background: theme.bgPanel, height: 34, borderColor: theme.border }}
        >
          {/* Sidebar toggles */}
          <div className="flex items-center gap-0.5 px-2 border-r shrink-0" style={{ borderColor: theme.border }}>
            {TERMINAL_SIDEBAR_ITEMS.map(({ id, icon: Icon, title, accent }) => {
              const active = activePanel === id && sidebarOpen;
              return (
                <button key={id} onClick={() => togglePanel(id)} title={title}
                  style={{
                    color: active ? (accent === 'success' ? appearance.theme.palette.success : theme.accent) : theme.textMuted,
                    background: active ? `${accent === 'success' ? appearance.theme.palette.success : theme.accent}1a` : 'transparent',
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-sm transition-all hover:opacity-90">
                  <Icon size={12} />
                </button>
              );
            })}
          </div>
          {/* Tabs */}
          <OverlayScrollArea direction="horizontal" style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }} contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}>
            {tabs.map(tab => {
              const isActive = tab.id === activeId;
              return (
                <div key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  onDoubleClick={e => startRename(tab.id, tab.label, e)}
                  style={{
                    borderRight:  `1px solid ${theme.border}`,
                    borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
                    background:   isActive ? `${theme.accent}14` : 'transparent',
                  }}
                  className="group flex items-center gap-1.5 px-3 cursor-pointer select-none shrink-0 transition-colors hover:bg-white/[0.03]"
                >
                  <TerminalSquare size={10} style={{ color: isActive ? theme.accent : theme.textMuted }} />
                  {renamingId === tab.id ? (
                    <input autoFocus value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: Math.max(renameVal.length * 7, 60), color: theme.text, borderBottom: `1px solid ${theme.accent}` }}
                      className="bg-transparent text-[11px] outline-none" />
                  ) : (
                    <span className="text-[11px] font-medium whitespace-nowrap transition-all"
                      style={{ color: isActive ? theme.text : theme.textMuted }}>
                      {tab.label}
                    </span>
                  )}
                  {tabs.length > 1 && (
                    <button onClick={e => closeTab(tab.id, e)}
                      className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                      style={{ color: theme.textMuted }}>
                      <X size={9} />
                    </button>
                  )}
                </div>
              );
            })}
            <button onClick={newTab} className="flex items-center px-2 hover:bg-white/[0.04] transition-all shrink-0"
              style={{ color: theme.textMuted }} title="New Terminal">
              <Plus size={11} />
            </button>
          </OverlayScrollArea>
        </div>

        <TerminalActionToolbar
          actions={terminalToolbarActions}
          theme={theme}
          detail={terminalToolbarDetail}
        />

        {/* ══ Body ══ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar panel */}
          {sidebarOpen && activePanel && (
            <div className="shrink-0 overflow-hidden relative"
              style={{ width: sidebarWidth, background: theme.bgPanel, borderRight: `1px solid ${theme.border}`, color: theme.text }}>
              <SidebarContent
                panel={activePanel}
                theme={theme}
                appearance={appearance}
                injectCmd={injectCmd}
                injectCd={injectCd}
                emitToTerminal={emitToActiveTerminal}
                announce={setTransientActionMessage}
              />
              {/* Drag Handle */}
              <div
                onMouseDown={e => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startW = sidebarWidth;
                  const onMouseMove = (me: MouseEvent) => setSidebarWidth(Math.max(150, Math.min(600, startW + (me.clientX - startX))));
                  const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
                  window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
                }}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/10 transition-colors z-10"
              />
            </div>
          )}
          {/* Terminal area */}
          <div className="flex-1 relative min-w-0" style={{ background: theme.bgTerm }}>
            {hasMountedRef.current && tabs.map(tab => (
              <XTermPane key={tab.id} id={tab.id} visible={tab.id === activeId} theme={theme} onReady={markTerminalReady} />
            ))}
          </div>
        </div>

        {/* ══ Status bar ══ */}
        <div className="flex items-center gap-3 px-3 shrink-0 border-t"
          style={{ height: 20, background: `${theme.accent}18`, borderColor: theme.border }}>
          <div className="flex items-center gap-1.5">
            <Circle size={5} className="fill-current" style={{ color: appearance.theme.palette.success }} />
            <span className="text-[9px] font-mono opacity-40">
              {tabs.find(t => t.id === activeId)?.label ?? 'terminal'}
            </span>
          </div>
          <span className="text-[9px] font-mono opacity-20">
            {tabs.length} session{tabs.length !== 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <span className="text-[9px] opacity-20 select-none" style={{ fontFamily: appearance.fonts.mono }}>
            {appearance.theme.id}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden transition-all duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${slideClass}`}
      style={{
        background:  theme.bg,
        color:       theme.text,
        fontFamily:  uiFont,
        boxShadow:   `0 -4px 0 0 ${theme.accent}, 0 -32px 80px rgba(0,0,0,0.98)`,
        borderTop:   `1px solid ${theme.accent}40`,
      }}
    >
      {/* ══ Grab handle ══ */}
      <div
        className="h-[4px] shrink-0 cursor-ns-resize select-none"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${theme.accent}99 30%, ${theme.accent} 50%, ${theme.accent}99 70%, transparent 100%)` }}
        onPointerDown={e => {
          if (e.buttons === 1) { e.preventDefault(); getCurrentWindow().startResizeDragging('North').catch(() => {}); }
        }}
      />

      {/* ══ Tab bar ══ */}
      <div
        className="flex items-stretch shrink-0 border-b"
        style={{ background: theme.bgPanel, height: 36, borderColor: theme.border }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-3 border-r shrink-0" style={{ borderColor: theme.border }}>
          <div className="w-[18px] h-[18px] rounded flex items-center justify-center"
            style={{ background: theme.accent + '28', border: `1px solid ${theme.accent}55` }}>
            <TerminalIcon size={10} style={{ color: theme.accent }} />
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase select-none" style={{ color: theme.textMuted }}>
            Console
          </span>
        </div>

        {/* Tabs */}
        <OverlayScrollArea direction="horizontal" style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }} contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}>
          {tabs.map(tab => {
            const isActive = tab.id === activeId;
            return (
              <div key={tab.id}
                onClick={() => setActiveId(tab.id)}
                onDoubleClick={e => startRename(tab.id, tab.label, e)}
                style={{
                  borderRight:  `1px solid ${theme.border}`,
                  borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
                  background:   isActive ? `${theme.accent}14` : 'transparent',
                }}
                className="group flex items-center gap-1.5 px-3 cursor-pointer select-none shrink-0 transition-colors hover:bg-white/[0.03]"
              >
                <TerminalSquare size={11} style={{ color: isActive ? theme.accent : theme.textMuted }} />

                {renamingId === tab.id ? (
                  <input autoFocus value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                    onClick={e => e.stopPropagation()}
                    style={{ width: Math.max(renameVal.length * 7, 60), color: theme.text, borderBottom: `1px solid ${theme.accent}` }}
                    className="bg-transparent text-[11px] outline-none" />
                ) : (
                  <span className="text-[11px] font-medium whitespace-nowrap transition-all"
                    style={{ color: isActive ? theme.text : theme.textMuted }}>
                    {tab.label}
                  </span>
                )}

                {tabs.length > 1 && (
                  <button onClick={e => closeTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                    style={{ color: theme.textMuted }}>
                    <X size={9} />
                  </button>
                )}
              </div>
            );
          })}

          {/* New tab */}
          <button onClick={newTab} className="flex items-center px-2 hover:bg-white/[0.04] transition-all shrink-0"
            style={{ color: theme.textMuted }} title="New Terminal (Ctrl+T)">
            <Plus size={12} />
          </button>
        </OverlayScrollArea>

        {/* Controls */}
        <div className="flex items-center gap-0.5 px-2 border-l shrink-0" style={{ borderColor: theme.border }}>
          <kbd className="text-[9px] font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5 select-none mr-1"
            style={{ color: theme.textMuted }}>
            {keybindings.terminalToggle}
          </kbd>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-red-500/12 hover:text-red-400 transition-all"
            style={{ color: theme.textMuted }} title="Close (Esc)">
            <X size={13} />
          </button>
        </div>
      </div>

      <TerminalActionToolbar
        actions={terminalToolbarActions}
        theme={theme}
        detail={terminalToolbarDetail}
      />

      {/* ══ Body ══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Icon rail */}
        <div className="flex flex-col items-center gap-0.5 py-2 shrink-0"
          style={{ width: 36, background: theme.bgPanel, borderRight: `1px solid ${theme.border}` }}>
          {TERMINAL_SIDEBAR_ITEMS.map(({ id, icon: Icon, title, accent }) => {
            const active = activePanel === id && sidebarOpen;
            return (
              <button key={id} onClick={() => togglePanel(id)} title={title}
                style={{
                  color:       active ? (accent === 'success' ? appearance.theme.palette.success : theme.accent) : theme.textMuted,
                  background:  active ? `${accent === 'success' ? appearance.theme.palette.success : theme.accent}1a` : 'transparent',
                  borderLeft:  `2px solid ${active ? (accent === 'success' ? appearance.theme.palette.success : theme.accent) : 'transparent'}`,
                }}
                className="w-7 h-7 flex items-center justify-center rounded-sm transition-all hover:opacity-90">
                <Icon size={14} />
              </button>
            );
          })}

          <div className="flex-1" />

          <button onClick={() => setSidebarOpen(s => !s)}
            className="w-7 h-7 flex items-center justify-center transition-all hover:opacity-80"
            style={{ color: theme.textMuted }}
            title={sidebarOpen ? 'Collapse' : 'Expand'}>
            {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        {/* Sidebar panel */}
        {sidebarOpen && activePanel && (
          <div className="shrink-0 overflow-hidden relative"
            style={{ width: sidebarWidth, background: theme.bgPanel, borderRight: `1px solid ${theme.border}`, color: theme.text }}>
            <SidebarContent
              panel={activePanel}
              theme={theme}
              appearance={appearance}
              injectCmd={injectCmd}
              injectCd={injectCd}
              emitToTerminal={emitToActiveTerminal}
              announce={setTransientActionMessage}
            />
            {/* Drag Handle */}
            <div
              onMouseDown={e => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = sidebarWidth;
                const onMouseMove = (me: MouseEvent) => setSidebarWidth(Math.max(150, Math.min(600, startW + (me.clientX - startX))));
                const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
                window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
              }}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/10 transition-colors z-10"
            />
          </div>
        )}

        {/* Terminal area */}
        <div className="flex-1 relative min-w-0" style={{ background: theme.bgTerm }}>
          {hasMountedRef.current && tabs.map(tab => (
            <XTermPane key={tab.id} id={tab.id} visible={tab.id === activeId} theme={theme} onReady={markTerminalReady} />
          ))}
        </div>
      </div>

      {/* ══ Status bar ══ */}
      <div className="flex items-center gap-3 px-3 shrink-0 border-t"
        style={{ height: 22, background: `${theme.accent}18`, borderColor: theme.border }}>
        <div className="flex items-center gap-1.5">
          <Circle size={6} className="fill-current" style={{ color: appearance.theme.palette.success }} />
          <span className="text-[9px] font-mono opacity-40">
            {tabs.find(t => t.id === activeId)?.label ?? 'terminal'}
          </span>
        </div>
        <span className="text-[9px] font-mono opacity-20">
          {tabs.length} session{tabs.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <span className="text-[9px] opacity-20 select-none" style={{ fontFamily: appearance.fonts.mono }}>
          dbl-click tab to rename · {appearance.theme.id}
        </span>
      </div>
    </div>
  );
}

export default TerminalOverlay;
