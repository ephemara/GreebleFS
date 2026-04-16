import { describe, expect, it, vi } from 'vitest';
import {
  YAZI_BINDINGS_MANIFEST,
  events,
  type ExplorerTaskProgressEvent,
  type ExplorerTaskRecord,
  type YaziSchedulerTaskProg,
  type YaziSchedulerTaskSnap,
} from '../generated/tauri';
import {
  cancelExplorerSearchEntries,
  cancelExplorerTask,
  clearExplorerTaskHistory,
  extractExplorerArchive,
  didExplorerTaskFail,
  getExplorerTaskProgressPercent,
  getExplorerTaskStatusLabel,
  isExplorerTaskFinished,
  listExplorerTasks,
  listenToExplorerTaskProgress,
  openExplorerArchive,
  retryExplorerTask,
  searchExplorerEntriesWithDiagnostics,
  type ExplorerTaskProgress,
} from '../runtime/explorerBackend';
import { commands } from '../runtime/tauriClient';

function makeSchedulerTask(
  overrides: Partial<Extract<YaziSchedulerTaskProg, { kind: 'fileCopy' }>> = {},
): YaziSchedulerTaskSnap {
  return {
    name: 'Copy assets',
    prog: {
      kind: 'fileCopy',
      totalFiles: 2,
      successFiles: 1,
      failedFiles: 0,
      totalBytes: 200,
      processedBytes: 50,
      collected: null,
      cleaned: null,
      ...overrides,
    } satisfies Extract<YaziSchedulerTaskProg, { kind: 'fileCopy' }>,
  };
}

function makeTaskRecord(
  status: ExplorerTaskRecord['status'],
  overrides: Partial<ExplorerTaskRecord> = {},
): ExplorerTaskRecord {
  return {
    id: 'task-1',
    kind: 'copy',
    status,
    title: 'Copy assets',
    detail: 'C:/workspace/repo -> C:/workspace/out',
    progressCurrent: status === 'running' ? 50 : null,
    progressTotal: status === 'running' ? 200 : null,
    startedAt: 1_700_000_000_000,
    finishedAt: status === 'running' ? null : 1_700_000_000_500,
    sourcePaths: ['C:/workspace/repo/alpha'],
    destinationPath: status === 'succeeded' ? 'C:/workspace/out' : null,
    errorMessage: status === 'failed' ? 'Permission denied' : null,
    canRetry: status === 'failed' || status === 'cancelled',
    canCancel: status === 'running',
    canRevealOutput: status === 'succeeded',
    canOpenOutput: status === 'succeeded',
    canUndo: false,
    schedulerTask: status === 'running' ? makeSchedulerTask() : null,
    ...overrides,
  };
}

describe('explorer backend task bindings', () => {
  it('keeps the generated explorer task event bound to the native task channel', () => {
    expect(typeof events.explorerTaskProgressEvent.listen).toBe('function');
    expect(typeof events.explorerTaskProgressEvent.emit).toBe('function');
    expect(typeof commands.fsListExplorerTasks).toBe('function');
    expect(typeof commands.fsClearExplorerTaskHistory).toBe('function');
    expect(typeof commands.fsRetryExplorerTask).toBe('function');
    expect(typeof commands.fsCancelExplorerTask).toBe('function');

    const payload: ExplorerTaskProgress = {
      taskId: 'task-1',
      task: makeTaskRecord('running'),
    } satisfies ExplorerTaskProgressEvent;

    expect(payload.task.status).toBe('running');
    expect(payload.task.kind).toBe('copy');
  });

  it('exposes a runtime listener bridge for explorer task events', () => {
    expect(typeof events.explorerTaskProgressEvent.listen).toBe('function');
    expect(typeof listenToExplorerTaskProgress).toBe('function');
  });

  it('exports explorer task runtime helpers alongside the generated task commands', () => {
    expect(typeof commands.fsListExplorerTasks).toBe('function');
    expect(typeof commands.fsClearExplorerTaskHistory).toBe('function');
    expect(typeof commands.fsRetryExplorerTask).toBe('function');
    expect(typeof commands.fsCancelExplorerTask).toBe('function');
    expect(typeof commands.fsOpenArchive).toBe('function');
    expect(typeof commands.fsExtractArchive).toBe('function');
    expect(typeof commands.videoResolvePreviewSource).toBe('function');
    expect(typeof commands.videoCreatePreviewProxy).toBe('function');
    expect(typeof listExplorerTasks).toBe('function');
    expect(typeof clearExplorerTaskHistory).toBe('function');
    expect(typeof retryExplorerTask).toBe('function');
    expect(typeof cancelExplorerTask).toBe('function');
    expect(typeof openExplorerArchive).toBe('function');
    expect(typeof extractExplorerArchive).toBe('function');
  });

  it('forwards archive open and extraction requests through the generated Tauri contract', async () => {
    const openSpy = vi.spyOn(commands, 'fsOpenArchive').mockResolvedValue({
      status: 'ok',
      data: {
        outputPath: '/tmp/archive-open/demo',
        extractedEntryCount: 3,
        reusedCachedOutput: false,
      },
    });
    const extractSpy = vi.spyOn(commands, 'fsExtractArchive').mockResolvedValue({
      status: 'ok',
      data: {
        outputPath: '/tmp/archive-open/demo',
        extractedEntryCount: 3,
        reusedCachedOutput: false,
      },
    });

    const openResult = await openExplorerArchive('/tmp/demo.zip');
    const extractResult = await extractExplorerArchive({
      archivePath: '/tmp/demo.zip',
      mode: 'extractToNewFolder',
    });

    expect(openSpy).toHaveBeenCalledWith('/tmp/demo.zip');
    expect(extractSpy).toHaveBeenCalledWith({
      archivePath: '/tmp/demo.zip',
      mode: 'extractToNewFolder',
    });
    expect(openResult.outputPath).toBe('/tmp/archive-open/demo');
    expect(extractResult.extractedEntryCount).toBe(3);
  });

  it('preserves scoped search and cancel argument forwarding through the generated Tauri contract', async () => {
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

  it('derives progress, failure state, and labels from scheduler snapshots and durable task snapshots', () => {
    const runningSchedulerTask = makeSchedulerTask({ processedBytes: 100, totalBytes: 400 });
    expect(getExplorerTaskProgressPercent(runningSchedulerTask)).toBe(25);
    expect(didExplorerTaskFail(runningSchedulerTask)).toBe(false);
    expect(isExplorerTaskFinished(runningSchedulerTask)).toBe(false);
    expect(getExplorerTaskStatusLabel(runningSchedulerTask)).toBe('25%');

    const failedSchedulerTask = makeSchedulerTask({ collected: false, failedFiles: 1 });
    expect(didExplorerTaskFail(failedSchedulerTask)).toBe(true);
    expect(isExplorerTaskFinished(failedSchedulerTask)).toBe(true);
    expect(getExplorerTaskStatusLabel(failedSchedulerTask)).toBe('Failed');

    const runningSnapshot = makeTaskRecord('running');
    expect(getExplorerTaskProgressPercent(runningSnapshot)).toBe(25);
    expect(didExplorerTaskFail(runningSnapshot)).toBe(false);
    expect(isExplorerTaskFinished(runningSnapshot)).toBe(false);
    expect(getExplorerTaskStatusLabel(runningSnapshot)).toBe('25%');

    const failedSnapshot = makeTaskRecord('failed');
    expect(getExplorerTaskProgressPercent(failedSnapshot)).toBeNull();
    expect(didExplorerTaskFail(failedSnapshot)).toBe(true);
    expect(isExplorerTaskFinished(failedSnapshot)).toBe(true);
    expect(getExplorerTaskStatusLabel(failedSnapshot)).toBe('Failed');

    const cancelledSnapshot = makeTaskRecord('cancelled');
    expect(getExplorerTaskStatusLabel(cancelledSnapshot)).toBe('Cancelled');

    const succeededSnapshot = makeTaskRecord('succeeded');
    expect(getExplorerTaskStatusLabel(succeededSnapshot)).toBe('Done');
  });

  it('keeps generated scheduler bindings and the phase-1 manifest envelope intact', () => {
    const schedulerEntry = YAZI_BINDINGS_MANIFEST.entries.find(
      (entry) => entry.crateName === 'yazi-scheduler',
    );

    expect(YAZI_BINDINGS_MANIFEST.version).toBe('phase-1');
    expect(schedulerEntry?.status).toBe('bridged');
    expect(schedulerEntry?.exportedTypes).toEqual(
      expect.arrayContaining(['YaziSchedulerTaskProg', 'YaziSchedulerTaskSnap']),
    );
  });
});
