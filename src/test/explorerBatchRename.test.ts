import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExplorerBatchRenamePreview } from '../components/explorerBatchRename';
import { createTestExplorerFileEntry } from './helpers/explorerEntries';

const REPO_ROOT = 'C:\\workspace\\repo';

describe('buildExplorerBatchRenamePreview', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('expands regex captures, named captures, tokens, and preserves file extensions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T09:30:00-04:00'));

    const preview = buildExplorerBatchRenamePreview([
      createTestExplorerFileEntry({
        name: 'alpha-01.txt',
        path: `${REPO_ROOT}\\assets\\alpha-01.txt`,
        is_dir: false,
        size: 128,
        modified: 0,
        extension: 'txt',
        is_hidden: false,
        is_symlink: false,
      }),
      createTestExplorerFileEntry({
        name: 'alpha-02.txt',
        path: `${REPO_ROOT}\\assets\\alpha-02.txt`,
        is_dir: false,
        size: 256,
        modified: 0,
        extension: 'txt',
        is_hidden: false,
        is_symlink: false,
      }),
    ], {
      mode: 'regex',
      findText: '^(?<stem>alpha)-(?<serial>\\d+)$',
      replaceText: '${stem}-item-${serial}',
      prefix: '{{parent}}-',
      suffix: '-{{date}}-{{index}}',
      startingNumber: 7,
      padding: 3,
    });

    expect(preview.validationError).toBeNull();
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({
      currentName: 'alpha-01.txt',
      nextName: 'assets-alpha-item-01-2026-04-16-007.txt',
      destinationPath: `${REPO_ROOT}\\assets\\assets-alpha-item-01-2026-04-16-007.txt`,
      collision: false,
      validationError: null,
    });
    expect(preview.rows[1]).toMatchObject({
      currentName: 'alpha-02.txt',
      nextName: 'assets-alpha-item-02-2026-04-16-008.txt',
      destinationPath: `${REPO_ROOT}\\assets\\assets-alpha-item-02-2026-04-16-008.txt`,
      collision: false,
      validationError: null,
    });
  });

  it('surfaces invalid regex recipes as inline validation state', () => {
    const preview = buildExplorerBatchRenamePreview([
      createTestExplorerFileEntry({
        name: 'notes.txt',
        path: `${REPO_ROOT}\\notes.txt`,
        is_dir: false,
        size: 128,
        modified: 0,
        extension: 'txt',
        is_hidden: false,
        is_symlink: false,
      }),
    ], {
      mode: 'regex',
      findText: '[',
      replaceText: 'ignored',
      prefix: '',
      suffix: '',
      startingNumber: 1,
      padding: 2,
    });

    expect(preview.validationError).toContain('Invalid regex pattern');
    expect(preview.rows[0]).toMatchObject({
      collision: true,
      validationError: preview.validationError,
    });
  });
});
