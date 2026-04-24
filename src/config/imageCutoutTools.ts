export type ExplorerImageCutoutToolId = "spark" | "sweep";

export type ExplorerImageCutoutToolDefinition = {
  id: ExplorerImageCutoutToolId;
  label: string;
  description: string;
};

export const imageCutoutToolDefinitions = [
  {
    id: "spark",
    label: "Spark",
    description: "Click a connected color island near the cursor.",
  },
  {
    id: "sweep",
    label: "Sweep",
    description: "Brush across similar pixels to grow or trim the selection.",
  },
] as const satisfies readonly ExplorerImageCutoutToolDefinition[];

export const DEFAULT_IMAGE_CUTOUT_TOOL_ID: ExplorerImageCutoutToolId = "sweep";
