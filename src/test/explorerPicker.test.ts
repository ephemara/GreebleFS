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
import * as secondaryWindows from '../runtime/secondaryWindows';

describe('explorerPicker', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getCurrentWindow().emit).mockClear();
    secondaryWindowMocks.openSecondaryWindow.mockReset();
    secondaryWindowMocks.openSecondaryWindow.mockResolvedValue({
      dockTarget: null,
      initialSize: null,
      minSize: null,
      payloadJson: null,
      presentation: 'frameless-widget',
      sourceWindowLabel: 'main',
      surfaceKind: 'explorer-picker',
      title: 'Explorer Picker',
      windowId: secondaryWindows.EXPLORER_PICKER_SECONDARY_WINDOW_ID,
      windowLabel: EXPLORER_PICKER_WINDOW_LABEL,
    });
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

  it('persists window picker requests, dispatches listeners, and delegates to the shared secondary window manager', async () => {
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
    await vi.waitFor(() => {
      expect(secondaryWindows.openSecondaryWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          windowId: secondaryWindows.EXPLORER_PICKER_SECONDARY_WINDOW_ID,
          surfaceKind: 'explorer-picker',
          presentation: 'frameless-widget',
          title: 'Move To…',
          payloadJson: expect.any(String),
        }),
      );
    });

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
