import React, { useEffect, useRef, useState } from 'react';
import { definePlugin } from 'overlayterm-plugin';

type Point = {
  x: number;
  y: number;
};

const SWATCHES = ['#f8fafc', '#7dd3fc', '#34d399', '#f97316', '#f472b6'];

function CanvasPad({
  appearance,
}: {
  appearance: {
    theme: {
      palette?: {
        accent?: string;
      };
    };
  };
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const [strokeColor, setStrokeColor] = useState(appearance.theme.palette?.accent ?? '#7dd3fc');
  const [lineWidth, setLineWidth] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const resizeCanvas = () => {
      const width = Math.max(Math.floor(container.clientWidth), 320);
      const height = Math.max(Math.floor(container.clientHeight), 240);
      const dpr = window.devicePixelRatio || 1;
      const snapshot = document.createElement('canvas');

      if (canvas.width > 0 && canvas.height > 0) {
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        const snapshotContext = snapshot.getContext('2d');
        if (snapshotContext) {
          snapshotContext.drawImage(canvas, 0, 0);
        }
      }

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.lineCap = 'round';
      context.lineJoin = 'round';

      if (snapshot.width > 0 && snapshot.height > 0) {
        context.drawImage(snapshot, 0, 0, width, height);
      }
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawPoint = (point: Point) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = strokeColor;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(lineWidth / 2, 1), 0, Math.PI * 2);
    context.fill();
  };

  const drawSegment = (start: Point, end: Point) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!context) {
      return;
    }

    context.strokeStyle = strokeColor;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  };

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.clientWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.clientHeight / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawPoint(point);
  };

  const continueDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) {
      return;
    }

    const point = getPoint(event);
    drawSegment(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100%',
        color: 'var(--overlay-text-primary)',
        fontFamily: 'var(--overlay-font-ui)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 14px',
          borderRadius: 16,
          border: '1px solid var(--overlay-border)',
          background: 'var(--overlay-bg-panel)',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Canvas Pad</div>
          <div style={{ fontSize: 12, color: 'var(--overlay-text-muted)', marginTop: 4 }}>
            Drag to sketch with mouse, pen, or touch.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Color
            <input
              aria-label="Brush color"
              type="color"
              value={strokeColor}
              onChange={event => setStrokeColor(event.target.value)}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                border: '1px solid var(--overlay-border)',
                borderRadius: 8,
                background: 'transparent',
              }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {SWATCHES.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color} brush`}
                onClick={() => setStrokeColor(color)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: color === strokeColor
                    ? '2px solid var(--overlay-accent)'
                    : '1px solid rgba(255,255,255,0.18)',
                  background: color,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            Brush
            <input
              aria-label="Brush size"
              type="range"
              min="1"
              max="20"
              step="1"
              value={lineWidth}
              onChange={event => setLineWidth(Number(event.target.value))}
            />
            <span style={{ minWidth: 18, textAlign: 'right' }}>{lineWidth}</span>
          </label>

          <button
            type="button"
            onClick={clearCanvas}
            style={{
              border: '1px solid var(--overlay-border)',
              background: 'var(--overlay-bg-card)',
              color: 'var(--overlay-text-primary)',
              borderRadius: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          minHeight: 420,
          flex: 1,
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid var(--overlay-border)',
          background: [
            'linear-gradient(180deg, rgba(125,211,252,0.08), rgba(15,23,42,0.02))',
            'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
            'var(--overlay-bg-app)',
          ].join(', '),
          backgroundSize: '100% 100%, 24px 24px, 24px 24px, 100% 100%',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            touchAction: 'none',
            cursor: 'crosshair',
          }}
        />
      </div>
    </div>
  );
}

export default definePlugin({
  id: 'drawable-canvas',
  name: 'Drawable Canvas',
  description: 'A simple sketch pad plugin for quick notes and visual thinking.',
  component: CanvasPad,
});
