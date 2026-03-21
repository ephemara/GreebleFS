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
            `radial-gradient(circle at ${34 + Math.sin(time * 0.34) * 22}% ${30 + Math.cos(time * 0.28) * 16}%, ${context.accentColor}${alphaHex(0.34 + intensity * 0.16)} 0%, transparent 24%)`,
            `radial-gradient(circle at ${76 + Math.cos(time * 0.29) * 10}% ${22 + Math.sin(time * 0.46) * 11}%, rgba(255,255,255,${0.16 + bloom * 0.14}), transparent 14%)`,
            `radial-gradient(circle at ${18 + Math.cos(time * 0.17) * 8}% ${78 + Math.sin(time * 0.24) * 9}%, rgba(56,189,248,${0.18 + bloom * 0.12}), transparent 18%)`,
            `conic-gradient(from ${time * 30}deg at 50% 50%, rgba(255,255,255,0.03), ${context.accentColor}${alphaHex(0.16)}, rgba(14,165,233,0.16), rgba(255,255,255,0.04), ${context.accentColor}${alphaHex(0.12)}, rgba(255,255,255,0.02))`,
          ].join(', '),
          filter: `blur(${lerp(22, 42, intensity) + context.blurStrength * 0.45}px) saturate(${1.18 + bloom * 0.5}) brightness(${1.02 + intensity * 0.16})`,
          transform: `translate3d(${Math.sin(time * 0.22) * drift * 6}%, ${Math.cos(time * 0.18) * drift * 4}%, 0) scale(${1.06 + Math.sin(time * 0.18) * 0.04}) rotate(${Math.sin(time * 0.16) * 7}deg)`,
          opacity: context.isSettingsActive ? 0.96 : 0.84,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `linear-gradient(${124 + Math.sin(time * 0.14) * 18}deg, transparent 0%, rgba(255,255,255,0.16) 19%, ${context.accentColor}${alphaHex(0.22 + bloom * 0.12)} 32%, transparent 52%, rgba(14,165,233,0.16) 70%, transparent 100%)`,
            `linear-gradient(${66 + Math.cos(time * 0.2) * 14}deg, transparent 0%, rgba(255,255,255,0.02) 18%, rgba(255,255,255,0.18) 28%, transparent 42%, ${context.accentColor}${alphaHex(0.14)} 56%, transparent 78%)`,
            'repeating-linear-gradient(115deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 32px)',
          ].join(', '),
          mixBlendMode: 'screen',
          filter: `blur(${10 + context.blurStrength * 0.18}px)`,
          opacity: 0.34 + bloom * 0.18,
          transform: `translateX(${Math.sin(time * 0.3) * 6}%) rotate(${Math.cos(time * 0.16) * 4}deg) scale(1.08)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'linear-gradient(180deg, rgba(255,255,255,0.14), transparent 22%)',
            `radial-gradient(circle at 50% 6%, rgba(255,255,255,${0.16 + bloom * 0.14}), transparent 28%)`,
          ].join(', '),
          mixBlendMode: 'screen',
          opacity: 0.4 + Math.sin(time * 0.9) * 0.06,
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
          inset: '-30% -8%',
          background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(railAlpha * 0.34)} 20%, rgba(255,255,255,0.2) 48%, ${context.accentColor}${alphaHex(railAlpha * 0.32)} 78%, transparent 100%)`,
          filter: 'blur(10px)',
          mixBlendMode: 'screen',
          opacity: 0.84,
          transform: `translateX(${Math.sin(time * 0.75) * 18}%) skewX(${Math.sin(time * 0.4) * 10}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.08) 12px 15px, transparent 15px 38px)',
            `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 18%, ${context.accentColor}${alphaHex(0.16)} 50%, rgba(255,255,255,0.08) 82%, transparent 100%)`,
          ].join(', '),
          opacity: 0.42,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.cos(time * 0.52) * 8}%)`,
        }}
      />
    </div>
  );
}

function AuroraBorder({ context }) {
  const time = useClock(1.45);
  const pulse = 0.38 + Math.sin(time * 1.7) * 0.1;
  const cornerSize = context.surface === 'border' ? 72 : 56;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {[
        { inset: '0 0 auto 0', width: '100%', height: 2, axis: 'horizontal' },
        { inset: 'auto 0 0 0', width: '100%', height: 2, axis: 'horizontal' },
        { inset: '0 auto 0 0', width: 2, height: '100%', axis: 'vertical' },
        { inset: '0 0 0 auto', width: 2, height: '100%', axis: 'vertical' },
      ].map((rail, index) => (
        <div
          key={`aurora-rail-${index}`}
          style={{
            position: 'absolute',
            inset: rail.inset,
            width: rail.width,
            height: rail.height,
            background: rail.axis === 'horizontal'
              ? `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(pulse)} 18%, rgba(255,255,255,0.95) 50%, ${context.accentColor}${alphaHex(pulse)} 82%, transparent 100%)`
              : `linear-gradient(180deg, transparent 0%, ${context.accentColor}${alphaHex(pulse)} 18%, rgba(255,255,255,0.95) 50%, ${context.accentColor}${alphaHex(pulse)} 82%, transparent 100%)`,
            boxShadow: `0 0 16px ${context.accentColor}${alphaHex(pulse * 0.9)}`,
            opacity: 0.88,
          }}
        />
      ))}
      {[
        { inset: '0 auto auto 0', transform: `translate(-28%, -28%) rotate(${time * 22}deg)` },
        { inset: '0 0 auto auto', transform: `translate(28%, -28%) rotate(${-time * 24}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-28%, 28%) rotate(${-time * 20}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(28%, 28%) rotate(${time * 26}deg)` },
      ].map((corner, index) => (
        <div
          key={`aurora-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: cornerSize,
            height: cornerSize,
            background: `radial-gradient(circle, rgba(255,255,255,0.24) 0%, ${context.accentColor}${alphaHex(0.18)} 38%, transparent 72%)`,
            filter: 'blur(10px)',
            mixBlendMode: 'screen',
            opacity: 0.52,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Aurora Ribbon',
  description: 'Volumetric aurora sheets, caustic light passes, and animated chrome rails that flood the shell with atmospheric color.',
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
