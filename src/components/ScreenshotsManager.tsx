import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
  type Monitor as TauriMonitor,
} from '@tauri-apps/api/window';

import {
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  LoaderCircle,
  Monitor,
  MousePointer2,
  RefreshCw,
  Save,
  Search,
  Maximize2,
  Square,
  ArrowUpRight,
  Type,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { useSettingsStore } from '../store/settingsStore';
import { screenshotFeatureConfig } from '../config/screenshots';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  isSupportedScreenshotEntry,
  normalizeSelection,
  selectionToPixelRect,
  sortScreenshotEntries,
  type Point2D,
  type RectSelection,
  type ScreenshotEntryLike,
} from './screenshotsUtils';
import { OverlayScrollArea } from './OverlayScrollArea';

// ─── Annotation types ─────────────────────────────────────────────────────────

type AnnotationTool = 'select' | 'rect' | 'arrow' | 'text';

type RectAnnotation  = { type: 'rect';  x1: number; y1: number; x2: number; y2: number; color: string; lw: number; };
type ArrowAnnotation = { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; };
type TextAnnotation  = { type: 'text';  x:  number; y:  number; text: string; color: string; size: number; };
type Annotation = RectAnnotation | ArrowAnnotation | TextAnnotation;

const ANNOTATION_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#ec4899','#f1f5f9'];

// ─── Types ────────────────────────────────────────────────────────────────────

type FileEntry = ScreenshotEntryLike & {
  size: number;
  is_hidden?: boolean;
  is_symlink?: boolean;
};

type ScreenshotItem = FileEntry & { previewUrl: string | null };

type ScreenshotPreviewPayload = {
  captureId: string;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
};

type SavedScreenshotPayload = {
  path: string;
  file_name: string;
  created_at: number;
};

type ScreenshotOutputActionId =
  typeof screenshotFeatureConfig.outputActions[number]['id'];

type MonitorCapture = {
  id: string;
  label: string;
  logicalX: number;
  logicalY: number;
  logicalWidth: number;
  logicalHeight: number;
  physicalX: number;
  physicalY: number;
  physicalWidth: number;
  physicalHeight: number;
  scaleFactor: number;
  captureId: string | null;
  previewUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  isActive: boolean;
};

// ─── Palette constants ────────────────────────────────────────────────────────

const PANEL     = 'var(--overlay-bg-panel)';
const PANEL_ALT = 'var(--overlay-bg-panel-alt)';
const BORDER    = 'var(--overlay-border)';
const MUTED     = 'var(--overlay-text-muted)';
const TEXT      = 'var(--overlay-text-primary)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureDir(path: string): Promise<void> {
  try {
    await invoke('fs_list_dir', { path, showHidden: false });
  } catch {
    await invoke('fs_create_dir', { path });
  }
}

function toMonitorCapture(monitor: TauriMonitor, activeId: string | null): MonitorCapture {
  const sf = monitor.scaleFactor || 1;
  const logicalWidth  = Math.round(monitor.size.width  / sf);
  const logicalHeight = Math.round(monitor.size.height / sf);
  const id = [monitor.name ?? 'display', monitor.position.x, monitor.position.y, monitor.size.width, monitor.size.height].join(':');
  const displayName = monitor.name?.trim() || 'Display';
  return {
    id,
    label: `${displayName} · ${logicalWidth}×${logicalHeight}`,
    logicalX: monitor.position.x,
    logicalY: monitor.position.y,
    logicalWidth,
    logicalHeight,
    physicalX:      monitor.position.x,
    physicalY:      monitor.position.y,
    physicalWidth:  monitor.size.width,
    physicalHeight: monitor.size.height,
    scaleFactor: sf,
    captureId: null,
    previewUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    isActive: id === activeId,
  };
}

function formatFileSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_048_576) return `${(size / 1_024).toFixed(1)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }

function formatToolbarActionLabel(
  action: ScreenshotOutputActionId,
  scope: 'region' | 'monitor' | 'annotated',
): string {
  if (scope === 'monitor') {
    if (action === 'copy') return 'Copy Screen';
    if (action === 'save') return 'Save Screen';
    return 'Save + Copy Screen';
  }

  if (scope === 'annotated') {
    if (action === 'copy') return 'Copy Annotated';
    if (action === 'save') return 'Save Annotated';
    return 'Save + Copy Annotated';
  }

  if (action === 'copy') return 'Copy';
  if (action === 'save') return 'Save';
  return 'Save + Copy';
}

function buildGridOverlay(accent: string): React.CSSProperties {
  const guide = `${accent}55`;
  const guideSoft = `${accent}24`;
  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: [
      `linear-gradient(to right, transparent calc(33.333% - 0.5px), ${guide} calc(33.333% - 0.5px), ${guide} calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), ${guide} calc(66.666% - 0.5px), ${guide} calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))`,
      `linear-gradient(to bottom, transparent calc(33.333% - 0.5px), ${guide} calc(33.333% - 0.5px), ${guide} calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), ${guide} calc(66.666% - 0.5px), ${guide} calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))`,
      `linear-gradient(to right, ${guideSoft} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${guideSoft} 1px, transparent 1px)`,
    ].join(','),
    backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px',
    mixBlendMode: 'screen',
    opacity: 0.45,
  };
}

// Draw annotations onto a canvas context
function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
  ctx.save();
  if (ann.type === 'rect') {
    const a = ann as RectAnnotation;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = a.lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(Math.min(a.x1, a.x2), Math.min(a.y1, a.y2), Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1));
    ctx.stroke();
  } else if (ann.type === 'arrow') {
    const a = ann as ArrowAnnotation;
    const dx = a.x2 - a.x1;
    const dy = a.y2 - a.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Skip degenerate arrows — this was causing draw errors with zero-length vectors
    if (len < 2) { ctx.restore(); return; }
    const angle = Math.atan2(dy, dx);
    const head  = Math.max(12, a.lw * 4);
    ctx.strokeStyle = a.color;
    ctx.fillStyle   = a.color;
    ctx.lineWidth   = a.lw;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - head * Math.cos(angle - Math.PI / 6), a.y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(a.x2 - head * Math.cos(angle + Math.PI / 6), a.y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (ann.type === 'text') {
    const a = ann as TextAnnotation;
    ctx.fillStyle    = a.color;
    ctx.font         = `700 ${a.size}px Inter, system-ui, sans-serif`;
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 4;
    ctx.fillText(a.text, a.x, a.y + a.size);
  }
  ctx.restore();
}

// Redraws the full canvas from stable refs — used by both the state effect and ResizeObserver
function redrawCanvas(
  canvas: HTMLCanvasElement,
  annotations: Annotation[],
  liveAnnotation: Annotation | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const ann of annotations) drawAnnotation(ctx, ann);
  if (liveAnnotation) drawAnnotation(ctx, liveAnnotation);
}

function dataUrlToObjectUrl(dataUrl: string): string {
  if (
    typeof URL === 'undefined'
    || typeof URL.createObjectURL !== 'function'
  ) {
    return dataUrl;
  }

  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/);
  if (!match) {
    return dataUrl;
  }

  try {
    const mimeType = match[1] || 'application/octet-stream';
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  } catch {
    return dataUrl;
  }
}

function revokePreviewUrl(url: string | null | undefined): void {
  if (
    !url
    || !url.startsWith('blob:')
    || typeof URL === 'undefined'
    || typeof URL.revokeObjectURL !== 'function'
  ) {
    return;
  }

  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore best-effort cleanup failures.
  }
}

function revokePreviewUrls(urls: Iterable<string | null | undefined>): void {
  for (const url of urls) {
    revokePreviewUrl(url);
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScreenshotsManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const screenshotSettings = useSettingsStore(s => s.settings.screenshots);
  const screenshotDir = screenshotSettings.saveDirectory || screenshotFeatureConfig.defaultSaveDirectory;

  // ── Refs ──
  // containerRef: the SINGLE coordinate origin for all pointer events and overlay children.
  const containerRef    = useRef<HTMLDivElement | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const textInputRef    = useRef<HTMLInputElement | null>(null);

  // Stable refs used inside pointer handlers and ResizeObserver to avoid stale closures
  const annotationsRef    = useRef<Annotation[]>([]);
  const liveAnnotationRef = useRef<Annotation | null>(null);
  const galleryRequestIdRef = useRef(0);
  const captureRequestIdRef = useRef(0);
  const galleryPreviewUrlsRef = useRef<string[]>([]);
  const monitorPreviewUrlsRef = useRef<string[]>([]);

  // Cached at pointerDown — never re-read during a drag
  const dragRectRef   = useRef<DOMRect | null>(null);
  const dragOriginRef = useRef<Point2D | null>(null);
  const isDraggingRef = useRef(false);

  // ── State ──
  const [activeTool,      setActiveTool]      = useState<AnnotationTool>('select');
  const [annotations,     setAnnotations]     = useState<Annotation[]>([]);
  const [liveAnnotation,  setLiveAnnotation]  = useState<Annotation | null>(null);
  const [annColor,        setAnnColor]        = useState(ANNOTATION_COLORS[0]);
  const [annLw,           setAnnLw]           = useState(3);
  const [textDraft,       setTextDraft]       = useState<{ x: number; y: number; } | null>(null);
  const [textValue,       setTextValue]       = useState('');

  const [monitors,        setMonitors]        = useState<MonitorCapture[]>([]);
  const [activeMonitorId, setActiveMonitorId] = useState<string | null>(null);
  const [selection,       setSelection]       = useState<RectSelection | null>(null);
  const [items,           setItems]           = useState<ScreenshotItem[]>([]);
  const [visibleCount,    setVisibleCount]    = useState(0);
  const [totalCount,      setTotalCount]      = useState(0);
  const [activeSection,   setActiveSection]   = useState<'tool' | 'library'>('tool');
  const [isCapturing,     setIsCapturing]     = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [isCopying,       setIsCopying]       = useState(false);
  const [statusMsg,       setStatusMsg]       = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);
  const [copyingPath,     setCopyingPath]     = useState<string | null>(null);
  const [copiedPath,      setCopiedPath]      = useState<string | null>(null);
  const [deletingPath,    setDeletingPath]    = useState<string | null>(null);
  const [libraryWidth, setLibraryWidth] = usePersistentPanelSize('overlayterm-screenshots-library-width', 280, 220, 480);

  const activeMonitor = monitors.find(m => m.id === activeMonitorId) ?? null;
  const shouldLoadGalleryPreviews = activeSection === 'library';
  const orderedOutputActions = useCallback(() => (
    [
      ...screenshotFeatureConfig.outputActions,
    ].sort((left, right) => {
      if (left.id === screenshotSettings.defaultOutputAction) return -1;
      if (right.id === screenshotSettings.defaultOutputAction) return 1;
      return 0;
    })
  ), [screenshotSettings.defaultOutputAction]);

  // Keep stable refs in sync with state — these are what pointer handlers + ResizeObserver read
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);
  useEffect(() => { liveAnnotationRef.current = liveAnnotation; }, [liveAnnotation]);
  useEffect(() => () => {
    galleryRequestIdRef.current += 1;
    captureRequestIdRef.current += 1;
    revokePreviewUrls(galleryPreviewUrlsRef.current);
    revokePreviewUrls(monitorPreviewUrlsRef.current);
    galleryPreviewUrlsRef.current = [];
    monitorPreviewUrlsRef.current = [];
  }, []);

  const replaceGalleryItems = useCallback((nextItems: ScreenshotItem[]) => {
    const nextPreviewUrls = nextItems
      .map(item => item.previewUrl)
      .filter((url): url is string => Boolean(url));

    setItems(() => {
      revokePreviewUrls(galleryPreviewUrlsRef.current);
      galleryPreviewUrlsRef.current = nextPreviewUrls;
      return nextItems;
    });
  }, []);

  const replaceMonitors = useCallback((nextMonitors: MonitorCapture[]) => {
    const nextPreviewUrls = nextMonitors
      .map(monitor => monitor.previewUrl)
      .filter((url): url is string => Boolean(url));

    setMonitors(() => {
      revokePreviewUrls(monitorPreviewUrlsRef.current);
      monitorPreviewUrlsRef.current = nextPreviewUrls;
      return nextMonitors;
    });
  }, []);

  const resetEditorState = useCallback(() => {
    setSelection(null);
    setAnnotations([]);
    setLiveAnnotation(null);
    liveAnnotationRef.current = null;
    annotationsRef.current = [];
    setTextDraft(null);
    setTextValue('');
    setActiveTool('select');
  }, []);

  const finishToolAction = useCallback((openLibrary: boolean) => {
    if (!screenshotSettings.closeEditorAfterAction) {
      return;
    }

    resetEditorState();
    if (openLibrary) {
      setActiveSection('library');
    }
  }, [resetEditorState, screenshotSettings.closeEditorAfterAction]);

  // ── Derived: selection in physical px ──
  const getSelectionPx = useCallback(() => {
    if (!selection || !activeMonitor || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return selectionToPixelRect(
      normalizeSelection(selection),
      { width: rect.width, height: rect.height },
      { width: activeMonitor.imageWidth, height: activeMonitor.imageHeight },
    );
  }, [selection, activeMonitor]);

  const selectionPx = getSelectionPx();

  // ── Gallery ──
  const loadGallery = useCallback(async () => {
    const requestId = galleryRequestIdRef.current + 1;
    galleryRequestIdRef.current = requestId;

    try {
      await ensureDir(screenshotDir);
      const listed = await invoke<FileEntry[]>('fs_list_dir', { path: screenshotDir, showHidden: false });
      const entries = sortScreenshotEntries(listed.filter(isSupportedScreenshotEntry));
      const visible = entries.slice(0, screenshotFeatureConfig.maxGalleryItems);

      const withPreviews = shouldLoadGalleryPreviews
        ? await Promise.all(
            visible.map(async entry => {
              try {
                const previewDataUrl = await invoke<string>('screenshot_read_gallery_thumbnail', {
                  path: entry.path,
                  maxWidth: screenshotFeatureConfig.galleryThumbnail.maxWidth,
                  maxHeight: screenshotFeatureConfig.galleryThumbnail.maxHeight,
                });
                return { ...entry, previewUrl: dataUrlToObjectUrl(previewDataUrl) };
              } catch {
                return { ...entry, previewUrl: null };
              }
            }),
          )
        : visible.map(entry => ({ ...entry, previewUrl: null }));

      if (requestId !== galleryRequestIdRef.current) {
        revokePreviewUrls(withPreviews.map(item => item.previewUrl));
        return;
      }

      replaceGalleryItems(withPreviews);
      setVisibleCount(visible.length);
      setTotalCount(entries.length);
    } catch (err) {
      if (requestId !== galleryRequestIdRef.current) {
        return;
      }
      setError(String(err));
      replaceGalleryItems([]);
      setVisibleCount(0);
      setTotalCount(0);
    }
  }, [replaceGalleryItems, screenshotDir, shouldLoadGalleryPreviews]);

  // ── Capture all monitors ──
  const captureMonitors = useCallback(async () => {
    const requestId = captureRequestIdRef.current + 1;
    captureRequestIdRef.current = requestId;

    setIsCapturing(true);
    setError(null);
    setSelection(null);
    try {
      const [available, activeMon, primaryMon] = await Promise.all([
        availableMonitors(), currentMonitor(), primaryMonitor(),
      ]);
      const activeId = (activeMon ?? primaryMon)
        ? toMonitorCapture((activeMon ?? primaryMon)!, null).id
        : null;
      const base = available.map(m => toMonitorCapture(m, activeId));

      const results: MonitorCapture[] = [];
      for (const mon of base) {
        const preview = await invoke<ScreenshotPreviewPayload>('screenshot_capture_preview', {
          x: mon.physicalX,
          y: mon.physicalY,
          width: mon.physicalWidth,
          height: mon.physicalHeight,
        });
        results.push({
          ...mon,
          captureId: preview.captureId,
          previewUrl: dataUrlToObjectUrl(preview.previewUrl),
          imageWidth: preview.imageWidth,
          imageHeight: preview.imageHeight,
        });
      }

      if (requestId !== captureRequestIdRef.current) {
        revokePreviewUrls(results.map(result => result.previewUrl));
        return;
      }

      replaceMonitors(results);
      const firstActive = results.find(m => m.isActive) ?? results[0] ?? null;
      setActiveMonitorId(firstActive?.id ?? null);
      setStatusMsg(`Captured ${results.length} display${results.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      if (requestId !== captureRequestIdRef.current) {
        return;
      }
      setError(String(err));
      replaceMonitors([]);
    } finally {
      if (requestId === captureRequestIdRef.current) {
        setIsCapturing(false);
      }
    }
  }, [replaceMonitors]);

  const refreshAll = useCallback(async () => {
    await Promise.all([captureMonitors(), loadGallery()]);
  }, [captureMonitors, loadGallery]);

  useEffect(() => { void captureMonitors(); }, [captureMonitors]);
  useEffect(() => { void loadGallery(); }, [loadGallery]);

  useEffect(() => {
    if (!statusMsg) return;
    const t = window.setTimeout(() => setStatusMsg(null), 2500);
    return () => window.clearTimeout(t);
  }, [statusMsg]);

  useEffect(() => {
    if (!copiedPath) return;
    const t = window.setTimeout(() => setCopiedPath(null), 1800);
    return () => window.clearTimeout(t);
  }, [copiedPath]);

  useEffect(() => {
    setAnnotations([]);
    setLiveAnnotation(null);
    liveAnnotationRef.current = null;
    annotationsRef.current = [];
    setTextDraft(null);
    setTextValue('');
  }, [activeMonitorId]);

  useLayoutEffect(() => {
    if (screenshotSettings.defaultCaptureMode !== 'monitor' || !activeMonitor?.captureId) {
      return;
    }

    let frameA = 0;
    let frameB = 0;
    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width < 4 || rect.height < 4) {
          return;
        }

        setSelection(current => {
          const normalized = current ? normalizeSelection(current) : null;
          if (normalized && normalized.width >= 4 && normalized.height >= 4) {
            return current;
          }

          return {
            x: 0,
            y: 0,
            width: rect.width,
            height: rect.height,
          };
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
    };
  }, [activeMonitor?.captureId, screenshotSettings.defaultCaptureMode]);

  // ── Canvas: sync pixel dimensions to CSS layout size ──
  // Uses useLayoutEffect so dimensions are set before paint, eliminating the
  // default 300×150 canvas offset that caused coordinate desync.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const syncSize = () => {
      const r = container.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        canvas.width  = Math.round(r.width);
        canvas.height = Math.round(r.height);
        // Redraw using stable refs — never stale
        redrawCanvas(canvas, annotationsRef.current, liveAnnotationRef.current);
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [activeMonitorId]); // Re-bind when monitor changes (new capture resets canvas)

  // ── Canvas redraw when annotation state changes ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redrawCanvas(canvas, annotations, liveAnnotation);
  }, [annotations, liveAnnotation]);

  // ── Coordinate helper: get position relative to container ──
  // Always reads from containerRef, NOT from e.currentTarget, to guarantee
  // the same origin is used across down/move/up events.
  const getContainerPos = useCallback((clientX: number, clientY: number, cachedRect?: DOMRect | null): Point2D => {
    const rect = cachedRect ?? containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top,  0, rect.height),
    };
  }, []);

  // ── Pointer events ──
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMonitor?.captureId || isCapturing) return;

    // Cache the EXACT rect at pointerdown — reused for the entire drag gesture.
    // Always use containerRef.current to guarantee we measure the image container,
    // not any ancestor that might forward the event.
    const rect = containerRef.current!.getBoundingClientRect();
    dragRectRef.current = rect;
    isDraggingRef.current = true;

    const { x, y } = getContainerPos(e.clientX, e.clientY, rect);
    dragOriginRef.current = { x, y };
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'select') {
      e.preventDefault();
      // Store raw (unnormalized) selection — negative width/height is valid during drag
      setSelection({ x, y, width: 0, height: 0 });
    } else if (activeTool === 'text') {
      setTextDraft({ x, y });
      setTextValue('');
      window.requestAnimationFrame(() => textInputRef.current?.focus());
    } else {
      e.preventDefault();
      const live: Annotation = activeTool === 'rect'
        ? { type: 'rect',  x1: x, y1: y, x2: x, y2: y, color: annColor, lw: annLw }
        : { type: 'arrow', x1: x, y1: y, x2: x, y2: y, color: annColor, lw: annLw };
      liveAnnotationRef.current = live;
      setLiveAnnotation(live);
    }
  }, [activeMonitor, isCapturing, activeTool, annColor, annLw, getContainerPos]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect   = dragRectRef.current;
    const origin = dragOriginRef.current;
    if (!rect || !origin || !isDraggingRef.current) return;
    e.preventDefault();

    // Use the CACHED rect from pointerDown — never re-measure during drag
    const { x, y } = getContainerPos(e.clientX, e.clientY, rect);

    if (activeTool === 'select') {
      // Store raw delta — do NOT clamp/normalize here.
      // normalizedSel handles display; selectionPx handles pixel mapping.
      // Clamping during drag causes the selection box to jump when dragging
      // in a negative direction (right-to-left / bottom-to-top).
      const raw: RectSelection = {
        x: origin.x,
        y: origin.y,
        width:  clamp(x - origin.x, -origin.x, rect.width  - origin.x),
        height: clamp(y - origin.y, -origin.y, rect.height - origin.y),
      };
      setSelection(raw);
    } else if (activeTool === 'rect' || activeTool === 'arrow') {
      const live: Annotation = activeTool === 'rect'
        ? { type: 'rect',  x1: origin.x, y1: origin.y, x2: x, y2: y, color: annColor, lw: annLw }
        : { type: 'arrow', x1: origin.x, y1: origin.y, x2: x, y2: y, color: annColor, lw: annLw };
      // Update ref synchronously so ResizeObserver always has current state
      liveAnnotationRef.current = live;
      setLiveAnnotation(live);
    }
  }, [activeTool, annColor, annLw, getContainerPos]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    isDraggingRef.current = false;
    dragRectRef.current   = null;
    dragOriginRef.current = null;

    const committed = liveAnnotationRef.current;
    if (committed) {
      // Only commit arrow/rect if they have meaningful length
      let shouldCommit = true;
      if (committed.type === 'arrow' || committed.type === 'rect') {
        const a = committed as RectAnnotation | ArrowAnnotation;
        const dx = Math.abs(a.x2 - a.x1);
        const dy = Math.abs(a.y2 - a.y1);
        shouldCommit = dx >= 3 || dy >= 3;
      }
      if (shouldCommit) {
        setAnnotations(prev => [...prev, committed]);
      }
      liveAnnotationRef.current = null;
      setLiveAnnotation(null);
    }
    // selection stays until user clears it
  }, []);

  const commitText = useCallback(() => {
    if (!textDraft || !textValue.trim()) { setTextDraft(null); setTextValue(''); return; }
    setAnnotations(prev => [...prev, { type: 'text', x: textDraft.x, y: textDraft.y, text: textValue.trim(), color: annColor, size: 16 }]);
    setTextDraft(null);
    setTextValue('');
  }, [textDraft, textValue, annColor]);

  // ── Actions ──
  const doSave = useCallback(async (copyToo: boolean) => {
    if (!activeMonitor?.captureId || !selectionPx) return;
    const norm = normalizeSelection(selectionPx);
    if (norm.width < 4 || norm.height < 4) { setError('Selection too small.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      await ensureDir(screenshotDir);
      const saved = await invoke<SavedScreenshotPayload>('screenshot_save_region', {
        captureId: activeMonitor.captureId,
        x: norm.x, y: norm.y, width: norm.width, height: norm.height,
        directory: screenshotDir,
        filePrefix: screenshotFeatureConfig.filePrefix,
        copyToClipboard: copyToo,
      });
      await loadGallery();
      setStatusMsg(copyToo ? `Saved & copied ${saved.file_name}.` : `Saved ${saved.file_name}.`);
      finishToolAction(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  }, [activeMonitor, finishToolAction, selectionPx, screenshotDir, loadGallery]);

  const doCopy = useCallback(async () => {
    if (!activeMonitor?.captureId || !selectionPx) return;
    const norm = normalizeSelection(selectionPx);
    if (norm.width < 4 || norm.height < 4) { setError('Selection too small.'); return; }
    setIsCopying(true);
    setError(null);
    try {
      await invoke('screenshot_copy_region_to_clipboard', {
        captureId: activeMonitor.captureId,
        x: norm.x, y: norm.y, width: norm.width, height: norm.height,
      });
      setStatusMsg('Copied to clipboard.');
      finishToolAction(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCopying(false);
    }
  }, [activeMonitor, finishToolAction, selectionPx]);

  const doFullMonitor = useCallback(async (action: 'save' | 'copy' | 'save-copy') => {
    if (!activeMonitor?.captureId) return;
    const w = activeMonitor.imageWidth;
    const h = activeMonitor.imageHeight;
    if (action === 'copy') {
      setIsCopying(true);
      try {
        await invoke('screenshot_copy_region_to_clipboard', { captureId: activeMonitor.captureId, x: 0, y: 0, width: w, height: h });
        setStatusMsg('Full monitor copied.');
        finishToolAction(false);
      } catch (err) { setError(String(err)); }
      finally { setIsCopying(false); }
    } else {
      setIsSaving(true);
      try {
        await ensureDir(screenshotDir);
        const saved = await invoke<SavedScreenshotPayload>('screenshot_save_region', {
          captureId: activeMonitor.captureId,
          x: 0, y: 0, width: w, height: h,
          directory: screenshotDir,
          filePrefix: screenshotFeatureConfig.filePrefix,
          copyToClipboard: action === 'save-copy',
        });
        await loadGallery();
        setStatusMsg(`Full monitor saved${action === 'save-copy' ? ' & copied' : ''}: ${saved.file_name}.`);
        finishToolAction(true);
      } catch (err) { setError(String(err)); }
      finally { setIsSaving(false); }
    }
  }, [activeMonitor, finishToolAction, screenshotDir, loadGallery]);

  const runSelectionOutputAction = useCallback(async (action: ScreenshotOutputActionId) => {
    if (action === 'copy') {
      await doCopy();
      return;
    }

    await doSave(action === 'save-copy');
  }, [doCopy, doSave]);

  const copyGalleryItem = useCallback(async (item: ScreenshotItem) => {
    setCopyingPath(item.path);
    try {
      await invoke('screenshot_copy_image_to_clipboard', { path: item.path });
      setCopiedPath(item.path);
      setStatusMsg(`Copied ${item.name}.`);
    } catch (err) { setError(String(err)); }
    finally { setCopyingPath(null); }
  }, []);

  const deleteGalleryItem = useCallback(async (item: ScreenshotItem) => {
    if (deletingPath || !window.confirm(`Delete ${item.name} from the screenshot library?`)) {
      return;
    }
    setDeletingPath(item.path);
    setError(null);
    try {
      await invoke('fs_delete', { path: item.path, recursive: false });
      if (copiedPath === item.path) {
        setCopiedPath(null);
      }
      if (copyingPath === item.path) {
        setCopyingPath(null);
      }
      await loadGallery();
      setStatusMsg(`Deleted ${item.name}.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setDeletingPath(null);
    }
  }, [copiedPath, copyingPath, deletingPath, loadGallery]);

  const isWorking = isCapturing || isSaving || isCopying;
  const normalizedSel = selection ? normalizeSelection(selection) : null;
  const hasSelection = normalizedSel && normalizedSel.width >= 4 && normalizedSel.height >= 4;
  const hasAnnotations = annotations.length > 0;

  // ── Save annotated ──
  const runAnnotatedOutputAction = useCallback(async (action: ScreenshotOutputActionId) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !activeMonitor) return;
    setError(null);
    if (action === 'copy') {
      setIsCopying(true);
    } else {
      setIsSaving(true);
    }
    try {
      const img = document.createElement('img');
      img.src = activeMonitor.previewUrl ?? '';
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
      const out = document.createElement('canvas');
      out.width = img.naturalWidth; out.height = img.naturalHeight;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const scaleX = img.naturalWidth  / container.getBoundingClientRect().width;
      const scaleY = img.naturalHeight / container.getBoundingClientRect().height;
      ctx.save(); ctx.scale(scaleX, scaleY);
      [...annotations].forEach(ann => drawAnnotation(ctx, ann));
      ctx.restore();
      const px = getSelectionPx();
      const previewScaleX = img.naturalWidth  / activeMonitor.imageWidth;
      const previewScaleY = img.naturalHeight / activeMonitor.imageHeight;
      let finalCanvas = out;
      if (px) {
        const norm = normalizeSelection(px);
        const crop = document.createElement('canvas');
        crop.width = Math.round(norm.width * previewScaleX);
        crop.height = Math.round(norm.height * previewScaleY);
        crop.getContext('2d')!.drawImage(out, Math.round(norm.x * previewScaleX), Math.round(norm.y * previewScaleY), crop.width, crop.height, 0, 0, crop.width, crop.height);
        finalCanvas = crop;
      }
      const blob = await new Promise<Blob>((res, rej) => finalCanvas.toBlob(b => b ? res(b) : rej(new Error('canvas empty')), 'image/png'));
      let fileName: string | null = null;

      if (action !== 'copy') {
        const buf = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buf));
        await ensureDir(screenshotDir);
        const ts = Date.now();
        fileName = `${screenshotFeatureConfig.filePrefix}-${ts}.png`;
        const fullPath = `${screenshotDir}\\${fileName}`;
        await invoke('fs_write_file', { path: fullPath, content: bytes });
      }

      if (action === 'copy' || action === 'save-copy') {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
      }
      if (action !== 'copy') {
        await loadGallery();
      }
      setStatusMsg(
        action === 'copy'
          ? 'Copied annotated selection.'
          : `Saved annotated: ${fileName}${action === 'save-copy' ? ' & copied' : ''}.`,
      );
      finishToolAction(action !== 'copy');
    } catch (err) { setError(String(err)); }
    finally {
      setIsSaving(false);
      setIsCopying(false);
    }
  }, [activeMonitor, annotations, finishToolAction, screenshotDir, loadGallery, getSelectionPx]);

  // ─── Tool content ──────────────────────────────────────────────────────────

  const toolContent = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Monitor tabs */}
      {monitors.length > 0 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexWrap: 'wrap' }}>
          {monitors.map((mon, i) => {
            const active = mon.id === activeMonitorId;
            return (
              <button key={mon.id} type="button" onClick={() => { setActiveMonitorId(mon.id); setSelection(null); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8,
                  border: `1px solid ${active ? `${accent}88` : BORDER}`, background: active ? `${accent}20` : 'rgba(255,255,255,0.03)',
                  color: active ? '#f4f6ff' : MUTED, cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>
                <Monitor size={11} style={{ flexShrink: 0 }} />
                Display {i + 1}
                {mon.isActive && <span style={{ padding: '1px 5px', borderRadius: 999, background: `${accent}20`, border: `1px solid ${accent}44`, fontSize: 9, color: accent }}>Active</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Annotation toolbar */}
      {activeMonitor?.captureId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexWrap: 'wrap' }}>
          {([['select','Select'],['rect','Rectangle'],['arrow','Arrow'],['text','Text']] as const).map(([tool, label]) => {
            const icons: Record<AnnotationTool, React.ReactNode> = {
              select: <MousePointer2 size={13} />, rect: <Square size={13} />,
              arrow: <ArrowUpRight size={13} />, text: <Type size={13} />,
            };
            const active = activeTool === tool;
            return (
              <button key={tool} type="button" title={label} onClick={() => setActiveTool(tool)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600,
                  border: `1px solid ${active ? accent : BORDER}`, background: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
                  color: active ? '#f4f6ff' : MUTED, cursor: 'pointer' }}>
                {icons[tool as AnnotationTool]}{label}
              </button>
            );
          })}
          <div style={{ width: 1, height: 18, background: BORDER, margin: '0 2px' }} />
          {ANNOTATION_COLORS.map(c => (
            <button key={c} type="button" title={c} onClick={() => setAnnColor(c)}
              style={{ width: 18, height: 18, borderRadius: '50%', border: c === annColor ? `2px solid #fff` : `2px solid transparent`,
                background: c, cursor: 'pointer', outline: c === annColor ? `2px solid ${c}` : 'none', outlineOffset: 1 }} />
          ))}
          <div style={{ width: 1, height: 18, background: BORDER, margin: '0 2px' }} />
          {[2, 3, 5].map(w => (
            <button key={w} type="button" title={`Stroke ${w}px`} onClick={() => setAnnLw(w)}
              style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${annLw === w ? accent : BORDER}`, background: annLw === w ? `${accent}22` : 'rgba(255,255,255,0.03)' }}>
              <div style={{ width: 14, height: w, borderRadius: 999, background: annLw === w ? accent : MUTED }} />
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {hasAnnotations && (
            <>
              <button type="button" title="Undo" onClick={() => setAnnotations(p => p.slice(0, -1))} style={annBtn()}>
                <RotateCcw size={12} />
              </button>
              <button type="button" title="Clear all" onClick={() => setAnnotations([])} style={annBtn()}>
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Preview area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, background: 'var(--overlay-bg-shell)', overflow: 'hidden' }}>
        {isCapturing && monitors.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: MUTED }}>
            <LoaderCircle size={28} className="animate-spin" style={{ color: accent }} />
            <div style={{ fontSize: 12 }}>Capturing displays…</div>
          </div>
        ) : !activeMonitor ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: MUTED }}>
            <ImageIcon size={32} strokeWidth={1} />
            <div style={{ fontSize: 12 }}>No capture yet</div>
            <button type="button" onClick={() => void captureMonitors()} style={btnStyle(true, accent)}>
              <Crosshair size={13} /> Capture
            </button>
          </div>
        ) : (
          /*
           * COORDINATE ORIGIN — this div is the single source of truth for all
           * pointer coordinates and absolutely-positioned overlays (canvas, selection).
           *
           * Sizing strategy:
           *   - We let CSS aspect-ratio + max constraints do layout.
           *   - We do NOT apply padding, margin, or border that would shift the
           *     interior coordinate space — only the outer div has padding.
           *   - The canvas's pixel dimensions are synced via useLayoutEffect+ResizeObserver
           *     so they always match the CSS box exactly.
           */
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'relative',
              // Use explicit max constraints so the container never overflows its parent
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${activeMonitor.imageWidth} / ${activeMonitor.imageHeight}`,
              borderRadius: 10,
              overflow: 'hidden',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: activeTool === 'text' ? 'text' : isCapturing ? 'wait' : 'crosshair',
              // touch-action none is REQUIRED for Pointer Events to work correctly on touch/pen
              touchAction: 'none',
              // Prevent the browser from applying any fractional sub-pixel offset
              willChange: 'transform',
              // Ensure this establishes its own stacking context so overlays z-stack correctly
              isolation: 'isolate',
            }}
          >
            <img
              src={activeMonitor.previewUrl ?? ''}
              alt={activeMonitor.label}
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />

            {screenshotSettings.showGrid && (
              <div aria-label="Screenshot composition grid" data-testid="screenshot-grid" style={buildGridOverlay(accent)} />
            )}

            {/* Annotation canvas — pixel dimensions kept in sync by useLayoutEffect */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                // Width/height CSS attrs are set by useLayoutEffect; explicitly
                // stretch to 100% so it fills even before ResizeObserver fires
                width: '100%',
                height: '100%',
              }}
            />

            {/* Text input overlay */}
            {textDraft && (
              <input
                ref={textInputRef}
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setTextDraft(null); setTextValue(''); } }}
                onBlur={commitText}
                style={{
                  position: 'absolute', left: textDraft.x, top: textDraft.y,
                  background: 'rgba(0,0,0,0.7)', border: `1px solid ${annColor}`,
                  color: annColor, fontSize: 14, fontWeight: 700, padding: '2px 6px',
                  borderRadius: 4, outline: 'none', minWidth: 80,
                }}
              />
            )}

            {/* Selection overlay — only in select mode */}
            {activeTool === 'select' && normalizedSel && normalizedSel.width >= 2 && normalizedSel.height >= 2 && (
              <>
                {/* Dark vignette outside selection */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.46)', pointerEvents: 'none' }} />
                {/* Selection rect — uses normalizedSel (always positive x/y/w/h) */}
                <div style={{
                  position: 'absolute',
                  left: normalizedSel.x,
                  top: normalizedSel.y,
                  width: normalizedSel.width,
                  height: normalizedSel.height,
                  boxShadow: `0 0 0 9999px rgba(0,0,0,0.46)`,
                  border: `2px solid ${accent}`,
                  outline: '1px solid rgba(255,255,255,0.35)',
                  pointerEvents: 'none',
                }} />
                {selectionPx && (
                  <div style={{
                    position: 'absolute', pointerEvents: 'none',
                    left: normalizedSel.x + normalizedSel.width / 2,
                    top: Math.min(normalizedSel.y + normalizedSel.height + 6, (containerRef.current?.getBoundingClientRect().height ?? 9999) - 28),
                    transform: 'translateX(-50%)',
                    background: 'rgba(5,8,15,0.92)', border: `1px solid ${accent}55`,
                    borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700,
                    color: '#e8ecff', whiteSpace: 'nowrap', fontFamily: 'var(--overlay-font-mono, monospace)',
                  }}>
                    {normalizeSelection(selectionPx).width}×{normalizeSelection(selectionPx).height}
                  </div>
                )}
              </>
            )}

            {/* Saving spinner */}
            {isSaving && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#eef0ff' }}>
                  <LoaderCircle size={24} className="animate-spin" style={{ color: accent }} />
                  <div style={{ fontSize: 11 }}>Saving…</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{ padding: '6px 8px', borderTop: `1px solid ${BORDER}`, background: PANEL, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {hasSelection ? (
          <>
            <span style={{ fontSize: 10, color: MUTED, marginRight: 2 }}>{hasAnnotations ? 'Annotated selection:' : 'Selection:'}</span>
            {orderedOutputActions().map(action => {
              const primary = action.id === screenshotSettings.defaultOutputAction;
              const label = formatToolbarActionLabel(action.id, hasAnnotations ? 'annotated' : 'region');

              return (
                <button
                  key={`selection-${action.id}`}
                  type="button"
                  onClick={() => void (hasAnnotations ? runAnnotatedOutputAction(action.id) : runSelectionOutputAction(action.id))}
                  disabled={isWorking}
                  style={btnStyle(primary, accent, isWorking)}
                >
                  {(isSaving || isCopying) && primary
                    ? <LoaderCircle size={11} className="animate-spin" />
                    : action.id === 'copy'
                      ? <Copy size={11} />
                      : action.id === 'save'
                        ? <Save size={11} />
                        : <Check size={11} />}
                  {label}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setSelection(null)} style={btnStyle(false, accent)}>✕ Clear</button>
          </>
        ) : activeMonitor?.captureId ? (
          <>
            <span style={{ fontSize: 10, color: MUTED }}>
              {screenshotSettings.defaultCaptureMode === 'monitor'
                ? 'Full monitor is the default capture, or drag to switch to area snip:'
                : 'Draw a selection, or use the full monitor:'}
            </span>
            {orderedOutputActions().map(action => {
              const primary = action.id === screenshotSettings.defaultOutputAction;
              return (
                <button
                  key={`monitor-${action.id}`}
                  type="button"
                  onClick={() => void doFullMonitor(action.id)}
                  disabled={isWorking}
                  style={btnStyle(primary, accent, isWorking)}
                >
                  {(isSaving || isCopying) && primary
                    ? <LoaderCircle size={11} className="animate-spin" />
                    : action.id === 'copy'
                      ? <Copy size={11} />
                      : action.id === 'save'
                        ? <Save size={11} />
                        : <Maximize2 size={11} />}
                  {formatToolbarActionLabel(action.id, 'monitor')}
                </button>
              );
            })}
          </>
        ) : (
          <span style={{ fontSize: 10, color: MUTED }}>Capture a display to begin.</span>
        )}
      </div>
    </div>
  );

  // ─── Library content ───────────────────────────────────────────────────────

  const libraryContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#edf1ff' }}>Library</div>
        <div style={{ fontSize: 10, color: MUTED }}>{visibleCount}/{totalCount}</div>
      </div>
      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 8 }}>
        {items.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 11 }}>No screenshots yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {items.map(item => {
              const isCop  = copyingPath === item.path;
              const isCopd = copiedPath  === item.path;
              const isDeleting = deletingPath === item.path;
              return (
                <div key={item.path} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr)', gap: 8, alignItems: 'start', borderRadius: 8, border: `1px solid ${isCopd ? `${accent}77` : BORDER}`, background: isCopd ? `${accent}12` : PANEL_ALT, padding: 6 }}>
                  <div style={{ aspectRatio: '16/9', borderRadius: 5, overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#050510' }}>
                    {item.previewUrl
                      ? <img src={item.previewUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}><ImageIcon size={14} style={{ color: MUTED }} /></div>
                    }
                  </div>
                  <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#eef0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: 9, color: MUTED }}>{new Date(item.modified).toLocaleString()} · {formatFileSize(item.size)}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void copyGalleryItem(item)} disabled={isDeleting} style={btnStyle(true, accent, isCop || isDeleting)}>
                        {isCop ? <LoaderCircle size={10} className="animate-spin" /> : isCopd ? <Check size={10} /> : <Copy size={10} />}
                        {isCopd ? 'Copied' : 'Copy'}
                      </button>
                      <button type="button" onClick={() => invoke('fs_reveal_in_explorer', { path: item.path }).catch(e => setError(String(e)))} disabled={isDeleting} style={btnStyle(false, accent, isDeleting)}>
                        <Search size={10} /> Reveal
                      </button>
                      <button type="button" onClick={() => invoke('fs_open_file', { path: item.path }).catch(e => setError(String(e)))} disabled={isDeleting} style={btnStyle(false, accent, isDeleting)}>
                        <ExternalLink size={10} /> Open
                      </button>
                      <button type="button" onClick={() => void deleteGalleryItem(item)} disabled={isDeleting} style={btnStyle(false, accent, isDeleting)}>
                        {isDeleting ? <LoaderCircle size={10} className="animate-spin" /> : <Trash2 size={10} />}
                        {isDeleting ? 'Deleting' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </OverlayScrollArea>
    </div>
  );

  // ─── Root ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--overlay-bg-shell)', color: TEXT, fontFamily: 'var(--overlay-font-ui)' }}>

      {/* Side rail */}
      <div style={{ width: 46, minWidth: 46, borderRight: `1px solid ${BORDER}`, background: 'var(--overlay-bg-sidebar)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 6 }}>
        <RailButton active={activeSection === 'tool'} label="Tool" accent={accent} onClick={() => setActiveSection('tool')}>
          <Crosshair size={16} />
        </RailButton>
        <RailButton active={activeSection === 'library'} label="Library" accent={accent} onClick={() => setActiveSection('library')}>
          <ImageIcon size={16} />
        </RailButton>
      </div>

      {/* Content area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Top toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f3ff' }}>
            {activeSection === 'tool' ? 'Screenshot Tool' : 'Screenshot Library'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => void refreshAll()} disabled={isWorking} style={btnStyle(false, accent, isWorking)}>
              {isCapturing ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {isCapturing ? 'Capturing…' : 'Recapture'}
            </button>
            <button type="button" onClick={() => invoke('fs_open_file', { path: screenshotDir }).catch(e => setError(String(e)))} style={btnStyle(false, accent)}>
              <FolderOpen size={13} /> Folder
            </button>
          </div>
        </div>

        {/* Status / error bar */}
        {(error || statusMsg) && (
          <div style={{ padding: '5px 10px', fontSize: 10, borderBottom: `1px solid ${BORDER}`, background: error ? 'rgba(127,29,29,0.28)' : `${accent}12`, color: error ? '#fca5a5' : '#e7ebff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>{error ?? statusMsg}</span>
            <button type="button" onClick={() => { setError(null); setStatusMsg(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, opacity: 0.7 }}>✕</button>
          </div>
        )}

        {/* Main panel */}
        {activeSection === 'tool' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            {toolContent}
            <ResizablePane
              size={libraryWidth}
              minSize={220}
              maxSize={480}
              onSizeChange={setLibraryWidth}
              borderColor={`${accent}44`}
              handleSide="left"
              style={{ borderLeft: `1px solid ${BORDER}`, background: PANEL }}
            >
              {libraryContent}
            </ResizablePane>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>{libraryContent}</div>
        )}
      </div>

      <style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RailButton({ active, label, accent, onClick, children }: {
  active: boolean; label: string; accent: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} style={{
      width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 12, border: `1px solid ${active ? `${accent}88` : BORDER}`,
      background: active ? `${accent}18` : 'rgba(255,255,255,0.02)',
      color: active ? '#f4f6ff' : MUTED, cursor: 'pointer',
    }}>
      {children}
    </button>
  );
}

function btnStyle(primary: boolean, accent: string, disabled = false): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 9px', borderRadius: 7, fontSize: 10.5, fontWeight: 600,
    border: `1px solid ${primary ? accent : BORDER}`,
    background: disabled ? 'rgba(255,255,255,0.04)' : primary ? `${accent}22` : 'rgba(255,255,255,0.03)',
    color: disabled ? 'rgba(255,255,255,0.35)' : primary ? '#f4f5ff' : '#cdd0ee',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function annBtn(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
    border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.03)',
    color: MUTED,
  };
}

export default ScreenshotsManager;
