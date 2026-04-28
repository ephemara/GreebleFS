import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function MeltLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;
  const drips = Array.from({ length: 7 }, (_, index) => ({
    left: 6 + index * 13,
    width: 6 + (index % 3) * 2,
    height: 32 + (index % 4) * 14,
  }));

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: lerp(0, 0.82, active), transition: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, ${accent}22 0%, rgba(255,255,255,0.06) 28%, rgba(8,10,16,0.0) 100%)`,
        mixBlendMode: 'screen',
        filter: `blur(${lerp(2, 9, active)}px)`,
      }} />
      {drips.map((drip, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${drip.left}%`,
            top: `${lerp(-drip.height * 0.6, 0, active)}px`,
            width: `${drip.width}%`,
            height: `${lerp(12, drip.height, active)}%`,
            borderRadius: '999px',
            background: `linear-gradient(180deg, ${accent}99 0%, ${accent}28 65%, transparent 100%)`,
            filter: `blur(${lerp(0, 4, active)}px)`,
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
    transform: `translate3d(0, ${direction === 'enter' ? lerp(16, 0, active) * signed : lerp(0, 26, progress) * signed}%, 0) scaleY(${direction === 'enter' ? lerp(1.18, 1, active) : lerp(1, 1.22, progress)}) scaleX(${direction === 'enter' ? lerp(0.94, 1, active) : lerp(1, 0.92, progress)})`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, 24, progress)}px) saturate(${direction === 'enter' ? lerp(1.24, 1, active) : lerp(1, 1.34, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Melt Down',
  description: 'The shell liquefies into drips and heat haze before settling back into shape.',
  group: 'Organic',
  tags: ['melt', 'liquid', 'heat'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: MeltLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: MeltLayer,
  },
});
