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
import { exportExplorerVideoTrim } from '../runtime/videoEditorBackend';
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

function previewSurfaceStyle(previewImageUrl: string | null): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    background: previewImageUrl
      ? `radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 52%), rgba(0,0,0,0.76) center / contain no-repeat url("${previewImageUrl}")`
      : 'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 52%), rgba(0,0,0,0.76)',
  };
}

export function ExplorerVideoEditor({
  videoPath,
  videoName,
  videoExtension,
  videoSize,
  onExported,
}: ExplorerVideoEditorProps) {
  useVideoEngineFeed();

  const snapshot = useVideoEngineSnapshot();
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const loadRequestTokenRef = useRef(0);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [loopSelection, setLoopSelection] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Preparing native video engine…');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<VideoExportState>('idle');
  const [exportMessage, setExportMessage] = useState(
    'Trim export writes a sibling MP4 so the source file stays untouched.',
  );
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportPathInput, setExportPathInput] = useState(() =>
    buildTrimmedVideoOutputPath(videoPath),
  );

  const duration = snapshot.loadedPath === videoPath ? snapshot.durationSeconds : 0;
  const currentTime =
    snapshot.loadedPath === videoPath ? snapshot.currentTimeSeconds : 0;
  const isPlaying = snapshot.loadedPath === videoPath && snapshot.isPlaying;
  const previewImageUrl =
    snapshot.loadedPath === videoPath && snapshot.previewFramePath
      ? buildFilePreviewUrl(snapshot.previewFramePath)
      : null;

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    trimStartRef.current = trimStart;
  }, [trimStart]);

  useEffect(() => {
    trimEndRef.current = trimEnd;
  }, [trimEnd]);

  useEffect(() => {
    let cancelled = false;
    const requestToken = loadRequestTokenRef.current + 1;
    loadRequestTokenRef.current = requestToken;

    setTrimStart(0);
    setTrimEnd(0);
    setLoopSelection(true);
    setPlaybackError(null);
    setExportState('idle');
    setExportMessage(
      'Trim export writes a sibling MP4 so the source file stays untouched.',
    );
    setStatusMessage('Preparing native video engine…');
    setExportPathInput(buildTrimmedVideoOutputPath(videoPath));

    async function loadNativeVideoSource(): Promise<void> {
      try {
        const nextSnapshot = await loadVideoSource(videoPath);
        if (cancelled || loadRequestTokenRef.current !== requestToken) {
          return;
        }
        setTrimStart(0);
        setTrimEnd(nextSnapshot.durationSeconds);
        setPlaybackError(null);
        setStatusMessage(
          nextSnapshot.audioTransportReady
            ? 'Native preview ready. Rust owns transport and timing.'
            : 'Native preview ready. Rust owns timing; audio transport is unavailable for this file.',
        );
        if (nextSnapshot.durationSeconds > 0) {
          await setVideoLoopRegion(0, nextSnapshot.durationSeconds, true);
        }
      } catch (error) {
        if (cancelled || loadRequestTokenRef.current !== requestToken) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setPlaybackError(message);
        setStatusMessage('Native video load failed.');
      }
    }

    void loadNativeVideoSource();

    return () => {
      cancelled = true;
    };
  }, [videoPath]);

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

  async function syncCurrentTime(nextTime: number) {
    const boundedTime = clamp(nextTime, 0, durationRef.current || 0);
    try {
      await seekVideo(boundedTime);
      setPlaybackError(null);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    }
  }

  function updateTrimRange(nextStart: number, nextEnd: number) {
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

  function beginTimelineDrag(mode: TimelineDragMode, clientX: number) {
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

  async function togglePlayback() {
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
      setStatusMessage('Native playback could not start.');
    }
  }

  async function resetTransport() {
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

  async function submitExport() {
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
  const transportLabel = snapshot.audioTransportReady
    ? 'Native Preview + Audio'
    : 'Native Preview';
  const playbackStatusMessage =
    playbackError ??
    snapshot.engineError ??
    (snapshot.isLoading
      ? 'Generating native preview frames…'
      : snapshot.audioTransportReady
        ? statusMessage
        : `${statusMessage} Silent timing fallback is active.`);

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
            borderRadius: 'var(--overlay-explorer-panel-radius)',
            border: '1px solid var(--overlay-explorer-chip-border)',
            background:
              'linear-gradient(180deg, rgba(10, 12, 18, 0.94), rgba(5, 7, 11, 0.98))',
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
          }}
        >
          <div
            aria-label={`Native video preview frame for ${videoName}`}
            style={previewSurfaceStyle(previewImageUrl)}
          />
          {!previewImageUrl ? (
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
                  {snapshot.isLoading
                    ? 'Preparing frame sequence preview…'
                    : 'No preview frame is available yet for this selection.'}
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
              <button type="button" onClick={togglePlayback} style={toolbarButtonStyle(true)}>
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
              <button type="button" disabled style={toolbarButtonStyle(false, 'primary')}>
                {snapshot.audioTransportReady ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {snapshot.audioTransportReady ? 'Audio Linked' : 'Silent Timing'}
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
              color:
                playbackError || exportState === 'error'
                  ? 'var(--overlay-danger)'
                  : 'var(--overlay-text-muted)',
            }}
          >
            <div>{playbackStatusMessage}</div>
            <div>{exportMessage}</div>
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
