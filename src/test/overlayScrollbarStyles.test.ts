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

  it("applies the native scrollbar contract to the scope element itself", () => {
    expect(overlayScrollbarStylesSource).toContain(
      ".overlay-scrollbar-scope::-webkit-scrollbar",
    );
    expect(overlayScrollbarStylesSource).toContain(
      "color-scheme: var(--overlay-color-scheme)",
    );
    expect(overlayScrollbarStylesSource).toContain(
      "--overlay-color-scheme: dark;",
    );
    expect(overlayScrollbarStylesSource).toContain(
      "--overlay-scrollbar-file-list-size: 12px;",
    );
    expect(overlayScrollbarStylesSource).toContain(
      "--overlay-scrollbar-radius: 999px;",
    );
  });

  it("keeps a reusable native scrollbar utility for escaped scroll hosts", () => {
    expect(overlayScrollbarStylesSource).toContain(".overlay-native-scrollbar");
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-native-scrollbar,\s*\.overlay-scrollbar-scope,/s,
    );
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-native-scrollbar::-webkit-scrollbar\s*,[^}]*\.overlay-scrollbar-scope::-webkit-scrollbar/s,
    );
  });

  it("suppresses native viewport scrollbars only for app-owned themed scroll hosts", () => {
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area__viewport--scrollbar-themed::-webkit-scrollbar\s*{\s*width:\s*0;\s*height:\s*0;\s*display:\s*none;/s,
    );
    expect(overlayScrollbarStylesSource).not.toMatch(
      /\.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar\s*{\s*width:\s*0;\s*height:\s*0;\s*display:\s*none;/s,
    );
  });

  it("keeps explorer file-list scrollbars native and compositor-owned", () => {
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area__viewport--explorer-file-list\s*{[^}]*scrollbar-width:\s*thin;[^}]*scrollbar-color:\s*var\(--overlay-scrollbar-thumb\)\s*var\(--overlay-scrollbar-track\);[^}]*scrollbar-gutter:\s*stable;/s,
    );
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area__viewport--explorer-file-list::-webkit-scrollbar\s*{[^}]*width:\s*var\(--overlay-scrollbar-size\);[^}]*height:\s*var\(--overlay-scrollbar-size\);/s,
    );
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area--explorer-file-list\s*{[^}]*--overlay-scrollbar-size:\s*var\(--overlay-scrollbar-file-list-size\);/s,
    );
  });

  it("keeps scroll viewports and overlay thumbs compositor friendly", () => {
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area__viewport\s*{[^}]*will-change:\s*scroll-position;[^}]*transform:\s*translateZ\(0\);[^}]*backface-visibility:\s*hidden;/s,
    );
    expect(overlayScrollbarStylesSource).toMatch(
      /\.overlay-scroll-area__scrollbar-thumb\s*{[^}]*will-change:\s*transform;[^}]*transform:\s*translateZ\(0\);/s,
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
