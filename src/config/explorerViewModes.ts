export type ExplorerViewMode =
  | 'icons-xl'
  | 'icons-l'
  | 'icons-m'
  | 'columns'
  | 'list'
  | 'details';

export type ExplorerViewPresentation = 'grid' | 'table' | 'list';
export type ExplorerViewWheelDirection = 'larger' | 'smaller';

interface ExplorerGridMetrics {
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

interface ExplorerRowMetrics {
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
    id: 'columns',
    label: 'Columns',
    shortLabel: 'Cols',
    description: 'Compact sortable columns with file data kept in view.',
    presentation: 'table',
    zoomOrder: 3,
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
    zoomOrder: 4,
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
    zoomOrder: 5,
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
