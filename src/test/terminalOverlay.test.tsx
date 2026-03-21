import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

const { mockXtermInstances } = vi.hoisted(() => ({
  mockXtermInstances: [] as {
    clear: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  }[],
}));

class MockXtermLine {
  constructor(private readonly text: string) {}

  translateToString(): string {
    return this.text;
  }
}

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    rows = 24;
    cols = 80;
    selection = '';
    clear = vi.fn();
    reset = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn();
    writeln = vi.fn();
    onData = vi.fn();
    onResize = vi.fn();
    buffer = {
      active: {
        length: 2,
        getLine: (index: number) => {
          const lines = ['PS M:\\OverlayTerm> dir', 'src  src-tauri  package.json'];
          return index < lines.length ? new MockXtermLine(lines[index]) : undefined;
        },
      },
    };

    constructor() {
      mockXtermInstances.push(this);
    }

    getSelection(): string {
      return this.selection;
    }
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: class {},
}));

import TerminalOverlay from '../components/TerminalOverlay';

describe('TerminalOverlay', () => {
  beforeEach(() => {
    mockXtermInstances.length = 0;

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('copies the active terminal buffer to the clipboard', async () => {
    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    const copyButton = await screen.findByRole('button', { name: 'Copy Output' });
    await waitFor(() => expect(copyButton).toBeEnabled());

    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'PS M:\\OverlayTerm> dir\nsrc  src-tauri  package.json',
      );
    });
  });

  it('clears and restarts the active terminal session', async () => {
    const invokeMock = vi.mocked(invoke);

    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    const clearButton = await screen.findByRole('button', { name: 'Clear' });
    const restartButton = await screen.findByRole('button', { name: 'Restart' });
    await waitFor(() => expect(clearButton).toBeEnabled());

    await userEvent.click(clearButton);
    await userEvent.click(restartButton);

    expect(mockXtermInstances[0]?.clear).toHaveBeenCalledTimes(1);
    expect(mockXtermInstances[0]?.reset).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('terminal_kill', { id: 'overlay-0' });
    expect(invokeMock).toHaveBeenCalledWith('terminal_spawn', {
      id: 'overlay-0',
      rows: 24,
      cols: 80,
    });
  });
});
