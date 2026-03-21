import { screenshotFeatureConfig } from '../config/screenshots';

export interface ScreenshotEntryLike {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  extension: string;
}

export interface RectSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderedSize {
  width: number;
  height: number;
}

export interface PixelSize {
  width: number;
  height: number;
}

export type SelectionHandle =
  | 'move'
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'north-east'
  | 'north-west'
  | 'south-east'
  | 'south-west';

export interface Point2D {
  x: number;
  y: number;
}

export function isSupportedScreenshotEntry(entry: ScreenshotEntryLike): boolean {
  return !entry.is_dir
    && screenshotFeatureConfig.supportedExtensions.includes(
      entry.extension.toLowerCase() as (typeof screenshotFeatureConfig.supportedExtensions)[number],
    );
}

export function sortScreenshotEntries<T extends ScreenshotEntryLike>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.modified !== a.modified) {
      return b.modified - a.modified;
    }
    return b.name.localeCompare(a.name);
  });
}

export function normalizeSelection(selection: RectSelection): RectSelection {
  const x = Math.min(selection.x, selection.x + selection.width);
  const y = Math.min(selection.y, selection.y + selection.height);
  const width = Math.abs(selection.width);
  const height = Math.abs(selection.height);
  return { x, y, width, height };
}

export function createFullSelection(rendered: RenderedSize): RectSelection {
  return {
    x: 0,
    y: 0,
    width: rendered.width,
    height: rendered.height,
  };
}

export function createInsetSelection(
  rendered: RenderedSize,
  insetRatio: number = screenshotFeatureConfig.editor.defaultInsetRatio,
): RectSelection {
  const insetX = rendered.width * insetRatio;
  const insetY = rendered.height * insetRatio;
  return clampSelectionToBounds({
    x: insetX,
    y: insetY,
    width: Math.max(rendered.width - insetX * 2, screenshotFeatureConfig.editor.minSelectionSize),
    height: Math.max(rendered.height - insetY * 2, screenshotFeatureConfig.editor.minSelectionSize),
  }, rendered, screenshotFeatureConfig.editor.minSelectionSize);
}

export function clampSelectionToBounds(
  selection: RectSelection,
  rendered: RenderedSize,
  minSize: number = screenshotFeatureConfig.editor.minSelectionSize,
): RectSelection {
  const normalized = normalizeSelection(selection);
  const width = Math.min(Math.max(normalized.width, minSize), rendered.width);
  const height = Math.min(Math.max(normalized.height, minSize), rendered.height);
  const x = clamp(normalized.x, 0, Math.max(rendered.width - width, 0));
  const y = clamp(normalized.y, 0, Math.max(rendered.height - height, 0));
  return { x, y, width, height };
}

export function moveSelection(
  selection: RectSelection,
  deltaX: number,
  deltaY: number,
  rendered: RenderedSize,
): RectSelection {
  const normalized = normalizeSelection(selection);
  return clampSelectionToBounds({
    x: normalized.x + deltaX,
    y: normalized.y + deltaY,
    width: normalized.width,
    height: normalized.height,
  }, rendered);
}

export function resizeSelection(
  selection: RectSelection,
  handle: Exclude<SelectionHandle, 'move'>,
  deltaX: number,
  deltaY: number,
  rendered: RenderedSize,
  minSize: number = screenshotFeatureConfig.editor.minSelectionSize,
): RectSelection {
  const normalized = normalizeSelection(selection);
  let left = normalized.x;
  let top = normalized.y;
  let right = normalized.x + normalized.width;
  let bottom = normalized.y + normalized.height;

  if (handle.includes('west')) {
    left = clamp(left + deltaX, 0, right - minSize);
  }
  if (handle.includes('east')) {
    right = clamp(right + deltaX, left + minSize, rendered.width);
  }
  if (handle.includes('north')) {
    top = clamp(top + deltaY, 0, bottom - minSize);
  }
  if (handle.includes('south')) {
    bottom = clamp(bottom + deltaY, top + minSize, rendered.height);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function isPointInSelection(point: Point2D, selection: RectSelection): boolean {
  const normalized = normalizeSelection(selection);
  return point.x >= normalized.x
    && point.x <= normalized.x + normalized.width
    && point.y >= normalized.y
    && point.y <= normalized.y + normalized.height;
}

export function areSelectionsEqual(left: RectSelection | null, right: RectSelection | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const normalizedLeft = normalizeSelection(left);
  const normalizedRight = normalizeSelection(right);
  return normalizedLeft.x === normalizedRight.x
    && normalizedLeft.y === normalizedRight.y
    && normalizedLeft.width === normalizedRight.width
    && normalizedLeft.height === normalizedRight.height;
}

export function roundSelection(selection: RectSelection): RectSelection {
  const normalized = normalizeSelection(selection);
  return {
    x: Math.round(normalized.x),
    y: Math.round(normalized.y),
    width: Math.round(normalized.width),
    height: Math.round(normalized.height),
  };
}

export function selectionToMonitorRect(
  selection: RectSelection,
  rendered: RenderedSize,
  monitor: MonitorBounds,
): RectSelection {
  const pixelRect = selectionToPixelRect(selection, rendered, monitor);
  return {
    x: monitor.x + pixelRect.x,
    y: monitor.y + pixelRect.y,
    width: pixelRect.width,
    height: pixelRect.height,
  };
}

export function selectionToPixelRect(
  selection: RectSelection,
  rendered: RenderedSize,
  image: PixelSize,
): RectSelection {
  const normalized = normalizeSelection(selection);
  const scaleX = image.width / rendered.width;
  const scaleY = image.height / rendered.height;

  return {
    x: Math.round(normalized.x * scaleX),
    y: Math.round(normalized.y * scaleY),
    width: Math.max(1, Math.round(normalized.width * scaleX)),
    height: Math.max(1, Math.round(normalized.height * scaleY)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
