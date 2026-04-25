import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  beginExplorerCustomizePointerSession,
  cancelExplorerCustomizePointerSession,
  useExplorerCustomizePointerSnapshot,
} from "../components/explorer/explorerCustomizePointerRuntime";

describe("explorerCustomizePointerRuntime", () => {
  afterEach(() => {
    cancelExplorerCustomizePointerSession();
  });

  it("keeps the external-store snapshot stable while no pointer state changes", () => {
    const { result, rerender, unmount } = renderHook(() =>
      useExplorerCustomizePointerSnapshot(),
    );

    const initialSnapshot = result.current;
    rerender();

    expect(result.current).toBe(initialSnapshot);
    unmount();
  });

  it("publishes a new snapshot when a customize pointer session begins and ends", () => {
    const { result } = renderHook(() => useExplorerCustomizePointerSnapshot());

    const idleSnapshot = result.current;

    act(() => {
      beginExplorerCustomizePointerSession({
        pointerId: 7,
        controlId: "refresh",
        sourceKind: "placed",
        startPoint: { x: 24, y: 32 },
      });
    });

    expect(result.current).not.toBe(idleSnapshot);
    expect(result.current).toMatchObject({
      active: false,
      draggingControlId: "refresh",
      sourceKind: "placed",
      pointerPoint: { x: 24, y: 32 },
    });

    const activeSnapshot = result.current;

    act(() => {
      cancelExplorerCustomizePointerSession();
    });

    expect(result.current).not.toBe(activeSnapshot);
    expect(result.current).toMatchObject({
      active: false,
      draggingControlId: null,
      sourceKind: null,
      dropTarget: null,
      removeTargetActive: false,
      pointerPoint: null,
    });
  });
});
