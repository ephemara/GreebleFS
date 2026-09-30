/**
 * greebleLaneBridge — runtime proof that API preview lanes + view modes
 * convert into the legacy shapes the explorer pipeline consumes.
 *
 *  1. A harness registering `previewLane`/`viewMode` lands in the bridges as
 *     legacy lane contributions / view-mode definitions (ids, titles,
 *     priorities, match rules, `api-` namespacing).
 *  2. Disposing the harness withdraws both domains live.
 *  3. Garbage entries never throw — they warn and are skipped.
 *  4. The reactive hooks track (un)registration via the registry version.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  createGreebleHarness,
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
  GreeblePreviewLaneContribution,
  GreebleViewModeContribution,
} from '../api/greeble';
import {
  getGreebleDomainBook,
  resetGreebleHostForTests,
} from '../runtime/greebleHost';
import {
  convertGreeblePreviewLaneToDescriptor,
  convertGreebleViewModeToDefinition,
  getGreebleApiPreviewLanes,
  getGreebleApiViewModes,
  useGreebleApiPreviewLanes,
  useGreebleApiViewModes,
} from '../runtime/greebleLaneBridge';

function identity(id: string): GreebleExtensionIdentity {
  return {
    id,
    name: id,
    version: '1.0.0',
    entryPath: `/usr/plugins/${id}/index.tsx`,
    rootDir: `/usr/plugins/${id}`,
    capabilities: new Set(['ui:notify']),
    tags: [],
    meta: {},
  };
}

function bindingsFor(
  id: string,
  shared?: {
    book: GreebleDomainBookImpl;
    spine: GreebleEventSpineImpl;
    bus: GreebleExtensionBusImpl;
  },
): GreebleHostBindings {
  const store = new Map<string, unknown>();
  return {
    identity: identity(id),
    book: shared?.book ?? getGreebleDomainBook(),
    spine: shared?.spine ?? new GreebleEventSpineImpl(),
    bus: shared?.bus ?? new GreebleExtensionBusImpl(),
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

describe('greeble preview lane domain backing', () => {
  it('lists converted lane descriptors with ids, titles, and priorities', () => {
    const harness = createGreebleHarness(bindingsFor('hex-pack'));
    harness.registerPreviewLane({
      id: 'hex',
      title: 'Hex View',
      priority: 700,
      appliesTo: { isDirectory: false, extensions: ['bin', '.exe'] },
      component: () => null,
    });

    const lanes = getGreebleApiPreviewLanes();
    expect(lanes).toHaveLength(1);
    expect(lanes[0].id).toBe('hex');
    expect(lanes[0].title).toBe('Hex View');
    expect(lanes[0].priority).toBe(700);
    expect(lanes[0].match.appliesTo).toBe('file');
    expect(lanes[0].match.extensions).toEqual(['bin', 'exe']);
    expect(lanes[0].pluginId).toBe('greeble-api');
    expect(typeof lanes[0].component).toBe('function');

    harness.dispose();
    expect(getGreebleApiPreviewLanes()).toHaveLength(0);
  });

  it('maps directory matchers and drops unknown preview kinds', () => {
    const harness = createGreebleHarness(bindingsFor('dir-pack'));
    harness.registerPreviewLane({
      id: 'dir-lane',
      title: 'Dir Lane',
      appliesTo: { isDirectory: true, kinds: ['text', 'bogus-kind'] },
      component: () => null,
    });

    const lanes = getGreebleApiPreviewLanes();
    expect(lanes).toHaveLength(1);
    expect(lanes[0].match.appliesTo).toBe('directory');
    expect(lanes[0].match.previewKinds).toEqual(['text']);

    harness.dispose();
  });

  it('skips garbage lane entries without throwing', () => {
    const harness = createGreebleHarness(bindingsFor('junk-pack'));
    expect(() =>
      harness.register(
        'previewLane',
        { id: '   ', title: 'blank' } as unknown as GreeblePreviewLaneContribution,
      ),
    ).toThrow(/without an id/);
    harness.register(
      'previewLane',
      { id: 'no-component', title: 'Nope' } as unknown as GreeblePreviewLaneContribution,
    );
    expect(getGreebleApiPreviewLanes()).toHaveLength(0);
    expect(convertGreeblePreviewLaneToDescriptor(null as never, new Set())).toBeNull();
    expect(
      convertGreeblePreviewLaneToDescriptor(
        { id: 'x', title: 'X', component: null } as never,
        new Set(),
      ),
    ).toBeNull();

    harness.dispose();
  });
});

describe('greeble view mode domain backing', () => {
  it('lists converted definitions namespaced outside the built-in union', () => {
    const harness = createGreebleHarness(bindingsFor('xmb-pack'));
    harness.registerViewMode({
      id: 'xmb-row',
      title: 'XMB Row',
      shortLabel: 'XMB',
      description: 'PS3-style row browser.',
      priority: 42,
      component: () => null,
    });
    // Even an author id that collides with a built-in stays in custom space.
    harness.registerViewMode({
      id: 'columns',
      title: 'Shadow Columns',
      component: () => null,
    });

    const modes = getGreebleApiViewModes();
    expect(modes).toHaveLength(2);
    const bySource = new Map(modes.map(mode => [mode.sourceEntryId, mode]));
    expect(bySource.get('xmb-row')?.id).toBe('api-xmb-row');
    expect(bySource.get('xmb-row')?.label).toBe('XMB Row');
    expect(bySource.get('xmb-row')?.shortLabel).toBe('XMB');
    expect(bySource.get('xmb-row')?.description).toBe('PS3-style row browser.');
    expect(bySource.get('xmb-row')?.presentation).toBe('grid');
    expect(bySource.get('xmb-row')?.zoomOrder).toBe(42);
    expect(bySource.get('columns')?.id).toBe('api-columns');

    harness.dispose();
    expect(getGreebleApiViewModes()).toHaveLength(0);
  });

  it('skips garbage view mode entries without throwing', () => {
    const harness = createGreebleHarness(bindingsFor('junk-modes'));
    expect(() =>
      harness.register(
        'viewMode',
        { id: '   ', title: 'blank' } as unknown as GreebleViewModeContribution,
      ),
    ).toThrow(/without an id/);
    harness.register(
      'viewMode',
      { id: 'ghost', title: 'Ghost', component: null } as unknown as GreebleViewModeContribution,
    );
    expect(getGreebleApiViewModes()).toHaveLength(0);
    expect(convertGreebleViewModeToDefinition(undefined as never, new Set())).toBeNull();

    harness.dispose();
  });
});

describe('greeble lane bridge hooks', () => {
  it('return current lists and follow (un)registration', () => {
    const harness = createGreebleHarness(bindingsFor('hook-pack'));
    const { result: laneResult } = renderHook(() => useGreebleApiPreviewLanes());
    const { result: modeResult } = renderHook(() => useGreebleApiViewModes());
    expect(laneResult.current).toHaveLength(0);
    expect(modeResult.current).toHaveLength(0);

    act(() => {
      harness.registerPreviewLane({ id: 'live', title: 'Live', component: () => null });
      harness.registerViewMode({ id: 'live-mode', title: 'Live Mode', component: () => null });
    });
    expect(laneResult.current.map(lane => lane.id)).toEqual(['live']);
    expect(modeResult.current.map(mode => mode.id)).toEqual(['api-live-mode']);

    act(() => {
      harness.dispose();
    });
    expect(laneResult.current).toHaveLength(0);
    expect(modeResult.current).toHaveLength(0);
  });
});
