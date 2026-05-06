import React from 'react';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as TauriNotification from '@tauri-apps/plugin-notification';
import * as LucideReact from '@/components/AppIcons';
import * as WorkbenchAdapters from './pluginWorkbenchAdapters';
import type { OverlayThemeDefinition } from '../config/appearance';
import type { OverlayResolvedIconTheme } from '../config/iconTheme';
import type { OverlayPluginPreviewLaneDescriptor } from '../config/pluginPreviewLanes';
import type {
  OverlayPluginSettingsSlotDescriptor,
  OverlayPluginSettingsValue,
} from '../config/pluginSettings';
import type {
  ExplorerWorkflowHostControls,
  ExplorerWorkflowLaunchRequest,
  OverlayPluginWorkflowDescriptor,
} from './explorer/explorerWorkflowContracts';
import type { FolderIconRule, FolderIconValue } from '../config/folderIcons';
import {
  getPluginBackendDirectory,
  getPluginDirectory,
  pluginSystemConfig,
} from '../config/plugins';
import type { EditorSettings } from '../store/settingsStore';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModuleGraph,
  isSupportedRuntimeFile,
  transpileRuntimeModuleGraph,
  type RuntimeFileEntry,
  type RuntimeModuleGraph,
  type RuntimeRelativeModuleSourceResolver,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';
import {
  callRuntimeAction,
  getRuntimePackage,
  listRuntimePackages,
  openRuntimeTui,
  prepareRuntimePackage,
  runRuntimeCommand,
  type DiscoveredRuntimePackage,
  type ExecutionContextSnapshot,
  type ExternalRuntimeCommandRequest,
  type ExternalRuntimeCommandResult,
  type ExternalRuntimeTuiLaunch,
  type RuntimeCallTypedRequest,
  type RuntimeCallTypedResponse,
  type RuntimeListPackagesRequest,
  type RuntimeListPackagesResponse,
  type RuntimePreparePackageRequest,
  type RuntimePreparePackageResponse,
} from '../runtime/externalRuntimeBackend';
import type {
  ExplorerArchiveExtractionMode,
  ExplorerFileEntry,
} from '../runtime/explorerBackend';
import { type ExtensionHostClient } from '../runtime/extensionHostApi';
import type { OverlayPluginIndexApi } from '../runtime/pluginIndexApi';
import type {
  ExplorerPdfPreviewDocument,
  ExplorerPdfSaveEditsOutput,
} from '../runtime/pdfPreviewBackend';
import type {
  ManagedPythonActionResponse,
  ManagedPythonRuntimeConfig,
} from '../runtime/pythonRuntimeBackend';
import type {
  ExplorerShaderPreviewCompileOutput,
  ExplorerShaderPreviewDiagnostic,
  ExplorerShaderPreviewEntryPoint,
  ExplorerShaderPreviewFormat,
  ExplorerShaderPreviewStage,
} from '../runtime/shaderPreviewBackend';
import {
  getPluginPanelOpenRequestEvent,
  readPluginPanelOpenRequest,
  requestPluginPanelOpen,
} from '../runtime/pluginPanelRequests';
import type { ExplorerResolvedBuiltInPreviewDescriptor } from './explorer/explorerPreviewRegistry';
import type { ExplorerResolvedScriptPreview } from './explorer/explorerScriptRuntime';
import type { ExplorerPreviewContextMenuRegistration } from './explorer/explorerPreviewContextMenu';
import type { ExplorerPreviewWildcardWorkflowTab } from './explorer/explorerPreviewWorkflowTabs';
import type {
  ExplorerPdfWorkbenchChromeState,
  ExplorerPdfWorkbenchController,
} from './ExplorerPdfWorkbench';
import type { EditorSearchFocusTarget } from './fileExplorerSearchFocus';
import type { ExplorerPreviewEntryDragRequest } from './useExplorerPreviewEntryDirectDrag';
import {
  ExplorerWorkflowButton,
  ExplorerWorkflowEmptyState,
  ExplorerWorkflowFieldGrid,
  ExplorerWorkflowInput,
  ExplorerWorkflowMetaStrip,
  ExplorerWorkflowResultCard,
  ExplorerWorkflowResultCardHeader,
  ExplorerWorkflowResultList,
  ExplorerWorkflowResultRow,
  ExplorerWorkflowRowActions,
  ExplorerWorkflowSection,
  ExplorerWorkflowStatusNotice,
} from './explorer/ExplorerWorkflowPrimitives';

export interface PluginFileEntry extends RuntimeFileEntry {}

export interface OverlayPluginContext {
  id: string;
  name: string;
  filePath: string;
  pluginRoot: string;
  pluginDirectory: string;
  backendDirectory: string;
  enablementKey?: string;
}

export interface OverlayPluginApi {
  invoke: typeof TauriCore.invoke;
  event: typeof TauriEvent;
  window: typeof TauriWindow;
  fs: typeof TauriFs;
  notification: typeof TauriNotification;
  host: ExtensionHostClient;
  index: OverlayPluginIndexApi;
  settings?: OverlayPluginSettingsApi;
  storage?: OverlayPluginStorageApi;
  assets?: OverlayPluginAssetsApi;
  workflows: OverlayPluginWorkflowApi;
  refreshPlugins: () => Promise<void>;
  openPluginsFolder: () => Promise<void>;
  openPanel: (panelId: string, payload?: Record<string, string>) => void;
  openWindowedPanel: (panelId: string, payload?: Record<string, string>) => void;
  dockWindowedPanel: (panelId: string, payload?: Record<string, string>) => void;
  runBackend: (entry: string, args?: string[]) => Promise<PluginBackendResult>;
  bindExecutionContext: (
    executionContext: ExecutionContextSnapshot | null,
  ) => OverlayPluginApi;
}

export interface OverlayPluginStorageApi {
  rootDir: string;
  ensureDir: (relativePath?: string) => Promise<string>;
  readTextFile: (relativePath: string) => Promise<string>;
  writeTextFile: (relativePath: string, data: string) => Promise<void>;
  writeFile: (relativePath: string, data: Uint8Array) => Promise<void>;
}

export interface OverlayPluginAssetsApi {
  rootDir: string;
  resolvePath: (relativePath: string) => string;
  resolveUrl: (relativePath: string) => string;
}

export interface OverlayPluginSettingsApi {
  pluginId: string;
  getStoredValues: () => Record<string, OverlayPluginSettingsValue>;
  getValue: <TValue = OverlayPluginSettingsValue>(
    settingId: string,
    fallbackValue?: TValue,
  ) => TValue | OverlayPluginSettingsValue;
  setValue: (settingId: string, value: unknown) => void;
  patchValues: (updates: Record<string, unknown>) => void;
  resetValues: (settingIds?: string[]) => void;
  subscribe: (
    listener: (values: Record<string, OverlayPluginSettingsValue>) => void,
  ) => () => void;
}

export interface OverlayPluginWorkflowApi {
  open: (
    workflowId: string,
    options?: {
      payload?: Record<string, unknown> | null;
      titleOverride?: string | null;
    },
  ) => Promise<void>;
  close: () => Promise<void>;
}

export interface OverlayPluginHostContext {
  mode: 'panel-tab' | 'manager-preview';
  width: number;
  height: number;
  zoom: number;
  compact: boolean;
  density: 'compact' | 'regular';
}

export interface OverlayPluginProps {
  plugin: OverlayPluginContext;
  api: OverlayPluginApi;
  host?: OverlayPluginHostContext;
  appearance: {
    theme: OverlayThemeDefinition;
    fonts: {
      ui: string;
      mono: string;
    };
    cssVars: Record<string, string>;
  };
}

export interface OverlayPluginDefinition {
  id?: string;
  name?: string;
  description?: string;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  component: React.ComponentType<OverlayPluginProps>;
}

export interface OverlayPluginPreviewHostContext {
  mode: 'preview-pane';
  width: number;
  height: number;
  zoom: number;
  compact: boolean;
  density: 'compact' | 'regular';
}

export interface OverlayPluginPreviewFileContext {
  path: string;
  resolvedPath: string;
  name: string;
  extension: string;
  size: number;
  assetUrl: string;
  isDirectory: boolean;
}

export interface OverlayPluginPreviewCursorPosition {
  lineNumber: number;
  column: number;
}

export interface OverlayPluginPythonPreviewMetadata {
  source: 'extension' | 'executable';
}

export interface OverlayPluginCollectionWorkbenchHost {
  refreshRevision: number;
  showHiddenFiles: boolean;
  jumpToFolderEnabled: boolean;
  onToggleJumpToFolder?: () => void;
  onOpenEntry: (entry: ExplorerFileEntry) => void;
  onStartDragOutEntry?: (
    request: ExplorerPreviewEntryDragRequest<ExplorerFileEntry>,
  ) => void;
  onExtractArchive?: (mode: ExplorerArchiveExtractionMode) => void;
  iconTheme?: OverlayResolvedIconTheme;
  folderIconRules?: readonly FolderIconRule[];
  defaultFolderIcon?: FolderIconValue;
}

export interface OverlayPluginPdfWorkbenchHost {
  document: ExplorerPdfPreviewDocument;
  onSaved?: (output: ExplorerPdfSaveEditsOutput) => Promise<void> | void;
  onDocumentChange?: (document: ExplorerPdfPreviewDocument) => void;
  onChromeStateChange?: (state: ExplorerPdfWorkbenchChromeState) => void;
  onControllerChange?: (controller: ExplorerPdfWorkbenchController | null) => void;
  onRegisterCloseGuard?: (guard: (() => Promise<boolean>) | null) => void;
}

export interface OverlayPluginTextWorkbenchHost {
  content: string;
  language: string;
  renderKind: 'none' | 'markdown' | 'html';
  scriptPreview: ExplorerResolvedScriptPreview | null;
  pythonPreview: OverlayPluginPythonPreviewMetadata | null;
  focusTarget: EditorSearchFocusTarget | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  error: string | null;
  editorSettings: EditorSettings;
  pythonRuntimeConfig: ManagedPythonRuntimeConfig | null;
  pythonBootstrapPackageInput: string;
  onChange: (value: string) => void;
  onSave: () => Promise<boolean>;
  onCursorPositionChange?: (
    position: OverlayPluginPreviewCursorPosition,
  ) => void;
  onRunScript?: () => Promise<void> | void;
  onStopScriptRun?: () => void;
  onRunPythonManaged?: () => Promise<ManagedPythonActionResponse>;
  onRunPythonInTerminal?: () => Promise<void>;
  onOpenManagedPythonRepl?: () => Promise<void>;
}

export interface OverlayPluginShaderWorkbenchHost {
  format: ExplorerShaderPreviewFormat;
  editableSource: string | null;
  inspectionSource: string;
  isReadOnly: boolean;
  normalizedWgsl: string | null;
  diagnostics: ExplorerShaderPreviewDiagnostic[];
  entryPoints: ExplorerShaderPreviewEntryPoint[];
  selectedScene: 'sphere' | 'fullscreen';
  selectedStage: ExplorerShaderPreviewStage | null;
  selectedEntryPoint: string | null;
  previewAbi: string;
  supportsLivePreview: boolean;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  onSourceChange: (value: string) => void;
  onSelectionChange: (selection: {
    selectedStage?: ExplorerShaderPreviewStage | null;
    selectedEntryPoint?: string | null;
  }) => void;
  onCompileResult: (result: ExplorerShaderPreviewCompileOutput) => void;
  onSceneChange: (scene: 'sphere' | 'fullscreen') => void;
  onSave?: () => Promise<void>;
}

export interface OverlayPluginPreviewWorkbenchContext {
  delegateDescriptor: ExplorerResolvedBuiltInPreviewDescriptor | null;
  collection?: OverlayPluginCollectionWorkbenchHost;
  pdf?: OverlayPluginPdfWorkbenchHost;
  text?: OverlayPluginTextWorkbenchHost;
  shader?: OverlayPluginShaderWorkbenchHost;
}

export interface OverlayPluginPreviewRuntimeBridge {
  runtimeId: string | null;
  getRuntimePackage: () => Promise<DiscoveredRuntimePackage | null>;
  listRuntimePackages: (
    request?: RuntimeListPackagesRequest | null,
  ) => Promise<RuntimeListPackagesResponse>;
  prepareRuntimePackage: (
    request: RuntimePreparePackageRequest,
  ) => Promise<RuntimePreparePackageResponse>;
  callRuntimeAction: <TResult = unknown, TPayload = unknown>(
    request: RuntimeCallTypedRequest<TPayload>,
  ) => Promise<RuntimeCallTypedResponse<TResult>>;
  runRuntimeCommand: (
    request: ExternalRuntimeCommandRequest,
  ) => Promise<ExternalRuntimeCommandResult>;
  openRuntimeTui: (runtimeId: string) => Promise<ExternalRuntimeTuiLaunch>;
}

export type OverlayPluginPreviewWorkbenchStatusTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger';

export interface OverlayPluginPreviewWorkbenchStatus {
  label: string;
  tone?: OverlayPluginPreviewWorkbenchStatusTone;
}

export interface OverlayPluginPreviewLaneProps {
  plugin: OverlayPluginContext;
  api: OverlayPluginApi;
  appearance: OverlayPluginProps['appearance'];
  host: OverlayPluginPreviewHostContext;
  executionContext: ExecutionContextSnapshot | null;
  lane: OverlayPluginPreviewLaneDescriptor;
  file: OverlayPluginPreviewFileContext;
  runtime: OverlayPluginPreviewRuntimeBridge;
  workbench?: OverlayPluginPreviewWorkbenchContext | null;
  viewMode: 'preview' | 'edit';
  workflowTabId: string;
  previewBackedByArchiveVirtual: boolean;
  onRegisterWorkflowTabs?: (
    tabs: ExplorerPreviewWildcardWorkflowTab[] | null,
  ) => void;
  onRegisterContextMenuRegistration?: (
    registration: ExplorerPreviewContextMenuRegistration | null,
  ) => void;
  onRegisterCloseGuard?: (guard: (() => Promise<boolean>) | null) => void;
  onRegisterWorkbenchStatus?: (
    status: OverlayPluginPreviewWorkbenchStatus | null,
  ) => void;
  onRefreshPreviewEntry?: () => Promise<void> | void;
  onViewModeChange?: (mode: 'preview' | 'edit') => void;
}

export interface OverlayPluginPreviewLaneDefinition {
  component: React.ComponentType<OverlayPluginPreviewLaneProps>;
}

export interface OverlayPluginWorkflowHostContext {
  mode: 'explorer-workflow';
  width: number;
  height: number;
  compact: boolean;
  density: 'compact' | 'regular';
}

export interface OverlayPluginWorkflowProps {
  plugin: OverlayPluginContext;
  api: OverlayPluginApi;
  appearance: OverlayPluginProps['appearance'];
  host: OverlayPluginWorkflowHostContext;
  executionContext: ExecutionContextSnapshot | null;
  workflow: OverlayPluginWorkflowDescriptor;
  launch: ExplorerWorkflowLaunchRequest<Record<string, unknown> | null>;
  controls: ExplorerWorkflowHostControls;
}

export interface OverlayPluginWorkflowDefinition {
  component: React.ComponentType<OverlayPluginWorkflowProps>;
  descriptor?: Partial<
    Pick<
      OverlayPluginWorkflowDescriptor,
      'title' | 'description' | 'iconName' | 'keywords' | 'contexts' | 'defaultSize'
    >
  >;
}

export interface OverlayPluginSettingsSlotHost {
  getValues: () => Record<string, OverlayPluginSettingsValue>;
  getValue: <TValue = OverlayPluginSettingsValue>(
    settingId: string,
    fallbackValue?: TValue,
  ) => TValue | OverlayPluginSettingsValue;
  setValue: (settingId: string, value: unknown) => void;
  patchValues: (updates: Record<string, unknown>) => void;
  resetValues: (settingIds?: string[]) => void;
  subscribe: (
    listener: (values: Record<string, OverlayPluginSettingsValue>) => void,
  ) => () => void;
}

export interface OverlayPluginSettingsSlotProps {
  plugin: OverlayPluginContext;
  api: OverlayPluginApi;
  appearance: OverlayPluginProps['appearance'];
  slot: OverlayPluginSettingsSlotDescriptor;
  host: OverlayPluginSettingsSlotHost;
}

export interface OverlayPluginSettingsSlotDefinition {
  component: React.ComponentType<OverlayPluginSettingsSlotProps>;
}

export type BoundOverlayPluginPreviewLaneProps = Omit<
  OverlayPluginPreviewLaneProps,
  'plugin' | 'api'
>;

export type BoundOverlayPluginPreviewLaneComponent =
  React.ComponentType<BoundOverlayPluginPreviewLaneProps>;

export type BoundOverlayPluginSettingsSlotProps = Omit<
  OverlayPluginSettingsSlotProps,
  'plugin' | 'api'
>;

export type BoundOverlayPluginSettingsSlotComponent =
  React.ComponentType<BoundOverlayPluginSettingsSlotProps>;

export type BoundOverlayPluginWorkflowProps = Omit<
  OverlayPluginWorkflowProps,
  'plugin' | 'api'
>;

export type BoundOverlayPluginWorkflowComponent =
  React.ComponentType<BoundOverlayPluginWorkflowProps>;

export type OverlayPluginSourceKind =
  | 'file-plugin'
  | 'package-plugin'
  | 'library-package';

export type OverlayPluginPackageKind = 'plugin' | 'library' | 'runtime';

export type OverlayPluginDependencyStatus =
  | 'satisfied'
  | 'missing'
  | 'disabled'
  | 'incompatible'
  | 'cyclic'
  | 'blocked';

export interface OverlayPluginDependencyDiagnostic {
  id: string;
  importAs?: string;
  required: boolean;
  requestedVersion?: string;
  installedVersion?: string;
  packageName?: string;
  status: OverlayPluginDependencyStatus;
  message: string;
}

export interface OverlayPluginCapabilitySummary {
  panel: boolean;
  mobilePanes?: number;
  themes: number;
  shaders: number;
  fonts: number;
  commands: number;
  actions: number;
  explorerActions: number;
  contextMenuItems: number;
  previewLanes: number;
  settingsSlots: number;
}

export interface OverlayPluginDiagnostics {
  sourceKind: OverlayPluginSourceKind;
  sourceLabel: string;
  manifestPath?: string;
  packageKind?: OverlayPluginPackageKind;
  category: string;
  tags: string[];
  testFiles: OverlayPluginTestFile[];
  warnings: string[];
  dependencies?: OverlayPluginDependencyDiagnostic[];
  moduleExports?: string[];
  blockedReason?: string | null;
  capabilities: OverlayPluginCapabilitySummary;
}

export interface OverlayPluginTestFile {
  id: string;
  label: string;
  path: string;
  description?: string;
  extension: string;
  isDirectory: boolean;
}

export interface LoadedOverlayPlugin extends OverlayPluginContext {
  description?: string;
  modified: number;
  enabled: boolean;
  defaultOpen: boolean;
  keepMounted: boolean;
  component: React.ComponentType<OverlayPluginProps> | null;
  error: string | null;
  diagnostics: OverlayPluginDiagnostics;
}

export interface PluginBackendResult {
  stdout: string;
  stderr: string;
  status: number;
}

export interface LoadPluginFromSourceOptions {
  context?: Partial<OverlayPluginContext>;
  defaults?: Partial<
    Pick<
      OverlayPluginDefinition,
      'id' | 'name' | 'description' | 'defaultOpen' | 'keepMounted'
    >
  >;
  diagnostics?: Partial<OverlayPluginDiagnostics>;
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
  allowedModules?: Record<string, unknown>;
}

export function definePlugin(
  definition: OverlayPluginDefinition,
): OverlayPluginDefinition {
  return definition;
}

export function definePreviewLane(
  definition:
    | OverlayPluginPreviewLaneDefinition
    | React.ComponentType<OverlayPluginPreviewLaneProps>,
): OverlayPluginPreviewLaneDefinition {
  if (typeof definition === 'function') {
    return {
      component: definition,
    };
  }
  return definition;
}

export function defineSettingsSlot(
  definition:
    | OverlayPluginSettingsSlotDefinition
    | React.ComponentType<OverlayPluginSettingsSlotProps>,
): OverlayPluginSettingsSlotDefinition {
  if (typeof definition === 'function') {
    return {
      component: definition,
    };
  }
  return definition;
}

export function defineWorkflow(
  definition:
    | OverlayPluginWorkflowDefinition
    | React.ComponentType<OverlayPluginWorkflowProps>,
): OverlayPluginWorkflowDefinition {
  if (typeof definition === 'function') {
    return {
      component: definition,
    };
  }
  return definition;
}

export function isFrontendPluginFile(entry: PluginFileEntry): boolean {
  return isSupportedRuntimeFile(
    entry,
    pluginSystemConfig.frontendExtensions,
  );
}

export function derivePluginId(name: string): string {
  return deriveRuntimeModuleId(name, 'plugin');
}

export function derivePluginName(name: string): string {
  return deriveRuntimeModuleName(name, 'Plugin');
}

export async function loadPluginFromSource(
  source: string,
  entry: PluginFileEntry,
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
  options?: LoadPluginFromSourceOptions,
): Promise<LoadedOverlayPlugin> {
  const fileId = derivePluginId(entry.name);
  const context: OverlayPluginContext = {
    id: options?.context?.id ?? fileId,
    name: options?.context?.name ?? derivePluginName(entry.name),
    filePath: options?.context?.filePath ?? entry.path,
    pluginRoot:
      options?.context?.pluginRoot ?? pluginSystemConfig.pluginsDirectory,
    pluginDirectory:
      options?.context?.pluginDirectory ?? getPluginDirectory(fileId),
      backendDirectory:
        options?.context?.backendDirectory ?? getPluginBackendDirectory(fileId),
      enablementKey: options?.context?.enablementKey ?? fileId,
  };
  const diagnostics: OverlayPluginDiagnostics = {
    sourceKind: options?.diagnostics?.sourceKind ?? 'file-plugin',
    sourceLabel: options?.diagnostics?.sourceLabel ?? context.filePath,
    manifestPath: options?.diagnostics?.manifestPath,
    packageKind: options?.diagnostics?.packageKind,
    category: options?.diagnostics?.category ?? 'General',
    tags: options?.diagnostics?.tags ?? [],
    testFiles: options?.diagnostics?.testFiles ?? [],
    warnings: options?.diagnostics?.warnings ?? [],
    dependencies: options?.diagnostics?.dependencies,
    moduleExports: options?.diagnostics?.moduleExports,
    blockedReason: options?.diagnostics?.blockedReason ?? null,
    capabilities: {
      panel: options?.diagnostics?.capabilities?.panel ?? true,
      themes: options?.diagnostics?.capabilities?.themes ?? 0,
      shaders: options?.diagnostics?.capabilities?.shaders ?? 0,
      fonts: options?.diagnostics?.capabilities?.fonts ?? 0,
      commands: options?.diagnostics?.capabilities?.commands ?? 0,
      actions: options?.diagnostics?.capabilities?.actions ?? 0,
      explorerActions:
        options?.diagnostics?.capabilities?.explorerActions ?? 0,
      contextMenuItems:
        options?.diagnostics?.capabilities?.contextMenuItems ?? 0,
      previewLanes: options?.diagnostics?.capabilities?.previewLanes ?? 0,
      settingsSlots: options?.diagnostics?.capabilities?.settingsSlots ?? 0,
    },
  };

  try {
    const transpiledGraph = await transpilePluginGraph(
      context.filePath,
      source,
      options?.resolveRelativeModuleSource,
    );
    const exported = executePluginModuleGraph(
      transpiledGraph,
      options?.allowedModules,
    );
    const normalized = normalizePluginExport(exported, context);

    const plugin: LoadedOverlayPlugin = {
      ...context,
      id: normalized.id ?? options?.defaults?.id ?? context.id,
      name: normalized.name ?? options?.defaults?.name ?? context.name,
      description:
        normalized.description ?? options?.defaults?.description,
      modified: entry.modified,
      enabled: true,
      defaultOpen:
        normalized.defaultOpen ??
        options?.defaults?.defaultOpen ??
        pluginSystemConfig.folderPanelsOpenByDefault,
      keepMounted:
        normalized.keepMounted ??
        options?.defaults?.keepMounted ??
        pluginSystemConfig.folderPanelsKeepMounted,
      component: normalized.component,
      error: null,
      diagnostics,
    };

    const runtimeApi = hostApiFactory(plugin);
    return {
      ...plugin,
      component: (props) =>
        React.createElement(plugin.component!, {
          ...props,
          api: runtimeApi,
          plugin,
        }),
    };
  } catch (error) {
    return {
      ...context,
      modified: entry.modified,
      enabled: true,
      description: undefined,
      defaultOpen: pluginSystemConfig.folderPanelsOpenByDefault,
      keepMounted: pluginSystemConfig.folderPanelsKeepMounted,
      component: null,
      error: String(error),
      diagnostics,
    };
  }
}

export async function loadPluginPreviewLaneFromSource(
  source: string,
  entry: PluginFileEntry,
  options?: {
    resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
    allowedModules?: Record<string, unknown>;
  },
): Promise<React.ComponentType<OverlayPluginPreviewLaneProps>> {
  const transpiledGraph = await transpilePluginGraph(
    entry.path,
    source,
    options?.resolveRelativeModuleSource,
  );
  const exported = executePluginModuleGraph(
    transpiledGraph,
    options?.allowedModules,
  );
  return normalizePreviewLaneExport(exported).component;
}

export async function loadPluginSettingsSlotFromSource(
  source: string,
  entry: PluginFileEntry,
  options?: {
    resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
    allowedModules?: Record<string, unknown>;
  },
): Promise<React.ComponentType<OverlayPluginSettingsSlotProps>> {
  const transpiledGraph = await transpilePluginGraph(
    entry.path,
    source,
    options?.resolveRelativeModuleSource,
  );
  const exported = executePluginModuleGraph(
    transpiledGraph,
    options?.allowedModules,
  );
  return normalizeSettingsSlotExport(exported).component;
}

export async function loadPluginWorkflowFromSource(
  source: string,
  entry: PluginFileEntry,
  options?: {
    resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
    allowedModules?: Record<string, unknown>;
  },
): Promise<OverlayPluginWorkflowDefinition> {
  const transpiledGraph = await transpilePluginGraph(
    entry.path,
    source,
    options?.resolveRelativeModuleSource,
  );
  const exported = executePluginModuleGraph(
    transpiledGraph,
    options?.allowedModules,
  );
  return normalizeWorkflowExport(exported);
}

export async function loadPluginModuleFromSource(
  source: string,
  entry: PluginFileEntry,
  options?: {
    resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
    allowedModules?: Record<string, unknown>;
  },
): Promise<unknown> {
  const transpiledGraph = await transpilePluginGraph(
    entry.path,
    source,
    options?.resolveRelativeModuleSource,
  );
  return executePluginModuleGraph(transpiledGraph, options?.allowedModules);
}

async function transpilePluginGraph(
  entryModulePath: string,
  source: string,
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver,
): Promise<RuntimeModuleGraph> {
  return transpileRuntimeModuleGraph({
    entryModulePath,
    entrySource: source,
    prependCode: `const React = require('react');\n`,
    resolveRelativeModuleSource,
  });
}

function executePluginModuleGraph(
  graph: RuntimeModuleGraph,
  dependencyAllowedModules: Record<string, unknown> = {},
): unknown {
  const allowedModules: Record<string, unknown> = {
    ...dependencyAllowedModules,
    react: React,
    'lucide-react': LucideReact,
    '@tauri-apps/api/core': TauriCore,
    '@tauri-apps/api/event': TauriEvent,
    '@tauri-apps/api/window': TauriWindow,
    '@tauri-apps/plugin-fs': TauriFs,
    '@tauri-apps/plugin-notification': TauriNotification,
    [pluginSystemConfig.runtimeModuleName]: {
      definePlugin,
      definePreviewLane,
      defineSettingsSlot,
      defineWorkflow,
      getPluginPanelOpenRequestEvent,
      readPluginPanelOpenRequest,
      requestPluginPanelOpen,
      ExplorerWorkflowButton,
      ExplorerWorkflowEmptyState,
      ExplorerWorkflowFieldGrid,
      ExplorerWorkflowInput,
      ExplorerWorkflowMetaStrip,
      ExplorerWorkflowResultCard,
      ExplorerWorkflowResultCardHeader,
      ExplorerWorkflowResultList,
      ExplorerWorkflowResultRow,
      ExplorerWorkflowRowActions,
      ExplorerWorkflowSection,
      ExplorerWorkflowStatusNotice,
    },
    'greeblefs-workbenches': WorkbenchAdapters,
  };

  return executeRuntimeModuleGraph(graph, allowedModules);
}

function normalizePluginExport(
  exported: unknown,
  fallbackContext: OverlayPluginContext,
): OverlayPluginDefinition {
  const candidate = unwrapModuleExport(exported);

  if (typeof candidate === 'function') {
    return {
      name: fallbackContext.name,
      component: candidate as React.ComponentType<OverlayPluginProps>,
    };
  }

  if (
    candidate &&
    typeof candidate === 'object' &&
    'component' in candidate
  ) {
    const definition = candidate as OverlayPluginDefinition;
    if (typeof definition.component !== 'function') {
      throw new Error('Plugin export must provide a React component.');
    }
    return definition;
  }

  throw new Error(
    'Plugin must export either a React component or definePlugin({ component }).',
  );
}

function normalizePreviewLaneExport(
  exported: unknown,
): OverlayPluginPreviewLaneDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, [
    'pluginPreviewLane',
    'previewLane',
    'plugin',
  ]);

  if (typeof candidate === 'function') {
    return {
      component:
        candidate as React.ComponentType<OverlayPluginPreviewLaneProps>,
    };
  }

  if (
    candidate &&
    typeof candidate === 'object' &&
    'component' in candidate
  ) {
    const definition = candidate as OverlayPluginPreviewLaneDefinition;
    if (typeof definition.component !== 'function') {
      throw new Error(
        'Preview lane export must provide a React component.',
      );
    }
    return definition;
  }

  throw new Error(
    'Preview lane must export either a React component or definePreviewLane({ component }).',
  );
}

function normalizeSettingsSlotExport(
  exported: unknown,
): OverlayPluginSettingsSlotDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, [
    'pluginSettings',
    'settingsSlot',
    'plugin',
  ]);

  if (typeof candidate === 'function') {
    return {
      component:
        candidate as React.ComponentType<OverlayPluginSettingsSlotProps>,
    };
  }

  if (
    candidate &&
    typeof candidate === 'object' &&
    'component' in candidate
  ) {
    const definition = candidate as OverlayPluginSettingsSlotDefinition;
    if (typeof definition.component !== 'function') {
      throw new Error(
        'Settings slot export must provide a React component.',
      );
    }
    return definition;
  }

  throw new Error(
    'Settings slot must export either a React component or defineSettingsSlot({ component }).',
  );
}

function normalizeWorkflowExport(
  exported: unknown,
): OverlayPluginWorkflowDefinition {
  const candidate = unwrapRuntimeModuleExport(exported, [
    'pluginWorkflow',
    'workflow',
    'plugin',
  ]);

  if (typeof candidate === 'function') {
    return {
      component:
        candidate as React.ComponentType<OverlayPluginWorkflowProps>,
    };
  }

  if (
    candidate &&
    typeof candidate === 'object' &&
    'component' in candidate
  ) {
    const definition = candidate as OverlayPluginWorkflowDefinition;
    if (typeof definition.component !== 'function') {
      throw new Error(
        'Workflow export must provide a React component.',
      );
    }
    return definition;
  }

  throw new Error(
    'Workflow must export either a React component or defineWorkflow({ component }).',
  );
}

function unwrapModuleExport(exported: unknown): unknown {
  return unwrapRuntimeModuleExport(exported, ['plugin']);
}

export function createPluginPreviewRuntimeBridge(
  runtimeId: string | null,
  getExecutionContext?: (() => ExecutionContextSnapshot | null) | null,
): OverlayPluginPreviewRuntimeBridge {
  return {
    runtimeId,
    getRuntimePackage: () =>
      runtimeId ? getRuntimePackage(runtimeId) : Promise.resolve(null),
    listRuntimePackages,
    prepareRuntimePackage,
    callRuntimeAction: (request) =>
      callRuntimeAction({
        ...request,
        executionContext:
          request.executionContext ??
          getExecutionContext?.() ??
          null,
      }),
    runRuntimeCommand,
    openRuntimeTui,
  };
}
