import { isTauri } from '@tauri-apps/api/core';
import { mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import { parse as parseToml } from 'smol-toml';

import { getManagedContentDirectory } from './appContentDirectories';
import { normalizeExplorerChromeOverrideSnapshot, type ExplorerChromeOverrideSnapshot } from './explorerChromeLayouts';
import { defaultExplorerModeProfileId, normalizeExplorerModeProfileId, type ExplorerModeProfileId } from './explorerModeProfiles';
import { getExplorerRailWidthBounds } from './explorerRail';
import {
  EXPLORER_ACTIONS_WIDTH_BOUNDS,
  EXPLORER_PREVIEW_WIDTH_BOUNDS,
  getExplorerShellLayoutWidthSuggestion,
} from './explorerShellLayouts';
import { joinPlatformPath } from './platform';
import { resolveRuntimeAssetPollingEnabled } from './runtimeAssetPolling';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import type { ExplorerPreviewSplitMode } from '../store/explorerStore';
import type { ExplorerWorkspaceLayoutMode } from './explorerWorkspaceLayouts';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

export interface ExplorerLayoutPaneMetrics {
  sidebarWidthPx?: number;
  previewWidthPx?: number;
  actionsWidthPx?: number;
  sourcesVisible?: boolean;
  previewEnabled?: boolean;
  previewSplitMode?: ExplorerPreviewSplitMode;
}

export interface ExplorerLayoutBandMetrics {
  unifiedHeaderHeightPx?: number;
  explorerToolbarHeightPx?: number;
  railHeaderHeightPx?: number;
  previewHeaderHeightPx?: number;
  explorerStatusBarHeightPx?: number;
}

export interface ExplorerLayoutDefinition {
  id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  modeProfileId?: ExplorerModeProfileId;
  workspaceLayoutMode?: ExplorerWorkspaceLayoutMode;
  tabStripVisible?: boolean;
  tabStripSurfaceId?: string;
  paneMetrics?: ExplorerLayoutPaneMetrics;
  bandMetrics?: ExplorerLayoutBandMetrics;
  chromeSnapshot?: ExplorerChromeOverrideSnapshot | null;
  basedOnLayoutId?: string;
}

export interface ExplorerLayoutPackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
  layout?: ExplorerLayoutDefinition;
  layouts?: ExplorerLayoutDefinition[];
}

interface ExplorerLayoutPackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: ExplorerLayoutPackageManifest;
}

export interface LoadedExplorerLayoutDefinition extends ExplorerLayoutDefinition {
  id: string;
  localId: string;
  name: string;
  description?: string;
  tags: string[];
  modeProfileId: ExplorerModeProfileId;
  workspaceLayoutMode: ExplorerWorkspaceLayoutMode;
  tabStripVisible: boolean;
  tabStripSurfaceId?: string;
  paneMetrics: ExplorerLayoutPaneMetrics;
  bandMetrics: ExplorerLayoutBandMetrics;
  chromeSnapshot?: ExplorerChromeOverrideSnapshot;
  basedOnLayoutId?: string;
  readOnly: boolean;
  source: 'built-in' | 'explorer-layout-package' | 'theme-package';
  sourceLabel: string;
  sourcePackageId?: string;
}

export interface LoadedExplorerLayoutPackage {
  id: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'explorer-layout-directory';
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  warnings: string[];
  layouts: LoadedExplorerLayoutDefinition[];
}

export interface ExplorerLayoutPackageLoadResult {
  packages: LoadedExplorerLayoutPackage[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export interface SaveExplorerLayoutOptions {
  basedOnLayoutId?: string;
}

export const EXPLORER_CANONICAL_LAYOUT_ID = 'canonical';

export const explorerLayoutSystemConfig = {
  get explorerLayoutsDirectory(): string {
    return getManagedContentDirectory('explorerLayouts');
  },
  manifestNames: ['explorer-layout.json', 'explorer-layout.toml', 'manifest.json', 'manifest.toml'] as const,
  runtimeAssetPollingEnabled: resolveRuntimeAssetPollingEnabled(),
  scanIntervalMs: 5000,
};

const explorerLayoutBuiltInCanonicalDefinition: LoadedExplorerLayoutDefinition = {
  id: EXPLORER_CANONICAL_LAYOUT_ID,
  localId: EXPLORER_CANONICAL_LAYOUT_ID,
  name: 'Canonical',
  description: 'Balanced explorer layout with the unified header strip as the canonical restore target.',
  tags: ['built-in', 'canonical'],
  modeProfileId: defaultExplorerModeProfileId,
  workspaceLayoutMode: 'single',
  tabStripVisible: true,
  tabStripSurfaceId: 'explorerTopbar',
  paneMetrics: {
    sourcesVisible: true,
    previewEnabled: true,
    previewSplitMode: 'inline',
  },
  bandMetrics: {
    unifiedHeaderHeightPx: 88,
    explorerToolbarHeightPx: 48,
    railHeaderHeightPx: 40,
    previewHeaderHeightPx: 40,
    explorerStatusBarHeightPx: 32,
  },
  chromeSnapshot: undefined,
  basedOnLayoutId: undefined,
  readOnly: true,
  source: 'built-in',
  sourceLabel: 'Built-in canonical explorer layout',
};

const builtInExplorerLayoutBaselineWidths = {
  sidebarWidthPx: getExplorerRailWidthBounds(false).defaultWidth,
  previewWidthPx: Math.max(
    EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
    Math.min(EXPLORER_PREVIEW_WIDTH_BOUNDS.max, 360),
  ),
  actionsWidthPx: EXPLORER_ACTIONS_WIDTH_BOUNDS.default,
} as const;

function createBuiltInExplorerModePresetLayout(input: {
  id: string;
  name: string;
  description: string;
  modeProfileId: ExplorerModeProfileId;
  sourcesVisible: boolean;
}): LoadedExplorerLayoutDefinition {
  const widthSuggestion = getExplorerShellLayoutWidthSuggestion({
    layoutId: input.modeProfileId as 'balanced' | 'navigator' | 'focus' | 'inspector',
    railWidth: builtInExplorerLayoutBaselineWidths.sidebarWidthPx,
    railMinWidth: getExplorerRailWidthBounds(false).minWidth,
    railMaxWidth: getExplorerRailWidthBounds(false).maxWidth,
    previewWidth: builtInExplorerLayoutBaselineWidths.previewWidthPx,
    previewMinWidth: EXPLORER_PREVIEW_WIDTH_BOUNDS.min,
    previewMaxWidth: EXPLORER_PREVIEW_WIDTH_BOUNDS.max,
  });

  return {
    id: input.id,
    localId: input.id,
    name: input.name,
    description: input.description,
    tags: ['built-in', 'preset'],
    modeProfileId: input.modeProfileId,
    workspaceLayoutMode: 'single',
    tabStripVisible: true,
    tabStripSurfaceId: 'explorerTopbar',
    paneMetrics: {
      sidebarWidthPx: widthSuggestion.sidebarWidth,
      previewWidthPx: widthSuggestion.previewWidth,
      actionsWidthPx: builtInExplorerLayoutBaselineWidths.actionsWidthPx,
      sourcesVisible: input.sourcesVisible,
      previewEnabled: true,
      previewSplitMode: 'inline',
    },
    bandMetrics: {
      ...explorerLayoutBuiltInCanonicalDefinition.bandMetrics,
    },
    chromeSnapshot: undefined,
    basedOnLayoutId: EXPLORER_CANONICAL_LAYOUT_ID,
    readOnly: true,
    source: 'built-in',
    sourceLabel: 'Built-in explorer layout preset',
  };
}

const builtInExplorerModePresetLayouts: LoadedExplorerLayoutDefinition[] = [
  createBuiltInExplorerModePresetLayout({
    id: 'navigator',
    name: 'Navigator',
    description: 'Rail-first browsing with a stronger emphasis on source navigation.',
    modeProfileId: 'navigator',
    sourcesVisible: true,
  }),
  createBuiltInExplorerModePresetLayout({
    id: 'focus',
    name: 'Focus',
    description: 'Minimal browsing chrome with search-forward emphasis.',
    modeProfileId: 'focus',
    sourcesVisible: false,
  }),
  createBuiltInExplorerModePresetLayout({
    id: 'inspector',
    name: 'Inspector',
    description: 'Preview-heavy browsing tuned for inspection and triage.',
    modeProfileId: 'inspector',
    sourcesVisible: true,
  }),
];

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

function normalizeIdFragment(value: string | undefined, fallback: string): string {
  const normalized = (value ?? fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function normalizeOptionalPositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.round(value));
}

function normalizeWorkspaceLayoutMode(value: unknown): ExplorerWorkspaceLayoutMode {
  return value === 'split' || value === 'triple' || value === 'quad' ? value : 'single';
}

function normalizePreviewSplitMode(value: unknown): ExplorerPreviewSplitMode | undefined {
  return value === 'pane' ? 'pane' : value === 'inline' ? 'inline' : undefined;
}

function normalizeExplorerLayoutPaneMetrics(value: unknown): ExplorerLayoutPaneMetrics {
  const source = asRecord(value);
  if (!source) {
    return {};
  }

  return {
    sidebarWidthPx: normalizeOptionalPositiveNumber(source.sidebarWidthPx),
    previewWidthPx: normalizeOptionalPositiveNumber(source.previewWidthPx),
    actionsWidthPx: normalizeOptionalPositiveNumber(source.actionsWidthPx),
    sourcesVisible: typeof source.sourcesVisible === 'boolean' ? source.sourcesVisible : undefined,
    previewEnabled: typeof source.previewEnabled === 'boolean' ? source.previewEnabled : undefined,
    previewSplitMode: normalizePreviewSplitMode(source.previewSplitMode),
  };
}

function normalizeExplorerLayoutBandMetrics(value: unknown): ExplorerLayoutBandMetrics {
  const source = asRecord(value);
  if (!source) {
    return {};
  }

  return {
    unifiedHeaderHeightPx: normalizeOptionalPositiveNumber(source.unifiedHeaderHeightPx),
    explorerToolbarHeightPx: normalizeOptionalPositiveNumber(source.explorerToolbarHeightPx),
    railHeaderHeightPx: normalizeOptionalPositiveNumber(source.railHeaderHeightPx),
    previewHeaderHeightPx: normalizeOptionalPositiveNumber(source.previewHeaderHeightPx),
    explorerStatusBarHeightPx: normalizeOptionalPositiveNumber(source.explorerStatusBarHeightPx),
  };
}

export function normalizeExplorerLayoutChromeSnapshot(
  value: ExplorerChromeOverrideSnapshot | null | undefined,
): ExplorerChromeOverrideSnapshot | undefined {
  const normalized = normalizeExplorerChromeOverrideSnapshot(value);
  if (normalized.entries.length === 0) {
    return undefined;
  }

  return normalized;
}

export function normalizeExplorerLayoutDefinition(
  definition: ExplorerLayoutDefinition,
  options?: {
    fallbackId?: string;
    readOnly?: boolean;
    source?: LoadedExplorerLayoutDefinition['source'];
    sourceLabel?: string;
    sourcePackageId?: string;
    scopeId?: string | null;
  },
): LoadedExplorerLayoutDefinition {
  const fallbackId = options?.fallbackId ?? EXPLORER_CANONICAL_LAYOUT_ID;
  const localId = normalizeIdFragment(definition.id, fallbackId);
  const scopedId = options?.scopeId?.trim()
    ? `${normalizeIdFragment(options.scopeId, 'theme-bundle')}:${localId}`
    : localId;
  const name = asString(definition.name) || localId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

  return {
    id: scopedId,
    localId,
    name,
    description: asString(definition.description) || undefined,
    tags: asStringArray(definition.tags),
    modeProfileId: normalizeExplorerModeProfileId(definition.modeProfileId),
    workspaceLayoutMode: normalizeWorkspaceLayoutMode(definition.workspaceLayoutMode),
    tabStripVisible: definition.tabStripVisible !== false,
    tabStripSurfaceId: asString(definition.tabStripSurfaceId) || undefined,
    paneMetrics: normalizeExplorerLayoutPaneMetrics(definition.paneMetrics),
    bandMetrics: normalizeExplorerLayoutBandMetrics(definition.bandMetrics),
    chromeSnapshot: normalizeExplorerLayoutChromeSnapshot(definition.chromeSnapshot ?? undefined),
    basedOnLayoutId: asString(definition.basedOnLayoutId) || undefined,
    readOnly: options?.readOnly ?? false,
    source: options?.source ?? 'explorer-layout-package',
    sourceLabel: options?.sourceLabel ?? 'Explorer layout package',
    sourcePackageId: options?.sourcePackageId,
  };
}

function parseLooseExplorerLayoutDefinition(source: LooseRecord): ExplorerLayoutDefinition {
  return {
    id: asString(source.id) || undefined,
    name: asString(source.name) || undefined,
    description: asString(source.description) || undefined,
    tags: asStringArray(source.tags),
    modeProfileId: normalizeExplorerModeProfileId(source.modeProfileId),
    workspaceLayoutMode: normalizeWorkspaceLayoutMode(source.workspaceLayoutMode),
    tabStripVisible: typeof source.tabStripVisible === 'boolean' ? source.tabStripVisible : undefined,
    tabStripSurfaceId: asString(source.tabStripSurfaceId) || undefined,
    paneMetrics: normalizeExplorerLayoutPaneMetrics(source.paneMetrics),
    bandMetrics: normalizeExplorerLayoutBandMetrics(source.bandMetrics),
    chromeSnapshot: normalizeExplorerLayoutChromeSnapshot(
      source.chromeSnapshot as ExplorerChromeOverrideSnapshot | undefined,
    ),
    basedOnLayoutId: asString(source.basedOnLayoutId) || undefined,
  };
}

function hasExplorerLayoutDefinitionFields(source: LooseRecord): boolean {
  return [
    'id',
    'name',
    'description',
    'tags',
    'modeProfileId',
    'workspaceLayoutMode',
    'tabStripVisible',
    'tabStripSurfaceId',
    'paneMetrics',
    'bandMetrics',
    'chromeSnapshot',
    'layout',
    'layouts',
  ].some(key => key in source);
}

function parseExplorerLayoutManifestText(
  text: string,
  filePath: string,
): ExplorerLayoutPackageManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Explorer layout manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Explorer layout manifest must be an object: ${filePath}`);
  }

  const nestedLayout = asRecord(source.layout);
  const explicitLayouts = Array.isArray(source.layouts)
    ? source.layouts
      .map(entry => asRecord(entry))
      .filter((entry): entry is LooseRecord => Boolean(entry))
      .map(parseLooseExplorerLayoutDefinition)
    : [];
  const shorthandLayouts = explicitLayouts.length === 0 && !nestedLayout && hasExplorerLayoutDefinitionFields(source)
    ? [parseLooseExplorerLayoutDefinition(source)]
    : [];
  const layouts = explicitLayouts.length > 0
    ? explicitLayouts
    : nestedLayout
      ? [parseLooseExplorerLayoutDefinition(nestedLayout)]
      : shorthandLayouts;

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
    layout: nestedLayout ? parseLooseExplorerLayoutDefinition(nestedLayout) : undefined,
    layouts,
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

function deriveExplorerLayoutPackageId(record: ExplorerLayoutPackageRecord): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return explicitId;
  }

  return normalizeIdFragment(record.directoryName, 'explorer-layout-package');
}

function deriveExplorerLayoutPackageName(record: ExplorerLayoutPackageRecord, packageId: string): string {
  return asString(record.manifest.name)
    || packageId.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

async function readExplorerLayoutPackageRecord(entry: FileEntry): Promise<ExplorerLayoutPackageRecord | null> {
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
      manifest: parseExplorerLayoutManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of explorerLayoutSystemConfig.manifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseExplorerLayoutManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

function buildPackageExplorerLayouts(
  record: ExplorerLayoutPackageRecord,
  packageId: string,
  packageName: string,
): { layouts: LoadedExplorerLayoutDefinition[]; warnings: string[] } {
  const dedupedLayouts = new Map<string, LoadedExplorerLayoutDefinition>();
  const warnings: string[] = [];

  for (const definition of record.manifest.layouts ?? []) {
    const loadedLayout = normalizeExplorerLayoutDefinition(definition, {
      fallbackId: `${packageId}-layout`,
      readOnly: false,
      source: 'explorer-layout-package',
      sourceLabel: packageName,
      sourcePackageId: packageId,
    });

    if (dedupedLayouts.has(loadedLayout.id)) {
      warnings.push(`Duplicate explorer layout id "${loadedLayout.localId}" in ${record.manifestPath}; keeping the first definition.`);
      continue;
    }

    dedupedLayouts.set(loadedLayout.id, loadedLayout);
  }

  return {
    layouts: Array.from(dedupedLayouts.values()),
    warnings,
  };
}

export async function loadExplorerLayoutPackagesFromDirectoryEntries(
  directoryEntries: FileEntry[],
  directoryLabel = explorerLayoutSystemConfig.explorerLayoutsDirectory,
): Promise<ExplorerLayoutPackageLoadResult> {
  try {
    const packages: LoadedExplorerLayoutPackage[] = [];
    const warnings: string[] = [];

    for (const entry of [...directoryEntries].sort((left, right) => left.name.localeCompare(right.name))) {
      try {
        const record = await readExplorerLayoutPackageRecord(entry);
        if (!record) {
          continue;
        }

        const packageId = deriveExplorerLayoutPackageId(record);
        const packageName = deriveExplorerLayoutPackageName(record, packageId);
        const { layouts, warnings: packageWarnings } = buildPackageExplorerLayouts(record, packageId, packageName);

        if (layouts.length === 0) {
          warnings.push(`${packageName}: manifest does not define any explorer layouts.`);
          continue;
        }

        packages.push({
          id: packageId,
          name: packageName,
          version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
          directoryPath: record.directoryPath,
          manifestPath: record.manifestPath,
          sourceKind: 'explorer-layout-directory',
          description: asString(record.manifest.description) || undefined,
          author: asString(record.manifest.author) || undefined,
          homepage: asString(record.manifest.homepage) || undefined,
          tags: record.manifest.tags ?? [],
          warnings: packageWarnings,
          layouts,
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

export async function loadExplorerLayoutPackages(): Promise<ExplorerLayoutPackageLoadResult> {
  const directory = explorerLayoutSystemConfig.explorerLayoutsDirectory;
  if (!isTauri()) {
    return {
      packages: [],
      directory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const entries = await commands.fsListDir(directory, false).then(unwrapTauriResult);
    return loadExplorerLayoutPackagesFromDirectoryEntries(entries, directory);
  } catch (error) {
    return {
      packages: [],
      directory,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export function getBuiltInExplorerLayouts(): LoadedExplorerLayoutDefinition[] {
  return [
    explorerLayoutBuiltInCanonicalDefinition,
    ...builtInExplorerModePresetLayouts,
  ];
}

export function collectExplorerLayoutsFromPackages(
  packages: LoadedExplorerLayoutPackage[],
): LoadedExplorerLayoutDefinition[] {
  return packages.flatMap(pkg => pkg.layouts);
}

export function collectUniqueExplorerLayouts(
  authoredLayouts: LoadedExplorerLayoutDefinition[],
  themedLayouts: LoadedExplorerLayoutDefinition[],
): LoadedExplorerLayoutDefinition[] {
  const layoutMap = new Map<string, LoadedExplorerLayoutDefinition>();
  for (const layout of getBuiltInExplorerLayouts()) {
    layoutMap.set(layout.id, layout);
  }
  for (const layout of authoredLayouts) {
    layoutMap.set(layout.id, layout);
  }
  for (const layout of themedLayouts) {
    layoutMap.set(layout.id, layout);
  }
  return [...layoutMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function findExplorerLayoutById(
  layouts: LoadedExplorerLayoutDefinition[],
  layoutId: string | null | undefined,
): LoadedExplorerLayoutDefinition | null {
  const trimmedLayoutId = layoutId?.trim();
  if (!trimmedLayoutId) {
    return null;
  }

  return layouts.find(layout => layout.id === trimmedLayoutId || layout.localId === trimmedLayoutId) ?? null;
}

export async function saveUserExplorerLayout(
  definition: ExplorerLayoutDefinition,
  options?: SaveExplorerLayoutOptions,
): Promise<LoadedExplorerLayoutDefinition> {
  const loadedLayout = normalizeExplorerLayoutDefinition(
    {
      ...definition,
      basedOnLayoutId: options?.basedOnLayoutId ?? definition.basedOnLayoutId,
    },
    {
      fallbackId: 'user-layout',
      readOnly: false,
      source: 'explorer-layout-package',
      sourceLabel: 'User explorer layout',
    },
  );
  const targetDirectory = joinPlatformPath(
    explorerLayoutSystemConfig.explorerLayoutsDirectory,
    loadedLayout.localId,
  );
  const targetManifestPath = joinPlatformPath(targetDirectory, 'explorer-layout.json');
  await mkdir(targetDirectory, { recursive: true });
  await writeTextFile(
    targetManifestPath,
    JSON.stringify(
      {
        version: 1,
        id: loadedLayout.localId,
        name: loadedLayout.name,
        description: loadedLayout.description,
        tags: loadedLayout.tags,
        layout: {
          id: loadedLayout.localId,
          name: loadedLayout.name,
          description: loadedLayout.description,
          tags: loadedLayout.tags,
          modeProfileId: loadedLayout.modeProfileId,
          workspaceLayoutMode: loadedLayout.workspaceLayoutMode,
          tabStripVisible: loadedLayout.tabStripVisible,
          tabStripSurfaceId: loadedLayout.tabStripSurfaceId,
          paneMetrics: loadedLayout.paneMetrics,
          bandMetrics: loadedLayout.bandMetrics,
          chromeSnapshot: loadedLayout.chromeSnapshot,
          basedOnLayoutId: loadedLayout.basedOnLayoutId,
        },
      },
      null,
      2,
    ),
  );
  return loadedLayout;
}
