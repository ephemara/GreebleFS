import { describe, expect, it } from 'vitest';
import {
  computeAnchoredOverlayWindowLayout,
  clampOverlayWindowBoundsToWorkArea,
  computeOverlayWindowLayout,
  computeWindowSizeConstraints,
  overlayWindowGeometry,
  panelWindowGeometry,
} from '../config/overlayWindow';
import {
  computePanelWindowConstraints,
  computePanelWindowLayout,
} from '../runtime/overlayRuntimeUtils';

const WORK_AREA = {
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
};

describe('computeOverlayWindowLayout', () => {
  it('anchors the default launch window to the left work-area edge', () => {
    const layout = computeOverlayWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      overlayHeight: overlayWindowGeometry.defaultHeight,
      overlayWidth: overlayWindowGeometry.defaultWidth,
      overlayAnchor: 'bottom',
    });

    expect(layout.width).toBe(overlayWindowGeometry.defaultWidth);
    expect(layout.height).toBe(overlayWindowGeometry.defaultHeight);
    expect(layout.x).toBe(overlayWindowGeometry.logicalPadding);
    expect(layout.y).toBe(
      WORK_AREA.size.height
      - overlayWindowGeometry.defaultHeight
      - overlayWindowGeometry.logicalPadding,
    );
  });

  it('uses configured top anchoring while keeping the overlay edge-anchored', () => {
    const layout = computeOverlayWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      overlayHeight: 420,
      overlayWidth: 1200,
      overlayAnchor: 'top',
    });

    expect(layout.x).toBe(overlayWindowGeometry.logicalPadding);
    expect(layout.y).toBe(overlayWindowGeometry.logicalPadding);
  });

  it('re-docks to the edge while preserving the current size', () => {
    const layout = computeAnchoredOverlayWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      overlayHeight: overlayWindowGeometry.defaultHeight,
      overlayWidth: overlayWindowGeometry.defaultWidth,
      overlayAnchor: 'bottom',
      currentBounds: { width: 1440, height: 620, x: 420, y: 180 },
    });

    expect(layout.width).toBe(1440);
    expect(layout.height).toBe(620);
    expect(layout.x).toBe(overlayWindowGeometry.logicalPadding);
    expect(layout.y).toBe(
      WORK_AREA.size.height
      - 620
      - overlayWindowGeometry.logicalPadding,
    );
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

describe('panel window geometry', () => {
  it('clamps restored app-mode bounds to a chrome-safe minimum', () => {
    const layout = computePanelWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      windowedWidth: 200,
      windowedHeight: 120,
    });

    expect(layout.width).toBe(panelWindowGeometry.minWidth);
    expect(layout.height).toBe(panelWindowGeometry.minHeight);
    expect(layout.x).toBe(Math.round((WORK_AREA.size.width - panelWindowGeometry.minWidth) / 2));
    expect(layout.y).toBe(Math.round((WORK_AREA.size.height - panelWindowGeometry.minHeight) / 2));
  });

  it('heals stale app-mode restore bounds saved at the native chrome minimum', () => {
    const layout = computePanelWindowLayout({
      workArea: WORK_AREA,
      scaleFactor: 1,
      windowedWidth: panelWindowGeometry.minWidth,
      windowedHeight: panelWindowGeometry.minHeight,
    });

    expect(layout.width).toBe(panelWindowGeometry.defaultWidth);
    expect(layout.height).toBe(panelWindowGeometry.defaultHeight);
    expect(layout.healedWidth).toBe(panelWindowGeometry.defaultWidth);
    expect(layout.healedHeight).toBe(panelWindowGeometry.defaultHeight);
    expect(layout.x).toBe(Math.round((WORK_AREA.size.width - panelWindowGeometry.defaultWidth) / 2));
    expect(layout.y).toBe(Math.round((WORK_AREA.size.height - panelWindowGeometry.defaultHeight) / 2));
  });

  it('uses monitor work-area limits as native app-mode max constraints', () => {
    const constraints = computePanelWindowConstraints({
      workArea: WORK_AREA,
      scaleFactor: 1,
    });

    expect(constraints).toEqual({
      minWidth: panelWindowGeometry.minWidth,
      minHeight: panelWindowGeometry.minHeight,
      maxWidth: WORK_AREA.size.width - panelWindowGeometry.logicalPadding * 2,
      maxHeight: WORK_AREA.size.height - panelWindowGeometry.logicalPadding * 2,
    });
  });

  it('keeps minimum chrome constraints authoritative on unusually small work areas', () => {
    const constraints = computeWindowSizeConstraints({
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 640, height: 360 },
      },
      scaleFactor: 1,
      geometry: panelWindowGeometry,
    });

    expect(constraints.minWidth).toBe(panelWindowGeometry.minWidth);
    expect(constraints.minHeight).toBe(panelWindowGeometry.minHeight);
    expect(constraints.maxWidth).toBe(panelWindowGeometry.minWidth);
    expect(constraints.maxHeight).toBe(panelWindowGeometry.minHeight);
  });
});
