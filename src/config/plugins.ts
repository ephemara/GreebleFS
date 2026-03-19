import { joinPlatformPath } from './platform';

export function resolvePluginsDirectory(): string {
  const configured = (import.meta.env as {
    VITE_OVERLAYTERM_PLUGINS_DIR?: string;
  }).VITE_OVERLAYTERM_PLUGINS_DIR?.trim();
  return configured && configured.length > 0 ? configured : 'plugins';
}

export const pluginSystemConfig = {
  pluginsDirectory: resolvePluginsDirectory(),
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  backendDirectoryName: 'backend',
  runtimeModuleName: 'overlayterm-plugin',
  folderPanelsOpenByDefault: true,
  folderPanelsKeepMounted: false,
  scanIntervalMs: 2000,
} as const;

export type FrontendPluginExtension =
  typeof pluginSystemConfig.frontendExtensions[number];

export function getPluginDirectory(pluginId: string): string {
  return joinPlatformPath(pluginSystemConfig.pluginsDirectory, pluginId);
}

export function getPluginBackendDirectory(pluginId: string): string {
  return joinPlatformPath(getPluginDirectory(pluginId), pluginSystemConfig.backendDirectoryName);
}

export function getPluginStorageDirectory(pluginId: string): string {
  return joinPlatformPath(joinPlatformPath('overlayterm', 'plugins'), pluginId);
}
