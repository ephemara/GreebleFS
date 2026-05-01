import shippedExplorerExperimentalModeManifestJson from "../../usr/explorer-experimental-modes/greeblefs-core/explorer-experimental-mode.json";

export type ExplorerExperimentalViewMode =
  | "off"
  | "adaptive-semantic-grid"
  | "constellation"
  | "timeline-surface";

export type AdaptiveSemanticDensityStopId =
  | "small-icons"
  | "medium-icons"
  | "large-icons"
  | "rich-cards"
  | "columns"
  | "details";

export type AdaptiveSemanticPresentation = "grid" | "cards" | "table";

export interface AdaptiveSemanticGridMetrics {
  minWidth: number;
  gap: number;
  padding: number;
  minHeight: number;
  iconSize: number;
  iconStageSize: number;
  titleLines: number;
}

export interface AdaptiveSemanticTableMetrics {
  rowHeight: number;
  iconSize: number;
  showRichMeta: boolean;
}

export interface AdaptiveSemanticDensityStopDefinition {
  id: AdaptiveSemanticDensityStopId;
  label: string;
  shortLabel: string;
  description: string;
  density: number;
  presentation: AdaptiveSemanticPresentation;
  grid?: AdaptiveSemanticGridMetrics;
  table?: AdaptiveSemanticTableMetrics;
}

export interface ExplorerExperimentalModeDefinition {
  id: Exclude<ExplorerExperimentalViewMode, "off">;
  label: string;
  shortLabel: string;
  description: string;
  densityAxisLabel: string;
  available: boolean;
}

export interface ExplorerExperimentalDensityDescriptor {
  label: string;
  shortLabel: string;
  description: string;
}

interface ShippedExplorerExperimentalModeManifest {
  adaptiveSemanticDensityStep?: number;
  defaultAdaptiveSemanticDensity?: number;
  adaptiveSemanticDensityStops?: AdaptiveSemanticDensityStopDefinition[];
  modes?: ExplorerExperimentalModeDefinition[];
  densityDescriptors?: {
    constellation?: ExplorerExperimentalDensityDescriptor[];
    timeline?: ExplorerExperimentalDensityDescriptor[];
  };
}

function cloneAdaptiveSemanticDensityStopDefinition(
  stop: AdaptiveSemanticDensityStopDefinition,
): AdaptiveSemanticDensityStopDefinition {
  return {
    ...stop,
    grid: stop.grid ? { ...stop.grid } : undefined,
    table: stop.table ? { ...stop.table } : undefined,
  };
}

function cloneExplorerExperimentalModeDefinition(
  mode: ExplorerExperimentalModeDefinition,
): ExplorerExperimentalModeDefinition {
  return { ...mode };
}

function cloneExplorerExperimentalDensityDescriptor(
  descriptor: ExplorerExperimentalDensityDescriptor,
): ExplorerExperimentalDensityDescriptor {
  return { ...descriptor };
}

export let ADAPTIVE_SEMANTIC_DENSITY_STEP = 0.16;
export let DEFAULT_ADAPTIVE_SEMANTIC_DENSITY = 0.4;
export let adaptiveSemanticDensityStops: AdaptiveSemanticDensityStopDefinition[] =
  [];
export let explorerExperimentalModes: ExplorerExperimentalModeDefinition[] = [];

let constellationDensityDescriptors: ExplorerExperimentalDensityDescriptor[] = [];
let timelineDensityDescriptors: ExplorerExperimentalDensityDescriptor[] = [];
let explorerExperimentalModeMap = new Map<
  Exclude<ExplorerExperimentalViewMode, "off">,
  ExplorerExperimentalModeDefinition
>();
let adaptiveDensityStopMap = new Map<
  AdaptiveSemanticDensityStopId,
  AdaptiveSemanticDensityStopDefinition
>();

export function applyUsrExplorerExperimentalModeManifest(
  manifest: ShippedExplorerExperimentalModeManifest | null | undefined,
): void {
  ADAPTIVE_SEMANTIC_DENSITY_STEP =
    typeof manifest?.adaptiveSemanticDensityStep === "number"
      ? manifest.adaptiveSemanticDensityStep
      : 0.16;
  DEFAULT_ADAPTIVE_SEMANTIC_DENSITY =
    typeof manifest?.defaultAdaptiveSemanticDensity === "number"
      ? manifest.defaultAdaptiveSemanticDensity
      : 0.4;
  adaptiveSemanticDensityStops = Array.isArray(
    manifest?.adaptiveSemanticDensityStops,
  )
    ? manifest.adaptiveSemanticDensityStops.map(
        cloneAdaptiveSemanticDensityStopDefinition,
      )
    : [];
  explorerExperimentalModes = Array.isArray(manifest?.modes)
    ? manifest.modes.map(cloneExplorerExperimentalModeDefinition)
    : [];
  constellationDensityDescriptors = Array.isArray(
    manifest?.densityDescriptors?.constellation,
  )
    ? manifest.densityDescriptors.constellation.map(
        cloneExplorerExperimentalDensityDescriptor,
      )
    : [];
  timelineDensityDescriptors = Array.isArray(
    manifest?.densityDescriptors?.timeline,
  )
    ? manifest.densityDescriptors.timeline.map(
        cloneExplorerExperimentalDensityDescriptor,
      )
    : [];
  explorerExperimentalModeMap = new Map(
    explorerExperimentalModes.map((mode) => [mode.id, mode] as const),
  );
  adaptiveDensityStopMap = new Map(
    adaptiveSemanticDensityStops.map((stop) => [stop.id, stop] as const),
  );
}

applyUsrExplorerExperimentalModeManifest(
  shippedExplorerExperimentalModeManifestJson as ShippedExplorerExperimentalModeManifest,
);

export function normalizeExplorerExperimentalViewMode(
  value: unknown,
): ExplorerExperimentalViewMode {
  if (value === "off") {
    return "off";
  }
  return typeof value === "string" &&
    explorerExperimentalModeMap.has(
      value as Exclude<ExplorerExperimentalViewMode, "off">,
    )
    ? (value as ExplorerExperimentalViewMode)
    : "off";
}

export function normalizeAdaptiveSemanticDensity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(value, 0, 1);
  }
  return DEFAULT_ADAPTIVE_SEMANTIC_DENSITY;
}

export function getExplorerExperimentalModeDefinition(
  mode: Exclude<ExplorerExperimentalViewMode, "off">,
): ExplorerExperimentalModeDefinition {
  return (
    explorerExperimentalModeMap.get(mode) ??
    explorerExperimentalModeMap.get("adaptive-semantic-grid")!
  );
}

export function getAdaptiveSemanticDensityStopId(
  density: number,
): AdaptiveSemanticDensityStopId {
  const normalizedDensity = normalizeAdaptiveSemanticDensity(density);
  let closest = adaptiveSemanticDensityStops[0]!;
  let closestDistance = Math.abs(normalizedDensity - closest.density);

  for (const stop of adaptiveSemanticDensityStops.slice(1)) {
    const distance = Math.abs(normalizedDensity - stop.density);
    if (distance < closestDistance) {
      closest = stop;
      closestDistance = distance;
    }
  }

  return closest.id;
}

export function getAdaptiveSemanticDensityStop(
  density: number,
): AdaptiveSemanticDensityStopDefinition {
  return (
    adaptiveDensityStopMap.get(getAdaptiveSemanticDensityStopId(density)) ??
    adaptiveSemanticDensityStops[2]!
  );
}

export function getAdaptiveSemanticDensityPercent(density: number): number {
  return Math.round(normalizeAdaptiveSemanticDensity(density) * 100);
}

export function getExplorerExperimentalDensityDescriptor(
  mode: Exclude<ExplorerExperimentalViewMode, "off">,
  density: number,
): ExplorerExperimentalDensityDescriptor {
  if (mode === "adaptive-semantic-grid") {
    return getAdaptiveSemanticDensityStop(density);
  }

  const stopId = getAdaptiveSemanticDensityStopId(density);
  const stopIndex = adaptiveSemanticDensityStops.findIndex(
    (stop) => stop.id === stopId,
  );
  const descriptorIndex = stopIndex < 0 ? 2 : stopIndex;
  const descriptorSet =
    mode === "constellation"
      ? constellationDensityDescriptors
      : timelineDensityDescriptors;
  return descriptorSet[descriptorIndex] ?? descriptorSet[2]!;
}

export function stepAdaptiveSemanticDensity(
  currentDensity: number,
  direction: "larger" | "smaller",
): number {
  const currentStopId = getAdaptiveSemanticDensityStopId(currentDensity);
  const currentIndex = adaptiveSemanticDensityStops.findIndex(
    (stop) => stop.id === currentStopId,
  );
  if (currentIndex < 0) {
    return DEFAULT_ADAPTIVE_SEMANTIC_DENSITY;
  }

  const nextIndex =
    direction === "larger"
      ? Math.min(adaptiveSemanticDensityStops.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
  return adaptiveSemanticDensityStops[nextIndex]!.density;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
