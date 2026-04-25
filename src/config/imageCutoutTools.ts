import type { ExplorerPreviewWildcardWorkflowTab } from "../components/explorer/explorerPreviewWorkflowTabs";

export type ExplorerImageCutoutWorkflowMode = "cutout" | "removeBackground";

export type ExplorerImageIsolationLaneDefinition = {
  id: ExplorerImageCutoutWorkflowMode;
  workflowTabId: string;
  label: string;
  workflowLabel: string;
  baseMode: ExplorerPreviewWildcardWorkflowTab["baseMode"];
  showWorkflowTab: boolean;
  resetLabel: string;
  emptySelectionMessage: string;
  readyMessage: string;
};

export type ExplorerImageCutoutToolGroupId =
  | "smartSelect"
  | "shapeSelect"
  | "paint";

export type ExplorerImageCutoutStageToolId =
  | "aiSelect"
  | "quickSelect"
  | "magicWand"
  | "lasso"
  | "brush"
  | "erase";

export type ExplorerImageCutoutStageToolDefinition = {
  id: ExplorerImageCutoutStageToolId;
  groupId: ExplorerImageCutoutToolGroupId;
  label: string;
  ariaLabel: string;
  description: string;
  iconName:
    | "Bot"
    | "ScanLine"
    | "Sparkles"
    | "Scissors"
    | "Pencil"
    | "Eraser";
  usesBrushSize: boolean;
  usesTolerance: boolean;
  usesBrushSoftness: boolean;
  usesContiguous: boolean;
  usesEdgeAwareness: boolean;
  supportsNegativeMode: boolean;
};

export type ExplorerImageCutoutToolGroupDefinition = {
  id: ExplorerImageCutoutToolGroupId;
  label: string;
  ariaLabel: string;
  description: string;
  toolIds: readonly ExplorerImageCutoutStageToolId[];
};

export const explorerImageIsolationLaneDefinitions = [
  {
    id: "cutout",
    workflowTabId: "cutout",
    label: "Cutout",
    workflowLabel: "Cutout",
    baseMode: "edit",
    showWorkflowTab: true,
    resetLabel: "Clear Cutout",
    emptySelectionMessage: "Choose a tool and start isolating the subject.",
    readyMessage: "Cutout is ready for prompt, wand, lasso, and brush isolation.",
  },
  {
    id: "removeBackground",
    workflowTabId: "cutout",
    label: "Remove BG",
    workflowLabel: "Remove BG",
    baseMode: "edit",
    showWorkflowTab: false,
    resetLabel: "Re-run remove BG",
    emptySelectionMessage: "No automatic subject was detected yet.",
    readyMessage: "Auto background removal is ready to merge into Cutout.",
  },
] as const satisfies readonly ExplorerImageIsolationLaneDefinition[];

export const explorerImageIsolationWorkflowTabs =
  explorerImageIsolationLaneDefinitions
    .filter((laneDefinition) => laneDefinition.showWorkflowTab)
    .map(
      ({ workflowTabId, label, baseMode }) =>
        ({
          id: workflowTabId,
          label,
          baseMode,
        }) satisfies ExplorerPreviewWildcardWorkflowTab,
    );

export const explorerImageCutoutStageToolDefinitions = [
  {
    id: "aiSelect",
    groupId: "smartSelect",
    label: "AI Select",
    ariaLabel: "AI Select",
    description: "Click positive prompts or Alt-click negative prompts for semantic cutout guidance.",
    iconName: "Bot",
    usesBrushSize: false,
    usesTolerance: false,
    usesBrushSoftness: false,
    usesContiguous: false,
    usesEdgeAwareness: false,
    supportsNegativeMode: true,
  },
  {
    id: "quickSelect",
    groupId: "smartSelect",
    label: "Quick Select",
    ariaLabel: "Quick Select",
    description:
      "Brush across the subject with an edge-aware local grow pass that follows texture and contrast boundaries.",
    iconName: "ScanLine",
    usesBrushSize: true,
    usesTolerance: true,
    usesBrushSoftness: true,
    usesContiguous: false,
    usesEdgeAwareness: true,
    supportsNegativeMode: true,
  },
  {
    id: "magicWand",
    groupId: "smartSelect",
    label: "Magic Wand",
    ariaLabel: "Magic Wand",
    description:
      "Click a perceptual color region to add or subtract it from the mask, with optional contiguous-only flood fill.",
    iconName: "Sparkles",
    usesBrushSize: false,
    usesTolerance: true,
    usesBrushSoftness: false,
    usesContiguous: true,
    usesEdgeAwareness: false,
    supportsNegativeMode: true,
  },
  {
    id: "lasso",
    groupId: "shapeSelect",
    label: "Lasso",
    ariaLabel: "Lasso",
    description: "Draw a freeform lasso around the subject to add or subtract a region.",
    iconName: "Scissors",
    usesBrushSize: false,
    usesTolerance: false,
    usesBrushSoftness: false,
    usesContiguous: false,
    usesEdgeAwareness: false,
    supportsNegativeMode: true,
  },
  {
    id: "brush",
    groupId: "paint",
    label: "Brush",
    ariaLabel: "Brush",
    description: "Paint directly into the mask with a soft circular brush.",
    iconName: "Pencil",
    usesBrushSize: true,
    usesTolerance: false,
    usesBrushSoftness: true,
    usesContiguous: false,
    usesEdgeAwareness: false,
    supportsNegativeMode: false,
  },
  {
    id: "erase",
    groupId: "paint",
    label: "Erase",
    ariaLabel: "Erase",
    description: "Paint directly out of the mask with a soft circular erase brush.",
    iconName: "Eraser",
    usesBrushSize: true,
    usesTolerance: false,
    usesBrushSoftness: true,
    usesContiguous: false,
    usesEdgeAwareness: false,
    supportsNegativeMode: false,
  },
] as const satisfies readonly ExplorerImageCutoutStageToolDefinition[];

export const explorerImageCutoutToolGroupDefinitions = [
  {
    id: "smartSelect",
    label: "Smart Select",
    ariaLabel: "Smart select tools",
    description:
      "Semantic prompting, quick selection, and the magic wand live in one Photoshop-style tool family.",
    toolIds: ["aiSelect", "quickSelect", "magicWand"],
  },
  {
    id: "shapeSelect",
    label: "Region Select",
    ariaLabel: "Region select tools",
    description: "Draw manual shape selections such as freeform lasso regions.",
    toolIds: ["lasso"],
  },
  {
    id: "paint",
    label: "Paint",
    ariaLabel: "Paint tools",
    description: "Direct matte painting tools for adding to or erasing from the mask.",
    toolIds: ["brush", "erase"],
  },
] as const satisfies readonly ExplorerImageCutoutToolGroupDefinition[];

export const DEFAULT_IMAGE_CUTOUT_WORKFLOW_MODE: ExplorerImageCutoutWorkflowMode =
  "cutout";
export const DEFAULT_IMAGE_CUTOUT_STAGE_TOOL_ID: ExplorerImageCutoutStageToolId =
  "aiSelect";

export function resolveExplorerImageIsolationLaneDefinition(
  workflowMode: ExplorerImageCutoutWorkflowMode,
): ExplorerImageIsolationLaneDefinition {
  return (
    explorerImageIsolationLaneDefinitions.find((lane) => lane.id === workflowMode) ??
    explorerImageIsolationLaneDefinitions[0]
  );
}

export function resolveExplorerImageCutoutStageToolDefinition(
  toolId: ExplorerImageCutoutStageToolId,
): ExplorerImageCutoutStageToolDefinition {
  return (
    explorerImageCutoutStageToolDefinitions.find((toolDefinition) => toolDefinition.id === toolId) ??
    explorerImageCutoutStageToolDefinitions[0]
  );
}

export function resolveExplorerImageCutoutToolGroupDefinition(
  groupId: ExplorerImageCutoutToolGroupId,
): ExplorerImageCutoutToolGroupDefinition {
  return (
    explorerImageCutoutToolGroupDefinitions.find((groupDefinition) => groupDefinition.id === groupId) ??
    explorerImageCutoutToolGroupDefinitions[0]
  );
}

export function resolveExplorerImageCutoutToolGroupForTool(
  toolId: ExplorerImageCutoutStageToolId,
): ExplorerImageCutoutToolGroupDefinition {
  const toolDefinition = resolveExplorerImageCutoutStageToolDefinition(toolId);
  return resolveExplorerImageCutoutToolGroupDefinition(toolDefinition.groupId);
}
