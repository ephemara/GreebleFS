import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Palette, X } from 'lucide-react';
import { PremiumSlider } from 'overlayterm-plugin';

import { NumericInput } from './NumericInput';
import {
  clampRgbaColor,
  clampUnitInterval,
  formatRgbaColorLabel,
  hexToRgbaColor,
  rgbaToCssString,
  rgbaToHexString,
  type RgbaColor,
} from './colorUtils';

export type Color = RgbaColor;

export interface ColorPickerProps {
  value: Color;
  onChange: (color: Color) => void;
  showAlpha?: boolean;
  swatches?: Color[];
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  compact?: boolean;
  panelTitle?: string;
}

const defaultSwatches: Color[] = [
  { r: 255, g: 255, b: 255, a: 1 },
  { r: 0, g: 0, b: 0, a: 1 },
  { r: 248, g: 113, b: 113, a: 1 },
  { r: 249, g: 115, b: 22, a: 1 },
  { r: 250, g: 204, b: 21, a: 1 },
  { r: 74, g: 222, b: 128, a: 1 },
  { r: 34, g: 211, b: 238, a: 1 },
  { r: 96, g: 165, b: 250, a: 1 },
  { r: 168, g: 85, b: 247, a: 1 },
  { r: 244, g: 114, b: 182, a: 1 },
];

export function ColorPicker({
  value,
  onChange,
  showAlpha = true,
  swatches,
  disabled = false,
  className,
  style,
  compact = false,
  panelTitle = 'Color',
}: ColorPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = useMemo(() => clampRgbaColor(value), [value]);
  const displaySwatches = swatches && swatches.length > 0 ? swatches : defaultSwatches;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const updateChannels = (partialColor: Partial<Color>) => {
    onChange(clampRgbaColor({
      ...normalizedValue,
      ...partialColor,
    }));
  };

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        position: 'relative',
        minWidth: 0,
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: compact ? 6 : 8,
          width: '100%',
          minHeight: compact ? 30 : 34,
          borderRadius: 'var(--overlay-explorer-control-radius)',
          border: '1px solid var(--overlay-explorer-input-border)',
          background: 'var(--overlay-explorer-input-bg)',
          color: 'var(--overlay-text-primary)',
          padding: compact ? '0 8px' : '0 10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          textAlign: 'left',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: compact ? 16 : 18,
            height: compact ? 16 : 18,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: rgbaToCssString(normalizedValue),
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: compact ? 10 : 11,
            fontFamily: 'var(--overlay-font-mono)',
          }}
        >
          {formatRgbaColorLabel(normalizedValue, showAlpha)}
        </span>
        <Palette size={compact ? 12 : 14} style={{ color: 'var(--overlay-text-muted)' }} />
      </button>
      {isOpen ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 'calc(100% + 8px)',
            zIndex: 1400,
            display: 'grid',
            gap: 10,
            minWidth: 260,
            maxWidth: 320,
            width: 'max-content',
            borderRadius: 'calc(var(--overlay-workbench-panel-radius) - 2px)',
            border: '1px solid var(--overlay-border)',
            background: 'var(--overlay-bg-shell)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
            padding: 10,
          }}
        >
          <div style={toolbarStyle}>
            <div style={panelTitleStyle}>{panelTitle}</div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={dismissButtonStyle}
            >
              <X size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={fieldLabelStyle}>Base</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  disabled={disabled}
                  value={rgbaToHexString(normalizedValue)}
                  onChange={(event) => {
                    updateChannels(hexToRgbaColor(event.target.value, normalizedValue.a));
                  }}
                  style={{
                    width: 34,
                    height: 26,
                    border: 0,
                    padding: 0,
                    borderRadius: 6,
                    background: 'transparent',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                />
                <div
                  style={{
                    minHeight: 26,
                    borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
                    border: '1px solid var(--overlay-explorer-input-border)',
                    background: 'var(--overlay-bg-panel)',
                    color: 'var(--overlay-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    fontSize: 11,
                    fontFamily: 'var(--overlay-font-mono)',
                  }}
                >
                  {rgbaToHexString(normalizedValue).toUpperCase()}
                </div>
              </div>
            </div>
            {showAlpha ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={toolbarStyle}>
                  <div style={fieldLabelStyle}>Alpha</div>
                  <div style={valueStyle}>{Math.round(normalizedValue.a * 100)}%</div>
                </div>
                <PremiumSlider
                  value={normalizedValue.a}
                  min={0}
                  max={1}
                  step={0.01}
                  density={compact ? 'compact' : 'comfortable'}
                  ariaLabel="Alpha"
                  onChange={(nextValue) => {
                    updateChannels({ a: clampUnitInterval(nextValue) });
                  }}
                />
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: showAlpha ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <NumericInput
                label="R"
                value={normalizedValue.r}
                min={0}
                max={255}
                step={1}
                precision={0}
                disabled={disabled}
                onChange={(nextValue) => updateChannels({ r: nextValue })}
              />
              <NumericInput
                label="G"
                value={normalizedValue.g}
                min={0}
                max={255}
                step={1}
                precision={0}
                disabled={disabled}
                onChange={(nextValue) => updateChannels({ g: nextValue })}
              />
              <NumericInput
                label="B"
                value={normalizedValue.b}
                min={0}
                max={255}
                step={1}
                precision={0}
                disabled={disabled}
                onChange={(nextValue) => updateChannels({ b: nextValue })}
              />
              {showAlpha ? (
                <NumericInput
                  label="A%"
                  value={normalizedValue.a * 100}
                  min={0}
                  max={100}
                  step={1}
                  precision={0}
                  disabled={disabled}
                  onChange={(nextValue) => updateChannels({ a: nextValue / 100 })}
                />
              ) : null}
            </div>
            {displaySwatches.length > 0 ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={fieldLabelStyle}>Swatches</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
                  {displaySwatches.map((swatch, index) => (
                    <button
                      key={`${index}-${rgbaToHexString(swatch)}-${swatch.a}`}
                      type="button"
                      disabled={disabled}
                      title={formatRgbaColorLabel(swatch, showAlpha)}
                      onClick={() => onChange(clampRgbaColor(swatch))}
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: rgbaToCssString(swatch),
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
};

const panelTitleStyle: CSSProperties = {
  color: 'var(--overlay-text-primary)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const fieldLabelStyle: CSSProperties = {
  color: 'var(--overlay-text-muted)',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const valueStyle: CSSProperties = {
  color: 'var(--overlay-text-primary)',
  fontSize: 10,
  fontWeight: 700,
  fontFamily: 'var(--overlay-font-mono)',
};

const dismissButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: 999,
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-bg-panel)',
  color: 'var(--overlay-text-secondary)',
  cursor: 'pointer',
};
