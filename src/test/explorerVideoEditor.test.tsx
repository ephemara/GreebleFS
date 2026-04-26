import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerVideoEditor } from '../components/ExplorerVideoEditor';

const {
  createExplorerVideoPreviewProxyMock,
  readExplorerVideoPreviewBytesMock,
  resolveExplorerVideoPreviewSourceMock,
  createObjectUrlMock,
  revokeObjectUrlMock,
} = vi.hoisted(() => ({
  createExplorerVideoPreviewProxyMock: vi.fn(),
  readExplorerVideoPreviewBytesMock: vi.fn(),
  resolveExplorerVideoPreviewSourceMock: vi.fn(),
  createObjectUrlMock: vi.fn(),
  revokeObjectUrlMock: vi.fn(),
}));

vi.mock('../runtime/videoEditorBackend', () => ({
  EXPLORER_VIDEO_PREVIEW_MAX_BYTES: 256 * 1024 * 1024,
  createExplorerVideoPreviewProxy: createExplorerVideoPreviewProxyMock,
  readExplorerVideoPreviewBytes: readExplorerVideoPreviewBytesMock,
  resolveExplorerVideoPreviewSource: resolveExplorerVideoPreviewSourceMock,
}));

describe('ExplorerVideoEditor', () => {
  beforeEach(() => {
    createExplorerVideoPreviewProxyMock.mockReset();
    readExplorerVideoPreviewBytesMock.mockReset();
    resolveExplorerVideoPreviewSourceMock.mockReset();
    createObjectUrlMock.mockReset();
    revokeObjectUrlMock.mockReset();

    resolveExplorerVideoPreviewSourceMock.mockResolvedValue({
      sourcePath: '/tmp/demo.mp4',
      sourceKind: 'direct',
      mimeType: 'video/mp4',
      generatedFromPath: null,
    });
    createExplorerVideoPreviewProxyMock.mockResolvedValue({
      sourcePath: '/tmp/demo.preview.mp4',
      sourceKind: 'proxy',
      mimeType: 'video/mp4',
      generatedFromPath: '/tmp/demo.mp4',
    });
    readExplorerVideoPreviewBytesMock.mockImplementation(async (path: string) =>
      new TextEncoder().encode(`video-bytes:${path}`),
    );
    createObjectUrlMock
      .mockReturnValueOnce('blob:direct-preview')
      .mockReturnValueOnce('blob:proxy-preview');
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: {
        ...globalThis.URL,
        createObjectURL: createObjectUrlMock,
        revokeObjectURL: revokeObjectUrlMock,
      },
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

  it('reads native bytes into a blob URL before escalating to a generated proxy', async () => {
    render(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mp4"
        videoName="demo.mp4"
        videoSource="/tmp/demo.mp4"
        videoExtension="mp4"
        videoMimeType="video/mp4"
        videoSize={1024}
      />,
    );

    const player = await screen.findByLabelText(/video preview: demo\.mp4/i);

    await waitFor(() => {
      const source = player.querySelector('source');
      expect(source?.getAttribute('src')).toBe('blob:direct-preview');
      expect(source?.getAttribute('type')).toBe('video/mp4');
    });

    await waitFor(() => {
      expect(readExplorerVideoPreviewBytesMock).toHaveBeenCalledWith(
        '/tmp/demo.mp4',
        256 * 1024 * 1024,
      );
    });

    fireEvent.error(player);

    await waitFor(() => {
      expect(createExplorerVideoPreviewProxyMock).toHaveBeenCalledWith('/tmp/demo.mp4');
    });

    await waitFor(() => {
      const source = player.querySelector('source');
      expect(source?.getAttribute('src')).toBe('blob:proxy-preview');
      expect(source?.getAttribute('type')).toBe('video/mp4');
    });

    await waitFor(() => {
      expect(readExplorerVideoPreviewBytesMock).toHaveBeenCalledWith(
        '/tmp/demo.preview.mp4',
        256 * 1024 * 1024,
      );
    });
  });

  it('keeps preview mode focused on playback instead of mounting edit-only controls', async () => {
    render(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mp4"
        videoName="demo.mp4"
        videoSource="/tmp/demo.mp4"
        videoExtension="mp4"
        videoMimeType="video/mp4"
        videoSize={1024}
        mode="preview"
      />,
    );

    const player = (await screen.findByLabelText(
      /video preview: demo\.mp4/i,
    )) as HTMLVideoElement;

    await waitFor(() => {
      const source = player.querySelector('source');
      expect(source?.getAttribute('src')).toBe('blob:direct-preview');
    });

    expect(player.controls).toBe(true);
    expect(screen.queryByText('Inspector')).toBeNull();
    expect(screen.queryByRole('button', { name: /set in/i })).toBeNull();
    expect(screen.getByText('Direct playback (native bytes)')).toBeInTheDocument();
  });
});
