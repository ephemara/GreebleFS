import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function EmberStormLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const particles = Array.from({ length: 14 }, (_, index) => ({
    left: 4 + (index * 7) % 88,
    top: 12 + (index * 11) % 74,
    size: 4 + (index % 4) * 2,
    driftX: -18 + (index % 5) * 8,
    driftY: 26 + (index % 6) * 10,
  }));

  return (
    <div aria-hidden style={{ position: 'absolute', inset: '-6%', pointerEvents: 'none', opacity: lerp(0, 0.92, active), transition: 'none', mixBlendMode: 'screen' }}>
      {particles.map((particle, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: '999px',
            background: index % 2 === 0 ? 'rgba(255,186,64,0.95)' : 'rgba(255,255,255,0.78)',
            boxShadow: '0 0 18px rgba(255,140,64,0.55)',
            transform: `translate3d(${lerp(0, particle.driftX, active)}px, ${lerp(0, particle.driftY, active)}px, 0) scale(${lerp(0.3, 1.15, active)})`,
            filter: `blur(${lerp(0, 3, active)}px)`,
          }}
        />
      ))}
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(0, ${direction === 'enter' ? lerp(18, 0, active) * signed : lerp(0, 22, progress) * signed}%, 0) scale(${direction === 'enter' ? lerp(0.94, 1, active) : lerp(1, 1.04, progress)}) rotate(${direction === 'enter' ? lerp(-4, 0, active) : lerp(0, 5, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 16, progress)}px) saturate(${direction === 'enter' ? lerp(1.45, 1, active) : lerp(1, 1.58, progress)}) hue-rotate(${direction === 'enter' ? lerp(-18, 0, active) : lerp(0, -24, progress)}deg)`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Ember Storm',
  description: 'Heat bloom, cinders, and an ashy gust wash across the shell.',
  group: 'Elemental',
  tags: ['ember', 'fire', 'storm'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: EmberStormLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: EmberStormLayer,
  },
});
