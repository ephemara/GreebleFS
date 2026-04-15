import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadThemePackages, loadThemePackagesFromDirectoryEntries, themeSystemConfig } from '../config/themePackages';

describe('theme package loader', () => {
  it('loads packaged themes, resolves icon theme assets, and discovers packaged shaders and animations', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_list_dir' && params?.path === themeSystemConfig.themesDirectory) {
        return [
          {
            name: 'vista-glass',
            path: 'themes/vista-glass',
            is_dir: true,
            extension: '',
            modified: 0,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'themes/vista-glass/shaders') {
        return [
          {
            name: 'package-glow.tsx',
            path: 'themes/vista-glass/shaders/package-glow.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 1711111111111,
          },
        ];
      }

      if (command === 'fs_list_dir' && normalizedPath === 'themes/vista-glass/animations') {
        return [
          {
            name: 'package-open.tsx',
            path: 'themes/vista-glass/animations/package-open.tsx',
            is_dir: false,
            extension: 'tsx',
            modified: 1711111112222,
          },
        ];
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/theme.json') {
        return JSON.stringify({
          version: 1,
          id: 'vista-glass',
          name: 'Vista Glass',
          description: 'Package summary',
          author: 'OverlayTerm Labs',
          homepage: 'https://overlayterm.local/themes/vista-glass',
          tags: ['glass', 'blue'],
          extends: 'github-dark',
          assets: {
            background: 'assets/wallpaper.svg',
            preview: 'assets/preview.svg',
            iconTheme: 'icon-theme.json',
          },
          theme: {
            defaultOpenAnimationId: 'package-open',
            defaultCloseAnimationId: 'burn',
            explorer: {
              preset: 'xmb',
              railBrandLabel: 'Cross Media',
              toolbarStyle: 'floating',
              metrics: {
                railWidth: 244,
              },
              cssVars: {
                '--overlay-explorer-brand': 'cross-media',
              },
            },
            dock: {
              explorer: {
                preset: 'workbench',
                toolbarStyle: 'floating',
              },
            },
            palette: {
              accent: '#7dd3ff',
            },
          },
          presentation: {
            chromeStyle: 'system',
            panelSpacing: 10,
          },
          compatibility: {
            shellBlueprints: ['classic-dock', 'xmb-cross-media'],
            tags: ['glass', 'cinematic'],
          },
          designTokens: [
            { id: 'spacing-panel-gap', name: 'Panel Gap', kind: 'spacing', value: { scale: 8, unit: 'px' } },
          ],
          layoutPrimitives: [
            { id: 'dock', name: 'Dock', kind: 'dock', props: { gap: 8, padding: 10, cornerRadius: 10, pinned: true } },
          ],
          navigationPatterns: [
            { id: 'tabs', name: 'Tabs', kind: 'tabbed', axis: 'horizontal', props: { directionalNavigation: true, wrap: true, gestureSupport: false, breadcrumb: true } },
          ],
          animationProfiles: [
            { id: 'package-open', label: 'Package Open', openMs: 240, closeMs: 180, easing: 'ease-out', reducedMotionId: 'instant' },
          ],
          iconPacks: [
            { id: 'vista-icons', label: 'Vista Icons', description: 'Vista pack', basePath: 'icons', fallbackPackId: 'system' },
          ],
          renderStyles: [
            { id: 'vista-render', label: 'Vista Render', kind: 'vs-code-workbench', entryModule: 'renderers/vista.tsx', supportsLiveSwap: true },
          ],
          themeRenderer: {
            entryModule: 'renderers/vista-shell.tsx',
            apiVersion: 1,
            supportsLiveSwap: true,
            fallbackRuntime: 'workbench-tabs',
            capabilities: {
              wallpaperScene: true,
              customScreens: true,
              surfaceAdapters: true,
            },
          },
          defaultLayoutPrimitiveId: 'dock',
          defaultNavigationPatternId: 'tabs',
          defaultAnimationProfileId: 'package-open',
          defaultIconPackId: 'vista-icons',
          defaultRenderStyleId: 'vista-render',
          visuals: [
            {
              id: 'glow',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent)',
            },
          ],
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/icon-theme.json') {
        return JSON.stringify({
          version: 1,
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
          folderNames: {
            src: 'folder',
          },
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/shaders/package-glow.tsx') {
        return `
          import { defineShader } from 'overlayterm-shader';

          export default defineShader({
            name: 'Package Glow',
            background: {
              resolveStyle: () => ({ opacity: 0.42 }),
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/animations/package-open.tsx') {
        return `
          import { defineAnimation } from 'overlayterm-animation';

          export default defineAnimation({
            name: 'Package Open',
            open: {
              durationMs: 240,
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/renderers/vista-shell.tsx') {
        return `
          import { defineThemeRenderer } from 'overlayterm-theme-renderer';
          import { renderVistaShellBody } from './shell/body';

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
            component({ host }) {
              return renderVistaShellBody(host);
            },
          });
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/renderers/shell/body.tsx') {
        return `
          import { getVistaBodySurfaceStyle } from './frame';

          export function renderVistaShellBody(host) {
            return (
              <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0 }}>
                {host.wallpaper.renderBackdropStack()}
                <div style={getVistaBodySurfaceStyle()}>
                  {host.renderDefaultShellBody()}
                </div>
              </div>
            );
          }
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/renderers/shell/frame.ts') {
        return `
          export function getVistaBodySurfaceStyle() {
            return { position: 'relative', zIndex: 1, display: 'flex', flex: 1, minHeight: 0 };
          }
        `;
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/assets/preview.svg') {
        return '<svg />';
      }

      if (command === 'fs_read_file_base64' && normalizedPath === 'themes/vista-glass/assets/wallpaper.svg') {
        return 'data:image/svg+xml;base64,d2FsbHBhcGVy';
      }

      if (command === 'fs_read_file_base64' && normalizedPath === 'themes/vista-glass/assets/preview.svg') {
        return 'data:image/svg+xml;base64,cHJldmlldw==';
      }

      if (command === 'fs_read_file_base64' && normalizedPath === 'themes/vista-glass/icons/folder.svg') {
        return 'data:image/svg+xml;base64,Zm9sZGVy';
      }

      if (command === 'fs_read_file_base64' && normalizedPath === 'themes/vista-glass/icons/folder-open.svg') {
        return 'data:image/svg+xml;base64,Zm9sZGVyLW9wZW4=';
      }

      if (command === 'fs_read_file_base64' && normalizedPath === 'themes/vista-glass/icons/txt.svg') {
        return 'data:image/svg+xml;base64,dHh0';
      }

      if (command === 'fs_read_file_base64' && normalizedPath === 'themes/vista-glass/icons/typescript.svg') {
        return 'data:image/svg+xml;base64,dHlwZXNjcmlwdA==';
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackages();

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.theme.id).toBe('vista-glass');
    expect(result.packages[0]?.theme.source).toBe('package');
    expect(result.packages[0]?.sourceKind).toBe('theme-directory');
    expect(result.packages[0]?.sourceLabel).toBe('themes/vista-glass');
    expect(result.packages[0]?.warnings).toEqual([]);
    expect(result.packages[0]?.theme.extendsThemeId).toBe('github-dark');
    expect(result.packages[0]?.theme.assets?.backgroundUrl ?? '').toMatch(/(data:image\/svg\+xml;base64,d2FsbHBhcGVy|themes\/vista-glass\/assets\/wallpaper\.svg$)/);
    expect(result.packages[0]?.previewUrl ?? '').toMatch(/(data:image\/svg\+xml;base64,cHJldmlldw==|themes\/vista-glass\/assets\/preview\.svg$)/);
    expect(result.packages[0]?.theme.assets?.iconEntries?.folder ?? '').toMatch(/(data:image\/svg\+xml;base64,Zm9sZGVy|themes\/vista-glass\/icons\/folder\.svg)$/);
    expect(result.packages[0]?.theme.assets?.iconTheme?.fileExtensions.ts).toBe('typescript');
    expect(result.packages[0]?.theme.defaultOpenAnimationId).toBe('package-open');
    expect(result.packages[0]?.theme.defaultCloseAnimationId).toBe('burn');
    expect(result.packages[0]?.theme.explorer?.preset).toBe('xmb');
    expect(result.packages[0]?.theme.explorer?.toolbarStyle).toBe('floating');
    expect(result.packages[0]?.theme.explorer?.metrics?.railWidth).toBe(244);
    expect(result.packages[0]?.theme.explorer?.cssVars?.['--overlay-explorer-brand']).toBe('cross-media');
    expect(result.packages[0]?.theme.presentation?.chromeStyle).toBe('system');
    expect(result.packages[0]?.theme.presentation?.panelSpacing).toBe(10);
    expect(result.packages[0]?.theme.compatibility?.shellBlueprints).toEqual(['classic-dock', 'xmb-cross-media']);
    expect(result.packages[0]?.theme.compatibility?.tags).toEqual(['glass', 'cinematic']);
    expect(result.packages[0]?.engineManifest?.designTokens).toHaveLength(1);
    expect(result.packages[0]?.engineManifest?.designTokens[0]?.value).toEqual({ scale: 8, unit: 'px' });
    expect(result.packages[0]?.engineManifest?.layoutPrimitives[0]?.props.gap).toBe(8);
    expect(result.packages[0]?.engineManifest?.layoutPrimitives[0]?.props.pinned).toBe(true);
    expect(result.packages[0]?.engineManifest?.navigationPatterns[0]?.props.breadcrumb).toBe(true);
    expect(result.packages[0]?.engineManifest?.presentation.density).toBe('comfortable');
    expect(result.packages[0]?.engineManifest?.presentation.iconStyle).toBe('vector');
    expect(result.packages[0]?.engineManifest?.presentation.motionStyle).toBe('fluid');
    expect(result.packages[0]?.engineManifest?.compatibility.shellBlueprints).toEqual(['classic-dock', 'xmb-cross-media']);
    expect(result.packages[0]?.engineManifest?.compatibility.tags).toEqual(['glass', 'cinematic']);
    expect(result.packages[0]?.engineManifest?.renderStyles[0]?.id).toBe('vista-render');
    expect(result.packages[0]?.engineManifest?.renderStyles[0]?.kind).toBe('vs-code-workbench');
    expect(result.packages[0]?.engineManifest?.defaultLayoutPrimitiveId).toBe('dock');
    expect(result.packages[0]?.engineManifest?.defaultNavigationPatternId).toBe('tabs');
    expect(result.packages[0]?.engineManifest?.defaultAnimationProfileId).toBe('package-open');
    expect(result.packages[0]?.engineManifest?.defaultIconPackId).toBe('vista-icons');
    expect(result.packages[0]?.engineManifest?.defaultRenderStyleId).toBe('vista-render');
    expect(result.packages[0]?.compiledEngineManifest?.defaultRenderStyle?.id).toBe('vista-render');
    expect(result.packages[0]?.compiledEngineManifest?.defaultLayoutPrimitive?.id).toBe('dock');
    expect(result.packages[0]?.compiledEngineManifest?.defaultNavigationPattern?.id).toBe('tabs');
    expect(result.packages[0]?.compiledEngineManifest?.defaultAnimationProfile?.id).toBe('package-open');
    expect(result.packages[0]?.compiledEngineManifest?.defaultIconPack?.id).toBe('vista-icons');
    expect(result.packages[0]?.compiledEngineManifest?.renderStyleLookup['vista-render']?.kind).toBe('vs-code-workbench');
    expect(result.packages[0]?.compiledEngineManifest?.supportsHotSwappingRenderStyles).toBe(true);
    expect(result.packages[0]?.theme.engineManifest?.defaultLayoutPrimitiveId).toBe('dock');
    expect(result.packages[0]?.theme.compiledEngineManifest?.defaultRenderStyle?.id).toBe('vista-render');
    expect(result.packages[0]?.theme.themeRenderer?.name).toBe('Vista Shell');
    expect(result.packages[0]?.theme.themeRenderer?.apiVersion).toBe(1);
    expect(result.packages[0]?.theme.themeRenderer?.fallbackRuntime).toBe('workbench-tabs');
    expect(result.packages[0]?.theme.themeRenderer?.capabilities.wallpaperScene).toBe(true);
    expect(result.packages[0]?.theme.themeRenderer?.error).toBeNull();
    expect(result.packages[0]?.theme.themeRenderer?.component).not.toBeNull();
    expect(result.packages[0]?.themeRenderer?.entryModule).toBe('renderers/vista-shell.tsx');
    expect(result.packages[0]?.author).toBe('OverlayTerm Labs');
    expect(result.packages[0]?.homepage).toBe('https://overlayterm.local/themes/vista-glass');
    expect(result.packages[0]?.tags).toEqual(['glass', 'blue']);
    expect(result.packages[0]?.capabilitySummary.icons).toBe(true);
    expect(result.packages[0]?.capabilitySummary.wallpaper).toBe(true);
    expect(result.packages[0]?.capabilitySummary.dock).toBe(true);
    expect(result.packages[0]?.capabilitySummary.shaders).toBe(1);
    expect(result.packages[0]?.capabilitySummary.animations).toBe(1);
    expect(result.packages[0]?.capabilitySummary.themeRenderer).toBe(true);
    expect(result.packages[0]?.catalog.tierId).toBe('legacy-lab');
    expect(result.packages[0]?.catalog.tierLabel).toBe('Legacy Lab');
    expect(result.packages[0]?.catalog.badgeLabel).toBe('Lab');
    expect(result.packages[0]?.catalog.isOfficialPilot).toBe(false);
    expect(result.packages[0]?.theme.visuals).toHaveLength(1);
    expect(result.shaders).toHaveLength(1);
    expect(result.shaders[0]?.shaderRoot.replace(/\\/g, '/')).toBe('themes/vista-glass');
    expect(result.shaders[0]?.filePath.replace(/\\/g, '/')).toBe('themes/vista-glass/shaders/package-glow.tsx');
    expect(result.shaders[0]?.name).toBe('Package Glow');
    expect(result.animations).toHaveLength(1);
    expect(result.animations[0]?.animationRoot.replace(/\\/g, '/')).toBe('themes/vista-glass');
    expect(result.animations[0]?.filePath.replace(/\\/g, '/')).toBe('themes/vista-glass/animations/package-open.tsx');
    expect(result.animations[0]?.name).toBe('Package Open');
  });

  it('keeps healthy theme packages when a sibling package has invalid runtime contributions', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/good/theme.json') {
        return JSON.stringify({
          id: 'good-theme',
          name: 'Good Theme',
          extends: 'operator',
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/broken/theme.json') {
        return JSON.stringify({
          id: 'broken-theme',
          name: 'Broken Theme',
          extends: 'operator',
          contributions: {
            shaders: ['shaders/bad.tsx'],
          },
        });
      }

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/broken/shaders/bad.tsx') {
        throw new Error('missing shader entry');
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'good', path: 'themes/good' },
      { name: 'broken', path: 'themes/broken' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.packages.map(pkg => pkg.id)).toEqual(['broken-theme', 'good-theme']);
    expect(result.packages.find(pkg => pkg.id === 'broken-theme')?.warnings).toEqual([
      'Shader bad.tsx: Error: missing shader entry',
    ]);
    expect(result.warnings).toEqual([
      'Broken Theme: Shader bad.tsx: Error: missing shader entry',
    ]);
  });

  it('normalizes sparse engine metadata from theme packages before exposing compatibility defaults', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/minimal/theme.json') {
        return JSON.stringify({
          id: 'minimal-theme',
          name: 'Minimal Theme',
          renderStyles: [
            {
              id: 'springboard',
              label: 'Springboard',
              kind: 'ios-springboard',
              entryModule: 'renderers/springboard.tsx',
              supportsLiveSwap: false,
            },
          ],
          presentation: {
            panelSpacing: 14,
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'minimal', path: 'themes/minimal' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.packages[0]?.engineManifest?.presentation.panelSpacing).toBe(14);
    expect(result.packages[0]?.engineManifest?.presentation.density).toBe('comfortable');
    expect(result.packages[0]?.engineManifest?.compatibility.shellBlueprints).toEqual([]);
    expect(result.packages[0]?.engineManifest?.compatibility.tags).toEqual([]);
    expect(result.packages[0]?.engineManifest?.renderStyles[0]?.kind).toBe('ios-springboard');
    expect(result.packages[0]?.compiledEngineManifest?.supportsHotSwappingRenderStyles).toBe(false);
  });

  it('ignores invalid package shell targets instead of coercing them to classic-dock', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path).replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/compat/theme.json') {
        return JSON.stringify({
          id: 'compat-theme',
          name: 'Compat Theme',
          renderStyles: [
            {
              id: 'compat-render',
              label: 'Compat Render',
              kind: 'vs-code-workbench',
              entryModule: 'renderers/compat.tsx',
              supportsLiveSwap: true,
            },
          ],
          compatibility: {
            shellBlueprints: ['xmb-cross-media', ' typo-shell ', 'xmb-cross-media'],
            tags: [' cinematic ', 'cinematic'],
          },
        });
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries([
      { name: 'compat', path: 'themes/compat' },
    ], 'themes');

    expect(result.sourceError).toBeNull();
    expect(result.packages[0]?.theme.compatibility?.shellBlueprints).toEqual(['xmb-cross-media']);
    expect(result.packages[0]?.engineManifest?.compatibility.shellBlueprints).toEqual(['xmb-cross-media']);
    expect(result.packages[0]?.theme.compatibility?.tags).toEqual(['cinematic']);
  });
});
