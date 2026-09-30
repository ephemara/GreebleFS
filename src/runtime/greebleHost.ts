/**
 * greebleHost — the ONE host-owned extension backend for the whole app.
 *
 * The API contract (`src/api/*`) says the host owns a single domain book, a
 * single event spine, a single bus, and a persistence store — then mints one
 * harness per extension. This module is that host. Both runtime transpiler
 * maps (`pluginRuntime`, `themeRendererRuntime`) resolve the `greeblefs`
 * virtual module against these singletons, so registrations from ANY lane
 * land in the same registries the UI reads.
 */

import { GreebleDomainBookImpl } from '../api/registry';
import {
  GreebleEventSpineImpl,
  GreebleExtensionBusImpl,
} from '../api/events';
import type { GreebleEntryStore } from '../api/host';

class GreebleMemoryEntryStore implements GreebleEntryStore {
  private readonly store = new Map<string, unknown>();

  get<T = unknown>(extensionId: string, key: string): T | undefined {
    return this.store.get(`${extensionId}:${key}`) as T | undefined;
  }

  set<T = unknown>(extensionId: string, key: string, value: T): void {
    this.store.set(`${extensionId}:${key}`, value);
  }
}

let domainBook: GreebleDomainBookImpl | null = null;
let eventSpine: GreebleEventSpineImpl | null = null;
let extensionBus: GreebleExtensionBusImpl | null = null;
let entryStore: GreebleMemoryEntryStore | null = null;

/** Shared registry book — every `fs.register*` in the app writes here. */
export function getGreebleDomainBook(): GreebleDomainBookImpl {
  if (!domainBook) {
    domainBook = new GreebleDomainBookImpl();
  }
  return domainBook;
}

/** Shared lifecycle spine (`fs.on` / `fs.emit`). */
export function getGreebleEventSpine(): GreebleEventSpineImpl {
  if (!eventSpine) {
    eventSpine = new GreebleEventSpineImpl();
  }
  return eventSpine;
}

/** Shared inter-extension bus (`fs.events`). */
export function getGreebleExtensionBus(): GreebleExtensionBusImpl {
  if (!extensionBus) {
    extensionBus = new GreebleExtensionBusImpl();
  }
  return extensionBus;
}

/** Crash-safe scratch backing (`fs.appendEntry` / `fs.getEntry`). */
export function getGreebleEntryStore(): GreebleEntryStore {
  if (!entryStore) {
    entryStore = new GreebleMemoryEntryStore();
  }
  return entryStore;
}

/**
 * Test-only reset. Unit tests that publish into the shared book must call
 * this in beforeEach/afterEach so registrations never leak between tests.
 */
export function resetGreebleHostForTests(): void {
  domainBook = null;
  eventSpine = null;
  extensionBus = null;
  entryStore = null;
}
