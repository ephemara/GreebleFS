import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
  type Monitor as TauriMonitor,
} from '@tauri-apps/api/window';

import {
  ArrowLeft,
  Check,
  Copy,
  Crosshair,
  ExternalLink,
  FolderOpen,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  Monitor,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Trash2,
} from '@/components/AppIcons';
import type { ResolvedOverlayAppearance } from '../config/appearance';
import {
  screenshotFeatureConfig,
  type ScreenshotOutputActionId,
} from '../config/screenshots';
import {
  createExplorerDir,
  deleteExplorerPath,
  listExplorerDir,
  openExplorerPath,
  readExplorerImageThumbnail,
  revealExplorerPath,
} from '../runtime/explorerBackend';
import {
  buildScreenshotAssetUrl,
  captureScreenshotMonitor,
  clearScreenshotPluginCaptures,
  copyScreenshotImageToClipboard,
  deleteScreenshotStage,
  finalizeScreenshotStage,
  listScreenshotableMonitors,
  prepareScreenshotStage,
  removeScreenshotMonitorCapture,
  type PreparedScreenshotStage,
  type ScreenshotableMonitorDescriptor,
} from '../runtime/screenshotBackend';
import { useSettingsStore } from '../store/settingsStore';
import { AppConfirmDialog } from './AppModal';
import { ExplorerImageEditor, type ExplorerImageEditorRef } from './ExplorerImageEditor';
import { OverlayScrollArea } from './OverlayScrollArea';
import { ResizablePane, usePersistentPanelSize } from './ResizablePane';
import {
  getSelectionHandleAtPoint,
  isPointInSelection,
  isSupportedScreenshotEntry,
  moveSelection,
  normalizeSelection,
  resizeSelection,
  selectionToPixelRect,
  sortScreenshotEntries,
  type Point2D,
  type RectSelection,
  type ScreenshotEntryLike,
  type SelectionHandle,
} from './screenshotsUtils';

type ScreenshotLibraryEntry = ScreenshotEntryLike & {
  size: number;
  is_hidden?: boolean;
  is_symlink?: boolean;
};

type ScreenshotGalleryItem = ScreenshotLibraryEntry & {
  previewUrl: string | null;
};

type ScreenshotMonitorSession = ScreenshotableMonitorDescriptor & {
  label: string;
  isActive: boolean;
  capturePath: string | null;
  captureUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  isCapturing: boolean;
  captureError: string | null;
  captureVersion: number;
};

type ActiveScreenshotStage = PreparedScreenshotStage & {
  source: string;
  sourceMonitorId: number;
  scope: 'monitor' | 'region';
};

type SelectionInteraction =
  | { kind: 'draw'; origin: Point2D }
  | { kind: 'move'; origin: Point2D; initialSelection: RectSelection }
  | {
      kind: 'resize';
      origin: Point2D;
      initialSelection: RectSelection;
      handle: Exclude<SelectionHandle, 'move'>;
    };

const PANEL = 'var(--overlay-bg-panel)';
const PANEL_ALT = 'var(--overlay-bg-panel-alt)';
const BORDER = 'var(--overlay-border)';
const MUTED = 'var(--overlay-text-muted)';
const TEXT = 'var(--overlay-text-primary)';
const SELECTION_HANDLE_RADIUS = 8;
const SELECTION_HANDLE_SIZE = 10;

function normalizeMonitorName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

function buildMonitorLabel(
  monitor: ScreenshotableMonitorDescriptor,
  index: number,
  tauriMonitor: TauriMonitor | null,
): string {
  const displayName = monitor.name.trim() || `Display ${index + 1}`;
  if (!tauriMonitor) {
    return displayName;
  }

  const scaleFactor = tauriMonitor.scaleFactor || 1;
  const logicalWidth = Math.round(tauriMonitor.size.width / scaleFactor);
  const logicalHeight = Math.round(tauriMonitor.size.height / scaleFactor);
  return `${displayName} · ${logicalWidth}×${logicalHeight}`;
}

async function ensureDir(path: string): Promise<void> {
  try {
    await listExplorerDir(path, false);
  } catch {
    await createExplorerDir(path);
  }
}

function formatFileSize(size: number): string {
  if (size < 1_024) {
    return `${size} B`;
  }
  if (size < 1_048_576) {
    return `${(size / 1_024).toFixed(1)} KB`;
  }
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

async function measureImageSource(
  imageSource: string,
): Promise<{ width: number; height: number }> {
  const image = new window.Image();
  return await new Promise((resolve, reject) => {
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => {
      reject(new Error('Failed to decode captured screenshot.'));
    };
    image.src = imageSource;
  });
}

export function ScreenshotsManager({
  appearance,
}: {
  appearance?: ResolvedOverlayAppearance;
}) {
  const accent = appearance?.theme.palette.accent ?? 'var(--overlay-accent)';
  const screenshotSettings = useSettingsStore(
    (state) => state.settings.screenshots,
  );
  const screenshotDir =
    screenshotSettings.saveDirectory ||
    screenshotFeatureConfig.defaultSaveDirectory;

  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ExplorerImageEditorRef | null>(null);
  const selectionInteractionRef = useRef<SelectionInteraction | null>(null);
  const dragRectRef = useRef<DOMRect | null>(null);
  const isDraggingRef = useRef(false);
  const galleryRequestIdRef = useRef(0);
  const captureTicketRef = useRef(new Map<number, number>());
  const stageRef = useRef<ActiveScreenshotStage | null>(null);
  const monitorsRef = useRef<ScreenshotMonitorSession[]>([]);
  const autoEnteredCaptureKeyRef = useRef<string | null>(null);

  const [monitors, setMonitors] = useState<ScreenshotMonitorSession[]>([]);
  const [activeMonitorId, setActiveMonitorId] = useState<number | null>(null);
  const [toolPhase, setToolPhase] = useState<'select' | 'edit'>('select');
  const [selection, setSelection] = useState<RectSelection | null>(null);
  const [stage, setStage] = useState<ActiveScreenshotStage | null>(null);
  const [items, setItems] = useState<ScreenshotGalleryItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeSection, setActiveSection] = useState<'tool' | 'library'>('tool');
  const [isHydratingMonitors, setIsHydratingMonitors] = useState(false);
  const [isPreparingStage, setIsPreparingStage] = useState(false);
  const [isFinishingStage, setIsFinishingStage] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyingPath, setCopyingPath] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] =
    useState<ScreenshotGalleryItem | null>(null);
  const [libraryWidth, setLibraryWidth] = usePersistentPanelSize(
    'overlayterm-screenshots-library-width',
    280,
    220,
    480,
  );

  useEffect(() => {
    monitorsRef.current = monitors;
  }, [monitors]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  const activeMonitor =
    monitors.find((monitor) => monitor.id === activeMonitorId) ?? null;
  const normalizedSelection = selection ? normalizeSelection(selection) : null;
  const hasSelection =
    Boolean(normalizedSelection) &&
    normalizedSelection!.width >= screenshotFeatureConfig.editor.minSelectionSize &&
    normalizedSelection!.height >= screenshotFeatureConfig.editor.minSelectionSize;
  const orderedOutputActions = useMemo(
    () =>
      [...screenshotFeatureConfig.outputActions].sort((left, right) => {
        if (left.id === screenshotSettings.defaultOutputAction) {
          return -1;
        }
        if (right.id === screenshotSettings.defaultOutputAction) {
          return 1;
        }
        return 0;
      }),
    [screenshotSettings.defaultOutputAction],
  );

  const applyStage = useCallback((nextStage: ActiveScreenshotStage | null) => {
    stageRef.current = nextStage;
    setStage(nextStage);
  }, []);

  const updateMonitor = useCallback(
    (
      monitorId: number,
      updater: (monitor: ScreenshotMonitorSession) => ScreenshotMonitorSession,
    ) => {
      setMonitors((current) =>
        current.map((monitor) =>
          monitor.id === monitorId ? updater(monitor) : monitor,
        ),
      );
    },
    [],
  );

  const clearSelectionState = useCallback(() => {
    setSelection(null);
    selectionInteractionRef.current = null;
  }, []);

  const deleteStageIfPresent = useCallback(async (stagePath: string | null) => {
    if (!stagePath) {
      return;
    }

    try {
      await deleteScreenshotStage(stagePath);
    } catch {
      // Stage cleanup is best-effort.
    }
  }, []);

  const dismissStage = useCallback(
    async (openLibrary: boolean) => {
      const existingStage = stageRef.current;
      applyStage(null);
      setToolPhase('select');
      clearSelectionState();
      if (openLibrary) {
        setActiveSection('library');
      }
      await deleteStageIfPresent(existingStage?.path ?? null);
    },
    [applyStage, clearSelectionState, deleteStageIfPresent],
  );

  const loadGallery = useCallback(async () => {
    const requestId = galleryRequestIdRef.current + 1;
    galleryRequestIdRef.current = requestId;

    try {
      await ensureDir(screenshotDir);
      const listedEntries = await listExplorerDir(screenshotDir, false);
      const sortedEntries = sortScreenshotEntries(
        listedEntries.filter(isSupportedScreenshotEntry),
      );
      const visibleEntries = sortedEntries.slice(
        0,
        screenshotFeatureConfig.maxGalleryItems,
      );

      const visibleItems = await Promise.all(
        visibleEntries.map(async (entry) => {
          try {
            const previewUrl = await readExplorerImageThumbnail(
              entry.path,
              screenshotFeatureConfig.galleryThumbnail.maxWidth,
              screenshotFeatureConfig.galleryThumbnail.maxHeight,
            );
            return { ...entry, previewUrl };
          } catch {
            return { ...entry, previewUrl: null };
          }
        }),
      );

      if (requestId !== galleryRequestIdRef.current) {
        return;
      }

      setItems(visibleItems);
      setVisibleCount(visibleItems.length);
      setTotalCount(sortedEntries.length);
    } catch (galleryError) {
      if (requestId !== galleryRequestIdRef.current) {
        return;
      }

      setError(String(galleryError));
      setItems([]);
      setVisibleCount(0);
      setTotalCount(0);
    }
  }, [screenshotDir]);

  const hydrateMonitors = useCallback(async () => {
    setIsHydratingMonitors(true);
    setError(null);

    try {
      const [pluginMonitors, tauriMonitors, activeWindowMonitor, primaryWindowMonitor] =
        await Promise.all([
          listScreenshotableMonitors(),
          availableMonitors(),
          currentMonitor(),
          primaryMonitor(),
        ]);

      const activeMonitorName =
        normalizeMonitorName(activeWindowMonitor?.name) ||
        normalizeMonitorName(primaryWindowMonitor?.name);

      setMonitors((current) =>
        pluginMonitors.map((pluginMonitor, index) => {
          const currentMonitorSession =
            current.find((monitor) => monitor.id === pluginMonitor.id) ?? null;
          const matchedTauriMonitor =
            tauriMonitors.find(
              (monitor) =>
                normalizeMonitorName(monitor.name) ===
                normalizeMonitorName(pluginMonitor.name),
            ) ??
            tauriMonitors[index] ??
            null;

          return {
            id: pluginMonitor.id,
            name: pluginMonitor.name,
            label: buildMonitorLabel(pluginMonitor, index, matchedTauriMonitor),
            isActive:
              activeMonitorName.length > 0
                ? normalizeMonitorName(pluginMonitor.name) === activeMonitorName
                : index === 0,
            capturePath: currentMonitorSession?.capturePath ?? null,
            captureUrl: currentMonitorSession?.captureUrl ?? null,
            imageWidth: currentMonitorSession?.imageWidth ?? 0,
            imageHeight: currentMonitorSession?.imageHeight ?? 0,
            isCapturing: false,
            captureError: null,
            captureVersion: currentMonitorSession?.captureVersion ?? 0,
          };
        }),
      );

      setActiveMonitorId((currentActiveMonitorId) => {
        if (
          currentActiveMonitorId !== null &&
          pluginMonitors.some((monitor) => monitor.id === currentActiveMonitorId)
        ) {
          return currentActiveMonitorId;
        }

        const preferredMonitor =
          pluginMonitors.find(
            (monitor) =>
              normalizeMonitorName(monitor.name) === activeMonitorName,
          ) ?? pluginMonitors[0] ?? null;

        return preferredMonitor?.id ?? null;
      });
    } catch (monitorError) {
      setError(String(monitorError));
      setMonitors([]);
      setActiveMonitorId(null);
    } finally {
      setIsHydratingMonitors(false);
    }
  }, []);

  const ensureMonitorCapture = useCallback(
    async (monitorId: number, options?: { force?: boolean }) => {
      const existingMonitor = monitorsRef.current.find(
        (monitor) => monitor.id === monitorId,
      );
      if (!existingMonitor) {
        return null;
      }

      if (!options?.force) {
        if (existingMonitor.capturePath) {
          return existingMonitor.capturePath;
        }
        if (existingMonitor.isCapturing) {
          return null;
        }
      }

      const nextTicket = (captureTicketRef.current.get(monitorId) ?? 0) + 1;
      captureTicketRef.current.set(monitorId, nextTicket);
      updateMonitor(monitorId, (monitor) => ({
        ...monitor,
        isCapturing: true,
        captureError: null,
      }));

      try {
        if (options?.force) {
          await removeScreenshotMonitorCapture(monitorId).catch(() => undefined);
        }

        const capturePath = await captureScreenshotMonitor(monitorId);
        const captureUrl = buildScreenshotAssetUrl(capturePath, Date.now());
        const imageDimensions = await measureImageSource(captureUrl);

        if (captureTicketRef.current.get(monitorId) !== nextTicket) {
          return null;
        }

        updateMonitor(monitorId, (monitor) => ({
          ...monitor,
          capturePath,
          captureUrl,
          imageWidth: imageDimensions.width,
          imageHeight: imageDimensions.height,
          isCapturing: false,
          captureError: null,
          captureVersion: monitor.captureVersion + 1,
        }));

        return capturePath;
      } catch (captureError) {
        if (captureTicketRef.current.get(monitorId) !== nextTicket) {
          return null;
        }

        updateMonitor(monitorId, (monitor) => ({
          ...monitor,
          isCapturing: false,
          captureError: String(captureError),
        }));
        setError(String(captureError));
        return null;
      }
    },
    [updateMonitor],
  );

  const getSelectionPixels = useCallback(() => {
    const container = previewContainerRef.current;
    if (!container || !activeMonitor || !selection) {
      return null;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return selectionToPixelRect(
      normalizeSelection(selection),
      { width: rect.width, height: rect.height },
      { width: activeMonitor.imageWidth, height: activeMonitor.imageHeight },
    );
  }, [activeMonitor, selection]);

  const beginStageFromActiveCapture = useCallback(
    async (scope: 'monitor' | 'region') => {
      const monitor = monitorsRef.current.find(
        (entry) => entry.id === activeMonitorId,
      );
      if (!monitor) {
        return;
      }

      const capturePath =
        monitor.capturePath ??
        (await ensureMonitorCapture(monitor.id, { force: false }));
      if (!capturePath) {
        return;
      }

      const cropRegion =
        scope === 'region'
          ? getSelectionPixels()
          : null;

      if (
        scope === 'region' &&
        (!cropRegion ||
          cropRegion.width < screenshotFeatureConfig.editor.minSelectionSize ||
          cropRegion.height < screenshotFeatureConfig.editor.minSelectionSize)
      ) {
        setError('Selection too small.');
        return;
      }

      setIsPreparingStage(true);
      setError(null);

      try {
        const preparedStage = await prepareScreenshotStage(
          capturePath,
          cropRegion,
        );

        const nextStage: ActiveScreenshotStage = {
          ...preparedStage,
          source: buildScreenshotAssetUrl(preparedStage.path, Date.now()),
          sourceMonitorId: monitor.id,
          scope,
        };

        const previousStagePath = stageRef.current?.path ?? null;
        applyStage(nextStage);
        setToolPhase('edit');
        setStatusMsg(
          scope === 'monitor'
            ? 'Full monitor ready for editing.'
            : 'Selection ready for editing.',
        );

        if (previousStagePath && previousStagePath !== nextStage.path) {
          void deleteStageIfPresent(previousStagePath);
        }
      } catch (stageError) {
        setError(String(stageError));
      } finally {
        setIsPreparingStage(false);
      }
    },
    [
      activeMonitorId,
      applyStage,
      deleteStageIfPresent,
      ensureMonitorCapture,
      getSelectionPixels,
    ],
  );

  const recaptureActiveMonitor = useCallback(async () => {
    const monitorId = activeMonitorId;
    if (monitorId == null) {
      return;
    }

    await dismissStage(false);
    autoEnteredCaptureKeyRef.current = null;
    clearSelectionState();
    await ensureMonitorCapture(monitorId, { force: true });
    await loadGallery();
  }, [
    activeMonitorId,
    clearSelectionState,
    dismissStage,
    ensureMonitorCapture,
    loadGallery,
  ]);

  const finalizeStageAction = useCallback(
    async (action: ScreenshotOutputActionId) => {
      const activeStage = stageRef.current;
      if (!activeStage) {
        return;
      }

      setIsFinishingStage(true);
      setError(null);

      try {
        const editor = editorRef.current;
        if (editor) {
          const saveSucceeded = await editor.save();
          if (!saveSucceeded) {
            throw new Error('Failed to persist the staged screenshot before finishing.');
          }
        }

        if (action === 'copy') {
          await copyScreenshotImageToClipboard(activeStage.path);
          setStatusMsg('Screenshot copied to clipboard.');

          if (screenshotSettings.closeEditorAfterAction) {
            await dismissStage(false);
          }
          return;
        }

        const savedScreenshot = await finalizeScreenshotStage(
          activeStage.path,
          screenshotDir,
          screenshotFeatureConfig.filePrefix,
          action === 'save-copy',
        );

        await loadGallery();
        setStatusMsg(
          action === 'save-copy'
            ? `Saved and copied ${savedScreenshot.file_name}.`
            : `Saved ${savedScreenshot.file_name}.`,
        );

        if (screenshotSettings.closeEditorAfterAction) {
          await dismissStage(true);
        }
      } catch (finishError) {
        setError(String(finishError));
      } finally {
        setIsFinishingStage(false);
      }
    },
    [
      dismissStage,
      loadGallery,
      screenshotDir,
      screenshotSettings.closeEditorAfterAction,
    ],
  );

  const handleActivateSection = useCallback(
    async (nextSection: 'tool' | 'library') => {
      if (nextSection === activeSection) {
        return;
      }

      if (nextSection === 'library' && toolPhase === 'edit') {
        const editor = editorRef.current;
        if (editor?.hasUnsavedChanges()) {
          const persisted = await editor.save();
          if (!persisted) {
            setError('Failed to save the staged screenshot before leaving the editor.');
            return;
          }
        }
      }

      setActiveSection(nextSection);
    },
    [activeSection, toolPhase],
  );

  useEffect(() => {
    void hydrateMonitors();
    void loadGallery();

    return () => {
      galleryRequestIdRef.current += 1;
      const stagePath = stageRef.current?.path ?? null;
      void deleteStageIfPresent(stagePath);
      void clearScreenshotPluginCaptures().catch(() => undefined);
    };
  }, [deleteStageIfPresent, hydrateMonitors, loadGallery]);

  useEffect(() => {
    if (activeMonitorId == null) {
      return;
    }

    void ensureMonitorCapture(activeMonitorId, { force: false });
  }, [activeMonitorId, ensureMonitorCapture]);

  useEffect(() => {
    if (!activeMonitor?.capturePath) {
      return;
    }

    if (toolPhase !== 'select' || screenshotSettings.defaultCaptureMode !== 'monitor') {
      return;
    }

    const captureKey = `${activeMonitor.id}:${activeMonitor.captureVersion}`;
    if (autoEnteredCaptureKeyRef.current === captureKey) {
      return;
    }

    autoEnteredCaptureKeyRef.current = captureKey;
    void beginStageFromActiveCapture('monitor');
  }, [
    activeMonitor?.capturePath,
    activeMonitor?.captureVersion,
    activeMonitor?.id,
    beginStageFromActiveCapture,
    screenshotSettings.defaultCaptureMode,
    toolPhase,
  ]);

  useEffect(() => {
    if (!statusMsg) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusMsg(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [statusMsg]);

  useEffect(() => {
    if (!copiedPath) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopiedPath(null), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copiedPath]);

  useEffect(() => {
    if (toolPhase !== 'select') {
      return;
    }

    clearSelectionState();
  }, [activeMonitorId, clearSelectionState, toolPhase]);

  const getPreviewPoint = useCallback(
    (clientX: number, clientY: number, rectOverride?: DOMRect | null): Point2D => {
      const rect = rectOverride ?? previewContainerRef.current?.getBoundingClientRect();
      if (!rect) {
        return { x: 0, y: 0 };
      }

      return {
        x: clamp(clientX - rect.left, 0, rect.width),
        y: clamp(clientY - rect.top, 0, rect.height),
      };
    },
    [],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!activeMonitor?.capturePath || toolPhase !== 'select') {
      return;
    }

    const rect = previewContainerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    dragRectRef.current = rect;
    isDraggingRef.current = true;

    const origin = getPreviewPoint(event.clientX, event.clientY, rect);
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    const currentSelection = selection ? normalizeSelection(selection) : null;
    const selectionHandle = currentSelection
      ? getSelectionHandleAtPoint(origin, currentSelection, SELECTION_HANDLE_RADIUS)
      : null;

    if (currentSelection && selectionHandle && selectionHandle !== 'move') {
      selectionInteractionRef.current = {
        kind: 'resize',
        origin,
        initialSelection: currentSelection,
        handle: selectionHandle,
      };
      setSelection(currentSelection);
      return;
    }

    if (currentSelection && isPointInSelection(origin, currentSelection)) {
      selectionInteractionRef.current = {
        kind: 'move',
        origin,
        initialSelection: currentSelection,
      };
      setSelection(currentSelection);
      return;
    }

    selectionInteractionRef.current = { kind: 'draw', origin };
    setSelection({ x: origin.x, y: origin.y, width: 0, height: 0 });
  }, [activeMonitor?.capturePath, getPreviewPoint, selection, toolPhase]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = dragRectRef.current;
    const interaction = selectionInteractionRef.current;
    if (!rect || !interaction || !isDraggingRef.current) {
      return;
    }

    event.preventDefault();
    const pointer = getPreviewPoint(event.clientX, event.clientY, rect);
    const renderedSize = { width: rect.width, height: rect.height };

    if (interaction.kind === 'draw') {
      setSelection({
        x: interaction.origin.x,
        y: interaction.origin.y,
        width: clamp(
          pointer.x - interaction.origin.x,
          -interaction.origin.x,
          rect.width - interaction.origin.x,
        ),
        height: clamp(
          pointer.y - interaction.origin.y,
          -interaction.origin.y,
          rect.height - interaction.origin.y,
        ),
      });
      return;
    }

    const deltaX = pointer.x - interaction.origin.x;
    const deltaY = pointer.y - interaction.origin.y;
    if (interaction.kind === 'move') {
      setSelection(
        moveSelection(
          interaction.initialSelection,
          deltaX,
          deltaY,
          renderedSize,
        ),
      );
      return;
    }

    setSelection(
      resizeSelection(
        interaction.initialSelection,
        interaction.handle,
        deltaX,
        deltaY,
        renderedSize,
      ),
    );
  }, [getPreviewPoint]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    isDraggingRef.current = false;
    dragRectRef.current = null;
    selectionInteractionRef.current = null;
  }, []);

  const handlePreviewKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const rect = previewContainerRef.current?.getBoundingClientRect();
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

    if (!selection) {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelectionState();
      }
      return;
    }

    const rendered = { width: rect.width, height: rect.height };
    const step = event.shiftKey
      ? screenshotFeatureConfig.editor.keyboardLargeNudgeStep
      : screenshotFeatureConfig.editor.keyboardNudgeStep;

    if (event.key === 'Escape') {
      event.preventDefault();
      clearSelectionState();
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
  }, [clearSelectionState, selection]);

  const selectionPixels = getSelectionPixels();
  const isBusy = isHydratingMonitors || isPreparingStage || isFinishingStage;

  const copyGalleryItem = useCallback(async (item: ScreenshotGalleryItem) => {
    setCopyingPath(item.path);
    try {
      await copyScreenshotImageToClipboard(item.path);
      setCopiedPath(item.path);
      setStatusMsg(`Copied ${item.name}.`);
    } catch (copyError) {
      setError(String(copyError));
    } finally {
      setCopyingPath(null);
    }
  }, []);

  const deleteGalleryItem = useCallback(async () => {
    const item = pendingDeleteItem;
    if (!item || deletingPath) {
      setPendingDeleteItem(null);
      return;
    }

    setPendingDeleteItem(null);
    setDeletingPath(item.path);
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
    } catch (deleteError) {
      setError(String(deleteError));
    } finally {
      setDeletingPath(null);
    }
  }, [copiedPath, copyingPath, deletingPath, loadGallery, pendingDeleteItem]);

  const toolContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {toolPhase === 'select' && monitors.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 8px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL,
            flexWrap: 'wrap',
          }}
        >
          {monitors.map((monitor, index) => {
            const isActive = monitor.id === activeMonitorId;
            return (
              <button
                key={monitor.id}
                type="button"
                onClick={() => {
                  setActiveMonitorId(monitor.id);
                  clearSelectionState();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: `1px solid ${isActive ? `${accent}88` : BORDER}`,
                  background: isActive ? `${accent}20` : 'rgba(255,255,255,0.03)',
                  color: isActive ? '#f4f6ff' : MUTED,
                  cursor: 'pointer',
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                <Monitor size={11} style={{ flexShrink: 0 }} />
                {monitor.name.trim() || `Display ${index + 1}`}
                {monitor.isActive && (
                  <span
                    style={{
                      padding: '1px 5px',
                      borderRadius: 999,
                      background: `${accent}20`,
                      border: `1px solid ${accent}44`,
                      fontSize: 9,
                      color: accent,
                    }}
                  >
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {toolPhase === 'edit' && stage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL,
            fontSize: 10.5,
            color: MUTED,
          }}
        >
          <button
            type="button"
            onClick={() => void dismissStage(false)}
            style={btnStyle(false, accent)}
          >
            <ArrowLeft size={11} />
            Back to Capture
          </button>
          <span>
            {stage.scope === 'monitor'
              ? 'Editing the full monitor capture.'
              : 'Editing the selected region.'}
          </span>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 8,
          background: 'var(--overlay-bg-shell)',
          overflow: 'hidden',
        }}
      >
        {toolPhase === 'edit' && stage ? (
          <ExplorerImageEditor
            ref={editorRef}
            imagePath={stage.path}
            imageName={`${screenshotFeatureConfig.filePrefix}.${stage.path.split('.').pop() ?? 'png'}`}
            imageSource={stage.source}
            mode="edit"
          />
        ) : isHydratingMonitors && monitors.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              color: MUTED,
            }}
          >
            <LoaderCircle size={28} className="animate-spin" style={{ color: accent }} />
            <div style={{ fontSize: 12 }}>Finding screenshotable displays…</div>
          </div>
        ) : !activeMonitor ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              color: MUTED,
            }}
          >
            <ImageIcon size={32} strokeWidth={1} />
            <div style={{ fontSize: 12 }}>No display available for capture.</div>
            <button
              type="button"
              onClick={() => void hydrateMonitors()}
              style={btnStyle(true, accent)}
            >
              <RefreshCw size={13} />
              Refresh Displays
            </button>
          </div>
        ) : !activeMonitor.capturePath || !activeMonitor.captureUrl ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              color: MUTED,
            }}
          >
            {activeMonitor.isCapturing ? (
              <LoaderCircle size={28} className="animate-spin" style={{ color: accent }} />
            ) : (
              <Crosshair size={28} />
            )}
            <div style={{ fontSize: 12 }}>
              {activeMonitor.isCapturing
                ? 'Capturing active display…'
                : activeMonitor.captureError ?? 'Capture this display to start editing.'}
            </div>
            {!activeMonitor.isCapturing && (
              <button
                type="button"
                onClick={() => void ensureMonitorCapture(activeMonitor.id, { force: true })}
                style={btnStyle(true, accent)}
              >
                <Crosshair size={13} />
                Capture
              </button>
            )}
          </div>
        ) : (
          <div
            ref={previewContainerRef}
            tabIndex={0}
            aria-label="Screenshot selection preview"
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
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${activeMonitor.imageWidth} / ${activeMonitor.imageHeight}`,
              borderRadius: 10,
              overflow: 'hidden',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: activeMonitor.isCapturing ? 'wait' : 'crosshair',
              touchAction: 'none',
              willChange: 'transform',
              isolation: 'isolate',
            }}
          >
            <img
              src={activeMonitor.captureUrl}
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
              <div
                data-testid="screenshot-grid"
                aria-label="Screenshot composition grid"
                style={buildGridOverlay(accent)}
              />
            )}

            {normalizedSelection &&
              normalizedSelection.width >= 2 &&
              normalizedSelection.height >= 2 && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.46)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: normalizedSelection.x,
                      top: normalizedSelection.y,
                      width: normalizedSelection.width,
                      height: normalizedSelection.height,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.46)',
                      border: `2px solid ${accent}`,
                      outline: '1px solid rgba(255,255,255,0.35)',
                      pointerEvents: 'none',
                    }}
                  />
                  {getSelectionHandleLayout(normalizedSelection).map((handle) => (
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
                  {selectionPixels && (
                    <div
                      style={{
                        position: 'absolute',
                        pointerEvents: 'none',
                        left: normalizedSelection.x + normalizedSelection.width / 2,
                        top: Math.min(
                          normalizedSelection.y + normalizedSelection.height + 6,
                          (previewContainerRef.current?.getBoundingClientRect().height ?? 9999) - 28,
                        ),
                        transform: 'translateX(-50%)',
                        background: 'rgba(5,8,15,0.92)',
                        border: `1px solid ${accent}55`,
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#e8ecff',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--overlay-font-mono, monospace)',
                      }}
                    >
                      {normalizeSelection(selectionPixels).width}×{normalizeSelection(selectionPixels).height}
                    </div>
                  )}
                </>
              )}

            {(isPreparingStage || isFinishingStage || activeMonitor.isCapturing) && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    color: '#eef0ff',
                  }}
                >
                  <LoaderCircle size={24} className="animate-spin" style={{ color: accent }} />
                  <div style={{ fontSize: 11 }}>
                    {activeMonitor.isCapturing
                      ? 'Capturing display…'
                      : isPreparingStage
                        ? 'Preparing editor…'
                        : 'Finishing screenshot…'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '6px 8px',
          borderTop: `1px solid ${BORDER}`,
          background: PANEL,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {toolPhase === 'edit' && stage ? (
          <>
            <span style={{ fontSize: 10, color: MUTED }}>Finish capture:</span>
            {orderedOutputActions.map((action) => {
              const primary = action.id === screenshotSettings.defaultOutputAction;
              return (
                <button
                  key={`edit-${action.id}`}
                  type="button"
                  onClick={() => void finalizeStageAction(action.id)}
                  disabled={isBusy}
                  style={btnStyle(primary, accent, isBusy)}
                >
                  {action.id === 'copy' ? (
                    <Copy size={11} />
                  ) : action.id === 'save' ? (
                    <Save size={11} />
                  ) : (
                    <Check size={11} />
                  )}
                  {action.label}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => void dismissStage(false)}
              style={btnStyle(false, accent, isBusy)}
            >
              <ArrowLeft size={11} />
              Back
            </button>
          </>
        ) : hasSelection ? (
          <>
            <span style={{ fontSize: 10, color: MUTED }}>
              Refine the area, then open it in the shared editor:
            </span>
            <button
              type="button"
              onClick={() => void beginStageFromActiveCapture('region')}
              disabled={isBusy}
              style={btnStyle(true, accent, isBusy)}
            >
              <Scissors size={11} />
              Edit Selection
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={clearSelectionState}
              style={btnStyle(false, accent, isBusy)}
            >
              Clear
            </button>
          </>
        ) : activeMonitor?.capturePath ? (
          <>
            <span style={{ fontSize: 10, color: MUTED }}>
              {screenshotSettings.defaultCaptureMode === 'monitor'
                ? 'Full monitor opens straight into the editor. Drag a region if you want a snip instead:'
                : 'Draw a region, or send the whole monitor into the editor:'}
            </span>
            <button
              type="button"
              onClick={() => void beginStageFromActiveCapture('monitor')}
              disabled={isBusy}
              style={btnStyle(true, accent, isBusy)}
            >
              <Maximize2 size={11} />
              Edit Full Monitor
            </button>
          </>
        ) : (
          <span style={{ fontSize: 10, color: MUTED }}>
            Capture a display to begin.
          </span>
        )}
      </div>
    </div>
  );

  const libraryContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#edf1ff' }}>
          Library
        </div>
        <div style={{ fontSize: 10, color: MUTED }}>
          {visibleCount}/{totalCount}
        </div>
      </div>

      <OverlayScrollArea
        style={{ flex: 1, minHeight: 0 }}
        viewportStyle={{ padding: 8 }}
      >
        {items.length === 0 ? (
          <div
            style={{ padding: 20, textAlign: 'center', color: MUTED, fontSize: 11 }}
          >
            No screenshots yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {items.map((item) => {
              const isCopyingItem = copyingPath === item.path;
              const isCopiedItem = copiedPath === item.path;
              const isDeletingItem = deletingPath === item.path;

              return (
                <div
                  key={item.path}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '76px minmax(0,1fr)',
                    gap: 8,
                    alignItems: 'start',
                    borderRadius: 8,
                    border: `1px solid ${isCopiedItem ? `${accent}77` : BORDER}`,
                    background: isCopiedItem ? `${accent}12` : PANEL_ALT,
                    padding: 6,
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '16/9',
                      borderRadius: 5,
                      overflow: 'hidden',
                      border: `1px solid ${BORDER}`,
                      background: '#050510',
                    }}
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <ImageIcon size={14} style={{ color: MUTED }} />
                      </div>
                    )}
                  </div>

                  <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#eef0ff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 9, color: MUTED }}>
                      {new Date(item.modified).toLocaleString()} · {formatFileSize(item.size)}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => void copyGalleryItem(item)}
                        disabled={isDeletingItem}
                        style={btnStyle(true, accent, isCopyingItem || isDeletingItem)}
                      >
                        {isCopyingItem ? (
                          <LoaderCircle size={10} className="animate-spin" />
                        ) : isCopiedItem ? (
                          <Check size={10} />
                        ) : (
                          <Copy size={10} />
                        )}
                        {isCopiedItem ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          revealExplorerPath(item.path).catch((revealError) =>
                            setError(String(revealError)),
                          )
                        }
                        disabled={isDeletingItem}
                        style={btnStyle(false, accent, isDeletingItem)}
                      >
                        <Search size={10} />
                        Reveal
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openExplorerPath(item.path).catch((openError) =>
                            setError(String(openError)),
                          )
                        }
                        disabled={isDeletingItem}
                        style={btnStyle(false, accent, isDeletingItem)}
                      >
                        <ExternalLink size={10} />
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteItem(item)}
                        disabled={isDeletingItem}
                        style={btnStyle(false, accent, isDeletingItem)}
                      >
                        {isDeletingItem ? (
                          <LoaderCircle size={10} className="animate-spin" />
                        ) : (
                          <Trash2 size={10} />
                        )}
                        {isDeletingItem ? 'Deleting' : 'Delete'}
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
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        background: 'var(--overlay-bg-shell)',
        color: TEXT,
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <div
        style={{
          width: 46,
          minWidth: 46,
          borderRight: `1px solid ${BORDER}`,
          background: 'var(--overlay-bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 4px',
          gap: 6,
        }}
      >
        <RailButton
          active={activeSection === 'tool'}
          label="Tool"
          accent={accent}
          onClick={() => void handleActivateSection('tool')}
        >
          <Crosshair size={16} />
        </RailButton>
        <RailButton
          active={activeSection === 'library'}
          label="Library"
          accent={accent}
          onClick={() => void handleActivateSection('library')}
        >
          <ImageIcon size={16} />
        </RailButton>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '6px 8px',
            borderBottom: `1px solid ${BORDER}`,
            background: PANEL,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f0f3ff' }}>
            {activeSection === 'tool' ? 'Screenshot Tool' : 'Screenshot Library'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => void recaptureActiveMonitor()}
              disabled={isBusy || activeMonitorId == null}
              style={btnStyle(false, accent, isBusy || activeMonitorId == null)}
            >
              <RefreshCw size={13} />
              Recapture
            </button>
            <button
              type="button"
              onClick={() =>
                openExplorerPath(screenshotDir).catch((folderError) =>
                  setError(String(folderError)),
                )
              }
              style={btnStyle(false, accent)}
            >
              <FolderOpen size={13} />
              Folder
            </button>
          </div>
        </div>

        {(error || statusMsg) && (
          <div
            style={{
              padding: '5px 10px',
              fontSize: 10,
              borderBottom: `1px solid ${BORDER}`,
              background: error ? 'rgba(127,29,29,0.28)' : `${accent}12`,
              color: error ? '#fca5a5' : '#e7ebff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ minWidth: 0, flex: 1 }}>{error ?? statusMsg}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatusMsg(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                padding: 2,
                opacity: 0.7,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {activeSection === 'tool' ? (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            {toolContent}
            <ResizablePane
              size={libraryWidth}
              minSize={220}
              maxSize={480}
              onSizeChange={setLibraryWidth}
              borderColor={`${accent}44`}
              handleSide="left"
              style={{
                borderLeft: `1px solid ${BORDER}`,
                background: PANEL,
              }}
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
        description={
          pendingDeleteItem
            ? `Delete ${pendingDeleteItem.name} from the screenshot library?`
            : ''
        }
        icon={<Trash2 size={16} style={{ color: '#f87171' }} />}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          void deleteGalleryItem();
        }}
        onCancel={() => setPendingDeleteItem(null)}
      />

      <style>{`.animate-spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

function btnStyle(
  primary: boolean,
  accent: string,
  disabled = false,
): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 9px',
    borderRadius: 7,
    fontSize: 10.5,
    fontWeight: 600,
    border: `1px solid ${primary ? accent : BORDER}`,
    background: disabled
      ? 'rgba(255,255,255,0.04)'
      : primary
        ? `${accent}22`
        : 'rgba(255,255,255,0.03)',
    color: disabled
      ? 'rgba(255,255,255,0.35)'
      : primary
        ? '#f4f5ff'
        : '#cdd0ee',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export default ScreenshotsManager;
