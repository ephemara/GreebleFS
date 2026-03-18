import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DiffEditor } from '@monaco-editor/react';
import {
  AlertTriangle,
  Clock3,
  Download,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommit,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
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

interface DiffViewState {
  file: string;
  original: string;
  modified: string;
  language: string;
}

type ChangeFilter = 'all' | 'staged' | 'unstaged' | 'untracked';

const FALLBACK = {
  bg: 'var(--overlay-bg-app)',
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
  unstaged: 'Working Tree',
  untracked: 'Untracked',
};

const MONACO_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  rs: 'rust',
  py: 'python',
  go: 'go',
  json: 'json',
  css: 'css',
  html: 'html',
  md: 'markdown',
  toml: 'toml',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  sh: 'shell',
  ps1: 'powershell',
  bat: 'bat',
};

export function GitManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const palette = {
    bg: appearance?.theme.palette.appBackground || FALLBACK.bg,
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

  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoState, setRepoState] = useState<RepoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMsg, setCommitMsg] = useState('');
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<DiffViewState | null>(null);
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [changeQuery, setChangeQuery] = useState('');
  const deferredQuery = useDeferredValue(changeQuery);

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

  const loadRepoState = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      await runGit(path, ['rev-parse', '--is-inside-work-tree']);
      const [branchText, lastCommitText, statusText, unstagedText, stagedText] = await Promise.all([
        safeGit(path, ['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
        safeGit(path, ['log', '-1', '--pretty=format:%h - %s (%cr)'], 'No commits yet'),
        safeGit(path, ['status', '--porcelain'], ''),
        safeGit(path, ['diff', '--numstat', '--no-ext-diff'], ''),
        safeGit(path, ['diff', '--cached', '--numstat', '--no-ext-diff'], ''),
      ]);

      const status = mergeGitStatusWithStats(
        parseGitStatus(statusText),
        parseGitNumstat(unstagedText),
        parseGitNumstat(stagedText),
      );

      const nextState: RepoState = {
        path,
        name: path.split(/[/\\]/).pop() || path,
        branch: branchText.trim() || 'unknown',
        status,
        lastCommit: lastCommitText.trim() || 'No commits yet',
        loadedAt: Date.now(),
      };

      setRepoState(nextState);
      return nextState;
    } catch (loadError) {
      setError(String(loadError));
      setRepoState(null);
      return null;
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
    const interval = window.setInterval(() => void loadRepoState(selectedRepo), 180000);
    return () => window.clearInterval(interval);
  }, [selectedRepo, loadRepoState]);

  const loadDiff = useCallback(async (repoPath: string, file: GitFileStatus) => {
    setDiffLoading(true);
    setError(null);
    try {
      const headPath = file.originalFile ?? file.file;
      const [original, modified] = await Promise.all([
        !file.isUntracked && file.kind !== 'added'
          ? safeGit(repoPath, ['show', `HEAD:${headPath}`], '')
          : Promise.resolve(''),
        file.kind !== 'deleted'
          ? invoke<string>('fs_read_text_file', { path: joinRepoPath(repoPath, file.file) }).catch(() => '')
          : Promise.resolve(''),
      ]);

      setDiffView({
        file: file.file,
        original,
        modified,
        language: inferLanguage(file.file),
      });
    } catch (diffError) {
      setError(`Failed to load diff: ${diffError}`);
      setDiffView(null);
    } finally {
      setDiffLoading(false);
    }
  }, [safeGit]);

  useEffect(() => {
    if (!repoState || !selectedDiffPath) return;
    const file = repoState.status.find(entry => entry.file === selectedDiffPath);
    if (!file) {
      setSelectedDiffPath(null);
      setDiffView(null);
      return;
    }
    void loadDiff(repoState.path, file);
  }, [repoState, selectedDiffPath, loadDiff]);

  const refreshRepo = useCallback(async () => {
    if (!selectedRepo) return;
    await loadRepoState(selectedRepo);
  }, [loadRepoState, selectedRepo]);

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

  const addRepo = useCallback(async () => {
    const path = window.prompt('Enter absolute path to Git repository:');
    if (!path) return;
    try {
      await runGit(path, ['status']);
      setRepos(current => (current.includes(path) ? current : [...current, path]));
      setSelectedRepo(path);
    } catch (repoError) {
      window.alert(`Invalid git repository or path not found: ${repoError}`);
    }
  }, [runGit]);

  const removeRepo = useCallback((path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setRepos(current => current.filter(repo => repo !== path));
    setSelectedRepo(current => (current === path ? null : current));
    setSelectedDiffPath(null);
    setDiffView(null);
  }, []);

  const handleStageAll = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['add', '-A']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handleCommit = useCallback(async () => {
    if (!selectedRepo || !commitMsg.trim()) return;
    await runRepoAction(async () => {
      await runGit(selectedRepo, ['commit', '-m', commitMsg.trim()]);
      setCommitMsg('');
    });
  }, [commitMsg, runGit, runRepoAction, selectedRepo]);

  const handlePush = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['push']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const handlePull = useCallback(async () => {
    if (!selectedRepo) return;
    await runRepoAction(() => runGit(selectedRepo, ['pull']).then(() => undefined));
  }, [runGit, runRepoAction, selectedRepo]);

  const summary = repoState ? summarizeGitFiles(repoState.status) : null;
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

  const selectedFile = repoState?.status.find(file => file.file === selectedDiffPath) ?? null;

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0, background: `radial-gradient(circle at top right, ${alpha(palette.accent, 0.16)} 0%, transparent 34%), ${palette.bg}`, color: palette.text, overflow: 'hidden' }}>
      <div style={{ width: 280, minWidth: 280, display: 'flex', flexDirection: 'column', background: `linear-gradient(180deg, ${alpha(palette.panel, 0.96)} 0%, ${alpha(palette.sidebar, 0.98)} 100%)`, borderRight: `1px solid ${palette.border}` }}>
        <div style={{ padding: 18, borderBottom: `1px solid ${palette.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: palette.muted }}>Source Control</div>
              <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>Repositories</div>
            </div>
            <button onClick={addRepo} title="Add repository" style={iconButtonStyle(palette, palette.accent)}>
              <Plus size={15} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {repos.length === 0 ? (
            <div style={{ padding: 18, borderRadius: 18, border: `1px dashed ${palette.border}`, background: alpha(palette.card, 0.8), color: palette.muted, fontSize: 12, lineHeight: 1.6 }}>
              Add a repository. The Source tab will show live diffs, file change counts, staging state, and a refreshable commit view.
            </div>
          ) : repos.map(repo => {
            const active = repo === selectedRepo;
            const current = repoState?.path === repo && summary ? summary : null;
            return (
              <button key={repo} onClick={() => setSelectedRepo(repo)} style={{ width: '100%', marginBottom: 10, padding: 14, textAlign: 'left', borderRadius: 18, border: `1px solid ${active ? alpha(palette.accent, 0.7) : palette.border}`, background: active ? `linear-gradient(135deg, ${alpha(palette.accent, 0.22)} 0%, ${alpha(palette.card, 0.96)} 100%)` : alpha(palette.card, 0.78), color: palette.text, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 12, background: alpha(active ? palette.accent : palette.panel, active ? 0.16 : 0.8), color: active ? palette.accent : palette.muted, flexShrink: 0 }}>
                      <FolderGit2 size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repo.split(/[/\\]/).pop() || repo}</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: palette.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repo}</div>
                      {current && <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={badgeStyle(alpha(palette.accent, 0.16), palette.accent)}>{current.totalFiles} files</span>
                        <span style={badgeStyle(alpha(palette.green, 0.16), palette.green)}>+{current.additions}</span>
                        <span style={badgeStyle(alpha(palette.red, 0.16), palette.red)}>-{current.deletions}</span>
                      </div>}
                    </div>
                  </div>
                  <button onClick={event => removeRepo(repo, event)} style={{ ...iconButtonStyle(palette, palette.muted), opacity: active ? 1 : 0.25 }}>
                    <X size={12} />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!repoState ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24 }}>
            <div style={{ width: 'min(720px, 100%)', padding: 28, borderRadius: 28, border: `1px solid ${palette.border}`, background: `linear-gradient(135deg, ${alpha(palette.accent, 0.14)} 0%, ${alpha(palette.card, 0.96)} 56%, ${alpha(palette.panel, 0.92)} 100%)` }}>
              <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 18, background: alpha(palette.accent, 0.16), color: palette.accent }}>
                <Sparkles size={22} />
              </div>
              <h2 style={{ margin: '16px 0 10px', fontSize: 28, lineHeight: 1.1 }}>Source workspace ready</h2>
              <p style={{ margin: 0, color: palette.muted, fontSize: 14, lineHeight: 1.7 }}>
                Select a tracked repository or add a new one to inspect diffs, refresh git state, and review line-level changes before committing.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '20px 22px 18px', borderBottom: `1px solid ${palette.border}`, background: `linear-gradient(180deg, ${alpha(palette.panel, 0.96)} 0%, ${alpha(palette.bg, 0.78)} 100%)`, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 24 }}>{repoState.name}</h2>
                    <span style={badgeStyle(alpha(palette.accent, 0.14), palette.accent)}>
                      <GitBranch size={12} />
                      {repoState.branch}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: palette.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repoState.path}</div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', color: palette.muted, fontSize: 12, flexWrap: 'wrap' }}>
                    <GitCommit size={14} />
                    <span>{repoState.lastCommit}</span>
                    <span>•</span>
                    <Clock3 size={14} />
                    <span>Updated {formatLoadedAt(repoState.loadedAt)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => void refreshRepo()} disabled={loading} style={actionButtonStyle(palette)}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                  <button onClick={() => void handlePull()} disabled={loading} style={actionButtonStyle(palette)}>
                    <Download size={14} />
                    Pull
                  </button>
                  <button onClick={() => void handlePush()} disabled={loading} style={actionButtonStyle(palette)}>
                    <Upload size={14} />
                    Push
                  </button>
                </div>
              </div>
              {summary && (
                <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <SummaryCard title="Files" value={summary.totalFiles} tone={palette.accent} description={`${summary.stagedFiles} staged • ${summary.unstagedFiles} working tree`} palette={palette} />
                  <SummaryCard title="Added" value={`+${summary.additions}`} tone={palette.green} description="New and inserted lines" palette={palette} />
                  <SummaryCard title="Removed" value={`-${summary.deletions}`} tone={palette.red} description="Deleted lines in current diff" palette={palette} />
                  <SummaryCard title="Untracked" value={summary.untrackedFiles} tone={palette.yellow} description="Files not added yet" palette={palette} />
                </div>
              )}
            </div>

            {error && (
              <div style={{ margin: '16px 22px 0', padding: '10px 14px', borderRadius: 14, border: `1px solid ${alpha(palette.red, 0.5)}`, background: alpha(palette.red, 0.12), color: palette.red, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} />
                  <span>{error}</span>
                </div>
                <button onClick={() => setError(null)} style={iconButtonStyle(palette, palette.red)}>
                  <X size={12} />
                </button>
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18, padding: 22 }}>
              <div style={{ width: 380, minWidth: 320, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
                <div style={{ borderRadius: 22, border: `1px solid ${palette.border}`, background: `linear-gradient(180deg, ${alpha(palette.card, 0.96)} 0%, ${alpha(palette.panel, 0.9)} 100%)`, overflow: 'hidden' }}>
                  <div style={{ padding: 18, borderBottom: `1px solid ${palette.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Commit Draft</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: palette.muted }}>Ctrl+Enter commits the current staged snapshot.</div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <textarea
                      placeholder="Describe the change set."
                      value={commitMsg}
                      onChange={event => setCommitMsg(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                          void handleCommit();
                        }
                      }}
                      style={{ width: '100%', height: 110, resize: 'none', borderRadius: 16, border: `1px solid ${palette.border}`, background: alpha(palette.bg, 0.6), color: palette.text, padding: 14, fontSize: 13, lineHeight: 1.5, outline: 'none' }}
                    />
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <button onClick={() => void handleStageAll()} disabled={loading || repoState.status.length === 0} style={actionButtonStyle(palette)}>
                        Stage All
                      </button>
                      <button onClick={() => void handleCommit()} disabled={loading || !commitMsg.trim() || repoState.status.length === 0} style={{ ...actionButtonStyle(palette), background: `linear-gradient(135deg, ${palette.accent} 0%, ${alpha(palette.accent, 0.82)} 100%)`, color: '#fff', borderColor: 'transparent' }}>
                        Commit
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 22, border: `1px solid ${palette.border}`, background: alpha(palette.card, 0.95), overflow: 'hidden' }}>
                  <div style={{ padding: 16, borderBottom: `1px solid ${palette.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Change Deck</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: palette.muted }}>{FILTERS[changeFilter]} • {filteredFiles.length} visible</div>
                      </div>
                      <span style={badgeStyle(alpha(palette.accent, 0.12), palette.accent)}>
                        <FileCode2 size={12} />
                        {repoState.status.length} total
                      </span>
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, border: `1px solid ${palette.border}`, background: alpha(palette.bg, 0.55) }}>
                      <Search size={14} style={{ color: palette.muted }} />
                      <input value={changeQuery} onChange={event => setChangeQuery(event.target.value)} placeholder="Search files" style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: palette.text, fontSize: 12 }} />
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(Object.keys(FILTERS) as ChangeFilter[]).map(filter => (
                        <button key={filter} onClick={() => setChangeFilter(filter)} style={{ ...badgeStyle(filter === changeFilter ? alpha(palette.accent, 0.18) : alpha(palette.panel, 0.84), filter === changeFilter ? palette.accent : palette.muted), border: `1px solid ${filter === changeFilter ? alpha(palette.accent, 0.6) : palette.border}`, cursor: 'pointer' }}>
                          {FILTERS[filter]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
                    {filteredFiles.length === 0 ? (
                      <div style={{ padding: 16, borderRadius: 18, border: `1px dashed ${palette.border}`, color: palette.muted, fontSize: 12, lineHeight: 1.6 }}>
                        {repoState.status.length === 0 ? 'No changes in the working directory.' : 'No files match the current search and filter.'}
                      </div>
                    ) : filteredFiles.map(file => {
                      const selected = file.file === selectedDiffPath;
                      const total = Math.max(file.additions + file.deletions, 1);
                      return (
                        <button key={`${file.statusText}-${file.file}`} onClick={() => setSelectedDiffPath(file.file)} style={{ width: '100%', marginBottom: 10, padding: 14, textAlign: 'left', borderRadius: 18, border: `1px solid ${selected ? alpha(palette.accent, 0.7) : palette.border}`, background: selected ? `linear-gradient(135deg, ${alpha(palette.accent, 0.18)} 0%, ${alpha(palette.card, 0.95)} 100%)` : alpha(palette.panel, 0.74), color: palette.text, cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span style={badgeStyle(alpha(statusTone(file, palette).color, 0.14), statusTone(file, palette).color)}>{statusTone(file, palette).label}</span>
                                {file.isStaged && <span style={badgeStyle(alpha(palette.green, 0.14), palette.green)}>staged</span>}
                                {file.hasUnstagedChanges && <span style={badgeStyle(alpha(palette.yellow, 0.16), palette.yellow)}>working tree</span>}
                              </div>
                              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: '"Cascadia Code", Consolas, monospace' }}>{file.file}</div>
                              {file.originalFile && <div style={{ marginTop: 4, fontSize: 11, color: palette.muted }}>from {file.originalFile}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: palette.green }}>+{file.additions}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: palette.red }}>-{file.deletions}</span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: `${(file.additions / total) * 100}% ${(file.deletions / total) * 100}%`, gap: 4, height: 6, marginTop: 12 }}>
                            <div style={{ borderRadius: 999, background: alpha(palette.green, 0.88) }} />
                            <div style={{ borderRadius: 999, background: alpha(palette.red, 0.82) }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 26, border: `1px solid ${palette.border}`, background: `linear-gradient(180deg, ${alpha(palette.card, 0.98)} 0%, ${alpha(palette.bg, 0.86)} 100%)`, overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: `1px solid ${palette.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, background: alpha(palette.panel, 0.78), flexShrink: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: palette.muted }}>Diff Preview</div>
                    <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile?.file || 'Pick a file to inspect'}</div>
                    {selectedFile && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={badgeStyle(alpha(statusTone(selectedFile, palette).color, 0.14), statusTone(selectedFile, palette).color)}>{statusTone(selectedFile, palette).label}</span>
                        <span style={badgeStyle(alpha(palette.green, 0.14), palette.green)}>+{selectedFile.additions}</span>
                        <span style={badgeStyle(alpha(palette.red, 0.14), palette.red)}>-{selectedFile.deletions}</span>
                      </div>
                    )}
                  </div>
                  {selectedFile && (
                    <button onClick={() => setSelectedDiffPath(null)} style={iconButtonStyle(palette, palette.muted)}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  {!selectedFile ? (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 24 }}>
                      <div style={{ maxWidth: 560, textAlign: 'center' }}>
                        <div style={{ width: 64, height: 64, margin: '0 auto', display: 'grid', placeItems: 'center', borderRadius: 20, background: alpha(palette.accent, 0.14), color: palette.accent }}>
                          <Sparkles size={26} />
                        </div>
                        <h3 style={{ margin: '18px 0 10px', fontSize: 24 }}>Inspect changes inline</h3>
                        <p style={{ margin: 0, color: palette.muted, fontSize: 14, lineHeight: 1.7 }}>
                          Select a file from the change deck to see the diff. The list already surfaces green additions and red deletions so hot files stand out before you open them.
                        </p>
                      </div>
                    </div>
                  ) : diffLoading ? (
                    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RefreshCw size={16} className="animate-spin" />
                        Loading diff preview...
                      </div>
                    </div>
                  ) : (
                    <DiffEditor
                      original={diffView?.original ?? ''}
                      modified={diffView?.modified ?? ''}
                      language={diffView?.language}
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        renderSideBySide: false,
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone,
  description,
  palette,
}: {
  title: string;
  value: React.ReactNode;
  tone: string;
  description: string;
  palette: { border: string; card: string; muted: string };
}) {
  return (
    <div style={{ padding: 16, borderRadius: 18, border: `1px solid ${palette.border}`, background: `linear-gradient(180deg, ${alpha(palette.card, 0.96)} 0%, ${alpha(tone, 0.08)} 100%)` }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: palette.muted }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: tone }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: palette.muted, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MONACO_BY_EXT[ext] || 'plaintext';
}

function joinRepoPath(repoPath: string, filePath: string): string {
  return `${repoPath.replace(/[\\/]+$/, '')}/${filePath.replace(/\\/g, '/')}`;
}

function formatLoadedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function actionButtonStyle(palette: { border: string; panel: string; text: string }): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 38,
    padding: '0 14px',
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    background: alpha(palette.panel, 0.9),
    color: palette.text,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  };
}

function iconButtonStyle(palette: { border: string; panel: string }, color: string): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 10,
    border: `1px solid ${palette.border}`,
    background: alpha(palette.panel, 0.74),
    color,
    cursor: 'pointer',
    flexShrink: 0,
  };
}

function badgeStyle(background: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 24,
    padding: '0 9px',
    borderRadius: 999,
    background,
    color,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
}

function statusTone(file: GitFileStatus, palette: { accent: string; green: string; red: string; yellow: string }) {
  if (file.kind === 'added') return { label: 'Added', color: palette.green };
  if (file.kind === 'deleted') return { label: 'Deleted', color: palette.red };
  if (file.kind === 'renamed') return { label: 'Renamed', color: palette.accent };
  if (file.kind === 'copied') return { label: 'Copied', color: palette.accent };
  if (file.kind === 'untracked') return { label: 'Untracked', color: palette.yellow };
  if (file.kind === 'conflicted') return { label: 'Conflict', color: palette.red };
  return { label: 'Modified', color: palette.yellow };
}

function alpha(color: string, opacity: number): string {
  if (color.startsWith('rgba(')) return color.replace(/rgba\((.+),\s*[\d.]+\)/, `rgba($1, ${opacity})`);
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  if (color.startsWith('#')) {
    const normalized = color.length === 4 ? color.slice(1).split('').map(char => `${char}${char}`).join('') : color.slice(1);
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  }
  return color;
}
