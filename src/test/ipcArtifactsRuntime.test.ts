import { beforeEach, describe, expect, it, vi } from "vitest";

const { convertFileSrcMock } = vi.hoisted(() => ({
  convertFileSrcMock: vi.fn((path: string) => `asset://${path}`),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: convertFileSrcMock,
  Channel: class<T = unknown> {
    onmessage?: ((message: T) => void) | null;
    send(message: T) {
      this.onmessage?.(message);
    }
  },
}));

vi.mock("../runtime/tauriClient", () => ({
  commands: {
    ipcReleaseArtifact: vi.fn(),
  },
  unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
    value?.status === "ok" ? value.data : value,
  ),
}));

import { commands } from "../runtime/tauriClient";
import {
  resolveIpcArtifactUrl,
  releaseIpcArtifact,
  toIpcArtifactRef,
} from "../runtime/ipc/artifacts";

describe("ipc artifact runtime", () => {
  beforeEach(() => {
    convertFileSrcMock.mockClear();
    vi.mocked(commands.ipcReleaseArtifact).mockReset();
    vi.mocked(commands.ipcReleaseArtifact).mockResolvedValue({
      status: "ok",
      data: null,
    });
  });

  it("resolves and caches backend artifact URLs by descriptor id", () => {
    const descriptor = {
      id: "artifact-1",
      kind: "thumbnail.poster",
      filePath: "/tmp/thumb.png",
      mediaType: "image/png",
      byteLength: 42,
      retention: "persistent",
      identityKey: "entity-1",
      contentRevision: "rev-1",
    } as const;

    const first = resolveIpcArtifactUrl(descriptor);
    const second = resolveIpcArtifactUrl(descriptor);

    expect(first).toBe("asset:///tmp/thumb.png");
    expect(second).toBe(first);
    expect(convertFileSrcMock).toHaveBeenCalledTimes(1);
  });

  it("converts descriptors into Python-safe artifact refs and releases them", async () => {
    const descriptor = {
      id: "artifact-2",
      kind: "preview.bytes",
      filePath: "/tmp/preview.bin",
      mediaType: null,
      byteLength: 7,
      retention: "ephemeral",
      identityKey: null,
      contentRevision: null,
    } as const;

    expect(toIpcArtifactRef(descriptor)).toEqual({
      id: "artifact-2",
      kind: "preview.bytes",
      filePath: "/tmp/preview.bin",
      mediaType: null,
      identityKey: null,
      contentRevision: null,
    });

    await releaseIpcArtifact(descriptor.id);

    expect(commands.ipcReleaseArtifact).toHaveBeenCalledWith("artifact-2");
  });
});
