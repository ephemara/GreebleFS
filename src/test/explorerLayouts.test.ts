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
        source: 'explorer-layout-package',
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
  });

  it('keeps the canonical built-in layout as the final fallback when authored layouts collide', () => {
    const canonical = getBuiltInExplorerLayouts();
    const authoredVariant = normalizeExplorerLayoutDefinition(
      {
        id: EXPLORER_CANONICAL_LAYOUT_ID,
        name: 'User Canonical Override',
        paneMetrics: {
          sidebarWidthPx: 280,
        },
      },
      {
        source: 'explorer-layout-package',
        sourceLabel: 'User Layouts',
        readOnly: false,
      },
    );

    const mergedLayouts = collectUniqueExplorerLayouts([authoredVariant], canonical);
    const resolvedCanonical = findExplorerLayoutById(
      mergedLayouts,
      EXPLORER_CANONICAL_LAYOUT_ID,
    );

    expect(resolvedCanonical?.readOnly).toBe(true);
    expect(resolvedCanonical?.name).toBe('Canonical');
    expect(mergedLayouts.some((layout) => layout.id === 'navigator')).toBe(true);
  });
});
