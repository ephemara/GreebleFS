export type ExplorerSearchMatchKind = 'name' | 'content' | 'name_and_content';

export interface EditorSearchFocusTarget {
  requestId: number;
  lineNumber: number | null;
  searchString: string | null;
}

interface SearchFocusSource {
  line_number: number | null;
  match_kind: ExplorerSearchMatchKind | null | undefined;
}

export function createEditorSearchFocus(
  requestId: number,
  searchQuery: string,
  source: SearchFocusSource,
): EditorSearchFocusTarget | null {
  const matchKind = source.match_kind ?? 'name';
  const trimmedQuery = searchQuery.trim();
  const searchString = matchKind === 'content' || matchKind === 'name_and_content'
    ? (trimmedQuery || null)
    : null;

  if (source.line_number == null && !searchString) {
    return null;
  }

  return {
    requestId,
    lineNumber: source.line_number ?? null,
    searchString,
  };
}

export function clampSearchFocusLine(lineNumber: number | null | undefined, lineCount: number): number {
  if (!Number.isFinite(lineCount) || lineCount < 1) {
    return 1;
  }

  if (lineNumber == null || !Number.isFinite(lineNumber)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(lineNumber), 1), lineCount);
}

export function findSearchFocusColumns(
  lineContent: string,
  searchString: string | null,
): { startColumn: number; endColumn: number } {
  const normalizedLine = lineContent ?? '';
  const trimmedSearch = searchString?.trim() ?? '';

  if (!trimmedSearch) {
    return { startColumn: 1, endColumn: 1 };
  }

  const matchIndex = normalizedLine.toLowerCase().indexOf(trimmedSearch.toLowerCase());
  if (matchIndex < 0) {
    return { startColumn: 1, endColumn: 1 };
  }

  return {
    startColumn: matchIndex + 1,
    endColumn: matchIndex + trimmedSearch.length + 1,
  };
}
