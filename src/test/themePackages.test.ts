import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadThemePackages, themeSystemConfig } from '../config/themePackages';

describe('theme package loader', () => {
  it('loads packaged themes, resolves icon theme assets, and preserves extends metadata', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string; showHidden?: boolean } | undefined;

      if (command === 'fs_list_dir' && params?.path === themeSystemConfig.themesDirectory) {
        return [
          {
            name: 'vista-glass',
            path: 'themes/vista-glass',
            is_dir: true,
            extension: '',
          },
        ];
      }

      if (command === 'fs_read_text_file' && String(params?.path).replace(/\\/g, '/') === 'themes/vista-glass/theme.json') {
        return JSON.stringify({
          version: 1,
          id: 'vista-glass',
          name: 'Vista Glass',
          extends: 'github-dark',
          assets: {
            background: 'assets/wallpaper.svg',
            iconTheme: 'icon-theme.json',
          },
          theme: {
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

      if (command === 'fs_read_text_file' && String(params?.path).replace(/\\/g, '/') === 'themes/vista-glass/icon-theme.json') {
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

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackages();

    expect(result.sourceError).toBeNull();
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.theme.id).toBe('vista-glass');
    expect(result.packages[0]?.theme.source).toBe('package');
    expect(result.packages[0]?.theme.extendsThemeId).toBe('github-dark');
    expect(result.packages[0]?.theme.assets?.backgroundUrl?.replace(/\\/g, '/')).toBe('asset://localhost/themes/vista-glass/assets/wallpaper.svg');
    expect(result.packages[0]?.theme.assets?.iconEntries?.folder?.replace(/\\/g, '/')).toBe('asset://localhost/themes/vista-glass/icons/folder.svg');
    expect(result.packages[0]?.theme.assets?.iconTheme?.fileExtensions.ts).toBe('typescript');
    expect(result.packages[0]?.theme.visuals).toHaveLength(1);
  });
});
