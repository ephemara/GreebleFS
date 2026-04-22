import { isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import {
  createLoadedTopBarDefinition,
  type LoadedOverlayTopBarDefinition,
  type OverlayTopBarDefinition,
} from './topBars';
import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

export interface OverlayTopBarPackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  topBar?: OverlayTopBarDefinition;
  topBars?: OverlayTopBarDefinition[];
}

interface OverlayTopBarPackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: OverlayTopBarPackageManifest;
}

export interface LoadedOverlayTopBarPackage {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'top-bar-directory';
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
  topBars: LoadedOverlayTopBarDefinition[];
}

export interface TopBarPackageLoadResult {
  packages: LoadedOverlayTopBarPackage[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export const topBarSystemConfig = {
  get topBarsDirectory(): string {
    return getManagedContentDirectory('topBars');
  },
  manifestNames: ['top-bar.json', 'top-bar.toml', 'manifest.json', 'manifest.toml'] as const,
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

function parseLooseTopBarDefinition(source: LooseRecord): OverlayTopBarDefinition {
  return {
    id: asString(source.id) || undefined,
    name: asString(source.name) || undefined,
    description: asString(source.description) || undefined,
    topBarStyle: source.topBarStyle as OverlayTopBarDefinition['topBarStyle'],
    tabStyle: source.tabStyle as OverlayTopBarDefinition['tabStyle'],
    navigationMode: source.navigationMode as OverlayTopBarDefinition['navigationMode'],
    leadingControls: Array.isArray(source.leadingControls)
      ? source.leadingControls as OverlayTopBarDefinition['leadingControls']
      : undefined,
    navigationShortcuts: Array.isArray(source.navigationShortcuts)
      ? source.navigationShortcuts as OverlayTopBarDefinition['navigationShortcuts']
      : undefined,
    trailingControls: Array.isArray(source.trailingControls)
      ? source.trailingControls as OverlayTopBarDefinition['trailingControls']
      : undefined,
    tags: asStringArray(source.tags),
  };
}

function hasTopBarDefinitionFields(source: LooseRecord): boolean {
  return [
    'id',
    'name',
    'description',
    'tags',
    'topBarStyle',
    'tabStyle',
    'navigationMode',
    'leadingControls',
    'navigationShortcuts',
    'trailingControls',
    'topBar',
    'topBars',
  ].some(key => key in source);
}

function parseTopBarManifestText(
  text: string,
  filePath: string,
): OverlayTopBarPackageManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Top-bar manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Top-bar manifest must be an object: ${filePath}`);
  }

  const nestedTopBar = asRecord(source.topBar);
  const explicitTopBars = Array.isArray(source.topBars)
    ? source.topBars
      .map(entry => asRecord(entry))
      .filter((entry): entry is LooseRecord => Boolean(entry))
      .map(parseLooseTopBarDefinition)
    : [];
  const shorthandTopBars = explicitTopBars.length === 0 && !nestedTopBar && hasTopBarDefinitionFields(source)
    ? [parseLooseTopBarDefinition(source)]
    : [];
  const topBars = explicitTopBars.length > 0
    ? explicitTopBars
    : nestedTopBar
      ? [parseLooseTopBarDefinition(nestedTopBar)]
      : shorthandTopBars;

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    topBar: nestedTopBar ? parseLooseTopBarDefinition(nestedTopBar) : undefined,
    topBars,
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

function deriveTopBarPackageId(record: OverlayTopBarPackageRecord): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return explicitId;
  }

  return record.directoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'top-bar-package';
}

function deriveTopBarPackageName(record: OverlayTopBarPackageRecord, packageId: string): string {
  return asString(record.manifest.name)
    || packageId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

async function readTopBarPackageRecord(entry: FileEntry): Promise<OverlayTopBarPackageRecord | null> {
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
      manifest: parseTopBarManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of topBarSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseTopBarManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildPackageTopBars(
  record: OverlayTopBarPackageRecord,
  packageId: string,
  packageName: string,
): { topBars: LoadedOverlayTopBarDefinition[]; warnings: string[] } {
  const dedupedTopBars = new Map<string, LoadedOverlayTopBarDefinition>();
  const warnings: string[] = [];

  for (const definition of record.manifest.topBars ?? []) {
    const loadedTopBar = createLoadedTopBarDefinition(definition, {
      source: 'top-bar-package',
      sourceLabel: packageName,
      sourcePackageId: packageId,
      scopeId: packageId,
    });

    if (dedupedTopBars.has(loadedTopBar.id)) {
      warnings.push(`Duplicate top bar id "${loadedTopBar.localId}" in ${record.manifestPath}; keeping the first definition.`);
      continue;
    }

    dedupedTopBars.set(loadedTopBar.id, loadedTopBar);
  }

  return {
    topBars: Array.from(dedupedTopBars.values()),
    warnings,
  };
}

export async function loadTopBarPackagesFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = topBarSystemConfig.topBarsDirectory,
): Promise<TopBarPackageLoadResult> {
  try {
    const packages: LoadedOverlayTopBarPackage[] = [];
    const warnings: string[] = [];

    for (const entry of [...directoryEntries].sort((left, right) => left.name.localeCompare(right.name))) {
      try {
        const record = await readTopBarPackageRecord(entry);
        if (!record) {
          continue;
        }

        const packageId = deriveTopBarPackageId(record);
        const packageName = deriveTopBarPackageName(record, packageId);
        const { topBars, warnings: packageWarnings } = buildPackageTopBars(record, packageId, packageName);

        if (topBars.length === 0) {
          warnings.push(`${packageName}: manifest does not define any top bars.`);
          continue;
        }

        packages.push({
          id: packageId,
          name: packageName,
          version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: 'top-bar-directory',
          description: asString(record.manifest.description) || undefined,
          author: asString(record.manifest.author) || undefined,
          homepage: asString(record.manifest.homepage) || undefined,
          tags: record.manifest.tags ?? [],
          warnings: packageWarnings,
          topBars,
        });
        warnings.push(...packageWarnings.map(warning => `${packageName}: ${warning}`));
      } catch (error) {
        warnings.push(`${entry.name}: ${String(error)}`);
      }
    }

    packages.sort((left, right) => left.name.localeCompare(right.name));

    return {
      packages,
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packages: [],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadTopBarPackages(): Promise<TopBarPackageLoadResult> {
  const directory = topBarSystemConfig.topBarsDirectory;
  if (!isTauri()) {
    return {
      packages: [],
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const entries = await commands.fsListDir(directory).then(unwrapTauriResult);
    return loadTopBarPackagesFromDirectoryEntries(entries, directory);
  } catch (error) {
    return {
      packages: [],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
