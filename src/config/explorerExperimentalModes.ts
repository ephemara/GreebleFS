export type ExplorerExperimentalViewMode =
  | 'off'
  | 'adaptive-semantic-grid'
  | 'constellation'
  | 'timeline-surface';

export type AdaptiveSemanticDensityStopId =
  | 'small-icons'
  | 'medium-icons'
  | 'large-icons'
  | 'rich-cards'
  | 'columns'
  | 'details';

export type AdaptiveSemanticPresentation = 'grid' | 'cards' | 'table';

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
  id: Exclude<ExplorerExperimentalViewMode, 'off'>;
  label: string;
  shortLabel: string;
  description: string;
  available: boolean;
}

export const ADAPTIVE_SEMANTIC_DENSITY_STEP = 0.16;
export const DEFAULT_ADAPTIVE_SEMANTIC_DENSITY = 0.4;

export const adaptiveSemanticDensityStops: readonly AdaptiveSemanticDensityStopDefinition[] = [
  {
    id: 'small-icons',
    label: 'Small Icons',
    shortLabel: 'Small',
    description: 'Dense semantic tiles for scanning a lot of content quickly.',
    density: 0,
    presentation: 'grid',
    grid: {
      minWidth: 96,
      gap: 10,
      padding: 10,
      minHeight: 104,
      iconSize: 26,
      iconStageSize: 34,
      titleLines: 2,
    },
  },
  {
    id: 'medium-icons',
    label: 'Medium Icons',
    shortLabel: 'Medium',
    description: 'Balanced semantic tiles with light metadata.',
    density: 0.2,
    presentation: 'grid',
    grid: {
      minWidth: 126,
      gap: 12,
      padding: 12,
      minHeight: 126,
      iconSize: 34,
      iconStageSize: 46,
      titleLines: 2,
    },
  },
  {
    id: 'large-icons',
    label: 'Large Icons',
    shortLabel: 'Large',
    description: 'Larger semantic tiles that favor browsing and recognition.',
    density: 0.4,
    presentation: 'grid',
    grid: {
      minWidth: 156,
      gap: 14,
      padding: 14,
      minHeight: 150,
      iconSize: 46,
      iconStageSize: 60,
      titleLines: 2,
    },
  },
  {
    id: 'rich-cards',
    label: 'Rich Cards',
    shortLabel: 'Cards',
    description: 'Context-rich cards with stronger metadata and grouping presence.',
    density: 0.6,
    presentation: 'cards',
    grid: {
      minWidth: 238,
      gap: 16,
      padding: 16,
      minHeight: 164,
      iconSize: 50,
      iconStageSize: 64,
      titleLines: 2,
    },
  },
  {
    id: 'columns',
    label: 'Columns',
    shortLabel: 'Cols',
    description: 'Grouped semantic rows with compact column scanning.',
    density: 0.8,
    presentation: 'table',
    table: {
      rowHeight: 42,
      iconSize: 18,
      showRichMeta: false,
    },
  },
  {
    id: 'details',
    label: 'Details',
    shortLabel: 'Details',
    description: 'Grouped semantic rows with richer metadata and context.',
    density: 1,
    presentation: 'table',
    table: {
      rowHeight: 58,
      iconSize: 18,
      showRichMeta: true,
    },
  },
] as const;

export const explorerExperimentalModes: readonly ExplorerExperimentalModeDefinition[] = [
  {
    id: 'adaptive-semantic-grid',
    label: 'Adaptive Semantic Grid',
    shortLabel: 'Adaptive',
    description: 'A density-driven semantic explorer with grouped context and modern transitions.',
    available: true,
  },
  {
    id: 'constellation',
    label: 'Constellation View',
    shortLabel: 'Constellation',
    description: 'Clusters files by relationship and reveals stronger links as you zoom.',
    available: false,
  },
  {
    id: 'timeline-surface',
    label: 'Timeline Surface',
    shortLabel: 'Timeline',
    description: 'Maps files across temporal bands so you browse eras, days, and moments.',
    available: false,
  },
] as const;

const explorerExperimentalModeMap = new Map(
  explorerExperimentalModes.map((mode) => [mode.id, mode]),
);

const adaptiveDensityStopMap = new Map(
  adaptiveSemanticDensityStops.map((stop) => [stop.id, stop]),
);

export function normalizeExplorerExperimentalViewMode(value: unknown): ExplorerExperimentalViewMode {
  if (value === 'off') {
    return 'off';
  }
  return typeof value === 'string' && explorerExperimentalModeMap.has(value as Exclude<ExplorerExperimentalViewMode, 'off'>)
    ? value as ExplorerExperimentalViewMode
    : 'off';
}

export function normalizeAdaptiveSemanticDensity(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, 0, 1);
  }
  return DEFAULT_ADAPTIVE_SEMANTIC_DENSITY;
}

export function getExplorerExperimentalModeDefinition(
  mode: Exclude<ExplorerExperimentalViewMode, 'off'>,
): ExplorerExperimentalModeDefinition {
  return explorerExperimentalModeMap.get(mode) ?? explorerExperimentalModeMap.get('adaptive-semantic-grid')!;
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
  return adaptiveDensityStopMap.get(getAdaptiveSemanticDensityStopId(density)) ?? adaptiveSemanticDensityStops[2]!;
}

export function getAdaptiveSemanticDensityPercent(density: number): number {
  return Math.round(normalizeAdaptiveSemanticDensity(density) * 100);
}

export function stepAdaptiveSemanticDensity(
  currentDensity: number,
  direction: 'larger' | 'smaller',
): number {
  const currentStopId = getAdaptiveSemanticDensityStopId(currentDensity);
  const currentIndex = adaptiveSemanticDensityStops.findIndex((stop) => stop.id === currentStopId);
  if (currentIndex < 0) {
    return DEFAULT_ADAPTIVE_SEMANTIC_DENSITY;
  }

  const nextIndex = direction === 'larger'
    ? Math.min(adaptiveSemanticDensityStops.length - 1, currentIndex + 1)
    : Math.max(0, currentIndex - 1);
  return adaptiveSemanticDensityStops[nextIndex]!.density;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
