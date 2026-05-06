import { describe, expect, it } from 'vitest';

import {
  getPluginBackendDirectory,
  getPluginDirectory,
  getPluginPackageDirectory,
  getPluginStorageDirectory,
  isIgnoredPluginWatchPath,
  isPluginManagedWatchPath,
  normalizePluginWatchPathSegments,
  shouldRefreshForPluginWatchPaths,
} from '../config/plugins';

describe('plugin watch path helpers', () => {
  it('normalizes mixed-case Windows and POSIX path segments consistently', () => {
    expect(normalizePluginWatchPathSegments('Plugins\\Example Plugin\\Dist\\INDEX.TSX')).toEqual([
      'plugins',
      'example plugin',
      'dist',
      'index.tsx',
    ]);
    expect(normalizePluginWatchPathSegments('/plugins/example-plugin/src/index.tsx')).toEqual([
      'plugins',
      'example-plugin',
      'src',
      'index.tsx',
    ]);
  });

  it('treats configured ignored directories as non-refreshing watch paths', () => {
    expect(isIgnoredPluginWatchPath('plugins/example/node_modules/pkg/index.js')).toBe(true);
    expect(isIgnoredPluginWatchPath('plugins/example/.git/HEAD')).toBe(true);
    expect(isIgnoredPluginWatchPath('plugins/example/coverage/index.html')).toBe(true);
    expect(isIgnoredPluginWatchPath('plugins/example/src/index.tsx')).toBe(false);
  });

  it('treats plugin packages as managed plugin watch paths', () => {
    expect(isPluginManagedWatchPath('packages/greeblefs-ui/src/index.tsx')).toBe(true);
    expect(isPluginManagedWatchPath('usr/packages/greeblefs-ui/src/index.tsx')).toBe(true);
    expect(isPluginManagedWatchPath('themes/operator/theme.json')).toBe(false);
  });

  it('refreshes only when at least one changed path is relevant', () => {
    expect(shouldRefreshForPluginWatchPaths([])).toBe(true);
    expect(shouldRefreshForPluginWatchPaths([
      'plugins/example/node_modules/pkg/index.js',
      'plugins/example/backend/main.rs',
    ])).toBe(false);
    expect(shouldRefreshForPluginWatchPaths([
      'plugins/example/node_modules/pkg/index.js',
      'plugins/example/src/index.tsx',
    ])).toBe(true);
    expect(shouldRefreshForPluginWatchPaths([
      'themes/operator/theme.json',
      'packages/greeblefs-ui/src/index.tsx',
    ])).toBe(true);
  });

  it('keeps plugin directory helpers aligned across workspace and storage paths', () => {
    expect(getPluginDirectory('chronorift').replace(/\\/g, '/')).toBe('usr/plugins/chronorift');
    expect(getPluginPackageDirectory('greeblefs-ui').replace(/\\/g, '/')).toBe('usr/packages/greeblefs-ui');
    expect(getPluginBackendDirectory('chronorift').replace(/\\/g, '/')).toBe('usr/plugins/chronorift/backend');
    expect(getPluginStorageDirectory('chronorift').replace(/\\/g, '/')).toBe('overlayterm/plugins/chronorift');
  });
});
