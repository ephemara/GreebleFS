import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  compareThemeCatalogPackages,
  resolveThemeCatalogPackageMetadata,
} from '../config/themeCatalogCuration';
import { loadThemePackagesFromDirectoryEntries } from '../config/themePackages';

describe('theme catalog curation', () => {
  it('classifies the official pilot suite and lower tiers from the host-owned map', () => {
    expect(resolveThemeCatalogPackageMetadata('caveman-god-mode')).toMatchObject({
      tierId: 'official-pilot',
      badgeLabel: 'Pilot',
      isOfficialPilot: true,
      sortRank: 0,
      suiteDescription: 'The canonical reference package for future LLM-authored shells.',
    });

    expect(resolveThemeCatalogPackageMetadata('vector-monolith')).toEqual({
      tierId: 'official-pilot',
      tierLabel: 'Official Pilot',
      tierDescription: 'Curated new-wave shells that define the current direction of the suite.',
      tierOrder: 0,
      badgeLabel: 'Pilot',
      sortRank: 0,
      suiteId: 'official-pilot',
      suiteLabel: 'Pilot Suite',
      suiteDescription: 'The strongest 3D-forward shell in the current direction-set.',
      isOfficialPilot: true,
    });

    expect(resolveThemeCatalogPackageMetadata('cyber-nexus-hud')).toMatchObject({
      tierId: 'official-pilot',
      badgeLabel: 'Pilot',
      isOfficialPilot: true,
      sortRank: 1,
    });

    expect(resolveThemeCatalogPackageMetadata('windows-95-classic')).toMatchObject({
      tierId: 'archive',
      tierLabel: 'Archive',
      badgeLabel: 'Archive',
      isOfficialPilot: false,
    });

    expect(resolveThemeCatalogPackageMetadata('unlisted-lab-theme')).toMatchObject({
      tierId: 'legacy-lab',
      tierLabel: 'Legacy Lab',
      badgeLabel: 'Lab',
      isOfficialPilot: false,
    });
  });

  it('sorts pilot themes ahead of legacy and archive packages in loader output', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vector-monolith/theme.json') {
        return JSON.stringify({
          id: 'vector-monolith',
          name: 'Vector Monolith',
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/amber-cathode/theme.json') {
        return JSON.stringify({
          id: 'amber-cathode',
          name: 'Amber Cathode',
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/windows-95-classic/theme.json') {
        return JSON.stringify({
          id: 'windows-95-classic',
          name: 'Windows 95 Classic',
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'windows-95-classic', path: 'themes/windows-95-classic' },
      { name: 'amber-cathode', path: 'themes/amber-cathode' },
      { name: 'vector-monolith', path: 'themes/vector-monolith' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.packages.map(pkg => pkg.id)).toEqual([
      'vector-monolith',
      'amber-cathode',
      'windows-95-classic',
    ]);
    expect(result.packages[0]?.catalog.tierId).toBe('official-pilot');
    expect(result.packages[0]?.catalog.isOfficialPilot).toBe(true);
    expect(result.packages[1]?.catalog.tierId).toBe('legacy-lab');
    expect(result.packages[2]?.catalog.tierId).toBe('archive');
  });

  it('uses the same comparison contract the loader relies on', () => {
    expect(compareThemeCatalogPackages(
      {
        id: 'vector-monolith',
        name: 'Vector Monolith',
        catalog: resolveThemeCatalogPackageMetadata('vector-monolith'),
      },
      {
        id: 'amber-cathode',
        name: 'Amber Cathode',
        catalog: resolveThemeCatalogPackageMetadata('amber-cathode'),
      },
    )).toBeLessThan(0);
  });
});
