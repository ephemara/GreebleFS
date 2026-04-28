import { fireEvent, render, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { describe, expect, it } from "vitest";
import { ExplorerChromeSurface } from "../components/explorer/ExplorerChromeSurface";
import {
  resolveExplorerChromeSurfaceLayout,
  type ExplorerChromeControlDefinition,
  type ExplorerChromeResolvedSurface,
} from "../config/explorerChromeLayouts";

const toolbarSurface: ExplorerChromeResolvedSurface = {
  surfaceId: "explorerToolbar",
  rows: [
    {
      id: "primary",
      zones: [
        {
          id: "primaryStart",
          controls: [
            {
              controlId: "refresh",
              surfaceId: "explorerToolbar",
              zone: "primaryStart",
              order: 10,
            },
          ],
        },
      ],
    },
  ],
  visibleControlIds: ["refresh"],
};

const customizeSurface: ExplorerChromeResolvedSurface = {
  surfaceId: "explorerToolbar",
  rows: [
    {
      id: "primary",
      zones: [
        {
          id: "primaryStart",
          controls: [
            {
              controlId: "customizeModeToggle",
              surfaceId: "explorerToolbar",
              zone: "primaryStart",
              order: 10,
            },
          ],
        },
      ],
    },
  ],
  visibleControlIds: ["customizeModeToggle"],
};

describe("ExplorerChromeSurface", () => {
  it("renders shipped freeform anchors from canonical chrome placements", async () => {
    const controlDefinitions: ExplorerChromeControlDefinition[] = [
      {
        id: "focusAddressBar",
        label: "Focus Address Bar",
        surfaces: ["explorerTopbar"],
      },
    ];
    const resolvedSurface = resolveExplorerChromeSurfaceLayout({
      layoutId: "default",
      surfaceId: "explorerTopbar",
      controlDefinitions,
    });
    const focusAddressBarPlacement =
      resolvedSurface.rows[0]?.zones
        .flatMap((zone) => zone.controls)
        .find((control) => control.controlId === "focusAddressBar") ?? null;

    expect(focusAddressBarPlacement).toMatchObject({
      bandId: "primary",
      anchorX: 44,
      anchorY: 0,
      widthPx: 520,
      showLabel: true,
      showIcon: true,
    });

    const rendered = render(
      <ExplorerChromeSurface
        surface={resolvedSurface}
        renderControl={() => <button type="button">Address</button>}
        dynamicCanvasMinHeightPx={64}
        layoutDynamics={{
          enabled: true,
          axisMode: "free-2d",
          solver: {
            id: "test-solver",
            label: "Test Solver",
            description: "Test",
            groupId: "system",
            auraRadiusPx: 140,
            auraStrength: 900,
            collisionStrength: 30,
            springStiffness: 15,
            damping: 8,
            maxDisplacementPx: 240,
            maxVelocityPx: 1800,
            settleVelocityPx: 12,
            gapPx: 12,
          },
          intensity: 1,
        }}
        editMode={{
          active: true,
          draggingControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
        }}
      />,
    );

    const control = rendered.container.querySelector(
      "[data-overlay-explorer-control='focusAddressBar']",
    ) as HTMLElement | null;
    expect(control).not.toBeNull();
    expect(control?.style.width).toBe("520px");
    expect(
      rendered.container.querySelector(
        '[data-layout-dynamics-surface="explorerTopbar"]',
      ),
    ).not.toBeNull();
  });

  it("registers a customize surface once when parent rerenders recreate the edit-mode object", async () => {
    const registerCalls: string[] = [];
    const unregisterCalls: string[] = [];

    function Harness() {
      const [, setRevision] = useState(0);
      const registerSurface = useCallback(
        (surface: ExplorerChromeResolvedSurface) => {
          registerCalls.push(surface.surfaceId);
          if (registerCalls.length < 3) {
            setRevision((current) => current + 1);
          }
        },
        [],
      );
      const unregisterSurface = useCallback((surfaceId: string) => {
        unregisterCalls.push(surfaceId);
      }, []);

      return (
        <ExplorerChromeSurface
          surface={toolbarSurface}
          renderControl={() => <button type="button">Refresh</button>}
          editMode={{
            active: true,
            draggingControlId: null,
            onRegisterSurface: registerSurface,
            onUnregisterSurface: unregisterSurface,
            onDragStart: () => undefined,
            onDragEnd: () => undefined,
            onMoveControl: () => undefined,
          }}
        />
      );
    }

    const rendered = render(<Harness />);

    await waitFor(() => {
      expect(registerCalls).toEqual(["explorerToolbar"]);
    });
    expect(unregisterCalls).toHaveLength(0);

    rendered.unmount();

    await waitFor(() => {
      expect(unregisterCalls).toEqual(["explorerToolbar"]);
    });
  });

  it("requests hotkey capture on Ctrl+Alt+click even when customize mode is off", () => {
    const requestedHotkeys: string[] = [];
    const selectedControls: Array<string | null> = [];

    const rendered = render(
      <ExplorerChromeSurface
        surface={toolbarSurface}
        renderControl={() => <button type="button">Refresh</button>}
        editMode={{
          active: false,
          draggingControlId: null,
          pendingHotkeyControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
          onRequestHotkeyCapture: (controlId) => {
            requestedHotkeys.push(controlId);
          },
          onSetSelectedControl: (controlId) => {
            selectedControls.push(controlId);
          },
        }}
      />,
    );

    fireEvent.click(rendered.getByText("Refresh"), {
      ctrlKey: true,
      altKey: true,
    });

    expect(requestedHotkeys).toEqual(["refresh"]);
    expect(selectedControls).toEqual(["refresh"]);
  });

  it("starts pointer drag without modifier keys while customize mode is on", () => {
    const startedPointerDrags: string[] = [];
    const selectedControls: Array<string | null> = [];

    const rendered = render(
      <ExplorerChromeSurface
        surface={toolbarSurface}
        renderControl={() => <button type="button">Refresh</button>}
        editMode={{
          active: true,
          draggingControlId: null,
          pendingHotkeyControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
          onBeginPointerDrag: ({ controlId }) => {
            startedPointerDrags.push(controlId);
          },
          onSetSelectedControl: (controlId) => {
            selectedControls.push(controlId);
          },
        }}
      />,
    );

    fireEvent.pointerDown(rendered.getByText("Refresh"), {
      button: 0,
      pointerId: 17,
      clientX: 120,
      clientY: 48,
    });

    expect(startedPointerDrags).toEqual(["refresh"]);
    expect(selectedControls).toEqual(["refresh"]);
  });

  it("requests hotkey capture on Ctrl+Alt+click while customize mode is on", () => {
    const requestedHotkeys: string[] = [];
    const selectedControls: Array<string | null> = [];

    const rendered = render(
      <ExplorerChromeSurface
        surface={toolbarSurface}
        renderControl={() => <button type="button">Refresh</button>}
        editMode={{
          active: true,
          draggingControlId: null,
          pendingHotkeyControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
          onRequestHotkeyCapture: (controlId) => {
            requestedHotkeys.push(controlId);
          },
          onSetSelectedControl: (controlId) => {
            selectedControls.push(controlId);
          },
        }}
      />,
    );

    fireEvent.click(rendered.getByText("Refresh"), {
      ctrlKey: true,
      altKey: true,
    });

    expect(requestedHotkeys).toEqual(["refresh"]);
    expect(selectedControls).toEqual(["refresh"]);
  });

  it("removes a placed control from the layout when its hover X is clicked", () => {
    const removedControls: string[] = [];

    const rendered = render(
      <ExplorerChromeSurface
        surface={toolbarSurface}
        renderControl={() => <button type="button">Refresh</button>}
        editMode={{
          active: true,
          draggingControlId: null,
          pendingHotkeyControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
          onRemoveControl: (controlId) => {
            removedControls.push(controlId);
          },
        }}
      />,
    );

    const control = rendered.container.querySelector(
      "[data-overlay-explorer-control='refresh']",
    ) as HTMLElement;
    fireEvent.mouseEnter(control);
    fireEvent.click(rendered.getByLabelText("Remove refresh from layout"));

    expect(removedControls).toEqual(["refresh"]);
  });

  it("renders width-constrained chrome controls from placement widthPx overrides", () => {
    const rendered = render(
      <ExplorerChromeSurface
        surface={{
          ...toolbarSurface,
          rows: [
            {
              ...toolbarSurface.rows[0]!,
              zones: [
                {
                  ...toolbarSurface.rows[0]!.zones[0]!,
                  controls: [
                    {
                      ...toolbarSurface.rows[0]!.zones[0]!.controls[0]!,
                      widthPx: 240,
                    },
                  ],
                },
              ],
            },
          ],
        }}
        renderControl={() => <button type="button">Refresh</button>}
      />,
    );

    const control = rendered.container.querySelector(
      "[data-overlay-explorer-control='refresh']",
    ) as HTMLElement | null;
    expect(control?.style.width).toBe("240px");
    expect(control?.style.maxWidth).toBe("240px");
  });

  it("preserves authored free-space offsets on rendered chrome controls", () => {
    const rendered = render(
      <ExplorerChromeSurface
        surface={{
          ...toolbarSurface,
          rows: [
            {
              ...toolbarSurface.rows[0]!,
              zones: [
                {
                  ...toolbarSurface.rows[0]!.zones[0]!,
                  controls: [
                    {
                      ...toolbarSurface.rows[0]!.zones[0]!.controls[0]!,
                      offsetPx: 48,
                    },
                  ],
                },
              ],
            },
          ],
        }}
        renderControl={() => <button type="button">Refresh</button>}
      />,
    );

    const control = rendered.container.querySelector(
      "[data-overlay-explorer-control='refresh']",
    ) as HTMLElement | null;
    expect(control?.style.marginLeft).toBe("48px");
  });

  it("shows a resize affordance for resizable controls and forwards pointer resize requests", () => {
    const resizeRequests: Array<{
      controlId: string;
      pointerId: number;
      startPoint: { x: number; y: number };
    }> = [];

    const rendered = render(
      <ExplorerChromeSurface
        surface={{
          ...toolbarSurface,
          rows: [
            {
              ...toolbarSurface.rows[0]!,
              zones: [
                {
                  ...toolbarSurface.rows[0]!.zones[0]!,
                  controls: [
                    {
                      ...toolbarSurface.rows[0]!.zones[0]!.controls[0]!,
                      widthPx: 260,
                    },
                  ],
                },
              ],
            },
          ],
        }}
        renderControl={() => <button type="button">Refresh</button>}
        editMode={{
          active: true,
          draggingControlId: null,
          resizingControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
          isControlResizable: () => true,
          onBeginPointerResize: (args) => {
            resizeRequests.push({
              controlId: args.controlId,
              pointerId: args.pointerId,
              startPoint: args.startPoint,
            });
          },
        }}
      />,
    );

    const resizeHandle = rendered.getByLabelText("Resize refresh");
    fireEvent.pointerDown(resizeHandle, {
      button: 0,
      pointerId: 41,
      clientX: 320,
      clientY: 28,
    });

    expect(resizeRequests).toEqual([
      {
        controlId: "refresh",
        pointerId: 41,
        startPoint: { x: 320, y: 28 },
      },
    ]);
  });

  it("suppresses live customize control clicks while customize mode is on", () => {
    const liveClicks: string[] = [];

    const rendered = render(
      <ExplorerChromeSurface
        surface={customizeSurface}
        renderControl={() => (
          <button
            type="button"
            data-explorer-customize-live-control="true"
            onClick={() => {
              liveClicks.push("customizeModeToggle");
            }}
          >
            Customize
          </button>
        )}
        editMode={{
          active: true,
          draggingControlId: null,
          pendingHotkeyControlId: null,
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
        }}
      />,
    );

    fireEvent.click(rendered.getByText("Customize"));

    expect(liveClicks).toEqual([]);
  });

  it("renders a single inline insertion ghost instead of dedicated drop-strip rails", () => {
    const rendered = render(
      <ExplorerChromeSurface
        surface={toolbarSurface}
        renderControl={() => <button type="button">Refresh</button>}
        editMode={{
          active: true,
          draggingControlId: "refresh",
          highlightedDropTarget: {
            surfaceId: "explorerToolbar",
            zoneId: "primaryStart",
            targetIndex: 1,
            offsetPx: 0,
          },
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
        }}
      />,
    );

    expect(
      rendered.container.querySelectorAll(
        "[data-explorer-customize-insertion-ghost='true']",
      ),
    ).toHaveLength(1);
    expect(
      rendered.container.querySelector(
        "[data-explorer-customize-drop-surface-id]",
      ),
    ).toBeNull();
  });

  it("switches adopted explorer surfaces into the layout-dynamics canvas during customize mode even before anchors exist", () => {
    const rendered = render(
      <ExplorerChromeSurface
        surface={toolbarSurface}
        renderControl={() => <button type="button">Refresh</button>}
        layoutDynamics={{
          enabled: true,
          axisMode: "horizontal-band",
          solver: {
            id: "test-solver",
            label: "Test Solver",
            description: "Test",
            groupId: "system",
            auraRadiusPx: 140,
            auraStrength: 900,
            collisionStrength: 30,
            springStiffness: 15,
            damping: 8,
            maxDisplacementPx: 240,
            maxVelocityPx: 1800,
            settleVelocityPx: 12,
            gapPx: 12,
          },
          intensity: 1,
        }}
        editMode={{
          active: true,
          draggingControlId: null,
          pointerSourceKind: "placed",
          highlightedDropTarget: {
            surfaceId: "explorerToolbar",
            zoneId: "primaryStart",
            targetIndex: 1,
            offsetPx: 0,
          },
          onDragStart: () => undefined,
          onDragEnd: () => undefined,
          onMoveControl: () => undefined,
        }}
      />,
    );

    expect(
      rendered.container.querySelector(
        '[data-layout-dynamics-surface="explorerToolbar"]',
      ),
    ).not.toBeNull();
    expect(
      rendered.container.querySelectorAll(
        "[data-explorer-customize-insertion-ghost='true']",
      ),
    ).toHaveLength(0);
  });
});
