/**
 * ExplorerVideoEditor — shell-owned video preview/editor for the GreebleFS preview pane.
 *
 * Playback still rides a browser `<video>` element, but source resolution and preview-proxy
 * generation go through the typed Rust backend so the shell can fall back to a safer proxy when
 * the current desktop webview cannot decode the original file directly.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  AudioWaveform,
  Clapperboard,
  Download,
  Film,
  Maximize2,
  Music,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  Sliders,
  Volume2,
  VolumeX,
  Loader2,
} from '@/components/AppIcons';
import {
  createExplorerVideoPreviewProxy,
  EXPLORER_VIDEO_PREVIEW_MAX_BYTES,
  readExplorerVideoPreviewBytes,
  resolveExplorerVideoPreviewSource,
  type ExplorerVideoPreviewSource,
} from '../runtime/videoEditorBackend';
import {
  applyExplorerImageStageWheelZoom,
  DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM,
  EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_COLOR,
  EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_IMAGE,
  EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_POSITION,
  EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_SIZE,
  normalizeExplorerImageStageTransform,
  type ExplorerImageStageTransform,
} from './explorer/explorerImageStage';
import { PremiumSlider } from './PremiumSlider';

// ─── Types ────────────────────────────────────────────────────────────────────

type InspectorTab = 'transform' | 'color' | 'audio';
type VideoPreviewTransform = ExplorerImageStageTransform;

interface VideoTransform {
  scaleX: number; // %
  scaleY: number; // %
  posX: number;   // px
  posY: number;   // px
  cropLeft: number;   // %
  cropRight: number;
  cropTop: number;
  cropBottom: number;
}

interface VideoColor {
  brightness: number; // 0–200, default 100
  contrast: number;   // 0–200, default 100
  saturation: number; // 0–300, default 100
  hue: number;        // -180–180
  sepia: number;      // 0–100
}

const DEFAULT_TRANSFORM: VideoTransform = {
  scaleX: 100,
  scaleY: 100,
  posX: 0,
  posY: 0,
  cropLeft: 0,
  cropRight: 0,
  cropTop: 0,
  cropBottom: 0,
};

const DEFAULT_COLOR: VideoColor = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  sepia: 0,
};

// ─── Props ────────────────────────────────────────────────────────────────────

type ExplorerVideoEditorProps = {
  videoPath: string;
  videoName: string;
  videoSource: string;
  videoExtension: string;
  videoMimeType: string | null;
  videoSize: number;
  mode?: 'preview' | 'edit';
  onExported?: (outputPath: string) => Promise<void> | void;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function formatTimecode(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '00:00:00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const f = Math.floor((secs % 1) * 30);
  return [h, m, s, f].map((n) => n.toString().padStart(2, '0')).join(':');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function describeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown playback transport failure.';
}

/** Convert AudioBuffer → WAV Blob without any server or ffmpeg dependency */
function audioBufferToWav(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels;
  const length = buf.length * numCh * 2 + 44;
  const ab = new ArrayBuffer(length);
  const view = new DataView(ab);
  const channels: Float32Array[] = [];
  let pos = 0;

  const u16 = (d: number) => { view.setUint16(pos, d, true); pos += 2; };
  const u32 = (d: number) => { view.setUint32(pos, d, true); pos += 4; };

  u32(0x46464952); u32(length - 8); u32(0x45564157);
  u32(0x20746d66); u32(16);
  u16(1); u16(numCh);
  u32(buf.sampleRate);
  u32(buf.sampleRate * 2 * numCh);
  u16(numCh * 2); u16(16);
  u32(0x61746164); u32(length - pos - 4);

  for (let i = 0; i < numCh; i++) channels.push(buf.getChannelData(i));

  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < numCh; i++) {
      const s = clamp(channels[i]![offset]!, -1, 1);
      const int = (s < 0 ? s * 32768 : s * 32767) | 0;
      view.setInt16(pos, int, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// ─── Sub-component: control slider ───────────────────────────────────────────

interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  reset: number;
  onChange: (v: number) => void;
}

function ControlSlider({ label, value, min, max, reset, onChange }: ControlSliderProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => { setLocal(value); }, [value]);

  const handleNumChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value) || 0;
    setLocal(v);
    onChange(v);
  }, [onChange]);

  const handleReset = useCallback(() => {
    setLocal(reset);
    onChange(reset);
  }, [reset, onChange]);

  return (
    <div style={{ marginBottom: 10, userSelect: 'none' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <span
          title="Double-click to reset"
          onDoubleClick={handleReset}
          style={{
            fontSize: 10,
            color: 'var(--overlay-text-muted)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <input
          type="number"
          value={local.toFixed(1)}
          onChange={handleNumChange}
          style={{
            width: 52,
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 5,
            color: 'var(--overlay-text-primary)',
            fontSize: 10,
            padding: '2px 4px',
            textAlign: 'right',
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
      </div>
      <PremiumSlider
        ariaLabel={label}
        ariaValueText={local.toFixed(1)}
        density="compact"
        min={min}
        max={max}
        step={(max - min) / 300}
        value={local}
        onChange={(nextValue) => {
          setLocal(nextValue);
          onChange(nextValue);
        }}
        style={{
          width: '100%',
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExplorerVideoEditor({
  videoPath,
  videoName,
  videoExtension,
  videoMimeType,
  videoSize,
  mode = 'edit',
}: ExplorerVideoEditorProps) {
  const isEditMode = mode === 'edit';

  // ── Proxy resolution state ──
  const [playSrc, setPlaySrc] = useState<string | null>(null);
  const [playbackMimeType, setPlaybackMimeType] = useState<string | null>(videoMimeType);
  const [isProxying, setIsProxying] = useState(true);
  const [proxyError, setProxyError] = useState('');
  const [resolvedSourceKind, setResolvedSourceKind] =
    useState<ExplorerVideoPreviewSource['sourceKind'] | null>(null);
  const [hasAttemptedRuntimeProxyFallback, setHasAttemptedRuntimeProxyFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewStageContentRef = useRef<HTMLDivElement | null>(null);
  const playbackObjectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);
  const loadGenerationRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaybackReady, setIsPlaybackReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // ── Trim state ──
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [loopTrim, setLoopTrim] = useState(true);

  // ── Inspector state ──
  const [activeTab, setActiveTab] = useState<InspectorTab>('transform');
  const [transform, setTransform] = useState<VideoTransform>(DEFAULT_TRANSFORM);
  const [color, setColor] = useState<VideoColor>(DEFAULT_COLOR);
  const [previewTransform, setPreviewTransform] = useState<VideoPreviewTransform>(
    DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM,
  );
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [audioExtractMsg, setAudioExtractMsg] = useState('');
  const revokePlaybackObjectUrl = useCallback(() => {
    const currentPlaybackObjectUrl = playbackObjectUrlRef.current;
    if (currentPlaybackObjectUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(currentPlaybackObjectUrl);
    }
    playbackObjectUrlRef.current = null;
  }, []);

  const resetPreviewViewport = useCallback(() => {
    setPreviewTransform(DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM);
    setIsPreviewDragging(false);
  }, []);

  const applyResolvedPreviewSource = useCallback(
    async (
      resolvedSource: ExplorerVideoPreviewSource,
      allowProxyFallback = true,
    ) => {
      const loadGeneration = loadGenerationRef.current;
      setResolvedSourceKind(resolvedSource.sourceKind);
      setPlaybackMimeType(resolvedSource.mimeType ?? videoMimeType);
      setPlaySrc(null);
      setProxyError('');
      setIsProxying(true);
      setIsPlaybackReady(false);
      setIsPlaying(false);
      revokePlaybackObjectUrl();

      try {
        const previewBytes = await readExplorerVideoPreviewBytes(
          resolvedSource.sourcePath,
          EXPLORER_VIDEO_PREVIEW_MAX_BYTES,
        );
        if (loadGenerationRef.current !== loadGeneration) {
          return;
        }

        const playbackObjectUrl = URL.createObjectURL(
          new Blob([previewBytes], {
            type: resolvedSource.mimeType ?? videoMimeType ?? 'application/octet-stream',
          }),
        );

        if (loadGenerationRef.current !== loadGeneration) {
          URL.revokeObjectURL(playbackObjectUrl);
          return;
        }

        playbackObjectUrlRef.current = playbackObjectUrl;
        setPlaySrc(playbackObjectUrl);
      } catch (error) {
        if (loadGenerationRef.current !== loadGeneration) {
          return;
        }

        const errorMessage = describeErrorMessage(error);
        console.error('[VideoEditor] Native playback transport failed', {
          resolvedSource,
          error,
        });

        if (resolvedSource.sourceKind === 'direct' && allowProxyFallback) {
          setHasAttemptedRuntimeProxyFallback(true);
          try {
            const proxySource = await createExplorerVideoPreviewProxy(videoPath);
            if (loadGenerationRef.current !== loadGeneration) {
              return;
            }
            await applyResolvedPreviewSource(proxySource, false);
            return;
          } catch (proxyFallbackError) {
            if (loadGenerationRef.current !== loadGeneration) {
              return;
            }
            console.error('[VideoEditor] preview proxy fallback failed', proxyFallbackError);
            setProxyError(
              `Preview proxy generation failed after native video transport failed. ${describeErrorMessage(proxyFallbackError)}`,
            );
            return;
          }
        }

        setProxyError(
          resolvedSource.sourceKind === 'proxy'
            ? `Native preview proxy transport failed before playback could begin. ${errorMessage}`
            : `Native video transport failed before playback could begin. ${errorMessage}`,
        );
      } finally {
        if (loadGenerationRef.current === loadGeneration) {
          setIsProxying(false);
        }
      }
    },
    [revokePlaybackObjectUrl, videoMimeType, videoPath],
  );

  // Reset on file change and resolve source
  useEffect(() => {
    let isMounted = true;
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;
    revokePlaybackObjectUrl();
    setPlaySrc(null);
    setPlaybackMimeType(videoMimeType);
    setIsProxying(true);
    setProxyError('');
    setResolvedSourceKind(null);
    setHasAttemptedRuntimeProxyFallback(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaybackReady(false);
    setTrimStart(0);
    setTrimEnd(0);
    setTransform(DEFAULT_TRANSFORM);
    setColor(DEFAULT_COLOR);
    resetPreviewViewport();
    setAudioExtractMsg('');
    cancelAnimationFrame(rafRef.current);

    (async () => {
      try {
        const resolvedSource = await resolveExplorerVideoPreviewSource(videoPath);
        if (isMounted && loadGenerationRef.current === loadGeneration) {
          await applyResolvedPreviewSource(resolvedSource);
        }
      } catch (err: any) {
        if (isMounted && loadGenerationRef.current === loadGeneration) {
          console.warn(
            '[VideoEditor] Backend resolve failed, falling back to native byte transport:',
            err,
          );
          await applyResolvedPreviewSource(
            {
              sourcePath: videoPath,
              sourceKind: 'direct',
              mimeType: videoMimeType,
              generatedFromPath: null,
            },
            true,
          );
        }
      }
    })();

    return () => {
      isMounted = false;
      revokePlaybackObjectUrl();
    };
  }, [
    applyResolvedPreviewSource,
    resetPreviewViewport,
    revokePlaybackObjectUrl,
    videoMimeType,
    videoPath,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playSrc) {
      return;
    }
    setIsPlaybackReady(false);
    video.load();
  }, [playSrc, playbackMimeType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.volume = volume;
  }, [volume]);

  const attemptRuntimeProxyFallback = useCallback(async () => {
    if (hasAttemptedRuntimeProxyFallback) {
      setProxyError('This desktop webview could not play the generated native preview proxy either.');
      return;
    }

    const loadGeneration = loadGenerationRef.current;
    setHasAttemptedRuntimeProxyFallback(true);
    setIsProxying(true);
    setProxyError('');
    setIsPlaying(false);

    try {
      const proxySource = await createExplorerVideoPreviewProxy(videoPath);
      if (loadGenerationRef.current !== loadGeneration) {
        return;
      }
      await applyResolvedPreviewSource(proxySource, false);
    } catch (error) {
      if (loadGenerationRef.current !== loadGeneration) {
        return;
      }
      console.error('[VideoEditor] preview proxy fallback failed', error);
      setProxyError('Preview proxy generation failed for this file.');
    } finally {
      if (loadGenerationRef.current === loadGeneration) {
        setIsProxying(false);
      }
    }
  }, [applyResolvedPreviewSource, hasAttemptedRuntimeProxyFallback, videoPath]);

  useEffect(() => () => {
    revokePlaybackObjectUrl();
  }, [revokePlaybackObjectUrl]);

  // RAF loop for smooth playhead update while playing
  const tickPlayhead = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const t = vid.currentTime;
    setCurrentTime(t);
    if (loopTrim && trimEnd > 0 && t >= trimEnd) {
      vid.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [loopTrim, trimEnd, trimStart]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !isEditMode) return;
    if (isPlaying) {
      const p = vid.play();
      if (p) {
        p.catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('[VideoEditor] play() failed', err);
            setIsPlaying(false);
          }
        });
      }
      rafRef.current = requestAnimationFrame(tickPlayhead);
    } else {
      vid.pause();
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isEditMode, isPlaying, tickPlayhead]);

  const handleLoadedMetadata = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const nextDuration =
      Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;
    setIsPlaybackReady(true);
    setDuration(nextDuration);
    setTrimEnd((prev) =>
      nextDuration > 0 ? (prev > 0 ? Math.min(prev, nextDuration) : nextDuration) : prev,
    );
  }, []);

  // ── Transport controls ──
  const togglePlay = useCallback(() => {
    if (!isPlaybackReady || duration <= 0) return;
    setIsPlaying((prev) => !prev);
  }, [duration, isPlaybackReady]);

  const stepFrame = useCallback((frames: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = clamp(vid.currentTime + frames * (1 / 30), 0, duration);
    setCurrentTime(vid.currentTime);
  }, [duration]);

  const seekTo = useCallback((t: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    const bounded = clamp(t, 0, duration);
    vid.currentTime = bounded;
    setCurrentTime(bounded);
  }, [duration]);

  // ── Timeline drag helpers ──
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(duration);

  useEffect(() => { trimStartRef.current = trimStart; }, [trimStart]);
  useEffect(() => { trimEndRef.current = trimEnd <= 0 ? duration : trimEnd; }, [trimEnd, duration]);

  const clientXToTime = useCallback((clientX: number): number => {
    const el = timelineRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
  }, [duration]);

  type DragTarget = 'playhead' | 'trimStart' | 'trimEnd';

  const beginDrag = useCallback((target: DragTarget, startX: number) => {
    const move = (e: MouseEvent) => {
      const t = clientXToTime(e.clientX);
      if (target === 'playhead') {
        seekTo(t);
      } else if (target === 'trimStart') {
        const newStart = clamp(t, 0, trimEndRef.current - 0.1);
        setTrimStart(newStart);
        seekTo(newStart);
      } else {
        const newEnd = clamp(t, trimStartRef.current + 0.1, duration);
        setTrimEnd(newEnd);
        seekTo(newEnd);
      }
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    move({ clientX: startX } as MouseEvent);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [clientXToTime, duration, seekTo]);

  // ── Viewer: stage zoom + edit transform drag ──
  const handlePreviewWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!playSrc) {
      return;
    }

    const viewport = previewViewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setPreviewTransform((current) => {
      return applyExplorerImageStageWheelZoom({
        currentTransform: current,
        viewport,
        content: previewStageContentRef.current,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
    });
  }, [playSrc]);

  const handlePreviewMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (
      !playSrc ||
      isEditMode ||
      event.button !== 0 ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    const viewport = previewViewportRef.current;
    if (!viewport) {
      return;
    }

    event.preventDefault();

    const startTransform = previewTransform;
    const startClientX = event.clientX;
    const startClientY = event.clientY;

    setIsPreviewDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPreviewTransform(
        normalizeExplorerImageStageTransform(
          {
            scale: startTransform.scale,
            offsetX: startTransform.offsetX + (moveEvent.clientX - startClientX),
            offsetY: startTransform.offsetY + (moveEvent.clientY - startClientY),
          },
          viewport,
          previewStageContentRef.current,
        ),
      );
    };

    const stopDragging = () => {
      setIsPreviewDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('blur', stopDragging);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('blur', stopDragging);
  }, [isEditMode, playSrc, previewTransform]);

  const handleVideoTransformMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) {
      return;
    }
    if ((e.target as HTMLElement).closest('.vt-handle')) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const sp = { ...transform };
    const move = (me: MouseEvent) => {
      setTransform((prev) => ({ ...prev, posX: sp.posX + (me.clientX - sx), posY: sp.posY + (me.clientY - sy) }));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [isEditMode, transform]);

  // ── Audio extraction ──
  const extractAudio = useCallback(async () => {
    if (!playSrc) {
      setAudioExtractMsg('Playback source is not ready yet.');
      return;
    }
    setIsExtractingAudio(true);
    setAudioExtractMsg('Decoding via WebAudio…');
    try {
      const resp = await fetch(playSrc);
      const arrayBuf = await resp.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const wav = audioBufferToWav(audioBuf);
      const url = URL.createObjectURL(wav);
      const a = document.createElement('a');
      a.href = url;
      const stem = videoName.replace(/\.[^.]+$/, '');
      a.download = `${stem}_audio.wav`;
      a.click();
      URL.revokeObjectURL(url);
      setAudioExtractMsg(`Extracted: ${stem}_audio.wav`);
    } catch (err) {
      console.error('[VideoEditor] audio extract failed', err);
      setAudioExtractMsg('Extraction failed. File may be unsupported or inaccessible.');
    } finally {
      setIsExtractingAudio(false);
    }
  }, [playSrc, videoName]);

  // ── Computed style values ──
  const videoFilter = useMemo(() => (
    `brightness(${color.brightness}%) contrast(${color.contrast}%) saturate(${color.saturation}%) hue-rotate(${color.hue}deg) sepia(${color.sepia}%)`
  ), [color]);

  const videoClipPath = useMemo(() => (
    `inset(${transform.cropTop}% ${transform.cropRight}% ${transform.cropBottom}% ${transform.cropLeft}%)`
  ), [transform]);

  const wrapperTransform = useMemo(() => (
    `translate(${transform.posX}px, ${transform.posY}px) scale(${transform.scaleX / 100}, ${transform.scaleY / 100})`
  ), [transform]);
  const previewStageTransform = useMemo(
    () =>
      `translate(${previewTransform.offsetX}px, ${previewTransform.offsetY}px) scale(${previewTransform.scale})`,
    [previewTransform],
  );
  const previewZoomPercent = Math.round(previewTransform.scale * 100);

  const selectionLeft = duration > 0 ? `${(trimStart / duration) * 100}%` : '0%';
  const selectionWidth = duration > 0 ? `${((trimEnd - trimStart) / duration) * 100}%` : '0%';
  const playheadLeft = duration > 0 ? `${(currentTime / duration) * 100}%` : '0%';
  const selectionDuration = Math.max(0, trimEnd - trimStart);

  // ── Prop helpers ──
  const setTransformProp = useCallback(<K extends keyof VideoTransform>(k: K, v: number) => {
    setTransform((prev) => ({ ...prev, [k]: v }));
  }, []);

  const setColorProp = useCallback(<K extends keyof VideoColor>(k: K, v: number) => {
    setColor((prev) => ({ ...prev, [k]: v }));
  }, []);

  const resetTransform = useCallback(() => setTransform(DEFAULT_TRANSFORM), []);
  const resetColor = useCallback(() => setColor(DEFAULT_COLOR), []);

  // ── Layout CSS vars ──
  const root: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: isEditMode ? '1fr 220px' : '1fr',
    gridTemplateRows: 'minmax(0,1fr)',
    background: 'var(--overlay-explorer-preview-bg)',
    overflow: 'hidden',
    fontFamily: 'var(--overlay-font-family, system-ui)',
    color: 'var(--overlay-text-primary)',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={root}>

      {/* ── LEFT: viewer + timeline ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 1, gridRow: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Viewer */}
        <div
          ref={previewViewportRef}
          onWheel={handlePreviewWheel}
          onMouseDown={
            isEditMode ? handleVideoTransformMouseDown : handlePreviewMouseDown
          }
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: 'var(--overlay-explorer-preview-bg, #111827)',
            backgroundImage:
              EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_IMAGE,
            backgroundSize:
              EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_SIZE,
            backgroundPosition:
              EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_POSITION,
            backgroundColor:
              EXPLORER_PREVIEW_STAGE_CHECKERBOARD_BACKGROUND_COLOR,
            cursor: isEditMode
              ? 'grab'
              : isPreviewDragging
                ? 'grabbing'
                : previewTransform.scale > 1
                  ? 'grab'
                  : 'default',
          }}
        >
          <div
            ref={previewStageContentRef}
            style={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              transform: previewStageTransform,
              transformOrigin: 'center center',
              transition: isPreviewDragging ? undefined : 'transform 120ms ease-out',
            }}
          >
            <div
              style={{
                position: 'relative',
                maxWidth: '100%',
                maxHeight: '100%',
                transform: wrapperTransform,
                transformOrigin: 'center',
              }}
            >
              <video
                ref={videoRef}
                preload="metadata"
                playsInline
                controls={!isEditMode}
                muted={isMuted}
                aria-label={`Video preview: ${videoName}`}
                onError={() => {
                  if (!playSrc) {
                    return;
                  }
                  if (resolvedSourceKind === 'direct' && !hasAttemptedRuntimeProxyFallback) {
                    void attemptRuntimeProxyFallback();
                    return;
                  }
                  setProxyError(
                    resolvedSourceKind === 'proxy'
                      ? 'Video playback failed after loading the native preview proxy in this desktop webview.'
                      : 'Video playback failed in this desktop webview.',
                  );
                  setIsPlaybackReady(false);
                }}
                onCanPlay={() => setIsPlaybackReady(true)}
                onLoadedMetadata={handleLoadedMetadata}
                onDurationChange={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => {
                  const vid = videoRef.current;
                  if (!vid) {
                    return;
                  }
                  setCurrentTime(vid.currentTime);
                }}
                onVolumeChange={() => {
                  const vid = videoRef.current;
                  if (!vid) {
                    return;
                  }
                  setVolume(vid.volume);
                  setIsMuted(vid.muted || vid.volume === 0);
                }}
                onEnded={() => {
                  if (isEditMode && loopTrim) {
                    seekTo(trimStart);
                  } else {
                    setIsPlaying(false);
                  }
                }}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  filter: videoFilter,
                  clipPath: videoClipPath,
                }}
              >
                {playSrc ? (
                  <source src={playSrc} type={playbackMimeType ?? undefined} />
                ) : null}
              </video>
              {/* Transform overlay border */}
              {isEditMode && activeTab === 'transform' && (
                <div
                  className="vt-handle"
                  style={{
                    position: 'absolute',
                    top: `${transform.cropTop}%`,
                    bottom: `${transform.cropBottom}%`,
                    left: `${transform.cropLeft}%`,
                    right: `${transform.cropRight}%`,
                    border: '1px solid rgba(99,179,237,0.7)',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 1px rgba(99,179,237,0.15)',
                  }}
                />
              )}
            </div>
          </div>

          {playSrc ? (
            <div
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                zIndex: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                background: 'rgba(10, 14, 24, 0.58)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
                color: 'var(--overlay-text-primary)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.03em',
                pointerEvents: 'none',
              }}
            >
              <span style={{ opacity: 0.72 }}>Preview</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {previewZoomPercent}%
              </span>
            </div>
          ) : null}

          {/* No-video overlay */}
          {(!playSrc || !isPlaybackReady || Boolean(proxyError)) && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--overlay-text-muted)',
              pointerEvents: 'none',
              background: 'rgba(0,0,0,0.4)',
              zIndex: 10,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                {isProxying ? (
                  <Loader2 className="animate-spin" size={28} style={{ opacity: 0.6 }} />
                ) : proxyError ? (
                  <Film size={28} style={{ opacity: 0.2, color: 'var(--overlay-error, #f87171)' }} />
                ) : (
                  <Film size={28} style={{ opacity: 0.4 }} />
                )}
                <span style={{ fontSize: 11, opacity: 0.7, maxWidth: 200, textAlign: 'center', lineHeight: 1.4 }}>
                  {isProxying ? 'Resolving native video...' : proxyError ? proxyError : 'Loading video…'}
                </span>
              </div>
            </div>
          )}
        </div>

        {isEditMode ? (
          <>
        {/* Transport bar */}
        <div style={{
          height: 46,
          padding: '0 12px',
          borderTop: '1px solid var(--overlay-explorer-preview-border)',
          background: 'rgba(255,255,255,0.025)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TBtn onClick={() => stepFrame(-1)} title="−1 frame"><SkipBack size={13} /></TBtn>
            <TBtn onClick={togglePlay} active title={isPlaying ? 'Pause' : 'Play'} style={{ padding: '5px 9px' }}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </TBtn>
            <TBtn onClick={() => stepFrame(1)} title="+1 frame"><SkipForward size={13} /></TBtn>
            <TBtn onClick={() => seekTo(trimStart)} title="Go to trim in"><SkipBack size={11} />In</TBtn>
            <TBtn onClick={() => seekTo(trimEnd)} title="Go to trim out">Out<SkipForward size={11} /></TBtn>
            <TBtn
              active={loopTrim}
              onClick={() => setLoopTrim((v) => !v)}
              title="Loop within trim region"
            >
              <Scissors size={11} />
              {loopTrim ? 'Loop On' : 'Loop Off'}
            </TBtn>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setIsMuted((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--overlay-text-muted)', padding: 4 }}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <PremiumSlider
              ariaLabel="Volume"
              ariaValueText={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
              density="compact"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={(v) => {
                setVolume(v);
                setIsMuted(v === 0);
                if (videoRef.current) videoRef.current.volume = v;
              }}
              style={{ width: 64 }}
            />
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--overlay-text-muted)', minWidth: 90, textAlign: 'right' }}>
              {formatTimecode(currentTime)}
              <span style={{ opacity: 0.4 }}> / {formatTimecode(duration)}</span>
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div style={{
          padding: '6px 10px 8px',
          borderTop: '1px solid var(--overlay-explorer-preview-border)',
          background: 'rgba(0,0,0,0.25)',
          flexShrink: 0,
        }}>
          {/* Timecode ticks */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--overlay-text-muted)', fontFamily: 'monospace', marginBottom: 3 }}>
            {buildTicks(duration).map((t) => (
              <span key={t}>{formatTimecode(t)}</span>
            ))}
          </div>

          {/* Main track area */}
          <div
            ref={timelineRef}
            role="slider"
            aria-label={`Playhead for ${videoName}`}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            onMouseDown={(e) => beginDrag('playhead', e.clientX)}
            style={{
              position: 'relative',
              height: 52,
              borderRadius: 8,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              overflow: 'hidden',
              cursor: 'text',
            }}
          >
            {/* Sub-tick grid */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 48px)',
            }} />

            {/* Trim selection */}
            <div style={{
              position: 'absolute',
              top: 8, bottom: 10,
              left: selectionLeft,
              width: selectionWidth,
              borderRadius: 6,
              background: 'linear-gradient(135deg, rgba(53,214,144,0.28), rgba(74,169,255,0.22))',
              border: '1px solid rgba(94,255,184,0.28)',
              pointerEvents: 'none',
            }} />

            {/* Track label: V1 */}
            <div style={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontWeight: 700, color: 'rgba(99,179,237,0.5)', pointerEvents: 'none', letterSpacing: '0.05em' }}>V1</div>

            {/* Trim start handle */}
            <div
              className="vt-handle"
              aria-label="Trim start"
              onMouseDown={(e) => { e.stopPropagation(); beginDrag('trimStart', e.clientX); }}
              style={{
                position: 'absolute',
                top: 5, bottom: 5,
                left: selectionLeft,
                width: 12,
                transform: 'translateX(-50%)',
                borderRadius: 6,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(164,255,215,0.82))',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                cursor: 'ew-resize',
                zIndex: 3,
              }}
            />

            {/* Trim end handle */}
            <div
              className="vt-handle"
              aria-label="Trim end"
              onMouseDown={(e) => { e.stopPropagation(); beginDrag('trimEnd', e.clientX); }}
              style={{
                position: 'absolute',
                top: 5, bottom: 5,
                left: `calc(${selectionLeft} + ${selectionWidth})`,
                width: 12,
                transform: 'translateX(-50%)',
                borderRadius: 6,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(164,255,215,0.82))',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                cursor: 'ew-resize',
                zIndex: 3,
              }}
            />

            {/* Playhead */}
            <div
              style={{
                position: 'absolute',
                top: 4, bottom: 4,
                left: playheadLeft,
                width: 2,
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.94)',
                boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                borderRadius: 2,
                zIndex: 4,
                pointerEvents: 'none',
              }}
            >
              <div style={{
                position: 'absolute',
                top: -2,
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: 8, height: 8,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.94)',
              }} />
            </div>
          </div>

          {/* Timecode readout row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginTop: 5 }}>
            {([
              { label: 'Current', value: formatTimecode(currentTime) },
              { label: 'In', value: formatTimecode(trimStart) },
              { label: 'Out', value: formatTimecode(trimEnd) },
              { label: 'Sel', value: formatTimecode(selectionDuration) },
            ] as const).map((item) => (
              <div key={item.label} style={{
                padding: '4px 6px',
                borderRadius: 5,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>{item.label}</div>
                <div style={{ marginTop: 1, fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* In/Out set buttons + step buttons */}
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            <TBtn onClick={() => setTrimStart(currentTime)} style={{ flex: 1 }} title="Set In to current position">Set In</TBtn>
            <TBtn onClick={() => setTrimEnd(currentTime)} style={{ flex: 1 }} title="Set Out to current position">Set Out</TBtn>
            <TBtn onClick={() => seekTo(Math.max(0, currentTime - 1))} title="−1 second">−1s</TBtn>
            <TBtn onClick={() => seekTo(Math.min(duration, currentTime + 1))} title="+1 second">+1s</TBtn>
            <TBtn onClick={resetTransform} title="Reset transform and color"><RotateCcw size={10} />Reset</TBtn>
          </div>

          {/* File meta */}
          <div style={{ marginTop: 5, fontSize: 9, color: 'var(--overlay-text-muted)', letterSpacing: '0.05em', opacity: 0.7 }}>
            {videoExtension.toUpperCase()} · {formatSize(videoSize)} · {videoName}
          </div>
        </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderTop: '1px solid var(--overlay-explorer-preview-border)',
            background: 'rgba(255,255,255,0.025)',
            flexShrink: 0,
            fontSize: 10,
          }}>
            <div style={{
              color: 'var(--overlay-text-muted)',
              letterSpacing: '0.04em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {videoExtension.toUpperCase()} · {formatSize(videoSize)} · {videoName}
            </div>
            <div style={{
              flexShrink: 0,
              color: proxyError
                ? 'var(--overlay-error, #f87171)'
                : 'var(--overlay-text-muted)',
              fontWeight: 600,
            }}>
              {isProxying
                ? 'Resolving playback source…'
                : proxyError
                  ? proxyError
                  : resolvedSourceKind === 'proxy'
                    ? 'Proxy playback (native bytes)'
                    : 'Direct playback (native bytes)'}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Inspector ── */}
      {isEditMode ? (
        <div style={{
          gridColumn: 2,
          gridRow: 1,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--overlay-explorer-preview-border)',
          background: 'rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}>
        {/* Inspector header */}
        <div style={{
          padding: '7px 10px 0',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--overlay-text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Clapperboard size={11} />
            Inspector
          </div>
          <div style={{ display: 'flex', gap: 0,  marginBottom: 0 }}>
            {([
              { id: 'transform' as InspectorTab, label: 'Video', icon: <Maximize2 size={10} /> },
              { id: 'color' as InspectorTab, label: 'Color', icon: <Sliders size={10} /> },
              { id: 'audio' as InspectorTab, label: 'Audio', icon: <Music size={10} /> },
            ]).map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === id ? '2px solid var(--overlay-accent, #63b3ed)' : '2px solid transparent',
                  color: activeTab === id ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
                  cursor: 'pointer',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 2px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  transition: 'color 0.15s',
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {/* Inspector body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>

          {activeTab === 'transform' && (
            <div>
              <InspectorSection label="Transform" icon={<Maximize2 size={11} />}>
                <ControlSlider label="Scale X" value={transform.scaleX} min={10} max={500} reset={100} onChange={(v) => setTransformProp('scaleX', v)} />
                <ControlSlider label="Scale Y" value={transform.scaleY} min={10} max={500} reset={100} onChange={(v) => setTransformProp('scaleY', v)} />
                <ControlSlider label="Position X" value={transform.posX} min={-600} max={600} reset={0} onChange={(v) => setTransformProp('posX', v)} />
                <ControlSlider label="Position Y" value={transform.posY} min={-600} max={600} reset={0} onChange={(v) => setTransformProp('posY', v)} />
              </InspectorSection>
              <InspectorDivider />
              <InspectorSection label="Crop" icon={<Scissors size={11} />}>
                <ControlSlider label="Crop Left" value={transform.cropLeft} min={0} max={100} reset={0} onChange={(v) => setTransformProp('cropLeft', v)} />
                <ControlSlider label="Crop Right" value={transform.cropRight} min={0} max={100} reset={0} onChange={(v) => setTransformProp('cropRight', v)} />
                <ControlSlider label="Crop Top" value={transform.cropTop} min={0} max={100} reset={0} onChange={(v) => setTransformProp('cropTop', v)} />
                <ControlSlider label="Crop Bottom" value={transform.cropBottom} min={0} max={100} reset={0} onChange={(v) => setTransformProp('cropBottom', v)} />
              </InspectorSection>
              <button type="button" onClick={resetTransform} style={resetBtnStyle}>
                <RotateCcw size={10} /> Reset Transform
              </button>
            </div>
          )}

          {activeTab === 'color' && (
            <div>
              <InspectorSection label="Color" icon={<Sliders size={11} />}>
                <ControlSlider label="Brightness" value={color.brightness} min={0} max={200} reset={100} onChange={(v) => setColorProp('brightness', v)} />
                <ControlSlider label="Contrast" value={color.contrast} min={0} max={200} reset={100} onChange={(v) => setColorProp('contrast', v)} />
                <ControlSlider label="Saturation" value={color.saturation} min={0} max={300} reset={100} onChange={(v) => setColorProp('saturation', v)} />
                <ControlSlider label="Hue Rotate" value={color.hue} min={-180} max={180} reset={0} onChange={(v) => setColorProp('hue', v)} />
                <ControlSlider label="Sepia" value={color.sepia} min={0} max={100} reset={0} onChange={(v) => setColorProp('sepia', v)} />
              </InspectorSection>
              <button type="button" onClick={resetColor} style={resetBtnStyle}>
                <RotateCcw size={10} /> Reset Color
              </button>
            </div>
          )}

          {activeTab === 'audio' && (
            <div>
              <InspectorSection label="Audio Mix" icon={<Volume2 size={11} />}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => setIsMuted((v) => !v)}
                    style={{
                      padding: '6px',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: isMuted ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)',
                      color: isMuted ? '#f87171' : 'var(--overlay-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
                    {isMuted ? 'Muted' : 'Playback Audio'}
                  </span>
                </div>
                <ControlSlider
                  label="Volume"
                  value={isMuted ? 0 : volume * 100}
                  min={0} max={100} reset={100}
                  onChange={(v) => {
                    const frac = v / 100;
                    setVolume(frac);
                    setIsMuted(frac === 0);
                    if (videoRef.current) videoRef.current.volume = frac;
                  }}
                />
              </InspectorSection>
              <InspectorDivider />
              <InspectorSection label="Extract Audio" icon={<AudioWaveform size={11} />}>
                <p style={{ fontSize: 10, color: 'var(--overlay-text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                  Decode audio locally via WebAudio and download as a WAV file. No server or ffmpeg needed.
                </p>
                <button
                  type="button"
                  disabled={isExtractingAudio}
                  onClick={extractAudio}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(99,179,237,0.3)',
                    background: isExtractingAudio ? 'rgba(255,255,255,0.04)' : 'rgba(99,179,237,0.1)',
                    color: isExtractingAudio ? 'var(--overlay-text-muted)' : 'rgba(147,210,255,0.9)',
                    cursor: isExtractingAudio ? 'not-allowed' : 'pointer',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    transition: 'background 0.15s',
                  }}
                >
                  <Download size={11} />
                  {isExtractingAudio ? 'Extracting…' : 'Extract Audio (.WAV)'}
                </button>
                {audioExtractMsg && (
                  <div style={{ marginTop: 6, fontSize: 9.5, color: 'var(--overlay-text-muted)', lineHeight: 1.4, wordBreak: 'break-all' }}>
                    {audioExtractMsg}
                  </div>
                )}
              </InspectorSection>
            </div>
          )}
        </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function InspectorSection({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--overlay-text-muted)', marginBottom: 8,
      }}>
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function InspectorDivider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 0' }} />;
}

const resetBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginTop: 4,
  padding: '5px 8px',
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--overlay-text-muted)',
  fontSize: 9,
  cursor: 'pointer',
  letterSpacing: '0.04em',
};

function TBtn({
  children,
  onClick,
  title,
  active,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '4px 7px',
        borderRadius: 7,
        border: `1px solid ${active ? 'rgba(99,179,237,0.35)' : 'rgba(255,255,255,0.09)'}`,
        background: active ? 'rgba(99,179,237,0.14)' : 'rgba(255,255,255,0.04)',
        color: active ? 'rgba(147,210,255,0.9)' : 'var(--overlay-text-muted)',
        fontSize: 10,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.12s, border-color 0.12s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function buildTicks(duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0];
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
  const minStep = duration / 6;
  const step = steps.find((s) => s >= minStep) ?? 3600;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(parseFloat(t.toFixed(4)));
  if (ticks[ticks.length - 1] !== duration) ticks.push(duration);
  return ticks;
}

// Keep legacy export alias so any other code referencing buildTrimmedVideoOutputPath still works
export function buildTrimmedVideoOutputPath(sourcePath: string): string {
  const match = sourcePath.match(/^(.*[/\\])?([^/\\]+)$/);
  const parentPath = match?.[1] ?? '';
  const leafName = match?.[2] ?? sourcePath;
  const stem = leafName.replace(/\.[^.]+$/, '');
  return `${parentPath}${stem}.trimmed.mp4`;
}
