import type {
  StorageScanEntry,
  StorageScanSnapshot,
  StorageTreeSnapshotNode,
  StorageTypeBucketSnapshot,
} from '../../runtime/storageBackend';
import type { StorageQueuedItem, StorageSortState } from '../../store/storageStore';

export interface StorageMatrixRow {
  parentPath: string | null;
  path: string;
  depth: number;
  summary: StorageScanEntry;
  hasChildren: boolean;
  isExpanded: boolean;
  subtreeShare: number;
  rootShare: number;
}

function isWindowsStoragePath(path: string): boolean {
  return /^[A-Za-z]:/.test(path.trim());
}

export function normalizeStorageWorkbenchPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}\\`;
  }
  if (/^\/+$/.test(trimmed)) {
    return '/';
  }
  return isWindowsStoragePath(trimmed)
    ? trimmed.replace(/\//g, '\\').replace(/[\\]+$/, '')
    : trimmed.replace(/[\\/]+$/, '');
}

export function createStorageRootSummary(
  snapshot: StorageScanSnapshot,
): StorageScanEntry {
  return {
    path: snapshot.rootPath,
    name: snapshot.rootName,
    kind: 'directory',
    logicalBytes: snapshot.totalLogicalBytes,
    allocatedBytes: snapshot.totalAllocatedBytes,
    wasteBytes: snapshot.totalWasteBytes,
    fileCount: snapshot.scannedFileCount,
    directoryCount: snapshot.scannedDirectoryCount,
    depth: 0,
    extension: null,
  };
}

export function sortStorageEntries(
  entries: StorageScanEntry[],
  sortState: StorageSortState,
  rootAllocatedBytes: number,
): StorageScanEntry[] {
  const direction = sortState.direction === 'asc' ? 1 : -1;
  return [...entries].sort((left, right) => {
    const delta = compareStorageEntries(left, right, sortState.key, rootAllocatedBytes);
    if (delta !== 0) {
      return delta * direction;
    }
    return left.name.localeCompare(right.name);
  });
}

function compareStorageEntries(
  left: StorageScanEntry,
  right: StorageScanEntry,
  key: StorageSortState['key'],
  rootAllocatedBytes: number,
): number {
  switch (key) {
    case 'name':
      return left.name.localeCompare(right.name);
    case 'logicalBytes':
      return left.logicalBytes - right.logicalBytes;
    case 'wasteBytes':
      return left.wasteBytes - right.wasteBytes;
    case 'subtreeShare':
      return left.allocatedBytes - right.allocatedBytes;
    case 'rootShare':
      return resolveRootShare(left.allocatedBytes, rootAllocatedBytes)
        - resolveRootShare(right.allocatedBytes, rootAllocatedBytes);
    case 'fileCount':
      return left.fileCount - right.fileCount;
    case 'directoryCount':
      return left.directoryCount - right.directoryCount;
    case 'allocatedBytes':
    default:
      return left.allocatedBytes - right.allocatedBytes;
  }
}

export function buildStorageMatrixRows(args: {
  directoryEntriesByPath: Record<string, StorageScanEntry[]>;
  expandedPaths: Set<string>;
  rootEntry: StorageScanEntry;
  sortState: StorageSortState;
}): StorageMatrixRow[] {
  const rows: StorageMatrixRow[] = [];
  const rootAllocatedBytes = Math.max(0, args.rootEntry.allocatedBytes);

  const visit = (
    entry: StorageScanEntry,
    depth: number,
    parentPath: string | null,
    parentAllocatedBytes: number | null,
  ) => {
    const childEntries = args.directoryEntriesByPath[entry.path] ?? [];
    const hasChildren = entry.kind === 'directory';
    const isExpanded = hasChildren && args.expandedPaths.has(entry.path);
    rows.push({
      parentPath,
      path: entry.path,
      depth,
      summary: entry,
      hasChildren,
      isExpanded,
      subtreeShare: resolveSubtreeShare(entry.allocatedBytes, parentAllocatedBytes),
      rootShare: resolveRootShare(entry.allocatedBytes, rootAllocatedBytes),
    });

    if (!hasChildren || !isExpanded) {
      return;
    }

    const sortedChildren = sortStorageEntries(childEntries, args.sortState, rootAllocatedBytes);
    for (const child of sortedChildren) {
      visit(child, depth + 1, entry.path, entry.allocatedBytes);
    }
  };

  visit(args.rootEntry, 0, null, null);
  return rows;
}

export function resolveSubtreeShare(
  allocatedBytes: number,
  parentAllocatedBytes: number | null,
): number {
  if (parentAllocatedBytes == null || parentAllocatedBytes <= 0) {
    return 100;
  }
  if (!Number.isFinite(allocatedBytes) || allocatedBytes <= 0) {
    return 0;
  }
  return (allocatedBytes / parentAllocatedBytes) * 100;
}

export function resolveRootShare(
  allocatedBytes: number,
  rootAllocatedBytes: number,
): number {
  if (!Number.isFinite(allocatedBytes) || !Number.isFinite(rootAllocatedBytes) || rootAllocatedBytes <= 0) {
    return 0;
  }
  return (allocatedBytes / rootAllocatedBytes) * 100;
}

export function summarizeQueueEntries(entries: StorageQueuedItem[]): {
  allocatedBytes: number;
  logicalBytes: number;
  wasteBytes: number;
} {
  return entries.reduce((result, entry) => {
    result.allocatedBytes += Math.max(0, entry.allocatedBytes);
    result.logicalBytes += Math.max(0, entry.logicalBytes);
    result.wasteBytes += Math.max(0, entry.wasteBytes);
    return result;
  }, {
    allocatedBytes: 0,
    logicalBytes: 0,
    wasteBytes: 0,
  });
}

export function resolveTreemapFocusNode(
  rootNode: StorageTreeSnapshotNode | null,
  selectedPath: string | null,
): StorageTreeSnapshotNode | null {
  if (!rootNode) {
    return null;
  }
  if (!selectedPath) {
    return rootNode;
  }

  const nodesByPath = collectTreeNodesByPath(rootNode);
  let currentPath: string | null = selectedPath;
  while (currentPath) {
    const matched = nodesByPath.get(currentPath);
    if (matched) {
      return matched;
    }
    currentPath = getParentPath(currentPath);
  }
  return rootNode;
}

export function collectTreeNodesByPath(
  rootNode: StorageTreeSnapshotNode | null,
): Map<string, StorageTreeSnapshotNode> {
  const nodesByPath = new Map<string, StorageTreeSnapshotNode>();
  if (!rootNode) {
    return nodesByPath;
  }

  const visit = (node: StorageTreeSnapshotNode) => {
    nodesByPath.set(node.path, node);
    for (const child of node.children) {
      visit(child);
    }
  };

  visit(rootNode);
  return nodesByPath;
}

export function sortStorageTypeBuckets(
  buckets: StorageTypeBucketSnapshot[],
): StorageTypeBucketSnapshot[] {
  return [...buckets].sort((left, right) => {
    return right.allocatedBytes - left.allocatedBytes || left.label.localeCompare(right.label);
  });
}

export function getParentPath(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, '');
  if (!trimmed) {
    return null;
  }
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  const parent = trimmed.replace(/[/\\][^/\\]+$/, '');
  if (parent === trimmed) {
    return null;
  }
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}\\`;
  }
  return parent || '/';
}
