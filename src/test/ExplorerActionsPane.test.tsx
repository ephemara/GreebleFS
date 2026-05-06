import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExplorerActionsPane } from "../components/explorer/ExplorerActionsPane";
import type { ExplorerBuiltInContextMenuCatalogItem } from "../config/explorerContextMenu";
import type {
  ExplorerRuntimeMenuCommandNode,
  ExplorerRuntimeMenuNode,
  ExplorerRuntimeMenuSubmenuNode,
} from "../components/explorer/explorerMenuRuntime";

vi.mock("@/components/AppIcons", async () =>
  vi.importActual<typeof import("lucide-react")>("lucide-react"),
);

function createBuiltInCommandDefinition(args: {
  id: string;
  title: string;
  description?: string;
  actionId?: ExplorerBuiltInContextMenuCatalogItem["execution"]["actionId"];
  iconName?: string;
}): ExplorerBuiltInContextMenuCatalogItem {
  return {
    id: args.id,
    title: args.title,
    description: args.description,
    contexts: ["background"],
    appliesTo: "any",
    group: "action",
    defaultOrder: 10,
    priority: 10,
    source: "built-in",
    iconName: args.iconName,
    tone: "safe",
    behavior: "leaf",
    execution: {
      kind: "built-in",
      actionId: args.actionId ?? "refresh",
    },
  };
}

function createCommandNode(args: {
  id: string;
  label: string;
  description?: string;
  depth?: number;
  onSelect?: () => void;
  shortcutId?: string;
}): ExplorerRuntimeMenuCommandNode {
  const command = createBuiltInCommandDefinition({
    id: `built-in.${args.id}`,
    title: args.label,
    description: args.description,
    actionId: args.id === "new-folder" ? "new-folder" : "refresh",
    iconName: args.id === "new-folder" ? "FolderPlus" : "Sparkles",
  });

  return {
    kind: "command",
    id: args.id,
    commandId: command.id,
    label: args.label,
    description: args.description,
    depth: args.depth ?? 0,
    iconName: command.iconName,
    tone: "safe",
    source: "layout",
    quickSlot: "none",
    fallbackBucket: "default",
    disabled: false,
    shortcutId: args.shortcutId,
    command,
    onSelect: args.onSelect ?? vi.fn(),
  };
}

function createSubmenuNode(args: {
  id: string;
  label: string;
  depth?: number;
  children: ExplorerRuntimeMenuNode[];
}): ExplorerRuntimeMenuSubmenuNode {
  return {
    kind: "submenu",
    id: args.id,
    label: args.label,
    depth: args.depth ?? 0,
    iconName: "FolderTree",
    tone: "safe",
    source: "layout",
    quickSlot: "none",
    fallbackBucket: "default",
    children: args.children,
  };
}

function renderRuntimeActionsPane(args?: {
  runtimeMenuNodes?: ExplorerRuntimeMenuNode[];
}) {
  const onClose = vi.fn();
  const onSelectControl = vi.fn();

  render(
    <ExplorerActionsPane
      accent="#6be675"
      border="rgba(255,255,255,0.14)"
      commandBinding="Ctrl+Shift+A"
      customizeMode={false}
      catalog={[]}
      muted="rgba(255,255,255,0.6)"
      pendingHotkeyPrompt={null}
      runtimeMenuDensity="balanced"
      runtimeMenuNodes={args?.runtimeMenuNodes ?? []}
      runtimeShowDescriptions
      selectedEntry={null}
      selectedPlacement={null}
      text="#ffffff"
      onBeginCatalogDrag={vi.fn()}
      onClose={onClose}
      onRequestHotkeyCapture={vi.fn()}
      onSelectControl={onSelectControl}
      onSetSelectedShowIcon={vi.fn()}
      onSetSelectedShowLabel={vi.fn()}
      onSetSelectedSizeVariant={vi.fn()}
      onSetSelectedWidthPx={vi.fn()}
    />,
  );

  const pane = document.querySelector(
    '[data-overlay-explorer-plane="actions"]',
  ) as HTMLElement;

  return {
    pane,
    onClose,
    onSelectControl,
  };
}

describe("ExplorerActionsPane", () => {
  it("opens submenu sidecar panels instead of flattening the runtime menu", async () => {
    const archiveIntegrityCheck = createCommandNode({
      id: "archive-integrity-check",
      label: "Archive Integrity Check",
      description: "Tests archive integrity without extracting files.",
      depth: 2,
    });
    const alphaApp = createCommandNode({
      id: "alpha-app",
      label: "Alpha App",
      description: "Opens the target with Alpha App.",
      depth: 1,
    });
    const zebraApp = createCommandNode({
      id: "zebra-app",
      label: "Zebra App",
      description: "Opens the target with Zebra App.",
      depth: 1,
    });
    const moreTools = createSubmenuNode({
      id: "submenu.more-tools",
      label: "More Tools",
      depth: 1,
      children: [archiveIntegrityCheck],
    });

    const { pane } = renderRuntimeActionsPane({
      runtimeMenuNodes: [
        createCommandNode({
          id: "batch-rename",
          label: "Batch Rename",
          description: "Rename multiple files in one pass.",
        }),
        createCommandNode({
          id: "new-folder",
          label: "New Folder",
          description: "Create a sibling folder in the current directory.",
        }),
        createSubmenuNode({
          id: "submenu.open-with",
          label: "Open With",
          children: [alphaApp, zebraApp, moreTools],
        }),
      ],
    });

    expect(screen.getByPlaceholderText(/search actions/i)).toBeInTheDocument();
    expect(
      pane.querySelectorAll("[data-overlay-explorer-actions-browser-panel]")
        .length,
    ).toBe(1);
    expect(
      pane.querySelector(
        '[data-overlay-explorer-actions-letter-rail="__root__"]',
      ),
    ).not.toBeNull();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Open With/i }));

    await waitFor(() => {
      expect(
        pane.querySelector(
          '[data-overlay-explorer-actions-inline-submenu="submenu.open-with"]',
        ),
      ).not.toBeNull();
    });
    expect(
      pane.querySelectorAll("[data-overlay-explorer-actions-browser-panel]")
        .length,
    ).toBe(1);
    expect(
      screen.getByRole("button", { name: /Alpha App/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Zebra App/i }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /More Tools/i }));

    await waitFor(() => {
      expect(
        pane.querySelector(
          '[data-overlay-explorer-actions-inline-submenu="submenu.more-tools"]',
        ),
      ).not.toBeNull();
    });
    expect(
      pane.querySelectorAll("[data-overlay-explorer-actions-browser-panel]")
        .length,
    ).toBe(1);
    expect(
      screen.getByRole("button", { name: /Archive Integrity Check/i }),
    ).toBeInTheDocument();
  });

  it("groups filtered commands A-Z and keeps submenu path context in search mode", async () => {
    const onAlphaSelect = vi.fn();
    renderRuntimeActionsPane({
      runtimeMenuNodes: [
        createCommandNode({
          id: "batch-rename",
          label: "Batch Rename",
          description: "Rename multiple files in one pass.",
        }),
        createSubmenuNode({
          id: "submenu.open-with",
          label: "Open With",
          children: [
            createCommandNode({
              id: "alpha-app",
              label: "Alpha App",
              description: "Opens the target with Alpha App.",
              depth: 1,
              onSelect: onAlphaSelect,
            }),
            createCommandNode({
              id: "zebra-app",
              label: "Zebra App",
              description: "Opens the target with Zebra App.",
              depth: 1,
            }),
          ],
        }),
      ],
    });

    fireEvent.change(screen.getByPlaceholderText(/search actions/i), {
      target: { value: "app" },
    });

    expect(
      document.querySelector(
        '[data-overlay-explorer-actions-search-results="true"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '[data-overlay-explorer-actions-letter-rail="search-results"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelectorAll(
        '[data-overlay-explorer-actions-letter-group="A"]',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll(
        '[data-overlay-explorer-actions-letter-group="Z"]',
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Open With").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Alpha App/i }));
    expect(onAlphaSelect).toHaveBeenCalledTimes(1);
  });
});
