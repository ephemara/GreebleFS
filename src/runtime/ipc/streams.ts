import {
  subscribeStreamPackets as subscribeTransportStreamPackets,
  type TransportStreamPacket,
} from "@tauri-apps/api/transport";
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
  const deliverOnce = (packet: TransportStreamPacket<TPayload>) => {
    const sequence = packet.metadata.sequence;
    if (deliveredSequences.has(sequence)) {
      return;
    }
    deliveredSequences.add(sequence);
    listener(packet.payload);
  };

  const unsubscribePromise = subscribeTransportStreamPackets<TPayload>(
    handle,
    deliverOnce,
    {
      includeReplay:
        options.includeReplay === true || options.replayFromSequence != null,
      replayFromSequence: options.replayFromSequence ?? undefined,
      replayLimit: options.replayLimit ?? undefined,
      closeOnUnsubscribe: options.releaseOnUnsubscribe ?? true,
    },
  );
  const stopStreamListener = bindDeferredUnlisten(unsubscribePromise);
  await unsubscribePromise;

  return () => {
    stopStreamListener();
  };
}
