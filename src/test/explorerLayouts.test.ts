import { describe, expect, it } from 'vitest';

import {
  EXPLORER_CANONICAL_LAYOUT_ID,
  collectUniqueExplorerLayouts,
  findExplorerLayoutById,
  getBuiltInExplorerLayouts,
  normalizeExplorerLayoutDefinition,
} from '../config/explorerLayouts';

describe('explorerLayouts', () => {
  it('normalizes unified-header snapshots away from the legacy workspaceHeader surface', () => {
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
        surfaceId: 'explorerTopbar',
        zone: 'center',
        order: 10,
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

    expect(mergedLayouts[mergedLayouts.length - 1]?.id).toBe(
      EXPLORER_CANONICAL_LAYOUT_ID,
    );
    expect(resolvedCanonical?.readOnly).toBe(true);
    expect(resolvedCanonical?.name).toBe('Canonical');
  });
});
