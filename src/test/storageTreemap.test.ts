import { describe, expect, it } from 'vitest';
import { layoutStorageTreemap } from '../components/storage/storageTreemap';
import type { StorageTreeSnapshotNode } from '../runtime/storageBackend';

function createNode(path: string, bytes: number): StorageTreeSnapshotNode {
  return {
    path,
    name: path.split(/[\\/]/).pop() ?? path,
    kind: 'file',
    logicalBytes: bytes,
    allocatedBytes: bytes,
    wasteBytes: 0,
    fileCount: 1,
    directoryCount: 0,
    extension: 'bin',
    children: [],
  };
}

describe('layoutStorageTreemap', () => {
  it('lays out the full area across the provided nodes', () => {
    const rects = layoutStorageTreemap([
      createNode('/alpha', 60),
      createNode('/beta', 30),
      createNode('/gamma', 10),
    ], 1000, 500);

    const totalArea = rects.reduce((sum, rect) => sum + (rect.width * rect.height), 0);
    expect(rects).toHaveLength(3);
    expect(totalArea).toBeCloseTo(500000, 3);
    expect(rects.every((rect) => rect.x >= 0 && rect.y >= 0)).toBe(true);
  });

  it('drops zero-byte nodes before layout', () => {
    const rects = layoutStorageTreemap([
      createNode('/alpha', 120),
      createNode('/empty', 0),
    ], 400, 200);

    expect(rects).toHaveLength(1);
    expect(rects[0]?.node.path).toBe('/alpha');
  });
});
