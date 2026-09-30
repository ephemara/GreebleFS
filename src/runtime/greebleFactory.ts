/**
 * greebleFactory — the `*.greeble.tsx` convention: API-native extension modules.
 *
 * A factory module default-exports a function marked with
 * `defineGreebleExtension` (sets `isGreebleExtensionFactory`). Loaders that
 * find one run it through a per-owner harness instead of the legacy
 * normalize path:
 *
 *   import { defineGreebleExtension } from 'greeblefs';
 *   export default defineGreebleExtension((fs) => {
 *     fs.registerTheme({ id: 'xmb', title: 'XMB', tokens: {...} });
 *   });
 *
 * Owners are tracked for the watcher loop: `reloadGreebleFactoryOwner`
 * disposes the old harness and re-runs the stored source (hot reload).
 */

import React from 'react';
import {
  GREEBLE_API_VERSION,
  GREEBLE_API_VERSION_STRING,
  GREEBLE_RUNTIME_MODULE,
  type GreebleCapability,
  type GreebleExtensionFactory,
  type GreebleExtensionIdentity,
  type GreebleHarness,
} from '../api/greeble';
import { runGreebleExtension } from '../api/host';
import {
  executeRuntimeModuleGraph,
  transpileRuntimeModuleGraph,
  unwrapRuntimeModuleExport,
  type RuntimeRelativeModuleSourceResolver,
} from './moduleRuntime';
import {
  getGreebleDomainBook,
  getGreebleEntryStore,
  getGreebleEventSpine,
  getGreebleExtensionBus,
} from './greebleHost';
import { buildGreebleContext } from './greebleContext';

/** Marker checked by loaders to route modules to the harness path. */
export const GREEBLE_FACTORY_MARKER = 'isGreebleExtensionFactory' as const;

/** Author-facing helper: marks a factory for the harness path. */
export function defineGreebleExtension<T extends GreebleExtensionFactory>(factory: T): T {
  (factory as unknown as Record<string, unknown>)[GREEBLE_FACTORY_MARKER] = true;
  return factory;
}

export function isGreebleExtensionFactory(value: unknown): value is GreebleExtensionFactory {
  return (
    typeof value === 'function' &&
    (value as unknown as Record<string, unknown>)[GREEBLE_FACTORY_MARKER] === true
  );
}

/** Local-safe default grant for manifest-less factory modules. */
export const DEFAULT_GREEBLE_FACTORY_CAPABILITIES: readonly GreebleCapability[] = [
  'fs:read',
  'fs:write',
  'fs:watch',
  'index:query',
  'shell:panel',
  'shell:chrome',
  'ui:overlay',
  'ui:notify',
  'storage:read',
  'storage:write',
  'settings:write',
  'theme:override',
];

export interface GreebleFactoryIdentityOptions {
  id: string;
  name?: string;
  version?: string;
  entryPath?: string;
  rootDir?: string;
  capabilities?: Iterable<GreebleCapability>;
}

export function buildGreebleFactoryIdentity(
  options: GreebleFactoryIdentityOptions,
): GreebleExtensionIdentity {
  return {
    id: options.id,
    name: options.name ?? options.id,
    version: options.version ?? '1.0.0',
    entryPath: options.entryPath ?? options.id,
    rootDir: options.rootDir ?? options.id,
    capabilities: new Set(options.capabilities ?? DEFAULT_GREEBLE_FACTORY_CAPABILITIES),
    tags: ['greeble-factory'],
    meta: {},
  };
}

export interface GreebleFactoryLoadOptions extends GreebleFactoryIdentityOptions {
  resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver;
  extraModules?: Record<string, unknown>;
}

function greebleFactoryModuleMap(extraModules: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...extraModules,
    react: React,
    [GREEBLE_RUNTIME_MODULE]: {
      GREEBLE_API_VERSION,
      GREEBLE_API_VERSION_STRING,
      GREEBLE_RUNTIME_MODULE,
      defineGreebleExtension,
    },
  };
}

/**
 * Execute source and return the default export IFF it is a marked factory.
 * Returns null for legacy modules (callers proceed down the old path).
 */
export async function loadGreebleFactoryFromSource(
  source: string,
  entryPath: string,
  options?: { resolveRelativeModuleSource?: RuntimeRelativeModuleSourceResolver; extraModules?: Record<string, unknown> },
): Promise<GreebleExtensionFactory | null> {
  const graph = await transpileRuntimeModuleGraph({
    entryModulePath: entryPath,
    entrySource: source,
    prependCode: 'const React = require(\'react\');\n',
    resolveRelativeModuleSource: options?.resolveRelativeModuleSource,
  });
  const exported = unwrapRuntimeModuleExport(
    executeRuntimeModuleGraph(graph, greebleFactoryModuleMap(options?.extraModules)),
  );
  return isGreebleExtensionFactory(exported) ? exported : null;
}

interface TrackedFactoryOwner {
  source: string;
  entryPath: string;
  options: GreebleFactoryLoadOptions;
  harness: GreebleHarness | null;
}

const trackedOwners = new Map<string, TrackedFactoryOwner>();

/** Currently factory-run owners (watcher loop consults this). */
export function getGreebleFactoryOwners(): string[] {
  return [...trackedOwners.keys()];
}

/**
 * Dispose any previous harness for the owner, run the factory fresh, and
 * remember the source for watcher reloads. Idempotent per owner.
 */
export async function runGreebleFactoryOwner(
  source: string,
  entryPath: string,
  options: GreebleFactoryLoadOptions,
): Promise<GreebleHarness> {
  const previous = trackedOwners.get(options.id);
  if (previous?.harness) {
    try {
      previous.harness.dispose();
    } catch (error) {
      console.warn(`GreebleFS: dispose failed for factory "${options.id}"`, error);
    }
  }
  const identity = buildGreebleFactoryIdentity(options);
  const harness = await runGreebleExtension(
    // The factory was already validated by loadGreebleFactoryFromSource or
    // passed directly; re-execute from source so reloads pick up edits.
    (await loadGreebleFactoryFromSource(source, entryPath, options)) ??
      (async () => {
        throw new Error(
          `GreebleFS: "${entryPath}" is not a marked factory module (missing defineGreebleExtension).`,
        );
      }),
    {
      identity,
      book: getGreebleDomainBook(),
      spine: getGreebleEventSpine(),
      bus: getGreebleExtensionBus(),
      entries: getGreebleEntryStore(),
      buildContext: () =>
        buildGreebleContext(identity, {
          bus: getGreebleExtensionBus(),
          entries: getGreebleEntryStore(),
        }),
    },
  );
  trackedOwners.set(options.id, { source, entryPath, options, harness });
  return harness;
}

/** Forget an owner without running (unload path). */
export function forgetGreebleFactoryOwner(ownerId: string): void {
  const tracked = trackedOwners.get(ownerId);
  if (tracked?.harness) {
    try {
      tracked.harness.dispose();
    } catch {
      // Unload is best-effort; the book sweep in dispose covers leftovers.
    }
  }
  trackedOwners.delete(ownerId);
}

/** Re-run a tracked owner from its stored source (watcher hot reload). */
export async function reloadGreebleFactoryOwner(ownerId: string): Promise<boolean> {
  const tracked = trackedOwners.get(ownerId);
  if (!tracked) return false;
  await runGreebleFactoryOwner(tracked.source, tracked.entryPath, tracked.options);
  return true;
}

/**
 * Re-run every tracked owner whose entry lives under root (watcher).
 * Source is re-read from disk so edits land; stored source is the fallback
 * (tests, unreachable files).
 */
export async function reloadAllGreebleFactoryOwnersUnderRoot(root: string): Promise<string[]> {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const reloaded: string[] = [];
  for (const [ownerId, tracked] of trackedOwners) {
    const entry = tracked.entryPath.replace(/\\/g, '/').toLowerCase();
    if (!entry.startsWith(normalizedRoot)) continue;
    let source = tracked.source;
    try {
      const { commands, unwrapTauriResult } = await import('./tauriClient');
      source = await commands.fsReadTextFile(tracked.entryPath).then(unwrapTauriResult);
    } catch {
      // Disk unreachable (tests, virtual roots) — re-run stored source.
    }
    try {
      await runGreebleFactoryOwner(source, tracked.entryPath, tracked.options);
      reloaded.push(ownerId);
    } catch (error) {
      console.warn(`GreebleFS: hot reload failed for factory "${ownerId}"`, error);
    }
  }
  return reloaded;
}

/** Test-only reset for the owner registry (pair with resetGreebleHostForTests). */
export function resetGreebleFactoryOwnersForTests(): void {
  for (const ownerId of trackedOwners.keys()) {
    forgetGreebleFactoryOwner(ownerId);
  }
}
