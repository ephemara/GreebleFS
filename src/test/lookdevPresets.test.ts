import { describe, expect, it } from 'vitest';

import {
  createLookdevPresetManifestFromScopeSnapshot,
  normalizeLookdevPresetManifest,
  resolveLookdevPresetForWindowMode,
  serializeLookdevPreset,
} from '../config/lookdevPresets';

describe('lookdev preset manifests', () => {
  it('normalizes semantic scoped overrides without dropping authored ids', () => {
    const normalized = normalizeLookdevPresetManifest({
      id: 'dock-ox',
      name: 'Dock Ox',
      shared: {
        appearance: {
          activeThemeId: 'pilot-dark',
          appOpacity: 0.92,
        },
      },
      dock: {
        dock: {
          activePresentationId: 'yakuake-workbench',
          edgeSize: 312,
        },
        explorer: {
          activeMenuPackId: 'dock-menu-pack',
        },
      },
    });

    expect(normalized.id).toBe('dock-ox');
    expect(normalized.shared?.appearance).toMatchObject({
      activeThemeId: 'pilot-dark',
      appOpacity: 0.92,
    });
    expect(normalized.dock?.dock).toMatchObject({
      activePresentationId: 'yakuake-workbench',
      edgeSize: 312,
    });
    expect(normalized.dock?.explorer).toMatchObject({
      activeMenuPackId: 'dock-menu-pack',
    });
  });

  it('resolves shared overrides plus the current mode scope', () => {
    const manifest = normalizeLookdevPresetManifest({
      shared: {
        appearance: {
          activeThemeId: 'shared-theme',
        },
        dock: {
          edgeWidth: 1440,
        },
      },
      windowed: {
        appearance: {
          activeTopBarId: 'windowed-top-bar',
        },
        dock: {
          edgeSize: 420,
        },
      },
      dock: {
        appearance: {
          activeTopBarId: 'dock-top-bar',
        },
        dock: {
          edgeSize: 260,
        },
      },
    });

    expect(resolveLookdevPresetForWindowMode(manifest, 'windowed')).toMatchObject({
      appearance: {
        activeThemeId: 'shared-theme',
        activeTopBarId: 'windowed-top-bar',
      },
      dock: {
        edgeWidth: 1440,
        edgeSize: 420,
      },
    });
    expect(resolveLookdevPresetForWindowMode(manifest, 'dock')).toMatchObject({
      appearance: {
        activeThemeId: 'shared-theme',
        activeTopBarId: 'dock-top-bar',
      },
      dock: {
        edgeWidth: 1440,
        edgeSize: 260,
      },
    });
  });

  it('round-trips scope snapshots for authoring exports', () => {
    const manifest = createLookdevPresetManifestFromScopeSnapshot({
      id: 'pilot-lookdev',
      name: 'Pilot Lookdev',
      description: 'Round-trip harness',
      scope: 'windowed',
      scopedOverrides: {
        appearance: {
          activeThemeId: 'pilot-dark',
          activeTopBarId: 'dock-ox-strip',
        },
        explorer: {
          activeMenuPackId: 'greeblefs-core',
        },
      },
    });

    expect(JSON.parse(serializeLookdevPreset(manifest))).toEqual(manifest);
  });
});
