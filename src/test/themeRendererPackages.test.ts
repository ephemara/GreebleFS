import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
  {
    name: 'vector-monolith',
    filePath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/vector-monolith/renderers/vector-monolith.tsx',
    sourceAssertionPath: '/home/ephemara/Dev/Apps-2D/GreebleFS/themes/vector-monolith/renderers/monolith/modes/app-shell.tsx',
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
  'vector-monolith': { launcher: true, chrome: true, contentFrame: true, pinnedPanels: true, wallpaper: true },
  'wii-channel-home': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
  'xmb-crosswave': { launcher: true, chrome: true, contentFrame: true, wallpaper: true },
} satisfies Record<string, Partial<Awaited<ReturnType<typeof loadThemeRendererFromSource>>['surfaceOwnership']>>;

const utilitySurfaceContractRendererNames = new Set([
  'arcade-arcology',
  'arcade-atrium',
  'clarity-line',
  'cyber-nexus-hud',
  'dreamcast-skyline',
  'gamecube-helix',
  'gamecube-orbital',
  'gamecube-prism',
  'vector-monolith',
  'wii-channel-home',
  'xmb-crosswave',
]);

const launcherShellModelRendererNames = new Set([
  'arcade-arcology',
  'arcade-atrium',
  'cyber-nexus-hud',
  'dreamcast-skyline',
  'gamecube-helix',
  'gamecube-orbital',
  'gamecube-prism',
  'vector-monolith',
  'wii-channel-home',
  'xmb-crosswave',
]);

const relativeModuleExtensions = ['.tsx', '.ts', '.jsx', '.js'];

function createFilesystemRelativeModuleSourceResolver() {
  return async ({ fromModulePath, specifier }: { fromModulePath: string; specifier: string }) => {
    const resolvedBasePath = resolve(dirname(fromModulePath), specifier);
    const candidatePaths = /[.][^./]+$/.test(resolvedBasePath)
      ? [resolvedBasePath]
      : [
          ...relativeModuleExtensions.map(extension => `${resolvedBasePath}${extension}`),
          ...relativeModuleExtensions.map(extension => resolve(resolvedBasePath, `index${extension}`)),
        ];

    for (const candidatePath of candidatePaths) {
      if (existsSync(candidatePath)) {
        return {
          modulePath: candidatePath,
          source: readFileSync(candidatePath, 'utf8'),
        };
      }
    }

    return null;
  };
}

const filesystemRelativeModuleSourceResolver = createFilesystemRelativeModuleSourceResolver();

describe('theme renderer package fixtures', () => {
  it.each(rendererFixtures)('loads %s without runtime errors', async fixture => {
    const entrySource = readFileSync(fixture.filePath, 'utf8');
    const renderer = await loadThemeRendererFromSource(entrySource, {
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
      resolveRelativeModuleSource: filesystemRelativeModuleSourceResolver,
    });

    expect(renderer.error).toBeNull();
    expect(typeof renderer.component).toBe('function');

    const expectedSurfaceOwnership = expectedSurfaceOwnershipByTheme[fixture.name];
    if (expectedSurfaceOwnership) {
      expect(renderer.surfaceOwnership).toMatchObject(expectedSurfaceOwnership);
    }

    const sourceAssertionFilePath = fixture.sourceAssertionPath ?? fixture.filePath;
    const assertionSource = readFileSync(sourceAssertionFilePath, 'utf8');

    if (utilitySurfaceContractRendererNames.has(fixture.name)) {
      expect(assertionSource).not.toContain('host.panels');
      expect(assertionSource).not.toContain('renderChromeBar(');
      expect(assertionSource).toContain('host.renderUtilityActionsSurface()');
    }

    if (launcherShellModelRendererNames.has(fixture.name)) {
      expect(assertionSource).toContain('host.shellModel.launcher');
    }
  });
});
