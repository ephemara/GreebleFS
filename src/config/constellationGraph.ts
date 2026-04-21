export type ConstellationLensId =
  | "structure"
  | "time"
  | "similarity"
  | "workflow";

export type ConstellationEdgeReasonKind =
  | "folderAnchor"
  | "sameParent"
  | "sharedStem"
  | "sameExtension"
  | "sharedPathToken"
  | "sharedTag"
  | "sameRecencyBucket"
  | "modifiedProximity"
  | "pinnedWorkset"
  | "selectionAdjacency"
  | "bookmarkAnchor";

export interface ConstellationLensDefinition {
  id: ConstellationLensId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface ConstellationReasonWeightMap {
  structure: number;
  time: number;
  similarity: number;
  workflow: number;
}

export interface ConstellationReasonDefinition {
  kind: ConstellationEdgeReasonKind;
  label: string;
  description: string;
}

export const CONSTELLATION_DEFAULT_LENS: ConstellationLensId = "workflow";

export const constellationLensDefinitions: readonly ConstellationLensDefinition[] =
  [
    {
      id: "structure",
      label: "Structure",
      shortLabel: "Struct",
      description: "Folder anchors, siblings, and file placement inside the map.",
    },
    {
      id: "time",
      label: "Time",
      shortLabel: "Time",
      description: "Recent work grouped by modification windows and temporal proximity.",
    },
    {
      id: "similarity",
      label: "Similarity",
      shortLabel: "Similar",
      description: "Heuristic similarity from stems, extensions, tokens, and shared tags.",
    },
    {
      id: "workflow",
      label: "Workflow",
      shortLabel: "Flow",
      description: "Blended next-step routing from structure, recency, and current workset context.",
    },
  ] as const;

const lensDefinitionLookup = new Map(
  constellationLensDefinitions.map((definition) => [definition.id, definition] as const),
);

export const constellationReasonDefinitions: readonly ConstellationReasonDefinition[] =
  [
    {
      kind: "folderAnchor",
      label: "Folder anchor",
      description: "A folder directly contains the neighboring file or folder.",
    },
    {
      kind: "sameParent",
      label: "Same folder",
      description: "These entries live under the same parent directory.",
    },
    {
      kind: "sharedStem",
      label: "Shared stem",
      description: "These files share the same basename stem.",
    },
    {
      kind: "sameExtension",
      label: "Same type",
      description: "These files share the same extension.",
    },
    {
      kind: "sharedPathToken",
      label: "Shared path tokens",
      description: "Their names or paths reuse the same meaningful tokens.",
    },
    {
      kind: "sharedTag",
      label: "Shared tags",
      description: "The same explorer tags are attached to both entries.",
    },
    {
      kind: "sameRecencyBucket",
      label: "Same time band",
      description: "Both entries were modified within the same recent time bucket.",
    },
    {
      kind: "modifiedProximity",
      label: "Modified nearby",
      description: "Their modification timestamps land close together.",
    },
    {
      kind: "pinnedWorkset",
      label: "Pinned workset",
      description: "Both entries are pinned into the current Constellation workset.",
    },
    {
      kind: "selectionAdjacency",
      label: "Selection adjacency",
      description: "This node sits close to the active selection context.",
    },
    {
      kind: "bookmarkAnchor",
      label: "Bookmark anchor",
      description: "A bookmarked path is reinforcing the relationship.",
    },
  ] as const;

const reasonDefinitionLookup = new Map(
  constellationReasonDefinitions.map((definition) => [definition.kind, definition] as const),
);

export const CONSTELLATION_REASON_WEIGHTS: Record<
  ConstellationEdgeReasonKind,
  ConstellationReasonWeightMap
> = Object.freeze({
  folderAnchor: {
    structure: 1.2,
    time: 0,
    similarity: 0.1,
    workflow: 0.82,
  },
  sameParent: {
    structure: 1.05,
    time: 0,
    similarity: 0.28,
    workflow: 0.58,
  },
  sharedStem: {
    structure: 0.22,
    time: 0,
    similarity: 1.14,
    workflow: 0.72,
  },
  sameExtension: {
    structure: 0.14,
    time: 0,
    similarity: 0.56,
    workflow: 0.18,
  },
  sharedPathToken: {
    structure: 0.18,
    time: 0,
    similarity: 0.38,
    workflow: 0.24,
  },
  sharedTag: {
    structure: 0.18,
    time: 0.08,
    similarity: 0.72,
    workflow: 0.92,
  },
  sameRecencyBucket: {
    structure: 0,
    time: 1.08,
    similarity: 0.16,
    workflow: 0.34,
  },
  modifiedProximity: {
    structure: 0,
    time: 0.78,
    similarity: 0.08,
    workflow: 0.26,
  },
  pinnedWorkset: {
    structure: 0.12,
    time: 0.06,
    similarity: 0.22,
    workflow: 1.02,
  },
  selectionAdjacency: {
    structure: 0.24,
    time: 0.1,
    similarity: 0.14,
    workflow: 0.86,
  },
  bookmarkAnchor: {
    structure: 0.18,
    time: 0.04,
    similarity: 0.08,
    workflow: 0.52,
  },
});

export const CONSTELLATION_MIN_EDGE_SCORE_BY_LENS: Record<
  ConstellationLensId,
  number
> = Object.freeze({
  structure: 0.52,
  time: 0.48,
  similarity: 0.46,
  workflow: 0.54,
});

export const CONSTELLATION_ROUTE_TARGET_LIMIT = 3;
export const CONSTELLATION_HOVER_REASON_LIMIT = 3;

export const CONSTELLATION_CONNECTION_DENSITY_BOUNDS = Object.freeze({
  minPerNode: 2,
  maxPerNode: 6,
  minTotal: 10,
  maxTotal: 30,
});

export function getConstellationLensDefinition(
  lensId: ConstellationLensId,
): ConstellationLensDefinition {
  return lensDefinitionLookup.get(lensId) ?? constellationLensDefinitions[0];
}

export function getConstellationReasonDefinition(
  reasonKind: ConstellationEdgeReasonKind,
): ConstellationReasonDefinition {
  return (
    reasonDefinitionLookup.get(reasonKind) ?? constellationReasonDefinitions[0]
  );
}

export function normalizeConstellationLensId(
  value: unknown,
): ConstellationLensId {
  return typeof value === "string" && lensDefinitionLookup.has(value as ConstellationLensId)
    ? (value as ConstellationLensId)
    : CONSTELLATION_DEFAULT_LENS;
}

export function stepConstellationLens(
  currentLens: ConstellationLensId,
  direction: "next" | "previous" = "next",
): ConstellationLensId {
  const currentIndex = constellationLensDefinitions.findIndex(
    (definition) => definition.id === currentLens,
  );
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const delta = direction === "previous" ? -1 : 1;
  const nextIndex =
    (safeIndex + delta + constellationLensDefinitions.length) %
    constellationLensDefinitions.length;
  return constellationLensDefinitions[nextIndex]?.id ?? CONSTELLATION_DEFAULT_LENS;
}
