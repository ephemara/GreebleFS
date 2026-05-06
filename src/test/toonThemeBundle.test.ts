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
const bundleRelativeRoot = 'usr/themes/toon';
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

      if (/\.(json|tsx|ts|svg)$/i.test(child.path)) {
        textFiles[child.path] = readFileSync(childAbsolutePath, 'utf8');
      }
    }
  };

  visit(directoryAbsolutePath);
  return { directories, textFiles };
}

describe('toon theme bundle', () => {
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

    const toon = result.packages[0];
    expect(toon.id).toBe('toon');
    expect(toon.topBars?.map(topBar => topBar.localId)).toEqual(['toon-marquee', 'toon-ribbon']);
    expect(toon.localCatalogs?.appearancePacks).toHaveLength(1);
    expect(toon.localCatalogs?.themeRecipePacks).toHaveLength(1);
    expect(toon.localCatalogs?.themeEnginePacks).toHaveLength(1);
    expect(toon.localCatalogs?.interactionMotionPacks).toHaveLength(1);
    expect(toon.localCatalogs?.shellRenderers).toHaveLength(1);
    expect(toon.localCatalogs?.iconThemePackages).toHaveLength(1);
    expect(toon.localCatalogs?.wallpapers).toHaveLength(1);
    expect(toon.localCatalogs?.soundPacks).toHaveLength(1);
    expect(toon.localCatalogs?.homePacks).toHaveLength(1);
    expect(toon.localCatalogs?.menuPacks?.some(pack => pack.id === 'toon:toon-bubble-menu')).toBe(true);
    expect(toon.localCatalogs?.explorerLayouts).toHaveLength(3);
    expect(toon.localCatalogs?.shaders).toHaveLength(1);
    expect(toon.localCatalogs?.animations).toHaveLength(1);

    expect(toon.theme.defaultTopBarId).toBe('toon:toon-marquee');
    expect(toon.theme.defaultExplorerLayoutId).toBe('toon:storybook');
    expect(toon.theme.defaultHomePackId).toBe('toon:toon-clubhouse');
    expect(toon.theme.defaultMenuPackId).toBe('toon:toon-bubble-menu');
    expect(toon.theme.defaultSoundPackId).toBe('toon:toon-squeaks');
    expect(toon.theme.defaultShaderId).toBe('toon:toon-sky-confetti');
    expect(toon.theme.defaultOpenAnimationId).toBe('toon:toon-pop');
    expect(toon.theme.defaultCloseAnimationId).toBe('toon:toon-pop');
    expect(toon.theme.assets?.iconTheme?.id).toBe('toon:toon-icons');
    expect(toon.theme.themeRenderer?.name).toBe('Toon Studio Shell');
    expect(toon.theme.themeRenderer?.fallbackRuntime).toBe('channel-launcher');
    expect(toon.theme.themeRenderer?.component).not.toBeNull();
    expect(toon.theme.assets?.backgroundUrl ?? '').toMatch(/^data:image\/svg\+xml;base64,/);

    expect(toon.theme.workbench?.brandLabel).toBe('Toon Studio');
    expect(toon.theme.explorer?.railBrandLabel).toBe('Storyboard');
    expect(toon.capabilitySummary).toMatchObject({
      icons: true,
      wallpaper: true,
      shaders: 1,
      animations: 1,
      themeRenderer: true,
      topBars: 2,
    });

    expect(result.shaders.find(shader => shader.id === 'toon:toon-sky-confetti')?.error).toBeNull();
    expect(result.animations.find(animation => animation.id === 'toon:toon-pop')?.error).toBeNull();
  });
});
