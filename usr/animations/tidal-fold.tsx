import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function TidalFoldLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: '-8%', pointerEvents: 'none', opacity: lerp(0, 0.9, active), transition: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 100%, ${accent}40 0%, transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 42%)`,
        mixBlendMode: 'screen',
      }} />
      <div style={{
        position: 'absolute',
        left: '-8%',
        right: '-8%',
        bottom: '-4%',
        height: '44%',
        background: `linear-gradient(180deg, rgba(255,255,255,0.0), ${accent}34 38%, rgba(255,255,255,0.12) 64%, transparent 100%)`,
        borderRadius: '50%',
        transform: `translateY(${lerp(46, 0, active)}%) scaleY(${lerp(0.55, 1.12, active)})`,
        filter: `blur(${lerp(4, 14, active)}px)`,
      }} />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(0, ${direction === 'enter' ? lerp(24, 0, active) * signed : lerp(0, 26, progress) * signed}%, 0) scaleY(${direction === 'enter' ? lerp(0.8, 1, active) : lerp(1, 0.82, progress)}) scaleX(${direction === 'enter' ? lerp(1.06, 1, active) : lerp(1, 1.05, progress)})`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(16, 0, active) : lerp(0, 20, progress)}px) saturate(${direction === 'enter' ? lerp(1.34, 1, active) : lerp(1, 1.4, progress)}) hue-rotate(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 12, progress)}deg)`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Tidal Fold',
  description: 'A rolling swell folds the shell upward like a luminous ocean surface.',
  group: 'Fluid',
  tags: ['tidal', 'wave', 'fold'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: TidalFoldLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: TidalFoldLayer,
  },
});
