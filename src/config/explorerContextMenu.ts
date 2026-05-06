import type { LoadedExplorerAction } from './actionPacks';
import type {
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
} from './pluginContributions';

export type ExplorerContextMenuTarget = 'entry' | 'background';
export type ExplorerMenuContextKind =
  | 'entry'
  | 'background'
  | 'multi-select'
  | 'search-result'
  | 'preview-pane';
export type ExplorerMenuRendererKind =
  | 'classic'
  | 'hybrid'
  | 'radial'
  | 'sheet'
  | 'hud';
export type ExplorerMenuInputModality = 'mouse' | 'touch' | 'pen' | 'keyboard';
export type ExplorerMenuTone = 'safe' | 'accent' | 'muted' | 'warning' | 'danger';
export type ExplorerMenuQuickSlot =
  | 'none'
  | 'primary'
  | 'secondary'
  | 'quick-left'
  | 'quick-right';
export type ExplorerMenuFallbackBucket =
  | 'default'
  | 'touch'
  | 'keyboard'
  | 'reduced-motion'
  | 'overflow';
export type ExplorerContextMenuItemGroup =
  | 'create'
  | 'open'
  | 'action'
  | 'preview'
  | 'system'
  | 'clipboard'
  | 'organize'
  | 'library'
  | 'plugin'
  | 'danger';

export type ExplorerBuiltInContextMenuActionId =
  | 'open'
  | 'open-with'
  | 'windows-shell-actions'
  | 'open-admin'
  | 'open-terminal'
  | 'open-aquarium'
  | 'edit-menu'
  | 'send-to-mobile-download'
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
  | 'extract-to'
  | 'extract-new-folder'
  | 'duplicate'
  | 'find-similar'
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

export type ExplorerContextMenuItemOverrideMap = Record<
  string,
  ExplorerContextMenuItemOverride
>;

export interface ExplorerMenuThemeHints {
  colorRole?: 'accent' | 'muted' | 'warning' | 'danger';
  materialRole?: string;
}

export interface ExplorerMenuSpatialHint {
  zone?: string;
  spoke?: string;
}

export interface ExplorerMenuPresentationCapabilityRule {
  when: ExplorerMenuInputModality | 'reduced-motion';
  renderer: ExplorerMenuRendererKind;
}

export interface ExplorerMenuPresentationRecipe {
  renderer?: ExplorerMenuRendererKind;
  fallbackRenderer?: ExplorerMenuRendererKind;
  shapeLanguage?: string;
  motionStyle?: string;
  materialStyle?: string;
  density?: 'compact' | 'balanced' | 'touch';
  iconTreatment?: 'standard' | 'duotone' | 'outlined';
  submenuBehavior?: 'sidecar' | 'sheet' | 'stacked';
  focusStyle?: 'line' | 'glow' | 'pill';
  backdropStyle?: 'none' | 'blur' | 'scrim';
  capabilityRules?: ExplorerMenuPresentationCapabilityRule[];
}

export interface ExplorerMenuInvocationEntry {
  path: string;
  name: string;
  parentPath: string;
  extension: string;
  stem: string;
  isDirectory: boolean;
}

export interface ExplorerMenuPreviewContext {
  previewKind: string;
  workflowTabId: string | null;
  workflowBaseMode: 'preview' | 'edit' | null;
}

export interface ExplorerMenuInvocationContext {
  kind: ExplorerMenuContextKind;
  currentLocation: string;
  selectedEntries: ExplorerMenuInvocationEntry[];
  primaryEntry: ExplorerMenuInvocationEntry | null;
  searchResult: {
    query: string;
    searchMode: string;
  } | null;
  previewTarget: ExplorerMenuInvocationEntry | null;
  previewContext: ExplorerMenuPreviewContext | null;
  inputModality: ExplorerMenuInputModality;
  reducedMotion: boolean;
  capabilities: {
    mouse: boolean;
    touch: boolean;
    pen: boolean;
    keyboard: boolean;
  };
}

export interface ExplorerContextMenuCatalogItemBase {
  id: string;
  title: string;
  description?: string;
  contexts: ExplorerMenuContextKind[];
  appliesTo: 'any' | 'file' | 'directory';
  group: ExplorerContextMenuItemGroup;
  defaultOrder: number;
  priority: number;
  source: 'built-in' | 'plugin' | 'preview' | 'action';
  iconName?: string;
  tone: ExplorerMenuTone;
  shortcutId?: string;
  themeHints?: ExplorerMenuThemeHints;
  supportsQuickSlot?: boolean;
  behavior: 'leaf' | 'resolver';
}

export interface ExplorerBuiltInContextMenuCatalogItem
  extends ExplorerContextMenuCatalogItemBase {
  source: 'built-in';
  execution: {
    kind: 'built-in';
    actionId: ExplorerBuiltInContextMenuActionId;
  };
}

export interface ExplorerResolvedPluginContextMenuContribution
  extends ExplorerContextMenuCatalogItemBase {
  source: 'plugin';
  pluginId: string;
  pluginName: string;
  execution: OverlayPluginContextMenuContribution['execution'];
}

export interface ExplorerPreviewContextMenuCatalogItem
  extends ExplorerContextMenuCatalogItemBase {
  source: 'preview';
  execution: {
    kind: 'preview';
  };
}

export interface ExplorerResolvedActionContextMenuContribution
  extends ExplorerContextMenuCatalogItemBase {
  source: 'action';
  packId: string;
  packName: string;
  pluginId?: string;
  pluginName?: string;
  execution: {
    kind: 'action';
    action: LoadedExplorerAction;
  };
}

export type ExplorerCommandDefinition =
  | ExplorerBuiltInContextMenuCatalogItem
  | ExplorerResolvedPluginContextMenuContribution
  | ExplorerPreviewContextMenuCatalogItem
  | ExplorerResolvedActionContextMenuContribution;
export type ExplorerContextMenuCatalogItem = ExplorerCommandDefinition;

export interface ExplorerSortableContextMenuItem {
  id: string;
  defaultOrder: number;
}

export interface ExplorerMenuLayoutEntryBase {
  id: string;
  parentEntryId: string | null;
  order: number;
  enabled?: boolean;
  quickSlot?: ExplorerMenuQuickSlot;
  fallbackBucket?: ExplorerMenuFallbackBucket;
  spatialHint?: ExplorerMenuSpatialHint;
}

export interface ExplorerMenuCommandEntry extends ExplorerMenuLayoutEntryBase {
  kind: 'command';
  commandId: string;
}

export interface ExplorerMenuSubmenuEntry extends ExplorerMenuLayoutEntryBase {
  kind: 'submenu';
  title: string;
  iconName?: string;
}

export interface ExplorerMenuSeparatorEntry extends ExplorerMenuLayoutEntryBase {
  kind: 'separator';
}

export interface ExplorerMenuGroupSlotEntry extends ExplorerMenuLayoutEntryBase {
  kind: 'group-slot';
  group: ExplorerContextMenuItemGroup;
  sourceFilter?: 'any' | 'built-in' | 'plugin' | 'preview' | 'action';
}

export type ExplorerMenuLayoutEntry =
  | ExplorerMenuCommandEntry
  | ExplorerMenuSubmenuEntry
  | ExplorerMenuSeparatorEntry
  | ExplorerMenuGroupSlotEntry;

export interface ExplorerMenuContextLayout {
  renderer?: ExplorerMenuRendererKind;
  density?: 'compact' | 'balanced' | 'touch';
  showDescriptions?: boolean;
  entries: ExplorerMenuLayoutEntry[];
}

export interface ExplorerMenuPackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  presentation?: ExplorerMenuPresentationRecipe;
  contexts?: Partial<Record<ExplorerMenuContextKind, ExplorerMenuContextLayout>>;
}

export type ExplorerMenuContextLayoutOverrideMap = Partial<
  Record<ExplorerMenuContextKind, ExplorerMenuContextLayout>
>;

export interface ExplorerResolvedMenuNodeBase {
  id: string;
  label: string;
  depth: number;
  iconName?: string;
  tone: ExplorerMenuTone;
  source: 'built-in' | 'plugin' | 'preview' | 'action' | 'layout';
  quickSlot: ExplorerMenuQuickSlot;
  fallbackBucket: ExplorerMenuFallbackBucket;
}

export interface ExplorerResolvedMenuCommandNode
  extends ExplorerResolvedMenuNodeBase {
  kind: 'command';
  commandId: string;
  disabled: boolean;
  description?: string;
  shortcutId?: string;
  command: ExplorerCommandDefinition;
}

export interface ExplorerResolvedMenuSubmenuNode
  extends ExplorerResolvedMenuNodeBase {
  kind: 'submenu';
  children: ExplorerResolvedMenuNode[];
}

export interface ExplorerResolvedMenuSeparatorNode
  extends ExplorerResolvedMenuNodeBase {
  kind: 'separator';
}

export type ExplorerResolvedMenuNode =
  | ExplorerResolvedMenuCommandNode
  | ExplorerResolvedMenuSubmenuNode
  | ExplorerResolvedMenuSeparatorNode;

export const EXPLORER_MENU_CONTEXT_KINDS: ExplorerMenuContextKind[] = [
  'entry',
  'background',
  'multi-select',
  'search-result',
  'preview-pane',
];

const EXPLORER_CONTEXT_MENU_GROUPS: ExplorerContextMenuItemGroup[] = [
  'create',
  'open',
  'action',
  'preview',
  'system',
  'clipboard',
  'organize',
  'library',
  'plugin',
  'danger',
];

function sanitizeContextMenuString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sanitizeContextMenuContexts(value: unknown): ExplorerContextMenuTarget[] {
  if (!Array.isArray(value)) {
    return ['entry'];
  }

  const contexts = value.filter(
    (context): context is ExplorerContextMenuTarget =>
      context === 'entry' || context === 'background',
  );
  return contexts.length > 0 ? contexts : ['entry'];
}

function sanitizeMenuContextKinds(value: unknown): ExplorerMenuContextKind[] {
  if (!Array.isArray(value)) {
    return ['entry'];
  }

  const contexts = value.filter((context): context is ExplorerMenuContextKind =>
    EXPLORER_MENU_CONTEXT_KINDS.includes(context as ExplorerMenuContextKind),
  );
  return contexts.length > 0 ? contexts : ['entry'];
}

function sanitizeContextMenuAppliesTo(
  value: unknown,
): 'any' | 'file' | 'directory' {
  return value === 'file' || value === 'directory' ? value : 'any';
}

function sanitizeContextMenuExecution(
  execution: unknown,
): OverlayPluginContextMenuContribution['execution'] | null {
  if (!execution || typeof execution !== 'object') {
    return null;
  }

  const record = execution as Record<string, unknown>;
  if (record.kind === 'terminal-template') {
    const command = sanitizeContextMenuString(record.command);
    if (!command) {
      return null;
    }
    return {
      kind: 'terminal-template',
      command,
      runOnSelect: record.runOnSelect === true,
    };
  }

  if (record.kind === 'plugin-backend') {
    const entry = sanitizeContextMenuString(record.entry);
    if (!entry) {
      return null;
    }
    return {
      kind: 'plugin-backend',
      entry,
      args: Array.isArray(record.args)
        ? record.args.filter(
            (argument): argument is string => typeof argument === 'string',
          )
        : [],
    };
  }

  if (record.kind === 'panel-request') {
    const panelId = sanitizeContextMenuString(record.panelId);
    if (!panelId) {
      return null;
    }
    const payloadEntries =
      record.payload && typeof record.payload === 'object'
        ? Object.entries(record.payload as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          )
        : [];
    const payload =
      record.payload && typeof record.payload === 'object'
        ? (Object.fromEntries(payloadEntries) as Record<string, string>)
        : {};
    return {
      kind: 'panel-request',
      panelId,
      payload,
    };
  }

  return null;
}

function sanitizeMenuTone(value: unknown): ExplorerMenuTone {
  return value === 'accent' ||
    value === 'muted' ||
    value === 'warning' ||
    value === 'danger'
    ? value
    : 'safe';
}

function sanitizeQuickSlot(value: unknown): ExplorerMenuQuickSlot {
  return value === 'primary' ||
    value === 'secondary' ||
    value === 'quick-left' ||
    value === 'quick-right'
    ? value
    : 'none';
}

function sanitizeFallbackBucket(value: unknown): ExplorerMenuFallbackBucket {
  return value === 'touch' ||
    value === 'keyboard' ||
    value === 'reduced-motion' ||
    value === 'overflow'
    ? value
    : 'default';
}

function sanitizeSpatialHint(value: unknown): ExplorerMenuSpatialHint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const zone = sanitizeContextMenuString(record.zone);
  const spoke = sanitizeContextMenuString(record.spoke);
  if (!zone && !spoke) {
    return undefined;
  }
  return {
    zone: zone || undefined,
    spoke: spoke || undefined,
  };
}

export function normalizeExplorerMenuPresentationRecipe(
  value: unknown,
): ExplorerMenuPresentationRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const capabilityRules = Array.isArray(record.capabilityRules)
    ? record.capabilityRules
        .map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return null;
          }
          const ruleRecord = entry as Record<string, unknown>;
          const when = sanitizeContextMenuString(ruleRecord.when);
          const renderer = sanitizeContextMenuString(ruleRecord.renderer);
          if (
            (when !== 'mouse' &&
              when !== 'touch' &&
              when !== 'pen' &&
              when !== 'keyboard' &&
              when !== 'reduced-motion') ||
            (renderer !== 'classic' &&
              renderer !== 'hybrid' &&
              renderer !== 'radial' &&
              renderer !== 'sheet' &&
              renderer !== 'hud')
          ) {
            return null;
          }
          return {
            when: when as ExplorerMenuPresentationCapabilityRule['when'],
            renderer: renderer as ExplorerMenuRendererKind,
          };
        })
        .filter(
          (rule): rule is ExplorerMenuPresentationCapabilityRule => rule != null,
        )
    : [];

  return {
    renderer:
      record.renderer === 'classic' ||
      record.renderer === 'hybrid' ||
      record.renderer === 'radial' ||
      record.renderer === 'sheet' ||
      record.renderer === 'hud'
        ? record.renderer
        : undefined,
    fallbackRenderer:
      record.fallbackRenderer === 'classic' ||
      record.fallbackRenderer === 'hybrid' ||
      record.fallbackRenderer === 'radial' ||
      record.fallbackRenderer === 'sheet' ||
      record.fallbackRenderer === 'hud'
        ? record.fallbackRenderer
        : undefined,
    shapeLanguage: sanitizeContextMenuString(record.shapeLanguage) || undefined,
    motionStyle: sanitizeContextMenuString(record.motionStyle) || undefined,
    materialStyle: sanitizeContextMenuString(record.materialStyle) || undefined,
    density:
      record.density === 'compact' ||
      record.density === 'balanced' ||
      record.density === 'touch'
        ? record.density
        : undefined,
    iconTreatment:
      record.iconTreatment === 'standard' ||
      record.iconTreatment === 'duotone' ||
      record.iconTreatment === 'outlined'
        ? record.iconTreatment
        : undefined,
    submenuBehavior:
      record.submenuBehavior === 'sidecar' ||
      record.submenuBehavior === 'sheet' ||
      record.submenuBehavior === 'stacked'
        ? record.submenuBehavior
        : undefined,
    focusStyle:
      record.focusStyle === 'line' ||
      record.focusStyle === 'glow' ||
      record.focusStyle === 'pill'
        ? record.focusStyle
        : undefined,
    backdropStyle:
      record.backdropStyle === 'none' ||
      record.backdropStyle === 'blur' ||
      record.backdropStyle === 'scrim'
        ? record.backdropStyle
        : undefined,
    capabilityRules,
  };
}

export function normalizeExplorerMenuLayoutEntry(
  value: unknown,
): ExplorerMenuLayoutEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind = sanitizeContextMenuString(record.kind);
  const id = sanitizeContextMenuString(record.id);
  if (!id) {
    return null;
  }

  const base: ExplorerMenuLayoutEntryBase = {
    id,
    parentEntryId: sanitizeContextMenuString(record.parentEntryId) || null,
    order:
      typeof record.order === 'number' && Number.isFinite(record.order)
        ? Math.round(record.order)
        : 0,
    enabled:
      typeof record.enabled === 'boolean' ? record.enabled : undefined,
    quickSlot: sanitizeQuickSlot(record.quickSlot),
    fallbackBucket: sanitizeFallbackBucket(record.fallbackBucket),
    spatialHint: sanitizeSpatialHint(record.spatialHint),
  };

  if (kind === 'command') {
    const commandId = sanitizeContextMenuString(record.commandId);
    return commandId
      ? {
          ...base,
          kind: 'command',
          commandId,
        }
      : null;
  }

  if (kind === 'submenu') {
    const title = sanitizeContextMenuString(record.title);
    return title
      ? {
          ...base,
          kind: 'submenu',
          title,
          iconName: sanitizeContextMenuString(record.iconName) || undefined,
        }
      : null;
  }

  if (kind === 'separator') {
    return {
      ...base,
      kind: 'separator',
    };
  }

  if (kind === 'group-slot') {
    const group = sanitizeContextMenuString(record.group);
    if (!EXPLORER_CONTEXT_MENU_GROUPS.includes(group as ExplorerContextMenuItemGroup)) {
      return null;
    }
    return {
      ...base,
      kind: 'group-slot',
      group: group as ExplorerContextMenuItemGroup,
      sourceFilter:
        record.sourceFilter === 'built-in' ||
        record.sourceFilter === 'plugin' ||
        record.sourceFilter === 'preview' ||
        record.sourceFilter === 'action'
          ? record.sourceFilter
          : 'any',
    };
  }

  return null;
}

export function normalizeExplorerMenuContextLayout(
  value: unknown,
): ExplorerMenuContextLayout | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const entries = Array.isArray(record.entries)
    ? record.entries
        .map(normalizeExplorerMenuLayoutEntry)
        .filter((entry): entry is ExplorerMenuLayoutEntry => entry != null)
    : [];

  return {
    renderer:
      record.renderer === 'classic' ||
      record.renderer === 'hybrid' ||
      record.renderer === 'radial' ||
      record.renderer === 'sheet' ||
      record.renderer === 'hud'
        ? record.renderer
        : undefined,
    density:
      record.density === 'compact' ||
      record.density === 'balanced' ||
      record.density === 'touch'
        ? record.density
        : undefined,
    showDescriptions:
      typeof record.showDescriptions === 'boolean'
        ? record.showDescriptions
        : undefined,
    entries,
  };
}

export function normalizeExplorerMenuContextLayoutOverrideMap(
  value: unknown,
): ExplorerMenuContextLayoutOverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([contextKind, layout]) => {
        if (!EXPLORER_MENU_CONTEXT_KINDS.includes(contextKind as ExplorerMenuContextKind)) {
          return null;
        }
        const normalizedLayout = normalizeExplorerMenuContextLayout(layout);
        if (!normalizedLayout) {
          return null;
        }
        return [contextKind, normalizedLayout] as const;
      })
      .filter(
        (
          entry,
        ): entry is readonly [ExplorerMenuContextKind, ExplorerMenuContextLayout] =>
          entry != null,
      ),
  );
}

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
        if (
          !trimmedItemId ||
          !overrideValue ||
          typeof overrideValue !== 'object' ||
          Array.isArray(overrideValue)
        ) {
          return [];
        }

        const overrideRecord = overrideValue as Record<string, unknown>;
        const normalizedOverride: ExplorerContextMenuItemOverride = {};
        if (typeof overrideRecord.enabled === 'boolean') {
          normalizedOverride.enabled = overrideRecord.enabled;
        }
        if (
          typeof overrideRecord.order === 'number' &&
          Number.isFinite(overrideRecord.order)
        ) {
          normalizedOverride.order = Math.round(overrideRecord.order);
        }

        return Object.keys(normalizedOverride).length > 0
          ? [[trimmedItemId, normalizedOverride] as const]
          : [];
      }),
  );
}

export function sortExplorerMenuLayoutEntries(
  entries: ExplorerMenuLayoutEntry[],
): ExplorerMenuLayoutEntry[] {
  return [...entries].sort((left, right) => {
    if (left.parentEntryId !== right.parentEntryId) {
      return (left.parentEntryId ?? '').localeCompare(right.parentEntryId ?? '');
    }
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.id.localeCompare(right.id);
  });
}

export function moveExplorerMenuLayoutEntry(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
  direction: 'up' | 'down',
): ExplorerMenuLayoutEntry[] {
  const sortedEntries = sortExplorerMenuLayoutEntries(entries);
  const entry = sortedEntries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    return sortedEntries;
  }

  const siblings = sortedEntries.filter(
    (candidate) => candidate.parentEntryId === entry.parentEntryId,
  );
  const currentIndex = siblings.findIndex((candidate) => candidate.id === entryId);
  if (currentIndex < 0) {
    return sortedEntries;
  }
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return sortedEntries;
  }

  const reorderedSiblings = [...siblings];
  const [movedEntry] = reorderedSiblings.splice(currentIndex, 1);
  reorderedSiblings.splice(targetIndex, 0, movedEntry);
  const nextSiblingOrders = Object.fromEntries(
    reorderedSiblings.map((candidate, index) => [candidate.id, (index + 1) * 10]),
  );

  return sortedEntries.map((candidate) =>
    candidate.parentEntryId === entry.parentEntryId
      ? {
          ...candidate,
          order: nextSiblingOrders[candidate.id] ?? candidate.order,
        }
      : candidate,
  );
}

export function withExplorerMenuLayoutEntryEnabled(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
  enabled: boolean,
): ExplorerMenuLayoutEntry[] {
  return sortExplorerMenuLayoutEntries(
    entries.map((entry) =>
      entry.id === entryId ? { ...entry, enabled } : entry,
    ),
  );
}

export function withExplorerMenuLayoutEntryParent(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
  parentEntryId: string | null,
): ExplorerMenuLayoutEntry[] {
  if (parentEntryId === entryId) {
    return sortExplorerMenuLayoutEntries(entries);
  }

  const descendantIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    entries.forEach((entry) => {
      if (
        entry.parentEntryId
        && (entry.parentEntryId === entryId || descendantIds.has(entry.parentEntryId))
        && !descendantIds.has(entry.id)
      ) {
        descendantIds.add(entry.id);
        changed = true;
      }
    });
  }

  if (parentEntryId && descendantIds.has(parentEntryId)) {
    return sortExplorerMenuLayoutEntries(entries);
  }

  const siblings = entries.filter(
    (entry) => entry.parentEntryId === parentEntryId && entry.id !== entryId,
  );
  const nextOrder = (siblings.length + 1) * 10;
  return sortExplorerMenuLayoutEntries(
    entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            parentEntryId,
            order: nextOrder,
          }
        : entry,
    ),
  );
}

export function placeExplorerMenuLayoutEntry(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
  targetParentEntryId: string | null,
  targetIndex: number,
): ExplorerMenuLayoutEntry[] {
  const sortedEntries = sortExplorerMenuLayoutEntries(entries);
  const movingEntry = sortedEntries.find((entry) => entry.id === entryId);
  if (!movingEntry) {
    return sortedEntries;
  }

  if (targetParentEntryId === entryId) {
    return sortedEntries;
  }

  const descendantIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    sortedEntries.forEach((entry) => {
      if (
        entry.parentEntryId
        && (entry.parentEntryId === entryId || descendantIds.has(entry.parentEntryId))
        && !descendantIds.has(entry.id)
      ) {
        descendantIds.add(entry.id);
        changed = true;
      }
    });
  }
  if (targetParentEntryId && descendantIds.has(targetParentEntryId)) {
    return sortedEntries;
  }

  const currentParentEntryId = movingEntry.parentEntryId ?? null;
  const targetSiblings = sortedEntries.filter(
    (entry) => entry.parentEntryId === targetParentEntryId && entry.id !== entryId,
  );
  const clampedTargetIndex = Math.max(0, Math.min(targetIndex, targetSiblings.length));
  const reorderedTargetSiblings = [...targetSiblings];
  reorderedTargetSiblings.splice(clampedTargetIndex, 0, {
    ...movingEntry,
    parentEntryId: targetParentEntryId,
  });

  const nextTargetOrders = Object.fromEntries(
    reorderedTargetSiblings.map((entry, index) => [entry.id, (index + 1) * 10]),
  );

  const nextCurrentParentOrders = currentParentEntryId === targetParentEntryId
    ? nextTargetOrders
    : Object.fromEntries(
      sortedEntries
        .filter(
          (entry) =>
            entry.parentEntryId === currentParentEntryId && entry.id !== entryId,
        )
        .map((entry, index) => [entry.id, (index + 1) * 10]),
    );

  return sortExplorerMenuLayoutEntries(
    sortedEntries.map((entry) => {
      if (entry.id === entryId) {
        return {
          ...entry,
          parentEntryId: targetParentEntryId,
          order: nextTargetOrders[entry.id] ?? entry.order,
        };
      }

      if (entry.parentEntryId === targetParentEntryId) {
        return {
          ...entry,
          order: nextTargetOrders[entry.id] ?? entry.order,
        };
      }

      if (
        currentParentEntryId !== targetParentEntryId
        && entry.parentEntryId === currentParentEntryId
      ) {
        return {
          ...entry,
          order: nextCurrentParentOrders[entry.id] ?? entry.order,
        };
      }

      return entry;
    }),
  );
}

export function withExplorerMenuLayoutEntryPlacement(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
  updates: Partial<
    Pick<ExplorerMenuLayoutEntryBase, 'quickSlot' | 'fallbackBucket' | 'spatialHint'>
  >,
): ExplorerMenuLayoutEntry[] {
  return sortExplorerMenuLayoutEntries(
    entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            ...updates,
          }
        : entry,
    ),
  );
}

export function upsertExplorerMenuSubmenuEntry(
  entries: ExplorerMenuLayoutEntry[],
  submenu: ExplorerMenuSubmenuEntry,
): ExplorerMenuLayoutEntry[] {
  const existingIndex = entries.findIndex((entry) => entry.id === submenu.id);
  if (existingIndex >= 0) {
    return sortExplorerMenuLayoutEntries(
      entries.map((entry) => (entry.id === submenu.id ? submenu : entry)),
    );
  }

  return sortExplorerMenuLayoutEntries([...entries, submenu]);
}

export function removeExplorerMenuLayoutEntry(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
): ExplorerMenuLayoutEntry[] {
  const removedIds = new Set<string>([entryId]);
  let changed = true;
  while (changed) {
    changed = false;
    entries.forEach((entry) => {
      if (entry.parentEntryId && removedIds.has(entry.parentEntryId) && !removedIds.has(entry.id)) {
        removedIds.add(entry.id);
        changed = true;
      }
    });
  }

  return sortExplorerMenuLayoutEntries(
    entries.filter((entry) => !removedIds.has(entry.id)),
  );
}

export function createExplorerMenuSubmenuEntry(options: {
  contextKind: ExplorerMenuContextKind;
  title?: string;
  parentEntryId?: string | null;
  order?: number;
}): ExplorerMenuSubmenuEntry {
  const title = sanitizeContextMenuString(options.title, 'New Submenu');
  const idBase = `${options.contextKind}.submenu.${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom'}`;
  return {
    id: `${idBase}-${Date.now()}`,
    kind: 'submenu',
    title,
    parentEntryId: options.parentEntryId ?? null,
    order:
      typeof options.order === 'number' && Number.isFinite(options.order)
        ? Math.round(options.order)
        : 9990,
    enabled: true,
    quickSlot: 'none',
    fallbackBucket: 'default',
  };
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

export function sortExplorerContextMenuItems<
  TItem extends ExplorerSortableContextMenuItem,
>(items: TItem[], overrides: ExplorerContextMenuItemOverrideMap): TItem[] {
  return [...items].sort((left, right) => {
    const orderDelta =
      resolveExplorerContextMenuItemOrder(left.id, left.defaultOrder, overrides) -
      resolveExplorerContextMenuItemOrder(right.id, right.defaultOrder, overrides);
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
  const normalizedPreviousOverrides =
    normalizeExplorerContextMenuItemOverrideMap(previousOverrides);
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
  const currentIndex = orderedItems.findIndex((item) => item.id === itemId);
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
  contributions: ReadonlyArray<
    OverlayPluginContextMenuContribution | null | undefined
  >,
): ExplorerResolvedPluginContextMenuContribution[] {
  return contributions.flatMap((contribution, index) => {
    if (!contribution || typeof contribution !== 'object') {
      return [];
    }

    const execution = sanitizeContextMenuExecution(contribution.execution);
    if (!execution) {
      return [];
    }

    const pluginId = sanitizeContextMenuString(
      contribution.pluginId,
      `plugin-${index + 1}`,
    );
    const pluginName = sanitizeContextMenuString(
      contribution.pluginName,
      pluginId,
    );
    const id = sanitizeContextMenuString(
      contribution.id,
      `${pluginId}.context-menu.${index + 1}`,
    );
    const title = sanitizeContextMenuString(contribution.title, pluginName);
    const group = EXPLORER_CONTEXT_MENU_GROUPS.includes(
      contribution.group as ExplorerContextMenuItemGroup,
    )
      ? (contribution.group as ExplorerContextMenuItemGroup)
      : 'plugin';
    const defaultOrder =
      typeof contribution.defaultOrder === 'number' &&
      Number.isFinite(contribution.defaultOrder)
        ? contribution.defaultOrder
        : 700 + index * 10;
    const description =
      typeof contribution.description === 'string' &&
      contribution.description.trim()
        ? contribution.description.trim()
        : undefined;

    return [
      {
        id,
        pluginId,
        pluginName,
        title,
        description,
        contexts: sanitizeMenuContextKinds(sanitizeContextMenuContexts(contribution.contexts)),
        appliesTo: sanitizeContextMenuAppliesTo(contribution.appliesTo),
        group,
        defaultOrder,
        priority: defaultOrder,
        source: 'plugin' as const,
        iconName: sanitizeContextMenuString(contribution.iconName, 'Puzzle'),
        execution,
        tone: sanitizeMenuTone(
          (contribution as unknown as Record<string, unknown>).tone,
        ),
        shortcutId: sanitizeContextMenuString(
          (contribution as unknown as Record<string, unknown>).shortcutId,
        ) || undefined,
        themeHints: undefined,
        supportsQuickSlot: true,
        behavior: 'leaf' as const,
      },
    ];
  });
}

export function normalizeExplorerActionContributions(
  actions: ReadonlyArray<LoadedExplorerAction | null | undefined>,
): ExplorerResolvedActionContextMenuContribution[] {
  return actions.flatMap((action, index) => {
    if (!action) {
      return [];
    }

    const description =
      typeof action.description === 'string' && action.description.trim().length > 0
        ? action.description.trim()
        : undefined;
    const defaultOrder = 650 + index * 10;

    return [
      {
        id: action.id,
        title: action.title,
        description,
        contexts: sanitizeMenuContextKinds(action.contexts),
        appliesTo: sanitizeContextMenuAppliesTo(action.appliesTo),
        group: 'action',
        defaultOrder,
        priority: defaultOrder,
        source: 'action' as const,
        iconName: sanitizeContextMenuString(action.iconName, 'Sparkles'),
        execution: {
          kind: 'action',
          action,
        },
        tone: 'safe',
        shortcutId: undefined,
        themeHints: undefined,
        supportsQuickSlot: true,
        behavior: 'leaf' as const,
        packId: action.packId,
        packName: action.packName,
        pluginId: action.pluginId,
        pluginName: action.pluginName,
      },
    ];
  });
}

export const BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS: ExplorerBuiltInContextMenuCatalogItem[] =
  [
    {
      id: 'built-in.open',
      title: 'Open',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'open',
      defaultOrder: 10,
      priority: 10,
      source: 'built-in',
      iconName: 'ExternalLink',
      execution: { kind: 'built-in', actionId: 'open' },
      tone: 'safe',
      shortcutId: 'explorerOpenSelection',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.open-with',
      title: 'Open With',
      contexts: ['entry', 'background', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'open',
      defaultOrder: 20,
      priority: 20,
      source: 'built-in',
      iconName: 'ExternalLink',
      execution: { kind: 'built-in', actionId: 'open-with' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'resolver',
    },
    {
      id: 'built-in.windows-shell-actions',
      title: 'Windows Actions',
      contexts: [
        'entry',
        'background',
        'multi-select',
        'search-result',
        'preview-pane',
      ],
      appliesTo: 'any',
      group: 'system',
      defaultOrder: 25,
      priority: 25,
      source: 'built-in',
      iconName: 'Puzzle',
      execution: { kind: 'built-in', actionId: 'windows-shell-actions' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'resolver',
    },
    {
      id: 'built-in.open-admin',
      title: 'Open as Admin',
      contexts: ['entry', 'background', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'open',
      defaultOrder: 30,
      priority: 30,
      source: 'built-in',
      iconName: 'Shield',
      execution: { kind: 'built-in', actionId: 'open-admin' },
      tone: 'warning',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.open-terminal',
      title: 'Open in Terminal',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'directory',
      group: 'open',
      defaultOrder: 40,
      priority: 40,
      source: 'built-in',
      iconName: 'Terminal',
      execution: { kind: 'built-in', actionId: 'open-terminal' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.open-aquarium',
      title: 'Open in Filesystem Aquarium',
      contexts: ['entry', 'background', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'open',
      defaultOrder: 50,
      priority: 50,
      source: 'built-in',
      iconName: 'Sparkles',
      execution: { kind: 'built-in', actionId: 'open-aquarium' },
      tone: 'accent',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.send-to-mobile-download',
      title: 'Send to iPhone',
      description:
        'Wake the paired mobile PWA with a push notification and queue an immediate file download.',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'file',
      group: 'open',
      defaultOrder: 55,
      priority: 55,
      source: 'built-in',
      iconName: 'Smartphone',
      execution: { kind: 'built-in', actionId: 'send-to-mobile-download' },
      tone: 'accent',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.reveal',
      title: 'Reveal in Explorer',
      contexts: [
        'entry',
        'background',
        'multi-select',
        'search-result',
        'preview-pane',
      ],
      appliesTo: 'any',
      group: 'system',
      defaultOrder: 60,
      priority: 60,
      source: 'built-in',
      iconName: 'Eye',
      execution: { kind: 'built-in', actionId: 'reveal' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.properties',
      title: 'Properties',
      contexts: [
        'entry',
        'background',
        'multi-select',
        'search-result',
        'preview-pane',
      ],
      appliesTo: 'any',
      group: 'system',
      defaultOrder: 70,
      priority: 70,
      source: 'built-in',
      iconName: 'Info',
      execution: { kind: 'built-in', actionId: 'properties' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.copy-path',
      title: 'Copy Path',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 80,
      priority: 80,
      source: 'built-in',
      iconName: 'Copy',
      execution: { kind: 'built-in', actionId: 'copy-path' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.new-folder',
      title: 'New Folder',
      contexts: ['background'],
      appliesTo: 'any',
      group: 'create',
      defaultOrder: 90,
      priority: 90,
      source: 'built-in',
      iconName: 'FolderPlus',
      execution: { kind: 'built-in', actionId: 'new-folder' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.new-file',
      title: 'New File...',
      contexts: ['background'],
      appliesTo: 'any',
      group: 'create',
      defaultOrder: 100,
      priority: 100,
      source: 'built-in',
      iconName: 'FilePlus',
      execution: { kind: 'built-in', actionId: 'new-file' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.paste',
      title: 'Paste',
      contexts: ['background'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 110,
      priority: 110,
      source: 'built-in',
      iconName: 'Clipboard',
      execution: { kind: 'built-in', actionId: 'paste' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.copy',
      title: 'Copy',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 120,
      priority: 120,
      source: 'built-in',
      iconName: 'Copy',
      execution: { kind: 'built-in', actionId: 'copy' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.cut',
      title: 'Cut',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 130,
      priority: 130,
      source: 'built-in',
      iconName: 'Scissors',
      execution: { kind: 'built-in', actionId: 'cut' },
      tone: 'warning',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.copy-to',
      title: 'Copy To...',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 135,
      priority: 135,
      source: 'built-in',
      iconName: 'Copy',
      execution: { kind: 'built-in', actionId: 'copy-to' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.move-to',
      title: 'Move To...',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 138,
      priority: 138,
      source: 'built-in',
      iconName: 'Scissors',
      execution: { kind: 'built-in', actionId: 'move-to' },
      tone: 'warning',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.extract-here',
      title: 'Extract Here',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'file',
      group: 'organize',
      defaultOrder: 155,
      priority: 155,
      source: 'built-in',
      iconName: 'FolderPlus',
      execution: { kind: 'built-in', actionId: 'extract-here' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.extract-to',
      title: 'Extract To...',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'file',
      group: 'organize',
      defaultOrder: 156,
      priority: 156,
      source: 'built-in',
      iconName: 'CopyPlus',
      execution: { kind: 'built-in', actionId: 'extract-to' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.extract-new-folder',
      title: 'Extract to New Folder',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'file',
      group: 'organize',
      defaultOrder: 157,
      priority: 157,
      source: 'built-in',
      iconName: 'CopyPlus',
      execution: { kind: 'built-in', actionId: 'extract-new-folder' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.duplicate',
      title: 'Duplicate',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'clipboard',
      defaultOrder: 140,
      priority: 140,
      source: 'built-in',
      iconName: 'CopyPlus',
      execution: { kind: 'built-in', actionId: 'duplicate' },
      tone: 'safe',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.find-similar',
      title: 'Find Similar',
      description:
        'Run semantic similarity search for the selected local text/code file.',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'file',
      group: 'library',
      defaultOrder: 145,
      priority: 145,
      source: 'built-in',
      iconName: 'Sparkles',
      execution: { kind: 'built-in', actionId: 'find-similar' },
      tone: 'accent',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.rename',
      title: 'Rename (F2)',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'organize',
      defaultOrder: 150,
      priority: 150,
      source: 'built-in',
      iconName: 'Edit3',
      execution: { kind: 'built-in', actionId: 'rename' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.add-tags',
      title: 'Add Tags...',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'organize',
      defaultOrder: 160,
      priority: 160,
      source: 'built-in',
      iconName: 'Tags',
      execution: { kind: 'built-in', actionId: 'add-tags' },
      tone: 'accent',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.remove-tags',
      title: 'Remove Tags...',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'organize',
      defaultOrder: 170,
      priority: 170,
      source: 'built-in',
      iconName: 'Tags',
      execution: { kind: 'built-in', actionId: 'remove-tags' },
      tone: 'warning',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
    {
      id: 'built-in.bookmark-toggle',
      title: 'Toggle Bookmark',
      contexts: ['entry', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'library',
      defaultOrder: 180,
      priority: 180,
      source: 'built-in',
      iconName: 'Star',
      execution: { kind: 'built-in', actionId: 'bookmark-toggle' },
      tone: 'accent',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.refresh',
      title: 'Refresh',
      contexts: ['background', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'system',
      defaultOrder: 190,
      priority: 190,
      source: 'built-in',
      iconName: 'RefreshCw',
      execution: { kind: 'built-in', actionId: 'refresh' },
      tone: 'safe',
      supportsQuickSlot: true,
      behavior: 'leaf',
    },
    {
      id: 'built-in.move-trash',
      title: 'Move to Trash',
      contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'],
      appliesTo: 'any',
      group: 'danger',
      defaultOrder: 200,
      priority: 200,
      source: 'built-in',
      iconName: 'Trash2',
      execution: { kind: 'built-in', actionId: 'move-trash' },
      tone: 'danger',
      supportsQuickSlot: false,
      behavior: 'leaf',
    },
  ];

export function resolveExplorerCommandDefinitionById(
  commandId: string,
  pluginCommands: ExplorerResolvedPluginContextMenuContribution[] = [],
  actionCommands: ExplorerResolvedActionContextMenuContribution[] = [],
): ExplorerCommandDefinition | null {
  return (
    BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS.find((item) => item.id === commandId) ??
    pluginCommands.find((item) => item.id === commandId) ??
    actionCommands.find((item) => item.id === commandId) ??
    null
  );
}
