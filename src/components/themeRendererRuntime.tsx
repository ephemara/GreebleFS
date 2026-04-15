import React from 'react';
import * as LucideReact from 'lucide-react';

import type { OverlayThemeDefinition, ResolvedOverlayAppearance } from '../config/appearance';
import type { LayoutProfile } from '../config/layoutProfiles';
import type {
  ResolvedWorkbenchRenderRuntime,
  WorkbenchNavigationMetadata,
  WorkbenchRenderRuntimeKind,
} from '../config/workbenchRenderRuntime';
import type {
  LoadedOverlayWallpaper,
  OverlayWallpaperRenderContext,
  ResolvedWallpaperSelection,
} from './wallpaperRuntime';
import type { OverlayPanelDefinition } from '../panels/panelRegistry';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
import {
  defaultOverlayThemeRendererSurfaceOwnership,
  normalizeOverlayThemeRendererSurfaceOwnership,
  type OverlayThemeRendererShellModel,
  type OverlayThemeRendererSurfaceOwnership,
} from './themeRendererShellModel';

export interface ThemeRendererFileEntry extends RuntimeFileEntry {}

export interface OverlayThemeRendererCapabilities {
  customScreens: boolean;
  wallpaperScene: boolean;
  surfaceAdapters: boolean;
}

export interface OverlayThemeRendererContext {
  id: string;
  name: string;
  filePath: string;
  rendererRoot: string;
  entryModule: string;
}

export interface OverlayThemeRendererPanel {
  id: string;
  label: string;
  description: string;
  kind: OverlayPanelDefinition['kind'];
  icon: React.ReactNode;
  navigation?: WorkbenchNavigationMetadata;
  defaultOpen: boolean;
  keepMounted: boolean;
  isActive: boolean;
  isOpen: boolean;
  isPinned: boolean;
}

export interface OverlayThemeRendererLayoutContext {
  windowMode: 'overlay' | 'windowed';
  overlayAnchor: 'top' | 'bottom';
  isWindowMaximized: boolean;
  shellBackgroundColor: string;
  shellBackdropFilter: string;
  usesNavigationSidebar: boolean;
  usesInsetContentShell: boolean;
  contentStagePadding: number;
  scaledWidth: string;
  scaledHeight: string;
}

export interface OverlayThemeRendererWallpaperContext {
  activeWallpaper: LoadedOverlayWallpaper | null;
  themeWallpaper: LoadedOverlayWallpaper | null;
  selection: ResolvedWallpaperSelection;
  renderContext: OverlayWallpaperRenderContext;
  renderBackground: (contextOverrides?: Partial<OverlayWallpaperRenderContext>) => React.ReactNode;
  renderBackdropStack: () => React.ReactNode;
}

export interface OverlayThemeRendererHost {
  appearance: ResolvedOverlayAppearance;
  theme: OverlayThemeDefinition;
  layoutProfile: LayoutProfile;
  renderRuntime: ResolvedWorkbenchRenderRuntime;
  layout: OverlayThemeRendererLayoutContext;
  shellModel: OverlayThemeRendererShellModel;
  panels: OverlayThemeRendererPanel[];
  activePanelId: string | null;
  openPanelIds: string[];
  pinnedPanelIds: string[];
  wallpaper: OverlayThemeRendererWallpaperContext;
  activatePanel: (panelId: string) => void;
  openPanel: (panelId: string) => void;
  closePanel: (panelId: string) => void;
  togglePanel: (panelId: string) => void;
  openSettings: () => void;
  renderDefaultChromeSurface: () => React.ReactNode;
  renderChromeBar: () => React.ReactNode;
  renderDefaultNavigationSurface: () => React.ReactNode;
  renderPanelSurface: (
    panelId: string,
    options?: {
      forceMount?: boolean;
      forceVisible?: boolean;
      style?: React.CSSProperties;
    },
  ) => React.ReactNode;
  renderPinnedPanels: (side: 'left' | 'right') => React.ReactNode;
  renderDefaultContentSurface: () => React.ReactNode;
  renderDefaultShellBody: () => React.ReactNode;
}

export interface OverlayThemeRendererProps {
  renderer: OverlayThemeRendererContext;
  host: OverlayThemeRendererHost;
}

export interface OverlayThemeRendererDefinition {
  id?: string;
  name?: string;
  description?: string;
  apiVersion?: number;
  supportsLiveSwap?: boolean;
  fallbackRuntime?: WorkbenchRenderRuntimeKind;
  capabilities?: Partial<OverlayThemeRendererCapabilities>;
  surfaceOwnership?: Partial<OverlayThemeRendererSurfaceOwnership>;
  component: React.ComponentType<OverlayThemeRendererProps>;
}

export interface LoadedOverlayThemeRenderer extends OverlayThemeRendererContext {
  description?: string;
  apiVersion: number;
  supportsLiveSwap: boolean;
  fallbackRuntime: WorkbenchRenderRuntimeKind | null;
  capabilities: OverlayThemeRendererCapabilities;
  surfaceOwnership: OverlayThemeRendererSurfaceOwnership;
  component: React.ComponentType<OverlayThemeRendererProps> | null;
  error: string | null;
}

export interface LoadThemeRendererFromSourceOptions {
  context?: Partial<OverlayThemeRendererContext>;
  defaults?: Partial<Omit<OverlayThemeRendererDefinition, 'component'>>;
}

export const overlayThemeRendererRuntimeModuleName = 'overlayterm-theme-renderer';
export const overlayThemeRendererApiVersion = 1;

const defaultThemeRendererCapabilities: OverlayThemeRendererCapabilities = {
  customScreens: true,
  wallpaperScene: false,
  surfaceAdapters: true,
};

export function defineThemeRenderer(
  definition: OverlayThemeRendererDefinition,
): OverlayThemeRendererDefinition {
  return definition;
}

export function deriveThemeRendererId(name: string): string {
  return deriveRuntimeModuleId(name, 'theme-renderer');
}

export function deriveThemeRendererName(name: string): string {
  return deriveRuntimeModuleName(name, 'Theme Renderer');
}

export async function loadThemeRendererFromSource(
  source: string,
  entry: ThemeRendererFileEntry,
  options?: LoadThemeRendererFromSourceOptions,
): Promise<LoadedOverlayThemeRenderer> {
  const defaultId = deriveThemeRendererId(entry.name);
  const context: OverlayThemeRendererContext = {
    id: options?.context?.id ?? defaultId,
    name: options?.context?.name ?? deriveThemeRendererName(entry.name),
    filePath: options?.context?.filePath ?? entry.path,
    rendererRoot: options?.context?.rendererRoot ?? entry.path,
    entryModule: options?.context?.entryModule ?? entry.name,
  };

  try {
    const transpiled = await transpileRuntimeModuleSource(source, 'const React = require(\'react\');\n');
    const exported = executeThemeRendererModule(transpiled);
    const normalized = normalizeThemeRendererExport(exported, context);

    return {
      ...context,
      id: normalized.id ?? options?.defaults?.id ?? context.id,
      name: normalized.name ?? options?.defaults?.name ?? context.name,
      description: normalized.description ?? options?.defaults?.description,
      apiVersion: Number.isFinite(normalized.apiVersion)
        ? Math.max(1, Math.trunc(normalized.apiVersion!))
        : (options?.defaults?.apiVersion ?? overlayThemeRendererApiVersion),
      supportsLiveSwap: normalized.supportsLiveSwap ?? options?.defaults?.supportsLiveSwap ?? false,
      fallbackRuntime: normalized.fallbackRuntime ?? options?.defaults?.fallbackRuntime ?? null,
      capabilities: {
        ...defaultThemeRendererCapabilities,
        ...(options?.defaults?.capabilities ?? {}),
        ...(normalized.capabilities ?? {}),
      },
      surfaceOwnership: normalizeOverlayThemeRendererSurfaceOwnership(normalized.surfaceOwnership),
      component: normalized.component,
      error: null,
    };
  } catch (error) {
    return {
      ...context,
      description: options?.defaults?.description,
      apiVersion: options?.defaults?.apiVersion ?? overlayThemeRendererApiVersion,
      supportsLiveSwap: options?.defaults?.supportsLiveSwap ?? false,
      fallbackRuntime: options?.defaults?.fallbackRuntime ?? null,
      capabilities: {
        ...defaultThemeRendererCapabilities,
        ...(options?.defaults?.capabilities ?? {}),
      },
      surfaceOwnership: defaultOverlayThemeRendererSurfaceOwnership,
      component: null,
      error: String(error),
    };
  }
}

export function ThemeRendererBoundary({
  renderer,
  render,
  fallback,
  onError,
}: {
  renderer: LoadedOverlayThemeRenderer;
  render: (component: React.ComponentType<OverlayThemeRendererProps>) => React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}) {
  return (
    <ThemeRendererErrorBoundary
      rendererName={renderer.name}
      fallback={fallback}
      onError={onError}
    >
      {renderer.component ? render(renderer.component) : fallback}
    </ThemeRendererErrorBoundary>
  );
}

function executeThemeRendererModule(code: string): unknown {
  return executeRuntimeModule(code, {
    react: React,
    'lucide-react': LucideReact,
    [overlayThemeRendererRuntimeModuleName]: {
      defineThemeRenderer,
    },
  });
}

function normalizeThemeRendererExport(
  exported: unknown,
  fallbackContext: OverlayThemeRendererContext,
): OverlayThemeRendererDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, ['themeRenderer']);

  if (typeof candidate === 'function') {
    return {
      name: fallbackContext.name,
      component: candidate as React.ComponentType<OverlayThemeRendererProps>,
    };
  }

  if (candidate && typeof candidate === 'object' && 'component' in candidate) {
    const definition = candidate as OverlayThemeRendererDefinition;
    if (typeof definition.component !== 'function') {
      throw new Error('Theme renderer export must provide a React component.');
    }
    return definition;
  }

  throw new Error('Theme renderer must export either a React component or defineThemeRenderer({ component }).');
}

class ThemeRendererErrorBoundary extends React.Component<{
  rendererName: string;
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}, {
  failed: boolean;
}> {
  constructor(props: {
    rendererName: string;
    children: React.ReactNode;
    fallback: React.ReactNode;
    onError?: (error: Error) => void;
  }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    console.warn(`OverlayTerm: theme renderer "${this.props.rendererName}" threw`, error);
    this.props.onError?.(error);
  }

  override componentDidUpdate(prevProps: { rendererName: string }) {
    if (prevProps.rendererName !== this.props.rendererName && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  override render() {
    if (this.state.failed) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
