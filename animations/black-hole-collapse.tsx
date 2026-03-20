import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function BlackHoleLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-16%',
        pointerEvents: 'none',
        opacity: lerp(0, 0.95, active),
        transition: 'none',
        mixBlendMode: 'screen',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: '14%',
        borderRadius: '50%',
        background: `radial-gradient(circle at 50% 50%, rgba(2,4,10,0.96) 0%, rgba(2,4,10,0.78) 18%, ${accent}88 22%, transparent 44%)`,
        transform: `scale(${lerp(0.32, 1.08, active)}) rotate(${lerp(-24, 220, active)}deg)`,
        filter: `blur(${lerp(6, 22, active)}px)`,
      }} />
      <div style={{
        position: 'absolute',
        inset: '5%',
        borderRadius: '50%',
        background: `conic-gradient(from ${lerp(160, -120, active)}deg, transparent 0deg, ${accent}88 90deg, rgba(255,255,255,0.18) 180deg, transparent 320deg)`,
        transform: `scale(${lerp(0.72, 1.18, active)})`,
        filter: `blur(${lerp(2, 12, active)}px)`,
      }} />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(0, ${lerp(34, 0, active) * signed}%, 0) scale(${direction === 'enter' ? lerp(0.58, 1, active) : lerp(1, 0.42, progress)}) rotate(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, -22, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(24, 0, active) : lerp(0, 28, progress)}px) saturate(${direction === 'enter' ? lerp(0.35, 1, active) : lerp(1, 0.28, progress)}) brightness(${direction === 'enter' ? lerp(0.62, 1, active) : lerp(1, 0.44, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Black Hole Collapse',
  description: 'A violent singularity pull that compresses the shell through a luminous event horizon.',
  group: 'Cinematic',
  tags: ['black-hole', 'collapse', 'gravity'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: BlackHoleLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: BlackHoleLayer,
  },
});
