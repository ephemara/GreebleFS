export type ExplorerBuiltInActivityLaneId =
  | "files"
  | "search"
  | "semantic"
  | "preview"
  | "actions"
  | "tasks"
  | "terminal"
  | "customize";

export type ExplorerContributedActivityLaneId =
  | `plugin:${string}:${string}`
  | `vscode:${string}:${string}`;

export type ExplorerActivityLaneId =
  | ExplorerBuiltInActivityLaneId
  | ExplorerContributedActivityLaneId
  | (string & {});

export type ExplorerActivityLaneSourceKind =
  | "built-in"
  | "plugin"
  | "vscode-vsix";

export type ExplorerActivityLaneViewRendererKind =
  | "react"
  | "wasm-panel"
  | "tree"
  | "webview";

export interface ExplorerActivityLaneViewDefinition {
  id: string;
  title: string;
  description?: string;
  order: number;
  rendererKind: ExplorerActivityLaneViewRendererKind;
  providerPending?: boolean;
  error?: string | null;
}

export interface ExplorerActivityLaneDefinition {
  id: ExplorerActivityLaneId;
  label: string;
  shortLabel?: string;
  iconName:
    | "FolderTree"
    | "Search"
    | "Database"
    | "Eye"
    | "Sparkles"
    | "ListTodo"
    | "Puzzle"
    | "TerminalSquare"
    | "Palette"
    | (string & {});
  iconUrl?: string;
  sourceKind?: ExplorerActivityLaneSourceKind;
  sourceLabel?: string;
  defaultSide?: ExplorerActivityRailSide;
  defaultOrder?: number;
  views?: readonly ExplorerActivityLaneViewDefinition[];
}

export type ExplorerActivityRailSide = "left" | "right";
export type ExplorerActivityLanePlacementById = Record<
  string,
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

export const defaultExplorerHiddenActivityLaneIds: ExplorerActivityLaneId[] =
  [];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function isExplorerBuiltInActivityLaneId(
  value: unknown,
): value is ExplorerBuiltInActivityLaneId {
  return typeof value === "string" && explorerActivityLaneIdSet.has(value as ExplorerActivityLaneId);
}

export function isExplorerActivityLaneId(
  value: unknown,
): value is ExplorerActivityLaneId {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 180 || /[\u0000-\u001f]/.test(normalized)) {
    return false;
  }
  if (explorerActivityLaneIdSet.has(normalized as ExplorerActivityLaneId)) {
    return true;
  }
  return /^(plugin|vscode):[A-Za-z0-9_.-]+:[A-Za-z0-9_.:-]+$/.test(normalized);
}

export function normalizeExplorerActivityLaneId(
  value: unknown,
): ExplorerActivityLaneId {
  return isExplorerActivityLaneId(value)
    ? value.trim()
    : defaultExplorerActivityLaneId;
}

export function normalizeExplorerActivityRailSide(
  value: unknown,
): ExplorerActivityRailSide {
  return value === "right" ? "right" : "left";
}

export function getExplorerActivityLaneDefinition(
  laneId: ExplorerActivityLaneId,
  laneDefinitions: readonly ExplorerActivityLaneDefinition[] = explorerActivityLaneDefinitions,
): ExplorerActivityLaneDefinition {
  return (
    laneDefinitions.find((lane) => lane.id === laneId) ??
    explorerActivityLaneDefinitions.find((lane) => lane.id === laneId) ??
    {
      id: laneId,
      label: laneId.split(":").pop() || String(laneId),
      iconName: "Puzzle",
      sourceKind: laneId.startsWith("vscode:") ? "vscode-vsix" : "plugin",
      defaultSide: "left",
      defaultOrder: 900,
      views: [],
    }
  );
}

export function getExplorerActivityLaneFallbackPlacementById(
  laneDefinitions: readonly ExplorerActivityLaneDefinition[] = explorerActivityLaneDefinitions,
): ExplorerActivityLanePlacementById {
  const placement: ExplorerActivityLanePlacementById = {
    ...defaultExplorerActivityLanePlacementById,
  };
  for (const lane of laneDefinitions) {
    if (!isExplorerActivityLaneId(lane.id)) {
      continue;
    }
    placement[lane.id] =
      lane.defaultSide ??
      (defaultExplorerActivityLanePlacementById as ExplorerActivityLanePlacementById)[lane.id] ??
      "left";
  }
  return placement;
}

export function getExplorerActivityLaneFallbackOrderBySide(
  laneDefinitions: readonly ExplorerActivityLaneDefinition[] = explorerActivityLaneDefinitions,
  placementById: ExplorerActivityLanePlacementById = getExplorerActivityLaneFallbackPlacementById(laneDefinitions),
): ExplorerActivityLaneOrderBySide {
  const orderBySide: ExplorerActivityLaneOrderBySide = {
    left: [...defaultExplorerActivityLaneOrderBySide.left],
    right: [...defaultExplorerActivityLaneOrderBySide.right],
  };
  const builtInLaneIds = new Set(explorerActivityLaneIds);
  const contributedLaneDefinitions = laneDefinitions
    .filter((lane) => isExplorerActivityLaneId(lane.id) && !builtInLaneIds.has(lane.id as ExplorerBuiltInActivityLaneId))
    .sort((left, right) => {
      const orderDelta = (left.defaultOrder ?? 900) - (right.defaultOrder ?? 900);
      return orderDelta !== 0 ? orderDelta : left.label.localeCompare(right.label);
    });
  for (const lane of contributedLaneDefinitions) {
    const side = placementById[lane.id] ?? lane.defaultSide ?? "left";
    if (!orderBySide[side].includes(lane.id)) {
      orderBySide[side].push(lane.id);
    }
  }
  return orderBySide;
}

export function normalizeExplorerActivityLanePlacementById(
  value: unknown,
  fallback: ExplorerActivityLanePlacementById = defaultExplorerActivityLanePlacementById,
): ExplorerActivityLanePlacementById {
  const source = asRecord(value);
  const normalized: ExplorerActivityLanePlacementById = {};
  const laneIds = new Set<string>([
    ...explorerActivityLaneIds,
    ...Object.keys(fallback),
    ...(source ? Object.keys(source) : []),
  ]);
  for (const laneIdValue of laneIds) {
    if (!isExplorerActivityLaneId(laneIdValue)) {
      continue;
    }
    normalized[laneIdValue] = normalizeExplorerActivityRailSide(
      source?.[laneIdValue] ?? fallback[laneIdValue],
    );
  }
  return normalized;
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

    for (const laneIdValue of Object.keys(placementById)) {
      if (
        !isExplorerActivityLaneId(laneIdValue) ||
        placementById[laneIdValue] !== side ||
        seen.has(laneIdValue)
      ) {
        continue;
      }
      seen.add(laneIdValue);
      normalized[side].push(laneIdValue);
    }
  }

  return normalized;
}

export function normalizeExplorerHiddenActivityLaneIds(
  value: unknown,
  fallback: readonly ExplorerActivityLaneId[] = defaultExplorerHiddenActivityLaneIds,
): ExplorerActivityLaneId[] {
  const source = Array.isArray(value) ? value : fallback;
  const hiddenLaneIds: ExplorerActivityLaneId[] = [];
  const seen = new Set<ExplorerActivityLaneId>();
  for (const laneIdValue of source) {
    if (!isExplorerActivityLaneId(laneIdValue) || seen.has(laneIdValue)) {
      continue;
    }
    seen.add(laneIdValue);
    hiddenLaneIds.push(laneIdValue);
  }
  return hiddenLaneIds;
}

export function getExplorerActivityLaneDefinitionsForRailSide(
  side: ExplorerActivityRailSide,
  placementById: ExplorerActivityLanePlacementById = defaultExplorerActivityLanePlacementById,
  orderBySide: ExplorerActivityLaneOrderBySide = defaultExplorerActivityLaneOrderBySide,
  hiddenLaneIds: readonly ExplorerActivityLaneId[] = defaultExplorerHiddenActivityLaneIds,
  laneDefinitions: readonly ExplorerActivityLaneDefinition[] = explorerActivityLaneDefinitions,
): readonly ExplorerActivityLaneDefinition[] {
  const normalizedPlacement = normalizeExplorerActivityLanePlacementById(
    placementById,
    getExplorerActivityLaneFallbackPlacementById(laneDefinitions),
  );
  const normalizedOrder = normalizeExplorerActivityLaneOrderBySide(
    orderBySide,
    normalizedPlacement,
    getExplorerActivityLaneFallbackOrderBySide(laneDefinitions, normalizedPlacement),
  );
  const hiddenLaneIdSet = new Set(
    normalizeExplorerHiddenActivityLaneIds(hiddenLaneIds),
  );
  return normalizedOrder[side]
    .filter((laneId) => !hiddenLaneIdSet.has(laneId))
    .map((laneId) => getExplorerActivityLaneDefinition(laneId, laneDefinitions));
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
