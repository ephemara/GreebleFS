import shippedExplorerShellLayoutManifestJson from "../../usr/explorer-shell-layouts/greeblefs-core/explorer-shell-layout.json";

export type ExplorerShellLayoutId =
  | "balanced"
  | "navigator"
  | "focus"
  | "inspector";
export type ExplorerPreviewPlacement = "leading" | "trailing";

export interface ExplorerShellLayoutDefinition {
  id: ExplorerShellLayoutId;
  label: string;
  shortLabel: string;
  description: string;
  defaultSourcesVisible: boolean;
  previewPlacement: ExplorerPreviewPlacement;
  railWidthMultiplier: number;
  previewWidthMultiplier: number;
}

export interface ExplorerShellLayoutWidthSuggestion {
  sidebarWidth: number;
  previewWidth: number;
}

export interface ExplorerShellLayoutWidthInputs {
  layoutId: ExplorerShellLayoutId;
  railWidth: number;
  railMinWidth: number;
  railMaxWidth: number;
  previewWidth: number;
  previewMinWidth: number;
  previewMaxWidth: number;
}

interface ShippedExplorerShellLayoutManifest {
  shellLayouts?: ExplorerShellLayoutDefinition[];
}

const builtInExplorerShellLayoutOrder = [
  "balanced",
  "navigator",
  "focus",
  "inspector",
] as const satisfies readonly ExplorerShellLayoutId[];

export const EXPLORER_PREVIEW_WIDTH_BOUNDS = {
  min: 220,
  max: 1280,
} as const;

export const EXPLORER_ACTIONS_WIDTH_BOUNDS = {
  min: 240,
  max: 720,
  default: 344,
} as const;

function cloneExplorerShellLayoutDefinition(
  layout: ExplorerShellLayoutDefinition,
): ExplorerShellLayoutDefinition {
  return { ...layout };
}

function resolveExplorerShellLayouts(
  manifest: ShippedExplorerShellLayoutManifest | null | undefined,
): ExplorerShellLayoutDefinition[] {
  const shippedExplorerShellLayouts = Array.isArray(manifest?.shellLayouts)
    ? manifest.shellLayouts.map(cloneExplorerShellLayoutDefinition)
    : [];
  const shippedExplorerShellLayoutById = new Map(
    shippedExplorerShellLayouts.map((layout) => [layout.id, layout] as const),
  );

  return builtInExplorerShellLayoutOrder.map((layoutId) => {
    const layout = shippedExplorerShellLayoutById.get(layoutId);
    if (!layout) {
      throw new Error(`Missing shipped explorer shell layout: ${layoutId}`);
    }
    return cloneExplorerShellLayoutDefinition(layout);
  });
}

export let explorerShellLayouts: readonly ExplorerShellLayoutDefinition[] = [];

let explorerShellLayoutMap = new Map<
  ExplorerShellLayoutId,
  ExplorerShellLayoutDefinition
>();

export function applyUsrExplorerShellLayoutManifest(
  manifest: ShippedExplorerShellLayoutManifest | null | undefined,
): void {
  explorerShellLayouts = resolveExplorerShellLayouts(manifest);
  explorerShellLayoutMap = new Map(
    explorerShellLayouts.map((layout) => [layout.id, layout] as const),
  );
}

applyUsrExplorerShellLayoutManifest(
  shippedExplorerShellLayoutManifestJson as ShippedExplorerShellLayoutManifest,
);

function clampRoundedWidth(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function isExplorerShellLayoutId(
  value: unknown,
): value is ExplorerShellLayoutId {
  return (
    typeof value === "string" &&
    explorerShellLayoutMap.has(value as ExplorerShellLayoutId)
  );
}

export function getExplorerShellLayoutDefinition(
  value: unknown,
): ExplorerShellLayoutDefinition {
  return (
    explorerShellLayoutMap.get(value as ExplorerShellLayoutId) ??
    explorerShellLayoutMap.get("balanced")!
  );
}

export function getExplorerShellLayoutWidthSuggestion(
  inputs: ExplorerShellLayoutWidthInputs,
): ExplorerShellLayoutWidthSuggestion {
  const layout = getExplorerShellLayoutDefinition(inputs.layoutId);
  return {
    sidebarWidth: clampRoundedWidth(
      inputs.railWidth * layout.railWidthMultiplier,
      inputs.railMinWidth,
      inputs.railMaxWidth,
    ),
    previewWidth: clampRoundedWidth(
      inputs.previewWidth * layout.previewWidthMultiplier,
      inputs.previewMinWidth,
      inputs.previewMaxWidth,
    ),
  };
}
