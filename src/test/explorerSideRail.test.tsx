import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('ExplorerSideRail', () => {
  it('creates bookmark folders from the compact header action', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        sidebarWidth={220}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
        isCompactDock={false}
        onNavigate={vi.fn()}
        onGoHome={vi.fn()}
        onBookmarkCreated={vi.fn()}
        resolveDroppedSources={() => []}
      />,
    );

    fireEvent.click(screen.getByLabelText(/create bookmark folder/i));
    fireEvent.change(screen.getByLabelText(/new bookmark folder name/i), { target: { value: 'Work' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(useExplorerStore.getState().rail.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'folder', name: 'Work' }),
    ]));
  }, 20000);

  it('stores collapsed section state when sections are toggled', () => {
    render(
      <ExplorerSideRail
        accent="#7c3aed"
        sidebarWidth={220}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
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
        sidebarWidth={240}
        currentPath="M:\\OverlayTerm"
        drives={[]}
        drivesLoading={false}
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
});
