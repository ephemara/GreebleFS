import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_LAYOUT_MANIFEST,
  buildDefaultLayoutConfigCandidates,
  getNextLayoutProfileId,
  normalizeLayoutManifest,
} from '../config/layoutProfiles';

describe('layoutProfiles edge cases', () => {
  it('builds all default manifest candidates without duplicating separators', () => {
    expect(buildDefaultLayoutConfigCandidates('C:\\Users\\Alex\\')).toEqual([
      'C:\\Users\\Alex\\.greeblefs\\greeblefs.layouts.json',
      'C:\\Users\\Alex\\.greeblefs\\greeblefs.layouts.toml',
      'C:\\Users\\Alex\\.greeble\\greeble.layouts.json',
      'C:\\Users\\Alex\\.greeble\\greeble.layouts.toml',
      'C:\\Users\\Alex\\.overlayterm\\snapyard.layouts.json',
      'C:\\Users\\Alex\\.overlayterm\\snapyard.layouts.toml',
    ]);
  });

  it('clamps manifest versions and falls back to built-in profiles when needed', () => {
    const manifest = normalizeLayoutManifest({
      version: 0,
      extendsBuiltIns: false,
      profiles: [],
    });

    expect(manifest.version).toBe(1);
    expect(manifest.profiles).toEqual(BUILT_IN_LAYOUT_MANIFEST.profiles);
  });

  it('defaults to the first available profile when the active id is missing', () => {
    expect(getNextLayoutProfileId(BUILT_IN_LAYOUT_MANIFEST, 'missing-profile')).toBe(
      BUILT_IN_LAYOUT_MANIFEST.profiles[0]?.id ?? 'overlay-classic',
    );
  });

  it('falls back to built-in interaction metadata when custom values are invalid', () => {
    const manifest = normalizeLayoutManifest({
      profiles: [
        {
          id: 'overlay-classic',
          interaction: {
            primaryAxisOwner: 'unknown-surface',
            progressOwner: 'mystery-layer',
            preserveFocusAnchor: false,
          },
        },
      ],
    });

    expect(manifest.profiles[0]?.interaction.primaryAxisOwner).toBe('active-panel');
    expect(manifest.profiles[0]?.interaction.progressOwner).toBe('session');
    expect(manifest.profiles[0]?.interaction.preserveFocusAnchor).toBe(false);
    expect(manifest.profiles[0]?.interaction.preserveSelectionAnchor).toBe(true);
  });
});
