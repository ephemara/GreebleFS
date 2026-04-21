import { describe, expect, it } from "vitest";
import type { ConstellationFieldLayout } from "../components/explorer/constellationLayout";
import {
  clampConstellationCameraPan,
  createConstellationFitCamera,
  zoomConstellationCameraAtViewportPoint,
} from "../components/explorer/constellationCamera";

const TEST_LAYOUT: ConstellationFieldLayout = {
  width: 1600,
  height: 1000,
  bands: [],
  connections: [],
};

describe("constellationCamera", () => {
  it("creates a fit camera that centers the world inside the viewport", () => {
    const camera = createConstellationFitCamera(TEST_LAYOUT, {
      viewportWidth: 1280,
      viewportHeight: 820,
    });

    expect(camera.zoom).toBeGreaterThan(0.64);
    expect(camera.zoom).toBeLessThan(0.7);
    expect(camera.x).toBeGreaterThan(0);
    expect(camera.y).toBeGreaterThan(0);
  });

  it("clamps oversized pans to the visible world bounds", () => {
    const clampedPan = clampConstellationCameraPan(
      { x: 120, y: -900 },
      { viewportWidth: 1180, viewportHeight: 760 },
      TEST_LAYOUT,
      0.9,
    );

    expect(clampedPan.x).toBe(0);
    expect(clampedPan.y).toBeLessThan(0);
    expect(clampedPan.y).toBeGreaterThanOrEqual(760 - (TEST_LAYOUT.height * 0.9));
  });

  it("keeps the cursor's world position stable while zooming", () => {
    const focalPoint = { x: 420, y: 280 };
    const camera = {
      x: -180,
      y: -90,
      zoom: 0.86,
    };
    const worldBeforeZoom = {
      x: (focalPoint.x - camera.x) / camera.zoom,
      y: (focalPoint.y - camera.y) / camera.zoom,
    };

    const zoomedCamera = zoomConstellationCameraAtViewportPoint(
      camera,
      1.18,
      focalPoint,
      { viewportWidth: 1280, viewportHeight: 820 },
      TEST_LAYOUT,
    );

    expect((focalPoint.x - zoomedCamera.x) / zoomedCamera.zoom).toBeCloseTo(
      worldBeforeZoom.x,
      5,
    );
    expect((focalPoint.y - zoomedCamera.y) / zoomedCamera.zoom).toBeCloseTo(
      worldBeforeZoom.y,
      5,
    );
  });
});
