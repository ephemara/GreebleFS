import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StoragePanel } from '../components/StoragePanel';
import { useStorageWorkbenchStore } from '../store/storageStore';

vi.mock('../components/ExplorerFolderPreview', () => ({
  ExplorerFolderPreview: ({ folderPath }: { folderPath: string }) => (
    <div data-testid="mock-storage-folder-preview">{folderPath}</div>
  ),
}));

vi.mock('../components/explorer/ExplorerTaskStatusBadge', () => ({
  ExplorerTaskStatusBadge: () => <div data-testid="mock-storage-task-badge">tasks</div>,
}));

vi.mock('../store/explorerTaskStore', () => ({
  useExplorerTaskProgressFeed: () => undefined,
}));

const storageBackendMocks = vi.hoisted(() => ({
  getStorageRoots: vi.fn(),
  isStorageProcessElevated: vi.fn(),
  startStorageScan: vi.fn(),
  pollStorageScan: vi.fn(),
  listStorageDirectory: vi.fn(),
  openStorageEntry: vi.fn(),
  revealStorageEntry: vi.fn(),
  trashStorageEntry: vi.fn(),
  trashStorageEntries: vi.fn(),
  deleteStorageEntry: vi.fn(),
  deleteStorageEntries: vi.fn(),
}));

vi.mock('../runtime/storageBackend', () => ({
  getStorageRoots: storageBackendMocks.getStorageRoots,
  isStorageProcessElevated: storageBackendMocks.isStorageProcessElevated,
  startStorageScan: storageBackendMocks.startStorageScan,
  pollStorageScan: storageBackendMocks.pollStorageScan,
  listStorageDirectory: storageBackendMocks.listStorageDirectory,
  openStorageEntry: storageBackendMocks.openStorageEntry,
  revealStorageEntry: storageBackendMocks.revealStorageEntry,
  trashStorageEntry: storageBackendMocks.trashStorageEntry,
  trashStorageEntries: storageBackendMocks.trashStorageEntries,
  deleteStorageEntry: storageBackendMocks.deleteStorageEntry,
  deleteStorageEntries: storageBackendMocks.deleteStorageEntries,
}));

describe('StoragePanel layout shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useStorageWorkbenchStore.setState({
      activeMode: 'matrix',
      selectedRootPath: null,
      selectedTypeBucketId: null,
      selectedPaths: [],
      selectionAnchorPath: null,
      expandedPaths: [],
      sortState: {
        key: 'allocatedBytes',
        direction: 'desc',
      },
      previewSplitMode: 'pane',
      focusPath: null,
      queue: {
        definitionId: 'cleanup',
        itemOrder: [],
        itemsByPath: {},
        filterQuery: '',
      },
    });

    storageBackendMocks.getStorageRoots.mockResolvedValue([
      {
        id: 'home',
        kind: 'local',
        label: 'Home',
        path: '/home/alice',
        drive_type: 'home',
        total_bytes: 1_000,
        free_bytes: 250,
      },
    ]);
    storageBackendMocks.isStorageProcessElevated.mockResolvedValue(false);
    storageBackendMocks.startStorageScan.mockResolvedValue({ scanId: 'scan-1' });
    storageBackendMocks.pollStorageScan.mockResolvedValue({
      scanId: 'scan-1',
      rootPath: '/home/alice',
      rootName: 'alice',
      scannedFileCount: 42,
      scannedDirectoryCount: 8,
      totalLogicalBytes: 900,
      totalAllocatedBytes: 1_000,
      totalWasteBytes: 100,
      errorCount: 0,
      sampleErrors: [],
      completed: true,
      cancelled: false,
      error: null,
      currentPath: null,
      elapsedMs: 120,
      tree: {
        path: '/home/alice',
        name: 'alice',
        kind: 'directory',
        logicalBytes: 900,
        allocatedBytes: 1_000,
        wasteBytes: 100,
        fileCount: 42,
        directoryCount: 8,
        extension: null,
        children: [
          {
            path: '/home/alice/Dev',
            name: 'Dev',
            kind: 'directory',
            logicalBytes: 600,
            allocatedBytes: 700,
            wasteBytes: 100,
            fileCount: 20,
            directoryCount: 5,
            extension: null,
            children: [],
          },
        ],
      },
      largestEntries: [],
      typeBuckets: [],
    });
    storageBackendMocks.listStorageDirectory.mockImplementation(async (_scanId: string, path: string) => {
      if (path === '/home/alice') {
        return [
          {
            path: '/home/alice/Dev',
            name: 'Dev',
            kind: 'directory',
            logicalBytes: 600,
            allocatedBytes: 700,
            wasteBytes: 100,
            fileCount: 20,
            directoryCount: 5,
            depth: 1,
            extension: null,
          },
          {
            path: '/home/alice/archive.bin',
            name: 'archive.bin',
            kind: 'file',
            logicalBytes: 200,
            allocatedBytes: 200,
            wasteBytes: 0,
            fileCount: 1,
            directoryCount: 0,
            depth: 1,
            extension: 'bin',
          },
        ];
      }

      if (path === '/home/alice/Dev') {
        return [
          {
            path: '/home/alice/Dev/project.bin',
            name: 'project.bin',
            kind: 'file',
            logicalBytes: 128,
            allocatedBytes: 160,
            wasteBytes: 32,
            fileCount: 1,
            directoryCount: 0,
            depth: 1,
            extension: 'bin',
          },
        ];
      }

      return [];
    });
    storageBackendMocks.openStorageEntry.mockResolvedValue(undefined);
    storageBackendMocks.revealStorageEntry.mockResolvedValue(undefined);
    storageBackendMocks.trashStorageEntry.mockResolvedValue(undefined);
    storageBackendMocks.trashStorageEntries.mockResolvedValue(undefined);
    storageBackendMocks.deleteStorageEntry.mockResolvedValue(undefined);
    storageBackendMocks.deleteStorageEntries.mockResolvedValue(undefined);
  });

  it('keeps the body constrained so matrix expansion stays inside the storage workbench viewport', async () => {
    render(<StoragePanel />);

    fireEvent.click(await screen.findByRole('button', { name: /home/i }));

    await screen.findByText('Matrix');
    fireEvent.click(await screen.findByText('Dev'));

    await waitFor(() => {
      expect(storageBackendMocks.listStorageDirectory).toHaveBeenCalledWith('scan-1', '/home/alice/Dev');
    });

    expect(screen.getByText('Workbench')).toBeInTheDocument();
    expect(screen.getByText('Matrix')).toBeInTheDocument();

    expect(screen.getByTestId('storage-panel-root')).toHaveStyle({
      gridTemplateRows: 'auto minmax(0, 1fr)',
      overflow: 'hidden',
      height: '100%',
    });
    expect(screen.getByTestId('storage-panel-body')).toHaveStyle({
      overflow: 'hidden',
    });
    expect(screen.getByTestId('storage-main-workspace')).toHaveStyle({
      gridTemplateRows: 'auto minmax(0, 1fr)',
      overflow: 'hidden',
    });
    expect(screen.getByTestId('storage-mode-viewport')).toHaveStyle({
      display: 'flex',
      overflow: 'hidden',
    });
    expect(screen.getByTestId('storage-inspector-layout')).toHaveStyle({
      gridTemplateRows: 'auto minmax(0, 1fr)',
      overflow: 'hidden',
      height: '100%',
    });
  });
});
