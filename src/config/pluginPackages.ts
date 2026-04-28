import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseToml } from 'smol-toml';
import React from 'react';

import type { OverlayRegisteredFontContribution } from './appearance';
import {
  loadExplorerActionPacksFromDirectoryEntries,
  type LoadedActionPack,
  type LoadedExplorerAction,
} from './actionPacks';
import type {
  OverlayPluginCommandContribution,
  OverlayPluginContextMenuContribution,
  OverlayPluginExplorerActionContribution,
  OverlayPluginPreviewLaneContribution,
} from './pluginContributions';
import {
  DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY,
  normalizeOverlayPluginPreviewLaneCapabilities,
  normalizeOverlayPluginPreviewLaneMatchRule,
} from './pluginPreviewLanes';
import { joinPlatformPath } from './platform';
import { pluginSystemConfig } from './plugins';
import { type LoadedOverlayThemePackage, loadThemePackagesFromDirectoryEntries } from './themePackages';
import { type LoadedOverlayShader, loadShaderFromSource } from '../components/shaderRuntime';
import {
  type BoundOverlayPluginPreviewLaneComponent,
  type LoadedOverlayPlugin,  
  type OverlayPluginApi,
  type OverlayPluginCapabilitySummary,
  type OverlayPluginContext,
  type OverlayPluginPreviewLaneProps,
  type PluginFileEntry,
  loadPluginPreviewLaneFromSource,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import type { RuntimeRelativeModuleSourceResolver } from '../runtime/moduleRuntime';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

type LooseRecord = Record<string, unknown>;
const pluginRuntimeModuleExtensions = ['ts', 'tsx', 'js', 'jsx'] as const;

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

interface PluginPackageContextMenuItemManifest {
  id?: string;
  title?: string;
  label?: string;
  description?: string;
  contexts?: Array<'entry' | 'background'>;
  appliesTo?: 'any' | 'file' | 'directory';
  group?: string;
  order?: number;
  iconName?: string;
  command?: string;
  runOnSelect?: boolean;
  backend?: {
    entry?: string;
    args?: string[];
  };
  panelRequest?: {
    panelId?: string;
    payload?: Record<string, string>;
  };
}

interface PluginPackagePreviewLaneManifest {
  id?: string;
  title?: string;
  renderer?: string;
  runtimeId?: string;
  priority?: number;
  match?: {
    appliesTo?: 'any' | 'file' | 'directory';
    extensions?: string[];
    fileNames?: string[];
  };
  capabilities?: {
    editable?: boolean;
    save?: boolean;
    export?: boolean;
    workflowTabs?: boolean;
    contextMenu?: boolean;
    prefetch?: boolean;
    closeGuard?: boolean;
  };
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
    contextMenuItems?: PluginPackageContextMenuItemManifest[];
    previewLanes?: PluginPackagePreviewLaneManifest[];
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
  actionPacks: LoadedActionPack[];
  actions: LoadedExplorerAction[];
  explorerActions: OverlayPluginExplorerActionContribution[];
  contextMenuItems: OverlayPluginContextMenuContribution[];
  previewLanes: OverlayPluginPreviewLaneContribution[];
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

function asContextMenuItemManifestArray(value: unknown): PluginPackageContextMenuItemManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const backendRecord = asRecord(record.backend);
    const panelRequestRecord = asRecord(record.panelRequest);
    const command = asString(record.command);
    const backendEntry = asString(backendRecord?.entry);
    const panelRequestPayload = asStringRecord(panelRequestRecord?.payload);
    const panelRequestPanelId = asString(panelRequestRecord?.panelId);
    if (!command && !backendEntry && !panelRequestRecord) {
      return [];
    }

    const contexts = Array.isArray(record.contexts)
      ? record.contexts.filter(
        (value): value is 'entry' | 'background' => value === 'entry' || value === 'background',
      )
      : [];
    const appliesTo = asString(record.appliesTo, 'any');

    return [{
      id: asString(record.id),
      title: asString(record.title) || asString(record.label),
      label: asString(record.label),
      description: asString(record.description),
      contexts: contexts.length > 0 ? contexts : ['entry'],
      appliesTo: appliesTo === 'file' || appliesTo === 'directory' ? appliesTo : 'any',
      group: asString(record.group),
      order: typeof record.order === 'number' && Number.isFinite(record.order)
        ? Math.round(record.order)
        : undefined,
      iconName: asString(record.iconName),
      command,
      runOnSelect: asBoolean(record.runOnSelect),
      backend: backendEntry
        ? {
          entry: backendEntry,
          args: asStringArray(backendRecord?.args),
        }
        : undefined,
      panelRequest: panelRequestRecord
        ? {
          panelId: panelRequestPanelId,
          payload: panelRequestPayload,
        }
        : undefined,
    }];
  });
}

function asPreviewLaneManifestArray(value: unknown): PluginPackagePreviewLaneManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    const record = asRecord(entry);
    const renderer = asString(record?.renderer);
    if (!record || !renderer) {
      return [];
    }

    const matchRecord = asRecord(record.match);
    const capabilitiesRecord = asRecord(record.capabilities);
    const match = normalizeOverlayPluginPreviewLaneMatchRule({
      appliesTo:
        asString(matchRecord?.appliesTo) === 'any' ||
        asString(matchRecord?.appliesTo) === 'directory' ||
        asString(matchRecord?.appliesTo) === 'file'
          ? (asString(matchRecord?.appliesTo) as 'any' | 'file' | 'directory')
          : undefined,
      extensions: asStringArray(matchRecord?.extensions),
      fileNames: asStringArray(matchRecord?.fileNames),
    });
    const capabilities = normalizeOverlayPluginPreviewLaneCapabilities({
      editable: asBoolean(capabilitiesRecord?.editable),
      save: asBoolean(capabilitiesRecord?.save),
      export: asBoolean(capabilitiesRecord?.export),
      workflowTabs: asBoolean(capabilitiesRecord?.workflowTabs),
      contextMenu: asBoolean(capabilitiesRecord?.contextMenu),
      prefetch: asBoolean(capabilitiesRecord?.prefetch),
      closeGuard: asBoolean(capabilitiesRecord?.closeGuard),
    });
    const title =
      asString(record.title) ||
      deriveDisplayNameFromFilePath(renderer);

    return [{
      id: asString(record.id) || deriveIdFromName(title, 'preview-lane'),
      title,
      renderer,
      runtimeId: asString(record.runtimeId),
      priority:
        typeof record.priority === 'number' && Number.isFinite(record.priority)
          ? Math.round(record.priority)
          : DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY,
      match,
      capabilities,
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
      contextMenuItems: asContextMenuItemManifestArray(contributions?.contextMenuItems),
      previewLanes: asPreviewLaneManifestArray(contributions?.previewLanes),
    },
  };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.trim().replace(/^\.([/\\])+/, '');
}

function normalizePackageComparisonPath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/g, '');
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
    for (const extension of pluginRuntimeModuleExtensions) {
      candidates.add(`${normalizedRelativePath}.${extension}`);
      candidates.add(`${normalizedRelativePath}/index.${extension}`);
    }
  }

  return [...candidates];
}

function isSafeRelativePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return false;
  }

  if (/^[a-zA-Z]:[\\/]/.test(normalized) || normalized.startsWith('\\\\') || normalized.startsWith('/')) {
    return false;
  }

  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 && !segments.some(segment => segment === '..' || segment === '.');
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
      const text = await commands.fsReadTextFile(candidatePath).then(unwrapTauriResult);
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
  return commands.fsListDir(path, false).then(unwrapTauriResult);
}

async function resolveRelativeFileEntry(baseDirectory: string, relativePath: string): Promise<FileEntry | null> {
  if (!isSafeRelativePath(relativePath)) {
    return null;
  }

  const normalizedRelativePath = normalizeRelativePath(relativePath);
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

function createPluginRelativeModuleSourceResolver(
  packageDirectoryPath: string,
): RuntimeRelativeModuleSourceResolver {
  return async ({ fromModulePath, specifier }) => {
    const importerRelativePath = getPackageRelativePath(packageDirectoryPath, fromModulePath);
    if (importerRelativePath == null) {
      return null;
    }

    const resolvedImportPath = resolvePackageRuntimeModuleImportPath(importerRelativePath, specifier);
    if (!resolvedImportPath) {
      return null;
    }

    for (const candidate of buildPackageRuntimeModuleCandidates(resolvedImportPath)) {
      const entry = await resolveRelativeFileEntry(packageDirectoryPath, candidate);
      if (!entry || !pluginSystemConfig.frontendExtensions.includes(entry.extension as never)) {
        continue;
      }

      const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
      return {
        modulePath: entry.path,
        source,
      };
    }

    return null;
  };
}

async function resolveThemeDirectories(record: PluginPackageRecord): Promise<Array<{ name: string; path: string }>> {
  const explicitThemeDirectories = record.manifest.contributions?.themes ?? [];
  if (explicitThemeDirectories.length > 0) {
    return explicitThemeDirectories.flatMap(directory => {
      if (!isSafeRelativePath(directory)) {
        return [];
      }

      const normalized = normalizeRelativePath(directory);
      return [{
        name: getBaseName(normalized),
        path: joinPlatformPath(record.directoryPath, normalized),
      }];
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
    actionPacks: [],
    actions: [],
    explorerActions: [],
    contextMenuItems: [],
    previewLanes: [],
    warnings: [],
  };

  const packageId = derivePackageId(record);
  const packageName = derivePackageName(record);
  const packageWarnings: string[] = [];
  const packageBackendDirectory = joinPlatformPath(
    record.directoryPath,
    pluginSystemConfig.backendDirectoryName,
  );
  const packagePreviewBaseContext: OverlayPluginContext = {
    id: packageId,
    name: packageName,
    filePath: record.manifestPath,
    pluginRoot: pluginSystemConfig.pluginsDirectory,
    pluginDirectory: record.directoryPath,
    backendDirectory: packageBackendDirectory,
  };

  const panelEntry = await resolvePackagePanelEntry(record);
  let packagePlugin: LoadedOverlayPlugin | null = null;
  if (panelEntry) {
    try {
      const source = await commands.fsReadTextFile(panelEntry.path).then(unwrapTauriResult);
      packagePlugin = await loadPluginFromSource(source, panelEntry as PluginFileEntry, hostApiFactory, {
        context: {
          id: packageId,
          name: packageName,
          filePath: panelEntry.path,
          pluginRoot: pluginSystemConfig.pluginsDirectory,
          pluginDirectory: record.directoryPath,
          backendDirectory: packageBackendDirectory,
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
        resolveRelativeModuleSource: createPluginRelativeModuleSourceResolver(record.directoryPath),
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
        const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
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
    ...(record.manifest.contributions?.fonts ?? []).flatMap(font => {
      if (!isSafeRelativePath(font.src)) {
        packageWarnings.push(`font ${font.name || font.src}: invalid relative path`);
        return [];
      }

      const normalizedSrc = normalizeRelativePath(font.src);
      return [{
        id: font.id || deriveIdFromName(font.name || font.src, 'font'),
        name: font.name || deriveDisplayNameFromFilePath(font.src),
        family: font.family || `"${font.name || deriveDisplayNameFromFilePath(font.src)}", sans-serif`,
        faceName: asString(font.faceName),
        sourceUrl: toAssetUrl(joinPlatformPath(record.directoryPath, normalizedSrc)),
        format: font.format || inferFontFormat(font.src),
        style: asString(font.style),
        weight: asString(font.weight),
      }];
    }),
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

  const packageActionsDirectory = joinPlatformPath(record.directoryPath, 'actions');
  try {
    const actionEntries = await listDirectory(packageActionsDirectory);
    const actionPackResult = await loadExplorerActionPacksFromDirectoryEntries(
      actionEntries,
      packageActionsDirectory,
      {
        sourceKind: 'plugin-action-pack',
        sourceLabel: packageName,
        sourceBadgeLabel: 'Plugin Action Pack',
        pluginId: packageId,
        pluginName: packageName,
      },
    );
    result.actionPacks.push(...actionPackResult.packs);
    result.actions.push(...actionPackResult.packs.flatMap(pack => pack.actions));
    packageWarnings.push(...actionPackResult.warnings);
    if (actionPackResult.sourceError) {
      packageWarnings.push(`actions: ${actionPackResult.sourceError}`);
    }
  } catch {
    // Plugin-local action packs are optional.
  }

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

  result.contextMenuItems.push(
    ...((record.manifest.contributions?.contextMenuItems ?? []).flatMap<OverlayPluginContextMenuContribution>((item, index) => {
      const title = item.title || item.label || deriveDisplayNameFromFilePath(item.command || item.backend?.entry || 'context-menu-item');
      const stableId = item.id || deriveIdFromName(title, 'context-menu-item');

      if (item.backend?.entry) {
        if (!isSafeRelativePath(item.backend.entry)) {
          packageWarnings.push(`context menu item ${title}: invalid backend entry path`);
          return [];
        }

        return [{
          id: `${packageId}.context-menu.${stableId}`,
          pluginId: packageId,
          pluginName: packageName,
          title,
          description: asString(item.description),
          contexts: item.contexts && item.contexts.length > 0 ? item.contexts : ['entry'],
          appliesTo: item.appliesTo ?? 'any',
          group: asString(item.group) || 'plugin',
          defaultOrder: item.order ?? (700 + index * 10),
          iconName: asString(item.iconName) || 'Puzzle',
          execution: {
            kind: 'plugin-backend' as const,
            entry: normalizeRelativePath(item.backend.entry),
            args: item.backend.args ?? [],
          },
        }];
      }

      if (item.panelRequest) {
        return [{
          id: `${packageId}.context-menu.${stableId}`,
          pluginId: packageId,
          pluginName: packageName,
          title,
          description: asString(item.description),
          contexts: item.contexts && item.contexts.length > 0 ? item.contexts : ['entry'],
          appliesTo: item.appliesTo ?? 'any',
          group: asString(item.group) || 'plugin',
          defaultOrder: item.order ?? (700 + index * 10),
          iconName: asString(item.iconName) || 'Puzzle',
          execution: {
            kind: 'panel-request' as const,
            panelId: asString(item.panelRequest.panelId) || packageId,
            payload: item.panelRequest.payload ?? {},
          },
        }];
      }

      if (!item.command) {
        return [];
      }

      return [{
        id: `${packageId}.context-menu.${stableId}`,
        pluginId: packageId,
        pluginName: packageName,
        title,
        description: asString(item.description),
        contexts: item.contexts && item.contexts.length > 0 ? item.contexts : ['entry'],
        appliesTo: item.appliesTo ?? 'any',
        group: asString(item.group) || 'plugin',
        defaultOrder: item.order ?? (700 + index * 10),
        iconName: asString(item.iconName) || 'Puzzle',
        execution: {
          kind: 'terminal-template' as const,
          command: item.command,
          runOnSelect: item.runOnSelect ?? true,
        },
      }];
    })),
  );

  const previewModuleResolver = createPluginRelativeModuleSourceResolver(
    record.directoryPath,
  );
  const previewRendererCache = new Map<
    string,
    React.ComponentType<OverlayPluginPreviewLaneProps>
  >();
  const loadedPreviewLanes: Array<
    OverlayPluginPreviewLaneContribution | null
  > = await Promise.all(
    (record.manifest.contributions?.previewLanes ?? []).map(
      async (previewLane) => {
        const laneTitle =
          previewLane.title ||
          deriveDisplayNameFromFilePath(previewLane.renderer || 'preview-lane');
        const stableId =
          previewLane.id || deriveIdFromName(laneTitle, 'preview-lane');
        if (!previewLane.renderer || !isSafeRelativePath(previewLane.renderer)) {
          packageWarnings.push(
            `preview lane ${laneTitle}: invalid renderer path`,
          );
          return null;
        }

        const normalizedRendererEntry = normalizeRelativePath(
          previewLane.renderer,
        );
        let rendererComponent =
          previewRendererCache.get(normalizedRendererEntry) ?? null;
        if (!rendererComponent) {
          const rendererEntry = await resolveRelativeFileEntry(
            record.directoryPath,
            normalizedRendererEntry,
          );
          if (
            !rendererEntry ||
            !pluginSystemConfig.frontendExtensions.includes(
              rendererEntry.extension as never,
            )
          ) {
            packageWarnings.push(
              `preview lane ${laneTitle}: renderer ${normalizedRendererEntry} could not be resolved`,
            );
            return null;
          }

          try {
            const source = await commands
              .fsReadTextFile(rendererEntry.path)
              .then(unwrapTauriResult);
            rendererComponent = await loadPluginPreviewLaneFromSource(
              source,
              rendererEntry as PluginFileEntry,
              {
                resolveRelativeModuleSource: previewModuleResolver,
              },
            );
            previewRendererCache.set(normalizedRendererEntry, rendererComponent);
          } catch (error) {
            packageWarnings.push(
              `preview lane ${laneTitle}: ${String(error)}`,
            );
            return null;
          }
        }

        const rendererFilePath = joinPlatformPath(
          record.directoryPath,
          normalizedRendererEntry,
        );
        const previewLaneContext: OverlayPluginContext = {
          ...packagePreviewBaseContext,
          filePath: rendererFilePath,
        };
        const previewLaneApi = hostApiFactory(previewLaneContext);
        const boundComponent: BoundOverlayPluginPreviewLaneComponent = (
          props,
        ) =>
          React.createElement(rendererComponent!, {
            ...props,
            api: previewLaneApi,
            plugin: previewLaneContext,
          });

        return {
          id: `${packageId}.preview-lane.${stableId}`,
          pluginId: packageId,
          pluginName: packageName,
          title: laneTitle,
          priority:
            previewLane.priority ??
            DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY,
          rendererEntry: normalizedRendererEntry,
          runtimeId: previewLane.runtimeId?.trim() || null,
          match: previewLane.match
            ? normalizeOverlayPluginPreviewLaneMatchRule(previewLane.match)
            : normalizeOverlayPluginPreviewLaneMatchRule(undefined),
          capabilities: previewLane.capabilities
            ? normalizeOverlayPluginPreviewLaneCapabilities(
                previewLane.capabilities,
              )
            : normalizeOverlayPluginPreviewLaneCapabilities(undefined),
          component: boundComponent,
        } satisfies OverlayPluginPreviewLaneContribution;
      },
    ),
  );
  result.previewLanes.push(
    ...loadedPreviewLanes.filter(
      (
        contribution,
      ): contribution is OverlayPluginPreviewLaneContribution =>
        contribution != null,
    ),
  );

  if (packagePlugin) {
    const capabilities: OverlayPluginCapabilitySummary = {
      panel: true,
      themes: result.themePackages.length,
      shaders: result.shaders.length,
      fonts: result.fonts.length,
      commands: result.commands.length,
      actions: result.actions.length,
      explorerActions: result.explorerActions.length,
      contextMenuItems: result.contextMenuItems.length,
      previewLanes: result.previewLanes.length,
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
    actionPacks: [],
    actions: [],
    explorerActions: [],
    contextMenuItems: [],
    previewLanes: [],
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
    actionPacks: [],
    actions: [],
    explorerActions: [],
    contextMenuItems: [],
    previewLanes: [],
    warnings: [],
  };

  const legacyPluginResults = await Promise.allSettled(legacyFiles.map(async entry => {
    const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
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
      aggregate.actionPacks.push(...packageResult.actionPacks);
      aggregate.actions.push(...packageResult.actions);
      aggregate.explorerActions.push(...packageResult.explorerActions);
      aggregate.contextMenuItems.push(...packageResult.contextMenuItems);
      aggregate.previewLanes.push(...packageResult.previewLanes);
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
  aggregate.actionPacks.sort((left, right) => left.name.localeCompare(right.name));
  aggregate.actions.sort((left, right) => left.title.localeCompare(right.title));
  aggregate.explorerActions.sort((left, right) => left.label.localeCompare(right.label));
  aggregate.contextMenuItems.sort((left, right) => left.title.localeCompare(right.title));

  return aggregate;
}
