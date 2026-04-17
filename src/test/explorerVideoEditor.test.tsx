import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoEngineStateSnapshot } from '../generated/tauri';
import {
  ExplorerVideoEditor,
  buildTrimmedVideoOutputPath,
} from '../components/ExplorerVideoEditor';

const {
  exportExplorerVideoTrimMock,
  loadVideoSourceMock,
  pauseVideoMock,
  playVideoMock,
  seekVideoMock,
  setVideoLoopRegionMock,
  stopVideoMock,
  useVideoEngineFeedMock,
  useVideoEngineSnapshotMock,
} = vi.hoisted(() => ({
  exportExplorerVideoTrimMock: vi.fn(),
  loadVideoSourceMock: vi.fn(),
  pauseVideoMock: vi.fn(),
  playVideoMock: vi.fn(),
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
  exportExplorerVideoTrim: exportExplorerVideoTrimMock,
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
    exportExplorerVideoTrimMock.mockReset();
    loadVideoSourceMock.mockReset();
    pauseVideoMock.mockReset();
    playVideoMock.mockReset();
    seekVideoMock.mockReset();
    setVideoLoopRegionMock.mockReset();
    stopVideoMock.mockReset();
    useVideoEngineFeedMock.mockReset();
    useVideoEngineSnapshotMock.mockImplementation(() => videoEngineSnapshot);
    loadVideoSourceMock.mockImplementation(async () => {
      videoEngineSnapshot = { ...LOADED_VIDEO_SNAPSHOT };
      return videoEngineSnapshot;
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
      expect(setVideoLoopRegionMock).toHaveBeenCalledWith(0, 18.75, true);
    });

    expect(
      await screen.findByText(/native preview ready\. rust owns transport and timing\./i),
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
});
