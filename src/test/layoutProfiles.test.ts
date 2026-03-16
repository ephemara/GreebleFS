import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  getNextLayoutProfileId,
  getPinnedPanelIds,
  getTabbedOpenPanelIds,
  normalizeLayoutManifest,
  resolveLayoutProfile,
} from '../config/layoutProfiles';

describe('layoutProfiles', () => {
  it('uses built-in profiles when manifest input is invalid', () => {
    expect(normalizeLayoutManifest(null)).toEqual(BUILT_IN_LAYOUT_MANIFEST);
  });

  it('merges custom profile overrides onto built-ins by id', () => {
    const manifest = normalizeLayoutManifest({
      profiles: [
        {
          id: 'navigator-bottom',
          label: 'Navigator XL',
          pinnedPanels: [
            {
              panelId: 'explorer',
              side: 'left',
              size: 420,
              mode: 'compact-dock',
            },
          ],
        },
      ],
    });

    const profile = resolveLayoutProfile(manifest, 'navigator-bottom');
    expect(profile.label).toBe('Navigator XL');
    expect(profile.pinnedPanels[0]?.size).toBe(420);
    expect(manifest.profiles.length).toBeGreaterThanOrEqual(BUILT_IN_LAYOUT_MANIFEST.profiles.length);
  });

  it('replaces built-ins when extendsBuiltIns is false', () => {
    const manifest = normalizeLayoutManifest({
      extendsBuiltIns: false,
      profiles: [
        {
          id: 'custom-shell',
          label: 'Custom Shell',
          description: 'External only',
          chrome: { barPosition: 'bottom' },
          behavior: {
            defaultActivePanelId: 'notes',
            enforcedOpenPanelIds: ['notes'],
          },
        },
      ],
    });

    expect(manifest.profiles).toHaveLength(1);
    expect(manifest.profiles[0]?.id).toBe('custom-shell');
    expect(manifest.profiles[0]?.chrome.barPosition).toBe('bottom');
  });

  it('cycles layout ids in manifest order', () => {
    const firstId = BUILT_IN_LAYOUT_MANIFEST.profiles[0]?.id ?? '';
    const secondId = BUILT_IN_LAYOUT_MANIFEST.profiles[1]?.id ?? '';

    expect(getNextLayoutProfileId(BUILT_IN_LAYOUT_MANIFEST, firstId)).toBe(secondId);
    expect(getNextLayoutProfileId(BUILT_IN_LAYOUT_MANIFEST, secondId)).toBe(firstId);
  });

  it('filters pinned panels out of tab strips', () => {
    const profile = resolveLayoutProfile(BUILT_IN_LAYOUT_MANIFEST, 'navigator-bottom');

    expect(getPinnedPanelIds(profile)).toEqual(['explorer']);
    expect(getTabbedOpenPanelIds(profile, ['explorer', 'terminal', 'notes'])).toEqual(['terminal', 'notes']);
  });
});
