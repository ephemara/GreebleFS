import { isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import {
  createLoadedExplorerHomePackRuntime,
  loadExplorerHomePackFromSource,
  normalizeExplorerHomePackPresets,
  type ExplorerHomePackModuleLayout,
  type ExplorerHomePackPresetDefinition,
  type LoadedExplorerHomePackRuntime,
  type RuntimeFileEntry,
  type RuntimeRelativeModuleSourceResolver,
} from '../components/home/homePackRuntime';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

const homePackRuntimeModuleExtensions = ['ts', 'tsx', 'js', 'jsx'] as const;

export interface ExplorerHomePackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  defaultPresetId?: string;
  presets?: ExplorerHomePackPresetDefinition[];
  modules?: ExplorerHomePackModuleLayout[];
  homePack?: {
    entryModule?: string;
    apiVersion?: number;
    supportsLiveSwap?: boolean;
  };
}

interface ExplorerHomePackRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: ExplorerHomePackManifest;
}

export interface LoadedExplorerHomePack {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'home-pack-directory' | 'built-in';
  sourceLabel: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
  runtime: LoadedExplorerHomePackRuntime;
}

export interface ExplorerHomePackLoadResult {
  packs: LoadedExplorerHomePack[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export const homePackSystemConfig = {
  get homePacksDirectory(): string {
    return getManagedContentDirectory('homePacks');
  },
  manifestNames: ['home.json', 'home.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

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

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map(entry => entry.trim());
}

function normalizePackageRuntimeModulePath(path: string): string | null {
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

function normalizePackageComparisonPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/g, '');
}

function getPackageRelativePath(directoryPath: string, filePath: string): string | null {
  const normalizedDirectoryPath = normalizePackageComparisonPath(directoryPath);
  const normalizedFilePath = normalizePackageComparisonPath(filePath);
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

function resolvePackageRuntimeModuleImportPath(
  fromModuleRelativePath: string,
  specifier: string,
): string | null {
  const importerSegments = fromModuleRelativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  importerSegments.pop();
  const specifierSegments = specifier.replace(/\\/g, '/').split('/');
  return normalizePackageRuntimeModulePath(
    [...importerSegments, ...specifierSegments].join('/'),
  );
}

function buildPackageRuntimeModuleCandidates(relativePath: string): string[] {
  const normalizedRelativePath = normalizePackageRuntimeModulePath(relativePath);
  if (!normalizedRelativePath) {
    return [];
  }

  const candidates = new Set<string>();
  if (/\.[^./]+$/.test(normalizedRelativePath)) {
    candidates.add(normalizedRelativePath);
  } else {
    for (const extension of homePackRuntimeModuleExtensions) {
      candidates.add(`${normalizedRelativePath}.${extension}`);
      candidates.add(`${normalizedRelativePath}/index.${extension}`);
    }
  }

  return [...candidates];
}

function parseModuleLayout(value: unknown, fallbackId: string): ExplorerHomePackModuleLayout | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }

  const moduleId = asString(source.moduleId);
  if (!moduleId) {
    return null;
  }

  return {
    id: asString(source.id, fallbackId),
    moduleId,
    title: asString(source.title) || undefined,
    description: asString(source.description) || undefined,
    style: source.style as ExplorerHomePackModuleLayout['style'],
    limit: typeof source.limit === 'number' && Number.isFinite(source.limit)
      ? Math.max(1, Math.trunc(source.limit))
      : undefined,
    prominence: source.prominence as ExplorerHomePackModuleLayout['prominence'],
  };
}

function parsePresetDefinition(value: unknown, fallbackId: string): ExplorerHomePackPresetDefinition | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }

  const presetId = asString(source.id, fallbackId);
  const modules = Array.isArray(source.modules)
    ? source.modules
      .map((module, index) => parseModuleLayout(module, `${presetId}-module-${index + 1}`))
      .filter((module): module is ExplorerHomePackModuleLayout => module != null)
    : [];
  if (modules.length === 0) {
    return null;
  }

  return {
    id: presetId,
    name: asString(source.name, presetId),
    description: asString(source.description) || undefined,
    modules,
  };
}

function parseHomePackManifestText(text: string, filePath: string): ExplorerHomePackManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Home-pack manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Home-pack manifest must be an object: ${filePath}`);
  }

  const explicitPresets = Array.isArray(source.presets)
    ? source.presets
      .map((preset, index) => parsePresetDefinition(preset, `preset-${index + 1}`))
      .filter((preset): preset is ExplorerHomePackPresetDefinition => preset != null)
    : [];
  const rootModules = Array.isArray(source.modules)
    ? source.modules
      .map((module, index) => parseModuleLayout(module, `root-module-${index + 1}`))
      .filter((module): module is ExplorerHomePackModuleLayout => module != null)
    : [];
  const presets = explicitPresets.length > 0
    ? explicitPresets
    : rootModules.length > 0
      ? [{
          id: 'default',
          name: 'Default',
          modules: rootModules,
        }]
      : [];
  const homePackSource = asRecord(source.homePack);

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    defaultPresetId: asString(source.defaultPresetId),
    presets,
    homePack: homePackSource
      ? {
          entryModule: asString(homePackSource.entryModule),
          apiVersion: typeof homePackSource.apiVersion === 'number' ? homePackSource.apiVersion : undefined,
          supportsLiveSwap: homePackSource.supportsLiveSwap === true,
        }
      : undefined,
  };
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }

  return normalized.slice(0, lastSlash);
}

function deriveHomePackId(record: ExplorerHomePackRecord): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return explicitId;
  }

  return record.directoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'home-pack';
}

function deriveHomePackName(record: ExplorerHomePackRecord, packId: string): string {
  return asString(record.manifest.name)
    || packId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

async function readHomePackRecord(entry: FileEntry): Promise<ExplorerHomePackRecord | null> {
  if (!entry.is_dir) {
    const lowerName = entry.name.toLowerCase();
    const isManifestFile = lowerName.endsWith('.json') || lowerName.endsWith('.toml');
    if (!isManifestFile) {
      return null;
    }

    const manifestText = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
    return {
      directoryName: entry.name.replace(/\.[^.]+$/, ''),
      directoryPath: getParentDirectoryPath(entry.path),
      manifestPath: entry.path,
      manifest: parseHomePackManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of homePackSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseHomePackManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function createHomePackRelativeModuleSourceResolver(
  directoryPath: string,
): RuntimeRelativeModuleSourceResolver {
  return async ({ fromModulePath, specifier }) => {
    const fromModuleRelativePath = getPackageRelativePath(directoryPath, fromModulePath);
    if (fromModuleRelativePath == null) {
      return null;
    }

    const resolvedImportPath = resolvePackageRuntimeModuleImportPath(fromModuleRelativePath, specifier);
    if (!resolvedImportPath) {
      return null;
    }

    for (const candidateRelativePath of buildPackageRuntimeModuleCandidates(resolvedImportPath)) {
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

function createRelativeRuntimeFileEntry(
  directoryPath: string,
  relativePath: string,
): RuntimeFileEntry {
  const normalizedRelativePath = normalizePackageRuntimeModulePath(relativePath) ?? relativePath;
  const extension = normalizedRelativePath.split('.').pop() ?? '';
  return {
    name: normalizedRelativePath.split('/').pop() ?? normalizedRelativePath,
    path: joinPlatformPath(directoryPath, normalizedRelativePath),
    is_dir: false,
    modified: 0,
    extension,
  };
}

export async function loadExplorerHomePacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = homePackSystemConfig.homePacksDirectory,
): Promise<ExplorerHomePackLoadResult> {
  try {
    const packs: LoadedExplorerHomePack[] = [];
    const warnings: string[] = [];

    for (const entry of [...directoryEntries].sort((left, right) => left.name.localeCompare(right.name))) {
      try {
        const record = await readHomePackRecord(entry);
        if (!record) {
          continue;
        }

        const packId = deriveHomePackId(record);
        const packName = deriveHomePackName(record, packId);
        const packWarnings: string[] = [];
        const runtimeDefaults = {
          id: packId,
          name: packName,
          description: record.manifest.description,
          apiVersion: record.manifest.homePack?.apiVersion,
          supportsLiveSwap: record.manifest.homePack?.supportsLiveSwap,
          defaultPresetId: record.manifest.defaultPresetId || null,
          presets: normalizeExplorerHomePackPresets(record.manifest.presets),
        };

        let runtime = createLoadedExplorerHomePackRuntime({}, {
          id: packId,
          name: packName,
          filePath: record.manifestPath,
          packRoot: record.directoryPath,
          entryModule: record.manifest.homePack?.entryModule ?? 'manifest',
        }, {
          defaults: runtimeDefaults,
        });

        const entryModule = record.manifest.homePack?.entryModule;
        if (entryModule) {
          try {
            const runtimeEntry = createRelativeRuntimeFileEntry(record.directoryPath, entryModule);
            const source = await commands.fsReadTextFile(runtimeEntry.path).then(unwrapTauriResult);
            runtime = await loadExplorerHomePackFromSource(source, runtimeEntry, {
              context: {
                id: packId,
                name: packName,
                filePath: runtimeEntry.path,
                packRoot: record.directoryPath,
                entryModule,
              },
              defaults: runtimeDefaults,
              resolveRelativeModuleSource: createHomePackRelativeModuleSourceResolver(record.directoryPath),
            });
          } catch (error) {
            packWarnings.push(`Home renderer ${entryModule}: ${String(error)}`);
          }
        }

        if (runtime.error) {
          packWarnings.push(runtime.error);
        }

        if (runtime.component == null && runtime.presets.length === 0) {
          packWarnings.push('Pack does not define a renderer or any preset modules.');
        }

        packs.push({
          id: packId,
          name: packName,
          version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: 'home-pack-directory',
          sourceLabel: 'home-packs',
          description: record.manifest.description || undefined,
          author: record.manifest.author || undefined,
          homepage: record.manifest.homepage || undefined,
          tags: record.manifest.tags ?? [],
          warnings: packWarnings,
          runtime,
        });
        warnings.push(...packWarnings.map(warning => `${packName}: ${warning}`));
      } catch (error) {
        warnings.push(`${entry.name}: ${String(error)}`);
      }
    }

    packs.sort((left, right) => left.name.localeCompare(right.name));

    return {
      packs,
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packs: [],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadExplorerHomePacks(): Promise<ExplorerHomePackLoadResult> {
  const directory = homePackSystemConfig.homePacksDirectory;
  if (!isTauri()) {
    return {
      packs: [],
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const entries = await commands.fsListDir(directory).then(unwrapTauriResult);
    return loadExplorerHomePacksFromDirectoryEntries(entries, directory);
  } catch (error) {
    return {
      packs: [],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
