import { create } from 'zustand';
import type { StorageTreeSnapshotNodeKind } from '../runtime/storageBackend';

export const STORAGE_WORKBENCH_STATE_STORAGE_KEY = 'greeblefs-storage-workbench-v1';

export type StorageWorkbenchMode = 'matrix' | 'split-map' | 'types' | 'focus';
export type StoragePreviewSplitMode = 'inline' | 'pane';
export type StorageSortKey =
  | 'name'
  | 'subtreeShare'
  | 'allocatedBytes'
  | 'logicalBytes'
  | 'wasteBytes'
  | 'rootShare'
  | 'fileCount'
  | 'directoryCount';
export type StorageSortDirection = 'asc' | 'desc';

export interface StorageSortState {
  key: StorageSortKey;
  direction: StorageSortDirection;
}

export interface StorageQueuedItem {
  path: string;
  name: string;
  kind: StorageTreeSnapshotNodeKind;
  logicalBytes: number;
  allocatedBytes: number;
  wasteBytes: number;
  extension: string | null;
}

export interface StorageBatchQueueSnapshot {
  definitionId: string;
  itemOrder: string[];
  itemsByPath: Record<string, StorageQueuedItem>;
  filterQuery: string;
}

export interface StorageWorkbenchSnapshot {
  activeMode: StorageWorkbenchMode;
  selectedRootPath: string | null;
  selectedTypeBucketId: string | null;
  selectedPaths: string[];
  selectionAnchorPath: string | null;
  expandedPaths: string[];
  sortState: StorageSortState;
  previewSplitMode: StoragePreviewSplitMode;
  focusPath: string | null;
  queue: StorageBatchQueueSnapshot;
}

interface StorageWorkbenchStore extends StorageWorkbenchSnapshot {
  addQueueItems: (items: StorageQueuedItem[]) => void;
  clearQueue: () => void;
  removeQueuePaths: (paths: string[]) => void;
  setActiveMode: (mode: StorageWorkbenchMode) => void;
  setExpandedPaths: (paths: string[]) => void;
  setFocusPath: (path: string | null) => void;
  setPreviewSplitMode: (mode: StoragePreviewSplitMode) => void;
  setQueueFilterQuery: (query: string) => void;
  setSelectedPaths: (paths: string[], anchorPath?: string | null) => void;
  setSelectedRootPath: (path: string | null) => void;
  setSelectedTypeBucketId: (bucketId: string | null) => void;
  setSortState: (sortState: StorageSortState) => void;
  toggleExpandedPath: (path: string) => void;
}

const defaultStorageWorkbenchSnapshot: StorageWorkbenchSnapshot = {
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
};

function storageLike(candidate: unknown): candidate is Storage {
  return Boolean(candidate)
    && typeof (candidate as Storage).getItem === 'function'
    && typeof (candidate as Storage).setItem === 'function';
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return storageLike(window.localStorage) ? window.localStorage : null;
  } catch {
    return null;
  }
}

function cloneStorageSnapshot(snapshot: StorageWorkbenchSnapshot): StorageWorkbenchSnapshot {
  return {
    ...snapshot,
    selectedPaths: [...snapshot.selectedPaths],
    expandedPaths: [...snapshot.expandedPaths],
    queue: {
      ...snapshot.queue,
      itemOrder: [...snapshot.queue.itemOrder],
      itemsByPath: { ...snapshot.queue.itemsByPath },
    },
  };
}

function normalizeStorageSnapshot(rawValue: unknown): StorageWorkbenchSnapshot {
  if (!rawValue || typeof rawValue !== 'object') {
    return cloneStorageSnapshot(defaultStorageWorkbenchSnapshot);
  }

  const candidate = rawValue as Partial<StorageWorkbenchSnapshot>;
  return {
    activeMode: candidate.activeMode === 'split-map'
      || candidate.activeMode === 'types'
      || candidate.activeMode === 'focus'
      ? candidate.activeMode
      : 'matrix',
    selectedRootPath: typeof candidate.selectedRootPath === 'string' ? candidate.selectedRootPath : null,
    selectedTypeBucketId: typeof candidate.selectedTypeBucketId === 'string'
      ? candidate.selectedTypeBucketId
      : null,
    selectedPaths: Array.isArray(candidate.selectedPaths)
      ? candidate.selectedPaths.filter((path): path is string => typeof path === 'string')
      : [],
    selectionAnchorPath: typeof candidate.selectionAnchorPath === 'string'
      ? candidate.selectionAnchorPath
      : null,
    expandedPaths: Array.isArray(candidate.expandedPaths)
      ? candidate.expandedPaths.filter((path): path is string => typeof path === 'string')
      : [],
    sortState: {
      key: normalizeSortKey(candidate.sortState?.key),
      direction: candidate.sortState?.direction === 'asc' ? 'asc' : 'desc',
    },
    previewSplitMode: candidate.previewSplitMode === 'inline' ? 'inline' : 'pane',
    focusPath: typeof candidate.focusPath === 'string' ? candidate.focusPath : null,
    queue: {
      definitionId: typeof candidate.queue?.definitionId === 'string'
        ? candidate.queue.definitionId
        : 'cleanup',
      itemOrder: Array.isArray(candidate.queue?.itemOrder)
        ? candidate.queue.itemOrder.filter((path): path is string => typeof path === 'string')
        : [],
      itemsByPath: normalizeQueueItems(candidate.queue?.itemsByPath),
      filterQuery: typeof candidate.queue?.filterQuery === 'string'
        ? candidate.queue.filterQuery
        : '',
    },
  };
}

function normalizeSortKey(rawKey: unknown): StorageSortKey {
  switch (rawKey) {
    case 'name':
    case 'subtreeShare':
    case 'logicalBytes':
    case 'wasteBytes':
    case 'rootShare':
    case 'fileCount':
    case 'directoryCount':
      return rawKey;
    case 'allocatedBytes':
    default:
      return 'allocatedBytes';
  }
}

function normalizeQueueItems(
  rawItems: unknown,
): Record<string, StorageQueuedItem> {
  if (!rawItems || typeof rawItems !== 'object') {
    return {};
  }

  const entries = Object.entries(rawItems as Record<string, StorageQueuedItem>);
  return entries.reduce<Record<string, StorageQueuedItem>>((result, [path, item]) => {
    if (!item || typeof item !== 'object' || typeof path !== 'string') {
      return result;
    }

    result[path] = {
      path,
      name: typeof item.name === 'string' ? item.name : path,
      kind: item.kind === 'directory' || item.kind === 'other' ? item.kind : 'file',
      logicalBytes: Number.isFinite(item.logicalBytes) ? item.logicalBytes : 0,
      allocatedBytes: Number.isFinite(item.allocatedBytes) ? item.allocatedBytes : 0,
      wasteBytes: Number.isFinite(item.wasteBytes) ? item.wasteBytes : 0,
      extension: typeof item.extension === 'string' ? item.extension : null,
    };
    return result;
  }, {});
}

function loadStorageSnapshot(): StorageWorkbenchSnapshot {
  const storage = getBrowserStorage();
  if (!storage) {
    return cloneStorageSnapshot(defaultStorageWorkbenchSnapshot);
  }

  try {
    const rawValue = storage.getItem(STORAGE_WORKBENCH_STATE_STORAGE_KEY);
    if (!rawValue) {
      return cloneStorageSnapshot(defaultStorageWorkbenchSnapshot);
    }
    return normalizeStorageSnapshot(JSON.parse(rawValue));
  } catch {
    return cloneStorageSnapshot(defaultStorageWorkbenchSnapshot);
  }
}

function persistStorageSnapshot(snapshot: StorageWorkbenchSnapshot): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_WORKBENCH_STATE_STORAGE_KEY, JSON.stringify(snapshot));
}

function normalizeQueuedItems(items: StorageQueuedItem[]): StorageQueuedItem[] {
  const itemsByPath = new Map<string, StorageQueuedItem>();
  for (const item of items) {
    if (!item.path.trim()) {
      continue;
    }
    itemsByPath.set(item.path, item);
  }

  return [...itemsByPath.values()].sort((left, right) => {
    return right.allocatedBytes - left.allocatedBytes || left.name.localeCompare(right.name);
  });
}

const initialSnapshot = loadStorageSnapshot();

export const useStorageWorkbenchStore = create<StorageWorkbenchStore>((set) => ({
  ...initialSnapshot,
  setActiveMode: (activeMode) => set((state) => {
    const nextState = { ...state, activeMode };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setExpandedPaths: (expandedPaths) => set((state) => {
    const nextState = { ...state, expandedPaths: [...new Set(expandedPaths)] };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  toggleExpandedPath: (path) => set((state) => {
    const expanded = new Set(state.expandedPaths);
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    const nextState = { ...state, expandedPaths: [...expanded] };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setFocusPath: (focusPath) => set((state) => {
    const nextState = { ...state, focusPath };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setPreviewSplitMode: (previewSplitMode) => set((state) => {
    const nextState = { ...state, previewSplitMode };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setSelectedPaths: (selectedPaths, anchorPath = selectedPaths[0] ?? null) => set((state) => {
    const nextState = {
      ...state,
      selectedPaths: [...new Set(selectedPaths)],
      selectionAnchorPath: anchorPath,
    };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setSelectedRootPath: (selectedRootPath) => set((state) => {
    const nextState = { ...state, selectedRootPath };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setSelectedTypeBucketId: (selectedTypeBucketId) => set((state) => {
    const nextState = { ...state, selectedTypeBucketId };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setSortState: (sortState) => set((state) => {
    const nextState = { ...state, sortState };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  setQueueFilterQuery: (filterQuery) => set((state) => {
    const nextState = {
      ...state,
      queue: {
        ...state.queue,
        filterQuery,
      },
    };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  addQueueItems: (items) => set((state) => {
    const mergedItems = normalizeQueuedItems([
      ...state.queue.itemOrder
        .map((path) => state.queue.itemsByPath[path])
        .filter((item): item is StorageQueuedItem => Boolean(item)),
      ...items,
    ]);
    const nextQueue = {
      ...state.queue,
      itemOrder: mergedItems.map((item) => item.path),
      itemsByPath: mergedItems.reduce<Record<string, StorageQueuedItem>>((result, item) => {
        result[item.path] = item;
        return result;
      }, {}),
    };
    const nextState = { ...state, queue: nextQueue };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  removeQueuePaths: (paths) => set((state) => {
    const removedPaths = new Set(paths);
    const nextItemOrder = state.queue.itemOrder.filter((path) => !removedPaths.has(path));
    const nextItemsByPath = nextItemOrder.reduce<Record<string, StorageQueuedItem>>((result, path) => {
      const item = state.queue.itemsByPath[path];
      if (item) {
        result[path] = item;
      }
      return result;
    }, {});
    const nextState = {
      ...state,
      queue: {
        ...state.queue,
        itemOrder: nextItemOrder,
        itemsByPath: nextItemsByPath,
      },
    };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
  clearQueue: () => set((state) => {
    const nextState = {
      ...state,
      queue: {
        ...state.queue,
        itemOrder: [],
        itemsByPath: {},
        filterQuery: '',
      },
    };
    persistStorageSnapshot(nextState);
    return nextState;
  }),
}));
