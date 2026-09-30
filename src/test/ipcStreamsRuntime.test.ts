import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscribeStreamMock } = vi.hoisted(() => ({
  subscribeStreamMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/transport", () => ({
  subscribeStreamPackets: subscribeStreamMock,
}));

import { invoke } from "@tauri-apps/api/core";
import { resetDeferredUnlistenForTests } from "../runtime/deferredUnlisten";
import {
  resetIpcStreamFallbackWarningsForTests,
  subscribeIpcStream,
} from "../runtime/ipc/streams";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("ipc stream runtime", () => {
  beforeEach(() => {
    resetDeferredUnlistenForTests();
    resetIpcStreamFallbackWarningsForTests();
    subscribeStreamMock.mockReset();
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValue(null);
  });

  it("forwards ordered payloads and closes the transport subscription on teardown", async () => {
    const payloadListener = vi.fn();
    const unlisten = vi.fn(async () => undefined);
    let transportListener: ((payload: unknown) => void) | null = null;

    subscribeStreamMock.mockImplementation(
      async (_handle: unknown, listener: (payload: unknown) => void) => {
        transportListener = listener;
        return unlisten;
      },
    );

    const dispose = await subscribeIpcStream(
      {
        id: "stream-1",
        kind: "terminal-output",
      },
      payloadListener,
    );

    if (!transportListener) {
      throw new Error("Missing transport stream listener");
    }

    transportListener({
      metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1, byteLength: 13 },
      payload: {
        terminalId: "preview-pane-0",
        data: "hello world",
      },
    });

    expect(payloadListener).toHaveBeenCalledWith(
      expect.objectContaining({
        data: "hello world",
      }),
    );

    dispose();

    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(subscribeStreamMock).toHaveBeenCalledWith(
      { id: "stream-1", kind: "terminal-output" },
      expect.any(Function),
      {
        includeReplay: false,
        replayFromSequence: undefined,
        replayLimit: undefined,
        closeOnUnsubscribe: true,
      },
    );
  });

  it("requests replay from transport and dedupes live packets by stream sequence", async () => {
    const payloadListener = vi.fn();
    const unlisten = vi.fn(async () => undefined);
    let transportListener: ((payload: unknown) => void) | null = null;

    subscribeStreamMock.mockImplementation(
      async (_handle: unknown, listener: (payload: unknown) => void) => {
        transportListener = listener;
        return unlisten;
      },
    );

    const dispose = await subscribeIpcStream(
      {
        id: "stream-1",
        kind: "terminal-output",
      },
      payloadListener,
      { replayFromSequence: 0, releaseOnUnsubscribe: false },
    );

    if (!transportListener) {
      throw new Error("Missing transport stream listener");
    }

    transportListener({
      metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1, byteLength: 8 },
      payload: {
        terminalId: "preview-pane-0",
        data: "retained",
      },
    });
    transportListener({
      metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1, byteLength: 14 },
      payload: {
        terminalId: "preview-pane-0",
        data: "duplicate-live",
      },
    });
    transportListener({
      metadata: { streamId: "stream-1", sequence: 1, emittedAtEpochMs: 2, byteLength: 4 },
      payload: {
        terminalId: "preview-pane-0",
        data: "live",
      },
    });

    expect(payloadListener).toHaveBeenCalledTimes(2);
    expect(payloadListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: "retained" }),
    );
    expect(payloadListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: "live" }),
    );
    expect(subscribeStreamMock).toHaveBeenCalledWith(
      { id: "stream-1", kind: "terminal-output" },
      expect.any(Function),
      {
        includeReplay: true,
        replayFromSequence: 0,
        replayLimit: undefined,
        closeOnUnsubscribe: false,
      },
    );

    dispose();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("falls back to invoke replay when the native transport guest is unavailable", async () => {
    const payloadListener = vi.fn();
    subscribeStreamMock.mockRejectedValueOnce(
      new Error(
        "TAURON_GUEST_UNAVAILABLE: subscribeStreamPackets needs the Tauron native transport",
      ),
    );
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "plugin:transport|replay") {
        return {
          streamId: "stream-1",
          packets: [
            {
              metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1, byteLength: 7 },
              payloadJson: JSON.stringify("hello fallback"),
            },
            {
              metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1, byteLength: 7 },
              payloadJson: JSON.stringify("hello fallback"),
            },
            {
              metadata: { streamId: "stream-1", sequence: 1, emittedAtEpochMs: 2, byteLength: 5 },
              payloadJson: JSON.stringify("live"),
            },
          ],
        };
      }
      return null;
    });

    const dispose = await subscribeIpcStream<string>(
      { id: "stream-1", kind: "terminal-output" },
      payloadListener,
      { replayFromSequence: 0, releaseOnUnsubscribe: false },
    );

    expect(payloadListener).toHaveBeenCalledTimes(2);
    expect(payloadListener).toHaveBeenNthCalledWith(1, "hello fallback");
    expect(payloadListener).toHaveBeenNthCalledWith(2, "live");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "plugin:transport|replay",
      expect.objectContaining({ id: "stream-1" }),
    );

    dispose();
  });

  it("does not throw when both the fast lane and invoke replay are unavailable", async () => {
    const payloadListener = vi.fn();
    subscribeStreamMock.mockRejectedValueOnce(
      new Error("TAURON_GUEST_UNAVAILABLE: subscribeStreamPackets needs the Tauron native transport"),
    );
    vi.mocked(invoke).mockRejectedValueOnce(new Error("invoke unavailable"));
    vi.mocked(invoke).mockResolvedValue(null);

    const dispose = await subscribeIpcStream<string>(
      { id: "stream-1", kind: "terminal-output" },
      payloadListener,
      { replayFromSequence: 0, releaseOnUnsubscribe: false },
    );

    expect(typeof dispose).toBe("function");
    expect(payloadListener).not.toHaveBeenCalled();
    dispose();
  });

  it("cleans up a late transport subscription registration after page unload starts", async () => {
    const payloadListener = vi.fn();
    const unlisten = vi.fn(async () => undefined);
    const registration = createDeferred<() => Promise<void>>();

    subscribeStreamMock.mockImplementation(() => registration.promise);

    const disposePromise = subscribeIpcStream(
      {
        id: "stream-1",
        kind: "terminal-output",
      },
      payloadListener,
    );

    window.dispatchEvent(new Event("pagehide"));
    registration.resolve(unlisten);
    const dispose = await disposePromise;

    expect(unlisten).toHaveBeenCalledTimes(1);
    dispose();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
