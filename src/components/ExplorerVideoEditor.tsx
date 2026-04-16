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
} from 'lucide-react';
import { AppPromptDialog } from './AppModal';
import { exportExplorerVideoTrim } from '../runtime/videoEditorBackend';

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
      return 'Video playback was aborted before preview could start.';
    case 2:
      return 'The video preview could not finish loading because the media request failed.';
    case 3:
      return 'The video loaded, but the embedded codec could not be decoded by this desktop webview.';
    case 4:
      return 'This video format is not supported by the current desktop webview.';
    default:
      return 'This video preview could not be played by the current desktop webview.';
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

function toolbarButtonStyle(active = false, emphasis: 'default' | 'primary' = 'default'): CSSProperties {
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 11px',
    borderRadius: 10,
    border: `1px solid ${active || emphasis === 'primary' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)'}`,
    background: emphasis === 'primary'
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

export function ExplorerVideoEditor({
  videoPath,
  videoName,
  videoSource,
  videoExtension,
  videoMimeType,
  videoSize,
  onExported,
}: ExplorerVideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSelection, setLoopSelection] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Loading video metadata…');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<VideoExportState>('idle');
  const [exportMessage, setExportMessage] = useState('Trim export writes a sibling MP4 so the source file stays untouched.');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportPathInput, setExportPathInput] = useState(() => buildTrimmedVideoOutputPath(videoPath));

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
    setDuration(0);
    setCurrentTime(0);
    setTrimStart(0);
    setTrimEnd(0);
    setIsPlaying(false);
    setPlaybackError(null);
    setExportState('idle');
    setExportMessage('Trim export writes a sibling MP4 so the source file stays untouched.');
    setStatusMessage('Loading video metadata…');
    setExportPathInput(buildTrimmedVideoOutputPath(videoPath));
  }, [videoPath]);

  useEffect(() => () => {
    videoRef.current?.pause();
  }, []);

  function syncCurrentTime(nextTime: number) {
    const video = videoRef.current;
    const boundedTime = clamp(nextTime, 0, durationRef.current || 0);
    if (video) {
      video.currentTime = boundedTime;
    }
    setCurrentTime(boundedTime);
  }

  function updateTrimRange(nextStart: number, nextEnd: number) {
    const boundedEnd = clamp(nextEnd, 0, durationRef.current || 0);
    const boundedStart = clamp(nextStart, 0, Math.max(0, boundedEnd - MINIMUM_TRIM_DURATION_SECONDS));
    const finalEnd = clamp(
      boundedEnd,
      Math.min(durationRef.current || 0, boundedStart + MINIMUM_TRIM_DURATION_SECONDS),
      durationRef.current || 0,
    );

    setTrimStart(boundedStart);
    setTrimEnd(finalEnd);
    setCurrentTime((previousTime) => clamp(previousTime, boundedStart, finalEnd));
    if (videoRef.current) {
      videoRef.current.currentTime = clamp(videoRef.current.currentTime, boundedStart, finalEnd);
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
        syncCurrentTime(nextTime);
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
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }
    if (currentTime >= trimEndRef.current && trimEndRef.current > trimStartRef.current) {
      syncCurrentTime(trimStartRef.current);
    }
    try {
      await video.play();
      setPlaybackError(null);
      setIsPlaying(true);
    } catch (error) {
      setPlaybackError(String(error));
      setStatusMessage('Playback could not start.');
      setIsPlaying(false);
    }
  }

  async function submitExport() {
    if (duration <= 0 || trimEnd <= trimStart) {
      setExportState('error');
      setExportMessage('Load a valid video and choose a non-zero trim range before exporting.');
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
      setExportMessage(`Saved ${result.durationSeconds.toFixed(2)}s trim to ${result.outputPath}`);
      await onExported?.(result.outputPath);
    } catch (error) {
      setExportState('error');
      setExportMessage(String(error));
    }
  }

  const selectionDuration = Math.max(0, trimEnd - trimStart);
  const timelineTicks = buildTimelineTicks(duration);
  const selectionLeft = duration > 0 ? `${(trimStart / duration) * 100}%` : '0%';
  const selectionWidth = duration > 0 ? `${(selectionDuration / duration) * 100}%` : '0%';
  const playheadLeft = duration > 0 ? `${(currentTime / duration) * 100}%` : '0%';

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', background: 'var(--overlay-explorer-preview-bg)' }}>
      <div style={{ minHeight: 0, padding: 16, display: 'grid', gap: 14 }}>
        <div style={{ minHeight: 0, borderRadius: 'var(--overlay-explorer-panel-radius)', border: '1px solid var(--overlay-explorer-chip-border)', background: 'linear-gradient(180deg, rgba(10, 12, 18, 0.94), rgba(5, 7, 11, 0.98))', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.28)' }}>
          <video
            ref={videoRef}
            preload="metadata"
            aria-label={`Video preview player for ${videoName}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 52%), rgba(0,0,0,0.76)' }}
            onLoadedMetadata={(event) => {
              const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
              setDuration(nextDuration);
              setTrimStart(0);
              setTrimEnd(nextDuration);
              setCurrentTime(0);
              setStatusMessage('Ready to scrub, trim, and export.');
              setPlaybackError(null);
            }}
            onTimeUpdate={(event) => {
              const nextTime = event.currentTarget.currentTime;
              const nextTrimEnd = trimEndRef.current;
              const nextTrimStart = trimStartRef.current;
              if (loopSelection && nextTrimEnd > nextTrimStart && nextTime >= nextTrimEnd) {
                event.currentTarget.currentTime = nextTrimStart;
                setCurrentTime(nextTrimStart);
                return;
              }
              if (nextTrimEnd > nextTrimStart && nextTime > nextTrimEnd) {
                event.currentTarget.pause();
                event.currentTarget.currentTime = nextTrimEnd;
                setCurrentTime(nextTrimEnd);
                setIsPlaying(false);
                return;
              }
              setCurrentTime(nextTime);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              if (trimEndRef.current > trimStartRef.current) {
                syncCurrentTime(trimStartRef.current);
              }
            }}
            onError={(event) => {
              setPlaybackError(getVideoPlaybackErrorLabel(event.currentTarget.error));
              setStatusMessage('Preview playback failed.');
            }}
          >
            <source src={videoSource} type={videoMimeType ?? undefined} />
            This video preview is not supported by the current desktop webview.
          </video>
        </div>

        <div style={{ display: 'grid', gap: 12, padding: 14, borderRadius: 'var(--overlay-explorer-panel-radius)', border: '1px solid var(--overlay-explorer-chip-border)', background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
                <Clapperboard size={14} />
                Video Timeline
              </div>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>
                {videoExtension.toUpperCase()} · {formatSize(videoSize)} · Selection {formatTimelineTimestamp(selectionDuration)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => syncCurrentTime(trimStart)} style={toolbarButtonStyle()}>
                <SkipBack size={13} />
                Start
              </button>
              <button type="button" onClick={togglePlayback} style={toolbarButtonStyle(true)}>
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={() => syncCurrentTime(trimEnd)} style={toolbarButtonStyle()}>
                <SkipForward size={13} />
                End
              </button>
              <button type="button" onClick={() => setLoopSelection((current) => !current)} style={toolbarButtonStyle(loopSelection)}>
                <Scissors size={13} />
                {loopSelection ? 'Loop On' : 'Loop Off'}
              </button>
              <button type="button" onClick={() => updateTrimRange(0, duration)} style={toolbarButtonStyle()}>
                <RotateCcw size={13} />
                Reset
              </button>
              <button type="button" onClick={() => setExportDialogOpen(true)} style={toolbarButtonStyle(false, 'primary')}>
                <Save size={13} />
                Export Trim
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 10, color: 'var(--overlay-text-muted)', fontFamily: 'monospace' }}>
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
              style={{ position: 'relative', height: 82, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))', overflow: 'hidden', cursor: 'pointer' }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 48px)' }} />
              <div style={{ position: 'absolute', top: 12, bottom: 18, left: selectionLeft, width: selectionWidth, borderRadius: 12, background: 'linear-gradient(135deg, rgba(53, 214, 144, 0.34), rgba(74, 169, 255, 0.28))', border: '1px solid rgba(94, 255, 184, 0.34)', boxShadow: '0 18px 28px rgba(20, 112, 86, 0.22)' }} />
              <div
                role="button"
                aria-label={`Trim start handle for ${videoName}`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  beginTimelineDrag('trimStart', event.clientX);
                }}
                style={{ position: 'absolute', top: 8, bottom: 14, left: selectionLeft, width: 14, transform: 'translateX(-50%)', borderRadius: 10, background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(164,255,215,0.8))', boxShadow: '0 0 0 2px rgba(20, 40, 28, 0.35)' }}
              />
              <div
                role="button"
                aria-label={`Trim end handle for ${videoName}`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  beginTimelineDrag('trimEnd', event.clientX);
                }}
                style={{ position: 'absolute', top: 8, bottom: 14, left: `calc(${selectionLeft} + ${selectionWidth})`, width: 14, transform: 'translateX(-50%)', borderRadius: 10, background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(164,255,215,0.8))', boxShadow: '0 0 0 2px rgba(20, 40, 28, 0.35)' }}
              />
              <div style={{ position: 'absolute', top: 8, bottom: 8, left: playheadLeft, width: 2, transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.96)', boxShadow: '0 0 16px rgba(255,255,255,0.34)' }}>
                <div style={{ position: 'absolute', top: -2, left: '50%', width: 12, height: 12, transform: 'translate(-50%, -50%) rotate(45deg)', borderRadius: 3, background: 'rgba(255,255,255,0.96)' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <button type="button" onClick={() => updateTrimRange(currentTime, trimEnd)} style={toolbarButtonStyle()}>
              Set In
            </button>
            <button type="button" onClick={() => updateTrimRange(trimStart, currentTime)} style={toolbarButtonStyle()}>
              Set Out
            </button>
            <button type="button" onClick={() => syncCurrentTime(Math.max(0, currentTime - 1))} style={toolbarButtonStyle()}>
              -1.0s
            </button>
            <button type="button" onClick={() => syncCurrentTime(Math.min(duration, currentTime + 1))} style={toolbarButtonStyle()}>
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
              <div key={item.label} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>{item.label}</div>
                <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 4, fontSize: 11, lineHeight: 1.5, color: playbackError || exportState === 'error' ? 'var(--overlay-danger)' : 'var(--overlay-text-muted)' }}>
            <div>{playbackError ?? statusMessage}</div>
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
