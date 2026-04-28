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

function FluidDriftBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const time = useClock(0.84);
  const current = Number(context.sharedUniforms.current ?? 0.56);
  const turbulence = Number(context.sharedUniforms.turbulence ?? 0.42);
  const chroma = Number(context.sharedUniforms.chroma ?? 0.64);
  const foam = Number(context.sharedUniforms.foam ?? 0.22);

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
      const waveCount = 5;

      const backdrop = ctx.createLinearGradient(0, 0, widthCss, heightCss);
      backdrop.addColorStop(0, `rgba(255,255,255,${0.03 + foam * 0.03})`);
      backdrop.addColorStop(0.34, `${context.accentColor}${alphaHex(0.08 + chroma * 0.08)}`);
      backdrop.addColorStop(0.72, 'rgba(57, 206, 255, 0.08)');
      backdrop.addColorStop(1, 'rgba(255, 118, 214, 0.1)');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';

      for (let wave = 0; wave < waveCount; wave += 1) {
        const progress = wave / Math.max(waveCount - 1, 1);
        const y = heightCss * (0.16 + progress * 0.68);
        const offset = Math.sin(localTime * (0.68 + progress * 0.18) + wave * 1.7) * (16 + turbulence * 20);
        const amp = lerp(24, 86, chroma) * (0.42 + progress * 0.72);
        const thickness = 2.2 + (1 - progress) * 1.8;

        ctx.lineWidth = thickness;
        ctx.strokeStyle = wave % 2 === 0
          ? `${context.accentColor}${alphaHex(0.2 + chroma * 0.16)}`
          : `rgba(255,255,255,${(0.08 + current * 0.12).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(-40, y + offset);
        ctx.bezierCurveTo(
          widthCss * 0.22,
          y - amp * 0.48 + Math.cos(localTime * 1.1 + wave) * 18,
          widthCss * 0.66,
          y + amp * 0.32 + Math.sin(localTime * 0.9 + wave * 1.3) * 18,
          widthCss + 40,
          y + Math.sin(localTime * 1.24 + wave) * 16,
        );
        ctx.stroke();
      }

      for (let plume = 0; plume < 12; plume += 1) {
        const seed = plume * 1.79;
        const x = (Math.sin(seed * 7.1 + localTime * 0.22) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 5.4 + localTime * 0.17) * 0.5 + 0.5) * heightCss;
        const radius = 18 + (plume % 4) * 14 + turbulence * 18;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, `${context.accentColor}${alphaHex(0.12 + current * 0.1)}`);
        glow.addColorStop(0.4, 'rgba(255,255,255,0.08)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 1.3, radius * 0.58, Math.sin(seed) * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      const dripCount = Math.round(lerp(24, 72, current));
      for (let drip = 0; drip < dripCount; drip += 1) {
        const seed = drip * 2.11;
        const x = (Math.sin(seed * 11.9) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 9.7 + localTime * (0.44 + current * 0.16)) * 0.5 + 0.5) * heightCss;
        const radius = 0.8 + (drip % 4) * 0.4;
        ctx.fillStyle = drip % 5 === 0 ? 'rgba(255,255,255,0.82)' : `${context.accentColor}${alphaHex(0.22 + foam * 0.12)}`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, current, turbulence, chroma, foam]);

  return (
    <div style={{ position: 'absolute', inset: '-16%' }}>
      <div
        style={{
          position: 'absolute',
          inset: '-10%',
          background: [
            `radial-gradient(circle at 18% 20%, ${context.accentColor}${alphaHex(0.18 + chroma * 0.08)}, transparent 24%)`,
            'radial-gradient(circle at 82% 24%, rgba(255,255,255,0.12), transparent 18%)',
            'radial-gradient(circle at 64% 76%, rgba(57,206,255,0.1), transparent 20%)',
            'linear-gradient(150deg, rgba(255,255,255,0.04), transparent 34%, rgba(255,118,214,0.08) 70%, transparent 100%)',
          ].join(', '),
          filter: `blur(${16 + context.blurStrength * 0.22}px) saturate(${1.12 + chroma * 0.26})`,
          opacity: 0.88,
          mixBlendMode: 'screen',
          transform: `translate3d(${Math.sin(time * 0.18) * 3}%, ${Math.cos(time * 0.14) * 2}%, 0) scale(1.04)`,
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
          opacity: context.isSettingsActive ? 0.98 : 0.92,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function FluidDriftTopBar({ context }) {
  const time = useClock(1.08);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 18%, ${context.accentColor}${alphaHex(0.16)} 50%, rgba(57,206,255,0.14) 80%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.72,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.74) * 12}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.06) 12px 14px, transparent 14px 28px)',
          opacity: 0.24,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function FluidDriftBorder({ context }) {
  const time = useClock(1.42);
  const pulse = 0.24 + Math.sin(time * 1.8) * 0.06;

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
      {[0, 1, 2, 3].map(index => {
        const isHorizontal = index < 2;
        return (
          <div
            key={`fluid-drift-corner-${index}`}
            style={{
              position: 'absolute',
              inset: isHorizontal
                ? index === 0 ? '0 auto auto 0' : 'auto 0 0 auto'
                : index === 2 ? '0 0 auto auto' : 'auto auto 0 0',
              width: 50,
              height: 50,
              background: `radial-gradient(circle, rgba(255,255,255,0.16) 0%, ${context.accentColor}${alphaHex(0.12)} 42%, transparent 74%)`,
              filter: 'blur(8px)',
              opacity: 0.55,
            }}
          />
        );
      })}
    </div>
  );
}

export default defineShader({
  name: 'Fluid Drift',
  description: 'A high-chroma liquid field with ribboned motion, drifting plumes, and soft flowing depth.',
  group: 'Fluid Fields',
  tags: ['fluid', 'organic', 'color-field', 'drift'],
  controls: [
    { id: 'current', label: 'Current', description: 'Push the flow speed and directional pull.', min: 0, max: 1, step: 0.02 },
    { id: 'turbulence', label: 'Turbulence', description: 'Increase bending in the liquid ribbons.', min: 0, max: 1, step: 0.02 },
    { id: 'chroma', label: 'Chroma', description: 'Lift the saturated color energy in the flow.', min: 0, max: 1, step: 0.02 },
    { id: 'foam', label: 'Foam', description: 'Add bright tracer highlights and soft droplets.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    current: clamp01(0.34 + context.blurStrength / 42 + context.zoom * 0.06),
    turbulence: clamp01(0.24 + context.panelTransparency * 0.34 + (context.isSettingsActive ? 0.06 : 0)),
    chroma: clamp01(0.42 + context.viewport.width / 3600),
    foam: clamp01(0.18 + context.zoom * 0.08),
  }),
  background: {
    render: FluidDriftBackground,
  },
  topBar: {
    render: FluidDriftTopBar,
    resolveStyle: context => ({
      opacity: 0.7,
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: FluidDriftBorder,
  },
});
