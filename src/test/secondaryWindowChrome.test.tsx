import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  isSecondaryWindowChromeInteractiveTarget,
  useSecondaryWindowChromeControls,
} from '../windows/secondaryWindowChrome';

function installTauriWindowMock(isMaximized: boolean) {
  const windowMock = {
    close: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockResolvedValue(isMaximized),
    maximize: vi.fn().mockResolvedValue(undefined),
    minimize: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(getCurrentWindow).mockReturnValue(
    windowMock as unknown as ReturnType<typeof getCurrentWindow>,
  );
  return windowMock;
}

function TestChrome() {
  const chrome = useSecondaryWindowChromeControls();
  return (
    <header
      data-testid="chrome"
      onPointerDown={chrome.handleDragPointerDown}
      onDoubleClick={chrome.handleTitleDoubleClick}
    >
      <span>Title</span>
      <button type="button" data-testid="chrome-action" onClick={chrome.handleMinimize}>
        action
      </button>
      <button type="button" data-testid="chrome-toggle" onClick={chrome.handleToggleMaximize}>
        {chrome.isMaximized ? 'restore' : 'maximize'}
      </button>
    </header>
  );
}

describe('secondaryWindowChrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(getCurrentWindow).mockImplementation(() => {
        throw new Error('getCurrentWindow should not be called outside Tauri');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies interactive chrome targets so drag never swallows clicks', () => {
    const { container } = render(
      <div>
        <button type="button">plain</button>
        <span data-gfs-window-drag-exclusion="true">excluded</span>
        <span>label</span>
      </div>,
    );
    const [button, excluded, label] = Array.from(container.querySelectorAll('button, span'));

    expect(isSecondaryWindowChromeInteractiveTarget(button)).toBe(true);
    expect(isSecondaryWindowChromeInteractiveTarget(excluded)).toBe(true);
    expect(isSecondaryWindowChromeInteractiveTarget(label)).toBe(false);
    expect(isSecondaryWindowChromeInteractiveTarget(null)).toBe(false);
  });

  it('starts a native drag on header pointer-down but not on controls', () => {
    const windowMock = installTauriWindowMock(false);
    render(<TestChrome />);

    fireEvent.pointerDown(screen.getByTestId('chrome'), { button: 0 });
    expect(windowMock.startDragging).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(screen.getByTestId('chrome-action'), { button: 0 });
    expect(windowMock.startDragging).toHaveBeenCalledTimes(1);
  });

  it('ignores non-primary buttons without touching the window bridge', () => {
    const windowMock = installTauriWindowMock(false);
    render(<TestChrome />);

    fireEvent.pointerDown(screen.getByTestId('chrome'), { button: 2 });
    expect(windowMock.startDragging).not.toHaveBeenCalled();
  });

  it('toggles maximize on double-click and on the control', async () => {
    const windowMock = installTauriWindowMock(false);
    render(<TestChrome />);

    fireEvent.doubleClick(screen.getByTestId('chrome'));
    await waitFor(() => {
      expect(windowMock.maximize).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('chrome-toggle')).toHaveTextContent('restore');
    });
  });

  it('restores an already-maximized window', async () => {
    const windowMock = installTauriWindowMock(true);
    render(<TestChrome />);

    await waitFor(() => {
      expect(screen.getByTestId('chrome-toggle')).toHaveTextContent('restore');
    });

    fireEvent.click(screen.getByTestId('chrome-toggle'));
    await waitFor(() => {
      expect(windowMock.unmaximize).toHaveBeenCalledTimes(1);
    });
  });

  it('does nothing outside Tauri', () => {
    render(<TestChrome />);

    fireEvent.pointerDown(screen.getByTestId('chrome'), { button: 0 });
    fireEvent.doubleClick(screen.getByTestId('chrome'));
    expect(getCurrentWindow).not.toHaveBeenCalled();
  });
});
