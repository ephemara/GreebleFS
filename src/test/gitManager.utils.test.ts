import { describe, expect, it } from 'vitest';
import {
  mergeGitStatusWithStats,
  parseGitNumstat,
  parseGitStatus,
  summarizeGitFiles,
} from '../components/gitManager.utils';

describe('parseGitStatus()', () => {
  it('parses modified, untracked, deleted, and renamed entries', () => {
    const parsed = parseGitStatus([
      ' M src/components/GitManager.tsx',
      'A  src/components/gitManager.utils.ts',
      'D  src/legacy.ts',
      '?? src/new file.tsx',
      'R  src/old-name.tsx -> src/new-name.tsx',
    ].join('\n'));

    expect(parsed).toEqual([
      expect.objectContaining({
        file: 'src/components/GitManager.tsx',
        statusText: ' M',
        stagedCode: ' ',
        unstagedCode: 'M',
        kind: 'modified',
        hasUnstagedChanges: true,
      }),
      expect.objectContaining({
        file: 'src/components/gitManager.utils.ts',
        statusText: 'A ',
        stagedCode: 'A',
        unstagedCode: ' ',
        kind: 'added',
        isStaged: true,
      }),
      expect.objectContaining({
        file: 'src/legacy.ts',
        statusText: 'D ',
        kind: 'deleted',
      }),
      expect.objectContaining({
        file: 'src/new file.tsx',
        statusText: '??',
        kind: 'untracked',
        isUntracked: true,
      }),
      expect.objectContaining({
        file: 'src/new-name.tsx',
        originalFile: 'src/old-name.tsx',
        statusText: 'R ',
        kind: 'renamed',
      }),
    ]);
  });
});

describe('parseGitNumstat()', () => {
  it('parses text and binary file stats', () => {
    const parsed = parseGitNumstat([
      '14\t3\tsrc/components/GitManager.tsx',
      '-\t-\tpublic/logo.png',
    ].join('\n'));

    expect(parsed).toEqual([
      {
        path: 'src/components/GitManager.tsx',
        additions: 14,
        deletions: 3,
        isBinary: false,
      },
      {
        path: 'public/logo.png',
        additions: 0,
        deletions: 0,
        isBinary: true,
      },
    ]);
  });
});

describe('mergeGitStatusWithStats()', () => {
  it('combines staged and unstaged stats onto status entries', () => {
    const merged = mergeGitStatusWithStats(
      parseGitStatus([
        'MM src/components/GitManager.tsx',
        'R  src/old-name.tsx -> src/new-name.tsx',
      ].join('\n')),
      parseGitNumstat([
        '4\t1\tsrc/components/GitManager.tsx',
        '0\t8\tsrc/old-name.tsx',
      ].join('\n')),
      parseGitNumstat([
        '11\t2\tsrc/components/GitManager.tsx',
        '7\t0\tsrc/new-name.tsx',
      ].join('\n')),
    );

    expect(merged).toEqual([
      expect.objectContaining({
        file: 'src/components/GitManager.tsx',
        stagedAdditions: 11,
        stagedDeletions: 2,
        unstagedAdditions: 4,
        unstagedDeletions: 1,
        additions: 15,
        deletions: 3,
      }),
      expect.objectContaining({
        file: 'src/new-name.tsx',
        originalFile: 'src/old-name.tsx',
        stagedAdditions: 7,
        stagedDeletions: 0,
        unstagedAdditions: 0,
        unstagedDeletions: 8,
        additions: 7,
        deletions: 8,
      }),
    ]);
  });
});

describe('summarizeGitFiles()', () => {
  it('builds repository totals from parsed files', () => {
    const summary = summarizeGitFiles(
      mergeGitStatusWithStats(
        parseGitStatus([
          'A  src/added.ts',
          ' M src/edited.ts',
          '?? src/new.ts',
          'UU src/conflicted.ts',
        ].join('\n')),
        parseGitNumstat('3\t1\tsrc/edited.ts'),
        parseGitNumstat('9\t0\tsrc/added.ts'),
      ),
    );

    expect(summary).toEqual({
      totalFiles: 4,
      stagedFiles: 3,
      unstagedFiles: 2,
      untrackedFiles: 1,
      conflictedFiles: 1,
      additions: 12,
      deletions: 1,
    });
  });
});
