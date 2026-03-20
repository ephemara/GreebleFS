import { readFile } from 'fs/promises';
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

  it('loads the bundled vortex swirl animation module from disk', async () => {
    const source = await readFile(resolve('animations/vortex-swirl.tsx'), 'utf8');
    const loaded = await loadAnimationFromSource(source, {
      name: 'vortex-swirl.tsx',
      path: resolve('animations/vortex-swirl.tsx'),
      is_dir: false,
      modified: 101,
      extension: 'tsx',
    });

    expect(loaded.error).toBeNull();
    expect(loaded.name).toBe('Vortex Swirl');
    expect(loaded.open).toBeTruthy();
    expect(loaded.close).toBeTruthy();
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
