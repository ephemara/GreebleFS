import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const overlayScrollbarStylesSource = readFileSync(
  resolve(process.cwd(), "src/App.css"),
  "utf8",
);

describe("overlay scrollbar style contract", () => {
  it("keeps the shared scrollbar track theme-backed instead of transparent", () => {
    expect(overlayScrollbarStylesSource).not.toContain(
      "--overlay-scrollbar-track: transparent;",
    );
    expect(overlayScrollbarStylesSource).toMatch(
      /--overlay-scrollbar-track:\s*color-mix\(/,
    );
  });

  it("excludes OverlayScrollArea viewports from the generic scrollbar catch-all", () => {
    expect(overlayScrollbarStylesSource).toContain(
      ":where(:not(.overlay-scroll-area__viewport))",
    );
  });

  it("suppresses native viewport scrollbars for themed explorer scroll hosts", () => {
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area__viewport--scrollbar-themed::-webkit-scrollbar,\s*\.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar\s*{\s*width:\s*0;\s*height:\s*0;\s*display:\s*none;/s,
    );
  });

  it("defines app-owned overlay scrollbar chrome for shared scroll areas", () => {
    expect(overlayScrollbarStylesSource).toContain(
      ".overlay-scroll-area__scrollbar-thumb",
    );
    expect(overlayScrollbarStylesSource).toContain(
      ".overlay-scroll-area__scrollbar--vertical",
    );
  });
});
