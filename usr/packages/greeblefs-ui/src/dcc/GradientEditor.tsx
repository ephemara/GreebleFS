import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { ColorPicker, type Color } from './ColorPicker';
import { NumericInput } from './NumericInput';
import {
  clampRgbaColor,
  clampUnitInterval,
  formatRgbaColorLabel,
  interpolateRgbaColors,
  rgbaToCssString,
} from './colorUtils';

export interface GradientStop {
  position: number;
  color: Color;
}

export interface Gradient {
  stops: GradientStop[];
}

export interface GradientEditorProps {
  gradient: Gradient;
  onChange: (gradient: Gradient) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  minStops?: number;
  maxStops?: number;
}

const defaultGradient: Gradient = {
  stops: [
    { position: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 255, g: 255, b: 255, a: 1 } },
  ],
};

export function GradientEditor({
  gradient,
  onChange,
  width = 320,
  height = 44,
  disabled = false,
  className,
  style,
  minStops = 2,
  maxStops = 12,
}: GradientEditorProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [selectedStopIndex, setSelectedStopIndex] = useState<number | null>(null);
  const [dragStopIndex, setDragStopIndex] = useState<number | null>(null);

  const sortedStops = useMemo(() => {
    const sourceStops = gradient.stops.length >= 2 ? gradient.stops : defaultGradient.stops;
    return [...sourceStops]
      .map((stop) => ({
        position: clampUnitInterval(stop.position),
        color: clampRgbaColor(stop.color),
      }))
      .sort((left, right) => left.position - right.position);
  }, [gradient.stops]);

  useEffect(() => {
    if (selectedStopIndex == null) {
      return;
    }
    if (selectedStopIndex >= sortedStops.length) {
      setSelectedStopIndex(sortedStops.length - 1);
    }
  }, [selectedStopIndex, sortedStops.length]);

  useEffect(() => {
    if (dragStopIndex == null) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const rawPosition = clampUnitInterval((event.clientX - rect.left) / rect.width);
      const previousStop = sortedStops[dragStopIndex - 1];
      const nextStop = sortedStops[dragStopIndex + 1];
      const minPosition = previousStop ? previousStop.position + 0.001 : 0;
      const maxPosition = nextStop ? nextStop.position - 0.001 : 1;
      const clampedPosition = Math.min(maxPosition, Math.max(minPosition, rawPosition));
      const nextStops = [...sortedStops];
      nextStops[dragStopIndex] = {
        ...nextStops[dragStopIndex],
        position: clampedPosition,
      };
      onChange({ stops: nextStops });
    };

    const finishDrag = () => {
      setDragStopIndex(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [dragStopIndex, onChange, sortedStops]);

  const selectedStop = selectedStopIndex != null ? sortedStops[selectedStopIndex] ?? null : null;
  const gradientBackground = `linear-gradient(90deg, ${sortedStops.map((stop) => `${rgbaToCssString(stop.color)} ${Math.round(stop.position * 100)}%`).join(', ')})`;

  const sampleColorAtPosition = (position: number): Color => {
    if (sortedStops.length === 0) {
      return { r: 255, g: 255, b: 255, a: 1 };
    }
    if (position <= sortedStops[0].position) {
      return sortedStops[0].color;
    }
    if (position >= sortedStops[sortedStops.length - 1].position) {
      return sortedStops[sortedStops.length - 1].color;
    }
    for (let index = 0; index < sortedStops.length - 1; index += 1) {
      const leftStop = sortedStops[index];
      const rightStop = sortedStops[index + 1];
      if (position >= leftStop.position && position <= rightStop.position) {
        const span = rightStop.position - leftStop.position || 1;
        return interpolateRgbaColors(leftStop.color, rightStop.color, (position - leftStop.position) / span);
      }
    }
    return sortedStops[sortedStops.length - 1].color;
  };

  const updateStop = (index: number, partialStop: Partial<GradientStop>) => {
    const nextStops = [...sortedStops];
    const currentStop = nextStops[index];
    if (!currentStop) {
      return;
    }
    const previousStop = nextStops[index - 1];
    const nextStop = nextStops[index + 1];
    const nextPosition = partialStop.position == null
      ? currentStop.position
      : Math.min(
          nextStop ? nextStop.position - 0.001 : 1,
          Math.max(previousStop ? previousStop.position + 0.001 : 0, clampUnitInterval(partialStop.position)),
        );
    nextStops[index] = {
      position: nextPosition,
      color: partialStop.color ? clampRgbaColor(partialStop.color) : currentStop.color,
    };
    onChange({ stops: nextStops });
  };

  const addStopAtPosition = (position: number) => {
    if (disabled || sortedStops.length >= maxStops) {
      return;
    }
    const nextStop = {
      position: clampUnitInterval(position),
      color: sampleColorAtPosition(position),
    };
    const nextStops = [...sortedStops, nextStop].sort((left, right) => left.position - right.position);
    const nextIndex = nextStops.findIndex((stop) => stop === nextStop);
    onChange({ stops: nextStops });
    setSelectedStopIndex(nextIndex === -1 ? null : nextIndex);
  };

  const removeSelectedStop = () => {
    if (selectedStopIndex == null || sortedStops.length <= minStops) {
      return;
    }
    const nextStops = sortedStops.filter((_, index) => index !== selectedStopIndex);
    onChange({ stops: nextStops });
    setSelectedStopIndex(nextStops.length === 0 ? null : Math.max(0, selectedStopIndex - 1));
  };

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gap: 10,
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: 8,
          width,
          maxWidth: '100%',
        }}
      >
        <div
          ref={barRef}
          onMouseDown={(event) => {
            if (disabled) {
              return;
            }
            const rect = barRef.current?.getBoundingClientRect();
            if (!rect) {
              return;
            }
            addStopAtPosition((event.clientX - rect.left) / rect.width);
          }}
          style={{
            position: 'relative',
            minHeight: height + 24,
            paddingBottom: 24,
          }}
        >
          <div
            style={{
              height,
              borderRadius: 'calc(var(--overlay-workbench-panel-radius) - 4px)',
              border: '1px solid var(--overlay-border)',
              background: gradientBackground,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
              cursor: disabled ? 'not-allowed' : 'crosshair',
              opacity: disabled ? 0.55 : 1,
            }}
          />
          {sortedStops.map((stop, index) => {
            const isSelected = index === selectedStopIndex;
            return (
              <button
                key={`${index}-${stop.position}-${formatRgbaColorLabel(stop.color, true)}`}
                type="button"
                disabled={disabled}
                title={formatRgbaColorLabel(stop.color, true)}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedStopIndex(index);
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  if (disabled) {
                    return;
                  }
                  setSelectedStopIndex(index);
                  setDragStopIndex(index);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedStopIndex(index);
                  if (!disabled && sortedStops.length > minStops) {
                    const nextStops = sortedStops.filter((_, stopIndex) => stopIndex !== index);
                    onChange({ stops: nextStops });
                    setSelectedStopIndex(nextStops.length === 0 ? null : Math.max(0, index - 1));
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${stop.position * 100}%`,
                  top: height - 2,
                  transform: 'translate(-50%, 0)',
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  border: isSelected
                    ? '2px solid var(--overlay-accent, #60a5fa)'
                    : '1px solid rgba(255,255,255,0.18)',
                  background: rgbaToCssString(stop.color),
                  boxShadow: isSelected
                    ? '0 0 0 3px color-mix(in srgb, var(--overlay-accent) 18%, transparent)'
                    : '0 4px 12px rgba(0,0,0,0.32)',
                  cursor: disabled ? 'not-allowed' : 'grab',
                }}
              />
            );
          })}
        </div>
        <div style={toolbarStyle}>
          <div style={metaStyle}>
            {sortedStops.length} {sortedStops.length === 1 ? 'stop' : 'stops'}
          </div>
          <button
            type="button"
            disabled={disabled || sortedStops.length >= maxStops}
            onClick={() => addStopAtPosition(0.5)}
            style={actionButtonStyle}
          >
            <Plus size={12} />
            Add Stop
          </button>
        </div>
      </div>
      {selectedStop && selectedStopIndex != null ? (
        <div
          style={{
            display: 'grid',
            gap: 10,
            borderRadius: 'var(--overlay-workbench-panel-radius)',
            border: '1px solid var(--overlay-border)',
            background: 'var(--overlay-bg-panel)',
            padding: 10,
          }}
        >
          <div style={toolbarStyle}>
            <div style={sectionTitleStyle}>
              Stop {selectedStopIndex + 1}
            </div>
            <button
              type="button"
              disabled={disabled || sortedStops.length <= minStops}
              onClick={removeSelectedStop}
              style={{
                ...actionButtonStyle,
                color: 'var(--overlay-danger, #fb7185)',
              }}
            >
              <Trash2 size={12} />
              Remove
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 112px', gap: 10, alignItems: 'start' }}>
            <ColorPicker
              value={selectedStop.color}
              disabled={disabled}
              onChange={(nextColor) => updateStop(selectedStopIndex, { color: nextColor })}
              panelTitle={`Stop ${selectedStopIndex + 1} Color`}
            />
            <NumericInput
              label="Position"
              value={selectedStop.position * 100}
              min={0}
              max={100}
              step={1}
              precision={0}
              disabled={disabled}
              onChange={(nextValue) => updateStop(selectedStopIndex, { position: nextValue / 100 })}
            />
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

const metaStyle: CSSProperties = {
  color: 'var(--overlay-text-muted)',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: 'var(--overlay-font-mono)',
};

const sectionTitleStyle: CSSProperties = {
  color: 'var(--overlay-text-primary)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const actionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 28,
  borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  color: 'var(--overlay-text-primary)',
  padding: '0 9px',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};
