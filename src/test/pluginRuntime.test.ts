import { readFile } from 'fs/promises';
import { describe, expect, it } from 'vitest';
import {
  definePlugin,
  derivePluginId,
  derivePluginName,
  isFrontendPluginFile,
  loadPluginFromSource,
} from '../components/pluginRuntime';

describe('pluginRuntime helpers', () => {
  it('recognizes supported frontend plugin files', () => {
    expect(isFrontendPluginFile({
      name: 'hello.tsx',
      path: 'M:\\OverlayTerm\\plugins\\hello.tsx',
      is_dir: false,
      modified: 1,
      extension: 'tsx',
    })).toBe(true);

    expect(isFrontendPluginFile({
      name: 'backend',
      path: 'M:\\OverlayTerm\\plugins\\backend',
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
        path: 'M:\\\\OverlayTerm\\\\plugins\\\\source-plugin.tsx',
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
    const source = await readFile('M:\\OverlayTerm\\plugins\\drawable-canvas.tsx', 'utf8');

    const loaded = await loadPluginFromSource(
      source,
      {
        name: 'drawable-canvas.tsx',
        path: 'M:\\OverlayTerm\\plugins\\drawable-canvas.tsx',
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
});
