import { describe, expect, it } from "vitest";

import {
  BOUNDED_CHROME_CONTAINMENT_STYLE,
  resolveConditionalBlurFilter,
  resolveInnerSurfaceBlurFilter,
} from "../config/chromeEffects";

describe("chromeEffects", () => {
  it("exports bounded containment for isolated chrome islands", () => {
    expect(BOUNDED_CHROME_CONTAINMENT_STYLE).toEqual({
      contain: "layout paint style",
      isolation: "isolate",
    });
  });

  it("caps inner-surface blur on linux", () => {
    expect(
      resolveInnerSurfaceBlurFilter({
        enabled: true,
        blurPx: 18,
        platform: "linux",
      }),
    ).toContain("blur(12px)");
  });

  it("preserves the requested inner blur on non-linux platforms", () => {
    expect(
      resolveInnerSurfaceBlurFilter({
        enabled: true,
        blurPx: 18,
        platform: "macos",
      }),
    ).toContain("blur(18px)");
    expect(
      resolveInnerSurfaceBlurFilter({
        enabled: true,
        blurPx: 14,
        platform: "windows",
      }),
    ).toContain("blur(14px)");
  });

  it("resolves disabled blur to none", () => {
    expect(
      resolveInnerSurfaceBlurFilter({
        enabled: false,
        blurPx: 18,
        platform: "linux",
      }),
    ).toBe("none");
    expect(
      resolveConditionalBlurFilter({
        enabled: false,
        blurPx: 10,
      }),
    ).toBe("none");
  });
});
