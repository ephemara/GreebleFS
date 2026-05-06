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

  it("routes high-level file operations through declared extension-host methods", async () => {
    vi.mocked(commands.extensionHostCall).mockImplementation(async (request) => ({
      status: "ok",
      data: {
        methodId: request.methodId,
        resultJson: request.methodId === "files.stat"
          ? JSON.stringify({
            path: "C:/work/item.txt",
            exists: true,
            isDirectory: false,
            size: 12,
            modifiedMs: null,
            extension: "txt",
          })
          : request.methodId === "files.read_text"
            ? JSON.stringify("{\"ready\":true}")
            : "null",
      },
    }));

    const client = createExtensionHostClient({ callerPluginId: "file-plugin" });

    await client.files.createDirectory("C:/work/new-folder");
    await client.files.writeText("C:/work/item.txt", "hello");
    await client.files.writeJson("C:/work/state.json", { ready: true });
    await client.files.delete("C:/work/old", { recursive: true });
    await client.files.deleteMany(["C:/work/a", "C:/work/b"]);
    await client.files.rename("C:/work/old.txt", "C:/work/new.txt");
    await client.files.move("C:/work/src", "C:/work/dst");
    await client.files.copy("C:/work/src", "C:/work/copy");
    await client.files.trash(["C:/work/trash-me"]);

    expect(await client.files.exists("C:/work/item.txt")).toBe(true);
    await expect(client.files.readJson("C:/work/state.json")).resolves.toEqual({ ready: true });

    expect(vi.mocked(commands.extensionHostCall).mock.calls.map(([request]) => request.methodId)).toEqual([
      "files.create_directory",
      "files.write_text",
      "files.write_text",
      "files.delete",
      "files.delete_many",
      "files.rename",
      "files.move",
      "files.copy",
      "files.trash",
      "files.stat",
      "files.read_text",
    ]);
    expect(commands.extensionHostCall).toHaveBeenCalledWith(expect.objectContaining({
      callerPluginId: "file-plugin",
      methodId: "files.delete",
      payloadJson: JSON.stringify({
        path: "C:/work/old",
        recursive: true,
      }),
    }));
  });
});
