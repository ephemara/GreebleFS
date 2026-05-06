import { listen } from "@tauri-apps/api/event";
import type { IpcStreamHandle, IpcStreamReplayResponse } from "../../generated/tauri";
import { commands, unwrapTauriResult } from "../tauriClient";
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

  const unlistenPromise = listen<TPayload>(handle.eventName, (event) => {
    deliverOnce(event.payload);
  });
  const stopStreamListener = bindDeferredUnlisten(unlistenPromise);
  await unlistenPromise;

  if (options.includeReplay === true || options.replayFromSequence != null) {
    const replay = unwrapTauriResult(
      await commands.ipcReplayStream(
        handle.id,
        options.replayFromSequence ?? 0,
        options.replayLimit ?? null,
      ),
    ) as IpcStreamReplayResponse;
    for (const packet of replay.packets) {
      const payload = parseReplayPayload<TPayload>(packet.payloadJson);
      if (payload != null) {
        deliverOnce(payload);
      }
    }
  }

  return () => {
    stopStreamListener();
    if (options.releaseOnUnsubscribe ?? true) {
      void commands
        .ipcReleaseStream(handle.id)
        .then(unwrapTauriResult)
        .catch(() => {});
    }
  };
}

function parseReplayPayload<TPayload>(payloadJson: string): TPayload | null {
  try {
    return JSON.parse(payloadJson) as TPayload;
  } catch {
    return null;
  }
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
