import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import {
  createEmptyGlobalThemeBundleCatalogs,
  loadThemePackagesFromDirectoryEntries,
} from '../config/themePackages';
import {
  createInlineThemeAppearancePack,
  createInlineThemeEnginePack,
} from '../config/themeBundlePacks';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

interface FilesystemFixture {
  directories: Record<string, FileEntry[]>;
  textFiles?: Record<string, string>;
  base64Files?: Record<string, string>;
}

function normalizePath(path: string | undefined): string {
  return String(path ?? '').replace(/\\/g, '/');
}

function createDirectoryEntry(path: string): FileEntry {
  const normalizedPath = normalizePath(path);
  const segments = normalizedPath.split('/').filter(Boolean);
  return {
    name: segments[segments.length - 1] ?? normalizedPath,
    path: normalizedPath,
    is_dir: true,
    extension: '',
    modified: 0,
  };
}

function createFileEntry(path: string, modified = 1711111111111): FileEntry {
  const normalizedPath = normalizePath(path);
  const segments = normalizedPath.split('/').filter(Boolean);
  const name = segments[segments.length - 1] ?? normalizedPath;
  const extension = name.includes('.') ? name.split('.').pop() ?? '' : '';
  return {
    name,
    path: normalizedPath,
    is_dir: false,
    extension,
    modified,
  };
}

function mockFilesystem(fixture: FilesystemFixture): void {
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    const path = normalizePath((args as { path?: string } | undefined)?.path);
    const hasDirectory = Object.prototype.hasOwnProperty.call(fixture.directories, path);
    const hasTextFile = Object.prototype.hasOwnProperty.call(fixture.textFiles ?? {}, path);
    const hasBase64File = Object.prototype.hasOwnProperty.call(fixture.base64Files ?? {}, path);

    if (command === 'fs_list_dir') {
      if (hasDirectory) {
        return fixture.directories[path];
      }
      throw new Error(`ENOENT: ${path}`);
    }

    if (command === 'fs_read_text_file') {
      if (hasTextFile) {
        return fixture.textFiles?.[path];
      }
      throw new Error(`ENOENT: ${path}`);
    }

    if (command === 'fs_read_file_base64') {
      if (hasBase64File) {
        return fixture.base64Files?.[path];
      }
      throw new Error(`ENOENT: ${path}`);
    }

    throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
  });
}

describe('theme bundle loader', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('loads bundle manifests, scopes local child packs, and resolves the composed downstream theme', async () => {
    mockFilesystem({
      directories: {
        'themes/vista-glass': [
          createDirectoryEntry('themes/vista-glass/appearance-packs'),
          createDirectoryEntry('themes/vista-glass/top-bars'),
          createDirectoryEntry('themes/vista-glass/icon-themes'),
          createDirectoryEntry('themes/vista-glass/wallpapers'),
          createDirectoryEntry('themes/vista-glass/shaders'),
          createDirectoryEntry('themes/vista-glass/animations'),
          createDirectoryEntry('themes/vista-glass/interaction-motion'),
          createDirectoryEntry('themes/vista-glass/shell-renderers'),
          createDirectoryEntry('themes/vista-glass/theme-recipes'),
          createDirectoryEntry('themes/vista-glass/theme-engines'),
        ],
        'themes/vista-glass/appearance-packs': [
          createDirectoryEntry('themes/vista-glass/appearance-packs/appearance-core'),
        ],
        'themes/vista-glass/top-bars': [
          createDirectoryEntry('themes/vista-glass/top-bars/launcher-rail'),
        ],
        'themes/vista-glass/icon-themes': [
          createDirectoryEntry('themes/vista-glass/icon-themes/vista-icons'),
        ],
        'themes/vista-glass/wallpapers': [
          createFileEntry('themes/vista-glass/wallpapers/aurora.png'),
        ],
        'themes/vista-glass/shaders': [
          createFileEntry('themes/vista-glass/shaders/package-glow.tsx'),
        ],
        'themes/vista-glass/animations': [
          createFileEntry('themes/vista-glass/animations/package-open.tsx'),
        ],
        'themes/vista-glass/interaction-motion': [
          createDirectoryEntry('themes/vista-glass/interaction-motion/motion-core'),
        ],
        'themes/vista-glass/shell-renderers': [
          createDirectoryEntry('themes/vista-glass/shell-renderers/vista-renderer'),
        ],
        'themes/vista-glass/theme-recipes': [
          createDirectoryEntry('themes/vista-glass/theme-recipes/recipe-core'),
        ],
        'themes/vista-glass/theme-engines': [
          createDirectoryEntry('themes/vista-glass/theme-engines/engine-core'),
        ],
      },
      textFiles: {
        'themes/vista-glass/theme.json': JSON.stringify({
          version: 1,
          id: 'vista-glass',
          name: 'Vista Glass',
          description: 'Bundle summary',
          author: 'OverlayTerm Labs',
          homepage: 'https://overlayterm.local/themes/vista-glass',
          tags: ['glass', 'blue'],
          extends: 'github-dark',
          preview: 'assets/preview.svg',
          appearancePackId: 'appearance-core',
          topBarId: 'launcher-rail',
          iconThemeId: 'vista-icons',
          wallpaperId: 'aurora',
          shaderId: 'package-glow',
          openAnimationId: 'package-open',
          closeAnimationId: 'burn',
          interactionMotionPackId: 'motion-core',
          rendererId: 'vista-renderer',
          themeRecipeId: 'recipe-core',
          themeEngineId: 'engine-core',
        }),
        'themes/vista-glass/appearance-packs/appearance-core/appearance.json': JSON.stringify({
          version: 1,
          id: 'appearance-core',
          name: 'Appearance Core',
          extendsThemeId: 'github-dark',
          palette: {
            accent: '#7dd3ff',
          },
          fonts: {
            ui: 'Operator',
            mono: 'JetBrains Mono',
          },
          visuals: [
            {
              id: 'glow',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent)',
            },
          ],
          cssVars: {
            '--overlay-explorer-brand': 'cross-media',
          },
          preview: 'preview.svg',
        }),
        'themes/vista-glass/top-bars/launcher-rail/top-bar.json': JSON.stringify({
          version: 1,
          id: 'launcher-rail',
          name: 'Launcher Rail',
          description: 'A compact launcher strip.',
          topBarStyle: 'floating',
          navigationMode: 'summary',
        }),
        'themes/vista-glass/icon-themes/vista-icons/icon-theme.json': JSON.stringify({
          version: 1,
          id: 'vista-icons',
          name: 'Vista Icons',
          file: 'txt',
          folder: 'folder',
          folderExpanded: 'folder_open',
          iconDefinitions: {
            folder: { iconPath: './icons/folder.svg' },
            folder_open: { iconPath: './icons/folder-open.svg' },
            txt: { iconPath: './icons/txt.svg' },
            typescript: { iconPath: './icons/typescript.svg' },
          },
          fileExtensions: {
            ts: 'typescript',
          },
        }),
        'themes/vista-glass/shaders/package-glow.tsx': `
          import { defineShader } from 'overlayterm-shader';

          export default defineShader({
            name: 'Package Glow',
            background: {
              resolveStyle: () => ({ opacity: 0.42 }),
            },
          });
        `,
        'themes/vista-glass/animations/package-open.tsx': `
          import { defineAnimation } from 'overlayterm-animation';

          export default defineAnimation({
            name: 'Package Open',
            open: {
              durationMs: 240,
            },
          });
        `,
        'themes/vista-glass/interaction-motion/motion-core/interaction-motion.json': JSON.stringify({
          version: 1,
          id: 'motion-core',
          name: 'Motion Core',
          interactionMotion: {
            defaultPresetId: 'subtle',
          },
        }),
        'themes/vista-glass/shell-renderers/vista-renderer/shell-renderer.json': JSON.stringify({
          version: 1,
          id: 'vista-renderer',
          name: 'Vista Renderer',
          entryModule: 'renderer.tsx',
          apiVersion: 1,
          supportsLiveSwap: true,
          fallbackRuntime: 'workbench-tabs',
          capabilities: {
            wallpaperScene: true,
            customScreens: true,
            surfaceAdapters: true,
          },
        }),
        'themes/vista-glass/shell-renderers/vista-renderer/renderer.tsx': `
          import { defineThemeRenderer } from 'overlayterm-theme-renderer';

          export default defineThemeRenderer({
            name: 'Vista Shell',
            apiVersion: 1,
            supportsLiveSwap: true,
            fallbackRuntime: 'workbench-tabs',
            capabilities: {
              wallpaperScene: true,
              customScreens: true,
              surfaceAdapters: true,
            },
            component() {
              return React.createElement('div', null, 'Vista Shell');
            },
          });
        `,
        'themes/vista-glass/theme-recipes/recipe-core/theme-recipe.json': JSON.stringify({
          version: 1,
          id: 'recipe-core',
          name: 'Recipe Core',
          explorer: {
            preset: 'xmb',
            toolbarStyle: 'floating',
          },
          dock: {
            explorer: {
              preset: 'workbench',
              toolbarStyle: 'floating',
            },
          },
        }),
        'themes/vista-glass/theme-engines/engine-core/theme-engine.json': JSON.stringify({
          version: 1,
          id: 'engine-core',
          name: 'Engine Core',
          presentation: {
            chromeStyle: 'system',
            panelSpacing: 10,
          },
          compatibility: {
            shellBlueprints: ['classic-dock', 'xmb-cross-media'],
            tags: ['glass', 'cinematic'],
          },
          layoutPrimitives: [
            {
              id: 'dock',
              name: 'Dock',
              kind: 'dock',
              props: {
                gap: 8,
                padding: 10,
                cornerRadius: 10,
                pinned: true,
              },
            },
          ],
          navigationPatterns: [
            {
              id: 'tabs',
              name: 'Tabs',
              kind: 'tabbed',
              axis: 'horizontal',
              props: {
                directionalNavigation: true,
                wrap: true,
                gestureSupport: false,
                breadcrumb: true,
              },
            },
          ],
          renderStyles: [
            {
              id: 'vista-render',
              label: 'Vista Render',
              kind: 'vs-code-workbench',
              entryModule: 'renderers/vista.tsx',
              supportsLiveSwap: true,
            },
          ],
          defaultLayoutPrimitiveId: 'dock',
          defaultNavigationPatternId: 'tabs',
          defaultRenderStyleId: 'vista-render',
        }),
      },
      base64Files: {
        'themes/vista-glass/icon-themes/vista-icons/icons/folder.svg': 'Zm9sZGVy',
        'themes/vista-glass/icon-themes/vista-icons/icons/folder-open.svg': 'Zm9sZGVyLW9wZW4=',
        'themes/vista-glass/icon-themes/vista-icons/icons/txt.svg': 'dHh0',
        'themes/vista-glass/icon-themes/vista-icons/icons/typescript.svg': 'dHlwZXNjcmlwdA==',
      },
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'vista-glass', path: 'themes/vista-glass' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.packages).toHaveLength(1);

    const themePackage = result.packages[0];
    if (!themePackage) {
      throw new Error('Expected vista-glass theme bundle');
    }

    expect(themePackage.id).toBe('vista-glass');
    expect(themePackage.sourceKind).toBe('theme-directory');
    expect(themePackage.sourceLabel).toBe('themes/vista-glass');
    expect(themePackage.author).toBe('OverlayTerm Labs');
    expect(themePackage.homepage).toBe('https://overlayterm.local/themes/vista-glass');
    expect(themePackage.tags).toEqual(['glass', 'blue']);
    expect(themePackage.previewUrl ?? '').toMatch(/preview\.svg$/);

    expect(themePackage.localCatalogs?.appearancePacks[0]?.id).toBe('vista-glass:appearance-core');
    expect(themePackage.localCatalogs?.iconThemePackages[0]?.id).toBe('vista-glass:vista-icons');
    expect(themePackage.localCatalogs?.wallpapers[0]?.id).toBe('vista-glass:aurora');
    expect(themePackage.localCatalogs?.interactionMotionPacks[0]?.id).toBe('vista-glass:motion-core');
    expect(themePackage.localCatalogs?.shellRenderers[0]?.id).toBe('vista-glass:vista-renderer');
    expect(themePackage.localCatalogs?.themeRecipePacks[0]?.id).toBe('vista-glass:recipe-core');
    expect(themePackage.localCatalogs?.themeEnginePacks[0]?.id).toBe('vista-glass:engine-core');
    expect(themePackage.topBars?.[0]?.id).toBe('vista-glass:launcher-rail');

    expect(themePackage.theme.id).toBe('vista-glass');
    expect(themePackage.theme.source).toBe('package');
    expect(themePackage.theme.extendsThemeId).toBe('github-dark');
    expect(themePackage.theme.palette.accent).toBe('#7dd3ff');
    expect(themePackage.theme.fonts?.ui).toBe('Operator');
    expect(themePackage.theme.cssVars?.['--overlay-explorer-brand']).toBe('cross-media');
    expect(themePackage.theme.defaultTopBarId).toBe('vista-glass:launcher-rail');
    expect(themePackage.theme.defaultShaderId).toBe('vista-glass:package-glow');
    expect(themePackage.theme.defaultOpenAnimationId).toBe('vista-glass:package-open');
    expect(themePackage.theme.defaultCloseAnimationId).toBe('burn');
    expect(themePackage.theme.interactionMotion?.defaultPresetId).toBe('subtle');
    expect(themePackage.theme.explorer?.preset).toBe('xmb');
    expect(themePackage.theme.dock?.explorer?.preset).toBe('workbench');
    expect(themePackage.theme.assets?.backgroundUrl ?? '').toMatch(/aurora\.png$/);
    expect(themePackage.theme.assets?.iconTheme?.id).toBe('vista-glass:vista-icons');
    expect(themePackage.theme.assets?.iconTheme?.fileExtensions.ts).toBe('typescript');
    expect(themePackage.theme.assets?.iconEntries?.folder ?? '').toMatch(/^data:image\/svg\+xml;base64,/);
    expect(themePackage.theme.presentation?.chromeStyle).toBe('system');
    expect(themePackage.theme.presentation?.panelSpacing).toBe(10);
    expect(themePackage.theme.compatibility?.shellBlueprints).toEqual(['classic-dock', 'xmb-cross-media']);
    expect(themePackage.theme.compatibility?.tags).toEqual(['glass', 'cinematic']);
    expect(themePackage.theme.engineManifest?.defaultRenderStyleId).toBe('vista-render');
    expect(themePackage.theme.compiledEngineManifest?.defaultRenderStyle?.id).toBe('vista-render');
    expect(themePackage.theme.themeRenderer?.name).toBe('Vista Shell');
    expect(themePackage.theme.themeRenderer?.apiVersion).toBe(1);
    expect(themePackage.theme.themeRenderer?.fallbackRuntime).toBe('workbench-tabs');
    expect(themePackage.theme.themeRenderer?.capabilities.wallpaperScene).toBe(true);
    expect(themePackage.theme.themeRenderer?.component).not.toBeNull();

    expect(themePackage.capabilitySummary.icons).toBe(true);
    expect(themePackage.capabilitySummary.wallpaper).toBe(true);
    expect(themePackage.capabilitySummary.dock).toBe(true);
    expect(themePackage.capabilitySummary.visuals).toBe(1);
    expect(themePackage.capabilitySummary.shaders).toBe(1);
    expect(themePackage.capabilitySummary.animations).toBe(1);
    expect(themePackage.capabilitySummary.fonts).toBe(2);
    expect(themePackage.capabilitySummary.themeRenderer).toBe(true);
    expect(themePackage.capabilitySummary.topBars).toBe(1);

    expect(result.shaders).toHaveLength(1);
    expect(result.shaders[0]?.id).toBe('vista-glass:package-glow');
    expect(result.shaders[0]?.shaderRoot.replace(/\\/g, '/')).toBe('themes/vista-glass/shaders');
    expect(result.shaders[0]?.name).toBe('Package Glow');

    expect(result.animations).toHaveLength(1);
    expect(result.animations[0]?.id).toBe('vista-glass:package-open');
    expect(result.animations[0]?.animationRoot.replace(/\\/g, '/')).toBe('themes/vista-glass/animations');
    expect(result.animations[0]?.name).toBe('Package Open');
  });

  it('keeps healthy bundles when a sibling bundle has invalid runtime contributions', async () => {
    const directories: Record<string, FileEntry[]> = {
      'themes/good': [],
      'themes/broken': [
        createDirectoryEntry('themes/broken/shaders'),
      ],
      'themes/broken/shaders': [
        createFileEntry('themes/broken/shaders/bad.tsx'),
      ],
    };
    const textFiles: Record<string, string> = {
      'themes/good/theme.json': JSON.stringify({
        id: 'good-theme',
        name: 'Good Theme',
        extends: 'operator',
      }),
      'themes/broken/theme.json': JSON.stringify({
        id: 'broken-theme',
        name: 'Broken Theme',
        extends: 'operator',
        shaderId: 'bad',
      }),
    };

    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const path = normalizePath((args as { path?: string } | undefined)?.path);

      if (command === 'fs_read_text_file' && path === 'themes/broken/shaders/bad.tsx') {
        throw new Error('missing shader entry');
      }

      if (command === 'fs_list_dir') {
        if (Object.prototype.hasOwnProperty.call(directories, path)) {
          return directories[path];
        }
        throw new Error(`ENOENT: ${path}`);
      }

      if (command === 'fs_read_text_file') {
        if (Object.prototype.hasOwnProperty.call(textFiles, path)) {
          return textFiles[path];
        }
        throw new Error(`ENOENT: ${path}`);
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'good', path: 'themes/good' },
      { name: 'broken', path: 'themes/broken' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.packages).toHaveLength(2);
    expect(result.packages.map(pkg => pkg.id)).toEqual(expect.arrayContaining(['good-theme', 'broken-theme']));
    expect(result.packages.find(pkg => pkg.id === 'broken-theme')?.warnings).toEqual([
      'Shader bad.tsx: Error: missing shader entry',
    ]);
    expect(result.warnings).toContain('Broken Theme: Shader bad.tsx: Error: missing shader entry');
  });

  it('prefers bundle-local packs when local ids collide and still resolves explicit external pack ids', async () => {
    const dependencyCatalogs = createEmptyGlobalThemeBundleCatalogs();
    dependencyCatalogs.appearancePacks.push(
      createInlineThemeAppearancePack({
        id: 'appearance-core',
        name: 'Global Appearance',
        palette: {
          accent: '#ff00aa',
        },
      }, { bundleId: 'global' }),
    );
    dependencyCatalogs.themeEnginePacks.push(
      createInlineThemeEnginePack({
        id: 'engine-core',
        name: 'Global Engine',
        compatibility: {
          shellBlueprints: ['classic-dock'],
          tags: ['global'],
        },
        renderStyles: [
          {
            id: 'global-render',
            label: 'Global Render',
            description: 'Global render style',
            kind: 'vs-code-workbench',
            entryModule: 'renderers/global.tsx',
            supportsLiveSwap: false,
          },
        ],
        defaultRenderStyleId: 'global-render',
      }, { bundleId: 'global' }),
    );

    mockFilesystem({
      directories: {
        'themes/local-preferred': [
          createDirectoryEntry('themes/local-preferred/appearance-packs'),
        ],
        'themes/local-preferred/appearance-packs': [
          createDirectoryEntry('themes/local-preferred/appearance-packs/appearance-core'),
        ],
        'themes/external-ref': [],
      },
      textFiles: {
        'themes/local-preferred/theme.json': JSON.stringify({
          id: 'local-preferred',
          name: 'Local Preferred',
          appearancePackId: 'appearance-core',
        }),
        'themes/local-preferred/appearance-packs/appearance-core/appearance.json': JSON.stringify({
          id: 'appearance-core',
          name: 'Local Appearance',
          palette: {
            accent: '#7dd3ff',
          },
        }),
        'themes/external-ref/theme.json': JSON.stringify({
          id: 'external-ref',
          name: 'External Ref',
          appearancePackId: 'global:appearance-core',
          themeEngineId: 'global:engine-core',
        }),
      },
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'local-preferred', path: 'themes/local-preferred' },
      { name: 'external-ref', path: 'themes/external-ref' },
    ], 'themes', { dependencyCatalogs });

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);

    const localTheme = result.packages.find(pkg => pkg.id === 'local-preferred');
    const externalTheme = result.packages.find(pkg => pkg.id === 'external-ref');

    expect(localTheme?.localCatalogs?.appearancePacks[0]?.id).toBe('local-preferred:appearance-core');
    expect(localTheme?.theme.palette.accent).toBe('#7dd3ff');

    expect(externalTheme?.localCatalogs?.appearancePacks).toEqual([]);
    expect(externalTheme?.theme.palette.accent).toBe('#ff00aa');
    expect(externalTheme?.theme.engineManifest?.defaultRenderStyleId).toBe('global-render');
    expect(externalTheme?.theme.compiledEngineManifest?.defaultRenderStyle?.id).toBe('global-render');
  });

  it('rejects legacy monolithic filesystem themes with a clear warning instead of silently loading them', async () => {
    mockFilesystem({
      directories: {
        'themes/legacy': [],
      },
      textFiles: {
        'themes/legacy/theme.json': JSON.stringify({
          id: 'legacy-theme',
          name: 'Legacy Theme',
          theme: {
            palette: {
              accent: '#ff00aa',
            },
          },
        }),
      },
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'legacy', path: 'themes/legacy' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.packages).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Legacy monolithic theme packages are no longer supported/);
  });
});
