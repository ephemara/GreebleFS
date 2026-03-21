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

function QuantumLatticeBackground({ context }) {
  const time = useClock(0.74);
  const density = Number(context.sharedUniforms.density ?? 0.54);
  const bloom = Number(context.sharedUniforms.bloom ?? 0.34);
  const latticeSize = lerp(28, 56, density);

  return (
    <div style={{ position: 'absolute', inset: '-18%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            `repeating-conic-gradient(from ${time * 24}deg at 50% 50%, rgba(255,255,255,0.08) 0deg 10deg, transparent 10deg 24deg, ${context.accentColor}${alphaHex(0.12)} 24deg 34deg, transparent 34deg 48deg)`,
            `radial-gradient(circle at ${28 + Math.sin(time * 0.22) * 10}% ${26 + Math.cos(time * 0.24) * 10}%, rgba(255,255,255,0.22), transparent 18%)`,
            `radial-gradient(circle at ${72 + Math.cos(time * 0.18) * 8}% ${24 + Math.sin(time * 0.28) * 8}%, ${context.accentColor}${alphaHex(0.16 + bloom * 0.08)}, transparent 16%)`,
          ].join(', '),
          filter: `blur(${lerp(10, 24, bloom) + context.blurStrength * 0.18}px) saturate(${1.16 + bloom * 0.36})`,
          mixBlendMode: 'screen',
          opacity: 0.78,
          transform: `rotate(${Math.sin(time * 0.16) * 12}deg) scale(${1.08 + Math.cos(time * 0.12) * 0.04})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          backgroundImage: [
            'linear-gradient(60deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            'linear-gradient(-60deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            `linear-gradient(0deg, ${context.accentColor}${alphaHex(0.08)} 1px, transparent 1px)`,
          ].join(', '),
          backgroundSize: `${latticeSize}px ${latticeSize}px, ${latticeSize}px ${latticeSize}px, ${latticeSize}px ${latticeSize}px`,
          backgroundPosition: `${Math.sin(time * 0.2) * 12}px ${Math.cos(time * 0.18) * 8}px, ${Math.cos(time * 0.24) * 10}px ${Math.sin(time * 0.18) * 10}px, 0 ${Math.sin(time * 0.26) * 14}px`,
          mixBlendMode: 'screen',
          opacity: 0.34 + density * 0.18,
          transform: `perspective(720px) rotateX(${14 + Math.sin(time * 0.14) * 5}deg) rotateZ(${Math.cos(time * 0.16) * 4}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(255,255,255,0.12), transparent 20%, transparent 78%, rgba(255,255,255,0.06))`,
          opacity: 0.38,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function QuantumLatticeTopBar({ context }) {
  const time = useClock(1.18);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -6%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 18%, ${context.accentColor}${alphaHex(0.18)} 50%, rgba(255,255,255,0.18) 82%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.8,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.62) * 12}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 9px, rgba(255,255,255,0.09) 9px 12px, transparent 12px 26px)',
          opacity: 0.34,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function QuantumLatticeBorder({ context }) {
  const time = useClock(1.42);
  const pulse = 0.28 + Math.sin(time * 1.5) * 0.08;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 24px ${context.accentColor}${alphaHex(0.08)}, 0 0 20px ${context.accentColor}${alphaHex(0.12)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-18%, -18%) rotate(${time * 18}deg)` },
        { inset: '0 0 auto auto', transform: `translate(18%, -18%) rotate(${-time * 20}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-18%, 18%) rotate(${-time * 16}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(18%, 18%) rotate(${time * 22}deg)` },
      ].map((facet, index) => (
        <div
          key={`quantum-facet-${index}`}
          style={{
            position: 'absolute',
            inset: facet.inset,
            width: 56,
            height: 56,
            background: `conic-gradient(from ${time * 80}deg, rgba(255,255,255,0.16), ${context.accentColor}${alphaHex(0.18)}, transparent 72%)`,
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
            filter: 'blur(6px)',
            opacity: 0.56,
            transform: facet.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Quantum Lattice',
  description: 'A crystalline field of rotating geometric panes, lattice lines, and spectral chrome edges.',
  group: 'Authoring Extremes',
  tags: ['lattice', 'crystal', 'geometric', 'spectral'],
  resolveSharedUniforms: context => ({
    density: clamp01(0.24 + context.viewport.width / 2600 + context.zoom * 0.16),
    bloom: clamp01(0.18 + context.blurStrength / 36 + context.panelTransparency * 0.24),
  }),
  background: {
    render: QuantumLatticeBackground,
    resolveStyle: () => ({
      opacity: 0.9,
    }),
  },
  topBar: {
    render: QuantumLatticeTopBar,
  },
  border: {
    render: QuantumLatticeBorder,
  },
});
