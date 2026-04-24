import type { ExplorerPreviewWildcardWorkflowTab } from "../components/explorer/explorerPreviewWorkflowTabs";

export type ExplorerImageCutoutWorkflowMode = "cutout" | "removeBackground";

export type ExplorerImageIsolationLaneDefinition = {
  id: ExplorerImageCutoutWorkflowMode;
  workflowTabId: string;
  label: string;
  workflowLabel: string;
  baseMode: ExplorerPreviewWildcardWorkflowTab["baseMode"];
  showsPromptSelection: boolean;
  resetLabel: string;
  emptySelectionMessage: string;
  readyMessage: string;
};

export type ExplorerImageCutoutRefineToolId = "brush" | "erase";

export type ExplorerImageCutoutRefineToolDefinition = {
  id: ExplorerImageCutoutRefineToolId;
  ariaLabel: string;
  description: string;
};

export const explorerImageIsolationLaneDefinitions = [
  {
    id: "cutout",
    workflowTabId: "cutout",
    label: "Cutout",
    workflowLabel: "Cutout",
    baseMode: "edit",
    showsPromptSelection: true,
    resetLabel: "Clear prompts",
    emptySelectionMessage: "Click to place a positive prompt. Alt-click or right-click removes.",
    readyMessage: "Click to select a subject. Drag to pan. Shift-drag exports a native cutout.",
  },
  {
    id: "removeBackground",
    workflowTabId: "remove-background",
    label: "Remove BG",
    workflowLabel: "Remove BG",
    baseMode: "edit",
    showsPromptSelection: false,
    resetLabel: "Re-run remove BG",
    emptySelectionMessage: "No automatic subject was detected yet.",
    readyMessage: "Auto background removal is ready. Drag to pan. Shift-drag exports a native cutout.",
  },
] as const satisfies readonly ExplorerImageIsolationLaneDefinition[];

export const explorerImageIsolationWorkflowTabs =
  explorerImageIsolationLaneDefinitions.map(
    ({ workflowTabId, label, baseMode }) =>
      ({
        id: workflowTabId,
        label,
        baseMode,
      }) satisfies ExplorerPreviewWildcardWorkflowTab,
  );

export const imageCutoutRefineToolDefinitions = [
  {
    id: "brush",
    ariaLabel: "Refine brush",
    description: "Brush similar pixels into the mask.",
  },
  {
    id: "erase",
    ariaLabel: "Refine erase",
    description: "Brush similar pixels out of the mask.",
  },
] as const satisfies readonly ExplorerImageCutoutRefineToolDefinition[];

export const DEFAULT_IMAGE_CUTOUT_WORKFLOW_MODE: ExplorerImageCutoutWorkflowMode =
  "cutout";
export const DEFAULT_IMAGE_CUTOUT_REFINE_TOOL_ID: ExplorerImageCutoutRefineToolId =
  "brush";

export function resolveExplorerImageIsolationLaneDefinition(
  workflowMode: ExplorerImageCutoutWorkflowMode,
): ExplorerImageIsolationLaneDefinition {
  return (
    explorerImageIsolationLaneDefinitions.find((lane) => lane.id === workflowMode) ??
    explorerImageIsolationLaneDefinitions[0]
  );
}
