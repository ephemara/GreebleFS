import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function StarfieldGateLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const stars = Array.from({ length: 18 }, (_, index) => ({
    left: 3 + (index * 13) % 92,
    top: 6 + (index * 17) % 82,
    scale: 0.4 + (index % 4) * 0.25,
  }));

  return (
    <div aria-hidden style={{ position: 'absolute', inset: '-10%', pointerEvents: 'none', opacity: lerp(0, 0.94, active), transition: 'none', mixBlendMode: 'screen' }}>
      {stars.map((star, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: 6,
            height: 6,
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 0 18px rgba(135,200,255,0.42)',
            transform: `translate3d(${lerp(0, (star.left - 50) * 0.9, active)}px, ${lerp(0, (star.top - 50) * 0.7, active)}px, 0) scale(${lerp(0.25, star.scale, active)})`,
          }}
        />
      ))}
      <div style={{
        position: 'absolute',
        inset: '8%',
        borderRadius: '50%',
        border: '1px solid rgba(170,220,255,0.34)',
        transform: `scale(${lerp(0.4, 1.18, active)})`,
        filter: `blur(${lerp(0, 10, active)}px)`,
      }} />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `perspective(1400px) translate3d(0, ${direction === 'enter' ? lerp(22, 0, active) * signed : lerp(0, -18, progress) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.72, 1, active) : lerp(1, 0.74, progress)}) rotateX(${direction === 'enter' ? lerp(26, 0, active) : lerp(0, -22, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(20, 0, active) : lerp(0, 22, progress)}px) saturate(${direction === 'enter' ? lerp(0.52, 1, active) : lerp(1, 0.5, progress)}) brightness(${direction === 'enter' ? lerp(1.18, 1, active) : lerp(1, 1.26, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Starfield Gate',
  description: 'The shell emerges from a portal ring with stars pulling toward the viewport.',
  group: 'Cosmic',
  tags: ['starfield', 'gate', 'portal'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: StarfieldGateLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: StarfieldGateLayer,
  },
});
