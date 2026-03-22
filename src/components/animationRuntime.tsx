import React, { type CSSProperties } from 'react';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as LucideReact from 'lucide-react';
import type { OverlayThemeDefinition } from '../config/appearance';
import { animationSystemConfig } from '../config/animations';
import {
  getOverlayAnimationStyle,
  getOverlayEffectStyle,
  overlayAnimationPresets,
  type OverlayAnimationDirection,
  type OverlayAnimationPhase,
  type OverlayAnimationPreset,
  type OverlayAnimationVerticalOrigin,
} from '../config/overlayAnimations';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';

export interface AnimationFileEntry extends RuntimeFileEntry {}

export type OverlayAnimationSource = 'built-in' | 'folder';

export interface OverlayAnimationContext {
  id: string;
  name: string;
  filePath: string;
  animationRoot: string;
  source: OverlayAnimationSource;
}

export interface OverlayAnimationRenderContext {
  animation: OverlayAnimationContext;
  phase: OverlayAnimationPhase;
  direction: OverlayAnimationDirection;
  progress: number;
  durationMs: number;
  baseOpacity: number;
  intensity: number;
  verticalOrigin: OverlayAnimationVerticalOrigin;
  accentColor: string;
  blurStrength: number;
  zoom: number;
  theme: OverlayThemeDefinition;
  viewport: {
    width: number;
    height: number;
    anchoredTo: OverlayAnimationVerticalOrigin;
  };
}

export interface OverlayAnimationOverlayProps {
  context: OverlayAnimationRenderContext;
}

export interface OverlayAnimationVariantDefinition {
  durationMs?: number;
  resolveShellStyle?: (context: OverlayAnimationRenderContext) => CSSProperties | null | undefined;
  renderOverlay?: React.ComponentType<OverlayAnimationOverlayProps>;
}

export interface OverlayAnimationDefinition {
  id?: string;
  name?: string;
  description?: string;
  group?: string;
  tags?: string[];
  open?: OverlayAnimationVariantDefinition;
  close?: OverlayAnimationVariantDefinition;
}

export interface LoadedOverlayAnimation extends OverlayAnimationContext {
  modified: number;
  description?: string;
  group: string;
  tags: string[];
  open: OverlayAnimationVariantDefinition | null;
  close: OverlayAnimationVariantDefinition | null;
  error: string | null;
}

export interface LoadAnimationFromSourceOptions {
  context?: Partial<OverlayAnimationContext>;
}

export function defineAnimation(definition: OverlayAnimationDefinition): OverlayAnimationDefinition {
  return definition;
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function lerp(from: number, to: number, progress: number): number {
  return from + ((to - from) * clamp01(progress));
}

export function useAnimationContextRef<T>(value: T): React.MutableRefObject<T> {
  const ref = React.useRef(value);
  ref.current = value;
  return ref;
}

export function isFrontendAnimationFile(entry: AnimationFileEntry): boolean {
  return isSupportedRuntimeFile(entry, animationSystemConfig.frontendExtensions);
}

export function deriveAnimationId(name: string): string {
  return deriveRuntimeModuleId(name, 'animation');
}

export function deriveAnimationName(name: string): string {
  return deriveRuntimeModuleName(name, 'Animation');
}

export async function loadAnimationFromSource(
  source: string,
  entry: AnimationFileEntry,
  options?: LoadAnimationFromSourceOptions,
): Promise<LoadedOverlayAnimation> {
  const defaultId = deriveAnimationId(entry.name);
  const defaultName = deriveAnimationName(entry.name);
  const context: OverlayAnimationContext = {
    id: options?.context?.id ?? defaultId,
    name: options?.context?.name ?? defaultName,
    filePath: options?.context?.filePath ?? entry.path,
    animationRoot: options?.context?.animationRoot ?? animationSystemConfig.animationsDirectory,
    source: options?.context?.source ?? 'folder',
  };

  try {
    const transpiled = await transpileRuntimeModuleSource(source, `const React = require('react');\n`);
    const exported = executeAnimationModule(transpiled);
    const normalized = normalizeAnimationExport(exported, context);
    return {
      ...context,
      id: normalized.id ?? context.id,
      name: normalized.name ?? context.name,
      modified: entry.modified,
      description: normalized.description,
      group: normalized.group?.trim() || 'Custom',
      tags: normalized.tags ?? [],
      open: normalized.open ?? null,
      close: normalized.close ?? null,
      error: null,
    };
  } catch (error) {
    return {
      ...context,
      modified: entry.modified,
      description: undefined,
      group: 'Custom',
      tags: [],
      open: null,
      close: null,
      error: String(error),
    };
  }
}

export function createBuiltInOverlayAnimations(): LoadedOverlayAnimation[] {
  return overlayAnimationPresets.map(preset => ({
    id: preset.id,
    name: preset.label,
    filePath: `builtin:${preset.id}`,
    animationRoot: 'builtin',
    source: 'built-in',
    modified: 0,
    description: preset.description,
    group: preset.group === 'effect' ? 'Built-in FX' : 'Built-in Motion',
    tags: ['builtin', preset.group],
    open: createBuiltInAnimationVariant(preset),
    close: createBuiltInAnimationVariant(preset),
    error: null,
  }));
}

export function mergeOverlayAnimations(
  builtInAnimations: LoadedOverlayAnimation[],
  authoredAnimations: LoadedOverlayAnimation[],
): LoadedOverlayAnimation[] {
  const byId = new Map<string, LoadedOverlayAnimation>(
    builtInAnimations.map(animation => [animation.id, animation]),
  );

  for (const animation of authoredAnimations) {
    if (animation.error) {
      continue;
    }

    const existing = byId.get(animation.id);
    if (existing) {
      byId.set(animation.id, {
        ...existing,
        ...animation,
        open: animation.open ?? existing.open,
        close: animation.close ?? existing.close,
        tags: Array.from(new Set([...existing.tags, ...animation.tags])),
      });
      continue;
    }

    byId.set(animation.id, animation);
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === 'folder' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function resolveAnimationVariant(
  animation: LoadedOverlayAnimation,
  direction: OverlayAnimationDirection,
): OverlayAnimationVariantDefinition | null {
  return direction === 'enter' ? animation.open : animation.close;
}

export function resolveAnimationDurationMs(
  animation: LoadedOverlayAnimation | null,
  direction: OverlayAnimationDirection,
  fallbackDurationMs: number,
): number {
  const variant = animation ? resolveAnimationVariant(animation, direction) : null;
  return typeof variant?.durationMs === 'number' && Number.isFinite(variant.durationMs)
    ? Math.max(1, Math.round(variant.durationMs))
    : fallbackDurationMs;
}

export function resolveAnimationShellStyle(
  animation: LoadedOverlayAnimation | null,
  context: OverlayAnimationRenderContext,
): CSSProperties {
  const variant = animation ? resolveAnimationVariant(animation, context.direction) : null;
  if (!variant?.resolveShellStyle) {
    return {};
  }

  try {
    return variant.resolveShellStyle(context) ?? {};
  } catch (error) {
    console.warn('OverlayTerm: animation shell style failed', animation?.name, error);
    return {};
  }
}

export function AnimationOverlayLayer({
  animation,
  context,
}: {
  animation: LoadedOverlayAnimation | null;
  context: OverlayAnimationRenderContext;
}) {
  const variant = animation ? resolveAnimationVariant(animation, context.direction) : null;
  const OverlayComponent = variant?.renderOverlay;
  if (!OverlayComponent) {
    return null;
  }

  return (
    <AnimationOverlayBoundary animationName={animation?.name ?? 'Animation'}>
      <OverlayComponent context={context} />
    </AnimationOverlayBoundary>
  );
}

function createBuiltInAnimationVariant(
  preset: OverlayAnimationPreset,
): OverlayAnimationVariantDefinition {
  const BuiltInEffectLayer = ({ context }: OverlayAnimationOverlayProps) => {
    const style = getOverlayEffectStyle({
      phase: context.phase,
      direction: context.direction,
      presetId: preset.id,
      durationMs: context.durationMs,
      intensity: context.intensity,
      accentColor: context.accentColor,
      verticalOrigin: context.verticalOrigin,
    });

    return style ? <div aria-hidden style={style} /> : null;
  };

  return {
    resolveShellStyle: context => getOverlayAnimationStyle({
      phase: context.phase,
      direction: context.direction,
      presetId: preset.id,
      baseOpacity: context.baseOpacity,
      intensity: context.intensity,
      durationMs: context.durationMs,
      verticalOrigin: context.verticalOrigin,
    }),
    renderOverlay: BuiltInEffectLayer,
  };
}

function executeAnimationModule(code: string): unknown {
  const allowedModules: Record<string, unknown> = {
    react: React,
    'lucide-react': LucideReact,
    '@tauri-apps/api/core': TauriCore,
    '@tauri-apps/api/event': TauriEvent,
    '@tauri-apps/api/window': TauriWindow,
    '@tauri-apps/plugin-fs': TauriFs,
    [animationSystemConfig.runtimeModuleName]: {
      defineAnimation,
      clamp01,
      lerp,
      useAnimationContextRef,
    },
  };

  return executeRuntimeModule(code, allowedModules);
}

function normalizeAnimationExport(
  exported: unknown,
  fallbackContext: OverlayAnimationContext,
): OverlayAnimationDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, ['animation']);
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Animation must export defineAnimation({ open, close }) or a plain definition object.');
  }

  const definition = candidate as OverlayAnimationDefinition;
  const open = normalizeVariant(definition.open, 'open');
  const close = normalizeVariant(definition.close, 'close');
  if (!open && !close) {
    throw new Error('Animation must provide at least one of `open` or `close`.');
  }

  return {
    ...definition,
    id: definition.id?.trim() || fallbackContext.id,
    name: definition.name?.trim() || fallbackContext.name,
    group: definition.group?.trim() || 'Custom',
    tags: Array.isArray(definition.tags)
      ? definition.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [],
    open: open ?? undefined,
    close: close ?? undefined,
  };
}

function normalizeVariant(
  variant: OverlayAnimationVariantDefinition | undefined,
  label: 'open' | 'close',
): OverlayAnimationVariantDefinition | null {
  if (!variant) {
    return null;
  }

  if (variant.resolveShellStyle && typeof variant.resolveShellStyle !== 'function') {
    throw new Error(`Animation ${label} variant must provide a function for resolveShellStyle.`);
  }

  if (variant.renderOverlay && typeof variant.renderOverlay !== 'function') {
    throw new Error(`Animation ${label} variant must provide a React component for renderOverlay.`);
  }

  if (variant.durationMs != null && (!Number.isFinite(variant.durationMs) || variant.durationMs <= 0)) {
    throw new Error(`Animation ${label} variant duration must be a positive number.`);
  }

  return variant;
}

class AnimationOverlayBoundary extends React.Component<
  { animationName: string; children: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { animationName: string; children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn(`OverlayTerm: animation overlay "${this.props.animationName}" threw`, error);
  }

  override componentDidUpdate(prevProps: { animationName: string }) {
    if (prevProps.animationName !== this.props.animationName && this.state.failed) {
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
