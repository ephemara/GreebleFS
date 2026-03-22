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
            palette: {
              accent: '#7dd3ff',
            },
          },
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

      if (command === 'fs_read_text_file' && normalizedPath === 'themes/vista-glass/assets/preview.svg') {
        return '<svg />';
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
    expect(result.packages[0]?.theme.assets?.backgroundUrl?.replace(/\\/g, '/')).toBe('asset://localhost/themes/vista-glass/assets/wallpaper.svg');
    expect(result.packages[0]?.previewUrl?.replace(/\\/g, '/')).toBe('asset://localhost/themes/vista-glass/assets/preview.svg');
    expect(result.packages[0]?.theme.assets?.iconEntries?.folder).toBe('data:image/svg+xml;base64,Zm9sZGVy');
    expect(result.packages[0]?.theme.assets?.iconTheme?.fileExtensions.ts).toBe('typescript');
    expect(result.packages[0]?.theme.defaultOpenAnimationId).toBe('package-open');
    expect(result.packages[0]?.theme.defaultCloseAnimationId).toBe('burn');
    expect(result.packages[0]?.author).toBe('OverlayTerm Labs');
    expect(result.packages[0]?.homepage).toBe('https://overlayterm.local/themes/vista-glass');
    expect(result.packages[0]?.tags).toEqual(['glass', 'blue']);
    expect(result.packages[0]?.capabilitySummary.icons).toBe(true);
    expect(result.packages[0]?.capabilitySummary.wallpaper).toBe(true);
    expect(result.packages[0]?.capabilitySummary.shaders).toBe(1);
    expect(result.packages[0]?.capabilitySummary.animations).toBe(1);
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
});
