import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import GoPanelHost, {
  type GoPanelHostContext,
  type GoPanelHostEvent,
} from '../GoPanelHost';
import { useSettingsStore } from '../../store/settingsStore';
import {
  registerTerminalPaneHostEntry,
  unregisterTerminalPaneHostEntry,
  type TerminalPaneLocalMessageTone,
} from './terminalHostRegistry';

export const GO_PTY_TERMINAL_RUNTIME_ID = 'go-pty-panel';

interface GoPtyTerminalPaneHostContext extends GoPanelHostContext {
  terminalHost: {
    terminalId: string;
    workingDirectory: string | null;
    shellCommand: string | null;
    fontFamily: string;
    fontSize: number;
    scrollback: number;
    cursorBlink: boolean;
    cursorStyle: string;
    theme: {
      background: string;
      foreground: string;
      border: string;
      accent: string;
    };
  };
}

interface GoPtyTerminalPaneProps {
  id: string;
  visible: boolean;
  active: boolean;
  bootReady: boolean;
  workingDirectory?: string | null;
  shellCommand?: string | null;
  theme: {
    bgTerm: string;
    text: string;
    border: string;
    accent: string;
  };
  onReady?: (id: string) => void;
  onFocus?: (id: string) => void;
  onData?: (id: string, data: string) => void;
  onOutput?: (id: string, payload: string) => void;
  onResize?: (id: string, rows: number, cols: number) => void;
  onFallbackRequested?: (reason: string) => void;
}

interface TerminalPanelCommandDetail {
  type: 'focus' | 'clear' | 'append-local-message';
  label?: string;
  body?: string;
  tone?: TerminalPaneLocalMessageTone;
}

function readScopedSelectionText(root: HTMLElement | null): string {
  if (!root) {
    return '';
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return '';
  }
  const anchorNode = selection.anchorNode;
  if (!anchorNode || !root.contains(anchorNode)) {
    return '';
  }
  return selection.toString().trim();
}

export const GoPtyTerminalPane = memo(function GoPtyTerminalPane({
  id,
  visible,
  active,
  bootReady,
  workingDirectory = null,
  shellCommand = null,
  theme,
  onReady,
  onFocus,
  onData,
  onOutput,
  onResize,
  onFallbackRequested,
}: GoPtyTerminalPaneProps) {
  const settings = useSettingsStore(state => state.settings.terminal);
  const hostElementRef = useRef<HTMLDivElement | null>(null);

  const dispatchPanelCommand = useCallback((detail: TerminalPanelCommandDetail) => {
    const root = hostElementRef.current;
    if (!root) {
      return;
    }
    root.dispatchEvent(new CustomEvent('greeblefs-terminal-panel-command', {
      detail,
      bubbles: false,
    }));
  }, []);

  useEffect(() => {
    registerTerminalPaneHostEntry(id, {
      hostId: 'go-pty-panel',
      focus: () => dispatchPanelCommand({ type: 'focus' }),
      clear: () => dispatchPanelCommand({ type: 'clear' }),
      getSelectionText: () => readScopedSelectionText(hostElementRef.current),
      appendLocalMessage: (label, body, tone = 'info') => {
        dispatchPanelCommand({
          type: 'append-local-message',
          label,
          body,
          tone,
        });
      },
    });
    return () => {
      unregisterTerminalPaneHostEntry(id);
    };
  }, [dispatchPanelCommand, id]);

  const context = useMemo<GoPtyTerminalPaneHostContext>(() => ({
    runtimeId: GO_PTY_TERMINAL_RUNTIME_ID,
    panelId: `terminal-pane:${id}`,
    appearanceId: null,
    densityToken: null,
    cssVariables: {},
    assetUrls: {},
    size: { width: 0, height: 0 },
    terminalHost: {
      terminalId: id,
      workingDirectory,
      shellCommand,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      scrollback: settings.scrollback,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      theme: {
        background: theme.bgTerm,
        foreground: theme.text,
        border: theme.border,
        accent: theme.accent,
      },
    },
  }), [
    id,
    settings.cursorBlink,
    settings.cursorStyle,
    settings.fontFamily,
    settings.fontSize,
    settings.scrollback,
    shellCommand,
    theme.accent,
    theme.bgTerm,
    theme.border,
    theme.text,
    workingDirectory,
  ]);

  const handleRuntimeEvent = useCallback((event: GoPanelHostEvent) => {
    if (event.kind === 'error') {
      onFallbackRequested?.(event.message);
      return;
    }
    if (event.kind !== 'host-event') {
      return;
    }
    if (event.name === 'terminal-ready') {
      onReady?.(id);
      return;
    }
    if (event.name === 'terminal-focus') {
      onFocus?.(id);
      return;
    }
    if (event.name === 'terminal-input') {
      const payload = (event.payload ?? {}) as { data?: string };
      if (payload.data) {
        onFocus?.(id);
        onData?.(id, payload.data);
      }
      return;
    }
    if (event.name === 'terminal-output') {
      const payload = (event.payload ?? {}) as { data?: string };
      if (payload.data) {
        onOutput?.(id, payload.data);
      }
      return;
    }
    if (event.name === 'terminal-resize') {
      const payload = (event.payload ?? {}) as { rows?: number; cols?: number };
      if (typeof payload.rows === 'number' && typeof payload.cols === 'number') {
        onResize?.(id, payload.rows, payload.cols);
      }
      return;
    }
    if (event.name === 'terminal-fallback-requested') {
      const payload = (event.payload ?? {}) as { reason?: string };
      onFallbackRequested?.(payload.reason ?? 'Go PTY panel requested xterm fallback.');
    }
  }, [id, onData, onFallbackRequested, onFocus, onOutput, onReady, onResize]);

  if (!bootReady) {
    return null;
  }

  return (
    <div
      data-testid={`terminal-pane-viewport-${id}`}
      style={{ display: visible ? 'block' : 'none' }}
      className="absolute inset-0"
    >
      <GoPanelHost
        runtimeId={GO_PTY_TERMINAL_RUNTIME_ID}
        context={context}
        onEvent={handleRuntimeEvent}
        hostElementRef={hostElementRef}
        className="absolute inset-0"
        style={{
          border: active ? `1px solid ${theme.border}` : '1px solid transparent',
          background: theme.bgTerm,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
      />
    </div>
  );
});

GoPtyTerminalPane.displayName = 'GoPtyTerminalPane';

export default GoPtyTerminalPane;
