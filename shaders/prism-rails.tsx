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

function PrismBackground({ context }) {
  const time = useClock(0.82);
  const chroma = Number(context.sharedUniforms.chroma ?? 0.56);
  const railEnergy = Number(context.sharedUniforms.railEnergy ?? 0.46);

  return (
    <div style={{ position: 'absolute', inset: '-18%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            `conic-gradient(from ${time * 34}deg at 50% 50%, rgba(255,255,255,0.14), ${context.accentColor}${alphaHex(0.18 + railEnergy * 0.1)}, rgba(56,189,248,0.18), rgba(255,255,255,0.1), rgba(244,114,182,0.16), ${context.accentColor}${alphaHex(0.16)})`,
            `radial-gradient(circle at ${22 + Math.sin(time * 0.24) * 8}% ${18 + Math.cos(time * 0.32) * 10}%, rgba(255,255,255,0.22), transparent 20%)`,
            `radial-gradient(circle at ${78 + Math.cos(time * 0.22) * 10}% ${24 + Math.sin(time * 0.27) * 8}%, ${context.accentColor}${alphaHex(0.16 + chroma * 0.08)}, transparent 18%)`,
          ].join(', '),
          filter: `blur(${lerp(12, 30, chroma) + context.blurStrength * 0.24}px) saturate(${1.18 + chroma * 0.34})`,
          mixBlendMode: 'screen',
          opacity: 0.78,
          transform: `rotate(${Math.sin(time * 0.2) * 10}deg) scale(${1.08 + Math.cos(time * 0.16) * 0.05})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          background: [
            `linear-gradient(${128 + Math.sin(time * 0.18) * 12}deg, transparent 0%, rgba(255,255,255,0.18) 24%, ${context.accentColor}${alphaHex(0.18)} 34%, transparent 50%, rgba(14,165,233,0.16) 70%, transparent 88%)`,
            `linear-gradient(${48 + Math.cos(time * 0.12) * 10}deg, transparent 0%, rgba(255,255,255,0.08) 16%, transparent 36%, rgba(244,114,182,0.14) 54%, transparent 78%)`,
            'repeating-linear-gradient(112deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 28px)',
          ].join(', '),
          filter: `blur(${8 + context.blurStrength * 0.12}px)`,
          mixBlendMode: 'screen',
          opacity: 0.42 + chroma * 0.12,
          transform: `translateX(${Math.sin(time * 0.28) * 5}%) scale(1.06)`,
        }}
      />
    </div>
  );
}

function PrismTopBar({ context }) {
  const time = useClock(1.26);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-24% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 24%, ${context.accentColor}${alphaHex(0.22)} 50%, rgba(255,255,255,0.16) 76%, transparent 100%)`,
          filter: 'blur(8px)',
          mixBlendMode: 'screen',
          opacity: 0.82,
          transform: `translateX(${Math.sin(time * 0.72) * 16}%) skewX(${Math.sin(time * 0.38) * 8}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.08) 10px 13px, transparent 13px 30px)',
            `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 22%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.06) 78%, transparent 100%)`,
          ].join(', '),
          opacity: 0.46,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function PrismBorder({ context }) {
  const time = useClock(1.6);
  const opacity = 0.38 + Math.cos(time * 1.8) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {[
        { inset: '0 0 auto 0', width: '100%', height: 1.5, axis: 'horizontal' },
        { inset: 'auto 0 0 0', width: '100%', height: 1.5, axis: 'horizontal' },
        { inset: '0 auto 0 0', width: 1.5, height: '100%', axis: 'vertical' },
        { inset: '0 0 0 auto', width: 1.5, height: '100%', axis: 'vertical' },
      ].map((rail, index) => (
        <div
          key={`prism-rail-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.width,
            height: rail.height,
            background: rail.axis === 'horizontal'
              ? `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.86) 14%, ${context.accentColor}${alphaHex(opacity)} 52%, rgba(244,114,182,0.7) 74%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.86) 14%, ${context.accentColor}${alphaHex(opacity)} 52%, rgba(14,165,233,0.7) 74%, transparent 100%)`,
            boxShadow: `0 0 18px ${context.accentColor}${alphaHex(opacity * 0.8)}`,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Prism Rails',
  description: 'Chromatic glass caustics and spectral rail highlights that make the shell feel machined from moving crystal.',
  group: 'Authoring Extremes',
  tags: ['prism', 'glass', 'caustic', 'chrome'],
  controls: [
    { id: 'accentWeight', label: 'Edge Weight', description: 'Strengthen the outer chrome edge energy.', min: 0, max: 1, step: 0.02 },
    { id: 'chroma', label: 'Chroma Split', description: 'Push the spectral separation in the prism body.', min: 0, max: 1, step: 0.02 },
    { id: 'railEnergy', label: 'Rail Energy', description: 'Increase the brightness and pressure in the rails.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    accentWeight: context.zoom > 1 ? 0.7 : 0.56,
    chroma: clamp01(0.28 + context.blurStrength / 40 + context.zoom * 0.12),
    railEnergy: clamp01(0.26 + context.panelTransparency * 0.55 + (context.isSettingsActive ? 0.08 : 0)),
  }),
  background: {
    render: PrismBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 16% 18%, ${context.accentColor}${alphaHex(0.14)}, transparent 22%)`,
        'radial-gradient(circle at 82% 22%, rgba(255,255,255,0.14), transparent 16%)',
        'linear-gradient(135deg, rgba(255,255,255,0.04), transparent 44%, rgba(59,130,246,0.14) 74%, transparent 100%)',
      ].join(', '),
      filter: `blur(${lerp(10, 20, Math.min(context.blurStrength / 32, 1))}px) saturate(1.1)`,
      opacity: 0.78,
      mixBlendMode: 'screen' as const,
    }),
  },
  topBar: {
    render: PrismTopBar,
    resolveStyle: context => ({
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 38%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.14) 62%, transparent 100%)`,
      opacity: 0.72,
      filter: 'blur(8px)',
      transform: 'scale(1.05)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: PrismBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.28)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 18px rgba(255,255,255,0.04), 0 0 20px ${context.accentColor}${Math.round(Number(context.sharedUniforms.accentWeight ?? 0.56) * 255).toString(16).padStart(2, '0')}`,
    }),
  },
});
