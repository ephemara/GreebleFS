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
import { writeExplorerFile } from '../runtime/explorerBackend';
import {
  initExplorerImageEditor,
  type ExplorerImageEditorHandle,
} from '../runtime/imageEditorRuntime';

type ExplorerImageEditorProps = {
  imagePath: string;
  imageName: string;
  imageSource: string;
  onSaved?: () => Promise<void> | void;
};

type ImageEditorSaveState = 'loading' | 'saved' | 'dirty' | 'saving' | 'error';

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

async function blobToByteArray(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
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

export function ExplorerImageEditor({
  imagePath,
  imageName,
  imageSource,
  onSaved,
}: ExplorerImageEditorProps) {
  const containerId = useId().replace(/:/g, '_');
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ExplorerImageEditorHandle | null>(null);
  const savedStateRef = useRef<object | null>(null);
  const savedStateSignatureRef = useRef('');
  const mountedRef = useRef(true);
  const saveResetTimerRef = useRef<number | null>(null);

  const [saveState, setSaveState] = useState<ImageEditorSaveState>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading editor…');
  const [initError, setInitError] = useState<string | null>(null);
  const contentType = getImageEditorContentType(imageName);
  const isEditableFormat = contentType !== null;

  function clearSaveResetTimer() {
    if (saveResetTimerRef.current != null) {
      window.clearTimeout(saveResetTimerRef.current);
      saveResetTimerRef.current = null;
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

    const nextSignature = JSON.stringify(editor.historyManager.getFullState());
    const isDirty = nextSignature !== savedStateSignatureRef.current;
    clearSaveResetTimer();
    setSaveState(isDirty ? 'dirty' : 'saved');
    setStatusMessage(isDirty ? 'Unsaved changes' : 'Saved to disk');
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSaveResetTimer();
    };
  }, []);

  useEffect(() => {
    if (!isEditableFormat || !canvasHostRef.current) {
      setInitError(null);
      setSaveState('saved');
      setStatusMessage('Static preview');
      return;
    }

    const host = canvasHostRef.current;
    host.innerHTML = '';
    setInitError(null);
    setSaveState('loading');
    setStatusMessage('Loading editor…');

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let eventBindings: Array<{ eventName: string; handler: () => void }> = [];

    void initExplorerImageEditor(containerId, {
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
      } as never,
    })
      .then((editor) => {
        if (cancelled || !mountedRef.current) {
          editor.destroy();
          return;
        }

        editorRef.current = editor;
        savedStateRef.current = cloneEditorState(editor.historyManager.getFullState());
        savedStateSignatureRef.current = JSON.stringify(savedStateRef.current);
        setSaveState('saved');
        setStatusMessage('Saved to disk');

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
          setStatusMessage(payload.message ?? 'Editor error');
        });

        editor.canvas.on('editor:warning', (payload) => {
          if (!mountedRef.current || saveState === 'saving') {
            return;
          }
          setStatusMessage(payload.message ?? 'Editor warning');
        });

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
        setStatusMessage('Editor failed to load');
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
      savedStateRef.current = null;
      savedStateSignatureRef.current = '';
      host.innerHTML = '';
    };
  }, [containerId, imageSource, isEditableFormat]);

  async function handleSave() {
    const editor = editorRef.current;
    if (!editor || !contentType) {
      return;
    }

    clearSaveResetTimer();
    setSaveState('saving');
    setStatusMessage('Writing image…');

    try {
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
      setSaveState('saved');
      setStatusMessage('Saved to disk');
      scheduleSavedStateReset();
      await onSaved?.();
    } catch (error) {
      clearSaveResetTimer();
      setSaveState('error');
      setStatusMessage(String(error));
    }
  }

  async function handleReset() {
    const editor = editorRef.current;
    const savedState = savedStateRef.current;
    if (!editor || !savedState) {
      return;
    }

    clearSaveResetTimer();
    setStatusMessage('Resetting changes…');
    try {
      await editor.historyManager.loadStateFromFullState(cloneEditorState(savedState));
      setSaveState('saved');
      setStatusMessage('Saved to disk');
    } catch (error) {
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
    </div>
  );
}
