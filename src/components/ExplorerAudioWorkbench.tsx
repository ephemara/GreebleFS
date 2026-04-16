import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  AudioLines,
  Pause,
  Play,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  EXPLORER_AUDIO_EXPORT_FORMATS,
  getExplorerAudioExportFormatDefinition,
} from '../config/filePreview';
import {
  analyzeExplorerAudioPreview,
  createExplorerAudioPreviewProxy,
  exportExplorerAudioTransform,
  resolveExplorerAudioPreviewSource,
  type ExplorerAudioPreviewAnalysis,
  type ExplorerAudioPreviewSource,
} from '../runtime/audioWorkbenchBackend';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';

type ExplorerAudioWorkbenchProps = {
  audioPath: string;
  audioName: string;
  audioSource: string;
  audioExtension: string;
  audioMimeType: string | null;
  audioSize: number;
  onExported?: (outputPath: string) => Promise<void> | void;
};

type ExportDialogMode = 'clip' | 'normalized' | 'convert' | 'overwrite' | null;
type TimelineDragMode = 'playhead' | 'selectionStart' | 'selectionEnd';
type ExportState = 'idle' | 'running' | 'saved' | 'error';

const MINIMUM_SELECTION_SECONDS = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return 'n/a';
  }
  return `${value.toFixed(1)} dB`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getAudioPlaybackErrorLabel(audioError: MediaError | null): string {
  switch (audioError?.code) {
    case 1:
      return 'Audio playback was aborted before preview could start.';
    case 2:
      return 'The audio preview could not finish loading because the media request failed.';
    case 3:
      return 'This audio file loaded, but the embedded codec could not be decoded by the desktop webview.';
    case 4:
      return 'This audio format is not supported directly by the current desktop webview.';
    default:
      return 'This audio preview could not be played by the current desktop webview.';
  }
}

function buildAudioOutputPath(sourcePath: string, suffix: string, extension: string): string {
  const match = sourcePath.match(/^(.*[/\\])?([^/\\]+)$/);
  const parentPath = match?.[1] ?? '';
  const leafName = match?.[2] ?? sourcePath;
  const stem = leafName.replace(/\.[^.]+$/, '');
  return `${parentPath}${stem}.${suffix}.${extension}`;
}

function toolbarButtonStyle(emphasis: 'default' | 'primary' | 'danger' = 'default'): CSSProperties {
  const tone = emphasis === 'primary'
    ? {
        border: 'rgba(255,255,255,0.22)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))',
      }
    : emphasis === 'danger'
      ? {
          border: 'rgba(255, 120, 120, 0.35)',
          background: 'linear-gradient(135deg, rgba(140, 28, 28, 0.72), rgba(72, 12, 12, 0.86))',
        }
      : {
          border: 'rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)',
        };
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 11px',
    borderRadius: 11,
    border: `1px solid ${tone.border}`,
    background: tone.background,
    color: 'var(--overlay-text-primary)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.01em',
    boxShadow: '0 10px 24px rgba(0,0,0,0.24)',
  };
}

function metricCardStyle(): CSSProperties {
  return {
    borderRadius: 14,
    border: '1px solid var(--overlay-explorer-chip-border)',
    background: 'rgba(255,255,255,0.04)',
    padding: '10px 12px',
    display: 'grid',
    gap: 4,
  };
}

export function ExplorerAudioWorkbench({
  audioPath,
  audioName,
  audioSource,
  audioExtension,
  audioMimeType,
  audioSize,
  onExported,
}: ExplorerAudioWorkbenchProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const shouldResumePlaybackAfterSourceSwapRef = useRef(false);

  const [analysis, setAnalysis] = useState<ExplorerAudioPreviewAnalysis | null>(null);
  const [previewSource, setPreviewSource] = useState<ExplorerAudioPreviewSource | null>(null);
  const [playbackSource, setPlaybackSource] = useState(audioSource);
  const [playbackMimeType, setPlaybackMimeType] = useState<string | null>(audioMimeType);
  const [playbackStatus, setPlaybackStatus] = useState('Analyzing audio…');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingProxy, setIsGeneratingProxy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
  const [generateSpectrogram, setGenerateSpectrogram] = useState(true);
  const [convertFormat, setConvertFormat] = useState<'mp3' | 'wav' | 'flac' | 'ogg'>(DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID);
  const [exportDialogMode, setExportDialogMode] = useState<ExportDialogMode>(null);
  const [exportPathInput, setExportPathInput] = useState('');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportMessage, setExportMessage] = useState('Waveform, trim, and transform controls stay inside the explorer.');
  const [spectrogramSource, setSpectrogramSource] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAnalysis(null);
    setPreviewSource(null);
    setPlaybackSource(audioSource);
    setPlaybackMimeType(audioMimeType);
    setPlaybackStatus('Analyzing audio…');
    setPlaybackError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSelectionStart(0);
    setSelectionEnd(0);
    setFadeInSeconds(0);
    setFadeOutSeconds(0);
    setGenerateSpectrogram(true);
    setConvertFormat(DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID);
    setExportDialogMode(null);
    setExportPathInput(buildAudioOutputPath(audioPath, 'clip', DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID));
    setExportState('idle');
    setExportMessage('Waveform, trim, and transform controls stay inside the explorer.');
    setSpectrogramSource(null);

    async function loadAudioState() {
      setIsAnalyzing(true);
      try {
        const [resolvedSource, previewAnalysis] = await Promise.all([
          resolveExplorerAudioPreviewSource(audioPath),
          analyzeExplorerAudioPreview(audioPath),
        ]);
        if (cancelled) {
          return;
        }
        setPreviewSource(resolvedSource);
        setPlaybackSource(convertFileSrc(resolvedSource.sourcePath));
        setPlaybackMimeType(resolvedSource.mimeType ?? audioMimeType);
        setAnalysis(previewAnalysis);
        setDuration(previewAnalysis.durationSeconds);
        setSelectionEnd(previewAnalysis.durationSeconds);
        setPlaybackStatus('Ready to scrub, trim, normalize, convert, and export.');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPlaybackError(String(error));
        setPlaybackStatus('Audio analysis failed.');
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    }

    void loadAudioState();
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, [audioExtension, audioMimeType, audioName, audioPath, audioSource]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    audio.load();
    setIsPlaying(false);
    setCurrentTime(0);
    if (!shouldResumePlaybackAfterSourceSwapRef.current) {
      return;
    }
    shouldResumePlaybackAfterSourceSwapRef.current = false;
    const resumePlayback = async () => {
      try {
        await audio.play();
        setPlaybackError(null);
        setPlaybackStatus('Preview proxy ready.');
        setIsPlaying(true);
      } catch (error) {
        setPlaybackError(String(error));
        setPlaybackStatus('Playback could not start.');
        setIsPlaying(false);
      }
    };
    void resumePlayback();
  }, [playbackMimeType, playbackSource]);

  const waveformBuckets = analysis?.waveformBuckets ?? [];
  const effectiveDuration = duration > 0 ? duration : analysis?.durationSeconds ?? 0;
  const selectionDuration = Math.max(0, selectionEnd - selectionStart);
  const selectionLeft = effectiveDuration > 0 ? `${(selectionStart / effectiveDuration) * 100}%` : '0%';
  const selectionWidth = effectiveDuration > 0 ? `${(selectionDuration / effectiveDuration) * 100}%` : '0%';
  const playheadLeft = effectiveDuration > 0 ? `${(currentTime / effectiveDuration) * 100}%` : '0%';

  const analysisCards = useMemo(() => [
    { label: 'Duration', value: formatDuration(analysis?.durationSeconds ?? effectiveDuration) },
    { label: 'Sample Rate', value: analysis?.sampleRateHz ? `${analysis.sampleRateHz.toLocaleString()} Hz` : 'n/a' },
    { label: 'Channels', value: analysis?.channels ? `${analysis.channels}` : 'n/a' },
    {
      label: 'Encoding',
      value: [analysis?.encoding, analysis?.bitsPerSample ? `${analysis.bitsPerSample}-bit` : null].filter(Boolean).join(' · ') || 'n/a',
    },
    { label: 'Peak', value: formatDb(analysis?.peakLevel ? 20 * Math.log10(analysis.peakLevel) : null) },
    { label: 'RMS', value: formatDb(analysis?.loudnessDb) },
    { label: 'Headroom', value: formatDb(analysis?.headroomDb) },
    { label: 'File Size', value: formatSize(audioSize) },
  ], [analysis, audioSize, effectiveDuration]);

  function syncCurrentTime(nextTime: number) {
    const bounded = clamp(nextTime, 0, effectiveDuration || 0);
    if (audioRef.current) {
      audioRef.current.currentTime = bounded;
    }
    setCurrentTime(bounded);
  }

  function updateSelection(nextStart: number, nextEnd: number) {
    const boundedEnd = clamp(nextEnd, 0, effectiveDuration || 0);
    const boundedStart = clamp(nextStart, 0, Math.max(0, boundedEnd - MINIMUM_SELECTION_SECONDS));
    const finalEnd = clamp(
      boundedEnd,
      Math.min(effectiveDuration || 0, boundedStart + MINIMUM_SELECTION_SECONDS),
      effectiveDuration || 0,
    );
    setSelectionStart(boundedStart);
    setSelectionEnd(finalEnd);
    setCurrentTime((previous) => clamp(previous, boundedStart, finalEnd));
    if (audioRef.current) {
      audioRef.current.currentTime = clamp(audioRef.current.currentTime, boundedStart, finalEnd);
    }
  }

  function resolveTimeFromClientX(clientX: number): number {
    const timeline = timelineRef.current;
    if (!timeline || effectiveDuration <= 0) {
      return 0;
    }
    const rect = timeline.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * effectiveDuration;
  }

  function beginTimelineDrag(mode: TimelineDragMode, clientX: number) {
    const applyTime = (nextTime: number) => {
      if (mode === 'playhead') {
        syncCurrentTime(nextTime);
        return;
      }
      if (mode === 'selectionStart') {
        updateSelection(nextTime, selectionEnd);
        return;
      }
      updateSelection(selectionStart, nextTime);
    };
    applyTime(resolveTimeFromClientX(clientX));
    const handlePointerMove = (event: MouseEvent) => applyTime(resolveTimeFromClientX(event.clientX));
    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (currentTime >= selectionEnd && selectionEnd > selectionStart) {
      syncCurrentTime(selectionStart);
    }
    try {
      await audio.play();
      setPlaybackError(null);
      setIsPlaying(true);
    } catch (error) {
      setPlaybackError(String(error));
      setPlaybackStatus('Playback could not start.');
      setIsPlaying(false);
    }
  }

  async function ensurePlaybackProxy(resumePlayback = false) {
    if (isGeneratingProxy || previewSource?.sourceKind === 'proxy') {
      return;
    }
    shouldResumePlaybackAfterSourceSwapRef.current = resumePlayback;
    setIsGeneratingProxy(true);
    setPlaybackStatus('Generating SoX preview proxy…');
    try {
      const proxy = await createExplorerAudioPreviewProxy(audioPath);
      setPreviewSource(proxy);
      setPlaybackSource(convertFileSrc(proxy.sourcePath));
      setPlaybackMimeType(proxy.mimeType);
      setPlaybackError(null);
      setPlaybackStatus('Preview proxy ready.');
    } catch (error) {
      shouldResumePlaybackAfterSourceSwapRef.current = false;
      setPlaybackError(String(error));
      setPlaybackStatus('Preview proxy generation failed.');
    } finally {
      setIsGeneratingProxy(false);
    }
  }

  function openExportDialog(mode: Exclude<ExportDialogMode, null>) {
    const suffix = mode === 'clip' ? 'clip' : mode === 'normalized' ? 'normalized' : 'converted';
    const extension = mode === 'convert'
      ? getExplorerAudioExportFormatDefinition(convertFormat)?.extension ?? convertFormat
      : DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID;
    setExportPathInput(buildAudioOutputPath(audioPath, suffix, extension));
    setExportDialogMode(mode);
  }

  async function submitExport(mode: Exclude<ExportDialogMode, null>) {
    if (effectiveDuration <= 0) {
      setExportState('error');
      setExportMessage('Load a valid audio file before exporting.');
      return;
    }
    const nextOutputFormat = mode === 'convert'
      ? getExplorerAudioExportFormatDefinition(convertFormat)?.extension ?? convertFormat
      : DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID;
    setExportDialogMode(null);
    setExportState('running');
    setExportMessage('Running SoX transform…');
    try {
      const result = await exportExplorerAudioTransform({
        inputPath: audioPath,
        outputPath: exportPathInput.trim(),
        overwriteExisting: true,
        mode: mode === 'clip'
          ? 'exportClip'
          : mode === 'normalized'
            ? 'exportNormalized'
            : 'convertFormat',
        trimStartSeconds: selectionStart,
        trimEndSeconds: selectionEnd,
        fadeInSeconds,
        fadeOutSeconds,
        normalize: mode === 'normalized' ? true : null,
        outputFormat: nextOutputFormat,
        generateSpectrogram,
      });
      setExportState('saved');
      setExportMessage(`Saved audio output to ${result.outputPath}`);
      setSpectrogramSource(result.spectrogramPath ? convertFileSrc(result.spectrogramPath) : null);
      await onExported?.(result.outputPath);
    } catch (error) {
      setExportState('error');
      setExportMessage(String(error));
    }
  }

  async function submitOverwriteOriginal() {
    setExportDialogMode(null);
    setExportState('running');
    setExportMessage('Overwriting original audio with SoX…');
    try {
      const result = await exportExplorerAudioTransform({
        inputPath: audioPath,
        outputPath: audioPath,
        overwriteExisting: true,
        mode: 'overwriteOriginal',
        trimStartSeconds: selectionStart,
        trimEndSeconds: selectionEnd,
        fadeInSeconds,
        fadeOutSeconds,
        normalize: true,
        outputFormat: audioExtension || 'wav',
        generateSpectrogram,
      });
      setExportState('saved');
      setExportMessage(`Overwrote ${audioName} in place.`);
      setSpectrogramSource(result.spectrogramPath ? convertFileSrc(result.spectrogramPath) : null);
      await onExported?.(result.outputPath);
    } catch (error) {
      setExportState('error');
      setExportMessage(String(error));
    }
  }

  return (
    <>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1fr) auto',
          background: 'var(--overlay-explorer-preview-bg)',
        }}
      >
        <div style={{ minHeight: 0, padding: 16, display: 'grid', gap: 14, overflow: 'auto' }}>
          <div style={{ display: 'grid', gap: 12, minHeight: 0 }}>
            <div
              style={{
                minHeight: 220,
                borderRadius: 'var(--overlay-explorer-panel-radius)',
                border: '1px solid var(--overlay-explorer-chip-border)',
                background: 'linear-gradient(180deg, rgba(10, 12, 18, 0.94), rgba(5, 7, 11, 0.98))',
                padding: 18,
                display: 'grid',
                gap: 16,
                boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: 'var(--overlay-text-primary)' }}>
                    <AudioLines size={16} />
                    Audio Workbench
                  </div>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>
                    {audioExtension.toUpperCase()} · {formatSize(audioSize)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" style={toolbarButtonStyle()} onClick={() => syncCurrentTime(selectionStart)}>
                    <RotateCcw size={14} />
                    Jump To In
                  </button>
                  <button type="button" style={toolbarButtonStyle('primary')} onClick={togglePlayback}>
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                </div>
              </div>

              <audio
                ref={audioRef}
                preload="metadata"
                aria-label={`Audio preview player for ${audioName}`}
                onLoadedMetadata={(event) => {
                  const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                  setDuration(nextDuration);
                  if (selectionEnd <= 0) {
                    setSelectionEnd(nextDuration);
                  }
                }}
                onTimeUpdate={(event) => {
                  const nextTime = event.currentTarget.currentTime;
                  if (selectionEnd > selectionStart && nextTime >= selectionEnd) {
                    event.currentTarget.currentTime = selectionStart;
                    setCurrentTime(selectionStart);
                    return;
                  }
                  setCurrentTime(nextTime);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                src={playbackSource}
                onError={(event) => {
                  const nextError = getAudioPlaybackErrorLabel(event.currentTarget.error);
                  setPlaybackError(nextError);
                  setPlaybackStatus('Direct preview failed. Falling back to preview proxy…');
                  void ensurePlaybackProxy(true);
                }}
                style={{ width: '100%' }}
                type={playbackMimeType ?? undefined}
              >
                This audio preview is not supported by the current desktop webview.
              </audio>

              <div style={{ display: 'grid', gap: 10 }}>
                <div
                  ref={timelineRef}
                  role="presentation"
                  onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
                  style={{
                    position: 'relative',
                    height: 120,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 2,
                    padding: '18px 12px',
                  }}
                >
                  {waveformBuckets.length > 0 ? waveformBuckets.map((bucket) => (
                    <div
                      key={bucket.index}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 2,
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(8, bucket.peakLevel * 100)}%`,
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, rgba(123, 205, 255, 0.9), rgba(66, 151, 255, 0.28))',
                          opacity: bucket.rmsLevel > 0.05 ? 1 : 0.55,
                        }}
                      />
                    </div>
                  )) : (
                    <div style={{ display: 'grid', placeItems: 'center', width: '100%', color: 'var(--overlay-text-muted)', fontSize: 12 }}>
                      {isAnalyzing ? 'Building waveform…' : 'Waveform unavailable'}
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      bottom: 10,
                      left: selectionLeft,
                      width: selectionWidth,
                      borderRadius: 12,
                      background: 'rgba(92, 167, 255, 0.14)',
                      border: '1px solid rgba(92, 167, 255, 0.42)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    role="presentation"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      beginTimelineDrag('selectionStart', event.clientX);
                    }}
                    style={{
                      position: 'absolute',
                      top: 14,
                      bottom: 14,
                      left: selectionLeft,
                      width: 10,
                      marginLeft: -5,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.92)',
                      boxShadow: '0 0 0 3px rgba(92, 167, 255, 0.22)',
                      cursor: 'ew-resize',
                    }}
                  />
                  <div
                    role="presentation"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      beginTimelineDrag('selectionEnd', event.clientX);
                    }}
                    style={{
                      position: 'absolute',
                      top: 14,
                      bottom: 14,
                      left: `calc(${selectionLeft} + ${selectionWidth})`,
                      width: 10,
                      marginLeft: -5,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.92)',
                      boxShadow: '0 0 0 3px rgba(92, 167, 255, 0.22)',
                      cursor: 'ew-resize',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      bottom: 6,
                      left: playheadLeft,
                      width: 2,
                      background: 'rgba(255,255,255,0.92)',
                      boxShadow: '0 0 12px rgba(255,255,255,0.35)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                  <div style={metricCardStyle()}>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>Playhead</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{formatDuration(currentTime)}</div>
                  </div>
                  <div style={metricCardStyle()}>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>Selection In</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{formatDuration(selectionStart)}</div>
                  </div>
                  <div style={metricCardStyle()}>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>Selection Out</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{formatDuration(selectionEnd)}</div>
                  </div>
                  <div style={metricCardStyle()}>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>Selection Length</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{formatDuration(selectionDuration)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                  {analysisCards.map((card) => (
                    <div key={card.label} style={metricCardStyle()}>
                      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>{card.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 14,
                gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
              }}
            >
              <div
                style={{
                  borderRadius: 'var(--overlay-explorer-panel-radius)',
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: 16,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800 }}>
                  <Scissors size={15} />
                  Transform Controls
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    Fade In (s)
                    <input type="number" min="0" step="0.1" value={fadeInSeconds} onChange={(event) => setFadeInSeconds(Number(event.target.value) || 0)} style={inputStyle} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    Fade Out (s)
                    <input type="number" min="0" step="0.1" value={fadeOutSeconds} onChange={(event) => setFadeOutSeconds(Number(event.target.value) || 0)} style={inputStyle} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    Convert Format
                    <select value={convertFormat} onChange={(event) => setConvertFormat(event.target.value as 'mp3' | 'wav' | 'flac' | 'ogg')} style={inputStyle}>
                      {EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => (
                        <option key={format.id} value={format.id}>{format.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--overlay-text-primary)' }}>
                  <input type="checkbox" checked={generateSpectrogram} onChange={(event) => setGenerateSpectrogram(event.target.checked)} />
                  Generate spectrogram preview on export
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('clip')}>
                    <Scissors size={14} />
                    Export Clip
                  </button>
                  <button type="button" style={toolbarButtonStyle()} onClick={() => openExportDialog('normalized')}>
                    <Sparkles size={14} />
                    Export Normalized
                  </button>
                  <button type="button" style={toolbarButtonStyle()} onClick={() => openExportDialog('convert')}>
                    <Waves size={14} />
                    Convert Format
                  </button>
                  <button type="button" style={toolbarButtonStyle('danger')} onClick={() => setExportDialogMode('overwrite')}>
                    <Save size={14} />
                    Overwrite Original
                  </button>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 'var(--overlay-explorer-panel-radius)',
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: 16,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800 }}>
                  {playbackError ? <AlertTriangle size={15} /> : <AudioLines size={15} />}
                  Status
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: playbackError ? 'var(--overlay-danger-text, #ff8f8f)' : 'var(--overlay-text-muted)' }}>
                  {playbackError ?? playbackStatus}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: exportState === 'error' ? 'var(--overlay-danger-text, #ff8f8f)' : 'var(--overlay-text-muted)' }}>
                  {exportMessage}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {previewSource?.sourceKind === 'proxy' ? (
                    <span style={badgeStyle}>Proxy Playback</span>
                  ) : null}
                  {isGeneratingProxy ? <span style={badgeStyle}>Generating Proxy…</span> : null}
                  {isAnalyzing ? <span style={badgeStyle}>Analyzing…</span> : null}
                </div>
                {spectrogramSource ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>Spectrogram</div>
                    <img
                      src={spectrogramSource}
                      alt={`Spectrogram preview for ${audioName}`}
                      style={{
                        width: '100%',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.5)',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    Export with spectrogram enabled to render a frequency heatmap in the preview pane.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppPromptDialog
        open={exportDialogMode === 'clip' || exportDialogMode === 'normalized' || exportDialogMode === 'convert'}
        title={
          exportDialogMode === 'clip'
            ? 'Export Audio Clip'
            : exportDialogMode === 'normalized'
              ? 'Export Normalized Audio'
              : 'Convert Audio Format'
        }
        description={
          exportDialogMode === 'convert'
            ? `SoX will write a ${convertFormat.toUpperCase()} export using the current trim, fade, and spectrogram settings.`
            : 'Choose the output path for the new audio export.'
        }
        value={exportPathInput}
        onChange={setExportPathInput}
        onCancel={() => setExportDialogMode(null)}
        onSubmit={() => {
          if (exportDialogMode === 'clip' || exportDialogMode === 'normalized' || exportDialogMode === 'convert') {
            void submitExport(exportDialogMode);
          }
        }}
        submitLabel="Run SoX Export"
      />

      <AppConfirmDialog
        open={exportDialogMode === 'overwrite'}
        title="Overwrite Original Audio"
        tone="danger"
        confirmLabel="Overwrite Original"
        description={`This will rewrite ${audioName} in place using the current trim, fade, normalize, and spectrogram settings.`}
        onCancel={() => setExportDialogMode(null)}
        onConfirm={() => { void submitOverwriteOriginal(); }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--overlay-text-muted)' }}>
          The default flow is non-destructive export. Use this only when you want the selected file replaced.
        </div>
      </AppConfirmDialog>
    </>
  );
}

const inputStyle: CSSProperties = {
  appearance: 'none',
  width: '100%',
  borderRadius: 10,
  border: '1px solid var(--overlay-explorer-chip-border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--overlay-text-primary)',
  padding: '10px 12px',
  fontSize: 12,
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 8px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--overlay-text-muted)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
