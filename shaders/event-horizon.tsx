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

function EventHorizonBackground({ context }) {
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

    const intensity = Number(context.sharedUniforms.intensity ?? 0.58);
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
      const centerX = widthCss * (0.54 + Math.sin(time * 0.18) * 0.03);
      const centerY = heightCss * (0.52 + Math.cos(time * 0.16) * 0.03);
      const ambient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, widthCss * 0.6);
      ambient.addColorStop(0, `${context.accentColor}${alphaHex(0.16 + intensity * 0.14)}`);
      ambient.addColorStop(0.36, 'rgba(56,189,248,0.12)');
      ambient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * 0.08);
      ctx.globalCompositeOperation = 'screen';

      const ringCount = Math.round(lerp(6, 12, intensity));
      for (let ring = 0; ring < ringCount; ring += 1) {
        const radiusX = widthCss * (0.12 + ring * 0.032);
        const radiusY = radiusX * (0.5 + Math.sin(time * 0.18 + ring) * 0.06);
        ctx.strokeStyle = ring % 2 === 0 ? `${context.accentColor}${alphaHex(0.18)}` : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = ring % 3 === 0 ? 1.6 : 0.9;
        ctx.beginPath();
        ctx.ellipse(0, 0, radiusX, radiusY, ring * 0.18, 0, Math.PI * 2);
        ctx.stroke();

        const arcCount = 2 + (ring % 3);
        for (let arc = 0; arc < arcCount; arc += 1) {
          const arcStart = time * (0.7 + ring * 0.05) + ring * 0.8 + arc * 1.6;
          const arcLength = 0.38 + arc * 0.16;
          ctx.strokeStyle = arc % 2 === 0 ? 'rgba(255,255,255,0.32)' : `${context.accentColor}${alphaHex(0.32)}`;
          ctx.lineWidth = 2.2 - arc * 0.4;
          ctx.beginPath();
          ctx.ellipse(0, 0, radiusX, radiusY, ring * 0.18, arcStart, arcStart + arcLength);
          ctx.stroke();
        }
      }

      const particleCount = Math.round(lerp(18, 48, intensity));
      for (let particle = 0; particle < particleCount; particle += 1) {
        const progress = particle / Math.max(particleCount, 1);
        const angle = time * (0.8 + progress * 0.9) + particle * 1.618;
        const orbit = widthCss * (0.1 + progress * 0.26);
        const x = Math.cos(angle) * orbit;
        const y = Math.sin(angle * 1.4) * orbit * 0.42;
        const radius = 0.8 + (1 - progress) * 1.8;
        ctx.fillStyle = particle % 4 === 0 ? 'rgba(255,255,255,0.8)' : `${context.accentColor}${alphaHex(0.34)}`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, widthCss * 0.18);
      core.addColorStop(0, 'rgba(255,255,255,0.4)');
      core.addColorStop(0.26, `${context.accentColor}${alphaHex(0.26)}`);
      core.addColorStop(0.5, 'rgba(5,10,24,0.86)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, widthCss, heightCss);

      for (let star = 0; star < 36; star += 1) {
        const x = (Math.sin(star * 82.37) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(star * 47.11) * 0.5 + 0.5) * heightCss;
        const twinkle = 0.2 + ((Math.sin(time * 2.2 + star * 1.3) + 1) * 0.16);
        ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
        ctx.fillRect(x, y, 1.2, 1.2);
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.blurStrength, context.sharedUniforms]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-8%',
        width: '116%',
        height: '116%',
        opacity: context.isSettingsActive ? 0.96 : 0.88,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function EventHorizonTopBar({ context }) {
  const time = useClock(1.1);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-22% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 28%, ${context.accentColor}${alphaHex(0.22)} 50%, rgba(255,255,255,0.18) 72%, transparent 100%)`,
          filter: 'blur(9px)',
          mixBlendMode: 'screen',
          opacity: 0.86,
          transform: `translateX(${Math.sin(time * 0.62) * 14}%) scaleX(${1.02 + Math.cos(time * 0.3) * 0.08})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.08) 10px 12px, transparent 12px 26px)',
          opacity: 0.34,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function EventHorizonBorder({ context }) {
  const time = useClock(1.5);
  const pulse = 0.32 + Math.sin(time * 1.8) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 22px ${context.accentColor}${alphaHex(pulse * 0.6)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-26%, -26%) rotate(${time * 22}deg)` },
        { inset: '0 0 auto auto', transform: `translate(26%, -26%) rotate(${-time * 24}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-26%, 26%) rotate(${-time * 20}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(26%, 26%) rotate(${time * 18}deg)` },
      ].map((corner, index) => (
        <div
          key={`event-horizon-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 64,
            height: 64,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 38%, transparent 72%)`,
            filter: 'blur(10px)',
            opacity: 0.7,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Event Horizon',
  description: 'A singularity-driven shell treatment with orbital rings, debris trails, and a chrome slit-beam bar.',
  group: 'Authoring Extremes',
  tags: ['singularity', 'orbital', 'cinematic', 'canvas'],
  resolveSharedUniforms: context => ({
    intensity: clamp01(0.22 + context.blurStrength / 34 + context.zoom * 0.16 + (context.isSettingsActive ? 0.1 : 0)),
  }),
  background: {
    render: EventHorizonBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 54% 52%, ${context.accentColor}${alphaHex(0.08)}, transparent 26%)`,
        'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 62%)',
      ].join(', '),
    }),
  },
  topBar: {
    render: EventHorizonTopBar,
    resolveStyle: () => ({
      opacity: 0.72,
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: EventHorizonBorder,
  },
});
