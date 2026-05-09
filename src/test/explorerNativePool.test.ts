import { describe, expect, it, vi } from "vitest";
import {
  decodeExplorerDirectorySnapshot,
  readLocalExplorerPreviewBytesViaNativePool,
} from "../runtime/explorerNativePool";

const nativeBufferPoolMock = vi.hoisted(() => ({
  isNativeBufferPoolAvailable: vi.fn(() => true),
  nativeBufferPoolTelemetry: vi.fn(),
  withNativePooledBufferOnce: vi.fn(),
}));

vi.mock("@tauri-apps/api/native-buffer-pool", () => nativeBufferPoolMock);

function pushUtf8(table: number[], value: string): [number, number] {
  const bytes = [...new TextEncoder().encode(value)];
  const offset = table.length;
  table.push(...bytes);
  return [offset, bytes.length];
}

function writeU16(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >> 8) & 0xff);
}

function writeU32(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function writeU64(bytes: number[], value: bigint): void {
  for (let index = 0n; index < 8n; index += 1n) {
    bytes.push(Number((value >> (index * 8n)) & 0xffn));
  }
}

function createDirectorySnapshotFixture(): Uint8Array {
  const strings: number[] = [];
  const name = pushUtf8(strings, "unicodé.txt");
  const path = pushUtf8(strings, "D:/demo/unicodé.txt");
  const extension = pushUtf8(strings, "txt");
  const entityId = pushUtf8(strings, "entity-1");
  const contentRevision = pushUtf8(strings, "rev-1");
  const bytes: number[] = [];

  bytes.push(...new TextEncoder().encode("GFLS"));
  writeU16(bytes, 1);
  writeU16(bytes, 32);
  writeU32(bytes, 1);
  writeU32(bytes, 64);
  writeU32(bytes, 32);
  writeU32(bytes, 96);
  writeU32(bytes, strings.length);
  writeU32(bytes, 0);

  for (const [offset, length] of [name, path, extension, entityId, contentRevision]) {
    writeU32(bytes, offset);
    writeU32(bytes, length);
  }
  writeU64(bytes, 42n);
  writeU64(bytes, 1_700_000_000_000n);
  writeU32(bytes, 0b110);
  writeU16(bytes, 1);
  writeU16(bytes, 0);
  bytes.push(...strings);
  return new Uint8Array(bytes);
}

describe("explorer native pool snapshots", () => {
  it("decodes directory listing snapshot v1 into FileEntry objects", () => {
    const entries = decodeExplorerDirectorySnapshot(createDirectorySnapshotFixture());

    expect(entries).toEqual([
      {
        name: "unicodé.txt",
        path: "D:/demo/unicodé.txt",
        is_dir: false,
        size: 42,
        modified: 1_700_000_000_000,
        extension: "txt",
        is_hidden: true,
        is_symlink: true,
        entityId: "entity-1",
        identityKind: "operation",
        contentRevision: "rev-1",
      },
    ]);
  });

  it("copies preview bytes out of the pooled buffer before release", async () => {
    const sharedBytes = new Uint8Array([1, 2, 3]);
    nativeBufferPoolMock.withNativePooledBufferOnce.mockImplementationOnce(async (options) =>
      options.decode(sharedBytes, {
        streamId: "preview",
        sequence: 0,
        byteLength: sharedBytes.byteLength,
        buffer: { id: 1, generation: 1, sizeClass: 4096, byteLength: 3 },
      }),
    );

    const result = await readLocalExplorerPreviewBytesViaNativePool("D:/demo/a.bin", 3);
    sharedBytes[0] = 9;

    expect([...result]).toEqual([1, 2, 3]);
    expect(nativeBufferPoolMock.withNativePooledBufferOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "explorer",
        method: "readPreviewBytes",
        args: { path: "D:/demo/a.bin", maxBytes: 3 },
      }),
    );
  });
});
