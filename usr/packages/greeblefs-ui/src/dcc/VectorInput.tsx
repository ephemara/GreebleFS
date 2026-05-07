import React, { type CSSProperties } from 'react';

import { NumericInput, type NumericInputProps } from './NumericInput';

export interface VectorInputProps {
  value: number[];
  onChange: (value: number[]) => void;
  labels?: string[];
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  inputStyle?: NumericInputProps['inputStyle'];
}

const axisLabelStyles: CSSProperties[] = [
  { color: 'var(--overlay-danger, #fb7185)' },
  { color: 'var(--overlay-success, #4ade80)' },
  { color: 'var(--overlay-accent)' },
  { color: 'var(--overlay-text-secondary)' },
];

export function VectorInput({
  value,
  onChange,
  labels,
  min,
  max,
  step = 0.1,
  precision = 2,
  disabled = false,
  className,
  style,
  inputStyle,
}: VectorInputProps) {
  const resolvedLabels = labels ?? ['X', 'Y', 'Z', 'W'].slice(0, value.length);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 8,
        minWidth: 0,
        ...style,
      }}
    >
      {value.map((componentValue, index) => (
        <div key={index} style={{ flex: 1, minWidth: 0 }}>
          <NumericInput
            value={componentValue}
            onChange={(nextValue) => {
              const nextVector = [...value];
              nextVector[index] = nextValue;
              onChange(nextVector);
            }}
            min={min}
            max={max}
            step={step}
            precision={precision}
            label={resolvedLabels[index] ?? `V${index}`}
            labelStyle={axisLabelStyles[index] ?? axisLabelStyles[axisLabelStyles.length - 1]}
            disabled={disabled}
            inputStyle={inputStyle}
          />
        </div>
      ))}
    </div>
  );
}
