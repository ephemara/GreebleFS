import { isTauri } from '@tauri-apps/api/core';

import {
  getManagedContentDirectory,
} from './appContentDirectories';
import {
  joinPlatformPath,
} from './platform';
import {
  resolveRuntimeAssetPollingEnabled,
} from './runtimeAssetPolling';
import {
  getBuiltInIconTheme,
  mergeResolvedIconThemes,
  parseIconThemeManifest,
  resolveIconThemeManifest,
  type OverlayResolvedIconTheme,
} from './iconTheme';
import {
  commands,
  unwrapTauriResult,
} from '../runtime/tauriClient';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

export interface LoadedIconThemePackage {
  id: string;
  name: string;
  version: number;
  description?: string;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'built-in' | 'icon-theme-directory';
  warnings: string[];
  iconTheme: OverlayResolvedIconTheme;
  capabilitySummary: {
    iconDefinitions: number;
    fileExtensions: number;
    fileNames: number;
    folderNames: number;
    folderNamesExpanded: number;
    uiIcons: number;
  };
}

export interface IconThemePackageLoadResult {
  packages: LoadedIconThemePackage[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

interface IconThemePackageRecord {
  fileName: string;
  directoryPath: string;
  manifestPath: string;
}

export const iconThemeSystemConfig = {
  get iconThemesDirectory(): string {
    return getManagedContentDirectory('iconThemes');
  },
  manifestNames: ['icon-theme.json', 'manifest.json'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

function normalizePackageAssetPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isWebAssetPath(path: string): boolean {
  return /^(\/|data:|blob:|https?:|asset:)/i.test(path);
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }
  return normalized.slice(0, lastSlash);
}

function buildCapabilitySummary(iconTheme: OverlayResolvedIconTheme): LoadedIconThemePackage['capabilitySummary'] {
  return {
    iconDefinitions: Object.keys(iconTheme.iconDefinitions).length,
    fileExtensions: Object.keys(iconTheme.fileExtensions).length,
    fileNames: Object.keys(iconTheme.fileNames).length,
    folderNames: Object.keys(iconTheme.folderNames).length,
    folderNamesExpanded: Object.keys(iconTheme.folderNamesExpanded).length,
    uiIcons: Object.keys(iconTheme.uiIcons).length,
  };
}

function createBuiltInIconThemePackage(): LoadedIconThemePackage {
  const builtInIconTheme = getBuiltInIconTheme();
  return {
    id: builtInIconTheme.id,
    name: builtInIconTheme.name,
    version: builtInIconTheme.version,
    description: builtInIconTheme.description,
    directoryPath: iconThemeSystemConfig.iconThemesDirectory,
    manifestPath: 'built-in',
    sourceKind: 'built-in',
    warnings: [],
    iconTheme: builtInIconTheme,
    capabilitySummary: buildCapabilitySummary(builtInIconTheme),
  };
}

async function resolveIconAssetUrl(path: string): Promise<string> {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return trimmedPath;
  }

  if (isWebAssetPath(trimmedPath)) {
    return trimmedPath;
  }

  const base64 = await commands.fsReadFileBase64(trimmedPath).then(unwrapTauriResult);
  const extension = trimmedPath.split('.').pop()?.toLowerCase();
  const mimeType = extension === 'svg'
    ? 'image/svg+xml'
    : extension === 'png'
      ? 'image/png'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'webp'
          ? 'image/webp'
          : 'application/octet-stream';
  return `data:${mimeType};base64,${base64}`;
}

async function buildLoadedIconThemePackage(record: IconThemePackageRecord): Promise<LoadedIconThemePackage> {
  const text = await commands.fsReadTextFile(record.manifestPath).then(unwrapTauriResult);
  const manifest = parseIconThemeManifest(text);
  const resolvedEntries = await Promise.all(
    Object.entries(manifest.iconDefinitions ?? {}).map(async ([iconId, definition]) => {
      const iconPath = typeof definition === 'string' ? definition : definition?.iconPath;
      if (!iconPath?.trim()) {
        return null;
      }

      const normalizedIconPath = normalizePackageAssetPath(iconPath);
      const resolvedIconPath = isWebAssetPath(normalizedIconPath)
        ? normalizedIconPath
        : joinPlatformPath(record.directoryPath, normalizedIconPath);
      return [iconId, await resolveIconAssetUrl(resolvedIconPath)] as const;
    }),
  );

  const resolvedIconTheme = mergeResolvedIconThemes(
    getBuiltInIconTheme(),
    resolveIconThemeManifest(
      {
        ...manifest,
        iconDefinitions: Object.fromEntries(
          resolvedEntries.filter(
            (entry): entry is readonly [string, string] => Boolean(entry),
          ),
        ),
      },
      iconPath => iconPath,
    ),
  );

  return {
    id: resolvedIconTheme.id,
    name: resolvedIconTheme.name,
    version: resolvedIconTheme.version,
    description: resolvedIconTheme.description,
    directoryPath: record.directoryPath,
    manifestPath: record.manifestPath,
    sourceKind: 'icon-theme-directory',
    warnings: [],
    iconTheme: resolvedIconTheme,
    capabilitySummary: buildCapabilitySummary(resolvedIconTheme),
  };
}

async function readPackageRecord(entry: FileEntry): Promise<IconThemePackageRecord | null> {
  if (!entry.is_dir) {
    const isJsonManifest = entry.extension.toLowerCase() === 'json';
    if (!isJsonManifest) {
      return null;
    }

    return {
      fileName: entry.name,
      directoryPath: getParentDirectoryPath(entry.path),
      manifestPath: entry.path,
    };
  }

  for (const manifestName of iconThemeSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        fileName: entry.name,
        directoryPath: entry.path,
        manifestPath,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadIconThemePackagesFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = iconThemeSystemConfig.iconThemesDirectory,
): Promise<IconThemePackageLoadResult> {
  try {
    const loadedPackages: LoadedIconThemePackage[] = [
      createBuiltInIconThemePackage(),
    ];
    const warnings: string[] = [];

    for (const entry of directoryEntries) {
      const record = await readPackageRecord(entry);
      if (!record) {
        continue;
      }

      try {
        loadedPackages.push(await buildLoadedIconThemePackage(record));
      } catch (error) {
        warnings.push(`${record.fileName}: ${String(error)}`);
      }
    }

    const uniquePackages = new Map<string, LoadedIconThemePackage>();
    for (const packageRecord of loadedPackages) {
      if (packageRecord.sourceKind === 'built-in' || !uniquePackages.has(packageRecord.id)) {
        uniquePackages.set(packageRecord.id, packageRecord);
      }
    }

    const packages = [...uniquePackages.values()].sort((left, right) => {
      if (left.sourceKind === 'built-in' && right.sourceKind !== 'built-in') {
        return -1;
      }
      if (left.sourceKind !== 'built-in' && right.sourceKind === 'built-in') {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });

    return {
      packages,
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packages: [createBuiltInIconThemePackage()],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadIconThemePackages(): Promise<IconThemePackageLoadResult> {
  const directory = iconThemeSystemConfig.iconThemesDirectory;
  if (!isTauri()) {
    return {
      packages: [createBuiltInIconThemePackage()],
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const rootEntries = await commands.fsListDir(directory, false).then(unwrapTauriResult);
    return loadIconThemePackagesFromDirectoryEntries(rootEntries, directory);
  } catch (error) {
    return {
      packages: [createBuiltInIconThemePackage()],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
