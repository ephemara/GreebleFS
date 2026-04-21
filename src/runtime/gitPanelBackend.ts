import {
  mergeGitStatusWithStats,
  parseGitNumstat,
  parseGitStatus,
  type GitFileStatus,
} from '../components/gitManager.utils';

export type GitCommandRunner = (repoPath: string, args: string[]) => Promise<string>;
export type GitSafeCommandRunner = (
  repoPath: string,
  args: string[],
  fallback?: string,
) => Promise<string>;

export type GitHistoryScope = 'current-branch' | 'all-branches';

export interface GitPanelBranchSummary {
  name: string;
  upstreamName: string | null;
  isCurrent: boolean;
}

export interface GitPanelRepositoryState {
  path: string;
  name: string;
  branch: string;
  upstreamName: string | null;
  aheadCount: number;
  behindCount: number;
  branches: GitPanelBranchSummary[];
  status: GitFileStatus[];
  lastCommit: string;
  loadedAt: number;
}

export interface GitHistoryCommitSummary {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  timestampSeconds: number;
  summary: string;
  body: string;
}

export type GitHistoryCommitFileChangeType =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'type-changed'
  | 'conflicted'
  | 'unknown';

export interface GitHistoryCommitFile {
  path: string;
  previousPath: string | null;
  statusCode: string;
  changeType: GitHistoryCommitFileChangeType;
  diffTargets: string[];
}

const GIT_HISTORY_RECORD_SEPARATOR = '\x1e';
const GIT_HISTORY_FIELD_SEPARATOR = '\x1f';
const GIT_HISTORY_LOG_FORMAT = `%H${GIT_HISTORY_FIELD_SEPARATOR}%h${GIT_HISTORY_FIELD_SEPARATOR}%an${GIT_HISTORY_FIELD_SEPARATOR}%ae${GIT_HISTORY_FIELD_SEPARATOR}%at${GIT_HISTORY_FIELD_SEPARATOR}%s${GIT_HISTORY_FIELD_SEPARATOR}%b${GIT_HISTORY_RECORD_SEPARATOR}`;
const GIT_BRANCH_LIST_FORMAT = `%(HEAD)${GIT_HISTORY_FIELD_SEPARATOR}%(refname:short)${GIT_HISTORY_FIELD_SEPARATOR}%(upstream:short)`;

export async function loadGitPanelRepositoryState(
  repoPath: string,
  runGit: GitCommandRunner,
  safeGit: GitSafeCommandRunner,
): Promise<GitPanelRepositoryState> {
  const [
    branchText,
    lastCommitText,
    statusText,
    unstagedStatsText,
    stagedStatsText,
    upstreamNameText,
    aheadBehindText,
    branchListText,
  ] = await Promise.all([
    safeGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
    safeGit(repoPath, ['log', '-1', '--pretty=format:%h - %s (%cr)'], 'No commits yet'),
    runGit(repoPath, ['status', '--porcelain']),
    safeGit(repoPath, ['diff', '--numstat', '--no-ext-diff'], ''),
    safeGit(repoPath, ['diff', '--cached', '--numstat', '--no-ext-diff'], ''),
    safeGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], ''),
    safeGit(repoPath, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], ''),
    safeGit(repoPath, ['for-each-ref', `--format=${GIT_BRANCH_LIST_FORMAT}`, 'refs/heads'], ''),
  ]);

  const branch = branchText.trim() || 'unknown';
  const upstreamName = normalizeOptionalText(upstreamNameText);
  const status = mergeGitStatusWithStats(
    parseGitStatus(statusText),
    parseGitNumstat(unstagedStatsText),
    parseGitNumstat(stagedStatsText),
  );
  const branches = ensureCurrentBranchListed(
    parseGitBranchList(branchListText),
    branch,
    upstreamName,
  );
  const { aheadCount, behindCount } = parseGitAheadBehind(aheadBehindText);

  return {
    path: repoPath,
    name: repoPath.split(/[/\\]/).pop() || repoPath,
    branch,
    upstreamName,
    aheadCount,
    behindCount,
    branches,
    status,
    lastCommit: lastCommitText.trim() || 'No commits yet',
    loadedAt: Date.now(),
  };
}

export async function loadGitHistoryCommits(
  repoPath: string,
  safeGit: GitSafeCommandRunner,
  options?: {
    scope?: GitHistoryScope;
    branchName?: string | null;
    limit?: number;
  },
): Promise<GitHistoryCommitSummary[]> {
  const scope = options?.scope ?? 'current-branch';
  const limit = Math.max(1, options?.limit ?? 200);
  const args = [
    'log',
    '--date-order',
    `--max-count=${limit}`,
    `--format=${GIT_HISTORY_LOG_FORMAT}`,
  ];

  if (scope === 'all-branches') {
    args.push('--all');
  } else if (options?.branchName?.trim()) {
    args.push(options.branchName.trim());
  }

  const logOutput = await safeGit(repoPath, args, '');
  return parseGitHistoryCommits(logOutput);
}

export async function loadGitHistoryCommitFiles(
  repoPath: string,
  safeGit: GitSafeCommandRunner,
  commitHash: string,
): Promise<GitHistoryCommitFile[]> {
  const output = await safeGit(
    repoPath,
    ['show', '--format=', '--name-status', '--find-renames', commitHash],
    '',
  );
  return parseGitHistoryCommitFiles(output);
}

export async function loadGitHistoryCommitPatch(
  repoPath: string,
  safeGit: GitSafeCommandRunner,
  commitHash: string,
  file: GitHistoryCommitFile,
): Promise<string> {
  const patch = await safeGit(
    repoPath,
    ['show', '--find-renames', '--format=', commitHash, '--', ...file.diffTargets],
    '',
  );

  if (patch.trim()) {
    return patch;
  }

  if (file.changeType === 'deleted') {
    return `diff --git a/${file.path} b/${file.path}\ndeleted file mode 100644\n--- a/${file.path}\n+++ /dev/null\n`;
  }

  return `diff --git a/${file.path} b/${file.path}\n@@\n+No textual diff output was produced for this commit file.\n`;
}

export function parseGitBranchList(output: string): GitPanelBranchSummary[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => {
      const [headFlag, name, upstreamName] = line.split(GIT_HISTORY_FIELD_SEPARATOR);
      const normalizedName = name?.trim() ?? '';
      if (!normalizedName) {
        return null;
      }

      return {
        name: normalizedName,
        upstreamName: normalizeOptionalText(upstreamName),
        isCurrent: (headFlag ?? '').trim() === '*',
      } satisfies GitPanelBranchSummary;
    })
    .filter((entry): entry is GitPanelBranchSummary => entry !== null);
}

export function parseGitAheadBehind(output: string): { aheadCount: number; behindCount: number } {
  const trimmed = output.trim();
  if (!trimmed) {
    return { aheadCount: 0, behindCount: 0 };
  }

  const [aheadText = '0', behindText = '0'] = trimmed.split(/\s+/);
  return {
    aheadCount: Number.parseInt(aheadText, 10) || 0,
    behindCount: Number.parseInt(behindText, 10) || 0,
  };
}

export function parseGitHistoryCommits(output: string): GitHistoryCommitSummary[] {
  return output
    .split(GIT_HISTORY_RECORD_SEPARATOR)
    .map(record => record.replace(/\r?\n$/, ''))
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const fields = record.split(GIT_HISTORY_FIELD_SEPARATOR);
      if (fields.length < 7) {
        return null;
      }

      const [
        hash = '',
        shortHash = '',
        authorName = '',
        authorEmail = '',
        timestampText = '0',
        summary = '',
        ...bodyParts
      ] = fields;
      const body = bodyParts.join(GIT_HISTORY_FIELD_SEPARATOR).replace(/\s+$/, '');

      return {
        hash,
        shortHash,
        authorName,
        authorEmail,
        timestampSeconds: Number.parseInt(timestampText, 10) || 0,
        summary,
        body,
      } satisfies GitHistoryCommitSummary;
    })
    .filter((entry): entry is GitHistoryCommitSummary => entry !== null);
}

export function parseGitHistoryCommitFiles(output: string): GitHistoryCommitFile[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('\t');
      if (parts.length < 2) {
        return null;
      }

      const statusCode = parts[0] ?? '';
      const statusKind = statusCode[0] ?? '';
      const isRenameLike = statusKind === 'R' || statusKind === 'C';
      const previousPath = isRenameLike ? normalizeGitPath(parts[1] ?? '') : null;
      const path = normalizeGitPath(parts[isRenameLike ? 2 : 1] ?? '');

      if (!path) {
        return null;
      }

      return {
        path,
        previousPath,
        statusCode,
        changeType: mapCommitFileChangeType(statusCode),
        diffTargets: Array.from(new Set([previousPath, path].filter(Boolean))) as string[],
      } satisfies GitHistoryCommitFile;
    })
    .filter((entry): entry is GitHistoryCommitFile => entry !== null);
}

function ensureCurrentBranchListed(
  branches: GitPanelBranchSummary[],
  branchName: string,
  upstreamName: string | null,
): GitPanelBranchSummary[] {
  if (!branchName || branches.some(branch => branch.name === branchName)) {
    return branches;
  }

  return [
    {
      name: branchName,
      upstreamName,
      isCurrent: true,
    },
    ...branches,
  ];
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGitPath(path: string): string {
  return path.replace(/\\/g, '/').trim();
}

function mapCommitFileChangeType(statusCode: string): GitHistoryCommitFileChangeType {
  const code = statusCode[0] ?? '';
  if (code === 'A') return 'added';
  if (code === 'D') return 'deleted';
  if (code === 'R') return 'renamed';
  if (code === 'C') return 'copied';
  if (code === 'T') return 'type-changed';
  if (code === 'U') return 'conflicted';
  if (code === 'M') return 'modified';
  return 'unknown';
}
