import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerVideoEditor, buildTrimmedVideoOutputPath } from '../components/ExplorerVideoEditor';

const {
  createExplorerVideoPreviewProxyMock,
  exportExplorerVideoTrimMock,
  resolveExplorerVideoPreviewSourceMock,
} = vi.hoisted(() => ({
  exportExplorerVideoTrimMock: vi.fn(),
  createExplorerVideoPreviewProxyMock: vi.fn(),
  resolveExplorerVideoPreviewSourceMock: vi.fn(),
}));

vi.mock('../runtime/videoEditorBackend', () => ({
  createExplorerVideoPreviewProxy: createExplorerVideoPreviewProxyMock,
  exportExplorerVideoTrim: exportExplorerVideoTrimMock,
  resolveExplorerVideoPreviewSource: resolveExplorerVideoPreviewSourceMock,
}));

describe('ExplorerVideoEditor', () => {
  beforeEach(() => {
    exportExplorerVideoTrimMock.mockReset();
    createExplorerVideoPreviewProxyMock.mockReset();
    resolveExplorerVideoPreviewSourceMock.mockReset();
    resolveExplorerVideoPreviewSourceMock.mockResolvedValue({
      sourcePath: '/tmp/demo.mov',
      sourceKind: 'direct',
      mimeType: 'video/quicktime',
      generatedFromPath: null,
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a sibling trimmed mp4 output path', () => {
    expect(buildTrimmedVideoOutputPath('/tmp/demo.mov')).toBe('/tmp/demo.trimmed.mp4');
    expect(buildTrimmedVideoOutputPath('C:\\clips\\demo.webm')).toBe('C:\\clips\\demo.trimmed.mp4');
    expect(buildTrimmedVideoOutputPath('/tmp/demo')).toBe('/tmp/demo.trimmed.mp4');
  });

  it('exports trimmed clips back through the native video backend', async () => {
    const onExported = vi.fn();
    exportExplorerVideoTrimMock.mockResolvedValue({
      outputPath: '/tmp/custom-cut.mp4',
      startTimeSeconds: 0,
      endTimeSeconds: 18.75,
      durationSeconds: 18.75,
      ffmpegBinary: 'ffmpeg',
    });

    render(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mov"
        videoName="demo.mov"
        videoSource="asset://localhost/tmp/demo.mov"
        videoExtension="mov"
        videoMimeType="video/quicktime"
        videoSize={32 * 1024 * 1024}
        onExported={onExported}
      />,
    );

    await waitFor(() => {
      expect(resolveExplorerVideoPreviewSourceMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    const player = screen.getByLabelText(/video preview player for demo\.mov/i);
    Object.defineProperty(player, 'duration', {
      configurable: true,
      value: 18.75,
    });
    Object.defineProperty(player, 'currentTime', {
      configurable: true,
      writable: true,
      value: 0,
    });

    fireEvent.loadedMetadata(player);
    await screen.findByText(/ready to scrub, trim, and export/i);

    fireEvent.click(screen.getByRole('button', { name: /export trim/i }));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByDisplayValue('/tmp/demo.trimmed.mp4');
    fireEvent.change(input, { target: { value: '/tmp/custom-cut.mp4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^export trim$/i }));

    await waitFor(() => {
      expect(exportExplorerVideoTrimMock).toHaveBeenCalledWith({
        inputPath: '/tmp/demo.mov',
        outputPath: '/tmp/custom-cut.mp4',
        startTimeSeconds: 0,
        endTimeSeconds: 18.75,
        overwriteExisting: true,
      });
    });

    expect(onExported).toHaveBeenCalledWith('/tmp/custom-cut.mp4');
    expect(await screen.findByText(/saved 18\.75s trim to \/tmp\/custom-cut\.mp4/i)).toBeInTheDocument();
  });

  it('falls back to a generated preview proxy when direct playback fails', async () => {
    createExplorerVideoPreviewProxyMock.mockResolvedValue({
      sourcePath: '/tmp/demo.preview.mp4',
      sourceKind: 'proxy',
      mimeType: 'video/mp4',
      generatedFromPath: '/tmp/demo.mov',
    });

    render(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mov"
        videoName="demo.mov"
        videoSource="asset://localhost/tmp/demo.mov"
        videoExtension="mov"
        videoMimeType="video/quicktime"
        videoSize={32 * 1024 * 1024}
      />,
    );

    const player = screen.getByLabelText(/video preview player for demo\.mov/i);
    fireEvent.error(player);

    await waitFor(() => {
      expect(createExplorerVideoPreviewProxyMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    await waitFor(() => {
      const source = player.querySelector('source');
      expect(source?.getAttribute('src')).toBe('asset://localhost//tmp/demo.preview.mp4');
      expect(source?.getAttribute('type')).toBe('video/mp4');
    });

    expect(await screen.findByText(/preview proxy ready/i)).toBeInTheDocument();
  });
});
