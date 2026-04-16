import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function ObsidianOverlay({ context }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;
  const accent = context.accentColor || '#8b5cf6';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: `linear-gradient(to right, ${accent}33, transparent 50%, ${accent}33)`,
      opacity: lerp(0, 0.4, active),
      mixBlendMode: 'screen',
    }} />
  );
}

export default defineAnimation({
  name: 'Obsidian Slide',
  description: 'Sleek, heavy directional slide with a prismatic light sweep.',
  group: 'Reference',
  tags: ['obsidian', 'slide', 'heavy'],
  open: {
    resolveShellStyle: (context) => {
      const p = clamp01(context.progress);
      return {
        transform: `translate3d(${lerp(-60, 0, p)}px, 0, 0) skewX(${lerp(10, 0, p)}deg)`,
        opacity: p,
        filter: `blur(${lerp(20, 0, p)}px)`,
        transition: 'none',
      };
    },
    renderOverlay: ObsidianOverlay,
  },
  close: {
    resolveShellStyle: (context) => {
      const p = clamp01(context.progress);
      return {
        transform: `translate3d(${lerp(0, 80, p)}px, 0, 0) skewX(${lerp(0, -5, p)}deg)`,
        opacity: 1 - p,
        filter: `blur(${lerp(0, 30, p)}px)`,
        transition: 'none',
      };
    },
    renderOverlay: ObsidianOverlay,
  }
});
