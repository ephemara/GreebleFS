import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExplorerArchiveVirtualPath } from "../config/explorerArchives";
import { commands } from "../runtime/tauriClient";
import {
  invalidateExplorerDirectoryResultCaches,
  loadCachedExplorerLocation,
  listExplorerLocation,
  navigateExplorerPolicySession,
  readExplorerPreviewCachePayload,
  readExplorerPreviewBytes,
  type ExplorerFileEntry,
} from "../runtime/explorerBackend";
import { listLocalDirectoryEntriesFast } from "../runtime/localDirectoryListing";

const nativePoolRuntimeMock = vi.hoisted(() => ({
  available: true,
  isExplorerNativePoolAvailable: vi.fn(() => nativePoolRuntimeMock.available),
  listIndexedExplorerDirectorySnapshotViaNativePool: vi.fn(),
  listLocalExplorerDirectorySnapshotViaNativePool: vi.fn(),
  readArchiveEntryExplorerPreviewBytesViaNativePool: vi.fn(),
  readLocalExplorerPreviewBytesViaNativePool: vi.fn(),
  recordExplorerNativePoolAttempt: vi.fn(),
  recordExplorerNativePoolFallback: vi.fn(),
  recordExplorerNativePoolSuccess: vi.fn(),
}));

vi.mock("../runtime/explorerNativePool", () => nativePoolRuntimeMock);

function fileEntry(path: string): ExplorerFileEntry {
  return {
    name: path.split(/[\\/]/).pop() ?? path,
    path,
    is_dir: false,
    size: 3,
    modified: 1,
    extension: "txt",
    is_hidden: false,
    is_symlink: false,
    entityId: `entity:${path}`,
    identityKind: "derived",
    contentRevision: "rev",
  };
}

describe("explorer backend native pool routing", () => {
  beforeEach(() => {
    nativePoolRuntimeMock.available = true;
    nativePoolRuntimeMock.listIndexedExplorerDirectorySnapshotViaNativePool.mockReset();
    nativePoolRuntimeMock.listIndexedExplorerDirectorySnapshotViaNativePool.mockRejectedValue(
      new Error("indexed snapshot not ready"),
    );
    nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool.mockReset();
    nativePoolRuntimeMock.readArchiveEntryExplorerPreviewBytesViaNativePool.mockReset();
    nativePoolRuntimeMock.readLocalExplorerPreviewBytesViaNativePool.mockReset();
    nativePoolRuntimeMock.recordExplorerNativePoolAttempt.mockClear();
    nativePoolRuntimeMock.recordExplorerNativePoolFallback.mockClear();
    nativePoolRuntimeMock.recordExplorerNativePoolSuccess.mockClear();
    invalidateExplorerDirectoryResultCaches();
    vi.restoreAllMocks();
  });

  it("prefers native pooled snapshots for local directory listings", async () => {
    const nativeEntry = fileEntry("D:/demo/native.txt");
    const fsListSpy = vi.spyOn(commands, "fsListDir");
    nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool.mockResolvedValue(
      [nativeEntry],
    );

    const listing = await listExplorerLocation("D:/demo", false);

    expect(listing.entries).toEqual([nativeEntry]);
    expect(fsListSpy).not.toHaveBeenCalled();
    expect(
      nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool,
    ).toHaveBeenCalledWith({
      path: "D:/demo",
      showHidden: false,
      bypassCache: false,
    });
    expect(
      nativePoolRuntimeMock.recordExplorerNativePoolSuccess,
    ).toHaveBeenCalledWith("directoryListingSnapshots");
  });

  it("keeps generic local directory discovery off the durable path index by default", async () => {
    const nativeEntry = fileEntry("D:/catalog/native.txt");
    nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool.mockResolvedValue(
      [nativeEntry],
    );

    const entries = await listLocalDirectoryEntriesFast("D:/catalog");

    expect(entries).toEqual([nativeEntry]);
    expect(
      nativePoolRuntimeMock.listIndexedExplorerDirectorySnapshotViaNativePool,
    ).not.toHaveBeenCalled();
    expect(
      nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool,
    ).toHaveBeenCalledWith({
      path: "D:/catalog",
      showHidden: false,
      bypassCache: false,
    });
  });

  it("prefers indexed native pooled snapshots before live directory snapshots", async () => {
    const indexedEntry = fileEntry("D:/indexed/from-index.txt");
    const fsListSpy = vi.spyOn(commands, "fsListDir");
    nativePoolRuntimeMock.listIndexedExplorerDirectorySnapshotViaNativePool.mockResolvedValue(
      [indexedEntry],
    );

    const listing = await listExplorerLocation("D:/indexed", false);

    expect(listing.entries).toEqual([indexedEntry]);
    expect(
      nativePoolRuntimeMock.listIndexedExplorerDirectorySnapshotViaNativePool,
    ).toHaveBeenCalledWith({
      path: "D:/indexed",
      showHidden: false,
    });
    expect(
      nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool,
    ).not.toHaveBeenCalled();
    expect(fsListSpy).not.toHaveBeenCalled();
    expect(
      nativePoolRuntimeMock.recordExplorerNativePoolSuccess,
    ).toHaveBeenCalledWith("pathIndexDirectorySnapshots");
  });

  it("reuses warmed local directory listings when policy navigation opens the same folder", async () => {
    const nativeEntry = fileEntry("D:/warm/native.txt");
    nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool.mockResolvedValue(
      [nativeEntry],
    );

    await loadCachedExplorerLocation({
      path: "D:/warm",
      showHidden: false,
      listLocation: listExplorerLocation,
    });
    const navigation = await navigateExplorerPolicySession({
      sessionId: "native-pool-warm-cache",
      path: "D:/warm",
      pushHistory: true,
      historyIndex: null,
      showHidden: false,
    });

    expect(navigation.listing?.entries).toEqual([nativeEntry]);
    expect(
      nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool,
    ).toHaveBeenCalledTimes(1);
  });

  it("falls back to invoke directory listing when the native pooled snapshot fails", async () => {
    const fallbackEntry = fileEntry("D:/demo/fallback.txt");
    nativePoolRuntimeMock.listLocalExplorerDirectorySnapshotViaNativePool.mockRejectedValue(
      new Error("pool unavailable"),
    );
    vi.spyOn(commands, "fsListDir").mockResolvedValue({
      status: "ok",
      data: [fallbackEntry],
    });

    const listing = await listExplorerLocation("D:/demo", false);

    expect(listing.entries).toEqual([fallbackEntry]);
    expect(
      nativePoolRuntimeMock.recordExplorerNativePoolFallback,
    ).toHaveBeenCalledWith("directoryListingSnapshots", expect.any(Error));
  });

  it("uses native pooled preview bytes for local and archive paths", async () => {
    nativePoolRuntimeMock.readLocalExplorerPreviewBytesViaNativePool.mockResolvedValue(
      new Uint8Array([1, 2, 3]),
    );
    nativePoolRuntimeMock.readArchiveEntryExplorerPreviewBytesViaNativePool.mockResolvedValue(
      new Uint8Array([4, 5, 6]),
    );
    const localInvokeSpy = vi.spyOn(commands, "fsReadPreviewBytes");
    const archiveInvokeSpy = vi.spyOn(
      commands,
      "fsReadArchiveEntryPreviewBytes",
    );

    const localBytes = await readExplorerPreviewBytes("D:/demo/a.bin", 3);
    const archiveBytes = await readExplorerPreviewBytes(
      buildExplorerArchiveVirtualPath({
        archivePath: "D:/demo/archive.zip",
        entryPath: "docs/readme.txt",
      }),
      6,
    );

    expect([...localBytes]).toEqual([1, 2, 3]);
    expect([...archiveBytes]).toEqual([4, 5, 6]);
    expect(localInvokeSpy).not.toHaveBeenCalled();
    expect(archiveInvokeSpy).not.toHaveBeenCalled();
  });

  it("builds local preview cache payloads through native pooled bytes", async () => {
    nativePoolRuntimeMock.readLocalExplorerPreviewBytesViaNativePool.mockResolvedValue(
      new TextEncoder().encode("prefetched text"),
    );
    const textInvokeSpy = vi.spyOn(commands, "fsReadTextFile");
    const base64InvokeSpy = vi.spyOn(commands, "fsReadFileBase64");

    const payload = await readExplorerPreviewCachePayload(
      {
        path: "D:/demo/prefetch.txt",
        previewKind: "text",
        maxBytes: 1024,
      },
      {
        priority: "prefetch",
        workKey: "text:D:/demo/prefetch.txt",
      },
    );

    expect(payload.value).toBe("prefetched text");
    expect(payload.sourceBytes).toBe("prefetched text".length);
    expect(
      nativePoolRuntimeMock.readLocalExplorerPreviewBytesViaNativePool,
    ).toHaveBeenCalledWith("D:/demo/prefetch.txt", 1024);
    expect(textInvokeSpy).not.toHaveBeenCalled();
    expect(base64InvokeSpy).not.toHaveBeenCalled();
  });

  it("keeps cloud preview bytes on the binary invoke fallback", async () => {
    vi.spyOn(commands, "cloudReadPreviewBytes").mockResolvedValue(
      new Uint8Array([9]),
    );

    const bytes = await readExplorerPreviewBytes("cloud://demo/file.bin", 1);

    expect([...bytes]).toEqual([9]);
    expect(
      nativePoolRuntimeMock.readLocalExplorerPreviewBytesViaNativePool,
    ).not.toHaveBeenCalled();
    expect(
      nativePoolRuntimeMock.readArchiveEntryExplorerPreviewBytesViaNativePool,
    ).not.toHaveBeenCalled();
  });
});
