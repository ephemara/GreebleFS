import React, { useEffect, useState } from 'react';
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

function VaporSunriseBackground({ context }) {
  const time = useClock(0.7);
  const glow = Number(context.sharedUniforms.glow ?? 0.62);
  const haze = Number(context.sharedUniforms.haze ?? 0.44);
  const drift = Number(context.sharedUniforms.drift ?? 0.28);

  return (
    <div style={{ position: 'absolute', inset: '-18%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            `radial-gradient(circle at 50% 32%, ${context.accentColor}${alphaHex(0.16 + glow * 0.12)}, transparent 22%)`,
            'radial-gradient(circle at 50% 72%, rgba(255,120,170,0.16), transparent 26%)',
            'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,170,220,0.04) 28%, rgba(20,16,48,0.02) 52%, rgba(7,8,18,0.14) 100%)',
          ].join(', '),
          filter: `blur(${18 + haze * 18 + context.blurStrength * 0.2}px) saturate(${1.14 + glow * 0.38})`,
          opacity: 0.92,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `linear-gradient(${92 + Math.sin(time * 0.3) * 4}deg, transparent 0%, rgba(255,255,255,0.08) 18%, ${context.accentColor}${alphaHex(0.18)} 34%, transparent 52%, rgba(84,189,255,0.16) 72%, transparent 92%)`,
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 28px)',
          ].join(', '),
          filter: `blur(${4 + haze * 4}px)`,
          mixBlendMode: 'screen',
          opacity: 0.38 + glow * 0.12,
          transform: `translate3d(0, ${Math.sin(time * 0.22) * 2}%, 0) scale(1.06)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '30%',
          width: '34%',
          height: '34%',
          transform: `translate(-50%, -50%) rotate(${Math.sin(time * 0.18) * 4}deg) scale(${1 + glow * 0.03})`,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,0.62) 0%, rgba(255,214,238,0.42) 26%, ${context.accentColor}${alphaHex(0.22 + glow * 0.08)} 46%, rgba(255,160,210,0.08) 62%, transparent 74%)`,
          filter: `blur(${lerp(8, 18, glow)}px)`,
          opacity: 0.9,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '53%',
          width: '72%',
          height: '20%',
          transform: `translate(-50%, -50%) scaleX(${1 + drift * 0.12})`,
          background: `linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 36%, ${context.accentColor}${alphaHex(0.16)} 52%, rgba(255,120,170,0.1) 68%, transparent 100%)`,
          filter: `blur(${8 + haze * 6}px)`,
          opacity: 0.8,
          clipPath: 'polygon(0 64%, 8% 62%, 15% 66%, 24% 61%, 35% 64%, 46% 60%, 56% 65%, 68% 62%, 79% 66%, 90% 60%, 100% 64%, 100% 100%, 0 100%)',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function VaporSunriseTopBar({ context }) {
  const time = useClock(1.15);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-22% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 25%, ${context.accentColor}${alphaHex(0.16)} 50%, rgba(255,255,255,0.14) 75%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.76,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.62) * 14}%)`,
        }}
      />
    </div>
  );
}

function VaporSunriseBorder({ context }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}33`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 16px ${context.accentColor}18`,
        }}
      />
    </div>
  );
}

export default defineShader({
  name: 'Vapor Sunrise',
  description: 'A soft neon dawn with pastel haze, a low sun, and subtle scanlines that keep the shell feeling warm and airy.',
  group: 'Vaporwave',
  tags: ['vaporwave', 'sunrise', 'pastel', 'atmosphere'],
  controls: [
    { id: 'glow', label: 'Sun Glow', description: 'Drive the bloom of the rising sun and surrounding halo.', min: 0, max: 1, step: 0.02 },
    { id: 'haze', label: 'Haze', description: 'Increase softness, bloom spread, and atmospheric diffusion.', min: 0, max: 1, step: 0.02 },
    { id: 'drift', label: 'Drift', description: 'Adjust the motion of the scanlines and horizon shimmer.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    glow: clamp01(0.38 + context.panelTransparency * 0.26 + context.blurStrength / 60 + (context.isSettingsActive ? 0.08 : 0)),
    haze: clamp01(0.18 + context.blurStrength / 42 + context.zoom * 0.08),
    drift: clamp01(0.18 + context.viewport.width / 5000 + context.panelTransparency * 0.18),
  }),
  background: {
    render: VaporSunriseBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 32%, rgba(255,255,255,0.06), transparent 18%)',
        `radial-gradient(circle at 50% 58%, ${context.accentColor}${alphaHex(0.12)}, transparent 34%)`,
        'linear-gradient(180deg, rgba(255,205,230,0.12) 0%, rgba(70,56,130,0.08) 42%, rgba(8,10,20,0.12) 100%)',
      ].join(', '),
      opacity: 0.98,
      mixBlendMode: 'screen' as const,
    }),
  },
  topBar: {
    render: VaporSunriseTopBar,
    resolveStyle: () => ({
      opacity: 0.7,
      filter: 'blur(7px)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: VaporSunriseBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}26`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px ${context.accentColor}12`,
    }),
  },
});
