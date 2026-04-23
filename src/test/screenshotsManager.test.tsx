import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useImperativeHandle } from 'react';
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
} from '@tauri-apps/api/window';
import type { Monitor as TauriMonitor } from '@tauri-apps/api/window';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScreenshotsManager } from '../components/ScreenshotsManager';
import { joinPlatformPath } from '../config/platform';
import { screenshotFeatureConfig } from '../config/screenshots';
import { useSettingsStore } from '../store/settingsStore';

const {
  listScreenshotableMonitorsMock,
  captureScreenshotMonitorMock,
  removeScreenshotMonitorCaptureMock,
  clearScreenshotPluginCapturesMock,
  prepareScreenshotStageMock,
  finalizeScreenshotStageMock,
  deleteScreenshotStageMock,
  copyScreenshotImageToClipboardMock,
  createExplorerDirMock,
  deleteExplorerPathMock,
  listExplorerDirMock,
  openExplorerPathMock,
  readExplorerImageThumbnailMock,
  revealExplorerPathMock,
  editorSaveMock,
  editorHasUnsavedChangesMock,
} = vi.hoisted(() => ({
  listScreenshotableMonitorsMock: vi.fn(),
  captureScreenshotMonitorMock: vi.fn(),
  removeScreenshotMonitorCaptureMock: vi.fn(),
  clearScreenshotPluginCapturesMock: vi.fn(),
  prepareScreenshotStageMock: vi.fn(),
  finalizeScreenshotStageMock: vi.fn(),
  deleteScreenshotStageMock: vi.fn(),
  copyScreenshotImageToClipboardMock: vi.fn(),
  createExplorerDirMock: vi.fn(),
  deleteExplorerPathMock: vi.fn(),
  listExplorerDirMock: vi.fn(),
  openExplorerPathMock: vi.fn(),
  readExplorerImageThumbnailMock: vi.fn(),
  revealExplorerPathMock: vi.fn(),
  editorSaveMock: vi.fn(),
  editorHasUnsavedChangesMock: vi.fn(),
}));

vi.mock('../runtime/screenshotBackend', () => ({
  listScreenshotableMonitors: listScreenshotableMonitorsMock,
  captureScreenshotMonitor: captureScreenshotMonitorMock,
  removeScreenshotMonitorCapture: removeScreenshotMonitorCaptureMock,
  clearScreenshotPluginCaptures: clearScreenshotPluginCapturesMock,
  prepareScreenshotStage: prepareScreenshotStageMock,
  finalizeScreenshotStage: finalizeScreenshotStageMock,
  deleteScreenshotStage: deleteScreenshotStageMock,
  copyScreenshotImageToClipboard: copyScreenshotImageToClipboardMock,
  buildScreenshotAssetUrl: (path: string, revision?: number | string) =>
    `asset://localhost/${path}${revision == null ? '' : `?v=${revision}`}`,
}));

vi.mock('../runtime/explorerBackend', () => ({
  createExplorerDir: createExplorerDirMock,
  deleteExplorerPath: deleteExplorerPathMock,
  listExplorerDir: listExplorerDirMock,
  openExplorerPath: openExplorerPathMock,
  readExplorerImageThumbnail: readExplorerImageThumbnailMock,
  revealExplorerPath: revealExplorerPathMock,
}));

vi.mock('../components/ExplorerImageEditor', () => ({
  ExplorerImageEditor: forwardRef(function MockExplorerImageEditor(
    props: { imagePath: string },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      save: editorSaveMock,
      hasUnsavedChanges: editorHasUnsavedChangesMock,
      resetToSavedState: vi.fn(),
    }));

    return <div data-testid="mock-shared-editor">{props.imagePath}</div>;
  }),
}));

const DEFAULT_MONITOR = {
  name: 'Primary Display',
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  scaleFactor: 1,
  workArea: {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
  },
} as unknown as TauriMonitor;

function makeGalleryEntry(name: string) {
  return {
    name,
    path: joinPlatformPath(screenshotFeatureConfig.defaultSaveDirectory, name),
    is_dir: false,
    size: 2048,
    modified: Date.UTC(2026, 2, 22, 10, 30, 0),
    extension: 'png',
    is_hidden: false,
    is_symlink: false,
  };
}

class MockImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  width = 1920;
  height = 1080;
  naturalWidth = 1920;
  naturalHeight = 1080;

  private _src = '';

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }

  get src(): string {
    return this._src;
  }
}

const originalImageDescriptor = Object.getOwnPropertyDescriptor(window, 'Image');

function installImageMock(): void {
  Object.defineProperty(window, 'Image', {
    configurable: true,
    writable: true,
    value: MockImage as unknown as typeof Image,
  });
}

function restoreImageMock(): void {
  if (originalImageDescriptor) {
    Object.defineProperty(window, 'Image', originalImageDescriptor);
    return;
  }

  Reflect.deleteProperty(window, 'Image');
}

describe('ScreenshotsManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    installImageMock();

    vi.mocked(availableMonitors).mockResolvedValue([DEFAULT_MONITOR]);
    vi.mocked(currentMonitor).mockResolvedValue(DEFAULT_MONITOR);
    vi.mocked(primaryMonitor).mockResolvedValue(DEFAULT_MONITOR);

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 960,
        bottom: 540,
        width: 960,
        height: 540,
        toJSON: () => ({}),
      }),
    });

    listScreenshotableMonitorsMock.mockReset();
    captureScreenshotMonitorMock.mockReset();
    removeScreenshotMonitorCaptureMock.mockReset();
    clearScreenshotPluginCapturesMock.mockReset();
    prepareScreenshotStageMock.mockReset();
    finalizeScreenshotStageMock.mockReset();
    deleteScreenshotStageMock.mockReset();
    copyScreenshotImageToClipboardMock.mockReset();
    createExplorerDirMock.mockReset();
    deleteExplorerPathMock.mockReset();
    listExplorerDirMock.mockReset();
    openExplorerPathMock.mockReset();
    readExplorerImageThumbnailMock.mockReset();
    revealExplorerPathMock.mockReset();
    editorSaveMock.mockReset();
    editorHasUnsavedChangesMock.mockReset();

    listScreenshotableMonitorsMock.mockResolvedValue([
      { id: 1, name: 'Primary Display' },
    ]);
    captureScreenshotMonitorMock.mockResolvedValue(
      '/tmp/tauri-plugin-screenshots/monitor-1.png',
    );
    removeScreenshotMonitorCaptureMock.mockResolvedValue(undefined);
    clearScreenshotPluginCapturesMock.mockResolvedValue(undefined);
    prepareScreenshotStageMock.mockResolvedValue({
      path: '/tmp/tauri-plugin-screenshots/stage-1.png',
      imageWidth: 1920,
      imageHeight: 1080,
    });
    deleteScreenshotStageMock.mockResolvedValue(undefined);
    finalizeScreenshotStageMock.mockResolvedValue({
      path: joinPlatformPath(
        screenshotFeatureConfig.defaultSaveDirectory,
        'overlayterm-shot-monitor.png',
      ),
      file_name: 'overlayterm-shot-monitor.png',
      created_at: Date.UTC(2026, 2, 22, 11, 0, 0),
    });
    createExplorerDirMock.mockResolvedValue(undefined);
    deleteExplorerPathMock.mockResolvedValue(undefined);
    openExplorerPathMock.mockResolvedValue(undefined);
    revealExplorerPathMock.mockResolvedValue(undefined);
    readExplorerImageThumbnailMock.mockResolvedValue('data:image/png;base64,ZmFrZQ==');
    editorSaveMock.mockResolvedValue(true);
    editorHasUnsavedChangesMock.mockReturnValue(false);
  });

  afterEach(() => {
    restoreImageMock();
  });

  it('deletes a gallery item after confirmation and refreshes the library', async () => {
    const user = userEvent.setup();
    const screenshot = makeGalleryEntry('overlayterm-shot-a.png');
    let galleryEntries = [screenshot];

    listExplorerDirMock.mockImplementation(async () => galleryEntries);
    deleteExplorerPathMock.mockImplementation(async (path: string) => {
      expect(path).toBe(screenshot.path);
      galleryEntries = [];
    });

    render(<ScreenshotsManager />);

    expect(await screen.findByText(screenshot.name)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(
        `Delete ${screenshot.name} from the screenshot library?`,
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteExplorerPathMock).toHaveBeenCalledWith(screenshot.path, false);
    });

    expect(await screen.findByText(`Deleted ${screenshot.name}.`)).toBeInTheDocument();
    expect(await screen.findByText('No screenshots yet.')).toBeInTheDocument();
  });

  it('auto-enters full monitor editing and saves through the shared editor flow', async () => {
    const user = userEvent.setup();
    const savedScreenshot = makeGalleryEntry('overlayterm-shot-monitor.png');
    let galleryEntries: ReturnType<typeof makeGalleryEntry>[] = [];

    useSettingsStore.getState().updateScreenshots({
      defaultCaptureMode: 'monitor',
      defaultOutputAction: 'save',
      closeEditorAfterAction: true,
    });

    listExplorerDirMock.mockImplementation(async () => galleryEntries);
    finalizeScreenshotStageMock.mockImplementation(async (path, directory, filePrefix, copyToClipboard) => {
      expect(path).toBe('/tmp/tauri-plugin-screenshots/stage-1.png');
      expect(directory).toBe(screenshotFeatureConfig.defaultSaveDirectory);
      expect(filePrefix).toBe(screenshotFeatureConfig.filePrefix);
      expect(copyToClipboard).toBe(false);

      galleryEntries = [savedScreenshot];
      return {
        path: savedScreenshot.path,
        file_name: savedScreenshot.name,
        created_at: savedScreenshot.modified,
      };
    });

    render(<ScreenshotsManager />);

    expect(await screen.findByTestId('mock-shared-editor')).toBeInTheDocument();
    await waitFor(() => {
      expect(prepareScreenshotStageMock).toHaveBeenCalledWith(
        '/tmp/tauri-plugin-screenshots/monitor-1.png',
        null,
      );
    });

    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(editorSaveMock).toHaveBeenCalled();
      expect(finalizeScreenshotStageMock).toHaveBeenCalled();
      expect(deleteScreenshotStageMock).toHaveBeenCalledWith(
        '/tmp/tauri-plugin-screenshots/stage-1.png',
      );
    });

    expect(await screen.findByText('Screenshot Library')).toBeInTheDocument();
    expect(await screen.findByText(savedScreenshot.name)).toBeInTheDocument();
  });

  it('prepares a cropped stage from a region selection before opening the shared editor', async () => {
    const user = userEvent.setup();
    listExplorerDirMock.mockResolvedValue([]);

    render(<ScreenshotsManager />);

    const preview = await screen.findByLabelText('Screenshot selection preview');
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerUp(preview, { pointerId: 1, clientX: 400, clientY: 300 });

    await user.click(screen.getByRole('button', { name: 'Edit Selection' }));

    await waitFor(() => {
      expect(prepareScreenshotStageMock).toHaveBeenCalledWith(
        '/tmp/tauri-plugin-screenshots/monitor-1.png',
        {
          x: 200,
          y: 200,
          width: 600,
          height: 400,
        },
      );
    });

    expect(await screen.findByTestId('mock-shared-editor')).toBeInTheDocument();
  });
});
