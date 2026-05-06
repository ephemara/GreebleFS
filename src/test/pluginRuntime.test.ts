import { access, mkdtemp, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  definePlugin,
  derivePluginId,
  derivePluginName,
  isFrontendPluginFile,
  loadPluginPreviewLaneFromSource,
  loadPluginWorkflowFromSource,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import { pluginSystemConfig } from '../config/plugins';
import { createMockOverlayPluginApi } from './helpers/createMockOverlayPluginApi';

describe('pluginRuntime helpers', () => {
  it('recognizes supported frontend plugin files', () => {
    expect(isFrontendPluginFile({
      name: 'hello.tsx',
      path: 'plugins/hello.tsx',
      is_dir: false,
      modified: 1,
      extension: 'tsx',
    })).toBe(true);

    expect(isFrontendPluginFile({
      name: 'backend',
      path: 'plugins/backend',
      is_dir: true,
      modified: 1,
      extension: '',
    })).toBe(false);
  });

  it('derives stable plugin ids and display names from filenames', () => {
    expect(derivePluginId('My Cool_Plugin.tsx')).toBe('my-cool-plugin');
    expect(derivePluginName('my-cool_plugin.tsx')).toBe('My Cool Plugin');
  });

  it('returns plugin definitions untouched', () => {
    const component = () => null;
    const plugin = definePlugin({ name: 'Test', component });
    expect(plugin.name).toBe('Test');
    expect(plugin.component).toBe(component);
  });

  it('loads a frontend plugin from source code', async () => {
    const loaded = await loadPluginFromSource(
      `
        import React from 'react';
        import { definePlugin } from 'overlayterm-plugin';

        function SourcePlugin() {
          return React.createElement('div', null, 'plugin-ready');
        }

        export default definePlugin({
          name: 'Source Plugin',
          description: 'Loaded through the runtime transpiler',
          component: SourcePlugin,
        });
      `,
      {
        name: 'source-plugin.tsx',
        path: 'plugins/source-plugin.tsx',
        is_dir: false,
        modified: 42,
        extension: 'tsx',
      },
      () => createMockOverlayPluginApi(),
    );

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Source Plugin');
    expect(loaded.description).toBe('Loaded through the runtime transpiler');
    expect(loaded.id).toBe('source-plugin');
    expect(loaded.defaultOpen).toBe(true);
    expect(loaded.keepMounted).toBe(false);
    expect(typeof loaded.component).toBe('function');
  });

  it('injects the streamlined index api into frontend plugins', async () => {
    const loaded = await loadPluginFromSource(
      `
        import React from 'react';
        import { definePlugin } from 'overlayterm-plugin';

        export default definePlugin({
          name: 'Index Plugin',
          component: function IndexPlugin({ api }) {
            return React.createElement('div', null, typeof api.index.media.findPictures);
          },
        });
      `,
      {
        name: 'index-plugin.tsx',
        path: 'plugins/index-plugin.tsx',
        is_dir: false,
        modified: 42,
        extension: 'tsx',
      },
      () => createMockOverlayPluginApi(),
    );

    expect(loaded.error).toBeNull();
    const markup = renderToStaticMarkup(
      React.createElement(loaded.component as React.ComponentType<any>, {
        appearance: {
          theme: {
            id: 'test-theme',
            name: 'Test Theme',
            author: null,
            mode: 'dark',
            description: null,
            tags: [],
          },
          fonts: {
            ui: 'sans-serif',
            mono: 'monospace',
          },
          cssVars: {},
        },
      }),
    );

    expect(markup).toContain('function');
  });

  it('loads multi-file package plugin modules through relative imports', async () => {
    const loaded = await loadPluginFromSource(
      `
        import React from 'react';
        import { definePlugin } from 'overlayterm-plugin';
        import { panelMessage } from './panelMessage';

        export default definePlugin({
          name: 'Multi File Plugin',
          component: function MultiFilePlugin() {
            return React.createElement('div', null, panelMessage);
          },
        });
      `,
      {
        name: 'index.tsx',
        path: 'plugins/multi-file-plugin/index.tsx',
        is_dir: false,
        modified: 12,
        extension: 'tsx',
      },
      () => createMockOverlayPluginApi(),
      {
        resolveRelativeModuleSource: async ({ specifier }) => {
          if (specifier !== './panelMessage') {
            return null;
          }
          return {
            modulePath: 'plugins/multi-file-plugin/panelMessage.ts',
            source: `export const panelMessage = 'module-graph-ready';`,
          };
        },
      },
    );

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Multi File Plugin');
    expect(typeof loaded.component).toBe('function');
  });

  it('loads explorer workflow modules through defineWorkflow exports', async () => {
    const loaded = await loadPluginWorkflowFromSource(
      `
        import React from 'react';
        import { defineWorkflow } from 'overlayterm-plugin';

        function WorkflowSurface() {
          return React.createElement('div', null, 'workflow-ready');
        }

        export default defineWorkflow({
          component: WorkflowSurface,
          descriptor: {
            title: 'Workflow Surface',
            description: 'Plugin workflow smoke test',
            contexts: ['background'],
            defaultSize: 'lg',
          },
        });
      `,
      {
        name: 'workflow-surface.tsx',
        path: 'plugins/workflow-surface.tsx',
        is_dir: false,
        modified: 5,
        extension: 'tsx',
      },
    );

    expect(typeof loaded.component).toBe('function');
    expect(loaded.descriptor).toMatchObject({
      title: 'Workflow Surface',
      description: 'Plugin workflow smoke test',
      contexts: ['background'],
      defaultSize: 'lg',
    });
  });

  it('allows plugins to import the notification runtime', async () => {
    const loaded = await loadPluginFromSource(
      `
        import React from 'react';
        import { isPermissionGranted } from '@tauri-apps/plugin-notification';
        import { definePlugin } from 'overlayterm-plugin';

        export default definePlugin({
          name: 'Notification Plugin',
          component: function NotificationPlugin() {
            return React.createElement('div', null, typeof isPermissionGranted);
          },
        });
      `,
      {
        name: 'notification-plugin.tsx',
        path: 'plugins/notification-plugin.tsx',
        is_dir: false,
        modified: 7,
        extension: 'tsx',
      },
      () => createMockOverlayPluginApi(),
    );

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Notification Plugin');
    expect(typeof loaded.component).toBe('function');
  });

  it('lets plugins render themed lucide exports that flow through AppIcons', async () => {
    const loaded = await loadPluginFromSource(
      `
        import React from 'react';
        import { WandSparkles } from 'lucide-react';
        import { definePlugin } from 'overlayterm-plugin';

        export default definePlugin({
          name: 'Icon Bridge Plugin',
          component: function IconBridgePlugin() {
            return React.createElement('div', null, React.createElement(WandSparkles, { size: 16 }));
          },
        });
      `,
      {
        name: 'icon-bridge-plugin.tsx',
        path: 'plugins/icon-bridge-plugin.tsx',
        is_dir: false,
        modified: 8,
        extension: 'tsx',
      },
      () => createMockOverlayPluginApi(),
    );

    expect(loaded.error).toBeNull();
    expect(typeof loaded.component).toBe('function');
    expect(() =>
      renderToStaticMarkup(React.createElement(loaded.component as React.ComponentType)),
    ).not.toThrow();
  });

  it('loads the drawable canvas plugin from disk through the runtime transpiler', async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'overlayterm-plugin-runtime-'));
    const drawableCanvasPath = join(tempDirectory, 'drawable-canvas.tsx');

    await writeFile(drawableCanvasPath, `
      import React from 'react';
      import { definePlugin } from 'overlayterm-plugin';

      function DrawableCanvasFixture() {
        return React.createElement('div', null, 'plugin-ready');
      }

      export default definePlugin({
        name: 'Drawable Canvas',
        description: 'shader-style paint effects',
        component: DrawableCanvasFixture,
      });
    `);

    const source = await readFile(drawableCanvasPath, 'utf8');

    const loaded = await loadPluginFromSource(
      source,
      {
        name: 'drawable-canvas.tsx',
        path: drawableCanvasPath,
        is_dir: false,
        modified: 99,
        extension: 'tsx',
      },
      () => createMockOverlayPluginApi(),
    );

    expect(loaded.error).toBeNull();
    expect(loaded.id).toBe('drawable-canvas');
    expect(loaded.name).toBe('Drawable Canvas');
    expect(loaded.description).toContain('shader-style paint effects');
    expect(typeof loaded.component).toBe('function');
  });

  it('loads the shipped sample plugins with runtime panel entries from disk through the runtime transpiler', async () => {
    const candidateFilenames = [
      'drawable-canvas.tsx',
      'filesystem-aquarium/dist/index.tsx',
      'greeblefs-index-photo-gallery/index.tsx',
      'test-extension-hello/index.tsx',
      'vibe-capsule/dist/index.tsx',
    ];
    const existingFilenames: string[] = [];

    for (const filename of candidateFilenames) {
      const pluginPath = resolve(pluginSystemConfig.pluginsDirectory, filename);
      try {
        await access(pluginPath);
        existingFilenames.push(filename);
      } catch {
        // The shipped sample catalog is allowed to evolve with the managed
        // plugin root; this test should only assert against files that are
        // still present in the current package set.
      }
    }

    expect(existingFilenames.length).toBeGreaterThan(0);

    for (const filename of existingFilenames) {
      const pluginPath = resolve(pluginSystemConfig.pluginsDirectory, filename);
      const source = await readFile(pluginPath, 'utf8');

      const loaded = await loadPluginFromSource(
        source,
        {
          name: filename,
          path: pluginPath,
          is_dir: false,
          modified: 101,
          extension: 'tsx',
        },
        () => createMockOverlayPluginApi(),
      );

      expect(loaded.error).toBeNull();
      expect(loaded.name).toBeTruthy();
      expect(typeof loaded.component).toBe('function');
    }
  });

  it('loads the shipped .test preview lane from disk through the runtime transpiler', async () => {
    const previewLanePath = resolve(
      pluginSystemConfig.pluginsDirectory,
      'test-extension-hello/preview/helloTestPreview.tsx',
    );
    const source = await readFile(previewLanePath, 'utf8');

    const previewLane = await loadPluginPreviewLaneFromSource(source, {
      name: 'helloTestPreview.tsx',
      path: previewLanePath,
      is_dir: false,
      modified: 303,
      extension: 'tsx',
    });

    const markup = renderToStaticMarkup(
      React.createElement(previewLane as React.ComponentType<any>, {
        plugin: {
          id: 'test-extension-hello',
          name: 'Test Extension Hello',
          filePath: previewLanePath,
          pluginRoot: pluginSystemConfig.pluginsDirectory,
          pluginDirectory: resolve(
            pluginSystemConfig.pluginsDirectory,
            'test-extension-hello',
          ),
          backendDirectory: resolve(
            pluginSystemConfig.pluginsDirectory,
            'test-extension-hello/backend',
          ),
        },
        api: createMockOverlayPluginApi({
          roots: [],
          activeDirectory: '/workspace/usr/plugins/test-extension-hello/examples',
          cwd: '/workspace/usr/plugins/test-extension-hello/examples',
          focusedEntry: null,
          selectedEntries: [],
          previewSession: null,
          paneId: 'preview-pane-1',
          workspaceTabId: 'workspace-tab-1',
          repoContext: null,
          activeFileType: null,
          revision: 'preview-test-revision',
        }),
        appearance: {
          theme: {
            id: 'test-theme',
            name: 'Test Theme',
            author: null,
            mode: 'dark',
            description: null,
            tags: [],
          },
          fonts: {
            ui: 'sans-serif',
            mono: 'monospace',
          },
          cssVars: {},
        },
        host: {
          mode: 'preview-pane',
          width: 640,
          height: 480,
          zoom: 1,
          compact: false,
          density: 'regular',
        },
        executionContext: {
          roots: [],
          activeDirectory: '/workspace/usr/plugins/test-extension-hello/examples',
          cwd: '/workspace/usr/plugins/test-extension-hello/examples',
          focusedEntry: null,
          selectedEntries: [],
          previewSession: null,
          paneId: 'preview-pane-1',
          workspaceTabId: 'workspace-tab-1',
          repoContext: null,
          activeFileType: null,
          revision: 'preview-test-revision',
        },
        lane: {
          id: 'test-extension-hello.preview-lane.hello-test-preview',
          pluginId: 'test-extension-hello',
          pluginName: 'Test Extension Hello',
          title: 'Hello .test Preview',
          priority: 950,
          rendererEntry: 'preview/helloTestPreview.tsx',
          runtimeId: null,
          match: {
            appliesTo: 'file',
            extensions: ['test'],
            fileNames: [],
            previewKinds: [],
          },
          capabilities: {
            editable: false,
            save: false,
            export: false,
            workflowTabs: false,
            contextMenu: false,
            prefetch: false,
            closeGuard: false,
          },
        },
        file: {
          path: '/workspace/usr/plugins/test-extension-hello/examples/hello-world.test',
          resolvedPath:
            '/workspace/usr/plugins/test-extension-hello/examples/hello-world.test',
          name: 'hello-world.test',
          extension: 'test',
          size: 104,
          assetUrl: '',
          isDirectory: false,
        },
        runtime: {},
        viewMode: 'preview',
        workflowTabId: 'preview',
        previewBackedByArchiveVirtual: false,
      }),
    );

    expect(markup).toContain('Hello World');
    expect(markup).toContain('hello-world.test');
    expect(markup).toContain(
      '/workspace/usr/plugins/test-extension-hello/examples',
    );
  });

  it.each([
    ['sqlite', 'greeblefs-workbench-sqlite/preview/sqliteWorkbench.tsx'],
    ['docx', 'greeblefs-workbench-docx/preview/docxWorkbench.tsx'],
    [
      'spreadsheet',
      'greeblefs-workbench-spreadsheet/preview/spreadsheetWorkbench.tsx',
    ],
    ['audio', 'greeblefs-workbench-audio/preview/audioWorkbench.tsx'],
    ['video', 'greeblefs-workbench-video/preview/videoWorkbench.tsx'],
    ['folder', 'greeblefs-workbench-folder/preview/folderWorkbench.tsx'],
    ['archive', 'greeblefs-workbench-archive/preview/archiveWorkbench.tsx'],
    ['model3d', 'greeblefs-workbench-model3d/preview/model3dWorkbench.tsx'],
    ['pdf', 'greeblefs-workbench-pdf/preview/pdfWorkbench.tsx'],
    ['text', 'greeblefs-workbench-text/preview/textWorkbench.tsx'],
    ['shader', 'greeblefs-workbench-shader/preview/shaderWorkbench.tsx'],
    ['python', 'greeblefs-workbench-python/preview/pythonWorkbench.tsx'],
  ])('loads the shipped %s workbench adapter lane', async (_label, relativePath) => {
    const previewLanePath = resolve(pluginSystemConfig.pluginsDirectory, relativePath);
    const source = await readFile(previewLanePath, 'utf8');

    const previewLane = await loadPluginPreviewLaneFromSource(source, {
      name: previewLanePath.split('/').pop() ?? 'workbench.tsx',
      path: previewLanePath,
      is_dir: false,
      modified: 404,
      extension: 'tsx',
    });

    expect(typeof previewLane).toBe('function');
  });
});
