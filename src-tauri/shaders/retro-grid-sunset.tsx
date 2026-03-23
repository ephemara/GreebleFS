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

function RetroGridSunsetBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensity = Number(context.sharedUniforms.intensity ?? 0.62);
  const horizon = Number(context.sharedUniforms.horizon ?? 0.52);
  const gridDepth = Number(context.sharedUniforms.gridDepth ?? 0.6);

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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

      const time = now * 0.001;
      const centerX = widthCss * 0.5;
      const centerY = heightCss * (0.54 + Math.sin(time * 0.15) * 0.01);
      const sunRadius = widthCss * (0.11 + intensity * 0.03);

      const sky = ctx.createLinearGradient(0, 0, 0, heightCss);
      sky.addColorStop(0, 'rgba(244,114,182,0.14)');
      sky.addColorStop(0.42, `${context.accentColor}${alphaHex(0.14 + horizon * 0.08)}`);
      sky.addColorStop(1, 'rgba(11,12,28,0.12)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const sun = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunRadius * 2.4);
      sun.addColorStop(0, 'rgba(255,255,255,0.76)');
      sun.addColorStop(0.18, 'rgba(255,240,170,0.56)');
      sun.addColorStop(0.4, `${context.accentColor}${alphaHex(0.22)}`);
      sun.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const rows = Math.round(lerp(16, 32, gridDepth));
      for (let row = 1; row < rows; row += 1) {
        const progress = row / rows;
        const y = centerY + progress * (heightCss - centerY);
        const spread = (y - centerY) / Math.max(heightCss - centerY, 1);
        const halfWidth = widthCss * (0.08 + spread * spread * 0.88);
        ctx.strokeStyle = row % 3 === 0 ? `${context.accentColor}${alphaHex(0.2 + spread * 0.08)}` : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = row % 4 === 0 ? 1.3 : 0.8;
        ctx.beginPath();
        ctx.moveTo(centerX - halfWidth, y);
        ctx.lineTo(centerX + halfWidth, y);
        ctx.stroke();
      }

      const columns = Math.round(lerp(12, 24, gridDepth));
      for (let column = -columns; column <= columns; column += 1) {
        const progress = (column + columns) / Math.max(columns * 2, 1);
        const x = centerX + (progress - 0.5) * widthCss * 1.12;
        const horizonWarp = (Math.abs(column) / Math.max(columns, 1)) ** 1.8;
        const horizonOffset = Math.sin(time * 0.4 + column * 0.5) * 8 * intensity;
        const topY = centerY - horizon * 8 + horizonOffset * 0.14;
        const bottomY = heightCss;
        const peakX = centerX + (x - centerX) * (1 - horizonWarp * 0.2);
        ctx.strokeStyle = column % 4 === 0 ? `${context.accentColor}${alphaHex(0.16)}` : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = column % 5 === 0 ? 1.4 : 0.75;
        ctx.beginPath();
        ctx.moveTo(peakX, topY);
        ctx.lineTo(x, bottomY);
        ctx.stroke();
      }

      for (let flare = 0; flare < 22; flare += 1) {
        const seed = flare * 1.37;
        const x = (Math.sin(seed * 11.1) * 0.5 + 0.5) * widthCss;
        const y = centerY + (Math.cos(seed * 7.7) * 0.5 + 0.5) * (heightCss - centerY * 0.5);
        const size = 0.7 + (flare % 4) * 0.5;
        ctx.fillStyle = flare % 3 === 0 ? 'rgba(255,255,255,0.86)' : `${context.accentColor}${alphaHex(0.24)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, horizon, gridDepth, intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-12%',
        width: '124%',
        height: '124%',
        opacity: context.isSettingsActive ? 0.98 : 0.92,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function RetroGridSunsetTopBar({ context }) {
  const time = useClock(1.05);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 24%, ${context.accentColor}${alphaHex(0.18)} 50%, rgba(255,255,255,0.12) 76%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.76,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.68) * 16}%)`,
        }}
      />
    </div>
  );
}

function RetroGridSunsetBorder({ context }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}28`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 18px ${context.accentColor}10`,
        }}
      />
    </div>
  );
}

export default defineShader({
  name: 'Retro Grid Sunset',
  description: 'A synthwave horizon tunnel with perspective gridlines, a low blazing sun, and a drifting star field.',
  group: 'Synthwave',
  tags: ['synthwave', 'grid', 'sunset', 'perspective'],
  controls: [
    { id: 'gridDepth', label: 'Grid Depth', description: 'Control how dense and deep the perspective grid feels.', min: 0, max: 1, step: 0.02 },
    { id: 'horizon', label: 'Horizon Lift', description: 'Raise or lower the sunline and horizon composition.', min: 0, max: 1, step: 0.02 },
    { id: 'intensity', label: 'Glow Intensity', description: 'Increase the saturation and energy of the sunset lighting.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    gridDepth: clamp01(0.34 + context.blurStrength / 36 + context.viewport.width / 5200),
    horizon: clamp01(0.46 + context.panelTransparency * 0.16 + (context.isSettingsActive ? 0.06 : 0)),
    intensity: clamp01(0.3 + context.zoom * 0.08 + context.blurStrength / 44),
  }),
  background: {
    render: RetroGridSunsetBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 34%, rgba(255,204,128,0.08), transparent 20%)',
        `radial-gradient(circle at 50% 56%, ${context.accentColor}${alphaHex(0.12)}, transparent 28%)`,
        'linear-gradient(180deg, rgba(255,96,196,0.12) 0%, rgba(61,35,143,0.1) 46%, rgba(7,8,20,0.16) 100%)',
      ].join(', '),
      opacity: 0.98,
      mixBlendMode: 'screen' as const,
    }),
  },
  topBar: {
    render: RetroGridSunsetTopBar,
    resolveStyle: () => ({
      opacity: 0.72,
      filter: 'blur(7px)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: RetroGridSunsetBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}24`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 16px ${context.accentColor}10`,
    }),
  },
});
