export const mobileLayoutViewModes = [
  'icons-l',
  'icons-m',
  'icons-s',
  'list',
] as const;

export const mobileLayoutSortByOptions = [
  'name',
  'date',
  'size',
  'type',
] as const;

export const mobileLayoutSortOrderOptions = ['asc', 'desc'] as const;

export type MobileLayoutViewMode = typeof mobileLayoutViewModes[number];
export type MobileLayoutSortBy = typeof mobileLayoutSortByOptions[number];
export type MobileLayoutSortOrder = typeof mobileLayoutSortOrderOptions[number];

export interface MobileLayoutSettings {
  viewMode: MobileLayoutViewMode;
  gridZoom: number;
  showHiddenFiles: boolean;
  sortBy: MobileLayoutSortBy;
  sortOrder: MobileLayoutSortOrder;
  directoriesFirst: boolean;
  showTabLabels: boolean;
}

export const defaultMobileLayoutSettings: MobileLayoutSettings = {
  viewMode: 'icons-m',
  gridZoom: 1,
  showHiddenFiles: false,
  sortBy: 'name',
  sortOrder: 'asc',
  directoriesFirst: true,
  showTabLabels: true,
};

export function isMobileGridViewMode(value: MobileLayoutViewMode): boolean {
  return value !== 'list';
}

export function normalizeMobileLayoutViewMode(value: unknown): MobileLayoutViewMode {
  return mobileLayoutViewModes.includes(value as MobileLayoutViewMode)
    ? (value as MobileLayoutViewMode)
    : defaultMobileLayoutSettings.viewMode;
}

export function normalizeMobileLayoutSortBy(value: unknown): MobileLayoutSortBy {
  return mobileLayoutSortByOptions.includes(value as MobileLayoutSortBy)
    ? (value as MobileLayoutSortBy)
    : defaultMobileLayoutSettings.sortBy;
}

export function normalizeMobileLayoutSortOrder(value: unknown): MobileLayoutSortOrder {
  return mobileLayoutSortOrderOptions.includes(value as MobileLayoutSortOrder)
    ? (value as MobileLayoutSortOrder)
    : defaultMobileLayoutSettings.sortOrder;
}

export function normalizeMobileGridZoom(
  value: unknown,
  fallback: number = defaultMobileLayoutSettings.gridZoom,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const rounded = Math.round(value * 100) / 100;
  return Math.max(0.7, Math.min(1.8, rounded));
}

export function normalizeMobileLayoutSettings(
  base: MobileLayoutSettings = defaultMobileLayoutSettings,
  updates?: Partial<MobileLayoutSettings> | null,
): MobileLayoutSettings {
  const merged = {
    ...base,
    ...(updates ?? {}),
  };

  return {
    viewMode: normalizeMobileLayoutViewMode(merged.viewMode),
    gridZoom: normalizeMobileGridZoom(merged.gridZoom, base.gridZoom),
    showHiddenFiles: merged.showHiddenFiles === true,
    sortBy: normalizeMobileLayoutSortBy(merged.sortBy),
    sortOrder: normalizeMobileLayoutSortOrder(merged.sortOrder),
    directoriesFirst: merged.directoriesFirst !== false,
    showTabLabels: merged.showTabLabels !== false,
  };
}
