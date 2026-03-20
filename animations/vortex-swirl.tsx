import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function VortexLayer({ context }) {
  const progress = clamp01(context.progress);
  const activeProgress = context.direction === 'enter' ? 1 - progress : progress;
  const twist = lerp(0.12, 0.86, activeProgress);
  const flareOpacity = lerp(0, 0.82, activeProgress);
  const accent = context.accentColor;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: -48,
        pointerEvents: 'none',
        opacity: flareOpacity,
        transition: 'none',
        mixBlendMode: 'screen',
        filter: `blur(${lerp(4, 18, activeProgress)}px) saturate(${lerp(1.05, 1.55, activeProgress)})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 50%, ${accent}55 0%, transparent 34%), radial-gradient(circle at 30% 35%, rgba(255,255,255,0.28) 0%, transparent 12%), radial-gradient(circle at 68% 72%, ${accent}99 0%, transparent 18%)`,
          transform: `rotate(${lerp(-24, 320, activeProgress)}deg) scale(${lerp(0.78, 1.22, twist)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '18%',
          borderRadius: '50%',
          border: `1px solid ${accent}66`,
          background: `conic-gradient(from ${lerp(-140, 320, activeProgress)}deg, transparent 0deg, ${accent}66 90deg, rgba(255,255,255,0.24) 180deg, transparent 360deg)`,
          transform: `scale(${lerp(0.7, 1.14, activeProgress)})`,
        }}
      />
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signedOffset = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  const drift = lerp(28, 0, active) * signedOffset;
  const spin = direction === 'enter'
    ? lerp(-11, 0, active)
    : lerp(0, 12, progress);
  const scale = direction === 'enter'
    ? lerp(0.82, 1, active)
    : lerp(1, 0.9, progress);
  const blur = direction === 'enter'
    ? lerp(20, 0, active)
    : lerp(0, 18, progress);
  const saturate = direction === 'enter'
    ? lerp(0.72, 1.08, active)
    : lerp(1.08, 0.75, progress);
  const opacityFactor = direction === 'enter'
    ? lerp(0, 1, active)
    : lerp(1, 0, progress);

  return {
    transform: `translate3d(0, ${drift}%, 0) scale(${scale}) rotate(${spin}deg)`,
    opacity: context.baseOpacity * opacityFactor,
    filter: `blur(${blur}px) saturate(${saturate})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Vortex Swirl',
  description: 'Funnel-twist arrival and collapse with orbital glass flares.',
  group: 'Showcase',
  tags: ['vortex', 'swirl', 'showcase'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: VortexLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: VortexLayer,
  },
});
