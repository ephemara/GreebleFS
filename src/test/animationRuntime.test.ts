import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  createBuiltInOverlayAnimations,
  loadAnimationFromSource,
  mergeOverlayAnimations,
} from '../components/animationRuntime';

describe('animationRuntime', () => {
  it('exposes the built-in animation catalog', () => {
    const builtIns = createBuiltInOverlayAnimations();

    expect(builtIns.length).toBeGreaterThan(0);
    expect(builtIns.some(animation => animation.id === 'spring-lift')).toBe(true);
    expect(builtIns.find(animation => animation.id === 'burn')?.close).toBeTruthy();
  });

  it('loads a custom animation module from source', async () => {
    const loaded = await loadAnimationFromSource(
      `
        import React from 'react';
        import { defineAnimation, lerp } from 'overlayterm-animation';

        function GlowLayer() {
          return React.createElement('div', null, 'glow');
        }

        export default defineAnimation({
          name: 'Glow Fold',
          description: 'Folds the shell into view.',
          open: {
            resolveShellStyle: context => ({
              opacity: context.baseOpacity * context.progress,
              transform: 'scale(' + lerp(0.88, 1, context.progress) + ')',
              transition: 'none',
            }),
            renderOverlay: GlowLayer,
          },
          close: {
            resolveShellStyle: context => ({
              opacity: context.baseOpacity * (1 - context.progress),
              transition: 'none',
            }),
          },
        });
      `,
      {
        name: 'glow-fold.tsx',
        path: 'animations/glow-fold.tsx',
        is_dir: false,
        modified: 77,
        extension: 'tsx',
      },
    );

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Glow Fold');
    expect(loaded.group).toBe('Custom');
    expect(loaded.open).toBeTruthy();
    expect(loaded.close).toBeTruthy();
  });

  it('loads every bundled animation module from disk', async () => {
    const animationDirectory = resolve('animations');
    const entries = await readdir(animationDirectory, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile() && /\.(tsx|ts|jsx|js)$/i.test(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name));

    expect(files.length).toBeGreaterThanOrEqual(21);

    for (const file of files) {
      const fullPath = resolve(animationDirectory, file.name);
      const source = await readFile(fullPath, 'utf8');
      const loaded = await loadAnimationFromSource(source, {
        name: file.name,
        path: fullPath,
        is_dir: false,
        modified: 101,
        extension: file.name.split('.').pop() ?? 'tsx',
      });

      expect(loaded.error).toBeNull();
      expect(loaded.name).toBeTruthy();
      expect(loaded.open || loaded.close).toBeTruthy();
    }
  });

  it('keeps built-ins available when a custom module fails to load', () => {
    const merged = mergeOverlayAnimations(createBuiltInOverlayAnimations(), [
      {
        id: 'broken-motion',
        name: 'Broken Motion',
        filePath: 'animations/broken-motion.tsx',
        animationRoot: 'animations',
        source: 'folder',
        modified: 1,
        description: undefined,
        group: 'Custom',
        tags: [],
        open: null,
        close: null,
        error: 'bad animation',
      },
    ]);

    expect(merged.some(animation => animation.id === 'spring-lift')).toBe(true);
    expect(merged.some(animation => animation.id === 'broken-motion')).toBe(false);
  });
});
