import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, GitCommit, Search } from '@/components/AppIcons';
import { multiplyColorAlpha } from '../config/appearance';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  type GitHistoryCommitFile,
  type GitHistoryCommitSummary,
  type GitHistoryScope,
  type GitSafeCommandRunner,
  loadGitHistoryCommitFiles,
  loadGitHistoryCommitPatch,
  loadGitHistoryCommits,
} from '../runtime/gitPanelBackend';

interface GitHistoryPanelProps {
  palette: {
    bg: string;
    panel: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    green: string;
    red: string;
    yellow: string;
  };
  monoFont: string;
  repoPath: string;
  branchName: string;
  safeGit: GitSafeCommandRunner;
}

interface GitHistoryCommitGroup {
  label: string;
  commits: GitHistoryCommitSummary[];
}

const HISTORY_SCOPE_LABELS: Record<GitHistoryScope, string> = {
  'current-branch': 'Current Branch',
  'all-branches': 'All Branches',
};

const AVATAR_COLORS = [
  '#5fb3ff',
  '#ef8f6b',
  '#8ace74',
  '#d39bf3',
  '#f4c46a',
  '#64d3d0',
  '#7b8cff',
  '#ff9ab2',
];

export function GitHistoryPanel({
  palette,
  monoFont,
  repoPath,
  branchName,
  safeGit,
}: GitHistoryPanelProps) {
  const [historyListWidth, setHistoryListWidth] = usePersistentPanelSize(
    'overlayterm-source-history-list-width',
    400,
    300,
    620,
  );
  const [historyScope, setHistoryScope] = useState<GitHistoryScope>('current-branch');
  const [historyQuery, setHistoryQuery] = useState('');
  const deferredHistoryQuery = useDeferredValue(historyQuery);
  const [historyCommits, setHistoryCommits] = useState<GitHistoryCommitSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<GitHistoryCommitFile[]>([]);
  const [selectedCommitFilesLoading, setSelectedCommitFilesLoading] = useState(false);
  const [selectedCommitFilesError, setSelectedCommitFilesError] = useState<string | null>(null);
  const [selectedCommitFileKey, setSelectedCommitFileKey] = useState<string | null>(null);
  const [selectedCommitPatch, setSelectedCommitPatch] = useState('');
  const [selectedCommitPatchLoading, setSelectedCommitPatchLoading] = useState(false);
  const [selectedCommitPatchError, setSelectedCommitPatchError] = useState<string | null>(null);
  const commitFilesCacheRef = useRef(new Map<string, GitHistoryCommitFile[]>());
  const commitPatchCacheRef = useRef(new Map<string, string>());
  const historyLoadRequestIdRef = useRef(0);
  const commitFilesLoadRequestIdRef = useRef(0);
  const commitPatchLoadRequestIdRef = useRef(0);

  const filteredCommits = useMemo(() => {
    const query = deferredHistoryQuery.trim().toLowerCase();
    if (!query) {
      return historyCommits;
    }

    return historyCommits.filter(commit => (
      commit.summary.toLowerCase().includes(query)
      || commit.authorName.toLowerCase().includes(query)
      || commit.shortHash.toLowerCase().includes(query)
      || commit.body.toLowerCase().includes(query)
    ));
  }, [deferredHistoryQuery, historyCommits]);

  const groupedCommits = useMemo(
    () => groupGitHistoryCommitsByDay(filteredCommits),
    [filteredCommits],
  );

  const selectedCommit = useMemo(
    () => historyCommits.find(commit => commit.hash === selectedCommitHash) ?? null,
    [historyCommits, selectedCommitHash],
  );

  const selectedCommitFile = useMemo(
    () => selectedCommitFiles.find(file => buildCommitFileSelectionKey(file) === selectedCommitFileKey) ?? null,
    [selectedCommitFileKey, selectedCommitFiles],
  );

  useEffect(() => {
    setSelectedCommitHash(null);
    setSelectedCommitFiles([]);
    setSelectedCommitFileKey(null);
    setSelectedCommitPatch('');
    setSelectedCommitFilesError(null);
    setSelectedCommitPatchError(null);
    commitFilesCacheRef.current.clear();
    commitPatchCacheRef.current.clear();
  }, [repoPath]);

  useEffect(() => {
    let cancelled = false;
    const requestId = historyLoadRequestIdRef.current + 1;
    historyLoadRequestIdRef.current = requestId;

    setHistoryLoading(true);
    setHistoryError(null);

    void loadGitHistoryCommits(repoPath, safeGit, {
      branchName,
      scope: historyScope,
      limit: 200,
    })
      .then(commits => {
        if (cancelled || requestId !== historyLoadRequestIdRef.current) {
          return;
        }

        setHistoryCommits(commits);
        setSelectedCommitHash(current => (
          current && commits.some(commit => commit.hash === current)
            ? current
            : commits[0]?.hash ?? null
        ));
      })
      .catch(error => {
        if (cancelled || requestId !== historyLoadRequestIdRef.current) {
          return;
        }

        setHistoryCommits([]);
        setSelectedCommitHash(null);
        setHistoryError(String(error));
      })
      .finally(() => {
        if (!cancelled && requestId === historyLoadRequestIdRef.current) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branchName, historyScope, repoPath, safeGit]);

  useEffect(() => {
    if (!selectedCommitHash) {
      setSelectedCommitFiles([]);
      setSelectedCommitFilesError(null);
      setSelectedCommitFileKey(null);
      return;
    }

    const cachedFiles = commitFilesCacheRef.current.get(selectedCommitHash);
    if (cachedFiles) {
      setSelectedCommitFiles(cachedFiles);
      setSelectedCommitFilesLoading(false);
      setSelectedCommitFilesError(null);
      setSelectedCommitFileKey(current => (
        current && cachedFiles.some(file => buildCommitFileSelectionKey(file) === current)
          ? current
          : cachedFiles[0]
            ? buildCommitFileSelectionKey(cachedFiles[0])
            : null
      ));
      return;
    }

    let cancelled = false;
    const requestId = commitFilesLoadRequestIdRef.current + 1;
    commitFilesLoadRequestIdRef.current = requestId;

    setSelectedCommitFilesLoading(true);
    setSelectedCommitFilesError(null);
    setSelectedCommitFiles([]);
    setSelectedCommitFileKey(null);

    void loadGitHistoryCommitFiles(repoPath, safeGit, selectedCommitHash)
      .then(files => {
        if (cancelled || requestId !== commitFilesLoadRequestIdRef.current) {
          return;
        }

        commitFilesCacheRef.current.set(selectedCommitHash, files);
        setSelectedCommitFiles(files);
        setSelectedCommitFileKey(files[0] ? buildCommitFileSelectionKey(files[0]) : null);
      })
      .catch(error => {
        if (cancelled || requestId !== commitFilesLoadRequestIdRef.current) {
          return;
        }

        setSelectedCommitFiles([]);
        setSelectedCommitFilesError(String(error));
      })
      .finally(() => {
        if (!cancelled && requestId === commitFilesLoadRequestIdRef.current) {
          setSelectedCommitFilesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repoPath, safeGit, selectedCommitHash]);

  useEffect(() => {
    if (!selectedCommit || !selectedCommitFile) {
      setSelectedCommitPatch('');
      setSelectedCommitPatchError(null);
      return;
    }

    const patchCacheKey = `${selectedCommit.hash}::${buildCommitFileSelectionKey(selectedCommitFile)}`;
    const cachedPatch = commitPatchCacheRef.current.get(patchCacheKey);
    if (cachedPatch) {
      setSelectedCommitPatch(cachedPatch);
      setSelectedCommitPatchError(null);
      setSelectedCommitPatchLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = commitPatchLoadRequestIdRef.current + 1;
    commitPatchLoadRequestIdRef.current = requestId;

    setSelectedCommitPatchLoading(true);
    setSelectedCommitPatchError(null);
    setSelectedCommitPatch('');

    void loadGitHistoryCommitPatch(repoPath, safeGit, selectedCommit.hash, selectedCommitFile)
      .then(patch => {
        if (cancelled || requestId !== commitPatchLoadRequestIdRef.current) {
          return;
        }

        commitPatchCacheRef.current.set(patchCacheKey, patch);
        setSelectedCommitPatch(patch);
      })
      .catch(error => {
        if (cancelled || requestId !== commitPatchLoadRequestIdRef.current) {
          return;
        }

        setSelectedCommitPatch('');
        setSelectedCommitPatchError(String(error));
      })
      .finally(() => {
        if (!cancelled && requestId === commitPatchLoadRequestIdRef.current) {
          setSelectedCommitPatchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repoPath, safeGit, selectedCommit, selectedCommitFile]);

  const handleCommitSelection = useCallback((commitHash: string) => {
    setSelectedCommitHash(commitHash);
    setSelectedCommitPatch('');
    setSelectedCommitPatchError(null);
  }, []);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
      <ResizablePane
        size={historyListWidth}
        minSize={300}
        maxSize={620}
        onSizeChange={setHistoryListWidth}
        borderColor={alpha(palette.accent, 0.28)}
        style={{
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${palette.border}`,
          background: palette.card,
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderBottom: `1px solid ${palette.border}`,
            background: alpha(palette.panel, 0.82),
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              padding: '5px 9px',
              borderRadius: 8,
              border: `1px solid ${palette.border}`,
              background: alpha(palette.bg, 0.52),
            }}
          >
            <Search size={12} style={{ color: palette.muted }} />
            <input
              aria-label="Search commit history"
              value={historyQuery}
              onChange={event => setHistoryQuery(event.target.value)}
              placeholder="Search commit history"
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: palette.text,
                fontSize: 10.5,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(HISTORY_SCOPE_LABELS) as GitHistoryScope[]).map(scope => (
              <button
                key={scope}
                type="button"
                onClick={() => setHistoryScope(scope)}
                style={{
                  ...pillButtonStyle(
                    scope === historyScope ? alpha(palette.accent, 0.16) : alpha(palette.panel, 0.86),
                    scope === historyScope ? palette.accent : palette.muted,
                  ),
                  border: `1px solid ${scope === historyScope ? alpha(palette.accent, 0.5) : palette.border}`,
                }}
              >
                {HISTORY_SCOPE_LABELS[scope]}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: palette.muted }}>
              {historyLoading ? 'Loading…' : `${filteredCommits.length} commit${filteredCommits.length === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
          {historyError ? (
            <div style={{ padding: 14, fontSize: 11, color: palette.red }}>{historyError}</div>
          ) : historyLoading && historyCommits.length === 0 ? (
            <div style={emptyStateStyle(palette)}>
              <Clock size={18} />
              <span>Loading history…</span>
            </div>
          ) : groupedCommits.length === 0 ? (
            <div style={emptyStateStyle(palette)}>
              <Clock size={18} />
              <span>{historyQuery.trim() ? 'No commits match the current search.' : 'No commits found for this scope.'}</span>
            </div>
          ) : (
            groupedCommits.map(group => (
              <div key={group.label}>
                <div
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    padding: '7px 12px',
                    borderBottom: `1px solid ${palette.border}`,
                    background: alpha(palette.panel, 0.92),
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: palette.muted,
                    fontWeight: 700,
                  }}
                >
                  {group.label}
                  <span style={{ marginLeft: 6, opacity: 0.75 }}>
                    ({group.commits.length})
                  </span>
                </div>
                {group.commits.map((commit, index) => {
                  const isSelected = selectedCommitHash === commit.hash;
                  const isLast = index === group.commits.length - 1;
                  const avatarColor = getAvatarColor(commit.authorName);

                  return (
                    <button
                      key={commit.hash}
                      type="button"
                      onClick={() => handleCommitSelection(commit.hash)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'stretch',
                        gap: 0,
                        padding: 0,
                        border: 'none',
                        borderBottom: `1px solid ${alpha(palette.border, 0.72)}`,
                        background: isSelected ? alpha(palette.accent, 0.12) : 'transparent',
                        color: palette.text,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ width: 2, height: 12, background: index === 0 ? 'transparent' : alpha(palette.border, 0.9) }} />
                        <div
                          style={{
                            width: isSelected ? 10 : 8,
                            height: isSelected ? 10 : 8,
                            borderRadius: 999,
                            background: isSelected ? palette.accent : alpha(palette.muted, 0.9),
                            boxShadow: isSelected ? `0 0 0 3px ${alpha(palette.accent, 0.16)}` : 'none',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ width: 2, flex: 1, background: isLast ? 'transparent' : alpha(palette.border, 0.9) }} />
                      </div>
                      <div style={{ width: 26, paddingTop: 10, flexShrink: 0 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            display: 'grid',
                            placeItems: 'center',
                            background: avatarColor,
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 800,
                          }}
                        >
                          {getInitials(commit.authorName)}
                        </div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1, padding: '8px 12px 9px 8px' }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: 1.35,
                            color: palette.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {commit.summary}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            fontSize: 10,
                            color: palette.muted,
                          }}
                        >
                          <span style={{ color: avatarColor, fontWeight: 700 }}>{commit.authorName}</span>
                          <span>{formatRelativeCommitTime(commit.timestampSeconds)}</span>
                          <span
                            style={{
                              borderRadius: 999,
                              padding: '1px 6px',
                              background: alpha(palette.panel, 0.9),
                              color: palette.muted,
                              fontFamily: monoFont,
                              fontSize: 9.5,
                              fontWeight: 700,
                            }}
                          >
                            {commit.shortHash}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </OverlayScrollArea>
      </ResizablePane>

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: palette.bg }}>
        {selectedCommit ? (
          <>
            <div
              style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${palette.border}`,
                background: palette.panel,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  background: getAvatarColor(selectedCommit.authorName),
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                {getInitials(selectedCommit.authorName)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.text }}>
                  {selectedCommit.summary}
                </div>
                {selectedCommit.body ? (
                  <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.45, color: palette.muted, whiteSpace: 'pre-wrap' }}>
                    {selectedCommit.body}
                  </div>
                ) : null}
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={pillStyle(alpha(palette.accent, 0.12), palette.accent)}>
                    <GitCommit size={11} />
                    {selectedCommit.shortHash}
                  </span>
                  <span style={pillStyle(alpha(palette.panel, 0.92), palette.muted)}>
                    {selectedCommit.authorName}
                  </span>
                  <span style={pillStyle(alpha(palette.panel, 0.92), palette.muted)}>
                    {formatAbsoluteCommitTime(selectedCommit.timestampSeconds)}
                  </span>
                  <span style={pillStyle(alpha(palette.panel, 0.92), palette.muted)}>
                    {selectedCommitFiles.length} file{selectedCommitFiles.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div
                style={{
                  borderBottom: `1px solid ${palette.border}`,
                  background: alpha(palette.panel, 0.72),
                  minHeight: 84,
                  maxHeight: 188,
                }}
              >
                <div
                  style={{
                    padding: '8px 12px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: palette.muted,
                  }}
                >
                  Changed Files
                </div>
                <OverlayScrollArea style={{ maxHeight: 148 }}>
                  {selectedCommitFilesError ? (
                    <div style={{ padding: '0 12px 10px', fontSize: 11, color: palette.red }}>
                      {selectedCommitFilesError}
                    </div>
                  ) : selectedCommitFilesLoading ? (
                    <div style={{ padding: '0 12px 10px', fontSize: 11, color: palette.muted }}>
                      Loading changed files…
                    </div>
                  ) : selectedCommitFiles.length === 0 ? (
                    <div style={{ padding: '0 12px 10px', fontSize: 11, color: palette.muted }}>
                      No changed files were reported for this commit.
                    </div>
                  ) : (
                    selectedCommitFiles.map(file => {
                      const isSelected = selectedCommitFileKey === buildCommitFileSelectionKey(file);
                      return (
                        <button
                          key={buildCommitFileSelectionKey(file)}
                          type="button"
                          onClick={() => setSelectedCommitFileKey(buildCommitFileSelectionKey(file))}
                          style={{
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: '88px minmax(0, 1fr)',
                            gap: 8,
                            alignItems: 'center',
                            padding: '7px 12px',
                            border: 'none',
                            borderTop: `1px solid ${alpha(palette.border, 0.68)}`,
                            background: isSelected ? alpha(palette.accent, 0.12) : 'transparent',
                            color: palette.text,
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              ...pillStyle(alpha(historyFileChangeColor(file, palette), 0.14), historyFileChangeColor(file, palette)),
                              justifyContent: 'center',
                            }}
                          >
                            {historyFileChangeLabel(file)}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span
                              style={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: 10.5,
                                fontWeight: 700,
                                color: palette.text,
                                fontFamily: monoFont,
                              }}
                            >
                              {file.path}
                            </span>
                            {file.previousPath ? (
                              <span
                                style={{
                                  display: 'block',
                                  marginTop: 2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: 9.5,
                                  color: palette.muted,
                                  fontFamily: monoFont,
                                }}
                              >
                                {file.previousPath}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })
                  )}
                </OverlayScrollArea>
              </div>

              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${palette.border}`,
                    background: alpha(palette.panel, 0.86),
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    fontSize: 11,
                    color: palette.muted,
                  }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: palette.text }}>
                    {selectedCommitFile ? selectedCommitFile.path : 'Select a changed file to inspect the commit diff.'}
                  </span>
                  {selectedCommitFile ? (
                    <span style={pillStyle(alpha(historyFileChangeColor(selectedCommitFile, palette), 0.14), historyFileChangeColor(selectedCommitFile, palette))}>
                      {historyFileChangeLabel(selectedCommitFile)}
                    </span>
                  ) : null}
                </div>

                <OverlayScrollArea style={{ flex: 1, minHeight: 0 }}>
                  {selectedCommitPatchError ? (
                    <div style={{ padding: 14, fontSize: 11, color: palette.red }}>
                      {selectedCommitPatchError}
                    </div>
                  ) : selectedCommitPatchLoading ? (
                    <div style={emptyStateStyle(palette)}>
                      <Clock size={18} />
                      <span>Loading diff…</span>
                    </div>
                  ) : selectedCommitPatch ? (
                    <div style={{ padding: 12, fontFamily: monoFont, fontSize: 11.5, lineHeight: 1.55 }}>
                      {selectedCommitPatch.split(/\r?\n/).map((line, index) => (
                        <div key={`${index}-${line}`} style={historyDiffLineStyle(line, palette)}>
                          {line || ' '}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={emptyStateStyle(palette)}>
                      <Clock size={18} />
                      <span>Select a commit file to preview its patch.</span>
                    </div>
                  )}
                </OverlayScrollArea>
              </div>
            </div>
          </>
        ) : (
          <div style={emptyStateStyle(palette)}>
            <Clock size={18} />
            <span>Select a commit to inspect its history.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function groupGitHistoryCommitsByDay(commits: GitHistoryCommitSummary[]): GitHistoryCommitGroup[] {
  const groups = new Map<string, GitHistoryCommitSummary[]>();

  for (const commit of commits) {
    const label = getCommitDayLabel(commit.timestampSeconds);
    const group = groups.get(label);
    if (group) {
      group.push(commit);
      continue;
    }
    groups.set(label, [commit]);
  }

  return Array.from(groups.entries()).map(([label, groupedCommits]) => ({
    label,
    commits: groupedCommits,
  }));
}

function getCommitDayLabel(timestampSeconds: number): string {
  const commitDate = new Date(timestampSeconds * 1000);
  const commitDay = new Date(commitDate.getFullYear(), commitDate.getMonth(), commitDate.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - commitDay.getTime()) / 86_400_000);

  if (diffDays <= 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} Days Ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: today.getFullYear() === commitDay.getFullYear() ? undefined : 'numeric',
  }).format(commitDate);
}

function formatRelativeCommitTime(timestampSeconds: number): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const diffSeconds = Math.max(0, nowSeconds - timestampSeconds);

  if (diffSeconds < 60) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestampSeconds * 1000));
}

function formatAbsoluteCommitTime(timestampSeconds: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestampSeconds * 1000));
}

function getAvatarColor(authorName: string): string {
  let hash = 0;
  for (let index = 0; index < authorName.length; index += 1) {
    hash = ((hash << 5) - hash + authorName.charCodeAt(index)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function getInitials(authorName: string): string {
  const words = authorName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }

  return words
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');
}

function buildCommitFileSelectionKey(file: GitHistoryCommitFile): string {
  return `${file.previousPath ?? ''}=>${file.path}`;
}

function historyFileChangeLabel(file: GitHistoryCommitFile): string {
  if (file.changeType === 'added') return 'Added';
  if (file.changeType === 'deleted') return 'Deleted';
  if (file.changeType === 'renamed') return 'Renamed';
  if (file.changeType === 'copied') return 'Copied';
  if (file.changeType === 'type-changed') return 'Type';
  if (file.changeType === 'conflicted') return 'Conflict';
  if (file.changeType === 'modified') return 'Modified';
  return file.statusCode || 'Changed';
}

function historyFileChangeColor(
  file: GitHistoryCommitFile,
  palette: Pick<GitHistoryPanelProps['palette'], 'accent' | 'green' | 'red' | 'yellow'>,
): string {
  if (file.changeType === 'added') return palette.green;
  if (file.changeType === 'deleted' || file.changeType === 'conflicted') return palette.red;
  if (file.changeType === 'renamed' || file.changeType === 'copied') return palette.accent;
  return palette.yellow;
}

function historyDiffLineStyle(
  line: string,
  palette: GitHistoryPanelProps['palette'],
): React.CSSProperties {
  if (line.startsWith('@@')) {
    return {
      padding: '0 6px',
      background: alpha(palette.accent, 0.12),
      color: palette.accent,
    };
  }
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return {
      padding: '0 6px',
      background: alpha(palette.green, 0.1),
      color: palette.green,
    };
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return {
      padding: '0 6px',
      background: alpha(palette.red, 0.1),
      color: palette.red,
    };
  }
  if (
    line.startsWith('diff --git')
    || line.startsWith('index ')
    || line.startsWith('--- ')
    || line.startsWith('+++ ')
  ) {
    return {
      padding: '0 6px',
      color: palette.muted,
    };
  }

  return {
    padding: '0 6px',
    color: palette.text,
  };
}

function pillStyle(background: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    minHeight: 17,
    padding: '0 6px',
    borderRadius: 999,
    background,
    color,
    fontSize: 9.5,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  };
}

function pillButtonStyle(background: string, color: string): React.CSSProperties {
  return {
    ...pillStyle(background, color),
    cursor: 'pointer',
  };
}

function emptyStateStyle(
  palette: Pick<GitHistoryPanelProps['palette'], 'muted'>,
): React.CSSProperties {
  return {
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    gap: 8,
    color: palette.muted,
    fontSize: 11,
  };
}

function alpha(color: string, opacity: number): string {
  return multiplyColorAlpha(color, opacity);
}
