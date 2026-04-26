import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  Bot,
  ChevronRight,
  Copy,
  Eraser,
  Eye,
  Image,
  Palette,
  Pencil,
  RefreshCw,
  Save,
  ScanLine,
  Scissors,
  Sliders,
  Sparkles,
  Undo2,
} from "@/components/AppIcons";

import { useInteractionMotionController } from "../animation/interactionMotion";
import { matchesKeybinding } from "../config/hotkeys";
import {
  DEFAULT_IMAGE_CUTOUT_STAGE_TOOL_ID,
  explorerImageCutoutToolGroupDefinitions,
  resolveExplorerImageCutoutStageToolDefinition,
  resolveExplorerImageCutoutToolGroupForTool,
  resolveExplorerImageIsolationLaneDefinition,
  type ExplorerImageCutoutStageToolId,
  type ExplorerImageCutoutToolGroupId,
  type ExplorerImageIsolationLaneDefinition,
  type ExplorerImageCutoutWorkflowMode,
} from "../config/imageCutoutTools";
import {
  buildCSSFilterString,
  type ExplorerImageFiltersState,
} from "../config/imageEditorFilters";
import type { LocalModelBackendPreference } from "../config/localModels";
import {
  applyExplorerImageCutoutPrompts,
  closeExplorerImageCutoutSession,
  copyExplorerImageCutoutToClipboard,
  openExplorerImageCutoutSession,
  resetExplorerImageCutoutSession,
  stageExplorerImageCutoutExport,
  startExplorerImageCutoutNativeDrag,
  type ExplorerImageCutoutSessionSnapshot,
  type ExplorerImageCutoutStagedExportArtifact,
} from "../runtime/imageCutoutBackend";
import type { ManagedPythonRuntimeConfig } from "../runtime/pythonRuntimeBackend";
import { useSettingsStore } from "../store/settingsStore";
import { PremiumSlider } from "./PremiumSlider";
import {
  applyExplorerImageStageWheelZoom,
  DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM,
  normalizeExplorerImageStageTransform,
  type ExplorerImageStageTransform,
} from "./explorer/explorerImageStage";
import {
  applyCircularBrushInPlace,
  applyPolygonSelectionInPlace,
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
  type ExplorerImageCutoutMaskPoint,
  type ExplorerImageCutoutSourcePixels,
} from "./explorer/explorerImageCutoutMask";
import type {
  ExplorerPreviewContextMenuAction,
  ExplorerPreviewContextMenuRegistration,
} from "./explorer/explorerPreviewContextMenu";

type ExplorerImageCutoutSurfaceProps = {
  workflowMode: ExplorerImageCutoutWorkflowMode;
  imageName: string;
  imagePath: string;
  logicalOutputPath?: string;
  sourceImageUrl: string;
  filterState: ExplorerImageFiltersState;
  pythonRuntimeConfig?: ManagedPythonRuntimeConfig | null;
  cutoutModelId?: string | null;
  cutoutBackendPreference?: LocalModelBackendPreference | null;
  onRegisterContextMenuRegistration?: (
    registration: ExplorerPreviewContextMenuRegistration | null,
  ) => void;
  onSaved?: (outputPath?: string) => Promise<void> | void;
  onQueueClipboardEntry?: (
    artifact: ExplorerImageCutoutStagedExportArtifact,
  ) => Promise<void> | void;
};

type CutoutStatusTone = "neutral" | "success" | "warning" | "error";

type CutoutBoundarySnapshot = {
  width: number;
  height: number;
  points: ExplorerImageCutoutBoundaryPoint[];
};

type ExplorerImageCutoutLaneState = {
  workflowMode: ExplorerImageCutoutWorkflowMode;
  sessionSnapshot: ExplorerImageCutoutSessionSnapshot | null;
  sourcePixels: ExplorerImageCutoutSourcePixels | null;
  sourcePreviewCanvas: HTMLCanvasElement | null;
  baseMask: ExplorerImageCutoutAlphaMask | null;
  resolvedMask: ExplorerImageCutoutAlphaMask | null;
  boundary: CutoutBoundarySnapshot | null;
  history: Uint8ClampedArray[];
  historyIndex: number;
  previewReady: boolean;
  usedSourcePreviewFallback: boolean;
  isBooting: boolean;
  isMutating: boolean;
  statusTone: CutoutStatusTone;
  statusMessage: string;
  transform: ExplorerImageStageTransform;
  showMaskPreview: boolean;
  showToolPalette: boolean;
  showRefinePanel: boolean;
  openToolGroupId: ExplorerImageCutoutToolGroupId | null;
  activeStageTool: ExplorerImageCutoutStageToolId;
  selectionTolerance: number;
  brushSize: number;
  brushSoftness: number;
  magicWandContiguous: boolean;
  quickSelectEdgeAwareness: number;
  edgeSoftness: number;
  edgePull: number;
  bootRequestId: number;
};

type PendingStagePointerInteraction = {
  workflowMode: ExplorerImageCutoutWorkflowMode;
  pointerId: number;
  dragIntent: "clickToolCandidate" | "pan" | "nativeDrag";
  toolId: "aiSelect" | "magicWand";
  negativeMode: boolean;
  startClientX: number;
  startClientY: number;
  startTransform: ExplorerImageStageTransform;
  hasDragged: boolean;
  nativeDragStarted: boolean;
};

type ActiveBrushStroke = {
  workflowMode: ExplorerImageCutoutWorkflowMode;
  pointerId: number;
  toolId: "quickSelect" | "brush" | "erase";
  mode: ExplorerImageCutoutEditMode;
  workingMask: ExplorerImageCutoutAlphaMask;
  lastX: number;
  lastY: number;
};

type ActiveLassoStroke = {
  workflowMode: ExplorerImageCutoutWorkflowMode;
  pointerId: number;
  mode: ExplorerImageCutoutEditMode;
  points: ExplorerImageCutoutMaskPoint[];
};

type LoadedImageIsolationLane = {
  snapshot: ExplorerImageCutoutSessionSnapshot;
  sourcePreview: {
    pixels: ExplorerImageCutoutSourcePixels;
    canvas: HTMLCanvasElement;
    usedFallback: boolean;
  };
  initialMask: ExplorerImageCutoutAlphaMask;
};

const DEFAULT_PREVIEW_MAX_DIMENSION = 960;
const HISTORY_LIMIT = 32;
const POINTER_CLICK_THRESHOLD_PX = 6;
const MARCHING_ANTS_WIDTH = 4;
const MARCHING_ANTS_SPEED = 20;
const DEFAULT_SELECTION_TOLERANCE = 30;
const DEFAULT_BRUSH_SIZE = 34;
const DEFAULT_BRUSH_SOFTNESS = 42;
const DEFAULT_MAGIC_WAND_CONTIGUOUS = true;
const DEFAULT_QUICK_SELECT_EDGE_AWARENESS = 68;
const DEFAULT_EDGE_SOFTNESS = 2;
const DEFAULT_EDGE_PULL = 0;

function resolveDefaultStageTool(
  _workflowMode: ExplorerImageCutoutWorkflowMode,
): ExplorerImageCutoutStageToolId {
  return DEFAULT_IMAGE_CUTOUT_STAGE_TOOL_ID;
}

function cloneMask(
  mask: ExplorerImageCutoutAlphaMask,
): ExplorerImageCutoutAlphaMask {
  return {
    width: mask.width,
    height: mask.height,
    alpha: cloneCutoutMaskAlpha(mask.alpha),
  };
}

function hasVisibleBoundary(boundary: CutoutBoundarySnapshot | null): boolean {
  return (boundary?.points.length ?? 0) > 0;
}

function hasMaskSelection(mask: ExplorerImageCutoutAlphaMask | null): boolean {
  return mask?.alpha.some((sample) => sample > 0) ?? false;
}

function createEmptyMaskLike(
  mask: ExplorerImageCutoutAlphaMask,
): ExplorerImageCutoutAlphaMask {
  return {
    width: mask.width,
    height: mask.height,
    alpha: new Uint8ClampedArray(mask.alpha.length),
  };
}

function resolveLaneCopy(
  workflowMode: ExplorerImageCutoutWorkflowMode,
): ExplorerImageIsolationLaneDefinition {
  return resolveExplorerImageIsolationLaneDefinition(workflowMode);
}

function createDefaultLaneState(
  workflowMode: ExplorerImageCutoutWorkflowMode,
): ExplorerImageCutoutLaneState {
  const lane = resolveLaneCopy(workflowMode);
  return {
    workflowMode,
    sessionSnapshot: null,
    sourcePixels: null,
    sourcePreviewCanvas: null,
    baseMask: null,
    resolvedMask: null,
    boundary: null,
    history: [],
    historyIndex: 0,
    previewReady: false,
    usedSourcePreviewFallback: false,
    isBooting: false,
    isMutating: false,
    statusTone: "neutral",
    statusMessage: `Preparing ${lane.label.toLowerCase()}…`,
    transform: { ...DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM },
    showMaskPreview: false,
    showToolPalette: true,
    showRefinePanel: false,
    openToolGroupId: null,
    activeStageTool: resolveDefaultStageTool(workflowMode),
    selectionTolerance: DEFAULT_SELECTION_TOLERANCE,
    brushSize: DEFAULT_BRUSH_SIZE,
    brushSoftness: DEFAULT_BRUSH_SOFTNESS,
    magicWandContiguous: DEFAULT_MAGIC_WAND_CONTIGUOUS,
    quickSelectEdgeAwareness: DEFAULT_QUICK_SELECT_EDGE_AWARENESS,
    edgeSoftness: DEFAULT_EDGE_SOFTNESS,
    edgePull: DEFAULT_EDGE_PULL,
    bootRequestId: 0,
  };
}

function collectOpenSessionIds(
  laneStates: Record<ExplorerImageCutoutWorkflowMode, ExplorerImageCutoutLaneState>,
): string[] {
  const openSessionIds = Object.values(laneStates)
    .map((lane) => lane.sessionSnapshot?.sessionId ?? null)
    .filter((sessionId): sessionId is string => Boolean(sessionId));
  return Array.from(new Set(openSessionIds));
}

async function loadImageElement(source: string): Promise<HTMLImageElement> {
  const image = new window.Image();
  return await new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Failed to decode the cutout preview source image."));
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
    reader.onerror = () =>
      reject(new Error("Failed to convert the image blob to a data URL."));
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

async function buildPreviewSourcePixelsWithFallback(
  sourceImageUrl: string,
  fallbackSourceImageUrl: string,
  width: number,
  height: number,
): Promise<{
  pixels: ExplorerImageCutoutSourcePixels;
  canvas: HTMLCanvasElement;
  usedFallback: boolean;
}> {
  try {
    const result = await buildPreviewSourcePixels(sourceImageUrl, width, height);
    return {
      ...result,
      usedFallback: false,
    };
  } catch (primaryError) {
    if (fallbackSourceImageUrl === sourceImageUrl) {
      throw primaryError;
    }
    const fallbackResult = await buildPreviewSourcePixels(
      fallbackSourceImageUrl,
      width,
      height,
    );
    return {
      ...fallbackResult,
      usedFallback: true,
    };
  }
}

async function buildMaskFromDataUrl(
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

function surfaceRootStyle(): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--overlay-explorer-preview-bg) 92%, black 8%), color-mix(in srgb, var(--overlay-explorer-preview-bg) 84%, black 16%))",
    border: "1px solid var(--overlay-explorer-preview-border)",
    borderRadius: "var(--overlay-explorer-panel-radius, 12px)",
    boxShadow: "var(--overlay-explorer-toolbar-shadow, 0 18px 48px rgba(0,0,0,0.28))",
    isolation: "isolate",
  };
}

function floatingPanelStyle(): CSSProperties {
  return {
    borderRadius: "calc(var(--overlay-explorer-control-radius, 10px) + 4px)",
    border: "1px solid var(--overlay-explorer-preview-border)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--overlay-explorer-preview-bg) 88%, white 12%), var(--overlay-explorer-preview-bg))",
    boxShadow: "0 18px 48px rgba(0,0,0,0.26)",
    backdropFilter: "blur(18px)",
  };
}

function stageViewportStyle(cursor: string): CSSProperties {
  const checkerboardCss = `
    linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,0.035) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.035) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.035) 75%)
  `;
  return {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    cursor,
    backgroundImage: checkerboardCss,
    backgroundSize: "24px 24px",
    backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
  };
}

function stageContentStyle(
  transform: ExplorerImageStageTransform,
): CSSProperties {
  return {
    position: "absolute",
    inset: "50% auto auto 50%",
    transform: `translate(calc(-50% + ${transform.offsetX}px), calc(-50% + ${transform.offsetY}px)) scale(${transform.scale})`,
    transformOrigin: "center center",
    willChange: "transform",
    maxWidth: "min(100%, calc(100% - 48px))",
    maxHeight: "min(100%, calc(100% - 48px))",
  };
}

function previewCanvasStyle(filterCss: string): CSSProperties {
  return {
    display: "block",
    maxWidth: "min(100%, 1000px)",
    maxHeight: "min(100%, 1000px)",
    objectFit: "contain",
    filter: filterCss,
    imageRendering: "auto",
    userSelect: "none",
    WebkitUserSelect: "none",
    pointerEvents: "none",
  };
}

function marchingAntsCanvasStyle(hasBoundary: boolean): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    imageRendering: "pixelated",
    opacity: hasBoundary ? 1 : 0,
    transition: "opacity 120ms ease",
  };
}

type ExplorerIsolationButtonProps = {
  ariaLabel: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  variant?: "chip" | "action";
  motionSurfaceId?: "previewWorkflowTab" | "actionButton";
  motionStepIndex?: number;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  styleOverride?: CSSProperties;
  children: ReactNode;
};

function ExplorerIsolationButton({
  ariaLabel,
  title,
  active = false,
  disabled = false,
  variant = "chip",
  motionSurfaceId,
  motionStepIndex = 0,
  onClick,
  onContextMenu,
  styleOverride,
  children,
}: ExplorerIsolationButtonProps) {
  const interactionMotion = useInteractionMotionController();
  const surfaceId = motionSurfaceId ?? (variant === "chip" ? "previewWorkflowTab" : "actionButton");
  const motionBinding = useMemo(
    () =>
      interactionMotion.bindSurface({
        surfaceId,
        triggerState: active ? { activate: true } : undefined,
        motionStepIndex,
        baseTransition:
          "background 0.14s ease, border-color 0.14s ease, color 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease",
      }),
    [active, interactionMotion, motionStepIndex, surfaceId],
  );

  const baseStyle: CSSProperties =
    variant === "chip"
      ? {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          minHeight: 30,
          minWidth: 30,
          padding: "0 10px",
          borderRadius: "var(--overlay-explorer-control-radius, 8px)",
          border: active
            ? "1px solid var(--overlay-explorer-chip-active-border)"
            : "1px solid var(--overlay-explorer-chip-border)",
          background: active
            ? "var(--overlay-explorer-chip-active-bg)"
            : "var(--overlay-explorer-chip-bg)",
          color: active
            ? "var(--overlay-explorer-chip-active-text)"
            : "var(--overlay-text-primary)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.52 : 1,
        }
      : {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          minHeight: 32,
          minWidth: 32,
          padding: 0,
          borderRadius: "var(--overlay-explorer-control-radius, 8px)",
          border: active
            ? "1px solid var(--overlay-explorer-chip-active-border)"
            : "1px solid var(--overlay-explorer-preview-border)",
          background: active
            ? "var(--overlay-explorer-chip-active-bg)"
            : "color-mix(in srgb, var(--overlay-explorer-chip-bg) 76%, transparent)",
          color: active
            ? "var(--overlay-explorer-chip-active-text)"
            : "var(--overlay-text-primary)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.52 : 1,
          boxShadow: active
            ? "0 10px 26px color-mix(in srgb, var(--overlay-accent) 12%, transparent)"
            : "none",
        };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onClick?.();
        }
      }}
      onContextMenu={(event) => {
        if (!disabled) {
          onContextMenu?.(event);
        }
      }}
      {...motionBinding.motionDataAttributes}
      onPointerEnter={motionBinding.onPointerEnter}
      onPointerLeave={motionBinding.onPointerLeave}
      onPointerDown={motionBinding.onPointerDown}
      onPointerUp={motionBinding.onPointerUp}
      onPointerCancel={motionBinding.onPointerCancel}
      style={{
        ...baseStyle,
        ...styleOverride,
        ...motionBinding.motionStyle,
      }}
    >
      {children}
    </button>
  );
}

function CutoutSliderField({
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
  helper: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 10,
          color: "var(--overlay-text-muted)",
        }}
      >
        <span>{label}</span>
        <span
          style={{
            color: "var(--overlay-text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
      <PremiumSlider
        ariaLabel={label}
        ariaValueText={String(value)}
        value={value}
        min={min}
        max={max}
        step={step}
        density="compact"
        onChange={onChange}
      />
      <span
        style={{
          fontSize: 10,
          lineHeight: 1.45,
          color: "var(--overlay-text-dim, rgba(255,255,255,0.52))",
        }}
      >
        {helper}
      </span>
    </label>
  );
}

function CutoutToggleField({
  label,
  value,
  onLabel,
  offLabel,
  helper,
  onChange,
}: {
  label: string;
  value: boolean;
  onLabel: string;
  offLabel: string;
  helper: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "var(--overlay-text-muted)",
          }}
        >
          {label}
        </span>
        <ExplorerIsolationButton
          ariaLabel={label}
          title={helper}
          active={value}
          variant="chip"
          motionStepIndex={0}
          onClick={() => onChange(!value)}
        >
          <span>{value ? onLabel : offLabel}</span>
        </ExplorerIsolationButton>
      </div>
      <span
        style={{
          fontSize: 10,
          lineHeight: 1.45,
          color: "var(--overlay-text-dim, rgba(255,255,255,0.52))",
        }}
      >
        {helper}
      </span>
    </div>
  );
}

function toolRailStyle(): CSSProperties {
  return {
    ...floatingPanelStyle(),
    display: "grid",
    gap: 8,
    padding: "10px 8px",
    width: 56,
  };
}

function toolRailDividerStyle(): CSSProperties {
  return {
    width: "100%",
    height: 1,
    borderRadius: 999,
    background:
      "color-mix(in srgb, var(--overlay-explorer-preview-border) 74%, transparent)",
    margin: "2px 0",
  };
}

function toolGroupShellStyle(): CSSProperties {
  return {
    position: "relative",
    display: "grid",
    justifyItems: "center",
  };
}

function toolGroupFlyoutStyle(): CSSProperties {
  return {
    ...floatingPanelStyle(),
    position: "absolute",
    left: "calc(100% + 10px)",
    top: 0,
    display: "grid",
    gap: 6,
    minWidth: 186,
    padding: 8,
    pointerEvents: "auto",
    zIndex: 2,
  };
}

function toolRailButtonStyle(): CSSProperties {
  return {
    width: 38,
    minWidth: 38,
    height: 38,
    minHeight: 38,
    padding: 0,
    position: "relative",
  };
}

function toolGroupMenuButtonStyle(isOpen: boolean): CSSProperties {
  return {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 15,
    height: 15,
    minWidth: 15,
    minHeight: 15,
    borderRadius: 999,
    border: isOpen
      ? "1px solid var(--overlay-explorer-chip-active-border)"
      : "1px solid var(--overlay-explorer-chip-border)",
    background: isOpen
      ? "var(--overlay-explorer-chip-active-bg)"
      : "var(--overlay-explorer-chip-bg)",
    color: isOpen
      ? "var(--overlay-explorer-chip-active-text)"
      : "var(--overlay-text-muted)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(0,0,0,0.24)",
  };
}

function toolFlyoutButtonStyle(): CSSProperties {
  return {
    justifyContent: "flex-start",
    minHeight: 32,
    minWidth: "100%",
    width: "100%",
    padding: "0 10px",
  };
}

function lassoOverlayStyle(isVisible: boolean): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    opacity: isVisible ? 1 : 0,
    transition: "opacity 120ms ease",
  };
}

function renderCutoutToolIcon(
  iconName: ReturnType<typeof resolveExplorerImageCutoutStageToolDefinition>["iconName"],
): ReactNode {
  switch (iconName) {
    case "Bot":
      return <Bot size={15} />;
    case "ScanLine":
      return <ScanLine size={15} />;
    case "Sparkles":
      return <Sparkles size={15} />;
    case "Scissors":
      return <Scissors size={15} />;
    case "Pencil":
      return <Pencil size={15} />;
    case "Eraser":
      return <Eraser size={15} />;
    default:
      return <Sparkles size={15} />;
  }
}

export function ExplorerImageCutoutSurface({
  workflowMode,
  imageName: _imageName,
  imagePath,
  logicalOutputPath,
  sourceImageUrl,
  filterState,
  pythonRuntimeConfig = null,
  cutoutModelId = null,
  cutoutBackendPreference = "auto",
  onRegisterContextMenuRegistration,
  onSaved,
  onQueueClipboardEntry,
}: ExplorerImageCutoutSurfaceProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const stageContentRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const marchingAntsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resolvedMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const refreshPreviewFrameRef = useRef(0);
  const sourceGenerationRef = useRef(0);
  const activeBrushStrokeRef = useRef<ActiveBrushStroke | null>(null);
  const activeLassoStrokeRef = useRef<ActiveLassoStroke | null>(null);
  const pendingStageInteractionRef =
    useRef<PendingStagePointerInteraction | null>(null);
  const laneStatesRef = useRef<
    Record<ExplorerImageCutoutWorkflowMode, ExplorerImageCutoutLaneState>
  >({
    cutout: createDefaultLaneState("cutout"),
    removeBackground: createDefaultLaneState("removeBackground"),
  });
  const [, requestRender] = useReducer((value: number) => value + 1, 0);
  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  const activeLaneDefinition = useMemo(
    () => resolveExplorerImageIsolationLaneDefinition(workflowMode),
    [workflowMode],
  );
  const activeLane = laneStatesRef.current[workflowMode];
  const filterCss = buildCSSFilterString(filterState);
  const exportFilters = useMemo(() => buildExportFilters(filterState), [filterState]);

  const focusSurface = useCallback(() => {
    rootRef.current?.focus();
  }, []);

  const getLaneState = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode) => laneStatesRef.current[mode],
    [],
  );

  const invalidateActiveLane = useCallback(() => {
    requestRender();
  }, []);

  const renderLanePreview = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode) => {
      if (mode !== workflowMode) {
        return;
      }

      const lane = laneStatesRef.current[mode];
      const previewCanvas = previewCanvasRef.current;
      const baseMask = lane.baseMask;
      const sourcePreviewCanvas = lane.sourcePreviewCanvas;
      if (!previewCanvas || !baseMask || !sourcePreviewCanvas) {
        const previewContext = previewCanvas?.getContext("2d");
        if (previewCanvas && previewContext) {
          previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
        lane.resolvedMask = null;
        lane.boundary = null;
        lane.previewReady = false;
        invalidateActiveLane();
        return;
      }

      const resolvedMask = resolveAdjustedCutoutMask({
        baseMask,
        edgeSoftness: lane.edgeSoftness,
        edgePull: lane.edgePull,
      });
      lane.resolvedMask = resolvedMask;

      if (!resolvedMaskCanvasRef.current) {
        resolvedMaskCanvasRef.current = document.createElement("canvas");
      }
      writeCutoutMaskToCanvas(resolvedMask, resolvedMaskCanvasRef.current);

      previewCanvas.width = resolvedMask.width;
      previewCanvas.height = resolvedMask.height;
      const previewContext = previewCanvas.getContext("2d");
      if (!previewContext) {
        lane.previewReady = false;
        lane.boundary = null;
        invalidateActiveLane();
        return;
      }

      previewContext.clearRect(0, 0, resolvedMask.width, resolvedMask.height);
      previewContext.globalCompositeOperation = "source-over";
      previewContext.drawImage(
        sourcePreviewCanvas,
        0,
        0,
        resolvedMask.width,
        resolvedMask.height,
      );
      if (lane.showMaskPreview && hasMaskSelection(resolvedMask)) {
        previewContext.globalCompositeOperation = "destination-in";
        previewContext.drawImage(
          resolvedMaskCanvasRef.current,
          0,
          0,
          resolvedMask.width,
          resolvedMask.height,
        );
      }
      previewContext.globalCompositeOperation = "source-over";

      lane.boundary = {
        width: resolvedMask.width,
        height: resolvedMask.height,
        points: buildCutoutBoundaryPoints(resolvedMask),
      };
      lane.previewReady = true;
      invalidateActiveLane();
    },
    [invalidateActiveLane, workflowMode],
  );

  const schedulePreviewRefresh = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode = workflowMode) => {
      if (mode !== workflowMode) {
        return;
      }
      if (refreshPreviewFrameRef.current !== 0) {
        return;
      }
      refreshPreviewFrameRef.current = window.requestAnimationFrame(() => {
        refreshPreviewFrameRef.current = 0;
        renderLanePreview(mode);
      });
    },
    [renderLanePreview, workflowMode],
  );

  const syncLaneVisuals = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode) => {
      if (mode === workflowMode) {
        invalidateActiveLane();
        schedulePreviewRefresh(mode);
      }
    },
    [invalidateActiveLane, schedulePreviewRefresh, workflowMode],
  );

  const resetHistoryState = useCallback(
    (
      mode: ExplorerImageCutoutWorkflowMode,
      mask: ExplorerImageCutoutAlphaMask,
    ) => {
      const lane = getLaneState(mode);
      lane.baseMask = cloneMask(mask);
      lane.resolvedMask = null;
      lane.boundary = null;
      lane.history = [cloneCutoutMaskAlpha(mask.alpha)];
      lane.historyIndex = 0;
      lane.previewReady = false;
      syncLaneVisuals(mode);
    },
    [getLaneState, syncLaneVisuals],
  );

  const commitMaskHistory = useCallback(
    (
      mode: ExplorerImageCutoutWorkflowMode,
      mask: ExplorerImageCutoutAlphaMask,
      status: string,
      tone: CutoutStatusTone = "success",
    ) => {
      const lane = getLaneState(mode);
      const nextMask = cloneMask(mask);
      lane.baseMask = nextMask;
      lane.resolvedMask = null;
      lane.boundary = null;
      const nextHistory = [
        ...lane.history.slice(0, lane.historyIndex + 1),
        cloneCutoutMaskAlpha(nextMask.alpha),
      ];
      while (nextHistory.length > HISTORY_LIMIT) {
        nextHistory.shift();
      }
      lane.history = nextHistory;
      lane.historyIndex = nextHistory.length - 1;
      lane.previewReady = false;
      lane.statusTone = tone;
      lane.statusMessage = status;
      syncLaneVisuals(mode);
    },
    [getLaneState, syncLaneVisuals],
  );

  const previewMaskDuringStroke = useCallback(
    (
      mode: ExplorerImageCutoutWorkflowMode,
      mask: ExplorerImageCutoutAlphaMask,
      status: string,
    ) => {
      const lane = getLaneState(mode);
      lane.baseMask = mask;
      lane.resolvedMask = null;
      lane.boundary = null;
      lane.previewReady = false;
      lane.statusTone = "neutral";
      lane.statusMessage = status;
      syncLaneVisuals(mode);
    },
    [getLaneState, syncLaneVisuals],
  );

  const restoreHistoryIndex = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode, nextIndex: number) => {
      const lane = getLaneState(mode);
      const currentMask = lane.baseMask;
      const snapshot = lane.history[nextIndex];
      if (!currentMask || !snapshot) {
        return;
      }

      lane.baseMask = {
        width: currentMask.width,
        height: currentMask.height,
        alpha: cloneCutoutMaskAlpha(snapshot),
      };
      lane.resolvedMask = null;
      lane.boundary = null;
      lane.historyIndex = nextIndex;
      lane.previewReady = false;
      lane.statusTone = "success";
      lane.statusMessage =
        nextIndex === 0
          ? resolveLaneCopy(mode).resetLabel
          : `Restored edit ${nextIndex + 1} of ${lane.history.length}.`;
      syncLaneVisuals(mode);
    },
    [getLaneState, syncLaneVisuals],
  );

  const resolveMaskPointFromClient = useCallback(
    (
      mode: ExplorerImageCutoutWorkflowMode,
      clientX: number,
      clientY: number,
    ): { x: number; y: number; xNorm: number; yNorm: number } | null => {
      const content = stageContentRef.current;
      const lane = getLaneState(mode);
      const baseMask = lane.baseMask;
      if (!content || !baseMask) {
        return null;
      }

      const rect = content.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      const xNorm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const yNorm = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      return {
        x: Math.max(
          0,
          Math.min(baseMask.width - 1, Math.round(xNorm * (baseMask.width - 1))),
        ),
        y: Math.max(
          0,
          Math.min(baseMask.height - 1, Math.round(yNorm * (baseMask.height - 1))),
        ),
        xNorm,
        yNorm,
      };
    },
    [getLaneState],
  );

  const applyStrokePoint = useCallback(
    (
      lane: ExplorerImageCutoutLaneState,
      mask: ExplorerImageCutoutAlphaMask,
      point: { x: number; y: number },
      toolId: "quickSelect" | "brush" | "erase",
      mode: ExplorerImageCutoutEditMode,
    ) => {
      if (toolId === "quickSelect") {
        if (!lane.sourcePixels) {
          return;
        }
        applySweepSelectionInPlace({
          targetMask: mask,
          sourcePixels: lane.sourcePixels,
          centerX: point.x,
          centerY: point.y,
          radius: lane.brushSize,
          tolerance: lane.selectionTolerance,
          softness: lane.brushSoftness,
          edgeAwareness: lane.quickSelectEdgeAwareness,
          mode,
        });
        return;
      }

      applyCircularBrushInPlace({
        targetMask: mask,
        centerX: point.x,
        centerY: point.y,
        radius: lane.brushSize,
        softness: lane.brushSoftness,
        mode,
      });
    },
    [],
  );

  const loadLaneSnapshot = useCallback(
    async (
      mode: ExplorerImageCutoutWorkflowMode,
      existingSessionId: string | null,
    ): Promise<LoadedImageIsolationLane> => {
      const snapshot = existingSessionId
        ? await resetExplorerImageCutoutSession(existingSessionId)
        : await (async () => {
            const sessionInput = await resolveCutoutSessionInput(sourceImageUrl, imagePath);
            return await openExplorerImageCutoutSession({
              inputDataUrl: sessionInput.inputDataUrl,
              inputPath: sessionInput.inputPath,
              logicalOutputPath: logicalOutputPath ?? imagePath,
              previewMaxDimension: DEFAULT_PREVIEW_MAX_DIMENSION,
              config: pythonRuntimeConfig,
              modelId: cutoutModelId,
              backendPreference: cutoutBackendPreference,
              workflowMode: mode,
            });
          })();
      const [sourcePreview, initialMask] = await Promise.all([
        buildPreviewSourcePixelsWithFallback(
          sourceImageUrl,
          snapshot.cutoutPreviewDataUrl,
          snapshot.previewWidth,
          snapshot.previewHeight,
        ),
        buildMaskFromDataUrl(
          snapshot.previewMask.dataUrl,
          snapshot.previewWidth,
          snapshot.previewHeight,
        ),
      ]);
      return {
        snapshot,
        sourcePreview,
        initialMask,
      };
    },
    [
      cutoutBackendPreference,
      cutoutModelId,
      imagePath,
      logicalOutputPath,
      pythonRuntimeConfig,
      sourceImageUrl,
    ],
  );

  const hydrateLaneFromLoadedSnapshot = useCallback(
    (
      mode: ExplorerImageCutoutWorkflowMode,
      loadedLane: LoadedImageIsolationLane,
      statusMessage: string,
      statusTone: CutoutStatusTone,
    ) => {
      const lane = getLaneState(mode);
      lane.sessionSnapshot = loadedLane.snapshot;
      lane.sourcePixels = loadedLane.sourcePreview.pixels;
      lane.sourcePreviewCanvas = loadedLane.sourcePreview.canvas;
      lane.usedSourcePreviewFallback = loadedLane.sourcePreview.usedFallback;
      lane.statusTone = statusTone;
      lane.statusMessage = statusMessage;
      lane.isBooting = false;
      resetHistoryState(mode, loadedLane.initialMask);
    },
    [getLaneState, resetHistoryState],
  );

  const resolveExportMaskDataUrl = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode): string | null => {
      const lane = getLaneState(mode);
      const baseMask = lane.baseMask;
      if (!baseMask) {
        return null;
      }
      const resolvedMask =
        lane.resolvedMask ??
        resolveAdjustedCutoutMask({
          baseMask,
          edgeSoftness: lane.edgeSoftness,
          edgePull: lane.edgePull,
        });
      lane.resolvedMask = resolvedMask;
      lane.boundary = {
        width: resolvedMask.width,
        height: resolvedMask.height,
        points: buildCutoutBoundaryPoints(resolvedMask),
      };
      return maskToDataUrl(resolvedMask);
    },
    [getLaneState],
  );

  const stageNativeDrag = useCallback(
    async (mode: ExplorerImageCutoutWorkflowMode) => {
      const lane = getLaneState(mode);
      const snapshot = lane.sessionSnapshot;
      if (!snapshot || lane.isMutating) {
        return;
      }

      lane.isMutating = true;
      lane.statusTone = "neutral";
      lane.statusMessage = "Staging a drag-ready cutout PNG…";
      syncLaneVisuals(mode);

      try {
        const exportArtifact = await stageExplorerImageCutoutExport({
          sessionId: snapshot.sessionId,
          exportMode: "staging",
          logicalOutputPath: logicalOutputPath ?? imagePath,
          filters: exportFilters,
          overrideMaskDataUrl: resolveExportMaskDataUrl(mode),
        });
        await startExplorerImageCutoutNativeDrag(exportArtifact.outputPath);
        lane.statusTone = "success";
        lane.statusMessage = "Native drag staged. Drop the PNG into Explorer or the desktop.";
      } catch (error) {
        lane.statusTone = "error";
        lane.statusMessage = String(error);
      } finally {
        lane.isMutating = false;
        syncLaneVisuals(mode);
      }
    },
    [
      exportFilters,
      getLaneState,
      imagePath,
      logicalOutputPath,
      resolveExportMaskDataUrl,
      syncLaneVisuals,
    ],
  );

  const handleResetLane = useCallback(
    async (mode: ExplorerImageCutoutWorkflowMode) => {
      const lane = getLaneState(mode);
      const snapshot = lane.sessionSnapshot;
      if (!snapshot || lane.isMutating) {
        return;
      }

      lane.isMutating = true;
      lane.statusTone = "neutral";
      lane.statusMessage =
        mode === "cutout"
          ? "Clearing Cutout prompts and local refinements…"
          : "Refreshing automatic background removal…";
      syncLaneVisuals(mode);

      try {
        const loadedLane = await loadLaneSnapshot(mode, snapshot.sessionId);
        hydrateLaneFromLoadedSnapshot(
          mode,
          loadedLane,
          resolveLaneCopy(mode).resetLabel,
          "success",
        );
      } catch (error) {
        lane.statusTone = "error";
        lane.statusMessage = String(error);
      } finally {
        lane.isMutating = false;
        syncLaneVisuals(mode);
      }
    },
    [getLaneState, hydrateLaneFromLoadedSnapshot, loadLaneSnapshot, syncLaneVisuals],
  );

  const handleAutoRemoveBackground = useCallback(async () => {
    const cutoutLane = getLaneState("cutout");
    if (cutoutLane.isBooting || cutoutLane.isMutating) {
      return;
    }

    const removeBackgroundLane = getLaneState("removeBackground");
    cutoutLane.isMutating = true;
    cutoutLane.statusTone = "neutral";
    cutoutLane.statusMessage = "Running automatic background removal…";
    syncLaneVisuals("cutout");

    try {
      const loadedLane = await loadLaneSnapshot(
        "removeBackground",
        removeBackgroundLane.sessionSnapshot?.sessionId ?? null,
      );
      hydrateLaneFromLoadedSnapshot(
        "removeBackground",
        loadedLane,
        loadedLane.snapshot.diagnostics.message?.trim() ||
          resolveLaneCopy("removeBackground").readyMessage,
        loadedLane.sourcePreview.usedFallback ? "warning" : "success",
      );

      if (cutoutLane.baseMask) {
        commitMaskHistory(
          "cutout",
          loadedLane.initialMask,
          "Auto Remove BG merged into Cutout.",
        );
      } else {
        resetHistoryState("cutout", loadedLane.initialMask);
        cutoutLane.statusTone = "success";
        cutoutLane.statusMessage = "Auto Remove BG merged into Cutout.";
      }
    } catch (error) {
      cutoutLane.statusTone = "error";
      cutoutLane.statusMessage = String(error);
    } finally {
      cutoutLane.isMutating = false;
      syncLaneVisuals("cutout");
    }
  }, [
    commitMaskHistory,
    getLaneState,
    hydrateLaneFromLoadedSnapshot,
    loadLaneSnapshot,
    resetHistoryState,
    syncLaneVisuals,
  ]);

  const handleSaveSibling = useCallback(async () => {
    const lane = getLaneState(workflowMode);
    const snapshot = lane.sessionSnapshot;
    if (!snapshot || lane.isMutating) {
      return;
    }

    lane.isMutating = true;
    lane.statusTone = "neutral";
    lane.statusMessage = "Saving sibling cutout PNG…";
    syncLaneVisuals(workflowMode);

    try {
      const exportArtifact = await stageExplorerImageCutoutExport({
        sessionId: snapshot.sessionId,
        exportMode: "siblingPng",
        logicalOutputPath: logicalOutputPath ?? imagePath,
        filters: exportFilters,
        overrideMaskDataUrl: resolveExportMaskDataUrl(workflowMode),
      });
      await onSaved?.(exportArtifact.outputPath);
      lane.statusTone = "success";
      lane.statusMessage = `Saved ${exportArtifact.fileName}.`;
    } catch (error) {
      lane.statusTone = "error";
      lane.statusMessage = String(error);
    } finally {
      lane.isMutating = false;
      syncLaneVisuals(workflowMode);
    }
  }, [
    exportFilters,
    getLaneState,
    imagePath,
    logicalOutputPath,
    onSaved,
    resolveExportMaskDataUrl,
    syncLaneVisuals,
    workflowMode,
  ]);

  const handleCopyToClipboard = useCallback(async () => {
    const lane = getLaneState(workflowMode);
    const snapshot = lane.sessionSnapshot;
    if (!snapshot || lane.isMutating) {
      return;
    }

    lane.isMutating = true;
    lane.statusTone = "neutral";
    lane.statusMessage = onQueueClipboardEntry
      ? "Copying the current cutout to the clipboard and Explorer paste queue…"
      : "Copying the current cutout to the system clipboard…";
    syncLaneVisuals(workflowMode);

    try {
      const exportArtifact = await copyExplorerImageCutoutToClipboard({
        sessionId: snapshot.sessionId,
        logicalOutputPath: logicalOutputPath ?? imagePath,
        filters: exportFilters,
        overrideMaskDataUrl: resolveExportMaskDataUrl(workflowMode),
      });
      await onQueueClipboardEntry?.(exportArtifact);
      lane.statusTone = "success";
      lane.statusMessage = onQueueClipboardEntry
        ? "Cutout copied and queued for Explorer paste."
        : "Cutout copied to the clipboard.";
    } catch (error) {
      lane.statusTone = "error";
      lane.statusMessage = String(error);
    } finally {
      lane.isMutating = false;
      syncLaneVisuals(workflowMode);
    }
  }, [
    exportFilters,
    getLaneState,
    imagePath,
    logicalOutputPath,
    onQueueClipboardEntry,
    resolveExportMaskDataUrl,
    syncLaneVisuals,
    workflowMode,
  ]);

  const handleApplyPrompt = useCallback(
    async (kind: "positive" | "negative", xNorm: number, yNorm: number) => {
      const lane = getLaneState(workflowMode);
      const snapshot = lane.sessionSnapshot;
      if (!snapshot || lane.isMutating) {
        return;
      }

      lane.isMutating = true;
      lane.statusTone = "neutral";
      lane.statusMessage =
        kind === "positive"
          ? "Expanding the selection from your prompt…"
          : "Subtracting the background from your prompt…";
      syncLaneVisuals(workflowMode);

      try {
        const nextSnapshot = await applyExplorerImageCutoutPrompts({
          sessionId: snapshot.sessionId,
          prompts: [{ xNorm, yNorm, kind }],
        });
        const nextMask = await buildMaskFromDataUrl(
          nextSnapshot.previewMask.dataUrl,
          nextSnapshot.previewWidth,
          nextSnapshot.previewHeight,
        );
        lane.sessionSnapshot = nextSnapshot;
        commitMaskHistory(
          workflowMode,
          nextMask,
          kind === "positive"
            ? "Prompt added to the selection."
            : "Prompt removed from the selection.",
        );
      } catch (error) {
        lane.statusTone = "error";
        lane.statusMessage = String(error);
      } finally {
        lane.isMutating = false;
        syncLaneVisuals(workflowMode);
      }
    },
    [commitMaskHistory, getLaneState, syncLaneVisuals, workflowMode],
  );

  const bootLane = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode) => {
      const lane = getLaneState(mode);
      const laneDefinition = resolveLaneCopy(mode);
      if (lane.isBooting || lane.sessionSnapshot) {
        syncLaneVisuals(mode);
        return;
      }

      const generation = sourceGenerationRef.current;
      const requestId = lane.bootRequestId + 1;
      lane.bootRequestId = requestId;
      lane.isBooting = true;
      lane.isMutating = false;
      lane.statusTone = "neutral";
      lane.statusMessage =
        mode === "cutout"
          ? "Preparing prompt-first Cutout…"
          : "Preparing automatic background removal…";
      lane.previewReady = false;
      lane.usedSourcePreviewFallback = false;
      lane.sessionSnapshot = null;
      lane.sourcePixels = null;
      lane.sourcePreviewCanvas = null;
      lane.baseMask = null;
      lane.resolvedMask = null;
      lane.boundary = null;
      lane.history = [];
      lane.historyIndex = 0;
      lane.showRefinePanel = false;
      lane.showMaskPreview = false;
      lane.openToolGroupId = null;
      lane.activeStageTool = resolveDefaultStageTool(mode);
      syncLaneVisuals(mode);

      void (async () => {
        try {
          const loadedLane = await loadLaneSnapshot(mode, null);
          const snapshot = loadedLane.snapshot;

          const currentLane = laneStatesRef.current[mode];
          const isStale =
            sourceGenerationRef.current !== generation ||
            currentLane.bootRequestId !== requestId;
          if (isStale) {
            await closeExplorerImageCutoutSession(snapshot.sessionId).catch(() => {});
            return;
          }

          hydrateLaneFromLoadedSnapshot(
            mode,
            loadedLane,
            loadedLane.sourcePreview.usedFallback
            ? `${laneDefinition.readyMessage} Source preview fallback is active, so prompt placement may feel slightly softer.`
            : snapshot.diagnostics.message?.trim() || laneDefinition.readyMessage,
            loadedLane.sourcePreview.usedFallback ? "warning" : "success",
          );
          if (mode === workflowMode) {
            focusSurface();
          }
          syncLaneVisuals(mode);
        } catch (error) {
          const currentLane = laneStatesRef.current[mode];
          const isStale =
            sourceGenerationRef.current !== generation ||
            currentLane.bootRequestId !== requestId;
          if (isStale) {
            return;
          }
          currentLane.isBooting = false;
          currentLane.statusTone = "error";
          currentLane.statusMessage = String(error);
          currentLane.sessionSnapshot = null;
          syncLaneVisuals(mode);
        }
      })();
    },
    [
      cutoutBackendPreference,
      cutoutModelId,
      focusSurface,
      getLaneState,
      hydrateLaneFromLoadedSnapshot,
      imagePath,
      loadLaneSnapshot,
      pythonRuntimeConfig,
      sourceImageUrl,
      syncLaneVisuals,
      workflowMode,
    ],
  );

  const clearInteractivePointers = useCallback(
    (mode: ExplorerImageCutoutWorkflowMode) => {
      const activeBrushStroke = activeBrushStrokeRef.current;
      if (activeBrushStroke?.workflowMode === mode) {
        activeBrushStrokeRef.current = null;
      }
      const activeLassoStroke = activeLassoStrokeRef.current;
      if (activeLassoStroke?.workflowMode === mode) {
        activeLassoStrokeRef.current = null;
      }
      const pendingInteraction = pendingStageInteractionRef.current;
      if (pendingInteraction?.workflowMode === mode) {
        pendingStageInteractionRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const previousLaneStates = laneStatesRef.current;
    const openSessionIds = collectOpenSessionIds(previousLaneStates);
    sourceGenerationRef.current += 1;
    laneStatesRef.current = {
      cutout: createDefaultLaneState("cutout"),
      removeBackground: createDefaultLaneState("removeBackground"),
    };
    clearInteractivePointers("cutout");
    clearInteractivePointers("removeBackground");
    if (refreshPreviewFrameRef.current !== 0) {
      window.cancelAnimationFrame(refreshPreviewFrameRef.current);
      refreshPreviewFrameRef.current = 0;
    }
    const previewCanvas = previewCanvasRef.current;
    const previewContext = previewCanvas?.getContext("2d");
    if (previewCanvas && previewContext) {
      previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    const antsCanvas = marchingAntsCanvasRef.current;
    const antsContext = antsCanvas?.getContext("2d");
    if (antsCanvas && antsContext) {
      antsContext.clearRect(0, 0, antsCanvas.width, antsCanvas.height);
    }
    invalidateActiveLane();
    for (const sessionId of openSessionIds) {
      void closeExplorerImageCutoutSession(sessionId).catch(() => {});
    }
  }, [
    clearInteractivePointers,
    cutoutBackendPreference,
    cutoutModelId,
    imagePath,
    invalidateActiveLane,
    logicalOutputPath,
    pythonRuntimeConfig,
    sourceImageUrl,
  ]);

  useEffect(() => {
    bootLane(workflowMode);
    schedulePreviewRefresh(workflowMode);
    invalidateActiveLane();
  }, [bootLane, invalidateActiveLane, schedulePreviewRefresh, workflowMode]);

  useEffect(() => {
    return () => {
      const openSessionIds = collectOpenSessionIds(laneStatesRef.current);
      if (refreshPreviewFrameRef.current !== 0) {
        window.cancelAnimationFrame(refreshPreviewFrameRef.current);
      }
      for (const sessionId of openSessionIds) {
        void closeExplorerImageCutoutSession(sessionId).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    let animationFrameId = 0;

    const render = (now: number) => {
      const antsCanvas = marchingAntsCanvasRef.current;
      const boundary = laneStatesRef.current[workflowMode].boundary;
      if (!antsCanvas || !boundary || !hasVisibleBoundary(boundary)) {
        const context = antsCanvas?.getContext("2d");
        if (context && antsCanvas) {
          context.clearRect(0, 0, antsCanvas.width, antsCanvas.height);
        }
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      if (
        antsCanvas.width !== boundary.width ||
        antsCanvas.height !== boundary.height
      ) {
        antsCanvas.width = boundary.width;
        antsCanvas.height = boundary.height;
      }

      const context = antsCanvas.getContext("2d");
      if (!context) {
        animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      const imageData = context.createImageData(boundary.width, boundary.height);
      const phase = (now / 1000) * MARCHING_ANTS_SPEED;
      for (const [x, y] of boundary.points) {
        const stripe =
          (((x + y - phase) / (MARCHING_ANTS_WIDTH * 2)) % 2 + 2) % 2;
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
  }, [workflowMode]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const lane = getLaneState(workflowMode);
      if (!lane.sessionSnapshot) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      lane.transform = applyExplorerImageStageWheelZoom({
        currentTransform: lane.transform,
        viewport: stageViewportRef.current,
        content: stageContentRef.current,
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
      invalidateActiveLane();
    },
    [getLaneState, invalidateActiveLane, workflowMode],
  );

  const handleUndo = useCallback(() => {
    const lane = getLaneState(workflowMode);
    if (lane.historyIndex <= 0 || lane.isMutating) {
      return;
    }
    restoreHistoryIndex(workflowMode, lane.historyIndex - 1);
  }, [getLaneState, restoreHistoryIndex, workflowMode]);

  const handleRedo = useCallback(() => {
    const lane = getLaneState(workflowMode);
    if (lane.historyIndex + 1 >= lane.history.length || lane.isMutating) {
      return;
    }
    restoreHistoryIndex(workflowMode, lane.historyIndex + 1);
  }, [getLaneState, restoreHistoryIndex, workflowMode]);

  const handleResetStageView = useCallback(() => {
    const lane = getLaneState(workflowMode);
    lane.transform = { ...DEFAULT_EXPLORER_IMAGE_STAGE_TRANSFORM };
    syncLaneVisuals(workflowMode);
  }, [getLaneState, syncLaneVisuals, workflowMode]);

  const handleDeselect = useCallback(() => {
    const lane = getLaneState(workflowMode);
    const baseMask = lane.baseMask;
    if (!baseMask || lane.isMutating) {
      return;
    }
    if (!hasMaskSelection(baseMask)) {
      lane.statusTone = "neutral";
      lane.statusMessage = "Nothing is selected right now.";
      invalidateActiveLane();
      return;
    }
    commitMaskHistory(
      workflowMode,
      createEmptyMaskLike(baseMask),
      "Selection cleared.",
    );
  }, [
    commitMaskHistory,
    getLaneState,
    invalidateActiveLane,
    workflowMode,
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
      if (matchesKeybinding(event, keybindings.imageCutoutDeselect)) {
        event.preventDefault();
        event.stopPropagation();
        handleDeselect();
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
        handleUndo();
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorRedo)) {
        event.preventDefault();
        event.stopPropagation();
        handleRedo();
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorReset)) {
        event.preventDefault();
        event.stopPropagation();
        void handleResetLane(workflowMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    handleCopyToClipboard,
    handleDeselect,
    handleRedo,
    handleResetLane,
    handleSaveSibling,
    handleUndo,
    keybindings.imageCutoutCopy,
    keybindings.imageCutoutDeselect,
    keybindings.imageEditorRedo,
    keybindings.imageEditorReset,
    keybindings.imageEditorUndo,
    keybindings.saveFile,
    workflowMode,
  ]);

  const handleToolPaletteToggle = useCallback(() => {
    const lane = getLaneState(workflowMode);
    lane.showToolPalette = !lane.showToolPalette;
    if (!lane.showToolPalette) {
      lane.openToolGroupId = null;
    }
    invalidateActiveLane();
  }, [getLaneState, invalidateActiveLane, workflowMode]);

  const handleRefineToggle = useCallback(() => {
    const lane = getLaneState(workflowMode);
    lane.showRefinePanel = !lane.showRefinePanel;
    invalidateActiveLane();
  }, [getLaneState, invalidateActiveLane, workflowMode]);

  const handleMaskPreviewToggle = useCallback(() => {
    const lane = getLaneState(workflowMode);
    lane.showMaskPreview = !lane.showMaskPreview;
    lane.previewReady = false;
    lane.statusTone = "neutral";
    lane.statusMessage = lane.showMaskPreview
      ? "Mask preview enabled."
      : "Source image preview enabled.";
    syncLaneVisuals(workflowMode);
  }, [getLaneState, syncLaneVisuals, workflowMode]);

  const handleSelectStageTool = useCallback(
    (nextTool: ExplorerImageCutoutStageToolId) => {
      const lane = getLaneState(workflowMode);
      lane.activeStageTool = nextTool;
      lane.showToolPalette = true;
      lane.openToolGroupId = null;
      invalidateActiveLane();
    },
    [getLaneState, invalidateActiveLane, workflowMode],
  );

  const handleToggleToolGroup = useCallback(
    (groupId: ExplorerImageCutoutToolGroupId) => {
      const lane = getLaneState(workflowMode);
      lane.openToolGroupId = lane.openToolGroupId === groupId ? null : groupId;
      lane.showToolPalette = true;
      invalidateActiveLane();
    },
    [getLaneState, invalidateActiveLane, workflowMode],
  );

  useEffect(() => {
    if (!onRegisterContextMenuRegistration) {
      return;
    }

    const baseActions: ExplorerPreviewContextMenuAction[] = [
      {
        id: "image-cutout.reset-view",
        title: "Reset View",
        description: "Restore the cutout stage zoom and pan.",
        iconName: "RotateCcw",
        group: "preview",
        defaultOrder: 10,
        priority: 10,
        onSelect: () => handleResetStageView(),
      },
      {
        id: "image-cutout.reset-workflow",
        title: "Reset Isolation",
        description: "Re-run the current isolation workflow from its source mask.",
        iconName: "RefreshCw",
        group: "preview",
        defaultOrder: 20,
        priority: 20,
        onSelect: () => handleResetLane(workflowMode),
      },
      {
        id: "image-cutout.auto-remove-background",
        title: "Auto Remove BG",
        description: "Run automatic background removal and merge the result into Cutout.",
        iconName: "Sparkles",
        group: "preview",
        defaultOrder: 30,
        priority: 30,
        onSelect: () => {
          void handleAutoRemoveBackground();
        },
      },
    ];

    if (hasMaskSelection(activeLane.baseMask)) {
      baseActions.push({
        id: "image-cutout.deselect",
        title: "Deselect",
        description:
          "Clear the current subject selection without resetting the cutout session.",
        iconName: "Circle",
        group: "preview",
        defaultOrder: 35,
        priority: 35,
        onSelect: () => handleDeselect(),
      });
    }

    baseActions.push(
      {
        id: "image-cutout.mask-preview.toggle",
        title: activeLane.showMaskPreview
          ? "Disable Mask Preview"
          : "Enable Mask Preview",
        description: activeLane.showMaskPreview
          ? "Return to the full source image while keeping the current selection."
          : "Preview the isolated subject instead of the full source image.",
        iconName: activeLane.showMaskPreview ? "Image" : "Eye",
        group: "preview",
        defaultOrder: 38,
        priority: 38,
        onSelect: () => handleMaskPreviewToggle(),
      },
      {
        id: "image-cutout.tools.toggle",
        title: activeLane.showToolPalette ? "Hide Tool Rail" : "Show Tool Rail",
        description: "Reveal the compact left-docked cutout tool rail.",
        iconName: "Palette",
        group: "preview",
        defaultOrder: 40,
        priority: 40,
        onSelect: () => handleToolPaletteToggle(),
      },
      {
        id: "image-cutout.refine.toggle",
        title: activeLane.showRefinePanel ? "Hide Refine Controls" : "Show Refine Controls",
        description: "Reveal the compact edge and brush refinement controls.",
        iconName: "Sliders",
        group: "preview",
        defaultOrder: 50,
        priority: 50,
        onSelect: () => handleRefineToggle(),
      },
    );

    onRegisterContextMenuRegistration({
      previewKind: "image",
      baseActions,
      workflowOverlays: [],
    });

    return () => {
      onRegisterContextMenuRegistration(null);
    };
  }, [
    activeLane.baseMask,
    activeLane.showMaskPreview,
    activeLane.showToolPalette,
    handleAutoRemoveBackground,
    handleDeselect,
    handleMaskPreviewToggle,
    handleToolPaletteToggle,
    activeLane.showRefinePanel,
    handleRefineToggle,
    handleResetLane,
    handleResetStageView,
    onRegisterContextMenuRegistration,
    workflowMode,
  ]);

  const beginBrushStroke = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      point: { x: number; y: number },
      stageTool: "quickSelect" | "brush" | "erase",
      negativeMode = false,
    ) => {
      const lane = getLaneState(workflowMode);
      const baseMask = lane.baseMask;
      if (!baseMask) {
        return;
      }

      const workingMask = cloneMask(baseMask);
      const editMode: ExplorerImageCutoutEditMode =
        stageTool === "erase" || negativeMode ? "subtract" : "add";
      applyStrokePoint(lane, workingMask, point, stageTool, editMode);
      activeBrushStrokeRef.current = {
        workflowMode,
        pointerId: event.pointerId,
        toolId: stageTool,
        mode: editMode,
        workingMask,
        lastX: point.x,
        lastY: point.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      previewMaskDuringStroke(
        workflowMode,
        workingMask,
        stageTool === "quickSelect"
          ? editMode === "add"
            ? "Quick Select is growing the mask…"
            : "Quick Select is subtracting from the mask…"
          : editMode === "add"
            ? "Painting into the mask…"
            : "Erasing from the mask…",
      );
    },
    [applyStrokePoint, getLaneState, previewMaskDuringStroke, workflowMode],
  );

  const continueBrushStroke = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeBrushStroke = activeBrushStrokeRef.current;
      if (
        !activeBrushStroke ||
        activeBrushStroke.workflowMode !== workflowMode ||
        event.pointerId !== activeBrushStroke.pointerId
      ) {
        return;
      }

      const point = resolveMaskPointFromClient(
        workflowMode,
        event.clientX,
        event.clientY,
      );
      if (!point) {
        return;
      }

      const lane = getLaneState(workflowMode);
      const deltaX = point.x - activeBrushStroke.lastX;
      const deltaY = point.y - activeBrushStroke.lastY;
      const distance = Math.hypot(deltaX, deltaY);
      const stepCount = Math.max(
        1,
        Math.ceil(distance / Math.max(2, lane.brushSize / 3)),
      );

      for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
        const stepPoint = {
          x: Math.round(
            activeBrushStroke.lastX + (deltaX * stepIndex) / stepCount,
          ),
          y: Math.round(
            activeBrushStroke.lastY + (deltaY * stepIndex) / stepCount,
          ),
        };
        applyStrokePoint(
          lane,
          activeBrushStroke.workingMask,
          stepPoint,
          activeBrushStroke.toolId,
          activeBrushStroke.mode,
        );
      }

      activeBrushStroke.lastX = point.x;
      activeBrushStroke.lastY = point.y;
      previewMaskDuringStroke(
        workflowMode,
        activeBrushStroke.workingMask,
        activeBrushStroke.toolId === "quickSelect"
          ? activeBrushStroke.mode === "add"
            ? "Quick Select is growing the mask…"
            : "Quick Select is subtracting from the mask…"
          : activeBrushStroke.mode === "add"
            ? "Painting into the mask…"
            : "Erasing from the mask…",
      );
    },
    [
      applyStrokePoint,
      getLaneState,
      previewMaskDuringStroke,
      resolveMaskPointFromClient,
      workflowMode,
    ],
  );

  const endBrushStroke = useCallback(() => {
    const activeBrushStroke = activeBrushStrokeRef.current;
    if (!activeBrushStroke || activeBrushStroke.workflowMode !== workflowMode) {
      return;
    }
    activeBrushStrokeRef.current = null;
    commitMaskHistory(
      workflowMode,
      activeBrushStroke.workingMask,
      activeBrushStroke.toolId === "quickSelect"
        ? activeBrushStroke.mode === "add"
          ? "Quick Select added to the mask."
          : "Quick Select trimmed the mask."
        : activeBrushStroke.mode === "add"
          ? "Brush paint added to the mask."
          : "Brush erase trimmed the mask.",
    );
  }, [commitMaskHistory, workflowMode]);

  const beginLassoStroke = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      point: { x: number; y: number },
      negativeMode: boolean,
    ) => {
      activeLassoStrokeRef.current = {
        workflowMode,
        pointerId: event.pointerId,
        mode: negativeMode ? "subtract" : "add",
        points: [{ x: point.x, y: point.y }],
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      const lane = getLaneState(workflowMode);
      lane.statusTone = "neutral";
      lane.statusMessage = negativeMode
        ? "Drawing a subtractive lasso…"
        : "Drawing an additive lasso…";
      invalidateActiveLane();
    },
    [getLaneState, invalidateActiveLane, workflowMode],
  );

  const continueLassoStroke = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeLassoStroke = activeLassoStrokeRef.current;
      if (
        !activeLassoStroke ||
        activeLassoStroke.workflowMode !== workflowMode ||
        event.pointerId !== activeLassoStroke.pointerId
      ) {
        return;
      }

      const point = resolveMaskPointFromClient(
        workflowMode,
        event.clientX,
        event.clientY,
      );
      if (!point) {
        return;
      }

      const lastPoint =
        activeLassoStroke.points[activeLassoStroke.points.length - 1] ?? null;
      if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) {
        return;
      }
      activeLassoStroke.points.push({ x: point.x, y: point.y });
      invalidateActiveLane();
    },
    [invalidateActiveLane, resolveMaskPointFromClient, workflowMode],
  );

  const endLassoStroke = useCallback(() => {
    const activeLassoStroke = activeLassoStrokeRef.current;
    if (!activeLassoStroke || activeLassoStroke.workflowMode !== workflowMode) {
      return;
    }
    activeLassoStrokeRef.current = null;

    const lane = getLaneState(workflowMode);
    const baseMask = lane.baseMask;
    if (!baseMask || activeLassoStroke.points.length < 3) {
      lane.statusTone = "warning";
      lane.statusMessage = "Lasso path was too short to make a selection.";
      invalidateActiveLane();
      return;
    }

    const workingMask = cloneMask(baseMask);
    applyPolygonSelectionInPlace({
      targetMask: workingMask,
      polygonPoints: activeLassoStroke.points,
      mode: activeLassoStroke.mode,
    });
    commitMaskHistory(
      workflowMode,
      workingMask,
      activeLassoStroke.mode === "add"
        ? "Lasso added to the mask."
        : "Lasso removed from the mask.",
    );
  }, [commitMaskHistory, getLaneState, invalidateActiveLane, workflowMode]);

  const handleApplyMagicWand = useCallback(
    (point: { x: number; y: number }, negativeMode: boolean) => {
      const lane = getLaneState(workflowMode);
      const baseMask = lane.baseMask;
      if (!baseMask || !lane.sourcePixels) {
        return;
      }

      const nextMask = applySparkSelection({
        baseMask,
        sourcePixels: lane.sourcePixels,
        centerX: point.x,
        centerY: point.y,
        tolerance: lane.selectionTolerance,
        contiguous: lane.magicWandContiguous,
        mode: negativeMode ? "subtract" : "add",
      });
      commitMaskHistory(
        workflowMode,
        nextMask,
        negativeMode
          ? "Magic Wand removed the clicked region."
          : "Magic Wand added the clicked region.",
      );
    },
    [commitMaskHistory, getLaneState, workflowMode],
  );

  const handleStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      focusSurface();

      const lane = getLaneState(workflowMode);
      if (
        lane.isBooting ||
        lane.isMutating ||
        !lane.sessionSnapshot ||
        !lane.baseMask ||
        event.button > 2
      ) {
        return;
      }

      const point = resolveMaskPointFromClient(
        workflowMode,
        event.clientX,
        event.clientY,
      );
      if (!point) {
        return;
      }

      event.preventDefault();
      const forcePanGesture = event.button === 1;
      const negativeMode = event.altKey || event.button === 2;
      const nativeDragModifierActive =
        (event.ctrlKey || event.metaKey) && event.shiftKey;
      if (lane.openToolGroupId) {
        lane.openToolGroupId = null;
        invalidateActiveLane();
      }

      if (nativeDragModifierActive) {
        pendingStageInteractionRef.current = {
          workflowMode,
          pointerId: event.pointerId,
          dragIntent: "nativeDrag",
          toolId: lane.activeStageTool === "magicWand" ? "magicWand" : "aiSelect",
          negativeMode,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startTransform: lane.transform,
          hasDragged: false,
          nativeDragStarted: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (forcePanGesture) {
        pendingStageInteractionRef.current = {
          workflowMode,
          pointerId: event.pointerId,
          dragIntent: "pan",
          toolId: lane.activeStageTool === "magicWand" ? "magicWand" : "aiSelect",
          negativeMode,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startTransform: lane.transform,
          hasDragged: false,
          nativeDragStarted: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (
        lane.activeStageTool === "quickSelect" ||
        lane.activeStageTool === "brush" ||
        lane.activeStageTool === "erase"
      ) {
        beginBrushStroke(
          event,
          point,
          lane.activeStageTool,
          lane.activeStageTool === "quickSelect" ? negativeMode : false,
        );
        return;
      }

      if (lane.activeStageTool === "lasso") {
      beginLassoStroke(event, point, negativeMode);
      return;
      }

      pendingStageInteractionRef.current = {
        workflowMode,
        pointerId: event.pointerId,
        dragIntent: "clickToolCandidate",
        toolId: lane.activeStageTool === "magicWand" ? "magicWand" : "aiSelect",
        negativeMode,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startTransform: lane.transform,
        hasDragged: false,
        nativeDragStarted: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      beginLassoStroke,
      beginBrushStroke,
      focusSurface,
      getLaneState,
      resolveMaskPointFromClient,
      workflowMode,
    ],
  );

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      continueBrushStroke(event);
      continueLassoStroke(event);

      const pendingInteraction = pendingStageInteractionRef.current;
      if (
        !pendingInteraction ||
        pendingInteraction.workflowMode !== workflowMode ||
        event.pointerId !== pendingInteraction.pointerId
      ) {
        return;
      }

      const lane = getLaneState(workflowMode);
      const deltaX = event.clientX - pendingInteraction.startClientX;
      const deltaY = event.clientY - pendingInteraction.startClientY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < POINTER_CLICK_THRESHOLD_PX) {
        return;
      }

      pendingInteraction.hasDragged = true;

      if (pendingInteraction.dragIntent === "nativeDrag") {
        if (!pendingInteraction.nativeDragStarted) {
          pendingInteraction.nativeDragStarted = true;
          void stageNativeDrag(workflowMode);
        }
        return;
      }

      lane.transform = normalizeExplorerImageStageTransform(
        {
          scale: pendingInteraction.startTransform.scale,
          offsetX: pendingInteraction.startTransform.offsetX + deltaX,
          offsetY: pendingInteraction.startTransform.offsetY + deltaY,
        },
        stageViewportRef.current,
        stageContentRef.current,
      );
      invalidateActiveLane();
    },
    [
      continueBrushStroke,
      continueLassoStroke,
      getLaneState,
      invalidateActiveLane,
      stageNativeDrag,
      workflowMode,
    ],
  );

  const clearStagePointer = useCallback(() => {
    pendingStageInteractionRef.current = null;
  }, []);

  const handleStagePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeBrushStroke = activeBrushStrokeRef.current;
      if (
        activeBrushStroke &&
        activeBrushStroke.workflowMode === workflowMode &&
        event.pointerId === activeBrushStroke.pointerId
      ) {
        endBrushStroke();
      }

      const activeLassoStroke = activeLassoStrokeRef.current;
      if (
        activeLassoStroke &&
        activeLassoStroke.workflowMode === workflowMode &&
        event.pointerId === activeLassoStroke.pointerId
      ) {
        endLassoStroke();
      }

      const pendingInteraction = pendingStageInteractionRef.current;
      if (
        !pendingInteraction ||
        pendingInteraction.workflowMode !== workflowMode ||
        event.pointerId !== pendingInteraction.pointerId
      ) {
        clearStagePointer();
        return;
      }

      clearStagePointer();

      if (
        pendingInteraction.dragIntent === "clickToolCandidate" &&
        !pendingInteraction.hasDragged
      ) {
        const point = resolveMaskPointFromClient(
          workflowMode,
          event.clientX,
          event.clientY,
        );
        if (point) {
          if (pendingInteraction.toolId === "magicWand") {
            handleApplyMagicWand(point, pendingInteraction.negativeMode);
          } else {
            void handleApplyPrompt(
              pendingInteraction.negativeMode ? "negative" : "positive",
              point.xNorm,
              point.yNorm,
            );
          }
        }
      }
    },
    [
      clearStagePointer,
      endBrushStroke,
      endLassoStroke,
      handleApplyMagicWand,
      handleApplyPrompt,
      resolveMaskPointFromClient,
      workflowMode,
    ],
  );

  const handleStagePointerCancel = useCallback(() => {
    endBrushStroke();
    endLassoStroke();
    clearStagePointer();
  }, [clearStagePointer, endBrushStroke, endLassoStroke]);

  const handleRefineSliderChange = useCallback(
    (
      key:
        | "selectionTolerance"
        | "brushSize"
        | "brushSoftness"
        | "quickSelectEdgeAwareness"
        | "edgeSoftness"
        | "edgePull",
      value: number,
    ) => {
      const lane = getLaneState(workflowMode);
      lane[key] = value;
      lane.previewReady = false;
      syncLaneVisuals(workflowMode);
    },
    [getLaneState, syncLaneVisuals, workflowMode],
  );

  const activeBoundaryVisible = hasVisibleBoundary(activeLane.boundary);
  const maskPreviewVisible =
    activeLane.showMaskPreview &&
    hasMaskSelection(activeLane.resolvedMask ?? activeLane.baseMask);
  const activeHistoryLength = activeLane.history.length;
  const canUndo = activeLane.historyIndex > 0;
  const canRedo = activeLane.historyIndex + 1 < activeHistoryLength;
  const activeToolDefinition = resolveExplorerImageCutoutStageToolDefinition(
    activeLane.activeStageTool,
  );
  const activeToolGroupDefinition = resolveExplorerImageCutoutToolGroupForTool(
    activeLane.activeStageTool,
  );
  const activeLassoPoints =
    activeLassoStrokeRef.current?.workflowMode === workflowMode
      ? activeLassoStrokeRef.current.points
      : [];
  const stageCursor = activeLane.isMutating
    ? "progress"
    : activeLane.activeStageTool === "quickSelect" ||
        activeLane.activeStageTool === "brush" ||
        activeLane.activeStageTool === "erase" ||
        activeLane.activeStageTool === "lasso"
      ? "crosshair"
      : activeLane.activeStageTool === "aiSelect" ||
          activeLane.activeStageTool === "magicWand"
        ? "cell"
        : "grab";
  const zoomPercent = Math.round(activeLane.transform.scale * 100);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      data-testid="explorer-image-cutout-surface"
      data-explorer-preview-keyboard-owner="image-cutout"
      onPointerDown={() => focusSurface()}
      style={surfaceRootStyle()}
    >
      <div
        style={{
          position: "absolute",
          inset: 12,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        {activeLane.showToolPalette ? (
          <div
            data-testid="explorer-image-cutout-tool-rail"
            style={{
              ...toolRailStyle(),
              pointerEvents: "auto",
            }}
          >
            {explorerImageCutoutToolGroupDefinitions.map((groupDefinition, index) => {
              const groupTools = groupDefinition.toolIds.map((toolId) =>
                resolveExplorerImageCutoutStageToolDefinition(toolId),
              );
              const activeGroupTool =
                groupTools.find((toolDefinition) => toolDefinition.id === activeLane.activeStageTool) ??
                groupTools[0];
              const flyoutOpen = activeLane.openToolGroupId === groupDefinition.id;
              const hasToolOptions = groupTools.length > 1;
              return (
                <div
                  key={groupDefinition.id}
                  data-testid={`explorer-image-cutout-tool-group-${groupDefinition.id}`}
                  style={toolGroupShellStyle()}
                >
                  <ExplorerIsolationButton
                    ariaLabel={activeGroupTool?.ariaLabel ?? groupDefinition.ariaLabel}
                    title={activeGroupTool?.description ?? groupDefinition.description}
                    active={activeLane.activeStageTool === activeGroupTool?.id}
                    variant="action"
                    disabled={activeLane.isBooting || activeLane.isMutating}
                    motionStepIndex={index}
                    styleOverride={toolRailButtonStyle()}
                    onClick={() => {
                      if (activeGroupTool) {
                        handleSelectStageTool(activeGroupTool.id);
                      }
                    }}
                    onContextMenu={(event) => {
                      if (!hasToolOptions) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      handleToggleToolGroup(groupDefinition.id);
                    }}
                  >
                    {activeGroupTool
                      ? renderCutoutToolIcon(activeGroupTool.iconName)
                      : null}
                    {hasToolOptions ? (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          right: 3,
                          bottom: 3,
                          width: 0,
                          height: 0,
                          borderLeft: "4px solid transparent",
                          borderTop: "4px solid var(--overlay-text-muted)",
                        }}
                      />
                    ) : null}
                  </ExplorerIsolationButton>

                  {hasToolOptions ? (
                    <ExplorerIsolationButton
                      ariaLabel={`Open ${groupDefinition.label} menu`}
                      title={`Open ${groupDefinition.label} menu`}
                      active={flyoutOpen}
                      variant="action"
                      disabled={activeLane.isBooting || activeLane.isMutating}
                      motionStepIndex={index}
                      styleOverride={toolGroupMenuButtonStyle(flyoutOpen)}
                      onClick={() => handleToggleToolGroup(groupDefinition.id)}
                    >
                      <ChevronRight
                        size={10}
                        style={{
                          transform: flyoutOpen ? "rotate(90deg)" : "none",
                          transition: "transform 120ms ease",
                        }}
                      />
                    </ExplorerIsolationButton>
                  ) : null}

                  {flyoutOpen ? (
                    <div
                      data-testid={`explorer-image-cutout-tool-flyout-${groupDefinition.id}`}
                      style={toolGroupFlyoutStyle()}
                    >
                      {groupTools.map((toolDefinition, toolIndex) => (
                        <ExplorerIsolationButton
                          key={toolDefinition.id}
                          ariaLabel={toolDefinition.ariaLabel}
                          title={toolDefinition.description}
                          active={activeLane.activeStageTool === toolDefinition.id}
                          variant="action"
                          disabled={activeLane.isBooting || activeLane.isMutating}
                          motionStepIndex={toolIndex}
                          styleOverride={toolFlyoutButtonStyle()}
                          onClick={() => handleSelectStageTool(toolDefinition.id)}
                        >
                          {renderCutoutToolIcon(toolDefinition.iconName)}
                          <span>{toolDefinition.label}</span>
                        </ExplorerIsolationButton>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div style={toolRailDividerStyle()} />

            <ExplorerIsolationButton
              ariaLabel="Auto Remove BG"
              title="Run automatic background removal and merge it into Cutout"
              variant="action"
              disabled={activeLane.isBooting || activeLane.isMutating}
              motionStepIndex={explorerImageCutoutToolGroupDefinitions.length}
              styleOverride={toolRailButtonStyle()}
              onClick={() => {
                void handleAutoRemoveBackground();
              }}
            >
              <Sparkles size={15} />
            </ExplorerIsolationButton>
          </div>
        ) : (
          <div />
        )}

        <div
          style={{
            ...floatingPanelStyle(),
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
            pointerEvents: "auto",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <ExplorerIsolationButton
            ariaLabel="Undo"
            title="Undo"
            variant="action"
            disabled={!canUndo || activeLane.isMutating}
            motionStepIndex={0}
            onClick={handleUndo}
          >
            <Undo2 size={15} />
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Redo"
            title="Redo"
            variant="action"
            disabled={!canRedo || activeLane.isMutating}
            motionStepIndex={1}
            onClick={handleRedo}
          >
            <Undo2 size={15} style={{ transform: "scaleX(-1)" }} />
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Reset isolation lane"
            title="Reset isolation lane"
            variant="action"
            disabled={activeLane.isBooting || activeLane.isMutating}
            motionStepIndex={2}
            onClick={() => {
              void handleResetLane(workflowMode);
            }}
          >
            <RefreshCw size={15} />
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Toggle mask preview"
            title={
              activeLane.showMaskPreview
                ? "Disable mask preview"
                : "Enable mask preview"
            }
            active={activeLane.showMaskPreview}
            variant="action"
            disabled={activeLane.isBooting || activeLane.isMutating}
            motionStepIndex={3}
            onClick={handleMaskPreviewToggle}
          >
            {activeLane.showMaskPreview ? <Image size={15} /> : <Eye size={15} />}
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Toggle tool rail"
            title="Toggle tool rail"
            active={activeLane.showToolPalette}
            variant="action"
            disabled={activeLane.isBooting || activeLane.isMutating}
            motionStepIndex={4}
            onClick={handleToolPaletteToggle}
          >
            <Palette size={15} />
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Toggle refine controls"
            title="Toggle refine controls"
            active={activeLane.showRefinePanel}
            variant="action"
            disabled={activeLane.isBooting || activeLane.isMutating}
            motionStepIndex={5}
            onClick={handleRefineToggle}
          >
            <Sliders size={15} />
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Save sibling PNG"
            title="Save sibling PNG"
            variant="action"
            disabled={!activeLane.sessionSnapshot || activeLane.isMutating}
            motionStepIndex={6}
            onClick={() => {
              void handleSaveSibling();
            }}
          >
            <Save size={15} />
          </ExplorerIsolationButton>

          <ExplorerIsolationButton
            ariaLabel="Copy cutout to clipboard"
            title="Copy cutout to clipboard"
            variant="action"
            disabled={!activeLane.sessionSnapshot || activeLane.isMutating}
            motionStepIndex={7}
            onClick={() => {
              void handleCopyToClipboard();
            }}
          >
            <Copy size={15} />
          </ExplorerIsolationButton>
        </div>
      </div>

      <div
        ref={stageViewportRef}
        data-testid="explorer-image-cutout-stage"
        onWheel={handleWheel}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerCancel}
        onLostPointerCapture={handleStagePointerCancel}
        onContextMenu={(event) => event.preventDefault()}
        style={stageViewportStyle(stageCursor)}
      >
        <div
          ref={stageContentRef}
          data-testid="explorer-image-cutout-stage-content"
          style={stageContentStyle(activeLane.transform)}
        >
          <canvas
            ref={previewCanvasRef}
            aria-hidden
            data-testid="explorer-image-cutout-preview-canvas"
            data-preview-mode={maskPreviewVisible ? "mask" : "source"}
            style={previewCanvasStyle(filterCss)}
          />
          <canvas
            ref={marchingAntsCanvasRef}
            aria-hidden
            data-testid="explorer-image-cutout-marching-ants"
            data-has-boundary={activeBoundaryVisible ? "true" : "false"}
            style={marchingAntsCanvasStyle(activeBoundaryVisible)}
          />
          <svg
            aria-hidden
            data-testid="explorer-image-cutout-lasso-overlay"
            viewBox={
              activeLane.baseMask
                ? `0 0 ${activeLane.baseMask.width} ${activeLane.baseMask.height}`
                : "0 0 1 1"
            }
            style={lassoOverlayStyle(activeLassoPoints.length > 1)}
          >
            {activeLassoPoints.length > 1 ? (
              <polygon
                points={activeLassoPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="color-mix(in srgb, var(--overlay-accent) 16%, transparent)"
                stroke="var(--overlay-accent)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderRadius: 999,
          border: "1px solid var(--overlay-explorer-preview-border)",
          background:
            "color-mix(in srgb, var(--overlay-explorer-preview-bg) 86%, black 14%)",
          color: "var(--overlay-text-muted)",
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          boxShadow: "0 14px 30px rgba(0,0,0,0.26)",
          zIndex: 2,
        }}
      >
        <span data-testid="explorer-image-cutout-zoom">{zoomPercent}%</span>
        <span>{activeToolGroupDefinition.label}</span>
        <span>{activeToolDefinition.label}</span>
        <span>{maskPreviewVisible ? "Mask Preview" : "Image View"}</span>
        <span>
          {activeLane.isBooting
            ? "Preparing"
            : activeBoundaryVisible
              ? `${activeLaneDefinition.label} ready`
              : "Awaiting mask"}
        </span>
        <span>{activeLane.sessionSnapshot ? `${activeLane.sessionSnapshot.previewWidth}×${activeLane.sessionSnapshot.previewHeight}` : "—"}</span>
      </div>

      {activeLane.showRefinePanel ? (
        <div
          style={{
            position: "absolute",
            inset: "auto 12px 12px auto",
            zIndex: 2,
            maxWidth: "min(560px, calc(100% - 24px))",
          }}
        >
          <div
            data-testid="explorer-image-cutout-refine-panel"
            style={{
              ...floatingPanelStyle(),
              display: "grid",
              gap: 12,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span
                style={{
                  color: "var(--overlay-text-primary)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                }}
              >
                {activeToolDefinition.label} Settings
              </span>
              <span
                style={{
                  color: "var(--overlay-text-muted)",
                  fontSize: 11,
                }}
              >
                Edge finish and brush response
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {activeToolDefinition.usesBrushSize ? (
                <CutoutSliderField
                  label="Brush Size"
                  value={activeLane.brushSize}
                  min={4}
                  max={96}
                  step={1}
                  onChange={(value) => handleRefineSliderChange("brushSize", value)}
                  helper="Larger strokes cover more nearby pixels per pass."
                />
              ) : null}
              {activeToolDefinition.usesTolerance ? (
                <CutoutSliderField
                  label="Tolerance"
                  value={activeLane.selectionTolerance}
                  min={4}
                  max={100}
                  step={1}
                  onChange={(value) =>
                    handleRefineSliderChange("selectionTolerance", value)
                  }
                  helper="Higher tolerance accepts a wider perceptual color range around the sampled pixels."
                />
              ) : null}
              {activeToolDefinition.usesBrushSoftness ? (
                <CutoutSliderField
                  label="Brush Softness"
                  value={activeLane.brushSoftness}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(value) =>
                    handleRefineSliderChange("brushSoftness", value)
                  }
                  helper="Softer falloff feathers the stroke instead of carving a hard edge."
                />
              ) : null}
              {activeToolDefinition.usesEdgeAwareness ? (
                <CutoutSliderField
                  label="Edge Awareness"
                  value={activeLane.quickSelectEdgeAwareness}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(value) =>
                    handleRefineSliderChange("quickSelectEdgeAwareness", value)
                  }
                  helper="Higher edge awareness resists crossing strong contrast boundaries while the brush grows."
                />
              ) : null}
              {activeToolDefinition.usesContiguous ? (
                <CutoutToggleField
                  label="Contiguous"
                  value={activeLane.magicWandContiguous}
                  onLabel="On"
                  offLabel="Off"
                  onChange={(value) => {
                    const lane = getLaneState(workflowMode);
                    lane.magicWandContiguous = value;
                    invalidateActiveLane();
                  }}
                  helper="Contiguous keeps the wand on the clicked color island. Turn it off to target matching colors across the full preview."
                />
              ) : null}
              <CutoutSliderField
                label="Edge Softness"
                value={activeLane.edgeSoftness}
                min={0}
                max={18}
                step={1}
                onChange={(value) =>
                  handleRefineSliderChange("edgeSoftness", value)
                }
                helper="Smooth the resolved edge without changing the core selection."
              />
              <CutoutSliderField
                label="Edge Pull"
                value={activeLane.edgePull}
                min={-24}
                max={24}
                step={1}
                onChange={(value) => handleRefineSliderChange("edgePull", value)}
                helper="Push the visible edge inward or outward after mask smoothing."
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
