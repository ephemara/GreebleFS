import { describe, expect, it } from 'vitest';

import {
  createDefaultIdeWorkbenchLayoutState,
  focusDockSurface,
  hideDockSurface,
  normalizeIdeWorkbenchLayoutState,
  resolvePrimaryIdeWorkbenchSurfaceId,
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
    defaultVisibility: 'collapsed',
  },
  {
    id: 'terminal',
    defaultDockPlacement: 'bottom-panel',
    defaultOrder: 30,
    defaultVisibility: 'visible',
  },
  {
    id: 'settings',
    defaultDockPlacement: 'right-sidebar',
    defaultOrder: 40,
    defaultVisibility: 'hidden',
  },
];

describe('ideWorkbenchLayout', () => {
  it('prefers the center explorer surface as the default focus target', () => {
    const layoutState = createDefaultIdeWorkbenchLayoutState(testSurfaceSeeds);

    expect(layoutState.focusedSurfaceId).toBe('explorer');
    expect(resolvePrimaryIdeWorkbenchSurfaceId(layoutState)).toBe('explorer');
  });

  it('normalizes invalid focus back to the center explorer surface', () => {
    const layoutState = normalizeIdeWorkbenchLayoutState({
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

    expect(layoutState.focusedSurfaceId).toBe('explorer');
    expect(resolvePrimaryIdeWorkbenchSurfaceId(layoutState)).toBe('explorer');
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
});
