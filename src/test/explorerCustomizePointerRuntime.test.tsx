import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  beginExplorerCustomizePointerSession,
  cancelExplorerCustomizePointerSession,
  resolveExplorerCustomizeDropTargetFromPoint,
  useExplorerCustomizePointerSnapshot,
} from "../components/explorer/explorerCustomizePointerRuntime";

function mockElementRect(
  element: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      new DOMRect(rect.left, rect.top, rect.width, rect.height),
  });
}

function createAmbientCustomizeChromeFixture(): {
  rowElement: HTMLDivElement;
  removeZoneElement: HTMLDivElement;
} {
  const surfaceElement = document.createElement("div");
  surfaceElement.dataset.explorerCustomizeSurfaceId = "explorerToolbar";
  mockElementRect(surfaceElement, {
    left: 0,
    top: 0,
    width: 420,
    height: 52,
  });

  const rowElement = document.createElement("div");
  rowElement.dataset.explorerCustomizeRowId = "primary";
  mockElementRect(rowElement, {
    left: 0,
    top: 0,
    width: 420,
    height: 52,
  });

  const startZone = document.createElement("div");
  startZone.dataset.explorerCustomizeZoneId = "primaryStart";
  mockElementRect(startZone, {
    left: 0,
    top: 0,
    width: 84,
    height: 52,
  });

  const centerZone = document.createElement("div");
  centerZone.dataset.explorerCustomizeZoneId = "primaryCenter";
  mockElementRect(centerZone, {
    left: 128,
    top: 0,
    width: 156,
    height: 52,
  });

  const endZone = document.createElement("div");
  endZone.dataset.explorerCustomizeZoneId = "primaryEnd";
  mockElementRect(endZone, {
    left: 324,
    top: 0,
    width: 96,
    height: 52,
  });

  const movingControl = document.createElement("div");
  movingControl.dataset.overlayExplorerControl = "navigateBack";
  mockElementRect(movingControl, {
    left: 132,
    top: 10,
    width: 64,
    height: 30,
  });

  const refreshControl = document.createElement("div");
  refreshControl.dataset.overlayExplorerControl = "refresh";
  mockElementRect(refreshControl, {
    left: 208,
    top: 10,
    width: 66,
    height: 30,
  });

  const togglePreviewControl = document.createElement("div");
  togglePreviewControl.dataset.overlayExplorerControl = "togglePreview";
  mockElementRect(togglePreviewControl, {
    left: 342,
    top: 10,
    width: 60,
    height: 30,
  });

  centerZone.append(movingControl, refreshControl);
  endZone.append(togglePreviewControl);
  rowElement.append(startZone, centerZone, endZone);
  surfaceElement.append(rowElement);
  document.body.append(surfaceElement);

  const removeZoneElement = document.createElement("div");
  removeZoneElement.dataset.explorerCustomizeRemoveZone = "true";
  mockElementRect(removeZoneElement, {
    left: 0,
    top: 120,
    width: 600,
    height: 400,
  });
  document.body.append(removeZoneElement);

  return { rowElement, removeZoneElement };
}

describe("explorerCustomizePointerRuntime", () => {
  afterEach(() => {
    cancelExplorerCustomizePointerSession();
    document.body.innerHTML = "";
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

  it("resolves an ambient row gap into a real chrome drop target without drop-strip elements", () => {
    const { rowElement, removeZoneElement } = createAmbientCustomizeChromeFixture();

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: (x: number, y: number) => {
        if (x >= 0 && x <= 420 && y >= 0 && y <= 52) {
          return rowElement;
        }
        if (x >= 0 && x <= 600 && y >= 120 && y <= 520) {
          return removeZoneElement;
        }
        return null;
      },
    });

    const dropState = resolveExplorerCustomizeDropTargetFromPoint({
      x: 310,
      y: 24,
    });

    expect(dropState).toEqual({
      dropTarget: {
        surfaceId: "explorerToolbar",
        zoneId: "primaryEnd",
        targetIndex: 0,
      },
      removeTargetActive: false,
    });
  });

  it("ignores the actively dragged placed control when resolving same-zone reorder targets", () => {
    const { rowElement, removeZoneElement } = createAmbientCustomizeChromeFixture();

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: (x: number, y: number) => {
        if (x >= 0 && x <= 420 && y >= 0 && y <= 52) {
          return rowElement;
        }
        if (x >= 0 && x <= 600 && y >= 120 && y <= 520) {
          return removeZoneElement;
        }
        return null;
      },
    });

    beginExplorerCustomizePointerSession({
      pointerId: 4,
      controlId: "navigateBack",
      sourceKind: "placed",
      startPoint: { x: 150, y: 24 },
    });

    const dropState = resolveExplorerCustomizeDropTargetFromPoint({
      x: 280,
      y: 24,
    });

    expect(dropState.dropTarget).toEqual({
      surfaceId: "explorerToolbar",
      zoneId: "primaryCenter",
      targetIndex: 1,
    });
    expect(dropState.removeTargetActive).toBe(false);
  });
});
