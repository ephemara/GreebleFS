import { convertFileSrc } from "@tauri-apps/api/core";
import type { IpcArtifactDescriptor, IpcArtifactRef } from "../../generated/tauri";
import { commands, unwrapTauriResult } from "../tauriClient";

const ipcArtifactUrlCache = new Map<string, string>();

export type ManagedIpcArtifactDescriptor = IpcArtifactDescriptor;
export type ManagedIpcArtifactRef = IpcArtifactRef;

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
