import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import {
  useUiCustomizationStore,
  ShelfDropIndicator,
  ZBrushCustomizationOverlay,
  HotkeyCaptureModal,
  IconPickerPopover,
} from "../customization";

describe("UI Customization (ZBrush-style)", () => {
  beforeEach(() => {
    useUiCustomizationStore.setState({
      isCustomizeMode: false,
      activeDrag: null,
      selectedControlId: null,
      hotkeyModal: null,
      iconPicker: null,
      undoHistory: [],
      redoHistory: [],
    });
  });

  it("manages customize mode toggle cleanly", () => {
    const store = useUiCustomizationStore.getState();
    expect(store.isCustomizeMode).toBe(false);

    store.toggleCustomizeMode();
    expect(useUiCustomizationStore.getState().isCustomizeMode).toBe(true);

    store.toggleCustomizeMode();
    expect(useUiCustomizationStore.getState().isCustomizeMode).toBe(false);
  });

  it("handles drag session lifecycle with drop targets and canvas removal", () => {
    const store = useUiCustomizationStore.getState();

    // Start drag
    store.startDrag({
      controlId: "refresh",
      sourceKind: "placed",
      sourceSurfaceId: "explorerToolbar",
      sourceZoneId: "primaryStart",
      sourceIndex: 0,
      label: "Refresh",
      iconName: "RefreshCw",
      pointerX: 100,
      pointerY: 50,
    });

    let current = useUiCustomizationStore.getState().activeDrag;
    expect(current).not.toBeNull();
    expect(current?.controlId).toBe("refresh");
    expect(current?.isRemoveTarget).toBe(false);

    // Move over shelf zone
    store.updateDragPointer(150, 50, {
      surfaceId: "explorerToolbar",
      zoneId: "primaryEnd",
      targetIndex: 2,
    }, false);

    current = useUiCustomizationStore.getState().activeDrag;
    expect(current?.dropTarget?.targetIndex).toBe(2);
    expect(current?.isRemoveTarget).toBe(false);

    // Move over canvas (remove target)
    store.updateDragPointer(150, 400, null, true);
    current = useUiCustomizationStore.getState().activeDrag;
    expect(current?.isRemoveTarget).toBe(true);

    // Finish drag
    store.finishDrag();
    expect(useUiCustomizationStore.getState().activeDrag).toBeNull();
  });

  it("supports undo and redo stacks for layout snapshots", () => {
    const store = useUiCustomizationStore.getState();

    const snapshot1 = {
      entries: [
        {
          controlId: "refresh" as const,
          surfaceId: "explorerToolbar" as const,
          zone: "primaryStart" as const,
          order: 10,
        },
      ],
    };

    const snapshot2 = {
      entries: [
        {
          controlId: "refresh" as const,
          surfaceId: "explorerToolbar" as const,
          zone: "primaryEnd" as const,
          order: 20,
        },
      ],
    };

    store.pushSnapshot(snapshot1);
    store.pushSnapshot(snapshot2);

    expect(useUiCustomizationStore.getState().undoHistory.length).toBe(2);

    const undone = store.undo();
    expect(undone).toEqual(snapshot2);
    expect(useUiCustomizationStore.getState().undoHistory.length).toBe(1);

    const redone = store.redo();
    expect(redone).toEqual(snapshot2);
    expect(useUiCustomizationStore.getState().undoHistory.length).toBe(2);
  });

  it("renders ShelfDropIndicator with glowing caret", () => {
    const { container } = render(<ShelfDropIndicator isHighlighted={true} />);
    const indicator = container.querySelector("[data-zbrush-drop-indicator='true']");
    expect(indicator).not.toBeNull();
  });

  it("renders ZBrushCustomizationOverlay when drag is active", () => {
    useUiCustomizationStore.setState({
      activeDrag: {
        active: true,
        controlId: "refresh",
        sourceKind: "placed",
        label: "Refresh Directory",
        iconName: "RefreshCw",
        pointerX: 200,
        pointerY: 100,
        dropTarget: null,
        isRemoveTarget: false,
      },
    });

    render(<ZBrushCustomizationOverlay />);
    expect(screen.getByText("Refresh Directory")).not.toBeNull();
    expect(screen.getByText("Drop into shelf slot")).not.toBeNull();
  });

  it("renders ZBrushCustomizationOverlay with removal warning when hovering canvas", () => {
    useUiCustomizationStore.setState({
      activeDrag: {
        active: true,
        controlId: "refresh",
        sourceKind: "placed",
        label: "Refresh Directory",
        iconName: "RefreshCw",
        pointerX: 200,
        pointerY: 500,
        dropTarget: null,
        isRemoveTarget: true,
      },
    });

    render(<ZBrushCustomizationOverlay />);
    expect(screen.getByText("Remove From Shelf")).not.toBeNull();
    expect(screen.getByText("Drop on canvas to delete")).not.toBeNull();
  });

  it("renders HotkeyCaptureModal and closes on ESC", () => {
    useUiCustomizationStore.setState({
      hotkeyModal: {
        active: true,
        controlId: "refresh",
        commandId: "refreshExplorer",
        label: "Refresh Explorer",
        currentBinding: "F5",
      },
    });

    render(<HotkeyCaptureModal />);
    expect(screen.getByText("ZBrush Hotkey Assignment")).not.toBeNull();
    expect(screen.getByText("Refresh Explorer")).not.toBeNull();
    expect(screen.getByText("Current: F5")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUiCustomizationStore.getState().hotkeyModal).toBeNull();
  });

  it("renders IconPickerPopover with style and glyph options", () => {
    useUiCustomizationStore.setState({
      iconPicker: {
        active: true,
        controlId: "newFolder",
        anchorRect: null,
      },
    });

    const onUpdateEntry = vitest.fn();

    render(
      <IconPickerPopover
        currentEntry={{
          controlId: "newFolder",
          surfaceId: "explorerToolbar",
          zone: "primaryStart",
          order: 10,
          showIcon: true,
          showLabel: true,
          sizeVariant: "regular",
        }}
        onUpdateEntry={onUpdateEntry}
      />,
    );

    expect(screen.getByText("Customize Button")).not.toBeNull();
    expect(screen.getByText("newFolder")).not.toBeNull();

    // Click Icon Only
    const iconOnlyButton = screen.getByText("Icon Only");
    fireEvent.click(iconOnlyButton);
    expect(onUpdateEntry).toHaveBeenCalledWith("newFolder", {
      showIcon: true,
      showLabel: false,
    });
  });
});
