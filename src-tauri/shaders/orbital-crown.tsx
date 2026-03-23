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

function OrbitalCrownBackground({ context }) {
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
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.18, h * 0.06, w * 0.5, h * 0.5, h * 0.9);
      bg.addColorStop(0, 'rgba(255,255,255,0.18)');
      bg.addColorStop(0.45, `${context.accentColor}${alphaHex(0.12)}`);
      bg.addColorStop(1, 'rgba(4,8,16,0.92)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'screen';
      const rings = 6;
      for (let index = 0; index < rings; index += 1) {
        const phase = index / Math.max(rings - 1, 1);
        const rx = w * 0.5;
        const ry = h * (0.42 + phase * 0.08);
        const radiusX = lerp(w * 0.14, w * 0.44, phase);
        const radiusY = lerp(h * 0.05, h * 0.15, phase);
        ctx.strokeStyle = `${context.accentColor}${alphaHex(0.12 + phase * 0.12)}`;
        ctx.lineWidth = 2 - phase * 0.6;
        ctx.beginPath();
        ctx.ellipse(rx, ry, radiusX, radiusY, Math.sin(time * 0.3 + phase) * 0.16, 0, Math.PI * 2);
        ctx.stroke();
      }

      const crownCount = 10;
      for (let index = 0; index < crownCount; index += 1) {
        const phase = index / crownCount;
        const angle = (Math.PI * 2 * phase) + time * 0.45;
        const radius = lerp(w * 0.16, w * 0.34, clamp01(context.zoom));
        const cx = w * 0.5 + Math.cos(angle) * radius;
        const cy = h * 0.28 + Math.sin(angle * 2) * h * 0.05;
        const glow = 3 + (index % 3) * 1.5;
        ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.86)' : `${context.accentColor}${alphaHex(0.8)}`;
        ctx.beginPath();
        ctx.arc(cx, cy, glow, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.zoom]);

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
        opacity: 0.95,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function OrbitalCrownTopBar({ context }) {
  const time = useClock(1.22);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-22% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 18%, ${context.accentColor}${alphaHex(0.2)} 50%, rgba(255,255,255,0.14) 82%, transparent 100%)`,
          transform: `translateX(${Math.sin(time * 0.7) * 12}%)`,
          filter: 'blur(8px)',
          mixBlendMode: 'screen',
          opacity: 0.82,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.08) 10px 12px, transparent 12px 26px)',
          opacity: 0.28,
        }}
      />
    </div>
  );
}

function OrbitalCrownBorder({ context }) {
  const time = useClock(1.48);
  const pulse = 0.3 + Math.cos(time * 1.5) * 0.05;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 18px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[0, 1, 2, 3].map(index => (
        <div
          key={`orbital-corner-${index}`}
          style={{
            position: 'absolute',
            inset: index < 2 ? '0 auto auto 0' : 'auto 0 0 auto',
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: `1px solid ${context.accentColor}${alphaHex(0.22)}`,
            transform: `translate(${index % 2 === 0 ? '-14px' : '14px'}, ${index < 2 ? '-14px' : '14px'}) rotate(${time * (index % 2 === 0 ? 18 : -18)}deg)`,
            opacity: 0.84,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Orbital Crown',
  description: 'Concentric orbital rings, crown halos, and bright chrome markers shape a regal synthetic shell.',
  group: 'Authoring Extremes',
  tags: ['orbital', 'crown', 'halo', 'chrome'],
  resolveSharedUniforms: context => ({
    ringDensity: clamp01(0.24 + context.viewport.width / 3200 + context.zoom * 0.12),
  }),
  background: {
    render: OrbitalCrownBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 18%, rgba(255,255,255,0.16), transparent 20%)',
        `radial-gradient(circle at 50% 52%, ${context.accentColor}${alphaHex(0.1)}, transparent 48%)`,
        'linear-gradient(180deg, rgba(8,10,18,0.62), rgba(2,4,8,0.96))',
      ].join(', '),
      opacity: 0.94,
    }),
  },
  topBar: {
    render: OrbitalCrownTopBar,
    resolveStyle: () => ({
      opacity: 0.8,
      mixBlendMode: 'screen' as const,
      transform: 'scale(1.03)',
    }),
  },
  border: {
    render: OrbitalCrownBorder,
    resolveStyle: context => ({
      borderRadius: 2,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${context.accentColor}${alphaHex(0.1)}`,
    }),
  },
});