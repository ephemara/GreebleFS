import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadTopBarPackagesFromDirectoryEntries } from '../config/topBarPackages';

describe('top bar packages', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('loads standalone top bars from a dedicated top-bars manifest', async () => {
    vi.mocked(invoke).mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_read_text_file') {
        const payload = args as { path?: string } | undefined;
        if (payload?.path === '/workspace/top-bars/scanner-rack.json') {
          return JSON.stringify({
            id: 'scanner-rack',
            name: 'Scanner Rack',
            description: 'A standalone scan-heavy top bar.',
            topBarStyle: 'glass',
            navigationMode: 'summary',
            leadingControls: ['command-palette', 'panel-menu'],
          });
        }
      }

      throw new Error(`Unexpected invoke: ${command}`);
    });

    const result = await loadTopBarPackagesFromDirectoryEntries(
      [
        {
          name: 'scanner-rack.json',
          path: '/workspace/top-bars/scanner-rack.json',
          is_dir: false,
          extension: 'json',
          modified: 1710000000,
        },
      ],
      '/workspace/top-bars',
    );

    expect(result.sourceError).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.id).toBe('scanner-rack');
    expect(result.packages[0]?.topBars).toHaveLength(1);
    expect(result.packages[0]?.topBars[0]).toMatchObject({
      id: 'scanner-rack:scanner-rack',
      source: 'top-bar-package',
      sourceLabel: 'Scanner Rack',
      navigationMode: 'summary',
    });
  });
});
