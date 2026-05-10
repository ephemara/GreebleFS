import { describe, expect, it } from 'vitest';
import {
  applyExplorerBookmarkImportPlan,
  buildExplorerBookmarkTree,
  createDefaultExplorerRailSnapshot,
  createExplorerBookmarkFolder,
  createExplorerCustomCategory,
  inferBookmarkCategoryIds,
  isExplorerRailTreeNodeExpanded,
  normalizeExplorerRailSnapshot,
  planExplorerBookmarkImport,
  toggleExplorerRailTreeNode,
  toggleExplorerBookmarkCategoryFilter,
} from '../components/explorer/explorerRailState';

describe('explorerRailState', () => {
  it('normalizes invalid snapshots without throwing', () => {
    const snapshot = normalizeExplorerRailSnapshot({
      collapsedSectionIds: ['bookmarks', 'nope'],
      expandedFolderIds: ['missing-folder'],
      nodes: [
        { id: 'folder-1', kind: 'folder', name: 'Pinned', parentId: null },
        { id: 'bookmark-1', kind: 'bookmark', name: 'OverlayTerm', path: 'M:\\OverlayTerm', parentId: 'folder-1' },
        { id: 'bookmark-2', kind: 'bookmark', path: 'M:\\MissingName' },
      ],
    });

    expect(snapshot.collapsedSectionIds).toEqual(['bookmarks']);
    expect(snapshot.nodes).toHaveLength(2);
    expect(snapshot.nodes[0].kind).toBe('folder');
  });

  it('infers preset categories from folder paths', () => {
    const categoryIds = inferBookmarkCategoryIds({
      path: 'M:\\Code\\Kain\\docs',
      name: 'docs',
      isDirectory: true,
    }, []);

    expect(categoryIds).toContain('workspace');
    expect(categoryIds).toContain('docs');
  });

  it('plans and applies grouped bookmark imports into nested folders', () => {
    const base = createDefaultExplorerRailSnapshot();
    const folderResult = createExplorerBookmarkFolder(base, { name: 'Workspace' });
    const plan = planExplorerBookmarkImport(folderResult.snapshot, [
      { path: 'M:\\Code\\OverlayTerm', name: 'OverlayTerm', isDirectory: true },
      { path: 'M:\\Code\\Kain', name: 'Kain', isDirectory: true },
    ], folderResult.node.id);

    expect(plan).not.toBeNull();
    const applied = applyExplorerBookmarkImportPlan(folderResult.snapshot, plan!, 'folder');

    expect(applied.snapshot.nodes.filter((node) => node.kind === 'folder')).toHaveLength(2);
    expect(applied.snapshot.nodes.filter((node) => node.kind === 'bookmark')).toHaveLength(2);
  });

  it('filters bookmark trees by custom categories', () => {
    const categoryResult = createExplorerCustomCategory(createDefaultExplorerRailSnapshot(), 'Research', '#22c55e');
    const planned = planExplorerBookmarkImport(categoryResult.snapshot, [
      { path: 'M:\\Notes\\reference', name: 'Reference', isDirectory: true },
    ], null);
    const applied = applyExplorerBookmarkImportPlan(categoryResult.snapshot, planned!, 'bookmark');
    const filteredSnapshot = toggleExplorerBookmarkCategoryFilter({
      ...applied.snapshot,
      nodes: applied.snapshot.nodes.map((node) => ({
        ...node,
        categoryIds: node.kind === 'bookmark' ? [categoryResult.category!.id] : node.categoryIds,
      })),
    }, categoryResult.category!.id);

    const tree = buildExplorerBookmarkTree(filteredSnapshot);
    expect(tree).toHaveLength(1);
    expect(tree[0].node.name).toBe('Reference');
  });

  it('persists quick access tree node expansion overrides', () => {
    const base = createDefaultExplorerRailSnapshot();
    const librariesNode = { id: 'libraries', defaultExpanded: false };
    const expanded = toggleExplorerRailTreeNode(base, librariesNode);

    expect(isExplorerRailTreeNodeExpanded(expanded, librariesNode)).toBe(true);
    expect(expanded.expandedTreeNodeIds).toEqual(['libraries']);

    const collapsed = toggleExplorerRailTreeNode(expanded, librariesNode);
    expect(isExplorerRailTreeNodeExpanded(collapsed, librariesNode)).toBe(false);
    expect(collapsed.collapsedTreeNodeIds).toEqual(['libraries']);
  });
});
