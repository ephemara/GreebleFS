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
  exportExplorerAudioTransform,
  type ExplorerAudioDeckId,
  type ExplorerAudioPreviewAnalysis,
} from '../runtime/audioWorkbenchBackend';
import {
  armAudioDeck,
  getAudioDeckState,
  loadSelectionIntoAudioDeck,
  pauseAudioDeck,
  playAudioDeck,
  seekAudioDeck,
  setAudioDeckGain,
  setAudioDeckLoopRegion,
  setAudioDeckRate,
  stopAudioDeck,
  syncSelectionIntoArmedAudioDeck,
  unloadAudioDeck,
  useAudioEngineFeed,
  useAudioEngineSnapshot,
  useAudioEngineStore,
} from '../store/audioEngineStore';
import { AppConfirmDialog, AppPromptDialog } from './AppModal';

type ExplorerAudioWorkbenchProps = {
  audioPath: string;
  audioName: string;
  audioExtension: string;
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
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 'n/a';
  }
  return `${(20 * Math.log10(value)).toFixed(1)} dB`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
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
    borderRadius: 14,
    border: '1px solid var(--overlay-explorer-chip-border)',
    background: 'rgba(255,255,255,0.04)',
    padding: '10px 12px',
    display: 'grid',
    gap: 4,
  };
}

function meterFillStyle(value: number, color: string): CSSProperties {
  const percent = clamp(value * 100, 0, 100);
  return {
    width: `${percent}%`,
    height: '100%',
    borderRadius: 999,
    background: color,
    boxShadow: `0 0 16px ${color}`,
  };
}

function deckLabel(deckId: ExplorerAudioDeckId): string {
  return deckId === 'a' ? 'Deck A' : 'Deck B';
}

function deckCardStyle(isArmed: boolean, isPreviewDeck: boolean): CSSProperties {
  return {
    borderRadius: 16,
    border: `1px solid ${isArmed ? 'rgba(100, 185, 255, 0.55)' : 'var(--overlay-explorer-chip-border)'}`,
    background: isPreviewDeck
      ? 'linear-gradient(180deg, rgba(18, 34, 54, 0.62), rgba(9, 16, 28, 0.84))'
      : 'rgba(255,255,255,0.04)',
    padding: 14,
    display: 'grid',
    gap: 12,
    boxShadow: isArmed ? '0 20px 40px rgba(28, 84, 140, 0.18)' : 'none',
    minHeight: 0,
  };
}

export function ExplorerAudioWorkbench({
  audioPath,
  audioName,
  audioExtension,
  audioSize,
  onExported,
}: ExplorerAudioWorkbenchProps) {
  useAudioEngineFeed();

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const snapshot = useAudioEngineSnapshot();

  const [analysis, setAnalysis] = useState<ExplorerAudioPreviewAnalysis | null>(null);
  const [previewDeckId, setPreviewDeckId] = useState<ExplorerAudioDeckId>('a');
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [fadeInSeconds, setFadeInSeconds] = useState(0);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(0);
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
  const [showDeckB, setShowDeckB] = useState(false);

  const previewDeck = getAudioDeckState(snapshot, previewDeckId);
  const effectiveDuration = Math.max(
    analysis?.durationSeconds ?? 0,
    previewDeck.durationSeconds ?? 0,
  );
  const selectionDuration = Math.max(0, selectionEnd - selectionStart);
  const selectionLeft =
    effectiveDuration > 0 ? `${(selectionStart / effectiveDuration) * 100}%` : '0%';
  const selectionWidth =
    effectiveDuration > 0 ? `${(selectionDuration / effectiveDuration) * 100}%` : '0%';
  const playheadLeft =
    effectiveDuration > 0
      ? `${(previewDeck.currentTimeSeconds / effectiveDuration) * 100}%`
      : '0%';

  useEffect(() => {
    let cancelled = false;
    const targetDeckId = useAudioEngineStore.getState().snapshot.armedDeck;

    setPreviewDeckId(targetDeckId);
    setAnalysis(null);
    setSelectionStart(0);
    setSelectionEnd(0);
    setFadeInSeconds(0);
    setFadeOutSeconds(0);
    setGenerateSpectrogram(true);
    setConvertFormat(DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID);
    setExportDialogMode(null);
    setExportPathInput(
      buildAudioOutputPath(audioPath, 'clip', DEFAULT_EXPLORER_AUDIO_EXPORT_FORMAT_ID),
    );
    setExportState('idle');
    setExportMessage('Rust owns transport. SoX stays in the offline export lane.');
    setWorkbenchStatus(`Loading ${deckLabel(targetDeckId)} with the current explorer selection…`);
    setWorkbenchError(null);
    setIsAnalyzing(true);
    setSpectrogramSource(null);

    void (async () => {
      try {
        const [nextAnalysis] = await Promise.all([
          analyzeExplorerAudioPreview(audioPath),
          syncSelectionIntoArmedAudioDeck(audioPath),
        ]);
        if (cancelled) {
          return;
        }
        setAnalysis(nextAnalysis);
        setSelectionStart(0);
        setSelectionEnd(nextAnalysis.durationSeconds);
        setWorkbenchStatus(
          `${deckLabel(targetDeckId)} is loaded in the native engine. Playback is running through Rust, not the webview.`,
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
  }, [audioPath]);

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

  const waveformBuckets = analysis?.waveformBuckets ?? [];
  const spectralBands = analysis?.spectralBands ?? [];

  const analysisCards = useMemo(
    () => [
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
      { label: 'Peak', value: formatDb(analysis?.peakLevel) },
      { label: 'RMS', value: formatDb(analysis?.rmsLevel) },
      {
        label: 'Headroom',
        value:
          analysis?.headroomDb != null && Number.isFinite(analysis.headroomDb)
            ? `${analysis.headroomDb.toFixed(1)} dB`
            : 'n/a',
      },
      { label: 'File Size', value: formatSize(audioSize) },
    ],
    [analysis, audioSize, effectiveDuration, snapshot.outputSampleRateHz],
  );

  function syncPlayhead(nextTime: number) {
    if (effectiveDuration <= 0) {
      return;
    }
    const bounded = clamp(nextTime, 0, effectiveDuration);
    void seekAudioDeck(previewDeckId, bounded).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Seek command failed.');
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
    void setAudioDeckLoopRegion(previewDeckId, boundedStart, finalEnd, true).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Loop region update failed.');
    });
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
        await pauseAudioDeck(previewDeckId);
        setWorkbenchError(null);
        setWorkbenchStatus(`${deckLabel(previewDeckId)} paused.`);
        return;
      }
      if (
        selectionEnd > selectionStart &&
        previewDeck.currentTimeSeconds >= selectionEnd
      ) {
        await seekAudioDeck(previewDeckId, selectionStart);
      }
      await playAudioDeck(previewDeckId);
      setWorkbenchError(null);
      setWorkbenchStatus(`${deckLabel(previewDeckId)} playing from the native engine.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Playback command failed.');
    }
  }

  async function clearLoopRegion() {
    if (effectiveDuration <= 0) {
      return;
    }
    setSelectionStart(0);
    setSelectionEnd(effectiveDuration);
    try {
      await setAudioDeckLoopRegion(previewDeckId, 0, effectiveDuration, false);
      setWorkbenchError(null);
      setWorkbenchStatus(`Loop region cleared on ${deckLabel(previewDeckId)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Loop clear failed.');
    }
  }

  async function handleDeckTransport(deckId: ExplorerAudioDeckId, action: 'play' | 'pause' | 'stop') {
    try {
      if (action === 'play') {
        await playAudioDeck(deckId);
      } else if (action === 'pause') {
        await pauseAudioDeck(deckId);
      } else {
        await stopAudioDeck(deckId);
      }
      setWorkbenchError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus(`${deckLabel(deckId)} ${action} failed.`);
    }
  }

  async function handleArmDeck(deckId: ExplorerAudioDeckId) {
    try {
      await armAudioDeck(deckId);
      setWorkbenchError(null);
      setWorkbenchStatus(`${deckLabel(deckId)} is now armed for explorer selection sync.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Armed deck update failed.');
    }
  }

  async function handleLoadSelection(deckId: ExplorerAudioDeckId) {
    try {
      setPreviewDeckId(deckId);
      await loadSelectionIntoAudioDeck(deckId, audioPath);
      setWorkbenchError(null);
      setWorkbenchStatus(`${audioName} loaded into ${deckLabel(deckId)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Deck load failed.');
    }
  }

  async function handleUnloadDeck(deckId: ExplorerAudioDeckId) {
    try {
      await unloadAudioDeck(deckId);
      setWorkbenchError(null);
      setWorkbenchStatus(`${deckLabel(deckId)} was cleared.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Deck clear failed.');
    }
  }

  async function handleDeckGainChange(deckId: ExplorerAudioDeckId, value: number) {
    try {
      await setAudioDeckGain(deckId, value);
      setWorkbenchError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Gain update failed.');
    }
  }

  async function handleDeckRateChange(deckId: ExplorerAudioDeckId, value: number) {
    try {
      await setAudioDeckRate(deckId, value);
      setWorkbenchError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkbenchError(message);
      setWorkbenchStatus('Rate update failed.');
    }
  }

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
        fadeInSeconds,
        fadeOutSeconds,
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
        fadeInSeconds,
        fadeOutSeconds,
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

  function renderDeckCard(deckId: ExplorerAudioDeckId) {
    const deck = getAudioDeckState(snapshot, deckId);
    const isArmed = snapshot.armedDeck === deckId;
    const isPreviewDeck = previewDeckId === deckId;
    return (
      <div key={deckId} style={deckCardStyle(isArmed, isPreviewDeck)}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <AudioLines size={15} />
              {deckLabel(deckId)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
              {deck.loadedName ?? 'No clip loaded'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isArmed ? <span style={badgeStyle}>Armed</span> : null}
            {!isArmed && deck.loadedPath ? <span style={badgeStyle}>Pinned</span> : null}
            {isPreviewDeck ? <span style={badgeStyle}>Preview</span> : null}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, max-content))',
            gap: 8,
          }}
        >
          <button type="button" style={toolbarButtonStyle()} onClick={() => void handleArmDeck(deckId)}>
            Arm
          </button>
          <button type="button" style={toolbarButtonStyle()} onClick={() => void handleLoadSelection(deckId)}>
            Load Selection
          </button>
          <button
            type="button"
            style={toolbarButtonStyle('primary')}
            onClick={() => void handleDeckTransport(deckId, deck.isPlaying ? 'pause' : 'play')}
          >
            {deck.isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {deck.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" style={toolbarButtonStyle()} onClick={() => void handleDeckTransport(deckId, 'stop')}>
            Stop
          </button>
          <button type="button" style={toolbarButtonStyle('danger')} onClick={() => void handleUnloadDeck(deckId)}>
            Clear
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--overlay-text-muted)',
              }}
            >
              <span>Position</span>
              <span>
                {formatDuration(deck.currentTimeSeconds)} / {formatDuration(deck.durationSeconds)}
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width:
                    deck.durationSeconds > 0
                      ? `${(deck.currentTimeSeconds / deck.durationSeconds) * 100}%`
                      : '0%',
                  height: '100%',
                  borderRadius: 999,
                  background:
                    'linear-gradient(90deg, rgba(91, 183, 255, 0.88), rgba(141, 226, 255, 0.92))',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--overlay-text-muted)',
              }}
            >
              <span>Peak / RMS</span>
              <span>
                {formatDb(deck.peakMeterLinear)} / {formatDb(deck.rmsMeterLinear)}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 5 }}>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                }}
              >
                <div style={meterFillStyle(deck.peakMeterLinear, 'rgba(105, 199, 255, 0.92)')} />
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                }}
              >
                <div style={meterFillStyle(deck.rmsMeterLinear, 'rgba(124, 255, 179, 0.88)')} />
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
              Gain
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={deck.gainLinear}
                onChange={(event) => void handleDeckGainChange(deckId, Number(event.target.value))}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 11, color: 'var(--overlay-text-muted)' }}>
              Rate
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.01"
                value={deck.rate}
                onChange={(event) => void handleDeckRateChange(deckId, Number(event.target.value))}
              />
            </label>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8,
            }}
          >
            <div style={metricCardStyle()}>
              <div style={miniLabelStyle}>Loop In</div>
              <div style={miniValueStyle}>{formatDuration(deck.loopRegion.startSeconds)}</div>
            </div>
            <div style={metricCardStyle()}>
              <div style={miniLabelStyle}>Loop Out</div>
              <div style={miniValueStyle}>
                {formatDuration(deck.loopRegion.enabled ? deck.loopRegion.endSeconds : deck.durationSeconds)}
              </div>
            </div>
          </div>

          {deck.error ? (
            <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--overlay-danger-text, #ff8f8f)' }}>
              {deck.error}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const engineStatusBadges = [
    snapshot.ready ? 'Native Engine Ready' : 'Engine Starting',
    isAnalyzing ? 'Analyzing' : null,
    previewDeck.isLoading ? `${deckLabel(previewDeckId)} Loading` : null,
    previewDeck.isPlaying ? `${deckLabel(previewDeckId)} Playing` : null,
    snapshot.outputSampleRateHz ? `${snapshot.outputSampleRateHz.toLocaleString()} Hz Output` : null,
  ].filter(Boolean) as string[];

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
        <div
          style={{
            minHeight: 0,
            padding: 16,
            display: 'grid',
            gap: 14,
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'grid', gap: 12, minHeight: 0 }}>
            <div
              style={{
                minHeight: 220,
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
                  flexWrap: 'wrap',
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
                    onClick={() => syncPlayhead(selectionStart)}
                  >
                    <RotateCcw size={14} />
                    Jump To In
                  </button>
                  <button
                    type="button"
                    style={toolbarButtonStyle()}
                    onClick={() => setShowDeckB((current) => !current)}
                  >
                    {showDeckB ? 'Hide Deck B' : 'Deck B'}
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
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: 12,
                }}
              >
                {renderDeckCard('a')}
                {showDeckB ? (
                  renderDeckCard('b')
                ) : (
                  <div
                    style={{
                      borderRadius: 14,
                      border: '1px dashed rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.025)',
                      padding: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>Deck B</div>
                      <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                        Optional reference deck. Keep it hidden unless you need a second loaded clip.
                      </div>
                    </div>
                    <button
                      type="button"
                      style={toolbarButtonStyle()}
                      onClick={() => setShowDeckB(true)}
                    >
                      Open Deck B
                    </button>
                  </div>
                )}
              </div>

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
                  {waveformBuckets.length > 0 ? (
                    waveformBuckets.map((bucket) => (
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
                    ))
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: '100%',
                        color: 'var(--overlay-text-muted)',
                        fontSize: 12,
                      }}
                    >
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

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  <div style={metricCardStyle()}>
                    <div style={miniLabelStyle}>Playhead</div>
                    <div style={miniValueStyle}>
                      {formatDuration(previewDeck.currentTimeSeconds)}
                    </div>
                  </div>
                  <div style={metricCardStyle()}>
                    <div style={miniLabelStyle}>Selection In</div>
                    <div style={miniValueStyle}>{formatDuration(selectionStart)}</div>
                  </div>
                  <div style={metricCardStyle()}>
                    <div style={miniLabelStyle}>Selection Out</div>
                    <div style={miniValueStyle}>{formatDuration(selectionEnd)}</div>
                  </div>
                  <div style={metricCardStyle()}>
                    <div style={miniLabelStyle}>Selection Length</div>
                    <div style={miniValueStyle}>{formatDuration(selectionDuration)}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  {analysisCards.map((card) => (
                    <div key={card.label} style={metricCardStyle()}>
                      <div style={miniLabelStyle}>{card.label}</div>
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
                gridTemplateColumns: 'minmax(0, 1fr)',
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
                    Fade In (s)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={fadeInSeconds}
                      onChange={(event) => setFadeInSeconds(Number(event.target.value) || 0)}
                      style={inputStyle}
                    />
                  </label>
                  <label
                    style={{
                      display: 'grid',
                      gap: 6,
                      fontSize: 11,
                      color: 'var(--overlay-text-muted)',
                    }}
                  >
                    Fade Out (s)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={fadeOutSeconds}
                      onChange={(event) => setFadeOutSeconds(Number(event.target.value) || 0)}
                      style={inputStyle}
                    />
                  </label>
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {engineStatusBadges.map((badge) => (
                    <span key={badge} style={badgeStyle}>
                      {badge}
                    </span>
                  ))}
                </div>

                {spectralBands.length > 0 ? (
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
                ) : null}

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
            ? `SoX will write a ${convertFormat.toUpperCase()} export using the current trim, fade, and spectrogram settings.`
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
        description={`This will rewrite ${audioName} in place using the current trim, fade, normalize, and spectrogram settings.`}
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

const miniValueStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
};
