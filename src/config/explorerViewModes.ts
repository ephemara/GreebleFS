import {
  explorerGridZoomAnchors,
  explorerZoomBehavior,
} from './explorerZoomBehavior';

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
export type ExplorerLayoutZoomFamily = 'grid' | 'table' | 'list';
export type ExplorerGridMode = 'icons-xl' | 'icons-l' | 'icons-m' | 'icons-s';

export interface ExplorerGridLayoutMetrics {
  minWidth: number;
  gap: number;
  padding: number;
  rowHeight: number;
  searchRowHeight: number;
  newItemHeight: number;
  tileRadius: number;
  nameLines: number;
}

export interface ExplorerGridIconMetrics {
  iconSize: number;
  iconStageSize: number;
}

export interface ExplorerGridMetrics extends ExplorerGridLayoutMetrics, ExplorerGridIconMetrics {}

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

export interface ExplorerLayoutZoomState {
  family: ExplorerLayoutZoomFamily;
  layoutZoom: number;
  storedGridZoom: number;
}

export interface ExplorerResolvedLayoutZoomState {
  family: ExplorerLayoutZoomFamily;
  viewMode: ExplorerViewMode;
  definition: ExplorerViewModeDefinition;
  gridZoom: number;
  zoomPercent: number | null;
}

export const EXPLORER_GRID_ZOOM_MIN = explorerZoomBehavior.gridAnchors['icons-s'];
export const EXPLORER_GRID_ZOOM_MAX = explorerZoomBehavior.gridAnchors['icons-xl'];
export const EXPLORER_GRID_ZOOM_STEP = 0.08;
export const EXPLORER_LAYOUT_ZOOM_MIN =
  explorerZoomBehavior.layoutDomain.minimumRowZoom;
export const EXPLORER_LIVE_GRID_ZOOM_MAX =
  explorerZoomBehavior.layoutDomain.liveGridMaxZoom;
export const EXPLORER_LAYOUT_ZOOM_MAX = EXPLORER_LIVE_GRID_ZOOM_MAX;
export const EXPLORER_LAYOUT_ZOOM_TABLE_ENTER =
  explorerZoomBehavior.layoutDomain.gridToTableEnterZoom;
export const EXPLORER_LAYOUT_ZOOM_TABLE_EXIT =
  explorerZoomBehavior.layoutDomain.tableToGridExitZoom;
export const EXPLORER_LAYOUT_ZOOM_LIST_ENTER =
  explorerZoomBehavior.layoutDomain.tableToListEnterZoom;
export const EXPLORER_LAYOUT_ZOOM_LIST_EXIT =
  explorerZoomBehavior.layoutDomain.listToTableExitZoom;
export const EXPLORER_LAYOUT_ZOOM_TABLE_MIDPOINT =
  explorerZoomBehavior.layoutDomain.columnsDetailsMidpointZoom;

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
const explorerGridModeAnchors = explorerGridZoomAnchors;

export function isExplorerViewMode(value: unknown): value is ExplorerViewMode {
  return typeof value === 'string' && explorerViewModeMap.has(value as ExplorerViewMode);
}

export function normalizeExplorerViewMode(value: unknown): ExplorerViewMode {
  if (value === 'grid') {
    return 'icons-l';
  }
  return isExplorerViewMode(value) ? value : defaultExplorerViewMode;
}

export function getExplorerViewModeDefinition(mode: ExplorerViewMode): ExplorerViewModeDefinition {
  return explorerViewModeMap.get(mode) ?? explorerViewModeMap.get(defaultExplorerViewMode)!;
}

export function isExplorerGridMode(mode: ExplorerViewMode): mode is ExplorerGridMode {
  return mode === 'icons-xl' || mode === 'icons-l' || mode === 'icons-m' || mode === 'icons-s';
}

export function getExplorerGridZoomAnchor(mode: ExplorerViewMode): number {
  const anchor = explorerGridModeAnchors.find((entry) => entry.id === mode);
  return anchor?.zoom ?? explorerGridModeAnchors.find((entry) => entry.id === 'icons-l')!.zoom;
}

export function normalizeExplorerGridZoom(value: unknown, fallbackMode: ExplorerViewMode = 'icons-l'): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, EXPLORER_GRID_ZOOM_MIN, EXPLORER_LIVE_GRID_ZOOM_MAX);
  }
  return getExplorerGridZoomAnchor(fallbackMode);
}

export function normalizeExplorerLayoutZoom(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clamp(value, EXPLORER_LAYOUT_ZOOM_MIN, EXPLORER_LAYOUT_ZOOM_MAX);
  }
  return EXPLORER_GRID_ZOOM_MIN;
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

export function getExplorerGridIconMetricsForMode(mode: ExplorerGridMode): ExplorerGridIconMetrics {
  const metrics = getExplorerViewModeDefinition(mode).grid!;
  return {
    iconSize: metrics.iconSize,
    iconStageSize: metrics.iconStageSize,
  };
}

export function getExplorerGridVisualMetricsForZoom(
  gridZoom: number,
): ExplorerGridIconMetrics {
  const zoom = normalizeExplorerGridZoom(gridZoom);
  if (zoom > EXPLORER_GRID_ZOOM_MAX) {
    return getExplorerOversizedGridVisualMetrics(zoom);
  }

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
    iconSize: lerp(lowerMetrics.iconSize, upperMetrics.iconSize, t),
    iconStageSize: lerp(lowerMetrics.iconStageSize, upperMetrics.iconStageSize, t),
  };
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

export function getExplorerGridLayoutMetricsForZoom(gridZoom: number): ExplorerGridLayoutMetrics {
  const zoom = normalizeExplorerGridZoom(gridZoom);
  if (zoom > EXPLORER_GRID_ZOOM_MAX) {
    return getExplorerOversizedGridLayoutMetrics(zoom);
  }

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
    tileRadius: lerp(lowerMetrics.tileRadius, upperMetrics.tileRadius, t),
    nameLines: Math.round(lerp(lowerMetrics.nameLines, upperMetrics.nameLines, t)),
  };
}

export function getExplorerGridMetricsForZoom(
  gridZoom: number,
): ExplorerGridMetrics {
  const layoutMetrics = getExplorerGridLayoutMetricsForZoom(gridZoom);
  const iconMetrics = getExplorerGridVisualMetricsForZoom(gridZoom);

  return {
    ...layoutMetrics,
    ...iconMetrics,
  };
}

export function createExplorerLayoutZoomState(
  viewMode: ExplorerViewMode,
  gridZoom: number,
): ExplorerLayoutZoomState {
  const normalizedGridZoom = normalizeExplorerGridZoom(gridZoom, viewMode);
  if (isExplorerGridMode(viewMode)) {
    return {
      family: 'grid',
      layoutZoom: normalizedGridZoom,
      storedGridZoom: normalizedGridZoom,
    };
  }

  if (viewMode === 'columns' || viewMode === 'details') {
    const columnsAnchor =
      (EXPLORER_LAYOUT_ZOOM_LIST_ENTER + EXPLORER_LAYOUT_ZOOM_TABLE_MIDPOINT) /
      2;
    const detailsAnchor =
      (EXPLORER_LAYOUT_ZOOM_TABLE_MIDPOINT + EXPLORER_LAYOUT_ZOOM_TABLE_EXIT) /
      2;
    return {
      family: 'table',
      layoutZoom: viewMode === 'columns' ? columnsAnchor : detailsAnchor,
      storedGridZoom: normalizedGridZoom,
    };
  }

  return {
    family: 'list',
    layoutZoom:
      (EXPLORER_LAYOUT_ZOOM_MIN + EXPLORER_LAYOUT_ZOOM_LIST_EXIT) / 2,
    storedGridZoom: normalizedGridZoom,
  };
}

export function adjustExplorerLayoutZoomState(
  state: ExplorerLayoutZoomState,
  delta: number,
): ExplorerLayoutZoomState {
  return resolveExplorerLayoutZoomStateAtValue(state, state.layoutZoom + delta);
}

export function resolveExplorerLayoutZoomStateAtValue(
  state: ExplorerLayoutZoomState,
  layoutZoom: number,
): ExplorerLayoutZoomState {
  const nextLayoutZoom = normalizeExplorerLayoutZoom(layoutZoom);
  const nextStoredGridZoom = nextLayoutZoom >= EXPLORER_GRID_ZOOM_MIN
    ? normalizeExplorerGridZoom(nextLayoutZoom)
    : state.storedGridZoom;
  const nextFamily = resolveExplorerLayoutZoomFamily(nextLayoutZoom, state.family);

  return {
    family: nextFamily,
    layoutZoom: nextLayoutZoom,
    storedGridZoom: nextStoredGridZoom,
  };
}

export function resolveExplorerLayoutZoomState(
  state: ExplorerLayoutZoomState,
): ExplorerResolvedLayoutZoomState {
  if (state.family === 'list') {
    const definition = getExplorerViewModeDefinition('list');
    return {
      family: 'list',
      viewMode: 'list',
      definition,
      gridZoom: state.storedGridZoom,
      zoomPercent: null,
    };
  }

  if (state.family === 'table') {
    const viewMode: ExplorerViewMode =
      state.layoutZoom < EXPLORER_LAYOUT_ZOOM_TABLE_MIDPOINT
        ? 'columns'
        : 'details';
    const definition = getExplorerViewModeDefinition(viewMode);
    return {
      family: 'table',
      viewMode,
      definition,
      gridZoom: state.storedGridZoom,
      zoomPercent: null,
    };
  }

  const resolvedGridZoom = normalizeExplorerGridZoom(
    Math.max(EXPLORER_GRID_ZOOM_MIN, state.layoutZoom),
    'icons-l',
  );
  const viewMode = getNearestExplorerGridMode(resolvedGridZoom);
  return {
    family: 'grid',
    viewMode,
    definition: getExplorerViewModeDefinition(viewMode),
    gridZoom: resolvedGridZoom,
    zoomPercent: getExplorerGridZoomPercent(resolvedGridZoom),
  };
}

export function commitExplorerLayoutZoomState(
  state: ExplorerLayoutZoomState,
): {
  viewMode: ExplorerViewMode;
  gridZoom?: number;
} {
  if (state.family === 'list') {
    return { viewMode: 'list' };
  }

  if (state.family === 'table') {
    const viewMode: ExplorerViewMode =
      state.layoutZoom < EXPLORER_LAYOUT_ZOOM_TABLE_MIDPOINT
        ? 'columns'
        : 'details';
    return { viewMode };
  }

  const resolvedGridZoom = normalizeExplorerGridZoom(
    Math.max(EXPLORER_GRID_ZOOM_MIN, state.layoutZoom),
    'icons-l',
  );
  return {
    viewMode: getNearestExplorerGridMode(resolvedGridZoom),
    gridZoom: resolvedGridZoom,
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

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function getExplorerOversizedGridLayoutMetrics(gridZoom: number): ExplorerGridLayoutMetrics {
  const baseMetrics = getExplorerViewModeDefinition('icons-xl').grid!;
  const oversizeProgress = clamp(
    (gridZoom - EXPLORER_GRID_ZOOM_MAX) /
      (EXPLORER_LIVE_GRID_ZOOM_MAX - EXPLORER_GRID_ZOOM_MAX),
    0,
    1,
  );
  const easedProgress = easeOutCubic(oversizeProgress);
  const tileScale = lerp(
    1,
    explorerZoomBehavior.oversize.tileScaleMax,
    easedProgress,
  );
  const rowScale = lerp(
    1,
    explorerZoomBehavior.oversize.rowScaleMax,
    easedProgress,
  );
  const spacingScale = lerp(
    1,
    explorerZoomBehavior.oversize.spacingScaleMax,
    easedProgress,
  );

  return {
    minWidth: baseMetrics.minWidth * tileScale,
    gap: baseMetrics.gap * spacingScale,
    padding: baseMetrics.padding * lerp(
      1,
      explorerZoomBehavior.oversize.paddingScaleMax,
      easedProgress,
    ),
    rowHeight: baseMetrics.rowHeight * rowScale,
    searchRowHeight: baseMetrics.searchRowHeight * lerp(
      1,
      explorerZoomBehavior.oversize.rowScaleMax + 0.08,
      easedProgress,
    ),
    newItemHeight: baseMetrics.newItemHeight * rowScale,
    tileRadius: baseMetrics.tileRadius * lerp(
      1,
      explorerZoomBehavior.oversize.tileRadiusScaleMax,
      easedProgress,
    ),
    nameLines: Math.max(
      baseMetrics.nameLines,
      Math.round(
        lerp(
          baseMetrics.nameLines,
          explorerZoomBehavior.oversize.nameLinesMax,
          easedProgress,
        ),
      ),
    ),
  };
}

function getExplorerOversizedGridVisualMetrics(
  gridZoom: number,
): ExplorerGridIconMetrics {
  const baseMetrics = getExplorerViewModeDefinition('icons-xl').grid!;
  const oversizeProgress = clamp(
    (gridZoom - EXPLORER_GRID_ZOOM_MAX) /
      (EXPLORER_LIVE_GRID_ZOOM_MAX - EXPLORER_GRID_ZOOM_MAX),
    0,
    1,
  );
  const easedProgress = easeOutCubic(oversizeProgress);
  const iconScale = lerp(
    1,
    explorerZoomBehavior.oversize.rowScaleMax,
    easedProgress,
  );

  return {
    iconSize: baseMetrics.iconSize * iconScale,
    iconStageSize: baseMetrics.iconStageSize * iconScale,
  };
}

function resolveExplorerLayoutZoomFamily(
  layoutZoom: number,
  previousFamily: ExplorerLayoutZoomFamily,
): ExplorerLayoutZoomFamily {
  if (previousFamily === 'list') {
    if (layoutZoom >= EXPLORER_LAYOUT_ZOOM_LIST_EXIT) {
      return 'table';
    }
    return 'list';
  }
  if (previousFamily === 'table') {
    if (layoutZoom >= EXPLORER_LAYOUT_ZOOM_TABLE_EXIT) {
      return 'grid';
    }
    if (layoutZoom <= EXPLORER_LAYOUT_ZOOM_LIST_ENTER) {
      return 'list';
    }
    return 'table';
  }
  // previousFamily === 'grid'
  if (layoutZoom <= EXPLORER_LAYOUT_ZOOM_TABLE_ENTER) {
    return 'table';
  }
  return 'grid';
}
