import { describe, expect, it } from "vitest";

import type { LoadedExplorerAction } from "../config/actionPacks";
import type { LoadedExplorerWidgetDefinition } from "../config/explorerWidgets";
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
    kind: "command",
    outputTarget: "silent",
  },
  warnings: [],
};

const sampleExplorerWidget: LoadedExplorerWidgetDefinition = {
  id: "workspace-size-widget",
  title: "Workspace Size Widget",
  shortLabel: "Size",
  description: "Shows a custom size slider.",
  category: "layout-tooling",
  tags: [],
  priority: 10,
  available: true,
  chromeControlId: "widget:workspace-size-widget",
  rendererKind: "react",
  rendererEntry: "index.tsx",
  runtimeId: null,
  runtimeSurfaceId: null,
  buildTarget: null,
  surfaces: {
    chrome: ["explorerStatusBar", "workspaceHeader"],
    view: [],
    freeform: [],
  },
  sizing: {
    sizeVariants: ["compact", "regular", "wide"],
    supportsWidthPx: true,
    supportsLabelVisibility: true,
    supportsIconVisibility: false,
    defaultWidthPx: 220,
    minWidthPx: 160,
    maxWidthPx: 360,
    minInteractiveWidthPx: 150,
  },
  capabilities: {
    interactive: true,
    rangeInput: true,
    duplicateInstances: true,
    explorerMutations: false,
    workflowLaunch: true,
    panelLaunch: true,
    keyboardCapture: false,
  },
  version: 1,
  name: "Workspace Size Widget",
  directoryPath: "/explorer-widgets/workspace-size-widget",
  manifestPath: "/explorer-widgets/workspace-size-widget/explorer-widget.json",
  sourceKind: "explorer-widget-directory",
  sourceLabel: "Explorer Widgets",
  warnings: [],
  component: null,
  error: null,
};

describe("explorer customize catalog", () => {
  it("surfaces modular workspace chrome controls in the built-in catalog", () => {
    const catalog = buildExplorerCustomizeCatalog({});

    expect(
      catalog.find((entry) => entry.controlId === "workspacePaneCounts"),
    ).toMatchObject({
      category: "workspace",
      surfaces: ["workspaceHeader"],
      supportsSizeVariant: true,
    });
    expect(
      catalog.find((entry) => entry.controlId === "workspaceNewTab"),
    ).toMatchObject({
      category: "workspace",
      surfaces: ["workspaceHeader"],
      supportsSizeVariant: true,
    });
    expect(
      catalog.find((entry) => entry.controlId === "workspacePaneActionsMenu"),
    ).toMatchObject({
      category: "workspace",
      surfaces: ["workspaceHeader"],
      supportsSizeVariant: true,
    });
  });

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

  it("treats authored widgets as placeable chrome controls with sizing metadata", () => {
    const catalog = buildExplorerCustomizeCatalog({
      widgets: [sampleExplorerWidget],
    });

    const widgetEntry = catalog.find(
      (entry) => entry.controlId === sampleExplorerWidget.chromeControlId,
    );

    expect(widgetEntry).toMatchObject({
      commandId: sampleExplorerWidget.chromeControlId,
      category: "widgets",
      source: "widget",
      supportsWidthPx: true,
      supportsIconVisibility: false,
      defaultWidthPx: 220,
      minWidthPx: 160,
      maxWidthPx: 360,
    });
    expect(widgetEntry?.surfaces).toEqual([
      "explorerStatusBar",
      "workspaceHeader",
    ]);
  });
});
