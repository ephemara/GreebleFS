import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { discoverOverlayPlugins } from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';
import { createMockOverlayPluginApi } from './helpers/createMockOverlayPluginApi';

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

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

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
          category: 'First-party Workbenches',
          tags: ['workbench', 'preview', 'markdown'],
          testFiles: [
            {
              id: 'notes-fixture',
              label: 'Notes Fixture',
              path: 'examples/readme.md',
              description: 'A markdown preview sample.',
            },
          ],
          contributions: {
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
                id: 'download-models-here',
                title: 'Download Models Here',
                contexts: ['background'],
                appliesTo: 'directory',
                panelRequest: {
                  panelId: 'sketchfab',
                  payload: {
                    destinationPath: '{path}',
                  },
                },
              },
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
            previewLanes: [
              {
                id: 'notes-preview',
                title: 'Notes Preview',
                renderer: 'preview/notes-preview.js',
                runtimeId: 'notes-runtime',
                priority: 820,
                match: {
                  appliesTo: 'file',
                  extensions: ['md'],
                  fileNames: ['readme.md'],
                },
                capabilities: {
                  editable: true,
                  workflowTabs: true,
                  contextMenu: true,
                },
              },
            ],
            settingsSlots: [
              {
                id: 'notes-settings',
                title: 'Notes Settings',
                description: 'Tune the markdown preview lane.',
                iconName: 'SlidersHorizontal',
                keywords: ['notes', 'preview'],
                order: 25,
                renderer: 'settings/notes-settings.js',
                defaults: {
                  autoWrap: true,
                  density: 'cozy',
                },
                fields: [
                  {
                    id: 'autoWrap',
                    label: 'Auto Wrap',
                    kind: 'boolean',
                    defaultValue: true,
                  },
                  {
                    id: 'density',
                    label: 'Density',
                    kind: 'select',
                    defaultValue: 'compact',
                    options: ['cozy', 'compact'],
                  },
                  {
                    id: 'tabSize',
                    label: 'Tab Size',
                    kind: 'number',
                    defaultValue: 2,
                    min: 1,
                    max: 8,
                  },
                ],
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
          {
            name: 'panel-message.js',
            path: 'plugins/mega-plugin/dist/panel-message.js',
            is_dir: false,
            extension: 'js',
            modified: 43,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/preview') {
        return [
          {
            name: 'notes-preview.js',
            path: 'plugins/mega-plugin/preview/notes-preview.js',
            is_dir: false,
            extension: 'js',
            modified: 44,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'plugins/mega-plugin/settings') {
        return [
          {
            name: 'notes-settings.js',
            path: 'plugins/mega-plugin/settings/notes-settings.js',
            is_dir: false,
            extension: 'js',
            modified: 45,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/dist/index.js') {
        return `
          import React from 'react';
          import { definePlugin } from 'overlayterm-plugin';
          import { panelMessage } from './panel-message';

          export default definePlugin({
            component: function MegaPluginPanel() {
              return React.createElement('div', null, panelMessage);
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/dist/panel-message.js') {
        return `export const panelMessage = 'mega';`;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/preview/notes-preview.js') {
        return `
          import React from 'react';
          import { definePreviewLane } from 'overlayterm-plugin';

          export default definePreviewLane({
            component: function NotesPreviewLane({ file }) {
              return React.createElement('div', null, file.name);
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'plugins/mega-plugin/settings/notes-settings.js') {
        return `
          import React from 'react';
          import { defineSettingsSlot } from 'overlayterm-plugin';

          export default defineSettingsSlot({
            component: function NotesSettingsSlot() {
              return React.createElement('div', null, 'notes settings');
            },
          });
        `;
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

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.warnings).toEqual([]);
    expect(result.plugins.map(plugin => plugin.name)).toEqual(['Hello Panel', 'Mega Plugin']);
    expect(result.plugins[0]?.diagnostics.sourceKind).toBe('file-plugin');
    expect(result.plugins[1]?.diagnostics.sourceKind).toBe('package-plugin');
    expect(result.plugins[1]?.diagnostics.manifestPath?.replace(/\\/g, '/')).toBe('plugins/mega-plugin/plugin.json');
    expect(result.plugins[1]?.diagnostics.category).toBe('First-party Workbenches');
    expect(result.plugins[1]?.diagnostics.tags).toEqual(['workbench', 'preview', 'markdown']);
    expect(result.plugins[1]?.diagnostics.testFiles.map(testFile => ({
      ...testFile,
      path: testFile.path.replace(/\\/g, '/'),
    }))).toEqual([
      {
        id: 'notes-fixture',
        label: 'Notes Fixture',
        path: 'plugins/mega-plugin/examples/readme.md',
        description: 'A markdown preview sample.',
        extension: 'md',
      },
    ]);
    expect(result.plugins[1]?.diagnostics.capabilities.themes).toBe(0);
    expect(result.plugins[1]?.diagnostics.capabilities.shaders).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.commands).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.contextMenuItems).toBe(3);
    expect(result.plugins[1]?.diagnostics.capabilities.previewLanes).toBe(1);
    expect(result.plugins[1]?.diagnostics.capabilities.settingsSlots).toBe(1);
    expect(result.themePackages).toHaveLength(0);
    expect(result.shaders).toHaveLength(1);
    expect(result.shaders[0]?.name).toBe('Plugin Halo');
    expect(result.fonts).toHaveLength(1);
    expect(result.fonts[0]?.sourceUrl?.replace(/\\/g, '/')).toContain('plugins/mega-plugin/fonts/mega-ui.ttf');
    expect(result.commands.map(command => command.name)).toEqual(['Build Project']);
    expect(result.explorerActions.map(action => action.label)).toEqual(['Echo Path']);
    expect(result.contextMenuItems.map(item => item.title)).toEqual([
      'Download Models Here',
      'Run Compiled Indexer',
      'Send To Aquarium',
    ]);
    expect(result.contextMenuItems[0]?.execution).toEqual({
      kind: 'panel-request',
      panelId: 'sketchfab',
      payload: {
        destinationPath: '{path}',
      },
    });
    expect(result.contextMenuItems[1]?.execution).toEqual({
      kind: 'plugin-backend',
      entry: 'backend/indexer',
      args: ['--path', '{path}'],
    });
    expect(result.contextMenuItems[2]?.execution).toEqual({
      kind: 'terminal-template',
      command: 'aquarium {path}',
      runOnSelect: true,
    });
    expect(result.previewLanes).toHaveLength(1);
    expect(result.previewLanes[0]).toMatchObject({
      id: 'mega-plugin.preview-lane.notes-preview',
      pluginId: 'mega-plugin',
      pluginName: 'Mega Plugin',
      title: 'Notes Preview',
      runtimeId: 'notes-runtime',
      priority: 820,
      rendererEntry: 'preview/notes-preview.js',
      match: {
        appliesTo: 'file',
        extensions: ['md'],
        fileNames: ['readme.md'],
      },
      capabilities: {
        editable: true,
        save: false,
        export: false,
        workflowTabs: true,
        contextMenu: true,
        prefetch: false,
        closeGuard: false,
      },
    });
    expect(typeof result.previewLanes[0]?.component).toBe('function');
    expect(result.settingsSlots).toHaveLength(1);
    expect(result.settingsSlots[0]).toMatchObject({
      id: 'mega-plugin.settings-slot.notes-settings',
      pluginId: 'mega-plugin',
      pluginName: 'Mega Plugin',
      title: 'Notes Settings',
      description: 'Tune the markdown preview lane.',
      iconName: 'SlidersHorizontal',
      keywords: ['notes', 'preview'],
      order: 25,
      rendererEntry: 'settings/notes-settings.js',
      defaults: {
        autoWrap: true,
        density: 'cozy',
      },
    });
    expect(result.settingsSlots[0]?.fields).toEqual([
      expect.objectContaining({
        id: 'autoWrap',
        kind: 'boolean',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'density',
        kind: 'select',
        defaultValue: 'compact',
        options: [
          { value: 'cozy', label: 'cozy' },
          { value: 'compact', label: 'compact' },
        ],
      }),
      expect.objectContaining({
        id: 'tabSize',
        kind: 'number',
        defaultValue: 2,
        min: 1,
        max: 8,
      }),
    ]);
    expect(typeof result.settingsSlots[0]?.component).toBe('function');
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

    const result = await discoverOverlayPlugins(() => createMockOverlayPluginApi());

    expect(result.plugins).toHaveLength(0);
    expect(result.themePackages).toHaveLength(0);
    expect(result.fonts).toHaveLength(0);
    expect(result.warnings).toEqual([
      'Unsafe Plugin: font Broken Font: invalid relative path',
    ]);
  });
});
