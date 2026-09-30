/**
 * greebleLegacyShim — proof that legacy shells surface through the API.
 *
 * Loads the REAL `toon-studio-shell.tsx` pack file through the production
 * theme-renderer loader (fs-backed relative resolver for its `./helpers`
 * import), adopts it into the harness `shell` domain, and verifies it is
 * listed, owned, renderable-typed, and withdrawn on dispose. Errored /
 * componentless renderers must never register.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadThemeRendererFromSource } from '../components/themeRendererRuntime';
import type { GreebleShellContribution } from '../api/greeble';
import {
  adoptLegacyThemeRenderer,
  adoptLoadedShellRendererPacks,
  setLegacyShellHostProvider,
  withdrawLegacyThemeRenderer,
} from '../runtime/greebleLegacyShim';
import {
  getGreebleDomainBook,
  resetGreebleHostForTests,
} from '../runtime/greebleHost';

const PACK_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'usr',
  'themes',
  'toon',
  'shell-renderers',
  'toon-studio-shell',
);

function readPackFile(relativePath: string): string {
  return readFileSync(join(PACK_ROOT, relativePath), 'utf8');
}

afterEach(() => {
  setLegacyShellHostProvider(null);
  resetGreebleHostForTests();
});

describe('legacy shell shim', () => {
  it('adopts the real toon-studio-shell pack file as an API shell', async () => {
    const entryPath = join(PACK_ROOT, 'toon-studio-shell.tsx');
    const source = readPackFile('toon-studio-shell.tsx');
    const loaded = await loadThemeRendererFromSource(
      source,
      {
        name: 'toon-studio-shell.tsx',
        path: entryPath,
        is_dir: false,
        extension: 'tsx',
        modified: 0,
      },
      {
        context: {
          id: 'toon-studio-shell',
          name: 'Toon Studio Shell',
          filePath: entryPath,
          rendererRoot: PACK_ROOT,
          entryModule: 'toon-studio-shell.tsx',
        },
        resolveRelativeModuleSource: async ({ fromModulePath, specifier }) => {
          const base = dirname(fromModulePath);
          for (const candidate of [
            join(base, `${specifier}.ts`),
            join(base, `${specifier}.tsx`),
            join(base, specifier),
          ]) {
            if (existsSync(candidate)) {
              return {
                modulePath: candidate,
                source: readFileSync(candidate, 'utf8'),
              };
            }
          }
          return null;
        },
      },
    );
    expect(loaded.error).toBeNull();
    expect(typeof loaded.component).toBe('function');

    const id = adoptLegacyThemeRenderer({
      packId: 'toon-studio-shell',
      renderer: loaded,
    });
    expect(id).toBe('toon-studio-shell');

    const shells = getGreebleDomainBook().define<GreebleShellContribution>('shell').list();
    expect(shells.map(entry => entry.id)).toContain('toon-studio-shell');
    const adopted = shells.find(entry => entry.id === 'toon-studio-shell')!;
    expect(adopted.title).toBe('Toon Studio Shell');
    expect(typeof adopted.component).toBe('function');

    // Re-adoption is idempotent (registry replaces, never duplicates).
    adoptLegacyThemeRenderer({ packId: 'toon-studio-shell', renderer: loaded });
    expect(
      getGreebleDomainBook()
        .define<GreebleShellContribution>('shell')
        .list()
        .filter(entry => entry.id === 'toon-studio-shell'),
    ).toHaveLength(1);

    expect(withdrawLegacyThemeRenderer('toon-studio-shell')).toBeGreaterThan(0);
    expect(
      getGreebleDomainBook().define<GreebleShellContribution>('shell').list(),
    ).toHaveLength(0);
  });

  it('adopts batches and skips failed renderers', () => {
    const ok = adoptLoadedShellRendererPacks([
      {
        id: 'broken-pack',
        renderer: {
          id: 'broken-pack',
          name: 'broken',
          filePath: 'x',
          rendererRoot: 'x',
          entryModule: 'x',
          apiVersion: 1,
          supportsLiveSwap: false,
          fallbackRuntime: null,
          capabilities: {
            customScreens: false,
            wallpaperScene: false,
            surfaceAdapters: false,
          },
          surfaceOwnership: {
            chrome: false,
            launcher: false,
            contentFrame: false,
            pinnedPanels: false,
            wallpaper: false,
          },
          component: (() => null) as never,
          error: 'boom',
        },
      },
    ]);
    expect(ok).toEqual([]);
    expect(
      getGreebleDomainBook().define<GreebleShellContribution>('shell').list(),
    ).toHaveLength(0);
  });
});
