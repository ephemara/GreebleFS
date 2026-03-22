import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Editor from '@monaco-editor/react';
import { ChevronDown, ChevronUp, Download, FolderGit2, GitBranch, GitCommit, Plus, RefreshCw, Rocket, Search, Upload, X } from 'lucide-react';
import { multiplyColorAlpha, type ResolvedOverlayAppearance } from '../config/appearance';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  type GitFileStatus,
  mergeGitStatusWithStats,
  parseGitNumstat,
  parseGitStatus,
  summarizeGitFiles,
} from './gitManager.utils';

interface RepoState {
  path: string;
  name: string;
  branch: string;
  status: GitFileStatus[];
  lastCommit: string;
  loadedAt: number;
}

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

type ChangeFilter = 'all' | 'staged' | 'unstaged' | 'untracked';

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

  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoState, setRepoState] = useState<RepoState | null>(null);
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
  const deferredQuery = useDeferredValue(changeQuery);
  const [repoRailWidth, setRepoRailWidth] = usePersistentPanelSize('overlayterm-source-repo-rail-width', 208, 160, 300);
  const [changeListWidth, setChangeListWidth] = usePersistentPanelSize('overlayterm-source-change-list-width', 360, 260, 720);
  const diffContainerRef = useRef<HTMLDivElement | null>(null);
  const diffEditorRef = useRef<any>(null);
  const diffMonacoRef = useRef<any>(null);
  const diffDecorationsRef = useRef<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('overlayterm-git-repos');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      setRepos(parsed);
      if (parsed.length > 0) setSelectedRepo(parsed[0]);
    } catch (storageError) {
      console.error(storageError);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('overlayterm-git-repos', JSON.stringify(repos));
  }, [repos]);

  useEffect(() => {
    setRepoBadges(current => Object.fromEntries(Object.entries(current).filter(([path]) => repos.includes(path))));
  }, [repos]);

  const runGit = useCallback(async (repo: string, args: string[]) => {
    return invoke<string>('git_exec', { repoPath: repo, args });
  }, []);

  const safeGit = useCallback(async (repo: string, args: string[], fallback = '') => {
    try {
      return await runGit(repo, args);
    } catch {
      return fallback;
    }
  }, [runGit]);

  const loadRepoBadge = useCallback(async (path: string): Promise<RepoBadgeState> => {
    try {
      await runGit(path, ['rev-parse', '--is-inside-work-tree']);
      const statusText = await safeGit(path, ['status', '--porcelain'], '');
      return buildRepoBadgeState(parseGitStatus(statusText));
    } catch (loadError) {
      return {
        changeCount: 0,
        conflictedCount: 0,
        loadedAt: Date.now(),
        error: String(loadError),
      };
    }
  }, [runGit, safeGit]);

  const refreshRepoBadges = useCallback(async (targetRepos: string[] = repos) => {
    if (targetRepos.length === 0) {
      return;
    }

    const nextEntries = await Promise.all(
      targetRepos.map(async repo => [repo, await loadRepoBadge(repo)] as const),
    );

    setRepoBadges(current => ({
      ...current,
      ...Object.fromEntries(nextEntries),
    }));
  }, [loadRepoBadge, repos]);

  const loadRepoState = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      await runGit(path, ['rev-parse', '--is-inside-work-tree']);
      const [branch, lastCommit, statusText, unstagedStats, stagedStats] = await Promise.all([
        safeGit(path, ['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
        safeGit(path, ['log', '-1', '--pretty=format:%h - %s (%cr)'], 'No commits yet'),
        safeGit(path, ['status', '--porcelain'], ''),
        safeGit(path, ['diff', '--numstat', '--no-ext-diff'], ''),
        safeGit(path, ['diff', '--cached', '--numstat', '--no-ext-diff'], ''),
      ]);
      const status = mergeGitStatusWithStats(parseGitStatus(statusText), parseGitNumstat(unstagedStats), parseGitNumstat(stagedStats));

      setRepoState({
        path,
        name: path.split(/[/\\]/).pop() || path,
        branch: branch.trim() || 'unknown',
        status,
        lastCommit: lastCommit.trim() || 'No commits yet',
        loadedAt: Date.now(),
      });
      setRepoBadges(current => ({ ...current, [path]: buildRepoBadgeState(status) }));
    } catch (loadError) {
      setError(String(loadError));
      setRepoState(null);
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
  }, [runGit, safeGit]);

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

    const syncBadges = async () => {
      const targetRepos = [...repos];
      const nextEntries = await Promise.all(
        targetRepos.map(async repo => [repo, await loadRepoBadge(repo)] as const),
      );

      if (disposed) {
        return;
      }

      setRepoBadges(current => ({
        ...current,
        ...Object.fromEntries(nextEntries),
      }));
    };

    void syncBadges();
    const intervalId = window.setInterval(() => {
      void syncBadges();
    }, 30000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [loadRepoBadge, repos]);

  const refreshRepo = useCallback(async () => {
    if (!selectedRepo) return;
    await Promise.all([loadRepoState(selectedRepo), refreshRepoBadges()]);
  }, [loadRepoState, refreshRepoBadges, selectedRepo]);

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
    const normalizedPaths = Array.from(new Set(
      paths
        .map(path => path.trim())
        .filter(Boolean),
    ));
    if (normalizedPaths.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(normalizedPaths.map(async path => {
        try {
          await runGit(path, ['rev-parse', '--is-inside-work-tree']);
          return { path, ok: true as const };
        } catch (repoError) {
          return { path, ok: false as const, error: String(repoError) };
        }
      }));

      const validPaths = results.filter(result => result.ok).map(result => result.path);
      const invalidResults = results.filter((result): result is { path: string; ok: false; error: string } => !result.ok);

      if (validPaths.length > 0) {
        setRepos(current => {
          const existing = new Set(current);
          return [...current, ...validPaths.filter(path => !existing.has(path))];
        });
        setSelectedRepo(validPaths[0]);
      }

      if (invalidResults.length > 0) {
        const invalidSummary = invalidResults.map(result => `${result.path}: ${result.error}`).join('\n');
        setError(validPaths.length > 0 ? `Some repositories were skipped:\n${invalidSummary}` : invalidSummary);
      }
    } finally {
      setLoading(false);
    }
  }, [runGit]);

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

    const path = window.prompt('Enter absolute path to Git repository:');
    if (!path) return;
    await importRepositories([path]);
  }, [importRepositories, onRequestRepositoryImport]);

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

  const handlePull = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['pull']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handlePush = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['push']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handleQuickShip = useCallback(async () => {
    if (!selectedRepo || !repoState) return;
    if (repoState.status.length === 0) {
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
  }, [commitMsg, repoState, runGit, runRepoAction, selectedRepo]);

  const selectedFile = repoState?.status.find(file => file.file === selectedFilePath) ?? null;

  const loadDiff = useCallback(async (repoPath: string, file: GitFileStatus) => {
    setDiffLoading(true);
    try {
      const patch = await buildUnifiedDiff(repoPath, file, safeGit);
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
    setActiveHunkIndex(0);
  }, [selectedFilePath, diffView?.content]);

  useEffect(() => {
    const container = diffContainerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      diffEditorRef.current?.layout?.();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [diffContainerRef]);

  const summary = repoState ? summarizeGitFiles(repoState.status) : null;
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
                  <button onClick={event => removeRepo(repo, event)} style={{ ...iconButtonStyle(palette), opacity: active ? 1 : 0.3 }}><X size={11} /></button>
                </div>
              </button>
            );
          })}
        </OverlayScrollArea>
      </ResizablePane>

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!repoState ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 12 }}>Select or add a repository.</div>
        ) : (
          <>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, background: palette.panel }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{repoState.name}</div>
                    <span style={pillStyle(alpha(palette.accent, 0.14), palette.accent)}><GitBranch size={11} />{repoState.branch}</span>
                    {summary && <span style={pillStyle(alpha(palette.panel, 0.9), palette.muted)}>{summary.totalFiles} changed</span>}
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => void refreshRepo()} disabled={loading} style={toolbarButtonStyle(palette)}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh</button>
                  <button onClick={() => void handlePull()} disabled={loading} style={toolbarButtonStyle(palette)}><Download size={13} />Pull</button>
                  <button onClick={() => void handlePush()} disabled={loading} style={toolbarButtonStyle(palette)}><Upload size={13} />Push</button>
                </div>
              </div>
            </div>

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
              <button onClick={() => void runRepoAction(() => runGit(selectedRepo!, ['add', '-A']).then(() => undefined))} disabled={loading || !repoState.status.length} style={toolbarButtonStyle(palette)}>Stage All</button>
              <button onClick={() => void runRepoAction(async () => { if (commitMsg.trim()) { await runGit(selectedRepo!, ['commit', '-m', commitMsg.trim()]); setCommitMsg(''); } })} disabled={loading || !commitMsg.trim() || !repoState.status.length} style={{ ...toolbarButtonStyle(palette), background: palette.accent, borderColor: palette.accent, color: '#fff' }}>Commit</button>
              <button
                onClick={() => void handleQuickShip()}
                disabled={loading || !repoState.status.length}
                title="Stage all, commit, and push in one step"
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
                <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
                  {filteredFiles.length === 0 ? (
                    <div style={{ padding: 14, color: palette.muted, fontSize: 11 }}>{repoState.status.length === 0 ? 'Working tree is clean.' : 'No files match the current filter.'}</div>
                  ) : filteredFiles.map(file => (
                    <button key={`${file.statusText}-${file.file}`} onClick={() => setSelectedFilePath(file.file)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 56px 56px', gap: 8, alignItems: 'center', padding: '7px 12px', border: 'none', borderBottom: `1px solid ${alpha(palette.border, 0.7)}`, background: selectedFilePath === file.file ? alpha(palette.accent, 0.14) : 'transparent', color: palette.text, cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ ...pillStyle(alpha(statusColor(file, palette), 0.14), statusColor(file, palette)), justifyContent: 'center' }}>{statusLabel(file)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: monoFont }}>{file.file}</span>
                        {file.originalFile && <span style={{ display: 'block', marginTop: 2, fontSize: 9.5, color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: monoFont }}>{file.originalFile}</span>}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: palette.green }}>+{file.additions}</span>
                      <span style={{ textAlign: 'right', fontSize: 10.5, fontWeight: 700, color: palette.red }}>-{file.deletions}</span>
                    </button>
                  ))}
                </OverlayScrollArea>
              </ResizablePane>

              <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: palette.bg }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, fontSize: 11, color: palette.muted, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span>
                    {selectedFile ? `${selectedFile.file} • ${statusLabel(selectedFile)} • +${selectedFile.additions} / -${selectedFile.deletions}` : 'Select a changed file to inspect the diff.'}
                  </span>
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
                <div ref={node => { diffContainerRef.current = node; }} style={{ flex: 1, minHeight: 0 }}>
                  {selectedFile ? (
                    diffLoading ? (
                      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 11 }}>Loading diff…</div>
                    ) : (
                      <Editor
                        onMount={(editor, monaco) => {
                          diffEditorRef.current = editor;
                          diffMonacoRef.current = monaco;
                          window.requestAnimationFrame(() => {
                            editor.layout?.();
                          });
                        }}
                        value={diffView?.content ?? ''}
                        language="diff"
                        theme="vs-dark"
                        options={{
                          automaticLayout: true,
                          readOnly: true,
                          minimap: { enabled: false },
                          fontFamily: monoFont,
                          fontSize: 11.5,
                          lineNumbers: 'on',
                          glyphMargin: false,
                          folding: true,
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
                    )
                  ) : (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 12 }}>Pick a file from the change list.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function joinRepoPath(repoPath: string, filePath: string): string {
  return `${repoPath.replace(/[\\/]+$/, '')}/${filePath.replace(/\\/g, '/')}`;
}

async function buildUnifiedDiff(
  repoPath: string,
  file: GitFileStatus,
  safeGit: (repo: string, args: string[], fallback?: string) => Promise<string>,
): Promise<string> {
  const diffPaths = [file.originalFile ?? file.file, file.file];

  if (file.isUntracked) {
    if (file.file.endsWith('/')) {
      return `diff --git a/${file.file} b/${file.file}\nnew file mode 040000\n--- /dev/null\n+++ b/${file.file}\n@@\n+Directory added: ${file.file}\n`;
    }

    const content = await invoke<string>('fs_read_text_file', { path: joinRepoPath(repoPath, file.file) }).catch(() => '');
    return buildSyntheticAddedDiff(file.file, content);
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

function alpha(color: string, opacity: number): string {
  return multiplyColorAlpha(color, opacity);
}
