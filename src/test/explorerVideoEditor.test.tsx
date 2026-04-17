import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoEngineStateSnapshot } from '../generated/tauri';
import {
  ExplorerVideoEditor,
  buildTrimmedVideoOutputPath,
} from '../components/ExplorerVideoEditor';

const {
  createExplorerVideoPreviewProxyMock,
  exportExplorerVideoTrimMock,
  loadVideoSourceMock,
  pauseVideoMock,
  playVideoMock,
  resolveExplorerVideoPreviewSourceMock,
  seekVideoMock,
  setVideoLoopRegionMock,
  stopVideoMock,
  useVideoEngineFeedMock,
  useVideoEngineSnapshotMock,
} = vi.hoisted(() => ({
  createExplorerVideoPreviewProxyMock: vi.fn(),
  exportExplorerVideoTrimMock: vi.fn(),
  loadVideoSourceMock: vi.fn(),
  pauseVideoMock: vi.fn(),
  playVideoMock: vi.fn(),
  resolveExplorerVideoPreviewSourceMock: vi.fn(),
  seekVideoMock: vi.fn(),
  setVideoLoopRegionMock: vi.fn(),
  stopVideoMock: vi.fn(),
  useVideoEngineFeedMock: vi.fn(),
  useVideoEngineSnapshotMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
}));

vi.mock('../runtime/videoEditorBackend', () => ({
  createExplorerVideoPreviewProxy: createExplorerVideoPreviewProxyMock,
  exportExplorerVideoTrim: exportExplorerVideoTrimMock,
  resolveExplorerVideoPreviewSource: resolveExplorerVideoPreviewSourceMock,
}));

vi.mock('../store/videoEngineStore', () => ({
  loadVideoSource: loadVideoSourceMock,
  pauseVideo: pauseVideoMock,
  playVideo: playVideoMock,
  seekVideo: seekVideoMock,
  setVideoLoopRegion: setVideoLoopRegionMock,
  stopVideo: stopVideoMock,
  useVideoEngineFeed: useVideoEngineFeedMock,
  useVideoEngineSnapshot: useVideoEngineSnapshotMock,
}));

const LOADED_VIDEO_SNAPSHOT: VideoEngineStateSnapshot = {
  ready: true,
  engineError: null,
  loadedPath: '/tmp/demo.mov',
  loadedName: 'demo.mov',
  durationSeconds: 18.75,
  widthPx: 1280,
  heightPx: 720,
  frameRate: 24,
  currentTimeSeconds: 0,
  isPlaying: false,
  isLoading: false,
  previewFramePath: '/tmp/demo-frame-00001.png',
  previewFrameTimestampSeconds: 0,
  cachedFrameCount: 24,
  playbackBackend: 'ffmpegFrameSequence',
  loopRegion: {
    startSeconds: 0,
    endSeconds: 18.75,
    enabled: true,
  },
  audioTransportReady: true,
  audioTransportError: null,
};

describe('ExplorerVideoEditor', () => {
  let videoEngineSnapshot = LOADED_VIDEO_SNAPSHOT;

  beforeEach(() => {
    videoEngineSnapshot = { ...LOADED_VIDEO_SNAPSHOT };
    createExplorerVideoPreviewProxyMock.mockReset();
    exportExplorerVideoTrimMock.mockReset();
    loadVideoSourceMock.mockReset();
    pauseVideoMock.mockReset();
    playVideoMock.mockReset();
    resolveExplorerVideoPreviewSourceMock.mockReset();
    seekVideoMock.mockReset();
    setVideoLoopRegionMock.mockReset();
    stopVideoMock.mockReset();
    useVideoEngineFeedMock.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    useVideoEngineSnapshotMock.mockImplementation(() => videoEngineSnapshot);
    loadVideoSourceMock.mockImplementation(async () => {
      videoEngineSnapshot = { ...LOADED_VIDEO_SNAPSHOT };
      return videoEngineSnapshot;
    });
    resolveExplorerVideoPreviewSourceMock.mockResolvedValue({
      sourcePath: '/tmp/demo.preview.mp4',
      sourceKind: 'proxy',
      mimeType: 'video/mp4',
      generatedFromPath: '/tmp/demo.mov',
    });
    createExplorerVideoPreviewProxyMock.mockResolvedValue({
      sourcePath: '/tmp/demo.preview.mp4',
      sourceKind: 'proxy',
      mimeType: 'video/mp4',
      generatedFromPath: '/tmp/demo.mov',
    });
    playVideoMock.mockImplementation(async () => {
      videoEngineSnapshot = { ...videoEngineSnapshot, isPlaying: true };
      return videoEngineSnapshot;
    });
    pauseVideoMock.mockImplementation(async () => {
      videoEngineSnapshot = { ...videoEngineSnapshot, isPlaying: false };
      return videoEngineSnapshot;
    });
    seekVideoMock.mockImplementation(async (positionSeconds: number) => {
      videoEngineSnapshot = {
        ...videoEngineSnapshot,
        currentTimeSeconds: positionSeconds,
      };
      return videoEngineSnapshot;
    });
    setVideoLoopRegionMock.mockImplementation(
      async (startSeconds: number, endSeconds: number, enabled: boolean) => {
        videoEngineSnapshot = {
          ...videoEngineSnapshot,
          loopRegion: {
            startSeconds,
            endSeconds,
            enabled,
          },
        };
        return videoEngineSnapshot;
      },
    );
    stopVideoMock.mockImplementation(async () => {
      videoEngineSnapshot = {
        ...videoEngineSnapshot,
        currentTimeSeconds: 0,
        isPlaying: false,
      };
      return videoEngineSnapshot;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a sibling trimmed mp4 output path', () => {
    expect(buildTrimmedVideoOutputPath('/tmp/demo.mov')).toBe('/tmp/demo.trimmed.mp4');
    expect(buildTrimmedVideoOutputPath('C:\\clips\\demo.webm')).toBe(
      'C:\\clips\\demo.trimmed.mp4',
    );
    expect(buildTrimmedVideoOutputPath('/tmp/demo')).toBe('/tmp/demo.trimmed.mp4');
  });

  it('loads the selected video into the native video engine and exports trims through Rust', async () => {
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
      expect(loadVideoSourceMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    await waitFor(() => {
      expect(resolveExplorerVideoPreviewSourceMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    await waitFor(() => {
      expect(setVideoLoopRegionMock).toHaveBeenCalledWith(0, 18.75, true);
    });

    fireEvent.loadedMetadata(
      screen.getByLabelText(/compatibility video preview for demo\.mov/i),
    );

    expect(
      await screen.findByText(/preview ready via ffmpeg proxy\. rust owns transport and timing\./i),
    ).toBeInTheDocument();

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
    expect(
      await screen.findByText(/saved 18\.75s trim to \/tmp\/custom-cut\.mp4/i),
    ).toBeInTheDocument();
  });

  it('routes playback, loop, and transport controls through the native store', async () => {
    const { rerender } = render(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mov"
        videoName="demo.mov"
        videoSource="asset://localhost/tmp/demo.mov"
        videoExtension="mov"
        videoMimeType="video/quicktime"
        videoSize={32 * 1024 * 1024}
      />,
    );

    await waitFor(() => {
      expect(loadVideoSourceMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    fireEvent.loadedMetadata(
      screen.getByLabelText(/compatibility video preview for demo\.mov/i),
    );

    fireEvent.click(screen.getByRole('button', { name: /^play$/i }));
    await waitFor(() => {
      expect(playVideoMock).toHaveBeenCalledTimes(1);
    });

    videoEngineSnapshot = { ...videoEngineSnapshot, isPlaying: true };
    rerender(
      <ExplorerVideoEditor
        videoPath="/tmp/demo.mov"
        videoName="demo.mov"
        videoSource="asset://localhost/tmp/demo.mov"
        videoExtension="mov"
        videoMimeType="video/quicktime"
        videoSize={32 * 1024 * 1024}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^pause$/i }));
    await waitFor(() => {
      expect(pauseVideoMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /loop on/i }));
    await waitFor(() => {
      expect(setVideoLoopRegionMock).toHaveBeenLastCalledWith(0, 18.75, false);
    });

    fireEvent.click(screen.getByRole('button', { name: /\+1\.0s/i }));
    await waitFor(() => {
      expect(seekVideoMock).toHaveBeenCalledWith(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    await waitFor(() => {
      expect(stopVideoMock).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to an ffmpeg preview proxy when the direct webview preview fails', async () => {
    resolveExplorerVideoPreviewSourceMock.mockResolvedValueOnce({
      sourcePath: '/tmp/demo.mov',
      sourceKind: 'direct',
      mimeType: 'video/quicktime',
      generatedFromPath: null,
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

    await waitFor(() => {
      expect(resolveExplorerVideoPreviewSourceMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    fireEvent.error(screen.getByLabelText(/compatibility video preview for demo\.mov/i));

    await waitFor(() => {
      expect(createExplorerVideoPreviewProxyMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });
  });
});
