import canonicalIconThemeJson from './canonicalIconTheme.json';

export interface OverlayIconDefinition {
  iconPath?: string;
}

export interface OverlayIconThemeManifest {
  name?: string;
  version?: number;
  description?: string;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  iconDefinitions?: Record<string, OverlayIconDefinition | string>;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  folderNames?: Record<string, string>;
  folderNamesExpanded?: Record<string, string>;
}

export interface OverlayResolvedIconTheme {
  name: string;
  version: number;
  description?: string;
  file: string;
  folder: string;
  folderExpanded: string;
  iconDefinitions: Record<string, string>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
}

export interface OverlayFileIconResolution {
  iconId: string;
  matchKind: 'fileName' | 'extension' | 'default';
}

const ICON_BASE = '/icons/';

function normalizeIconId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
}

function normalizeMatcherMap(source: Record<string, string> | undefined): Record<string, string> {
  if (!source) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => key.trim().length > 0 && value.trim().length > 0)
      .map(([key, value]) => [key.trim().toLowerCase(), normalizeIconId(value)]),
  );
}

function normalizeIconDefinitions(
  source: Record<string, OverlayIconDefinition | string> | undefined,
  resolvePath: (iconPath: string) => string,
): Record<string, string> {
  if (!source) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source)
      .map(([key, value]) => {
        const iconPath = typeof value === 'string' ? value : value?.iconPath;
        if (!iconPath?.trim()) {
          return null;
        }

        return [normalizeIconId(key), resolvePath(iconPath.trim())] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}

function normalizeThemeManifest(
  source: OverlayIconThemeManifest,
  resolvePath: (iconPath: string) => string,
): OverlayResolvedIconTheme {
  return {
    name: source.name?.trim() || 'GreebleFS Icon Theme',
    version: typeof source.version === 'number' ? source.version : 1,
    description: source.description?.trim() || undefined,
    file: normalizeIconId(source.file || 'txt'),
    folder: normalizeIconId(source.folder || 'folder'),
    folderExpanded: normalizeIconId(source.folderExpanded || 'folder_open'),
    iconDefinitions: normalizeIconDefinitions(source.iconDefinitions, resolvePath),
    fileExtensions: normalizeMatcherMap(source.fileExtensions),
    fileNames: normalizeMatcherMap(source.fileNames),
    folderNames: normalizeMatcherMap(source.folderNames),
    folderNamesExpanded: normalizeMatcherMap(source.folderNamesExpanded),
  };
}

function resolveBuiltInIconPath(iconPath: string): string {
  const normalized = iconPath.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith('icons/') ? `${ICON_BASE}${normalized.slice('icons/'.length)}` : normalized;
}

export const BUILT_IN_ICON_THEME = normalizeThemeManifest(
  canonicalIconThemeJson as OverlayIconThemeManifest,
  resolveBuiltInIconPath,
);

export function getBuiltInIconTheme(): OverlayResolvedIconTheme {
  return BUILT_IN_ICON_THEME;
}

export function parseIconThemeManifest(source: string): OverlayIconThemeManifest {
  const parsed = JSON.parse(source) as OverlayIconThemeManifest;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

export function resolveIconThemeManifest(
  source: OverlayIconThemeManifest,
  resolvePath: (iconPath: string) => string,
): OverlayResolvedIconTheme {
  return normalizeThemeManifest(source, resolvePath);
}

export function createResolvedIconThemeFromEntries(iconDefinitions: Record<string, string>): OverlayResolvedIconTheme {
  return {
    ...BUILT_IN_ICON_THEME,
    iconDefinitions: Object.fromEntries(
      Object.entries(iconDefinitions).map(([key, value]) => [normalizeIconId(key), value]),
    ),
  };
}

export function mergeResolvedIconThemes(
  baseTheme: OverlayResolvedIconTheme,
  overrideTheme?: OverlayResolvedIconTheme,
): OverlayResolvedIconTheme {
  if (!overrideTheme) {
    return baseTheme;
  }

  return {
    ...baseTheme,
    ...overrideTheme,
    name: overrideTheme.name || baseTheme.name,
    version: overrideTheme.version || baseTheme.version,
    description: overrideTheme.description ?? baseTheme.description,
    file: overrideTheme.file || baseTheme.file,
    folder: overrideTheme.folder || baseTheme.folder,
    folderExpanded: overrideTheme.folderExpanded || baseTheme.folderExpanded,
    iconDefinitions: {
      ...baseTheme.iconDefinitions,
      ...overrideTheme.iconDefinitions,
    },
    fileExtensions: {
      ...baseTheme.fileExtensions,
      ...overrideTheme.fileExtensions,
    },
    fileNames: {
      ...baseTheme.fileNames,
      ...overrideTheme.fileNames,
    },
    folderNames: {
      ...baseTheme.folderNames,
      ...overrideTheme.folderNames,
    },
    folderNamesExpanded: {
      ...baseTheme.folderNamesExpanded,
      ...overrideTheme.folderNamesExpanded,
    },
  };
}

export function resolveIconSrc(iconId: string, iconTheme?: OverlayResolvedIconTheme): string | undefined {
  const theme = iconTheme ?? BUILT_IN_ICON_THEME;
  return theme.iconDefinitions[normalizeIconId(iconId)];
}

export function resolveFileIconId(
  entryName: string,
  extension: string,
  iconTheme?: OverlayResolvedIconTheme,
): string {
  return resolveFileIcon(entryName, extension, iconTheme).iconId;
}

export function resolveFileIcon(
  entryName: string,
  extension: string,
  iconTheme?: OverlayResolvedIconTheme,
): OverlayFileIconResolution {
  const theme = iconTheme ?? BUILT_IN_ICON_THEME;
  const normalizedName = entryName.trim().toLowerCase();
  const normalizedExtension = extension.trim().replace(/^\./, '').toLowerCase();
  const fileNameMatch = theme.fileNames[normalizedName];
  if (fileNameMatch) {
    return {
      iconId: fileNameMatch,
      matchKind: 'fileName',
    };
  }

  const extensionMatch = theme.fileExtensions[normalizedExtension];
  if (extensionMatch) {
    return {
      iconId: extensionMatch,
      matchKind: 'extension',
    };
  }

  return {
    iconId: theme.file,
    matchKind: 'default',
  };
}

export function resolveFileIconSrc(
  entryName: string,
  extension: string,
  iconTheme?: OverlayResolvedIconTheme,
): string {
  const theme = iconTheme ?? BUILT_IN_ICON_THEME;
  const iconId = resolveFileIcon(entryName, extension, theme).iconId;
  return resolveIconSrc(iconId, theme) ?? `${ICON_BASE}${theme.file}.svg`;
}
