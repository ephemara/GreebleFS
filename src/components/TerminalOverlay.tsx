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
  useLayoutEffect,
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
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
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
import {
  TerminalViewportFx,
  buildTerminalViewportContentFilter,
  type TerminalRendererMode,
} from './terminal/TerminalViewportFx';

export type ThemeId = 'operator' | 'dracula' | 'nord' | 'monokai' | 'github-dark' | 'catppuccin';

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

function themeFromAppearance(
  theme: OverlayThemeDefinition,
  workbenchTheme: ResolvedWorkbenchThemeRecipe,
): Theme {
  return {
    name: theme.name,
    bg: workbenchTheme.surfaces.terminalBackground,
    bgPanel: workbenchTheme.surfaces.terminalPanelBackground,
    bgTerm: workbenchTheme.terminalStyle === 'glass'
      ? multiplyColorAlpha(workbenchTheme.surfaces.terminalPaneBackground, 0.86)
      : workbenchTheme.surfaces.terminalPaneBackground,
    statusBg: workbenchTheme.surfaces.terminalStatusBackground,
    accent: theme.palette.accent,
    text: theme.palette.textPrimary,
    textMuted: theme.palette.textMuted,
    border: workbenchTheme.surfaces.terminalBorder,
    xt: theme.xterm,
  };
}

function createXtermColorTheme(theme: Theme): XTerm['options']['theme'] {
  return {
    ...theme.xt,
    cursorAccent: theme.bgTerm,
    selectionBackground: theme.accent + '44',
    selectionForeground: '#ffffff',
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

const INITIAL_TAB_ID = 'terminal-tab-0';
const INITIAL_PANE_ID = 'overlay-0';

function createPaneTelemetry(): TerminalPaneTelemetry {
  return {
    outputBytes: 0,
    outputLines: 0,
    lastOutputAt: null,
    lastFocusAt: null,
    rows: null,
    cols: null,
  };
}

function getShellDisplayLabel(shell: string): string {
  const normalized = shell.trim().replace(/["']/g, '');
  if (!normalized) {
    return 'shell';
  }
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
}


function countPayloadLines(payload: string): number {
  const matches = payload.match(/\r?\n/g);
  return matches?.length ?? 0;
}

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
  pluginCommands?: OverlayPluginCommandContribution[];
}

// ─── XTerm registry ───────────────────────────────────────────────────────────

interface XTermEntry { xterm: XTerm; fitAddon: FitAddon; unlisten: () => void; }
const xtermRegistry = new Map<string, XTermEntry>();

function getTerminalPaneDomKey(tabId: string, nodeId: string): string {
  return `${tabId}::${nodeId}`;
}

function applyTerminalPaneFrameToElement(
  element: HTMLElement,
  frame: TerminalPaneFrame,
): void {
  element.style.left = `${frame.x * 100}%`;
  element.style.top = `${frame.y * 100}%`;
  element.style.width = `${frame.width * 100}%`;
  element.style.height = `${frame.height * 100}%`;
}

function applyTerminalSplitHandleToElement(
  element: HTMLElement,
  handle: TerminalPaneSplitHandle,
): void {
  const isColumnSplit = handle.direction === 'columns';
  element.style.left = isColumnSplit ? `calc(${handle.x * 100}% - 5px)` : `${handle.x * 100}%`;
  element.style.top = isColumnSplit ? `${handle.y * 100}%` : `calc(${handle.y * 100}% - 5px)`;
  element.style.width = isColumnSplit ? '10px' : `${handle.width * 100}%`;
  element.style.height = isColumnSplit ? `${handle.height * 100}%` : '10px';
  element.style.cursor = isColumnSplit ? 'col-resize' : 'row-resize';
}

function shouldKeepTerminalViewportPinnedToBottom(term: XTerm): boolean {
  const viewportY = term.buffer.active.viewportY;
  const baseY = term.buffer.active.baseY;
  if (!Number.isFinite(viewportY) || !Number.isFinite(baseY)) {
    return true;
  }
  return Math.abs(baseY - viewportY) <= 1;
}

function destroyXterm(id: string) {
  const e = xtermRegistry.get(id);
  if (!e) return;
  e.unlisten(); e.xterm.dispose();
  void commands.terminalKill(id).then(unwrapTauriResult).catch(() => {});
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
  icon?: ComponentType<{ size?: number }>;
  separator?: true;
  onClick?: () => void;
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
      style={{ minHeight: 36, background: 'var(--overlay-workbench-terminal-panel-bg)', borderColor: 'var(--overlay-workbench-terminal-border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        {actions.map(action => {
          if (action.separator) {
            return (
              <div
                key={action.id}
                style={{ width: 1, height: 16, background: theme.border, margin: '0 3px', flexShrink: 0 }}
              />
            );
          }
          const Icon = action.icon!;
          const isAccent = action.tone === 'accent';
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.label}
              title={action.title || action.label}
              className="flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                width: 26,
                height: 26,
                color: action.disabled
                  ? theme.textMuted
                  : isAccent
                    ? theme.accent
                    : theme.textMuted,
                background: isAccent && !action.disabled ? 'var(--overlay-workbench-chrome-button-active-bg)' : 'var(--overlay-workbench-chrome-button-bg)',
                border: `1px solid ${isAccent && !action.disabled ? 'var(--overlay-workbench-chrome-button-active-border)' : 'transparent'}`,
                borderRadius: 'var(--overlay-workbench-control-radius)',
              }}
            >
              <Icon size={12} />
            </button>
          );
        })}
      </div>
      <span
        className="text-[9px] select-none shrink-0"
        style={{ color: theme.textMuted, whiteSpace: 'nowrap', paddingRight: 4 }}
      >
        {detail}
      </span>
    </div>
  );
}

// ─── XTermPane ────────────────────────────────────────────────────────────────

interface XTermPaneProps {
  id: string;
  visible: boolean;
  active: boolean;
  theme: Theme;
  workbenchTheme: ResolvedWorkbenchThemeRecipe;
  onReady?: (id: string) => void;
  onFocus?: (id: string) => void;
  onData?: (id: string, data: string) => void;
  onOutput?: (id: string, payload: string) => void;
  onResize?: (id: string, rows: number, cols: number) => void;
}

function XTermPane({
  id,
  visible,
  active,
  theme,
  workbenchTheme,
  onReady,
  onFocus,
  onData,
  onOutput,
  onResize,
}: XTermPaneProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef   = useRef(false);
  const bufferedOutputRef = useRef('');
  const outputFrameRef = useRef<number | null>(null);
  const fitFrameRef = useRef<number | null>(null);
  const lastResizeRef = useRef<{ rows: number; cols: number } | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const webglContextLossDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const [rendererMode, setRendererMode] = useState<TerminalRendererMode>('dom');
  const settings = useSettingsStore(s => s.settings.terminal);
  const onReadyRef = useRef(onReady);
  const onFocusRef = useRef(onFocus);
  const onDataRef = useRef(onData);
  const onOutputRef = useRef(onOutput);
  const onResizeRef = useRef(onResize);
  const rendererPreference = workbenchTheme.terminalRenderer;
  const viewportContentFilter = useMemo(
    () => buildTerminalViewportContentFilter(workbenchTheme.terminalFx, rendererMode, active),
    [active, rendererMode, workbenchTheme.terminalFx],
  );

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onFocusRef.current = onFocus; }, [onFocus]);
  useEffect(() => { onDataRef.current = onData; }, [onData]);
  useEffect(() => { onOutputRef.current = onOutput; }, [onOutput]);
  useEffect(() => { onResizeRef.current = onResize; }, [onResize]);

  const disposeWebglRenderer = useCallback(() => {
    webglContextLossDisposableRef.current?.dispose();
    webglContextLossDisposableRef.current = null;
    webglAddonRef.current?.dispose();
    webglAddonRef.current = null;
  }, []);

  const attachWebglRenderer = useCallback((term: XTerm) => {
    if (rendererPreference === 'dom') {
      setRendererMode('dom');
      return;
    }
    if (webglAddonRef.current) {
      setRendererMode('webgl');
      return;
    }

    try {
      const addon = new WebglAddon();
      webglContextLossDisposableRef.current = addon.onContextLoss(() => {
        disposeWebglRenderer();
        setRendererMode('dom');
      });
      term.loadAddon(addon);
      webglAddonRef.current = addon;
      setRendererMode('webgl');
    } catch {
      disposeWebglRenderer();
      setRendererMode('dom');
    }
  }, [disposeWebglRenderer, rendererPreference]);

  const boot = useCallback(async () => {
    if (!containerRef.current || mountedRef.current) return;
    mountedRef.current = true;

    const term = new XTerm({
      theme: createXtermColorTheme(theme),
      fontFamily:        settings.fontFamily || 'JetBrains Mono, Fira Code, monospace',
      fontSize:          settings.fontSize   || 13,
      lineHeight:        1.35,
      letterSpacing:     0.3,
      cursorBlink:       settings.cursorBlink  ?? true,
      cursorStyle:       settings.cursorStyle   || 'bar',
      scrollback:        settings.scrollback    || 10000,
      allowTransparency: workbenchTheme.terminalStyle === 'glass',
      convertEol:        true,
      scrollOnUserInput: true,
    });

    const fit      = new FitAddon();
    const webLinks = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    term.open(containerRef.current);
    attachWebglRenderer(term);

    const runFit = (preserveBottomLock: boolean) => {
      if (
        !containerRef.current ||
        !containerRef.current.isConnected ||
        containerRef.current.offsetParent === null
      ) {
        return;
      }
      const keepViewportPinned = preserveBottomLock && shouldKeepTerminalViewportPinnedToBottom(term);
      fit.fit();
      if (keepViewportPinned) {
        term.scrollToBottom();
      }
    };

    const scheduleFit = (preserveBottomLock = true) => {
      if (fitFrameRef.current !== null) {
        return;
      }

      fitFrameRef.current = window.requestAnimationFrame(() => {
        fitFrameRef.current = null;
        runFit(preserveBottomLock);
      });
    };

    runFit(false);

    try {
      unwrapTauriResult(await commands.terminalSpawn(id, null, settings.shell, term.rows, term.cols));
      unwrapTauriResult(await commands.terminalRegisterShellIntegration({
        id,
        shellKind: null,
        supportsAutoCd: true,
        atPrompt: true,
        reportedCwd: null,
      }));
    } catch (e) {
      term.writeln('\r\n\x1b[31mFailed to spawn PTY:\x1b[0m ' + String(e));
    }

    const flushBufferedOutput = () => {
      outputFrameRef.current = null;
      const chunk = bufferedOutputRef.current;
      if (!chunk) {
        return;
      }

      bufferedOutputRef.current = '';
      term.write(chunk);
      onOutputRef.current?.(id, chunk);
    };

    const scheduleBufferedFlush = () => {
      if (outputFrameRef.current !== null) {
        return;
      }

      outputFrameRef.current = window.requestAnimationFrame(flushBufferedOutput);
    };

    const unlisten = await listen<string>(`terminal-output-${id}`, ev => {
      bufferedOutputRef.current += ev.payload;
      scheduleBufferedFlush();
    });
    term.onData(data => {
      onFocusRef.current?.(id);
      onDataRef.current?.(id, data);
    });
    term.onResize(({ rows: r, cols: c }) => {
      if (
        lastResizeRef.current?.rows === r &&
        lastResizeRef.current?.cols === c
      ) {
        return;
      }
      lastResizeRef.current = { rows: r, cols: c };
      onResizeRef.current?.(id, r, c);
      void commands.terminalResize(id, r, c).then(unwrapTauriResult).catch(() => {});
    });

    const ro = new ResizeObserver(() => scheduleFit());
    ro.observe(containerRef.current!);

    const focusTarget = viewportRef.current ?? containerRef.current;
    const handlePointerDown = () => onFocusRef.current?.(id);
    focusTarget?.addEventListener('pointerdown', handlePointerDown);

    xtermRegistry.set(id, {
      xterm: term, fitAddon: fit,
      unlisten: () => {
        flushBufferedOutput();
        if (fitFrameRef.current !== null) {
          window.cancelAnimationFrame(fitFrameRef.current);
          fitFrameRef.current = null;
        }
        if (outputFrameRef.current !== null) {
          window.cancelAnimationFrame(outputFrameRef.current);
          outputFrameRef.current = null;
        }
        disposeWebglRenderer();
        unlisten();
        ro.disconnect();
        focusTarget?.removeEventListener('pointerdown', handlePointerDown);
      },
    });
    onResizeRef.current?.(id, term.rows, term.cols);
    onReadyRef.current?.(id);
    term.focus();
  }, [attachWebglRenderer, disposeWebglRenderer, id, settings, theme, workbenchTheme.terminalStyle]);

  useEffect(() => {
    if (visible) {
      const raf = requestAnimationFrame(() => boot());
      return () => cancelAnimationFrame(raf);
    }
  }, [visible, boot]);

  useEffect(() => {
    const entry = xtermRegistry.get(id);
    if (!entry) {
      return;
    }

    entry.xterm.options = {
      theme: createXtermColorTheme(theme),
      fontFamily: settings.fontFamily || 'JetBrains Mono, Fira Code, monospace',
      fontSize: settings.fontSize || 13,
      cursorBlink: settings.cursorBlink ?? true,
      cursorStyle: settings.cursorStyle || 'bar',
      scrollback: settings.scrollback || 10000,
    };
    webglAddonRef.current?.clearTextureAtlas();

    requestAnimationFrame(() => {
      const keepViewportPinned = shouldKeepTerminalViewportPinnedToBottom(entry.xterm);
      entry.fitAddon.fit();
      if (keepViewportPinned) {
        entry.xterm.scrollToBottom();
      }
    });
  }, [
    id,
    settings.cursorBlink,
    settings.cursorStyle,
    settings.fontFamily,
    settings.fontSize,
    settings.scrollback,
    theme,
  ]);

  useEffect(() => {
    const entry = xtermRegistry.get(id);
    if (!entry) {
      return;
    }

    if (rendererPreference === 'dom') {
      disposeWebglRenderer();
      setRendererMode('dom');
      return;
    }

    if (!webglAddonRef.current) {
      attachWebglRenderer(entry.xterm);
      requestAnimationFrame(() => entry.fitAddon.fit());
    }
  }, [attachWebglRenderer, disposeWebglRenderer, id, rendererPreference]);

  useEffect(() => {
    if (visible && active) {
      const entry = xtermRegistry.get(id);
      if (entry) {
        requestAnimationFrame(() => {
          const keepViewportPinned = shouldKeepTerminalViewportPinnedToBottom(entry.xterm);
          entry.fitAddon.fit();
          if (keepViewportPinned) {
            entry.xterm.scrollToBottom();
          }
        });
        requestAnimationFrame(() => entry.xterm.focus());
      }
    }
  }, [active, visible, id]);

  useEffect(() => () => {
    mountedRef.current = false;
    destroyXterm(id);
  }, [id]);

  return (
    <div
      ref={viewportRef}
      data-terminal-renderer-mode={rendererMode}
      data-testid={`terminal-pane-viewport-${id}`}
      style={{
        display: visible ? 'block' : 'none',
      }}
      className="absolute inset-0"
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          padding: '6px 8px',
          boxSizing: 'border-box',
          filter: viewportContentFilter,
        }}
      />
      <TerminalViewportFx
        active={active}
        paneId={id}
        rendererMode={rendererMode}
        terminalFx={workbenchTheme.terminalFx}
        theme={theme}
      />
    </div>
  );
}

// ─── Bookmark chip ────────────────────────────────────────────────────────────

interface ChipProps {
  bm: Bookmark; icon: React.ReactNode; accentStyle: string;
  onPrimary: () => void; onRun?: () => void; onDelete?: () => void;
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
        {onDelete && (
          <button onClick={onDelete} className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
            <Trash2 size={10} />
          </button>
        )}
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
  shell: string;
  platform: RuntimePlatform;
  launchManagedRepl: (command: string) => Promise<void>;
}

function PythonSidebarContent({
  theme,
  emitToTerminal,
  announce,
  shell,
  platform,
  launchManagedRepl,
}: PythonSidebarContentProps) {
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
      const nextStatus = await commands.pythonGetRuntimeStatus(runtimeConfig).then(unwrapTauriResult);
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
      commands.pythonBootstrapRuntime(runtimeConfig).then(unwrapTauriResult));
  }, [runAction, runtimeConfig]);

  const installConfiguredPackages = useCallback(async () => {
    await runAction('Installed configured Python packages', () =>
      commands.pythonInstallPackages({
        config: runtimeConfig,
        packageInput: pythonSettings.bootstrapPackages,
        persistToRequirements: true,
      }).then(unwrapTauriResult));
  }, [pythonSettings.bootstrapPackages, runAction, runtimeConfig]);

  const applyPackagePreset = useCallback(async (packages: string[]) => {
    await runAction('Installed Python package preset', () =>
      commands.pythonInstallPackages({
        config: {
          ...runtimeConfig,
          bootstrapPackages: packages.join('\n'),
        },
        packageInput: packages.join('\n'),
        persistToRequirements: false,
      }).then(unwrapTauriResult));
  }, [runAction, runtimeConfig]);

  const openManagedRepl = useCallback(async () => {
    if (!status?.ready || !status.managedPythonPath) {
      announce('Managed Python is not ready yet');
      return;
    }

    const replCommand = buildManagedPythonReplCommand(status.managedPythonPath, shell, platform);
    await launchManagedRepl(replCommand);
    announce('Opened managed Python REPL');
  }, [announce, launchManagedRepl, platform, shell, status]);

  const runPreset = useCallback(async (preset: PythonExamplePreset) => {
    await runAction(`Ran ${preset.label}`, () =>
      commands.pythonExecute({
        config: runtimeConfig,
        executionMode: preset.mode,
        entry: preset.entry,
        arguments: [],
        workingDirectory: null,
        environment: {},
        useManagedEnvironment: true,
      }).then(unwrapTauriResult));
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
              onClick={() => void openManagedRepl()}
              disabled={Boolean(pendingAction) || !status?.ready}
              className="flex items-center justify-between rounded px-2.5 py-2 text-[10px] font-medium disabled:opacity-35"
              style={buttonStyle}
              title="Open the managed Python interpreter inside the active terminal tab"
            >
              <span>Open Managed REPL</span>
              <TerminalSquare size={11} />
            </button>

            <button
              type="button"
              onClick={() => void installConfiguredPackages()}
              disabled={Boolean(pendingAction) || !pythonSettings.bootstrapPackages.trim()}
              className="flex items-center justify-between rounded px-2.5 py-2 text-[10px] font-medium disabled:opacity-35"
              style={buttonStyle}
              title="Install the packages configured in Python settings"
            >
              <span>Install Package Queue</span>
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

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
              Package Presets
            </div>
            <div className="space-y-2">
              {pythonQuickPackagePresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void applyPackagePreset(preset.packages)}
                  disabled={Boolean(pendingAction)}
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
  pluginCommands: OverlayPluginCommandContribution[];
  injectCmd: (cmd: string, run?: boolean) => void;
  injectCd:  (path: string) => void;
  emitToTerminal: (label: string, body: string, tone?: 'info' | 'success' | 'error') => void;
  announce: (message: string) => void;
  shell: string;
  platform: RuntimePlatform;
  launchManagedRepl: (command: string) => Promise<void>;
}

function SidebarContent({
  panel,
  theme,
  appearance,
  pluginCommands,
  injectCmd,
  injectCd,
  emitToTerminal,
  announce,
  shell,
  platform,
  launchManagedRepl,
}: SidebarContentProps) {
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
        {commandBookmarks.length === 0 && pluginCommands.length === 0 && !addingCmd && (
          <p className="text-[9px] opacity-20 px-3 py-2">No commands yet — click + to add</p>
        )}
        {commandBookmarks.map(bm => (
          <BookmarkChip key={bm.id} bm={bm} icon={<Hash size={10} />} accentStyle={appearance.theme.palette.success}
            onPrimary={() => injectCmd(bm.value)}
            onRun={() => injectCmd(bm.value, true)}
            onDelete={() => removeCommandBookmark(bm.id)} />
        ))}
        {pluginCommands.length > 0 && (
          <div className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-35">
            Plugin Commands
          </div>
        )}
        {pluginCommands.map(command => (
          <BookmarkChip
            key={command.id}
            bm={{ id: command.id, name: `${command.pluginName}: ${command.name}`, value: command.command }}
            icon={<Hash size={10} />}
            accentStyle={appearance.theme.palette.info}
            onPrimary={() => dispatchTerminalCommand(command.command, command.runOnSelect)}
            onRun={() => dispatchTerminalCommand(command.command, true)}
          />
        ))}
      </OverlayScrollArea>
    </div>
  );

  if (panel === 'python') return (
    <PythonSidebarContent
      theme={theme}
      emitToTerminal={emitToTerminal}
      announce={announce}
      shell={shell}
      platform={platform}
      launchManagedRepl={launchManagedRepl}
    />
  );

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TerminalOverlay({
  isOpen,
  onClose,
  embedded = false,
  appearance: appearanceProp,
  pluginCommands = [],
}: TerminalOverlayProps) {
  const { settings, appearanceSettings, keybindings, updateTerminal } = useSettingsStore(useShallow(state => ({
    settings: state.settings.terminal,
    appearanceSettings: state.settings.appearance,
    keybindings: state.settings.keybindings,
    updateTerminal: state.updateTerminal,
  })));
  const runtimePlatform = useMemo(() => detectClientPlatform(), []);
  const appearance = useMemo(
    () => appearanceProp ?? resolveOverlayAppearance({
      activeThemeId: appearanceSettings.activeThemeId,
      activeDockThemeId: appearanceSettings.activeDockThemeId,
      dockThemeMode: appearanceSettings.dockThemeMode,
      customThemes: appearanceSettings.customThemes,
      uiFontFamily: appearanceSettings.uiFontFamily,
      monoFontFamily: settings.fontFamily,
      panelTransparency: appearanceSettings.panelTransparency,
      windowMode: settings.windowMode,
    }),
    [
      appearanceProp,
      appearanceSettings.activeDockThemeId,
      appearanceSettings.activeThemeId,
      appearanceSettings.customThemes,
      appearanceSettings.dockThemeMode,
      appearanceSettings.panelTransparency,
      appearanceSettings.uiFontFamily,
      settings.fontFamily,
      settings.windowMode,
    ],
  );
  const theme = useMemo(
    () => themeFromAppearance(appearance.theme, appearance.workbenchTheme),
    [appearance.theme, appearance.workbenchTheme],
  );
  const uiFont = appearance.fonts.ui;
  const blurEnabled = appearanceSettings.appBlur !== false;

  useEffect(() => {
    ensureFontFamilyLoaded(uiFont);
    ensureFontFamilyLoaded(settings.fontFamily);
  }, [settings.fontFamily, uiFont]);

  const initialShellLabel = useMemo(() => getShellDisplayLabel(settings.shell), [settings.shell]);
  const [tabs, setTabs] = useState<Tab[]>(() => [{
    id: INITIAL_TAB_ID,
    label: initialShellLabel,
    layout: createTerminalPaneLayout(INITIAL_PANE_ID),
    activePaneId: INITIAL_PANE_ID,
    lastSplitDirection: 'columns',
    broadcastInput: false,
    createdAt: Date.now(),
  }]);
  const [paneSessions, setPaneSessions] = useState<Record<string, TerminalPaneSession>>(() => ({
    [INITIAL_PANE_ID]: {
      id: INITIAL_PANE_ID,
      label: 'Pane 1',
      createdAt: Date.now(),
    },
  }));
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB_ID);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const [activePanel, setActivePanel] = useState<SidebarPanel>('dirs');
  const [sidebarWidth, setSidebarWidth] = useState(210);
  const [readyTerminalIds, setReadyTerminalIds] = useState<string[]>([]);
  const [terminalActionMessage, setTerminalActionMessage] = useState<string | null>(null);
  const paneTelemetryRef = useRef<Record<string, TerminalPaneTelemetry>>({
    [INITIAL_PANE_ID]: createPaneTelemetry(),
  });
  const actionMessageTimerRef = useRef<number | null>(null);
  const paneCounterRef = useRef(1);
  const tabCounterRef = useRef(1);
  const splitCounterRef = useRef(1);
  const lastTerminalCwdSyncKeyRef = useRef<string | null>(null);
  const promptRestoreTimersRef = useRef<Record<string, number>>({});
  // Keep split-drag geometry off React's pointer-move hot path so mounted xterm
  // panes stay stable while their containing surfaces resize.
  const paneSurfaceElementsRef = useRef(new Map<string, HTMLDivElement>());
  const splitHandleElementsRef = useRef(new Map<string, HTMLDivElement>());
  const splitResizePreviewRef = useRef<{ tabId: string; layout: TerminalPaneLayoutNode } | null>(null);
  const splitResizePreviewFrameRef = useRef<number | null>(null);

  const { initStore } = useTerminalStore(useShallow(state => ({
    initStore: state.initStore,
  })));
  const pendingTerminalCwdSync = useExplorerStore(useShallow(state => state.pendingTerminalCwdSync));
  const clearPendingTerminalCwdSync = useExplorerStore(useShallow(state => state.setPendingTerminalCwdSync));
  useEffect(() => { initStore(); }, [initStore]);

  const hasMountedRef = useRef(false);
  if (isOpen && !hasMountedRef.current) hasMountedRef.current = true;
  const sidebarOpen = settings.showSidebar;

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
    for (const timer of Object.values(promptRestoreTimersRef.current)) {
      window.clearTimeout(timer);
    }
    if (splitResizePreviewFrameRef.current !== null) {
      window.cancelAnimationFrame(splitResizePreviewFrameRef.current);
      splitResizePreviewFrameRef.current = null;
    }
    splitResizePreviewRef.current = null;
  }, []);

  useEffect(() => {
    if (sidebarOpen || activePanel) {
      return;
    }

    setActivePanel('dirs');
  }, [activePanel, sidebarOpen]);

  const setSidebarVisibility = useCallback((nextOpen: boolean) => {
    updateTerminal({ showSidebar: nextOpen });
  }, [updateTerminal]);

  const toggleSidebarVisibility = useCallback(() => {
    setSidebarVisibility(!sidebarOpen);
  }, [setSidebarVisibility, sidebarOpen]);

  const activeTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId) ?? tabs[0] ?? null,
    [tabs, activeTabId],
  );
  const paneIdsByTab = useMemo(
    () => new Map(tabs.map(tab => [tab.id, collectTerminalPaneIds(tab.layout)])),
    [tabs],
  );
  const activeTabPaneIds = activeTab ? (paneIdsByTab.get(activeTab.id) ?? []) : [];
  const activePaneId = activeTab?.activePaneId ?? activeTabPaneIds[0] ?? INITIAL_PANE_ID;
  const activePane = paneSessions[activePaneId] ?? null;
  const totalPaneCount = tabs.reduce((sum, tab) => sum + countTerminalPanes(tab.layout), 0);

  const findTabForPane = useCallback((paneId: string) => (
    tabs.find(tab => (paneIdsByTab.get(tab.id) ?? []).includes(paneId)) ?? null
  ), [paneIdsByTab, tabs]);

  const isPaneReady = useCallback((paneId: string) => (
    readyTerminalIds.includes(paneId) || xtermRegistry.has(paneId)
  ), [readyTerminalIds]);

  const markTerminalReady = useCallback((id: string) => {
    setReadyTerminalIds(prev => prev.includes(id) ? prev : [...prev, id]);
    paneTelemetryRef.current[id] ??= createPaneTelemetry();
  }, []);

  const clearTerminalReady = useCallback((id: string) => {
    setReadyTerminalIds(prev => prev.filter(value => value !== id));
  }, []);

  const updatePaneTelemetry = useCallback((paneId: string, updater: (current: TerminalPaneTelemetry) => TerminalPaneTelemetry) => {
    paneTelemetryRef.current[paneId] = updater(paneTelemetryRef.current[paneId] ?? createPaneTelemetry());
  }, []);

  const markPaneFocused = useCallback((paneId: string) => {
    updatePaneTelemetry(paneId, current => ({
      ...current,
      lastFocusAt: Date.now(),
    }));
  }, [updatePaneTelemetry]);

  const focusPane = useCallback((tabId: string, paneId: string) => {
    setActiveTabId(tabId);
    setTabs(prev => prev.map(tab => (
      tab.id === tabId
        ? { ...tab, activePaneId: paneId }
        : tab
    )));
    markPaneFocused(paneId);
    const entry = xtermRegistry.get(paneId);
    if (entry) {
      requestAnimationFrame(() => entry.xterm.focus());
    }
  }, [markPaneFocused]);

  const removePaneSession = useCallback((paneId: string) => {
    clearTerminalReady(paneId);
    setPaneSessions(prev => {
      const next = { ...prev };
      delete next[paneId];
      return next;
    });
    delete paneTelemetryRef.current[paneId];
  }, [clearTerminalReady]);

  const writeToPaneIds = useCallback(async (paneIds: string[], data: string) => {
    if (paneIds.length === 0) {
      return;
    }

    if (paneIds.length === 1) {
      unwrapTauriResult(await commands.terminalWrite(paneIds[0], data));
      return;
    }

    unwrapTauriResult(await commands.terminalWriteMany(
      paneIds.map(id => ({ id, data })),
    ));
  }, []);

  const resolveCommandTargets = useCallback((paneId?: string) => {
    const tab = paneId ? findTabForPane(paneId) : activeTab;
    if (!tab) {
      return paneId ? [paneId] : [];
    }
    const paneIds = paneIdsByTab.get(tab.id) ?? [];
    return tab.broadcastInput ? paneIds : [paneId ?? tab.activePaneId];
  }, [activeTab, findTabForPane, paneIdsByTab]);

  const injectCmd = useCallback(async (command: string, run = false, paneId?: string) => {
    const targetIds = resolveCommandTargets(paneId);
    if (targetIds.length === 0) {
      return;
    }

    try {
      await writeToPaneIds(targetIds, run ? `${command}\r` : command);
    } catch (error) {
      console.error('inject cmd failed', error);
    }
  }, [resolveCommandTargets, writeToPaneIds]);

  const injectCd = useCallback(async (path: string, shell?: string) => {
    const command = buildTerminalCdCommand(path, shell ?? settings.shell);
    if (!command) {
      return;
    }
    await injectCmd(command, true);
  }, [injectCmd, settings.shell]);

  const launchManagedRepl = useCallback(async (command: string) => {
    await injectCmd(command, true);
  }, [injectCmd]);

  const schedulePromptRestore = useCallback((paneId: string) => {
    const currentTimer = promptRestoreTimersRef.current[paneId];
    if (typeof currentTimer === 'number') {
      window.clearTimeout(currentTimer);
    }
    promptRestoreTimersRef.current[paneId] = window.setTimeout(() => {
      delete promptRestoreTimersRef.current[paneId];
      void commands.terminalSetPromptState(paneId, true, null).then(unwrapTauriResult).catch(() => {});
    }, 120);
  }, []);

  const handleTerminalInput = useCallback((paneId: string, data: string) => {
    const targetIds = resolveCommandTargets(paneId);
    if (targetIds.length === 0) {
      return;
    }
    if (/[\r\n]/.test(data)) {
      for (const targetId of targetIds) {
        void commands.terminalSetPromptState(targetId, false, null).then(unwrapTauriResult).catch(() => {});
      }
    }
    void writeToPaneIds(targetIds, data).catch(error => console.error('terminal input failed', error));
  }, [resolveCommandTargets, writeToPaneIds]);

  const emitToPane = useCallback((
    paneId: string,
    label: string,
    body: string,
    tone: 'info' | 'success' | 'error' = 'info',
  ) => {
    const entry = xtermRegistry.get(paneId);
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
  }, [setTransientActionMessage]);

  const emitToActiveTerminal = useCallback((
    label: string,
    body: string,
    tone: 'info' | 'success' | 'error' = 'info',
  ) => {
    emitToPane(activePaneId, label, body, tone);
  }, [activePaneId, emitToPane]);

  const handleTerminalOutput = useCallback((paneId: string, payload: string) => {
    updatePaneTelemetry(paneId, current => ({
      ...current,
      outputBytes: current.outputBytes + payload.length,
      outputLines: current.outputLines + countPayloadLines(payload),
      lastOutputAt: Date.now(),
    }));
    schedulePromptRestore(paneId);
  }, [schedulePromptRestore, updatePaneTelemetry]);

  const handlePaneResize = useCallback((paneId: string, rows: number, cols: number) => {
    updatePaneTelemetry(paneId, current => ({
      ...current,
      rows,
      cols,
    }));
  }, [updatePaneTelemetry]);

  const copyPaneOutput = useCallback(async (paneId: string) => {
    const entry = xtermRegistry.get(paneId);
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
  }, [setTransientActionMessage]);

  const copyPaneSnapshot = useCallback(async (paneId: string) => {
    const entry = xtermRegistry.get(paneId);
    const tab = findTabForPane(paneId);
    const pane = paneSessions[paneId];
    if (!entry || !tab || !pane) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }

    const output = collectTerminalBufferText(entry.xterm);
    const metrics = paneTelemetryRef.current[paneId] ?? createPaneTelemetry();
    const snapshot = [
      `# ${tab.label} · ${pane.label}`,
      '',
      `- Shell: ${settings.shell}`,
      `- Layout: ${describeTerminalPaneLayout(tab.layout)}`,
      `- Broadcast input: ${tab.broadcastInput ? 'enabled' : 'disabled'}`,
      `- Viewport: ${metrics.cols && metrics.rows ? `${metrics.cols} x ${metrics.rows}` : 'unknown'}`,
      `- Captured: ${new Date().toLocaleString()}`,
      '',
      '```text',
      output || '(no output captured yet)',
      '```',
    ].join('\n');

    const copied = await copyTextToClipboard(snapshot);
    setTransientActionMessage(copied ? `Snapshot copied for ${pane.label}` : 'Snapshot copy failed');
  }, [findTabForPane, paneSessions, setTransientActionMessage, settings.shell]);

  const clearPane = useCallback((paneId: string) => {
    const entry = xtermRegistry.get(paneId);
    if (!entry) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }
    entry.xterm.clear();
    entry.xterm.focus();
    setTransientActionMessage(`Cleared ${paneSessions[paneId]?.label ?? 'pane'}`);
  }, [paneSessions, setTransientActionMessage]);

  const restartPane = useCallback(async (paneId: string) => {
    const entry = xtermRegistry.get(paneId);
    if (!entry) {
      setTransientActionMessage('Terminal is still starting');
      return;
    }

    clearTerminalReady(paneId);

    try {
      unwrapTauriResult(await commands.terminalKill(paneId));
      entry.xterm.reset();
      unwrapTauriResult(await commands.terminalSpawn(
        paneId,
        null,
        settings.shell,
        entry.xterm.rows,
        entry.xterm.cols,
      ));
      unwrapTauriResult(await commands.terminalRegisterShellIntegration({
        id: paneId,
        shellKind: null,
        supportsAutoCd: true,
        atPrompt: true,
        reportedCwd: null,
      }));
      markTerminalReady(paneId);
      setTransientActionMessage(`Restarted ${paneSessions[paneId]?.label ?? 'terminal'}`);
    } catch (error) {
      setTransientActionMessage(`Restart failed: ${String(error)}`);
    }

    requestAnimationFrame(() => {
      entry.fitAddon.fit();
      entry.xterm.focus();
    });
  }, [clearTerminalReady, markTerminalReady, paneSessions, setTransientActionMessage, settings.shell]);
  useEffect(() => {
    if (!isOpen || !pendingTerminalCwdSync?.path || !activePaneId) {
      return;
    }

    const syncKey = `${pendingTerminalCwdSync.source}:${pendingTerminalCwdSync.path}:${pendingTerminalCwdSync.shell ?? ''}`;
    if (lastTerminalCwdSyncKeyRef.current === syncKey) {
      return;
    }

    lastTerminalCwdSyncKeyRef.current = syncKey;
    void commands.terminalSyncCwd(activePaneId, pendingTerminalCwdSync.path)
      .then(unwrapTauriResult)
      .catch(() => injectCd(pendingTerminalCwdSync.path, pendingTerminalCwdSync.shell ?? undefined))
      .finally(() => clearPendingTerminalCwdSync(null));
  }, [activePaneId, clearPendingTerminalCwdSync, injectCd, isOpen, pendingTerminalCwdSync]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OverlayTerminalCommandInjectionDetail>).detail;
      if (!detail?.command) {
        return;
      }
      void injectCmd(detail.command, Boolean(detail.run));
    };
    window.addEventListener('overlayterm:cmdinject', handler);
    return () => window.removeEventListener('overlayterm:cmdinject', handler);
  }, [injectCmd]);

  const createPaneSession = useCallback((label: string): TerminalPaneSession => {
    const id = `overlay-${paneCounterRef.current}`;
    paneCounterRef.current += 1;
    return {
      id,
      label,
      createdAt: Date.now(),
    };
  }, []);

  const newTab = useCallback(() => {
    const pane = createPaneSession('Pane 1');
    const tabId = `terminal-tab-${tabCounterRef.current}`;
    tabCounterRef.current += 1;
    const nextTabs = [...tabs, {
      id: tabId,
      label: `${getShellDisplayLabel(settings.shell)} (${tabs.length + 1})`,
      layout: createTerminalPaneLayout(pane.id),
      activePaneId: pane.id,
      lastSplitDirection: 'columns' as const,
      broadcastInput: false,
      createdAt: Date.now(),
    }];

    setPaneSessions(prev => ({ ...prev, [pane.id]: pane }));
    paneTelemetryRef.current[pane.id] = createPaneTelemetry();
    setTabs(nextTabs);
    setActiveTabId(tabId);
    setTransientActionMessage(`Opened ${nextTabs[nextTabs.length - 1].label}`);
  }, [createPaneSession, settings.shell, tabs, setTransientActionMessage]);

  const splitActivePane = useCallback((direction: TerminalSplitDirection, targetPaneId = activePaneId) => {
    if (!activeTab) {
      return;
    }

    const pane = createPaneSession(`Pane ${activeTabPaneIds.length + 1}`);
    const splitResult = splitTerminalPaneLayout(
      activeTab.layout,
      targetPaneId,
      direction,
      pane.id,
      () => `terminal-split-${splitCounterRef.current++}`,
    );
    if (!splitResult.inserted) {
      return;
    }

    setPaneSessions(prev => ({ ...prev, [pane.id]: pane }));
    paneTelemetryRef.current[pane.id] = createPaneTelemetry();
    setTabs(prev => prev.map(tab => (
      tab.id === activeTab.id
        ? {
            ...tab,
            layout: splitResult.layout,
            activePaneId: pane.id,
            lastSplitDirection: direction,
          }
        : tab
    )));
    setTransientActionMessage(direction === 'columns' ? 'Added a side-by-side split' : 'Added a stacked split');
  }, [activePaneId, activeTab, activeTabPaneIds.length, createPaneSession, setTransientActionMessage]);

  const duplicateActivePane = useCallback(() => {
    if (!activeTab) {
      return;
    }
    const nextDirection = activeTab.lastSplitDirection;
    splitActivePane(nextDirection, activePaneId);
    setTransientActionMessage(`Forked a fresh ${nextDirection === 'columns' ? 'side-by-side' : 'stacked'} pane`);
  }, [activePaneId, activeTab, splitActivePane, setTransientActionMessage]);

  const toggleBroadcastActiveTab = useCallback(() => {
    if (!activeTab) {
      return;
    }
    setTabs(prev => prev.map(tab => (
      tab.id === activeTab.id
        ? { ...tab, broadcastInput: !tab.broadcastInput }
        : tab
    )));
    setTransientActionMessage(activeTab.broadcastInput ? 'Broadcast input disabled' : 'Broadcast input armed');
  }, [activeTab, setTransientActionMessage]);


  const closePane = useCallback((paneId: string) => {
    const tab = findTabForPane(paneId);
    const paneIds = tab ? (paneIdsByTab.get(tab.id) ?? []) : [];
    if (!tab || paneIds.length <= 1) {
      return;
    }

    const removal = removeTerminalPaneFromLayout(tab.layout, paneId);
    const nextLayout = removal.layout;
    if (!removal.removed || !nextLayout) {
      return;
    }

    destroyXterm(paneId);
    removePaneSession(paneId);

    setTabs(prev => prev.map(current => {
      if (current.id !== tab.id) {
        return current;
      }
      return {
        ...current,
        layout: nextLayout,
        activePaneId: current.activePaneId === paneId
          ? (removal.fallbackPaneId ?? collectTerminalPaneIds(nextLayout)[0] ?? current.activePaneId)
          : current.activePaneId,
      };
    }));
    setTransientActionMessage(`Closed ${paneSessions[paneId]?.label ?? 'pane'}`);
  }, [findTabForPane, paneIdsByTab, paneSessions, removePaneSession, setTransientActionMessage]);

  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) {
      return;
    }

    if (tabs.length === 1) {
      onClose();
      return;
    }

    const tab = tabs[tabIndex];
    (paneIdsByTab.get(tab.id) ?? []).forEach(paneId => {
      destroyXterm(paneId);
      removePaneSession(paneId);
    });

    const nextTabs = tabs.filter(current => current.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      const fallback = nextTabs[Math.max(0, tabIndex - 1)] ?? nextTabs[0];
      setActiveTabId(fallback.id);
    }
    setTransientActionMessage(`Closed ${tab.label}`);
  }, [activeTabId, onClose, paneIdsByTab, removePaneSession, setTransientActionMessage, tabs]);

  const startRename = useCallback((id: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameVal(label);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameVal.trim()) {
      setTabs(prev => prev.map(tab => (
        tab.id === renamingId ? { ...tab, label: renameVal.trim() } : tab
      )));
    }
    setRenamingId(null);
  }, [renameVal, renamingId]);

  const togglePanel = useCallback((panel: SidebarPanel) => {
    if (activePanel === panel && sidebarOpen) {
      setSidebarVisibility(false);
      setActivePanel(null);
      return;
    }
    setActivePanel(panel);
    setSidebarVisibility(true);
  }, [activePanel, setSidebarVisibility, sidebarOpen]);

  const slideClass = isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0';
  const workspaceCanvasRef = useRef<HTMLDivElement>(null);
  const activePaneSplitDirection = useMemo(
    () => activeTab ? getImmediatePaneSplitDirection(activeTab.layout, activePaneId) : null,
    [activePaneId, activeTab],
  );
  const activeTerminalReady = isPaneReady(activePaneId);
  const activeTabReadyCount = activeTabPaneIds.filter(isPaneReady).length;
  const activeTabLabel = activeTab?.label ?? 'terminal';
  const geometryByTab = useMemo(
    () => new Map(tabs.map(tab => [tab.id, collectTerminalPaneGeometry(tab.layout)])),
    [tabs],
  );
  const commitTabLayout = useCallback((tabId: string, layout: TerminalPaneLayoutNode) => {
    setTabs(prev => prev.map(tab => (
      tab.id === tabId
        ? { ...tab, layout }
        : tab
    )));
  }, []);
  const setPaneSurfaceElement = useCallback((tabId: string, paneId: string, element: HTMLDivElement | null) => {
    const key = getTerminalPaneDomKey(tabId, paneId);
    if (element) {
      paneSurfaceElementsRef.current.set(key, element);
      return;
    }
    paneSurfaceElementsRef.current.delete(key);
  }, []);
  const setSplitHandleElement = useCallback((tabId: string, splitId: string, element: HTMLDivElement | null) => {
    const key = getTerminalPaneDomKey(tabId, splitId);
    if (element) {
      splitHandleElementsRef.current.set(key, element);
      return;
    }
    splitHandleElementsRef.current.delete(key);
  }, []);
  const applyTabGeometryPreview = useCallback((tabId: string, layout: TerminalPaneLayoutNode) => {
    const geometry = collectTerminalPaneGeometry(layout);
    geometry.frames.forEach((frame) => {
      const element = paneSurfaceElementsRef.current.get(getTerminalPaneDomKey(tabId, frame.paneId));
      if (element) {
        applyTerminalPaneFrameToElement(element, frame);
      }
    });
    geometry.handles.forEach((handle) => {
      const element = splitHandleElementsRef.current.get(getTerminalPaneDomKey(tabId, handle.splitId));
      if (element) {
        applyTerminalSplitHandleToElement(element, handle);
      }
    });
  }, []);
  const scheduleTabGeometryPreview = useCallback((tabId: string, layout: TerminalPaneLayoutNode) => {
    splitResizePreviewRef.current = { tabId, layout };
    if (splitResizePreviewFrameRef.current !== null) {
      return;
    }
    splitResizePreviewFrameRef.current = window.requestAnimationFrame(() => {
      splitResizePreviewFrameRef.current = null;
      const preview = splitResizePreviewRef.current;
      if (!preview) {
        return;
      }
      applyTabGeometryPreview(preview.tabId, preview.layout);
    });
  }, [applyTabGeometryPreview]);
  useLayoutEffect(() => {
    const preview = splitResizePreviewRef.current;
    if (preview) {
      applyTabGeometryPreview(preview.tabId, preview.layout);
    }
  });
  const startSplitResize = useCallback((
    event: React.PointerEvent<HTMLDivElement>,
    tabId: string,
    handle: TerminalPaneSplitHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const workspaceRect = workspaceCanvasRef.current?.getBoundingClientRect();
    if (!workspaceRect) {
      return;
    }

    const rect = {
      left: workspaceRect.left + handle.containerX * workspaceRect.width,
      top: workspaceRect.top + handle.containerY * workspaceRect.height,
      width: handle.containerWidth * workspaceRect.width,
      height: handle.containerHeight * workspaceRect.height,
    };
    const axisSize = handle.direction === 'columns' ? rect.width : rect.height;
    if (axisSize <= 0) {
      return;
    }
    const tab = tabs.find(candidate => candidate.id === tabId);
    if (!tab) {
      return;
    }

    const minPaneSize = handle.direction === 'columns' ? 220 : 140;
    const edgeLimit = axisSize <= minPaneSize * 2 ? 0.5 : minPaneSize / axisSize;
    const clampRatio = (nextRatio: number) => Math.min(1 - edgeLimit, Math.max(edgeLimit, nextRatio));
    let nextLayout = tab.layout;
    let hasPreviewLayout = false;

    const updateFromPointer = (clientX: number, clientY: number) => {
      const rawRatio = handle.direction === 'columns'
        ? (clientX - rect.left) / rect.width
        : (clientY - rect.top) / rect.height;
      nextLayout = updateTerminalPaneSplitRatio(tab.layout, handle.splitId, clampRatio(rawRatio));
      hasPreviewLayout = true;
      scheduleTabGeometryPreview(tabId, nextLayout);
    };

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = handle.direction === 'columns' ? 'col-resize' : 'row-resize';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateFromPointer(moveEvent.clientX, moveEvent.clientY);
    };
    const handlePointerUp = () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (splitResizePreviewFrameRef.current !== null) {
        window.cancelAnimationFrame(splitResizePreviewFrameRef.current);
        splitResizePreviewFrameRef.current = null;
      }
      splitResizePreviewRef.current = null;
      if (hasPreviewLayout) {
        commitTabLayout(tabId, nextLayout);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
  }, [commitTabLayout, scheduleTabGeometryPreview, tabs]);
  const renderPaneSurface = useCallback((tabId: string, paneId: string, frame: TerminalPaneFrame): React.ReactNode => {
    const pane = paneSessions[paneId];
    if (!pane) {
      return null;
    }

    const ownerTab = tabs.find(candidate => candidate.id === tabId) ?? activeTab;
    const ownerPaneIds = ownerTab ? (paneIdsByTab.get(ownerTab.id) ?? []) : [];
    const ready = isPaneReady(paneId);
    const isActivePane = activePaneId === paneId;

    return (
      <div
        key={paneId}
        ref={element => setPaneSurfaceElement(tabId, paneId, element)}
        className="flex min-h-0 min-w-0 overflow-hidden rounded-xl border"
        style={{
          position: 'absolute',
          left: `${frame.x * 100}%`,
          top: `${frame.y * 100}%`,
          width: `${frame.width * 100}%`,
          height: `${frame.height * 100}%`,
          borderColor: isActivePane ? `${theme.accent}66` : 'var(--overlay-workbench-terminal-border)',
          background: 'var(--overlay-workbench-terminal-pane-bg)',
          boxShadow: isActivePane ? `0 0 0 1px ${theme.accent}18 inset` : 'none',
          borderRadius: 'var(--overlay-workbench-panel-radius)',
        }}
      >
        <div className="flex flex-1 min-h-0 min-w-0 flex-col">
          <div
            className="group flex items-center gap-2 border-b px-2 shrink-0"
            style={{
              minHeight: 30,
              borderColor: 'var(--overlay-workbench-terminal-border)',
              background: isActivePane ? `${theme.accent}0a` : 'transparent',
            }}
            onMouseDown={() => focusPane(tabId, paneId)}
          >
            <div
              className="shrink-0 rounded-full"
              style={{
                width: 6,
                height: 6,
                background: ready ? appearance.theme.palette.success : theme.textMuted,
                opacity: ready ? 1 : 0.4,
              }}
            />
            <span className="truncate text-[10px] font-medium flex-1" style={{ color: isActivePane ? theme.text : theme.textMuted }}>
              {pane.label}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={() => splitActivePane('columns', paneId)}
                className="flex items-center justify-center rounded transition-all hover:bg-white/10"
                style={{ width: 22, height: 22, color: theme.textMuted }}
                title="Split pane right"
                aria-label={`Split ${pane.label} right`}
              >
                <SplitSquareHorizontal size={11} />
              </button>
              <button
                type="button"
                onClick={() => splitActivePane('rows', paneId)}
                className="flex items-center justify-center rounded transition-all hover:bg-white/10"
                style={{ width: 22, height: 22, color: theme.textMuted }}
                title="Split pane down"
                aria-label={`Split ${pane.label} down`}
              >
                <SplitSquareVertical size={11} />
              </button>
              <button
                type="button"
                onClick={() => { void copyPaneOutput(paneId); }}
                className="flex items-center justify-center rounded transition-all hover:bg-white/10"
                style={{ width: 22, height: 22, color: theme.textMuted }}
                title="Copy output"
                aria-label={`Copy ${pane.label} output`}
              >
                <Copy size={11} />
              </button>
              <button
                type="button"
                onClick={() => { void restartPane(paneId); }}
                className="flex items-center justify-center rounded transition-all hover:bg-white/10"
                style={{ width: 22, height: 22, color: theme.textMuted }}
                title="Restart pane"
                aria-label={`Restart ${pane.label}`}
              >
                <RotateCcw size={11} />
              </button>
              {ownerPaneIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => closePane(paneId)}
                  className="flex items-center justify-center rounded transition-all hover:bg-red-500/10 hover:text-red-400"
                  style={{ width: 22, height: 22, color: theme.textMuted }}
                  title="Close pane"
                  aria-label={`Close ${pane.label}`}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          <div className="relative flex-1 min-h-0 min-w-0" onMouseDown={() => focusPane(tabId, paneId)}>
            {hasMountedRef.current && (
              <XTermPane
                key={paneId}
                id={paneId}
                visible={tabId === activeTabId}
                active={isActivePane && tabId === activeTabId}
                theme={theme}
                workbenchTheme={appearance.workbenchTheme}
                onReady={markTerminalReady}
                onFocus={(id) => {
                  const owner = findTabForPane(id);
                  if (owner) {
                    focusPane(owner.id, id);
                  }
                }}
                onData={handleTerminalInput}
                onOutput={handleTerminalOutput}
                onResize={handlePaneResize}
              />
            )}
          </div>
        </div>
      </div>
    );
  }, [
    activePaneId,
    activeTab,
    activeTabId,
    appearance.workbenchTheme,
    appearance.theme.palette.success,
    closePane,
    copyPaneOutput,
    findTabForPane,
    focusPane,
    handlePaneResize,
    handleTerminalInput,
    handleTerminalOutput,
    isPaneReady,
    markTerminalReady,
    paneIdsByTab,
    paneSessions,
    restartPane,
    splitActivePane,
    setPaneSurfaceElement,
    tabs,
    theme,
  ]);
  const terminalToolbarActions = useMemo<TerminalToolbarAction[]>(() => ([
    {
      id: 'split-columns',
      label: 'Split Columns',
      title: 'Add a pane to the right',
      icon: SplitSquareHorizontal,
      onClick: () => splitActivePane('columns', activePaneId),
      tone: activePaneSplitDirection === 'columns' ? 'accent' : 'default',
    },
    {
      id: 'split-rows',
      label: 'Split Rows',
      title: 'Add a pane below',
      icon: SplitSquareVertical,
      onClick: () => splitActivePane('rows', activePaneId),
      tone: activePaneSplitDirection === 'rows' ? 'accent' : 'default',
    },
    {
      id: 'fork-pane',
      label: 'New Pane',
      title: 'Open a fresh terminal pane in the current layout',
      icon: SquarePlus,
      onClick: duplicateActivePane,
    },
    { id: 'sep-1', label: '', title: '', separator: true },
    {
      id: 'broadcast',
      label: activeTab?.broadcastInput ? 'Broadcast On' : 'Broadcast Off',
      title: 'Mirror input to every pane in this tab',
      icon: Zap,
      onClick: toggleBroadcastActiveTab,
      tone: activeTab?.broadcastInput ? 'accent' : 'default',
    },
    { id: 'sep-2', label: '', title: '', separator: true },
    {
      id: 'copy-output',
      label: 'Copy Output',
      title: 'Copy the active pane scrollback',
      icon: Copy,
      onClick: () => { void copyPaneOutput(activePaneId); },
      disabled: !activeTerminalReady,
      tone: 'accent',
    },
    {
      id: 'copy-snapshot',
      label: 'Copy Snapshot',
      title: 'Copy a markdown snapshot of the active pane',
      icon: Hash,
      onClick: () => { void copyPaneSnapshot(activePaneId); },
      disabled: !activeTerminalReady,
    },
    {
      id: 'clear-pane',
      label: 'Clear',
      title: 'Clear the active pane viewport',
      icon: Eraser,
      onClick: () => clearPane(activePaneId),
      disabled: !activeTerminalReady,
    },
    {
      id: 'restart-pane',
      label: 'Restart',
      title: 'Restart the active pane session',
      icon: RotateCcw,
      onClick: () => { void restartPane(activePaneId); },
      disabled: !activeTerminalReady,
    },
  ]), [
    activePaneId,
    activePaneSplitDirection,
    activeTab?.broadcastInput,
    activeTerminalReady,
    clearPane,
    copyPaneOutput,
    copyPaneSnapshot,
    duplicateActivePane,
    restartPane,
    splitActivePane,
    toggleBroadcastActiveTab,
  ]);
  const terminalToolbarDetail = terminalActionMessage
    ?? (activeTerminalReady
      ? `${activeTabReadyCount}/${activeTabPaneIds.length} panes live · ${activeTab?.broadcastInput ? 'broadcasting input' : 'focused input'}`
      : `${activeTabLabel} starting...`);
  const sidebarToggleLabel = sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar';

  const sidebarPanelNode = sidebarOpen && activePanel ? (
    <div
      className="shrink-0 overflow-hidden relative"
      style={{ width: sidebarWidth, background: 'var(--overlay-workbench-terminal-panel-bg)', borderRight: '1px solid var(--overlay-workbench-terminal-border)', color: theme.text }}
    >
      <SidebarContent
        panel={activePanel}
        theme={theme}
        appearance={appearance}
        pluginCommands={pluginCommands}
        injectCmd={injectCmd}
        injectCd={injectCd}
        emitToTerminal={emitToActiveTerminal}
        announce={setTransientActionMessage}
        shell={settings.shell}
        platform={runtimePlatform}
        launchManagedRepl={launchManagedRepl}
      />
      <div
        onMouseDown={e => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = sidebarWidth;
          const onMouseMove = (me: MouseEvent) => setSidebarWidth(Math.max(150, Math.min(600, startW + (me.clientX - startX))));
          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/10 transition-colors z-10"
      />
    </div>
  ) : null;

  const workspaceArea = (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col" style={{ background: theme.bgTerm }}>
      <div className="flex-1 min-h-0 min-w-0 p-3">
        <div ref={workspaceCanvasRef} className="relative min-h-full min-w-0">
          {tabs.map(tab => {
            const geometry = geometryByTab.get(tab.id);
            if (!geometry) {
              return null;
            }
            const isActiveTabLayer = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{
                  opacity: isActiveTabLayer ? 1 : 0,
                  visibility: isActiveTabLayer ? 'visible' : 'hidden',
                  pointerEvents: isActiveTabLayer ? 'auto' : 'none',
                }}
              >
                {geometry.frames.map(frame => renderPaneSurface(tab.id, frame.paneId, frame))}
                {geometry.handles.map(handle => {
                  const isColumnSplit = handle.direction === 'columns';
                  return (
                    <div
                      key={handle.splitId}
                      ref={element => setSplitHandleElement(tab.id, handle.splitId, element)}
                      role="separator"
                      aria-orientation={isColumnSplit ? 'vertical' : 'horizontal'}
                      aria-label={isColumnSplit ? 'Resize panes horizontally' : 'Resize panes vertically'}
                      className="group absolute flex items-center justify-center"
                      style={{
                        left: isColumnSplit ? `calc(${handle.x * 100}% - 5px)` : `${handle.x * 100}%`,
                        top: isColumnSplit ? `${handle.y * 100}%` : `calc(${handle.y * 100}% - 5px)`,
                        width: isColumnSplit ? 10 : `${handle.width * 100}%`,
                        height: isColumnSplit ? `${handle.height * 100}%` : 10,
                        cursor: isColumnSplit ? 'col-resize' : 'row-resize',
                        touchAction: 'none',
                        zIndex: 5,
                      }}
                      onPointerDown={event => startSplitResize(event, tab.id, handle)}
                    >
                      <div
                        style={{
                          width: isColumnSplit ? 2 : 52,
                          height: isColumnSplit ? 52 : 2,
                          borderRadius: 999,
                          background: `${theme.textMuted}55`,
                          boxShadow: `0 0 0 1px ${theme.border} inset`,
                        }}
                        className="transition-colors group-hover:bg-white/40"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const tabStrip = (
    <OverlayScrollArea
      direction="horizontal"
      style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}
      contentStyle={{ display: 'flex', alignItems: 'stretch', minWidth: 'max-content' }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const paneIds = paneIdsByTab.get(tab.id) ?? [];
        return (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTabId(tab.id);
              focusPane(tab.id, tab.activePaneId);
            }}
            onDoubleClick={e => startRename(tab.id, tab.label, e)}
            style={{
              borderRight: `1px solid ${theme.border}`,
              borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
              background: isActive ? `${theme.accent}14` : 'transparent',
            }}
            className="group flex items-center gap-1.5 px-3 cursor-pointer select-none shrink-0 transition-colors hover:bg-white/[0.03]"
          >
            <TerminalSquare size={embedded ? 10 : 11} style={{ color: isActive ? theme.accent : theme.textMuted }} />
            <div className="min-w-0">
              {renamingId === tab.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: Math.max(renameVal.length * 7, 60), color: theme.text, borderBottom: `1px solid ${theme.accent}` }}
                  className="bg-transparent text-[11px] outline-none"
                />
              ) : (
                <>
                  <div className="text-[11px] font-medium whitespace-nowrap transition-all" style={{ color: isActive ? theme.text : theme.textMuted }}>
                    {tab.label}
                  </div>
                  <div className="text-[8px] uppercase tracking-[0.16em]" style={{ color: theme.textMuted }}>
                    {paneIds.length} pane{paneIds.length === 1 ? '' : 's'}{tab.broadcastInput ? ' · BCAST' : ''}
                  </div>
                </>
              )}
            </div>
            {tabs.length > 1 && (
              <button
                onClick={e => closeTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                style={{ color: theme.textMuted }}
              >
                <X size={9} />
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={newTab}
        className="flex items-center px-2 hover:bg-white/[0.04] transition-all shrink-0"
        style={{ color: theme.textMuted }}
        title="New Terminal Workspace"
      >
        <Plus size={embedded ? 11 : 12} />
      </button>
    </OverlayScrollArea>
  );

  const statusBar = (
    <div
      className="flex items-center gap-3 px-3 shrink-0 border-t"
      style={{ height: embedded ? 20 : 22, background: theme.statusBg ?? `${theme.accent}18`, borderColor: 'var(--overlay-workbench-terminal-border)' }}
    >
      <div className="flex items-center gap-1.5">
        <Circle size={embedded ? 5 : 6} className="fill-current" style={{ color: appearance.theme.palette.success }} />
        <span className="text-[9px] font-mono opacity-40">
          {activeTabLabel} · {activePane?.label ?? 'pane'}
        </span>
      </div>
      <span className="text-[9px] font-mono opacity-20">
        {tabs.length} workspace{tabs.length === 1 ? '' : 's'} · {totalPaneCount} pane{totalPaneCount === 1 ? '' : 's'}
      </span>
      <div className="flex-1" />
      <span className="text-[9px] opacity-20 select-none" style={{ fontFamily: appearance.fonts.mono }}>
        {activeTab?.broadcastInput ? 'broadcast armed' : 'focused input'} · {appearance.theme.id}
      </span>
    </div>
  );

  if (embedded) {
    return (
      <div
        className="flex flex-col overflow-hidden"
        style={{ flex: 1, background: 'var(--overlay-workbench-terminal-bg)', color: theme.text, fontFamily: uiFont, borderRadius: 'var(--overlay-workbench-panel-radius)' }}
      >
        <div
          className="flex items-stretch shrink-0 border-b"
          style={{ background: 'var(--overlay-workbench-terminal-panel-bg)', height: 38, borderColor: 'var(--overlay-workbench-terminal-border)' }}
        >
          <div className="flex items-center gap-0.5 px-2 border-r shrink-0" style={{ borderColor: theme.border }}>
            {TERMINAL_SIDEBAR_ITEMS.map(({ id, icon: Icon, title, accent }) => {
              const active = activePanel === id && sidebarOpen;
              return (
                <button
                  key={id}
                  onClick={() => togglePanel(id)}
                  title={title}
                  style={{
                    color: active ? (accent === 'success' ? appearance.theme.palette.success : theme.accent) : theme.textMuted,
                    background: active ? `${accent === 'success' ? appearance.theme.palette.success : theme.accent}1a` : 'transparent',
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-sm transition-all hover:opacity-90"
                >
                  <Icon size={12} />
                </button>
              );
            })}
            <div className="mx-1 h-4 w-px shrink-0 bg-white/10" aria-hidden="true" />
            <button
              type="button"
              onClick={toggleSidebarVisibility}
              aria-label={sidebarToggleLabel}
              title={sidebarToggleLabel}
              style={{ color: theme.textMuted }}
              className="w-6 h-6 flex items-center justify-center rounded-sm transition-all hover:opacity-90"
            >
              {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
          {tabStrip}
        </div>

        <TerminalActionToolbar actions={terminalToolbarActions} theme={theme} detail={terminalToolbarDetail} />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {sidebarPanelNode}
          {workspaceArea}
        </div>

        {statusBar}
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 flex flex-col overflow-hidden transition-all duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${slideClass}`}
      style={{
        background: 'var(--overlay-workbench-terminal-bg)',
        color: theme.text,
        fontFamily: uiFont,
        boxShadow: 'var(--overlay-workbench-shell-shadow)',
        borderTop: '1px solid var(--overlay-workbench-terminal-border)',
        backdropFilter: blurEnabled && appearance.workbenchTheme.terminalStyle === 'glass' ? 'blur(18px)' : 'none',
        WebkitBackdropFilter: blurEnabled && appearance.workbenchTheme.terminalStyle === 'glass' ? 'blur(18px)' : 'none',
      }}
    >
      <div
        className="h-[4px] shrink-0 cursor-ns-resize select-none"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${theme.accent}99 30%, ${theme.accent} 50%, ${theme.accent}99 70%, transparent 100%)` }}
        onPointerDown={e => {
          if (e.buttons === 1) {
            e.preventDefault();
            getCurrentWindow().startResizeDragging('North').catch(() => {});
          }
        }}
      />

      <div
        className="flex items-stretch shrink-0 border-b"
        style={{ background: 'var(--overlay-workbench-terminal-panel-bg)', height: 40, borderColor: 'var(--overlay-workbench-terminal-border)' }}
      >
        <div className="flex items-center gap-2 px-3 border-r shrink-0" style={{ borderColor: theme.border }}>
          <div
            className="w-[18px] h-[18px] rounded flex items-center justify-center"
            style={{ background: theme.accent + '28', border: `1px solid ${theme.accent}55` }}
          >
            <TerminalIcon size={10} style={{ color: theme.accent }} />
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase select-none" style={{ color: theme.textMuted }}>
            Console Lab
          </span>
        </div>

        {tabStrip}

        <div className="flex items-center gap-0.5 px-2 border-l shrink-0" style={{ borderColor: theme.border }}>
          <kbd
            className="text-[9px] font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5 select-none mr-1"
            style={{ color: theme.textMuted }}
          >
            {keybindings.terminalToggle}
          </kbd>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-red-500/12 hover:text-red-400 transition-all"
            style={{ color: theme.textMuted }}
            title="Close (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <TerminalActionToolbar actions={terminalToolbarActions} theme={theme} detail={terminalToolbarDetail} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col items-center gap-0.5 py-2 shrink-0"
          style={{ width: 36, background: 'var(--overlay-workbench-terminal-panel-bg)', borderRight: '1px solid var(--overlay-workbench-terminal-border)' }}>
          {TERMINAL_SIDEBAR_ITEMS.map(({ id, icon: Icon, title, accent }) => {
            const active = activePanel === id && sidebarOpen;
            return (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                title={title}
                style={{
                  color: active ? (accent === 'success' ? appearance.theme.palette.success : theme.accent) : theme.textMuted,
                  background: active ? `${accent === 'success' ? appearance.theme.palette.success : theme.accent}1a` : 'transparent',
                  borderLeft: `2px solid ${active ? (accent === 'success' ? appearance.theme.palette.success : theme.accent) : 'transparent'}`,
                }}
                className="w-7 h-7 flex items-center justify-center rounded-sm transition-all hover:opacity-90"
              >
                <Icon size={14} />
              </button>
            );
          })}

          <div className="flex-1" />

          <button
            type="button"
            onClick={toggleSidebarVisibility}
            className="w-7 h-7 flex items-center justify-center transition-all hover:opacity-80"
            style={{ color: theme.textMuted }}
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
          >
            {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        {sidebarPanelNode}
        {workspaceArea}
      </div>

      {statusBar}
    </div>
  );
}

export default TerminalOverlay;
