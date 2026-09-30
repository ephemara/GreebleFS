/**
 * GreebleFS Extension API — registry primitive.
 *
 * ONE implementation powers every domain. Adding a new registration domain
 * never touches this file: call `GreebleDomainBook.define(domain)` and you have
 * a live registry the harness can register into.
 *
 * Design:
 *  - entries are keyed by `id`, unique within a domain
 *  - `version()` is monotonic and bumps on every mutation (drives re-render)
 *  - `subscribe()` notifies on mutation; returns a disposable handle
 *  - registering an id that exists REPLACES it and notifies (hot reload)
 *  - owners are tracked so an extension can be fully unwound on unload
 */

import type {
  GreebleContribution,
  GreebleDomain,
  GreebleDomainBook,
  GreebleHandle,
  GreebleRegistry,
  GreebleRegistryListener,
  GreebleRegistryOptions,
} from './greeble';

/** Allocates the shared, monotonic handle sequence. */
let handleSequence = 0;

function createHandle(
  id: string,
  domain: string,
  owner: string,
  dispose: () => void,
): GreebleHandle {
  let disposed = false;
  return {
    id,
    domain,
    owner,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      dispose();
    },
  };
}

interface RegistryEntry<T extends GreebleContribution> {
  readonly entry: T;
  readonly owner: string;
  readonly order: number;
}

/**
 * Default registry implementation. Host-owned; extensions only receive handles
 * from the harness.
 */
export class GreebleRegistryImpl<T extends GreebleContribution>
  implements GreebleRegistry<T>
{
  readonly domain: string;

  private readonly entries = new Map<string, RegistryEntry<T>>();
  private readonly listeners = new Set<GreebleRegistryListener<T>>();
  private readonly options: GreebleRegistryOptions<T>;
  private currentVersion = 0;

  constructor(domain: string, options: GreebleRegistryOptions<T> = {}) {
    this.domain = domain;
    this.options = options;
  }

  register(entry: T, owner: string): GreebleHandle {
    const id = normalizeContributionId(entry.id);

    if (!id) {
      throw new Error(
        `GreebleFS extension API: cannot register a "${this.domain}" contribution without an id.`,
      );
    }

    const previous = this.entries.get(id);
    if (previous) {
      this.options.onDispose?.(previous.entry);
    }

    const registered: RegistryEntry<T> = {
      entry: { ...entry, id },
      owner,
      order: this.options.order?.(entry) ?? 0,
    };
    this.entries.set(id, registered);
    this.notify();

    return createHandle(id, this.domain, owner, () => {
      // Only remove if this exact registration is still the live one — a later
      // replacement must not be torn down by an earlier handle's dispose().
      const current = this.entries.get(id);
      if (current === registered) {
        this.entries.delete(id);
        this.options.onDispose?.(registered.entry);
        this.notify();
      }
    });
  }

  unregister(id: string): boolean {
    const normalized = normalizeContributionId(id);
    const existing = this.entries.get(normalized);
    if (!existing) {
      return false;
    }
    this.entries.delete(normalized);
    this.options.onDispose?.(existing.entry);
    this.notify();
    return true;
  }

  get(id: string): T | undefined {
    return this.entries.get(normalizeContributionId(id))?.entry;
  }

  has(id: string): boolean {
    return this.entries.has(normalizeContributionId(id));
  }

  list(): readonly T[] {
    const values = Array.from(this.entries.values());
    if (this.options.order) {
      values.sort((a, b) => a.order - b.order);
    }
    return values.map(entry => entry.entry);
  }

  owners(): readonly string[] {
    const owners = new Set<string>();
    for (const entry of this.entries.values()) {
      owners.add(entry.owner);
    }
    return Array.from(owners);
  }

  /** Remove every contribution owned by `owner`. Returns removed count. */
  unregisterOwner(owner: string): number {
    let removed = 0;
    for (const [id, entry] of Array.from(this.entries.entries())) {
      if (entry.owner === owner) {
        this.entries.delete(id);
        this.options.onDispose?.(entry.entry);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.notify();
    }
    return removed;
  }

  version(): number {
    return this.currentVersion;
  }

  subscribe(listener: GreebleRegistryListener<T>): GreebleHandle {
    this.listeners.add(listener);
    const owner = `listener:${this.domain}:${++handleSequence}`;
    return createHandle('listener', this.domain, owner, () => {
      this.listeners.delete(listener);
    });
  }

  private notify(): void {
    this.currentVersion += 1;
    if (this.listeners.size === 0) {
      return;
    }
    const snapshot = this.list();
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(snapshot);
      } catch (error) {
        // A misbehaving listener must never break a registration.
        console.error(
          `GreebleFS extension API: listener for domain "${this.domain}" threw.`,
          error,
        );
      }
    }
  }
}

/**
 * The collection of every registry. `define()` is create-or-get, so any
 * subsystem — or future GreebleFS core module — can mint a new registration
 * domain at runtime without editing the API.
 */
export class GreebleDomainBookImpl implements GreebleDomainBook {
  private readonly registries = new Map<string, GreebleRegistryImpl<GreebleContribution>>();

  get<T extends GreebleContribution>(domain: string): GreebleRegistry<T> | undefined {
    return this.registries.get(normalizeDomain(domain)) as
      | GreebleRegistry<T>
      | undefined;
  }

  define<T extends GreebleContribution>(
    domain: string,
    options: GreebleRegistryOptions<T> = {},
  ): GreebleRegistry<T> {
    const key = normalizeDomain(domain);
    const existing = this.registries.get(key);
    if (existing) {
      return existing as unknown as GreebleRegistry<T>;
    }
    const registry = new GreebleRegistryImpl<GreebleContribution>(
      key,
      options as GreebleRegistryOptions<GreebleContribution>,
    );
    this.registries.set(key, registry);
    return registry as unknown as GreebleRegistry<T>;
  }

  domains(): readonly string[] {
    return Array.from(this.registries.keys());
  }

  /** Remove every contribution owned by `owner` across all domains. */
  unregisterOwner(owner: string): number {
    let removed = 0;
    for (const registry of this.registries.values()) {
      removed += registry.unregisterOwner(owner);
    }
    return removed;
  }
}

/** Domains are exact (case-sensitive) after trimming. Authors use camelCase. */
export function normalizeDomain(domain: string): string {
  return domain.trim();
}

/** Contribution ids are trimmed; empty ids are rejected at registration. */
export function normalizeContributionId(id: string): string {
  return typeof id === 'string' ? id.trim() : '';
}

/** Type guard: is this a known domain key on the catalog? (best-effort) */
export function isGreebleDomain(value: string): value is GreebleDomain {
  return typeof value === 'string' && value.trim().length > 0;
}
