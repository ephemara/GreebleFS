import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function BeamOverlay({ context }: { context: any }) {
  const progress = clamp01(context.progress);
  const active = context.direction === 'enter' ? 1 - progress : progress;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: lerp(0, 0.92, active) }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: [
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 4px)',
            'linear-gradient(180deg, rgba(250,255,239,0.18) 0%, rgba(199,224,168,0.08) 36%, rgba(0,0,0,0) 100%)',
          ].join(', '),
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${lerp(-8, 88, active)}%`,
          height: `${lerp(22, 8, active)}%`,
          background: 'linear-gradient(180deg, rgba(232,246,204,0), rgba(232,246,204,0.26), rgba(232,246,204,0))',
          filter: `blur(${lerp(5, 2, active)}px)`,
        }}
      />
    </div>
  );
}

function resolveStyle(context: any, direction: 'enter' | 'exit') {
  const progress = clamp01(context.progress);
  const driven = direction === 'enter' ? progress : 1 - progress;
  const collapse = direction === 'enter' ? 1 - driven : progress;
  const signed = context.verticalOrigin === 'top' ? -1 : 1;

  return {
    transform: `translate3d(0, ${direction === 'enter' ? lerp(18, 0, driven) * signed : lerp(0, -12, progress) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.98, 1, driven) : lerp(1, 0.985, progress)}) scaleY(${direction === 'enter' ? lerp(0.76, 1, driven) : lerp(1, 0.14, progress)})`,
    transformOrigin: '50% 50%',
    opacity: context.baseOpacity * (direction === 'enter' ? driven : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(10, 0, driven) : lerp(0, 6, progress)}px) saturate(${direction === 'enter' ? lerp(0.72, 1, driven) : lerp(1, 0.55, progress)}) contrast(${lerp(1 + collapse * 0.45, 1.08, direction === 'enter' ? driven : 1 - progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  id: 'vintage-macintosh-power-on',
  name: 'Power On',
  description: 'A compact phosphor-beam startup and shutdown pass inspired by vintage Macintosh and monochrome CRT hardware.',
  group: 'Vintage Package',
  tags: ['vintage', 'crt', 'beam', 'macintosh'],
  open: {
    durationMs: 300,
    resolveShellStyle: context => resolveStyle(context, 'enter'),
    renderOverlay: BeamOverlay,
  },
  close: {
    durationMs: 240,
    resolveShellStyle: context => resolveStyle(context, 'exit'),
    renderOverlay: BeamOverlay,
  },
});
