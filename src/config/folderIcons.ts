import {
  CUSTOM_FOLDER_ICONS,
  DEFAULT_FOLDER_ICON,
  type GeneratedFolderIconPair,
} from './generatedFolderIconManifest';

export type FolderIconSlug = keyof typeof CUSTOM_FOLDER_ICONS;
export type FolderIconValue = 'folder' | FolderIconSlug;

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
}

const ICON_BASE = '/icons/';

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

export const DEFAULT_FOLDER_ICON_VALUE: FolderIconValue = 'folder';

export const BUILT_IN_FOLDER_ICON_RULES: readonly FolderIconRule[] = [
  { id: 'source', label: 'Source', matchers: ['src', 'source', 'sources'], icon: 'src' },
  { id: 'docs', label: 'Docs', matchers: ['doc', 'docs', 'documentation', 'manual', 'reference'], icon: 'docs' },
  { id: 'crates', label: 'Crates', matchers: ['crate', 'crates'], icon: 'crates' },
  { id: 'node-modules', label: 'Node Modules', matchers: ['node_modules', 'dependencies', 'deps'], icon: 'node_modules' },
  { id: 'components', label: 'Components', matchers: ['component', 'components'], icon: 'components' },
  { id: 'scripts', label: 'Scripts', matchers: ['script', 'scripts', 'cli'], icon: 'scripts' },
  { id: 'config', label: 'Config', matchers: ['config', 'configs', 'configuration', 'settings', 'cfg', 'conf'], icon: 'config' },
  { id: 'assets', label: 'Assets', matchers: ['asset', 'assets', 'resource', 'resources', 'res', 'static', 'media'], icon: 'assets' },
  { id: 'public', label: 'Public', matchers: ['public'], icon: 'public' },
  { id: 'packages', label: 'Packages', matchers: ['package', 'packages', 'vendor', 'third_party'], icon: 'packages' },
  { id: 'plugins', label: 'Plugins', matchers: ['plugin', 'plugins'], icon: 'plugins' },
  { id: 'build', label: 'Build', matchers: ['build', 'dist', 'out', 'output', 'target', 'bin', 'release', 'debug'], icon: 'build' },
  { id: 'tests', label: 'Tests', matchers: ['test', 'tests', '__tests__', 'spec', 'specs', 'fixture', 'fixtures'], icon: 'tests' },
  { id: 'database', label: 'Database', matchers: ['db', 'database', 'databases', 'sql'], icon: 'database' },
  { id: 'api', label: 'API', matchers: ['api', 'service', 'services'], icon: 'api' },
];

export function createDefaultFolderIconRules(): FolderIconRule[] {
  return BUILT_IN_FOLDER_ICON_RULES.map(cloneRule);
}

function getIconPair(icon: FolderIconValue): GeneratedFolderIconPair {
  if (icon === 'folder') {
    return DEFAULT_FOLDER_ICON;
  }

  return CUSTOM_FOLDER_ICONS[icon] ?? DEFAULT_FOLDER_ICON;
}

function getOptionLabel(icon: FolderIconValue): string {
  if (icon === 'folder') {
    return 'Default Folder';
  }

  return titleCase(icon.replace(/_/g, ' '));
}

const folderIconSlugs = Object.keys(CUSTOM_FOLDER_ICONS) as FolderIconSlug[];

export const FOLDER_ICON_OPTIONS: readonly FolderIconOption[] = [
  {
    value: 'folder',
    label: getOptionLabel('folder'),
    closedSrc: `${ICON_BASE}${DEFAULT_FOLDER_ICON.closed}`,
    openSrc: `${ICON_BASE}${DEFAULT_FOLDER_ICON.open ?? DEFAULT_FOLDER_ICON.closed}`,
  },
  ...folderIconSlugs
    .sort((left, right) => left.localeCompare(right))
    .map(icon => {
      const pair = getIconPair(icon);
      return {
        value: icon,
        label: getOptionLabel(icon),
        closedSrc: `${ICON_BASE}${pair.closed}`,
        openSrc: `${ICON_BASE}${pair.open ?? pair.closed}`,
      };
    }),
] as const;

export function getNamedFolderIconSrc(icon: FolderIconValue, open = false): string {
  const pair = getIconPair(icon);
  return `${ICON_BASE}${open ? (pair.open ?? pair.closed) : pair.closed}`;
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
  const rules = config.rules ?? BUILT_IN_FOLDER_ICON_RULES;
  const defaultIcon = config.defaultIcon ?? DEFAULT_FOLDER_ICON_VALUE;
  const matchedRule = findMatchingRule(folderPath.trim(), rules);

  if (matchedRule) {
    return getIconPair(matchedRule.icon);
  }

  return getIconPair(defaultIcon);
}

export function getFolderIconSrc(folderPath: string, open = false, config: FolderIconResolverConfig = {}): string {
  const pair = resolveFolderIconPair(folderPath, config);
  return `${ICON_BASE}${open ? (pair.open ?? pair.closed) : pair.closed}`;
}
