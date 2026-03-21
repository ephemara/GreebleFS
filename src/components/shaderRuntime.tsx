import React, { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as LucideReact from 'lucide-react';
import type { OverlayThemeDefinition } from '../config/appearance';
import {
  shaderSystemConfig,
  type OverlayShaderSurfaceId,
} from '../config/shaders';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';

export interface ShaderFileEntry extends RuntimeFileEntry {}

export type OverlayShaderSource = 'built-in' | 'folder';

export interface OverlayShaderContext {
  id: string;
  name: string;
  filePath: string;
  shaderRoot: string;
  source: OverlayShaderSource;
}

export interface OverlayShaderUniformMap {
  [key: string]: unknown;
}

export interface OverlayShaderControlDefinition {
  id: string;
  label: string;
  description?: string;
  type?: 'slider';
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  formatValue?: (value: number) => string;
}

export interface OverlayShaderShellContext extends OverlayShaderContext {
  viewport: {
    width: number;
    height: number;
  };
  accentColor: string;
  theme: OverlayThemeDefinition;
  panelTransparency: number;
  blurStrength: number;
  zoom: number;
  isSettingsActive: boolean;
  shaderControlValues: Record<string, number>;
}

export interface OverlayShaderRenderContext extends OverlayShaderShellContext {
  surface: OverlayShaderSurfaceId;
  sharedUniforms: OverlayShaderUniformMap;
}

export interface OverlayShaderSurfaceProps {
  context: OverlayShaderRenderContext;
}

export interface OverlayShaderSurfaceDefinition {
  resolveStyle?: (context: OverlayShaderRenderContext) => CSSProperties | null | undefined;
  render?: React.ComponentType<OverlayShaderSurfaceProps>;
}

export interface OverlayShaderDefinition {
  id?: string;
  name?: string;
  description?: string;
  group?: string;
  tags?: string[];
  controls?: OverlayShaderControlDefinition[];
  resolveSharedUniforms?: (
    context: OverlayShaderShellContext,
  ) => OverlayShaderUniformMap | null | undefined;
  background?: OverlayShaderSurfaceDefinition;
  topBar?: OverlayShaderSurfaceDefinition;
  border?: OverlayShaderSurfaceDefinition;
}

export interface LoadedOverlayShader extends OverlayShaderContext {
  modified: number;
  description?: string;
  group: string;
  tags: string[];
  controls: OverlayShaderControlDefinition[];
  resolveSharedUniforms?: OverlayShaderDefinition['resolveSharedUniforms'];
  background: OverlayShaderSurfaceDefinition | null;
  topBar: OverlayShaderSurfaceDefinition | null;
  border: OverlayShaderSurfaceDefinition | null;
  error: string | null;
}

export function defineShader(definition: OverlayShaderDefinition): OverlayShaderDefinition {
  return definition;
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function lerp(from: number, to: number, progress: number): number {
  return from + ((to - from) * clamp01(progress));
}

export function isFrontendShaderFile(entry: ShaderFileEntry): boolean {
  return isSupportedRuntimeFile(entry, shaderSystemConfig.frontendExtensions);
}

export function deriveShaderId(name: string): string {
  return deriveRuntimeModuleId(name, 'shader');
}

export function deriveShaderName(name: string): string {
  return deriveRuntimeModuleName(name, 'Shader');
}

export async function loadShaderFromSource(
  source: string,
  entry: ShaderFileEntry,
): Promise<LoadedOverlayShader> {
  const context: OverlayShaderContext = {
    id: deriveShaderId(entry.name),
    name: deriveShaderName(entry.name),
    filePath: entry.path,
    shaderRoot: shaderSystemConfig.shadersDirectory,
    source: 'folder',
  };

  try {
    const transpiled = await transpileRuntimeModuleSource(source, `const React = require('react');\n`);
    const exported = executeShaderModule(transpiled);
    const normalized = normalizeShaderExport(exported, context);
    return {
      ...context,
      id: normalized.id ?? context.id,
      name: normalized.name ?? context.name,
      modified: entry.modified,
      description: normalized.description,
      group: normalized.group?.trim() || 'Custom',
      tags: normalized.tags ?? [],
      controls: normalized.controls ?? [],
      resolveSharedUniforms: normalized.resolveSharedUniforms,
      background: normalized.background ?? null,
      topBar: normalized.topBar ?? null,
      border: normalized.border ?? null,
      error: null,
    };
  } catch (error) {
    return {
      ...context,
      modified: entry.modified,
      description: undefined,
      group: 'Custom',
      tags: [],
      controls: [],
      resolveSharedUniforms: undefined,
      background: null,
      topBar: null,
      border: null,
      error: String(error),
    };
  }
}

export function createBuiltInOverlayShaders(): LoadedOverlayShader[] {
  return [
    createBuiltInShader({
      id: shaderSystemConfig.fallbackShaderId,
      name: 'None',
      description: 'Disable shell shaders and render only the base theme.',
      group: 'Core',
      tags: ['builtin', 'safe'],
    }),
    createBuiltInShader({
      id: 'nebula-flow',
      name: 'Nebula Flow',
      description: 'Soft volumetric glows drift across the full shell with chrome shimmer and accent rails.',
      group: 'Built-in Atmosphere',
      tags: ['builtin', 'nebula', 'gradient'],
      controls: [
        {
          id: 'accentAlpha',
          label: 'Glow Alpha',
          description: 'Boost or soften the main volumetric nebula bloom.',
          min: 0.2,
          max: 1,
          step: 0.02,
        },
        {
          id: 'accentLift',
          label: 'Glow Lift',
          description: 'Adjust how much the blur and chrome shimmer push forward.',
          min: 0,
          max: 0.75,
          step: 0.01,
        },
      ],
      resolveSharedUniforms: context => ({
        accentAlpha: context.isSettingsActive ? 0.9 : 0.74,
        accentLift: 0.24 + clamp01(context.blurStrength / 32) * 0.28,
      }),
      background: {
        render: NebulaBackgroundSurface,
      },
      topBar: {
        render: TopBarNebulaSurface,
      },
      border: {
        render: AccentRailSurface,
      },
    }),
    createBuiltInShader({
      id: 'hologram-grid',
      name: 'Hologram Grid',
      description: 'Animated scanlines and wireframe grid treatment for shell surfaces.',
      group: 'Built-in Atmosphere',
      tags: ['builtin', 'grid', 'scanline', 'hologram'],
      background: {
        render: GridCanvasSurface,
      },
      topBar: {
        render: TopBarGridSurface,
      },
      border: {
        render: BorderGridSurface,
      },
    }),
    createBuiltInShader({
      id: 'prism-wave',
      name: 'Prism Wave',
      description: 'Glassy spectral ribbons and glossy bar highlights with a stronger chrome mood.',
      group: 'Built-in Atmosphere',
      tags: ['builtin', 'prism', 'glass', 'spectrum'],
      background: {
        render: PrismBackgroundSurface,
      },
      topBar: {
        render: PrismTopBarSurface,
      },
      border: {
        render: PrismBorderSurface,
      },
    }),
  ];
}

export function mergeOverlayShaders(
  builtInShaders: LoadedOverlayShader[],
  authoredShaders: LoadedOverlayShader[],
): LoadedOverlayShader[] {
  const byId = new Map<string, LoadedOverlayShader>(
    builtInShaders.map(shader => [shader.id, shader]),
  );

  for (const shader of authoredShaders) {
    if (shader.error) {
      continue;
    }

    const existing = byId.get(shader.id);
    if (existing) {
      byId.set(shader.id, {
        ...existing,
        ...shader,
        controls: shader.controls.length > 0 ? shader.controls : existing.controls,
        resolveSharedUniforms: shader.resolveSharedUniforms ?? existing.resolveSharedUniforms,
        background: shader.background ?? existing.background,
        topBar: shader.topBar ?? existing.topBar,
        border: shader.border ?? existing.border,
        tags: Array.from(new Set([...existing.tags, ...shader.tags])),
      });
      continue;
    }

    byId.set(shader.id, shader);
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'folder' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function resolveShaderComputedUniforms(
  shader: LoadedOverlayShader | null,
  shellContext: OverlayShaderShellContext,
): OverlayShaderUniformMap {
  if (!shader?.resolveSharedUniforms) {
    return {};
  }

  try {
    return shader.resolveSharedUniforms(shellContext) ?? {};
  } catch (error) {
    console.warn('OverlayTerm: shader shared uniform resolver failed', shader.name, error);
    return {};
  }
}

function getStepPrecision(step: number): number {
  const normalizedStep = Number.isFinite(step) && step > 0 ? step : 1;
  const decimalSegment = `${normalizedStep}`.split('.')[1];
  return decimalSegment ? decimalSegment.length : 0;
}

export function normalizeShaderControlValue(
  control: OverlayShaderControlDefinition,
  value: number,
  fallbackValue?: number,
): number {
  const lowerBound = Math.min(control.min, control.max);
  const upperBound = Math.max(control.min, control.max);
  const step = Number.isFinite(control.step) && control.step > 0 ? control.step : 1;
  const fallback = Number.isFinite(fallbackValue)
    ? fallbackValue as number
    : Number.isFinite(control.defaultValue)
      ? control.defaultValue as number
      : lowerBound;
  const raw = Number.isFinite(value) ? value : fallback;
  const clamped = Math.min(Math.max(raw, lowerBound), upperBound);
  const snapped = lowerBound + (Math.round((clamped - lowerBound) / step) * step);
  const precision = getStepPrecision(step);
  return Number(snapped.toFixed(precision));
}

export function resolveShaderControlValues(
  shader: LoadedOverlayShader | null,
  persistedValues?: Record<string, number> | null,
  computedUniforms?: OverlayShaderUniformMap,
): Record<string, number> {
  if (!shader || shader.controls.length === 0) {
    return {};
  }

  return Object.fromEntries(shader.controls.map(control => {
    const persistedValue = persistedValues?.[control.id];
    const computedValue = computedUniforms?.[control.id];
    const fallbackValue = typeof computedValue === 'number'
      ? computedValue
      : control.defaultValue;
    const resolvedValue = normalizeShaderControlValue(
      control,
      typeof persistedValue === 'number' ? persistedValue : Number.NaN,
      fallbackValue,
    );
    return [control.id, resolvedValue];
  }));
}

export function resolveShaderSharedUniforms(
  shader: LoadedOverlayShader | null,
  shellContext: OverlayShaderShellContext,
): OverlayShaderUniformMap {
  const computedUniforms = resolveShaderComputedUniforms(shader, shellContext);
  const controlValues = resolveShaderControlValues(
    shader,
    shellContext.shaderControlValues,
    computedUniforms,
  );
  return {
    ...computedUniforms,
    ...controlValues,
  };
}

export function buildShaderRenderContext(args: {
  shader: LoadedOverlayShader | null;
  shellContext: OverlayShaderShellContext;
  surface: OverlayShaderSurfaceId;
}): OverlayShaderRenderContext {
  return {
    ...args.shellContext,
    surface: args.surface,
    sharedUniforms: resolveShaderSharedUniforms(args.shader, args.shellContext),
  };
}

export function resolveShaderSurfaceStyle(
  shader: LoadedOverlayShader | null,
  context: OverlayShaderRenderContext,
): CSSProperties {
  const surfaceDefinition = shader?.[context.surface];
  if (!surfaceDefinition?.resolveStyle) {
    return {};
  }

  try {
    return surfaceDefinition.resolveStyle(context) ?? {};
  } catch (error) {
    console.warn(
      `OverlayTerm: shader surface style failed for ${shader?.name ?? 'Shader'} (${context.surface})`,
      error,
    );
    return {};
  }
}

export function ShaderSurfaceLayer({
  shader,
  shellContext,
  surface,
  style,
}: {
  shader: LoadedOverlayShader | null;
  shellContext: OverlayShaderShellContext;
  surface: OverlayShaderSurfaceId;
  style?: CSSProperties;
}) {
  const context = useMemo(
    () => buildShaderRenderContext({ shader, shellContext, surface }),
    [shader, shellContext, surface],
  );
  const surfaceDefinition = shader?.[surface] ?? null;
  const surfaceStyle = resolveShaderSurfaceStyle(shader, context);
  const SurfaceComponent = surfaceDefinition?.render;

  if (!surfaceDefinition || (!SurfaceComponent && Object.keys(surfaceStyle).length === 0)) {
    return null;
  }

  return (
    <ShaderSurfaceBoundary shaderName={shader?.name ?? 'Shader'} surface={surface}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          ...style,
          ...surfaceStyle,
        }}
      >
        {SurfaceComponent ? <SurfaceComponent context={context} /> : null}
      </div>
    </ShaderSurfaceBoundary>
  );
}

function createBuiltInShader(definition: OverlayShaderDefinition & { id: string; name: string }): LoadedOverlayShader {
  return {
    id: definition.id,
    name: definition.name,
    filePath: `builtin:${definition.id}`,
    shaderRoot: 'builtin',
    source: 'built-in',
    modified: 0,
    description: definition.description,
    group: definition.group?.trim() || 'Built-in',
    tags: definition.tags ?? ['builtin'],
    controls: definition.controls ?? [],
    resolveSharedUniforms: definition.resolveSharedUniforms,
    background: definition.background ?? null,
    topBar: definition.topBar ?? null,
    border: definition.border ?? null,
    error: null,
  };
}

function executeShaderModule(code: string): unknown {
  const allowedModules: Record<string, unknown> = {
    react: React,
    'lucide-react': LucideReact,
    '@tauri-apps/api/core': TauriCore,
    '@tauri-apps/api/event': TauriEvent,
    '@tauri-apps/api/window': TauriWindow,
    '@tauri-apps/plugin-fs': TauriFs,
    [shaderSystemConfig.runtimeModuleName]: {
      defineShader,
      clamp01,
      lerp,
    },
  };

  return executeRuntimeModule(code, allowedModules);
}

function normalizeShaderExport(
  exported: unknown,
  fallbackContext: OverlayShaderContext,
): OverlayShaderDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, ['shader']);
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Shader must export defineShader({ ... }) or a plain definition object.');
  }

  const definition = candidate as OverlayShaderDefinition;
  const background = normalizeSurfaceDefinition(definition.background, 'background');
  const topBar = normalizeSurfaceDefinition(definition.topBar, 'topBar');
  const border = normalizeSurfaceDefinition(definition.border, 'border');
  const controls = normalizeControlDefinitions(definition.controls);

  if (!background && !topBar && !border) {
    throw new Error('Shader must provide at least one of `background`, `topBar`, or `border`.');
  }

  if (
    definition.resolveSharedUniforms
    && typeof definition.resolveSharedUniforms !== 'function'
  ) {
    throw new Error('Shader `resolveSharedUniforms` must be a function when provided.');
  }

  return {
    ...definition,
    id: definition.id?.trim() || fallbackContext.id,
    name: definition.name?.trim() || fallbackContext.name,
    group: definition.group?.trim() || 'Custom',
    tags: Array.isArray(definition.tags)
      ? definition.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [],
    controls,
    background: background ?? undefined,
    topBar: topBar ?? undefined,
    border: border ?? undefined,
  };
}

function normalizeControlDefinitions(
  controls: OverlayShaderControlDefinition[] | undefined,
): OverlayShaderControlDefinition[] {
  if (!Array.isArray(controls)) {
    return [];
  }

  return controls.map(control => normalizeControlDefinition(control));
}

function normalizeControlDefinition(control: OverlayShaderControlDefinition): OverlayShaderControlDefinition {
  if (!control || typeof control !== 'object') {
    throw new Error('Shader controls must be objects.');
  }

  const id = typeof control.id === 'string' ? control.id.trim() : '';
  const label = typeof control.label === 'string' ? control.label.trim() : '';
  if (!id) {
    throw new Error('Shader controls must provide a non-empty `id`.');
  }
  if (!label) {
    throw new Error(`Shader control "${id}" must provide a non-empty \`label\`.`);
  }
  if (!Number.isFinite(control.min) || !Number.isFinite(control.max)) {
    throw new Error(`Shader control "${id}" must provide finite min/max values.`);
  }
  if (!Number.isFinite(control.step) || control.step <= 0) {
    throw new Error(`Shader control "${id}" must provide a positive numeric step.`);
  }
  if (control.formatValue && typeof control.formatValue !== 'function') {
    throw new Error(`Shader control "${id}" formatValue must be a function when provided.`);
  }

  return {
    id,
    label,
    description: typeof control.description === 'string' && control.description.trim()
      ? control.description.trim()
      : undefined,
    type: 'slider',
    min: Math.min(control.min, control.max),
    max: Math.max(control.min, control.max),
    step: control.step,
    defaultValue: Number.isFinite(control.defaultValue)
      ? normalizeShaderControlValue({
        ...control,
        id,
        label,
        type: 'slider',
        min: Math.min(control.min, control.max),
        max: Math.max(control.min, control.max),
        step: control.step,
      }, control.defaultValue as number)
      : undefined,
    formatValue: control.formatValue,
  };
}

function normalizeSurfaceDefinition(
  surface: OverlayShaderSurfaceDefinition | undefined,
  label: OverlayShaderSurfaceId,
): OverlayShaderSurfaceDefinition | null {
  if (!surface) {
    return null;
  }

  if (surface.resolveStyle && typeof surface.resolveStyle !== 'function') {
    throw new Error(`Shader ${label} surface must provide a function for resolveStyle.`);
  }

  if (surface.render && typeof surface.render !== 'function') {
    throw new Error(`Shader ${label} surface must provide a React component for render.`);
  }

  if (!surface.resolveStyle && !surface.render) {
    throw new Error(`Shader ${label} surface must provide resolveStyle, render, or both.`);
  }

  return surface;
}

function useAnimationClock(speed = 1): number {
  const [time, setTime] = useState(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      setTime(now * 0.001 * speedRef.current);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return time;
}

function NebulaBackgroundSurface({ context }: OverlayShaderSurfaceProps) {
  const time = useAnimationClock(0.9);
  const accentAlpha = Number(context.sharedUniforms.accentAlpha ?? 0.72);
  const accentLift = Number(context.sharedUniforms.accentLift ?? 0.28);

  return (
    <div style={{ position: 'absolute', inset: '-12%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          background: [
            `radial-gradient(circle at ${40 + Math.sin(time * 0.5) * 16}% ${34 + Math.cos(time * 0.35) * 12}%, ${context.accentColor}${Math.round(accentAlpha * 255).toString(16).padStart(2, '0')} 0%, transparent 28%)`,
            'radial-gradient(circle at 76% 22%, rgba(255,255,255,0.14) 0%, transparent 18%)',
            'radial-gradient(circle at 18% 76%, rgba(56,189,248,0.18) 0%, transparent 24%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.45}px) saturate(${1.08 + accentLift})`,
          transform: `scale(${1.02 + Math.sin(time * 0.22) * 0.02}) rotate(${Math.sin(time * 0.16) * 3}deg)`,
          opacity: 0.82,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0))',
          mixBlendMode: 'screen',
          opacity: 0.42 + Math.sin(time * 0.9) * 0.06,
        }}
      />
    </div>
  );
}

function TopBarNebulaSurface({ context }: OverlayShaderSurfaceProps) {
  const time = useAnimationClock(1.4);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-25% 0',
          background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}18 30%, rgba(255,255,255,0.18) 50%, ${context.accentColor}14 72%, transparent 100%)`,
          transform: `translateX(${Math.sin(time * 0.8) * 18}%) skewX(${Math.sin(time * 0.45) * 8}deg)`,
          opacity: 0.78,
          filter: 'blur(10px)',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function AccentRailSurface({ context }: OverlayShaderSurfaceProps) {
  const time = useAnimationClock(1.1);
  const railOpacity = 0.38 + Math.sin(time * 1.6) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {[
        { inset: '0 0 auto 0', height: 2, width: '100%' },
        { inset: 'auto 0 0 0', height: 2, width: '100%' },
        { inset: '0 auto 0 0', height: '100%', width: 2 },
        { inset: '0 0 0 auto', height: '100%', width: 2 },
      ].map((rail, index) => (
        <div
          key={`rail-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.width,
            height: rail.height,
            background: index < 2
              ? `linear-gradient(90deg, transparent 0%, ${context.accentColor} 18%, rgba(255,255,255,0.95) 50%, ${context.accentColor} 82%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, ${context.accentColor} 18%, rgba(255,255,255,0.95) 50%, ${context.accentColor} 82%, transparent 100%)`,
            opacity: railOpacity,
            boxShadow: `0 0 14px ${context.accentColor}66`,
          }}
        />
      ))}
    </div>
  );
}

function GridCanvasSurface({ context }: OverlayShaderSurfaceProps) {
  return <CanvasGridRenderer context={context} density={34} opacity={0.55} />;
}

function TopBarGridSurface({ context }: OverlayShaderSurfaceProps) {
  return <CanvasGridRenderer context={context} density={18} opacity={0.32} />;
}

function BorderGridSurface({ context }: OverlayShaderSurfaceProps) {
  return <CanvasGridRenderer context={context} density={12} opacity={0.26} />;
}

function CanvasGridRenderer({
  context,
  density,
  opacity,
}: {
  context: OverlayShaderRenderContext;
  density: number;
  opacity: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let frame = 0;
    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const time = now * 0.001;
      const verticalStep = Math.max(8, canvas.clientHeight / density);
      const horizontalStep = Math.max(12, canvas.clientWidth / density);
      ctx.lineWidth = context.surface === 'border' ? 1.4 : 1;
      ctx.strokeStyle = `${context.accentColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
      ctx.globalCompositeOperation = 'screen';

      for (let y = -verticalStep; y <= canvas.clientHeight + verticalStep; y += verticalStep) {
        const drift = Math.sin(time * 1.2 + y * 0.04) * 8;
        ctx.beginPath();
        ctx.moveTo(0, y + drift);
        ctx.lineTo(canvas.clientWidth, y - drift);
        ctx.stroke();
      }

      for (let x = -horizontalStep; x <= canvas.clientWidth + horizontalStep; x += horizontalStep) {
        const drift = Math.cos(time * 1.05 + x * 0.03) * 6;
        ctx.beginPath();
        ctx.moveTo(x + drift, 0);
        ctx.lineTo(x - drift, canvas.clientHeight);
        ctx.stroke();
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.surface, density, opacity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: context.isSettingsActive ? opacity + 0.08 : opacity,
      }}
    />
  );
}

function PrismBackgroundSurface({ context }: OverlayShaderSurfaceProps) {
  const time = useAnimationClock(0.7);

  return (
    <div style={{ position: 'absolute', inset: '-14%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `conic-gradient(from ${time * 28}deg at 50% 50%, rgba(255,255,255,0.12), ${context.accentColor}22, rgba(59,130,246,0.16), rgba(255,255,255,0.08), ${context.accentColor}18)`,
            'radial-gradient(circle at 24% 18%, rgba(255,255,255,0.18), transparent 24%)',
          ].join(', '),
          mixBlendMode: 'screen',
          filter: `blur(${16 + context.blurStrength * 0.3}px) saturate(1.2)`,
          transform: `rotate(${Math.sin(time * 0.25) * 10}deg) scale(${1.04 + Math.cos(time * 0.2) * 0.04})`,
          opacity: 0.72,
        }}
      />
    </div>
  );
}

function PrismTopBarSurface({ context }: OverlayShaderSurfaceProps) {
  const time = useAnimationClock(1.2);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 28%, ${context.accentColor}1f 50%, rgba(255,255,255,0.14) 72%, transparent 100%)`,
        transform: `translateX(${Math.sin(time * 0.6) * 14}%)`,
        opacity: 0.78,
        filter: 'blur(8px)',
        mixBlendMode: 'screen',
      }}
    />
  );
}

function PrismBorderSurface({ context }: OverlayShaderSurfaceProps) {
  const time = useAnimationClock(1.8);
  const opacity = 0.34 + Math.cos(time * 1.8) * 0.08;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        border: `1px solid ${context.accentColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${context.accentColor}33`,
      }}
    />
  );
}

class ShaderSurfaceBoundary extends React.Component<
  { shaderName: string; surface: OverlayShaderSurfaceId; children: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { shaderName: string; surface: OverlayShaderSurfaceId; children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn(
      `OverlayTerm: shader surface "${this.props.shaderName}" (${this.props.surface}) threw`,
      error,
    );
  }

  override componentDidUpdate(prevProps: { shaderName: string; surface: OverlayShaderSurfaceId }) {
    if (
      (prevProps.shaderName !== this.props.shaderName || prevProps.surface !== this.props.surface)
      && this.state.failed
    ) {
      this.setState({ failed: false });
    }
  }

  override render() {
    if (this.state.failed) {
      return null;
    }

    return this.props.children;
  }
}
