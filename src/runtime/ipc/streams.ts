import { subscribeStream as subscribeTransportStream } from "@tauri-apps/api/transport";
import type { IpcStreamHandle } from "../../generated/tauri";
import { bindDeferredUnlisten } from "../deferredUnlisten";

export type ManagedIpcStreamHandle = IpcStreamHandle;

export interface SubscribeIpcStreamOptions {
  releaseOnUnsubscribe?: boolean | null;
  replayFromSequence?: number | null;
  replayLimit?: number | null;
  includeReplay?: boolean | null;
}

export async function subscribeIpcStream<TPayload>(
  handle: ManagedIpcStreamHandle,
  listener: (payload: TPayload) => void,
  options: SubscribeIpcStreamOptions = {},
): Promise<() => void> {
  const deliveredSequences = new Set<number>();
  const deliverOnce = (payload: TPayload) => {
    const sequence = readStreamSequence(payload);
    if (sequence != null) {
      if (deliveredSequences.has(sequence)) {
        return;
      }
      deliveredSequences.add(sequence);
    }
    listener(payload);
  };

  const unsubscribePromise = subscribeTransportStream<TPayload>(handle, deliverOnce, {
    includeReplay:
      options.includeReplay === true || options.replayFromSequence != null,
    replayFromSequence: options.replayFromSequence ?? undefined,
    replayLimit: options.replayLimit ?? undefined,
    closeOnUnsubscribe: options.releaseOnUnsubscribe ?? true,
  });
  const stopStreamListener = bindDeferredUnlisten(unsubscribePromise);
  await unsubscribePromise;

  return () => {
    stopStreamListener();
  };
}

function readStreamSequence(payload: unknown): number | null {
  const metadata = typeof payload === "object" && payload != null
    ? (payload as { metadata?: unknown }).metadata
    : null;
  const sequence = typeof metadata === "object" && metadata != null
    ? (metadata as { sequence?: unknown }).sequence
    : null;
  return typeof sequence === "number" && Number.isFinite(sequence)
    ? sequence
    : null;
}
