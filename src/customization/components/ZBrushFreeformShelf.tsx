import React, { useCallback, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { X } from "@/components/AppIcons";
import type {
  ExplorerChromeControlId,
  ExplorerChromeResolvedControlPlacement,
  ExplorerChromeSurfaceId,
} from "../types";
import { useUiCustomizationStore } from "../store/uiCustomizationStore";

interface ZBrushFreeformShelfProps {
  surfaceId: ExplorerChromeSurfaceId;
  rowId: string;
  controls: ExplorerChromeResolvedControlPlacement[];
  editModeActive: boolean;
  selectedControlId: ExplorerChromeControlId | null;
  renderControl: (
    placement: ExplorerChromeResolvedControlPlacement,
  ) => React.ReactNode;
  onSelectControl?: (controlId: ExplorerChromeControlId | null) => void;
  onUpdatePlacement?: (
    controlId: ExplorerChromeControlId,
    patch: { anchorX?: number; anchorY?: number; widthPx?: number },
  ) => void;
  onRemoveControl?: (controlId: ExplorerChromeControlId) => void;
  onRequestHotkeyCapture?: (controlId: ExplorerChromeControlId) => void;
  onBeginPointerDrag?: (args: {
    controlId: ExplorerChromeControlId;
    pointerId: number;
    sourceKind: "placed";
    startPoint: { x: number; y: number };
  }) => void;
  onBeginPointerResize?: (args: {
    controlId: ExplorerChromeControlId;
    pointerId: number;
    startPoint: { x: number; y: number };
  }) => void;
  isControlResizable?: (
    placement: ExplorerChromeResolvedControlPlacement,
  ) => boolean;
  highlightedDropTarget?: {
    surfaceId: string;
    zoneId: string;
    targetIndex: number;
  } | null;
  style?: React.CSSProperties;
}

const DEFAULT_ITEM_HEIGHT = 32;
const MIN_ITEM_WIDTH = 28;

function getDefaultWidthForControl(
  controlId: ExplorerChromeControlId,
  hasExplicitWidth?: number,
): number {
  if (typeof hasExplicitWidth === "number" && hasExplicitWidth > 0) {
    return hasExplicitWidth;
  }
  if (controlId === "addressBar" || controlId === "focusAddressBar") {
    return 340;
  }
  if (controlId === "statusViewSize" || controlId.startsWith("widget:")) {
    return 140;
  }
  if (controlId === "recentLocations") {
    return 180;
  }
  return 32;
}

export const ZBrushFreeformShelf: React.FC<ZBrushFreeformShelfProps> = ({
  surfaceId,
  rowId,
  controls,
  editModeActive,
  selectedControlId,
  renderControl,
  onSelectControl,
  onUpdatePlacement,
  onRemoveControl,
  onRequestHotkeyCapture,
  onBeginPointerDrag,
  onBeginPointerResize,
  isControlResizable,
  highlightedDropTarget,
  style,
}) => {
  const shelfRef = useRef<HTMLDivElement | null>(null);
  const [hoveredControlId, setHoveredControlId] = useState<string | null>(null);
  const openHotkeyModal = useUiCustomizationStore((s) => s.openHotkeyModal);
  const openIconPicker = useUiCustomizationStore((s) => s.openIconPicker);

  const resolvedPositions = useMemo(() => {
    let currentX = 6;
    const positions = new Map<string, { x: number; y: number; width: number }>();

    for (const placement of controls) {
      const width = getDefaultWidthForControl(placement.controlId, placement.widthPx);
      const x = placement.anchorX != null ? placement.anchorX : currentX;
      const y = placement.anchorY != null ? placement.anchorY : 3;

      positions.set(placement.controlId, { x, y, width });

      if (placement.anchorX == null) {
        currentX += width + 6;
      }
    }
    return positions;
  }, [controls]);

  const contentWidth = useMemo(() => {
    let maxX = 800;
    for (const [_, pos] of resolvedPositions.entries()) {
      maxX = Math.max(maxX, pos.x + pos.width + 40);
    }
    return maxX;
  }, [resolvedPositions]);

  const handleDragStop = useCallback(
    (controlId: ExplorerChromeControlId, x: number, y: number) => {
      if (y > 60 || y < -30) {
        if (onRemoveControl) {
          onRemoveControl(controlId);
          return;
        }
      }

      onUpdatePlacement?.(controlId, {
        anchorX: Math.max(0, Math.round(x)),
        anchorY: Math.round(y),
      });
    },
    [onRemoveControl, onUpdatePlacement],
  );

  const handleResizeStop = useCallback(
    (
      controlId: ExplorerChromeControlId,
      width: number,
      x: number,
      y: number,
    ) => {
      onUpdatePlacement?.(controlId, {
        widthPx: Math.max(MIN_ITEM_WIDTH, Math.round(width)),
        anchorX: Math.max(0, Math.round(x)),
        anchorY: Math.round(y),
      });
    },
    [onUpdatePlacement],
  );

  const handleClickItem = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      controlId: ExplorerChromeControlId,
    ) => {
      if (
        event.target instanceof Element &&
        (event.target.closest("[data-explorer-customize-remove-control]") ||
          event.target.closest("[data-explorer-customize-resize-control]"))
      ) {
        return;
      }

      if (event.ctrlKey && event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        onRequestHotkeyCapture?.(controlId);
        onSelectControl?.(controlId);
        openHotkeyModal({
          controlId,
          commandId: controlId,
          label: controlId,
        });
        return;
      }

      if (editModeActive) {
        event.preventDefault();
        event.stopPropagation();
        onSelectControl?.(controlId);
        const rect = event.currentTarget.getBoundingClientRect();
        openIconPicker(controlId, {
          top: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    },
    [editModeActive, onSelectControl, onRequestHotkeyCapture, openHotkeyModal, openIconPicker],
  );

  return (
    <div
      ref={shelfRef}
      data-zbrush-freeform-shelf={`${surfaceId}:${rowId}`}
      style={{
        position: "relative",
        width: "100%",
        minWidth: contentWidth,
        height: 38,
        minHeight: 38,
        overflowX: editModeActive ? "auto" : "visible",
        overflowY: "visible",
        background: editModeActive
          ? "rgba(0, 0, 0, 0.15)"
          : "transparent",
        borderRadius: 6,
        ...style,
      }}
    >
      {highlightedDropTarget?.surfaceId === surfaceId && (
        <div
          data-explorer-customize-insertion-ghost="true"
          style={{ display: "none" }}
        />
      )}
      {controls.map((placement) => {
        const pos = resolvedPositions.get(placement.controlId) ?? {
          x: 0,
          y: 3,
          width: 32,
        };
        const isSelected = selectedControlId === placement.controlId;
        const resizable = isControlResizable?.(placement) ?? false;
        const isHovered = hoveredControlId === placement.controlId;

        return (
          <Rnd
            key={`${surfaceId}:${placement.controlId}`}
            data-zbrush-rnd-item={placement.controlId}
            position={{ x: pos.x, y: pos.y }}
            size={{ width: pos.width, height: DEFAULT_ITEM_HEIGHT }}
            disableDragging={!editModeActive}
            enableResizing={
              editModeActive && resizable
                ? {
                    top: false,
                    right: true,
                    bottom: false,
                    left: true,
                    topRight: false,
                    bottomRight: false,
                    bottomLeft: false,
                    topLeft: false,
                  }
                : false
            }
            minWidth={MIN_ITEM_WIDTH}
            minHeight={DEFAULT_ITEM_HEIGHT}
            bounds="parent"
            onDragStop={(_, d) => handleDragStop(placement.controlId, d.x, d.y)}
            onResizeStop={(_, __, ref, ___, position) =>
              handleResizeStop(
                placement.controlId,
                ref.offsetWidth,
                position.x,
                position.y,
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: isSelected ? 20 : 10,
              boxSizing: "border-box",
              cursor: editModeActive ? "grab" : "default",
            }}
          >
            <div
              data-overlay-explorer-control={placement.controlId}
              data-overlay-explorer-control-zone={placement.zone}
              onMouseEnter={() => setHoveredControlId(placement.controlId)}
              onMouseLeave={() => setHoveredControlId(null)}
              onPointerDownCapture={(event) => {
                if (!editModeActive || event.button !== 0) return;
                if (event.ctrlKey && event.altKey) return;
                onSelectControl?.(placement.controlId);
                onBeginPointerDrag?.({
                  controlId: placement.controlId,
                  pointerId: event.pointerId,
                  sourceKind: "placed",
                  startPoint: { x: event.clientX, y: event.clientY },
                });
              }}
              onClickCapture={(e) => handleClickItem(e, placement.controlId)}
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                borderRadius: 6,
                minWidth: MIN_ITEM_WIDTH,
                border: editModeActive
                  ? isSelected
                    ? "1px solid var(--overlay-accent, #ff8c00)"
                    : "1px dashed rgba(255, 255, 255, 0.18)"
                  : "none",
                background: editModeActive
                  ? isSelected
                    ? "color-mix(in srgb, var(--overlay-accent, #ff8c00) 15%, transparent)"
                    : "rgba(0, 0, 0, 0.08)"
                  : "transparent",
                boxShadow: isSelected && editModeActive
                  ? "0 0 6px var(--overlay-accent, #ff8c00)"
                  : undefined,
                transition: "border 100ms ease, background 100ms ease",
              }}
            >
              {renderControl(placement)}

              {/* Remove button */}
              {editModeActive && onRemoveControl && (
                <button
                  type="button"
                  data-explorer-customize-remove-control="true"
                  aria-label={`Remove ${placement.controlId} from layout`}
                  title={`Remove ${placement.controlId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveControl(placement.controlId);
                  }}
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "none",
                    color: "white",
                    display: editModeActive ? "flex" : "none",
                    opacity: isHovered || isSelected ? 1 : 0.65,
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 25,
                    padding: 0,
                    fontSize: 9,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  }}
                >
                  <X size={8} />
                </button>
              )}

              {/* Resize button */}
              {editModeActive && resizable && onBeginPointerResize && (
                <button
                  type="button"
                  data-explorer-customize-resize-control="true"
                  aria-label={`Resize ${placement.controlId}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectControl?.(placement.controlId);
                    onBeginPointerResize({
                      controlId: placement.controlId,
                      pointerId: event.pointerId,
                      startPoint: { x: event.clientX, y: event.clientY },
                    });
                  }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 0,
                    transform: "translateY(-50%)",
                    width: 8,
                    height: 20,
                    display: isHovered || isSelected ? "flex" : "none",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: 2,
                    background: "var(--overlay-accent, #ff8c00)",
                    cursor: "ew-resize",
                    zIndex: 25,
                    padding: 0,
                  }}
                />
              )}
            </div>
          </Rnd>
        );
      })}
    </div>
  );
};
