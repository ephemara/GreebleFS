import { describe, expect, it } from "vitest";

import type { LoadedExplorerAction } from "../config/actionPacks";
import {
  buildExplorerCustomizeCatalog,
  toExplorerActionChromeControlId,
} from "../config/explorerCustomizeCatalog";

const sampleExplorerAction: LoadedExplorerAction = {
  id: "workspace.sample-action",
  actionId: "sample-action",
  packId: "workspace-pack",
  packName: "Workspace Pack",
  version: 1,
  title: "Sample Workspace Action",
  description: "A sample action for workspace header placement tests.",
  tags: [],
  directoryPath: "/actions/workspace-pack/sample-action",
  manifestPath: "/actions/workspace-pack/sample-action/action.json",
  sourceKind: "action-pack-directory",
  sourceLabel: "Actions",
  sourceBadgeLabel: "ACTION",
  contexts: ["background", "entry", "multi-select"],
  appliesTo: "any",
  selection: {
    minCount: 0,
    allowFiles: true,
    allowDirectories: true,
    extensions: [],
  },
  execution: {
    runner: "shell",
    entry: "echo",
    args: ["hello"],
    env: {},
  },
  presentation: {
    outputTarget: "silent",
  },
  warnings: [],
};

describe("explorer customize catalog", () => {
  it("treats authored actions as workspace-header placeables", () => {
    const catalog = buildExplorerCustomizeCatalog({
      actions: [sampleExplorerAction],
    });

    const actionEntry = catalog.find(
      (entry) =>
        entry.controlId ===
        toExplorerActionChromeControlId(sampleExplorerAction.id),
    );

    expect(actionEntry).toBeTruthy();
    expect(actionEntry?.surfaces).toContain("workspaceHeader");
  });
});
