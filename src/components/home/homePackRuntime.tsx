import React from 'react';
import * as LucideReact from '@/components/AppIcons';

import type { ResolvedOverlayAppearance } from '../../config/appearance';
import type { SettingsSectionKey } from '../../config/settingsNavigation';
import type {
  ExplorerDriveInfo,
  ExplorerSavedSearch,
  ExplorerTaskSnapshot,
} from '../../runtime/explorerBackend';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModuleGraph,
  transpileRuntimeModuleGraph,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleSourceResolver,
  unwrapRuntimeModuleExport,
} from '../../runtime/moduleRuntime';

export type {
  RuntimeFileEntry,
  RuntimeRelativeModuleSourceResolver,
} from '../../runtime/moduleRuntime';

export interface ExplorerHomeQuickAccessItem {
  id: string;
  label: string;
  path: string;
  description?: string;
}

export interface ExplorerHomeBookmarkItem {
  id: string;
  label: string;
  path: string;
  color: string | null;
  categoryIds: string[];
}

export interface ExplorerHomeUsageEntry {
  path: string;
  label: string;
  openCount: number;
  lastOpenedAt: number;
}

export interface ExplorerHomeLaunchpadItem {
  id: string;
  label: string;
  description: string;
  panelId: string;
}

export type ExplorerHomeViewportDensity = 'narrow' | 'compact' | 'wide';

export interface ExplorerHomeViewportState {
  width: number;
  density: ExplorerHomeViewportDensity;
}

export interface ExplorerHomeActionItem {
  id: string;
  title: string;
  description?: string;
  packName: string;
  sourceBadgeLabel: string;
  presentationKind: 'command' | 'workflow';
  outputTarget: string;
  iconName?: string;
  tags: string[];
  canRunFromHome: boolean;
}

export interface ExplorerHomeWidgetItem {
  id: string;
  title: string;
  shortLabel: string;
  description?: string;
  category: string;
  sourceLabel: string;
  rendererKind: 'react' | 'wasm-panel';
  available: boolean;
  tags: string[];
  canRenderInHome: boolean;
}

export type ExplorerHomeHostModuleId =
  | 'quick-access'
  | 'bookmarks'
  | 'most-used-folders'
  | 'recent-folders'
  | 'saved-searches'
  | 'task-center'
  | 'drives'
  | 'launchpad'
  | 'actions'
  | 'widgets';

export interface ExplorerHomePackModuleLayout {
  id: string;
  moduleId: ExplorerHomeHostModuleId | string;
  title?: string;
  description?: string;
  style?: 'hero' | 'grid' | 'list' | 'cards' | 'dense';
  limit?: number;
  prominence?: 'primary' | 'secondary' | 'support';
}

export interface ExplorerHomePackPresetDefinition {
  id: string;
  name: string;
  description?: string;
  modules: ExplorerHomePackModuleLayout[];
}

export interface ExplorerHomePackContext {
  id: string;
  name: string;
  filePath: string;
  packRoot: string;
  entryModule: string;
}

export interface ExplorerHomePackHost {
  appearance: ResolvedOverlayAppearance;
  viewport: ExplorerHomeViewportState;
  activePresetId: string | null;
  usageTrackingEnabled: boolean;
  quickAccess: ExplorerHomeQuickAccessItem[];
  bookmarks: ExplorerHomeBookmarkItem[];
  mostUsedFolders: ExplorerHomeUsageEntry[];
  recentFolders: ExplorerHomeUsageEntry[];
  savedSearches: ExplorerSavedSearch[];
  drives: ExplorerDriveInfo[];
  tasks: ExplorerTaskSnapshot[];
  launchpad: ExplorerHomeLaunchpadItem[];
  actions: ExplorerHomeActionItem[];
  widgets: ExplorerHomeWidgetItem[];
  packState: Record<string, unknown>;
  packWarnings: string[];
  diagnostics: {
    isFallback: boolean;
    authoredPackCount: number;
    selectedPackError: string | null;
  };
  navigate: (path: string) => void;
  openSavedSearch: (savedSearch: ExplorerSavedSearch) => void;
  openPanel: (panelId: string) => void;
  openSettingsSection: (section: SettingsSectionKey) => void;
  runAction: (actionId: string) => void;
  renderWidget: (widgetId: string, slotId?: string) => React.ReactNode;
  refresh: () => void;
  updatePackState: (updates: Record<string, unknown>) => void;
  setPreset: (presetId: string | null) => void;
}

export interface ExplorerHomePackRendererProps {
  pack: ExplorerHomePackContext;
  host: ExplorerHomePackHost;
}

export interface ExplorerHomePackSettingsProps {
  pack: ExplorerHomePackContext;
  host: ExplorerHomePackHost;
}

export interface ExplorerHomePackDefinition {
  id?: string;
  name?: string;
  description?: string;
  apiVersion?: number;
  supportsLiveSwap?: boolean;
  defaultPresetId?: string | null;
  presets?: ExplorerHomePackPresetDefinition[];
  component?: React.ComponentType<ExplorerHomePackRendererProps>;
  settingsComponent?: React.ComponentType<ExplorerHomePackSettingsProps>;
}

export interface LoadedExplorerHomePackRuntime extends ExplorerHomePackContext {
  description?: string;
  apiVersion: number;
  supportsLiveSwap: boolean;
  defaultPresetId: string | null;
  presets: ExplorerHomePackPresetDefinition[];
  component: React.ComponentType<ExplorerHomePackRendererProps> | null;
  settingsComponent: React.ComponentType<ExplorerHomePackSettingsProps> | null;
  error: string | null;
}

export interface LoadExplorerHomePackFromSourceOptions {
  context?: Partial<ExplorerHomePackContext>;
  defaults?: Partial<Omit<ExplorerHomePackDefinition, 'component' | 'settingsComponent'>>;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}

export const explorerHomePackRuntimeModuleName = 'greeblefs-home-pack';
export const explorerHomePackApiVersion = 1;

export function defineHomePack(
  definition: ExplorerHomePackDefinition,
): ExplorerHomePackDefinition {
  return definition;
}

export function deriveExplorerHomePackId(name: string): string {
  return deriveRuntimeModuleId(name, 'home-pack');
}

export function deriveExplorerHomePackName(name: string): string {
  return deriveRuntimeModuleName(name, 'Home Pack');
}

export function normalizeExplorerHomePackPresets(
  presets: ExplorerHomePackPresetDefinition[] | undefined,
): ExplorerHomePackPresetDefinition[] {
  if (!Array.isArray(presets)) {
    return [];
  }

  const normalizedPresets: ExplorerHomePackPresetDefinition[] = [];

  for (const [presetIndex, preset] of presets.entries()) {
    const presetId = typeof preset.id === 'string' && preset.id.trim()
      ? preset.id.trim()
      : `preset-${presetIndex + 1}`;
    const modules: ExplorerHomePackModuleLayout[] = [];

    if (Array.isArray(preset.modules)) {
      for (const [moduleIndex, module] of preset.modules.entries()) {
        if (!module || typeof module !== 'object') {
          continue;
        }

        const normalizedModuleId = typeof module.moduleId === 'string' && module.moduleId.trim()
          ? module.moduleId.trim()
          : '';
        if (!normalizedModuleId) {
          continue;
        }

        modules.push({
          id: typeof module.id === 'string' && module.id.trim()
            ? module.id.trim()
            : `${presetId}-module-${moduleIndex + 1}`,
          moduleId: normalizedModuleId,
          title: typeof module.title === 'string' && module.title.trim()
            ? module.title.trim()
            : undefined,
          description: typeof module.description === 'string' && module.description.trim()
            ? module.description.trim()
            : undefined,
          style: module.style,
          limit: typeof module.limit === 'number' && Number.isFinite(module.limit)
            ? Math.max(1, Math.trunc(module.limit))
            : undefined,
          prominence: module.prominence,
        });
      }
    }

    if (modules.length === 0) {
      continue;
    }

    normalizedPresets.push({
      id: presetId,
      name: typeof preset.name === 'string' && preset.name.trim()
        ? preset.name.trim()
        : deriveExplorerHomePackName(presetId),
      description: typeof preset.description === 'string' && preset.description.trim()
        ? preset.description.trim()
        : undefined,
      modules,
    });
  }

  return normalizedPresets;
}

export function createLoadedExplorerHomePackRuntime(
  definition: ExplorerHomePackDefinition,
  context: ExplorerHomePackContext,
  options?: {
    defaults?: Partial<Omit<ExplorerHomePackDefinition, 'component' | 'settingsComponent'>>;
    error?: string | null;
  },
): LoadedExplorerHomePackRuntime {
  const normalizedPresets = normalizeExplorerHomePackPresets(
    definition.presets ?? options?.defaults?.presets,
  );
  const defaultPresetId = (() => {
    const requestedPresetId = typeof definition.defaultPresetId === 'string'
      ? definition.defaultPresetId.trim() || null
      : definition.defaultPresetId === null
        ? null
        : typeof options?.defaults?.defaultPresetId === 'string'
          ? options.defaults.defaultPresetId.trim() || null
          : options?.defaults?.defaultPresetId === null
            ? null
            : normalizedPresets[0]?.id ?? null;
    return requestedPresetId && normalizedPresets.some((preset) => preset.id === requestedPresetId)
      ? requestedPresetId
      : normalizedPresets[0]?.id ?? null;
  })();

  return {
    ...context,
    id: definition.id ?? options?.defaults?.id ?? context.id,
    name: definition.name ?? options?.defaults?.name ?? context.name,
    description: definition.description ?? options?.defaults?.description,
    apiVersion: Number.isFinite(definition.apiVersion)
      ? Math.max(1, Math.trunc(definition.apiVersion!))
      : (options?.defaults?.apiVersion ?? explorerHomePackApiVersion),
    supportsLiveSwap: definition.supportsLiveSwap ?? options?.defaults?.supportsLiveSwap ?? false,
    defaultPresetId,
    presets: normalizedPresets,
    component: definition.component ?? null,
    settingsComponent: definition.settingsComponent ?? null,
    error: options?.error ?? null,
  };
}

export async function loadExplorerHomePackFromSource(
  source: string,
  entry: RuntimeFileEntry,
  options?: LoadExplorerHomePackFromSourceOptions,
): Promise<LoadedExplorerHomePackRuntime> {
  const defaultId = deriveExplorerHomePackId(entry.name);
  const context: ExplorerHomePackContext = {
    id: options?.context?.id ?? defaultId,
    name: options?.context?.name ?? deriveExplorerHomePackName(entry.name),
    filePath: options?.context?.filePath ?? entry.path,
    packRoot: options?.context?.packRoot ?? entry.path,
    entryModule: options?.context?.entryModule ?? entry.name,
  };

  try {
    const transpiledGraph = await transpileRuntimeModuleGraph({
      entryModulePath: context.filePath,
      entrySource: source,
      prependCode: 'const React = require(\'react\');\n',
      resolveRelativeModuleSource: options?.resolveRelativeModuleSource,
    });
    const exported = executeExplorerHomePackModuleGraph(transpiledGraph);
    const normalized = normalizeExplorerHomePackExport(exported, context);
    return createLoadedExplorerHomePackRuntime(normalized, context, {
      defaults: options?.defaults,
    });
  } catch (error) {
    return createLoadedExplorerHomePackRuntime({}, context, {
      defaults: options?.defaults,
      error: String(error),
    });
  }
}

export function ExplorerHomePackBoundary({
  pack,
  render,
  fallback,
  onError,
}: {
  pack: LoadedExplorerHomePackRuntime;
  render: (component: React.ComponentType<ExplorerHomePackRendererProps>) => React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}) {
  return (
    <ExplorerHomePackErrorBoundary
      packName={pack.name}
      fallback={fallback}
      onError={onError}
    >
      {pack.component ? render(pack.component) : fallback}
    </ExplorerHomePackErrorBoundary>
  );
}

function executeExplorerHomePackModuleGraph(graph: RuntimeModuleGraph): unknown {
  return executeRuntimeModuleGraph(graph, {
    react: React,
    'lucide-react': LucideReact,
    [explorerHomePackRuntimeModuleName]: {
      defineHomePack,
    },
  });
}

function normalizeExplorerHomePackExport(
  exported: unknown,
  fallbackContext: ExplorerHomePackContext,
): ExplorerHomePackDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, ['homePack']);

  if (typeof candidate === 'function') {
    return {
      name: fallbackContext.name,
      component: candidate as React.ComponentType<ExplorerHomePackRendererProps>,
    };
  }

  if (!candidate || typeof candidate !== 'object') {
    throw new Error(
      `Home pack "${fallbackContext.name}" must export a component or defineHomePack(...) result.`,
    );
  }

  const definition = candidate as ExplorerHomePackDefinition;
  if (!definition.component && (!Array.isArray(definition.presets) || definition.presets.length === 0)) {
    throw new Error(
      `Home pack "${fallbackContext.name}" must provide either a component or at least one preset module layout.`,
    );
  }

  return definition;
}

class ExplorerHomePackErrorBoundary extends React.Component<{
  packName: string;
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}, {
  failed: boolean;
}> {
  constructor(props: {
    packName: string;
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
    console.warn(`GreebleFS: explorer home pack "${this.props.packName}" threw`, error);
    this.props.onError?.(error);
  }

  override componentDidUpdate(prevProps: { packName: string }) {
    if (prevProps.packName !== this.props.packName && this.state.failed) {
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
