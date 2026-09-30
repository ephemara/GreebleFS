/**
 * GreebleFS Extension API — contract tests.
 *
 * These tests are the executable specification for the API's core promises:
 *   1. registration verbs write into typed registries
 *   2. the event spine observes, patches, and blocks
 *   3. hot reload replaces contributions cleanly
 *   4. dispose() fully unwinds an extension
 *   5. the API is EXPANDABLE — new domains, events, and capabilities are added
 *      by declaration merging WITHOUT touching the implementation
 */

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import {
  createGreebleDomainBook,
  createGreebleHarness,
  GreebleDomainBookImpl,
  GreebleEventSpineImpl,
  GreebleExtensionBusImpl,
  type GreebleContext,
  type GreebleContribution,
  type GreebleExtensionIdentity,
  type GreebleHarness,
  type GreebleViewModeContribution,
} from '../api';

// ─────────────────────────────────────────────────────────────────────────────
//  EXPANSION UNDER TEST — declaration merging.
//
//  This block proves the API is open-ended. We add a brand-new domain, a
//  brand-new event, and a brand-new capability WITHOUT editing src/api/*.
// ─────────────────────────────────────────────────────────────────────────────

interface GreebleVisualizerContribution extends GreebleContribution {
  readonly title: string;
  readonly paint: (frame: number) => ReactNode;
}

declare module '../api/greeble' {
  interface GreebleDomainCatalog {
    visualizer: GreebleVisualizerContribution;
  }
  interface GreebleEventMap {
    'xmb:beat': { readonly track: string; readonly bpm: number };
  }
  interface GreebleContext {
    readonly xmb: { readonly track: string };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function identity(overrides: Partial<GreebleExtensionIdentity> = {}): GreebleExtensionIdentity {
  return {
    id: 'test-ext',
    name: 'Test Extension',
    version: '1.0.0',
    entryPath: '/usr/plugins/test-ext/index.tsx',
    rootDir: '/usr/plugins/test-ext',
    capabilities: new Set(['fs:read', 'ui:notify']),
    tags: ['test'],
    meta: {},
    ...overrides,
  };
}

function makeContext(id: string): GreebleContext {
  return {
    extension: identity({ id }),
    signal: undefined,
    hasUI: true,
    xmb: { track: 'sandstorm' },
  } as unknown as GreebleContext;
}

function bindings(book: GreebleDomainBookImpl, spine: GreebleEventSpineImpl, bus: GreebleExtensionBusImpl) {
  return {
    identity: identity(),
    book,
    spine,
    bus,
    entries: (() => {
      const store = new Map<string, unknown>();
      return {
        get: <T,>(extId: string, key: string) => store.get(`${extId}:${key}`) as T | undefined,
        set: <T,>(extId: string, key: string, value: T) => {
          store.set(`${extId}:${key}`, value);
        },
      };
    })(),
    buildContext: () => makeContext('test-ext'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('GreebleFS Extension API — registration', () => {
  it('registers typed contributions into the right domain', () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();
    const fs = createGreebleHarness(bindings(book, spine, bus));

    const view: GreebleViewModeContribution = {
      id: 'xmb-row',
      title: 'XMB Row',
      component: () => null,
    };
    const handle = fs.registerViewMode(view);

    expect(handle.domain).toBe('viewMode');
    expect(handle.owner).toBe('test-ext');

    const registry = book.get<GreebleViewModeContribution>('viewMode');
    expect(registry?.list().map(entry => entry.id)).toEqual(['xmb-row']);
  });

  it('exposes the same registration through the generic escape hatch for UNKNOWN domains', () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();
    const fs = createGreebleHarness(bindings(book, spine, bus));

    // `visualizer` does not exist in the shipped implementation. It only exists
    // because of the declaration merge above. This is the expandability proof.
    const handle = fs.register('visualizer', {
      id: 'spectrum',
      title: 'Spectrum',
      paint: () => null,
    } satisfies GreebleVisualizerContribution);

    expect(handle.domain).toBe('visualizer');
    expect(book.domains()).toContain('visualizer');
  });

  it('bumps registry version and notifies subscribers on mutation', () => {
    const book = createGreebleDomainBook();
    const registry = book.define<GreebleViewModeContribution>('viewMode', {
      order: entry => entry.priority ?? 0,
    });

    const snapshots: string[][] = [];
    registry.subscribe(list => snapshots.push(list.map(entry => entry.id)));

    const before = registry.version();
    registry.register({ id: 'a', title: 'A', component: () => null }, 'owner');
    registry.register({ id: 'b', title: 'B', component: () => null, priority: -1 }, 'owner');

    expect(registry.version()).toBeGreaterThan(before);
    // ordered by priority: b(-1) before a(0)
    expect(registry.list().map(entry => entry.id)).toEqual(['b', 'a']);
    expect(snapshots[snapshots.length - 1]).toEqual(['b', 'a']);
  });

  it('replaces a contribution when the same id is re-registered (hot reload)', () => {
    const book = createGreebleDomainBook();
    const disposed: string[] = [];
    const registry = book.define<GreebleViewModeContribution>('viewMode', {
      onDispose: entry => disposed.push(entry.id),
    });

    registry.register({ id: 'x', title: 'v1', component: () => null }, 'owner');
    registry.register({ id: 'x', title: 'v2', component: () => null }, 'owner');

    expect(registry.list()).toHaveLength(1);
    expect(registry.get('x')?.title).toBe('v2');
    expect(disposed).toContain('x');
  });
});

describe('GreebleFS Extension API — event spine', () => {
  it('observes, patches, and blocks in priority order', async () => {
    const spine = new GreebleEventSpineImpl();
    const ctx = makeContext('test-ext');
    const order: string[] = [];

    spine.on('file:before-open', () => {
      order.push('low');
    }, { priority: 0 });

    spine.on('file:before-open', (event) => {
      order.push('high');
      return { patch: { size: event.size + 1 } };
    }, { priority: 10 });

    const emission = await spine.emit('file:before-open', {
      path: '/a.txt',
      name: 'a.txt',
      extension: 'txt',
      size: 10,
      isDirectory: false,
      source: 'explorer',
    }, ctx);

    expect(order).toEqual(['high', 'low']);
    expect(emission.payload.size).toBe(11);
    expect(emission.blocked).toBe(false);
  });

  it('blocks and short-circuits later handlers', async () => {
    const spine = new GreebleEventSpineImpl();
    const ctx = makeContext('test-ext');
    const ran: string[] = [];

    spine.on('file:before-open', () => {
      ran.push('blocker');
      return { block: true, reason: 'too big' };
    }, { priority: 5 });

    spine.on('file:before-open', () => {
      ran.push('never');
    }, { priority: 0 });

    const emission = await spine.emit('file:before-open', {
      path: '/huge.iso',
      name: 'huge.iso',
      extension: 'iso',
      size: 1e12,
      isDirectory: false,
      source: 'explorer',
    }, ctx);

    expect(emission.blocked).toBe(true);
    expect(emission.reason).toBe('too big');
    expect(ran).toEqual(['blocker']);
  });

  it('supports augmented events from other subsystems', async () => {
    const spine = new GreebleEventSpineImpl();
    const ctx = makeContext('xmb');
    let seen = '';

    spine.on('xmb:beat', event => {
      seen = `${event.track}@${event.bpm}`;
    });

    await spine.emit('xmb:beat', { track: 'sandstorm', bpm: 136 }, ctx);
    expect(seen).toBe('sandstorm@136');
  });
});

describe('GreebleFS Extension API — inter-extension bus', () => {
  it('routes namespaced channels between extensions', () => {
    const bus = new GreebleExtensionBusImpl();
    bus.bindContext(() => makeContext('xmb'));

    let received: unknown = null;
    bus.on('workbench-pdf:rendered', payload => {
      received = payload;
    });

    bus.emit('workbench-pdf:rendered', { pages: 12 });
    expect(received).toEqual({ pages: 12 });
    expect(bus.channels()).toContain('workbench-pdf:rendered');
  });

  it('rejects non-namespaced channels', () => {
    const bus = new GreebleExtensionBusImpl();
    expect(() => bus.on('loose', () => {})).toThrow(/namespaced/);
  });
});

describe('GreebleFS Extension API — lifecycle', () => {
  it('dispose() unwinds every contribution an extension registered', () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();
    const fs = createGreebleHarness(bindings(book, spine, bus));

    fs.registerViewMode({ id: 'a', title: 'A', component: () => null });
    fs.register('visualizer', { id: 'v', title: 'V', paint: () => null } satisfies GreebleVisualizerContribution);
    fs.on('file:before-open', () => {});

    expect(book.get('viewMode')?.list()).toHaveLength(1);
    expect(spine.handlersFor('file:before-open')).toBe(1);

    fs.dispose();

    expect(book.get('viewMode')?.list()).toHaveLength(0);
    expect(spine.handlersFor('file:before-open')).toBe(0);
  });

  it('refuses registration after dispose', () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();
    const fs = createGreebleHarness(bindings(book, spine, bus));

    fs.dispose();
    expect(() => fs.registerViewMode({ id: 'x', title: 'X', component: () => null })).toThrow(
      /after dispose/,
    );
  });

  it('persists entries per extension', () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();
    const fs = createGreebleHarness(bindings(book, spine, bus));

    fs.appendEntry('last-focus', '/home/user/docs');
    expect(fs.getEntry('last-focus')).toBe('/home/user/docs');
    expect(fs.getEntry('missing', 'fallback')).toBe('fallback');
  });

  it('reports granted capabilities', () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();
    const fs = createGreebleHarness(bindings(book, spine, bus));

    expect(fs.can('fs:read')).toBe(true);
    expect(fs.can('fs:write')).toBe(false);
  });
});

describe('GreebleFS Extension API — factory entry point', () => {
  it('runs an extension factory with a live harness (the pi model)', async () => {
    const book = createGreebleDomainBook();
    const spine = new GreebleEventSpineImpl();
    const bus = new GreebleExtensionBusImpl();

    const factory = (fs: GreebleHarness) => {
      fs.registerCommand({
        id: 'xmb-next',
        title: 'Next',
        run: () => 'moved',
      });
      fs.on('explorer:directory-changed', () => {});
    };

    const { runGreebleExtension } = await import('../api/host');
    const harness = await runGreebleExtension(factory, bindings(book, spine, bus));

    expect(book.get('command')?.list().map(entry => entry.id)).toEqual(['xmb-next']);
    expect(spine.handlersFor('explorer:directory-changed')).toBe(1);
    harness.dispose();
  });
});
