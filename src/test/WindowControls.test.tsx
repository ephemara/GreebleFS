import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WindowControls } from '../components/WindowControls';

function restoreTauriWindowMock(): void {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(getCurrentWindow).mockImplementation(() => ({
    scaleFactor: vi.fn().mockResolvedValue(1),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setDecorations: vi.fn().mockResolvedValue(undefined),
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    setResizable: vi.fn().mockResolvedValue(undefined),
    setShadow: vi.fn().mockResolvedValue(undefined),
    setSkipTaskbar: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    maximize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
    unminimize: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(false),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    outerSize: vi.fn().mockResolvedValue({ width: 1000, height: 500 }),
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
    onResized: vi.fn().mockResolvedValue(() => {}),
    onMoved: vi.fn().mockResolvedValue(() => {}),
    onCloseRequested: vi.fn().mockResolvedValue(() => {}),
    is_visible: vi.fn().mockResolvedValue(false),
    startResizeDragging: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
  }) as unknown as ReturnType<typeof getCurrentWindow>);
}

describe('WindowControls', () => {
  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(getCurrentWindow).mockImplementation(() => {
      throw new Error('getCurrentWindow should not be called outside Tauri');
    });
  });

  afterEach(() => {
    restoreTauriWindowMock();
  });

  it('renders without touching the Tauri window bridge when the bridge is unavailable', () => {
    render(<WindowControls platform="linux" />);

    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    expect(screen.getByTitle('Maximize')).toBeInTheDocument();
    expect(screen.getByTitle('Close')).toBeInTheDocument();
    expect(getCurrentWindow).not.toHaveBeenCalled();
  });
});
