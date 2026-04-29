/**
 * WindowControls - Platform-adaptive traffic light / title bar buttons.
 *
 * - macOS: coloured dot cluster (top-left), matching native HIG sizing.
 * - Windows / Linux: horizontal strip (top-right), Win11-style.
 *
 * The component is fully self-contained and communicates exclusively
 * via the Tauri WebviewWindow API — no Rust commands needed.
 */

import { useCallback, useMemo, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type RuntimePlatform } from '../config/platform';

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

// ─── macOS traffic lights ──────────────────────────────────────────────────────

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
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      aria-label={title}
      data-gfs-window-drag-exclusion="true"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: hovered ? hoverColor : color,
        border: 'none',
        cursor: 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.12s ease',
        fontSize: 8,
        lineHeight: 1,
        color: 'rgba(0,0,0,0.55)',
        fontWeight: 700,
      }}
    >
      {hovered ? symbol : null}
    </button>
  );
}

function MacOSControls({ onMinimize, onMaximize, onClose }: Pick<WindowControlsProps, 'onMinimize' | 'onMaximize' | 'onClose'>) {
  return (
    <div
      data-gfs-window-drag-exclusion="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px',
        height: '100%',
        flexShrink: 0,
      }}
      // Prevent the drag region from swallowing click events on the dots
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MacOSDot
        color="#ff5f57"
        hoverColor="#e0443e"
        symbol="✕"
        title="Close"
        onClick={onClose ?? (() => {})}
      />
      <MacOSDot
        color="#febc2e"
        hoverColor="#d9a21b"
        symbol="−"
        title="Minimize"
        onClick={onMinimize ?? (() => {})}
      />
      <MacOSDot
        color="#28c840"
        hoverColor="#1aab2f"
        symbol="+"
        title="Maximize"
        onClick={onMaximize ?? (() => {})}
      />
    </div>
  );
}

// ─── Windows / Linux controls ─────────────────────────────────────────────────

function WinButton({
  label,
  title,
  isClose,
  onClick,
  textMuted,
}: {
  label: string;
  title: string;
  isClose?: boolean;
  onClick: () => void;
  textMuted: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      aria-label={title}
      data-gfs-window-drag-exclusion="true"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        width: 46,
        height: 32,
        border: 'none',
        background: hovered
          ? isClose
            ? '#c42b1c'
            : 'rgba(255,255,255,0.08)'
          : 'transparent',
        color: hovered && isClose ? '#fff' : textMuted,
        cursor: 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        transition: 'background 0.1s ease, color 0.1s ease',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function WindowsControls({
  isMaximized,
  onMinimize,
  onMaximize,
  onClose,
  textMuted = 'rgba(255,255,255,0.5)',
}: Pick<WindowControlsProps, 'isMaximized' | 'onMinimize' | 'onMaximize' | 'onClose' | 'textMuted'>) {
  return (
    <div
      data-gfs-window-drag-exclusion="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
    >
      <WinButton label="─" title="Minimize" onClick={onMinimize ?? (() => {})} textMuted={textMuted} />
      <WinButton
        label={isMaximized ? '❐' : '□'}
        title={isMaximized ? 'Restore' : 'Maximize'}
        onClick={onMaximize ?? (() => {})}
        textMuted={textMuted}
      />
      <WinButton label="✕" title="Close" isClose onClick={onClose ?? (() => {})} textMuted={textMuted} />
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function WindowControls({
  platform,
  isMaximized = false,
  onMinimize,
  onMaximize,
  onClose,
  textMuted = 'rgba(255,255,255,0.45)',
}: WindowControlsProps) {
  const win = useMemo(() => {
    if (!isTauri()) {
      return null;
    }

    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  }, []);

  const handleMinimize = useCallback(async () => {
    if (onMinimize) { onMinimize(); return; }
    if (!win) {
      return;
    }
    await win.minimize().catch(() => {});
  }, [onMinimize, win]);

  const handleMaximize = useCallback(async () => {
    if (onMaximize) { onMaximize(); return; }
    if (!win) {
      return;
    }

    if (isMaximized) {
      await win.unmaximize().catch(() => {});
    } else {
      await win.maximize().catch(() => {});
    }
  }, [isMaximized, onMaximize, win]);

  const handleClose = useCallback(async () => {
    if (onClose) { onClose(); return; }
    // Default close hides the window (overlay app - don't quit on X)
    if (!win) {
      return;
    }
    await win.hide().catch(() => {});
  }, [onClose, win]);

  if (platform === 'macos') {
    return (
      <MacOSControls
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onClose={handleClose}
      />
    );
  }

  return (
    <WindowsControls
      isMaximized={isMaximized}
      onMinimize={handleMinimize}
      onMaximize={handleMaximize}
      onClose={handleClose}
      textMuted={textMuted}
    />
  );
}
