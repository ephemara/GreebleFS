import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import {
  createEmptyGlobalThemeBundleCatalogs,
  loadThemePackagesFromDirectoryEntries,
} from '../config/themePackages';
import {
  createInlineThemeAppearancePack,
  createInlineThemeEnginePack,
  loadThemeAppearancePacksFromDirectoryEntries,
  loadThemeEnginePacksFromDirectoryEntries,
  loadThemeInteractionMotionPacksFromDirectoryEntries,
  loadThemeRecipePacksFromDirectoryEntries,
} from '../config/themeBundlePacks';
import { resolveOverlayAppearance } from '../config/appearance';
import { createMobileShareThemeSnapshot } from '../config/mobileTheme';

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
  archiveOutputs?: Record<string, { outputPath: string; extractedEntryCount: number; reusedCachedOutput: boolean }>;
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
    const requestPath = normalizePath((args as { request?: { archivePath?: string } } | undefined)?.request?.archivePath);
    const archivePath = command === 'fs_open_archive' ? path : requestPath;
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

    if (command === 'fs_open_archive' || command === 'fs_extract_archive') {
      if (Object.prototype.hasOwnProperty.call(fixture.archiveOutputs ?? {}, archivePath)) {
        return fixture.archiveOutputs?.[archivePath];
      }
      throw new Error(`ENOENT: ${archivePath}`);
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
          createDirectoryEntry('themes/vista-glass/sound-packs'),
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
        'themes/vista-glass/sound-packs': [
          createDirectoryEntry('themes/vista-glass/sound-packs/glass-clicks'),
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
          soundPackId: 'glass-clicks',
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
        'themes/vista-glass/sound-packs/glass-clicks/sound-pack.json': JSON.stringify({
          version: 1,
          id: 'glass-clicks',
          name: 'Glass Clicks',
          masterVolume: 0.9,
          sounds: {
            'shell-button-press': {
              kind: 'synth',
              tones: [
                { frequency: 820, durationMs: 20, gain: 0.16, waveform: 'triangle' },
              ],
            },
          },
        }),
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
    expect(themePackage.localCatalogs?.soundPacks[0]?.id).toBe('vista-glass:glass-clicks');
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
    expect(themePackage.theme.defaultSoundPackId).toBe('vista-glass:glass-clicks');
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

  it('composes flat /usr appearance, motion, recipe, and engine packs into desktop and mobile CSS variables', async () => {
    const textFiles: Record<string, string> = {
      'themes/token-lab/theme.json': JSON.stringify({
        version: 1,
        id: 'token-lab',
        name: 'Token Lab',
        extends: 'github-dark',
        themeEngineId: 'token-engine',
      }),
      'usr/appearance-packs/token-appearance/manifest.json': JSON.stringify({
        version: 1,
        id: 'token-appearance',
        name: 'Token Appearance',
        extendsThemeId: 'github-dark',
      }),
      'usr/appearance-packs/token-appearance/tokens/color.json': JSON.stringify({
        palette: {
          accent: '#123456',
          panelBackground: 'rgba(10,20,30,0.9)',
        },
        tokens: {
          accent: '#123456',
          modalScrim: 'rgba(0,0,0,0.6)',
        },
      }),
      'usr/appearance-packs/token-appearance/tokens/typography.json': JSON.stringify({
        fonts: {
          ui: 'Token UI',
          mono: 'Token Mono',
        },
      }),
      'usr/appearance-packs/token-appearance/tokens/spacing.json': JSON.stringify({
        panelGap: 15,
      }),
      'usr/appearance-packs/token-appearance/tokens/radius.json': JSON.stringify({
        panelRadius: 21,
      }),
      'usr/appearance-packs/token-appearance/tokens/border.json': JSON.stringify({
        accentBorder: 'rgba(18,52,86,0.4)',
      }),
      'usr/appearance-packs/token-appearance/tokens/shadow.json': JSON.stringify({
        effects: {
          shadow: '0 2px 8px rgba(0,0,0,0.4)',
          overlayShadow: '0 6px 22px rgba(0,0,0,0.4)',
        },
      }),
      'usr/appearance-packs/token-appearance/tokens/opacity.json': JSON.stringify({
        surfaceOpacity: 0.9,
      }),
      'usr/appearance-packs/token-appearance/tokens/blur.json': JSON.stringify({
        backdropBlur: 'blur(8px)',
      }),
      'usr/appearance-packs/token-appearance/tokens/geometry.json': JSON.stringify({
        railWidth: 244,
      }),
      'usr/appearance-packs/token-appearance/tokens/layer.json': JSON.stringify({
        modal: 80,
      }),
      'usr/interaction-motion/token-motion/manifest.json': JSON.stringify({
        version: 1,
        id: 'token-motion',
        name: 'Token Motion',
      }),
      'usr/interaction-motion/token-motion/tokens/motion.json': JSON.stringify({
        defaultDurationMs: 180,
      }),
      'usr/interaction-motion/token-motion/tokens/interaction.json': JSON.stringify({
        interactionMotion: {
          defaultPresetId: 'snappy',
        },
        tokens: {
          touchTarget: 50,
        },
      }),
      'usr/theme-recipes/token-recipe/manifest.json': JSON.stringify({
        version: 1,
        id: 'token-recipe',
        name: 'Token Recipe',
      }),
      'usr/theme-recipes/token-recipe/presentation.json': JSON.stringify({
        chromeStyle: 'system',
        panelSpacing: 15,
      }),
      'usr/theme-recipes/token-recipe/layout.json': JSON.stringify({
        layoutPrimitives: [
          {
            id: 'token-layout',
            name: 'Token Layout',
            kind: 'dock',
            props: {
              gap: 15,
            },
          },
        ],
        defaultLayoutPrimitiveId: 'token-layout',
      }),
      'usr/theme-recipes/token-recipe/navigation.json': JSON.stringify({
        navigationPatterns: [
          {
            id: 'token-nav',
            name: 'Token Nav',
            kind: 'tabbed',
            axis: 'horizontal',
            props: {
              wrap: true,
            },
          },
        ],
        defaultNavigationPatternId: 'token-nav',
      }),
      'usr/theme-recipes/token-recipe/render.json': JSON.stringify({
        renderStyles: [
          {
            id: 'token-render',
            label: 'Token Render',
            kind: 'vs-code-workbench',
            entryModule: 'renderers/token.tsx',
            supportsLiveSwap: true,
          },
        ],
        defaultRenderStyleId: 'token-render',
      }),
      'usr/theme-recipes/token-recipe/workbench.json': JSON.stringify({
        metrics: {
          chromeHeight: 44,
          panelGap: 15,
          panelRadius: 21,
        },
      }),
      'usr/theme-recipes/token-recipe/explorer.json': JSON.stringify({
        metrics: {
          railWidth: 244,
          previewWidth: 388,
        },
        cssVars: {
          '--overlay-explorer-modal-scrim': 'rgba(0,0,0,0.6)',
        },
      }),
      'usr/theme-recipes/token-recipe/mobile.json': JSON.stringify({
        metrics: {
          pagePadding: 19,
          touchTarget: 57,
        },
        cssVars: {
          '--mobile-token-proof': 'yes',
        },
      }),
      'usr/theme-engines/token-engine/theme-engine.json': JSON.stringify({
        version: 1,
        id: 'token-engine',
        name: 'Token Engine',
        appearancePackId: 'token-appearance',
        interactionMotionPackId: 'token-motion',
        themeRecipeId: 'token-recipe',
      }),
    };

    mockFilesystem({
      directories: {
        'themes/token-lab': [],
      },
      textFiles,
    });

    const loadResolvedPackage = async () => {
      const appearanceResult = await loadThemeAppearancePacksFromDirectoryEntries([
        createDirectoryEntry('usr/appearance-packs/token-appearance'),
      ]);
      const interactionMotionResult = await loadThemeInteractionMotionPacksFromDirectoryEntries([
        createDirectoryEntry('usr/interaction-motion/token-motion'),
      ]);
      const themeRecipeResult = await loadThemeRecipePacksFromDirectoryEntries([
        createDirectoryEntry('usr/theme-recipes/token-recipe'),
      ]);
      const themeEngineResult = await loadThemeEnginePacksFromDirectoryEntries([
        createDirectoryEntry('usr/theme-engines/token-engine'),
      ]);

      const result = await loadThemePackagesFromDirectoryEntries([
        { name: 'token-lab', path: 'themes/token-lab' },
      ], 'themes', {
        dependencyCatalogs: {
          ...createEmptyGlobalThemeBundleCatalogs(),
          appearancePacks: appearanceResult.packs,
          interactionMotionPacks: interactionMotionResult.packs,
          themeRecipePacks: themeRecipeResult.packs,
          themeEnginePacks: themeEngineResult.packs,
        },
      });

      return result.packages[0]?.theme;
    };

    const firstTheme = await loadResolvedPackage();
    if (!firstTheme) {
      throw new Error('Expected token-lab theme');
    }

    expect(firstTheme.palette.accent).toBe('#123456');
    expect(firstTheme.fonts?.ui).toBe('Token UI');
    expect(firstTheme.presentation?.chromeStyle).toBe('system');
    expect(firstTheme.engineManifest?.defaultLayoutPrimitiveId).toBe('token-layout');
    expect(firstTheme.compiledEngineManifest?.defaultRenderStyle?.id).toBe('token-render');
    expect(firstTheme.compiledEngineManifest?.manifest.designTokens.map(token => token.kind)).toEqual(
      expect.arrayContaining(['color', 'border', 'opacity', 'blur', 'geometry', 'layer', 'motion', 'interaction']),
    );
    expect(firstTheme.cssVars?.['--gfs-ui-color-accent']).toBe('#123456');
    expect(firstTheme.interactionMotion?.defaultPresetId).toBe('snappy');

    const appearance = resolveOverlayAppearance({
      activeThemeId: 'token-lab',
      packageThemes: [firstTheme],
    });
    expect(appearance.cssVars['--overlay-workbench-chrome-height']).toBe('44px');
    expect(appearance.explorerTheme.cssVars['--overlay-explorer-rail-width']).toBe('244px');
    expect(appearance.explorerTheme.cssVars['--overlay-explorer-modal-scrim']).toBe('rgba(0,0,0,0.6)');

    const mobileSnapshot = createMobileShareThemeSnapshot(appearance);
    expect(mobileSnapshot.metrics.pagePadding).toBe(19);
    expect(mobileSnapshot.metrics.touchTarget).toBe(57);
    expect(mobileSnapshot.cssVars['--mobile-token-proof']).toBe('yes');

    textFiles['usr/appearance-packs/token-appearance/tokens/color.json'] = JSON.stringify({
      palette: {
        accent: '#abcdef',
      },
      tokens: {
        accent: '#abcdef',
      },
    });
    const secondTheme = await loadResolvedPackage();
    expect(secondTheme?.palette.accent).toBe('#abcdef');
    expect(secondTheme?.cssVars?.['--gfs-ui-color-accent']).toBe('#abcdef');
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

  it('loads VS Code folder themes with JSONC include support and extension-contributed icon themes', async () => {
    mockFilesystem({
      directories: {},
      textFiles: {
        'themes/monokai-vscode/package.json': JSON.stringify({
          name: 'monokai-theme',
          publisher: 'vscode',
          displayName: 'Monokai Import',
          description: 'VS Code compatibility theme',
          version: '11.4.0',
          contributes: {
            themes: [
              {
                id: 'monokai',
                label: 'Monokai Import',
                uiTheme: 'vs-dark',
                path: './themes/monokai-color-theme.json',
              },
            ],
            iconThemes: [
              {
                id: 'monokai-icons',
                label: 'Monokai Icons',
                path: './icons/file-icons.json',
              },
            ],
          },
        }),
        'themes/monokai-vscode/themes/base.json': `{
          // shared base colors
          "colors": {
            "focusBorder": "#e6db74",
            "input.background": "#2d2a2e",
            "button.background": "#75715E",
            "terminal.background": "#161712",
            "terminal.ansiBrightGreen": "#A6E22E"
          }
        }`,
        'themes/monokai-vscode/themes/monokai-color-theme.json': `{
          "include": "./base.json",
          "type": "dark",
          "colors": {
            "editor.background": "#272822",
            "editor.foreground": "#F8F8F2",
            "editor.selectionBackground": "#878b9180",
            "sideBar.background": "#1e1f1c",
            "titleBar.activeBackground": "#1e1f1c",
            "panel.border": "#414339",
            "list.activeSelectionBackground": "#75715E",
            "statusBar.background": "#414339",
            "terminal.foreground": "#f8f8f2"
          },
          "tokenColors": [
            {
              "scope": "comment",
              "settings": {
                "foreground": "#88846f"
              }
            },
            {
              "scope": "keyword",
              "settings": {
                "foreground": "#F92672"
              }
            }
          ]
        }`,
        'themes/monokai-vscode/icons/file-icons.json': JSON.stringify({
          file: 'file',
          folder: 'folder',
          folderExpanded: 'folder_open',
          iconDefinitions: {
            file: { iconPath: './file.svg' },
            folder: { iconPath: './folder.svg' },
            folder_open: { iconPath: './folder-open.svg' },
          },
          fileExtensions: {
            ts: 'file',
          },
        }),
      },
      base64Files: {
        'themes/monokai-vscode/icons/file.svg': 'PHN2Zy8+',
        'themes/monokai-vscode/icons/folder.svg': 'PHN2Zy8+',
        'themes/monokai-vscode/icons/folder-open.svg': 'PHN2Zy8+',
      },
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'monokai-vscode', path: 'themes/monokai-vscode' },
    ], 'themes');

    const monokaiPackage = result.packages.find(pkg => pkg.id === 'vscode-vscode-monokai-theme-monokai');
    expect(monokaiPackage?.sourceKind).toBe('vscode-theme-directory');
    expect(monokaiPackage?.sourceInfo?.source).toBe('folder');
    expect(monokaiPackage?.theme.palette.panelBackground).toBe('#272822');
    expect(monokaiPackage?.theme.xterm.background).toBe('#161712');
    expect(monokaiPackage?.theme.cssVars?.['--overlay-explorer-code-bg']).toBe('#272822');
    expect(monokaiPackage?.theme.cssVars?.['--overlay-workbench-chrome-bg']).toBe('#1e1f1c');
    expect(monokaiPackage?.theme.assets?.monacoTheme?.baseTheme).toBe('vs-dark');
    expect(monokaiPackage?.theme.assets?.monacoTheme?.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ token: 'comment', foreground: '88846f' }),
      expect.objectContaining({ token: 'keyword', foreground: 'F92672' }),
    ]));
    expect(monokaiPackage?.localCatalogs?.iconThemePackages).toHaveLength(1);
    expect(monokaiPackage?.localCatalogs?.iconThemePackages[0]?.sourceKind).toBe('vscode-icon-theme-directory');
    expect(monokaiPackage?.theme.assets?.iconTheme?.name).toBe('Monokai Icons');
  });

  it('loads VS Code .vsix themes from cached extraction roots', async () => {
    mockFilesystem({
      directories: {},
      archiveOutputs: {
        'themes/material-night.vsix': {
          outputPath: '/cache/material-night',
          extractedEntryCount: 24,
          reusedCachedOutput: true,
        },
      },
      textFiles: {
        '/cache/material-night/extension/package.json': JSON.stringify({
          name: 'material-night',
          publisher: 'greeble',
          displayName: 'Material Night',
          version: '3.1.0',
          contributes: {
            themes: [
              {
                id: 'material-night',
                label: 'Material Night',
                uiTheme: 'vs-dark',
                path: './themes/material-night.json',
              },
            ],
          },
        }),
        '/cache/material-night/extension/themes/material-night.json': `{
          // comment to prove JSONC parsing works here too
          "type": "dark",
          "colors": {
            "editor.background": "#1e1e1e",
            "editor.foreground": "#d4d4d4",
            "titleBar.activeBackground": "#202124",
            "sideBar.background": "#252526",
            "terminal.background": "#1e1e1e",
            "terminal.foreground": "#d4d4d4"
          },
          "tokenColors": []
        }`,
      },
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      {
        name: 'material-night.vsix',
        path: 'themes/material-night.vsix',
        isDirectory: false,
        extension: 'vsix',
      },
    ], 'themes');

    const materialPackage = result.packages.find(pkg => pkg.id === 'vscode-greeble-material-night-material-night');
    expect(materialPackage?.sourceKind).toBe('vscode-theme-vsix');
    expect(materialPackage?.sourceInfo?.source).toBe('vsix');
    expect(materialPackage?.sourceInfo?.cachedExtractionPath).toBe('/cache/material-night');
    expect(normalizePath(materialPackage?.manifestPath)).toBe('/cache/material-night/extension/themes/material-night.json');
    expect(materialPackage?.theme.assets?.monacoTheme?.baseTheme).toBe('vs-dark');
    expect(materialPackage?.theme.palette.sidebarBackground).toBe('#252526');
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
