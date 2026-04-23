import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Redo2, ZoomIn } from 'lucide-react';

import {
  ArrowUpRight,
  Circle,
  Maximize2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
} from '@/components/AppIcons';
import { matchesKeybinding } from '../config/hotkeys';
import { getImageEditorContentType } from '../config/filePreview';
import { writeExplorerFile } from '../runtime/explorerBackend';
import {
  initExplorerImageEditor,
  type ExplorerImageEditorHandle,
} from '../runtime/imageEditorRuntime';
import { useSettingsStore } from '../store/settingsStore';

type ExplorerImageEditorProps = {
  imagePath: string;
  imageName: string;
  imageSource: string;
  mode?: 'preview' | 'edit';
  onSaved?: () => Promise<void> | void;
};

export interface ExplorerImageEditorRef {
  save: () => Promise<boolean>;
  hasUnsavedChanges: () => boolean;
  resetToSavedState: () => Promise<void>;
}

type ImageEditorSaveState = 'loading' | 'saved' | 'dirty' | 'saving' | 'error';

function getImageExtension(name: string): string {
  return name.trim().split('.').pop()?.toLowerCase() ?? '';
}

function cloneEditorState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function blobToByteArray(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  return (
    element.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName) ||
    Boolean(element.closest('[contenteditable="true"]'))
  );
}

function toolbarButtonStyle(
  variant: 'primary' | 'default' | 'danger' | 'subtle' = 'default',
) {
  const baseStyle = {
    appearance: 'none' as const,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 120ms ease, background 120ms ease, border-color 120ms ease',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
  };

  if (variant === 'primary') {
    return {
      ...baseStyle,
      background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.34), rgba(59, 130, 246, 0.22))',
      border: '1px solid rgba(129, 140, 248, 0.45)',
      color: '#f8fbff',
    };
  }

  if (variant === 'danger') {
    return {
      ...baseStyle,
      background: 'rgba(239, 68, 68, 0.14)',
      border: '1px solid rgba(248, 113, 113, 0.28)',
      color: '#fecaca',
    };
  }

  if (variant === 'subtle') {
    return {
      ...baseStyle,
      background: 'rgba(255, 255, 255, 0.035)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: 'var(--overlay-text-muted)',
      boxShadow: 'none',
    };
  }

  return {
    ...baseStyle,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    color: 'var(--overlay-text-primary)',
  };
}

export const ExplorerImageEditor = forwardRef<
  ExplorerImageEditorRef,
  ExplorerImageEditorProps
>(function ExplorerImageEditor(
  {
    imagePath,
    imageName,
    imageSource,
    mode = 'edit',
    onSaved,
  },
  forwardedRef,
) {
  const editorContainerId = useId().replace(/:/g, '_');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ExplorerImageEditorHandle | null>(null);
  const savedEditorStateRef = useRef<unknown>(null);
  const savedStateSignatureRef = useRef('');
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);

  const [saveState, setSaveState] = useState<ImageEditorSaveState>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading editor…');
  const [initError, setInitError] = useState<string | null>(null);

  const keybindings = useSettingsStore((state) => state.settings.keybindings);
  const contentType = getImageEditorContentType(getImageExtension(imageName));
  const isEditableFormat = contentType !== null;
  const showEditingChrome = isEditableFormat && mode === 'edit';

  const setDirtyState = useCallback((nextDirty: boolean, nextMessage?: string) => {
    dirtyRef.current = nextDirty;
    setSaveState(nextDirty ? 'dirty' : 'saved');
    setStatusMessage(nextMessage ?? (nextDirty ? 'Unsaved changes' : 'Saved to disk'));
  }, []);

  const syncDirtyState = useCallback((editorOverride?: ExplorerImageEditorHandle | null) => {
    const editor = editorOverride ?? editorRef.current;
    if (!editor || !savedEditorStateRef.current) {
      return;
    }

    const nextSignature = JSON.stringify(editor.historyManager.getFullState());
    setDirtyState(nextSignature !== savedStateSignatureRef.current);
  }, [setDirtyState]);

  const performSave = useCallback(async (): Promise<boolean> => {
    const editor = editorRef.current;
    if (!editor || !contentType) {
      return false;
    }

    if (!dirtyRef.current) {
      return true;
    }

    setSaveState('saving');
    setStatusMessage('Writing image…');

    try {
      const exportResult = await editor.imageManager.exportCanvasAsImageFile({
        fileName: imageName,
        contentType,
        exportAsBlob: true,
      });

      if (!exportResult || !(exportResult.image instanceof Blob)) {
        throw new Error('Image export returned no binary payload.');
      }

      await writeExplorerFile(imagePath, await blobToByteArray(exportResult.image));

      const savedSnapshot = cloneEditorState(editor.historyManager.getFullState());
      savedEditorStateRef.current = savedSnapshot;
      savedStateSignatureRef.current = JSON.stringify(savedSnapshot);
      setDirtyState(false);
      await onSaved?.();
      return true;
    } catch (error) {
      setSaveState('error');
      setStatusMessage(String(error));
      return false;
    }
  }, [contentType, imageName, imagePath, onSaved, setDirtyState]);

  const resetToSavedState = useCallback(async () => {
    const editor = editorRef.current;
    const savedState = savedEditorStateRef.current;
    if (!editor || !savedState) {
      return;
    }

    setStatusMessage('Resetting changes…');
    try {
      await editor.historyManager.loadStateFromFullState(
        cloneEditorState(savedState),
      );
      setDirtyState(false);
    } catch (error) {
      setSaveState('error');
      setStatusMessage(String(error));
    }
  }, [setDirtyState]);

  const handleUndo = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    await editor.historyManager.undo();
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleRedo = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    await editor.historyManager.redo();
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleAddText = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.textManager.addText();
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleAddSquare = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    await editor.shapeManager.add({ presetKey: 'square' });
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleAddCircle = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    await editor.shapeManager.add({ presetKey: 'circle' });
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleAddArrow = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    await editor.shapeManager.add({ presetKey: 'arrow-right-fat' });
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleDeleteSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.deletionManager.deleteSelectedObjects();
    syncDirtyState(editor);
  }, [syncDirtyState]);

  const handleZoomIn = useCallback(() => {
    editorRef.current?.zoomManager.zoom(0.12);
  }, []);

  const handleResetZoom = useCallback(() => {
    editorRef.current?.zoomManager.resetZoom();
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      save: performSave,
      hasUnsavedChanges: () => dirtyRef.current,
      resetToSavedState,
    }),
    [performSave, resetToSavedState],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isEditableFormat || !editorHostRef.current) {
      setInitError(null);
      setSaveState('saved');
      setStatusMessage('Static preview');
      dirtyRef.current = false;
      return;
    }

    const host = editorHostRef.current;
    host.innerHTML = '';
    setInitError(null);
    setSaveState('loading');
    setStatusMessage('Loading editor…');
    dirtyRef.current = false;
    savedEditorStateRef.current = null;
    savedStateSignatureRef.current = '';

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let eventBindings: Array<{
      eventName: string;
      handler: (payload?: unknown) => void;
    }> = [];

    void initExplorerImageEditor(editorContainerId, {
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
        source: imageSource,
        scale: 'scale-montage',
        withoutSave: true,
      },
    })
      .then((editor) => {
        if (cancelled || !mountedRef.current) {
          editor.destroy();
          return;
        }

        editorRef.current = editor;
        const savedSnapshot = cloneEditorState(editor.historyManager.getFullState());
        savedEditorStateRef.current = savedSnapshot;
        savedStateSignatureRef.current = JSON.stringify(savedSnapshot);
        dirtyRef.current = false;
        setSaveState('saved');
        setStatusMessage(showEditingChrome ? 'Saved to disk' : 'Preview ready');

        const syncHandler = () => syncDirtyState(editor);
        const warningHandler = (payload?: unknown) => {
          if (!mountedRef.current || dirtyRef.current) {
            return;
          }

          setStatusMessage(
            typeof payload === 'object' && payload && 'message' in payload
              ? String(payload.message ?? 'Editor warning')
              : 'Editor warning',
          );
        };
        const errorHandler = (payload?: unknown) => {
          if (!mountedRef.current) {
            return;
          }

          setSaveState('error');
          setStatusMessage(
            typeof payload === 'object' && payload && 'message' in payload
              ? String(payload.message ?? 'Editor error')
              : 'Editor error',
          );
        };

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

        eventBindings = [
          ...dirtyEvents.map((eventName) => ({ eventName, handler: syncHandler })),
          { eventName: 'editor:warning', handler: warningHandler },
          { eventName: 'editor:error', handler: errorHandler },
        ];

        for (const binding of eventBindings) {
          editor.canvas.on(binding.eventName, binding.handler);
        }

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            editor.canvasManager.updateCanvas();
          });
          resizeObserver.observe(host);
        }
      })
      .catch((error) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setInitError(String(error));
        setSaveState('error');
        setStatusMessage('Image editor unavailable');
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();

      const editor = editorRef.current;
      if (editor) {
        for (const binding of eventBindings) {
          editor.canvas.off(binding.eventName, binding.handler);
        }
        editor.destroy();
      }

      editorRef.current = null;
      savedEditorStateRef.current = null;
      savedStateSignatureRef.current = '';
      dirtyRef.current = false;
      host.innerHTML = '';
    };
  }, [editorContainerId, imageSource, isEditableFormat, showEditingChrome, syncDirtyState]);

  useEffect(() => {
    if (!showEditingChrome) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const activeElement = document.activeElement;
      const hasEditorFocus = Boolean(
        root && (root.contains(activeElement) || activeElement === document.body),
      );

      if (!hasEditorFocus || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (matchesKeybinding(event, keybindings.saveFile)) {
        event.preventDefault();
        void performSave();
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
        void resetToSavedState();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleRedo,
    handleUndo,
    keybindings.imageEditorRedo,
    keybindings.imageEditorReset,
    keybindings.imageEditorUndo,
    keybindings.saveFile,
    performSave,
    resetToSavedState,
    showEditingChrome,
  ]);

  const statusTone = saveState === 'error'
    ? '#fecaca'
    : saveState === 'dirty'
      ? '#fde68a'
      : saveState === 'saving'
        ? '#bfdbfe'
        : '#bbf7d0';

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
          {showEditingChrome ? (
            <>
              <button type="button" onClick={() => void performSave()} style={toolbarButtonStyle('primary')}>
                <Save size={14} />
                Save
              </button>
              <button type="button" onClick={() => void resetToSavedState()} style={toolbarButtonStyle()}>
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
              <button type="button" onClick={handleAddText} style={toolbarButtonStyle()}>
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
              <button type="button" onClick={() => void handleAddArrow()} style={toolbarButtonStyle()}>
                <ArrowUpRight size={14} />
                Arrow
              </button>
              <button type="button" onClick={handleDeleteSelection} style={toolbarButtonStyle('danger')}>
                <Trash2 size={14} />
                Delete
              </button>
            </>
          ) : (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--overlay-text-primary)' }}>
                Interactive image preview
              </span>
              <span style={{ fontSize: 10, color: 'var(--overlay-text-muted)' }}>
                Drag to pan, scroll to zoom, double-click to refit the image.
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleZoomIn} style={toolbarButtonStyle(showEditingChrome ? 'default' : 'subtle')}>
            <ZoomIn size={14} />
            Zoom
          </button>
          <button type="button" onClick={handleResetZoom} style={toolbarButtonStyle(showEditingChrome ? 'default' : 'subtle')}>
            <Maximize2 size={14} />
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
          {initError ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 18,
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
                }}
              />
            </div>
          ) : (
            <div
              id={editorContainerId}
              ref={editorHostRef}
              data-testid="explorer-image-editor-canvas"
              style={{ width: '100%', height: '100%' }}
            />
          )}
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
                {initError ?? 'Spinning up the shared image editing surface for this preview.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
