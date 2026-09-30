import { useCallback, useRef } from "react";
import { useUiCustomizationStore } from "../store/uiCustomizationStore";
import type {
  ExplorerChromeControlId,
  ExplorerChromeSurfaceId,
  ExplorerChromeZoneId,
  ZBrushDropTarget,
} from "../types";

interface UseZBrushShelfDragArgs {
  surfaceId: ExplorerChromeSurfaceId;
  onMoveControl?: (args: {
    controlId: ExplorerChromeControlId;
    targetSurfaceId: ExplorerChromeSurfaceId;
    targetZoneId: ExplorerChromeZoneId;
    targetIndex: number;
  }) => void;
  onRemoveControl?: (controlId: ExplorerChromeControlId) => void;
  onRequestHotkeyCapture?: (controlId: ExplorerChromeControlId) => void;
  onSelectControl?: (controlId: ExplorerChromeControlId | null) => void;
}

export function useZBrushShelfDrag({
  surfaceId,
  onMoveControl,
  onRemoveControl,
  onRequestHotkeyCapture,
  onSelectControl,
}: UseZBrushShelfDragArgs) {
  const isCustomizeMode = useUiCustomizationStore((state) => state.isCustomizeMode);
  const startDrag = useUiCustomizationStore((state) => state.startDrag);
  const updateDragPointer = useUiCustomizationStore((state) => state.updateDragPointer);
  const finishDrag = useUiCustomizationStore((state) => state.finishDrag);
  const openHotkeyModal = useUiCustomizationStore((state) => state.openHotkeyModal);
  const openIconPicker = useUiCustomizationStore((state) => state.openIconPicker);

  const dragPointerIdRef = useRef<number | null>(null);

  const handlePointerDownButton = useCallback(
    (args: {
      event: React.PointerEvent<HTMLElement>;
      controlId: ExplorerChromeControlId;
      zoneId: ExplorerChromeZoneId;
      index: number;
      label: string;
      iconName?: string;
    }) => {
      const { event, controlId, zoneId, index, label, iconName } = args;

      // Only left mouse button
      if (event.button !== 0) return;

      const isZBrushModifier = event.ctrlKey && event.altKey;
      if (!isCustomizeMode && !isZBrushModifier) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dragPointerIdRef.current = event.pointerId;

      startDrag({
        controlId,
        sourceKind: "placed",
        sourceSurfaceId: surfaceId,
        sourceZoneId: zoneId,
        sourceIndex: index,
        label,
        iconName,
        pointerX: event.clientX,
        pointerY: event.clientY,
      });

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== dragPointerIdRef.current) return;

        // Check if cursor is over a remove zone (canvas)
        const targetElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const isRemoveZone =
          Boolean(targetElement?.closest("[data-zbrush-remove-zone='true']")) ||
          Boolean(targetElement?.closest("[data-explorer-customize-remove-zone='true']")) ||
          Boolean(targetElement?.closest("[data-overlay-explorer-plane='content-viewport']"));

        let dropTarget: ZBrushDropTarget | null = null;

        if (!isRemoveZone && targetElement) {
          // Find closest shelf zone
          const zoneElement = targetElement.closest<HTMLElement>(
            "[data-zbrush-shelf-zone], [data-overlay-explorer-zone], [data-explorer-customize-zone-id]",
          );

          if (zoneElement) {
            const surfaceElement = zoneElement.closest<HTMLElement>(
              "[data-zbrush-shelf-surface], [data-overlay-explorer-surface], [data-explorer-customize-surface-id]",
            );
            const foundSurfaceId = (surfaceElement?.dataset.zbrushShelfSurface ||
              surfaceElement?.dataset.overlayExplorerSurface ||
              surfaceElement?.dataset.explorerCustomizeSurfaceId) as ExplorerChromeSurfaceId;
            const foundZoneId = (zoneElement.dataset.zbrushShelfZone ||
              zoneElement.dataset.overlayExplorerZone ||
              zoneElement.dataset.explorerCustomizeZoneId) as ExplorerChromeZoneId;

            if (foundSurfaceId && foundZoneId) {
              // Calculate 1D insertion index based on child control positions
              const controlElements = Array.from(
                zoneElement.querySelectorAll<HTMLElement>(
                  "[data-zbrush-control-id], [data-overlay-explorer-control]",
                ),
              );

              let targetIndex = controlElements.length;
              for (let i = 0; i < controlElements.length; i += 1) {
                const rect = controlElements[i].getBoundingClientRect();
                const midpointX = rect.left + rect.width / 2;
                if (moveEvent.clientX < midpointX) {
                  targetIndex = i;
                  break;
                }
              }

              dropTarget = {
                surfaceId: foundSurfaceId,
                zoneId: foundZoneId,
                targetIndex,
              };
            }
          }
        }

        updateDragPointer(moveEvent.clientX, moveEvent.clientY, dropTarget, isRemoveZone);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== dragPointerIdRef.current) return;

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        dragPointerIdRef.current = null;

        const currentDrag = useUiCustomizationStore.getState().activeDrag;
        if (!currentDrag) {
          finishDrag();
          return;
        }

        if (currentDrag.isRemoveTarget) {
          onRemoveControl?.(controlId);
        } else if (currentDrag.dropTarget) {
          onMoveControl?.({
            controlId,
            targetSurfaceId: currentDrag.dropTarget.surfaceId,
            targetZoneId: currentDrag.dropTarget.zoneId,
            targetIndex: currentDrag.dropTarget.targetIndex,
          });
        }

        finishDrag();
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    [
      finishDrag,
      isCustomizeMode,
      onMoveControl,
      onRemoveControl,
      startDrag,
      surfaceId,
      updateDragPointer,
    ],
  );

  const handleClickButton = useCallback(
    (args: {
      event: React.MouseEvent<HTMLElement>;
      controlId: ExplorerChromeControlId;
      commandId?: string;
      label: string;
      currentBinding?: string | null;
    }) => {
      const { event, controlId, commandId, label, currentBinding } = args;

      // ZBrush hotkey assignment: Ctrl + Alt + Click
      if (event.ctrlKey && event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (onRequestHotkeyCapture) {
          onRequestHotkeyCapture(controlId);
        }
        openHotkeyModal({
          controlId,
          commandId: commandId || controlId,
          label,
          currentBinding: currentBinding ?? null,
        });
        return;
      }

      // If in customize mode, clicking selects control and opens icon picker
      if (isCustomizeMode) {
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
    [isCustomizeMode, onSelectControl, onRequestHotkeyCapture, openHotkeyModal, openIconPicker],
  );

  return {
    isCustomizeMode,
    handlePointerDownButton,
    handleClickButton,
  };
}
