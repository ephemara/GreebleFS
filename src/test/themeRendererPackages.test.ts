import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadThemeRendererFromSource } from '../components/themeRendererRuntime';

const rendererFixtures = [
  {
    name: 'arcade-atrium',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/arcade-atrium/renderers/arcade-atrium-shell.tsx',
  },
  {
    name: 'arcade-arcology',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/arcade-arcology/renderers/arcade-arcology.tsx',
  },
  {
    name: 'clarity-line',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/clarity-line/renderers/clarity-line-shell.tsx',
  },
  {
    name: 'celestial-astrolabe',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/celestial-astrolabe/renderers/astrolabe.tsx',
  },
  {
    name: 'cyber-nexus-hud',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/cyber-nexus-hud/renderers/cyber-nexus.tsx',
  },
  {
    name: 'xmb-crosswave',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/xmb-crosswave/renderers/xmb-crosswave.tsx',
  },
  {
    name: 'wii-channel-home',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/wii-channel-home/renderers/wii-channel-home.tsx',
  },
  {
    name: 'gamecube-orbital',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/gamecube-orbital/renderers/gamecube-orbital.tsx',
  },
  {
    name: 'gamecube-prism',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/gamecube-prism/renderers/gamecube-prism.tsx',
  },
  {
    name: 'gamecube-helix',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/gamecube-helix/renderers/gamecube-helix.tsx',
  },
  {
    name: 'dreamcast-skyline',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/dreamcast-skyline/renderers/dreamcast-skyline.tsx',
  },
];

const expectedSurfaceOwnershipByTheme = {
  'arcade-arcology': { chrome: true, contentFrame: true, wallpaper: true },
  'arcade-atrium': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'celestial-astrolabe': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'cyber-nexus-hud': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'dreamcast-skyline': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'gamecube-helix': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'gamecube-orbital': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'gamecube-prism': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'wii-channel-home': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'xmb-crosswave': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
} satisfies Record<string, Partial<Awaited<ReturnType<typeof loadThemeRendererFromSource>>['surfaceOwnership']>>;

describe('theme renderer package fixtures', () => {
  it.each(rendererFixtures)('loads %s without runtime errors', async fixture => {
    const source = readFileSync(fixture.filePath, 'utf8');
    const renderer = await loadThemeRendererFromSource(source, {
      name: fixture.filePath.split('/').pop() ?? `${fixture.name}.tsx`,
      path: fixture.filePath,
      is_dir: false,
      extension: 'tsx',
      modified: 1,
    }, {
      context: {
        id: `${fixture.name}-renderer`,
        name: fixture.name,
        filePath: fixture.filePath,
        rendererRoot: fixture.filePath.replace(/\/renderers\/[^/]+$/, ''),
        entryModule: fixture.filePath.split('/renderers/')[1] ?? '',
      },
    });

    expect(renderer.error).toBeNull();
    expect(typeof renderer.component).toBe('function');

    const expectedSurfaceOwnership = expectedSurfaceOwnershipByTheme[fixture.name];
    if (expectedSurfaceOwnership) {
      expect(renderer.surfaceOwnership).toMatchObject(expectedSurfaceOwnership);
    }
  });
});
