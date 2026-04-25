import type { LoadedExplorerAction } from "./actionPacks";
import type {
  BuiltInExplorerChromeControlId,
  ExplorerChromeControlId,
  ExplorerChromeSizeVariant,
  ExplorerChromeSurfaceId,
  ExplorerChromeOverrideEntry,
} from "./explorerChromeLayouts";
import {
  getSupportedExplorerChromeSurfaces,
  listBuiltInExplorerChromeControlIds,
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

const defaultActionChromeSurfaces: ExplorerChromeSurfaceId[] = [
  "explorerTopbar",
  "explorerToolbar",
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

function categorizeBuiltInExplorerChromeControl(
  controlId: BuiltInExplorerChromeControlId,
): ExplorerCustomizeCatalogCategory {
  if (
    controlId.startsWith("navigate") ||
    controlId === "addressBar" ||
    controlId.includes("Location")
  ) {
    return "navigation";
  }
  if (
    controlId.includes("Search") ||
    controlId.includes("search") ||
    controlId === "focusAddressBar"
  ) {
    return "search";
  }
  if (
    controlId.includes("Selection") ||
    controlId === "tagSelection" ||
    controlId === "selectionModeToggle"
  ) {
    return "selection";
  }
  if (
    controlId === "newFolder" ||
    controlId === "newFile" ||
    controlId === "pasteClipboard"
  ) {
    return "creation";
  }
  if (controlId.includes("workspace") || controlId.includes("Workspace")) {
    return "workspace";
  }
  if (controlId.startsWith("rail")) {
    return "rail";
  }
  if (controlId.startsWith("preview")) {
    return "preview";
  }
  if (controlId.startsWith("status") || controlId === "terminalDrawerToggle") {
    return "status";
  }
  if (
    controlId === "shellLayout" ||
    controlId === "viewLayout" ||
    controlId === "togglePreview" ||
    controlId === "toggleSources" ||
    controlId === "toggleHiddenFiles" ||
    controlId === "customizeModeToggle" ||
    controlId === "refresh" ||
    controlId === "experimentalModes"
  ) {
    return "layout";
  }
  if (controlId === "actionsPaneToggle") {
    return "actions";
  }
  if (
    controlId === "folderSizeSummary" ||
    controlId === "selectionSizeSummary" ||
    controlId === "duplicateScan" ||
    controlId === "undoTrash"
  ) {
    return "tasks";
  }
  return "other";
}

const unsupportedBuiltInExplorerCustomizeControlIds =
  new Set<BuiltInExplorerChromeControlId>([
    "workspacePaneCounts",
    "workspaceMode",
    "workspaceCommanderSummary",
    "workspaceLayoutHint",
    "workspaceTabs",
    "workspaceNewTab",
    "workspaceDuplicateTab",
    "workspaceFocusLeft",
    "workspaceFocusRight",
    "workspaceMoveTab",
    "workspaceSyncPath",
    "workspaceLinkNavigation",
    "workspaceCopyToPane",
    "workspaceMoveToPane",
    "workspaceSwapPane",
    "workspaceSplitToggle",
    "workspaceCloseTab",
    "workspaceSplitSummary",
    "workspaceSplitNudgeLeft",
    "workspaceSplitReset",
    "workspaceSplitNudgeRight",
  ]);

interface BuiltInExplorerCustomizeCapability {
  supportsSizeVariant?: boolean;
  supportsWidthPx?: boolean;
  supportsLabelVisibility?: boolean;
  supportsIconVisibility?: boolean;
  sizeVariants?: ExplorerChromeSizeVariant[];
  defaultWidthPx?: number | null;
  minWidthPx?: number | null;
  maxWidthPx?: number | null;
}

const builtInExplorerCustomizeCapabilities: Partial<
  Record<BuiltInExplorerChromeControlId, BuiltInExplorerCustomizeCapability>
> = {
  addressBar: {
    supportsSizeVariant: true,
    supportsWidthPx: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: 760,
    minWidthPx: 280,
    maxWidthPx: 1480,
  },
  recentLocations: {
    supportsWidthPx: true,
    defaultWidthPx: 260,
    minWidthPx: 150,
    maxWidthPx: 420,
  },
  pinnedLocations: {
    supportsWidthPx: true,
    defaultWidthPx: 260,
    minWidthPx: 150,
    maxWidthPx: 420,
  },
  archiveActions: {
    supportsSizeVariant: true,
    supportsWidthPx: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: 220,
    minWidthPx: 150,
    maxWidthPx: 420,
  },
  workspaceTabStrip: {
    supportsSizeVariant: true,
    supportsWidthPx: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: 760,
    minWidthPx: 320,
    maxWidthPx: 1600,
  },
  statusItemCount: {
    supportsWidthPx: true,
    defaultWidthPx: 180,
    minWidthPx: 120,
    maxWidthPx: 320,
  },
  statusModeProfile: {
    supportsWidthPx: true,
    defaultWidthPx: 180,
    minWidthPx: 120,
    maxWidthPx: 320,
  },
  statusViewSummary: {
    supportsWidthPx: true,
    defaultWidthPx: 200,
    minWidthPx: 140,
    maxWidthPx: 360,
  },
  statusPreviewSummary: {
    supportsWidthPx: true,
    defaultWidthPx: 260,
    minWidthPx: 160,
    maxWidthPx: 520,
  },
  statusSearchSummary: {
    supportsWidthPx: true,
    defaultWidthPx: 300,
    minWidthPx: 180,
    maxWidthPx: 620,
  },
  statusClipboardQueue: {
    supportsWidthPx: true,
    defaultWidthPx: 240,
    minWidthPx: 160,
    maxWidthPx: 480,
  },
  statusTaskBadge: {
    supportsSizeVariant: true,
    supportsWidthPx: true,
    sizeVariants: ["compact", "regular", "wide"],
    defaultWidthPx: 180,
    minWidthPx: 120,
    maxWidthPx: 320,
  },
  statusViewToggles: {
    supportsSizeVariant: true,
    sizeVariants: ["compact", "regular", "wide"],
  },
  terminalDrawerToggle: {
    supportsSizeVariant: true,
    sizeVariants: ["compact", "regular", "wide"],
  },
  actionsPaneToggle: {
    supportsSizeVariant: true,
    sizeVariants: ["compact", "regular", "wide"],
  },
  selectionModeToggle: {
    supportsSizeVariant: true,
    sizeVariants: ["compact", "regular", "wide"],
  },
  togglePreview: {
    supportsSizeVariant: true,
    sizeVariants: ["compact", "regular", "wide"],
  },
  customizeModeToggle: {
    supportsSizeVariant: true,
    sizeVariants: ["compact", "regular", "wide"],
  },
};

function createBuiltInExplorerCustomizeCatalogEntries(): ExplorerCustomizeCatalogEntry[] {
  return listBuiltInExplorerChromeControlIds()
    .filter(
      (controlId) =>
        !unsupportedBuiltInExplorerCustomizeControlIds.has(controlId),
    )
    .map((controlId) => {
      const capabilities = builtInExplorerCustomizeCapabilities[controlId];
      return {
        controlId,
        commandId: getExplorerChromeCommandId(controlId),
        label: humanizeExplorerChromeControlId(controlId),
        description: `${humanizeExplorerChromeControlId(controlId)} control`,
        category: categorizeBuiltInExplorerChromeControl(controlId),
        surfaces: getSupportedExplorerChromeSurfaces(controlId),
        source: "built-in",
        supportsSizeVariant: capabilities?.supportsSizeVariant ?? false,
        supportsWidthPx: capabilities?.supportsWidthPx ?? false,
        supportsLabelVisibility: capabilities?.supportsLabelVisibility ?? false,
        supportsIconVisibility: capabilities?.supportsIconVisibility ?? false,
        sizeVariants: capabilities?.sizeVariants ?? ["regular"],
        defaultWidthPx: capabilities?.defaultWidthPx ?? null,
        minWidthPx: capabilities?.minWidthPx ?? null,
        maxWidthPx: capabilities?.maxWidthPx ?? null,
      };
    });
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
