import React, { useEffect, useRef, useState } from 'react';
import { clamp01, defineShader } from 'overlayterm-shader';

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

function ChromaForgeBackground({ context }) {
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
      const energy = Number(context.sharedUniforms.energy ?? 0.6);
      const heat = ctx.createLinearGradient(0, 0, widthCss, heightCss);
      heat.addColorStop(0, `rgba(255,255,255,${0.05 + energy * 0.08})`);
      heat.addColorStop(0.35, `${context.accentColor}${alphaHex(0.12 + energy * 0.08)}`);
      heat.addColorStop(1, 'rgba(255,120,40,0.1)');
      ctx.fillStyle = heat;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      for (let band = 0; band < 8; band += 1) {
        const progress = band / 7;
        const y = heightCss * (0.14 + progress * 0.78);
        const wave = Math.sin(time * (0.7 + progress * 0.3) + band);
        ctx.lineWidth = 1.6 + (1 - progress) * 1.8;
        ctx.strokeStyle = band % 2 === 0
          ? `rgba(255,160,64,${0.18 + (1 - progress) * 0.24})`
          : `${context.accentColor}${alphaHex(0.14 + (1 - progress) * 0.12)}`;
        ctx.beginPath();
        ctx.moveTo(-30, y + Math.cos(time + band) * 12);
        ctx.bezierCurveTo(
          widthCss * 0.24,
          y - 26 - wave * 18,
          widthCss * 0.68,
          y + 30 + wave * 14,
          widthCss + 30,
          y + Math.sin(time * 1.2 + band) * 18,
        );
        ctx.stroke();
      }

      for (let ember = 0; ember < 54; ember += 1) {
        const seed = ember * 1.811;
        const x = (Math.sin(seed * 12.7) * 0.5 + 0.5) * widthCss;
        const y = heightCss + 24 - ((time * (24 + (ember % 9) * 10) + seed * 72) % (heightCss + 80));
        const radius = 0.8 + (ember % 3) * 0.7;
        ctx.fillStyle = ember % 5 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(255,166,64,0.56)';
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
          inset: '-10%',
          background: [
            'radial-gradient(circle at 12% 20%, rgba(255,170,84,0.2), transparent 20%)',
            `radial-gradient(circle at 78% 26%, ${context.accentColor}${alphaHex(0.16)}, transparent 20%)`,
            'linear-gradient(160deg, rgba(255,255,255,0.04), transparent 38%, rgba(255,120,40,0.08) 68%, transparent 100%)',
          ].join(', '),
          filter: `blur(${16 + context.blurStrength * 0.22}px) saturate(1.2)`,
          opacity: 0.84,
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

function ChromaForgeTopBar({ context }) {
  const time = useClock(1.18);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-26% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,166,64,0.24) 18%, ${context.accentColor}${alphaHex(0.18)} 50%, rgba(255,255,255,0.16) 78%, transparent 100%)`,
          filter: 'blur(10px)',
          opacity: 0.86,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.7) * 16}%) skewX(${Math.sin(time * 0.32) * 8}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.07) 10px 13px, transparent 13px 26px)',
          opacity: 0.3,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function ChromaForgeBorder({ context }) {
  const time = useClock(1.34);
  const pulse = 0.28 + Math.sin(time * 1.8) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 26px rgba(255,160,64,0.08), 0 0 24px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[
        { inset: '0 0 auto 0', axis: 'horizontal' },
        { inset: 'auto 0 0 0', axis: 'horizontal' },
        { inset: '0 auto 0 0', axis: 'vertical' },
        { inset: '0 0 0 auto', axis: 'vertical' },
      ].map((rail, index) => (
        <div
          key={`forge-rail-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.axis === 'horizontal' ? '100%' : 2,
            height: rail.axis === 'horizontal' ? 2 : '100%',
            background: rail.axis === 'horizontal'
              ? `linear-gradient(90deg, transparent 0%, rgba(255,160,64,0.82) 20%, rgba(255,255,255,0.9) 50%, ${context.accentColor}${alphaHex(0.42)} 80%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, rgba(255,160,64,0.82) 20%, rgba(255,255,255,0.9) 50%, ${context.accentColor}${alphaHex(0.42)} 80%, transparent 100%)`,
            opacity: 0.72,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Chroma Forge',
  description: 'Molten chrome heat bands, sparks, and industrial forge rails that push the shell into a hot fabrication chamber.',
  group: 'Authoring Extremes',
  tags: ['forge', 'molten', 'industrial', 'plasma'],
  controls: [
    { id: 'energy', label: 'Forge Heat', description: 'Drive the ember output and the intensity of the molten bands.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    energy: clamp01(0.28 + context.blurStrength / 34 + context.panelTransparency * 0.32 + (context.isSettingsActive ? 0.08 : 0)),
  }),
  background: {
    render: ChromaForgeBackground,
  },
  topBar: {
    render: ChromaForgeTopBar,
  },
  border: {
    render: ChromaForgeBorder,
  },
});
