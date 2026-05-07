export type ThemeCatalogTierId = 'official-pilot' | 'legacy-lab' | 'archive';

export interface ThemeCatalogTierDefinition {
  id: ThemeCatalogTierId;
  label: string;
  description: string;
  badgeLabel: string;
  order: number;
}

export interface ThemeCatalogPackageMetadata {
  tierId: ThemeCatalogTierId;
  tierLabel: string;
  tierDescription: string;
  tierOrder: number;
  badgeLabel: string;
  sortRank: number;
  suiteId: string | null;
  suiteLabel: string | null;
  suiteDescription: string | null;
  isOfficialPilot: boolean;
}

interface ThemeCatalogPackageOverride {
  tierId: ThemeCatalogTierId;
  sortRank?: number;
  badgeLabel?: string;
  suiteLabel?: string;
  suiteDescription?: string;
}

export const THEME_CATALOG_TIERS: Record<ThemeCatalogTierId, ThemeCatalogTierDefinition> = {
  'official-pilot': {
    id: 'official-pilot',
    label: 'Official Pilot',
    description: 'Curated new-wave shells that define the current direction of the suite.',
    badgeLabel: 'Pilot',
    order: 0,
  },
  'legacy-lab': {
    id: 'legacy-lab',
    label: 'Legacy Lab',
    description: 'Experimental or transitional shells that are still available but not the flagship direction.',
    badgeLabel: 'Lab',
    order: 1,
  },
  archive: {
    id: 'archive',
    label: 'Archive',
    description: 'Historical, compatibility-focused, or older package themes.',
    badgeLabel: 'Archive',
    order: 2,
  },
} as const;

const THEME_CATALOG_PACKAGE_OVERRIDES: Record<string, ThemeCatalogPackageOverride> = {
  'caveman-god-mode': {
    tierId: 'official-pilot',
    sortRank: 0,
    badgeLabel: 'Pilot',
    suiteLabel: 'Pilot Suite',
    suiteDescription: 'The canonical reference package for future LLM-authored shells.',
  },
  'vector-monolith': {
    tierId: 'official-pilot',
    sortRank: 0,
    badgeLabel: 'Pilot',
    suiteLabel: 'Pilot Suite',
    suiteDescription: 'The strongest 3D-forward shell in the current direction-set.',
  },
  'cyber-nexus-hud': {
    tierId: 'official-pilot',
    sortRank: 1,
    badgeLabel: 'Pilot',
    suiteLabel: 'Pilot Suite',
    suiteDescription: 'The neon-forward shell for the current direction-set.',
  },
  'celestial-astrolabe': {
    tierId: 'official-pilot',
    sortRank: 2,
    badgeLabel: 'Pilot',
    suiteLabel: 'Pilot Suite',
    suiteDescription: 'The spectacle-heavy orbital shell for the current direction-set.',
  },
  'clarity-line': {
    tierId: 'official-pilot',
    sortRank: 3,
    badgeLabel: 'Pilot',
    suiteLabel: 'Pilot Suite',
    suiteDescription: 'The editorial shell for the current direction-set.',
  },
  doors: {
    tierId: 'official-pilot',
    sortRank: 4,
    badgeLabel: 'Pilot',
    suiteLabel: 'Pilot Suite',
    suiteDescription: 'The desktop-window-manager reference shell for the current direction-set.',
  },
  'windows-95-classic': {
    tierId: 'archive',
    sortRank: 0,
  },
  'windows-xp-luna': {
    tierId: 'archive',
    sortRank: 1,
  },
  'dos-navigator': {
    tierId: 'archive',
    sortRank: 2,
  },
  'palm-organizer': {
    tierId: 'archive',
    sortRank: 3,
  },
};

function normalizeThemeCatalogId(themeId: string): string {
  return themeId.trim().toLowerCase();
}

export function resolveThemeCatalogPackageMetadata(themeId: string): ThemeCatalogPackageMetadata {
  const normalizedId = normalizeThemeCatalogId(themeId);
  const override = THEME_CATALOG_PACKAGE_OVERRIDES[normalizedId];
  const tier = THEME_CATALOG_TIERS[override?.tierId ?? 'legacy-lab'];

  return {
    tierId: tier.id,
    tierLabel: tier.label,
    tierDescription: tier.description,
    tierOrder: tier.order,
    badgeLabel: override?.badgeLabel ?? tier.badgeLabel,
    sortRank: override?.sortRank ?? 0,
    suiteId: tier.id === 'official-pilot' ? 'official-pilot' : null,
    suiteLabel: tier.id === 'official-pilot' ? override?.suiteLabel ?? 'Pilot Suite' : null,
    suiteDescription: tier.id === 'official-pilot'
      ? override?.suiteDescription ?? tier.description
      : null,
    isOfficialPilot: tier.id === 'official-pilot',
  };
}

export interface ThemeCatalogComparablePackage {
  id: string;
  name: string;
  catalog: ThemeCatalogPackageMetadata;
}

export function compareThemeCatalogPackages(left: ThemeCatalogComparablePackage, right: ThemeCatalogComparablePackage): number {
  const tierOrder = left.catalog.tierOrder - right.catalog.tierOrder;
  if (tierOrder !== 0) {
    return tierOrder;
  }

  const sortRank = left.catalog.sortRank - right.catalog.sortRank;
  if (sortRank !== 0) {
    return sortRank;
  }

  const nameOrder = left.name.localeCompare(right.name);
  if (nameOrder !== 0) {
    return nameOrder;
  }

  return left.id.localeCompare(right.id);
}
