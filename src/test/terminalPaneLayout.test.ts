import { describe, expect, it } from "vitest";

import {
  clampTerminalSplitRatio,
  collectTerminalPaneIds,
  createTerminalPaneLayout,
  getImmediatePaneSplitDirection,
  removeTerminalPaneFromLayout,
  splitTerminalPaneLayout,
  updateTerminalPaneSplitRatio,
} from "../components/terminalPaneLayout";

describe("terminalPaneLayout", () => {
  it("splits only the targeted pane instead of reflowing every leaf in the tab", () => {
    const root = createTerminalPaneLayout("overlay-0");
    const firstSplit = splitTerminalPaneLayout(
      root,
      "overlay-0",
      "columns",
      "overlay-1",
      () => "split-1",
    );
    const nestedSplit = splitTerminalPaneLayout(
      firstSplit.layout,
      "overlay-1",
      "rows",
      "overlay-2",
      () => "split-2",
    );

    expect(nestedSplit.inserted).toBe(true);
    expect(collectTerminalPaneIds(nestedSplit.layout)).toEqual([
      "overlay-0",
      "overlay-1",
      "overlay-2",
    ]);

    expect(nestedSplit.layout).toMatchObject({
      kind: "split",
      splitId: "split-1",
      direction: "columns",
      first: { kind: "leaf", paneId: "overlay-0" },
      second: {
        kind: "split",
        splitId: "split-2",
        direction: "rows",
        first: { kind: "leaf", paneId: "overlay-1" },
        second: { kind: "leaf", paneId: "overlay-2" },
      },
    });

    expect(
      getImmediatePaneSplitDirection(nestedSplit.layout, "overlay-0"),
    ).toBe("columns");
    expect(
      getImmediatePaneSplitDirection(nestedSplit.layout, "overlay-1"),
    ).toBe("rows");
    expect(
      getImmediatePaneSplitDirection(nestedSplit.layout, "overlay-2"),
    ).toBe("rows");
  });

  it("collapses the parent split and returns the surviving pane as the fallback focus target", () => {
    const root = createTerminalPaneLayout("overlay-0");
    const firstSplit = splitTerminalPaneLayout(
      root,
      "overlay-0",
      "columns",
      "overlay-1",
      () => "split-1",
    );
    const nestedSplit = splitTerminalPaneLayout(
      firstSplit.layout,
      "overlay-1",
      "rows",
      "overlay-2",
      () => "split-2",
    );

    const removal = removeTerminalPaneFromLayout(
      nestedSplit.layout,
      "overlay-1",
    );

    expect(removal.removed).toBe(true);
    expect(removal.fallbackPaneId).toBe("overlay-2");
    expect(removal.layout).toMatchObject({
      kind: "split",
      splitId: "split-1",
      direction: "columns",
      first: { kind: "leaf", paneId: "overlay-0" },
      second: { kind: "leaf", paneId: "overlay-2" },
    });
  });

  it("clamps split ratios before storing them", () => {
    const root = splitTerminalPaneLayout(
      createTerminalPaneLayout("overlay-0"),
      "overlay-0",
      "columns",
      "overlay-1",
      () => "split-1",
    ).layout;

    const nextLayout = updateTerminalPaneSplitRatio(root, "split-1", 0.98);
    expect(clampTerminalSplitRatio(0.02)).toBeGreaterThan(0.02);
    expect(nextLayout).toMatchObject({
      kind: "split",
      splitId: "split-1",
      ratio: clampTerminalSplitRatio(0.98),
    });
  });
});
