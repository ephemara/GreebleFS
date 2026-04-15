import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listExplorerLocation } from '../runtime/explorerBackend';

vi.mock('../runtime/explorerBackend', () => {
  return {
    isCloudExplorerPath: (path: string) => path.trim().startsWith('cloud://'),
    listExplorerLocation: vi.fn(),
  };
});

import { ExplorerSideRail } from '../components/explorer/ExplorerSideRail';
import { createDefaultExplorerRailSnapshot } from '../components/explorer/explorerRailState';
import { useExplorerStore } from '../store/explorerStore';

function createDataTransfer(payloads: Record<string, string>) {
  return {
    getData: (type: string) => payloads[type] ?? '',
    setData: vi.fn(),
    dropEffect: 'copy',
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useExplorerStore.getState().resetSession();
  useExplorerStore.getState().replaceRail(createDefaultExplorerRailSnapshot());
  useExplorerStore.getState().clearPersistenceNotice();
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
    expect(screen.queryByText(/plain drag exports files/i)).not.toBeInTheDocument();

    rerender(
      <ExplorerSideRail
        {...baseProps}
        sidebarWidth={336}
      />,
    );

    expect(screen.getByText(/plain drag exports files/i)).toBeInTheDocument();
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

  it('renders a lazy local folder tree under expanded drives and navigates nested folders', async () => {
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
        onNavigate={onNavigate}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText(/expand users/i));

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alice').closest('button') as HTMLButtonElement);

    expect(onNavigate).toHaveBeenCalledWith('C:\\Users\\alice');
  });
});
