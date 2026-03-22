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
  RefreshCw,
  Save,
  Search,
  Maximize2,
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

  const previewRef    = useRef<HTMLDivElement | null>(null);
  const dragStateRef  = useRef<{ origin: Point2D; selection: RectSelection; pointerId: number } | null>(null);

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

  // ── Derived selection in image-space (physical pixels) ──
  const selectionPx = (() => {
    if (!selection || !activeMonitor || !previewRef.current) return null;
    const rect = previewRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return selectionToPixelRect(
      normalizeSelection(selection),
      { width: rect.width, height: rect.height },
      { width: activeMonitor.imageWidth, height: activeMonitor.imageHeight },
    );
  })();

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

  // ── Selection drag on preview ──
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMonitor?.captureId || isCapturing) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const origin: Point2D = {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top,  0, rect.height),
    };
    const ds = { origin, selection: { x: origin.x, y: origin.y, width: 0, height: 0 }, pointerId: e.pointerId };
    dragStateRef.current = ds;
    setSelection(ds.selection);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [activeMonitor, isCapturing]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds || !previewRef.current) return;
    e.preventDefault();
    const rect = previewRef.current.getBoundingClientRect();
    const point: Point2D = {
      x: clamp(e.clientX - rect.left, 0, rect.width),
      y: clamp(e.clientY - rect.top,  0, rect.height),
    };
    const next = clampSelectionToBounds(
      { x: ds.origin.x, y: ds.origin.y, width: point.x - ds.origin.x, height: point.y - ds.origin.y },
      { width: rect.width, height: rect.height }, 1,
    );
    dragStateRef.current = { ...ds, selection: next };
    setSelection(next);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds) return;
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
    // selection stays — user confirms with action buttons
  }, []);

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

  // ─── Tool content ──────────────────────────────────────────────────────────

  const toolContent = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Monitor tabs */}
      {monitors.length > 0 && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, background: PANEL, flexWrap: 'wrap' }}>
          {monitors.map((mon, i) => {
            const active = mon.id === activeMonitorId;
            return (
              <button
                key={mon.id}
                type="button"
                onClick={() => { setActiveMonitorId(mon.id); setSelection(null); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${active ? `${accent}88` : BORDER}`,
                  background: active ? `${accent}20` : 'rgba(255,255,255,0.03)',
                  color: active ? '#f4f6ff' : MUTED,
                  cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
                }}
              >
                <Monitor size={11} style={{ flexShrink: 0 }} />
                Display {i + 1}
                {mon.isActive && (
                  <span style={{ padding: '1px 5px', borderRadius: 999, background: `${accent}20`, border: `1px solid ${accent}44`, fontSize: 9, color: accent }}>
                    Active
                  </span>
                )}
              </button>
            );
          })}
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
          <div
            style={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${activeMonitor.imageWidth} / ${activeMonitor.imageHeight}`,
              borderRadius: 10,
              overflow: 'hidden',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: isCapturing ? 'wait' : 'crosshair',
            }}
          >
            {/* Screenshot preview */}
            <img
              src={activeMonitor.previewUrl ?? ''}
              alt={activeMonitor.label}
              draggable={false}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'fill', userSelect: 'none', pointerEvents: 'none' }}
            />

            {/* Drag surface */}
            <div
              ref={previewRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
            />

            {/* Selection overlay */}
            {normalizedSel && normalizedSel.width >= 2 && normalizedSel.height >= 2 && (
              <>
                {/* Dimmed regions */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.48)', pointerEvents: 'none' }} />
                {/* Bright selection hole */}
                <div style={{
                  position: 'absolute',
                  left: normalizedSel.x, top: normalizedSel.y,
                  width: normalizedSel.width, height: normalizedSel.height,
                  boxShadow: `0 0 0 9999px rgba(0,0,0,0.48)`,
                  border: `2px solid ${accent}`,
                  outline: '1px solid rgba(255,255,255,0.35)',
                  pointerEvents: 'none',
                }} />
                {/* Dimension badge */}
                {selectionPx && (
                  <div style={{
                    position: 'absolute',
                    left: normalizedSel.x + normalizedSel.width / 2,
                    top: normalizedSel.y + normalizedSel.height + 6,
                    transform: 'translateX(-50%)',
                    background: 'rgba(5,8,15,0.92)',
                    border: `1px solid ${accent}55`,
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#e8ecff',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    fontFamily: 'var(--overlay-font-mono, monospace)',
                  }}>
                    {normalizeSelection(selectionPx).width} × {normalizeSelection(selectionPx).height} px
                  </div>
                )}
              </>
            )}

            {/* Saving spinner */}
            {isSaving && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.6)' }}>
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
            <span style={{ fontSize: 10, color: MUTED, marginRight: 2 }}>Selection:</span>
            <button type="button" onClick={() => void doCopy()} disabled={isWorking} style={btnStyle(false, accent, isWorking)}>
              {isCopying ? <LoaderCircle size={11} className="animate-spin" /> : <Copy size={11} />}
              Copy
            </button>
            <button type="button" onClick={() => void doSave(false)} disabled={isWorking} style={btnStyle(false, accent, isWorking)}>
              {isSaving ? <LoaderCircle size={11} className="animate-spin" /> : <Save size={11} />}
              Save
            </button>
            <button type="button" onClick={() => void doSave(true)} disabled={isWorking} style={btnStyle(true, accent, isWorking)}>
              {isSaving ? <LoaderCircle size={11} className="animate-spin" /> : <Check size={11} />}
              Save + Copy
            </button>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setSelection(null)} style={btnStyle(false, accent)} title="Clear selection">
              ✕ Clear
            </button>
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

export default ScreenshotsManager;
