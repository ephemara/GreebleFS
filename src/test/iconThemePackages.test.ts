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
    expect(zenPackage?.capabilitySummary.iconDefinitions).toBeGreaterThanOrEqual(85);
    expect(zenPackage?.iconTheme.fileExtensions.ts).toBe('typescript');
    expect(zenPackage?.iconTheme.fileNames['cmakelists.txt']).toBe('cmake');
    expect(zenPackage?.iconTheme.folderNames['src-tauri']).toBe('folder_src');
    expect(zenPackage?.iconTheme.uiIcons.terminal).toBe('shell');
    expect(zenPackage?.iconTheme.iconDefinitions.typescript).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });
});
