import { describe, expect, it } from "vitest";

import {
  detectMobileFormFactor,
  isMobileUserAgent,
  normalizeMobileFormFactorOverride,
  resolveMobileFormFactor,
} from "../../src-mobile/mobileShared";

describe("mobile form-factor detection", () => {
  it("flags phone and tablet user agents as mobile", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
    expect(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
    expect(isMobileUserAgent("")).toBe(false);
  });

  it("keeps narrow viewports on the mobile layout", () => {
    expect(detectMobileFormFactor({ viewportWidth: 390 })).toBe("mobile");
    expect(detectMobileFormFactor({ viewportWidth: 899, pointerFine: true })).toBe("mobile");
    expect(detectMobileFormFactor({})).toBe("mobile");
  });

  it("treats a mobile UA as mobile even on wide viewports", () => {
    expect(
      detectMobileFormFactor({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        viewportWidth: 1440,
        pointerFine: true,
      }),
    ).toBe("mobile");
  });

  it("uses the desktop layout for wide fine-pointer browsers", () => {
    expect(
      detectMobileFormFactor({ viewportWidth: 1440, pointerFine: true, touchPoints: 0 }),
    ).toBe("desktop");
    expect(
      detectMobileFormFactor({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        viewportWidth: 1280,
        touchPoints: 0,
      }),
    ).toBe("desktop");
  });

  it("keeps large touch-first tablets on the mobile layout", () => {
    expect(
      detectMobileFormFactor({
        viewportWidth: 1180,
        pointerFine: false,
        pointerCoarse: true,
        touchPoints: 5,
      }),
    ).toBe("mobile");
  });

  it("honours the manual override", () => {
    expect(resolveMobileFormFactor("desktop", { viewportWidth: 390 })).toBe("desktop");
    expect(resolveMobileFormFactor("mobile", { viewportWidth: 1440, pointerFine: true })).toBe(
      "mobile",
    );
    expect(resolveMobileFormFactor("auto", { viewportWidth: 1440, pointerFine: true })).toBe(
      "desktop",
    );
    expect(normalizeMobileFormFactorOverride("bogus")).toBe("auto");
    expect(normalizeMobileFormFactorOverride(null)).toBe("auto");
  });
});
