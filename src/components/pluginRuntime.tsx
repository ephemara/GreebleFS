import React from 'react';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as TauriNotification from '@tauri-apps/plugin-notification';
import * as LucideReact from 'lucide-react';
import {
  getPluginBackendDirectory,
  getPluginDirectory,
  pluginSystemConfig,
} from '../config/plugins';
import type { OverlayThemeDefinition } from '../config/appearance';
import {
  deriveRuntimeModuleId,
  deriveRuntimeModuleName,
  executeRuntimeModule,
  isSupportedRuntimeFile,
  transpileRuntimeModuleSource,
  type RuntimeFileEntry,
  unwrapRuntimeModuleExport,
} from '../runtime/moduleRuntime';

export interface PluginFileEntry extends RuntimeFileEntry {}

export interface OverlayPluginContext {
  id: string;
  name: string;
  filePath: string;
  pluginRoot: string;
  pluginDirectory: string;
  backendDirectory: string;
}

export interface OverlayPluginApi {
  invoke: typeof TauriCore.invoke;
  event: typeof TauriEvent;
  window: typeof TauriWindow;
  fs: typeof TauriFs;
  notification: typeof TauriNotification;
  storage?: OverlayPluginStorageApi;
  assets?: OverlayPluginAssetsApi;
  refreshPlugins: () => Promise<void>;
  openPluginsFolder: () => Promise<void>;
  runBackend: (entry: string, args?: string[]) => Promise<PluginBackendResult>;
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

export type OverlayPluginSourceKind = 'file-plugin' | 'package-plugin';

export interface OverlayPluginCapabilitySummary {
  panel: boolean;
  themes: number;
  shaders: number;
  fonts: number;
  commands: number;
  explorerActions: number;
  contextMenuItems: number;
}

export interface OverlayPluginDiagnostics {
  sourceKind: OverlayPluginSourceKind;
  sourceLabel: string;
  manifestPath?: string;
  warnings: string[];
  capabilities: OverlayPluginCapabilitySummary;
}

export interface LoadedOverlayPlugin extends OverlayPluginContext {
  description?: string;
  modified: number;
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
  defaults?: Partial<Pick<OverlayPluginDefinition, 'id' | 'name' | 'description' | 'defaultOpen' | 'keepMounted'>>;
  diagnostics?: Partial<OverlayPluginDiagnostics>;
}

export function definePlugin(definition: OverlayPluginDefinition): OverlayPluginDefinition {
  return definition;
}

export function isFrontendPluginFile(entry: PluginFileEntry): boolean {
  return isSupportedRuntimeFile(entry, pluginSystemConfig.frontendExtensions);
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
    pluginRoot: options?.context?.pluginRoot ?? pluginSystemConfig.pluginsDirectory,
    pluginDirectory: options?.context?.pluginDirectory ?? getPluginDirectory(fileId),
    backendDirectory: options?.context?.backendDirectory ?? getPluginBackendDirectory(fileId),
  };
  const diagnostics: OverlayPluginDiagnostics = {
    sourceKind: options?.diagnostics?.sourceKind ?? 'file-plugin',
    sourceLabel: options?.diagnostics?.sourceLabel ?? context.filePath,
    manifestPath: options?.diagnostics?.manifestPath,
    warnings: options?.diagnostics?.warnings ?? [],
    capabilities: {
      panel: options?.diagnostics?.capabilities?.panel ?? true,
      themes: options?.diagnostics?.capabilities?.themes ?? 0,
      shaders: options?.diagnostics?.capabilities?.shaders ?? 0,
      fonts: options?.diagnostics?.capabilities?.fonts ?? 0,
      commands: options?.diagnostics?.capabilities?.commands ?? 0,
      explorerActions: options?.diagnostics?.capabilities?.explorerActions ?? 0,
      contextMenuItems: options?.diagnostics?.capabilities?.contextMenuItems ?? 0,
    },
  };

  try {
    const transpiled = await transpilePluginSource(source);
    const exported = executePluginModule(transpiled);
    const normalized = normalizePluginExport(exported, context);

    const plugin: LoadedOverlayPlugin = {
      ...context,
      id: normalized.id ?? options?.defaults?.id ?? context.id,
      name: normalized.name ?? options?.defaults?.name ?? context.name,
      description: normalized.description ?? options?.defaults?.description,
      modified: entry.modified,
      defaultOpen: normalized.defaultOpen ?? options?.defaults?.defaultOpen ?? pluginSystemConfig.folderPanelsOpenByDefault,
      keepMounted: normalized.keepMounted ?? options?.defaults?.keepMounted ?? pluginSystemConfig.folderPanelsKeepMounted,
      component: normalized.component,
      error: null,
      diagnostics,
    };

    const runtimeApi = hostApiFactory(plugin);
    return {
      ...plugin,
      component: props => React.createElement(plugin.component!, { ...props, api: runtimeApi, plugin }),
    };
  } catch (error) {
    return {
      ...context,
      modified: entry.modified,
      description: undefined,
      defaultOpen: pluginSystemConfig.folderPanelsOpenByDefault,
      keepMounted: pluginSystemConfig.folderPanelsKeepMounted,
      component: null,
      error: String(error),
      diagnostics,
    };
  }
}

async function transpilePluginSource(source: string): Promise<string> {
  return transpileRuntimeModuleSource(source, `const React = require('react');\n`);
}

function executePluginModule(code: string): unknown {
  const allowedModules: Record<string, unknown> = {
    react: React,
    'lucide-react': LucideReact,
    '@tauri-apps/api/core': TauriCore,
    '@tauri-apps/api/event': TauriEvent,
    '@tauri-apps/api/window': TauriWindow,
    '@tauri-apps/plugin-fs': TauriFs,
    '@tauri-apps/plugin-notification': TauriNotification,
    [pluginSystemConfig.runtimeModuleName]: {
      definePlugin,
    },
  };

  return executeRuntimeModule(code, allowedModules);
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

  if (candidate && typeof candidate === 'object' && 'component' in candidate) {
    const definition = candidate as OverlayPluginDefinition;
    if (typeof definition.component !== 'function') {
      throw new Error('Plugin export must provide a React component.');
    }
    return definition;
  }

  throw new Error('Plugin must export either a React component or definePlugin({ component }).');
}

function unwrapModuleExport(exported: unknown): unknown {
  return unwrapRuntimeModuleExport(exported, ['plugin']);
}
