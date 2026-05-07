import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { NumericInput } from './NumericInput';

export interface CurvePoint {
  x: number;
  y: number;
}

export type CurveInterpolation = 'linear' | 'smooth' | 'step';

export interface Curve {
  points: CurvePoint[];
  interpolation: CurveInterpolation;
}

export interface CurveEditorProps {
  curve: Curve;
  onChange: (curve: Curve) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  gridLines?: number;
  showValues?: boolean;
  showInterpolationSelector?: boolean;
}

export function CurveEditor({
  curve,
  onChange,
  width = 320,
  height = 220,
  disabled = false,
  className,
  style,
  gridLines = 4,
  showValues = true,
  showInterpolationSelector = true,
}: CurveEditorProps) {
  const surfaceRef = useRef<SVGSVGElement | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [hoverPointIndex, setHoverPointIndex] = useState<number | null>(null);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);

  const padding = 14;
  const innerWidth = Math.max(40, width - (padding * 2));
  const innerHeight = Math.max(40, height - (padding * 2));

  const sortedPoints = useMemo(
    () => [...curve.points]
      .map((point) => ({
        x: clampUnit(point.x),
        y: clampUnit(point.y),
      }))
      .sort((left, right) => left.x - right.x),
    [curve.points],
  );

  useEffect(() => {
    if (selectedPointIndex == null) {
      return;
    }
    if (selectedPointIndex >= sortedPoints.length) {
      setSelectedPointIndex(sortedPoints.length - 1);
    }
  }, [selectedPointIndex, sortedPoints.length]);

  useEffect(() => {
    if (dragPointIndex == null) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const rawPoint = canvasToCurvePoint(event.clientX - rect.left, event.clientY - rect.top, padding, innerWidth, innerHeight);
      updatePoint(dragPointIndex, rawPoint);
    };

    const handlePointerUp = () => {
      setDragPointIndex(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragPointIndex, innerHeight, innerWidth, padding, sortedPoints]);

  const selectedPoint = selectedPointIndex != null ? sortedPoints[selectedPointIndex] ?? null : null;
  const hoverPoint = hoverPointIndex != null ? sortedPoints[hoverPointIndex] ?? null : null;
  const pathData = useMemo(() => buildCurvePath(sortedPoints, curve.interpolation, padding, innerWidth, innerHeight), [
    curve.interpolation,
    innerHeight,
    innerWidth,
    padding,
    sortedPoints,
  ]);

  function updatePoint(index: number, partialPoint: Partial<CurvePoint>) {
    const nextPoints = [...sortedPoints];
    const currentPoint = nextPoints[index];
    if (!currentPoint) {
      return;
    }
    const previousPoint = nextPoints[index - 1];
    const nextPoint = nextPoints[index + 1];
    const nextX = partialPoint.x == null
      ? currentPoint.x
      : Math.min(
          nextPoint ? nextPoint.x - 0.001 : 1,
          Math.max(previousPoint ? previousPoint.x + 0.001 : 0, clampUnit(partialPoint.x)),
        );
    const nextY = partialPoint.y == null ? currentPoint.y : clampUnit(partialPoint.y);
    nextPoints[index] = {
      x: nextX,
      y: nextY,
    };
    onChange({
      interpolation: curve.interpolation,
      points: nextPoints,
    });
  }

  function addPoint(point: CurvePoint) {
    if (disabled) {
      return;
    }
    const nextPoints = [...sortedPoints, point].sort((left, right) => left.x - right.x);
    const nextIndex = nextPoints.findIndex((entry) => entry === point);
    onChange({
      interpolation: curve.interpolation,
      points: nextPoints,
    });
    setSelectedPointIndex(nextIndex === -1 ? null : nextIndex);
  }

  function removeSelectedPoint() {
    if (selectedPointIndex == null || sortedPoints.length <= 2) {
      return;
    }
    const nextPoints = sortedPoints.filter((_, index) => index !== selectedPointIndex);
    onChange({
      interpolation: curve.interpolation,
      points: nextPoints,
    });
    setSelectedPointIndex(nextPoints.length === 0 ? null : Math.max(0, selectedPointIndex - 1));
  }

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
      <svg
        ref={surfaceRef}
        width={width}
        height={height}
        role="img"
        aria-label="Curve editor"
        onMouseDown={(event) => {
          if (disabled) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          addPoint(canvasToCurvePoint(event.clientX - rect.left, event.clientY - rect.top, padding, innerWidth, innerHeight));
        }}
        style={{
          display: 'block',
          maxWidth: '100%',
          borderRadius: 'var(--overlay-workbench-panel-radius)',
          border: '1px solid var(--overlay-border)',
          background: 'var(--overlay-bg-panel)',
          cursor: disabled ? 'not-allowed' : 'crosshair',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <rect
          x={padding}
          y={padding}
          width={innerWidth}
          height={innerHeight}
          rx={10}
          ry={10}
          fill="color-mix(in srgb, var(--overlay-bg-shell) 72%, transparent)"
          stroke="rgba(255,255,255,0.06)"
        />
        {Array.from({ length: gridLines + 1 }, (_, index) => {
          const x = padding + ((index / gridLines) * innerWidth);
          const y = padding + ((index / gridLines) * innerHeight);
          return (
            <g key={index}>
              <line x1={x} y1={padding} x2={x} y2={padding + innerHeight} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <line x1={padding} y1={y} x2={padding + innerWidth} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            </g>
          );
        })}
        <path
          d={pathData}
          fill="none"
          stroke="var(--overlay-accent, #60a5fa)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {sortedPoints.map((point, index) => {
          const canvasPoint = curveToCanvasPoint(point, padding, innerWidth, innerHeight);
          const isSelected = index === selectedPointIndex;
          const isHovered = index === hoverPointIndex;
          return (
            <g key={`${index}-${point.x}-${point.y}`}>
              <circle
                cx={canvasPoint.x}
                cy={canvasPoint.y}
                r={isSelected ? 7 : 6}
                fill={isSelected ? 'var(--overlay-accent, #60a5fa)' : isHovered ? '#9ac6ff' : 'rgba(255,255,255,0.82)'}
                stroke="rgba(0,0,0,0.48)"
                strokeWidth={2}
                onMouseEnter={() => setHoverPointIndex(index)}
                onMouseLeave={() => setHoverPointIndex((currentValue) => currentValue === index ? null : currentValue)}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  if (disabled) {
                    return;
                  }
                  setSelectedPointIndex(index);
                  setDragPointIndex(index);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedPointIndex(index);
                  if (!disabled && sortedPoints.length > 2) {
                    const nextPoints = sortedPoints.filter((_, pointIndex) => pointIndex !== index);
                    onChange({
                      interpolation: curve.interpolation,
                      points: nextPoints,
                    });
                    setSelectedPointIndex(nextPoints.length === 0 ? null : Math.max(0, index - 1));
                  }
                }}
              />
            </g>
          );
        })}
        {showValues && hoverPoint ? (
          (() => {
            const canvasPoint = curveToCanvasPoint(hoverPoint, padding, innerWidth, innerHeight);
            return (
              <g>
                <rect
                  x={Math.min(width - 78, canvasPoint.x + 10)}
                  y={Math.max(10, canvasPoint.y - 30)}
                  width={68}
                  height={20}
                  rx={6}
                  fill="rgba(0,0,0,0.72)"
                />
                <text
                  x={Math.min(width - 72, canvasPoint.x + 14)}
                  y={Math.max(24, canvasPoint.y - 16)}
                  fill="white"
                  fontSize={10}
                  fontFamily="var(--overlay-font-mono)"
                >
                  {`${hoverPoint.x.toFixed(2)}, ${hoverPoint.y.toFixed(2)}`}
                </text>
              </g>
            );
          })()
        ) : null}
      </svg>
      <div style={toolbarStyle}>
        <div style={metaStyle}>
          {sortedPoints.length} {sortedPoints.length === 1 ? 'point' : 'points'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => addPoint({ x: 0.5, y: 0.5 })}
            style={actionButtonStyle}
          >
            <Plus size={12} />
            Add Point
          </button>
          <button
            type="button"
            disabled={disabled || selectedPointIndex == null || sortedPoints.length <= 2}
            onClick={removeSelectedPoint}
            style={{
              ...actionButtonStyle,
              color: 'var(--overlay-danger, #fb7185)',
            }}
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </div>
      {(selectedPoint || showInterpolationSelector) ? (
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
          {selectedPoint ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <NumericInput
                label="X"
                value={selectedPoint.x}
                min={0}
                max={1}
                step={0.01}
                precision={2}
                disabled={disabled}
                onChange={(nextValue) => {
                  if (selectedPointIndex == null) {
                    return;
                  }
                  updatePoint(selectedPointIndex, { x: nextValue });
                }}
              />
              <NumericInput
                label="Y"
                value={selectedPoint.y}
                min={0}
                max={1}
                step={0.01}
                precision={2}
                disabled={disabled}
                onChange={(nextValue) => {
                  if (selectedPointIndex == null) {
                    return;
                  }
                  updatePoint(selectedPointIndex, { y: nextValue });
                }}
              />
            </div>
          ) : null}
          {showInterpolationSelector ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={sectionTitleStyle}>Interpolation</div>
              <div style={segmentedShellStyle}>
                {(['linear', 'smooth', 'step'] as CurveInterpolation[]).map((interpolationMode) => {
                  const isActive = curve.interpolation === interpolationMode;
                  return (
                    <button
                      key={interpolationMode}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({
                        interpolation: interpolationMode,
                        points: sortedPoints,
                      })}
                      style={{
                        ...segmentButtonStyle,
                        ...(isActive ? activeSegmentButtonStyle : null),
                      }}
                    >
                      {interpolationMode}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function curveToCanvasPoint(
  point: CurvePoint,
  padding: number,
  innerWidth: number,
  innerHeight: number,
): { x: number; y: number } {
  return {
    x: padding + (point.x * innerWidth),
    y: padding + ((1 - point.y) * innerHeight),
  };
}

function canvasToCurvePoint(
  x: number,
  y: number,
  padding: number,
  innerWidth: number,
  innerHeight: number,
): CurvePoint {
  return {
    x: clampUnit((x - padding) / innerWidth),
    y: clampUnit(1 - ((y - padding) / innerHeight)),
  };
}

function buildCurvePath(
  points: CurvePoint[],
  interpolation: CurveInterpolation,
  padding: number,
  innerWidth: number,
  innerHeight: number,
): string {
  if (points.length === 0) {
    return '';
  }
  const canvasPoints = points.map((point) => curveToCanvasPoint(point, padding, innerWidth, innerHeight));
  if (canvasPoints.length === 1) {
    return `M ${canvasPoints[0].x} ${canvasPoints[0].y}`;
  }
  if (interpolation === 'linear') {
    return canvasPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  }
  if (interpolation === 'step') {
    let stepPath = `M ${canvasPoints[0].x} ${canvasPoints[0].y}`;
    for (let index = 1; index < canvasPoints.length; index += 1) {
      const previousPoint = canvasPoints[index - 1];
      const currentPoint = canvasPoints[index];
      stepPath += ` H ${currentPoint.x} V ${currentPoint.y}`;
      if (index === canvasPoints.length - 1) {
        stepPath += ` L ${currentPoint.x} ${currentPoint.y}`;
      }
      if (previousPoint.x === currentPoint.x && previousPoint.y === currentPoint.y) {
        continue;
      }
    }
    return stepPath;
  }
  let smoothPath = `M ${canvasPoints[0].x} ${canvasPoints[0].y}`;
  for (let index = 1; index < canvasPoints.length; index += 1) {
    const previousPoint = canvasPoints[index - 1];
    const currentPoint = canvasPoints[index];
    const midpointX = (previousPoint.x + currentPoint.x) / 2;
    const midpointY = (previousPoint.y + currentPoint.y) / 2;
    smoothPath += ` Q ${previousPoint.x} ${previousPoint.y} ${midpointX} ${midpointY}`;
    if (index === canvasPoints.length - 1) {
      smoothPath += ` T ${currentPoint.x} ${currentPoint.y}`;
    }
  }
  return smoothPath;
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

const segmentedShellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
};

const segmentButtonStyle: CSSProperties = {
  minHeight: 28,
  borderRadius: 'calc(var(--overlay-explorer-control-radius) - 2px)',
  border: '1px solid var(--overlay-border)',
  background: 'var(--overlay-workbench-settings-badge-bg)',
  color: 'var(--overlay-text-secondary)',
  textTransform: 'uppercase',
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  cursor: 'pointer',
};

const activeSegmentButtonStyle: CSSProperties = {
  background: 'color-mix(in srgb, var(--overlay-accent) 16%, var(--overlay-bg-panel))',
  borderColor: 'color-mix(in srgb, var(--overlay-accent) 44%, var(--overlay-border))',
  color: 'var(--overlay-text-primary)',
};
