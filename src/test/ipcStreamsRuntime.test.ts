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
  },
  unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
    value?.status === "ok" ? value.data : value,
  ),
}));

import { commands } from "../runtime/tauriClient";
import { subscribeIpcStream } from "../runtime/ipc/streams";

describe("ipc stream runtime", () => {
  beforeEach(() => {
    listenMock.mockReset();
    vi.mocked(commands.ipcReleaseStream).mockReset();
    vi.mocked(commands.ipcReleaseStream).mockResolvedValue({
      status: "ok",
      data: null,
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
});
