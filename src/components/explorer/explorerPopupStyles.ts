import type { CSSProperties } from "react";

export type ExplorerPopupSurfaceTone = "menu" | "preview";

interface ResolveExplorerPopupSurfaceStyleOptions {
  tone?: ExplorerPopupSurfaceTone;
  minWidth?: CSSProperties["minWidth"];
  maxWidth?: CSSProperties["maxWidth"];
  maxHeight?: CSSProperties["maxHeight"];
  padding?: CSSProperties["padding"];
  overflowY?: CSSProperties["overflowY"];
}

export function resolveExplorerPopupSurfaceStyle(
  options: ResolveExplorerPopupSurfaceStyleOptions = {},
): CSSProperties {
  const tone = options.tone ?? "menu";
  const popupBorder =
    tone === "preview"
      ? "var(--overlay-explorer-preview-border, var(--overlay-explorer-popup-border, var(--overlay-border-strong, rgba(148, 163, 184, 0.32))))"
      : "var(--overlay-explorer-popup-border, var(--overlay-border-strong, rgba(148, 163, 184, 0.32)))";
  const popupBackground =
    tone === "preview"
      ? "var(--overlay-explorer-preview-header-bg, var(--overlay-explorer-popup-bg, var(--overlay-bg-panel, rgb(15, 23, 42))))"
      : "var(--overlay-explorer-popup-bg, var(--overlay-bg-menu, var(--overlay-bg-panel, rgb(15, 23, 42))))";

  return {
    minWidth: options.minWidth,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight ?? "var(--overlay-explorer-popup-max-height)",
    overflowX: "hidden",
    overflowY: options.overflowY ?? "auto",
    isolation: "isolate",
    backgroundClip: "padding-box",
    borderRadius: "var(--overlay-explorer-panel-radius)",
    border: `var(--overlay-explorer-popup-border-width, 1px) solid ${popupBorder}`,
    background: popupBackground,
    "boxShadow": "var(--overlay-explorer-popup-shadow-lg)",
    color: "var(--overlay-text-primary)",
    padding: options.padding ?? 8,
  };
}
