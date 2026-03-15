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
