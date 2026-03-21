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

function AuroraBackground({ context }) {
  const time = useClock(0.72);
  const intensity = Number(context.sharedUniforms.intensity ?? 0.72);
  const bloom = Number(context.sharedUniforms.bloom ?? 0.38);
  const drift = Number(context.sharedUniforms.drift ?? 0.52);

  return (
    <div style={{ position: 'absolute', inset: '-22%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-14%',
          background: [
            `radial-gradient(circle at ${34 + Math.sin(time * 0.26) * 18}% ${28 + Math.cos(time * 0.22) * 14}%, ${context.accentColor}${alphaHex(0.24 + intensity * 0.12)} 0%, transparent 26%)`,
            `radial-gradient(circle at ${74 + Math.cos(time * 0.2) * 9}% ${24 + Math.sin(time * 0.28) * 9}%, rgba(255,255,255,${0.14 + bloom * 0.12}), transparent 16%)`,
            `radial-gradient(circle at ${18 + Math.cos(time * 0.14) * 7}% ${76 + Math.sin(time * 0.2) * 8}%, rgba(56,189,248,${0.14 + bloom * 0.1}), transparent 18%)`,
            `linear-gradient(135deg, rgba(255,255,255,0.04), transparent 42%, rgba(14,165,233,0.08) 72%, transparent 100%)`,
          ].join(', '),
          filter: `blur(${lerp(20, 34, intensity) + context.blurStrength * 0.34}px) saturate(${1.12 + bloom * 0.34}) brightness(${1.01 + intensity * 0.1})`,
          transform: `translate3d(${Math.sin(time * 0.16) * drift * 4}%, ${Math.cos(time * 0.14) * drift * 3}%, 0) scale(${1.04 + Math.sin(time * 0.12) * 0.03}) rotate(${Math.sin(time * 0.1) * 4}deg)`,
          opacity: context.isSettingsActive ? 0.9 : 0.78,
        }}
      />
      {[
        {
          inset: '8% -18% 44% -14%',
          angle: 124 + Math.sin(time * 0.18) * 10,
          opacity: 0.34 + intensity * 0.12,
          blur: 22 + context.blurStrength * 0.24,
          transform: `translateX(${Math.sin(time * 0.24) * 4}%) rotate(${Math.sin(time * 0.14) * 6 - 12}deg) scale(1.08)`,
        },
        {
          inset: '34% -12% 8% -18%',
          angle: 88 + Math.cos(time * 0.16) * 12,
          opacity: 0.28 + bloom * 0.16,
          blur: 18 + context.blurStrength * 0.22,
          transform: `translateX(${Math.cos(time * 0.18) * 5}%) rotate(${Math.cos(time * 0.12) * 7 + 9}deg) scale(1.04)`,
        },
        {
          inset: '18% -10% 24% -10%',
          angle: 38 + Math.sin(time * 0.22) * 8,
          opacity: 0.18 + bloom * 0.14,
          blur: 14 + context.blurStrength * 0.18,
          transform: `translateY(${Math.sin(time * 0.2) * 3}%) rotate(${Math.sin(time * 0.16) * 5}deg) scale(1.02)`,
        },
      ].map((ribbon, index) => (
        <div
          key={`aurora-ribbon-band-${index}`}
          style={{
            position: 'absolute',
            inset: ribbon.inset,
            borderRadius: '999px',
            background: `linear-gradient(${ribbon.angle}deg, transparent 0%, rgba(255,255,255,0.14) 18%, ${context.accentColor}${alphaHex(0.18 + bloom * 0.1)} 34%, rgba(56,189,248,0.14) 54%, rgba(255,255,255,0.12) 70%, transparent 100%)`,
            mixBlendMode: 'screen',
            filter: `blur(${ribbon.blur}px)`,
            opacity: ribbon.opacity,
            transform: ribbon.transform,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'linear-gradient(180deg, rgba(255,255,255,0.1), transparent 18%)',
            `radial-gradient(circle at 50% 8%, rgba(255,255,255,${0.12 + bloom * 0.1}), transparent 24%)`,
          ].join(', '),
          mixBlendMode: 'screen',
          opacity: 0.28 + Math.sin(time * 0.6) * 0.04,
        }}
      />
    </div>
  );
}

function AuroraTopBar({ context }) {
  const time = useClock(1.2);
  const railAlpha = Number(context.sharedUniforms.railAlpha ?? 0.54);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -6%',
          background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(railAlpha * 0.22)} 22%, rgba(255,255,255,0.16) 50%, ${context.accentColor}${alphaHex(railAlpha * 0.2)} 78%, transparent 100%)`,
          filter: 'blur(8px)',
          mixBlendMode: 'screen',
          opacity: 0.72,
          transform: `translateX(${Math.sin(time * 0.42) * 10}%) skewX(${Math.sin(time * 0.24) * 5}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, ${context.accentColor}${alphaHex(0.12)} 50%, rgba(255,255,255,0.06) 80%, transparent 100%)`,
            'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 60%)',
          ].join(', '),
          opacity: 0.3,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.cos(time * 0.34) * 4}%)`,
        }}
      />
    </div>
  );
}

function AuroraBorder({ context }) {
  const time = useClock(1.45);
  const pulse = 0.28 + Math.sin(time * 1.2) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {[
        { inset: '0 0 auto 0', width: '100%', height: 1.5, axis: 'horizontal' },
        { inset: 'auto 0 0 0', width: '100%', height: 1.5, axis: 'horizontal' },
        { inset: '0 auto 0 0', width: 1.5, height: '100%', axis: 'vertical' },
        { inset: '0 0 0 auto', width: 1.5, height: '100%', axis: 'vertical' },
      ].map((rail, index) => (
        <div
          key={`aurora-rail-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.width,
            height: rail.height,
            background: rail.axis === 'horizontal'
              ? `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(pulse)} 22%, rgba(255,255,255,0.72) 50%, ${context.accentColor}${alphaHex(pulse)} 78%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, ${context.accentColor}${alphaHex(pulse)} 22%, rgba(255,255,255,0.72) 50%, ${context.accentColor}${alphaHex(pulse)} 78%, transparent 100%)`,
            boxShadow: `0 0 10px ${context.accentColor}${alphaHex(pulse * 0.8)}`,
            opacity: 0.72,
          }}
        />
      ))}
      {[
        { inset: '0 auto auto 0', transform: `translate(-14%, -14%)` },
        { inset: '0 0 auto auto', transform: `translate(14%, -14%)` },
        { inset: 'auto auto 0 0', transform: `translate(-14%, 14%)` },
        { inset: 'auto 0 0 auto', transform: `translate(14%, 14%)` },
      ].map((corner, index) => (
        <div
          key={`aurora-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 36,
            height: 36,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 42%, transparent 72%)`,
            filter: 'blur(8px)',
            mixBlendMode: 'screen',
            opacity: 0.42 + Math.sin(time * 1.4 + index) * 0.04,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Aurora Ribbon',
  description: 'Soft volumetric aurora ribbons with restrained chrome glow and a cleaner glass-sky atmosphere.',
  group: 'Authoring Extremes',
  tags: ['aurora', 'volumetric', 'chrome', 'caustic'],
  resolveSharedUniforms: context => ({
    intensity: clamp01(0.42 + context.blurStrength / 34 + context.panelTransparency * 0.3),
    bloom: clamp01(0.18 + context.zoom * 0.16 + (context.isSettingsActive ? 0.12 : 0)),
    drift: clamp01(0.3 + context.viewport.width / 2600),
    railAlpha: context.isSettingsActive ? 0.74 : 0.56,
  }),
  background: {
    render: AuroraBackground,
  },
  topBar: {
    render: AuroraTopBar,
    resolveStyle: context => ({
      opacity: Number(context.sharedUniforms.railAlpha ?? 0.56),
      filter: 'blur(9px) saturate(1.18)',
      transform: 'scale(1.06)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: AuroraBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.34)}`,
      boxShadow: `0 0 28px ${context.accentColor}${alphaHex(0.2)}, inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 24px ${context.accentColor}${alphaHex(0.08)}`,
    }),
  },
});
