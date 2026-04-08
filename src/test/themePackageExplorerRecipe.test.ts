import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadThemePackagesFromDirectoryEntries } from '../config/themePackages';

describe('theme package explorer recipe loading', () => {
  it('preserves explorer recipes from theme package manifests', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/xmb-shell/theme.json') {
        return JSON.stringify({
          id: 'xmb-shell',
          name: 'XMB Shell',
          extends: 'catppuccin',
          theme: {
            explorer: {
              preset: 'xmb',
              railBrandLabel: 'Cross Media',
              toolbarStyle: 'floating',
              previewStyle: 'glass',
              statusBarStyle: 'floating',
              metrics: {
                railWidth: 240,
                previewWidth: 480,
              },
              cssVars: {
                '--overlay-explorer-brand': 'cross-media',
              },
            },
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      {
        name: 'xmb-shell',
        path: 'themes/xmb-shell',
      },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.theme.explorer?.preset).toBe('xmb');
    expect(result.packages[0]?.theme.explorer?.railBrandLabel).toBe('Cross Media');
    expect(result.packages[0]?.theme.explorer?.toolbarStyle).toBe('floating');
    expect(result.packages[0]?.theme.explorer?.previewStyle).toBe('glass');
    expect(result.packages[0]?.theme.explorer?.metrics?.railWidth).toBe(240);
    expect(result.packages[0]?.theme.explorer?.cssVars?.['--overlay-explorer-brand']).toBe('cross-media');
  });
});
