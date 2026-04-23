export type ExplorerPaneId = 'pane-1' | 'pane-2' | 'pane-3' | 'pane-4';
export type ExplorerWorkspaceLayoutMode = 'single' | 'split' | 'triple' | 'quad';

export interface ExplorerWorkspaceLayoutDefinition {
  id: ExplorerWorkspaceLayoutMode;
  label: string;
  shortLabel: string;
  description: string;
  visiblePaneIds: ExplorerPaneId[];
  supportsColumnSplit: boolean;
  supportsRowSplit: boolean;
}

export const explorerPaneIds: ExplorerPaneId[] = [
  'pane-1',
  'pane-2',
  'pane-3',
  'pane-4',
];

const builtInExplorerWorkspaceLayouts: Record<ExplorerWorkspaceLayoutMode, ExplorerWorkspaceLayoutDefinition> = {
  single: {
    id: 'single',
    label: 'Single',
    shortLabel: '1-Up',
    description: 'One focused explorer pane.',
    visiblePaneIds: ['pane-1'],
    supportsColumnSplit: false,
    supportsRowSplit: false,
  },
  split: {
    id: 'split',
    label: 'Split',
    shortLabel: '2-Up',
    description: 'Two-pane side-by-side explorer workspace.',
    visiblePaneIds: ['pane-1', 'pane-2'],
    supportsColumnSplit: true,
    supportsRowSplit: false,
  },
  triple: {
    id: 'triple',
    label: 'Triple',
    shortLabel: '3-Up',
    description: 'One full-width top pane with two panes below.',
    visiblePaneIds: ['pane-1', 'pane-2', 'pane-3'],
    supportsColumnSplit: true,
    supportsRowSplit: true,
  },
  quad: {
    id: 'quad',
    label: 'Quad',
    shortLabel: '4-Up',
    description: 'Four-pane grid explorer workspace.',
    visiblePaneIds: ['pane-1', 'pane-2', 'pane-3', 'pane-4'],
    supportsColumnSplit: true,
    supportsRowSplit: true,
  },
};

export const defaultExplorerWorkspaceLayoutMode: ExplorerWorkspaceLayoutMode = 'single';
export const defaultExplorerWorkspaceAxisRatio = 0.5;

export function normalizeExplorerWorkspaceLayoutMode(
  value: unknown,
): ExplorerWorkspaceLayoutMode {
  if (value === 'split' || value === 'dual') {
    return 'split';
  }
  if (value === 'triple' || value === 'triad') {
    return 'triple';
  }
  if (value === 'quad') {
    return 'quad';
  }
  return defaultExplorerWorkspaceLayoutMode;
}

export function getExplorerWorkspaceLayoutDefinition(
  layoutMode?: ExplorerWorkspaceLayoutMode | null,
): ExplorerWorkspaceLayoutDefinition {
  return builtInExplorerWorkspaceLayouts[
    normalizeExplorerWorkspaceLayoutMode(layoutMode)
  ];
}

export function getExplorerWorkspaceVisiblePaneIds(
  layoutMode?: ExplorerWorkspaceLayoutMode | null,
): ExplorerPaneId[] {
  return getExplorerWorkspaceLayoutDefinition(layoutMode).visiblePaneIds;
}

export function normalizeExplorerPaneId(value: unknown): ExplorerPaneId {
  switch (value) {
    case 'pane-2':
    case 'right':
      return 'pane-2';
    case 'pane-3':
      return 'pane-3';
    case 'pane-4':
      return 'pane-4';
    case 'pane-1':
    case 'left':
    default:
      return 'pane-1';
  }
}

export function getExplorerPaneIndex(paneId: ExplorerPaneId): number {
  return explorerPaneIds.indexOf(paneId);
}

export function getExplorerPaneLabel(paneId: ExplorerPaneId): string {
  return `Pane ${getExplorerPaneIndex(paneId) + 1}`;
}

export function createEmptyExplorerPaneRecord<T>(
  factory: () => T,
): Record<ExplorerPaneId, T> {
  return Object.fromEntries(
    explorerPaneIds.map((paneId) => [paneId, factory()]),
  ) as Record<ExplorerPaneId, T>;
}

export function clampExplorerWorkspaceAxisRatio(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultExplorerWorkspaceAxisRatio;
  }
  return Math.max(0.28, Math.min(0.72, value));
}
