import shippedExplorerCustomizeControlManifestJson from "../../usr/profiles/default/explorer-customize-controls/greeblefs-core/explorer-customize-control.json";

import type { LoadedExplorerAction } from "./actionPacks";
import type { LoadedExplorerWidgetDefinition } from "./explorerWidgets";
import type {
  OverlayPluginExplorerWidgetContribution,
} from "./pluginContributions";
import type {
  ExplorerChromeControlId,
  ExplorerChromeOverrideEntry,
  ExplorerChromeSizeVariant,
  ExplorerChromeSurfaceId,
} from "./explorerChromeLayouts";

export type ExplorerCustomizeCatalogCategory =
  | "navigation"
  | "search"
  | "selection"
  | "creation"
  | "layout"
  | "actions"
  | "preview"
  | "workspace"
  | "rail"
  | "status"
  | "tasks"
  | "widgets"
  | "authored-actions"
  | "other";

export interface ExplorerCustomizeCatalogEntry {
  controlId: ExplorerChromeControlId;
  commandId: string;
  label: string;
  description: string;
  category: ExplorerCustomizeCatalogCategory;
  surfaces: ExplorerChromeSurfaceId[];
  source: "built-in" | "action" | "widget" | "missing-action" | "missing-widget";
  supportsSizeVariant: boolean;
  supportsWidthPx: boolean;
  supportsLabelVisibility: boolean;
  supportsIconVisibility: boolean;
  sizeVariants: ExplorerChromeSizeVariant[];
  defaultWidthPx: number | null;
  minWidthPx: number | null;
  maxWidthPx: number | null;
  action?: LoadedExplorerAction;
  widget?: LoadedExplorerWidgetDefinition | OverlayPluginExplorerWidgetContribution;
}

interface ShippedExplorerCustomizeControlManifest {
  controls?: ExplorerCustomizeCatalogEntry[];
}

const defaultActionChromeSurfaces: ExplorerChromeSurfaceId[] = [
  "explorerTopbar",
  "explorerToolbar",
  "workspaceHeader",
  "previewHeader",
  "explorerStatusBar",
];

function titleCaseWords(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function cloneExplorerCustomizeCatalogEntry(
  entry: ExplorerCustomizeCatalogEntry,
): ExplorerCustomizeCatalogEntry {
  return {
    ...entry,
    surfaces: [...entry.surfaces],
    sizeVariants: [...entry.sizeVariants],
  };
}

let builtInExplorerCustomizeCatalogEntries: ExplorerCustomizeCatalogEntry[] = [];

export function applyUsrExplorerCustomizeControlManifest(
  manifest: ShippedExplorerCustomizeControlManifest | null | undefined,
): void {
  builtInExplorerCustomizeCatalogEntries = Array.isArray(manifest?.controls)
    ? manifest.controls.map(cloneExplorerCustomizeCatalogEntry)
    : [];
}

applyUsrExplorerCustomizeControlManifest(
  shippedExplorerCustomizeControlManifestJson as ShippedExplorerCustomizeControlManifest,
);

export function toExplorerActionChromeControlId(
  actionId: string,
): `action:${string}` {
  return `action:${actionId}` as const;
}

export function isExplorerActionChromeControlId(
  controlId: ExplorerChromeControlId,
): controlId is `action:${string}` {
  return controlId.startsWith("action:");
}

export function getExplorerActionIdFromChromeControlId(
  controlId: ExplorerChromeControlId,
): string | null {
  return isExplorerActionChromeControlId(controlId)
    ? controlId.slice("action:".length)
    : null;
}

export function getExplorerChromeCommandId(
  controlId: ExplorerChromeControlId,
): string {
  return isExplorerActionChromeControlId(controlId) || controlId.startsWith("widget:")
    ? controlId
    : `explorer-control:${controlId}`;
}

export function humanizeExplorerChromeControlId(
  controlId: ExplorerChromeControlId,
): string {
  if (isExplorerActionChromeControlId(controlId)) {
    return titleCaseWords(
      getExplorerActionIdFromChromeControlId(controlId) ?? controlId,
    );
  }
  if (controlId.startsWith("plugin:")) {
    return titleCaseWords(controlId.slice("plugin:".length));
  }
  if (controlId.startsWith("widget:")) {
    return titleCaseWords(controlId.slice("widget:".length));
  }
  return titleCaseWords(controlId);
}

function createBuiltInExplorerCustomizeCatalogEntries(): ExplorerCustomizeCatalogEntry[] {
  return builtInExplorerCustomizeCatalogEntries.map(
    cloneExplorerCustomizeCatalogEntry,
  );
}

function normalizeExplorerCustomizeCatalogCategory(
  category: string | null | undefined,
): ExplorerCustomizeCatalogCategory {
  switch (category) {
    case "navigation":
    case "search":
    case "selection":
    case "creation":
    case "layout":
    case "actions":
    case "preview":
    case "workspace":
    case "rail":
    case "status":
    case "tasks":
    case "widgets":
    case "authored-actions":
    case "other":
      return category;
    default:
      return "widgets";
  }
}

function createActionExplorerCustomizeCatalogEntry(
  action: LoadedExplorerAction,
): ExplorerCustomizeCatalogEntry {
  const controlId = toExplorerActionChromeControlId(action.id);
  return {
    controlId,
    commandId: getExplorerChromeCommandId(controlId),
    label: action.title,
    description: action.description?.trim() || `${action.packName} action`,
    category: "authored-actions",
    surfaces: [...defaultActionChromeSurfaces],
    source: "action",
    supportsSizeVariant: true,
    supportsWidthPx: false,
    supportsLabelVisibility: true,
    supportsIconVisibility: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: null,
    minWidthPx: null,
    maxWidthPx: null,
    action,
  };
}

function createWidgetExplorerCustomizeCatalogEntry(
  widget: LoadedExplorerWidgetDefinition | OverlayPluginExplorerWidgetContribution,
): ExplorerCustomizeCatalogEntry {
  return {
    controlId: widget.chromeControlId,
    commandId: getExplorerChromeCommandId(widget.chromeControlId),
    label: widget.title,
    description: widget.description?.trim() || `${widget.sourceLabel} widget`,
    category: normalizeExplorerCustomizeCatalogCategory(widget.category),
    surfaces: [...widget.surfaces.chrome],
    source: "widget",
    supportsSizeVariant: true,
    supportsWidthPx: widget.sizing.supportsWidthPx,
    supportsLabelVisibility: widget.sizing.supportsLabelVisibility,
    supportsIconVisibility: widget.sizing.supportsIconVisibility,
    sizeVariants: [...widget.sizing.sizeVariants],
    defaultWidthPx: widget.sizing.defaultWidthPx,
    minWidthPx: widget.sizing.minWidthPx,
    maxWidthPx: widget.sizing.maxWidthPx,
    widget,
  };
}

function createMissingActionExplorerCustomizeCatalogEntry(
  entry: ExplorerChromeOverrideEntry,
): ExplorerCustomizeCatalogEntry | null {
  if (!isExplorerActionChromeControlId(entry.controlId)) {
    return null;
  }
  const actionId = getExplorerActionIdFromChromeControlId(entry.controlId);
  return {
    controlId: entry.controlId,
    commandId: getExplorerChromeCommandId(entry.controlId),
    label: `Missing Action: ${titleCaseWords(actionId ?? entry.controlId)}`,
    description:
      "The authored action is no longer loaded. Restore the pack or replace this placed control.",
    category: "authored-actions",
    surfaces: [entry.surfaceId],
    source: "missing-action",
    supportsSizeVariant: true,
    supportsWidthPx: false,
    supportsLabelVisibility: true,
    supportsIconVisibility: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: null,
    minWidthPx: null,
    maxWidthPx: null,
  };
}

function createMissingWidgetExplorerCustomizeCatalogEntry(
  entry: ExplorerChromeOverrideEntry,
): ExplorerCustomizeCatalogEntry | null {
  if (!entry.controlId.startsWith("widget:")) {
    return null;
  }
  return {
    controlId: entry.controlId,
    commandId: getExplorerChromeCommandId(entry.controlId),
    label: `Missing Widget: ${titleCaseWords(entry.controlId.slice("widget:".length))}`,
    description:
      "The authored widget is no longer loaded. Restore the widget package or replace this placement.",
    category: "widgets",
    surfaces: [entry.surfaceId],
    source: "missing-widget",
    supportsSizeVariant: true,
    supportsWidthPx: true,
    supportsLabelVisibility: true,
    supportsIconVisibility: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: null,
    minWidthPx: null,
    maxWidthPx: null,
  };
}

export function buildExplorerCustomizeCatalog(input: {
  actions?: LoadedExplorerAction[] | null;
  widgets?: LoadedExplorerWidgetDefinition[] | null;
  pluginWidgets?: OverlayPluginExplorerWidgetContribution[] | null;
  persistedEntries?: ExplorerChromeOverrideEntry[] | null;
}): ExplorerCustomizeCatalogEntry[] {
  const builtInEntries = createBuiltInExplorerCustomizeCatalogEntries();
  const actionEntries = (input.actions ?? []).map(
    createActionExplorerCustomizeCatalogEntry,
  );
  const widgetEntries = [
    ...(input.widgets ?? []),
    ...(input.pluginWidgets ?? []),
  ].map(createWidgetExplorerCustomizeCatalogEntry);
  const knownControlIds = new Set<ExplorerChromeControlId>([
    ...builtInEntries.map((entry) => entry.controlId),
    ...actionEntries.map((entry) => entry.controlId),
    ...widgetEntries.map((entry) => entry.controlId),
  ]);
  const missingEntries = (input.persistedEntries ?? [])
    .filter((entry) => !knownControlIds.has(entry.controlId))
    .map((entry) =>
      createMissingActionExplorerCustomizeCatalogEntry(entry) ??
      createMissingWidgetExplorerCustomizeCatalogEntry(entry),
    )
    .filter((entry): entry is ExplorerCustomizeCatalogEntry => entry != null);

  return [...builtInEntries, ...actionEntries, ...widgetEntries, ...missingEntries].sort(
    (left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }
      return left.label.localeCompare(right.label);
    },
  );
}

export function resolveExplorerCustomizeCatalogEntry(
  catalog: ExplorerCustomizeCatalogEntry[],
  controlId: ExplorerChromeControlId | null | undefined,
): ExplorerCustomizeCatalogEntry | null {
  if (!controlId) {
    return null;
  }
  return catalog.find((entry) => entry.controlId === controlId) ?? null;
}

export function resolveExplorerChromeCommandLabel(
  commandId: string,
  catalog: ExplorerCustomizeCatalogEntry[],
): string {
  const matchingEntry = catalog.find((entry) => entry.commandId === commandId);
  return (
    matchingEntry?.label ??
    titleCaseWords(commandId.replace(/^explorer-control:/, ""))
  );
}
