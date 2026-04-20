import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ExplorerImageEditor } from '../components/ExplorerImageEditor';
import { useSettingsStore } from '../store/settingsStore';

const {
  writeFileMock,
  writeExplorerFileMock,
  cropperDestroyMock,
  cropperGetCroppedCanvasMock,
} = vi.hoisted(() => ({
  writeFileMock: vi.fn(),
  writeExplorerFileMock: vi.fn(),
  cropperDestroyMock: vi.fn(),
  cropperGetCroppedCanvasMock: vi.fn(() => ({
    toDataURL: () => 'data:image/png;base64,Y3JvcHBlZA==',
  })),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: writeFileMock,
}));

vi.mock('../runtime/explorerBackend', () => ({
  writeExplorerFile: writeExplorerFileMock,
}));

vi.mock('cropperjs', () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: cropperDestroyMock,
    getCroppedCanvas: cropperGetCroppedCanvasMock,
  })),
}));

class MockPreviewImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  width = 640;
  height = 360;
  naturalWidth = 640;
  naturalHeight = 360;

  private _src = '';

  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      this.onload?.();
    });
  }

  get src(): string {
    return this._src;
  }
}

const originalImageDescriptor = Object.getOwnPropertyDescriptor(window, 'Image');

function installImageMock(): void {
  Object.defineProperty(window, 'Image', {
    configurable: true,
    writable: true,
    value: MockPreviewImage as unknown as typeof Image,
  });
}

function restoreImageMock(): void {
  if (originalImageDescriptor) {
    Object.defineProperty(window, 'Image', originalImageDescriptor);
    return;
  }

  Reflect.deleteProperty(window, 'Image');
}

function setPreviewMetrics(
  viewport: HTMLElement,
  image: HTMLElement,
  width = 640,
  height = 360,
): void {
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;

  Object.defineProperty(viewport, 'getBoundingClientRect', {
    configurable: true,
    value: () => rect,
  });
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: height,
  });
  Object.defineProperty(image, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(image, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

describe('ExplorerImageEditor', () => {
  beforeEach(() => {
    installImageMock();
    writeFileMock.mockReset();
    writeExplorerFileMock.mockReset();
    cropperDestroyMock.mockReset();
    cropperGetCroppedCanvasMock.mockClear();
    useSettingsStore.getState().resetToDefaults();
  });

  afterEach(() => {
    restoreImageMock();
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
    expect(screen.queryByTestId('explorer-image-editor-preview')).not.toBeInTheDocument();
  });

  it('keeps image preview fullscreen-first in preview mode while preserving pan and zoom', async () => {
    render(
      <ExplorerImageEditor
        imagePath="/tmp/preview.png"
        imageName="preview.png"
        imageSource="data:image/png;base64,ZmFrZQ=="
        mode="preview"
      />,
    );

    const previewViewport = await screen.findByTestId('explorer-image-editor-preview');
    const previewImage = await screen.findByTestId('explorer-image-editor-preview-image');
    const zoomBadge = screen.getByTestId('explorer-image-editor-preview-zoom');

    setPreviewMetrics(previewViewport, previewImage);

    await waitFor(() => {
      expect(previewImage.style.transform).toBe('translate(0px, 0px) scale(1)');
      expect(zoomBadge).toHaveTextContent('100%');
    });

    fireEvent.wheel(previewViewport, {
      deltaY: -120,
      clientX: 320,
      clientY: 180,
    });

    await waitFor(() => {
      expect(previewImage.style.transform).toBe('translate(0px, 0px) scale(1.2)');
      expect(zoomBadge).toHaveTextContent('120%');
    });

    fireEvent.mouseDown(previewViewport, {
      button: 0,
      clientX: 320,
      clientY: 180,
    });
    fireEvent.mouseMove(window, {
      clientX: 360,
      clientY: 200,
    });
    fireEvent.mouseUp(window);

    await waitFor(() => {
      expect(previewImage.style.transform).toBe('translate(40px, 20px) scale(1.2)');
      expect(zoomBadge).toHaveTextContent('120%');
    });

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset All' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crop Tool' })).not.toBeInTheDocument();
  });

  it('falls back to the explorer backend when the tauri fs plugin is unavailable during save', async () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const createObjectUrlMock = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revokeObjectUrlMock = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        filter: '',
        drawImage: vi.fn(),
      }),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback: BlobCallback, type?: string | null) => {
        callback?.(new Blob([Uint8Array.from([1, 2, 3])], { type: type ?? 'image/png' }));
      },
    });

    writeFileMock.mockRejectedValueOnce(new Error('fs.write_file not allowed. Plugin not found'));
    writeExplorerFileMock.mockResolvedValueOnce(undefined);

    try {
      render(
        <ExplorerImageEditor
          imagePath="/tmp/preview.png"
          imageName="preview.png"
          imageSource="data:image/png;base64,ZmFrZQ=="
          mode="edit"
        />,
      );

      await screen.findByTestId('explorer-image-editor-preview-image');

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(writeFileMock).toHaveBeenCalledTimes(1);
        expect(writeExplorerFileMock).toHaveBeenCalledWith('/tmp/preview.png', [1, 2, 3]);
      });
    } finally {
      if (originalGetContext) {
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          configurable: true,
          value: originalGetContext,
        });
      } else {
        Reflect.deleteProperty(HTMLCanvasElement.prototype, 'getContext');
      }

      if (originalToBlob) {
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
          configurable: true,
          value: originalToBlob,
        });
      } else {
        Reflect.deleteProperty(HTMLCanvasElement.prototype, 'toBlob');
      }

      createObjectUrlMock.mockRestore();
      revokeObjectUrlMock.mockRestore();
    }
  });
});
