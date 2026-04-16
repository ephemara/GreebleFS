import {
  explorerBookmarkCategoryPresets,
  explorerBookmarkColorOptions,
  explorerRailSectionOrder,
  normalizeExplorerRailViewMode,
  type ExplorerRailSectionId,
  type ExplorerRailViewMode,
} from '../../config/explorerRail';

export interface ExplorerBookmarkCategory {
  id: string;
  name: string;
  color: string;
  kind: 'custom';
  createdAt: number;
}

export type ExplorerBookmarkTargetKind = 'directory' | 'file';

interface ExplorerBookmarkNodeBase {
  id: string;
  kind: 'folder' | 'bookmark';
  parentId: string | null;
  name: string;
  color: string | null;
  categoryIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ExplorerBookmarkFolderNode extends ExplorerBookmarkNodeBase {
  kind: 'folder';
}

export interface ExplorerBookmarkLeafNode extends ExplorerBookmarkNodeBase {
  kind: 'bookmark';
  path: string;
  targetKind: ExplorerBookmarkTargetKind;
}

export type ExplorerBookmarkNode = ExplorerBookmarkFolderNode | ExplorerBookmarkLeafNode;

export interface ExplorerRailSnapshot {
  customCategories: ExplorerBookmarkCategory[];
  nodes: ExplorerBookmarkNode[];
  collapsedSectionIds: ExplorerRailSectionId[];
  expandedFolderIds: string[];
  activeCategoryIds: string[];
  searchQuery: string;
  viewMode: ExplorerRailViewMode;
}

export interface ExplorerBookmarkTreeNode {
  node: ExplorerBookmarkNode;
  depth: number;
  children: ExplorerBookmarkTreeNode[];
  matchesFilter: boolean;
  containsMatch: boolean;
}

export interface LegacyExplorerBookmark {
  id?: string;
  name?: string;
  path?: string;
}

export interface ExplorerBookmarkImportSource {
  path: string;
  name: string;
  isDirectory: boolean;
  color?: string | null;
}

export interface ExplorerBookmarkImportPlan {
  sources: ExplorerBookmarkImportSource[];
  suggestedMode: 'bookmark' | 'folder';
  suggestedParentId: string | null;
  suggestedCategoryIds: string[];
  suggestedColor: string | null;
  suggestedName: string;
  targetFolderId: string | null;
  note: string;
}

export interface ExplorerRailFilterState {
  query: string;
  activeCategoryIds: string[];
}

export const defaultExplorerRailSnapshot: ExplorerRailSnapshot = {
  customCategories: [],
  nodes: [],
  collapsedSectionIds: [],
  expandedFolderIds: [],
  activeCategoryIds: [],
  searchQuery: '',
  viewMode: 'default',
};

export function createDefaultExplorerRailSnapshot(): ExplorerRailSnapshot {
  return {
    ...defaultExplorerRailSnapshot,
    customCategories: [],
    nodes: [],
    collapsedSectionIds: [],
    expandedFolderIds: [],
    activeCategoryIds: [],
    searchQuery: '',
    viewMode: 'default',
  };
}

export function getAllExplorerBookmarkCategories(customCategories: ExplorerBookmarkCategory[]) {
  return [
    ...explorerBookmarkCategoryPresets.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      kind: 'preset' as const,
    })),
    ...customCategories,
  ];
}

export function normalizeExplorerRailSnapshot(value: unknown): ExplorerRailSnapshot {
  const now = Date.now();
  const source = asRecord(value);
  const customCategories = Array.isArray(source?.customCategories)
    ? source.customCategories
      .map((entry) => normalizeCustomCategory(entry, now))
      .filter((entry): entry is ExplorerBookmarkCategory => entry !== null)
    : [];
  const categoryIds = new Set(getAllExplorerBookmarkCategories(customCategories).map((entry) => entry.id));
  const normalizedNodes = Array.isArray(source?.nodes)
    ? source.nodes
      .map((entry) => normalizeNode(entry, now, categoryIds))
      .filter((entry): entry is ExplorerBookmarkNode => entry !== null)
    : [];
  const folderIds = new Set(normalizedNodes.filter((entry) => entry.kind === 'folder').map((entry) => entry.id));
  const validNodeIds = new Set(normalizedNodes.map((entry) => entry.id));
  const nodes = normalizedNodes.map((entry) => ({
    ...entry,
    parentId: entry.parentId && folderIds.has(entry.parentId) && entry.parentId !== entry.id ? entry.parentId : null,
  }));

  return {
    customCategories,
    nodes,
    collapsedSectionIds: Array.isArray(source?.collapsedSectionIds)
      ? source.collapsedSectionIds.filter(isExplorerRailSectionId)
      : [],
    expandedFolderIds: Array.isArray(source?.expandedFolderIds)
      ? source.expandedFolderIds.filter((entry): entry is string => typeof entry === 'string' && validNodeIds.has(entry))
      : [],
    activeCategoryIds: Array.isArray(source?.activeCategoryIds)
      ? source.activeCategoryIds.filter((entry): entry is string => typeof entry === 'string' && categoryIds.has(entry))
      : [],
    searchQuery: typeof source?.searchQuery === 'string' ? source.searchQuery : '',
    viewMode: normalizeExplorerRailViewMode(source?.viewMode),
  };
}

export function migrateLegacyExplorerBookmarks(legacyValue: unknown): ExplorerBookmarkNode[] {
  if (!Array.isArray(legacyValue)) {
    return [];
  }

  return legacyValue.flatMap((entry) => {
    const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
    if (!path) {
      return [];
    }

    const name = typeof entry?.name === 'string' && entry.name.trim()
      ? entry.name.trim()
      : getLeafNameFromPath(path);
    const categoryIds = inferBookmarkCategoryIds({ path, name, isDirectory: true }, []);
    return [{
      id: createStableId('bookmark'),
      kind: 'bookmark' as const,
      parentId: null,
      name,
      color: suggestBookmarkColor(categoryIds),
      categoryIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      path,
      targetKind: 'directory' as const,
    }];
  });
}

export function isExplorerRailSectionCollapsed(snapshot: ExplorerRailSnapshot, sectionId: ExplorerRailSectionId): boolean {
  return snapshot.collapsedSectionIds.includes(sectionId);
}

export function toggleExplorerRailSection(snapshot: ExplorerRailSnapshot, sectionId: ExplorerRailSectionId): ExplorerRailSnapshot {
  return {
    ...snapshot,
    collapsedSectionIds: snapshot.collapsedSectionIds.includes(sectionId)
      ? snapshot.collapsedSectionIds.filter((entry) => entry !== sectionId)
      : [...snapshot.collapsedSectionIds, sectionId],
  };
}

export function isExplorerBookmarkFolderExpanded(snapshot: ExplorerRailSnapshot, folderId: string): boolean {
  return snapshot.expandedFolderIds.includes(folderId);
}

export function toggleExplorerBookmarkFolder(snapshot: ExplorerRailSnapshot, folderId: string): ExplorerRailSnapshot {
  return {
    ...snapshot,
    expandedFolderIds: snapshot.expandedFolderIds.includes(folderId)
      ? snapshot.expandedFolderIds.filter((entry) => entry !== folderId)
      : [...snapshot.expandedFolderIds, folderId],
  };
}

export function setExplorerBookmarkSearchQuery(snapshot: ExplorerRailSnapshot, query: string): ExplorerRailSnapshot {
  return {
    ...snapshot,
    searchQuery: query,
  };
}

export function setExplorerRailViewMode(snapshot: ExplorerRailSnapshot, viewMode: ExplorerRailViewMode): ExplorerRailSnapshot {
  return {
    ...snapshot,
    viewMode,
  };
}

export function toggleExplorerBookmarkCategoryFilter(snapshot: ExplorerRailSnapshot, categoryId: string): ExplorerRailSnapshot {
  return {
    ...snapshot,
    activeCategoryIds: snapshot.activeCategoryIds.includes(categoryId)
      ? snapshot.activeCategoryIds.filter((entry) => entry !== categoryId)
      : [...snapshot.activeCategoryIds, categoryId],
  };
}

export function clearExplorerBookmarkCategoryFilters(snapshot: ExplorerRailSnapshot): ExplorerRailSnapshot {
  return {
    ...snapshot,
    activeCategoryIds: [],
  };
}

export function createExplorerBookmarkFolder(
  snapshot: ExplorerRailSnapshot,
  options: { parentId?: string | null; name?: string; color?: string | null; categoryIds?: string[] } = {},
): { snapshot: ExplorerRailSnapshot; node: ExplorerBookmarkFolderNode } {
  const now = Date.now();
  const node: ExplorerBookmarkFolderNode = {
    id: createStableId('folder'),
    kind: 'folder',
    parentId: options.parentId ?? null,
    name: (options.name ?? 'New Folder').trim() || 'New Folder',
    color: options.color ?? explorerBookmarkColorOptions[0]?.value ?? null,
    categoryIds: normalizeCategoryIds(options.categoryIds ?? []),
    createdAt: now,
    updatedAt: now,
  };

  return {
    snapshot: {
      ...snapshot,
      nodes: [...snapshot.nodes, node],
      expandedFolderIds: snapshot.expandedFolderIds.includes(node.id)
        ? snapshot.expandedFolderIds
        : [...snapshot.expandedFolderIds, node.id],
    },
    node,
  };
}

export function renameExplorerBookmarkNode(snapshot: ExplorerRailSnapshot, nodeId: string, nextName: string): ExplorerRailSnapshot {
  const trimmedName = nextName.trim();
  if (!trimmedName) {
    return snapshot;
  }

  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node) => (
      node.id === nodeId
        ? { ...node, name: trimmedName, updatedAt: Date.now() }
        : node
    )),
  };
}

export function cycleExplorerBookmarkNodeColor(snapshot: ExplorerRailSnapshot, nodeId: string): ExplorerRailSnapshot {
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }

      const currentIndex = explorerBookmarkColorOptions.findIndex((entry) => entry.value === node.color);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % explorerBookmarkColorOptions.length;
      return {
        ...node,
        color: explorerBookmarkColorOptions[nextIndex]?.value ?? node.color,
        updatedAt: Date.now(),
      };
    }),
  };
}

export function removeExplorerBookmarkNode(snapshot: ExplorerRailSnapshot, nodeId: string): ExplorerRailSnapshot {
  const descendantIds = collectDescendantIds(snapshot.nodes, nodeId);
  const idsToRemove = new Set([nodeId, ...descendantIds]);
  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => !idsToRemove.has(node.id)),
    expandedFolderIds: snapshot.expandedFolderIds.filter((entry) => !idsToRemove.has(entry)),
  };
}

export function moveExplorerBookmarkNode(snapshot: ExplorerRailSnapshot, nodeId: string, parentId: string | null): ExplorerRailSnapshot {
  const node = snapshot.nodes.find((entry) => entry.id === nodeId);
  if (!node || node.parentId === parentId) {
    return snapshot;
  }

  if (parentId && !snapshot.nodes.some((entry) => entry.id === parentId && entry.kind === 'folder')) {
    return snapshot;
  }

  const invalidParents = new Set(collectDescendantIds(snapshot.nodes, nodeId));
  if (parentId && invalidParents.has(parentId)) {
    return snapshot;
  }

  return {
    ...snapshot,
    nodes: snapshot.nodes.map((entry) => (
      entry.id === nodeId
        ? { ...entry, parentId, updatedAt: Date.now() }
        : entry
    )),
  };
}

export function createExplorerCustomCategory(
  snapshot: ExplorerRailSnapshot,
  name: string,
  color: string = explorerBookmarkColorOptions[0]?.value ?? '#7dd3fc',
): { snapshot: ExplorerRailSnapshot; category: ExplorerBookmarkCategory | null } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { snapshot, category: null };
  }

  const existing = snapshot.customCategories.find((entry) => entry.name.toLowerCase() === trimmedName.toLowerCase());
  if (existing) {
    return { snapshot, category: existing };
  }

  const category: ExplorerBookmarkCategory = {
    id: createStableId('category'),
    name: trimmedName,
    color,
    kind: 'custom',
    createdAt: Date.now(),
  };

  return {
    snapshot: {
      ...snapshot,
      customCategories: [...snapshot.customCategories, category],
    },
    category,
  };
}

export function upsertExplorerBookmark(
  snapshot: ExplorerRailSnapshot,
  source: ExplorerBookmarkImportSource,
  options: {
    parentId?: string | null;
    categoryIds?: string[];
    color?: string | null;
  } = {},
): { snapshot: ExplorerRailSnapshot; node: ExplorerBookmarkLeafNode; created: boolean } {
  const parentId = options.parentId ?? null;
  const existingNode = snapshot.nodes.find((entry): entry is ExplorerBookmarkLeafNode => (
    entry.kind === 'bookmark'
    && entry.path === source.path
    && entry.parentId === parentId
  ));
  const categoryIds = normalizeCategoryIds(
    options.categoryIds?.length
      ? options.categoryIds
      : inferBookmarkCategoryIds(source, snapshot.customCategories),
  );
  const color = options.color ?? suggestBookmarkColor(categoryIds) ?? source.color ?? null;

  if (existingNode) {
    const updatedNode: ExplorerBookmarkLeafNode = {
      ...existingNode,
      name: source.name,
      color,
      targetKind: source.isDirectory ? 'directory' : 'file',
      categoryIds,
      updatedAt: Date.now(),
    };
    return {
      snapshot: {
        ...snapshot,
        nodes: snapshot.nodes.map((entry) => entry.id === existingNode.id ? updatedNode : entry),
      },
      node: updatedNode,
      created: false,
    };
  }

  const now = Date.now();
  const node: ExplorerBookmarkLeafNode = {
    id: createStableId('bookmark'),
    kind: 'bookmark',
    parentId,
    name: source.name.trim() || getLeafNameFromPath(source.path),
    color,
    categoryIds,
    createdAt: now,
    updatedAt: now,
    path: source.path,
    targetKind: source.isDirectory ? 'directory' : 'file',
  };

  return {
    snapshot: {
      ...snapshot,
      nodes: [...snapshot.nodes, node],
    },
    node,
    created: true,
  };
}

export function removeExplorerBookmarksByPath(snapshot: ExplorerRailSnapshot, path: string): ExplorerRailSnapshot {
  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => !(node.kind === 'bookmark' && node.path === path)),
  };
}

export function planExplorerBookmarkImport(
  snapshot: ExplorerRailSnapshot,
  sources: ExplorerBookmarkImportSource[],
  targetFolderId: string | null,
): ExplorerBookmarkImportPlan | null {
  const normalizedSources = sources
    .filter((entry) => typeof entry.path === 'string' && entry.path.trim())
    .map((entry) => ({
      ...entry,
      name: entry.name.trim() || getLeafNameFromPath(entry.path),
      path: entry.path.trim(),
    }));
  if (normalizedSources.length === 0) {
    return null;
  }

  const categoryIds = normalizeCategoryIds(Array.from(new Set(
    normalizedSources.flatMap((entry) => inferBookmarkCategoryIds(entry, snapshot.customCategories)),
  )));
  const suggestedParentId = targetFolderId ?? findSuggestedFolderParent(snapshot, categoryIds);
  const suggestedName = normalizedSources.length === 1
    ? normalizedSources[0].name
    : `${normalizedSources[0].name} Group`;
  const suggestedMode = normalizedSources.length > 1 || normalizedSources.some((entry) => entry.isDirectory)
    ? 'folder'
    : 'bookmark';

  return {
    sources: normalizedSources,
    suggestedMode,
    suggestedParentId,
    suggestedCategoryIds: categoryIds,
    suggestedColor: suggestBookmarkColor(categoryIds) ?? normalizedSources[0]?.color ?? null,
    suggestedName,
    targetFolderId,
    note: suggestedParentId
      ? 'Drop will organize items inside the selected bookmark folder.'
      : categoryIds.length > 0
        ? 'Drop matched an existing category and will auto-tag the new bookmark.'
        : 'Drop will pin the folder into root bookmarks.',
  };
}

export function applyExplorerBookmarkImportPlan(
  snapshot: ExplorerRailSnapshot,
  plan: ExplorerBookmarkImportPlan,
  mode: 'bookmark' | 'folder' = plan.suggestedMode,
): { snapshot: ExplorerRailSnapshot; createdNodes: ExplorerBookmarkLeafNode[] } {
  let nextSnapshot = snapshot;
  let parentId = plan.suggestedParentId;
  const createdNodes: ExplorerBookmarkLeafNode[] = [];

  if (mode === 'folder') {
    const folderResult = createExplorerBookmarkFolder(nextSnapshot, {
      parentId,
      name: plan.suggestedName,
      color: plan.suggestedColor,
      categoryIds: plan.suggestedCategoryIds,
    });
    nextSnapshot = folderResult.snapshot;
    parentId = folderResult.node.id;
  }

  for (const source of plan.sources) {
    const result = upsertExplorerBookmark(nextSnapshot, source, {
      parentId,
      categoryIds: plan.suggestedCategoryIds,
      color: plan.suggestedColor ?? source.color ?? null,
    });
    nextSnapshot = result.snapshot;
    if (result.created) {
      createdNodes.push(result.node);
    }
  }

  return {
    snapshot: nextSnapshot,
    createdNodes,
  };
}

export function buildExplorerBookmarkTree(
  snapshot: ExplorerRailSnapshot,
  filters: ExplorerRailFilterState = {
    query: snapshot.searchQuery,
    activeCategoryIds: snapshot.activeCategoryIds,
  },
): ExplorerBookmarkTreeNode[] {
  const byParent = new Map<string | null, ExplorerBookmarkNode[]>();
  for (const node of snapshot.nodes) {
    const bucket = byParent.get(node.parentId) ?? [];
    bucket.push(node);
    byParent.set(node.parentId, bucket);
  }

  const buildChildren = (parentId: string | null, depth: number): ExplorerBookmarkTreeNode[] => {
    const nodes = [...(byParent.get(parentId) ?? [])].sort(compareBookmarkNodes);
    return nodes.map((node) => {
      const children = node.kind === 'folder' ? buildChildren(node.id, depth + 1) : [];
      const matchesFilter = doesBookmarkNodeMatchFilters(node, filters);
      const containsMatch = matchesFilter || children.some((entry) => entry.containsMatch);
      return {
        node,
        depth,
        children,
        matchesFilter,
        containsMatch,
      };
    }).filter((entry) => entry.containsMatch || !hasActiveExplorerFilters(filters));
  };

  return buildChildren(null, 0);
}

export function doesBookmarkNodeMatchFilters(node: ExplorerBookmarkNode, filters: ExplorerRailFilterState): boolean {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const requiresCategoryMatch = filters.activeCategoryIds.length > 0;
  const categoryMatch = !requiresCategoryMatch || filters.activeCategoryIds.every((categoryId) => node.categoryIds.includes(categoryId));
  if (!categoryMatch) {
    return false;
  }

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    node.name,
    node.kind === 'bookmark' ? node.path : '',
  ].join(' ').toLowerCase();
  return haystack.includes(normalizedQuery);
}

export function hasActiveExplorerFilters(filters: ExplorerRailFilterState): boolean {
  return Boolean(filters.query.trim()) || filters.activeCategoryIds.length > 0;
}

export function inferBookmarkCategoryIds(
  source: { path: string; name: string; isDirectory: boolean },
  customCategories: ExplorerBookmarkCategory[],
): string[] {
  const categories = [
    ...explorerBookmarkCategoryPresets,
    ...customCategories,
  ];
  const haystack = `${source.name} ${source.path}`.toLowerCase();
  return normalizeCategoryIds(categories.flatMap((category) => {
    if ('keywords' in category && Array.isArray(category.keywords)) {
      return category.keywords.some((keyword: string) => haystack.includes(keyword.toLowerCase())) ? [category.id] : [];
    }

    return haystack.includes(category.name.toLowerCase()) ? [category.id] : [];
  }));
}

export function suggestBookmarkColor(categoryIds: string[]): string | null {
  for (const categoryId of categoryIds) {
    const preset = explorerBookmarkCategoryPresets.find((entry) => entry.id === categoryId);
    if (preset) {
      return preset.color;
    }
  }

  return explorerBookmarkColorOptions[0]?.value ?? null;
}

function normalizeCustomCategory(value: unknown, now: number): ExplorerBookmarkCategory | null {
  const source = asRecord(value);
  const id = typeof source?.id === 'string' && source.id.trim() ? source.id.trim() : createStableId('category');
  const name = typeof source?.name === 'string' ? source.name.trim() : '';
  if (!name) {
    return null;
  }

  return {
    id,
    name,
    color: typeof source?.color === 'string' && source.color.trim()
      ? source.color.trim()
      : explorerBookmarkColorOptions[0]?.value ?? '#7dd3fc',
    kind: 'custom',
    createdAt: typeof source?.createdAt === 'number' && Number.isFinite(source.createdAt) ? source.createdAt : now,
  };
}

function normalizeNode(
  value: unknown,
  now: number,
  validCategoryIds: Set<string>,
): ExplorerBookmarkNode | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }
  const kind = source?.kind;
  if (kind !== 'folder' && kind !== 'bookmark') {
    return null;
  }

  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!name) {
    return null;
  }

  const base = {
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : createStableId(kind),
    kind,
    parentId: typeof source.parentId === 'string' && source.parentId.trim() ? source.parentId.trim() : null,
    name,
    color: typeof source.color === 'string' && source.color.trim() ? source.color.trim() : null,
    categoryIds: Array.isArray(source.categoryIds)
      ? source.categoryIds.filter((entry): entry is string => typeof entry === 'string' && validCategoryIds.has(entry))
      : [],
    createdAt: typeof source.createdAt === 'number' && Number.isFinite(source.createdAt) ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt) ? source.updatedAt : now,
  } satisfies ExplorerBookmarkNodeBase;

  if (kind === 'folder') {
    return {
      ...base,
      kind: 'folder',
    };
  }

  const path = typeof source.path === 'string' ? source.path.trim() : '';
  if (!path) {
    return null;
  }

  return {
    ...base,
    kind: 'bookmark',
    path,
    targetKind: source.targetKind === 'file' ? 'file' : 'directory',
  };
}

function compareBookmarkNodes(a: ExplorerBookmarkNode, b: ExplorerBookmarkNode): number {
  if (a.kind === 'folder' && b.kind !== 'folder') {
    return -1;
  }
  if (a.kind !== 'folder' && b.kind === 'folder') {
    return 1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function normalizeCategoryIds(categoryIds: string[]): string[] {
  return Array.from(new Set(categoryIds.filter((entry) => typeof entry === 'string' && entry.trim()))).sort();
}

function collectDescendantIds(nodes: ExplorerBookmarkNode[], nodeId: string): string[] {
  const descendants: string[] = [];
  const visit = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId !== parentId) {
        continue;
      }
      descendants.push(node.id);
      visit(node.id);
    }
  };
  visit(nodeId);
  return descendants;
}

function findSuggestedFolderParent(snapshot: ExplorerRailSnapshot, categoryIds: string[]): string | null {
  if (snapshot.activeCategoryIds.length === 1) {
    const match = snapshot.nodes.find((entry) => (
      entry.kind === 'folder'
      && entry.categoryIds.includes(snapshot.activeCategoryIds[0])
    ));
    if (match) {
      return match.id;
    }
  }

  for (const categoryId of categoryIds) {
    const directMatch = snapshot.nodes.find((entry) => entry.kind === 'folder' && entry.categoryIds.includes(categoryId));
    if (directMatch) {
      return directMatch.id;
    }
  }

  return null;
}

function getLeafNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function isExplorerRailSectionId(value: unknown): value is ExplorerRailSectionId {
  return typeof value === 'string' && explorerRailSectionOrder.includes(value as ExplorerRailSectionId);
}

function createStableId(prefix: string): string {
  const maybeCrypto = typeof crypto !== 'undefined' ? crypto : undefined;
  if (maybeCrypto?.randomUUID) {
    return `${prefix}-${maybeCrypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
