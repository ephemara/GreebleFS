import { describe, expect, it } from 'vitest';

import {
  YAZI_BINDINGS_MANIFEST,
  events,
  type ExplorerTaskProgressEvent,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';
import {
  didExplorerTaskFail,
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  isExplorerTaskFinished,
  type ExplorerTaskProgress,
} from '../runtime/explorerBackend';

function makeTask(overrides: Partial<YaziSchedulerTaskSnap['prog']>): YaziSchedulerTaskSnap {
  return {
    name: 'Copy assets',
    prog: {
      kind: 'fileCopy',
      totalFiles: 2,
      processedFiles: 1,
      totalBytes: 200,
      processedBytes: 50,
      speed: 0,
      eta: null,
      foundFiles: 2,
      removedFiles: 0,
      processingPath: 'C:/workspace/repo/alpha',
      currentPath: 'C:/workspace/repo/alpha',
      collected: null,
      cleaned: null,
      failedFiles: 0,
      ...overrides,
    },
  };
}

describe('explorer backend Yazi bindings', () => {
  it('keeps the generated explorer task event bound to the native progress channel', () => {
    expect(typeof events.explorerTaskProgressEvent.listen).toBe('function');
    expect(typeof events.explorerTaskProgressEvent.emit).toBe('function');

    const payload: ExplorerTaskProgress = {
      taskId: 'task-1',
      task: makeTask({ processedBytes: 100 }),
    } satisfies ExplorerTaskProgressEvent;

    expect(payload.taskId).toBe('task-1');
    expect(payload.task.prog.kind).toBe('fileCopy');
  });

  it('exports bridged scheduler progress DTOs in the generated Yazi manifest', () => {
    const schedulerEntry = YAZI_BINDINGS_MANIFEST.entries.find(
      entry => entry.crateName === 'yazi-scheduler',
    );

    expect(schedulerEntry).toBeTruthy();
    expect(schedulerEntry?.status).toBe('bridged');
    expect(schedulerEntry?.exportedTypes).toEqual(
      expect.arrayContaining(['YaziSchedulerTaskProg', 'YaziSchedulerTaskSnap']),
    );
  });

  it('derives transfer progress, failure state, and labels from file-copy task snapshots', () => {
    const runningTask = makeTask({ processedBytes: 100, totalBytes: 400 });
    expect(getExplorerTaskProgressPercent(runningTask)).toBe(25);
    expect(didExplorerTaskFail(runningTask)).toBe(false);
    expect(isExplorerTaskFinished(runningTask)).toBe(false);
    expect(getExplorerTaskStatusLabel(runningTask)).toBe('25%');

    const failedTask = makeTask({ collected: false, failedFiles: 1 });
    expect(getExplorerTaskProgressPercent(failedTask)).toBe(0);
    expect(didExplorerTaskFail(failedTask)).toBe(true);
    expect(isExplorerTaskFinished(failedTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(failedTask)).toBe('Failed');

    const collectedTask = makeTask({ processedBytes: 400, totalBytes: 400, cleaned: true });
    expect(getExplorerTaskProgressPercent(collectedTask)).toBe(100);
    expect(isExplorerTaskFinished(collectedTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(collectedTask)).toBe('Done');
  });
});
