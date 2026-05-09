import {
  nativeByteStreamTelemetry,
  type NativeByteStreamTelemetry,
} from "@tauri-apps/api/native-stream";
import { callGreebleNative, isGreebleNativeControlAvailable } from "./nativeControl";

export interface NativeRingBenchmarkRequest {
  ringId?: string;
  packets?: number;
  packetBytes?: number;
  capacity?: number;
}

export interface NativeRingDroppedRange {
  startSequence: number;
  endSequence: number;
  bytes: number;
}

export interface NativeRingTelemetry {
  packets: number;
  bytes: number;
  capacity: number;
  queueDepth: number;
  maxQueueDepth: number;
  droppedBytes: number;
  droppedRanges: NativeRingDroppedRange[];
}

export interface NativeRingPostMetrics {
  packets: number;
  bytes: number;
  copyCount: number;
  copiedBytes: number;
  webviewPostTimeUs: number;
  telemetry: NativeRingTelemetry;
}

export interface TerminalNativeRingComparisonSnapshot {
  nativeStreamTelemetry: NativeByteStreamTelemetry;
  nativeRingBenchmark: NativeRingPostMetrics;
}

export function isTerminalNativeRingComparisonAvailable(): boolean {
  return isGreebleNativeControlAvailable();
}

export async function runTerminalNativeRingComparison(
  request: NativeRingBenchmarkRequest = {},
): Promise<TerminalNativeRingComparisonSnapshot> {
  const [nativeStreamTelemetrySnapshot, nativeRingBenchmark] = await Promise.all([
    nativeByteStreamTelemetry(),
    callGreebleNative<NativeRingPostMetrics, NativeRingBenchmarkRequest>(
      "diagnostics",
      "nativeRingBenchmark",
      request,
    ),
  ]);

  return {
    nativeStreamTelemetry: nativeStreamTelemetrySnapshot,
    nativeRingBenchmark,
  };
}
