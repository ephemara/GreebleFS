import { isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import {
  getManagedContentDirectory,
  getManagedContentDirectorySearchDirectories,
  getManagedContentPrimaryDirectory,
  type ManagedContentDirectoryId,
} from './appContentDirectories';
import { joinPlatformPath } from './platform';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import { listLocalDirectoryEntriesFast } from '../runtime/localDirectoryListing';

export interface ManagedContentStackFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

export interface ManagedContentDirectoryLoadResult<TPackage> {
  packages: TPackage[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export interface ManagedContentStackManifestRecord<
  TManifest extends Record<string, unknown> = Record<string, unknown>,
> {
  packageId: string;
  packageDirectory: string;
  manifestPath: string;
  manifestName: string;
  manifest: TManifest;
}

export async function loadManagedContentPackagesFromDirectoryStack<TPackage>(options: {
  directoryId: ManagedContentDirectoryId;
  loadFromDirectoryEntries: (
    directoryEntries: ManagedContentStackFileEntry[],
    directoryLabel: string,
  ) => Promise<ManagedContentDirectoryLoadResult<TPackage>>;
  getPackageId: (pkg: TPackage) => string;
}): Promise<ManagedContentDirectoryLoadResult<TPackage>> {
  const fallbackDirectory = getManagedContentDirectory(options.directoryId);
  if (!isTauri()) {
    return {
      packages: [],
      directory: fallbackDirectory,
      warnings: [],
      sourceError: null,
    };
  }

  const searchDirectories = getManagedContentDirectorySearchDirectories(options.directoryId);
  const mergedPackages = new Map<string, TPackage>();
  const warnings: string[] = [];
  const sourceErrors: string[] = [];

  for (const directory of searchDirectories) {
    try {
      const directoryEntries = (await listLocalDirectoryEntriesFast(directory)) as ManagedContentStackFileEntry[];
      const result = await options.loadFromDirectoryEntries(directoryEntries, directory);
      warnings.push(...result.warnings);
      if (result.sourceError) {
        sourceErrors.push(`${directory}: ${result.sourceError}`);
      }

      for (const pkg of result.packages) {
        const packageId = options.getPackageId(pkg).trim();
        if (!packageId || mergedPackages.has(packageId)) {
          continue;
        }
        mergedPackages.set(packageId, pkg);
      }
    } catch (error) {
      sourceErrors.push(`${directory}: ${String(error)}`);
    }
  }

  return {
    packages: [...mergedPackages.values()],
    directory: searchDirectories[0] ?? fallbackDirectory,
    warnings,
    sourceError:
      mergedPackages.size === 0 && sourceErrors.length > 0
        ? sourceErrors.join('\n')
        : null,
  };
}

function normalizeManagedContentManifestRecord(
  value: unknown,
): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function parseManagedContentManifestText(
  manifestText: string,
  manifestPath: string,
): Record<string, unknown> {
  const lowerPath = manifestPath.toLowerCase();
  try {
    if (lowerPath.endsWith('.toml')) {
      return normalizeManagedContentManifestRecord(parseToml(manifestText));
    }
    return normalizeManagedContentManifestRecord(JSON.parse(manifestText));
  } catch (error) {
    throw new Error(
      `Failed to parse managed-content manifest at ${manifestPath}: ${String(error)}`,
    );
  }
}

async function readManagedContentManifestRecord(
  entry: ManagedContentStackFileEntry,
  manifestNames: readonly string[],
): Promise<ManagedContentStackManifestRecord | null> {
  if (!entry.is_dir) {
    const matchingManifestName = manifestNames.find(
      (manifestName) => manifestName.toLowerCase() === entry.name.toLowerCase(),
    );
    if (!matchingManifestName) {
      return null;
    }

    const manifestText = await commands
      .fsReadTextFile(entry.path)
      .then(unwrapTauriResult);
    return {
      packageId: entry.name.replace(/\.[^.]+$/, ''),
      packageDirectory: entry.path,
      manifestPath: entry.path,
      manifestName: matchingManifestName,
      manifest: parseManagedContentManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands
        .fsReadTextFile(manifestPath)
        .then(unwrapTauriResult);
      return {
        packageId: entry.name,
        packageDirectory: entry.path,
        manifestPath,
        manifestName,
        manifest: parseManagedContentManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadManagedContentManifestsFromDirectoryStack<
  TManifest extends Record<string, unknown> = Record<string, unknown>,
>(options: {
  directoryId: ManagedContentDirectoryId;
  manifestNames: readonly string[];
}): Promise<ManagedContentDirectoryLoadResult<ManagedContentStackManifestRecord<TManifest>>> {
  const fallbackDirectory = getManagedContentDirectory(options.directoryId);
  if (!isTauri()) {
    return {
      packages: [],
      directory: fallbackDirectory,
      warnings: [],
      sourceError: null,
    };
  }

  const searchDirectories = getManagedContentDirectorySearchDirectories(
    options.directoryId,
  );
  const mergedManifestRecords = new Map<
    string,
    ManagedContentStackManifestRecord<TManifest>
  >();
  const warnings: string[] = [];
  const sourceErrors: string[] = [];

  for (const directory of searchDirectories) {
    try {
      const directoryEntries = (await listLocalDirectoryEntriesFast(directory)) as ManagedContentStackFileEntry[];

      for (const directoryEntry of directoryEntries) {
        try {
          const manifestRecord = await readManagedContentManifestRecord(
            directoryEntry,
            options.manifestNames,
          );
          if (!manifestRecord) {
            continue;
          }

          const packageId = manifestRecord.packageId.trim();
          if (!packageId || mergedManifestRecords.has(packageId)) {
            continue;
          }

          mergedManifestRecords.set(
            packageId,
            manifestRecord as ManagedContentStackManifestRecord<TManifest>,
          );
        } catch (error) {
          warnings.push(
            `${directoryEntry.path}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      sourceErrors.push(`${directory}: ${String(error)}`);
    }
  }

  return {
    packages: [...mergedManifestRecords.values()],
    directory: searchDirectories[0] ?? fallbackDirectory,
    warnings,
    sourceError:
      mergedManifestRecords.size === 0 && sourceErrors.length > 0
        ? sourceErrors.join('\n')
        : null,
  };
}

export async function buildManagedContentDirectoryStackSignature(
  directoryId: ManagedContentDirectoryId,
): Promise<string> {
  const signatureParts: string[] = [];
  for (const directory of getManagedContentDirectorySearchDirectories(directoryId)) {
    try {
      const directoryEntries = (await listLocalDirectoryEntriesFast(directory)) as ManagedContentStackFileEntry[];
      const directorySignature = directoryEntries
        .map(
          (entry) =>
            `${entry.path}:${entry.modified}:${entry.is_dir ? 'dir' : 'file'}`,
        )
        .sort()
        .join('|');
      signatureParts.push(`${directory}::${directorySignature}`);
    } catch {
      signatureParts.push(`${directory}::missing`);
    }
  }

  return signatureParts.join('||');
}

export function getManagedContentWritableDirectory(
  directoryId: ManagedContentDirectoryId,
): string {
  return getManagedContentPrimaryDirectory(directoryId);
}
