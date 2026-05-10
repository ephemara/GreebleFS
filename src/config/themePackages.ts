import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';

import {
  createLoadedTopBarDefinition,
  qualifyThemeTopBarSelectionId,
  type LoadedOverlayTopBarDefinition,
  type OverlayTopBarDefinition,
} from './topBars';
import {
  normalizeThemeDefinition,
  overlayThemePresets,
  type OverlayThemeDefinition,
} from './appearance';
import {
  createMediaWallpaperFromFile,
  isFrontendWallpaperFile,
  isMediaWallpaperFile,
  loadWallpaperFromSource,
  type LoadedOverlayWallpaper,
} from '../components/wallpaperRuntime';
import {
  deriveAnimationName,
  isFrontendAnimationFile,
  loadAnimationFromSource,
  type LoadedOverlayAnimation,
} from '../components/animationRuntime';
import {
  deriveShaderName,
  isFrontendShaderFile,
  loadShaderFromSource,
  type LoadedOverlayShader,
} from '../components/shaderRuntime';
import {
  loadIconThemePackagesFromDirectoryEntries,
  type LoadedIconThemePackage,
} from './iconThemePackages';
import {
  mergeResolvedIconThemes,
  type OverlayResolvedIconTheme,
} from './iconTheme';
import { getManagedContentDirectory } from './appContentDirectories';
import {
  loadExplorerHomePacksFromDirectoryEntries,
  type LoadedExplorerHomePack,
} from './homePackages';
import {
  loadSoundPacks,
  loadSoundPacksFromDirectoryEntries,
  type LoadedOverlaySoundPack,
} from './soundPacks';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import {
  loadThemeAppearancePacks,
  loadThemeAppearancePacksFromDirectoryEntries,
  loadThemeEnginePacks,
  loadThemeEnginePacksFromDirectoryEntries,
  loadThemeInteractionMotionPacks,
  loadThemeInteractionMotionPacksFromDirectoryEntries,
  loadThemeRecipePacks,
  loadThemeRecipePacksFromDirectoryEntries,
  loadThemeShellRendererPacks,
  loadThemeShellRendererPacksFromDirectoryEntries,
  createInlineThemeAppearancePack,
  createInlineThemeEnginePack,
  createInlineThemeInteractionMotionPack,
  createInlineThemeRecipePack,
  type LoadedThemeAppearancePack,
  type LoadedThemeEnginePack,
  type LoadedThemeInteractionMotionPack,
  type LoadedThemeRecipePack,
  type LoadedThemeShellRendererPack,
  type ThemeAppearancePackManifest,
  type ThemeEnginePackManifest,
  type ThemeInteractionMotionPackManifest,
  type ThemeRecipePackManifest,
} from './themeBundlePacks';
import {
  loadExplorerMenuPacksFromDirectoryEntries,
  type LoadedExplorerMenuPack,
} from './menuPacks';
import {
  loadTopBarPackagesFromDirectoryEntries,
} from './topBarPackages';
import {
  loadExplorerLayoutPackagesFromDirectoryEntries,
  normalizeExplorerLayoutDefinition,
  type LoadedExplorerLayoutDefinition,
} from './explorerLayouts';
import {
  commands,
  unwrapTauriResult,
} from '../runtime/tauriClient';
import { listLocalDirectoryEntriesFast } from '../runtime/localDirectoryListing';
import {
  compileThemeEngineManifest,
  normalizeThemeManifestDraft,
} from '../runtime/themeEngineBackend';
import {
  createUiTokenCssVars,
  flattenUiTokenCollectionToDesignTokens,
  mergeUiTokenCollections,
} from './uiTokenContract';
import {
  compareThemeCatalogPackages,
  resolveThemeCatalogPackageMetadata,
  type ThemeCatalogPackageMetadata,
} from './themeCatalogCuration';
import { looseRecordSchema } from './schemaSanitizers';
import {
  loadVsCodeColorThemeContributionsFromEntry,
  type LoadedVsCodeColorThemeContribution,
  type ManagedPackageSourceInfo,
} from './vscodeThemeCompatibility';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

const themeBundleEmbeddedSchema = z.object({
  appearancePacks: z.array(looseRecordSchema).optional(),
  interactionMotionPacks: z.array(looseRecordSchema).optional(),
  themeRecipes: z.array(looseRecordSchema).optional(),
  themeEngines: z.array(looseRecordSchema).optional(),
}).partial();

const themeBundleManifestObjectSchema = z.object({
  version: z.number().finite().optional(),
  id: z.unknown().optional(),
  name: z.unknown().optional(),
  description: z.unknown().optional(),
  author: z.unknown().optional(),
  homepage: z.unknown().optional(),
  tags: z.unknown().optional(),
  extends: z.unknown().optional(),
  preview: z.unknown().optional(),
  appearancePackId: z.unknown().optional(),
  topBarId: z.unknown().optional(),
  explorerLayoutId: z.unknown().optional(),
  iconThemeId: z.unknown().optional(),
  wallpaperId: z.unknown().optional(),
  soundPackId: z.unknown().optional(),
  shaderId: z.unknown().optional(),
  openAnimationId: z.unknown().optional(),
  closeAnimationId: z.unknown().optional(),
  interactionMotionPackId: z.unknown().optional(),
  rendererId: z.unknown().optional(),
  themeRecipeId: z.unknown().optional(),
  themeEngineId: z.unknown().optional(),
  homePackId: z.unknown().optional(),
  menuPackId: z.unknown().optional(),
  embedded: themeBundleEmbeddedSchema.optional(),
  appearancePack: looseRecordSchema.optional(),
  interactionMotionPack: looseRecordSchema.optional(),
  themeRecipePack: looseRecordSchema.optional(),
  themeEnginePack: looseRecordSchema.optional(),
}).passthrough();

export interface OverlayThemeBundleManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  extends?: string;
  preview?: string;
  appearancePackId?: string;
  topBarId?: string;
  explorerLayoutId?: string;
  iconThemeId?: string;
  wallpaperId?: string;
  soundPackId?: string;
  shaderId?: string;
  openAnimationId?: string;
  closeAnimationId?: string;
  interactionMotionPackId?: string;
  rendererId?: string;
  themeRecipeId?: string;
  themeEngineId?: string;
  homePackId?: string;
  menuPackId?: string;
  embedded?: {
    appearancePacks?: ThemeAppearancePackManifest[];
    interactionMotionPacks?: ThemeInteractionMotionPackManifest[];
    themeRecipes?: ThemeRecipePackManifest[];
    themeEngines?: ThemeEnginePackManifest[];
  };
}

interface OverlayThemeBundleRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: OverlayThemeBundleManifest;
}

export interface ThemePackageDirectoryEntry {
  name: string;
  path: string;
  isDirectory?: boolean;
  extension?: string;
  modified?: number;
}

export interface LoadedThemeBundleLocalId {
  id: string;
  localId: string;
}

export interface LoadedThemeBundleLocalIconTheme extends LoadedIconThemePackage {
  localId: string;
}

export interface LoadedThemeBundleLocalWallpaper extends LoadedOverlayWallpaper {
  localId: string;
}

export interface LoadedThemeBundleLocalHomePack extends LoadedExplorerHomePack {
  localId: string;
}

export interface LoadedThemeBundleLocalMenuPack extends LoadedExplorerMenuPack {
  localId: string;
}

export interface ThemeBundleLocalCatalogs {
  appearancePacks: LoadedThemeAppearancePack[];
  interactionMotionPacks: LoadedThemeInteractionMotionPack[];
  shellRenderers: LoadedThemeShellRendererPack[];
  themeRecipePacks: LoadedThemeRecipePack[];
  themeEnginePacks: LoadedThemeEnginePack[];
  soundPacks: LoadedOverlaySoundPack[];
  iconThemePackages: LoadedThemeBundleLocalIconTheme[];
  wallpapers: LoadedThemeBundleLocalWallpaper[];
  homePacks: LoadedThemeBundleLocalHomePack[];
  menuPacks: LoadedThemeBundleLocalMenuPack[];
  explorerLayouts: LoadedExplorerLayoutDefinition[];
  shaders: LoadedThemeBundleLocalId[];
  animations: LoadedThemeBundleLocalId[];
}

export interface ThemeBundleDependencyCatalogs {
  appearancePacks?: LoadedThemeAppearancePack[];
  interactionMotionPacks?: LoadedThemeInteractionMotionPack[];
  shellRenderers?: LoadedThemeShellRendererPack[];
  themeRecipePacks?: LoadedThemeRecipePack[];
  themeEnginePacks?: LoadedThemeEnginePack[];
  soundPacks?: LoadedOverlaySoundPack[];
  iconThemePackages?: LoadedIconThemePackage[];
  wallpapers?: LoadedOverlayWallpaper[];
}

export interface LoadedOverlayThemePackage {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'theme-directory' | 'plugin-package' | 'vscode-theme-directory' | 'vscode-theme-vsix';
  sourceLabel: string;
  sourceInfo?: ManagedPackageSourceInfo;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  previewUrl?: string;
  warnings: string[];
  catalog: ThemeCatalogPackageMetadata;
  capabilitySummary: {
    icons: boolean;
    wallpaper: boolean;
    dock: boolean;
    visuals: number;
    shaders: number;
    animations: number;
    fonts: number;
    themeRenderer: boolean;
    topBars?: number;
  };
  manifest?: OverlayThemeBundleManifest;
  localCatalogs?: ThemeBundleLocalCatalogs;
  theme: OverlayThemeDefinition;
  engineManifest?: OverlayThemeDefinition['engineManifest'];
  compiledEngineManifest?: OverlayThemeDefinition['compiledEngineManifest'];
  themeRenderer?: OverlayThemeDefinition['themeRenderer'];
  topBars?: LoadedOverlayTopBarDefinition[];
}

export interface GlobalThemeBundleCatalogs {
  appearancePacks: LoadedThemeAppearancePack[];
  interactionMotionPacks: LoadedThemeInteractionMotionPack[];
  shellRenderers: LoadedThemeShellRendererPack[];
  themeRecipePacks: LoadedThemeRecipePack[];
  themeEnginePacks: LoadedThemeEnginePack[];
  soundPacks: LoadedOverlaySoundPack[];
  warnings: string[];
}

export interface ThemePackageLoadResult {
  packages: LoadedOverlayThemePackage[];
  shaders: LoadedOverlayShader[];
  animations: LoadedOverlayAnimation[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
  dependencyCatalogs: GlobalThemeBundleCatalogs;
}

export interface ThemePackageLoadOptions {
  sourceKind?: LoadedOverlayThemePackage['sourceKind'];
  sourceLabel?: string;
  dependencyCatalogs?: GlobalThemeBundleCatalogs;
}

export const themeSystemConfig = {
  get themesDirectory(): string {
    return getManagedContentDirectory('themes');
  },
  manifestNames: ['theme.json', 'theme.toml', 'manifest.json', 'manifest.toml'] as const,
  childDirectoryNames: {
    appearancePacks: 'appearance-packs',
    topBars: 'top-bars',
    explorerLayouts: 'explorer-layouts',
    iconThemes: 'icon-themes',
    wallpapers: 'wallpapers',
    shaders: 'shaders',
    animations: 'animations',
    interactionMotion: 'interaction-motion',
    soundPacks: 'sound-packs',
    shellRenderers: 'shell-renderers',
    themeRecipes: 'theme-recipes',
    themeEngines: 'theme-engines',
    homePacks: 'home-packs',
    menuPacks: 'menu-packs',
  },
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

function emptyLocalCatalogs(): ThemeBundleLocalCatalogs {
  return {
    appearancePacks: [],
    interactionMotionPacks: [],
    shellRenderers: [],
    themeRecipePacks: [],
    themeEnginePacks: [],
    soundPacks: [],
    iconThemePackages: [],
    wallpapers: [],
    homePacks: [],
    menuPacks: [],
    explorerLayouts: [],
    shaders: [],
    animations: [],
  };
}

export function createEmptyGlobalThemeBundleCatalogs(): GlobalThemeBundleCatalogs {
  return {
    appearancePacks: [],
    interactionMotionPacks: [],
    shellRenderers: [],
    themeRecipePacks: [],
    themeEnginePacks: [],
    soundPacks: [],
    warnings: [],
  };
}

function normalizeThemePackageDirectoryEntry(
  entry: ThemePackageDirectoryEntry,
): Required<Pick<ThemePackageDirectoryEntry, 'name' | 'path' | 'extension'>> & { isDirectory: boolean; modified: number } {
  return {
    name: entry.name,
    path: entry.path,
    isDirectory: entry.isDirectory ?? true,
    extension: (entry.extension ?? '').trim().toLowerCase(),
    modified: entry.modified ?? 0,
  };
}

function mergeResolvedThemeAssets(
  baseAssets: OverlayThemeDefinition['assets'],
  nextAssets: OverlayThemeDefinition['assets'],
): OverlayThemeDefinition['assets'] {
  if (!baseAssets && !nextAssets) {
    return undefined;
  }

  return {
    ...baseAssets,
    ...nextAssets,
    iconTheme: baseAssets?.iconTheme && nextAssets?.iconTheme
      ? mergeResolvedIconThemes(baseAssets.iconTheme, nextAssets.iconTheme)
      : (nextAssets?.iconTheme ?? baseAssets?.iconTheme),
    iconEntries: {
      ...(baseAssets?.iconEntries ?? {}),
      ...(nextAssets?.iconEntries ?? {}),
    },
    monacoTheme: baseAssets?.monacoTheme || nextAssets?.monacoTheme
      ? {
          ...baseAssets?.monacoTheme,
          ...nextAssets?.monacoTheme,
          colors: {
            ...(baseAssets?.monacoTheme?.colors ?? {}),
            ...(nextAssets?.monacoTheme?.colors ?? {}),
          },
          rules: [
            ...(baseAssets?.monacoTheme?.rules ?? []),
            ...(nextAssets?.monacoTheme?.rules ?? []),
          ],
        }
      : undefined,
  };
}

function buildIconThemeCapabilitySummary(
  iconTheme: OverlayResolvedIconTheme,
): LoadedIconThemePackage['capabilitySummary'] {
  return {
    iconDefinitions: Object.keys(iconTheme.iconDefinitions).length,
    fileExtensions: Object.keys(iconTheme.fileExtensions).length,
    fileNames: Object.keys(iconTheme.fileNames).length,
    folderNames: Object.keys(iconTheme.folderNames).length,
    folderNamesExpanded: Object.keys(iconTheme.folderNamesExpanded).length,
    uiIcons: Object.keys(iconTheme.uiIcons).length,
  };
}

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map(entry => entry.trim()),
  ));
}

function normalizeIdFragment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function createScopedId(scopeId: string, localId: string): string {
  return `${normalizeIdFragment(scopeId, 'theme-bundle')}:${normalizeIdFragment(localId, 'local')}`;
}

function toAssetUrl(filePath: string): string {
  if (typeof window === 'undefined') {
    return filePath;
  }

  try {
    return convertFileSrc(filePath);
  } catch {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`;
  }
}

function normalizeRelativeAssetPath(path: string): string {
  return path.trim().replace(/^\.(?:\/|\\)/, '');
}

async function resolveOptionalPreviewUrl(directoryPath: string, previewPath?: string): Promise<string | undefined> {
  const trimmedPath = previewPath?.trim();
  if (!trimmedPath) {
    return undefined;
  }

  return toAssetUrl(joinPlatformPath(directoryPath, normalizeRelativeAssetPath(trimmedPath)));
}

function deriveBundleId(record: OverlayThemeBundleRecord): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return explicitId;
  }

  return record.directoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme-bundle';
}

function deriveBundleName(record: OverlayThemeBundleRecord, bundleId: string): string {
  return asString(record.manifest.name)
    || bundleId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }

  return normalized.slice(0, lastSlash);
}

function hasLegacyThemePackageFields(source: LooseRecord): boolean {
  return [
    'theme',
    'topBars',
    'assets',
    'contributions',
    'visuals',
    'cssVars',
    'fonts',
    'presentation',
    'compatibility',
    'designTokens',
    'layoutPrimitives',
    'navigationPatterns',
    'animationProfiles',
    'iconPacks',
    'renderStyles',
    'themeRenderer',
    'defaultTopBarId',
    'defaultExplorerLayoutId',
    'defaultHomePackId',
    'defaultShaderId',
    'defaultOpenAnimationId',
    'defaultCloseAnimationId',
  ].some(key => key in source);
}

function parseInlinePackArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function parseThemeBundleManifestText(text: string, filePath: string): OverlayThemeBundleManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Theme bundle manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const parsedManifestObject = themeBundleManifestObjectSchema.safeParse(parsed);
  if (!parsedManifestObject.success) {
    throw new Error(`Theme bundle manifest is invalid: ${filePath}\n${parsedManifestObject.error.message}`);
  }
  const source = parsedManifestObject.data;

  if (hasLegacyThemePackageFields(source)) {
    throw new Error(`Legacy monolithic theme packages are no longer supported: ${filePath}`);
  }

  const embedded = asRecord(source.embedded);
  const appearancePack = asRecord(source.appearancePack) as ThemeAppearancePackManifest | undefined;
  const interactionMotionPack = asRecord(source.interactionMotionPack) as ThemeInteractionMotionPackManifest | undefined;
  const themeRecipePack = asRecord(source.themeRecipePack) as ThemeRecipePackManifest | undefined;
  const themeEnginePack = asRecord(source.themeEnginePack) as ThemeEnginePackManifest | undefined;

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    extends: asString(source.extends),
    preview: asString(source.preview),
    appearancePackId: asString(source.appearancePackId),
    topBarId: asString(source.topBarId),
    explorerLayoutId: asString(source.explorerLayoutId),
    iconThemeId: asString(source.iconThemeId),
    wallpaperId: asString(source.wallpaperId),
    soundPackId: asString(source.soundPackId),
    shaderId: asString(source.shaderId),
    openAnimationId: asString(source.openAnimationId),
    closeAnimationId: asString(source.closeAnimationId),
    interactionMotionPackId: asString(source.interactionMotionPackId),
    rendererId: asString(source.rendererId),
    themeRecipeId: asString(source.themeRecipeId),
    themeEngineId: asString(source.themeEngineId),
    homePackId: asString(source.homePackId),
    menuPackId: asString(source.menuPackId),
    embedded: {
      appearancePacks: [
        ...(appearancePack ? [appearancePack] : []),
        ...parseInlinePackArray<ThemeAppearancePackManifest>(embedded?.appearancePacks),
      ],
      interactionMotionPacks: [
        ...(interactionMotionPack ? [interactionMotionPack] : []),
        ...parseInlinePackArray<ThemeInteractionMotionPackManifest>(embedded?.interactionMotionPacks),
      ],
      themeRecipes: [
        ...(themeRecipePack ? [themeRecipePack] : []),
        ...parseInlinePackArray<ThemeRecipePackManifest>(embedded?.themeRecipes),
      ],
      themeEngines: [
        ...(themeEnginePack ? [themeEnginePack] : []),
        ...parseInlinePackArray<ThemeEnginePackManifest>(embedded?.themeEngines),
      ],
    },
  };
}

async function readBundleManifest(directoryPath: string): Promise<{ manifestPath: string; manifest: OverlayThemeBundleManifest } | null> {
  for (const manifestName of themeSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(directoryPath, manifestName);
    let text: string;
    try {
      text = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
    } catch {
      continue;
    }

    return {
      manifestPath,
      manifest: parseThemeBundleManifestText(text, manifestPath),
    };
  }

  return null;
}

async function loadChildDirectoryEntries(directoryPath: string): Promise<FileEntry[]> {
  try {
    return await listLocalDirectoryEntriesFast(directoryPath);
  } catch {
    return [];
  }
}

function toTopBarDefinition(topBar: LoadedOverlayTopBarDefinition): OverlayTopBarDefinition {
  return {
    id: topBar.localId,
    name: topBar.name,
    description: topBar.description,
    topBarStyle: topBar.topBarStyle,
    tabStyle: topBar.tabStyle,
    navigationMode: topBar.navigationMode,
    leadingControls: topBar.leadingControls,
    navigationShortcuts: topBar.navigationShortcuts,
    trailingControls: topBar.trailingControls,
    tags: topBar.tags,
  };
}

function scopeTopBarsToBundle(
  bundleId: string,
  bundleName: string,
  topBars: LoadedOverlayTopBarDefinition[],
): LoadedOverlayTopBarDefinition[] {
  const deduped = new Map<string, LoadedOverlayTopBarDefinition>();

  for (const topBar of topBars) {
    const loaded = createLoadedTopBarDefinition(
      toTopBarDefinition(topBar),
      {
        source: 'theme-package',
        sourceLabel: bundleName,
        scopeId: bundleId,
        sourceThemeId: bundleId,
      },
    );
    if (!deduped.has(loaded.id)) {
      deduped.set(loaded.id, loaded);
    }
  }

  return Array.from(deduped.values());
}

function scopeIconThemePackageToBundle(
  bundleId: string,
  iconThemePackage: LoadedIconThemePackage,
): LoadedThemeBundleLocalIconTheme {
  const localId = normalizeIdFragment(iconThemePackage.id, 'icon-theme');
  const scopedId = createScopedId(bundleId, localId);
  return {
    ...iconThemePackage,
    id: scopedId,
    localId,
    iconTheme: {
      ...iconThemePackage.iconTheme,
      id: scopedId,
    },
  };
}

function scopeWallpaperToBundle(
  bundleId: string,
  wallpaper: LoadedOverlayWallpaper,
): LoadedThemeBundleLocalWallpaper {
  const localId = normalizeIdFragment(wallpaper.id ?? wallpaper.name, 'wallpaper');
  return {
    ...wallpaper,
    id: createScopedId(bundleId, localId),
    localId,
  };
}

function scopeHomePackToBundle(
  bundleId: string,
  pack: LoadedExplorerHomePack,
): LoadedThemeBundleLocalHomePack {
  const localId = normalizeIdFragment(pack.id, 'home-pack');
  const scopedId = createScopedId(bundleId, localId);
  return {
    ...pack,
    id: scopedId,
    localId,
    runtime: {
      ...pack.runtime,
      id: scopedId,
    },
  };
}

function scopeMenuPackToBundle(
  bundleId: string,
  pack: LoadedExplorerMenuPack,
): LoadedThemeBundleLocalMenuPack {
  const localId = normalizeIdFragment(pack.id, 'menu-pack');
  return {
    ...pack,
    id: createScopedId(bundleId, localId),
    localId,
  };
}

function scopeExplorerLayoutToBundle(
  bundleId: string,
  bundleName: string,
  layout: LoadedExplorerLayoutDefinition,
): LoadedExplorerLayoutDefinition {
  return normalizeExplorerLayoutDefinition(layout, {
    fallbackId: layout.localId,
    readOnly: true,
    scopeId: bundleId,
    source: 'theme-package',
    sourceLabel: bundleName,
    sourcePackageId: bundleId,
  });
}

function createLocalRuntimeId(bundleId: string, fileName: string, type: 'shader' | 'animation'): LoadedThemeBundleLocalId {
  const localId = normalizeIdFragment(fileName.replace(/\.[^.]+$/, ''), type);
  return {
    id: createScopedId(bundleId, localId),
    localId,
  };
}

function buildLocalCatalogEntry<T extends { id: string }>(value: T, localId: string): { id: string; localId: string; value: T } {
  return { id: value.id, localId, value };
}

interface CollectedPackageLocalCatalogs {
  appearancePacks: LoadedThemeAppearancePack[];
  interactionMotionPacks: LoadedThemeInteractionMotionPack[];
  shellRenderers: LoadedThemeShellRendererPack[];
  themeRecipePacks: LoadedThemeRecipePack[];
  themeEnginePacks: LoadedThemeEnginePack[];
  soundPacks: LoadedOverlaySoundPack[];
  topBars: LoadedOverlayTopBarDefinition[];
  iconThemePackages: LoadedThemeBundleLocalIconTheme[];
  wallpapers: LoadedThemeBundleLocalWallpaper[];
  homePacks: LoadedThemeBundleLocalHomePack[];
  menuPacks: LoadedThemeBundleLocalMenuPack[];
  explorerLayouts: LoadedExplorerLayoutDefinition[];
  shaders: LoadedThemeBundleLocalId[];
  animations: LoadedThemeBundleLocalId[];
}

function resolveReferencedCatalogValue<T>(
  requestedId: string | undefined,
  localEntries: Array<{ id: string; localId: string; value: T }>,
  externalEntries: Array<{ id: string; localId: string; value: T }>,
): T | undefined {
  const trimmedId = requestedId?.trim();
  if (!trimmedId) {
    if (localEntries.length === 1) {
      return localEntries[0]?.value;
    }
    return undefined;
  }

  const localMatch = localEntries.find(entry => entry.id === trimmedId || entry.localId === trimmedId);
  if (localMatch) {
    return localMatch.value;
  }

  return externalEntries.find(entry => entry.id === trimmedId)?.value;
}

function resolveScopedSelectionId(
  requestedId: string | undefined,
  localEntries: Array<{ id: string; localId: string }>,
): string | undefined {
  const trimmedId = requestedId?.trim();
  if (!trimmedId) {
    if (localEntries.length === 1) {
      return localEntries[0]?.id;
    }
    return undefined;
  }

  const localMatch = localEntries.find(entry => entry.id === trimmedId || entry.localId === trimmedId);
  return localMatch?.id ?? trimmedId;
}

function collectPackageLocalCatalogs(packages: LoadedOverlayThemePackage[]): CollectedPackageLocalCatalogs {
  return {
    appearancePacks: packages.flatMap(pkg => pkg.localCatalogs?.appearancePacks ?? []),
    interactionMotionPacks: packages.flatMap(pkg => pkg.localCatalogs?.interactionMotionPacks ?? []),
    shellRenderers: packages.flatMap(pkg => pkg.localCatalogs?.shellRenderers ?? []),
    themeRecipePacks: packages.flatMap(pkg => pkg.localCatalogs?.themeRecipePacks ?? []),
    themeEnginePacks: packages.flatMap(pkg => pkg.localCatalogs?.themeEnginePacks ?? []),
    soundPacks: packages.flatMap(pkg => pkg.localCatalogs?.soundPacks ?? []),
    topBars: packages.flatMap(pkg => pkg.topBars ?? []),
    iconThemePackages: packages.flatMap(pkg => pkg.localCatalogs?.iconThemePackages ?? []),
    wallpapers: packages.flatMap(pkg => pkg.localCatalogs?.wallpapers ?? []),
    homePacks: packages.flatMap(pkg => pkg.localCatalogs?.homePacks ?? []),
    menuPacks: packages.flatMap(pkg => pkg.localCatalogs?.menuPacks ?? []),
    explorerLayouts: packages.flatMap(pkg => pkg.localCatalogs?.explorerLayouts ?? []),
    shaders: packages.flatMap(pkg => pkg.localCatalogs?.shaders ?? []),
    animations: packages.flatMap(pkg => pkg.localCatalogs?.animations ?? []),
  };
}

function cloneThemePackageWithResolution(
  packageInfo: LoadedOverlayThemePackage,
  nextTheme: OverlayThemeDefinition,
  warnings: string[],
): LoadedOverlayThemePackage {
  return {
    ...packageInfo,
    warnings,
    previewUrl: packageInfo.previewUrl ?? nextTheme.assets?.previewUrl ?? nextTheme.assets?.backgroundUrl,
    theme: nextTheme,
    engineManifest: nextTheme.engineManifest,
    compiledEngineManifest: nextTheme.compiledEngineManifest,
    themeRenderer: nextTheme.themeRenderer,
  };
}

export function resolveLoadedThemePackages(
  packages: LoadedOverlayThemePackage[],
  dependencies: ThemeBundleDependencyCatalogs = {},
): LoadedOverlayThemePackage[] {
  const packageLookup = new Map(packages.map(pkg => [pkg.id, pkg] as const));
  const localCatalogs = collectPackageLocalCatalogs(packages);
  const resolvedCache = new Map<string, LoadedOverlayThemePackage>();

  const appearanceEntries = [
    ...(dependencies.appearancePacks ?? []).map(pack => buildLocalCatalogEntry(pack, pack.localId)),
    ...localCatalogs.appearancePacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const interactionMotionEntries = [
    ...(dependencies.interactionMotionPacks ?? []).map(pack => buildLocalCatalogEntry(pack, pack.localId)),
    ...localCatalogs.interactionMotionPacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const shellRendererEntries = [
    ...(dependencies.shellRenderers ?? []).map(pack => buildLocalCatalogEntry(pack, pack.localId)),
    ...localCatalogs.shellRenderers.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const soundPackEntries = [
    ...(dependencies.soundPacks ?? []).map(pack => buildLocalCatalogEntry(pack, pack.localId)),
    ...localCatalogs.soundPacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const themeRecipeEntries = [
    ...(dependencies.themeRecipePacks ?? []).map(pack => buildLocalCatalogEntry(pack, pack.localId)),
    ...localCatalogs.themeRecipePacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const themeEngineEntries = [
    ...(dependencies.themeEnginePacks ?? []).map(pack => buildLocalCatalogEntry(pack, pack.localId)),
    ...localCatalogs.themeEnginePacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const iconThemeEntries = [
    ...(dependencies.iconThemePackages ?? []).map(pack => buildLocalCatalogEntry(pack, normalizeIdFragment(pack.id, 'icon-theme'))),
    ...localCatalogs.iconThemePackages.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
  ];
  const wallpaperEntries = [
    ...(dependencies.wallpapers ?? []).map(wallpaper => buildLocalCatalogEntry(wallpaper, normalizeIdFragment(wallpaper.id, 'wallpaper'))),
    ...localCatalogs.wallpapers.map(wallpaper => buildLocalCatalogEntry(wallpaper, wallpaper.localId)),
  ];

  const resolvePackage = (packageInfo: LoadedOverlayThemePackage, stack: string[] = []): LoadedOverlayThemePackage => {
    const cached = resolvedCache.get(packageInfo.id);
    if (cached) {
      return cached;
    }

    if (stack.includes(packageInfo.id)) {
      const circularTheme = normalizeThemeDefinition({
        id: packageInfo.id,
        name: packageInfo.name,
        description: packageInfo.description,
        source: 'package',
      }, overlayThemePresets[0]);
      const circularPackage = cloneThemePackageWithResolution(
        packageInfo,
        circularTheme,
        [...packageInfo.warnings, `Circular theme bundle extends chain: ${[...stack, packageInfo.id].join(' -> ')}`],
      );
      resolvedCache.set(packageInfo.id, circularPackage);
      return circularPackage;
    }

    const resolutionWarnings = [...packageInfo.warnings];
    const manifest = packageInfo.manifest ?? createThemeBundleManifestFromThemeDefinition(packageInfo.theme);
    const packageLocalCatalogs = packageInfo.localCatalogs ?? emptyLocalCatalogs();

    let fallbackTheme = overlayThemePresets[0];
    const extendsId = asString(manifest.extends);
    if (extendsId) {
      const extendedPackage = packageLookup.get(extendsId);
      if (extendedPackage) {
        fallbackTheme = resolvePackage(extendedPackage, [...stack, packageInfo.id]).theme;
      } else {
        fallbackTheme = overlayThemePresets.find(theme => theme.id === extendsId) ?? overlayThemePresets[0];
      }
    }

    const themeEnginePack = resolveReferencedCatalogValue(
      manifest.themeEngineId,
      packageLocalCatalogs.themeEnginePacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      themeEngineEntries,
    );
    if (manifest.themeEngineId && !themeEnginePack) {
      resolutionWarnings.push(`Theme engine "${manifest.themeEngineId}" was not found.`);
    }

    const effectiveAppearancePackId = themeEnginePack?.composition.appearancePackId ?? manifest.appearancePackId;
    const effectiveThemeRecipeId = themeEnginePack?.composition.themeRecipeId ?? manifest.themeRecipeId;
    const effectiveInteractionMotionPackId = themeEnginePack?.composition.interactionMotionPackId ?? manifest.interactionMotionPackId;

    const appearancePack = resolveReferencedCatalogValue(
      effectiveAppearancePackId,
      packageLocalCatalogs.appearancePacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      appearanceEntries,
    );
    const appearanceFallbackThemeId = appearancePack?.appearance.extendsThemeId;
    const appearanceFallbackTheme = appearanceFallbackThemeId
      ? (overlayThemePresets.find(theme => theme.id === appearanceFallbackThemeId) ?? fallbackTheme)
      : fallbackTheme;

    if (effectiveAppearancePackId && !appearancePack) {
      resolutionWarnings.push(`Appearance pack "${effectiveAppearancePackId}" was not found.`);
    }

    const themeRecipePack = resolveReferencedCatalogValue(
      effectiveThemeRecipeId,
      packageLocalCatalogs.themeRecipePacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      themeRecipeEntries,
    );
    if (effectiveThemeRecipeId && !themeRecipePack) {
      resolutionWarnings.push(`Theme recipe "${effectiveThemeRecipeId}" was not found.`);
    }

    const interactionMotionPack = resolveReferencedCatalogValue(
      effectiveInteractionMotionPackId,
      packageLocalCatalogs.interactionMotionPacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      interactionMotionEntries,
    );
    if (effectiveInteractionMotionPackId && !interactionMotionPack) {
      resolutionWarnings.push(`Interaction motion pack "${effectiveInteractionMotionPackId}" was not found.`);
    }

    const shellRendererPack = resolveReferencedCatalogValue(
      manifest.rendererId,
      packageLocalCatalogs.shellRenderers.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      shellRendererEntries,
    );
    if (manifest.rendererId && !shellRendererPack) {
      resolutionWarnings.push(`Shell renderer "${manifest.rendererId}" was not found.`);
    }

    const soundPack = resolveReferencedCatalogValue(
      manifest.soundPackId,
      packageLocalCatalogs.soundPacks.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      soundPackEntries,
    );
    if (manifest.soundPackId && !soundPack) {
      resolutionWarnings.push(`Sound pack "${manifest.soundPackId}" was not found.`);
    }

    const iconThemePackage = resolveReferencedCatalogValue(
      manifest.iconThemeId,
      packageLocalCatalogs.iconThemePackages.map(pack => buildLocalCatalogEntry(pack, pack.localId)),
      iconThemeEntries,
    );
    if (manifest.iconThemeId && !iconThemePackage) {
      resolutionWarnings.push(`Icon theme "${manifest.iconThemeId}" was not found.`);
    }

    const wallpaper = resolveReferencedCatalogValue(
      manifest.wallpaperId,
      packageLocalCatalogs.wallpapers.map(entry => buildLocalCatalogEntry(entry, entry.localId)),
      wallpaperEntries,
    );
    if (manifest.wallpaperId && !wallpaper) {
      resolutionWarnings.push(`Wallpaper "${manifest.wallpaperId}" was not found.`);
    }

    const resolvedDefaultTopBarId = qualifyThemeTopBarSelectionId(
      manifest.topBarId,
      packageInfo.id,
      packageInfo.topBars ?? [],
    ) ?? (manifest.topBarId || fallbackTheme.defaultTopBarId);
    const resolvedUiTokens = mergeUiTokenCollections(
      appearancePack?.tokens,
      interactionMotionPack?.tokens,
    );
    const tokenCssVars = createUiTokenCssVars(resolvedUiTokens);
    const composedEngineManifest = themeEnginePack
      ? normalizeThemeManifestDraft({
          ...themeEnginePack.engineManifest,
          id: themeEnginePack.engineManifest.id,
          name: themeEnginePack.engineManifest.name,
          presentation: themeRecipePack?.recipe.presentation ?? themeEnginePack.engineManifest.presentation,
          compatibility: {
            shellBlueprints: themeRecipePack?.recipe.compatibility?.shellBlueprints
              ?? themeEnginePack.engineManifest.compatibility.shellBlueprints,
            tags: themeRecipePack?.recipe.compatibility?.tags
              ?? themeEnginePack.engineManifest.compatibility.tags,
          },
          designTokens: [
            ...themeEnginePack.engineManifest.designTokens,
            ...flattenUiTokenCollectionToDesignTokens(resolvedUiTokens, {
              idPrefix: themeEnginePack.localId,
              namePrefix: themeEnginePack.name,
            }),
          ],
          layoutPrimitives: themeRecipePack?.recipe.layoutPrimitives ?? themeEnginePack.engineManifest.layoutPrimitives,
          navigationPatterns: themeRecipePack?.recipe.navigationPatterns ?? themeEnginePack.engineManifest.navigationPatterns,
          animationProfiles: themeRecipePack?.recipe.animationProfiles ?? themeEnginePack.engineManifest.animationProfiles,
          iconPacks: themeRecipePack?.recipe.iconPacks ?? themeEnginePack.engineManifest.iconPacks,
          renderStyles: themeRecipePack?.recipe.renderStyles ?? themeEnginePack.engineManifest.renderStyles,
          defaultLayoutPrimitiveId: themeRecipePack?.recipe.defaultLayoutPrimitiveId
            ?? themeEnginePack.engineManifest.defaultLayoutPrimitiveId,
          defaultNavigationPatternId: themeRecipePack?.recipe.defaultNavigationPatternId
            ?? themeEnginePack.engineManifest.defaultNavigationPatternId,
          defaultAnimationProfileId: themeRecipePack?.recipe.defaultAnimationProfileId
            ?? themeEnginePack.engineManifest.defaultAnimationProfileId,
          defaultIconPackId: themeRecipePack?.recipe.defaultIconPackId
            ?? themeEnginePack.engineManifest.defaultIconPackId,
          defaultRenderStyleId: themeRecipePack?.recipe.defaultRenderStyleId
            ?? themeEnginePack.engineManifest.defaultRenderStyleId,
        })
      : packageInfo.theme.engineManifest;
    const composedCompiledEngineManifest = composedEngineManifest
      ? compileThemeEngineManifest(composedEngineManifest)
      : packageInfo.theme.compiledEngineManifest;

    const themePatch = {
      id: packageInfo.id,
      name: packageInfo.name,
      description: packageInfo.description,
      source: 'package',
      extendsThemeId: appearancePack?.appearance.extendsThemeId ?? (extendsId || fallbackTheme.id),
      palette: appearancePack?.appearance.palette ?? packageInfo.theme.palette,
      effects: appearancePack?.appearance.effects ?? packageInfo.theme.effects,
      scrollbar: appearancePack?.appearance.scrollbar ?? packageInfo.theme.scrollbar,
      xterm: appearancePack?.appearance.xterm ?? packageInfo.theme.xterm,
      fonts: appearancePack?.appearance.fonts ?? packageInfo.theme.fonts,
      visuals: appearancePack?.appearance.visuals ?? packageInfo.theme.visuals,
      cssVars: {
        ...(packageInfo.theme.cssVars ?? {}),
        ...tokenCssVars,
        ...(appearancePack?.appearance.cssVars ?? {}),
      },
      defaultTopBarId: resolvedDefaultTopBarId,
      defaultExplorerLayoutId: resolveScopedSelectionId(
        manifest.explorerLayoutId,
        packageLocalCatalogs.explorerLayouts,
      ),
      defaultHomePackId: resolveScopedSelectionId(manifest.homePackId, packageLocalCatalogs.homePacks),
      defaultMenuPackId: resolveScopedSelectionId(manifest.menuPackId, packageLocalCatalogs.menuPacks),
      defaultSoundPackId: resolveScopedSelectionId(manifest.soundPackId, packageLocalCatalogs.soundPacks)
        ?? soundPack?.id,
      defaultShaderId: resolveScopedSelectionId(manifest.shaderId, packageLocalCatalogs.shaders),
      defaultOpenAnimationId: resolveScopedSelectionId(manifest.openAnimationId, packageLocalCatalogs.animations),
      defaultCloseAnimationId: resolveScopedSelectionId(manifest.closeAnimationId, packageLocalCatalogs.animations),
      interactionMotion: interactionMotionPack?.interactionMotion ?? packageInfo.theme.interactionMotion,
      workbench: themeRecipePack?.recipe.workbench ?? packageInfo.theme.workbench,
      explorer: themeRecipePack?.recipe.explorer ?? packageInfo.theme.explorer,
      mobile: themeRecipePack?.recipe.mobile ?? packageInfo.theme.mobile,
      dock: themeRecipePack?.recipe.dock ?? packageInfo.theme.dock,
      presentation: composedEngineManifest?.presentation ?? packageInfo.theme.presentation,
      compatibility: composedEngineManifest?.compatibility ?? packageInfo.theme.compatibility,
      engineManifest: composedEngineManifest,
      compiledEngineManifest: composedCompiledEngineManifest,
      themeRenderer: shellRendererPack?.renderer ?? packageInfo.theme.themeRenderer,
    } as Partial<OverlayThemeDefinition>;

    const nextTheme = normalizeThemeDefinition(themePatch, appearanceFallbackTheme);

    nextTheme.assets = {
      ...(nextTheme.assets ?? {}),
      backgroundUrl: wallpaper?.assetUrl ?? nextTheme.assets?.backgroundUrl,
      previewUrl: packageInfo.previewUrl
        ?? appearancePack?.previewUrl
        ?? wallpaper?.previewUrl
        ?? nextTheme.assets?.previewUrl,
      iconTheme: iconThemePackage?.iconTheme ?? nextTheme.assets?.iconTheme,
      iconEntries: iconThemePackage?.iconTheme.iconDefinitions ?? nextTheme.assets?.iconEntries,
    };

    const resolvedPackage = cloneThemePackageWithResolution(packageInfo, nextTheme, resolutionWarnings);
    resolvedCache.set(packageInfo.id, resolvedPackage);
    return resolvedPackage;
  };

  return packages
    .map(pkg => resolvePackage(pkg))
    .sort(compareThemeCatalogPackages);
}

async function loadChildWallpapers(
  directoryEntries: FileEntry[],
  bundleId: string,
): Promise<LoadedThemeBundleLocalWallpaper[]> {
  const wallpapers = await Promise.all(
    directoryEntries
      .filter(entry => isFrontendWallpaperFile(entry) || isMediaWallpaperFile(entry))
      .map(async entry => {
        if (isMediaWallpaperFile(entry)) {
          return scopeWallpaperToBundle(bundleId, await createMediaWallpaperFromFile(entry));
        }

        const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
        const wallpaper = await loadWallpaperFromSource(source, entry);
        return scopeWallpaperToBundle(bundleId, wallpaper);
      }),
  );

  return wallpapers.sort((left, right) => left.name.localeCompare(right.name));
}

async function loadChildAnimations(
  directoryEntries: FileEntry[],
  bundleId: string,
  bundleName: string,
): Promise<{ animations: LoadedOverlayAnimation[]; localIds: LoadedThemeBundleLocalId[]; warnings: string[] }> {
  const warnings: string[] = [];
  const localIds: LoadedThemeBundleLocalId[] = [];
  const loaded = (
    await Promise.all(directoryEntries.filter(isFrontendAnimationFile).map(async entry => {
      const localId = createLocalRuntimeId(bundleId, entry.name, 'animation');
      localIds.push(localId);
      try {
        const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
        return await loadAnimationFromSource(source, entry, {
          context: {
            id: localId.id,
            name: deriveAnimationName(`${bundleName} ${localId.localId}`),
            filePath: entry.path,
            animationRoot: getParentDirectoryPath(entry.path),
            source: 'folder',
          },
        });
      } catch (error) {
        warnings.push(`Animation ${entry.name}: ${String(error)}`);
        return null;
      }
    }))
  ).filter((entry): entry is LoadedOverlayAnimation => Boolean(entry));

  return { animations: loaded, localIds, warnings };
}

async function loadChildShaders(
  directoryEntries: FileEntry[],
  bundleId: string,
  bundleName: string,
): Promise<{ shaders: LoadedOverlayShader[]; localIds: LoadedThemeBundleLocalId[]; warnings: string[] }> {
  const warnings: string[] = [];
  const localIds: LoadedThemeBundleLocalId[] = [];
  const loaded = (
    await Promise.all(directoryEntries.filter(isFrontendShaderFile).map(async entry => {
      const localId = createLocalRuntimeId(bundleId, entry.name, 'shader');
      localIds.push(localId);
      try {
        const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
        return await loadShaderFromSource(source, entry, {
          context: {
            id: localId.id,
            name: deriveShaderName(`${bundleName} ${localId.localId}`),
            filePath: entry.path,
            shaderRoot: getParentDirectoryPath(entry.path),
            source: 'folder',
          },
        });
      } catch (error) {
        warnings.push(`Shader ${entry.name}: ${String(error)}`);
        return null;
      }
    }))
  ).filter((entry): entry is LoadedOverlayShader => Boolean(entry));

  return { shaders: loaded, localIds, warnings };
}

async function buildThemeBundlePackage(
  record: OverlayThemeBundleRecord,
  options?: ThemePackageLoadOptions,
): Promise<{ packageInfo: LoadedOverlayThemePackage; shaders: LoadedOverlayShader[]; animations: LoadedOverlayAnimation[]; warnings: string[] }> {
  const bundleId = deriveBundleId(record);
  const bundleName = deriveBundleName(record, bundleId);
  const localCatalogs = emptyLocalCatalogs();
  const packageWarnings: string[] = [];
  const themeContributedShaders: LoadedOverlayShader[] = [];
  const themeContributedAnimations: LoadedOverlayAnimation[] = [];

  const previewUrl = await resolveOptionalPreviewUrl(record.directoryPath, record.manifest.preview);
  const childEntries = await loadChildDirectoryEntries(record.directoryPath);
  const childDirectoryLookup = new Map(childEntries.filter(entry => entry.is_dir).map(entry => [entry.name, entry.path] as const));

  const loadEntries = async (directoryName: string): Promise<FileEntry[]> => {
    const childDirectoryPath = childDirectoryLookup.get(directoryName);
    if (!childDirectoryPath) {
      return [];
    }
    return loadChildDirectoryEntries(childDirectoryPath);
  };

  const [appearanceEntries, topBarEntries, explorerLayoutEntries, iconThemeEntries, wallpaperEntries, shaderEntries, animationEntries, interactionMotionEntries, soundPackEntries, shellRendererEntries, themeRecipeEntries, themeEngineEntries, homePackEntries, menuPackEntries] = await Promise.all([
    loadEntries(themeSystemConfig.childDirectoryNames.appearancePacks),
    loadEntries(themeSystemConfig.childDirectoryNames.topBars),
    loadEntries(themeSystemConfig.childDirectoryNames.explorerLayouts),
    loadEntries(themeSystemConfig.childDirectoryNames.iconThemes),
    loadEntries(themeSystemConfig.childDirectoryNames.wallpapers),
    loadEntries(themeSystemConfig.childDirectoryNames.shaders),
    loadEntries(themeSystemConfig.childDirectoryNames.animations),
    loadEntries(themeSystemConfig.childDirectoryNames.interactionMotion),
    loadEntries(themeSystemConfig.childDirectoryNames.soundPacks),
    loadEntries(themeSystemConfig.childDirectoryNames.shellRenderers),
    loadEntries(themeSystemConfig.childDirectoryNames.themeRecipes),
    loadEntries(themeSystemConfig.childDirectoryNames.themeEngines),
    loadEntries(themeSystemConfig.childDirectoryNames.homePacks),
    loadEntries(themeSystemConfig.childDirectoryNames.menuPacks),
  ]);

  const [
    appearanceResult,
    topBarPackageResult,
    explorerLayoutPackageResult,
    iconThemePackageResult,
    interactionMotionResult,
    soundPackResult,
    shellRendererResult,
    themeRecipeResult,
    themeEngineResult,
    homePackResult,
    menuPackResult,
    childWallpaperResult,
    childShaderResult,
    childAnimationResult,
  ] = await Promise.all([
    loadThemeAppearancePacksFromDirectoryEntries(appearanceEntries, {
      scopeId: bundleId,
      virtualRoot: record.directoryPath,
    }),
    loadTopBarPackagesFromDirectoryEntries(topBarEntries, record.directoryPath),
    loadExplorerLayoutPackagesFromDirectoryEntries(explorerLayoutEntries, record.directoryPath),
    loadIconThemePackagesFromDirectoryEntries(iconThemeEntries, record.directoryPath),
    loadThemeInteractionMotionPacksFromDirectoryEntries(interactionMotionEntries, {
      scopeId: bundleId,
      virtualRoot: record.directoryPath,
    }),
    loadSoundPacksFromDirectoryEntries(soundPackEntries, record.directoryPath, {
      includeBuiltIns: false,
      scopeId: bundleId,
      sourceKind: 'sound-pack-directory',
      sourceLabel: bundleName,
    }),
    loadThemeShellRendererPacksFromDirectoryEntries(shellRendererEntries, {
      scopeId: bundleId,
      virtualRoot: record.directoryPath,
    }),
    loadThemeRecipePacksFromDirectoryEntries(themeRecipeEntries, {
      scopeId: bundleId,
      virtualRoot: record.directoryPath,
    }),
    loadThemeEnginePacksFromDirectoryEntries(themeEngineEntries, {
      scopeId: bundleId,
      virtualRoot: record.directoryPath,
    }),
    loadExplorerHomePacksFromDirectoryEntries(homePackEntries, record.directoryPath),
    loadExplorerMenuPacksFromDirectoryEntries(menuPackEntries, record.directoryPath),
    loadChildWallpapers(wallpaperEntries, bundleId),
    loadChildShaders(shaderEntries, bundleId, bundleName),
    loadChildAnimations(animationEntries, bundleId, bundleName),
  ]);

  localCatalogs.appearancePacks.push(...appearanceResult.packs);
  localCatalogs.interactionMotionPacks.push(...interactionMotionResult.packs);
  localCatalogs.soundPacks.push(...soundPackResult.packs);
  localCatalogs.shellRenderers.push(...shellRendererResult.packs);
  localCatalogs.themeRecipePacks.push(...themeRecipeResult.packs);
  localCatalogs.themeEnginePacks.push(...themeEngineResult.packs);
  localCatalogs.iconThemePackages.push(
    ...iconThemePackageResult.packages
      .filter(pkg => pkg.sourceKind !== 'built-in')
      .map(pkg => scopeIconThemePackageToBundle(bundleId, pkg)),
  );
  localCatalogs.wallpapers.push(...childWallpaperResult);
  localCatalogs.homePacks.push(...homePackResult.packs.map(pack => scopeHomePackToBundle(bundleId, pack)));
  localCatalogs.menuPacks.push(...menuPackResult.packs.map(pack => scopeMenuPackToBundle(bundleId, pack)));
  localCatalogs.explorerLayouts.push(
    ...explorerLayoutPackageResult.packages
      .flatMap(pkg => pkg.layouts)
      .map(layout => scopeExplorerLayoutToBundle(bundleId, bundleName, layout)),
  );
  localCatalogs.shaders.push(...childShaderResult.localIds);
  localCatalogs.animations.push(...childAnimationResult.localIds);

  themeContributedShaders.push(...childShaderResult.shaders);
  themeContributedAnimations.push(...childAnimationResult.animations);

  packageWarnings.push(
    ...appearanceResult.warnings,
    ...interactionMotionResult.warnings,
    ...soundPackResult.warnings,
    ...shellRendererResult.warnings,
    ...themeRecipeResult.warnings,
    ...themeEngineResult.warnings,
    ...topBarPackageResult.warnings,
    ...explorerLayoutPackageResult.warnings,
    ...iconThemePackageResult.warnings,
    ...homePackResult.warnings,
    ...menuPackResult.warnings,
    ...childShaderResult.warnings,
    ...childAnimationResult.warnings,
  );

  const embedded = record.manifest.embedded;
  for (const appearancePack of embedded?.appearancePacks ?? []) {
    localCatalogs.appearancePacks.push(createInlineThemeAppearancePack(appearancePack, { bundleId, directoryPath: record.directoryPath }));
  }
  for (const interactionMotionPack of embedded?.interactionMotionPacks ?? []) {
    localCatalogs.interactionMotionPacks.push(createInlineThemeInteractionMotionPack(interactionMotionPack, { bundleId, directoryPath: record.directoryPath }));
  }
  for (const themeRecipe of embedded?.themeRecipes ?? []) {
    localCatalogs.themeRecipePacks.push(createInlineThemeRecipePack(themeRecipe, { bundleId, directoryPath: record.directoryPath }));
  }
  for (const themeEngine of embedded?.themeEngines ?? []) {
    localCatalogs.themeEnginePacks.push(createInlineThemeEnginePack(themeEngine, { bundleId, directoryPath: record.directoryPath }));
  }

  const topBars = scopeTopBarsToBundle(
    bundleId,
    bundleName,
    topBarPackageResult.packages.flatMap(pkg => pkg.topBars),
  );

  const rawPackage: LoadedOverlayThemePackage = {
    id: bundleId,
    name: bundleName,
    version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
    directoryPath: record.directoryPath,
    manifestPath: record.manifestPath,
    sourceKind: options?.sourceKind ?? 'theme-directory',
    sourceLabel: options?.sourceLabel ?? record.directoryPath,
    sourceInfo: {
      compatibility: 'native',
      source: options?.sourceKind === 'plugin-package' ? 'plugin' : 'folder',
      originalPath: record.directoryPath,
      resolvedRootPath: record.directoryPath,
    },
    description: asString(record.manifest.description) || undefined,
    author: asString(record.manifest.author) || undefined,
    homepage: asString(record.manifest.homepage) || undefined,
    tags: record.manifest.tags ?? [],
    previewUrl,
    warnings: packageWarnings,
    catalog: resolveThemeCatalogPackageMetadata(bundleId),
    capabilitySummary: {
      icons: localCatalogs.iconThemePackages.length > 0 || Boolean(record.manifest.iconThemeId),
      wallpaper: localCatalogs.wallpapers.length > 0 || Boolean(record.manifest.wallpaperId),
      dock: localCatalogs.themeRecipePacks.some(pack => Boolean(pack.recipe.dock)),
      visuals: localCatalogs.appearancePacks.reduce((total, pack) => total + (pack.appearance.visuals?.length ?? 0), 0),
      shaders: localCatalogs.shaders.length,
      animations: localCatalogs.animations.length,
      fonts: localCatalogs.appearancePacks.reduce((total, pack) => total + ([pack.appearance.fonts?.ui, pack.appearance.fonts?.mono].filter(Boolean).length), 0),
      themeRenderer: localCatalogs.shellRenderers.length > 0 || Boolean(record.manifest.rendererId),
      topBars: topBars.length,
    },
    manifest: record.manifest,
    localCatalogs,
    theme: normalizeThemeDefinition({
      id: bundleId,
      name: bundleName,
      description: asString(record.manifest.description),
      source: 'package',
    }),
    topBars,
  };

  return {
    packageInfo: rawPackage,
    shaders: themeContributedShaders,
    animations: themeContributedAnimations,
    warnings: packageWarnings.map(warning => `${bundleName}: ${warning}`),
  };
}

function createVsCodeThemePackage(
  contribution: LoadedVsCodeColorThemeContribution,
): { packageInfo: LoadedOverlayThemePackage; warnings: string[] } {
  const bundleId = contribution.id;
  const bundleName = contribution.name;
  const localCatalogs = emptyLocalCatalogs();

  localCatalogs.iconThemePackages.push(
    ...contribution.localIconThemes.map(iconThemePackage => {
      const localId = normalizeIdFragment(iconThemePackage.id, 'icon-theme');
      const scopedId = createScopedId(bundleId, localId);
      const sourceKind: LoadedThemeBundleLocalIconTheme['sourceKind'] =
        iconThemePackage.sourceInfo.source === 'vsix'
          ? 'vscode-icon-theme-vsix'
          : 'vscode-icon-theme-directory';
      return {
        id: scopedId,
        localId,
        name: iconThemePackage.name,
        version: iconThemePackage.version,
        description: iconThemePackage.description,
        directoryPath: iconThemePackage.directoryPath,
        manifestPath: iconThemePackage.manifestPath,
        sourceKind,
        sourceInfo: iconThemePackage.sourceInfo,
        warnings: iconThemePackage.warnings,
        iconTheme: {
          ...iconThemePackage.iconTheme,
          id: scopedId,
        },
        capabilitySummary: buildIconThemeCapabilitySummary(iconThemePackage.iconTheme),
      };
    }),
  );

  const packageWarnings = [
    ...contribution.warnings,
    ...contribution.localIconThemes.flatMap(iconThemePackage =>
      iconThemePackage.warnings.map(warning => `${iconThemePackage.name}: ${warning}`),
    ),
  ];
  const sourceKind = contribution.sourceInfo.source === 'vsix'
    ? 'vscode-theme-vsix'
    : 'vscode-theme-directory';
  const rawPackage: LoadedOverlayThemePackage = {
    id: bundleId,
    name: bundleName,
    version: contribution.version,
    directoryPath: contribution.directoryPath,
    manifestPath: contribution.manifestPath,
    sourceKind,
    sourceLabel: contribution.sourceInfo.source === 'vsix'
      ? `VS Code .vsix · ${contribution.directoryPath}`
      : `VS Code Extension Folder · ${contribution.directoryPath}`,
    sourceInfo: contribution.sourceInfo,
    description: contribution.description,
    author: contribution.sourceInfo.extensionId,
    homepage: undefined,
    tags: ['vscode-compatibility'],
    previewUrl: undefined,
    warnings: packageWarnings,
    catalog: resolveThemeCatalogPackageMetadata(bundleId),
    capabilitySummary: {
      icons: localCatalogs.iconThemePackages.length > 0,
      wallpaper: false,
      dock: false,
      visuals: contribution.theme.visuals?.length ?? 0,
      shaders: 0,
      animations: 0,
      fonts: [contribution.theme.fonts?.ui, contribution.theme.fonts?.mono].filter(Boolean).length,
      themeRenderer: false,
      topBars: 0,
    },
    manifest: createThemeBundleManifestFromThemeDefinition(contribution.theme),
    localCatalogs,
    theme: contribution.theme,
    topBars: [],
  };

  return {
    packageInfo: rawPackage,
    warnings: packageWarnings.map(warning => `${bundleName}: ${warning}`),
  };
}

export async function loadGlobalThemeBundleCatalogs(): Promise<GlobalThemeBundleCatalogs> {
  const [appearanceResult, interactionMotionResult, soundPackResult, shellRendererResult, themeRecipeResult, themeEngineResult] = await Promise.all([
    loadThemeAppearancePacks(),
    loadThemeInteractionMotionPacks(),
    loadSoundPacks(),
    loadThemeShellRendererPacks(),
    loadThemeRecipePacks(),
    loadThemeEnginePacks(),
  ]);

  return {
    appearancePacks: appearanceResult.packs,
    interactionMotionPacks: interactionMotionResult.packs,
    soundPacks: soundPackResult.packs,
    shellRenderers: shellRendererResult.packs,
    themeRecipePacks: themeRecipeResult.packs,
    themeEnginePacks: themeEngineResult.packs,
    warnings: [
      ...appearanceResult.warnings,
      ...interactionMotionResult.warnings,
      ...soundPackResult.warnings,
      ...shellRendererResult.warnings,
      ...themeRecipeResult.warnings,
      ...themeEngineResult.warnings,
    ],
  };
}

export async function loadThemePackagesFromDirectoryEntries(
  directoryEntries: ThemePackageDirectoryEntry[],
  directoryLabel = themeSystemConfig.themesDirectory,
  options?: ThemePackageLoadOptions,
): Promise<ThemePackageLoadResult> {
  try {
    const bundleRecords: OverlayThemeBundleRecord[] = [];
    const manifestWarnings: string[] = [];
    const compatibilityPackages: LoadedOverlayThemePackage[] = [];
    const compatibilityWarnings: string[] = [];
    for (const entry of directoryEntries) {
      const normalizedEntry = normalizeThemePackageDirectoryEntry(entry);
      try {
        if (!normalizedEntry.isDirectory) {
          const compatibilityResult = await loadVsCodeColorThemeContributionsFromEntry({
            name: normalizedEntry.name,
            path: normalizedEntry.path,
            isDirectory: false,
            extension: normalizedEntry.extension,
          });
          compatibilityWarnings.push(
            ...compatibilityResult.warnings.map(warning => `${normalizedEntry.name}: ${warning}`),
          );
          compatibilityPackages.push(
            ...compatibilityResult.packages.map(result => createVsCodeThemePackage(result).packageInfo),
          );
          continue;
        }

        const manifest = await readBundleManifest(normalizedEntry.path);
        if (manifest) {
          bundleRecords.push({
            directoryName: normalizedEntry.name,
            directoryPath: normalizedEntry.path,
            manifestPath: manifest.manifestPath,
            manifest: manifest.manifest,
          });
          continue;
        }

        const compatibilityResult = await loadVsCodeColorThemeContributionsFromEntry({
          name: normalizedEntry.name,
          path: normalizedEntry.path,
          isDirectory: true,
          extension: normalizedEntry.extension,
        });
        compatibilityWarnings.push(
          ...compatibilityResult.warnings.map(warning => `${normalizedEntry.name}: ${warning}`),
        );
        compatibilityPackages.push(
          ...compatibilityResult.packages.map(result => createVsCodeThemePackage(result).packageInfo),
        );
      } catch (error) {
        manifestWarnings.push(`${normalizedEntry.name}: ${String(error)}`);
      }
    }

    const builtPackages = await Promise.all(
      bundleRecords.map(record => buildThemeBundlePackage(record, options)),
    );
    const rawPackages = [
      ...builtPackages.map(result => result.packageInfo),
      ...compatibilityPackages,
    ];
    const dependencyCatalogs = options?.dependencyCatalogs ?? createEmptyGlobalThemeBundleCatalogs();
    const resolvedPackageMap = new Map(rawPackages.map(packageInfo => [packageInfo.id, packageInfo] as const));
    const resolvedPackages = resolveLoadedThemePackages(rawPackages, dependencyCatalogs).map(packageInfo => {
      const rawPackage = resolvedPackageMap.get(packageInfo.id);
      if (!rawPackage?.theme.assets) {
        return packageInfo;
      }
      return {
        ...packageInfo,
        theme: {
          ...packageInfo.theme,
          assets: mergeResolvedThemeAssets(packageInfo.theme.assets, rawPackage.theme.assets),
        },
      };
    });

    return {
      packages: resolvedPackages,
      shaders: builtPackages.flatMap(result => result.shaders).sort((left, right) => left.name.localeCompare(right.name)),
      animations: builtPackages.flatMap(result => result.animations).sort((left, right) => left.name.localeCompare(right.name)),
      directory: directoryLabel,
      warnings: [
        ...dependencyCatalogs.warnings,
        ...manifestWarnings,
        ...compatibilityWarnings,
        ...builtPackages.flatMap(result => result.warnings),
        ...compatibilityPackages.flatMap(packageInfo => packageInfo.warnings.map(warning => `${packageInfo.name}: ${warning}`)),
      ],
      sourceError: null,
      dependencyCatalogs,
    };
  } catch (error) {
    return {
      packages: [],
      shaders: [],
      animations: [],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
      dependencyCatalogs: createEmptyGlobalThemeBundleCatalogs(),
    };
  }
}

export async function loadThemePackages(): Promise<ThemePackageLoadResult> {
  const directory = themeSystemConfig.themesDirectory;
  if (!isTauri()) {
    return {
      packages: [],
      shaders: [],
      animations: [],
      directory,
      warnings: [],
      sourceError: null,
      dependencyCatalogs: createEmptyGlobalThemeBundleCatalogs(),
    };
  }

  try {
    const [rootEntries, dependencyCatalogs] = await Promise.all([
      listLocalDirectoryEntriesFast(directory),
      loadGlobalThemeBundleCatalogs(),
    ]);

    return loadThemePackagesFromDirectoryEntries(
      rootEntries.map(entry => ({
        name: entry.name,
        path: entry.path,
        isDirectory: entry.is_dir,
        extension: entry.extension,
        modified: entry.modified,
      })),
      directory,
      { dependencyCatalogs },
    );
  } catch (error) {
    return {
      packages: [],
      shaders: [],
      animations: [],
      directory,
      warnings: [],
      sourceError: String(error),
      dependencyCatalogs: createEmptyGlobalThemeBundleCatalogs(),
    };
  }
}

function detectLegacyThemeJsonShape(source: LooseRecord): boolean {
  return hasLegacyThemePackageFields(source)
    || 'palette' in source
    || 'effects' in source
    || 'xterm' in source
    || 'workbench' in source
    || 'explorer' in source
    || 'dock' in source;
}

export function parseImportedThemeBundle(source: string): OverlayThemeBundleManifest {
  const parsed = JSON.parse(source) as unknown;
  const candidate = asRecord(parsed);
  if (!candidate) {
    throw new Error('Theme bundle JSON must be an object.');
  }

  if (detectLegacyThemeJsonShape(candidate)) {
    throw new Error('Legacy monolithic theme JSON is unsupported. Import a theme bundle manifest instead.');
  }

  return parseThemeBundleManifestText(source, 'imported-theme-bundle.json');
}

export function serializeThemeBundle(bundle: OverlayThemeBundleManifest): string {
  return JSON.stringify(bundle, null, 2);
}

export function upsertCustomThemeBundle(
  bundles: OverlayThemeBundleManifest[],
  nextBundle: OverlayThemeBundleManifest,
): OverlayThemeBundleManifest[] {
  const normalizedId = asString(nextBundle.id);
  if (!normalizedId) {
    return [...bundles, nextBundle];
  }

  const nextIndex = bundles.findIndex(bundle => asString(bundle.id) === normalizedId);
  if (nextIndex === -1) {
    return [...bundles, nextBundle];
  }

  const updated = [...bundles];
  updated[nextIndex] = nextBundle;
  return updated;
}

export function createThemeBundleManifestFromThemeDefinition(
  theme: OverlayThemeDefinition,
): OverlayThemeBundleManifest {
  const appearancePackId = 'appearance-base';
  const themeRecipeId = (theme.workbench || theme.explorer || theme.dock) ? 'theme-recipe-base' : undefined;
  const interactionMotionPackId = theme.interactionMotion ? 'interaction-motion-base' : undefined;
  const themeEngineId = (theme.engineManifest || theme.presentation || theme.compatibility) ? 'theme-engine-base' : undefined;

  return {
    version: 1,
    id: theme.id,
    name: theme.name,
    description: theme.description,
    extends: theme.extendsThemeId,
    topBarId: theme.defaultTopBarId,
    explorerLayoutId: theme.defaultExplorerLayoutId,
    iconThemeId: theme.assets?.iconTheme?.id,
    shaderId: theme.defaultShaderId,
    openAnimationId: theme.defaultOpenAnimationId,
    closeAnimationId: theme.defaultCloseAnimationId,
    homePackId: theme.defaultHomePackId,
    menuPackId: theme.defaultMenuPackId,
    soundPackId: theme.defaultSoundPackId,
    appearancePackId,
    interactionMotionPackId,
    themeRecipeId,
    themeEngineId,
    embedded: {
      appearancePacks: [
        {
          id: appearancePackId,
          name: `${theme.name} Appearance`,
          extendsThemeId: theme.extendsThemeId,
          palette: theme.palette,
          effects: theme.effects,
          xterm: theme.xterm,
          fonts: theme.fonts,
          visuals: theme.visuals,
          cssVars: theme.cssVars,
        },
      ],
      interactionMotionPacks: interactionMotionPackId
        ? [{
            id: interactionMotionPackId,
            name: `${theme.name} Motion`,
            interactionMotion: theme.interactionMotion,
          }]
        : [],
      themeRecipes: themeRecipeId
        ? [{
            id: themeRecipeId,
            name: `${theme.name} Recipe`,
            workbench: theme.workbench,
            explorer: theme.explorer,
            dock: theme.dock,
          }]
        : [],
      themeEngines: themeEngineId
        ? [{
            id: themeEngineId,
            name: `${theme.name} Engine`,
            presentation: theme.presentation,
            compatibility: theme.compatibility,
            designTokens: theme.engineManifest?.designTokens,
            layoutPrimitives: theme.engineManifest?.layoutPrimitives,
            navigationPatterns: theme.engineManifest?.navigationPatterns,
            animationProfiles: theme.engineManifest?.animationProfiles,
            iconPacks: theme.engineManifest?.iconPacks,
            renderStyles: theme.engineManifest?.renderStyles,
            defaultLayoutPrimitiveId: theme.engineManifest?.defaultLayoutPrimitiveId ?? undefined,
            defaultNavigationPatternId: theme.engineManifest?.defaultNavigationPatternId ?? undefined,
            defaultAnimationProfileId: theme.engineManifest?.defaultAnimationProfileId ?? undefined,
            defaultIconPackId: theme.engineManifest?.defaultIconPackId ?? undefined,
            defaultRenderStyleId: theme.engineManifest?.defaultRenderStyleId ?? undefined,
          }]
        : [],
    },
  };
}

export function resolveThemeBundleManifests(
  manifests: OverlayThemeBundleManifest[],
  dependencies: ThemeBundleDependencyCatalogs = {},
): OverlayThemeDefinition[] {
  const packages = manifests.map((manifest, index) => {
    const bundleId = asString(manifest.id) || `custom-theme-bundle-${index + 1}`;
    const bundleName = asString(manifest.name) || bundleId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
    const localCatalogs = emptyLocalCatalogs();
    for (const appearancePack of manifest.embedded?.appearancePacks ?? []) {
      localCatalogs.appearancePacks.push(createInlineThemeAppearancePack(appearancePack, { bundleId }));
    }
    for (const interactionMotionPack of manifest.embedded?.interactionMotionPacks ?? []) {
      localCatalogs.interactionMotionPacks.push(createInlineThemeInteractionMotionPack(interactionMotionPack, { bundleId }));
    }
    for (const themeRecipePack of manifest.embedded?.themeRecipes ?? []) {
      localCatalogs.themeRecipePacks.push(createInlineThemeRecipePack(themeRecipePack, { bundleId }));
    }
    for (const themeEnginePack of manifest.embedded?.themeEngines ?? []) {
      localCatalogs.themeEnginePacks.push(createInlineThemeEnginePack(themeEnginePack, { bundleId }));
    }

    return {
      id: bundleId,
      name: bundleName,
      version: typeof manifest.version === 'number' ? manifest.version : 1,
      directoryPath: `settings:${bundleId}`,
      manifestPath: `settings:${bundleId}:theme.json`,
      sourceKind: 'theme-directory' as const,
      sourceLabel: 'Settings Theme JSON',
      description: manifest.description,
      author: manifest.author,
      homepage: manifest.homepage,
      tags: manifest.tags ?? [],
      previewUrl: undefined,
      warnings: [],
      catalog: resolveThemeCatalogPackageMetadata(bundleId),
      capabilitySummary: {
        icons: Boolean(manifest.iconThemeId),
        wallpaper: Boolean(manifest.wallpaperId),
        dock: localCatalogs.themeRecipePacks.some(pack => Boolean(pack.recipe.dock)),
        visuals: localCatalogs.appearancePacks.reduce((total, pack) => total + (pack.appearance.visuals?.length ?? 0), 0),
        shaders: 0,
        animations: 0,
        fonts: localCatalogs.appearancePacks.reduce((total, pack) => total + ([pack.appearance.fonts?.ui, pack.appearance.fonts?.mono].filter(Boolean).length), 0),
        themeRenderer: Boolean(manifest.rendererId),
        topBars: 0,
      },
      manifest,
      localCatalogs,
      theme: normalizeThemeDefinition({
        id: bundleId,
        name: bundleName,
        source: 'custom',
      }),
      topBars: [],
    } satisfies LoadedOverlayThemePackage;
  });

  return resolveLoadedThemePackages(packages, dependencies).map(pkg => ({
    ...pkg.theme,
    source: 'custom',
  }));
}
