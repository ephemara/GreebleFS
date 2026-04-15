import { readdir, readFile, stat } from 'fs/promises';
import { extname, resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

import { discoverOverlayPlugins } from '../config/pluginPackages';
import { pluginSystemConfig } from '../config/plugins';

type MockFileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  modified: number;
};

function toWorkspacePath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

async function listMockDirectory(relativePath: string): Promise<MockFileEntry[]> {
  const absolutePath = toWorkspacePath(relativePath);
  const directoryEntries = await readdir(absolutePath, { withFileTypes: true });
  const mappedEntries = await Promise.all(directoryEntries.map(async entry => {
    const entryRelativePath = `${relativePath}/${entry.name}`.replace(/\\/g, '/');
    const entryStats = await stat(toWorkspacePath(entryRelativePath));
    return {
      name: entry.name,
      path: entryRelativePath,
      is_dir: entry.isDirectory(),
      extension: entry.isDirectory() ? '' : extname(entry.name).slice(1).toLowerCase(),
      modified: Math.floor(entryStats.mtimeMs),
    };
  }));

  return mappedEntries.sort((left, right) => left.name.localeCompare(right.name));
}

describe('Vibe Capsule package discovery', () => {
  it('loads the packaged plugin entry and theme contribution from disk', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      const normalizedPath = String((args as { path?: string } | undefined)?.path ?? '').replace(/\\/g, '/');

      if (command === 'fs_list_dir' && normalizedPath === pluginSystemConfig.pluginsDirectory) {
        return [{
          name: 'vibe-capsule',
          path: 'plugins/vibe-capsule',
          is_dir: true,
          extension: '',
          modified: 1,
        }];
      }

      if (command === 'fs_list_dir') {
        return listMockDirectory(normalizedPath);
      }

      if (command === 'fs_read_text_file') {
        return readFile(toWorkspacePath(normalizedPath), 'utf8');
      }

      throw new Error(`Unexpected invoke call: ${command} ${JSON.stringify(args)}`);
    });

    const result = await discoverOverlayPlugins(() => ({
      invoke: async <T,>() => null as T,
      event: {} as never,
      window: {} as never,
      fs: {} as never,
      notification: {} as never,
      refreshPlugins: async () => undefined,
      openPluginsFolder: async () => undefined,
      runBackend: async () => ({ stdout: '', stderr: '', status: 0 }),
    }));

    expect(result.warnings).toEqual([]);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]?.id).toBe('vibe-capsule');
    expect(result.plugins[0]?.name).toBe('Vibe Capsule');
    expect(result.plugins[0]?.keepMounted).toBe(true);
    expect(result.plugins[0]?.diagnostics.capabilities.themes).toBe(1);
    expect(result.themePackages).toHaveLength(1);
    expect(result.themePackages[0]?.theme.id).toBe('vibe-capsule-shell');
    expect(result.themePackages[0]?.sourceKind).toBe('plugin-package');
    expect(result.themePackages[0]?.sourceLabel).toBe('Vibe Capsule');
  });
});
