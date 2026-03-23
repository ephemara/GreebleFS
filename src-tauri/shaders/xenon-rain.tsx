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

function XenonRainBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.94);
  const rainDensity = Number(context.sharedUniforms.rainDensity ?? 0.7);
  const wetGlow = Number(context.sharedUniforms.wetGlow ?? 0.48);

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
      const slant = -0.42;
      const rainCount = Math.round(lerp(90, 240, rainDensity));

      const glow = ctx.createRadialGradient(widthCss * 0.5, heightCss * 0.56, 0, widthCss * 0.5, heightCss * 0.56, Math.max(widthCss, heightCss) * 0.8);
      glow.addColorStop(0, `${context.accentColor}${alphaHex(0.12 + wetGlow * 0.08)}`);
      glow.addColorStop(0.5, 'rgba(255,255,255,0.04)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      for (let drop = 0; drop < rainCount; drop += 1) {
        const seed = drop * 0.91;
        const xBase = (Math.sin(seed * 12.4) * 0.5 + 0.5) * widthCss;
        const x = xBase + Math.sin(localTime * 0.6 + seed) * 8;
        const length = lerp(12, 42, rainDensity) + (drop % 7) * 4;
        const speed = lerp(240, 660, rainDensity) + (drop % 5) * 16;
        const y = ((localTime * speed + seed * 80) % (heightCss + 80)) - 40;
        const alpha = 0.12 + (drop % 9) * 0.01;
        ctx.strokeStyle = drop % 6 === 0 ? `${context.accentColor}${alphaHex(alpha + 0.08)}` : `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = drop % 4 === 0 ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + length * slant, y + length);
        ctx.stroke();

        if (drop % 11 === 0) {
          ctx.fillStyle = `rgba(255,255,255,${(0.34 + wetGlow * 0.14).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x + length * slant, y + length, 1.1 + (drop % 3) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const poolCount = Math.round(lerp(8, 18, wetGlow));
      for (let pool = 0; pool < poolCount; pool += 1) {
        const seed = pool * 1.73;
        const px = (Math.sin(seed * 8.2 + localTime * 0.28) * 0.5 + 0.5) * widthCss;
        const py = heightCss * (0.62 + Math.cos(seed * 2.4) * 0.12);
        const radius = 20 + (pool % 5) * 10 + Math.sin(localTime * 1.4 + seed) * 4;
        const radial = ctx.createRadialGradient(px, py, 0, px, py, radius);
        radial.addColorStop(0, `${context.accentColor}${alphaHex(0.22 + wetGlow * 0.08)}`);
        radial.addColorStop(0.45, 'rgba(255,255,255,0.08)');
        radial.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.ellipse(px, py, radius * 1.6, radius * 0.66, Math.sin(seed) * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, rainDensity, wetGlow]);

  return (
    <div style={{ position: 'absolute', inset: '-14%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `radial-gradient(circle at 50% 56%, ${context.accentColor}${alphaHex(0.12 + wetGlow * 0.08)}, transparent 26%)`,
            'radial-gradient(circle at 22% 18%, rgba(255,255,255,0.08), transparent 14%)',
            'radial-gradient(circle at 82% 74%, rgba(110,231,255,0.08), transparent 16%)',
            'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01) 40%, transparent 70%)',
          ].join(', '),
          filter: `blur(${16 + context.blurStrength * 0.24}px) saturate(${1.06 + wetGlow * 0.2})`,
          mixBlendMode: 'screen',
          opacity: 0.9,
          transform: `translate3d(${Math.sin(time * 0.18) * 3}%, ${Math.cos(time * 0.2) * 2}%, 0)`,
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
          mixBlendMode: 'screen',
          opacity: context.isSettingsActive ? 0.99 : 0.93,
        }}
      />
    </div>
  );
}

function XenonRainTopBar({ context }) {
  const time = useClock(1.14);
  const sheen = Number(context.sharedUniforms.sheen ?? 0.54);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 16%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.12) 84%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.8,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.56) * 10}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.08) 10px 12px, transparent 12px 24px)',
            `radial-gradient(circle at ${50 + Math.sin(time * 1.5) * 8}% 28%, ${context.accentColor}${alphaHex(0.1 + sheen * 0.08)}, transparent 22%)`,
          ].join(', '),
          opacity: 0.34,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function XenonRainBorder({ context }) {
  const time = useClock(1.48);
  const pulse = 0.3 + Math.sin(time * 1.9) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 24px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-16%, -16%) rotate(${time * 16}deg)` },
        { inset: '0 0 auto auto', transform: `translate(16%, -16%) rotate(${-time * 18}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-16%, 16%) rotate(${-time * 14}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(16%, 16%) rotate(${time * 20}deg)` },
      ].map((corner, index) => (
        <div
          key={`xenon-rain-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 52,
            height: 52,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 40%, transparent 70%)`,
            filter: 'blur(8px)',
            opacity: 0.64,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `perspective(1250px) translate3d(0, ${lerp(22, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.88, 1, active) : lerp(1, 0.92, progress)}) rotate(${direction === 'enter' ? lerp(-4, 0, active) : lerp(0, 6, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 16, progress)}px) saturate(${direction === 'enter' ? lerp(0.76, 1.04, active) : lerp(1.04, 0.8, progress)}) brightness(${direction === 'enter' ? lerp(0.84, 1, active) : lerp(1, 0.8, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineShader({
  name: 'Xenon Rain',
  description: 'Wet neon rainfall, puddle blooms, and reflective streaks that make the shell feel storm-washed.',
  group: 'Authoring Extremes',
  tags: ['rain', 'wet', 'neon', 'atmospheric'],
  controls: [
    { id: 'rainDensity', label: 'Rain Density', description: 'Increase the amount of falling neon rain and droplets.', min: 0, max: 1, step: 0.02 },
    { id: 'wetGlow', label: 'Wet Glow', description: 'Tune puddle bloom and reflective wet highlights.', min: 0, max: 1, step: 0.02 },
    { id: 'sheen', label: 'Surface Sheen', description: 'Adjust how glossy and reflective the rain wash feels.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    rainDensity: clamp01(0.38 + context.blurStrength / 34 + context.panelTransparency * 0.22 + (context.isSettingsActive ? 0.08 : 0)),
    wetGlow: clamp01(0.18 + context.zoom * 0.1 + context.viewport.width / 3400),
    sheen: clamp01(0.22 + context.blurStrength / 40),
  }),
  background: {
    render: XenonRainBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 56%, ${context.accentColor}${alphaHex(0.08)}, transparent 24%)`,
        'radial-gradient(circle at 16% 20%, rgba(255,255,255,0.06), transparent 14%)',
        'radial-gradient(circle at 84% 72%, rgba(110,231,255,0.08), transparent 18%)',
      ].join(', '),
      opacity: 0.94,
      mixBlendMode: 'screen',
    }),
  },
  topBar: {
    render: XenonRainTopBar,
    resolveStyle: context => ({
      opacity: 0.72,
      filter: 'blur(8px) saturate(1.12)',
      transform: 'scale(1.04)',
      mixBlendMode: 'screen' as const,
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 40%, ${context.accentColor}${alphaHex(0.1)} 50%, rgba(255,255,255,0.12) 60%, transparent 100%)`,
    }),
  },
  border: {
    render: XenonRainBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.24)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 18px ${context.accentColor}${alphaHex(0.12)}`,
    }),
  },
});
