import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorProps } from '@monaco-editor/react';
import { AlertTriangle, ChevronDown, ChevronUp, Download, FolderGit2, GitBranch, GitCommit, Plus, RefreshCw, Rocket, Search, Upload, X } from '@/components/AppIcons';
import { multiplyColorAlpha, type ResolvedOverlayAppearance } from '../config/appearance';
import {
  applyExplorerMonacoTheme,
  resolveExplorerMonacoThemeId,
} from '../config/explorerMonaco';
import { recordExplorerPerformanceSample } from '../config/performanceTelemetry';
import {
  type GitPanelRepositoryState,
  loadGitPanelRepositoryState,
} from '../runtime/gitPanelBackend';
import { OverlayScrollArea } from './OverlayScrollArea';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';
import { GitHistoryPanel } from './GitHistoryPanel';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { useSettingsStore } from '../store/settingsStore';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';
import {
  type GitFileStatus,
  parseGitStatus,
  summarizeGitFiles,
} from './gitManager.utils';

interface RepoBadgeState {
  changeCount: number;
  conflictedCount: number;
  loadedAt: number;
  error: string | null;
}

interface DiffViewState {
  content: string;
  hunkLines: number[];
}

interface ResolvedRepositoryImport {
  requestedPath: string;
  repoPath: string;
  comparablePath: string;
}

interface RepositoryImportDialogState {
  visible: boolean;
  path: string;
}

type GitManagerConfirmationAction =
  | { kind: 'discard'; file: GitFileStatus }
  | { kind: 'resolve'; file: GitFileStatus; side: ConflictResolutionSide };

interface GitManagerConfirmationState {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'accent' | 'danger';
  action: GitManagerConfirmationAction | null;
}

type ChangeFilter = 'all' | 'staged' | 'unstaged' | 'untracked';
type GitManagerMainTab = 'changes' | 'history';

const FALLBACK = {
  bg: 'var(--overlay-bg-shell)',
  sidebar: 'var(--overlay-bg-sidebar)',
  panel: 'var(--overlay-bg-panel)',
  card: 'var(--overlay-bg-card)',
  border: 'var(--overlay-border)',
  text: 'var(--overlay-text-primary)',
  muted: 'var(--overlay-text-muted)',
  accent: 'var(--overlay-accent)',
  green: 'var(--overlay-success)',
  red: 'var(--overlay-danger)',
  yellow: 'var(--overlay-warning)',
};

const FILTERS: Record<ChangeFilter, string> = {
  all: 'All',
  staged: 'Staged',
  unstaged: 'Working',
  untracked: 'New',
};

const ACTIVE_REPO_BADGE_POLL_MS = 30_000;
const BACKGROUND_REPO_BADGE_POLL_MS = 120_000;
const MAX_SYNTHETIC_UNTRACKED_DIFF_BYTES = 128 * 1024;
const CHANGE_LIST_ROW_HEIGHT = 48;
const CHANGE_LIST_OVERSCAN = 8;

const LazyMonacoEditor = React.lazy(async () => {
  const module = await import('@monaco-editor/react');
  return { default: module.default as React.ComponentType<EditorProps> };
});

interface GitManagerProps {
  appearance?: ResolvedOverlayAppearance;
  pendingRepositoryImports?: string[];
  onPendingRepositoryImportsHandled?: () => void;
  onRequestRepositoryImport?: () => void;
}

export function GitManager({
  appearance,
  pendingRepositoryImports = [],
  onPendingRepositoryImportsHandled,
  onRequestRepositoryImport,
}: GitManagerProps) {
  const palette = {
    bg: appearance?.theme.palette.shellBackground || FALLBACK.bg,
    sidebar: appearance?.theme.palette.sidebarBackground || FALLBACK.sidebar,
    panel: appearance?.theme.palette.panelBackground || FALLBACK.panel,
    card: appearance?.theme.palette.cardBackground || FALLBACK.card,
    border: appearance?.theme.palette.border || FALLBACK.border,
    text: appearance?.theme.palette.textPrimary || FALLBACK.text,
    muted: appearance?.theme.palette.textMuted || FALLBACK.muted,
    accent: appearance?.theme.palette.accent || FALLBACK.accent,
    green: appearance?.theme.palette.success || FALLBACK.green,
    red: appearance?.theme.palette.danger || FALLBACK.red,
    yellow: appearance?.theme.palette.warning || FALLBACK.yellow,
  };
  const uiFont = appearance?.fonts.ui ?? 'var(--overlay-font-ui)';
  const monoFont = appearance?.fonts.mono ?? 'var(--overlay-font-mono, "Cascadia Code", Consolas, monospace)';
  const monacoThemeId = resolveExplorerMonacoThemeId(appearance);

  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoState, setRepoState] = useState<GitPanelRepositoryState | null>(null);
  const [repoBadges, setRepoBadges] = useState<Record<string, RepoBadgeState>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [changeQuery, setChangeQuery] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<DiffViewState | null>(null);
  const [activeHunkIndex, setActiveHunkIndex] = useState(0);
  const [repositoryImportDialog, setRepositoryImportDialog] = useState<RepositoryImportDialogState>({
    visible: false,
    path: '',
  });
  const [mainTab, setMainTab] = useState<GitManagerMainTab>('changes');
  const [confirmationDialog, setConfirmationDialog] = useState<GitManagerConfirmationState>({
    visible: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    tone: 'accent',
    action: null,
  });
  const deferredQuery = useDeferredValue(changeQuery);
  const [repoRailWidth, setRepoRailWidth] = usePersistentPanelSize('overlayterm-source-repo-rail-width', 208, 160, 300);
  const [changeListWidth, setChangeListWidth] = usePersistentPanelSize('overlayterm-source-change-list-width', 360, 260, 720);
  const [changeListViewportHeight, setChangeListViewportHeight] = useState(480);
  const [changeListScrollTop, setChangeListScrollTop] = useState(0);
  const diffContainerRef = useRef<HTMLDivElement | null>(null);
  const changeListViewportRef = useRef<HTMLDivElement | null>(null);
  const diffEditorRef = useRef<any>(null);
  const diffMonacoRef = useRef<any>(null);
  const diffDecorationsRef = useRef<string[]>([]);
  const reposRef = useRef<string[]>([]);
  const untrackedSizeHintCacheRef = useRef(new Map<string, number | null>());
  const repoStateLoadInFlightRef = useRef<Promise<void> | null>(null);
  const repoStateLoadQueuedPathRef = useRef<string | null>(null);
  const repoStateLoadQueuedForceRef = useRef(false);
  const repoStateLoadQueuedWhenVisibleRef = useRef(false);
  const visibilityRestoreResyncedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('overlayterm-git-repos');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      const sanitized = sanitizeRepositoryList(parsed);
      setRepos(sanitized);
      if (sanitized.length > 0) setSelectedRepo(sanitized[0]);
    } catch (storageError) {
      console.error(storageError);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('overlayterm-git-repos', JSON.stringify(repos));
  }, [repos]);

  useEffect(() => {
    reposRef.current = repos;
  }, [repos]);

  useEffect(() => {
    setRepoBadges(current => Object.fromEntries(Object.entries(current).filter(([path]) => repos.includes(path))));
  }, [repos]);

  const runGit = useCallback(async (repo: string, args: string[]) => {
    return commands.gitExec(repo, args).then(unwrapTauriResult);
  }, []);

  const recordGitMetric = useCallback((metricId: 'git_repo_state_load' | 'git_repo_badge_sync', durationMs: number, metadata: Record<string, string | number | boolean | null> = {}) => {
    recordExplorerPerformanceSample({ metricId, durationMs, metadata });
  }, []);

  const safeGit = useCallback(async (repo: string, args: string[], fallback = '') => {
    try {
      return await runGit(repo, args);
    } catch {
      return fallback;
    }
  }, [runGit]);

  const resolveRepoRoot = useCallback(async (path: string) => {
    const repoRoot = await runGit(path, ['rev-parse', '--show-toplevel']);
    const normalized = normalizeRepositoryPath(repoRoot);
    if (!normalized) {
      throw new Error(`Git did not return a repository root for ${path}`);
    }
    return normalized;
  }, [runGit]);

  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {
    const startedAt = performance.now();
    try {
      const statusText = await runGit(path, ['status', '--porcelain']);
      const badgeState = buildRepoBadgeState(parseGitStatus(statusText));
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1 });
      return badgeState;
    } catch (loadError) {
      recordGitMetric('git_repo_badge_sync', performance.now() - startedAt, { repoCount: 1, error: true });
      return {
        changeCount: 0,
        conflictedCount: 0,
        loadedAt: Date.now(),
        error: String(loadError),
      };
    }
  }, [runGit]);

  const loadRepoState = useCallback(async (path: string, options?: { force?: boolean; whenVisible?: boolean }) => {
    const startedAt = performance.now();
    const force = options?.force ?? false;
    const whenVisible = options?.whenVisible ?? false;
    const isDocumentVisible = () => document.visibilityState === 'visible';

    if (!force && !isDocumentVisible()) {
      repoStateLoadQueuedPathRef.current = path;
      repoStateLoadQueuedWhenVisibleRef.current = true;
      return;
    }

    const currentLoad = repoStateLoadInFlightRef.current;
    if (currentLoad) {
      repoStateLoadQueuedPathRef.current = path;
      repoStateLoadQueuedForceRef.current = repoStateLoadQueuedForceRef.current || force;
      repoStateLoadQueuedWhenVisibleRef.current = repoStateLoadQueuedWhenVisibleRef.current || whenVisible;
      await currentLoad;
      return;
    }

    const runLoad = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextRepoState = await loadGitPanelRepositoryState(path, runGit, safeGit);

        setRepoState(nextRepoState);
        setRepoBadges(current => ({ ...current, [path]: buildRepoBadgeState(nextRepoState.status) }));
        recordGitMetric('git_repo_state_load', performance.now() - startedAt, {
          repoPathLength: path.length,
          statusCount: nextRepoState.status.length,
          hadBranch: nextRepoState.branch.trim() ? true : false,
        });
      } catch (loadError) {
        setError(String(loadError));
        setRepoState(null);
        recordGitMetric('git_repo_state_load', performance.now() - startedAt, {
          repoPathLength: path.length,
          error: true,
        });
        setRepoBadges(current => ({
          ...current,
          [path]: {
            changeCount: 0,
            conflictedCount: 0,
            loadedAt: Date.now(),
            error: String(loadError),
          },
        }));
      } finally {
        setLoading(false);
      }
    };

    const loadPromise = runLoad();
    repoStateLoadInFlightRef.current = loadPromise;
    try {
      await loadPromise;
    } finally {
      repoStateLoadInFlightRef.current = null;
      const queuedPath = repoStateLoadQueuedPathRef.current;
      const queuedForce = repoStateLoadQueuedForceRef.current;
      const queuedWhenVisible = repoStateLoadQueuedWhenVisibleRef.current;
      repoStateLoadQueuedPathRef.current = null;
      repoStateLoadQueuedForceRef.current = false;
      repoStateLoadQueuedWhenVisibleRef.current = false;
      if (queuedPath) {
        if (!queuedForce && queuedWhenVisible && document.visibilityState !== 'visible') {
          repoStateLoadQueuedPathRef.current = queuedPath;
          repoStateLoadQueuedWhenVisibleRef.current = true;
          return;
        }

        void loadRepoState(queuedPath, { force: queuedForce, whenVisible: queuedWhenVisible });
      }
    }
  }, [runGit, safeGit, recordGitMetric]);

  useEffect(() => {
    if (!selectedRepo) {
      setRepoState(null);
      return;
    }
    void loadRepoState(selectedRepo);
  }, [loadRepoState, selectedRepo]);

  useEffect(() => {
    if (repos.length === 0) {
      return;
    }

    let disposed = false;
    let backgroundSweepCount = 0;
    let syncInFlight = false;
    let syncQueuedForceAll = false;
    const isDocumentVisible = () => document.visibilityState === 'visible';

    const mergeBadgeEntries = (nextEntries: readonly (readonly [string, RepoBadgeState])[]) => {
      if (disposed || nextEntries.length === 0) {
        return;
      }

      setRepoBadges(current => ({
        ...current,
        ...Object.fromEntries(nextEntries),
      }));
    };

    const syncBadgeSubset = async (targetRepos: string[]) => {
      if (targetRepos.length === 0) {
        return;
      }

      const nextEntries = await Promise.all(
        targetRepos.map(async repo => [repo, await loadRepoBadge(repo)] as const),
      );

      mergeBadgeEntries(nextEntries);
    };

    const syncBadges = async (forceAll = false) => {
      const activeRepoTargets = selectedRepo && repos.includes(selectedRepo)
        ? [selectedRepo]
        : repos.slice(0, 1);

      if (forceAll || repos.length <= 1) {
        await syncBadgeSubset([...repos]);
        return;
      }

      await syncBadgeSubset(activeRepoTargets);
      backgroundSweepCount += ACTIVE_REPO_BADGE_POLL_MS;
      if (backgroundSweepCount >= BACKGROUND_REPO_BADGE_POLL_MS) {
        backgroundSweepCount = 0;
        const backgroundRepos = repos.filter(repo => !activeRepoTargets.includes(repo));
        await syncBadgeSubset(backgroundRepos);
      }
    };

    const scheduleBadgeSync = async (forceAll = false) => {
      syncQueuedForceAll = syncQueuedForceAll || forceAll;
      if (syncInFlight) {
        return;
      }

      syncInFlight = true;
      try {
        do {
          const nextForceAll = syncQueuedForceAll;
          syncQueuedForceAll = false;
          await syncBadges(nextForceAll);
        } while (syncQueuedForceAll && !disposed);
      } finally {
        syncInFlight = false;
      }
    };

    void scheduleBadgeSync(true);
    const intervalId = window.setInterval(() => {
      if (!isDocumentVisible()) {
        return;
      }
      void scheduleBadgeSync(false);
    }, ACTIVE_REPO_BADGE_POLL_MS);

    const handleVisibilityChange = () => {
      if (disposed) {
        return;
      }

      if (!isDocumentVisible()) {
        visibilityRestoreResyncedRef.current = false;
        return;
      }

      if (visibilityRestoreResyncedRef.current) {
        return;
      }

      visibilityRestoreResyncedRef.current = true;
      const queuedPath = repoStateLoadQueuedPathRef.current ?? selectedRepo ?? repos[0] ?? null;
      if (queuedPath) {
        void loadRepoState(queuedPath, { force: true, whenVisible: true });
        return;
      }

      void scheduleBadgeSync(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadRepoBadge, repos, selectedRepo]);

  useEffect(() => {
    if (repos.length === 0) {
      return;
    }

    let cancelled = false;

    const canonicalizeStoredRepos = async () => {
      const resolvedEntries = await Promise.all(
        repos.map(async repo => {
          try {
            return {
              requestedPath: repo,
              repoPath: await resolveRepoRoot(repo),
            };
          } catch {
            return {
              requestedPath: repo,
              repoPath: repo,
            };
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const canonicalRepos = sanitizeRepositoryList(resolvedEntries.map(entry => entry.repoPath));
      if (repositoryPathListsEqual(canonicalRepos, repos)) {
        return;
      }

      setRepos(canonicalRepos);
      setSelectedRepo(current => {
        if (!current) {
          return canonicalRepos[0] ?? null;
        }

        const resolvedSelected = resolvedEntries.find(entry => (
          getRepositoryComparablePath(entry.requestedPath) === getRepositoryComparablePath(current)
        ));
        const targetComparablePath = getRepositoryComparablePath(resolvedSelected?.repoPath ?? current);
        return canonicalRepos.find(repo => getRepositoryComparablePath(repo) === targetComparablePath) ?? canonicalRepos[0] ?? null;
      });
    };

    void canonicalizeStoredRepos();

    return () => {
      cancelled = true;
    };
  }, [repos, resolveRepoRoot]);

  const refreshRepo = useCallback(async () => {
    if (!selectedRepo) return;
    await loadRepoState(selectedRepo);
  }, [loadRepoState, selectedRepo]);

  const summary = useMemo(
    () => (repoState ? summarizeGitFiles(repoState.status) : null),
    [repoState],
  );
  const hasRepositoryChanges = (summary?.totalFiles ?? 0) > 0;
  const hasStagedChanges = (summary?.stagedFiles ?? 0) > 0;
  const hasConflictedFiles = (summary?.conflictedFiles ?? 0) > 0;
  const hasWorkingTreeOnlyChanges = (summary?.unstagedFiles ?? 0) > 0;
  const canStageAllChanges = hasRepositoryChanges && !hasConflictedFiles;
  const canCommitStagedChanges = hasStagedChanges && !hasConflictedFiles;
  const canQuickShipChanges = hasRepositoryChanges && !hasConflictedFiles;
  const sourceActionHint = summary
    ? hasConflictedFiles
      ? 'Resolve conflicted files with the file-level controls before staging everything or shipping this repo.'
      : hasStagedChanges
        ? hasWorkingTreeOnlyChanges
          ? `${summary.stagedFiles} staged file${summary.stagedFiles === 1 ? '' : 's'} ready to commit. ${summary.unstagedFiles} file${summary.unstagedFiles === 1 ? '' : 's'} still only in the working tree.`
          : `${summary.stagedFiles} staged file${summary.stagedFiles === 1 ? '' : 's'} ready to commit.`
        : hasRepositoryChanges
          ? 'Stage selected files, use Stage All, or Quick Ship to include working-tree changes in a commit.'
          : null
    : null;
  const branchSelectOptions = repoState?.branches ?? [];
  const canSwitchBranches = branchSelectOptions.length > 1
    && branchSelectOptions.some(branch => branch.name === repoState?.branch);

  const runRepoAction = useCallback(async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
      await refreshRepo();
    } catch (actionError) {
      setError(String(actionError));
    } finally {
      setLoading(false);
    }
  }, [refreshRepo]);

  const importRepositories = useCallback(async (paths: string[]) => {
    const requestedPaths = sanitizeRepositoryList(paths);
    if (requestedPaths.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(requestedPaths.map(async path => {
        try {
          const repoPath = await resolveRepoRoot(path);
          return {
            requestedPath: path,
            ok: true as const,
            repoPath,
            comparablePath: getRepositoryComparablePath(repoPath),
          } satisfies ResolvedRepositoryImport & { ok: true };
        } catch (repoError) {
          return { requestedPath: path, ok: false as const, error: String(repoError) };
        }
      }));

      const seenComparablePaths = new Set<string>();
      const resolvedImports = results.filter((result): result is ResolvedRepositoryImport & { ok: true } => result.ok)
        .filter(result => {
          if (seenComparablePaths.has(result.comparablePath)) {
            return false;
          }
          seenComparablePaths.add(result.comparablePath);
          return true;
        });
      const invalidResults = results.filter((result): result is { requestedPath: string; ok: false; error: string } => !result.ok);
      const currentRepos = reposRef.current;
      const existingComparablePaths = new Set(currentRepos.map(getRepositoryComparablePath));
      const nextRepos = [...currentRepos];
      const alreadyImported: string[] = [];
      let nextSelectedRepo: string | null = null;

      if (resolvedImports.length > 0) {
        for (const result of resolvedImports) {
          if (existingComparablePaths.has(result.comparablePath)) {
            alreadyImported.push(result.repoPath);
            continue;
          }

          existingComparablePaths.add(result.comparablePath);
          nextRepos.push(result.repoPath);
          if (!nextSelectedRepo) {
            nextSelectedRepo = result.repoPath;
          }
        }

        if (!repositoryPathListsEqual(nextRepos, currentRepos)) {
          reposRef.current = nextRepos;
          setRepos(nextRepos);
        }
      }

      if (nextSelectedRepo) {
        setSelectedRepo(nextSelectedRepo);
      }

      const feedback: string[] = [];
      if (invalidResults.length > 0) {
        feedback.push(invalidResults.map(result => `${result.requestedPath}: ${result.error}`).join('\n'));
      }

      if (alreadyImported.length > 0) {
        feedback.push(`Already imported:\n${Array.from(new Set(alreadyImported)).join('\n')}`);
      }

      if (feedback.length > 0) {
        setError(feedback.join('\n\n'));
      }
    } finally {
      setLoading(false);
    }
  }, [resolveRepoRoot]);

  const closeRepositoryImportDialog = useCallback(() => {
    setRepositoryImportDialog({ visible: false, path: '' });
  }, []);

  const openRepositoryImportDialog = useCallback(() => {
    setRepositoryImportDialog({ visible: true, path: '' });
  }, []);

  const submitRepositoryImportDialog = useCallback(async () => {
    const path = repositoryImportDialog.path.trim();
    closeRepositoryImportDialog();
    if (!path) {
      return;
    }
    await importRepositories([path]);
  }, [closeRepositoryImportDialog, importRepositories, repositoryImportDialog.path]);

  const closeConfirmationDialog = useCallback(() => {
    setConfirmationDialog({
      visible: false,
      title: '',
      description: '',
      confirmLabel: 'Confirm',
      tone: 'accent',
      action: null,
    });
  }, []);

  const openConfirmationDialog = useCallback((state: Omit<GitManagerConfirmationState, 'visible'>) => {
    setConfirmationDialog({
      visible: true,
      ...state,
    });
  }, []);

  useEffect(() => {
    if (pendingRepositoryImports.length === 0) {
      return;
    }

    let cancelled = false;
    void importRepositories(pendingRepositoryImports).finally(() => {
      if (!cancelled) {
        onPendingRepositoryImportsHandled?.();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [importRepositories, onPendingRepositoryImportsHandled, pendingRepositoryImports]);

  const addRepo = useCallback(async () => {
    if (onRequestRepositoryImport) {
      onRequestRepositoryImport();
      return;
    }
    openRepositoryImportDialog();
  }, [onRequestRepositoryImport, openRepositoryImportDialog]);

  const removeRepo = useCallback((path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const nextRepos = repos.filter(repo => repo !== path);
    setRepos(nextRepos);
    setSelectedRepo(current => (current === path ? nextRepos[0] ?? null : current));
    setRepoBadges(current => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    setSelectedFilePath(null);
    setDiffView(null);
  }, [repos]);

  const handleFetch = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['fetch', '--prune']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handlePull = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['pull']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handlePush = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['push']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handleSwitchBranch = useCallback(async (nextBranchName: string) => {
    if (!selectedRepo || !nextBranchName || repoState?.branch === nextBranchName) {
      return;
    }

    await runRepoAction(async () => {
      await runGit(selectedRepo, ['checkout', nextBranchName]);
      setSelectedFilePath(null);
      setDiffView(null);
    });
  }, [repoState?.branch, runGit, runRepoAction, selectedRepo]);

  const handleStageAll = useCallback(async () => {
    if (!selectedRepo) return;
    if (hasConflictedFiles) {
      setError('Resolve conflicted files before using Stage All.');
      return;
    }
    if (!hasRepositoryChanges) {
      setError('No changes to stage.');
      return;
    }

    await runRepoAction(() => runGit(selectedRepo, ['add', '-A']).then(() => undefined));
  }, [hasConflictedFiles, hasRepositoryChanges, runGit, runRepoAction, selectedRepo]);

  const handleCommit = useCallback(async () => {
    if (!selectedRepo) return;
    const message = commitMsg.trim();
    if (!message) {
      return;
    }
    if (hasConflictedFiles) {
      setError('Resolve conflicted files before committing.');
      return;
    }
    if (!hasStagedChanges) {
      setError('Stage files before committing.');
      return;
    }

    await runRepoAction(async () => {
      await runGit(selectedRepo, ['commit', '-m', message]);
      setCommitMsg('');
    });
  }, [commitMsg, hasConflictedFiles, hasStagedChanges, runGit, runRepoAction, selectedRepo]);

  const handleQuickShip = useCallback(async () => {
    if (!selectedRepo || !repoState) return;
    if (hasConflictedFiles) {
      setError('Resolve conflicted files before Quick Ship.');
      return;
    }
    if (!hasRepositoryChanges) {
      setError('No changes to ship.');
      return;
    }

    const message = commitMsg.trim() || 'Update changes';
    await runRepoAction(async () => {
      await runGit(selectedRepo, ['add', '-A']);
      await runGit(selectedRepo, ['commit', '-m', message]);
      await runGit(selectedRepo, ['push']);
      setCommitMsg('');
    });
  }, [commitMsg, hasConflictedFiles, hasRepositoryChanges, repoState, runGit, runRepoAction, selectedRepo]);

  const selectedFile = repoState?.status.find(file => file.file === selectedFilePath) ?? null;
  const canStageSelectedFile = selectedFile ? canStageFile(selectedFile) : false;
  const canUnstageSelectedFile = selectedFile?.isStaged ?? false;
  const canDiscardSelectedFile = selectedFile ? canDiscardFile(selectedFile) : false;
  const canResolveSelectedConflict = selectedFile?.kind === 'conflicted';
  const stageSelectedFileLabel = selectedFile ? stageActionLabel(selectedFile) : 'Stage';
  const discardSelectedFileLabel = selectedFile ? discardActionLabel(selectedFile) : 'Discard';

  const handleStageSelectedFile = useCallback(async () => {
    if (!selectedRepo || !selectedFile || !canStageFile(selectedFile)) {
      return;
    }

    await runRepoAction(async () => {
      await runGit(selectedRepo, ['add', '--', selectedFile.file]);
    });
  }, [runGit, runRepoAction, selectedFile, selectedRepo]);

  const handleUnstageSelectedFile = useCallback(async () => {
    if (!selectedRepo || !selectedFile || !selectedFile.isStaged) {
      return;
    }

    await runRepoAction(async () => {
      await runGit(selectedRepo, ['restore', '--staged', '--', ...getGitTrackedPaths(selectedFile)]);
    });
  }, [runGit, runRepoAction, selectedFile, selectedRepo]);

  const handleDiscardSelectedFile = useCallback(async () => {
    if (!selectedRepo || !selectedFile || !canDiscardFile(selectedFile)) {
      return;
    }
    openConfirmationDialog({
      title: selectedFile.isUntracked ? 'Delete Untracked File' : 'Discard Changes',
      description: buildDiscardConfirmationMessage(selectedFile),
      confirmLabel: discardActionLabel(selectedFile),
      tone: 'danger',
      action: { kind: 'discard', file: selectedFile },
    });
  }, [openConfirmationDialog, selectedFile, selectedRepo]);

  const handleResolveSelectedConflict = useCallback(async (side: ConflictResolutionSide) => {
    if (!selectedRepo || !selectedFile || selectedFile.kind !== 'conflicted') {
      return;
    }
    openConfirmationDialog({
      title: side === 'ours' ? 'Use Ours' : 'Use Theirs',
      description: buildConflictResolutionConfirmationMessage(selectedFile, side),
      confirmLabel: side === 'ours' ? 'Resolve with Ours' : 'Resolve with Theirs',
      tone: 'accent',
      action: { kind: 'resolve', file: selectedFile, side },
    });
  }, [openConfirmationDialog, selectedFile, selectedRepo]);

  const confirmPendingAction = useCallback(async () => {
    const pendingAction = confirmationDialog.action;
    if (!selectedRepo || !pendingAction) {
      closeConfirmationDialog();
      return;
    }

    closeConfirmationDialog();

    await runRepoAction(async () => {
      if (pendingAction.kind === 'discard') {
        if (pendingAction.file.isUntracked) {
          await runGit(selectedRepo, ['clean', '-fd', '--', pendingAction.file.file]);
          return;
        }

        await discardTrackedFileChanges(selectedRepo, pendingAction.file, runGit, safeGit);
        return;
      }

      await resolveConflictedFile(selectedRepo, pendingAction.file, pendingAction.side, runGit);
    });
  }, [closeConfirmationDialog, confirmationDialog.action, runGit, runRepoAction, safeGit, selectedRepo]);

  const loadDiff = useCallback(async (repoPath: string, file: GitFileStatus) => {
    setDiffLoading(true);
    try {
      const patch = await buildUnifiedDiff(repoPath, file, safeGit, untrackedSizeHintCacheRef.current);
      setDiffView({
        content: patch,
        hunkLines: findDiffHunkLines(patch),
      });
    } finally {
      setDiffLoading(false);
    }
  }, [safeGit]);

  useEffect(() => {
    if (!repoState || !selectedFile) return;
    void loadDiff(repoState.path, selectedFile);
  }, [loadDiff, repoState, selectedFile]);

  useEffect(() => {
    if (!repoState) {
      setSelectedFilePath(null);
      setDiffView(null);
      return;
    }

    if (!selectedFilePath) {
      return;
    }

    const selectedFileStillExists = repoState.status.some(file => file.file === selectedFilePath);
    if (!selectedFileStillExists) {
      setSelectedFilePath(null);
      setDiffView(null);
    }
  }, [repoState, selectedFilePath]);

  useEffect(() => {
    setActiveHunkIndex(0);
  }, [selectedFilePath, diffView?.content]);

  useEffect(() => {
    const container = diffContainerRef.current;
    if (!container) {
      return;
    }

    // Force an immediate layout so Monaco knows its real size after the
    // scale-zoom CSS transform has settled on the parent shell.
    const scheduleLayout = () => {
      window.requestAnimationFrame(() => {
        diffEditorRef.current?.layout?.();
      });
    };

    scheduleLayout();

    const observer = new ResizeObserver(() => {
      diffEditorRef.current?.layout?.();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [diffContainerRef]);

  // CSS scale() transforms don't fire ResizeObserver inside the scaled element,
  // so Monaco won't remeasure when the user changes the global zoom level.
  // We subscribe to appZoom from the store and call layout() manually when it changes.
  const appZoom = useSettingsStore(s => s.settings.appearance.appZoom ?? 1);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      diffEditorRef.current?.layout?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appZoom]);

  const dirtyRepoCount = useMemo(
    () => repos.reduce((count, repo) => count + ((repoBadges[repo]?.changeCount ?? 0) > 0 ? 1 : 0), 0),
    [repoBadges, repos],
  );
  const filteredFiles = useMemo(() => {
    if (!repoState) return [];
    const query = deferredQuery.trim().toLowerCase();
    return repoState.status.filter(file => {
      if (changeFilter === 'staged' && !file.isStaged) return false;
      if (changeFilter === 'unstaged' && !file.hasUnstagedChanges) return false;
      if (changeFilter === 'untracked' && !file.isUntracked) return false;
      if (!query) return true;
      return file.file.toLowerCase().includes(query) || (file.originalFile?.toLowerCase().includes(query) ?? false);
    });
  }, [changeFilter, deferredQuery, repoState]);
  const changeListVirtualWindow = useMemo(() => {
    const totalRows = filteredFiles.length;
    const viewportHeight = Math.max(changeListViewportHeight, CHANGE_LIST_ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(changeListScrollTop / CHANGE_LIST_ROW_HEIGHT) - CHANGE_LIST_OVERSCAN);
    const endIndex = Math.min(
      totalRows,
      Math.ceil((changeListScrollTop + viewportHeight) / CHANGE_LIST_ROW_HEIGHT) + CHANGE_LIST_OVERSCAN,
    );

    return {
      startIndex,
      endIndex,
      topSpacer: startIndex * CHANGE_LIST_ROW_HEIGHT,
      bottomSpacer: Math.max(0, totalRows - endIndex) * CHANGE_LIST_ROW_HEIGHT,
    };
  }, [changeListScrollTop, changeListViewportHeight, filteredFiles.length]);
  const virtualizedFilteredFiles = useMemo(
    () => filteredFiles.slice(changeListVirtualWindow.startIndex, changeListVirtualWindow.endIndex),
    [changeListVirtualWindow.endIndex, changeListVirtualWindow.startIndex, filteredFiles],
  );

  useEffect(() => {
    const viewport = changeListViewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportHeight = () => {
      setChangeListViewportHeight(viewport.clientHeight || 480);
    };

    updateViewportHeight();
    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = changeListViewportRef.current;
    if (viewport) {
      viewport.scrollTop = 0;
    }
    setChangeListScrollTop(0);
  }, [selectedRepo, changeFilter, deferredQuery]);

  const jumpToDiffHunk = useCallback((index: number) => {
    if (!diffView || diffView.hunkLines.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(diffView.hunkLines.length - 1, index));
    const lineNumber = diffView.hunkLines[safeIndex];
    setActiveHunkIndex(safeIndex);
    diffEditorRef.current?.setPosition?.({ lineNumber, column: 1 });
    diffEditorRef.current?.revealLineInCenter?.(lineNumber);
    diffEditorRef.current?.focus?.();
  }, [diffView]);

  useEffect(() => {
    if (!diffView || diffView.hunkLines.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      jumpToDiffHunk(0);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [diffView, jumpToDiffHunk]);

  useEffect(() => {
    if (!diffMonacoRef.current) {
      return;
    }
    applyExplorerMonacoTheme(diffMonacoRef.current, appearance);
  }, [appearance]);

  useEffect(() => {
    const editor = diffEditorRef.current;
    const monaco = diffMonacoRef.current;
    const model = editor?.getModel?.();
    if (!editor || !monaco || !model || !diffView) {
      return;
    }

    const decorations = diffView.content
      .split(/\r?\n/)
      .flatMap((line, index) => {
        const lineNumber = index + 1;

        if (line.startsWith('@@')) {
          return [{
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
              isWholeLine: true,
              className: 'source-diff-line--hunk',
              inlineClassName: 'source-diff-text--hunk',
            },
          }];
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
          return [{
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
              isWholeLine: true,
              className: 'source-diff-line--added',
              inlineClassName: 'source-diff-text--added',
            },
          }];
        }

        if (line.startsWith('-') && !line.startsWith('---')) {
          return [{
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
              isWholeLine: true,
              className: 'source-diff-line--deleted',
              inlineClassName: 'source-diff-text--deleted',
            },
          }];
        }

        return [];
      });

    diffDecorationsRef.current = editor.deltaDecorations(diffDecorationsRef.current, decorations);

    return () => {
      if (diffEditorRef.current) {
        diffDecorationsRef.current = diffEditorRef.current.deltaDecorations(diffDecorationsRef.current, []);
      }
    };
  }, [diffView]);

  return (
    <div className="source-tab" style={{ flex: 1, minHeight: 0, display: 'flex', background: palette.bg, color: palette.text, overflow: 'hidden', fontFamily: uiFont }}>
      <ResizablePane
        size={repoRailWidth}
        minSize={160}
        maxSize={300}
        onSizeChange={setRepoRailWidth}
        borderColor={alpha(palette.accent, 0.28)}
        style={{ display: 'flex', flexDirection: 'column', background: palette.sidebar, borderRight: `1px solid ${palette.border}` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${palette.border}` }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: palette.muted }}>Source Control</div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Repositories</div>
              {dirtyRepoCount > 0 && (
                <span title={`${dirtyRepoCount} repos currently have changes`} style={repoNotificationBadgeStyle(palette, false)}>
                  {dirtyRepoCount > 99 ? '99+' : dirtyRepoCount}
                </span>
              )}
            </div>
          </div>
          <button onClick={addRepo} style={iconButtonStyle(palette)}><Plus size={13} /></button>
        </div>
        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
          {repos.map(repo => {
            const active = repo === selectedRepo;
            const badge = repoBadges[repo];
            return (
              <button key={repo} onClick={() => setSelectedRepo(repo)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: 'none', borderBottom: `1px solid ${palette.border}`, background: active ? alpha(palette.accent, 0.14) : 'transparent', color: palette.text, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                  <FolderGit2 size={13} style={{ color: active ? palette.accent : palette.muted, marginTop: 1, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.split(/[/\\]/).pop() || repo}</div>
                    <div style={{ marginTop: 2, fontSize: 9.5, color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {badge?.changeCount ? (
                    <span
                      title={badge.conflictedCount > 0 ? `${badge.changeCount} changed files, ${badge.conflictedCount} conflicted` : `${badge.changeCount} changed files`}
                      style={repoNotificationBadgeStyle(palette, badge.conflictedCount > 0)}
                    >
                      {badge.changeCount > 99 ? '99+' : badge.changeCount}
                    </span>
                  ) : null}
                  <div role="button" tabIndex={-1} onClick={event => removeRepo(repo, event)} onKeyDown={e => e.key === 'Enter' && removeRepo(repo, e as any)} style={{ ...iconButtonStyle(palette), opacity: active ? 1 : 0.3 }}><X size={11} /></div>
                </div>
              </button>
            );
          })}
        </OverlayScrollArea>
      </ResizablePane>

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!repoState ? (
          repos.length === 0 ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
              <div style={{ maxWidth: 360 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: palette.accent }}>
                  Source Control
                </div>
                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: palette.text }}>
                  Bring a repository into GreebleFS
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: palette.muted }}>
                  Pick a repo from Explorer or paste any nested folder path. GreebleFS now normalizes selections to the real git root before loading diffs and ship actions.
                </div>
                <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  {onRequestRepositoryImport ? (
                    <button type="button" onClick={onRequestRepositoryImport} style={{ ...toolbarButtonStyle(palette), minHeight: 32 }}>
                      <FolderGit2 size={13} />
                      Pick In Explorer
                    </button>
                  ) : null}
                  <button type="button" onClick={openRepositoryImportDialog} style={{ ...toolbarButtonStyle(palette), minHeight: 32 }}>
                    <Plus size={13} />
                    Paste Repo Path
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 12 }}>
              {loading ? 'Loading repository…' : 'Select a repository.'}
            </div>
          )
        ) : (
          <>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, background: palette.panel }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{repoState.name}</div>
                    <span style={pillStyle(alpha(palette.accent, 0.14), palette.accent)}><GitBranch size={11} />{repoState.branch}</span>
                    {repoState.upstreamName ? (
                      <span style={pillStyle(alpha(palette.panel, 0.9), palette.muted)}>
                        {repoState.upstreamName}
                      </span>
                    ) : null}
                    {repoState.aheadCount > 0 ? (
                      <span style={pillStyle(alpha(palette.green, 0.12), palette.green)}>
                        ↑{repoState.aheadCount} ahead
                      </span>
                    ) : null}
                    {repoState.behindCount > 0 ? (
                      <span style={pillStyle(alpha(palette.red, 0.12), palette.red)}>
                        ↓{repoState.behindCount} behind
                      </span>
                    ) : null}
                    {summary && <span style={pillStyle(alpha(palette.panel, 0.9), palette.muted)}>{summary.totalFiles} changed</span>}
                    {summary && summary.stagedFiles > 0 ? <span style={pillStyle(alpha(palette.green, 0.10), palette.green)}>{summary.stagedFiles} staged</span> : null}
                    {summary && summary.unstagedFiles > 0 ? <span style={pillStyle(alpha(palette.yellow, 0.12), palette.yellow)}>{summary.unstagedFiles} working</span> : null}
                    {summary && summary.conflictedFiles > 0 ? <span style={pillStyle(alpha(palette.red, 0.12), palette.red)}>{summary.conflictedFiles} conflicted</span> : null}
                    {summary && <span style={pillStyle(alpha(palette.green, 0.14), palette.green)}>+{summary.additions}</span>}
                    {summary && <span style={pillStyle(alpha(palette.red, 0.14), palette.red)}>-{summary.deletions}</span>}
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 10, color: palette.muted }}>
                    <span>{repoState.path}</span>
                    <span>•</span>
                    <GitCommit size={12} />
                    <span>{repoState.lastCommit}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {canSwitchBranches ? (
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        minHeight: 28,
                        color: palette.text,
                      }}
                    >
                      <GitBranch size={12} style={{ color: palette.muted }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: palette.muted }}>Branch</span>
                      <select
                        aria-label="Git branch"
                        value={repoState.branch}
                        disabled={loading}
                        onChange={event => { void handleSwitchBranch(event.target.value); }}
                        style={{
                          ...themedSelectStyle({
                            backgroundColor: alpha(palette.panel, 0.96),
                            borderColor: alpha(palette.border, 0.95),
                            textColor: palette.text,
                            mutedColor: palette.muted,
                            fontFamily: uiFont,
                            minWidth: 280,
                            fontSize: 10.5,
                            fontWeight: 700,
                          }),
                          cursor: loading ? 'default' : 'pointer',
                        }}
                      >
                        {branchSelectOptions.map(branch => (
                          <option key={branch.name} value={branch.name}>
                            {branch.name}
                            {branch.upstreamName ? ` • ${branch.upstreamName}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <button onClick={() => void refreshRepo()} disabled={loading} style={toolbarButtonStyle(palette)}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</button>
                  <button onClick={() => void handleFetch()} disabled={loading} style={toolbarButtonStyle(palette)}><Download size={13} />Fetch</button>
                  <button onClick={() => void handlePull()} disabled={loading} style={toolbarButtonStyle(palette)}><Download size={13} />Pull</button>
                  <button onClick={() => void handlePush()} disabled={loading} style={toolbarButtonStyle(palette)}><Upload size={13} />Push</button>
                </div>
              </div>
            </div>

            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${palette.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: alpha(palette.panel, 0.72) }}>
              <button
                type="button"
                onClick={() => setMainTab('changes')}
                style={{
                  ...pillStyle(mainTab === 'changes' ? alpha(palette.accent, 0.16) : alpha(palette.panel, 0.84), mainTab === 'changes' ? palette.accent : palette.muted),
                  border: `1px solid ${mainTab === 'changes' ? alpha(palette.accent, 0.5) : palette.border}`,
                  cursor: 'pointer',
                }}
              >
                Changes
              </button>
              <button
                type="button"
                onClick={() => setMainTab('history')}
                style={{
                  ...pillStyle(mainTab === 'history' ? alpha(palette.accent, 0.16) : alpha(palette.panel, 0.84), mainTab === 'history' ? palette.accent : palette.muted),
                  border: `1px solid ${mainTab === 'history' ? alpha(palette.accent, 0.5) : palette.border}`,
                  cursor: 'pointer',
                }}
              >
                History
              </button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: palette.muted }}>
                {mainTab === 'changes'
                  ? 'Working tree, staging, and ship actions.'
                  : 'Timeline view with grouped commits and per-file patches.'}
              </span>
            </div>

            {mainTab === 'changes' ? (
              <>
                <div style={{ padding: '7px 12px', borderBottom: `1px solid ${palette.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: alpha(palette.panel, 0.72) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220, flex: '1 1 220px', maxWidth: 400, padding: '5px 9px', borderRadius: 8, border: `1px solid ${palette.border}`, background: alpha(palette.bg, 0.5) }}>
                    <Search size={12} style={{ color: palette.muted }} />
                    <input value={changeQuery} onChange={event => setChangeQuery(event.target.value)} placeholder="Search changed files" style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: palette.text, fontSize: 10.5 }} />
                  </div>
                  {(Object.keys(FILTERS) as ChangeFilter[]).map(filter => (
                    <button key={filter} onClick={() => setChangeFilter(filter)} style={{ ...pillStyle(filter === changeFilter ? alpha(palette.accent, 0.16) : alpha(palette.panel, 0.84), filter === changeFilter ? palette.accent : palette.muted), border: `1px solid ${filter === changeFilter ? alpha(palette.accent, 0.5) : palette.border}`, cursor: 'pointer' }}>{FILTERS[filter]}</button>
                  ))}
                  <div style={{ flex: 1 }} />
                  <textarea value={commitMsg} onChange={event => setCommitMsg(event.target.value)} placeholder="Commit message for Quick Ship" className="hide-scrollbar" style={{ height: 28, minWidth: 220, maxWidth: 400, flex: '1 1 220px', resize: 'none', borderRadius: 8, border: `1px solid ${palette.border}`, background: alpha(palette.bg, 0.5), color: palette.text, padding: '6px 9px', fontSize: 10.5, outline: 'none' }} />
                  <button
                    onClick={() => void handleStageAll()}
                    disabled={loading || !canStageAllChanges}
                    title={hasConflictedFiles ? 'Resolve conflicted files before staging everything.' : undefined}
                    style={toolbarButtonStyle(palette)}
                  >
                    Stage All
                  </button>
                  <button
                    onClick={() => void handleCommit()}
                    disabled={loading || !commitMsg.trim() || !canCommitStagedChanges}
                    title={hasConflictedFiles ? 'Resolve conflicted files before committing.' : !hasStagedChanges ? 'Commit only includes staged files.' : undefined}
                    style={{ ...toolbarButtonStyle(palette), background: palette.accent, borderColor: palette.accent, color: '#fff' }}
                  >
                    Commit
                  </button>
                  <button
                    onClick={() => void handleQuickShip()}
                    disabled={loading || !canQuickShipChanges}
                    title={hasConflictedFiles ? 'Resolve conflicted files before Quick Ship.' : 'Stage all, commit, and push in one step'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 30,
                      padding: '0 12px 0 10px',
                      borderRadius: 999,
                      border: `1px solid ${alpha(palette.green, 0.45)}`,
                      background: `linear-gradient(180deg, ${alpha(palette.green, 0.20)}, ${alpha(palette.green, 0.10)})`,
                      color: palette.text,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      boxShadow: `inset 0 0 0 1px ${alpha(palette.green, 0.10)}`,
                    }}
                  >
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      background: alpha(palette.green, 0.18),
                      color: palette.green,
                      flexShrink: 0,
                    }}>
                      <Rocket size={11} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                      <span>Quick Ship</span>
                      <span style={{ fontSize: 9, color: palette.muted, fontWeight: 600, letterSpacing: '0.04em' }}>Stage • Commit • Push</span>
                    </span>
                  </button>
                  {sourceActionHint ? (
                    <div style={{ flexBasis: '100%', fontSize: 10, color: hasConflictedFiles ? palette.red : palette.muted }}>
                      {sourceActionHint}
                    </div>
                  ) : null}
                </div>

                {error && <div style={{ padding: '7px 14px', borderBottom: `1px solid ${palette.border}`, fontSize: 11, color: palette.red, background: alpha(palette.red, 0.10) }}>{error}</div>}

                <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
                  <ResizablePane
                    size={changeListWidth}
                    minSize={260}
                    maxSize={720}
                    onSizeChange={setChangeListWidth}
                    borderColor={alpha(palette.accent, 0.28)}
                    style={{ minHeight: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${palette.border}`, background: palette.card }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 56px 56px', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${palette.border}`, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.muted }}>
                      <span>Status</span><span>File</span><span style={{ textAlign: 'right' }}>+</span><span style={{ textAlign: 'right' }}>-</span>
                    </div>
                    <OverlayScrollArea
                      style={{ flex: 1, minHeight: 0 }}
                      viewportRef={changeListViewportRef}
                      onViewportScroll={event => setChangeListScrollTop(event.currentTarget.scrollTop)}
                    >
                      {filteredFiles.length === 0 ? (
                        <div style={{ padding: 14, color: palette.muted, fontSize: 11 }}>{repoState.status.length === 0 ? 'Working tree is clean.' : 'No files match the current filter.'}</div>
                      ) : (
                        <>
                          <div style={{ height: changeListVirtualWindow.topSpacer }} />
                          {virtualizedFilteredFiles.map(file => (
                            <button key={`${file.statusText}-${file.file}`} onClick={() => setSelectedFilePath(file.file)} style={{ width: '100%', height: CHANGE_LIST_ROW_HEIGHT, display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 56px 56px', gap: 8, alignItems: 'center', padding: '7px 12px', border: 'none', borderBottom: `1px solid ${alpha(palette.border, 0.7)}`, background: selectedFilePath === file.file ? alpha(palette.accent, 0.14) : 'transparent', color: palette.text, cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}>
                              <span style={{ ...pillStyle(alpha(statusColor(file, palette), 0.14), statusColor(file, palette)), justifyContent: 'center' }}>{statusLabel(file)}</span>
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: monoFont }}>{file.file}</span>
                                {file.originalFile && <span style={{ display: 'block', marginTop: 2, fontSize: 9.5, color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: monoFont }}>{file.originalFile}</span>}
                              </span>
                              <span style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: palette.green }}>+{file.additions}</span>
                              <span style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: palette.red }}>-{file.deletions}</span>
                            </button>
                          ))}
                          <div style={{ height: changeListVirtualWindow.bottomSpacer }} />
                        </>
                      )}
                    </OverlayScrollArea>
                  </ResizablePane>

                  <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: palette.bg }}>
                    <div style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, fontSize: 11, color: palette.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedFile ? `${selectedFile.file} • ${statusLabel(selectedFile)} • +${selectedFile.additions} / -${selectedFile.deletions}` : 'Select a changed file to inspect the diff.'}
                        </span>
                        {selectedFile ? (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={pillStyle(alpha(statusColor(selectedFile, palette), 0.14), statusColor(selectedFile, palette))}>
                              {statusLabel(selectedFile)}
                            </span>
                            {selectedFile.isStaged ? (
                              <span style={pillStyle(alpha(palette.green, 0.14), palette.green)}>Staged</span>
                            ) : null}
                            {selectedFile.hasUnstagedChanges ? (
                              <span style={pillStyle(alpha(palette.yellow, 0.16), palette.yellow)}>Working Tree</span>
                            ) : null}
                            {selectedFile.isUntracked ? (
                              <span style={pillStyle(alpha(palette.yellow, 0.12), palette.muted)}>Untracked</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                        {selectedFile ? (
                          <>
                            {canResolveSelectedConflict ? (
                              <button
                                type="button"
                                onClick={() => void handleResolveSelectedConflict('ours')}
                                disabled={loading}
                                title="Resolve this conflict with git's --ours version and stage the result."
                                style={{ ...toolbarButtonStyle(palette), background: alpha(palette.accent, 0.12), borderColor: alpha(palette.accent, 0.4), color: palette.accent }}
                              >
                                Use Ours
                              </button>
                            ) : null}
                            {canResolveSelectedConflict ? (
                              <button
                                type="button"
                                onClick={() => void handleResolveSelectedConflict('theirs')}
                                disabled={loading}
                                title="Resolve this conflict with git's --theirs version and stage the result."
                                style={{ ...toolbarButtonStyle(palette), background: alpha(palette.yellow, 0.12), borderColor: alpha(palette.yellow, 0.4), color: palette.yellow }}
                              >
                                Use Theirs
                              </button>
                            ) : null}
                            {canStageSelectedFile ? (
                              <button
                                type="button"
                                onClick={() => void handleStageSelectedFile()}
                                disabled={loading}
                                title={selectedFile.kind === 'conflicted' ? 'Stage the current file contents to mark this conflict as resolved.' : undefined}
                                style={{ ...toolbarButtonStyle(palette), background: alpha(palette.green, 0.12), borderColor: alpha(palette.green, 0.42), color: palette.green }}
                              >
                                {stageSelectedFileLabel}
                              </button>
                            ) : null}
                            {canUnstageSelectedFile ? (
                              <button
                                type="button"
                                onClick={() => void handleUnstageSelectedFile()}
                                disabled={loading}
                                style={toolbarButtonStyle(palette)}
                              >
                                Unstage
                              </button>
                            ) : null}
                            {canDiscardSelectedFile ? (
                              <button
                                type="button"
                                onClick={() => void handleDiscardSelectedFile()}
                                disabled={loading}
                                title={selectedFile.isStaged && selectedFile.hasUnstagedChanges ? 'Discard only working tree changes and keep staged changes in the index.' : 'Discard the selected file changes.'}
                                style={{ ...toolbarButtonStyle(palette), background: alpha(palette.red, 0.10), borderColor: alpha(palette.red, 0.32), color: palette.red }}
                              >
                                {discardSelectedFileLabel}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {selectedFile && diffView && diffView.hunkLines.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, color: palette.muted }}>
                              Hunk {activeHunkIndex + 1} / {diffView.hunkLines.length}
                            </span>
                            <button type="button" onClick={() => jumpToDiffHunk(activeHunkIndex - 1)} style={iconButtonStyle(palette)} title="Previous change">
                              <ChevronUp size={11} />
                            </button>
                            <button type="button" onClick={() => jumpToDiffHunk(activeHunkIndex + 1)} style={iconButtonStyle(palette)} title="Next change">
                              <ChevronDown size={11} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div
                      ref={node => { diffContainerRef.current = node; }}
                      style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
                    >
                      {selectedFile ? (
                        diffLoading ? (
                          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 11 }}>Loading diff…</div>
                        ) : (
                          <React.Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 11 }}>Loading diff editor…</div>}>
                            <LazyMonacoEditor
                              height="100%"
                              beforeMount={(monaco) => {
                                applyExplorerMonacoTheme(monaco, appearance);
                              }}
                              onMount={(editor, monaco) => {
                                diffEditorRef.current = editor;
                                diffMonacoRef.current = monaco;
                                applyExplorerMonacoTheme(monaco, appearance);
                                // Two-frame delay: first frame settles the flex layout,
                                // second ensures Monaco measures the real post-zoom size.
                                window.requestAnimationFrame(() => {
                                  window.requestAnimationFrame(() => {
                                    editor.layout?.();
                                  });
                                });
                              }}
                              value={diffView?.content ?? ''}
                              language="plaintext"
                              theme={monacoThemeId}
                              options={{
                                automaticLayout: true,
                                readOnly: true,
                                minimap: { enabled: false },
                                fontFamily: monoFont,
                                fontSize: 11.5,
                                lineNumbers: 'on',
                                glyphMargin: false,
                                folding: false,
                                overviewRulerLanes: 2,
                                lineDecorationsWidth: 12,
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                scrollbar: {
                                  vertical: 'visible',
                                  horizontal: 'visible',
                                  verticalScrollbarSize: 10,
                                  horizontalScrollbarSize: 10,
                                  alwaysConsumeMouseWheel: false,
                                },
                              }}
                            />
                          </React.Suspense>
                        )
                      ) : (
                        <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 12 }}>Pick a file from the change list.</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {error && <div style={{ padding: '7px 14px', borderBottom: `1px solid ${palette.border}`, fontSize: 11, color: palette.red, background: alpha(palette.red, 0.10) }}>{error}</div>}
                <GitHistoryPanel
                  palette={palette}
                  monoFont={monoFont}
                  repoPath={repoState.path}
                  branchName={repoState.branch}
                  safeGit={safeGit}
                />
              </>
            )}
          </>
        )}
      </div>

      <AppPromptDialog
        open={repositoryImportDialog.visible}
        title="Paste Repository Path"
        description="Enter an absolute path to a Git repository or any folder inside it. GreebleFS will normalize it to the repo root."
        icon={<FolderGit2 size={16} />}
        value={repositoryImportDialog.path}
        onChange={(path) => setRepositoryImportDialog((current) => ({ ...current, path }))}
        onSubmit={() => { void submitRepositoryImportDialog(); }}
        onCancel={closeRepositoryImportDialog}
        submitLabel="Import Repository"
        placeholder="/absolute/path/to/repo"
      />

      <AppConfirmDialog
        open={confirmationDialog.visible}
        title={confirmationDialog.title}
        description={confirmationDialog.description}
        icon={<AlertTriangle size={16} style={{ color: confirmationDialog.tone === 'danger' ? palette.red : palette.accent }} />}
        confirmLabel={confirmationDialog.confirmLabel}
        tone={confirmationDialog.tone}
        onConfirm={() => { void confirmPendingAction(); }}
        onCancel={closeConfirmationDialog}
      />

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function joinRepoPath(repoPath: string, filePath: string): string {
  const normalizedRepoPath = repoPath.replace(/[\\/]+$/, '');
  const prefersWindowsSeparators = normalizedRepoPath.includes('\\') && !normalizedRepoPath.includes('/');
  const normalizedFilePath = prefersWindowsSeparators
    ? filePath.replace(/\//g, '\\')
    : filePath.replace(/\\/g, '/');
  const separator = prefersWindowsSeparators ? '\\' : '/';
  return `${normalizedRepoPath}${separator}${normalizedFilePath.replace(/^[\\/]+/, '')}`;
}

function getParentPath(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '');
  const match = normalized.match(/^(.*)[\\/][^\\/]+$/);
  return match?.[1] ?? '';
}

function getBaseName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '');
  const match = normalized.match(/[^\\/]+$/);
  return match?.[0] ?? normalized;
}

function looksBinaryContent(content: string): boolean {
  return /\u0000/.test(content);
}

function unwrapGitManagerCommandResult<T>(result: T | { status: 'ok'; data: T } | { status: 'error'; error: string }): T {
  if (
    result
    && typeof result === 'object'
    && 'status' in result
    && (result.status === 'ok' || result.status === 'error')
  ) {
    return unwrapTauriResult(result);
  }

  return result as T;
}

async function getFileSizeHint(
  path: string,
  cache?: Map<string, number | null>,
): Promise<number | null> {
  if (cache?.has(path)) {
    return cache.get(path) ?? null;
  }

  const parentPath = getParentPath(path);
  const baseName = getBaseName(path);
  if (!parentPath || !baseName) {
    cache?.set(path, null);
    return null;
  }

  try {
    const entries = await Promise.resolve(commands.fsListDir(parentPath, true)).then(unwrapGitManagerCommandResult);
    const matchingEntry = entries.find(entry => entry.name === baseName && !entry.is_dir);
    const sizeHint = typeof matchingEntry?.size === 'number' ? matchingEntry.size : null;
    cache?.set(path, sizeHint);
    return sizeHint;
  } catch {
    cache?.set(path, null);
    return null;
  }
}

function buildNonTextUntrackedDiff(path: string, reason: string): string {
  return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@\n+${reason}\n`;
}

async function buildUnifiedDiff(
  repoPath: string,
  file: GitFileStatus,
  safeGit: (repo: string, args: string[], fallback?: string) => Promise<string>,
  untrackedSizeHintCache: Map<string, number | null>,
): Promise<string> {
  const diffPaths = [file.originalFile ?? file.file, file.file];

  if (file.isUntracked) {
    if (file.file.endsWith('/')) {
      return `diff --git a/${file.file} b/${file.file}\nnew file mode 040000\n--- /dev/null\n+++ b/${file.file}\n@@\n+Directory added: ${file.file}\n`;
    }

    const absolutePath = joinRepoPath(repoPath, file.file);
    const sizeHint = await getFileSizeHint(absolutePath, untrackedSizeHintCache);
    if (typeof sizeHint === 'number' && sizeHint > MAX_SYNTHETIC_UNTRACKED_DIFF_BYTES) {
      return buildNonTextUntrackedDiff(
        file.file,
        `Large untracked file omitted from inline diff (${Math.round(sizeHint / 1024)} KB).`,
      );
    }

    const content = await Promise.resolve(commands.fsReadTextFile(absolutePath))
      .then(unwrapGitManagerCommandResult)
      .catch(() => '');

    if (!content) {
      return buildNonTextUntrackedDiff(file.file, 'Untracked file preview unavailable or non-text.');
    }

    if (looksBinaryContent(content)) {
      return buildNonTextUntrackedDiff(file.file, 'Binary or non-text untracked file omitted from inline diff.');
    }

    return buildSyntheticAddedDiff(file.file, content);
  }

  if (file.kind === 'conflicted') {
    const conflictPatch = await safeGit(
      repoPath,
      ['diff', '--cc', '--find-renames', '--no-ext-diff', '--', ...diffPaths],
      '',
    );

    if (conflictPatch.trim()) {
      return conflictPatch;
    }
  }

  const patch = await safeGit(
    repoPath,
    ['diff', 'HEAD', '--find-renames', '--no-ext-diff', '--', ...diffPaths],
    '',
  );

  if (patch.trim()) {
    return patch;
  }

  if (file.kind === 'deleted') {
    return `diff --git a/${file.file} b/${file.file}\ndeleted file mode 100644\n--- a/${file.file}\n+++ /dev/null\n`;
  }

  return `diff --git a/${file.file} b/${file.file}\n@@\n+No textual diff output was produced for this file.\n`;
}

function buildSyntheticAddedDiff(path: string, content: string): string {
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const hunkLength = Math.max(lines.length, 1);
  const body = lines.length > 0 ? lines.map(line => `+${line}`).join('\n') : '+';
  return `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${hunkLength} @@\n${body}\n`;
}

function findDiffHunkLines(patch: string): number[] {
  return patch
    .split(/\r?\n/)
    .flatMap((line, index) => (line.startsWith('@@') ? [index + 1] : []));
}

function buildRepoBadgeState(files: GitFileStatus[]): RepoBadgeState {
  return {
    changeCount: files.length,
    conflictedCount: files.filter(file => file.kind === 'conflicted').length,
    loadedAt: Date.now(),
    error: null,
  };
}

function iconButtonStyle(palette: { border: string; panel: string; muted?: string; text?: string }): React.CSSProperties {
  return { width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 7, border: `1px solid ${palette.border}`, background: alpha(palette.panel, 0.8), color: palette.muted || palette.text || 'inherit', cursor: 'pointer', flexShrink: 0 };
}

function repoNotificationBadgeStyle(
  palette: { red: string; border: string },
  hasConflicts: boolean,
): React.CSSProperties {
  return {
    minWidth: 18,
    height: 18,
    padding: '0 6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: hasConflicts ? '#ef4444' : palette.red,
    border: `1px solid ${hasConflicts ? '#fca5a5' : alpha(palette.red, 0.55)}`,
    color: '#fff',
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: '0.02em',
    boxShadow: `0 0 0 1px ${alpha('#ffffff', 0.08)}`,
    flexShrink: 0,
  };
}

function toolbarButtonStyle(palette: { border: string; panel: string; text: string }): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26, padding: '0 9px', borderRadius: 8, border: `1px solid ${palette.border}`, background: alpha(palette.panel, 0.86), color: palette.text, cursor: 'pointer', fontSize: 10.5, fontWeight: 700 };
}

function pillStyle(background: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 17, padding: '0 6px', borderRadius: 999, background, color, fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' };
}

type RgbColor = { r: number; g: number; b: number };

function parseCssColorToRgb(color: string | undefined): RgbColor | null {
  const trimmed = color?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return null;
  }

  const channels = rgbMatch[1]
    .split(',')
    .slice(0, 3)
    .map(channel => Number.parseFloat(channel.trim()));

  if (channels.length < 3 || channels.some(channel => Number.isNaN(channel))) {
    return null;
  }

  return {
    r: channels[0] ?? 0,
    g: channels[1] ?? 0,
    b: channels[2] ?? 0,
  };
}

function getRelativeColorLuminance(color: RgbColor): number {
  const normalize = (channel: number) => {
    const srgb = Math.max(0, Math.min(255, channel)) / 255;
    return srgb <= 0.04045
      ? srgb / 12.92
      : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * normalize(color.r)) + (0.7152 * normalize(color.g)) + (0.0722 * normalize(color.b));
}

function resolveSelectColorScheme(backgroundColor: string, textColor: string): 'light' | 'dark' {
  const backgroundRgb = parseCssColorToRgb(backgroundColor);
  if (backgroundRgb) {
    return getRelativeColorLuminance(backgroundRgb) < 0.42 ? 'dark' : 'light';
  }

  const textRgb = parseCssColorToRgb(textColor);
  if (textRgb) {
    return getRelativeColorLuminance(textRgb) > 0.58 ? 'dark' : 'light';
  }

  return 'dark';
}

function themedSelectStyle(options: {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  fontFamily?: string;
  minWidth?: number;
  fontSize?: number;
  fontWeight?: number;
}): React.CSSProperties {
  return {
    minWidth: options.minWidth ?? 160,
    minHeight: 28,
    padding: '0 30px 0 10px',
    borderRadius: 8,
    border: `1px solid ${options.borderColor}`,
    backgroundColor: options.backgroundColor,
    backgroundImage: [
      `linear-gradient(45deg, transparent 50%, ${options.mutedColor} 50%)`,
      `linear-gradient(135deg, ${options.mutedColor} 50%, transparent 50%)`,
    ].join(', '),
    backgroundPosition: 'calc(100% - 15px) calc(50% - 2px), calc(100% - 10px) calc(50% - 2px)',
    backgroundSize: '5px 5px',
    backgroundRepeat: 'no-repeat',
    color: options.textColor,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize ?? 10.5,
    fontWeight: options.fontWeight ?? 700,
    lineHeight: 1.2,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    colorScheme: resolveSelectColorScheme(options.backgroundColor, options.textColor),
    boxShadow: `inset 0 0 0 1px ${alpha(options.textColor, 0.02)}`,
  };
}

function statusLabel(file: GitFileStatus): string {
  if (file.kind === 'added') return 'Added';
  if (file.kind === 'deleted') return 'Deleted';
  if (file.kind === 'renamed') return 'Renamed';
  if (file.kind === 'copied') return 'Copied';
  if (file.kind === 'untracked') return 'New';
  if (file.kind === 'conflicted') return 'Conflict';
  return 'Modified';
}

function statusColor(file: GitFileStatus, palette: { accent: string; green: string; red: string; yellow: string }): string {
  if (file.kind === 'added') return palette.green;
  if (file.kind === 'deleted' || file.kind === 'conflicted') return palette.red;
  if (file.kind === 'renamed' || file.kind === 'copied') return palette.accent;
  if (file.kind === 'untracked') return palette.yellow;
  return palette.yellow;
}

function canStageFile(file: GitFileStatus): boolean {
  return file.isUntracked || file.hasUnstagedChanges;
}

function stageActionLabel(file: GitFileStatus): string {
  if (file.kind === 'conflicted') {
    return 'Mark Resolved';
  }

  return 'Stage';
}

function canDiscardFile(file: GitFileStatus): boolean {
  if (file.kind === 'conflicted') {
    return false;
  }

  return file.isUntracked || file.hasUnstagedChanges;
}

function discardActionLabel(file: GitFileStatus): string {
  if (file.isStaged && file.hasUnstagedChanges) {
    return 'Discard Working';
  }

  return 'Discard';
}

function buildDiscardConfirmationMessage(file: GitFileStatus): string {
  if (file.isUntracked) {
    return `Remove the untracked file ${file.file}? This cannot be undone from GreebleFS.`;
  }

  if (file.isStaged && file.hasUnstagedChanges) {
    return `Discard only the unstaged changes in ${file.file}? Staged changes will be kept.`;
  }

  return `Discard the current working tree changes in ${file.file}?`;
}

function buildConflictResolutionConfirmationMessage(
  file: GitFileStatus,
  side: ConflictResolutionSide,
): string {
  const sideLabel = side === 'ours' ? 'our' : 'their';
  const sideCode = side === 'ours' ? file.stagedCode : file.unstagedCode;

  if (sideCode === 'D') {
    return `Resolve the conflict in ${file.file} by deleting the file with ${sideLabel} version? GreebleFS will stage that resolution.`;
  }

  return `Resolve the conflict in ${file.file} with ${sideLabel} version? GreebleFS will replace the working tree file and stage the result as resolved.`;
}

function getGitTrackedPaths(file: GitFileStatus): string[] {
  return Array.from(
    new Set(
      [file.originalFile, file.file]
        .filter((value): value is string => Boolean(value))
        .map(value => value.replace(/\\/g, '/')),
    ),
  );
}

function getGitIndexPaths(file: GitFileStatus): string[] {
  return Array.from(
    new Set(
      [file.file]
        .filter((value): value is string => Boolean(value))
        .map(value => value.replace(/\\/g, '/')),
    ),
  );
}

type ConflictResolutionSide = 'ours' | 'theirs';

async function resolveConflictedFile(
  repoPath: string,
  file: GitFileStatus,
  side: ConflictResolutionSide,
  runGit: (repo: string, args: string[]) => Promise<string>,
): Promise<void> {
  const sideCode = side === 'ours' ? file.stagedCode : file.unstagedCode;
  const indexPaths = getGitIndexPaths(file);

  if (indexPaths.length === 0) {
    throw new Error(`Unable to resolve conflicted file ${file.file} because no tracked path was available.`);
  }

  if (sideCode === 'D') {
    await runGit(repoPath, ['rm', '--', ...indexPaths]);
    return;
  }

  await runGit(repoPath, ['checkout', `--${side}`, '--', ...indexPaths]);
  await runGit(repoPath, ['add', '--', ...indexPaths]);
}

async function discardTrackedFileChanges(
  repoPath: string,
  file: GitFileStatus,
  runGit: (repo: string, args: string[]) => Promise<string>,
  safeGit: (repo: string, args: string[], fallback?: string) => Promise<string>,
): Promise<void> {
  const trackedPaths = getGitTrackedPaths(file);
  if (!file.isStaged) {
    await runGit(repoPath, ['restore', '--worktree', '--source=HEAD', '--', ...trackedPaths]);
    return;
  }

  const hasHead = Boolean((await safeGit(repoPath, ['rev-parse', '--verify', 'HEAD'], '')).trim());
  if (hasHead) {
    await runGit(repoPath, ['restore', '--worktree', '--source=HEAD', '--', ...trackedPaths]);
    return;
  }

  const indexPaths = getGitIndexPaths(file);
  if (indexPaths.length === 0) {
    throw new Error(`Unable to discard ${file.file} before the first commit because no staged path was available.`);
  }

  await runGit(repoPath, ['checkout-index', '--force', '--', ...indexPaths]);
}

function alpha(color: string, opacity: number): string {
  return multiplyColorAlpha(color, opacity);
}

function sanitizeRepositoryList(paths: unknown[]): string[] {
  const unique = new Map<string, string>();

  for (const value of paths) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeRepositoryPath(value);
    if (!normalized) {
      continue;
    }

    const comparablePath = getRepositoryComparablePath(normalized);
    if (!unique.has(comparablePath)) {
      unique.set(comparablePath, normalized);
    }
  }

  return [...unique.values()];
}

function normalizeRepositoryPath(path: string): string {
  return path.trim().replace(/[\\/]+$/, '');
}

function getRepositoryComparablePath(path: string): string {
  const normalized = normalizeRepositoryPath(path).replace(/\\/g, '/');
  if (/^[a-z]:\//i.test(normalized) || normalized.startsWith('//')) {
    return normalized.toLowerCase();
  }
  return normalized;
}

function repositoryPathListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((path, index) => (
    getRepositoryComparablePath(path) === getRepositoryComparablePath(right[index] ?? '')
  ));
}
