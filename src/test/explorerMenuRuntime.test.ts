import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExplorerMenuContextLayoutOverrideMap,
  ExplorerMenuInvocationContext,
  ExplorerMenuInvocationEntry,
} from '../config/explorerContextMenu';
import type { OverlayPluginContextMenuContribution } from '../config/pluginContributions';
import type { LoadedExplorerAction } from '../config/actionPacks';
import {
  DEFAULT_EXPLORER_MENU_PACK_ID,
  createBuiltInExplorerMenuPack,
} from '../config/menuPacks';
import {
  buildExplorerRuntimeMenu,
  resolveMenuInvocationInputModality,
  type ExplorerMenuRuntimeEnvironment,
  type ExplorerRuntimeMenuNode,
} from '../components/explorer/explorerMenuRuntime';
import type { ExplorerPreviewContextMenuRegistration } from '../components/explorer/explorerPreviewContextMenu';

function createEntry(overrides?: Partial<ExplorerMenuInvocationEntry>): ExplorerMenuInvocationEntry {
  return {
    path: '/workspace/notes/alpha.txt',
    name: 'alpha.txt',
    parentPath: '/workspace/notes',
    extension: 'txt',
    stem: 'alpha',
    isDirectory: false,
    ...overrides,
  };
}

function createInvocation(
  overrides?: Partial<ExplorerMenuInvocationContext>,
): ExplorerMenuInvocationContext {
  return {
    kind: overrides?.kind ?? 'entry',
    currentLocation: overrides?.currentLocation ?? '/workspace/notes',
    selectedEntries: overrides?.selectedEntries ?? [],
    primaryEntry: overrides?.primaryEntry ?? null,
    searchResult: overrides?.searchResult ?? null,
    previewTarget: overrides?.previewTarget ?? null,
    previewContext: overrides?.previewContext ?? null,
    inputModality: overrides?.inputModality ?? 'mouse',
    reducedMotion: overrides?.reducedMotion ?? false,
    capabilities: overrides?.capabilities ?? {
      mouse: true,
      touch: false,
      pen: false,
      keyboard: true,
    },
  };
}

function createEnvironment(
  overrides?: Partial<ExplorerMenuRuntimeEnvironment>,
): ExplorerMenuRuntimeEnvironment {
  return {
    currentPath: '/workspace/notes',
    currentPathIsCloud: false,
    currentPathIsHome: false,
    currentLocationSupportsMutation: true,
    currentPathIsArchiveVirtual: false,
    userHomePath: '/home/ephemara',
    runtimePlatform: 'linux',
    clipboardAvailable: true,
    canCreateDirectory: true,
    canCreateFile: true,
    revealPathLabel: 'Reveal in Explorer',
    propertiesLabel: 'Properties',
    supportsNativeOpenWith: true,
    supportsOpenWithSystemPicker: true,
    supportsNativeProperties: true,
    openWithProgramsByPath: {},
    supportsNativeIntegration: vi.fn(() => true),
    isCloudExplorerPath: vi.fn(() => false),
    isExplorerArchiveVirtualPath: vi.fn(() => false),
    isSemanticSearchTextLikeExtension: vi.fn((extension: string) => extension === 'txt' || extension === 'ts'),
    isExplorerArchiveEntry: vi.fn(() => false),
    isBookmarked: vi.fn(() => false),
    canRunAudioBatch: vi.fn(() => false),
    openEntry: vi.fn(),
    openWithSystemPicker: vi.fn(async () => {}),
    openWithProgram: vi.fn(async () => {}),
    openAsAdmin: vi.fn(async () => {}),
    openInTerminal: vi.fn(),
    openInFilesystemAquarium: vi.fn(),
    sendToMobileDownload: vi.fn(async () => {}),
    revealExplorerPath: vi.fn(async () => {}),
    openExplorerPropertiesPanel: vi.fn(),
    copyToSysClipboard: vi.fn(),
    queueClipboard: vi.fn(),
    requestTransferDestination: vi.fn(),
    extractArchive: vi.fn(),
    duplicateEntries: vi.fn(),
    findSimilar: vi.fn(),
    startRename: vi.fn(),
    openTagDialog: vi.fn(),
    toggleBookmark: vi.fn(),
    openTrashDialog: vi.fn(),
    openNew: vi.fn(),
    paste: vi.fn(),
    refresh: vi.fn(),
    navigate: vi.fn(),
    openSettingsSection: vi.fn(),
    openContextMenuComposer: vi.fn(),
    runAudioBatch: vi.fn(),
    executeActionCommand: vi.fn(async () => {}),
    executePluginCommand: vi.fn(async () => {}),
    onError: vi.fn(),
    ...overrides,
  };
}

function buildMenu(options?: {
  invocation?: Partial<ExplorerMenuInvocationContext>;
  environment?: Partial<ExplorerMenuRuntimeEnvironment>;
  actions?: LoadedExplorerAction[];
  pluginContextMenuItems?: OverlayPluginContextMenuContribution[];
  layoutOverridesByContext?: ExplorerMenuContextLayoutOverrideMap;
  previewContextMenuRegistration?: ExplorerPreviewContextMenuRegistration | null;
  includeEditMenuCommand?: boolean;
}) {
  return buildExplorerRuntimeMenu({
    invocation: createInvocation(options?.invocation),
    menuPacks: [createBuiltInExplorerMenuPack()],
    activeMenuPackId: DEFAULT_EXPLORER_MENU_PACK_ID,
    layoutOverridesByContext: options?.layoutOverridesByContext ?? {},
    themeRendererPreference: 'radial',
    actions: options?.actions ?? [],
    pluginContextMenuItems: options?.pluginContextMenuItems ?? [],
    previewContextMenuRegistration: options?.previewContextMenuRegistration,
    includeEditMenuCommand: options?.includeEditMenuCommand,
    environment: createEnvironment(options?.environment),
  });
}

function findNodeByLabel(nodes: ExplorerRuntimeMenuNode[], label: string): ExplorerRuntimeMenuNode | null {
  for (const node of nodes) {
    if (node.label === label) {
      return node;
    }
    if (node.kind === 'submenu') {
      const child = findNodeByLabel(node.children, label);
      if (child) {
        return child;
      }
    }
  }
  return null;
}

describe('explorerMenuRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expands resolver-backed open-with actions for preview-pane invocations', async () => {
    const previewTarget = createEntry({
      path: '/workspace/notes/readme.txt',
      name: 'readme.txt',
      stem: 'readme',
    });
    const environment = createEnvironment();
    const menu = buildExplorerRuntimeMenu({
      invocation: createInvocation({
        kind: 'preview-pane',
        previewTarget,
        primaryEntry: null,
        selectedEntries: [],
      }),
      menuPacks: [createBuiltInExplorerMenuPack()],
      activeMenuPackId: DEFAULT_EXPLORER_MENU_PACK_ID,
      layoutOverridesByContext: {},
      themeRendererPreference: 'radial',
      actions: [],
      pluginContextMenuItems: [],
      environment,
    });

    expect(menu.targetEntries).toEqual([previewTarget]);
    expect(menu.primaryEntry).toEqual(previewTarget);

    const openWithNode = findNodeByLabel(menu.nodes, 'Open With');
    expect(openWithNode?.kind).toBe('submenu');
    if (!openWithNode || openWithNode.kind !== 'submenu') {
      throw new Error('Expected Open With submenu');
    }

    expect(openWithNode.children).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'command',
        label: 'System Picker…',
      }),
    ]));

    const systemPickerNode = findNodeByLabel(openWithNode.children, 'System Picker…');
    expect(systemPickerNode?.kind).toBe('command');
    if (!systemPickerNode || systemPickerNode.kind !== 'command') {
      throw new Error('Expected System Picker command');
    }

    await systemPickerNode.onSelect();

    expect(environment.openWithSystemPicker).toHaveBeenCalledWith(previewTarget.path);
    expect(menu.presentation.renderer).toBe('classic');
    expect(menu.presentation.fallbackRenderer).toBe('classic');
    expect(menu.primaryEntry?.path).toBe(previewTarget.path);
  });

  it('renders associated programs ahead of the system picker for open-with submenus', async () => {
    const targetEntry = createEntry({
      path: '/workspace/notes/demo.txt',
      name: 'demo.txt',
      stem: 'demo',
    });
    const environment = createEnvironment({
      runtimePlatform: 'macos',
      supportsOpenWithSystemPicker: true,
      openWithProgramsByPath: {
        [targetEntry.path]: {
          status: 'ready',
          error: null,
          requestId: null,
          requestedAtEpochMs: null,
          catalog: {
            defaultProgram: {
              name: 'Preview',
              path: 'com.apple.Preview',
              icon: null,
              isDefault: true,
            },
            recommendedPrograms: [
              {
                name: 'TextEdit',
                path: 'com.apple.TextEdit',
                launchId: 'assoc-handler:textedit',
                launchKind: 'shellHandler',
                executablePath: '/Applications/TextEdit.app',
                icon: null,
                isDefault: false,
              },
            ],
            otherPrograms: [
              {
                name: 'VS Code',
                path: 'com.microsoft.VSCode',
                icon: null,
                isDefault: false,
              },
            ],
          },
        },
      },
    });

    const menu = buildExplorerRuntimeMenu({
      invocation: createInvocation({
        kind: 'entry',
        primaryEntry: targetEntry,
        selectedEntries: [targetEntry],
      }),
      menuPacks: [createBuiltInExplorerMenuPack()],
      activeMenuPackId: DEFAULT_EXPLORER_MENU_PACK_ID,
      layoutOverridesByContext: {},
      themeRendererPreference: 'classic',
      actions: [],
      pluginContextMenuItems: [],
      environment,
    });

    const openWithNode = findNodeByLabel(menu.nodes, 'Open With');
    expect(openWithNode?.kind).toBe('submenu');
    if (!openWithNode || openWithNode.kind !== 'submenu') {
      throw new Error('Expected Open With submenu');
    }

    expect(findNodeByLabel(openWithNode.children, 'Preview (Default)')).not.toBeNull();
    expect(findNodeByLabel(openWithNode.children, 'TextEdit')).not.toBeNull();
    expect(findNodeByLabel(openWithNode.children, 'VS Code')).not.toBeNull();

    const textEditNode = findNodeByLabel(openWithNode.children, 'TextEdit');
    expect(textEditNode?.kind).toBe('command');
    if (!textEditNode || textEditNode.kind !== 'command') {
      throw new Error('Expected TextEdit command');
    }

    await textEditNode.onSelect();

    expect(environment.openWithProgram).toHaveBeenCalledWith(
      targetEntry.path,
      'assoc-handler:textedit',
      [],
    );
  });

  it('surfaces the send-to-iphone command for a single local file selection', async () => {
    const targetEntry = createEntry({
      path: '/workspace/exports/final.mov',
      name: 'final.mov',
      parentPath: '/workspace/exports',
      extension: 'mov',
      stem: 'final',
    });
    const environment = createEnvironment();
    const menu = buildMenu({
      invocation: {
        kind: 'entry',
        primaryEntry: targetEntry,
        selectedEntries: [targetEntry],
      },
      environment,
    });

    const sendNode = findNodeByLabel(menu.nodes, 'Send to iPhone');
    expect(sendNode?.kind).toBe('command');
    if (!sendNode || sendNode.kind !== 'command') {
      throw new Error('Expected Send to iPhone command');
    }

    await sendNode.onSelect();

    expect(environment.sendToMobileDownload).toHaveBeenCalledWith(targetEntry);
  });

  it('dispatches multi-select menus without falling back to the entry layout', () => {
    const firstEntry = createEntry();
    const secondEntry = createEntry({
      path: '/workspace/notes/beta.txt',
      name: 'beta.txt',
      stem: 'beta',
    });

    const menu = buildMenu({
      invocation: {
        kind: 'multi-select',
        primaryEntry: firstEntry,
        selectedEntries: [firstEntry, secondEntry],
      },
    });

    expect(menu.targetEntries).toEqual([firstEntry, secondEntry]);
    expect(menu.primaryEntry).toEqual(firstEntry);
    expect(findNodeByLabel(menu.nodes, 'Copy Paths')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Move Selected to Trash')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Open')).toBeNull();
  });

  it('lifts plugin contributions into executable command nodes inside the typed menu graph', async () => {
    const primaryEntry = createEntry({
      path: '/workspace/notes/plugin-target.txt',
      name: 'plugin-target.txt',
      stem: 'plugin-target',
    });
    const environment = createEnvironment();
    const menu = buildExplorerRuntimeMenu({
      invocation: createInvocation({
        kind: 'entry',
        primaryEntry,
        selectedEntries: [primaryEntry],
      }),
      menuPacks: [createBuiltInExplorerMenuPack()],
      activeMenuPackId: DEFAULT_EXPLORER_MENU_PACK_ID,
      layoutOverridesByContext: {},
      themeRendererPreference: 'classic',
      actions: [],
      pluginContextMenuItems: [
        {
          id: 'sample-plugin.context-menu.capture',
          pluginId: 'sample-plugin',
          pluginName: 'Sample Tools',
          title: 'Capture Memory Snapshot',
          contexts: ['entry'],
          appliesTo: 'file',
          group: 'plugin',
          execution: {
            kind: 'plugin-backend',
            entry: 'backend/capture-snapshot',
            args: ['{path}'],
          },
        },
      ],
      environment,
    });

    const pluginsSubmenu = findNodeByLabel(menu.nodes, 'Plugins');
    expect(pluginsSubmenu?.kind).toBe('submenu');
    if (!pluginsSubmenu || pluginsSubmenu.kind !== 'submenu') {
      throw new Error('Expected Plugins submenu');
    }

    const pluginCommand = findNodeByLabel(pluginsSubmenu.children, 'Capture Memory Snapshot');
    expect(pluginCommand?.kind).toBe('command');
    if (!pluginCommand || pluginCommand.kind !== 'command') {
      throw new Error('Expected plugin command node');
    }

    await pluginCommand.onSelect();

    expect(environment.executePluginCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sample-plugin.context-menu.capture',
        pluginId: 'sample-plugin',
        source: 'plugin',
      }),
      primaryEntry,
    );
  });

  it('injects an edit-menu affordance that deep-links to the composer for the active context', async () => {
    const primaryEntry = createEntry({
      path: '/workspace/notes/editable.txt',
      name: 'editable.txt',
      stem: 'editable',
    });
    const environment = createEnvironment();
    const menu = buildMenu({
      invocation: {
        kind: 'entry',
        primaryEntry,
        selectedEntries: [primaryEntry],
      },
      includeEditMenuCommand: true,
      environment,
    });

    const editMenuNode = findNodeByLabel(menu.nodes, 'Edit Menu');
    expect(editMenuNode?.kind).toBe('command');
    if (!editMenuNode || editMenuNode.kind !== 'command') {
      throw new Error('Expected Edit Menu command');
    }

    await editMenuNode.onSelect();

    expect(environment.openContextMenuComposer).toHaveBeenCalledWith('entry');
  });

  it('prefers context-specific layout overrides over the active pack layout', () => {
    const resultEntry = createEntry({
      path: '/workspace/notes/search-hit.txt',
      name: 'search-hit.txt',
      stem: 'search-hit',
    });
    const menu = buildMenu({
      invocation: {
        kind: 'search-result',
        primaryEntry: resultEntry,
        selectedEntries: [resultEntry],
        searchResult: {
          query: 'search hit',
          searchMode: 'name',
        },
      },
      layoutOverridesByContext: {
        'search-result': {
          renderer: 'sheet',
          entries: [
            {
              id: 'search.copy-path',
              kind: 'command',
              commandId: 'built-in.copy-path',
              parentEntryId: null,
              order: 10,
              enabled: true,
              quickSlot: 'none',
              fallbackBucket: 'default',
            },
          ],
        },
      },
    });

    expect(menu.menuPack.id).toBe(DEFAULT_EXPLORER_MENU_PACK_ID);
    expect(menu.nodes).toHaveLength(1);
    expect(menu.nodes[0]).toMatchObject({
      kind: 'command',
      label: 'Copy Path',
      commandId: 'built-in.copy-path',
    });
  });

  it('resolves preview-lane base actions for preview-pane invocations', async () => {
    const previewTarget = createEntry({
      path: '/workspace/notes/poster.png',
      name: 'poster.png',
      extension: 'png',
      stem: 'poster',
    });
    const resetView = vi.fn();
    const menu = buildMenu({
      invocation: {
        kind: 'preview-pane',
        previewTarget,
        primaryEntry: null,
        selectedEntries: [],
        previewContext: {
          previewKind: 'image',
          workflowTabId: 'preview',
          workflowBaseMode: 'preview',
        },
      },
      previewContextMenuRegistration: {
        previewKind: 'image',
        baseActions: [
          {
            id: 'image.reset-view',
            title: 'Reset View',
            onSelect: resetView,
          },
        ],
      },
    });

    const resetViewNode = findNodeByLabel(menu.nodes, 'Reset View');
    expect(resetViewNode?.kind).toBe('command');
    if (!resetViewNode || resetViewNode.kind !== 'command') {
      throw new Error('Expected Reset View command');
    }

    await resetViewNode.onSelect();
    expect(resetView).toHaveBeenCalledTimes(1);
  });

  it('merges workflow overlays by id and hides inherited preview actions when requested', () => {
    const previewTarget = createEntry({
      path: '/workspace/notes/poster.png',
      name: 'poster.png',
      extension: 'png',
      stem: 'poster',
    });
    const registration = {
      previewKind: 'image',
      baseActions: [
        {
          id: 'image.base',
          title: 'Image Action',
          onSelect: () => undefined,
        },
        {
          id: 'image.selection',
          title: 'Prompt Selection',
          onSelect: () => undefined,
        },
      ],
      workflowOverlays: [
        {
          workflowTabId: 'cutout',
          actions: [
            {
              id: 'image.base',
              title: 'Cutout Action',
            },
          ],
        },
        {
          workflowTabId: 'remove-background',
          actions: [
            {
              id: 'image.selection',
              hidden: true,
            },
            {
              id: 'image.remove-background',
              title: 'Remove BG Action',
              onSelect: () => undefined,
            },
          ],
        },
      ],
    };

    const cutoutMenu = buildMenu({
      invocation: {
        kind: 'preview-pane',
        previewTarget,
        primaryEntry: null,
        selectedEntries: [],
        previewContext: {
          previewKind: 'image',
          workflowTabId: 'cutout',
          workflowBaseMode: 'edit',
        },
      },
      previewContextMenuRegistration: registration,
    });
    expect(findNodeByLabel(cutoutMenu.nodes, 'Cutout Action')).not.toBeNull();
    expect(findNodeByLabel(cutoutMenu.nodes, 'Prompt Selection')).not.toBeNull();

    const removeBackgroundMenu = buildMenu({
      invocation: {
        kind: 'preview-pane',
        previewTarget,
        primaryEntry: null,
        selectedEntries: [],
        previewContext: {
          previewKind: 'image',
          workflowTabId: 'remove-background',
          workflowBaseMode: 'edit',
        },
      },
      previewContextMenuRegistration: registration,
    });
    expect(findNodeByLabel(removeBackgroundMenu.nodes, 'Prompt Selection')).toBeNull();
    expect(findNodeByLabel(removeBackgroundMenu.nodes, 'Remove BG Action')).not.toBeNull();
  });

  it('falls back to injected preview actions when a preview-pane layout has no preview slot', () => {
    const previewTarget = createEntry({
      path: '/workspace/notes/poster.png',
      name: 'poster.png',
      extension: 'png',
      stem: 'poster',
    });
    const menu = buildMenu({
      invocation: {
        kind: 'preview-pane',
        previewTarget,
        primaryEntry: null,
        selectedEntries: [],
        previewContext: {
          previewKind: 'image',
          workflowTabId: 'preview',
          workflowBaseMode: 'preview',
        },
      },
      layoutOverridesByContext: {
        'preview-pane': {
          renderer: 'classic',
          entries: [
            {
              id: 'preview.open',
              kind: 'command',
              commandId: 'built-in.open',
              parentEntryId: null,
              order: 10,
              enabled: true,
              quickSlot: 'none',
              fallbackBucket: 'default',
            },
            {
              id: 'preview.open-with',
              kind: 'command',
              commandId: 'built-in.open-with',
              parentEntryId: null,
              order: 20,
              enabled: true,
              quickSlot: 'none',
              fallbackBucket: 'default',
            },
          ],
        },
      },
      previewContextMenuRegistration: {
        previewKind: 'image',
        baseActions: [
          {
            id: 'image.reset-view',
            title: 'Reset View',
            onSelect: () => undefined,
          },
        ],
      },
    });

    expect(findNodeByLabel(menu.nodes, 'Open')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Open With')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Reset View')).not.toBeNull();
  });

  it('falls back to the generic preview menu when no preview registration is active', () => {
    const previewTarget = createEntry({
      path: '/workspace/notes/poster.png',
      name: 'poster.png',
      extension: 'png',
      stem: 'poster',
    });
    const menu = buildMenu({
      invocation: {
        kind: 'preview-pane',
        previewTarget,
        primaryEntry: null,
        selectedEntries: [],
        previewContext: {
          previewKind: 'image',
          workflowTabId: 'preview',
          workflowBaseMode: 'preview',
        },
      },
      previewContextMenuRegistration: null,
    });

    expect(menu.presentation.density).toBe('compact');
    expect(menu.presentation.showDescriptions).toBe(false);
    expect(findNodeByLabel(menu.nodes, 'Open')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Open With')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Reveal in Explorer')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Copy Path')).not.toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Send to iPhone')).toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Copy')).toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Move to Trash')).toBeNull();
    expect(findNodeByLabel(menu.nodes, 'Reset View')).toBeNull();
  });

  it('derives the invocation modality from pointer types', () => {
    expect(resolveMenuInvocationInputModality(null)).toBe('mouse');
    expect(resolveMenuInvocationInputModality({ pointerType: 'touch' } as Pick<PointerEvent, 'pointerType'>)).toBe('touch');
    expect(resolveMenuInvocationInputModality({ pointerType: 'pen' } as Pick<PointerEvent, 'pointerType'>)).toBe('pen');
    expect(resolveMenuInvocationInputModality({ pointerType: 'mouse' } as Pick<PointerEvent, 'pointerType'>)).toBe('mouse');
  });
});
