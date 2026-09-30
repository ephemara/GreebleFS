/**
 * GreebleFS Extension API — event spine + inter-extension bus.
 *
 * The spine is the lifecycle hook system: extensions observe named moments,
 * patch payloads, or block operations. Handlers run in priority order; each one
 * sees the payload as mutated by the previous handler, exactly like a
 * middleware chain.
 *
 * The bus is separate: free-form, namespaced channels for extension chatter.
 * The host never inspects bus payloads.
 */

import type {
  GreebleContext,
  GreebleEmission,
  GreebleEventMap,
  GreebleEventHandler,
  GreebleEventResult,
  GreebleEventSpine,
  GreebleExtensionBus,
  GreebleHandle,
} from './greeble';

interface RegisteredHandler<K extends keyof GreebleEventMap> {
  readonly id: number;
  readonly handler: GreebleEventHandler<K>;
  readonly priority: number;
  readonly owner: string;
}

let listenerSequence = 0;

function createListenerHandle(
  channel: string,
  dispose: () => void,
): GreebleHandle {
  let disposed = false;
  return {
    id: channel,
    domain: 'event',
    owner: 'listener',
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      dispose();
    },
  };
}

export class GreebleEventSpineImpl implements GreebleEventSpine {
  private readonly handlers = new Map<string, RegisteredHandler<keyof GreebleEventMap>[]>();

  on<K extends keyof GreebleEventMap>(
    event: K,
    handler: GreebleEventHandler<K>,
    options: { readonly priority?: number } = {},
  ): GreebleHandle {
    const key = String(event);
    const registered: RegisteredHandler<K> = {
      id: ++listenerSequence,
      handler,
      priority: options.priority ?? 0,
      owner: 'spine',
    };
    const list = this.handlers.get(key) ?? [];
    list.push(registered as RegisteredHandler<keyof GreebleEventMap>);
    // Higher priority first; stable within equal priority by insertion order.
    list.sort((a, b) => b.priority - a.priority);
    this.handlers.set(key, list);

    return createListenerHandle(`event:${key}:${registered.id}`, () => {
      const current = this.handlers.get(key);
      if (!current) {
        return;
      }
      const next = current.filter(entry => entry.id !== registered.id);
      if (next.length === 0) {
        this.handlers.delete(key);
      } else {
        this.handlers.set(key, next);
      }
    });
  }

  off(handle: GreebleHandle): void {
    handle.dispose();
  }

  async emit<K extends keyof GreebleEventMap>(
    event: K,
    payload: GreebleEventMap[K],
    ctx: GreebleContext,
  ): Promise<GreebleEmission<GreebleEventMap[K]>> {
    const key = String(event);
    const list = this.handlers.get(key);
    const results: GreebleEventResult<GreebleEventMap[K]>[] = [];

    // Payload is shallow-cloned so handler patches never mutate the caller's
    // object graph.
    let working: GreebleEventMap[K] = { ...payload };

    if (list && list.length > 0) {
      for (const entry of list) {
        let result: void | GreebleEventResult<GreebleEventMap[K]>;
        try {
          result = await (entry.handler as GreebleEventHandler<K>)(working, ctx);
        } catch (error) {
          ctx.log.error(
            `Event handler for "${key}" threw.`,
            error instanceof Error ? error.message : error,
          );
          continue;
        }

        if (!result) {
          continue;
        }

        results.push(result);

        if (result.patch) {
          working = { ...working, ...result.patch };
        }

        if (result.block) {
          return {
            blocked: true,
            reason: result.reason,
            payload: working,
            results,
          };
        }
      }
    }

    return { blocked: false, payload: working, results };
  }

  handlersFor(event: keyof GreebleEventMap): number {
    return this.handlers.get(String(event))?.length ?? 0;
  }
}

interface BusListener {
  readonly id: number;
  readonly handler: (payload: unknown, ctx: GreebleContext) => void | Promise<void>;
}

export class GreebleExtensionBusImpl implements GreebleExtensionBus {
  private readonly channelListeners = new Map<string, BusListener[]>();
  /** Context used for bus emissions; bound by the host at construction. */
  private contextProvider: (() => GreebleContext) | null = null;

  bindContext(provider: () => GreebleContext): void {
    this.contextProvider = provider;
  }

  on<T = unknown>(
    channel: string,
    handler: (payload: T, ctx: GreebleContext) => void | Promise<void>,
  ): GreebleHandle {
    const key = normalizeChannel(channel);
    const listener: BusListener = {
      id: ++listenerSequence,
      handler: handler as BusListener['handler'],
    };
    const list = this.channelListeners.get(key) ?? [];
    list.push(listener);
    this.channelListeners.set(key, list);

    return createListenerHandle(`bus:${key}:${listener.id}`, () => {
      const current = this.channelListeners.get(key);
      if (!current) {
        return;
      }
      const next = current.filter(entry => entry.id !== listener.id);
      if (next.length === 0) {
        this.channelListeners.delete(key);
      } else {
        this.channelListeners.set(key, next);
      }
    });
  }

  off(handle: GreebleHandle): void {
    handle.dispose();
  }

  emit<T = unknown>(channel: string, payload?: T): void {
    const key = normalizeChannel(channel);
    const list = this.channelListeners.get(key);
    if (!list || list.length === 0) {
      return;
    }
    const ctx = this.contextProvider?.();
    for (const listener of Array.from(list)) {
      try {
        const result = listener.handler(payload, ctx as GreebleContext);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          void (result as Promise<void>).catch(error => {
            console.error(`GreebleFS extension bus: handler for "${key}" rejected.`, error);
          });
        }
      } catch (error) {
        console.error(`GreebleFS extension bus: handler for "${key}" threw.`, error);
      }
    }
  }

  channels(): readonly string[] {
    return Array.from(this.channelListeners.keys());
  }
}

/** Bus channels must be namespaced with a colon prefix (`xmb:ready`). */
export function normalizeChannel(channel: string): string {
  const trimmed = channel.trim();
  if (!trimmed.includes(':')) {
    throw new Error(
      `GreebleFS extension bus: channel "${channel}" must be namespaced (e.g. "myname:event").`,
    );
  }
  return trimmed;
}

export function isNamespacedChannel(channel: string): boolean {
  return typeof channel === 'string' && channel.includes(':');
}
