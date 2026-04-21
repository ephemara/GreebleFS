import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { loadIconThemePackagesFromDirectoryEntries } from '../config/iconThemePackages';

const zenManifestPath = resolve(process.cwd(), 'icon-themes/Zen/icon-theme.json');
const zenManifestText = readFileSync(zenManifestPath, 'utf8');

describe('icon theme package loader', () => {
  it('loads the Zen icon pack as a first-class managed icon theme package', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const params = args as { path?: string } | undefined;
      const normalizedPath = String(params?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_read_text_file' && normalizedPath === 'icon-themes/Zen/icon-theme.json') {
        return zenManifestText;
      }

      if (command === 'fs_read_file_base64' && normalizedPath.startsWith('icon-themes/Zen/')) {
        return 'data:image/svg+xml;base64,PHN2Zy8+';
      }

      return null;
    });

    const result = await loadIconThemePackagesFromDirectoryEntries([
      {
        name: 'Zen',
        path: 'icon-themes/Zen',
        is_dir: true,
        extension: '',
        modified: 0,
      },
    ], 'icon-themes');

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);

    const zenPackage = result.packages.find(pkg => pkg.id === 'zen');
    expect(zenPackage).toBeTruthy();
    expect(zenPackage?.name).toBe('Zen');
    expect(zenPackage?.capabilitySummary.iconDefinitions).toBeGreaterThanOrEqual(200);
    expect(zenPackage?.iconTheme.fileExtensions.ts).toBe('typescript');
    expect(zenPackage?.iconTheme.fileNames['cmakelists.txt']).toBe('cmake');
    expect(zenPackage?.iconTheme.folderNames['src-tauri']).toBe('folder_src');
    expect(zenPackage?.capabilitySummary.uiIcons).toBeGreaterThanOrEqual(130);
    expect(zenPackage?.iconTheme.uiIcons.camera).toBe('camera');
    expect(zenPackage?.iconTheme.uiIcons.copy).toBe('copy');
    expect(zenPackage?.iconTheme.uiIcons.folder_tree).toBe('folder_tree');
    expect(zenPackage?.iconTheme.uiIcons.hard_drive).toBe('hard_drive');
    expect(zenPackage?.iconTheme.uiIcons.panel_storage).toBe('panel_storage');
    expect(zenPackage?.iconTheme.uiIcons.panel_drawable_canvas).toBe('panel_drawable_canvas');
    expect(zenPackage?.iconTheme.uiIcons.panel_sketchfab).toBe('model3d');
    expect(zenPackage?.iconTheme.uiIcons.plus).toBe('plus');
    expect(zenPackage?.iconTheme.uiIcons.puzzle).toBe('puzzle');
    expect(zenPackage?.iconTheme.uiIcons.search).toBe('search');
    expect(zenPackage?.iconTheme.uiIcons.settings2).toBe('settings2');
    expect(zenPackage?.iconTheme.uiIcons.sliders_horizontal).toBe('sliders_horizontal');
    expect(zenPackage?.iconTheme.uiIcons.sticky_note).toBe('sticky_note');
    expect(zenPackage?.iconTheme.uiIcons.terminal).toBe('shell');
    expect(zenPackage?.iconTheme.iconDefinitions.panel_storage).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(zenPackage?.iconTheme.iconDefinitions.folder_tree).toBe('data:image/svg+xml;base64,PHN2Zy8+');
    expect(zenPackage?.iconTheme.iconDefinitions.typescript).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });
});
