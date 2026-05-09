import {
  isNativeBufferPoolAvailable,
  nativeBufferPoolTelemetry,
  withNativePooledBufferOnce,
  type NativeBufferPoolTelemetry,
} from "@tauri-apps/api/native-buffer-pool";
import { recordDevObservatoryEvent } from "@tauri-apps/api/dev-observatory";
import type { FileEntry } from "../generated/tauri";
import type { GreebleNativeLaneSystemId } from "../config/nativeLaneMigration";

const DIRECTORY_SNAPSHOT_MAGIC = "GFLS";
const DIRECTORY_SNAPSHOT_VERSION = 1;
const DIRECTORY_SNAPSHOT_HEADER_BYTES = 32;
const DIRECTORY_SNAPSHOT_RECORD_STRIDE = 64;

export interface ExplorerNativePoolFallbackRecord {
  systemId: GreebleNativeLaneSystemId;
  reason: string;
  atEpochMs: number;
}

export interface ExplorerNativePoolTelemetry {
  attempts: Partial<Record<GreebleNativeLaneSystemId, number>>;
  successes: Partial<Record<GreebleNativeLaneSystemId, number>>;
  fallbacks: ExplorerNativePoolFallbackRecord[];
}

const nativePoolTelemetry: ExplorerNativePoolTelemetry = {
  attempts: {},
  successes: {},
  fallbacks: [],
};

const textDecoder = new TextDecoder("utf-8", { fatal: true });

export function isExplorerNativePoolAvailable(): boolean {
  return isNativeBufferPoolAvailable();
}

export async function getExplorerNativeBufferPoolTelemetry(): Promise<NativeBufferPoolTelemetry> {
  return nativeBufferPoolTelemetry();
}

export function getExplorerNativePoolTelemetrySnapshot(): ExplorerNativePoolTelemetry {
  return {
    attempts: { ...nativePoolTelemetry.attempts },
    successes: { ...nativePoolTelemetry.successes },
    fallbacks: [...nativePoolTelemetry.fallbacks],
  };
}

export function recordExplorerNativePoolAttempt(systemId: GreebleNativeLaneSystemId): void {
  nativePoolTelemetry.attempts[systemId] =
    (nativePoolTelemetry.attempts[systemId] ?? 0) + 1;
  publishExplorerNativePoolEvent("info", "attempt", systemId);
}

export function recordExplorerNativePoolSuccess(systemId: GreebleNativeLaneSystemId): void {
  nativePoolTelemetry.successes[systemId] =
    (nativePoolTelemetry.successes[systemId] ?? 0) + 1;
  publishExplorerNativePoolEvent("info", "success", systemId);
}

export function recordExplorerNativePoolFallback(
  systemId: GreebleNativeLaneSystemId,
  reason: unknown,
): void {
  nativePoolTelemetry.fallbacks.push({
    systemId,
    reason: String(reason instanceof Error ? reason.message : reason),
    atEpochMs: Date.now(),
  });
  if (nativePoolTelemetry.fallbacks.length > 64) {
    nativePoolTelemetry.fallbacks.splice(0, nativePoolTelemetry.fallbacks.length - 64);
  }
  publishExplorerNativePoolEvent("warn", "fallback", systemId, {
    reason: String(reason instanceof Error ? reason.message : reason),
  });
}

export async function listLocalExplorerDirectorySnapshotViaNativePool(args: {
  path: string;
  showHidden: boolean;
  bypassCache?: boolean;
}): Promise<FileEntry[]> {
  return withNativePooledBufferOnce({
    namespace: "explorer",
    method: "listDirSnapshot",
    args,
    timeoutMs: 8000,
    decode: decodeExplorerDirectorySnapshot,
  });
}

export async function readLocalExplorerPreviewBytesViaNativePool(
  path: string,
  maxBytes: number,
): Promise<Uint8Array> {
  return withNativePooledBufferOnce({
    namespace: "explorer",
    method: "readPreviewBytes",
    args: { path, maxBytes },
    timeoutMs: 8000,
    decode: copyNativePoolBytes,
  });
}

export async function readArchiveEntryExplorerPreviewBytesViaNativePool(args: {
  archivePath: string;
  entryPath: string;
  maxBytes: number;
}): Promise<Uint8Array> {
  return withNativePooledBufferOnce({
    namespace: "explorer",
    method: "readArchiveEntryPreviewBytes",
    args,
    timeoutMs: 8000,
    decode: copyNativePoolBytes,
  });
}

export function decodeExplorerDirectorySnapshot(bytes: Uint8Array): FileEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < DIRECTORY_SNAPSHOT_HEADER_BYTES) {
    throw new Error("Directory snapshot is shorter than the v1 header");
  }
  const magic = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  if (magic !== DIRECTORY_SNAPSHOT_MAGIC) {
    throw new Error(`Invalid directory snapshot magic: ${magic}`);
  }

  const version = view.getUint16(4, true);
  const headerBytes = view.getUint16(6, true);
  const entryCount = view.getUint32(8, true);
  const recordStride = view.getUint32(12, true);
  const recordTableOffset = view.getUint32(16, true);
  const stringTableOffset = view.getUint32(20, true);
  const stringTableBytes = view.getUint32(24, true);

  if (version !== DIRECTORY_SNAPSHOT_VERSION) {
    throw new Error(`Unsupported directory snapshot version: ${version}`);
  }
  if (headerBytes !== DIRECTORY_SNAPSHOT_HEADER_BYTES) {
    throw new Error(`Unsupported directory snapshot header size: ${headerBytes}`);
  }
  if (recordStride !== DIRECTORY_SNAPSHOT_RECORD_STRIDE) {
    throw new Error(`Unsupported directory snapshot record stride: ${recordStride}`);
  }

  const recordTableEnd = recordTableOffset + entryCount * recordStride;
  const stringTableEnd = stringTableOffset + stringTableBytes;
  if (recordTableEnd > bytes.byteLength || stringTableEnd > bytes.byteLength) {
    throw new Error("Directory snapshot tables exceed payload length");
  }

  const entries: FileEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    const recordOffset = recordTableOffset + index * recordStride;
    const flags = view.getUint32(recordOffset + 56, true);
    entries.push({
      name: readSnapshotString(bytes, view, stringTableOffset, stringTableBytes, recordOffset),
      path: readSnapshotString(bytes, view, stringTableOffset, stringTableBytes, recordOffset + 8),
      is_dir: (flags & 1) !== 0,
      size: Number(view.getBigUint64(recordOffset + 40, true)),
      modified: Number(view.getBigUint64(recordOffset + 48, true)),
      extension: readSnapshotString(
        bytes,
        view,
        stringTableOffset,
        stringTableBytes,
        recordOffset + 16,
      ),
      is_hidden: (flags & 2) !== 0,
      is_symlink: (flags & 4) !== 0,
      entityId: readSnapshotString(
        bytes,
        view,
        stringTableOffset,
        stringTableBytes,
        recordOffset + 24,
      ),
      identityKind: decodeSnapshotIdentityKind(view.getUint16(recordOffset + 60, true)),
      contentRevision: readSnapshotString(
        bytes,
        view,
        stringTableOffset,
        stringTableBytes,
        recordOffset + 32,
      ),
    });
  }
  return entries;
}

function copyNativePoolBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function readSnapshotString(
  bytes: Uint8Array,
  view: DataView,
  stringTableOffset: number,
  stringTableBytes: number,
  recordFieldOffset: number,
): string {
  const relativeOffset = view.getUint32(recordFieldOffset, true);
  const byteLength = view.getUint32(recordFieldOffset + 4, true);
  if (relativeOffset + byteLength > stringTableBytes) {
    throw new Error("Directory snapshot string range exceeds string table");
  }
  const start = stringTableOffset + relativeOffset;
  return textDecoder.decode(bytes.subarray(start, start + byteLength));
}

function decodeSnapshotIdentityKind(value: number): FileEntry["identityKind"] {
  switch (value) {
    case 0:
      return "native";
    case 1:
      return "operation";
    case 2:
      return "derived";
    default:
      throw new Error(`Unsupported directory snapshot identity kind: ${value}`);
  }
}

function publishExplorerNativePoolEvent(
  severity: "info" | "warn",
  action: "attempt" | "success" | "fallback",
  systemId: GreebleNativeLaneSystemId,
  payload: Record<string, unknown> = {},
): void {
  void recordDevObservatoryEvent({
    source: "greeblefs.explorerNativePool",
    severity,
    message: `native buffer pool ${action}: ${systemId}`,
    lane: "native_buffer_pool",
    systemId,
    payload: {
      action,
      telemetry: getExplorerNativePoolTelemetrySnapshot(),
      ...payload,
    },
  }).catch(() => undefined);
}
