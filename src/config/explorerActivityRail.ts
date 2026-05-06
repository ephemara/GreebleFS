export type ExplorerActivityLaneId =
  | "files"
  | "search"
  | "semantic"
  | "preview"
  | "actions"
  | "tasks"
  | "terminal"
  | "customize";

export interface ExplorerActivityLaneDefinition {
  id: ExplorerActivityLaneId;
  label: string;
  iconName:
    | "FolderTree"
    | "Search"
    | "Database"
    | "Eye"
    | "Sparkles"
    | "ListTodo"
    | "TerminalSquare"
    | "Palette";
}

export type ExplorerActivityRailSide = "left" | "right";
export type ExplorerActivityLanePlacementById = Record<
  ExplorerActivityLaneId,
  ExplorerActivityRailSide
>;
export type ExplorerActivityLaneOrderBySide = Record<
  ExplorerActivityRailSide,
  ExplorerActivityLaneId[]
>;

export const defaultExplorerActivityLaneId: ExplorerActivityLaneId = "files";

export const explorerActivityLaneDefinitions: readonly ExplorerActivityLaneDefinition[] =
  [
    {
      id: "files",
      label: "Files",
      iconName: "FolderTree",
    },
    {
      id: "search",
      label: "Search",
      iconName: "Search",
    },
    {
      id: "semantic",
      label: "Semantic",
      iconName: "Database",
    },
    {
      id: "preview",
      label: "Preview",
      iconName: "Eye",
    },
    {
      id: "actions",
      label: "Actions",
      iconName: "Sparkles",
    },
    {
      id: "tasks",
      label: "Tasks",
      iconName: "ListTodo",
    },
    {
      id: "terminal",
      label: "Terminal",
      iconName: "TerminalSquare",
    },
    {
      id: "customize",
      label: "Customize",
      iconName: "Palette",
    },
  ];

const explorerActivityRailSides: readonly ExplorerActivityRailSide[] = [
  "left",
  "right",
];

const explorerActivityLaneIdSet = new Set<ExplorerActivityLaneId>(
  explorerActivityLaneDefinitions.map((lane) => lane.id),
);

export const explorerActivityLaneIds = explorerActivityLaneDefinitions.map(
  (lane) => lane.id,
) as readonly ExplorerActivityLaneId[];

export const defaultExplorerActivityLanePlacementById = {
  files: "left",
  search: "left",
  semantic: "left",
  preview: "right",
  actions: "right",
  tasks: "left",
  terminal: "left",
  customize: "right",
} satisfies ExplorerActivityLanePlacementById;

export const defaultExplorerActivityLaneOrderBySide = {
  left: ["files", "search", "semantic", "tasks", "terminal"],
  right: ["preview", "actions", "customize"],
} satisfies ExplorerActivityLaneOrderBySide;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function isExplorerActivityLaneId(
  value: unknown,
): value is ExplorerActivityLaneId {
  return typeof value === "string" && explorerActivityLaneIdSet.has(value as ExplorerActivityLaneId);
}

export function normalizeExplorerActivityLaneId(
  value: unknown,
): ExplorerActivityLaneId {
  return isExplorerActivityLaneId(value)
    ? value
    : defaultExplorerActivityLaneId;
}

export function normalizeExplorerActivityRailSide(
  value: unknown,
): ExplorerActivityRailSide {
  return value === "right" ? "right" : "left";
}

export function getExplorerActivityLaneDefinition(
  laneId: ExplorerActivityLaneId,
): ExplorerActivityLaneDefinition {
  return (
    explorerActivityLaneDefinitions.find((lane) => lane.id === laneId) ??
    explorerActivityLaneDefinitions[0]
  );
}

export function normalizeExplorerActivityLanePlacementById(
  value: unknown,
  fallback: ExplorerActivityLanePlacementById = defaultExplorerActivityLanePlacementById,
): ExplorerActivityLanePlacementById {
  const source = asRecord(value);
  const normalizedEntries = explorerActivityLaneIds.map((laneId) => [
    laneId,
    normalizeExplorerActivityRailSide(source?.[laneId] ?? fallback[laneId]),
  ] as const);
  return Object.fromEntries(
    normalizedEntries,
  ) as ExplorerActivityLanePlacementById;
}

export function normalizeExplorerActivityLaneOrderBySide(
  value: unknown,
  placementById: ExplorerActivityLanePlacementById = defaultExplorerActivityLanePlacementById,
  fallback: ExplorerActivityLaneOrderBySide = defaultExplorerActivityLaneOrderBySide,
): ExplorerActivityLaneOrderBySide {
  const source = asRecord(value);
  const normalized = {
    left: [] as ExplorerActivityLaneId[],
    right: [] as ExplorerActivityLaneId[],
  };

  for (const side of explorerActivityRailSides) {
    const seen = new Set<ExplorerActivityLaneId>();
    const rawOrder = Array.isArray(source?.[side]) ? source[side] : fallback[side];

    for (const laneIdValue of rawOrder) {
      if (!isExplorerActivityLaneId(laneIdValue)) {
        continue;
      }
      if (placementById[laneIdValue] !== side || seen.has(laneIdValue)) {
        continue;
      }
      seen.add(laneIdValue);
      normalized[side].push(laneIdValue);
    }

    for (const laneIdValue of fallback[side]) {
      if (placementById[laneIdValue] !== side || seen.has(laneIdValue)) {
        continue;
      }
      seen.add(laneIdValue);
      normalized[side].push(laneIdValue);
    }

    for (const laneIdValue of explorerActivityLaneIds) {
      if (placementById[laneIdValue] !== side || seen.has(laneIdValue)) {
        continue;
      }
      seen.add(laneIdValue);
      normalized[side].push(laneIdValue);
    }
  }

  return normalized;
}

export function getExplorerActivityLaneDefinitionsForRailSide(
  side: ExplorerActivityRailSide,
  placementById: ExplorerActivityLanePlacementById = defaultExplorerActivityLanePlacementById,
  orderBySide: ExplorerActivityLaneOrderBySide = defaultExplorerActivityLaneOrderBySide,
): readonly ExplorerActivityLaneDefinition[] {
  const normalizedPlacement = normalizeExplorerActivityLanePlacementById(
    placementById,
  );
  const normalizedOrder = normalizeExplorerActivityLaneOrderBySide(
    orderBySide,
    normalizedPlacement,
  );
  return normalizedOrder[side].map(getExplorerActivityLaneDefinition);
}

export function moveExplorerActivityLane(args: {
  laneId: ExplorerActivityLaneId;
  targetSide: ExplorerActivityRailSide;
  targetIndex: number;
  placementById: ExplorerActivityLanePlacementById;
  orderBySide: ExplorerActivityLaneOrderBySide;
}): {
  placementById: ExplorerActivityLanePlacementById;
  orderBySide: ExplorerActivityLaneOrderBySide;
} {
  const nextPlacementById = normalizeExplorerActivityLanePlacementById(
    {
      ...args.placementById,
      [args.laneId]: args.targetSide,
    },
    defaultExplorerActivityLanePlacementById,
  );
  const normalizedOrder = normalizeExplorerActivityLaneOrderBySide(
    args.orderBySide,
    nextPlacementById,
  );
  const nextOrderBySide = {
    left: normalizedOrder.left.filter((laneId) => laneId !== args.laneId),
    right: normalizedOrder.right.filter((laneId) => laneId !== args.laneId),
  } satisfies ExplorerActivityLaneOrderBySide;
  const targetSideOrder = nextOrderBySide[args.targetSide];
  const clampedTargetIndex = Math.max(
    0,
    Math.min(targetSideOrder.length, Math.trunc(args.targetIndex)),
  );
  targetSideOrder.splice(clampedTargetIndex, 0, args.laneId);
  return {
    placementById: nextPlacementById,
    orderBySide: normalizeExplorerActivityLaneOrderBySide(
      nextOrderBySide,
      nextPlacementById,
    ),
  };
}
