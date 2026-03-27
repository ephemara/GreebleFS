import { describe, expect, it } from 'vitest';

import {
  getPluginBackendDirectory,
  getPluginDirectory,
  getPluginStorageDirectory,
  isIgnoredPluginWatchPath,
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
  });

  it('keeps plugin directory helpers aligned across workspace and storage paths', () => {
    expect(getPluginDirectory('chronorift').replace(/\\/g, '/')).toBe('plugins/chronorift');
    expect(getPluginBackendDirectory('chronorift').replace(/\\/g, '/')).toBe('plugins/chronorift/backend');
    expect(getPluginStorageDirectory('chronorift').replace(/\\/g, '/')).toBe('overlayterm/plugins/chronorift');
  });
});
