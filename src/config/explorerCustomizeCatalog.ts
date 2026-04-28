import shippedExplorerCustomizeControlManifestJson from "../../usr/explorer-customize-controls/greeblefs-core/explorer-customize-control.json";

import type { LoadedExplorerAction } from "./actionPacks";
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
  | "authored-actions"
  | "other";

export interface ExplorerCustomizeCatalogEntry {
  controlId: ExplorerChromeControlId;
  commandId: string;
  label: string;
  description: string;
  category: ExplorerCustomizeCatalogCategory;
  surfaces: ExplorerChromeSurfaceId[];
  source: "built-in" | "action" | "missing-action";
  supportsSizeVariant: boolean;
  supportsWidthPx: boolean;
  supportsLabelVisibility: boolean;
  supportsIconVisibility: boolean;
  sizeVariants: ExplorerChromeSizeVariant[];
  defaultWidthPx: number | null;
  minWidthPx: number | null;
  maxWidthPx: number | null;
  action?: LoadedExplorerAction;
}

interface ShippedExplorerCustomizeControlManifest {
  controls?: ExplorerCustomizeCatalogEntry[];
}

const shippedExplorerCustomizeControlManifest =
  shippedExplorerCustomizeControlManifestJson as ShippedExplorerCustomizeControlManifest;
const builtInExplorerCustomizeCatalogEntries = Array.isArray(
  shippedExplorerCustomizeControlManifest.controls,
)
  ? shippedExplorerCustomizeControlManifest.controls
  : [];

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
  return isExplorerActionChromeControlId(controlId)
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
  return titleCaseWords(controlId);
}

function createBuiltInExplorerCustomizeCatalogEntries(): ExplorerCustomizeCatalogEntry[] {
  return builtInExplorerCustomizeCatalogEntries.map(
    cloneExplorerCustomizeCatalogEntry,
  );
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

export function buildExplorerCustomizeCatalog(input: {
  actions?: LoadedExplorerAction[] | null;
  persistedEntries?: ExplorerChromeOverrideEntry[] | null;
}): ExplorerCustomizeCatalogEntry[] {
  const builtInEntries = createBuiltInExplorerCustomizeCatalogEntries();
  const actionEntries = (input.actions ?? []).map(
    createActionExplorerCustomizeCatalogEntry,
  );
  const knownControlIds = new Set<ExplorerChromeControlId>([
    ...builtInEntries.map((entry) => entry.controlId),
    ...actionEntries.map((entry) => entry.controlId),
  ]);
  const missingEntries = (input.persistedEntries ?? [])
    .filter((entry) => !knownControlIds.has(entry.controlId))
    .map(createMissingActionExplorerCustomizeCatalogEntry)
    .filter((entry): entry is ExplorerCustomizeCatalogEntry => entry != null);

  return [...builtInEntries, ...actionEntries, ...missingEntries].sort(
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
