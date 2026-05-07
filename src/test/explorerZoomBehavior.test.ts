import { describe, expect, it } from "vitest";

import {
  createExplorerZoomWheelAccumulator,
  explorerZoomBehavior,
  resetExplorerZoomWheelAccumulator,
  resolveExplorerGridSegmentProgress,
  resolveExplorerLayoutZoomWheelDeltaWithAccumulator,
} from "../config/explorerZoomBehavior";

describe("explorerZoomBehavior", () => {
  it("accumulates precision wheel deltas until they become a real zoom step", () => {
    const accumulator = createExplorerZoomWheelAccumulator();
    const event = {
      deltaMode: 0,
      deltaX: 0,
      deltaY: -0.2,
    } satisfies Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">;

    expect(
      resolveExplorerLayoutZoomWheelDeltaWithAccumulator(
        event,
        800,
        accumulator,
        0,
      ),
    ).toBe(0);
    expect(
      resolveExplorerLayoutZoomWheelDeltaWithAccumulator(
        event,
        800,
        accumulator,
        16,
      ),
    ).toBe(0);
    expect(
      resolveExplorerLayoutZoomWheelDeltaWithAccumulator(
        event,
        800,
        accumulator,
        32,
      ),
    ).toBeGreaterThan(0);
    expect(accumulator.carriedZoomDelta).toBe(0);
  });

  it("drops stale or reversed wheel residue instead of leaking it into a later gesture", () => {
    const accumulator = createExplorerZoomWheelAccumulator();
    const smallZoomIn = {
      deltaMode: 0,
      deltaX: 0,
      deltaY: -0.2,
    } satisfies Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">;
    const smallZoomOut = {
      deltaMode: 0,
      deltaX: 0,
      deltaY: 0.2,
    } satisfies Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">;

    resolveExplorerLayoutZoomWheelDeltaWithAccumulator(
      smallZoomIn,
      800,
      accumulator,
      0,
    );
    expect(accumulator.carriedZoomDelta).toBeGreaterThan(0);

    resolveExplorerLayoutZoomWheelDeltaWithAccumulator(
      smallZoomIn,
      800,
      accumulator,
      explorerZoomBehavior.wheel.microDeltaAccumulationMs + 1,
    );
    expect(accumulator.carriedZoomDelta).toBeGreaterThan(0);
    expect(accumulator.carriedZoomDelta).toBeLessThan(
      explorerZoomBehavior.wheel.minimumAbsoluteZoomDelta,
    );

    resolveExplorerLayoutZoomWheelDeltaWithAccumulator(
      smallZoomOut,
      800,
      accumulator,
      explorerZoomBehavior.wheel.microDeltaAccumulationMs + 16,
    );
    expect(accumulator.carriedZoomDelta).toBeLessThan(0);

    resetExplorerZoomWheelAccumulator(accumulator);
    expect(accumulator.carriedZoomDelta).toBe(0);
    expect(accumulator.lastEventAtMs).toBeNull();
  });

  it("eases grid-band interpolation while preserving exact anchor endpoints", () => {
    expect(resolveExplorerGridSegmentProgress(0)).toBe(0);
    expect(resolveExplorerGridSegmentProgress(1)).toBe(1);
    expect(resolveExplorerGridSegmentProgress(0.25)).toBeLessThan(0.25);
    expect(resolveExplorerGridSegmentProgress(0.75)).toBeGreaterThan(0.75);
  });
});
