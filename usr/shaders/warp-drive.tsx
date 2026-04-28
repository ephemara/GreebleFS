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

function WarpDriveBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(1.02);
  const warpFactor = Number(context.sharedUniforms.warpFactor ?? 0.64);
  const riftGlow = Number(context.sharedUniforms.riftGlow ?? 0.56);

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
      const centerY = heightCss * 0.54;
      const tunnelScale = Math.min(widthCss, heightCss) * (0.18 + warpFactor * 0.1);

      const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, tunnelScale * 3.4);
      core.addColorStop(0, `${context.accentColor}${alphaHex(0.18 + warpFactor * 0.08)}`);
      core.addColorStop(0.3, 'rgba(255,255,255,0.08)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      const rayCount = Math.round(lerp(48, 120, warpFactor));
      for (let ray = 0; ray < rayCount; ray += 1) {
        const seed = ray * 0.73;
        const progress = ray / Math.max(rayCount - 1, 1);
        const angle = seed * 0.19 + localTime * 0.28;
        const stretch = lerp(0.12, 1.35, progress) * (1 + Math.sin(localTime * 1.8 + seed) * 0.08);
        const nearX = centerX + Math.cos(angle) * tunnelScale * 0.12;
        const nearY = centerY + Math.sin(angle * 1.05) * tunnelScale * 0.12;
        const farX = centerX + Math.cos(angle) * widthCss * stretch * 0.8;
        const farY = centerY + Math.sin(angle) * heightCss * stretch * 0.8;

        ctx.strokeStyle = progress % 0.07 < 0.035
          ? `${context.accentColor}${alphaHex(0.08 + riftGlow * 0.12)}`
          : `rgba(255,255,255,${(0.04 + progress * 0.08).toFixed(3)})`;
        ctx.lineWidth = progress < 0.5 ? 1.4 - progress * 0.8 : 0.7;
        ctx.beginPath();
        ctx.moveTo(nearX, nearY);
        ctx.lineTo(farX, farY);
        ctx.stroke();
      }

      const ringCount = Math.round(lerp(8, 16, warpFactor));
      for (let ring = 0; ring < ringCount; ring += 1) {
        const progress = ring / Math.max(ringCount - 1, 1);
        const radius = tunnelScale * (0.4 + progress * 2.6);
        const wobble = Math.sin(localTime * 1.4 + ring * 0.8) * 6;
        ctx.strokeStyle = ring % 3 === 0
          ? `${context.accentColor}${alphaHex(0.18 + progress * 0.08)}`
          : 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 1 + progress * 1.6;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius, radius * (0.54 + progress * 0.22), wobble * Math.PI / 180, 0, Math.PI * 2);
        ctx.stroke();
      }

      const starCount = Math.round(lerp(18, 64, warpFactor));
      for (let star = 0; star < starCount; star += 1) {
        const seed = star * 1.37;
        const angle = seed * 3.4 + localTime * 0.45;
        const dist = tunnelScale * (0.3 + (star % 9) * 0.18);
        const x = centerX + Math.cos(angle) * dist * (1 + Math.sin(seed) * 0.14);
        const y = centerY + Math.sin(angle) * dist * 0.72;
        const size = 0.8 + (star % 4) * 0.55;
        ctx.fillStyle = star % 5 === 0 ? 'rgba(255,255,255,0.88)' : `${context.accentColor}${alphaHex(0.22 + (star % 3) * 0.08)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, riftGlow, warpFactor]);

  return (
    <div style={{ position: 'absolute', inset: '-14%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `radial-gradient(circle at 50% 52%, ${context.accentColor}${alphaHex(0.14 + warpFactor * 0.08)}, transparent 26%)`,
            'radial-gradient(circle at 24% 18%, rgba(255,255,255,0.08), transparent 14%)',
            'radial-gradient(circle at 80% 70%, rgba(110,231,255,0.08), transparent 18%)',
            'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 14%, rgba(255,255,255,0.02) 70%, transparent 100%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.24}px) saturate(${1.1 + riftGlow * 0.2})`,
          mixBlendMode: 'screen',
          opacity: 0.9,
          transform: `scale(1.03) translate3d(${Math.sin(time * 0.18) * 3}%, ${Math.cos(time * 0.14) * 2}%, 0)`,
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
          opacity: context.isSettingsActive ? 0.99 : 0.92,
        }}
      />
    </div>
  );
}

function WarpDriveTopBar({ context }) {
  const time = useClock(1.24);
  const streak = Number(context.sharedUniforms.streak ?? 0.44);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 18%, ${context.accentColor}${alphaHex(0.16)} 50%, rgba(255,255,255,0.12) 82%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.84,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.9) * 14}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.08) 12px 14px, transparent 14px 28px)',
            `radial-gradient(circle at ${48 + Math.sin(time * 1.2) * 8}% 28%, ${context.accentColor}${alphaHex(0.1 + streak * 0.08)}, transparent 22%)`,
          ].join(', '),
          opacity: 0.36,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function WarpDriveBorder({ context }) {
  const time = useClock(1.5);
  const pulse = 0.32 + Math.sin(time * 2.1) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 26px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-16%, -16%) rotate(${time * 24}deg)` },
        { inset: '0 0 auto auto', transform: `translate(16%, -16%) rotate(${-time * 22}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-16%, 16%) rotate(${-time * 18}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(16%, 16%) rotate(${time * 20}deg)` },
      ].map((corner, index) => (
        <div
          key={`warp-drive-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 54,
            height: 54,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 42%, transparent 72%)`,
            filter: 'blur(7px)',
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
    transform: `perspective(1600px) translate3d(0, ${lerp(30, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.76, 1, active) : lerp(1, 0.78, progress)}) rotateY(${direction === 'enter' ? lerp(-22, 0, active) : lerp(0, 18, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(22, 0, active) : lerp(0, 22, progress)}px) saturate(${direction === 'enter' ? lerp(0.68, 1.1, active) : lerp(1.1, 0.7, progress)}) brightness(${direction === 'enter' ? lerp(0.74, 1, active) : lerp(1, 0.68, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineShader({
  name: 'Warp Drive',
  description: 'A perspective tunnel of star streaks and ringed drive fields that feels like impulse ignition.',
  group: 'Authoring Extremes',
  tags: ['warp', 'tunnel', 'streaks', 'stars'],
  controls: [
    { id: 'warpFactor', label: 'Warp Factor', description: 'Deepen the tunnel pull and star-field compression.', min: 0, max: 1, step: 0.02 },
    { id: 'riftGlow', label: 'Rift Glow', description: 'Strengthen the bright core and ring glow.', min: 0, max: 1, step: 0.02 },
    { id: 'streak', label: 'Streak Density', description: 'Adjust the amount of bar and streak motion.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    warpFactor: clamp01(0.28 + context.blurStrength / 34 + context.panelTransparency * 0.22 + (context.isSettingsActive ? 0.08 : 0)),
    riftGlow: clamp01(0.2 + context.zoom * 0.12 + context.viewport.width / 3000),
    streak: clamp01(0.2 + context.zoom * 0.1 + context.panelTransparency * 0.16 + (context.isSettingsActive ? 0.06 : 0)),
  }),
  background: {
    render: WarpDriveBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 52%, ${context.accentColor}${alphaHex(0.08)}, transparent 24%)`,
        'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.06), transparent 14%)',
        'radial-gradient(circle at 84% 74%, rgba(110,231,255,0.08), transparent 18%)',
      ].join(', '),
      opacity: 0.94,
      mixBlendMode: 'screen',
    }),
  },
  topBar: {
    render: WarpDriveTopBar,
    resolveStyle: context => ({
      opacity: 0.72,
      filter: 'blur(8px) saturate(1.16)',
      transform: 'scale(1.05)',
      mixBlendMode: 'screen' as const,
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 40%, ${context.accentColor}${alphaHex(0.12)} 50%, rgba(255,255,255,0.12) 60%, transparent 100%)`,
    }),
  },
  border: {
    render: WarpDriveBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.26)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 24px ${context.accentColor}${alphaHex(0.14)}`,
    }),
  },
});
