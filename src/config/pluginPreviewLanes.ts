import {
  normalizeExplorerPreviewWorkbenchChromeMetadata,
  type ExplorerPreviewWorkbenchChromeDefaults,
  type ExplorerPreviewWorkbenchChromeMetadata,
  type ExplorerPreviewWorkbenchChromeMetadataInput,
} from './previewWorkbenchChrome';

export type OverlayPluginPreviewLaneMatchAppliesTo =
  | "any"
  | "file"
  | "directory";

export type OverlayPluginPreviewLaneMatchPreviewKind =
  | "folder"
  | "model3d"
  | "archive"
  | "audio"
  | "video"
  | "font"
  | "image"
  | "pdf"
  | "spreadsheet"
  | "docx"
  | "shader"
  | "script"
  | "text";

export interface OverlayPluginPreviewLaneMatchRule {
  appliesTo: OverlayPluginPreviewLaneMatchAppliesTo;
  extensions: string[];
  fileNames: string[];
  previewKinds: OverlayPluginPreviewLaneMatchPreviewKind[];
}

export interface OverlayPluginPreviewLaneMatchRuleInput {
  appliesTo?: OverlayPluginPreviewLaneMatchAppliesTo;
  extensions?: string[];
  fileNames?: string[];
  previewKinds?: string[];
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
  rendererKind: 'react' | 'wasm-panel';
  rendererEntry: string | null;
  runtimeId: string | null;
  runtimeSurfaceId: string | null;
  buildTarget: string | null;
  match: OverlayPluginPreviewLaneMatchRule;
  capabilities: OverlayPluginPreviewLaneCapabilityFlags;
  workbenchChrome: ExplorerPreviewWorkbenchChromeMetadata;
}

export const DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY = 500;

export function normalizeOverlayPluginPreviewLaneMatchRule(
  value: OverlayPluginPreviewLaneMatchRuleInput | null | undefined,
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
    previewKinds: normalizeOverlayPluginPreviewLanePreviewKindList(
      value?.previewKinds,
    ),
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

export function normalizeOverlayPluginPreviewLaneWorkbenchChrome(
  value: ExplorerPreviewWorkbenchChromeMetadataInput | null | undefined,
  defaults: ExplorerPreviewWorkbenchChromeDefaults = {},
): ExplorerPreviewWorkbenchChromeMetadata {
  return normalizeExplorerPreviewWorkbenchChromeMetadata(value, {
    includePreviewTab: true,
    includeEditTab: false,
    ...defaults,
  });
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

function normalizeOverlayPluginPreviewLanePreviewKindList(
  value: string[] | null | undefined,
): OverlayPluginPreviewLaneMatchPreviewKind[] {
  const normalizedKinds = normalizeOverlayPluginPreviewLaneStringList(value);
  return normalizedKinds.filter(
    (
      entry,
    ): entry is OverlayPluginPreviewLaneMatchPreviewKind =>
      entry === "folder" ||
      entry === "model3d" ||
      entry === "archive" ||
      entry === "audio" ||
      entry === "video" ||
      entry === "font" ||
      entry === "image" ||
      entry === "pdf" ||
      entry === "spreadsheet" ||
      entry === "docx" ||
      entry === "shader" ||
      entry === "script" ||
      entry === "text",
  );
}
