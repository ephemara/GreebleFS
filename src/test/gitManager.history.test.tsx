import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { GitManager } from '../components/GitManager';
import { resolveOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';

function renderGitManager(options?: { pendingRepositoryImports?: string[] }) {
  render(
    <GitManager
      appearance={resolveOverlayAppearance({ activeThemeId: 'operator' })}
      pendingRepositoryImports={options?.pendingRepositoryImports ?? []}
    />,
  );
}

function makeHistoryRecord(options: {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  timestampSeconds: number;
  summary: string;
  body?: string;
}) {
  return [
    options.hash,
    options.shortHash,
    options.authorName,
    options.authorEmail,
    String(options.timestampSeconds),
    options.summary,
    options.body ?? '',
  ].join('\x1f') + '\x1e';
}

describe('GitManager history and branch controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    vi.mocked(invoke).mockReset();

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });
  });

  it('loads the history tab and previews commit file patches', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const historyOutput = [
      makeHistoryRecord({
        hash: 'abc123',
        shortHash: 'abc1234',
        authorName: 'Ada Lovelace',
        authorEmail: 'ada@example.com',
        timestampSeconds: Math.floor(Date.now() / 1000) - 60 * 90,
        summary: 'Add history panel',
        body: 'Grouped commit browsing and patch preview',
      }),
      makeHistoryRecord({
        hash: 'def456',
        shortHash: 'def4567',
        authorName: 'Grace Hopper',
        authorEmail: 'grace@example.com',
        timestampSeconds: Math.floor(Date.now() / 1000) - 60 * 60 * 26,
        summary: 'Tighten branch badges',
      }),
    ].join('');

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const repoPath = payload?.repoPath ?? '';
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') {
        return 'C:\\repo\n';
      }
      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }
      if (signature === 'log -1 --pretty=format:%h - %s (%cr)') {
        return 'abc123 - Add history panel (2 hours ago)\n';
      }
      if (signature === 'status --porcelain') {
        return '';
      }
      if (signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }
      if (signature === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') {
        return 'origin/main\n';
      }
      if (signature === 'rev-list --left-right --count HEAD...@{upstream}') {
        return '2\t1\n';
      }
      if (gitArgs[0] === 'for-each-ref') {
        return [
          '*\x1fmain\x1forigin/main',
          ' \x1ffeature/history\x1forigin/feature/history',
        ].join('\n');
      }
      if (gitArgs[0] === 'log' && gitArgs.includes('--date-order')) {
        expect(repoPath).toBe('C:\\repo');
        return historyOutput;
      }
      if (signature === 'show --format= --name-status --find-renames abc123') {
        return 'M\tsrc/app.ts\nA\tsrc/history.ts\n';
      }
      if (signature === 'show --find-renames --format= abc123 -- src/app.ts') {
        return [
          'diff --git a/src/app.ts b/src/app.ts',
          '--- a/src/app.ts',
          '+++ b/src/app.ts',
          '@@ -1 +1 @@',
          '-console.log("old");',
          '+console.log("new history");',
          '',
        ].join('\n');
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('abc123 - Add history panel (2 hours ago)');
    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findAllByText('Add history panel')).toHaveLength(2);
    expect(await screen.findByText('Grouped commit browsing and patch preview')).toBeInTheDocument();
    expect(await screen.findAllByText('src/app.ts')).toHaveLength(2);
    expect(await screen.findByText('+console.log("new history");')).toBeInTheDocument();
  });

  it('switches branches from the header selector and refreshes repo metadata', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    let currentBranch = 'main';

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const repoPath = payload?.repoPath ?? '';
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') {
        return 'C:\\repo\n';
      }
      if (signature === 'status --porcelain') {
        return currentBranch === 'main' ? ' M src/app.ts\n' : '';
      }
      if (signature === 'diff --numstat --no-ext-diff') {
        return currentBranch === 'main' ? '4\t1\tsrc/app.ts\n' : '';
      }
      if (signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }
      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return `${currentBranch}\n`;
      }
      if (signature === 'log -1 --pretty=format:%h - %s (%cr)') {
        return currentBranch === 'main'
          ? 'abc123 - Main branch ready (just now)\n'
          : 'def456 - History branch ready (just now)\n';
      }
      if (signature === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') {
        return currentBranch === 'main'
          ? 'origin/main\n'
          : 'origin/feature/history\n';
      }
      if (signature === 'rev-list --left-right --count HEAD...@{upstream}') {
        return currentBranch === 'main' ? '0\t0\n' : '1\t0\n';
      }
      if (gitArgs[0] === 'for-each-ref') {
        return currentBranch === 'main'
          ? [
            '*\x1fmain\x1forigin/main',
            ' \x1ffeature/history\x1forigin/feature/history',
          ].join('\n')
          : [
            ' \x1fmain\x1forigin/main',
            '*\x1ffeature/history\x1forigin/feature/history',
          ].join('\n');
      }
      if (signature === 'checkout feature/history') {
        currentBranch = 'feature/history';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('abc123 - Main branch ready (just now)');

    const branchSelect = screen.getByLabelText('Git branch');
    expect(branchSelect).toHaveValue('main');

    await user.selectOptions(branchSelect, 'feature/history');

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['checkout', 'feature/history'],
      });
    });

    await waitFor(() => {
      expect(branchSelect).toHaveValue('feature/history');
    });

    expect(await screen.findByText('def456 - History branch ready (just now)')).toBeInTheDocument();
    expect(screen.getByText('↑1 ahead')).toBeInTheDocument();
  });
});
