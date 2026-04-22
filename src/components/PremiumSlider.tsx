import * as SliderPrimitive from '@radix-ui/react-slider';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';

type PremiumSliderDensity = 'comfortable' | 'compact';

export interface PremiumSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  density?: PremiumSliderDensity;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaValueText?: string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  style?: CSSProperties;
}

type PremiumSliderDensityMetrics = {
  rootHeight: number;
  trackHeight: number;
  thumbSize: number;
  thumbCoreSize: number;
  insetPadding: number;
};

const PREMIUM_SLIDER_DENSITY_METRICS: Record<
  PremiumSliderDensity,
  PremiumSliderDensityMetrics
> = {
  comfortable: {
    rootHeight: 30,
    trackHeight: 8,
    thumbSize: 20,
    thumbCoreSize: 8,
    insetPadding: 2,
  },
  compact: {
    rootHeight: 24,
    trackHeight: 6,
    thumbSize: 16,
    thumbCoreSize: 6,
    insetPadding: 1,
  },
};

function clampPremiumSliderValue(
  value: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (max <= min) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function PremiumSlider({
  value,
  min,
  max,
  step = 0.01,
  disabled = false,
  density = 'comfortable',
  ariaLabel,
  ariaLabelledBy,
  ariaValueText,
  onChange,
  onCommit,
  style,
}: PremiumSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const metrics = PREMIUM_SLIDER_DENSITY_METRICS[density];
  const clampedValue = clampPremiumSliderValue(value, min, max);
  const normalizedProgress = useMemo(() => {
    if (max <= min) {
      return 0;
    }
    return (clampedValue - min) / (max - min);
  }, [clampedValue, max, min]);

  useEffect(() => {
    if (!isDragging || typeof window === 'undefined') {
      return;
    }

    const handlePointerRelease = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);
    window.addEventListener('blur', handlePointerRelease);
    return () => {
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
      window.removeEventListener('blur', handlePointerRelease);
    };
  }, [isDragging]);

  const trackRadius = metrics.trackHeight / 2;
  const thumbRadius = metrics.thumbSize / 2;
  const isInteractive = !disabled;
  const activityStrength = isDragging ? 1 : isFocused ? 0.7 : 0;

  const rootStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: metrics.rootHeight,
    padding: `0 ${metrics.insetPadding}px`,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: isInteractive ? (isDragging ? 'grabbing' : 'grab') : 'not-allowed',
    opacity: disabled ? 0.52 : 1,
    ...style,
  };

  const trackStyle: CSSProperties = {
    position: 'relative',
    flex: 1,
    height: metrics.trackHeight,
    borderRadius: trackRadius,
    overflow: 'hidden',
    background:
      'linear-gradient(180deg, color-mix(in srgb, white 7%, transparent), transparent 52%), color-mix(in srgb, var(--overlay-workbench-settings-card-border, rgba(255,255,255,0.16)) 74%, rgba(255,255,255,0.04))',
    border: '1px solid color-mix(in srgb, var(--overlay-workbench-settings-card-border, rgba(255,255,255,0.16)) 88%, transparent)',
    boxShadow: activityStrength > 0
      ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px color-mix(in srgb, var(--overlay-accent, #3b82f6) ${Math.round(activityStrength * 22)}%, transparent)`
      : 'inset 0 1px 0 rgba(255,255,255,0.06)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, background 160ms ease',
  };

  const rangeStyle: CSSProperties = {
    position: 'absolute',
    height: '100%',
    borderRadius: trackRadius,
    background:
      'linear-gradient(90deg, color-mix(in srgb, var(--overlay-accent, #3b82f6) 78%, white 20%) 0%, color-mix(in srgb, var(--overlay-accent, #3b82f6) 94%, #0ea5e9 6%) 58%, color-mix(in srgb, var(--overlay-accent, #3b82f6) 72%, #60a5fa 28%) 100%)',
    boxShadow:
      '0 0 18px color-mix(in srgb, var(--overlay-accent, #3b82f6) 34%, transparent), inset 0 1px 0 rgba(255,255,255,0.18)',
  };

  const thumbStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: metrics.thumbSize,
    height: metrics.thumbSize,
    borderRadius: thumbRadius,
    background:
      'linear-gradient(180deg, color-mix(in srgb, white 92%, var(--overlay-accent, #3b82f6) 8%), color-mix(in srgb, white 78%, rgba(226,232,240,0.9) 22%))',
    border: '1px solid color-mix(in srgb, white 12%, var(--overlay-workbench-settings-card-border, rgba(255,255,255,0.22)) 88%)',
    boxShadow: isDragging
      ? '0 14px 24px rgba(0,0,0,0.34), 0 0 0 6px color-mix(in srgb, var(--overlay-accent, #3b82f6) 22%, transparent)'
      : isFocused
        ? '0 10px 18px rgba(0,0,0,0.28), 0 0 0 4px color-mix(in srgb, var(--overlay-accent, #3b82f6) 18%, transparent)'
        : '0 8px 16px rgba(0,0,0,0.26), 0 0 0 1px rgba(255,255,255,0.08)',
    outline: 'none',
    transition:
      'box-shadow 140ms ease, border-color 140ms ease, background 140ms ease',
  };

  const thumbCoreStyle: CSSProperties = {
    width: metrics.thumbCoreSize,
    height: metrics.thumbCoreSize,
    borderRadius: 999,
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--overlay-accent, #3b82f6) 42%, white 58%), color-mix(in srgb, var(--overlay-accent, #3b82f6) 88%, #1d4ed8 12%))',
    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    transform: `scale(${isDragging ? 1.18 : isFocused ? 1.08 : 1})`,
    transition: 'transform 140ms ease, background 140ms ease',
  };

  const rangeGlowStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: `${Math.max(0, Math.min(normalizedProgress * 100, 100))}%`,
    borderRadius: trackRadius,
    pointerEvents: 'none',
    opacity: 0.75,
    background:
      'linear-gradient(90deg, color-mix(in srgb, var(--overlay-accent, #3b82f6) 28%, transparent), transparent)',
    filter: 'blur(8px)',
    transition: 'width 120ms linear, opacity 160ms ease',
  };

  return (
    <SliderPrimitive.Root
      value={[clampedValue]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(nextValue) => {
        const resolvedValue = clampPremiumSliderValue(
          nextValue[0] ?? min,
          min,
          max,
        );
        onChange(resolvedValue);
      }}
      onValueCommit={(nextValue) => {
        if (!onCommit) {
          return;
        }
        const resolvedValue = clampPremiumSliderValue(
          nextValue[0] ?? min,
          min,
          max,
        );
        onCommit(resolvedValue);
      }}
      onPointerDownCapture={() => {
        if (isInteractive) {
          setIsDragging(true);
        }
      }}
      onFocus={() => {
        setIsFocused(true);
      }}
      onBlur={() => {
        setIsFocused(false);
        setIsDragging(false);
      }}
      style={rootStyle}
    >
      <SliderPrimitive.Track style={trackStyle}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: trackRadius,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 52%)',
            pointerEvents: 'none',
          }}
        />
        <SliderPrimitive.Range style={rangeStyle} />
        <div aria-hidden="true" style={rangeGlowStyle} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={ariaValueText}
        style={thumbStyle}
      >
        <div aria-hidden="true" style={thumbCoreStyle} />
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
}
