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
  zIndexFallback?: number | string;
  surfaceGroup?: string;
  children: React.ReactNode;
}

interface ExplorerFloatingSurfacePosition {
  left: number;
  top: number;
  strategy: "absolute" | "fixed";
}

interface ExplorerFloatingSurfaceConstraintRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function resolveExplorerFloatingSurfacePortalRoot(
  anchorElement: HTMLElement | null,
): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  return (
    anchorElement?.closest<HTMLElement>("[data-overlay-explorer]") ??
    document.body
  );
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
  constraintRect?: ExplorerFloatingSurfaceConstraintRect | null;
  side: ExplorerFloatingSurfaceSide;
  align: ExplorerFloatingSurfaceAlign;
  offset: number;
  viewportPadding: number;
}): Pick<ExplorerFloatingSurfacePosition, "left" | "top"> {
  const {
    anchorRect,
    panelRect,
    constraintRect,
    side,
    align,
    offset,
    viewportPadding,
  } = args;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const boundaryLeft = constraintRect?.left ?? 0;
  const boundaryTop = constraintRect?.top ?? 0;
  const boundaryRight = constraintRect?.right ?? viewportWidth;
  const boundaryBottom = constraintRect?.bottom ?? viewportHeight;
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
      boundaryLeft + viewportPadding,
      boundaryRight - panelRect.width - viewportPadding,
    ),
    top: clampExplorerFloatingSurfacePosition(
      desiredTop,
      boundaryTop + viewportPadding,
      boundaryBottom - panelRect.height - viewportPadding,
    ),
  };
}

function projectExplorerFloatingSurfacePositionToPortalRoot(args: {
  viewportPosition: Pick<ExplorerFloatingSurfacePosition, "left" | "top">;
  portalRoot: HTMLElement;
}): ExplorerFloatingSurfacePosition {
  const { viewportPosition, portalRoot } = args;
  if (portalRoot === document.body) {
    return {
      ...viewportPosition,
      strategy: "fixed",
    };
  }

  const portalRootRect = portalRoot.getBoundingClientRect();
  return {
    left: viewportPosition.left - portalRootRect.left + portalRoot.scrollLeft,
    top: viewportPosition.top - portalRootRect.top + portalRoot.scrollTop,
    strategy: "absolute",
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
  zIndexFallback = 9997,
  surfaceGroup,
  style,
  children,
  ...divProps
}: ExplorerFloatingSurfaceProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] =
    useState<ExplorerFloatingSurfacePosition | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      setPortalRoot(null);
      return undefined;
    }

    const updatePosition = () => {
      const anchorElement = anchorRef.current;
      const nextPortalRoot =
        resolveExplorerFloatingSurfacePortalRoot(anchorElement);
      setPortalRoot((currentPortalRoot) =>
        currentPortalRoot === nextPortalRoot ? currentPortalRoot : nextPortalRoot,
      );
      const panelElement = panelRef.current;
      if (!anchorElement || !panelElement) {
        setPosition(null);
        return;
      }
      const portalRootRect =
        nextPortalRoot && nextPortalRoot !== document.body
          ? nextPortalRoot.getBoundingClientRect()
          : null;
      const viewportPosition = resolveExplorerFloatingSurfacePosition({
        anchorRect: anchorElement.getBoundingClientRect(),
        panelRect: panelElement.getBoundingClientRect(),
        constraintRect: portalRootRect,
        side,
        align,
        offset,
        viewportPadding,
      });
      setPosition(
        nextPortalRoot
          ? projectExplorerFloatingSurfacePositionToPortalRoot({
              viewportPosition,
              portalRoot: nextPortalRoot,
            })
          : null,
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
  }, [align, anchorRef, offset, open, portalRoot, side, viewportPadding]);

  if (!open || typeof document === "undefined" || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      {...divProps}
      ref={panelRef}
      data-overlay-explorer-floating-surface="true"
      data-overlay-explorer-floating-surface-group={surfaceGroup}
      style={{
        position: position?.strategy ?? "fixed",
        left: position?.left ?? -99999,
        top: position?.top ?? -99999,
        zIndex: `var(${zIndexCssVar}, ${zIndexFallback})`,
        ...style,
      }}
    >
      {children}
    </div>,
    portalRoot,
  );
}
