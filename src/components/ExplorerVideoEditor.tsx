import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Clapperboard,
  Pause,
  Play,
  RotateCcw,
  Save,
  Scissors,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  createExplorerVideoPreviewProxy,
  exportExplorerVideoTrim,
  resolveExplorerVideoPreviewSource,
  type ExplorerVideoPreviewSource,
} from '../runtime/videoEditorBackend';
import {
  loadVideoSource,
  pauseVideo,
  playVideo,
  seekVideo,
  setVideoLoopRegion,
  stopVideo,
  useVideoEngineFeed,
  useVideoEngineSnapshot,
} from '../store/videoEngineStore';
import { AppPromptDialog } from './AppModal';

type ExplorerVideoEditorProps = {
  videoPath: string;
  videoName: string;
  videoSource: string;
  videoExtension: string;
  videoMimeType: string | null;
  videoSize: number;
  onExported?: (outputPath: string) => Promise<void> | void;
};

type VideoExportState = 'idle' | 'exporting' | 'saved' | 'error';
type TimelineDragMode = 'playhead' | 'trimStart' | 'trimEnd';

const MINIMUM_TRIM_DURATION_SECONDS = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatTimelineTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00:00:00';
  }
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  const centiseconds = Math.floor((seconds - wholeSeconds) * 100);
  return [hours, minutes, remainingSeconds, centiseconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function getVideoPlaybackErrorLabel(videoError: MediaError | null): string {
  switch (videoError?.code) {
    case 1:
      return 'Video playback was aborted before the preview started.';
    case 2:
      return 'The preview media request failed before playback could begin.';
    case 3:
      return 'The desktop preview surface could not decode this video stream.';
    case 4:
      return 'This preview source is not supported by the current desktop media surface.';
    default:
      return 'The preview surface could not play this video source.';
  }
}

function buildFilePreviewUrl(sourcePath: string): string {
  try {
    return convertFileSrc(sourcePath);
  } catch {
    const normalized = sourcePath.replace(/\\/g, '/');
    return normalized.startsWith('/')
      ? `file://${encodeURI(normalized)}`
      : `file:///${encodeURI(normalized)}`;
  }
}

export function buildTrimmedVideoOutputPath(sourcePath: string): string {
  const match = sourcePath.match(/^(.*[/\\])?([^/\\]+)$/);
  const parentPath = match?.[1] ?? '';
  const leafName = match?.[2] ?? sourcePath;
  const stem = leafName.replace(/\.[^.]+$/, '');
  return `${parentPath}${stem}.trimmed.mp4`;
}

function buildTimelineTicks(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) {
    return [];
  }
  const targetTickCount = 8;
  const candidateSteps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
  const minimumStep = duration / targetTickCount;
  const step = candidateSteps.find((candidate) => candidate >= minimumStep) ?? 3600;
  const ticks: number[] = [];
  for (let current = 0; current <= duration; current += step) {
    ticks.push(current);
  }
  if (ticks[ticks.length - 1] !== duration) {
    ticks.push(duration);
  }
  return ticks;
}

function toolbarButtonStyle(
  active = false,
  emphasis: 'default' | 'primary' = 'default',
): CSSProperties {
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 11px',
    borderRadius: 10,
    border: `1px solid ${
      active || emphasis === 'primary'
        ? 'rgba(255,255,255,0.22)'
        : 'rgba(255,255,255,0.10)'
    }`,
    background:
      emphasis === 'primary'
        ? 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))'
        : active
          ? 'rgba(255,255,255,0.12)'
          : 'rgba(255,255,255,0.05)',
    color: 'var(--overlay-text-primary)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
  };
}

function previewSurfaceStyle(): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    background:
      'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 52%), rgba(0,0,0,0.76)',
  };
}

export function ExplorerVideoEditor({
  videoPath,
  videoName,
  videoSource,
  videoExtension,
  videoMimeType,
  videoSize,
  onExported,
}: ExplorerVideoEditorProps) {
  useVideoEngineFeed();

  const snapshot = useVideoEngineSnapshot();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const requestTokenRef = useRef(0);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [loopSelection, setLoopSelection] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<ExplorerVideoPreviewSource | null>(null);
  const [playbackSource, setPlaybackSource] = useState(videoSource);
  const [playbackMimeType, setPlaybackMimeType] = useState(videoMimeType);
  const [previewSurfaceReady, setPreviewSurfaceReady] = useState(false);
  const [isResolvingPreview, setIsResolvingPreview] = useState(false);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState(false);
  const [exportState, setExportState] = useState<VideoExportState>('idle');
  const [exportMessage, setExportMessage] = useState(
    'Trim export writes a sibling MP4 so the source file stays untouched.',
  );
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportPathInput, setExportPathInput] = useState(() =>
    buildTrimmedVideoOutputPath(videoPath),
  );

  const isCurrentVideoLoaded = snapshot.loadedPath === videoPath;
  const duration = isCurrentVideoLoaded ? snapshot.durationSeconds : 0;
  const currentTime = isCurrentVideoLoaded ? snapshot.currentTimeSeconds : 0;
  const isPlaying = isCurrentVideoLoaded && snapshot.isPlaying;
  const previewAspectRatio =
    isCurrentVideoLoaded && snapshot.widthPx && snapshot.heightPx
      ? `${snapshot.widthPx} / ${snapshot.heightPx}`
      : undefined;
  const previewSourceKind = previewSource?.sourceKind ?? 'direct';

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    trimStartRef.current = trimStart;
  }, [trimStart]);

  useEffect(() => {
    trimEndRef.current = trimEnd;
  }, [trimEnd]);

  async function ensurePlaybackProxy(): Promise<void> {
    if (isGeneratingProxy || previewSourceKind === 'proxy') {
      return;
    }

    const requestToken = requestTokenRef.current;
    setIsGeneratingProxy(true);
    setPreviewSurfaceReady(false);
    setPlaybackError(null);

    try {
      const proxy = await createExplorerVideoPreviewProxy(videoPath);
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      setPreviewSource(proxy);
      setPlaybackSource(buildFilePreviewUrl(proxy.sourcePath));
      setPlaybackMimeType(proxy.mimeType ?? 'video/mp4');
      setPlaybackError(null);
    } catch (error) {
      if (requestTokenRef.current !== requestToken) {
        return;
      }
      setPlaybackError(error instanceof Error ? error.message : String(error));
    } finally {
      if (requestTokenRef.current === requestToken) {
        setIsGeneratingProxy(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;

    setTrimStart(0);
    setTrimEnd(0);
    setLoopSelection(true);
    setPlaybackError(null);
    setPreviewSource(null);
    setPlaybackSource(videoSource);
    setPlaybackMimeType(videoMimeType);
    setPreviewSurfaceReady(false);
    setIsResolvingPreview(true);
    setIsGeneratingProxy(false);
    setExportState('idle');
    setExportMessage(
      'Trim export writes a sibling MP4 so the source file stays untouched.',
    );
    setExportPathInput(buildTrimmedVideoOutputPath(videoPath));

    async function loadNativeVideoSource(): Promise<void> {
      try {
        const nextSnapshot = await loadVideoSource(videoPath);
        if (cancelled || requestTokenRef.current !== requestToken) {
          return;
        }
        setTrimStart(0);
        setTrimEnd(nextSnapshot.durationSeconds);
        setPlaybackError(null);
        if (nextSnapshot.durationSeconds > 0) {
          await setVideoLoopRegion(0, nextSnapshot.durationSeconds, true);
        }
      } catch (error) {
        if (cancelled || requestTokenRef.current !== requestToken) {
          return;
        }
        console.error('ExplorerVideoEditor: failed to load native video source', {
          videoPath,
          error,
        });
        setPlaybackError(error instanceof Error ? error.message : String(error));
      }
    }

    async function resolvePreviewSource(): Promise<void> {
      try {
        const resolvedSource = await resolveExplorerVideoPreviewSource(videoPath);
        if (cancelled || requestTokenRef.current !== requestToken) {
          return;
        }
        setPreviewSource(resolvedSource);
        setPlaybackSource(buildFilePreviewUrl(resolvedSource.sourcePath));
        setPlaybackMimeType(resolvedSource.mimeType ?? videoMimeType);
      } catch (error) {
        console.error('ExplorerVideoEditor: failed to resolve preview source', {
          videoPath,
          error,
        });
      } finally {
        if (!cancelled && requestTokenRef.current === requestToken) {
          setIsResolvingPreview(false);
        }
      }
    }

    void loadNativeVideoSource();
    void resolvePreviewSource();

    return () => {
      cancelled = true;
      videoRef.current?.pause();
    };
  }, [videoMimeType, videoPath, videoSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setPreviewSurfaceReady(false);
    video.pause();
    video.load();
  }, [playbackMimeType, playbackSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!isCurrentVideoLoaded) {
      video.pause();
      return;
    }

    video.muted = snapshot.audioTransportReady;

    const driftThreshold = isPlaying ? 0.25 : 0.02;
    if (
      Number.isFinite(currentTime) &&
      Math.abs(video.currentTime - currentTime) > driftThreshold
    ) {
      video.currentTime = currentTime;
    }

    if (isPlaying) {
      if (video.paused) {
        void video.play().catch((error) => {
          console.error('ExplorerVideoEditor: preview surface failed to play', {
            videoPath,
            error,
          });
          setPlaybackError(error instanceof Error ? error.message : String(error));
          if (previewSourceKind === 'direct') {
            void ensurePlaybackProxy();
          }
        });
      }
      return;
    }

    if (!video.paused) {
      video.pause();
    }
  }, [
    currentTime,
    isCurrentVideoLoaded,
    isPlaying,
    previewSourceKind,
    snapshot.audioTransportReady,
    videoPath,
  ]);

  async function applyLoopRegion(
    nextTrimStart: number,
    nextTrimEnd: number,
    enabled: boolean,
  ): Promise<void> {
    if (durationRef.current <= 0) {
      return;
    }
    try {
      await setVideoLoopRegion(nextTrimStart, nextTrimEnd, enabled);
      setPlaybackError(null);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    }
  }

  async function syncCurrentTime(nextTime: number): Promise<void> {
    const boundedTime = clamp(nextTime, 0, durationRef.current || 0);
    try {
      await seekVideo(boundedTime);
      setPlaybackError(null);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    }
  }

  function updateTrimRange(nextStart: number, nextEnd: number): void {
    const boundedEnd = clamp(nextEnd, 0, durationRef.current || 0);
    const boundedStart = clamp(
      nextStart,
      0,
      Math.max(0, boundedEnd - MINIMUM_TRIM_DURATION_SECONDS),
    );
    const finalEnd = clamp(
      boundedEnd,
      Math.min(durationRef.current || 0, boundedStart + MINIMUM_TRIM_DURATION_SECONDS),
      durationRef.current || 0,
    );

    setTrimStart(boundedStart);
    setTrimEnd(finalEnd);
    void applyLoopRegion(boundedStart, finalEnd, loopSelection);

    if (currentTime < boundedStart || currentTime > finalEnd) {
      void syncCurrentTime(clamp(currentTime, boundedStart, finalEnd));
    }
  }

  function resolveTimeFromClientX(clientX: number): number {
    const timeline = timelineRef.current;
    if (!timeline || durationRef.current <= 0) {
      return 0;
    }
    const rect = timeline.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * durationRef.current;
  }

  function beginTimelineDrag(mode: TimelineDragMode, clientX: number): void {
    const applyTime = (nextTime: number) => {
      if (mode === 'playhead') {
        void syncCurrentTime(nextTime);
        return;
      }
      if (mode === 'trimStart') {
        updateTrimRange(nextTime, trimEndRef.current);
        return;
      }
      updateTrimRange(trimStartRef.current, nextTime);
    };

    applyTime(resolveTimeFromClientX(clientX));

    const handlePointerMove = (event: MouseEvent) => {
      applyTime(resolveTimeFromClientX(event.clientX));
    };
    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  }

  async function togglePlayback(): Promise<void> {
    if (duration <= 0) {
      return;
    }
    try {
      if (isPlaying) {
        await pauseVideo();
        return;
      }
      if (currentTime >= trimEndRef.current && trimEndRef.current > trimStartRef.current) {
        await seekVideo(trimStartRef.current);
      }
      await playVideo();
      setPlaybackError(null);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    }
  }

  async function resetTransport(): Promise<void> {
    setTrimStart(0);
    setTrimEnd(duration);
    setLoopSelection(true);
    try {
      await setVideoLoopRegion(0, duration, true);
      await stopVideo();
      setPlaybackError(null);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    }
  }

  async function submitExport(): Promise<void> {
    if (duration <= 0 || trimEnd <= trimStart) {
      setExportState('error');
      setExportMessage(
        'Load a valid video and choose a non-zero trim range before exporting.',
      );
      return;
    }

    setExportDialogOpen(false);
    setExportState('exporting');
    setExportMessage('Exporting trimmed MP4…');

    try {
      const result = await exportExplorerVideoTrim({
        inputPath: videoPath,
        outputPath: exportPathInput.trim(),
        startTimeSeconds: trimStart,
        endTimeSeconds: trimEnd,
        overwriteExisting: true,
      });
      setExportState('saved');
      setExportMessage(
        `Saved ${result.durationSeconds.toFixed(2)}s trim to ${result.outputPath}`,
      );
      await onExported?.(result.outputPath);
    } catch (error) {
      setExportState('error');
      setExportMessage(String(error));
    }
  }

  const selectionDuration = Math.max(0, trimEnd - trimStart);
  const timelineTicks = buildTimelineTicks(duration);
  const selectionLeft = duration > 0 ? `${(trimStart / duration) * 100}%` : '0%';
  const selectionWidth =
    duration > 0 ? `${(selectionDuration / duration) * 100}%` : '0%';
  const playheadLeft = duration > 0 ? `${(currentTime / duration) * 100}%` : '0%';
  const transportLabel =
    previewSourceKind === 'proxy'
      ? snapshot.audioTransportReady
        ? 'Proxy Preview + Audio'
        : snapshot.hasAudioTrack
          ? 'Proxy Preview + Media Audio'
          : 'Proxy Preview'
      : snapshot.audioTransportReady
        ? 'Direct Preview + Audio'
        : snapshot.hasAudioTrack
          ? 'Direct Preview + Media Audio'
          : 'Direct Preview';
  const previewNoticeMessage = snapshot.audioTransportReady
    ? null
    : snapshot.hasAudioTrack
      ? snapshot.audioTransportError ??
        'The Rust audio deck could not lock onto this clip. The preview surface will carry audio when it can.'
      : 'This video has no embedded audio track.';
  const playbackStatusMessage =
    playbackError ??
    snapshot.engineError ??
    (snapshot.isLoading
      ? 'Loading video metadata and transport state…'
      : isGeneratingProxy
        ? 'Generating a compatibility MP4 preview…'
        : isResolvingPreview
          ? 'Resolving the best preview source…'
          : !previewSource
            ? 'Using the direct file preview surface.'
            : !previewSurfaceReady
              ? previewSourceKind === 'proxy'
                ? 'Compatibility preview ready. Waiting for the first frame…'
                : 'Preview source ready. Waiting for the first frame…'
              : previewSourceKind === 'proxy'
                ? 'Compatibility preview ready. Rust transport is driving the proxy surface.'
                : 'Preview ready. Rust transport is driving the media surface.');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        background: 'var(--overlay-explorer-preview-bg)',
      }}
    >
      <div style={{ minHeight: 0, padding: 16, display: 'grid', gap: 14 }}>
        <div
          style={{
            minHeight: 0,
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            padding: 'clamp(12px, 2vw, 18px)',
            borderRadius: 'var(--overlay-explorer-panel-radius)',
            border: '1px solid var(--overlay-explorer-chip-border)',
            background:
              'linear-gradient(180deg, rgba(10, 12, 18, 0.94), rgba(5, 7, 11, 0.98))',
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              minHeight: 0,
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: previewAspectRatio,
            }}
          >
            <div
              aria-hidden
              style={{
                ...previewSurfaceStyle(),
                position: 'absolute',
                inset: 0,
              }}
            />
            <video
              ref={videoRef}
              key={playbackSource}
              preload="metadata"
              playsInline
              muted={snapshot.audioTransportReady}
              aria-label={`Video preview player for ${videoName}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: 'transparent',
              }}
              onLoadedData={() => {
                setPreviewSurfaceReady(true);
                setPlaybackError(null);
              }}
              onError={(event) => {
                const nextErrorLabel = getVideoPlaybackErrorLabel(event.currentTarget.error);
                setPreviewSurfaceReady(false);
                setPlaybackError(nextErrorLabel);
                if (previewSourceKind === 'direct') {
                  void ensurePlaybackProxy();
                }
              }}
            >
              <source src={playbackSource} type={playbackMimeType ?? undefined} />
              This video preview is not supported by the current desktop media surface.
            </video>
          </div>
          {!previewSurfaceReady ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                padding: 24,
                textAlign: 'center',
                color: 'var(--overlay-text-muted)',
                background: 'linear-gradient(180deg, rgba(8, 10, 16, 0.1), rgba(8, 10, 16, 0.45))',
              }}
            >
              <div style={{ display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--overlay-text-primary)',
                  }}
                >
                  <Clapperboard size={14} />
                  Native Video Runtime
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                  {playbackError ??
                    (isGeneratingProxy
                      ? 'Generating a compatibility preview for this clip…'
                      : isResolvingPreview
                        ? 'Resolving the best preview source…'
                        : snapshot.isLoading
                          ? 'Preparing metadata and transport state…'
                          : 'Waiting for the preview surface to paint the first frame.')}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            padding: 14,
            borderRadius: 'var(--overlay-explorer-panel-radius)',
            border: '1px solid var(--overlay-explorer-chip-border)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'grid', gap: 4 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--overlay-text-primary)',
                }}
              >
                <Clapperboard size={14} />
                Video Timeline
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--overlay-text-muted)',
                }}
              >
                {videoExtension.toUpperCase()} · {formatSize(videoSize)} · {transportLabel} ·
                Selection {formatTimelineTimestamp(selectionDuration)}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  void syncCurrentTime(trimStart);
                }}
                style={toolbarButtonStyle()}
              >
                <SkipBack size={13} />
                Start
              </button>
              <button type="button" onClick={() => void togglePlayback()} style={toolbarButtonStyle(true)}>
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void syncCurrentTime(trimEnd);
                }}
                style={toolbarButtonStyle()}
              >
                <SkipForward size={13} />
                End
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextEnabled = !loopSelection;
                  setLoopSelection(nextEnabled);
                  void applyLoopRegion(trimStartRef.current, trimEndRef.current, nextEnabled);
                }}
                style={toolbarButtonStyle(loopSelection)}
              >
                <Scissors size={13} />
                {loopSelection ? 'Loop On' : 'Loop Off'}
              </button>
              <button type="button" onClick={() => void resetTransport()} style={toolbarButtonStyle()}>
                <RotateCcw size={13} />
                Reset
              </button>
              <button
                type="button"
                disabled={isGeneratingProxy || previewSourceKind === 'proxy'}
                onClick={() => {
                  void ensurePlaybackProxy();
                }}
                style={toolbarButtonStyle(previewSourceKind === 'proxy', 'primary')}
              >
                <Clapperboard size={13} />
                {previewSourceKind === 'proxy'
                  ? 'Proxy Ready'
                  : isGeneratingProxy
                    ? 'Proxying…'
                    : 'Make Proxy'}
              </button>
              <button type="button" disabled style={toolbarButtonStyle(false, 'primary')}>
                {snapshot.audioTransportReady ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {snapshot.audioTransportReady
                  ? 'Audio Linked'
                  : snapshot.hasAudioTrack
                    ? 'Media Audio'
                    : 'No Audio Track'}
              </button>
              <button
                type="button"
                onClick={() => setExportDialogOpen(true)}
                style={toolbarButtonStyle(false, 'primary')}
              >
                <Save size={13} />
                Export Trim
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                fontSize: 10,
                color: 'var(--overlay-text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {timelineTicks.map((tick) => (
                <span key={tick}>{formatTimelineTimestamp(tick)}</span>
              ))}
            </div>
            <div
              ref={timelineRef}
              role="slider"
              aria-label={`Video timeline for ${videoName}`}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
              style={{
                position: 'relative',
                height: 82,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 48px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  bottom: 18,
                  left: selectionLeft,
                  width: selectionWidth,
                  borderRadius: 12,
                  background:
                    'linear-gradient(135deg, rgba(53, 214, 144, 0.34), rgba(74, 169, 255, 0.28))',
                  border: '1px solid rgba(94, 255, 184, 0.34)',
                  boxShadow: '0 18px 28px rgba(20, 112, 86, 0.22)',
                }}
              />
              <div
                role="button"
                aria-label={`Trim start handle for ${videoName}`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  beginTimelineDrag('trimStart', event.clientX);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  bottom: 14,
                  left: selectionLeft,
                  width: 14,
                  transform: 'translateX(-50%)',
                  borderRadius: 10,
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(164,255,215,0.8))',
                  boxShadow: '0 0 0 2px rgba(20, 40, 28, 0.35)',
                }}
              />
              <div
                role="button"
                aria-label={`Trim end handle for ${videoName}`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  beginTimelineDrag('trimEnd', event.clientX);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  bottom: 14,
                  left: `calc(${selectionLeft} + ${selectionWidth})`,
                  width: 14,
                  transform: 'translateX(-50%)',
                  borderRadius: 10,
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(164,255,215,0.8))',
                  boxShadow: '0 0 0 2px rgba(20, 40, 28, 0.35)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  bottom: 8,
                  left: playheadLeft,
                  width: 2,
                  transform: 'translateX(-50%)',
                  background: 'rgba(255,255,255,0.96)',
                  boxShadow: '0 0 16px rgba(255,255,255,0.34)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -2,
                    left: '50%',
                    width: 12,
                    height: 12,
                    transform: 'translate(-50%, -50%) rotate(45deg)',
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.96)',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <button
              type="button"
              onClick={() => updateTrimRange(currentTime, trimEnd)}
              style={toolbarButtonStyle()}
            >
              Set In
            </button>
            <button
              type="button"
              onClick={() => updateTrimRange(trimStart, currentTime)}
              style={toolbarButtonStyle()}
            >
              Set Out
            </button>
            <button
              type="button"
              onClick={() => {
                void syncCurrentTime(Math.max(0, currentTime - 1));
              }}
              style={toolbarButtonStyle()}
            >
              -1.0s
            </button>
            <button
              type="button"
              onClick={() => {
                void syncCurrentTime(Math.min(duration, currentTime + 1));
              }}
              style={toolbarButtonStyle()}
            >
              +1.0s
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {[
              { label: 'Current', value: formatTimelineTimestamp(currentTime) },
              { label: 'Trim Start', value: formatTimelineTimestamp(trimStart) },
              { label: 'Trim End', value: formatTimelineTimestamp(trimEnd) },
              { label: 'Duration', value: formatTimelineTimestamp(duration) },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--overlay-text-dim)',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--overlay-text-primary)',
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gap: 4,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                color:
                  playbackError || snapshot.engineError
                    ? 'var(--overlay-danger)'
                    : 'var(--overlay-text-muted)',
              }}
            >
              {playbackStatusMessage}
            </div>
            {previewNoticeMessage ? (
              <div style={{ color: 'var(--overlay-text-dim)' }}>{previewNoticeMessage}</div>
            ) : null}
            <div
              style={{
                color:
                  exportState === 'error'
                    ? 'var(--overlay-danger)'
                    : 'var(--overlay-text-muted)',
              }}
            >
              {exportMessage}
            </div>
          </div>
        </div>
      </div>

      <AppPromptDialog
        open={exportDialogOpen}
        title="Export Trimmed Video"
        description="Write a sibling MP4 using the native ffmpeg export path."
        value={exportPathInput}
        placeholder={buildTrimmedVideoOutputPath(videoPath)}
        submitLabel={exportState === 'exporting' ? 'Exporting…' : 'Export Trim'}
        cancelLabel="Cancel"
        onChange={setExportPathInput}
        onSubmit={() => {
          void submitExport();
        }}
        onCancel={() => setExportDialogOpen(false)}
      />
    </div>
  );
}
