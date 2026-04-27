import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LayoutDynamicsCanvas } from "../components/layoutDynamics/LayoutDynamicsCanvas";
import { getLayoutDynamicsPreset } from "../config/layoutDynamics";

describe("LayoutDynamicsCanvas", () => {
  it("keeps a fixed viewport height while authoring and lets the content scroll inside it", () => {
    const rendered = render(
      <LayoutDynamicsCanvas
        surfaceId="test-surface"
        axisMode="free-2d"
        solver={getLayoutDynamicsPreset("liquid-repulse")}
        intensity={1}
        authoringActive
        bands={[
          {
            id: "freeform",
            minHeightPx: 84,
          },
          {
            id: "secondary",
            minHeightPx: 36,
            style: {
              minHeight: 48,
            },
          },
        ]}
        items={[
          {
            id: "refresh",
            label: "refresh",
            bandId: "freeform",
            order: 1,
            anchorX: 24,
            anchorY: 160,
            content: <button type="button">Refresh</button>,
          },
        ]}
      />,
    );

    const surface = rendered.container.querySelector(
      '[data-layout-dynamics-surface="test-surface"]',
    ) as HTMLDivElement | null;

    expect(surface).not.toBeNull();
    expect(surface?.style.height).toBe("132px");
    expect(surface?.style.overflow).toBe("auto");
    expect(surface?.style.scrollbarGutter).toBe("stable both-edges");
  });
});
