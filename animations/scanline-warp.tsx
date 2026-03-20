import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function ScanlineLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: lerp(0, 0.88, active), transition: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 7px), linear-gradient(90deg, transparent 0%, ${accent}22 50%, transparent 100%)`,
        mixBlendMode: 'screen',
        transform: `translateY(${lerp(-26, 14, active)}px)`,
        filter: `blur(${lerp(0, 3, active)}px)`,
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)`,
        transform: `translateY(${lerp(-140, 180, active)}%)`,
        opacity: 0.7,
      }} />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(${direction === 'enter' ? lerp(-18, 0, active) : lerp(0, 22, progress)}px, ${direction === 'enter' ? lerp(14, 0, active) * signed : lerp(0, -10, progress) * signed}px, 0) scaleY(${direction === 'enter' ? lerp(0.82, 1, active) : lerp(1, 0.84, progress)})`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 12, progress)}px) saturate(${direction === 'enter' ? lerp(0.6, 1, active) : lerp(1, 0.52, progress)}) contrast(${direction === 'enter' ? lerp(1.45, 1, active) : lerp(1, 1.55, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Scanline Warp',
  description: 'CRT scanlines and a moving beam drag the shell through a signal distortion field.',
  group: 'Digital',
  tags: ['scanline', 'signal', 'warp'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: ScanlineLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: ScanlineLayer,
  },
});
