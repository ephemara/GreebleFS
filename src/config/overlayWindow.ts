import type { DockPlacementMode } from './dockPresentations';

export interface OverlayVisualControlDefinition {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue: (value: number) => string;
}

export interface OverlayWindowBounds {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface OverlayWindowLayout extends OverlayWindowBounds {
  healedHeight: number | null;
}

export interface DockPresentationWindowLayout extends OverlayWindowLayout {
  placementMode: DockPlacementMode;
  floating: boolean;
}

export interface OverlayWindowSizeConstraints {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export const overlayWindowGeometry = {
  logicalPadding: 12,
  defaultWidth: 1000,
  defaultHeight: 500,
  minWidth: 400,
  minHeight: 150,
} as const;

export const panelWindowGeometry = {
  logicalPadding: overlayWindowGeometry.logicalPadding,
  defaultWidth: 1440,
  defaultHeight: 920,
  minWidth: 800,
  minHeight: 560,
} as const;

type WindowConstraintGeometry = {
  logicalPadding: number;
  minWidth: number;
  minHeight: number;
};

export type OverlayWindowArea = {
  position: { x: number; y: number };
  size: { width: number; height: number };
};

function formatPercentValue(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPixelValue(value: number): string {
  return `${Math.round(value)}px`;
}

export const overlayVisualControls = {
  opacity: {
    min: 0.15,
    max: 1,
    step: 0.02,
    defaultValue: 1,
    formatValue: formatPercentValue,
  },
  panelTransparency: {
    min: 0,
    max: 1,
    step: 0.02,
    defaultValue: 0,
    formatValue: formatPercentValue,
  },
  zoom: {
    min: 0.7,
    max: 1.35,
    step: 0.025,
    defaultValue: 1,
    formatValue: formatPercentValue,
  },
  blurStrength: {
    min: 0,
    max: 32,
    step: 1,
    defaultValue: 18,
    formatValue: formatPixelValue,
  },
} satisfies Record<string, OverlayVisualControlDefinition>;

export type OverlayVisualControlKey = keyof typeof overlayVisualControls;

export function clampOverlayVisualControlValue(
  key: OverlayVisualControlKey,
  value: number,
): number {
  const control = overlayVisualControls[key];
  if (!Number.isFinite(value)) {
    return control.defaultValue;
  }

  return Math.min(Math.max(value, control.min), control.max);
}

export function formatOverlayVisualControlValue(
  key: OverlayVisualControlKey,
  value: number,
): string {
  const control = overlayVisualControls[key];
  return control.formatValue(clampOverlayVisualControlValue(key, value));
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolvePhysicalPadding(scaleFactor: number): number {
  return Math.round(overlayWindowGeometry.logicalPadding * scaleFactor);
}

export function computeWindowSizeConstraints(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  geometry?: WindowConstraintGeometry;
}): OverlayWindowSizeConstraints {
  const geometry = args.geometry ?? overlayWindowGeometry;
  const physicalPadding = Math.round(geometry.logicalPadding * args.scaleFactor);
  const minWidth = Math.max(1, Math.round(geometry.minWidth * args.scaleFactor));
  const minHeight = Math.max(1, Math.round(geometry.minHeight * args.scaleFactor));
  const availableWidth = Math.max(1, args.workArea.size.width - physicalPadding * 2);
  const availableHeight = Math.max(1, args.workArea.size.height - physicalPadding * 2);

  return {
    minWidth,
    minHeight,
    maxWidth: Math.max(minWidth, availableWidth),
    maxHeight: Math.max(minHeight, availableHeight),
  };
}

export function computeOverlayWindowLayout(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: 'top' | 'bottom';
}): OverlayWindowLayout {
  const physicalPadding = resolvePhysicalPadding(args.scaleFactor);
  const minPhysicalWidth = Math.round(overlayWindowGeometry.minWidth * args.scaleFactor);
  const minPhysicalHeight = Math.round(overlayWindowGeometry.minHeight * args.scaleFactor);
  const maxPhysicalWidth = Math.max(minPhysicalWidth, args.workArea.size.width - physicalPadding * 2);
  const maxPhysicalHeight = Math.max(minPhysicalHeight, args.workArea.size.height - physicalPadding * 2);
  const availableLogicalHeight = Math.max(
    Math.round(args.workArea.size.height / args.scaleFactor) - overlayWindowGeometry.logicalPadding * 2,
    overlayWindowGeometry.minHeight,
  );
  const requestedLogicalHeight = args.overlayHeight > 0
    ? Math.round(args.overlayHeight)
    : overlayWindowGeometry.defaultHeight;
  const healedHeight = requestedLogicalHeight >= availableLogicalHeight - 4
    ? overlayWindowGeometry.defaultHeight
    : null;
  const targetLogicalHeight = healedHeight ?? requestedLogicalHeight;
  const targetLogicalWidth = args.overlayWidth > 0
    ? Math.round(args.overlayWidth)
    : overlayWindowGeometry.defaultWidth;
  const width = clampValue(
    Math.round(targetLogicalWidth * args.scaleFactor),
    minPhysicalWidth,
    maxPhysicalWidth,
  );
  const height = clampValue(
    Math.round(targetLogicalHeight * args.scaleFactor),
    minPhysicalHeight,
    maxPhysicalHeight,
  );
  const minX = args.workArea.position.x + physicalPadding;
  const maxX = Math.max(minX, args.workArea.position.x + args.workArea.size.width - width - physicalPadding);
  const anchoredX = minX;
  const minY = args.workArea.position.y + physicalPadding;
  const maxY = Math.max(minY, args.workArea.position.y + args.workArea.size.height - height - physicalPadding);
  const anchoredY = args.overlayAnchor === 'top'
    ? minY
    : args.workArea.position.y + args.workArea.size.height - height - physicalPadding;

  return {
    width,
    height,
    x: clampValue(anchoredX, minX, maxX),
    y: clampValue(anchoredY, minY, maxY),
    healedHeight,
  };
}

export function computeAnchoredOverlayWindowLayout(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  overlayHeight: number;
  overlayWidth: number;
  overlayAnchor: 'top' | 'bottom';
  currentBounds?: OverlayWindowBounds | null;
}): OverlayWindowLayout {
  const resolvedOverlayHeight = args.currentBounds
    ? Math.max(
        overlayWindowGeometry.minHeight,
        Math.round(args.currentBounds.height / args.scaleFactor),
      )
    : args.overlayHeight;
  const resolvedOverlayWidth = args.currentBounds
    ? Math.max(
        overlayWindowGeometry.minWidth,
        Math.round(args.currentBounds.width / args.scaleFactor),
      )
    : args.overlayWidth;

  return computeOverlayWindowLayout({
    workArea: args.workArea,
    scaleFactor: args.scaleFactor,
    overlayHeight: resolvedOverlayHeight,
    overlayWidth: resolvedOverlayWidth,
    overlayAnchor: args.overlayAnchor,
  });
}

export function clampOverlayWindowBoundsToWorkArea(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  bounds: OverlayWindowBounds;
}): OverlayWindowBounds {
  const physicalPadding = resolvePhysicalPadding(args.scaleFactor);
  const minPhysicalWidth = Math.round(overlayWindowGeometry.minWidth * args.scaleFactor);
  const minPhysicalHeight = Math.round(overlayWindowGeometry.minHeight * args.scaleFactor);
  const maxPhysicalWidth = Math.max(minPhysicalWidth, args.workArea.size.width - physicalPadding * 2);
  const maxPhysicalHeight = Math.max(minPhysicalHeight, args.workArea.size.height - physicalPadding * 2);
  const width = clampValue(Math.round(args.bounds.width), minPhysicalWidth, maxPhysicalWidth);
  const height = clampValue(Math.round(args.bounds.height), minPhysicalHeight, maxPhysicalHeight);
  const minX = args.workArea.position.x + physicalPadding;
  const maxX = Math.max(minX, args.workArea.position.x + args.workArea.size.width - width - physicalPadding);
  const minY = args.workArea.position.y + physicalPadding;
  const maxY = Math.max(minY, args.workArea.position.y + args.workArea.size.height - height - physicalPadding);

  return {
    width,
    height,
    x: clampValue(Math.round(args.bounds.x), minX, maxX),
    y: clampValue(Math.round(args.bounds.y), minY, maxY),
  };
}

export function computeDockPresentationWindowLayout(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  placementMode: DockPlacementMode;
  edgeSize: number;
  edgeWidth: number;
  floatingBounds?: OverlayWindowBounds | null;
  currentBounds?: OverlayWindowBounds | null;
}): DockPresentationWindowLayout {
  if (args.placementMode !== 'floating') {
    const anchoredLayout = computeAnchoredOverlayWindowLayout({
      workArea: args.workArea,
      scaleFactor: args.scaleFactor,
      overlayHeight: args.edgeSize,
      overlayWidth: args.edgeWidth,
      overlayAnchor: args.placementMode === 'top-edge' ? 'top' : 'bottom',
      currentBounds: args.currentBounds ?? null,
    });

    return {
      ...anchoredLayout,
      placementMode: args.placementMode,
      floating: false,
    };
  }

  const minPhysicalWidth = Math.round(overlayWindowGeometry.minWidth * args.scaleFactor);
  const minPhysicalHeight = Math.round(overlayWindowGeometry.minHeight * args.scaleFactor);
  const requestedWidth = Math.max(
    minPhysicalWidth,
    Math.round(args.edgeWidth * args.scaleFactor),
  );
  const requestedHeight = Math.max(
    minPhysicalHeight,
    Math.round(args.edgeSize * args.scaleFactor),
  );
  const centeredBounds = {
    width: requestedWidth,
    height: requestedHeight,
    x: args.workArea.position.x + Math.round((args.workArea.size.width - requestedWidth) / 2),
    y: args.workArea.position.y + Math.round((args.workArea.size.height - requestedHeight) / 2),
  };
  const floatingBounds = clampOverlayWindowBoundsToWorkArea({
    workArea: args.workArea,
    scaleFactor: args.scaleFactor,
    bounds: args.currentBounds ?? args.floatingBounds ?? centeredBounds,
  });

  return {
    ...floatingBounds,
    healedHeight: null,
    placementMode: 'floating',
    floating: true,
  };
}
