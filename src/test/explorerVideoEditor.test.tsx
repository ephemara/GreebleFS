import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerVideoEditor } from '../components/ExplorerVideoEditor';

const {
  convertFileSrcMock,
  createExplorerVideoPreviewProxyMock,
  resolveExplorerVideoPreviewSourceMock,
} = vi.hoisted(() => ({
  convertFileSrcMock: vi.fn((path: string) => `asset://localhost/${path}`),
  createExplorerVideoPreviewProxyMock: vi.fn(),
  resolveExplorerVideoPreviewSourceMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: convertFileSrcMock,
}));

vi.mock('../runtime/videoEditorBackend', () => ({
  createExplorerVideoPreviewProxy: createExplorerVideoPreviewProxyMock,
  resolveExplorerVideoPreviewSource: resolveExplorerVideoPreviewSourceMock,
}));

describe('ExplorerVideoEditor', () => {
  beforeEach(() => {
    convertFileSrcMock.mockClear();
    createExplorerVideoPreviewProxyMock.mockReset();
    resolveExplorerVideoPreviewSourceMock.mockReset();

    resolveExplorerVideoPreviewSourceMock.mockResolvedValue({
      sourcePath: '/tmp/demo.mp4',
      sourceKind: 'direct',
      mimeType: 'video/mp4',
      generatedFromPath: null,
    });
    createExplorerVideoPreviewProxyMock.mockResolvedValue({
      sourcePath: '/tmp/demo.preview.webm',
      sourceKind: 'proxy',
      mimeType: 'video/webm',
      generatedFromPath: '/tmp/demo.mp4',
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'load', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('falls back to a generated proxy when direct playback fails in the webview', async () => {
    render(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mp4"
        videoName="demo.mp4"
        videoSource="asset://localhost//tmp/demo.mp4"
        videoExtension="mp4"
        videoMimeType="video/mp4"
        videoSize={1024}
      />,
    );

    const player = await screen.findByLabelText(/video preview: demo\.mp4/i);

    await waitFor(() => {
      const source = player.querySelector('source');
      expect(source?.getAttribute('src')).toBe('asset://localhost//tmp/demo.mp4');
      expect(source?.getAttribute('type')).toBe('video/mp4');
    });

    fireEvent.error(player);

    await waitFor(() => {
      expect(createExplorerVideoPreviewProxyMock).toHaveBeenCalledWith('/tmp/demo.mp4');
    });

    await waitFor(() => {
      const source = player.querySelector('source');
      expect(source?.getAttribute('src')).toBe('asset://localhost//tmp/demo.preview.webm');
      expect(source?.getAttribute('type')).toBe('video/webm');
    });
  });
});
