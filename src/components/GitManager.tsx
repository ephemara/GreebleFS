import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DiffEditor } from '@monaco-editor/react';
import { Download, FolderGit2, GitBranch, GitCommit, Plus, RefreshCw, Search, Upload, X } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import { OverlayScrollArea } from './OverlayScrollArea';
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
  unstaged: 'Working',
  untracked: 'New',
};

const MONACO_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', rs: 'rust',
  py: 'python', go: 'go', json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml',
  toml: 'toml', css: 'css', html: 'html', xml: 'xml', sh: 'shell', ps1: 'powershell',
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [changeQuery, setChangeQuery] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<DiffViewState | null>(null);
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
      const [branch, lastCommit, statusText, unstagedStats, stagedStats] = await Promise.all([
        safeGit(path, ['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
        safeGit(path, ['log', '-1', '--pretty=format:%h - %s (%cr)'], 'No commits yet'),
        safeGit(path, ['status', '--porcelain'], ''),
        safeGit(path, ['diff', '--numstat', '--no-ext-diff'], ''),
        safeGit(path, ['diff', '--cached', '--numstat', '--no-ext-diff'], ''),
      ]);

      setRepoState({
        path,
        name: path.split(/[/\\]/).pop() || path,
        branch: branch.trim() || 'unknown',
        status: mergeGitStatusWithStats(parseGitStatus(statusText), parseGitNumstat(unstagedStats), parseGitNumstat(stagedStats)),
        lastCommit: lastCommit.trim() || 'No commits yet',
        loadedAt: Date.now(),
      });
    } catch (loadError) {
      setError(String(loadError));
      setRepoState(null);
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
      setError(String(repoError));
    }
  }, [runGit]);

  const removeRepo = useCallback((path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const nextRepos = repos.filter(repo => repo !== path);
    setRepos(nextRepos);
    setSelectedRepo(current => (current === path ? nextRepos[0] ?? null : current));
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

  const selectedFile = repoState?.status.find(file => file.file === selectedFilePath) ?? null;

  const loadDiff = useCallback(async (repoPath: string, file: GitFileStatus) => {
    setDiffLoading(true);
    try {
      const headPath = file.originalFile ?? file.file;
      const [original, modified] = await Promise.all([
        !file.isUntracked && file.kind !== 'added' ? safeGit(repoPath, ['show', `HEAD:${headPath}`], '') : Promise.resolve(''),
        file.kind !== 'deleted' ? invoke<string>('fs_read_text_file', { path: joinRepoPath(repoPath, file.file) }).catch(() => '') : Promise.resolve(''),
      ]);
      setDiffView({ original, modified, language: inferLanguage(file.file) });
    } finally {
      setDiffLoading(false);
    }
  }, [safeGit]);

  useEffect(() => {
    if (!repoState || !selectedFile) return;
    void loadDiff(repoState.path, selectedFile);
  }, [loadDiff, repoState, selectedFile]);

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

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', background: palette.bg, color: palette.text, overflow: 'hidden' }}>
      <div style={{ width: 230, minWidth: 230, display: 'flex', flexDirection: 'column', background: palette.sidebar, borderRight: `1px solid ${palette.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: palette.muted }}>Source Control</div>
            <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700 }}>Repositories</div>
          </div>
          <button onClick={addRepo} style={iconButtonStyle(palette)}><Plus size={13} /></button>
        </div>
        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
          {repos.map(repo => {
            const active = repo === selectedRepo;
            return (
              <button key={repo} onClick={() => setSelectedRepo(repo)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '10px 12px', border: 'none', borderBottom: `1px solid ${palette.border}`, background: active ? alpha(palette.accent, 0.14) : 'transparent', color: palette.text, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                  <FolderGit2 size={14} style={{ color: active ? palette.accent : palette.muted, marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.split(/[/\\]/).pop() || repo}</div>
                    <div style={{ marginTop: 3, fontSize: 10, color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo}</div>
                  </div>
                </div>
                <button onClick={event => removeRepo(repo, event)} style={{ ...iconButtonStyle(palette), opacity: active ? 1 : 0.3 }}><X size={11} /></button>
              </button>
            );
          })}
        </OverlayScrollArea>
      </div>

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!repoState ? (
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 12 }}>Select or add a repository.</div>
        ) : (
          <>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${palette.border}`, background: palette.panel }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{repoState.name}</div>
                    <span style={pillStyle(alpha(palette.accent, 0.14), palette.accent)}><GitBranch size={11} />{repoState.branch}</span>
                    {summary && <span style={pillStyle(alpha(palette.panel, 0.9), palette.muted)}>{summary.totalFiles} changed</span>}
                    {summary && <span style={pillStyle(alpha(palette.green, 0.14), palette.green)}>+{summary.additions}</span>}
                    {summary && <span style={pillStyle(alpha(palette.red, 0.14), palette.red)}>-{summary.deletions}</span>}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: palette.muted }}>
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

            <div style={{ padding: '8px 14px', borderBottom: `1px solid ${palette.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: alpha(palette.panel, 0.72) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 240, flex: '1 1 240px', maxWidth: 420, padding: '6px 10px', borderRadius: 8, border: `1px solid ${palette.border}`, background: alpha(palette.bg, 0.5) }}>
                <Search size={13} style={{ color: palette.muted }} />
                <input value={changeQuery} onChange={event => setChangeQuery(event.target.value)} placeholder="Search changed files" style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: palette.text, fontSize: 11 }} />
              </div>
              {(Object.keys(FILTERS) as ChangeFilter[]).map(filter => (
                <button key={filter} onClick={() => setChangeFilter(filter)} style={{ ...pillStyle(filter === changeFilter ? alpha(palette.accent, 0.16) : alpha(palette.panel, 0.84), filter === changeFilter ? palette.accent : palette.muted), border: `1px solid ${filter === changeFilter ? alpha(palette.accent, 0.5) : palette.border}`, cursor: 'pointer' }}>{FILTERS[filter]}</button>
              ))}
              <div style={{ flex: 1 }} />
              <textarea value={commitMsg} onChange={event => setCommitMsg(event.target.value)} placeholder="Commit message" className="hide-scrollbar" style={{ height: 30, minWidth: 220, maxWidth: 420, flex: '1 1 220px', resize: 'none', borderRadius: 8, border: `1px solid ${palette.border}`, background: alpha(palette.bg, 0.5), color: palette.text, padding: '7px 10px', fontSize: 11, outline: 'none' }} />
              <button onClick={() => void runRepoAction(() => runGit(selectedRepo!, ['add', '-A']).then(() => undefined))} disabled={loading || !repoState.status.length} style={toolbarButtonStyle(palette)}>Stage All</button>
              <button onClick={() => void runRepoAction(async () => { if (commitMsg.trim()) { await runGit(selectedRepo!, ['commit', '-m', commitMsg.trim()]); setCommitMsg(''); } })} disabled={loading || !commitMsg.trim() || !repoState.status.length} style={{ ...toolbarButtonStyle(palette), background: palette.accent, borderColor: palette.accent, color: '#fff' }}>Commit</button>
            </div>

            {error && <div style={{ padding: '7px 14px', borderBottom: `1px solid ${palette.border}`, fontSize: 11, color: palette.red, background: alpha(palette.red, 0.10) }}>{error}</div>}

            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) minmax(0, 1fr)', gap: 0 }}>
              <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${palette.border}`, background: palette.card }}>
                <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 64px 64px', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${palette.border}`, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: palette.muted }}>
                  <span>Status</span><span>File</span><span style={{ textAlign: 'right' }}>+</span><span style={{ textAlign: 'right' }}>-</span>
                </div>
                <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
                  {filteredFiles.length === 0 ? (
                    <div style={{ padding: 14, color: palette.muted, fontSize: 11 }}>{repoState.status.length === 0 ? 'Working tree is clean.' : 'No files match the current filter.'}</div>
                  ) : filteredFiles.map(file => (
                    <button key={`${file.statusText}-${file.file}`} onClick={() => setSelectedFilePath(file.file)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 64px 64px', gap: 8, alignItems: 'center', padding: '8px 14px', border: 'none', borderBottom: `1px solid ${alpha(palette.border, 0.7)}`, background: selectedFilePath === file.file ? alpha(palette.accent, 0.14) : 'transparent', color: palette.text, cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ ...pillStyle(alpha(statusColor(file, palette), 0.14), statusColor(file, palette)), justifyContent: 'center' }}>{statusLabel(file)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: '"Cascadia Code", Consolas, monospace' }}>{file.file}</span>
                        {file.originalFile && <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalFile}</span>}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: palette.green }}>+{file.additions}</span>
                      <span style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color: palette.red }}>-{file.deletions}</span>
                    </button>
                  ))}
                </OverlayScrollArea>
              </div>

              <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: palette.bg }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}`, fontSize: 11, color: palette.muted }}>
                  {selectedFile ? `${selectedFile.file} • ${statusLabel(selectedFile)} • +${selectedFile.additions} / -${selectedFile.deletions}` : 'Select a changed file to inspect the diff.'}
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  {selectedFile ? (
                    diffLoading ? (
                      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: palette.muted, fontSize: 11 }}>Loading diff…</div>
                    ) : (
                      <DiffEditor
                        original={diffView?.original ?? ''}
                        modified={diffView?.modified ?? ''}
                        language={diffView?.language}
                        theme="vs-dark"
                        options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, renderSideBySide: false, scrollBeyondLastLine: false, wordWrap: 'on', scrollbar: { vertical: 'hidden', horizontal: 'hidden', verticalScrollbarSize: 0, horizontalScrollbarSize: 0, alwaysConsumeMouseWheel: false } }}
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

function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MONACO_BY_EXT[ext] || 'plaintext';
}

function joinRepoPath(repoPath: string, filePath: string): string {
  return `${repoPath.replace(/[\\/]+$/, '')}/${filePath.replace(/\\/g, '/')}`;
}

function iconButtonStyle(palette: { border: string; panel: string; muted?: string; text?: string }): React.CSSProperties {
  return { width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 7, border: `1px solid ${palette.border}`, background: alpha(palette.panel, 0.8), color: palette.muted || palette.text || 'inherit', cursor: 'pointer', flexShrink: 0 };
}

function toolbarButtonStyle(palette: { border: string; panel: string; text: string }): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '0 10px', borderRadius: 8, border: `1px solid ${palette.border}`, background: alpha(palette.panel, 0.86), color: palette.text, cursor: 'pointer', fontSize: 11, fontWeight: 700 };
}

function pillStyle(background: string, color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 18, padding: '0 7px', borderRadius: 999, background, color, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' };
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
