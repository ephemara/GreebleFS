import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DiffEditor } from '@monaco-editor/react';
import { GitBranch, GitCommit, Plus, FolderGit2, X, RefreshCw, Upload, Download, AlertTriangle } from 'lucide-react';
import type { ResolvedOverlayAppearance } from '../config/appearance';

interface RepoState {
  path: string;
  name: string;
  branch: string;
  status: GitFileStatus[];
  lastCommit: string;
}

interface GitFileStatus {
  file: string;
  statusText: string;
  isStaged: boolean;
}

const PALETTE = {
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

export function GitManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent || PALETTE.accent;

  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [repoState, setRepoState] = useState<RepoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commitMsg, setCommitMsg] = useState('');
  const [diffView, setDiffView] = useState<{ file: string; original: string; modified: string } | null>(null);

  // Load repos from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('overlayterm-git-repos');
      if (saved) {
        const parsed = JSON.parse(saved);
        setRepos(parsed);
        if (parsed.length > 0) setSelectedRepo(parsed[0]);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem('overlayterm-git-repos', JSON.stringify(repos));
  }, [repos]);

  const runGit = async (repo: string, args: string[]): Promise<string> => {
    return await invoke<string>('git_exec', { repoPath: repo, args });
  };

  const loadRepoState = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      // Name
      const name = path.split(/[/\\]/).pop() || path;

      // Branch
      let branch = 'unknown';
      try { branch = (await runGit(path, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim(); } catch {}

      // Last commit
      let lastCommit = 'No commits yet';
      try { lastCommit = (await runGit(path, ['log', '-1', '--pretty=format:%h - %s (%cr)'])).trim(); } catch {}

      // Status
      let status: GitFileStatus[] = [];
      try {
        const out = await runGit(path, ['status', '--porcelain']);
        status = out.trim().split('\n').filter(Boolean).map(line => {
          const st = line.slice(0, 2);
          const file = line.slice(3);
          const isStaged = st[0] !== ' ' && st[0] !== '?';
          return { file, statusText: st, isStaged };
        });
      } catch {}

      setRepoState({ path, name, branch, status, lastCommit });
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      loadRepoState(selectedRepo);
      const interval = setInterval(() => loadRepoState(selectedRepo), 600000); // Poll every 10 mins
      return () => clearInterval(interval);
    } else {
      setRepoState(null);
    }
  }, [selectedRepo, loadRepoState]);

  const addRepo = async () => {
    const path = prompt('Enter absolute path to Git repository:');
    if (!path) return;
    
    // Validate it's a git repo
    try {
      await runGit(path, ['status']);
      if (!repos.includes(path)) {
        setRepos([...repos, path]);
        setSelectedRepo(path);
      }
    } catch (e) {
      alert(`Invalid git repository or path not found: ${e}`);
    }
  };

  const removeRepo = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRepos = repos.filter(r => r !== path);
    setRepos(newRepos);
    if (selectedRepo === path) {
      setSelectedRepo(newRepos.length > 0 ? newRepos[0] : null);
    }
    setDiffView(null);
  };

  const handleStageAll = async () => {
    if (!selectedRepo) return;
    try { await runGit(selectedRepo, ['add', '-A']); loadRepoState(selectedRepo); }
    catch (e) { setError(String(e)); }
  };

  const handleCommit = async () => {
    if (!selectedRepo || !commitMsg.trim()) return;
    try {
      await runGit(selectedRepo, ['commit', '-m', commitMsg]);
      setCommitMsg('');
      loadRepoState(selectedRepo);
    } catch (e) { setError(String(e)); }
  };

  const handlePush = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    try { await runGit(selectedRepo, ['push']); loadRepoState(selectedRepo); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const handlePull = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    try { await runGit(selectedRepo, ['pull']); loadRepoState(selectedRepo); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  const openDiff = async (file: string) => {
    if (!selectedRepo) return;
    try {
      // original (from index or HEAD)
      let originalContent = '';
      try { originalContent = await runGit(selectedRepo, ['show', `HEAD:${file}`]); } catch {}
      
      // modified (current file system)
      let modifiedContent = await invoke<string>('fs_read_text_file', { path: `${selectedRepo}/${file}` });

      setDiffView({ file, original: originalContent, modified: modifiedContent });
    } catch (e) {
      setError(`Failed to load diff: ${e}`);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', background: PALETTE.bg, color: PALETTE.text, fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>
      {/* ══ Sidebar ══ */}
      <div style={{ width: 240, background: PALETTE.sidebar, borderRight: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${PALETTE.border}` }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PALETTE.muted }}>Repositories</span>
          <button onClick={addRepo} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer' }}><Plus size={14} /></button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {repos.map(r => (
            <div
              key={r}
              onClick={() => setSelectedRepo(r)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px',
                cursor: 'pointer', background: selectedRepo === r ? `${accent}18` : 'transparent',
                borderLeft: `2px solid ${selectedRepo === r ? accent : 'transparent'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <FolderGit2 size={14} style={{ color: selectedRepo === r ? accent : PALETTE.muted, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.split(/[/\\]/).pop()}</div>
                  <div style={{ fontSize: 10, color: PALETTE.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>{r}</div>
                </div>
              </div>
              <button 
                onClick={(e) => removeRepo(r, e)}
                style={{ background: 'none', border: 'none', color: PALETTE.muted, cursor: 'pointer', opacity: selectedRepo === r ? 1 : 0 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {repos.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: PALETTE.muted, fontSize: 12 }}>
              Add a repository to get started.
            </div>
          )}
        </div>
      </div>

      {/* ══ Main Area ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!repoState ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PALETTE.muted }}>
            Select or add a repository
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', background: PALETTE.panel, borderBottom: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{repoState.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: PALETTE.muted }}>
                    <GitBranch size={12} style={{ color: accent }} />
                    {repoState.branch}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handlePull} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: `1px solid ${PALETTE.border}`, padding: '4px 10px', borderRadius: 4, color: PALETTE.text, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                    <Download size={12} /> Pull
                  </button>
                  <button onClick={handlePush} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: `1px solid ${PALETTE.border}`, padding: '4px 10px', borderRadius: 4, color: PALETTE.text, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                    <Upload size={12} /> Push
                  </button>
                  <button onClick={() => loadRepoState(selectedRepo!)} disabled={loading} style={{ background: 'none', border: 'none', color: PALETTE.muted, cursor: loading ? 'not-allowed' : 'pointer', padding: 4 }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: PALETTE.muted }}>
                <GitCommit size={14} />
                <span>Last commit: <span style={{ color: PALETTE.text }}>{repoState.lastCommit}</span></span>
              </div>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: `${PALETTE.red}22`, borderBottom: `1px solid ${PALETTE.red}`, color: PALETTE.red, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={14} /> {error}</div>
                <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: PALETTE.red, cursor: 'pointer' }}><X size={12} /></button>
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              
              {/* Diff Viewer */}
              {diffView && (
                <div style={{ flex: 1, borderRight: `1px solid ${PALETTE.border}`, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ background: PALETTE.panel, padding: '8px 12px', borderBottom: `1px solid ${PALETTE.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{diffView.file}</span>
                    <button onClick={() => setDiffView(null)} style={{ background: 'none', border: 'none', color: PALETTE.muted, cursor: 'pointer' }}><X size={14}/></button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <DiffEditor
                      original={diffView.original}
                      modified={diffView.modified}
                      theme="vs-dark"
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, renderSideBySide: false }}
                    />
                  </div>
                </div>
              )}

              {/* Status pane */}
              <div style={{ width: diffView ? 300 : '100%', display: 'flex', flexDirection: 'column', background: PALETTE.card, flexShrink: 0 }}>
                
                {/* Commit Box */}
                <div style={{ padding: 16, borderBottom: `1px solid ${PALETTE.border}`, background: PALETTE.panel }}>
                  <div style={{ background: PALETTE.bg, border: `1px solid ${PALETTE.border}`, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <textarea 
                      placeholder="Commit message (Ctrl+Enter to commit)"
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit(); }}
                      style={{ width: '100%', height: 80, background: 'transparent', border: 'none', outline: 'none', color: PALETTE.text, padding: 12, fontSize: 12, resize: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderTop: `1px solid ${PALETTE.border}` }}>
                      <button 
                        onClick={handleCommit}
                        disabled={!commitMsg.trim() || repoState.status.length === 0}
                        style={{ background: accent, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: (!commitMsg.trim() || repoState.status.length === 0) ? 'not-allowed' : 'pointer', opacity: (!commitMsg.trim() || repoState.status.length === 0) ? 0.5 : 1 }}
                      >
                        Commit
                      </button>
                    </div>
                  </div>
                </div>

                {/* Changes List */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PALETTE.muted, textTransform: 'uppercase' }}>Changes ({repoState.status.length})</span>
                    <button onClick={handleStageAll} style={{ background: 'none', border: 'none', color: accent, fontSize: 11, cursor: 'pointer' }}>Stage All -A</button>
                  </div>
                  
                  {repoState.status.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: PALETTE.muted, fontSize: 12 }}>No changes in working directory</div>
                  ) : (
                    <div>
                      {repoState.status.map(f => {
                        const st = f.statusText;
                        let color = PALETTE.text;
                        if (st.includes('M')) color = PALETTE.yellow;
                        if (st.includes('D')) color = PALETTE.red;
                        if (st.includes('A') || st.includes('?')) color = PALETTE.green;

                        return (
                          <div 
                            key={f.file}
                            onClick={() => openDiff(f.file)}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', 
                              cursor: 'pointer', background: diffView?.file === f.file ? 'rgba(255,255,255,0.06)' : 'transparent' 
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = diffView?.file === f.file ? 'rgba(255,255,255,0.06)' : 'transparent'}
                          >
                            <span style={{ fontSize: 11, fontWeight: 700, color, width: 20, textAlign: 'center', flexShrink: 0 }}>{st.trim()}</span>
                            <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{f.file}</span>
                          </div>
                        );
                      })}
                    </div>
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
