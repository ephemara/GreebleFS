export type WorkbenchShellFamilyId = 'classic' | 'ide';
export type DockPlacement = 'left-sidebar' | 'center' | 'right-sidebar' | 'bottom-panel' | 'floating';
export type DockPresentation = 'stack' | 'floating';
export type DockOrientation = 'horizontal' | 'vertical';
export type DockStackPlacement = Exclude<DockPlacement, 'floating'>;
export type WorkbenchSurfaceDefaultVisibility = 'visible' | 'collapsed' | 'hidden';
export type WorkbenchSurfaceIdeRole = 'explorer-core' | 'utility';

export interface WorkbenchSurfaceLayoutSeed {
  id: string;
  defaultDockPlacement: DockStackPlacement;
  defaultOrder: number;
  defaultVisibility: WorkbenchSurfaceDefaultVisibility;
  ideRole?: WorkbenchSurfaceIdeRole;
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

export interface IdeWorkbenchSourcesRailState {
  visible: boolean;
  preferredWidth: number;
  emphasizeLocalTree: boolean;
  followActiveFolder: boolean;
}

export interface IdeWorkbenchInspectorRailState {
  visible: boolean;
  preferredWidth: number;
  mode: 'preview-inspector';
}

export interface IdeWorkbenchBottomDockState {
  collapsed: boolean;
  preferredHeight: number;
}

export interface IdeWorkbenchSurfaceState {
  hidden: boolean;
  collapsed: boolean;
  externalizedWindowId: string | null;
  externalizedRestorePlacement: DockStackPlacement | null;
}

export interface IdeWorkbenchLayoutState {
  version: 2;
  rootDockNode: DockNode;
  floatingNodes: FloatingDockNode[];
  focusedSurfaceId: string | null;
  maximizedNodeId: string | null;
  activityRailState: IdeWorkbenchRailState;
  sourcesRailState: IdeWorkbenchSourcesRailState;
  inspectorRailState: IdeWorkbenchInspectorRailState;
  bottomDockState: IdeWorkbenchBottomDockState;
  explorerInspectorLinkMode: 'live-linked';
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

const EXPLORER_CORE_SURFACE_ID = 'explorer';
const CURRENT_IDE_WORKBENCH_LAYOUT_STATE_VERSION = 2;

const DEFAULT_ACTIVITY_RAIL_STATE: IdeWorkbenchRailState = {
  placement: 'left',
  collapsed: false,
  width: 64,
};

const DEFAULT_SOURCES_RAIL_STATE: IdeWorkbenchSourcesRailState = {
  visible: true,
  preferredWidth: 320,
  emphasizeLocalTree: true,
  followActiveFolder: true,
};

const DEFAULT_INSPECTOR_RAIL_STATE: IdeWorkbenchInspectorRailState = {
  visible: true,
  preferredWidth: 420,
  mode: 'preview-inspector',
};

const DEFAULT_BOTTOM_DOCK_STATE: IdeWorkbenchBottomDockState = {
  collapsed: true,
  preferredHeight: 320,
};

const DEFAULT_FLOATING_SIZE = {
  width: 540,
  height: 360,
};

const MIN_RAIL_WIDTH = 48;
const MAX_RAIL_WIDTH = 120;
const MIN_SOURCES_RAIL_WIDTH = 220;
const MAX_SOURCES_RAIL_WIDTH = 520;
const MIN_INSPECTOR_RAIL_WIDTH = 280;
const MAX_INSPECTOR_RAIL_WIDTH = 680;
const MIN_BOTTOM_DOCK_HEIGHT = 180;
const MAX_BOTTOM_DOCK_HEIGHT = 640;
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

function isExplorerCoreSurface(surfaceId: string): boolean {
  return surfaceId === EXPLORER_CORE_SURFACE_ID;
}

function normalizeUtilityDockPlacement(placement: DockStackPlacement): DockStackPlacement {
  if (placement === 'center' || placement === 'left-sidebar') {
    return 'right-sidebar';
  }

  return placement;
}

function normalizeDockStackPlacement(value: unknown): DockStackPlacement | null {
  return value === 'left-sidebar'
    || value === 'center'
    || value === 'right-sidebar'
    || value === 'bottom-panel'
    ? value
    : null;
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
  const centerTabs = visibleSeeds
    .filter(seed => isExplorerCoreSurface(seed.id))
    .map(seed => seed.id);
  const rightSeeds = visibleSeeds
    .filter(seed => !isExplorerCoreSurface(seed.id))
    .filter(seed => normalizeUtilityDockPlacement(seed.defaultDockPlacement) === 'right-sidebar')
    .sort((left, right) => left.defaultOrder - right.defaultOrder);
  const bottomSeeds = visibleSeeds
    .filter(seed => !isExplorerCoreSurface(seed.id))
    .filter(seed => normalizeUtilityDockPlacement(seed.defaultDockPlacement) === 'bottom-panel')
    .sort((left, right) => left.defaultOrder - right.defaultOrder);
  const rightTabs = rightSeeds.map(seed => seed.id);
  const bottomTabs = bottomSeeds.map(seed => seed.id);
  const rightCollapsed = rightSeeds.length === 0
    ? true
    : rightSeeds.every(seed => seed.defaultVisibility === 'collapsed');
  const bottomCollapsed = bottomSeeds.length === 0
    ? true
    : bottomSeeds.every(seed => seed.defaultVisibility === 'collapsed');

  return {
    type: 'split',
    id: IDE_WORKBENCH_SPLIT_IDS.root,
    orientation: 'horizontal',
    sizes: [1, 0.34],
    children: [
      {
        type: 'split',
        id: IDE_WORKBENCH_SPLIT_IDS.centerColumn,
        orientation: 'vertical',
        sizes: [1, 0.32],
        children: [
          withStackActiveSurface(
            createDockStackNode(
              IDE_WORKBENCH_STACK_IDS.center,
              'center',
              centerTabs.length > 0 ? centerTabs : [EXPLORER_CORE_SURFACE_ID],
              false,
            ),
            centerTabs[0] ?? EXPLORER_CORE_SURFACE_ID,
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
        hidden: isExplorerCoreSurface(seed.id)
          ? false
          : seed.defaultVisibility === 'hidden',
        collapsed: isExplorerCoreSurface(seed.id)
          ? false
          : seed.defaultVisibility === 'collapsed',
        externalizedWindowId: null,
        externalizedRestorePlacement: null,
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

export function collectExternalizedSurfaceIds(
  layoutState: IdeWorkbenchLayoutState,
): string[] {
  return Object.entries(layoutState.surfaceStateById)
    .filter(([, surfaceState]) => Boolean(surfaceState.externalizedWindowId))
    .map(([surfaceId]) => surfaceId);
}

export function isDockSurfaceExternalized(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): boolean {
  return Boolean(layoutState.surfaceStateById[surfaceId]?.externalizedWindowId);
}

export function getExternalizedSurfaceWindowId(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): string | null {
  return layoutState.surfaceStateById[surfaceId]?.externalizedWindowId ?? null;
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

function normalizeDockNodeAfterMutation(node: DockNode): DockNode {
  return updateDockNode(node, (candidate) => {
    if (candidate.type !== 'stack') {
      return candidate;
    }

    return withStackActiveSurface(
      {
        ...candidate,
        collapsed: candidate.id === IDE_WORKBENCH_STACK_IDS.center
          ? false
          : candidate.tabs.length === 0
            ? true
            : candidate.collapsed,
      },
      candidate.activeSurfaceId,
    );
  });
}

function synchronizeBottomDockState(
  rootDockNode: DockNode,
  bottomDockState: IdeWorkbenchBottomDockState,
): IdeWorkbenchBottomDockState {
  const bottomStack = findDockStackById(rootDockNode, IDE_WORKBENCH_STACK_IDS.bottomPanel);
  if (!bottomStack || bottomStack.tabs.length === 0) {
    return {
      ...bottomDockState,
      collapsed: true,
    };
  }

  return {
    ...bottomDockState,
    collapsed: bottomStack.collapsed,
  };
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

  const withheldSurfaceIds = new Set(
    Object.entries(surfaceStateById)
      .filter(([, surfaceState]) => surfaceState.hidden || Boolean(surfaceState.externalizedWindowId))
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
      .filter(surfaceId => !withheldSurfaceIds.has(surfaceId))
      .filter((surfaceId) => {
        if (candidate.id === IDE_WORKBENCH_STACK_IDS.center) {
          return isExplorerCoreSurface(surfaceId);
        }

        return !isExplorerCoreSurface(surfaceId);
      })
      .filter((surfaceId) => {
        if (placedSurfaceIds.has(surfaceId)) {
          return false;
        }
        placedSurfaceIds.add(surfaceId);
        return true;
      });
    const nextTabs = overrideTabs.length > 0
      ? overrideTabs
      : candidate.tabs
        .filter(surfaceId => !withheldSurfaceIds.has(surfaceId))
        .filter((surfaceId) => {
          if (candidate.id === IDE_WORKBENCH_STACK_IDS.center) {
            return isExplorerCoreSurface(surfaceId);
          }

          return !isExplorerCoreSurface(surfaceId);
        });
    const nextStack: DockStackNode = {
      ...candidate,
      tabs: nextTabs,
      collapsed: candidate.id === IDE_WORKBENCH_STACK_IDS.center
        ? false
        : (typeof override?.collapsed === 'boolean' ? override.collapsed : candidate.collapsed),
    };

    return withStackActiveSurface(nextStack, override?.activeSurfaceId ?? nextStack.activeSurfaceId);
  });

  for (const seed of seeds) {
    if (
      surfaceStateById[seed.id]?.hidden
      || surfaceStateById[seed.id]?.externalizedWindowId
      || placedSurfaceIds.has(seed.id)
    ) {
      continue;
    }

    nextRoot = appendSurfaceToDockStack(
      nextRoot,
      isExplorerCoreSurface(seed.id)
        ? dockPlacementToStackId.center
        : dockPlacementToStackId[normalizeUtilityDockPlacement(seed.defaultDockPlacement)],
      seed.id,
      isExplorerCoreSurface(seed.id),
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
          hidden: isExplorerCoreSurface(seed.id)
            ? false
            : typeof partialState?.hidden === 'boolean'
            ? partialState.hidden
            : defaultSurfaceStateById[seed.id]?.hidden ?? false,
          collapsed: isExplorerCoreSurface(seed.id)
            ? false
            : typeof partialState?.collapsed === 'boolean'
            ? partialState.collapsed
            : defaultSurfaceStateById[seed.id]?.collapsed ?? false,
          externalizedWindowId: isExplorerCoreSurface(seed.id)
            ? null
            : typeof partialState?.externalizedWindowId === 'string' && partialState.externalizedWindowId.trim()
            ? partialState.externalizedWindowId.trim()
            : null,
          externalizedRestorePlacement: isExplorerCoreSurface(seed.id)
            ? null
            : normalizeDockStackPlacement(partialState?.externalizedRestorePlacement),
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
    version: CURRENT_IDE_WORKBENCH_LAYOUT_STATE_VERSION,
    rootDockNode,
    floatingNodes,
    focusedSurfaceId,
    maximizedNodeId: null,
    activityRailState: DEFAULT_ACTIVITY_RAIL_STATE,
    sourcesRailState: DEFAULT_SOURCES_RAIL_STATE,
    inspectorRailState: DEFAULT_INSPECTOR_RAIL_STATE,
    bottomDockState: DEFAULT_BOTTOM_DOCK_STATE,
    explorerInspectorLinkMode: 'live-linked',
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
  const sourceVersion = typeof source.version === 'number' ? source.version : null;
  const shouldResetLegacyWorkbenchLayout = sourceVersion !== CURRENT_IDE_WORKBENCH_LAYOUT_STATE_VERSION;
  const surfaceStateById = shouldResetLegacyWorkbenchLayout
    ? defaultState.surfaceStateById
    : normalizeSurfaceStateById(source.surfaceStateById, seeds);
  const rootDockNode = shouldResetLegacyWorkbenchLayout
    ? defaultState.rootDockNode
    : buildNormalizedRootDockNode(source.rootDockNode, seeds, surfaceStateById);
  const availableSurfaceIds = new Set(seeds.map(seed => seed.id));
  const usedSurfaceIds = new Set(collectSurfaceIdsFromDockNode(rootDockNode));
  const floatingNodes = shouldResetLegacyWorkbenchLayout
    ? defaultState.floatingNodes
    : Array.isArray(source.floatingNodes)
      ? source.floatingNodes
        .map((entry, index) => normalizeFloatingNode(entry, availableSurfaceIds, usedSurfaceIds, index))
        .filter((entry): entry is FloatingDockNode => Boolean(entry))
      : defaultState.floatingNodes;
  const placedSurfaceIds = new Set([
    ...collectSurfaceIdsFromDockNode(rootDockNode),
    ...collectSurfaceIdsFromFloatingNodes(floatingNodes),
  ]);
  const focusableSurfaceIds = new Set([
    ...placedSurfaceIds,
    ...Object.entries(surfaceStateById)
      .filter(([, surfaceState]) => Boolean(surfaceState.externalizedWindowId))
      .map(([surfaceId]) => surfaceId),
  ]);
  const focusedSurfaceId = shouldResetLegacyWorkbenchLayout
    ? defaultState.focusedSurfaceId
    : typeof source.focusedSurfaceId === 'string' && focusableSurfaceIds.has(source.focusedSurfaceId)
      ? source.focusedSurfaceId
      : resolvePreferredDockSurfaceId(rootDockNode, floatingNodes);

  const legacyRailStateSource = (source as { railState?: unknown }).railState;
  const railStateSource = source.activityRailState && typeof source.activityRailState === 'object' && !Array.isArray(source.activityRailState)
    ? source.activityRailState as Partial<IdeWorkbenchRailState>
    : legacyRailStateSource && typeof legacyRailStateSource === 'object' && !Array.isArray(legacyRailStateSource)
      ? legacyRailStateSource as Partial<IdeWorkbenchRailState>
    : {};
  const activityRailState: IdeWorkbenchRailState = {
    placement: railStateSource.placement === 'right' ? 'right' : DEFAULT_ACTIVITY_RAIL_STATE.placement,
    collapsed: railStateSource.collapsed === true,
    width: clampNumber(
      typeof railStateSource.width === 'number' && Number.isFinite(railStateSource.width)
        ? railStateSource.width
        : DEFAULT_ACTIVITY_RAIL_STATE.width,
      MIN_RAIL_WIDTH,
      MAX_RAIL_WIDTH,
    ),
  };
  const sourcesRailSource = source.sourcesRailState && typeof source.sourcesRailState === 'object' && !Array.isArray(source.sourcesRailState)
    ? source.sourcesRailState as Partial<IdeWorkbenchSourcesRailState>
    : {};
  const sourcesRailState: IdeWorkbenchSourcesRailState = {
    visible: typeof sourcesRailSource.visible === 'boolean'
      ? sourcesRailSource.visible
      : DEFAULT_SOURCES_RAIL_STATE.visible,
    preferredWidth: clampNumber(
      typeof sourcesRailSource.preferredWidth === 'number' && Number.isFinite(sourcesRailSource.preferredWidth)
        ? sourcesRailSource.preferredWidth
        : DEFAULT_SOURCES_RAIL_STATE.preferredWidth,
      MIN_SOURCES_RAIL_WIDTH,
      MAX_SOURCES_RAIL_WIDTH,
    ),
    emphasizeLocalTree: typeof sourcesRailSource.emphasizeLocalTree === 'boolean'
      ? sourcesRailSource.emphasizeLocalTree
      : DEFAULT_SOURCES_RAIL_STATE.emphasizeLocalTree,
    followActiveFolder: typeof sourcesRailSource.followActiveFolder === 'boolean'
      ? sourcesRailSource.followActiveFolder
      : DEFAULT_SOURCES_RAIL_STATE.followActiveFolder,
  };
  const inspectorRailSource = source.inspectorRailState && typeof source.inspectorRailState === 'object' && !Array.isArray(source.inspectorRailState)
    ? source.inspectorRailState as Partial<IdeWorkbenchInspectorRailState>
    : {};
  const inspectorRailState: IdeWorkbenchInspectorRailState = {
    visible: typeof inspectorRailSource.visible === 'boolean'
      ? inspectorRailSource.visible
      : DEFAULT_INSPECTOR_RAIL_STATE.visible,
    preferredWidth: clampNumber(
      typeof inspectorRailSource.preferredWidth === 'number' && Number.isFinite(inspectorRailSource.preferredWidth)
        ? inspectorRailSource.preferredWidth
        : DEFAULT_INSPECTOR_RAIL_STATE.preferredWidth,
      MIN_INSPECTOR_RAIL_WIDTH,
      MAX_INSPECTOR_RAIL_WIDTH,
    ),
    mode: inspectorRailSource.mode === 'preview-inspector'
      ? 'preview-inspector'
      : DEFAULT_INSPECTOR_RAIL_STATE.mode,
  };
  const bottomDockSource = source.bottomDockState && typeof source.bottomDockState === 'object' && !Array.isArray(source.bottomDockState)
    ? source.bottomDockState as Partial<IdeWorkbenchBottomDockState>
    : {};
  const bottomDockState: IdeWorkbenchBottomDockState = {
    collapsed: typeof bottomDockSource.collapsed === 'boolean'
      ? bottomDockSource.collapsed
      : DEFAULT_BOTTOM_DOCK_STATE.collapsed,
    preferredHeight: clampNumber(
      typeof bottomDockSource.preferredHeight === 'number' && Number.isFinite(bottomDockSource.preferredHeight)
        ? bottomDockSource.preferredHeight
        : DEFAULT_BOTTOM_DOCK_STATE.preferredHeight,
      MIN_BOTTOM_DOCK_HEIGHT,
      MAX_BOTTOM_DOCK_HEIGHT,
    ),
  };

  const nextMaximizedNodeId = !shouldResetLegacyWorkbenchLayout
    && typeof source.maximizedNodeId === 'string'
    && source.maximizedNodeId.trim().length > 0
    ? source.maximizedNodeId.trim()
    : null;
  const dockIds = new Set([
    IDE_WORKBENCH_STACK_IDS.center,
    IDE_WORKBENCH_STACK_IDS.rightSidebar,
    IDE_WORKBENCH_STACK_IDS.bottomPanel,
    ...floatingNodes.map(node => node.id),
  ]);

  return {
    version: CURRENT_IDE_WORKBENCH_LAYOUT_STATE_VERSION,
    rootDockNode,
    floatingNodes,
    focusedSurfaceId,
    maximizedNodeId: nextMaximizedNodeId && dockIds.has(nextMaximizedNodeId)
      ? nextMaximizedNodeId
      : null,
    activityRailState,
    sourcesRailState,
    inspectorRailState,
    bottomDockState,
    explorerInspectorLinkMode: source.explorerInspectorLinkMode === 'live-linked'
      ? 'live-linked'
      : 'live-linked',
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
        ...currentSurfaceState,
        hidden: false,
        collapsed: false,
      },
    },
  };
}

function getRestorePlacementForSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  currentPlacement: DockPlacement | null,
): DockStackPlacement {
  if (currentPlacement && currentPlacement !== 'floating') {
    return currentPlacement;
  }

  return layoutState.surfaceStateById[surfaceId]?.externalizedRestorePlacement
    ?? 'right-sidebar';
}

function clearExternalizedSurfaceState(
  hidden: boolean,
): IdeWorkbenchSurfaceState {
  return {
    hidden,
    collapsed: false,
    externalizedWindowId: null,
    externalizedRestorePlacement: null,
  };
}

export function externalizeDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  windowId: string,
  restorePlacement: DockStackPlacement | null = null,
): IdeWorkbenchLayoutState {
  if (isExplorerCoreSurface(surfaceId)) {
    return layoutState;
  }

  const trimmedWindowId = windowId.trim();
  if (!trimmedWindowId) {
    return layoutState;
  }

  const currentPlacement = findDockPlacementForSurface(layoutState, surfaceId);
  const nextRootDockNode = normalizeDockNodeAfterMutation(
    removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId),
  );
  const nextFloatingNodes = updateFloatingNodesForSurface(layoutState.floatingNodes, surfaceId, (node) => {
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
  const nextRestorePlacement = restorePlacement
    ?? getRestorePlacementForSurface(layoutState, surfaceId, currentPlacement);

  return {
    ...layoutState,
    rootDockNode: nextRootDockNode,
    floatingNodes: nextFloatingNodes,
    focusedSurfaceId: layoutState.focusedSurfaceId === surfaceId
      ? resolvePreferredDockSurfaceId(nextRootDockNode, nextFloatingNodes)
      : layoutState.focusedSurfaceId,
    bottomDockState: synchronizeBottomDockState(nextRootDockNode, layoutState.bottomDockState),
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: {
        hidden: false,
        collapsed: false,
        externalizedWindowId: trimmedWindowId,
        externalizedRestorePlacement: nextRestorePlacement,
      },
    },
  };
}

export function clearExternalizedDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  options?: {
    hidden?: boolean;
  },
): IdeWorkbenchLayoutState {
  const hidden = options?.hidden === true;
  const nextRootDockNode = normalizeDockNodeAfterMutation(
    removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId),
  );
  const nextFloatingNodes = updateFloatingNodesForSurface(layoutState.floatingNodes, surfaceId, (node) => {
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
    rootDockNode: nextRootDockNode,
    floatingNodes: nextFloatingNodes,
    focusedSurfaceId: hidden && layoutState.focusedSurfaceId === surfaceId
      ? resolvePreferredDockSurfaceId(nextRootDockNode, nextFloatingNodes)
      : layoutState.focusedSurfaceId,
    bottomDockState: synchronizeBottomDockState(nextRootDockNode, layoutState.bottomDockState),
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: clearExternalizedSurfaceState(hidden),
    },
  };
}

export function restoreExternalizedDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  seeds: WorkbenchSurfaceLayoutSeed[],
): IdeWorkbenchLayoutState {
  const surfaceState = layoutState.surfaceStateById[surfaceId];
  const seed = seeds.find(candidate => candidate.id === surfaceId);
  const restorePlacement = surfaceState?.externalizedRestorePlacement
    ?? seed?.defaultDockPlacement
    ?? 'right-sidebar';

  return moveSurfaceToDockPlacement(
    clearExternalizedDockSurface(layoutState, surfaceId, { hidden: false }),
    surfaceId,
    restorePlacement,
  );
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

function reorderSurfaceIds(ids: string[], draggedSurfaceId: string, targetSurfaceId: string): string[] {
  if (draggedSurfaceId === targetSurfaceId) {
    return ids;
  }

  const nextIds = [...ids];
  const draggedIndex = nextIds.indexOf(draggedSurfaceId);
  const targetIndex = nextIds.indexOf(targetSurfaceId);
  if (draggedIndex < 0 || targetIndex < 0) {
    return ids;
  }

  const [draggedId] = nextIds.splice(draggedIndex, 1);
  nextIds.splice(targetIndex, 0, draggedId);
  return nextIds;
}

export function reorderDockSurfaceTabs(
  layoutState: IdeWorkbenchLayoutState,
  draggedSurfaceId: string,
  targetSurfaceId: string,
): IdeWorkbenchLayoutState {
  if (draggedSurfaceId === targetSurfaceId) {
    return layoutState;
  }

  let reordered = false;
  const nextRootDockNode = updateDockNode(layoutState.rootDockNode, (candidate) => {
    if (
      candidate.type !== 'stack'
      || !candidate.tabs.includes(draggedSurfaceId)
      || !candidate.tabs.includes(targetSurfaceId)
    ) {
      return candidate;
    }

    const nextTabs = reorderSurfaceIds(candidate.tabs, draggedSurfaceId, targetSurfaceId);
    if (nextTabs === candidate.tabs) {
      return candidate;
    }

    reordered = true;
    return withStackActiveSurface(
      {
        ...candidate,
        tabs: nextTabs,
      },
      candidate.activeSurfaceId,
    );
  });
  const nextFloatingNodes = layoutState.floatingNodes.map((node) => {
    if (!node.tabs.includes(draggedSurfaceId) || !node.tabs.includes(targetSurfaceId)) {
      return node;
    }

    const nextTabs = reorderSurfaceIds(node.tabs, draggedSurfaceId, targetSurfaceId);
    if (nextTabs === node.tabs) {
      return node;
    }

    reordered = true;
    return {
      ...node,
      tabs: nextTabs,
      activeSurfaceId: node.activeSurfaceId && nextTabs.includes(node.activeSurfaceId)
        ? node.activeSurfaceId
        : nextTabs[0] ?? null,
    };
  });

  if (!reordered) {
    return layoutState;
  }

  return {
    ...layoutState,
    rootDockNode: normalizeDockNodeAfterMutation(nextRootDockNode),
    floatingNodes: nextFloatingNodes,
  };
}

export function moveSurfaceToDockPlacement(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  placement: DockStackPlacement,
): IdeWorkbenchLayoutState {
  if (isExplorerCoreSurface(surfaceId)) {
    return {
      ...ensureSurfaceVisibleState(layoutState, surfaceId),
      focusedSurfaceId: surfaceId,
    };
  }

  const normalizedPlacement = normalizeUtilityDockPlacement(placement);
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
  const nextRoot = normalizeDockNodeAfterMutation(appendSurfaceToDockStack(
    removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId),
    dockPlacementToStackId[normalizedPlacement],
    surfaceId,
    true,
  ));
  const nextBottomDockState = synchronizeBottomDockState(
    nextRoot,
    normalizedPlacement === 'bottom-panel'
      ? {
        ...layoutState.bottomDockState,
        collapsed: false,
      }
      : layoutState.bottomDockState,
  );

  return {
    ...ensureSurfaceVisibleState(layoutState, surfaceId),
    rootDockNode: nextRoot,
    floatingNodes: withoutFloatingSurface,
    focusedSurfaceId: surfaceId,
    bottomDockState: nextBottomDockState,
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: clearExternalizedSurfaceState(false),
    },
  };
}

export function focusDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
  seeds: WorkbenchSurfaceLayoutSeed[],
): IdeWorkbenchLayoutState {
  if (layoutState.surfaceStateById[surfaceId]?.externalizedWindowId) {
    return {
      ...layoutState,
      focusedSurfaceId: surfaceId,
      surfaceStateById: {
        ...layoutState.surfaceStateById,
        [surfaceId]: {
          ...layoutState.surfaceStateById[surfaceId],
          hidden: false,
          collapsed: false,
        },
      },
    };
  }

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
      bottomDockState: currentPlacement === 'bottom-panel'
        ? {
          ...layoutState.bottomDockState,
          collapsed: false,
        }
        : layoutState.bottomDockState,
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
  if (isExplorerCoreSurface(surfaceId)) {
    return layoutState;
  }

  const nextRoot = normalizeDockNodeAfterMutation(removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId));
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
    bottomDockState: synchronizeBottomDockState(nextRoot, layoutState.bottomDockState),
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: {
        hidden: true,
        collapsed: false,
        externalizedWindowId: null,
        externalizedRestorePlacement: null,
      },
    },
  };
}

export function floatDockSurface(
  layoutState: IdeWorkbenchLayoutState,
  surfaceId: string,
): IdeWorkbenchLayoutState {
  if (isExplorerCoreSurface(surfaceId)) {
    return layoutState;
  }

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
  const nextRootDockNode = normalizeDockNodeAfterMutation(
    removeSurfaceFromDockNode(layoutState.rootDockNode, surfaceId),
  );

  return {
    ...ensureSurfaceVisibleState(layoutState, surfaceId),
    rootDockNode: nextRootDockNode,
    floatingNodes: nextFloatingNodes,
    focusedSurfaceId: surfaceId,
    bottomDockState: synchronizeBottomDockState(nextRootDockNode, layoutState.bottomDockState),
    surfaceStateById: {
      ...layoutState.surfaceStateById,
      [surfaceId]: clearExternalizedSurfaceState(false),
    },
  };
}

export function updateDockStackCollapsed(
  layoutState: IdeWorkbenchLayoutState,
  stackId: string,
  collapsed: boolean,
): IdeWorkbenchLayoutState {
  const nextRootDockNode = normalizeDockNodeAfterMutation(updateDockStackById(layoutState.rootDockNode, stackId, stack => ({
    ...stack,
    collapsed: stack.id === IDE_WORKBENCH_STACK_IDS.center ? false : collapsed,
  })));
  return {
    ...layoutState,
    rootDockNode: nextRootDockNode,
    bottomDockState: synchronizeBottomDockState(
      nextRootDockNode,
      stackId === IDE_WORKBENCH_STACK_IDS.bottomPanel
        ? {
          ...layoutState.bottomDockState,
          collapsed,
        }
        : layoutState.bottomDockState,
    ),
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
    activityRailState: {
      placement: updates.placement === 'right' ? 'right' : (updates.placement === 'left' ? 'left' : layoutState.activityRailState.placement),
      collapsed: typeof updates.collapsed === 'boolean' ? updates.collapsed : layoutState.activityRailState.collapsed,
      width: clampNumber(
        typeof updates.width === 'number' && Number.isFinite(updates.width)
          ? updates.width
          : layoutState.activityRailState.width,
        MIN_RAIL_WIDTH,
        MAX_RAIL_WIDTH,
      ),
    },
  };
}
