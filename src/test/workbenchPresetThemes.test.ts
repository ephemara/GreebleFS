import { describe, expect, it } from 'vitest';

import { BUILT_IN_WORKBENCH_PRESETS, normalizeWorkbenchPreset } from '../config/workbenchPresets';

describe('workbench preset theme recommendations', () => {
  it('trims and deduplicates preferred theme ids without disturbing shell-aware defaults', () => {
    const fallback = BUILT_IN_WORKBENCH_PRESETS[0];
    const normalized = normalizeWorkbenchPreset({
      id: 'cinema-deck',
      label: 'Cinema Deck',
      shellBlueprint: 'xmb-cross-media',
      preferredThemeIds: [' vista-glass ', 'vista-glass', '', 'aqua-light'],
      panelBindings: [
        {
          panelId: 'explorer',
          region: 'rail',
          order: 1.4,
          preferredSize: 96,
        },
      ],
    });

    expect(normalized.shellBlueprint).toBe('xmb-cross-media');
    expect(normalized.navigationModel).toBe('cross-axis');
    expect(normalized.preferredThemeIds).toEqual(['vista-glass', 'aqua-light']);
    expect(normalized.panelBindings[0]).toMatchObject({
      panelId: 'explorer',
      region: 'rail',
      order: 1,
      preferredSize: 120,
      defaultOpen: true,
    });
    expect(fallback.preferredThemeIds.length).toBeGreaterThanOrEqual(0);
  });

  it('preserves generated shell defaults while allowing explicit clearing of theme recommendations', () => {
    const fallback = BUILT_IN_WORKBENCH_PRESETS[0];
    const normalized = normalizeWorkbenchPreset({
      id: 'portable-derived',
      label: 'Portable Derived',
      preferredThemeIds: [null, '   '] as never,
    }, fallback);

    expect(normalized.preferredThemeIds).toEqual([]);
    expect(normalized.shellBlueprint).toBe(fallback.shellBlueprint);
    expect(normalized.navigationModel).toBe(fallback.navigationModel);
  });
});
