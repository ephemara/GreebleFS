import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscribeIpcStreamMock } = vi.hoisted(() => ({
  subscribeIpcStreamMock: vi.fn(),
}));

vi.mock("../runtime/ipc/streams", () => ({
  subscribeIpcStream: subscribeIpcStreamMock,
}));

vi.mock("../runtime/tauriClient", () => ({
  commands: {
    extensionHostCall: vi.fn(),
  },
  unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
    value?.status === "ok" ? value.data : value,
  ),
}));

import { createExtensionHostClient } from "../runtime/extensionHostApi";
import { subscribeIpcStream } from "../runtime/ipc/streams";
import { commands } from "../runtime/tauriClient";

describe("extensionHostApi events", () => {
  beforeEach(() => {
    subscribeIpcStreamMock.mockReset();
    vi.mocked(commands.extensionHostCall).mockReset();
    vi.mocked(subscribeIpcStream).mockResolvedValue(() => undefined);
  });

  it("requests retained host events when replayFrom is provided without includeSnapshot", async () => {
    const replayedEvent = {
      eventId: "event-2",
      subscriptionId: null,
      topic: "tasks.output",
      sequence: 2,
      emittedAtMs: 12,
      delivery: "push",
      scope: { taskId: "task-a" },
      payloadJson: "{\"chunk\":\"hello\"}",
      executionContext: null,
      snapshot: false,
    };
    vi.mocked(commands.extensionHostCall).mockImplementation(async (request) => {
      if (request.methodId === "events.subscribe") {
        return {
          status: "ok",
          data: {
            methodId: request.methodId,
            resultJson: JSON.stringify({
              subscriptionId: "subscription-1",
              topics: ["tasks.output"],
              transport: "ipc-stream",
              supported: true,
              streamHandle: {
                id: "stream-1",
                kind: "host-events",
              },
            }),
          },
        };
      }
      if (request.methodId === "events.get_snapshot") {
        return {
          status: "ok",
          data: {
            methodId: request.methodId,
            resultJson: JSON.stringify([replayedEvent]),
          },
        };
      }
      throw new Error(`Unexpected method ${request.methodId}`);
    });

    const listener = vi.fn();
    const client = createExtensionHostClient();
    await client.events.subscribe(
      {
        topics: ["tasks.output"],
        includeSnapshot: false,
        replayFrom: 1,
      },
      listener,
    );

    expect(commands.extensionHostCall).toHaveBeenCalledWith(
      expect.objectContaining({
        methodId: "events.get_snapshot",
        payloadJson: JSON.stringify({
          topics: ["tasks.output"],
          includeSnapshot: false,
          replayFrom: 1,
        }),
      }),
    );
    expect(listener).toHaveBeenCalledWith({
      ...replayedEvent,
      subscriptionId: "subscription-1",
    });
    expect(subscribeIpcStream).toHaveBeenCalledWith(
      expect.objectContaining({ id: "stream-1" }),
      listener,
      { releaseOnUnsubscribe: false },
    );
  });
});
