import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

type Point = {
  x: number;
  y: number;
  pressure: number;
  time: number;
};

type Size = {
  width: number;
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type OverlayPluginStorageApi = {
  rootDir: string;
  ensureDir: (relativePath?: string) => Promise<string>;
  readTextFile: (relativePath: string) => Promise<string>;
  writeTextFile: (relativePath: string, data: string) => Promise<void>;
  writeFile: (relativePath: string, data: Uint8Array) => Promise<void>;
};

type OverlayPluginApi = {
  storage?: OverlayPluginStorageApi;
};

type OverlayAppearance = {
  theme: {
    palette?: {
      accent?: string;
      textMuted?: string;
    };
  };
};

type HostContext = {
  width: number;
  height: number;
  compact: boolean;
  density: 'compact' | 'regular';
};

type PluginProps = {
  plugin: {
    id: string;
    name: string;
  };
  api?: OverlayPluginApi;
  appearance: OverlayAppearance;
  host?: HostContext;
};

type BrushPreset = {
  id: string;
  label: string;
  color: string;
  size: number;
  opacity: number;
  softness: number;
  spacing: number;
  scatter: number;
  flow: number;
  blendMode: GlobalCompositeOperation;
  stampNoise: number;
};

type EffectPreset = {
  id: string;
  label: string;
  description: string;
};

type SaveStatus = {
  kind: 'idle' | 'saving' | 'success' | 'error';
  message: string;
};

type SketchMetadata = {
  savedAt: string;
  canvas: Size;
  brushPreset: string;
  effectPreset: string;
  strokeColor: string;
  brushSize: number;
  brushOpacity: number;
  storageRoot: string | null;
};

const MIN_STAGE_SIZE: Size = { width: 280, height: 180 };
const INITIAL_STAGE_SIZE: Size = { width: 960, height: 540 };
const EFFECT_PADDING = 18;

const SWATCHES = ['#f8fafc', '#7dd3fc', '#34d399', '#f97316', '#f472b6', '#facc15', '#60a5fa'];

const BRUSH_PRESETS: BrushPreset[] = [
  { id: 'ink', label: 'Ink', color: '#c4b5fd', size: 5, opacity: 0.95, softness: 0.16, spacing: 0.18, scatter: 0.02, flow: 0.2, blendMode: 'source-over', stampNoise: 0.04 },
  { id: 'marker', label: 'Marker', color: '#34d399', size: 18, opacity: 0.22, softness: 0.46, spacing: 0.1, scatter: 0.05, flow: 0.4, blendMode: 'source-over', stampNoise: 0.08 },
  { id: 'paint', label: 'Paint', color: '#f97316', size: 28, opacity: 0.17, softness: 0.72, spacing: 0.08, scatter: 0.12, flow: 0.78, blendMode: 'source-over', stampNoise: 0.18 },
  { id: 'eraser', label: 'Eraser', color: '#ffffff', size: 30, opacity: 0.8, softness: 0.78, spacing: 0.08, scatter: 0, flow: 0, blendMode: 'destination-out', stampNoise: 0 },
];

const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'none', label: 'Flat', description: 'Direct paint with no post effect.' },
  { id: 'sculpt', label: 'Sculpt', description: 'Relief lighting with specular lift.' },
  { id: 'flow', label: 'Flow', description: 'Wet smear driven by local gradients.' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function pseudoNoise(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function normalizeSize(size: Size): Size {
  return {
    width: Math.max(Math.floor(size.width), MIN_STAGE_SIZE.width),
    height: Math.max(Math.floor(size.height), MIN_STAGE_SIZE.height),
  };
}

function createSurface(size: Size): HTMLCanvasElement {
  const surface = document.createElement('canvas');
  surface.width = size.width;
  surface.height = size.height;
  return surface;
}

function scaleSurface(source: HTMLCanvasElement | null, size: Size): HTMLCanvasElement {
  const next = createSurface(size);
  if (source && source.width > 0 && source.height > 0) {
    const context = next.getContext('2d');
    if (context) {
      context.drawImage(source, 0, 0, source.width, source.height, 0, 0, size.width, size.height);
    }
  }
  return next;
}

function createRectFromCenter(x: number, y: number, radius: number, size: Size, padding = 8): Rect | null {
  const left = clamp(Math.floor(x - radius - padding), 0, size.width);
  const right = clamp(Math.ceil(x + radius + padding), 0, size.width);
  const top = clamp(Math.floor(y - radius - padding), 0, size.height);
  const bottom = clamp(Math.ceil(y + radius + padding), 0, size.height);
  if (right <= left || bottom <= top) {
    return null;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function mergeRects(left: Rect, right: Rect): Rect {
  const minX = Math.min(left.x, right.x);
  const minY = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function expandRect(rect: Rect, size: Size, padding: number): Rect {
  const left = clamp(rect.x - padding, 0, size.width);
  const top = clamp(rect.y - padding, 0, size.height);
  const right = clamp(rect.x + rect.width + padding, 0, size.width);
  const bottom = clamp(rect.y + rect.height + padding, 0, size.height);
  return { x: left, y: top, width: Math.max(right - left, 1), height: Math.max(bottom - top, 1) };
}

function getFallbackBrush(id: string): BrushPreset {
  return BRUSH_PRESETS.find(brush => brush.id === id) ?? BRUSH_PRESETS[0];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CanvasPad({ plugin, api, appearance, host }: PluginProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintSurfaceRef = useRef<HTMLCanvasElement | null>(null);
  const effectSurfaceRef = useRef<HTMLCanvasElement | null>(null);
  const paintContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const effectContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const artworkSizeRef = useRef<Size>(INITIAL_STAGE_SIZE);
  const lastPointRef = useRef<Point | null>(null);
  const isDrawingRef = useRef(false);
  const dirtyRectRef = useRef<Rect | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const effectFrameRef = useRef<number | null>(null);
  const effectPresetRef = useRef(EFFECT_PRESETS[1].id);

  const [viewportSize, setViewportSize] = useState<Size>(INITIAL_STAGE_SIZE);
  const [brushPresetId, setBrushPresetId] = useState(BRUSH_PRESETS[0].id);
  const [effectPresetId, setEffectPresetId] = useState(EFFECT_PRESETS[1].id);
  const [strokeColor, setStrokeColor] = useState(appearance.theme.palette?.accent ?? BRUSH_PRESETS[0].color);
  const [brushSize, setBrushSize] = useState(BRUSH_PRESETS[0].size);
  const [brushOpacity, setBrushOpacity] = useState(BRUSH_PRESETS[0].opacity);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle', message: 'Ready.' });

  const muted = appearance.theme.palette?.textMuted ?? 'rgba(226, 232, 240, 0.7)';
  const isCompact = host?.compact ?? viewportSize.width < 980;

  const activeBrush = useMemo(() => {
    const preset = getFallbackBrush(brushPresetId);
    return { ...preset, color: preset.id === 'eraser' ? preset.color : strokeColor, size: brushSize, opacity: brushOpacity };
  }, [brushOpacity, brushPresetId, brushSize, strokeColor]);

  const currentEffect = useMemo(
    () => EFFECT_PRESETS.find(effect => effect.id === effectPresetId) ?? EFFECT_PRESETS[0],
    [effectPresetId],
  );

  const syncArtworkSize = useCallback((size: Size) => {
    const nextSize = normalizeSize(size);
    const current = artworkSizeRef.current;
    const paintSurface = paintSurfaceRef.current;
    const effectSurface = effectSurfaceRef.current;
    const needsResize = !paintSurface
      || !effectSurface
      || current.width !== nextSize.width
      || current.height !== nextSize.height;

    if (!needsResize) {
      return;
    }

    const nextPaintSurface = scaleSurface(paintSurface, nextSize);
    const nextEffectSurface = scaleSurface(effectSurface, nextSize);
    paintSurfaceRef.current = nextPaintSurface;
    effectSurfaceRef.current = nextEffectSurface;
    paintContextRef.current = nextPaintSurface.getContext('2d', { willReadFrequently: true });
    effectContextRef.current = nextEffectSurface.getContext('2d');
    artworkSizeRef.current = nextSize;
    dirtyRectRef.current = { x: 0, y: 0, width: nextSize.width, height: nextSize.height };
  }, []);

  const ensureSurfaces = useCallback(() => {
    syncArtworkSize(artworkSizeRef.current);
  }, [syncArtworkSize]);

  const markDirtyRect = useCallback((x: number, y: number, radius: number) => {
    const next = createRectFromCenter(x, y, radius, artworkSizeRef.current);
    if (!next) {
      return;
    }
    dirtyRectRef.current = dirtyRectRef.current ? mergeRects(dirtyRectRef.current, next) : next;
  }, []);

  const consumeDirtyRect = useCallback((full: boolean): Rect | null => {
    const size = artworkSizeRef.current;
    if (full) {
      dirtyRectRef.current = null;
      return { x: 0, y: 0, width: size.width, height: size.height };
    }

    const dirty = dirtyRectRef.current;
    dirtyRectRef.current = null;
    return dirty ? expandRect(dirty, size, EFFECT_PADDING) : null;
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const paintSurface = paintSurfaceRef.current;
    const effectSurface = effectSurfaceRef.current;
    if (!canvas || !paintSurface || !effectSurface) {
      return;
    }

    const width = Math.max(Math.floor(viewportSize.width), MIN_STAGE_SIZE.width);
    const height = Math.max(Math.floor(viewportSize.height), MIN_STAGE_SIZE.height);
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.floor(width * dpr);
    const targetHeight = Math.floor(height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const artwork = artworkSizeRef.current;
    const visibleSurface = effectPresetRef.current === 'none' || isDrawingRef.current ? paintSurface : effectSurface;

    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, 'rgba(18, 31, 48, 0.96)');
    background.addColorStop(0.52, 'rgba(13, 17, 31, 0.98)');
    background.addColorStop(1, 'rgba(7, 10, 19, 1)');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(width * 0.12, height * 0.08, 0, width * 0.12, height * 0.08, width * 0.75);
    glow.addColorStop(0, 'rgba(96, 165, 250, 0.18)');
    glow.addColorStop(0.35, 'rgba(99, 102, 241, 0.07)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(148, 163, 184, 0.11)';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 36) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 36) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
    }

    context.drawImage(visibleSurface, 0, 0, artwork.width, artwork.height, 0, 0, width, height);
    context.restore();
  }, [viewportSize.height, viewportSize.width]);

  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current !== null) {
      return;
    }
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      renderCanvas();
    });
  }, [renderCanvas]);

  const applyEffectPass = useCallback((effectId: string, region: Rect | null) => {
    ensureSurfaces();
    const paintSurface = paintSurfaceRef.current;
    const paintContext = paintContextRef.current;
    const effectContext = effectContextRef.current;
    const artwork = artworkSizeRef.current;

    if (!paintSurface || !paintContext || !effectContext) {
      return;
    }

    const area = region ?? { x: 0, y: 0, width: artwork.width, height: artwork.height };
    if (effectId === 'none') {
      effectContext.clearRect(area.x, area.y, area.width, area.height);
      effectContext.drawImage(paintSurface, area.x, area.y, area.width, area.height, area.x, area.y, area.width, area.height);
      return;
    }

    const source = paintContext.getImageData(area.x, area.y, area.width, area.height);
    const target = effectContext.createImageData(area.width, area.height);
    const input = source.data;
    const output = target.data;
    const width = source.width;
    const height = source.height;
    const lightLength = Math.sqrt(0.28 * 0.28 + 0.45 * 0.45 + 0.85 * 0.85);
    const lightX = 0.28 / lightLength;
    const lightY = -0.45 / lightLength;
    const lightZ = 0.85 / lightLength;

    const sample = (sampleX: number, sampleY: number, channel: number) => {
      const x = clamp(Math.round(sampleX), 0, width - 1);
      const y = clamp(Math.round(sampleY), 0, height - 1);
      return input[(y * width + x) * 4 + channel] / 255;
    };

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const r = input[index] / 255;
        const g = input[index + 1] / 255;
        const b = input[index + 2] / 255;
        const a = input[index + 3] / 255;
        const nx = sample(x - 3, y, 3) - sample(x + 3, y, 3);
        const ny = sample(x, y - 3, 3) - sample(x, y + 3, 3);
        const nz = 0.75;
        const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const normalX = nx / normalLength;
        const normalY = ny / normalLength;
        const normalZ = nz / normalLength;
        const diffuse = clamp(normalX * lightX + normalY * lightY + normalZ * lightZ, 0, 1);
        const specular = Math.pow(diffuse, 18);

        let nextR = r;
        let nextG = g;
        let nextB = b;
        let nextA = a;

        if (effectId === 'sculpt') {
          const tintR = 0.5 + 0.5 * Math.cos(1.2 + diffuse * 4 - (y / Math.max(height, 1)) * 2.6);
          const tintG = 0.5 + 0.5 * Math.cos(2.1 + diffuse * 4 - (y / Math.max(height, 1)) * 2.2);
          const tintB = 0.5 + 0.5 * Math.cos(3.4 + diffuse * 4 - (y / Math.max(height, 1)) * 1.8);
          const rim = 1 - Math.abs(normalZ);
          nextR = clamp(r * (0.75 + diffuse * 0.5) + tintR * a * 0.18 + specular * 0.4 + rim * 0.08, 0, 1);
          nextG = clamp(g * (0.75 + diffuse * 0.5) + tintG * a * 0.18 + specular * 0.34 + rim * 0.08, 0, 1);
          nextB = clamp(b * (0.75 + diffuse * 0.5) + tintB * a * 0.18 + specular * 0.45 + rim * 0.1, 0, 1);
        } else if (effectId === 'flow') {
          const flowNoise = pseudoNoise((x + area.x) / 26, (y + area.y) / 26, 0.37) * Math.PI * 2;
          const offsetX = (normalX * 9 + Math.cos(flowNoise) * 4) * a;
          const offsetY = (normalY * 9 + Math.sin(flowNoise) * 4) * a;
          const sampleX = clamp(Math.round(x - offsetX), 0, width - 1);
          const sampleY = clamp(Math.round(y - offsetY), 0, height - 1);
          const smearIndex = (sampleY * width + sampleX) * 4;
          const wetness = clamp(a * 1.35, 0, 1);
          nextR = clamp(lerp(r, input[smearIndex] / 255, 0.58 * wetness) + diffuse * 0.08, 0, 1);
          nextG = clamp(lerp(g, input[smearIndex + 1] / 255, 0.58 * wetness) + diffuse * 0.08, 0, 1);
          nextB = clamp(lerp(b, input[smearIndex + 2] / 255, 0.58 * wetness) + diffuse * 0.12, 0, 1);
          nextA = clamp(a + wetness * 0.08, 0, 1);
        }

        output[index] = Math.round(nextR * 255);
        output[index + 1] = Math.round(nextG * 255);
        output[index + 2] = Math.round(nextB * 255);
        output[index + 3] = Math.round(nextA * 255);
      }
    }

    effectContext.putImageData(target, area.x, area.y);
  }, [ensureSurfaces]);

  const flushEffectPass = useCallback((options?: { full?: boolean; effectId?: string }) => {
    const dirtyRegion = consumeDirtyRect(Boolean(options?.full));
    if (!dirtyRegion) {
      scheduleRender();
      return;
    }
    applyEffectPass(options?.effectId ?? effectPresetRef.current, dirtyRegion);
    scheduleRender();
  }, [applyEffectPass, consumeDirtyRect, scheduleRender]);

  const queueEffectPass = useCallback((options?: { full?: boolean; immediate?: boolean; effectId?: string }) => {
    const artwork = artworkSizeRef.current;
    if (options?.full) {
      dirtyRectRef.current = { x: 0, y: 0, width: artwork.width, height: artwork.height };
    }
    if (options?.immediate) {
      flushEffectPass({ full: options.full, effectId: options.effectId });
      return;
    }
    if (effectFrameRef.current !== null) {
      return;
    }
    effectFrameRef.current = window.requestAnimationFrame(() => {
      effectFrameRef.current = null;
      flushEffectPass({ effectId: options?.effectId });
    });
  }, [flushEffectPass]);

  const clearArtwork = useCallback(() => {
    ensureSurfaces();
    const artwork = artworkSizeRef.current;
    paintContextRef.current?.clearRect(0, 0, artwork.width, artwork.height);
    effectContextRef.current?.clearRect(0, 0, artwork.width, artwork.height);
    dirtyRectRef.current = null;
    setSaveStatus({ kind: 'idle', message: 'Cleared.' });
    scheduleRender();
  }, [ensureSurfaces, scheduleRender]);

  const paintStamp = useCallback((point: Point, radius: number, opacityScale: number, seed: number) => {
    const context = paintContextRef.current;
    if (!context) {
      return;
    }

    const noise = activeBrush.stampNoise > 0 ? (pseudoNoise(point.x, point.y, seed) - 0.5) * activeBrush.stampNoise : 0;
    const jitterX = (pseudoNoise(point.x, point.y, seed + 1) - 0.5) * radius * activeBrush.scatter;
    const jitterY = (pseudoNoise(point.x, point.y, seed + 2) - 0.5) * radius * activeBrush.scatter;
    const actualRadius = Math.max(radius * (1 + noise), 0.5);

    context.save();
    context.globalCompositeOperation = activeBrush.blendMode;
    context.globalAlpha = clamp(activeBrush.opacity * opacityScale, 0.02, 1);

    const gradient = context.createRadialGradient(
      point.x + jitterX,
      point.y + jitterY,
      actualRadius * activeBrush.softness,
      point.x + jitterX,
      point.y + jitterY,
      actualRadius,
    );

    if (activeBrush.blendMode === 'destination-out') {
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      gradient.addColorStop(0, activeBrush.color);
      gradient.addColorStop(0.75, activeBrush.color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
    }

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(point.x + jitterX, point.y + jitterY, actualRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    markDirtyRect(point.x + jitterX, point.y + jitterY, actualRadius);
  }, [activeBrush, markDirtyRect]);

  const paintStrokeSegment = useCallback((start: Point, end: Point) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const spacing = Math.max(activeBrush.size * activeBrush.spacing, 1);
    const steps = Math.max(Math.ceil(distance / spacing), 1);

    for (let step = 0; step <= steps; step += 1) {
      const alpha = step / steps;
      const pressure = lerp(start.pressure, end.pressure, alpha);
      const radius = Math.max((activeBrush.size * clamp(pressure, 0.35, 1.4)) / 2, 0.5);
      paintStamp(
        { x: lerp(start.x, end.x, alpha), y: lerp(start.y, end.y, alpha), pressure, time: lerp(start.time, end.time, alpha) },
        radius,
        0.7 + pressure * 0.35 + activeBrush.flow * 0.2,
        step + start.time * 0.001,
      );
    }
  }, [activeBrush, paintStamp]);

  const getCanvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    const artwork = artworkSizeRef.current;
    return {
      x: clamp(((event.clientX - rect.left) / Math.max(rect.width, 1)) * artwork.width, 0, artwork.width),
      y: clamp(((event.clientY - rect.top) / Math.max(rect.height, 1)) * artwork.height, 0, artwork.height),
      pressure: clamp(event.pressure || 0.5, 0.15, 1.25),
      time: event.timeStamp,
    };
  }, []);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) {
      return;
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
    queueEffectPass();
  }, [queueEffectPass]);

  const startDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    ensureSurfaces();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    paintStrokeSegment(point, point);
    scheduleRender();
  }, [ensureSurfaces, getCanvasPoint, paintStrokeSegment, scheduleRender]);

  const continueDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) {
      return;
    }
    const point = getCanvasPoint(event);
    paintStrokeSegment(lastPointRef.current, point);
    lastPointRef.current = point;
    scheduleRender();
  }, [getCanvasPoint, paintStrokeSegment, scheduleRender]);

  const endDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    stopDrawing();
  }, [stopDrawing]);

  const saveSketch = useCallback(async () => {
    ensureSurfaces();
    flushEffectPass({ full: true, effectId: effectPresetId });

    const effectSurface = effectSurfaceRef.current;
    if (!effectSurface) {
      return;
    }

    setSaveStatus({ kind: 'saving', message: 'Saving...' });
    const artwork = artworkSizeRef.current;
    const savedAt = new Date().toISOString();
    const metadata: SketchMetadata = {
      savedAt,
      canvas: artwork,
      brushPreset: activeBrush.id,
      effectPreset: effectPresetId,
      strokeColor,
      brushSize,
      brushOpacity,
      storageRoot: api?.storage?.rootDir ?? null,
    };

    const blob = await new Promise<Blob | null>(resolve => effectSurface.toBlob(resolve, 'image/png'));
    if (!blob) {
      setSaveStatus({ kind: 'error', message: 'PNG export failed.' });
      return;
    }

    const safeStamp = savedAt.replace(/[:.]/g, '-');
    const imagePath = `sketches/${safeStamp}.png`;
    const metadataPath = `sketches/${safeStamp}.json`;

    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (!api?.storage) {
        throw new Error('Plugin storage API is unavailable.');
      }
      await api.storage.ensureDir('sketches');
      await api.storage.writeFile(imagePath, bytes);
      await api.storage.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2));
      setSaveStatus({ kind: 'success', message: `Saved to ${api.storage.rootDir}/sketches` });
      return;
    } catch (error) {
      const imageName = `${plugin.id}-${safeStamp}.png`;
      const metadataName = `${plugin.id}-${safeStamp}.json`;
      downloadBlob(blob, imageName);
      downloadBlob(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }), metadataName);
      setSaveStatus({
        kind: 'success',
        message: `Downloaded locally because plugin storage was unavailable (${String(error)}).`,
      });
    }
  }, [
    activeBrush.id,
    api?.storage,
    brushOpacity,
    brushSize,
    effectPresetId,
    ensureSurfaces,
    flushEffectPass,
    plugin.id,
    strokeColor,
  ]);

  useEffect(() => {
    effectPresetRef.current = effectPresetId;
  }, [effectPresetId]);

  useEffect(() => {
    ensureSurfaces();
    queueEffectPass({ full: true, immediate: true, effectId: effectPresetRef.current });
    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
      if (effectFrameRef.current !== null) {
        window.cancelAnimationFrame(effectFrameRef.current);
      }
    };
  }, [ensureSurfaces, queueEffectPass]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const sync = () => {
      const nextSize = normalizeSize({ width: Math.floor(stage.clientWidth), height: Math.floor(stage.clientHeight) });
      setViewportSize(current => current.width === nextSize.width && current.height === nextSize.height ? current : nextSize);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    syncArtworkSize(viewportSize);
    queueEffectPass({ full: true, effectId: effectPresetRef.current });
    scheduleRender();
  }, [queueEffectPass, scheduleRender, syncArtworkSize, viewportSize]);

  useEffect(() => {
    const preset = getFallbackBrush(brushPresetId);
    setBrushSize(preset.size);
    setBrushOpacity(preset.opacity);
    if (preset.id !== 'eraser') {
      setStrokeColor(current => current || preset.color);
    }
  }, [brushPresetId]);

  useEffect(() => {
    queueEffectPass({ full: true, effectId: effectPresetId });
  }, [effectPresetId, queueEffectPass]);

  useEffect(() => {
    scheduleRender();
  }, [scheduleRender]);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        color: 'var(--overlay-text-primary)',
        fontFamily: 'var(--overlay-font-ui)',
        background: 'linear-gradient(180deg, rgba(7, 10, 19, 0.92), rgba(5, 7, 14, 1))',
        isolation: 'isolate',
      }}
    >
      <div style={{ position: 'absolute', inset: '12px 12px auto 12px', zIndex: 3, pointerEvents: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            padding: isCompact ? '10px 10px' : '12px 12px',
            borderRadius: 16,
            border: '1px solid rgba(148, 163, 184, 0.18)',
            background: 'rgba(9, 13, 24, 0.82)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            <select aria-label="Brush preset" value={brushPresetId} onChange={event => setBrushPresetId(event.target.value)} style={{ borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.18)', background: 'rgba(255,255,255,0.04)', color: 'var(--overlay-text-primary)', padding: '8px 10px', minWidth: 92 }}>
              {BRUSH_PRESETS.map(brush => <option key={brush.id} value={brush.id}>{brush.label}</option>)}
            </select>
            <select aria-label="Effect preset" value={effectPresetId} onChange={event => setEffectPresetId(event.target.value)} style={{ borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.18)', background: 'rgba(255,255,255,0.04)', color: 'var(--overlay-text-primary)', padding: '8px 10px', minWidth: 104 }}>
              {EFFECT_PRESETS.map(effect => <option key={effect.id} value={effect.id}>{effect.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: muted }}>
              <span>Size</span>
              <input aria-label="Brush size" type="range" min="1" max="72" step="1" value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} style={{ width: isCompact ? 84 : 120 }} />
              <span style={{ minWidth: 24, textAlign: 'right', color: 'var(--overlay-text-primary)' }}>{brushSize}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: muted }}>
              <span>Op</span>
              <input aria-label="Brush opacity" type="range" min="0.05" max="1" step="0.01" value={brushOpacity} onChange={event => setBrushOpacity(Number(event.target.value))} style={{ width: isCompact ? 84 : 120 }} />
              <span style={{ minWidth: 32, textAlign: 'right', color: 'var(--overlay-text-primary)' }}>{Math.round(brushOpacity * 100)}%</span>
            </label>
            <input aria-label="Brush color" type="color" value={strokeColor} disabled={activeBrush.id === 'eraser'} onChange={event => setStrokeColor(event.target.value)} style={{ width: 34, height: 34, padding: 0, border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: 9, background: 'transparent' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {SWATCHES.map(color => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color} brush`}
                  onClick={() => setStrokeColor(color)}
                  disabled={activeBrush.id === 'eraser'}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: color === strokeColor ? '2px solid rgba(255,255,255,0.92)' : '1px solid rgba(255,255,255,0.28)',
                    background: color,
                    cursor: activeBrush.id === 'eraser' ? 'not-allowed' : 'pointer',
                    opacity: activeBrush.id === 'eraser' ? 0.4 : 1,
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={saveSketch} style={{ border: '1px solid rgba(196, 181, 253, 0.45)', background: 'rgba(196, 181, 253, 0.88)', color: '#140d1f', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Save</button>
            <button type="button" onClick={clearArtwork} style={{ border: '1px solid rgba(148, 163, 184, 0.18)', background: 'rgba(255,255,255,0.04)', color: 'var(--overlay-text-primary)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Clear</button>
          </div>
        </div>
      </div>

      <div ref={stageRef} style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={endDrawing} onPointerCancel={endDrawing} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: activeBrush.id === 'eraser' ? 'cell' : 'crosshair' }} />
      </div>

      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 'min(70vw, 540px)', padding: '8px 10px', borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(7, 10, 19, 0.72)', color: saveStatus.kind === 'error' ? '#fca5a5' : muted, fontSize: 11, backdropFilter: 'blur(14px)' }}>
          <span>{saveStatus.message}</span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.16)', background: 'rgba(7, 10, 19, 0.72)', color: muted, fontSize: 11, backdropFilter: 'blur(14px)' }}>
          <span>{artworkSizeRef.current.width}x{artworkSizeRef.current.height}</span>
          <span>{activeBrush.label}</span>
          <span>{currentEffect.label}</span>
        </div>
      </div>
    </div>
  );
}

export default definePlugin({
  id: 'drawable-canvas',
  name: 'Drawable Canvas',
  description: 'Full-tab paint stage with host-scaled resolution and plugin-local saves.',
  component: CanvasPad,
});
