import type {
  FileEntry,
  PathIndexSearchRequest,
  PathIndexStartRequest,
  PathIndexStartResponse,
  PathIndexStatus,
} from "../generated/tauri";
import {
  EXPLORER_PATH_INDEX_WARMUP_POLICY,
  type ExplorerPathIndexWarmupPolicy,
} from "../config/explorerPerformance";
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
const requestedIndexRoots = new Set<string>();
const requestedIndexRootUntil = new Map<string, number>();
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
  const policy = EXPLORER_PATH_INDEX_WARMUP_POLICY;
  const warmupRoot = resolveExplorerPathIndexWarmupRoot(path, policy);
  if (!warmupRoot) {
    return;
  }
  const key = normalizeIndexRequestKey(warmupRoot);
  const failureKey = normalizeIndexFailureCooldownKey(warmupRoot);
  const now = Date.now();
  pruneExpiredIndexRootRequests(now);
  if (requestedIndexRoots.has(key) || hasRelatedRequestedIndexRoot(key)) {
    return;
  }
  if (requestedIndexRoots.size >= policy.maxBuildingRoots) {
    return;
  }
  if ((requestedIndexRootUntil.get(key) ?? 0) > now) {
    return;
  }
  if ((failedIndexStartUntil.get(failureKey) ?? 0) > now) {
    return;
  }
  requestedIndexRoots.add(key);
  requestedIndexRootUntil.set(key, now + policy.requestCooldownMs);
  void startExplorerPathIndex({
    rootPath: warmupRoot,
    forceRebuild: false,
    recursiveFallback: true,
  })
    .then((response) => {
      const responseKey = normalizeIndexRequestKey(response.rootPath);
      if (responseKey && responseKey !== key) {
        requestedIndexRoots.delete(key);
        requestedIndexRoots.add(responseKey);
        requestedIndexRootUntil.set(responseKey, Date.now() + policy.requestCooldownMs);
      }
    })
    .catch(() => {
      requestedIndexRoots.delete(key);
      failedIndexStartUntil.set(failureKey, Date.now() + policy.failureCooldownMs);
    });
}

export function resolveExplorerPathIndexWarmupRoot(
  path: string,
  policy: ExplorerPathIndexWarmupPolicy = EXPLORER_PATH_INDEX_WARMUP_POLICY,
): string | null {
  if (!policy.enabled) {
    return null;
  }
  const normalized = normalizeIndexRequestPath(path);
  if (!normalized) {
    return null;
  }
  const parts = splitIndexRequestPath(normalized);
  if (!policy.allowDriveRoots && isDriveRootIndexPath(normalized, parts)) {
    return null;
  }
  if (parts.depth < policy.minimumImplicitRootDepth) {
    return null;
  }
  if (containsExcludedIndexDirectory(parts.segments, policy)) {
    return null;
  }
  if (parts.depth <= policy.maxImplicitRootDepth) {
    return normalized;
  }
  return joinIndexRequestPath(parts.rootPrefix, parts.segments.slice(0, policy.maxImplicitRootDepth));
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
  return normalizeIndexRequestPath(path).toLowerCase();
}

function normalizeIndexFailureCooldownKey(path: string): string {
  const normalized = normalizeIndexRequestKey(path);
  const driveRootMatch = normalized.match(/^[a-z]:/);
  return driveRootMatch ? driveRootMatch[0] : normalized;
}

function normalizeIndexRequestPath(path: string): string {
  const trimmed = path.trim().replace(/\//g, "\\");
  if (!trimmed) {
    return "";
  }
  if (/^[a-zA-Z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  const withoutTrailing = trimmed.replace(/\\+$/g, "");
  return /^[a-zA-Z]:$/.test(withoutTrailing)
    ? `${withoutTrailing}\\`
    : withoutTrailing;
}

function splitIndexRequestPath(path: string): {
  rootPrefix: string;
  segments: string[];
  depth: number;
} {
  const driveMatch = path.match(/^([a-zA-Z]:)(?:\\|$)/);
  if (driveMatch) {
    const rootPrefix = `${driveMatch[1]}\\`;
    const rest = path.slice(rootPrefix.length);
    const segments = rest.split("\\").filter(Boolean);
    return { rootPrefix, segments, depth: segments.length };
  }
  const segments = path.split("\\").filter(Boolean);
  return { rootPrefix: "", segments, depth: segments.length };
}

function joinIndexRequestPath(rootPrefix: string, segments: readonly string[]): string {
  if (rootPrefix) {
    return segments.length === 0 ? rootPrefix : `${rootPrefix}${segments.join("\\")}`;
  }
  return segments.join("\\");
}

function isDriveRootIndexPath(
  normalizedPath: string,
  parts: { rootPrefix: string; segments: readonly string[] },
): boolean {
  return Boolean(parts.rootPrefix) && parts.segments.length === 0
    ? true
    : /^[a-zA-Z]:\\?$/.test(normalizedPath);
}

function containsExcludedIndexDirectory(
  segments: readonly string[],
  policy: ExplorerPathIndexWarmupPolicy,
): boolean {
  const excludedNames = new Set(
    policy.excludedDirectoryNames.map((name) => name.trim().toLowerCase()),
  );
  return segments.some((segment) => excludedNames.has(segment.toLowerCase()));
}

function hasRelatedRequestedIndexRoot(key: string): boolean {
  for (const requestedKey of requestedIndexRoots) {
    if (
      key === requestedKey ||
      isIndexKeyDescendantOf(key, requestedKey) ||
      isIndexKeyDescendantOf(requestedKey, key)
    ) {
      return true;
    }
  }
  return false;
}

function isIndexKeyDescendantOf(candidateKey: string, ancestorKey: string): boolean {
  const normalizedAncestor = ancestorKey.replace(/\\+$/g, "");
  return candidateKey.startsWith(`${normalizedAncestor}\\`);
}

function pruneExpiredIndexRootRequests(now: number): void {
  for (const [key, expiresAt] of requestedIndexRootUntil) {
    if (expiresAt > now) {
      continue;
    }
    requestedIndexRootUntil.delete(key);
    requestedIndexRoots.delete(key);
  }
}
