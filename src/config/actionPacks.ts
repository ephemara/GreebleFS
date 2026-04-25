import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

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

const EXPLORER_MENU_CONTEXT_KINDS = [
  'entry',
  'background',
  'multi-select',
  'search-result',
  'preview-pane',
] as const;

export type ExplorerActionMenuContextKind = typeof EXPLORER_MENU_CONTEXT_KINDS[number];
export type ExplorerActionRunnerKind =
  | 'interpreter'
  | 'shell'
  | 'cargo'
  | 'binary';
export type ExplorerActionSelectionTarget = 'any' | 'file' | 'directory';
export type ExplorerActionOutputTarget =
  | 'task-center'
  | 'preview-terminal'
  | 'native-terminal'
  | 'silent';

export interface ExplorerActionSelectionDefinition {
  minCount?: number;
  maxCount?: number;
  extensions: string[];
  allowFiles: boolean;
  allowDirectories: boolean;
}

export interface ExplorerActionExecutionDefinition {
  runner: ExplorerActionRunnerKind;
  entry: string;
  args: string[];
  env: Record<string, string>;
  interpreter?: string;
}

export interface ExplorerActionPresentationDefinition {
  outputTarget: ExplorerActionOutputTarget;
}

export interface ExplorerActionPackManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags?: string[];
}

export interface ExplorerActionManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  contexts?: ExplorerActionMenuContextKind[];
  appliesTo?: ExplorerActionSelectionTarget;
  selection?: Partial<ExplorerActionSelectionDefinition> & {
    extensions?: string[];
  };
  execution?: Partial<ExplorerActionExecutionDefinition>;
  presentation?: Partial<ExplorerActionPresentationDefinition>;
}

export interface LoadedExplorerAction {
  id: string;
  actionId: string;
  packId: string;
  packName: string;
  version: number;
  title: string;
  description?: string;
  tags: string[];
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'action-pack-directory' | 'plugin-action-pack';
  sourceLabel: string;
  sourceBadgeLabel: string;
  pluginId?: string;
  pluginName?: string;
  contexts: ExplorerActionMenuContextKind[];
  appliesTo: ExplorerActionSelectionTarget;
  selection: ExplorerActionSelectionDefinition;
  execution: ExplorerActionExecutionDefinition;
  presentation: ExplorerActionPresentationDefinition;
  iconName?: string;
  iconAssetPath?: string;
  iconAssetUrl?: string;
  warnings: string[];
}

export interface LoadedActionPack {
  id: string;
  localPackId: string;
  name: string;
  version: number;
  directoryPath: string;
  manifestPath: string;
  sourceKind: 'action-pack-directory' | 'plugin-action-pack';
  sourceLabel: string;
  sourceBadgeLabel: string;
  description?: string;
  author?: string;
  homepage?: string;
  tags: string[];
  pluginId?: string;
  pluginName?: string;
  warnings: string[];
  actions: LoadedExplorerAction[];
}

interface ExplorerActionPackRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: ExplorerActionPackManifest;
}

interface ExplorerActionPackLoadOptions {
  sourceKind?: LoadedActionPack['sourceKind'];
  sourceLabel?: string;
  sourceBadgeLabel?: string;
  pluginId?: string;
  pluginName?: string;
}

export interface ExplorerActionPackLoadResult {
  packs: LoadedActionPack[];
  directory: string;
  warnings: string[];
  sourceError: string | null;
}

export const actionPackSystemConfig = {
  get actionsDirectory(): string {
    return getManagedContentDirectory('actions');
  },
  packManifestNames: ['action-pack.json', 'action-pack.toml', 'manifest.json', 'manifest.toml'] as const,
  actionManifestNames: ['action.json', 'action.toml', 'manifest.json', 'manifest.toml'] as const,
  actionsDirectoryName: 'actions',
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

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record)
      .filter(([, entry]) => typeof entry === 'string' && entry.trim().length > 0)
      .map(([key, entry]) => [key, String(entry).trim()]),
  );
}

function sanitizeSlug(value: string, fallback: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

function titleCaseSlug(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getParentDirectoryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return normalized.startsWith('/') ? '/' : '.';
  }

  return normalized.slice(0, lastSlash);
}

function readDirectoryAssetUrl(path: string): string {
  try {
    return convertFileSrc(path);
  } catch {
    const normalized = path.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`;
  }
}

function sanitizeActionContextKinds(
  value: unknown,
): ExplorerActionMenuContextKind[] {
  const contexts = asStringArray(value).filter(
    (entry): entry is ExplorerActionMenuContextKind =>
      EXPLORER_MENU_CONTEXT_KINDS.includes(entry as ExplorerActionMenuContextKind),
  );

  return contexts.length > 0 ? contexts : ['entry'];
}

function sanitizeActionAppliesTo(value: unknown): ExplorerActionSelectionTarget {
  return value === 'file' || value === 'directory' ? value : 'any';
}

function sanitizeActionRunnerKind(value: unknown): ExplorerActionRunnerKind {
  return value === 'shell'
    || value === 'cargo'
    || value === 'binary'
    || value === 'interpreter'
    ? value
    : 'interpreter';
}

function sanitizeActionOutputTarget(value: unknown): ExplorerActionOutputTarget {
  return value === 'preview-terminal'
    || value === 'native-terminal'
    || value === 'silent'
    || value === 'task-center'
    ? value
    : 'task-center';
}

function sanitizeSelectionCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function normalizeActionSelection(
  value: unknown,
  appliesTo: ExplorerActionSelectionTarget,
): ExplorerActionSelectionDefinition {
  const record = asRecord(value);
  const allowFiles = asBoolean(record?.allowFiles)
    ?? appliesTo !== 'directory';
  const allowDirectories = asBoolean(record?.allowDirectories)
    ?? appliesTo !== 'file';

  return {
    minCount: sanitizeSelectionCount(record?.minCount),
    maxCount: sanitizeSelectionCount(record?.maxCount),
    extensions: asStringArray(record?.extensions).map(entry => entry.replace(/^\./, '').toLowerCase()),
    allowFiles,
    allowDirectories,
  };
}

function normalizeActionExecution(value: unknown): ExplorerActionExecutionDefinition | null {
  const record = asRecord(value);
  const entry = asString(record?.entry);
  if (!entry) {
    return null;
  }

  return {
    runner: sanitizeActionRunnerKind(record?.runner),
    entry,
    args: asStringArray(record?.args),
    env: asStringRecord(record?.env),
    interpreter: asString(record?.interpreter) || undefined,
  };
}

function normalizeActionPresentation(value: unknown): ExplorerActionPresentationDefinition {
  const record = asRecord(value);
  return {
    outputTarget: sanitizeActionOutputTarget(record?.outputTarget),
  };
}

function parseActionPackManifestText(
  text: string,
  filePath: string,
): ExplorerActionPackManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Explorer action-pack manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Explorer action-pack manifest must be an object: ${filePath}`);
  }

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    author: asString(source.author),
    homepage: asString(source.homepage),
    tags: asStringArray(source.tags),
  };
}

function parseActionManifestText(
  text: string,
  filePath: string,
): ExplorerActionManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Explorer action manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Explorer action manifest must be an object: ${filePath}`);
  }

  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    icon: asString(source.icon),
    tags: asStringArray(source.tags),
    contexts: sanitizeActionContextKinds(source.contexts),
    appliesTo: sanitizeActionAppliesTo(source.appliesTo),
    selection: normalizeActionSelection(source.selection, sanitizeActionAppliesTo(source.appliesTo)),
    execution: normalizeActionExecution(source.execution) ?? undefined,
    presentation: normalizeActionPresentation(source.presentation),
  };
}

function deriveLocalPackId(record: ExplorerActionPackRecord): string {
  const explicitId = asString(record.manifest.id);
  if (explicitId) {
    return sanitizeSlug(explicitId, 'action-pack');
  }

  return sanitizeSlug(record.directoryName, 'action-pack');
}

function qualifyPackId(localPackId: string, pluginId?: string): string {
  return pluginId
    ? `plugin.${sanitizeSlug(pluginId, 'plugin')}.${localPackId}`
    : localPackId;
}

function derivePackName(record: ExplorerActionPackRecord, localPackId: string): string {
  return asString(record.manifest.name) || titleCaseSlug(localPackId);
}

function deriveActionId(localActionId: string, qualifiedPackId: string): string {
  return `action.${qualifiedPackId}.${localActionId}`;
}

async function readExplorerActionPackRecord(entry: FileEntry): Promise<ExplorerActionPackRecord | null> {
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
      manifest: parseActionPackManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of actionPackSystemConfig.packManifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryName: entry.name,
        directoryPath: entry.path,
        manifestPath,
        manifest: parseActionPackManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function readActionManifestFromEntry(entry: FileEntry): Promise<{ directoryPath: string; manifestPath: string; manifest: ExplorerActionManifest } | null> {
  if (!entry.is_dir) {
    const lowerName = entry.name.toLowerCase();
    const isManifestFile = lowerName.endsWith('.json') || lowerName.endsWith('.toml');
    if (!isManifestFile) {
      return null;
    }

    const manifestText = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
    return {
      directoryPath: getParentDirectoryPath(entry.path),
      manifestPath: entry.path,
      manifest: parseActionManifestText(manifestText, entry.path),
    };
  }

  for (const manifestName of actionPackSystemConfig.actionManifestNames) {
    const manifestPath = joinPlatformPath(entry.path, manifestName);
    try {
      const manifestText = await commands.fsReadTextFile(manifestPath).then(unwrapTauriResult);
      return {
        directoryPath: entry.path,
        manifestPath,
        manifest: parseActionManifestText(manifestText, manifestPath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function loadActionsForPack(
  packRecord: ExplorerActionPackRecord,
  packId: string,
  packName: string,
  options: ExplorerActionPackLoadOptions,
): Promise<{ actions: LoadedExplorerAction[]; warnings: string[] }> {
  const warnings: string[] = [];
  const actionsDirectory = joinPlatformPath(
    packRecord.directoryPath,
    actionPackSystemConfig.actionsDirectoryName,
  );

  let actionEntries: FileEntry[] = [];
  try {
    actionEntries = await commands.fsListDir(actionsDirectory, false).then(unwrapTauriResult);
  } catch {
    warnings.push(`${packName}: pack does not define an actions directory.`);
    return { actions: [], warnings };
  }

  const actions: LoadedExplorerAction[] = [];
  for (const actionEntry of actionEntries.sort((left, right) => left.name.localeCompare(right.name))) {
    try {
      const actionRecord = await readActionManifestFromEntry(actionEntry);
      if (!actionRecord) {
        continue;
      }

      const localActionId = sanitizeSlug(
        actionRecord.manifest.id || actionEntry.name.replace(/\.[^.]+$/, ''),
        'action',
      );
      const actionId = deriveActionId(localActionId, packId);
      const title = asString(actionRecord.manifest.name) || titleCaseSlug(localActionId);
      const description = asString(actionRecord.manifest.description) || undefined;
      const appliesTo = sanitizeActionAppliesTo(actionRecord.manifest.appliesTo);
      const selection = normalizeActionSelection(actionRecord.manifest.selection, appliesTo);
      const execution = normalizeActionExecution(actionRecord.manifest.execution);
      if (!execution) {
        warnings.push(`${packName}: ${title} is missing execution.entry.`);
        continue;
      }

      const iconValue = asString(actionRecord.manifest.icon);
      const iconLooksLikeAssetPath = /[\\/]/.test(iconValue) || /\.[a-z0-9]+$/i.test(iconValue);
      const iconAssetPath = iconLooksLikeAssetPath
        ? joinPlatformPath(actionRecord.directoryPath, iconValue.replace(/^[\\/]+/, ''))
        : undefined;
      actions.push({
        id: actionId,
        actionId: localActionId,
        packId,
        packName,
        version: typeof actionRecord.manifest.version === 'number' ? actionRecord.manifest.version : 1,
        title,
        description,
        tags: asStringArray(actionRecord.manifest.tags),
        directoryPath: actionRecord.directoryPath,
        manifestPath: actionRecord.manifestPath,
        sourceKind: options.sourceKind ?? 'action-pack-directory',
        sourceLabel: options.sourceLabel ?? packRecord.directoryPath,
        sourceBadgeLabel: options.sourceBadgeLabel ?? 'Action Pack',
        pluginId: options.pluginId,
        pluginName: options.pluginName,
        contexts: sanitizeActionContextKinds(actionRecord.manifest.contexts),
        appliesTo,
        selection,
        execution,
        presentation: normalizeActionPresentation(actionRecord.manifest.presentation),
        iconName: iconLooksLikeAssetPath ? 'Sparkles' : (iconValue || 'Sparkles'),
        iconAssetPath,
        iconAssetUrl: iconAssetPath ? readDirectoryAssetUrl(iconAssetPath) : undefined,
        warnings: [],
      });
    } catch (error) {
      warnings.push(`${packName}: ${actionEntry.name}: ${String(error)}`);
    }
  }

  return { actions, warnings };
}

export async function loadExplorerActionPacksFromDirectoryEntries(
  entries: FileEntry[],
  directory: string,
  options: ExplorerActionPackLoadOptions = {},
): Promise<ExplorerActionPackLoadResult> {
  const warnings: string[] = [];
  const packs: LoadedActionPack[] = [];

  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of sortedEntries) {
    try {
      const record = await readExplorerActionPackRecord(entry);
      if (!record) {
        continue;
      }

      const localPackId = deriveLocalPackId(record);
      const qualifiedPackId = qualifyPackId(localPackId, options.pluginId);
      const packName = derivePackName(record, localPackId);
      const loadedActions = await loadActionsForPack(record, qualifiedPackId, packName, options);
      if (loadedActions.actions.length === 0) {
        warnings.push(`${packName}: pack does not define any actions.`);
        warnings.push(...loadedActions.warnings);
        continue;
      }

      packs.push({
        id: qualifiedPackId,
        localPackId,
        name: packName,
        version: typeof record.manifest.version === 'number' ? record.manifest.version : 1,
        directoryPath: record.directoryPath,
        manifestPath: record.manifestPath,
        sourceKind: options.sourceKind ?? 'action-pack-directory',
        sourceLabel: options.sourceLabel ?? directory,
        sourceBadgeLabel: options.sourceBadgeLabel ?? 'Action Pack',
        description: asString(record.manifest.description) || undefined,
        author: asString(record.manifest.author) || undefined,
        homepage: asString(record.manifest.homepage) || undefined,
        tags: asStringArray(record.manifest.tags),
        pluginId: options.pluginId,
        pluginName: options.pluginName,
        warnings: loadedActions.warnings,
        actions: loadedActions.actions.sort((left, right) => left.title.localeCompare(right.title)),
      });
    } catch (error) {
      warnings.push(`${entry.name}: ${String(error)}`);
    }
  }

  packs.sort((left, right) => left.name.localeCompare(right.name));
  return {
    packs,
    directory,
    warnings,
    sourceError: null,
  };
}

export async function discoverExplorerActionPacks(): Promise<ExplorerActionPackLoadResult> {
  if (!isTauri()) {
    return {
      packs: [],
      directory: actionPackSystemConfig.actionsDirectory,
      warnings: [],
      sourceError: null,
    };
  }

  try {
    const entries = await commands
      .fsListDir(actionPackSystemConfig.actionsDirectory, false)
      .then(unwrapTauriResult);
    return loadExplorerActionPacksFromDirectoryEntries(
      entries,
      actionPackSystemConfig.actionsDirectory,
    );
  } catch (error) {
    return {
      packs: [],
      directory: actionPackSystemConfig.actionsDirectory,
      warnings: [],
      sourceError: String(error),
    };
  }
}

export async function loadExplorerActionPacks(): Promise<ExplorerActionPackLoadResult> {
  return discoverExplorerActionPacks();
}
