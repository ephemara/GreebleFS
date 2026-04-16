import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from './pluginContributions';

export type ExplorerContextMenuTarget = 'entry' | 'background';
export type ExplorerContextMenuItemGroup =
  | 'create'
  | 'open'
  | 'system'
  | 'clipboard'
  | 'organize'
  | 'library'
  | 'plugin'
  | 'danger';

export type ExplorerBuiltInContextMenuActionId =
  | 'open'
  | 'open-archive'
  | 'open-with'
  | 'open-admin'
  | 'open-terminal'
  | 'open-aquarium'
  | 'reveal'
  | 'properties'
  | 'copy-path'
  | 'new-folder'
  | 'new-file'
  | 'paste'
  | 'copy'
  | 'cut'
  | 'copy-to'
  | 'move-to'
  | 'extract-here'
  | 'extract-new-folder'
  | 'duplicate'
  | 'rename'
  | 'add-tags'
  | 'remove-tags'
  | 'bookmark-toggle'
  | 'move-trash'
  | 'refresh';

export interface ExplorerContextMenuItemOverride {
  enabled?: boolean;
  order?: number;
}

export type ExplorerContextMenuItemOverrideMap = Record<string, ExplorerContextMenuItemOverride>;

export interface ExplorerContextMenuCatalogItemBase {
  id: string;
  title: string;
  description?: string;
  contexts: ExplorerContextMenuTarget[];
  appliesTo: 'any' | 'file' | 'directory';
  group: ExplorerContextMenuItemGroup;
  defaultOrder: number;
  source: 'built-in' | 'plugin';
  iconName?: string;
}

export interface ExplorerBuiltInContextMenuCatalogItem extends ExplorerContextMenuCatalogItemBase {
  source: 'built-in';
  execution: {
    kind: 'built-in';
    actionId: ExplorerBuiltInContextMenuActionId;
  };
}

export interface ExplorerResolvedPluginContextMenuContribution extends ExplorerContextMenuCatalogItemBase {
  source: 'plugin';
  pluginId: string;
  pluginName: string;
  execution: OverlayPluginContextMenuContribution['execution'];
}

export type ExplorerContextMenuCatalogItem =
  | ExplorerBuiltInContextMenuCatalogItem
  | ExplorerResolvedPluginContextMenuContribution;

export interface ExplorerSortableContextMenuItem {
  id: string;
  defaultOrder: number;
}

const EXPLORER_CONTEXT_MENU_GROUPS: ExplorerContextMenuItemGroup[] = [
  'create',
  'open',
  'system',
  'clipboard',
  'organize',
  'library',
  'plugin',
  'danger',
];

export const BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS: ExplorerBuiltInContextMenuCatalogItem[] = [
  {
    id: 'built-in.open',
    title: 'Open',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'open',
    defaultOrder: 10,
    source: 'built-in',
    iconName: 'ExternalLink',
    execution: { kind: 'built-in', actionId: 'open' },
  },
  {
    id: 'built-in.open-with',
    title: 'Open With...',
    contexts: ['entry', 'background'],
    appliesTo: 'any',
    group: 'open',
    defaultOrder: 20,
    source: 'built-in',
    iconName: 'ExternalLink',
    execution: { kind: 'built-in', actionId: 'open-with' },
  },
  {
    id: 'built-in.open-archive',
    title: 'Open Extracted Contents',
    contexts: ['entry'],
    appliesTo: 'file',
    group: 'open',
    defaultOrder: 25,
    source: 'built-in',
    iconName: 'FolderPlus',
    execution: { kind: 'built-in', actionId: 'open-archive' },
  },
  {
    id: 'built-in.open-admin',
    title: 'Open as Admin',
    contexts: ['entry', 'background'],
    appliesTo: 'any',
    group: 'open',
    defaultOrder: 30,
    source: 'built-in',
    iconName: 'Shield',
    execution: { kind: 'built-in', actionId: 'open-admin' },
  },
  {
    id: 'built-in.open-terminal',
    title: 'Open in Terminal',
    contexts: ['entry'],
    appliesTo: 'directory',
    group: 'open',
    defaultOrder: 40,
    source: 'built-in',
    iconName: 'Terminal',
    execution: { kind: 'built-in', actionId: 'open-terminal' },
  },
  {
    id: 'built-in.open-aquarium',
    title: 'Open in Filesystem Aquarium',
    contexts: ['entry', 'background'],
    appliesTo: 'any',
    group: 'open',
    defaultOrder: 50,
    source: 'built-in',
    iconName: 'Sparkles',
    execution: { kind: 'built-in', actionId: 'open-aquarium' },
  },
  {
    id: 'built-in.reveal',
    title: 'Reveal in Explorer',
    contexts: ['entry', 'background'],
    appliesTo: 'any',
    group: 'system',
    defaultOrder: 60,
    source: 'built-in',
    iconName: 'Eye',
    execution: { kind: 'built-in', actionId: 'reveal' },
  },
  {
    id: 'built-in.properties',
    title: 'Properties',
    contexts: ['entry', 'background'],
    appliesTo: 'any',
    group: 'system',
    defaultOrder: 70,
    source: 'built-in',
    iconName: 'Info',
    execution: { kind: 'built-in', actionId: 'properties' },
  },
  {
    id: 'built-in.copy-path',
    title: 'Copy Path',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 80,
    source: 'built-in',
    iconName: 'Copy',
    execution: { kind: 'built-in', actionId: 'copy-path' },
  },
  {
    id: 'built-in.new-folder',
    title: 'New Folder',
    contexts: ['background'],
    appliesTo: 'any',
    group: 'create',
    defaultOrder: 90,
    source: 'built-in',
    iconName: 'FolderPlus',
    execution: { kind: 'built-in', actionId: 'new-folder' },
  },
  {
    id: 'built-in.new-file',
    title: 'New File...',
    contexts: ['background'],
    appliesTo: 'any',
    group: 'create',
    defaultOrder: 100,
    source: 'built-in',
    iconName: 'FilePlus',
    execution: { kind: 'built-in', actionId: 'new-file' },
  },
  {
    id: 'built-in.paste',
    title: 'Paste',
    contexts: ['background'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 110,
    source: 'built-in',
    iconName: 'Clipboard',
    execution: { kind: 'built-in', actionId: 'paste' },
  },
  {
    id: 'built-in.copy',
    title: 'Copy',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 120,
    source: 'built-in',
    iconName: 'Copy',
    execution: { kind: 'built-in', actionId: 'copy' },
  },
  {
    id: 'built-in.cut',
    title: 'Cut',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 130,
    source: 'built-in',
    iconName: 'Scissors',
    execution: { kind: 'built-in', actionId: 'cut' },
  },
  {
    id: 'built-in.copy-to',
    title: 'Copy To...',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 135,
    source: 'built-in',
    iconName: 'Copy',
    execution: { kind: 'built-in', actionId: 'copy-to' },
  },
  {
    id: 'built-in.move-to',
    title: 'Move To...',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 138,
    source: 'built-in',
    iconName: 'Scissors',
    execution: { kind: 'built-in', actionId: 'move-to' },
  },
  {
    id: 'built-in.extract-here',
    title: 'Extract Here',
    contexts: ['entry'],
    appliesTo: 'file',
    group: 'organize',
    defaultOrder: 155,
    source: 'built-in',
    iconName: 'FolderPlus',
    execution: { kind: 'built-in', actionId: 'extract-here' },
  },
  {
    id: 'built-in.extract-new-folder',
    title: 'Extract to New Folder',
    contexts: ['entry'],
    appliesTo: 'file',
    group: 'organize',
    defaultOrder: 156,
    source: 'built-in',
    iconName: 'CopyPlus',
    execution: { kind: 'built-in', actionId: 'extract-new-folder' },
  },
  {
    id: 'built-in.duplicate',
    title: 'Duplicate',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'clipboard',
    defaultOrder: 140,
    source: 'built-in',
    iconName: 'CopyPlus',
    execution: { kind: 'built-in', actionId: 'duplicate' },
  },
  {
    id: 'built-in.rename',
    title: 'Rename (F2)',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'organize',
    defaultOrder: 150,
    source: 'built-in',
    iconName: 'Edit3',
    execution: { kind: 'built-in', actionId: 'rename' },
  },
  {
    id: 'built-in.add-tags',
    title: 'Add Tags...',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'organize',
    defaultOrder: 160,
    source: 'built-in',
    iconName: 'Tags',
    execution: { kind: 'built-in', actionId: 'add-tags' },
  },
  {
    id: 'built-in.remove-tags',
    title: 'Remove Tags...',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'organize',
    defaultOrder: 170,
    source: 'built-in',
    iconName: 'Tags',
    execution: { kind: 'built-in', actionId: 'remove-tags' },
  },
  {
    id: 'built-in.bookmark-toggle',
    title: 'Toggle Bookmark',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'library',
    defaultOrder: 180,
    source: 'built-in',
    iconName: 'Star',
    execution: { kind: 'built-in', actionId: 'bookmark-toggle' },
  },
  {
    id: 'built-in.refresh',
    title: 'Refresh',
    contexts: ['background'],
    appliesTo: 'any',
    group: 'system',
    defaultOrder: 190,
    source: 'built-in',
    iconName: 'RefreshCw',
    execution: { kind: 'built-in', actionId: 'refresh' },
  },
  {
    id: 'built-in.move-trash',
    title: 'Move to Trash',
    contexts: ['entry'],
    appliesTo: 'any',
    group: 'danger',
    defaultOrder: 200,
    source: 'built-in',
    iconName: 'Trash2',
    execution: { kind: 'built-in', actionId: 'move-trash' },
  },
];

export function normalizeExplorerContextMenuItemOverrideMap(
  value: unknown,
): ExplorerContextMenuItemOverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .flatMap(([itemId, overrideValue]) => {
        const trimmedItemId = itemId.trim();
        if (!trimmedItemId || !overrideValue || typeof overrideValue !== 'object' || Array.isArray(overrideValue)) {
          return [];
        }

        const overrideRecord = overrideValue as Record<string, unknown>;
        const normalizedOverride: ExplorerContextMenuItemOverride = {};
        if (typeof overrideRecord.enabled === 'boolean') {
          normalizedOverride.enabled = overrideRecord.enabled;
        }
        if (typeof overrideRecord.order === 'number' && Number.isFinite(overrideRecord.order)) {
          normalizedOverride.order = Math.round(overrideRecord.order);
        }

        return Object.keys(normalizedOverride).length > 0
          ? [[trimmedItemId, normalizedOverride] as const]
          : [];
      }),
  );
}

export function isExplorerContextMenuItemEnabled(
  itemId: string,
  overrides: ExplorerContextMenuItemOverrideMap,
): boolean {
  return overrides[itemId]?.enabled ?? true;
}

export function resolveExplorerContextMenuItemOrder(
  itemId: string,
  defaultOrder: number,
  overrides: ExplorerContextMenuItemOverrideMap,
): number {
  return overrides[itemId]?.order ?? defaultOrder;
}

export function sortExplorerContextMenuItems<TItem extends ExplorerSortableContextMenuItem>(
  items: TItem[],
  overrides: ExplorerContextMenuItemOverrideMap,
): TItem[] {
  return [...items].sort((left, right) => {
    const orderDelta = resolveExplorerContextMenuItemOrder(left.id, left.defaultOrder, overrides)
      - resolveExplorerContextMenuItemOrder(right.id, right.defaultOrder, overrides);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return left.id.localeCompare(right.id);
  });
}

export function buildExplorerContextMenuOverrideMap(
  orderedItems: ExplorerSortableContextMenuItem[],
  previousOverrides: ExplorerContextMenuItemOverrideMap,
): ExplorerContextMenuItemOverrideMap {
  const normalizedPreviousOverrides = normalizeExplorerContextMenuItemOverrideMap(previousOverrides);
  return Object.fromEntries(
    orderedItems.map((item, index) => {
      const previousOverride = normalizedPreviousOverrides[item.id] ?? {};
      const nextOverride: ExplorerContextMenuItemOverride = {
        order: (index + 1) * 10,
      };
      if (typeof previousOverride.enabled === 'boolean') {
        nextOverride.enabled = previousOverride.enabled;
      }
      return [item.id, nextOverride];
    }),
  );
}

export function withExplorerContextMenuItemEnabled(
  overrides: ExplorerContextMenuItemOverrideMap,
  item: ExplorerSortableContextMenuItem,
  enabled: boolean,
): ExplorerContextMenuItemOverrideMap {
  return {
    ...normalizeExplorerContextMenuItemOverrideMap(overrides),
    [item.id]: {
      ...normalizeExplorerContextMenuItemOverrideMap(overrides)[item.id],
      enabled,
      order: resolveExplorerContextMenuItemOrder(item.id, item.defaultOrder, overrides),
    },
  };
}

export function moveExplorerContextMenuItem(
  orderedItems: ExplorerSortableContextMenuItem[],
  overrides: ExplorerContextMenuItemOverrideMap,
  itemId: string,
  direction: 'up' | 'down',
): ExplorerContextMenuItemOverrideMap {
  const currentIndex = orderedItems.findIndex(item => item.id === itemId);
  if (currentIndex < 0) {
    return normalizeExplorerContextMenuItemOverrideMap(overrides);
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= orderedItems.length) {
    return normalizeExplorerContextMenuItemOverrideMap(overrides);
  }

  const reorderedItems = [...orderedItems];
  const [movedItem] = reorderedItems.splice(currentIndex, 1);
  reorderedItems.splice(targetIndex, 0, movedItem);
  return buildExplorerContextMenuOverrideMap(reorderedItems, overrides);
}

export function createLegacyExplorerActionContextMenuContributions(
  actions: OverlayPluginExplorerActionContribution[],
): OverlayPluginContextMenuContribution[] {
  return actions.map((action, index) => ({
    id: `${action.pluginId}.legacy-explorer-action.${action.id}`,
    pluginId: action.pluginId,
    pluginName: action.pluginName,
    title: `${action.pluginName}: ${action.label}`,
    description: action.description,
    contexts: ['entry'],
    appliesTo: action.appliesTo,
    group: 'plugin',
    defaultOrder: 600 + index * 10,
    iconName: 'Puzzle',
    execution: {
      kind: 'terminal-template',
      command: action.command,
      runOnSelect: action.runOnSelect,
    },
  }));
}

export function normalizePluginContextMenuContributions(
  contributions: OverlayPluginContextMenuContribution[],
): ExplorerResolvedPluginContextMenuContribution[] {
  return contributions.map((contribution, index) => ({
    id: contribution.id,
    pluginId: contribution.pluginId,
    pluginName: contribution.pluginName,
    title: contribution.title,
    description: contribution.description,
    contexts: contribution.contexts,
    appliesTo: contribution.appliesTo,
    group: EXPLORER_CONTEXT_MENU_GROUPS.includes(contribution.group as ExplorerContextMenuItemGroup)
      ? contribution.group as ExplorerContextMenuItemGroup
      : 'plugin',
    defaultOrder: contribution.defaultOrder ?? (700 + index * 10),
    source: 'plugin',
    iconName: contribution.iconName ?? 'Puzzle',
    execution: contribution.execution,
  }));
}
