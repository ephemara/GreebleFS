import React, {
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from "react";
import {
  autoUpdate,
  computePosition,
  flip,
  limitShift,
  offset as floatingOffset,
  shift,
  type Placement,
} from "@floating-ui/react";
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

function resolveExplorerFloatingSurfacePlacement(
  side: ExplorerFloatingSurfaceSide,
  align: ExplorerFloatingSurfaceAlign,
): Placement {
  return `${side}-${align}`;
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
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() => (
    typeof document !== "undefined" ? document.body : null
  ));

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }

    const anchorElement = anchorRef.current;
    const panelElement = panelRef.current;
    const nextPortalRoot = resolveExplorerFloatingSurfacePortalRoot(anchorElement);
    setPortalRoot((currentPortalRoot) => (
      currentPortalRoot === nextPortalRoot ? currentPortalRoot : nextPortalRoot
    ));

    if (!anchorElement || !panelElement || !nextPortalRoot) {
      setPosition(null);
      return undefined;
    }

    let cancelled = false;
    const placement = resolveExplorerFloatingSurfacePlacement(side, align);
    const boundaryElement = nextPortalRoot === document.body ? undefined : nextPortalRoot;

    const updatePosition = async () => {
      const activeAnchorElement = anchorRef.current;
      const activePanelElement = panelRef.current;
      const activePortalRoot = resolveExplorerFloatingSurfacePortalRoot(activeAnchorElement);
      if (!activeAnchorElement || !activePanelElement || !activePortalRoot) {
        if (!cancelled) {
          setPosition(null);
        }
        return;
      }

      if (activePortalRoot !== nextPortalRoot) {
        setPortalRoot(activePortalRoot);
        return;
      }

      const viewportPosition = await computePosition(
        activeAnchorElement,
        activePanelElement,
        {
          placement,
          strategy: "fixed",
          middleware: [
            floatingOffset(offset),
            flip({
              boundary: boundaryElement,
              padding: viewportPadding,
            }),
            shift({
              boundary: boundaryElement,
              padding: viewportPadding,
              limiter: limitShift(),
            }),
          ],
        },
      );

      if (cancelled) {
        return;
      }

      setPosition(
        activePortalRoot === document.body
          ? {
              left: viewportPosition.x,
              top: viewportPosition.y,
              strategy: "fixed",
            }
          : projectExplorerFloatingSurfacePositionToPortalRoot({
              viewportPosition: {
                left: viewportPosition.x,
                top: viewportPosition.y,
              },
              portalRoot: activePortalRoot,
            }),
      );
    };

    void updatePosition();
    const cleanupAutoUpdate = autoUpdate(
      anchorElement,
      panelElement,
      () => {
        void updatePosition();
      },
      {
        ancestorResize: true,
        ancestorScroll: true,
        elementResize: true,
        layoutShift: true,
      },
    );

    return () => {
      cancelled = true;
      cleanupAutoUpdate();
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
