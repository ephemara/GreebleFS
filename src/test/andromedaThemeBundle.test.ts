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

import { invoke } from '@tauri-apps/api/core';

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
const bundleRelativeRoot = 'usr/themes/andromeda';
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

      if (/\.(json|tsx|ts)$/i.test(child.path)) {
        textFiles[child.path] = readFileSync(childAbsolutePath, 'utf8');
      }
    }
  };

  visit(directoryAbsolutePath);
  return { directories, textFiles };
}

describe('andromeda theme bundle', () => {
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

    const andromeda = result.packages[0];
    expect(andromeda.id).toBe('andromeda');
    expect(andromeda.topBars?.map(topBar => topBar.localId)).toEqual(['stellar-bridge']);
    expect(andromeda.localCatalogs?.appearancePacks).toHaveLength(0);
    expect(andromeda.localCatalogs?.themeRecipePacks).toHaveLength(0);
    expect(andromeda.localCatalogs?.themeEnginePacks).toHaveLength(0);
    expect(andromeda.localCatalogs?.interactionMotionPacks).toHaveLength(0);
    expect(andromeda.localCatalogs?.iconThemePackages).toHaveLength(1);
    expect(andromeda.localCatalogs?.wallpapers).toHaveLength(1);

    expect(andromeda.theme.defaultTopBarId).toBe('andromeda:stellar-bridge');
    expect(andromeda.theme.defaultShaderId).toBe('andromeda:andromeda-drift');
    expect(andromeda.theme.defaultOpenAnimationId).toBe('andromeda:andromeda-gate');
    expect(andromeda.theme.defaultCloseAnimationId).toBe('andromeda:andromeda-gate');
    expect(andromeda.theme.assets?.iconTheme?.id).toBe('andromeda:andromeda-icons');
    expect(andromeda.localCatalogs?.wallpapers[0]?.assetUrl ?? '').toMatch(/^data:image\/svg\+xml;base64,/);
    expect(andromeda.theme.assets?.backgroundUrl ?? '').toMatch(/^data:image\/svg\+xml;base64,/);
    expect(andromeda.theme.workbench?.brandLabel).toBe('GreebleFS');
    expect(andromeda.capabilitySummary).toMatchObject({
      icons: true,
      wallpaper: true,
      shaders: 1,
      animations: 1,
      themeRenderer: false,
      topBars: 1,
    });

    expect(result.shaders.find(shader => shader.id === 'andromeda:andromeda-drift')?.error).toBeNull();
    expect(result.animations.find(animation => animation.id === 'andromeda:andromeda-gate')?.error).toBeNull();
  });
});
