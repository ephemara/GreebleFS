/**
 * greebleFactory — proof that API-native modules boot end to end:
 *  - marker helpers route factories vs legacy modules,
 *  - TSX importing 'greeblefs' executes and registers a theme,
 *  - the REAL usr/themes/xmb factory file loads and surfaces XMB,
 *  - owner reload re-runs (watcher hot-reload primitive),
 *  - context ships real paths/storage/log and honest unwired stubs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildGreebleContext,
} from '../runtime/greebleContext';
import {
  defineGreebleExtension,
  forgetGreebleFactoryOwner,
  getGreebleFactoryOwners,
  isGreebleExtensionFactory,
  loadGreebleFactoryFromSource,
  reloadGreebleFactoryOwner,
  runGreebleFactoryOwner,
} from '../runtime/greebleFactory';
import {
  getGreebleEntryStore,
  getGreebleExtensionBus,
  resetGreebleHostForTests,
} from '../runtime/greebleHost';
import { getGreebleApiThemeDefinitions } from '../runtime/greebleThemeBridge';
import { resetGreebleFactoryOwnersForTests } from '../runtime/greebleFactory';
import type { GreebleExtensionIdentity } from '../api/greeble';

const HERE = dirname(fileURLToPath(import.meta.url));
const XMB_ENTRY = resolve(HERE, '..', '..', 'usr', 'themes', 'xmb', 'theme.greeble.tsx');

function identity(id: string): GreebleExtensionIdentity {
  return {
    id,
    name: id,
    version: '1.0.0',
    entryPath: `/x/${id}`,
    rootDir: `/x/${id}`,
    capabilities: new Set(['theme:override']),
    tags: [],
    meta: {},
  };
}

afterEach(() => {
  resetGreebleFactoryOwnersForTests();
  resetGreebleHostForTests();
});

describe('greeble factory modules', () => {
  it('marks factories and rejects legacy functions', () => {
    const factory = defineGreebleExtension(() => {});
    expect(isGreebleExtensionFactory(factory)).toBe(true);
    expect(isGreebleExtensionFactory(() => {})).toBe(false);
    expect(isGreebleExtensionFactory({ component: () => null })).toBe(false);
  });

  it('runs inline TSX and surfaces the theme through the bridge', async () => {
    const source = `
      import { defineGreebleExtension } from 'greeblefs';
      export default defineGreebleExtension((fs) => {
        fs.registerTheme({
          id: 'inline-neon',
          title: 'Inline Neon',
          extends: 'github-dark',
          tokens: { accent: '#ff00ff' },
        });
      });
    `;
    const factory = await loadGreebleFactoryFromSource(source, '/inline/neon.tsx');
    expect(factory).not.toBeNull();
    await runGreebleFactoryOwner(source, '/inline/neon.tsx', { id: 'inline-neon' });
    const defs = getGreebleApiThemeDefinitions();
    expect(defs.map(def => def.id)).toContain('inline-neon');
    expect(defs.find(def => def.id === 'inline-neon')?.palette.accent).toBe('#ff00ff');
    // Legacy (unmarked) modules return null — old path proceeds.
    expect(await loadGreebleFactoryFromSource('export default { component: () => null };', '/x.tsx')).toBeNull();
  });

  it('loads the real XMB flagship pack file', async () => {
    const source = readFileSync(XMB_ENTRY, 'utf8');
    await runGreebleFactoryOwner(source, XMB_ENTRY, {
      id: 'xmb',
      name: 'XMB',
      entryPath: XMB_ENTRY,
      rootDir: join(XMB_ENTRY, '..'),
    });
    const defs = getGreebleApiThemeDefinitions();
    const xmb = defs.find(def => def.id === 'xmb');
    expect(xmb).toBeDefined();
    expect(xmb?.name).toBe('XMB');
    expect(xmb?.palette.accent).toBe('#2e9bff');
    expect(xmb?.cssVars?.['--xmb-wave-speed']).toBe('1.4');
    expect(getGreebleFactoryOwners()).toContain('xmb');
  });

  it('reloads owners and forgets on unload', async () => {
    const v1 = `import { defineGreebleExtension } from 'greeblefs';
      export default defineGreebleExtension((fs) => {
        fs.registerTheme({ id: 're', title: 'Re', tokens: { accent: '#111111' } });
      });`;
    await runGreebleFactoryOwner(v1, '/re/t.tsx', { id: 're' });
    expect(getGreebleApiThemeDefinitions().find(def => def.id === 're')?.palette.accent).toBe('#111111');
    expect(await reloadGreebleFactoryOwner('re')).toBe(true);
    expect(await reloadGreebleFactoryOwner('missing')).toBe(false);
    forgetGreebleFactoryOwner('re');
    expect(getGreebleFactoryOwners()).not.toContain('re');
    expect(getGreebleApiThemeDefinitions().find(def => def.id === 're')).toBeUndefined();
  });

  it('builds a context with real paths/storage and honest stubs', async () => {
    const ctx = buildGreebleContext(identity('ctx'), {
      bus: getGreebleExtensionBus(),
      entries: getGreebleEntryStore(),
    });
    expect(ctx.paths.join('a', 'b')).toBe('a/b');
    expect(ctx.paths.extname('photo.png')).toBe('.png');
    await ctx.storage.writeText('note', 'hi');
    await expect(ctx.storage.readText('note')).resolves.toBe('hi');
    expect(() => (ctx.ui as unknown as { notify: () => void }).notify()).toThrow(/not yet wired/);
    expect(() => (ctx.explorer as unknown as { open: () => void }).open()).toThrow(/not yet wired/);
  });
});
