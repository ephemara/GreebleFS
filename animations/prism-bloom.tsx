import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function PrismLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: '-8%', pointerEvents: 'none', opacity: lerp(0, 0.92, active), transition: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(120deg, rgba(255,80,80,0.0) 0%, rgba(255,80,80,0.18) 18%, rgba(80,255,220,0.16) 44%, rgba(90,120,255,0.22) 72%, transparent 100%)`,
        mixBlendMode: 'screen',
        filter: `blur(${lerp(0, 16, active)}px)`,
        transform: `rotate(${lerp(-8, 18, active)}deg) scale(${lerp(0.92, 1.08, active)})`,
      }} />
      <div style={{
        position: 'absolute',
        inset: '10%',
        border: `1px solid ${accent}44`,
        background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.26), transparent 42%)`,
        mixBlendMode: 'screen',
        transform: `scale(${lerp(0.74, 1.16, active)})`,
      }} />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(0, ${direction === 'enter' ? lerp(12, 0, active) : lerp(0, -14, progress)}px, 0) scale(${direction === 'enter' ? lerp(0.9, 1, active) : lerp(1, 1.03, progress)}) rotate(${direction === 'enter' ? lerp(-3, 0, active) : lerp(0, 4, progress)}deg) skewX(${direction === 'enter' ? lerp(4, 0, active) : lerp(0, -5, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(16, 0, active) : lerp(0, 16, progress)}px) saturate(${direction === 'enter' ? lerp(1.48, 1, active) : lerp(1, 1.5, progress)}) hue-rotate(${direction === 'enter' ? lerp(24, 0, active) : lerp(0, -28, progress)}deg)`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Prism Bloom',
  description: 'Chromatic refraction fans across the shell like a lens flare cut through crystal.',
  group: 'Light FX',
  tags: ['prism', 'chromatic', 'bloom'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: PrismLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: PrismLayer,
  },
});
