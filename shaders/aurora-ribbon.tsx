import React, { useEffect, useState } from 'react';
import { defineShader } from 'overlayterm-shader';

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

function AuroraBackground({ context }) {
  const time = useClock(0.7);

  return (
    <div style={{ position: 'absolute', inset: '-16%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `radial-gradient(circle at ${32 + Math.sin(time * 0.4) * 16}% ${34 + Math.cos(time * 0.3) * 12}%, ${context.accentColor}33, transparent 28%)`,
            'radial-gradient(circle at 74% 20%, rgba(255,255,255,0.18), transparent 18%)',
            'linear-gradient(135deg, rgba(16,185,129,0.12), transparent 42%, rgba(59,130,246,0.16) 72%, transparent 100%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.35}px) saturate(1.18)`,
          transform: `scale(${1.04 + Math.sin(time * 0.2) * 0.03}) rotate(${Math.sin(time * 0.24) * 5}deg)`,
          opacity: context.isSettingsActive ? 0.92 : 0.78,
        }}
      />
    </div>
  );
}

export default defineShader({
  name: 'Aurora Ribbon',
  description: 'A soft aurora wash with glossy chrome highlights for all three shell surfaces.',
  group: 'Authoring Samples',
  tags: ['aurora', 'gradient', 'theme'],
  resolveSharedUniforms: context => ({
    liveOpacity: context.isSettingsActive ? 0.88 : 0.7,
  }),
  background: {
    render: AuroraBackground,
  },
  topBar: {
    resolveStyle: context => ({
      background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}22 34%, rgba(255,255,255,0.16) 50%, ${context.accentColor}1a 72%, transparent 100%)`,
      opacity: Number(context.sharedUniforms.liveOpacity ?? 0.7),
      filter: 'blur(9px)',
      transform: 'scale(1.05)',
      mixBlendMode: 'screen',
    }),
  },
  border: {
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}55`,
      boxShadow: `0 0 22px ${context.accentColor}22, inset 0 0 0 1px rgba(255,255,255,0.05)`,
    }),
  },
});
