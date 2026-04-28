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

function PhaseChamberBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.75);
  const phaseDepth = Number(context.sharedUniforms.phaseDepth ?? 0.56);
  const ringCount = Math.max(5, Math.round(Number(context.sharedUniforms.ringCount ?? 8)));

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
      const centerX = widthCss * 0.5;
      const centerY = heightCss * 0.52;
      const chamberRadius = Math.min(widthCss, heightCss) * (0.24 + phaseDepth * 0.08);

      const bloom = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, chamberRadius * 2.4);
      bloom.addColorStop(0, `${context.accentColor}${alphaHex(0.2 + phaseDepth * 0.1)}`);
      bloom.addColorStop(0.45, 'rgba(255,255,255,0.06)');
      bloom.addColorStop(1, 'rgba(2,4,10,0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      for (let ring = 0; ring < ringCount; ring += 1) {
        const progress = ring / Math.max(ringCount - 1, 1);
        const radius = chamberRadius * (0.44 + progress * 1.32);
        const tilt = Math.sin(localTime * 0.8 + progress * 5.4) * (8 + progress * 18);
        const thickness = 1.2 + progress * 2.8;
        const opacity = 0.14 + (1 - progress) * 0.28;
        const span = Math.PI * (1.1 + progress * 0.72);
        const start = localTime * (0.34 + progress * 0.18) + progress * Math.PI * 0.66;

        ctx.strokeStyle = progress < 0.48
          ? `${context.accentColor}${alphaHex(opacity)}`
          : `rgba(255,255,255,${(opacity * 0.72).toFixed(3)})`;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius, radius * (0.62 + progress * 0.24), tilt * Math.PI / 180, start, start + span);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255,255,255,${(0.06 + progress * 0.08).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius * 0.88, radius * 0.55, -tilt * 0.7 * Math.PI / 180, start + 0.4, start + span - 0.2);
        ctx.stroke();
      }

      for (let spoke = 0; spoke < 18; spoke += 1) {
        const angle = (spoke / 18) * Math.PI * 2 + localTime * 0.24;
        const inner = chamberRadius * 0.2;
        const outer = chamberRadius * (1.6 + Math.sin(localTime * 0.5 + spoke) * 0.08);
        ctx.strokeStyle = spoke % 3 === 0
          ? `${context.accentColor}${alphaHex(0.16)}`
          : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = spoke % 4 === 0 ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner * 0.82);
        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer * 0.82);
        ctx.stroke();
      }

      const shardCount = Math.round(lerp(26, 52, phaseDepth));
      for (let shard = 0; shard < shardCount; shard += 1) {
        const seed = shard * 0.73;
        const angle = seed * 1.82 + localTime * (0.6 + (shard % 7) * 0.03);
        const orbit = chamberRadius * (0.28 + (shard % 9) * 0.082);
        const drift = Math.sin(seed * 3.2 + localTime * 1.3) * chamberRadius * 0.09;
        const x = centerX + Math.cos(angle) * orbit + drift * 0.22;
        const y = centerY + Math.sin(angle * 0.94) * orbit * 0.72 + drift;
        const size = 1 + (shard % 4) * 0.8;
        ctx.fillStyle = shard % 5 === 0
          ? 'rgba(255,255,255,0.8)'
          : `${context.accentColor}${alphaHex(0.24 + (shard % 3) * 0.1)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, phaseDepth, ringCount]);

  return (
    <div style={{ position: 'absolute', inset: '-12%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          background: [
            `radial-gradient(circle at 50% 48%, ${context.accentColor}${alphaHex(0.18 + phaseDepth * 0.08)} 0%, transparent 24%)`,
            'radial-gradient(circle at 22% 24%, rgba(255,255,255,0.12) 0%, transparent 14%)',
            'radial-gradient(circle at 80% 72%, rgba(110,231,255,0.12) 0%, transparent 18%)',
            'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 24%, rgba(255,255,255,0.03) 82%, transparent 100%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.3}px) saturate(${1.1 + phaseDepth * 0.22})`,
          mixBlendMode: 'screen',
          opacity: 0.86,
          transform: `translate3d(${Math.sin(time * 0.22) * 4}%, ${Math.cos(time * 0.17) * 2}%, 0) scale(1.04)`,
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
          opacity: context.isSettingsActive ? 0.98 : 0.9,
        }}
      />
    </div>
  );
}

function PhaseChamberTopBar({ context }) {
  const time = useClock(1.1);
  const barLift = Number(context.sharedUniforms.barLift ?? 0.42);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 18%, ${context.accentColor}${alphaHex(0.18)} 50%, rgba(255,255,255,0.16) 82%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.82,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.5) * 12}%) skewX(${Math.sin(time * 0.3) * 4}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,0.07) 14px 16px, transparent 16px 34px)',
            `linear-gradient(180deg, rgba(255,255,255,0.08), transparent 58%)`,
            `radial-gradient(circle at ${52 + Math.sin(time * 0.8) * 8}% 26%, ${context.accentColor}${alphaHex(0.14 + barLift * 0.08)}, transparent 24%)`,
          ].join(', '),
          opacity: 0.34,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function PhaseChamberBorder({ context }) {
  const time = useClock(1.35);
  const pulse = 0.3 + Math.sin(time * 1.8) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 28px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-18%, -18%) rotate(${time * 16}deg)` },
        { inset: '0 0 auto auto', transform: `translate(18%, -18%) rotate(${-time * 18}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-18%, 18%) rotate(${-time * 14}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(18%, 18%) rotate(${time * 20}deg)` },
      ].map((corner, index) => (
        <div
          key={`phase-chamber-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 56,
            height: 56,
            background: `conic-gradient(from ${time * 90}deg, rgba(255,255,255,0.16), ${context.accentColor}${alphaHex(0.2)}, transparent 72%)`,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            filter: 'blur(6px)',
            opacity: 0.62,
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
    transform: `perspective(1300px) translate3d(0, ${lerp(24, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.8, 1, active) : lerp(1, 0.86, progress)}) rotateX(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, -10, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(16, 0, active) : lerp(0, 18, progress)}px) saturate(${direction === 'enter' ? lerp(0.72, 1.06, active) : lerp(1.06, 0.72, progress)}) brightness(${direction === 'enter' ? lerp(0.82, 1, active) : lerp(1, 0.76, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineShader({
  name: 'Phase Chamber',
  description: 'A glass chamber of rotating phase rings, radial calibration beams, and a restrained sci-fi bloom.',
  group: 'Authoring Extremes',
  tags: ['phase', 'chamber', 'rings', 'calibration'],
  controls: [
    { id: 'phaseDepth', label: 'Phase Depth', description: 'Push the chamber depth and ring bloom intensity.', min: 0, max: 1, step: 0.02 },
    { id: 'ringCount', label: 'Ring Count', description: 'Increase or reduce the number of phase rings.', min: 5, max: 14, step: 1, formatValue: value => `${Math.round(value)} rings` },
    { id: 'barLift', label: 'Bar Lift', description: 'Tune the brightness lift in the top bar calibration beam.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    phaseDepth: clamp01(0.26 + context.blurStrength / 36 + context.panelTransparency * 0.2 + (context.isSettingsActive ? 0.08 : 0)),
    ringCount: Math.max(5, Math.round(6 + context.viewport.width / 900)),
    barLift: clamp01(0.24 + context.zoom * 0.12),
  }),
  background: {
    render: PhaseChamberBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 54%, ${context.accentColor}${alphaHex(0.08)}, transparent 24%)`,
        'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.08), transparent 16%)',
        'radial-gradient(circle at 78% 26%, rgba(255,255,255,0.06), transparent 20%)',
      ].join(', '),
      opacity: 0.92,
      mixBlendMode: 'screen',
    }),
  },
  topBar: {
    render: PhaseChamberTopBar,
    resolveStyle: context => ({
      opacity: 0.76,
      filter: 'blur(8px) saturate(1.14)',
      transform: 'scale(1.05)',
      mixBlendMode: 'screen' as const,
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 40%, ${context.accentColor}${alphaHex(0.12)} 50%, rgba(255,255,255,0.12) 60%, transparent 100%)`,
    }),
  },
  border: {
    render: PhaseChamberBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.28)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 20px ${context.accentColor}${alphaHex(0.12)}`,
    }),
  },
});
