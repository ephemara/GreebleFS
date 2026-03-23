import { describe, expect, it } from 'vitest';
import {
  clampOverlayWindowBoundsToWorkArea,
  computeOverlayWindowLayout,
  overlayWindowGeometry,
} from '../config/overlayWindow';

const WORK_AREA = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe('computeOverlayWindowLayout', () => {
  it('centers the default launch window horizontally', () => {
    const layout = computeOverlayWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      overlayHeight: overlayWindowGeometry.defaultHeight,
      overlayWidth: overlayWindowGeometry.defaultWidth,
      overlayAnchor: 'bottom',
    });

    expect(layout.width).toBe(overlayWindowGeometry.defaultWidth);
    expect(layout.height).toBe(overlayWindowGeometry.defaultHeight);
    expect(layout.x).toBe(Math.round((WORK_AREA.size.width - overlayWindowGeometry.defaultWidth) / 2));
    expect(layout.y).toBe(
      WORK_AREA.size.height
      - overlayWindowGeometry.defaultHeight
      - overlayWindowGeometry.logicalPadding,
    );
  });

  it('uses configured top anchoring without forcing the window left', () => {
    const layout = computeOverlayWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      overlayHeight: 420,
      overlayWidth: 1200,
      overlayAnchor: 'top',
    });

    expect(layout.x).toBe(Math.round((WORK_AREA.size.width - 1200) / 2));
    expect(layout.y).toBe(overlayWindowGeometry.logicalPadding);
  });
});

describe('clampOverlayWindowBoundsToWorkArea', () => {
  it('preserves in-session freeform bounds when they remain on screen', () => {
    const bounds = clampOverlayWindowBoundsToWorkArea({
      workArea: WORK_AREA,
      scaleFactor: 1,
      bounds: { width: 1280, height: 640, x: 240, y: 180 },
    });

    expect(bounds).toEqual({ width: 1280, height: 640, x: 240, y: 180 });
  });

  it('pulls oversized or off-screen bounds back into the visible work area', () => {
    const bounds = clampOverlayWindowBoundsToWorkArea({
      workArea: WORK_AREA,
      scaleFactor: 1,
      bounds: { width: 4000, height: 3000, x: -500, y: -200 },
    });

    expect(bounds.width).toBe(WORK_AREA.size.width - overlayWindowGeometry.logicalPadding * 2);
    expect(bounds.height).toBe(WORK_AREA.size.height - overlayWindowGeometry.logicalPadding * 2);
    expect(bounds.x).toBe(overlayWindowGeometry.logicalPadding);
    expect(bounds.y).toBe(overlayWindowGeometry.logicalPadding);
  });
});
