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

export type ExplorerImageCutoutStageToolId =
  | "aiSelect"
  | "quickSelect"
  | "magicWand"
  | "lasso"
  | "brush"
  | "erase";

export type ExplorerImageCutoutStageToolDefinition = {
  id: ExplorerImageCutoutStageToolId;
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
  usesBrushReach: boolean;
  usesBrushSoftness: boolean;
  supportsNegativeMode: boolean;
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
    label: "AI Select",
    ariaLabel: "AI Select",
    description: "Click positive prompts or Alt-click negative prompts for semantic cutout guidance.",
    iconName: "Bot",
    usesBrushSize: false,
    usesBrushReach: false,
    usesBrushSoftness: false,
    supportsNegativeMode: true,
  },
  {
    id: "quickSelect",
    label: "Quick Select",
    ariaLabel: "Quick Select",
    description: "Brush similar pixels into the mask with color-aware local selection.",
    iconName: "ScanLine",
    usesBrushSize: true,
    usesBrushReach: true,
    usesBrushSoftness: true,
    supportsNegativeMode: true,
  },
  {
    id: "magicWand",
    label: "Magic Wand",
    ariaLabel: "Magic Wand",
    description: "Click a contiguous color island to add or subtract it from the mask.",
    iconName: "Sparkles",
    usesBrushSize: false,
    usesBrushReach: true,
    usesBrushSoftness: false,
    supportsNegativeMode: true,
  },
  {
    id: "lasso",
    label: "Lasso",
    ariaLabel: "Lasso",
    description: "Draw a freeform lasso around the subject to add or subtract a region.",
    iconName: "Scissors",
    usesBrushSize: false,
    usesBrushReach: false,
    usesBrushSoftness: false,
    supportsNegativeMode: true,
  },
  {
    id: "brush",
    label: "Brush",
    ariaLabel: "Brush",
    description: "Paint directly into the mask with a soft circular brush.",
    iconName: "Pencil",
    usesBrushSize: true,
    usesBrushReach: false,
    usesBrushSoftness: true,
    supportsNegativeMode: false,
  },
  {
    id: "erase",
    label: "Erase",
    ariaLabel: "Erase",
    description: "Paint directly out of the mask with a soft circular erase brush.",
    iconName: "Eraser",
    usesBrushSize: true,
    usesBrushReach: false,
    usesBrushSoftness: true,
    supportsNegativeMode: false,
  },
] as const satisfies readonly ExplorerImageCutoutStageToolDefinition[];

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
