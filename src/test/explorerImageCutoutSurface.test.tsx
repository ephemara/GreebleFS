import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorerImageCutoutSurface } from "../components/ExplorerImageCutoutSurface";
import { createDefaultImageFiltersState } from "../config/imageEditorFilters";
import { useSettingsStore } from "../store/settingsStore";

const backendMocks = vi.hoisted(() => ({
  openExplorerImageCutoutSession: vi.fn(),
  closeExplorerImageCutoutSession: vi.fn(),
  copyExplorerImageCutoutToClipboard: vi.fn(),
  resetExplorerImageCutoutSession: vi.fn(),
  stageExplorerImageCutoutExport: vi.fn(),
  startExplorerImageCutoutNativeDrag: vi.fn(),
}));

vi.mock("../runtime/imageCutoutBackend", () => backendMocks);

class MockCutoutImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  width = 4;
  height = 4;
  naturalWidth = 4;
  naturalHeight = 4;

  private _src = "";

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

const originalImageDescriptor = Object.getOwnPropertyDescriptor(window, "Image");

function installImageMock(): void {
  Object.defineProperty(window, "Image", {
    configurable: true,
    writable: true,
    value: MockCutoutImage as unknown as typeof Image,
  });
}

function restoreImageMock(): void {
  if (originalImageDescriptor) {
    Object.defineProperty(window, "Image", originalImageDescriptor);
    return;
  }

  Reflect.deleteProperty(window, "Image");
}

function createCanvasImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
    ]),
  } as ImageData;
}

describe("ExplorerImageCutoutSurface", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeEach(() => {
    installImageMock();
    useSettingsStore.getState().resetToDefaults();

    backendMocks.openExplorerImageCutoutSession.mockReset();
    backendMocks.closeExplorerImageCutoutSession.mockReset();
    backendMocks.copyExplorerImageCutoutToClipboard.mockReset();
    backendMocks.resetExplorerImageCutoutSession.mockReset();
    backendMocks.stageExplorerImageCutoutExport.mockReset();
    backendMocks.startExplorerImageCutoutNativeDrag.mockReset();

    backendMocks.openExplorerImageCutoutSession.mockResolvedValue({
      sessionId: "cutout-session",
      previewMask: {
        dataUrl: "data:image/png;base64,mask",
        width: 4,
        height: 4,
      },
      cutoutPreviewDataUrl: "data:image/png;base64,cutout",
      previewWidth: 4,
      previewHeight: 4,
      promptCount: 0,
      canUndo: false,
      canRedo: false,
      diagnostics: {
        providerKind: "python-sidecar",
        backendKind: "cpu",
        modelId: null,
        providerModelId: null,
        family: null,
        message: "Auto cutout ready.",
      },
    });
    backendMocks.closeExplorerImageCutoutSession.mockResolvedValue(undefined);
    backendMocks.copyExplorerImageCutoutToClipboard.mockResolvedValue(undefined);
    backendMocks.resetExplorerImageCutoutSession.mockResolvedValue(undefined);
    backendMocks.stageExplorerImageCutoutExport.mockResolvedValue(undefined);
    backendMocks.startExplorerImageCutoutNativeDrag.mockResolvedValue(undefined);

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => ({
        filter: "none",
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        putImageData: vi.fn(),
        createImageData: (width: number, height: number) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        }),
        getImageData: (_x = 0, _y = 0, width = 4, height = 4) =>
          createCanvasImageData(width, height),
      }),
    });

    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      value: () => "data:image/png;base64,override-mask",
    });

    let animationFrameCount = 0;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      animationFrameCount += 1;
      const id = animationFrameCount;
      if (animationFrameCount <= 3) {
        window.setTimeout(() => callback(animationFrameCount * 16), 0);
      }
      return id;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    restoreImageMock();

    if (originalGetContext) {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: originalGetContext,
      });
    } else {
      Reflect.deleteProperty(HTMLCanvasElement.prototype, "getContext");
    }

    if (originalToDataUrl) {
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        value: originalToDataUrl,
      });
    } else {
      Reflect.deleteProperty(HTMLCanvasElement.prototype, "toDataURL");
    }

    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("keeps selection tools up front and hides refine controls until requested", async () => {
    render(
      <ExplorerImageCutoutSurface
        imageName="preview.png"
        imagePath="/tmp/preview.png"
        sourceImageUrl="data:image/png;base64,ZmFrZQ=="
        filterState={createDefaultImageFiltersState()}
      />,
    );

    await waitFor(() => {
      expect(backendMocks.openExplorerImageCutoutSession).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByRole("button", { name: "Spark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sweep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refine" })).toBeInTheDocument();

    expect(screen.queryByText("Soft Edge")).not.toBeInTheDocument();
    expect(screen.queryByText("Edge Pull")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refine" }));

    expect(await screen.findByText("Soft Edge")).toBeInTheDocument();
    expect(screen.getByText("Edge Pull")).toBeInTheDocument();
  });
});
