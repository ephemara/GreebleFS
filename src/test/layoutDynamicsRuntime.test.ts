import { describe, expect, it } from "vitest";

import { getLayoutDynamicsPreset } from "../config/layoutDynamics";
import {
  areLayoutDynamicsNodesSettled,
  stepLayoutDynamicsSimulation,
  type LayoutDynamicsSimulationState,
} from "../runtime/layoutDynamicsRuntime";

function createSimulationState(
  overrides: Partial<LayoutDynamicsSimulationState> = {},
): LayoutDynamicsSimulationState {
  return {
    nodes: [
      {
        id: "dragged",
        bandId: "band",
        x: 0,
        y: 0,
        anchorX: 0,
        anchorY: 0,
        width: 100,
        height: 28,
        velocityX: 0,
        velocityY: 0,
      },
      {
        id: "resting",
        bandId: "band",
        x: 120,
        y: 0,
        anchorX: 120,
        anchorY: 0,
        width: 100,
        height: 28,
        velocityX: 0,
        velocityY: 0,
      },
    ],
    draggedNodeId: "dragged",
    ...overrides,
  };
}

describe("layoutDynamicsRuntime", () => {
  it("starts aura repulsion before controls overlap", () => {
    const preset = getLayoutDynamicsPreset("liquid-repulse");
    const state = createSimulationState();

    stepLayoutDynamicsSimulation({
      state,
      solver: preset,
      axisMode: "horizontal-band",
      bandBounds: [{ id: "band", x: 0, y: 0, width: 1200, height: 32 }],
      deltaTimeSeconds: 1 / 60,
    });

    expect(state.nodes[1]?.x).toBeGreaterThan(120);
  });

  it("pushes overlapping nodes apart deterministically", () => {
    const preset = getLayoutDynamicsPreset("liquid-repulse");
    const state = createSimulationState({
      nodes: [
        {
          id: "dragged",
          bandId: "band",
          x: 0,
          y: 0,
          anchorX: 0,
          anchorY: 0,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 0,
        },
        {
          id: "resting",
          bandId: "band",
          x: 80,
          y: 0,
          anchorX: 80,
          anchorY: 0,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 0,
        },
      ],
    });

    stepLayoutDynamicsSimulation({
      state,
      solver: preset,
      axisMode: "horizontal-band",
      bandBounds: [{ id: "band", x: 0, y: 0, width: 1200, height: 32 }],
      deltaTimeSeconds: 1 / 60,
    });

    expect(state.nodes[1]?.x).toBeGreaterThan(80);
  });

  it("uses a safe fallback direction when nodes fully overlap", () => {
    const preset = getLayoutDynamicsPreset("liquid-repulse");
    const state = createSimulationState({
      nodes: [
        {
          id: "dragged",
          bandId: "band",
          x: 0,
          y: 0,
          anchorX: 0,
          anchorY: 0,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 0,
        },
        {
          id: "resting",
          bandId: "band",
          x: 0,
          y: 0,
          anchorX: 0,
          anchorY: 0,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 0,
        },
      ],
    });

    stepLayoutDynamicsSimulation({
      state,
      solver: preset,
      axisMode: "free-2d",
      bandBounds: [{ id: "band", x: 0, y: 0, width: 1200, height: 240 }],
      deltaTimeSeconds: 1 / 60,
    });

    expect(Number.isFinite(state.nodes[1]?.x ?? Number.NaN)).toBe(true);
    expect(Number.isFinite(state.nodes[1]?.y ?? Number.NaN)).toBe(true);
    expect(state.nodes[1]?.y).toBeGreaterThan(0);
  });

  it("locks vertical drift for horizontal-band surfaces", () => {
    const preset = getLayoutDynamicsPreset("liquid-repulse");
    const state = createSimulationState({
      nodes: [
        {
          id: "dragged",
          bandId: "band",
          x: 0,
          y: 40,
          anchorX: 0,
          anchorY: 40,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 0,
        },
        {
          id: "resting",
          bandId: "band",
          x: 120,
          y: 12,
          anchorX: 120,
          anchorY: 12,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 6,
        },
      ],
    });

    stepLayoutDynamicsSimulation({
      state,
      solver: preset,
      axisMode: "horizontal-band",
      bandBounds: [{ id: "band", x: 0, y: 0, width: 1200, height: 32 }],
      deltaTimeSeconds: 1 / 60,
    });

    expect(state.nodes[1]?.y).toBe(4);
    expect(state.nodes[1]?.velocityY).toBe(0);
  });

  it("returns displaced nodes to their anchors without endless chatter", () => {
    const preset = getLayoutDynamicsPreset("liquid-repulse");
    const state = createSimulationState({
      nodes: [
        {
          id: "resting",
          bandId: "band",
          x: 220,
          y: 0,
          anchorX: 120,
          anchorY: 0,
          width: 100,
          height: 28,
          velocityX: 0,
          velocityY: 0,
        },
      ],
      draggedNodeId: null,
    });

    for (let frameIndex = 0; frameIndex < 180; frameIndex += 1) {
      stepLayoutDynamicsSimulation({
        state,
        solver: preset,
        axisMode: "horizontal-band",
        bandBounds: [{ id: "band", x: 0, y: 0, width: 1200, height: 32 }],
        deltaTimeSeconds: 1 / 60,
      });
    }

    expect(state.nodes[0]?.x).toBeCloseTo(120, 0);
    expect(areLayoutDynamicsNodesSettled(state.nodes, preset)).toBe(true);
  });
});
