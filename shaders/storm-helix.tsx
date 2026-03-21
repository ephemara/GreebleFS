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

function StormHelixBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.88);
  const stormEnergy = Number(context.sharedUniforms.stormEnergy ?? 0.62);
  const helixSpan = Number(context.sharedUniforms.helixSpan ?? 0.74);

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
      const centerX = widthCss * 0.5;
      const centerY = heightCss * (0.5 + Math.sin(localTime * 0.22) * 0.04);
      const swirlRadius = Math.min(widthCss, heightCss) * (0.28 + helixSpan * 0.1);

      const atmosphere = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, swirlRadius * 3);
      atmosphere.addColorStop(0, `${context.accentColor}${alphaHex(0.18 + stormEnergy * 0.1)}`);
      atmosphere.addColorStop(0.32, 'rgba(255,255,255,0.06)');
      atmosphere.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atmosphere;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      const helixBands = Math.round(lerp(5, 9, stormEnergy));
      for (let band = 0; band < helixBands; band += 1) {
        const bandProgress = band / Math.max(helixBands - 1, 1);
        const phase = localTime * (0.75 + bandProgress * 0.24) + band * 0.9;
        const spread = swirlRadius * (0.45 + bandProgress * 0.82);
        const lineWidth = 2.8 - bandProgress * 1.6;
        const alpha = 0.18 + bandProgress * 0.16;

        ctx.strokeStyle = band % 2 === 0
          ? `${context.accentColor}${alphaHex(alpha)}`
          : `rgba(255,255,255,${(alpha * 0.88).toFixed(3)})`;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(-60, centerY + Math.sin(phase) * 22);
        ctx.bezierCurveTo(
          widthCss * 0.22,
          centerY - spread * 0.54 + Math.cos(phase * 1.2) * 20,
          widthCss * 0.68,
          centerY + spread * 0.42 + Math.sin(phase * 1.3) * 20,
          widthCss + 60,
          centerY + Math.cos(phase * 0.8) * 16,
        );
        ctx.stroke();
      }

      const arcCount = Math.round(lerp(18, 32, stormEnergy));
      for (let arc = 0; arc < arcCount; arc += 1) {
        const seed = arc * 0.89;
        const angle = seed * 0.7 + localTime * 0.64;
        const radius = swirlRadius * (0.28 + (arc % 8) * 0.1);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle * 0.92) * radius * 0.74;
        const burst = 1.2 + (arc % 5) * 0.7 + Math.sin(localTime * 1.8 + seed) * 0.4;
        ctx.fillStyle = arc % 4 === 0 ? 'rgba(255,255,255,0.82)' : `${context.accentColor}${alphaHex(0.22 + (arc % 3) * 0.1)}`;
        ctx.beginPath();
        ctx.arc(x, y, burst, 0, Math.PI * 2);
        ctx.fill();
      }

      const boltCount = Math.round(lerp(6, 14, stormEnergy));
      for (let bolt = 0; bolt < boltCount; bolt += 1) {
        const seed = bolt * 1.61;
        const x = centerX - swirlRadius * 1.18 + ((bolt % 7) / 6) * swirlRadius * 2.36;
        const top = heightCss * (0.08 + (seed % 0.5) * 0.18);
        const bottom = heightCss * (0.72 + (bolt % 5) * 0.05);
        ctx.strokeStyle = bolt % 3 === 0 ? 'rgba(255,255,255,0.42)' : `${context.accentColor}${alphaHex(0.22)}`;
        ctx.lineWidth = bolt % 2 === 0 ? 1.4 : 0.9;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + Math.sin(seed + localTime * 2.4) * 22, top + 64);
        ctx.lineTo(x - Math.cos(seed * 1.3 + localTime * 1.8) * 18, (top + bottom) * 0.5);
        ctx.lineTo(x + Math.sin(seed * 0.9 + localTime * 2.1) * 16, bottom);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, helixSpan, stormEnergy]);

  return (
    <div style={{ position: 'absolute', inset: '-14%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-12%',
          background: [
            `radial-gradient(circle at 50% 46%, ${context.accentColor}${alphaHex(0.16 + stormEnergy * 0.08)}, transparent 24%)`,
            'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.1), transparent 14%)',
            'radial-gradient(circle at 82% 72%, rgba(110,231,255,0.1), transparent 16%)',
            'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 18%, rgba(255,255,255,0.02) 72%, transparent 100%)',
          ].join(', '),
          filter: `blur(${16 + context.blurStrength * 0.26}px) saturate(${1.12 + stormEnergy * 0.2})`,
          mixBlendMode: 'screen',
          opacity: 0.88,
          transform: `translate3d(${Math.sin(time * 0.28) * 4}%, ${Math.cos(time * 0.18) * 2}%, 0) scale(1.03)`,
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
          mixBlendMode: 'screen',
          opacity: context.isSettingsActive ? 1 : 0.9,
        }}
      />
    </div>
  );
}

function StormHelixTopBar({ context }) {
  const time = useClock(1.16);
  const barFlux = Number(context.sharedUniforms.barFlux ?? 0.5);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 18%, ${context.accentColor}${alphaHex(0.18)} 48%, rgba(255,255,255,0.1) 70%, transparent 100%)`,
          filter: 'blur(10px)',
          opacity: 0.8,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.72) * 12}%) skewX(${Math.sin(time * 0.34) * 6}deg)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.08) 10px 12px, transparent 12px 26px)',
            `radial-gradient(circle at ${54 + Math.sin(time * 1.4) * 8}% 32%, ${context.accentColor}${alphaHex(0.12 + barFlux * 0.08)}, transparent 22%)`,
          ].join(', '),
          opacity: 0.36,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function StormHelixBorder({ context }) {
  const time = useClock(1.42);
  const pulse = 0.28 + Math.sin(time * 2.2) * 0.07;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 30px ${context.accentColor}${alphaHex(0.14)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-20%, -20%) rotate(${time * 24}deg)` },
        { inset: '0 0 auto auto', transform: `translate(20%, -20%) rotate(${-time * 20}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-20%, 20%) rotate(${-time * 18}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(20%, 20%) rotate(${time * 22}deg)` },
      ].map((corner, index) => (
        <div
          key={`storm-helix-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 58,
            height: 58,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.16)} 38%, transparent 70%)`,
            filter: 'blur(8px)',
            opacity: 0.64,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `perspective(1400px) translate3d(${lerp(-16, 0, active)}px, ${lerp(28, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.84, 1, active) : lerp(1, 0.82, progress)}) rotateY(${direction === 'enter' ? lerp(-12, 0, active) : lerp(0, 16, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, 16, progress)}px) saturate(${direction === 'enter' ? lerp(0.7, 1.1, active) : lerp(1.1, 0.74, progress)}) brightness(${direction === 'enter' ? lerp(0.82, 1, active) : lerp(1, 0.76, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineShader({
  name: 'Storm Helix',
  description: 'Electrified helical weather bands, lightning spikes, and a turbulent glass-storm atmosphere.',
  group: 'Authoring Extremes',
  tags: ['storm', 'helix', 'lightning', 'weather'],
  controls: [
    { id: 'stormEnergy', label: 'Storm Energy', description: 'Control lightning intensity and storm brightness.', min: 0, max: 1, step: 0.02 },
    { id: 'helixSpan', label: 'Helix Span', description: 'Change how wide the helical storm bands sweep.', min: 0, max: 1, step: 0.02 },
    { id: 'barFlux', label: 'Bar Flux', description: 'Push the chrome bar pulse and flux shimmer.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    stormEnergy: clamp01(0.28 + context.blurStrength / 34 + context.panelTransparency * 0.26 + (context.isSettingsActive ? 0.08 : 0)),
    helixSpan: clamp01(0.3 + context.viewport.width / 3200 + context.zoom * 0.14),
    barFlux: clamp01(0.22 + context.zoom * 0.1 + context.panelTransparency * 0.18),
  }),
  background: {
    render: StormHelixBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 50%, ${context.accentColor}${alphaHex(0.08)}, transparent 24%)`,
        'radial-gradient(circle at 16% 20%, rgba(255,255,255,0.08), transparent 14%)',
        'radial-gradient(circle at 82% 24%, rgba(255,255,255,0.06), transparent 18%)',
      ].join(', '),
      opacity: 0.94,
      mixBlendMode: 'screen',
    }),
  },
  topBar: {
    render: StormHelixTopBar,
    resolveStyle: context => ({
      opacity: 0.74,
      filter: 'blur(10px) saturate(1.14)',
      transform: 'scale(1.06)',
      mixBlendMode: 'screen' as const,
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 40%, ${context.accentColor}${alphaHex(0.12)} 50%, rgba(255,255,255,0.12) 60%, transparent 100%)`,
    }),
  },
  border: {
    render: StormHelixBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.24)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 24px ${context.accentColor}${alphaHex(0.14)}`,
    }),
  },
});
