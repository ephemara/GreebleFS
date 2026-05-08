import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../runtime/tauriClient', () => ({
  commands: {
    runtimeCall: vi.fn(),
  },
  unwrapTauriResult: vi.fn((value: { status?: string; data?: unknown }) =>
    value?.status === 'ok' ? value.data : value,
  ),
}));

import type { ExecutionContextSnapshot } from '../runtime/externalRuntimeBackend';
import {
  callRuntimeAction,
  createRuntimeActionRunner,
} from '../runtime/externalRuntimeBackend';
import { commands } from '../runtime/tauriClient';

function createExecutionContextSnapshot(
  revision: string,
  selectedPath: string,
): ExecutionContextSnapshot {
  return {
    roots: [],
    activeDirectory: 'D:/GreebleFS',
    cwd: 'D:/GreebleFS',
    focusedEntry: null,
    selectedEntries: [
      {
        path: selectedPath,
        name: selectedPath.split('/').pop() ?? 'selected.txt',
        kind: 'file',
        isDirectory: false,
        extension: 'txt',
      },
    ],
    previewSession: null,
    paneId: 'pane-a',
    workspaceTabId: 'tab-a',
    repoContext: null,
    activeFileType: null,
    revision,
  };
}

describe('externalRuntimeBackend', () => {
  beforeEach(() => {
    vi.mocked(commands.runtimeCall).mockReset();
    vi.mocked(commands.runtimeCall).mockResolvedValue({
      status: 'ok',
      data: {
        runtimeId: 'runtime-a',
        requestId: 'request-1',
        actionId: 'files.stat-selection',
        resultJson: '{"ok":true}',
      },
    });
  });

  it('forwards executionContext through direct runtime calls', async () => {
    const executionContext = createExecutionContextSnapshot(
      'revision-direct',
      'D:/GreebleFS/direct.txt',
    );

    await callRuntimeAction({
      runtimeId: 'runtime-a',
      actionId: 'files.stat-selection',
      executionContext,
    });

    expect(commands.runtimeCall).toHaveBeenCalledWith(expect.objectContaining({
      runtimeId: 'runtime-a',
      actionId: 'files.stat-selection',
      executionContext,
    }));
  });

  it('forwards bound executionContext and allows explicit per-call clearing', async () => {
    const defaultExecutionContext = createExecutionContextSnapshot(
      'revision-default',
      'D:/GreebleFS/default.txt',
    );

    const runAction = createRuntimeActionRunner('runtime-a', 'files.stat-selection', {
      executionContext: defaultExecutionContext,
    });

    await runAction();
    await runAction(undefined, { executionContext: null });

    expect(commands.runtimeCall).toHaveBeenNthCalledWith(1, expect.objectContaining({
      runtimeId: 'runtime-a',
      actionId: 'files.stat-selection',
      executionContext: defaultExecutionContext,
    }));
    expect(commands.runtimeCall).toHaveBeenNthCalledWith(2, expect.objectContaining({
      runtimeId: 'runtime-a',
      actionId: 'files.stat-selection',
      executionContext: null,
    }));
  });
});
