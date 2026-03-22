import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
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
  clampSelectionToBounds,
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

type MonitorCapture = {
  id: string;
  label: string;
  // logical coordinates for layout
  logicalX: number;
  logicalY: number;
  logicalWidth: number;
  logicalHeight: number;
  // physical for capture commands
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

async function withHiddenWindowCapture<T>(task: () => Promise<T>): Promise<T> {
  const win = getCurrentWindow();
  await win.hide();
  await new Promise(resolve => window.setTimeout(resolve, screenshotFeatureConfig.editor.hideWindowDelayMs));
  try {
    return await task();
  } finally {
    await win.show().catch(() => {});
    await win.setFocus().catch(() => {});
  }
}

function toMonitorCapture(monitor: TauriMonitor, activeId: string | null): MonitorCapture {
  const sf = monitor.scaleFactor || 1;
  // Tauri gives physical pixels for size, logical for position
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScreenshotsManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const screenshotDir = useSettingsStore(s => s.settings.screenshots.saveDirectory || screenshotFeatureConfig.defaultSaveDirectory);

  // ── Drag + annotation refs ──
  // containerRef is the SINGLE coordinate origin: both events and absolute
  // positioned overlays (selection, canvas) use this element's rect.
  const containerRef    = useRef<HTMLDivElement | null>(null);
  const canvasRef       = useRef<HTMLCanvasElement | null>(null);
  const textInputRef    = useRef<HTMLInputElement | null>(null);
  // DOMRect is cached at pointerDown so layout shifts during drag can't cause jumps.
  const dragRectRef     = useRef<DOMRect | null>(null);
  const dragOriginRef   = useRef<Point2D | null>(null);
  const liveAnnRef      = useRef<Annotation | null>(null);

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
  const [libraryWidth, setLibraryWidth] = usePersistentPanelSize('overlayterm-screenshots-library-width', 280, 220, 480);

  const activeMonitor = monitors.find(m => m.id === activeMonitorId) ?? null;

  // Derived selection mapped to full physical pixel space for Rust commands.
  // Re-compute from ref so action callbacks always see the current container size.
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
    try {
      await ensureDir(screenshotDir);
      const listed = await invoke<FileEntry[]>('fs_list_dir', { path: screenshotDir, showHidden: false });
      const entries = sortScreenshotEntries(listed.filter(isSupportedScreenshotEntry));
      const visible = entries.slice(0, screenshotFeatureConfig.maxGalleryItems);
      const withPreviews = await Promise.all(
        visible.map(async entry => {
          try {
            const previewUrl = await invoke<string>('screenshot_read_gallery_thumbnail', {
              path: entry.path,
              maxWidth: screenshotFeatureConfig.galleryThumbnail.maxWidth,
              maxHeight: screenshotFeatureConfig.galleryThumbnail.maxHeight,
            });
            return { ...entry, previewUrl };
          } catch {
            return { ...entry, previewUrl: null };
          }
        }),
      );
      setItems(withPreviews);
      setVisibleCount(visible.length);
      setTotalCount(entries.length);
    } catch (err) {
      setError(String(err));
      setItems([]);
    }
  }, [screenshotDir]);

  // ── Capture all monitors ──
  const captureMonitors = useCallback(async () => {
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

      const captured: MonitorCapture[] = await withHiddenWindowCapture(async () => {
        const results: MonitorCapture[] = [];
        for (const mon of base) {
          const preview = await invoke<ScreenshotPreviewPayload>('screenshot_capture_preview', {
            x: mon.physicalX,
            y: mon.physicalY,
            width: mon.physicalWidth,
            height: mon.physicalHeight,
          });
          results.push({ ...mon, captureId: preview.captureId, previewUrl: preview.previewUrl, imageWidth: preview.imageWidth, imageHeight: preview.imageHeight });
        }
        return results;
      });

      setMonitors(captured);
      const firstActive = captured.find(m => m.isActive) ?? captured[0] ?? null;
      setActiveMonitorId(firstActive?.id ?? null);
      setStatusMsg(`Captured ${captured.length} display${captured.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      setError(String(err));
      setMonitors([]);
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([captureMonitors(), loadGallery()]);
  }, [captureMonitors, loadGallery]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

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
  // ── Reset annotations when switching monitors ──
  useEffect(() => {
    setAnnotations([]);
    setLiveAnnotation(null);
    setTextDraft(null);
    setTextValue('');
    liveAnnRef.current = null;
  }, [activeMonitorId]);

  // ── Canvas redraw ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    [...annotations, ...(liveAnnotation ? [liveAnnotation] : [])].forEach(ann => drawAnnotation(ctx, ann));
  }, [annotations, liveAnnotation]);

  // Keep canvas pixel dimensions in sync with container CSS size
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      canvas.width  = r.width;
      canvas.height = r.height;
      // re-trigger draw after resize
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        [...annotations, ...(liveAnnotation ? [liveAnnotation] : [])].forEach(ann => drawAnnotation(ctx, ann));
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current, canvasRef.current]);


  // ── Pointer events — all on the container, rect cached at pointerDown ──
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMonitor?.captureId || isCapturing) return;
    // Capture the rect NOW and cache it for the entire drag
    const rect = e.currentTarget.getBoundingClientRect();
    dragRectRef.current = rect;
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top,  0, rect.height);
    dragOriginRef.current = { x, y };
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === 'select') {
      e.preventDefault();
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
      liveAnnRef.current = live;
      setLiveAnnotation(live);
    }
  }, [activeMonitor, isCapturing, activeTool, annColor, annLw]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = dragRectRef.current;
    const origin = dragOriginRef.current;
    if (!rect || !origin) return;
    e.preventDefault();
    // Always use the CACHED rect — never re-measure during a drag
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top,  0, rect.height);

    if (activeTool === 'select') {
      const next = clampSelectionToBounds(
        { x: origin.x, y: origin.y, width: x - origin.x, height: y - origin.y },
        { width: rect.width, height: rect.height }, 1,
      );
      setSelection(next);
    } else if (activeTool === 'rect' || activeTool === 'arrow') {
      const live: Annotation = activeTool === 'rect'
        ? { type: 'rect',  x1: origin.x, y1: origin.y, x2: x, y2: y, color: annColor, lw: annLw }
        : { type: 'arrow', x1: origin.x, y1: origin.y, x2: x, y2: y, color: annColor, lw: annLw };
      liveAnnRef.current = live;
      setLiveAnnotation(live);
    }
  }, [activeTool, annColor, annLw]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRectRef.current  = null;
    dragOriginRef.current = null;
    if (liveAnnRef.current) {
      setAnnotations(prev => [...prev, liveAnnRef.current!]);
      liveAnnRef.current = null;
      setLiveAnnotation(null);
    }
    // selection stays for confirm
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
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  }, [activeMonitor, selectionPx, screenshotDir, loadGallery]);

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
    } catch (err) {
      setError(String(err));
    } finally {
      setIsCopying(false);
    }
  }, [activeMonitor, selectionPx]);

  const doFullMonitor = useCallback(async (action: 'save' | 'copy' | 'save-copy') => {
    if (!activeMonitor?.captureId) return;
    const w = activeMonitor.imageWidth;
    const h = activeMonitor.imageHeight;
    if (action === 'copy') {
      setIsCopying(true);
      try {
        await invoke('screenshot_copy_region_to_clipboard', { captureId: activeMonitor.captureId, x: 0, y: 0, width: w, height: h });
        setStatusMsg('Full monitor copied.');
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
      } catch (err) { setError(String(err)); }
      finally { setIsSaving(false); }
    }
  }, [activeMonitor, screenshotDir, loadGallery]);

  const copyGalleryItem = useCallback(async (item: ScreenshotItem) => {
    setCopyingPath(item.path);
    try {
      await invoke('screenshot_copy_image_to_clipboard', { path: item.path });
      setCopiedPath(item.path);
      setStatusMsg(`Copied ${item.name}.`);
    } catch (err) { setError(String(err)); }
    finally { setCopyingPath(null); }
  }, []);

  const isWorking = isCapturing || isSaving || isCopying;
  const normalizedSel = selection ? normalizeSelection(selection) : null;
  const hasSelection = normalizedSel && normalizedSel.width >= 4 && normalizedSel.height >= 4;
  const hasAnnotations = annotations.length > 0;

  // ── Save annotated (canvas composite → blob → fs_write_file) ──
  const doSaveAnnotated = useCallback(async (copyToo: boolean) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !activeMonitor) return;
    setIsSaving(true);
    try {
      const img = document.createElement('img');
      img.src = activeMonitor.previewUrl ?? '';
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
      const out = document.createElement('canvas');
      out.width = img.naturalWidth; out.height = img.naturalHeight;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      // Scale annotations from container CSS px → preview image px
      const scaleX = img.naturalWidth  / container.getBoundingClientRect().width;
      const scaleY = img.naturalHeight / container.getBoundingClientRect().height;
      ctx.save(); ctx.scale(scaleX, scaleY);
      [...annotations].forEach(ann => drawAnnotation(ctx, ann));
      ctx.restore();
      // Crop to selection if active
      const px = getSelectionPx();
      // Map from full imageWidth/imageHeight to preview dimensions (preview is downscaled)
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
      const buf = await blob.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buf));
      await ensureDir(screenshotDir);
      const ts = Date.now();
      const fileName = `${screenshotFeatureConfig.filePrefix}-${ts}.png`;
      const fullPath = `${screenshotDir}\\${fileName}`;
      await invoke('fs_write_file', { path: fullPath, content: bytes });
      if (copyToo) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
      }
      await loadGallery();
      setStatusMsg(`Saved annotated: ${fileName}${copyToo ? ' & copied' : ''}.`);
    } catch (err) { setError(String(err)); }
    finally { setIsSaving(false); }
  }, [activeMonitor, annotations, screenshotDir, loadGallery, getSelectionPx]);


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

      {/* Annotation toolbar — only when capture is ready */}
      {activeMonitor?.captureId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexWrap: 'wrap' }}>
          {([['select','Select'],[`rect`,'Rectangle'],[`arrow`,'Arrow'],[`text`,'Text']] as const).map(([tool, label]) => {
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, background: 'var(--overlay-bg-shell)' }}>
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
          // ── Container is the SINGLE coordinate origin for events + overlays
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'relative', maxWidth: '100%', maxHeight: '100%',
              aspectRatio: `${activeMonitor.imageWidth} / ${activeMonitor.imageHeight}`,
              borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: activeTool === 'text' ? 'text' : isCapturing ? 'wait' : 'crosshair',
              touchAction: 'none',
            }}
          >
            <img src={activeMonitor.previewUrl ?? ''} alt={activeMonitor.label} draggable={false}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'fill', userSelect: 'none', pointerEvents: 'none' }} />

            {/* Annotation canvas */}
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

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

            {/* Selection overlay (only in select mode) */}
            {activeTool === 'select' && normalizedSel && normalizedSel.width >= 2 && normalizedSel.height >= 2 && (
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.46)', pointerEvents: 'none' }} />
                <div style={{
                  position: 'absolute',
                  left: normalizedSel.x, top: normalizedSel.y,
                  width: normalizedSel.width, height: normalizedSel.height,
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
            <span style={{ fontSize: 10, color: MUTED, marginRight: 2 }}>Region:</span>
            <button type="button" onClick={() => void doCopy()} disabled={isWorking} style={btnStyle(false, accent, isWorking)}>
              {isCopying ? <LoaderCircle size={11} className="animate-spin" /> : <Copy size={11} />} Copy
            </button>
            <button type="button" onClick={() => void doSave(false)} disabled={isWorking} style={btnStyle(false, accent, isWorking)}>
              {isSaving ? <LoaderCircle size={11} className="animate-spin" /> : <Save size={11} />} Save
            </button>
            <button type="button" onClick={() => void doSave(true)} disabled={isWorking} style={btnStyle(true, accent, isWorking)}>
              {isSaving ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />} Save+Copy
            </button>
            {hasAnnotations && (
              <button type="button" onClick={() => void doSaveAnnotated(true)} disabled={isWorking} style={btnStyle(true, accent, isWorking)}>
                <Check size={11} /> Save Annotated
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setSelection(null)} style={btnStyle(false, accent)}>✕ Clear</button>
          </>
        ) : activeMonitor?.captureId ? (
          <>
            <span style={{ fontSize: 10, color: MUTED }}>Draw a selection, or:</span>
            <button type="button" onClick={() => void doFullMonitor('copy')} disabled={isWorking} style={btnStyle(false, accent, isWorking)}>
              <Copy size={11} /> Copy Screen
            </button>
            <button type="button" onClick={() => void doFullMonitor('save-copy')} disabled={isWorking} style={btnStyle(true, accent, isWorking)}>
              <Maximize2 size={11} /> Full Screen
            </button>
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
                      <button type="button" onClick={() => void copyGalleryItem(item)} style={btnStyle(true, accent, isCop)}>
                        {isCop ? <LoaderCircle size={10} className="animate-spin" /> : isCopd ? <Check size={10} /> : <Copy size={10} />}
                        {isCopd ? 'Copied' : 'Copy'}
                      </button>
                      <button type="button" onClick={() => invoke('fs_reveal_in_explorer', { path: item.path }).catch(e => setError(String(e)))} style={btnStyle(false, accent)}>
                        <Search size={10} /> Reveal
                      </button>
                      <button type="button" onClick={() => invoke('fs_open_file', { path: item.path }).catch(e => setError(String(e)))} style={btnStyle(false, accent)}>
                        <ExternalLink size={10} /> Open
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

// ─── Canvas drawing ────────────────────────────────────────────────────────────

function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
  ctx.save();
  if (ann.type === 'rect') {
    const a = ann as { x1: number; y1: number; x2: number; y2: number; color: string; lw: number };
    ctx.strokeStyle = a.color;
    ctx.lineWidth = a.lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(Math.min(a.x1, a.x2), Math.min(a.y1, a.y2), Math.abs(a.x2 - a.x1), Math.abs(a.y2 - a.y1));
    ctx.stroke();
  } else if (ann.type === 'arrow') {
    const a = ann as { x1: number; y1: number; x2: number; y2: number; color: string; lw: number };
    const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const head  = Math.max(12, a.lw * 4);
    ctx.strokeStyle = a.color;
    ctx.fillStyle   = a.color;
    ctx.lineWidth   = a.lw;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - head * Math.cos(angle - Math.PI / 6), a.y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(a.x2 - head * Math.cos(angle + Math.PI / 6), a.y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (ann.type === 'text') {
    const a = ann as { x: number; y: number; text: string; color: string; size: number };
    ctx.fillStyle    = a.color;
    ctx.font         = `700 ${a.size}px Inter, system-ui, sans-serif`;
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 4;
    ctx.fillText(a.text, a.x, a.y + a.size);
  }
  ctx.restore();
}

export default ScreenshotsManager;
