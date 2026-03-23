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

function CathedralFogBackground({ context }) {
  const time = useClock(0.42);
  const haze = Number(context.sharedUniforms.haze ?? 0.6);
  const glow = Number(context.sharedUniforms.glow ?? 0.4);

  return (
    <div style={{ position: 'absolute', inset: '-18%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            `radial-gradient(circle at 50% 12%, rgba(255,255,255,${0.18 + glow * 0.14}), transparent 28%)`,
            `radial-gradient(circle at ${28 + Math.sin(time * 0.3) * 8}% ${24 + Math.cos(time * 0.2) * 10}%, ${context.accentColor}${alphaHex(0.16 + glow * 0.12)} 0%, transparent 22%)`,
            'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(6,10,18,0.02) 24%, rgba(4,7,14,0.44) 62%, rgba(3,5,10,0.78) 100%)',
          ].join(', '),
          filter: `blur(${20 + context.blurStrength * 0.28 + haze * 16}px) saturate(${1.08 + glow * 0.18})`,
          opacity: 0.9,
          mixBlendMode: 'screen',
          transform: `translate3d(${Math.sin(time * 0.16) * 2.5}%, ${Math.cos(time * 0.12) * 2.5}%, 0) scale(${1.04 + Math.sin(time * 0.14) * 0.03})`,
        }}
      />
      {[
        { left: 10, width: 14, delay: 0.2, tilt: -5 },
        { left: 28, width: 10, delay: 1.3, tilt: -2 },
        { left: 44, width: 12, delay: 2.1, tilt: 0 },
        { left: 62, width: 10, delay: 1.7, tilt: 3 },
        { left: 76, width: 14, delay: 0.9, tilt: 6 },
      ].map(column => (
        <div
          key={`cathedral-column-${column.left}`}
          style={{
            position: 'absolute',
            inset: `6% auto 4% ${column.left}%`,
            width: `${column.width}%`,
            borderRadius: '999px 999px 0 0',
            background: [
              'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03) 20%, rgba(0,0,0,0.22) 100%)',
              `radial-gradient(circle at 50% 6%, ${context.accentColor}${alphaHex(0.12)}, transparent 34%)`,
            ].join(', '),
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 36px rgba(255,255,255,0.03)`,
            opacity: 0.14 + haze * 0.12,
            filter: `blur(${4 + haze * 5}px)`,
            transform: `translateY(${Math.sin(time * 0.28 + column.delay) * 1.4}%) skewY(${column.tilt}deg)`,
          }}
        />
      ))}
      {[
        { inset: '-4% 8% 40% 8%', angle: 180, opacity: 0.28 },
        { inset: '4% 18% 22% 18%', angle: 176, opacity: 0.2 },
        { inset: '0% 30% 12% 30%', angle: 184, opacity: 0.16 },
      ].map((beam, index) => (
        <div
          key={`cathedral-beam-${index}`}
          style={{
            position: 'absolute',
            inset: beam.inset,
            background: `linear-gradient(${beam.angle + Math.sin(time * 0.16 + index) * 4}deg, rgba(255,255,255,0.42), ${context.accentColor}${alphaHex(0.12 + glow * 0.1)} 34%, transparent 72%)`,
            clipPath: 'polygon(44% 0%, 56% 0%, 80% 100%, 20% 100%)',
            filter: `blur(${14 + index * 6 + context.blurStrength * 0.14}px)`,
            opacity: beam.opacity + Math.sin(time * 0.34 + index) * 0.04,
            mixBlendMode: 'screen',
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 56px, rgba(255,255,255,0.035) 56px 58px, transparent 58px 114px)',
          opacity: 0.16 + haze * 0.1,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.12) * 1.4}%)`,
        }}
      />
    </div>
  );
}

function CathedralFogTopBar({ context }) {
  const time = useClock(0.94);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-24% -10%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 18%, ${context.accentColor}${alphaHex(0.18)} 50%, rgba(255,255,255,0.14) 82%, transparent 100%)`,
          filter: 'blur(10px)',
          opacity: 0.8,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.46) * 12}%) skewX(${Math.sin(time * 0.24) * 5}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 18px, rgba(255,255,255,0.06) 18px 20px, transparent 20px 42px)',
            `linear-gradient(180deg, rgba(255,255,255,0.08), ${context.accentColor}${alphaHex(0.08)} 72%, transparent 100%)`,
          ].join(', '),
          opacity: 0.34,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function CathedralFogBorder({ context }) {
  const time = useClock(1.06);
  const pulse = 0.22 + Math.sin(time * 1.3) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 22px rgba(255,255,255,0.03), 0 0 20px ${context.accentColor}${alphaHex(0.1)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', rotate: 18 },
        { inset: '0 0 auto auto', rotate: -18 },
        { inset: 'auto auto 0 0', rotate: -18 },
        { inset: 'auto 0 0 auto', rotate: 18 },
      ].map((corner, index) => (
        <div
          key={`cathedral-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `conic-gradient(from ${time * 42 + index * 80}deg, rgba(255,255,255,0.16), ${context.accentColor}${alphaHex(0.16)}, transparent 72%)`,
            clipPath: 'polygon(50% 0%, 88% 22%, 100% 58%, 78% 100%, 22% 100%, 0% 58%, 12% 22%)',
            filter: 'blur(7px)',
            opacity: 0.48,
            transform: `translate(${index % 2 === 0 ? -18 : 18}%, ${index < 2 ? -18 : 18}%) rotate(${corner.rotate + Math.sin(time * 0.6 + index) * 8}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Cathedral Fog',
  description: 'Vaulted fog volumes, ceremonial light shafts, and stained-glass chrome that make the shell feel like a futuristic nave.',
  group: 'Authoring Extremes',
  tags: ['cathedral', 'fog', 'volumetric', 'gothic'],
  controls: [
    { id: 'haze', label: 'Fog Density', description: 'Deepen or relax the volumetric nave haze.', min: 0, max: 1, step: 0.02 },
    { id: 'glow', label: 'Light Shaft Glow', description: 'Tune the ceremonial beam and stained-glass bloom.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    haze: clamp01(0.28 + context.blurStrength / 36 + context.panelTransparency * 0.28),
    glow: clamp01(0.2 + context.zoom * 0.18 + (context.isSettingsActive ? 0.08 : 0)),
  }),
  background: {
    render: CathedralFogBackground,
  },
  topBar: {
    render: CathedralFogTopBar,
  },
  border: {
    render: CathedralFogBorder,
  },
});
