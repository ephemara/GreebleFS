import React, {
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type ExplorerFloatingSurfaceSide = "top" | "bottom";
type ExplorerFloatingSurfaceAlign = "start" | "end";

interface ExplorerFloatingSurfaceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  side?: ExplorerFloatingSurfaceSide;
  align?: ExplorerFloatingSurfaceAlign;
  offset?: number;
  viewportPadding?: number;
  zIndexCssVar?: string;
  surfaceGroup?: string;
  children: React.ReactNode;
}

interface ExplorerFloatingSurfacePosition {
  left: number;
  top: number;
}

function clampExplorerFloatingSurfacePosition(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (maximum < minimum) {
    return minimum;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function resolveExplorerFloatingSurfacePosition(args: {
  anchorRect: DOMRect;
  panelRect: DOMRect;
  side: ExplorerFloatingSurfaceSide;
  align: ExplorerFloatingSurfaceAlign;
  offset: number;
  viewportPadding: number;
}): ExplorerFloatingSurfacePosition {
  const {
    anchorRect,
    panelRect,
    side,
    align,
    offset,
    viewportPadding,
  } = args;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const desiredLeft =
    align === "start"
      ? anchorRect.left
      : anchorRect.right - panelRect.width;
  const desiredTop =
    side === "top"
      ? anchorRect.top - panelRect.height - offset
      : anchorRect.bottom + offset;
  return {
    left: clampExplorerFloatingSurfacePosition(
      desiredLeft,
      viewportPadding,
      viewportWidth - panelRect.width - viewportPadding,
    ),
    top: clampExplorerFloatingSurfacePosition(
      desiredTop,
      viewportPadding,
      viewportHeight - panelRect.height - viewportPadding,
    ),
  };
}

export function ExplorerFloatingSurface({
  anchorRef,
  open,
  side = "bottom",
  align = "end",
  offset = 8,
  viewportPadding = 8,
  zIndexCssVar = "--overlay-explorer-floating-menu-layer",
  surfaceGroup,
  style,
  children,
  ...divProps
}: ExplorerFloatingSurfaceProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] =
    useState<ExplorerFloatingSurfacePosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const anchorElement = anchorRef.current;
      const panelElement = panelRef.current;
      if (!anchorElement || !panelElement) {
        setPosition(null);
        return;
      }
      setPosition(
        resolveExplorerFloatingSurfacePosition({
          anchorRect: anchorElement.getBoundingClientRect(),
          panelRect: panelElement.getBoundingClientRect(),
          side,
          align,
          offset,
          viewportPadding,
        }),
      );
    };

    updatePosition();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updatePosition())
        : null;
    if (anchorRef.current) {
      resizeObserver?.observe(anchorRef.current);
    }
    if (panelRef.current) {
      resizeObserver?.observe(panelRef.current);
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorRef, offset, open, side, viewportPadding]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      {...divProps}
      ref={panelRef}
      data-overlay-explorer-floating-surface="true"
      data-overlay-explorer-floating-surface-group={surfaceGroup}
      style={{
        position: "fixed",
        left: position?.left ?? -99999,
        top: position?.top ?? -99999,
        zIndex: `var(${zIndexCssVar}, 9997)`,
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
