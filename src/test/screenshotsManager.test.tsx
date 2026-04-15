import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
} from '@tauri-apps/api/window';
import type { Monitor as TauriMonitor } from '@tauri-apps/api/window';
import { ScreenshotsManager } from '../components/ScreenshotsManager';
import { joinPlatformPath } from '../config/platform';
import { screenshotFeatureConfig } from '../config/screenshots';
import { useSettingsStore } from '../store/settingsStore';
import { useExplorerTaskStore } from '../store/explorerTaskStore';

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

describe('ScreenshotsManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetToDefaults();
    useExplorerTaskStore.setState({
      tasks: {},
      taskOrder: [],
      subscriptionState: 'idle',
      subscriptionError: null,
    });
    vi.mocked(invoke).mockReset();
    vi.mocked(availableMonitors).mockResolvedValue([DEFAULT_MONITOR]);
    vi.mocked(currentMonitor).mockResolvedValue(DEFAULT_MONITOR);
    vi.mocked(primaryMonitor).mockResolvedValue(DEFAULT_MONITOR);

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class ResizeObserver {
        observe() {}
        disconnect() {}
      },
    });

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
  });

  it('deletes a gallery item after confirmation and refreshes the library', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const screenshot = makeGalleryEntry('overlayterm-shot-a.png');
    let galleryEntries = [screenshot];

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_list_dir') {
        return galleryEntries;
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-1',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_read_gallery_thumbnail') {
        return 'data:image/png;base64,ZmFrZQ==';
      }
      if (command === 'fs_delete') {
        const payload = args as { path?: string } | undefined;
        expect(payload?.path).toBe(screenshot.path);
        galleryEntries = [];
        return null;
      }
      return null;
    });

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ScreenshotsManager />);

    expect(await screen.findByText(screenshot.name)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('fs_delete', {
        path: screenshot.path,
        recursive: false,
      });
    });

    expect(await screen.findByText(`Deleted ${screenshot.name}.`)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No screenshots yet.')).toBeInTheDocument();
    });
  });

  it('does not delete a gallery item when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const screenshot = makeGalleryEntry('overlayterm-shot-b.png');

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fs_list_dir') {
        return [screenshot];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-1',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_read_gallery_thumbnail') {
        return 'data:image/png;base64,ZmFrZQ==';
      }
      return null;
    });

    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<ScreenshotsManager />);

    expect(await screen.findByText(screenshot.name)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(invokeMock).not.toHaveBeenCalledWith('fs_delete', expect.anything());
    expect(screen.getByText(screenshot.name)).toBeInTheDocument();
  });

  it('uses screenshot defaults for monitor-first save actions and returns to the library after saving', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const savedScreenshot = makeGalleryEntry('overlayterm-shot-monitor.png');
    let galleryEntries = [] as ReturnType<typeof makeGalleryEntry>[];

    useSettingsStore.getState().updateScreenshots({
      defaultCaptureMode: 'monitor',
      defaultOutputAction: 'save',
      closeEditorAfterAction: true,
      showGrid: true,
    });

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_list_dir') {
        return galleryEntries;
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-1',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_read_gallery_thumbnail') {
        return 'data:image/png;base64,ZmFrZQ==';
      }
      if (command === 'screenshot_save_region') {
        expect(args).toEqual({
          captureId: 'capture-1',
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          directory: screenshotFeatureConfig.defaultSaveDirectory,
          filePrefix: screenshotFeatureConfig.filePrefix,
          copyToClipboard: false,
        });
        galleryEntries = [savedScreenshot];
        return {
          path: savedScreenshot.path,
          file_name: savedScreenshot.name,
          created_at: savedScreenshot.modified,
        };
      }
      return null;
    });

    render(<ScreenshotsManager />);

    expect(await screen.findByTestId('screenshot-grid')).toBeInTheDocument();
    expect(screen.getByText('Full monitor is the default capture, or drag to switch to area snip:')).toBeInTheDocument();

    const saveButton = await screen.findByRole('button', { name: /^Save Screen$/i });
    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
    await user.click(saveButton);

    expect(await screen.findByText('Screenshot Library')).toBeInTheDocument();
    expect(await screen.findByText(savedScreenshot.name)).toBeInTheDocument();
  });

  it('exports annotated captures through the native Rust command instead of browser-side file writing', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    useSettingsStore.getState().updateScreenshots({
      defaultCaptureMode: 'monitor',
      defaultOutputAction: 'save',
      closeEditorAfterAction: false,
    });

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_list_dir') {
        return [];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-annotated',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_export_annotated') {
        expect(args).toEqual({
          captureId: 'capture-annotated',
          selection: { x: 0, y: 0, width: 1920, height: 1080 },
          annotations: [
            {
              type: 'rect',
              x1: 200,
              y1: 200,
              x2: 400,
              y2: 360,
              color: '#ef4444',
              lw: 6,
            },
          ],
          directory: screenshotFeatureConfig.defaultSaveDirectory,
          filePrefix: screenshotFeatureConfig.filePrefix,
          copyToClipboard: false,
        });
        return {
          saved: {
            path: joinPlatformPath(screenshotFeatureConfig.defaultSaveDirectory, 'overlayterm-shot-annotated.png'),
            file_name: 'overlayterm-shot-annotated.png',
            created_at: Date.UTC(2026, 2, 22, 11, 0, 0),
          },
          copiedToClipboard: false,
        };
      }
      return null;
    });

    render(<ScreenshotsManager />);

    const preview = await screen.findByLabelText('Screenshot editor preview');
    await user.click(screen.getByRole('button', { name: /Rectangle/i }));

    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 200, clientY: 180 });
    fireEvent.pointerUp(preview, { pointerId: 1, clientX: 200, clientY: 180 });

    await user.click(await screen.findByRole('button', { name: /^Save Annotated$/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('screenshot_export_annotated', expect.anything());
    });
    expect(invokeMock).not.toHaveBeenCalledWith('fs_write_file', expect.anything());
  });

  it('supports keyboard move and resize for an active selection before saving', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_list_dir') {
        return [];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-keyboard',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_save_region') {
        expect(args).toEqual({
          captureId: 'capture-keyboard',
          x: 220,
          y: 200,
          width: 600,
          height: 420,
          directory: screenshotFeatureConfig.defaultSaveDirectory,
          filePrefix: screenshotFeatureConfig.filePrefix,
          copyToClipboard: false,
        });
        return {
          path: joinPlatformPath(screenshotFeatureConfig.defaultSaveDirectory, 'overlayterm-shot-keyboard.png'),
          file_name: 'overlayterm-shot-keyboard.png',
          created_at: Date.UTC(2026, 2, 22, 11, 15, 0),
        };
      }
      return null;
    });

    render(<ScreenshotsManager />);

    const preview = await screen.findByLabelText('Screenshot editor preview');
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 400, clientY: 300 });
    fireEvent.pointerUp(preview, { pointerId: 1, clientX: 400, clientY: 300 });

    fireEvent.keyDown(preview, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(preview, { key: 'ArrowDown', altKey: true, shiftKey: true });

    await user.click(await screen.findByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('screenshot_save_region', expect.anything());
    });
  });

  it('supports pointer handle resizing for an active selection', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string, args: unknown) => {
      if (command === 'fs_list_dir') {
        return [];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-resize',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_save_region') {
        expect(args).toEqual({
          captureId: 'capture-resize',
          x: 200,
          y: 200,
          width: 720,
          height: 360,
          directory: screenshotFeatureConfig.defaultSaveDirectory,
          filePrefix: screenshotFeatureConfig.filePrefix,
          copyToClipboard: false,
        });
        return {
          path: joinPlatformPath(screenshotFeatureConfig.defaultSaveDirectory, 'overlayterm-shot-resize.png'),
          file_name: 'overlayterm-shot-resize.png',
          created_at: Date.UTC(2026, 2, 22, 11, 25, 0),
        };
      }
      return null;
    });

    render(<ScreenshotsManager />);

    const preview = await screen.findByLabelText('Screenshot editor preview');
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 340, clientY: 280 });
    fireEvent.pointerUp(preview, { pointerId: 1, clientX: 340, clientY: 280 });

    fireEvent.pointerDown(preview, { pointerId: 2, clientX: 340, clientY: 190 });
    fireEvent.pointerMove(preview, { pointerId: 2, clientX: 460, clientY: 190 });
    fireEvent.pointerUp(preview, { pointerId: 2, clientX: 460, clientY: 190 });

    await user.click(await screen.findByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('screenshot_save_region', expect.anything());
    });
  });

  it('defers gallery thumbnail decoding until the full library is opened', async () => {
    const user = userEvent.setup();
    const invokeMock = vi.mocked(invoke);
    const screenshot = makeGalleryEntry('overlayterm-shot-thumb.png');

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fs_list_dir') {
        return [screenshot];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-1',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_read_gallery_thumbnail') {
        return 'data:image/png;base64,ZmFrZQ==';
      }
      return null;
    });

    render(<ScreenshotsManager />);

    expect(await screen.findByText(screenshot.name)).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('screenshot_read_gallery_thumbnail', expect.anything());

    await user.click(screen.getByRole('button', { name: 'Library' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('screenshot_read_gallery_thumbnail', {
        path: screenshot.path,
        maxWidth: screenshotFeatureConfig.galleryThumbnail.maxWidth,
        maxHeight: screenshotFeatureConfig.galleryThumbnail.maxHeight,
      });
    });
  });

  it('does not surface unrelated explorer tasks in the screenshot status bar', async () => {
    const invokeMock = vi.mocked(invoke);
    const screenshot = makeGalleryEntry('overlayterm-shot-task-isolation.png');

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fs_list_dir') {
        return [screenshot];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-1',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 1920,
          imageHeight: 1080,
        };
      }
      if (command === 'screenshot_read_gallery_thumbnail') {
        return 'data:image/png;base64,ZmFrZQ==';
      }
      return null;
    });

    useExplorerTaskStore.getState().upsertTask({
      taskId: 'rogue-delete-task',
      task: {
        name: 'Delete M:\\Assets\\OverlayTerm\\notes\\new-note_1775861948830-jzyb4i.md',
        prog: {
          kind: 'fileDelete',
          totalFiles: 1,
          successFiles: 0,
          failedFiles: 0,
          totalBytes: 100,
          processedBytes: 0,
          collected: null,
          cleaned: null,
        },
      },
    });

    render(<ScreenshotsManager />);

    expect(await screen.findByText(screenshot.name)).toBeInTheDocument();
    expect(screen.queryByText(/Delete M:\\Assets\\OverlayTerm\\notes\\/)).not.toBeInTheDocument();
    expect(screen.queryByText('Working…')).not.toBeInTheDocument();
  });

  it('captures Linux high-DPI monitor previews with physical bounds', async () => {
    const invokeMock = vi.mocked(invoke);

    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Linux x86_64',
    });

    vi.mocked(availableMonitors).mockResolvedValue([{
      ...DEFAULT_MONITOR,
      size: { width: 3840, height: 2160 },
      scaleFactor: 2,
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 3840, height: 2160 },
      },
    } as TauriMonitor]);
    vi.mocked(currentMonitor).mockResolvedValue({
      ...DEFAULT_MONITOR,
      size: { width: 3840, height: 2160 },
      scaleFactor: 2,
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 3840, height: 2160 },
      },
    } as TauriMonitor);
    vi.mocked(primaryMonitor).mockResolvedValue({
      ...DEFAULT_MONITOR,
      size: { width: 3840, height: 2160 },
      scaleFactor: 2,
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 3840, height: 2160 },
      },
    } as TauriMonitor);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'fs_list_dir') {
        return [];
      }
      if (command === 'screenshot_capture_preview') {
        return {
          captureId: 'capture-linux-hidpi',
          previewUrl: 'data:image/png;base64,ZmFrZQ==',
          imageWidth: 3840,
          imageHeight: 2160,
        };
      }
      return null;
    });

    render(<ScreenshotsManager />);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('screenshot_capture_preview', {
        x: 0,
        y: 0,
        width: 3840,
        height: 2160,
      });
    });
  });
});
