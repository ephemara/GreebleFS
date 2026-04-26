export type ExplorerCollectionPreviewMode =
  | "list"
  | "overview"
  | "strata"
  | "timeline"
  | "orbit";

export interface ExplorerCollectionPreviewModeDefinition {
  id: ExplorerCollectionPreviewMode;
  label: string;
  description: string;
  iconId: "list" | "overview" | "strata" | "timeline" | "orbit";
}

export const explorerCollectionPreviewModes = [
  {
    id: "list",
    label: "List",
    description: "Dense row-based browser for exact names, dates, and sizes.",
    iconId: "list",
  },
  {
    id: "overview",
    label: "Overview",
    description:
      "Forced thumbnail mosaic for quick scanning, even when normal explorer thumbnails are off.",
    iconId: "overview",
  },
  {
    id: "strata",
    label: "Strata",
    description:
      "Category ribbons that keep folders, media, code, packages, and documents visually separated.",
    iconId: "strata",
  },
  {
    id: "timeline",
    label: "Timeline",
    description:
      "Recency-first icon river that surfaces fresh files before the older layers.",
    iconId: "timeline",
  },
  {
    id: "orbit",
    label: "Orbit",
    description:
      "Cluster cards with category hubs and orbiting entries for a more sculptural pane read.",
    iconId: "orbit",
  },
] as const satisfies readonly ExplorerCollectionPreviewModeDefinition[];

const DEFAULT_EXPLORER_COLLECTION_PREVIEW_MODE: ExplorerCollectionPreviewMode =
  "list";

const EXPLORER_COLLECTION_PREVIEW_MODE_IDS = new Set<ExplorerCollectionPreviewMode>(
  explorerCollectionPreviewModes.map((mode) => mode.id),
);

export function getExplorerCollectionPreviewModeDefinition(
  value: ExplorerCollectionPreviewMode,
): ExplorerCollectionPreviewModeDefinition {
  return (
    explorerCollectionPreviewModes.find((mode) => mode.id === value) ??
    explorerCollectionPreviewModes[0]
  );
}

export function normalizeExplorerCollectionPreviewMode(
  value: unknown,
): ExplorerCollectionPreviewMode {
  if (
    typeof value === "string" &&
    EXPLORER_COLLECTION_PREVIEW_MODE_IDS.has(
      value as ExplorerCollectionPreviewMode,
    )
  ) {
    return value as ExplorerCollectionPreviewMode;
  }
  return DEFAULT_EXPLORER_COLLECTION_PREVIEW_MODE;
}

export function stepExplorerCollectionPreviewMode(
  currentMode: ExplorerCollectionPreviewMode,
  direction: -1 | 1 = 1,
): ExplorerCollectionPreviewMode {
  const currentIndex = explorerCollectionPreviewModes.findIndex(
    (mode) => mode.id === currentMode,
  );
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex =
    (safeIndex + direction + explorerCollectionPreviewModes.length) %
    explorerCollectionPreviewModes.length;
  return explorerCollectionPreviewModes[nextIndex]?.id ?? currentMode;
}
