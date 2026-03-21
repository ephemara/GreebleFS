import React, { useEffect, useRef } from 'react';
import { defineShader } from 'overlayterm-shader';

function GridSurface({ context }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let frame = 0;
    const render = (now) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const time = now * 0.001;
      const step = context.surface === 'background' ? 28 : 14;
      ctx.strokeStyle = `${context.accentColor}${context.surface === 'border' ? '4a' : '2f'}`;
      ctx.lineWidth = context.surface === 'border' ? 1.5 : 1;

      for (let y = -step; y <= canvas.clientHeight + step; y += step) {
        const drift = Math.sin(time * 1.5 + y * 0.04) * 6;
        ctx.beginPath();
        ctx.moveTo(0, y + drift);
        ctx.lineTo(canvas.clientWidth, y - drift);
        ctx.stroke();
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.surface]);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

export default defineShader({
  name: 'Grid Scan',
  description: 'A light scanline grid that reads cleanly behind panels but still lights the chrome.',
  group: 'Authoring Samples',
  tags: ['grid', 'scanline', 'canvas'],
  background: {
    render: GridSurface,
  },
  topBar: {
    render: GridSurface,
    resolveStyle: () => ({
      opacity: 0.48,
      mixBlendMode: 'screen',
    }),
  },
  border: {
    render: GridSurface,
    resolveStyle: () => ({
      opacity: 0.7,
    }),
  },
});
