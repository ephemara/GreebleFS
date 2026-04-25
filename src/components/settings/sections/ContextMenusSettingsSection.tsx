import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

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

export function ContextMenusSettingsSection({
  detail,
  border,
  accent,
  text,
  muted,
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
  contextMenuGroupDraftByContext,
  setContextMenuGroupDraftByContext,
  addContextMenuGroupSlot,
  addContextMenuSubmenu,
  addContextMenuSeparator,
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
  border: string;
  accent: string;
  text: string;
  muted: string;
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
  contextMenuGroupDraftByContext: Partial<Record<ExplorerMenuContextKind, Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group']>>;
  setContextMenuGroupDraftByContext: Dispatch<SetStateAction<Partial<Record<ExplorerMenuContextKind, Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group']>>>>;
  addContextMenuGroupSlot: () => void;
  addContextMenuSubmenu: () => void;
  addContextMenuSeparator: () => void;
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

  useEffect(() => {
    setCanvasMode('edit');
  }, [activeContextMenuContext]);

  const controlButtonStyle = {
    border: `1px solid ${border}`,
    background: 'rgba(255,255,255,0.04)',
    color: text,
  } as const;
  const accentButtonStyle = {
    border: `1px solid ${accent}55`,
    background: `${accent}14`,
    color: text,
  } as const;
  const inputStyle = {
    borderColor: border,
    background: 'rgba(255,255,255,0.04)',
    color: text,
  } as const;
  const panelSurfaceStyle = {
    borderColor: border,
    background: 'rgba(255,255,255,0.03)',
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

  const renderContextMenuCanvasBranch = (parentEntryId: string | null): ReactNode => {
    const branchEntries = getBranchEntries(parentEntryId);
    const listLabel = parentEntryId == null
      ? `context-menu-root-${activeContextMenuContext}`
      : `context-menu-branch-${parentEntryId}`;

    return (
      <DraggablePanelList
        items={branchEntries}
        getItemId={(entry) => entry.id}
        activeItemId={selectedContextMenuEntryId}
        draggedItemId={draggedContextMenuEntryId}
        onSelectItem={setSelectedContextMenuEntryId}
        onDragStart={(entryId) => {
          setDraggedContextMenuEntryId(entryId);
          setSelectedContextMenuEntryId(entryId);
        }}
        onDragEnd={() => setDraggedContextMenuEntryId(null)}
        onDropItem={(entryId, index) => {
          placeContextMenuLayoutEntryAt(entryId, parentEntryId, index);
          setSelectedContextMenuEntryId(entryId);
          setDraggedContextMenuEntryId(null);
        }}
        listLabel={listLabel}
        accentColor={accent}
        borderColor={border}
        emptyState={(
          <div
            data-context-menu-canvas-empty={parentEntryId ?? 'root'}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
              <FolderTree size={11} />
              <span>{parentEntryId == null ? 'Menu Canvas' : 'Empty Folder'}</span>
            </div>
            <p className="text-[11px] opacity-50">
              {parentEntryId == null
                ? 'Start with commands, actions, folders, or group slots from the library. Drag rows directly to reshape the menu.'
                : 'Drop rows here or keep this folder selected and add new nodes from the library.'}
            </p>
          </div>
        )}
        className="space-y-1.5"
        renderItem={({ item, isActive, isDragging }) => {
          const resolvedCommand = item.kind === 'command'
            ? (contextMenuCommandLookup.get(item.commandId) ?? null)
            : null;
          const title = resolveContextMenuEntryTitle(item, contextMenuCommandLookup);
          const childCount = item.kind === 'submenu'
            ? getBranchEntries(item.id).length
            : 0;
          const supportingCopy = resolveContextMenuEntrySupportingCopy({
            entry: item,
            commandLookup: contextMenuCommandLookup,
            childCount,
          });

          return (
            <button
              type="button"
              onClick={() => setSelectedContextMenuEntryId(item.id)}
              data-context-menu-canvas-item={item.id}
              className="w-full rounded-[18px] border px-3 py-3 text-left"
              style={{
                borderColor: isActive ? accent : `${border}cc`,
                background: isActive ? `${accent}14` : 'rgba(255,255,255,0.035)',
                color: text,
                boxShadow: isActive ? `0 0 0 1px ${accent}24 inset` : 'none',
                opacity: isDragging ? 0.76 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  aria-hidden
                  className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border text-[10px] font-semibold tracking-[0.24em]"
                  style={{
                    borderColor: isActive ? `${accent}66` : `${border}aa`,
                    background: isActive ? `${accent}12` : 'rgba(255,255,255,0.03)',
                    color: isActive ? text : muted,
                  }}
                >
                  ⋮⋮
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="opacity-75">
                          {item.kind === 'submenu'
                            ? <FolderTree size={13} />
                            : renderSettingsContextMenuIcon(resolvedCommand?.iconName)}
                        </span>
                        <span className="truncate text-[12px] font-semibold">{title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <ThemeBadge label={item.kind === 'submenu' ? 'folder' : item.kind} active={isActive} />
                        {resolvedCommand ? (
                          <ThemeBadge label={resolveContextMenuCommandSourceLabel(resolvedCommand)} />
                        ) : null}
                        {item.kind === 'group-slot' ? (
                          <ThemeBadge label={item.sourceFilter ?? 'any'} />
                        ) : null}
                        {item.kind === 'submenu' ? (
                          <ThemeBadge label={`${childCount} node${childCount === 1 ? '' : 's'}`} />
                        ) : null}
                        {item.quickSlot && item.quickSlot !== 'none' ? (
                          <ThemeBadge label={item.quickSlot} />
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[10px] opacity-45">
                      <div>#{item.order}</div>
                      {item.kind === 'submenu' ? (
                        <div className="mt-1 opacity-60">Folder</div>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 opacity-45">{supportingCopy}</p>
                </div>
              </div>
            </button>
          );
        }}
        renderChildren={(item) => {
          if (item.kind !== 'submenu') {
            return null;
          }
          const childCount = getBranchEntries(item.id).length;
          const childLaneActive = selectedContextMenuEntryId === item.id;
          return (
            <div
              className="ml-4 mt-2 border-l pl-3"
              style={{
                borderColor: childLaneActive ? `${accent}66` : `${border}88`,
              }}
            >
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-55">
                <FolderTree size={11} />
                <span>{item.title}</span>
                <ThemeBadge label={`${childCount} node${childCount === 1 ? '' : 's'}`} />
              </div>
              {renderContextMenuCanvasBranch(item.id)}
            </div>
          );
        }}
      />
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
        title="Explorer Menu Runtime"
        subtitle="Context menus are now a first-class authored system. Menu packs define the structure, the command graph defines behavior, themes can steer renderer presentation, and user overrides own the composer layer for shareable setups and future renderer/layout packs."
        tone="accent"
        accent={accent}
        badges={[
          activeMenuPack?.name ?? 'No Pack',
          `${menuPacks.length} Pack${menuPacks.length === 1 ? '' : 's'}`,
          `${customizedContextCount} Customized Context${customizedContextCount === 1 ? '' : 's'}`,
        ]}
      >
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
          <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Menu Packs</div>
            <p className="mt-2 opacity-45">
              Switch authored menu structures without touching command execution. This is the lane for future shared packs, curated defaults, and per-team context menu presets.
            </p>
          </div>
          <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Composer Overrides</div>
            <p className="mt-2 opacity-45">
              Reorder nodes, create submenus, assign quick slots, and control fallback buckets per context without hardcoding renderer-specific UI trees.
            </p>
          </div>
          <div className="rounded border p-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.025)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">Renderer Growth</div>
            <p className="mt-2 opacity-45">
              Classic nested menus ship first, but this section is where radial, hybrid, sheet, HUD, and shared presentation recipes can expand.
            </p>
          </div>
        </div>
      </SettingsSectionBlock>

      <SettingsSectionBlock
        title="Context Menu Composer"
        subtitle="Edit the live explorer context menu directly: keep a folder selected and add into it, drag the menu rows themselves with minimal drop rails, and flip to the runtime preview only when you need a final render check."
        tone="muted"
        actions={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void onRefreshMenuPacks()} className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={controlButtonStyle}>
              Refresh Packs
            </button>
            <button type="button" onClick={() => void onRefreshActions()} className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={controlButtonStyle}>
              Refresh Actions
            </button>
            <button type="button" onClick={() => void onOpenMenuPacksFolder()} className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={accentButtonStyle}>
              Open Menu Packs Folder
            </button>
            <button type="button" onClick={() => void onOpenActionsFolder()} className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={accentButtonStyle}>
              Open Actions Folder
            </button>
            <button type="button" onClick={resetContextMenuLayout} className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={controlButtonStyle}>
              Reset Context
            </button>
            <button type="button" onClick={resetAllContextMenuLayouts} className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={controlButtonStyle}>
              Reset All Overrides
            </button>
          </div>
        )}
      >
        {menuPacksWarnings.length > 0 ? (
          <div className="rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${border}aa`, background: 'rgba(255,255,255,0.02)' }}>
            {menuPacksWarnings.map(warning => (
              <div key={warning} className="opacity-55">{warning}</div>
            ))}
          </div>
        ) : null}
        {actionsWarnings.length > 0 ? (
          <div className="mt-3 rounded border px-3 py-2 text-[11px]" style={{ borderColor: `${border}aa`, background: 'rgba(255,255,255,0.02)' }}>
            {actionsWarnings.map(warning => (
              <div key={warning} className="opacity-55">{warning}</div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {EXPLORER_MENU_CONTEXT_KINDS.map(contextKind => (
            <button
              key={contextKind}
              type="button"
              onClick={() => setActiveContextMenuComposerContext(contextKind)}
              className="rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                border: `1px solid ${activeContextMenuContext === contextKind ? accent : border}`,
                background: activeContextMenuContext === contextKind ? `${accent}16` : 'rgba(255,255,255,0.03)',
                color: text,
              }}
            >
              {contextKind}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Composer Setup</div>
              <label className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                <span>Active Menu Pack</span>
                <select
                  value={activeMenuPack?.id ?? ''}
                  onChange={event => setActiveMenuPackId(event.target.value)}
                  className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                  style={inputStyle}
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
                  className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                  style={inputStyle}
                >
                  {['classic', 'hybrid', 'radial', 'sheet', 'hud'].map(renderer => (
                    <option key={renderer} value={renderer}>{renderer}</option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-1 gap-2 text-[11px]">
                <div className="rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                  <div className="font-semibold">{activeMenuPack?.name ?? 'No Pack Loaded'}</div>
                  <div className="mt-1 opacity-55">
                    {menuPacksLoading ? 'Scanning menu packs…' : `${menuPacks.length} pack${menuPacks.length === 1 ? '' : 's'} available`}
                  </div>
                  <div className="mt-1 text-[10px] opacity-45">{menuPacksDirectory}</div>
                  {menuPacksError ? (
                    <div className="mt-1 text-[10px]" style={{ color: 'var(--overlay-danger)' }}>
                      {menuPacksError}
                    </div>
                  ) : null}
                </div>
                <div className="rounded border px-3 py-2" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                  <div className="font-semibold">Action Catalog</div>
                  <div className="mt-1 opacity-55">
                    {actionsLoading ? 'Scanning action packs…' : `${actions.length} action${actions.length === 1 ? '' : 's'} across ${actionPacks.length} pack${actionPacks.length === 1 ? '' : 's'}`}
                  </div>
                  <div className="mt-1 text-[10px] opacity-45">{actionsDirectory}</div>
                  {actionsError ? (
                    <div className="mt-1 text-[10px]" style={{ color: 'var(--overlay-danger)' }}>
                      {actionsError}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Action Browser</div>
                <ThemeBadge label={`${filteredContextMenuBrowserCommands.length} visible`} />
              </div>
              <p className="mt-2 text-[11px] opacity-45">
                New nodes currently land {insertionTargetLabel}. Keep a folder selected to author into it without touching the parent picker.
              </p>
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
                  onChange={event => setContextMenuCommandBrowserQuery(event.target.value)}
                  placeholder="Search commands, actions, plugins..."
                  className="w-full rounded border px-3 py-2 pl-9 text-[12px]"
                  style={inputStyle}
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
                  className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                  style={inputStyle}
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
              <button
                type="button"
                onClick={() => addContextMenuCommandEntry()}
                className="mt-2 w-full rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={controlButtonStyle}
              >
                Add Command Node
              </button>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                  <span>Add Group Slot</span>
                  <select
                    value={contextMenuGroupDraftByContext[activeContextMenuContext] ?? 'plugin'}
                    onChange={event => setContextMenuGroupDraftByContext(current => ({
                      ...current,
                      [activeContextMenuContext]: event.target.value as Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group'],
                    }))}
                    className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                    style={inputStyle}
                  >
                    {explorerMenuGroupOptions.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={addContextMenuGroupSlot}
                  className="self-end rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={controlButtonStyle}
                >
                  Add Group Slot
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={addContextMenuSubmenu} className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={controlButtonStyle}>
                  Create Folder
                </button>
                <button type="button" onClick={addContextMenuSeparator} className="rounded px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={controlButtonStyle}>
                  Add Separator
                </button>
              </div>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {filteredContextMenuBrowserCommands.length === 0 ? (
                  <div className="rounded border px-3 py-4 text-[11px] opacity-50" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                    No commands match the current browser filter.
                  </div>
                ) : filteredContextMenuBrowserCommands.map(command => (
                  <div key={command.id} className="rounded-xl border px-3 py-3" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="opacity-70">{renderSettingsContextMenuIcon(command.iconName)}</span>
                          <span className="text-[11px] font-semibold">{command.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <ThemeBadge label={resolveContextMenuCommandSourceLabel(command)} />
                          <ThemeBadge label={command.group} />
                        </div>
                        {command.description ? (
                          <p className="mt-2 text-[11px] opacity-45">{command.description}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => addContextMenuCommandEntry(command.id)}
                        className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={controlButtonStyle}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Menu Canvas</div>
                  <div className="mt-1 text-[11px] opacity-45">
                    Drag the menu rows directly in <code>{activeContextMenuContext}</code>. Minimal drop rails appear only while dragging, and runtime preview stays one toggle away.
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCanvasMode('edit')}
                    className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      border: `1px solid ${canvasMode === 'edit' ? accent : border}`,
                      background: canvasMode === 'edit' ? `${accent}16` : 'rgba(255,255,255,0.03)',
                      color: text,
                    }}
                  >
                    Edit Canvas
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasMode('preview')}
                    className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      border: `1px solid ${canvasMode === 'preview' ? accent : border}`,
                      background: canvasMode === 'preview' ? `${accent}16` : 'rgba(255,255,255,0.03)',
                      color: text,
                    }}
                  >
                    Runtime Preview
                  </button>
                  <ThemeBadge label={`Renderer ${contextMenuPreviewMenu.presentation.renderer}`} active />
                  <ThemeBadge label={`Density ${contextMenuPreviewMenu.presentation.density}`} />
                </div>
              </div>
              <div className="mt-3 rounded-[22px] border p-3" style={{ borderColor: border, background: 'rgba(0,0,0,0.16)' }}>
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
                    {renderContextMenuCanvasBranch(null)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Inspector</div>
                {selectedContextMenuEntry ? (
                  <ThemeBadge label={selectedContextMenuEntry.kind === 'submenu' ? 'folder' : selectedContextMenuEntry.kind} active />
                ) : null}
              </div>
              {selectedContextMenuEntry == null ? (
                <div className="mt-3 rounded border px-3 py-4 text-[11px] opacity-50" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                  Select a canvas row or click a concrete menu item in runtime preview to inspect and fine-tune it here.
                </div>
              ) : (
                <>
                  <div className="mt-3">
                    <div className="text-[13px] font-semibold">
                      {resolveContextMenuEntryTitle(selectedContextMenuEntry, contextMenuCommandLookup)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {selectedContextMenuCommand ? (
                        <ThemeBadge label={resolveContextMenuCommandSourceLabel(selectedContextMenuCommand)} />
                      ) : null}
                      {selectedContextMenuCommand ? (
                        <ThemeBadge label={selectedContextMenuCommand.contexts.join(' + ')} />
                      ) : null}
                      <ThemeBadge label={`Order ${selectedContextMenuEntry.order}`} />
                    </div>
                    <p className="mt-2 text-[11px] opacity-45">
                      {resolveContextMenuEntrySupportingCopy({
                        entry: selectedContextMenuEntry,
                        commandLookup: contextMenuCommandLookup,
                        childCount: selectedContextMenuEntry.kind === 'submenu'
                          ? getBranchEntries(selectedContextMenuEntry.id).length
                          : 0,
                      })}
                    </p>
                  </div>

                  <label className="mt-3 flex items-center justify-between gap-3 rounded border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={selectedContextMenuEntry.enabled !== false}
                      onChange={event => toggleContextMenuLayoutEntryEnabled(selectedContextMenuEntry.id, event.target.checked)}
                    />
                  </label>

                  {selectedContextMenuEntry.kind === 'submenu' ? (
                    <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      <span>Folder Name</span>
                      <input
                        value={selectedContextMenuEntry.title}
                        onChange={event => setContextMenuSubmenuTitle(selectedContextMenuEntry.id, event.target.value)}
                        className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                        style={inputStyle}
                      />
                    </label>
                  ) : null}

                  {selectedContextMenuEntry.kind === 'group-slot' ? (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                        <span>Group</span>
                        <select
                          value={selectedContextMenuEntry.group}
                          onChange={event => setContextMenuGroupSlotGroup(selectedContextMenuEntry.id, event.target.value as Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group'])}
                          className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                          style={inputStyle}
                        >
                          {explorerMenuGroupOptions.map(group => (
                            <option key={group} value={group}>{group}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                        <span>Source Filter</span>
                        <select
                          value={selectedContextMenuEntry.sourceFilter ?? 'any'}
                          onChange={event => setContextMenuGroupSlotSourceFilter(selectedContextMenuEntry.id, event.target.value as Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['sourceFilter'])}
                          className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                          style={inputStyle}
                        >
                          {['any', 'built-in', 'plugin', 'preview', 'action'].map(sourceFilter => (
                            <option key={sourceFilter} value={sourceFilter}>{sourceFilter}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      <span>Parent</span>
                      <select
                        value={selectedContextMenuEntry.parentEntryId ?? ''}
                        onChange={event => setContextMenuLayoutEntryParent(selectedContextMenuEntry.id, event.target.value || null)}
                        className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                        style={inputStyle}
                      >
                        <option value="">Root</option>
                        {availableParentSubmenus.map(submenu => (
                          <option key={submenu.id} value={submenu.id}>{submenu.title}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      <span>Quick Slot</span>
                      <select
                        value={selectedContextMenuEntry.quickSlot ?? 'none'}
                        onChange={event => setContextMenuLayoutEntryQuickSlot(selectedContextMenuEntry.id, event.target.value as ExplorerMenuQuickSlot)}
                        className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                        style={inputStyle}
                      >
                        {explorerMenuQuickSlotOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      <span>Fallback Bucket</span>
                      <select
                        value={selectedContextMenuEntry.fallbackBucket ?? 'default'}
                        onChange={event => setContextMenuLayoutEntryFallbackBucket(selectedContextMenuEntry.id, event.target.value as ExplorerMenuFallbackBucket)}
                        className="mt-1 w-full rounded border px-3 py-2 text-[12px]"
                        style={inputStyle}
                      >
                        {explorerMenuFallbackBucketOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={{ borderColor: border, background: 'rgba(255,255,255,0.02)' }}>
                    <div className="font-semibold">Manual Fallback</div>
                    <p className="mt-2 opacity-50">
                      Dragging on the canvas is the primary workflow. These controls stay here as a slower keyboard-friendly fallback.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveContextMenuLayoutEntry(selectedContextMenuEntry.id, 'up')}
                        disabled={selectedContextMenuSiblingIndex <= 0}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          ...controlButtonStyle,
                          color: selectedContextMenuSiblingIndex <= 0 ? muted : text,
                          opacity: selectedContextMenuSiblingIndex <= 0 ? 0.5 : 1,
                        }}
                      >
                        <ArrowUp size={11} />
                        Nudge Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveContextMenuLayoutEntry(selectedContextMenuEntry.id, 'down')}
                        disabled={selectedContextMenuSiblingIndex < 0 || selectedContextMenuSiblingIndex >= selectedContextMenuSiblingEntriesCount - 1}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          ...controlButtonStyle,
                          color: selectedContextMenuSiblingIndex < 0 || selectedContextMenuSiblingIndex >= selectedContextMenuSiblingEntriesCount - 1 ? muted : text,
                          opacity: selectedContextMenuSiblingIndex < 0 || selectedContextMenuSiblingIndex >= selectedContextMenuSiblingEntriesCount - 1 ? 0.5 : 1,
                        }}
                      >
                        <ArrowDown size={11} />
                        Nudge Down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeContextMenuLayoutEntry(selectedContextMenuEntry.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={controlButtonStyle}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded border px-3 py-3 text-[11px]" style={panelSurfaceStyle}>
              <div className="font-semibold">Source Mix</div>
              <div className="mt-2 opacity-55">{legacyPluginMenuItemCount} legacy plugin menu items</div>
              <div className="mt-1 opacity-55">{legacyPluginActionCount} legacy plugin explorer actions</div>
              <div className="mt-1 opacity-55">{authoredPluginActionCount} plugin-shipped authored actions</div>
            </div>
          </div>
        </div>
      </SettingsSectionBlock>
    </section>
  );
}
