import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import {
  normalizeThemeDefinition,
  overlayThemePresets,
  type OverlayThemeAssets,
  type OverlayThemeCompatibility,
  type OverlayThemeDefinition,
  type OverlayThemePresentation,
  type OverlayThemeVisualLayer,
} from './appearance';
import {
  compileThemeEngineManifest,
  normalizeThemeManifestDraft,
  type CompiledThemeEngineManifest,
  type ExplorerThemeManifest,
} from '../runtime/themeEngineBackend';
import { type LoadedOverlayAnimation, loadAnimationFromSource, deriveAnimationId, deriveAnimationName } from '../components/animationRuntime';
import {
  createResolvedIconThemeFromEntries,
  getBuiltInIconTheme,
  mergeResolvedIconThemes,
  parseIconThemeManifest,
  resolveIconThemeManifest,
  type OverlayResolvedIconTheme,
} from './iconTheme';
import { type LoadedOverlayShader, loadShaderFromSource, deriveShaderId, deriveShaderName, isFrontendShaderFile } from '../components/shaderRuntime';
import { isFrontendAnimationFile } from '../components/animationRuntime';
import { joinPlatformPath } from './platform';
import { OVERLAY_SHELL_BLUEPRINTS } from './shellBlueprints';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;
const validShellBlueprintIds = new Set(OVERLAY_SHELL_BLUEPRINTS.map(blueprint => blueprint.id));

export interface OverlayThemePackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  extends?: string;
  theme?: Partial<OverlayThemeDefinition>;
  assets?: {
    background?: string;
    preview?: string;
    iconsDirectory?: string;
    iconTheme?: string;
    iconAliases?: Record<string, string>;
  };
  contributions?: {
    shaders?: string[];
    animations?: string[];
  };
  visuals?: OverlayThemeVisualLayer[];
  cssVars?: Record<string, string>;
  fonts?: {
    ui?: string;
    mono?: string;
  };
  presentation?: OverlayThemePresentation;
  compatibility?: OverlayThemeCompatibility;
  designTokens?: ExplorerThemeManifest['designTokens'];
  layoutPrimitives?: ExplorerThemeManifest['layoutPrimitives'];
  navigationPatterns?: ExplorerThemeManifest['navigationPatterns'];
  animationProfiles?: ExplorerThemeManifest['animationProfiles'];
  iconPacks?: ExplorerThemeManifest['iconPacks'];
  renderStyles?: ExplorerThemeManifest['renderStyles'];
  defaultRenderStyleId?: ExplorerThemeManifest['defaultRenderStyleId'];
}

interface OverlayThemePackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: OverlayThemePackageManifest;
}

export interface ThemePackageDirectoryEntry {
  name: string;
  path: string;
}

export interface LoadedOverlayThemePackage {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'theme-directory' | 'plugin-package';
  sourceLabel: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  previewUrl?: string;
  warnings: string[];
  capabilitySummary: {
    icons: boolean;
    wallpaper: boolean;
    visuals: number;
    shaders: number;
    animations: number;
    fonts: number;
  };
  theme: OverlayThemeDefinition;
  engineManifest?: ExplorerThemeManifest;
  compiledEngineManifest?: CompiledThemeEngineManifest;
}

export interface ThemePackageLoadResult {
  packages: LoadedOverlayThemePackage[];
  shaders: LoadedOverlayShader[];
  animations: LoadedOverlayAnimation[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export interface ThemePackageLoadOptions {
  sourceKind?: LoadedOverlayThemePackage['sourceKind'];
  sourceLabel?: string;
}

export const themeSystemConfig = {
  themesDirectory: resolveThemesDirectory(),
  manifestNames: ['theme.json', 'theme.toml', 'manifest.json', 'manifest.toml'] as const,
  packageShadersDirectoryName: 'shaders',
  packageAnimationsDirectoryName: 'animations',
} as const;

function resolveThemesDirectory(): string {
  const configured = (import.meta.env as {
    VITE_OVERLAYTERM_THEMES_DIR?: string;
  }).VITE_OVERLAYTERM_THEMES_DIR?.trim();
  return configured && configured.length > 0 ? configured : 'themes';
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

function derivePackageId(record: OverlayThemePackageRecord): string {
  const explicitId = asString(record.manifest.id) || asString(record.manifest.theme?.id);
  if (explicitId) {
    return explicitId;
  }

  return record.directoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme-package';
}

function derivePackageName(record: OverlayThemePackageRecord): string {
  return asString(record.manifest.name)
    || asString(record.manifest.theme?.name)
    || record.directoryName
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
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

async function toInlineAssetUrl(filePath: string): Promise<string> {
  if (typeof window === 'undefined' || !isTauri()) {
    return toAssetUrl(filePath);
  }

  try {
    return await commands.fsReadFileBase64(filePath).then(unwrapTauriResult);
  } catch {
    return toAssetUrl(filePath);
  }
}

function normalizePackageAssetPath(assetPath: string): string {
  return assetPath.trim().replace(/^\.(?:\/|\\)/, '');
}

function parseThemeManifestText(text: string, filePath: string): OverlayThemePackageManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Theme manifest is empty: ${filePath}`);
  }

  const lowerPath = filePath.toLowerCase();
  const parsed = lowerPath.endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Theme manifest must be an object: ${filePath}`);
  }

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: Array.isArray(source.tags)
      ? source.tags.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
      : [],
    extends: asString(source.extends),
    theme: asRecord(source.theme) as Partial<OverlayThemeDefinition> | undefined,
    assets: {
      background: asString(asRecord(source.assets)?.background),
      preview: asString(asRecord(source.assets)?.preview),
      iconsDirectory: asString(asRecord(source.assets)?.iconsDirectory),
      iconTheme: asString(asRecord(source.assets)?.iconTheme),
      iconAliases: asStringRecord(asRecord(source.assets)?.iconAliases),
    },
    contributions: {
      shaders: Array.isArray(asRecord(source.contributions)?.shaders)
        ? (asRecord(source.contributions)?.shaders as unknown[]).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
        : [],
      animations: Array.isArray(asRecord(source.contributions)?.animations)
        ? (asRecord(source.contributions)?.animations as unknown[]).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
        : [],
    },
    visuals: Array.isArray(source.visuals) ? source.visuals as OverlayThemeVisualLayer[] : undefined,
    cssVars: asStringRecord(source.cssVars),
    fonts: {
      ui: asString(asRecord(source.fonts)?.ui),
      mono: asString(asRecord(source.fonts)?.mono),
    },
    presentation: asRecord(source.presentation) as OverlayThemePresentation | undefined,
    compatibility: {
      shellBlueprints: Array.isArray(asRecord(source.compatibility)?.shellBlueprints)
        ? (asRecord(source.compatibility)?.shellBlueprints as unknown[])
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map(entry => entry.trim())
          .filter((entry): entry is OverlayThemeCompatibility['shellBlueprints'][number] => validShellBlueprintIds.has(entry as typeof OVERLAY_SHELL_BLUEPRINTS[number]['id']))
        : [],
      tags: Array.isArray(asRecord(source.compatibility)?.tags)
        ? (asRecord(source.compatibility)?.tags as unknown[])
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
          .map(entry => entry.trim())
        : [],
    },
    designTokens: Array.isArray(source.designTokens)
      ? source.designTokens as ExplorerThemeManifest['designTokens']
      : undefined,
    layoutPrimitives: Array.isArray(source.layoutPrimitives)
      ? source.layoutPrimitives as ExplorerThemeManifest['layoutPrimitives']
      : undefined,
    navigationPatterns: Array.isArray(source.navigationPatterns)
      ? source.navigationPatterns as ExplorerThemeManifest['navigationPatterns']
      : undefined,
    animationProfiles: Array.isArray(source.animationProfiles)
      ? source.animationProfiles as ExplorerThemeManifest['animationProfiles']
      : undefined,
    iconPacks: Array.isArray(source.iconPacks)
      ? source.iconPacks as ExplorerThemeManifest['iconPacks']
      : undefined,
    renderStyles: Array.isArray(source.renderStyles)
      ? source.renderStyles as ExplorerThemeManifest['renderStyles']
      : undefined,
    defaultRenderStyleId: typeof source.defaultRenderStyleId === 'string'
      ? source.defaultRenderStyleId.trim()
      : undefined,
  };
}

async function readPackageManifest(directoryPath: string): Promise<{ manifestPath: string; manifest: OverlayThemePackageManifest } | null> {
  const candidates = themeSystemConfig.manifestNames.map(name => joinPlatformPath(directoryPath, name));

  for (const candidatePath of candidates) {
    try {
      const text = await commands.fsReadTextFile(candidatePath).then(unwrapTauriResult);
      return {
        manifestPath: candidatePath,
        manifest: parseThemeManifestText(text, candidatePath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveIconEntries(directoryPath: string, iconsDirectory: string, aliases: Record<string, string>): Promise<Record<string, string>> {
  const iconsPath = joinPlatformPath(directoryPath, normalizePackageAssetPath(iconsDirectory));
  const entries = await commands.fsListDir(iconsPath, false).then(unwrapTauriResult);
  const resolvedEntries = await Promise.all(
    entries
      .filter(entry => !entry.is_dir)
      .map(async entry => {
        const baseName = entry.name.replace(/\.[^.]+$/, '').toLowerCase();
        return [baseName, await toInlineAssetUrl(entry.path)] as const;
      }),
  );
  const resolved = Object.fromEntries(resolvedEntries);

  Object.entries(aliases).forEach(([alias, target]) => {
    const resolvedTarget = resolved[target.toLowerCase()];
    if (resolvedTarget) {
      resolved[alias.toLowerCase()] = resolvedTarget;
    }
  });

  return resolved;
}

async function resolvePackageIconTheme(
  directoryPath: string,
  iconThemePath: string,
): Promise<OverlayResolvedIconTheme> {
  const absolutePath = joinPlatformPath(directoryPath, iconThemePath);
  const text = await commands.fsReadTextFile(absolutePath).then(unwrapTauriResult);
  const manifest = parseIconThemeManifest(text);
  const resolvedIconEntries = await Promise.all(
    Object.entries(manifest.iconDefinitions ?? {}).map(async ([key, value]) => {
      const iconPath = typeof value === 'string' ? value : value?.iconPath;
      if (!iconPath?.trim()) {
        return null;
      }

      const absoluteIconPath = joinPlatformPath(
        directoryPath,
        normalizePackageAssetPath(iconPath),
      );
      return [key, await toInlineAssetUrl(absoluteIconPath)] as const;
    }),
  );
  const resolved = resolveIconThemeManifest(
    {
      ...manifest,
      iconDefinitions: Object.fromEntries(
        resolvedIconEntries.filter(
          (entry): entry is readonly [string, string] => Boolean(entry),
        ),
      ),
    },
    iconPath => iconPath,
  );
  return mergeResolvedIconThemes(getBuiltInIconTheme(), resolved);
}

function createRelativeFileEntry(directoryPath: string, relativePath: string): FileEntry {
  const normalizedPath = normalizePackageAssetPath(relativePath);
  const absolutePath = joinPlatformPath(directoryPath, normalizedPath);
  const pathSegments = normalizedPath.split(/[\\/]/).filter(Boolean);
  const fileName = pathSegments[pathSegments.length - 1] ?? normalizedPath;
  const extensionMatch = /\.([^.]+)$/.exec(fileName);
  return {
    name: fileName,
    path: absolutePath,
    is_dir: false,
    extension: extensionMatch?.[1]?.toLowerCase() ?? '',
    modified: 0,
  };
}

async function resolvePackageRuntimeEntries(
  directoryPath: string,
  explicitPaths: string[] | undefined,
  defaultDirectoryName: string,
  filterEntry: (entry: FileEntry) => boolean,
): Promise<FileEntry[]> {
  if (explicitPaths && explicitPaths.length > 0) {
    return explicitPaths
      .map(relativePath => createRelativeFileEntry(directoryPath, relativePath))
      .filter(filterEntry);
  }

  const runtimeDirectory = joinPlatformPath(directoryPath, defaultDirectoryName);
  try {
    const entries = await commands.fsListDir(runtimeDirectory, false).then(unwrapTauriResult);
    return entries.filter(entry => !entry.is_dir && filterEntry(entry));
  } catch {
    return [];
  }
}

function mergeVisualLayers(
  baseVisuals: OverlayThemeVisualLayer[] | undefined,
  packageVisuals: OverlayThemeVisualLayer[] | undefined,
): OverlayThemeVisualLayer[] | undefined {
  const next = [...(baseVisuals ?? []), ...(packageVisuals ?? [])].filter(layer => Boolean(layer?.backgroundImage));
  return next.length > 0 ? next : undefined;
}

function mergeThemeAssets(
  baseAssets: OverlayThemeAssets | undefined,
  packageAssets: OverlayThemeAssets | undefined,
): OverlayThemeAssets | undefined {
  if (!baseAssets && !packageAssets) {
    return undefined;
  }

  return {
    ...baseAssets,
    ...packageAssets,
    iconTheme: packageAssets?.iconTheme
      ? mergeResolvedIconThemes(
          baseAssets?.iconTheme ?? getBuiltInIconTheme(),
          packageAssets.iconTheme,
        )
      : baseAssets?.iconTheme,
    iconEntries: {
      ...(baseAssets?.iconEntries ?? {}),
      ...(packageAssets?.iconEntries ?? {}),
    },
  };
}

function buildThemeEngineManifest(
  packageId: string,
  packageName: string,
  manifest: OverlayThemePackageManifest,
): ExplorerThemeManifest | undefined {
  const hasEngineMetadata = Boolean(
    manifest.designTokens?.length
      || manifest.layoutPrimitives?.length
      || manifest.navigationPatterns?.length
      || manifest.animationProfiles?.length
      || manifest.iconPacks?.length
      || manifest.renderStyles?.length
      || manifest.defaultRenderStyleId,
  );
  if (!hasEngineMetadata) {
    return undefined;
  }

  return normalizeThemeManifestDraft({
    id: packageId,
    name: packageName,
    extends: manifest.extends || null,
    presentation: {
      density: manifest.presentation?.density ?? 'comfortable',
      chromeStyle: manifest.presentation?.chromeStyle ?? 'floating',
      iconStyle: manifest.presentation?.iconStyle ?? 'vector',
      motionStyle: manifest.presentation?.motionStyle ?? 'fluid',
      cornerRadius: manifest.presentation?.cornerRadius ?? 12,
      panelSpacing: manifest.presentation?.panelSpacing ?? 8,
    },
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
    defaultRenderStyleId: manifest.defaultRenderStyleId ?? null,
  });
}

async function buildPackageTheme(
  record: OverlayThemePackageRecord,
  packageMap: Map<string, OverlayThemePackageRecord>,
  cache: Map<string, OverlayThemeDefinition>,
  stack: string[] = [],
): Promise<OverlayThemeDefinition> {
  const packageId = derivePackageId(record);
  const cached = cache.get(packageId);
  if (cached) {
    return cached;
  }

  if (stack.includes(packageId)) {
    throw new Error(`Circular theme package extends chain: ${[...stack, packageId].join(' -> ')}`);
  }

  const builtInBase = overlayThemePresets.find(theme => theme.id === record.manifest.extends);
  let baseTheme = builtInBase ?? overlayThemePresets[0];

  if (!builtInBase && record.manifest.extends) {
    const extendedPackage = packageMap.get(record.manifest.extends);
    if (extendedPackage) {
      baseTheme = await buildPackageTheme(extendedPackage, packageMap, cache, [...stack, packageId]);
    }
  }

  const packageAssetsSource = record.manifest.assets;
  const backgroundPath = asString(packageAssetsSource?.background);
  const previewPath = asString(packageAssetsSource?.preview);
  const iconsDirectory = asString(packageAssetsSource?.iconsDirectory);
  const iconThemePath = asString(packageAssetsSource?.iconTheme);
  const iconAliases = packageAssetsSource?.iconAliases ?? {};
  let iconTheme: OverlayResolvedIconTheme | undefined;

  if (iconThemePath) {
    iconTheme = await resolvePackageIconTheme(record.directoryPath, iconThemePath);
  } else if (iconsDirectory) {
    const resolvedEntries = await resolveIconEntries(record.directoryPath, iconsDirectory, iconAliases);
    iconTheme = mergeResolvedIconThemes(
      getBuiltInIconTheme(),
      createResolvedIconThemeFromEntries(resolvedEntries),
    );
  }

  const resolvedAssets: OverlayThemeAssets = {
    packageRoot: record.directoryPath,
    manifestPath: record.manifestPath,
    backgroundUrl: backgroundPath
      ? toAssetUrl(joinPlatformPath(record.directoryPath, normalizePackageAssetPath(backgroundPath)))
      : undefined,
    previewUrl: previewPath
      ? toAssetUrl(joinPlatformPath(record.directoryPath, normalizePackageAssetPath(previewPath)))
      : undefined,
    iconTheme,
    iconEntries: iconTheme?.iconDefinitions,
  };

  const themePatch = record.manifest.theme ?? {};
  const backgroundImage = themePatch.effects?.backgroundImage
    ?? (resolvedAssets.backgroundUrl ? `url("${resolvedAssets.backgroundUrl}")` : undefined);
  const mergedTheme = normalizeThemeDefinition({
    ...baseTheme,
    ...themePatch,
    id: packageId,
    name: derivePackageName(record),
    description: asString(record.manifest.description) || themePatch.description || baseTheme.description,
    source: 'package',
    extendsThemeId: record.manifest.extends || baseTheme.id,
    palette: {
      ...baseTheme.palette,
      ...(themePatch.palette ?? {}),
    },
    effects: {
      ...baseTheme.effects,
      ...(themePatch.effects ?? {}),
      ...(backgroundImage ? { backgroundImage } : {}),
    },
    xterm: {
      ...baseTheme.xterm,
      ...(themePatch.xterm ?? {}),
    },
    fonts: {
      ...(baseTheme.fonts ?? {}),
      ...(themePatch.fonts ?? {}),
      ...(record.manifest.fonts ?? {}),
    },
    presentation: {
      ...(baseTheme.presentation ?? {}),
      ...(themePatch.presentation ?? {}),
      ...(record.manifest.presentation ?? {}),
    },
    assets: mergeThemeAssets(baseTheme.assets, resolvedAssets),
    visuals: mergeVisualLayers(baseTheme.visuals, record.manifest.visuals ?? themePatch.visuals),
    cssVars: {
      ...(baseTheme.cssVars ?? {}),
      ...(themePatch.cssVars ?? {}),
      ...(record.manifest.cssVars ?? {}),
    },
    compatibility: {
      ...(baseTheme.compatibility ?? {}),
      ...(themePatch.compatibility ?? {}),
      ...(record.manifest.compatibility ?? {}),
    },
  }, baseTheme);

  cache.set(packageId, mergedTheme);
  return mergedTheme;
}

export async function loadThemePackagesFromDirectoryEntries(
  directoryEntries: ThemePackageDirectoryEntry[],
  directoryLabel = themeSystemConfig.themesDirectory,
  options?: ThemePackageLoadOptions,
): Promise<ThemePackageLoadResult> {
  try {
    const packageRecords: OverlayThemePackageRecord[] = [];
    const shaders: LoadedOverlayShader[] = [];
    const animations: LoadedOverlayAnimation[] = [];
    const warnings: string[] = [];

    for (const entry of directoryEntries) {
      const manifest = await readPackageManifest(entry.path);
      if (!manifest) {
        continue;
      }

      packageRecords.push({
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath: manifest.manifestPath,
        manifest: manifest.manifest,
      });
    }

    const packageMap = new Map(packageRecords.map(record => [derivePackageId(record), record] as const));
    const cache = new Map<string, OverlayThemeDefinition>();
    const packages: LoadedOverlayThemePackage[] = [];

    for (const record of packageRecords) {
      const packageName = derivePackageName(record);
      const packageWarnings: string[] = [];

      try {
        const theme = await buildPackageTheme(record, packageMap, cache);
        const shaderEntries = await resolvePackageRuntimeEntries(
          record.directoryPath,
          record.manifest.contributions?.shaders,
          themeSystemConfig.packageShadersDirectoryName,
          isFrontendShaderFile,
        );
        const animationEntries = await resolvePackageRuntimeEntries(
          record.directoryPath,
          record.manifest.contributions?.animations,
          themeSystemConfig.packageAnimationsDirectoryName,
          isFrontendAnimationFile,
        );

        const packageShaders = (
          await Promise.all(shaderEntries.map(async entry => {
            try {
              const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
              return loadShaderFromSource(source, entry, {
                context: {
                  id: deriveShaderId(`${theme.id}-${entry.name}`),
                  name: deriveShaderName(`${theme.name} ${entry.name}`),
                  filePath: entry.path,
                  shaderRoot: record.directoryPath,
                  source: 'folder',
                },
              });
            } catch (error) {
              packageWarnings.push(`Shader ${entry.name}: ${String(error)}`);
              return null;
            }
          }))
        ).filter((entry): entry is LoadedOverlayShader => Boolean(entry));
        const packageAnimations = (
          await Promise.all(animationEntries.map(async entry => {
            try {
              const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
              return loadAnimationFromSource(source, entry, {
                context: {
                  id: deriveAnimationId(`${theme.id}-${entry.name}`),
                  name: deriveAnimationName(`${theme.name} ${entry.name}`),
                  filePath: entry.path,
                  animationRoot: record.directoryPath,
                  source: 'folder',
                },
              });
            } catch (error) {
              packageWarnings.push(`Animation ${entry.name}: ${String(error)}`);
              return null;
            }
          }))
        ).filter((entry): entry is LoadedOverlayAnimation => Boolean(entry));

        const engineManifest = buildThemeEngineManifest(theme.id, theme.name, record.manifest);

        packages.push({
          id: theme.id,
          name: theme.name,
          version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: options?.sourceKind ?? 'theme-directory',
          sourceLabel: options?.sourceLabel ?? record.directoryPath,
          description: asString(record.manifest.description) || theme.description,
          author: asString(record.manifest.author) || undefined,
          homepage: asString(record.manifest.homepage) || undefined,
          tags: record.manifest.tags ?? [],
          previewUrl: theme.assets?.previewUrl ?? theme.assets?.backgroundUrl,
          warnings: packageWarnings,
          capabilitySummary: {
            icons: Boolean(theme.assets?.iconTheme || theme.assets?.iconEntries),
            wallpaper: Boolean(theme.assets?.backgroundUrl),
            visuals: theme.visuals?.length ?? 0,
            shaders: packageShaders.length,
            animations: packageAnimations.length,
            fonts: [theme.fonts?.ui, theme.fonts?.mono].filter(Boolean).length,
          },
          theme,
          engineManifest,
          compiledEngineManifest: engineManifest ? compileThemeEngineManifest(engineManifest) : undefined,
        });
        shaders.push(...packageShaders);
        animations.push(...packageAnimations);
        warnings.push(...packageWarnings.map(warning => `${packageName}: ${warning}`));
      } catch (error) {
        warnings.push(`${packageName}: ${String(error)}`);
      }
    }

    packages.sort((left, right) => left.name.localeCompare(right.name));
    shaders.sort((left, right) => left.name.localeCompare(right.name));
    animations.sort((left, right) => left.name.localeCompare(right.name));

    return {
      packages,
      shaders,
      animations,
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packages: [],
      shaders: [],
      animations: [],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
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
    };
  }

  try {
    const rootEntries = await commands.fsListDir(directory, false).then(unwrapTauriResult);
    return loadThemePackagesFromDirectoryEntries(
      rootEntries.filter(entry => entry.is_dir).map(entry => ({ name: entry.name, path: entry.path })),
      directory,
    );
  } catch (error) {
    return {
      packages: [],
      shaders: [],
      animations: [],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
