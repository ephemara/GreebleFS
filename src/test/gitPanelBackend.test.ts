import { describe, expect, it } from 'vitest';
import {
  parseGitAheadBehind,
  parseGitBranchList,
  parseGitHistoryCommitFiles,
  parseGitHistoryCommits,
} from '../runtime/gitPanelBackend';

describe('parseGitBranchList()', () => {
  it('parses local branches with current and upstream metadata', () => {
    const parsed = parseGitBranchList([
      '*\x1fmain\x1forigin/main',
      ' \x1ffeature/history\x1forigin/feature/history',
      ' \x1fexperiment\x1f',
    ].join('\n'));

    expect(parsed).toEqual([
      {
        name: 'main',
        upstreamName: 'origin/main',
        isCurrent: true,
      },
      {
        name: 'feature/history',
        upstreamName: 'origin/feature/history',
        isCurrent: false,
      },
      {
        name: 'experiment',
        upstreamName: null,
        isCurrent: false,
      },
    ]);
  });
});

describe('parseGitAheadBehind()', () => {
  it('parses rev-list ahead and behind counts', () => {
    expect(parseGitAheadBehind('3\t1\n')).toEqual({
      aheadCount: 3,
      behindCount: 1,
    });
    expect(parseGitAheadBehind('')).toEqual({
      aheadCount: 0,
      behindCount: 0,
    });
  });
});

describe('parseGitHistoryCommits()', () => {
  it('parses git log records with summaries and bodies', () => {
    const parsed = parseGitHistoryCommits([
      'abc123\x1fabc1234\x1fAda Lovelace\x1fada@example.com\x1f1713890100\x1fShip history lane\x1fAdds grouped commit browsing\x1e',
      'def456\x1fdef4567\x1fGrace Hopper\x1fgrace@example.com\x1f1713803700\x1fFix diff pane\x1f\x1e',
    ].join(''));

    expect(parsed).toEqual([
      {
        hash: 'abc123',
        shortHash: 'abc1234',
        authorName: 'Ada Lovelace',
        authorEmail: 'ada@example.com',
        timestampSeconds: 1713890100,
        summary: 'Ship history lane',
        body: 'Adds grouped commit browsing',
      },
      {
        hash: 'def456',
        shortHash: 'def4567',
        authorName: 'Grace Hopper',
        authorEmail: 'grace@example.com',
        timestampSeconds: 1713803700,
        summary: 'Fix diff pane',
        body: '',
      },
    ]);
  });
});

describe('parseGitHistoryCommitFiles()', () => {
  it('parses modified, added, and renamed commit files', () => {
    const parsed = parseGitHistoryCommitFiles([
      'M\tsrc/components/GitManager.tsx',
      'A\tsrc/components/GitHistoryPanel.tsx',
      'R100\tsrc/old-name.tsx\tsrc/new-name.tsx',
    ].join('\n'));

    expect(parsed).toEqual([
      {
        path: 'src/components/GitManager.tsx',
        previousPath: null,
        statusCode: 'M',
        changeType: 'modified',
        diffTargets: ['src/components/GitManager.tsx'],
      },
      {
        path: 'src/components/GitHistoryPanel.tsx',
        previousPath: null,
        statusCode: 'A',
        changeType: 'added',
        diffTargets: ['src/components/GitHistoryPanel.tsx'],
      },
      {
        path: 'src/new-name.tsx',
        previousPath: 'src/old-name.tsx',
        statusCode: 'R100',
        changeType: 'renamed',
        diffTargets: ['src/old-name.tsx', 'src/new-name.tsx'],
      },
    ]);
  });
});
