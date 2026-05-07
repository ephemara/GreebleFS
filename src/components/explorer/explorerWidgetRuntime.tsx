import React, { useMemo } from "react";

import * as LucideReact from "@/components/AppIcons";

import { OverlayScrollArea } from "../OverlayScrollArea";
import { PremiumSlider } from "../PremiumSlider";
import {
  WasmPanelHost,
  type WasmPanelBuildTarget,
  type WasmPanelHostContext,
} from "../WasmPanelHost";
import type { ResolvedOverlayAppearance } from "../../config/appearance";
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeSizeVariant,
  ExplorerChromeSurfaceId,
} from "../../config/explorerChromeLayouts";
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
import type {
  ExplorerViewDataModel,
  ExplorerViewHost,
  ExplorerViewSessionContext,
} from "./explorerViewRuntime";

export const explorerWidgetRuntimeModuleName = "overlayterm-explorer-widget";
export const explorerWidgetRuntimeApiVersion = 1;

export type ExplorerWidgetRendererKind = "react" | "wasm-panel";
export type ExplorerWidgetSourceKind =
  | "built-in"
  | "explorer-widget-directory"
  | "plugin";
export type ExplorerWidgetSurfaceKind = "chrome" | "view" | "freeform";

export interface ExplorerWidgetSurfaceContract {
  chrome: ExplorerChromeSurfaceId[];
  view: string[];
  freeform: string[];
}

export interface ExplorerWidgetSizingContract {
  sizeVariants: ExplorerChromeSizeVariant[];
  supportsWidthPx: boolean;
  supportsLabelVisibility: boolean;
  supportsIconVisibility: boolean;
  defaultWidthPx: number | null;
  minWidthPx: number | null;
  maxWidthPx: number | null;
  minInteractiveWidthPx: number | null;
}

export interface ExplorerWidgetCapabilityFlags {
  interactive: boolean;
  rangeInput: boolean;
  duplicateInstances: boolean;
  explorerMutations: boolean;
  workflowLaunch: boolean;
  panelLaunch: boolean;
  keyboardCapture: boolean;
}

export interface ExplorerWidgetDescriptor {
  id: string;
  title: string;
  shortLabel: string;
  description?: string;
  category: string;
  tags: string[];
  priority: number;
  available: boolean;
  chromeControlId: ExplorerChromeControlId;
  rendererKind: ExplorerWidgetRendererKind;
  rendererEntry: string | null;
  runtimeId: string | null;
  runtimeSurfaceId: string | null;
  buildTarget: string | null;
  surfaces: ExplorerWidgetSurfaceContract;
  sizing: ExplorerWidgetSizingContract;
  capabilities: ExplorerWidgetCapabilityFlags;
}

export type ExplorerWidgetDescriptorInput = Partial<
  Omit<ExplorerWidgetDescriptor, "surfaces" | "sizing" | "capabilities">
> & {
  surfaces?: Partial<ExplorerWidgetSurfaceContract>;
  sizing?: Partial<ExplorerWidgetSizingContract>;
  capabilities?: Partial<ExplorerWidgetCapabilityFlags>;
};

export interface ExplorerWidgetHost
  extends Pick<
    ExplorerViewHost,
    | "setDensity"
    | "openPath"
    | "openEntry"
    | "refresh"
    | "setSearch"
    | "setSort"
    | "setSelectedPaths"
    | "toggleSelectedPath"
    | "revealPath"
    | "openPanel"
    | "openWorkflow"
  > {
  getInstanceState: () => Record<string, unknown>;
  setInstanceState: (nextState: Record<string, unknown>) => void;
  patchInstanceState: (
    patch:
      | Record<string, unknown>
      | ((current: Record<string, unknown>) => Record<string, unknown>),
  ) => void;
  resetInstanceState: () => void;
}

export interface ExplorerWidgetProps {
  descriptor: ExplorerWidgetDescriptor;
  instanceId: string;
  appearance: ResolvedOverlayAppearance;
  session: ExplorerViewSessionContext;
  data: ExplorerViewDataModel;
  host: ExplorerWidgetHost;
  placement?: ExplorerChromeResolvedControlPlacement | null;
  plugin?: OverlayPluginContext | null;
  api?: OverlayPluginApi | null;
}

export type BoundExplorerWidgetProps = Omit<ExplorerWidgetProps, "plugin" | "api">;
export type BoundExplorerWidgetComponent =
  React.ComponentType<BoundExplorerWidgetProps>;

export interface ExplorerWidgetDefinition {
  descriptor?: ExplorerWidgetDescriptorInput;
  component: React.ComponentType<ExplorerWidgetProps>;
}

export interface LoadedExplorerWidgetModule {
  descriptor: ExplorerWidgetDescriptor;
  component: React.ComponentType<ExplorerWidgetProps> | null;
  error: string | null;
}

export interface LoadExplorerWidgetFromSourceOptions {
  descriptorDefaults?: ExplorerWidgetDescriptorInput;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}

export const defaultExplorerWidgetSurfaces: ExplorerWidgetSurfaceContract = {
  chrome: [],
  view: [],
  freeform: [],
};

export const defaultExplorerWidgetSizing: ExplorerWidgetSizingContract = {
  sizeVariants: ["compact", "regular", "wide"],
  supportsWidthPx: true,
  supportsLabelVisibility: true,
  supportsIconVisibility: true,
  defaultWidthPx: null,
  minWidthPx: null,
  maxWidthPx: null,
  minInteractiveWidthPx: null,
};

export const defaultExplorerWidgetCapabilities: ExplorerWidgetCapabilityFlags = {
  interactive: true,
  rangeInput: false,
  duplicateInstances: true,
  explorerMutations: false,
  workflowLaunch: true,
  panelLaunch: true,
  keyboardCapture: false,
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSurfaceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function normalizeNullableWidth(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : null;
}

function normalizeWidgetSizeVariants(
  value: unknown,
): ExplorerChromeSizeVariant[] {
  const variants = Array.isArray(value)
    ? value.filter(
        (entry): entry is ExplorerChromeSizeVariant =>
          entry === "compact" || entry === "regular" || entry === "wide",
      )
    : [];
  return variants.length > 0 ? [...new Set(variants)] : ["compact", "regular", "wide"];
}

export function toExplorerWidgetChromeControlId(
  widgetId: string,
): `widget:${string}` {
  return `widget:${widgetId.trim()}` as const;
}

export function isExplorerWidgetChromeControlId(
  controlId: ExplorerChromeControlId,
): controlId is `widget:${string}` {
  return controlId.startsWith("widget:");
}

export function getExplorerWidgetIdFromChromeControlId(
  controlId: ExplorerChromeControlId,
): string | null {
  return isExplorerWidgetChromeControlId(controlId)
    ? controlId.slice("widget:".length)
    : null;
}

export function normalizeExplorerWidgetSurfaces(
  value: Partial<ExplorerWidgetSurfaceContract> | null | undefined,
): ExplorerWidgetSurfaceContract {
  const chromeSurfaces = new Set<ExplorerChromeSurfaceId>();
  for (const surface of value?.chrome ?? []) {
    if (
      surface === "explorerTopbar" ||
      surface === "explorerToolbar" ||
      surface === "workspaceHeader" ||
      surface === "railHeader" ||
      surface === "previewHeader" ||
      surface === "explorerStatusBar"
    ) {
      chromeSurfaces.add(surface);
    }
  }
  return {
    chrome: [...chromeSurfaces],
    view: normalizeSurfaceStringArray(value?.view),
    freeform: normalizeSurfaceStringArray(value?.freeform),
  };
}

export function normalizeExplorerWidgetSizing(
  value: Partial<ExplorerWidgetSizingContract> | null | undefined,
): ExplorerWidgetSizingContract {
  return {
    sizeVariants: normalizeWidgetSizeVariants(value?.sizeVariants),
    supportsWidthPx: value?.supportsWidthPx !== false,
    supportsLabelVisibility: value?.supportsLabelVisibility !== false,
    supportsIconVisibility: value?.supportsIconVisibility !== false,
    defaultWidthPx: normalizeNullableWidth(value?.defaultWidthPx),
    minWidthPx: normalizeNullableWidth(value?.minWidthPx),
    maxWidthPx: normalizeNullableWidth(value?.maxWidthPx),
    minInteractiveWidthPx: normalizeNullableWidth(value?.minInteractiveWidthPx),
  };
}

export function normalizeExplorerWidgetCapabilities(
  value: Partial<ExplorerWidgetCapabilityFlags> | null | undefined,
): ExplorerWidgetCapabilityFlags {
  return {
    interactive: value?.interactive !== false,
    rangeInput: value?.rangeInput === true,
    duplicateInstances: value?.duplicateInstances !== false,
    explorerMutations: value?.explorerMutations === true,
    workflowLaunch: value?.workflowLaunch !== false,
    panelLaunch: value?.panelLaunch !== false,
    keyboardCapture: value?.keyboardCapture === true,
  };
}

export function normalizeExplorerWidgetDescriptor(
  value: ExplorerWidgetDescriptorInput | null | undefined,
  fallbacks: {
    id: string;
    title: string;
  },
): ExplorerWidgetDescriptor {
  const normalizedId = asTrimmedString(value?.id) || fallbacks.id;
  const normalizedTitle = asTrimmedString(value?.title) || fallbacks.title;
  const surfaces = normalizeExplorerWidgetSurfaces(value?.surfaces);
  const rendererKind: ExplorerWidgetRendererKind =
    value?.rendererKind === "wasm-panel" ? "wasm-panel" : "react";
  const chromeControlId =
    (asTrimmedString(value?.chromeControlId) as ExplorerChromeControlId) ||
    toExplorerWidgetChromeControlId(normalizedId);

  return {
    id: normalizedId,
    title: normalizedTitle,
    shortLabel: asTrimmedString(value?.shortLabel) || normalizedTitle,
    description: asTrimmedString(value?.description) || undefined,
    category: asTrimmedString(value?.category) || "widgets",
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
    chromeControlId,
    rendererKind,
    rendererEntry: asTrimmedString(value?.rendererEntry) || null,
    runtimeId: asTrimmedString(value?.runtimeId) || null,
    runtimeSurfaceId: asTrimmedString(value?.runtimeSurfaceId) || null,
    buildTarget: asTrimmedString(value?.buildTarget) || null,
    surfaces,
    sizing: normalizeExplorerWidgetSizing(value?.sizing),
    capabilities: normalizeExplorerWidgetCapabilities(value?.capabilities),
  };
}

export function defineExplorerWidget(
  definition:
    | ExplorerWidgetDefinition
    | React.ComponentType<ExplorerWidgetProps>,
): ExplorerWidgetDefinition {
  if (typeof definition === "function") {
    return {
      component: definition,
    };
  }
  return definition;
}

export function deriveExplorerWidgetId(name: string): string {
  return deriveRuntimeModuleId(name, "explorer-widget");
}

export function deriveExplorerWidgetName(name: string): string {
  return deriveRuntimeModuleName(name, "Explorer Widget");
}

export async function loadExplorerWidgetFromSource(
  source: string,
  entry: RuntimeFileEntry,
  options?: LoadExplorerWidgetFromSourceOptions,
): Promise<LoadedExplorerWidgetModule> {
  const fallbackId =
    options?.descriptorDefaults?.id ?? deriveExplorerWidgetId(entry.name);
  const fallbackTitle =
    options?.descriptorDefaults?.title ?? deriveExplorerWidgetName(entry.name);
  try {
    const transpiledGraph = await transpileRuntimeModuleGraph({
      entryModulePath: entry.path,
      entrySource: source,
      prependCode: "const React = require('react');\n",
      resolveRelativeModuleSource: options?.resolveRelativeModuleSource,
    });
    const exported = executeExplorerWidgetModuleGraph(transpiledGraph);
    const normalized = normalizeExplorerWidgetExport(exported, {
      id: fallbackId,
      title: fallbackTitle,
    });
    const descriptor = normalizeExplorerWidgetDescriptor(
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
      descriptor: normalizeExplorerWidgetDescriptor(
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

function executeExplorerWidgetModuleGraph(graph: RuntimeModuleGraph): unknown {
  return executeRuntimeModuleGraph(graph, {
    react: React,
    "lucide-react": LucideReact,
    [explorerWidgetRuntimeModuleName]: {
      defineExplorerWidget,
      PremiumSlider,
      OverlayScrollArea,
    },
  });
}

function normalizeExplorerWidgetExport(
  exported: unknown,
  fallbacks: { id: string; title: string },
): ExplorerWidgetDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, [
    "explorerWidget",
    "widget",
  ]);
  if (typeof candidate === "function") {
    return {
      descriptor: {
        id: fallbacks.id,
        title: fallbacks.title,
        shortLabel: fallbacks.title,
      },
      component: candidate as React.ComponentType<ExplorerWidgetProps>,
    };
  }
  if (candidate && typeof candidate === "object" && "component" in candidate) {
    const definition = candidate as ExplorerWidgetDefinition;
    if (typeof definition.component !== "function") {
      throw new Error(
        "Explorer widget export must provide a React component.",
      );
    }
    return definition;
  }
  throw new Error(
    "Explorer widget must export either a React component or defineExplorerWidget({ component }).",
  );
}

export interface ExplorerWasmWidgetSurfaceProps extends ExplorerWidgetProps {
  runtimeId: string;
  buildTarget?: WasmPanelBuildTarget | null;
}

export function ExplorerWasmWidgetSurface({
  descriptor,
  appearance,
  session,
  data,
  runtimeId,
  buildTarget = null,
  plugin,
}: ExplorerWasmWidgetSurfaceProps) {
  const context = useMemo<WasmPanelHostContext>(
    () => ({
      runtimeId,
      panelId: `explorer-widget.${descriptor.id}`,
      appearanceId: appearance.theme.id,
      densityToken: "compact",
      cssVariables: appearance.cssVars,
      assetUrls: {},
      size: {
        width: 0,
        height: 0,
      },
      surfaceKind: "explorer-widget",
      surfaceContext: {
        descriptor,
        session,
        data: {
          entries: data.entries,
          visibleEntries: data.visibleEntries,
          selectedEntries: data.selectedEntries,
          selectedPaths: data.selectedPaths,
          loading: data.loading,
          searchLoading: data.searchLoading,
        },
        plugin: plugin
          ? {
              id: plugin.id,
              name: plugin.name,
            }
          : null,
      },
    }),
    [appearance.cssVars, appearance.theme.id, data, descriptor, plugin, runtimeId, session],
  );

  return (
    <WasmPanelHost
      runtimeId={runtimeId}
      context={context}
      buildTarget={buildTarget ?? undefined}
    />
  );
}
