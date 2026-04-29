import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';
import { createPluginIndexApi } from '../runtime/pluginIndexApi';

describe('pluginIndexApi', () => {
  it('finds pictures through the structured global index query', async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => {
      if (command !== 'global_search_query_index') {
        throw new Error(`Unexpected invoke call: ${command}`);
      }

      const request = (args as { request: unknown }).request as {
        extensions: string[];
        includeFiles: boolean;
        includeDirectories: boolean;
        limit: number;
        rootPaths: string[];
        sortKey: string;
      };
      expect(request.extensions).toContain('jpg');
      expect(request.extensions).toContain('png');
      expect(request.includeFiles).toBe(true);
      expect(request.includeDirectories).toBe(false);
      expect(request.limit).toBe(2);
      expect(request.rootPaths).toEqual(['C:/Pictures']);
      expect(request.sortKey).toBe('modifiedTime');

      return [
        {
          name: 'photo.jpg',
          extension: 'jpg',
          path: 'C:/Pictures/photo.jpg',
          size: 128,
          modifiedTime: 12,
          accessedTime: 0,
          createdTime: 0,
          isFile: true,
          isDir: false,
          isSymlink: false,
          isHidden: false,
          score: 1,
        },
      ];
    });

    const pictures = await createPluginIndexApi().media.findPictures({
      limit: 2,
      rootPaths: ['C:/Pictures'],
    });

    expect(pictures).toHaveLength(1);
    expect(pictures[0]).toMatchObject({
      mediaKind: 'picture',
      path: 'C:/Pictures/photo.jpg',
      assetUrl: 'asset://localhost/C:/Pictures/photo.jpg',
    });
  });
});
