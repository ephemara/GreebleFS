import type { ExplorerFileEntry } from '../runtime/explorerBackend';

export interface ExplorerJumpFilterState {
  query: string;
  active: boolean;
  resultIndex: number;
}

export interface ExplorerJumpFilterMatch {
  entry: ExplorerFileEntry;
  score: number;
  originalIndex: number;
}

const PRINTABLE_KEY_PATTERN = /^.$/;

export function isExplorerJumpFilterPrintableKey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return PRINTABLE_KEY_PATTERN.test(event.key)
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey;
}

export function appendExplorerJumpFilterCharacter(query: string, key: string): string {
  return `${query}${key}`;
}

export function removeExplorerJumpFilterCharacter(query: string): string {
  return query.slice(0, -1);
}

export function filterExplorerEntriesForJump(
  entries: ExplorerFileEntry[],
  query: string,
): ExplorerFileEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entries;
  }

  return entries
    .map((entry, originalIndex) => {
      const score = scoreExplorerJumpEntry(entry, normalizedQuery);
      return score === null ? null : { entry, score, originalIndex } satisfies ExplorerJumpFilterMatch;
    })
    .filter((value): value is ExplorerJumpFilterMatch => Boolean(value))
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map((value) => value.entry);
}

function scoreExplorerJumpEntry(entry: ExplorerFileEntry, query: string): number | null {
  const filenameScore = scoreFuzzyText(entry.name.toLowerCase(), query);
  const pathSegments = entry.path
    .split(/[/\\]/)
    .map((segment) => segment.toLowerCase())
    .filter(Boolean);
  const pathScore = pathSegments.reduce<number | null>((bestScore, segment) => {
    const nextScore = scoreFuzzyText(segment, query);
    if (nextScore === null) {
      return bestScore;
    }
    return bestScore === null ? nextScore : Math.max(bestScore, nextScore);
  }, null);

  if (filenameScore === null && pathScore === null) {
    return null;
  }

  const filenameWeight = filenameScore ?? 0;
  const pathWeight = pathScore ?? 0;
  return (filenameWeight * 3) + (pathWeight * 2);
}

function scoreFuzzyText(value: string, query: string): number | null {
  if (value === query) {
    return 10_000;
  }

  let cursor = 0;
  let score = 0;
  let previousMatchIndex = -1;

  for (const queryChar of query) {
    const nextIndex = value.indexOf(queryChar, cursor);
    if (nextIndex < 0) {
      return null;
    }

    score += 100;
    if (previousMatchIndex >= 0) {
      const gap = nextIndex - previousMatchIndex - 1;
      score -= Math.min(50, gap * 3);
      if (gap === 0) {
        score += 35;
      }
    }

    if (nextIndex === cursor) {
      score += 12;
    }

    previousMatchIndex = nextIndex;
    cursor = nextIndex + 1;
  }

  score -= value.length;
  if (value.startsWith(query)) {
    score += 120;
  }
  if (value.includes(query)) {
    score += 60;
  }

  return score;
}
