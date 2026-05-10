import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import type {
  OverlayThemeCompatibility,
  OverlayThemeEffects,
  OverlayThemeFonts,
  OverlayThemePalette,
  OverlayThemePresentation,
  OverlayThemeScrollbar,
  OverlayThemeVisualLayer,
  OverlayXTermTheme,
} from './appearance';
import { getManagedContentDirectory } from './appContentDirectories';
import type { LoadedOverlayThemeRenderer } from '../components/themeRendererRuntime';
import {
  loadThemeRendererFromSource,
  type OverlayThemeRendererCapabilities,
} from '../components/themeRendererRuntime';
import {
  compileThemeEngineManifest,
  normalizeThemeManifestDraft,
  type CompiledThemeEngineManifest,
  type ExplorerThemeManifest,
} from '../runtime/themeEngineBackend';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import { listLocalDirectoryEntriesFast } from '../runtime/localDirectoryListing';
import type { OverlayInteractionMotionThemeRecipe } from './interactionMotion';
import type { OverlayExplorerThemeRecipe } from './explorerTheme';
import type { OverlayWorkbenchThemeRecipe } from './workbenchTheme';
import type { OverlayMobileThemeRecipe } from './mobileTheme';
import type { RuntimeRelativeModuleSourceResolver } from '../runtime/moduleRuntime';
import type { WorkbenchRenderRuntimeKind } from './workbenchRenderRuntime';
import {
  UI_TOKEN_CATEGORIES,
  mergeUiTokenCollections,
  normalizeUiTokenCategoryMap,
  normalizeUiTokenCollection,
  type UiTokenCategory,
  type UiTokenCollection,
} from './uiTokenContract';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

const themeBundleRuntimeModuleExtensions = ['ts', 'tsx', 'js', 'jsx'] as const;

export interface ThemeBundlePackMetadata {
  id: string;
  localId: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
}

export interface ThemeAppearancePackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  extendsThemeId?: string;
  palette?: Partial<OverlayThemePalette>;
  effects?: Partial<OverlayThemeEffects>;
  scrollbar?: OverlayThemeScrollbar;
  xterm?: Partial<OverlayXTermTheme>;
  fonts?: OverlayThemeFonts;
  visuals?: OverlayThemeVisualLayer[];
  cssVars?: Record<string, string>;
  tokens?: UiTokenCollection;
  preview?: string;
}

export interface LoadedThemeAppearancePack extends ThemeBundlePackMetadata {
  appearance: ThemeAppearancePackManifest;
  tokens?: UiTokenCollection;
  previewUrl?: string;
}

export interface ThemeInteractionMotionPackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  interactionMotion?: OverlayInteractionMotionThemeRecipe;
  tokens?: UiTokenCollection;
}

export interface LoadedThemeInteractionMotionPack extends ThemeBundlePackMetadata {
  interactionMotion?: OverlayInteractionMotionThemeRecipe;
  tokens?: UiTokenCollection;
}

export interface ThemeRecipePackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  presentation?: OverlayThemePresentation;
  compatibility?: OverlayThemeCompatibility;
  layoutPrimitives?: ExplorerThemeManifest['layoutPrimitives'];
  navigationPatterns?: ExplorerThemeManifest['navigationPatterns'];
  animationProfiles?: ExplorerThemeManifest['animationProfiles'];
  iconPacks?: ExplorerThemeManifest['iconPacks'];
  renderStyles?: ExplorerThemeManifest['renderStyles'];
  defaultLayoutPrimitiveId?: string;
  defaultNavigationPatternId?: string;
  defaultAnimationProfileId?: string;
  defaultIconPackId?: string;
  defaultRenderStyleId?: string;
  workbench?: OverlayWorkbenchThemeRecipe;
  explorer?: OverlayExplorerThemeRecipe;
  mobile?: OverlayMobileThemeRecipe;
  dock?: {
    workbench?: OverlayWorkbenchThemeRecipe;
    explorer?: OverlayExplorerThemeRecipe;
  };
}

export interface LoadedThemeRecipePack extends ThemeBundlePackMetadata {
  recipe: Pick<
    ThemeRecipePackManifest,
    | 'presentation'
    | 'compatibility'
    | 'layoutPrimitives'
    | 'navigationPatterns'
    | 'animationProfiles'
    | 'iconPacks'
    | 'renderStyles'
    | 'defaultLayoutPrimitiveId'
    | 'defaultNavigationPatternId'
    | 'defaultAnimationProfileId'
    | 'defaultIconPackId'
    | 'defaultRenderStyleId'
    | 'workbench'
    | 'explorer'
    | 'mobile'
    | 'dock'
  >;
}

export interface ThemeEnginePackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  extends?: string;
  appearancePackId?: string;
  interactionMotionPackId?: string;
  themeRecipeId?: string;
  presentation?: OverlayThemePresentation;
  compatibility?: OverlayThemeCompatibility;
  designTokens?: ExplorerThemeManifest['designTokens'];
  layoutPrimitives?: ExplorerThemeManifest['layoutPrimitives'];
  navigationPatterns?: ExplorerThemeManifest['navigationPatterns'];
  animationProfiles?: ExplorerThemeManifest['animationProfiles'];
  iconPacks?: ExplorerThemeManifest['iconPacks'];
  renderStyles?: ExplorerThemeManifest['renderStyles'];
  defaultLayoutPrimitiveId?: string;
  defaultNavigationPatternId?: string;
  defaultAnimationProfileId?: string;
  defaultIconPackId?: string;
  defaultRenderStyleId?: string;
}

export interface LoadedThemeEnginePack extends ThemeBundlePackMetadata {
  composition: {
    appearancePackId?: string;
    interactionMotionPackId?: string;
    themeRecipeId?: string;
  };
  engineManifest: ExplorerThemeManifest;
  compiledEngineManifest: CompiledThemeEngineManifest;
}

export interface ThemeShellRendererPackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  entryModule?: string;
  apiVersion?: number;
  supportsLiveSwap?: boolean;
  fallbackRuntime?: WorkbenchRenderRuntimeKind;
  capabilities?: Partial<OverlayThemeRendererCapabilities>;
}

export interface LoadedThemeShellRendererPack extends ThemeBundlePackMetadata {
  entryModule: string;
  renderer?: LoadedOverlayThemeRenderer;
}

interface ThemeBundlePackOptions {
  scopeId?: string;
  virtualRoot?: string;
  sourceLabel?: string;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
}

interface ThemeBundlePackLoadResult<T> {
  packs: T[];
  warnings: string[];
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

function asStringRecord(value: unknown): Record<string, string> {
  const source = asRecord(value);
  if (!source) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source)
      .filter(([, entry]) => typeof entry === 'string' && entry.trim().length > 0)
      .map(([key, entry]) => [key, String(entry).trim()]),
  );
}

function normalizePackIdFragment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function createScopedPackId(scopeId: string | undefined, localId: string): string {
  const normalizedLocalId = normalizePackIdFragment(localId, 'theme-pack');
  if (!scopeId) {
    return normalizedLocalId;
  }

  return `${normalizePackIdFragment(scopeId, 'theme-bundle')}:${normalizedLocalId}`;
}

function deriveDisplayName(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function normalizePathAsset(path: string): string {
  return path.trim().replace(/^\.(?:\/|\\)/, '');
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

async function resolvePreviewUrl(directoryPath: string, previewPath?: string): Promise<string | undefined> {
  const trimmedPath = previewPath?.trim();
  if (!trimmedPath) {
    return undefined;
  }

  return toAssetUrl(joinPlatformPath(directoryPath, normalizePathAsset(trimmedPath)));
}

function buildPackMetadata<TManifest extends {
  id?: string;
  name?: string;
  version?: number;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
}>(manifest: TManifest, manifestPath: string, directoryPath: string, options?: ThemeBundlePackOptions): ThemeBundlePackMetadata {
  const localId = normalizePackIdFragment(manifest.id ?? manifest.name, 'theme-pack');
  const id = createScopedPackId(options?.scopeId, localId);
  return {
    id,
    localId,
    name: asString(manifest.name) || deriveDisplayName(localId),
    version: typeof manifest.version === 'number' ? manifest.version : 1,
    directoryPath: options?.virtualRoot ?? directoryPath,
    manifestPath,
    description: asString(manifest.description) || undefined,
    author: asString(manifest.author) || undefined,
    homepage: asString(manifest.homepage) || undefined,
    tags: asStringArray(manifest.tags),
    warnings: [],
  };
}

function parseManifestText(text: string, filePath: string): LooseRecord {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Manifest must be an object: ${filePath}`);
  }
  return source;
}

async function readOptionalLooseRecord(filePath: string): Promise<LooseRecord | null> {
  try {
    const text = await commands.fsReadTextFile(filePath).then(unwrapTauriResult);
    return parseManifestText(text, filePath);
  } catch (error) {
    const message = String(error).toLowerCase();
    if (
      message.includes('enoent')
      || message.includes('not found')
      || message.includes('no such file')
      || message.includes('cannot find the file specified')
      || message.includes('os error 2')
    ) {
      return null;
    }
    throw error;
  }
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }
  return normalized.slice(0, lastSlash);
}

function normalizeThemeBundleRuntimeModulePath(path: string): string | null {
  const normalizedPath = path.trim().replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath.startsWith('/') || /^[A-Za-z]:\//.test(normalizedPath)) {
    return null;
  }

  const segments: string[] = [];
  for (const segment of normalizedPath.split('/')) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (segments.length === 0) {
        return null;
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join('/');
}

function normalizeThemeBundleComparisonPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/g, '');
}

function getThemeBundleRelativePath(directoryPath: string, filePath: string): string | null {
  const normalizedDirectoryPath = normalizeThemeBundleComparisonPath(directoryPath);
  const normalizedFilePath = normalizeThemeBundleComparisonPath(filePath);
  if (!normalizedDirectoryPath || !normalizedFilePath) {
    return null;
  }

  if (normalizedFilePath === normalizedDirectoryPath) {
    return '';
  }

  if (!normalizedFilePath.startsWith(`${normalizedDirectoryPath}/`)) {
    return null;
  }

  return normalizedFilePath.slice(normalizedDirectoryPath.length + 1);
}

function resolveThemeBundleRuntimeModuleImportPath(
  fromModuleRelativePath: string,
  specifier: string,
): string | null {
  const importerSegments = fromModuleRelativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  importerSegments.pop();
  const specifierSegments = specifier.replace(/\\/g, '/').split('/');
  return normalizeThemeBundleRuntimeModulePath(
    [...importerSegments, ...specifierSegments].join('/'),
  );
}

function buildThemeBundleRuntimeModuleCandidates(relativePath: string): string[] {
  const normalizedRelativePath = normalizeThemeBundleRuntimeModulePath(relativePath);
  if (!normalizedRelativePath) {
    return [];
  }

  const candidates = new Set<string>();
  if (/\.[^./]+$/.test(normalizedRelativePath)) {
    candidates.add(normalizedRelativePath);
  } else {
    for (const extension of themeBundleRuntimeModuleExtensions) {
      candidates.add(`${normalizedRelativePath}.${extension}`);
      candidates.add(`${normalizedRelativePath}/index.${extension}`);
    }
  }

  return [...candidates];
}

function createThemeBundleRelativeModuleSourceResolver(
  directoryPath: string,
): RuntimeRelativeModuleSourceResolver {
  return async ({ fromModulePath, specifier }) => {
    const fromModuleRelativePath = getThemeBundleRelativePath(directoryPath, fromModulePath);
    if (fromModuleRelativePath == null) {
      return null;
    }

    const resolvedImportPath = resolveThemeBundleRuntimeModuleImportPath(
      fromModuleRelativePath,
      specifier,
    );
    if (!resolvedImportPath) {
      return null;
    }

    for (const candidateRelativePath of buildThemeBundleRuntimeModuleCandidates(resolvedImportPath)) {
      const candidateAbsolutePath = joinPlatformPath(directoryPath, candidateRelativePath);
      try {
        const source = await commands.fsReadTextFile(candidateAbsolutePath).then(unwrapTauriResult);
        return {
          modulePath: candidateAbsolutePath,
          source,
        };
      } catch {
        continue;
      }
    }

    return null;
  };
}

async function readManifestEntries(
  directoryEntries: FileEntry[],
  manifestNames: readonly string[],
): Promise<Array<{ entry: FileEntry; directoryPath: string; manifestPath: string; manifest: LooseRecord }>> {
  const loaded: Array<{ entry: FileEntry; directoryPath: string; manifestPath: string; manifest: LooseRecord }> = [];

  for (const entry of directoryEntries) {
    if (!entry.is_dir) {
      const lowerName = entry.name.toLowerCase();
      const isManifest = lowerName.endsWith('.json') || lowerName.endsWith('.toml');
      if (!isManifest) {
        continue;
      }

      const text = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
      loaded.push({
        entry,
        directoryPath: getParentDirectoryPath(entry.path),
        manifestPath: entry.path,
        manifest: parseManifestText(text, entry.path),
      });
      continue;
    }

    for (const manifestName of manifestNames) {
      const manifestPath = joinPlatformPath(entry.path, manifestName);
      try {
        const text = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
        loaded.push({
          entry,
          directoryPath: entry.path,
          manifestPath,
          manifest: parseManifestText(text, manifestPath),
        });
        break;
      } catch {
        continue;
      }
    }
  }

  return loaded;
}

function mergeStringRecords(
  ...records: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const merged = Object.assign({}, ...records.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function pickRecord<T>(value: unknown): T | undefined {
  return asRecord(value) as T | undefined;
}

async function readTokenCategoryFiles(
  directoryPath: string,
  categories: readonly UiTokenCategory[],
): Promise<Partial<Record<UiTokenCategory, LooseRecord>>> {
  const entries = await Promise.all(categories.map(async category => [
    category,
    await readOptionalLooseRecord(joinPlatformPath(joinPlatformPath(directoryPath, 'tokens'), `${category}.json`)),
  ] as const));

  return Object.fromEntries(entries.filter(([, record]) => Boolean(record))) as Partial<Record<UiTokenCategory, LooseRecord>>;
}

function normalizeTokenFilePayload(category: UiTokenCategory, source: LooseRecord | undefined): UiTokenCollection {
  if (!source) {
    return {};
  }

  const explicitTokens = normalizeUiTokenCategoryMap(source.tokens ?? source[category]);
  const fallbackTokens = Object.keys(explicitTokens).length > 0
    ? explicitTokens
    : normalizeUiTokenCategoryMap(Object.fromEntries(
        Object.entries(source).filter(([key]) => ![
          'palette',
          'effects',
          'xterm',
          'fonts',
          'visuals',
          'cssVars',
          'preview',
          'interactionMotion',
          'recipe',
        ].includes(key)),
      ));

  return Object.keys(fallbackTokens).length > 0
    ? { [category]: fallbackTokens }
    : {};
}

function normalizeTokenFiles(
  tokenFiles: Partial<Record<UiTokenCategory, LooseRecord>>,
): UiTokenCollection {
  return mergeUiTokenCollections(
    ...UI_TOKEN_CATEGORIES.map(category => normalizeTokenFilePayload(category, tokenFiles[category])),
  );
}

function parseThemeAppearancePackManifest(source: LooseRecord): ThemeAppearancePackManifest {
  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    extendsThemeId: asString(source.extendsThemeId || source.extends),
    palette: asRecord(source.palette) as Partial<OverlayThemePalette> | undefined,
    effects: asRecord(source.effects) as Partial<OverlayThemeEffects> | undefined,
    scrollbar: asRecord(source.scrollbar) as OverlayThemeScrollbar | undefined,
    xterm: asRecord(source.xterm) as Partial<OverlayXTermTheme> | undefined,
    fonts: asRecord(source.fonts) as OverlayThemeFonts | undefined,
    visuals: Array.isArray(source.visuals) ? source.visuals as OverlayThemeVisualLayer[] : undefined,
    cssVars: asStringRecord(source.cssVars),
    tokens: normalizeUiTokenCollection(source.tokens),
    preview: asString(source.preview ?? asRecord(source.assets)?.preview),
  };
}

function parseInteractionMotionPackManifest(source: LooseRecord): ThemeInteractionMotionPackManifest {
  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    interactionMotion: asRecord(source.interactionMotion ?? source.recipe) as OverlayInteractionMotionThemeRecipe | undefined,
    tokens: normalizeUiTokenCollection(source.tokens),
  };
}

function parseThemeRecipePackManifest(source: LooseRecord): ThemeRecipePackManifest {
  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    presentation: asRecord(source.presentation) as OverlayThemePresentation | undefined,
    compatibility: asRecord(source.compatibility) as OverlayThemeCompatibility | undefined,
    layoutPrimitives: Array.isArray(source.layoutPrimitives) ? source.layoutPrimitives as ExplorerThemeManifest['layoutPrimitives'] : undefined,
    navigationPatterns: Array.isArray(source.navigationPatterns) ? source.navigationPatterns as ExplorerThemeManifest['navigationPatterns'] : undefined,
    animationProfiles: Array.isArray(source.animationProfiles) ? source.animationProfiles as ExplorerThemeManifest['animationProfiles'] : undefined,
    iconPacks: Array.isArray(source.iconPacks) ? source.iconPacks as ExplorerThemeManifest['iconPacks'] : undefined,
    renderStyles: Array.isArray(source.renderStyles) ? source.renderStyles as ExplorerThemeManifest['renderStyles'] : undefined,
    defaultLayoutPrimitiveId: asString(source.defaultLayoutPrimitiveId) || undefined,
    defaultNavigationPatternId: asString(source.defaultNavigationPatternId) || undefined,
    defaultAnimationProfileId: asString(source.defaultAnimationProfileId) || undefined,
    defaultIconPackId: asString(source.defaultIconPackId) || undefined,
    defaultRenderStyleId: asString(source.defaultRenderStyleId) || undefined,
    workbench: asRecord(source.workbench) as OverlayWorkbenchThemeRecipe | undefined,
    explorer: asRecord(source.explorer) as OverlayExplorerThemeRecipe | undefined,
    mobile: asRecord(source.mobile) as OverlayMobileThemeRecipe | undefined,
    dock: asRecord(source.dock) as ThemeRecipePackManifest['dock'] | undefined,
  };
}

function parseThemeEnginePackManifest(source: LooseRecord): ThemeEnginePackManifest {
  const composition = asRecord(source.composition);
  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    extends: asString(source.extends),
    appearancePackId: asString(source.appearancePackId ?? composition?.appearancePackId) || undefined,
    interactionMotionPackId: asString(source.interactionMotionPackId ?? composition?.interactionMotionPackId) || undefined,
    themeRecipeId: asString(source.themeRecipeId ?? composition?.themeRecipeId) || undefined,
    presentation: asRecord(source.presentation) as OverlayThemePresentation | undefined,
    compatibility: asRecord(source.compatibility) as OverlayThemeCompatibility | undefined,
    designTokens: Array.isArray(source.designTokens) ? source.designTokens as ExplorerThemeManifest['designTokens'] : undefined,
    layoutPrimitives: Array.isArray(source.layoutPrimitives) ? source.layoutPrimitives as ExplorerThemeManifest['layoutPrimitives'] : undefined,
    navigationPatterns: Array.isArray(source.navigationPatterns) ? source.navigationPatterns as ExplorerThemeManifest['navigationPatterns'] : undefined,
    animationProfiles: Array.isArray(source.animationProfiles) ? source.animationProfiles as ExplorerThemeManifest['animationProfiles'] : undefined,
    iconPacks: Array.isArray(source.iconPacks) ? source.iconPacks as ExplorerThemeManifest['iconPacks'] : undefined,
    renderStyles: Array.isArray(source.renderStyles) ? source.renderStyles as ExplorerThemeManifest['renderStyles'] : undefined,
    defaultLayoutPrimitiveId: asString(source.defaultLayoutPrimitiveId) || undefined,
    defaultNavigationPatternId: asString(source.defaultNavigationPatternId) || undefined,
    defaultAnimationProfileId: asString(source.defaultAnimationProfileId) || undefined,
    defaultIconPackId: asString(source.defaultIconPackId) || undefined,
    defaultRenderStyleId: asString(source.defaultRenderStyleId) || undefined,
  };
}

function isWorkbenchRenderRuntimeKind(value: unknown): value is WorkbenchRenderRuntimeKind {
  return value === 'workbench-tabs'
    || value === 'cross-axis-media'
    || value === 'channel-launcher'
    || value === 'desktop-stack';
}

function parseThemeShellRendererPackManifest(source: LooseRecord): ThemeShellRendererPackManifest {
  const capabilities = asRecord(source.capabilities);
  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    entryModule: asString(source.entryModule ?? source.entry),
    apiVersion: typeof source.apiVersion === 'number' ? source.apiVersion : undefined,
    supportsLiveSwap: typeof source.supportsLiveSwap === 'boolean' ? source.supportsLiveSwap : undefined,
    fallbackRuntime: isWorkbenchRenderRuntimeKind(source.fallbackRuntime) ? source.fallbackRuntime : undefined,
    capabilities: capabilities
      ? {
          customScreens: typeof capabilities.customScreens === 'boolean' ? capabilities.customScreens : undefined,
          wallpaperScene: typeof capabilities.wallpaperScene === 'boolean' ? capabilities.wallpaperScene : undefined,
          surfaceAdapters: typeof capabilities.surfaceAdapters === 'boolean' ? capabilities.surfaceAdapters : undefined,
        }
      : undefined,
  };
}

async function loadThemeAppearancePacksFromRecords(
  records: Array<{ directoryPath: string; manifestPath: string; manifest: ThemeAppearancePackManifest }>,
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeAppearancePack>> {
  const packs = await Promise.all(records.map(async record => {
    const tokenFiles = await readTokenCategoryFiles(record.directoryPath, [
      'color',
      'typography',
      'spacing',
      'radius',
      'border',
      'shadow',
      'opacity',
      'blur',
      'geometry',
      'layer',
    ]);
    const colorTokens = tokenFiles.color;
    const typographyTokens = tokenFiles.typography;
    const shadowTokens = tokenFiles.shadow;
    const geometryTokens = tokenFiles.geometry;
    const cssVars = mergeStringRecords(
      record.manifest.cssVars,
      asStringRecord(colorTokens?.cssVars),
      asStringRecord(typographyTokens?.cssVars),
      asStringRecord(shadowTokens?.cssVars),
      asStringRecord(geometryTokens?.cssVars),
    );
    const tokens = mergeUiTokenCollections(
      record.manifest.tokens,
      normalizeTokenFiles(tokenFiles),
    );
    const appearance: ThemeAppearancePackManifest = {
      ...record.manifest,
      palette: pickRecord<Partial<OverlayThemePalette>>(colorTokens?.palette) ?? record.manifest.palette,
      effects: {
        ...(record.manifest.effects ?? {}),
        ...(pickRecord<Partial<OverlayThemeEffects>>(colorTokens?.effects) ?? {}),
        ...(pickRecord<Partial<OverlayThemeEffects>>(shadowTokens?.effects) ?? {}),
      },
      xterm: pickRecord<Partial<OverlayXTermTheme>>(colorTokens?.xterm) ?? record.manifest.xterm,
      fonts: pickRecord<OverlayThemeFonts>(typographyTokens?.fonts) ?? record.manifest.fonts,
      visuals: Array.isArray(geometryTokens?.visuals)
        ? geometryTokens.visuals as OverlayThemeVisualLayer[]
        : record.manifest.visuals,
      cssVars,
      tokens,
    };
    const metadata = buildPackMetadata(record.manifest, record.manifestPath, record.directoryPath, options);
    return {
      ...metadata,
      appearance,
      tokens,
      previewUrl: await resolvePreviewUrl(record.directoryPath, record.manifest.preview),
    } satisfies LoadedThemeAppearancePack;
  }));

  return { packs, warnings: [] };
}

async function loadInteractionMotionPacksFromRecords(
  records: Array<{ directoryPath: string; manifestPath: string; manifest: ThemeInteractionMotionPackManifest }>,
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeInteractionMotionPack>> {
  const packs = await Promise.all(records.map(async record => {
    const tokenFiles = await readTokenCategoryFiles(record.directoryPath, ['motion', 'interaction']);
    const tokens = mergeUiTokenCollections(
      record.manifest.tokens,
      normalizeTokenFiles(tokenFiles),
    );
    const interactionTokens = tokenFiles.interaction;
    return {
      ...buildPackMetadata(record.manifest, record.manifestPath, record.directoryPath, options),
      interactionMotion: pickRecord<OverlayInteractionMotionThemeRecipe>(
        interactionTokens?.interactionMotion ?? interactionTokens?.recipe,
      ) ?? record.manifest.interactionMotion,
      tokens,
    } satisfies LoadedThemeInteractionMotionPack;
  }));

  return { packs, warnings: [] };
}

async function loadThemeRecipePacksFromRecords(
  records: Array<{ directoryPath: string; manifestPath: string; manifest: ThemeRecipePackManifest }>,
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeRecipePack>> {
  const packs = await Promise.all(records.map(async record => {
    const [
      presentationFile,
      layoutFile,
      navigationFile,
      renderFile,
      workbenchFile,
      explorerFile,
      mobileFile,
    ] = await Promise.all([
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'presentation.json')),
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'layout.json')),
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'navigation.json')),
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'render.json')),
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'workbench.json')),
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'explorer.json')),
      readOptionalLooseRecord(joinPlatformPath(record.directoryPath, 'mobile.json')),
    ]);

    const renderDefaults = asRecord(renderFile?.defaults);
    const recipe: LoadedThemeRecipePack['recipe'] = {
      presentation: pickRecord<OverlayThemePresentation>(presentationFile?.presentation ?? presentationFile) ?? record.manifest.presentation,
      compatibility: pickRecord<OverlayThemeCompatibility>(renderFile?.compatibility ?? presentationFile?.compatibility) ?? record.manifest.compatibility,
      layoutPrimitives: Array.isArray(layoutFile?.layoutPrimitives)
        ? layoutFile.layoutPrimitives as ExplorerThemeManifest['layoutPrimitives']
        : record.manifest.layoutPrimitives,
      navigationPatterns: Array.isArray(navigationFile?.navigationPatterns)
        ? navigationFile.navigationPatterns as ExplorerThemeManifest['navigationPatterns']
        : record.manifest.navigationPatterns,
      animationProfiles: Array.isArray(renderFile?.animationProfiles)
        ? renderFile.animationProfiles as ExplorerThemeManifest['animationProfiles']
        : record.manifest.animationProfiles,
      iconPacks: Array.isArray(renderFile?.iconPacks)
        ? renderFile.iconPacks as ExplorerThemeManifest['iconPacks']
        : record.manifest.iconPacks,
      renderStyles: Array.isArray(renderFile?.renderStyles)
        ? renderFile.renderStyles as ExplorerThemeManifest['renderStyles']
        : record.manifest.renderStyles,
      defaultLayoutPrimitiveId: asString(layoutFile?.defaultLayoutPrimitiveId ?? layoutFile?.defaultId) || record.manifest.defaultLayoutPrimitiveId,
      defaultNavigationPatternId: asString(navigationFile?.defaultNavigationPatternId ?? navigationFile?.defaultId) || record.manifest.defaultNavigationPatternId,
      defaultAnimationProfileId: asString(renderFile?.defaultAnimationProfileId ?? renderDefaults?.animationProfileId) || record.manifest.defaultAnimationProfileId,
      defaultIconPackId: asString(renderFile?.defaultIconPackId ?? renderDefaults?.iconPackId) || record.manifest.defaultIconPackId,
      defaultRenderStyleId: asString(renderFile?.defaultRenderStyleId ?? renderDefaults?.renderStyleId) || record.manifest.defaultRenderStyleId,
      workbench: pickRecord<OverlayWorkbenchThemeRecipe>(workbenchFile?.workbench ?? workbenchFile) ?? record.manifest.workbench,
      explorer: pickRecord<OverlayExplorerThemeRecipe>(explorerFile?.explorer ?? explorerFile) ?? record.manifest.explorer,
      mobile: pickRecord<OverlayMobileThemeRecipe>(mobileFile?.mobile ?? mobileFile) ?? record.manifest.mobile,
      dock: record.manifest.dock,
    };

    return {
      ...buildPackMetadata(record.manifest, record.manifestPath, record.directoryPath, options),
      recipe,
    } satisfies LoadedThemeRecipePack;
  }));

  return { packs, warnings: [] };
}

async function loadThemeEnginePacksFromRecords(
  records: Array<{ directoryPath: string; manifestPath: string; manifest: ThemeEnginePackManifest }>,
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeEnginePack>> {
  return {
    packs: records.map(record => {
      const metadata = buildPackMetadata(record.manifest, record.manifestPath, record.directoryPath, options);
      const engineManifest = normalizeThemeManifestDraft({
        id: metadata.id,
        name: metadata.name,
        extends: record.manifest.extends ?? null,
        presentation: record.manifest.presentation,
        compatibility: {
          shellBlueprints: record.manifest.compatibility?.shellBlueprints ?? [],
          tags: record.manifest.compatibility?.tags ?? [],
        },
        designTokens: record.manifest.designTokens ?? [],
        layoutPrimitives: record.manifest.layoutPrimitives ?? [],
        navigationPatterns: record.manifest.navigationPatterns ?? [],
        animationProfiles: record.manifest.animationProfiles ?? [],
        iconPacks: record.manifest.iconPacks ?? [],
        renderStyles: record.manifest.renderStyles ?? [],
        defaultLayoutPrimitiveId: record.manifest.defaultLayoutPrimitiveId ?? null,
        defaultNavigationPatternId: record.manifest.defaultNavigationPatternId ?? null,
        defaultAnimationProfileId: record.manifest.defaultAnimationProfileId ?? null,
        defaultIconPackId: record.manifest.defaultIconPackId ?? null,
        defaultRenderStyleId: record.manifest.defaultRenderStyleId ?? null,
      });

      return {
        ...metadata,
        composition: {
          appearancePackId: record.manifest.appearancePackId,
          interactionMotionPackId: record.manifest.interactionMotionPackId,
          themeRecipeId: record.manifest.themeRecipeId,
        },
        engineManifest,
        compiledEngineManifest: compileThemeEngineManifest(engineManifest),
      } satisfies LoadedThemeEnginePack;
    }),
    warnings: [],
  };
}

async function loadThemeShellRendererPacksFromRecords(
  records: Array<{ directoryPath: string; manifestPath: string; manifest: ThemeShellRendererPackManifest }>,
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeShellRendererPack>> {
  const warnings: string[] = [];
  const packs = await Promise.all(records.map(async record => {
    const metadata = buildPackMetadata(record.manifest, record.manifestPath, record.directoryPath, options);
    const entryModule = asString(record.manifest.entryModule);
    const packWarnings: string[] = [];
    let renderer: LoadedOverlayThemeRenderer | undefined;

    if (entryModule) {
      try {
        const filePath = joinPlatformPath(record.directoryPath, normalizePathAsset(entryModule));
        const source = await commands.fsReadTextFile(filePath).then(unwrapTauriResult);
        renderer = await loadThemeRendererFromSource(source, {
          name: filePath.split(/[\\/]/).pop() ?? entryModule,
          path: filePath,
          is_dir: false,
          extension: entryModule.split('.').pop() ?? 'tsx',
          modified: 0,
        }, {
          context: {
            id: metadata.id,
            name: metadata.name,
            filePath,
            rendererRoot: record.directoryPath,
            entryModule,
          },
          defaults: {
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            apiVersion: record.manifest.apiVersion,
            supportsLiveSwap: record.manifest.supportsLiveSwap,
            fallbackRuntime: record.manifest.fallbackRuntime,
            capabilities: record.manifest.capabilities,
          },
          resolveRelativeModuleSource:
            options?.resolveRelativeModuleSource
            ?? createThemeBundleRelativeModuleSourceResolver(record.directoryPath),
        });
        if (renderer.error) {
          packWarnings.push(`renderer ${entryModule}: ${renderer.error}`);
        }
      } catch (error) {
        packWarnings.push(`renderer ${entryModule}: ${String(error)}`);
      }
    } else {
      packWarnings.push(`renderer manifest ${record.manifestPath} is missing entryModule`);
    }

    warnings.push(...packWarnings.map(warning => `${metadata.name}: ${warning}`));
    return {
      ...metadata,
      warnings: packWarnings,
      entryModule,
      renderer,
    } satisfies LoadedThemeShellRendererPack;
  }));

  return { packs, warnings };
}

export const themeAppearancePackSystemConfig = {
  get appearancesDirectory(): string {
    return getManagedContentDirectory('appearancePacks');
  },
  manifestNames: ['appearance.json', 'appearance.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

export const themeInteractionMotionPackSystemConfig = {
  get interactionMotionDirectory(): string {
    return getManagedContentDirectory('interactionMotionPacks');
  },
  manifestNames: ['interaction-motion.json', 'interaction-motion.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

export const themeRecipePackSystemConfig = {
  get themeRecipesDirectory(): string {
    return getManagedContentDirectory('themeRecipes');
  },
  manifestNames: ['theme-recipe.json', 'theme-recipe.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

export const themeEnginePackSystemConfig = {
  get themeEnginesDirectory(): string {
    return getManagedContentDirectory('themeEngines');
  },
  manifestNames: ['theme-engine.json', 'theme-engine.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

export const themeShellRendererPackSystemConfig = {
  get shellRenderersDirectory(): string {
    return getManagedContentDirectory('shellRenderers');
  },
  manifestNames: ['shell-renderer.json', 'shell-renderer.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

export async function loadThemeAppearancePacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeAppearancePack>> {
  const records = await readManifestEntries(directoryEntries, themeAppearancePackSystemConfig.manifestNames);
  return loadThemeAppearancePacksFromRecords(
    records.map(record => ({ ...record, manifest: parseThemeAppearancePackManifest(record.manifest) })),
    options,
  );
}

export async function loadThemeInteractionMotionPacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeInteractionMotionPack>> {
  const records = await readManifestEntries(directoryEntries, themeInteractionMotionPackSystemConfig.manifestNames);
  return loadInteractionMotionPacksFromRecords(
    records.map(record => ({ ...record, manifest: parseInteractionMotionPackManifest(record.manifest) })),
    options,
  );
}

export async function loadThemeRecipePacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeRecipePack>> {
  const records = await readManifestEntries(directoryEntries, themeRecipePackSystemConfig.manifestNames);
  return loadThemeRecipePacksFromRecords(
    records.map(record => ({ ...record, manifest: parseThemeRecipePackManifest(record.manifest) })),
    options,
  );
}

export async function loadThemeEnginePacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeEnginePack>> {
  const records = await readManifestEntries(directoryEntries, themeEnginePackSystemConfig.manifestNames);
  return loadThemeEnginePacksFromRecords(
    records.map(record => ({ ...record, manifest: parseThemeEnginePackManifest(record.manifest) })),
    options,
  );
}

export async function loadThemeShellRendererPacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  options?: ThemeBundlePackOptions,
): Promise<ThemeBundlePackLoadResult<LoadedThemeShellRendererPack>> {
  const records = await readManifestEntries(directoryEntries, themeShellRendererPackSystemConfig.manifestNames);
  return loadThemeShellRendererPacksFromRecords(
    records.map(record => ({ ...record, manifest: parseThemeShellRendererPackManifest(record.manifest) })),
    options,
  );
}

async function loadDirectoryEntries(directory: string): Promise<FileEntry[]> {
  if (!isTauri()) {
    return [];
  }

  try {
    return await listLocalDirectoryEntriesFast(directory);
  } catch {
    return [];
  }
}

export async function loadThemeAppearancePacks(): Promise<ThemeBundlePackLoadResult<LoadedThemeAppearancePack>> {
  return loadThemeAppearancePacksFromDirectoryEntries(
    await loadDirectoryEntries(themeAppearancePackSystemConfig.appearancesDirectory),
  );
}

export async function loadThemeInteractionMotionPacks(): Promise<ThemeBundlePackLoadResult<LoadedThemeInteractionMotionPack>> {
  return loadThemeInteractionMotionPacksFromDirectoryEntries(
    await loadDirectoryEntries(themeInteractionMotionPackSystemConfig.interactionMotionDirectory),
  );
}

export async function loadThemeRecipePacks(): Promise<ThemeBundlePackLoadResult<LoadedThemeRecipePack>> {
  return loadThemeRecipePacksFromDirectoryEntries(
    await loadDirectoryEntries(themeRecipePackSystemConfig.themeRecipesDirectory),
  );
}

export async function loadThemeEnginePacks(): Promise<ThemeBundlePackLoadResult<LoadedThemeEnginePack>> {
  return loadThemeEnginePacksFromDirectoryEntries(
    await loadDirectoryEntries(themeEnginePackSystemConfig.themeEnginesDirectory),
  );
}

export async function loadThemeShellRendererPacks(): Promise<ThemeBundlePackLoadResult<LoadedThemeShellRendererPack>> {
  return loadThemeShellRendererPacksFromDirectoryEntries(
    await loadDirectoryEntries(themeShellRendererPackSystemConfig.shellRenderersDirectory),
  );
}

export function createInlineThemeAppearancePack(
  manifest: ThemeAppearancePackManifest,
  options: { bundleId: string; manifestPath?: string; directoryPath?: string },
): LoadedThemeAppearancePack {
  const metadata = buildPackMetadata(
    manifest,
    options.manifestPath ?? `settings:${options.bundleId}:appearance-pack`,
    options.directoryPath ?? `settings:${options.bundleId}`,
    { scopeId: options.bundleId, virtualRoot: options.directoryPath ?? `settings:${options.bundleId}` },
  );
  return {
    ...metadata,
    appearance: manifest,
    tokens: manifest.tokens,
  };
}

export function createInlineThemeInteractionMotionPack(
  manifest: ThemeInteractionMotionPackManifest,
  options: { bundleId: string; manifestPath?: string; directoryPath?: string },
): LoadedThemeInteractionMotionPack {
  return {
    ...buildPackMetadata(
      manifest,
      options.manifestPath ?? `settings:${options.bundleId}:interaction-motion-pack`,
      options.directoryPath ?? `settings:${options.bundleId}`,
      { scopeId: options.bundleId, virtualRoot: options.directoryPath ?? `settings:${options.bundleId}` },
    ),
    interactionMotion: manifest.interactionMotion,
    tokens: manifest.tokens,
  };
}

export function createInlineThemeRecipePack(
  manifest: ThemeRecipePackManifest,
  options: { bundleId: string; manifestPath?: string; directoryPath?: string },
): LoadedThemeRecipePack {
  return {
    ...buildPackMetadata(
      manifest,
      options.manifestPath ?? `settings:${options.bundleId}:theme-recipe-pack`,
      options.directoryPath ?? `settings:${options.bundleId}`,
      { scopeId: options.bundleId, virtualRoot: options.directoryPath ?? `settings:${options.bundleId}` },
    ),
    recipe: {
      presentation: manifest.presentation,
      compatibility: manifest.compatibility,
      layoutPrimitives: manifest.layoutPrimitives,
      navigationPatterns: manifest.navigationPatterns,
      animationProfiles: manifest.animationProfiles,
      iconPacks: manifest.iconPacks,
      renderStyles: manifest.renderStyles,
      defaultLayoutPrimitiveId: manifest.defaultLayoutPrimitiveId,
      defaultNavigationPatternId: manifest.defaultNavigationPatternId,
      defaultAnimationProfileId: manifest.defaultAnimationProfileId,
      defaultIconPackId: manifest.defaultIconPackId,
      defaultRenderStyleId: manifest.defaultRenderStyleId,
      workbench: manifest.workbench,
      explorer: manifest.explorer,
      mobile: manifest.mobile,
      dock: manifest.dock,
    },
  };
}

export function createInlineThemeEnginePack(
  manifest: ThemeEnginePackManifest,
  options: { bundleId: string; manifestPath?: string; directoryPath?: string },
): LoadedThemeEnginePack {
  const metadata = buildPackMetadata(
    manifest,
    options.manifestPath ?? `settings:${options.bundleId}:theme-engine-pack`,
    options.directoryPath ?? `settings:${options.bundleId}`,
    { scopeId: options.bundleId, virtualRoot: options.directoryPath ?? `settings:${options.bundleId}` },
  );
  const engineManifest = normalizeThemeManifestDraft({
    id: metadata.id,
    name: metadata.name,
    extends: manifest.extends ?? null,
    presentation: manifest.presentation,
    compatibility: {
      shellBlueprints: manifest.compatibility?.shellBlueprints ?? [],
      tags: manifest.compatibility?.tags ?? [],
    },
    designTokens: manifest.designTokens ?? [],
    layoutPrimitives: manifest.layoutPrimitives ?? [],
    navigationPatterns: manifest.navigationPatterns ?? [],
    animationProfiles: manifest.animationProfiles ?? [],
    iconPacks: manifest.iconPacks ?? [],
    renderStyles: manifest.renderStyles ?? [],
    defaultLayoutPrimitiveId: manifest.defaultLayoutPrimitiveId ?? null,
    defaultNavigationPatternId: manifest.defaultNavigationPatternId ?? null,
    defaultAnimationProfileId: manifest.defaultAnimationProfileId ?? null,
    defaultIconPackId: manifest.defaultIconPackId ?? null,
    defaultRenderStyleId: manifest.defaultRenderStyleId ?? null,
  });
  return {
    ...metadata,
    composition: {
      appearancePackId: manifest.appearancePackId,
      interactionMotionPackId: manifest.interactionMotionPackId,
      themeRecipeId: manifest.themeRecipeId,
    },
    engineManifest,
    compiledEngineManifest: compileThemeEngineManifest(engineManifest),
  };
}
