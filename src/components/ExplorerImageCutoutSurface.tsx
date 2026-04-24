import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Copy,
  Loader2,
  MousePointer2,
  RefreshCw,
  RotateCcw,
  Scissors,
  Undo2,
} from "@/components/AppIcons";

import {
  DEFAULT_IMAGE_CUTOUT_TOOL_ID,
  imageCutoutToolDefinitions,
  type ExplorerImageCutoutToolId,
} from "../config/imageCutoutTools";
import { matchesKeybinding } from "../config/hotkeys";
import {
  buildCSSFilterString,
  type ExplorerImageFiltersState,
} from "../config/imageEditorFilters";
import type { LocalModelBackendPreference } from "../config/localModels";
import {
  closeExplorerImageCutoutSession,
  copyExplorerImageCutoutToClipboard,
  openExplorerImageCutoutSession,
  resetExplorerImageCutoutSession,
  stageExplorerImageCutoutExport,
  startExplorerImageCutoutNativeDrag,
  type ExplorerImageCutoutSessionSnapshot,
} from "../runtime/imageCutoutBackend";
import type { ManagedPythonRuntimeConfig } from "../runtime/pythonRuntimeBackend";
import { useSettingsStore } from "../store/settingsStore";
import {
  applySparkSelection,
  applySweepSelectionInPlace,
  buildCutoutBoundaryPoints,
  cloneCutoutMaskAlpha,
  createCutoutMaskFromImageData,
  resolveAdjustedCutoutMask,
  writeCutoutMaskToCanvas,
  type ExplorerImageCutoutAlphaMask,
  type ExplorerImageCutoutBoundaryPoint,
  type ExplorerImageCutoutEditMode,
  type ExplorerImageCutoutSourcePixels,
} from "./explorer/explorerImageCutoutMask";

type ExplorerImageCutoutSurfaceProps = {
  imageName: string;
  imagePath: string;
  logicalOutputPath?: string;
  sourceImageUrl: string;
  filterState: ExplorerImageFiltersState;
  pythonRuntimeConfig?: ManagedPythonRuntimeConfig | null;
  cutoutModelId?: string | null;
  cutoutBackendPreference?: LocalModelBackendPreference | null;
};

type CutoutStatusTone = "neutral" | "success" | "warning" | "error";

type CutoutBoundarySnapshot = {
  width: number;
  height: number;
  points: ExplorerImageCutoutBoundaryPoint[];
};

type ActiveSweepStroke = {
  pointerId: number;
  mode: ExplorerImageCutoutEditMode;
  workingMask: ExplorerImageCutoutAlphaMask;
  lastX: number;
  lastY: number;
};

const DEFAULT_PREVIEW_MAX_DIMENSION = 960;
const HISTORY_LIMIT = 32;
const MARCHING_ANTS_WIDTH = 4;
const MARCHING_ANTS_SPEED = 20;
const DEFAULT_SPARK_TOLERANCE = 26;
const DEFAULT_SWEEP_TOLERANCE = 30;
const DEFAULT_SWEEP_SIZE = 34;
const DEFAULT_SWEEP_SOFTNESS = 42;
const DEFAULT_EDGE_SOFTNESS = 2;
const DEFAULT_EDGE_PULL = 0;

function buttonStyle(
  variant: "primary" | "default" | "ghost" = "default",
): CSSProperties {
  const base = {
    appearance: "none" as const,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    border: "1px solid transparent",
    padding: "7px 11px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.02em",
    cursor: "pointer",
    transition:
      "background 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease",
  };

  switch (variant) {
    case "primary":
      return {
        ...base,
        background: "rgba(59, 130, 246, 0.22)",
        borderColor: "rgba(96, 165, 250, 0.48)",
        color: "#f8fbff",
      };
    case "ghost":
      return {
        ...base,
        background: "transparent",
        borderColor: "rgba(255,255,255,0.08)",
        color: "var(--overlay-text-muted)",
      };
    case "default":
    default:
      return {
        ...base,
        background: "rgba(255,255,255,0.05)",
        borderColor: "rgba(255,255,255,0.12)",
        color: "var(--overlay-text-primary)",
      };
  }
}

function toneColor(tone: CutoutStatusTone): string {
  switch (tone) {
    case "success":
      return "#86efac";
    case "warning":
      return "#fde68a";
    case "error":
      return "#fca5a5";
    case "neutral":
    default:
      return "var(--overlay-text-muted)";
  }
}

function toolChipStyle(active: boolean): CSSProperties {
  return {
    appearance: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: "10px 12px",
    borderRadius: 12,
    border: active
      ? "1px solid rgba(96, 165, 250, 0.48)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(59, 130, 246, 0.18)" : "rgba(255,255,255,0.04)",
    color: active ? "#f8fbff" : "var(--overlay-text-primary)",
    textAlign: "left",
    cursor: "pointer",
  };
}

function panelCardStyle(): CSSProperties {
  return {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  };
}

function sliderStyle(): CSSProperties {
  return {
    width: "100%",
    accentColor: "#60a5fa",
  };
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  helper,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  helper?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 10,
          color: "var(--overlay-text-muted)",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--overlay-text-primary)", fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={sliderStyle()}
      />
      {helper ? (
        <span style={{ fontSize: 10, color: "var(--overlay-text-dim, rgba(255,255,255,0.5))" }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

async function loadImageElement(source: string): Promise<HTMLImageElement> {
  const image = new window.Image();
  return await new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode the cutout preview source image."));
    image.src = source;
  });
}

async function convertBlobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to read local blob URL (${response.status}).`);
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to convert the image blob to a data URL."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });
}

async function resolveCutoutSessionInput(
  sourceImageUrl: string,
  imagePath: string,
): Promise<{
  inputDataUrl: string | null;
  inputPath: string | null;
}> {
  const trimmedSource = sourceImageUrl.trim();
  if (trimmedSource.startsWith("data:image/")) {
    return {
      inputDataUrl: trimmedSource,
      inputPath: null,
    };
  }
  if (trimmedSource.startsWith("blob:")) {
    return {
      inputDataUrl: await convertBlobUrlToDataUrl(trimmedSource),
      inputPath: null,
    };
  }
  const trimmedPath = imagePath.trim();
  return {
    inputDataUrl: null,
    inputPath: trimmedPath || null,
  };
}

async function buildPreviewSourcePixels(
  sourceImageUrl: string,
  width: number,
  height: number,
): Promise<{
  pixels: ExplorerImageCutoutSourcePixels;
  canvas: HTMLCanvasElement;
}> {
  const image = await loadImageElement(sourceImageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create the preview source canvas.");
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    canvas,
    pixels: {
      width,
      height,
      data: new Uint8ClampedArray(imageData.data),
    },
  };
}

async function buildInitialMaskFromDataUrl(
  dataUrl: string,
  width: number,
  height: number,
): Promise<ExplorerImageCutoutAlphaMask> {
  const image = await loadImageElement(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create the preview mask canvas.");
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return createCutoutMaskFromImageData(context.getImageData(0, 0, width, height));
}

function buildExportFilters(filterState: ExplorerImageFiltersState) {
  return {
    brightness: filterState.brightness,
    contrast: filterState.contrast,
    saturate: filterState.saturate,
    hueRotate: filterState["hue-rotate"],
    grayscale: filterState.grayscale,
    sepia: filterState.sepia,
    invert: filterState.invert,
    blur: filterState.blur,
  };
}

function maskToDataUrl(mask: ExplorerImageCutoutAlphaMask): string {
  const canvas = document.createElement("canvas");
  writeCutoutMaskToCanvas(mask, canvas);
  return canvas.toDataURL("image/png");
}

function describeToolInteraction(toolId: ExplorerImageCutoutToolId): string {
  if (toolId === "spark") {
    return "Click to grab a connected color island near the cursor.";
  }
  return "Drag to sweep across similar pixels. Alt-drag or right-drag trims the mask.";
}

export function ExplorerImageCutoutSurface({
  imageName,
  imagePath,
  logicalOutputPath,
  sourceImageUrl,
  filterState,
  pythonRuntimeConfig = null,
  cutoutModelId = null,
  cutoutBackendPreference = "auto",
}: ExplorerImageCutoutSurfaceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const marchingAntsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourcePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resolvedMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const refreshPreviewFrameRef = useRef(0);
  const baseMaskRef = useRef<ExplorerImageCutoutAlphaMask | null>(null);
  const resolvedMaskRef = useRef<ExplorerImageCutoutAlphaMask | null>(null);
  const sourcePixelsRef = useRef<ExplorerImageCutoutSourcePixels | null>(null);
  const historyRef = useRef<Uint8ClampedArray[]>([]);
  const historyIndexRef = useRef(0);
  const activeSweepStrokeRef = useRef<ActiveSweepStroke | null>(null);
  const boundaryRef = useRef<CutoutBoundarySnapshot | null>(null);
  const edgeSoftnessRef = useRef(DEFAULT_EDGE_SOFTNESS);
  const edgePullRef = useRef(DEFAULT_EDGE_PULL);
  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  const [sessionSnapshot, setSessionSnapshot] =
    useState<ExplorerImageCutoutSessionSnapshot | null>(null);
  const [statusTone, setStatusTone] = useState<CutoutStatusTone>("neutral");
  const [statusMessage, setStatusMessage] = useState("Booting cutout session…");
  const [isBooting, setIsBooting] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const [activeToolId, setActiveToolId] = useState<ExplorerImageCutoutToolId>(
    DEFAULT_IMAGE_CUTOUT_TOOL_ID,
  );
  const [sparkTolerance, setSparkTolerance] = useState(DEFAULT_SPARK_TOLERANCE);
  const [sweepTolerance, setSweepTolerance] = useState(DEFAULT_SWEEP_TOLERANCE);
  const [sweepSize, setSweepSize] = useState(DEFAULT_SWEEP_SIZE);
  const [sweepSoftness, setSweepSoftness] = useState(DEFAULT_SWEEP_SOFTNESS);
  const [edgeSoftness, setEdgeSoftness] = useState(DEFAULT_EDGE_SOFTNESS);
  const [edgePull, setEdgePull] = useState(DEFAULT_EDGE_PULL);

  const focusSurface = useCallback(() => {
    rootRef.current?.focus();
  }, []);

  const schedulePreviewRefresh = useCallback(() => {
    if (refreshPreviewFrameRef.current !== 0) {
      return;
    }

    refreshPreviewFrameRef.current = window.requestAnimationFrame(() => {
      refreshPreviewFrameRef.current = 0;

      const baseMask = baseMaskRef.current;
      const sourcePreviewCanvas = sourcePreviewCanvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!baseMask || !sourcePreviewCanvas || !previewCanvas) {
        return;
      }

      const resolvedMask = resolveAdjustedCutoutMask({
        baseMask,
        edgeSoftness: edgeSoftnessRef.current,
        edgePull: edgePullRef.current,
      });
      resolvedMaskRef.current = resolvedMask;

      if (!resolvedMaskCanvasRef.current) {
        resolvedMaskCanvasRef.current = document.createElement("canvas");
      }
      writeCutoutMaskToCanvas(resolvedMask, resolvedMaskCanvasRef.current);

      previewCanvas.width = resolvedMask.width;
      previewCanvas.height = resolvedMask.height;
      const previewContext = previewCanvas.getContext("2d");
      if (!previewContext) {
        return;
      }

      previewContext.clearRect(0, 0, resolvedMask.width, resolvedMask.height);
      previewContext.globalCompositeOperation = "source-over";
      previewContext.drawImage(sourcePreviewCanvas, 0, 0, resolvedMask.width, resolvedMask.height);
      previewContext.globalCompositeOperation = "destination-in";
      previewContext.drawImage(
        resolvedMaskCanvasRef.current,
        0,
        0,
        resolvedMask.width,
        resolvedMask.height,
      );
      previewContext.globalCompositeOperation = "source-over";

      boundaryRef.current = {
        width: resolvedMask.width,
        height: resolvedMask.height,
        points: buildCutoutBoundaryPoints(resolvedMask),
      };
    });
  }, []);

  const resetHistoryState = useCallback((mask: ExplorerImageCutoutAlphaMask) => {
    baseMaskRef.current = {
      width: mask.width,
      height: mask.height,
      alpha: cloneCutoutMaskAlpha(mask.alpha),
    };
    historyRef.current = [cloneCutoutMaskAlpha(mask.alpha)];
    historyIndexRef.current = 0;
    setHistoryIndex(0);
    setHistoryLength(1);
    schedulePreviewRefresh();
  }, [schedulePreviewRefresh]);

  const commitMaskHistory = useCallback(
    (
      mask: ExplorerImageCutoutAlphaMask,
      status: string,
      tone: CutoutStatusTone = "success",
    ) => {
      const nextMask = {
        width: mask.width,
        height: mask.height,
        alpha: cloneCutoutMaskAlpha(mask.alpha),
      };
      baseMaskRef.current = nextMask;

      const nextHistory = [
        ...historyRef.current.slice(0, historyIndexRef.current + 1),
        cloneCutoutMaskAlpha(nextMask.alpha),
      ];
      while (nextHistory.length > HISTORY_LIMIT) {
        nextHistory.shift();
      }
      historyRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;
      setHistoryIndex(historyIndexRef.current);
      setHistoryLength(nextHistory.length);
      setStatusTone(tone);
      setStatusMessage(status);
      schedulePreviewRefresh();
    },
    [schedulePreviewRefresh],
  );

  const previewMaskDuringStroke = useCallback(
    (mask: ExplorerImageCutoutAlphaMask, status: string) => {
      baseMaskRef.current = mask;
      setStatusTone("neutral");
      setStatusMessage(status);
      schedulePreviewRefresh();
    },
    [schedulePreviewRefresh],
  );

  const restoreHistoryIndex = useCallback(
    (nextIndex: number) => {
      const currentMask = baseMaskRef.current;
      const snapshot = historyRef.current[nextIndex];
      if (!currentMask || !snapshot) {
        return;
      }

      baseMaskRef.current = {
        width: currentMask.width,
        height: currentMask.height,
        alpha: cloneCutoutMaskAlpha(snapshot),
      };
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      setHistoryLength(historyRef.current.length);
      setStatusTone("success");
      setStatusMessage(
        nextIndex === 0
          ? "Restored the auto cutout."
          : `Restored edit ${nextIndex + 1} of ${historyRef.current.length}.`,
      );
      schedulePreviewRefresh();
    },
    [schedulePreviewRefresh],
  );

  const resolveMaskPoint = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
      const frame = frameRef.current;
      const baseMask = baseMaskRef.current;
      if (!frame || !baseMask) {
        return null;
      }
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      return {
        x: Math.max(0, Math.min(baseMask.width - 1, Math.round(xRatio * (baseMask.width - 1)))),
        y: Math.max(0, Math.min(baseMask.height - 1, Math.round(yRatio * (baseMask.height - 1)))),
      };
    },
    [],
  );

  const resolveEditModeFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): ExplorerImageCutoutEditMode =>
      event.altKey || event.button === 2 ? "subtract" : "add",
    [],
  );

  const applySparkAtPointer = useCallback(
    (point: { x: number; y: number }, mode: ExplorerImageCutoutEditMode) => {
      const baseMask = baseMaskRef.current;
      const sourcePixels = sourcePixelsRef.current;
      if (!baseMask || !sourcePixels) {
        return;
      }
      const nextMask = applySparkSelection({
        baseMask,
        sourcePixels,
        centerX: point.x,
        centerY: point.y,
        tolerance: sparkTolerance,
        mode,
      });
      commitMaskHistory(
        nextMask,
        mode === "add" ? "Spark added a color island." : "Spark trimmed a color island.",
      );
    },
    [commitMaskHistory, sparkTolerance],
  );

  const applySweepPoint = useCallback(
    (
      mask: ExplorerImageCutoutAlphaMask,
      point: { x: number; y: number },
      mode: ExplorerImageCutoutEditMode,
    ) => {
      const sourcePixels = sourcePixelsRef.current;
      if (!sourcePixels) {
        return;
      }
      applySweepSelectionInPlace({
        targetMask: mask,
        sourcePixels,
        centerX: point.x,
        centerY: point.y,
        radius: sweepSize,
        tolerance: sweepTolerance,
        softness: sweepSoftness,
        mode,
      });
    },
    [sweepSize, sweepSoftness, sweepTolerance],
  );

  const beginSweepStroke = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, point: { x: number; y: number }) => {
      const baseMask = baseMaskRef.current;
      if (!baseMask) {
        return;
      }
      const workingMask = {
        width: baseMask.width,
        height: baseMask.height,
        alpha: cloneCutoutMaskAlpha(baseMask.alpha),
      };
      const mode = resolveEditModeFromPointer(event);
      applySweepPoint(workingMask, point, mode);
      activeSweepStrokeRef.current = {
        pointerId: event.pointerId,
        mode,
        workingMask,
        lastX: point.x,
        lastY: point.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      previewMaskDuringStroke(
        workingMask,
        mode === "add" ? "Sweeping the selection outward…" : "Sweeping the selection inward…",
      );
    },
    [applySweepPoint, previewMaskDuringStroke, resolveEditModeFromPointer],
  );

  const continueSweepStroke = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeStroke = activeSweepStrokeRef.current;
      if (!activeStroke || event.pointerId !== activeStroke.pointerId) {
        return;
      }
      const point = resolveMaskPoint(event);
      if (!point) {
        return;
      }
      const deltaX = point.x - activeStroke.lastX;
      const deltaY = point.y - activeStroke.lastY;
      const distance = Math.hypot(deltaX, deltaY);
      const stepCount = Math.max(1, Math.ceil(distance / Math.max(2, sweepSize / 3)));

      for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
        const stepPoint = {
          x: Math.round(activeStroke.lastX + (deltaX * stepIndex) / stepCount),
          y: Math.round(activeStroke.lastY + (deltaY * stepIndex) / stepCount),
        };
        applySweepPoint(activeStroke.workingMask, stepPoint, activeStroke.mode);
      }

      activeStroke.lastX = point.x;
      activeStroke.lastY = point.y;
      previewMaskDuringStroke(
        activeStroke.workingMask,
        activeStroke.mode === "add"
          ? "Sweeping the selection outward…"
          : "Sweeping the selection inward…",
      );
    },
    [applySweepPoint, previewMaskDuringStroke, resolveMaskPoint, sweepSize],
  );

  const endSweepStroke = useCallback(() => {
    const activeStroke = activeSweepStrokeRef.current;
    if (!activeStroke) {
      return;
    }
    activeSweepStrokeRef.current = null;
    commitMaskHistory(
      activeStroke.workingMask,
      activeStroke.mode === "add"
        ? "Sweep added to the selection."
        : "Sweep trimmed the selection.",
    );
  }, [commitMaskHistory]);

  const handleSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      focusSurface();
      if (isBooting || isMutating || event.button > 2) {
        return;
      }
      const point = resolveMaskPoint(event);
      if (!point) {
        return;
      }
      event.preventDefault();

      if (activeToolId === "spark") {
        applySparkAtPointer(point, resolveEditModeFromPointer(event));
        return;
      }
      beginSweepStroke(event, point);
    },
    [
      activeToolId,
      applySparkAtPointer,
      beginSweepStroke,
      focusSurface,
      isBooting,
      isMutating,
      resolveEditModeFromPointer,
      resolveMaskPoint,
    ],
  );

  useEffect(() => {
    edgeSoftnessRef.current = edgeSoftness;
    schedulePreviewRefresh();
  }, [edgeSoftness, schedulePreviewRefresh]);

  useEffect(() => {
    edgePullRef.current = edgePull;
    schedulePreviewRefresh();
  }, [edgePull, schedulePreviewRefresh]);

  useEffect(() => {
    let cancelled = false;
    let staleSessionId: string | null = null;

    setIsBooting(true);
    setIsMutating(false);
    setStatusTone("neutral");
    setStatusMessage("Booting cutout session…");
    setSessionSnapshot(null);
    sourcePixelsRef.current = null;
    sourcePreviewCanvasRef.current = null;
    baseMaskRef.current = null;
    resolvedMaskRef.current = null;
    historyRef.current = [];
    historyIndexRef.current = 0;
    boundaryRef.current = null;
    activeSweepStrokeRef.current = null;
    setHistoryIndex(0);
    setHistoryLength(1);

    void (async () => {
      try {
        const sessionInput = await resolveCutoutSessionInput(sourceImageUrl, imagePath);
        const snapshot = await openExplorerImageCutoutSession({
          inputDataUrl: sessionInput.inputDataUrl,
          inputPath: sessionInput.inputPath,
          logicalOutputPath: logicalOutputPath ?? imagePath,
          previewMaxDimension: DEFAULT_PREVIEW_MAX_DIMENSION,
          config: pythonRuntimeConfig,
          modelId: cutoutModelId,
          backendPreference: cutoutBackendPreference,
        });

        if (cancelled) {
          staleSessionId = snapshot.sessionId;
          return;
        }

        const [{ pixels, canvas }, initialMask] = await Promise.all([
          buildPreviewSourcePixels(
            sourceImageUrl,
            snapshot.previewWidth,
            snapshot.previewHeight,
          ),
          buildInitialMaskFromDataUrl(
            snapshot.previewMask.dataUrl,
            snapshot.previewWidth,
            snapshot.previewHeight,
          ),
        ]);

        if (cancelled) {
          staleSessionId = snapshot.sessionId;
          return;
        }

        sessionIdRef.current = snapshot.sessionId;
        sourcePixelsRef.current = pixels;
        sourcePreviewCanvasRef.current = canvas;
        resetHistoryState(initialMask);
        setSessionSnapshot(snapshot);
        setStatusTone("success");
        setStatusMessage(
          snapshot.diagnostics.message?.trim() ||
            "Auto cutout ready. Refine locally with Spark or Sweep.",
        );
        setIsBooting(false);
        focusSurface();
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatusTone("error");
        setStatusMessage(String(error));
        setIsBooting(false);
      }
    })();

    return () => {
      cancelled = true;
      const closingSessionId = staleSessionId ?? sessionIdRef.current;
      sessionIdRef.current = null;
      if (closingSessionId) {
        void closeExplorerImageCutoutSession(closingSessionId).catch(() => {});
      }
    };
  }, [
    cutoutBackendPreference,
    cutoutModelId,
    focusSurface,
    imagePath,
    logicalOutputPath,
    pythonRuntimeConfig,
    resetHistoryState,
    sourceImageUrl,
  ]);

  useEffect(() => {
    schedulePreviewRefresh();
  }, [historyIndex, schedulePreviewRefresh, sessionSnapshot]);

  useEffect(() => {
    let animationFrameId = 0;

    const render = (now: number) => {
      const canvas = marchingAntsCanvasRef.current;
      const boundary = boundaryRef.current;
      if (!canvas || !boundary) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== boundary.width || canvas.height !== boundary.height) {
        canvas.width = boundary.width;
        canvas.height = boundary.height;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      const imageData = context.createImageData(boundary.width, boundary.height);
      const phase = (now / 1000) * MARCHING_ANTS_SPEED;

      for (const [x, y] of boundary.points) {
        const stripe = (((x + y - phase) / (MARCHING_ANTS_WIDTH * 2)) % 2 + 2) % 2;
        const channel = stripe < 1 ? 0 : 255;
        const offset = (y * boundary.width + x) * 4;
        imageData.data[offset] = channel;
        imageData.data[offset + 1] = channel;
        imageData.data[offset + 2] = channel;
        imageData.data[offset + 3] = 255;
      }

      context.clearRect(0, 0, boundary.width, boundary.height);
      context.putImageData(imageData, 0, 0);
      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (refreshPreviewFrameRef.current !== 0) {
        window.cancelAnimationFrame(refreshPreviewFrameRef.current);
      }
    };
  }, []);

  const exportFilters = useMemo(() => buildExportFilters(filterState), [filterState]);
  const filterCss = buildCSSFilterString(filterState);

  const buildOverrideMaskDataUrl = useCallback(() => {
    const resolvedMask = resolvedMaskRef.current;
    return resolvedMask ? maskToDataUrl(resolvedMask) : null;
  }, []);

  const handleResetToAutoCutout = useCallback(async () => {
    const snapshot = sessionSnapshot;
    if (!snapshot) {
      return;
    }
    setIsMutating(true);
    setStatusTone("neutral");
    setStatusMessage("Restoring the auto cutout…");
    try {
      const nextSnapshot = await resetExplorerImageCutoutSession(snapshot.sessionId);
      const nextMask = await buildInitialMaskFromDataUrl(
        nextSnapshot.previewMask.dataUrl,
        nextSnapshot.previewWidth,
        nextSnapshot.previewHeight,
      );
      resetHistoryState(nextMask);
      setSessionSnapshot(nextSnapshot);
      setStatusTone("success");
      setStatusMessage("Back to the initial auto cutout.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(String(error));
    } finally {
      setIsMutating(false);
    }
  }, [resetHistoryState, sessionSnapshot]);

  const handleSaveSibling = useCallback(async () => {
    const snapshot = sessionSnapshot;
    if (!snapshot) {
      return;
    }
    setIsMutating(true);
    setStatusTone("neutral");
    setStatusMessage("Saving sibling cutout PNG…");
    try {
      const exportArtifact = await stageExplorerImageCutoutExport({
        sessionId: snapshot.sessionId,
        exportMode: "siblingPng",
        logicalOutputPath: logicalOutputPath ?? imagePath,
        filters: exportFilters,
        overrideMaskDataUrl: buildOverrideMaskDataUrl(),
      });
      setStatusTone("success");
      setStatusMessage(`Saved ${exportArtifact.fileName}.`);
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(String(error));
    } finally {
      setIsMutating(false);
    }
  }, [
    buildOverrideMaskDataUrl,
    exportFilters,
    imagePath,
    logicalOutputPath,
    sessionSnapshot,
  ]);

  const handleCopyToClipboard = useCallback(async () => {
    const snapshot = sessionSnapshot;
    if (!snapshot) {
      return;
    }
    setIsMutating(true);
    setStatusTone("neutral");
    setStatusMessage("Copying the current cutout to the system clipboard…");
    try {
      await copyExplorerImageCutoutToClipboard({
        sessionId: snapshot.sessionId,
        logicalOutputPath: logicalOutputPath ?? imagePath,
        filters: exportFilters,
        overrideMaskDataUrl: buildOverrideMaskDataUrl(),
      });
      setStatusTone("success");
      setStatusMessage("Cutout copied to the clipboard.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(String(error));
    } finally {
      setIsMutating(false);
    }
  }, [
    buildOverrideMaskDataUrl,
    exportFilters,
    imagePath,
    logicalOutputPath,
    sessionSnapshot,
  ]);

  const handleNativeDrag = useCallback(async () => {
    const snapshot = sessionSnapshot;
    if (!snapshot) {
      return;
    }
    setIsMutating(true);
    setStatusTone("neutral");
    setStatusMessage("Staging a drag-ready cutout PNG…");
    try {
      const exportArtifact = await stageExplorerImageCutoutExport({
        sessionId: snapshot.sessionId,
        exportMode: "staging",
        logicalOutputPath: logicalOutputPath ?? imagePath,
        filters: exportFilters,
        overrideMaskDataUrl: buildOverrideMaskDataUrl(),
      });
      await startExplorerImageCutoutNativeDrag(exportArtifact.outputPath);
      setStatusTone("success");
      setStatusMessage("Drag the cutout into Explorer or the desktop.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(String(error));
    } finally {
      setIsMutating(false);
    }
  }, [
    buildOverrideMaskDataUrl,
    exportFilters,
    imagePath,
    logicalOutputPath,
    sessionSnapshot,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current;
      const activeElement = document.activeElement;
      const hasFocus = Boolean(root && activeElement && root.contains(activeElement));
      if (!hasFocus) {
        return;
      }

      if (matchesKeybinding(event, keybindings.imageCutoutCopy)) {
        event.preventDefault();
        event.stopPropagation();
        void handleCopyToClipboard();
        return;
      }
      if (matchesKeybinding(event, keybindings.saveFile)) {
        event.preventDefault();
        event.stopPropagation();
        void handleSaveSibling();
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorUndo)) {
        event.preventDefault();
        event.stopPropagation();
        if (historyIndexRef.current > 0) {
          restoreHistoryIndex(historyIndexRef.current - 1);
        }
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorRedo)) {
        event.preventDefault();
        event.stopPropagation();
        if (historyIndexRef.current + 1 < historyRef.current.length) {
          restoreHistoryIndex(historyIndexRef.current + 1);
        }
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorReset)) {
        event.preventDefault();
        event.stopPropagation();
        void handleResetToAutoCutout();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    handleCopyToClipboard,
    handleResetToAutoCutout,
    handleSaveSibling,
    keybindings.imageCutoutCopy,
    keybindings.imageEditorRedo,
    keybindings.imageEditorReset,
    keybindings.imageEditorUndo,
    keybindings.saveFile,
    restoreHistoryIndex,
  ]);

  const activeToolDefinition = useMemo(
    () =>
      imageCutoutToolDefinitions.find((tool) => tool.id === activeToolId) ??
      imageCutoutToolDefinitions[0],
    [activeToolId],
  );

  const hasSession = sessionSnapshot != null && baseMaskRef.current != null;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-testid="explorer-image-cutout-surface"
      data-explorer-preview-keyboard-owner="image-cutout"
      onPointerDown={() => focusSurface()}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        outline: "none",
        background:
          "radial-gradient(circle at top, rgba(255,255,255,0.06), transparent 52%), var(--overlay-explorer-preview-bg, #0f172a)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderBottom: "1px solid var(--overlay-explorer-preview-border, rgba(255,255,255,0.1))",
          background: "rgba(10, 14, 24, 0.62)",
          backdropFilter: "blur(14px)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "var(--overlay-text-primary)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <Scissors size={14} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {imageName}
            </span>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 10,
              color: toneColor(statusTone),
            }}
          >
            <span>{statusMessage}</span>
            {sessionSnapshot ? (
              <span style={{ color: "var(--overlay-text-muted)" }}>
                Auto pass · {sessionSnapshot.diagnostics.backendKind} · {sessionSnapshot.previewWidth}
                ×{sessionSnapshot.previewHeight}
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => restoreHistoryIndex(Math.max(0, historyIndex - 1))}
            disabled={isBooting || isMutating || historyIndex <= 0}
            style={{
              ...buttonStyle("ghost"),
              opacity: isBooting || isMutating || historyIndex <= 0 ? 0.5 : 1,
            }}
          >
            <Undo2 size={13} />
            Undo
          </button>
          <button
            type="button"
            onClick={() => restoreHistoryIndex(historyIndex + 1)}
            disabled={isBooting || isMutating || historyIndex + 1 >= historyLength}
            style={{
              ...buttonStyle("ghost"),
              opacity:
                isBooting || isMutating || historyIndex + 1 >= historyLength ? 0.5 : 1,
            }}
          >
            <RefreshCw size={13} />
            Redo
          </button>
          <button
            type="button"
            onClick={() => void handleResetToAutoCutout()}
            disabled={isBooting || isMutating || !hasSession}
            style={{
              ...buttonStyle("ghost"),
              opacity: isBooting || isMutating || !hasSession ? 0.5 : 1,
            }}
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              void handleNativeDrag();
            }}
            disabled={isBooting || isMutating || !hasSession}
            style={{
              ...buttonStyle("primary"),
              opacity: isBooting || isMutating || !hasSession ? 0.5 : 1,
            }}
          >
            <MousePointer2 size={13} />
            Drag Out
          </button>
          <button
            type="button"
            onClick={() => void handleCopyToClipboard()}
            disabled={isBooting || isMutating || !hasSession}
            style={{
              ...buttonStyle("default"),
              opacity: isBooting || isMutating || !hasSession ? 0.5 : 1,
            }}
          >
            <Copy size={13} />
            Copy
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          gap: 12,
          padding: 12,
          flexWrap: "wrap",
          backgroundImage:
            "linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.02) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.02) 75%)",
          backgroundSize: "18px 18px",
          backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
        }}
      >
        <div
          style={{
            width: 296,
            maxWidth: "100%",
            display: "grid",
            gap: 12,
            alignContent: "start",
          }}
        >
          <div style={panelCardStyle()}>
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>Tool</span>
              <span style={{ fontSize: 12, color: "var(--overlay-text-primary)", fontWeight: 700 }}>
                {activeToolDefinition.label}
              </span>
              <span style={{ fontSize: 10, color: "var(--overlay-text-dim, rgba(255,255,255,0.5))" }}>
                {activeToolDefinition.description}
              </span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {imageCutoutToolDefinitions.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveToolId(tool.id)}
                  style={toolChipStyle(tool.id === activeToolId)}
                >
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{tool.label}</span>
                  <span style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>
                    {tool.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={panelCardStyle()}>
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>Live Tools</span>
              <span style={{ fontSize: 10, color: "var(--overlay-text-dim, rgba(255,255,255,0.5))" }}>
                {describeToolInteraction(activeToolId)}
              </span>
            </div>
            {activeToolId === "spark" ? (
              <ControlSlider
                label="Color Reach"
                value={sparkTolerance}
                min={0}
                max={100}
                step={1}
                onChange={setSparkTolerance}
                helper="Higher values let Spark jump across looser color matches."
              />
            ) : (
              <>
                <ControlSlider
                  label="Sweep Size"
                  value={sweepSize}
                  min={6}
                  max={140}
                  step={1}
                  onChange={setSweepSize}
                  helper="Larger sweeps cover more pixels per pass."
                />
                <ControlSlider
                  label="Sweep Reach"
                  value={sweepTolerance}
                  min={0}
                  max={100}
                  step={1}
                  onChange={setSweepTolerance}
                  helper="Higher reach accepts a wider range of nearby colors."
                />
                <ControlSlider
                  label="Sweep Softness"
                  value={sweepSoftness}
                  min={0}
                  max={100}
                  step={1}
                  onChange={setSweepSoftness}
                  helper="Soft sweeps taper their edges instead of cutting hard circles."
                />
              </>
            )}
          </div>

          <div style={panelCardStyle()}>
            <div style={{ display: "grid", gap: 3 }}>
              <span style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>Edge Tuning</span>
              <span style={{ fontSize: 10, color: "var(--overlay-text-dim, rgba(255,255,255,0.5))" }}>
                Shape the live edge without re-running the auto pass.
              </span>
            </div>
            <ControlSlider
              label="Soft Edge"
              value={edgeSoftness}
              min={0}
              max={24}
              step={1}
              onChange={setEdgeSoftness}
              helper="Adds feather-like softness around the mask boundary."
            />
            <ControlSlider
              label="Edge Pull"
              value={edgePull}
              min={-24}
              max={24}
              step={1}
              onChange={setEdgePull}
              helper="Negative values tighten the edge. Positive values grow it."
            />
          </div>

          <div style={panelCardStyle()}>
            <span style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>Gestures</span>
            <div style={{ display: "grid", gap: 4, fontSize: 10, color: "var(--overlay-text-primary)" }}>
              <span>Click / drag = add to subject</span>
              <span>Alt-click / right-drag = trim from subject</span>
              <span>Ctrl+C = copy</span>
              <span>Ctrl+S = save sibling PNG</span>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 360px",
            minWidth: 0,
            minHeight: 320,
            display: "flex",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background:
                "radial-gradient(circle at center, rgba(255,255,255,0.03), rgba(0,0,0,0.26))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            {isBooting && !sessionSnapshot ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  color: "var(--overlay-text-muted)",
                }}
              >
                <Loader2 size={26} className="animate-spin" />
                <span style={{ fontSize: 12 }}>Building the initial subject cutout…</span>
              </div>
            ) : sessionSnapshot ? (
              <div
                ref={frameRef}
                onPointerDown={handleSurfacePointerDown}
                onPointerMove={continueSweepStroke}
                onPointerUp={endSweepStroke}
                onPointerCancel={endSweepStroke}
                onLostPointerCapture={endSweepStroke}
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  cursor: isMutating ? "progress" : activeToolId === "spark" ? "cell" : "crosshair",
                  userSelect: "none",
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  aria-label={`${imageName} cutout preview`}
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    filter: filterCss,
                    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
                  }}
                />
                <canvas
                  ref={marchingAntsCanvasRef}
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    imageRendering: "pixelated",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  color: "#fca5a5",
                  padding: 24,
                }}
              >
                <Scissors size={26} />
                <span style={{ fontSize: 12 }}>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
