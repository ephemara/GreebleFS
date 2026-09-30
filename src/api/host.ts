/**
 * GreebleFS Extension API — host binding.
 *
 * `createGreebleHarness()` is the single bridge between the public contract and
 * whatever the host actually is (today: the GreebleFS frontend; tomorrow: the
 * automation host, the RPC host, tests). It binds capabilities, owns the
 * registry book and event spine, tracks every handle an extension creates, and
 * guarantees a clean unwind on `dispose()`.
 *
 * The host is expected to construct ONE `GreebleDomainBookImpl` and ONE
 * `GreebleEventSpineImpl` for the whole application, then mint one harness per
 * extension.
 */

import type {
  GreebleCapability,
  GreebleContext,
  GreebleContribution,
  GreebleDomainBook,
  GreebleEmission,
  GreebleEventMap,
  GreebleEventHandler,
  GreebleEventSpine,
  GreebleExtensionBus,
  GreebleExtensionFactory,
  GreebleExtensionIdentity,
  GreebleHandle,
  GreebleHarness,
  GreeblePreviewLaneContribution,
  GreebleViewModeContribution,
} from './greeble';
import { GREEBLE_API_VERSION } from './greeble';
import { GreebleDomainBookImpl } from './registry';

/** Persistence backing for `appendEntry` / `getEntry`. */
export interface GreebleEntryStore {
  get<T = unknown>(extensionId: string, key: string): T | undefined;
  set<T = unknown>(extensionId: string, key: string, value: T): void;
}

/** Everything the host must supply to mint a harness. */
export interface GreebleHostBindings {
  readonly identity: GreebleExtensionIdentity;
  /** The shared registry book for the whole application. */
  readonly book: GreebleDomainBookImpl;
  /** The shared lifecycle spine. */
  readonly spine: GreebleEventSpine;
  /** The shared inter-extension bus. */
  readonly bus: GreebleExtensionBus;
  /** Per-extension persistence. */
  readonly entries: GreebleEntryStore;
  /**
   * Builds the capability bag for this extension. Called lazily so the host can
   * defer expensive context wiring until an extension actually asks.
   */
  readonly buildContext: () => GreebleContext;
  /** Optional default order accessor per domain. */
  readonly orderForDomain?: (domain: string) => ((entry: GreebleContribution) => number) | undefined;
  /** Called when the harness is disposed, after all handles are released. */
  readonly onDispose?: () => void;
}

/**
 * A live harness. Every registration verb funnels into the domain book so the
 * implementation stays loop-free and new domains need no new code here.
 */
class GreebleHarnessImpl implements GreebleHarness {
  readonly apiVersion = GREEBLE_API_VERSION;
  readonly identity: GreebleExtensionIdentity;
  readonly events: GreebleExtensionBus;

  private readonly book: GreebleDomainBook;
  private readonly spine: GreebleEventSpine;
  private readonly entryStore: GreebleEntryStore;
  private readonly buildContext: () => GreebleContext;
  private readonly orderForDomain: (domain: string) => ((entry: GreebleContribution) => number) | undefined;
  private readonly onDispose?: () => void;

  private readonly handles: GreebleHandle[] = [];
  private disposed = false;
  private cachedContext: GreebleContext | null = null;

  constructor(bindings: GreebleHostBindings) {
    this.identity = bindings.identity;
    this.book = bindings.book;
    this.spine = bindings.spine;
    this.events = bindings.bus;
    this.entryStore = bindings.entries;
    this.buildContext = bindings.buildContext;
    this.orderForDomain = bindings.orderForDomain ?? (() => undefined);
    this.onDispose = bindings.onDispose;
  }

  // ── Generic registration ────────────────────────────────────────────────

  register<D extends string>(domain: D, entry: GreebleContribution): GreebleHandle;
  register(domain: string, entry: GreebleContribution): GreebleHandle {
    this.assertLive();
    const registry = this.book.define(domain, { order: this.orderForDomain(domain) });
    const handle = registry.register(entry, this.identity.id);
    this.handles.push(handle);
    return handle;
  }

  // ── Typed sugar (all delegate to `register`) ────────────────────────────

  registerShell(entry: Parameters<GreebleHarness['registerShell']>[0]) {
    return this.register('shell', entry);
  }
  registerTheme(entry: Parameters<GreebleHarness['registerTheme']>[0]) {
    return this.register('theme', entry);
  }
  registerIconTheme(entry: Parameters<GreebleHarness['registerIconTheme']>[0]) {
    return this.register('iconTheme', entry);
  }
  registerSoundPack(entry: Parameters<GreebleHarness['registerSoundPack']>[0]) {
    return this.register('soundPack', entry);
  }
  registerShader(entry: Parameters<GreebleHarness['registerShader']>[0]) {
    return this.register('shader', entry);
  }
  registerMotion(entry: Parameters<GreebleHarness['registerMotion']>[0]) {
    return this.register('motion', entry);
  }
  registerAnimation(entry: Parameters<GreebleHarness['registerAnimation']>[0]) {
    return this.register('animation', entry);
  }
  registerHomePack(entry: Parameters<GreebleHarness['registerHomePack']>[0]) {
    return this.register('homePack', entry);
  }
  registerMenuPack(entry: Parameters<GreebleHarness['registerMenuPack']>[0]) {
    return this.register('menuPack', entry);
  }
  registerLayout(entry: Parameters<GreebleHarness['registerLayout']>[0]) {
    return this.register('layout', entry);
  }
  registerFont(entry: Parameters<GreebleHarness['registerFont']>[0]) {
    return this.register('font', entry);
  }
  registerViewMode<TData = unknown>(entry: GreebleViewModeContribution<TData>): GreebleHandle {
    return this.register('viewMode', entry as unknown as GreebleContribution);
  }
  registerPreviewLane<TData = unknown>(entry: GreeblePreviewLaneContribution<TData>): GreebleHandle {
    return this.register('previewLane', entry as unknown as GreebleContribution);
  }
  registerExplorerWidget(entry: Parameters<GreebleHarness['registerExplorerWidget']>[0]) {
    return this.register('explorerWidget', entry);
  }
  registerActivityLane(entry: Parameters<GreebleHarness['registerActivityLane']>[0]) {
    return this.register('activityLane', entry);
  }
  registerCommand(entry: Parameters<GreebleHarness['registerCommand']>[0]) {
    return this.register('command', entry);
  }
  registerAction(entry: Parameters<GreebleHarness['registerAction']>[0]) {
    return this.register('action', entry);
  }
  registerActionPack(entry: Parameters<GreebleHarness['registerActionPack']>[0]) {
    return this.register('actionPack', entry);
  }
  registerContextMenuItem(entry: Parameters<GreebleHarness['registerContextMenuItem']>[0]) {
    return this.register('contextMenuItem', entry);
  }
  registerHotkey(entry: Parameters<GreebleHarness['registerHotkey']>[0]) {
    return this.register('hotkey', entry);
  }
  registerWorkflow(entry: Parameters<GreebleHarness['registerWorkflow']>[0]) {
    return this.register('workflow', entry);
  }
  registerPanel(entry: Parameters<GreebleHarness['registerPanel']>[0]) {
    return this.register('panel', entry);
  }
  registerSettingsSlot(entry: Parameters<GreebleHarness['registerSettingsSlot']>[0]) {
    return this.register('settingsSlot', entry);
  }
  registerProvider(entry: Parameters<GreebleHarness['registerProvider']>[0]) {
    return this.register('provider', entry);
  }
  registerTool(entry: Parameters<GreebleHarness['registerTool']>[0]) {
    return this.register('tool', entry);
  }

  // ── Event spine ─────────────────────────────────────────────────────────

  on<K extends keyof GreebleEventMap>(
    event: K,
    handler: GreebleEventHandler<K>,
    options?: { readonly priority?: number },
  ): GreebleHandle {
    this.assertLive();
    const handle = this.spine.on(event, handler, options);
    this.handles.push(handle);
    return handle;
  }

  off(handle: GreebleHandle): void {
    handle.dispose();
  }

  emit<K extends keyof GreebleEventMap>(
    event: K,
    payload: GreebleEventMap[K],
  ): Promise<GreebleEmission<GreebleEventMap[K]>> {
    return this.spine.emit(event, payload, this.context());
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  appendEntry<T = unknown>(key: string, value: T): void {
    this.assertLive();
    this.entryStore.set(this.identity.id, key, value);
  }

  getEntry<T = unknown>(key: string, fallback?: T): T | undefined {
    const value = this.entryStore.get<T>(this.identity.id, key);
    return value === undefined ? fallback : value;
  }

  // ── Capabilities ────────────────────────────────────────────────────────

  can(capability: GreebleCapability): boolean {
    return this.identity.capabilities.has(capability);
  }

  context(): GreebleContext {
    if (!this.cachedContext) {
      this.cachedContext = this.buildContext();
    }
    return this.cachedContext;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const handle of this.handles) {
      try {
        handle.dispose();
      } catch (error) {
        console.error(
          `GreebleFS extension API: dispose failed for ${this.identity.id}.`,
          error,
        );
      }
    }
    this.handles.length = 0;
    // Belt and braces: sweep any registrations the handles might have missed.
    this.book.unregisterOwner(this.identity.id);
    this.cachedContext = null;
    this.onDispose?.();
  }

  private assertLive(): void {
    if (this.disposed) {
      throw new Error(
        `GreebleFS extension API: extension "${this.identity.id}" attempted to register after dispose.`,
      );
    }
  }
}

/** Mint a live harness for one extension. */
export function createGreebleHarness(bindings: GreebleHostBindings): GreebleHarness {
  return new GreebleHarnessImpl(bindings);
}

/**
 * Run an extension factory against a freshly minted harness. Returns the
 * harness so the host can dispose it on unload.
 */
export async function runGreebleExtension(
  factory: GreebleExtensionFactory,
  bindings: GreebleHostBindings,
): Promise<GreebleHarness> {
  const harness = createGreebleHarness(bindings);
  await factory(harness);
  return harness;
}

/** Convenience for tests and the UI runner: a fresh isolated book. */
export function createGreebleDomainBook(): GreebleDomainBookImpl {
  return new GreebleDomainBookImpl();
}
