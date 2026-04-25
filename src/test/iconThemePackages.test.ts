import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import {
  loadIconThemePackagesFromDirectoryEntries,
  resolveLoadedIconThemePackage,
} from '../config/iconThemePackages';

type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
};

const zenManifestPath = resolve(process.cwd(), 'icon-themes/Zen/icon-theme.json');
const zenManifestText = readFileSync(zenManifestPath, 'utf8');

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

function createFileEntry(path: string): FileEntry {
  const normalizedPath = normalizePath(path);
  const segments = normalizedPath.split('/').filter(Boolean);
  const name = segments[segments.length - 1] ?? normalizedPath;
  return {
    name,
    path: normalizedPath,
    is_dir: false,
    extension: name.includes('.') ? name.split('.').pop() ?? '' : '',
    modified: 0,
  };
}

function mockFilesystem(options: {
  textFiles?: Record<string, string>;
  base64Files?: Record<string, string>;
  archiveOutputs?: Record<string, { outputPath: string; extractedEntryCount: number; reusedCachedOutput: boolean }>;
}): void {
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    const path = normalizePath((args as { path?: string } | undefined)?.path);
    const requestPath = normalizePath((args as { request?: { archivePath?: string } } | undefined)?.request?.archivePath);
    const archivePath = command === 'fs_open_archive' ? path : requestPath;

    if (command === 'fs_read_text_file') {
      if (Object.prototype.hasOwnProperty.call(options.textFiles ?? {}, path)) {
        return options.textFiles?.[path];
      }
      throw new Error(`ENOENT: ${path}`);
    }

    if (command === 'fs_read_file_base64') {
      if (Object.prototype.hasOwnProperty.call(options.base64Files ?? {}, path)) {
        return options.base64Files?.[path];
      }
      if (path.startsWith('icon-themes/Zen/')) {
        return 'PHN2Zy8+';
      }
      throw new Error(`ENOENT: ${path}`);
    }

    if (command === 'fs_open_archive' || command === 'fs_extract_archive') {
      if (Object.prototype.hasOwnProperty.call(options.archiveOutputs ?? {}, archivePath)) {
        return options.archiveOutputs?.[archivePath];
      }
      throw new Error(`ENOENT: ${archivePath}`);
    }

    throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
  });
}

describe('icon theme package loader', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('loads the Zen icon pack as a first-class managed icon theme package', async () => {
    mockFilesystem({
      textFiles: {
        'icon-themes/Zen/icon-theme.json': zenManifestText,
      },
      base64Files: {
        'icon-themes/Zen/icons/folder.svg': 'PHN2Zy8+',
        'icon-themes/Zen/icons/folder-open.svg': 'PHN2Zy8+',
        'icon-themes/Zen/icons/txt.svg': 'PHN2Zy8+',
        'icon-themes/Zen/icons/typescript.svg': 'PHN2Zy8+',
        'icon-themes/Zen/icons/panel-storage.svg': 'PHN2Zy8+',
        'icon-themes/Zen/icons/panel-drawable-canvas.svg': 'PHN2Zy8+',
        'icon-themes/Zen/icons/panel-sketchfab.svg': 'PHN2Zy8+',
      },
    });

    const result = await loadIconThemePackagesFromDirectoryEntries([
      createDirectoryEntry('icon-themes/Zen'),
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
    expect(zenPackage?.iconTheme.uiIcons.panel_storage).toBe('panel_storage');
    expect(zenPackage?.iconTheme.uiIcons.panel_drawable_canvas).toBe('panel_drawable_canvas');
    expect(zenPackage?.iconTheme.uiIcons.panel_sketchfab).toBe('panel_sketchfab');
  });

  it('loads VS Code extension folders with font-backed icons', async () => {
    mockFilesystem({
      textFiles: {
        'icon-themes/seti-folder/package.json': JSON.stringify({
          name: 'theme-seti',
          publisher: 'vscode',
          displayName: 'Seti Folder',
          description: 'VS Code icon theme import',
          version: '10.2.0',
          contributes: {
            iconThemes: [
              {
                id: 'vs-seti',
                label: 'Seti',
                path: './icons/vs-seti-icon-theme.json',
              },
            ],
          },
        }),
        'icon-themes/seti-folder/icons/vs-seti-icon-theme.json': JSON.stringify({
          file: '_file',
          folder: '_folder',
          folderExpanded: '_folder_open',
          fonts: [
            {
              id: 'seti',
              src: [{ path: './seti.woff', format: 'woff' }],
              size: '150%',
            },
          ],
          iconDefinitions: {
            _file: { fontCharacter: '\\E001', fontColor: '#519aba', fontId: 'seti' },
            _folder: { fontCharacter: '\\E002', fontColor: '#cbcb41', fontId: 'seti' },
            _folder_open: { fontCharacter: '\\E003', fontColor: '#e37933', fontId: 'seti' },
            typescript: { iconPath: './typescript.svg' },
          },
          fileExtensions: {
            ts: 'typescript',
          },
        }),
      },
      base64Files: {
        'icon-themes/seti-folder/icons/seti.woff': 'Rk9OVA==',
        'icon-themes/seti-folder/icons/typescript.svg': 'PHN2Zy8+',
      },
    });

    const result = await loadIconThemePackagesFromDirectoryEntries([
      createDirectoryEntry('icon-themes/seti-folder'),
    ], 'icon-themes');

    const setiPackage = result.packages.find(pkg => pkg.id === 'vscode-vscode-theme-seti-vs-seti');
    expect(setiPackage?.sourceKind).toBe('vscode-icon-theme-directory');
    expect(setiPackage?.sourceInfo?.source).toBe('folder');
    expect(setiPackage?.iconTheme.file).toBe('_file');
    expect(setiPackage?.iconTheme.folder).toBe('_folder');
    expect(setiPackage?.iconTheme.fileExtensions.ts).toBe('typescript');
    expect(setiPackage?.iconTheme.iconDefinitions._file).toMatch(/^data:image\/svg\+xml/);
    expect(setiPackage?.iconTheme.iconDefinitions.typescript).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(setiPackage?.warnings).toEqual([]);
  });

  it('loads VS Code .vsix icon themes from cached extraction and reports missing assets as warnings', async () => {
    mockFilesystem({
      archiveOutputs: {
        'icon-themes/imported-icons.vsix': {
          outputPath: '/cache/vscode-icons',
          extractedEntryCount: 12,
          reusedCachedOutput: true,
        },
      },
      textFiles: {
        '/cache/vscode-icons/extension/package.json': JSON.stringify({
          name: 'vsix-icons',
          publisher: 'greeble',
          displayName: 'Imported Icons',
          version: '2.0.0',
          contributes: {
            iconThemes: [
              {
                id: 'imported-icons',
                label: 'Imported Icons',
                path: './icons/theme.json',
              },
            ],
          },
        }),
        '/cache/vscode-icons/extension/icons/theme.json': JSON.stringify({
          file: 'missing',
          folder: 'folder',
          folderExpanded: 'folder_open',
          iconDefinitions: {
            missing: { iconPath: './missing.svg' },
            folder: { iconPath: './folder.svg' },
            folder_open: { iconPath: './folder-open.svg' },
          },
        }),
      },
      base64Files: {
        '/cache/vscode-icons/extension/icons/folder.svg': 'PHN2Zy8+',
        '/cache/vscode-icons/extension/icons/folder-open.svg': 'PHN2Zy8+',
      },
    });

    const result = await loadIconThemePackagesFromDirectoryEntries([
      createFileEntry('icon-themes/imported-icons.vsix'),
    ], 'icon-themes');

    const importedPackage = result.packages.find(pkg => pkg.id === 'vscode-greeble-vsix-icons-imported-icons');
    expect(importedPackage?.sourceKind).toBe('vscode-icon-theme-vsix');
    expect(importedPackage?.sourceInfo?.source).toBe('vsix');
    expect(importedPackage?.sourceInfo?.cachedExtractionPath).toBe('/cache/vscode-icons');
    expect(importedPackage?.warnings.join(' ')).toMatch(/missing\.svg/);
    expect(importedPackage?.iconTheme.iconDefinitions.folder).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('resolves mixed-case persisted package ids against normalized package ids', async () => {
    mockFilesystem({
      textFiles: {
        'icon-themes/Zen/icon-theme.json': zenManifestText,
      },
      base64Files: {
        'icon-themes/Zen/icons/folder.svg': 'PHN2Zy8+',
      },
    });

    const result = await loadIconThemePackagesFromDirectoryEntries([
      createDirectoryEntry('icon-themes/Zen'),
    ], 'icon-themes');

    expect(resolveLoadedIconThemePackage(result.packages, ' Zen ')?.id).toBe('zen');
    expect(resolveLoadedIconThemePackage(result.packages, 'ZEN')?.id).toBe('zen');
  });
});
