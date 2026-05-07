import React, { useMemo } from "react";

import * as LucideReact from "@/components/AppIcons";

import { WasmPanelHost, type WasmPanelBuildTarget, type WasmPanelHostContext } from "../WasmPanelHost";
import type { ResolvedOverlayAppearance } from "../../config/appearance";
import type { ExplorerViewMode } from "../../config/explorerViewModes";
import type { ExplorerFileEntry } from "../../runtime/explorerBackend";
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModuleGraph,
  transpileRuntimeModuleGraph,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleSourceResolver,
  unwrapRuntimeModuleExport,
} from "../../runtime/moduleRuntime";
import type {
  OverlayPluginApi,
  OverlayPluginContext,
} from "../pluginRuntime";

export const STANDARD_EXPLORER_VIEW_ID = "standard";
export const explorerViewRuntimeModuleName = "overlayterm-explorer-view";
export const explorerViewRuntimeApiVersion = 1;

export type ExplorerViewRendererKind = "react" | "wasm-panel";
export type ExplorerViewOwnership = "content" | "surface";
export type ExplorerBuiltInSurfaceViewId =
  | typeof STANDARD_EXPLORER_VIEW_ID
  | "adaptive-semantic-grid"
  | "constellation"
  | "timeline-surface";
export type ExplorerViewSurfaceId =
  | "topbar"
  | "toolbar"
  | "sources"
  | "activity"
  | "preview"
  | "actions"
  | "statusBar"
  | "background"
  | "contentFrame";

export interface ExplorerViewSurfaceOwnership {
  topbar: boolean;
  toolbar: boolean;
  sources: boolean;
  activity: boolean;
  preview: boolean;
  actions: boolean;
  statusBar: boolean;
  background: boolean;
  contentFrame: boolean;
}

export interface ExplorerViewDensityStopDefinition {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  value: number;
}

export interface ExplorerViewDensityContract {
  axisLabel: string;
  defaultValue: number;
  step: number;
  stops: ExplorerViewDensityStopDefinition[];
}

export interface ExplorerViewCapabilityFlags {
  multiSelect: boolean;
  dragDrop: boolean;
  contextMenus: boolean;
  workflowTabs: boolean;
  previewSync: boolean;
  searchSync: boolean;
  keyboardCapture: boolean;
  liveSwap: boolean;
}

export interface ExplorerViewDescriptor {
  id: string;
  title: string;
  shortLabel: string;
  description?: string;
  tags: string[];
  priority: number;
  available: boolean;
  rendererKind: ExplorerViewRendererKind;
  rendererEntry: string | null;
  runtimeId: string | null;
  runtimeSurfaceId: string | null;
  buildTarget: string | null;
  ownership: ExplorerViewOwnership;
  surfaceOwnership: ExplorerViewSurfaceOwnership;
  density: ExplorerViewDensityContract | null;
  capabilities: ExplorerViewCapabilityFlags;
}

export interface ExplorerViewHostSurfaceMetrics {
  visible: boolean;
  estimatedWidth: number | null;
  estimatedHeight: number | null;
}

export interface ExplorerViewSessionContext {
  instanceId: string;
  workspaceTabId: string | null;
  currentPath: string;
  search: string;
  sortBy: "name" | "size" | "date" | "type";
  sortOrder: "asc" | "desc";
  standardViewMode: ExplorerViewMode;
  activeViewId: string;
  currentDensity: number;
  currentViewState: Record<string, unknown>;
}

export interface ExplorerViewDataModel {
  entries: readonly ExplorerFileEntry[];
  visibleEntries: readonly ExplorerFileEntry[];
  selectedEntries: readonly ExplorerFileEntry[];
  selectedPaths: readonly string[];
  lastSelectedPath: string | null;
  loading: boolean;
  searchLoading: boolean;
  currentPathIsHome: boolean;
  currentPathIsArchiveVirtual: boolean;
  currentPathIsCloud: boolean;
}

export interface ExplorerViewRuntimeBridge {
  rendererKind: ExplorerViewRendererKind;
  runtimeId: string | null;
  runtimeSurfaceId: string | null;
  buildTarget: string | null;
}

export interface ExplorerViewHost {
  setDensity: (value: number) => void;
  patchViewState: (
    patch:
      | Record<string, unknown>
      | ((current: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
  openPath: (path: string, options?: { pushHistory?: boolean }) => void;
  openEntry: (entry: ExplorerFileEntry) => void;
  refresh: () => void;
  setSearch: (query: string) => void;
  setSort: (
    sortBy: "name" | "size" | "date" | "type",
    sortOrder?: "asc" | "desc",
  ) => void;
  setSelectedPaths: (
    paths: readonly string[],
    options?: { focusPrimary?: boolean },
  ) => void;
  toggleSelectedPath: (path: string) => void;
  revealPath: (path: string) => void;
  openPanel: (panelId: string, payload?: Record<string, string>) => void;
  openWorkflow: (
    workflowId: string,
    options?: {
      payload?: Record<string, unknown> | null;
      titleOverride?: string | null;
    },
  ) => void;
  renderSurface: (surfaceId: ExplorerViewSurfaceId) => React.ReactNode;
  renderStandardLayout: () => React.ReactNode;
  renderBuiltInContentView: (
    viewId: Exclude<ExplorerBuiltInSurfaceViewId, typeof STANDARD_EXPLORER_VIEW_ID>,
  ) => React.ReactNode;
}

export interface ExplorerViewProps {
  descriptor: ExplorerViewDescriptor;
  appearance: ResolvedOverlayAppearance;
  session: ExplorerViewSessionContext;
  data: ExplorerViewDataModel;
  runtime: ExplorerViewRuntimeBridge;
  host: ExplorerViewHost;
  plugin?: OverlayPluginContext | null;
  api?: OverlayPluginApi | null;
  surfaceMetrics?: Partial<Record<ExplorerViewSurfaceId, ExplorerViewHostSurfaceMetrics>>;
}

export type BoundExplorerViewProps = Omit<ExplorerViewProps, "plugin" | "api">;

export type BoundExplorerViewComponent =
  React.ComponentType<BoundExplorerViewProps>;

export interface ExplorerViewDefinition {
  descriptor?: Partial<Omit<ExplorerViewDescriptor, "surfaceOwnership" | "capabilities" | "density">> & {
    surfaceOwnership?: Partial<ExplorerViewSurfaceOwnership>;
    capabilities?: Partial<ExplorerViewCapabilityFlags>;
    density?: Partial<Omit<ExplorerViewDensityContract, "stops">> & {
      stops?: Array<Partial<ExplorerViewDensityStopDefinition>>;
    };
  };
  component: React.ComponentType<ExplorerViewProps>;
}

export interface LoadedExplorerViewModule {
  descriptor: ExplorerViewDescriptor;
  component: React.ComponentType<ExplorerViewProps> | null;
  error: string | null;
}

export interface LoadExplorerViewFromSourceOptions {
  descriptorDefaults?: Partial<ExplorerViewDescriptor>;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}

export const defaultExplorerViewSurfaceOwnership: ExplorerViewSurfaceOwnership = {
  topbar: false,
  toolbar: false,
  sources: false,
  activity: false,
  preview: false,
  actions: false,
  statusBar: false,
  background: false,
  contentFrame: false,
};

export const defaultExplorerViewCapabilities: ExplorerViewCapabilityFlags = {
  multiSelect: true,
  dragDrop: true,
  contextMenus: true,
  workflowTabs: true,
  previewSync: true,
  searchSync: true,
  keyboardCapture: false,
  liveSwap: false,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeExplorerViewSurfaceOwnership(
  value: Partial<ExplorerViewSurfaceOwnership> | null | undefined,
): ExplorerViewSurfaceOwnership {
  return {
    topbar: value?.topbar === true,
    toolbar: value?.toolbar === true,
    sources: value?.sources === true,
    activity: value?.activity === true,
    preview: value?.preview === true,
    actions: value?.actions === true,
    statusBar: value?.statusBar === true,
    background: value?.background === true,
    contentFrame: value?.contentFrame === true,
  };
}

export function normalizeExplorerViewCapabilities(
  value: Partial<ExplorerViewCapabilityFlags> | null | undefined,
): ExplorerViewCapabilityFlags {
  return {
    ...defaultExplorerViewCapabilities,
    ...(value ?? {}),
  };
}

function normalizeExplorerViewDensityStop(
  value: Partial<ExplorerViewDensityStopDefinition> | null | undefined,
  fallbackIndex: number,
): ExplorerViewDensityStopDefinition | null {
  const label = asTrimmedString(value?.label);
  if (!label) {
    return null;
  }
  const numericValue =
    typeof value?.value === "number" && Number.isFinite(value.value)
      ? clamp01(value.value)
      : null;
  if (numericValue == null) {
    return null;
  }
  const shortLabel = asTrimmedString(value?.shortLabel) || label;
  return {
    id: asTrimmedString(value?.id) || `density-stop-${fallbackIndex + 1}`,
    label,
    shortLabel,
    description: asTrimmedString(value?.description),
    value: numericValue,
  };
}

export function normalizeExplorerViewDensityContract(
  value: Partial<ExplorerViewDensityContract> | null | undefined,
): ExplorerViewDensityContract | null {
  if (!value) {
    return null;
  }
  const axisLabel = asTrimmedString(value.axisLabel);
  if (!axisLabel) {
    return null;
  }
  const defaultValue =
    typeof value.defaultValue === "number" && Number.isFinite(value.defaultValue)
      ? clamp01(value.defaultValue)
      : 0.5;
  const step =
    typeof value.step === "number" && Number.isFinite(value.step) && value.step > 0
      ? clamp01(value.step)
      : 0.1;
  const stops = Array.isArray(value.stops)
    ? value.stops
        .map((stop, index) => normalizeExplorerViewDensityStop(stop, index))
        .filter(
          (stop): stop is ExplorerViewDensityStopDefinition => stop != null,
        )
    : [];
  return {
    axisLabel,
    defaultValue,
    step,
    stops,
  };
}

export function normalizeExplorerViewDescriptor(
  value: Partial<ExplorerViewDescriptor> | null | undefined,
  fallbacks: {
    id: string;
    title: string;
  },
): ExplorerViewDescriptor {
  const density = normalizeExplorerViewDensityContract(value?.density);
  const rendererKind: ExplorerViewRendererKind =
    value?.rendererKind === "wasm-panel" ? "wasm-panel" : "react";
  const normalizedId = asTrimmedString(value?.id) || fallbacks.id;
  const normalizedTitle = asTrimmedString(value?.title) || fallbacks.title;
  return {
    id: normalizedId,
    title: normalizedTitle,
    shortLabel: asTrimmedString(value?.shortLabel) || normalizedTitle,
    description: asTrimmedString(value?.description) || undefined,
    tags: Array.isArray(value?.tags)
      ? value!.tags
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [],
    priority:
      typeof value?.priority === "number" && Number.isFinite(value.priority)
        ? Math.trunc(value.priority)
        : 0,
    available: value?.available !== false,
    rendererKind,
    rendererEntry: asTrimmedString(value?.rendererEntry) || null,
    runtimeId: asTrimmedString(value?.runtimeId) || null,
    runtimeSurfaceId: asTrimmedString(value?.runtimeSurfaceId) || null,
    buildTarget: asTrimmedString(value?.buildTarget) || null,
    ownership: value?.ownership === "surface" ? "surface" : "content",
    surfaceOwnership: normalizeExplorerViewSurfaceOwnership(
      value?.surfaceOwnership,
    ),
    density,
    capabilities: normalizeExplorerViewCapabilities(value?.capabilities),
  };
}

export function defineExplorerView(
  definition:
    | ExplorerViewDefinition
    | React.ComponentType<ExplorerViewProps>,
): ExplorerViewDefinition {
  if (typeof definition === "function") {
    return {
      component: definition,
    };
  }
  return definition;
}

export function deriveExplorerViewId(name: string): string {
  return deriveRuntimeModuleId(name, "explorer-view");
}

export function deriveExplorerViewName(name: string): string {
  return deriveRuntimeModuleName(name, "Explorer View");
}

export async function loadExplorerViewFromSource(
  source: string,
  entry: RuntimeFileEntry,
  options?: LoadExplorerViewFromSourceOptions,
): Promise<LoadedExplorerViewModule> {
  const fallbackId =
    options?.descriptorDefaults?.id ?? deriveExplorerViewId(entry.name);
  const fallbackTitle =
    options?.descriptorDefaults?.title ?? deriveExplorerViewName(entry.name);
  try {
    const transpiledGraph = await transpileRuntimeModuleGraph({
      entryModulePath: entry.path,
      entrySource: source,
      prependCode: "const React = require('react');\n",
      resolveRelativeModuleSource: options?.resolveRelativeModuleSource,
    });
    const exported = executeExplorerViewModuleGraph(transpiledGraph);
    const normalized = normalizeExplorerViewExport(exported, {
      id: fallbackId,
      title: fallbackTitle,
    });
    const descriptor = normalizeExplorerViewDescriptor(
      {
        ...options?.descriptorDefaults,
        ...(normalized.descriptor ?? {}),
      },
      {
        id: fallbackId,
        title: fallbackTitle,
      },
    );
    return {
      descriptor,
      component: normalized.component,
      error: null,
    };
  } catch (error) {
    return {
      descriptor: normalizeExplorerViewDescriptor(
        options?.descriptorDefaults,
        {
          id: fallbackId,
          title: fallbackTitle,
        },
      ),
      component: null,
      error: String(error),
    };
  }
}

function executeExplorerViewModuleGraph(graph: RuntimeModuleGraph): unknown {
  return executeRuntimeModuleGraph(graph, {
    react: React,
    "lucide-react": LucideReact,
    [explorerViewRuntimeModuleName]: {
      defineExplorerView,
      STANDARD_EXPLORER_VIEW_ID,
    },
  });
}

function normalizeExplorerViewExport(
  exported: unknown,
  fallbacks: { id: string; title: string },
): ExplorerViewDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, [
    "explorerView",
    "view",
  ]);
  if (typeof candidate === "function") {
    return {
      descriptor: {
        id: fallbacks.id,
        title: fallbacks.title,
        shortLabel: fallbacks.title,
      },
      component: candidate as React.ComponentType<ExplorerViewProps>,
    };
  }
  if (candidate && typeof candidate === "object" && "component" in candidate) {
    const definition = candidate as ExplorerViewDefinition;
    if (typeof definition.component !== "function") {
      throw new Error(
        "Explorer view export must provide a React component.",
      );
    }
    return definition;
  }
  throw new Error(
    "Explorer view must export either a React component or defineExplorerView({ component }).",
  );
}

export interface ExplorerWasmRuntimeSurfaceProps
  extends ExplorerViewProps {
  runtimeId: string;
  buildTarget?: WasmPanelBuildTarget | null;
}

export function ExplorerWasmRuntimeSurface({
  descriptor,
  appearance,
  session,
  data,
  runtimeId,
  buildTarget = null,
  plugin,
  surfaceMetrics,
}: ExplorerWasmRuntimeSurfaceProps) {
  const context = useMemo<WasmPanelHostContext>(
    () => ({
      runtimeId,
      panelId: `explorer-view.${descriptor.id}`,
      appearanceId: appearance.theme.id,
      densityToken: descriptor.density ? "compact" : "regular",
      cssVariables: appearance.cssVars,
      assetUrls: {},
      size: {
        width: 0,
        height: 0,
      },
      surfaceKind: "explorer-view",
      surfaceContext: {
        descriptor,
        plugin: plugin
          ? {
              id: plugin.id,
              name: plugin.name,
            }
          : null,
        session,
        data: {
          currentPathIsHome: data.currentPathIsHome,
          currentPathIsArchiveVirtual: data.currentPathIsArchiveVirtual,
          currentPathIsCloud: data.currentPathIsCloud,
          loading: data.loading,
          searchLoading: data.searchLoading,
          selectedPaths: [...data.selectedPaths],
          lastSelectedPath: data.lastSelectedPath,
          visibleEntries: data.visibleEntries,
        },
        surfaceMetrics,
      },
    }),
    [
      appearance.cssVars,
      appearance.theme.id,
      data,
      descriptor,
      plugin,
      runtimeId,
      session,
      surfaceMetrics,
    ],
  );
  return (
    <WasmPanelHost
      runtimeId={runtimeId}
      context={context}
      buildTarget={buildTarget ?? undefined}
      style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
      renderLoading={() => (
        <div style={{ padding: 12 }}>Loading {descriptor.title} runtime…</div>
      )}
    />
  );
}
