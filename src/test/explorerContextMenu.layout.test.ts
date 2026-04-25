import { describe, expect, it } from 'vitest';

import {
  moveExplorerMenuLayoutEntry,
  placeExplorerMenuLayoutEntry,
  sortExplorerMenuLayoutEntries,
  withExplorerMenuLayoutEntryParent,
  type ExplorerMenuLayoutEntry,
} from '../config/explorerContextMenu';

function createCommandEntry(
  id: string,
  commandId: string,
  order: number,
  parentEntryId: string | null = null,
): Extract<ExplorerMenuLayoutEntry, { kind: 'command' }> {
  return {
    id,
    kind: 'command',
    commandId,
    parentEntryId,
    order,
    enabled: true,
    quickSlot: 'none',
    fallbackBucket: 'default',
  };
}

function createSubmenuEntry(
  id: string,
  title: string,
  order: number,
  parentEntryId: string | null = null,
): Extract<ExplorerMenuLayoutEntry, { kind: 'submenu' }> {
  return {
    id,
    kind: 'submenu',
    title,
    parentEntryId,
    order,
    enabled: true,
    quickSlot: 'none',
    fallbackBucket: 'default',
  };
}

function listSiblingIds(
  entries: ExplorerMenuLayoutEntry[],
  parentEntryId: string | null = null,
): string[] {
  return sortExplorerMenuLayoutEntries(entries)
    .filter((entry) => entry.parentEntryId === parentEntryId)
    .map((entry) => entry.id);
}

function getEntryById(
  entries: ExplorerMenuLayoutEntry[],
  entryId: string,
): ExplorerMenuLayoutEntry {
  const entry = entries.find((candidate) => candidate.id === entryId);
  if (!entry) {
    throw new Error(`Missing layout entry ${entryId}`);
  }
  return entry;
}

describe('explorerContextMenu layout helpers', () => {
  it('moves sibling entries upward and compacts their order values', () => {
    const entries: ExplorerMenuLayoutEntry[] = [
      createCommandEntry('command.open', 'built-in.open', 10),
      createCommandEntry('command.copy', 'built-in.copy', 20),
      createCommandEntry('command.plugin', 'sample-plugin.context-menu.capture', 30),
    ];

    const nextEntries = moveExplorerMenuLayoutEntry(entries, 'command.plugin', 'up');

    expect(listSiblingIds(nextEntries)).toEqual([
      'command.open',
      'command.plugin',
      'command.copy',
    ]);
    expect(getEntryById(nextEntries, 'command.plugin').order).toBe(20);
    expect(getEntryById(nextEntries, 'command.copy').order).toBe(30);
  });

  it('reparents entries into folders and compacts both the source and target sibling groups', () => {
    const entries: ExplorerMenuLayoutEntry[] = [
      createSubmenuEntry('submenu.organize', 'Organize', 10),
      createCommandEntry('command.open', 'built-in.open', 20),
      createCommandEntry('command.plugin', 'sample-plugin.context-menu.capture', 30),
    ];

    const nextEntries = placeExplorerMenuLayoutEntry(
      entries,
      'command.plugin',
      'submenu.organize',
      0,
    );

    expect(listSiblingIds(nextEntries)).toEqual([
      'submenu.organize',
      'command.open',
    ]);
    expect(listSiblingIds(nextEntries, 'submenu.organize')).toEqual([
      'command.plugin',
    ]);
    expect(getEntryById(nextEntries, 'command.plugin')).toMatchObject({
      parentEntryId: 'submenu.organize',
      order: 10,
    });
    expect(getEntryById(nextEntries, 'command.open').order).toBe(20);
  });

  it('blocks submenu cycles when reparenting', () => {
    const entries: ExplorerMenuLayoutEntry[] = [
      createSubmenuEntry('submenu.root', 'Root Folder', 10),
      createSubmenuEntry('submenu.child', 'Child Folder', 10, 'submenu.root'),
      createCommandEntry('command.open', 'built-in.open', 10, 'submenu.child'),
    ];

    const nextEntries = withExplorerMenuLayoutEntryParent(
      entries,
      'submenu.root',
      'submenu.child',
    );

    expect(sortExplorerMenuLayoutEntries(nextEntries)).toEqual(
      sortExplorerMenuLayoutEntries(entries),
    );
    expect(getEntryById(nextEntries, 'submenu.root').parentEntryId).toBeNull();
  });
});
