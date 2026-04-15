import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { GitManager } from '../components/GitManager';
import { resolveOverlayAppearance } from '../config/appearance';
import { recordExplorerPerformanceSample } from '../config/performanceTelemetry';
import { useSettingsStore } from '../store/settingsStore';

const { fsReadTextFileMock, fsListDirMock } = vi.hoisted(() => ({
  fsReadTextFileMock: vi.fn(),
  fsListDirMock: vi.fn(),
}));

vi.mock('../runtime/tauriClient', async () => {
  const actual = await vi.importActual<typeof import('../runtime/tauriClient')>('../runtime/tauriClient');
  return {
    ...actual,
    commands: {
      ...actual.commands,
      fsReadTextFile: fsReadTextFileMock,
      fsListDir: fsListDirMock,
    },
  };
});

vi.mock('../config/performanceTelemetry', async () => {
  const actual = await vi.importActual<typeof import('../config/performanceTelemetry')>('../config/performanceTelemetry');
  return {
    ...actual,
    recordExplorerPerformanceSample: vi.fn(actual.recordExplorerPerformanceSample),
  };
});

function renderGitManager(options?: {
  pendingRepositoryImports?: string[];
  onPendingRepositoryImportsHandled?: () => void;
  onRequestRepositoryImport?: () => void;
}) {
  render(
    <GitManager
      appearance={resolveOverlayAppearance({ activeThemeId: 'operator' })}
      pendingRepositoryImports={options?.pendingRepositoryImports ?? []}
      onPendingRepositoryImportsHandled={options?.onPendingRepositoryImportsHandled}
      onRequestRepositoryImport={options?.onRequestRepositoryImport}
    />,
  );
}

describe('GitManager onboarding behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    vi.mocked(invoke).mockReset();
    vi.mocked(recordExplorerPerformanceSample).mockClear();
    fsReadTextFileMock.mockReset();
    fsListDirMock.mockReset();

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    });
  });

  it('normalizes nested imports to the repo root before loading repository state', async () => {
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const repoPath = payload?.repoPath ?? '';
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') {
        if (repoPath === 'C:\\repo\\nested') {
          return 'C:\\repo\n';
        }

        if (repoPath === 'C:\\repo') {
          return 'C:\\repo\n';
        }
      }

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (gitArgs[0] === 'status' || gitArgs[0] === 'diff') {
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo\\nested'],
    });

    await screen.findByText('C:\\repo');

    expect(screen.queryByText('C:\\repo\\nested')).not.toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith('git_exec', {
      repoPath: 'C:\\repo\\nested',
      args: ['rev-parse', '--show-toplevel'],
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['rev-parse', '--abbrev-ref', 'HEAD'],
      });
    });
  });

  it('deduplicates imports that resolve to the same repository root', async () => {
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const repoPath = payload?.repoPath ?? '';
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') {
        if (repoPath === 'C:\\repo\\nested') {
          return 'C:\\repo\n';
        }

        if (repoPath === 'C:\\repo') {
          return 'C:\\repo\n';
        }
      }

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (gitArgs[0] === 'status' || gitArgs[0] === 'diff') {
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo', 'C:\\repo\\nested'],
    });

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('overlayterm-git-repos') ?? '[]')).toEqual(['C:\\repo']);
    });
  });

  it('focuses the first newly added repository when duplicates and new imports are mixed', async () => {
    const invokeMock = vi.mocked(invoke);
    window.localStorage.setItem('overlayterm-git-repos', JSON.stringify(['C:\\repo']));

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const repoPath = payload?.repoPath ?? '';
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') {
        if (repoPath === 'C:\\repo\\nested') {
          return 'C:\\repo\n';
        }

        if (repoPath === 'C:\\repo' || repoPath === 'D:\\repo-new\\nested' || repoPath === 'D:\\repo-new') {
          return `${repoPath.replace('\\nested', '')}\n`;
        }
      }

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return repoPath === 'D:\\repo-new' ? 'feature/import\n' : 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return repoPath === 'D:\\repo-new'
          ? 'def456 - Added new repo (just now)\n'
          : 'abc123 - Existing repo (just now)\n';
      }

      if (gitArgs[0] === 'status' || gitArgs[0] === 'diff') {
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo\\nested', 'D:\\repo-new\\nested'],
    });

    await screen.findByText('def456 - Added new repo (just now)');

    expect(JSON.parse(window.localStorage.getItem('overlayterm-git-repos') ?? '[]')).toEqual([
      'C:\\repo',
      'D:\\repo-new',
    ]);
    expect(invokeMock).toHaveBeenCalledWith('git_exec', {
      repoPath: 'D:\\repo-new',
      args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    });
  });

  it('notifies the app when pending repository imports have been handled', async () => {
    const invokeMock = vi.mocked(invoke);
    const handledSpy = vi.fn();

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (gitArgs[0] === 'status' || gitArgs[0] === 'diff') {
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
      onPendingRepositoryImportsHandled: handledSpy,
    });

    await screen.findByText('abc123 - Initial commit (just now)');

    await waitFor(() => {
      expect(handledSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('stages and unstages a selected file from the diff header controls', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    let statusText = ' M src/app.ts\n';
    let unstagedNumstat = '3\t1\tsrc/app.ts\n';
    let stagedNumstat = '';

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff') {
        return unstagedNumstat;
      }

      if (signature === 'diff --cached --numstat --no-ext-diff') {
        return stagedNumstat;
      }

      if (signature === 'diff HEAD --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@ -1 +1 @@\n-old\n+new\n';
      }

      if (signature === 'add -- src/app.ts') {
        statusText = 'M  src/app.ts\n';
        unstagedNumstat = '';
        stagedNumstat = '3\t1\tsrc/app.ts\n';
        return '';
      }

      if (signature === 'restore --staged -- src/app.ts') {
        statusText = ' M src/app.ts\n';
        unstagedNumstat = '3\t1\tsrc/app.ts\n';
        stagedNumstat = '';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('abc123 - Initial commit (just now)');
    await user.click(screen.getByText('src/app.ts'));
    await user.click(await screen.findByRole('button', { name: 'Stage' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['add', '--', 'src/app.ts'],
      });
    });

    expect(await screen.findByRole('button', { name: 'Unstage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stage' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unstage' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['restore', '--staged', '--', 'src/app.ts'],
      });
    });

    expect(await screen.findByRole('button', { name: 'Stage' })).toBeInTheDocument();
  });

  it('only enables Commit after files are actually staged', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    let statusText = ' M src/app.ts\n';
    let unstagedNumstat = '3\t1\tsrc/app.ts\n';
    let stagedNumstat = '';

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff') {
        return unstagedNumstat;
      }

      if (signature === 'diff --cached --numstat --no-ext-diff') {
        return stagedNumstat;
      }

      if (signature === 'diff HEAD --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@ -1 +1 @@\n-old\n+new\n';
      }

      if (signature === 'add -A') {
        statusText = 'M  src/app.ts\n';
        unstagedNumstat = '';
        stagedNumstat = '3\t1\tsrc/app.ts\n';
        return '';
      }

      if (signature === 'commit -m Ship staged changes') {
        statusText = '';
        stagedNumstat = '';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('abc123 - Initial commit (just now)');
    await user.type(screen.getByPlaceholderText('Commit message for Quick Ship'), 'Ship staged changes');

    const commitButton = screen.getByRole('button', { name: 'Commit' });
    expect(commitButton).toBeDisabled();
    expect(screen.getByText('Stage selected files, use Stage All, or Quick Ship to include working-tree changes in a commit.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stage All' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['add', '-A'],
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Commit' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Commit' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['commit', '-m', 'Ship staged changes'],
      });
    });

    expect(await screen.findByText('Working tree is clean.')).toBeInTheDocument();
  });

  it('routes empty-state repo picking back into Explorer when the handoff callback is provided', async () => {
    const user = userEvent.setup();
    const requestImportSpy = vi.fn();
    const promptSpy = vi.spyOn(window, 'prompt');

    renderGitManager({
      onRequestRepositoryImport: requestImportSpy,
    });

    await user.click(screen.getByRole('button', { name: 'Pick In Explorer' }));

    expect(requestImportSpy).toHaveBeenCalledTimes(1);
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it('omits large untracked files from inline diffs without reading file contents', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return '?? assets/huge.bin\n';
      }

      if (signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    fsListDirMock.mockResolvedValue([
      { name: 'huge.bin', is_dir: false, size: 256 * 1024 },
    ]);
    fsReadTextFileMock.mockRejectedValue(new Error('should not read large untracked files'));

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('assets/huge.bin');
    await user.click(screen.getByText('assets/huge.bin'));

    await waitFor(() => {
      expect(fsListDirMock).toHaveBeenCalledWith('C:\\repo\\assets', true);
      expect(fsReadTextFileMock).not.toHaveBeenCalled();
    });

    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('git_exec', expect.objectContaining({ args: ['diff', 'HEAD', '--find-renames', '--no-ext-diff', '--', 'assets/huge.bin', 'assets/huge.bin'] }));
  });

  it('discards an untracked file from the selected-file controls after confirmation', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let statusText = '?? notes/todo.txt\n';

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      const payload = args as { repoPath?: string; args?: string[]; path?: string } | undefined;

      if (command === 'fs_read_text_file') {
        if (payload?.path === 'C:\\repo/notes/todo.txt') {
          return 'capture this note';
        }

        throw new Error(`Unexpected file read: ${String(payload?.path)}`);
      }

      if (command !== 'git_exec') {
        return null;
      }

      const repoPath = payload?.repoPath ?? '';
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') {
        return 'C:\\repo\n';
      }

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }

      if (signature === 'clean -fd -- notes/todo.txt') {
        statusText = '';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('notes/todo.txt');
    await user.click(screen.getByText('notes/todo.txt'));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove the untracked file notes/todo.txt? This cannot be undone from GreebleFS.',
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['clean', '-fd', '--', 'notes/todo.txt'],
      });
    });

    expect(await screen.findByText('Working tree is clean.')).toBeInTheDocument();
  });

  it('disables bulk stage and ship actions while conflicts remain unresolved', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return 'UU src/app.ts\n';
      }

      if (signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }

      if (signature === 'diff --cc --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@@ -1,1 -1,1 +1,5 @@@\n';
      }

      if (signature === 'diff HEAD --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@ -1 +1 @@\n-old\n+conflicted\n';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('src/app.ts');
    await user.type(screen.getByPlaceholderText('Commit message for Quick Ship'), 'Should stay blocked');

    expect(screen.getByRole('button', { name: 'Stage All' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Quick Ship/i })).toBeDisabled();
    expect(screen.getByText('Resolve conflicted files with the file-level controls before staging everything or shipping this repo.')).toBeInTheDocument();
  });

  it('marks a conflicted file as resolved by staging the current contents', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    let statusText = 'UU src/app.ts\n';
    let unstagedNumstat = '';
    let stagedNumstat = '';

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff') {
        return unstagedNumstat;
      }

      if (signature === 'diff --cached --numstat --no-ext-diff') {
        return stagedNumstat;
      }

      if (signature === 'diff --cc --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@@ -1,1 -1,1 +1,5 @@@\n';
      }

      if (signature === 'diff HEAD --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@ -1 +1 @@\n-old\n+resolved\n';
      }

      if (signature === 'add -- src/app.ts') {
        statusText = 'M  src/app.ts\n';
        stagedNumstat = '5\t1\tsrc/app.ts\n';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('src/app.ts');
    await user.click(screen.getByText('src/app.ts'));
    expect(await screen.findByRole('button', { name: 'Mark Resolved' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark Resolved' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['add', '--', 'src/app.ts'],
      });
    });

    expect(await screen.findByRole('button', { name: 'Unstage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark Resolved' })).not.toBeInTheDocument();
  });

  it('resolves a conflicted file with the ours version and stages the result', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let statusText = 'UU src/app.ts\n';
    let unstagedNumstat = '';
    let stagedNumstat = '';

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff') {
        return unstagedNumstat;
      }

      if (signature === 'diff --cached --numstat --no-ext-diff') {
        return stagedNumstat;
      }

      if (signature === 'diff --cc --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@@ -1,1 -1,1 +1,5 @@@\n';
      }

      if (signature === 'diff HEAD --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        return '@@ -1 +1 @@\n-old\n+ours\n';
      }

      if (signature === 'checkout --ours -- src/app.ts') {
        return '';
      }

      if (signature === 'add -- src/app.ts') {
        statusText = 'M  src/app.ts\n';
        stagedNumstat = '4\t0\tsrc/app.ts\n';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('src/app.ts');
    await user.click(screen.getByText('src/app.ts'));
    await user.click(await screen.findByRole('button', { name: 'Use Ours' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Resolve the conflict in src/app.ts with our version? GreebleFS will replace the working tree file and stage the result as resolved.',
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['checkout', '--ours', '--', 'src/app.ts'],
      });
    });

    expect(invokeMock).toHaveBeenCalledWith('git_exec', {
      repoPath: 'C:\\repo',
      args: ['add', '--', 'src/app.ts'],
    });
    expect(await screen.findByRole('button', { name: 'Unstage' })).toBeInTheDocument();
  });

  it('resolves delete-side conflicts by staging the selected deletion', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let statusText = 'DU src/obsolete.ts\n';

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }

      if (signature === 'diff --cc --find-renames --no-ext-diff -- src/obsolete.ts src/obsolete.ts') {
        return 'diff --cc src/obsolete.ts\n';
      }

      if (signature === 'rm -- src/obsolete.ts') {
        statusText = '';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('src/obsolete.ts');
    await user.click(screen.getByText('src/obsolete.ts'));
    await user.click(await screen.findByRole('button', { name: 'Use Ours' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Resolve the conflict in src/obsolete.ts by deleting the file with our version? GreebleFS will stage that resolution.',
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['rm', '--', 'src/obsolete.ts'],
      });
    });

    expect(await screen.findByText('Working tree is clean.')).toBeInTheDocument();
  });

  it('falls back to the index when discarding tracked working-tree changes before the first commit', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let statusText = 'AM src/app.ts\n';
    let unstagedNumstat = '2\t0\tsrc/app.ts\n';
    let stagedNumstat = '4\t0\tsrc/app.ts\n';

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'HEAD\n';
      }

      if (signature === 'rev-parse --verify HEAD') {
        throw new Error('fatal: Needed a single revision\n');
      }

      if (gitArgs[0] === 'log') {
        return 'No commits yet\n';
      }

      if (signature === 'status --porcelain') {
        return statusText;
      }

      if (signature === 'diff --numstat --no-ext-diff') {
        return unstagedNumstat;
      }

      if (signature === 'diff --cached --numstat --no-ext-diff') {
        return stagedNumstat;
      }

      if (signature === 'diff HEAD --find-renames --no-ext-diff -- src/app.ts src/app.ts') {
        throw new Error('fatal: bad revision \'HEAD\'\n');
      }

      if (signature === 'checkout-index --force -- src/app.ts') {
        statusText = 'A  src/app.ts\n';
        unstagedNumstat = '';
        stagedNumstat = '4\t0\tsrc/app.ts\n';
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    await screen.findByText('src/app.ts');
    await user.click(screen.getByText('src/app.ts'));
    await user.click(await screen.findByRole('button', { name: 'Discard Working' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Discard only the unstaged changes in src/app.ts? Staged changes will be kept.',
    );

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\repo',
        args: ['checkout-index', '--force', '--', 'src/app.ts'],
      });
    });

    expect(await screen.findByRole('button', { name: 'Unstage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard Working' })).not.toBeInTheDocument();
  });

  it('pauses badge polling while the document is hidden and performs one bounded repo refresh when visible again', async () => {
    const invokeMock = vi.mocked(invoke);
    let visibilityState: DocumentVisibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

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

      if (signature === 'rev-parse --is-inside-work-tree') {
        return 'true\\n';
      }

      if (signature === 'rev-parse --abbrev-ref HEAD') {
        return 'main\\n';
      }

      if (gitArgs[0] === 'log') {
        return 'abc123 - Initial commit (just now)\\n';
      }

      if (signature === 'status --porcelain') {
        return '';
      }

      if (signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') {
        return '';
      }

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    renderGitManager({
      pendingRepositoryImports: ['C:\\repo'],
    });

    const statusCalls = () => invokeMock.mock.calls.filter(([command, args]) => command === 'git_exec' && (args as { args?: string[] } | undefined)?.args?.[0] === 'status').length;
    await waitFor(() => {
      expect(statusCalls()).toBeGreaterThan(0);
    });
    const initialStatusCalls = statusCalls();

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => window.setTimeout(resolve, 0));
    expect(statusCalls()).toBe(initialStatusCalls);

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(statusCalls()).toBe(initialStatusCalls + 1);
    });

    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => window.setTimeout(resolve, 0));
    expect(statusCalls()).toBe(initialStatusCalls + 1);
  });

  it('re-synchronizes once per visibility restore cycle without replaying extra refreshes', async () => {
    const invokeMock = vi.mocked(invoke);
    let visibilityState: DocumentVisibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') return 'C:\\repo\n';
      if (signature === 'rev-parse --is-inside-work-tree') return 'true\n';
      if (signature === 'rev-parse --abbrev-ref HEAD') return 'main\n';
      if (gitArgs[0] === 'log') return 'abc123 - Initial commit (just now)\n';
      if (signature === 'status --porcelain' || signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') return '';

      throw new Error(`Unexpected git_exec call: ${signature}`);
    });

    renderGitManager({ pendingRepositoryImports: ['C:\\repo'] });

    const statusCalls = () => invokeMock.mock.calls.filter(([command, args]) => command === 'git_exec' && (args as { args?: string[] } | undefined)?.args?.[0] === 'status').length;
    await waitFor(() => {
      expect(statusCalls()).toBeGreaterThan(0);
    });
    const initialStatusCalls = statusCalls();

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => window.setTimeout(resolve, 0));

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => {
      expect(statusCalls()).toBe(initialStatusCalls + 1);
    });

    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => window.setTimeout(resolve, 0));
    expect(statusCalls()).toBe(initialStatusCalls + 1);

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(statusCalls()).toBe(initialStatusCalls + 2);
    });
  });

  it('records performance samples for repo-state loads and badge syncs', async () => {
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command !== 'git_exec') {
        return null;
      }

      const payload = args as { repoPath?: string; args?: string[] } | undefined;
      const gitArgs = payload?.args ?? [];
      const signature = gitArgs.join(' ');

      if (signature === 'rev-parse --show-toplevel') return 'C:\\repo\n';
      if (signature === 'rev-parse --is-inside-work-tree') return 'true\n';
      if (signature === 'rev-parse --abbrev-ref HEAD') return 'main\n';
      if (gitArgs[0] === 'log') return 'abc123 - Initial commit (just now)\n';
      if (signature === 'status --porcelain' || signature === 'diff --numstat --no-ext-diff' || signature === 'diff --cached --numstat --no-ext-diff') return '';

      throw new Error(`Unexpected git_exec call: ${signature}`);
    });

    renderGitManager({ pendingRepositoryImports: ['C:\\repo'] });

    await screen.findByText('abc123 - Initial commit (just now)');

    expect(vi.mocked(recordExplorerPerformanceSample)).toHaveBeenCalledWith(
      expect.objectContaining({ metricId: 'git_repo_state_load' }),
    );
    expect(vi.mocked(recordExplorerPerformanceSample)).toHaveBeenCalledWith(
      expect.objectContaining({ metricId: 'git_repo_badge_sync' }),
    );
  });
});
