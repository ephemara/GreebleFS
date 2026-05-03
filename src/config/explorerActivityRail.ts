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
  utilityPane: "left" | "right" | "bottom" | "inline";
}

export type ExplorerActivityRailSide = "left" | "right";

export const defaultExplorerActivityLaneId: ExplorerActivityLaneId = "files";

export const explorerActivityLaneDefinitions: readonly ExplorerActivityLaneDefinition[] =
  [
    {
      id: "files",
      label: "Files",
      iconName: "FolderTree",
      utilityPane: "left",
    },
    {
      id: "search",
      label: "Search",
      iconName: "Search",
      utilityPane: "left",
    },
    {
      id: "semantic",
      label: "Semantic",
      iconName: "Database",
      utilityPane: "left",
    },
    {
      id: "preview",
      label: "Preview",
      iconName: "Eye",
      utilityPane: "right",
    },
    {
      id: "actions",
      label: "Actions",
      iconName: "Sparkles",
      utilityPane: "right",
    },
    {
      id: "tasks",
      label: "Tasks",
      iconName: "ListTodo",
      utilityPane: "left",
    },
    {
      id: "terminal",
      label: "Terminal",
      iconName: "TerminalSquare",
      utilityPane: "bottom",
    },
    {
      id: "customize",
      label: "Customize",
      iconName: "Palette",
      utilityPane: "right",
    },
  ];

export function normalizeExplorerActivityLaneId(
  value: unknown,
): ExplorerActivityLaneId {
  return explorerActivityLaneDefinitions.some((lane) => lane.id === value)
    ? (value as ExplorerActivityLaneId)
    : defaultExplorerActivityLaneId;
}

export function getExplorerActivityLaneDefinition(
  laneId: ExplorerActivityLaneId,
): ExplorerActivityLaneDefinition {
  return (
    explorerActivityLaneDefinitions.find((lane) => lane.id === laneId) ??
    explorerActivityLaneDefinitions[0]
  );
}

export const explorerActivityRailDefinitionsBySide = {
  left: explorerActivityLaneDefinitions.filter(
    (lane) => lane.utilityPane === "left" || lane.utilityPane === "bottom",
  ),
  right: explorerActivityLaneDefinitions.filter(
    (lane) => lane.utilityPane === "right",
  ),
} satisfies Record<ExplorerActivityRailSide, readonly ExplorerActivityLaneDefinition[]>;

export function getExplorerActivityLaneDefinitionsForRailSide(
  side: ExplorerActivityRailSide,
): readonly ExplorerActivityLaneDefinition[] {
  return explorerActivityRailDefinitionsBySide[side];
}
