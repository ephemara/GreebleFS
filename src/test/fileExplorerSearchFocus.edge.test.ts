import { describe, expect, it } from 'vitest';
import {
  clampSearchFocusLine,
  createEditorSearchFocus,
  findSearchFocusColumns,
} from '../components/fileExplorerSearchFocus';

describe('fileExplorerSearchFocus edge cases', () => {
  it('keeps line-based and content-based matches consistent', () => {
    expect(
      createEditorSearchFocus(19, '  config  ', {
        line_number: 12,
        match_kind: 'name_and_content',
      }),
    ).toEqual({
      requestId: 19,
      lineNumber: 12,
      searchString: 'config',
    });

    expect(
      createEditorSearchFocus(20, '  ', {
        line_number: 9,
        match_kind: 'content',
      }),
    ).toEqual({
      requestId: 20,
      lineNumber: 9,
      searchString: null,
    });
  });

  it('clamps invalid line counts to the first visible line', () => {
    expect(clampSearchFocusLine(3, 0)).toBe(1);
    expect(clampSearchFocusLine(Number.NaN, 12)).toBe(1);
    expect(clampSearchFocusLine(Number.POSITIVE_INFINITY, 12)).toBe(1);
  });

  it('finds the first matching columns when a search string repeats', () => {
    expect(findSearchFocusColumns('config config config', 'Config')).toEqual({
      startColumn: 1,
      endColumn: 7,
    });
  });
});
