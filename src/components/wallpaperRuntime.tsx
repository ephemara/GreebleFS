import React, { type CSSProperties } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as LucideReact from 'lucide-react';
import * as THREE from 'three';
import type { OverlayThemeDefinition } from '../config/appearance';
import {
  normalizeOverlayWallpaperFitMode,
  wallpaperSystemConfig,
  type OverlayWallpaperFitMode,
} from '../config/wallpapers';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';

export interface WallpaperFileEntry extends RuntimeFileEntry {}

export type OverlayWallpaperSource = 'folder' | 'theme-asset';
export type OverlayWallpaperKind = 'image' | 'video' | 'live';

export interface OverlayWallpaperContext {
  id: string;
  name: string;
  filePath: string;
  wallpaperRoot: string;
  source: OverlayWallpaperSource;
  kind: OverlayWallpaperKind;
  assetUrl?: string;
  previewUrl?: string;
}

export interface OverlayWallpaperRenderContext {
  wallpaper: OverlayWallpaperContext;
  theme: OverlayThemeDefinition;
  viewport: {
    width: number;
    height: number;
  };
  fitMode: OverlayWallpaperFitMode;
  opacity: number;
  muted: boolean;
  motionEnabled: boolean;
}

export interface OverlayWallpaperBackgroundProps {
  context: OverlayWallpaperRenderContext;
}

export interface OverlayWallpaperDefinition {
  id?: string;
  name?: string;
  description?: string;
  group?: string;
  tags?: string[];
  previewUrl?: string;
  renderBackground: React.ComponentType<OverlayWallpaperBackgroundProps>;
}

export interface LoadedOverlayWallpaper extends OverlayWallpaperContext {
  modified: number;
  description?: string;
  group: string;
  tags: string[];
  renderBackground: React.ComponentType<OverlayWallpaperBackgroundProps> | null;
  error: string | null;
}

export interface LoadWallpaperFromSourceOptions {
  context?: Partial<OverlayWallpaperContext>;
}

export interface ResolvedWallpaperSelection {
  wallpaper: LoadedOverlayWallpaper | null;
  source: 'theme' | 'user' | 'none';
  effectiveId: string | null;
}

const imageExtensions = new Set<string>(wallpaperSystemConfig.imageExtensions);
const videoExtensions = new Set<string>(wallpaperSystemConfig.videoExtensions);

export function defineWallpaper(definition: OverlayWallpaperDefinition): OverlayWallpaperDefinition {
  return definition;
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function lerp(from: number, to: number, progress: number): number {
  return from + ((to - from) * clamp01(progress));
}

export function useWallpaperContextRef<T>(value: T): React.MutableRefObject<T> {
  const ref = React.useRef(value);
  ref.current = value;
  return ref;
}

export function isFrontendWallpaperFile(entry: WallpaperFileEntry): boolean {
  return isSupportedRuntimeFile(entry, wallpaperSystemConfig.frontendExtensions);
}

export function isMediaWallpaperFile(entry: WallpaperFileEntry): boolean {
  if (entry.is_dir) {
    return false;
  }

  const extension = entry.extension.toLowerCase();
  return imageExtensions.has(extension) || videoExtensions.has(extension);
}

export function isSupportedWallpaperFile(entry: WallpaperFileEntry): boolean {
  return isFrontendWallpaperFile(entry) || isMediaWallpaperFile(entry);
}

export function deriveWallpaperId(name: string): string {
  return deriveRuntimeModuleId(name, 'wallpaper');
}

export function deriveWallpaperName(name: string): string {
  return deriveRuntimeModuleName(name, 'Wallpaper');
}

export function getOverlayWallpaperKindLabel(kind: OverlayWallpaperKind): string {
  if (kind === 'video') {
    return 'Video';
  }
  if (kind === 'live') {
    return 'Live';
  }
  return 'Image';
}

export function resolveWallpaperAssetUrl(filePath: string): string {
  try {
    return convertFileSrc(filePath);
  } catch {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`;
  }
}

function detectWallpaperKindFromExtension(extension: string): OverlayWallpaperKind {
  const normalized = extension.replace(/^\./, '').toLowerCase();
  if (videoExtensions.has(normalized)) {
    return 'video';
  }
  return 'image';
}

function getFitObjectStyle(fitMode: OverlayWallpaperFitMode): CSSProperties['objectFit'] {
  return fitMode === 'fill' ? 'fill' : fitMode;
}

const ImageWallpaperBackground = ({ context }: OverlayWallpaperBackgroundProps) => {
  if (!context.wallpaper.assetUrl) {
    return null;
  }

  return (
    <img
      alt=""
      aria-hidden
      draggable={false}
      src={context.wallpaper.assetUrl}
      style={{
        width: '100%',
        height: '100%',
        objectFit: getFitObjectStyle(context.fitMode),
        opacity: clamp01(context.opacity),
        userSelect: 'none',
      }}
    />
  );
};

const VideoWallpaperBackground = ({ context }: OverlayWallpaperBackgroundProps) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!context.motionEnabled) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => undefined);
    }
  }, [context.motionEnabled, context.wallpaper.assetUrl]);

  if (!context.wallpaper.assetUrl) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      aria-hidden
      autoPlay={context.motionEnabled}
      loop
      muted={context.muted}
      playsInline
      preload="auto"
      src={context.wallpaper.assetUrl}
      style={{
        width: '100%',
        height: '100%',
        objectFit: getFitObjectStyle(context.fitMode),
        opacity: clamp01(context.opacity),
      }}
    />
  );
};

export async function loadWallpaperFromSource(
  source: string,
  entry: WallpaperFileEntry,
  options?: LoadWallpaperFromSourceOptions,
): Promise<LoadedOverlayWallpaper> {
  const defaultId = deriveWallpaperId(entry.name);
  const defaultName = deriveWallpaperName(entry.name);
  const context: OverlayWallpaperContext = {
    id: options?.context?.id ?? defaultId,
    name: options?.context?.name ?? defaultName,
    filePath: options?.context?.filePath ?? entry.path,
    wallpaperRoot: options?.context?.wallpaperRoot ?? wallpaperSystemConfig.wallpapersDirectory,
    source: options?.context?.source ?? 'folder',
    kind: options?.context?.kind ?? 'live',
    assetUrl: options?.context?.assetUrl,
    previewUrl: options?.context?.previewUrl,
  };

  try {
    const transpiled = await transpileRuntimeModuleSource(source, 'const React = require(\'react\');\n');
    const exported = executeWallpaperModule(transpiled);
    const normalized = normalizeWallpaperExport(exported, context);
    return {
      ...context,
      id: normalized.id ?? context.id,
      name: normalized.name ?? context.name,
      modified: entry.modified,
      description: normalized.description,
      group: normalized.group?.trim() || 'Custom Live',
      tags: normalized.tags ?? [],
      previewUrl: normalized.previewUrl ?? context.previewUrl,
      renderBackground: normalized.renderBackground,
      error: null,
    };
  } catch (error) {
    return {
      ...context,
      modified: entry.modified,
      description: undefined,
      group: 'Custom Live',
      tags: [],
      renderBackground: null,
      error: String(error),
    };
  }
}

export function createMediaWallpaperFromFile(
  entry: WallpaperFileEntry,
  options?: LoadWallpaperFromSourceOptions,
): LoadedOverlayWallpaper {
  const kind = detectWallpaperKindFromExtension(entry.extension);
  const context: OverlayWallpaperContext = {
    id: options?.context?.id ?? deriveWallpaperId(entry.name),
    name: options?.context?.name ?? deriveWallpaperName(entry.name),
    filePath: options?.context?.filePath ?? entry.path,
    wallpaperRoot: options?.context?.wallpaperRoot ?? wallpaperSystemConfig.wallpapersDirectory,
    source: options?.context?.source ?? 'folder',
    kind,
    assetUrl: options?.context?.assetUrl ?? resolveWallpaperAssetUrl(entry.path),
    previewUrl: options?.context?.previewUrl ?? (kind === 'image' ? resolveWallpaperAssetUrl(entry.path) : undefined),
  };

  return {
    ...context,
    modified: entry.modified,
    description: kind === 'video'
      ? 'Imported animated wallpaper media.'
      : 'Imported wallpaper image.',
    group: kind === 'video' ? 'Imported Video' : 'Imported Image',
    tags: ['imported', kind],
    renderBackground: kind === 'video' ? VideoWallpaperBackground : ImageWallpaperBackground,
    error: null,
  };
}

export function createThemeAssetWallpaper(args: {
  themeId: string;
  themeName: string;
  assetUrl: string;
  filePath?: string;
}): LoadedOverlayWallpaper {
  const detectedPath = args.filePath ?? args.assetUrl;
  const extension = detectedPath.split('.').pop() ?? '';
  const kind = detectWallpaperKindFromExtension(extension);
  return {
    id: `theme:${args.themeId}`,
    name: `${args.themeName} Wallpaper`,
    filePath: args.filePath ?? args.assetUrl,
    wallpaperRoot: 'theme',
    source: 'theme-asset',
    kind,
    assetUrl: args.assetUrl,
    previewUrl: kind === 'image' ? args.assetUrl : undefined,
    modified: 0,
    description: 'Wallpaper provided by the active theme package.',
    group: 'Theme Asset',
    tags: ['theme', kind],
    renderBackground: kind === 'video' ? VideoWallpaperBackground : ImageWallpaperBackground,
    error: null,
  };
}

export function resolveActiveWallpaper(args: {
  availableWallpapers: Iterable<LoadedOverlayWallpaper>;
  userOverrideId?: string | null;
  themeWallpaper?: LoadedOverlayWallpaper | null;
}): ResolvedWallpaperSelection {
  const availableById = new Map(Array.from(args.availableWallpapers).map(wallpaper => [wallpaper.id, wallpaper] as const));
  const trimmedOverride = typeof args.userOverrideId === 'string' ? args.userOverrideId.trim() : args.userOverrideId;

  if (!trimmedOverride) {
    return args.themeWallpaper
      ? { wallpaper: args.themeWallpaper, source: 'theme', effectiveId: args.themeWallpaper.id }
      : { wallpaper: null, source: 'none', effectiveId: null };
  }

  if (trimmedOverride === wallpaperSystemConfig.noneWallpaperId) {
    return { wallpaper: null, source: 'none', effectiveId: trimmedOverride };
  }

  const selectedWallpaper = availableById.get(trimmedOverride);
  if (selectedWallpaper) {
    return { wallpaper: selectedWallpaper, source: 'user', effectiveId: selectedWallpaper.id };
  }

  return args.themeWallpaper
    ? { wallpaper: args.themeWallpaper, source: 'theme', effectiveId: args.themeWallpaper.id }
    : { wallpaper: null, source: 'none', effectiveId: null };
}

export const WallpaperBackgroundLayer = React.memo(function WallpaperBackgroundLayer({
  wallpaper,
  context,
}: {
  wallpaper: LoadedOverlayWallpaper | null;
  context: OverlayWallpaperRenderContext;
}) {
  const BackgroundComponent = wallpaper?.renderBackground;
  if (!wallpaper || !BackgroundComponent) {
    return null;
  }

  return (
    <WallpaperBackgroundBoundary wallpaperName={wallpaper.name}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <BackgroundComponent context={context} />
      </div>
    </WallpaperBackgroundBoundary>
  );
});

function executeWallpaperModule(code: string): unknown {
  const allowedModules: Record<string, unknown> = {
    react: React,
    three: THREE,
    'lucide-react': LucideReact,
    '@tauri-apps/api/core': TauriCore,
    '@tauri-apps/api/event': TauriEvent,
    '@tauri-apps/api/window': TauriWindow,
    '@tauri-apps/plugin-fs': TauriFs,
    [wallpaperSystemConfig.runtimeModuleName]: {
      defineWallpaper,
      clamp01,
      lerp,
      normalizeOverlayWallpaperFitMode,
      useWallpaperContextRef,
    },
  };

  return executeRuntimeModule(code, allowedModules);
}

function normalizeWallpaperExport(
  exported: unknown,
  fallbackContext: OverlayWallpaperContext,
): OverlayWallpaperDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, ['wallpaper']);
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Wallpaper must export defineWallpaper({ renderBackground }) or a plain definition object.');
  }

  const definition = candidate as OverlayWallpaperDefinition;
  if (typeof definition.renderBackground !== 'function') {
    throw new Error('Wallpaper must provide a React component for `renderBackground`.');
  }

  return {
    ...definition,
    id: definition.id?.trim() || fallbackContext.id,
    name: definition.name?.trim() || fallbackContext.name,
    group: definition.group?.trim() || 'Custom Live',
    tags: Array.isArray(definition.tags)
      ? definition.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [],
    previewUrl: typeof definition.previewUrl === 'string' && definition.previewUrl.trim()
      ? definition.previewUrl.trim()
      : undefined,
  };
}

class WallpaperBackgroundBoundary extends React.Component<
  { wallpaperName: string; children: React.ReactNode },
  { failed: boolean }
> {
  constructor(props: { wallpaperName: string; children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn(`OverlayTerm: wallpaper "${this.props.wallpaperName}" threw`, error);
  }

  override componentDidUpdate(prevProps: { wallpaperName: string }) {
    if (prevProps.wallpaperName !== this.props.wallpaperName && this.state.failed) {
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
