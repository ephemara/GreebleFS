import type { LoadedExplorerAction } from './actionPacks';
import type {
  BuiltInExplorerChromeControlId,
  ExplorerChromeControlId,
  ExplorerChromeSizeVariant,
  ExplorerChromeSurfaceId,
  ExplorerChromeOverrideEntry,
} from './explorerChromeLayouts';
import {
  getSupportedExplorerChromeSurfaces,
  listBuiltInExplorerChromeControlIds,
} from './explorerChromeLayouts';

export type ExplorerCustomizeCatalogCategory =
  | 'navigation'
  | 'search'
  | 'selection'
  | 'creation'
  | 'layout'
  | 'preview'
  | 'workspace'
  | 'rail'
  | 'status'
  | 'tasks'
  | 'authored-actions'
  | 'other';

export interface ExplorerCustomizeCatalogEntry {
  controlId: ExplorerChromeControlId;
  commandId: string;
  label: string;
  description: string;
  category: ExplorerCustomizeCatalogCategory;
  surfaces: ExplorerChromeSurfaceId[];
  source: 'built-in' | 'action' | 'missing-action';
  supportsSizeVariant: boolean;
  supportsLabelVisibility: boolean;
  supportsIconVisibility: boolean;
  sizeVariants: ExplorerChromeSizeVariant[];
  action?: LoadedExplorerAction;
}

const defaultActionChromeSurfaces: ExplorerChromeSurfaceId[] = [
  'explorerTopbar',
  'explorerToolbar',
  'previewHeader',
  'explorerStatusBar',
];

function titleCaseWords(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function toExplorerActionChromeControlId(actionId: string): `action:${string}` {
  return `action:${actionId}` as const;
}

export function isExplorerActionChromeControlId(
  controlId: ExplorerChromeControlId,
): controlId is `action:${string}` {
  return controlId.startsWith('action:');
}

export function getExplorerActionIdFromChromeControlId(
  controlId: ExplorerChromeControlId,
): string | null {
  return isExplorerActionChromeControlId(controlId)
    ? controlId.slice('action:'.length)
    : null;
}

export function getExplorerChromeCommandId(controlId: ExplorerChromeControlId): string {
  return isExplorerActionChromeControlId(controlId)
    ? controlId
    : `explorer-control:${controlId}`;
}

export function humanizeExplorerChromeControlId(controlId: ExplorerChromeControlId): string {
  if (isExplorerActionChromeControlId(controlId)) {
    return titleCaseWords(getExplorerActionIdFromChromeControlId(controlId) ?? controlId);
  }
  if (controlId.startsWith('plugin:')) {
    return titleCaseWords(controlId.slice('plugin:'.length));
  }
  return titleCaseWords(controlId);
}

function categorizeBuiltInExplorerChromeControl(
  controlId: BuiltInExplorerChromeControlId,
): ExplorerCustomizeCatalogCategory {
  if (controlId.startsWith('navigate') || controlId === 'addressBar' || controlId.includes('Location')) {
    return 'navigation';
  }
  if (
    controlId.includes('Search')
    || controlId.includes('search')
    || controlId === 'focusAddressBar'
  ) {
    return 'search';
  }
  if (
    controlId.includes('Selection')
    || controlId === 'tagSelection'
    || controlId === 'selectionModeToggle'
  ) {
    return 'selection';
  }
  if (
    controlId === 'newFolder'
    || controlId === 'newFile'
    || controlId === 'pasteClipboard'
  ) {
    return 'creation';
  }
  if (
    controlId.includes('workspace')
    || controlId.includes('Workspace')
  ) {
    return 'workspace';
  }
  if (controlId.startsWith('rail')) {
    return 'rail';
  }
  if (controlId.startsWith('preview')) {
    return 'preview';
  }
  if (controlId.startsWith('status') || controlId === 'terminalDrawerToggle') {
    return 'status';
  }
  if (
    controlId === 'shellLayout'
    || controlId === 'viewLayout'
    || controlId === 'togglePreview'
    || controlId === 'toggleSources'
    || controlId === 'toggleHiddenFiles'
    || controlId === 'customizeModeToggle'
    || controlId === 'refresh'
    || controlId === 'experimentalModes'
  ) {
    return 'layout';
  }
  if (
    controlId === 'folderSizeSummary'
    || controlId === 'selectionSizeSummary'
    || controlId === 'duplicateScan'
    || controlId === 'undoTrash'
  ) {
    return 'tasks';
  }
  return 'other';
}

const unsupportedBuiltInExplorerCustomizeControlIds = new Set<
  BuiltInExplorerChromeControlId
>([
  'workspaceMode',
  'workspaceCommanderSummary',
  'workspaceLayoutHint',
  'workspaceDuplicateTab',
  'workspaceFocusLeft',
  'workspaceFocusRight',
  'workspaceMoveTab',
  'workspaceSyncPath',
  'workspaceLinkNavigation',
  'workspaceCopyToPane',
  'workspaceMoveToPane',
  'workspaceSwapPane',
  'workspaceCloseTab',
  'workspaceSplitSummary',
  'workspaceSplitNudgeLeft',
  'workspaceSplitReset',
  'workspaceSplitNudgeRight',
]);

function createBuiltInExplorerCustomizeCatalogEntries(): ExplorerCustomizeCatalogEntry[] {
  return listBuiltInExplorerChromeControlIds()
    .filter(
      (controlId) =>
        !unsupportedBuiltInExplorerCustomizeControlIds.has(controlId),
    )
    .map((controlId) => ({
      controlId,
      commandId: getExplorerChromeCommandId(controlId),
      label: humanizeExplorerChromeControlId(controlId),
      description: `${humanizeExplorerChromeControlId(controlId)} control`,
      category: categorizeBuiltInExplorerChromeControl(controlId),
      surfaces: getSupportedExplorerChromeSurfaces(controlId),
      source: 'built-in',
      supportsSizeVariant: false,
      supportsLabelVisibility: false,
      supportsIconVisibility: false,
      sizeVariants: ['regular'],
    }));
}

function createActionExplorerCustomizeCatalogEntry(
  action: LoadedExplorerAction,
): ExplorerCustomizeCatalogEntry {
  const controlId = toExplorerActionChromeControlId(action.id);
  return {
    controlId,
    commandId: getExplorerChromeCommandId(controlId),
    label: action.title,
    description: action.description?.trim() || `${action.packName} action`,
    category: 'authored-actions',
    surfaces: [...defaultActionChromeSurfaces],
    source: 'action',
    supportsSizeVariant: true,
    supportsLabelVisibility: true,
    supportsIconVisibility: true,
    sizeVariants: ['compact', 'regular', 'wide'],
    action,
  };
}

function createMissingActionExplorerCustomizeCatalogEntry(
  entry: ExplorerChromeOverrideEntry,
): ExplorerCustomizeCatalogEntry | null {
  if (!isExplorerActionChromeControlId(entry.controlId)) {
    return null;
  }
  const actionId = getExplorerActionIdFromChromeControlId(entry.controlId);
  return {
    controlId: entry.controlId,
    commandId: getExplorerChromeCommandId(entry.controlId),
    label: `Missing Action: ${titleCaseWords(actionId ?? entry.controlId)}`,
    description: 'The authored action is no longer loaded. Restore the pack or replace this placed control.',
    category: 'authored-actions',
    surfaces: [entry.surfaceId],
    source: 'missing-action',
    supportsSizeVariant: true,
    supportsLabelVisibility: true,
    supportsIconVisibility: true,
    sizeVariants: ['compact', 'regular', 'wide'],
  };
}

export function buildExplorerCustomizeCatalog(input: {
  actions?: LoadedExplorerAction[] | null;
  persistedEntries?: ExplorerChromeOverrideEntry[] | null;
}): ExplorerCustomizeCatalogEntry[] {
  const builtInEntries = createBuiltInExplorerCustomizeCatalogEntries();
  const actionEntries = (input.actions ?? []).map(createActionExplorerCustomizeCatalogEntry);
  const knownControlIds = new Set<ExplorerChromeControlId>([
    ...builtInEntries.map(entry => entry.controlId),
    ...actionEntries.map(entry => entry.controlId),
  ]);
  const missingEntries = (input.persistedEntries ?? [])
    .filter(entry => !knownControlIds.has(entry.controlId))
    .map(createMissingActionExplorerCustomizeCatalogEntry)
    .filter((entry): entry is ExplorerCustomizeCatalogEntry => entry != null);

  return [...builtInEntries, ...actionEntries, ...missingEntries].sort((left, right) => {
    if (left.category !== right.category) {
      return left.category.localeCompare(right.category);
    }
    return left.label.localeCompare(right.label);
  });
}

export function resolveExplorerCustomizeCatalogEntry(
  catalog: ExplorerCustomizeCatalogEntry[],
  controlId: ExplorerChromeControlId | null | undefined,
): ExplorerCustomizeCatalogEntry | null {
  if (!controlId) {
    return null;
  }
  return catalog.find(entry => entry.controlId === controlId) ?? null;
}

export function resolveExplorerChromeCommandLabel(
  commandId: string,
  catalog: ExplorerCustomizeCatalogEntry[],
): string {
  const matchingEntry = catalog.find(entry => entry.commandId === commandId);
  return matchingEntry?.label ?? titleCaseWords(commandId.replace(/^explorer-control:/, ''));
}
