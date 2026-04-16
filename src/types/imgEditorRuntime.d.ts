declare module '@img-editor-runtime' {
  export type ExplorerImageEditorCanvasEventHandler = (payload?: unknown) => void;

  export type ExplorerImageEditorHandle = {
    canvas: {
      on: (eventName: string, handler: ExplorerImageEditorCanvasEventHandler) => void;
      off: (eventName: string, handler: ExplorerImageEditorCanvasEventHandler) => void;
    };
    historyManager: {
      getFullState: () => unknown;
      loadStateFromFullState: (state: unknown) => Promise<void>;
      undo: () => Promise<void>;
      redo: () => Promise<void>;
    };
    imageManager: {
      exportCanvasAsImageFile: (options?: {
        fileName?: string;
        contentType?: string;
        exportAsBlob?: boolean;
      }) => Promise<{
        image: Blob | File | string;
        format: string;
        contentType: string;
        fileName: string;
      } | null>;
    };
    textManager: {
      addText: () => unknown;
    };
    shapeManager: {
      add: (options?: { presetKey?: string }) => Promise<unknown>;
    };
    deletionManager: {
      deleteSelectedObjects: () => unknown;
    };
    zoomManager: {
      zoom: (scale?: number) => void;
      resetZoom: () => void;
    };
    canvasManager: {
      updateCanvas: () => void;
    };
    destroy: () => void;
  };

  export type ExplorerImageEditorOptions = {
    editorContainerWidth?: string;
    editorContainerHeight?: string;
    canvasWrapperWidth?: string;
    canvasWrapperHeight?: string;
    canvasCSSWidth?: string;
    canvasCSSHeight?: string;
    adaptCanvasToContainerOnResize?: boolean;
    canvasDragging?: boolean;
    mouseWheelZooming?: boolean;
    undoRedoByHotKeys?: boolean;
    copyObjectsByHotkey?: boolean;
    pasteImageFromClipboard?: boolean;
    selectAllByHotkey?: boolean;
    deleteObjectsByHotkey?: boolean;
    resetObjectFitByDoubleClick?: boolean;
    defaultScale?: number;
    minZoom?: number;
    maxZoom?: number;
    scaleType?: 'contain' | 'cover';
    showToolbar?: boolean;
    overlayMaskColor?: string;
    keyboardIgnoreSelectors?: string[];
    initialImage?: {
      source: string;
      scale?: 'scale-montage' | 'image-contain' | 'image-cover';
      withoutSave?: boolean;
    };
  };

  export default function initEditor(
    containerId: string,
    options?: ExplorerImageEditorOptions,
  ): Promise<ExplorerImageEditorHandle>;
}
