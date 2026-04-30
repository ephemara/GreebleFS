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
  OverlayPluginSettingsSlotContribution,
  OverlayPluginWorkflowContribution,
} from './pluginContributions';
import {
  DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY,
  normalizeOverlayPluginPreviewLaneCapabilities,
  normalizeOverlayPluginPreviewLaneMatchRule,
  normalizeOverlayPluginPreviewLaneWorkbenchChrome,
} from './pluginPreviewLanes';
import type {
  ExplorerPreviewWildcardWorkflowTab,
  ExplorerPreviewWorkbenchChromeMetadataInput,
} from './previewWorkbenchChrome';
import {
  normalizeOverlayPluginSettingsValueMap,
  type OverlayPluginSettingsFieldDefinition,
  type OverlayPluginSettingsFieldKind,
  type OverlayPluginSettingsOptionDefinition,
} from './pluginSettings';
import { joinPlatformPath } from './platform';
import {
  getPluginBackendDirectory,
  getPluginDirectory,
  pluginSystemConfig,
} from './plugins';
import { type LoadedOverlayThemePackage, loadThemePackagesFromDirectoryEntries } from './themePackages';
import { type LoadedOverlayShader, loadShaderFromSource } from '../components/shaderRuntime';
import {
  type BoundOverlayPluginPreviewLaneComponent,
  type BoundOverlayPluginSettingsSlotComponent,
  type BoundOverlayPluginWorkflowComponent,
  type LoadedOverlayPlugin,  
  type OverlayPluginApi,
  type OverlayPluginCapabilitySummary,
  type OverlayPluginContext,
  type OverlayPluginPreviewLaneProps,
  type OverlayPluginSettingsSlotProps,
  type OverlayPluginWorkflowDefinition,
  type OverlayPluginTestFile,
  type PluginFileEntry,
  loadPluginPreviewLaneFromSource,
  loadPluginSettingsSlotFromSource,
  loadPluginWorkflowFromSource,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import type { OverlayPluginWorkflowDescriptor } from '../components/explorer/explorerWorkflowContracts';
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

interface PluginPackagePreviewWorkbenchChromeManifest
  extends ExplorerPreviewWorkbenchChromeMetadataInput {}

interface PluginPackagePreviewLaneManifest {
  id?: string;
  title?: string;
  renderer?: string;
  rendererEntry?: string;
  runtimeId?: string;
  runtimeRef?: string;
  priority?: number;
  match?: {
    appliesTo?: 'any' | 'file' | 'directory';
    extensions?: string[];
    fileNames?: string[];
    previewKinds?: string[];
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
  workflowTabs?: PluginPackagePreviewWorkbenchChromeManifest;
  workbenchChrome?: PluginPackagePreviewWorkbenchChromeManifest;
  previewChrome?: PluginPackagePreviewWorkbenchChromeManifest;
}

interface PluginPackageSettingsSlotManifest {
  id?: string;
  title?: string;
  description?: string;
  iconName?: string;
  keywords?: string[];
  order?: number;
  renderer?: string;
  rendererEntry?: string;
  defaults?: Record<string, unknown>;
  fields?: OverlayPluginSettingsFieldDefinition[];
}

interface PluginPackageWorkflowManifest {
  id?: string;
  title?: string;
  description?: string;
  iconName?: string;
  keywords?: string[];
  entry?: string;
  renderer?: string;
  rendererEntry?: string;
  contexts?: OverlayPluginWorkflowDescriptor['contexts'];
  defaultSize?: OverlayPluginWorkflowDescriptor['defaultSize'];
}

interface PluginPackageMobilePaneManifest {
  id?: string;
  title?: string;
  description?: string;
  iconName?: string;
  order?: number;
  category?: string;
  kind?: string;
  renderer?: string;
  rendererEntry?: string;
  styles?: string[];
}

interface PluginPackageTestFileManifest {
  id?: string;
  label?: string;
  path: string;
  description?: string;
  kind?: 'file' | 'directory';
}

interface PluginPackageManifest {
  version?: number | string;
  id?: string;
  name?: string;
  displayName?: string;
  description?: string;
  apiVersion?: string;
  entry?: string;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  category?: string;
  tags?: string[];
  testFiles?: PluginPackageTestFileManifest[];
  permissions?: Record<string, unknown>;
  runtimes?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  debugSources?: string[];
  contributions?: {
    themes?: string[];
    shaders?: string[];
    fonts?: PluginPackageFontManifest[];
    commands?: PluginPackageCommandManifest[];
    explorerActions?: PluginPackageExplorerActionManifest[];
    contextMenuItems?: PluginPackageContextMenuItemManifest[];
    previewLanes?: PluginPackagePreviewLaneManifest[];
    settingsSlots?: PluginPackageSettingsSlotManifest[];
    workflows?: PluginPackageWorkflowManifest[];
    mobilePanes?: PluginPackageMobilePaneManifest[];
  };
}

interface PluginPackageRecord {
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: PluginPackageManifest;
  modified: number;
}

export interface OverlayPluginDiscoveryOptions {
  disabledPluginIds?: Iterable<string> | Record<string, boolean> | null;
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
  settingsSlots: OverlayPluginSettingsSlotContribution[];
  workflows: OverlayPluginWorkflowContribution[];
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

function asPreviewWildcardWorkflowTabManifestArray(
  value: unknown,
): Partial<ExplorerPreviewWildcardWorkflowTab>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const baseMode = asString(record.baseMode);
    return [{
      id: asString(record.id),
      label: asString(record.label),
      baseMode: baseMode === 'preview' || baseMode === 'edit'
        ? baseMode
        : undefined,
    }];
  });
}

function asPreviewWorkbenchChromeManifest(
  value: unknown,
): PluginPackagePreviewWorkbenchChromeManifest | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const topBarDensity = asString(record.topBarDensity);
  return {
    includePreviewTab: asBoolean(record.includePreviewTab),
    includeEditTab: asBoolean(record.includeEditTab),
    wildcardTabs: asPreviewWildcardWorkflowTabManifestArray(
      record.wildcardTabs ?? record.tabs,
    ),
    topBarLayoutId: asString(record.topBarLayoutId) || null,
    topBarDensity: topBarDensity === 'compact' || topBarDensity === 'regular'
      ? topBarDensity
      : null,
  };
}

function asPreviewLaneManifestArray(value: unknown): PluginPackagePreviewLaneManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    const record = asRecord(entry);
    const renderer = asString(record?.renderer) || asString(record?.rendererEntry);
    if (!record || !renderer) {
      return [];
    }

    const matchRecord = asRecord(record.match) ?? asRecord(record.matchRule);
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
      previewKinds: asStringArray(matchRecord?.previewKinds),
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
    const workbenchChrome = asPreviewWorkbenchChromeManifest(
      record.workbenchChrome ?? record.previewChrome ?? record.workflowTabs,
    );
    const title =
      asString(record.title) ||
      deriveDisplayNameFromFilePath(renderer);

    return [{
      id: asString(record.id) || deriveIdFromName(title, 'preview-lane'),
      title,
      renderer,
      rendererEntry: asString(record.rendererEntry),
      runtimeId: asString(record.runtimeId) || asString(record.runtimeRef),
      runtimeRef: asString(record.runtimeRef),
      priority:
        typeof record.priority === 'number' && Number.isFinite(record.priority)
          ? Math.round(record.priority)
          : DEFAULT_OVERLAY_PLUGIN_PREVIEW_LANE_PRIORITY,
      match,
      capabilities,
      workflowTabs: workbenchChrome,
      workbenchChrome,
      previewChrome: workbenchChrome,
    }];
  });
}

function asSettingsOptionDefinitionArray(
  value: unknown,
): OverlayPluginSettingsOptionDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === 'string' && entry.trim()) {
      const normalizedValue = entry.trim();
      return [{
        value: normalizedValue,
        label: normalizedValue,
      }];
    }

    const record = asRecord(entry);
    const optionValue = asString(record?.value);
    if (!record || !optionValue) {
      return [];
    }

    return [{
      value: optionValue,
      label: asString(record.label) || optionValue,
      description: asString(record.description) || undefined,
    }];
  });
}

function normalizePluginSettingsFieldKind(
  kind: unknown,
  hasOptions: boolean,
): OverlayPluginSettingsFieldKind {
  const normalizedKind = asString(kind);
  if (
    normalizedKind === 'boolean' ||
    normalizedKind === 'text' ||
    normalizedKind === 'textarea' ||
    normalizedKind === 'number' ||
    normalizedKind === 'select' ||
    normalizedKind === 'json' ||
    normalizedKind === 'path-list' ||
    normalizedKind === 'extension-list'
  ) {
    return normalizedKind;
  }
  return hasOptions ? 'select' : 'text';
}

function asSettingsFieldDefinitionArray(
  value: unknown,
): OverlayPluginSettingsFieldDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const optionDefinitions = asSettingsOptionDefinitionArray(record.options);
    const normalizedKind = normalizePluginSettingsFieldKind(
      record.kind,
      optionDefinitions.length > 0,
    );
    const label = asString(record.label) || `Setting ${index + 1}`;
    const fieldId =
      asString(record.id) || deriveIdFromName(label, 'plugin-setting');
    const defaultValue = normalizeOverlayPluginSettingsValueMap({
      [fieldId]: record.defaultValue,
    })[fieldId];

    return [{
      id: fieldId,
      label,
      description: asString(record.description) || undefined,
      kind: normalizedKind,
      placeholder: asString(record.placeholder) || undefined,
      defaultValue,
      min:
        typeof record.min === 'number' && Number.isFinite(record.min)
          ? record.min
          : undefined,
      max:
        typeof record.max === 'number' && Number.isFinite(record.max)
          ? record.max
          : undefined,
      step:
        typeof record.step === 'number' && Number.isFinite(record.step)
          ? record.step
          : undefined,
      options: optionDefinitions,
      order:
        typeof record.order === 'number' && Number.isFinite(record.order)
          ? Math.round(record.order)
          : index * 10,
      keywords: asStringArray(record.keywords),
    }];
  });
}

function asSettingsSlotManifestArray(
  value: unknown,
): PluginPackageSettingsSlotManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const title = asString(record.title) || `Plugin Settings ${index + 1}`;
    const renderer =
      asString(record.renderer) || asString(record.rendererEntry);

    return [{
      id: asString(record.id) || deriveIdFromName(title, 'settings-slot'),
      title,
      description: asString(record.description) || undefined,
      iconName: asString(record.iconName) || undefined,
      keywords: asStringArray(record.keywords),
      order:
        typeof record.order === 'number' && Number.isFinite(record.order)
          ? Math.round(record.order)
          : index * 100,
      renderer: renderer || undefined,
      rendererEntry: asString(record.rendererEntry) || undefined,
      defaults: normalizeOverlayPluginSettingsValueMap(record.defaults),
      fields: asSettingsFieldDefinitionArray(record.fields),
    }];
  });
}

function asWorkflowContextManifestArray(
  value: unknown,
): OverlayPluginWorkflowDescriptor['contexts'] {
  const contexts = asStringArray(value).filter(
    (entry): entry is OverlayPluginWorkflowDescriptor['contexts'][number] =>
      entry === 'entry' ||
      entry === 'background' ||
      entry === 'multi-select' ||
      entry === 'search-result' ||
      entry === 'preview-pane',
  );
  return contexts.length > 0 ? contexts : ['background'];
}

function asWorkflowDefaultSize(
  value: unknown,
): OverlayPluginWorkflowDescriptor['defaultSize'] {
  const normalized = asString(value);
  if (
    normalized === 'sm' ||
    normalized === 'md' ||
    normalized === 'lg' ||
    normalized === 'xl'
  ) {
    return normalized;
  }
  return 'md';
}

function asWorkflowManifestArray(
  value: unknown,
): PluginPackageWorkflowManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const renderer =
      asString(record.entry) ||
      asString(record.renderer) ||
      asString(record.rendererEntry);
    if (!renderer) {
      return [];
    }

    const title = asString(record.title) || `Workflow ${index + 1}`;
    return [{
      id: asString(record.id) || deriveIdFromName(title, 'workflow'),
      title,
      description: asString(record.description) || undefined,
      iconName: asString(record.iconName) || undefined,
      keywords: asStringArray(record.keywords),
      entry: renderer,
      renderer,
      rendererEntry: asString(record.rendererEntry) || undefined,
      contexts: asWorkflowContextManifestArray(record.contexts),
      defaultSize: asWorkflowDefaultSize(record.defaultSize),
    }];
  });
}

function asMobilePaneManifestArray(
  value: unknown,
): PluginPackageMobilePaneManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap<PluginPackageMobilePaneManifest>((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const title = asString(record.title) || asString(record.name)
      || `Mobile Pane ${index + 1}`;

    return [{
      id: asString(record.id) || deriveIdFromName(title, 'mobile-pane'),
      title,
      description: asString(record.description) || undefined,
      iconName: asString(record.iconName) || undefined,
      order:
        typeof record.order === 'number' && Number.isFinite(record.order)
          ? Math.round(record.order)
          : index * 100,
      category: asString(record.category) || undefined,
      kind: asString(record.kind) || undefined,
      renderer: asString(record.renderer) || undefined,
      rendererEntry: asString(record.rendererEntry) || undefined,
      styles: asStringArray(record.styles),
    }];
  });
}

function normalizeDisabledPluginIdSet(
  disabledPluginIds: OverlayPluginDiscoveryOptions['disabledPluginIds'],
): ReadonlySet<string> {
  if (!disabledPluginIds) {
    return new Set();
  }

  if (
    typeof disabledPluginIds !== 'string' &&
    Symbol.iterator in Object(disabledPluginIds)
  ) {
    return new Set(
      [...(disabledPluginIds as Iterable<string>)]
        .map(pluginId => pluginId.trim())
        .filter(Boolean),
    );
  }

  return new Set(
    Object.entries(disabledPluginIds)
      .filter(([, enabled]) => enabled === false)
      .map(([pluginId]) => pluginId.trim())
      .filter(Boolean),
  );
}

function isPluginDisabled(
  disabledPluginIds: ReadonlySet<string>,
  pluginId: string,
): boolean {
  return disabledPluginIds.has(pluginId.trim());
}

function asTestFileManifestArray(value: unknown): PluginPackageTestFileManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap<PluginPackageTestFileManifest>((entry, index) => {
    if (typeof entry === 'string' && entry.trim()) {
      const normalizedPath = entry.trim();
      return [{
        id: deriveIdFromName(normalizedPath, `test-file-${index + 1}`),
        label: deriveDisplayNameFromFilePath(normalizedPath),
        path: normalizedPath,
        kind: 'file',
      }];
    }

    const record = asRecord(entry);
    const path = asString(record?.path);
    if (!record || !path) {
      return [];
    }

    return [{
      id: asString(record.id) || deriveIdFromName(path, `test-file-${index + 1}`),
      label: asString(record.label) || deriveDisplayNameFromFilePath(path),
      path,
      description: asString(record.description) || undefined,
      kind: asString(record.kind) === 'directory' ? 'directory' : 'file',
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
    version:
      typeof source.version === 'number' || typeof source.version === 'string'
        ? source.version
        : 1,
    id: asString(source.id),
    name: asString(source.name),
    displayName: asString(source.displayName),
    description: asString(source.description),
    apiVersion: asString(source.apiVersion),
    entry: asString(source.entry),
    defaultOpen: asBoolean(source.defaultOpen),
    keepMounted: asBoolean(source.keepMounted),
    category: asString(source.category) || undefined,
    tags: asStringArray(source.tags),
    testFiles: asTestFileManifestArray(source.testFiles),
    permissions: asRecord(source.permissions) ?? undefined,
    runtimes: Array.isArray(source.runtimes)
      ? source.runtimes.filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)))
      : undefined,
    artifacts: Array.isArray(source.artifacts)
      ? source.artifacts.filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)))
      : undefined,
    debugSources: asStringArray(source.debugSources),
    contributions: {
      themes: asStringArray(contributions?.themes),
      shaders: asStringArray(contributions?.shaders),
      fonts: asFontManifestArray(contributions?.fonts),
      commands: asCommandManifestArray(contributions?.commands),
      explorerActions: asExplorerActionManifestArray(contributions?.explorerActions),
      contextMenuItems: asContextMenuItemManifestArray(contributions?.contextMenuItems),
      previewLanes: asPreviewLaneManifestArray(contributions?.previewLanes),
      settingsSlots: asSettingsSlotManifestArray(contributions?.settingsSlots),
      workflows: asWorkflowManifestArray(contributions?.workflows),
      mobilePanes: asMobilePaneManifestArray(contributions?.mobilePanes),
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
  return (
    asString(record.manifest.displayName) ||
    asString(record.manifest.name) ||
    deriveDisplayNameFromFilePath(record.directoryName)
  );
}

function estimatePackageManifestCapabilities(
  record: PluginPackageRecord,
): OverlayPluginCapabilitySummary {
  const contributions = record.manifest.contributions;
  return {
    panel: Boolean(record.manifest.entry),
    mobilePanes: contributions?.mobilePanes?.length ?? 0,
    themes: contributions?.themes?.length ?? 0,
    shaders: contributions?.shaders?.length ?? 0,
    fonts: contributions?.fonts?.length ?? 0,
    commands: contributions?.commands?.length ?? 0,
    actions: 0,
    explorerActions: contributions?.explorerActions?.length ?? 0,
    contextMenuItems: contributions?.contextMenuItems?.length ?? 0,
    previewLanes: contributions?.previewLanes?.length ?? 0,
    settingsSlots: contributions?.settingsSlots?.length ?? 0,
  };
}

function createDisabledLegacyPlugin(entry: FileEntry): LoadedOverlayPlugin {
  const pluginId = deriveIdFromName(entry.name, 'plugin');
  return {
    id: pluginId,
    name: deriveDisplayNameFromFilePath(entry.name),
    filePath: entry.path,
    pluginRoot: pluginSystemConfig.pluginsDirectory,
    pluginDirectory: getPluginDirectory(pluginId),
    backendDirectory: getPluginBackendDirectory(pluginId),
    enablementKey: pluginId,
    modified: entry.modified,
    enabled: false,
    description: undefined,
    defaultOpen: false,
    keepMounted: false,
    component: null,
    error: null,
    diagnostics: {
      sourceKind: 'file-plugin',
      sourceLabel: entry.path,
      category: 'General',
      tags: [],
      testFiles: [],
      warnings: [],
      capabilities: {
        panel: true,
        themes: 0,
        shaders: 0,
        fonts: 0,
        commands: 0,
        actions: 0,
        explorerActions: 0,
        contextMenuItems: 0,
        previewLanes: 0,
        settingsSlots: 0,
      },
    },
  };
}

function createDisabledPackagePlugin(
  record: PluginPackageRecord,
): LoadedOverlayPlugin {
  const packageId = derivePackageId(record);
  const packageName = derivePackageName(record);
  const packageBackendDirectory = joinPlatformPath(
    record.directoryPath,
    pluginSystemConfig.backendDirectoryName,
  );
  return {
    id: packageId,
    name: packageName,
    description: record.manifest.description,
    filePath: record.manifestPath,
    pluginRoot: pluginSystemConfig.pluginsDirectory,
    pluginDirectory: record.directoryPath,
    backendDirectory: packageBackendDirectory,
    enablementKey: packageId,
    modified: record.modified,
    enabled: false,
    defaultOpen: false,
    keepMounted: false,
    component: null,
    error: null,
    diagnostics: {
      sourceKind: 'package-plugin',
      sourceLabel: packageName,
      manifestPath: record.manifestPath,
      category: record.manifest.category || 'General',
      tags: record.manifest.tags ?? [],
      testFiles: resolvePackageTestFiles(record),
      warnings: [],
      capabilities: estimatePackageManifestCapabilities(record),
    },
  };
}

function resolvePackageTestFiles(record: PluginPackageRecord): OverlayPluginTestFile[] {
  return (record.manifest.testFiles ?? []).flatMap((testFile) => {
    if (!isSafeRelativePath(testFile.path)) {
      return [];
    }

    const normalizedPath = normalizeRelativePath(testFile.path);
    const extension = getBaseName(normalizedPath).split('.').pop()?.toLowerCase() ?? '';
    return [{
      id: testFile.id || deriveIdFromName(normalizedPath, 'test-file'),
      label: testFile.label || deriveDisplayNameFromFilePath(normalizedPath),
      path: joinPlatformPath(record.directoryPath, normalizedPath),
      description: testFile.description,
      extension,
      isDirectory: testFile.kind === 'directory',
    }];
  });
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
  disabledPluginIds: ReadonlySet<string>,
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
    settingsSlots: [],
    workflows: [],
    warnings: [],
  };

  const packageId = derivePackageId(record);
  const packageName = derivePackageName(record);
  const packageCategory = record.manifest.category || 'General';
  const packageTags = record.manifest.tags ?? [];
  const packageTestFiles = resolvePackageTestFiles(record);
  const packageWarnings: string[] = [];
  if (isPluginDisabled(disabledPluginIds, packageId)) {
    result.plugins.push(createDisabledPackagePlugin(record));
    return result;
  }

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
    enablementKey: packageId,
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
          enablementKey: packageId,
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
          category: packageCategory,
          tags: packageTags,
          testFiles: packageTestFiles,
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
            api: previewLaneApi.bindExecutionContext(props.executionContext),
            plugin: previewLaneContext,
          });
        const capabilities = previewLane.capabilities
          ? normalizeOverlayPluginPreviewLaneCapabilities(
              previewLane.capabilities,
            )
          : normalizeOverlayPluginPreviewLaneCapabilities(undefined);
        const workbenchChrome =
          normalizeOverlayPluginPreviewLaneWorkbenchChrome(
            previewLane.workbenchChrome ??
              previewLane.previewChrome ??
              previewLane.workflowTabs,
            {
              includeEditTab: capabilities.editable,
            },
          );

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
          capabilities,
          workbenchChrome,
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

  const workflowModuleResolver = createPluginRelativeModuleSourceResolver(
    record.directoryPath,
  );
  const workflowDefinitionCache = new Map<
    string,
    OverlayPluginWorkflowDefinition
  >();
  const loadedWorkflows: Array<
    OverlayPluginWorkflowContribution | null
  > = await Promise.all(
    (record.manifest.contributions?.workflows ?? []).map(
      async (workflowManifest) => {
        const workflowTitle = workflowManifest.title || 'Plugin Workflow';
        const stableId =
          workflowManifest.id || deriveIdFromName(workflowTitle, 'workflow');
        const rendererEntryValue = workflowManifest.entry?.trim() || null;
        if (!rendererEntryValue || !isSafeRelativePath(rendererEntryValue)) {
          packageWarnings.push(
            `workflow ${workflowTitle}: invalid renderer path`,
          );
          return null;
        }

        const normalizedRendererEntry = normalizeRelativePath(
          rendererEntryValue,
        );
        let workflowDefinition =
          workflowDefinitionCache.get(normalizedRendererEntry) ?? null;
        if (!workflowDefinition) {
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
              `workflow ${workflowTitle}: renderer ${normalizedRendererEntry} could not be resolved`,
            );
            return null;
          }

          try {
            const source = await commands
              .fsReadTextFile(rendererEntry.path)
              .then(unwrapTauriResult);
            workflowDefinition = await loadPluginWorkflowFromSource(
              source,
              rendererEntry as PluginFileEntry,
              {
                resolveRelativeModuleSource: workflowModuleResolver,
              },
            );
            workflowDefinitionCache.set(
              normalizedRendererEntry,
              workflowDefinition,
            );
          } catch (error) {
            packageWarnings.push(
              `workflow ${workflowTitle}: ${String(error)}`,
            );
            return null;
          }
        }

        const rendererFilePath = joinPlatformPath(
          record.directoryPath,
          normalizedRendererEntry,
        );
        const workflowContext: OverlayPluginContext = {
          ...packagePreviewBaseContext,
          filePath: rendererFilePath,
        };
        const workflowApi = hostApiFactory(workflowContext);
        const boundComponent: BoundOverlayPluginWorkflowComponent = (
          props,
        ) =>
          React.createElement(workflowDefinition!.component, {
            ...props,
            api: workflowApi.bindExecutionContext(props.executionContext),
            plugin: workflowContext,
          });
        const runtimeDescriptor = workflowDefinition.descriptor ?? {};

        return {
          id: `${packageId}.workflow.${stableId}`,
          pluginId: packageId,
          pluginName: packageName,
          title: runtimeDescriptor.title ?? workflowTitle,
          description:
            runtimeDescriptor.description ?? workflowManifest.description,
          iconName:
            runtimeDescriptor.iconName ?? workflowManifest.iconName,
          keywords: [
            ...(workflowManifest.keywords ?? []),
            ...(runtimeDescriptor.keywords ?? []),
          ].filter(Boolean),
          contexts:
            runtimeDescriptor.contexts ?? workflowManifest.contexts ?? ['background'],
          defaultSize:
            runtimeDescriptor.defaultSize ??
            workflowManifest.defaultSize ??
            'md',
          rendererEntry: normalizedRendererEntry,
          component: boundComponent,
        } satisfies OverlayPluginWorkflowContribution;
      },
    ),
  );
  result.workflows.push(
    ...loadedWorkflows.filter(
      (
        contribution,
      ): contribution is OverlayPluginWorkflowContribution =>
        contribution != null,
    ),
  );

  const settingsModuleResolver = createPluginRelativeModuleSourceResolver(
    record.directoryPath,
  );
  const settingsRendererCache = new Map<
    string,
    React.ComponentType<OverlayPluginSettingsSlotProps>
  >();
  const loadedSettingsSlots: Array<
    OverlayPluginSettingsSlotContribution | null
  > = await Promise.all(
    (record.manifest.contributions?.settingsSlots ?? []).map(
      async (settingsSlot) => {
        const slotTitle = settingsSlot.title || 'Plugin Settings';
        const stableId =
          settingsSlot.id || deriveIdFromName(slotTitle, 'settings-slot');
        const rendererEntryValue = settingsSlot.renderer?.trim() || null;
        let normalizedRendererEntry: string | null = null;
        let boundComponent: BoundOverlayPluginSettingsSlotComponent | null = null;

        if (rendererEntryValue) {
          if (!isSafeRelativePath(rendererEntryValue)) {
            packageWarnings.push(
              `settings slot ${slotTitle}: invalid renderer path`,
            );
          } else {
            normalizedRendererEntry = normalizeRelativePath(rendererEntryValue);
            let rendererComponent =
              settingsRendererCache.get(normalizedRendererEntry) ?? null;
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
                  `settings slot ${slotTitle}: renderer ${normalizedRendererEntry} could not be resolved`,
                );
                normalizedRendererEntry = null;
              } else {
                try {
                  const source = await commands
                    .fsReadTextFile(rendererEntry.path)
                    .then(unwrapTauriResult);
                  rendererComponent = await loadPluginSettingsSlotFromSource(
                    source,
                    rendererEntry as PluginFileEntry,
                    {
                      resolveRelativeModuleSource: settingsModuleResolver,
                    },
                  );
                  settingsRendererCache.set(
                    normalizedRendererEntry,
                    rendererComponent,
                  );
                } catch (error) {
                  packageWarnings.push(
                    `settings slot ${slotTitle}: ${String(error)}`,
                  );
                  normalizedRendererEntry = null;
                }
              }
            }

            if (rendererComponent && normalizedRendererEntry) {
              const rendererFilePath = joinPlatformPath(
                record.directoryPath,
                normalizedRendererEntry,
              );
              const settingsSlotContext: OverlayPluginContext = {
                ...packagePreviewBaseContext,
                filePath: rendererFilePath,
              };
              const settingsSlotApi = hostApiFactory(settingsSlotContext);
              boundComponent = (props) =>
                React.createElement(rendererComponent!, {
                  ...props,
                  api: settingsSlotApi,
                  plugin: settingsSlotContext,
                });
            }
          }
        }

        if (
          !boundComponent &&
          (settingsSlot.fields?.length ?? 0) === 0 &&
          Object.keys(settingsSlot.defaults ?? {}).length === 0
        ) {
          packageWarnings.push(
            `settings slot ${slotTitle}: no schema/defaults or renderable component were discovered`,
          );
          return null;
        }

        return {
          id: `${packageId}.settings-slot.${stableId}`,
          pluginId: packageId,
          pluginName: packageName,
          title: slotTitle,
          description: settingsSlot.description,
          iconName: settingsSlot.iconName,
          keywords: settingsSlot.keywords ?? [],
          order: settingsSlot.order ?? 0,
          rendererEntry: normalizedRendererEntry,
          defaults: normalizeOverlayPluginSettingsValueMap(
            settingsSlot.defaults,
          ),
          fields: [...(settingsSlot.fields ?? [])].sort(
            (left, right) => left.order - right.order,
          ),
          component: boundComponent,
        } satisfies OverlayPluginSettingsSlotContribution;
      },
    ),
  );
  result.settingsSlots.push(
    ...loadedSettingsSlots.filter(
      (
        contribution,
      ): contribution is OverlayPluginSettingsSlotContribution =>
        contribution != null,
    ),
  );

  if (packagePlugin) {
    const capabilities: OverlayPluginCapabilitySummary = {
      panel: true,
      mobilePanes: record.manifest.contributions?.mobilePanes?.length ?? 0,
      themes: result.themePackages.length,
      shaders: result.shaders.length,
      fonts: result.fonts.length,
      commands: result.commands.length,
      actions: result.actions.length,
      explorerActions: result.explorerActions.length,
      contextMenuItems: result.contextMenuItems.length,
      previewLanes: result.previewLanes.length,
      settingsSlots: result.settingsSlots.length,
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
  options: OverlayPluginDiscoveryOptions = {},
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
    settingsSlots: [],
    workflows: [],
    warnings: [],
  };

  if (!isTauri()) {
    return emptyResult;
  }

  const disabledPluginIds = normalizeDisabledPluginIdSet(options.disabledPluginIds);
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
    settingsSlots: [],
    workflows: [],
    warnings: [],
  };

  const legacyPluginResults = await Promise.allSettled(legacyFiles.map(async entry => {
    const enablementKey = deriveIdFromName(entry.name, 'plugin');
    if (isPluginDisabled(disabledPluginIds, enablementKey)) {
      return createDisabledLegacyPlugin(entry);
    }

    const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
    return loadPluginFromSource(source, entry as PluginFileEntry, hostApiFactory, {
      context: {
        enablementKey,
      },
    });
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
        modified: directory.modified,
      }, hostApiFactory, disabledPluginIds);
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
      aggregate.settingsSlots.push(...packageResult.settingsSlots);
      aggregate.workflows.push(...packageResult.workflows);
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
  aggregate.workflows.sort((left, right) => left.title.localeCompare(right.title));
  aggregate.settingsSlots.sort(
    (left, right) =>
      left.order - right.order || left.title.localeCompare(right.title),
  );

  return aggregate;
}
