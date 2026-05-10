import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listExplorerLocation, type ExplorerDriveInfo } from '../runtime/explorerBackend';
import { invalidateExplorerDirectoryResultCaches } from '../components/explorer/explorerDirectoryCache';
import { getExplorerRailWidthBounds } from '../config/explorerRail';

vi.mock('../runtime/explorerBackend', () => {
  return {
    getExplorerHomeDir: vi.fn(async () => 'C:\\Users\\Alex'),
    isCloudExplorerPath: (path: string) => path.trim().startsWith('cloud://'),
    listExplorerLocation: vi.fn(),
  };
});

import { ExplorerSideRail as ExplorerSideRailComponent } from '../components/explorer/ExplorerSideRail';
import {
  createDefaultExplorerRailSnapshot,
  normalizeExplorerRailSnapshot,
  setExplorerRailAutoExpandToOpenFolder,
  setExplorerRailViewMode,
} from '../components/explorer/explorerRailState';
import { useExplorerStore } from '../store/explorerStore';
import {
  createTestExplorerFileEntry,
  createTestExplorerLocationListing,
} from './helpers/explorerEntries';

function createDataTransfer(payloads: Record<string, string>) {
  return {
    getData: (type: string) => payloads[type] ?? '',
    setData: vi.fn(),
    dropEffect: 'copy',
  };
}

function enableAutoExpandToOpenFolder() {
  act(() => {
    useExplorerStore.getState().updateRail((snapshot) =>
      setExplorerRailAutoExpandToOpenFolder(snapshot, true),
    );
  });
}

function setRailViewModeForTest(viewMode: 'default' | 'compact' | 'tree') {
  act(() => {
    useExplorerStore.getState().updateRail((snapshot) =>
      setExplorerRailViewMode(snapshot, viewMode),
    );
  });
}

function selectRailContextCommand(
  request: unknown,
  label: string,
) {
  const nodes = (request as { nodes?: Array<{ kind: string; label?: string; onSelect?: () => void }> }).nodes ?? [];
  const command = nodes.find((node) => node.kind === 'command' && node.label === label);
  expect(command).toBeTruthy();
  act(() => {
    command?.onSelect?.();
  });
}

function createFolderEntry(name: string, path: string) {
  return createTestExplorerFileEntry({
    name,
    path,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: '',
    is_hidden: false,
    is_symlink: false,
  });
}

type ExplorerSideRailTestProps = Omit<
  Parameters<typeof ExplorerSideRailComponent>[0],
  'drives'
> & {
  drives?: unknown[];
};

function ExplorerSideRail({ drives = [], ...props }: ExplorerSideRailTestProps) {
  return (
    <ExplorerSideRailComponent
      {...props}
      drives={drives as ExplorerDriveInfo[]}
    />
  );
}

function createLocalDrive(input: {
  id: string;
  path: string;
  label: string;
  totalBytes?: number;
  freeBytes?: number;
  classification?: 'system' | 'home' | 'external' | 'network' | 'optical' | 'virtual' | 'unknown';
  isRemovable?: boolean;
}): ExplorerDriveInfo {
  return {
    kind: 'local',
    id: input.id,
    path: input.path,
    label: input.label,
    totalBytes: input.totalBytes ?? 1000,
    freeBytes: input.freeBytes ?? 400,
    classification: input.classification ?? (input.isRemovable ? 'external' : 'system'),
    volumeId: input.id,
    fileSystemType: 'NTFS',
    isRemovable: input.isRemovable ?? false,
    isNetwork: false,
    isReadOnly: false,
    supportsScan: true,
    capabilities: {
      supportsGeneratedThumbnails: true,
      supportsNativeDragOut: true,
      supportsNativeIntegration: true,
      supportsScan: true,
      supportsSearch: true,
      supportsSemanticIndexing: true,
    },
  };
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
  it('keeps wider manual resize headroom for explorer rail surfaces', () => {
    expect(getExplorerRailWidthBounds(false)).toMatchObject({
      defaultWidth: 220,
      minWidth: 168,
      maxWidth: 520,
    });
    expect(getExplorerRailWidthBounds(true)).toMatchObject({
      defaultWidth: 172,
      minWidth: 144,
      maxWidth: 320,
    });
  });

  it('creates bookmark folders from the rail context menu manage action', () => {
    const onContextMenuRequest = vi.fn();
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
        onContextMenuRequest={onContextMenuRequest}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Quick access tree' }));
    selectRailContextCommand(onContextMenuRequest.mock.calls[0][0], 'Manage Bookmarks');
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

  it('renders manifest-backed quick access roots including Libraries', async () => {
    const onNavigate = vi.fn();
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users\\Alex\\Documents"
        drives={[]}
        drivesLoading={false}
        showHiddenFiles={false}
        isCompactDock={false}
        onNavigate={onNavigate}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expand Libraries' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Collapse Libraries' }).style.borderStyle).toBe('none');
    expect(screen.getByRole('treeitem', { name: /Libraries/ }).style.borderStyle).toBe('none');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Desktop' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
    expect(onNavigate).toHaveBeenCalledWith('C:\\Users\\Alex\\Desktop');
  });

  it('keeps bookmark row management controls hidden until manage mode is enabled', () => {
    const onContextMenuRequest = vi.fn();
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
        onContextMenuRequest={onContextMenuRequest}
      />,
    );

    expect(screen.queryByLabelText(/remove bookmark node/i)).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Quick access tree' }));
    selectRailContextCommand(onContextMenuRequest.mock.calls[0][0], 'Manage Bookmarks');
    expect(screen.getByLabelText(/remove bookmark node/i)).toBeInTheDocument();
  }, 20000);

  it('exposes a close action in the rail context menu when the explorer supplies one', () => {
    const onCloseSources = vi.fn();
    const onContextMenuRequest = vi.fn();

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
        onContextMenuRequest={onContextMenuRequest}
      />,
    );

    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Quick access tree' }));
    expect(onContextMenuRequest.mock.calls[0][0].presentation).toMatchObject({
      density: 'compact',
      showDescriptions: false,
    });
    selectRailContextCommand(onContextMenuRequest.mock.calls[0][0], 'Close Sources');
    expect(onCloseSources).toHaveBeenCalledTimes(1);
  });

  it('defaults to manual expansion and lets the rail context menu turn on auto-follow', () => {
    const onContextMenuRequest = vi.fn();
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
        onContextMenuRequest={onContextMenuRequest}
      />,
    );

    expect(useExplorerStore.getState().rail.autoExpandToOpenFolder).toBe(false);

    fireEvent.contextMenu(screen.getByRole('tree', { name: 'Quick access tree' }));
    selectRailContextCommand(onContextMenuRequest.mock.calls[0][0], 'Enable Auto Expand');

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

  it('keeps rail-local header metadata out of the visible side rail', () => {
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

    expect(screen.queryByText('0 pinned')).not.toBeInTheDocument();
    expect(screen.queryByText(/hold alt to drag files out/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Side rail view mode' })).not.toBeInTheDocument();

    rerender(
      <ExplorerSideRail
        {...baseProps}
        sidebarWidth={336}
      />,
    );

    expect(screen.queryByText(/plain drag stays inside the explorer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
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
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [createFolderEntry('Users', 'C:\\Users')],
        });
      }
      if (path === 'C:\\Users') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: [createFolderEntry('alice', 'C:\\Users\\alice')],
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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

    await waitFor(() => {
      expect(screen.getAllByText('Users').length).toBeGreaterThan(0);
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alice').closest('button') as HTMLButtonElement);

    expect(onNavigate).toHaveBeenCalledWith('C:\\Users\\alice');
  });

  it('collapses unrelated local tree branches when navigation moves to a different branch', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            createFolderEntry('Users', 'C:\\Users'),
            createFolderEntry('Projects', 'C:\\Projects'),
          ],
        });
      }
      if (path === 'C:\\Users') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: [
            createFolderEntry('alice', 'C:\\Users\\alice'),
            createFolderEntry('bob', 'C:\\Users\\bob'),
          ],
        });
      }
      if (path === 'C:\\Projects') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Projects', path: 'C:\\Projects' },
          ],
          entries: [createFolderEntry('zeta', 'C:\\Projects\\zeta')],
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    const { rerender } = render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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

  it('keeps manually expanded tree branches stable while auto-follow tracks the active path', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [
            createFolderEntry('Users', 'C:\\Users'),
            createFolderEntry('Projects', 'C:\\Projects'),
          ],
        });
      }
      if (path === 'C:\\Users') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: [createFolderEntry('alice', 'C:\\Users\\alice')],
        });
      }
      if (path === 'C:\\Projects') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Projects', path: 'C:\\Projects' },
          ],
          entries: [createFolderEntry('zeta', 'C:\\Projects\\zeta')],
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    const baseProps = {
      accent: '#7c3aed',
      brandLabel: 'Explorer',
      chromeLayoutId: 'default' as const,
      sidebarWidth: 260,
      drives: [
        createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
      ],
      drivesLoading: false,
      showHiddenFiles: false,
      isCompactDock: false,
      onNavigate: vi.fn(),
      onGoHome: vi.fn(),
      onBookmarkCreated: vi.fn(),
      resolveDroppedSources: () => [],
    };

    const { rerender } = render(
      <ExplorerSideRail
        {...baseProps}
        currentPath="C:\\Projects"
      />,
    );

    enableAutoExpandToOpenFolder();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand Users' })).toBeInTheDocument();
      expect(screen.getByText('zeta')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Expand Users' }));

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    rerender(
      <ExplorerSideRail
        {...baseProps}
        currentPath="C:\\Projects\\zeta"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getAllByText('zeta').length).toBeGreaterThan(0);
    });
  });

  it('lets manual collapse override auto-follow expanded branches', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [createFolderEntry('Users', 'C:\\Users')],
        });
      }
      if (path === 'C:\\Users') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: [createFolderEntry('alice', 'C:\\Users\\alice')],
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users\\alice"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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
      expect(screen.getByRole('button', { name: 'Collapse Users' })).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Users' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand Users' })).toBeInTheDocument();
    });
    expect(screen.queryByText('alice')).not.toBeInTheDocument();
  });

  it('reloads the active local tree branch when the explorer bumps the tree refresh revision', async () => {
    let usersChildren = [
      createFolderEntry('alpha', 'C:\\Users\\alpha'),
    ];

    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [createFolderEntry('Users', 'C:\\Users')],
        });
      }
      if (path === 'C:\\Users') {
        return createTestExplorerLocationListing({
          path,
          parentPath: 'C:\\',
          breadcrumbs: [
            { label: 'C:\\', path: 'C:\\' },
            { label: 'Users', path: 'C:\\Users' },
          ],
          entries: usersChildren,
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    const { rerender } = render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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

    usersChildren = [createFolderEntry('beta', 'C:\\Users\\beta')];

    rerender(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [createFolderEntry('Users', 'C:\\Users')],
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={320}
        currentPath="C:\\"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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

    setRailViewModeForTest('compact');

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
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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

    setRailViewModeForTest('tree');

    expect(useExplorerStore.getState().rail.viewMode).toBe('tree');
    expect(screen.queryByText('600 B used')).not.toBeInTheDocument();
    expect(screen.queryByText('1000 B total')).not.toBeInTheDocument();
  });

  it('sorts local drives by drive letter in the rail', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={320}
        currentPath="C:\\"
        drives={[
          createLocalDrive({ id: 'F:', path: 'F:', label: 'Dev Drive' }),
          createLocalDrive({ id: 'D:', path: 'D:', label: 'Dev2' }),
          createLocalDrive({ id: 'C:', path: 'C:', label: 'windows' }),
          createLocalDrive({
            id: 'E:',
            path: 'E:',
            label: 'E:',
            classification: 'external',
            isRemovable: true,
          }),
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

    const drivesSection = document.querySelector('[data-rail-section-id="drives"]');
    expect(drivesSection?.textContent).toMatch(/windows[\s\S]*Dev2[\s\S]*E:[\s\S]*Dev Drive/);
  });

  it('keeps navigation manual until the user expands a branch with the chevron', async () => {
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === 'C:\\') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: 'C:\\', path: 'C:\\' }],
          entries: [createFolderEntry('Users', 'C:\\Users')],
        });
      }
      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="C:\\Users"
        drives={[
          createLocalDrive({ id: 'C:', path: 'C:\\', label: 'System' }),
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
    vi.mocked(listExplorerLocation).mockImplementation(async (path: string, _showHidden: boolean) => {
      if (path === '/home/alice') {
        return createTestExplorerLocationListing({
          path,
          parentPath: '/home',
          breadcrumbs: [
            { label: '/', path: '/' },
            { label: 'home', path: '/home' },
            { label: 'alice', path: '/home/alice' },
          ],
          entries: [createFolderEntry('Projects', '/home/alice/Projects')],
        });
      }

      if (path === '/') {
        return createTestExplorerLocationListing({
          path,
          parentPath: null,
          breadcrumbs: [{ label: '/', path: '/' }],
          entries: [createFolderEntry('bin', '/bin')],
        });
      }

      return createTestExplorerLocationListing({
        path,
        parentPath: null,
        breadcrumbs: [],
        entries: [],
      });
    });

    render(
      <ExplorerSideRail
        accent="#7c3aed"
        brandLabel="Explorer"
        chromeLayoutId="default"
        sidebarWidth={260}
        currentPath="/home/alice/Projects/demo"
        drives={[
          createLocalDrive({
            id: 'home',
            path: '/home/alice',
            label: 'Home',
            totalBytes: 0,
            freeBytes: 0,
            classification: 'home',
          }),
          createLocalDrive({
            id: 'root',
            path: '/',
            label: 'Root',
            totalBytes: 0,
            freeBytes: 0,
            classification: 'system',
          }),
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
