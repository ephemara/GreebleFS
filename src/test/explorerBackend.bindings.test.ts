import { describe, expect, it, vi } from 'vitest';
import * as TauriEvent from '@tauri-apps/api/event';

import {
  YAZI_BINDINGS_MANIFEST,
  commands,
  events,
  type ExplorerTaskProgressEvent,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';
import {
  cancelExplorerSearchEntries,
  didExplorerTaskFail,
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  isExplorerTaskFinished,
  listenToExplorerTaskProgress,
  searchExplorerEntriesWithDiagnostics,
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

  it('forwards explorer task event payloads through the runtime listener bridge', async () => {
    const unlisten = vi.fn();
    const eventPayload: ExplorerTaskProgress = {
      taskId: 'task-bridge',
      task: makeTask({ kind: 'fileUpload', processedBytes: 200, totalBytes: 400 }),
    };
    const listener = vi.fn();
    const listenSpy = vi.spyOn(TauriEvent, 'listen').mockImplementationOnce(
      async (_eventName: string, callback: (event: { payload: ExplorerTaskProgress }) => void) => {
        callback({ payload: eventPayload });
        return unlisten;
      },
    );

    const dispose = await listenToExplorerTaskProgress(listener);

    expect(listenSpy).toHaveBeenCalledWith('explorer-task-progress-event', expect.any(Function));
    expect(listener).toHaveBeenCalledWith(eventPayload);

    dispose();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('keeps scheduler manifest coverage on transfer and background progress variants', () => {
    const schedulerEntry = YAZI_BINDINGS_MANIFEST.entries.find(
      entry => entry.crateName === 'yazi-scheduler',
    );

    expect(schedulerEntry?.exportedTypes).toEqual(
      expect.arrayContaining([
        'YaziSchedulerFileProgCopy',
        'YaziSchedulerFileProgCut',
        'YaziSchedulerFileProgDelete',
        'YaziSchedulerFileProgDownload',
        'YaziSchedulerFileProgUpload',
        'YaziSchedulerPluginProgEntry',
      ]),
    );
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

  it('keeps generated explorer runtime commands aligned with search, watcher, and transfer flows', () => {
    expect(typeof commands.fsSearchEntriesWithDiagnostics).toBe('function');
    expect(typeof commands.fsCancelSearchEntries).toBe('function');
    expect(typeof commands.fsWatchEntrySizeRoot).toBe('function');
    expect(typeof commands.fsUnwatchEntrySizeRoot).toBe('function');
    expect(typeof commands.fsTransferItems).toBe('function');

    const watcherEntry = YAZI_BINDINGS_MANIFEST.entries.find(
      entry => entry.crateName === 'yazi-watcher',
    );
    expect(watcherEntry?.status).toBe('planned');
  });

  it('forwards recursive search and scoped cancel arguments through the generated Tauri contract', async () => {
    const searchSpy = vi.spyOn(commands, 'fsSearchEntriesWithDiagnostics').mockResolvedValue({
      status: 'ok',
      data: {
        results: [],
        diagnostics: {
          executionStrategy: 'live_scan',
          contentCacheStatus: 'not_requested',
          scannedEntryCount: 0,
          indexedEntryCount: 0,
          contentCacheStoredFileCount: 0,
          contentCacheStoredByteCount: 0,
          truncatedByScanBudget: false,
        },
      },
    });
    const cancelSpy = vi.spyOn(commands, 'fsCancelSearchEntries').mockResolvedValue({
      status: 'ok',
      data: null,
    });

    await searchExplorerEntriesWithDiagnostics({
      path: 'C:/workspace/repo',
      query: 'needle',
      showHidden: true,
      includeContent: true,
      limit: 250,
      requestId: 42,
      requestScope: 'file-explorer:r42',
    });
    await cancelExplorerSearchEntries({
      path: 'C:/workspace/repo',
      requestId: 43,
      requestScope: 'file-explorer:r42',
    });

    expect(searchSpy).toHaveBeenCalledWith(
      'C:/workspace/repo',
      'needle',
      true,
      true,
      250,
      42,
      'file-explorer:r42',
    );
    expect(cancelSpy).toHaveBeenCalledWith('C:/workspace/repo', 43, 'file-explorer:r42');
  });

  it('forwards omitted search and cancel scope arguments as nulls through the generated Tauri contract', async () => {
    const searchSpy = vi.spyOn(commands, 'fsSearchEntriesWithDiagnostics').mockResolvedValue({
      status: 'ok',
      data: {
        results: [],
        diagnostics: {
          executionStrategy: 'live_scan',
          contentCacheStatus: 'not_requested',
          scannedEntryCount: 0,
          indexedEntryCount: 0,
          contentCacheStoredFileCount: 0,
          contentCacheStoredByteCount: 0,
          truncatedByScanBudget: false,
        },
      },
    });
    const cancelSpy = vi.spyOn(commands, 'fsCancelSearchEntries').mockResolvedValue({
      status: 'ok',
      data: null,
    });

    await searchExplorerEntriesWithDiagnostics({
      path: 'C:/workspace/repo',
      query: 'needle',
      showHidden: false,
    });
    await cancelExplorerSearchEntries({
      path: 'C:/workspace/repo',
    });

    expect(searchSpy).toHaveBeenCalledWith(
      'C:/workspace/repo',
      'needle',
      false,
      false,
      null,
      null,
      null,
    );
    expect(cancelSpy).toHaveBeenCalledWith('C:/workspace/repo', null, null);
  });

  it('derives transfer progress, failure state, and labels from file-copy task snapshots', () => {
    const runningTask = makeTask({ processedBytes: 100, totalBytes: 400 });
    expect(getExplorerTaskProgressPercent(runningTask)).toBe(25);
    expect(didExplorerTaskFail(runningTask)).toBe(false);
    expect(isExplorerTaskFinished(runningTask)).toBe(false);
    expect(getExplorerTaskStatusLabel(runningTask)).toBe('25%');

    const failedTask = makeTask({ collected: false, failedFiles: 1 });
    expect(getExplorerTaskProgressPercent(failedTask)).toBe(25);
    expect(didExplorerTaskFail(failedTask)).toBe(true);
    expect(isExplorerTaskFinished(failedTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(failedTask)).toBe('Failed');

    const collectedTask = makeTask({ processedBytes: 400, totalBytes: 400, cleaned: true });
    expect(getExplorerTaskProgressPercent(collectedTask)).toBe(100);
    expect(isExplorerTaskFinished(collectedTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(collectedTask)).toBe('Done');
  });

  it('keeps cut/delete scheduler semantics aligned for zero-byte completion and non-transfer work', () => {
    const deleteTask = makeTask({
      kind: 'fileDelete',
      totalBytes: 0,
      processedBytes: 0,
      cleaned: true,
      collected: true,
    });
    expect(getExplorerTaskProgressPercent(deleteTask)).toBe(100);
    expect(didExplorerTaskFail(deleteTask)).toBe(false);
    expect(isExplorerTaskFinished(deleteTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(deleteTask)).toBe('Done');

    const backgroundTask = {
      name: 'Warm preview cache',
      prog: {
        kind: 'pluginEntry',
        total: 4,
        succ: 1,
        fail: 0,
        found: 4,
      },
    } satisfies YaziSchedulerTaskSnap;
    expect(getExplorerTaskProgressPercent(backgroundTask)).toBeNull();
    expect(didExplorerTaskFail(backgroundTask)).toBe(false);
    expect(isExplorerTaskFinished(backgroundTask)).toBe(false);
    expect(getExplorerTaskStatusLabel(backgroundTask)).toBe('Working…');
  });

  it('treats upload and download scheduler variants like transfer work for progress and completion', () => {
    const downloadTask = makeTask({
      kind: 'fileDownload',
      totalBytes: 400,
      processedBytes: 100,
      collected: null,
      cleaned: null,
    });
    expect(getExplorerTaskProgressPercent(downloadTask)).toBe(25);
    expect(didExplorerTaskFail(downloadTask)).toBe(false);
    expect(isExplorerTaskFinished(downloadTask)).toBe(false);
    expect(getExplorerTaskStatusLabel(downloadTask)).toBe('25%');

    const uploadTask = makeTask({
      kind: 'fileUpload',
      totalBytes: 120,
      processedBytes: 120,
      collected: true,
      cleaned: true,
    });
    expect(getExplorerTaskProgressPercent(uploadTask)).toBe(100);
    expect(didExplorerTaskFail(uploadTask)).toBe(false);
    expect(isExplorerTaskFinished(uploadTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(uploadTask)).toBe('Done');
  });

  it('marks zero-byte transfer failures as failed work instead of leaving them indeterminate', () => {
    const failedDelete = makeTask({
      kind: 'fileDelete',
      totalBytes: 0,
      processedBytes: 0,
      failedFiles: 2,
      cleaned: false,
      collected: null,
    });

    expect(getExplorerTaskProgressPercent(failedDelete)).toBe(0);
    expect(didExplorerTaskFail(failedDelete)).toBe(true);
    expect(isExplorerTaskFinished(failedDelete)).toBe(true);
    expect(getExplorerTaskStatusLabel(failedDelete)).toBe('Failed');
  });

  it('treats cleaned cut tasks as finished even when collection metadata stays null', () => {
    const finishedCut = makeTask({
      kind: 'fileCut',
      totalBytes: 512,
      processedBytes: 512,
      cleaned: true,
      collected: null,
    });

    expect(getExplorerTaskProgressPercent(finishedCut)).toBe(100);
    expect(didExplorerTaskFail(finishedCut)).toBe(false);
    expect(isExplorerTaskFinished(finishedCut)).toBe(true);
    expect(getExplorerTaskStatusLabel(finishedCut)).toBe('Done');
  });

  it('keeps the generated Yazi binding manifest pinned to the phase-1 migration envelope', () => {
    expect(YAZI_BINDINGS_MANIFEST.version).toBe('phase-1');

    const watcherEntry = YAZI_BINDINGS_MANIFEST.entries.find(
      entry => entry.crateName === 'yazi-watcher',
    );

    expect(watcherEntry?.notes).toContain('watcher event bridge surface planned');
    expect(watcherEntry?.exportedTypes).toEqual([]);
  });
});
