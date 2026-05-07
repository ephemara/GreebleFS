import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, relative, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>('@tauri-apps/api/core');
  return {
    ...actual,
    invoke: invokeMock,
    isTauri: vi.fn(() => true),
  };
});

import {
  createEmptyGlobalThemeBundleCatalogs,
  loadThemePackagesFromDirectoryEntries,
} from '../config/themePackages';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
}

const projectRoot = process.cwd();
const bundleRelativeRoot = 'usr/themes/doors';
const bundleAbsoluteRoot = resolve(projectRoot, bundleRelativeRoot);

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function createEntry(absolutePath: string): FileEntry {
  const stats = statSync(absolutePath);
  const relativePath = normalizePath(relative(projectRoot, absolutePath));
  const name = basename(absolutePath);
  return {
    name,
    path: relativePath,
    is_dir: stats.isDirectory(),
    extension: stats.isDirectory() ? '' : extname(name).replace(/^\./, ''),
    modified: Math.round(stats.mtimeMs),
  };
}

function buildFixtureMaps(directoryAbsolutePath: string): {
  directories: Record<string, FileEntry[]>;
  textFiles: Record<string, string>;
} {
  const directories: Record<string, FileEntry[]> = {};
  const textFiles: Record<string, string> = {};

  const visit = (currentAbsolutePath: string) => {
    const currentEntry = createEntry(currentAbsolutePath);
    if (!currentEntry.is_dir) {
      return;
    }

    const children = readdirSync(currentAbsolutePath)
      .map(name => createEntry(resolve(currentAbsolutePath, name)))
      .sort((left, right) => left.path.localeCompare(right.path));

    directories[currentEntry.path] = children;

    for (const child of children) {
      const childAbsolutePath = resolve(projectRoot, child.path);
      if (child.is_dir) {
        visit(childAbsolutePath);
        continue;
      }

      if (/\.(json|svg|tsx|ts)$/i.test(child.path)) {
        textFiles[child.path] = readFileSync(childAbsolutePath, 'utf8');
      }
    }
  };

  visit(directoryAbsolutePath);
  return { directories, textFiles };
}

describe('doors theme bundle', () => {
  it('loads the authored repo bundle through the live theme-package loaders', async () => {
    const fixture = buildFixtureMaps(bundleAbsoluteRoot);

    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command, args) => {
      const requestedPath = normalizePath(String((args as { path?: string } | undefined)?.path ?? ''));

      if (command === 'fs_list_dir') {
        const directory = fixture.directories[requestedPath];
        if (directory) {
          return directory;
        }
        throw new Error(`ENOENT: ${requestedPath}`);
      }

      if (command === 'fs_read_text_file') {
        const text = fixture.textFiles[requestedPath];
        if (typeof text === 'string') {
          return text;
        }
        throw new Error(`ENOENT: ${requestedPath}`);
      }

      if (command === 'fs_read_file_base64') {
        const absolutePath = resolve(projectRoot, requestedPath);
        const base64 = readFileSync(absolutePath).toString('base64');
        return `data:image/svg+xml;base64,${base64}`;
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await loadThemePackagesFromDirectoryEntries(
      [createEntry(bundleAbsoluteRoot)],
      'themes',
      { dependencyCatalogs: createEmptyGlobalThemeBundleCatalogs() },
    );

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.packages).toHaveLength(1);

    const doors = result.packages[0];
    expect(doors.id).toBe('doors');
    expect(doors.topBars?.map(topBar => topBar.localId)).toEqual(['doors-frame']);
    expect(doors.localCatalogs?.appearancePacks).toHaveLength(1);
    expect(doors.localCatalogs?.themeRecipePacks).toHaveLength(1);
    expect(doors.localCatalogs?.themeEnginePacks).toHaveLength(1);
    expect(doors.localCatalogs?.interactionMotionPacks).toHaveLength(1);
    expect(doors.localCatalogs?.iconThemePackages).toHaveLength(1);
    expect(doors.localCatalogs?.wallpapers).toHaveLength(2);
    expect(doors.localCatalogs?.explorerLayouts).toHaveLength(1);

    expect(doors.theme.defaultTopBarId).toBe('doors:doors-frame');
    expect(doors.theme.defaultExplorerLayoutId).toBe('doors:doors-inline-preview');
    expect(doors.theme.assets?.iconTheme?.id).toBe('doors:doors-icons');
    expect(doors.theme.assets?.backgroundUrl ?? '').toMatch(/^data:image\/svg\+xml;base64,/);
    expect(doors.theme.assets?.previewUrl ?? '').toMatch(/^(data:image\/svg\+xml;base64,|asset:\/\/|file:\/\/)/);
    expect(doors.theme.engineManifest?.id).toBe('doors:doors-engine');
    expect(doors.theme.workbench?.tabStyle).toBe('windows');
    expect(doors.theme.workbench?.chromeTabs?.style).toBe('windows');
    expect(doors.theme.explorer?.rail?.defaultViewMode).toBe('tree');
    expect(doors.theme.explorer?.workspaceTabs?.style).toBe('windows');
    expect(doors.capabilitySummary).toMatchObject({
      icons: true,
      wallpaper: true,
      topBars: 1,
    });
  });
});
