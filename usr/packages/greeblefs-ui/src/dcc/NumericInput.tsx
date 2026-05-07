import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  inputStyle?: CSSProperties;
  dragSensitivity?: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startValue: number;
}

function clampNumericValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function formatNumericValue(value: number, precision: number): string {
  return Number.isFinite(value) ? value.toFixed(precision) : '0';
}

export function NumericInput({
  value,
  onChange,
  onCommit,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 0.1,
  precision = 2,
  label,
  labelClassName,
  labelStyle,
  disabled = false,
  className,
  style,
  inputStyle,
  dragSensitivity = 2,
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const liveValueRef = useRef(value);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(formatNumericValue(value, precision));

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(formatNumericValue(value, precision));
    }
    liveValueRef.current = value;
  }, [isEditing, precision, value]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const nextValue = clampNumericValue(
        dragState.startValue + ((deltaX / dragSensitivity) * step),
        min,
        max,
      );
      liveValueRef.current = nextValue;
      onChange(nextValue);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }
      dragStateRef.current = null;
      setIsDragging(false);
      document.body.style.cursor = '';
      onCommit?.(liveValueRef.current);
    };

    const handleWindowBlur = () => {
      if (!dragStateRef.current) {
        return;
      }
      dragStateRef.current = null;
      setIsDragging(false);
      document.body.style.cursor = '';
      onCommit?.(liveValueRef.current);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handleWindowBlur);
    document.body.style.cursor = 'ew-resize';

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.body.style.cursor = '';
    };
  }, [dragSensitivity, isDragging, max, min, onChange, onCommit, step]);

  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  const commitDraftValue = () => {
    const parsed = Number.parseFloat(draftValue);
    if (Number.isFinite(parsed)) {
      const nextValue = clampNumericValue(parsed, min, max);
      liveValueRef.current = nextValue;
      onChange(nextValue);
      onCommit?.(nextValue);
    }
    setIsEditing(false);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || isEditing || event.button !== 0) {
      return;
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startValue: value,
    };
    liveValueRef.current = value;
    setIsDragging(true);
    event.preventDefault();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement | HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (isEditing) {
        commitDraftValue();
      } else {
        setIsEditing(true);
        setDraftValue(formatNumericValue(value, precision));
        requestAnimationFrame(() => inputRef.current?.select());
      }
      return;
    }
    if (event.key === 'Escape' && isEditing) {
      event.preventDefault();
      setIsEditing(false);
      setDraftValue(formatNumericValue(value, precision));
      return;
    }
    if (!isEditing && event.key === 'ArrowUp') {
      event.preventDefault();
      const nextValue = clampNumericValue(value + step, min, max);
      liveValueRef.current = nextValue;
      onChange(nextValue);
      onCommit?.(nextValue);
      return;
    }
    if (!isEditing && event.key === 'ArrowDown') {
      event.preventDefault();
      const nextValue = clampNumericValue(value - step, min, max);
      liveValueRef.current = nextValue;
      onChange(nextValue);
      onCommit?.(nextValue);
    }
  };

  const startEditing = () => {
    if (disabled) {
      return;
    }
    setIsEditing(true);
    setDraftValue(formatNumericValue(value, precision));
    requestAnimationFrame(() => inputRef.current?.select());
  };

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gap: 5,
        minWidth: 0,
        ...style,
      }}
    >
      {label ? (
        <label
          className={labelClassName}
          style={{
            color: 'var(--overlay-text-secondary)',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.2,
            ...labelStyle,
          }}
        >
          {label}
        </label>
      ) : null}
      <div
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        onPointerDown={handlePointerDown}
        onDoubleClick={startEditing}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 32,
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: 'var(--overlay-explorer-control-radius)',
          border: `1px solid ${isDragging ? 'var(--overlay-accent)' : 'var(--overlay-explorer-input-border)'}`,
          background: 'var(--overlay-explorer-input-bg)',
          color: 'var(--overlay-text-primary)',
          cursor: disabled ? 'not-allowed' : isEditing ? 'text' : 'ew-resize',
          opacity: disabled ? 0.55 : 1,
          padding: '0 10px',
          transition: 'border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
          boxShadow: isDragging
            ? '0 0 0 1px color-mix(in srgb, var(--overlay-accent) 30%, transparent)'
            : 'none',
          ...inputStyle,
        }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={draftValue}
            disabled={disabled}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={commitDraftValue}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              border: 0,
              outline: 'none',
              background: 'transparent',
              color: 'inherit',
              textAlign: 'center',
              fontFamily: 'var(--overlay-font-mono)',
              fontSize: 11,
              padding: 0,
            }}
          />
        ) : (
          <span
            style={{
              color: 'inherit',
              fontFamily: 'var(--overlay-font-mono)',
              fontSize: 11,
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {formatNumericValue(value, precision)}
          </span>
        )}
      </div>
    </div>
  );
}
