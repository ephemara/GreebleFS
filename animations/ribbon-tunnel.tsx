import React, { useEffect, useState } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function useClock(speed = 1): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      setTime(now * 0.001 * speed);
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [speed]);

  return time;
}

function RibbonTunnelLayer({ context }) {
  const time = useClock(0.82);
  const active = context.direction === 'enter' ? clamp01(context.progress) : 1 - clamp01(context.progress);
  const ribbonCount = 8;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: '-14%', pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-8%',
          background: [
            `radial-gradient(circle at 50% 52%, ${context.accentColor}33 0%, transparent 18%)`,
            'radial-gradient(circle at 50% 52%, rgba(255,255,255,0.14) 0%, transparent 32%)',
            'linear-gradient(180deg, rgba(255,255,255,0.08), transparent 18%, transparent 84%, rgba(255,255,255,0.04))',
          ].join(', '),
          filter: `blur(${18 + active * 14}px) saturate(1.14)`,
          opacity: 0.84,
          mixBlendMode: 'screen',
        }}
      />
      {Array.from({ length: ribbonCount }, (_, index) => {
        const spread = index / Math.max(ribbonCount - 1, 1);
        const wobble = Math.sin(time * (0.72 + spread * 0.22) + index * 0.9);
        const spin = time * 22 + index * 28 + wobble * 16;
        const scale = 0.78 + spread * 0.8 + active * 0.2;
        const inset = `${8 + index * 4}% ${6 + index * 2}%`;
        const alpha = 0.14 + spread * 0.16 + active * 0.18;

        return (
          <div
            key={`ribbon-${index}`}
            style={{
              position: 'absolute',
              inset,
              borderRadius: '999px',
              border: `1px solid ${context.accentColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`,
              background: [
                `linear-gradient(${90 + wobble * 10}deg, transparent 0%, rgba(255,255,255,0.14) 16%, ${context.accentColor}${Math.round((alpha + 0.08) * 255).toString(16).padStart(2, '0')} 42%, rgba(255,255,255,0.16) 64%, transparent 100%)`,
                `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0%, transparent 48%)`,
              ].join(', '),
              mixBlendMode: 'screen',
              filter: `blur(${lerp(4, 14, spread) + active * 2}px) saturate(${1.1 + active * 0.22})`,
              opacity: lerp(0.24, 0.92, active) * (0.75 + spread * 0.2),
              transform: `perspective(900px) rotateX(${62 - spread * 28}deg) rotateZ(${spin}deg) scale(${scale}) translateY(${Math.sin(time * 0.8 + index) * 6}px)`,
              boxShadow: `0 0 22px ${context.accentColor}${Math.round((0.06 + active * 0.12) * 255).toString(16).padStart(2, '0')}, inset 0 0 24px rgba(255,255,255,0.04)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          inset: '16%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, ${context.accentColor}22 24%, transparent 60%)`,
          transform: `scale(${0.92 + active * 0.22})`,
          filter: `blur(${10 + active * 10}px)`,
          opacity: 0.7,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const enter = direction === 'enter';

  return {
    transform: `perspective(1800px) translate3d(0, ${lerp(28, 0, progress) * signed}px, 0) scale(${enter ? lerp(0.74, 1, progress) : lerp(1, 0.88, progress)}) rotateX(${enter ? lerp(16, 0, progress) : lerp(0, -12, progress)}deg) rotateY(${enter ? lerp(-12, 0, progress) : lerp(0, 10, progress)}deg)`,
    opacity: context.baseOpacity * (enter ? progress : 1 - progress),
    filter: `blur(${enter ? lerp(16, 0, progress) : lerp(0, 18, progress)}px) saturate(${enter ? lerp(0.76, 1.08, progress) : lerp(1.08, 0.74, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Ribbon Tunnel',
  description: 'A layered ribbon corridor bends the shell into a luminous tunnel of chromatic glass.',
  group: 'Showcase',
  tags: ['ribbon', 'tunnel', 'glass', 'gradient'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: RibbonTunnelLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: RibbonTunnelLayer,
  },
});
