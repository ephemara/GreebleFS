import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { currentMonitor, getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window';
import { Check, Copy, Crosshair, FolderOpen, Image as ImageIcon, LoaderCircle, RefreshCw, Scissors } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { screenshotFeatureConfig } from '../config/screenshots';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  isSupportedScreenshotEntry,
  normalizeSelection,
  selectionToPixelRect,
  sortScreenshotEntries,
  type MonitorBounds,
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

type CaptureState = {
  captureId: string | null;
  imageWidth: number;
  imageHeight: number;
  monitor: MonitorBounds | null;
  previewUrl: string | null;
  selection: RectSelection | null;
};

type ScreenshotPreviewPayload = {
  captureId: string;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
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
  await new Promise(resolve => window.setTimeout(resolve, 120));

  try {
    return await task();
  } finally {
    await win.show().catch(() => {});
    await win.setFocus().catch(() => {});
  }
}

export function ScreenshotsManager({ appearance }: { appearance?: ResolvedOverlayAppearance }) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const screenshotSettings = useSettingsStore(s => s.settings.screenshots);
  const screenshotDir = screenshotSettings?.saveDirectory || screenshotFeatureConfig.defaultSaveDirectory;

  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);

  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [mode, setMode] = useState<'gallery' | 'capture'>('gallery');
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);
  const [isPreparingCapture, setIsPreparingCapture] = useState(false);
  const [isSavingCapture, setIsSavingCapture] = useState(false);
  const [copyingPath, setCopyingPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [capture, setCapture] = useState<CaptureState>({
    captureId: null,
    imageWidth: 0,
    imageHeight: 0,
    monitor: null,
    previewUrl: null,
    selection: null,
  });
  const [error, setError] = useState<string | null>(null);

  const loadGallery = useCallback(async () => {
    setIsLoadingGallery(true);
    setError(null);
    try {
      await ensureDir(screenshotDir);
      const listed = await invoke<FileEntry[]>('fs_list_dir', { path: screenshotDir, showHidden: false });
      const screenshotEntries = sortScreenshotEntries(listed.filter(isSupportedScreenshotEntry));
      const previewUrls = await Promise.all(
        screenshotEntries.map(async entry => {
          try {
            const previewUrl = await invoke<string>('fs_read_file_base64', { path: entry.path });
            return { ...entry, previewUrl };
          } catch {
            return { ...entry, previewUrl: null };
          }
        }),
      );
      setItems(previewUrls);
    } catch (err) {
      setError(String(err));
      setItems([]);
    } finally {
      setIsLoadingGallery(false);
    }
  }, [screenshotDir]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  useEffect(() => {
    if (!copiedPath) return undefined;
    const timeout = window.setTimeout(() => setCopiedPath(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedPath]);

  const beginCapture = useCallback(async () => {
    setMode('capture');
    setIsPreparingCapture(true);
    setError(null);
    try {
      const monitor = await currentMonitor() ?? await primaryMonitor();
      if (!monitor) {
        throw new Error('No monitor was available for screen capture.');
      }

      const monitorBounds: MonitorBounds = {
        x: monitor.position.x,
        y: monitor.position.y,
        width: monitor.size.width,
        height: monitor.size.height,
      };

      const preview = await withHiddenWindowCapture(() => invoke<ScreenshotPreviewPayload>('screenshot_capture_preview', {
        x: monitorBounds.x,
        y: monitorBounds.y,
        width: monitorBounds.width,
        height: monitorBounds.height,
      }));

      setCapture({
        captureId: preview.captureId,
        imageWidth: preview.imageWidth,
        imageHeight: preview.imageHeight,
        monitor: monitorBounds,
        previewUrl: preview.previewUrl,
        selection: null,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setIsPreparingCapture(false);
    }
  }, []);

  const exitCapture = useCallback(() => {
    setMode('gallery');
    setCapture({
      captureId: null,
      imageWidth: 0,
      imageHeight: 0,
      monitor: null,
      previewUrl: null,
      selection: null,
    });
  }, []);

  const selectionLabel = useMemo(() => {
    if (!capture.selection) return 'Drag a rectangle over the monitor preview.';
    const normalized = normalizeSelection(capture.selection);
    return `${Math.round(normalized.width)} × ${Math.round(normalized.height)} preview px selected`;
  }, [capture.selection]);

  const updateSelectionFromPoint = useCallback((clientX: number, clientY: number) => {
    const origin = dragOriginRef.current;
    const previewFrame = previewFrameRef.current;
    if (!origin || !previewFrame) return;

    const rect = previewFrame.getBoundingClientRect();
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const localX = clamp(clientX - rect.left, 0, rect.width);
    const localY = clamp(clientY - rect.top, 0, rect.height);

    setCapture(prev => ({
      ...prev,
      selection: {
        x: origin.x,
        y: origin.y,
        width: localX - origin.x,
        height: localY - origin.y,
      },
    }));
  }, []);

  const onPreviewPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewFrameRef.current) return;
    event.preventDefault();
    const rect = previewFrameRef.current.getBoundingClientRect();
    const localX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const localY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    dragOriginRef.current = { x: localX, y: localY };
    setCapture(prev => ({
      ...prev,
      selection: { x: localX, y: localY, width: 0, height: 0 },
    }));
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPreviewPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOriginRef.current) return;
    event.preventDefault();
    updateSelectionFromPoint(event.clientX, event.clientY);
  }, [updateSelectionFromPoint]);

  const onPreviewPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOriginRef.current) return;
    event.preventDefault();
    updateSelectionFromPoint(event.clientX, event.clientY);
    dragOriginRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [updateSelectionFromPoint]);

  const saveSelection = useCallback(async () => {
    if (!capture.selection || !capture.captureId || capture.imageWidth < 1 || capture.imageHeight < 1 || !previewFrameRef.current) return;
    const previewBounds = previewFrameRef.current.getBoundingClientRect();
    const cropRect = selectionToPixelRect(
      capture.selection,
      { width: previewBounds.width, height: previewBounds.height },
      { width: capture.imageWidth, height: capture.imageHeight },
    );

    if (cropRect.width < 2 || cropRect.height < 2) {
      setError('Select a slightly larger capture area before saving.');
      return;
    }

    setIsSavingCapture(true);
    setError(null);
    try {
      await ensureDir(screenshotDir);
      await invoke('screenshot_save_region', {
        captureId: capture.captureId,
        x: cropRect.x,
        y: cropRect.y,
        width: cropRect.width,
        height: cropRect.height,
        directory: screenshotDir,
      });
      await loadGallery();
      exitCapture();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSavingCapture(false);
    }
  }, [capture.captureId, capture.imageHeight, capture.imageWidth, capture.selection, exitCapture, loadGallery, screenshotDir]);

  const copyScreenshot = useCallback(async (item: ScreenshotItem) => {
    setCopyingPath(item.path);
    setError(null);
    try {
      await invoke('screenshot_copy_image_to_clipboard', { path: item.path });
      setCopiedPath(item.path);
    } catch (err) {
      setError(String(err));
    } finally {
      setCopyingPath(null);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--overlay-bg-shell)', color: TEXT, fontFamily: 'var(--overlay-font-ui)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Screenshots</div>
            <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
              Gallery clicks copy the image straight to your clipboard.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={loadGallery}
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
              onClick={beginCapture}
              disabled={isPreparingCapture}
              style={toolbarButtonStyle(true, accent)}
            >
              {isPreparingCapture ? <LoaderCircle size={14} className="animate-spin" /> : <Crosshair size={14} />}
              Take New Screenshot
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', fontSize: 12, color: '#fca5a5', borderBottom: `1px solid ${BORDER}`, background: 'rgba(127,29,29,0.28)' }}>
            {error}
          </div>
        )}

        {mode === 'gallery' && (
          <OverlayScrollArea style={{ flex: 1, minHeight: 0 }} viewportStyle={{ padding: 16 }}>
            {isLoadingGallery ? (
              <GalleryLoading accent={accent} />
            ) : items.length === 0 ? (
              <EmptyState accent={accent} onTakeNewScreenshot={beginCapture} />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14,
              }}
              >
                {items.map(item => {
                  const isCopying = copyingPath === item.path;
                  const isCopied = copiedPath === item.path;

                  return (
                    <button
                      key={item.path}
                      onClick={() => copyScreenshot(item)}
                      style={{
                        border: `1px solid ${isCopied ? `${accent}aa` : BORDER}`,
                        background: isCopied ? `${accent}18` : PANEL_ALT,
                        borderRadius: 14,
                        padding: 10,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        boxShadow: isCopied ? `0 0 0 1px ${accent}55 inset` : 'none',
                      }}
                      title={`Copy ${item.name} to clipboard`}
                    >
                      <div style={{
                        aspectRatio: '16 / 9',
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

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#eef0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ marginTop: 5, fontSize: 11, color: MUTED }}>
                            {new Date(item.modified).toLocaleString()}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: isCopied ? accent : MUTED,
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                        >
                          {isCopying ? <LoaderCircle size={13} className="animate-spin" /> : isCopied ? <Check size={13} /> : <Copy size={13} />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </OverlayScrollArea>
        )}

        {mode === 'capture' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f4f5ff' }}>Capture Current Monitor</div>
                <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>{selectionLabel}</div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exitCapture} style={toolbarButtonStyle(false, accent)}>Back To Gallery</button>
                <button
                  onClick={saveSelection}
                  disabled={!capture.selection || isSavingCapture}
                  style={toolbarButtonStyle(true, accent, !capture.selection || isSavingCapture)}
                >
                  {isSavingCapture ? <LoaderCircle size={14} className="animate-spin" /> : <Scissors size={14} />}
                  Save Screenshot
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
              {isPreparingCapture || !capture.previewUrl ? (
                <GalleryLoading accent={accent} label="Capturing monitor preview..." />
              ) : (
                <div style={{
                  position: 'relative',
                  maxWidth: 1180,
                  margin: '0 auto',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: `1px solid ${BORDER}`,
                  background: '#04050a',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                }}
                  ref={previewFrameRef}
                >
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

                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.22))',
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
                      cursor: 'crosshair',
                      touchAction: 'none',
                    }}
                  />

                  {capture.selection && (() => {
                    const selection = normalizeSelection(capture.selection);
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: selection.x,
                          top: selection.y,
                          width: selection.width,
                          height: selection.height,
                          border: `2px solid ${accent}`,
                          boxShadow: `0 0 0 9999px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.45)`,
                          background: `${accent}14`,
                          pointerEvents: 'none',
                        }}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryLoading({ accent, label = 'Loading screenshots...' }: { accent: string; label?: string }) {
  return (
    <div style={{
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
    <div style={{
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
        Save a capture and it will appear here. Clicking any screenshot in this gallery copies the image to the clipboard immediately.
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

export default ScreenshotsManager;
