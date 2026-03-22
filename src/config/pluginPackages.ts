import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';

import type { OverlayRegisteredFontContribution } from './appearance';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginExplorerActionContribution,
} from './pluginContributions';
import { joinPlatformPath } from './platform';
import { pluginSystemConfig } from './plugins';
import { type LoadedOverlayThemePackage, loadThemePackagesFromDirectoryEntries } from './themePackages';
import { type LoadedOverlayShader, loadShaderFromSource } from '../components/shaderRuntime';
import {
  type LoadedOverlayPlugin,
  type OverlayPluginApi,
  type OverlayPluginCapabilitySummary,
  type OverlayPluginContext,
  type PluginFileEntry,
  loadPluginFromSource,
} from '../components/pluginRuntime';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;

interface PluginPackageFontManifest {
  id?: string;
  name?: string;
  family?: string;
  faceName?: string;
  src: string;
  format?: string;
  style?: string;
  weight?: string;
}

interface PluginPackageCommandManifest {
  id?: string;
  name?: string;
  command: string;
  description?: string;
  runOnSelect?: boolean;
}

interface PluginPackageExplorerActionManifest {
  id?: string;
  label?: string;
  command: string;
  description?: string;
  appliesTo?: 'any' | 'file' | 'directory';
  runOnSelect?: boolean;
}

interface PluginPackageManifest {
  version?: number;
  id?: string;
  name?: string;
  description?: string;
  entry?: string;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  contributions?: {
    themes?: string[];
    shaders?: string[];
    fonts?: PluginPackageFontManifest[];
    commands?: PluginPackageCommandManifest[];
    explorerActions?: PluginPackageExplorerActionManifest[];
  };
}

interface PluginPackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: PluginPackageManifest;
}

export interface OverlayPluginDiscoveryResult {
  plugins: LoadedOverlayPlugin[];
  themePackages: LoadedOverlayThemePackage[];
  shaders: LoadedOverlayShader[];
  fonts: OverlayRegisteredFontContribution[];
  commands: OverlayPluginCommandContribution[];
  explorerActions: OverlayPluginExplorerActionContribution[];
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

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
    : [];
}

function asFontManifestArray(value: unknown): PluginPackageFontManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    if (typeof entry === 'string' && entry.trim()) {
      const name = deriveDisplayNameFromFilePath(entry);
      return [{
        id: deriveIdFromName(name, 'font'),
        name,
        family: `"${name}", sans-serif`,
        src: entry.trim(),
      }];
    }

    const record = asRecord(entry);
    const src = asString(record?.src);
    if (!record || !src) {
      return [];
    }

    const name = asString(record.name) || deriveDisplayNameFromFilePath(src);
    return [{
      id: asString(record.id) || deriveIdFromName(name, 'font'),
      name,
      family: asString(record.family) || `"${name}", sans-serif`,
      faceName: asString(record.faceName),
      src,
      format: asString(record.format),
      style: asString(record.style),
      weight: asString(record.weight),
    }];
  });
}

function asCommandManifestArray(value: unknown): PluginPackageCommandManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const commands: PluginPackageCommandManifest[] = [];

  value.forEach(entry => {
    if (typeof entry === 'string' && entry.trim()) {
      const command = entry.trim();
      commands.push({
        id: deriveIdFromName(command, 'command'),
        name: command,
        command,
        runOnSelect: false,
      });
      return;
    }

    const record = asRecord(entry);
    const command = asString(record?.command);
    if (!record || !command) {
      return;
    }

    commands.push({
      id: asString(record.id) || deriveIdFromName(asString(record.name) || command, 'command'),
      name: asString(record.name) || command,
      command,
      description: asString(record.description),
      runOnSelect: asBoolean(record.runOnSelect) ?? false,
    });
  });

  return commands;
}

function asExplorerActionManifestArray(value: unknown): PluginPackageExplorerActionManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    const record = asRecord(entry);
    const command = asString(record?.command);
    if (!record || !command) {
      return [];
    }

    const appliesTo = asString(record.appliesTo, 'any');
    return [{
      id: asString(record.id) || deriveIdFromName(asString(record.label) || command, 'explorer-action'),
      label: asString(record.label) || deriveDisplayNameFromFilePath(command),
      command,
      description: asString(record.description),
      appliesTo: appliesTo === 'file' || appliesTo === 'directory' ? appliesTo : 'any',
      runOnSelect: asBoolean(record.runOnSelect) ?? true,
    }];
  });
}

function parsePluginManifestText(text: string, filePath: string): PluginPackageManifest {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Plugin manifest is empty: ${filePath}`);
  }

  const parsed = filePath.toLowerCase().endsWith('.toml')
    ? parseToml(trimmed)
    : JSON.parse(trimmed);
  const source = asRecord(parsed);
  if (!source) {
    throw new Error(`Plugin manifest must be an object: ${filePath}`);
  }

  const contributions = asRecord(source.contributions);
  return {
    version: typeof source.version === 'number' ? source.version : 1,
    id: asString(source.id),
    name: asString(source.name),
    description: asString(source.description),
    entry: asString(source.entry),
    defaultOpen: asBoolean(source.defaultOpen),
    keepMounted: asBoolean(source.keepMounted),
    contributions: {
      themes: asStringArray(contributions?.themes),
      shaders: asStringArray(contributions?.shaders),
      fonts: asFontManifestArray(contributions?.fonts),
      commands: asCommandManifestArray(contributions?.commands),
      explorerActions: asExplorerActionManifestArray(contributions?.explorerActions),
    },
  };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.trim().replace(/^\.([/\\])+/, '');
}

function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function getParentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '' : normalized.slice(0, index);
}

function deriveIdFromName(name: string, fallback: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

function deriveDisplayNameFromFilePath(filePath: string): string {
  return getBaseName(filePath)
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function derivePackageId(record: PluginPackageRecord): string {
  return asString(record.manifest.id) || deriveIdFromName(record.directoryName, 'plugin-package');
}

function derivePackageName(record: PluginPackageRecord): string {
  return asString(record.manifest.name) || deriveDisplayNameFromFilePath(record.directoryName);
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

function inferFontFormat(filePath: string): string {
  const extension = getBaseName(filePath).split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'woff2':
      return 'woff2';
    case 'woff':
      return 'woff';
    case 'otf':
      return 'opentype';
    case 'ttf':
    default:
      return 'truetype';
  }
}

async function readPluginManifest(directoryPath: string): Promise<{ manifestPath: string; manifest: PluginPackageManifest } | null> {
  for (const manifestName of pluginSystemConfig.manifestNames) {
    const candidatePath = joinPlatformPath(directoryPath, manifestName);
    try {
      const text = await invoke<string>('fs_read_text_file', { path: candidatePath });
      return {
        manifestPath: candidatePath,
        manifest: parsePluginManifestText(text, candidatePath),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function listDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('fs_list_dir', { path, showHidden: false });
}

async function resolveRelativeFileEntry(baseDirectory: string, relativePath: string): Promise<FileEntry | null> {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }

  const absolutePath = joinPlatformPath(baseDirectory, normalizedRelativePath);
  const parentDirectory = getParentDirectory(absolutePath);
  const fileName = getBaseName(absolutePath);

  try {
    const entries = await listDirectory(parentDirectory);
    return entries.find(entry => !entry.is_dir && entry.name === fileName) ?? null;
  } catch {
    return null;
  }
}

async function resolvePackagePanelEntry(record: PluginPackageRecord): Promise<FileEntry | null> {
  const candidates = record.manifest.entry
    ? [record.manifest.entry]
    : [...pluginSystemConfig.packageEntryCandidates];

  for (const candidate of candidates) {
    const entry = await resolveRelativeFileEntry(record.directoryPath, candidate);
    if (entry && pluginSystemConfig.frontendExtensions.includes(entry.extension as never)) {
      return entry;
    }
  }

  return null;
}

async function resolveThemeDirectories(record: PluginPackageRecord): Promise<Array<{ name: string; path: string }>> {
  const explicitThemeDirectories = record.manifest.contributions?.themes ?? [];
  if (explicitThemeDirectories.length > 0) {
    return explicitThemeDirectories.map(directory => {
      const normalized = normalizeRelativePath(directory);
      return {
        name: getBaseName(normalized),
        path: joinPlatformPath(record.directoryPath, normalized),
      };
    });
  }

  const defaultThemesPath = joinPlatformPath(record.directoryPath, pluginSystemConfig.packageThemesDirectoryName);
  try {
    const entries = await listDirectory(defaultThemesPath);
    return entries.filter(entry => entry.is_dir).map(entry => ({ name: entry.name, path: entry.path }));
  } catch {
    return [];
  }
}

async function resolveShaderEntries(record: PluginPackageRecord): Promise<FileEntry[]> {
  const explicitShaders = record.manifest.contributions?.shaders ?? [];
  if (explicitShaders.length > 0) {
    const resolved = await Promise.all(explicitShaders.map(shaderPath => resolveRelativeFileEntry(record.directoryPath, shaderPath)));
    return resolved.filter((entry): entry is FileEntry => Boolean(entry));
  }

  const defaultShadersPath = joinPlatformPath(record.directoryPath, pluginSystemConfig.packageShadersDirectoryName);
  try {
    const entries = await listDirectory(defaultShadersPath);
    return entries.filter(entry => !entry.is_dir && pluginSystemConfig.frontendExtensions.includes(entry.extension as never));
  } catch {
    return [];
  }
}

async function loadPluginPackage(
  record: PluginPackageRecord,
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
): Promise<OverlayPluginDiscoveryResult> {
  const result: OverlayPluginDiscoveryResult = {
    plugins: [],
    themePackages: [],
    shaders: [],
    fonts: [],
    commands: [],
    explorerActions: [],
    warnings: [],
  };

  const packageId = derivePackageId(record);
  const packageName = derivePackageName(record);
  const packageWarnings: string[] = [];

  const panelEntry = await resolvePackagePanelEntry(record);
  let packagePlugin: LoadedOverlayPlugin | null = null;
  if (panelEntry) {
    try {
      const source = await invoke<string>('fs_read_text_file', { path: panelEntry.path });
      packagePlugin = await loadPluginFromSource(source, panelEntry as PluginFileEntry, hostApiFactory, {
        context: {
          id: packageId,
          name: packageName,
          filePath: panelEntry.path,
          pluginRoot: pluginSystemConfig.pluginsDirectory,
          pluginDirectory: record.directoryPath,
          backendDirectory: joinPlatformPath(record.directoryPath, pluginSystemConfig.backendDirectoryName),
        },
        defaults: {
          id: packageId,
          name: packageName,
          description: record.manifest.description,
          defaultOpen: record.manifest.defaultOpen,
          keepMounted: record.manifest.keepMounted,
        },
        diagnostics: {
          sourceKind: 'package-plugin',
          sourceLabel: packageName,
          manifestPath: record.manifestPath,
        },
      });
    } catch (error) {
      packageWarnings.push(String(error));
    }
  }

  const themeDirectories = await resolveThemeDirectories(record);
  if (themeDirectories.length > 0) {
    const themeResult = await loadThemePackagesFromDirectoryEntries(themeDirectories, record.directoryPath, {
      sourceKind: 'plugin-package',
      sourceLabel: packageName,
    });
    result.themePackages.push(...themeResult.packages);
    if (themeResult.sourceError) {
      packageWarnings.push(`themes: ${themeResult.sourceError}`);
    }
    packageWarnings.push(...themeResult.warnings);
  }

  const shaderEntries = await resolveShaderEntries(record);
  if (shaderEntries.length > 0) {
    const loadedShaders = await Promise.all(shaderEntries.map(async entry => {
      try {
        const source = await invoke<string>('fs_read_text_file', { path: entry.path });
        return loadShaderFromSource(source, entry, {
          context: {
            filePath: entry.path,
            shaderRoot: record.directoryPath,
            source: 'folder',
          },
        });
      } catch (error) {
        packageWarnings.push(`shader ${entry.name}: ${String(error)}`);
        return null;
      }
    }));
    result.shaders.push(...loadedShaders.filter((entry): entry is LoadedOverlayShader => Boolean(entry)));
  }

  result.fonts.push(
    ...(record.manifest.contributions?.fonts ?? []).map(font => ({
      id: font.id || deriveIdFromName(font.name || font.src, 'font'),
      name: font.name || deriveDisplayNameFromFilePath(font.src),
      family: font.family || `"${font.name || deriveDisplayNameFromFilePath(font.src)}", sans-serif`,
      faceName: asString(font.faceName),
      sourceUrl: toAssetUrl(joinPlatformPath(record.directoryPath, normalizeRelativePath(font.src))),
      format: font.format || inferFontFormat(font.src),
      style: asString(font.style),
      weight: asString(font.weight),
    })),
  );

  result.commands.push(
    ...((record.manifest.contributions?.commands ?? []).map(command => ({
      id: command.id || deriveIdFromName(command.name || command.command, 'command'),
      pluginId: packageId,
      pluginName: packageName,
      name: command.name || command.command,
      command: command.command,
      description: asString(command.description),
      runOnSelect: command.runOnSelect ?? false,
    }))),
  );

  result.explorerActions.push(
    ...((record.manifest.contributions?.explorerActions ?? []).map(action => ({
      id: action.id || deriveIdFromName(action.label || action.command, 'explorer-action'),
      pluginId: packageId,
      pluginName: packageName,
      label: action.label || deriveDisplayNameFromFilePath(action.command),
      command: action.command,
      description: asString(action.description),
      appliesTo: action.appliesTo ?? 'any',
      runOnSelect: action.runOnSelect ?? true,
    }))),
  );

  if (packagePlugin) {
    const capabilities: OverlayPluginCapabilitySummary = {
      panel: true,
      themes: result.themePackages.length,
      shaders: result.shaders.length,
      fonts: result.fonts.length,
      commands: result.commands.length,
      explorerActions: result.explorerActions.length,
    };
    result.plugins.push({
      ...packagePlugin,
      diagnostics: {
        ...packagePlugin.diagnostics,
        warnings: packageWarnings,
        capabilities,
      },
    });
  }
  result.warnings.push(...packageWarnings.map(warning => `${packageName}: ${warning}`));

  return result;
}

export async function discoverOverlayPlugins(
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
): Promise<OverlayPluginDiscoveryResult> {
  const emptyResult: OverlayPluginDiscoveryResult = {
    plugins: [],
    themePackages: [],
    shaders: [],
    fonts: [],
    commands: [],
    explorerActions: [],
    warnings: [],
  };

  if (!isTauri()) {
    return emptyResult;
  }

  const rootEntries = await listDirectory(pluginSystemConfig.pluginsDirectory);
  const legacyFiles = rootEntries
    .filter(entry => !entry.is_dir && pluginSystemConfig.frontendExtensions.includes(entry.extension as never))
    .sort((left, right) => left.name.localeCompare(right.name));
  const packageDirectories = rootEntries
    .filter(entry => entry.is_dir)
    .sort((left, right) => left.name.localeCompare(right.name));

  const aggregate: OverlayPluginDiscoveryResult = {
    plugins: [],
    themePackages: [],
    shaders: [],
    fonts: [],
    commands: [],
    explorerActions: [],
    warnings: [],
  };

  const legacyPluginResults = await Promise.allSettled(legacyFiles.map(async entry => {
    const source = await invoke<string>('fs_read_text_file', { path: entry.path });
    return loadPluginFromSource(source, entry as PluginFileEntry, hostApiFactory);
  }));

  legacyPluginResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      aggregate.plugins.push(result.value);
      return;
    }

    const legacyEntry = legacyFiles[index];
    const legacyName = legacyEntry?.name ?? legacyEntry?.path ?? 'legacy plugin';
    aggregate.warnings.push(`${legacyName}: ${String(result.reason)}`);
  });

  for (const directory of packageDirectories) {
    const manifest = await readPluginManifest(directory.path);
    if (!manifest) {
      continue;
    }

    try {
      const packageResult = await loadPluginPackage({
        directoryName: directory.name,
        directoryPath: directory.path,
        manifestPath: manifest.manifestPath,
        manifest: manifest.manifest,
      }, hostApiFactory);
      aggregate.plugins.push(...packageResult.plugins);
      aggregate.themePackages.push(...packageResult.themePackages);
      aggregate.shaders.push(...packageResult.shaders);
      aggregate.fonts.push(...packageResult.fonts);
      aggregate.commands.push(...packageResult.commands);
      aggregate.explorerActions.push(...packageResult.explorerActions);
      aggregate.warnings.push(...packageResult.warnings);
    } catch (error) {
      aggregate.warnings.push(`${directory.name}: ${String(error)}`);
    }
  }

  aggregate.plugins.sort((left, right) => left.name.localeCompare(right.name));
  aggregate.themePackages.sort((left, right) => left.name.localeCompare(right.name));
  aggregate.shaders.sort((left, right) => left.name.localeCompare(right.name));
  aggregate.fonts.sort((left, right) => left.name.localeCompare(right.name));
  aggregate.commands.sort((left, right) => left.name.localeCompare(right.name));
  aggregate.explorerActions.sort((left, right) => left.label.localeCompare(right.label));

  return aggregate;
}
