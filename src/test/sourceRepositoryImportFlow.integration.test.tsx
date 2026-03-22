import { useMemo, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { GitManager } from '../components/GitManager';
import { resolveOverlayAppearance } from '../config/appearance';
import { useSettingsStore } from '../store/settingsStore';

function SourceImportFlowHarness() {
  const appearance = useMemo(
    () => resolveOverlayAppearance({ activeThemeId: 'operator' }),
    [],
  );
  const [activePanel, setActivePanel] = useState<'git' | 'explorer'>('git');
  const [pendingRepositoryImports, setPendingRepositoryImports] = useState<string[]>([]);
  const [pickerRequestCount, setPickerRequestCount] = useState(0);

  const handleRequestRepositoryImport = () => {
    setPendingRepositoryImports([]);
    setPickerRequestCount(current => current + 1);
    setActivePanel('explorer');
  };

  const handleConfirmRepositoryImport = () => {
    setPendingRepositoryImports(['C:\\workspace\\repo\\nested']);
    setActivePanel('git');
  };

  const handleRepositoryImportsHandled = () => {
    setPendingRepositoryImports([]);
  };

  return (
    <div>
      <div data-testid="active-panel">{activePanel}</div>
      <div data-testid="pending-imports">{pendingRepositoryImports.join('|')}</div>
      <div data-testid="picker-request-count">{pickerRequestCount}</div>

      {activePanel === 'git' ? (
        <GitManager
          appearance={appearance}
          pendingRepositoryImports={pendingRepositoryImports}
          onPendingRepositoryImportsHandled={handleRepositoryImportsHandled}
          onRequestRepositoryImport={handleRequestRepositoryImport}
        />
      ) : (
        <div>
          <div>Repository Picker Active</div>
          <button type="button" onClick={handleConfirmRepositoryImport}>
            Confirm Nested Repo
          </button>
        </div>
      )}
    </div>
  );
}

describe('Source repository import flow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    vi.mocked(invoke).mockReset();
  });

  it('consumes the app-level repository handoff, normalizes the repo root, and stages a file', async () => {
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
        if (repoPath === 'C:\\workspace\\repo\\nested' || repoPath === 'C:\\workspace\\repo') {
          return 'C:\\workspace\\repo\n';
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

      throw new Error(`Unexpected git_exec call for ${repoPath}: ${signature}`);
    });

    render(<SourceImportFlowHarness />);

    await user.click(screen.getByRole('button', { name: 'Pick In Explorer' }));

    expect(screen.getByTestId('active-panel')).toHaveTextContent('explorer');
    expect(screen.getByTestId('picker-request-count')).toHaveTextContent('1');
    expect(screen.getByText('Repository Picker Active')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm Nested Repo' }));

    expect(screen.getByTestId('active-panel')).toHaveTextContent('git');
    expect(await screen.findByText('abc123 - Initial commit (just now)')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('pending-imports')).toHaveTextContent('');
    });

    expect(JSON.parse(window.localStorage.getItem('overlayterm-git-repos') ?? '[]')).toEqual([
      'C:\\workspace\\repo',
    ]);

    await user.click(screen.getByText('src/app.ts'));
    await user.click(await screen.findByRole('button', { name: 'Stage' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('git_exec', {
        repoPath: 'C:\\workspace\\repo',
        args: ['add', '--', 'src/app.ts'],
      });
    });

    expect(await screen.findByRole('button', { name: 'Unstage' })).toBeInTheDocument();
  });
});
