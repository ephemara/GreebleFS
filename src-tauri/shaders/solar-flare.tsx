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

function SolarFlareBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const energy = Number(context.sharedUniforms.energy ?? 0.58);
    let frame = 0;
    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const widthCss = canvas.clientWidth;
      const heightCss = canvas.clientHeight;
      if (widthCss <= 0 || heightCss <= 0) {
        frame = window.requestAnimationFrame(render);
        return;
      }

      const time = now * 0.001;
      const ambient = ctx.createLinearGradient(0, 0, widthCss, heightCss);
      ambient.addColorStop(0, `rgba(251,146,60,${0.1 + energy * 0.12})`);
      ambient.addColorStop(0.45, `${context.accentColor}${alphaHex(0.08)}`);
      ambient.addColorStop(1, 'rgba(244,114,182,0.08)');
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      const ribbonCount = Math.round(lerp(5, 9, energy));
      for (let ribbon = 0; ribbon < ribbonCount; ribbon += 1) {
        const progress = ribbon / Math.max(ribbonCount - 1, 1);
        const y = heightCss * (0.18 + progress * 0.72);
        const wave = Math.sin(time * (0.7 + progress * 0.4) + ribbon * 1.1);
        const amplitude = 24 + (1 - progress) * 32;
        ctx.lineWidth = 2.6 - progress * 1.2;
        ctx.strokeStyle = ribbon % 2 === 0
          ? `rgba(251,146,60,${0.22 + (1 - progress) * 0.24})`
          : `${context.accentColor}${alphaHex(0.22 + (1 - progress) * 0.1)}`;
        ctx.beginPath();
        ctx.moveTo(-40, y + Math.sin(time + ribbon) * 18);
        ctx.bezierCurveTo(
          widthCss * 0.24,
          y - amplitude + wave * 12,
          widthCss * 0.64,
          y + amplitude - wave * 18,
          widthCss + 40,
          y + Math.cos(time * 1.2 + ribbon) * 18,
        );
        ctx.stroke();
      }

      const emberCount = Math.round(lerp(24, 56, energy));
      for (let ember = 0; ember < emberCount; ember += 1) {
        const seed = ember * 1.713;
        const x = ((Math.sin(seed * 12.4) * 0.5 + 0.5) * widthCss);
        const speed = 20 + (ember % 8) * 9;
        const y = heightCss + 30 - ((time * speed + seed * 80) % (heightCss + 80));
        const radius = 0.8 + (ember % 3) * 0.6;
        ctx.fillStyle = ember % 4 === 0 ? 'rgba(255,255,255,0.68)' : 'rgba(251,146,60,0.58)';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.sharedUniforms]);

  return (
    <div style={{ position: 'absolute', inset: '-16%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            'radial-gradient(circle at 18% 24%, rgba(251,146,60,0.24), transparent 20%)',
            'radial-gradient(circle at 74% 22%, rgba(244,114,182,0.18), transparent 18%)',
            `radial-gradient(circle at 50% 68%, ${context.accentColor}${alphaHex(0.16)}, transparent 24%)`,
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.28}px) saturate(1.24)`,
          opacity: 0.82,
          mixBlendMode: 'screen',
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: context.isSettingsActive ? 0.98 : 0.9,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function SolarFlareTopBar({ context }) {
  const time = useClock(1.22);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-24% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.22) 24%, ${context.accentColor}${alphaHex(0.18)} 52%, rgba(255,255,255,0.18) 72%, transparent 100%)`,
          filter: 'blur(9px)',
          opacity: 0.84,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.66) * 16}%) skewX(${Math.sin(time * 0.32) * 7}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.08) 10px 12px, transparent 12px 24px)',
          opacity: 0.32,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function SolarFlareBorder({ context }) {
  const time = useClock(1.54);
  const pulse = 0.3 + Math.sin(time * 1.8) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 20px rgba(251,146,60,0.16), 0 0 24px ${context.accentColor}${alphaHex(0.1)}`,
        }}
      />
      {[
        { inset: '0 0 auto 0', width: '100%', height: 2, axis: 'horizontal' },
        { inset: 'auto 0 0 0', width: '100%', height: 2, axis: 'horizontal' },
      ].map((rail, index) => (
        <div
          key={`solar-rail-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.width,
            height: rail.height,
            background: `linear-gradient(90deg, transparent 0%, rgba(251,146,60,0.8) 18%, rgba(255,255,255,0.92) 50%, ${context.accentColor}${alphaHex(0.42)} 82%, transparent 100%)`,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Solar Flare',
  description: 'Forged plasma ribbons, ember drift, and hot chrome accents for a more aggressive shell mood.',
  group: 'Authoring Extremes',
  tags: ['plasma', 'ember', 'hot', 'canvas'],
  resolveSharedUniforms: context => ({
    energy: clamp01(0.24 + context.blurStrength / 34 + context.panelTransparency * 0.36 + (context.isSettingsActive ? 0.08 : 0)),
  }),
  background: {
    render: SolarFlareBackground,
  },
  topBar: {
    render: SolarFlareTopBar,
  },
  border: {
    render: SolarFlareBorder,
  },
});
