/**
 * greebleContext — builds the capability bag handed to extension factories.
 *
 * `buildContext` is lazy by contract: cheap pure capabilities are real from
 * the start (paths, storage scratch, log, events), while host-bound lanes
 * (ui, explorer, fs, index, settings, shell) are honest stubs that throw a
 * "not yet wired" error ONLY if called. Registration (the load-time path)
 * never touches them, so factories boot while deeper wiring lands slice by
 * slice.
 */

import type {
  GreebleContext,
  GreebleExtensionIdentity,
  GreebleFileSystemCapability,
  GreebleExplorerCapability,
  GreebleIndexCapability,
  GreebleLogCapability,
  GreeblePathCapability,
  GreebleSettingsCapability,
  GreebleShellCapability,
  GreebleStorageCapability,
  GreebleUICapability,
} from '../api/greeble';
import type { GreebleExtensionBus } from '../api/events';
import type { GreebleEntryStore } from '../api/host';

function unwired<T>(capability: string): T {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === '__greebleUnwiredCapability') return capability;
        throw new Error(
          `GreebleFS: "${capability}" context is not yet wired — registration works, host calls do not (yet).`,
        );
      },
      apply() {
        throw new Error(
          `GreebleFS: "${capability}" context is not yet wired — registration works, host calls do not (yet).`,
        );
      },
    },
  ) as unknown as T;
}

function buildPathCapability(identity: GreebleExtensionIdentity): GreeblePathCapability {
  const join = (...segments: string[]): string =>
    segments
      .join('/')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/');
  const dirname = (path: string): string => {
    const normalized = path.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? (index === 0 ? '/' : '.') : normalized.slice(0, index);
  };
  const basename = (path: string, suffix = ''): string => {
    const normalized = path.replace(/\\/g, '/');
    const base = normalized.slice(normalized.lastIndexOf('/') + 1);
    return suffix && base.endsWith(suffix) ? base.slice(0, -suffix.length) : base;
  };
  return {
    cwd: identity.rootDir,
    roots: [identity.rootDir],
    resolve: (...segments: string[]) => join(identity.rootDir, ...segments),
    dirname,
    basename,
    extname: (path: string) => {
      const base = basename(path);
      const index = base.lastIndexOf('.');
      return index <= 0 ? '' : base.slice(index);
    },
    join,
    relative: (from: string, to: string) => {
      if (to.startsWith(from)) return to.slice(from.length).replace(/^\/+/, '');
      return to;
    },
    isAbsolute: (path: string) => /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/'),
  };
}

function buildLogCapability(identity: GreebleExtensionIdentity): GreebleLogCapability {
  const prefix = `[greeble:${identity.id}]`;
  return {
    debug: (message, data) => console.debug(prefix, message, data),
    info: (message, data) => console.info(prefix, message, data),
    warn: (message, data) => console.warn(prefix, message, data),
    error: (message, data) => console.error(prefix, message, data),
  };
}

function buildStorageCapability(
  identity: GreebleExtensionIdentity,
  entries: GreebleEntryStore,
): GreebleStorageCapability {
  return {
    rootDir: identity.rootDir,
    ensureDir: async () => identity.rootDir,
    readText: async relativePath => {
      const value = entries.get<string>(identity.id, `storage:${relativePath}`);
      if (value === undefined) throw new Error(`No stored text at "${relativePath}".`);
      return value;
    },
    writeText: async (relativePath, data) => {
      entries.set(identity.id, `storage:${relativePath}`, data);
    },
    writeBytes: async (relativePath, data) => {
      entries.set(identity.id, `storage:${relativePath}`, Array.from(data));
    },
  };
}

export interface GreebleContextDependencies {
  readonly bus: GreebleExtensionBus;
  readonly entries: GreebleEntryStore;
}

export function buildGreebleContext(
  identity: GreebleExtensionIdentity,
  deps: GreebleContextDependencies,
): GreebleContext {
  return {
    extension: identity,
    signal: undefined,
    hasUI: true,
    ui: unwired<GreebleUICapability>('ui'),
    explorer: unwired<GreebleExplorerCapability>('explorer'),
    paths: buildPathCapability(identity),
    fs: unwired<GreebleFileSystemCapability>('fs'),
    index: unwired<GreebleIndexCapability>('index'),
    settings: unwired<GreebleSettingsCapability>('settings'),
    storage: buildStorageCapability(identity, deps.entries),
    shell: unwired<GreebleShellCapability>('shell'),
    log: buildLogCapability(identity),
    events: deps.bus,
  };
}
