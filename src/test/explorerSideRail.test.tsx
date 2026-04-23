import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listExplorerLocation } from '../runtime/explorerBackend';
import { invalidateExplorerDirectoryResultCaches } from '../components/explorer/explorerDirectoryCache';

vi.mock('../runtime/explorerBackend', () => {
  return {
    isCloudExplorerPath: (path: string) => path.trim().startsWith('cloud://'),
    listExplorerLocation: vi.fn(),
  };
});

import { ExplorerSideRail } from '../components/explorer/ExplorerSideRail';
import { createDefaultExplorerRailSnapshot, normalizeExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import { useExplorerStore } from '../store/explorerStore';

function createDataTransfer(payloads: Record<string, string>) {
  return {
    getData: (type: string) => payloads[type] ?? '',
    setData: vi.fn(),
    dropEffect: 'copy',
  };
}

function enableAutoExpandToOpenFolder() {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle expand to open folder' }));
}

beforeEach(() => {
  window.localStorage.clear();
  useExplorerStore.getState().resetSession();
  useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
  useExplorerStore.getState().clearPersistenceNotice();
  invalidateExplorerDirectoryResultCaches();
  vi.mocked(listExplorerLocation).mockReset();
});

describe('ExplorerSideRail', () => {
  it('creates bookmark folders from the compact header action', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={220}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    fireEvent.click(screen.getByLabelText(/create bookmark folder/i));
    fireEvent.change(screen.getByLabelText(/new bookmark folder name/i), { target: { value: 'Work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(useExplorerStore.getState().rail.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'folder', name: 'Work' }),
    ]));
  }, 20000);

  it('omits the redundant default rail brand label', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={240}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    expect(screen.queryByText('Explorer')).not.toBeInTheDocument();
  });

  it('applies shared interaction-motion metadata to rail items', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={240}
        currentPath=""
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    const homeButton = screen.getByRole('button', { name: /home/i });
    expect(homeButton).toHaveAttribute('data-interaction-motion-surface', 'explorerRailItem');

    fireEvent.pointerEnter(homeButton);
    expect(homeButton.style.transform).toContain('translate3d');
  });

  it('keeps bookmark row management controls hidden until manage mode is enabled', () => {
    const timestamp = Date.now();
    useExplorerStore.getState().replaceRail({
      ...createDefaultExplorerRailSnapshot(),
      nodes: [
        {
          id: 'bookmark-1',
          kind: 'bookmark',
          parentId: null,
          name: 'Workspace',
          path: 'M:\\Workspace',
          color: '#7c3aed',
          categoryIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          targetKind: 'directory',
        },
      ],
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={240}
        currentPath="M:\\Workspace"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    expect(screen.queryByLabelText(/remove bookmark node/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByLabelText(/remove bookmark node/i)).toBeInTheDocument();
  }, 20000);

  it('exposes a close action in the rail header when the explorer supplies one', () => {
    const onCloseSources = vi.fn();

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={240}
        currentPath="M:\\Workspace"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onCloseSources={onCloseSources}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCloseSources).toHaveBeenCalledTimes(1);
  });

  it('defaults to manual expansion and lets the header toggle turn on auto-follow', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={240}
        currentPath="C:\\Workspace"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    const autoToggle = screen.getByRole('button', { name: 'Toggle expand to open folder' });
    expect(autoToggle).toHaveAttribute('aria-pressed', 'false');
    expect(useExplorerStore.getState().rail.autoExpandToOpenFolder).toBe(false);

    fireEvent.click(autoToggle);

    expect(autoToggle).toHaveAttribute('aria-pressed', 'true');
    expect(useExplorerStore.getState().rail.autoExpandToOpenFolder).toBe(true);
  });

  it('normalizes missing expand-to-open-folder state back to manual mode', () => {
    expect(
      normalizeExplorerRailSnapshot({
        ...createDefaultExplorerRailSnapshot(),
        autoExpandToOpenFolder: undefined,
      }).autoExpandToOpenFolder,
    ).toBe(false);
  });

  it('only shows the verbose drag guide when the rail is wide enough for it', () => {
    const baseProps = {
      accent: '#7c3aed',
      brandLabel: 'Explorer',
      currentPath: 'M:\\Workspace',
      drives: [],
      drivesLoading: false,
      showHiddenFiles: false,
      isCompactDock: false,
      onNavigate: vi.fn(),
      onGoHome: vi.fn(),
      onBookmarkCreated: vi.fn(),
      resolveDroppedSources: () => [],
      chromeLayoutId: 'default' as const,
    };
    const { rerender } = render(
      <ExplorerSideRail
        {...baseProps}
        sidebarWidth={264}
      />,
    );

    expect(screen.getByText('0 pinned')).toBeInTheDocument();
    expect(screen.queryByText(/hold alt to drag files out/i)).not.toBeInTheDocument();

    rerender(
      <ExplorerSideRail
        {...baseProps}
        sidebarWidth={336}
      />,
    );

    expect(screen.getByText(/plain drag stays inside the explorer/i)).toBeInTheDocument();
  }, 20000);

  it('stores collapsed section state when sections are toggled', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={220}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /quick access/i }));

    expect(useExplorerStore.getState().rail.collapsedSectionIds).toContain('quick-access');
  }, 20000);

  it('prompts for dropped folders and creates bookmarks optimistically after confirmation', () => {
    const onBookmarkCreated = vi.fn();
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={240}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={onBookmarkCreated}
        resolveDroppedSources={(paths) => paths.map((path) => ({
          path,
          name: 'OverlayTerm',
          isDirectory: true,
        }))}
      />,
    );

    fireEvent.drop(screen.getByRole('tree', { name: /bookmarks tree/i }), {
      dataTransfer: createDataTransfer({
        'application/x-overlayterm-paths': JSON.stringify(['M:\\OverlayTerm']),
      }),
    });

    expect(screen.getByText(/add 1 item to bookmarks/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pin directly/i }));

    expect(onBookmarkCreated).toHaveBeenCalledWith('OverlayTerm', 'M:\\OverlayTerm');
    expect(useExplorerStore.getState().rail.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'bookmark', path: 'M:\\OverlayTerm' }),
    ]));
  }, 20000);

  it('renders a lazy local folder tree under the active drive path and navigates nested folders', async () => {
    const onNavigate = vi.fn();
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string) => {
      if (path === 'C:\\') {
        return {
          kind: 'local',
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            {
              name: 'Users',
              path: 'C:\\Users',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      if (path === 'C:\\Users') {
        return {
          kind: 'local',
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: [
            {
              name: 'alice',
              path: 'C:\\Users\\alice',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      return {
        kind: 'local',
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      };
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={onNavigate}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    enableAutoExpandToOpenFolder();

    expect(screen.getAllByText('Users').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alice').closest('button') as HTMLButtonElement);

    expect(onNavigate).toHaveBeenCalledWith('C:\\Users\\alice');
  });

  it('collapses unrelated local tree branches when navigation moves to a different branch', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string) => {
      if (path === 'C:\\') {
        return {
          kind: 'local',
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            {
              name: 'Users',
              path: 'C:\\Users',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
            {
              name: 'Projects',
              path: 'C:\\Projects',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      if (path === 'C:\\Users') {
        return {
          kind: 'local',
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: [
            {
              name: 'alice',
              path: 'C:\\Users\\alice',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
            {
              name: 'bob',
              path: 'C:\\Users\\bob',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      if (path === 'C:\\Projects') {
        return {
          kind: 'local',
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Projects', path: 'C:\\Projects' },
          ],
          entries: [
            {
              name: 'zeta',
              path: 'C:\\Projects\\zeta',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      return {
        kind: 'local',
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      };
    });

    const { rerender } = render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    enableAutoExpandToOpenFolder();

    await waitFor(() => {
      const tree = screen.getByRole('tree', { name: 'System folder tree' });
      expect(within(tree).getByText('bob')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Collapse Users' })).toBeInTheDocument();
    });

    rerender(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Projects"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    await waitFor(() => {
      const tree = screen.getByRole('tree', { name: 'System folder tree' });
      expect(within(tree).getByText('zeta')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Collapse Projects' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand Users' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Collapse Users' })).not.toBeInTheDocument();
    expect(screen.queryByText('bob')).not.toBeInTheDocument();
  });

  it('reloads the active local tree branch when the explorer bumps the tree refresh revision', async () => {
    let usersChildren = [
      {
        name: 'alpha',
        path: 'C:\\Users\\alpha',
        is_dir: true,
        size: 0,
        modified: 0,
        extension: '',
        is_hidden: false,
        is_symlink: false,
      },
    ];

    vi.mocked(listExplorerLocation).mockImplementation(async (path: string) => {
      if (path === 'C:\\') {
        return {
          kind: 'local',
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            {
              name: 'Users',
              path: 'C:\\Users',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      if (path === 'C:\\Users') {
        return {
          kind: 'local',
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: usersChildren,
        };
      }
      return {
        kind: 'local',
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      };
    });

    const { rerender } = render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
        localTreeRefreshRevision={0}
      />,
    );

    enableAutoExpandToOpenFolder();

    await waitFor(() => {
      const tree = screen.getByRole('tree', { name: 'System folder tree' });
      expect(within(tree).getByText('alpha')).toBeInTheDocument();
    });

    const listExplorerLocationCallsBeforeRefresh = vi
      .mocked(listExplorerLocation)
      .mock
      .calls
      .filter(([path]) => path === 'C:\\Users').length;

    usersChildren = [
      {
        name: 'beta',
        path: 'C:\\Users\\beta',
        is_dir: true,
        size: 0,
        modified: 0,
        extension: '',
        is_hidden: false,
        is_symlink: false,
      },
    ];

    rerender(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
        localTreeRefreshRevision={1}
      />,
    );

    await waitFor(() => {
      const tree = screen.getByRole('tree', { name: 'System folder tree' });
      expect(within(tree).getByText('beta')).toBeInTheDocument();
    });

    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(
      vi.mocked(listExplorerLocation).mock.calls.filter(([path]) => path === 'C:\\Users').length,
    ).toBeGreaterThan(listExplorerLocationCallsBeforeRefresh);
  });

  it('stores compact rail view mode and hides local tree metadata in compact mode', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string) => {
      if (path === 'C:\\') {
        return {
          kind: 'local',
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            {
              name: 'Users',
              path: 'C:\\Users',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      return {
        kind: 'local',
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      };
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={320}
        currentPath="C:\\"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    enableAutoExpandToOpenFolder();

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('C:\\Users')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Compact side rail view' }));

    expect(useExplorerStore.getState().rail.viewMode).toBe('compact');
    expect(screen.queryByText('C:\\Users')).not.toBeInTheDocument();
  });

  it('switches to tree rail view mode and trims drive capacity chrome', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={320}
        currentPath="C:\\"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    expect(screen.getByText('600 B used')).toBeInTheDocument();
    expect(screen.getByText('1000 B total')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tree side rail view' }));

    expect(useExplorerStore.getState().rail.viewMode).toBe('tree');
    expect(screen.queryByText('600 B used')).not.toBeInTheDocument();
    expect(screen.queryByText('1000 B total')).not.toBeInTheDocument();
  });

  it('keeps navigation manual until the user expands a branch with the chevron', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string) => {
      if (path === 'C:\\') {
        return {
          kind: 'local',
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            {
              name: 'Users',
              path: 'C:\\Users',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }
      return {
        kind: 'local',
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      };
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          {
            kind: 'local',
            id: 'C:',
            path: 'C:\\',
            letter: 'C:\\',
            label: 'System',
            total_bytes: 1000,
            free_bytes: 400,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    expect(screen.queryByRole('tree', { name: 'System folder tree' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand System folder tree' }));

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
    });
  });

  it('marks bookmark folder ancestors differently from the active bookmarked path', () => {
    const timestamp = Date.now();
    const bookmarkPath = '/workspace/greeblefs';
    useExplorerStore.getState().replaceRail({
      ...createDefaultExplorerRailSnapshot(),
      expandedFolderIds: ['folder-1'],
      nodes: [
        {
          id: 'folder-1',
          kind: 'folder',
          parentId: null,
          name: 'Workspace',
          color: '#7c3aed',
          categoryIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'bookmark-1',
          kind: 'bookmark',
          parentId: 'folder-1',
          name: 'GreebleFS',
          path: bookmarkPath,
          color: '#7c3aed',
          categoryIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          targetKind: 'directory',
        },
      ],
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath={bookmarkPath}
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    const bookmarksTree = screen.getByRole('tree', { name: 'Bookmarks tree' });
    const workspaceRow = within(bookmarksTree).getByText('Workspace').closest('[data-rail-row-state]');
    const activeBookmarkRow = within(bookmarksTree).getByText('GreebleFS').closest('[data-rail-row-state]');

    expect(workspaceRow).toHaveAttribute('data-rail-row-state', 'ancestor');
    expect(activeBookmarkRow).toHaveAttribute('data-rail-row-state', 'active');
  });

  it('prefers the most specific Unix drive root so home paths do not auto-expand the system root tree', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string) => {
      if (path === '/home/alice') {
        return {
          kind: 'local',
          path,
          parentPath: '/home',
          breadcrumbs: [
            { label: '/', path: '/' },
            { label: 'home', path: '/home' },
            { label: 'alice', path: '/home/alice' },
          ],
          entries: [
            {
              name: 'Projects',
              path: '/home/alice/Projects',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }

      if (path === '/') {
        return {
          kind: 'local',
          path,
          parentPath: null,
          breadcrumbs: [{ label: '/', path: '/' }],
          entries: [
            {
              name: 'bin',
              path: '/bin',
              is_dir: true,
              size: 0,
              modified: 0,
              extension: '',
              is_hidden: false,
              is_symlink: false,
            },
          ],
        };
      }

      return {
        kind: 'local',
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      };
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="/home/alice/Projects/demo"
        drives={[
          {
            kind: 'local',
            id: 'home',
            path: '/home/alice',
            letter: '/home/alice',
            label: 'Home',
            total_bytes: 0,
            free_bytes: 0,
            drive_type: 'home',
          },
          {
            kind: 'local',
            id: 'root',
            path: '/',
            letter: '/',
            label: 'Root',
            total_bytes: 0,
            free_bytes: 0,
            drive_type: 'fixed',
          },
        ]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    enableAutoExpandToOpenFolder();

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    expect(screen.queryByText('bin')).not.toBeInTheDocument();
    expect(vi.mocked(listExplorerLocation)).toHaveBeenCalledWith('/home/alice', false);
    expect(vi.mocked(listExplorerLocation)).not.toHaveBeenCalledWith('/', false);
  });
});
