import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { createTestExplorerTransferResult } from './helpers/explorerEntries';

describe('fileOperationsWindow', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    vi.mocked(getCurrentWindow().emit).mockClear();
    vi.mocked(WebviewWindow.getByLabel).mockClear();

    const existingWindow = await WebviewWindow.getByLabel(FILE_OPERATIONS_WINDOW_LABEL);
    if (existingWindow) {
      vi.mocked(existingWindow.show).mockClear();
      vi.mocked(existingWindow.setFocus).mockClear();
    }
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

  it('persists task requests, dispatches browser listeners, and creates a popout window', async () => {
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
    expect(await WebviewWindow.getByLabel(FILE_OPERATIONS_WINDOW_LABEL)).not.toBeNull();
  });

  it('reuses and focuses an existing popout window', async () => {
    await openFileOperationsWindow({ view: 'tasks' });
    const existingWindow = await WebviewWindow.getByLabel(FILE_OPERATIONS_WINDOW_LABEL);
    expect(existingWindow).not.toBeNull();

    vi.mocked(existingWindow!.show).mockClear();
    vi.mocked(existingWindow!.setFocus).mockClear();

    await openFileOperationsWindow({ view: 'tasks' });

    expect(existingWindow?.show).toHaveBeenCalledTimes(1);
    expect(existingWindow?.setFocus).toHaveBeenCalledTimes(1);
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
