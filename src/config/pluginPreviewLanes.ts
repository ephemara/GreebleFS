export type OverlayPluginPreviewLaneMatchAppliesTo =
  | "any"
  | "file"
  | "directory";

export interface OverlayPluginPreviewLaneMatchRule {
  appliesTo: OverlayPluginPreviewLaneMatchAppliesTo;
  extensions: string[];
  fileNames: string[];
}

export interface OverlayPluginPreviewLaneCapabilityFlags {
  editable: boolean;
  save: boolean;
  export: boolean;
  workflowTabs: boolean;
  contextMenu: boolean;
  prefetch: boolean;
  closeGuard: boolean;
}

export interface OverlayPluginPreviewLaneDescriptor {
  id: string;
  pluginId: string;
  pluginName: string;
  title: string;
  priority: number;
  rendererEntry: string;
  runtimeId: string | null;
  match: OverlayPluginPreviewLaneMatchRule;
  capabilities: OverlayPluginPreviewLaneCapabilityFlags;
}

export const DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY = 500;

export function normalizeOverlayPluginPreviewLaneMatchRule(
  value: Partial<OverlayPluginPreviewLaneMatchRule> | null | undefined,
): OverlayPluginPreviewLaneMatchRule {
  const appliesTo =
    value?.appliesTo === "any" ||
    value?.appliesTo === "directory" ||
    value?.appliesTo === "file"
      ? value.appliesTo
      : "file";
  return {
    appliesTo,
    extensions: normalizeOverlayPluginPreviewLaneStringList(value?.extensions),
    fileNames: normalizeOverlayPluginPreviewLaneStringList(value?.fileNames),
  };
}

export function normalizeOverlayPluginPreviewLaneCapabilities(
  value: Partial<OverlayPluginPreviewLaneCapabilityFlags> | null | undefined,
): OverlayPluginPreviewLaneCapabilityFlags {
  return {
    editable: value?.editable === true,
    save: value?.save === true,
    export: value?.export === true,
    workflowTabs: value?.workflowTabs === true,
    contextMenu: value?.contextMenu === true,
    prefetch: value?.prefetch === true,
    closeGuard: value?.closeGuard === true,
  };
}

function normalizeOverlayPluginPreviewLaneStringList(
  value: string[] | null | undefined,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
