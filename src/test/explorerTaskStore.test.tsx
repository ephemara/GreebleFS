import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExplorerTaskSnapshot } from '../runtime/explorerBackend';

const retryExplorerTaskMock = vi.fn();
const clearExplorerTaskHistoryMock = vi.fn();
const cancelExplorerTaskMock = vi.fn();

vi.mock('../runtime/explorerBackend', async () => {
  return {
    listExplorerTasks: vi.fn(),
    listenToExplorerTaskProgress: vi.fn(),
    retryExplorerTask: retryExplorerTaskMock,
    clearExplorerTaskHistory: clearExplorerTaskHistoryMock,
    cancelExplorerTask: cancelExplorerTaskMock,
  };
});

import * as storeModule from '../store/explorerTaskStore';

function makeTask(
  id: string,
  status: ExplorerTaskSnapshot['status'],
  overrides: Partial<ExplorerTaskSnapshot> = {},
): ExplorerTaskSnapshot {
  return {
    id,
    kind: 'copy',
    status,
    title: `Task ${id}`,
    detail: `Detail ${id}`,
    progressCurrent: status === 'running' ? 32 : null,
    progressTotal: status === 'running' ? 128 : null,
    startedAt: 1_700_000_000_000,
    finishedAt: status === 'running' ? null : 1_700_000_000_500,
    sourcePaths: [`/tmp/${id}`],
    destinationPath: status === 'succeeded' ? `/tmp/out/${id}` : null,
    errorMessage: status === 'failed' ? `Failed ${id}` : null,
    canRetry: status === 'failed' || status === 'cancelled',
    canCancel: status === 'running',
    canRevealOutput: status === 'succeeded',
    canOpenOutput: status === 'succeeded',
    canUndo: false,
    schedulerTask: null,
    ...overrides,
  };
}

describe('explorerTaskStore', () => {
  beforeEach(() => {
    retryExplorerTaskMock.mockReset();
    clearExplorerTaskHistoryMock.mockReset();
    cancelExplorerTaskMock.mockReset();
    storeModule.useExplorerTaskStore.setState({
      tasks: {},
      taskOrder: [],
      subscriptionState: 'idle',
      subscriptionError: null,
      hydrationState: 'idle',
      hydrationError: null,
      isTaskCenterOpen: false,
    });
  });

  it('keeps active task snapshots sorted ahead of recent history in store state', () => {
    storeModule.useExplorerTaskStore.getState().replaceTasks([
      makeTask('failed-old', 'failed', { startedAt: 10, finishedAt: 20 }),
    ]);

    storeModule.useExplorerTaskStore.getState().upsertTask(
      makeTask('running-new', 'running', { startedAt: 30 }),
    );

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([
      'running-new',
      'failed-old',
    ]);
  });

  it('retries failed tasks, clears completed history, and exposes task-center state helpers', async () => {
    retryExplorerTaskMock.mockResolvedValue(
      makeTask('retry-copy', 'running', { startedAt: 200 }),
    );
    clearExplorerTaskHistoryMock.mockResolvedValue(undefined);

    storeModule.useExplorerTaskStore.getState().replaceTasks([
      makeTask('done-1', 'succeeded', { startedAt: 100, finishedAt: 110 }),
      makeTask('failed-1', 'failed', { startedAt: 120, finishedAt: 130 }),
    ]);

    storeModule.openExplorerTaskCenter();
    expect(storeModule.useExplorerTaskStore.getState().isTaskCenterOpen).toBe(true);

    await storeModule.retryFailedExplorerTasks();

    expect(retryExplorerTaskMock).toHaveBeenCalledWith('failed-1');
    expect(storeModule.useExplorerTaskStore.getState().taskOrder[0]).toBe('retry-copy');

    await storeModule.clearCompletedExplorerTasks();

    expect(clearExplorerTaskHistoryMock).toHaveBeenCalledWith('completed');
    expect(storeModule.useExplorerTaskStore.getState().tasks['done-1']).toBeUndefined();

    storeModule.closeExplorerTaskCenter();
    expect(storeModule.useExplorerTaskStore.getState().isTaskCenterOpen).toBe(false);
  });
});
