import { joinPluginFoundryPath } from './scaffold';

export interface PluginFoundryRegistryRecord {
  lane: 'plugins' | 'packages';
  id: string;
  name: string;
  path: string;
  manifestPath: string | null;
  packageKind: 'plugin' | 'library' | 'runtime';
  sourceVisibility: 'open' | 'hybrid' | 'compiled' | 'private';
  description?: string;
  category?: string;
  moduleExports: string[];
  dependencies: Array<{
    id: string;
    importAs?: string;
  }>;
}

type FileOpsLike = {
  listDirectory: (path: string, showHidden?: boolean) => Promise<{ entries?: unknown[] } | unknown>;
  readText: (path: string) => Promise<string>;
};

type DirectoryEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

export async function discoverPluginFoundryRegistry(
  fileOps: FileOpsLike,
  usrRoot: string,
): Promise<PluginFoundryRegistryRecord[]> {
  const records = await Promise.all([
    scanRegistryLane(fileOps, joinPluginFoundryPath(usrRoot, 'plugins'), 'plugins'),
    scanRegistryLane(fileOps, joinPluginFoundryPath(usrRoot, 'packages'), 'packages'),
  ]);
  return records
    .flat()
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function scanRegistryLane(
  fileOps: FileOpsLike,
  laneRoot: string,
  lane: 'plugins' | 'packages',
): Promise<PluginFoundryRegistryRecord[]> {
  let listing: unknown;
  try {
    listing = await fileOps.listDirectory(laneRoot, false);
  } catch {
    return [];
  }

  const entries = extractDirectoryEntries(listing);
  const records = await Promise.all(entries.map(async (entry) => {
    const extensionManifestPath = joinPluginFoundryPath(entry.path, 'extension.toml');
    const legacyManifestPath = joinPluginFoundryPath(entry.path, 'plugin.json');

    try {
      const manifestText = await fileOps.readText(extensionManifestPath);
      return parseTomlRegistryRecord({
        lane,
        entry,
        manifestPath: extensionManifestPath,
        manifestText,
      });
    } catch {
      try {
        const manifestText = await fileOps.readText(legacyManifestPath);
        return parseLegacyRegistryRecord({
          lane,
          entry,
          manifestPath: legacyManifestPath,
          manifestText,
        });
      } catch {
        return createFallbackRegistryRecord(lane, entry);
      }
    }
  }));

  return records;
}

function extractDirectoryEntries(listing: unknown): DirectoryEntry[] {
  const entries = Array.isArray((listing as { entries?: unknown[] } | null)?.entries)
    ? (listing as { entries: unknown[] }).entries
    : Array.isArray(listing)
      ? listing
      : [];

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : '';
    const path = typeof record.path === 'string' ? record.path : '';
    const isDirectory = record.isDirectory === true || record.is_dir === true;
    if (!name || !path || !isDirectory) {
      return [];
    }
    return [{
      name,
      path,
      isDirectory,
    }];
  });
}

function parseTomlRegistryRecord(options: {
  lane: 'plugins' | 'packages';
  entry: DirectoryEntry;
  manifestPath: string;
  manifestText: string;
}): PluginFoundryRegistryRecord {
  const id = readTomlStringField(options.manifestText, 'id') || sanitizeFallbackId(options.entry.name);
  const name = readTomlStringField(options.manifestText, 'name') || titleCase(options.entry.name);
  return {
    lane: options.lane,
    id,
    name,
    path: options.entry.path,
    manifestPath: options.manifestPath,
    packageKind: readTomlPackageKind(options.manifestText),
    sourceVisibility: readTomlSourceVisibility(options.manifestText, options.lane),
    description: readTomlStringField(options.manifestText, 'description') || undefined,
    category: readTomlStringField(options.manifestText, 'category') || undefined,
    moduleExports: readTomlExportModules(options.manifestText),
    dependencies: readTomlDependencies(options.manifestText),
  };
}

function parseLegacyRegistryRecord(options: {
  lane: 'plugins' | 'packages';
  entry: DirectoryEntry;
  manifestPath: string;
  manifestText: string;
}): PluginFoundryRegistryRecord {
  try {
    const parsed = JSON.parse(options.manifestText) as Record<string, unknown>;
    return {
      lane: options.lane,
      id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : sanitizeFallbackId(options.entry.name),
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : titleCase(options.entry.name),
      path: options.entry.path,
      manifestPath: options.manifestPath,
      packageKind: parsed.packageKind === 'library' || parsed.packageKind === 'runtime'
        ? parsed.packageKind
        : 'plugin',
      sourceVisibility: readLegacySourceVisibility(parsed, options.lane),
      description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : undefined,
      category: typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : undefined,
      moduleExports: extractLegacyModuleExports(parsed),
      dependencies: extractLegacyDependencies(parsed),
    };
  } catch {
    return createFallbackRegistryRecord(options.lane, options.entry);
  }
}

function createFallbackRegistryRecord(
  lane: 'plugins' | 'packages',
  entry: DirectoryEntry,
): PluginFoundryRegistryRecord {
  return {
    lane,
    id: sanitizeFallbackId(entry.name),
    name: titleCase(entry.name),
    path: entry.path,
    manifestPath: null,
    packageKind: lane === 'packages' ? 'library' : 'plugin',
    sourceVisibility: lane === 'packages' ? 'open' : 'private',
    moduleExports: [],
    dependencies: [],
  };
}

function readTomlStringField(sourceText: string, fieldName: string): string {
  const match = sourceText.match(new RegExp(`^\\s*${escapeRegex(fieldName)}\\s*=\\s*"([^"]*)"`, 'm'));
  return match?.[1]?.trim() || '';
}

function readTomlPackageKind(sourceText: string): 'plugin' | 'library' | 'runtime' {
  const packageKind = readTomlStringField(sourceText, 'packageKind');
  return packageKind === 'library' || packageKind === 'runtime' ? packageKind : 'plugin';
}

function readTomlSourceVisibility(
  sourceText: string,
  lane: 'plugins' | 'packages',
): 'open' | 'hybrid' | 'compiled' | 'private' {
  const sourceSection = readTomlSectionBody(sourceText, 'source');
  const visibility = readTomlStringField(sourceSection, 'visibility').toLowerCase();
  if (
    visibility === 'open'
    || visibility === 'hybrid'
    || visibility === 'compiled'
    || visibility === 'private'
  ) {
    return visibility;
  }
  return lane === 'packages' ? 'open' : 'private';
}

function readTomlExportModules(sourceText: string): string[] {
  const exportsSection = readTomlSectionBody(sourceText, 'exports.modules');
  return [...exportsSection.matchAll(/^"([^"]+)"\s*=/gm)].map((match) => match[1]).filter(Boolean);
}

function readTomlDependencies(sourceText: string): Array<{ id: string; importAs?: string }> {
  return [...sourceText.matchAll(/\[\[dependencies\]\]([\s\S]*?)(?=\n\[\[|\n\[|$)/g)].flatMap((match) => {
    const block = match[1] ?? '';
    const id = readTomlStringField(block, 'id');
    if (!id) {
      return [];
    }
    const importAs = readTomlStringField(block, 'importAs') || undefined;
    return [{ id, importAs }];
  });
}

function readTomlSectionBody(sourceText: string, sectionName: string): string {
  const match = sourceText.match(
    new RegExp(`^\\[${escapeRegex(sectionName)}\\]\\s*$([\\s\\S]*?)(?=^\\[[^\\[]|^\\[\\[[^\\]]+\\]\\]|\\Z)`, 'm'),
  );
  return match?.[1]?.trim() || '';
}

function readLegacySourceVisibility(
  record: Record<string, unknown>,
  lane: 'plugins' | 'packages',
): 'open' | 'hybrid' | 'compiled' | 'private' {
  const source = typeof record.source === 'object' && record.source && !Array.isArray(record.source)
    ? record.source as Record<string, unknown>
    : null;
  const candidate = typeof record.sourceVisibility === 'string'
    ? record.sourceVisibility
    : typeof source?.visibility === 'string'
      ? source.visibility
      : '';
  const normalized = candidate.trim().toLowerCase();
  if (
    normalized === 'open'
    || normalized === 'hybrid'
    || normalized === 'compiled'
    || normalized === 'private'
  ) {
    return normalized;
  }
  return lane === 'packages' ? 'open' : 'private';
}

function extractLegacyModuleExports(record: Record<string, unknown>): string[] {
  const exportsRecord = typeof record.exports === 'object' && record.exports && !Array.isArray(record.exports)
    ? record.exports as Record<string, unknown>
    : null;
  const modules = typeof exportsRecord?.modules === 'object' && exportsRecord.modules && !Array.isArray(exportsRecord.modules)
    ? exportsRecord.modules as Record<string, unknown>
    : null;
  return modules ? Object.keys(modules).sort() : [];
}

function extractLegacyDependencies(record: Record<string, unknown>): Array<{ id: string; importAs?: string }> {
  const dependencies = Array.isArray(record.dependencies) ? record.dependencies : [];
  return dependencies.flatMap((dependency) => {
    if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
      return [];
    }
    const entry = dependency as Record<string, unknown>;
    const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '';
    if (!id) {
      return [];
    }
    const importAs = typeof entry.importAs === 'string' && entry.importAs.trim()
      ? entry.importAs.trim()
      : undefined;
    return [{ id, importAs }];
  });
}

function sanitizeFallbackId(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'package';
}

function titleCase(value: string): string {
  return sanitizeFallbackId(value)
    .split('-')
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
