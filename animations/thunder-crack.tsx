import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function ThunderCrackLayer({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: lerp(0, 0.96, active), transition: 'none', mixBlendMode: 'screen' }}>
      <div style={{
        position: 'absolute',
        left: '49%',
        top: '-8%',
        width: '2%',
        height: '116%',
        background: `linear-gradient(180deg, rgba(255,255,255,0.95), ${accent}80 58%, transparent 100%)`,
        clipPath: 'polygon(45% 0%, 85% 18%, 40% 38%, 78% 54%, 28% 74%, 58% 100%, 0% 100%, 0% 0%)',
        transform: `scale(${lerp(0.3, 1.18, active)}) rotate(${lerp(-8, 12, active)}deg)`,
        filter: `blur(${lerp(0, 7, active)}px)`,
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.14), transparent 35%, rgba(255,255,255,0.08) 75%, transparent 100%)',
        opacity: lerp(0, 0.7, active),
      }} />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `translate3d(${direction === 'enter' ? lerp(-8, 0, active) : lerp(0, 10, progress)}px, ${direction === 'enter' ? lerp(28, 0, active) : lerp(0, 24, progress)}px, 0) scale(${direction === 'enter' ? lerp(0.9, 1, active) : lerp(1, 0.96, progress)}) skewX(${direction === 'enter' ? lerp(-6, 0, active) : lerp(0, 7, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, 18, progress)}px) saturate(${direction === 'enter' ? lerp(0.62, 1, active) : lerp(1, 0.56, progress)}) brightness(${direction === 'enter' ? lerp(1.48, 1, active) : lerp(1, 1.62, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Thunder Crack',
  description: 'A lightning fissure rips through the shell with an electrical flash and recoil.',
  group: 'Elemental',
  tags: ['thunder', 'lightning', 'crack'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: ThunderCrackLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: ThunderCrackLayer,
  },
});
