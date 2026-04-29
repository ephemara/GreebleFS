import type { CSSProperties } from 'react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  clampOverlayVisualControlValue,
  computeWindowSizeConstraints,
  overlayWindowGeometry,
  overlayVisualControls,
  panelWindowGeometry,
  type OverlayWindowArea,
  type OverlayWindowSizeConstraints,
} from '../config/overlayWindow';
import * as explorerBackend from './explorerBackend';

export interface PanelWindowLayout {
  width: number;
  height: number;
  x: number;
  y: number;
  healedWidth: number | null;
  healedHeight: number | null;
}

export function parseExternalArgs(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map(value => value.trim())
    .filter(Boolean);
}

export function getParentPath(path: string, separator: string): string {
  let normalized = path.replace(/[\\/]+/g, separator);
  while (normalized.endsWith(separator)) {
    normalized = normalized.slice(0, -separator.length);
  }
  const index = normalized.lastIndexOf(separator);
  return index > 0 ? normalized.slice(0, index) : '';
}

export async function ensureDir(path: string): Promise<void> {
  try {
    await explorerBackend.listExplorerDir(path, false);
  } catch {
    await explorerBackend.createExplorerDir(path);
  }
}

export function computePanelWindowLayout(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
  windowedWidth: number;
  windowedHeight: number;
}): PanelWindowLayout {
  const physPad = Math.round(panelWindowGeometry.logicalPadding * args.scaleFactor);
  const availableLogicalWidth = Math.max(
    Math.round(args.workArea.size.width / args.scaleFactor) - panelWindowGeometry.logicalPadding * 2,
    panelWindowGeometry.minWidth,
  );
  const availableLogicalHeight = Math.max(
    Math.round(args.workArea.size.height / args.scaleFactor) - panelWindowGeometry.logicalPadding * 2,
    panelWindowGeometry.minHeight,
  );
  const targetLogicalWidth = args.windowedWidth > 0 ? args.windowedWidth : panelWindowGeometry.defaultWidth;
  const targetLogicalHeight = args.windowedHeight > 0 ? args.windowedHeight : panelWindowGeometry.defaultHeight;
  const healedWidth = targetLogicalWidth > availableLogicalWidth ? availableLogicalWidth : null;
  const healedHeight = targetLogicalHeight > availableLogicalHeight ? availableLogicalHeight : null;
  const logicalWidth = Math.max(
    Math.min(healedWidth ?? targetLogicalWidth, availableLogicalWidth),
    Math.min(panelWindowGeometry.minWidth, availableLogicalWidth),
  );
  const logicalHeight = Math.max(
    Math.min(healedHeight ?? targetLogicalHeight, availableLogicalHeight),
    Math.min(panelWindowGeometry.minHeight, availableLogicalHeight),
  );
  const width = Math.round(logicalWidth * args.scaleFactor);
  const height = Math.round(logicalHeight * args.scaleFactor);

  return {
    width,
    height,
    x: args.workArea.position.x + Math.max(Math.round((args.workArea.size.width - width) / 2), physPad),
    y: args.workArea.position.y + Math.max(Math.round((args.workArea.size.height - height) / 2), physPad),
    healedWidth,
    healedHeight,
  };
}

export function computePanelWindowConstraints(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
}): OverlayWindowSizeConstraints {
  return computeWindowSizeConstraints({
    workArea: args.workArea,
    scaleFactor: args.scaleFactor,
    geometry: panelWindowGeometry,
  });
}

export function computeOverlayWindowConstraints(args: {
  workArea: OverlayWindowArea;
  scaleFactor: number;
}): OverlayWindowSizeConstraints {
  return computeWindowSizeConstraints({
    workArea: args.workArea,
    scaleFactor: args.scaleFactor,
    geometry: overlayWindowGeometry,
  });
}

function getThemeVisualAnimation(layer: NonNullable<ResolvedOverlayAppearance['theme']['visuals']>[number]): string | undefined {
  if (!layer.animation) {
    return undefined;
  }

  const durationMs = typeof layer.animation.durationMs === 'number' ? layer.animation.durationMs : 18000;
  const easing = layer.animation.easing ?? 'ease-in-out';
  const direction = layer.animation.direction ?? 'alternate';
  return `overlay-theme-visual-${layer.animation.kind} ${durationMs}ms ${easing} infinite ${direction}`;
}

export function buildThemeVisualStyle(
  layer: NonNullable<ResolvedOverlayAppearance['theme']['visuals']>[number],
): CSSProperties {
  return {
    position: 'absolute',
    inset: layer.inset ?? '0',
    pointerEvents: 'none',
    backgroundImage: layer.backgroundImage,
    backgroundSize: layer.backgroundSize ?? 'cover',
    backgroundPosition: layer.backgroundPosition ?? 'center',
    backgroundRepeat: layer.backgroundRepeat ?? 'no-repeat',
    opacity: typeof layer.opacity === 'number' ? layer.opacity : 1,
    filter: layer.filter ?? 'none',
    mixBlendMode: (layer.blendMode as CSSProperties['mixBlendMode']) ?? 'normal',
    animation: getThemeVisualAnimation(layer),
    willChange: layer.animation ? 'transform, opacity' : undefined,
  };
}

export function resolveShellBackgroundColor(
  translucentColor: string,
  solidColor: string,
  blurStrength: number,
  parseColor: (color: string) => { alpha: number } | null,
  withColorAlpha: (color: string, alpha: number) => string,
): string {
  const normalizedStrength = overlayVisualControls.blurStrength.max > 0
    ? clampOverlayVisualControlValue('blurStrength', blurStrength) / overlayVisualControls.blurStrength.max
    : 0;
  const solidAlpha = parseColor(solidColor)?.alpha ?? 0.96;
  const translucentAlpha = parseColor(translucentColor)?.alpha ?? Math.min(0.82, solidAlpha);
  const minimumGlassAlpha = Math.max(0.16, translucentAlpha * 0.45);
  const targetAlpha = solidAlpha - ((solidAlpha - minimumGlassAlpha) * normalizedStrength);
  return withColorAlpha(translucentColor, targetAlpha);
}
