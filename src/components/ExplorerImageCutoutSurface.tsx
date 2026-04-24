import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Copy, Loader2, MousePointer2, Scissors, Undo2 } from "@/components/AppIcons";

import { matchesKeybinding } from "../config/hotkeys";
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
} from "../runtime/imageCutoutBackend";
import type { ManagedPythonRuntimeConfig } from "../runtime/pythonRuntimeBackend";
import { useSettingsStore } from "../store/settingsStore";

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

type CutoutPromptPoint = {
  xNorm: number;
  yNorm: number;
  kind: "positive" | "negative";
};

type CutoutBoundaryPoint = readonly [number, number];

const DEFAULT_PREVIEW_MAX_DIMENSION = 1280;
const MARCHING_ANTS_WIDTH = 4;
const MARCHING_ANTS_SPEED = 20;

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
    transition: "background 120ms ease, border-color 120ms ease, opacity 120ms ease",
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

async function convertBlobUrlToDataUrl(blobUrl: string): Promise<string> {
  const response = await fetch(blobUrl);
  if (!response.ok) {
    throw new Error(`Failed to read local blob URL (${response.status}).`);
  }
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to convert image blob to a data URL."));
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

async function computeMaskBoundaryPoints(
  dataUrl: string,
): Promise<{
  width: number;
  height: number;
  points: CutoutBoundaryPoint[];
}> {
  const image = new window.Image();
  const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode cutout mask preview."));
    image.src = dataUrl;
  });
  const width = loadedImage.naturalWidth || loadedImage.width || 1;
  const height = loadedImage.naturalHeight || loadedImage.height || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return { width, height, points: [] };
  }
  context.drawImage(loadedImage, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const points: CutoutBoundaryPoint[] = [];

  const alphaAt = (x: number, y: number): number =>
    data[(y * width + x) * 4 + 3] ?? 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = alphaAt(x, y);
      if (alpha < 12) {
        continue;
      }
      const left = x > 0 ? alphaAt(x - 1, y) : 0;
      const right = x + 1 < width ? alphaAt(x + 1, y) : 0;
      const top = y > 0 ? alphaAt(x, y - 1) : 0;
      const bottom = y + 1 < height ? alphaAt(x, y + 1) : 0;
      if (left < 12 || right < 12 || top < 12 || bottom < 12) {
        points.push([x, y]);
      }
    }
  }

  return { width, height, points };
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
  const marchingAntsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const boundaryRef = useRef<{
    width: number;
    height: number;
    points: CutoutBoundaryPoint[];
  } | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const promptHistoryRef = useRef<CutoutPromptPoint[][]>([[]]);
  const promptHistoryIndexRef = useRef(0);
  const keybindings = useSettingsStore((state) => state.settings.keybindings);

  const [sessionSnapshot, setSessionSnapshot] =
    useState<ExplorerImageCutoutSessionSnapshot | null>(null);
  const [promptHistory, setPromptHistory] = useState<CutoutPromptPoint[][]>([[]]);
  const [promptHistoryIndex, setPromptHistoryIndex] = useState(0);
  const [statusTone, setStatusTone] = useState<CutoutStatusTone>("neutral");
  const [statusMessage, setStatusMessage] = useState("Booting cutout session…");
  const [isBooting, setIsBooting] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const focusSurface = useCallback(() => {
    rootRef.current?.focus();
  }, []);

  useEffect(() => {
    promptHistoryRef.current = promptHistory;
  }, [promptHistory]);

  useEffect(() => {
    promptHistoryIndexRef.current = promptHistoryIndex;
  }, [promptHistoryIndex]);

  useEffect(() => {
    let cancelled = false;
    let staleSessionId: string | null = null;

    setIsBooting(true);
    setIsMutating(false);
    setStatusTone("neutral");
    setStatusMessage("Booting cutout session…");
    setSessionSnapshot(null);
    boundaryRef.current = null;
    setPromptHistory([[]]);
    setPromptHistoryIndex(0);

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

        sessionIdRef.current = snapshot.sessionId;
        setSessionSnapshot(snapshot);
        setStatusTone("success");
        setStatusMessage(
          snapshot.diagnostics.message?.trim() ||
            "Auto-selected a subject. Click to add, Alt-click to subtract.",
        );
        setIsBooting(false);
        focusSurface();
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSessionSnapshot(null);
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
    sourceImageUrl,
  ]);

  useEffect(() => {
    let cancelled = false;
    const snapshot = sessionSnapshot;
    if (!snapshot) {
      boundaryRef.current = null;
      return;
    }

    void computeMaskBoundaryPoints(snapshot.previewMask.dataUrl)
      .then((boundary) => {
        if (cancelled) {
          return;
        }
        boundaryRef.current = boundary;
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        boundaryRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [sessionSnapshot]);

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

  const restorePromptHistory = useCallback(
    async (nextIndex: number) => {
      const snapshot = sessionSnapshot;
      const sessionId = snapshot?.sessionId ?? sessionIdRef.current;
      if (!snapshot || !sessionId) {
        return;
      }
      const nextPromptSet = promptHistoryRef.current[nextIndex] ?? [];
      setIsMutating(true);
      setStatusTone("neutral");
      setStatusMessage(
        nextPromptSet.length === 0
          ? "Resetting to the auto-selected subject…"
          : "Rebuilding the prompt stack…",
      );

      try {
        let nextSnapshot = await resetExplorerImageCutoutSession(sessionId);
        if (nextPromptSet.length > 0) {
          nextSnapshot = await applyExplorerImageCutoutPrompts({
            sessionId,
            prompts: nextPromptSet.map((prompt) => ({
              xNorm: prompt.xNorm,
              yNorm: prompt.yNorm,
              kind: prompt.kind,
            })),
          });
        }
        setSessionSnapshot(nextSnapshot);
        setPromptHistoryIndex(nextIndex);
        setStatusTone("success");
        setStatusMessage(
          nextPromptSet.length === 0
            ? "Back to the initial auto mask."
            : `Restored ${nextPromptSet.length} prompt${nextPromptSet.length === 1 ? "" : "s"}.`,
        );
      } catch (error) {
        setStatusTone("error");
        setStatusMessage(String(error));
      } finally {
        setIsMutating(false);
      }
    },
    [sessionSnapshot],
  );

  const appendPrompt = useCallback(
    async (prompt: CutoutPromptPoint) => {
      const snapshot = sessionSnapshot;
      if (!snapshot) {
        return;
      }

      setIsMutating(true);
      setStatusTone("neutral");
      setStatusMessage(
        prompt.kind === "negative"
          ? "Subtracting that region from the matte…"
          : "Refining the subject matte…",
      );

      try {
        const nextSnapshot = await applyExplorerImageCutoutPrompts({
          sessionId: snapshot.sessionId,
          prompts: [
            {
              xNorm: prompt.xNorm,
              yNorm: prompt.yNorm,
              kind: prompt.kind,
            },
          ],
        });
        const currentPromptSet = promptHistoryRef.current[promptHistoryIndexRef.current] ?? [];
        const nextPromptSet = [...currentPromptSet, prompt];
        const nextHistory = [
          ...promptHistoryRef.current.slice(0, promptHistoryIndexRef.current + 1),
          nextPromptSet,
        ];
        setPromptHistory(nextHistory);
        setPromptHistoryIndex(nextHistory.length - 1);
        setSessionSnapshot(nextSnapshot);
        setStatusTone("success");
        setStatusMessage(
          prompt.kind === "negative"
            ? "Negative prompt applied."
            : "Positive prompt applied.",
        );
      } catch (error) {
        setStatusTone("error");
        setStatusMessage(String(error));
      } finally {
        setIsMutating(false);
      }
    },
    [sessionSnapshot],
  );

  const handleSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      focusSurface();
      if (!sessionSnapshot || isBooting || isMutating || event.button > 2) {
        return;
      }
      if (!frameRef.current) {
        return;
      }
      event.preventDefault();
      const rect = frameRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const xNorm = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const yNorm = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      void appendPrompt({
        xNorm,
        yNorm,
        kind: event.altKey || event.button === 2 ? "negative" : "positive",
      });
    },
    [appendPrompt, focusSurface, isBooting, isMutating, sessionSnapshot],
  );

  const exportFilters = useMemo(() => buildExportFilters(filterState), [filterState]);

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
      });
      setStatusTone("success");
      setStatusMessage(`Saved ${exportArtifact.fileName}.`);
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(String(error));
    } finally {
      setIsMutating(false);
    }
  }, [exportFilters, imagePath, logicalOutputPath, sessionSnapshot]);

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
      });
      setStatusTone("success");
      setStatusMessage("Cutout copied to the clipboard.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(String(error));
    } finally {
      setIsMutating(false);
    }
  }, [exportFilters, imagePath, logicalOutputPath, sessionSnapshot]);

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
  }, [exportFilters, imagePath, logicalOutputPath, sessionSnapshot]);

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
        if (promptHistoryIndexRef.current > 0) {
          void restorePromptHistory(promptHistoryIndexRef.current - 1);
        }
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorRedo)) {
        event.preventDefault();
        event.stopPropagation();
        if (promptHistoryIndexRef.current + 1 < promptHistoryRef.current.length) {
          void restorePromptHistory(promptHistoryIndexRef.current + 1);
        }
        return;
      }
      if (matchesKeybinding(event, keybindings.imageEditorReset)) {
        event.preventDefault();
        event.stopPropagation();
        void restorePromptHistory(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    handleCopyToClipboard,
    handleSaveSibling,
    keybindings.imageCutoutCopy,
    keybindings.imageEditorRedo,
    keybindings.imageEditorReset,
    keybindings.imageEditorUndo,
    keybindings.saveFile,
    restorePromptHistory,
  ]);

  const promptMarkers = promptHistory[promptHistoryIndex] ?? [];
  const filterCss = buildCSSFilterString(filterState);

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
                {sessionSnapshot.promptCount} prompt{sessionSnapshot.promptCount === 1 ? "" : "s"} ·{" "}
                {sessionSnapshot.diagnostics.backendKind} · {sessionSnapshot.previewWidth}×
                {sessionSnapshot.previewHeight}
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void restorePromptHistory(Math.max(0, promptHistoryIndex - 1))}
            disabled={isBooting || isMutating || promptHistoryIndex <= 0}
            style={{
              ...buttonStyle("ghost"),
              opacity: isBooting || isMutating || promptHistoryIndex <= 0 ? 0.5 : 1,
            }}
          >
            <Undo2 size={13} />
            Undo
          </button>
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              void handleNativeDrag();
            }}
            disabled={isBooting || isMutating || !sessionSnapshot}
            style={{
              ...buttonStyle("primary"),
              opacity: isBooting || isMutating || !sessionSnapshot ? 0.5 : 1,
            }}
          >
            <MousePointer2 size={13} />
            Drag Out
          </button>
          <button
            type="button"
            onClick={() => void handleCopyToClipboard()}
            disabled={isBooting || isMutating || !sessionSnapshot}
            style={{
              ...buttonStyle("default"),
              opacity: isBooting || isMutating || !sessionSnapshot ? 0.5 : 1,
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
          flexDirection: "column",
          gap: 10,
          padding: 12,
          backgroundImage:
            "linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.02) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.02) 75%)",
          backgroundSize: "18px 18px",
          backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 10,
            color: "var(--overlay-text-muted)",
          }}
        >
          <span>Click = add to subject</span>
          <span>Alt-click / right-click = subtract</span>
          <span>Ctrl+C = copy</span>
          <span>Ctrl+S = save sibling PNG</span>
        </div>

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
              <span style={{ fontSize: 12 }}>Building the initial subject matte…</span>
            </div>
          ) : sessionSnapshot ? (
            <div
              ref={frameRef}
              onPointerDown={handleSurfacePointerDown}
              onContextMenu={(event) => event.preventDefault()}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                maxWidth: "100%",
                maxHeight: "100%",
                cursor: isMutating ? "progress" : "crosshair",
                userSelect: "none",
              }}
            >
              <img
                src={sessionSnapshot.cutoutPreviewDataUrl}
                alt={`${imageName} cutout preview`}
                draggable={false}
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
              {promptMarkers.map((prompt, index) => (
                <div
                  key={`${prompt.kind}-${index}-${prompt.xNorm}-${prompt.yNorm}`}
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: `${prompt.xNorm * 100}%`,
                    top: `${prompt.yNorm * 100}%`,
                    width: 14,
                    height: 14,
                    marginLeft: -7,
                    marginTop: -7,
                    borderRadius: 999,
                    border:
                      prompt.kind === "negative"
                        ? "2px solid rgba(248, 113, 113, 0.9)"
                        : "2px solid rgba(96, 165, 250, 0.9)",
                    background:
                      prompt.kind === "negative"
                        ? "rgba(127, 29, 29, 0.44)"
                        : "rgba(30, 64, 175, 0.42)",
                    boxShadow: "0 0 0 2px rgba(15, 23, 42, 0.7)",
                    transform: "translateZ(0)",
                    pointerEvents: "none",
                  }}
                />
              ))}
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
  );
}
