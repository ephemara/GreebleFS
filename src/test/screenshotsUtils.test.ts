import { describe, expect, it } from 'vitest';
import {
  isSupportedScreenshotEntry,
  normalizeSelection,
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
});
