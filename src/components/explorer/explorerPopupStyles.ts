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
      ? "var(--overlay-explorer-preview-border)"
      : "var(--overlay-explorer-popup-border)";
  const popupBackground =
    tone === "preview"
      ? "var(--overlay-explorer-preview-header-bg)"
      : "var(--overlay-explorer-popup-bg)";

  return {
    minWidth: options.minWidth,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight ?? "var(--overlay-explorer-popup-max-height)",
    overflowX: "hidden",
    overflowY: options.overflowY ?? "auto",
    borderRadius: "var(--overlay-explorer-panel-radius)",
    border: `var(--overlay-explorer-popup-border-width) solid ${popupBorder}`,
    background: popupBackground,
    "boxShadow": "var(--overlay-explorer-popup-shadow-lg)",
    color: "var(--overlay-text-primary)",
    padding: options.padding ?? 8,
  };
}
