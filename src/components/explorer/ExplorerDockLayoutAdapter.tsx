import { useCallback, useMemo, type ReactNode } from "react";
import {
  Layout as FlexLayout,
  Model,
  type Action,
  type IJsonModel,
  type TabNode,
} from "flexlayout-react";
import "flexlayout-react/style/dark.css";

export interface ExplorerDockLayoutPane {
  id: string;
  title: string;
  content: ReactNode;
}

export function ExplorerDockLayoutAdapter({
  activePaneId,
  onActivePaneChange,
  onLayoutModelChange,
  panes,
}: {
  activePaneId: string;
  onActivePaneChange?: (paneId: string) => void;
  onLayoutModelChange?: (modelJson: IJsonModel) => void;
  panes: ExplorerDockLayoutPane[];
}) {
  const panesById = useMemo(
    () => new Map(panes.map((pane) => [pane.id, pane] as const)),
    [panes],
  );
  const selectedIndex = Math.max(
    0,
    panes.findIndex((pane) => pane.id === activePaneId),
  );
  const modelJson = useMemo<IJsonModel>(
    () => ({
      global: {
        enableEdgeDock: true,
        enableEdgeDockIndicators: true,
        tabEnableClose: false,
        tabEnablePopout: false,
        tabEnableRename: false,
        tabSetEnableMaximize: false,
      },
      layout: {
        type: "row",
        weight: 100,
        children: [
          {
            type: "tabset",
            id: "explorer-utility-tabset",
            selected: selectedIndex,
            children: panes.map((pane) => ({
              type: "tab",
              id: pane.id,
              name: pane.title,
              component: pane.id,
              enableClose: false,
              enableRename: false,
            })),
          },
        ],
      },
    }),
    [panes, selectedIndex],
  );
  const model = useMemo(() => Model.fromJson(modelJson), [modelJson]);
  const factory = useCallback(
    (node: TabNode) => {
      const pane = panesById.get(node.getComponent() ?? "");
      return pane?.content ?? null;
    },
    [panesById],
  );
  const handleModelChange = useCallback(
    (nextModel: Model, _action: Action) => {
      const nextJson = nextModel.toJson();
      onLayoutModelChange?.(nextJson);
      const tabset = nextJson.layout.children?.[0] as
        | {
            children?: Array<{ id?: unknown; type?: string }>;
            selected?: number;
            type?: string;
          }
        | undefined;
      if (tabset?.type !== "tabset" || !Array.isArray(tabset.children)) {
        return;
      }
      const selectedChild = tabset.children[tabset.selected ?? 0];
      if (selectedChild?.type === "tab" && typeof selectedChild.id === "string") {
        onActivePaneChange?.(selectedChild.id);
      }
    },
    [onActivePaneChange, onLayoutModelChange],
  );

  if (panes.length === 0) {
    return null;
  }

  return (
    <div
      data-overlay-explorer-dock-layout-adapter="flexlayout-react"
      style={{
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        width: "100%",
        overflow: "hidden",
        ["--color-1" as string]: "var(--overlay-explorer-panel-bg)",
        ["--color-2" as string]: "var(--overlay-explorer-preview-header-bg)",
        ["--color-3" as string]: "var(--overlay-explorer-chip-bg)",
        ["--color-4" as string]: "var(--overlay-explorer-panel-border)",
        ["--font-size" as string]: "11px",
      }}
    >
      <FlexLayout
        model={model}
        factory={factory}
        onModelChange={handleModelChange}
        realtimeResize
        supportsPopout={false}
      />
    </div>
  );
}
