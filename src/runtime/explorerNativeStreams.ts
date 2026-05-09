import {
  isNativeStreamAvailable,
  subscribeNativeByteStream,
  type NativeByteStreamPacket,
} from "@tauri-apps/api/native-stream";
import type { FileSearchResponse } from "../config/searchTelemetry";
import type { FileSearchDiagnostics, FileSearchResult } from "../generated/tauri";
import { callGreebleNative, isGreebleNativeControlAvailable } from "./nativeControl";

export interface ExplorerNativeSearchStreamArgs {
  path: string;
  query: string;
  showHidden: boolean;
  includeContent?: boolean;
  limit?: number;
  requestId?: number;
  requestScope?: string;
}

type ExplorerNativeSearchStreamMessage =
  | {
      kind: "resultBatch";
      results: FileSearchResult[];
    }
  | {
      kind: "complete";
      diagnostics: FileSearchDiagnostics;
      resultCount: number;
    }
  | {
      kind: "error";
      message: string;
    };

const EXPLORER_NATIVE_SEARCH_TIMEOUT_MS = 15_000;

export function isExplorerNativeRingSearchStreamAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return isGreebleNativeControlAvailable() && isNativeStreamAvailable();
  } catch {
    return false;
  }
}

function buildNativeSearchStreamId(): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `explorer-search-${randomId}`;
}

function parseNativeSearchStreamMessages(
  packet: NativeByteStreamPacket,
  decoder: TextDecoder,
  bufferedText: string,
  onMessage: (message: ExplorerNativeSearchStreamMessage) => void,
): string {
  const nextText = bufferedText + decoder.decode(packet.bytes, { stream: true });
  const lines = nextText.split("\n");
  const trailingText = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    onMessage(JSON.parse(trimmed) as ExplorerNativeSearchStreamMessage);
  }
  return trailingText;
}

export async function searchExplorerEntriesWithDiagnosticsViaNativeStream(
  args: ExplorerNativeSearchStreamArgs,
): Promise<FileSearchResponse<FileSearchResult>> {
  const streamId = buildNativeSearchStreamId();
  const decoder = new TextDecoder();
  const results: FileSearchResult[] = [];
  let bufferedText = "";
  let complete = false;
  let unsubscribe: (() => Promise<void>) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const completion = new Promise<FileSearchResponse<FileSearchResult>>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Native search stream timed out before completion."));
    }, EXPLORER_NATIVE_SEARCH_TIMEOUT_MS);

    const handleMessage = (message: ExplorerNativeSearchStreamMessage) => {
      if (message.kind === "resultBatch") {
        results.push(...message.results);
        return;
      }
      if (message.kind === "complete") {
        complete = true;
        resolve({
          results,
          diagnostics: message.diagnostics,
        });
        return;
      }
      reject(new Error(message.message || "Native search stream failed."));
    };

    subscribeNativeByteStream(streamId, (packet) => {
      try {
        bufferedText = parseNativeSearchStreamMessages(
          packet,
          decoder,
          bufferedText,
          handleMessage,
        );
      } catch (error) {
        reject(error);
      }
    })
      .then((nextUnsubscribe) => {
        unsubscribe = nextUnsubscribe;
        return callGreebleNative("explorer", "searchEntriesStream", {
          ...args,
          streamId,
        });
      })
      .catch(reject);
  });

  try {
    const response = await completion;
    return response;
  } finally {
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
    if (!complete && bufferedText.trim().length > 0) {
      bufferedText = "";
    }
    await unsubscribe?.();
  }
}
