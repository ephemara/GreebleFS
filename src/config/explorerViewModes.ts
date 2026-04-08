export type ExplorerViewMode =
  | 'icons-xl'
  | 'icons-l'
  | 'icons-m'
  | 'icons-s'
  | 'columns'
  | 'list'
  | 'details';

export type ExplorerViewPresentation = 'grid' | 'table' | 'list';
export type ExplorerViewWheelDirection = 'larger' | 'smaller';

export interface ExplorerGridMetrics {
  minWidth: number;
  gap: number;
  padding: number;
  rowHeight: number;
  searchRowHeight: number;
  newItemHeight: number;
  iconSize: number;
  iconStageSize: number;
  tileRadius: number;
  nameLines: number;
}

export interface ExplorerRowMetrics {
  rowHeight: number;
  searchRowHeight: number;
  newItemHeight: number;
  iconSize: number;
}

export interface ExplorerViewModeDefinition {
  id: ExplorerViewMode;
  label: string;
  shortLabel: string;
  description: string;
  presentation: ExplorerViewPresentation;
  zoomOrder: number;
  grid?: ExplorerGridMetrics;
  rows?: ExplorerRowMetrics;
}

export const EXPLORER_GRID_ZOOM_MIN = 0;
export const EXPLORER_GRID_ZOOM_MAX = 1;
export const EXPLORER_GRID_ZOOM_STEP = 0.08;

export const explorerViewModes: readonly ExplorerViewModeDefinition[] = [
  {
    id: 'icons-xl',
    label: 'XL Icons',
    shortLabel: 'XL',
    description: 'Large tiles for browsing folders and art-heavy workspaces.',
    presentation: 'grid',
    zoomOrder: 0,
    grid: {
      minWidth: 188,
      gap: 18,
      padding: 18,
      rowHeight: 214,
      searchRowHeight: 244,
      newItemHeight: 214,
      iconSize: 82,
      iconStageSize: 108,
      tileRadius: 16,
      nameLines: 2,
    },
  },
  {
    id: 'icons-l',
    label: 'L Icons',
    shortLabel: 'L',
    description: 'Balanced icon tiles for everyday navigation.',
    presentation: 'grid',
    zoomOrder: 1,
    grid: {
      minWidth: 152,
      gap: 16,
      padding: 16,
      rowHeight: 182,
      searchRowHeight: 212,
      newItemHeight: 182,
      iconSize: 60,
      iconStageSize: 82,
      tileRadius: 14,
      nameLines: 2,
    },
  },
  {
    id: 'icons-m',
    label: 'M Icons',
    shortLabel: 'M',
    description: 'Dense icon tiles that still keep names readable.',
    presentation: 'grid',
    zoomOrder: 2,
    grid: {
      minWidth: 122,
      gap: 12,
      padding: 14,
      rowHeight: 146,
      searchRowHeight: 176,
      newItemHeight: 146,
      iconSize: 42,
      iconStageSize: 58,
      tileRadius: 12,
      nameLines: 2,
    },
  },
  {
    id: 'icons-s',
    label: 'Small Icons',
    shortLabel: 'S',
    description: 'Compact tiles for dense browsing without fully dropping into rows.',
    presentation: 'grid',
    zoomOrder: 3,
    grid: {
      minWidth: 94,
      gap: 10,
      padding: 12,
      rowHeight: 118,
      searchRowHeight: 148,
      newItemHeight: 118,
      iconSize: 28,
      iconStageSize: 38,
      tileRadius: 10,
      nameLines: 2,
    },
  },
  {
    id: 'columns',
    label: 'Columns',
    shortLabel: 'Cols',
    description: 'Compact sortable columns with file data kept in view.',
    presentation: 'table',
    zoomOrder: 4,
    rows: {
      rowHeight: 38,
      searchRowHeight: 62,
      newItemHeight: 42,
      iconSize: 16,
    },
  },
  {
    id: 'list',
    label: 'List',
    shortLabel: 'List',
    description: 'Simple rows focused on fast scanning and selection.',
    presentation: 'list',
    zoomOrder: 5,
    rows: {
      rowHeight: 38,
      searchRowHeight: 66,
      newItemHeight: 42,
      iconSize: 16,
    },
  },
  {
    id: 'details',
    label: 'Details',
    shortLabel: 'Details',
    description: 'Rich rows with metadata for heavier file-management work.',
    presentation: 'table',
    zoomOrder: 6,
    rows: {
      rowHeight: 54,
      searchRowHeight: 80,
      newItemHeight: 48,
      iconSize: 18,
    },
  },
] as const;

const explorerViewModeMap = new Map(explorerViewModes.map((mode) => [mode.id, mode]));
const defaultExplorerViewMode: ExplorerViewMode = 'details';
const explorerGridModeAnchors = [
  { id: 'icons-s' as const, zoom: EXPLORER_GRID_ZOOM_MIN },
  { id: 'icons-m' as const, zoom: 0.34 },
  { id: 'icons-l' as const, zoom: 0.67 },
  { id: 'icons-xl' as const, zoom: EXPLORER_GRID_ZOOM_MAX },
] as const;

export function isExplorerViewMode(value: unknown): value is ExplorerViewMode {
  return typeof value === 'string' && explorerViewModeMap.has(value as ExplorerViewMode);
}

export function normalizeExplorerViewMode(value: unknown): ExplorerViewMode {
  if (value === 'grid') {
    return 'icons-l';
  }
  if (value === 'list') {
    return 'details';
  }
  return isExplorerViewMode(value) ? value : defaultExplorerViewMode;
}

export function getExplorerViewModeDefinition(mode: ExplorerViewMode): ExplorerViewModeDefinition {
  return explorerViewModeMap.get(mode) ?? explorerViewModeMap.get(defaultExplorerViewMode)!;
}

export function isExplorerGridMode(mode: ExplorerViewMode): mode is 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s' {
  return mode === 'icons-xl' || mode === 'icons-l' || mode === 'icons-m' || mode === 'icons-s';
}

export function getExplorerGridZoomAnchor(mode: ExplorerViewMode): number {
  const anchor = explorerGridModeAnchors.find((entry) => entry.id === mode);
  return anchor?.zoom ?? explorerGridModeAnchors.find((entry) => entry.id === 'icons-l')!.zoom;
}

export function normalizeExplorerGridZoom(value: unknown, fallbackMode: ExplorerViewMode = 'icons-l'): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, EXPLORER_GRID_ZOOM_MIN, EXPLORER_GRID_ZOOM_MAX);
  }
  return getExplorerGridZoomAnchor(fallbackMode);
}

export function stepExplorerGridZoom(currentZoom: number, direction: ExplorerViewWheelDirection): number {
  const delta = direction === 'larger' ? EXPLORER_GRID_ZOOM_STEP : -EXPLORER_GRID_ZOOM_STEP;
  return normalizeExplorerGridZoom(currentZoom + delta);
}

export function getNearestExplorerGridMode(gridZoom: number): 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s' {
  const zoom = normalizeExplorerGridZoom(gridZoom);
  let closest: typeof explorerGridModeAnchors[number] = explorerGridModeAnchors[0];
  let closestDistance = Math.abs(zoom - closest.zoom);

  for (const anchor of explorerGridModeAnchors.slice(1)) {
    const distance = Math.abs(zoom - anchor.zoom);
    if (distance < closestDistance) {
      closest = anchor;
      closestDistance = distance;
    }
  }

  return closest.id;
}

export function getAdjacentExplorerGridMode(
  currentMode: ExplorerViewMode,
  direction: ExplorerViewWheelDirection,
): 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s' {
  if (!isExplorerGridMode(currentMode)) {
    return direction === 'larger' ? 'icons-s' : 'icons-xl';
  }

  const currentIndex = explorerGridModeAnchors.findIndex((anchor) => anchor.id === currentMode);
  if (currentIndex < 0) {
    return direction === 'larger' ? 'icons-s' : 'icons-xl';
  }

  if (direction === 'larger') {
    return explorerGridModeAnchors[Math.min(explorerGridModeAnchors.length - 1, currentIndex + 1)]!.id;
  }

  return explorerGridModeAnchors[Math.max(0, currentIndex - 1)]!.id;
}

export function getExplorerGridMetricsForZoom(gridZoom: number): ExplorerGridMetrics {
  const zoom = normalizeExplorerGridZoom(gridZoom);
  let lowerIndex = 0;
  for (let index = 0; index < explorerGridModeAnchors.length; index += 1) {
    if (explorerGridModeAnchors[index]!.zoom <= zoom) {
      lowerIndex = index;
    }
  }
  const upperIndex = Math.min(explorerGridModeAnchors.length - 1, lowerIndex + 1);
  const lowerAnchor = explorerGridModeAnchors[lowerIndex]!;
  const upperAnchor = explorerGridModeAnchors[upperIndex]!;
  const lowerMetrics = getExplorerViewModeDefinition(lowerAnchor.id).grid!;
  const upperMetrics = getExplorerViewModeDefinition(upperAnchor.id).grid!;
  const range = upperAnchor.zoom - lowerAnchor.zoom;
  const t = range <= 0 ? 0 : (zoom - lowerAnchor.zoom) / range;

  return {
    minWidth: lerp(lowerMetrics.minWidth, upperMetrics.minWidth, t),
    gap: lerp(lowerMetrics.gap, upperMetrics.gap, t),
    padding: lerp(lowerMetrics.padding, upperMetrics.padding, t),
    rowHeight: lerp(lowerMetrics.rowHeight, upperMetrics.rowHeight, t),
    searchRowHeight: lerp(lowerMetrics.searchRowHeight, upperMetrics.searchRowHeight, t),
    newItemHeight: lerp(lowerMetrics.newItemHeight, upperMetrics.newItemHeight, t),
    iconSize: lerp(lowerMetrics.iconSize, upperMetrics.iconSize, t),
    iconStageSize: lerp(lowerMetrics.iconStageSize, upperMetrics.iconStageSize, t),
    tileRadius: lerp(lowerMetrics.tileRadius, upperMetrics.tileRadius, t),
    nameLines: Math.round(lerp(lowerMetrics.nameLines, upperMetrics.nameLines, t)),
  };
}

export function getExplorerGridZoomPercent(gridZoom: number): number {
  return Math.round(normalizeExplorerGridZoom(gridZoom) * 100);
}

export function stepExplorerViewMode(
  currentMode: ExplorerViewMode,
  direction: ExplorerViewWheelDirection,
): ExplorerViewMode {
  const currentIndex = explorerViewModes.findIndex((entry) => entry.id === currentMode);
  if (currentIndex < 0) {
    return defaultExplorerViewMode;
  }
  if (direction === 'larger') {
    return explorerViewModes[Math.max(0, currentIndex - 1)]!.id;
  }
  return explorerViewModes[Math.min(explorerViewModes.length - 1, currentIndex + 1)]!.id;
}

export function resolveEffectiveExplorerViewMode(
  requestedMode: ExplorerViewMode,
  options: {
    isCompactDock: boolean;
    isSearchActive: boolean;
  },
): ExplorerViewMode {
  if (options.isCompactDock) {
    return 'list';
  }

  const definition = getExplorerViewModeDefinition(requestedMode);
  if (options.isSearchActive && definition.presentation === 'grid') {
    return 'details';
  }

  return requestedMode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}
