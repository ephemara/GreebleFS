import React, { useEffect, useRef, useState } from 'react';
import { clamp01, defineShader, lerp } from 'overlayterm-shader';

function useClock(speed = 1): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      setTime(now * 0.001 * speed);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [speed]);

  return time;
}

function alphaHex(value: number): string {
  return Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
}

function DataMonolithBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) {
        frame = window.requestAnimationFrame(render);
        return;
      }

      const time = now * 0.001;
      const grid = ctx.createLinearGradient(0, 0, 0, h);
      grid.addColorStop(0, 'rgba(255,255,255,0.04)');
      grid.addColorStop(1, 'rgba(6,9,16,0.92)');
      ctx.fillStyle = grid;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'screen';
      const monolithCount = 5;
      for (let index = 0; index < monolithCount; index += 1) {
        const phase = index / Math.max(monolithCount - 1, 1);
        const x = w * (0.12 + phase * 0.72);
        const top = h * (0.12 + Math.sin(time * 0.16 + phase * 5) * 0.02);
        const heightPx = lerp(h * 0.38, h * 0.72, phase);
        const widthPx = lerp(42, 78, 1 - Math.abs(phase - 0.5) * 1.6);
        const body = ctx.createLinearGradient(x, top, x + widthPx, top + heightPx);
        body.addColorStop(0, `${context.accentColor}${alphaHex(0.08 + phase * 0.08)}`);
        body.addColorStop(0.4, 'rgba(255,255,255,0.12)');
        body.addColorStop(1, 'rgba(255,255,255,0.03)');
        ctx.fillStyle = body;
        ctx.fillRect(x, top, widthPx, heightPx);
        ctx.strokeStyle = `${context.accentColor}${alphaHex(0.14 + phase * 0.12)}`;
        ctx.strokeRect(x, top, widthPx, heightPx);

        for (let band = 0; band < 6; band += 1) {
          const by = top + (heightPx / 7) * (band + 1);
          ctx.fillStyle = band % 2 === 0 ? 'rgba(255,255,255,0.12)' : `${context.accentColor}${alphaHex(0.1)}`;
          ctx.fillRect(x - 6, by, widthPx + 12, 1.2);
        }
      }

      const sweepY = (time * 98) % (h + 140) - 70;
      const sweep = ctx.createLinearGradient(0, sweepY - 30, 0, sweepY + 30);
      sweep.addColorStop(0, 'rgba(255,255,255,0)');
      sweep.addColorStop(0.5, `${context.accentColor}${alphaHex(0.18)}`);
      sweep.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.92,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function DataMonolithTopBar({ context }) {
  const time = useClock(1.28);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 24%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.14) 76%, transparent 100%)`,
          transform: `translateX(${Math.cos(time * 0.58) * 10}%)`,
          filter: 'blur(8px)',
          opacity: 0.72,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.08) 12px 14px, transparent 14px 28px)',
          opacity: 0.26,
        }}
      />
    </div>
  );
}

function DataMonolithBorder({ context }) {
  const time = useClock(1.44);
  const pulse = 0.26 + Math.sin(time * 1.4) * 0.04;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 18px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[0, 1, 2, 3].map(index => (
        <div
          key={`monolith-node-${index}`}
          style={{
            position: 'absolute',
            inset: index < 2 ? '0 auto auto 0' : 'auto 0 0 auto',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${context.accentColor}${alphaHex(0.8)} 45%, transparent 75%)`,
            transform: `translate(${index % 2 === 0 ? '-8px' : '8px'}, ${index < 2 ? '-8px' : '8px'})`,
            opacity: 0.9,
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Data Monolith',
  description: 'Telemetry obelisks, scan rails, and stacked data strata create a heavy architectural shell read.',
  group: 'Authoring Extremes',
  tags: ['data', 'monolith', 'telemetry', 'grid'],
  resolveSharedUniforms: context => ({
    density: clamp01(0.22 + context.viewport.width / 2600 + context.zoom * 0.14),
  }),
  background: {
    render: DataMonolithBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 12%, rgba(255,255,255,0.08), transparent 28%)',
        `radial-gradient(circle at 50% 52%, ${context.accentColor}${alphaHex(0.08)}, transparent 56%)`,
        'linear-gradient(180deg, rgba(9,12,20,0.66), rgba(3,5,10,0.96))',
      ].join(', '),
      opacity: 0.92,
    }),
  },
  topBar: {
    render: DataMonolithTopBar,
    resolveStyle: () => ({
      opacity: 0.74,
      mixBlendMode: 'screen' as const,
      transform: 'scale(1.02)',
    }),
  },
  border: {
    render: DataMonolithBorder,
    resolveStyle: context => ({
      borderRadius: 2,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 18px ${context.accentColor}${alphaHex(0.08)}`,
    }),
  },
});