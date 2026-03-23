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

function LiquidVelvetBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.72);
  const sheen = Number(context.sharedUniforms.sheen ?? 0.58);
  const foldDepth = Number(context.sharedUniforms.foldDepth ?? 0.44);
  const chroma = Number(context.sharedUniforms.chroma ?? 0.66);
  const drift = Number(context.sharedUniforms.drift ?? 0.26);

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

      const localTime = now * 0.001;
      const base = ctx.createRadialGradient(widthCss * 0.42, heightCss * 0.34, 0, widthCss * 0.5, heightCss * 0.48, Math.max(widthCss, heightCss) * 0.9);
      base.addColorStop(0, `rgba(255,255,255,${0.08 + sheen * 0.08})`);
      base.addColorStop(0.18, `${context.accentColor}${alphaHex(0.16 + chroma * 0.08)}`);
      base.addColorStop(0.58, 'rgba(88, 36, 124, 0.42)');
      base.addColorStop(1, 'rgba(10, 5, 16, 0.12)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      const ribbonCount = 4;
      for (let ribbon = 0; ribbon < ribbonCount; ribbon += 1) {
        const progress = ribbon / Math.max(ribbonCount - 1, 1);
        const y = heightCss * (0.18 + progress * 0.64);
        const phase = localTime * (0.62 + progress * 0.16) + ribbon * 1.9;
        const sweep = Math.sin(phase) * (14 + drift * 18);
        const amplitude = lerp(44, 118, foldDepth) * (0.36 + progress * 0.5);

        ctx.lineWidth = 18 + (1 - progress) * 9;
        ctx.strokeStyle = ribbon % 2 === 0
          ? `${context.accentColor}${alphaHex(0.14 + chroma * 0.12)}`
          : 'rgba(255, 184, 227, 0.14)';
        ctx.beginPath();
        ctx.moveTo(-60, y + sweep);
        ctx.bezierCurveTo(
          widthCss * 0.2,
          y - amplitude * 0.42 + Math.cos(phase * 1.2) * 18,
          widthCss * 0.65,
          y + amplitude * 0.3 + Math.sin(phase * 1.35) * 24,
          widthCss + 60,
          y + Math.sin(phase * 1.1) * 16,
        );
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      for (let highlight = 0; highlight < 10; highlight += 1) {
        const seed = highlight * 1.37;
        const px = (Math.sin(seed * 8.9 + localTime * 0.2) * 0.5 + 0.5) * widthCss;
        const py = (Math.cos(seed * 7.3 + localTime * 0.18) * 0.5 + 0.5) * heightCss;
        const radius = 16 + (highlight % 3) * 14 + sheen * 14;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, radius);
        glow.addColorStop(0, `rgba(255,255,255,${0.12 + sheen * 0.08})`);
        glow.addColorStop(0.26, `${context.accentColor}${alphaHex(0.12 + chroma * 0.08)}`);
        glow.addColorStop(0.72, 'rgba(255, 140, 196, 0.04)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(px, py, radius * 1.6, radius * 0.64, Math.sin(seed) * 0.52, 0, Math.PI * 2);
        ctx.fill();
      }

      const specCount = Math.round(lerp(16, 42, sheen));
      ctx.globalCompositeOperation = 'screen';
      for (let spec = 0; spec < specCount; spec += 1) {
        const seed = spec * 2.07;
        const x = (Math.sin(seed * 11.1) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 8.8 + localTime * 0.3) * 0.5 + 0.5) * heightCss;
        const size = 0.8 + (spec % 4) * 0.35;
        ctx.fillStyle = spec % 5 === 0 ? 'rgba(255,255,255,0.88)' : `${context.accentColor}${alphaHex(0.18 + sheen * 0.12)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, sheen, foldDepth, chroma, drift]);

  return (
    <div style={{ position: 'absolute', inset: '-16%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            'radial-gradient(circle at 18% 26%, rgba(255,255,255,0.08), transparent 22%)',
            `radial-gradient(circle at 72% 18%, ${context.accentColor}${alphaHex(0.2)}, transparent 20%)`,
            'radial-gradient(circle at 52% 76%, rgba(255, 140, 196, 0.1), transparent 22%)',
            'linear-gradient(135deg, rgba(255,255,255,0.05), transparent 32%, rgba(120, 66, 166, 0.12) 64%, transparent 100%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.22}px) saturate(${1.08 + chroma * 0.24})`,
          opacity: 0.86,
          mixBlendMode: 'screen',
          transform: `translate3d(${Math.sin(time * 0.14) * 2}%, ${Math.cos(time * 0.16) * 2}%, 0) scale(1.05)`,
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
          pointerEvents: 'none',
          opacity: context.isSettingsActive ? 0.99 : 0.92,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function LiquidVelvetTopBar({ context }) {
  const time = useClock(1.02);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 20%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,184,227,0.12) 82%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.7,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.68) * 11}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(90deg, transparent 0 11px, rgba(255,255,255,0.05) 11px 13px, transparent 13px 27px)',
          opacity: 0.22,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function LiquidVelvetBorder({ context }) {
  const time = useClock(1.36);
  const pulse = 0.26 + Math.sin(time * 1.7) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 20px ${context.accentColor}${alphaHex(0.1)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-20%, -20%) rotate(${time * 18}deg)` },
        { inset: '0 0 auto auto', transform: `translate(20%, -20%) rotate(${-time * 16}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-20%, 20%) rotate(${-time * 14}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(20%, 20%) rotate(${time * 20}deg)` },
      ].map((corner, index) => (
        <div
          key={`liquid-velvet-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 48,
            height: 48,
            background: `radial-gradient(circle, rgba(255,255,255,0.14) 0%, ${context.accentColor}${alphaHex(0.12)} 42%, transparent 72%)`,
            filter: 'blur(8px)',
            opacity: 0.56,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Liquid Velvet',
  description: 'A plush, high-sheen liquid surface with velvet folds, chromatic highlights, and slow luxury motion.',
  group: 'Fluid Fields',
  tags: ['liquid', 'velvet', 'luxury', 'sheen'],
  controls: [
    { id: 'sheen', label: 'Sheen', description: 'Raise the specular glow and polished surface reflections.', min: 0, max: 1, step: 0.02 },
    { id: 'foldDepth', label: 'Fold Depth', description: 'Deepen the velvet drape and large flowing folds.', min: 0, max: 1, step: 0.02 },
    { id: 'chroma', label: 'Chroma', description: 'Push the color separation across the liquid surface.', min: 0, max: 1, step: 0.02 },
    { id: 'drift', label: 'Drift', description: 'Increase the gentle lateral movement of the folds.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    sheen: clamp01(0.34 + context.blurStrength / 44 + context.zoom * 0.08),
    foldDepth: clamp01(0.24 + context.panelTransparency * 0.28 + (context.isSettingsActive ? 0.08 : 0)),
    chroma: clamp01(0.48 + context.viewport.width / 3400),
    drift: clamp01(0.18 + context.zoom * 0.06),
  }),
  background: {
    render: LiquidVelvetBackground,
  },
  topBar: {
    render: LiquidVelvetTopBar,
    resolveStyle: () => ({
      opacity: 0.7,
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: LiquidVelvetBorder,
  },
});
