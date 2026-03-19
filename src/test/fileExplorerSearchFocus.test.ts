import { describe, expect, it } from 'vitest';
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
} from '../components/fileExplorerSearchFocus';

describe('createEditorSearchFocus()', () => {
  it('preserves the exact line and query for content matches', () => {
    expect(createEditorSearchFocus(7, '  icon theme  ', {
      line_number: 3,
      match_kind: 'content',
    })).toEqual({
      requestId: 7,
      lineNumber: 3,
      searchString: 'icon theme',
    });
  });

  it('keeps name-only matches from opening an empty find widget', () => {
    expect(createEditorSearchFocus(8, 'README', {
      line_number: null,
      match_kind: 'name',
    })).toBeNull();
  });

  it('still reveals an exact line even when the search hit is line-based only', () => {
    expect(createEditorSearchFocus(9, 'README', {
      line_number: 42,
      match_kind: 'name',
    })).toEqual({
      requestId: 9,
      lineNumber: 42,
      searchString: null,
    });
  });
});

describe('clampSearchFocusLine()', () => {
  it('clamps invalid values into the current document bounds', () => {
    expect(clampSearchFocusLine(null, 12)).toBe(1);
    expect(clampSearchFocusLine(-5, 12)).toBe(1);
    expect(clampSearchFocusLine(99, 12)).toBe(12);
    expect(clampSearchFocusLine(4.8, 12)).toBe(4);
  });
});

describe('findSearchFocusColumns()', () => {
  it('finds the matching columns case-insensitively', () => {
    expect(findSearchFocusColumns('A VS Code icon theme', 'icon')).toEqual({
      startColumn: 11,
      endColumn: 15,
    });
  });

  it('falls back safely when the search text is not present on the line', () => {
    expect(findSearchFocusColumns('README.md', 'overlayterm')).toEqual({
      startColumn: 1,
      endColumn: 1,
    });
  });
});
