import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeStreamMock = vi.hoisted(() => ({
  nativeByteStreamTelemetry: vi.fn(),
}));

const nativeControlMock = vi.hoisted(() => ({
  available: true,
  isGreebleNativeControlAvailable: vi.fn(() => nativeControlMock.available),
  callGreebleNative: vi.fn(),
}));

vi.mock("@tauri-apps/api/native-stream", () => nativeStreamMock);

vi.mock("../runtime/nativeControl", () => nativeControlMock);

describe("native ring comparison runtime", () => {
  beforeEach(() => {
    nativeStreamMock.nativeByteStreamTelemetry.mockReset();
    nativeControlMock.available = true;
    nativeControlMock.isGreebleNativeControlAvailable.mockClear();
    nativeControlMock.callGreebleNative.mockReset();
  });

  it("collects terminal native-stream telemetry beside the Tauron native-ring benchmark", async () => {
    const { runTerminalNativeRingComparison } = await import("../runtime/nativeRingComparison");
    nativeStreamMock.nativeByteStreamTelemetry.mockResolvedValue({
      streams: 1,
      subscriptions: 1,
      packets: 4,
      bytes: 64,
      averageBatchSize: 16,
      postFailures: 0,
      unavailableSubscriptions: 0,
      droppedBytes: 0,
      droppedRanges: [],
      maxQueueDepth: 32,
      allocationCount: 1,
      copyCount: 1,
      copiedBytes: 64,
      nativeEnqueueTimeTotalUs: 12,
      nativeEnqueueTimeMaxUs: 12,
      webviewPostTimeTotalUs: 20,
      webviewPostTimeMaxUs: 20,
    });
    nativeControlMock.callGreebleNative.mockResolvedValue({
      packets: 4,
      bytes: 64,
      copyCount: 4,
      copiedBytes: 64,
      webviewPostTimeUs: 25,
      telemetry: {
        packets: 4,
        bytes: 64,
        capacity: 1024,
        queueDepth: 64,
        maxQueueDepth: 64,
        droppedBytes: 0,
        droppedRanges: [],
      },
    });

    const snapshot = await runTerminalNativeRingComparison({
      ringId: "terminal-output-test",
      packets: 4,
      packetBytes: 16,
      capacity: 1024,
    });

    expect(snapshot.nativeStreamTelemetry.packets).toBe(4);
    expect(snapshot.nativeRingBenchmark.telemetry.capacity).toBe(1024);
    expect(nativeControlMock.callGreebleNative).toHaveBeenCalledWith(
      "diagnostics",
      "nativeRingBenchmark",
      {
        ringId: "terminal-output-test",
        packets: 4,
        packetBytes: 16,
        capacity: 1024,
      },
    );
  });
});
