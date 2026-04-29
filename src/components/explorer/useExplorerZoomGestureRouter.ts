import { useCallback, useLayoutEffect, useRef } from "react";

import {
  matchesWheelHotkey,
  shouldArmNonPassiveWheelHotkeyListener,
} from "../../config/hotkeys";
import { getNormalizedExplorerZoomWheelPixels } from "../../config/explorerZoomBehavior";

export const EXPLORER_ZOOM_SCOPE_ATTRIBUTE = "data-explorer-zoom-scope";
export const EXPLORER_ZOOM_SCOPE_SELECTOR =
  `[${EXPLORER_ZOOM_SCOPE_ATTRIBUTE}="true"]`;

export interface ExplorerZoomGesture {
  rawEvent: WheelEvent;
  normalizedDeltaX: number;
  normalizedDeltaY: number;
  clientX: number;
  clientY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  scopeElement: HTMLElement;
}

export interface ExplorerZoomController {
  id: string;
  priority?: number;
  canHandleZoomGesture: (gesture: ExplorerZoomGesture) => boolean;
  applyWheelZoom: (gesture: ExplorerZoomGesture) => boolean;
}

interface UseExplorerZoomGestureRouterArgs {
  scopeNode: HTMLElement | null;
  hotkeyBinding: string;
  getViewportHeight: () => number;
}

function getTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node) {
    return target.parentElement;
  }
  return null;
}

export function isEventInsideExplorerZoomScope(target: EventTarget | null): boolean {
  return getTargetElement(target)?.closest(EXPLORER_ZOOM_SCOPE_SELECTOR) != null;
}

export function shouldExplorerZoomScopeOwnWheelGesture(args: {
  event: Pick<WheelEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;
  binding: string;
  target: EventTarget | null;
}): boolean {
  return (
    matchesWheelHotkey(args.event, args.binding) &&
    isEventInsideExplorerZoomScope(args.target)
  );
}

export function useExplorerZoomGestureRouter(
  args: UseExplorerZoomGestureRouterArgs,
): {
  registerZoomController: (controller: ExplorerZoomController) => () => void;
} {
  const controllerMapRef = useRef<Map<string, ExplorerZoomController>>(new Map());

  const registerZoomController = useCallback(
    (controller: ExplorerZoomController) => {
      controllerMapRef.current.set(controller.id, controller);
      return () => {
        if (controllerMapRef.current.get(controller.id) === controller) {
          controllerMapRef.current.delete(controller.id);
        }
      };
    },
    [],
  );

  useLayoutEffect(() => {
    const scopeNode = args.scopeNode;
    if (!scopeNode || typeof window === "undefined") {
      return;
    }
    const activeWheelModifierState = {
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    };
    const wheelListenerOptions: AddEventListenerOptions = {
      passive: false,
      capture: true,
    };
    const keyboardListenerOptions: AddEventListenerOptions = {
      capture: true,
    };
    let isWheelListenerAttached = false;

    const handleWheel = (event: WheelEvent) => {
      if (!matchesWheelHotkey(event, args.hotkeyBinding)) {
        return;
      }
      if (!(event.target instanceof Node) || !scopeNode.contains(event.target)) {
        return;
      }

      const normalizedDelta = getNormalizedExplorerZoomWheelPixels(
        event,
        args.getViewportHeight(),
      );
      const gesture: ExplorerZoomGesture = {
        rawEvent: event,
        normalizedDeltaX: normalizedDelta.x,
        normalizedDeltaY: normalizedDelta.y,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        target: event.target,
        scopeElement: scopeNode,
      };

      const controllers = [...controllerMapRef.current.values()].sort(
        (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
      );

      for (const controller of controllers) {
        if (!controller.canHandleZoomGesture(gesture)) {
          continue;
        }
        event.preventDefault();
        event.stopPropagation();
        if (controller.applyWheelZoom(gesture)) {
          return;
        }
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const syncWheelModifierState = (
      event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
    ) => {
      activeWheelModifierState.ctrlKey = event.ctrlKey;
      activeWheelModifierState.metaKey = event.metaKey;
      activeWheelModifierState.altKey = event.altKey;
      activeWheelModifierState.shiftKey = event.shiftKey;
    };
    const attachWheelListener = () => {
      if (isWheelListenerAttached) {
        return;
      }
      scopeNode.addEventListener("wheel", handleWheel, wheelListenerOptions);
      isWheelListenerAttached = true;
    };
    const detachWheelListener = () => {
      if (!isWheelListenerAttached) {
        return;
      }
      scopeNode.removeEventListener("wheel", handleWheel, wheelListenerOptions);
      isWheelListenerAttached = false;
    };
    const syncWheelListenerAttachment = () => {
      if (shouldArmNonPassiveWheelHotkeyListener(
        activeWheelModifierState,
        [args.hotkeyBinding],
      )) {
        attachWheelListener();
        return;
      }
      detachWheelListener();
    };
    const handleWheelShortcutKeyChange = (event: KeyboardEvent) => {
      syncWheelModifierState(event);
      syncWheelListenerAttachment();
    };
    const handleWheelShortcutBlur = () => {
      activeWheelModifierState.ctrlKey = false;
      activeWheelModifierState.metaKey = false;
      activeWheelModifierState.altKey = false;
      activeWheelModifierState.shiftKey = false;
      detachWheelListener();
    };

    window.addEventListener("keydown", handleWheelShortcutKeyChange, keyboardListenerOptions);
    window.addEventListener("keyup", handleWheelShortcutKeyChange, keyboardListenerOptions);
    window.addEventListener("blur", handleWheelShortcutBlur);
    syncWheelListenerAttachment();
    return () => {
      detachWheelListener();
      window.removeEventListener("keydown", handleWheelShortcutKeyChange, keyboardListenerOptions);
      window.removeEventListener("keyup", handleWheelShortcutKeyChange, keyboardListenerOptions);
      window.removeEventListener("blur", handleWheelShortcutBlur);
    };
  }, [args.getViewportHeight, args.hotkeyBinding, args.scopeNode]);

  return { registerZoomController };
}
