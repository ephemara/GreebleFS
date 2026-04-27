import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  appLocalDataDirMock,
  convertFileSrcMock,
  createObjectURLMock,
  readFileMock,
  revokeObjectURLMock,
} = vi.hoisted(() => ({
  appLocalDataDirMock: vi.fn(
    async () => "/home/user/.local/share/co.greeblefs.app/",
  ),
  convertFileSrcMock: vi.fn((path: string) => `asset://${path}`),
  createObjectURLMock: vi.fn(() => "blob:artifact-blob-url"),
  readFileMock: vi.fn(async () => new Uint8Array([1, 2, 3])),
  revokeObjectURLMock: vi.fn(),
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

vi.mock("@tauri-apps/api/path", () => ({
  appLocalDataDir: appLocalDataDirMock,
  join: vi.fn(async (...segments: string[]) => segments.join("/")),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  BaseDirectory: {
    AppLocalData: "appLocalData",
  },
  mkdir: vi.fn(),
  readFile: readFileMock,
  writeFile: vi.fn(),
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
    vi.stubGlobal("Blob", Blob);
    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });
    appLocalDataDirMock.mockClear();
    convertFileSrcMock.mockClear();
    createObjectURLMock.mockClear();
    readFileMock.mockClear();
    revokeObjectURLMock.mockClear();
    vi.mocked(commands.ipcReleaseArtifact).mockReset();
    vi.mocked(commands.ipcReleaseArtifact).mockResolvedValue({
      status: "ok",
      data: null,
    });
  });

  it("hydrates app-local-data artifacts into cached blob URLs", async () => {
    const descriptor = {
      id: "artifact-1",
      kind: "thumbnail.poster",
      filePath:
        "/home/user/.local/share/co.greeblefs.app/explorer-thumbnails/artifacts/thumb.png",
      mediaType: "image/png",
      byteLength: 42,
      retention: "persistent",
      identityKey: "entity-1",
      contentRevision: "rev-1",
    } as const;

    const first = await resolveIpcArtifactUrl(descriptor);
    const second = await resolveIpcArtifactUrl(descriptor);

    expect(first).toBe("blob:artifact-blob-url");
    expect(second).toBe(first);
    expect(readFileMock).toHaveBeenCalledWith(
      "explorer-thumbnails/artifacts/thumb.png",
      { baseDir: "appLocalData" },
    );
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(convertFileSrcMock).not.toHaveBeenCalled();
  });

  it("falls back to Tauri asset URLs when byte hydration fails", async () => {
    readFileMock.mockRejectedValueOnce(new Error("403"));
    const descriptor = {
      id: "artifact-3",
      kind: "thumbnail.poster",
      filePath: "/tmp/thumb.png",
      mediaType: "image/png",
      byteLength: 42,
      retention: "persistent",
      identityKey: "entity-3",
      contentRevision: "rev-3",
    } as const;

    const resolved = await resolveIpcArtifactUrl(descriptor);

    expect(resolved).toBe("asset:///tmp/thumb.png");
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

    await resolveIpcArtifactUrl({
      ...descriptor,
      filePath:
        "/home/user/.local/share/co.greeblefs.app/explorer-thumbnails/artifacts/preview.bin",
      mediaType: "image/png",
      byteLength: 7,
      retention: "persistent",
      identityKey: "entity-2",
      contentRevision: "rev-2",
    });
    await releaseIpcArtifact(descriptor.id);

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:artifact-blob-url");
    expect(commands.ipcReleaseArtifact).toHaveBeenCalledWith("artifact-2");
  });
});
