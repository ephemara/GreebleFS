import { describe, expect, it } from "vitest";

import {
  buildExplorerExecutionContextSnapshot,
  type ExplorerExecutionContextEntryLike,
} from "../runtime/explorerExtensionContext";

function createContextEntry(
  path: string,
  name = path.split(/[\\/]/).pop() ?? path,
): ExplorerExecutionContextEntryLike {
  return {
    path,
    name,
    extension: path.includes(".") ? (path.split(".").pop() ?? "") : "",
    is_dir: false,
  };
}

function createEntryThatFailsIfScanned(): ExplorerExecutionContextEntryLike {
  return Object.defineProperties({} as ExplorerExecutionContextEntryLike, {
    path: {
      get() {
        throw new Error("entry should not be scanned");
      },
    },
    name: {
      get() {
        throw new Error("entry should not be scanned");
      },
    },
    extension: {
      get() {
        throw new Error("entry should not be scanned");
      },
    },
    is_dir: {
      get() {
        throw new Error("entry should not be scanned");
      },
    },
  });
}

describe("explorer execution context", () => {
  it("does not scan huge directory entries just to publish an active directory snapshot", () => {
    expect(() =>
      buildExplorerExecutionContextSnapshot({
        paneId: "pane-a",
        workspaceTabId: "tab-a",
        activeDirectory: "C:\\workspace",
        cwd: "C:\\workspace",
        drives: [],
        entries: [createEntryThatFailsIfScanned()],
        selectedPaths: [],
        previewSession: null,
      }),
    ).not.toThrow();
  });

  it("stops scanning entries once selected context rows are found", () => {
    const snapshot = buildExplorerExecutionContextSnapshot({
      paneId: "pane-a",
      workspaceTabId: "tab-a",
      activeDirectory: "C:\\workspace",
      cwd: "C:\\workspace",
      drives: [],
      entries: [
        createContextEntry("C:\\workspace\\selected.txt"),
        createEntryThatFailsIfScanned(),
      ],
      selectedPaths: ["C:\\workspace\\selected.txt"],
      previewSession: null,
    });

    expect(snapshot.selectedEntries).toHaveLength(1);
    expect(snapshot.focusedEntry?.path).toBe("C:\\workspace\\selected.txt");
  });
});
