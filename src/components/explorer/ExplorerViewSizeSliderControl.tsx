import { useMemo, type CSSProperties } from "react";

import { resolveExplorerChromeControlMetrics } from "../../config/explorerChromeControlMetrics";
import type { ExplorerChromeSizeVariant } from "../../config/explorerChromeLayouts";
import { PremiumSlider } from "../PremiumSlider";

export interface ExplorerViewSizeSliderControlProps {
  sizeVariant?: ExplorerChromeSizeVariant;
  accent: string;
  text: string;
  muted: string;
  label: string;
  valueLabel: string;
  ariaLabel: string;
  ariaValueText?: string;
  valueLabelMinWidthCh?: number;
  value: number;
  min: number;
  max: number;
  step: number;
  showLabel?: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}

export function ExplorerViewSizeSliderControl({
  sizeVariant = "regular",
  accent,
  text,
  muted,
  label,
  valueLabel,
  ariaLabel,
  ariaValueText,
  valueLabelMinWidthCh = 6,
  value,
  min,
  max,
  step,
  showLabel = true,
  disabled = false,
  onChange,
  onCommit,
}: ExplorerViewSizeSliderControlProps) {
  const metrics = resolveExplorerChromeControlMetrics(sizeVariant);
  const sliderDensity = sizeVariant === "compact" ? "compact" : "comfortable";

  const hostStyle = useMemo<CSSProperties>(
    () => ({
      display: "flex",
      alignItems: "center",
      gap: Math.max(metrics.gap, 6),
      width: "100%",
      minWidth: 0,
      minHeight: metrics.minHeight,
      padding: `${Math.max(metrics.blockPadding - 1, 2)}px ${metrics.inlinePadding}px`,
      borderRadius: 999,
      border: "1px solid var(--overlay-explorer-chip-border)",
      background: "rgba(255,255,255,0.03)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      opacity: disabled ? 0.6 : 1,
    }),
    [
      disabled,
      metrics.blockPadding,
      metrics.gap,
      metrics.inlinePadding,
      metrics.minHeight,
    ],
  );

  const labelStyle = useMemo<CSSProperties>(
    () => ({
      flexShrink: 0,
      fontSize: metrics.fontSize,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: muted,
      whiteSpace: "nowrap",
    }),
    [metrics.fontSize, muted],
  );

  const valueStyle = useMemo<CSSProperties>(
    () => ({
      flexShrink: 0,
      width: `${valueLabelMinWidthCh}ch`,
      fontSize: metrics.fontSize,
      fontWeight: 800,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "0.04em",
      color: text,
      textAlign: "right",
      whiteSpace: "nowrap",
    }),
    [metrics.fontSize, text, valueLabelMinWidthCh],
  );

  const sliderStyle = useMemo<CSSProperties>(
    () =>
      ({
        width: "100%",
        minWidth: 0,
        ["--overlay-accent" as string]: accent,
        ["--overlay-workbench-settings-card-border" as string]:
          "var(--overlay-explorer-chip-border)",
      }) satisfies CSSProperties,
    [accent],
  );

  return (
    <div title={`${label}: ${valueLabel}`} style={hostStyle}>
      {showLabel ? <span style={labelStyle}>{label}</span> : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          minWidth: 72,
        }}
      >
        <PremiumSlider
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          density={sliderDensity}
          ariaLabel={ariaLabel}
          ariaValueText={ariaValueText ?? valueLabel}
          onChange={onChange}
          onCommit={onCommit}
          style={sliderStyle}
        />
      </div>
      <span style={valueStyle}>{valueLabel}</span>
    </div>
  );
}
