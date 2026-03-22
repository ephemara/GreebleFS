import { render, screen, waitFor } from '@testing-library/react';
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
import { screenshotFeatureConfig } from '../config/screenshots';

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
    path: `${screenshotFeatureConfig.defaultSaveDirectory}\\${name}`,
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
});
