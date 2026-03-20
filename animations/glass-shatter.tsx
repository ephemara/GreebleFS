import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function GlassShatterLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;
  const shards = Array.from({ length: 8 }, (_, index) => ({
    left: 8 + index * 11,
    top: index % 2 === 0 ? 12 : 36,
    rotate: -28 + index * 9,
    x: -26 + index * 7,
    y: 10 + (index % 3) * 12,
  }));

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: lerp(0, 0.9, active), transition: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `repeating-linear-gradient(126deg, transparent 0 64px, ${accent}20 64px 66px, transparent 66px 128px)`,
        mixBlendMode: 'screen',
      }} />
      {shards.map((shard, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${shard.left}%`,
            top: `${shard.top}%`,
            width: '11%',
            height: '18%',
            clipPath: 'polygon(16% 0%, 100% 12%, 82% 100%, 0% 74%)',
            border: `1px solid ${accent}88`,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0.04))',
            transform: `translate3d(${lerp(0, shard.x, active)}px, ${lerp(0, shard.y, active)}px, 0) rotate(${lerp(0, shard.rotate, active)}deg) scale(${lerp(0.4, 1.18, active)})`,
            filter: `blur(${lerp(0, 4, active)}px)`,
          }}
        />
      ))}
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, -22, progress)}px, ${direction === 'enter' ? lerp(22, 0, active) : lerp(0, 16, progress)}px, 0) scale(${direction === 'enter' ? lerp(0.92, 1, active) : lerp(1, 0.94, progress)}) rotate(${direction === 'enter' ? lerp(-6, 0, active) : lerp(0, 8, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(12, 0, active) : lerp(0, 14, progress)}px) saturate(${direction === 'enter' ? lerp(0.78, 1, active) : lerp(1, 0.72, progress)}) contrast(${direction === 'enter' ? lerp(1.24, 1, active) : lerp(1, 1.18, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Glass Shatter',
  description: 'Cracked panes and escaping shards give the shell a sharp architectural break.',
  group: 'Impact',
  tags: ['glass', 'shatter', 'impact'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: GlassShatterLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: GlassShatterLayer,
  },
});
