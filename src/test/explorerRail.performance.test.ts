import { describe, expect, it } from 'vitest';
import {
  buildExplorerBookmarkTree,
  createDefaultExplorerRailSnapshot,
  createExplorerBookmarkFolder,
  upsertExplorerBookmark,
} from '../components/explorer/explorerRailState';

describe('explorer rail performance', () => {
  it('builds a large bookmark tree within a reasonable time budget', () => {
    let snapshot = createDefaultExplorerRailSnapshot();

    for (let folderIndex = 0; folderIndex < 30; folderIndex += 1) {
      const folderResult = createExplorerBookmarkFolder(snapshot, { name: `Folder ${folderIndex}` });
      snapshot = folderResult.snapshot;

      for (let bookmarkIndex = 0; bookmarkIndex < 120; bookmarkIndex += 1) {
        snapshot = upsertExplorerBookmark(snapshot, {
          path: `M:\\Projects\\Folder-${folderIndex}\\Item-${bookmarkIndex}`,
          name: `Item ${bookmarkIndex}`,
          isDirectory: true,
        }, { parentId: folderResult.node.id }).snapshot;
      }
    }

    const startedAt = performance.now();
    const tree = buildExplorerBookmarkTree({
      ...snapshot,
      searchQuery: 'Item 11',
    });
    const elapsedMs = performance.now() - startedAt;

    expect(tree.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(500);
  });
});
