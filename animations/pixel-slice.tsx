import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function PixelSliceLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const slices = Array.from({ length: 11 }, (_, index) => ({
    top: index * 9,
    shift: (index % 2 === 0 ? -1 : 1) * (12 + (index % 4) * 7),
  }));

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: lerp(0, 0.86, active), transition: 'none' }}>
      {slices.map((slice, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${slice.top}%`,
            height: '8%',
            background: index % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
            transform: `translateX(${lerp(0, slice.shift, active)}px)`,
            mixBlendMode: 'screen',
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
    transform: `translate3d(${direction === 'enter' ? lerp(-26, 0, active) : lerp(0, 30, progress)}px, 0, 0) scale(${direction === 'enter' ? lerp(0.96, 1, active) : lerp(1, 1.01, progress)})`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(10, 0, active) : lerp(0, 12, progress)}px) saturate(${direction === 'enter' ? lerp(0.66, 1, active) : lerp(1, 0.58, progress)}) contrast(${direction === 'enter' ? lerp(1.56, 1, active) : lerp(1, 1.62, progress)})`,
    clipPath: `inset(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 18, progress)}% 0 ${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 18, progress)}% 0)`,
    transition: 'none',
    willChange: 'transform, opacity, filter, clip-path',
  };
}

export default defineAnimation({
  name: 'Pixel Slice',
  description: 'Horizontal digital strips peel apart and reassemble like a corrupted feed.',
  group: 'Digital',
  tags: ['pixel', 'slice', 'glitch'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: PixelSliceLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: PixelSliceLayer,
  },
});
