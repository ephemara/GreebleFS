export type ExplorerRailSectionId = 'quick-access' | 'drives' | 'saved-searches' | 'tags' | 'bookmarks';

export type ExplorerRailViewMode = 'default' | 'compact' | 'tree';

export interface ExplorerRailWidthBounds {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

export interface ExplorerBookmarkCategoryPreset {
  id: string;
  name: string;
  color: string;
  keywords: string[];
}

export interface ExplorerBookmarkColorOption {
  id: string;
  value: string;
}

export interface ExplorerRailViewModeDefinition {
  id: ExplorerRailViewMode;
  label: string;
  shortLabel: string;
  description: string;
  useCompactChrome: boolean;
  hideSupportingMeta: boolean;
  flattenDriveRows: boolean;
  hideDriveCapacity: boolean;
  treeIndentStep: number;
}

export const explorerRailWidthBoundsByLayout: Record<'full' | 'compact', ExplorerRailWidthBounds> = {
  full: {
    defaultWidth: 220,
    minWidth: 168,
    maxWidth: 360,
  },
  compact: {
    defaultWidth: 172,
    minWidth: 144,
    maxWidth: 260,
  },
};

export const explorerRailSectionOrder: ExplorerRailSectionId[] = [
  'quick-access',
  'drives',
  'saved-searches',
  'tags',
  'bookmarks',
];

export const explorerRailViewModes: ExplorerRailViewModeDefinition[] = [
  {
    id: 'default',
    label: 'Default',
    shortLabel: 'Def',
    description: 'Balanced rail with metadata and drive details.',
    useCompactChrome: false,
    hideSupportingMeta: false,
    flattenDriveRows: false,
    hideDriveCapacity: false,
    treeIndentStep: 16,
  },
  {
    id: 'compact',
    label: 'Compact',
    shortLabel: 'Cmp',
    description: 'Denser rows with metadata trimmed back.',
    useCompactChrome: true,
    hideSupportingMeta: true,
    flattenDriveRows: false,
    hideDriveCapacity: true,
    treeIndentStep: 12,
  },
  {
    id: 'tree',
    label: 'Tree',
    shortLabel: 'Tree',
    description: 'Navigation-first rail with flatter drive roots and tighter indentation.',
    useCompactChrome: true,
    hideSupportingMeta: true,
    flattenDriveRows: true,
    hideDriveCapacity: true,
    treeIndentStep: 10,
  },
];

export const explorerBookmarkCategoryPresets: ExplorerBookmarkCategoryPreset[] = [
  {
    id: 'workspace',
    name: 'Workspace',
    color: '#7dd3fc',
    keywords: ['code', 'workspace', 'repo', 'project', 'src', 'overlayterm', 'kain', 'monorepo'],
  },
  {
    id: 'media',
    name: 'Media',
    color: '#fda4af',
    keywords: ['media', 'image', 'video', 'audio', 'photo', 'render', 'music'],
  },
  {
    id: 'system',
    name: 'System',
    color: '#fca5a5',
    keywords: ['windows', 'program files', 'appdata', 'system', 'drivers', 'users'],
  },
  {
    id: 'docs',
    name: 'Docs',
    color: '#fde68a',
    keywords: ['doc', 'docs', 'notes', 'design', 'readme', 'wiki', 'reference'],
  },
  {
    id: 'tools',
    name: 'Tools',
    color: '#86efac',
    keywords: ['tools', 'scripts', 'bin', 'util', 'plugin', 'automation'],
  },
  {
    id: 'favorites',
    name: 'Favorites',
    color: '#c4b5fd',
    keywords: ['favorite', 'home', 'desktop', 'downloads'],
  },
];

export const explorerBookmarkColorOptions: ExplorerBookmarkColorOption[] = [
  { id: 'sky', value: '#7dd3fc' },
  { id: 'mint', value: '#86efac' },
  { id: 'amber', value: '#fcd34d' },
  { id: 'rose', value: '#fb7185' },
  { id: 'violet', value: '#c4b5fd' },
  { id: 'orange', value: '#fdba74' },
  { id: 'slate', value: '#94a3b8' },
];

export function getExplorerRailWidthBounds(isCompactDock: boolean): ExplorerRailWidthBounds {
  return isCompactDock ? explorerRailWidthBoundsByLayout.compact : explorerRailWidthBoundsByLayout.full;
}

export function normalizeExplorerRailViewMode(value: unknown): ExplorerRailViewMode {
  return explorerRailViewModes.some((entry) => entry.id === value) ? value as ExplorerRailViewMode : 'default';
}

export function getExplorerRailViewModeDefinition(value: unknown): ExplorerRailViewModeDefinition {
  const normalizedViewMode = normalizeExplorerRailViewMode(value);
  return explorerRailViewModes.find((entry) => entry.id === normalizedViewMode) ?? explorerRailViewModes[0];
}
