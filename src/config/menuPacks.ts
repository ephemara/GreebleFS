import { isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import {
  normalizeExplorerMenuContextLayout,
  normalizeExplorerMenuPresentationRecipe,
  type ExplorerMenuContextKind,
  type ExplorerMenuContextLayout,
  type ExplorerMenuLayoutEntry,
  type ExplorerMenuPackManifest,
  type ExplorerMenuPresentationRecipe,
} from './explorerContextMenu';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

export interface LoadedExplorerMenuPack {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'built-in' | 'menu-pack-directory';
  sourceLabel: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
  presentation: ExplorerMenuPresentationRecipe;
  contexts: Partial<Record<ExplorerMenuContextKind, ExplorerMenuContextLayout>>;
}

interface ExplorerMenuPackRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: ExplorerMenuPackManifest;
}

export interface ExplorerMenuPackLoadResult {
  packs: LoadedExplorerMenuPack[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export const DEFAULT_EXPLORER_MENU_PACK_ID = 'greeblefs-default-explorer-menu';

export const menuPackSystemConfig = {
  get menuPacksDirectory(): string {
    return getManagedContentDirectory('menuPacks');
  },
  manifestNames: ['menu-pack.json', 'menu-pack.toml', 'manifest.json', 'manifest.toml'] as const,
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
    .map((entry) => entry.trim());
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }

  return normalized.slice(0, lastSlash);
}

function parseMenuPackManifestText(
  text: string,
  filePath: string,
): ExplorerMenuPackManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Explorer menu-pack manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Explorer menu-pack manifest must be an object: ${filePath}`);
  }

  const contextsSource = asRecord(source.contexts);
  const contexts = contextsSource
    ? Object.fromEntries(
        Object.entries(contextsSource)
          .map(([contextKind, layout]) => {
            const normalizedLayout = normalizeExplorerMenuContextLayout(layout);
            return normalizedLayout ? [contextKind, normalizedLayout] as const : null;
          })
          .filter(
            (entry): entry is readonly [ExplorerMenuContextKind, ExplorerMenuContextLayout] => entry != null,
          ),
      )
    : {};

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    presentation: normalizeExplorerMenuPresentationRecipe(source.presentation),
    contexts,
  };
}

function deriveMenuPackId(record: ExplorerMenuPackRecord): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return explicitId;
  }

  return (
    record.directoryName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'menu-pack'
  );
}

function deriveMenuPackName(record: ExplorerMenuPackRecord, packId: string): string {
  return (
    asString(record.manifest.name) ||
    packId.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

async function readExplorerMenuPackRecord(entry: FileEntry): Promise<ExplorerMenuPackRecord | null> {
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
      manifest: parseMenuPackManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of menuPackSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseMenuPackManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function createEntry(
  id: string,
  kind: ExplorerMenuLayoutEntry['kind'],
  order: number,
  options?: Partial<ExplorerMenuLayoutEntry>,
): ExplorerMenuLayoutEntry {
  switch (kind) {
    case 'command':
      return {
        id,
        kind,
        commandId: options && 'commandId' in options ? String(options.commandId) : '',
        parentEntryId: options?.parentEntryId ?? null,
        order,
        enabled: options?.enabled ?? true,
        quickSlot: options?.quickSlot ?? 'none',
        fallbackBucket: options?.fallbackBucket ?? 'default',
        spatialHint: options?.spatialHint,
      };
    case 'submenu':
      return {
        id,
        kind,
        title: options && 'title' in options ? String(options.title) : 'Submenu',
        iconName: options && 'iconName' in options ? options.iconName : undefined,
        parentEntryId: options?.parentEntryId ?? null,
        order,
        enabled: options?.enabled ?? true,
        quickSlot: options?.quickSlot ?? 'none',
        fallbackBucket: options?.fallbackBucket ?? 'default',
        spatialHint: options?.spatialHint,
      };
    case 'group-slot':
      return {
        id,
        kind,
        group:
          options &&
          'group' in options &&
          (
            options.group === 'create' ||
            options.group === 'open' ||
            options.group === 'system' ||
            options.group === 'clipboard' ||
            options.group === 'organize' ||
            options.group === 'library' ||
            options.group === 'plugin' ||
            options.group === 'danger'
          )
            ? options.group
            : 'plugin',
        sourceFilter:
          options && 'sourceFilter' in options && typeof options.sourceFilter === 'string'
            ? options.sourceFilter
            : 'any',
        parentEntryId: options?.parentEntryId ?? null,
        order,
        enabled: options?.enabled ?? true,
        quickSlot: options?.quickSlot ?? 'none',
        fallbackBucket: options?.fallbackBucket ?? 'default',
        spatialHint: options?.spatialHint,
      };
    case 'separator':
    default:
      return {
        id,
        kind: 'separator',
        parentEntryId: options?.parentEntryId ?? null,
        order,
        enabled: options?.enabled ?? true,
        quickSlot: options?.quickSlot ?? 'none',
        fallbackBucket: options?.fallbackBucket ?? 'default',
        spatialHint: options?.spatialHint,
      };
  }
}

export function createBuiltInExplorerMenuPack(): LoadedExplorerMenuPack {
  const entryLayout: ExplorerMenuLayoutEntry[] = [
    createEntry('entry.open', 'command', 10, { commandId: 'built-in.open', quickSlot: 'primary' }),
    createEntry('entry.open-with', 'command', 20, {
      commandId: 'built-in.open-with',
      quickSlot: 'secondary',
    }),
    createEntry('entry.reveal', 'command', 30, { commandId: 'built-in.reveal' }),
    createEntry('entry.properties', 'command', 40, { commandId: 'built-in.properties' }),
    createEntry('entry.separator.primary', 'separator', 50),
    createEntry('entry.clipboard', 'submenu', 60, { title: 'Clipboard', iconName: 'Clipboard' }),
    createEntry('entry.clipboard.slot', 'group-slot', 10, {
      parentEntryId: 'entry.clipboard',
      group: 'clipboard',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('entry.organize', 'submenu', 70, { title: 'Organize', iconName: 'Edit3' }),
    createEntry('entry.organize.slot', 'group-slot', 10, {
      parentEntryId: 'entry.organize',
      group: 'organize',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('entry.library', 'submenu', 80, { title: 'Library', iconName: 'Star' }),
    createEntry('entry.library.slot', 'group-slot', 10, {
      parentEntryId: 'entry.library',
      group: 'library',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('entry.plugins', 'submenu', 90, { title: 'Plugins', iconName: 'Puzzle' }),
    createEntry('entry.plugins.slot', 'group-slot', 10, {
      parentEntryId: 'entry.plugins',
      group: 'plugin',
      sourceFilter: 'plugin',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('entry.separator.danger', 'separator', 100),
    createEntry('entry.danger.slot', 'group-slot', 110, {
      group: 'danger',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
  ];

  const backgroundLayout: ExplorerMenuLayoutEntry[] = [
    createEntry('background.create.slot', 'group-slot', 10, {
      group: 'create',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('background.clipboard.slot', 'group-slot', 20, {
      group: 'clipboard',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('background.separator.system', 'separator', 30),
    createEntry('background.open-with', 'command', 40, { commandId: 'built-in.open-with' }),
    createEntry('background.system.slot', 'group-slot', 50, {
      group: 'system',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('background.plugins.slot', 'group-slot', 60, {
      group: 'plugin',
      sourceFilter: 'plugin',
    } as Partial<ExplorerMenuLayoutEntry>),
  ];

  const multiSelectLayout: ExplorerMenuLayoutEntry[] = [
    createEntry('multi.copy-path', 'command', 10, { commandId: 'built-in.copy-path' }),
    createEntry('multi.properties', 'command', 20, { commandId: 'built-in.properties' }),
    createEntry('multi.separator.primary', 'separator', 30),
    createEntry('multi.clipboard.slot', 'group-slot', 40, {
      group: 'clipboard',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('multi.organize.slot', 'group-slot', 50, {
      group: 'organize',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('multi.library.slot', 'group-slot', 60, {
      group: 'library',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('multi.plugins.slot', 'group-slot', 70, {
      group: 'plugin',
      sourceFilter: 'plugin',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('multi.danger.slot', 'group-slot', 80, {
      group: 'danger',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
  ];

  const searchResultLayout: ExplorerMenuLayoutEntry[] = [
    createEntry('search.open', 'command', 10, { commandId: 'built-in.open', quickSlot: 'primary' }),
    createEntry('search.open-with', 'command', 20, { commandId: 'built-in.open-with' }),
    createEntry('search.system.slot', 'group-slot', 30, {
      group: 'system',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('search.clipboard.slot', 'group-slot', 40, {
      group: 'clipboard',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('search.organize.slot', 'group-slot', 50, {
      group: 'organize',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('search.library.slot', 'group-slot', 60, {
      group: 'library',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('search.plugins.slot', 'group-slot', 70, {
      group: 'plugin',
      sourceFilter: 'plugin',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('search.danger.slot', 'group-slot', 80, {
      group: 'danger',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
  ];

  const previewPaneLayout: ExplorerMenuLayoutEntry[] = [
    createEntry('preview.open', 'command', 10, { commandId: 'built-in.open', quickSlot: 'primary' }),
    createEntry('preview.open-with', 'command', 20, { commandId: 'built-in.open-with' }),
    createEntry('preview.system.slot', 'group-slot', 30, {
      group: 'system',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('preview.clipboard.slot', 'group-slot', 40, {
      group: 'clipboard',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('preview.organize.slot', 'group-slot', 50, {
      group: 'organize',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('preview.library.slot', 'group-slot', 60, {
      group: 'library',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('preview.plugins.slot', 'group-slot', 70, {
      group: 'plugin',
      sourceFilter: 'plugin',
    } as Partial<ExplorerMenuLayoutEntry>),
    createEntry('preview.danger.slot', 'group-slot', 80, {
      group: 'danger',
      sourceFilter: 'any',
    } as Partial<ExplorerMenuLayoutEntry>),
  ];

  return {
    id: DEFAULT_EXPLORER_MENU_PACK_ID,
    name: 'GreebleFS Classic Explorer Menu',
    version: 1,
    directoryPath: 'builtin:menu-pack',
    manifestPath: 'builtin:menu-pack:manifest',
    sourceKind: 'built-in',
    sourceLabel: 'built-in',
    description: 'Default submenu-aware classic explorer menu for file, background, multi-select, search, and preview contexts.',
    author: undefined,
    homepage: undefined,
    tags: ['classic', 'submenu', 'explorer'],
    warnings: [],
    presentation: {
      renderer: 'classic',
      fallbackRenderer: 'classic',
      shapeLanguage: 'rectangular',
      motionStyle: 'minimal',
      materialStyle: 'glass',
      density: 'balanced',
      submenuBehavior: 'sidecar',
      focusStyle: 'line',
      backdropStyle: 'none',
      capabilityRules: [
        { when: 'mouse', renderer: 'classic' },
        { when: 'touch', renderer: 'sheet' },
        { when: 'keyboard', renderer: 'classic' },
        { when: 'reduced-motion', renderer: 'classic' },
      ],
    },
    contexts: {
      entry: { renderer: 'classic', entries: entryLayout },
      background: { renderer: 'classic', entries: backgroundLayout },
      'multi-select': { renderer: 'classic', entries: multiSelectLayout },
      'search-result': { renderer: 'classic', entries: searchResultLayout },
      'preview-pane': { renderer: 'classic', entries: previewPaneLayout },
    },
  };
}

export async function loadExplorerMenuPacksFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = menuPackSystemConfig.menuPacksDirectory,
): Promise<ExplorerMenuPackLoadResult> {
  try {
    const packs: LoadedExplorerMenuPack[] = [createBuiltInExplorerMenuPack()];
    const warnings: string[] = [];

    for (const entry of [...directoryEntries].sort((left, right) => left.name.localeCompare(right.name))) {
      try {
        const record = await readExplorerMenuPackRecord(entry);
        if (!record) {
          continue;
        }

        const packId = deriveMenuPackId(record);
        const packName = deriveMenuPackName(record, packId);
        const contexts = record.manifest.contexts ?? {};
        if (Object.keys(contexts).length === 0) {
          warnings.push(`${packName}: manifest does not define any menu contexts.`);
          continue;
        }

        packs.push({
          id: packId,
          name: packName,
          version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: 'menu-pack-directory',
          sourceLabel: directoryLabel,
          description: asString(record.manifest.description) || undefined,
          author: asString(record.manifest.author) || undefined,
          homepage: asString(record.manifest.homepage) || undefined,
          tags: record.manifest.tags ?? [],
          warnings: [],
          presentation: record.manifest.presentation ?? {},
          contexts,
        });
      } catch (error) {
        warnings.push(`${entry.name}: ${String(error)}`);
      }
    }

    packs.sort((left, right) => {
      if (left.sourceKind === 'built-in' && right.sourceKind !== 'built-in') {
        return -1;
      }
      if (right.sourceKind === 'built-in' && left.sourceKind !== 'built-in') {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });

    return {
      packs,
      directory: directoryLabel,
      warnings,
      sourceError: null,
    };
  } catch (error) {
    return {
      packs: [createBuiltInExplorerMenuPack()],
      directory: directoryLabel,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadExplorerMenuPacks(): Promise<ExplorerMenuPackLoadResult> {
  const directory = menuPackSystemConfig.menuPacksDirectory;
  if (!isTauri()) {
    return {
      packs: [createBuiltInExplorerMenuPack()],
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const entries = await commands.fsListDir(directory, false).then(unwrapTauriResult);
    return loadExplorerMenuPacksFromDirectoryEntries(entries, directory);
  } catch (error) {
    return {
      packs: [createBuiltInExplorerMenuPack()],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}
