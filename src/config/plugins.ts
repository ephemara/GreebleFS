import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';

export function resolvePluginsDirectory(): string {
  return getManagedContentDirectory('plugins');
}

export const pluginSystemConfig = {
  get pluginsDirectory(): string {
    return resolvePluginsDirectory();
  },
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  backendDirectoryName: 'backend',
  runtimeModuleName: 'overlayterm-plugin',
  manifestNames: ['plugin.json', 'plugin.toml', 'manifest.json', 'manifest.toml'] as const,
  packageEntryCandidates: ['dist/index.js', 'index.tsx', 'index.ts', 'index.jsx', 'index.js'] as const,
  packageThemesDirectoryName: 'themes',
  packageShadersDirectoryName: 'shaders',
  watchEventName: 'overlay://plugins-changed',
  watchDebounceMs: 400,
  fallbackScanIntervalMs: 20000,
  fallbackScanMaxIntervalMs: 120000,
  ignoredWatchDirectoryNames: ['node_modules', '.git', '.turbo', 'coverage', 'target', 'backend'] as const,
  folderPanelsOpenByDefault: true,
  folderPanelsKeepMounted: false,
};

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

export function normalizePluginWatchPathSegments(path: string): string[] {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.trim().toLowerCase())
    .filter(Boolean);
}

export function isIgnoredPluginWatchPath(path: string): boolean {
  const segments = normalizePluginWatchPathSegments(path);
  return pluginSystemConfig.ignoredWatchDirectoryNames.some(directoryName => (
    segments.includes(directoryName.toLowerCase())
  ));
}

export function shouldRefreshForPluginWatchPaths(paths: string[]): boolean {
  if (paths.length === 0) {
    return true;
  }

  return paths.some(path => !isIgnoredPluginWatchPath(path));
}
