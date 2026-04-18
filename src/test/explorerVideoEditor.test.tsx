import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
  hasAudioTrack: true,
  currentTimeSeconds: 0,
  isPlaying: false,
  isLoading: false,
  playbackBackend: 'webviewMediaElement',
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
  let originalPlay: typeof HTMLMediaElement.prototype.play;
  let originalPause: typeof HTMLMediaElement.prototype.pause;
  let originalLoad: typeof HTMLMediaElement.prototype.load;
  const playSpy = vi.fn();
  const pauseSpy = vi.fn();
  const loadSpy = vi.fn();

  beforeAll(() => {
    originalPlay = HTMLMediaElement.prototype.play;
    originalPause = HTMLMediaElement.prototype.pause;
    originalLoad = HTMLMediaElement.prototype.load;

    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { __paused?: boolean }).__paused ?? true;
      },
    });
    HTMLMediaElement.prototype.play = playSpy.mockImplementation(function play(this: HTMLMediaElement) {
      (this as HTMLMediaElement & { __paused?: boolean }).__paused = false;
      return Promise.resolve();
    });
    HTMLMediaElement.prototype.pause = pauseSpy.mockImplementation(function pause(this: HTMLMediaElement) {
      (this as HTMLMediaElement & { __paused?: boolean }).__paused = true;
    });
    HTMLMediaElement.prototype.load = loadSpy.mockImplementation(function load(this: HTMLMediaElement) {
      (this as HTMLMediaElement & { __paused?: boolean }).__paused = true;
    });
  });

  afterAll(() => {
    HTMLMediaElement.prototype.play = originalPlay;
    HTMLMediaElement.prototype.pause = originalPause;
    HTMLMediaElement.prototype.load = originalLoad;
  });

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
    useVideoEngineSnapshotMock.mockImplementation(() => videoEngineSnapshot);
    loadVideoSourceMock.mockImplementation(async () => {
      videoEngineSnapshot = { ...LOADED_VIDEO_SNAPSHOT };
      return videoEngineSnapshot;
    });
    resolveExplorerVideoPreviewSourceMock.mockResolvedValue({
      sourcePath: '/tmp/demo.mov',
      sourceKind: 'direct',
      mimeType: 'video/quicktime',
      generatedFromPath: null,
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
    playSpy.mockClear();
    pauseSpy.mockClear();
    loadSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds a sibling trimmed mp4 output path', () => {
    expect(buildTrimmedVideoOutputPath('/tmp/demo.mov')).toBe('/tmp/demo.trimmed.mp4');
    expect(buildTrimmedVideoOutputPath('C:\\clips\\demo.webm')).toBe(
      'C:\\clips\\demo.trimmed.mp4',
    );
    expect(buildTrimmedVideoOutputPath('/tmp/demo')).toBe('/tmp/demo.trimmed.mp4');
  });

  it('loads the selected video into the native video engine, resolves a preview source, and exports trims through Rust', async () => {
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
      expect(resolveExplorerVideoPreviewSourceMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    await waitFor(() => {
      expect(setVideoLoopRegionMock).toHaveBeenCalledWith(0, 18.75, true);
    });

    const previewPlayer = screen.getByLabelText(/video preview player for demo\.mov/i);
    fireEvent.loadedData(previewPlayer);

    expect(
      await screen.findByText(/preview ready\. rust transport is driving the media surface\./i),
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

    fireEvent.loadedData(screen.getByLabelText(/video preview player for demo\.mov/i));

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

  it('falls back to a generated proxy when the direct preview surface errors', async () => {
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

    const previewPlayer = screen.getByLabelText(/video preview player for demo\.mov/i);
    Object.defineProperty(previewPlayer, 'error', {
      configurable: true,
      value: { code: 4 },
    });
    fireEvent.error(previewPlayer);

    await waitFor(() => {
      expect(createExplorerVideoPreviewProxyMock).toHaveBeenCalledWith('/tmp/demo.mov');
    });

    expect(await screen.findByRole('button', { name: /proxy ready/i })).toBeDisabled();
  });

  it('shows media-audio fallback copy without leaking the old audio-file prompt', async () => {
    videoEngineSnapshot = {
      ...LOADED_VIDEO_SNAPSHOT,
      audioTransportReady: false,
      audioTransportError: 'Native soundtrack preview could not load this video track.',
    };
    loadVideoSourceMock.mockImplementation(async () => videoEngineSnapshot);

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

    fireEvent.loadedData(screen.getByLabelText(/video preview player for demo\.mov/i));

    expect(
      await screen.findByText(/native soundtrack preview could not load this video track\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /media audio/i })).toBeDisabled();
    expect(
      screen.queryByText(/load an audio file before setting a loop region/i),
    ).not.toBeInTheDocument();
  });
});
