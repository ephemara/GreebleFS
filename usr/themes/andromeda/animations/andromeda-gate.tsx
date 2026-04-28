import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

const STAR_POINTS = [
  { left: 12, top: 18, scale: 0.65 },
  { left: 22, top: 62, scale: 0.52 },
  { left: 31, top: 28, scale: 0.74 },
  { left: 44, top: 16, scale: 0.58 },
  { left: 57, top: 48, scale: 0.78 },
  { left: 69, top: 22, scale: 0.62 },
  { left: 77, top: 66, scale: 0.56 },
  { left: 87, top: 34, scale: 0.72 },
];

function AndromedaGateLayer({ context }) {
  const progress = clamp01(context.progress);
  const overlayProgress = context.direction === 'enter' ? 1 - progress : progress;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-12%',
        pointerEvents: 'none',
        opacity: lerp(0, 0.94, overlayProgress),
        transition: 'none',
        mixBlendMode: 'screen',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '8%',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: `0 0 42px ${context.accentColor}`,
          filter: `blur(${lerp(0, 9, overlayProgress)}px)`,
          opacity: lerp(0.18, 0.56, overlayProgress),
          transform: `scale(${lerp(0.72, 1.18, overlayProgress)}) rotate(${lerp(-10, 6, overlayProgress)}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '18%',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,0.16) 0%, ${context.accentColor} 28%, transparent 70%)`,
          filter: `blur(${lerp(8, 18, overlayProgress)}px)`,
          opacity: lerp(0.06, 0.26, overlayProgress),
          transform: `scale(${lerp(0.78, 1.08, overlayProgress)})`,
        }}
      />
      {STAR_POINTS.map((star, index) => (
        <div
          key={`andromeda-gate-star-${index}`}
          style={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: 6,
            height: 6,
            borderRadius: '999px',
            background: 'rgba(247,251,255,0.94)',
            boxShadow: '0 0 18px rgba(143,231,255,0.38)',
            transform: `translate3d(${lerp(0, (star.left - 50) * 0.42, overlayProgress)}px, ${lerp(0, (star.top - 50) * 0.34, overlayProgress)}px, 0) scale(${lerp(0.2, star.scale, overlayProgress)})`,
          }}
        />
      ))}
    </div>
  );
}

function resolveShellStyle(context, mode) {
  const progress = clamp01(context.progress);
  const active = mode === 'enter' ? progress : 1 - progress;
  const exitProgress = mode === 'exit' ? progress : 0;
  const verticalSign = context.verticalOrigin === 'top' ? -1 : 1;

  return {
    transform: `perspective(1600px) translate3d(0, ${mode === 'enter' ? lerp(26, 0, active) * verticalSign : lerp(0, -20, exitProgress) * verticalSign}px, 0) scale(${mode === 'enter' ? lerp(0.94, 1, active) : lerp(1, 0.92, exitProgress)}) rotateX(${mode === 'enter' ? lerp(16, 0, active) * verticalSign : lerp(0, -10, exitProgress) * verticalSign}deg)`,
    opacity: context.baseOpacity * (mode === 'enter' ? active : 1 - exitProgress),
    filter: `blur(${mode === 'enter' ? lerp(18, 0, active) : lerp(0, 18, exitProgress)}px) saturate(${mode === 'enter' ? lerp(0.76, 1, active) : lerp(1, 0.78, exitProgress)}) brightness(${mode === 'enter' ? lerp(1.12, 1, active) : lerp(1, 1.14, exitProgress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Andromeda Gate',
  description: 'Shell open and close motion with a soft halo bloom and deep-field star pull.',
  group: 'Cosmic',
  tags: ['andromeda', 'space', 'minimal'],
  open: {
    durationMs: 260,
    resolveShellStyle: context => resolveShellStyle(context, 'enter'),
    renderOverlay: AndromedaGateLayer,
  },
  close: {
    durationMs: 230,
    resolveShellStyle: context => resolveShellStyle(context, 'exit'),
    renderOverlay: AndromedaGateLayer,
  },
});
