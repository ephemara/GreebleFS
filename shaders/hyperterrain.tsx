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

function terrainNoise(progress: number, time: number, ridgeScale: number, seed: number): number {
  const scale = 0.55 + ridgeScale * 1.2;
  return (
    Math.sin(progress * (5.8 + ridgeScale * 4.6) + time * (0.9 + ridgeScale * 0.3) + seed) * 0.6 +
    Math.cos(progress * (11.4 + ridgeScale * 5.8) - time * 0.58 + seed * 1.7) * 0.22 +
    Math.sin(progress * 23.1 + seed * 2.4 + time * 1.4) * 0.08
  ) * scale;
}

function HyperTerrainBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const travelSpeed = Number(context.sharedUniforms.travelSpeed ?? 0.56);
  const ridgeScale = Number(context.sharedUniforms.ridgeScale ?? 0.64);
  const mistDensity = Number(context.sharedUniforms.mistDensity ?? 0.46);

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
      const horizonY = heightCss * (0.36 + mistDensity * 0.06);
      const centerX = widthCss * 0.5;

      const sky = ctx.createLinearGradient(0, 0, 0, horizonY * 1.3);
      sky.addColorStop(0, 'rgba(7,8,24,1)');
      sky.addColorStop(0.35, 'rgba(17,34,54,1)');
      sky.addColorStop(0.7, 'rgba(28,55,76,1)');
      sky.addColorStop(1, 'rgba(255,104,180,0.28)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const auroraBands = 4;
      for (let band = 0; band < auroraBands; band += 1) {
        const progress = band / Math.max(auroraBands - 1, 1);
        const y = horizonY * (0.18 + progress * 0.42);
        const bandGlow = ctx.createLinearGradient(0, y, widthCss, y);
        bandGlow.addColorStop(0, 'rgba(0,0,0,0)');
        bandGlow.addColorStop(0.18, `rgba(56,189,248,${0.08 + progress * 0.06})`);
        bandGlow.addColorStop(0.48, `${context.accentColor}${alphaHex(0.1 + progress * 0.08)}`);
        bandGlow.addColorStop(0.76, 'rgba(217,70,239,0.12)');
        bandGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bandGlow;
        ctx.beginPath();
        ctx.ellipse(
          centerX + Math.sin(localTime * 0.18 + band) * widthCss * 0.06,
          y,
          widthCss * (0.36 - progress * 0.08),
          heightCss * (0.04 + progress * 0.03),
          Math.sin(localTime * 0.3 + band) * 0.28,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      const gridDepth = 8;
      ctx.globalCompositeOperation = 'screen';
      for (let row = 0; row < gridDepth; row += 1) {
        const progress = row / Math.max(gridDepth - 1, 1);
        const y = lerp(horizonY, heightCss * 1.02, progress * progress);
        ctx.strokeStyle = row % 2 === 0 ? `${context.accentColor}${alphaHex(0.14 + progress * 0.08)}` : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.1 - progress * 0.55;
        ctx.beginPath();
        ctx.moveTo(widthCss * 0.12, y);
        ctx.lineTo(widthCss * 0.88, y);
        ctx.stroke();
      }
      for (let column = 0; column < 11; column += 1) {
        const progress = column / 10;
        const x = lerp(widthCss * 0.08, widthCss * 0.92, progress);
        ctx.strokeStyle = column % 3 === 0 ? `${context.accentColor}${alphaHex(0.16)}` : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x, horizonY);
        ctx.lineTo(centerX + (x - centerX) * 0.28, heightCss);
        ctx.stroke();
      }

      const terrainBands = 5;
      const samples = 54;
      for (let band = terrainBands - 1; band >= 0; band -= 1) {
        const depth = band / Math.max(terrainBands - 1, 1);
        const baseY = lerp(horizonY + 8, heightCss * 0.96, depth);
        const amplitude = lerp(8, 92, depth) * (0.58 + ridgeScale * 0.52);
        const bandSpeed = travelSpeed * lerp(0.22, 0.7, depth);
        const hueMix = band % 3;

        ctx.beginPath();
        for (let sample = 0; sample <= samples; sample += 1) {
          const progress = sample / samples;
          const x = progress * widthCss;
          const heightWave =
            terrainNoise(progress, localTime * (0.9 + bandSpeed), ridgeScale, band * 1.3) * amplitude +
            Math.sin(progress * Math.PI * (2.8 + ridgeScale) + localTime * (1.05 + depth * 0.34)) * amplitude * 0.22;
          const flow = Math.sin(localTime * (0.72 + band * 0.12) + progress * 9 + band) * 5;
          const y = baseY + heightWave + flow;
          if (sample === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.lineTo(widthCss, heightCss);
        ctx.lineTo(0, heightCss);
        ctx.closePath();

        const fill = ctx.createLinearGradient(0, baseY - amplitude, 0, heightCss);
        fill.addColorStop(0, hueMix === 0 ? 'rgba(35,255,205,0.05)' : 'rgba(255,255,255,0.03)');
        fill.addColorStop(0.32, hueMix === 1 ? `${context.accentColor}${alphaHex(0.1 + depth * 0.08)}` : 'rgba(64,196,255,0.1)');
        fill.addColorStop(0.7, hueMix === 2 ? 'rgba(255,112,168,0.13)' : 'rgba(13,12,24,0.26)');
        fill.addColorStop(1, 'rgba(5,6,16,0.96)');
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = band % 2 === 0 ? `${context.accentColor}${alphaHex(0.14 + depth * 0.08)}` : 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 1 + depth * 1.15;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }

      const ridgeCount = Math.round(lerp(18, 36, ridgeScale));
      for (let ridge = 0; ridge < ridgeCount; ridge += 1) {
        const progress = ridge / Math.max(ridgeCount - 1, 1);
        const x = progress * widthCss;
        const wave = Math.sin(localTime * (0.8 + ridgeScale * 0.5) + progress * 10) * lerp(14, 42, ridgeScale);
        const y = horizonY + heightCss * 0.13 + wave * 0.2 + progress * progress * heightCss * 0.52;
        ctx.strokeStyle = ridge % 4 === 0 ? `${context.accentColor}${alphaHex(0.18)}` : `rgba(255,255,255,${0.04 + progress * 0.06})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, heightCss);
        ctx.stroke();
      }

      const mistCount = Math.round(lerp(8, 20, mistDensity));
      for (let mist = 0; mist < mistCount; mist += 1) {
        const seed = mist * 1.27;
        const mx = (Math.sin(seed * 7.4 + localTime * 0.18) * 0.5 + 0.5) * widthCss;
        const my = lerp(horizonY * 0.6, heightCss * 0.8, (mist % 7) / 6) + Math.cos(localTime * 0.6 + seed) * 14;
        const radius = lerp(28, 110, mistDensity) * (0.45 + (mist % 4) * 0.14);
        const mistGlow = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
        mistGlow.addColorStop(0, `rgba(255,255,255,${0.06 + mistDensity * 0.06})`);
        mistGlow.addColorStop(0.28, `${context.accentColor}${alphaHex(0.08 + mistDensity * 0.08)}`);
        mistGlow.addColorStop(0.74, 'rgba(255,122,178,0.05)');
        mistGlow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mistGlow;
        ctx.beginPath();
        ctx.ellipse(mx, my, radius * 1.5, radius * 0.6, Math.sin(seed) * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      const sparks = Math.round(lerp(18, 52, travelSpeed));
      for (let spark = 0; spark < sparks; spark += 1) {
        const seed = spark * 0.73;
        const x = (Math.sin(seed * 12.8 + localTime * 0.75) * 0.5 + 0.5) * widthCss;
        const y = horizonY + Math.pow((spark % 11) / 10, 1.5) * (heightCss - horizonY);
        const size = 0.8 + (spark % 4) * 0.45;
        ctx.fillStyle = spark % 5 === 0 ? 'rgba(255,255,255,0.82)' : `${context.accentColor}${alphaHex(0.24)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.isSettingsActive, mistDensity, ridgeScale, travelSpeed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-10%',
        width: '120%',
        height: '120%',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: context.isSettingsActive ? 0.99 : 0.92,
      }}
    />
  );
}

function HyperTerrainTopBar({ context }) {
  const time = useClock(1.08);
  const travelSpeed = Number(context.sharedUniforms.travelSpeed ?? 0.56);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 24%, ${context.accentColor}${alphaHex(0.12)} 50%, rgba(255,255,255,0.12) 76%, transparent 100%)`,
          filter: 'blur(7px)',
          opacity: 0.76,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.56) * 12}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 12px, rgba(255,255,255,0.06) 12px 14px, transparent 14px 28px)',
            `radial-gradient(circle at ${52 + Math.sin(time * 1.2) * 9}% 28%, ${context.accentColor}${alphaHex(0.08 + travelSpeed * 0.06)}, transparent 24%)`,
          ].join(', '),
          opacity: 0.28,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function HyperTerrainBorder({ context }) {
  const time = useClock(1.38);
  const ridgeScale = Number(context.sharedUniforms.ridgeScale ?? 0.64);
  const pulse = 0.25 + Math.sin(time * 1.7) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px ${context.accentColor}${alphaHex(0.08 + ridgeScale * 0.08)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-16%, -16%) rotate(${time * 18}deg)` },
        { inset: '0 0 auto auto', transform: `translate(16%, -16%) rotate(${-time * 20}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-16%, 16%) rotate(${-time * 16}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(16%, 16%) rotate(${time * 22}deg)` },
      ].map((corner, index) => (
        <div
          key={`hyperterrain-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 50,
            height: 50,
            background: `radial-gradient(circle, rgba(255,255,255,0.16) 0%, ${context.accentColor}${alphaHex(0.12)} 40%, transparent 70%)`,
            filter: 'blur(7px)',
            opacity: 0.58,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Hyper Terrain',
  description: 'A neon terrain flyover with stacked horizon bands, perspective gridlines, and broad atmospheric color shifts.',
  group: 'Landscape Flights',
  tags: ['terrain', 'flight', 'aurora', 'vistas'],
  controls: [
    {
      id: 'travelSpeed',
      label: 'Travel Speed',
      description: 'Increase the forward sweep across the terrain field.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.56,
    },
    {
      id: 'ridgeScale',
      label: 'Ridge Scale',
      description: 'Expand the terrain amplitude and sharpen the mountain silhouettes.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.64,
    },
    {
      id: 'mistDensity',
      label: 'Mist Density',
      description: 'Control the atmospheric haze and depth falloff in the world.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.46,
    },
  ],
  resolveSharedUniforms: context => ({
    travelSpeed: clamp01(0.26 + context.blurStrength / 42 + context.zoom * 0.08),
    ridgeScale: clamp01(0.38 + context.panelTransparency * 0.28 + context.viewport.width / 6200),
    mistDensity: clamp01(0.24 + (context.isSettingsActive ? 0.08 : 0) + context.blurStrength / 76),
  }),
  background: {
    render: HyperTerrainBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 26%, rgba(90,255,214,0.12), transparent 18%)',
        `radial-gradient(circle at 18% 20%, ${context.accentColor}${alphaHex(0.1)}, transparent 20%)`,
        'linear-gradient(180deg, rgba(7,9,21,1) 0%, rgba(12,28,42,1) 46%, rgba(53,95,102,0.42) 100%)',
      ].join(', '),
      opacity: 0.96,
      mixBlendMode: 'screen' as const,
      filter: `saturate(${1.08 + Number(context.sharedUniforms.mistDensity ?? 0.46) * 0.08})`,
    }),
  },
  topBar: {
    render: HyperTerrainTopBar,
    resolveStyle: context => ({
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 38%, ${context.accentColor}${alphaHex(0.08 + Number(context.sharedUniforms.travelSpeed ?? 0.56) * 0.08)} 50%, rgba(255,255,255,0.12) 62%, transparent 100%)`,
      opacity: 0.7,
      filter: 'blur(7px)',
      transform: 'scale(1.04)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: HyperTerrainBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.22)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 16px ${context.accentColor}${alphaHex(0.1)}`,
    }),
  },
});
