import {
  getBuiltInIconTheme,
  resolveIconSrc,
  type OverlayResolvedIconTheme,
} from './iconTheme';

export type GeneratedFolderIconPair = {
  closed: string;
  open: string | null;
};

const BUILT_IN_ICON_THEME = getBuiltInIconTheme();

function isFolderIconId(iconId: string): boolean {
  return iconId === BUILT_IN_ICON_THEME.folder || iconId.startsWith('folder_');
}

const BUILT_IN_FOLDER_ICON_IDS = Object.keys(BUILT_IN_ICON_THEME.iconDefinitions)
  .filter(iconId => isFolderIconId(iconId) && !iconId.endsWith('_open'))
  .sort((left, right) => left.localeCompare(right));

export type FolderIconValue = typeof BUILT_IN_FOLDER_ICON_IDS[number];

export interface FolderIconRule {
  id: string;
  label: string;
  matchers: string[];
  icon: FolderIconValue;
}

export interface FolderIconOption {
  value: FolderIconValue;
  label: string;
  closedSrc: string;
  openSrc: string;
}

export interface FolderIconResolverConfig {
  rules?: readonly FolderIconRule[];
  defaultIcon?: FolderIconValue;
  iconTheme?: OverlayResolvedIconTheme;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitCamelCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

export function normalizeFolderIconMatcher(value: string): string {
  return splitCamelCase(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function tokenizeSegment(value: string): string[] {
  const normalized = normalizeFolderIconMatcher(value);
  return normalized ? normalized.split('_').filter(Boolean) : [];
}

function buildSegmentVariants(segment: string): string[] {
  const tokens = tokenizeSegment(segment);
  if (!tokens.length) {
    return [];
  }

  const variants = new Set<string>();
  variants.add(tokens.join('_'));

  if (tokens.length > 1) {
    variants.add(tokens.join(''));
    variants.add(tokens[0]);
    variants.add(tokens[tokens.length - 1]);
  }

  const lastToken = tokens[tokens.length - 1];
  if (lastToken.endsWith('s') && lastToken.length > 3) {
    const singularTokens = [...tokens];
    singularTokens[singularTokens.length - 1] = lastToken.slice(0, -1);
    variants.add(singularTokens.join('_'));
    variants.add(singularTokens[singularTokens.length - 1]);
  }

  return [...variants];
}

function buildCandidateMatchers(folderPath: string): string[] {
  const pathSegments = folderPath.split(/[\\/]+/g).filter(Boolean);
  if (!pathSegments.length) {
    return [];
  }

  const candidates = new Set<string>();
  const recentSegments = pathSegments.slice(-4);

  for (const segment of recentSegments) {
    for (const variant of buildSegmentVariants(segment)) {
      candidates.add(variant);
    }
  }

  for (let width = 2; width <= Math.min(3, pathSegments.length); width += 1) {
    const slice = pathSegments.slice(-width);
    const tokens = slice.flatMap(segment => tokenizeSegment(segment));
    if (!tokens.length) {
      continue;
    }

    candidates.add(tokens.join('_'));
    candidates.add(tokens.join(''));
  }

  return [...candidates];
}

function cloneRule(rule: FolderIconRule): FolderIconRule {
  return {
    ...rule,
    matchers: [...rule.matchers],
  };
}

function buildLabelForIcon(iconId: string): string {
  if (iconId === BUILT_IN_ICON_THEME.folder) {
    return 'Default Folder';
  }

  const labelSource = iconId.replace(/^folder_/, '').replace(/_/g, ' ');
  return titleCase(labelSource);
}

function buildRuleId(iconId: string): string {
  return iconId === BUILT_IN_ICON_THEME.folder
    ? 'default-folder'
    : iconId.replace(/^folder_/, '').replace(/_/g, '-');
}

function groupMatchersByIcon(folderNames: Record<string, string>): Map<FolderIconValue, string[]> {
  const grouped = new Map<FolderIconValue, string[]>();

  for (const [matcher, iconId] of Object.entries(folderNames)) {
    if (!isFolderIconId(iconId)) {
      continue;
    }

    const normalizedMatcher = normalizeFolderIconMatcher(matcher);
    if (!normalizedMatcher) {
      continue;
    }

    const existing = grouped.get(iconId as FolderIconValue) ?? [];
    if (!existing.includes(normalizedMatcher)) {
      existing.push(normalizedMatcher);
      grouped.set(iconId as FolderIconValue, existing);
    }
  }

  return grouped;
}

function createFolderRulesFromNames(folderNames: Record<string, string>): FolderIconRule[] {
  return [...groupMatchersByIcon(folderNames).entries()]
    .map(([icon, matchers]) => ({
      id: buildRuleId(icon),
      label: buildLabelForIcon(icon),
      matchers: [...matchers].sort((left, right) => left.localeCompare(right)),
      icon,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export const DEFAULT_FOLDER_ICON_VALUE: FolderIconValue = BUILT_IN_ICON_THEME.folder as FolderIconValue;

export const BUILT_IN_FOLDER_ICON_RULES: readonly FolderIconRule[] = createFolderRulesFromNames(BUILT_IN_ICON_THEME.folderNames);

export function createDefaultFolderIconRules(): FolderIconRule[] {
  return BUILT_IN_FOLDER_ICON_RULES.map(cloneRule);
}

function resolveOpenFolderIconId(icon: FolderIconValue, iconTheme: OverlayResolvedIconTheme): string {
  const openIconId = icon === iconTheme.folder ? iconTheme.folderExpanded : `${icon}_open`;
  return iconTheme.iconDefinitions[openIconId] ? openIconId : icon;
}

function getIconPair(icon: FolderIconValue, iconTheme?: OverlayResolvedIconTheme): GeneratedFolderIconPair {
  const theme = iconTheme ?? BUILT_IN_ICON_THEME;
  const closedIconId = resolveIconSrc(icon, theme) ? icon : theme.folder;
  const openIconId = resolveOpenFolderIconId(closedIconId as FolderIconValue, theme);

  return {
    closed: resolveIconSrc(closedIconId, theme) ?? resolveIconSrc(theme.folder, BUILT_IN_ICON_THEME) ?? '/icons/folder.svg',
    open: resolveIconSrc(openIconId, theme) ?? resolveIconSrc(closedIconId, theme) ?? null,
  };
}

function buildThemeRules(iconTheme?: OverlayResolvedIconTheme): FolderIconRule[] {
  if (!iconTheme) {
    return [];
  }

  return createFolderRulesFromNames(iconTheme.folderNames);
}

function getEffectiveRules(
  rules: readonly FolderIconRule[] | undefined,
  iconTheme?: OverlayResolvedIconTheme,
): readonly FolderIconRule[] {
  const baseRules = rules ?? BUILT_IN_FOLDER_ICON_RULES;
  const themeRules = buildThemeRules(iconTheme);
  if (!themeRules.length) {
    return baseRules;
  }

  return [...themeRules, ...baseRules];
}

function getOptionLabel(icon: FolderIconValue): string {
  return buildLabelForIcon(icon);
}

export const FOLDER_ICON_OPTIONS: readonly FolderIconOption[] = BUILT_IN_FOLDER_ICON_IDS.map(icon => {
  const pair = getIconPair(icon as FolderIconValue, BUILT_IN_ICON_THEME);
  return {
    value: icon as FolderIconValue,
    label: getOptionLabel(icon),
    closedSrc: pair.closed,
    openSrc: pair.open ?? pair.closed,
  };
});

export function getNamedFolderIconSrc(
  icon: FolderIconValue,
  open = false,
  iconTheme?: OverlayResolvedIconTheme,
): string {
  const pair = getIconPair(icon, iconTheme);
  return open ? (pair.open ?? pair.closed) : pair.closed;
}

function findMatchingRule(folderPath: string, rules: readonly FolderIconRule[]): FolderIconRule | null {
  const candidates = buildCandidateMatchers(folderPath);

  for (const rule of rules) {
    const normalizedMatchers = rule.matchers
      .map(normalizeFolderIconMatcher)
      .filter(Boolean);

    if (normalizedMatchers.some(matcher => candidates.includes(matcher))) {
      return rule;
    }
  }

  return null;
}

export function resolveFolderIconPair(folderPath: string, config: FolderIconResolverConfig = {}): GeneratedFolderIconPair {
  const rules = getEffectiveRules(config.rules, config.iconTheme);
  const defaultIcon = config.defaultIcon ?? DEFAULT_FOLDER_ICON_VALUE;
  const matchedRule = findMatchingRule(folderPath.trim(), rules);

  if (matchedRule) {
    return getIconPair(matchedRule.icon, config.iconTheme);
  }

  return getIconPair(defaultIcon, config.iconTheme);
}

export function getFolderIconSrc(folderPath: string, open = false, config: FolderIconResolverConfig = {}): string {
  const rules = getEffectiveRules(config.rules, config.iconTheme);
  const matchedRule = findMatchingRule(folderPath.trim(), rules);
  const icon = matchedRule?.icon ?? config.defaultIcon ?? DEFAULT_FOLDER_ICON_VALUE;
  return getNamedFolderIconSrc(icon, open, config.iconTheme);
}
