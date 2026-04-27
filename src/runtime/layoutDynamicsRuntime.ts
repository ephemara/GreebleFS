import type {
  LayoutDynamicsAxisMode,
  LayoutDynamicsAuthoringSnapshot,
  LayoutDynamicsNode,
  LayoutDynamicsSolverProfile,
} from "../config/layoutDynamics";

export interface LayoutDynamicsBandBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutDynamicsSimulationNode
  extends Omit<LayoutDynamicsNode, "velocityX" | "velocityY"> {
  velocityX: number;
  velocityY: number;
}

export interface LayoutDynamicsSimulationState {
  nodes: LayoutDynamicsSimulationNode[];
  draggedNodeId: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function findBandBounds(
  bandBounds: LayoutDynamicsBandBounds[],
  bandId: string,
): LayoutDynamicsBandBounds | null {
  return bandBounds.find((band) => band.id === bandId) ?? null;
}

function resolveDirectionVector(
  deltaX: number,
  deltaY: number,
  fallbackIndex: number,
): { x: number; y: number } {
  const length = Math.hypot(deltaX, deltaY);
  if (length > 0.0001) {
    return {
      x: deltaX / length,
      y: deltaY / length,
    };
  }

  return fallbackIndex % 2 === 0
    ? { x: 1, y: 0 }
    : { x: 0, y: 1 };
}

function snapNodeBackToAnchorWhenSettled(
  node: LayoutDynamicsSimulationNode,
  axisMode: LayoutDynamicsAxisMode,
  solver: LayoutDynamicsSolverProfile,
): void {
  const displacementX = Math.abs(node.x - node.anchorX);
  const displacementY = Math.abs(node.y - node.anchorY);
  const displacement =
    axisMode === "free-2d"
      ? Math.hypot(displacementX, displacementY)
      : displacementX;
  const velocity = Math.hypot(node.velocityX, node.velocityY);
  if (displacement > 0.35 || velocity > solver.settleVelocityPx * 0.6) {
    return;
  }

  node.x = node.anchorX;
  if (axisMode === "free-2d") {
    node.y = node.anchorY;
  }
  node.velocityX = 0;
  node.velocityY = 0;
}

function constrainNodeToBounds(
  node: LayoutDynamicsSimulationNode,
  axisMode: LayoutDynamicsAxisMode,
  bandBounds: LayoutDynamicsBandBounds | null,
  maxDisplacementPx: number,
): void {
  if (axisMode === "horizontal-band") {
    node.y = node.anchorY;
    node.velocityY = 0;
  }

  node.x = clamp(
    node.x,
    node.anchorX - maxDisplacementPx,
    node.anchorX + maxDisplacementPx,
  );
  if (axisMode === "free-2d") {
    node.y = clamp(
      node.y,
      node.anchorY - maxDisplacementPx,
      node.anchorY + maxDisplacementPx,
    );
  }

  if (!bandBounds) {
    return;
  }

  const maxX = Math.max(bandBounds.x, bandBounds.x + bandBounds.width - node.width);
  node.x = clamp(node.x, bandBounds.x, maxX);

  if (axisMode === "free-2d") {
    const maxY = Math.max(
      bandBounds.y,
      bandBounds.y + bandBounds.height - node.height,
    );
    node.y = clamp(node.y, bandBounds.y, maxY);
  } else {
    node.y = clamp(
      node.anchorY,
      bandBounds.y,
      Math.max(bandBounds.y, bandBounds.y + bandBounds.height - node.height),
    );
  }
}

export function stepLayoutDynamicsSimulation(args: {
  state: LayoutDynamicsSimulationState;
  solver: LayoutDynamicsSolverProfile;
  axisMode: LayoutDynamicsAxisMode;
  bandBounds: LayoutDynamicsBandBounds[];
  deltaTimeSeconds: number;
  intensity?: number;
}): LayoutDynamicsSimulationState {
  const deltaTimeSeconds = clamp(args.deltaTimeSeconds, 1 / 240, 1 / 20);
  const intensity = clamp(args.intensity ?? 1, 0, 2);
  const draggedNode = args.state.draggedNodeId
    ? args.state.nodes.find((node) => node.id === args.state.draggedNodeId) ?? null
    : null;

  for (const [nodeIndex, node] of args.state.nodes.entries()) {
    if (node.id === args.state.draggedNodeId) {
      node.velocityX = 0;
      node.velocityY = 0;
      continue;
    }

    let forceX =
      (node.anchorX - node.x) * args.solver.springStiffness * intensity -
      node.velocityX * args.solver.damping;
    let forceY =
      (node.anchorY - node.y) * args.solver.springStiffness * intensity -
      node.velocityY * args.solver.damping;

    if (draggedNode && draggedNode.bandId === node.bandId) {
      const draggedCenterX = draggedNode.x + draggedNode.width / 2;
      const draggedCenterY = draggedNode.y + draggedNode.height / 2;
      const restingCenterX = node.x + node.width / 2;
      const restingCenterY = node.y + node.height / 2;
      const deltaX = restingCenterX - draggedCenterX;
      const deltaY = restingCenterY - draggedCenterY;
      const distance = Math.hypot(deltaX, deltaY);
      const direction = resolveDirectionVector(deltaX, deltaY, nodeIndex);

      if (distance < args.solver.auraRadiusPx) {
        const auraFalloff =
          1 - clamp(distance / Math.max(1, args.solver.auraRadiusPx), 0, 1);
        const auraForce =
          args.solver.auraStrength * auraFalloff * auraFalloff * intensity;
        forceX += direction.x * auraForce;
        forceY += direction.y * auraForce;
      }

      const minSeparationX = draggedNode.width / 2 + node.width / 2;
      const minSeparationY = draggedNode.height / 2 + node.height / 2;
      const overlapX = minSeparationX - Math.abs(deltaX);
      const overlapY = minSeparationY - Math.abs(deltaY);

      if (overlapX > 0 && overlapY > 0) {
        const collisionForce =
          Math.max(overlapX, overlapY) *
          args.solver.collisionStrength *
          intensity;
        forceX += direction.x * collisionForce;
        forceY += direction.y * collisionForce;
      }
    }

    node.velocityX = clamp(
      node.velocityX + forceX * deltaTimeSeconds,
      -args.solver.maxVelocityPx,
      args.solver.maxVelocityPx,
    );
    node.velocityY = clamp(
      node.velocityY + forceY * deltaTimeSeconds,
      -args.solver.maxVelocityPx,
      args.solver.maxVelocityPx,
    );

    node.x += node.velocityX * deltaTimeSeconds;
    node.y += node.velocityY * deltaTimeSeconds;

    constrainNodeToBounds(
      node,
      args.axisMode,
      findBandBounds(args.bandBounds, node.bandId),
      args.solver.maxDisplacementPx,
    );
    if (!draggedNode) {
      snapNodeBackToAnchorWhenSettled(node, args.axisMode, args.solver);
    }
  }

  return args.state;
}

export function areLayoutDynamicsNodesSettled(
  nodes: LayoutDynamicsSimulationNode[],
  solver: LayoutDynamicsSolverProfile,
): boolean {
  return nodes.every((node) => {
    const displacement = Math.hypot(node.x - node.anchorX, node.y - node.anchorY);
    const velocity = Math.hypot(node.velocityX, node.velocityY);
    return displacement < 0.75 && velocity < solver.settleVelocityPx;
  });
}

export function resolveHorizontalBandLayout(args: {
  nodes: Array<{
    id: string;
    width: number;
    x: number;
    y?: number;
    hidden?: boolean;
  }>;
  bandBounds: LayoutDynamicsBandBounds | null;
  gapPx: number;
}): LayoutDynamicsAuthoringSnapshot {
  const visibleNodes = args.nodes
    .filter((node) => node.hidden !== true)
    .sort((left, right) => {
      if (left.x !== right.x) {
        return left.x - right.x;
      }
      return left.id.localeCompare(right.id);
    });

  const bandX = args.bandBounds?.x ?? 0;
  const bandY = args.bandBounds?.y ?? 0;
  const bandWidth = args.bandBounds?.width ?? Number.POSITIVE_INFINITY;
  let cursorX = bandX;

  return {
    entries: visibleNodes.map((node) => {
      const clampedRequestedX = clamp(
        node.x,
        bandX,
        Number.isFinite(bandWidth)
          ? Math.max(bandX, bandX + bandWidth - node.width)
          : node.x,
      );
      const nextX = Math.max(cursorX, clampedRequestedX);
      cursorX = nextX + node.width + args.gapPx;
      return {
        nodeId: node.id,
        bandId: args.bandBounds?.id ?? "band",
        x: Math.round(nextX - bandX),
        y: Math.round((node.y ?? bandY) - bandY),
      };
    }),
  };
}
