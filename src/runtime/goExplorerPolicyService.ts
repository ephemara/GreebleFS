import type { FileEntry } from '../generated/tauri';
import { createGoSidecarActionRunner } from './goRuntimeBackend';

export const EXPLORER_POLICY_SERVICE_RUNTIME_ID = 'explorer-policy-service';

export interface ExplorerPolicySessionSnapshot {
  currentPath: string;
  history: string[];
  historyIdx: number;
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
  return (await runExplorerPolicyBootstrap(request)).result;
}

export async function navigateExplorerPolicySession(
  request: ExplorerPolicyNavigateRequest,
): Promise<ExplorerPolicyNavigationResult> {
  return (await runExplorerPolicyNavigate(request)).result;
}

export async function resolveExplorerEntryOpenWithPolicy(
  request: ExplorerPolicyResolveOpenEntryRequest,
): Promise<ExplorerPolicyResolveOpenEntryResult> {
  return (await runExplorerPolicyResolveOpenEntry(request)).result;
}
