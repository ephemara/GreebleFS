import { getManagedContentDirectory } from './appContentDirectories';
import { joinPlatformPath } from './platform';

export function resolvePluginsDirectory(): string {
  return getManagedContentDirectory('plugins');
}

export function resolvePluginPackagesDirectory(): string {
  return getManagedContentDirectory('packages');
}

export const pluginSystemConfig = {
  get pluginsDirectory(): string {
    return resolvePluginsDirectory();
  },
  get packagesDirectory(): string {
    return resolvePluginPackagesDirectory();
  },
  frontendExtensions: ['tsx', 'ts', 'jsx', 'js'] as const,
  backendDirectoryName: 'backend',
  runtimeModuleName: 'overlayterm-plugin',
  manifestNames: ['extension.toml', 'plugin.json', 'plugin.toml', 'manifest.json', 'manifest.toml'] as const,
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

export function getPluginPackageDirectory(packageId: string): string {
  return joinPlatformPath(pluginSystemConfig.packagesDirectory, packageId);
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

export function isPluginManagedWatchPath(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
  const managedRoots = [
    pluginSystemConfig.pluginsDirectory,
    pluginSystemConfig.packagesDirectory,
  ].map(root => root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase());

  if (managedRoots.some(root => normalizedPath === root || normalizedPath.startsWith(`${root}/`))) {
    return true;
  }

  const segments = normalizePluginWatchPathSegments(path);
  return segments.includes('plugins') || segments.includes('packages');
}

export function shouldRefreshForPluginWatchPaths(paths: string[]): boolean {
  if (paths.length === 0) {
    return true;
  }

  return paths.some(path => (
    isPluginManagedWatchPath(path) && !isIgnoredPluginWatchPath(path)
  ));
}
