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

function LiquidMercuryBackground({ context }) {
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
      const base = ctx.createRadialGradient(w * 0.5, h * 0.3, h * 0.1, w * 0.5, h * 0.5, h * 0.8);
      base.addColorStop(0, 'rgba(255,255,255,0.26)');
      base.addColorStop(0.35, `${context.accentColor}${alphaHex(0.14)}`);
      base.addColorStop(1, 'rgba(8,10,14,0.92)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'screen';
      const waveCount = 8;
      for (let index = 0; index < waveCount; index += 1) {
        const phase = index / Math.max(waveCount - 1, 1);
        const y = h * (0.18 + phase * 0.64);
        const amp = lerp(10, 38, 1 - phase);
        const gradient = ctx.createLinearGradient(0, y, w, y);
        gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.18)');
        gradient.addColorStop(0.5, `${context.accentColor}${alphaHex(0.16 + phase * 0.08)}`);
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.22)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.08)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.2 - phase * 1.1;
        ctx.beginPath();
        for (let step = 0; step <= 24; step += 1) {
          const x = (step / 24) * w;
          const drift = Math.sin(time * (0.78 + phase * 0.3) + x * 0.012 + index) * amp;
          const ridge = Math.cos(time * 1.08 + phase * 7.2 + x * 0.018) * (amp * 0.22);
          const py = y + drift + ridge;
          if (step === 0) ctx.moveTo(x, py);
          else ctx.lineTo(x, py);
        }
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      const shimmerCount = Math.round(lerp(20, 42, clamp01(context.zoom)));
      for (let index = 0; index < shimmerCount; index += 1) {
        const phase = index / Math.max(shimmerCount - 1, 1);
        const x = (phase * w + Math.sin(time * 0.8 + index) * 26) % w;
        const y = h * (0.1 + phase * 0.8) + Math.cos(time * 1.2 + phase * 8) * 18;
        const radius = 1 + (index % 5) * 0.4;
        ctx.fillStyle = index % 4 === 0 ? 'rgba(255,255,255,0.9)' : `${context.accentColor}${alphaHex(0.72)}`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

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
        opacity: 0.94,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function LiquidMercuryTopBar({ context }) {
  const time = useClock(1.3);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-24% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 20%, ${context.accentColor}${alphaHex(0.16)} 50%, rgba(255,255,255,0.18) 80%, transparent 100%)`,
          transform: `translateX(${Math.sin(time * 0.55) * 18}%)`,
          filter: 'blur(9px)',
          opacity: 0.8,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.1), transparent 35%)',
          opacity: 0.24,
        }}
      />
    </div>
  );
}

function LiquidMercuryBorder({ context }) {
  const time = useClock(1.48);
  const pulse = 0.3 + Math.sin(time * 1.6) * 0.05;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 22px ${context.accentColor}${alphaHex(0.11)}`,
        }}
      />
      {[0, 1, 2, 3].map(index => (
        <div
          key={`mercury-glint-${index}`}
          style={{
            position: 'absolute',
            inset: index < 2 ? '0 auto auto 0' : 'auto 0 0 auto',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.92) 0%, ${context.accentColor}${alphaHex(0.24)} 34%, transparent 72%)`,
            transform: `translate(${index % 2 === 0 ? '-10px' : '10px'}, ${index < 2 ? '-10px' : '10px'})`,
            opacity: 0.82,
            filter: 'blur(2px)',
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Liquid Mercury',
  description: 'Reflective liquid metal ripples, broad specular sweeps, and a cold chrome sheen across the shell.',
  group: 'Authoring Extremes',
  tags: ['liquid', 'mercury', 'metal', 'reflection'],
  resolveSharedUniforms: context => ({
    sheen: clamp01(0.3 + context.blurStrength / 42 + context.panelTransparency * 0.2),
  }),
  background: {
    render: LiquidMercuryBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 25%, rgba(255,255,255,0.2), transparent 22%)',
        `radial-gradient(circle at 50% 60%, ${context.accentColor}${alphaHex(0.08)}, transparent 46%)`,
        'linear-gradient(180deg, rgba(14,16,20,0.58), rgba(2,4,8,0.96))',
      ].join(', '),
      opacity: 0.94,
    }),
  },
  topBar: {
    render: LiquidMercuryTopBar,
    resolveStyle: () => ({
      opacity: 0.8,
      mixBlendMode: 'screen' as const,
      transform: 'scale(1.02)',
    }),
  },
  border: {
    render: LiquidMercuryBorder,
    resolveStyle: context => ({
      borderRadius: 2,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${context.accentColor}${alphaHex(0.08)}`,
    }),
  },
});