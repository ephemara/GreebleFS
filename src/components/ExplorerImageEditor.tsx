import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

import {
  ArrowUpLeft,
  ArrowUpRight,
  Check,
  Crop,
  ImageIcon,
  RotateCcw,
  Save,
  X,
} from "@/components/AppIcons";
import { writeFile } from "@tauri-apps/plugin-fs";

import { getImageEditorContentType } from "../config/filePreview";
import { matchesKeybinding } from "../config/hotkeys";
import {
  type LocalModelBackendPreference,
} from "../config/localModels";
import {
  buildCSSFilterString,
  createDefaultImageFiltersState,
  imageEditorFilterDefinitions,
  type ExplorerImageFiltersState,
} from "../config/imageEditorFilters";
import { writeExplorerFile } from "../runtime/explorerBackend";
import type { ManagedPythonRuntimeConfig } from "../runtime/pythonRuntimeBackend";
import { useSettingsStore } from "../store/settingsStore";
import { ExplorerImageCutoutSurface } from "./ExplorerImageCutoutSurface";
import type { ExplorerPreviewWildcardWorkflowTab } from "./explorer/explorerPreviewWorkflowTabs";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { PremiumSlider as PremiumSliderControl } from "./PremiumSlider";

type ExplorerImageEditorProps = {
  imagePath: string;
  logicalImagePath?: string;
  imageName: string;
  imageSource: string;
  mode?: "preview" | "edit";
  workflowTabId?: string | null;
  pythonRuntimeConfig?: ManagedPythonRuntimeConfig | null;
  cutoutModelId?: string | null;
  cutoutBackendPreference?: LocalModelBackendPreference | null;
  onRegisterWorkflowTabs?: (
    tabs: ExplorerPreviewWildcardWorkflowTab[] | null,
  ) => void;
  onSaved?: () => Promise<void> | void;
};

export interface ExplorerImageEditorRef {
  save: () => Promise<boolean>;
  hasUnsavedChanges: () => boolean;
  resetToSavedState: () => Promise<void>;
}

type ImageEditorSaveState = "idle" | "saving" | "dirty" | "saved" | "error";

type ImagePreviewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_IMAGE_PREVIEW_TRANSFORM: ImagePreviewTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const IMAGE_PREVIEW_MIN_SCALE = 0.5;
const IMAGE_PREVIEW_MAX_SCALE = 6;
const IMAGE_PREVIEW_ZOOM_SENSITIVITY = 0.0015;
const IMAGE_CUTOUT_WORKFLOW_TABS = [
  { id: "cutout", label: "Cutout", baseMode: "edit" },
] as const satisfies readonly ExplorerPreviewWildcardWorkflowTab[];

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeImagePreviewTransform(
  transform: ImagePreviewTransform,
  viewport: HTMLDivElement | null,
  image: HTMLImageElement | null,
): ImagePreviewTransform {
  const nextScale = Number(
    clampValue(
      transform.scale,
      IMAGE_PREVIEW_MIN_SCALE,
      IMAGE_PREVIEW_MAX_SCALE,
    ).toFixed(2),
  );

  if (!viewport || !image) {
    return {
      scale: nextScale,
      offsetX: Number(transform.offsetX.toFixed(2)),
      offsetY: Number(transform.offsetY.toFixed(2)),
    };
  }

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const baseWidth = image.clientWidth;
  const baseHeight = image.clientHeight;

  if (
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    baseWidth <= 0 ||
    baseHeight <= 0
  ) {
    return {
      scale: nextScale,
      offsetX: Number(transform.offsetX.toFixed(2)),
      offsetY: Number(transform.offsetY.toFixed(2)),
    };
  }

  const scaledWidth = baseWidth * nextScale;
  const scaledHeight = baseHeight * nextScale;
  const maxOffsetX = Math.max(0, (scaledWidth - viewportWidth) / 2);
  const maxOffsetY = Math.max(0, (scaledHeight - viewportHeight) / 2);

  return {
    scale: nextScale,
    offsetX: Number(
      clampValue(transform.offsetX, -maxOffsetX, maxOffsetX).toFixed(2),
    ),
    offsetY: Number(
      clampValue(transform.offsetY, -maxOffsetY, maxOffsetY).toFixed(2),
    ),
  };
}

function getImageExtension(name: string): string {
  return name.trim().split(".").pop()?.toLowerCase() ?? "";
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) ||
    Boolean(element.closest(".monaco-editor"))
  );
}

function buttonStyle(
  variant: "primary" | "default" | "danger" | "ghost" = "default",
) {
  const base = {
    appearance: "none" as const,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 120ms ease",
    border: "1px solid transparent",
  };

  switch (variant) {
    case "primary":
      return {
        ...base,
        background: "rgba(59, 130, 246, 0.9)",
        borderColor: "rgba(59, 130, 246, 1)",
        color: "#fff",
        boxShadow: "0 2px 8px rgba(59, 130, 246, 0.25)",
      };
    case "danger":
      return {
        ...base,
        background: "rgba(239, 68, 68, 0.15)",
        borderColor: "rgba(239, 68, 68, 0.3)",
        color: "#fca5a5",
      };
    case "ghost":
      return {
        ...base,
        background: "transparent",
        borderColor: "transparent",
        color: "var(--overlay-text-muted)",
      };
    case "default":
    default:
      return {
        ...base,
        background: "rgba(255, 255, 255, 0.06)",
        borderColor: "rgba(255, 255, 255, 0.12)",
        color: "var(--overlay-text-primary)",
      };
  }
}

function cloneImageFiltersState(
  state: ExplorerImageFiltersState,
): ExplorerImageFiltersState {
  return imageEditorFilterDefinitions.reduce((result, definition) => {
    result[definition.key] = state[definition.key];
    return result;
  }, {} as ExplorerImageFiltersState);
}

function areImageFiltersEqual(
  left: ExplorerImageFiltersState,
  right: ExplorerImageFiltersState,
): boolean {
  return imageEditorFilterDefinitions.every(
    (definition) => left[definition.key] === right[definition.key],
  );
}

async function loadPreviewImage(source: string): Promise<HTMLImageElement> {
  const image = new window.Image();
  return await new Promise((resolve, reject) => {
    image.onload = () => resolve(image as HTMLImageElement);
    image.onerror = () =>
      reject(new Error("Failed to parse image for editing."));
    image.src = source;
  });
}

function ImageFilterSlider({
  def,
  value,
  onChange,
}: {
  def: import("../config/imageEditorFilters").ImageEditorFilterDefinition;
  value: number;
  onChange: (value: number) => void;
}) {
  const isDefault = value === def.default;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          fontWeight: 600,
          color: isDefault ? "var(--overlay-text-muted)" : "#f8fafc",
          transition: "color 0.2s ease",
        }}
      >
        <label style={{ letterSpacing: "0.02em" }}>{def.label}</label>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {value}
          {def.unit}
        </span>
      </div>
      <div
        style={{ padding: "6px 0", display: "flex", alignItems: "center" }}
      >
        <PremiumSliderControl
          ariaLabel={def.label}
          ariaValueText={`${value}${def.unit}`}
          min={def.min}
          max={def.max}
          step={def.step}
          value={value}
          density="compact"
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export const ExplorerImageEditor = forwardRef<
  ExplorerImageEditorRef,
  ExplorerImageEditorProps
>(function ExplorerImageEditor(
  {
    imagePath,
    logicalImagePath,
    imageName,
    imageSource,
    mode = "edit",
    workflowTabId = null,
    pythonRuntimeConfig = null,
    cutoutModelId = null,
    cutoutBackendPreference = "auto",
    onRegisterWorkflowTabs,
    onSaved,
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const cropperImageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const savedImageSourceRef = useRef<string | null>(null);
  const savedFiltersRef = useRef<ExplorerImageFiltersState>(
    createDefaultImageFiltersState(),
  );
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const blobUrlsRef = useRef<Set<string>>(new Set());
  const savedStatusTimeoutRef = useRef<number | null>(null);

  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [filters, setFilters] = useState<ExplorerImageFiltersState>(
    createDefaultImageFiltersState(),
  );
  const [previewTransform, setPreviewTransform] =
    useState<ImagePreviewTransform>(DEFAULT_IMAGE_PREVIEW_TRANSFORM);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [saveState, setSaveState] = useState<ImageEditorSaveState>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const contentType = getImageEditorContentType(getImageExtension(imageName));
  const isEditableFormat = contentType !== null;
  const isCutoutMode = workflowTabId === "cutout" && isEditableFormat;
  const showEditingChrome = mode === "edit" && isEditableFormat && !isCutoutMode;
  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  useEffect(() => {
    if (!onRegisterWorkflowTabs) {
      return;
    }

    onRegisterWorkflowTabs(
      isEditableFormat ? [...IMAGE_CUTOUT_WORKFLOW_TABS] : null,
    );

    return () => {
      onRegisterWorkflowTabs(null);
    };
  }, [isEditableFormat, onRegisterWorkflowTabs]);

  const clearSavedStatusTimeout = useCallback(() => {
    if (savedStatusTimeoutRef.current == null) {
      return;
    }

    window.clearTimeout(savedStatusTimeoutRef.current);
    savedStatusTimeoutRef.current = null;
  }, []);

  const revokeTrackedBlobUrl = useCallback((value: string | null) => {
    if (!value || !value.startsWith("blob:")) {
      return;
    }

    if (blobUrlsRef.current.delete(value)) {
      URL.revokeObjectURL(value);
    }
  }, []);

  const registerTrackedBlobUrl = useCallback((value: string): string => {
    if (value.startsWith("blob:")) {
      blobUrlsRef.current.add(value);
    }
    return value;
  }, []);

  const clearCropperInstance = useCallback(() => {
    cropperRef.current?.destroy();
    cropperRef.current = null;
  }, []);

  const resetPreviewViewport = useCallback(() => {
    setPreviewTransform(DEFAULT_IMAGE_PREVIEW_TRANSFORM);
    setIsPreviewDragging(false);
  }, []);

  const restoreSavedState = useCallback(async (): Promise<void> => {
    const savedImageSource = savedImageSourceRef.current;
    if (!savedImageSource) {
      return;
    }

    clearSavedStatusTimeout();
    clearCropperInstance();
    setIsCropping(false);
    setStatusMessage("Restoring saved image…");

    try {
      const restoredImage = await loadPreviewImage(savedImageSource);
      if (!mountedRef.current) {
        return;
      }

      setBaseImage(restoredImage);
      setFilters(cloneImageFiltersState(savedFiltersRef.current));
      resetPreviewViewport();
      dirtyRef.current = false;
      setSaveState("idle");
      setStatusMessage("");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSaveState("error");
      setStatusMessage(String(error));
    }
  }, [clearCropperInstance, clearSavedStatusTimeout, resetPreviewViewport]);

  const handleReset = useCallback(() => {
    void restoreSavedState();
  }, [restoreSavedState]);

  const saveImage = useCallback(async (): Promise<boolean> => {
    if (
      !showEditingChrome ||
      !contentType ||
      saveState === "saving" ||
      !baseImage
    ) {
      return false;
    }

    if (!dirtyRef.current) {
      return true;
    }

    clearSavedStatusTimeout();
    setSaveState("saving");
    setStatusMessage("Saving to disk...");

    try {
      const offscreen = document.createElement("canvas");
      offscreen.width = baseImage.width;
      offscreen.height = baseImage.height;

      const context = offscreen.getContext("2d");
      if (!context) {
        throw new Error("Could not create offscreen context");
      }

      context.filter = buildCSSFilterString(filters);
      context.drawImage(baseImage, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => {
        offscreen.toBlob((value) => resolve(value), contentType, 0.95);
      });

      if (!blob) {
        throw new Error("Failed to generate image blob");
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      if (imagePath.startsWith("cloud://")) {
        await writeExplorerFile(imagePath, Array.from(uint8Array));
      } else {
        try {
          await writeFile(imagePath, uint8Array);
        } catch {
          await writeExplorerFile(imagePath, Array.from(uint8Array));
        }
      }

      const nextSource = registerTrackedBlobUrl(URL.createObjectURL(blob));
      const nextImage = await loadPreviewImage(nextSource);
      if (!mountedRef.current) {
        return true;
      }

      revokeTrackedBlobUrl(savedImageSourceRef.current);
      savedImageSourceRef.current = nextSource;
      savedFiltersRef.current = createDefaultImageFiltersState();
      dirtyRef.current = false;

      setBaseImage(nextImage);
      setFilters(createDefaultImageFiltersState());
      resetPreviewViewport();
      setSaveState("saved");
      setStatusMessage("Saved successfully");

      savedStatusTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current || dirtyRef.current) {
          return;
        }
        setSaveState("idle");
        setStatusMessage("");
      }, 3000);

      await onSaved?.();
      return true;
    } catch (error) {
      if (!mountedRef.current) {
        return false;
      }

      setSaveState("error");
      setStatusMessage(String(error));
      return false;
    }
  }, [
    baseImage,
    clearSavedStatusTimeout,
    contentType,
    filters,
    imagePath,
    onSaved,
    registerTrackedBlobUrl,
    resetPreviewViewport,
    revokeTrackedBlobUrl,
    saveState,
    showEditingChrome,
  ]);

  const startCropping = useCallback(() => {
    if (!showEditingChrome || !baseImage || isCropping) {
      return;
    }

    clearSavedStatusTimeout();
    setIsCropping(true);

    window.setTimeout(() => {
      const target = cropperImageRef.current;
      if (!target || !mountedRef.current) {
        return;
      }

      target.src = baseImage.src;
      target.style.filter = buildCSSFilterString(filters);

      cropperRef.current = new Cropper(target, {
        viewMode: 2,
        background: false,
        autoCropArea: 0.9,
        responsive: true,
        restore: false,
      });
    }, 0);
  }, [
    baseImage,
    clearSavedStatusTimeout,
    filters,
    isCropping,
    showEditingChrome,
  ]);

  const cancelCropping = useCallback(() => {
    clearCropperInstance();
    setIsCropping(false);
  }, [clearCropperInstance]);

  const applyCropping = useCallback(async () => {
    if (!cropperRef.current) {
      return;
    }

    const croppedCanvas = cropperRef.current.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    const nextSource = croppedCanvas.toDataURL(contentType ?? "image/png");

    try {
      const nextImage = await loadPreviewImage(nextSource);
      if (!mountedRef.current) {
        return;
      }

      setBaseImage(nextImage);
      resetPreviewViewport();
      clearCropperInstance();
      setIsCropping(false);
      dirtyRef.current = true;
      setSaveState("dirty");
      setStatusMessage("Unsaved crop changes");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSaveState("error");
      setStatusMessage(String(error));
    }
  }, [clearCropperInstance, contentType, resetPreviewViewport]);

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!baseImage || isCropping) {
        return;
      }

      const viewport = previewViewportRef.current;
      if (!viewport) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const zoomFactor = Math.exp(
        -event.deltaY * IMAGE_PREVIEW_ZOOM_SENSITIVITY,
      );
      const viewportRect = viewport.getBoundingClientRect();
      const focusX = event.clientX - viewportRect.left - viewportRect.width / 2;
      const focusY = event.clientY - viewportRect.top - viewportRect.height / 2;

      setPreviewTransform((current) => {
        const nextScale = Number(
          clampValue(
            current.scale * zoomFactor,
            IMAGE_PREVIEW_MIN_SCALE,
            IMAGE_PREVIEW_MAX_SCALE,
          ).toFixed(2),
        );
        if (nextScale === current.scale) {
          return current;
        }

        const scaleRatio = nextScale / current.scale;
        return normalizeImagePreviewTransform(
          {
            scale: nextScale,
            offsetX:
              current.offsetX * scaleRatio + (1 - scaleRatio) * focusX,
            offsetY:
              current.offsetY * scaleRatio + (1 - scaleRatio) * focusY,
          },
          viewport,
          previewImageRef.current,
        );
      });
    },
    [baseImage, isCropping],
  );

  const handlePreviewMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!baseImage || isCropping || event.button !== 0) {
        return;
      }

      const viewport = previewViewportRef.current;
      if (!viewport) {
        return;
      }

      event.preventDefault();

      const startTransform = previewTransform;
      const startClientX = event.clientX;
      const startClientY = event.clientY;

      setIsPreviewDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setPreviewTransform(
          normalizeImagePreviewTransform(
            {
              scale: startTransform.scale,
              offsetX: startTransform.offsetX + (moveEvent.clientX - startClientX),
              offsetY: startTransform.offsetY + (moveEvent.clientY - startClientY),
            },
            viewport,
            previewImageRef.current,
          ),
        );
      };

      const stopDragging = () => {
        setIsPreviewDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", stopDragging);
        window.removeEventListener("blur", stopDragging);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", stopDragging);
      window.addEventListener("blur", stopDragging);
    },
    [baseImage, isCropping, previewTransform],
  );

  useImperativeHandle(
    forwardedRef,
    () => ({
      save: saveImage,
      hasUnsavedChanges: () => dirtyRef.current,
      resetToSavedState: restoreSavedState,
    }),
    [restoreSavedState, saveImage],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSavedStatusTimeout();
      clearCropperInstance();

      for (const value of blobUrlsRef.current) {
        URL.revokeObjectURL(value);
      }
      blobUrlsRef.current.clear();
    };
  }, [clearCropperInstance, clearSavedStatusTimeout]);

  useEffect(() => {
    if (!isEditableFormat) {
      dirtyRef.current = false;
      return;
    }

    let cancelled = false;
    const defaultFilters = createDefaultImageFiltersState();

    clearSavedStatusTimeout();
    clearCropperInstance();
    revokeTrackedBlobUrl(savedImageSourceRef.current);
    savedImageSourceRef.current = imageSource;
    savedFiltersRef.current = cloneImageFiltersState(defaultFilters);
    dirtyRef.current = false;

    setBaseImage(null);
    setFilters(defaultFilters);
    resetPreviewViewport();
    setIsCropping(false);
    setSaveState("idle");
    setStatusMessage("");

    void loadPreviewImage(imageSource)
      .then((image) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setBaseImage(image);
        resetPreviewViewport();
      })
      .catch((error) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        setSaveState("error");
        setStatusMessage(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [
    clearCropperInstance,
    clearSavedStatusTimeout,
    imagePath,
    imageSource,
    isEditableFormat,
    resetPreviewViewport,
    revokeTrackedBlobUrl,
  ]);

  useEffect(() => {
    if (!isEditableFormat) {
      return;
    }

    const nextDirty =
      Boolean(baseImage) &&
      ((baseImage?.src ?? null) !== savedImageSourceRef.current ||
        !areImageFiltersEqual(filters, savedFiltersRef.current));

    dirtyRef.current = nextDirty;

    if (saveState === "saving" || saveState === "error" || saveState === "saved") {
      return;
    }

    if (nextDirty) {
      if (saveState !== "dirty") {
        setSaveState("dirty");
        setStatusMessage("Unsaved changes");
      }
      return;
    }

    if (saveState === "dirty") {
      setSaveState("idle");
      setStatusMessage("");
    }
  }, [baseImage, filters, isEditableFormat, saveState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showEditingChrome) {
        return;
      }

      const root = rootRef.current;
      const activeElement = document.activeElement;
      const hasEditorFocus = Boolean(
        root && (root.contains(activeElement) || activeElement === document.body),
      );

      if (!hasEditorFocus || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (
        matchesKeybinding(event, keybindings.saveFile) &&
        !isCropping &&
        isEditableFormat
      ) {
        event.preventDefault();
        void saveImage();
      }

      if (matchesKeybinding(event, keybindings.imageEditorReset) && !isCropping) {
        event.preventDefault();
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleReset,
    isCropping,
    isEditableFormat,
    keybindings.imageEditorReset,
    keybindings.saveFile,
    saveImage,
    showEditingChrome,
  ]);

  useEffect(() => {
    if (!showEditingChrome && isCropping) {
      clearCropperInstance();
      setIsCropping(false);
    }
  }, [clearCropperInstance, isCropping, showEditingChrome]);

  const statusTone =
    saveState === "error"
      ? "#fca5a5"
      : saveState === "saving"
        ? "#93c5fd"
        : saveState === "dirty"
          ? "#fde047"
          : saveState === "saved"
            ? "#86efac"
            : "transparent";

  if (!isEditableFormat) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 50%), var(--overlay-explorer-preview-bg)",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--overlay-explorer-preview-border)",
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--overlay-text-primary)",
              }}
            >
              Static image preview
            </span>
            <span style={{ fontSize: 10, color: "var(--overlay-text-muted)" }}>
              Live editor is available for PNG, JPG, and WebP files.
            </span>
          </div>
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              color: "var(--overlay-text-muted)",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            {getImageExtension(imageName).toUpperCase() || "IMAGE"}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            boxSizing: "border-box",
          }}
        >
          <img
            src={imageSource}
            alt={imageName}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: "var(--overlay-explorer-control-radius)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          />
        </div>
      </div>
    );
  }

  if (isCutoutMode) {
    return (
      <ExplorerImageCutoutSurface
        imageName={imageName}
        imagePath={imagePath}
        logicalOutputPath={logicalImagePath ?? imagePath}
        sourceImageUrl={baseImage?.src ?? imageSource}
        filterState={filters}
        pythonRuntimeConfig={pythonRuntimeConfig}
        cutoutModelId={cutoutModelId}
        cutoutBackendPreference={cutoutBackendPreference}
      />
    );
  }

  const checkerboardCSS = `
    linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.02) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.02) 75%)
  `;

  return (
    <div
      ref={rootRef}
      data-testid="explorer-image-editor"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--overlay-explorer-preview-bg, #111827)",
      }}
    >
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          minHeight: showEditingChrome ? "40%" : "100%",
          borderBottom: showEditingChrome
            ? "1px solid var(--overlay-explorer-preview-border, rgba(255,255,255,0.1))"
            : "none",
          backgroundImage: checkerboardCSS,
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
      >
        {!isCropping && (
          <div
            ref={previewViewportRef}
            data-testid="explorer-image-editor-preview"
            onWheel={handlePreviewWheel}
            onMouseDown={handlePreviewMouseDown}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              userSelect: "none",
              cursor: baseImage
                ? isPreviewDragging
                  ? "grabbing"
                  : "grab"
                : "default",
            }}
          >
            {!baseImage && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  color: "var(--overlay-text-muted)",
                }}
              >
                <ImageIcon size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  Loading image...
                </span>
              </div>
            )}

            {baseImage && (
              <img
                ref={previewImageRef}
                data-testid="explorer-image-editor-preview-image"
                src={baseImage.src}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: 4,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  filter: buildCSSFilterString(filters),
                  transform: `translate(${previewTransform.offsetX}px, ${previewTransform.offsetY}px) scale(${previewTransform.scale})`,
                  transformOrigin: "center center",
                  willChange: "transform, filter",
                }}
                alt="Hardware Preview"
              />
            )}

            {baseImage && (
              <div
                data-testid="explorer-image-editor-preview-zoom"
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(10, 14, 24, 0.58)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)",
                  color: "var(--overlay-text-primary)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                  pointerEvents: "none",
                  backdropFilter: "blur(12px)",
                }}
              >
                <span style={{ opacity: 0.72 }}>Preview</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(previewTransform.scale * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: isCropping ? "flex" : "none",
            width: "100%",
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            ref={cropperImageRef}
            style={{ maxWidth: "100%", maxHeight: "100%" }}
            alt="cropper interface"
          />
        </div>
      </div>

      {showEditingChrome && (
        <div
          style={{
            width: "100%",
            maxHeight: "55%",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            background: "var(--overlay-explorer-preview-bg, #1f2937)",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom:
                "1px solid var(--overlay-explorer-preview-border, rgba(255,255,255,0.08))",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                disabled={isCropping || !baseImage}
                onClick={() => void saveImage()}
                style={{
                  ...buttonStyle("primary"),
                  opacity: isCropping || !baseImage ? 0.5 : 1,
                }}
              >
                <Save size={13} />
                Save
              </button>
              <button
                disabled={isCropping}
                onClick={handleReset}
                style={{
                  ...buttonStyle("default"),
                  opacity: isCropping ? 0.5 : 1,
                }}
              >
                <RotateCcw size={13} />
                Reset All
              </button>
              <button
                disabled={isCropping}
                onClick={startCropping}
                style={{
                  ...buttonStyle("default"),
                  opacity: isCropping ? 0.5 : 1,
                }}
              >
                <Crop size={13} />
                Crop Tool
              </button>
            </div>

            {statusMessage && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: statusTone,
                  padding: "4px 8px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 4,
                  border: `1px solid ${statusTone}40`,
                }}
              >
                {statusMessage}
              </div>
            )}
          </div>

          <OverlayScrollArea
            style={{ flex: 1, minHeight: 0 }}
            viewportStyle={{ padding: "16px" }}
            scrollbarStyle="themed"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: isCropping ? "none" : "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--overlay-text-muted)",
                    paddingBottom: 4,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Adjustments
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "16px 24px",
                  }}
                >
                  {imageEditorFilterDefinitions.map((definition) => (
                    <ImageFilterSlider
                      key={definition.key}
                      def={definition}
                      value={filters[definition.key]}
                      onChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          [definition.key]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: isCropping ? "flex" : "none",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--overlay-text-muted)",
                    paddingBottom: 4,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  Crop &amp; Rotate Tools
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => cropperRef.current?.setAspectRatio(Number.NaN)}
                    style={buttonStyle("default")}
                  >
                    Free
                  </button>
                  <button
                    onClick={() => cropperRef.current?.setAspectRatio(1)}
                    style={buttonStyle("default")}
                  >
                    1:1
                  </button>
                  <button
                    onClick={() => cropperRef.current?.setAspectRatio(4 / 3)}
                    style={buttonStyle("default")}
                  >
                    4:3
                  </button>
                  <button
                    onClick={() => cropperRef.current?.setAspectRatio(16 / 9)}
                    style={buttonStyle("default")}
                  >
                    16:9
                  </button>

                  <div
                    style={{
                      width: 1,
                      background: "rgba(255,255,255,0.1)",
                      margin: "0 8px",
                    }}
                  />

                  <button
                    onClick={() => cropperRef.current?.rotate(-90)}
                    style={buttonStyle("default")}
                  >
                    <ArrowUpLeft size={13} />
                    Left
                  </button>
                  <button
                    onClick={() => cropperRef.current?.rotate(90)}
                    style={buttonStyle("default")}
                  >
                    <ArrowUpRight size={13} />
                    Right
                  </button>
                </div>

                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button onClick={cancelCropping} style={buttonStyle("danger")}>
                    <X size={13} />
                    Cancel
                  </button>
                  <button onClick={() => void applyCropping()} style={buttonStyle("primary")}>
                    <Check size={13} />
                    Apply Crop
                  </button>
                </div>
              </div>
            </div>
          </OverlayScrollArea>
        </div>
      )}
    </div>
  );
});
