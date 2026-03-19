import React from 'react';
import * as TauriCore from '@tauri-apps/api/core';
import * as TauriEvent from '@tauri-apps/api/event';
import * as TauriWindow from '@tauri-apps/api/window';
import * as TauriFs from '@tauri-apps/plugin-fs';
import * as LucideReact from 'lucide-react';
import {
  getPluginBackendDirectory,
  getPluginDirectory,
  pluginSystemConfig,
} from '../config/plugins';
import type { OverlayThemeDefinition } from '../config/appearance';

export interface PluginFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified: number;
  extension: string;
}

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
  storage?: OverlayPluginStorageApi;
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

export interface OverlayPluginHostContext {
  mode: 'panel-tab' | 'manager-preview';
  width: number;
  height: number;
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

export interface LoadedOverlayPlugin extends OverlayPluginContext {
  description?: string;
  modified: number;
  defaultOpen: boolean;
  keepMounted: boolean;
  component: React.ComponentType<OverlayPluginProps> | null;
  error: string | null;
}

export interface PluginBackendResult {
  stdout: string;
  stderr: string;
  status: number;
}

export function definePlugin(definition: OverlayPluginDefinition): OverlayPluginDefinition {
  return definition;
}

export function isFrontendPluginFile(entry: PluginFileEntry): boolean {
  return !entry.is_dir
    && pluginSystemConfig.frontendExtensions.includes(
      entry.extension.toLowerCase() as (typeof pluginSystemConfig.frontendExtensions)[number],
    );
}

export function derivePluginId(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'plugin';
}

export function derivePluginName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase()) || 'Plugin';
}

export async function loadPluginFromSource(
  source: string,
  entry: PluginFileEntry,
  hostApiFactory: (context: OverlayPluginContext) => OverlayPluginApi,
): Promise<LoadedOverlayPlugin> {
  const fileId = derivePluginId(entry.name);
  const context: OverlayPluginContext = {
    id: fileId,
    name: derivePluginName(entry.name),
    filePath: entry.path,
    pluginRoot: pluginSystemConfig.pluginsDirectory,
    pluginDirectory: getPluginDirectory(fileId),
    backendDirectory: getPluginBackendDirectory(fileId),
  };

  try {
    const transpiled = await transpilePluginSource(source);
    const exported = executePluginModule(transpiled);
    const normalized = normalizePluginExport(exported, context);

    const plugin: LoadedOverlayPlugin = {
      ...context,
      id: normalized.id ?? context.id,
      name: normalized.name ?? context.name,
      description: normalized.description,
      modified: entry.modified,
      defaultOpen: normalized.defaultOpen ?? pluginSystemConfig.folderPanelsOpenByDefault,
      keepMounted: normalized.keepMounted ?? pluginSystemConfig.folderPanelsKeepMounted,
      component: normalized.component,
      error: null,
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
    };
  }
}

async function transpilePluginSource(source: string): Promise<string> {
  const ts = await import('typescript');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    reportDiagnostics: true,
  });

  const diagnostics = transpiled.diagnostics
    ?.map(diag => typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText)
    .filter(Boolean);

  if (diagnostics && diagnostics.length > 0) {
    throw new Error(diagnostics.join('\n'));
  }

  return `const React = require('react');\n${transpiled.outputText}`;
}

function executePluginModule(code: string): unknown {
  const module = { exports: {} as Record<string, unknown> };

  const allowedModules: Record<string, unknown> = {
    react: React,
    'lucide-react': LucideReact,
    '@tauri-apps/api/core': TauriCore,
    '@tauri-apps/api/event': TauriEvent,
    '@tauri-apps/api/window': TauriWindow,
    '@tauri-apps/plugin-fs': TauriFs,
    [pluginSystemConfig.runtimeModuleName]: {
      definePlugin,
    },
  };

  const require = (specifier: string) => {
    if (!(specifier in allowedModules)) {
      throw new Error(
        `Unsupported import "${specifier}". Allowed imports: ${Object.keys(allowedModules).join(', ')}`,
      );
    }
    return allowedModules[specifier];
  };

  const runner = new Function('module', 'exports', 'require', code);
  runner(module, module.exports, require);
  return module.exports;
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
  if (!exported || typeof exported !== 'object') {
    return exported;
  }

  const record = exported as Record<string, unknown>;
  return record.default ?? record.plugin ?? record;
}
