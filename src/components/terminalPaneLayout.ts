export type TerminalSplitDirection = "columns" | "rows";

export interface TerminalPaneLeafNode {
  kind: "leaf";
  paneId: string;
}

export interface TerminalPaneSplitNode {
  kind: "split";
  splitId: string;
  direction: TerminalSplitDirection;
  ratio: number;
  first: TerminalPaneLayoutNode;
  second: TerminalPaneLayoutNode;
}

export type TerminalPaneLayoutNode =
  | TerminalPaneLeafNode
  | TerminalPaneSplitNode;

export interface TerminalPaneSplitResult {
  layout: TerminalPaneLayoutNode;
  inserted: boolean;
}

export interface TerminalPaneRemoveResult {
  layout: TerminalPaneLayoutNode | null;
  removed: boolean;
  fallbackPaneId: string | null;
}

export interface TerminalPaneFrame {
  paneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TerminalPaneSplitHandle {
  splitId: string;
  direction: TerminalSplitDirection;
  x: number;
  y: number;
  width: number;
  height: number;
  containerX: number;
  containerY: number;
  containerWidth: number;
  containerHeight: number;
}

export interface TerminalPaneGeometry {
  frames: TerminalPaneFrame[];
  handles: TerminalPaneSplitHandle[];
}

const MIN_SPLIT_RATIO = 0.18;
const MAX_SPLIT_RATIO = 0.82;

export function clampTerminalSplitRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

export function createTerminalPaneLayout(
  paneId: string,
): TerminalPaneLayoutNode {
  return {
    kind: "leaf",
    paneId,
  };
}

export function collectTerminalPaneIds(
  layout: TerminalPaneLayoutNode,
): string[] {
  if (layout.kind === "leaf") {
    return [layout.paneId];
  }
  return [
    ...collectTerminalPaneIds(layout.first),
    ...collectTerminalPaneIds(layout.second),
  ];
}

export function countTerminalPanes(layout: TerminalPaneLayoutNode): number {
  if (layout.kind === "leaf") {
    return 1;
  }
  return countTerminalPanes(layout.first) + countTerminalPanes(layout.second);
}

export function describeTerminalPaneLayout(
  layout: TerminalPaneLayoutNode,
): string {
  if (layout.kind === "leaf") {
    return "single pane";
  }

  const directionLabel = layout.direction === "columns" ? "columns" : "rows";
  return `${directionLabel} split · ${countTerminalPanes(layout)} panes`;
}

export function collectTerminalPaneGeometry(
  layout: TerminalPaneLayoutNode,
  box: { x: number; y: number; width: number; height: number } = {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  },
): TerminalPaneGeometry {
  if (layout.kind === "leaf") {
    return {
      frames: [
        {
          paneId: layout.paneId,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        },
      ],
      handles: [],
    };
  }

  if (layout.direction === "columns") {
    const firstWidth = box.width * layout.ratio;
    const secondWidth = box.width - firstWidth;
    const firstBox = {
      x: box.x,
      y: box.y,
      width: firstWidth,
      height: box.height,
    };
    const secondBox = {
      x: box.x + firstWidth,
      y: box.y,
      width: secondWidth,
      height: box.height,
    };
    const firstGeometry = collectTerminalPaneGeometry(layout.first, firstBox);
    const secondGeometry = collectTerminalPaneGeometry(
      layout.second,
      secondBox,
    );

    return {
      frames: [...firstGeometry.frames, ...secondGeometry.frames],
      handles: [
        ...firstGeometry.handles,
        {
          splitId: layout.splitId,
          direction: layout.direction,
          x: box.x + firstWidth,
          y: box.y,
          width: 0,
          height: box.height,
          containerX: box.x,
          containerY: box.y,
          containerWidth: box.width,
          containerHeight: box.height,
        },
        ...secondGeometry.handles,
      ],
    };
  }

  const firstHeight = box.height * layout.ratio;
  const secondHeight = box.height - firstHeight;
  const firstBox = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: firstHeight,
  };
  const secondBox = {
    x: box.x,
    y: box.y + firstHeight,
    width: box.width,
    height: secondHeight,
  };
  const firstGeometry = collectTerminalPaneGeometry(layout.first, firstBox);
  const secondGeometry = collectTerminalPaneGeometry(layout.second, secondBox);

  return {
    frames: [...firstGeometry.frames, ...secondGeometry.frames],
    handles: [
      ...firstGeometry.handles,
      {
        splitId: layout.splitId,
        direction: layout.direction,
        x: box.x,
        y: box.y + firstHeight,
        width: box.width,
        height: 0,
        containerX: box.x,
        containerY: box.y,
        containerWidth: box.width,
        containerHeight: box.height,
      },
      ...secondGeometry.handles,
    ],
  };
}

export function getImmediatePaneSplitDirection(
  layout: TerminalPaneLayoutNode,
  paneId: string,
  parentDirection: TerminalSplitDirection | null = null,
): TerminalSplitDirection | null {
  if (layout.kind === "leaf") {
    return layout.paneId === paneId ? parentDirection : null;
  }

  return (
    getImmediatePaneSplitDirection(layout.first, paneId, layout.direction) ??
    getImmediatePaneSplitDirection(layout.second, paneId, layout.direction)
  );
}

export function splitTerminalPaneLayout(
  layout: TerminalPaneLayoutNode,
  targetPaneId: string,
  direction: TerminalSplitDirection,
  newPaneId: string,
  createSplitId: () => string,
): TerminalPaneSplitResult {
  if (layout.kind === "leaf") {
    if (layout.paneId !== targetPaneId) {
      return { layout, inserted: false };
    }

    return {
      inserted: true,
      layout: {
        kind: "split",
        splitId: createSplitId(),
        direction,
        ratio: 0.5,
        first: layout,
        second: createTerminalPaneLayout(newPaneId),
      },
    };
  }

  const firstResult = splitTerminalPaneLayout(
    layout.first,
    targetPaneId,
    direction,
    newPaneId,
    createSplitId,
  );
  if (firstResult.inserted) {
    return {
      inserted: true,
      layout: {
        ...layout,
        first: firstResult.layout,
      },
    };
  }

  const secondResult = splitTerminalPaneLayout(
    layout.second,
    targetPaneId,
    direction,
    newPaneId,
    createSplitId,
  );
  if (secondResult.inserted) {
    return {
      inserted: true,
      layout: {
        ...layout,
        second: secondResult.layout,
      },
    };
  }

  return { layout, inserted: false };
}

export function updateTerminalPaneSplitRatio(
  layout: TerminalPaneLayoutNode,
  splitId: string,
  ratio: number,
): TerminalPaneLayoutNode {
  if (layout.kind === "leaf") {
    return layout;
  }

  if (layout.splitId === splitId) {
    return {
      ...layout,
      ratio: clampTerminalSplitRatio(ratio),
    };
  }

  return {
    ...layout,
    first: updateTerminalPaneSplitRatio(layout.first, splitId, ratio),
    second: updateTerminalPaneSplitRatio(layout.second, splitId, ratio),
  };
}

export function removeTerminalPaneFromLayout(
  layout: TerminalPaneLayoutNode,
  targetPaneId: string,
): TerminalPaneRemoveResult {
  if (layout.kind === "leaf") {
    if (layout.paneId !== targetPaneId) {
      return {
        layout,
        removed: false,
        fallbackPaneId: layout.paneId,
      };
    }

    return {
      layout: null,
      removed: true,
      fallbackPaneId: null,
    };
  }

  const firstResult = removeTerminalPaneFromLayout(layout.first, targetPaneId);
  if (firstResult.removed) {
    if (firstResult.layout === null) {
      const fallbackPaneId = collectTerminalPaneIds(layout.second)[0] ?? null;
      return {
        layout: layout.second,
        removed: true,
        fallbackPaneId,
      };
    }

    return {
      layout: {
        ...layout,
        first: firstResult.layout,
      },
      removed: true,
      fallbackPaneId: firstResult.fallbackPaneId,
    };
  }

  const secondResult = removeTerminalPaneFromLayout(
    layout.second,
    targetPaneId,
  );
  if (secondResult.removed) {
    if (secondResult.layout === null) {
      const fallbackPaneId = collectTerminalPaneIds(layout.first)[0] ?? null;
      return {
        layout: layout.first,
        removed: true,
        fallbackPaneId,
      };
    }

    return {
      layout: {
        ...layout,
        second: secondResult.layout,
      },
      removed: true,
      fallbackPaneId: secondResult.fallbackPaneId,
    };
  }

  return {
    layout,
    removed: false,
    fallbackPaneId: null,
  };
}
