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

function isGuestUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("TAURON_GUEST_UNAVAILABLE");
}

let invokeReplayUnavailableWarned = false;
function warnInvokeReplayUnavailableOnce(detail: string): void {
  if (invokeReplayUnavailableWarned) {
    return;
  }
  invokeReplayUnavailableWarned = true;
  console.warn(
    `[ipc-streams] native transport unavailable, using invoke replay fallback (${detail})`,
  );
}

export function resetIpcStreamFallbackWarningsForTests(): void {
  invokeReplayUnavailableWarned = false;
}

interface NormalizedReplayPacket<TPayload> {
  metadata: { sequence: number; streamId?: string; [key: string]: unknown };
  payload: TPayload;
}

function parseReplayPayloadJson<TPayload>(payloadJson: string): TPayload {
  try {
    return JSON.parse(payloadJson) as TPayload;
  } catch {
    return payloadJson as unknown as TPayload;
  }
}

function normalizeReplayPackets<TPayload>(response: unknown): NormalizedReplayPacket<TPayload>[] {
  if (!response || typeof response !== "object") {
    return [];
  }
  const packets = (response as { packets?: unknown; Packets?: unknown }).packets ??
    (response as { Packets?: unknown }).Packets;
  if (!Array.isArray(packets)) {
    return [];
  }
  const normalized: NormalizedReplayPacket<TPayload>[] = [];
  for (const entry of packets) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const metadataRaw = (record.metadata ?? record.Metadata) as Record<string, unknown> | undefined;
    if (!metadataRaw || typeof metadataRaw !== "object") {
      continue;
    }
    const sequenceRaw = metadataRaw.sequence ?? metadataRaw.Sequence;
    const sequence = typeof sequenceRaw === "number"
      ? sequenceRaw
      : typeof sequenceRaw === "string" && sequenceRaw.trim() !== ""
        ? Number(sequenceRaw)
        : NaN;
    if (!Number.isFinite(sequence)) {
      continue;
    }
    if ("payload" in record && record.payload !== undefined) {
      normalized.push({
        metadata: {
          ...(metadataRaw as Record<string, unknown>),
          sequence,
        } as NormalizedReplayPacket<TPayload>["metadata"],
        payload: record.payload as TPayload,
      });
      continue;
    }
    const payloadJson = record.payloadJson ?? record.payload_json ?? record.PayloadJson;
    if (typeof payloadJson === "string") {
      normalized.push({
        metadata: {
          ...(metadataRaw as Record<string, unknown>),
          sequence,
        } as NormalizedReplayPacket<TPayload>["metadata"],
        payload: parseReplayPayloadJson<TPayload>(payloadJson),
      });
    }
  }
  normalized.sort((a, b) => a.metadata.sequence - b.metadata.sequence);
  return normalized;
}

async function invokeTransportReplay<TPayload>(
  streamId: string,
  fromSequence: number | undefined,
  limit: number | undefined,
): Promise<NormalizedReplayPacket<TPayload>[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  const attempts: Array<{ command: string; args: Record<string, unknown> }> = [];
  const baseArgs: Record<string, unknown> = { id: streamId };
  if (fromSequence != null) {
    baseArgs.fromSequence = fromSequence;
    baseArgs.from_sequence = fromSequence;
  }
  if (limit != null) {
    baseArgs.limit = limit;
  }
  attempts.push({ command: "plugin:transport|replay", args: baseArgs });
  attempts.push({ command: "plugin:transport|replay", args: { id: streamId } });

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const response = await invoke<unknown>(attempt.command, attempt.args);
      return normalizeReplayPackets<TPayload>(response);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("transport replay invoke unavailable");
}

async function tryEstablishChannelLiveFeed<TPayload>(
  handle: ManagedIpcStreamHandle,
  deliver: (packet: TransportStreamPacket<TPayload>) => void,
  options: SubscribeIpcStreamOptions,
): Promise<(() => void) | null> {
  try {
    const { Channel, invoke } = await import("@tauri-apps/api/core");
    const channel = new Channel<unknown>((message: unknown) => {
      if (!message || typeof message !== "object") {
        return;
      }
      const record = message as Record<string, unknown>;
      const metadata = (record.metadata ?? record.Metadata) as
        | { sequence?: unknown }
        | undefined;
      if (!metadata || typeof metadata !== "object") {
        return;
      }
      const sequenceRaw = (metadata as Record<string, unknown>).sequence;
      const sequence = typeof sequenceRaw === "number" ? sequenceRaw : Number(sequenceRaw);
      if (!Number.isFinite(sequence)) {
        return;
      }
      if ("payload" in record) {
        deliver({
          metadata: { ...(metadata as object), sequence } as TransportStreamPacket<TPayload>["metadata"],
          payload: record.payload as TPayload,
        });
        return;
      }
      const payloadJson = (record as Record<string, unknown>).payloadJson ??
        (record as Record<string, unknown>).payload_json;
      if (typeof payloadJson === "string") {
        deliver({
          metadata: { ...(metadata as object), sequence } as TransportStreamPacket<TPayload>["metadata"],
          payload: parseReplayPayloadJson<TPayload>(payloadJson),
        });
      }
    });

    const includeReplay = options.includeReplay === true || options.replayFromSequence != null;
    const channelArgsVariants: Record<string, unknown>[] = [
      {
        id: handle.id,
        channel,
        includeReplay,
        include_replay: includeReplay,
        replayFromSequence: options.replayFromSequence ?? undefined,
        replay_from_sequence: options.replayFromSequence ?? undefined,
        replayLimit: options.replayLimit ?? undefined,
        replay_limit: options.replayLimit ?? undefined,
      },
      {
        id: handle.id,
        channel,
      },
    ];

    for (const args of channelArgsVariants) {
      try {
        const subscription = await invoke<{ id: string }>(
          "plugin:transport|subscribe",
          args,
        );
        const subscriptionId = subscription?.id;
        return () => {
          if (subscriptionId) {
            void invoke("plugin:transport|unsubscribe", { id: subscriptionId }).catch(() => {});
          }
        };
      } catch {
        // Try the next arg shape.
      }
    }
    return null;
  } catch {
    return null;
  }
}

function startInvokeReplayFallback<TPayload>(
  handle: ManagedIpcStreamHandle,
  deliverOnce: (packet: TransportStreamPacket<TPayload>) => void,
  options: SubscribeIpcStreamOptions,
): Promise<() => void> {
  return (async () => {
    let nextSequence = options.replayFromSequence ?? 0;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let channelCleanup: (() => void) | null = null;
    let consecutiveFailures = 0;

    const pollOnce = async (): Promise<void> => {
      if (stopped) {
        return;
      }
      try {
        const packets = await invokeTransportReplay<TPayload>(
          handle.id,
          nextSequence,
          options.replayLimit ?? 256,
        );
        consecutiveFailures = 0;
        for (const packet of packets) {
          const sequence = packet.metadata.sequence;
          if (sequence >= nextSequence) {
            nextSequence = sequence + 1;
          }
          deliverOnce({
            metadata: packet.metadata as TransportStreamPacket<TPayload>["metadata"],
            payload: packet.payload,
          });
        }
      } catch (error) {
        consecutiveFailures += 1;
        if (consecutiveFailures === 1) {
          warnInvokeReplayUnavailableOnce(
            error instanceof Error ? error.message : String(error ?? "unknown error"),
          );
        }
      }
    };

    await pollOnce();
    if (stopped) {
      return () => {};
    }

    channelCleanup = await tryEstablishChannelLiveFeed(handle, deliverOnce, options);
    if (stopped) {
      channelCleanup?.();
      return () => {};
    }

    timer = setInterval(() => {
      void pollOnce();
    }, 150);
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref?: () => void }).unref?.();
    }

    const cleanup = (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      channelCleanup?.();
      channelCleanup = null;
      if (options.releaseOnUnsubscribe ?? true) {
        void (async () => {
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            try {
              await invoke("plugin:transport|close_stream", { id: handle.id });
            } catch {
              await invoke("plugin:transport|close_stream_command", { id: handle.id });
            }
          } catch {
            // Best effort only; terminal-owned streams are released via terminal_kill.
          }
        })();
      }
    };

    return cleanup;
  })();
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

  try {
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
  } catch (fastError) {
    if (!isGuestUnavailableError(fastError)) {
      // Even for non-guest errors, the invoke replay ring is the most
      // resilient lane (it survives native shared-buffer outages), so fall
      // through instead of failing the terminal outright.
      console.warn(
        `[ipc-streams] transport fast lane failed for ${handle.id}, falling back to invoke replay:`,
        fastError instanceof Error ? fastError.message : fastError,
      );
    } else {
      warnInvokeReplayUnavailableOnce(
        fastError instanceof Error ? fastError.message : String(fastError),
      );
    }
  }

  const fallbackPromise = startInvokeReplayFallback<TPayload>(handle, deliverOnce, options);
  const stopFallback = bindDeferredUnlisten(fallbackPromise);
  const cleanup = await fallbackPromise;
  return () => {
    cleanup();
    stopFallback();
  };
}
