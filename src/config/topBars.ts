import type {
  OverlayWorkbenchChromeStyle,
  OverlayWorkbenchTabStyle,
} from './workbenchTheme';

export type OverlayTopBarSource = 'built-in' | 'theme-package' | 'top-bar-package';
export type OverlayTopBarNavigationMode = 'auto' | 'summary';
export type OverlayTopBarControlId =
  | 'layout-cycle'
  | 'window-mode'
  | 'overlay-anchor'
  | 'blur-toggle'
  | 'zen-mode'
  | 'panel-menu'
  | 'command-palette'
  | 'settings-shortcut'
  | 'explorer-shortcut'
  | 'shortcut-badge'
  | 'close-overlay';

export interface OverlayTopBarDefinition {
  id?: string;
  name?: string;
  description?: string;
  topBarStyle?: OverlayWorkbenchChromeStyle;
  tabStyle?: OverlayWorkbenchTabStyle;
  navigationMode?: OverlayTopBarNavigationMode;
  leadingControls?: OverlayTopBarControlId[];
  navigationShortcuts?: OverlayTopBarControlId[];
  trailingControls?: OverlayTopBarControlId[];
  tags?: string[];
}

export interface LoadedOverlayTopBarDefinition {
  id: string;
  localId: string;
  name: string;
  description: string;
  source: OverlayTopBarSource;
  sourceLabel: string;
  sourceThemeId?: string;
  sourcePackageId?: string;
  topBarStyle?: OverlayWorkbenchChromeStyle;
  tabStyle?: OverlayWorkbenchTabStyle;
  navigationMode: OverlayTopBarNavigationMode;
  leadingControls: OverlayTopBarControlId[];
  navigationShortcuts: OverlayTopBarControlId[];
  trailingControls: OverlayTopBarControlId[];
  tags: string[];
}

export interface OverlayTopBarThemeLike {
  name?: string;
  defaultTopBarId?: string;
  workbench?: {
    topBarStyle?: OverlayWorkbenchChromeStyle;
  };
}

export interface OverlayTopBarPackageSourceLike {
  topBars?: LoadedOverlayTopBarDefinition[] | null;
}

export interface ResolvedOverlayTopBarSelection {
  availableTopBars: LoadedOverlayTopBarDefinition[];
  topBar: LoadedOverlayTopBarDefinition;
  resolvedFrom: 'explicit' | 'theme-default' | 'theme-legacy-style' | 'fallback';
  requestedTopBarId: string | null;
  explicitSelectionMissing: boolean;
}

const topBarControlCatalog = new Set<OverlayTopBarControlId>([
  'layout-cycle',
  'window-mode',
  'overlay-anchor',
  'blur-toggle',
  'zen-mode',
  'panel-menu',
  'command-palette',
  'settings-shortcut',
  'explorer-shortcut',
  'shortcut-badge',
  'close-overlay',
]);

const defaultTopBarControls = {
  leading: [
    'layout-cycle',
    'window-mode',
    'overlay-anchor',
    'blur-toggle',
    'zen-mode',
    'panel-menu',
    'command-palette',
  ] as OverlayTopBarControlId[],
  navigationShortcuts: [
    'settings-shortcut',
    'explorer-shortcut',
  ] as OverlayTopBarControlId[],
  trailing: [
    'shortcut-badge',
    'close-overlay',
  ] as OverlayTopBarControlId[],
};

const legacyThemeTopBarIdsByStyle: Record<OverlayWorkbenchChromeStyle, string> = {
  solid: 'command-center',
  glass: 'orbital-glass',
  floating: 'floating-deck',
  minimal: 'focus-strip',
};

function cloneTopBarDefinition(
  topBar: LoadedOverlayTopBarDefinition,
): LoadedOverlayTopBarDefinition {
  return {
    ...topBar,
    leadingControls: [...topBar.leadingControls],
    navigationShortcuts: [...topBar.navigationShortcuts],
    trailingControls: [...topBar.trailingControls],
    tags: [...topBar.tags],
  };
}

function normalizeTopBarIdFragment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function normalizeTopBarLabel(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizeTopBarStyle(value: unknown): OverlayWorkbenchChromeStyle | undefined {
  return value === 'solid' || value === 'glass' || value === 'floating' || value === 'minimal'
    ? value
    : undefined;
}

function normalizeTopBarTabStyle(value: unknown): OverlayWorkbenchTabStyle | undefined {
  return value === 'underline' || value === 'capsule' || value === 'segment'
    ? value
    : undefined;
}

function normalizeTopBarNavigationMode(value: unknown): OverlayTopBarNavigationMode {
  return value === 'summary' ? 'summary' : 'auto';
}

function normalizeTopBarTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string')
      .map(entry => entry.trim())
      .filter(Boolean),
  ));
}

function normalizeTopBarControlList(
  value: unknown,
  fallback: OverlayTopBarControlId[],
): OverlayTopBarControlId[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value
    .filter((entry): entry is OverlayTopBarControlId => (
      typeof entry === 'string' && topBarControlCatalog.has(entry as OverlayTopBarControlId)
    ));

  return Array.from(new Set(normalized));
}

export function normalizeTopBarSelectionId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function createScopedTopBarId(scopeId: string, localId: string): string {
  const normalizedScope = normalizeTopBarIdFragment(scopeId, 'theme-package');
  const normalizedLocalId = normalizeTopBarIdFragment(localId, 'top-bar');
  return `${normalizedScope}:${normalizedLocalId}`;
}

export function createLoadedTopBarDefinition(
  definition: OverlayTopBarDefinition,
  options: {
    source: OverlayTopBarSource;
    sourceLabel: string;
    scopeId?: string;
    sourceThemeId?: string;
    sourcePackageId?: string;
  },
): LoadedOverlayTopBarDefinition {
  const localId = normalizeTopBarIdFragment(definition.id ?? definition.name, 'top-bar');
  const normalizedScopeId = normalizeTopBarSelectionId(options.scopeId);
  const id = normalizedScopeId
    ? createScopedTopBarId(normalizedScopeId, localId)
    : localId;
  const fallbackName = definition.name?.trim() || localId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

  return {
    id,
    localId,
    name: normalizeTopBarLabel(definition.name, fallbackName),
    description: normalizeTopBarLabel(
      definition.description,
      options.source === 'theme-package'
        ? `Top bar contributed by ${options.sourceLabel}.`
        : 'Built-in shell top bar profile.',
    ),
    source: options.source,
    sourceLabel: options.sourceLabel,
    sourceThemeId: options.sourceThemeId,
    sourcePackageId: options.sourcePackageId,
    topBarStyle: normalizeTopBarStyle(definition.topBarStyle),
    tabStyle: normalizeTopBarTabStyle(definition.tabStyle),
    navigationMode: normalizeTopBarNavigationMode(definition.navigationMode),
    leadingControls: normalizeTopBarControlList(
      definition.leadingControls,
      defaultTopBarControls.leading,
    ),
    navigationShortcuts: normalizeTopBarControlList(
      definition.navigationShortcuts,
      defaultTopBarControls.navigationShortcuts,
    ),
    trailingControls: normalizeTopBarControlList(
      definition.trailingControls,
      defaultTopBarControls.trailing,
    ),
    tags: normalizeTopBarTags(definition.tags),
  };
}

const builtInTopBarDefinitions = [
  createLoadedTopBarDefinition(
    {
      id: 'command-center',
      name: 'Command Center',
      description: 'The default shell workflow with launcher, tabs, and global utilities all in one chrome pass.',
      topBarStyle: 'solid',
      navigationMode: 'auto',
      tags: ['default', 'balanced'],
    },
    {
      source: 'built-in',
      sourceLabel: 'Built In',
    },
  ),
  createLoadedTopBarDefinition(
    {
      id: 'floating-deck',
      name: 'Floating Deck',
      description: 'The classic shell workflow with a floating command deck silhouette.',
      topBarStyle: 'floating',
      navigationMode: 'auto',
      tags: ['floating', 'shell'],
    },
    {
      source: 'built-in',
      sourceLabel: 'Built In',
    },
  ),
  createLoadedTopBarDefinition(
    {
      id: 'orbital-glass',
      name: 'Orbital Glass',
      description: 'Glass-heavy chrome that keeps the full launcher workflow but leans into a softer capsule tab strip.',
      topBarStyle: 'glass',
      tabStyle: 'capsule',
      navigationMode: 'auto',
      tags: ['glass', 'capsule'],
    },
    {
      source: 'built-in',
      sourceLabel: 'Built In',
    },
  ),
  createLoadedTopBarDefinition(
    {
      id: 'focus-strip',
      name: 'Focus Strip',
      description: 'A tighter, quieter top bar that keeps the explorer and command palette close without hauling every chrome control forward.',
      topBarStyle: 'minimal',
      leadingControls: ['layout-cycle', 'window-mode', 'overlay-anchor'],
      navigationShortcuts: ['explorer-shortcut'],
      trailingControls: ['command-palette', 'zen-mode', 'shortcut-badge', 'close-overlay'],
      navigationMode: 'auto',
      tags: ['minimal', 'focus'],
    },
    {
      source: 'built-in',
      sourceLabel: 'Built In',
    },
  ),
  createLoadedTopBarDefinition(
    {
      id: 'launcher-rack',
      name: 'Launcher Rack',
      description: 'A launcher-first strip that turns the middle lane into a status surface instead of a tab strip.',
      topBarStyle: 'floating',
      leadingControls: ['panel-menu', 'command-palette', 'layout-cycle'],
      navigationShortcuts: ['settings-shortcut', 'explorer-shortcut'],
      trailingControls: ['window-mode', 'overlay-anchor', 'blur-toggle', 'zen-mode', 'shortcut-badge', 'close-overlay'],
      navigationMode: 'summary',
      tags: ['launcher', 'summary'],
    },
    {
      source: 'built-in',
      sourceLabel: 'Built In',
    },
  ),
] as const satisfies readonly LoadedOverlayTopBarDefinition[];

export function getBuiltInTopBars(): LoadedOverlayTopBarDefinition[] {
  return builtInTopBarDefinitions.map(cloneTopBarDefinition);
}

export function resolveAvailableTopBars(
  packageSources: OverlayTopBarPackageSourceLike[] = [],
): LoadedOverlayTopBarDefinition[] {
  const loaded = new Map<string, LoadedOverlayTopBarDefinition>();

  for (const topBar of getBuiltInTopBars()) {
    loaded.set(topBar.id, topBar);
  }

  for (const packageSource of packageSources) {
    for (const topBar of packageSource.topBars ?? []) {
      if (!loaded.has(topBar.id)) {
        loaded.set(topBar.id, cloneTopBarDefinition(topBar));
      }
    }
  }

  return Array.from(loaded.values());
}

export function resolveLegacyThemeTopBarId(
  style: OverlayWorkbenchChromeStyle | undefined,
): string | null {
  if (!style) {
    return null;
  }

  return legacyThemeTopBarIdsByStyle[style] ?? null;
}

export function qualifyThemeTopBarSelectionId(
  selectionId: string | undefined,
  ownerThemeId: string,
  availableTopBars: Pick<LoadedOverlayTopBarDefinition, 'id' | 'localId'>[],
): string | undefined {
  const normalizedSelectionId = normalizeTopBarSelectionId(selectionId);
  if (!normalizedSelectionId) {
    return undefined;
  }

  if (normalizedSelectionId.includes(':')) {
    return normalizedSelectionId;
  }

  const normalizedLocalId = normalizeTopBarIdFragment(normalizedSelectionId, normalizedSelectionId);
  const matchedLocalTopBar = availableTopBars.find(topBar => topBar.localId === normalizedLocalId);
  if (matchedLocalTopBar) {
    return matchedLocalTopBar.id;
  }

  const scopedId = createScopedTopBarId(ownerThemeId, normalizedSelectionId);
  return availableTopBars.some(topBar => topBar.id === scopedId) ? scopedId : normalizedSelectionId;
}

export function resolveActiveTopBarSelection(args: {
  requestedTopBarId?: string | null;
  theme?: OverlayTopBarThemeLike | null;
  packageSources?: OverlayTopBarPackageSourceLike[];
}): ResolvedOverlayTopBarSelection {
  const availableTopBars = resolveAvailableTopBars(args.packageSources);
  const topBarById = new Map(availableTopBars.map(topBar => [topBar.id, topBar] as const));
  const requestedTopBarId = normalizeTopBarSelectionId(args.requestedTopBarId);

  if (requestedTopBarId) {
    const requestedTopBar = topBarById.get(requestedTopBarId);
    if (requestedTopBar) {
      return {
        availableTopBars,
        topBar: cloneTopBarDefinition(requestedTopBar),
        resolvedFrom: 'explicit',
        requestedTopBarId,
        explicitSelectionMissing: false,
      };
    }
  }

  const themeDefaultTopBarId = normalizeTopBarSelectionId(args.theme?.defaultTopBarId);
  if (themeDefaultTopBarId) {
    const themedTopBar = topBarById.get(themeDefaultTopBarId);
    if (themedTopBar) {
      return {
        availableTopBars,
        topBar: cloneTopBarDefinition(themedTopBar),
        resolvedFrom: 'theme-default',
        requestedTopBarId,
        explicitSelectionMissing: requestedTopBarId != null,
      };
    }
  }

  const legacyThemeTopBarId = resolveLegacyThemeTopBarId(args.theme?.workbench?.topBarStyle);
  if (legacyThemeTopBarId) {
    const legacyThemeTopBar = topBarById.get(legacyThemeTopBarId);
    if (legacyThemeTopBar) {
      return {
        availableTopBars,
        topBar: cloneTopBarDefinition(legacyThemeTopBar),
        resolvedFrom: 'theme-legacy-style',
        requestedTopBarId,
        explicitSelectionMissing: requestedTopBarId != null,
      };
    }
  }

  const fallbackTopBar = topBarById.get('command-center') ?? availableTopBars[0];
  if (!fallbackTopBar) {
    throw new Error('Top bar catalog resolved empty. Built-in top bars are required.');
  }

  return {
    availableTopBars,
    topBar: cloneTopBarDefinition(fallbackTopBar),
    resolvedFrom: 'fallback',
    requestedTopBarId,
    explicitSelectionMissing: requestedTopBarId != null,
  };
}

export function getTopBarStyleLabel(style: OverlayWorkbenchChromeStyle | undefined): string {
  switch (style) {
    case 'glass':
      return 'Glass';
    case 'floating':
      return 'Floating';
    case 'minimal':
      return 'Minimal';
    default:
      return 'Solid';
  }
}

export function getTopBarNavigationModeLabel(mode: OverlayTopBarNavigationMode): string {
  return mode === 'summary' ? 'Summary' : 'Tabs';
}

export function getTopBarSourceLabel(source: OverlayTopBarSource): string {
  if (source === 'theme-package') {
    return 'Theme Package';
  }

  if (source === 'top-bar-package') {
    return 'Top Bar Package';
  }

  return 'Built In';
}

export function getTopBarControlLabel(controlId: OverlayTopBarControlId): string {
  switch (controlId) {
    case 'layout-cycle':
      return 'Layout';
    case 'window-mode':
      return 'Window Mode';
    case 'overlay-anchor':
      return 'Dock Edge';
    case 'blur-toggle':
      return 'Blur';
    case 'zen-mode':
      return 'Zen';
    case 'panel-menu':
      return 'Panels';
    case 'command-palette':
      return 'Palette';
    case 'settings-shortcut':
      return 'Settings';
    case 'explorer-shortcut':
      return 'Explorer';
    case 'shortcut-badge':
      return 'Shortcut';
    case 'close-overlay':
      return 'Close';
    default:
      return controlId;
  }
}
