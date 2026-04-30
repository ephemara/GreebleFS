import { getCurrentWindow } from '@tauri-apps/api/window';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const secondaryWindowMocks = vi.hoisted(() => ({
  openSecondaryWindow: vi.fn(),
}));

vi.mock('../runtime/secondaryWindows', async () => {
  const actual = await vi.importActual<typeof import('../runtime/secondaryWindows')>(
    '../runtime/secondaryWindows',
  );
  return {
    ...actual,
    openSecondaryWindow: secondaryWindowMocks.openSecondaryWindow,
  };
});

import {
  FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT,
  FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY,
  FILE_OPERATIONS_WINDOW_LABEL,
  FILE_OPERATIONS_WINDOW_REQUEST_EVENT,
  FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY,
  createFileOperationsWindowRequest,
  listenToFileOperationsTransferCompleted,
  listenToFileOperationsWindowRequests,
  openFileOperationsWindow,
  publishFileOperationsTransferCompleted,
  readFileOperationsTransferCompletedEvent,
  readFileOperationsWindowRequest,
} from '../runtime/fileOperationsWindow';
import * as secondaryWindows from '../runtime/secondaryWindows';
import { createTestExplorerTransferResult } from './helpers/explorerEntries';

describe('fileOperationsWindow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getCurrentWindow().emit).mockClear();
    secondaryWindowMocks.openSecondaryWindow.mockReset();
    secondaryWindowMocks.openSecondaryWindow.mockResolvedValue({
      dockTarget: null,
      initialSize: null,
      minSize: null,
      payloadJson: null,
      presentation: 'tool-window',
      sourceWindowLabel: 'main',
      surfaceKind: 'file-operations',
      title: 'File Operations',
      windowId: secondaryWindows.FILE_OPERATIONS_SECONDARY_WINDOW_ID,
      windowLabel: FILE_OPERATIONS_WINDOW_LABEL,
    });
  });

  it('creates normalized task window requests', () => {
    const request = createFileOperationsWindowRequest({
      view: 'tasks',
    });

    expect(request).toMatchObject({
      view: 'tasks',
      sourceWindowLabel: 'main',
    });
    expect(request?.nonce).toBeTruthy();
  });

  it('persists task requests, dispatches browser listeners, and delegates to the shared secondary window manager', async () => {
    const receivedRequests: Array<ReturnType<typeof readFileOperationsWindowRequest>> = [];
    const stopListening = listenToFileOperationsWindowRequests((request) => {
      receivedRequests.push(request);
    });

    const request = await openFileOperationsWindow({ view: 'tasks' });

    stopListening();

    expect(request).toMatchObject({
      view: 'tasks',
    });
    expect(readFileOperationsWindowRequest()).toMatchObject({
      view: 'tasks',
    });
    expect(receivedRequests).toHaveLength(1);
    expect(window.localStorage.getItem(FILE_OPERATIONS_WINDOW_REQUEST_STORAGE_KEY)).toContain('"view":"tasks"');
    expect(vi.mocked(getCurrentWindow().emit)).toHaveBeenCalledWith(
      FILE_OPERATIONS_WINDOW_REQUEST_EVENT,
      expect.objectContaining({ view: 'tasks' }),
    );
    expect(secondaryWindows.openSecondaryWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        windowId: secondaryWindows.FILE_OPERATIONS_SECONDARY_WINDOW_ID,
        surfaceKind: 'file-operations',
        presentation: 'tool-window',
        title: 'File Operations',
        payloadJson: JSON.stringify({ view: 'tasks' }),
      }),
    );
  });

  it('uses the stable file-operations secondary window id across repeated opens', async () => {
    await openFileOperationsWindow({ view: 'tasks' });
    await openFileOperationsWindow({ view: 'tasks' });

    expect(secondaryWindows.openSecondaryWindow).toHaveBeenCalledTimes(2);
    for (const [request] of vi.mocked(secondaryWindows.openSecondaryWindow).mock.calls) {
      expect(request.windowId).toBe(secondaryWindows.FILE_OPERATIONS_SECONDARY_WINDOW_ID);
    }
  });

  it('publishes completed transfer payloads for cross-window listeners', async () => {
    const receivedTransfers: Array<ReturnType<typeof readFileOperationsTransferCompletedEvent>> = [];
    const stopListening = listenToFileOperationsTransferCompleted((detail) => {
      receivedTransfers.push(detail);
    });

    const detail = await publishFileOperationsTransferCompleted({
      operation: 'move',
      sourcePaths: ['/tmp/source-a'],
      targetDir: '/tmp/destination',
      results: [createTestExplorerTransferResult({
        source_path: '/tmp/source-a',
        destination_path: '/tmp/destination/source-a',
        operation: 'move',
        collision_policy: 'keep_both',
        disposition: 'transferred',
      })],
    });

    stopListening();

    expect(detail).toMatchObject({
      operation: 'move',
      sourcePaths: ['/tmp/source-a'],
      targetDir: '/tmp/destination',
      destinationPaths: ['/tmp/destination/source-a'],
      affectedEntries: [
        expect.objectContaining({
          entityId: 'test:/tmp/destination/source-a',
          mutationKind: 'move',
        }),
      ],
    });
    expect(receivedTransfers).toHaveLength(1);
    expect(readFileOperationsTransferCompletedEvent()).toMatchObject({
      operation: 'move',
      targetDir: '/tmp/destination',
      destinationPaths: ['/tmp/destination/source-a'],
    });
    expect(window.localStorage.getItem(FILE_OPERATIONS_TRANSFER_COMPLETED_STORAGE_KEY)).toContain('/tmp/destination/source-a');
    expect(vi.mocked(getCurrentWindow().emit)).toHaveBeenCalledWith(
      FILE_OPERATIONS_TRANSFER_COMPLETED_EVENT,
      expect.objectContaining({ operation: 'move' }),
    );
  });
});
