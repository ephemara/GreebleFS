import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerImageEditor } from '../components/ExplorerImageEditor';
import { useSettingsStore } from '../store/settingsStore';

const {
  initExplorerImageEditorMock,
  writeExplorerFileMock,
  createExplorerImageEditorSessionMock,
  renderExplorerImageEditorPreviewMock,
  exportExplorerImageEditorResultMock,
  closeExplorerImageEditorSessionMock,
} = vi.hoisted(() => ({
  initExplorerImageEditorMock: vi.fn(),
  writeExplorerFileMock: vi.fn(),
  createExplorerImageEditorSessionMock: vi.fn(),
  renderExplorerImageEditorPreviewMock: vi.fn(),
  exportExplorerImageEditorResultMock: vi.fn(),
  closeExplorerImageEditorSessionMock: vi.fn(),
}));

vi.mock('../runtime/imageEditorRuntime', () => ({
  initExplorerImageEditor: initExplorerImageEditorMock,
}));

vi.mock('../runtime/explorerBackend', () => ({
  writeExplorerFile: writeExplorerFileMock,
}));

vi.mock('../runtime/imageEditorBackend', () => ({
  createExplorerImageEditorSession: createExplorerImageEditorSessionMock,
  renderExplorerImageEditorPreview: renderExplorerImageEditorPreviewMock,
  exportExplorerImageEditorResult: exportExplorerImageEditorResultMock,
  closeExplorerImageEditorSession: closeExplorerImageEditorSessionMock,
}));

function createMockEditorHarness() {
  const listeners = new Map<string, Set<(payload?: unknown) => void>>();
  let currentState: object = { revision: 1 };

  const canvas = {
    on: vi.fn((eventName: string, handler: (payload?: unknown) => void) => {
      const handlers = listeners.get(eventName) ?? new Set<(payload?: unknown) => void>();
      handlers.add(handler);
      listeners.set(eventName, handlers);
    }),
    off: vi.fn((eventName: string, handler: (payload?: unknown) => void) => {
      listeners.get(eventName)?.delete(handler);
    }),
  };

  const editor = {
    canvas,
    historyManager: {
      getFullState: vi.fn(() => currentState),
      loadStateFromFullState: vi.fn(async (nextState: object) => {
        currentState = nextState;
        for (const handler of listeners.get('editor:history-state-loaded') ?? []) {
          handler({ fullState: nextState });
        }
      }),
      undo: vi.fn(async () => {
        currentState = { revision: 0 };
        for (const handler of listeners.get('editor:undo') ?? []) {
          handler({ fullState: currentState });
        }
      }),
      redo: vi.fn(async () => {
        currentState = { revision: 2 };
        for (const handler of listeners.get('editor:redo') ?? []) {
          handler({ fullState: currentState });
        }
      }),
    },
    imageManager: {
      exportCanvasAsImageFile: vi.fn(async () => ({
        image: new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' }),
        format: 'png',
        contentType: 'image/png',
        fileName: 'preview.png',
      })),
      replaceManagedImageSource: vi.fn(async () => ({
        image: {},
        format: 'png',
        contentType: 'image/png',
      })),
    },
    textManager: {
      addText: vi.fn(),
    },
    shapeManager: {
      add: vi.fn(async () => null),
    },
    deletionManager: {
      deleteSelectedObjects: vi.fn(),
    },
    zoomManager: {
      zoom: vi.fn(),
      resetZoom: vi.fn(),
    },
    canvasManager: {
      updateCanvas: vi.fn(),
    },
    destroy: vi.fn(),
  };

  return {
    editor,
    emit(eventName: string, payload?: unknown) {
      for (const handler of listeners.get(eventName) ?? []) {
        handler(payload);
      }
    },
    setState(nextState: object) {
      currentState = nextState;
    },
  };
}

function primeImageEditorMocks() {
  createExplorerImageEditorSessionMock.mockResolvedValue({
    sessionId: 'session-1',
    previewDataUrl: 'data:image/png;base64,aW5pdA==',
    outputContentType: 'image/png',
    sourceWidth: 640,
    sourceHeight: 360,
    savedState: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      highlights: 0,
      shadows: 0,
      vignette: 0,
    },
    presets: [
      { id: 'original', label: 'Original', state: { brightness: 0, contrast: 0, saturation: 0, temperature: 0, highlights: 0, shadows: 0, vignette: 0 } },
      { id: 'warm', label: 'Warm', state: { brightness: 0, contrast: 0, saturation: 12, temperature: 18, highlights: 8, shadows: 0, vignette: 0 } },
      { id: 'vivid', label: 'Vivid', state: { brightness: 4, contrast: 18, saturation: 30, temperature: 0, highlights: 10, shadows: 6, vignette: 12 } },
    ],
  });
  renderExplorerImageEditorPreviewMock.mockResolvedValue({
    sessionId: 'session-1',
    previewDataUrl: 'data:image/png;base64,cHJldmlldw==',
    renderedWidth: 640,
    renderedHeight: 360,
    effectiveState: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      highlights: 0,
      shadows: 0,
      vignette: 0,
    },
  });
  exportExplorerImageEditorResultMock.mockResolvedValue({
    sessionId: 'session-1',
    imageBytes: [9, 8, 7],
    bakedImageDataUrl: 'data:image/png;base64,YmFrZWQ=',
    contentType: 'image/png',
    renderedWidth: 640,
    renderedHeight: 360,
    effectiveState: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      highlights: 0,
      shadows: 0,
      vignette: 0,
    },
  });
  closeExplorerImageEditorSessionMock.mockResolvedValue(undefined);
}

describe('ExplorerImageEditor', () => {
  beforeEach(() => {
    vi.useRealTimers();
    initExplorerImageEditorMock.mockReset();
    writeExplorerFileMock.mockReset();
    createExplorerImageEditorSessionMock.mockReset();
    renderExplorerImageEditorPreviewMock.mockReset();
    exportExplorerImageEditorResultMock.mockReset();
    closeExplorerImageEditorSessionMock.mockReset();
    useSettingsStore.getState().resetToDefaults();
    primeImageEditorMocks();
  });

  it('falls back to a static image preview for unsupported formats', () => {
    render(
      <ExplorerImageEditor
        imagePath="/tmp/vector.svg"
        imageName="vector.svg"
        imageSource="data:image/svg+xml;base64,PHN2Zy8+"
      />,
    );

    expect(screen.getByText('Static image preview')).toBeInTheDocument();
    expect(screen.getByText('Live editor is available for PNG, JPG, and WebP files.')).toBeInTheDocument();
    expect(initExplorerImageEditorMock).not.toHaveBeenCalled();
    expect(createExplorerImageEditorSessionMock).not.toHaveBeenCalled();
  });

  it('routes preset changes through the Rust preview backend', async () => {
    const harness = createMockEditorHarness();
    initExplorerImageEditorMock.mockResolvedValue(harness.editor);

    render(
      <ExplorerImageEditor
        imagePath="/tmp/preview.png"
        imageName="preview.png"
        imageSource="data:image/png;base64,ZmFrZQ=="
      />,
    );

    await waitFor(() => {
      expect(initExplorerImageEditorMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(renderExplorerImageEditorPreviewMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Warm' }));

    await waitFor(() => {
      expect(renderExplorerImageEditorPreviewMock).toHaveBeenLastCalledWith({
        sessionId: 'session-1',
        presetId: 'warm',
        adjustments: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          highlights: 0,
          shadows: 0,
          vignette: 0,
        },
      });
    });

    expect(harness.editor.imageManager.replaceManagedImageSource).toHaveBeenCalled();
  });

  it('exports edited bytes back through the Rust bake path and explorer write path', async () => {
    const harness = createMockEditorHarness();
    const onSaved = vi.fn();

    initExplorerImageEditorMock.mockResolvedValue(harness.editor);
    writeExplorerFileMock.mockResolvedValue(undefined);

    render(
      <ExplorerImageEditor
        imagePath="/tmp/preview.png"
        imageName="preview.png"
        imageSource="data:image/png;base64,ZmFrZQ=="
        onSaved={onSaved}
      />,
    );

    await waitFor(() => {
      expect(initExplorerImageEditorMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(renderExplorerImageEditorPreviewMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      harness.setState({ revision: 2 });
      harness.emit('object:modified');
    });

    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(exportExplorerImageEditorResultMock).toHaveBeenCalledWith({
        sessionId: 'session-1',
        presetId: 'original',
        adjustments: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          highlights: 0,
          shadows: 0,
          vignette: 0,
        },
        outputContentType: 'image/png',
      });
      expect(writeExplorerFileMock).toHaveBeenCalledWith('/tmp/preview.png', [1, 2, 3]);
    });

    expect(harness.editor.imageManager.replaceManagedImageSource).toHaveBeenCalledWith({
      source: 'data:image/png;base64,YmFrZWQ=',
      matchCustomData: {
        hostRole: 'greeblefs-explorer-base-image',
        sessionId: 'session-1',
      },
      withoutSave: true,
      withoutSelection: true,
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Saved to disk')).toBeInTheDocument();
  });

  it('honors settings-backed image editor hotkeys for undo and reset', async () => {
    const harness = createMockEditorHarness();
    initExplorerImageEditorMock.mockResolvedValue(harness.editor);

    render(
      <ExplorerImageEditor
        imagePath="/tmp/preview.png"
        imageName="preview.png"
        imageSource="data:image/png;base64,ZmFrZQ=="
      />,
    );

    await waitFor(() => {
      expect(initExplorerImageEditorMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(renderExplorerImageEditorPreviewMock).toHaveBeenCalledTimes(1);
    });

    const root = await screen.findByTestId('explorer-image-editor');
    fireEvent.keyDown(root, { key: 'z', ctrlKey: true });

    await waitFor(() => {
      expect(harness.editor.historyManager.undo).toHaveBeenCalledTimes(1);
    });

    fireEvent.keyDown(root, { key: 'Escape' });

    await waitFor(() => {
      expect(harness.editor.historyManager.loadStateFromFullState).toHaveBeenCalled();
    });
  });
});
