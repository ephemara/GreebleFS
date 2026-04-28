import type { FileEntry } from '../generated/tauri';
import { createGoSidecarActionRunner } from './goRuntimeBackend';

export const EXPLORER_POLICY_SERVICE_RUNTIME_ID = 'explorer-policy-service';

export interface ExplorerPolicySessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeExplorerPolicySessionSnapshot(
  value: unknown,
): ExplorerPolicySessionSnapshot {
  const source = asRecord(value);
  const currentPath =
    typeof source?.currentPath === 'string' ? source.currentPath : '';
  const rawHistory = Array.isArray(source?.history)
    ? source.history.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.length > 0,
      )
    : [];
  const history =
    rawHistory.length > 0
      ? rawHistory
      : currentPath.length > 0
        ? [currentPath]
        : [];
  const historyIdxValue =
    typeof source?.historyIdx === 'number' && Number.isFinite(source.historyIdx)
      ? Math.trunc(source.historyIdx)
      : history.length - 1;

  return {
    currentPath,
    history: [...history],
    historyIdx: Math.max(-1, Math.min(history.length - 1, historyIdxValue)),
  };
}

export interface ExplorerPolicyBreadcrumb {
  label: string;
  path: string;
}

export interface ExplorerPolicyLocationListing {
  kind: 'local' | 'cloud' | 'remote' | 'archive';
  path: string;
  parentPath: string | null;
  breadcrumbs: ExplorerPolicyBreadcrumb[];
  entries: FileEntry[];
}

export interface ExplorerPolicyBootstrapRequest {
  sessionId: string;
  session: ExplorerPolicySessionSnapshot;
}

export interface ExplorerPolicyBootstrapResult {
  snapshot: ExplorerPolicySessionSnapshot;
}

export interface ExplorerPolicyNavigateRequest {
  sessionId: string;
  path: string;
  pushHistory: boolean;
  historyIndex?: number | null;
  showHidden: boolean;
}

export interface ExplorerPolicyNavigationResult {
  snapshot: ExplorerPolicySessionSnapshot;
  listing?: ExplorerPolicyLocationListing | null;
  isHome: boolean;
  clearSelection: boolean;
}

export interface ExplorerPolicyResolveOpenEntryRequest {
  sessionId: string;
  entry: FileEntry;
  previewEnabled: boolean;
  compactDock: boolean;
  showHidden: boolean;
}

export interface ExplorerPolicyResolveOpenEntryResult {
  effect: 'navigate' | 'preview' | 'openPath';
  snapshot?: ExplorerPolicySessionSnapshot | null;
  listing?: ExplorerPolicyLocationListing | null;
  targetPath?: string | null;
  requiresArchiveMaterialize?: boolean;
  clearSelection?: boolean;
}

const runExplorerPolicyBootstrap = createGoSidecarActionRunner<
  ExplorerPolicyBootstrapRequest,
  ExplorerPolicyBootstrapResult
>(
  EXPLORER_POLICY_SERVICE_RUNTIME_ID,
  'explorer.session.bootstrap',
);

const runExplorerPolicyNavigate = createGoSidecarActionRunner<
  ExplorerPolicyNavigateRequest,
  ExplorerPolicyNavigationResult
>(
  EXPLORER_POLICY_SERVICE_RUNTIME_ID,
  'explorer.session.navigate',
);

const runExplorerPolicyResolveOpenEntry = createGoSidecarActionRunner<
  ExplorerPolicyResolveOpenEntryRequest,
  ExplorerPolicyResolveOpenEntryResult
>(
  EXPLORER_POLICY_SERVICE_RUNTIME_ID,
  'explorer.entry.resolve_open',
);

export async function bootstrapExplorerPolicySession(
  request: ExplorerPolicyBootstrapRequest,
): Promise<ExplorerPolicyBootstrapResult> {
  const response = await runExplorerPolicyBootstrap({
    ...request,
    session: normalizeExplorerPolicySessionSnapshot(request.session),
  });
  return {
    snapshot: normalizeExplorerPolicySessionSnapshot(response.result.snapshot),
  };
}

export async function navigateExplorerPolicySession(
  request: ExplorerPolicyNavigateRequest,
): Promise<ExplorerPolicyNavigationResult> {
  const response = await runExplorerPolicyNavigate(request);
  return {
    ...response.result,
    snapshot: normalizeExplorerPolicySessionSnapshot(response.result.snapshot),
  };
}

export async function resolveExplorerEntryOpenWithPolicy(
  request: ExplorerPolicyResolveOpenEntryRequest,
): Promise<ExplorerPolicyResolveOpenEntryResult> {
  const response = await runExplorerPolicyResolveOpenEntry(request);
  const result = response.result;
  return result.snapshot
    ? {
        ...result,
        snapshot: normalizeExplorerPolicySessionSnapshot(result.snapshot),
      }
    : result;
}
