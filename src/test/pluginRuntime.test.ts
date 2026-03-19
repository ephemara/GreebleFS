import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it } from 'vitest';
import {
  definePlugin,
  derivePluginId,
  derivePluginName,
  isFrontendPluginFile,
  loadPluginFromSource,
} from '../components/pluginRuntime';
import { pluginSystemConfig } from '../config/plugins';

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
      () => ({
        invoke: async <T,>() => null as T,
        event: {} as never,
        window: {} as never,
        fs: {} as never,
        refreshPlugins: async () => undefined,
        openPluginsFolder: async () => undefined,
        runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
      }),
    );

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Source Plugin');
    expect(loaded.description).toBe('Loaded through the runtime transpiler');
    expect(loaded.id).toBe('source-plugin');
    expect(loaded.defaultOpen).toBe(true);
    expect(loaded.keepMounted).toBe(false);
    expect(typeof loaded.component).toBe('function');
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
      () => ({
        invoke: async <T,>() => null as T,
        event: {} as never,
        window: {} as never,
        fs: {} as never,
        refreshPlugins: async () => undefined,
        openPluginsFolder: async () => undefined,
        runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
      }),
    );

    expect(loaded.error).toBeNull();
    expect(loaded.id).toBe('drawable-canvas');
    expect(loaded.name).toBe('Drawable Canvas');
    expect(loaded.description).toContain('shader-style paint effects');
    expect(typeof loaded.component).toBe('function');
  });

  it('loads the portable sample plugins from disk through the runtime transpiler', async () => {
    for (const filename of ['drawable-canvas.tsx', 'platform-inspector.tsx', 'quick-notes.tsx', 'theme-gallery.tsx']) {
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
        () => ({
          invoke: async <T,>() => null as T,
          event: {} as never,
          window: {} as never,
          fs: {} as never,
          refreshPlugins: async () => undefined,
          openPluginsFolder: async () => undefined,
          runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
        }),
      );

      expect(loaded.error).toBeNull();
      expect(loaded.name).toBeTruthy();
      expect(typeof loaded.component).toBe('function');
    }
  });
});
