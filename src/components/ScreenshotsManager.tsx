import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
  Search,
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
  type MonitorBounds,
  type Point2D,
  type RectSelection,
  type ScreenshotEntryLike,
} from './screenshotsUtils';
import { OverlayScrollArea } from './OverlayScrollArea';

type FileEntry = ScreenshotEntryLike & {
  size: number;
  is_hidden?: boolean;
  is_symlink?: boolean;
};

type ScreenshotItem = FileEntry & {
  previewUrl: string | null;
};

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

type MonitorCapture = MonitorBounds & {
  id: string;
  label: string;
  scaleFactor: number;
  workAreaWidth: number;
  workAreaHeight: number;
  captureId: string | null;
  previewUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  isActive: boolean;
};

type DragState = {
  monitorId: string;
  pointerId: number;
  origin: Point2D;
  selection: RectSelection;
};

const PANEL = 'var(--overlay-bg-panel)';
const PANEL_ALT = 'var(--overlay-bg-panel-alt)';
const BORDER = 'var(--overlay-border)';
const MUTED = 'var(--overlay-text-muted)';
const TEXT = 'var(--overlay-text-primary)';

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

function toMonitorCapture(monitor: TauriMonitor, activeMonitorId: string | null): MonitorCapture {
  const id = [
    monitor.name ?? 'display',
    monitor.position.x,
    monitor.position.y,
    monitor.size.width,
    monitor.size.height,
  ].join(':');

  const displayName = monitor.name?.trim() || 'Display';
  return {
    id,
    label: `${displayName} · ${monitor.size.width}x${monitor.size.height}`,
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
    scaleFactor: monitor.scaleFactor,
    workAreaWidth: monitor.workArea.size.width,
    workAreaHeight: monitor.workArea.size.height,
    captureId: null,
    previewUrl: null,
    imageWidth: 0,
    imageHeight: 0,
    isActive: id === activeMonitorId,
  };
}

function formatFileSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_024 * 1_024) return `${(size / 1_024).toFixed(1)} KB`;
  return `${(size / (1_024 * 1_024)).toFixed(1)} MB`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ScreenshotsManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const screenshotDir = useSettingsStore(s => s.settings.screenshots.saveDirectory || screenshotFeatureConfig.defaultSaveDirectory);

  const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<DragState | null>(null);

  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [visibleGalleryCount, setVisibleGalleryCount] = useState(0);
  const [totalGalleryCount, setTotalGalleryCount] = useState(0);
  const [monitors, setMonitors] = useState<MonitorCapture[]>([]);
  const [activeSection, setActiveSection] = useState<'tool' | 'library'>('tool');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [savingMonitorId, setSavingMonitorId] = useState<string | null>(null);
  const [copyingPath, setCopyingPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libraryWidth, setLibraryWidth] = usePersistentPanelSize(
    'overlayterm-screenshots-library-width',
    300,
    240,
    520,
  );

  const wallBounds = useMemo(() => {
    if (monitors.length === 0) {
      return { minX: 0, minY: 0, width: 1, height: 1 };
    }

    const minX = Math.min(...monitors.map(monitor => monitor.x));
    const minY = Math.min(...monitors.map(monitor => monitor.y));
    const maxX = Math.max(...monitors.map(monitor => monitor.x + monitor.width));
    const maxY = Math.max(...monitors.map(monitor => monitor.y + monitor.height));

    return {
      minX,
      minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
    };
  }, [monitors]);

  const loadGallery = useCallback(async () => {
    try {
      await ensureDir(screenshotDir);
      const listed = await invoke<FileEntry[]>('fs_list_dir', { path: screenshotDir, showHidden: false });
      const screenshotEntries = sortScreenshotEntries(listed.filter(isSupportedScreenshotEntry));
      const visibleEntries = screenshotEntries.slice(0, screenshotFeatureConfig.maxGalleryItems);
      const previewUrls = await Promise.all(
        visibleEntries.map(async entry => {
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

      setItems(previewUrls);
      setVisibleGalleryCount(visibleEntries.length);
      setTotalGalleryCount(screenshotEntries.length);
    } catch (err) {
      setError(String(err));
      setItems([]);
      setVisibleGalleryCount(0);
      setTotalGalleryCount(0);
    }
  }, [screenshotDir]);

  const refreshMonitorWall = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const [available, activeMonitor, fallbackMonitor] = await Promise.all([
        availableMonitors(),
        currentMonitor(),
        primaryMonitor(),
      ]);

      const activeId = activeMonitor
        ? toMonitorCapture(activeMonitor, null).id
        : fallbackMonitor
          ? toMonitorCapture(fallbackMonitor, null).id
          : null;

      const baseMonitors = available.map(monitor => toMonitorCapture(monitor, activeId));

      const nextMonitors = await withHiddenWindowCapture(async () => {
        const captured: MonitorCapture[] = [];
        for (const monitor of baseMonitors) {
          const preview = await invoke<ScreenshotPreviewPayload>('screenshot_capture_preview', {
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
          });

          captured.push({
            ...monitor,
            captureId: preview.captureId,
            previewUrl: preview.previewUrl,
            imageWidth: preview.imageWidth,
            imageHeight: preview.imageHeight,
          });
        }

        return captured;
      });

      setMonitors(nextMonitors);
      setStatusMessage(`Loaded ${nextMonitors.length} monitor preview${nextMonitors.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(String(err));
      setMonitors([]);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([refreshMonitorWall(), loadGallery()]);
  }, [loadGallery, refreshMonitorWall]);

  useEffect(() => {
    void refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!copiedPath) return undefined;
    const timeout = window.setTimeout(() => setCopiedPath(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedPath]);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const clearMessages = useCallback(() => {
    setError(null);
    setStatusMessage(null);
  }, []);

  const updateDragSelection = useCallback((monitorId: string, clientX: number, clientY: number) => {
    const frame = previewRefs.current[monitorId];
    const currentDrag = dragStateRef.current;
    if (!frame || !currentDrag || currentDrag.monitorId !== monitorId) return;

    const rect = frame.getBoundingClientRect();
    const point = {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height),
    };

    const nextSelection = clampSelectionToBounds({
      x: currentDrag.origin.x,
      y: currentDrag.origin.y,
      width: point.x - currentDrag.origin.x,
      height: point.y - currentDrag.origin.y,
    }, { width: rect.width, height: rect.height }, 1);

    const nextDragState = {
      ...currentDrag,
      selection: nextSelection,
    };

    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }, []);

  const saveDragSelection = useCallback(async (monitorId: string) => {
    const currentDrag = dragStateRef.current;
    const frame = previewRefs.current[monitorId];
    const monitor = monitors.find(entry => entry.id === monitorId);
    if (!currentDrag || !frame || !monitor || !monitor.captureId) return;

    const normalized = normalizeSelection(currentDrag.selection);
    if (normalized.width < screenshotFeatureConfig.editor.minSelectionSize || normalized.height < screenshotFeatureConfig.editor.minSelectionSize) {
      dragStateRef.current = null;
      setDragState(null);
      return;
    }

    const rect = frame.getBoundingClientRect();
    const cropRect = selectionToPixelRect(
      normalized,
      { width: rect.width, height: rect.height },
      { width: monitor.imageWidth, height: monitor.imageHeight },
    );

    dragStateRef.current = null;
    setDragState(null);
    setSavingMonitorId(monitorId);
    setError(null);

    try {
      await ensureDir(screenshotDir);
      const saved = await invoke<SavedScreenshotPayload>('screenshot_save_region', {
        captureId: monitor.captureId,
        x: cropRect.x,
        y: cropRect.y,
        width: cropRect.width,
        height: cropRect.height,
        directory: screenshotDir,
        filePrefix: screenshotFeatureConfig.filePrefix,
        copyToClipboard: false,
      });
      await loadGallery();
      setStatusMessage(`Saved ${saved.file_name}.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSavingMonitorId(null);
    }
  }, [loadGallery, monitors, screenshotDir]);

  const copyScreenshot = useCallback(async (item: ScreenshotItem) => {
    setCopyingPath(item.path);
    setError(null);
    try {
      await invoke('screenshot_copy_image_to_clipboard', { path: item.path });
      setCopiedPath(item.path);
      setStatusMessage(`Copied ${item.name}.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setCopyingPath(null);
    }
  }, []);

  const activeDragMonitorId = dragState?.monitorId ?? null;
  const monitorWallContent = (
    <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 6 }}>
      {isRefreshing && monitors.length === 0 ? (
        <GalleryLoading accent={accent} label="Capturing displays..." />
      ) : monitors.length === 0 ? (
        <div style={emptyPanelStyle(accent)}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>No displays</div>
          <button type="button" onClick={() => void refreshWorkspace()} style={toolbarButtonStyle(true, accent)}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${wallBounds.width} / ${wallBounds.height}`, minHeight: 220, borderRadius: 12, border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          {monitors.map(monitor => {
            const left = ((monitor.x - wallBounds.minX) / wallBounds.width) * 100;
            const top = ((monitor.y - wallBounds.minY) / wallBounds.height) * 100;
            const width = (monitor.width / wallBounds.width) * 100;
            const height = (monitor.height / wallBounds.height) * 100;
            const dragSelection = activeDragMonitorId === monitor.id && dragState ? normalizeSelection(dragState.selection) : null;
            const isSaving = savingMonitorId === monitor.id;

            return (
              <div key={monitor.id} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, padding: 3 }}>
                <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 10, border: `1px solid ${monitor.isActive ? `${accent}88` : BORDER}`, background: PANEL_ALT, overflow: 'hidden', boxShadow: monitor.isActive ? `0 0 0 1px ${accent}55 inset` : 'none' }}>
                  <div style={{ position: 'absolute', inset: 0 }}>
                    {monitor.previewUrl ? (
                      <img src={monitor.previewUrl} alt={monitor.label} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none', userSelect: 'none' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}>
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </div>

                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.28))' }} />

                  <div
                    ref={node => {
                      previewRefs.current[monitor.id] = node;
                    }}
                    onPointerDown={(event) => {
                      if (isRefreshing || isSaving || !monitor.captureId) return;
                      event.preventDefault();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const origin = {
                        x: clamp(event.clientX - rect.left, 0, rect.width),
                        y: clamp(event.clientY - rect.top, 0, rect.height),
                      };
                      const nextDragState = {
                        monitorId: monitor.id,
                        pointerId: event.pointerId,
                        origin,
                        selection: { x: origin.x, y: origin.y, width: 0, height: 0 },
                      };
                      dragStateRef.current = nextDragState;
                      setDragState(nextDragState);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (dragStateRef.current?.monitorId !== monitor.id) return;
                      event.preventDefault();
                      updateDragSelection(monitor.id, event.clientX, event.clientY);
                    }}
                    onPointerUp={(event) => {
                      if (dragStateRef.current?.monitorId !== monitor.id) return;
                      event.preventDefault();
                      updateDragSelection(monitor.id, event.clientX, event.clientY);
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                      void saveDragSelection(monitor.id);
                    }}
                    onPointerCancel={(event) => {
                      if (dragStateRef.current?.monitorId !== monitor.id) return;
                      event.preventDefault();
                      dragStateRef.current = null;
                      setDragState(null);
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    style={{ position: 'absolute', inset: 0, cursor: isSaving ? 'progress' : 'crosshair', touchAction: 'none' }}
                  >
                    {dragSelection && (
                      <div style={{ position: 'absolute', left: dragSelection.x, top: dragSelection.y, width: dragSelection.width, height: dragSelection.height, border: `2px solid ${accent}`, boxShadow: `0 0 0 9999px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.45)`, background: `${accent}16` }} />
                    )}
                  </div>

                  <div style={{ position: 'absolute', left: 6, right: 6, top: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#f4f6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{monitor.label}</div>
                    </div>
                    {monitor.isActive && <div style={smallBadgeStyle(accent)}>Active</div>}
                  </div>

                  {isSaving && (
                    <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 7px', background: 'rgba(5,8,15,0.88)', border: `1px solid ${accent}55`, color: '#f4f6ff', fontSize: 9, fontWeight: 700 }}>
                      <LoaderCircle size={11} className="animate-spin" />
                      Saving
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </OverlayScrollArea>
  );

  const libraryContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: PANEL }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#edf1ff' }}>Library</div>
        <div style={{ fontSize: 10, color: MUTED }}>{visibleGalleryCount}/{totalGalleryCount}</div>
      </div>
      <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 8 }}>
        {isRefreshing && items.length === 0 ? (
          <GalleryLoading accent={accent} label="Loading library..." />
        ) : items.length === 0 ? (
          <div style={emptyPanelStyle(accent)}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Empty</div>
          </div>
        ) : (
          <div style={activeSection === 'library'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }
            : { display: 'grid', gap: 6 }}
          >
            {items.map(item => {
              const isCopying = copyingPath === item.path;
              const isCopied = copiedPath === item.path;
              return (
                <div
                  key={item.path}
                  style={activeSection === 'library'
                    ? { display: 'grid', gap: 6, borderRadius: 10, border: `1px solid ${isCopied ? `${accent}88` : BORDER}`, background: isCopied ? `${accent}12` : PANEL_ALT, padding: 6 }
                    : { display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', gap: 8, alignItems: 'start', borderRadius: 10, border: `1px solid ${isCopied ? `${accent}88` : BORDER}`, background: isCopied ? `${accent}12` : PANEL_ALT, padding: 6 }}
                >
                  <div style={{ aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#05050c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <ImageIcon size={18} style={{ color: MUTED }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#eef0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ marginTop: 2, fontSize: 9, color: MUTED }}>
                        {new Date(item.modified).toLocaleString()} · {formatFileSize(item.size)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void copyScreenshot(item)} style={toolbarButtonStyle(true, accent, isCopying)}>
                        {isCopying ? <LoaderCircle size={11} className="animate-spin" /> : isCopied ? <Check size={11} /> : <Copy size={11} />}
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>
                      <button type="button" onClick={() => invoke('fs_reveal_in_explorer', { path: item.path }).catch(err => setError(String(err)))} style={toolbarButtonStyle(false, accent)}>
                        <Search size={11} />
                        Reveal
                      </button>
                      <button type="button" onClick={() => invoke('fs_open_file', { path: item.path }).catch(err => setError(String(err)))} style={toolbarButtonStyle(false, accent)}>
                        <ExternalLink size={11} />
                        Open
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

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--overlay-bg-shell)', color: TEXT, fontFamily: 'var(--overlay-font-ui)' }}>
      <div style={{ width: 46, minWidth: 46, maxWidth: 46, borderRight: `1px solid ${BORDER}`, background: 'var(--overlay-bg-sidebar)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', gap: 6 }}>
        <RailButton active={activeSection === 'tool'} label="Tool" accent={accent} onClick={() => setActiveSection('tool')}>
          <Crosshair size={16} />
        </RailButton>
        <RailButton active={activeSection === 'library'} label="Library" accent={accent} onClick={() => setActiveSection('library')}>
          <ImageIcon size={16} />
        </RailButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, background: PANEL }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f3ff' }}>
              {activeSection === 'tool' ? 'Screenshot Tool' : 'Screenshot Library'}
            </div>
            {activeSection === 'tool' && (
              <div style={{ fontSize: 10, color: MUTED, whiteSpace: 'nowrap' }}>
                {monitors.length} displays
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => void refreshWorkspace()} style={toolbarButtonStyle(false, accent, isRefreshing)} disabled={isRefreshing}>
              {isRefreshing ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
            <button type="button" onClick={() => invoke('fs_open_file', { path: screenshotDir }).catch(err => setError(String(err)))} style={toolbarButtonStyle(false, accent)}>
              <FolderOpen size={14} />
              Folder
            </button>
          </div>
        </div>

        {(error || statusMessage) && (
          <div style={{ padding: '6px 8px', fontSize: 10, borderBottom: `1px solid ${BORDER}`, background: error ? 'rgba(127,29,29,0.28)' : `${accent}12`, color: error ? '#fca5a5' : '#e7ebff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{error ?? statusMessage}</span>
              <button type="button" onClick={clearMessages} style={iconButtonStyle(accent)}>
                <Check size={12} />
              </button>
            </div>
          </div>
        )}

        {activeSection === 'tool' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, background: 'var(--overlay-bg-shell)' }}>
              {monitorWallContent}
            </div>
            <ResizablePane
              size={libraryWidth}
              minSize={240}
              maxSize={520}
              onSizeChange={setLibraryWidth}
              borderColor={`${accent}44`}
              handleSide="left"
              style={{ borderLeft: `1px solid ${BORDER}`, background: PANEL }}
            >
              {libraryContent}
            </ResizablePane>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            {libraryContent}
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryLoading({ accent, label }: { accent: string; label: string }) {
  return (
    <div style={{ minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#eef0ff' }}>
      <LoaderCircle size={28} className="animate-spin" style={{ color: accent }} />
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

function RailButton({
  active,
  label,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  accent: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        border: `1px solid ${active ? `${accent}88` : BORDER}`,
        background: active ? `${accent}18` : 'rgba(255,255,255,0.02)',
        color: active ? '#f4f6ff' : MUTED,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function toolbarButtonStyle(primary: boolean, accent: string, disabled = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    padding: '6px 9px',
    border: `1px solid ${primary ? accent : BORDER}`,
    background: disabled ? 'rgba(255,255,255,0.04)' : primary ? `${accent}22` : 'rgba(255,255,255,0.02)',
    color: disabled ? 'rgba(255,255,255,0.38)' : primary ? '#f4f5ff' : '#d6d9ef',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 11,
    fontWeight: 600,
  };
}

function iconButtonStyle(accent: string): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: `1px solid ${accent}55`,
    background: 'rgba(255,255,255,0.03)',
    color: '#eef0ff',
    cursor: 'pointer',
  };
}

const emptyPanelStyle = (accent: string): React.CSSProperties => ({
  minHeight: 220,
  display: 'grid',
  placeItems: 'center',
  gap: 10,
  borderRadius: 18,
  border: `1px dashed ${accent}44`,
  background: `${accent}08`,
  color: '#eef0ff',
  textAlign: 'center',
  padding: 24,
});

const smallBadgeStyle = (accent: string): React.CSSProperties => ({
  borderRadius: 999,
  padding: '3px 7px',
  border: `1px solid ${accent}55`,
  background: `${accent}14`,
  color: '#f4f6ff',
  fontSize: 9,
  fontWeight: 700,
});

export default ScreenshotsManager;
