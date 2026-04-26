import { convertFileSrc } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import type {
  IpcArtifactDescriptor,
  IpcArtifactRef,
  IpcArtifactRetention,
  IpcRegisterArtifactPathRequest,
} from "../../generated/tauri";
import { commands, unwrapTauriResult } from "../tauriClient";

const ipcArtifactUrlCache = new Map<string, string>();
const FRONTEND_IPC_ARTIFACT_ROOT = "ipc-artifacts/frontend";

export type ManagedIpcArtifactDescriptor = IpcArtifactDescriptor;
export type ManagedIpcArtifactRef = IpcArtifactRef;
export type ManagedIpcArtifactRetention = IpcArtifactRetention;

export interface StageIpcArtifactBytesRequest {
  kind: string;
  bytes: Uint8Array;
  mediaType?: string | null;
  retention?: ManagedIpcArtifactRetention | null;
  identityKey?: string | null;
  contentRevision?: string | null;
  deleteOnRelease?: boolean | null;
  relativePath?: string | null;
  suggestedFileName?: string | null;
}

export function toIpcArtifactRef(
  descriptor: ManagedIpcArtifactDescriptor,
): ManagedIpcArtifactRef {
  return {
    id: descriptor.id,
    kind: descriptor.kind,
    filePath: descriptor.filePath,
    mediaType: descriptor.mediaType,
    identityKey: descriptor.identityKey,
    contentRevision: descriptor.contentRevision,
  };
}

export function resolveIpcArtifactUrl(
  descriptor: ManagedIpcArtifactDescriptor,
): string {
  const cachedUrl = ipcArtifactUrlCache.get(descriptor.id);
  if (cachedUrl) {
    return cachedUrl;
  }

  const nextUrl = toLocalAssetUrl(descriptor.filePath);
  ipcArtifactUrlCache.set(descriptor.id, nextUrl);
  return nextUrl;
}

export async function stageIpcArtifactBytes(
  request: StageIpcArtifactBytesRequest,
): Promise<ManagedIpcArtifactDescriptor> {
  const retention = request.retention ?? "ephemeral";
  const deleteOnRelease =
    request.deleteOnRelease ?? retention === "ephemeral";
  const relativePath =
    normalizeRelativeArtifactPath(request.relativePath) ??
    buildDefaultFrontendArtifactRelativePath(
      request.kind,
      request.suggestedFileName,
      request.mediaType ?? null,
    );

  const parentDirectory = relativePath.includes("/")
    ? relativePath.slice(0, relativePath.lastIndexOf("/"))
    : "";
  if (parentDirectory) {
    await mkdir(parentDirectory, {
      baseDir: BaseDirectory.AppLocalData,
      recursive: true,
    });
  }
  await writeFile(relativePath, request.bytes, {
    baseDir: BaseDirectory.AppLocalData,
  });

  const absolutePath = await join(
    normalizeDirectoryPath(await appLocalDataDir()),
    relativePath,
  );
  return unwrapTauriResult(
    await commands.ipcRegisterArtifactPath({
      kind: request.kind,
      filePath: absolutePath,
      mediaType: request.mediaType ?? null,
      retention,
      identityKey: request.identityKey ?? null,
      contentRevision: request.contentRevision ?? null,
      deleteOnRelease,
    } satisfies IpcRegisterArtifactPathRequest),
  );
}

export async function releaseIpcArtifact(
  artifact: string | ManagedIpcArtifactDescriptor,
): Promise<void> {
  const id = typeof artifact === "string" ? artifact : artifact.id;
  ipcArtifactUrlCache.delete(id);
  unwrapTauriResult(await commands.ipcReleaseArtifact(id));
}

function toLocalAssetUrl(filePath: string): string {
  if (typeof window === "undefined") {
    return filePath;
  }

  try {
    return convertFileSrc(filePath);
  } catch {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return normalizedPath.startsWith("/")
      ? `file://${encodeURI(normalizedPath)}`
      : `file:///${encodeURI(normalizedPath)}`;
  }
}

function buildDefaultFrontendArtifactRelativePath(
  kind: string,
  suggestedFileName: string | null | undefined,
  mediaType: string | null,
): string {
  const artifactId = createFrontendArtifactId();
  const safeKind = sanitizeArtifactSegment(kind || "artifact");
  const fileName = sanitizeArtifactFileName(
    suggestedFileName || `${safeKind}-${artifactId}${resolveFileExtension(mediaType)}`,
  );
  return `${FRONTEND_IPC_ARTIFACT_ROOT}/${safeKind}/${fileName}`;
}

function createFrontendArtifactId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeArtifactSegment(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "artifact";
}

function sanitizeArtifactFileName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "artifact.bin";
  }

  const sanitized = trimmed
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "artifact.bin";
}

function normalizeRelativeArtifactPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized || null;
}

function normalizeDirectoryPath(value: string): string {
  return value.replace(/[\\/]+$/, "");
}

function resolveFileExtension(mediaType: string | null): string {
  switch ((mediaType || "").toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".bin";
  }
}
