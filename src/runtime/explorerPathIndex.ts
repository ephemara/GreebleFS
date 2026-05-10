import type {
  FileEntry,
  PathIndexSearchRequest,
  PathIndexStartRequest,
  PathIndexStartResponse,
  PathIndexStatus,
} from "../generated/tauri";
import { resolveGreebleNativeLaneSelection } from "../config/nativeLaneMigration";
import {
  listIndexedExplorerDirectorySnapshotViaNativePool,
  recordExplorerNativePoolAttempt,
  recordExplorerNativePoolFallback,
  recordExplorerNativePoolSuccess,
  isExplorerNativePoolAvailable,
} from "./explorerNativePool";
import {
  callGreebleNativeWithInvokeFallback,
  isGreebleNativeControlAvailable,
} from "./nativeControl";
import { commands, unwrapTauriResult } from "./tauriClient";

const failedIndexedListingCooldownMs = 2500;
const failedIndexStartCooldownMs = 30_000;
const requestedIndexRoots = new Set<string>();
const failedIndexedListingUntil = new Map<string, number>();
const failedIndexStartUntil = new Map<string, number>();

function shouldUsePathIndexNativeControl(): boolean {
  return (
    resolveGreebleNativeLaneSelection(
      "pathIndexControls",
      {},
      { nativeControl: isGreebleNativeControlAvailable() },
    ).activeLane === "native_control"
  );
}

function shouldUsePathIndexNativeBufferPool(): boolean {
  return (
    resolveGreebleNativeLaneSelection(
      "pathIndexDirectorySnapshots",
      {},
      { nativeBufferPool: isExplorerNativePoolAvailable() },
    ).activeLane === "native_buffer_pool"
  );
}

export async function getExplorerPathIndexStatus(): Promise<PathIndexStatus> {
  if (!shouldUsePathIndexNativeControl()) {
    return unwrapTauriResult(await commands.pathIndexGetStatus());
  }
  return callGreebleNativeWithInvokeFallback<PathIndexStatus, Record<string, never>>(
    "explorer",
    "pathIndexStatus",
    {},
    () => commands.pathIndexGetStatus().then(unwrapTauriResult),
  );
}

export async function startExplorerPathIndex(
  request: PathIndexStartRequest,
): Promise<PathIndexStartResponse> {
  if (!shouldUsePathIndexNativeControl()) {
    return unwrapTauriResult(await commands.pathIndexStart(request));
  }
  return callGreebleNativeWithInvokeFallback<
    PathIndexStartResponse,
    PathIndexStartRequest
  >("explorer", "pathIndexStart", request, () =>
    commands.pathIndexStart(request).then(unwrapTauriResult),
  );
}

export async function searchExplorerPathIndex(
  request: PathIndexSearchRequest,
): Promise<FileEntry[]> {
  if (!shouldUsePathIndexNativeControl()) {
    return unwrapTauriResult(await commands.pathIndexSearch(request));
  }
  return callGreebleNativeWithInvokeFallback<FileEntry[], PathIndexSearchRequest>(
    "explorer",
    "pathIndexSearch",
    request,
    () => commands.pathIndexSearch(request).then(unwrapTauriResult),
  );
}

export function warmExplorerPathIndexForPath(path: string): void {
  const key = normalizeIndexRequestKey(path);
  const failureKey = normalizeIndexFailureCooldownKey(path);
  const now = Date.now();
  if (requestedIndexRoots.has(key)) {
    return;
  }
  if ((failedIndexStartUntil.get(failureKey) ?? 0) > now) {
    return;
  }
  requestedIndexRoots.add(key);
  void startExplorerPathIndex({
    rootPath: path,
    forceRebuild: false,
    recursiveFallback: true,
  }).catch(() => {
    requestedIndexRoots.delete(key);
    failedIndexStartUntil.set(failureKey, Date.now() + failedIndexStartCooldownMs);
  });
}

export async function tryListExplorerPathIndexDirectory(args: {
  path: string;
  showHidden: boolean;
}): Promise<FileEntry[] | null> {
  if (!shouldUsePathIndexNativeBufferPool()) {
    return null;
  }
  const cacheKey = `${args.showHidden ? "hidden" : "visible"}::${normalizeIndexRequestKey(args.path)}`;
  const now = Date.now();
  if ((failedIndexedListingUntil.get(cacheKey) ?? 0) > now) {
    return null;
  }
  recordExplorerNativePoolAttempt("pathIndexDirectorySnapshots");
  try {
    const entries = await listIndexedExplorerDirectorySnapshotViaNativePool(args);
    recordExplorerNativePoolSuccess("pathIndexDirectorySnapshots");
    return entries;
  } catch (error) {
    failedIndexedListingUntil.set(cacheKey, now + failedIndexedListingCooldownMs);
    recordExplorerNativePoolFallback("pathIndexDirectorySnapshots", error);
    return null;
  }
}

function normalizeIndexRequestKey(path: string): string {
  return path.trim().replace(/\//g, "\\").replace(/\\+$/g, "").toLowerCase();
}

function normalizeIndexFailureCooldownKey(path: string): string {
  const normalized = normalizeIndexRequestKey(path);
  const driveRootMatch = normalized.match(/^[a-z]:/);
  return driveRootMatch ? driveRootMatch[0] : normalized;
}
