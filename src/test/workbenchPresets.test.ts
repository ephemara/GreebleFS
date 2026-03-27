import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_WORKBENCH_PRESETS,
  getWorkbenchPresetsForShellBlueprint,
  normalizeWorkbenchPreset,
  resolveWorkbenchPreset,
} from '../config/workbenchPresets';

describe('workbench presets', () => {
  it('ships generated backend presets through the frontend catalog', () => {
    expect(BUILT_IN_WORKBENCH_PRESETS.map(preset => preset.id)).toEqual([
      'xmb-media-deck',
    ]);
  });

  it('filters presets by shell blueprint', () => {
    const crossAxisPresets = getWorkbenchPresetsForShellBlueprint('xmb-cross-media');

    expect(crossAxisPresets).toHaveLength(1);
    expect(crossAxisPresets[0]?.id).toBe('xmb-media-deck');
  });

  it('normalizes incomplete preset input against a shell-aware fallback', () => {
    const normalized = normalizeWorkbenchPreset({
      id: 'portable-lab',
      label: 'Portable Lab',
      shellBlueprint: 'handheld-dual-screen',
      panelBindings: [
        {
          panelId: 'terminal',
          region: 'secondary',
          order: 7.8,
          defaultOpen: true,
          preferredSize: 72,
        },
      ],
      inputProfile: {
        mode: 'touch',
      },
    });

    expect(normalized.shellBlueprint).toBe('handheld-dual-screen');
    expect(normalized.navigationModel).toBe('stacked-dual-pane');
    expect(normalized.panelBindings[0]).toMatchObject({
      panelId: 'terminal',
      region: 'secondary',
      order: 8,
      preferredSize: 120,
    });
    expect(normalized.inputProfile.mode).toBe('touch');
  });

  it('falls back to the primary preset when a preset id is unknown', () => {
    expect(resolveWorkbenchPreset('does-not-exist').id).toBe('xmb-media-deck');
  });
});
