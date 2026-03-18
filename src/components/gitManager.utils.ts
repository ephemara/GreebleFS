export type GitFileKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted';

export interface GitFileStatus {
  file: string;
  originalFile: string | null;
  statusText: string;
  stagedCode: string;
  unstagedCode: string;
  isStaged: boolean;
  hasUnstagedChanges: boolean;
  isUntracked: boolean;
  kind: GitFileKind;
  stagedAdditions: number;
  stagedDeletions: number;
  unstagedAdditions: number;
  unstagedDeletions: number;
  additions: number;
  deletions: number;
}

export interface GitNumstatEntry {
  path: string;
  additions: number;
  deletions: number;
  isBinary: boolean;
}

export interface GitSummary {
  totalFiles: number;
  stagedFiles: number;
  unstagedFiles: number;
  untrackedFiles: number;
  conflictedFiles: number;
  additions: number;
  deletions: number;
}

const EMPTY_STATS = { additions: 0, deletions: 0 };

export function parseGitStatus(output: string): GitFileStatus[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(line => {
      const statusText = line.slice(0, 2);
      const stagedCode = statusText[0] ?? ' ';
      const unstagedCode = statusText[1] ?? ' ';
      const rawPath = unquoteGitPath(line.slice(3).trim());
      const [originalFile, file] = splitGitRenamePath(rawPath);
      const kind = deriveGitFileKind(statusText);

      return {
        file,
        originalFile,
        statusText,
        stagedCode,
        unstagedCode,
        isStaged: stagedCode !== ' ' && stagedCode !== '?',
        hasUnstagedChanges: unstagedCode !== ' ' && unstagedCode !== '?',
        isUntracked: statusText === '??',
        kind,
        stagedAdditions: 0,
        stagedDeletions: 0,
        unstagedAdditions: 0,
        unstagedDeletions: 0,
        additions: 0,
        deletions: 0,
      } satisfies GitFileStatus;
    })
    .sort((left, right) => left.file.localeCompare(right.file));
}

export function parseGitNumstat(output: string): GitNumstatEntry[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split('\t');
      if (parts.length < 3) {
        return null;
      }

      const [rawAdditions, rawDeletions, ...rawPathParts] = parts;
      const path = normalizeGitPath(rawPathParts.join('\t'));
      const isBinary = rawAdditions === '-' || rawDeletions === '-';

      return {
        path,
        additions: isBinary ? 0 : Number.parseInt(rawAdditions, 10) || 0,
        deletions: isBinary ? 0 : Number.parseInt(rawDeletions, 10) || 0,
        isBinary,
      } satisfies GitNumstatEntry;
    })
    .filter((entry): entry is GitNumstatEntry => entry !== null);
}

export function mergeGitStatusWithStats(
  statuses: GitFileStatus[],
  unstagedStats: GitNumstatEntry[],
  stagedStats: GitNumstatEntry[],
): GitFileStatus[] {
  const unstagedMap = buildStatsMap(unstagedStats);
  const stagedMap = buildStatsMap(stagedStats);

  return statuses.map(status => {
    const relatedPaths = [status.file, status.originalFile].filter(Boolean) as string[];
    const unstaged = sumStatsForPaths(unstagedMap, relatedPaths);
    const staged = sumStatsForPaths(stagedMap, relatedPaths);

    return {
      ...status,
      stagedAdditions: staged.additions,
      stagedDeletions: staged.deletions,
      unstagedAdditions: unstaged.additions,
      unstagedDeletions: unstaged.deletions,
      additions: staged.additions + unstaged.additions,
      deletions: staged.deletions + unstaged.deletions,
    };
  });
}

export function summarizeGitFiles(files: GitFileStatus[]): GitSummary {
  return files.reduce<GitSummary>(
    (summary, file) => ({
      totalFiles: summary.totalFiles + 1,
      stagedFiles: summary.stagedFiles + (file.isStaged ? 1 : 0),
      unstagedFiles: summary.unstagedFiles + (file.hasUnstagedChanges ? 1 : 0),
      untrackedFiles: summary.untrackedFiles + (file.isUntracked ? 1 : 0),
      conflictedFiles: summary.conflictedFiles + (file.kind === 'conflicted' ? 1 : 0),
      additions: summary.additions + file.additions,
      deletions: summary.deletions + file.deletions,
    }),
    {
      totalFiles: 0,
      stagedFiles: 0,
      unstagedFiles: 0,
      untrackedFiles: 0,
      conflictedFiles: 0,
      additions: 0,
      deletions: 0,
    },
  );
}

function deriveGitFileKind(statusText: string): GitFileKind {
  if (statusText === '??') return 'untracked';

  const codes = new Set(statusText.trim().split(''));
  if (codes.has('U')) return 'conflicted';
  if (codes.has('R')) return 'renamed';
  if (codes.has('C')) return 'copied';
  if (codes.has('D')) return 'deleted';
  if (codes.has('A')) return 'added';
  return 'modified';
}

function buildStatsMap(entries: GitNumstatEntry[]): Map<string, { additions: number; deletions: number }> {
  const map = new Map<string, { additions: number; deletions: number }>();

  for (const entry of entries) {
    const key = normalizeGitPath(entry.path);
    const current = map.get(key) ?? EMPTY_STATS;
    map.set(key, {
      additions: current.additions + entry.additions,
      deletions: current.deletions + entry.deletions,
    });
  }

  return map;
}

function sumStatsForPaths(
  map: Map<string, { additions: number; deletions: number }>,
  paths: string[],
): { additions: number; deletions: number } {
  const seen = new Set<string>();
  return paths.reduce(
    (total, path) => {
      const key = normalizeGitPath(path);
      if (seen.has(key)) {
        return total;
      }
      seen.add(key);

      const stats = map.get(key);
      if (!stats) {
        return total;
      }

      return {
        additions: total.additions + stats.additions,
        deletions: total.deletions + stats.deletions,
      };
    },
    { additions: 0, deletions: 0 },
  );
}

function splitGitRenamePath(rawPath: string): [string | null, string] {
  if (!rawPath.includes(' -> ')) {
    return [null, normalizeGitPath(rawPath)];
  }

  const [from, to] = rawPath.split(/\s+->\s+/, 2);
  return [normalizeGitPath(from), normalizeGitPath(to)];
}

function normalizeGitPath(path: string): string {
  return unquoteGitPath(path).replaceAll('\\', '/');
}

function unquoteGitPath(path: string): string {
  if (path.startsWith('"') && path.endsWith('"')) {
    return path.slice(1, -1).replaceAll('\\"', '"');
  }
  return path;
}
