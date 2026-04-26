export type ExplorerImageStageTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM: ExplorerImageStageTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export const EXPLORER_IMAGE_STAGE_MIN_SCALE = 0.5;
export const EXPLORER_IMAGE_STAGE_MAX_SCALE = 6;
export const EXPLORER_IMAGE_STAGE_ZOOM_SENSITIVITY = 0.0015;
export const EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_IMAGE = `
  linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
  linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
  linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.02) 75%),
  linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.02) 75%)
`;
export const EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_SIZE = '16px 16px';
export const EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_POSITION =
  '0 0, 0 8px, 8px -8px, -8px 0px';
export const EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_COLOR =
  'rgba(0,0,0,0.4)';

function clampExplorerImageStageValue(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeExplorerImageStageTransform(
  transform: ExplorerImageStageTransform,
  viewport: HTMLDivElement | null,
  content: HTMLElement | null,
): ExplorerImageStageTransform {
  const nextScale = Number(
    clampExplorerImageStageValue(
      transform.scale,
      EXPLORER_IMAGE_STAGE_MIN_SCALE,
      EXPLORER_IMAGE_STAGE_MAX_SCALE,
    ).toFixed(2),
  );

  if (!viewport || !content) {
    return {
      scale: nextScale,
      offsetX: Number(transform.offsetX.toFixed(2)),
      offsetY: Number(transform.offsetY.toFixed(2)),
    };
  }

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const baseWidth = content.clientWidth;
  const baseHeight = content.clientHeight;

  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    baseWidth <= 0 ||
    baseHeight <= 0
  ) {
    return {
      scale: nextScale,
      offsetX: Number(transform.offsetX.toFixed(2)),
      offsetY: Number(transform.offsetY.toFixed(2)),
    };
  }

  const scaledWidth = baseWidth * nextScale;
  const scaledHeight = baseHeight * nextScale;
  const maxOffsetX = Math.max(0, (scaledWidth - viewportWidth) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - viewportHeight) / 2);

  return {
    scale: nextScale,
    offsetX: Number(
      clampExplorerImageStageValue(
        transform.offsetX,
        -maxOffsetX,
        maxOffsetX,
      ).toFixed(2),
    ),
    offsetY: Number(
      clampExplorerImageStageValue(
        transform.offsetY,
        -maxOffsetY,
        maxOffsetY,
      ).toFixed(2),
    ),
  };
}

export function applyExplorerImageStageWheelZoom(args: {
  currentTransform: ExplorerImageStageTransform;
  viewport: HTMLDivElement | null;
  content: HTMLElement | null;
  clientX: number;
  clientY: number;
  deltaY: number;
}): ExplorerImageStageTransform {
  const { currentTransform, viewport, content, clientX, clientY, deltaY } = args;
  if (!viewport) {
    return currentTransform;
  }

  const zoomFactor = Math.exp(-deltaY * EXPLORER_IMAGE_STAGE_ZOOM_SENSITIVITY);
  const viewportRect = viewport.getBoundingClientRect();
  const focusX = clientX - viewportRect.left - viewportRect.width / 2;
  const focusY = clientY - viewportRect.top - viewportRect.height / 2;
  const nextScale = Number(
    clampExplorerImageStageValue(
      currentTransform.scale * zoomFactor,
      EXPLORER_IMAGE_STAGE_MIN_SCALE,
      EXPLORER_IMAGE_STAGE_MAX_SCALE,
    ).toFixed(2),
  );

  if (nextScale === currentTransform.scale) {
    return currentTransform;
  }

  const scaleRatio = nextScale / currentTransform.scale;
  return normalizeExplorerImageStageTransform(
    {
      scale: nextScale,
      offsetX:
        currentTransform.offsetX * scaleRatio + (1 - scaleRatio) * focusX,
      offsetY:
        currentTransform.offsetY * scaleRatio + (1 - scaleRatio) * focusY,
    },
    viewport,
    content,
  );
}
