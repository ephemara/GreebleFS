import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { File, Folder, Layers3 } from "@/components/AppIcons";
import {
  EXPLORER_DRAG_OVERLAY_MAX_STACK_DEPTH,
  EXPLORER_DRAG_OVERLAY_ROTATION_SPRING,
  EXPLORER_DRAG_OVERLAY_SPRING,
  EXPLORER_DRAG_OVERLAY_TILT_FACTOR,
  EXPLORER_DRAG_OVERLAY_MAX_TILT_DEGREES,
} from "../../config/explorerDragInteractions";
import { useExplorerDragInteractionSelector } from "./explorerDragAndDrop";

function getPathLeaf(path: string | null): string {
  if (!path) {
    return "Current Folder";
  }
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function getInvalidReasonLabel(reason: string | null): string {
  switch (reason) {
    case "self":
      return "Can't drop onto itself";
    case "descendant":
      return "Can't move into its own child";
    case "no-op":
      return "Already in this folder";
    default:
      return "Drop unavailable";
  }
}

function getOperationChipLabel(args: {
  valid: boolean;
  pending: boolean;
  invalidReason: string | null;
  operation: "copy" | "move";
}): string {
  if (args.pending) {
    return args.operation === "copy" ? "Copy" : "Move";
  }
  if (!args.valid) {
    return args.invalidReason === "no-op" ? "No change" : "Unavailable";
  }
  return args.operation === "copy" ? "Copy" : "Move";
}

function getOverlayScaleForPhase(phase: string): number {
  switch (phase) {
    case "lift":
      return 1.02;
    case "dragging-invalid":
      return 0.985;
    case "dropping":
      return 0.82;
    case "cancelled":
      return 0.92;
    default:
      return 1;
  }
}

function getOverlayOpacityForPhase(phase: string): number {
  switch (phase) {
    case "dropping":
    case "cancelled":
      return 0;
    default:
      return 1;
  }
}

function renderAvatarIcon(args: {
  iconSrc: string | null;
  itemKind: string;
  size: number;
  color: string;
}) {
  if (args.iconSrc) {
    return (
      <img
        src={args.iconSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: args.size,
          height: args.size,
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }

  const sharedProps = {
    size: args.size,
    style: {
      color: args.color,
    },
  };

  if (args.itemKind === "folder") {
    return <Folder {...sharedProps} />;
  }
  if (args.itemKind === "mixed") {
    return <Layers3 {...sharedProps} />;
  }
  return <File {...sharedProps} />;
}

export function ExplorerDragOverlay(): React.ReactElement | null {
  const state = useExplorerDragInteractionSelector((currentState) => currentState);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const pointerRotate = useMotionValue(0);
  const pointerScale = useMotionValue(1);
  const pointerOpacity = useMotionValue(1);
  const springX = useSpring(pointerX, EXPLORER_DRAG_OVERLAY_SPRING);
  const springY = useSpring(pointerY, EXPLORER_DRAG_OVERLAY_SPRING);
  const springRotate = useSpring(pointerRotate, EXPLORER_DRAG_OVERLAY_ROTATION_SPRING);
  const springScale = useSpring(pointerScale, EXPLORER_DRAG_OVERLAY_ROTATION_SPRING);
  const springOpacity = useSpring(pointerOpacity, EXPLORER_DRAG_OVERLAY_ROTATION_SPRING);
  const previousPointerRef = useRef<{ x: number; y: number } | null>(null);

  const displayPointer = useMemo(() => {
    if (state.phase === "dropping" && state.presentationTargetPoint) {
      return state.presentationTargetPoint;
    }
    return state.overlayPointer;
  }, [state.overlayPointer, state.phase, state.presentationTargetPoint]);

  useEffect(() => {
    if (!displayPointer) {
      return;
    }

    const previousPointer = previousPointerRef.current;
    pointerX.set(displayPointer.x);
    pointerY.set(displayPointer.y);
    pointerScale.set(getOverlayScaleForPhase(state.phase));
    pointerOpacity.set(getOverlayOpacityForPhase(state.phase));

    if (
      state.phase === "dropping" ||
      state.phase === "cancelled" ||
      !previousPointer
    ) {
      pointerRotate.set(0);
    } else {
      const deltaX = displayPointer.x - previousPointer.x;
      const tilt = Math.max(
        -EXPLORER_DRAG_OVERLAY_MAX_TILT_DEGREES,
        Math.min(
          EXPLORER_DRAG_OVERLAY_MAX_TILT_DEGREES,
          deltaX * EXPLORER_DRAG_OVERLAY_TILT_FACTOR,
        ),
      );
      pointerRotate.set(tilt);
    }

    previousPointerRef.current = displayPointer;
  }, [
    displayPointer,
    pointerOpacity,
    pointerRotate,
    pointerScale,
    pointerX,
    pointerY,
    state.phase,
  ]);

  if (
    !state.active ||
    !displayPointer ||
    typeof document === "undefined" ||
    !document.body
  ) {
    return null;
  }

  const stackDepth =
    state.sourceKind === "internal"
      ? Math.min(
          EXPLORER_DRAG_OVERLAY_MAX_STACK_DEPTH,
          Math.max(1, state.itemCount),
        )
      : 1;
  const previewStackItems = state.sourceStackItems.slice(0, stackDepth);
  const stackOffsets = Array.from(
    { length: Math.max(0, stackDepth - 1) },
    (_, index) => {
      const depth = stackDepth - index - 1;
      const previewItem = previewStackItems[index + 1] ?? null;
      const rotation = depth % 2 === 0 ? -3.5 : 2.5;
      return {
        key: depth,
        offsetX: depth * -14,
        offsetY: depth * 11,
        scale: 1 - depth * 0.05,
        opacity: 0.18 + depth * 0.18,
        previewItem,
        rotation,
      };
    },
  );
  const overflowPreviewCount = Math.max(0, state.itemCount - previewStackItems.length);

  const primaryLabel =
    state.primaryLabel?.trim() ||
    (state.itemCount > 1 ? `${state.itemCount} items` : "Item");
  const isPendingTarget = !state.valid && state.invalidReason == null;
  const targetLabel = state.valid
    ? state.targetKind === "scope-root"
      ? "Current Folder"
      : state.dwellLabel?.trim() || getPathLeaf(state.targetPath)
    : isPendingTarget
      ? "Choose a destination"
      : getInvalidReasonLabel(state.invalidReason);
  const isValidTarget = state.valid && state.phase !== "cancelled";
  const isNeutralInvalidTarget =
    !isValidTarget && state.invalidReason === "no-op";
  const cardBorderColor = isValidTarget
    ? "color-mix(in srgb, var(--overlay-accent) 62%, rgba(255,255,255,0.16))"
    : isPendingTarget
      ? "color-mix(in srgb, var(--overlay-accent) 42%, rgba(255,255,255,0.14))"
    : isNeutralInvalidTarget
      ? "color-mix(in srgb, var(--overlay-accent) 36%, rgba(255,255,255,0.14))"
      : "var(--overlay-explorer-danger-soft-border)";
  const cardBackground = isValidTarget
    ? "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 90%, black 10%), color-mix(in srgb, var(--overlay-bg-panel) 82%, var(--overlay-accent) 18%))"
    : isPendingTarget
      ? "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 92%, white 8%), color-mix(in srgb, var(--overlay-bg-panel) 84%, var(--overlay-accent) 16%))"
    : isNeutralInvalidTarget
      ? "linear-gradient(180deg, color-mix(in srgb, var(--overlay-bg-panel) 92%, white 8%), color-mix(in srgb, var(--overlay-bg-panel) 84%, var(--overlay-accent) 16%))"
      : "linear-gradient(180deg, var(--overlay-explorer-danger-soft-bg), color-mix(in srgb, var(--overlay-explorer-danger-soft-bg) 84%, black 16%))";
  const iconTint = isValidTarget
    ? "var(--overlay-accent)"
    : isPendingTarget
      ? "color-mix(in srgb, var(--overlay-accent) 76%, white 24%)"
    : isNeutralInvalidTarget
      ? "color-mix(in srgb, var(--overlay-accent) 72%, white 28%)"
      : "var(--overlay-explorer-danger)";
  const operationChipLabel = getOperationChipLabel({
    valid: isValidTarget,
    pending: isPendingTarget,
    invalidReason: state.invalidReason,
    operation: state.operation,
  });

  return createPortal(
    <motion.div
      aria-hidden="true"
      data-explorer-drag-overlay="true"
      data-testid="explorer-drag-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 10000,
        x: springX,
        y: springY,
        rotate: springRotate,
        scale: springScale,
        opacity: springOpacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          minWidth: state.sourceKind === "internal" ? 244 : 208,
          maxWidth: 292,
          paddingLeft: stackDepth > 1 ? 24 : 0,
          paddingTop: stackDepth > 1 ? 12 : 0,
        }}
      >
        {stackDepth > 1 &&
          stackOffsets.map((layer) => (
            <div
              key={layer.key}
              style={{
                position: "absolute",
                inset: "12px 0 0 0",
                transform: `translate(${layer.offsetX}px, ${layer.offsetY}px) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                transformOrigin: "top left",
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(8,10,18,0.78))",
                boxShadow:
                  "0 14px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                opacity: layer.opacity,
              }}
            >
              {layer.previewItem ? (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  {renderAvatarIcon({
                    iconSrc: layer.previewItem.iconSrc,
                    itemKind: layer.previewItem.itemKind,
                    size: 16,
                    color: "var(--overlay-text-primary)",
                  })}
                </div>
              ) : null}
            </div>
          ))}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 22,
            border: `1px solid ${cardBorderColor}`,
            background: cardBackground,
            boxShadow:
              "0 20px 44px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            color: "var(--overlay-text-primary)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: state.sourceKind === "internal" ? "14px 16px 12px" : "12px 14px 11px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                display: "grid",
                placeItems: "center",
                background: isValidTarget
                  ? "color-mix(in srgb, var(--overlay-accent) 20%, transparent)"
                  : "rgba(255, 82, 82, 0.14)",
                boxShadow: isValidTarget
                  ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
                flexShrink: 0,
              }}
            >
              {renderAvatarIcon({
                iconSrc: state.sourceIconSrc,
                itemKind: state.sourceItemKind,
                size: 28,
                color: iconTint,
              })}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {primaryLabel}
                </div>
                {state.itemCount > 1 && (
                  <div
                    style={{
                      borderRadius: 999,
                      padding: "4px 8px",
                      background: "rgba(255,255,255,0.08)",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "var(--overlay-text-primary)",
                      flexShrink: 0,
                    }}
                  >
                    {state.itemCount > 99 ? "99+" : state.itemCount}
                  </div>
                )}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 10.5,
                  color: "var(--overlay-text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isValidTarget ? `Drop into ${targetLabel}` : targetLabel}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  padding: "5px 9px",
                  background: isValidTarget
                    ? "color-mix(in srgb, var(--overlay-accent) 16%, rgba(255,255,255,0.05))"
                    : "rgba(255,255,255,0.05)",
                  color: isValidTarget
                    ? "var(--overlay-text-primary)"
                    : "var(--overlay-text-muted)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {operationChipLabel}
              </div>
              {previewStackItems.length > 1 ? (
                <div
                  style={{
                    marginTop: 9,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  {previewStackItems.slice(1).map((item) => (
                    <div
                      key={item.path}
                      title={item.label}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                        flexShrink: 0,
                      }}
                    >
                      {renderAvatarIcon({
                        iconSrc: item.iconSrc,
                        itemKind: item.itemKind,
                        size: 14,
                        color: "var(--overlay-text-primary)",
                      })}
                    </div>
                  ))}
                  {overflowPreviewCount > 0 ? (
                    <div
                      style={{
                        borderRadius: 999,
                        padding: "3px 8px",
                        background: "rgba(255,255,255,0.06)",
                        color: "var(--overlay-text-muted)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      +{overflowPreviewCount}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {state.dwellSurfaceId && state.dwellDelayMs && isValidTarget ? (
            <div
              style={{
                padding: "0 16px 13px",
              }}
            >
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, state.dwellProgress * 100))}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "var(--overlay-accent)",
                    transition: "width 60ms linear",
                  }}
                />
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 9.5,
                  color: "var(--overlay-text-muted)",
                }}
              >
                Opening {targetLabel}…
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
