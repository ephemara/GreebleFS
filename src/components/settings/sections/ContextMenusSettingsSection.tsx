import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';

import {
  ArrowDown,
  ArrowUp,
  Clipboard,
  Copy,
  CopyPlus,
  Edit3,
  Eraser,
  ExternalLink,
  Eye,
  FilePlus,
  FolderPlus,
  FolderTree,
  Info,
  Pencil,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Star,
  Tags,
  Terminal,
  Trash2,
  Undo2,
} from '@/components/AppIcons';

import { DraggablePanelList } from '../../DraggablePanelList';
import { OverlayActionButton } from '../../OverlayActionButton';
import type { ResolvedOverlayAppearance } from '../../../config/appearance';
import type { LoadedActionPack, LoadedExplorerAction } from '../../../config/actionPacks';
import {
  EXPLORER_MENU_CONTEXT_KINDS,
  type ExplorerCommandDefinition,
  type ExplorerMenuContextKind,
  type ExplorerMenuContextLayout,
  type ExplorerMenuFallbackBucket,
  type ExplorerMenuLayoutEntry,
  type ExplorerMenuQuickSlot,
} from '../../../config/explorerContextMenu';
import type { LoadedExplorerMenuPack } from '../../../config/menuPacks';
import type { ExplorerRuntimeMenuNode } from '../../explorer/explorerMenuRuntime';
import {
  SettingsActionStrip,
  SettingsSectionBlock,
  SettingsSectionHeader,
  ThemeBadge,
} from '../SettingsPrimitives';

const ROOT_CONTEXT_MENU_PARENT_KEY = '__root_context_menu_parent__';

const explorerMenuQuickSlotOptions: ExplorerMenuQuickSlot[] = [
  'none',
  'primary',
  'secondary',
  'quick-left',
  'quick-right',
];

const explorerMenuFallbackBucketOptions: ExplorerMenuFallbackBucket[] = [
  'default',
  'touch',
  'keyboard',
  'reduced-motion',
  'overflow',
];

const explorerMenuGroupOptions: Array<
  Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group']
> = [
  'create',
  'open',
  'action',
  'system',
  'clipboard',
  'organize',
  'library',
  'plugin',
  'danger',
];

function renderSettingsContextMenuIcon(iconName?: string): ReactNode {
  switch (iconName) {
    case 'Clipboard':
      return <Clipboard size={13} />;
    case 'Copy':
      return <Copy size={13} />;
    case 'CopyPlus':
      return <CopyPlus size={13} />;
    case 'Edit3':
      return <Edit3 size={13} />;
    case 'Eraser':
      return <Eraser size={13} />;
    case 'ExternalLink':
      return <ExternalLink size={13} />;
    case 'Eye':
      return <Eye size={13} />;
    case 'FilePlus':
      return <FilePlus size={13} />;
    case 'FolderPlus':
      return <FolderPlus size={13} />;
    case 'Info':
      return <Info size={13} />;
    case 'Pencil':
      return <Pencil size={13} />;
    case 'RefreshCw':
      return <RefreshCw size={13} />;
    case 'RotateCcw':
      return <RotateCcw size={13} />;
    case 'Save':
      return <Save size={13} />;
    case 'Scissors':
      return <Scissors size={13} />;
    case 'Shield':
      return <Shield size={13} />;
    case 'Sliders':
      return <Sliders size={13} />;
    case 'Sparkles':
      return <Sparkles size={13} />;
    case 'Star':
      return <Star size={13} />;
    case 'Tags':
      return <Tags size={13} />;
    case 'Terminal':
      return <Terminal size={13} />;
    case 'Trash2':
      return <Trash2 size={13} />;
    case 'Undo2':
      return <Undo2 size={13} />;
    default:
      return <Puzzle size={13} />;
  }
}

function resolveContextMenuCommandSourceLabel(
  command: ExplorerCommandDefinition,
): string {
  if (command.source === 'action') {
    return `Action · ${command.packName}`;
  }
  if (command.source === 'plugin') {
    return `Plugin · ${command.pluginName}`;
  }
  if (command.source === 'preview') {
    return 'Preview Lane';
  }
  return 'Built-In';
}

function getContextMenuPreviewPathKey(path: string[]): string {
  return path.length > 0 ? path.join('/') : 'root';
}

function resolveContextMenuPreviewPanels(
  rootNodes: ExplorerRuntimeMenuNode[],
  openSubmenuPath: string[],
): {
  panels: ExplorerRuntimeMenuNode[][];
  resolvedPath: string[];
} {
  const panels: ExplorerRuntimeMenuNode[][] = [rootNodes];
  const resolvedPath: string[] = [];
  let currentNodes = rootNodes;

  for (const submenuId of openSubmenuPath) {
    const submenuNode = currentNodes.find(
      (node): node is Extract<ExplorerRuntimeMenuNode, { kind: 'submenu' }> =>
        node.kind === 'submenu' && node.id === submenuId,
    );
    if (!submenuNode) {
      break;
    }
    panels.push(submenuNode.children);
    resolvedPath.push(submenuId);
    currentNodes = submenuNode.children;
  }

  return { panels, resolvedPath };
}

function ExplorerContextMenuPreviewPanels({
  nodes,
  density,
  showDescriptions,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: ExplorerRuntimeMenuNode[];
  density: 'compact' | 'balanced' | 'touch';
  showDescriptions: boolean;
  selectedNodeId: string | null;
  onSelectNode?: (node: ExplorerRuntimeMenuNode) => void;
}) {
  const [openSubmenuPath, setOpenSubmenuPath] = useState<string[]>([]);
  const panelState = useMemo(
    () => resolveContextMenuPreviewPanels(nodes, openSubmenuPath),
    [nodes, openSubmenuPath],
  );

  useEffect(() => {
    setOpenSubmenuPath([]);
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div
        className="rounded border px-4 py-6 text-[11px] opacity-50"
        style={{
          borderColor: 'var(--overlay-workbench-settings-card-border)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        This context currently resolves to an empty menu.
      </div>
    );
  }

  const panelWidth = density === 'touch' ? 280 : density === 'compact' ? 228 : 248;

  return (
    <div className="flex min-h-0 gap-3 overflow-x-auto pb-1">
      {panelState.panels.map((panelNodes, panelIndex) => {
        const panelPath = panelState.resolvedPath.slice(0, panelIndex);
        const panelKey = getContextMenuPreviewPathKey(panelPath);

        return (
          <div
            key={panelKey}
            className="shrink-0 rounded border py-1"
            style={{
              width: panelWidth,
              minHeight: 220,
              borderColor: 'var(--overlay-explorer-preview-border)',
              background: 'var(--overlay-explorer-preview-bg)',
              boxShadow: 'var(--overlay-explorer-ctx-menu-shadow)',
              backdropFilter: 'blur(14px)',
            }}
          >
            {panelNodes.map((node) => {
              if (node.kind === 'separator') {
                return (
                  <div
                    key={node.id}
                    style={{
                      height: 1,
                      margin: '4px 0',
                      background: 'var(--overlay-explorer-preview-border)',
                    }}
                  />
                );
              }

              const isSubmenuOpen = panelState.resolvedPath[panelIndex] === node.id;
              const isSelected = selectedNodeId === node.id;
              const panelPrefix = panelState.resolvedPath.slice(0, panelIndex);

              return (
                <button
                  key={node.id}
                  type="button"
                  onMouseEnter={() => {
                    if (node.kind === 'submenu') {
                      setOpenSubmenuPath([...panelPrefix, node.id]);
                    } else {
                      setOpenSubmenuPath(panelPrefix);
                    }
                  }}
                  onClick={() => {
                    if (node.kind === 'submenu') {
                      setOpenSubmenuPath([...panelPrefix, node.id]);
                    }
                    onSelectNode?.(node);
                  }}
                  className="w-full border-0 text-left"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '16px minmax(0, 1fr) auto',
                    alignItems: 'center',
                    gap: density === 'touch' ? 12 : 10,
                    padding:
                      density === 'compact'
                        ? '6px 10px'
                        : density === 'touch'
                          ? '10px 14px'
                          : '7px 12px',
                    background:
                      isSubmenuOpen || isSelected
                        ? 'var(--overlay-explorer-chip-active-bg)'
                        : 'transparent',
                    color:
                      node.tone === 'danger'
                        ? 'var(--overlay-explorer-danger-text)'
                        : 'var(--overlay-text-primary)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', opacity: 0.78 }}>
                    {renderSettingsContextMenuIcon(node.iconName)}
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span>{node.label}</span>
                    {showDescriptions && node.kind === 'command' && node.description ? (
                      <span
                        style={{
                          color: 'var(--overlay-text-muted)',
                          fontSize: 10,
                          lineHeight: 1.2,
                        }}
                      >
                        {node.description}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--overlay-text-muted)',
                      fontSize: 10,
                    }}
                  >
                    {node.kind === 'command' && node.shortcutId ? (
                      <span>{node.shortcutId}</span>
                    ) : null}
                    {node.kind === 'submenu' ? (
                      <span style={{ opacity: isSubmenuOpen ? 1 : 0.72 }}>▶</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function collectContextMenuDescendantIds(
  entries: ExplorerMenuLayoutEntry[],
  rootEntryId: string,
): Set<string> {
  const descendantIds = new Set<string>();
  const queue = [rootEntryId];

  while (queue.length > 0) {
    const currentEntryId = queue.shift();
    if (!currentEntryId) {
      continue;
    }
    for (const entry of entries) {
      if (entry.parentEntryId !== currentEntryId || descendantIds.has(entry.id)) {
        continue;
      }
      descendantIds.add(entry.id);
      queue.push(entry.id);
    }
  }

  return descendantIds;
}

function resolveContextMenuEntryTitle(
  entry: ExplorerMenuLayoutEntry,
  commandLookup: Map<string, ExplorerCommandDefinition>,
): string {
  if (entry.kind === 'command') {
    return commandLookup.get(entry.commandId)?.title ?? entry.commandId;
  }
  if (entry.kind === 'submenu') {
    return entry.title;
  }
  if (entry.kind === 'group-slot') {
    return `Group Slot · ${entry.group}`;
  }
  return 'Separator';
}

function resolveContextMenuEntrySupportingCopy(args: {
  entry: ExplorerMenuLayoutEntry;
  commandLookup: Map<string, ExplorerCommandDefinition>;
  childCount: number;
}): string {
  const { entry, commandLookup, childCount } = args;
  if (entry.kind === 'command') {
    const resolvedCommand = commandLookup.get(entry.commandId);
    return resolvedCommand?.description ?? resolvedCommand?.id ?? entry.commandId;
  }
  if (entry.kind === 'submenu') {
    return childCount > 0
      ? `${childCount} node${childCount === 1 ? '' : 's'} nested inside this folder.`
      : 'Drop nodes here or add into this folder from the library.';
  }
  if (entry.kind === 'group-slot') {
    return `Injects ${entry.sourceFilter ?? 'any'} ${entry.group} commands into this branch at runtime.`;
  }
  return 'A lightweight divider between neighboring commands.';
}

function resolveContextMenuInsertionLabel(args: {
  selectedEntry: ExplorerMenuLayoutEntry | null;
  commandLookup: Map<string, ExplorerCommandDefinition>;
}): string {
  const { selectedEntry, commandLookup } = args;
  if (!selectedEntry) {
    return 'at the root of this menu';
  }
  if (selectedEntry.kind === 'submenu') {
    return `into “${selectedEntry.title}”`;
  }
  return `after “${resolveContextMenuEntryTitle(selectedEntry, commandLookup)}”`;
}

interface ContextMenuEditorPanelDescriptor {
  key: string;
  title: string;
  parentEntryId: string | null;
  path: string[];
  entries: ExplorerMenuLayoutEntry[];
  listLabel: string;
}

type ContextMenuLibraryItem =
  | {
      id: string;
      kind: 'command';
      label: string;
      description: string;
      section: 'actions' | 'commands' | 'extensions';
      sourceLabel: string;
      command: ExplorerCommandDefinition;
    }
  | {
      id: 'structure:submenu' | 'structure:separator' | 'structure:group-slot';
      kind: 'structure-submenu' | 'structure-separator' | 'structure-group-slot';
      label: string;
      description: string;
      section: 'structure';
      sourceLabel: string;
    };

interface ContextMenuLibraryDragState {
  pointerId: number;
  item: ContextMenuLibraryItem;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
  targetListLabel: string | null;
  targetIndex: number | null;
}

const CONTEXT_MENU_LIBRARY_DRAG_THRESHOLD_PX = 6;

function areContextMenuPathsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((segment, index) => segment === right[index]);
}

function resolveContextMenuEntryAncestorSubmenuPath(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string | null,
): string[] {
  if (!entryId) {
    return [];
  }

  const entriesById = new Map(entries.map((entry) => [entry.id, entry] as const));
  const path: string[] = [];
  let cursor = entriesById.get(entryId) ?? null;

  while (cursor) {
    if (cursor.kind === 'submenu') {
      path.unshift(cursor.id);
    }
    cursor = cursor.parentEntryId ? entriesById.get(cursor.parentEntryId) ?? null : null;
  }

  return path;
}

function resolveContextMenuEditorPanels(args: {
  getBranchEntries: (parentEntryId: string | null) => ExplorerMenuLayoutEntry[];
  openSubmenuPath: string[];
}): { panels: ContextMenuEditorPanelDescriptor[]; resolvedPath: string[] } {
  const { getBranchEntries, openSubmenuPath } = args;
  const rootEntries = getBranchEntries(null);
  const panels: ContextMenuEditorPanelDescriptor[] = [
    {
      key: 'root',
      title: 'Root',
      parentEntryId: null,
      path: [],
      entries: rootEntries,
      listLabel: 'context-menu-editor-root',
    },
  ];
  const resolvedPath: string[] = [];
  let currentEntries = rootEntries;
  let currentPath: string[] = [];

  for (const submenuId of openSubmenuPath) {
    const submenuEntry = currentEntries.find(
      (entry): entry is Extract<ExplorerMenuLayoutEntry, { kind: 'submenu' }> =>
        entry.kind === 'submenu' && entry.id === submenuId,
    );
    if (!submenuEntry) {
      break;
    }

    currentPath = [...currentPath, submenuEntry.id];
    resolvedPath.push(submenuEntry.id);
    currentEntries = getBranchEntries(submenuEntry.id);
    panels.push({
      key: getContextMenuPreviewPathKey(currentPath),
      title: submenuEntry.title,
      parentEntryId: submenuEntry.id,
      path: currentPath,
      entries: currentEntries,
      listLabel: `context-menu-editor-${getContextMenuPreviewPathKey(currentPath)}`,
    });
  }

  return { panels, resolvedPath };
}

export function ContextMenusSettingsSection({
  detail,
  appearance,
  border,
  accent,
  text,
  muted,
  settingsSelectStyle,
  settingsFieldStyle,
  activeMenuPack,
  menuPacks,
  customizedContextCount,
  menuPacksWarnings,
  actionsWarnings,
  activeContextMenuContext,
  setActiveContextMenuComposerContext,
  onRefreshMenuPacks,
  onRefreshActions,
  onOpenMenuPacksFolder,
  onOpenActionsFolder,
  resetContextMenuLayout,
  resetAllContextMenuLayouts,
  setActiveMenuPackId,
  activeContextMenuLayout,
  setContextMenuRendererForActiveContext,
  menuPacksLoading,
  menuPacksDirectory,
  menuPacksError,
  actionsLoading,
  actions,
  actionPacks,
  actionsDirectory,
  actionsError,
  contextMenuCommandDraftByContext,
  setContextMenuCommandDraftByContext,
  availableContextMenuCommandsForActiveContext,
  addContextMenuCommandEntry,
  insertContextMenuCommandEntryAt,
  contextMenuGroupDraftByContext,
  setContextMenuGroupDraftByContext,
  addContextMenuGroupSlot,
  insertContextMenuGroupSlotAt,
  addContextMenuSubmenu,
  insertContextMenuSubmenuAt,
  addContextMenuSeparator,
  insertContextMenuSeparatorAt,
  filteredContextMenuBrowserCommands,
  contextMenuCommandBrowserQuery,
  setContextMenuCommandBrowserQuery,
  contextMenuPreviewMenu,
  selectedContextMenuPreviewNodeId,
  selectContextMenuEntryFromRuntimeNode,
  activeContextMenuEntries,
  selectedContextMenuEntryId,
  setSelectedContextMenuEntryId,
  draggedContextMenuEntryId,
  setDraggedContextMenuEntryId,
  contextMenuCommandLookup,
  selectedContextMenuEntry,
  selectedContextMenuCommand,
  activeContextMenuSubmenus,
  selectedContextMenuSiblingIndex,
  selectedContextMenuSiblingEntriesCount,
  toggleContextMenuLayoutEntryEnabled,
  setContextMenuSubmenuTitle,
  setContextMenuGroupSlotGroup,
  setContextMenuGroupSlotSourceFilter,
  setContextMenuLayoutEntryParent,
  setContextMenuLayoutEntryQuickSlot,
  setContextMenuLayoutEntryFallbackBucket,
  moveContextMenuLayoutEntry,
  removeContextMenuLayoutEntry,
  placeContextMenuLayoutEntryAt,
  legacyPluginMenuItemCount,
  legacyPluginActionCount,
  authoredPluginActionCount,
}: {
  detail: string;
  appearance: ResolvedOverlayAppearance;
  border: string;
  accent: string;
  text: string;
  muted: string;
  settingsSelectStyle: CSSProperties;
  settingsFieldStyle: CSSProperties;
  activeMenuPack: LoadedExplorerMenuPack | null;
  menuPacks: LoadedExplorerMenuPack[];
  customizedContextCount: number;
  menuPacksWarnings: string[];
  actionsWarnings: string[];
  activeContextMenuContext: ExplorerMenuContextKind;
  setActiveContextMenuComposerContext: (context: ExplorerMenuContextKind) => void;
  onRefreshMenuPacks: () => Promise<void> | void;
  onRefreshActions: () => Promise<void> | void;
  onOpenMenuPacksFolder: () => Promise<void> | void;
  onOpenActionsFolder: () => Promise<void> | void;
  resetContextMenuLayout: () => void;
  resetAllContextMenuLayouts: () => void;
  setActiveMenuPackId: (packId: string) => void;
  activeContextMenuLayout: ExplorerMenuContextLayout;
  setContextMenuRendererForActiveContext: (renderer: ExplorerMenuContextLayout['renderer']) => void;
  menuPacksLoading: boolean;
  menuPacksDirectory: string;
  menuPacksError: string | null;
  actionsLoading: boolean;
  actions: LoadedExplorerAction[];
  actionPacks: LoadedActionPack[];
  actionsDirectory: string;
  actionsError: string | null;
  contextMenuCommandDraftByContext: Partial<Record<ExplorerMenuContextKind, string>>;
  setContextMenuCommandDraftByContext: Dispatch<SetStateAction<Partial<Record<ExplorerMenuContextKind, string>>>>;
  availableContextMenuCommandsForActiveContext: ExplorerCommandDefinition[];
  addContextMenuCommandEntry: (commandId?: string) => void;
  insertContextMenuCommandEntryAt: (
    commandId: string,
    target: { parentEntryId: string | null; insertionIndex: number },
  ) => void;
  contextMenuGroupDraftByContext: Partial<Record<ExplorerMenuContextKind, Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group']>>;
  setContextMenuGroupDraftByContext: Dispatch<SetStateAction<Partial<Record<ExplorerMenuContextKind, Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group']>>>>;
  addContextMenuGroupSlot: () => void;
  insertContextMenuGroupSlotAt: (
    target: { parentEntryId: string | null; insertionIndex: number },
    requestedGroup?: Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group'],
  ) => void;
  addContextMenuSubmenu: () => void;
  insertContextMenuSubmenuAt: (
    target: { parentEntryId: string | null; insertionIndex: number },
  ) => void;
  addContextMenuSeparator: () => void;
  insertContextMenuSeparatorAt: (
    target: { parentEntryId: string | null; insertionIndex: number },
  ) => void;
  filteredContextMenuBrowserCommands: ExplorerCommandDefinition[];
  contextMenuCommandBrowserQuery: string;
  setContextMenuCommandBrowserQuery: (value: string) => void;
  contextMenuPreviewMenu: {
    nodes: ExplorerRuntimeMenuNode[];
    presentation: {
      renderer: string;
      density: 'compact' | 'balanced' | 'touch';
      showDescriptions: boolean;
    };
  };
  selectedContextMenuPreviewNodeId: string | null;
  selectContextMenuEntryFromRuntimeNode: (node: ExplorerRuntimeMenuNode) => void;
  activeContextMenuEntries: ExplorerMenuLayoutEntry[];
  selectedContextMenuEntryId: string | null;
  setSelectedContextMenuEntryId: (entryId: string | null) => void;
  draggedContextMenuEntryId: string | null;
  setDraggedContextMenuEntryId: (entryId: string | null) => void;
  contextMenuCommandLookup: Map<string, ExplorerCommandDefinition>;
  selectedContextMenuEntry: ExplorerMenuLayoutEntry | null;
  selectedContextMenuCommand: ExplorerCommandDefinition | null;
  activeContextMenuSubmenus: Array<Extract<ExplorerMenuLayoutEntry, { kind: 'submenu' }>>;
  selectedContextMenuSiblingIndex: number;
  selectedContextMenuSiblingEntriesCount: number;
  toggleContextMenuLayoutEntryEnabled: (entryId: string, enabled: boolean) => void;
  setContextMenuSubmenuTitle: (entryId: string, title: string) => void;
  setContextMenuGroupSlotGroup: (
    entryId: string,
    group: Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group'],
  ) => void;
  setContextMenuGroupSlotSourceFilter: (
    entryId: string,
    sourceFilter: Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['sourceFilter'],
  ) => void;
  setContextMenuLayoutEntryParent: (entryId: string, parentEntryId: string | null) => void;
  setContextMenuLayoutEntryQuickSlot: (entryId: string, quickSlot: ExplorerMenuQuickSlot) => void;
  setContextMenuLayoutEntryFallbackBucket: (entryId: string, fallbackBucket: ExplorerMenuFallbackBucket) => void;
  moveContextMenuLayoutEntry: (entryId: string, direction: 'up' | 'down') => void;
  removeContextMenuLayoutEntry: (entryId: string) => void;
  placeContextMenuLayoutEntryAt: (
    entryId: string,
    parentEntryId: string | null,
    index: number,
  ) => void;
  legacyPluginMenuItemCount: number;
  legacyPluginActionCount: number;
  authoredPluginActionCount: number;
}) {
  const [canvasMode, setCanvasMode] = useState<'edit' | 'preview'>('edit');
  const [openEditorSubmenuPath, setOpenEditorSubmenuPath] = useState<string[]>([]);
  const [libraryDragState, setLibraryDragState] =
    useState<ContextMenuLibraryDragState | null>(null);

  useEffect(() => {
    setCanvasMode('edit');
    setOpenEditorSubmenuPath([]);
    setLibraryDragState(null);
  }, [activeContextMenuContext]);

  const panelSurfaceStyle = {
    borderColor: border,
    background: 'rgba(255,255,255,0.03)',
  } as const;
  const insetSurfaceStyle = {
    borderColor: `${border}aa`,
    background: 'rgba(255,255,255,0.022)',
  } as const;

  const branchEntriesByParentId = useMemo(() => {
    const map = new Map<string, ExplorerMenuLayoutEntry[]>();
    for (const entry of activeContextMenuEntries) {
      const parentKey = entry.parentEntryId ?? ROOT_CONTEXT_MENU_PARENT_KEY;
      const existingBranch = map.get(parentKey);
      if (existingBranch) {
        existingBranch.push(entry);
      } else {
        map.set(parentKey, [entry]);
      }
    }
    return map;
  }, [activeContextMenuEntries]);

  const selectedContextMenuDescendantIds = useMemo(
    () => (
      selectedContextMenuEntry
        ? collectContextMenuDescendantIds(activeContextMenuEntries, selectedContextMenuEntry.id)
        : new Set<string>()
    ),
    [activeContextMenuEntries, selectedContextMenuEntry],
  );

  const availableParentSubmenus = useMemo(
    () => activeContextMenuSubmenus.filter(submenu =>
      submenu.id !== selectedContextMenuEntry?.id
      && !selectedContextMenuDescendantIds.has(submenu.id),
    ),
    [activeContextMenuSubmenus, selectedContextMenuDescendantIds, selectedContextMenuEntry],
  );

  const insertionTargetLabel = useMemo(
    () => resolveContextMenuInsertionLabel({
      selectedEntry: selectedContextMenuEntry,
      commandLookup: contextMenuCommandLookup,
    }),
    [contextMenuCommandLookup, selectedContextMenuEntry],
  );

  const getBranchEntries = (parentEntryId: string | null): ExplorerMenuLayoutEntry[] =>
    branchEntriesByParentId.get(parentEntryId ?? ROOT_CONTEXT_MENU_PARENT_KEY) ?? [];
  const selectedEntryOpenPath = useMemo(
    () =>
      resolveContextMenuEntryAncestorSubmenuPath(
        activeContextMenuEntries,
        selectedContextMenuEntryId,
      ),
    [activeContextMenuEntries, selectedContextMenuEntryId],
  );
  const editorPanelState = useMemo(
    () =>
      resolveContextMenuEditorPanels({
        getBranchEntries,
        openSubmenuPath: openEditorSubmenuPath,
      }),
    [branchEntriesByParentId, openEditorSubmenuPath],
  );
  const editorPanelByListLabel = useMemo(
    () =>
      new Map(
        editorPanelState.panels.map((panel) => [panel.listLabel, panel] as const),
      ),
    [editorPanelState.panels],
  );
  const contextMenuEditorBreadcrumbs = useMemo(
    () =>
      editorPanelState.panels.map((panel, index) => ({
        key: panel.key,
        label: index === 0 ? 'Root' : panel.title,
        path: panel.path,
        selectedEntryId: panel.parentEntryId,
      })),
    [editorPanelState.panels],
  );
  const contextMenuEditorPanelWidth =
    contextMenuPreviewMenu.presentation.density === 'touch'
      ? 292
      : contextMenuPreviewMenu.presentation.density === 'compact'
        ? 236
        : 256;

  useEffect(() => {
    setOpenEditorSubmenuPath((currentPath) =>
      areContextMenuPathsEqual(currentPath, selectedEntryOpenPath)
        ? currentPath
        : selectedEntryOpenPath,
    );
  }, [selectedEntryOpenPath]);

  useEffect(() => {
    if (
      areContextMenuPathsEqual(
        openEditorSubmenuPath,
        editorPanelState.resolvedPath,
      )
    ) {
      return;
    }
    setOpenEditorSubmenuPath(editorPanelState.resolvedPath);
  }, [editorPanelState.resolvedPath, openEditorSubmenuPath]);

  const contextMenuLibraryItems = useMemo(() => {
    const normalizedQuery = contextMenuCommandBrowserQuery.trim().toLowerCase();
    const structureItems: ContextMenuLibraryItem[] = [
      {
        id: 'structure:submenu',
        kind: 'structure-submenu',
        label: 'Folder',
        description:
          'Create a submenu branch you can open and author like the real menu.',
        section: 'structure',
        sourceLabel: 'Structure',
      },
      {
        id: 'structure:separator',
        kind: 'structure-separator',
        label: 'Separator',
        description: 'Drop in a lightweight divider between neighboring commands.',
        section: 'structure',
        sourceLabel: 'Structure',
      },
      {
        id: 'structure:group-slot',
        kind: 'structure-group-slot',
        label: 'Group Slot',
        description:
          'Inject a runtime bucket of commands without hand-placing every item.',
        section: 'structure',
        sourceLabel: 'Structure',
      },
    ];
    const commandItems: ContextMenuLibraryItem[] =
      filteredContextMenuBrowserCommands.map((command) => ({
        id: command.id,
        kind: 'command',
        label: command.title,
        description: command.description ?? command.id,
        section:
          command.source === 'action'
            ? 'actions'
            : command.source === 'built-in'
              ? 'commands'
              : 'extensions',
        sourceLabel: resolveContextMenuCommandSourceLabel(command),
        command,
      }));
    const unfilteredItems = [...structureItems, ...commandItems];

    if (!normalizedQuery) {
      return unfilteredItems;
    }

    return unfilteredItems.filter((item) =>
      [
        item.label,
        item.description,
        item.sourceLabel,
        item.kind === 'command' ? item.command.id : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [contextMenuCommandBrowserQuery, filteredContextMenuBrowserCommands]);

  const contextMenuLibrarySections = useMemo(
    () =>
      [
        {
          key: 'structure',
          label: 'Structure',
          items: contextMenuLibraryItems.filter((item) => item.section === 'structure'),
        },
        {
          key: 'actions',
          label: 'Actions',
          items: contextMenuLibraryItems.filter((item) => item.section === 'actions'),
        },
        {
          key: 'commands',
          label: 'Built-In',
          items: contextMenuLibraryItems.filter((item) => item.section === 'commands'),
        },
        {
          key: 'extensions',
          label: 'Extensions',
          items: contextMenuLibraryItems.filter(
            (item) => item.section === 'extensions',
          ),
        },
      ].filter((section) => section.items.length > 0),
    [contextMenuLibraryItems],
  );

  const beginContextMenuLibraryDrag = (
    item: ContextMenuLibraryItem,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setLibraryDragState({
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      active: false,
      targetListLabel: null,
      targetIndex: null,
    });
  };

  const runContextMenuLibraryQuickAdd = (item: ContextMenuLibraryItem) => {
    if (item.kind === 'command') {
      addContextMenuCommandEntry(item.command.id);
      return;
    }
    if (item.kind === 'structure-submenu') {
      addContextMenuSubmenu();
      return;
    }
    if (item.kind === 'structure-separator') {
      addContextMenuSeparator();
      return;
    }
    addContextMenuGroupSlot();
  };

  const insertContextMenuLibraryItemAt = (
    item: ContextMenuLibraryItem,
    target: { parentEntryId: string | null; insertionIndex: number },
  ) => {
    if (item.kind === 'command') {
      insertContextMenuCommandEntryAt(item.command.id, target);
      return;
    }
    if (item.kind === 'structure-submenu') {
      insertContextMenuSubmenuAt(target);
      return;
    }
    if (item.kind === 'structure-separator') {
      insertContextMenuSeparatorAt(target);
      return;
    }
    insertContextMenuGroupSlotAt(target);
  };

  useEffect(() => {
    if (!libraryDragState) {
      return undefined;
    }

    const resolveLibraryDropTarget = (x: number, y: number) => {
      if (typeof document === 'undefined') {
        return { targetListLabel: null, targetIndex: null };
      }
      const hoveredElement = document.elementFromPoint(x, y);
      if (!(hoveredElement instanceof Element)) {
        return { targetListLabel: null, targetIndex: null };
      }

      const explicitDropZone = hoveredElement.closest<HTMLElement>(
        '[data-draggable-panel-drop-zone-index]',
      );
      if (explicitDropZone) {
        const listRoot = explicitDropZone.closest<HTMLElement>(
          '[data-draggable-panel-list]',
        );
        const targetListLabel = listRoot?.dataset.draggablePanelList ?? null;
        const parsedIndex = Number.parseInt(
          explicitDropZone.dataset.draggablePanelDropZoneIndex ?? '',
          10,
        );
        return {
          targetListLabel,
          targetIndex:
            targetListLabel && Number.isFinite(parsedIndex) ? parsedIndex : null,
        };
      }

      const emptySurface = hoveredElement.closest<HTMLElement>(
        '[data-draggable-panel-empty]',
      );
      if (emptySurface) {
        const listRoot = emptySurface.closest<HTMLElement>(
          '[data-draggable-panel-list]',
        );
        return {
          targetListLabel: listRoot?.dataset.draggablePanelList ?? null,
          targetIndex: 0,
        };
      }

      return { targetListLabel: null, targetIndex: null };
    };

    const completeLibraryDrag = (
      shouldDrop: boolean,
      pointerId?: number,
    ) => {
      setLibraryDragState((currentState) => {
        if (!currentState) {
          return currentState;
        }
        if (
          pointerId != null &&
          currentState.pointerId !== pointerId
        ) {
          return currentState;
        }

        if (
          shouldDrop &&
          currentState.active &&
          currentState.targetListLabel &&
          currentState.targetIndex != null
        ) {
          const targetPanel = editorPanelByListLabel.get(
            currentState.targetListLabel,
          );
          if (targetPanel) {
            insertContextMenuLibraryItemAt(currentState.item, {
              parentEntryId: targetPanel.parentEntryId,
              insertionIndex: currentState.targetIndex,
            });
          }
        }

        return null;
      });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== libraryDragState.pointerId) {
        return;
      }
      const distance = Math.hypot(
        event.clientX - libraryDragState.startX,
        event.clientY - libraryDragState.startY,
      );
      const active =
        libraryDragState.active ||
        distance >= CONTEXT_MENU_LIBRARY_DRAG_THRESHOLD_PX;
      const nextTarget = active
        ? resolveLibraryDropTarget(event.clientX, event.clientY)
        : { targetListLabel: null, targetIndex: null };

      setLibraryDragState((currentState) =>
        currentState && currentState.pointerId === event.pointerId
          ? {
              ...currentState,
              currentX: event.clientX,
              currentY: event.clientY,
              active,
              targetListLabel: nextTarget.targetListLabel,
              targetIndex: nextTarget.targetIndex,
            }
          : currentState,
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      completeLibraryDrag(true, event.pointerId);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      completeLibraryDrag(false, event.pointerId);
    };

    const handleWindowBlur = () => {
      completeLibraryDrag(false);
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        completeLibraryDrag(false);
      }
    };

    const previousBodyUserSelect = document.body.style.userSelect;
    const previousBodyCursor = document.body.style.cursor;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      document.body.style.userSelect = previousBodyUserSelect;
      document.body.style.cursor = previousBodyCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [
    editorPanelByListLabel,
    insertContextMenuCommandEntryAt,
    insertContextMenuGroupSlotAt,
    insertContextMenuSeparatorAt,
    insertContextMenuSubmenuAt,
    libraryDragState,
  ]);

  const renderInlineContextMenuEditor = (entry: ExplorerMenuLayoutEntry) => {
    const inlineSelectedCommand =
      entry.kind === 'command'
        ? selectedContextMenuCommand ??
          contextMenuCommandLookup.get(entry.commandId) ??
          null
        : null;

    return (
      <div
        className="mt-2 rounded-[14px] border px-3 py-3"
        style={{
          borderColor: `${accent}44`,
          background: 'rgba(255,255,255,0.035)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold">
            {resolveContextMenuEntryTitle(entry, contextMenuCommandLookup)}
          </div>
          <div className="mt-1 text-[10px] leading-4 opacity-45">
            {resolveContextMenuEntrySupportingCopy({
              entry,
              commandLookup: contextMenuCommandLookup,
              childCount:
                entry.kind === 'submenu' ? getBranchEntries(entry.id).length : 0,
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {inlineSelectedCommand ? (
            <ThemeBadge
              label={resolveContextMenuCommandSourceLabel(inlineSelectedCommand)}
            />
          ) : null}
          <ThemeBadge label={`Order ${entry.order}`} />
          {entry.quickSlot && entry.quickSlot !== 'none' ? (
            <ThemeBadge label={entry.quickSlot} />
          ) : null}
        </div>
        </div>

      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <label
          className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}
        >
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={entry.enabled !== false}
            onChange={(event) =>
              toggleContextMenuLayoutEntryEnabled(entry.id, event.target.checked)
            }
          />
        </label>

        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
          <span>Place Inside</span>
          <select
            value={entry.parentEntryId ?? ''}
            onChange={(event) =>
              setContextMenuLayoutEntryParent(entry.id, event.target.value || null)
            }
            className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
            style={settingsSelectStyle}
          >
            <option value="">Root</option>
            {availableParentSubmenus.map((submenu) => (
              <option key={submenu.id} value={submenu.id}>
                {submenu.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
          <span>Quick Slot</span>
          <select
            value={entry.quickSlot ?? 'none'}
            onChange={(event) =>
              setContextMenuLayoutEntryQuickSlot(
                entry.id,
                event.target.value as ExplorerMenuQuickSlot,
              )
            }
            className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
            style={settingsSelectStyle}
          >
            {explorerMenuQuickSlotOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
          <span>Fallback Bucket</span>
          <select
            value={entry.fallbackBucket ?? 'default'}
            onChange={(event) =>
              setContextMenuLayoutEntryFallbackBucket(
                entry.id,
                event.target.value as ExplorerMenuFallbackBucket,
              )
            }
            className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
            style={settingsSelectStyle}
          >
            {explorerMenuFallbackBucketOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {entry.kind === 'submenu' ? (
          <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70 lg:col-span-2">
            <span>Folder Name</span>
            <input
              value={entry.title}
              onChange={(event) =>
                setContextMenuSubmenuTitle(entry.id, event.target.value)
              }
              className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
              style={settingsFieldStyle}
            />
          </label>
        ) : null}

        {entry.kind === 'group-slot' ? (
          <>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              <span>Group</span>
              <select
                value={entry.group}
                onChange={(event) =>
                  setContextMenuGroupSlotGroup(
                    entry.id,
                    event.target.value as Extract<
                      ExplorerMenuLayoutEntry,
                      { kind: 'group-slot' }
                    >['group'],
                  )
                }
                className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                style={settingsSelectStyle}
              >
                {explorerMenuGroupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
              <span>Source Filter</span>
              <select
                value={entry.sourceFilter ?? 'any'}
                onChange={(event) =>
                  setContextMenuGroupSlotSourceFilter(
                    entry.id,
                    event.target.value as Extract<
                      ExplorerMenuLayoutEntry,
                      { kind: 'group-slot' }
                    >['sourceFilter'],
                  )
                }
                className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                style={settingsSelectStyle}
              >
                {['any', 'built-in', 'plugin', 'preview', 'action'].map(
                  (sourceFilter) => (
                    <option key={sourceFilter} value={sourceFilter}>
                      {sourceFilter}
                    </option>
                  ),
                )}
              </select>
            </label>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OverlayActionButton
          appearance={appearance}
          size="compact"
          tone="quiet"
          onClick={() => moveContextMenuLayoutEntry(entry.id, 'up')}
          disabled={selectedContextMenuSiblingIndex <= 0}
          className="gap-1"
        >
          <ArrowUp size={11} />
          Nudge Up
        </OverlayActionButton>
        <OverlayActionButton
          appearance={appearance}
          size="compact"
          tone="quiet"
          onClick={() => moveContextMenuLayoutEntry(entry.id, 'down')}
          disabled={
            selectedContextMenuSiblingIndex < 0 ||
            selectedContextMenuSiblingIndex >=
              selectedContextMenuSiblingEntriesCount - 1
          }
          className="gap-1"
        >
          <ArrowDown size={11} />
          Nudge Down
        </OverlayActionButton>
        <OverlayActionButton
          appearance={appearance}
          size="compact"
          tone="danger"
          onClick={() => removeContextMenuLayoutEntry(entry.id)}
          className="gap-1"
        >
          Remove
        </OverlayActionButton>
      </div>
      </div>
    );
  };

  return (
    <section className="space-y-4" data-settings-section="context-menus">
      <SettingsSectionHeader
        icon={<Puzzle size={12} />}
        title="Context Menus"
        subtitle={detail}
      />

      <SettingsSectionBlock
        title="Context Menu Composer"
        subtitle="Author the explorer menu by editing the menu itself. Open folders into sidecar panels, drag library items straight into place, and keep row-level tweaks inline instead of bouncing between inspector panes."
        tone="muted"
        badges={[
          activeMenuPack?.name ?? 'No Pack',
          `${menuPacks.length} pack${menuPacks.length === 1 ? '' : 's'}`,
          `${customizedContextCount} customized context${customizedContextCount === 1 ? '' : 's'}`,
        ]}
        actions={(
          <SettingsActionStrip>
            <OverlayActionButton
              appearance={appearance}
              size="compact"
              tone="quiet"
              onClick={() => void onRefreshMenuPacks()}
            >
              Refresh Packs
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              size="compact"
              tone="quiet"
              onClick={() => void onRefreshActions()}
            >
              Refresh Actions
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              size="compact"
              tone="neutral"
              onClick={() => void onOpenMenuPacksFolder()}
            >
              Packs Folder
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              size="compact"
              tone="neutral"
              onClick={() => void onOpenActionsFolder()}
            >
              Actions Folder
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              size="compact"
              tone="quiet"
              onClick={resetContextMenuLayout}
            >
              Reset Context
            </OverlayActionButton>
            <OverlayActionButton
              appearance={appearance}
              size="compact"
              tone="quiet"
              onClick={resetAllContextMenuLayouts}
            >
              Reset All
            </OverlayActionButton>
          </SettingsActionStrip>
        )}
      >
        {menuPacksWarnings.length > 0 ? (
          <div className="rounded border px-3 py-2 text-[11px]" style={insetSurfaceStyle}>
            {menuPacksWarnings.map(warning => (
              <div key={warning} className="opacity-55">{warning}</div>
            ))}
          </div>
        ) : null}
        {actionsWarnings.length > 0 ? (
          <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={insetSurfaceStyle}>
            {actionsWarnings.map(warning => (
              <div key={warning} className="opacity-55">{warning}</div>
            ))}
          </div>
        ) : null}

        <SettingsActionStrip className="mt-3">
          {EXPLORER_MENU_CONTEXT_KINDS.map(contextKind => (
            <OverlayActionButton
              key={contextKind}
              appearance={appearance}
              size="compact"
              tone={activeContextMenuContext === contextKind ? 'accent' : 'quiet'}
              active={activeContextMenuContext === contextKind}
              onClick={() => setActiveContextMenuComposerContext(contextKind)}
            >
              {contextKind}
            </OverlayActionButton>
          ))}
        </SettingsActionStrip>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                Context Setup
              </div>
              <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                <span>Active Menu Pack</span>
                <select
                  value={activeMenuPack?.id ?? ''}
                  onChange={event => setActiveMenuPackId(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsSelectStyle}
                >
                  {menuPacks.map(pack => (
                    <option key={pack.id} value={pack.id}>{pack.name}</option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                <span>Context Renderer</span>
                <select
                  value={activeContextMenuLayout.renderer ?? 'classic'}
                  onChange={event => setContextMenuRendererForActiveContext(event.target.value as ExplorerMenuContextLayout['renderer'])}
                  className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsSelectStyle}
                >
                  {['classic', 'hybrid', 'radial', 'sheet', 'hud'].map(renderer => (
                    <option key={renderer} value={renderer}>{renderer}</option>
                  ))}
                </select>
              </label>
              <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={insetSurfaceStyle}>
                <div className="flex flex-wrap gap-1.5">
                  <ThemeBadge label={menuPacksLoading ? 'Scanning Packs' : `${menuPacks.length} packs`} />
                  <ThemeBadge label={actionsLoading ? 'Scanning Actions' : `${actions.length} actions`} />
                  <ThemeBadge label={`${actionPacks.length} action packs`} />
                  <ThemeBadge label={`${authoredPluginActionCount} plugin authored`} />
                </div>
                <div className="mt-3 opacity-55">
                  The canvas is the editor now. Open folders like a real menu stack,
                  drag from the library on the right, and only use these left-side
                  controls as fallback.
                </div>
                <div className="mt-2 text-[10px] opacity-45">
                  New nodes currently land {insertionTargetLabel}.
                </div>
                <div className="mt-2 text-[10px] opacity-45">
                  {legacyPluginMenuItemCount} legacy plugin menu items •{' '}
                  {legacyPluginActionCount} legacy plugin explorer actions
                </div>
                <div className="mt-2 text-[10px] opacity-35">{menuPacksDirectory}</div>
                <div className="mt-1 text-[10px] opacity-35">{actionsDirectory}</div>
                {menuPacksError ? (
                  <div className="mt-2 text-[10px]" style={{ color: 'var(--overlay-danger)' }}>
                    {menuPacksError}
                  </div>
                ) : null}
                {actionsError ? (
                  <div className="mt-1 text-[10px]" style={{ color: 'var(--overlay-danger)' }}>
                    {actionsError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                  Quick Insert
                </div>
                <ThemeBadge
                  label={`${availableContextMenuCommandsForActiveContext.length} available`}
                />
              </div>
              <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                <span>Add Command</span>
                <select
                  value={contextMenuCommandDraftByContext[activeContextMenuContext] ?? ''}
                  onChange={event => setContextMenuCommandDraftByContext(current => ({
                    ...current,
                    [activeContextMenuContext]: event.target.value,
                  }))}
                  className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                  style={settingsSelectStyle}
                >
                  <option value="">
                    {availableContextMenuCommandsForActiveContext.length > 0
                      ? 'Choose command…'
                      : 'No more commands for this context'}
                  </option>
                  {availableContextMenuCommandsForActiveContext.map(command => (
                    <option key={command.id} value={command.id}>{command.title}</option>
                  ))}
                </select>
              </label>
              <OverlayActionButton
                appearance={appearance}
                size="compact"
                tone="accent"
                onClick={() => addContextMenuCommandEntry()}
                className="mt-2 w-full justify-center"
              >
                Insert Command
              </OverlayActionButton>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                  <span>Add Group Slot</span>
                  <select
                    value={contextMenuGroupDraftByContext[activeContextMenuContext] ?? 'plugin'}
                    onChange={event => setContextMenuGroupDraftByContext(current => ({
                      ...current,
                      [activeContextMenuContext]: event.target.value as Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group'],
                    }))}
                    className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                    style={settingsSelectStyle}
                  >
                    {explorerMenuGroupOptions.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </label>
                <OverlayActionButton
                  appearance={appearance}
                  size="compact"
                  tone="quiet"
                  onClick={addContextMenuGroupSlot}
                  className="self-end justify-center"
                >
                  Add Group Slot
                </OverlayActionButton>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <OverlayActionButton
                  appearance={appearance}
                  size="compact"
                  tone="quiet"
                  onClick={addContextMenuSubmenu}
                  className="justify-center"
                >
                  Create Folder
                </OverlayActionButton>
                <OverlayActionButton
                  appearance={appearance}
                  size="compact"
                  tone="quiet"
                  onClick={addContextMenuSeparator}
                  className="justify-center"
                >
                  Add Separator
                </OverlayActionButton>
              </div>
              <div className="mt-3 rounded border px-3 py-3 text-[10px] opacity-55" style={insetSurfaceStyle}>
                The right-side library is the fast path. These controls stay here
                for keyboard-friendly inserts and recovery when you already know
                exactly what you want.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                    Menu Canvas
                  </div>
                  <div className="mt-1 text-[11px] opacity-45">
                    Edit <code>{activeContextMenuContext}</code> as the menu
                    itself. Open folders into sidecar panels, drag new commands
                    straight into the stack, and tweak the selected row inline.
                  </div>
                </div>
                <SettingsActionStrip>
                  <OverlayActionButton
                    appearance={appearance}
                    size="compact"
                    tone={canvasMode === 'edit' ? 'accent' : 'quiet'}
                    active={canvasMode === 'edit'}
                    onClick={() => setCanvasMode('edit')}
                  >
                    Menu Edit
                  </OverlayActionButton>
                  <OverlayActionButton
                    appearance={appearance}
                    size="compact"
                    tone={canvasMode === 'preview' ? 'accent' : 'quiet'}
                    active={canvasMode === 'preview'}
                    onClick={() => setCanvasMode('preview')}
                  >
                    Runtime Preview
                  </OverlayActionButton>
                  <ThemeBadge label={`Renderer ${contextMenuPreviewMenu.presentation.renderer}`} active />
                  <ThemeBadge label={`Density ${contextMenuPreviewMenu.presentation.density}`} />
                </SettingsActionStrip>
              </div>
              <div
                className="mt-3 rounded-[20px] border p-3"
                style={{ borderColor: border, background: 'rgba(0,0,0,0.16)' }}
              >
                {canvasMode === 'preview' ? (
                  <div data-context-menu-canvas-mode="preview">
                    <ExplorerContextMenuPreviewPanels
                      nodes={contextMenuPreviewMenu.nodes}
                      density={contextMenuPreviewMenu.presentation.density}
                      showDescriptions={contextMenuPreviewMenu.presentation.showDescriptions}
                      selectedNodeId={selectedContextMenuPreviewNodeId}
                      onSelectNode={selectContextMenuEntryFromRuntimeNode}
                    />
                  </div>
                ) : (
                  <div data-context-menu-canvas-mode="edit">
                    <div
                      className="mb-3 flex flex-wrap items-center gap-2 px-1"
                      style={{ color: muted }}
                    >
                      {contextMenuEditorBreadcrumbs.map((crumb, index) => {
                        const isActive =
                          index === contextMenuEditorBreadcrumbs.length - 1;

                        return (
                          <div
                            key={crumb.key}
                            className="flex items-center gap-2"
                          >
                            {index > 0 ? (
                              <span
                                aria-hidden
                                className="text-[9px] opacity-40"
                              >
                                /
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenEditorSubmenuPath(crumb.path);
                                setSelectedContextMenuEntryId(
                                  crumb.selectedEntryId,
                                );
                              }}
                              className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-opacity"
                              style={{
                                borderColor: isActive ? `${accent}88` : `${border}aa`,
                                background: isActive
                                  ? `${accent}14`
                                  : 'rgba(255,255,255,0.02)',
                                color: text,
                                opacity: isActive ? 1 : 0.72,
                              }}
                            >
                              {crumb.label}
                            </button>
                          </div>
                        );
                      })}
                      <span className="text-[10px] opacity-45">
                        Open folders from the menu row to branch deeper.
                      </span>
                    </div>
                    <div className="flex min-h-[420px] gap-3 overflow-x-auto pb-1">
                      {editorPanelState.panels.map((panel) => (
                        <div
                          key={panel.key}
                          className="shrink-0 rounded border py-1"
                          style={{
                            width: contextMenuEditorPanelWidth,
                            minHeight: 220,
                            borderColor: 'var(--overlay-explorer-preview-border)',
                            background: 'var(--overlay-explorer-preview-bg)',
                            boxShadow: 'var(--overlay-explorer-ctx-menu-shadow)',
                            backdropFilter: 'blur(14px)',
                          }}
                        >
                          <div className="px-3 pb-2 pt-1">
                            <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-55">
                              <span>{panel.path.length === 0 ? 'Root Menu' : panel.title}</span>
                              <span>{panel.entries.length} node{panel.entries.length === 1 ? '' : 's'}</span>
                            </div>
                          </div>
                          <DraggablePanelList
                            items={panel.entries}
                            getItemId={(entry) => entry.id}
                            activeItemId={selectedContextMenuEntryId}
                            draggedItemId={draggedContextMenuEntryId}
                            externalDragActive={libraryDragState?.active === true}
                            externalHoveredDropIndex={
                              libraryDragState?.targetListLabel === panel.listLabel
                                ? libraryDragState.targetIndex
                                : null
                            }
                            onSelectItem={setSelectedContextMenuEntryId}
                            onDragStart={(entryId) => {
                              setDraggedContextMenuEntryId(entryId);
                              setSelectedContextMenuEntryId(entryId);
                            }}
                            onDragEnd={() => setDraggedContextMenuEntryId(null)}
                            onDropItem={(entryId, index) => {
                              placeContextMenuLayoutEntryAt(
                                entryId,
                                panel.parentEntryId,
                                index,
                              );
                              setSelectedContextMenuEntryId(entryId);
                              setDraggedContextMenuEntryId(null);
                            }}
                            listLabel={panel.listLabel}
                            accentColor={accent}
                            borderColor={border}
                            emptyState={
                              <div
                                data-context-menu-canvas-empty={
                                  panel.parentEntryId ?? 'root'
                                }
                                className="space-y-2 px-3 py-2"
                              >
                                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                                  <FolderTree size={11} />
                                  <span>
                                    {panel.parentEntryId == null
                                      ? 'Empty Menu'
                                      : 'Empty Folder'}
                                  </span>
                                </div>
                                <p className="text-[10px] leading-4 opacity-45">
                                  Drag from the library into this panel or keep the
                                  folder selected and use quick insert on the left.
                                </p>
                              </div>
                            }
                            className="space-y-0.5 px-1 pb-1"
                            renderItem={({ item, isActive, isDragging, dragHandleProps }) => {
                              const resolvedCommand =
                                item.kind === 'command'
                                  ? contextMenuCommandLookup.get(item.commandId) ?? null
                                  : null;
                              const childCount =
                                item.kind === 'submenu'
                                  ? getBranchEntries(item.id).length
                                  : 0;
                              const title = resolveContextMenuEntryTitle(
                                item,
                                contextMenuCommandLookup,
                              );
                              const metaParts: string[] = [];
                              if (resolvedCommand) {
                                metaParts.push(
                                  resolveContextMenuCommandSourceLabel(resolvedCommand),
                                );
                              }
                              if (item.kind === 'submenu') {
                                metaParts.push(
                                  `${childCount} item${childCount === 1 ? '' : 's'}`,
                                );
                              }
                              if (item.kind === 'group-slot') {
                                metaParts.push(
                                  `${item.group} · ${item.sourceFilter ?? 'any'}`,
                                );
                              }
                              if (item.quickSlot && item.quickSlot !== 'none') {
                                metaParts.push(item.quickSlot);
                              }
                              const panelPrefix = panel.path;

                              return (
                                <div
                                  data-context-menu-canvas-item={item.id}
                                  className="rounded-[14px] border"
                                  style={{
                                    borderColor: isActive
                                      ? accent
                                      : `${border}b8`,
                                    background: isActive
                                      ? `${accent}12`
                                      : 'transparent',
                                    color: text,
                                    boxShadow: isActive
                                      ? `0 0 0 1px ${accent}20 inset`
                                      : 'none',
                                    opacity: isDragging ? 0.72 : 1,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedContextMenuEntryId(item.id);
                                      if (item.kind === 'submenu') {
                                        setOpenEditorSubmenuPath([
                                          ...panelPrefix,
                                          item.id,
                                        ]);
                                      } else {
                                        setOpenEditorSubmenuPath(panelPrefix);
                                      }
                                    }}
                                    className="w-full border-0 bg-transparent px-2.5 py-2 text-left"
                                  >
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns:
                                          '18px 16px minmax(0, 1fr) auto',
                                        alignItems: 'center',
                                        gap: 10,
                                      }}
                                    >
                                      <span
                                        {...dragHandleProps}
                                        aria-hidden
                                        className="cursor-grab select-none text-[8px] font-semibold tracking-[0.2em] active:cursor-grabbing"
                                        style={{ color: muted, touchAction: 'none' }}
                                      >
                                        ⋮⋮
                                      </span>
                                      <span className="opacity-75">
                                        {item.kind === 'submenu' ? (
                                          <FolderTree size={13} />
                                        ) : (
                                          renderSettingsContextMenuIcon(
                                            resolvedCommand?.iconName,
                                          )
                                        )}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate text-[11px] font-semibold">
                                          {title}
                                        </span>
                                        {metaParts.length > 0 ? (
                                          <span className="mt-1 block text-[9px] opacity-45">
                                            {metaParts.join(' • ')}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="text-[9px] opacity-45">
                                        {item.kind === 'submenu' ? '▶' : `#${item.order}`}
                                      </span>
                                    </div>
                                  </button>
                                  {isActive ? renderInlineContextMenuEditor(item) : null}
                                </div>
                              );
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                  Menu Library
                </div>
                <ThemeBadge label={`${contextMenuLibraryItems.length} visible`} />
              </div>
              <div className="relative mt-3">
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 12,
                    transform: 'translateY(-50%)',
                    color: muted,
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={contextMenuCommandBrowserQuery}
                  onChange={(event) =>
                    setContextMenuCommandBrowserQuery(event.target.value)
                  }
                  placeholder="Search actions, commands, folders..."
                  className="w-full rounded border px-3 py-2 pl-9 text-[11px] outline-none"
                  style={settingsFieldStyle}
                />
              </div>
              <div className="mt-3 max-h-[540px] space-y-3 overflow-y-auto pr-1">
                {contextMenuLibrarySections.length === 0 ? (
                  <div
                    className="rounded border px-3 py-4 text-[11px] opacity-50"
                    style={insetSurfaceStyle}
                  >
                    No library items match the current filter.
                  </div>
                ) : (
                  contextMenuLibrarySections.map((section) => (
                    <section key={section.key} className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">
                        {section.label}
                      </div>
                      <div className="space-y-2">
                        {section.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-[14px] border px-3 py-2.5"
                            style={insetSurfaceStyle}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                aria-label={`Drag ${item.label} into menu`}
                                onPointerDown={(event) =>
                                  beginContextMenuLibraryDrag(item, event)
                                }
                                className="mt-0.5 shrink-0 select-none rounded border px-2 py-1 text-[8px] font-semibold tracking-[0.2em]"
                                style={{
                                  borderColor: `${border}aa`,
                                  background: 'rgba(255,255,255,0.025)',
                                  color: muted,
                                  touchAction: 'none',
                                  cursor: 'grab',
                                }}
                              >
                                ⋮⋮
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="opacity-75">
                                    {item.kind === 'command' ? (
                                      renderSettingsContextMenuIcon(
                                        item.command.iconName,
                                      )
                                    ) : item.kind === 'structure-submenu' ? (
                                      <FolderTree size={13} />
                                    ) : item.kind === 'structure-group-slot' ? (
                                      <Sparkles size={13} />
                                    ) : (
                                      <Puzzle size={13} />
                                    )}
                                  </span>
                                  <span className="truncate text-[11px] font-semibold">
                                    {item.label}
                                  </span>
                                </div>
                                <div className="mt-1 text-[10px] leading-4 opacity-45">
                                  {item.description}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <ThemeBadge label={item.sourceLabel} />
                                  {item.kind === 'command' ? (
                                    <ThemeBadge label={item.command.group} />
                                  ) : item.kind === 'structure-group-slot' ? (
                                    <ThemeBadge
                                      label={
                                        contextMenuGroupDraftByContext[
                                          activeContextMenuContext
                                        ] ?? 'plugin'
                                      }
                                    />
                                  ) : null}
                                </div>
                              </div>
                              <OverlayActionButton
                                appearance={appearance}
                                size="compact"
                                tone="quiet"
                                onClick={() => runContextMenuLibraryQuickAdd(item)}
                                className="shrink-0"
                              >
                                Add
                              </OverlayActionButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </SettingsSectionBlock>
      {libraryDragState?.active ? (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: libraryDragState.currentX + 18,
            top: libraryDragState.currentY + 18,
            zIndex: 90,
            pointerEvents: 'none',
            borderRadius: 14,
            border: `1px solid ${accent}55`,
            background: 'color-mix(in srgb, var(--overlay-explorer-preview-bg) 92%, black 8%)',
            boxShadow: 'var(--overlay-explorer-toolbar-shadow)',
            padding: '10px 12px',
            color: text,
            fontSize: 11,
            fontWeight: 700,
            maxWidth: 240,
          }}
        >
          <div>{libraryDragState.item.label}</div>
          <div
            style={{
              marginTop: 4,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: muted,
            }}
          >
            {libraryDragState.targetListLabel
              ? 'Drop into menu'
              : 'Drag into a menu panel'}
          </div>
        </div>
      ) : null}
    </section>
  );
}
