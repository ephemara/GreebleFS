import shippedExplorerWorkspaceLayoutManifestJson from "../../usr/explorer-workspace-layouts/greeblefs-core/explorer-workspace-layout.json";

export type ExplorerPaneId = "pane-1" | "pane-2" | "pane-3" | "pane-4";
export type ExplorerWorkspaceLayoutMode =
  | "single"
  | "split"
  | "triple"
  | "quad";

export interface ExplorerWorkspaceLayoutDefinition {
  id: ExplorerWorkspaceLayoutMode;
  label: string;
  shortLabel: string;
  description: string;
  visiblePaneIds: ExplorerPaneId[];
  supportsColumnSplit: boolean;
  supportsRowSplit: boolean;
}

interface ShippedExplorerWorkspaceLayoutManifest {
  workspaceLayouts?: ExplorerWorkspaceLayoutDefinition[];
}

const shippedExplorerWorkspaceLayoutManifest =
  shippedExplorerWorkspaceLayoutManifestJson as ShippedExplorerWorkspaceLayoutManifest;
const builtInExplorerWorkspaceLayoutOrder = [
  "single",
  "split",
  "triple",
  "quad",
] as const satisfies readonly ExplorerWorkspaceLayoutMode[];

export const explorerPaneIds: ExplorerPaneId[] = [
  "pane-1",
  "pane-2",
  "pane-3",
  "pane-4",
];

const shippedExplorerWorkspaceLayouts = Array.isArray(
  shippedExplorerWorkspaceLayoutManifest.workspaceLayouts,
)
  ? shippedExplorerWorkspaceLayoutManifest.workspaceLayouts
  : [];
const shippedExplorerWorkspaceLayoutById = new Map(
  shippedExplorerWorkspaceLayouts.map((layout) => [layout.id, layout] as const),
);

const builtInExplorerWorkspaceLayouts = Object.fromEntries(
  builtInExplorerWorkspaceLayoutOrder.map((layoutId) => {
    const layout = shippedExplorerWorkspaceLayoutById.get(layoutId);
    if (!layout) {
      throw new Error(`Missing shipped explorer workspace layout: ${layoutId}`);
    }
    return [
      layoutId,
      { ...layout, visiblePaneIds: [...layout.visiblePaneIds] },
    ] as const;
  }),
) as Record<ExplorerWorkspaceLayoutMode, ExplorerWorkspaceLayoutDefinition>;

export const defaultExplorerWorkspaceLayoutMode: ExplorerWorkspaceLayoutMode =
  "single";
export const defaultExplorerWorkspaceAxisRatio = 0.5;
export const EXPLORER_WORKSPACE_AXIS_RATIO_BOUNDS = {
  min: 0.18,
  max: 0.82,
} as const;

export function normalizeExplorerWorkspaceLayoutMode(
  value: unknown,
): ExplorerWorkspaceLayoutMode {
  if (value === "split" || value === "dual") {
    return "split";
  }
  if (value === "triple" || value === "triad") {
    return "triple";
  }
  if (value === "quad") {
    return "quad";
  }
  return defaultExplorerWorkspaceLayoutMode;
}

export function getExplorerWorkspaceLayoutDefinition(
  layoutMode?: ExplorerWorkspaceLayoutMode | null,
): ExplorerWorkspaceLayoutDefinition {
  return builtInExplorerWorkspaceLayouts[
    normalizeExplorerWorkspaceLayoutMode(layoutMode)
  ];
}

export function getExplorerWorkspaceVisiblePaneIds(
  layoutMode?: ExplorerWorkspaceLayoutMode | null,
): ExplorerPaneId[] {
  return getExplorerWorkspaceLayoutDefinition(layoutMode).visiblePaneIds;
}

export function normalizeExplorerPaneId(value: unknown): ExplorerPaneId {
  switch (value) {
    case "pane-2":
    case "right":
      return "pane-2";
    case "pane-3":
      return "pane-3";
    case "pane-4":
      return "pane-4";
    case "pane-1":
    case "left":
    default:
      return "pane-1";
  }
}

export function getExplorerPaneIndex(paneId: ExplorerPaneId): number {
  return explorerPaneIds.indexOf(paneId);
}

export function getExplorerPaneLabel(paneId: ExplorerPaneId): string {
  return `Pane ${getExplorerPaneIndex(paneId) + 1}`;
}

export function createEmptyExplorerPaneRecord<T>(
  factory: () => T,
): Record<ExplorerPaneId, T> {
  return Object.fromEntries(
    explorerPaneIds.map((paneId) => [paneId, factory()]),
  ) as Record<ExplorerPaneId, T>;
}

export function clampExplorerWorkspaceAxisRatio(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultExplorerWorkspaceAxisRatio;
  }
  return Math.max(
    EXPLORER_WORKSPACE_AXIS_RATIO_BOUNDS.min,
    Math.min(EXPLORER_WORKSPACE_AXIS_RATIO_BOUNDS.max, value),
  );
}
