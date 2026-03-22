import React from 'react';
import { clamp01, defineShader } from 'overlayterm-shader';

function alphaHex(value: number): string {
  return Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
}

function Surface({ context }: { context: any }) {
  const accent = context.accentColor;
  const screenOpacity = context.surface === 'background' ? 0.92 : context.surface === 'topBar' ? 0.66 : 0.78;
  const scanAlpha = context.surface === 'background' ? 0.13 : 0.08;
  const vignetteAlpha = context.surface === 'border' ? 0.1 : 0.18;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: screenOpacity,
        mixBlendMode: context.surface === 'border' ? 'normal' : 'multiply',
        backgroundImage: [
          `radial-gradient(circle at 50% 56%, ${accent}${alphaHex(0.15)}, transparent 30%)`,
          `linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 16%, rgba(0,0,0,0) 36%)`,
          `repeating-linear-gradient(180deg, rgba(10,16,10,${scanAlpha}) 0 1px, rgba(255,255,255,0) 1px 4px)`,
          `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 58%, rgba(31,24,18,${vignetteAlpha}) 100%)`,
        ].join(', '),
      }}
    />
  );
}

export default defineShader({
  id: 'vintage-macintosh-signal-glass',
  name: 'Signal Glass',
  description: 'A lightweight CRT treatment with scanlines, phosphor bloom, and subtle bezel shading tuned for low overhead.',
  group: 'Vintage Package',
  tags: ['vintage', 'crt', 'lightweight', 'macintosh'],
  background: {
    render: Surface,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 58%, ${context.accentColor}${alphaHex(0.08)}, transparent 34%)`,
        'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0) 18%)',
      ].join(', '),
      opacity: 0.96,
    }),
  },
  topBar: {
    render: Surface,
    resolveStyle: context => ({
      background: `linear-gradient(180deg, rgba(255,255,255,0.15) 0%, ${context.accentColor}${alphaHex(0.05)} 100%)`,
      opacity: 0.72,
    }),
  },
  border: {
    render: Surface,
    resolveStyle: context => ({
      border: `1px solid ${context.theme.palette.borderStrong}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.42), inset 0 0 0 2px rgba(0,0,0,0.04), 0 0 0 1px ${context.accentColor}${alphaHex(0.08)}`,
      opacity: 0.84,
    }),
  },
});
