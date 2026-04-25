import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
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
        renderItem={({ item, isActive, isDragging, dragHandleProps }) => {
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
          const showSupportingCopy = isActive || item.kind !== 'command';

          return (
            <button
              type="button"
              onClick={() => setSelectedContextMenuEntryId(item.id)}
              data-context-menu-canvas-item={item.id}
              className="w-full rounded-[16px] border px-2.5 py-2.5 text-left"
              style={{
                borderColor: isActive ? accent : `${border}cc`,
                background: isActive ? `${accent}12` : 'rgba(255,255,255,0.026)',
                color: text,
                boxShadow: isActive ? `0 0 0 1px ${accent}24 inset` : 'none',
                opacity: isDragging ? 0.76 : 1,
              }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  {...dragHandleProps}
                  aria-hidden
                  className="flex h-8 w-7 shrink-0 cursor-grab select-none items-center justify-center rounded-lg border text-[9px] font-semibold tracking-[0.24em] active:cursor-grabbing"
                  style={{
                    borderColor: isActive ? `${accent}66` : `${border}aa`,
                    background: isActive ? `${accent}10` : 'rgba(255,255,255,0.025)',
                    color: isActive ? text : muted,
                    touchAction: 'none',
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
                        <span className="truncate text-[11px] font-semibold">{title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {resolvedCommand ? (
                          <ThemeBadge label={resolveContextMenuCommandSourceLabel(resolvedCommand)} />
                        ) : null}
                        {item.kind === 'group-slot' ? (
                          <ThemeBadge label={`${item.group} · ${item.sourceFilter ?? 'any'}`} />
                        ) : null}
                        {item.kind === 'submenu' ? (
                          <ThemeBadge label={`${childCount} node${childCount === 1 ? '' : 's'}`} />
                        ) : null}
                        {item.quickSlot && item.quickSlot !== 'none' ? (
                          <ThemeBadge label={item.quickSlot} />
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[9px] opacity-45">
                      <div>#{item.order}</div>
                      <div className="mt-1 opacity-60">
                        {item.kind === 'submenu' ? 'Folder' : item.kind}
                      </div>
                    </div>
                  </div>
                  {showSupportingCopy ? (
                    <p className="mt-1 text-[10px] leading-4 opacity-45">
                      {supportingCopy}
                    </p>
                  ) : null}
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
              className="ml-3 mt-2 border-l pl-2.5"
              style={{
                borderColor: childLaneActive ? `${accent}66` : `${border}88`,
              }}
            >
              <div className="mb-2 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] opacity-55">
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
        title="Context Menu Composer"
        subtitle="Shape the live explorer menu directly. Select a folder to author into it, reorder with the canvas itself, and only flip to runtime preview when you want the final render pass."
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

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_272px]">
          <div className="space-y-3">
            <div className="rounded border p-3" style={panelSurfaceStyle}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Composer Setup</div>
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
                  New nodes currently land {insertionTargetLabel}. Keep a folder selected to author into it without touching the parent picker.
                </div>
                <div className="mt-2 text-[10px] opacity-45">{menuPacksDirectory}</div>
                <div className="mt-1 text-[10px] opacity-45">{actionsDirectory}</div>
                <div className="mt-2 text-[10px] opacity-45">
                  {legacyPluginMenuItemCount} legacy plugin menu items • {legacyPluginActionCount} legacy plugin explorer actions
                </div>
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
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-60">Action Browser</div>
                <ThemeBadge label={`${filteredContextMenuBrowserCommands.length} visible`} />
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
                  onChange={event => setContextMenuCommandBrowserQuery(event.target.value)}
                  placeholder="Search commands, actions, plugins..."
                  className="w-full rounded border px-3 py-2 pl-9 text-[11px] outline-none"
                  style={settingsFieldStyle}
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
                Add Command Node
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
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {filteredContextMenuBrowserCommands.length === 0 ? (
                  <div className="rounded border px-3 py-4 text-[11px] opacity-50" style={insetSurfaceStyle}>
                    No commands match the current browser filter.
                  </div>
                ) : filteredContextMenuBrowserCommands.map(command => (
                  <div key={command.id} className="rounded-xl border px-3 py-2.5" style={insetSurfaceStyle}>
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
                          <p className="mt-1 text-[10px] leading-4 opacity-45">{command.description}</p>
                        ) : null}
                      </div>
                      <OverlayActionButton
                        appearance={appearance}
                        size="compact"
                        tone="quiet"
                        onClick={() => addContextMenuCommandEntry(command.id)}
                        className="shrink-0"
                      >
                        Add
                      </OverlayActionButton>
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
                    Edit <code>{activeContextMenuContext}</code> like a real menu stack. The canvas stays slim on purpose so it reads like the menu you are shaping, not a giant list builder.
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
                    Edit Canvas
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
              <div className="mt-3 rounded-[20px] border p-3" style={{ borderColor: border, background: 'rgba(0,0,0,0.16)' }}>
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
                  <div data-context-menu-canvas-mode="edit" className="mx-auto w-full max-w-[620px]">
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
                <div className="mt-3 rounded border px-3 py-4 text-[11px] opacity-50" style={insetSurfaceStyle}>
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
                        className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                        style={settingsFieldStyle}
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
                          className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={settingsSelectStyle}
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
                          className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                          style={settingsSelectStyle}
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
                        className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                        style={settingsSelectStyle}
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
                        className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                        style={settingsSelectStyle}
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
                        className="mt-1 w-full rounded border px-3 py-2 text-[11px] outline-none"
                        style={settingsSelectStyle}
                      >
                        {explorerMenuFallbackBucketOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 rounded border px-3 py-3 text-[11px]" style={insetSurfaceStyle}>
                    <div className="font-semibold">Manual Fallback</div>
                    <p className="mt-2 opacity-50">
                      Dragging on the canvas is the primary workflow. These controls stay here as a slower keyboard-friendly fallback.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <OverlayActionButton
                        appearance={appearance}
                        size="compact"
                        tone="quiet"
                        onClick={() => moveContextMenuLayoutEntry(selectedContextMenuEntry.id, 'up')}
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
                        onClick={() => moveContextMenuLayoutEntry(selectedContextMenuEntry.id, 'down')}
                        disabled={selectedContextMenuSiblingIndex < 0 || selectedContextMenuSiblingIndex >= selectedContextMenuSiblingEntriesCount - 1}
                        className="gap-1"
                      >
                        <ArrowDown size={11} />
                        Nudge Down
                      </OverlayActionButton>
                      <OverlayActionButton
                        appearance={appearance}
                        size="compact"
                        tone="danger"
                        onClick={() => removeContextMenuLayoutEntry(selectedContextMenuEntry.id)}
                        className="gap-1"
                      >
                        Remove
                      </OverlayActionButton>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SettingsSectionBlock>
    </section>
  );
}
