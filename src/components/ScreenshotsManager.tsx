import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
} from '@/components/AppIcons';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import { useSettingsStore } from '../store/settingsStore';
import { screenshotFeatureConfig } from '../config/screenshots';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  getSelectionHandleAtPoint,
  isPointInSelection,
  moveSelection,
  isSupportedScreenshotEntry,
  normalizeSelection,
  resizeSelection,
  selectionToPixelRect,
  sortScreenshotEntries,
  type Point2D,
  type RectSelection,
  type SelectionHandle,
  type ScreenshotEntryLike,
} from './screenshotsUtils';
import { OverlayScrollArea } from './OverlayScrollArea';
import { AppConfirmDialog } from './AppModal';
import {
  createExplorerDir,
  deleteExplorerPath,
  listExplorerDir,
  openExplorerPath,
  revealExplorerPath,
} from '../runtime/explorerBackend';
import { commands, unwrapTauriResult } from '../runtime/tauriClient';

// ─── Annotation types ─────────────────────────────────────────────────────────

type AnnotationTool = 'select' | 'rect' | 'arrow' | 'text';

type RectAnnotation  = { type: 'rect';  x1: number; y1: number; x2: number; y2: number; color: string; lw: number; };
type ArrowAnnotation = { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; };
type TextAnnotation  = { type: 'text';  x:  number; y:  number; text: string; color: string; size: number; };
type Annotation = RectAnnotation | ArrowAnnotation | TextAnnotation;

type NativeScreenshotRegion = { x: number; y: number; width: number; height: number };
type NativeScreenshotAnnotation =
  | { type: 'rect'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; lw: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number };

type SelectionInteraction =
  | { kind: 'draw'; origin: Point2D }
  | { kind: 'move'; origin: Point2D; initialSelection: RectSelection }
  | { kind: 'resize'; origin: Point2D; initialSelection: RectSelection; handle: Exclude<SelectionHandle, 'move'> };

const ANNOTATION_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#ec4899','#f1f5f9'];
const SELECTION_HANDLE_RADIUS = 8;
const SELECTION_HANDLE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type FileEntry = ScreenshotEntryLike & {
  size: number;
  is_hidden?: boolean;
  is_symlink?: boolean;
};

type ScreenshotItem = FileEntry & { previewUrl: string | null };

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
    await listExplorerDir(path, false);
  } catch {
    await createExplorerDir(path);
  }
}

function toMonitorCapture(monitor: TauriMonitor, activeId: string | null): MonitorCapture {
  const sf = monitor.scaleFactor || 1;
  const logicalWidth  = Math.round(monitor.size.width  / sf);
  const logicalHeight = Math.round(monitor.size.height / sf);
  const logicalX = Math.round(monitor.position.x / sf);
  const logicalY = Math.round(monitor.position.y / sf);
  const id = [monitor.name ?? 'display', monitor.position.x, monitor.position.y, monitor.size.width, monitor.size.height].join(':');
  const displayName = monitor.name?.trim() || 'Display';
  return {
    id,
    label: `${displayName} · ${logicalWidth}×${logicalHeight}`,
    logicalX,
    logicalY,
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

function scalePreviewPointToImage(
  point: Point2D,
  rendered: { width: number; height: number },
  image: { width: number; height: number },
): Point2D {
  return {
    x: Math.round(point.x * (image.width / rendered.width)),
    y: Math.round(point.y * (image.height / rendered.height)),
  };
}

function annotationToImageSpace(
  annotation: Annotation,
  rendered: { width: number; height: number },
  image: { width: number; height: number },
): NativeScreenshotAnnotation {
  if (annotation.type === 'text') {
    const origin = scalePreviewPointToImage({ x: annotation.x, y: annotation.y }, rendered, image);
    return {
      type: 'text',
      x: origin.x,
      y: origin.y,
      text: annotation.text,
      color: annotation.color,
      size: Math.max(8, Math.round(annotation.size * (image.height / rendered.height))),
    };
  }

  const start = scalePreviewPointToImage({ x: annotation.x1, y: annotation.y1 }, rendered, image);
  const end = scalePreviewPointToImage({ x: annotation.x2, y: annotation.y2 }, rendered, image);
  const lineScale = Math.max(image.width / rendered.width, image.height / rendered.height);

  return {
    ...annotation,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    lw: Math.max(1, Math.round(annotation.lw * lineScale)),
  };
}

function getSelectionHandleLayout(selection: RectSelection) {
  const normalized = normalizeSelection(selection);
  const left = normalized.x;
  const right = normalized.x + normalized.width;
  const top = normalized.y;
  const bottom = normalized.y + normalized.height;
  const centerX = left + normalized.width / 2;
  const centerY = top + normalized.height / 2;

  return [
    { handle: 'north-west', x: left, y: top },
    { handle: 'north', x: centerX, y: top },
    { handle: 'north-east', x: right, y: top },
    { handle: 'east', x: right, y: centerY },
    { handle: 'south-east', x: right, y: bottom },
    { handle: 'south', x: centerX, y: bottom },
    { handle: 'south-west', x: left, y: bottom },
    { handle: 'west', x: left, y: centerY },
  ] as const;
}

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
  const selectionInteractionRef = useRef<SelectionInteraction | null>(null);

  // Cached at pointerDown — never re-read during a drag
  const dragRectRef   = useRef<DOMRect | null>(null);
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
  const [pendingDeleteItem, setPendingDeleteItem] = useState<ScreenshotItem | null>(null);
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
  }, []);

  const replaceGalleryItems = useCallback((nextItems: ScreenshotItem[]) => {
    setItems(nextItems);
  }, []);

  const replaceMonitors = useCallback((nextMonitors: MonitorCapture[]) => {
    setMonitors(nextMonitors);
  }, []);

  const resetEditorState = useCallback(() => {
    setSelection(null);
    selectionInteractionRef.current = null;
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

    if (openLibrary) {
      setActiveSection('library');
    }
    resetEditorState();
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

  const handlePreviewKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (textDraft && event.key === 'Escape') {
      event.preventDefault();
      setTextDraft(null);
      setTextValue('');
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 2 || rect.height < 2) {
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setSelection({
        x: 0,
        y: 0,
        width: rect.width,
        height: rect.height,
      });
      return;
    }

    if (!selection || activeTool !== 'select') {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelection(null);
      }
      return;
    }

    const rendered = { width: rect.width, height: rect.height };
    const step = event.shiftKey
      ? screenshotFeatureConfig.editor.keyboardLargeNudgeStep
      : screenshotFeatureConfig.editor.keyboardNudgeStep;

    if (event.key === 'Escape') {
      event.preventDefault();
      setSelection(null);
      return;
    }

    if (event.altKey) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelection(resizeSelection(selection, 'west', -step, 0, rendered));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelection(resizeSelection(selection, 'east', step, 0, rendered));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelection(resizeSelection(selection, 'north', 0, -step, rendered));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelection(resizeSelection(selection, 'south', 0, step, rendered));
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSelection(moveSelection(selection, -step, 0, rendered));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSelection(moveSelection(selection, step, 0, rendered));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelection(moveSelection(selection, 0, -step, rendered));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelection(moveSelection(selection, 0, step, rendered));
    }
  }, [activeTool, selection, textDraft]);

  // ── Gallery ──
  const loadGallery = useCallback(async () => {
    const requestId = galleryRequestIdRef.current + 1;
    galleryRequestIdRef.current = requestId;

    try {
      await ensureDir(screenshotDir);
      const listed = await listExplorerDir(screenshotDir, false);
      const entries = sortScreenshotEntries(listed.filter(isSupportedScreenshotEntry));
      const visible = entries.slice(0, screenshotFeatureConfig.maxGalleryItems);

      const withPreviews = shouldLoadGalleryPreviews
        ? await Promise.all(
            visible.map(async entry => {
              try {
                const previewDataUrl = await commands.screenshotReadGalleryThumbnail(
                  entry.path,
                  screenshotFeatureConfig.galleryThumbnail.maxWidth,
                  screenshotFeatureConfig.galleryThumbnail.maxHeight,
                ).then(unwrapTauriResult);
                return { ...entry, previewUrl: previewDataUrl };
              } catch {
                return { ...entry, previewUrl: null };
              }
            }),
          )
        : visible.map(entry => ({ ...entry, previewUrl: null }));

      if (requestId !== galleryRequestIdRef.current) {
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
        const preview = await commands.screenshotCapturePreview(
          mon.physicalX,
          mon.physicalY,
          mon.physicalWidth,
          mon.physicalHeight,
        ).then(unwrapTauriResult);
        results.push({
          ...mon,
          captureId: preview.captureId,
          previewUrl: preview.previewUrl,
          imageWidth: preview.imageWidth,
          imageHeight: preview.imageHeight,
        });
      }

      if (requestId !== captureRequestIdRef.current) {
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
    selectionInteractionRef.current = null;
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
    e.currentTarget.focus();
    if ('setPointerCapture' in e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function') {
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    if (activeTool === 'select') {
      e.preventDefault();
      const existingSelection = selection ? normalizeSelection(selection) : null;
      const existingHandle = existingSelection
        ? getSelectionHandleAtPoint({ x, y }, existingSelection, SELECTION_HANDLE_RADIUS)
        : null;

      if (existingSelection && existingHandle && existingHandle !== 'move') {
        selectionInteractionRef.current = {
          kind: 'resize',
          origin: { x, y },
          initialSelection: existingSelection,
          handle: existingHandle,
        };
        setSelection(existingSelection);
        return;
      }

      if (existingSelection && isPointInSelection({ x, y }, existingSelection)) {
        selectionInteractionRef.current = {
          kind: 'move',
          origin: { x, y },
          initialSelection: existingSelection,
        };
        setSelection(existingSelection);
        return;
      }

      selectionInteractionRef.current = { kind: 'draw', origin: { x, y } };
      setSelection({ x, y, width: 0, height: 0 });
    } else if (activeTool === 'text') {
      selectionInteractionRef.current = null;
      setTextDraft({ x, y });
      setTextValue('');
      window.requestAnimationFrame(() => textInputRef.current?.focus());
    } else {
      e.preventDefault();
      selectionInteractionRef.current = { kind: 'draw', origin: { x, y } };
      const live: Annotation = activeTool === 'rect'
        ? { type: 'rect',  x1: x, y1: y, x2: x, y2: y, color: annColor, lw: annLw }
        : { type: 'arrow', x1: x, y1: y, x2: x, y2: y, color: annColor, lw: annLw };
      liveAnnotationRef.current = live;
      setLiveAnnotation(live);
    }
  }, [activeMonitor, isCapturing, activeTool, annColor, annLw, getContainerPos, selection]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect   = dragRectRef.current;
    if (!rect || !isDraggingRef.current) return;
    e.preventDefault();

    // Use the CACHED rect from pointerDown — never re-measure during drag
    const { x, y } = getContainerPos(e.clientX, e.clientY, rect);

    if (activeTool === 'select') {
      const interaction = selectionInteractionRef.current;
      if (!interaction) {
        return;
      }

      if (interaction.kind === 'draw') {
        const raw: RectSelection = {
          x: interaction.origin.x,
          y: interaction.origin.y,
          width: clamp(x - interaction.origin.x, -interaction.origin.x, rect.width - interaction.origin.x),
          height: clamp(y - interaction.origin.y, -interaction.origin.y, rect.height - interaction.origin.y),
        };
        setSelection(raw);
        return;
      }

      const rendered = { width: rect.width, height: rect.height };
      const deltaX = x - interaction.origin.x;
      const deltaY = y - interaction.origin.y;

      if (interaction.kind === 'move') {
        setSelection(moveSelection(interaction.initialSelection, deltaX, deltaY, rendered));
        return;
      }

      setSelection(
        resizeSelection(
          interaction.initialSelection,
          interaction.handle,
          deltaX,
          deltaY,
          rendered,
        ),
      );
    } else if (activeTool === 'rect' || activeTool === 'arrow') {
      const interaction = selectionInteractionRef.current;
      const origin = interaction?.kind === 'draw' ? interaction.origin : null;
      if (!origin) {
        return;
      }
      const live: Annotation = activeTool === 'rect'
        ? { type: 'rect',  x1: origin.x, y1: origin.y, x2: x, y2: y, color: annColor, lw: annLw }
        : { type: 'arrow', x1: origin.x, y1: origin.y, x2: x, y2: y, color: annColor, lw: annLw };
      // Update ref synchronously so ResizeObserver always has current state
      liveAnnotationRef.current = live;
      setLiveAnnotation(live);
    }
  }, [activeTool, annColor, annLw, getContainerPos]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (
      'hasPointerCapture' in e.currentTarget
      && typeof e.currentTarget.hasPointerCapture === 'function'
      && e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    isDraggingRef.current = false;
    dragRectRef.current   = null;
    selectionInteractionRef.current = null;

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
      const saved = await commands.screenshotSaveRegion(
        activeMonitor.captureId,
        norm.x,
        norm.y,
        norm.width,
        norm.height,
        screenshotDir,
        screenshotFeatureConfig.filePrefix,
        copyToo,
      ).then(unwrapTauriResult);
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
      unwrapTauriResult(await commands.screenshotCopyRegionToClipboard(
        activeMonitor.captureId,
        norm.x,
        norm.y,
        norm.width,
        norm.height,
      ));
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
        unwrapTauriResult(await commands.screenshotCopyRegionToClipboard(
          activeMonitor.captureId,
          0,
          0,
          w,
          h,
        ));
        setStatusMsg('Full monitor copied.');
        finishToolAction(false);
      } catch (err) { setError(String(err)); }
      finally { setIsCopying(false); }
    } else {
      setIsSaving(true);
      try {
        await ensureDir(screenshotDir);
        const saved = await commands.screenshotSaveRegion(
          activeMonitor.captureId,
          0,
          0,
          w,
          h,
          screenshotDir,
          screenshotFeatureConfig.filePrefix,
          action === 'save-copy',
        ).then(unwrapTauriResult);
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
      unwrapTauriResult(await commands.screenshotCopyImageToClipboard(item.path));
      setCopiedPath(item.path);
      setStatusMsg(`Copied ${item.name}.`);
    } catch (err) { setError(String(err)); }
    finally { setCopyingPath(null); }
  }, []);

  const requestDeleteGalleryItem = useCallback((item: ScreenshotItem) => {
    if (deletingPath) {
      return;
    }
    setPendingDeleteItem(item);
  }, [deletingPath]);

  const closeDeleteDialog = useCallback(() => {
    setPendingDeleteItem(null);
  }, []);

  const deleteGalleryItem = useCallback(async () => {
    const item = pendingDeleteItem;
    if (deletingPath || !item) {
      closeDeleteDialog();
      return;
    }
    closeDeleteDialog();
    setDeletingPath(item.path);
    setError(null);
    try {
      await deleteExplorerPath(item.path, false);
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
  }, [closeDeleteDialog, copiedPath, copyingPath, deletingPath, loadGallery, pendingDeleteItem]);

  const isWorking = isCapturing || isSaving || isCopying;
  const normalizedSel = selection ? normalizeSelection(selection) : null;
  const hasSelection = normalizedSel && normalizedSel.width >= 4 && normalizedSel.height >= 4;
  const hasAnnotations = annotations.length > 0;

  // ── Save annotated ──
  const runAnnotatedOutputAction = useCallback(async (action: ScreenshotOutputActionId) => {
    const container = containerRef.current;
    if (!container || !activeMonitor?.captureId) return;
    setError(null);
    if (action === 'copy') {
      setIsCopying(true);
    } else {
      setIsSaving(true);
    }
    try {
      const rendered = container.getBoundingClientRect();
      const renderedSize = { width: rendered.width, height: rendered.height };
      const imageSize = { width: activeMonitor.imageWidth, height: activeMonitor.imageHeight };
      const nativeAnnotations = annotations.map(annotation => annotationToImageSpace(annotation, renderedSize, imageSize));
      const selectionRegion: NativeScreenshotRegion | null = selection
        ? selectionToPixelRect(normalizeSelection(selection), renderedSize, imageSize)
        : null;

      const exportResult = await commands.screenshotExportAnnotated(
        activeMonitor.captureId,
        selectionRegion,
        nativeAnnotations,
        action === 'copy' ? null : screenshotDir,
        action === 'copy' ? null : screenshotFeatureConfig.filePrefix,
        action !== 'save',
      ).then(unwrapTauriResult);

      if (action !== 'copy') {
        await loadGallery();
      }

      const fileName = exportResult.saved?.file_name ?? null;
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
  }, [activeMonitor, annotations, finishToolAction, screenshotDir, loadGallery, selection]);

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
            tabIndex={0}
            aria-label="Screenshot editor preview"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handlePreviewKeyDown}
            style={{
              position: 'relative',
              alignSelf: 'stretch',
              width: 'auto',
              height: '100%',
              // Use explicit max constraints so the container never overflows its parent
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${activeMonitor.imageWidth} / ${activeMonitor.imageHeight}`,
              borderRadius: 10,
              overflow: 'hidden',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: activeTool === 'text'
                ? 'text'
                : isCapturing
                  ? 'wait'
                  : activeTool === 'select' && hasSelection
                    ? 'move'
                    : 'crosshair',
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
                {getSelectionHandleLayout(normalizedSel).map(handle => (
                  <div
                    key={handle.handle}
                    style={{
                      position: 'absolute',
                      left: handle.x - SELECTION_HANDLE_SIZE / 2,
                      top: handle.y - SELECTION_HANDLE_SIZE / 2,
                      width: SELECTION_HANDLE_SIZE,
                      height: SELECTION_HANDLE_SIZE,
                      borderRadius: 999,
                      background: '#f8fbff',
                      border: `2px solid ${accent}`,
                      boxShadow: '0 1px 6px rgba(0,0,0,0.45)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}
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
                <div
                  style={{
                    position: 'absolute',
                    left: normalizedSel.x + 10,
                    top: Math.max(normalizedSel.y - 28, 8),
                    pointerEvents: 'none',
                    background: 'rgba(5,8,15,0.92)',
                    border: `1px solid ${accent}44`,
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#dce3ff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Drag to move · drag handles to resize · arrows to nudge · Alt+arrows to resize
                </div>
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
                      <button type="button" onClick={() => revealExplorerPath(item.path).catch(e => setError(String(e)))} disabled={isDeleting} style={btnStyle(false, accent, isDeleting)}>
                        <Search size={10} /> Reveal
                      </button>
                      <button type="button" onClick={() => openExplorerPath(item.path).catch(e => setError(String(e)))} disabled={isDeleting} style={btnStyle(false, accent, isDeleting)}>
                        <ExternalLink size={10} /> Open
                      </button>
                      <button type="button" onClick={() => requestDeleteGalleryItem(item)} disabled={isDeleting} style={btnStyle(false, accent, isDeleting)}>
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
            <button type="button" onClick={() => openExplorerPath(screenshotDir).catch(e => setError(String(e)))} style={btnStyle(false, accent)}>
              <FolderOpen size={13} /> Folder
            </button>
          </div>
        </div>

        {/* Status / error bar */}
        {(error || statusMsg) && (
          <div style={{ padding: '5px 10px', fontSize: 10, borderBottom: `1px solid ${BORDER}`, background: error ? 'rgba(127,29,29,0.28)' : `${accent}12`, color: error ? '#fca5a5' : '#e7ebff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <span>{error ?? statusMsg}</span>
            </div>
            {(error || statusMsg) && (
              <button type="button" onClick={() => { setError(null); setStatusMsg(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, opacity: 0.7 }}>✕</button>
            )}
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

      <AppConfirmDialog
        open={pendingDeleteItem !== null}
        title="Delete Screenshot"
        description={pendingDeleteItem ? `Delete ${pendingDeleteItem.name} from the screenshot library?` : ''}
        icon={<Trash2 size={16} style={{ color: '#f87171' }} />}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => { void deleteGalleryItem(); }}
        onCancel={closeDeleteDialog}
      />

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
