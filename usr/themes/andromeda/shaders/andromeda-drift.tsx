import React, { useEffect, useState } from 'react';
import { clamp01, defineShader, lerp } from 'overlayterm-shader';

const STAR_POINTS = [
  { left: 8, top: 14, size: 1.05, drift: 0.18 },
  { left: 16, top: 58, size: 0.72, drift: 0.24 },
  { left: 23, top: 26, size: 0.86, drift: 0.14 },
  { left: 29, top: 72, size: 0.94, drift: 0.2 },
  { left: 38, top: 16, size: 0.68, drift: 0.16 },
  { left: 46, top: 48, size: 1.14, drift: 0.22 },
  { left: 55, top: 24, size: 0.8, drift: 0.18 },
  { left: 62, top: 66, size: 1.02, drift: 0.26 },
  { left: 71, top: 18, size: 0.7, drift: 0.15 },
  { left: 76, top: 44, size: 0.9, drift: 0.21 },
  { left: 83, top: 28, size: 1.18, drift: 0.19 },
  { left: 88, top: 62, size: 0.74, drift: 0.23 },
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

function DeepFieldBackground({ context }) {
  const time = useClock(0.58);
  const nebula = Number(context.sharedUniforms.nebula ?? 0.54);
  const starlight = Number(context.sharedUniforms.starlight ?? 0.72);
  const drift = Number(context.sharedUniforms.drift ?? 0.38);
  const crownX = 76 + (Math.sin(time * 0.17) * 3.5);
  const crownY = 17 + (Math.cos(time * 0.13) * 4.5);

  return (
    <div style={{ position: 'absolute', inset: '-18%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            `radial-gradient(circle at ${crownX}% ${crownY}%, rgba(255,255,255,${0.06 + (starlight * 0.08)}), transparent 13%)`,
            `radial-gradient(circle at ${70 + (Math.sin(time * 0.16) * 4)}% ${20 + (Math.cos(time * 0.2) * 5)}%, ${context.accentColor}${alphaHex(0.26 + (nebula * 0.18))} 0%, transparent 22%)`,
            `radial-gradient(circle at ${38 + (Math.cos(time * 0.14) * 6)}% ${72 + (Math.sin(time * 0.19) * 5)}%, rgba(200,187,255,${0.18 + (nebula * 0.08)}), transparent 24%)`,
            `radial-gradient(circle at 54% 54%, rgba(255,255,255,${0.04 + (starlight * 0.04)}), transparent 18%)`,
            'linear-gradient(180deg, rgba(255,255,255,0.03), transparent 28%)',
          ].join(', '),
          filter: `blur(${lerp(34, 52, nebula) + (context.blurStrength * 0.3)}px) saturate(${1.1 + (nebula * 0.28)}) brightness(${1.01 + (nebula * 0.12)})`,
          transform: `translate3d(${Math.sin(time * 0.12) * drift * 5}%, ${Math.cos(time * 0.1) * drift * 3}%, 0) scale(${1.03 + (nebula * 0.05)})`,
          opacity: 0.82 + (nebula * 0.12),
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '11% -10% 42% 48%',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: `0 0 64px ${context.accentColor}${alphaHex(0.16 + (nebula * 0.18))}`,
          opacity: 0.34 + (nebula * 0.14),
          transform: `rotate(-12deg) scale(${1.02 + (Math.sin(time * 0.16) * 0.04)})`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '28% 24% 18% 18%',
          background: [
            `linear-gradient(120deg, transparent 8%, rgba(255,255,255,${0.06 + (starlight * 0.04)}) 38%, transparent 62%)`,
            `linear-gradient(145deg, transparent 22%, rgba(143,231,255,${0.09 + (nebula * 0.04)}) 58%, transparent 86%)`,
          ].join(', '),
          filter: 'blur(28px)',
          opacity: 0.22,
          mixBlendMode: 'screen',
          transform: `translate3d(${Math.cos(time * 0.14) * 2.5}%, ${Math.sin(time * 0.11) * 2}%, 0) rotate(${Math.sin(time * 0.08) * 2.5}deg)`,
        }}
      />

      {STAR_POINTS.map((star, index) => {
        const twinkle = 0.48 + (Math.sin(time * (0.72 + star.drift) + index) * 0.26);
        const travelX = Math.sin(time * (0.16 + star.drift) + index) * (3 + (star.drift * 10));
        const travelY = Math.cos(time * (0.14 + star.drift) + index) * (2 + (star.drift * 6));
        const scale = 0.65 + star.size + (twinkle * 0.12);
        const glow = 0.2 + (starlight * 0.16) + (twinkle * 0.12);

        return (
          <div
            key={`andromeda-star-${index}`}
            style={{
              position: 'absolute',
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: 4,
              height: 4,
              borderRadius: '999px',
              background: 'rgba(247,251,255,0.96)',
              opacity: clamp01((starlight * 0.44) + twinkle),
              boxShadow: `0 0 ${10 + (star.size * 8)}px ${context.accentColor}${alphaHex(glow)}`,
              transform: `translate3d(${travelX}px, ${travelY}px, 0) scale(${scale})`,
            }}
          />
        );
      })}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            `repeating-radial-gradient(circle at ${crownX}% ${crownY}%, rgba(255,255,255,0.14) 0 1px, transparent 1px 34px)`,
            'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 22%)',
          ].join(', '),
          opacity: 0.24 + (starlight * 0.08),
          mixBlendMode: 'screen',
          transform: `translate3d(${Math.sin(time * 0.08) * 2}%, 0, 0)`,
        }}
      />
    </div>
  );
}

function StellarTopBar({ context }) {
  const time = useClock(0.92);
  const starlight = Number(context.sharedUniforms.starlight ?? 0.72);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(0.14 + (starlight * 0.14))} 24%, rgba(255,255,255,0.18) 50%, ${context.accentColor}${alphaHex(0.12 + (starlight * 0.1))} 76%, transparent 100%)`,
          filter: 'blur(8px)',
          mixBlendMode: 'screen',
          opacity: 0.72,
          transform: `translateX(${Math.sin(time * 0.4) * 8}%)`,
        }}
      />
      {[22, 52, 82].map((left, index) => (
        <div
          key={`andromeda-topbar-star-${index}`}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: '38%',
            width: 3,
            height: 3,
            borderRadius: '999px',
            background: 'rgba(247,251,255,0.92)',
            opacity: 0.42 + (Math.sin(time * 1.2 + index) * 0.12),
            boxShadow: `0 0 10px ${context.accentColor}${alphaHex(0.18 + (starlight * 0.1))}`,
            transform: `translateY(${Math.sin(time * 0.9 + index) * 1.5}px) scale(${0.9 + (Math.sin(time * 1.1 + index) * 0.08)})`,
          }}
        />
      ))}
    </div>
  );
}

function FrameHalo({ context }) {
  const time = useClock(1.08);
  const pulse = 0.18 + (Math.sin(time * 1.2) * 0.04);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {[
        { inset: '0 0 auto 0', width: '100%', height: 1.5, axis: 'horizontal' },
        { inset: 'auto 0 0 0', width: '100%', height: 1.5, axis: 'horizontal' },
        { inset: '0 auto 0 0', width: 1.5, height: '100%', axis: 'vertical' },
        { inset: '0 0 0 auto', width: 1.5, height: '100%', axis: 'vertical' },
      ].map((rail, index) => (
        <div
          key={`andromeda-border-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.width,
            height: rail.height,
            background: rail.axis === 'horizontal'
              ? `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(pulse)} 24%, rgba(255,255,255,0.62) 50%, ${context.accentColor}${alphaHex(pulse)} 76%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, ${context.accentColor}${alphaHex(pulse)} 24%, rgba(255,255,255,0.62) 50%, ${context.accentColor}${alphaHex(pulse)} 76%, transparent 100%)`,
            opacity: 0.74,
          }}
        />
      ))}
      {[0, 1, 2, 3].map((index) => (
        <div
          key={`andromeda-corner-${index}`}
          style={{
            position: 'absolute',
            inset: index === 0
              ? '0 auto auto 0'
              : index === 1
                ? '0 0 auto auto'
                : index === 2
                  ? 'auto auto 0 0'
                  : 'auto 0 0 auto',
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 42%, transparent 74%)`,
            filter: 'blur(8px)',
            opacity: 0.32 + (Math.sin(time * 1.3 + index) * 0.05),
            transform: index === 0
              ? 'translate(-16%, -16%)'
              : index === 1
                ? 'translate(16%, -16%)'
                : index === 2
                  ? 'translate(-16%, 16%)'
                  : 'translate(16%, 16%)',
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Andromeda Drift',
  description: 'Slow-moving crown light, deep-field stars, and precise shell rails for a restrained galactic atmosphere.',
  group: 'Theme Local',
  tags: ['andromeda', 'space', 'deep-field', 'minimal'],
  controls: [
    {
      id: 'nebula',
      label: 'Nebula',
      description: 'Boost the diffuse crown glow and shell bloom.',
      min: 0,
      max: 1,
      step: 0.02,
    },
    {
      id: 'starlight',
      label: 'Starlight',
      description: 'Control star brightness and chrome sparkle.',
      min: 0,
      max: 1,
      step: 0.02,
    },
    {
      id: 'drift',
      label: 'Drift',
      description: 'Adjust how much the field glides across the shell.',
      min: 0,
      max: 1,
      step: 0.02,
    },
  ],
  resolveSharedUniforms: context => ({
    nebula: clamp01(0.4 + (context.panelTransparency * 0.42) + (context.blurStrength / 56)),
    starlight: clamp01(0.54 + (context.zoom * 0.14) + (context.isSettingsActive ? 0.12 : 0)),
    drift: clamp01(0.24 + (context.viewport.width / 3400)),
  }),
  background: {
    render: DeepFieldBackground,
  },
  topBar: {
    render: StellarTopBar,
    resolveStyle: () => ({
      opacity: 0.88,
      filter: 'blur(9px) saturate(1.14)',
      transform: 'scale(1.04)',
      mixBlendMode: 'screen',
    }),
  },
  border: {
    render: FrameHalo,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.16)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 24px ${context.accentColor}${alphaHex(0.1)}`,
    }),
  },
});
