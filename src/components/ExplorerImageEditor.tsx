import { useEffect, useId, useRef, useState } from 'react';
import {
  Circle,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import {
  IMAGE_EDITOR_BASE_IMAGE_CUSTOM_DATA,
  createDefaultImageAdjustmentState,
  findImageAdjustmentDefinition,
  imageEditorAdjustmentRailOrder,
} from '../config/imageEditorFilters';
import { matchesKeybinding } from '../config/hotkeys';
import { writeExplorerFile } from '../runtime/explorerBackend';
import {
  closeExplorerImageEditorSession,
  createExplorerImageEditorSession,
  exportExplorerImageEditorResult,
  renderExplorerImageEditorPreview,
  type ExplorerImageAdjustmentState,
  type ExplorerImageEditorSessionBootstrap,
  type ExplorerImageFilterPresetDefinition,
  type ExplorerImageFilterPresetId,
} from '../runtime/imageEditorBackend';
import {
  initExplorerImageEditor,
  type ExplorerImageEditorHandle,
} from '../runtime/imageEditorRuntime';
import { useSettingsStore } from '../store/settingsStore';

type ExplorerImageEditorProps = {
  imagePath: string;
  imageName: string;
  imageSource: string;
  onSaved?: () => Promise<void> | void;
};

type ImageEditorSaveState = 'loading' | 'saved' | 'dirty' | 'saving' | 'error';
type PreviewLoadState = 'idle' | 'loading' | 'error';

const IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function getImageExtension(name: string): string {
  return name.trim().split('.').pop()?.toLowerCase() ?? '';
}

function getImageEditorContentType(name: string): string | null {
  return IMAGE_EDITOR_CONTENT_TYPE_BY_EXTENSION[getImageExtension(name)] ?? null;
}

function cloneEditorState<T>(state: T): T {
  return JSON.parse(JSON.stringify(state)) as T;
}

function cloneAdjustmentState(state: ExplorerImageAdjustmentState): ExplorerImageAdjustmentState {
  return { ...state };
}

function getFilterStateSignature(
  presetId: ExplorerImageFilterPresetId,
  adjustments: ExplorerImageAdjustmentState,
): string {
  return JSON.stringify({ presetId, adjustments });
}

async function blobToByteArray(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  return element.isContentEditable
    || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
    || Boolean(element.closest('.monaco-editor'));
}

function toolbarButtonStyle(variant: 'primary' | 'default' | 'danger' = 'default') {
  const palette = {
    primary: {
      background: 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08))',
      border: '1px solid rgba(255,255,255,0.26)',
      color: 'var(--overlay-text-primary)',
    },
    default: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
      color: 'var(--overlay-text-primary)',
    },
    danger: {
      background: 'rgba(255, 93, 93, 0.12)',
      border: '1px solid rgba(255, 93, 93, 0.25)',
      color: '#ffb0b0',
    },
  }[variant];

  return {
    ...palette,
    appearance: 'none' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 140ms ease, border-color 140ms ease, transform 140ms ease',
    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.22)',
  };
}

function railChipStyle(active: boolean) {
  return {
    appearance: 'none' as const,
    border: active ? '1px solid rgba(255,255,255,0.34)' : '1px solid rgba(255,255,255,0.12)',
    background: active
      ? 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))'
      : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--overlay-text-primary)' : 'var(--overlay-text-muted)',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    padding: '8px 12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  };
}

function sliderStyle() {
  return {
    width: '100%',
    accentColor: '#f7f2d4',
    cursor: 'pointer',
  };
}

export function ExplorerImageEditor({
  imagePath,
  imageName,
  imageSource,
  onSaved,
}: ExplorerImageEditorProps) {
  const containerId = useId().replace(/:/g, '_');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ExplorerImageEditorHandle | null>(null);
  const savedStateRef = useRef<unknown>(null);
  const savedStateSignatureRef = useRef('');
  const mountedRef = useRef(true);
  const saveResetTimerRef = useRef<number | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewRequestSequenceRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const selectedPresetIdRef = useRef<ExplorerImageFilterPresetId>('original');
  const adjustmentsRef = useRef<ExplorerImageAdjustmentState>(createDefaultImageAdjustmentState());
  const savedPresetIdRef = useRef<ExplorerImageFilterPresetId>('original');
  const savedAdjustmentsRef = useRef<ExplorerImageAdjustmentState>(createDefaultImageAdjustmentState());
  const savedFilterSignatureRef = useRef(
    getFilterStateSignature('original', createDefaultImageAdjustmentState()),
  );

  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  const [saveState, setSaveState] = useState<ImageEditorSaveState>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading editor…');
  const [previewState, setPreviewState] = useState<PreviewLoadState>('idle');
  const [previewStatusMessage, setPreviewStatusMessage] = useState('Native preview ready');
  const [initError, setInitError] = useState<string | null>(null);
  const [sessionBootstrap, setSessionBootstrap] = useState<ExplorerImageEditorSessionBootstrap | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<ExplorerImageFilterPresetId>('original');
  const [adjustments, setAdjustments] = useState<ExplorerImageAdjustmentState>(createDefaultImageAdjustmentState());
  const [activeAdjustmentKey, setActiveAdjustmentKey] =
    useState<keyof ExplorerImageAdjustmentState>('brightness');

  const contentType = getImageEditorContentType(imageName);
  const isEditableFormat = contentType !== null;
  const activeAdjustment = findImageAdjustmentDefinition(activeAdjustmentKey);
  const presetDefinitions = sessionBootstrap?.presets ?? [];

  function clearSaveResetTimer() {
    if (saveResetTimerRef.current != null) {
      window.clearTimeout(saveResetTimerRef.current);
      saveResetTimerRef.current = null;
    }
  }

  function clearPreviewTimer() {
    if (previewTimerRef.current != null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }

  function scheduleSavedStateReset() {
    clearSaveResetTimer();
    saveResetTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }
      setSaveState('saved');
      setStatusMessage('Saved to disk');
    }, 1600);
  }

  function updateDirtyState(editorOverride?: ExplorerImageEditorHandle | null) {
    const editor = editorOverride ?? editorRef.current;
    if (!editor || !savedStateRef.current) {
      return;
    }

    const editorSignature = JSON.stringify(editor.historyManager.getFullState());
    const filterSignature = getFilterStateSignature(selectedPresetIdRef.current, adjustmentsRef.current);
    const isDirty = editorSignature !== savedStateSignatureRef.current
      || filterSignature !== savedFilterSignatureRef.current;

    clearSaveResetTimer();
    if (saveState !== 'saving' && saveState !== 'error') {
      setSaveState(isDirty ? 'dirty' : 'saved');
      setStatusMessage(isDirty ? 'Unsaved changes' : 'Saved to disk');
    }
  }

  async function replaceBaseImageSource(source: string) {
    const editor = editorRef.current;
    const sessionId = sessionIdRef.current;
    if (!editor || !sessionId) {
      throw new Error('Image editor base image is not ready.');
    }

    const result = await editor.imageManager.replaceManagedImageSource({
      source,
      matchCustomData: {
        ...IMAGE_EDITOR_BASE_IMAGE_CUSTOM_DATA,
        sessionId,
      },
      withoutSave: true,
      withoutSelection: true,
    });

    if (!result) {
      throw new Error('The base image preview could not be updated.');
    }
  }

  function updatePreset(nextPresetId: ExplorerImageFilterPresetId) {
    selectedPresetIdRef.current = nextPresetId;
    setSelectedPresetId(nextPresetId);
  }

  function updateAdjustments(
    nextAdjustments:
      | ExplorerImageAdjustmentState
      | ((current: ExplorerImageAdjustmentState) => ExplorerImageAdjustmentState),
  ) {
    setAdjustments((current) => {
      const resolved = typeof nextAdjustments === 'function'
        ? nextAdjustments(current)
        : nextAdjustments;
      adjustmentsRef.current = resolved;
      return resolved;
    });
  }

  function resetActiveAdjustment() {
    updateAdjustments((current) => ({
      ...current,
      [activeAdjustmentKey]: 0,
    }));
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSaveResetTimer();
      clearPreviewTimer();
    };
  }, []);

  useEffect(() => {
    selectedPresetIdRef.current = selectedPresetId;
    if (editorRef.current) {
      updateDirtyState(editorRef.current);
    }
  }, [selectedPresetId]);

  useEffect(() => {
    adjustmentsRef.current = adjustments;
    if (editorRef.current) {
      updateDirtyState(editorRef.current);
    }
  }, [adjustments]);

  useEffect(() => {
    if (!isEditableFormat || !canvasHostRef.current) {
      setInitError(null);
      setSessionBootstrap(null);
      setSaveState('saved');
      setStatusMessage('Static preview');
      setPreviewState('idle');
      setPreviewStatusMessage('Static preview');
      return;
    }

    const host = canvasHostRef.current;
    host.innerHTML = '';
    setInitError(null);
    setSessionBootstrap(null);
    setSaveState('loading');
    setStatusMessage('Loading editor…');
    setPreviewState('idle');
    setPreviewStatusMessage('Preparing native preview…');

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let eventBindings: Array<{ eventName: string; handler: () => void }> = [];

    const loadEditor = async () => {
      const bootstrap = await createExplorerImageEditorSession({ inputPath: imagePath });
      if (cancelled || !mountedRef.current) {
        await closeExplorerImageEditorSession(bootstrap.sessionId);
        return;
      }

      sessionIdRef.current = bootstrap.sessionId;
      setSessionBootstrap(bootstrap);
      updatePreset(bootstrap.presets[0]?.id ?? 'original');

      const defaultAdjustments = createDefaultImageAdjustmentState();
      adjustmentsRef.current = defaultAdjustments;
      savedAdjustmentsRef.current = cloneAdjustmentState(defaultAdjustments);
      setAdjustments(defaultAdjustments);
      savedPresetIdRef.current = bootstrap.presets[0]?.id ?? 'original';
      savedFilterSignatureRef.current = getFilterStateSignature(
        savedPresetIdRef.current,
        savedAdjustmentsRef.current,
      );

      const editor = await initExplorerImageEditor(containerId, {
        editorContainerWidth: '100%',
        editorContainerHeight: '100%',
        canvasWrapperWidth: '100%',
        canvasWrapperHeight: '100%',
        canvasCSSWidth: '100%',
        canvasCSSHeight: '100%',
        adaptCanvasToContainerOnResize: true,
        canvasDragging: true,
        mouseWheelZooming: true,
        undoRedoByHotKeys: false,
        copyObjectsByHotkey: false,
        pasteImageFromClipboard: false,
        selectAllByHotkey: false,
        deleteObjectsByHotkey: false,
        resetObjectFitByDoubleClick: true,
        defaultScale: 0.92,
        minZoom: 0.05,
        maxZoom: 8,
        scaleType: 'contain',
        showToolbar: false,
        overlayMaskColor: 'rgba(8, 10, 14, 0.68)',
        keyboardIgnoreSelectors: ['input', 'textarea', 'button', '[contenteditable="true"]'],
        initialImage: {
          source: bootstrap.previewDataUrl,
          scale: 'scale-montage',
          withoutSave: true,
          customData: {
            ...IMAGE_EDITOR_BASE_IMAGE_CUSTOM_DATA,
            sessionId: bootstrap.sessionId,
          },
        } as never,
      });

      if (cancelled || !mountedRef.current) {
        editor.destroy();
        await closeExplorerImageEditorSession(bootstrap.sessionId);
        return;
      }

      editorRef.current = editor;
      savedStateRef.current = cloneEditorState(editor.historyManager.getFullState());
      savedStateSignatureRef.current = JSON.stringify(savedStateRef.current);
      setSaveState('saved');
      setStatusMessage('Saved to disk');
      setPreviewStatusMessage('Native preview ready');

      const syncDirtyState = () => updateDirtyState(editor);
      const dirtyEvents = [
        'object:added',
        'object:modified',
        'object:removed',
        'editor:history-state-loaded',
        'editor:undo',
        'editor:redo',
        'editor:text-added',
        'editor:text-updated',
        'editor:shape-added',
      ];

      eventBindings = dirtyEvents.map((eventName) => ({ eventName, handler: syncDirtyState }));
      for (const binding of eventBindings) {
        editor.canvas.on(binding.eventName, binding.handler);
      }

      editor.canvas.on('editor:error', (payload) => {
        if (!mountedRef.current) {
          return;
        }
        clearSaveResetTimer();
        setSaveState('error');
        setStatusMessage(
          typeof payload === 'object' && payload && 'message' in payload
            ? String(payload.message ?? 'Editor error')
            : 'Editor error',
        );
      });

      editor.canvas.on('editor:warning', (payload) => {
        if (!mountedRef.current || saveState === 'saving') {
          return;
        }
        setStatusMessage(
          typeof payload === 'object' && payload && 'message' in payload
            ? String(payload.message ?? 'Editor warning')
            : 'Editor warning',
        );
      });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          editor.canvasManager.updateCanvas();
        });
        resizeObserver.observe(host);
      }
    };

    void loadEditor().catch((error) => {
      if (cancelled || !mountedRef.current) {
        return;
      }
      console.error('ExplorerImageEditor: failed to initialize Rust-backed image session', error);
      setInitError(String(error));
      setSaveState('error');
      setStatusMessage('Editor failed to load');
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      clearPreviewTimer();
      previewRequestSequenceRef.current += 1;
      const editor = editorRef.current;
      const sessionId = sessionIdRef.current;
      if (editor) {
        for (const binding of eventBindings) {
          editor.canvas.off(binding.eventName, binding.handler);
        }
        editor.destroy();
      }
      editorRef.current = null;
      savedStateRef.current = null;
      savedStateSignatureRef.current = '';
      host.innerHTML = '';
      sessionIdRef.current = null;
      if (sessionId) {
        void closeExplorerImageEditorSession(sessionId).catch((error) => {
          console.error('ExplorerImageEditor: failed to close image session', error);
        });
      }
    };
  }, [containerId, imagePath, isEditableFormat]);

  useEffect(() => {
    const sessionId = sessionBootstrap?.sessionId;
    const editor = editorRef.current;
    if (!sessionId || !editor) {
      return;
    }

    clearPreviewTimer();
    const requestSequence = previewRequestSequenceRef.current + 1;
    previewRequestSequenceRef.current = requestSequence;

    previewTimerRef.current = window.setTimeout(() => {
      setPreviewState('loading');
      setPreviewStatusMessage('Rendering native preview…');

      void renderExplorerImageEditorPreview({
        sessionId,
        presetId: selectedPresetId,
        adjustments,
      })
        .then(async (result) => {
          if (
            !mountedRef.current
            || previewRequestSequenceRef.current !== requestSequence
            || sessionIdRef.current !== sessionId
          ) {
            return;
          }

          await replaceBaseImageSource(result.previewDataUrl);
          setPreviewState('idle');
          setPreviewStatusMessage('Native preview ready');
        })
        .catch((error) => {
          if (
            !mountedRef.current
            || previewRequestSequenceRef.current !== requestSequence
            || sessionIdRef.current !== sessionId
          ) {
            return;
          }
          console.error('ExplorerImageEditor: preview render failed', error);
          setPreviewState('error');
          setPreviewStatusMessage(String(error));
        });
    }, 120);

    return () => {
      clearPreviewTimer();
    };
  }, [adjustments, selectedPresetId, sessionBootstrap?.sessionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const activeElement = document.activeElement;
      const target = event.target instanceof Node ? event.target : null;
      const hasEditorFocus = Boolean(
        root
        && (
          (target && root.contains(target))
          || (
            activeElement instanceof Node
            && (root.contains(activeElement) || activeElement === document.body)
          )
        ),
      );

      if (!hasEditorFocus || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (matchesKeybinding(event, keybindings.saveFile)) {
        event.preventDefault();
        void handleSave();
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorUndo)) {
        event.preventDefault();
        void handleUndo();
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorRedo)) {
        event.preventDefault();
        void handleRedo();
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorReset)) {
        event.preventDefault();
        void handleReset();
        return;
      }
      if (matchesKeybinding(event, keybindings.deleteItem)) {
        event.preventDefault();
        handleDeleteSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [keybindings, presetDefinitions, selectedPresetId, adjustments, sessionBootstrap?.sessionId]);

  async function handleSave() {
    const editor = editorRef.current;
    const sessionId = sessionIdRef.current;
    if (!editor || !contentType || !sessionId) {
      return;
    }

    clearSaveResetTimer();
    setSaveState('saving');
    setStatusMessage('Baking image…');

    try {
      const bakedResult = await exportExplorerImageEditorResult({
        sessionId,
        presetId: selectedPresetIdRef.current,
        adjustments: adjustmentsRef.current,
        outputContentType: contentType,
      });

      await replaceBaseImageSource(bakedResult.bakedImageDataUrl);

      const result = await editor.imageManager.exportCanvasAsImageFile({
        fileName: imageName,
        contentType,
        exportAsBlob: true,
      });

      if (!result || !(result.image instanceof Blob)) {
        throw new Error('Image export returned no binary payload.');
      }

      await writeExplorerFile(imagePath, await blobToByteArray(result.image));
      savedStateRef.current = cloneEditorState(editor.historyManager.getFullState());
      savedStateSignatureRef.current = JSON.stringify(savedStateRef.current);
      savedPresetIdRef.current = selectedPresetIdRef.current;
      savedAdjustmentsRef.current = cloneAdjustmentState(adjustmentsRef.current);
      savedFilterSignatureRef.current = getFilterStateSignature(
        savedPresetIdRef.current,
        savedAdjustmentsRef.current,
      );
      setSaveState('saved');
      setStatusMessage('Saved to disk');
      setPreviewStatusMessage('Native preview ready');
      scheduleSavedStateReset();
      await onSaved?.();
    } catch (error) {
      console.error('ExplorerImageEditor: save failed', error);
      clearSaveResetTimer();
      setSaveState('error');
      setStatusMessage(String(error));
    }
  }

  async function handleReset() {
    const editor = editorRef.current;
    const savedState = savedStateRef.current;
    const sessionId = sessionIdRef.current;
    if (!editor || !savedState || !sessionId) {
      return;
    }

    clearSaveResetTimer();
    setStatusMessage('Resetting changes…');
    setPreviewState('loading');
    setPreviewStatusMessage('Restoring last saved grade…');

    try {
      await editor.historyManager.loadStateFromFullState(cloneEditorState(savedState));

      const previewResult = await renderExplorerImageEditorPreview({
        sessionId,
        presetId: savedPresetIdRef.current,
        adjustments: savedAdjustmentsRef.current,
      });
      await replaceBaseImageSource(previewResult.previewDataUrl);

      selectedPresetIdRef.current = savedPresetIdRef.current;
      adjustmentsRef.current = cloneAdjustmentState(savedAdjustmentsRef.current);
      setSelectedPresetId(savedPresetIdRef.current);
      setAdjustments(cloneAdjustmentState(savedAdjustmentsRef.current));
      setSaveState('saved');
      setStatusMessage('Saved to disk');
      setPreviewState('idle');
      setPreviewStatusMessage('Native preview ready');
    } catch (error) {
      console.error('ExplorerImageEditor: reset failed', error);
      setPreviewState('error');
      setPreviewStatusMessage(String(error));
      setSaveState('error');
      setStatusMessage(String(error));
    }
  }

  async function handleUndo() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    await editor.historyManager.undo();
    updateDirtyState(editor);
  }

  async function handleRedo() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    await editor.historyManager.redo();
    updateDirtyState(editor);
  }

  async function handleAddText() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.textManager.addText();
    updateDirtyState(editor);
  }

  async function handleAddSquare() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    await editor.shapeManager.add({ presetKey: 'square' });
    updateDirtyState(editor);
  }

  async function handleAddCircle() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    await editor.shapeManager.add({ presetKey: 'circle' });
    updateDirtyState(editor);
  }

  function handleDeleteSelection() {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    editor.deletionManager.deleteSelectedObjects();
    updateDirtyState(editor);
  }

  function handleZoomIn() {
    editorRef.current?.zoomManager.zoom(0.12);
  }

  function handleResetZoom() {
    editorRef.current?.zoomManager.resetZoom();
  }

  const statusTone = saveState === 'error'
    ? '#ffb0b0'
    : saveState === 'dirty'
      ? '#ffd38a'
      : saveState === 'saving'
        ? '#a9d5ff'
        : '#a4f3b1';

  const previewTone = previewState === 'error'
    ? '#ffb0b0'
    : previewState === 'loading'
      ? '#d8e7ff'
      : '#d8f2c4';

  if (!isEditableFormat) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 50%), var(--overlay-explorer-preview-bg)',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--overlay-explorer-preview-border)',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
              Static image preview
            </span>
            <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
              Live editor is available for PNG, JPG, and WebP files.
            </span>
          </div>
          <span
            style={{
              padding: '4px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--overlay-text-muted)',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            {getImageExtension(imageName).toUpperCase() || 'IMAGE'}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <img
            src={imageSource}
            alt={imageName}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 'var(--overlay-explorer-control-radius)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-testid="explorer-image-editor"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 52%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), var(--overlay-explorer-preview-bg)',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid var(--overlay-explorer-preview-border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void handleSave()} style={toolbarButtonStyle('primary')}>
            <Save size={14} />
            Save
          </button>
          <button type="button" onClick={() => void handleReset()} style={toolbarButtonStyle()}>
            <RotateCcw size={14} />
            Reset
          </button>
          <button type="button" onClick={() => void handleUndo()} style={toolbarButtonStyle()}>
            <Undo2 size={14} />
            Undo
          </button>
          <button type="button" onClick={() => void handleRedo()} style={toolbarButtonStyle()}>
            <Redo2 size={14} />
            Redo
          </button>
          <button type="button" onClick={() => void handleAddText()} style={toolbarButtonStyle()}>
            <Type size={14} />
            Text
          </button>
          <button type="button" onClick={() => void handleAddSquare()} style={toolbarButtonStyle()}>
            <Square size={14} />
            Square
          </button>
          <button type="button" onClick={() => void handleAddCircle()} style={toolbarButtonStyle()}>
            <Circle size={14} />
            Circle
          </button>
          <button type="button" onClick={handleDeleteSelection} style={toolbarButtonStyle('danger')}>
            <Trash2 size={14} />
            Delete
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleZoomIn} style={toolbarButtonStyle()}>
            <ZoomIn size={14} />
            Zoom
          </button>
          <button type="button" onClick={handleResetZoom} style={toolbarButtonStyle()}>
            <RotateCcw size={14} />
            Fit
          </button>
          <span
            style={{
              padding: '5px 10px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
              color: statusTone,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(5, 8, 12, 0.46)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {statusMessage}
          </span>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          padding: 12,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 12,
            borderRadius: 'calc(var(--overlay-explorer-control-radius) + 6px)',
            border: '1px solid rgba(255,255,255,0.08)',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)), rgba(3, 5, 8, 0.52)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 22px 44px rgba(0,0,0,0.28)',
            overflow: 'hidden',
          }}
        >
          <div
            id={containerId}
            ref={canvasHostRef}
            data-testid="explorer-image-editor-canvas"
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {(saveState === 'loading' || initError) && (
          <div
            style={{
              position: 'absolute',
              inset: 12,
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              textAlign: 'center',
              borderRadius: 'calc(var(--overlay-explorer-control-radius) + 6px)',
              background: 'rgba(4, 6, 10, 0.72)',
              color: 'var(--overlay-text-primary)',
            }}
          >
            <div style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {initError ? 'Image editor unavailable' : 'Loading image editor'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--overlay-text-muted)', lineHeight: 1.5 }}>
                {initError ?? 'Spinning up the embedded editing surface for this preview.'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid var(--overlay-explorer-preview-border)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), rgba(5, 8, 12, 0.72)',
          padding: '12px 14px 14px',
          display: 'grid',
          gap: 12,
        }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--overlay-text-muted)' }}>
                Looks
              </span>
              <span style={{ fontSize: 11, color: 'var(--overlay-text-muted)' }}>
                Rust-backed color grades for the base image only.
              </span>
            </div>
            <span
              style={{
                padding: '5px 10px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                color: previewTone,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(3, 6, 10, 0.5)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {previewStatusMessage}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {presetDefinitions.map((preset: ExplorerImageFilterPresetDefinition) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`image-filter-preset-${preset.id}`}
                onClick={() => updatePreset(preset.id)}
                style={railChipStyle(selectedPresetId === preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {imageEditorAdjustmentRailOrder.map((adjustmentKey) => (
                <button
                  key={adjustmentKey}
                  type="button"
                  data-testid={`image-adjustment-${adjustmentKey}`}
                  onClick={() => setActiveAdjustmentKey(adjustmentKey)}
                  style={railChipStyle(activeAdjustmentKey === adjustmentKey)}
                >
                  {findImageAdjustmentDefinition(adjustmentKey).label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
                {activeAdjustment.label}: {activeAdjustment.formatValue(adjustments[activeAdjustmentKey])}
              </span>
              <button
                type="button"
                onClick={resetActiveAdjustment}
                style={toolbarButtonStyle()}
              >
                <RotateCcw size={13} />
                Reset Control
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            }}
          >
            <input
              data-testid={`image-adjustment-slider-${activeAdjustment.key}`}
              type="range"
              min={activeAdjustment.min}
              max={activeAdjustment.max}
              step={activeAdjustment.step}
              value={adjustments[activeAdjustmentKey]}
              onChange={(event) => {
                const value = Number(event.currentTarget.value);
                updateAdjustments((current) => ({
                  ...current,
                  [activeAdjustmentKey]: value,
                }));
              }}
              style={sliderStyle()}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--overlay-text-muted)' }}>
              <span>{activeAdjustment.formatValue(activeAdjustment.min)}</span>
              <span>{activeAdjustment.formatValue(0)}</span>
              <span>{activeAdjustment.formatValue(activeAdjustment.max)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
