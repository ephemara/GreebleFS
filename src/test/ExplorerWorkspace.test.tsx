import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import { defaultExplorerSession, defaultExplorerWorkspace, useExplorerStore } from '../store/explorerStore';

vi.mock('../components/FileExplorer', () => ({
  FileExplorer: () => <div data-testid="file-explorer" />,
}));

import { ExplorerWorkspace } from '../components/explorer/ExplorerWorkspace';

describe('ExplorerWorkspace', () => {
  beforeEach(() => {
    useExplorerStore.setState({
      sessions: {
        primary: defaultExplorerSession,
      },
      session: defaultExplorerSession,
      workspace: defaultExplorerWorkspace,
      rail: defaultExplorerRailSnapshot,
      persistence: {
        status: 'ready',
        message: null,
        hasBackup: false,
      },
    });
  });

  afterEach(() => {
    useExplorerStore.setState({
      sessions: {
        primary: defaultExplorerSession,
      },
      session: defaultExplorerSession,
      workspace: defaultExplorerWorkspace,
      rail: defaultExplorerRailSnapshot,
      persistence: {
        status: 'ready',
        message: null,
        hasBackup: false,
      },
    });
  });

  it('renders without triggering a snapshot instability warning', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(
      <ExplorerWorkspace
        theme={{
          accent: '#8ab4f8',
          bg: '#0f1115',
          bgPanel: '#151923',
          text: '#f4f7fb',
          border: '#2a2f3a',
          textMuted: '#9aa4b2',
        }}
        onOpenInFilesystemAquarium={() => undefined}
        onOpenInTerminal={() => undefined}
        onAddBookmark={() => undefined}
      />,
    );

    expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
    const explorerPane = container.querySelector('[data-testid="file-explorer"]')?.parentElement as HTMLDivElement | null;
    expect(explorerPane).not.toBeNull();
    expect(explorerPane?.style.height).toBe('100%');
    expect(explorerPane?.style.display).toBe('flex');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
