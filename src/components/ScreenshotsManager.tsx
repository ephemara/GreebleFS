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
  Download,
  Eraser,
  ExternalLink,
  FolderOpen,
  Grid2x2,
  Image as ImageIcon,
  Keyboard,
  LoaderCircle,
  Maximize2,
  Minus,
  Monitor,
  Move,
  MousePointer2,
  Plus,
  RefreshCw,
  ScanLine,
  Scissors,
  Search,
  X,
} from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import {
  screenshotFeatureConfig,
  screenshotOutputActions,
  screenshotCaptureModes,
  type ScreenshotCaptureModeId,
  type ScreenshotOutputActionId,
} from '../config/screenshots';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  areSelectionsEqual,
  clampSelectionToBounds,
  createFullSelection,
  createInsetSelection,
  isPointInSelection,
  isSupportedScreenshotEntry,
  moveSelection,
  normalizeSelection,
  resizeSelection,
  roundSelection,
  selectionToPixelRect,
  sortScreenshotEntries,
  type MonitorBounds,
  type Point2D,
  type RectSelection,
  type RenderedSize,
  type ScreenshotEntryLike,
  type SelectionHandle,
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

type ScreenshotMonitor = MonitorBounds & {
  id: string;
  label: string;
  scaleFactor: number;
  workAreaWidth: number;
  workAreaHeight: number;
};

type CaptureState = {
  captureId: string | null;
  imageWidth: number;
  imageHeight: number;
  monitor: ScreenshotMonitor | null;
  previewUrl: string | null;
  selection: RectSelection | null;
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

type DragInteraction =
  | {
      kind: 'draw';
      pointerId: number;
      origin: Point2D;
    }
  | {
      kind: 'move';
      pointerId: number;
      origin: Point2D;
      selection: RectSelection;
    }
  | {
      kind: 'resize';
      pointerId: number;
      origin: Point2D;
      selection: RectSelection;
      handle: Exclude<SelectionHandle, 'move'>;
    };

const PANEL = 'var(--overlay-bg-panel)';
const PANEL_ALT = 'var(--overlay-bg-panel-alt)';
const BORDER = 'var(--overlay-border)';
const MUTED = 'var(--overlay-text-muted)';
const TEXT = 'var(--overlay-text-primary)';

const RESIZE_HANDLES: Exclude<SelectionHandle, 'move'>[] = [
  'north-west',
  'north',
  'north-east',
  'west',
  'east',
  'south-west',
  'south',
  'south-east',
];

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

function toScreenshotMonitor(monitor: TauriMonitor): ScreenshotMonitor {
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
  };
}

function formatFileSize(size: number): string {
  if (size < 1_024) return `${size} B`;
  if (size < 1_024 * 1_024) return `${(size / 1_024).toFixed(1)} KB`;
  return `${(size / (1_024 * 1_024)).toFixed(1)} MB`;
}

function getHandleCursor(handle: SelectionHandle): React.CSSProperties['cursor'] {
  switch (handle) {
    case 'move':
      return 'move';
    case 'north':
    case 'south':
      return 'ns-resize';
    case 'east':
    case 'west':
      return 'ew-resize';
    case 'north-east':
    case 'south-west':
      return 'nesw-resize';
    case 'north-west':
    case 'south-east':
      return 'nwse-resize';
    default:
      return 'crosshair';
  }
}

function getPreviewInsetSelection(
  captureMode: ScreenshotCaptureModeId,
  renderedSize: RenderedSize,
): RectSelection {
  return captureMode === 'monitor'
    ? createFullSelection(renderedSize)
    : createInsetSelection(renderedSize);
}

function SidebarSection({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...panelCardStyle, padding: 14, gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#edf1ff', fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: accent }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function ShortcutRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11 }}>
      <span style={{ color: MUTED }}>{label}</span>
      <strong style={{ color: '#eef0ff', textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

function GalleryLoading({ accent, label = 'Loading screenshots...' }: { accent: string; label?: string }) {
  return (
    <div
      style={{
        minHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#eef0ff',
      }}
    >
      <LoaderCircle size={28} className="animate-spin" style={{ color: accent }} />
      <div style={{ fontSize: 13 }}>{label}</div>
    </div>
  );
}

function EmptyState({ accent, onTakeNewScreenshot }: { accent: string; onTakeNewScreenshot: () => void }) {
  return (
    <div
      style={{
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        border: `1px dashed ${accent}44`,
        borderRadius: 18,
        background: `${accent}08`,
        color: '#eef0ff',
      }}
    >
      <ImageIcon size={32} style={{ color: accent }} />
      <div style={{ fontSize: 15, fontWeight: 700 }}>No screenshots yet</div>
      <div style={{ maxWidth: 420, fontSize: 12, color: MUTED, textAlign: 'center' }}>
        Capture, refine, then save or copy. This gallery loads recent files with native thumbnails so it stays fast.
      </div>
      <button onClick={onTakeNewScreenshot} style={toolbarButtonStyle(true, accent)}>
        <Crosshair size={14} />
        Take New Screenshot
      </button>
    </div>
  );
}

function toolbarButtonStyle(primary: boolean, accent: string, disabled = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    padding: '9px 12px',
    border: `1px solid ${primary ? accent : BORDER}`,
    background: disabled ? 'rgba(255,255,255,0.04)' : primary ? `${accent}22` : 'rgba(255,255,255,0.02)',
    color: disabled ? 'rgba(255,255,255,0.38)' : primary ? '#f4f5ff' : '#d6d9ef',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontWeight: 600,
  };
}

function toggleCardStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    borderRadius: 12,
    border: `1px solid ${active ? `${accent}88` : BORDER}`,
    background: active ? `${accent}16` : PANEL_ALT,
    padding: 12,
    color: '#f5f7ff',
    cursor: 'pointer',
  };
}

function selectionHandleStyle(handle: Exclude<SelectionHandle, 'move'>, selection: RectSelection, accent: string): React.CSSProperties {
  const positions: Record<Exclude<SelectionHandle, 'move'>, React.CSSProperties> = {
    'north-west': { left: selection.x - 6, top: selection.y - 6 },
    north: { left: selection.x + selection.width / 2 - 6, top: selection.y - 6 },
    'north-east': { left: selection.x + selection.width - 6, top: selection.y - 6 },
    west: { left: selection.x - 6, top: selection.y + selection.height / 2 - 6 },
    east: { left: selection.x + selection.width - 6, top: selection.y + selection.height / 2 - 6 },
    'south-west': { left: selection.x - 6, top: selection.y + selection.height - 6 },
    south: { left: selection.x + selection.width / 2 - 6, top: selection.y + selection.height - 6 },
    'south-east': { left: selection.x + selection.width - 6, top: selection.y + selection.height - 6 },
  };

  return {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 999,
    border: '2px solid rgba(255,255,255,0.95)',
    background: accent,
    boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
    cursor: getHandleCursor(handle),
    ...positions[handle],
  };
}

function iconButtonStyle(accent: string): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: `1px solid ${accent}55`,
    background: 'rgba(255,255,255,0.03)',
    color: '#eef0ff',
    cursor: 'pointer',
  };
}

const panelCardStyle: React.CSSProperties = {
  display: 'grid',
  borderRadius: 16,
  border: `1px solid ${BORDER}`,
  background: PANEL,
  boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
};

const statPillStyle = (accent: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  padding: '8px 12px',
  border: `1px solid ${accent}55`,
  background: `${accent}12`,
  color: '#eef0ff',
  fontSize: 12,
  fontWeight: 700,
});

const keyValueRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 11,
  color: MUTED,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ScreenshotsManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const screenshotSettings = useSettingsStore(s => s.settings.screenshots);
  const updateScreenshotSettings = useSettingsStore(s => s.updateScreenshots);
  const screenshotDir = screenshotSettings?.saveDirectory || screenshotFeatureConfig.defaultSaveDirectory;
  const captureMode = screenshotSettings?.defaultCaptureMode ?? screenshotFeatureConfig.defaultCaptureMode;
  const outputAction = screenshotSettings?.defaultOutputAction ?? screenshotFeatureConfig.defaultOutputAction;
  const showGrid = screenshotSettings?.showGrid !== false;
  const closeEditorAfterAction = screenshotSettings?.closeEditorAfterAction !== false;

  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const editorFocusRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<DragInteraction | null>(null);

  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [visibleGalleryCount, setVisibleGalleryCount] = useState(0);
  const [totalGalleryCount, setTotalGalleryCount] = useState(0);
  const [monitors, setMonitors] = useState<ScreenshotMonitor[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [mode, setMode] = useState<'gallery' | 'capture'>('gallery');
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);
  const [isPreparingCapture, setIsPreparingCapture] = useState(false);
  const [isApplyingAction, setIsApplyingAction] = useState(false);
  const [copyingPath, setCopyingPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editorZoom, setEditorZoom] = useState<number>(screenshotFeatureConfig.editor.initialZoom);
  const [previewFrameSize, setPreviewFrameSize] = useState<RenderedSize | null>(null);
  const [capture, setCapture] = useState<CaptureState>({
    captureId: null,
    imageWidth: 0,
    imageHeight: 0,
    monitor: null,
    previewUrl: null,
    selection: null,
  });
  const [error, setError] = useState<string | null>(null);

  const refreshMonitors = useCallback(async (): Promise<{ monitors: ScreenshotMonitor[]; preferredId: string | null }> => {
    const [available, current, primary] = await Promise.all([
      availableMonitors(),
      currentMonitor(),
      primaryMonitor(),
    ]);
    const nextMonitors = available.map(toScreenshotMonitor);
    const currentId = current ? toScreenshotMonitor(current).id : null;
    const primaryId = primary ? toScreenshotMonitor(primary).id : null;
    const preferredId = currentId ?? primaryId ?? nextMonitors[0]?.id ?? null;
    setMonitors(nextMonitors);
    setSelectedMonitorId(prev => {
      if (prev && nextMonitors.some(monitor => monitor.id === prev)) return prev;
      return preferredId;
    });
    return { monitors: nextMonitors, preferredId };
  }, []);

  const loadGallery = useCallback(async () => {
    setIsLoadingGallery(true);
    setError(null);
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
    } finally {
      setIsLoadingGallery(false);
    }
  }, [screenshotDir]);

  useEffect(() => {
    loadGallery();
    refreshMonitors().catch(() => {});
  }, [loadGallery, refreshMonitors]);

  useEffect(() => {
    if (!copiedPath) return undefined;
    const timeout = window.setTimeout(() => setCopiedPath(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedPath]);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    if (mode !== 'capture') return undefined;
    const node = previewFrameRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      setPreviewFrameSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      const frame = window.requestAnimationFrame(updateSize);
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, capture.previewUrl, editorZoom]);

  useEffect(() => {
    if (mode !== 'capture' || !capture.previewUrl || !previewFrameSize) return;
    setCapture(prev => {
      const nextSelection = getPreviewInsetSelection(captureMode, previewFrameSize);
      const adjustedSelection = prev.selection
        ? clampSelectionToBounds(prev.selection, previewFrameSize)
        : nextSelection;
      const finalSelection = captureMode === 'monitor' ? nextSelection : adjustedSelection;
      if (areSelectionsEqual(prev.selection, finalSelection)) return prev;
      return {
        ...prev,
        selection: roundSelection(finalSelection),
      };
    });
  }, [capture.previewUrl, captureMode, mode, previewFrameSize]);

  useEffect(() => {
    if (mode !== 'capture' || !capture.previewUrl) return;
    const frame = window.requestAnimationFrame(() => {
      editorFocusRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mode, capture.previewUrl]);

  const exitCapture = useCallback(() => {
    setMode('gallery');
    interactionRef.current = null;
    setPreviewFrameSize(null);
    setEditorZoom(screenshotFeatureConfig.editor.initialZoom);
    setCapture({
      captureId: null,
      imageWidth: 0,
      imageHeight: 0,
      monitor: null,
      previewUrl: null,
      selection: null,
    });
  }, []);

  const captureMonitor = useCallback(async (monitorId?: string) => {
    setMode('capture');
    setIsPreparingCapture(true);
    setError(null);

    try {
      const { monitors: nextMonitors, preferredId } = await refreshMonitors();
      const targetMonitor = nextMonitors.find(monitor => monitor.id === (monitorId ?? selectedMonitorId ?? preferredId))
        ?? nextMonitors[0];

      if (!targetMonitor) {
        throw new Error('No monitor was available for screen capture.');
      }

      const preview = await withHiddenWindowCapture(() => invoke<ScreenshotPreviewPayload>('screenshot_capture_preview', {
        x: targetMonitor.x,
        y: targetMonitor.y,
        width: targetMonitor.width,
        height: targetMonitor.height,
      }));

      setSelectedMonitorId(targetMonitor.id);
      setPreviewFrameSize(null);
      setCapture({
        captureId: preview.captureId,
        imageWidth: preview.imageWidth,
        imageHeight: preview.imageHeight,
        monitor: targetMonitor,
        previewUrl: preview.previewUrl,
        selection: null,
      });
      setStatusMessage(`Ready on ${targetMonitor.label}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsPreparingCapture(false);
    }
  }, [refreshMonitors, selectedMonitorId]);

  const currentCropRect = useMemo(() => {
    if (!capture.selection || !previewFrameSize || capture.imageWidth < 1 || capture.imageHeight < 1) {
      return null;
    }
    return selectionToPixelRect(
      capture.selection,
      previewFrameSize,
      { width: capture.imageWidth, height: capture.imageHeight },
    );
  }, [capture.imageHeight, capture.imageWidth, capture.selection, previewFrameSize]);

  const selectionLabel = useMemo(() => {
    if (!capture.selection || !currentCropRect) {
      return 'Adjust the selection, then copy or save it with keyboard or toolbar actions.';
    }
    const normalized = normalizeSelection(capture.selection);
    return `${Math.round(normalized.width)} x ${Math.round(normalized.height)} preview px · ${currentCropRect.width} x ${currentCropRect.height} image px`;
  }, [capture.selection, currentCropRect]);

  const applySelectionPreset = useCallback((nextMode: ScreenshotCaptureModeId) => {
    if (!previewFrameSize) return;
    setCapture(prev => ({
      ...prev,
      selection: roundSelection(getPreviewInsetSelection(nextMode, previewFrameSize)),
    }));
  }, [previewFrameSize]);

  const finalizeCapture = useCallback(async (action: ScreenshotOutputActionId) => {
    if (!capture.captureId || !currentCropRect) {
      setError('A capture selection is required before you can finish this screenshot.');
      return;
    }

    setIsApplyingAction(true);
    setError(null);
    try {
      if (action === 'copy') {
        await invoke('screenshot_copy_region_to_clipboard', {
          captureId: capture.captureId,
          x: currentCropRect.x,
          y: currentCropRect.y,
          width: currentCropRect.width,
          height: currentCropRect.height,
        });
        setCopiedPath('__live_capture__');
        setStatusMessage('Selection copied to clipboard.');
      } else {
        await ensureDir(screenshotDir);
        const saved = await invoke<SavedScreenshotPayload>('screenshot_save_region', {
          captureId: capture.captureId,
          x: currentCropRect.x,
          y: currentCropRect.y,
          width: currentCropRect.width,
          height: currentCropRect.height,
          directory: screenshotDir,
          filePrefix: screenshotFeatureConfig.filePrefix,
          copyToClipboard: action === 'save-copy',
        });
        await loadGallery();
        if (action === 'save-copy') {
          setCopiedPath(saved.path);
          setStatusMessage(`Saved and copied ${saved.file_name}.`);
        } else {
          setStatusMessage(`Saved ${saved.file_name}.`);
        }
      }

      if (closeEditorAfterAction) {
        exitCapture();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsApplyingAction(false);
    }
  }, [capture.captureId, closeEditorAfterAction, currentCropRect, exitCapture, loadGallery, screenshotDir]);

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

  const updateSelectionFromPointer = useCallback((clientX: number, clientY: number) => {
    const interaction = interactionRef.current;
    const frame = previewFrameRef.current;
    if (!interaction || !frame || !previewFrameSize) return;

    const bounds = frame.getBoundingClientRect();
    const point = {
      x: clamp(clientX - bounds.left, 0, bounds.width),
      y: clamp(clientY - bounds.top, 0, bounds.height),
    };

    if (interaction.kind === 'draw') {
      setCapture(prev => ({
        ...prev,
        selection: roundSelection(clampSelectionToBounds({
          x: interaction.origin.x,
          y: interaction.origin.y,
          width: point.x - interaction.origin.x,
          height: point.y - interaction.origin.y,
        }, previewFrameSize)),
      }));
      return;
    }

    const deltaX = point.x - interaction.origin.x;
    const deltaY = point.y - interaction.origin.y;

    if (interaction.kind === 'move') {
      setCapture(prev => ({
        ...prev,
        selection: roundSelection(moveSelection(interaction.selection, deltaX, deltaY, previewFrameSize)),
      }));
      return;
    }

    setCapture(prev => ({
      ...prev,
      selection: roundSelection(resizeSelection(
        interaction.selection,
        interaction.handle,
        deltaX,
        deltaY,
        previewFrameSize,
      )),
    }));
  }, [previewFrameSize]);

  const onPreviewPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewFrameRef.current || !previewFrameSize) return;
    event.preventDefault();
    editorFocusRef.current?.focus();

    const bounds = previewFrameRef.current.getBoundingClientRect();
    const point = {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      y: clamp(event.clientY - bounds.top, 0, bounds.height),
    };

    const handleElement = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-selection-handle]')
      : null;
    const handle = handleElement?.dataset.selectionHandle as SelectionHandle | undefined;
    const normalizedSelection = capture.selection ? normalizeSelection(capture.selection) : null;

    if (handle === 'move' && normalizedSelection) {
      interactionRef.current = {
        kind: 'move',
        pointerId: event.pointerId,
        origin: point,
        selection: normalizedSelection,
      };
    } else if (handle && handle !== 'move' && normalizedSelection) {
      interactionRef.current = {
        kind: 'resize',
        pointerId: event.pointerId,
        origin: point,
        selection: normalizedSelection,
        handle,
      };
    } else if (normalizedSelection && isPointInSelection(point, normalizedSelection)) {
      interactionRef.current = {
        kind: 'move',
        pointerId: event.pointerId,
        origin: point,
        selection: normalizedSelection,
      };
    } else {
      interactionRef.current = {
        kind: 'draw',
        pointerId: event.pointerId,
        origin: point,
      };
      setCapture(prev => ({
        ...prev,
        selection: {
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        },
      }));
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }, [capture.selection, previewFrameSize]);

  const onPreviewPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current) return;
    event.preventDefault();
    updateSelectionFromPointer(event.clientX, event.clientY);
  }, [updateSelectionFromPointer]);

  const onPreviewPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current) return;
    event.preventDefault();
    updateSelectionFromPointer(event.clientX, event.clientY);
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [updateSelectionFromPointer]);

  const onEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!previewFrameSize) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      exitCapture();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void finalizeCapture(outputAction);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void finalizeCapture('copy');
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void finalizeCapture('save');
      return;
    }

    if ((event.key === '+' || event.key === '=') && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setEditorZoom(prev => clamp(prev + screenshotFeatureConfig.editor.zoomStep, screenshotFeatureConfig.editor.minZoom, screenshotFeatureConfig.editor.maxZoom));
      return;
    }

    if (event.key === '-' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setEditorZoom(prev => clamp(prev - screenshotFeatureConfig.editor.zoomStep, screenshotFeatureConfig.editor.minZoom, screenshotFeatureConfig.editor.maxZoom));
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && capture.selection) {
      event.preventDefault();
      applySelectionPreset(captureMode);
      return;
    }

    if (!capture.selection) return;

    const step = event.shiftKey
      ? screenshotFeatureConfig.editor.keyboardLargeNudgeStep
      : screenshotFeatureConfig.editor.keyboardNudgeStep;

    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }

    event.preventDefault();

    setCapture(prev => {
      if (!prev.selection) return prev;

      const normalized = normalizeSelection(prev.selection);
      const nextSelection = event.altKey
        ? resizeSelection(
            normalized,
            event.key === 'ArrowLeft'
              ? 'west'
              : event.key === 'ArrowRight'
                ? 'east'
                : event.key === 'ArrowUp'
                  ? 'north'
                  : 'south',
            event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
            previewFrameSize,
          )
        : moveSelection(
            normalized,
            event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
            event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
            previewFrameSize,
          );

      return {
        ...prev,
        selection: roundSelection(nextSelection),
      };
    });
  }, [applySelectionPreset, capture.selection, captureMode, exitCapture, finalizeCapture, outputAction, previewFrameSize]);

  const captureSelection = capture.selection ? normalizeSelection(capture.selection) : null;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--overlay-bg-shell)', color: TEXT, fontFamily: 'var(--overlay-font-ui)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Screenshots</div>
            <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
              Multi-monitor capture, live region editing, clipboard-first workflow, and a lightweight gallery.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => void loadGallery()}
              disabled={isLoadingGallery}
              style={toolbarButtonStyle(false, accent)}
              title="Refresh screenshot gallery"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={() => invoke('fs_open_file', { path: screenshotDir }).catch(err => setError(String(err)))}
              style={toolbarButtonStyle(false, accent)}
              title="Open screenshot folder"
            >
              <FolderOpen size={14} />
              Folder
            </button>
            <button
              onClick={() => void captureMonitor()}
              disabled={isPreparingCapture}
              style={toolbarButtonStyle(true, accent)}
            >
              {isPreparingCapture ? <LoaderCircle size={14} className="animate-spin" /> : <Crosshair size={14} />}
              New Capture
            </button>
          </div>
        </div>
        {(error || statusMessage) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 16px',
              fontSize: 12,
              borderBottom: `1px solid ${BORDER}`,
              background: error ? 'rgba(127,29,29,0.28)' : `${accent}12`,
              color: error ? '#fca5a5' : '#e7ebff',
            }}
          >
            <span>{error ?? statusMessage}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatusMessage(null);
              }}
              style={iconButtonStyle(accent)}
              aria-label="Dismiss message"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {mode === 'gallery' && (
          <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
                  gap: 16,
                }}
              >
                <div style={{ ...panelCardStyle, padding: 18, gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#f5f7ff' }}>Capture like a real snipping tool</div>
                      <div style={{ marginTop: 8, maxWidth: 640, fontSize: 12, lineHeight: 1.6, color: MUTED }}>
                        Choose the default snip mode, choose what Enter does, then jump into a monitor-aware editor with resize handles,
                        keyboard nudging, clipboard-only output, and a fast thumbnail gallery.
                      </div>
                    </div>
                    <div style={statPillStyle(accent)}>
                      <ScanLine size={14} />
                      {monitors.length} monitor{monitors.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {screenshotCaptureModes.map(modeOption => {
                      const active = modeOption.id === captureMode;
                      return (
                        <button
                          key={modeOption.id}
                          type="button"
                          onClick={() => updateScreenshotSettings({ defaultCaptureMode: modeOption.id })}
                          style={toggleCardStyle(active, accent)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {modeOption.id === 'region' ? <MousePointer2 size={14} /> : <Monitor size={14} />}
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{modeOption.label}</span>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 11, color: active ? '#f5f7ff' : MUTED, lineHeight: 1.5 }}>
                            {modeOption.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {screenshotOutputActions.map(actionOption => {
                      const active = actionOption.id === outputAction;
                      return (
                        <button
                          key={actionOption.id}
                          type="button"
                          onClick={() => updateScreenshotSettings({ defaultOutputAction: actionOption.id })}
                          style={toggleCardStyle(active, accent)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {actionOption.id === 'copy' ? <Copy size={14} /> : actionOption.id === 'save' ? <Download size={14} /> : <Scissors size={14} />}
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{actionOption.label}</span>
                          </div>
                          <div style={{ marginTop: 8, fontSize: 11, color: active ? '#f5f7ff' : MUTED, lineHeight: 1.5 }}>
                            {actionOption.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ ...panelCardStyle, padding: 18, gap: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--overlay-text-dim)' }}>
                    Ready State
                  </div>
                  <div style={keyValueRowStyle}>
                    <span>Default mode</span>
                    <strong>{captureMode === 'region' ? 'Area Snip' : 'Full Monitor'}</strong>
                  </div>
                  <div style={keyValueRowStyle}>
                    <span>Enter key</span>
                    <strong>{screenshotOutputActions.find(action => action.id === outputAction)?.label ?? 'Save + Copy'}</strong>
                  </div>
                  <div style={keyValueRowStyle}>
                    <span>Grid overlay</span>
                    <strong>{showGrid ? 'On' : 'Off'}</strong>
                  </div>
                  <div style={keyValueRowStyle}>
                    <span>Close after action</span>
                    <strong>{closeEditorAfterAction ? 'Yes' : 'No'}</strong>
                  </div>
                  <div style={keyValueRowStyle}>
                    <span>Save folder</span>
                    <strong style={{ textAlign: 'right', maxWidth: 220, wordBreak: 'break-word' }}>{screenshotDir}</strong>
                  </div>
                  <button type="button" onClick={() => void captureMonitor()} style={toolbarButtonStyle(true, accent)}>
                    <Crosshair size={14} />
                    Start Capture
                  </button>
                </div>
              </div>

              {isLoadingGallery ? (
                <GalleryLoading accent={accent} />
              ) : items.length === 0 ? (
                <EmptyState accent={accent} onTakeNewScreenshot={() => void captureMonitor()} />
              ) : (
                <div style={{ ...panelCardStyle, padding: 16, gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#edf1ff' }}>Recent Gallery</div>
                      <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
                        Showing {visibleGalleryCount} of {totalGalleryCount} screenshots with lightweight thumbnails.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: MUTED, fontSize: 11 }}>
                      <Copy size={12} />
                      Use the copy button on any card for instant clipboard export.
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                    {items.map(item => {
                      const isCopying = copyingPath === item.path;
                      const isCopied = copiedPath === item.path;

                      return (
                        <div
                          key={item.path}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            borderRadius: 14,
                            border: `1px solid ${isCopied ? `${accent}88` : BORDER}`,
                            background: isCopied ? `${accent}12` : PANEL_ALT,
                            padding: 10,
                          }}
                        >
                          <div
                            style={{
                              aspectRatio: '16 / 10',
                              width: '100%',
                              borderRadius: 10,
                              overflow: 'hidden',
                              border: `1px solid ${BORDER}`,
                              background: '#05050c',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                            ) : (
                              <ImageIcon size={28} style={{ color: MUTED }} />
                            )}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#eef0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
                              {new Date(item.modified).toLocaleString()} · {formatFileSize(item.size)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => void copyScreenshot(item)} style={toolbarButtonStyle(true, accent, isCopying)}>
                              {isCopying ? <LoaderCircle size={14} className="animate-spin" /> : isCopied ? <Check size={14} /> : <Copy size={14} />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>
                            <button type="button" onClick={() => invoke('fs_reveal_in_explorer', { path: item.path }).catch(err => setError(String(err)))} style={toolbarButtonStyle(false, accent)}>
                              <Search size={14} />
                              Reveal
                            </button>
                            <button type="button" onClick={() => invoke('fs_open_file', { path: item.path }).catch(err => setError(String(err)))} style={toolbarButtonStyle(false, accent)}>
                              <ExternalLink size={14} />
                              Open
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </OverlayScrollArea>
        )}
        {mode === 'capture' && (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: `1px solid ${BORDER}`,
                  background: PANEL_ALT,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f4f5ff' }}>
                    {capture.monitor ? `Editing ${capture.monitor.label}` : 'Preparing capture'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>{selectionLabel}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => void captureMonitor(capture.monitor?.id ?? selectedMonitorId ?? undefined)} style={toolbarButtonStyle(false, accent)} disabled={isPreparingCapture}>
                    <RefreshCw size={14} />
                    Recapture
                  </button>
                  <button type="button" onClick={exitCapture} style={toolbarButtonStyle(false, accent)}>
                    <X size={14} />
                    Back
                  </button>
                  <button type="button" onClick={() => void finalizeCapture(outputAction)} style={toolbarButtonStyle(true, accent, isApplyingAction)} disabled={isApplyingAction}>
                    {isApplyingAction ? <LoaderCircle size={14} className="animate-spin" /> : outputAction === 'copy' ? <Copy size={14} /> : outputAction === 'save' ? <Download size={14} /> : <Scissors size={14} />}
                    {screenshotOutputActions.find(action => action.id === outputAction)?.label ?? 'Save + Copy'}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.06))' }}>
                {isPreparingCapture || !capture.previewUrl ? (
                  <GalleryLoading accent={accent} label="Capturing monitor preview..." />
                ) : (
                  <div
                    ref={editorFocusRef}
                    tabIndex={0}
                    onKeyDown={onEditorKeyDown}
                    style={{
                      outline: 'none',
                      minHeight: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: `${editorZoom * 100}%`,
                        maxWidth: 'none',
                        margin: '0 auto',
                        borderRadius: 16,
                        overflow: 'hidden',
                        border: `1px solid ${BORDER}`,
                        background: '#04050a',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                      }}
                      ref={previewFrameRef}
                    >
                      <div style={{ position: 'relative', width: '100%' }}>
                        <img
                          src={capture.previewUrl}
                          alt="Current monitor preview"
                          style={{
                            width: '100%',
                            display: 'block',
                            userSelect: 'none',
                            pointerEvents: 'none',
                          }}
                        />

                        <div
                          onPointerDown={onPreviewPointerDown}
                          onPointerMove={onPreviewPointerMove}
                          onPointerUp={onPreviewPointerUp}
                          onPointerCancel={onPreviewPointerUp}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            cursor: captureSelection ? 'default' : 'crosshair',
                            touchAction: 'none',
                            background: captureSelection
                              ? 'linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.2))'
                              : 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.22))',
                          }}
                        >
                          {showGrid && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                pointerEvents: 'none',
                                backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
                                backgroundSize: '24px 24px',
                              }}
                            />
                          )}

                          {captureSelection && (
                            <>
                              <div
                                data-selection-handle="move"
                                style={{
                                  position: 'absolute',
                                  left: captureSelection.x,
                                  top: captureSelection.y,
                                  width: captureSelection.width,
                                  height: captureSelection.height,
                                  border: `2px solid ${accent}`,
                                  boxShadow: `0 0 0 9999px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.45)`,
                                  background: `${accent}12`,
                                  cursor: getHandleCursor('move'),
                                }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: 10,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    borderRadius: 999,
                                    padding: '4px 8px',
                                    background: 'rgba(5,8,15,0.88)',
                                    border: `1px solid ${accent}55`,
                                    color: '#f5f7ff',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  <Move size={12} />
                                  Drag or resize
                                </div>
                              </div>

                              {RESIZE_HANDLES.map(handle => (
                                <div
                                  key={handle}
                                  data-selection-handle={handle}
                                  style={selectionHandleStyle(handle, captureSelection, accent)}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <OverlayScrollArea style={{ minHeight: 0, borderLeft: `1px solid ${BORDER}`, background: PANEL }} viewportStyle={{ padding: 16 }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <SidebarSection title="Capture Mode" icon={<MousePointer2 size={14} />} accent={accent}>
                  {screenshotCaptureModes.map(modeOption => {
                    const active = captureMode === modeOption.id;
                    return (
                      <button
                        key={modeOption.id}
                        type="button"
                        onClick={() => {
                          updateScreenshotSettings({ defaultCaptureMode: modeOption.id });
                          applySelectionPreset(modeOption.id);
                        }}
                        style={toggleCardStyle(active, accent)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{modeOption.label}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: active ? '#f5f7ff' : MUTED, lineHeight: 1.5 }}>
                          {modeOption.description}
                        </div>
                      </button>
                    );
                  })}
                </SidebarSection>

                <SidebarSection title="Target Monitor" icon={<Monitor size={14} />} accent={accent}>
                  {monitors.map(monitorOption => {
                    const active = (capture.monitor?.id ?? selectedMonitorId) === monitorOption.id;
                    return (
                      <button
                        key={monitorOption.id}
                        type="button"
                        onClick={() => void captureMonitor(monitorOption.id)}
                        style={toggleCardStyle(active, accent)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{monitorOption.label}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: active ? '#f5f7ff' : MUTED }}>
                          Work area {monitorOption.workAreaWidth}x{monitorOption.workAreaHeight} · scale {monitorOption.scaleFactor.toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </SidebarSection>

                <SidebarSection title="Finish Action" icon={<Scissors size={14} />} accent={accent}>
                  {screenshotOutputActions.map(actionOption => {
                    const active = actionOption.id === outputAction;
                    return (
                      <button
                        key={actionOption.id}
                        type="button"
                        onClick={() => updateScreenshotSettings({ defaultOutputAction: actionOption.id })}
                        style={toggleCardStyle(active, accent)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{actionOption.label}</div>
                        <div style={{ marginTop: 6, fontSize: 11, color: active ? '#f5f7ff' : MUTED, lineHeight: 1.5 }}>
                          {actionOption.description}
                        </div>
                      </button>
                    );
                  })}

                  <div style={{ display: 'grid', gap: 8 }}>
                    <button type="button" onClick={() => void finalizeCapture('copy')} style={toolbarButtonStyle(false, accent, isApplyingAction)} disabled={isApplyingAction}>
                      <Copy size={14} />
                      Copy Now
                    </button>
                    <button type="button" onClick={() => void finalizeCapture('save')} style={toolbarButtonStyle(false, accent, isApplyingAction)} disabled={isApplyingAction}>
                      <Download size={14} />
                      Save Now
                    </button>
                    <button type="button" onClick={() => void finalizeCapture('save-copy')} style={toolbarButtonStyle(true, accent, isApplyingAction)} disabled={isApplyingAction}>
                      <Scissors size={14} />
                      Save + Copy
                    </button>
                  </div>
                </SidebarSection>

                <SidebarSection title="Editor Controls" icon={<Grid2x2 size={14} />} accent={accent}>
                  <div style={keyValueRowStyle}>
                    <span>Zoom</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" onClick={() => setEditorZoom(prev => clamp(prev - screenshotFeatureConfig.editor.zoomStep, screenshotFeatureConfig.editor.minZoom, screenshotFeatureConfig.editor.maxZoom))} style={iconButtonStyle(accent)} aria-label="Zoom out">
                        <Minus size={12} />
                      </button>
                      <strong>{Math.round(editorZoom * 100)}%</strong>
                      <button type="button" onClick={() => setEditorZoom(prev => clamp(prev + screenshotFeatureConfig.editor.zoomStep, screenshotFeatureConfig.editor.minZoom, screenshotFeatureConfig.editor.maxZoom))} style={iconButtonStyle(accent)} aria-label="Zoom in">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => updateScreenshotSettings({ showGrid: !showGrid })} style={toggleCardStyle(showGrid, accent)}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Grid overlay</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: showGrid ? '#f5f7ff' : MUTED }}>
                      Helps align clean crops when selecting UI-heavy content.
                    </div>
                  </button>
                  <button type="button" onClick={() => updateScreenshotSettings({ closeEditorAfterAction: !closeEditorAfterAction })} style={toggleCardStyle(closeEditorAfterAction, accent)}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Close after action</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: closeEditorAfterAction ? '#f5f7ff' : MUTED }}>
                      Toggle whether the editor stays open after copy/save finishes.
                    </div>
                  </button>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <button type="button" onClick={() => applySelectionPreset(captureMode)} style={toolbarButtonStyle(false, accent)}>
                      <Maximize2 size={14} />
                      Reset Selection
                    </button>
                    <button type="button" onClick={() => previewFrameSize && setCapture(prev => ({ ...prev, selection: roundSelection(createFullSelection(previewFrameSize)) }))} style={toolbarButtonStyle(false, accent)} disabled={!previewFrameSize}>
                      <Monitor size={14} />
                      Full Monitor
                    </button>
                    <button type="button" onClick={() => previewFrameSize && setCapture(prev => ({ ...prev, selection: roundSelection(createInsetSelection(previewFrameSize)) }))} style={toolbarButtonStyle(false, accent)} disabled={!previewFrameSize}>
                      <Search size={14} />
                      Tight Region
                    </button>
                    <button type="button" onClick={() => previewFrameSize && setCapture(prev => ({ ...prev, selection: roundSelection(clampSelectionToBounds({ x: previewFrameSize.width * 0.25, y: previewFrameSize.height * 0.25, width: previewFrameSize.width * 0.5, height: previewFrameSize.height * 0.5 }, previewFrameSize)) }))} style={toolbarButtonStyle(false, accent)} disabled={!previewFrameSize}>
                      <Eraser size={14} />
                      Center 50%
                    </button>
                  </div>
                </SidebarSection>

                <SidebarSection title="Shortcuts" icon={<Keyboard size={14} />} accent={accent}>
                  <ShortcutRow label="Enter" value={`${screenshotOutputActions.find(action => action.id === outputAction)?.label ?? 'Save + Copy'}`} />
                  <ShortcutRow label="Ctrl/Cmd+C" value="Copy selection" />
                  <ShortcutRow label="Ctrl/Cmd+S" value="Save selection" />
                  <ShortcutRow label="Arrows" value="Move selection" />
                  <ShortcutRow label="Alt + Arrows" value="Resize selection" />
                  <ShortcutRow label="Shift" value="Use larger move/resize step" />
                  <ShortcutRow label="+ / -" value="Zoom preview" />
                  <ShortcutRow label="Esc" value="Exit capture editor" />
                </SidebarSection>
              </div>
            </OverlayScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScreenshotsManager;
