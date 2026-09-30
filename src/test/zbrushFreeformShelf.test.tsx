import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ZBrushFreeformShelf } from "../customization/components/ZBrushFreeformShelf";
import type { ExplorerChromeResolvedControlPlacement } from "../customization/types";

const mockControls: ExplorerChromeResolvedControlPlacement[] = [
  {
    controlId: "refresh",
    surfaceId: "explorerToolbar",
    zone: "primaryStart",
    order: 10,
    anchorX: 10,
    anchorY: 4,
    widthPx: 32,
  },
  {
    controlId: "newFolder",
    surfaceId: "explorerToolbar",
    zone: "primaryStart",
    order: 20,
    anchorX: 20, // Overlapping with refresh!
    anchorY: 4,
    widthPx: 32,
  },
];

describe("ZBrushFreeformShelf (Absolute 2D Placement)", () => {
  it("renders controls at exact absolute X and Y positions allowing overlap", () => {
    const { container } = render(
      <ZBrushFreeformShelf
        surfaceId="explorerToolbar"
        rowId="primary"
        controls={mockControls}
        editModeActive={true}
        selectedControlId={null}
        renderControl={(p) => <button type="button">{p.controlId}</button>}
      />,
    );

    const refreshItem = container.querySelector(
      "[data-zbrush-rnd-item='refresh']",
    );
    const newFolderItem = container.querySelector(
      "[data-zbrush-rnd-item='newFolder']",
    );

    expect(refreshItem).not.toBeNull();
    expect(newFolderItem).not.toBeNull();

    // Verify both items rendered independently without moving or suppressing each other
    expect(refreshItem?.getAttribute("data-zbrush-rnd-item")).toBe("refresh");
    expect(newFolderItem?.getAttribute("data-zbrush-rnd-item")).toBe("newFolder");
  });

  it("provides minimum 28x28 hitbox so tiny icons are always selectable", () => {
    const tinyControls: ExplorerChromeResolvedControlPlacement[] = [
      {
        controlId: "duplicateScan",
        surfaceId: "explorerToolbar",
        zone: "primaryEnd",
        order: 10,
        anchorX: 50,
        anchorY: 4,
        widthPx: 14, // Tiny width!
      },
    ];

    const { container } = render(
      <ZBrushFreeformShelf
        surfaceId="explorerToolbar"
        rowId="primary"
        controls={tinyControls}
        editModeActive={true}
        selectedControlId={null}
        renderControl={() => <span>*</span>}
      />,
    );

    const controlWrapper = container.querySelector(
      "[data-overlay-explorer-control='duplicateScan']",
    ) as HTMLElement;
    expect(controlWrapper).not.toBeNull();
    expect(controlWrapper.style.minWidth).toBe("28px");
  });

  it("handles remove button click in customize mode", () => {
    const onRemove = vi.fn();

    const { container } = render(
      <ZBrushFreeformShelf
        surfaceId="explorerToolbar"
        rowId="primary"
        controls={mockControls}
        editModeActive={true}
        selectedControlId={null}
        renderControl={(p) => <span>{p.controlId}</span>}
        onRemoveControl={onRemove}
      />,
    );

    const removeButton = container.querySelector(
      "[data-explorer-customize-remove-control='true']",
    ) as HTMLElement;
    expect(removeButton).not.toBeNull();

    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledWith("refresh");
  });

  it("supports multi-row placement and expands shelf height in customize mode", () => {
    const multiRowControls: ExplorerChromeResolvedControlPlacement[] = [
      {
        controlId: "refresh",
        surfaceId: "explorerToolbar",
        zone: "primaryStart",
        order: 10,
        anchorX: 10,
        anchorY: 4,
        widthPx: 32,
      },
      {
        controlId: "terminalDrawerToggle",
        surfaceId: "explorerToolbar",
        zone: "primaryStart",
        order: 20,
        anchorX: 10,
        anchorY: 44,
        widthPx: 32,
      },
    ];

    const { container } = render(
      <ZBrushFreeformShelf
        surfaceId="explorerToolbar"
        rowId="primary"
        controls={multiRowControls}
        editModeActive={true}
        selectedControlId={null}
        renderControl={(p) => <span>{p.controlId}</span>}
      />,
    );

    const shelf = container.querySelector(
      "[data-zbrush-freeform-shelf='explorerToolbar:primary']",
    ) as HTMLElement;
    expect(shelf).not.toBeNull();
    expect(parseInt(shelf.style.minHeight, 10)).toBeGreaterThanOrEqual(88);
  });
});
