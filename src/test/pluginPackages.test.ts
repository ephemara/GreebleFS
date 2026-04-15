import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverOverlayPlugins } from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';

describe('plugin package discovery', () => {
  it('keeps loading legacy plugins when one file fails to parse', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'broken-panel.tsx',
            path: 'plugins/broken-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 1,
          },
          {
            name: 'hello-panel.tsx',
            path: 'plugins/hello-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 2,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/broken-panel.tsx') {
        throw new Error('legacy parse failed');
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/hello-panel.tsx') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';

          export default definePlugin({
            name: 'Hello Panel',
            component: function HelloPanel() {
              return React.createElement('div', null, 'hello');
            },
          });
        `;
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => ({
      invoke: async <T,>() => null as T,
      event: {} as never,
      window: {} as never,
      fs: {} as never,
      notification: {} as never,
      refreshPlugins: async () => undefined,
      openPluginsFolder: async () => undefined,
      runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
    }));

    expect(result.plugins.map(plugin => plugin.name)).toEqual(['Hello Panel']);
    expect(result.warnings).toEqual([
      'broken-panel.tsx: Error: legacy parse failed',
    ]);
  });

  it('loads legacy plugins and manifest-based packages with contributions', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'hello-panel.tsx',
            path: 'plugins/hello-panel.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 10,
          },
          {
            name: 'mega-plugin',
            path: 'plugins/mega-plugin',
            is_dir: true,
            extension: '',
            modified: 20,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/hello-panel.tsx') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';

          export default definePlugin({
            name: 'Hello Panel',
            component: function HelloPanel() {
              return React.createElement('div', null, 'hello');
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/plugin.json') {
        return JSON.stringify({
          id: 'mega-plugin',
          name: 'Mega Plugin',
          entry: 'dist/index.js',
          contributions: {
            themes: ['themes/cobalt'],
            shaders: ['shaders/halo.tsx'],
            fonts: [
              {
                id: 'mega-ui',
                name: 'Mega UI',
                family: '"Mega UI", sans-serif',
                faceName: 'Mega UI',
                src: 'fonts/mega-ui.ttf',
              },
            ],
            commands: [
              {
                id: 'build-project',
                name: 'Build Project',
                command: 'npm run build',
              },
            ],
            explorerActions: [
              {
                id: 'echo-path',
                label: 'Echo Path',
                command: 'echo {path}',
                appliesTo: 'file',
              },
            ],
            contextMenuItems: [
              {
                id: 'send-to-aquarium',
                title: 'Send To Aquarium',
                contexts: ['entry', 'background'],
                appliesTo: 'directory',
                group: 'plugin',
                order: 640,
                command: 'aquarium {path}',
              },
              {
                id: 'compiled-index',
                title: 'Run Compiled Indexer',
                contexts: ['entry'],
                appliesTo: 'any',
                backend: {
                  entry: 'backend/indexer',
                  args: ['--path', '{path}'],
                },
              },
            ],
          },
        });
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/dist') {
        return [
          {
            name: 'index.js',
            path: 'plugins/mega-plugin/dist/index.js',
            is_dir: false,
            extension: 'js',
            modified: 42,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/dist/index.js') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';

          export default definePlugin({
            component: function MegaPluginPanel() {
              return React.createElement('div', null, 'mega');
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/themes/cobalt/theme.json') {
        return JSON.stringify({
          id: 'cobalt-plugin-theme',
          name: 'Cobalt Plugin Theme',
          extends: 'operator',
          theme: {
            palette: {
              accent: '#44c2ff',
            },
          },
        });
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/shaders') {
        return [
          {
            name: 'halo.tsx',
            path: 'plugins/mega-plugin/shaders/halo.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 99,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/shaders/halo.tsx') {
        return `
          import React from 'react';
          import { defineShader } from 'overlayterm-shader';

          export default defineShader({
            name: 'Plugin Halo',
            background: {
              render: function Halo() {
                return React.createElement('div', null, 'halo');
              },
            },
          });
        `;
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => ({
      invoke: async <T,>() => null as T,
      event: {} as never,
      window: {} as never,
      fs: {} as never,
      notification: {} as never,
      refreshPlugins: async () => undefined,
      openPluginsFolder: async () => undefined,
      runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
    }));

    expect(result.warnings).toEqual([]);
    expect(result.plugins.map(plugin => plugin.name)).toEqual(['Hello Panel', 'Mega Plugin']);
    expect(result.plugins[0]?.diagnostics.sourceKind).toBe('file-plugin');
    expect(result.plugins[1]?.diagnostics.sourceKind).toBe('package-plugin');
    expect(result.plugins[1]?.diagnostics.manifestPath?.replace(/\\/g, '/')).toBe('plugins/mega-plugin/plugin.json');
    expect(result.plugins[1]?.diagnostics.capabilities.themes).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.shaders).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.commands).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.contextMenuItems).toBe(2);
    expect(result.themePackages).toHaveLength(1);
    expect(result.themePackages[0]?.theme.id).toBe('cobalt-plugin-theme');
    expect(result.themePackages[0]?.sourceKind).toBe('plugin-package');
    expect(result.themePackages[0]?.sourceLabel).toBe('Mega Plugin');
    expect(result.shaders).toHaveLength(1);
    expect(result.shaders[0]?.name).toBe('Plugin Halo');
    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.sourceUrl?.replace(/\\/g, '/')).toContain('plugins/mega-plugin/fonts/mega-ui.ttf');
    expect(result.commands.map(command => command.name)).toEqual(['Build Project']);
    expect(result.explorerActions.map(action => action.label)).toEqual(['Echo Path']);
    expect(result.contextMenuItems.map(item => item.title)).toEqual([
      'Run Compiled Indexer',
      'Send To Aquarium',
    ]);
    expect(result.contextMenuItems[0]?.execution).toEqual({
      kind: 'plugin-backend',
      entry: 'backend/indexer',
      args: ['--path', '{path}'],
    });
    expect(result.contextMenuItems[1]?.execution).toEqual({
      kind: 'terminal-template',
      command: 'aquarium {path}',
      runOnSelect: true,
    });
  });

  it('rejects unsafe package-relative paths before loading bundled assets', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [
          {
            name: 'unsafe-plugin',
            path: 'plugins/unsafe-plugin',
            is_dir: true,
            extension: '',
            modified: 1,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/unsafe-plugin/plugin.json') {
        return JSON.stringify({
          id: 'unsafe-plugin',
          name: 'Unsafe Plugin',
          entry: '../escape.js',
          contributions: {
            fonts: [
              {
                name: 'Broken Font',
                src: '../../escape.ttf',
              },
            ],
            themes: ['../themes/escape'],
          },
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/unsafe-plugin/escape.js') {
        throw new Error('unsafe entry should not be loaded');
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => ({
      invoke: async <T,>() => null as T,
      event: {} as never,
      window: {} as never,
      fs: {} as never,
      notification: {} as never,
      refreshPlugins: async () => undefined,
      openPluginsFolder: async () => undefined,
      runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
    }));

    expect(result.plugins).toHaveLength(0);
    expect(result.themePackages).toHaveLength(0);
    expect(result.fonts).toHaveLength(0);
    expect(result.warnings).toEqual([
      'Unsafe Plugin: font Broken Font: invalid relative path',
    ]);
  });
});
