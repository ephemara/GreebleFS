import React from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

const CONFETTI = [
  { left: 14, top: 18, color: '#73B9FF', rotate: -22 },
  { left: 28, top: 62, color: '#FF9BB0', rotate: 18 },
  { left: 42, top: 24, color: '#FFD36B', rotate: -14 },
  { left: 58, top: 56, color: '#78D4AB', rotate: 20 },
  { left: 72, top: 20, color: '#B899FF', rotate: -18 },
  { left: 86, top: 64, color: '#73B9FF', rotate: 14 },
];

function ToonPopOverlay({ context }) {
  const progress = clamp01(context.progress);
  const overlayProgress = context.direction === 'enter' ? 1 - progress : progress;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-12%',
        pointerEvents: 'none',
        opacity: lerp(0, 0.98, overlayProgress),
        transition: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '12%',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,0.3) 0%, ${context.accentColor} 26%, transparent 68%)`,
          filter: `blur(${lerp(8, 24, overlayProgress)}px)`,
          opacity: lerp(0.04, 0.22, overlayProgress),
          transform: `scale(${lerp(0.82, 1.12, overlayProgress)})`,
        }}
      />

      {[12, 34, 58, 82].map((left, index) => (
        <div
          key={`toon-bubble-${index}`}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: `${18 + index * 14}%`,
            width: 24 + index * 4,
            height: 24 + index * 4,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.82)',
            background: 'rgba(255,255,255,0.16)',
            boxShadow: `0 0 24px ${context.accentColor}`,
            opacity: lerp(0.08, 0.34, overlayProgress),
            transform: `translate3d(${lerp(0, (index - 1.5) * 18, overlayProgress)}px, ${lerp(0, -18 - index * 6, overlayProgress)}px, 0) scale(${lerp(0.24, 1.04, overlayProgress)})`,
          }}
        />
      ))}

      {CONFETTI.map((piece, index) => (
        <div
          key={`toon-pop-piece-${index}`}
          style={{
            position: 'absolute',
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            width: 18,
            height: 12,
            borderRadius: 6,
            background: piece.color,
            boxShadow: `0 10px 24px ${piece.color}`,
            opacity: lerp(0.1, 0.92, overlayProgress),
            transform: `translate3d(${lerp(0, (piece.left - 50) * 0.34, overlayProgress)}px, ${lerp(0, (piece.top - 30) * 0.28, overlayProgress)}px, 0) rotate(${lerp(piece.rotate * -0.4, piece.rotate, overlayProgress)}deg) scale(${lerp(0.2, 1, overlayProgress)})`,
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
    transform: `perspective(1500px) translate3d(0, ${
      mode === 'enter' ? lerp(28, 0, active) * verticalSign : lerp(0, -24, exitProgress) * verticalSign
    }px, 0) scale(${
      mode === 'enter' ? lerp(0.9, 1, active) : lerp(1, 0.9, exitProgress)
    }, ${
      mode === 'enter' ? lerp(0.96, 1, active) : lerp(1, 0.94, exitProgress)
    }) rotate(${
      mode === 'enter' ? lerp(-1.8, 0, active) : lerp(0, 1.6, exitProgress)
    }deg)`,
    opacity: context.baseOpacity * (mode === 'enter' ? active : 1 - exitProgress),
    filter: `blur(${
      mode === 'enter' ? lerp(16, 0, active) : lerp(0, 18, exitProgress)
    }px) saturate(${
      mode === 'enter' ? lerp(0.78, 1, active) : lerp(1, 0.82, exitProgress)
    }) brightness(${
      mode === 'enter' ? lerp(1.12, 1, active) : lerp(1, 1.08, exitProgress)
    })`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Toon Pop',
  description: 'A bouncy shell open/close with cloud glow, bubbles, and sticker-confetti motion.',
  group: 'Theme Local',
  tags: ['toon', 'pastel', 'bounce'],
  open: {
    durationMs: 280,
    resolveShellStyle: context => resolveShellStyle(context, 'enter'),
    renderOverlay: ToonPopOverlay,
  },
  close: {
    durationMs: 230,
    resolveShellStyle: context => resolveShellStyle(context, 'exit'),
    renderOverlay: ToonPopOverlay,
  },
});
