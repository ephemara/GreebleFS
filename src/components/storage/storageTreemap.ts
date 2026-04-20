import type { StorageTreeSnapshotNode } from '../../runtime/storageBackend';

export interface StorageTreemapRect {
  node: StorageTreeSnapshotNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutItem {
  node: StorageTreeSnapshotNode;
  weight: number;
}

interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function buildLayoutItems(nodes: StorageTreeSnapshotNode[]): LayoutItem[] {
  return nodes
    .filter((node) => node.allocatedBytes > 0)
    .sort((left, right) => right.allocatedBytes - left.allocatedBytes)
    .map((node) => ({
      node,
      weight: node.allocatedBytes,
    }));
}

function sumWeights(items: LayoutItem[]): number {
  return items.reduce((total, item) => total + item.weight, 0);
}

function worstAspectRatio(row: LayoutItem[], shortSide: number, scale: number): number {
  if (row.length === 0 || shortSide <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const areas = row.map((item) => item.weight * scale);
  const sum = areas.reduce((total, area) => total + area, 0);
  if (sum <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const maxArea = Math.max(...areas);
  const minArea = Math.min(...areas);
  if (minArea <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const shortSideSquared = shortSide * shortSide;
  return Math.max(
    (shortSideSquared * maxArea) / (sum * sum),
    (sum * sum) / (shortSideSquared * minArea),
  );
}

function layoutRow(
  row: LayoutItem[],
  rect: LayoutRect,
  scale: number,
  horizontal: boolean,
): { placed: StorageTreemapRect[]; remainder: LayoutRect } {
  const totalArea = row.reduce((sum, item) => sum + item.weight * scale, 0);

  if (horizontal) {
    const rowHeight = rect.width > 0 ? totalArea / rect.width : 0;
    let cursorX = rect.x;
    const placed = row.map((item) => {
      const area = item.weight * scale;
      const width = rowHeight > 0 ? area / rowHeight : 0;
      const next: StorageTreemapRect = {
        node: item.node,
        x: cursorX,
        y: rect.y,
        width,
        height: rowHeight,
      };
      cursorX += width;
      return next;
    });
    return {
      placed,
      remainder: {
        x: rect.x,
        y: rect.y + rowHeight,
        width: rect.width,
        height: Math.max(0, rect.height - rowHeight),
      },
    };
  }

  const rowWidth = rect.height > 0 ? totalArea / rect.height : 0;
  let cursorY = rect.y;
  const placed = row.map((item) => {
    const area = item.weight * scale;
    const height = rowWidth > 0 ? area / rowWidth : 0;
    const next: StorageTreemapRect = {
      node: item.node,
      x: rect.x,
      y: cursorY,
      width: rowWidth,
      height,
    };
    cursorY += height;
    return next;
  });
  return {
    placed,
    remainder: {
      x: rect.x + rowWidth,
      y: rect.y,
      width: Math.max(0, rect.width - rowWidth),
      height: rect.height,
    },
  };
}

export function layoutStorageTreemap(
  nodes: StorageTreeSnapshotNode[],
  width: number,
  height: number,
): StorageTreemapRect[] {
  if (width <= 0 || height <= 0) {
    return [];
  }

  const items = buildLayoutItems(nodes);
  const totalWeight = sumWeights(items);
  if (totalWeight <= 0) {
    return [];
  }

  const scale = (width * height) / totalWeight;
  const placed: StorageTreemapRect[] = [];
  let remainingItems = [...items];
  let workingRect: LayoutRect = { x: 0, y: 0, width, height };
  let row: LayoutItem[] = [];

  while (remainingItems.length > 0) {
    const next = remainingItems[0]!;
    const shortSide = Math.min(workingRect.width, workingRect.height);
    const nextRow = [...row, next];
    if (
      row.length === 0
      || worstAspectRatio(row, shortSide, scale) >= worstAspectRatio(nextRow, shortSide, scale)
    ) {
      row = nextRow;
      remainingItems.shift();
      continue;
    }

    const horizontal = workingRect.width >= workingRect.height;
    const { placed: nextRects, remainder } = layoutRow(row, workingRect, scale, horizontal);
    placed.push(...nextRects);
    workingRect = remainder;
    row = [];
  }

  if (row.length > 0) {
    const horizontal = workingRect.width >= workingRect.height;
    const { placed: nextRects } = layoutRow(row, workingRect, scale, horizontal);
    placed.push(...nextRects);
  }

  return placed;
}
