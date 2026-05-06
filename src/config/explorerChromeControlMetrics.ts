import type { ExplorerChromeSizeVariant } from "./explorerChromeLayouts";

export interface ExplorerChromeControlMetrics {
  fontSize: number;
  gap: number;
  iconSize: number;
  iconPadding: number;
  inlinePadding: number;
  blockPadding: number;
  minHeight: number;
}

const explorerChromeControlMetricsByVariant: Record<
  ExplorerChromeSizeVariant,
  ExplorerChromeControlMetrics
> = {
  compact: {
    fontSize: 9,
    gap: 4,
    iconSize: 11,
    iconPadding: 4,
    inlinePadding: 6,
    blockPadding: 3,
    minHeight: 26,
  },
  regular: {
    fontSize: 10,
    gap: 6,
    iconSize: 12,
    iconPadding: 5,
    inlinePadding: 8,
    blockPadding: 4,
    minHeight: 30,
  },
  wide: {
    fontSize: 11,
    gap: 7,
    iconSize: 14,
    iconPadding: 6,
    inlinePadding: 10,
    blockPadding: 5,
    minHeight: 34,
  },
};

export function resolveExplorerChromeControlMetrics(
  sizeVariant: ExplorerChromeSizeVariant = "regular",
): ExplorerChromeControlMetrics {
  return (
    explorerChromeControlMetricsByVariant[sizeVariant] ??
    explorerChromeControlMetricsByVariant.regular
  );
}
