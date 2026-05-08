import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser';
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
  OverlayPluginExplorerActivityLaneContribution,
  OverlayPluginExplorerActivityLaneViewContribution,
  OverlayPluginExplorerActionContribution,
  OverlayPluginExplorerViewContribution,
  OverlayPluginExplorerWidgetContribution,
  OverlayPluginPreviewLaneContribution,
  OverlayPluginSettingsSlotContribution,
  OverlayPluginWorkflowContribution,
} from './pluginContributions';
import type {
  ExplorerActivityLaneDefinition,
  ExplorerActivityLaneViewRendererKind,
  ExplorerActivityRailSide,
} from './explorerActivityRail';
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
import { PluginWasmPanelSurface, PluginWasmPreviewSurface } from '../components/PluginWasmRuntimeSurfaces';
import { type LoadedOverlayShader, loadShaderFromSource } from '../components/shaderRuntime';
import {
  type BoundOverlayPluginPreviewLaneComponent,
  type BoundOverlayPluginSettingsSlotComponent,
  type BoundOverlayPluginWorkflowComponent,
  type LoadedOverlayPlugin,  
  type OverlayPluginApi,
  type OverlayPluginCapabilitySummary,
  type OverlayPluginContext,
  type OverlayPluginDependencyDiagnostic,
  type OverlayPluginPackageKind,
  type OverlayPluginPreviewLaneProps,
  type OverlayPluginSourceVisibility,
  type OverlayPluginSettingsSlotProps,
  type OverlayPluginWorkflowDefinition,
  type OverlayPluginTestFile,
  type PluginFileEntry,
  loadPluginModuleFromSource,
  loadPluginPreviewLaneFromSource,
  loadPluginSettingsSlotFromSource,
  loadPluginWorkflowFromSource,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import {
  ExplorerWasmRuntimeSurface,
  loadExplorerViewFromSource,
  normalizeExplorerViewCapabilities,
  normalizeExplorerViewDensityContract,
  normalizeExplorerViewDescriptor,
  normalizeExplorerViewSurfaceOwnership,
  type BoundExplorerViewComponent,
  type ExplorerViewCapabilityFlags,
  type ExplorerViewDensityContract,
  type ExplorerViewDescriptor,
  type ExplorerViewProps,
  type ExplorerViewSurfaceOwnership,
} from '../components/explorer/explorerViewRuntime';
import {
  ExplorerWasmWidgetSurface,
  loadExplorerWidgetFromSource,
  normalizeExplorerWidgetCapabilities,
  normalizeExplorerWidgetDescriptor,
  normalizeExplorerWidgetSizing,
  normalizeExplorerWidgetSurfaces,
  toExplorerWidgetChromeControlId,
  type BoundExplorerWidgetComponent,
  type ExplorerWidgetCapabilityFlags,
  type ExplorerWidgetDescriptor,
  type ExplorerWidgetProps,
  type ExplorerWidgetSizingContract,
  type ExplorerWidgetSurfaceContract,
} from '../components/explorer/explorerWidgetRuntime';
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

interface PluginPackageExplorerViewManifest {
  id?: string;
  title?: string;
  shortLabel?: string;
  description?: string;
  rendererKind?: 'react' | 'wasm-panel';
  renderer?: string;
  rendererEntry?: string;
  runtimeId?: string;
  runtimeRef?: string;
  runtimeSurfaceId?: string;
  runtimeSurfaceRef?: string;
  buildTarget?: string;
  priority?: number;
  available?: boolean;
  ownership?: 'content' | 'surface';
  tags?: string[];
  surfaceOwnership?: Partial<ExplorerViewSurfaceOwnership>;
  density?: Partial<ExplorerViewDensityContract> | null;
  capabilities?: Partial<ExplorerViewCapabilityFlags>;
}

interface PluginPackageExplorerWidgetManifest {
  id?: string;
  title?: string;
  shortLabel?: string;
  description?: string;
  category?: string;
  rendererKind?: 'react' | 'wasm-panel';
  renderer?: string;
  rendererEntry?: string;
  runtimeId?: string;
  runtimeRef?: string;
  runtimeSurfaceId?: string;
  runtimeSurfaceRef?: string;
  buildTarget?: string;
  priority?: number;
  available?: boolean;
  chromeControlId?: string;
  tags?: string[];
  surfaces?: Partial<ExplorerWidgetSurfaceContract>;
  sizing?: Partial<ExplorerWidgetSizingContract>;
  capabilities?: Partial<ExplorerWidgetCapabilityFlags>;
}

interface PluginPackageExplorerActivityLaneViewManifest {
  id?: string;
  title?: string;
  description?: string;
  rendererKind: ExplorerActivityLaneViewRendererKind;
  renderer?: string;
  rendererEntry?: string;
  runtimeId?: string;
  runtimeRef?: string;
  runtimeSurfaceId?: string;
  runtimeSurfaceRef?: string;
  buildTarget?: string;
  order: number;
  when?: string;
}

interface PluginPackageExplorerActivityLaneManifest {
  id?: string;
  title?: string;
  label?: string;
  shortLabel?: string;
  description?: string;
  iconName?: string;
  iconPath?: string;
  defaultSide?: ExplorerActivityRailSide;
  defaultOrder?: number;
  views?: PluginPackageExplorerActivityLaneViewManifest[];
}

interface PluginPackagePreviewLaneManifest {
  id?: string;
  title?: string;
  rendererKind?: 'react' | 'wasm-panel';
  renderer?: string;
  rendererEntry?: string;
  runtimeId?: string;
  runtimeRef?: string;
  runtimeSurfaceId?: string;
  runtimeSurfaceRef?: string;
  buildTarget?: string;
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

interface PluginPackagePanelRuntimeManifest {
  runtimeId?: string;
  runtimeRef?: string;
  buildTarget?: string;
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

interface PluginPackageDependencyManifest {
  id: string;
  version?: string;
  importAs?: string;
  required: boolean;
}

interface PluginPackageExportsManifest {
  modules: Record<string, string>;
}

interface PluginPackageManifest {
  version?: number | string;
  id?: string;
  name?: string;
  displayName?: string;
  description?: string;
  apiVersion?: string;
  packageKind?: OverlayPluginPackageKind;
  sourceVisibility?: OverlayPluginSourceVisibility;
  entry?: string;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  panelRuntime?: PluginPackagePanelRuntimeManifest;
  category?: string;
  tags?: string[];
  testFiles?: PluginPackageTestFileManifest[];
  permissions?: Record<string, unknown>;
  runtimes?: Array<Record<string, unknown>>;
  artifacts?: Array<Record<string, unknown>>;
  debugSources?: string[];
  exports?: PluginPackageExportsManifest;
  dependencies?: PluginPackageDependencyManifest[];
  contributions?: {
    themes?: string[];
    shaders?: string[];
    fonts?: PluginPackageFontManifest[];
    commands?: PluginPackageCommandManifest[];
    explorerActions?: PluginPackageExplorerActionManifest[];
    contextMenuItems?: PluginPackageContextMenuItemManifest[];
    explorerActivityLanes?: PluginPackageExplorerActivityLaneManifest[];
    explorerViews?: PluginPackageExplorerViewManifest[];
    explorerWidgets?: PluginPackageExplorerWidgetManifest[];
    previewLanes?: PluginPackagePreviewLaneManifest[];
    settingsSlots?: PluginPackageSettingsSlotManifest[];
    workflows?: PluginPackageWorkflowManifest[];
    mobilePanes?: PluginPackageMobilePaneManifest[];
  };
}

interface PluginPackageRecord {
  rootKind: 'plugins' | 'packages';
  directoryName: string;
  directoryPath: string;
  manifestPath: string;
  manifest: PluginPackageManifest;
  modified: number;
}

interface PluginPackageDependencyGraphEntry {
  record: PluginPackageRecord;
  id: string;
  name: string;
  version: string;
  packageKind: OverlayPluginPackageKind;
  dependencies: OverlayPluginDependencyDiagnostic[];
  blocked: boolean;
  blockedReason: string | null;
}

interface PluginPackageDependencyRuntime {
  graph: Map<string, PluginPackageDependencyGraphEntry>;
  recordsById: Map<string, PluginPackageRecord>;
  moduleExportCache: Map<string, Promise<unknown>>;
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
  explorerActivityLanes: OverlayPluginExplorerActivityLaneContribution[];
  explorerViews: OverlayPluginExplorerViewContribution[];
  explorerWidgets: OverlayPluginExplorerWidgetContribution[];
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

function asPackageKind(value: unknown): OverlayPluginPackageKind {
  if (value === 'library' || value === 'runtime') {
    return value;
  }
  return 'plugin';
}

function asPackageSourceVisibility(value: unknown): OverlayPluginSourceVisibility | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized === 'open' ||
    normalized === 'hybrid' ||
    normalized === 'compiled' ||
    normalized === 'private'
  ) {
    return normalized;
  }
  return undefined;
}

function asPackageExportsManifest(value: unknown): PluginPackageExportsManifest | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const modules = asStringRecord(asRecord(record.modules) ?? record.modules);
  return Object.keys(modules).length > 0
    ? { modules }
    : undefined;
}

function asDependencyManifestArray(value: unknown): PluginPackageDependencyManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }

    const id = asString(record.id);
    if (!id) {
      return [];
    }

    const required = record.required === false ? false : true;
    return [{
      id,
      version: asString(record.version) || undefined,
      importAs: asString(record.importAs) || undefined,
      required,
    }];
  });
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

function asPanelRuntimeManifest(
  value: unknown,
): PluginPackagePanelRuntimeManifest | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const runtimeId = asString(record.runtimeId) || asString(record.runtimeRef);
  if (!runtimeId) {
    return undefined;
  }

  return {
    runtimeId: asString(record.runtimeId),
    runtimeRef: asString(record.runtimeRef),
    buildTarget: asString(record.buildTarget) || undefined,
  };
}

function asExplorerViewManifestArray(
  value: unknown,
): PluginPackageExplorerViewManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const rendererKind =
      asString(record.rendererKind) === "wasm-panel" ||
      ((!asString(record.renderer) && !asString(record.rendererEntry)) &&
        Boolean(
          asString(record.runtimeSurfaceId) ||
            asString(record.runtimeSurfaceRef) ||
            asString(record.runtimeId) ||
            asString(record.runtimeRef),
        ))
        ? "wasm-panel"
        : "react";
    const renderer = asString(record.renderer) || asString(record.rendererEntry);
    if (rendererKind === "react" && !renderer) {
      return [];
    }

    const title =
      asString(record.title) ||
      deriveDisplayNameFromFilePath(
        renderer ||
          asString(record.runtimeSurfaceId) ||
          asString(record.runtimeSurfaceRef) ||
          asString(record.runtimeId) ||
          asString(record.runtimeRef) ||
          `explorer-view-${index + 1}`,
      );
    return [
      {
        id: asString(record.id) || deriveIdFromName(title, "explorer-view"),
        title,
        shortLabel: asString(record.shortLabel) || title,
        description: asString(record.description) || undefined,
        rendererKind,
        renderer,
        rendererEntry: asString(record.rendererEntry),
        runtimeId: asString(record.runtimeId) || asString(record.runtimeRef),
        runtimeRef: asString(record.runtimeRef),
        runtimeSurfaceId:
          asString(record.runtimeSurfaceId) || asString(record.runtimeSurfaceRef),
        runtimeSurfaceRef: asString(record.runtimeSurfaceRef),
        buildTarget: asString(record.buildTarget),
        priority:
          typeof record.priority === "number" && Number.isFinite(record.priority)
            ? Math.round(record.priority)
            : 0,
        available: record.available !== false,
        ownership: asString(record.ownership) === "surface" ? "surface" : "content",
        tags: asStringArray(record.tags),
        surfaceOwnership: normalizeExplorerViewSurfaceOwnership(
          record.surfaceOwnership as Partial<ExplorerViewSurfaceOwnership>,
        ),
        density: normalizeExplorerViewDensityContract(
          record.density as Partial<ExplorerViewDensityContract>,
        ),
        capabilities: normalizeExplorerViewCapabilities(
          record.capabilities as Partial<ExplorerViewCapabilityFlags>,
        ),
      } satisfies PluginPackageExplorerViewManifest,
    ];
  });
}

function asExplorerWidgetManifestArray(
  value: unknown,
): PluginPackageExplorerWidgetManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const rendererKind =
      asString(record.rendererKind) === "wasm-panel" ||
      ((!asString(record.renderer) && !asString(record.rendererEntry)) &&
        Boolean(
          asString(record.runtimeSurfaceId) ||
            asString(record.runtimeSurfaceRef) ||
            asString(record.runtimeId) ||
            asString(record.runtimeRef),
        ))
        ? "wasm-panel"
        : "react";
    const renderer = asString(record.renderer) || asString(record.rendererEntry);
    if (rendererKind === "react" && !renderer) {
      return [];
    }

    const title =
      asString(record.title) ||
      deriveDisplayNameFromFilePath(
        renderer ||
          asString(record.runtimeSurfaceId) ||
          asString(record.runtimeSurfaceRef) ||
          asString(record.runtimeId) ||
          asString(record.runtimeRef) ||
          `explorer-widget-${index + 1}`,
      );
    return [
      {
        id: asString(record.id) || deriveIdFromName(title, "explorer-widget"),
        title,
        shortLabel: asString(record.shortLabel) || title,
        description: asString(record.description) || undefined,
        category: asString(record.category) || "widgets",
        rendererKind,
        renderer,
        rendererEntry: asString(record.rendererEntry),
        runtimeId: asString(record.runtimeId) || asString(record.runtimeRef),
        runtimeRef: asString(record.runtimeRef),
        runtimeSurfaceId:
          asString(record.runtimeSurfaceId) || asString(record.runtimeSurfaceRef),
        runtimeSurfaceRef: asString(record.runtimeSurfaceRef),
        buildTarget: asString(record.buildTarget),
        priority:
          typeof record.priority === "number" && Number.isFinite(record.priority)
            ? Math.round(record.priority)
            : 0,
        available: record.available !== false,
        chromeControlId: asString(record.chromeControlId),
        tags: asStringArray(record.tags),
        surfaces: normalizeExplorerWidgetSurfaces(
          record.surfaces as Partial<ExplorerWidgetSurfaceContract>,
        ),
        sizing: normalizeExplorerWidgetSizing(
          record.sizing as Partial<ExplorerWidgetSizingContract>,
        ),
        capabilities: normalizeExplorerWidgetCapabilities(
          record.capabilities as Partial<ExplorerWidgetCapabilityFlags>,
        ),
      } satisfies PluginPackageExplorerWidgetManifest,
    ];
  });
}

function normalizeExplorerActivityLaneRendererKind(
  record: LooseRecord,
): ExplorerActivityLaneViewRendererKind {
  const explicit = asString(record.rendererKind);
  if (
    explicit === "wasm-panel" ||
    explicit === "tree" ||
    explicit === "webview"
  ) {
    return explicit;
  }
  if (
    !asString(record.renderer) &&
    !asString(record.rendererEntry) &&
    Boolean(
      asString(record.runtimeSurfaceId) ||
        asString(record.runtimeSurfaceRef) ||
        asString(record.runtimeId) ||
        asString(record.runtimeRef),
    )
  ) {
    return "wasm-panel";
  }
  return "react";
}

function asExplorerActivityLaneViewManifestArray(
  value: unknown,
): PluginPackageExplorerActivityLaneViewManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const rendererKind = normalizeExplorerActivityLaneRendererKind(record);
    const renderer = asString(record.renderer) || asString(record.rendererEntry);
    const runtimeId =
      asString(record.runtimeId) ||
      asString(record.runtimeRef) ||
      asString(record.runtimeSurfaceId) ||
      asString(record.runtimeSurfaceRef);
    if (rendererKind === "react" && !renderer) {
      return [];
    }
    if (rendererKind === "wasm-panel" && !runtimeId) {
      return [];
    }
    const title =
      asString(record.title) ||
      deriveDisplayNameFromFilePath(
        renderer || runtimeId || `activity-view-${index + 1}`,
      );
    return [
      {
        id: asString(record.id) || deriveIdFromName(title, "activity-view"),
        title,
        description: asString(record.description) || undefined,
        rendererKind,
        renderer,
        rendererEntry: asString(record.rendererEntry),
        runtimeId: asString(record.runtimeId) || asString(record.runtimeRef),
        runtimeRef: asString(record.runtimeRef),
        runtimeSurfaceId:
          asString(record.runtimeSurfaceId) || asString(record.runtimeSurfaceRef),
        runtimeSurfaceRef: asString(record.runtimeSurfaceRef),
        buildTarget: asString(record.buildTarget),
        order:
          typeof record.order === "number" && Number.isFinite(record.order)
            ? Math.round(record.order)
            : index * 10,
        when: asString(record.when),
      } satisfies PluginPackageExplorerActivityLaneViewManifest,
    ];
  });
}

function asExplorerActivityLaneManifestArray(
  value: unknown,
): PluginPackageExplorerActivityLaneManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const title =
      asString(record.title) ||
      asString(record.label) ||
      deriveDisplayNameFromFilePath(
        asString(record.id) || `activity-lane-${index + 1}`,
      );
    const defaultSide =
      asString(record.defaultSide) === "right" ? "right" : "left";
    return [
      {
        id: asString(record.id) || deriveIdFromName(title, "activity-lane"),
        title,
        label: asString(record.label) || title,
        shortLabel: asString(record.shortLabel) || title,
        description: asString(record.description) || undefined,
        iconName: asString(record.iconName) || "Puzzle",
        iconPath: asString(record.iconPath),
        defaultSide,
        defaultOrder:
          typeof record.defaultOrder === "number" &&
          Number.isFinite(record.defaultOrder)
            ? Math.round(record.defaultOrder)
            : 900 + index * 10,
        views: asExplorerActivityLaneViewManifestArray(record.views),
      } satisfies PluginPackageExplorerActivityLaneManifest,
    ];
  });
}

function asPreviewLaneManifestArray(value: unknown): PluginPackagePreviewLaneManifest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const rendererKind =
      asString(record.rendererKind) === 'wasm-panel' ||
      ((!asString(record.renderer) && !asString(record.rendererEntry))
        && Boolean(asString(record.runtimeSurfaceId) || asString(record.runtimeSurfaceRef)))
        ? 'wasm-panel'
        : 'react';
    const renderer = asString(record.renderer) || asString(record.rendererEntry);
    if (rendererKind === 'react' && !renderer) {
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
      deriveDisplayNameFromFilePath(
        renderer
          || asString(record.runtimeSurfaceId)
          || asString(record.runtimeSurfaceRef)
          || 'preview-lane',
      );

    return [{
      id: asString(record.id) || deriveIdFromName(title, 'preview-lane'),
      title,
      rendererKind,
      renderer,
      rendererEntry: asString(record.rendererEntry),
      runtimeId: asString(record.runtimeId) || asString(record.runtimeRef),
      runtimeRef: asString(record.runtimeRef),
      runtimeSurfaceId:
        asString(record.runtimeSurfaceId) || asString(record.runtimeSurfaceRef),
      runtimeSurfaceRef: asString(record.runtimeSurfaceRef),
      buildTarget: asString(record.buildTarget),
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
  const sourceMetadata = asRecord(source.source);
  const distributionMetadata = asRecord(source.distribution);
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
    packageKind: asPackageKind(source.packageKind),
    sourceVisibility: asPackageSourceVisibility(
      source.sourceVisibility ??
      sourceMetadata?.visibility ??
      distributionMetadata?.sourceVisibility,
    ),
    entry: asString(source.entry),
    defaultOpen: asBoolean(source.defaultOpen),
    keepMounted: asBoolean(source.keepMounted),
    panelRuntime: asPanelRuntimeManifest(source.panelRuntime),
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
    exports: asPackageExportsManifest(source.exports),
    dependencies: asDependencyManifestArray(source.dependencies),
    contributions: {
      themes: asStringArray(contributions?.themes),
      shaders: asStringArray(contributions?.shaders),
      fonts: asFontManifestArray(contributions?.fonts),
      commands: asCommandManifestArray(contributions?.commands),
      explorerActions: asExplorerActionManifestArray(contributions?.explorerActions),
      contextMenuItems: asContextMenuItemManifestArray(contributions?.contextMenuItems),
      explorerActivityLanes: asExplorerActivityLaneManifestArray(
        contributions?.explorerActivityLanes,
      ),
      explorerViews: asExplorerViewManifestArray(contributions?.explorerViews),
      explorerWidgets: asExplorerWidgetManifestArray(contributions?.explorerWidgets),
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

function derivePackageVersion(record: PluginPackageRecord): string {
  return String(record.manifest.version ?? '1').trim() || '1';
}

function derivePackageKind(record: PluginPackageRecord): OverlayPluginPackageKind {
  return record.manifest.packageKind ?? 'plugin';
}

function derivePackageSourceVisibility(record: PluginPackageRecord): OverlayPluginSourceVisibility {
  if (record.manifest.sourceVisibility) {
    return record.manifest.sourceVisibility;
  }
  return record.rootKind === 'packages' ? 'open' : 'private';
}

function getPackageRootDirectory(record: PluginPackageRecord): string {
  return record.rootKind === 'packages'
    ? pluginSystemConfig.packagesDirectory
    : pluginSystemConfig.pluginsDirectory;
}

function getPackageSourceKind(record: PluginPackageRecord) {
  return derivePackageKind(record) === 'library'
    ? 'library-package' as const
    : 'package-plugin' as const;
}

function getPackageModuleExportSpecifiers(record: PluginPackageRecord): string[] {
  return Object.keys(record.manifest.exports?.modules ?? {}).sort();
}

function canPackageExposeSourceModules(record: PluginPackageRecord): boolean {
  if (record.rootKind === 'packages') {
    return true;
  }
  const visibility = derivePackageSourceVisibility(record);
  return visibility === 'open' || visibility === 'hybrid';
}

function estimatePackageManifestCapabilities(
  record: PluginPackageRecord,
): OverlayPluginCapabilitySummary {
  const contributions = record.manifest.contributions;
  return {
    panel: Boolean(record.manifest.entry || record.manifest.panelRuntime),
    mobilePanes: contributions?.mobilePanes?.length ?? 0,
    themes: contributions?.themes?.length ?? 0,
    shaders: contributions?.shaders?.length ?? 0,
    fonts: contributions?.fonts?.length ?? 0,
    commands: contributions?.commands?.length ?? 0,
    actions: 0,
    explorerActions: contributions?.explorerActions?.length ?? 0,
    contextMenuItems: contributions?.contextMenuItems?.length ?? 0,
    explorerActivityLanes: contributions?.explorerActivityLanes?.length ?? 0,
    explorerViews: contributions?.explorerViews?.length ?? 0,
    explorerWidgets: contributions?.explorerWidgets?.length ?? 0,
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
        explorerActivityLanes: 0,
        previewLanes: 0,
        settingsSlots: 0,
      },
    },
  };
}

function createDisabledPackagePlugin(
  record: PluginPackageRecord,
  dependencyEntry?: PluginPackageDependencyGraphEntry,
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
    pluginRoot: getPackageRootDirectory(record),
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
      sourceKind: getPackageSourceKind(record),
      sourceLabel: packageName,
      manifestPath: record.manifestPath,
      packageKind: derivePackageKind(record),
      sourceVisibility: derivePackageSourceVisibility(record),
      category: record.manifest.category || 'General',
      tags: record.manifest.tags ?? [],
      testFiles: resolvePackageTestFiles(record),
      warnings: [],
      dependencies: dependencyEntry?.dependencies,
      moduleExports: getPackageModuleExportSpecifiers(record),
      blockedReason: dependencyEntry?.blockedReason ?? null,
      capabilities: estimatePackageManifestCapabilities(record),
    },
  };
}

function createMetadataOnlyPackagePlugin(
  record: PluginPackageRecord,
  options: {
    dependencyEntry?: PluginPackageDependencyGraphEntry;
    warnings?: string[];
    capabilities?: OverlayPluginCapabilitySummary;
    blockedReason?: string | null;
  } = {},
): LoadedOverlayPlugin {
  const packageId = derivePackageId(record);
  const packageName = derivePackageName(record);
  const packageBackendDirectory = joinPlatformPath(
    record.directoryPath,
    pluginSystemConfig.backendDirectoryName,
  );
  const dependencyEntry = options.dependencyEntry;
  const blockedReason =
    options.blockedReason ?? dependencyEntry?.blockedReason ?? null;

  return {
    id: packageId,
    name: packageName,
    description: record.manifest.description,
    filePath: record.manifestPath,
    pluginRoot: getPackageRootDirectory(record),
    pluginDirectory: record.directoryPath,
    backendDirectory: packageBackendDirectory,
    enablementKey: packageId,
    modified: record.modified,
    enabled: true,
    defaultOpen: false,
    keepMounted: false,
    component: null,
    error: null,
    diagnostics: {
      sourceKind: getPackageSourceKind(record),
      sourceLabel: packageName,
      manifestPath: record.manifestPath,
      packageKind: derivePackageKind(record),
      sourceVisibility: derivePackageSourceVisibility(record),
      category: record.manifest.category || 'General',
      tags: record.manifest.tags ?? [],
      testFiles: resolvePackageTestFiles(record),
      warnings: options.warnings ?? [],
      dependencies: dependencyEntry?.dependencies,
      moduleExports: getPackageModuleExportSpecifiers(record),
      blockedReason,
      capabilities:
        options.capabilities ?? estimatePackageManifestCapabilities(record),
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

interface VsCodeActivityBarContainerManifest {
  id?: string;
  title?: string;
  icon?: string;
}

interface VsCodeViewManifest {
  id?: string;
  name?: string;
  when?: string;
}

interface VsCodeCommandManifest {
  command?: string;
  title?: string;
  category?: string;
}

interface VsCodeExtensionManifest {
  name?: string;
  publisher?: string;
  displayName?: string;
  description?: string;
  version?: string;
  main?: string;
  activationEvents?: string[];
  icon?: string;
  contributes?: {
    viewsContainers?: {
      activitybar?: VsCodeActivityBarContainerManifest[];
    };
    views?: Record<string, VsCodeViewManifest[]>;
    commands?: VsCodeCommandManifest[];
  };
}

interface ResolvedVsCodeExtensionForRail {
  originalPath: string;
  cachedExtractionPath: string;
  extensionRootPath: string;
  packageJsonPath: string;
  manifest: VsCodeExtensionManifest;
  extensionId: string;
  extensionName: string;
  extensionDescription?: string;
  versionLabel: string;
  main: string | null;
  activationEvents: string[];
  modified: number;
}

function entryLooksLikeVsix(entry: FileEntry): boolean {
  return !entry.is_dir && (entry.extension === 'vsix' || entry.path.toLowerCase().endsWith('.vsix'));
}

function parseJsoncObject<TRecord extends object>(source: string, filePath: string): TRecord {
  const errors: ParseError[] = [];
  const parsed = parseJsonc(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (errors.length > 0) {
    const error = errors[0];
    throw new Error(
      `${filePath}: ${printParseErrorCode(error.error)} at offset ${error.offset}`,
    );
  }
  const record = asRecord(parsed);
  if (!record) {
    throw new Error(`${filePath}: expected JSON object`);
  }
  return record as TRecord;
}

async function readTextFileIfExists(path: string): Promise<string | null> {
  try {
    return await commands.fsReadTextFile(path).then(unwrapTauriResult);
  } catch {
    return null;
  }
}

function normalizeVsCodeExtensionNamespace(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

async function resolveVsCodeExtensionForRail(
  entry: FileEntry,
): Promise<ResolvedVsCodeExtensionForRail | null> {
  if (!entryLooksLikeVsix(entry)) {
    return null;
  }
  const extractionResult = await commands.fsOpenArchive(entry.path).then(unwrapTauriResult);
  const rootPackageJsonPath = joinPlatformPath(extractionResult.outputPath, 'package.json');
  const rootPackageJson = await readTextFileIfExists(rootPackageJsonPath);
  let extensionRootPath = extractionResult.outputPath;
  let packageJsonPath = rootPackageJsonPath;
  let manifestText = rootPackageJson;
  if (!manifestText) {
    extensionRootPath = joinPlatformPath(extractionResult.outputPath, 'extension');
    packageJsonPath = joinPlatformPath(extensionRootPath, 'package.json');
    manifestText = await readTextFileIfExists(packageJsonPath);
  }
  if (!manifestText) {
    return null;
  }
  const manifest = parseJsoncObject<VsCodeExtensionManifest>(
    manifestText,
    packageJsonPath,
  );
  const extensionName =
    asString(manifest.displayName) || asString(manifest.name) || entry.name;
  const rawExtensionId =
    [asString(manifest.publisher), asString(manifest.name)]
      .filter(Boolean)
      .join('.') || deriveIdFromName(entry.name, 'vscode-extension');
  const extensionId = normalizeVsCodeExtensionNamespace(
    rawExtensionId,
    deriveIdFromName(entry.name, 'vscode-extension'),
  );
  return {
    originalPath: entry.path,
    cachedExtractionPath: extractionResult.outputPath,
    extensionRootPath,
    packageJsonPath,
    manifest,
    extensionId,
    extensionName,
    extensionDescription: asString(manifest.description) || undefined,
    versionLabel: asString(manifest.version) || '0.0.0',
    main: asString(manifest.main) || null,
    activationEvents: Array.isArray(manifest.activationEvents)
      ? manifest.activationEvents.flatMap((entry) => {
        const value = asString(entry);
        return value ? [value] : [];
      })
      : [],
    modified: entry.modified,
  };
}

function buildVsCodeRuntimeMetadata(
  extension: ResolvedVsCodeExtensionForRail,
) {
  return {
    extensionId: extension.extensionId,
    extensionName: extension.extensionName,
    extensionRootPath: extension.extensionRootPath,
    packageJsonPath: extension.packageJsonPath,
    originalPath: extension.originalPath,
    main: extension.main,
    activationEvents: extension.activationEvents,
  };
}

function resolveVsCodeActivityIcon(
  extension: ResolvedVsCodeExtensionForRail,
  iconValue: string,
): Pick<ExplorerActivityLaneDefinition, 'iconName' | 'iconUrl'> {
  const icon = iconValue.trim();
  const codicon = icon.match(/^\$\(([^)]+)\)$/)?.[1] ?? '';
  const codiconMap: Record<string, string> = {
    account: 'User',
    beaker: 'FlaskConical',
    book: 'BookOpen',
    bug: 'Bug',
    debug: 'Bug',
    files: 'FolderTree',
    gear: 'Settings',
    git: 'GitBranch',
    graph: 'GitBranch',
    package: 'Package',
    puzzle: 'Puzzle',
    search: 'Search',
    source_control: 'GitBranch',
    symbol_class: 'Blocks',
    terminal: 'TerminalSquare',
    tools: 'Wrench',
  };
  if (codicon) {
    return { iconName: codiconMap[codicon] || 'Puzzle' };
  }
  if (icon && isSafeRelativePath(icon)) {
    return {
      iconName: 'Puzzle',
      iconUrl: toAssetUrl(joinPlatformPath(extension.extensionRootPath, normalizeRelativePath(icon))),
    };
  }
  return { iconName: 'Puzzle' };
}

function mapVsixManifestToGreebleActivityLanes(
  extension: ResolvedVsCodeExtensionForRail,
): OverlayPluginExplorerActivityLaneContribution[] {
  const contributes = extension.manifest.contributes;
  const viewsByContainer = asRecord(contributes?.views) ?? {};
  const activityContainers =
    contributes?.viewsContainers?.activitybar?.filter((container) =>
      Boolean(asString(container.id) || asString(container.title)),
    ) ?? [];
  const containersById = new Map<string, VsCodeActivityBarContainerManifest>();
  for (const container of activityContainers) {
    const containerId =
      asString(container.id) || deriveIdFromName(asString(container.title), 'activity');
    containersById.set(containerId, container);
  }
  for (const containerId of Object.keys(viewsByContainer)) {
    if (!containersById.has(containerId)) {
      containersById.set(containerId, {
        id: containerId,
        title: deriveDisplayNameFromFilePath(containerId),
      });
    }
  }

  return [...containersById.entries()].map(([containerId, container], index) => {
    const laneTitle =
      asString(container.title) ||
      deriveDisplayNameFromFilePath(containerId);
    const stableContainerId = normalizeVsCodeExtensionNamespace(
      containerId,
      deriveIdFromName(laneTitle, 'activity'),
    );
    const laneId = `vscode:${extension.extensionId}:${stableContainerId}`;
    const icon = resolveVsCodeActivityIcon(
      extension,
      asString(container.icon) || asString(extension.manifest.icon),
    );
    const viewEntries = Array.isArray(viewsByContainer[containerId])
      ? (viewsByContainer[containerId] as unknown[])
      : [];
    const views: OverlayPluginExplorerActivityLaneViewContribution[] =
      viewEntries.flatMap((entry, viewIndex) => {
        const view = asRecord(entry);
        if (!view) {
          return [];
        }
        const title =
          asString(view.name) ||
          asString(view.title) ||
          asString(view.id) ||
          `View ${viewIndex + 1}`;
        const stableViewId = normalizeVsCodeExtensionNamespace(
          asString(view.id) || deriveIdFromName(title, 'view'),
          deriveIdFromName(title, 'view'),
        );
        const viewId = `${laneId}.view.${stableViewId}`;
        const viewDescriptor = normalizeExplorerViewDescriptor(
          {
            id: viewId,
            title,
            shortLabel: title,
            description: asString(view.when) || undefined,
            tags: ['vscode', 'tree-view'],
            rendererKind: 'react',
            ownership: 'content',
          },
          {
            id: viewId,
            title,
          },
        );
        return [
          {
            id: viewId,
            title,
            description: asString(view.when) || undefined,
            order: viewIndex * 10,
            rendererKind: 'tree',
            providerPending: true,
            error: null,
            pluginId: extension.extensionId,
            pluginName: extension.extensionName,
            sourceKind: 'vscode-vsix',
            sourceLabel: extension.originalPath,
            rendererEntry: null,
            runtimeId: null,
            runtimeSurfaceId: null,
            buildTarget: null,
            vscode: {
              ...buildVsCodeRuntimeMetadata(extension),
              viewId: asString(view.id) || stableViewId,
            },
            viewDescriptor,
            component: null,
          } satisfies OverlayPluginExplorerActivityLaneViewContribution,
        ];
      });
    return {
      id: laneId,
      label: laneTitle,
      shortLabel: laneTitle,
      ...icon,
      sourceKind: 'vscode-vsix',
      sourceLabel: extension.originalPath,
      defaultSide: 'left',
      defaultOrder: 1000 + index * 10,
      views,
      pluginId: extension.extensionId,
      pluginName: extension.extensionName,
      vscode: buildVsCodeRuntimeMetadata(extension),
    } satisfies OverlayPluginExplorerActivityLaneContribution;
  });
}

function mapVsixManifestToGreebleCommands(
  extension: ResolvedVsCodeExtensionForRail,
): OverlayPluginCommandContribution[] {
  const commandEntries = extension.manifest.contributes?.commands ?? [];
  return commandEntries.flatMap((entry, index) => {
    const commandId = asString(entry.command);
    if (!commandId) {
      return [];
    }
    const title = asString(entry.title) || commandId;
    const category = asString(entry.category);
    return [{
      id: `vscode-command:${extension.extensionId}:${normalizeVsCodeExtensionNamespace(commandId, `command-${index}`)}`,
      pluginId: extension.extensionId,
      pluginName: extension.extensionName,
      name: category ? `${category}: ${title}` : title,
      command: commandId,
      description: extension.extensionDescription || commandId,
      runOnSelect: false,
      sourceKind: 'vscode-vsix',
      vscodeCommand: {
        ...buildVsCodeRuntimeMetadata(extension),
        commandId,
      },
    } satisfies OverlayPluginCommandContribution];
  });
}

function createVsCodeExtensionMetadataPlugin(
  extension: ResolvedVsCodeExtensionForRail,
  lanes: readonly OverlayPluginExplorerActivityLaneContribution[],
  disabled: boolean,
  warnings: string[] = [],
): LoadedOverlayPlugin {
  const commandCount = extension.manifest.contributes?.commands?.length ?? 0;
  return {
    id: extension.extensionId,
    name: extension.extensionName,
    description: extension.extensionDescription,
    filePath: extension.originalPath,
    pluginRoot: pluginSystemConfig.pluginsDirectory,
    pluginDirectory: extension.extensionRootPath,
    backendDirectory: joinPlatformPath(extension.extensionRootPath, pluginSystemConfig.backendDirectoryName),
    enablementKey: extension.extensionId,
    modified: extension.modified,
    enabled: !disabled,
    defaultOpen: false,
    keepMounted: false,
    component: null,
    error: null,
    diagnostics: {
      sourceKind: 'vscode-vsix',
      sourceLabel: extension.originalPath,
      manifestPath: extension.packageJsonPath,
      category: 'VS Code',
      tags: ['vscode', 'vsix'],
      testFiles: [],
      warnings,
      capabilities: {
        panel: false,
        themes: 0,
        shaders: 0,
        fonts: 0,
        commands: commandCount,
        actions: 0,
        explorerActions: 0,
        contextMenuItems: 0,
        explorerActivityLanes: lanes.length,
        explorerViews: 0,
        explorerWidgets: 0,
        previewLanes: 0,
        settingsSlots: 0,
        vscodeExtensions: 1,
      },
    },
  };
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

async function listDirectoryOptional(path: string): Promise<FileEntry[]> {
  try {
    return await listDirectory(path);
  } catch {
    return [];
  }
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
  if (derivePackageKind(record) === 'library' && !record.manifest.entry) {
    return null;
  }

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

function resolvePackagePanelRuntime(record: PluginPackageRecord): {
  runtimeId: string;
  buildTarget: string | null;
} | null {
  const runtimeId =
    record.manifest.panelRuntime?.runtimeId?.trim()
    || record.manifest.panelRuntime?.runtimeRef?.trim()
    || '';
  if (!runtimeId) {
    return null;
  }

  return {
    runtimeId,
    buildTarget: record.manifest.panelRuntime?.buildTarget?.trim() || null,
  };
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

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  valid: boolean;
}

function parseLooseVersion(value: string | undefined): ParsedVersion {
  const raw = (value ?? '').trim();
  const match = raw.match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i);
  if (!match) {
    return { major: 0, minor: 0, patch: 0, valid: false };
  }

  return {
    major: Number(match[1] ?? 0),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    valid: true,
  };
}

function compareLooseVersions(left: ParsedVersion, right: ParsedVersion): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

function satisfiesPackageVersionRange(
  installedVersion: string,
  requestedVersion: string | undefined,
): boolean {
  const requested = requestedVersion?.trim();
  if (!requested || requested === '*') {
    return true;
  }

  if (requested.startsWith('^')) {
    const lowerBound = parseLooseVersion(requested.slice(1));
    const installed = parseLooseVersion(installedVersion);
    if (!lowerBound.valid || !installed.valid) {
      return installedVersion === requested.slice(1);
    }
    if (compareLooseVersions(installed, lowerBound) < 0) {
      return false;
    }
    return lowerBound.major > 0
      ? installed.major === lowerBound.major
      : installed.major === 0 && installed.minor === lowerBound.minor;
  }

  const installed = parseLooseVersion(installedVersion);
  const exact = parseLooseVersion(requested);
  if (installed.valid && exact.valid) {
    return compareLooseVersions(installed, exact) === 0;
  }
  return installedVersion === requested;
}

function detectRequiredDependencyCycleIds(
  recordsById: ReadonlyMap<string, PluginPackageRecord>,
): Set<string> {
  const cyclicIds = new Set<string>();
  const stateById = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];

  const visit = (packageId: string) => {
    const state = stateById.get(packageId);
    if (state === 'visited') {
      return;
    }
    if (state === 'visiting') {
      const cycleStart = stack.indexOf(packageId);
      const cycleMembers = cycleStart >= 0 ? stack.slice(cycleStart) : [packageId];
      cycleMembers.forEach(id => cyclicIds.add(id));
      return;
    }

    const record = recordsById.get(packageId);
    if (!record) {
      return;
    }

    stateById.set(packageId, 'visiting');
    stack.push(packageId);
    for (const dependency of record.manifest.dependencies ?? []) {
      if (dependency.required !== false && recordsById.has(dependency.id)) {
        visit(dependency.id);
      }
    }
    stack.pop();
    stateById.set(packageId, 'visited');
  };

  recordsById.forEach((_record, packageId) => visit(packageId));
  return cyclicIds;
}

function createDependencyDiagnostic(
  dependency: PluginPackageDependencyManifest,
  recordsById: ReadonlyMap<string, PluginPackageRecord>,
  disabledPluginIds: ReadonlySet<string>,
  cyclicIds: ReadonlySet<string>,
  ownerId: string,
): OverlayPluginDependencyDiagnostic {
  const dependencyRecord = recordsById.get(dependency.id);
  const requestedVersion = dependency.version;
  const required = dependency.required !== false;

  if (!dependencyRecord) {
    return {
      id: dependency.id,
      importAs: dependency.importAs,
      required,
      requestedVersion,
      status: 'missing',
      message: `${dependency.id} is not installed in usr/plugins or usr/packages.`,
    };
  }

  const dependencyName = derivePackageName(dependencyRecord);
  const installedVersion = derivePackageVersion(dependencyRecord);
  if (isPluginDisabled(disabledPluginIds, dependency.id)) {
    return {
      id: dependency.id,
      importAs: dependency.importAs,
      required,
      requestedVersion,
      installedVersion,
      packageName: dependencyName,
      status: 'disabled',
      message: `${dependencyName} is installed but disabled.`,
    };
  }

  if (!satisfiesPackageVersionRange(installedVersion, requestedVersion)) {
    return {
      id: dependency.id,
      importAs: dependency.importAs,
      required,
      requestedVersion,
      installedVersion,
      packageName: dependencyName,
      status: 'incompatible',
      message: `${dependencyName} is ${installedVersion}; ${requestedVersion || '*'} is required.`,
    };
  }

  if (dependency.importAs && !canPackageExposeSourceModules(dependencyRecord)) {
    const visibility = derivePackageSourceVisibility(dependencyRecord);
    return {
      id: dependency.id,
      importAs: dependency.importAs,
      required,
      requestedVersion,
      installedVersion,
      packageName: dependencyName,
      status: 'incompatible',
      message: `${dependencyName} is ${visibility}-source and does not expose source modules for cross-plugin imports.`,
    };
  }

  if (
    dependency.importAs &&
    !(dependency.importAs in (dependencyRecord.manifest.exports?.modules ?? {}))
  ) {
    return {
      id: dependency.id,
      importAs: dependency.importAs,
      required,
      requestedVersion,
      installedVersion,
      packageName: dependencyName,
      status: 'incompatible',
      message: `${dependencyName} does not export ${dependency.importAs}.`,
    };
  }

  if (cyclicIds.has(ownerId) && cyclicIds.has(dependency.id)) {
    return {
      id: dependency.id,
      importAs: dependency.importAs,
      required,
      requestedVersion,
      installedVersion,
      packageName: dependencyName,
      status: 'cyclic',
      message: `${dependencyName} participates in a required dependency cycle.`,
    };
  }

  return {
    id: dependency.id,
    importAs: dependency.importAs,
    required,
    requestedVersion,
    installedVersion,
    packageName: dependencyName,
    status: 'satisfied',
    message: `${dependencyName} ${installedVersion} is available.`,
  };
}

function createPackageDependencyRuntime(
  records: PluginPackageRecord[],
  disabledPluginIds: ReadonlySet<string>,
): { runtime: PluginPackageDependencyRuntime; warnings: string[] } {
  const warnings: string[] = [];
  const recordsById = new Map<string, PluginPackageRecord>();
  for (const record of records) {
    const packageId = derivePackageId(record);
    if (recordsById.has(packageId)) {
      warnings.push(
        `${derivePackageName(record)}: duplicate package id ${packageId} was ignored`,
      );
      continue;
    }
    recordsById.set(packageId, record);
  }

  const cyclicIds = detectRequiredDependencyCycleIds(recordsById);
  const graph = new Map<string, PluginPackageDependencyGraphEntry>();
  recordsById.forEach((record, packageId) => {
    const dependencies = (record.manifest.dependencies ?? []).map(dependency =>
      createDependencyDiagnostic(
        dependency,
        recordsById,
        disabledPluginIds,
        cyclicIds,
        packageId,
      ),
    );
    graph.set(packageId, {
      record,
      id: packageId,
      name: derivePackageName(record),
      version: derivePackageVersion(record),
      packageKind: derivePackageKind(record),
      dependencies,
      blocked: false,
      blockedReason: null,
    });
  });

  let changed = true;
  while (changed) {
    changed = false;
    graph.forEach((entry) => {
      const blockers: string[] = [];
      entry.dependencies.forEach((dependency) => {
        if (!dependency.required) {
          return;
        }
        if (dependency.status === 'satisfied') {
          const dependencyEntry = graph.get(dependency.id);
          if (dependencyEntry?.blocked) {
            dependency.status = 'blocked';
            dependency.message = `${dependency.packageName ?? dependency.id} is blocked: ${dependencyEntry.blockedReason}`;
            changed = true;
          }
        }
        if (dependency.status !== 'satisfied') {
          blockers.push(dependency.message);
        }
      });

      if (cyclicIds.has(entry.id)) {
        blockers.push(`${entry.name} participates in a required dependency cycle.`);
      }

      const blockedReason = blockers[0] ?? null;
      const blocked = blockedReason != null;
      if (entry.blocked !== blocked || entry.blockedReason !== blockedReason) {
        entry.blocked = blocked;
        entry.blockedReason = blockedReason;
        changed = true;
      }
    });
  }

  return {
    runtime: {
      graph,
      recordsById,
      moduleExportCache: new Map(),
    },
    warnings,
  };
}

async function loadPackageModuleExport(
  record: PluginPackageRecord,
  importSpecifier: string,
  dependencyRuntime: PluginPackageDependencyRuntime,
  importStack: string[] = [],
): Promise<unknown> {
  const packageId = derivePackageId(record);
  const cacheKey = `${packageId}::${importSpecifier}`;
  const cached = dependencyRuntime.moduleExportCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    if (importStack.includes(cacheKey)) {
      throw new Error(`Dependency module cycle while loading ${importSpecifier}.`);
    }

    if (!canPackageExposeSourceModules(record)) {
      const visibility = derivePackageSourceVisibility(record);
      throw new Error(`${derivePackageName(record)} is ${visibility}-source and cannot be imported as source.`);
    }

    const modulePath = record.manifest.exports?.modules?.[importSpecifier];
    if (!modulePath || !isSafeRelativePath(modulePath)) {
      throw new Error(`${derivePackageName(record)} does not export ${importSpecifier}.`);
    }

    const entry = await resolveRelativeFileEntry(record.directoryPath, modulePath);
    if (
      !entry ||
      !pluginSystemConfig.frontendExtensions.includes(entry.extension as never)
    ) {
      throw new Error(`${derivePackageName(record)} export ${importSpecifier} could not be resolved.`);
    }

    const allowedModules = await resolvePackageDependencyAllowedModules(
      record,
      dependencyRuntime,
      [...importStack, cacheKey],
    );
    const source = await commands.fsReadTextFile(entry.path).then(unwrapTauriResult);
    return loadPluginModuleFromSource(source, entry as PluginFileEntry, {
      resolveRelativeModuleSource: createPluginRelativeModuleSourceResolver(record.directoryPath),
      allowedModules,
    });
  })();

  dependencyRuntime.moduleExportCache.set(cacheKey, promise);
  return promise;
}

async function resolvePackageDependencyAllowedModules(
  record: PluginPackageRecord,
  dependencyRuntime: PluginPackageDependencyRuntime,
  importStack: string[] = [],
): Promise<Record<string, unknown>> {
  const ownerEntry = dependencyRuntime.graph.get(derivePackageId(record));
  const allowedModules: Record<string, unknown> = {};

  for (const dependency of record.manifest.dependencies ?? []) {
    const dependencyDiagnostic = ownerEntry?.dependencies.find(
      diagnostic =>
        diagnostic.id === dependency.id &&
        diagnostic.importAs === dependency.importAs,
    );
    if (dependencyDiagnostic?.status !== 'satisfied') {
      continue;
    }

    const dependencyRecord = dependencyRuntime.recordsById.get(dependency.id);
    if (!dependencyRecord) {
      continue;
    }

    const exportSpecifiers = dependency.importAs
      ? [dependency.importAs]
      : getPackageModuleExportSpecifiers(dependencyRecord);
    for (const importSpecifier of exportSpecifiers) {
      allowedModules[importSpecifier] = await loadPackageModuleExport(
        dependencyRecord,
        importSpecifier,
        dependencyRuntime,
        importStack,
      );
    }
  }

  return allowedModules;
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
  dependencyRuntime: PluginPackageDependencyRuntime,
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
    explorerActivityLanes: [],
    explorerViews: [],
    explorerWidgets: [],
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
  const packageDependencyEntry = dependencyRuntime.graph.get(packageId);
  if (isPluginDisabled(disabledPluginIds, packageId)) {
    result.plugins.push(createDisabledPackagePlugin(record, packageDependencyEntry));
    return result;
  }

  if (packageDependencyEntry?.blocked) {
    result.plugins.push(
      createMetadataOnlyPackagePlugin(record, {
        dependencyEntry: packageDependencyEntry,
        blockedReason: packageDependencyEntry.blockedReason,
      }),
    );
    result.warnings.push(
      `${packageName}: blocked by dependency: ${packageDependencyEntry.blockedReason}`,
    );
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
    pluginRoot: getPackageRootDirectory(record),
    pluginDirectory: record.directoryPath,
    backendDirectory: packageBackendDirectory,
    enablementKey: packageId,
  };

  const dependencyAllowedModules = await resolvePackageDependencyAllowedModules(
    record,
    dependencyRuntime,
  );
  const panelEntry = await resolvePackagePanelEntry(record);
  const panelRuntime = resolvePackagePanelRuntime(record);
  let packagePlugin: LoadedOverlayPlugin | null = null;
  if (panelEntry) {
    if (panelRuntime) {
      packageWarnings.push(
        `panelRuntime ${panelRuntime.runtimeId} is ignored because the package already provides a React panel entry`,
      );
    }
    try {
      const source = await commands.fsReadTextFile(panelEntry.path).then(unwrapTauriResult);
      packagePlugin = await loadPluginFromSource(source, panelEntry as PluginFileEntry, hostApiFactory, {
        context: {
          id: packageId,
          name: packageName,
          filePath: panelEntry.path,
          pluginRoot: getPackageRootDirectory(record),
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
          sourceKind: getPackageSourceKind(record),
          sourceLabel: packageName,
          manifestPath: record.manifestPath,
          packageKind: derivePackageKind(record),
          sourceVisibility: derivePackageSourceVisibility(record),
          category: packageCategory,
          tags: packageTags,
          testFiles: packageTestFiles,
          dependencies: packageDependencyEntry?.dependencies,
          moduleExports: getPackageModuleExportSpecifiers(record),
          blockedReason: null,
        },
        resolveRelativeModuleSource: createPluginRelativeModuleSourceResolver(record.directoryPath),
        allowedModules: dependencyAllowedModules,
      });
    } catch (error) {
      packageWarnings.push(String(error));
    }
  } else if (panelRuntime) {
    packagePlugin = {
      ...packagePreviewBaseContext,
      filePath: record.manifestPath,
      modified: record.modified,
      enabled: true,
      description: record.manifest.description,
      defaultOpen: record.manifest.defaultOpen ?? pluginSystemConfig.folderPanelsOpenByDefault,
      keepMounted: record.manifest.keepMounted ?? pluginSystemConfig.folderPanelsKeepMounted,
      error: null,
      diagnostics: {
        sourceKind: getPackageSourceKind(record),
        sourceLabel: packageName,
        manifestPath: record.manifestPath,
        packageKind: derivePackageKind(record),
        sourceVisibility: derivePackageSourceVisibility(record),
        category: packageCategory,
        tags: packageTags,
        testFiles: packageTestFiles,
        warnings: [],
        dependencies: packageDependencyEntry?.dependencies,
        moduleExports: getPackageModuleExportSpecifiers(record),
        blockedReason: null,
        capabilities: {
          panel: true,
          themes: 0,
          shaders: 0,
          fonts: 0,
          commands: 0,
          actions: 0,
          explorerActions: 0,
          contextMenuItems: 0,
          explorerActivityLanes: 0,
          explorerViews: 0,
          explorerWidgets: 0,
          previewLanes: 0,
          settingsSlots: 0,
        },
      },
      component: (props) => React.createElement(PluginWasmPanelSurface, {
        ...props,
        runtimeId: panelRuntime.runtimeId,
        buildTarget: panelRuntime.buildTarget,
      }),
    };
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

  const explorerViewModuleResolver = createPluginRelativeModuleSourceResolver(
    record.directoryPath,
  );
  const explorerViewRendererCache = new Map<
    string,
    React.ComponentType<ExplorerViewProps>
  >();
  const loadedExplorerViews: Array<
    OverlayPluginExplorerViewContribution | null
  > = await Promise.all(
    (record.manifest.contributions?.explorerViews ?? []).map(
      async (explorerView) => {
        const viewTitle =
          explorerView.title ||
          deriveDisplayNameFromFilePath(
            explorerView.renderer
              || explorerView.rendererEntry
              || explorerView.runtimeSurfaceId
              || explorerView.runtimeSurfaceRef
              || explorerView.runtimeId
              || explorerView.runtimeRef
              || 'explorer-view',
          );
        const stableId =
          explorerView.id || deriveIdFromName(viewTitle, 'explorer-view');
        const defaultDescriptor: Partial<ExplorerViewDescriptor> = {
          id: `${packageId}.explorer-view.${stableId}`,
          title: viewTitle,
          shortLabel: explorerView.shortLabel?.trim() || viewTitle,
          description: explorerView.description?.trim() || undefined,
          tags: explorerView.tags ?? [],
          priority:
            typeof explorerView.priority === 'number'
              ? explorerView.priority
              : 0,
          available: explorerView.available !== false,
          rendererKind:
            explorerView.rendererKind === 'wasm-panel'
              ? 'wasm-panel'
              : 'react',
          runtimeId:
            explorerView.runtimeId?.trim()
            || explorerView.runtimeRef?.trim()
            || explorerView.runtimeSurfaceId?.trim()
            || explorerView.runtimeSurfaceRef?.trim()
            || null,
          runtimeSurfaceId:
            explorerView.runtimeSurfaceId?.trim()
            || explorerView.runtimeSurfaceRef?.trim()
            || null,
          buildTarget: explorerView.buildTarget?.trim() || null,
          ownership: explorerView.ownership === 'surface' ? 'surface' : 'content',
          surfaceOwnership: normalizeExplorerViewSurfaceOwnership(
            explorerView.surfaceOwnership,
          ),
          density: normalizeExplorerViewDensityContract(explorerView.density),
          capabilities: normalizeExplorerViewCapabilities(
            explorerView.capabilities,
          ),
        };

        if (defaultDescriptor.rendererKind === 'wasm-panel') {
          const runtimeId =
            defaultDescriptor.runtimeSurfaceId || defaultDescriptor.runtimeId;
          if (!runtimeId) {
            packageWarnings.push(
              `explorer view ${viewTitle}: wasm-panel views require runtimeSurfaceId, runtimeSurfaceRef, runtimeId, or runtimeRef`,
            );
            return {
              ...normalizeExplorerViewDescriptor(defaultDescriptor, {
                id: `${packageId}.explorer-view.${stableId}`,
                title: viewTitle,
              }),
              pluginId: packageId,
              pluginName: packageName,
              sourceKind: 'plugin',
              sourceLabel: record.manifestPath,
              component: null,
              error: 'Missing wasm runtime id',
            } satisfies OverlayPluginExplorerViewContribution;
          }

          const descriptor = normalizeExplorerViewDescriptor(
            {
              ...defaultDescriptor,
              runtimeId,
              runtimeSurfaceId: runtimeId,
            },
            {
              id: `${packageId}.explorer-view.${stableId}`,
              title: viewTitle,
            },
          );

          return {
            ...descriptor,
            pluginId: packageId,
            pluginName: packageName,
            sourceKind: 'plugin',
            sourceLabel: record.manifestPath,
            component: (props) =>
              React.createElement(ExplorerWasmRuntimeSurface, {
                ...props,
                runtimeId,
                buildTarget: descriptor.buildTarget,
              }),
            error: null,
          } satisfies OverlayPluginExplorerViewContribution;
        }

        const rendererEntryValue =
          explorerView.rendererEntry?.trim() || explorerView.renderer?.trim() || null;
        if (!rendererEntryValue || !isSafeRelativePath(rendererEntryValue)) {
          packageWarnings.push(
            `explorer view ${viewTitle}: invalid renderer path`,
          );
          return {
            ...normalizeExplorerViewDescriptor(defaultDescriptor, {
              id: `${packageId}.explorer-view.${stableId}`,
              title: viewTitle,
            }),
            pluginId: packageId,
            pluginName: packageName,
            sourceKind: 'plugin',
            sourceLabel: record.manifestPath,
            component: null,
            error: 'Invalid renderer path',
          } satisfies OverlayPluginExplorerViewContribution;
        }

        const normalizedRendererEntry = normalizeRelativePath(
          rendererEntryValue,
        );
        let rendererComponent =
          explorerViewRendererCache.get(normalizedRendererEntry) ?? null;
        let loadedDescriptor = normalizeExplorerViewDescriptor(
          {
            ...defaultDescriptor,
            rendererEntry: normalizedRendererEntry,
          },
          {
            id: `${packageId}.explorer-view.${stableId}`,
            title: viewTitle,
          },
        );
        let errorMessage: string | null = null;
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
              `explorer view ${viewTitle}: renderer ${normalizedRendererEntry} could not be resolved`,
            );
            errorMessage = 'Renderer entry could not be resolved';
          } else {
            try {
              const source = await commands
                .fsReadTextFile(rendererEntry.path)
                .then(unwrapTauriResult);
              const loadedView = await loadExplorerViewFromSource(
                source,
                rendererEntry as PluginFileEntry,
                {
                  descriptorDefaults: {
                    ...defaultDescriptor,
                    rendererEntry: normalizedRendererEntry,
                  },
                  resolveRelativeModuleSource: explorerViewModuleResolver,
                },
              );
              loadedDescriptor = loadedView.descriptor;
              errorMessage = loadedView.error;
              if (loadedView.component) {
                rendererComponent = loadedView.component;
                explorerViewRendererCache.set(
                  normalizedRendererEntry,
                  rendererComponent,
                );
              }
            } catch (error) {
              errorMessage = String(error);
            }
          }
        }

        if (errorMessage) {
          packageWarnings.push(
            `explorer view ${viewTitle}: ${errorMessage}`,
          );
        }

        const rendererFilePath = joinPlatformPath(
          record.directoryPath,
          normalizedRendererEntry,
        );
        const explorerViewContext: OverlayPluginContext = {
          ...packagePreviewBaseContext,
          filePath: rendererFilePath,
        };
        const explorerViewApi = hostApiFactory(explorerViewContext);
        const boundComponent: BoundExplorerViewComponent | null =
          rendererComponent
            ? (props) =>
                React.createElement(rendererComponent!, {
                  ...props,
                  api: explorerViewApi,
                  plugin: explorerViewContext,
                })
            : null;

        return {
          ...loadedDescriptor,
          pluginId: packageId,
          pluginName: packageName,
          sourceKind: 'plugin',
          sourceLabel: record.manifestPath,
          component: boundComponent,
          error: errorMessage,
        } satisfies OverlayPluginExplorerViewContribution;
      },
    ),
  );
  result.explorerViews.push(
    ...loadedExplorerViews.filter(
      (
        contribution,
      ): contribution is OverlayPluginExplorerViewContribution =>
        contribution != null,
    ),
  );

  const explorerWidgetModuleResolver = createPluginRelativeModuleSourceResolver(
    record.directoryPath,
  );
  const explorerWidgetRendererCache = new Map<
    string,
    React.ComponentType<ExplorerWidgetProps>
  >();
  const loadedExplorerWidgets: Array<
    OverlayPluginExplorerWidgetContribution | null
  > = await Promise.all(
    (record.manifest.contributions?.explorerWidgets ?? []).map(
      async (explorerWidget) => {
        const widgetTitle =
          explorerWidget.title ||
          deriveDisplayNameFromFilePath(
            explorerWidget.renderer
              || explorerWidget.rendererEntry
              || explorerWidget.runtimeSurfaceId
              || explorerWidget.runtimeSurfaceRef
              || explorerWidget.runtimeId
              || explorerWidget.runtimeRef
              || 'explorer-widget',
          );
        const stableId =
          explorerWidget.id || deriveIdFromName(widgetTitle, 'explorer-widget');
        const widgetId = `${packageId}.explorer-widget.${stableId}`;
        const defaultDescriptor: Partial<ExplorerWidgetDescriptor> = {
          id: widgetId,
          title: widgetTitle,
          shortLabel: explorerWidget.shortLabel?.trim() || widgetTitle,
          description: explorerWidget.description?.trim() || undefined,
          category: explorerWidget.category?.trim() || 'widgets',
          tags: explorerWidget.tags ?? [],
          priority:
            typeof explorerWidget.priority === 'number'
              ? explorerWidget.priority
              : 0,
          available: explorerWidget.available !== false,
          chromeControlId:
            (explorerWidget.chromeControlId?.trim() as ExplorerWidgetDescriptor['chromeControlId'])
            || toExplorerWidgetChromeControlId(widgetId),
          rendererKind:
            explorerWidget.rendererKind === 'wasm-panel'
              ? 'wasm-panel'
              : 'react',
          runtimeId:
            explorerWidget.runtimeId?.trim()
            || explorerWidget.runtimeRef?.trim()
            || explorerWidget.runtimeSurfaceId?.trim()
            || explorerWidget.runtimeSurfaceRef?.trim()
            || null,
          runtimeSurfaceId:
            explorerWidget.runtimeSurfaceId?.trim()
            || explorerWidget.runtimeSurfaceRef?.trim()
            || null,
          buildTarget: explorerWidget.buildTarget?.trim() || null,
          surfaces: normalizeExplorerWidgetSurfaces(explorerWidget.surfaces),
          sizing: normalizeExplorerWidgetSizing(explorerWidget.sizing),
          capabilities: normalizeExplorerWidgetCapabilities(
            explorerWidget.capabilities,
          ),
        };

        if (defaultDescriptor.rendererKind === 'wasm-panel') {
          const runtimeId =
            defaultDescriptor.runtimeSurfaceId || defaultDescriptor.runtimeId;
          if (!runtimeId) {
            packageWarnings.push(
              `explorer widget ${widgetTitle}: wasm-panel widgets require runtimeSurfaceId, runtimeSurfaceRef, runtimeId, or runtimeRef`,
            );
            return {
              ...normalizeExplorerWidgetDescriptor(defaultDescriptor, {
                id: widgetId,
                title: widgetTitle,
              }),
              pluginId: packageId,
              pluginName: packageName,
              sourceKind: 'plugin',
              sourceLabel: record.manifestPath,
              component: null,
              error: 'Missing wasm runtime id',
            } satisfies OverlayPluginExplorerWidgetContribution;
          }

          const descriptor = normalizeExplorerWidgetDescriptor(
            {
              ...defaultDescriptor,
              runtimeId,
              runtimeSurfaceId: runtimeId,
            },
            {
              id: widgetId,
              title: widgetTitle,
            },
          );

          return {
            ...descriptor,
            pluginId: packageId,
            pluginName: packageName,
            sourceKind: 'plugin',
            sourceLabel: record.manifestPath,
            component: (props) =>
              React.createElement(ExplorerWasmWidgetSurface, {
                ...props,
                runtimeId,
                buildTarget: descriptor.buildTarget,
              }),
            error: null,
          } satisfies OverlayPluginExplorerWidgetContribution;
        }

        const rendererEntryValue =
          explorerWidget.rendererEntry?.trim() || explorerWidget.renderer?.trim() || null;
        if (!rendererEntryValue || !isSafeRelativePath(rendererEntryValue)) {
          packageWarnings.push(
            `explorer widget ${widgetTitle}: invalid renderer path`,
          );
          return {
            ...normalizeExplorerWidgetDescriptor(defaultDescriptor, {
              id: widgetId,
              title: widgetTitle,
            }),
            pluginId: packageId,
            pluginName: packageName,
            sourceKind: 'plugin',
            sourceLabel: record.manifestPath,
            component: null,
            error: 'Invalid renderer path',
          } satisfies OverlayPluginExplorerWidgetContribution;
        }

        const normalizedRendererEntry = normalizeRelativePath(
          rendererEntryValue,
        );
        let rendererComponent =
          explorerWidgetRendererCache.get(normalizedRendererEntry) ?? null;
        let loadedDescriptor = normalizeExplorerWidgetDescriptor(
          {
            ...defaultDescriptor,
            rendererEntry: normalizedRendererEntry,
          },
          {
            id: widgetId,
            title: widgetTitle,
          },
        );
        let errorMessage: string | null = null;
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
              `explorer widget ${widgetTitle}: renderer ${normalizedRendererEntry} could not be resolved`,
            );
            errorMessage = 'Renderer entry could not be resolved';
          } else {
            try {
              const source = await commands
                .fsReadTextFile(rendererEntry.path)
                .then(unwrapTauriResult);
              const loadedWidget = await loadExplorerWidgetFromSource(
                source,
                rendererEntry as PluginFileEntry,
                {
                  descriptorDefaults: {
                    ...defaultDescriptor,
                    rendererEntry: normalizedRendererEntry,
                  },
                  resolveRelativeModuleSource: explorerWidgetModuleResolver,
                },
              );
              loadedDescriptor = loadedWidget.descriptor;
              errorMessage = loadedWidget.error;
              if (loadedWidget.component) {
                rendererComponent = loadedWidget.component;
                explorerWidgetRendererCache.set(
                  normalizedRendererEntry,
                  rendererComponent,
                );
              }
            } catch (error) {
              errorMessage = String(error);
            }
          }
        }

        if (errorMessage) {
          packageWarnings.push(
            `explorer widget ${widgetTitle}: ${errorMessage}`,
          );
        }

        const rendererFilePath = joinPlatformPath(
          record.directoryPath,
          normalizedRendererEntry,
        );
        const explorerWidgetContext: OverlayPluginContext = {
          ...packagePreviewBaseContext,
          filePath: rendererFilePath,
        };
        const explorerWidgetApi = hostApiFactory(explorerWidgetContext);
        const boundComponent: BoundExplorerWidgetComponent | null =
          rendererComponent
            ? (props) =>
                React.createElement(rendererComponent!, {
                  ...props,
                  api: explorerWidgetApi,
                  plugin: explorerWidgetContext,
                })
            : null;

        return {
          ...loadedDescriptor,
          pluginId: packageId,
          pluginName: packageName,
          sourceKind: 'plugin',
          sourceLabel: record.manifestPath,
          component: boundComponent,
          error: errorMessage,
        } satisfies OverlayPluginExplorerWidgetContribution;
      },
    ),
  );
  result.explorerWidgets.push(
    ...loadedExplorerWidgets.filter(
      (
        contribution,
      ): contribution is OverlayPluginExplorerWidgetContribution =>
        contribution != null,
    ),
  );

  const explorerActivityLaneModuleResolver =
    createPluginRelativeModuleSourceResolver(record.directoryPath);
  const explorerActivityLaneRendererCache = new Map<
    string,
    React.ComponentType<ExplorerViewProps>
  >();
  const loadedExplorerActivityLanes: Array<
    OverlayPluginExplorerActivityLaneContribution | null
  > = await Promise.all(
    (record.manifest.contributions?.explorerActivityLanes ?? []).map(
      async (activityLane, laneIndex) => {
        const laneTitle =
          activityLane.title || activityLane.label || `Activity Lane ${laneIndex + 1}`;
        const stableLaneId =
          activityLane.id || deriveIdFromName(laneTitle, "activity-lane");
        const laneId = `plugin:${packageId}:${stableLaneId}`;
        const iconUrl =
          activityLane.iconPath && isSafeRelativePath(activityLane.iconPath)
            ? toAssetUrl(joinPlatformPath(record.directoryPath, normalizeRelativePath(activityLane.iconPath)))
            : undefined;
        const loadedViews = await Promise.all(
          (activityLane.views ?? []).map(async (activityView, viewIndex) => {
            const viewTitle = activityView.title || `View ${viewIndex + 1}`;
            const stableViewId =
              activityView.id || deriveIdFromName(viewTitle, "activity-view");
            const viewId = `${laneId}.view.${stableViewId}`;
            const runtimeId =
              activityView.runtimeSurfaceId?.trim()
              || activityView.runtimeSurfaceRef?.trim()
              || activityView.runtimeId?.trim()
              || activityView.runtimeRef?.trim()
              || null;
            const viewDescriptor = normalizeExplorerViewDescriptor(
              {
                id: viewId,
                title: viewTitle,
                shortLabel: viewTitle,
                description: activityView.description,
                tags: ["activity-lane"],
                priority: -activityView.order,
                rendererKind:
                  activityView.rendererKind === "wasm-panel"
                    ? "wasm-panel"
                    : "react",
                rendererEntry:
                  activityView.rendererEntry?.trim() ||
                  activityView.renderer?.trim() ||
                  null,
                runtimeId,
                runtimeSurfaceId: runtimeId,
                buildTarget: activityView.buildTarget?.trim() || null,
                ownership: "content",
              },
              {
                id: viewId,
                title: viewTitle,
              },
            );

            const baseContribution = {
              id: viewId,
              title: viewTitle,
              description: activityView.description,
              order: activityView.order,
              rendererKind: activityView.rendererKind,
              pluginId: packageId,
              pluginName: packageName,
              sourceKind: "plugin" as const,
              sourceLabel: record.manifestPath,
              rendererEntry: viewDescriptor.rendererEntry,
              runtimeId: viewDescriptor.runtimeId,
              runtimeSurfaceId: viewDescriptor.runtimeSurfaceId,
              buildTarget: viewDescriptor.buildTarget,
              viewDescriptor,
              component: null,
              error: null,
            } satisfies OverlayPluginExplorerActivityLaneViewContribution;

            if (
              activityView.rendererKind === "tree" ||
              activityView.rendererKind === "webview"
            ) {
              return {
                ...baseContribution,
                providerPending: true,
              } satisfies OverlayPluginExplorerActivityLaneViewContribution;
            }

            if (activityView.rendererKind === "wasm-panel") {
              if (!runtimeId) {
                packageWarnings.push(
                  `activity lane ${laneTitle} / ${viewTitle}: wasm-panel views require runtimeSurfaceId, runtimeSurfaceRef, runtimeId, or runtimeRef`,
                );
                return {
                  ...baseContribution,
                  error: "Missing wasm runtime id",
                } satisfies OverlayPluginExplorerActivityLaneViewContribution;
              }
              return {
                ...baseContribution,
                component: (props) =>
                  React.createElement(ExplorerWasmRuntimeSurface, {
                    ...props,
                    runtimeId,
                    buildTarget: viewDescriptor.buildTarget,
                  }),
              } satisfies OverlayPluginExplorerActivityLaneViewContribution;
            }

            const rendererEntryValue =
              activityView.rendererEntry?.trim() || activityView.renderer?.trim() || null;
            if (!rendererEntryValue || !isSafeRelativePath(rendererEntryValue)) {
              packageWarnings.push(
                `activity lane ${laneTitle} / ${viewTitle}: invalid renderer path`,
              );
              return {
                ...baseContribution,
                error: "Invalid renderer path",
              } satisfies OverlayPluginExplorerActivityLaneViewContribution;
            }

            const normalizedRendererEntry = normalizeRelativePath(rendererEntryValue);
            let rendererComponent =
              explorerActivityLaneRendererCache.get(normalizedRendererEntry) ??
              null;
            let loadedDescriptor = viewDescriptor;
            let errorMessage: string | null = null;
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
                errorMessage = "Renderer entry could not be resolved";
              } else {
                try {
                  const source = await commands
                    .fsReadTextFile(rendererEntry.path)
                    .then(unwrapTauriResult);
                  const loadedView = await loadExplorerViewFromSource(
                    source,
                    rendererEntry as PluginFileEntry,
                    {
                      descriptorDefaults: {
                        ...viewDescriptor,
                        rendererEntry: normalizedRendererEntry,
                      },
                      resolveRelativeModuleSource:
                        explorerActivityLaneModuleResolver,
                    },
                  );
                  loadedDescriptor = loadedView.descriptor;
                  errorMessage = loadedView.error;
                  if (loadedView.component) {
                    rendererComponent = loadedView.component;
                    explorerActivityLaneRendererCache.set(
                      normalizedRendererEntry,
                      rendererComponent,
                    );
                  }
                } catch (error) {
                  errorMessage = String(error);
                }
              }
            }

            if (errorMessage) {
              packageWarnings.push(
                `activity lane ${laneTitle} / ${viewTitle}: ${errorMessage}`,
              );
            }

            const rendererFilePath = joinPlatformPath(
              record.directoryPath,
              normalizedRendererEntry,
            );
            const activityViewContext: OverlayPluginContext = {
              ...packagePreviewBaseContext,
              filePath: rendererFilePath,
            };
            const activityViewApi = hostApiFactory(activityViewContext);
            const boundComponent: BoundExplorerViewComponent | null =
              rendererComponent
                ? (props) =>
                    React.createElement(rendererComponent!, {
                      ...props,
                      api: activityViewApi,
                      plugin: activityViewContext,
                    })
                : null;

            return {
              ...baseContribution,
              rendererEntry: normalizedRendererEntry,
              viewDescriptor: loadedDescriptor,
              component: boundComponent,
              error: errorMessage,
            } satisfies OverlayPluginExplorerActivityLaneViewContribution;
          }),
        );

        return {
          id: laneId,
          label: activityLane.label || laneTitle,
          shortLabel: activityLane.shortLabel || activityLane.label || laneTitle,
          iconName: activityLane.iconName || "Puzzle",
          iconUrl,
          sourceKind: "plugin",
          sourceLabel: record.manifestPath,
          defaultSide: activityLane.defaultSide ?? "left",
          defaultOrder: activityLane.defaultOrder ?? 900 + laneIndex * 10,
          views: loadedViews.sort((left, right) => left.order - right.order),
          pluginId: packageId,
          pluginName: packageName,
        } satisfies OverlayPluginExplorerActivityLaneContribution;
      },
    ),
  );
  result.explorerActivityLanes.push(
    ...loadedExplorerActivityLanes.filter(
      (
        contribution,
      ): contribution is OverlayPluginExplorerActivityLaneContribution =>
        contribution != null,
    ),
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
          deriveDisplayNameFromFilePath(
            previewLane.renderer
              || previewLane.runtimeSurfaceId
              || previewLane.runtimeSurfaceRef
              || 'preview-lane',
          );
        const stableId =
          previewLane.id || deriveIdFromName(laneTitle, 'preview-lane');
        let boundComponent: BoundOverlayPluginPreviewLaneComponent | null = null;
        let normalizedRendererEntry: string | null = null;
        if (previewLane.rendererKind === 'wasm-panel') {
          const runtimeSurfaceId =
            previewLane.runtimeSurfaceId?.trim()
            || previewLane.runtimeSurfaceRef?.trim()
            || '';
          if (!runtimeSurfaceId) {
            packageWarnings.push(
              `preview lane ${laneTitle}: wasm-panel lanes require runtimeSurfaceId or runtimeSurfaceRef`,
            );
            return null;
          }

          boundComponent = (props) =>
            React.createElement(PluginWasmPreviewSurface, {
              ...props,
              runtimeId: runtimeSurfaceId,
              buildTarget: previewLane.buildTarget?.trim() || null,
            });
        } else {
          if (!previewLane.renderer || !isSafeRelativePath(previewLane.renderer)) {
            packageWarnings.push(
              `preview lane ${laneTitle}: invalid renderer path`,
            );
            return null;
          }

          normalizedRendererEntry = normalizeRelativePath(
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
                  allowedModules: dependencyAllowedModules,
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
          boundComponent = (props) =>
            React.createElement(rendererComponent!, {
              ...props,
              api: previewLaneApi.bindExecutionContext(props.executionContext),
              plugin: previewLaneContext,
            });
        }

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
          rendererKind: previewLane.rendererKind === 'wasm-panel'
            ? 'wasm-panel'
            : 'react',
          rendererEntry: normalizedRendererEntry,
          runtimeId: previewLane.runtimeId?.trim() || null,
          runtimeSurfaceId:
            previewLane.runtimeSurfaceId?.trim()
            || previewLane.runtimeSurfaceRef?.trim()
            || null,
          buildTarget: previewLane.buildTarget?.trim() || null,
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
                allowedModules: dependencyAllowedModules,
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
                      allowedModules: dependencyAllowedModules,
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

  const capabilities: OverlayPluginCapabilitySummary = {
    panel: packagePlugin != null,
    mobilePanes: record.manifest.contributions?.mobilePanes?.length ?? 0,
    themes: result.themePackages.length,
    shaders: result.shaders.length,
    fonts: result.fonts.length,
    commands: result.commands.length,
    actions: result.actions.length,
    explorerActions: result.explorerActions.length,
    contextMenuItems: result.contextMenuItems.length,
    explorerActivityLanes: result.explorerActivityLanes.length,
    explorerViews: result.explorerViews.length,
    explorerWidgets: result.explorerWidgets.length,
    previewLanes: result.previewLanes.length,
    settingsSlots: result.settingsSlots.length,
  };
  if (packagePlugin) {
    result.plugins.push({
      ...packagePlugin,
      diagnostics: {
        ...packagePlugin.diagnostics,
        warnings: packageWarnings,
        dependencies: packageDependencyEntry?.dependencies,
        moduleExports: getPackageModuleExportSpecifiers(record),
        blockedReason: null,
        capabilities,
      },
    });
  } else if (
    derivePackageKind(record) === 'library' ||
    record.rootKind === 'packages' ||
    getPackageModuleExportSpecifiers(record).length > 0
  ) {
    result.plugins.push(
      createMetadataOnlyPackagePlugin(record, {
        dependencyEntry: packageDependencyEntry,
        warnings: packageWarnings,
        capabilities,
      }),
    );
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
    explorerActivityLanes: [],
    explorerViews: [],
    explorerWidgets: [],
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
  const packageRootEntries = await listDirectoryOptional(pluginSystemConfig.packagesDirectory);
  const legacyFiles = rootEntries
    .filter(entry => !entry.is_dir && pluginSystemConfig.frontendExtensions.includes(entry.extension as never))
    .sort((left, right) => left.name.localeCompare(right.name));
  const vsixFiles = rootEntries
    .filter(entryLooksLikeVsix)
    .sort((left, right) => left.name.localeCompare(right.name));
  const pluginPackageDirectories = rootEntries
    .filter(entry => entry.is_dir)
    .sort((left, right) => left.name.localeCompare(right.name));
  const dependencyPackageDirectories = packageRootEntries
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
    explorerActivityLanes: [],
    explorerViews: [],
    explorerWidgets: [],
    previewLanes: [],
    settingsSlots: [],
    workflows: [],
    warnings: [],
  };

  const packageRecords: PluginPackageRecord[] = [];
  for (const directory of pluginPackageDirectories) {
    const manifest = await readPluginManifest(directory.path);
    if (!manifest) {
      continue;
    }
    packageRecords.push({
      rootKind: 'plugins',
      directoryName: directory.name,
      directoryPath: directory.path,
      manifestPath: manifest.manifestPath,
      manifest: manifest.manifest,
      modified: directory.modified,
    });
  }

  for (const directory of dependencyPackageDirectories) {
    const manifest = await readPluginManifest(directory.path);
    if (!manifest) {
      continue;
    }
    packageRecords.push({
      rootKind: 'packages',
      directoryName: directory.name,
      directoryPath: directory.path,
      manifestPath: manifest.manifestPath,
      manifest: manifest.manifest,
      modified: directory.modified,
    });
  }

  const dependencyRuntimeResult = createPackageDependencyRuntime(
    packageRecords,
    disabledPluginIds,
  );
  aggregate.warnings.push(...dependencyRuntimeResult.warnings);

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

  const vsixResults = await Promise.allSettled(vsixFiles.map(async (entry) => {
    const resolved = await resolveVsCodeExtensionForRail(entry);
    if (!resolved) {
      throw new Error('VSIX package.json could not be resolved');
    }
    const disabled = isPluginDisabled(disabledPluginIds, resolved.extensionId);
    const lanes = disabled ? [] : mapVsixManifestToGreebleActivityLanes(resolved);
    const commands = disabled ? [] : mapVsixManifestToGreebleCommands(resolved);
    return {
      plugin: createVsCodeExtensionMetadataPlugin(resolved, lanes, disabled),
      lanes,
      commands,
    };
  }));

  vsixResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      aggregate.plugins.push(result.value.plugin);
      aggregate.explorerActivityLanes.push(...result.value.lanes);
      aggregate.commands.push(...result.value.commands);
      return;
    }
    const vsixEntry = vsixFiles[index];
    const vsixName = vsixEntry?.name ?? vsixEntry?.path ?? 'VSIX extension';
    aggregate.warnings.push(`${vsixName}: ${String(result.reason)}`);
  });

  for (const record of dependencyRuntimeResult.runtime.recordsById.values()) {
    try {
      const packageResult = await loadPluginPackage(
        record,
        hostApiFactory,
        disabledPluginIds,
        dependencyRuntimeResult.runtime,
      );
      aggregate.plugins.push(...packageResult.plugins);
      aggregate.themePackages.push(...packageResult.themePackages);
      aggregate.shaders.push(...packageResult.shaders);
      aggregate.fonts.push(...packageResult.fonts);
      aggregate.commands.push(...packageResult.commands);
      aggregate.actionPacks.push(...packageResult.actionPacks);
      aggregate.actions.push(...packageResult.actions);
      aggregate.explorerActions.push(...packageResult.explorerActions);
      aggregate.contextMenuItems.push(...packageResult.contextMenuItems);
      aggregate.explorerActivityLanes.push(...packageResult.explorerActivityLanes);
      aggregate.explorerViews.push(...packageResult.explorerViews);
      aggregate.explorerWidgets.push(...packageResult.explorerWidgets);
      aggregate.previewLanes.push(...packageResult.previewLanes);
      aggregate.settingsSlots.push(...packageResult.settingsSlots);
      aggregate.workflows.push(...packageResult.workflows);
      aggregate.warnings.push(...packageResult.warnings);
    } catch (error) {
      aggregate.warnings.push(`${record.directoryName}: ${String(error)}`);
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
  aggregate.explorerActivityLanes.sort(
    (left, right) =>
      (left.defaultOrder ?? 900) - (right.defaultOrder ?? 900) ||
      left.label.localeCompare(right.label),
  );
  aggregate.explorerViews.sort(
    (left, right) =>
      right.priority - left.priority || left.title.localeCompare(right.title),
  );
  aggregate.explorerWidgets.sort(
    (left, right) =>
      right.priority - left.priority || left.title.localeCompare(right.title),
  );
  aggregate.workflows.sort((left, right) => left.title.localeCompare(right.title));
  aggregate.settingsSlots.sort(
    (left, right) =>
      left.order - right.order || left.title.localeCompare(right.title),
  );

  return aggregate;
}
