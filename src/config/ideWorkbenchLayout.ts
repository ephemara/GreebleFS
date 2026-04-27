export type WorkbenchShellFamilyId = 'classic' | 'ide';
export type DockPlacement = 'left-sidebar' | 'center' | 'right-sidebar' | 'bottom-panel' | 'floating';
export type DockPresentation = 'stack' | 'floating';
export type DockOrientation = 'horizontal' | 'vertical';
export type DockStackPlacement = Exclude<DockPlacement, 'floating'>;
export type WorkbenchSurfaceDefaultVisibility = 'visible' | 'collapsed' | 'hidden';

export interface WorkbenchSurfaceLayoutSeed {
  id: string;
  defaultDockPlacement: DockStackPlacement;
  defaultOrder: number;
  defaultVisibility: WorkbenchSurfaceDefaultVisibility;
}

export interface DockStackNode {
  type: 'stack';
  id: string;
  placement: DockStackPlacement;
  presentation: 'stack';
  tabs: string[];
  activeSurfaceId: string | null;
  collapsed: boolean;
}

export interface DockSplitNode {
  type: 'split';
  id: string;
  orientation: DockOrientation;
  sizes: number[];
  children: DockNode[];
}

export type DockNode = DockStackNode | DockSplitNode;

export interface FloatingDockNode {
  type: 'floating';
  id: string;
  tabs: string[];
  activeSurfaceId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IdeWorkbenchRailState {
  placement: 'left' | 'right';
  collapsed: boolean;
  width: number;
}

export interface IdeWorkbenchSurfaceState {
  hidden: boolean;
  collapsed: boolean;
}

export interface IdeWorkbenchLayoutState {
  version: 1;
  rootDockNode: DockNode;
  floatingNodes: FloatingDockNode[];
  focusedSurfaceId: string | null;
  maximizedNodeId: string | null;
  railState: IdeWorkbenchRailState;
  surfaceStateById: Record<string, IdeWorkbenchSurfaceState>;
}

export const IDE_WORKBENCH_STACK_IDS = {
  leftSidebar: 'ide:left-sidebar',
  center: 'ide:center',
  rightSidebar: 'ide:right-sidebar',
  bottomPanel: 'ide:bottom-panel',
} as const satisfies Record<string, string>;

export const IDE_WORKBENCH_SPLIT_IDS = {
  root: 'ide:root',
  centerColumn: 'ide:center-column',
} as const satisfies Record<string, string>;

const DEFAULT_RAIL_STATE: IdeWorkbenchRailState = {
  placement: 'left',
  collapsed: false,
  width: 64,
};

const DEFAULT_FLOATING_SIZE = {
  width: 540,
  height: 360,
};

const MIN_RAIL_WIDTH = 48;
const MAX_RAIL_WIDTH = 120;
const MIN_FLOATING_WIDTH = 320;
const MIN_FLOATING_HEIGHT = 220;
const MIN_SPLIT_SIZE = 0.12;
const MAX_SPLIT_SIZE = 6;

const dockPlacementToStackId: Record<DockStackPlacement, string> = {
  'left-sidebar': IDE_WORKBENCH_STACK_IDS.leftSidebar,
  center: IDE_WORKBENCH_STACK_IDS.center,
  'right-sidebar': IDE_WORKBENCH_STACK_IDS.rightSidebar,
  'bottom-panel': IDE_WORKBENCH_STACK_IDS.bottomPanel,
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function uniqueSurfaceIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const normalizedId = typeof id === 'string' ? id.trim() : '';
    if (!normalizedId || seen.has(normalizedId)) {
      return false;
    }
    seen.add(normalizedId);
    return true;
  });
}

function normalizeSurfaceTabs(
  value: unknown,
  availableSurfaceIds: Set<string>,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueSurfaceIds(
    value.filter((entry): entry is string => typeof entry === 'string' && availableSurfaceIds.has(entry.trim())),
  );
}

function normalizeSplitSizes(value: unknown, expectedLength: number, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    return [...fallback];
  }

  const normalized = value
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry)
      ? clampNumber(entry, MIN_SPLIT_SIZE, MAX_SPLIT_SIZE)
      : null));
  if (normalized.some(entry => entry == null)) {
    return [...fallback];
  }

  return normalized as number[];
}

function createDockStackNode(
  id: string,
  placement: DockStackPlacement,
  tabs: string[],
  collapsed = false,
): DockStackNode {
  return {
    type: 'stack',
    id,
    placement,
    presentation: 'stack',
    tabs: uniqueSurfaceIds(tabs),
    activeSurfaceId: tabs[0] ?? null,
    collapsed,
  };
}

function withStackActiveSurface(
  stack: DockStackNode,
  requestedSurfaceId: string | null | undefined,
): DockStackNode {
  const nextActiveSurfaceId = requestedSurfaceId && stack.tabs.includes(requestedSurfaceId)
    ? requestedSurfaceId
    : stack.tabs[0] ?? null;

  return {
    ...stack,
    activeSurfaceId: nextActiveSurfaceId,
  };
}

function createDefaultRootDockNode(
  seeds: WorkbenchSurfaceLayoutSeed[],
): DockNode {
  const sortedSeeds = [...seeds].sort((left, right) => {
    if (left.defaultOrder !== right.defaultOrder) {
      return left.defaultOrder - right.defaultOrder;
    }
    return left.id.localeCompare(right.id);
  });
  const visibleSeeds = sortedSeeds.filter(seed => seed.defaultVisibility !== 'hidden');
  const leftTabs = visibleSeeds
    .filter(seed => seed.defaultDockPlacement === 'left-sidebar')
    .map(seed => seed.id);
  const centerTabs = visibleSeeds
    .filter(seed => seed.defaultDockPlacement === 'center')
    .map(seed => seed.id);
  const rightTabs = visibleSeeds
    .filter(seed => seed.defaultDockPlacement === 'right-sidebar')
    .map(seed => seed.id);
  const bottomTabs = visibleSeeds
    .filter(seed => seed.defaultDockPlacement === 'bottom-panel')
    .map(seed => seed.id);

  const leftCollapsed = leftTabs.length === 0
    || leftTabs.every(tabId => (
      seeds.find(seed => seed.id === tabId)?.defaultVisibility === 'collapsed'
    ));
  const bottomCollapsed = bottomTabs.length > 0;
  const rightCollapsed = rightTabs.length === 0;

  return {
    type: 'split',
    id: IDE_WORKBENCH_SPLIT_IDS.root,
    orientation: 'horizontal',
    sizes: [0.24, 1, 0.3],
    children: [
      withStackActiveSurface(
        createDockStackNode(
          IDE_WORKBENCH_STACK_IDS.leftSidebar,
          'left-sidebar',
          leftTabs,
          leftCollapsed,
        ),
        leftTabs[0],
      ),
      {
        type: 'split',
        id: IDE_WORKBENCH_SPLIT_IDS.centerColumn,
        orientation: 'vertical',
        sizes: [1, 0.3],
        children: [
          withStackActiveSurface(
            createDockStackNode(
              IDE_WORKBENCH_STACK_IDS.center,
              'center',
              centerTabs.length > 0 ? centerTabs : seeds.slice(0, 1).map(seed => seed.id),
              false,
            ),
            centerTabs[0] ?? seeds[0]?.id ?? null,
          ),
          withStackActiveSurface(
            createDockStackNode(
              IDE_WORKBENCH_STACK_IDS.bottomPanel,
              'bottom-panel',
              bottomTabs,
              bottomCollapsed,
            ),
            bottomTabs[0] ?? null,
          ),
        ],
      },
      withStackActiveSurface(
        createDockStackNode(
          IDE_WORKBENCH_STACK_IDS.rightSidebar,
          'right-sidebar',
          rightTabs,
          rightCollapsed,
        ),
        rightTabs[0] ?? null,
      ),
    ],
  };
}

function createDefaultSurfaceStateById(
  seeds: WorkbenchSurfaceLayoutSeed[],
): Record<string, IdeWorkbenchSurfaceState> {
  return Object.fromEntries(
    seeds.map(seed => [
      seed.id,
      {
        hidden: seed.defaultVisibility === 'hidden',
        collapsed: seed.defaultVisibility === 'collapsed',
      },
    ]),
  );
}

export function collectSurfaceIdsFromDockNode(node: DockNode): string[] {
  if (node.type === 'stack') {
    return [...node.tabs];
  }

  return node.children.flatMap(collectSurfaceIdsFromDockNode);
}

export function collectSurfaceIdsFromFloatingNodes(nodes: FloatingDockNode[]): string[] {
  return nodes.flatMap(node => node.tabs);
}

function updateDockNode(
  node: DockNode,
  updater: (candidate: DockNode) => DockNode,
): DockNode {
  const updatedNode = updater(node);
  if (updatedNode.type !== 'split') {
    return updatedNode;
  }

  return {
    ...updatedNode,
    children: updatedNode.children.map(child => updateDockNode(child, updater)),
  };
}

function updateDockStackById(
  node: DockNode,
  stackId: string,
  updater: (stack: DockStackNode) => DockStackNode,
): DockNode {
  return updateDockNode(node, (candidate) => {
    if (candidate.type !== 'stack' || candidate.id !== stackId) {
      return candidate;
    }

    return updater(candidate);
  });
}

function updateDockSplitById(
  node: DockNode,
  splitId: string,
  updater: (split: DockSplitNode) => DockSplitNode,
): DockNode {
  return updateDockNode(node, (candidate) => {
    if (candidate.type !== 'split' || candidate.id !== splitId) {
      return candidate;
    }

    return updater(candidate);
  });
}

function findDockStackById(node: DockNode, stackId: string): DockStackNode | null {
  if (node.type === 'stack') {
    return node.id === stackId ? node : null;
  }

  for (const child of node.children) {
    const match = findDockStackById(child, stackId);
    if (match) {
      return match;
    }
  }

  return null;
}

function collectDockStacks(node: DockNode): DockStackNode[] {
  if (node.type === 'stack') {
    return [node];
  }

  return node.children.flatMap(collectDockStacks);
}

function getDockStackPrimarySurfaceId(stack: DockStackNode | null | undefined): string | null {
  if (!stack) {
    return null;
  }

  if (stack.activeSurfaceId && stack.tabs.includes(stack.activeSurfaceId)) {
    return stack.activeSurfaceId;
  }

  return stack.tabs[0] ?? null;
}

function getFloatingDockPrimarySurfaceId(node: FloatingDockNode | null | undefined): string | null {
  if (!node) {
    return null;
  }

  if (node.activeSurfaceId && node.tabs.includes(node.activeSurfaceId)) {
    return node.activeSurfaceId;
  }

  return node.tabs[0] ?? null;
}

function resolvePreferredDockSurfaceId(
  rootDockNode: DockNode,
  floatingNodes: FloatingDockNode[],
): string | null {
  const centerSurfaceId = getDockStackPrimarySurfaceId(
    findDockStackById(rootDockNode, IDE_WORKBENCH_STACK_IDS.center),
  );
  if (centerSurfaceId) {
    return centerSurfaceId;
  }

  const expandedDockSurfaceId = collectDockStacks(rootDockNode)
    .find(stack => !stack.collapsed && stack.tabs.length > 0);
  if (expandedDockSurfaceId) {
    return getDockStackPrimarySurfaceId(expandedDockSurfaceId);
  }

  const floatingSurfaceId = floatingNodes
    .map(getFloatingDockPrimarySurfaceId)
    .find((surfaceId): surfaceId is string => Boolean(surfaceId));
  if (floatingSurfaceId) {
    return floatingSurfaceId;
  }

  return collectSurfaceIdsFromDockNode(rootDockNode)[0]
    ?? collectSurfaceIdsFromFloatingNodes(floatingNodes)[0]
    ?? null;
}

function findDockStackContainingSurface(node: DockNode, surfaceId: string): DockStackNode | null {
  if (node.type === 'stack') {
    return node.tabs.includes(surfaceId) ? node : null;
  }

  for (const child of node.children) {
    const match = findDockStackContainingSurface(child, surfaceId);
    if (match) {
      return match;
    }
  }

  return null;
}

function removeSurfaceFromDockNode(node: DockNode, surfaceId: string): DockNode {
  return updateDockNode(node, (candidate) => {
    if (candidate.type !== 'stack') {
      return candidate;
    }

    if (!candidate.tabs.includes(surfaceId)) {
      return candidate;
    }

    const nextTabs = candidate.tabs.filter(tabId => tabId !== surfaceId);
    return withStackActiveSurface(
      {
        ...candidate,
        tabs: nextTabs,
      },
      candidate.activeSurfaceId === surfaceId ? nextTabs[0] ?? null : candidate.activeSurfaceId,
    );
  });
}

function appendSurfaceToDockStack(
  node: DockNode,
  stackId: string,
  surfaceId: string,
  activate = true,
): DockNode {
  return updateDockStackById(node, stackId, (stack) => {
    const nextTabs = stack.tabs.includes(surfaceId)
      ? stack.tabs
      : [...stack.tabs, surfaceId];

    return {
      ...withStackActiveSurface(
        {
          ...stack,
          tabs: nextTabs,
          collapsed: false,
        },
        activate ? surfaceId : stack.activeSurfaceId,
      ),
    };
  });
}

function normalizeFloatingNode(
  value: unknown,
  availableSurfaceIds: Set<string>,
  usedSurfaceIds: Set<string>,
  index: number,
): FloatingDockNode | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Partial<FloatingDockNode>;
  const tabs = normalizeSurfaceTabs(source.tabs, availableSurfaceIds)
    .filter((surfaceId) => {
      if (usedSurfaceIds.has(surfaceId)) {
        return false;
      }
      usedSurfaceIds.add(surfaceId);
      return true;
    });
  if (tabs.length === 0) {
    return null;
  }

  const activeSurfaceId = typeof source.activeSurfaceId === 'string' && tabs.includes(source.activeSurfaceId)
    ? source.activeSurfaceId
    : tabs[0];

  return {
    type: 'floating',
    id: typeof source.id === 'string' && source.id.trim().length > 0
      ? source.id.trim()
      : `ide:floating:${index}`,
    tabs,
    activeSurfaceId,
    x: typeof source.x === 'number' && Number.isFinite(source.x) ? source.x : 132 + index * 24,
    y: typeof source.y === 'number' && Number.isFinite(source.y) ? source.y : 108 + index * 18,
    width: clampNumber(
      typeof source.width === 'number' && Number.isFinite(source.width)
        ? source.width
        : DEFAULT_FLOATING_SIZE.width,
      MIN_FLOATING_WIDTH,
      1600,
    ),
    height: clampNumber(
      typeof source.height === 'number' && Number.isFinite(source.height)
        ? source.height
        : DEFAULT_FLOATING_SIZE.height,
      MIN_FLOATING_HEIGHT,
      1200,
    ),
  };
}

function buildNormalizedRootDockNode(
  inputNode: unknown,
  seeds: WorkbenchSurfaceLayoutSeed[],
  surfaceStateById: Record<string, IdeWorkbenchSurfaceState>,
): DockNode {
  const availableSurfaceIds = new Set(seeds.map(seed => seed.id));
  const defaultRoot = createDefaultRootDockNode(seeds);
  const sourceNode = inputNode && typeof inputNode === 'object' && !Array.isArray(inputNode)
    ? inputNode as Partial<DockNode>
    : null;

  const splitOverridesById = new Map<string, number[]>();
  const stackOverridesById = new Map<string, Partial<DockStackNode>>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return;
    }

    const source = node as Partial<DockNode>;
    if (source.type === 'split' && typeof source.id === 'string') {
      const children = Array.isArray(source.children) ? source.children : [];
      splitOverridesById.set(
        source.id,
        normalizeSplitSizes(source.sizes, children.length, []),
      );
      children.forEach(walk);
      return;
    }

    if (source.type === 'stack' && typeof source.id === 'string') {
      stackOverridesById.set(source.id, source);
    }
  };

  walk(sourceNode);

  const hiddenSurfaceIds = new Set(
    Object.entries(surfaceStateById)
      .filter(([, surfaceState]) => surfaceState.hidden)
      .map(([surfaceId]) => surfaceId),
  );
  const placedSurfaceIds = new Set<string>();

  let nextRoot = updateDockNode(defaultRoot, (candidate) => {
    if (candidate.type === 'split') {
      const overrideSizes = splitOverridesById.get(candidate.id);
      return {
        ...candidate,
        sizes: normalizeSplitSizes(overrideSizes, candidate.children.length, candidate.sizes),
      };
    }

    const override = stackOverridesById.get(candidate.id);
    const overrideTabs = normalizeSurfaceTabs(override?.tabs, availableSurfaceIds)
      .filter(surfaceId => !hiddenSurfaceIds.has(surfaceId))
      .filter((surfaceId) => {
        if (placedSurfaceIds.has(surfaceId)) {
          return false;
        }
        placedSurfaceIds.add(surfaceId);
        return true;
      });
    const nextTabs = overrideTabs.length > 0 ? overrideTabs : candidate.tabs.filter(surfaceId => !hiddenSurfaceIds.has(surfaceId));
    const nextStack: DockStackNode = {
      ...candidate,
      tabs: nextTabs,
      collapsed: typeof override?.collapsed === 'boolean' ? override.collapsed : candidate.collapsed,
    };

    return withStackActiveSurface(nextStack, override?.activeSurfaceId ?? nextStack.activeSurfaceId);
  });

  for (const seed of seeds) {
    if (surfaceStateById[seed.id]?.hidden || placedSurfaceIds.has(seed.id)) {
      continue;
    }

    nextRoot = appendSurfaceToDockStack(
      nextRoot,
      dockPlacementToStackId[seed.defaultDockPlacement],
      seed.id,
      seed.defaultDockPlacement === 'center',
    );
    placedSurfaceIds.add(seed.id);
  }

  return nextRoot;
}

function normalizeSurfaceStateById(
  value: unknown,
  seeds: WorkbenchSurfaceLayoutSeed[],
): Record<string, IdeWorkbenchSurfaceState> {
  const defaultSurfaceStateById = createDefaultSurfaceStateById(seeds);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultSurfaceStateById;
  }

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    seeds.map((seed) => {
      const partialState = source[seed.id] as Partial<IdeWorkbenchSurfaceState> | undefined;
      return [
        seed.id,
        {
          hidden: typeof partialState?.hidden === 'boolean'
            ? partialState.hidden
            : defaultSurfaceStateById[seed.id]?.hidden ?? false,
          collapsed: typeof partialState?.collapsed === 'boolean'
            ? partialState.collapsed
            : defaultSurfaceStateById[seed.id]?.collapsed ?? false,
        },
      ] satisfies [string, IdeWorkbenchSurfaceState];
    }),
  );
}

export function createDefaultIdeWorkbenchLayoutState(
  seeds: WorkbenchSurfaceLayoutSeed[],
): IdeWorkbenchLayoutState {
  const surfaceStateById = createDefaultSurfaceStateById(seeds);
  const rootDockNode = createDefaultRootDockNode(seeds);
  const floatingNodes: FloatingDockNode[] = [];
  const focusedSurfaceId = resolvePreferredDockSurfaceId(rootDockNode, floatingNodes);

  return {
    version: 1,
    rootDockNode,
    floatingNodes,
    focusedSurfaceId,
    maximizedNodeId: null,
    railState: DEFAULT_RAIL_STATE,
    surfaceStateById,
  };
}

export function normalizeIdeWorkbenchLayoutState(
  value: unknown,
  seeds: WorkbenchSurfaceLayoutSeed[],
): IdeWorkbenchLayoutState {
  const defaultState = createDefaultIdeWorkbenchLayoutState(seeds);
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<IdeWorkbenchLayoutState>
    : {};
  const surfaceStateById = normalizeSurfaceStateById(source.surfaceStateById, seeds);
  const rootDockNode = buildNormalizedRootDockNode(source.rootDockNode, seeds, surfaceStateById);
  const availableSurfaceIds = new Set(seeds.map(seed => seed.id));
  const usedSurfaceIds = new Set(collectSurfaceIdsFromDockNode(rootDockNode));
  const floatingNodes = Array.isArray(source.floatingNodes)
    ? source.floatingNodes
      .map((entry, index) => normalizeFloatingNode(entry, availableSurfaceIds, usedSurfaceIds, index))
      .filter((entry): entry is FloatingDockNode => Boolean(entry))
    : defaultState.floatingNodes;
  const placedSurfaceIds = new Set([
    ...collectSurfaceIdsFromDockNode(rootDockNode),
    ...collectSurfaceIdsFromFloatingNodes(floatingNodes),
  ]);
  const focusedSurfaceId = typeof source.focusedSurfaceId === 'string' && placedSurfaceIds.has(source.focusedSurfaceId)
    ? source.focusedSurfaceId
    : resolvePreferredDockSurfaceId(rootDockNode, floatingNodes);

  const railStateSource = source.railState && typeof source.railState === 'object' && !Array.isArray(source.railState)
    ? source.railState as Partial<IdeWorkbenchRailState>
    : {};
  const railState: IdeWorkbenchRailState = {
    placement: railStateSource.placement === 'right' ? 'right' : DEFAULT_RAIL_STATE.placement,
    collapsed: railStateSource.collapsed === true,
    width: clampNumber(
      typeof railStateSource.width === 'number' && Number.isFinite(railStateSource.width)
        ? railStateSource.width
        : DEFAULT_RAIL_STATE.width,
      MIN_RAIL_WIDTH,
      MAX_RAIL_WIDTH,
    ),
  };

  const nextMaximizedNodeId = typeof source.maximizedNodeId === 'string' && source.maximizedNodeId.trim().length > 0
    ? source.maximizedNodeId.trim()
    : null;
  const dockIds = new Set([
    IDE_WORKBENCH_STACK_IDS.leftSidebar,
    IDE_WORKBENCH_STACK_IDS.center,
    IDE_WORKBENCH_STACK_IDS.rightSidebar,
    IDE_WORKBENCH_STACK_IDS.bottomPanel,
    ...floatingNodes.map(node => node.id),
  ]);

  return {
    version: 1,
    rootDockNode,
    floatingNodes,
    focusedSurfaceId,
    maximizedNodeId: nextMaximizedNodeId && dockIds.has(nextMaximizedNodeId)
      ? nextMaximizedNodeId
      : null,
    railState,
    surfaceStateById,
  };
}

export function areIdeWorkbenchLayoutStatesEqual(
  left: IdeWorkbenchLayoutState,
  right: IdeWorkbenchLayoutState,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function resolvePrimaryIdeWorkbenchSurfaceId(
  layoutState: Pick<IdeWorkbenchLayoutState, 'rootDockNode' | 'floatingNodes'>,
): string | null {
  return resolvePreferredDockSurfaceId(layoutState.rootDockNode, layoutState.floatingNodes);
}

export function getStackIdForDockPlacement(placement: DockStackPlacement): string {
  return dockPlacementToStackId[placement];
}

export function findDockPlacementForSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): DockPlacement | null {
  const stack = findDockStackContainingSurface(layoutState.rootDockNode, surfaceId);
  if (stack) {
    return stack.placement;
  }

  return layoutState.floatingNodes.some(node => node.tabs.includes(surfaceId))
    ? 'floating'
    : null;
}

function ensureSurfaceVisibleState(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): IdeWorkbenchLayoutState {
  const currentSurfaceState = layoutState.surfaceStateById[surfaceId];
  if (!currentSurfaceState?.hidden) {
    return layoutState;
  }

  return {
    ...layoutState,
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: {
        hidden: false,
        collapsed: false,
      },
    },
  };
}

function updateFloatingNodesForSurface(
  floatingNodes: FloatingDockNode[],
  surfaceId: string,
  updater: (node: FloatingDockNode) => FloatingDockNode | null,
): FloatingDockNode[] {
  return floatingNodes.flatMap((node) => {
    if (!node.tabs.includes(surfaceId)) {
      return [node];
    }

    const nextNode = updater(node);
    return nextNode ? [nextNode] : [];
  });
}

export function moveSurfaceToDockPlacement(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  placement: DockStackPlacement,
): IdeWorkbenchLayoutState {
  const withoutFloatingSurface = updateFloatingNodesForSurface(
    layoutState.floatingNodes,
    surfaceId,
    (node) => {
      const nextTabs = node.tabs.filter(tabId => tabId !== surfaceId);
      if (nextTabs.length === 0) {
        return null;
      }

      return {
        ...node,
        tabs: nextTabs,
        activeSurfaceId: node.activeSurfaceId === surfaceId
          ? nextTabs[0] ?? null
          : node.activeSurfaceId,
      };
    },
  );
  const nextRoot = appendSurfaceToDockStack(
    removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId),
    dockPlacementToStackId[placement],
    surfaceId,
    true,
  );

  return {
    ...ensureSurfaceVisibleState(layoutState, surfaceId),
    rootDockNode: nextRoot,
    floatingNodes: withoutFloatingSurface,
    focusedSurfaceId: surfaceId,
  };
}

export function focusDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  seeds: WorkbenchSurfaceLayoutSeed[],
): IdeWorkbenchLayoutState {
  const currentPlacement = findDockPlacementForSurface(layoutState, surfaceId);
  if (currentPlacement === 'floating') {
    return {
      ...layoutState,
      floatingNodes: updateFloatingNodesForSurface(layoutState.floatingNodes, surfaceId, node => ({
        ...node,
        activeSurfaceId: surfaceId,
      })),
      focusedSurfaceId: surfaceId,
    };
  }

  if (currentPlacement) {
    const stackId = getStackIdForDockPlacement(currentPlacement);
    return {
      ...ensureSurfaceVisibleState(layoutState, surfaceId),
      rootDockNode: updateDockStackById(layoutState.rootDockNode, stackId, stack => ({
        ...withStackActiveSurface(
          {
            ...stack,
            collapsed: false,
          },
          surfaceId,
        ),
      })),
      focusedSurfaceId: surfaceId,
    };
  }

  const seed = seeds.find(candidate => candidate.id === surfaceId);
  return seed
    ? moveSurfaceToDockPlacement(
      ensureSurfaceVisibleState(layoutState, surfaceId),
      surfaceId,
      seed.defaultDockPlacement,
    )
    : layoutState;
}

export function hideDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): IdeWorkbenchLayoutState {
  const nextRoot = removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId);
  const nextFloatingNodes = updateFloatingNodesForSurface(layoutState.floatingNodes, surfaceId, node => {
    const nextTabs = node.tabs.filter(tabId => tabId !== surfaceId);
    if (nextTabs.length === 0) {
      return null;
    }

    return {
      ...node,
      tabs: nextTabs,
      activeSurfaceId: node.activeSurfaceId === surfaceId
        ? nextTabs[0] ?? null
        : node.activeSurfaceId,
    };
  });

  return {
    ...layoutState,
    rootDockNode: nextRoot,
    floatingNodes: nextFloatingNodes,
    focusedSurfaceId: layoutState.focusedSurfaceId === surfaceId
      ? resolvePreferredDockSurfaceId(nextRoot, nextFloatingNodes)
      : layoutState.focusedSurfaceId,
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: {
        hidden: true,
        collapsed: false,
      },
    },
  };
}

export function floatDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): IdeWorkbenchLayoutState {
  const existingNode = layoutState.floatingNodes.find(node => node.tabs.includes(surfaceId));
  if (existingNode) {
    return {
      ...layoutState,
      focusedSurfaceId: surfaceId,
    };
  }

  const nextFloatingId = `ide:floating:${Date.now()}:${surfaceId}`;
  const nextFloatingNodes = [
    ...updateFloatingNodesForSurface(layoutState.floatingNodes, surfaceId, node => {
      const nextTabs = node.tabs.filter(tabId => tabId !== surfaceId);
      if (nextTabs.length === 0) {
        return null;
      }

      return {
        ...node,
        tabs: nextTabs,
        activeSurfaceId: node.activeSurfaceId === surfaceId
          ? nextTabs[0] ?? null
          : node.activeSurfaceId,
      };
    }),
    {
      type: 'floating' as const,
      id: nextFloatingId,
      tabs: [surfaceId],
      activeSurfaceId: surfaceId,
      x: 132 + layoutState.floatingNodes.length * 24,
      y: 108 + layoutState.floatingNodes.length * 18,
      width: DEFAULT_FLOATING_SIZE.width,
      height: DEFAULT_FLOATING_SIZE.height,
    },
  ];

  return {
    ...ensureSurfaceVisibleState(layoutState, surfaceId),
    rootDockNode: removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId),
    floatingNodes: nextFloatingNodes,
    focusedSurfaceId: surfaceId,
  };
}

export function updateDockStackCollapsed(
  layoutState: IdeWorkbenchLayoutState,
  stackId: string,
  collapsed: boolean,
): IdeWorkbenchLayoutState {
  return {
    ...layoutState,
    rootDockNode: updateDockStackById(layoutState.rootDockNode, stackId, stack => ({
      ...stack,
      collapsed,
    })),
  };
}

export function toggleDockStackCollapsed(
  layoutState: IdeWorkbenchLayoutState,
  stackId: string,
): IdeWorkbenchLayoutState {
  const targetStack = findDockStackById(layoutState.rootDockNode, stackId);
  if (!targetStack) {
    return layoutState;
  }

  return updateDockStackCollapsed(layoutState, stackId, !targetStack.collapsed);
}

export function updateDockSplitSizes(
  layoutState: IdeWorkbenchLayoutState,
  splitId: string,
  sizes: number[],
): IdeWorkbenchLayoutState {
  return {
    ...layoutState,
    rootDockNode: updateDockSplitById(layoutState.rootDockNode, splitId, split => ({
      ...split,
      sizes: normalizeSplitSizes(sizes, split.children.length, split.sizes),
    })),
  };
}

export function toggleDockMaximize(
  layoutState: IdeWorkbenchLayoutState,
  nodeId: string,
): IdeWorkbenchLayoutState {
  return {
    ...layoutState,
    maximizedNodeId: layoutState.maximizedNodeId === nodeId ? null : nodeId,
  };
}

export function updateFloatingDockNodeBounds(
  layoutState: IdeWorkbenchLayoutState,
  floatingNodeId: string,
  bounds: Partial<Pick<FloatingDockNode, 'x' | 'y' | 'width' | 'height'>>,
): IdeWorkbenchLayoutState {
  return {
    ...layoutState,
    floatingNodes: layoutState.floatingNodes.map((node) => {
      if (node.id !== floatingNodeId) {
        return node;
      }

      return {
        ...node,
        x: typeof bounds.x === 'number' && Number.isFinite(bounds.x) ? bounds.x : node.x,
        y: typeof bounds.y === 'number' && Number.isFinite(bounds.y) ? bounds.y : node.y,
        width: clampNumber(
          typeof bounds.width === 'number' && Number.isFinite(bounds.width)
            ? bounds.width
            : node.width,
          MIN_FLOATING_WIDTH,
          1600,
        ),
        height: clampNumber(
          typeof bounds.height === 'number' && Number.isFinite(bounds.height)
            ? bounds.height
            : node.height,
          MIN_FLOATING_HEIGHT,
          1200,
        ),
      };
    }),
  };
}

export function closeFloatingDockNode(
  layoutState: IdeWorkbenchLayoutState,
  floatingNodeId: string,
): IdeWorkbenchLayoutState {
  const floatingNode = layoutState.floatingNodes.find(node => node.id === floatingNodeId);
  if (!floatingNode) {
    return layoutState;
  }

  let nextState = {
    ...layoutState,
    floatingNodes: layoutState.floatingNodes.filter(node => node.id !== floatingNodeId),
  };
  for (const surfaceId of floatingNode.tabs) {
    nextState = hideDockSurface(nextState, surfaceId);
  }

  return nextState;
}

export function updateIdeRailState(
  layoutState: IdeWorkbenchLayoutState,
  updates: Partial<IdeWorkbenchRailState>,
): IdeWorkbenchLayoutState {
  return {
    ...layoutState,
    railState: {
      placement: updates.placement === 'right' ? 'right' : (updates.placement === 'left' ? 'left' : layoutState.railState.placement),
      collapsed: typeof updates.collapsed === 'boolean' ? updates.collapsed : layoutState.railState.collapsed,
      width: clampNumber(
        typeof updates.width === 'number' && Number.isFinite(updates.width)
          ? updates.width
          : layoutState.railState.width,
        MIN_RAIL_WIDTH,
        MAX_RAIL_WIDTH,
      ),
    },
  };
}
