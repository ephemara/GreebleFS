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
  AudioLines,
  Pause,
  Play,
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
  getExplorerVstDefaultScanPaths,
  scanExplorerVstPlugins,
  type ExplorerVstPluginEntry,
} from '../runtime/vstBackend';
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
  loadAudioDeckPlugin,
  clearAudioDeckPlugin,
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


const MINIMUM_SELECTION_SECONDS = 0.05;
const FADE_KEYBOARD_STEP_SECONDS = 0.1;
const FINE_TRIM_NUDGE_SECONDS = 0.01;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
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
  if (value == null || !Number.isFinite(value) || value <= 0) return 'n/a';
  return `${(20 * Math.log10(value)).toFixed(1)} dB`;
}

function formatFadeDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0.00s';
  if (seconds >= 60) return formatDuration(seconds);
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatPreciseSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0.000';
  return seconds.toFixed(3);
}

function formatBpm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return 'n/a';
  return `${value.toFixed(value >= 100 ? 0 : 1)} BPM`;
}

function formatPitchShift(cents: number): string {
  if (!Number.isFinite(cents) || Math.abs(cents) < 0.5) return 'Neutral';
  const semitones = cents / 100;
  return `${semitones > 0 ? '+' : ''}${semitones.toFixed(2)} st`;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

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

function toolbarButtonStyle(emphasis: 'default' | 'primary' | 'danger' | 'ghost' = 'default'): CSSProperties {
  const base = {
    appearance: 'none' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 4,
    border: '1px solid transparent',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
  };

  if (emphasis === 'primary') return { ...base, background: '#2563eb', color: '#fff' };
  if (emphasis === 'danger') return { ...base, background: '#dc2626', color: '#fff' };
  if (emphasis === 'ghost') return { ...base, background: 'transparent', color: 'rgba(255,255,255,0.7)' };
  return { ...base, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)' };
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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{isAnalyzing ? 'Analyzing...' : 'Waveform unavailable'}</div>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', height: '100%', gap: 0 }}>
      {waveformBuckets.map((bucket) => (
        <div
          key={bucket.index}
          style={{
            flex: 1,
            height: `${Math.max(2, bucket.peakLevel * 100)}%`,
            background: bucket.rmsLevel > 0.05 ? '#60a5fa' : '#3b82f6',
            opacity: bucket.rmsLevel > 0.05 ? 1 : 0.6,
            minWidth: 1,
          }}
        />
      ))}
    </div>
  );
});

const AudioWorkbenchSpectralBars = memo(function AudioWorkbenchSpectralBars({
  spectralBands,
}: AudioWorkbenchSpectralBarsProps) {
  if (spectralBands.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%', width: '100%', opacity: 0.7 }}>
      {spectralBands.map((band, index) => (
        <div
          key={`${index}-${band}`}
          style={{
            flex: 1,
            height: `${Math.max(4, band * 100)}%`,
            background: '#eab308',
            minWidth: 1,
          }}
        />
      ))}
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
        if (!node || durationSeconds <= 0) return;
        const bounded = clamp(seconds, 0, durationSeconds);
        node.style.transform = `translate3d(${(bounded / durationSeconds) * 100}%, 0, 0)`;
      }

      useImperativeHandle(
        ref,
        () => ({
          setPreviewSeconds(seconds: number) {
            if (durationSeconds <= 0) return;
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
            inset: 0,
            width: '100%',
            pointerEvents: 'none',
            transform: 'translate3d(0%, 0, 0)',
            willChange: 'transform',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 1,
              height: '100%',
              background: '#ef4444',
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
  const settings = useSettingsStore((state) => state.settings);
  const keybindings = settings.keybindings;
  const activeDeckId = 'a' as const;

  const [analysis, setAnalysis] = useState<ExplorerAudioPreviewAnalysis | null>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
  const [pitchShiftCents, setPitchShiftCents] = useState(0);
  
  // VST Discovery State
  const [discoveredPlugins, setDiscoveredPlugins] = useState<ExplorerVstPluginEntry[]>([]);
  const [isScanningVst, setIsScanningVst] = useState(false);
  
  useEffect(() => {
    let active = true;
    const runScan = async () => {
      setIsScanningVst(true);
      try {
        const defaults = await getExplorerVstDefaultScanPaths();
        const validDefaults = defaults.filter(p => p.exists).map(p => p.path);
        const allPaths = [...validDefaults, ...(settings.audio?.vst3AdditionalFolders ?? [])];
        const plugins = await scanExplorerVstPlugins(allPaths);
        if (active) {
          setDiscoveredPlugins(plugins);
        }
      } catch (err: any) {
        console.error('Failed to scan VST3 plugins:', err);
      } finally {
        if (active) setIsScanningVst(false);
      }
    };
    runScan();
    return () => { active = false; };
  }, [settings.audio?.vst3AdditionalFolders]);

  const [generateSpectrogram, setGenerateSpectrogram] = useState(true);
  const [convertFormat, setConvertFormat] = useState<'mp3' | 'wav' | 'flac' | 'ogg'>(
    DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID,
  );
  const [exportDialogMode, setExportDialogMode] = useState<ExportDialogMode>(null);
  const [exportPathInput, setExportPathInput] = useState('');
    const [exportMessage, setExportMessage] = useState(
    'Ready for playback and export.',
  );
  const [workbenchStatus, setWorkbenchStatus] = useState(
    'Preparing audio environment…',
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
        setExportMessage('Ready for playback and export.');
    setWorkbenchStatus('Loading the current selection…');
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
          'Audio loaded and ready for playback.',
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setWorkbenchError(message);
        setWorkbenchStatus('Audio analysis or deck load failed.');
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
      setWorkbenchStatus('Playback started.');
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
            setExportMessage('Load a valid audio file before exporting.');
      return;
    }
    const nextOutputFormat =
      mode === 'convert'
        ? getExplorerAudioExportFormatDefinition(convertFormat)?.extension ?? convertFormat
        : DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID;
    setExportDialogMode(null);
        setExportMessage('Processing audio export…');
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
        gainLinear: previewDeck.gainLinear,
        rateMultiplier: previewDeck.rate,
        normalize: mode === 'normalized' ? true : null,
        outputFormat: nextOutputFormat,
        generateSpectrogram,
      });
            setExportMessage(`Saved audio output to ${result.outputPath}`);
      setSpectrogramSource(
        result.spectrogramPath ? convertFileSrc(result.spectrogramPath) : null,
      );
      await onExported?.(result.outputPath);
    } catch (error) {
            setExportMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function submitOverwriteOriginal() {
    setExportDialogMode(null);
        setExportMessage('Overwriting original audio…');
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
        gainLinear: previewDeck.gainLinear,
        rateMultiplier: previewDeck.rate,
        normalize: null,
        outputFormat: audioExtension || 'wav',
        generateSpectrogram,
      });
            setExportMessage(`Overwrote ${audioName} in place.`);
      setSpectrogramSource(
        result.spectrogramPath ? convertFileSrc(result.spectrogramPath) : null,
      );
      await onExported?.(result.outputPath);
    } catch (error) {
            setExportMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <style>{`
        .pro-slider { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; }
        .pro-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 8px; height: 12px; border-radius: 2px; background: #ccc; cursor: pointer; }
        .pro-slider::-webkit-slider-thumb:hover { background: #fff; }
        .pro-input { appearance: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; width: 100%; }
        .pro-input:focus { outline: none; border-color: rgba(255,255,255,0.3); }
        .pro-select { appearance: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; width: 100%; cursor: pointer; }
        .pro-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
        .pro-panel-header { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; }
        .pro-label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
        .pro-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .pro-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .pro-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .pro-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
      <div
        ref={rootRef}
        tabIndex={-1}
        className="pro-scrollbar"
        style={{
          width: '100%',
          height: '100%',
          background: '#0e0e0e',
          color: '#fff',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121212', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: 6, borderRadius: 4 }}>
              <AudioLines size={16} color="#aaa" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{audioName}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                {audioExtension.toUpperCase()} • {formatSize(audioSize)} • {formatDuration(analysis?.durationSeconds ?? effectiveDuration)} • {analysis?.sampleRateHz ? `${analysis.sampleRateHz.toLocaleString()} Hz` : 'Unknown Hz'} • {formatBpm(estimatedBpm)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => void handleStopPlayback()}>
              Stop
            </button>
            <button type="button" style={toolbarButtonStyle('primary')} onClick={() => void togglePreviewDeckPlayback()}>
              {previewDeck.isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {previewDeck.isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              ref={timelineRef}
              role="presentation"
              onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
              style={{
                position: 'relative',
                height: 120,
                borderRadius: 4,
                background: '#000',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'stretch',
                overflow: 'hidden'
              }}
            >
              <AudioWorkbenchWaveformBars waveformBuckets={waveformBuckets} isAnalyzing={isAnalyzing} />
              
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: selectionLeft,
                  width: selectionWidth,
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderLeft: '1px solid rgba(59, 130, 246, 0.5)',
                  borderRight: '1px solid rgba(59, 130, 246, 0.5)',
                  pointerEvents: 'none',
                }}
              />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: selectionLeft, width: fadeInWidth, background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: fadeOutHandleLeft, width: fadeOutWidth, background: 'linear-gradient(270deg, rgba(255,255,255,0.1), transparent)', pointerEvents: 'none' }} />

              <div
                role="presentation"
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('selectionStart', event.clientX); }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: selectionLeft, width: 10, marginLeft: -5, cursor: 'ew-resize', display: 'flex', justifyContent: 'center' }}
              >
                <div style={{ width: 2, height: '100%', background: '#3b82f6' }} />
              </div>
              <div
                role="presentation"
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('selectionEnd', event.clientX); }}
                style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${selectionLeft} + ${selectionWidth})`, width: 10, marginLeft: -5, cursor: 'ew-resize', display: 'flex', justifyContent: 'center' }}
              >
                <div style={{ width: 2, height: '100%', background: '#3b82f6' }} />
              </div>
              
              <div
                role="slider"
                tabIndex={0}
                aria-label={`Fade in handle for ${audioName}`}
                aria-valuemin={0}
                aria-valuemax={selectionDuration}
                aria-valuenow={boundedFadeInSeconds}
                aria-valuetext={formatFadeDuration(boundedFadeInSeconds)}
                onKeyDown={(event) => handleFadeHandleKeyDown('fadeIn', event)}
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('fadeIn', event.clientX); }}
                style={{ position: 'absolute', top: 0, width: 10, height: 10, left: fadeInHandleLeft, transform: 'translateX(-50%)', cursor: 'ew-resize', zIndex: 4 }}
              >
                <div style={{ width: 0, height: 0, borderTop: '10px solid #cbd5e1', borderRight: '10px solid transparent' }} />
              </div>
              <div
                role="slider"
                tabIndex={0}
                aria-label={`Fade out handle for ${audioName}`}
                aria-valuemin={0}
                aria-valuemax={selectionDuration}
                aria-valuenow={boundedFadeOutSeconds}
                aria-valuetext={formatFadeDuration(boundedFadeOutSeconds)}
                onKeyDown={(event) => handleFadeHandleKeyDown('fadeOut', event)}
                onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('fadeOut', event.clientX); }}
                style={{ position: 'absolute', top: 0, width: 10, height: 10, left: fadeOutHandleLeft, transform: 'translateX(-50%)', cursor: 'ew-resize', zIndex: 4 }}
              >
                <div style={{ width: 0, height: 0, borderTop: '10px solid #cbd5e1', borderLeft: '10px solid transparent' }} />
              </div>

              <AudioWorkbenchPlayheadMarker
                ref={playheadMarkerRef}
                currentTimeSeconds={previewDeck.currentTimeSeconds}
                durationSeconds={effectiveDuration}
                isPlaying={previewDeck.isPlaying}
                playbackRate={previewDeck.rate}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
              <div>In: {formatPreciseSeconds(selectionStart)}s | Out: {formatPreciseSeconds(selectionEnd)}s | Len: {formatPreciseSeconds(selectionDuration)}s</div>
              <div>Fade In: {formatFadeDuration(boundedFadeInSeconds)} | Fade Out: {formatFadeDuration(boundedFadeOutSeconds)}</div>
            </div>
          </div>

          {(spectralBands.length > 0 || spectrogramSource) && (
            <div style={{ display: 'flex', gap: 12, marginTop: -12, height: 48 }}>
              {spectralBands.length > 0 && (
                <div style={{ flex: 1, background: '#000', borderRadius: 4, overflow: 'hidden' }}>
                  <AudioWorkbenchSpectralBars spectralBands={spectralBands} />
                </div>
              )}
              {spectrogramSource && (
                <div style={{ flex: 1, borderRadius: 4, overflow: 'hidden' }}>
                  <img src={spectrogramSource} alt="Spectrogram" style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="pro-panel">
              <div className="pro-panel-header">Deck Controls</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="pro-label">Gain ({previewDeck.gainLinear.toFixed(2)}x)</label>
                  <input type="range" className="pro-slider" min="0" max="2" step="0.01" value={previewDeck.gainLinear} onChange={(event) => void handleGainChange(Number(event.target.value))} />
                </div>
                <div>
                  <label className="pro-label">Rate ({previewDeck.rate.toFixed(2)}x)</label>
                  <input type="range" className="pro-slider" min="0.5" max="2" step="0.01" value={previewDeck.rate} onChange={(event) => void handleRateChange(Number(event.target.value))} />
                </div>
              </div>
              <div>
                <label className="pro-label">Pitch Shift ({formatPitchShift(pitchShiftCents)})</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="range" className="pro-slider" min="-1200" max="1200" step="1" value={pitchShiftCents} onChange={(event) => setPitchShiftCents(Number(event.target.value))} />
                  <input aria-label="Pitch shift cents" type="number" className="pro-input" style={{ width: 70 }} min="-1200" max="1200" value={Math.round(pitchShiftCents)} onChange={(event) => { const nextValue = Number(event.target.value); if (Number.isFinite(nextValue)) setPitchShiftCents(clamp(nextValue, -1200, 1200)); }} />
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-start' }}>
                <button type="button" style={toolbarButtonStyle('danger')} onClick={() => setExportDialogMode('overwrite')}>Save Edits to File</button>
              </div>
            </div>

            <div className="pro-panel">
              <div className="pro-panel-header">Precision Trim</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">In</label>
                  <input type="number" className="pro-input" step="0.001" min="0" value={formatPreciseSeconds(selectionStart)} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) updateSelectionStartFromInput(v); }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">Out</label>
                  <input type="number" className="pro-input" step="0.001" min="0" value={formatPreciseSeconds(selectionEnd)} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) updateSelectionEndFromInput(v); }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">Length</label>
                  <input type="number" className="pro-input" step="0.001" min={MINIMUM_SELECTION_SECONDS.toString()} value={formatPreciseSeconds(selectionDuration)} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v)) updateSelectionDurationFromInput(v); }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('start', -FINE_TRIM_NUDGE_SECONDS)}>-10ms In</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('start', FINE_TRIM_NUDGE_SECONDS)}>+10ms In</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('end', -FINE_TRIM_NUDGE_SECONDS)}>-10ms Out</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => nudgeSelectionBoundary('end', FINE_TRIM_NUDGE_SECONDS)}>+10ms Out</button>
                <button type="button" style={toolbarButtonStyle()} onClick={trimLeadingSilence}>Trim Head</button>
                <button type="button" style={toolbarButtonStyle()} onClick={trimTrailingSilence}>Trim Tail</button>
                <button type="button" style={toolbarButtonStyle()} onClick={trimDetectedContent}>Trim Content</button>
                <button type="button" style={toolbarButtonStyle()} onClick={() => void clearLoopRegion()}>Clear</button>
              </div>
            </div>

            <div className="pro-panel">
              <div className="pro-panel-header">Transform & Export</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="pro-label">Convert Format</label>
                  <select className="pro-select" value={convertFormat} onChange={(event) => setConvertFormat(event.target.value as 'mp3' | 'wav' | 'flac' | 'ogg')}>
                    {EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => (
                      <option key={format.id} value={format.id}>{format.label}</option>
                    ))}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', paddingBottom: 4 }}>
                  <input type="checkbox" checked={generateSpectrogram} onChange={(event) => setGenerateSpectrogram(event.target.checked)} />
                  Spectrogram Preview
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('clip')}>Export Clip</button>
                <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('normalized')}>Export Normalized</button>
                <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('convert')}>Convert</button>
              </div>
            </div>

            <div className="pro-panel">
              <div className="pro-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Plugin Rack (VST3)</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 400, letterSpacing: '0.04em' }}>HEADLESS</span>
              </div>

              {/* Plugin slot display */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{
                  flex: 1,
                  padding: '5px 8px',
                  background: previewDeck.activePluginPath ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${previewDeck.activePluginPath ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 4,
                  fontSize: 11,
                  color: previewDeck.activePluginPath ? 'rgba(200,200,255,0.95)' : 'rgba(255,255,255,0.35)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  {previewDeck.activePluginPath
                    ? `⬡ ${previewDeck.activePluginPath.split(/[/\\]/).pop()}`
                    : '— No plugin loaded —'}
                </div>

                <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    className="vst-plugin-dropdown"
                    value={previewDeck.activePluginPath || ''}
                    onChange={async (e) => {
                      const path = e.target.value;
                      if (!path) return;
                      try {
                        await loadAudioDeckPlugin(previewDeck.deckId, path);
                        setWorkbenchStatus(`Plugin loaded: ${path.split(/[/\\]/).pop()}`);
                      } catch (err: any) {
                        setWorkbenchStatus(`Plugin load failed: ${err?.message ?? err}`);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 6px',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      fontSize: 11,
                      color: previewDeck.activePluginPath ? '#fff' : 'rgba(255,255,255,0.4)',
                      outline: 'none',
                    }}
                  >
                    <option value="" disabled>
                      {isScanningVst ? 'Scanning for plugins...' : 'Select a VST3 plugin...'}
                    </option>
                    {discoveredPlugins.map(plugin => (
                      <option key={plugin.path} value={plugin.path}>
                        {plugin.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    title="Rescan VST3 Folders"
                    onClick={async () => {
                      setIsScanningVst(true);
                      try {
                        const defaults = await getExplorerVstDefaultScanPaths();
                        const validDefaults = defaults.filter(p => p.exists).map(p => p.path);
                        const plugins = await scanExplorerVstPlugins([...validDefaults, ...(settings.audio?.vst3AdditionalFolders ?? [])]);
                        setDiscoveredPlugins(plugins);
                        setWorkbenchStatus(`Scanned ${plugins.length} VST3 plugins.`);
                      } finally {
                        setIsScanningVst(false);
                      }
                    }}
                    style={{
                      padding: '4px 6px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      color: 'rgba(255,255,255,0.6)',
                      cursor: 'pointer',
                    }}
                  >
                    ↻
                  </button>
                </div>

                {previewDeck.activePluginPath && (
                  <button
                    id="audio-workbench-clear-vst-btn"
                    type="button"
                    style={toolbarButtonStyle('danger')}
                    onClick={async () => {
                      await clearAudioDeckPlugin(previewDeck.deckId);
                      setWorkbenchStatus('Plugin cleared.');
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4, paddingBottom: 8 }}>
                 <button
                   type="button"
                   style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
                   onClick={async () => {
                      const { open } = await import('@tauri-apps/plugin-fs').catch(() => ({ open: null as any }));
                      if (open) {
                        const picked = await (open as any)({
                          title: 'Select a VST3 Plugin',
                          filters: [{ name: 'VST3 Plugin', extensions: ['vst3', 'so', 'dll', 'dylib'] }],
                          multiple: false,
                          directory: false,
                        }) as string | null;
                        if (picked) {
                          await loadAudioDeckPlugin(previewDeck.deckId, picked);
                          setWorkbenchStatus(`Plugin loaded: ${picked.split(/[/\\]/).pop()}`);
                        }
                      }
                   }}
                 >
                   Browse files...
                 </button>
              </div>

              {/* Auto-generated parameter sliders */}
              {previewDeck.vstParameters && previewDeck.vstParameters.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 10,
                  maxHeight: 280,
                  overflowY: 'auto',
                  paddingRight: 2,
                }}>
                  {previewDeck.vstParameters.map((param) => (
                    <div
                      key={param.id}
                      style={{
                        background: 'rgba(0,0,0,0.18)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 5,
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 500, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          {param.title || param.shortTitle}
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(160,160,220,0.8)', fontFamily: 'monospace', flexShrink: 0 }}>
                          {(param.valueNormalized * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        id={`vst-param-${previewDeck.deckId}-${param.id}`}
                        type="range"
                        min={0}
                        max={1}
                        step={0.001}
                        defaultValue={param.valueNormalized}
                        style={{ width: '100%', accentColor: 'hsl(245 80% 60%)' }}
                        onChange={() => { /* param automation wired in next phase */ }}
                      />
                      {param.units ? (
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>{param.units}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : previewDeck.activePluginPath ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '6px 0', fontStyle: 'italic' }}>
                  No parameters exposed — plugin may not support headless parameter query yet.
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', padding: '4px 0', fontStyle: 'italic' }}>
                  Load a .vst3 plugin above to auto-generate its parameter controls.
                </div>
              )}
            </div>

          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', gap: 16, flexWrap: 'wrap', paddingBottom: 20 }}>
            {workbenchError || snapshot.engineError ? (
              <span style={{ color: '#ef4444' }}>{workbenchError ?? previewDeck.error ?? snapshot.engineError}</span>
            ) : (
              <span>{workbenchStatus}</span>
            )}
            {exportMessage && <span>• {exportMessage}</span>}
            <span>• Peak: {formatDb(analysis?.peakLevel)} / RMS: {formatDb(analysis?.rmsLevel)}</span>
            <span>• Silence Regions: {silenceRegions.length}</span>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => jumpToAdjacentSilence('previous')}>Prev Silence</button>
              <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => jumpToAdjacentSilence('next')}>Next Silence</button>
            </span>
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
            ? `This will write a ${convertFormat.toUpperCase()} export using the current trim, pitch, fade, and spectrogram settings.`
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
        submitLabel='Export Audio'
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
