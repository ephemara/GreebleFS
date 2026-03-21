import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  createBuiltInOverlayShaders,
  loadShaderFromSource,
  mergeOverlayShaders,
} from '../components/shaderRuntime';

describe('shaderRuntime', () => {
  it('exposes the built-in shader catalog', () => {
    const builtIns = createBuiltInOverlayShaders();

    expect(builtIns.length).toBeGreaterThan(0);
    expect(builtIns.some(shader => shader.id === 'none')).toBe(true);
    expect(builtIns.some(shader => shader.id === 'nebula-flow')).toBe(true);
  });

  it('loads a custom shader module from source', async () => {
    const loaded = await loadShaderFromSource(
      `
        import React from 'react';
        import { defineShader } from 'overlayterm-shader';

        function Halo() {
          return React.createElement('div', null, 'halo');
        }

        export default defineShader({
          name: 'Halo Wash',
          description: 'A tiny custom shader profile.',
          background: {
            render: Halo,
          },
          border: {
            resolveStyle: context => ({
              border: '1px solid ' + context.accentColor,
            }),
          },
        });
      `,
      {
        name: 'halo-wash.tsx',
        path: 'shaders/halo-wash.tsx',
        is_dir: false,
        modified: 77,
        extension: 'tsx',
      },
    );

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Halo Wash');
    expect(loaded.group).toBe('Custom');
    expect(loaded.background).toBeTruthy();
    expect(loaded.border).toBeTruthy();
  });

  it('loads every bundled shader module from disk', async () => {
    const shaderDirectory = resolve('shaders');
    const entries = await readdir(shaderDirectory, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && /\.(tsx|ts|jsx|js)$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(files.length).toBeGreaterThanOrEqual(3);

    for (const file of files) {
      const fullPath = resolve(shaderDirectory, file.name);
      const source = await readFile(fullPath, 'utf8');
      const loaded = await loadShaderFromSource(source, {
        name: file.name,
        path: fullPath,
        is_dir: false,
        modified: 101,
        extension: file.name.split('.').pop() ?? 'tsx',
      });

      expect(loaded.error).toBeNull();
      expect(loaded.name).toBeTruthy();
      expect(loaded.background || loaded.topBar || loaded.border).toBeTruthy();
    }
  });

  it('keeps built-ins available when a custom shader fails to load', () => {
    const merged = mergeOverlayShaders(createBuiltInOverlayShaders(), [
      {
        id: 'broken-shader',
        name: 'Broken Shader',
        filePath: 'shaders/broken-shader.tsx',
        shaderRoot: 'shaders',
        source: 'folder',
        modified: 1,
        description: undefined,
        group: 'Custom',
        tags: [],
        resolveSharedUniforms: undefined,
        background: null,
        topBar: null,
        border: null,
        error: 'bad shader',
      },
    ]);

    expect(merged.some(shader => shader.id === 'none')).toBe(true);
    expect(merged.some(shader => shader.id === 'broken-shader')).toBe(false);
  });
});
