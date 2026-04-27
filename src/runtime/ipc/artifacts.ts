import { convertFileSrc } from "@tauri-apps/api/core";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import type {
  IpcArtifactDescriptor,
  IpcArtifactRef,
  IpcArtifactRetention,
  IpcRegisterArtifactPathRequest,
} from "../../generated/tauri";
import { commands, unwrapTauriResult } from "../tauriClient";

const ipcArtifactUrlCache = new Map<string, string>();
const pendingIpcArtifactUrlReads = new Map<string, Promise<string>>();
const FRONTEND_IPC_ARTIFACT_ROOT = "ipc-artifacts/frontend";
let appLocalDataRootPathPromise: Promise<string> | null = null;

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

export async function resolveIpcArtifactUrl(
  descriptor: ManagedIpcArtifactDescriptor,
): Promise<string> {
  const cachedUrl = ipcArtifactUrlCache.get(descriptor.id);
  if (cachedUrl) {
    return cachedUrl;
  }

  const pendingUrlRead = pendingIpcArtifactUrlReads.get(descriptor.id);
  if (pendingUrlRead) {
    return pendingUrlRead;
  }

  const nextUrlRead = buildIpcArtifactUrl(descriptor)
    .then((nextUrl) => {
      ipcArtifactUrlCache.set(descriptor.id, nextUrl);
      return nextUrl;
    })
    .finally(() => {
      pendingIpcArtifactUrlReads.delete(descriptor.id);
    });

  pendingIpcArtifactUrlReads.set(descriptor.id, nextUrlRead);
  return nextUrlRead;
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
  revokeCachedArtifactUrl(id);
  ipcArtifactUrlCache.delete(id);
  pendingIpcArtifactUrlReads.delete(id);
  unwrapTauriResult(await commands.ipcReleaseArtifact(id));
}

async function buildIpcArtifactUrl(
  descriptor: ManagedIpcArtifactDescriptor,
): Promise<string> {
  const hydratedObjectUrl = await tryBuildArtifactObjectUrl(descriptor);
  if (hydratedObjectUrl) {
    return hydratedObjectUrl;
  }
  return toLocalAssetUrl(descriptor.filePath);
}

async function tryBuildArtifactObjectUrl(
  descriptor: ManagedIpcArtifactDescriptor,
): Promise<string | null> {
  if (
    typeof window === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof Blob === "undefined"
  ) {
    return null;
  }

  try {
    const bytes = await readBackendArtifactBytes(descriptor.filePath);
    const blob = new Blob([bytes], {
      type: descriptor.mediaType || resolveFileMediaType(descriptor.filePath),
    });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
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

async function readBackendArtifactBytes(filePath: string): Promise<Uint8Array> {
  const normalizedFilePath = normalizeFilesystemPath(filePath);
  const appLocalDataRoot = await getNormalizedAppLocalDataRoot();
  const appLocalDataRelativePath = resolveRelativePathWithinRoot(
    normalizedFilePath,
    appLocalDataRoot,
  );
  if (appLocalDataRelativePath) {
    return readFile(appLocalDataRelativePath, {
      baseDir: BaseDirectory.AppLocalData,
    });
  }
  return readFile(normalizedFilePath);
}

async function getNormalizedAppLocalDataRoot(): Promise<string> {
  if (!appLocalDataRootPathPromise) {
    appLocalDataRootPathPromise = appLocalDataDir().then((directoryPath) =>
      normalizeDirectoryPath(directoryPath),
    );
  }
  return appLocalDataRootPathPromise;
}

function resolveRelativePathWithinRoot(
  filePath: string,
  rootPath: string,
): string | null {
  const normalizedFilePath = normalizePathForComparison(filePath);
  const normalizedRootPath = normalizePathForComparison(rootPath);
  if (
    normalizedFilePath !== normalizedRootPath &&
    !normalizedFilePath.startsWith(`${normalizedRootPath}/`)
  ) {
    return null;
  }

  const rawRelativePath = normalizeFilesystemPath(filePath)
    .slice(normalizeFilesystemPath(rootPath).length)
    .replace(/^\/+/, "");
  return rawRelativePath || null;
}

function normalizePathForComparison(value: string): string {
  const normalizedValue = normalizeFilesystemPath(value).replace(/[\\/]+$/, "");
  return /^[a-z]:\//i.test(normalizedValue)
    ? normalizedValue.toLowerCase()
    : normalizedValue;
}

function normalizeFilesystemPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function resolveFileMediaType(filePath: string): string {
  switch (extractPathExtension(filePath)) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function revokeCachedArtifactUrl(id: string): void {
  const cachedUrl = ipcArtifactUrlCache.get(id);
  if (
    cachedUrl?.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(cachedUrl);
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
    case "image/jpg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    default:
      return ".bin";
  }
}

function extractPathExtension(filePath: string): string | null {
  const normalizedFileName = normalizeFilesystemPath(filePath)
    .split("/")
    .filter(Boolean)
    .pop();
  if (!normalizedFileName) {
    return null;
  }
  const extensionIndex = normalizedFileName.lastIndexOf(".");
  if (extensionIndex <= 0 || extensionIndex === normalizedFileName.length - 1) {
    return null;
  }
  return normalizedFileName.slice(extensionIndex).toLowerCase();
}
