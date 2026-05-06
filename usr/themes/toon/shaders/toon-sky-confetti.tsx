import React, { useEffect, useState } from 'react';
import { clamp01, defineShader, lerp } from 'overlayterm-shader';

const CONFETTI = [
  { left: 12, top: 18, rotate: -18, color: '#73B9FF' },
  { left: 24, top: 66, rotate: 12, color: '#FFB4B0' },
  { left: 38, top: 22, rotate: 26, color: '#FFD36B' },
  { left: 52, top: 58, rotate: -12, color: '#78D4AB' },
  { left: 66, top: 24, rotate: 18, color: '#B899FF' },
  { left: 78, top: 68, rotate: -22, color: '#73B9FF' },
  { left: 88, top: 28, rotate: 10, color: '#FF9BB0' },
];

function useClock(speed = 1) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame = 0;

    const tick = (now) => {
      setTime(now * 0.001 * speed);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [speed]);

  return time;
}

function alphaHex(value) {
  return Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, '0');
}

function ToonBackdrop({ context }) {
  const time = useClock(0.56);
  const breeze = Number(context.sharedUniforms.breeze ?? 0.52);
  const sparkle = Number(context.sharedUniforms.sparkle ?? 0.6);
  const haze = Number(context.sharedUniforms.haze ?? 0.48);
  const sunX = 72 + Math.sin(time * 0.12) * 4.5;
  const sunY = 15 + Math.cos(time * 0.14) * 3.6;
  const puffOffset = Math.sin(time * 0.22) * breeze * 16;

  return (
    <div style={{ position: 'absolute', inset: '-12%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `radial-gradient(circle at ${sunX}% ${sunY}%, rgba(255, 227, 128, ${0.32 + haze * 0.18}) 0%, transparent 16%)`,
            `radial-gradient(circle at ${18 + Math.cos(time * 0.16) * 4}% ${16 + Math.sin(time * 0.18) * 4}%, rgba(255, 214, 226, ${0.24 + haze * 0.12}) 0%, transparent 18%)`,
            `radial-gradient(circle at ${48 + Math.cos(time * 0.11) * 5}% ${64 + Math.sin(time * 0.13) * 5}%, rgba(183, 234, 206, ${0.18 + haze * 0.1}) 0%, transparent 22%)`,
            'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,248,240,0.92) 42%, rgba(255,238,223,0.98) 100%)',
          ].join(', '),
          filter: `blur(${lerp(20, 36, haze) + context.blurStrength * 0.18}px) saturate(${1.06 + haze * 0.16})`,
          transform: `translate3d(${Math.sin(time * 0.1) * breeze * 4}%, ${Math.cos(time * 0.08) * breeze * 2}%, 0)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '14% 8% auto 8%',
          height: '34%',
          background: [
            'radial-gradient(circle at 14% 46%, rgba(255,255,255,0.94) 0 8%, transparent 9%)',
            'radial-gradient(circle at 21% 43%, rgba(255,255,255,0.86) 0 6.5%, transparent 7%)',
            'radial-gradient(circle at 54% 38%, rgba(255,255,255,0.94) 0 9%, transparent 10%)',
            'radial-gradient(circle at 62% 42%, rgba(255,255,255,0.84) 0 6.5%, transparent 7%)',
            'radial-gradient(circle at 82% 44%, rgba(255,255,255,0.92) 0 8.5%, transparent 9.5%)',
          ].join(', '),
          opacity: 0.88,
          transform: `translate3d(${puffOffset}px, ${Math.sin(time * 0.22) * 6}px, 0)`,
          filter: `blur(${8 + haze * 6}px)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '18% 0 0 0',
          background:
            'radial-gradient(circle, rgba(115,185,255,0.12) 0 1.4px, transparent 1.6px)',
          backgroundSize: '22px 22px',
          opacity: 0.34 + sparkle * 0.14,
          mixBlendMode: 'multiply',
        }}
      />

      {CONFETTI.map((piece, index) => {
        const driftX = Math.sin(time * (0.3 + index * 0.06)) * (10 + breeze * 18);
        const driftY = Math.cos(time * (0.24 + index * 0.04)) * (8 + breeze * 14);
        const twinkle = 0.58 + Math.sin(time * (1.2 + index * 0.08)) * 0.18;
        return (
          <div
            key={`toon-confetti-${index}`}
            style={{
              position: 'absolute',
              left: `${piece.left}%`,
              top: `${piece.top}%`,
              width: 18,
              height: 12,
              borderRadius: 6,
              border: '1px solid rgba(68, 80, 107, 0.14)',
              background: piece.color,
              opacity: clamp01(twinkle + sparkle * 0.2),
              transform: `translate3d(${driftX}px, ${driftY}px, 0) rotate(${piece.rotate + Math.sin(time * 0.7 + index) * 8}deg)`,
              boxShadow: `0 12px 26px ${piece.color}${alphaHex(0.18 + sparkle * 0.12)}`,
            }}
          />
        );
      })}

      <div
        style={{
          position: 'absolute',
          inset: 'auto -8% -4% -8%',
          height: '36%',
          background: [
            'radial-gradient(circle at 16% 18%, rgba(183,234,206,0.88) 0 18%, transparent 20%)',
            'radial-gradient(circle at 46% 22%, rgba(197,225,255,0.86) 0 22%, transparent 24%)',
            'radial-gradient(circle at 72% 16%, rgba(255,214,226,0.84) 0 20%, transparent 22%)',
            'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0))',
          ].join(', '),
          filter: `blur(${18 + haze * 8}px)`,
          opacity: 0.82,
        }}
      />
    </div>
  );
}

function ToonTopBarAura({ context }) {
  const time = useClock(0.8);
  const sparkle = Number(context.sharedUniforms.sparkle ?? 0.6);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-16% -6%',
          background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(0.14 + sparkle * 0.12)} 22%, rgba(255,255,255,0.34) 50%, ${context.accentColor}${alphaHex(0.12 + sparkle * 0.1)} 78%, transparent 100%)`,
          filter: 'blur(8px)',
          transform: `translateX(${Math.sin(time * 0.42) * 8}%)`,
          mixBlendMode: 'screen',
          opacity: 0.82,
        }}
      />
      {[18, 48, 78].map((left, index) => (
        <div
          key={`toon-topbar-spark-${index}`}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: '40%',
            width: 4,
            height: 4,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.92)',
            boxShadow: `0 0 10px ${context.accentColor}${alphaHex(0.16 + sparkle * 0.1)}`,
            transform: `translateY(${Math.sin(time + index) * 2}px) scale(${0.9 + Math.sin(time * 1.2 + index) * 0.12})`,
          }}
        />
      ))}
    </div>
  );
}

function ToonBorderGloss({ context }) {
  const time = useClock(1);
  const pulse = 0.14 + Math.sin(time * 1.1) * 0.04;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 28,
          boxShadow: `inset 0 0 0 1px ${context.accentColor}${alphaHex(0.16)}, 0 0 24px ${context.accentColor}${alphaHex(pulse)}`,
        }}
      />
      {[0, 1, 2, 3].map(index => (
        <div
          key={`toon-corner-${index}`}
          style={{
            position: 'absolute',
            inset:
              index === 0
                ? '0 auto auto 0'
                : index === 1
                  ? '0 0 auto auto'
                  : index === 2
                    ? 'auto auto 0 0'
                    : 'auto 0 0 auto',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.22) 0%, ${context.accentColor}${alphaHex(0.12)} 42%, transparent 72%)`,
            filter: 'blur(8px)',
            opacity: 0.34 + Math.sin(time * 1.4 + index) * 0.05,
            transform:
              index === 0
                ? 'translate(-18%, -18%)'
                : index === 1
                  ? 'translate(18%, -18%)'
                  : index === 2
                    ? 'translate(-18%, 18%)'
                    : 'translate(18%, 18%)',
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Toon Sky Confetti',
  description: 'Pastel cloud drift, halftone shine, and buoyant confetti for the Toon shell.',
  group: 'Theme Local',
  tags: ['toon', 'pastel', 'confetti', 'clouds'],
  controls: [
    {
      id: 'breeze',
      label: 'Breeze',
      description: 'Push the clouds and confetti harder across the shell.',
      min: 0,
      max: 1,
      step: 0.02,
    },
    {
      id: 'sparkle',
      label: 'Sparkle',
      description: 'Boost top-bar glints and confetti shimmer.',
      min: 0,
      max: 1,
      step: 0.02,
    },
    {
      id: 'haze',
      label: 'Haze',
      description: 'Increase the soft paper glow and cloud bloom.',
      min: 0,
      max: 1,
      step: 0.02,
    },
  ],
  resolveSharedUniforms: context => ({
    breeze: clamp01(0.3 + context.zoom * 0.16 + context.panelTransparency * 0.22),
    sparkle: clamp01(0.42 + context.blurStrength / 48 + (context.isSettingsActive ? 0.1 : 0)),
    haze: clamp01(0.32 + context.panelTransparency * 0.34 + context.viewport.width / 4200),
  }),
  background: {
    render: ToonBackdrop,
  },
  topBar: {
    render: ToonTopBarAura,
    resolveStyle: () => ({
      opacity: 0.9,
      filter: 'blur(8px) saturate(1.08)',
      transform: 'scale(1.03)',
      mixBlendMode: 'screen',
    }),
  },
  border: {
    render: ToonBorderGloss,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.12)}`,
      boxShadow: `0 0 18px ${context.accentColor}${alphaHex(0.08)}`,
    }),
  },
});
