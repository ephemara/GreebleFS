import { convertFileSrc } from '@tauri-apps/api/core';
import {
  forwardRef,
  memo,
  useCallback,
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
} from '@/components/AppIcons';
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
import { PremiumSlider } from './PremiumSlider';
import { OverlayToggle } from './OverlayToggle';
import { AppSelect } from './AppSelect';
import type { ExplorerPreviewWildcardWorkflowTab } from './explorer/explorerPreviewWorkflowTabs';
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
  setAudioDeckPluginParameter,
} from '../store/audioEngineStore';
import { useSettingsStore } from '../store/settingsStore';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';
import {
  createExplorerVstEditorSession,
  destroyExplorerVstEditorSession,
  focusExplorerVstEditorSession,
  syncExplorerVstEditorSessionRect,
  type ExplorerVstEditorSessionState,
} from '../runtime/audioVstEditorBackend';

type ExplorerAudioWorkbenchProps = {
  audioPath: string;
  audioName: string;
  audioExtension: string;
  audioSize: number;
  mode?: 'preview' | 'edit';
  workflowTabId?: string;
  onRegisterWorkflowTabs?: (
    tabs: ExplorerPreviewWildcardWorkflowTab[] | null,
  ) => void;
  onExported?: (outputPath: string) => Promise<void> | void;
};

type ExportDialogMode = 'clip' | 'normalized' | 'convert' | 'overwrite' | null;
type TimelineDragMode = 'playhead' | 'selectionStart' | 'selectionEnd' | 'fadeIn' | 'fadeOut';
type VstPluginPathDialogMode = 'load' | null;
type VstPresentationMode = 'headless' | 'surface';


const MINIMUM_SELECTION_SECONDS = 0.05;
const FADE_KEYBOARD_STEP_SECONDS = 0.1;
const FINE_TRIM_NUDGE_SECONDS = 0.01;
const AUDIO_WILDCARD_WORKFLOW_TABS: ExplorerPreviewWildcardWorkflowTab[] = [
  {
    id: 'vst',
    label: 'VST',
    baseMode: 'edit',
  },
];

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
    fontWeight: 600,
    color: 'var(--overlay-text-primary)',
  };

  if (emphasis === 'primary') {
    return {
      ...base,
      background: 'var(--overlay-explorer-chip-active-bg)',
      border: '1px solid var(--overlay-explorer-chip-active-border)',
      color: 'var(--overlay-explorer-chip-active-text)',
    };
  }
  if (emphasis === 'danger') {
    return {
      ...base,
      background: 'color-mix(in srgb, #c0392b 20%, var(--overlay-explorer-chip-bg) 80%)',
      border: '1px solid color-mix(in srgb, #c0392b 52%, var(--overlay-explorer-chip-border) 48%)',
      color: 'var(--overlay-text-primary)',
    };
  }
  if (emphasis === 'ghost') {
    return {
      ...base,
      background: 'transparent',
      border: '1px solid transparent',
      color: 'var(--overlay-text-muted)',
    };
  }
  return {
    ...base,
    background: 'var(--overlay-explorer-chip-bg)',
    border: '1px solid var(--overlay-explorer-chip-border)',
    color: 'var(--overlay-text-primary)',
  };
}

function compactToolbarButtonStyle(
  emphasis: 'default' | 'primary' | 'danger' | 'ghost' = 'default',
): CSSProperties {
  return {
    ...toolbarButtonStyle(emphasis),
    padding: '3px 7px',
    fontSize: 10,
    borderRadius: 4,
    minHeight: 26,
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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--overlay-text-muted)', fontSize: 12 }}>{isAnalyzing ? 'Analyzing...' : 'Waveform unavailable'}</div>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', height: '100%', gap: 0 }}>
      {waveformBuckets.map((bucket) => (
        <div
          key={bucket.index}
          style={{
            flex: 1,
            height: `${Math.max(2, bucket.peakLevel * 100)}%`,
            background: bucket.rmsLevel > 0.05
              ? 'var(--overlay-explorer-chip-active-border)'
              : 'color-mix(in srgb, var(--overlay-accent) 66%, transparent)',
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
            background: 'color-mix(in srgb, var(--overlay-accent) 54%, #f4d03f 46%)',
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
              background: 'var(--overlay-accent)',
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
  mode = 'edit',
  workflowTabId,
  onRegisterWorkflowTabs,
  onExported,
}: ExplorerAudioWorkbenchProps) {
  useAudioEngineFeed();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const vstHostSurfaceRef = useRef<HTMLDivElement | null>(null);
  const vstEditorSessionIdRef = useRef<string | null>(null);
  const snapshot = useAudioEngineSnapshot();
  const settings = useSettingsStore((state) => state.settings);
  const keybindings = settings.keybindings;
  const activeDeckId = 'a' as const;
  const previewDeck = getAudioDeckState(snapshot, activeDeckId);
  const activeWorkflowTabId = workflowTabId ?? mode;
  const isPreviewMode = activeWorkflowTabId === 'preview';
  const isEditMode = activeWorkflowTabId === 'edit';
  const isVstMode = activeWorkflowTabId === 'vst';

  const [analysis, setAnalysis] = useState<ExplorerAudioPreviewAnalysis | null>(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
  const [pitchShiftCents, setPitchShiftCents] = useState(0);
  
  // VST Discovery State
  const [discoveredPlugins, setDiscoveredPlugins] = useState<ExplorerVstPluginEntry[]>([]);
  const [isScanningVst, setIsScanningVst] = useState(false);
  const [selectedVstPluginPath, setSelectedVstPluginPath] = useState('');
  const [manualVstPathInput, setManualVstPathInput] = useState('');
  const [vstPluginPathDialogMode, setVstPluginPathDialogMode] =
    useState<VstPluginPathDialogMode>(null);
  const [vstPresentationMode, setVstPresentationMode] =
    useState<VstPresentationMode>('headless');
  const [vstParameterSearch, setVstParameterSearch] = useState('');
  const [vstEditorSession, setVstEditorSession] =
    useState<ExplorerVstEditorSessionState | null>(null);

  useEffect(() => {
    onRegisterWorkflowTabs?.(AUDIO_WILDCARD_WORKFLOW_TABS);
    return () => {
      onRegisterWorkflowTabs?.(null);
    };
  }, [onRegisterWorkflowTabs]);
  
  useEffect(() => {
    if (!isVstMode) {
      setIsScanningVst(false);
      return undefined;
    }

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
          if (plugins.length === 1 && !selectedVstPluginPath && !previewDeck.activePluginPath) {
            setSelectedVstPluginPath(plugins[0].path);
          }
        }
      } catch (err: any) {
        if (active) {
          const message = err instanceof Error ? err.message : String(err);
          setWorkbenchError(message);
          setWorkbenchStatus('VST scan failed.');
        }
      } finally {
        if (active) setIsScanningVst(false);
      }
    };
    runScan();
    return () => { active = false; };
  }, [
    isVstMode,
    previewDeck.activePluginPath,
    selectedVstPluginPath,
    settings.audio?.vst3AdditionalFolders,
  ]);

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

  useEffect(() => {
    if (!previewDeck.activePluginPath) {
      return;
    }
    setSelectedVstPluginPath(previewDeck.activePluginPath);
    setManualVstPathInput(previewDeck.activePluginPath);
  }, [previewDeck.activePluginPath]);

  useEffect(() => {
    if (!isVstMode) {
      setVstPresentationMode('headless');
      setVstParameterSearch('');
    }
  }, [isVstMode]);

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
        await loadSelectionIntoAudioDeck(activeDeckId, audioPath);
        if (cancelled) {
          return;
        }
        setWorkbenchStatus('Audio loaded. Building waveform and frequency preview…');
        const nextAnalysis = await analyzeExplorerAudioPreview(audioPath);
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
  const currentTimeSeconds = clamp(
    previewDeck.currentTimeSeconds ?? 0,
    0,
    effectiveDuration || 0,
  );
  const playheadLeft =
    effectiveDuration > 0
      ? `${(currentTimeSeconds / effectiveDuration) * 100}%`
      : '0%';
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
  const previewSummaryItems = useMemo(
    () => [
      {
        label: 'Format',
        value: audioExtension ? audioExtension.toUpperCase() : 'Audio',
      },
      {
        label: 'Duration',
        value: formatDuration(analysis?.durationSeconds ?? effectiveDuration),
      },
      {
        label: 'Sample Rate',
        value: analysis?.sampleRateHz
          ? `${analysis.sampleRateHz.toLocaleString()} Hz`
          : 'Unknown',
      },
      {
        label: 'Tempo',
        value: formatBpm(estimatedBpm),
      },
    ],
    [analysis?.durationSeconds, analysis?.sampleRateHz, audioExtension, effectiveDuration, estimatedBpm],
  );
  const previewShortcutItems = useMemo(
    () =>
      [
        keybindings.audioWorkbenchPlayPause
          ? `${keybindings.audioWorkbenchPlayPause} play/pause`
          : null,
        keybindings.audioWorkbenchToggleEditMode
          ? `${keybindings.audioWorkbenchToggleEditMode} edit`
          : null,
        keybindings.audioWorkbenchExportClip
          ? `${keybindings.audioWorkbenchExportClip} export clip`
          : null,
      ].filter((value): value is string => Boolean(value)),
    [
      keybindings.audioWorkbenchExportClip,
      keybindings.audioWorkbenchPlayPause,
      keybindings.audioWorkbenchToggleEditMode,
    ],
  );
  const vstPluginOptions = useMemo(() => {
    if (!selectedVstPluginPath) {
      return discoveredPlugins;
    }

    if (discoveredPlugins.some((plugin) => plugin.path === selectedVstPluginPath)) {
      return discoveredPlugins;
    }

    const fileStem =
      selectedVstPluginPath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.vst3$/i, '') || 'Manual Plugin';

    return [
      {
        name: `${fileStem} (manual)`,
        path: selectedVstPluginPath,
        fileStem,
      },
      ...discoveredPlugins,
    ];
  }, [discoveredPlugins, selectedVstPluginPath]);
  const isVstHeadlessMode = isVstMode && vstPresentationMode === 'headless';
  const isVstSurfaceMode = isVstMode && vstPresentationMode === 'surface';
  const activeVstPluginLeafName =
    previewDeck.activePluginPath?.split(/[/\\]/).pop() ?? null;
  const selectedVstPluginLeafName =
    selectedVstPluginPath.split(/[/\\]/).pop() || null;
  const visibleVstParameters = useMemo(() => {
    const search = vstParameterSearch.trim().toLowerCase();
    if (!search) {
      return previewDeck.vstParameters;
    }

    return previewDeck.vstParameters.filter((parameter) => {
      const title = parameter.title.toLowerCase();
      const shortTitle = parameter.shortTitle.toLowerCase();
      const units = parameter.units.toLowerCase();
      return title.includes(search) || shortTitle.includes(search) || units.includes(search);
    });
  }, [previewDeck.vstParameters, vstParameterSearch]);
  const hasLoopSelectionPreview =
    previewDeck.loopRegion.enabled &&
    effectiveDuration > 0 &&
    selectionDuration > 0 &&
    (selectionStart > FINE_TRIM_NUDGE_SECONDS ||
      Math.abs(selectionEnd - effectiveDuration) > FINE_TRIM_NUDGE_SECONDS);
  const previewTransportStatus = workbenchError || previewDeck.error || snapshot.engineError
    ? workbenchError ?? previewDeck.error ?? snapshot.engineError
    : workbenchStatus;

  const updateDeckVstParameter = useCallback(
    async (parameterId: number, valueNormalized: number) => {
      try {
        await setAudioDeckPluginParameter(
          previewDeck.deckId,
          parameterId,
          clamp(valueNormalized, 0, 1),
        );
        setWorkbenchError(null);
      } catch (error) {
        setWorkbenchError(error instanceof Error ? error.message : String(error));
      }
    },
    [previewDeck.deckId],
  );

  const resetVisibleVstParametersToDefault = useCallback(async () => {
    if (visibleVstParameters.length === 0) {
      return;
    }

    try {
      await Promise.all(
        visibleVstParameters.map((parameter) =>
          setAudioDeckPluginParameter(
            previewDeck.deckId,
            parameter.id,
            parameter.defaultNormalized,
          ),
        ),
      );
      setWorkbenchError(null);
      setWorkbenchStatus(
        `Reset ${visibleVstParameters.length} parameter${visibleVstParameters.length === 1 ? '' : 's'} to default.`,
      );
    } catch (error) {
      setWorkbenchError(error instanceof Error ? error.message : String(error));
      setWorkbenchStatus('Parameter reset failed.');
    }
  }, [previewDeck.deckId, visibleVstParameters]);

  const loadDeckPlugin = useCallback(
    async (pluginPath: string) => {
      const normalizedPluginPath = pluginPath.trim();
      if (!normalizedPluginPath) {
        setWorkbenchError('Choose a VST3 plugin path before loading it.');
        setWorkbenchStatus('Plugin load failed.');
        return null;
      }

      setSelectedVstPluginPath(normalizedPluginPath);
      setManualVstPathInput(normalizedPluginPath);
      setWorkbenchError(null);
      setWorkbenchStatus(
        `Loading VST3 plugin: ${normalizedPluginPath.split(/[/\\]/).pop()}…`,
      );

      try {
        const nextSnapshot = await loadAudioDeckPlugin(previewDeck.deckId, normalizedPluginPath);
        const nextDeck = getAudioDeckState(nextSnapshot, previewDeck.deckId);
        if (nextDeck.error) {
          setWorkbenchError(nextDeck.error);
          setWorkbenchStatus('Plugin load failed.');
          return nextSnapshot;
        }

        setWorkbenchStatus(
          `Plugin loaded: ${normalizedPluginPath.split(/[/\\]/).pop()}`,
        );
        return nextSnapshot;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkbenchError(message);
        setWorkbenchStatus('Plugin load failed.');
        return null;
      }
    },
    [previewDeck.deckId],
  );

  useEffect(() => {
    if (!isVstSurfaceMode || !previewDeck.activePluginPath) {
      if (vstEditorSessionIdRef.current) {
        void destroyExplorerVstEditorSession(vstEditorSessionIdRef.current);
        vstEditorSessionIdRef.current = null;
      }
      setVstEditorSession(null);
      return;
    }

    let disposed = false;
    let sessionId: string | null = null;
    const hostElement = vstHostSurfaceRef.current;

    const syncRect = async () => {
      if (!hostElement || !sessionId) {
        return;
      }
      const rect = hostElement.getBoundingClientRect();
      const nextSession = await syncExplorerVstEditorSessionRect({
        sessionId,
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          scaleFactor: window.devicePixelRatio || 1,
        },
      });
      if (!disposed) {
        setVstEditorSession(nextSession);
      }
    };

    void (async () => {
      try {
        const activePluginPath = previewDeck.activePluginPath;
        if (!activePluginPath) {
          return;
        }
        const session = await createExplorerVstEditorSession({
          deckId: previewDeck.deckId,
          pluginPath: activePluginPath,
        });
        if (disposed) {
          await destroyExplorerVstEditorSession(session.sessionId);
          return;
        }
        sessionId = session.sessionId;
        vstEditorSessionIdRef.current = session.sessionId;
        setVstEditorSession(session);
        await syncRect();
      } catch (error) {
        if (!disposed) {
          setWorkbenchError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    if (!hostElement || typeof ResizeObserver === 'undefined') {
      return () => {
        disposed = true;
        if (sessionId) {
          void destroyExplorerVstEditorSession(sessionId);
          if (vstEditorSessionIdRef.current === sessionId) {
            vstEditorSessionIdRef.current = null;
          }
        }
      };
    }

    const observer = new ResizeObserver(() => {
      void syncRect();
    });
    observer.observe(hostElement);

    return () => {
      disposed = true;
      observer.disconnect();
      if (sessionId) {
        void destroyExplorerVstEditorSession(sessionId);
        if (vstEditorSessionIdRef.current === sessionId) {
          vstEditorSessionIdRef.current = null;
        }
      }
    };
  }, [
    isVstSurfaceMode,
    previewDeck.activePluginPath,
    previewDeck.deckId,
  ]);

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

  const rootSurfaceStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    color: 'var(--overlay-text-primary)',
    background:
      'radial-gradient(circle at top left, color-mix(in srgb, var(--overlay-accent) 12%, transparent), transparent 34%), var(--overlay-explorer-preview-bg)',
  };
  const contentShellStyle: CSSProperties = {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: '100%',
  };
  const cardStyle: CSSProperties = {
    border: '1px solid var(--overlay-explorer-preview-border)',
    borderRadius: 'calc(var(--overlay-explorer-control-radius, 10px) + 4px)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--overlay-explorer-preview-bg) 88%, white 12%), var(--overlay-explorer-preview-bg))',
    boxShadow: '0 10px 26px rgba(0, 0, 0, 0.14)',
  };
  const panelStyle: CSSProperties = {
    ...cardStyle,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };
  const formControlStyle: CSSProperties = {
    appearance: 'none',
    width: '100%',
    borderRadius: 'var(--overlay-explorer-control-radius, 8px)',
    border: '1px solid var(--overlay-explorer-chip-border)',
    background: 'var(--overlay-explorer-chip-bg)',
    color: 'var(--overlay-text-primary)',
    padding: '7px 9px',
    fontSize: 11,
    outline: 'none',
  };
  const sectionHeaderStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--overlay-text-muted)',
  };
  const formLabelStyle: CSSProperties = {
    display: 'block',
    marginBottom: 4,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--overlay-text-muted)',
  };
  const statusChipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid var(--overlay-explorer-chip-border)',
    background: 'var(--overlay-explorer-chip-bg)',
    fontSize: 11,
  };
  const summaryCardStyle: CSSProperties = {
    padding: '12px 14px',
    borderRadius: 'calc(var(--overlay-explorer-control-radius, 10px) + 4px)',
    background: 'var(--overlay-explorer-chip-bg)',
    border: '1px solid var(--overlay-explorer-chip-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  };
  const vstModeTabRowStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  };
  const activeStatusMessage =
    workbenchError || previewDeck.error || snapshot.engineError
      ? workbenchError ?? previewDeck.error ?? snapshot.engineError
      : previewTransportStatus;
  const previewPlaybackOverview = (
    <div
      data-testid="audio-preview-overview"
      style={{ ...cardStyle, padding: 12, display: 'grid', gap: 10 }}
    >
      <div
        ref={timelineRef}
        role="presentation"
        onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
        style={{
          position: 'relative',
          height: 96,
          borderRadius: 'calc(var(--overlay-explorer-control-radius, 10px) + 4px)',
          overflow: 'hidden',
          cursor: 'pointer',
          border: '1px solid var(--overlay-explorer-preview-border)',
          background: 'color-mix(in srgb, var(--overlay-explorer-preview-bg) 82%, black 18%)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, width: playheadLeft, background: 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)', pointerEvents: 'none', zIndex: 1 }} />
        {hasLoopSelectionPreview ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: selectionLeft,
              width: selectionWidth,
              background: 'color-mix(in srgb, var(--overlay-accent) 18%, transparent)',
              borderLeft: '1px solid var(--overlay-explorer-chip-active-border)',
              borderRight: '1px solid var(--overlay-explorer-chip-active-border)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        ) : null}
        <AudioWorkbenchWaveformBars waveformBuckets={waveformBuckets} isAnalyzing={isAnalyzing} />
        <AudioWorkbenchPlayheadMarker
          ref={playheadMarkerRef}
          currentTimeSeconds={currentTimeSeconds}
          durationSeconds={effectiveDuration}
          isPlaying={previewDeck.isPlaying}
          playbackRate={previewDeck.rate}
        />
      </div>
      {spectralBands.length > 0 ? (
        <div style={{ height: 34, borderRadius: 'var(--overlay-explorer-control-radius, 8px)', overflow: 'hidden', border: '1px solid var(--overlay-explorer-chip-border)', background: 'var(--overlay-explorer-chip-bg)' }}>
          <AudioWorkbenchSpectralBars spectralBands={spectralBands} />
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
        {previewSummaryItems.map((item) => (
          <div key={item.label} style={summaryCardStyle}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>
              {item.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ ...statusChipStyle, color: workbenchError || previewDeck.error || snapshot.engineError ? '#c0392b' : 'var(--overlay-text-primary)' }}>
          {activeStatusMessage}
        </span>
        <span style={statusChipStyle}>Peak {formatDb(analysis?.peakLevel)}</span>
        <span style={statusChipStyle}>RMS {formatDb(analysis?.rmsLevel)}</span>
        <span style={statusChipStyle}>Silence regions: {silenceRegions.length}</span>
        {previewShortcutItems.map((shortcut) => (
          <span key={shortcut} style={statusChipStyle}>{shortcut}</span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={rootRef}
        tabIndex={-1}
        data-testid={isPreviewMode ? 'audio-preview-surface' : undefined}
        style={rootSurfaceStyle}
      >
        <div style={contentShellStyle}>
          <div
            style={{
              ...cardStyle,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--overlay-explorer-control-radius, 8px)',
                  border: '1px solid var(--overlay-explorer-chip-border)',
                  background: 'var(--overlay-explorer-chip-bg)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <AudioLines size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {audioName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {audioExtension.toUpperCase()} • {formatSize(audioSize)} • {formatDuration(analysis?.durationSeconds ?? effectiveDuration)} • {analysis?.sampleRateHz ? `${analysis.sampleRateHz.toLocaleString()} Hz` : 'Unknown Hz'} • {formatBpm(estimatedBpm)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                aria-label={isPreviewMode ? (previewDeck.isPlaying ? 'Pause audio preview' : 'Play audio preview') : undefined}
                onClick={() => void togglePreviewDeckPlayback()}
                style={toolbarButtonStyle('primary')}
              >
                {previewDeck.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {previewDeck.isPlaying ? 'Pause' : 'Play'}
              </button>
              <button type="button" style={toolbarButtonStyle()} onClick={() => void handleStopPlayback()}>
                Stop
              </button>
              <div style={statusChipStyle}>
                {formatDuration(currentTimeSeconds)} / {formatDuration(analysis?.durationSeconds ?? effectiveDuration)}
              </div>
            </div>
          </div>

          {isPreviewMode ? (
            <>
              {previewPlaybackOverview}
            </>
          ) : isEditMode ? (
            <>
              <div style={{ ...cardStyle, padding: 12, display: 'grid', gap: 8 }}>
                <div
                  ref={timelineRef}
                  role="presentation"
                  onMouseDown={(event) => beginTimelineDrag('playhead', event.clientX)}
                  style={{
                    position: 'relative',
                    height: 124,
                    borderRadius: 'calc(var(--overlay-explorer-control-radius, 10px) + 4px)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: '1px solid var(--overlay-explorer-preview-border)',
                    background: 'color-mix(in srgb, var(--overlay-explorer-preview-bg) 82%, black 18%)',
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, width: playheadLeft, background: 'color-mix(in srgb, var(--overlay-accent) 14%, transparent)', pointerEvents: 'none', zIndex: 1 }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: selectionLeft,
                      width: selectionWidth,
                      background: 'color-mix(in srgb, var(--overlay-accent) 16%, transparent)',
                      borderLeft: '1px solid var(--overlay-explorer-chip-active-border)',
                      borderRight: '1px solid var(--overlay-explorer-chip-active-border)',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: selectionLeft, width: fadeInWidth, background: 'linear-gradient(90deg, color-mix(in srgb, white 22%, transparent), transparent)', pointerEvents: 'none', zIndex: 3 }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: fadeOutHandleLeft, width: fadeOutWidth, background: 'linear-gradient(270deg, color-mix(in srgb, white 22%, transparent), transparent)', pointerEvents: 'none', zIndex: 3 }} />
                  <AudioWorkbenchWaveformBars waveformBuckets={waveformBuckets} isAnalyzing={isAnalyzing} />
                  <div
                    role="presentation"
                    onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('selectionStart', event.clientX); }}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: selectionLeft, width: 10, marginLeft: -5, cursor: 'ew-resize', display: 'flex', justifyContent: 'center', zIndex: 4 }}
                  >
                    <div style={{ width: 2, height: '100%', background: 'var(--overlay-explorer-chip-active-border)' }} />
                  </div>
                  <div
                    role="presentation"
                    onMouseDown={(event) => { event.stopPropagation(); beginTimelineDrag('selectionEnd', event.clientX); }}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${selectionLeft} + ${selectionWidth})`, width: 10, marginLeft: -5, cursor: 'ew-resize', display: 'flex', justifyContent: 'center', zIndex: 4 }}
                  >
                    <div style={{ width: 2, height: '100%', background: 'var(--overlay-explorer-chip-active-border)' }} />
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
                    style={{ position: 'absolute', top: 0, width: 12, height: 12, left: fadeInHandleLeft, transform: 'translateX(-50%)', cursor: 'ew-resize', zIndex: 5 }}
                  >
                    <div style={{ width: 0, height: 0, borderTop: '12px solid var(--overlay-text-primary)', borderRight: '12px solid transparent' }} />
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
                    style={{ position: 'absolute', top: 0, width: 12, height: 12, left: fadeOutHandleLeft, transform: 'translateX(-50%)', cursor: 'ew-resize', zIndex: 5 }}
                  >
                    <div style={{ width: 0, height: 0, borderTop: '12px solid var(--overlay-text-primary)', borderLeft: '12px solid transparent' }} />
                  </div>
                  <AudioWorkbenchPlayheadMarker
                    ref={playheadMarkerRef}
                    currentTimeSeconds={currentTimeSeconds}
                    durationSeconds={effectiveDuration}
                    isPlaying={previewDeck.isPlaying}
                    playbackRate={previewDeck.rate}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'var(--overlay-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <div>In {formatPreciseSeconds(selectionStart)}s • Out {formatPreciseSeconds(selectionEnd)}s • Len {formatPreciseSeconds(selectionDuration)}s</div>
                  <div>Fade in {formatFadeDuration(boundedFadeInSeconds)} • Fade out {formatFadeDuration(boundedFadeOutSeconds)}</div>
                </div>
              </div>

              {(spectralBands.length > 0 || spectrogramSource) ? (
                <div style={{ display: 'grid', gridTemplateColumns: spectrogramSource ? '1fr 1fr' : '1fr', gap: 12 }}>
                  {spectralBands.length > 0 ? (
                    <div style={{ ...cardStyle, padding: 10, height: 48, overflow: 'hidden' }}>
                      <AudioWorkbenchSpectralBars spectralBands={spectralBands} />
                    </div>
                  ) : null}
                  {spectrogramSource ? (
                    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', minHeight: 48 }}>
                      <img src={spectrogramSource} alt="Spectrogram" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                <div style={panelStyle}>
                  <div style={sectionHeaderStyle}>Precision Trim</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <div>
                      <label style={formLabelStyle}>In</label>
                      <input type="number" style={formControlStyle} step="0.001" min="0" value={formatPreciseSeconds(selectionStart)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) updateSelectionStartFromInput(value); }} />
                    </div>
                    <div>
                      <label style={formLabelStyle}>Out</label>
                      <input type="number" style={formControlStyle} step="0.001" min="0" value={formatPreciseSeconds(selectionEnd)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) updateSelectionEndFromInput(value); }} />
                    </div>
                    <div>
                      <label style={formLabelStyle}>Length</label>
                      <input type="number" style={formControlStyle} step="0.001" min={MINIMUM_SELECTION_SECONDS.toString()} value={formatPreciseSeconds(selectionDuration)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) updateSelectionDurationFromInput(value); }} />
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

                <div style={panelStyle}>
                  <div style={sectionHeaderStyle}>Deck Controls</div>
                  <div>
                    <label style={formLabelStyle}>Gain ({previewDeck.gainLinear.toFixed(2)}x)</label>
                    <PremiumSlider
                      ariaLabel="Deck gain"
                      ariaValueText={`${previewDeck.gainLinear.toFixed(2)}x`}
                      density="compact"
                      min={0}
                      max={2}
                      step={0.01}
                      value={previewDeck.gainLinear}
                      onChange={(value) => void handleGainChange(value)}
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Rate ({previewDeck.rate.toFixed(2)}x)</label>
                    <PremiumSlider
                      ariaLabel="Deck rate"
                      ariaValueText={`${previewDeck.rate.toFixed(2)}x`}
                      density="compact"
                      min={0.5}
                      max={2}
                      step={0.01}
                      value={previewDeck.rate}
                      onChange={(value) => void handleRateChange(value)}
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Pitch Shift ({formatPitchShift(pitchShiftCents)})</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <PremiumSlider
                        ariaLabel="Pitch shift"
                        ariaValueText={formatPitchShift(pitchShiftCents)}
                        density="compact"
                        min={-1200}
                        max={1200}
                        step={1}
                        value={pitchShiftCents}
                        onChange={setPitchShiftCents}
                        style={{ flex: 1 }}
                      />
                      <input aria-label="Pitch shift cents" type="number" style={{ ...formControlStyle, width: 84 }} min="-1200" max="1200" value={Math.round(pitchShiftCents)} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) setPitchShiftCents(clamp(value, -1200, 1200)); }} />
                    </div>
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={sectionHeaderStyle}>Transform & Export</div>
                  <div>
                    <label style={formLabelStyle}>Convert Format</label>
                    <AppSelect style={formControlStyle} value={convertFormat} onChange={(event) => setConvertFormat(event.target.value as 'mp3' | 'wav' | 'flac' | 'ogg')}>
                      {EXPLORER_AUDIO_EXPORT_FORMATS.map((format) => (
                        <option key={format.id} value={format.id}>{format.label}</option>
                      ))}
                    </AppSelect>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--overlay-text-primary)' }}>
                    <OverlayToggle
                      size="compact"
                      checked={generateSpectrogram}
                      aria-label="Generate spectrogram preview"
                      onChange={(event) => setGenerateSpectrogram(event.target.checked)}
                    />
                    Spectrogram preview
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('clip')}>Export Clip</button>
                    <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('normalized')}>Export Normalized</button>
                    <button type="button" style={toolbarButtonStyle('primary')} onClick={() => openExportDialog('convert')}>Convert</button>
                    <button type="button" style={toolbarButtonStyle('danger')} onClick={() => setExportDialogMode('overwrite')}>Save Edits to File</button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...statusChipStyle, color: workbenchError || previewDeck.error || snapshot.engineError ? '#c0392b' : 'var(--overlay-text-primary)' }}>
                  {activeStatusMessage}
                </span>
                {exportMessage ? <span style={statusChipStyle}>{exportMessage}</span> : null}
                <span style={statusChipStyle}>Peak {formatDb(analysis?.peakLevel)}</span>
                <span style={statusChipStyle}>RMS {formatDb(analysis?.rmsLevel)}</span>
                <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => jumpToAdjacentSilence('previous')}>Prev Silence</button>
                <button type="button" style={toolbarButtonStyle('ghost')} onClick={() => jumpToAdjacentSilence('next')}>Next Silence</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 10, minHeight: 0 }}>
                {previewPlaybackOverview}

                <div style={{ ...cardStyle, padding: 10, display: 'grid', gap: 8 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: previewDeck.activePluginPath
                        ? 'minmax(0, 1fr) auto auto auto'
                        : 'minmax(0, 1fr) auto auto',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <AppSelect
                      value={selectedVstPluginPath}
                      onChange={(event) => {
                        setSelectedVstPluginPath(event.target.value);
                        setWorkbenchError(null);
                      }}
                      style={{ ...formControlStyle, minWidth: 0, padding: '6px 8px', fontSize: 10 }}
                    >
                      <option value="">
                        {isScanningVst
                          ? 'Scanning host-ready VST3 plugins...'
                          : vstPluginOptions.length > 0
                            ? 'Pick a VST3 plugin...'
                            : 'No host-ready VST3 plugins found'}
                      </option>
                      {vstPluginOptions.map((plugin) => (
                        <option key={plugin.path} value={plugin.path}>
                          {plugin.name}
                        </option>
                      ))}
                    </AppSelect>
                    <button
                      type="button"
                      style={compactToolbarButtonStyle()}
                      onClick={() => {
                        setManualVstPathInput(
                          selectedVstPluginPath || previewDeck.activePluginPath || '',
                        );
                        setVstPluginPathDialogMode('load');
                      }}
                    >
                      Path…
                    </button>
                    <button
                      type="button"
                      style={compactToolbarButtonStyle('primary')}
                      disabled={!selectedVstPluginPath}
                      onClick={() => void loadDeckPlugin(selectedVstPluginPath)}
                    >
                      Load
                    </button>
                    {previewDeck.activePluginPath ? (
                      <button
                        id="audio-workbench-clear-vst-btn"
                        type="button"
                        style={compactToolbarButtonStyle('danger')}
                        onClick={() => {
                          void clearAudioDeckPlugin(previewDeck.deckId)
                            .then(() => {
                              setWorkbenchError(null);
                              setWorkbenchStatus('Plugin cleared.');
                            })
                            .catch((error) => {
                              const message =
                                error instanceof Error ? error.message : String(error);
                              setWorkbenchError(message);
                              setWorkbenchStatus('Plugin clear failed.');
                            });
                        }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 220px', display: 'grid', gap: 2 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--overlay-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {activeVstPluginLeafName
                          ?? selectedVstPluginLeafName
                          ?? 'No plugin selected'}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--overlay-text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {selectedVstPluginPath || 'Pick a host-ready plugin or load a path.'}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <div style={vstModeTabRowStyle}>
                        <button
                          type="button"
                          aria-pressed={vstPresentationMode === 'headless'}
                          style={compactToolbarButtonStyle(
                            vstPresentationMode === 'headless' ? 'primary' : 'default',
                          )}
                          onClick={() => setVstPresentationMode('headless')}
                        >
                          Headless
                        </button>
                        <button
                          type="button"
                          aria-pressed={vstPresentationMode === 'surface'}
                          style={compactToolbarButtonStyle(
                            vstPresentationMode === 'surface' ? 'primary' : 'default',
                          )}
                          onClick={() => setVstPresentationMode('surface')}
                        >
                          Surface
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
                        {previewDeck.vstParameters.length} params
                        {' · '}
                        {isScanningVst
                          ? 'scanning'
                          : `${vstPluginOptions.length} ready`}
                      </div>
                    </div>
                  </div>
                </div>

                {isVstHeadlessMode ? (
                  <div
                    data-testid="audio-vst-headless-parameters"
                    style={{ ...cardStyle, padding: 10, display: 'grid', gap: 8, minHeight: 0 }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="search"
                        value={vstParameterSearch}
                        onChange={(event) => setVstParameterSearch(event.target.value)}
                        placeholder="Filter parameters..."
                        style={{ ...formControlStyle, minWidth: 0, padding: '6px 8px', fontSize: 10 }}
                      />
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--overlay-text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {visibleVstParameters.length}/{previewDeck.vstParameters.length}
                      </div>
                      <button
                        type="button"
                        style={compactToolbarButtonStyle()}
                        disabled={visibleVstParameters.length === 0}
                        onClick={() => void resetVisibleVstParametersToDefault()}
                      >
                        Reset
                      </button>
                    </div>

                    {previewDeck.vstParameters.length > 0 ? (
                      visibleVstParameters.length > 0 ? (
                        <div
                          style={{
                            display: 'grid',
                            gap: 0,
                            maxHeight: 'min(62vh, 760px)',
                            overflowY: 'auto',
                            border: '1px solid var(--overlay-explorer-chip-border)',
                            borderRadius: 'calc(var(--overlay-explorer-control-radius, 10px) + 2px)',
                            background: 'color-mix(in srgb, var(--overlay-explorer-chip-bg) 78%, transparent)',
                          }}
                        >
                          {visibleVstParameters.map((param, index) => (
                            <div
                              key={param.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 138px) minmax(0, 1fr) 78px auto',
                                gap: 8,
                                alignItems: 'center',
                                padding: '8px 10px',
                                borderTop:
                                  index === 0
                                    ? 'none'
                                    : '1px solid color-mix(in srgb, var(--overlay-explorer-chip-border) 72%, transparent)',
                                background:
                                  index % 2 === 0
                                    ? 'transparent'
                                    : 'color-mix(in srgb, var(--overlay-explorer-preview-bg) 22%, transparent)',
                              }}
                            >
                              <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {param.title || param.shortTitle || `Parameter ${param.id}`}
                                </span>
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: 'var(--overlay-text-muted)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {param.units || param.shortTitle || `ID ${param.id}`}
                                </span>
                              </div>

                              <PremiumSlider
                                ariaLabel={param.title || param.shortTitle || `Parameter ${param.id}`}
                                ariaValueText={param.valueNormalized.toFixed(3)}
                                density="compact"
                                min={0}
                                max={1}
                                step={0.001}
                                value={param.valueNormalized}
                                onChange={(value) => {
                                  void updateDeckVstParameter(
                                    param.id,
                                    value,
                                  );
                                }}
                                style={{ width: '100%' }}
                              />

                              <input
                                aria-label={`${param.title || param.shortTitle || `Parameter ${param.id}`} normalized value`}
                                type="number"
                                min={0}
                                max={1}
                                step={0.001}
                                value={param.valueNormalized.toFixed(3)}
                                style={{
                                  ...formControlStyle,
                                  padding: '5px 7px',
                                  fontSize: 10,
                                  textAlign: 'right',
                                }}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value);
                                  if (Number.isFinite(nextValue)) {
                                    void updateDeckVstParameter(param.id, nextValue);
                                  }
                                }}
                              />

                              <button
                                type="button"
                                style={compactToolbarButtonStyle('ghost')}
                                onClick={() =>
                                  void updateDeckVstParameter(
                                    param.id,
                                    param.defaultNormalized,
                                  )
                                }
                              >
                                Reset
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                          No exposed parameters matched “{vstParameterSearch.trim()}”.
                        </div>
                      )
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                        {previewDeck.activePluginPath
                          ? 'This plugin loaded, but it does not expose headless parameters through the current bridge.'
                          : 'Load a plugin to open the headless parameter workflow.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ ...cardStyle, padding: 10, display: 'grid', gap: 8, minHeight: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
                        {vstEditorSession?.statusLabel
                          ?? 'Surface mode only boots the native host when you explicitly switch to it.'}
                      </div>
                      {vstEditorSession?.sessionId ? (
                        <button
                          type="button"
                          style={compactToolbarButtonStyle()}
                          onClick={() => void focusExplorerVstEditorSession(vstEditorSession.sessionId)}
                        >
                          Focus Host
                        </button>
                      ) : null}
                    </div>
                    <div
                      ref={vstHostSurfaceRef}
                      data-testid="audio-vst-host-surface"
                      style={{
                        minHeight: 360,
                        height: 'clamp(360px, 56vh, 700px)',
                        borderRadius: 'calc(var(--overlay-explorer-control-radius, 10px) + 4px)',
                        border: '1px dashed var(--overlay-explorer-chip-active-border)',
                        background:
                          'radial-gradient(circle at top left, color-mix(in srgb, var(--overlay-accent) 10%, transparent), transparent 34%), color-mix(in srgb, var(--overlay-explorer-preview-bg) 88%, black 12%)',
                        display: 'grid',
                        placeItems: 'center',
                        padding: 16,
                        textAlign: 'center',
                      }}
                    >
                      {previewDeck.activePluginPath ? (
                        <div style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>
                            {activeVstPluginLeafName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                            Attach mode: {vstEditorSession?.attachMode ?? 'pending'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 4 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>No VST loaded</div>
                          <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                            Load a host-ready plugin to boot the surface host.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...statusChipStyle, color: workbenchError || previewDeck.error || snapshot.engineError ? '#c0392b' : 'var(--overlay-text-primary)' }}>
                    {activeStatusMessage}
                  </span>
                  {isVstSurfaceMode && vstEditorSession?.statusLabel ? (
                    <span style={statusChipStyle}>{vstEditorSession.statusLabel}</span>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AppPromptDialog
        open={vstPluginPathDialogMode === 'load'}
        title='Load VST3 Plugin Path'
        description='Paste an absolute path to a host-ready VST3 plugin or bundle.'
        value={manualVstPathInput}
        placeholder='/home/user/.vst3/MyPlugin.vst3'
        submitLabel='Load Plugin'
        onChange={setManualVstPathInput}
        onCancel={() => setVstPluginPathDialogMode(null)}
        onSubmit={() => {
          const nextPath = manualVstPathInput.trim();
          if (!nextPath) {
            setWorkbenchError('Enter a VST3 path before loading it.');
            setWorkbenchStatus('Plugin load failed.');
            return;
          }
          setVstPluginPathDialogMode(null);
          void loadDeckPlugin(nextPath);
        }}
      />

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
