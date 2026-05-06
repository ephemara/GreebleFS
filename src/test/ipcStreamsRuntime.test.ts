import { beforeEach, describe, expect, it, vi } from "vitest";

const { listenMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

vi.mock("../runtime/tauriClient", () => ({
  commands: {
    ipcReleaseStream: vi.fn(),
    ipcReplayStream: vi.fn(),
  },
  unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
    value?.status === "ok" ? value.data : value,
  ),
}));

import { commands } from "../runtime/tauriClient";
import { resetDeferredUnlistenForTests } from "../runtime/deferredUnlisten";
import { subscribeIpcStream } from "../runtime/ipc/streams";

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
    listenMock.mockReset();
    vi.mocked(commands.ipcReleaseStream).mockReset();
    vi.mocked(commands.ipcReplayStream).mockReset();
    vi.mocked(commands.ipcReleaseStream).mockResolvedValue({
      status: "ok",
      data: null,
    });
    vi.mocked(commands.ipcReplayStream).mockResolvedValue({
      status: "ok",
      data: {
        streamId: "stream-1",
        packets: [],
        replayGap: null,
        telemetry: {
          retainedMessages: 0,
          retainedBytes: 0,
          oldestSequence: null,
          nextSequence: 0,
          totalWrittenMessages: 0,
          totalWrittenBytes: 0,
          chunkedMessages: 0,
          overflow: {
            overflowed: false,
            overflowCount: 0,
            droppedMessages: 0,
            droppedBytes: 0,
            firstDroppedSequence: null,
            latestDroppedSequence: null,
          },
        },
      },
    });
  });

  it("forwards ordered payloads and releases the shared stream on teardown", async () => {
    const payloadListener = vi.fn();
    const unlisten = vi.fn();
    const eventHandlerRef: {
      current: ((event: { payload: unknown }) => void) | null;
    } = { current: null };

    listenMock.mockImplementation(
      async (_eventName: string, handler: unknown) => {
        eventHandlerRef.current = handler as (event: { payload: unknown }) => void;
        return unlisten;
      },
    );

    const dispose = await subscribeIpcStream(
      {
        id: "stream-1",
        kind: "terminal-output",
        eventName: "ipc-stream-terminal-output-preview-pane-0",
      },
      payloadListener,
    );

    const capturedHandler = eventHandlerRef.current;
    if (!capturedHandler) {
      throw new Error("Missing IPC stream event handler");
    }

    capturedHandler({
      payload: {
        metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1 },
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
    expect(commands.ipcReleaseStream).toHaveBeenCalledWith("stream-1");
  });

  it("replays retained packets and dedupes live packets by stream sequence", async () => {
    const payloadListener = vi.fn();
    const unlisten = vi.fn();
    const eventHandlerRef: {
      current: ((event: { payload: unknown }) => void) | null;
    } = { current: null };

    listenMock.mockImplementation(
      async (_eventName: string, handler: unknown) => {
        eventHandlerRef.current = handler as (event: { payload: unknown }) => void;
        return unlisten;
      },
    );
    vi.mocked(commands.ipcReplayStream).mockResolvedValueOnce({
      status: "ok",
      data: {
        streamId: "stream-1",
        packets: [
          {
            metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1 },
            frameMetadata: {
              sequence: 0,
              emittedAtEpochMs: 1,
              byteLength: 96,
              frameIndex: 0,
              frameCount: 1,
              chunked: false,
            },
            payloadJson: JSON.stringify({
              metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1 },
              terminalId: "preview-pane-0",
              data: "retained",
            }),
          },
        ],
        replayGap: null,
        telemetry: {
          retainedMessages: 1,
          retainedBytes: 96,
          oldestSequence: 0,
          nextSequence: 1,
          totalWrittenMessages: 1,
          totalWrittenBytes: 96,
          chunkedMessages: 0,
          overflow: {
            overflowed: false,
            overflowCount: 0,
            droppedMessages: 0,
            droppedBytes: 0,
            firstDroppedSequence: null,
            latestDroppedSequence: null,
          },
        },
      },
    });

    const dispose = await subscribeIpcStream(
      {
        id: "stream-1",
        kind: "terminal-output",
        eventName: "ipc-stream-terminal-output-preview-pane-0",
      },
      payloadListener,
      { replayFromSequence: 0, releaseOnUnsubscribe: false },
    );

    const capturedHandler = eventHandlerRef.current;
    if (!capturedHandler) {
      throw new Error("Missing IPC stream event handler");
    }
    capturedHandler({
      payload: {
        metadata: { streamId: "stream-1", sequence: 0, emittedAtEpochMs: 1 },
        terminalId: "preview-pane-0",
        data: "duplicate-live",
      },
    });
    capturedHandler({
      payload: {
        metadata: { streamId: "stream-1", sequence: 1, emittedAtEpochMs: 2 },
        terminalId: "preview-pane-0",
        data: "live",
      },
    });

    expect(commands.ipcReplayStream).toHaveBeenCalledWith("stream-1", 0, null);
    expect(payloadListener).toHaveBeenCalledTimes(2);
    expect(payloadListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: "retained" }),
    );
    expect(payloadListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: "live" }),
    );

    dispose();
    expect(commands.ipcReleaseStream).not.toHaveBeenCalled();
  });

  it("cleans up a late stream listener registration after page unload starts", async () => {
    const payloadListener = vi.fn();
    const unlisten = vi.fn();
    const registration = createDeferred<() => void>();

    listenMock.mockImplementation(() => registration.promise);

    const disposePromise = subscribeIpcStream(
      {
        id: "stream-1",
        kind: "terminal-output",
        eventName: "ipc-stream-terminal-output-preview-pane-0",
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
