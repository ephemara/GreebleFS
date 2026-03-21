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

function ZenithCausticsBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.82);
  const causticGain = Number(context.sharedUniforms.causticGain ?? 0.58);
  const prismShift = Number(context.sharedUniforms.prismShift ?? 0.42);

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
      const centerY = heightCss * 0.52;

      const sky = ctx.createLinearGradient(0, 0, 0, heightCss);
      sky.addColorStop(0, `rgba(255,255,255,${(0.08 + prismShift * 0.06).toFixed(3)})`);
      sky.addColorStop(0.45, `${context.accentColor}${alphaHex(0.1 + causticGain * 0.06)}`);
      sky.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      const causticBands = Math.round(lerp(10, 22, causticGain));
      for (let band = 0; band < causticBands; band += 1) {
        const progress = band / Math.max(causticBands - 1, 1);
        const radius = Math.min(widthCss, heightCss) * (0.18 + progress * 0.92);
        const offset = Math.sin(localTime * 1.3 + band * 0.7) * 12;
        const alpha = 0.08 + (1 - progress) * 0.14;
        const gradient = ctx.createRadialGradient(centerX + offset, centerY - offset * 0.34, radius * 0.1, centerX, centerY, radius);
        gradient.addColorStop(0, `${context.accentColor}${alphaHex(alpha + 0.08)}`);
        gradient.addColorStop(0.48, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(centerX + offset, centerY - offset * 0.2, radius * 1.2, radius * (0.48 + progress * 0.14), Math.sin(progress * 5 + localTime) * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }

      const facetCount = 14;
      for (let facet = 0; facet < facetCount; facet += 1) {
        const progress = facet / facetCount;
        const angle = localTime * 0.5 + progress * Math.PI * 2;
        const x1 = centerX + Math.cos(angle) * (widthCss * 0.14);
        const y1 = centerY + Math.sin(angle * 1.1) * (heightCss * 0.12);
        const x2 = centerX + Math.cos(angle + 0.35) * (widthCss * 0.52);
        const y2 = centerY + Math.sin(angle + 0.35) * (heightCss * 0.42);
        ctx.strokeStyle = facet % 3 === 0
          ? `${context.accentColor}${alphaHex(0.12 + prismShift * 0.08)}`
          : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = facet % 2 === 0 ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 + Math.sin(angle * 2.1) * 18, y2 + Math.cos(angle * 1.7) * 18);
        ctx.stroke();
      }

      const sparkCount = Math.round(lerp(18, 42, prismShift));
      for (let spark = 0; spark < sparkCount; spark += 1) {
        const seed = spark * 1.13;
        const x = (Math.sin(seed * 6.7 + localTime * 0.8) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 4.2 + localTime * 0.9) * 0.5 + 0.5) * heightCss;
        const size = 0.8 + (spark % 5) * 0.45;
        ctx.fillStyle = spark % 4 === 0 ? 'rgba(255,255,255,0.82)' : `${context.accentColor}${alphaHex(0.18 + (spark % 3) * 0.08)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, causticGain, prismShift]);

  return (
    <div style={{ position: 'absolute', inset: '-14%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `radial-gradient(circle at 50% 52%, ${context.accentColor}${alphaHex(0.12 + causticGain * 0.08)}, transparent 24%)`,
            'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.1), transparent 14%)',
            'radial-gradient(circle at 82% 72%, rgba(255,209,102,0.08), transparent 18%)',
            'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 18%, rgba(255,255,255,0.02) 72%, transparent 100%)',
          ].join(', '),
          filter: `blur(${18 + context.blurStrength * 0.24}px) saturate(${1.1 + prismShift * 0.18})`,
          mixBlendMode: 'screen',
          opacity: 0.9,
          transform: `translate3d(${Math.sin(time * 0.2) * 2}%, ${Math.cos(time * 0.16) * 2}%, 0)`,
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
          opacity: context.isSettingsActive ? 1 : 0.93,
        }}
      />
    </div>
  );
}

function ZenithCausticsTopBar({ context }) {
  const time = useClock(1.2);
  const lift = Number(context.sharedUniforms.lift ?? 0.48);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 18%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.14) 82%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.84,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.7) * 10}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 11px, rgba(255,255,255,0.08) 11px 13px, transparent 13px 25px)',
            `radial-gradient(circle at ${52 + Math.sin(time * 1.1) * 8}% 30%, ${context.accentColor}${alphaHex(0.1 + lift * 0.08)}, transparent 22%)`,
          ].join(', '),
          opacity: 0.36,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function ZenithCausticsBorder({ context }) {
  const time = useClock(1.46);
  const pulse = 0.28 + Math.sin(time * 2.1) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 28px ${context.accentColor}${alphaHex(0.13)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-18%, -18%) rotate(${time * 18}deg)` },
        { inset: '0 0 auto auto', transform: `translate(18%, -18%) rotate(${-time * 20}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-18%, 18%) rotate(${-time * 16}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(18%, 18%) rotate(${time * 22}deg)` },
      ].map((corner, index) => (
        <div
          key={`zenith-caustics-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 56,
            height: 56,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 40%, transparent 70%)`,
            filter: 'blur(8px)',
            opacity: 0.66,
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
    transform: `perspective(1300px) translate3d(0, ${lerp(24, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.86, 1, active) : lerp(1, 0.9, progress)}) rotateX(${direction === 'enter' ? lerp(10, 0, active) : lerp(0, -8, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(16, 0, active) : lerp(0, 18, progress)}px) saturate(${direction === 'enter' ? lerp(0.8, 1.08, active) : lerp(1.08, 0.82, progress)}) brightness(${direction === 'enter' ? lerp(0.86, 1, active) : lerp(1, 0.82, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineShader({
  name: 'Zenith Caustics',
  description: 'Sunlit prism caustics, drifting facets, and a bright zenith glow that feels polished rather than noisy.',
  group: 'Authoring Extremes',
  tags: ['caustics', 'prism', 'light', 'zenith'],
  controls: [
    { id: 'causticGain', label: 'Caustic Gain', description: 'Increase the strength of the prism caustic field.', min: 0, max: 1, step: 0.02 },
    { id: 'prismShift', label: 'Prism Shift', description: 'Change the amount of spectral drift in the bright field.', min: 0, max: 1, step: 0.02 },
    { id: 'lift', label: 'Zenith Lift', description: 'Push the height and brightness of the top bar caustic lift.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    causticGain: clamp01(0.26 + context.blurStrength / 36 + context.panelTransparency * 0.2 + (context.isSettingsActive ? 0.08 : 0)),
    prismShift: clamp01(0.2 + context.zoom * 0.12 + context.viewport.width / 3200),
    lift: clamp01(0.22 + context.zoom * 0.12),
  }),
  background: {
    render: ZenithCausticsBackground,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 52%, ${context.accentColor}${alphaHex(0.08)}, transparent 24%)`,
        'radial-gradient(circle at 18% 20%, rgba(255,255,255,0.08), transparent 14%)',
        'radial-gradient(circle at 84% 74%, rgba(255,209,102,0.08), transparent 18%)',
      ].join(', '),
      opacity: 0.94,
      mixBlendMode: 'screen',
    }),
  },
  topBar: {
    render: ZenithCausticsTopBar,
    resolveStyle: context => ({
      opacity: 0.74,
      filter: 'blur(8px) saturate(1.14)',
      transform: 'scale(1.05)',
      mixBlendMode: 'screen' as const,
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 40%, ${context.accentColor}${alphaHex(0.12)} 50%, rgba(255,255,255,0.12) 60%, transparent 100%)`,
    }),
  },
  border: {
    render: ZenithCausticsBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.26)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 26px ${context.accentColor}${alphaHex(0.12)}`,
    }),
  },
});
