import { describe, expect, it } from 'vitest';
import {
  clampSelectionToBounds,
  createInsetSelection,
  getSelectionHandleAtPoint,
  moveSelection,
  isSupportedScreenshotEntry,
  normalizeSelection,
  resizeSelection,
  selectionToPixelRect,
  selectionToMonitorRect,
  sortScreenshotEntries,
} from '../components/screenshotsUtils';

describe('screenshotsUtils', () => {
  it('filters to supported screenshot files only', () => {
    expect(isSupportedScreenshotEntry({
      name: 'shot.png',
      path: 'M:\\shot.png',
      is_dir: false,
      modified: 1,
      extension: 'png',
    })).toBe(true);

    expect(isSupportedScreenshotEntry({
      name: 'folder',
      path: 'M:\\folder',
      is_dir: true,
      modified: 1,
      extension: '',
    })).toBe(false);

    expect(isSupportedScreenshotEntry({
      name: 'note.txt',
      path: 'M:\\note.txt',
      is_dir: false,
      modified: 1,
      extension: 'txt',
    })).toBe(false);
  });

  it('sorts newest screenshots first', () => {
    const sorted = sortScreenshotEntries([
      { name: 'a.png', path: 'a', is_dir: false, modified: 10, extension: 'png' },
      { name: 'b.png', path: 'b', is_dir: false, modified: 30, extension: 'png' },
      { name: 'c.png', path: 'c', is_dir: false, modified: 20, extension: 'png' },
    ]);

    expect(sorted.map(entry => entry.name)).toEqual(['b.png', 'c.png', 'a.png']);
  });

  it('normalizes reverse drag selections', () => {
    expect(normalizeSelection({ x: 220, y: 160, width: -120, height: -60 })).toEqual({
      x: 100,
      y: 100,
      width: 120,
      height: 60,
    });
  });

  it('maps preview-space selections back to monitor pixels', () => {
    const rect = selectionToMonitorRect(
      { x: 96, y: 54, width: 480, height: 270 },
      { width: 960, height: 540 },
      { x: 1920, y: 0, width: 3840, height: 2160 },
    );

    expect(rect).toEqual({
      x: 2304,
      y: 216,
      width: 1920,
      height: 1080,
    });
  });

  it('maps preview-space selections back to image pixels without monitor offset', () => {
    const rect = selectionToPixelRect(
      { x: 96, y: 54, width: 480, height: 270 },
      { width: 960, height: 540 },
      { width: 3840, height: 2160 },
    );

    expect(rect).toEqual({
      x: 384,
      y: 216,
      width: 1920,
      height: 1080,
    });
  });

  it('clamps oversized selections back into rendered bounds', () => {
    expect(clampSelectionToBounds(
      { x: -50, y: -30, width: 700, height: 500 },
      { width: 640, height: 360 },
    )).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 360,
    });
  });

  it('moves selections without letting them leave the preview frame', () => {
    expect(moveSelection(
      { x: 100, y: 80, width: 180, height: 120 },
      500,
      -200,
      { width: 640, height: 360 },
    )).toEqual({
      x: 460,
      y: 0,
      width: 180,
      height: 120,
    });
  });

  it('detects resize handles around an existing selection', () => {
    expect(getSelectionHandleAtPoint(
      { x: 100, y: 100 },
      { x: 100, y: 100, width: 200, height: 120 },
      8,
    )).toBe('north-west');

    expect(getSelectionHandleAtPoint(
      { x: 300, y: 160 },
      { x: 100, y: 100, width: 200, height: 120 },
      8,
    )).toBe('east');

    expect(getSelectionHandleAtPoint(
      { x: 200, y: 220 },
      { x: 100, y: 100, width: 200, height: 120 },
      8,
    )).toBe('south');

    expect(getSelectionHandleAtPoint(
      { x: 180, y: 160 },
      { x: 100, y: 100, width: 200, height: 120 },
      8,
    )).toBeNull();
  });

  it('resizes selections from a handle while preserving a minimum size', () => {
    expect(resizeSelection(
      { x: 120, y: 100, width: 220, height: 160 },
      'north-west',
      180,
      150,
      { width: 640, height: 360 },
      24,
    )).toEqual({
      x: 300,
      y: 236,
      width: 40,
      height: 24,
    });
  });

  it('creates inset selections that stay inside the preview', () => {
    expect(createInsetSelection({ width: 1_000, height: 500 })).toEqual({
      x: 120,
      y: 60,
      width: 760,
      height: 380,
    });
  });
});
