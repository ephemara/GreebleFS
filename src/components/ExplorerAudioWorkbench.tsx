import { convertFileSrc } from '@tauri-apps/api/core';
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
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
import { matchesKeybinding } from '../config/hotkeys';
import {
  DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  EXPLORER_AUDIO_EXPORT_FORMATS,
  getExplorerAudioExportFormatDefinition,
} from '../config/filePreview';
import {
  analyzeExplorerAudioPreview,
  exportExplorerAudioTransform,
  type ExplorerAudioPreviewAnalysis,
} from '../runtime/audioWorkbenchBackend';
import {
  getAudioDeckState,
  loadSelectionIntoAudioDeck,
  pauseAudioDeck,
  playAudioDeck,
  seekAudioDeck,
  setAudioDeckGain,
  setAudioDeckLoopRegion,
  setAudioDeckRate,
  stopAudioDeck,
  useAudioEngineFeed,
  useAudioEngineSnapshot,
} from '../store/audioEngineStore';
import { useSettingsStore } from '../store/settingsStore';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';

type ExplorerAudioWorkbenchProps = {
  audioPath: string;
  audioName: string;
  audioExtension: string;
  audioSize: number;
  onExported?: (outputPath: string) => Promise<void> | void;
};

type ExportDialogMode = 'clip' | 'normalized' | 'convert' | 'overwrite' | null;
type TimelineDragMode = 'playhead' | 'selectionStart' | 'selectionEnd' | 'fadeIn' | 'fadeOut';
type ExportState = 'idle' | 'running' | 'saved' | 'error';
type AudioWorkbenchSummaryTone = 'default' | 'accent';

type AudioWorkbenchSummaryItem = {
  label: string;
  value: string;
  tone?: AudioWorkbenchSummaryTone;
};

const MINIMUM_SELECTION_SECONDS = 0.05;
const FADE_KEYBOARD_STEP_SECONDS = 0.1;
const FINE_TRIM_NUDGE_SECONDS = 0.01;
const SILENCE_REGION_PREVIEW_LIMIT = 6;

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
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  return `${(20 * Math.log10(value)).toFixed(1)} dB`;
}

function formatFadeDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0.00s';
  }
  if (seconds >= 60) {
    return formatDuration(seconds);
  }
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatPreciseSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return '0.000';
  }
  return seconds.toFixed(3);
}

function formatBpm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} BPM`;
}

function formatPitchShift(cents: number): string {
  if (!Number.isFinite(cents) || Math.abs(cents) < 0.5) {
    return 'Neutral';
  }
  const semitones = cents / 100;
  return `${semitones > 0 ? '+' : ''}${semitones.toFixed(2)} st`;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  return element.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
    || Boolean(element.closest('.monaco-editor'));
}

function buildAudioOutputPath(
  sourcePath: string,
  suffix: string,
  extension: string,
): string {
  const match = sourcePath.match(/^(.*[/\\])?([^/\\]+)$/);
  const parentPath = match?.[1] ?? '';
  const leafName = match?.[2] ?? sourcePath;
  const stem = leafName.replace(/\.[^.]+$/, '');
  return `${parentPath}${stem}.${suffix}.${extension}`;
}

function toolbarButtonStyle(
  emphasis: 'default' | 'primary' | 'danger' = 'default',
): CSSProperties {
  const tone =
    emphasis === 'primary'
      ? {
          border: 'rgba(255,255,255,0.22)',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))',
        }
      : emphasis === 'danger'
        ? {
            border: 'rgba(255, 120, 120, 0.35)',
            background:
              'linear-gradient(135deg, rgba(140, 28, 28, 0.72), rgba(72, 12, 12, 0.86))',
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
    borderRadius: 12,
    border: '1px solid var(--overlay-explorer-chip-border)',
    background: 'rgba(255,255,255,0.04)',
    padding: '8px 10px',
    display: 'grid',
    gap: 2,
    minWidth: 0,
  };
}

function summaryChipStyle(tone: AudioWorkbenchSummaryTone = 'default'): CSSProperties {
  const isAccent = tone === 'accent';
  return {
    borderRadius: 14,
    border: isAccent
      ? '1px solid rgba(123, 205, 255, 0.28)'
      : '1px solid var(--overlay-explorer-chip-border)',
    background: isAccent ? 'rgba(123, 205, 255, 0.08)' : 'rgba(255,255,255,0.04)',
    padding: '7px 10px',
    display: 'grid',
    gap: 2,
    minWidth: 0,
    flex: '0 1 170px',
  };
}

const summaryValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.2,
  color: 'var(--overlay-text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function fadeOverlayStyle(kind: 'in' | 'out'): CSSProperties {
  const isFadeIn = kind === 'in';
  return {
    position: 'absolute',
    top: 5,
    height: 14,
    borderRadius: 8,
    pointerEvents: 'none',
    background: isFadeIn
      ? 'linear-gradient(90deg, rgba(123, 205, 255, 0.02), rgba(123, 205, 255, 0.22))'
      : 'linear-gradient(90deg, rgba(255, 184, 92, 0.22), rgba(255, 184, 92, 0.02))',
    border: isFadeIn
      ? '1px solid rgba(123, 205, 255, 0.2)'
      : '1px solid rgba(255, 184, 92, 0.2)',
  };
}

function fadeHandleStyle(kind: 'in' | 'out'): CSSProperties {
  const isFadeIn = kind === 'in';
  return {
    position: 'absolute',
    top: 1,
    width: 16,
    height: 18,
    transform: 'translateX(-50%)',
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: isFadeIn
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(123, 205, 255, 0.86))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255, 184, 92, 0.86))',
    border: isFadeIn
      ? '1px solid rgba(123, 205, 255, 0.3)'
      : '1px solid rgba(255, 184, 92, 0.3)',
    boxShadow: isFadeIn
      ? '0 0 0 2px rgba(123, 205, 255, 0.16), 0 8px 18px rgba(0,0,0,0.22)'
      : '0 0 0 2px rgba(255, 184, 92, 0.16), 0 8px 18px rgba(0,0,0,0.22)',
    cursor: 'ew-resize',
    zIndex: 4,
  };
}

type AudioWorkbenchPlayheadMarkerHandle = {
  setPreviewSeconds: (seconds: number) => void;
  clearPreview: () => void;
};

type AudioWorkbenchPlayheadMarkerProps = {
  currentTimeSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
};

type AudioWorkbenchWaveformBarsProps = {
  waveformBuckets: ExplorerAudioPreviewAnalysis['waveformBuckets'];
  isAnalyzing: boolean;
};

type AudioWorkbenchSpectralBarsProps = {
  spectralBands: number[];
};

const AudioWorkbenchWaveformBars = memo(function AudioWorkbenchWaveformBars({
  waveformBuckets,
  isAnalyzing,
}: AudioWorkbenchWaveformBarsProps) {
  if (waveformBuckets.length === 0) {
    return (
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          color: 'var(--overlay-text-muted)',
          fontSize: 12,
          minHeight: 108,
        }}
      >
        {isAnalyzing ? 'Building waveform…' : 'Waveform unavailable'}
      </div>
    );
  }

  return (
    <>
      {waveformBuckets.map((bucket) => (
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
              background:
                'linear-gradient(180deg, rgba(123, 205, 255, 0.9), rgba(66, 151, 255, 0.28))',
              opacity: bucket.rmsLevel > 0.05 ? 1 : 0.55,
            }}
          />
        </div>
      ))}
    </>
  );
});

const AudioWorkbenchSpectralBars = memo(function AudioWorkbenchSpectralBars({
  spectralBands,
}: AudioWorkbenchSpectralBarsProps) {
  if (spectralBands.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={miniLabelStyle}>Spectral Profile</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          gap: 4,
          height: 92,
          padding: '8px 10px',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(3, 7, 14, 0.72)',
        }}
      >
        {spectralBands.map((band, index) => (
          <div
            key={`${index}-${band}`}
            style={{
              flex: 1,
              height: `${Math.max(6, band * 100)}%`,
              borderRadius: 999,
              background:
                'linear-gradient(180deg, rgba(255, 224, 134, 0.95), rgba(94, 149, 255, 0.34))',
            }}
          />
        ))}
      </div>
    </div>
  );
});

const AudioWorkbenchPlayheadMarker = memo(
  forwardRef<AudioWorkbenchPlayheadMarkerHandle, AudioWorkbenchPlayheadMarkerProps>(
    function AudioWorkbenchPlayheadMarker(
      { currentTimeSeconds, durationSeconds, isPlaying, playbackRate },
      ref,
    ) {
      const playheadRef = useRef<HTMLDivElement | null>(null);
      const previewSecondsRef = useRef<number | null>(null);
      const playbackBaseSecondsRef = useRef(currentTimeSeconds);
      const playbackBaseTimestampRef = useRef(0);
      const playbackFrameRef = useRef<number | null>(null);

      function paint(seconds: number) {
        const node = playheadRef.current;
        if (!node || durationSeconds <= 0) {
          return;
        }
        const bounded = clamp(seconds, 0, durationSeconds);
        node.style.transform = `translate3d(${(bounded / durationSeconds) * 100}%, 0, 0)`;
      }

      useImperativeHandle(
        ref,
        () => ({
          setPreviewSeconds(seconds: number) {
            if (durationSeconds <= 0) {
              return;
            }
            const bounded = clamp(seconds, 0, durationSeconds);
            previewSecondsRef.current = bounded;
            paint(bounded);
          },
          clearPreview() {
            previewSecondsRef.current = null;
            paint(currentTimeSeconds);
          },
        }),
        [currentTimeSeconds, durationSeconds],
      );

      useLayoutEffect(() => {
        const bounded = clamp(currentTimeSeconds, 0, durationSeconds);
        playbackBaseSecondsRef.current = bounded;
        playbackBaseTimestampRef.current = performance.now();
        const previewSeconds = previewSecondsRef.current;
        if (previewSeconds == null) {
          paint(bounded);
        } else if (Math.abs(previewSeconds - bounded) < 0.02) {
          previewSecondsRef.current = null;
          paint(bounded);
        } else {
          paint(previewSeconds);
        }
      }, [currentTimeSeconds, durationSeconds]);

      useEffect(() => {
        if (!isPlaying || durationSeconds <= 0) {
          paint(previewSecondsRef.current ?? playbackBaseSecondsRef.current);
          return undefined;
        }

        const tick = (now: number) => {
          const previewSeconds = previewSecondsRef.current;
          const nextSeconds =
            previewSeconds != null
              ? previewSeconds
              : clamp(
                  playbackBaseSecondsRef.current +
                    ((now - playbackBaseTimestampRef.current) / 1000) * playbackRate,
                  0,
                  durationSeconds,
                );
          paint(nextSeconds);
          playbackFrameRef.current = window.requestAnimationFrame(tick);
        };

        playbackFrameRef.current = window.requestAnimationFrame(tick);
        return () => {
          if (playbackFrameRef.current != null) {
            window.cancelAnimationFrame(playbackFrameRef.current);
            playbackFrameRef.current = null;
          }
        };
      }, [durationSeconds, isPlaying, playbackRate]);

      return (
        <div
          ref={playheadRef}
          style={{
            position: 'absolute',
            inset: '6px 0',
            width: '100%',
            pointerEvents: 'none',
            transform: 'translate3d(0%, 0, 0)',
            willChange: 'transform',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 2,
              height: '100%',
              marginLeft: -1,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 0 12px rgba(255,255,255,0.35)',
            }}
          />
        </div>
      );
    },
  ),
);

export function ExplorerAudioWorkbench({
  audioPath,
  audioName,
  audioExtension,
  audioSize,
  onExported,
}: ExplorerAudioWorkbenchProps) {
  useAudioEngineFeed();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const snapshot = useAudioEngineSnapshot();
  const keybindings = useSettingsStore((state) => state.settings.keybindings);
  const activeDeckId = 'a' as const;

  const [analysis, setAnalysis] = useState<ExplorerAudioPreviewAnalysis | null>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
  const [pitchShiftCents, setPitchShiftCents] = useState(0);
  const [generateSpectrogram, setGenerateSpectrogram] = useState(true);
  const [convertFormat, setConvertFormat] = useState<'mp3' | 'wav' | 'flac' | 'ogg'>(
    DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  );
  const [exportDialogMode, setExportDialogMode] = useState<ExportDialogMode>(null);
  const [exportPathInput, setExportPathInput] = useState('');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportMessage, setExportMessage] = useState(
    'Rust owns transport. SoX stays in the offline export lane.',
  );
  const [workbenchStatus, setWorkbenchStatus] = useState(
    'Preparing native audio engine…',
  );
  const [workbenchError, setWorkbenchError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [spectrogramSource, setSpectrogramSource] = useState<string | null>(null);
  const seekFrameRef = useRef<number | null>(null);
  const pendingSeekSecondsRef = useRef(0);
  const playheadMarkerRef = useRef<AudioWorkbenchPlayheadMarkerHandle | null>(null);

  const previewDeck = getAudioDeckState(snapshot, activeDeckId);
  const effectiveDuration = Math.max(
    analysis?.durationSeconds ?? 0,
    previewDeck.durationSeconds ?? 0,
  );
  const selectionDuration = Math.max(0, selectionEnd - selectionStart);
  const boundedFadeInSeconds = clamp(fadeInSeconds, 0, selectionDuration);
  const boundedFadeOutSeconds = clamp(fadeOutSeconds, 0, selectionDuration);
  const selectionLeft =
    effectiveDuration > 0 ? `${(selectionStart / effectiveDuration) * 100}%` : '0%';
  const selectionWidth =
    effectiveDuration > 0 ? `${(selectionDuration / effectiveDuration) * 100}%` : '0%';
  const fadeInWidth =
    selectionDuration > 0 ? `${(boundedFadeInSeconds / selectionDuration) * 100}%` : '0%';
  const fadeOutWidth =
    selectionDuration > 0 ? `${(boundedFadeOutSeconds / selectionDuration) * 100}%` : '0%';
  const fadeInHandleLeft = `calc(${selectionLeft} + ${fadeInWidth})`;
  const fadeOutHandleLeft = `calc(${selectionLeft} + ${selectionWidth} - ${fadeOutWidth})`;

  useEffect(() => {
    let cancelled = false;
    if (seekFrameRef.current != null) {
      window.cancelAnimationFrame(seekFrameRef.current);
      seekFrameRef.current = null;
    }
    pendingSeekSecondsRef.current = 0;
    playheadMarkerRef.current?.clearPreview();
    setAnalysis(null);
    setSelectionStart(0);
    setSelectionEnd(0);
    setFadeInSeconds(0);
    setFadeOutSeconds(0);
    setPitchShiftCents(0);
    setGenerateSpectrogram(true);
    setConvertFormat(DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID);
    setExportDialogMode(null);
    setExportPathInput(
      buildAudioOutputPath(audioPath, 'clip', DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID),
    );
    setExportState('idle');
    setExportMessage('Rust owns transport. SoX stays in the offline export lane.');
    setWorkbenchStatus('Loading the current explorer selection into the native audio engine…');
    setWorkbenchError(null);
    setIsAnalyzing(true);
    setSpectrogramSource(null);

    void (async () => {
      try {
        const [nextAnalysis] = await Promise.all([
          analyzeExplorerAudioPreview(audioPath),
          loadSelectionIntoAudioDeck(activeDeckId, audioPath),
        ]);
        if (cancelled) {
          return;
        }
        setAnalysis(nextAnalysis);
        setSelectionStart(0);
        setSelectionEnd(nextAnalysis.durationSeconds);
        setWorkbenchStatus(
          'The selected file is loaded in the native engine. Playback is running through Rust, not the webview.',
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setWorkbenchError(message);
        setWorkbenchStatus('Audio analysis or native deck load failed.');
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDeckId, audioPath]);

  useEffect(() => {
    if (previewDeck.loadedPath !== audioPath) {
      return;
    }
    if (
      previewDeck.loopRegion.enabled &&
      previewDeck.loopRegion.endSeconds > previewDeck.loopRegion.startSeconds
    ) {
      setSelectionStart(previewDeck.loopRegion.startSeconds);
      setSelectionEnd(previewDeck.loopRegion.endSeconds);
      return;
    }
    if (effectiveDuration > 0 && selectionEnd === 0) {
      setSelectionEnd(effectiveDuration);
    }
  }, [
    audioPath,
    effectiveDuration,
    previewDeck.loadedPath,
    previewDeck.loopRegion.enabled,
    previewDeck.loopRegion.endSeconds,
    previewDeck.loopRegion.startSeconds,
    selectionEnd,
  ]);

  useEffect(() => {
    setFadeInSeconds((current) => clamp(current, 0, selectionDuration));
    setFadeOutSeconds((current) => clamp(current, 0, selectionDuration));
  }, [selectionDuration]);

  const waveformBuckets = analysis?.waveformBuckets ?? [];
  const spectralBands = analysis?.spectralBands ?? [];
  const silenceRegions = analysis?.silenceRegions ?? [];
  const estimatedBpm = analysis?.estimatedBpm ?? null;
  const leadingSilenceRegion =
    silenceRegions.find((region) => region.startSeconds <= FINE_TRIM_NUDGE_SECONDS) ?? null;
  const trailingSilenceRegion =
    [...silenceRegions]
      .reverse()
      .find(
        (region) =>
          effectiveDuration > 0
          && Math.abs(region.endSeconds - effectiveDuration) <= FINE_TRIM_NUDGE_SECONDS,
      ) ?? null;
  const detectedContentRange = useMemo(() => {
    const nextStart = leadingSilenceRegion?.endSeconds ?? 0;
    const nextEnd = trailingSilenceRegion?.startSeconds ?? effectiveDuration;
    if (nextEnd - nextStart < MINIMUM_SELECTION_SECONDS) {
      return null;
    }
    return { start: nextStart, end: nextEnd };
  }, [effectiveDuration, leadingSilenceRegion, trailingSilenceRegion]);

  const summaryItems = useMemo<AudioWorkbenchSummaryItem[]>(
    () => [
      {
        label: 'Loaded File',
        value: previewDeck.loadedName ?? audioName,
      },
      {
        label: 'Duration',
        value: formatDuration(analysis?.durationSeconds ?? effectiveDuration),
      },
      {
        label: 'Sample Rate',
        value: analysis?.sampleRateHz
          ? `${analysis.sampleRateHz.toLocaleString()} Hz`
          : snapshot.outputSampleRateHz
            ? `${snapshot.outputSampleRateHz.toLocaleString()} Hz`
            : 'n/a',
        tone: 'accent',
      },
      {
        label: 'Channels',
        value: analysis?.channels ? `${analysis.channels}` : 'n/a',
      },
      {
        label: 'Encoding',
        value:
          [
            analysis?.encoding,
            analysis?.bitsPerSample ? `${analysis.bitsPerSample}-bit` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'n/a',
      },
      {
        label: 'Estimated BPM',
        value: formatBpm(estimatedBpm),
        tone: estimatedBpm ? 'accent' : 'default',
      },
      {
        label: 'Silence',
        value:
          silenceRegions.length > 0
            ? `${silenceRegions.length} region${silenceRegions.length === 1 ? '' : 's'}`
            : 'No long gaps',
      },
      { label: 'Peak / RMS', value: `${formatDb(analysis?.peakLevel)} / ${formatDb(analysis?.rmsLevel)}` },
      {
        label: 'Headroom',
        value:
          analysis?.headroomDb != null && Number.isFinite(analysis.headroomDb)
            ? `${analysis.headroomDb.toFixed(1)} dB`
            : 'n/a',
      },
      {
        label: 'Pitch Shift',
        value: formatPitchShift(pitchShiftCents),
      },
      { label: 'File Size', value: formatSize(audioSize) },
    ],
    [
      analysis,
      audioName,
      audioSize,
      estimatedBpm,
      effectiveDuration,
      pitchShiftCents,
      previewDeck.loadedName,
      silenceRegions.length,
      snapshot.outputSampleRateHz,
    ],
  );

  useEffect(() => {
    return () => {
      if (seekFrameRef.current != null) {
        window.cancelAnimationFrame(seekFrameRef.current);
        seekFrameRef.current = null;
      }
    };
  }, []);

  function syncPlayhead(nextTime: number) {
    if (effectiveDuration <= 0) {
      return;
    }
    const bounded = clamp(nextTime, 0, effectiveDuration);
    pendingSeekSecondsRef.current = bounded;
    playheadMarkerRef.current?.setPreviewSeconds(bounded);
    if (seekFrameRef.current != null) {
      return;
    }
    seekFrameRef.current = window.requestAnimationFrame(() => {
      seekFrameRef.current = null;
      const pendingSeconds = pendingSeekSecondsRef.current;
      void seekAudioDeck(activeDeckId, pendingSeconds).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setWorkbenchError(message);
        setWorkbenchStatus('Seek command failed.');
      });
    });
  }

  function updateSelection(nextStart: number, nextEnd: number) {
    const boundedEnd = clamp(nextEnd, 0, effectiveDuration || 0);
    const boundedStart = clamp(
      nextStart,
      0,
      Math.max(0, boundedEnd - MINIMUM_SELECTION_SECONDS),
    );
    const finalEnd = clamp(
      boundedEnd,
      Math.min(effectiveDuration || 0, boundedStart + MINIMUM_SELECTION_SECONDS),
      effectiveDuration || 0,
    );
    setSelectionStart(boundedStart);
    setSelectionEnd(finalEnd);
    setFadeInSeconds((current) => clamp(current, 0, finalEnd - boundedStart));
    setFadeOutSeconds((current) => clamp(current, 0, finalEnd - boundedStart));
    void setAudioDeckLoopRegion(activeDeckId, boundedStart, finalEnd, true).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Loop region update failed.');
    });
  }

  function updateFadeIn(nextSeconds: number) {
    setFadeInSeconds(clamp(nextSeconds, 0, selectionDuration));
  }

  function updateFadeOut(nextSeconds: number) {
    setFadeOutSeconds(clamp(nextSeconds, 0, selectionDuration));
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
        syncPlayhead(nextTime);
        return;
      }
      if (mode === 'selectionStart') {
        updateSelection(nextTime, selectionEnd);
        return;
      }
      if (mode === 'fadeIn') {
        updateFadeIn(nextTime - selectionStart);
        return;
      }
      if (mode === 'fadeOut') {
        updateFadeOut(selectionEnd - nextTime);
        return;
      }
      updateSelection(selectionStart, nextTime);
    };
    applyTime(resolveTimeFromClientX(clientX));
    const handlePointerMove = (event: MouseEvent) =>
      applyTime(resolveTimeFromClientX(event.clientX));
    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  }

  async function togglePreviewDeckPlayback() {
    try {
      if (previewDeck.isPlaying) {
        await pauseAudioDeck(activeDeckId);
        playheadMarkerRef.current?.clearPreview();
        setWorkbenchError(null);
        setWorkbenchStatus('Playback paused.');
        return;
      }
      if (
        selectionEnd > selectionStart &&
        previewDeck.currentTimeSeconds >= selectionEnd
      ) {
        await seekAudioDeck(activeDeckId, selectionStart);
      }
      await playAudioDeck(activeDeckId);
      setWorkbenchError(null);
      setWorkbenchStatus('Playback running from the native engine.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Playback command failed.');
    }
  }

  function handleFadeHandleKeyDown(
    mode: 'fadeIn' | 'fadeOut',
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (selectionDuration <= 0) {
      return;
    }

    let nextValue = mode === 'fadeIn' ? boundedFadeInSeconds : boundedFadeOutSeconds;
    const step = event.shiftKey ? FADE_KEYBOARD_STEP_SECONDS * 5 : FADE_KEYBOARD_STEP_SECONDS;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        nextValue -= step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        nextValue += step;
        break;
      case 'Home':
        nextValue = 0;
        break;
      case 'End':
        nextValue = selectionDuration;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (mode === 'fadeIn') {
      updateFadeIn(nextValue);
      return;
    }
    updateFadeOut(nextValue);
  }

  async function clearLoopRegion() {
    if (effectiveDuration <= 0) {
      return;
    }
    setSelectionStart(0);
    setSelectionEnd(effectiveDuration);
    try {
      await setAudioDeckLoopRegion(activeDeckId, 0, effectiveDuration, false);
      setWorkbenchError(null);
      setWorkbenchStatus('Loop region cleared.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Loop clear failed.');
    }
  }

  async function handleStopPlayback() {
    try {
      await stopAudioDeck(activeDeckId);
      playheadMarkerRef.current?.clearPreview();
      setWorkbenchError(null);
      setWorkbenchStatus('Playback stopped.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Stop command failed.');
    }
  }

  async function handleGainChange(value: number) {
    try {
      await setAudioDeckGain(activeDeckId, value);
      setWorkbenchError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Gain update failed.');
    }
  }

  async function handleRateChange(value: number) {
    try {
      await setAudioDeckRate(activeDeckId, value);
      setWorkbenchError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Rate update failed.');
    }
  }

  function updateSelectionStartFromInput(value: number) {
    updateSelection(value, selectionEnd);
    setWorkbenchStatus('Selection in-point updated.');
  }

  function updateSelectionEndFromInput(value: number) {
    updateSelection(selectionStart, value);
    setWorkbenchStatus('Selection out-point updated.');
  }

  function updateSelectionDurationFromInput(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    updateSelection(selectionStart, selectionStart + value);
    setWorkbenchStatus('Selection duration updated.');
  }

  function nudgeSelectionBoundary(boundary: 'start' | 'end', deltaSeconds: number) {
    if (boundary === 'start') {
      updateSelection(selectionStart + deltaSeconds, selectionEnd);
      setWorkbenchStatus('Selection in-point nudged.');
      return;
    }
    updateSelection(selectionStart, selectionEnd + deltaSeconds);
    setWorkbenchStatus('Selection out-point nudged.');
  }

  function selectSilenceRegion(startSeconds: number, endSeconds: number) {
    updateSelection(startSeconds, endSeconds);
    syncPlayhead(startSeconds);
    setWorkbenchStatus('Silence region loaded into the trim selection.');
  }

  function jumpToAdjacentSilence(direction: 'previous' | 'next') {
    const currentTime = previewDeck.currentTimeSeconds;
    const nextRegion =
      direction === 'previous'
        ? [...silenceRegions]
            .reverse()
            .find((region) => region.endSeconds < currentTime - FINE_TRIM_NUDGE_SECONDS)
        : silenceRegions.find((region) => region.startSeconds > currentTime + FINE_TRIM_NUDGE_SECONDS);
    if (!nextRegion) {
      setWorkbenchStatus(
        direction === 'previous'
          ? 'No earlier silence region was detected.'
          : 'No later silence region was detected.',
      );
      return;
    }
    syncPlayhead(nextRegion.startSeconds);
    setWorkbenchStatus(
      direction === 'previous'
        ? 'Jumped to the previous silence region.'
        : 'Jumped to the next silence region.',
    );
  }

  function trimLeadingSilence() {
    if (!leadingSilenceRegion) {
      setWorkbenchStatus('No leading silence region was detected.');
      return;
    }
    updateSelection(leadingSilenceRegion.endSeconds, selectionEnd);
    setWorkbenchStatus('Trim in-point snapped to the end of the leading silence.');
  }

  function trimTrailingSilence() {
    if (!trailingSilenceRegion) {
      setWorkbenchStatus('No trailing silence region was detected.');
      return;
    }
    updateSelection(selectionStart, trailingSilenceRegion.startSeconds);
    setWorkbenchStatus('Trim out-point snapped to the start of the trailing silence.');
  }

  function trimDetectedContent() {
    if (!detectedContentRange) {
      setWorkbenchStatus('Detected content range is not available for this file.');
      return;
    }
    updateSelection(detectedContentRange.start, detectedContentRange.end);
    syncPlayhead(detectedContentRange.start);
    setWorkbenchStatus('Trim bounds snapped to the detected audible content.');
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const activeElement = document.activeElement;
      const target = event.target instanceof Node ? event.target : null;
      const hasWorkbenchFocus = Boolean(
        root
        && (
          (target && root.contains(target))
          || (activeElement instanceof Node
            && (root.contains(activeElement) || activeElement === document.body))
        ),
      );

      if (!hasWorkbenchFocus || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (matchesKeybinding(event, keybindings.audioWorkbenchPlayPause)) {
        event.preventDefault();
        void togglePreviewDeckPlayback();
        return;
      }
      if (matchesKeybinding(event, keybindings.audioWorkbenchJumpToSelectionStart)) {
        event.preventDefault();
        syncPlayhead(selectionStart);
        return;
      }
      if (matchesKeybinding(event, keybindings.audioWorkbenchJumpToSelectionEnd)) {
        event.preventDefault();
        syncPlayhead(selectionEnd);
        return;
      }
      if (matchesKeybinding(event, keybindings.audioWorkbenchPreviousSilence)) {
        event.preventDefault();
        jumpToAdjacentSilence('previous');
        return;
      }
      if (matchesKeybinding(event, keybindings.audioWorkbenchNextSilence)) {
        event.preventDefault();
        jumpToAdjacentSilence('next');
        return;
      }
      if (matchesKeybinding(event, keybindings.audioWorkbenchExportClip)) {
        event.preventDefault();
        openExportDialog('clip');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keybindings, selectionStart, selectionEnd, silenceRegions, previewDeck.currentTimeSeconds]);

  function openExportDialog(mode: Exclude<ExportDialogMode, null>) {
    const suffix =
      mode === 'clip'
        ? 'clip'
        : mode === 'normalized'
          ? 'normalized'
          : 'converted';
    const extension =
      mode === 'convert'
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
    const nextOutputFormat =
      mode === 'convert'
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
        mode:
          mode === 'clip'
            ? 'exportClip'
            : mode === 'normalized'
              ? 'exportNormalized'
              : 'convertFormat',
        trimStartSeconds: selectionStart,
        trimEndSeconds: selectionEnd,
        fadeInSeconds: boundedFadeInSeconds,
        fadeOutSeconds: boundedFadeOutSeconds,
        pitchShiftCents,
        normalize: mode === 'normalized' ? true : null,
        outputFormat: nextOutputFormat,
        generateSpectrogram,
      });
      setExportState('saved');
      setExportMessage(`Saved audio output to ${result.outputPath}`);
      setSpectrogramSource(
        result.spectrogramPath ? convertFileSrc(result.spectrogramPath) : null,
      );
      await onExported?.(result.outputPath);
    } catch (error) {
      setExportState('error');
      setExportMessage(error instanceof Error ? error.message : String(error));
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
        fadeInSeconds: boundedFadeInSeconds,
        fadeOutSeconds: boundedFadeOutSeconds,
        pitchShiftCents,
        normalize: true,
        outputFormat: audioExtension || 'wav',
        generateSpectrogram,
      });
      setExportState('saved');
      setExportMessage(`Overwrote ${audioName} in place.`);
      setSpectrogramSource(
        result.spectrogramPath ? convertFileSrc(result.spectrogramPath) : null,
      );
      await onExported?.(result.outputPath);
    } catch (error) {
      setExportState('error');
      setExportMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const engineStatusBadges = [
    snapshot.ready ? 'Native Engine Ready' : 'Engine Starting',
    isAnalyzing ? 'Analyzing' : null,
    previewDeck.isLoading ? 'Loading' : null,
    previewDeck.isPlaying ? 'Playing' : null,
    snapshot.outputSampleRateHz ? `${snapshot.outputSampleRateHz.toLocaleString()} Hz Output` : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <div
        ref={rootRef}
        tabIndex={-1}
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--overlay-explorer-preview-bg)',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            padding: 16,
            display: 'grid',
            gap: 14,
            alignContent: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                borderRadius: 'var(--overlay-explorer-panel-radius)',
                border: '1px solid var(--overlay-explorer-chip-border)',
                background:
                  'linear-gradient(180deg, rgba(10, 12, 18, 0.94), rgba(5, 7, 11, 0.98))',
                padding: 18,
                display: 'grid',
                gap: 16,
                boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
              }}
            >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--overlay-text-primary)',
                    }}
                  >
                    <AudioLines size={16} />
                    Audio Workbench
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    {audioExtension.toUpperCase()} · {formatSize(audioSize)} · Native playback
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => void handleStopPlayback()}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => syncPlayhead(selectionStart)}
                  >
                    <RotateCcw size={14} />
                    Jump To In
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => syncPlayhead(selectionEnd)}
                  >
                    Jump To Out
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle('primary')}
                    onClick={() => void togglePreviewDeckPlayback()}
                  >
                    {previewDeck.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    {previewDeck.isPlaying ? 'Pause' : 'Play'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 'var(--overlay-explorer-panel-radius)',
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'stretch',
                }}
              >
                {summaryItems.map((item) => (
                  <div key={item.label} style={summaryChipStyle(item.tone)}>
                    <div style={miniLabelStyle}>{item.label}</div>
                    <div style={summaryValueStyle} title={item.value}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div
                  ref={timelineRef}
                  role="presentation"
                  onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
                  style={{
                    position: 'relative',
                    height: 144,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 2,
                    padding: '18px 12px',
                  }}
                >
                  <AudioWorkbenchWaveformBars
                    waveformBuckets={waveformBuckets}
                    isAnalyzing={isAnalyzing}
                  />
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
                    style={{
                      ...fadeOverlayStyle('in'),
                      left: selectionLeft,
                      width: fadeInWidth,
                    }}
                  />
                  <div
                    style={{
                      ...fadeOverlayStyle('out'),
                      left: fadeOutHandleLeft,
                      width: fadeOutWidth,
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
                    role="slider"
                    aria-label={`Fade in handle for ${audioName}`}
                    aria-valuemin={0}
                    aria-valuemax={selectionDuration}
                    aria-valuenow={boundedFadeInSeconds}
                    aria-valuetext={formatFadeDuration(boundedFadeInSeconds)}
                    tabIndex={0}
                    onKeyDown={(event) => handleFadeHandleKeyDown('fadeIn', event)}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      beginTimelineDrag('fadeIn', event.clientX);
                    }}
                    style={{
                      ...fadeHandleStyle('in'),
                      left: fadeInHandleLeft,
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
                    role="slider"
                    aria-label={`Fade out handle for ${audioName}`}
                    aria-valuemin={0}
                    aria-valuemax={selectionDuration}
                    aria-valuenow={boundedFadeOutSeconds}
                    aria-valuetext={formatFadeDuration(boundedFadeOutSeconds)}
                    tabIndex={0}
                    onKeyDown={(event) => handleFadeHandleKeyDown('fadeOut', event)}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      beginTimelineDrag('fadeOut', event.clientX);
                    }}
                    style={{
                      ...fadeHandleStyle('out'),
                      left: fadeOutHandleLeft,
                    }}
                  />
                  <AudioWorkbenchPlayheadMarker
                    ref={playheadMarkerRef}
                    currentTimeSeconds={previewDeck.currentTimeSeconds}
                    durationSeconds={effectiveDuration}
                    isPlaying={previewDeck.isPlaying}
                    playbackRate={previewDeck.rate}
                  />
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 11,
                      lineHeight: 1.4,
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    <span>Edge fades live on the waveform.</span>
                    <span>
                      In {formatFadeDuration(boundedFadeInSeconds)} · Out{' '}
                      {formatFadeDuration(boundedFadeOutSeconds)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 10,
                    }}
                  >
                    <div style={metricCardStyle()}>
                      <div style={miniLabelStyle}>Gain</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <input
                          aria-label="Gain"
                          type="range"
                          min="0"
                          max="2"
                          step="0.01"
                          value={previewDeck.gainLinear}
                          onChange={(event) => void handleGainChange(Number(event.target.value))}
                        />
                        <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
                          {previewDeck.gainLinear.toFixed(2)}x
                        </div>
                      </div>
                    </div>
                    <div style={metricCardStyle()}>
                      <div style={miniLabelStyle}>Rate</div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <input
                          aria-label="Rate"
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.01"
                          value={previewDeck.rate}
                          onChange={(event) => void handleRateChange(Number(event.target.value))}
                        />
                        <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
                          {previewDeck.rate.toFixed(2)}x
                        </div>
                      </div>
                    </div>
                    <div style={metricCardStyle()}>
                      <div style={miniLabelStyle}>Pitch Shift</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        <input
                          aria-label="Pitch Shift"
                          type="range"
                          min="-1200"
                          max="1200"
                          step="1"
                          value={pitchShiftCents}
                          onChange={(event) => setPitchShiftCents(Number(event.target.value))}
                        />
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) 96px',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)' }}>
                            {formatPitchShift(pitchShiftCents)}
                          </div>
                          <input
                            aria-label="Pitch Shift Cents"
                            type="number"
                            step="1"
                            min="-1200"
                            max="1200"
                            value={Math.round(pitchShiftCents)}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              if (Number.isFinite(nextValue)) {
                                setPitchShiftCents(clamp(nextValue, -1200, 1200));
                              }
                            }}
                            style={{ ...inputStyle, padding: '8px 10px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            <div
              style={{
                display: 'grid',
                gap: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <Scissors size={15} />
                  Precision Trim
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    In
                    <input
                      aria-label="Trim In"
                      type="number"
                      step="0.001"
                      min="0"
                      value={formatPreciseSeconds(selectionStart)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (Number.isFinite(nextValue)) {
                          updateSelectionStartFromInput(nextValue);
                        }
                      }}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    Out
                    <input
                      aria-label="Trim Out"
                      type="number"
                      step="0.001"
                      min="0"
                      value={formatPreciseSeconds(selectionEnd)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (Number.isFinite(nextValue)) {
                          updateSelectionEndFromInput(nextValue);
                        }
                      }}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                    Length
                    <input
                      aria-label="Selection Length"
                      type="number"
                      step="0.001"
                      min={MINIMUM_SELECTION_SECONDS.toString()}
                      value={formatPreciseSeconds(selectionDuration)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (Number.isFinite(nextValue)) {
                          updateSelectionDurationFromInput(nextValue);
                        }
                      }}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => nudgeSelectionBoundary('start', -FINE_TRIM_NUDGE_SECONDS)}
                  >
                    In -10ms
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => nudgeSelectionBoundary('start', FINE_TRIM_NUDGE_SECONDS)}
                  >
                    In +10ms
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => nudgeSelectionBoundary('end', -FINE_TRIM_NUDGE_SECONDS)}
                  >
                    Out -10ms
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => nudgeSelectionBoundary('end', FINE_TRIM_NUDGE_SECONDS)}
                  >
                    Out +10ms
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={trimLeadingSilence}
                  >
                    Trim Head Silence
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={trimTrailingSilence}
                  >
                    Trim Tail Silence
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle('primary')}
                    onClick={trimDetectedContent}
                  >
                    Trim To Content
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <Scissors size={15} />
                  Transform Controls
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 12,
                  }}
                >
                  <label
                    style={{
                      display: 'grid',
                      gap: 6,
                      fontSize: 11,
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    Convert Format
                    <select
                      value={convertFormat}
                      onChange={(event) =>
                        setConvertFormat(event.target.value as 'mp3' | 'wav' | 'flac' | 'ogg')
                      }
                      style={inputStyle}
                    >
                      {EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => (
                        <option key={format.id} value={format.id}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--overlay-text-primary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={generateSpectrogram}
                    onChange={(event) => setGenerateSpectrogram(event.target.checked)}
                  />
                  Generate spectrogram preview on export
                </label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={toolbarButtonStyle('primary')}
                    onClick={() => openExportDialog('clip')}
                  >
                    <Scissors size={14} />
                    Export Clip
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => openExportDialog('normalized')}
                  >
                    <Sparkles size={14} />
                    Export Normalized
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => openExportDialog('convert')}
                  >
                    <Waves size={14} />
                    Convert Format
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => void clearLoopRegion()}
                  >
                    Clear Loop
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle('danger')}
                    onClick={() => setExportDialogMode('overwrite')}
                  >
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {workbenchError || snapshot.engineError ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <AudioLines size={15} />
                  )}
                  Status
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color:
                      workbenchError || snapshot.engineError
                        ? 'var(--overlay-danger-text, #ff8f8f)'
                        : 'var(--overlay-text-muted)',
                  }}
                >
                  {workbenchError ??
                    previewDeck.error ??
                    snapshot.engineError ??
                    workbenchStatus}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color:
                      exportState === 'error'
                        ? 'var(--overlay-danger-text, #ff8f8f)'
                        : 'var(--overlay-text-muted)',
                  }}
                >
                  {exportMessage}
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={miniLabelStyle}>Detection</div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 8,
                    }}
                  >
                    <div style={metricCardStyle()}>
                      <div style={miniLabelStyle}>Estimated BPM</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {formatBpm(estimatedBpm)}
                      </div>
                    </div>
                    <div style={metricCardStyle()}>
                      <div style={miniLabelStyle}>Silence Regions</div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {silenceRegions.length}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      style={toolbarButtonStyle()}
                      onClick={() => jumpToAdjacentSilence('previous')}
                    >
                      Previous Silence
                    </button>
                    <button
                      type="button"
                      style={toolbarButtonStyle()}
                      onClick={() => jumpToAdjacentSilence('next')}
                    >
                      Next Silence
                    </button>
                    {leadingSilenceRegion ? (
                      <button
                        type="button"
                        style={toolbarButtonStyle()}
                        onClick={() =>
                          selectSilenceRegion(
                            leadingSilenceRegion.startSeconds,
                            leadingSilenceRegion.endSeconds,
                          )}
                      >
                        Select Head Silence
                      </button>
                    ) : null}
                    {trailingSilenceRegion ? (
                      <button
                        type="button"
                        style={toolbarButtonStyle()}
                        onClick={() =>
                          selectSilenceRegion(
                            trailingSilenceRegion.startSeconds,
                            trailingSilenceRegion.endSeconds,
                          )}
                      >
                        Select Tail Silence
                      </button>
                    ) : null}
                  </div>
                  {silenceRegions.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {silenceRegions.slice(0, SILENCE_REGION_PREVIEW_LIMIT).map((region, index) => (
                        <button
                          key={`${region.startSeconds}-${region.endSeconds}-${index}`}
                          type="button"
                          style={{
                            ...toolbarButtonStyle(),
                            justifyContent: 'space-between',
                            width: '100%',
                          }}
                          onClick={() => selectSilenceRegion(region.startSeconds, region.endSeconds)}
                        >
                          <span>Silence {index + 1}</span>
                          <span>
                            {formatPreciseSeconds(region.startSeconds)}s - {formatPreciseSeconds(region.endSeconds)}s
                            {' '}· {formatFadeDuration(region.durationSeconds)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                      No sustained silence regions crossed the current detection threshold.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {engineStatusBadges.map((badge) => (
                    <span key={badge} style={badgeStyle}>
                      {badge}
                    </span>
                  ))}
                </div>

                <AudioWorkbenchSpectralBars spectralBands={spectralBands} />

                {spectrogramSource ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={miniLabelStyle}>Spectrogram</div>
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
      </div>

      <AppPromptDialog
        open={
          exportDialogMode === 'clip' ||
          exportDialogMode === 'normalized' ||
          exportDialogMode === 'convert'
        }
        title={
          exportDialogMode === 'clip'
            ? 'Export Audio Clip'
            : exportDialogMode === 'normalized'
              ? 'Export Normalized Audio'
              : 'Convert Audio Format'
        }
        description={
          exportDialogMode === 'convert'
            ? `SoX will write a ${convertFormat.toUpperCase()} export using the current trim, pitch, fade, and spectrogram settings.`
            : 'Choose the output path for the new audio export.'
        }
        value={exportPathInput}
        onChange={setExportPathInput}
        onCancel={() => setExportDialogMode(null)}
        onSubmit={() => {
          if (
            exportDialogMode === 'clip' ||
            exportDialogMode === 'normalized' ||
            exportDialogMode === 'convert'
          ) {
            void submitExport(exportDialogMode);
          }
        }}
        submitLabel='Run SoX Export'
      />

      <AppConfirmDialog
        open={exportDialogMode === 'overwrite'}
        title='Overwrite Original Audio'
        tone='danger'
        confirmLabel='Overwrite Original'
        description={`This will rewrite ${audioName} in place using the current trim, pitch, fade, normalize, and spectrogram settings.`}
        onCancel={() => setExportDialogMode(null)}
        onConfirm={() => {
          void submitOverwriteOriginal();
        }}
      >
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'var(--overlay-text-muted)',
          }}
        >
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

const miniLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--overlay-text-muted)',
};
