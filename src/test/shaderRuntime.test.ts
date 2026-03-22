import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  createBuiltInOverlayShaders,
  loadShaderFromSource,
  mergeOverlayShaders,
  resolveShaderControlValues,
  resolveShaderSharedUniforms,
} from '../components/shaderRuntime';
import { resolveOverlayAppearance } from '../config/appearance';

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
          controls: [
            {
              id: 'glow',
              label: 'Glow',
              min: 0,
              max: 1,
              step: 0.1,
              defaultValue: 0.4,
            },
          ],
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
    expect(loaded.controls).toHaveLength(1);
    expect(loaded.background).toBeTruthy();
    expect(loaded.border).toBeTruthy();
  });

  it('merges persisted shader controls into shared uniforms', () => {
    const shader = createBuiltInOverlayShaders()[1];
    const appearance = resolveOverlayAppearance({ activeThemeId: 'operator' });
    const shellContext = {
      id: shader.id,
      name: shader.name,
      filePath: shader.filePath,
      shaderRoot: shader.shaderRoot,
      source: shader.source,
      viewport: { width: 1440, height: 900 },
      accentColor: '#6366f1',
      theme: appearance.theme,
      panelTransparency: 0.2,
      blurStrength: 16,
      zoom: 1,
      isSettingsActive: true,
      shaderControlValues: { accentAlpha: 0.55 },
    };

    expect(resolveShaderControlValues(shader, shellContext.shaderControlValues).accentAlpha).toBe(0.56);
    expect(resolveShaderSharedUniforms(shader, shellContext).accentAlpha).toBe(0.56);
  });

  it('loads every bundled shader module from disk', async () => {
    const shaderDirectory = resolve('shaders');
    const entries = await readdir(shaderDirectory, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && /\.(tsx|ts|jsx|js)$/i.test(entry.name))
      .filter(entry => entry.name !== 'raymarch-fracture-field.tsx')
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(files.length).toBeGreaterThanOrEqual(25);

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
        controls: [],
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
