import { useCallback, useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * Shared chrome behavior for frameless secondary windows (file-operations,
 * explorer picker, …). All secondary windows are built with
 * `decorations(false)`, so the OS gives them no titlebar — without this,
 * the window is bolted in place and can never be moved.
 *
 * Mirrors the drag archetype used by the main top bar (`WorkbenchTopBar`),
 * the lookdev secondary chrome (`LookdevOverlay`), and the workbench-surface
 * secondary chrome (`App`): pointer-down on a non-interactive header region
 * calls `startDragging()`, interactive children opt out via
 * `data-gfs-window-drag-exclusion="true"`, double-click toggles maximize.
 */

export const SECONDARY_WINDOW_DRAG_REGION_ATTR = 'data-gfs-window-drag-region';
export const SECONDARY_WINDOW_DRAG_EXCLUSION_ATTR = 'data-gfs-window-drag-exclusion';
export const SECONDARY_WINDOW_DRAG_EXCLUSION_SELECTOR = '[data-gfs-window-drag-exclusion="true"]';

const SECONDARY_WINDOW_CHROME_INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[role="tab"]',
  SECONDARY_WINDOW_DRAG_EXCLUSION_SELECTOR,
].join(',');

export function isSecondaryWindowChromeInteractiveTarget(
  target: EventTarget | null,
): boolean {
  const element = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;

  return Boolean(element?.closest(SECONDARY_WINDOW_CHROME_INTERACTIVE_SELECTOR));
}

export interface SecondaryWindowChromeControls {
  isMaximized: boolean;
  handleDragPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  handleTitleDoubleClick: (event: React.MouseEvent<HTMLElement>) => void;
  handleMinimize: () => void;
  handleToggleMaximize: () => void;
  handleClose: () => void;
}

export function useSecondaryWindowChromeControls(): SecondaryWindowChromeControls {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let cancelled = false;
    void getCurrentWindow()
      .isMaximized()
      .then((maximized) => {
        if (!cancelled) {
          setIsMaximized(maximized);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (
      event.button !== 0
      || event.defaultPrevented
      || !isTauri()
      || isSecondaryWindowChromeInteractiveTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    void getCurrentWindow().startDragging().catch(() => undefined);
  }, []);

  const handleToggleMaximize = useCallback(() => {
    if (!isTauri()) {
      return;
    }

    const window = getCurrentWindow();
    window
      .isMaximized()
      .then((maximized) => {
        if (maximized) {
          return window.unmaximize().then(() => false);
        }
        return window.maximize().then(() => true);
      })
      .then((maximized) => {
        setIsMaximized(maximized);
      })
      .catch(() => undefined);
  }, []);

  const handleTitleDoubleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (
      event.defaultPrevented
      || !isTauri()
      || isSecondaryWindowChromeInteractiveTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    handleToggleMaximize();
  }, [handleToggleMaximize]);

  const handleMinimize = useCallback(() => {
    if (!isTauri()) {
      return;
    }

    void getCurrentWindow().minimize().catch(() => undefined);
  }, []);

  const handleClose = useCallback(() => {
    if (!isTauri()) {
      return;
    }

    void getCurrentWindow().close().catch(() => undefined);
  }, []);

  return {
    isMaximized,
    handleDragPointerDown,
    handleTitleDoubleClick,
    handleMinimize,
    handleToggleMaximize,
    handleClose,
  };
}
