import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorerImageCutoutSurface } from "../components/ExplorerImageCutoutSurface";
import type { ExplorerImageCutoutWorkflowMode } from "../config/imageCutoutTools";
import { createDefaultImageFiltersState } from "../config/imageEditorFilters";
import { useSettingsStore } from "../store/settingsStore";

const backendMocks = vi.hoisted(() => ({
  openExplorerImageCutoutSession: vi.fn(),
  applyExplorerImageCutoutPrompts: vi.fn(),
  closeExplorerImageCutoutSession: vi.fn(),
  copyExplorerImageCutoutToClipboard: vi.fn(),
  resetExplorerImageCutoutSession: vi.fn(),
  stageExplorerImageCutoutExport: vi.fn(),
  startExplorerImageCutoutNativeDrag: vi.fn(),
}));

vi.mock("../runtime/imageCutoutBackend", () => backendMocks);

const EMPTY_MASK_DATA_URL = "data:image/png;base64,empty-mask";
const FILLED_MASK_DATA_URL = "data:image/png;base64,filled-mask";
const SOURCE_IMAGE_DATA_URL = "data:image/png;base64,source-image";
const CUTOUT_PREVIEW_DATA_URL = "data:image/png;base64,cutout-preview";

type CanvasContextMock = {
  filter: string;
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
  createImageData: (width: number, height: number) => ImageData;
  getImageData: (x?: number, y?: number, width?: number, height?: number) => ImageData;
  globalCompositeOperation: string;
};

type MockContextCarrier = HTMLCanvasElement & {
  __mockContext?: CanvasContextMock;
  __lastDrawImageSrc?: string;
};

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
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture;
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture;
const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture;

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

function createOpaqueImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = 255;
    data[offset + 1] = 255;
    data[offset + 2] = 255;
    data[offset + 3] = 255;
  }
  return { width, height, data } as ImageData;
}

function createTransparentImageData(width: number, height: number): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  } as ImageData;
}

function resolveCanvasImageDataForSource(
  source: string,
  width: number,
  height: number,
): ImageData {
  if (
    source.includes("filled-mask") ||
    source.includes("source-image") ||
    source.includes("cutout-preview")
  ) {
    return createOpaqueImageData(width, height);
  }
  return createTransparentImageData(width, height);
}

function installCanvasContextMock(): void {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: function getContextMock(): CanvasContextMock {
      const canvas = this as MockContextCarrier;
      if (canvas.__mockContext) {
        return canvas.__mockContext;
      }

      const context: CanvasContextMock = {
        filter: "none",
        clearRect: vi.fn(),
        drawImage: vi.fn((image: { src?: string } | HTMLCanvasElement) => {
          canvas.__lastDrawImageSrc =
            image instanceof HTMLCanvasElement ? "" : String(image?.src ?? "");
        }),
        putImageData: vi.fn(),
        createImageData: (width: number, height: number) =>
          ({
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
          }) as ImageData,
        getImageData: (_x = 0, _y = 0, width = 4, height = 4) =>
          resolveCanvasImageDataForSource(
            canvas.__lastDrawImageSrc ?? "",
            width,
            height,
          ),
        globalCompositeOperation: "source-over",
      };
      canvas.__mockContext = context;
      return context;
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    value: () => "data:image/png;base64,override-mask",
  });
}

function restoreCanvasContextMock(): void {
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
}

function installPointerCaptureMock(): void {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
}

function restorePointerCaptureMock(): void {
  if (originalSetPointerCapture) {
    HTMLElement.prototype.setPointerCapture = originalSetPointerCapture;
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
  }
  if (originalReleasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture;
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "releasePointerCapture");
  }
  if (originalHasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture;
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture");
  }
}

function installAnimationFrameMock(): void {
  let animationFrameCount = 0;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    animationFrameCount += 1;
    const id = animationFrameCount;
    if (animationFrameCount <= 24) {
      window.setTimeout(() => callback(animationFrameCount * 16), 0);
    }
    return id;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = vi.fn();
}

function restoreAnimationFrameMock(): void {
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
}

function buildSnapshot(
  workflowMode: ExplorerImageCutoutWorkflowMode,
  overrides?: Partial<{
    sessionId: string;
    previewMaskDataUrl: string;
    message: string;
    promptCount: number;
  }>,
) {
  const sessionId = overrides?.sessionId ?? `${workflowMode}-session`;
  return {
    sessionId,
    previewMask: {
      dataUrl:
        overrides?.previewMaskDataUrl ??
        (workflowMode === "cutout" ? EMPTY_MASK_DATA_URL : SOURCE_IMAGE_DATA_URL),
      width: 4,
      height: 4,
    },
    cutoutPreviewDataUrl: CUTOUT_PREVIEW_DATA_URL,
    previewWidth: 4,
    previewHeight: 4,
    promptCount: overrides?.promptCount ?? 0,
    canUndo: false,
    canRedo: false,
    diagnostics: {
      providerKind: "python-sidecar",
      backendKind: "cpu",
      modelId: null,
      providerModelId: null,
      family: null,
      message:
        overrides?.message ??
        (workflowMode === "cutout"
          ? "Prompt-first cutout lane active."
          : "Auto background removal is ready."),
    },
  };
}

function configureBackendMocks(): void {
  backendMocks.openExplorerImageCutoutSession.mockImplementation(
    async (request: { workflowMode: ExplorerImageCutoutWorkflowMode }) =>
      buildSnapshot(request.workflowMode),
  );
  backendMocks.applyExplorerImageCutoutPrompts.mockImplementation(
    async (request: { sessionId: string }) =>
      buildSnapshot("cutout", {
        sessionId: request.sessionId,
        previewMaskDataUrl: FILLED_MASK_DATA_URL,
        message: "Prompt applied.",
        promptCount: 1,
      }),
  );
  backendMocks.closeExplorerImageCutoutSession.mockResolvedValue(undefined);
  backendMocks.copyExplorerImageCutoutToClipboard.mockResolvedValue({
    sessionId: "cutout-session",
    mode: "staging",
    outputPath: "/tmp/preview.cutout.png",
    fileName: "preview.cutout.png",
    width: 4,
    height: 4,
  });
  backendMocks.resetExplorerImageCutoutSession.mockImplementation(
    async ({ sessionId }: { sessionId: string }) =>
      sessionId.startsWith("removeBackground")
        ? buildSnapshot("removeBackground", { sessionId })
        : buildSnapshot("cutout", {
            sessionId,
            previewMaskDataUrl: EMPTY_MASK_DATA_URL,
          }),
  );
  backendMocks.stageExplorerImageCutoutExport.mockResolvedValue({
    sessionId: "cutout-session",
    mode: "staging",
    outputPath: "/tmp/preview.cutout.png",
    fileName: "preview.cutout.png",
    width: 4,
    height: 4,
  });
  backendMocks.startExplorerImageCutoutNativeDrag.mockResolvedValue(undefined);
}

function setStageMetrics(stage: HTMLElement, content: HTMLElement): void {
  const viewportRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 240,
    bottom: 240,
    width: 240,
    height: 240,
    toJSON: () => ({}),
  } as DOMRect;
  const contentRect = {
    x: 20,
    y: 20,
    top: 20,
    left: 20,
    right: 220,
    bottom: 220,
    width: 200,
    height: 200,
    toJSON: () => ({}),
  } as DOMRect;

  Object.defineProperty(stage, "getBoundingClientRect", {
    configurable: true,
    value: () => viewportRect,
  });
  Object.defineProperty(stage, "clientWidth", {
    configurable: true,
    value: 240,
  });
  Object.defineProperty(stage, "clientHeight", {
    configurable: true,
    value: 240,
  });

  Object.defineProperty(content, "getBoundingClientRect", {
    configurable: true,
    value: () => contentRect,
  });
  Object.defineProperty(content, "clientWidth", {
    configurable: true,
    value: 320,
  });
  Object.defineProperty(content, "clientHeight", {
    configurable: true,
    value: 320,
  });
}

function renderSurface(
  workflowMode: ExplorerImageCutoutWorkflowMode = "cutout",
  options?: {
    onRegisterContextMenuRegistration?: (registration: unknown) => void;
  },
) {
  return render(
    <ExplorerImageCutoutSurface
      workflowMode={workflowMode}
      imageName="preview.png"
      imagePath="/tmp/preview.png"
      sourceImageUrl={SOURCE_IMAGE_DATA_URL}
      filterState={createDefaultImageFiltersState()}
      onRegisterContextMenuRegistration={options?.onRegisterContextMenuRegistration}
    />,
  );
}

describe("ExplorerImageCutoutSurface", () => {
  beforeEach(() => {
    installImageMock();
    installCanvasContextMock();
    installPointerCaptureMock();
    installAnimationFrameMock();
    useSettingsStore.getState().resetToDefaults();

    backendMocks.openExplorerImageCutoutSession.mockReset();
    backendMocks.applyExplorerImageCutoutPrompts.mockReset();
    backendMocks.closeExplorerImageCutoutSession.mockReset();
    backendMocks.copyExplorerImageCutoutToClipboard.mockReset();
    backendMocks.resetExplorerImageCutoutSession.mockReset();
    backendMocks.stageExplorerImageCutoutExport.mockReset();
    backendMocks.startExplorerImageCutoutNativeDrag.mockReset();
    configureBackendMocks();
  });

  afterEach(() => {
    restoreImageMock();
    restoreCanvasContextMock();
    restorePointerCaptureMock();
    restoreAnimationFrameMock();
  });

  it("opens Cutout without an automatic mask and keeps the stage chrome compact", async () => {
    renderSurface("cutout");

    await waitFor(() => {
      expect(backendMocks.openExplorerImageCutoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ workflowMode: "cutout" }),
      );
    });

    expect(screen.getByRole("button", { name: "Toggle refine controls" })).toBeInTheDocument();
    expect(
      screen.queryByText("Prompt-first cutout lane active."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("explorer-image-cutout-marching-ants")).toHaveAttribute(
      "data-has-boundary",
      "false",
    );
    expect(screen.getByText("Awaiting subject")).toBeInTheDocument();
  });

  it("opens Remove BG with the shared top-bar actions and no explainer card", async () => {
    renderSurface("removeBackground");

    await waitFor(() => {
      expect(backendMocks.openExplorerImageCutoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ workflowMode: "removeBackground" }),
      );
    });

    expect(screen.getByRole("button", { name: "Toggle refine controls" })).toBeInTheDocument();
    expect(
      screen.queryByText("Auto background removal is ready."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("explorer-image-cutout-zoom")).toBeInTheDocument();
  });

  it("sends positive and negative prompt clicks through the cutout backend", async () => {
    renderSurface("cutout");

    await waitFor(() => {
      expect(backendMocks.openExplorerImageCutoutSession).toHaveBeenCalledTimes(1);
    });

    const stage = screen.getByTestId("explorer-image-cutout-stage");
    const content = screen.getByTestId("explorer-image-cutout-stage-content");
    setStageMetrics(stage, content);

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      clientX: 100,
      clientY: 110,
      button: 0,
    });
    fireEvent.pointerUp(stage, {
      pointerId: 1,
      clientX: 100,
      clientY: 110,
      button: 0,
    });

    await waitFor(() => {
      expect(backendMocks.applyExplorerImageCutoutPrompts).toHaveBeenCalledWith({
        sessionId: "cutout-session",
        prompts: [{ xNorm: 0.4, yNorm: 0.45, kind: "positive" }],
      });
    });

    fireEvent.pointerDown(stage, {
      pointerId: 2,
      clientX: 140,
      clientY: 150,
      button: 0,
      altKey: true,
    });
    fireEvent.pointerUp(stage, {
      pointerId: 2,
      clientX: 140,
      clientY: 150,
      button: 0,
      altKey: true,
    });

    await waitFor(() => {
      expect(backendMocks.applyExplorerImageCutoutPrompts).toHaveBeenLastCalledWith({
        sessionId: "cutout-session",
        prompts: [{ xNorm: 0.6, yNorm: 0.65, kind: "negative" }],
      });
    });
  });

  it("pans on plain drag and only starts native drag on shift-drag", async () => {
    renderSurface("cutout");

    await waitFor(() => {
      expect(backendMocks.openExplorerImageCutoutSession).toHaveBeenCalledTimes(1);
    });

    const stage = screen.getByTestId("explorer-image-cutout-stage");
    const content = screen.getByTestId("explorer-image-cutout-stage-content");
    setStageMetrics(stage, content);

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      clientX: 120,
      clientY: 120,
      button: 0,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      clientX: 170,
      clientY: 150,
      button: 0,
    });
    fireEvent.pointerUp(stage, {
      pointerId: 1,
      clientX: 170,
      clientY: 150,
      button: 0,
    });

    await waitFor(() => {
      expect(content.style.transform).toContain("40px");
      expect(content.style.transform).toContain("30px");
    });

    expect(backendMocks.stageExplorerImageCutoutExport).not.toHaveBeenCalled();
    expect(backendMocks.startExplorerImageCutoutNativeDrag).not.toHaveBeenCalled();

    fireEvent.pointerDown(stage, {
      pointerId: 2,
      clientX: 120,
      clientY: 120,
      button: 0,
      shiftKey: true,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 2,
      clientX: 160,
      clientY: 170,
      button: 0,
      shiftKey: true,
    });
    fireEvent.pointerUp(stage, {
      pointerId: 2,
      clientX: 160,
      clientY: 170,
      button: 0,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(backendMocks.stageExplorerImageCutoutExport).toHaveBeenCalledTimes(1);
      expect(backendMocks.startExplorerImageCutoutNativeDrag).toHaveBeenCalledWith(
        "/tmp/preview.cutout.png",
      );
    });
  });

  it("keeps refine controls hidden until requested and renders PremiumSlider-backed controls", async () => {
    renderSurface("cutout");

    await waitFor(() => {
      expect(backendMocks.openExplorerImageCutoutSession).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.queryByTestId("explorer-image-cutout-refine-panel"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle refine controls" }),
    );

    expect(
      await screen.findByTestId("explorer-image-cutout-refine-panel"),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Brush Size" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Brush Reach" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Brush Softness" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Edge Softness" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Edge Pull" })).toBeInTheDocument();
  });

  it("registers image preview context-menu overlays for Cutout and Remove BG lanes", async () => {
    const registerContextMenu = vi.fn();
    const { unmount } = renderSurface("cutout", {
      onRegisterContextMenuRegistration: registerContextMenu,
    });

    await waitFor(() => {
      expect(registerContextMenu).toHaveBeenCalledWith(
        expect.objectContaining({
          previewKind: "image",
          baseActions: expect.arrayContaining([
            expect.objectContaining({ id: "image-cutout.reset-view" }),
            expect.objectContaining({ id: "image-cutout.refine.toggle" }),
          ]),
          workflowOverlays: expect.arrayContaining([
            expect.objectContaining({
              workflowTabId: "cutout",
              actions: expect.arrayContaining([
                expect.objectContaining({
                  id: "image-cutout.selection.activate",
                  title: "Return to Prompt Selection",
                }),
              ]),
            }),
            expect.objectContaining({
              workflowTabId: "remove-background",
              actions: expect.arrayContaining([
                expect.objectContaining({
                  id: "image-cutout.selection.activate",
                  hidden: true,
                }),
              ]),
            }),
          ]),
        }),
      );
    });

    unmount();
    expect(registerContextMenu).toHaveBeenLastCalledWith(null);
  });
});
