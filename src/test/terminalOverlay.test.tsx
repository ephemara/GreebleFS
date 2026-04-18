import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { normalizeThemeDefinition, resolveOverlayAppearance } from '../config/appearance';
import { resetTerminalWebglSupportCacheForTests } from '../components/terminal/terminalRendererSupport';
import { useExplorerStore } from '../store/explorerStore';

const { mockWebglAddonInstances, mockXtermInstances } = vi.hoisted(() => ({
  mockWebglAddonInstances: [] as {
    clearTextureAtlas: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    triggerContextLoss: () => void;
  }[],
  mockXtermInstances: [] as {
    clear: ReturnType<typeof vi.fn>;
    bootOptions: Record<string, unknown>;
    loadAddon: ReturnType<typeof vi.fn>;
    options: Record<string, unknown>;
    reset: ReturnType<typeof vi.fn>;
    emitData: (data: string) => void;
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
    bootOptions: Record<string, unknown> = {};
    options: Record<string, unknown> = {};
    selection = '';
    private dataHandler: ((data: string) => void) | null = null;
    clear = vi.fn();
    reset = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    loadAddon = vi.fn();
    open = vi.fn();
    scrollToBottom = vi.fn();
    writeln = vi.fn();
    onData = vi.fn((handler: (data: string) => void) => {
      this.dataHandler = handler;
    });
    onResize = vi.fn();
    buffer = {
      active: {
        baseY: 0,
        length: 2,
        viewportY: 0,
        getLine: (index: number) => {
          const lines = ['PS M:\\OverlayTerm> dir', 'src  src-tauri  package.json'];
          return index < lines.length ? new MockXtermLine(lines[index]) : undefined;
        },
      },
    };

    constructor(initialOptions: Record<string, unknown> = {}) {
      this.bootOptions = initialOptions;
      this.options = initialOptions;
      mockXtermInstances.push(this);
    }

    getSelection(): string {
      return this.selection;
    }

    emitData(data: string): void {
      this.dataHandler?.(data);
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

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    private contextLossHandler: (() => void) | null = null;
    clearTextureAtlas = vi.fn();
    dispose = vi.fn();

    constructor() {
      mockWebglAddonInstances.push(this);
    }

    onContextLoss(handler: () => void) {
      this.contextLossHandler = handler;
      return {
        dispose: vi.fn(),
      };
    }

    triggerContextLoss(): void {
      this.contextLossHandler?.();
    }
  },
}));

import TerminalOverlay from '../components/TerminalOverlay';
import { useSettingsStore } from '../store/settingsStore';

describe('TerminalOverlay', () => {
  beforeEach(() => {
    mockWebglAddonInstances.length = 0;
    mockXtermInstances.length = 0;
    resetTerminalWebglSupportCacheForTests();
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(null);
    vi.mocked(listen).mockReset();
    vi.mocked(listen).mockResolvedValue(() => {});
    useSettingsStore.getState().resetToDefaults();

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(null),
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

    expect(screen.queryByTestId('terminal-pane-fx-overlay-0')).not.toBeInTheDocument();
    const copyButton = await screen.findByRole('button', { name: 'Copy Output' });
    await waitFor(() => expect(copyButton).toBeEnabled());

    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'PS M:\\OverlayTerm> dir\nsrc  src-tauri  package.json',
      );
    });
  }, 20000);

  it('clears and restarts the active terminal session', async () => {
    const invokeMock = vi.mocked(invoke);

    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    const clearButton = await screen.findByRole('button', { name: 'Clear' });
    const restartButton = screen.getByTitle('Restart the active pane session');
    await waitFor(() => expect(clearButton).toBeEnabled());

    await userEvent.click(clearButton);
    await userEvent.click(restartButton);

    expect(mockXtermInstances[0]?.clear).toHaveBeenCalledTimes(1);
    expect(mockXtermInstances[0]?.reset).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('terminal_kill', { id: 'overlay-0' });
    expect(invokeMock).toHaveBeenCalledWith('terminal_spawn', expect.objectContaining({
      id: 'overlay-0',
      rows: 24,
      cols: 80,
    }));
  }, 20000);

  it('splits the active workspace and broadcasts typed input across panes', async () => {
    const invokeMock = vi.mocked(invoke);

    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    await userEvent.click(await screen.findByRole('button', { name: 'Split Columns' }));

    await waitFor(() => {
      expect(mockXtermInstances).toHaveLength(2);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Broadcast Off' }));
    await screen.findByRole('button', { name: 'Broadcast On' });

    invokeMock.mockClear();
    mockXtermInstances[0]?.emitData('npm test');

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_write_many', {
        writes: [
          { id: 'overlay-0', data: 'npm test' },
          { id: 'overlay-1', data: 'npm test' },
        ],
      });
    });
  }, 20000);

  it('injects a shell-specific cd command when the explorer queues a terminal cwd sync', async () => {
    const invokeMock = vi.mocked(invoke);

    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    await waitFor(() => expect(mockXtermInstances).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy Output' })).toBeEnabled());

    useExplorerStore.getState().setPendingTerminalCwdSync({
      path: 'C:\\workspace\\Taloor\'s Lab',
      shell: 'pwsh.exe -NoLogo',
      source: 'navigation',
      updatedAt: 0,
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_sync_cwd', {
        id: 'overlay-0',
        cwd: "C:\\workspace\\Taloor's Lab",
      });
    });
  }, 20000);

  it('spawns and restarts preview-scoped panes with namespaced ids and working directories', async () => {
    const invokeMock = vi.mocked(invoke);
    const previewWorkingDirectory = 'C:\\workspace\\repo';

    render(
      <TerminalOverlay
        isOpen
        onClose={() => {}}
        embedded
        terminalIdNamespace="preview-pane"
        workingDirectory={previewWorkingDirectory}
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_spawn', expect.objectContaining({
        id: 'preview-pane-0',
        workingDir: previewWorkingDirectory,
      }));
    });

    await userEvent.click(await screen.findByTitle('Restart the active pane session'));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_kill', { id: 'preview-pane-0' });
      expect(invokeMock).toHaveBeenCalledWith('terminal_spawn', expect.objectContaining({
        id: 'preview-pane-0',
        workingDir: previewWorkingDirectory,
      }));
    });

    await userEvent.click(screen.getByRole('button', { name: 'Split Columns' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_spawn', expect.objectContaining({
        id: 'preview-pane-1',
        workingDir: previewWorkingDirectory,
      }));
    });
  }, 20000);

  it('syncs the active pane directly from the provided working directory when explorer queue sync is disabled', async () => {
    const invokeMock = vi.mocked(invoke);
    const previewWorkingDirectory = 'C:\\workspace\\repo';
    const nextWorkingDirectory = 'C:\\workspace\\repo\\alpha';
    const { rerender } = render(
      <TerminalOverlay
        isOpen
        onClose={() => {}}
        embedded
        terminalIdNamespace="preview-pane"
        workingDirectory={previewWorkingDirectory}
        consumeExplorerCwdSync={false}
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_spawn', expect.objectContaining({
        id: 'preview-pane-0',
        workingDir: previewWorkingDirectory,
      }));
    });

    invokeMock.mockClear();

    rerender(
      <TerminalOverlay
        isOpen
        onClose={() => {}}
        embedded
        terminalIdNamespace="preview-pane"
        workingDirectory={nextWorkingDirectory}
        consumeExplorerCwdSync={false}
      />,
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('terminal_sync_cwd', {
        id: 'preview-pane-0',
        cwd: nextWorkingDirectory,
      });
    });
  }, 20000);

  it('reports shell integration cwd changes only for the active pane prompt and dedupes repeats', async () => {
    const eventHandlers = new Map<string, (event: { payload: unknown }) => void>();
    vi.mocked(listen).mockImplementation(async (eventName, handler) => {
      eventHandlers.set(String(eventName), handler as (event: { payload: unknown }) => void);
      return () => {
        eventHandlers.delete(String(eventName));
      };
    });

    const onReportedWorkingDirectoryChange = vi.fn();
    render(
      <TerminalOverlay
        isOpen
        onClose={() => {}}
        embedded
        terminalIdNamespace="preview-pane"
        workingDirectory={'C:\\workspace\\repo'}
        consumeExplorerCwdSync={false}
        onReportedWorkingDirectoryChange={onReportedWorkingDirectoryChange}
      />,
    );

    await waitFor(() => {
      expect(eventHandlers.has('terminal-output-preview-pane-0')).toBe(true);
      expect(eventHandlers.has('terminal-shell-integration-state-event')).toBe(true);
    });

    const shellIntegrationHandler = eventHandlers.get('terminal-shell-integration-state-event');
    if (!shellIntegrationHandler) {
      throw new Error('Missing shell integration handler');
    }

    const createShellIntegrationPayload = (
      id: string,
      atPrompt: boolean,
      reportedCwd: string | null,
    ) => ({
      payload: {
        id,
        appliedCwd: null,
        state: {
          atPrompt,
          pendingCwd: null,
          lastSyncedCwd: null,
          reportedCwd,
          shellKind: 'unknown',
          supportsAutoCd: true,
        },
      },
    });

    shellIntegrationHandler(
      createShellIntegrationPayload(
        'preview-pane-1',
        true,
        'C:\\workspace\\repo\\beta',
      ),
    );
    shellIntegrationHandler(
      createShellIntegrationPayload(
        'preview-pane-0',
        false,
        'C:\\workspace\\repo\\beta',
      ),
    );
    shellIntegrationHandler(
      createShellIntegrationPayload(
        'preview-pane-0',
        true,
        'C:\\workspace\\repo\\beta',
      ),
    );
    shellIntegrationHandler(
      createShellIntegrationPayload(
        'preview-pane-0',
        true,
        'C:\\workspace\\repo\\beta',
      ),
    );

    await waitFor(() => {
      expect(onReportedWorkingDirectoryChange).toHaveBeenCalledTimes(1);
      expect(onReportedWorkingDirectoryChange).toHaveBeenCalledWith(
        'C:\\workspace\\repo\\beta',
      );
    });
  }, 20000);

  it('can nest splits around the focused pane and exposes draggable dividers', async () => {
    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    await userEvent.click(await screen.findByRole('button', { name: 'Split Columns' }));
    await waitFor(() => {
      expect(mockXtermInstances).toHaveLength(2);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Split Rows' }));
    await waitFor(() => {
      expect(mockXtermInstances).toHaveLength(3);
    });

    expect(screen.getByText('Pane 3')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Resize panes horizontally')).toHaveLength(1);
    expect(screen.getAllByLabelText('Resize panes vertically')).toHaveLength(1);
  }, 20000);

  it('copies a markdown snapshot of the active pane', async () => {
    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    const snapshotButton = await screen.findByRole('button', { name: 'Copy Snapshot' });
    await waitFor(() => expect(snapshotButton).toBeEnabled());

    await userEvent.click(snapshotButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Pane 1'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('```text'));
    });
  }, 20000);

  it('exposes the managed Python rail inside the terminal sidebar', async () => {
    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    await userEvent.click(await screen.findByTitle('Python'));

    expect(await screen.findByText('Managed Runtime')).toBeInTheDocument();
    expect(screen.getByText('Quick Runs')).toBeInTheDocument();
  }, 20000);

  it('launches the managed Python REPL into the active terminal tab', async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'python_get_runtime_status') {
        return {
          ready: true,
          managedPythonPath: 'C:\\Python Runtime\\env\\Scripts\\python.exe',
          baseInterpreter: { label: 'Python 3.11', version: '3.11.9' },
          bootstrapPackages: [],
        };
      }

      return null;
    });

    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    await userEvent.click(await screen.findByTitle('Python'));

    const replButton = await screen.findByRole('button', { name: 'Open Managed REPL' });
    await waitFor(() => expect(replButton).toBeEnabled());
    await userEvent.click(replButton);

    expect(invokeMock).toHaveBeenCalledWith('terminal_write', {
      id: 'overlay-0',
      data: "'C:\\Python Runtime\\env\\Scripts\\python.exe'\r",
    });
  }, 20000);

  it('boots the pane with the WebGL renderer when hardware support is available and keeps the hot pane free of viewport fx', async () => {
    const hardwareRenderer = 'NVIDIA Corporation Quadro RTX 3000/PCIe/SSE2';
    const debugRendererInfo = {
      UNMASKED_VENDOR_WEBGL: 0x9245,
      UNMASKED_RENDERER_WEBGL: 0x9246,
    };
    const getContextMock = vi.fn((kind: string) => {
      if (kind !== 'webgl2') {
        return null;
      }

      return {
        getExtension: (name: string) => {
          if (name === 'WEBGL_debug_renderer_info') {
            return debugRendererInfo;
          }
          if (name === 'WEBGL_lose_context') {
            return { loseContext: vi.fn() };
          }
          return null;
        },
        getParameter: (parameter: number) => {
          if (parameter === debugRendererInfo.UNMASKED_VENDOR_WEBGL) {
            return 'NVIDIA Corporation';
          }
          if (parameter === debugRendererInfo.UNMASKED_RENDERER_WEBGL) {
            return hardwareRenderer;
          }
          return null;
        },
      };
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: getContextMock,
    });

    const appearance = resolveOverlayAppearance({
      customThemes: [
        normalizeThemeDefinition({
          id: 'crt-shell',
          name: 'CRT Shell',
          workbench: {
            terminalRenderer: 'webgl',
            terminalFx: {
              preset: 'crt',
              tintColor: '#7df9ff',
            },
          },
        }),
      ],
      activeThemeId: 'crt-shell',
    });

    render(<TerminalOverlay isOpen onClose={() => {}} embedded appearance={appearance} />);

    await waitFor(() => {
      expect(mockWebglAddonInstances).toHaveLength(1);
    });

    expect(getContextMock).toHaveBeenCalledWith('webgl2', expect.objectContaining({
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
    }));
    expect(mockXtermInstances[0]?.loadAddon).toHaveBeenCalledWith(mockWebglAddonInstances[0]);
    expect(mockXtermInstances[0]?.bootOptions.allowTransparency).toBe(false);
    expect(screen.getByTestId('terminal-pane-viewport-overlay-0')).toHaveAttribute('data-terminal-renderer-mode', 'webgl');
    expect(screen.queryByTestId('terminal-pane-fx-overlay-0')).not.toBeInTheDocument();
  }, 20000);

  it('lets the embedded terminal tuck the sidebar away and persist that choice', async () => {
    render(<TerminalOverlay isOpen onClose={() => {}} embedded />);

    expect(await screen.findByText('No directories yet — click + to add')).toBeInTheDocument();
    expect(useSettingsStore.getState().settings.terminal.showSidebar).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Hide Sidebar' }));

    await waitFor(() => {
      expect(screen.queryByText('No directories yet — click + to add')).not.toBeInTheDocument();
      expect(useSettingsStore.getState().settings.terminal.showSidebar).toBe(false);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Show Sidebar' }));

    await waitFor(() => {
      expect(screen.getByText('No directories yet — click + to add')).toBeInTheDocument();
      expect(useSettingsStore.getState().settings.terminal.showSidebar).toBe(true);
    });
  }, 20000);
});
