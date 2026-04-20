import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_WORKBENCH_STATE_STORAGE_KEY,
  useStorageWorkbenchStore,
} from '../store/storageStore';

describe('storageStore', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_WORKBENCH_STATE_STORAGE_KEY);
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
  });

  it('deduplicates queued paths and keeps the biggest entries first', () => {
    const store = useStorageWorkbenchStore.getState();

    store.addQueueItems([
      {
        path: 'C:\\beta.bin',
        name: 'beta.bin',
        kind: 'file',
        logicalBytes: 200,
        allocatedBytes: 256,
        wasteBytes: 56,
        extension: 'bin',
      },
      {
        path: 'C:\\alpha.bin',
        name: 'alpha.bin',
        kind: 'file',
        logicalBytes: 400,
        allocatedBytes: 512,
        wasteBytes: 112,
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

    expect(useStorageWorkbenchStore.getState().queue.itemOrder).toEqual([
      'C:\\alpha.bin',
      'C:\\beta.bin',
    ]);
  });

  it('removes queued paths without disturbing the remaining order', () => {
    const store = useStorageWorkbenchStore.getState();

    store.addQueueItems([
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
    store.removeQueuePaths(['C:\\beta.bin']);

    expect(useStorageWorkbenchStore.getState().queue.itemOrder).toEqual(['C:\\alpha.bin']);
  });
});
