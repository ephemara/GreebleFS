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

type OverlayPluginApi = {
  fs?: {
    BaseDirectory?: Record<string, unknown>;
    mkdir?: (path: string, options?: Record<string, unknown>) => Promise<void>;
    writeFile?: (path: string, data: Uint8Array, options?: Record<string, unknown>) => Promise<void>;
    writeTextFile?: (path: string, data: string, options?: Record<string, unknown>) => Promise<void>;
  };
};

type OverlayAppearance = {
  theme: {
    palette?: {
      accent?: string;
    };
  };
};

type PluginProps = {
  api?: OverlayPluginApi;
  appearance: OverlayAppearance;
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
  artworkScale: number;
};

const ARTBOARD_SIZE: Size = { width: 1600, height: 900 };
const MIN_VIEWPORT_SIZE: Size = { width: 320, height: 240 };

const SWATCHES = ['#f8fafc', '#7dd3fc', '#34d399', '#f97316', '#f472b6', '#facc15', '#60a5fa'];

const BRUSH_PRESETS: BrushPreset[] = [
  {
    id: 'ink',
    label: 'Ink',
    color: '#7dd3fc',
    size: 5,
    opacity: 0.95,
    softness: 0.16,
    spacing: 0.18,
    scatter: 0.02,
    flow: 0.2,
    blendMode: 'source-over',
    stampNoise: 0.04,
  },
  {
    id: 'marker',
    label: 'Marker',
    color: '#34d399',
    size: 18,
    opacity: 0.22,
    softness: 0.46,
    spacing: 0.1,
    scatter: 0.05,
    flow: 0.4,
    blendMode: 'source-over',
    stampNoise: 0.08,
  },
  {
    id: 'paint',
    label: 'Paint',
    color: '#f97316',
    size: 28,
    opacity: 0.17,
    softness: 0.72,
    spacing: 0.08,
    scatter: 0.12,
    flow: 0.78,
    blendMode: 'source-over',
    stampNoise: 0.18,
  },
  {
    id: 'eraser',
    label: 'Eraser',
    color: '#ffffff',
    size: 30,
    opacity: 0.8,
    softness: 0.78,
    spacing: 0.08,
    scatter: 0,
    flow: 0,
    blendMode: 'destination-out',
    stampNoise: 0,
  },
];

const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'none', label: 'Flat', description: 'Direct paint surface with no post-processing.' },
  { id: 'sculpt', label: 'Sculpt', description: 'Adds relief lighting, specular response, and tint.' },
  { id: 'flow', label: 'Flow', description: 'Pushes paint along gradients for a wetter, smeared look.' },
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

function createSurface(size: Size): HTMLCanvasElement {
  const surface = document.createElement('canvas');
  surface.width = size.width;
  surface.height = size.height;
  return surface;
}

function getFallbackBrush(id: string): BrushPreset {
  return BRUSH_PRESETS.find(brush => brush.id === id) ?? BRUSH_PRESETS[0];
}

function getEffectPreset(id: string): EffectPreset {
  return EFFECT_PRESETS.find(effect => effect.id === id) ?? EFFECT_PRESETS[0];
}

function getContainTransform(viewport: Size, artwork: Size, padding = 24) {
  const safeWidth = Math.max(viewport.width - padding * 2, 1);
  const safeHeight = Math.max(viewport.height - padding * 2, 1);
  const scale = Math.min(safeWidth / artwork.width, safeHeight / artwork.height);
  const scaledWidth = artwork.width * scale;
  const scaledHeight = artwork.height * scale;
  return {
    scale,
    drawWidth: scaledWidth,
    drawHeight: scaledHeight,
    offsetX: (viewport.width - scaledWidth) / 2,
    offsetY: (viewport.height - scaledHeight) / 2,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CanvasPad({ api, appearance }: PluginProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paintSurfaceRef = useRef<HTMLCanvasElement | null>(null);
  const effectSurfaceRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const isDrawingRef = useRef(false);
  const renderFrameRef = useRef<number | null>(null);

  const [viewportSize, setViewportSize] = useState<Size>({ width: 920, height: 540 });
  const [brushPresetId, setBrushPresetId] = useState(BRUSH_PRESETS[0].id);
  const [effectPresetId, setEffectPresetId] = useState(EFFECT_PRESETS[1].id);
  const [strokeColor, setStrokeColor] = useState(appearance.theme.palette?.accent ?? BRUSH_PRESETS[0].color);
  const [brushSize, setBrushSize] = useState(BRUSH_PRESETS[0].size);
  const [brushOpacity, setBrushOpacity] = useState(BRUSH_PRESETS[0].opacity);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle', message: 'Not saved yet.' });

  const activeBrush = useMemo(() => {
    const preset = getFallbackBrush(brushPresetId);
    return {
      ...preset,
      color: preset.id === 'eraser' ? preset.color : strokeColor,
      size: brushSize,
      opacity: brushOpacity,
    };
  }, [brushOpacity, brushPresetId, brushSize, strokeColor]);

  const viewTransform = useMemo(
    () => getContainTransform(viewportSize, ARTBOARD_SIZE),
    [viewportSize],
  );

  const ensureSurfaces = useCallback(() => {
    if (!paintSurfaceRef.current) {
      paintSurfaceRef.current = createSurface(ARTBOARD_SIZE);
    }
    if (!effectSurfaceRef.current) {
      effectSurfaceRef.current = createSurface(ARTBOARD_SIZE);
    }
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const paintSurface = paintSurfaceRef.current;
    const effectSurface = effectSurfaceRef.current;
    if (!canvas || !paintSurface || !effectSurface) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(Math.floor(viewportSize.width), MIN_VIEWPORT_SIZE.width);
    const height = Math.max(Math.floor(viewportSize.height), MIN_VIEWPORT_SIZE.height);

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(125, 211, 252, 0.12)');
    gradient.addColorStop(0.45, 'rgba(15, 23, 42, 0.05)');
    gradient.addColorStop(1, 'rgba(248, 250, 252, 0.02)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(255,255,255,0.08)';
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 32) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 32) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
    }

    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.22)';
    context.shadowBlur = 30;
    context.shadowOffsetY = 18;
    context.fillStyle = 'rgba(255,255,255,0.035)';
    context.fillRect(
      viewTransform.offsetX,
      viewTransform.offsetY,
      viewTransform.drawWidth,
      viewTransform.drawHeight,
    );
    context.restore();

    context.drawImage(
      effectSurface,
      0,
      0,
      ARTBOARD_SIZE.width,
      ARTBOARD_SIZE.height,
      viewTransform.offsetX,
      viewTransform.offsetY,
      viewTransform.drawWidth,
      viewTransform.drawHeight,
    );

    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 1;
    context.strokeRect(
      viewTransform.offsetX + 0.5,
      viewTransform.offsetY + 0.5,
      Math.max(viewTransform.drawWidth - 1, 0),
      Math.max(viewTransform.drawHeight - 1, 0),
    );
    context.restore();
  }, [viewTransform, viewportSize.height, viewportSize.width]);

  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current !== null) {
      return;
    }
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      renderCanvas();
    });
  }, [renderCanvas]);

  const applyEffectPass = useCallback((effectId: string) => {
    const paintSurface = paintSurfaceRef.current;
    const effectSurface = effectSurfaceRef.current;
    if (!paintSurface || !effectSurface) {
      return;
    }

    const sourceContext = paintSurface.getContext('2d', { willReadFrequently: true });
    const targetContext = effectSurface.getContext('2d', { willReadFrequently: true });
    if (!sourceContext || !targetContext) {
      return;
    }

    const source = sourceContext.getImageData(0, 0, ARTBOARD_SIZE.width, ARTBOARD_SIZE.height);
    const target = targetContext.createImageData(source.width, source.height);
    const input = source.data;
    const output = target.data;
    const width = source.width;
    const height = source.height;

    const sampleAlpha = (x: number, y: number) => {
      const clampedX = clamp(Math.round(x), 0, width - 1);
      const clampedY = clamp(Math.round(y), 0, height - 1);
      return input[(clampedY * width + clampedX) * 4 + 3] / 255;
    };

    const sampleChannel = (x: number, y: number, offset: number) => {
      const clampedX = clamp(Math.round(x), 0, width - 1);
      const clampedY = clamp(Math.round(y), 0, height - 1);
      return input[(clampedY * width + clampedX) * 4 + offset] / 255;
    };

    for (let index = 0; index < input.length; index += 4) {
      const pixel = index / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const r = input[index] / 255;
      const g = input[index + 1] / 255;
      const b = input[index + 2] / 255;
      const a = input[index + 3] / 255;

      if (effectId === 'none') {
        output[index] = input[index];
        output[index + 1] = input[index + 1];
        output[index + 2] = input[index + 2];
        output[index + 3] = input[index + 3];
        continue;
      }

      const left = sampleAlpha(x - 3, y);
      const right = sampleAlpha(x + 3, y);
      const top = sampleAlpha(x, y - 3);
      const bottom = sampleAlpha(x, y + 3);

      const nx = left - right;
      const ny = top - bottom;
      const nz = 0.75;
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const normalX = nx / length;
      const normalY = ny / length;
      const normalZ = nz / length;

      const lightLength = Math.sqrt(0.28 * 0.28 + 0.45 * 0.45 + 0.85 * 0.85);
      const lightX = 0.28 / lightLength;
      const lightY = -0.45 / lightLength;
      const lightZ = 0.85 / lightLength;

      const diffuse = clamp(normalX * lightX + normalY * lightY + normalZ * lightZ, 0, 1);
      const specular = Math.pow(clamp(diffuse, 0, 1), 18);

      let nextR = r;
      let nextG = g;
      let nextB = b;
      let nextA = a;

      if (effectId === 'sculpt') {
        const tintR = 0.5 + 0.5 * Math.cos(1.2 + diffuse * 4.0 - (y / height) * 2.6);
        const tintG = 0.5 + 0.5 * Math.cos(2.1 + diffuse * 4.0 - (y / height) * 2.2);
        const tintB = 0.5 + 0.5 * Math.cos(3.4 + diffuse * 4.0 - (y / height) * 1.8);
        const rim = 1 - Math.abs(normalZ);
        nextR = clamp(r * (0.75 + diffuse * 0.5) + tintR * a * 0.18 + specular * 0.4 + rim * 0.08, 0, 1);
        nextG = clamp(g * (0.75 + diffuse * 0.5) + tintG * a * 0.18 + specular * 0.34 + rim * 0.08, 0, 1);
        nextB = clamp(b * (0.75 + diffuse * 0.5) + tintB * a * 0.18 + specular * 0.45 + rim * 0.1, 0, 1);
      } else if (effectId === 'flow') {
        const flowNoise = pseudoNoise(x / 26, y / 26, 0.37) * Math.PI * 2;
        const offsetX = (normalX * 9 + Math.cos(flowNoise) * 4) * a;
        const offsetY = (normalY * 9 + Math.sin(flowNoise) * 4) * a;
        const smearR = sampleChannel(x - offsetX, y - offsetY, 0);
        const smearG = sampleChannel(x - offsetX, y - offsetY, 1);
        const smearB = sampleChannel(x - offsetX, y - offsetY, 2);
        const wetness = clamp(a * 1.35, 0, 1);
        nextR = clamp(lerp(r, smearR, 0.58 * wetness) + diffuse * 0.08, 0, 1);
        nextG = clamp(lerp(g, smearG, 0.58 * wetness) + diffuse * 0.08, 0, 1);
        nextB = clamp(lerp(b, smearB, 0.58 * wetness) + diffuse * 0.12, 0, 1);
        nextA = clamp(a + wetness * 0.08, 0, 1);
      }

      output[index] = Math.round(nextR * 255);
      output[index + 1] = Math.round(nextG * 255);
      output[index + 2] = Math.round(nextB * 255);
      output[index + 3] = Math.round(nextA * 255);
    }

    targetContext.putImageData(target, 0, 0);
  }, []);

  const refreshPresentation = useCallback((effectId?: string) => {
    applyEffectPass(effectId ?? effectPresetId);
    scheduleRender();
  }, [applyEffectPass, effectPresetId, scheduleRender]);

  const clearArtwork = useCallback(() => {
    const paintSurface = paintSurfaceRef.current;
    if (!paintSurface) {
      return;
    }
    const context = paintSurface.getContext('2d');
    if (!context) {
      return;
    }
    context.clearRect(0, 0, paintSurface.width, paintSurface.height);
    refreshPresentation();
  }, [refreshPresentation]);

  const paintStamp = useCallback((point: Point, radius: number, opacityScale: number, seed: number) => {
    const paintSurface = paintSurfaceRef.current;
    const brush = activeBrush;
    if (!paintSurface) {
      return;
    }

    const context = paintSurface.getContext('2d');
    if (!context) {
      return;
    }

    const noise = brush.stampNoise > 0 ? (pseudoNoise(point.x, point.y, seed) - 0.5) * brush.stampNoise : 0;
    const jitterX = (pseudoNoise(point.x, point.y, seed + 1) - 0.5) * radius * brush.scatter;
    const jitterY = (pseudoNoise(point.x, point.y, seed + 2) - 0.5) * radius * brush.scatter;
    const actualRadius = Math.max(radius * (1 + noise), 0.5);

    context.save();
    context.globalCompositeOperation = brush.blendMode;
    context.globalAlpha = clamp(brush.opacity * opacityScale, 0.02, 1);

    const gradient = context.createRadialGradient(
      point.x + jitterX,
      point.y + jitterY,
      actualRadius * brush.softness,
      point.x + jitterX,
      point.y + jitterY,
      actualRadius,
    );

    if (brush.blendMode === 'destination-out') {
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      gradient.addColorStop(0, brush.color);
      gradient.addColorStop(0.75, brush.color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
    }

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(point.x + jitterX, point.y + jitterY, actualRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }, [activeBrush]);

  const paintStrokeSegment = useCallback((start: Point, end: Point) => {
    const brush = activeBrush;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const spacing = Math.max(brush.size * brush.spacing, 1);
    const steps = Math.max(Math.ceil(distance / spacing), 1);

    for (let step = 0; step <= steps; step += 1) {
      const alpha = steps === 0 ? 0 : step / steps;
      const pressure = lerp(start.pressure, end.pressure, alpha);
      const radius = Math.max((brush.size * clamp(pressure, 0.35, 1.4)) / 2, 0.5);
      const point: Point = {
        x: lerp(start.x, end.x, alpha),
        y: lerp(start.y, end.y, alpha),
        pressure,
        time: lerp(start.time, end.time, alpha),
      };
      const opacityScale = 0.7 + pressure * 0.35 + brush.flow * 0.2;
      paintStamp(point, radius, opacityScale, step + start.time * 0.001);
    }
  }, [activeBrush, paintStamp]);

  const getCanvasPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const withinArtworkX = clamp((x - viewTransform.offsetX) / Math.max(viewTransform.scale, 0.0001), 0, ARTBOARD_SIZE.width);
    const withinArtworkY = clamp((y - viewTransform.offsetY) / Math.max(viewTransform.scale, 0.0001), 0, ARTBOARD_SIZE.height);

    return {
      x: withinArtworkX,
      y: withinArtworkY,
      pressure: clamp(event.pressure || 0.5, 0.15, 1.25),
      time: event.timeStamp,
    };
  }, [viewTransform.offsetX, viewTransform.offsetY, viewTransform.scale]);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    refreshPresentation();
  }, [refreshPresentation]);

  const startDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    paintStrokeSegment(point, point);
    scheduleRender();
  }, [getCanvasPoint, paintStrokeSegment, scheduleRender]);

  const continueDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) {
      return;
    }
    const point = getCanvasPoint(event);
    paintStrokeSegment(lastPointRef.current, point);
    lastPointRef.current = point;
    scheduleRender();
  }, [getCanvasPoint, paintStrokeSegment, scheduleRender]);

  const saveSketch = useCallback(async () => {
    const effectSurface = effectSurfaceRef.current;
    if (!effectSurface) {
      return;
    }

    setSaveStatus({ kind: 'saving', message: 'Saving sketch...' });

    const metadata: SketchMetadata = {
      savedAt: new Date().toISOString(),
      canvas: ARTBOARD_SIZE,
      brushPreset: activeBrush.id,
      effectPreset: effectPresetId,
      strokeColor,
      brushSize,
      brushOpacity,
      artworkScale: viewTransform.scale,
    };

    const blob = await new Promise<Blob | null>(resolve => effectSurface.toBlob(resolve, 'image/png'));
    if (!blob) {
      setSaveStatus({ kind: 'error', message: 'PNG export failed.' });
      return;
    }

    const safeStamp = metadata.savedAt.replace(/[:.]/g, '-');
    const imageName = `drawable-canvas-${safeStamp}.png`;
    const metadataName = `drawable-canvas-${safeStamp}.json`;

    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const baseDir = api?.fs?.BaseDirectory as Record<string, unknown> | undefined;
      const appLocalData = baseDir?.AppLocalData;
      const mkdir = api?.fs?.mkdir;
      const writeFile = api?.fs?.writeFile;
      const writeTextFile = api?.fs?.writeTextFile;

      if (!appLocalData || !mkdir || !writeFile || !writeTextFile) {
        throw new Error('Plugin filesystem API is unavailable.');
      }

      const directory = 'overlayterm/sketches/drawable-canvas';
      await mkdir(directory, { baseDir: appLocalData, recursive: true });
      await writeFile(`${directory}/${imageName}`, bytes, { baseDir: appLocalData });
      await writeTextFile(`${directory}/${metadataName}`, JSON.stringify(metadata, null, 2), { baseDir: appLocalData });
      setSaveStatus({
        kind: 'success',
        message: `Saved ${imageName} to app-local sketch storage.`,
      });
    } catch (error) {
      downloadBlob(blob, imageName);
      downloadBlob(
        new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }),
        metadataName,
      );
      setSaveStatus({
        kind: 'success',
        message: `Downloaded ${imageName}; app-local save was unavailable (${String(error)}).`,
      });
    }
  }, [activeBrush.id, api, brushOpacity, brushSize, effectPresetId, strokeColor, viewTransform.scale]);

  useEffect(() => {
    ensureSurfaces();
    refreshPresentation('sculpt');

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
      }
    };
  }, [ensureSurfaces, refreshPresentation]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const syncViewport = () => {
      setViewportSize({
        width: Math.max(Math.floor(container.clientWidth), MIN_VIEWPORT_SIZE.width),
        height: Math.max(Math.floor(container.clientHeight), MIN_VIEWPORT_SIZE.height),
      });
    };

    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preset = getFallbackBrush(brushPresetId);
    setBrushSize(preset.size);
    setBrushOpacity(preset.opacity);
    if (preset.id !== 'eraser') {
      setStrokeColor(previous => previous || preset.color);
    }
  }, [brushPresetId]);

  useEffect(() => {
    refreshPresentation();
  }, [effectPresetId, refreshPresentation, viewportSize]);

  const currentEffect = getEffectPreset(effectPresetId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100%',
        color: 'var(--overlay-text-primary)',
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 14px',
          borderRadius: 16,
          border: '1px solid var(--overlay-border)',
          background: 'var(--overlay-bg-panel)',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Canvas Pad</div>
          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)', marginTop: 4, maxWidth: 520 }}>
            Paint on a fixed artboard that always scales to stay fully inside the OverlayTerm viewport.
            Pressure, soft brushes, effect passes, and sketch saving are built in now.
          </div>
          <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)', marginTop: 6 }}>
            Artwork {ARTBOARD_SIZE.width}x{ARTBOARD_SIZE.height} · View fit {Math.round(viewTransform.scale * 100)}%
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Tool
            <select
              value={brushPresetId}
              onChange={event => setBrushPresetId(event.target.value)}
              style={{
                borderRadius: 10,
                border: '1px solid var(--overlay-border)',
                background: 'var(--overlay-bg-card)',
                color: 'var(--overlay-text-primary)',
                padding: '8px 10px',
              }}
            >
              {BRUSH_PRESETS.map(brush => (
                <option key={brush.id} value={brush.id}>
                  {brush.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Shader
            <select
              value={effectPresetId}
              onChange={event => setEffectPresetId(event.target.value)}
              style={{
                borderRadius: 10,
                border: '1px solid var(--overlay-border)',
                background: 'var(--overlay-bg-card)',
                color: 'var(--overlay-text-primary)',
                padding: '8px 10px',
              }}
            >
              {EFFECT_PRESETS.map(effect => (
                <option key={effect.id} value={effect.id}>
                  {effect.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Color
            <input
              aria-label="Brush color"
              type="color"
              value={strokeColor}
              disabled={activeBrush.id === 'eraser'}
              onChange={event => setStrokeColor(event.target.value)}
              style={{
                width: 34,
                height: 34,
                padding: 0,
                border: '1px solid var(--overlay-border)',
                borderRadius: 8,
                background: 'transparent',
              }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {SWATCHES.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color} brush`}
                onClick={() => setStrokeColor(color)}
                disabled={activeBrush.id === 'eraser'}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: color === strokeColor
                    ? '2px solid var(--overlay-accent)'
                    : '1px solid rgba(255,255,255,0.18)',
                  background: color,
                  cursor: activeBrush.id === 'eraser' ? 'not-allowed' : 'pointer',
                  opacity: activeBrush.id === 'eraser' ? 0.45 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 16,
          border: '1px solid var(--overlay-border)',
          background: 'var(--overlay-bg-panel)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          Brush Size
          <input
            aria-label="Brush size"
            type="range"
            min="1"
            max="72"
            step="1"
            value={brushSize}
            onChange={event => setBrushSize(Number(event.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 28, textAlign: 'right' }}>{brushSize}</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          Opacity
          <input
            aria-label="Brush opacity"
            type="range"
            min="0.05"
            max="1"
            step="0.01"
            value={brushOpacity}
            onChange={event => setBrushOpacity(Number(event.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 38, textAlign: 'right' }}>{Math.round(brushOpacity * 100)}%</span>
        </label>

        <div style={{ fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Effect</div>
          <div style={{ color: 'var(--overlay-text-muted)' }}>{currentEffect.description}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={saveSketch}
            style={{
              border: '1px solid var(--overlay-border)',
              background: 'var(--overlay-accent, #38bdf8)',
              color: '#04131d',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Save Sketch
          </button>
          <button
            type="button"
            onClick={clearArtwork}
            style={{
              border: '1px solid var(--overlay-border)',
              background: 'var(--overlay-bg-card)',
              color: 'var(--overlay-text-primary)',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: saveStatus.kind === 'error' ? '#fca5a5' : 'var(--overlay-text-muted)' }}>
        {saveStatus.message}
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          minHeight: 420,
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--overlay-border)',
          background: [
            'radial-gradient(circle at top left, rgba(125,211,252,0.14), transparent 38%)',
            'linear-gradient(180deg, rgba(15,23,42,0.12), rgba(15,23,42,0.02))',
            'var(--overlay-bg-app)',
          ].join(', '),
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            touchAction: 'none',
            cursor: activeBrush.id === 'eraser' ? 'cell' : 'crosshair',
          }}
        />
      </div>
    </div>
  );
}

export default definePlugin({
  id: 'drawable-canvas',
  name: 'Drawable Canvas',
  description: 'Viewport-fitted artboard with shader-style paint effects and sketch saving.',
  component: CanvasPad,
});
