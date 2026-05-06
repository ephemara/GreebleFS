import {
  BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
  normalizeExplorerActionContributions,
  normalizePluginContextMenuContributions,
  sortExplorerMenuLayoutEntries,
  type ExplorerBuiltInContextMenuActionId,
  type ExplorerCommandDefinition,
  type ExplorerMenuContextKind,
  type ExplorerMenuContextLayout,
  type ExplorerMenuContextLayoutOverrideMap,
  type ExplorerMenuInputModality,
  type ExplorerMenuInvocationContext,
  type ExplorerMenuInvocationEntry,
  type ExplorerMenuLayoutEntry,
  type ExplorerMenuRendererKind,
  type ExplorerPreviewContextMenuCatalogItem,
  type ExplorerResolvedActionContextMenuContribution,
  type ExplorerResolvedMenuCommandNode,
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
import type { LoadedExplorerAction } from '../../config/actionPacks';
import type {
  ExplorerAssociatedProgram,
  ExplorerAssociatedProgramsCatalog,
  ExplorerShellContextMenuInvokeRequest,
  ExplorerShellContextMenuItem,
  ExplorerShellContextMenuRequest,
} from '../../runtime/explorerBackend';
import type { OverlayContextMenuPresentationOptions } from './overlayContextMenuModel';
import {
  resolveExplorerPreviewContextMenuActions,
  type ExplorerPreviewContextMenuRegistration,
  type ExplorerResolvedPreviewContextMenuAction,
} from './explorerPreviewContextMenu';

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

export interface ExplorerRuntimeMenuPresentation
  extends OverlayContextMenuPresentationOptions {
  renderer: ExplorerMenuRendererKind;
  fallbackRenderer: ExplorerMenuRendererKind;
  density: 'compact' | 'balanced' | 'touch';
  showDescriptions: boolean;
}

export interface ExplorerOpenWithProgramsState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: ExplorerAssociatedProgramsCatalog | null;
  error: string | null;
  requestId: number | null;
  requestedAtEpochMs: number | null;
}

export interface ExplorerWindowsShellContextMenuState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: ExplorerShellContextMenuItem[] | null;
  error: string | null;
  requestId: number | null;
  requestedAtEpochMs: number | null;
}

export interface ExplorerResolvedWindowsShellContextMenuRequest {
  request: ExplorerShellContextMenuRequest;
  requestKey: string;
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
  supportsOpenWithSystemPicker: boolean;
  supportsNativeProperties: boolean;
  openWithProgramsByPath: Record<string, ExplorerOpenWithProgramsState | undefined>;
  windowsShellContextMenusByRequestKey: Record<
    string,
    ExplorerWindowsShellContextMenuState | undefined
  >;
  supportsNativeIntegration: (path: string) => boolean;
  isCloudExplorerPath: (path: string) => boolean;
  isExplorerArchiveVirtualPath: (path: string) => boolean;
  isSemanticSearchTextLikeExtension: (extension: string) => boolean;
  isExplorerArchiveEntry: (entry: ExplorerMenuInvocationEntry) => boolean;
  isBookmarked: (path: string) => boolean;
  canRunAudioBatch: (entries: ExplorerMenuInvocationEntry[]) => boolean;
  openEntry: (entry: ExplorerMenuInvocationEntry) => void | Promise<void>;
  openWithSystemPicker: (path: string) => Promise<void>;
  openWithProgram: (
    path: string,
    programPath: string,
    launchArguments?: string[],
  ) => Promise<void>;
  invokeWindowsShellContextMenuItem: (
    request: ExplorerShellContextMenuInvokeRequest,
  ) => Promise<void>;
  openAsAdmin: (path: string) => Promise<void>;
  openInTerminal: (path: string) => void | Promise<void>;
  openInFilesystemAquarium: (path: string) => void | Promise<void>;
  sendToMobileDownload: (
    entry: ExplorerMenuInvocationEntry,
  ) => void | Promise<void>;
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
  openContextMenuComposer: (context: ExplorerMenuContextKind) => void;
  runAudioBatch: (
    mode: 'convert' | 'normalize',
    entries: ExplorerMenuInvocationEntry[],
  ) => void | Promise<void>;
  executeActionCommand: (
    command: ExplorerResolvedActionContextMenuContribution,
    context: ExplorerMenuRuntimeActionContext,
  ) => Promise<void>;
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
  themePresentationPreference?: OverlayContextMenuPresentationOptions;
  actions: LoadedExplorerAction[];
  pluginContextMenuItems: OverlayPluginContextMenuContribution[];
  previewContextMenuRegistration?: ExplorerPreviewContextMenuRegistration | null;
  includeEditMenuCommand?: boolean;
  environment: ExplorerMenuRuntimeEnvironment;
}

interface ExplorerRuntimePreviewContextMenuCatalogItem
  extends ExplorerPreviewContextMenuCatalogItem {
  execution: {
    kind: 'preview';
    onSelect: ExplorerResolvedPreviewContextMenuAction['onSelect'];
  };
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

function createDisabledResolverNode(
  id: string,
  label: string,
  description: string | undefined,
  command: ExplorerCommandDefinition,
  depth: number,
): ExplorerRuntimeMenuCommandNode {
  return {
    kind: 'command',
    id,
    commandId: command.id,
    label,
    description,
    depth,
    iconName: command.iconName,
    tone: 'safe',
    source: 'layout',
    quickSlot: 'none',
    fallbackBucket: 'default',
    disabled: true,
    shortcutId: undefined,
    command,
    onSelect: () => undefined,
  };
}

function resolveOpenWithProgramLaunchId(
  program: ExplorerAssociatedProgram,
): string {
  return (program.launchId?.trim() || program.path).trim();
}

function resolveOpenWithProgramDedupeKey(
  program: ExplorerAssociatedProgram,
): string {
  return [
    program.launchKind ?? 'path',
    resolveOpenWithProgramLaunchId(program),
    program.executablePath ?? '',
    program.name,
  ]
    .join('\u0000')
    .toLowerCase();
}

function createOpenWithProgramNode(
  command: ExplorerCommandDefinition,
  entryPath: string,
  program: ExplorerAssociatedProgram,
  depth: number,
  environment: ExplorerMenuRuntimeEnvironment,
  labelOverride?: string,
  descriptionOverride?: string,
): ExplorerRuntimeMenuCommandNode {
  const launchId = resolveOpenWithProgramLaunchId(program);
  return {
    kind: 'command',
    id: `${command.id}.program.${launchId}`,
    commandId: command.id,
    label: labelOverride ?? program.name,
    description: descriptionOverride,
    depth,
    iconName: command.iconName,
    tone: 'safe',
    source: 'layout',
    quickSlot: 'none',
    fallbackBucket: 'default',
    disabled: false,
    shortcutId: undefined,
    command,
    onSelect: () => environment.openWithProgram(entryPath, launchId, []),
  };
}

function dedupeOpenWithPrograms(
  programs: ExplorerAssociatedProgram[],
  seenProgramKeys: Set<string>,
): ExplorerAssociatedProgram[] {
  const deduped: ExplorerAssociatedProgram[] = [];

  for (const program of programs) {
    const programKey = resolveOpenWithProgramDedupeKey(program);
    if (seenProgramKeys.has(programKey)) {
      continue;
    }
    seenProgramKeys.add(programKey);
    deduped.push(program);
  }

  return deduped;
}

function buildExplorerWindowsShellContextMenuRequestKey(
  request: ExplorerShellContextMenuRequest,
): string {
  return [
    request.targetKind,
    request.currentDirectoryPath,
    ...request.targetPaths,
  ].join('\u0000');
}

function canResolveWindowsShellContextMenuPath(
  path: string,
  environment: ExplorerMenuRuntimeEnvironment,
): boolean {
  return (
    Boolean(path) &&
    environment.supportsNativeIntegration(path) &&
    !environment.isCloudExplorerPath(path) &&
    !environment.isExplorerArchiveVirtualPath(path)
  );
}

function resolveWindowsShellContextMenuCurrentDirectory(
  targetEntries: ExplorerMenuInvocationEntry[],
  environment: ExplorerMenuRuntimeEnvironment,
): string {
  const firstParentPath = targetEntries[0]?.parentPath?.trim() ?? '';
  if (
    firstParentPath &&
    targetEntries.every((entry) => entry.parentPath.trim() === firstParentPath)
  ) {
    return firstParentPath;
  }

  return environment.currentPath;
}

export function resolveExplorerWindowsShellContextMenuRequest(
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
): ExplorerResolvedWindowsShellContextMenuRequest | null {
  if (environment.runtimePlatform !== 'windows') {
    return null;
  }

  if (invocation.kind === 'background') {
    if (
      !canResolveWindowsShellContextMenuPath(environment.currentPath, environment)
    ) {
      return null;
    }

    const request: ExplorerShellContextMenuRequest = {
      targetKind: 'background',
      currentDirectoryPath: environment.currentPath,
      targetPaths: [],
    };

    return {
      request,
      requestKey: buildExplorerWindowsShellContextMenuRequestKey(request),
    };
  }

  const shellTargetEntries =
    targetEntries.length > 0
      ? targetEntries
      : primaryEntry
        ? [primaryEntry]
        : invocation.previewTarget
          ? [invocation.previewTarget]
          : [];

  if (shellTargetEntries.length === 0) {
    return null;
  }

  if (
    shellTargetEntries.some(
      (entry) => !canResolveWindowsShellContextMenuPath(entry.path, environment),
    )
  ) {
    return null;
  }

  const targetKind =
    shellTargetEntries.length > 1 || invocation.kind === 'multi-select'
      ? 'multiSelect'
      : 'entry';
  const request: ExplorerShellContextMenuRequest = {
    targetKind,
    currentDirectoryPath:
      targetKind === 'entry'
        ? shellTargetEntries[0]?.parentPath || environment.currentPath
        : resolveWindowsShellContextMenuCurrentDirectory(
            shellTargetEntries,
            environment,
          ),
    targetPaths: shellTargetEntries.map((entry) => entry.path),
  };

  return {
    request,
    requestKey: buildExplorerWindowsShellContextMenuRequestKey(request),
  };
}

export function resolveExplorerWindowsShellContextMenuRequestForInvocation(
  invocation: ExplorerMenuInvocationContext,
  environment: ExplorerMenuRuntimeEnvironment,
): ExplorerResolvedWindowsShellContextMenuRequest | null {
  const targetEntries = getActionEntries(invocation);
  const primaryEntry = getPrimaryActionEntry(
    invocation,
    environment,
    targetEntries,
  );

  return resolveExplorerWindowsShellContextMenuRequest(
    invocation,
    targetEntries,
    primaryEntry,
    environment,
  );
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
  layout: ExplorerMenuContextLayout,
  themeRendererPreference?: ExplorerMenuRendererKind,
  themePresentationPreference?: OverlayContextMenuPresentationOptions,
): ExplorerRuntimeMenuPresentation {
  const presentation = menuPack.presentation;
  const themePresentation = themePresentationPreference ?? {};
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
      themePresentation.renderer ??
      themeRendererPreference ??
      layout.renderer ??
      presentation.renderer ??
      'classic',
    fallbackRenderer:
      themePresentation.fallbackRenderer ??
      presentation.fallbackRenderer ??
      'classic',
    density: layout.density ?? themePresentation.density ?? presentation.density ?? 'balanced',
    showDescriptions: layout.showDescriptions ?? true,
    shapeLanguage: themePresentation.shapeLanguage ?? presentation.shapeLanguage,
    motionStyle: themePresentation.motionStyle ?? presentation.motionStyle,
    materialStyle: themePresentation.materialStyle ?? presentation.materialStyle,
    iconTreatment: themePresentation.iconTreatment ?? presentation.iconTreatment,
    submenuBehavior:
      themePresentation.submenuBehavior ?? presentation.submenuBehavior,
    focusStyle: themePresentation.focusStyle ?? presentation.focusStyle,
    backdropStyle: themePresentation.backdropStyle ?? presentation.backdropStyle,
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

function createPreviewContextMenuCommands(
  invocation: ExplorerMenuInvocationContext,
  registration: ExplorerPreviewContextMenuRegistration | null | undefined,
): ExplorerRuntimePreviewContextMenuCatalogItem[] {
  if (invocation.kind !== 'preview-pane' || !invocation.previewContext || !registration) {
    return [];
  }
  if (registration.previewKind !== invocation.previewContext.previewKind) {
    return [];
  }

  return resolveExplorerPreviewContextMenuActions(
    registration,
    invocation.previewContext.workflowTabId,
  ).map((action) => ({
    id: action.id,
    title: action.title,
    description: action.description,
    contexts: action.contexts,
    appliesTo: action.appliesTo,
    group: action.group,
    defaultOrder: action.defaultOrder,
    priority: action.priority,
    source: 'preview',
    iconName: action.iconName,
    tone: action.tone,
    shortcutId: action.shortcutId,
    supportsQuickSlot: false,
    behavior: 'leaf',
    execution: {
      kind: 'preview',
      onSelect: action.onSelect,
    },
  }));
}

function matchesActionSelectionRules(
  command: ExplorerResolvedActionContextMenuContribution,
  targetEntries: ExplorerMenuInvocationEntry[],
): boolean {
  const { selection } = command.execution.action;
  const count = targetEntries.length;
  if (selection.minCount != null && count < selection.minCount) {
    return false;
  }
  if (selection.maxCount != null && count > selection.maxCount) {
    return false;
  }

  if (count === 0) {
    return selection.minCount == null || selection.minCount === 0;
  }

  if (!selection.allowFiles && targetEntries.some((entry) => !entry.isDirectory)) {
    return false;
  }
  if (!selection.allowDirectories && targetEntries.some((entry) => entry.isDirectory)) {
    return false;
  }

  if (selection.extensions.length === 0) {
    return true;
  }

  return targetEntries.every((entry) => {
    if (entry.isDirectory) {
      return selection.allowDirectories;
    }
    return selection.extensions.includes(entry.extension.toLowerCase());
  });
}

function canShowCommand(
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

  if (command.source === 'plugin' || command.source === 'preview') {
    return true;
  }
  if (command.source === 'action') {
    return matchesActionSelectionRules(
      command as ExplorerResolvedActionContextMenuContribution,
      targetEntries,
    );
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
    case 'windows-shell-actions':
      return (
        resolveExplorerWindowsShellContextMenuRequest(
          invocation,
          targetEntries,
          primaryEntry,
          environment,
        ) != null
      );
    case 'open-admin':
      return environment.supportsNativeIntegration(entryPath)
        && !environment.isExplorerArchiveVirtualPath(entryPath);
    case 'open-terminal':
      return entry.isDirectory
        && !environment.isCloudExplorerPath(entryPath)
        && !environment.isExplorerArchiveVirtualPath(entryPath);
    case 'open-aquarium':
      return !environment.isCloudExplorerPath(entryPath);
    case 'edit-menu':
      return true;
    case 'send-to-mobile-download':
      return targetEntries.length === 1
        && !entry.isDirectory
        && !environment.isCloudExplorerPath(entryPath)
        && !environment.isExplorerArchiveVirtualPath(entryPath)
        && environment.supportsNativeIntegration(entryPath);
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
        && environment.isSemanticSearchTextLikeExtension(primaryEntry?.extension ?? '');
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
    case 'edit-menu':
      return () => environment.openContextMenuComposer(invocation.kind);
    case 'send-to-mobile-download':
      return () => environment.sendToMobileDownload(entry);
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
      return () => {
        if (primaryEntry) {
          return environment.extractArchive(primaryEntry, 'extractHere');
        }
      };
    case 'extract-to':
      return () => {
        if (primaryEntry) {
          return environment.extractArchive(primaryEntry, 'extractToDirectory');
        }
      };
    case 'extract-new-folder':
      return () => {
        if (primaryEntry) {
          return environment.extractArchive(primaryEntry, 'extractToNewFolder');
        }
      };
    case 'duplicate':
      return () => environment.duplicateEntries(targetEntries);
    case 'find-similar':
      return () => {
        if (primaryEntry) {
          return environment.findSimilar(primaryEntry.path);
        }
      };
    case 'rename':
      return () => {
        if (primaryEntry) {
          environment.startRename(primaryEntry);
        }
      };
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
      return () => {
        if (primaryEntry) {
          environment.toggleBookmark(primaryEntry);
        }
      };
    case 'move-trash':
      return () => environment.openTrashDialog(targetEntries);
    case 'refresh':
      return () => environment.refresh();
    case 'open-with':
    case 'windows-shell-actions':
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
  if (command.source !== 'built-in') {
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
    case 'edit-menu':
      return 'Edit Menu';
    case 'send-to-mobile-download':
      return 'Send to iPhone';
    case 'windows-shell-actions':
      return 'Windows Actions';
    default:
      return command.title;
  }
}

function appendEditMenuCommand(
  nodes: ExplorerRuntimeMenuNode[],
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
): ExplorerRuntimeMenuNode[] {
  const editCommand: ExplorerCommandDefinition = {
    id: 'built-in.edit-menu',
    title: 'Edit Menu',
    description:
      'Open the context-menu composer in Settings with this menu context selected.',
    contexts: ['entry', 'background', 'multi-select', 'search-result', 'preview-pane'],
    appliesTo: 'any',
    group: 'system',
    defaultOrder: 9998,
    priority: 9998,
    source: 'built-in',
    iconName: 'Sliders',
    tone: 'accent',
    shortcutId: undefined,
    themeHints: undefined,
    supportsQuickSlot: false,
    behavior: 'leaf',
    execution: {
      kind: 'built-in',
      actionId: 'edit-menu',
    },
  };

  const node = createRuntimeNodeForCommand(
    editCommand,
    invocation,
    targetEntries,
    primaryEntry,
    environment,
    0,
  );
  if (!node) {
    return nodes;
  }

  const nextNodes = [...nodes];
  if (nextNodes.length > 0 && nextNodes[nextNodes.length - 1]?.kind !== 'separator') {
    nextNodes.push(createFallbackSeparatorNode('edit-menu.separator'));
  }
  nextNodes.push(node);
  return sanitizeNodeList(nextNodes);
}

function createRuntimeLeafNode(
  command: ExplorerCommandDefinition,
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  depth: number,
): ExplorerRuntimeMenuCommandNode | null {
  if (!canShowCommand(command, invocation, targetEntries, primaryEntry, environment)) {
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

  if (command.source === 'action') {
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
        environment.executeActionCommand(command as ExplorerResolvedActionContextMenuContribution, {
          invocation,
          targetEntries,
          primaryEntry,
        }),
    };
  }

  if (command.source === 'preview') {
    const previewCommand = command as ExplorerRuntimePreviewContextMenuCatalogItem;
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
        previewCommand.execution.onSelect({
          invocation,
          targetEntries,
          primaryEntry,
        }),
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

function createWindowsShellContextMenuNodes(
  command: ExplorerCommandDefinition,
  request: ExplorerShellContextMenuRequest,
  items: ExplorerShellContextMenuItem[],
  depth: number,
  environment: ExplorerMenuRuntimeEnvironment,
  idPrefix: string,
): ExplorerRuntimeMenuNode[] {
  const nodes: ExplorerRuntimeMenuNode[] = [];

  items.forEach((item, index) => {
    const itemId = `${idPrefix}.${index}.${item.id || 'submenu'}`;
    const itemIcon = item.icon ?? command.iconName;
    const childItems = item.children ?? [];

    if (childItems.length > 0) {
      const children = sanitizeNodeList(
        createWindowsShellContextMenuNodes(
          command,
          request,
          childItems,
          depth + 1,
          environment,
          itemId,
        ),
      );
      if (children.length === 0) {
        return;
      }

      nodes.push({
        kind: 'submenu',
        id: itemId,
        label: item.name,
        depth,
        iconName: itemIcon,
        tone: 'safe',
        source: 'layout',
        quickSlot: 'none',
        fallbackBucket: 'default',
        children,
      });
      return;
    }

    if (item.id === 0) {
      return;
    }

    nodes.push({
      kind: 'command',
      id: itemId,
      commandId: command.id,
      label: item.name,
      description: item.verb
        ? `Windows shell action (${item.verb}).`
        : 'Imported from the Windows context menu.',
      depth,
      iconName: itemIcon,
      tone: 'safe',
      source: 'layout',
      quickSlot: 'none',
      fallbackBucket: 'default',
      disabled: false,
      shortcutId: undefined,
      command,
      onSelect: () =>
        environment.invokeWindowsShellContextMenuItem({
          menuRequest: request,
          commandId: item.id,
          commandVerb: item.verb ?? null,
        }),
    });
  });

  return nodes;
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
      const state = environment.openWithProgramsByPath[entry.path];
      const children: ExplorerRuntimeMenuNode[] = [];
      const seenProgramKeys = new Set<string>();
      const pushSeparatorIfNeeded = () => {
        const lastNode = children[children.length - 1];
        if (children.length > 0 && lastNode?.kind !== 'separator') {
          children.push({
            kind: 'separator',
            id: `${command.id}.separator.${children.length}`,
            label: '',
            depth,
            tone: 'muted',
            source: 'layout',
            quickSlot: 'none',
            fallbackBucket: 'default',
          });
        }
      };

      if (state?.status === 'ready' && state.catalog) {
        const { catalog } = state;
        if (catalog.defaultProgram) {
          const [defaultProgram] = dedupeOpenWithPrograms(
            [{ ...catalog.defaultProgram, isDefault: true }],
            seenProgramKeys,
          );
          if (defaultProgram) {
            children.push(
              createOpenWithProgramNode(
                command,
                entry.path,
                defaultProgram,
                depth,
                environment,
                `${defaultProgram.name} (Default)`,
                'Default application for this file type.',
              ),
            );
          }
        }

        const recommendedPrograms = dedupeOpenWithPrograms(
          catalog.recommendedPrograms,
          seenProgramKeys,
        );
        for (const program of recommendedPrograms) {
          children.push(
            createOpenWithProgramNode(
              command,
              entry.path,
              program,
              depth,
              environment,
            ),
          );
        }

        const otherPrograms = dedupeOpenWithPrograms(
          catalog.otherPrograms,
          seenProgramKeys,
        );
        if (otherPrograms.length > 0 && children.length > 0) {
          pushSeparatorIfNeeded();
        }
        for (const program of otherPrograms) {
          children.push(
            createOpenWithProgramNode(
              command,
              entry.path,
              program,
              depth,
              environment,
            ),
          );
        }
      } else if (state?.status === 'error') {
        children.push(
          createDisabledResolverNode(
            `${command.id}.error`,
            'Unable to Load Apps',
            state.error ?? 'The operating system did not return any compatible apps.',
            command,
            depth,
          ),
        );
      } else {
        children.push(
          createDisabledResolverNode(
            `${command.id}.loading`,
            'Loading Compatible Apps…',
            'Resolving applications that can open this item.',
            command,
            depth,
          ),
        );
      }

      if (children.length === 0) {
        children.push(
          createDisabledResolverNode(
            `${command.id}.empty`,
            'No Compatible Apps Found',
            'No associated applications were reported for this item.',
            command,
            depth,
          ),
        );
      }

      if (environment.supportsOpenWithSystemPicker) {
        pushSeparatorIfNeeded();
        children.push({
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
        });
      }

      return children;
    }
    case 'windows-shell-actions': {
      const resolvedRequest = resolveExplorerWindowsShellContextMenuRequest(
        invocation,
        targetEntries,
        primaryEntry,
        environment,
      );
      if (!resolvedRequest) {
        return [];
      }

      const state =
        environment.windowsShellContextMenusByRequestKey[
          resolvedRequest.requestKey
        ];

      if (state?.status === 'ready' && state.items) {
        const children = sanitizeNodeList(
          createWindowsShellContextMenuNodes(
            command,
            resolvedRequest.request,
            state.items,
            depth,
            environment,
            `${command.id}.windows-shell-actions`,
          ),
        );

        if (children.length > 0) {
          return children;
        }

        return [
          createDisabledResolverNode(
            `${command.id}.empty`,
            'No Windows Actions Found',
            'Windows did not report any native context-menu actions for this target.',
            command,
            depth,
          ),
        ];
      }

      if (state?.status === 'error') {
        return [
          createDisabledResolverNode(
            `${command.id}.error`,
            'Unable to Load Windows Actions',
            state.error
              ?? 'Windows did not return a usable context menu for this target.',
            command,
            depth,
          ),
        ];
      }

      return [
        createDisabledResolverNode(
          `${command.id}.loading`,
          'Loading Windows Actions…',
          'Resolving the native Windows context-menu actions for this target.',
          command,
          depth,
        ),
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
    if (!canShowCommand(command, invocation, targetEntries, primaryEntry, environment)) {
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

    const command = commandRegistry.find((candidate) => candidate.id === entry.commandId) ?? null;
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

function layoutHasGroupSlot(
  layout: ExplorerMenuContextLayout,
  group: Extract<ExplorerMenuLayoutEntry, { kind: 'group-slot' }>['group'],
): boolean {
  return layout.entries.some(
    (entry) => entry.kind === 'group-slot' && entry.group === group,
  );
}

function createFallbackSeparatorNode(id: string): ExplorerRuntimeMenuSeparatorNode {
  return {
    kind: 'separator',
    id,
    label: '',
    depth: 0,
    tone: 'muted',
    source: 'layout',
    quickSlot: 'none',
    fallbackBucket: 'default',
  };
}

function injectFallbackPreviewNodes(
  nodes: ExplorerRuntimeMenuNode[],
  layout: ExplorerMenuContextLayout,
  commandRegistry: ExplorerCommandDefinition[],
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  handledCommandIds: Set<string>,
): ExplorerRuntimeMenuNode[] {
  if (invocation.kind !== 'preview-pane' || layoutHasGroupSlot(layout, 'preview')) {
    return nodes;
  }

  const previewNodes = commandRegistry
    .filter((command) => command.source === 'preview' && !handledCommandIds.has(command.id))
    .sort((left, right) => left.priority - right.priority)
    .flatMap((command) => {
      const node = createRuntimeNodeForCommand(
        command,
        invocation,
        targetEntries,
        primaryEntry,
        environment,
        0,
      );
      if (!node) {
        return [];
      }
      handledCommandIds.add(command.id);
      return [node];
    });
  const sanitizedPreviewNodes = sanitizeNodeList(previewNodes);
  if (sanitizedPreviewNodes.length === 0) {
    return nodes;
  }

  const pinnedTopCommandIds = new Set([
    'built-in.open',
    'built-in.open-with',
  ]);
  let insertionIndex = 0;
  while (insertionIndex < nodes.length) {
    const node = nodes[insertionIndex];
    const matchesPinnedTopCommand =
      (node.kind === 'command' && pinnedTopCommandIds.has(node.commandId)) ||
      (node.kind === 'submenu' && pinnedTopCommandIds.has(node.id));
    if (!matchesPinnedTopCommand) {
      break;
    }
    insertionIndex += 1;
  }

  const prefix = nodes.slice(0, insertionIndex);
  const suffix = nodes.slice(insertionIndex);
  const mergedNodes: ExplorerRuntimeMenuNode[] = [...prefix];

  if (prefix.length > 0 && prefix[prefix.length - 1]?.kind !== 'separator') {
    mergedNodes.push(createFallbackSeparatorNode('preview.fallback.leading-separator'));
  }
  mergedNodes.push(...sanitizedPreviewNodes);
  if (suffix.length > 0) {
    mergedNodes.push(createFallbackSeparatorNode('preview.fallback.trailing-separator'));
    mergedNodes.push(...suffix);
  }

  return sanitizeNodeList(mergedNodes);
}

function injectFallbackActionNodes(
  nodes: ExplorerRuntimeMenuNode[],
  layout: ExplorerMenuContextLayout,
  commandRegistry: ExplorerCommandDefinition[],
  invocation: ExplorerMenuInvocationContext,
  targetEntries: ExplorerMenuInvocationEntry[],
  primaryEntry: ExplorerMenuInvocationEntry | null,
  environment: ExplorerMenuRuntimeEnvironment,
  handledCommandIds: Set<string>,
): ExplorerRuntimeMenuNode[] {
  if (layoutHasGroupSlot(layout, 'action')) {
    return nodes;
  }

  const actionNodes = commandRegistry
    .filter((command) => command.source === 'action' && !handledCommandIds.has(command.id))
    .sort((left, right) => left.priority - right.priority)
    .flatMap((command) => {
      const node = createRuntimeNodeForCommand(
        command,
        invocation,
        targetEntries,
        primaryEntry,
        environment,
        0,
      );
      if (!node) {
        return [];
      }
      handledCommandIds.add(command.id);
      return [node];
    });
  const sanitizedActionNodes = sanitizeNodeList(actionNodes);
  if (sanitizedActionNodes.length === 0) {
    return nodes;
  }

  const insertionIndex = nodes.findIndex(
    (node) =>
      (node.kind === 'command' && node.command.source === 'plugin') ||
      (node.kind === 'command' && node.command.source === 'built-in' && node.command.group === 'danger'),
  );
  const safeInsertionIndex = insertionIndex >= 0 ? insertionIndex : nodes.length;
  const prefix = nodes.slice(0, safeInsertionIndex);
  const suffix = nodes.slice(safeInsertionIndex);
  const mergedNodes: ExplorerRuntimeMenuNode[] = [...prefix];

  if (mergedNodes.length > 0 && mergedNodes[mergedNodes.length - 1]?.kind !== 'separator') {
    mergedNodes.push(createFallbackSeparatorNode('action.fallback.leading-separator'));
  }
  mergedNodes.push(...sanitizedActionNodes);
  if (suffix.length > 0) {
    mergedNodes.push(createFallbackSeparatorNode('action.fallback.trailing-separator'));
    mergedNodes.push(...suffix);
  }

  return sanitizeNodeList(mergedNodes);
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
  const actionCommands = normalizeExplorerActionContributions(options.actions);
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
  const previewCommands = createPreviewContextMenuCommands(
    options.invocation,
    options.previewContextMenuRegistration,
  );
  const commandRegistry: ExplorerCommandDefinition[] = [
    ...BUILT_IN_EXPLORER_CONTEXT_MENU_ITEMS,
    ...dynamicCommands,
    ...previewCommands,
    ...actionCommands,
    ...pluginCommands,
  ];
  const layout = getLayoutForContext(
    menuPack,
    options.layoutOverridesByContext,
    options.invocation.kind,
  );
  const handledCommandIds = new Set<string>();
  const layoutNodes = buildNodesForLayout(
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
  const previewInjectedNodes = injectFallbackPreviewNodes(
    layoutNodes,
    layout,
    commandRegistry,
    options.invocation,
    targetEntries,
    primaryEntry,
    options.environment,
    handledCommandIds,
  );
  const nodes = injectFallbackActionNodes(
    previewInjectedNodes,
    layout,
    commandRegistry,
    options.invocation,
    targetEntries,
    primaryEntry,
    options.environment,
    handledCommandIds,
  );
  const finalizedNodes = options.includeEditMenuCommand
    ? appendEditMenuCommand(
      nodes,
      options.invocation,
      targetEntries,
      primaryEntry,
      options.environment,
    )
    : nodes;

  return {
    menuPack,
    presentation: resolvePresentationRenderer(
      menuPack,
      options.invocation,
      layout,
      options.themeRendererPreference,
      options.themePresentationPreference,
    ),
    nodes: finalizedNodes,
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
