import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fsListDirMock, fsReadTextFileMock, isTauriMock } = vi.hoisted(() => ({
  fsListDirMock: vi.fn(),
  fsReadTextFileMock: vi.fn(),
  isTauriMock: vi.fn(() => false),
}));

vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>('@tauri-apps/api/core');
  return {
    ...actual,
    isTauri: isTauriMock,
  };
});

vi.mock('../runtime/tauriClient', async () => {
  const actual = await vi.importActual<typeof import('../runtime/tauriClient')>('../runtime/tauriClient');
  return {
    ...actual,
    commands: {
      ...actual.commands,
      fsListDir: fsListDirMock,
      fsReadTextFile: fsReadTextFileMock,
    },
    unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
      value?.status === 'ok' ? value.data : value),
  };
});

import {
  DEFAULT_EXPLORER_MENU_PACK_ID,
  createBuiltInExplorerMenuPack,
  loadExplorerMenuPacks,
  loadExplorerMenuPacksFromDirectoryEntries,
} from '../config/menuPacks';

describe('menuPacks', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    fsListDirMock.mockReset();
    fsReadTextFileMock.mockReset();
  });

  it('creates a built-in classic menu pack with all explorer invocation contexts', () => {
    const pack = createBuiltInExplorerMenuPack();

    expect(pack.id).toBe(DEFAULT_EXPLORER_MENU_PACK_ID);
    expect(pack.presentation.renderer).toBe('classic');
    expect(pack.presentation.capabilityRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ when: 'touch', renderer: 'sheet' }),
    ]));
    expect(pack.contexts.entry?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'command',
        commandId: 'built-in.open',
        quickSlot: 'primary',
      }),
      expect.objectContaining({
        kind: 'submenu',
        title: 'Plugins',
      }),
    ]));
    expect(pack.contexts.background?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'group-slot',
        group: 'create',
      }),
    ]));
    expect(pack.contexts['multi-select']?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'group-slot',
        group: 'danger',
      }),
    ]));
    expect(pack.contexts['search-result']?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'command',
        commandId: 'built-in.open',
      }),
    ]));
    expect(pack.contexts['preview-pane']?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'group-slot',
        group: 'system',
      }),
    ]));
  });

  it('loads declarative menu packs from authored manifests and warns on empty packs', async () => {
    fsReadTextFileMock.mockImplementation(async (path: string) => {
      if (path === '/packs/orbital.json') {
        return {
          status: 'ok',
          data: JSON.stringify({
            version: 2,
            id: 'orbital-pack',
            name: 'Orbital Pack',
            description: 'Hybrid/radial-ready explorer menu pack.',
            tags: ['orbital', 'hybrid'],
            presentation: {
              renderer: 'radial',
              fallbackRenderer: 'classic',
              capabilityRules: [
                { when: 'touch', renderer: 'sheet' },
                { when: 'mouse', renderer: 'hybrid' },
              ],
            },
            contexts: {
              entry: {
                renderer: 'hybrid',
                entries: [
                  { id: 'entry.open', kind: 'command', commandId: 'built-in.open', order: 10, quickSlot: 'primary' },
                  { id: 'entry.plugins', kind: 'group-slot', group: 'plugin', sourceFilter: 'plugin', order: 20 },
                  { id: 'entry.more', kind: 'submenu', title: 'More', order: 30 },
                  { id: 'entry.more.copy-path', kind: 'command', commandId: 'built-in.copy-path', parentEntryId: 'entry.more', order: 10 },
                ],
              },
              'preview-pane': {
                entries: [
                  { id: 'preview.copy-path', kind: 'command', commandId: 'built-in.copy-path', order: 10 },
                ],
              },
            },
          }),
        };
      }

      if (path === '/packs/empty.json') {
        return {
          status: 'ok',
          data: JSON.stringify({
            id: 'empty-pack',
            name: 'Empty Pack',
          }),
        };
      }

      throw new Error(`Unexpected manifest path: ${path}`);
    });

    const result = await loadExplorerMenuPacksFromDirectoryEntries([
      {
        name: 'orbital.json',
        path: '/packs/orbital.json',
        is_dir: false,
        extension: 'json',
        modified: 0,
      },
      {
        name: 'empty.json',
        path: '/packs/empty.json',
        is_dir: false,
        extension: 'json',
        modified: 0,
      },
    ], '/packs');

    expect(result.sourceError).toBeNull();
    expect(result.packs.map((pack) => pack.id)).toEqual([
      DEFAULT_EXPLORER_MENU_PACK_ID,
      'orbital-pack',
    ]);
    expect(result.packs[1]).toMatchObject({
      id: 'orbital-pack',
      name: 'Orbital Pack',
      sourceKind: 'menu-pack-directory',
      sourceLabel: '/packs',
      presentation: expect.objectContaining({
        renderer: 'radial',
        fallbackRenderer: 'classic',
      }),
    });
    expect(result.packs[1]?.contexts.entry).toMatchObject({
      renderer: 'hybrid',
    });
    expect(result.packs[1]?.contexts.entry?.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'group-slot',
        group: 'plugin',
        sourceFilter: 'plugin',
      }),
      expect.objectContaining({
        kind: 'submenu',
        title: 'More',
      }),
    ]));
    expect(result.warnings).toEqual([
      'Empty Pack: manifest does not define any menu contexts.',
    ]);
  });

  it('falls back to the built-in pack outside the Tauri host', async () => {
    isTauriMock.mockReturnValue(false);

    const result = await loadExplorerMenuPacks();

    expect(result.sourceError).toBeNull();
    expect(result.packs.map((pack) => pack.id)).toEqual([
      DEFAULT_EXPLORER_MENU_PACK_ID,
    ]);
    expect(fsListDirMock).not.toHaveBeenCalled();
  });
});
