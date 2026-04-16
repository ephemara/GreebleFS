import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorerImageEditor } from '../components/ExplorerImageEditor';

const { initExplorerImageEditorMock, writeExplorerFileMock } = vi.hoisted(() => ({
  initExplorerImageEditorMock: vi.fn(),
  writeExplorerFileMock: vi.fn(),
}));

vi.mock('../runtime/imageEditorRuntime', () => ({
  initExplorerImageEditor: initExplorerImageEditorMock,
}));

vi.mock('../runtime/explorerBackend', () => ({
  writeExplorerFile: writeExplorerFileMock,
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
        currentState = { revision: 1 };
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

describe('ExplorerImageEditor', () => {
  beforeEach(() => {
    initExplorerImageEditorMock.mockReset();
    writeExplorerFileMock.mockReset();
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
  });

  it('exports edited bytes back through the explorer write path', async () => {
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

    act(() => {
      harness.setState({ revision: 2 });
      harness.emit('object:modified');
    });

    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(writeExplorerFileMock).toHaveBeenCalledWith('/tmp/preview.png', [1, 2, 3]);
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Saved to disk')).toBeInTheDocument();
  });
});
