import type {
  ConstellationFieldLayout,
  ConstellationFieldNode,
} from "./constellationLayout";

export interface ConstellationCameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface ConstellationViewportMetrics {
  viewportWidth: number;
  viewportHeight: number;
}

export interface ConstellationViewportPoint {
  x: number;
  y: number;
}

export const CONSTELLATION_CAMERA_ZOOM_RANGE = Object.freeze({
  min: 0.42,
  max: 1.92,
  default: 0.72,
});

const CONSTELLATION_CAMERA_FIT_PADDING = 72;

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function clampConstellationZoom(zoom: number): number {
  return clampNumber(
    Number.isFinite(zoom) ? zoom : CONSTELLATION_CAMERA_ZOOM_RANGE.default,
    CONSTELLATION_CAMERA_ZOOM_RANGE.min,
    CONSTELLATION_CAMERA_ZOOM_RANGE.max,
  );
}

export function getConstellationScaledWorldSize(
  layout: ConstellationFieldLayout,
  zoom: number,
): { width: number; height: number } {
  const normalizedZoom = clampConstellationZoom(zoom);
  return {
    width: layout.width * normalizedZoom,
    height: layout.height * normalizedZoom,
  };
}

export function getConstellationFitZoom(
  layout: ConstellationFieldLayout,
  metrics: ConstellationViewportMetrics,
): number {
  if (metrics.viewportWidth <= 0 || metrics.viewportHeight <= 0) {
    return CONSTELLATION_CAMERA_ZOOM_RANGE.default;
  }

  const safeWidth = Math.max(1, metrics.viewportWidth - (CONSTELLATION_CAMERA_FIT_PADDING * 2));
  const safeHeight = Math.max(1, metrics.viewportHeight - (CONSTELLATION_CAMERA_FIT_PADDING * 2));

  return clampConstellationZoom(
    Math.min(safeWidth / layout.width, safeHeight / layout.height),
  );
}

export function clampConstellationCameraPan(
  nextPan: Pick<ConstellationCameraState, "x" | "y">,
  metrics: ConstellationViewportMetrics,
  layout: ConstellationFieldLayout,
  zoom: number,
): Pick<ConstellationCameraState, "x" | "y"> {
  const { width, height } = getConstellationScaledWorldSize(layout, zoom);

  const x = width <= metrics.viewportWidth
    ? Math.round((metrics.viewportWidth - width) / 2)
    : clampNumber(nextPan.x, metrics.viewportWidth - width, 0);
  const y = height <= metrics.viewportHeight
    ? Math.round((metrics.viewportHeight - height) / 2)
    : clampNumber(nextPan.y, metrics.viewportHeight - height, 0);

  return { x, y };
}

export function createConstellationFitCamera(
  layout: ConstellationFieldLayout,
  metrics: ConstellationViewportMetrics,
): ConstellationCameraState {
  const zoom = getConstellationFitZoom(layout, metrics);
  const pan = clampConstellationCameraPan(
    { x: 0, y: 0 },
    metrics,
    layout,
    zoom,
  );

  return {
    ...pan,
    zoom,
  };
}

export function centerConstellationCameraOnNode(
  layout: ConstellationFieldLayout,
  node: ConstellationFieldNode,
  metrics: ConstellationViewportMetrics,
  zoom: number,
): ConstellationCameraState {
  const normalizedZoom = clampConstellationZoom(zoom);
  const pan = clampConstellationCameraPan(
    {
      x: (metrics.viewportWidth / 2) - (node.x * normalizedZoom),
      y: (metrics.viewportHeight / 2) - (node.y * normalizedZoom),
    },
    metrics,
    layout,
    normalizedZoom,
  );

  return {
    ...pan,
    zoom: normalizedZoom,
  };
}

export function zoomConstellationCameraAtViewportPoint(
  camera: ConstellationCameraState,
  targetZoom: number,
  focalPoint: ConstellationViewportPoint,
  metrics: ConstellationViewportMetrics,
  layout: ConstellationFieldLayout,
): ConstellationCameraState {
  const normalizedNextZoom = clampConstellationZoom(targetZoom);
  const worldX = (focalPoint.x - camera.x) / Math.max(camera.zoom, 0.001);
  const worldY = (focalPoint.y - camera.y) / Math.max(camera.zoom, 0.001);
  const pan = clampConstellationCameraPan(
    {
      x: focalPoint.x - (worldX * normalizedNextZoom),
      y: focalPoint.y - (worldY * normalizedNextZoom),
    },
    metrics,
    layout,
    normalizedNextZoom,
  );

  return {
    ...pan,
    zoom: normalizedNextZoom,
  };
}

export function getConstellationWheelZoom(
  currentZoom: number,
  deltaY: number,
): number {
  return clampConstellationZoom(
    currentZoom * Math.exp((-deltaY) * 0.0012),
  );
}
