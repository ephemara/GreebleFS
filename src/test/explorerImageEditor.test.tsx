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

  it('zooms and pans the live image preview, then resets back to fit', async () => {
    render(
      <ExplorerImageEditor
        imagePath="/tmp/preview.png"
        imageName="preview.png"
        imageSource="data:image/png;base64,ZmFrZQ=="
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

    fireEvent.click(screen.getByRole('button', { name: 'Reset All' }));

    await waitFor(() => {
      expect(previewImage.style.transform).toBe('translate(0px, 0px) scale(1)');
      expect(zoomBadge).toHaveTextContent('100%');
    });
  });
});
