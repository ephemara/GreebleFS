/**
 * greebleThemeBridge — runtime proof that API themes are real.
 *
 * Covers the exact gaps the user called out ("we hadn't tested the api"):
 *  1. A harness registering `theme` lands in the bridge as a renderable
 *     definition (tokens -> CSS vars, palette override, extends fallback).
 *  2. TSX importing 'greeblefs' executes through the REAL theme-renderer
 *     loader map (import-map wiring proof).
 *  3. Disposing the harness withdraws the theme live.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  createGreebleHarness,
  runGreebleExtension,
  type GreebleHostBindings,
} from '../api/host';
import { GreebleDomainBookImpl } from '../api/registry';
import {
  GreebleEventSpineImpl,
  GreebleExtensionBusImpl,
} from '../api/events';
import type {
  GreebleContext,
  GreebleExtensionIdentity,
} from '../api/greeble';
import {
  getGreebleDomainBook,
  resetGreebleHostForTests,
} from '../runtime/greebleHost';
import {
  getGreebleApiThemeDefinitions,
  resolveGreebleApiThemeDefinition,
} from '../runtime/greebleThemeBridge';
import { loadThemeRendererFromSource } from '../components/themeRendererRuntime';

function identity(id: string): GreebleExtensionIdentity {
  return {
    id,
    name: id,
    version: '1.0.0',
    entryPath: `/usr/plugins/${id}/index.tsx`,
    rootDir: `/usr/plugins/${id}`,
    capabilities: new Set(['ui:notify', 'theme:override']),
    tags: [],
    meta: {},
  };
}

function bindingsFor(
  id: string,
  shared: {
    book: GreebleDomainBookImpl;
    spine: GreebleEventSpineImpl;
    bus: GreebleExtensionBusImpl;
  },
): GreebleHostBindings {
  const store = new Map<string, unknown>();
  return {
    identity: identity(id),
    book: shared.book,
    spine: shared.spine,
    bus: shared.bus,
    entries: {
      get: <T,>(extId: string, key: string) =>
        store.get(`${extId}:${key}`) as T | undefined,
      set: <T,>(extId: string, key: string, value: T) => {
        store.set(`${extId}:${key}`, value);
      },
    },
    buildContext: () =>
      ({ extension: identity(id) }) as unknown as GreebleContext,
  };
}

afterEach(() => {
  resetGreebleHostForTests();
});

describe('greeble theme domain backing', () => {
  it('converts a registered theme into a renderable definition', () => {
    const book = getGreebleDomainBook();
    const harness = createGreebleHarness(
      bindingsFor('xmb', {
        book,
        spine: new GreebleEventSpineImpl(),
        bus: new GreebleExtensionBusImpl(),
      }),
    );
    harness.registerTheme({
      id: 'xmb-ps3',
      title: 'XMB',
      description: 'PS3 cross-media bar look.',
      extends: 'github-dark',
      tokens: {
        accent: '#ff0040',
        '--xmb-wave-speed': '1.4',
        appBackground: '#0a0a12',
      },
    });

    const defs = getGreebleApiThemeDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].id).toBe('xmb-ps3');
    expect(defs[0].name).toBe('XMB');
    // Palette override for known fields…
    expect(defs[0].palette.accent).toBe('#ff0040');
    expect(defs[0].palette.appBackground).toBe('#0a0a12');
    // …verbatim CSS var for `--` keys, namespaced var otherwise.
    expect(defs[0].cssVars?.['--xmb-wave-speed']).toBe('1.4');
    expect(defs[0].cssVars?.['--greeble-theme-accent']).toBe('#ff0040');
    // Unknown `extends` falls back to the first built-in preset.
    expect(defs[0].extendsThemeId).toBe('github-dark');
    expect(resolveGreebleApiThemeDefinition('xmb-ps3')?.id).toBe('xmb-ps3');

    harness.dispose();
    expect(getGreebleApiThemeDefinitions()).toHaveLength(0);
  });

  it('runs an extension factory against the shared host book', async () => {
    const shared = {
      book: getGreebleDomainBook(),
      spine: new GreebleEventSpineImpl(),
      bus: new GreebleExtensionBusImpl(),
    };
    const harness = await runGreebleExtension(
      fs => {
        fs.registerTheme({
          id: 'wii-menu',
          title: 'Wii Menu',
          tokens: { '--wii-cursor': 'pointer' },
        });
      },
      bindingsFor('wii', shared),
    );
    expect(
      getGreebleApiThemeDefinitions().map(def => def.id),
    ).toContain('wii-menu');
    harness.dispose();
    expect(getGreebleApiThemeDefinitions()).toHaveLength(0);
  });

  it('executes TSX importing greeblefs through the real theme loader map', async () => {
    const loaded = await loadThemeRendererFromSource(
      `
        import { GREEBLE_API_VERSION, GREEBLE_RUNTIME_MODULE } from 'greeblefs';
        import { defineThemeRenderer } from 'overlayterm-theme-renderer';

        if (GREEBLE_RUNTIME_MODULE !== 'greeblefs') {
          throw new Error('greeblefs module identity broken');
        }

        export default defineThemeRenderer({
          name: 'API Shell',
          apiVersion: GREEBLE_API_VERSION,
          component() {
            return null;
          },
        });
      `,
      {
        name: 'api-shell.tsx',
        path: '/themes/api/renderers/api-shell.tsx',
        is_dir: false,
        extension: 'tsx',
        modified: 1,
      },
    );
    expect(loaded.error).toBeNull();
    expect(loaded.apiVersion).toBe(1);
    expect(typeof loaded.component).toBe('function');
  });
});
