import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExplorerTaskProgress } from '../runtime/explorerBackend';

function makeTransferTask(
  taskId: string,
  kind: 'fileCopy' | 'fileCut' | 'fileDelete' | 'fileDownload' | 'fileHardlink' | 'fileLink' | 'fileTrash' | 'fileUpload',
  overrides: Partial<ExplorerTaskProgress['task']['prog']> = {},
): ExplorerTaskProgress {
  const progByKind = {
    fileCopy: {
      totalFiles: 1,
      successFiles: 1,
      failedFiles: 0,
      totalBytes: 128,
      processedBytes: 128,
      collected: true,
      cleaned: true,
    },
    fileCut: {
      totalFiles: 1,
      successFiles: 1,
      failedFiles: 0,
      totalBytes: 128,
      processedBytes: 128,
      collected: true,
      cleaned: true,
    },
    fileDelete: {
      totalFiles: 1,
      successFiles: 1,
      failedFiles: 0,
      totalBytes: 128,
      processedBytes: 128,
      collected: true,
      cleaned: true,
    },
    fileDownload: {
      totalFiles: 1,
      successFiles: 1,
      failedFiles: 0,
      totalBytes: 128,
      processedBytes: 128,
      collected: true,
      cleaned: true,
    },
    fileHardlink: {
      total: 1,
      success: 1,
      failed: 0,
      collected: true,
    },
    fileLink: {
      state: true,
    },
    fileTrash: {
      state: true,
      cleaned: true,
    },
    fileUpload: {
      totalFiles: 1,
      successFiles: 1,
      failedFiles: 0,
      totalBytes: 128,
      processedBytes: 128,
      collected: true,
      cleaned: true,
    },
  } satisfies Record<ExplorerTaskProgress['task']['prog']['kind'], ExplorerTaskProgress['task']['prog']>;

  return {
    taskId,
    task: {
      name: `${kind}-task`,
      prog: {
        kind,
        ...progByKind[kind],
        ...overrides,
      },
    },
  };
}

function makeBackgroundTask(
  taskId: string,
  overrides: Partial<ExplorerTaskProgress['task']['prog']> = {},
): ExplorerTaskProgress {
  return {
    taskId,
    task: {
      name: 'plugin-entry-task',
      prog: {
        kind: 'pluginEntry',
        total: 3,
        succ: 3,
        fail: 0,
        found: 3,
        ...overrides,
      },
    },
  };
}

describe('explorerTaskStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-clears completed upload and download tasks after the grace window', async () => {
    let listener: ((taskProgress: ExplorerTaskProgress) => void) | undefined;

    vi.doMock('../runtime/explorerBackend', async () => {
      const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
        '../runtime/explorerBackend',
      );
      return {
        ...actual,
        listenToExplorerTaskProgress: vi.fn(async (nextListener) => {
          listener = nextListener;
          return () => {};
        }),
      };
    });

    const storeModule = await import('../store/explorerTaskStore');
    renderHook(() => {
      storeModule.useExplorerTaskProgressFeed();
      return storeModule.useCurrentExplorerTaskProgress();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(typeof listener).toBe('function');

    listener?.(makeTransferTask('download-1', 'fileDownload'));
    listener?.(makeTransferTask('upload-1', 'fileUpload'));

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([
      'download-1',
      'upload-1',
    ]);

    await vi.advanceTimersByTimeAsync(4_100);

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([]);
    expect(storeModule.useExplorerTaskStore.getState().tasks).toEqual({});
  });

  it('auto-clears completed link, hardlink, and trash tasks after the grace window', async () => {
    let listener: ((taskProgress: ExplorerTaskProgress) => void) | undefined;

    vi.doMock('../runtime/explorerBackend', async () => {
      const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
        '../runtime/explorerBackend',
      );
      return {
        ...actual,
        listenToExplorerTaskProgress: vi.fn(async (nextListener) => {
          listener = nextListener;
          return () => {};
        }),
      };
    });

    const storeModule = await import('../store/explorerTaskStore');
    renderHook(() => {
      storeModule.useExplorerTaskProgressFeed();
      return storeModule.useCurrentExplorerTaskProgress();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(typeof listener).toBe('function');

    listener?.(makeTransferTask('link-1', 'fileLink'));
    listener?.(makeTransferTask('hardlink-1', 'fileHardlink'));
    listener?.(makeTransferTask('trash-1', 'fileTrash'));

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([
      'link-1',
      'hardlink-1',
      'trash-1',
    ]);

    await vi.advanceTimersByTimeAsync(4_100);

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([]);
    expect(storeModule.useExplorerTaskStore.getState().tasks).toEqual({});
  });

  it('auto-clears failed link, hardlink, and trash tasks after the grace window', async () => {
    let listener: ((taskProgress: ExplorerTaskProgress) => void) | undefined;

    vi.doMock('../runtime/explorerBackend', async () => {
      const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
        '../runtime/explorerBackend',
      );
      return {
        ...actual,
        listenToExplorerTaskProgress: vi.fn(async (nextListener) => {
          listener = nextListener;
          return () => {};
        }),
      };
    });

    const storeModule = await import('../store/explorerTaskStore');
    renderHook(() => {
      storeModule.useExplorerTaskProgressFeed();
      return storeModule.useCurrentExplorerTaskProgress();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(typeof listener).toBe('function');

    listener?.(makeTransferTask('link-failed', 'fileLink', { state: false }));
    listener?.(makeTransferTask('hardlink-failed', 'fileHardlink', { collected: false, failed: 1 }));
    listener?.(makeTransferTask('trash-failed', 'fileTrash', { state: false, cleaned: false }));

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([
      'link-failed',
      'hardlink-failed',
      'trash-failed',
    ]);

    await vi.advanceTimersByTimeAsync(4_100);

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([]);
    expect(storeModule.useExplorerTaskStore.getState().tasks).toEqual({});
  });

  it('keeps active upload work visible until the transfer reports completion', async () => {
    let listener: ((taskProgress: ExplorerTaskProgress) => void) | undefined;

    vi.doMock('../runtime/explorerBackend', async () => {
      const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
        '../runtime/explorerBackend',
      );
      return {
        ...actual,
        listenToExplorerTaskProgress: vi.fn(async (nextListener) => {
          listener = nextListener;
          return () => {};
        }),
      };
    });

    const storeModule = await import('../store/explorerTaskStore');
    renderHook(() => {
      storeModule.useExplorerTaskProgressFeed();
      return storeModule.useCurrentExplorerTaskProgress();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(typeof listener).toBe('function');

    listener?.(makeTransferTask('upload-live', 'fileUpload', {
      processedBytes: 64,
      collected: null,
      cleaned: null,
    }));

    await vi.advanceTimersByTimeAsync(4_100);
    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual(['upload-live']);

    listener?.(makeTransferTask('upload-live', 'fileUpload'));
    await vi.advanceTimersByTimeAsync(4_100);

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([]);
  });

  it('cancels a pending auto-clear when a finished transfer becomes active again', async () => {
    let listener: ((taskProgress: ExplorerTaskProgress) => void) | undefined;

    vi.doMock('../runtime/explorerBackend', async () => {
      const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
        '../runtime/explorerBackend',
      );
      return {
        ...actual,
        listenToExplorerTaskProgress: vi.fn(async (nextListener) => {
          listener = nextListener;
          return () => {};
        }),
      };
    });

    const storeModule = await import('../store/explorerTaskStore');
    renderHook(() => {
      storeModule.useExplorerTaskProgressFeed();
      return storeModule.useCurrentExplorerTaskProgress();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(typeof listener).toBe('function');

    listener?.(makeTransferTask('download-flap', 'fileDownload'));

    await vi.advanceTimersByTimeAsync(2_000);
    listener?.(makeTransferTask('download-flap', 'fileDownload', {
      processedBytes: 32,
      totalBytes: 128,
      collected: null,
      cleaned: null,
    }));

    await vi.advanceTimersByTimeAsync(2_500);
    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual(['download-flap']);

    listener?.(makeTransferTask('download-flap', 'fileDownload'));
    await vi.advanceTimersByTimeAsync(4_100);

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual([]);
  });

  it('keeps non-transfer scheduler progress visible instead of auto-clearing it', async () => {
    let listener: ((taskProgress: ExplorerTaskProgress) => void) | undefined;

    vi.doMock('../runtime/explorerBackend', async () => {
      const actual = await vi.importActual<typeof import('../runtime/explorerBackend')>(
        '../runtime/explorerBackend',
      );
      return {
        ...actual,
        listenToExplorerTaskProgress: vi.fn(async (nextListener) => {
          listener = nextListener;
          return () => {};
        }),
      };
    });

    const storeModule = await import('../store/explorerTaskStore');
    renderHook(() => {
      storeModule.useExplorerTaskProgressFeed();
      return storeModule.useCurrentExplorerTaskProgress();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(typeof listener).toBe('function');

    listener?.(makeBackgroundTask('plugin-entry-1'));
    await vi.advanceTimersByTimeAsync(4_100);

    expect(storeModule.useExplorerTaskStore.getState().taskOrder).toEqual(['plugin-entry-1']);
    expect(storeModule.useExplorerTaskStore.getState().tasks['plugin-entry-1']?.task.prog.kind).toBe(
      'pluginEntry',
    );
  });
});
