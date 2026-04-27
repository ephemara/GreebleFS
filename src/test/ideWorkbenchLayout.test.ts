import { describe, expect, it } from 'vitest';

import {
  IDE_WORKBENCH_STACK_IDS,
  createDefaultIdeWorkbenchLayoutState,
  findDockPlacementForSurface,
  focusDockSurface,
  hideDockSurface,
  moveSurfaceToDockPlacement,
  normalizeIdeWorkbenchLayoutState,
  resolvePrimaryIdeWorkbenchSurfaceId,
  type DockNode,
  type DockStackNode,
  type WorkbenchSurfaceLayoutSeed,
} from '../config/ideWorkbenchLayout';

const testSurfaceSeeds: WorkbenchSurfaceLayoutSeed[] = [
  {
    id: 'explorer',
    defaultDockPlacement: 'center',
    defaultOrder: 10,
    defaultVisibility: 'visible',
  },
  {
    id: 'storage',
    defaultDockPlacement: 'left-sidebar',
    defaultOrder: 20,
    defaultVisibility: 'hidden',
  },
  {
    id: 'terminal',
    defaultDockPlacement: 'bottom-panel',
    defaultOrder: 30,
    defaultVisibility: 'collapsed',
  },
  {
    id: 'settings',
    defaultDockPlacement: 'right-sidebar',
    defaultOrder: 40,
    defaultVisibility: 'hidden',
  },
];

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

describe('ideWorkbenchLayout', () => {
  it('prefers the center explorer surface as the default focus target', () => {
    const layoutState = createDefaultIdeWorkbenchLayoutState(testSurfaceSeeds);

    expect(layoutState.version).toBe(2);
    expect(layoutState.focusedSurfaceId).toBe('explorer');
    expect(resolvePrimaryIdeWorkbenchSurfaceId(layoutState)).toBe('explorer');
    expect(layoutState.sourcesRailState).toMatchObject({
      visible: true,
      emphasizeLocalTree: true,
      followActiveFolder: true,
    });
    expect(layoutState.inspectorRailState).toMatchObject({
      visible: true,
      mode: 'preview-inspector',
    });
    expect(layoutState.bottomDockState.collapsed).toBe(true);
    expect(findDockStackById(layoutState.rootDockNode, IDE_WORKBENCH_STACK_IDS.rightSidebar)?.collapsed).toBe(true);
  });

  it('resets legacy version-1 dock graphs into the explorer-first IDE shell', () => {
    const layoutState = normalizeIdeWorkbenchLayoutState({
      version: 1,
      focusedSurfaceId: 'settings',
      rootDockNode: {
        type: 'split',
        id: 'ide:root',
        orientation: 'horizontal',
        sizes: [0.24, 1, 0.3],
        children: [
          {
            type: 'stack',
            id: 'ide:left-sidebar',
            placement: 'left-sidebar',
            presentation: 'stack',
            tabs: ['storage'],
            activeSurfaceId: 'storage',
            collapsed: true,
          },
          {
            type: 'split',
            id: 'ide:center-column',
            orientation: 'vertical',
            sizes: [1, 0.3],
            children: [
              {
                type: 'stack',
                id: 'ide:center',
                placement: 'center',
                presentation: 'stack',
                tabs: ['explorer'],
                activeSurfaceId: 'explorer',
                collapsed: false,
              },
              {
                type: 'stack',
                id: 'ide:bottom-panel',
                placement: 'bottom-panel',
                presentation: 'stack',
                tabs: ['terminal'],
                activeSurfaceId: 'terminal',
                collapsed: true,
              },
            ],
          },
          {
            type: 'stack',
            id: 'ide:right-sidebar',
            placement: 'right-sidebar',
            presentation: 'stack',
            tabs: [],
            activeSurfaceId: null,
            collapsed: true,
          },
        ],
      },
    }, testSurfaceSeeds);

    expect(layoutState.version).toBe(2);
    expect(layoutState.focusedSurfaceId).toBe('explorer');
    expect(resolvePrimaryIdeWorkbenchSurfaceId(layoutState)).toBe('explorer');
    expect(findDockPlacementForSurface(layoutState, 'explorer')).toBe('center');
    expect(findDockPlacementForSurface(layoutState, 'storage')).toBe(null);
    expect(findDockPlacementForSurface(layoutState, 'terminal')).toBe('bottom-panel');
    expect(findDockStackById(layoutState.rootDockNode, IDE_WORKBENCH_STACK_IDS.rightSidebar)?.collapsed).toBe(true);
  });

  it('falls back to explorer after hiding a focused utility surface', () => {
    const focusedStorageLayoutState = focusDockSurface(
      createDefaultIdeWorkbenchLayoutState(testSurfaceSeeds),
      'storage',
      testSurfaceSeeds,
    );

    const nextLayoutState = hideDockSurface(focusedStorageLayoutState, 'storage');

    expect(nextLayoutState.focusedSurfaceId).toBe('explorer');
    expect(resolvePrimaryIdeWorkbenchSurfaceId(nextLayoutState)).toBe('explorer');
  });

  it('keeps explorer pinned to center and demotes utility center requests to the right sidebar', () => {
    const layoutState = createDefaultIdeWorkbenchLayoutState(testSurfaceSeeds);

    const explorerMoveAttempt = moveSurfaceToDockPlacement(layoutState, 'explorer', 'right-sidebar');
    const utilityMoveAttempt = moveSurfaceToDockPlacement(layoutState, 'settings', 'center');

    expect(findDockPlacementForSurface(explorerMoveAttempt, 'explorer')).toBe('center');
    expect(explorerMoveAttempt.focusedSurfaceId).toBe('explorer');
    expect(findDockPlacementForSurface(utilityMoveAttempt, 'settings')).toBe('right-sidebar');
  });

  it('collapses empty utility docks after the last utility surface is hidden', () => {
    const layoutState = focusDockSurface(
      createDefaultIdeWorkbenchLayoutState(testSurfaceSeeds),
      'terminal',
      testSurfaceSeeds,
    );

    const nextLayoutState = hideDockSurface(layoutState, 'terminal');

    expect(nextLayoutState.bottomDockState.collapsed).toBe(true);
    expect(findDockStackById(nextLayoutState.rootDockNode, IDE_WORKBENCH_STACK_IDS.bottomPanel)?.collapsed).toBe(true);
    expect(findDockPlacementForSurface(nextLayoutState, 'terminal')).toBe(null);
  });
});
