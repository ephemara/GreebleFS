import { getCurrentWindow } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EXPLORER_PICKER_REQUEST_EVENT,
  EXPLORER_PICKER_REQUEST_STORAGE_KEY,
  EXPLORER_PICKER_RESULT_EVENT,
  EXPLORER_PICKER_RESULT_STORAGE_KEY,
  EXPLORER_PICKER_WINDOW_LABEL,
  createExplorerPickerRequest,
  listenToExplorerPickerRequests,
  openExplorerPicker,
  publishExplorerPickerResult,
  readExplorerPickerRequest,
  readExplorerPickerResult,
} from '../runtime/explorerPicker';

describe('explorerPicker', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    vi.mocked(getCurrentWindow().emit).mockClear();
    vi.mocked(WebviewWindow.getByLabel).mockClear();

    const existingWindow = await WebviewWindow.getByLabel(EXPLORER_PICKER_WINDOW_LABEL);
    if (existingWindow) {
      vi.mocked(existingWindow.show).mockClear();
      vi.mocked(existingWindow.setFocus).mockClear();
    }
  });

  it('normalizes request defaults and extension filters', () => {
    const request = createExplorerPickerRequest({
      kind: 'openFiles',
      presentation: 'window',
      allowedExtensions: [' TXT ', '.md', '.md'],
    });

    expect(request).toMatchObject({
      allowCreateDirectory: false,
      allowedExtensions: ['txt', 'md'],
      kind: 'openFiles',
      presentation: 'window',
      sourceWindowLabel: 'main',
    });
    expect(request?.nonce).toBeTruthy();
  });

  it('persists window picker requests, dispatches listeners, and opens the picker window', async () => {
    const receivedRequests: Array<ReturnType<typeof readExplorerPickerRequest>> = [];
    const stopListening = listenToExplorerPickerRequests((request) => {
      receivedRequests.push(request);
    });

    const pendingResult = openExplorerPicker({
      kind: 'pickDestinationFolder',
      presentation: 'window',
      title: 'Move To…',
      confirmLabel: 'Move Here',
      startPath: ' /tmp/out ',
    });
    await Promise.resolve();

    const request = readExplorerPickerRequest();
    expect(request).toMatchObject({
      kind: 'pickDestinationFolder',
      presentation: 'window',
      title: 'Move To…',
      confirmLabel: 'Move Here',
      startPath: '/tmp/out',
    });
    expect(receivedRequests).toHaveLength(1);
    expect(window.localStorage.getItem(EXPLORER_PICKER_REQUEST_STORAGE_KEY)).toContain('/tmp/out');
    expect(vi.mocked(getCurrentWindow().emit)).toHaveBeenCalledWith(
      EXPLORER_PICKER_REQUEST_EVENT,
      expect.objectContaining({ kind: 'pickDestinationFolder' }),
    );
    expect(vi.mocked(WebviewWindow.getByLabel)).toHaveBeenCalledWith(
      EXPLORER_PICKER_WINDOW_LABEL,
    );

    await publishExplorerPickerResult({
      currentDirectory: '/tmp/out',
      entries: [{ path: '/tmp/out', name: 'out', kind: 'folder' }],
      nonce: request!.nonce,
    });

    await expect(pendingResult).resolves.toMatchObject({
      currentDirectory: '/tmp/out',
      entries: [{ path: '/tmp/out', name: 'out', kind: 'folder' }],
    });

    stopListening();
  });

  it('returns null for cancelled picker sessions and stores the terminal result', async () => {
    const pendingResult = openExplorerPicker({
      kind: 'saveFile',
      presentation: 'embedded',
      initialFileName: 'report',
      defaultExtension: 'txt',
    });

    const request = readExplorerPickerRequest();
    await publishExplorerPickerResult({
      cancelled: true,
      currentDirectory: '/tmp',
      nonce: request!.nonce,
    });

    await expect(pendingResult).resolves.toBeNull();
    expect(readExplorerPickerResult()).toMatchObject({
      cancelled: true,
      currentDirectory: '/tmp',
    });
    expect(window.localStorage.getItem(EXPLORER_PICKER_RESULT_STORAGE_KEY)).toContain('/tmp');
    expect(vi.mocked(getCurrentWindow().emit)).toHaveBeenCalledWith(
      EXPLORER_PICKER_RESULT_EVENT,
      expect.objectContaining({ cancelled: true }),
    );
  });
});
