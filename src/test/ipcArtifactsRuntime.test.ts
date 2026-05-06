import { beforeEach, describe, expect, it, vi } from "vitest";

const { resourceUrlMock } = vi.hoisted(() => ({
  resourceUrlMock: vi.fn((rid: number) => `transport://localhost/${rid}`),
}));

vi.mock("@tauri-apps/api/transport", () => ({
  resourceUrl: resourceUrlMock,
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
  releaseIpcArtifact,
  resolveIpcArtifactUrl,
  toIpcArtifactRef,
} from "../runtime/ipc/artifacts";

describe("ipc artifact runtime", () => {
  beforeEach(() => {
    resourceUrlMock.mockClear();
    vi.mocked(commands.ipcReleaseArtifact).mockReset();
    vi.mocked(commands.ipcReleaseArtifact).mockResolvedValue({
      status: "ok",
      data: null,
    });
  });

  it("resolves and caches transport resource URLs by artifact id", async () => {
    const descriptor = {
      id: "artifact-1",
      kind: "thumbnail.poster",
      resourceRid: 41,
      mediaType: "image/png",
      byteLength: 42,
      retention: "persistent",
      identityKey: "entity-1",
      contentRevision: "rev-1",
    } as const;

    const first = await resolveIpcArtifactUrl(descriptor);
    const second = await resolveIpcArtifactUrl(descriptor);

    expect(first).toBe("transport://localhost/41");
    expect(second).toBe(first);
    expect(resourceUrlMock).toHaveBeenCalledTimes(1);
    expect(resourceUrlMock).toHaveBeenCalledWith(41);
  });

  it("converts descriptors into Python-safe artifact refs and clears cached URLs on release", async () => {
    const descriptor = {
      id: "artifact-2",
      kind: "preview.bytes",
      resourceRid: 7,
      mediaType: null,
      byteLength: 7,
      retention: "ephemeral",
      identityKey: null,
      contentRevision: null,
    } as const;

    expect(toIpcArtifactRef(descriptor)).toEqual({
      id: "artifact-2",
      kind: "preview.bytes",
      resourceRid: 7,
      mediaType: null,
      identityKey: null,
      contentRevision: null,
    });

    await resolveIpcArtifactUrl(descriptor);
    await releaseIpcArtifact(descriptor.id);
    await resolveIpcArtifactUrl(descriptor);

    expect(commands.ipcReleaseArtifact).toHaveBeenCalledWith("artifact-2");
    expect(resourceUrlMock).toHaveBeenCalledTimes(2);
  });
});
