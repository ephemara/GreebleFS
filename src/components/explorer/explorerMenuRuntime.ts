import {
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  normalizePluginContextMenuContributions,
  resolveExplorerCommandDefinitionById,
  sortExplorerMenuLayoutEntries,
  type ExplorerBuiltInContextMenuActionId,
  type ExplorerCommandDefinition,
  type ExplorerContextMenuItemGroup,
  type ExplorerMenuContextKind,
  type ExplorerMenuContextLayout,
  type ExplorerMenuContextLayoutOverrideMap,
  type ExplorerMenuInputModality,
  type ExplorerMenuInvocationContext,
  type ExplorerMenuInvocationEntry,
  type ExplorerMenuLayoutEntry,
  type ExplorerMenuRendererKind,
  type ExplorerMenuTone,
  type ExplorerResolvedMenuCommandNode,
  type ExplorerResolvedMenuNode,
  type ExplorerResolvedMenuSeparatorNode,
  type ExplorerResolvedMenuSubmenuNode,
  type ExplorerResolvedPluginContextMenuContribution,
} from '../../config/explorerContextMenu';
import {
  DEFAULT_EXPLORER_MENU_PACK_ID,
  createBuiltInExplorerMenuPack,
  type LoadedExplorerMenuPack,
} from '../../config/menuPacks';
import type { OverlayPluginContextMenuContribution } from '../../config/pluginContributions';

export interface ExplorerRuntimeMenuCommandNode
  extends ExplorerResolvedMenuCommandNode {
  onSelect: () => void | Promise<void>;
}

export interface ExplorerRuntimeMenuSubmenuNode
  extends Omit<ExplorerResolvedMenuSubmenuNode, 'children'> {
  children: ExplorerRuntimeMenuNode[];
}

export interface ExplorerRuntimeMenuSeparatorNode
  extends ExplorerResolvedMenuSeparatorNode {
  onSelect?: undefined;
}

export type ExplorerRuntimeMenuNode =
  | ExplorerRuntimeMenuCommandNode
  | ExplorerRuntimeMenuSubmenuNode
  | ExplorerRuntimeMenuSeparatorNode;

export interface ExplorerRuntimeMenuPresentation {
  renderer: ExplorerMenuRendererKind;
  fallbackRenderer: ExplorerMenuRendererKind;
}

export interface ExplorerMenuRuntimeActionContext {
  invocation: ExplorerMenuInvocationContext;
  targetEntries: ExplorerMenuInvocationEntry[];
  primaryEntry: ExplorerMenuInvocationEntry | null;
}

export interface ExplorerMenuRuntimeEnvironment {
  currentPath: string;
  currentPathIsCloud: boolean;
  currentPathIsHome: boolean;
  currentLocationSupportsMutation: boolean;
  currentPathIsArchiveVirtual: boolean;
  userHomePath: string;
  runtimePlatform: 'windows' | 'macos' | 'linux';
  clipboardAvailable: boolean;
  canCreateDirectory: boolean;
  canCreateFile: boolean;
  revealPathLabel: string;
  propertiesLabel: string;
  supportsNativeOpenWith: boolean;
  supportsNativeProperties: boolean;
  supportsNativeIntegration: (path: string) => boolean;
  isCloudExplorerPath: (path: string) => boolean;
  isExplorerArchiveVirtualPath: (path: string) => boolean;
  isSemanticSearchTextLikeExtension: (extension: string) => boolean;
  isExplorerArchiveEntry: (entry: ExplorerMenuInvocationEntry) => boolean;
  isBookmarked: (path: string) => boolean;
  canRunAudioBatch: (entries: ExplorerMenuInvocationEntry[]) => boolean;
  openEntry: (entry: ExplorerMenuInvocationEntry) => void | Promise<void>;
  openWithSystemPicker: (path: string) => Promise<void>;
  openAsAdmin: (path: string) => Promise<void>;
  openInTerminal: (path: string) => void | Promise<void>;
  openInFilesystemAquarium: (path: string) => void | Promise<void>;
  revealExplorerPath: (path: string) => Promise<void>;
  openExplorerPropertiesPanel: (paths: string[]) => void;
  copyToSysClipboard: (text: string) => void | Promise<void>;
  queueClipboard: (
    action: 'copy' | 'cut',
    entries: ExplorerMenuInvocationEntry[],
  ) => void;
  requestTransferDestination: (
    operation: 'copy' | 'move',
    entries: ExplorerMenuInvocationEntry[],
  ) => void;
  extractArchive: (
    entry: ExplorerMenuInvocationEntry,
    mode: 'extractHere' | 'extractToDirectory' | 'extractToNewFolder',
  ) => void | Promise<void>;
  duplicateEntries: (entries: ExplorerMenuInvocationEntry[]) => void | Promise<void>;
  findSimilar: (path: string) => void | Promise<void>;
  startRename: (entry: ExplorerMenuInvocationEntry) => void;
  openTagDialog: (
    paths: string[],
    mode: 'add' | 'remove',
    options?: {
      description?: string;
      title?: string;
    },
  ) => void;
  toggleBookmark: (entry: ExplorerMenuInvocationEntry) => void;
  openTrashDialog: (entries: ExplorerMenuInvocationEntry[]) => void;
  openNew: (kind: 'file' | 'folder') => void;
  paste: () => void | Promise<void>;
  refresh: () => void | Promise<void>;
  navigate: (path: string) => void | Promise<void>;
  openSettingsSection: (section: string) => void;
  runAudioBatch: (
    mode: 'convert' | 'normalize',
    entries: ExplorerMenuInvocationEntry[],
  ) => void | Promise<void>;
  executePluginCommand: (
    command: ExplorerResolvedPluginContextMenuContribution,
    entry: ExplorerMenuInvocationEntry,
  ) => Promise<void>;
  onError: (message: string) => void;
}

export interface BuildExplorerRuntimeMenuOptions {
  invocation: ExplorerMenuInvocationContext;
  menuPacks: LoadedExplorerMenuPack[];
  activeMenuPackId: string | null;
  layoutOverridesByContext: ExplorerMenuContextLayoutOverrideMap;
  themeRendererPreference?: ExplorerMenuRendererKind;
  pluginContextMenuItems: OverlayPluginContextMenuContribution[];
  environment: ExplorerMenuRuntimeEnvironment;
}

function getActionEntries(
  invocation: ExplorerMenuInvocationContext,
): ExplorerMenuInvocationEntry[] {
  if (invocation.kind === 'background') {
    return [];
  }

  if (invocation.kind === 'multi-select') {
    return invocation.selectedEntries;
  }

  if (invocation.primaryEntry) {
    if (
      invocation.selectedEntries.length > 1 &&
      invocation.selectedEntries.some(
        (entry) => entry.path === invocation.primaryEntry?.path,
      )
    ) {
      return invocation.selectedEntries;
    }
    return [invocation.primaryEntry];
  }

  if (invocation.previewTarget) {
    return [invocation.previewTarget];
  }

  return invocation.selectedEntries;
}

function isCommandApplicableToSelection(
  command: ExplorerCommandDefinition,
  targetEntries: ExplorerMenuInvocationEntry[],
): boolean {
  if (command.appliesTo === 'any') {
    return true;
  }
  if (targetEntries.length === 0) {
    return false;
  }

  if (command.appliesTo === 'file') {
    return targetEntries.every((entry) => !entry.isDirectory);
  }

  return targetEntries.every((entry) => entry.isDirectory);
}

function resolveCurrentPathEntry(
  environment: ExplorerMenuRuntimeEnvironment,
): ExplorerMenuInvocationEntry {
  const segments = environment.currentPath.split(/[/\\]/).filter(Boolean);
  const name = segments[segments.length - 1] ?? environment.currentPath;
  const parentPath = environment.currentPath.replace(/[/\\][^/\\]+$/, '');
  return {
    path: environment.currentPath,
    name,
    parentPath,
    extension: '',
    stem: name,
    isDirectory: true,
  };
}

function getPrimaryActionEntry(
  invocation: ExplorerMenuInvocationContext,
  environment: ExplorerMenuRuntimeEnvironment,
  targetEntries: ExplorerMenuInvocationEntry[],
): ExplorerMenuInvocationEntry | null {
  if (targetEntries.length > 0) {
    return targetEntries[0];
  }
  if (invocation.primaryEntry) {
    return invocation.primaryEntry;
  }
  if (invocation.previewTarget) {
    return invocation.previewTarget;
  }
  if (invocation.kind === 'background') {
    return resolveCurrentPathEntry(environment);
  }
  return null;
}

function sanitizeNodeList(
  nodes: ExplorerRuntimeMenuNode[],
): ExplorerRuntimeMenuNode[] {
  const filtered = nodes.filter((node) => {
    if (node.kind === 'submenu') {
      return node.children.length > 0;
    }
    return true;
  });

  const trimmedLeading = [...filtered];
  while (trimmedLeading[0]?.kind === 'separator') {
    trimmedLeading.shift();
  }
  while (trimmedLeading[trimmedLeading.length - 1]?.kind === 'separator') {
    trimmedLeading.pop();
  }

  return trimmedLeading.filter((node, index) => {
    const previous = trimmedLeading[index - 1];
    return !(node.kind === 'separator' && previous?.kind === 'separator');
  });
}

function resolvePresentationRenderer(
  menuPack: LoadedExplorerMenuPack,
  invocation: ExplorerMenuInvocationContext,
  themeRendererPreference?: ExplorerMenuRendererKind,
): ExplorerRuntimeMenuPresentation {
  const presentation = menuPack.presentation;
  const capabilityRules = presentation.capabilityRules ?? [];
  const matchingRule = capabilityRules.find((rule) => {
    if (rule.when === 'reduced-motion') {
      return invocation.reducedMotion;
    }
    return rule.when === invocation.inputModality;
  });

  return {
    renderer:
      matchingRule?.renderer ??
      themeRendererPreference ??
      presentation.renderer ??
      'classic',
    fallbackRenderer: presentation.fallbackRenderer ?? 'classic',
  };
}

function createDynamicAudioCommands(
  invocation: ExplorerMenuInvocationContext,
  environment: ExplorerMenuRuntimeEnvironment,
): ExplorerCommandDefinition[] {
  const targetEntries = getActionEntries(invocation);
  if (!environment.canRunAudioBatch(targetEntries)) {
    return [];
  }

  const shared = {
    contexts: ['entry', 'multi-select', 'search-result', 'preview-pane'] as ExplorerMenuContextKind[],
    appliesTo: 'any' as const,
    group: 'library' as const,
    source: 'built-in' as const,
    behavior: 'leaf' as const,
    supportsQuickSlot: false,
  };

  return [
    {
      ...shared,
      id: 'built-in.audio-batch-convert',
      title: 'Batch Convert Audio',
      defaultOrder: 336,
      priority: 336,
      iconName: 'Waves',
      tone: 'accent',
      execution: { kind: 'built-in', actionId: 'refresh' as ExplorerBuiltInContextMenuActionId },
    },
    {
      ...shared,
      id: 'built-in.audio-batch-normalize',
      title: 'Batch Normalize Audio',
      defaultOrder: 337,
      priority: 337,
      iconName: 'Sparkles',
      tone: 'accent',
      execution: { kind: 'built-in', actionId: 'refresh' as ExplorerBuiltInContextMenuActionId },
    },
  ];
}

function canShowBuiltInCommand(
  command: ExplorerCommandDefinition,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
): boolean {
  if (!command.contexts.includes(invocation.kind)) {
    return false;
  }
  if (!isCommandApplicableToSelection(command, targetEntries)) {
    return false;
  }

  if (command.source === 'plugin') {
    return true;
  }

  const actionId = command.execution.actionId;
  const currentPathEntry = resolveCurrentPathEntry(environment);
  const entry = primaryEntry ?? currentPathEntry;
  const entryPath = entry.path;

  switch (actionId) {
    case 'open':
      return targetEntries.length > 0;
    case 'open-with':
      return environment.supportsNativeOpenWith
        && environment.supportsNativeIntegration(entryPath);
    case 'open-admin':
      return environment.supportsNativeIntegration(entryPath)
        && !environment.isExplorerArchiveVirtualPath(entryPath);
    case 'open-terminal':
      return entry.isDirectory
        && !environment.isCloudExplorerPath(entryPath)
        && !environment.isExplorerArchiveVirtualPath(entryPath);
    case 'open-aquarium':
      return !environment.isCloudExplorerPath(entryPath);
    case 'reveal':
      if (invocation.kind === 'background') {
        return environment.supportsNativeIntegration(environment.currentPath);
      }
      return targetEntries.length > 0
        && targetEntries.every(
          (candidate) => environment.supportsNativeIntegration(candidate.path)
            && !environment.isExplorerArchiveVirtualPath(candidate.path),
        );
    case 'properties':
      return invocation.kind === 'background' ? Boolean(environment.currentPath) : targetEntries.length > 0;
    case 'copy-path':
      return targetEntries.length > 0;
    case 'new-folder':
      return invocation.kind === 'background'
        && environment.currentLocationSupportsMutation
        && environment.canCreateDirectory;
    case 'new-file':
      return invocation.kind === 'background'
        && environment.currentLocationSupportsMutation
        && environment.canCreateFile;
    case 'paste':
      return invocation.kind === 'background'
        && environment.currentLocationSupportsMutation
        && environment.clipboardAvailable;
    case 'copy':
    case 'cut':
    case 'copy-to':
    case 'move-to':
      return targetEntries.length > 0 && environment.currentLocationSupportsMutation;
    case 'extract-here':
    case 'extract-to':
    case 'extract-new-folder':
      return Boolean(primaryEntry && environment.isExplorerArchiveEntry(primaryEntry));
    case 'duplicate':
      return targetEntries.length > 0 && environment.currentLocationSupportsMutation;
    case 'find-similar':
      return targetEntries.length === 1
        && !primaryEntry?.isDirectory
        && !environment.currentPathIsCloud
        && environment.isSemanticSearchTextLikeExtension(primaryEntry.extension);
    case 'rename':
      return targetEntries.length === 1 && environment.currentLocationSupportsMutation;
    case 'add-tags':
    case 'remove-tags':
      return targetEntries.length > 0 && environment.currentLocationSupportsMutation;
    case 'bookmark-toggle':
      return targetEntries.length === 1;
    case 'move-trash':
      return targetEntries.length > 0 && environment.currentLocationSupportsMutation;
    case 'refresh':
      return true;
    default:
      return true;
  }
}

function executeBuiltInLeaf(
  actionId: ExplorerBuiltInContextMenuActionId,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
): () => void | Promise<void> {
  const currentPathEntry = resolveCurrentPathEntry(environment);
  const entry = primaryEntry ?? currentPathEntry;
  const targetPaths = targetEntries.map((candidate) => candidate.path);

  switch (actionId) {
    case 'open':
      return () => {
        if (primaryEntry) {
          return environment.openEntry(primaryEntry);
        }
      };
    case 'open-admin':
      return () => environment.openAsAdmin(entry.path);
    case 'open-terminal':
      return () => environment.openInTerminal(entry.path);
    case 'open-aquarium':
      return () =>
        environment.openInFilesystemAquarium(
          entry.isDirectory ? entry.path : entry.parentPath || environment.currentPath,
        );
    case 'reveal':
      return () =>
        environment.revealExplorerPath(
          invocation.kind === 'background' ? environment.currentPath : entry.path,
        );
    case 'properties':
      return () =>
        environment.openExplorerPropertiesPanel(
          invocation.kind === 'background'
            ? [environment.currentPath]
            : targetPaths.length > 0
              ? targetPaths
              : [entry.path],
        );
    case 'copy-path':
      return () => environment.copyToSysClipboard(targetPaths.join('\n'));
    case 'new-folder':
      return () => environment.openNew('folder');
    case 'new-file':
      return () => environment.openNew('file');
    case 'paste':
      return () => environment.paste();
    case 'copy':
      return () => environment.queueClipboard('copy', targetEntries);
    case 'cut':
      return () => environment.queueClipboard('cut', targetEntries);
    case 'copy-to':
      return () => environment.requestTransferDestination('copy', targetEntries);
    case 'move-to':
      return () => environment.requestTransferDestination('move', targetEntries);
    case 'extract-here':
      return () => primaryEntry && environment.extractArchive(primaryEntry, 'extractHere');
    case 'extract-to':
      return () => primaryEntry && environment.extractArchive(primaryEntry, 'extractToDirectory');
    case 'extract-new-folder':
      return () => primaryEntry && environment.extractArchive(primaryEntry, 'extractToNewFolder');
    case 'duplicate':
      return () => environment.duplicateEntries(targetEntries);
    case 'find-similar':
      return () => primaryEntry && environment.findSimilar(primaryEntry.path);
    case 'rename':
      return () => primaryEntry && environment.startRename(primaryEntry);
    case 'add-tags':
      return () =>
        environment.openTagDialog(targetPaths, 'add', {
          description:
            targetEntries.length === 1
              ? `Enter comma-separated tags to add to ${targetEntries[0]?.name ?? 'the selected item'}.`
              : `Enter comma-separated tags to add to ${targetEntries.length} selected items.`,
        });
    case 'remove-tags':
      return () =>
        environment.openTagDialog(targetPaths, 'remove', {
          description:
            targetEntries.length === 1
              ? `Enter comma-separated tags to remove from ${targetEntries[0]?.name ?? 'the selected item'}.`
              : `Enter comma-separated tags to remove from ${targetEntries.length} selected items.`,
        });
    case 'bookmark-toggle':
      return () => primaryEntry && environment.toggleBookmark(primaryEntry);
    case 'move-trash':
      return () => environment.openTrashDialog(targetEntries);
    case 'refresh':
      return () => environment.refresh();
    case 'open-with':
    default:
      return () => undefined;
  }
}

function resolveBuiltInLabel(
  command: ExplorerCommandDefinition,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
): string {
  if (command.source === 'plugin') {
    return command.title;
  }

  const actionId = command.execution.actionId;
  switch (actionId) {
    case 'reveal':
      return environment.revealPathLabel;
    case 'properties':
      return environment.propertiesLabel;
    case 'copy-path':
      return targetEntries.length > 1 ? 'Copy Paths' : 'Copy Path';
    case 'copy':
      return targetEntries.length > 1 ? 'Copy Selected' : 'Copy';
    case 'cut':
      return targetEntries.length > 1 ? 'Cut Selected' : 'Cut';
    case 'copy-to':
      return targetEntries.length > 1 ? 'Copy Selected To…' : 'Copy To…';
    case 'move-to':
      return targetEntries.length > 1 ? 'Move Selected To…' : 'Move To…';
    case 'move-trash':
      return targetEntries.length > 1 ? 'Move Selected to Trash' : 'Move to Trash';
    case 'open-admin':
      return primaryEntry?.isDirectory || invocation.kind === 'background'
        ? 'Open Folder as Admin'
        : 'Open as Admin';
    case 'open-aquarium':
      return primaryEntry && !primaryEntry.isDirectory
        ? 'Open Parent Habitat in Filesystem Aquarium'
        : 'Open Habitat in Filesystem Aquarium';
    default:
      return command.title;
  }
}

function createRuntimeLeafNode(
  command: ExplorerCommandDefinition,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  depth: number,
): ExplorerRuntimeMenuCommandNode | null {
  if (!canShowBuiltInCommand(command, invocation, targetEntries, primaryEntry, environment)) {
    return null;
  }

  if (
    command.id === 'built-in.audio-batch-convert' ||
    command.id === 'built-in.audio-batch-normalize'
  ) {
    return {
      kind: 'command',
      id: command.id,
      commandId: command.id,
      label: command.title,
      description: command.description,
      depth,
      iconName: command.iconName,
      tone: command.tone,
      source: command.source,
      quickSlot: 'none',
      fallbackBucket: 'default',
      disabled: false,
      shortcutId: command.shortcutId,
      command,
      onSelect: () =>
        environment.runAudioBatch(
          command.id === 'built-in.audio-batch-convert' ? 'convert' : 'normalize',
          targetEntries,
        ),
    };
  }

  if (command.source === 'plugin') {
    if (!primaryEntry) {
      return null;
    }

    return {
      kind: 'command',
      id: command.id,
      commandId: command.id,
      label: command.title,
      description: command.description,
      depth,
      iconName: command.iconName,
      tone: command.tone,
      source: command.source,
      quickSlot: 'none',
      fallbackBucket: 'default',
      disabled: false,
      shortcutId: command.shortcutId,
      command,
      onSelect: () =>
        environment.executePluginCommand(
          command as ExplorerResolvedPluginContextMenuContribution,
          primaryEntry,
        ),
    };
  }

  return {
    kind: 'command',
    id: command.id,
    commandId: command.id,
    label: resolveBuiltInLabel(command, invocation, targetEntries, primaryEntry, environment),
    description: command.description,
    depth,
    iconName: command.iconName,
    tone: command.tone,
    source: command.source,
    quickSlot: 'none',
    fallbackBucket: 'default',
    disabled: false,
    shortcutId: command.shortcutId,
    command,
    onSelect: executeBuiltInLeaf(
      command.execution.actionId,
      invocation,
      targetEntries,
      primaryEntry,
      environment,
    ),
  };
}

function createResolverChildren(
  command: ExplorerCommandDefinition,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  depth: number,
): ExplorerRuntimeMenuNode[] {
  if (command.source !== 'built-in') {
    return [];
  }

  switch (command.execution.actionId) {
    case 'open-with': {
      const entry = primaryEntry ?? resolveCurrentPathEntry(environment);
      return [
        {
          kind: 'command',
          id: `${command.id}.system-picker`,
          commandId: command.id,
          label: 'System Picker…',
          description: 'Use the operating system app chooser.',
          depth,
          iconName: command.iconName,
          tone: 'safe',
          source: 'layout',
          quickSlot: 'none',
          fallbackBucket: 'default',
          disabled: false,
          shortcutId: undefined,
          command,
          onSelect: () => environment.openWithSystemPicker(entry.path),
        },
      ];
    }
    default:
      return [];
  }
}

function createRuntimeNodeForCommand(
  command: ExplorerCommandDefinition,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  depth: number,
): ExplorerRuntimeMenuNode | null {
  if (command.behavior === 'resolver') {
    if (!canShowBuiltInCommand(command, invocation, targetEntries, primaryEntry, environment)) {
      return null;
    }
    const children = sanitizeNodeList(
      createResolverChildren(
        command,
        invocation,
        targetEntries,
        primaryEntry,
        environment,
        depth + 1,
      ),
    );
    if (children.length === 0) {
      return null;
    }
    return {
      kind: 'submenu',
      id: command.id,
      label: resolveBuiltInLabel(command, invocation, targetEntries, primaryEntry, environment),
      depth,
      iconName: command.iconName,
      tone: command.tone,
      source: command.source,
      quickSlot: 'none',
      fallbackBucket: 'default',
      children,
    };
  }

  return createRuntimeLeafNode(
    command,
    invocation,
    targetEntries,
    primaryEntry,
    environment,
    depth,
  );
}

function resolveLayoutEntriesForParent(
  entries: ExplorerMenuLayoutEntry[],
  parentEntryId: string | null,
): ExplorerMenuLayoutEntry[] {
  return sortExplorerMenuLayoutEntries(entries).filter(
    (entry) => entry.parentEntryId === parentEntryId && entry.enabled !== false,
  );
}

function matchesGroupSlot(
  command: ExplorerCommandDefinition,
  slot: Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>,
): boolean {
  if (command.group !== slot.group) {
    return false;
  }
  if (slot.sourceFilter === 'any') {
    return true;
  }
  return command.source === slot.sourceFilter;
}

function buildNodesForLayout(
  layout: ExplorerMenuContextLayout,
  commandRegistry: ExplorerCommandDefinition[],
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  parentEntryId: string | null,
  depth: number,
  handledCommandIds: Set<string>,
): ExplorerRuntimeMenuNode[] {
  const children = resolveLayoutEntriesForParent(layout.entries, parentEntryId);
  const nodes: ExplorerRuntimeMenuNode[] = [];

  children.forEach((entry) => {
    if (entry.kind === 'separator') {
      nodes.push({
        kind: 'separator',
        id: entry.id,
        label: '',
        depth,
        tone: 'muted',
        source: 'layout',
        quickSlot: entry.quickSlot ?? 'none',
        fallbackBucket: entry.fallbackBucket ?? 'default',
      });
      return;
    }

    if (entry.kind === 'submenu') {
      const submenuChildren = sanitizeNodeList(
        buildNodesForLayout(
          layout,
          commandRegistry,
          invocation,
          targetEntries,
          primaryEntry,
          environment,
          entry.id,
          depth + 1,
          handledCommandIds,
        ),
      );
      if (submenuChildren.length === 0) {
        return;
      }
      nodes.push({
        kind: 'submenu',
        id: entry.id,
        label: entry.title,
        depth,
        iconName: entry.iconName,
        tone: 'safe',
        source: 'layout',
        quickSlot: entry.quickSlot ?? 'none',
        fallbackBucket: entry.fallbackBucket ?? 'default',
        children: submenuChildren,
      });
      return;
    }

    if (entry.kind === 'group-slot') {
      const matchingCommands = commandRegistry
        .filter((command) => !handledCommandIds.has(command.id))
        .filter((command) => matchesGroupSlot(command, entry))
        .sort((left, right) => left.priority - right.priority);
      matchingCommands.forEach((command) => {
        const node = createRuntimeNodeForCommand(
          command,
          invocation,
          targetEntries,
          primaryEntry,
          environment,
          depth,
        );
        if (!node) {
          return;
        }
        handledCommandIds.add(command.id);
        if (node.kind === 'command') {
          node.quickSlot = entry.quickSlot ?? 'none';
          node.fallbackBucket = entry.fallbackBucket ?? 'default';
        }
        nodes.push(node);
      });
      return;
    }

    const command = resolveExplorerCommandDefinitionById(
      entry.commandId,
      commandRegistry.filter(
        (candidate): candidate is ExplorerResolvedPluginContextMenuContribution =>
          candidate.source === 'plugin',
      ),
    );
    if (!command) {
      return;
    }
    const node = createRuntimeNodeForCommand(
      command,
      invocation,
      targetEntries,
      primaryEntry,
      environment,
      depth,
    );
    if (!node) {
      return;
    }
    handledCommandIds.add(command.id);
    if (node.kind === 'command') {
      node.quickSlot = entry.quickSlot ?? 'none';
      node.fallbackBucket = entry.fallbackBucket ?? 'default';
    }
    nodes.push(node);
  });

  return sanitizeNodeList(nodes);
}

function resolveActiveMenuPack(
  menuPacks: LoadedExplorerMenuPack[],
  activeMenuPackId: string | null,
): LoadedExplorerMenuPack {
  const builtInPack = menuPacks.find((pack) => pack.id === DEFAULT_EXPLORER_MENU_PACK_ID)
    ?? createBuiltInExplorerMenuPack();
  if (!activeMenuPackId) {
    return builtInPack;
  }

  return menuPacks.find((pack) => pack.id === activeMenuPackId) ?? builtInPack;
}

function getLayoutForContext(
  menuPack: LoadedExplorerMenuPack,
  overridesByContext: ExplorerMenuContextLayoutOverrideMap,
  contextKind: ExplorerMenuContextKind,
): ExplorerMenuContextLayout {
  return overridesByContext[contextKind]
    ?? menuPack.contexts[contextKind]
    ?? {
      renderer: 'classic',
      entries: [],
    };
}

export function buildExplorerRuntimeMenu(
  options: BuildExplorerRuntimeMenuOptions,
): {
  menuPack: LoadedExplorerMenuPack;
  presentation: ExplorerRuntimeMenuPresentation;
  nodes: ExplorerRuntimeMenuNode[];
  targetEntries: ExplorerMenuInvocationEntry[];
  primaryEntry: ExplorerMenuInvocationEntry | null;
} {
  const pluginCommands = normalizePluginContextMenuContributions(
    options.pluginContextMenuItems,
  );
  const menuPack = resolveActiveMenuPack(options.menuPacks, options.activeMenuPackId);
  const targetEntries = getActionEntries(options.invocation);
  const primaryEntry = getPrimaryActionEntry(
    options.invocation,
    options.environment,
    targetEntries,
  );
  const dynamicCommands = createDynamicAudioCommands(
    options.invocation,
    options.environment,
  );
  const commandRegistry: ExplorerCommandDefinition[] = [
    ...BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
    ...dynamicCommands,
    ...pluginCommands,
  ];
  const layout = getLayoutForContext(
    menuPack,
    options.layoutOverridesByContext,
    options.invocation.kind,
  );
  const handledCommandIds = new Set<string>();
  const nodes = buildNodesForLayout(
    layout,
    commandRegistry,
    options.invocation,
    targetEntries,
    primaryEntry,
    options.environment,
    null,
    0,
    handledCommandIds,
  );

  return {
    menuPack,
    presentation: resolvePresentationRenderer(
      menuPack,
      options.invocation,
      options.themeRendererPreference,
    ),
    nodes,
    targetEntries,
    primaryEntry,
  };
}

export function resolveMenuInvocationInputModality(
  event: Pick<PointerEvent, 'pointerType'> | null | undefined,
): ExplorerMenuInputModality {
  if (!event) {
    return 'mouse';
  }
  if (event.pointerType === 'touch') {
    return 'touch';
  }
  if (event.pointerType === 'pen') {
    return 'pen';
  }
  return 'mouse';
}
