import { describe, expect, it } from 'vitest';

import {
  EXPLORER_CANONICAL_LAYOUT_ID,
  collectUniqueExplorerLayouts,
  findExplorerLayoutById,
  getBuiltInExplorerLayouts,
  normalizeExplorerLayoutDefinition,
} from '../config/explorerLayouts';

describe('explorerLayouts', () => {
  it('ships built-in explorer layout presets alongside the canonical restore target', () => {
    expect(getBuiltInExplorerLayouts().map((layout) => layout.id)).toEqual([
      EXPLORER_CANONICAL_LAYOUT_ID,
      'navigator',
      'focus',
      'inspector',
    ]);
  });

  it('preserves freeform unified-header snapshots without flattening them into explorerTopbar', () => {
    const normalized = normalizeExplorerLayoutDefinition(
      {
        id: 'custom-layout',
        name: 'Custom Layout',
        sortOrder: 42,
        chromeSnapshot: {
          entries: [
            {
              controlId: 'workspaceTabStrip',
              surfaceId: 'workspaceHeader',
              zone: 'center',
              order: 10,
              bandId: 'workspaceHeader:freeform-canvas',
              anchorX: 320,
              anchorY: 148,
            },
          ],
        },
      },
      {
        source: 'usr-user-package',
        sourceLabel: 'Explorer Layouts',
        readOnly: false,
      },
    );

    expect(normalized.chromeSnapshot?.entries).toEqual([
      expect.objectContaining({
        controlId: 'workspaceTabStrip',
        surfaceId: 'workspaceHeader',
        zone: 'center',
        order: 10,
        bandId: 'workspaceHeader:freeform-canvas',
        anchorX: 320,
        anchorY: 148,
      }),
    ]);
    expect(normalized.workspaceLayoutMode).toBe('single');
    expect(normalized.tabStripVisible).toBe(true);
    expect(normalized.sortOrder).toBe(42);
  });

  it('lets usr-authored layouts override the shipped fallback when ids collide', () => {
    const authoredVariant = normalizeExplorerLayoutDefinition(
      {
        id: EXPLORER_CANONICAL_LAYOUT_ID,
        name: 'User Canonical Override',
        paneMetrics: {
          sidebarWidthPx: 280,
        },
      },
      {
        source: 'usr-user-package',
        sourceLabel: 'User Layouts',
        readOnly: false,
      },
    );

    const mergedLayouts = collectUniqueExplorerLayouts([authoredVariant], []);
    const resolvedCanonical = findExplorerLayoutById(
      mergedLayouts,
      EXPLORER_CANONICAL_LAYOUT_ID,
    );

    expect(resolvedCanonical?.readOnly).toBe(false);
    expect(resolvedCanonical?.name).toBe('User Canonical Override');
    expect(mergedLayouts.some((layout) => layout.id === 'navigator')).toBe(true);
  });

  it('supports explicit shipped usr layout metadata without collapsing it into the user bucket', () => {
    const normalized = normalizeExplorerLayoutDefinition(
      {
        id: 'shipped-focus',
        name: 'Shipped Focus',
        sortOrder: 20,
      },
      {
        source: 'usr-shipped-package',
        sourceLabel: 'GreebleFS Core Explorer Layouts',
        readOnly: false,
      },
    );

    expect(normalized.source).toBe('usr-shipped-package');
    expect(normalized.sortOrder).toBe(20);
  });
});
