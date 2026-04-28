import React, { useEffect, useRef, useState } from 'react';
import { clamp01, defineShader, lerp } from 'overlayterm-shader';

function useClock(speed = 1): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      setTime(now * 0.001 * speed);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [speed]);

  return time;
}

function alphaHex(value: number): string {
  return Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
}

function CoralDreamBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.68);
  const tide = Number(context.sharedUniforms.tide ?? 0.48);
  const biolume = Number(context.sharedUniforms.biolume ?? 0.68);
  const reefDensity = Number(context.sharedUniforms.reefDensity ?? 0.46);
  const current = Number(context.sharedUniforms.current ?? 0.32);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let frame = 0;
    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const widthCss = canvas.clientWidth;
      const heightCss = canvas.clientHeight;
      if (widthCss <= 0 || heightCss <= 0) {
        frame = window.requestAnimationFrame(render);
        return;
      }

      const localTime = now * 0.001;

      const water = ctx.createLinearGradient(0, 0, 0, heightCss);
      water.addColorStop(0, 'rgba(5, 16, 36, 0.94)');
      water.addColorStop(0.52, `${context.accentColor}${alphaHex(0.12 + biolume * 0.06)}`);
      water.addColorStop(1, 'rgba(2, 9, 18, 0.98)');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const haze = ctx.createRadialGradient(widthCss * 0.52, heightCss * 0.26, 0, widthCss * 0.52, heightCss * 0.34, Math.max(widthCss, heightCss) * 0.76);
      haze.addColorStop(0, `${context.accentColor}${alphaHex(0.14 + biolume * 0.1)}`);
      haze.addColorStop(0.32, 'rgba(255, 182, 115, 0.08)');
      haze.addColorStop(0.72, 'rgba(102, 230, 255, 0.05)');
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      const reefCount = Math.round(lerp(5, 10, reefDensity));
      for (let reef = 0; reef < reefCount; reef += 1) {
        const progress = reef / Math.max(reefCount - 1, 1);
        const baseX = widthCss * (0.16 + progress * 0.68);
        const baseY = heightCss * (0.8 + Math.sin(progress * 3.2) * 0.04);
        const sway = Math.sin(localTime * (0.4 + progress * 0.12) + reef) * (10 + current * 12);
        const heightFactor = lerp(110, 220, reefDensity) * (0.72 + progress * 0.42);
        const branchCount = 4 + (reef % 4);

        ctx.strokeStyle = reef % 2 === 0 ? `${context.accentColor}${alphaHex(0.26)}` : 'rgba(255, 178, 120, 0.22)';
        ctx.lineWidth = 2 + (reef % 3) * 0.4;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.bezierCurveTo(
          baseX - 6 + sway,
          baseY - heightFactor * 0.28,
          baseX + 18 - sway,
          baseY - heightFactor * 0.62,
          baseX + Math.sin(reef) * 6,
          baseY - heightFactor,
        );
        ctx.stroke();

        for (let branch = 0; branch < branchCount; branch += 1) {
          const branchPhase = branch / Math.max(branchCount - 1, 1);
          const branchLift = heightFactor * (0.2 + branchPhase * 0.55);
          const side = branch % 2 === 0 ? -1 : 1;
          const branchX = baseX + side * (12 + branch * 4) + Math.sin(localTime * 1.4 + reef + branch) * 4;
          const branchY = baseY - branchLift;
          const tipX = branchX + side * (16 + branch * 5) + Math.cos(localTime + branch) * 6;
          const tipY = branchY - 18 - branch * 4;
          ctx.strokeStyle = branch % 3 === 0 ? `${context.accentColor}${alphaHex(0.2 + biolume * 0.12)}` : 'rgba(255, 214, 168, 0.18)';
          ctx.lineWidth = 1.1 + branchPhase * 1.2;
          ctx.beginPath();
          ctx.moveTo(baseX, baseY - branchLift * 0.1);
          ctx.quadraticCurveTo(branchX, branchY, tipX, tipY);
          ctx.stroke();
        }
      }

      const bubbleCount = Math.round(lerp(28, 70, biolume));
      for (let bubble = 0; bubble < bubbleCount; bubble += 1) {
        const seed = bubble * 1.61;
        const x = (Math.sin(seed * 9.3 + localTime * 0.24) * 0.5 + 0.5) * widthCss;
        const y = heightCss - ((localTime * (22 + current * 18) + seed * 64) % (heightCss + 80));
        const radius = 0.9 + (bubble % 4) * 0.5;
        ctx.fillStyle = bubble % 6 === 0 ? 'rgba(255,255,255,0.82)' : `${context.accentColor}${alphaHex(0.22 + biolume * 0.1)}`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const glowCount = Math.round(lerp(10, 20, biolume));
      for (let glowIndex = 0; glowIndex < glowCount; glowIndex += 1) {
        const seed = glowIndex * 1.91;
        const x = (Math.sin(seed * 7.4 + localTime * 0.18) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 5.2 + localTime * 0.14) * 0.5 + 0.5) * heightCss;
        const radius = 14 + (glowIndex % 4) * 10 + reefDensity * 16;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, `${context.accentColor}${alphaHex(0.18 + biolume * 0.1)}`);
        glow.addColorStop(0.32, 'rgba(72, 245, 255, 0.08)');
        glow.addColorStop(0.68, 'rgba(255, 143, 180, 0.04)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 1.2, radius * 0.56, Math.sin(seed) * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, tide, biolume, reefDensity, current]);

  return (
    <div style={{ position: 'absolute', inset: '-16%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            'radial-gradient(circle at 50% 18%, rgba(110, 240, 255, 0.12), transparent 22%)',
            `radial-gradient(circle at 20% 28%, ${context.accentColor}${alphaHex(0.16)}, transparent 20%)`,
            'radial-gradient(circle at 80% 72%, rgba(255, 176, 120, 0.1), transparent 20%)',
            'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 36%, rgba(72,245,255,0.06) 68%, transparent 100%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.22}px) saturate(${1.08 + biolume * 0.24})`,
          opacity: 0.9,
          mixBlendMode: 'screen',
          transform: `translate3d(${Math.sin(time * 0.14) * 2}%, ${Math.cos(time * 0.18) * 2}%, 0) scale(1.05)`,
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: context.isSettingsActive ? 0.99 : 0.92,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function CoralDreamTopBar({ context }) {
  const time = useClock(1.06);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 20%, ${context.accentColor}${alphaHex(0.14)} 52%, rgba(110,240,255,0.12) 80%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.72,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.6) * 11}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.05) 12px 14px, transparent 14px 29px)',
          opacity: 0.24,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function CoralDreamBorder({ context }) {
  const time = useClock(1.34);
  const pulse = 0.26 + Math.sin(time * 1.7) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px ${context.accentColor}${alphaHex(0.1)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-18%, -18%) rotate(${time * 20}deg)` },
        { inset: '0 0 auto auto', transform: `translate(18%, -18%) rotate(${-time * 18}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-18%, 18%) rotate(${-time * 16}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(18%, 18%) rotate(${time * 22}deg)` },
      ].map((corner, index) => (
        <div
          key={`coral-dream-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 52,
            height: 52,
            background: `radial-gradient(circle, rgba(255,255,255,0.14) 0%, ${context.accentColor}${alphaHex(0.12)} 42%, transparent 72%)`,
            filter: 'blur(8px)',
            opacity: 0.58,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Coral Dream',
  description: 'A bioluminescent reef scene with drifting plankton, warm coral silhouettes, and underwater depth.',
  group: 'Biolume Depths',
  tags: ['coral', 'bioluminescent', 'underwater', 'dream'],
  controls: [
    { id: 'tide', label: 'Tide', description: 'Raise the undersea movement and current sway.', min: 0, max: 1, step: 0.02 },
    { id: 'biolume', label: 'Biolume', description: 'Increase the glowing coral and particle bloom.', min: 0, max: 1, step: 0.02 },
    { id: 'reefDensity', label: 'Reef Density', description: 'Add more coral structures and reef silhouettes.', min: 0, max: 1, step: 0.02 },
    { id: 'current', label: 'Current', description: 'Shift the drift of bubbles and coral sway.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    tide: clamp01(0.26 + context.blurStrength / 44 + context.zoom * 0.06),
    biolume: clamp01(0.4 + context.panelTransparency * 0.28 + (context.isSettingsActive ? 0.08 : 0)),
    reefDensity: clamp01(0.22 + context.viewport.width / 3600),
    current: clamp01(0.16 + context.zoom * 0.06),
  }),
  background: {
    render: CoralDreamBackground,
  },
  topBar: {
    render: CoralDreamTopBar,
    resolveStyle: () => ({
      opacity: 0.7,
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: CoralDreamBorder,
  },
});
