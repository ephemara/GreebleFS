import { describe, expect, it } from 'vitest';

import {
  loadThemeRendererFromSource,
  overlayThemeRendererApiVersion,
} from '../components/themeRendererRuntime';

describe('themeRendererRuntime', () => {
  it('loads theme renderer modules exported via defineThemeRenderer', async () => {
    const renderer = await loadThemeRendererFromSource(
      `
        import { defineThemeRenderer } from 'overlayterm-theme-renderer';

        export default defineThemeRenderer({
          name: 'Orbital Shell',
          apiVersion: 1,
          supportsLiveSwap: true,
          fallbackRuntime: 'desktop-stack',
          capabilities: {
            wallpaperScene: true,
          },
          component() {
            return <div>orbital</div>;
          },
        });
      `,
      {
        name: 'orbital-shell.tsx',
        path: '/themes/orbital/renderers/orbital-shell.tsx',
        is_dir: false,
        extension: 'tsx',
        modified: 1,
      },
      {
        context: {
          rendererRoot: '/themes/orbital',
          entryModule: 'renderers/orbital-shell.tsx',
        },
      },
    );

    expect(renderer.error).toBeNull();
    expect(renderer.name).toBe('Orbital Shell');
    expect(renderer.apiVersion).toBe(overlayThemeRendererApiVersion);
    expect(renderer.fallbackRuntime).toBe('desktop-stack');
    expect(renderer.capabilities.wallpaperScene).toBe(true);
    expect(renderer.capabilities.surfaceAdapters).toBe(true);
    expect(typeof renderer.component).toBe('function');
  });

  it('captures loader errors and keeps fallback metadata', async () => {
    const renderer = await loadThemeRendererFromSource(
      `
        export default {
          nope: true,
        };
      `,
      {
        name: 'broken-shell.tsx',
        path: '/themes/broken/renderers/broken-shell.tsx',
        is_dir: false,
        extension: 'tsx',
        modified: 1,
      },
      {
        context: {
          rendererRoot: '/themes/broken',
          entryModule: 'renderers/broken-shell.tsx',
        },
        defaults: {
          apiVersion: 1,
          fallbackRuntime: 'workbench-tabs',
          supportsLiveSwap: false,
          capabilities: {
            wallpaperScene: true,
          },
        },
      },
    );

    expect(renderer.component).toBeNull();
    expect(renderer.error).toContain('Theme renderer must export either a React component');
    expect(renderer.fallbackRuntime).toBe('workbench-tabs');
    expect(renderer.capabilities.wallpaperScene).toBe(true);
  });
});
