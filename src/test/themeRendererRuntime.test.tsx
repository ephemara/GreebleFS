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
          surfaceOwnership: {
            chrome: true,
            launcher: false,
            contentFrame: true,
            pinnedPanels: true,
            wallpaper: true,
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
    expect(renderer.surfaceOwnership.chrome).toBe(true);
    expect(renderer.surfaceOwnership.launcher).toBe(false);
    expect(renderer.surfaceOwnership.pinnedPanels).toBe(true);
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
    expect(renderer.surfaceOwnership.launcher).toBe(true);
    expect(renderer.surfaceOwnership.wallpaper).toBe(false);
  });

  it('allows theme renderers to import three from the host runtime allowlist', async () => {
    const renderer = await loadThemeRendererFromSource(
      `
        import * as THREE from 'three';
        import { defineThemeRenderer } from 'overlayterm-theme-renderer';

        const scene = new THREE.Scene();
        scene.name = 'Theme Space';

        export default defineThemeRenderer({
          name: 'Three Shell',
          component() {
            return <div>{scene.name}</div>;
          },
        });
      `,
      {
        name: 'three-shell.tsx',
        path: '/themes/three-shell/renderers/three-shell.tsx',
        is_dir: false,
        extension: 'tsx',
        modified: 1,
      },
      {
        context: {
          rendererRoot: '/themes/three-shell',
          entryModule: 'renderers/three-shell.tsx',
        },
      },
    );

    expect(renderer.error).toBeNull();
    expect(renderer.name).toBe('Three Shell');
    expect(typeof renderer.component).toBe('function');
  });

  it('loads multi-file theme renderer modules through relative imports', async () => {
    const moduleSources: Record<string, string> = {
      '/themes/multi/renderers/helpers/orbit.tsx': `
        import { buildOrbitTitle } from './title';

        export function buildOrbitLabel() {
          return <span>{buildOrbitTitle()}</span>;
        }
      `,
      '/themes/multi/renderers/helpers/title.ts': `
        export function buildOrbitTitle() {
          return 'Orbit Cluster';
        }
      `,
    };

    const renderer = await loadThemeRendererFromSource(
      `
        import { defineThemeRenderer } from 'overlayterm-theme-renderer';
        import { buildOrbitLabel } from './helpers/orbit';

        const orbitLabel = buildOrbitLabel();

        export default defineThemeRenderer({
          name: 'Multi Shell',
          component() {
            return <div>{orbitLabel}</div>;
          },
        });
      `,
      {
        name: 'multi-shell.tsx',
        path: '/themes/multi/renderers/multi-shell.tsx',
        is_dir: false,
        extension: 'tsx',
        modified: 1,
      },
      {
        context: {
          rendererRoot: '/themes/multi',
          entryModule: 'renderers/multi-shell.tsx',
        },
        resolveRelativeModuleSource: async ({ fromModulePath, specifier }) => {
          const fromDirectory = fromModulePath.slice(0, fromModulePath.lastIndexOf('/'));
          const resolvedBasePath = new URL(specifier, `file://${fromDirectory}/`).pathname;
          const candidatePaths = /\.[^./]+$/.test(resolvedBasePath)
            ? [resolvedBasePath]
            : [`${resolvedBasePath}.tsx`, `${resolvedBasePath}.ts`];

          for (const candidatePath of candidatePaths) {
            const source = moduleSources[candidatePath];
            if (source) {
              return {
                modulePath: candidatePath,
                source,
              };
            }
          }

          return null;
        },
      },
    );

    expect(renderer.error).toBeNull();
    expect(renderer.name).toBe('Multi Shell');
    expect(typeof renderer.component).toBe('function');
  });
});
