import { describe, expect, it } from 'vitest';
import {
  buildStorageMatrixRows,
  createStorageRootSummary,
  isStorageSnapshotReadyForDirectoryLoads,
  normalizeStorageWorkbenchPath,
  summarizeQueueEntries,
} from '../components/storage/storageWorkbench';
import type { StorageScanEntry, StorageScanSnapshot } from '../runtime/storageBackend';

function createEntry(path: string, allocatedBytes: number, kind: StorageScanEntry['kind'] = 'file'): StorageScanEntry {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    kind,
    logicalBytes: allocatedBytes,
    allocatedBytes,
    wasteBytes: 0,
    fileCount: kind === 'directory' ? 4 : 1,
    directoryCount: kind === 'directory' ? 1 : 0,
    depth: 1,
    extension: kind === 'file' ? 'bin' : null,
  };
}

describe('storageWorkbench', () => {
  it('builds dense matrix rows from expanded directories', () => {
    const snapshot: StorageScanSnapshot = {
      scanId: 'scan-a',
      rootPath: 'C:\\',
      rootName: 'C:\\',
      scannedFileCount: 8,
      scannedDirectoryCount: 3,
      totalLogicalBytes: 200,
      totalAllocatedBytes: 200,
      totalWasteBytes: 0,
      errorCount: 0,
      sampleErrors: [],
      completed: true,
      cancelled: false,
      error: null,
      currentPath: null,
      elapsedMs: 12,
      tree: null,
      largestEntries: [],
      typeBuckets: [],
    };

    const rootEntry = createStorageRootSummary(snapshot);
    const rows = buildStorageMatrixRows({
      rootEntry,
      expandedPaths: new Set(['C:\\', 'C:\\Users']),
      sortState: { key: 'allocatedBytes', direction: 'desc' },
      directoryEntriesByPath: {
        'C:\\': [
          createEntry('C:\\Users', 120, 'directory'),
          createEntry('C:\\Windows', 80, 'directory'),
        ],
        'C:\\Users': [
          createEntry('C:\\Users\\alpha.bin', 64),
          createEntry('C:\\Users\\beta.bin', 48),
        ],
      },
    });

    expect(rows.map((row) => row.path)).toEqual([
      'C:\\',
      'C:\\Users',
      'C:\\Users\\alpha.bin',
      'C:\\Users\\beta.bin',
      'C:\\Windows',
    ]);
    expect(rows.find((row) => row.path === 'C:\\Users')?.subtreeShare).toBe(60);
    expect(rows.find((row) => row.path === 'C:\\Windows')?.subtreeShare).toBe(40);
  });

  it('summarizes queue metrics', () => {
    const summary = summarizeQueueEntries([
      {
        path: 'C:\\alpha.bin',
        name: 'alpha.bin',
        kind: 'file',
        logicalBytes: 100,
        allocatedBytes: 128,
        wasteBytes: 28,
        extension: 'bin',
      },
      {
        path: 'C:\\beta.bin',
        name: 'beta.bin',
        kind: 'file',
        logicalBytes: 200,
        allocatedBytes: 256,
        wasteBytes: 56,
        extension: 'bin',
      },
    ]);

    expect(summary.logicalBytes).toBe(300);
    expect(summary.allocatedBytes).toBe(384);
    expect(summary.wasteBytes).toBe(84);
  });

  it('normalizes Windows roots without rewriting POSIX paths', () => {
    expect(normalizeStorageWorkbenchPath('C:')).toBe('C:\\');
    expect(normalizeStorageWorkbenchPath('C:/Users/alice/')).toBe('C:\\Users\\alice');
    expect(normalizeStorageWorkbenchPath('/')).toBe('/');
    expect(normalizeStorageWorkbenchPath('/run/media/alice/Archive/')).toBe('/run/media/alice/Archive');
  });

  it('only loads directory entries for the active completed scan snapshot', () => {
    const completedSnapshot: StorageScanSnapshot = {
      scanId: 'scan-ready',
      rootPath: '/home/alice',
      rootName: 'alice',
      scannedFileCount: 8,
      scannedDirectoryCount: 3,
      totalLogicalBytes: 200,
      totalAllocatedBytes: 200,
      totalWasteBytes: 0,
      errorCount: 0,
      sampleErrors: [],
      completed: true,
      cancelled: false,
      error: null,
      currentPath: null,
      elapsedMs: 12,
      tree: null,
      largestEntries: [],
      typeBuckets: [],
    };

    expect(isStorageSnapshotReadyForDirectoryLoads('scan-ready', completedSnapshot)).toBe(true);
    expect(isStorageSnapshotReadyForDirectoryLoads('scan-next', completedSnapshot)).toBe(false);
    expect(isStorageSnapshotReadyForDirectoryLoads('scan-ready', {
      ...completedSnapshot,
      completed: false,
      currentPath: '/home/alice/projects',
    })).toBe(false);
    expect(isStorageSnapshotReadyForDirectoryLoads(null, completedSnapshot)).toBe(false);
  });
});
