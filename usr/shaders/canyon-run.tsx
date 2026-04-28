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

function CanyonRunBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const travelSpeed = Number(context.sharedUniforms.travelSpeed ?? 0.58);
  const canyonDepth = Number(context.sharedUniforms.canyonDepth ?? 0.62);
  const sunHalo = Number(context.sharedUniforms.sunHalo ?? 0.54);

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
      const horizonY = heightCss * (0.34 + canyonDepth * 0.08);
      const centerX = widthCss * (0.5 + Math.sin(localTime * 0.12) * 0.02);

      const sky = ctx.createLinearGradient(0, 0, 0, horizonY * 1.2);
      sky.addColorStop(0, 'rgba(10,13,28,1)');
      sky.addColorStop(0.34, 'rgba(23,28,62,1)');
      sky.addColorStop(0.67, 'rgba(62,32,48,1)');
      sky.addColorStop(1, 'rgba(255,146,96,0.55)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const sunGlow = ctx.createRadialGradient(
        centerX,
        horizonY * (0.76 + Math.sin(localTime * 0.18) * 0.02),
        0,
        centerX,
        horizonY * 0.9,
        Math.max(widthCss, heightCss) * (0.42 + sunHalo * 0.1),
      );
      sunGlow.addColorStop(0, `${context.accentColor}${alphaHex(0.18 + sunHalo * 0.16)}`);
      sunGlow.addColorStop(0.24, 'rgba(255,164,86,0.2)');
      sunGlow.addColorStop(0.6, 'rgba(255,92,138,0.1)');
      sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGlow;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const canyonLayers = 6;
      const columnCount = 42;
      for (let layer = canyonLayers - 1; layer >= 0; layer -= 1) {
        const depth = layer / Math.max(canyonLayers - 1, 1);
        const baseY = lerp(horizonY + 12, heightCss * 0.96, depth);
        const amp = lerp(8, 72, depth) * (0.72 + canyonDepth * 0.42);
        const speed = lerp(0.12, 0.4, depth) * travelSpeed;
        const leftInset = lerp(widthCss * 0.28, widthCss * 0.04, depth);
        const rightInset = lerp(widthCss * 0.28, widthCss * 0.05, depth);
        const skew = Math.sin(localTime * (0.28 + depth * 0.15) + layer) * 0.08;

        ctx.beginPath();
        ctx.moveTo(0, heightCss);
        for (let column = 0; column <= columnCount; column += 1) {
          const progress = column / columnCount;
          const x = progress * widthCss;
          const ridge =
            Math.sin(progress * Math.PI * (1.4 + depth * 0.35) + localTime * (1.1 + depth)) * amp * 0.46 +
            Math.cos(progress * Math.PI * 2.4 + layer * 1.4 + localTime * 0.6) * amp * 0.18;
          const taper = Math.sin(progress * Math.PI) * lerp(1, 0.32, depth);
          const wallBias = Math.abs(progress - 0.5) * lerp(0.9, 0.3, depth);
          const y = baseY + ridge - wallBias * amp * 0.56;
          if (column === 0) {
            ctx.lineTo(leftInset, y);
          } else {
            ctx.lineTo(x, y + Math.sin(localTime * speed + progress * 7 + layer) * taper * 10);
          }
        }
        for (let column = columnCount; column >= 0; column -= 1) {
          const progress = column / columnCount;
          const x = progress * widthCss;
          const ridge =
            Math.sin(progress * Math.PI * (1.3 + depth * 0.32) + localTime * (0.96 + depth)) * amp * 0.52 +
            Math.cos(progress * Math.PI * 2.8 + layer * 0.8 - localTime * 0.5) * amp * 0.22;
          const wallBias = Math.abs(progress - 0.5) * lerp(0.9, 0.2, depth);
          const y = baseY + ridge + wallBias * amp * 0.44;
          if (column === columnCount) {
            ctx.lineTo(widthCss - rightInset, y);
          } else {
            ctx.lineTo(x, y + Math.cos(localTime * speed + progress * 5 + layer) * 8);
          }
        }
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, horizonY, 0, heightCss);
        fill.addColorStop(0, `rgba(255,255,255,${0.03 + depth * 0.05})`);
        fill.addColorStop(0.38, `${context.accentColor}${alphaHex(0.08 + depth * 0.08)}`);
        fill.addColorStop(0.74, `rgba(255,124,52,${0.12 + depth * 0.12})`);
        fill.addColorStop(1, `rgba(10,8,18,${0.72 + depth * 0.12})`);
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.strokeStyle = layer % 2 === 0 ? `${context.accentColor}${alphaHex(0.18 + depth * 0.08)}` : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1 + depth * 1.2;
        ctx.globalCompositeOperation = 'screen';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }

      const pathX = widthCss * (0.5 + Math.sin(localTime * 0.28) * 0.04);
      const roadWidth = lerp(widthCss * 0.32, widthCss * 0.06, canyonDepth);
      const trail = ctx.createLinearGradient(0, horizonY, 0, heightCss);
      trail.addColorStop(0, 'rgba(255,255,255,0.55)');
      trail.addColorStop(0.24, `${context.accentColor}${alphaHex(0.28 + canyonDepth * 0.08)}`);
      trail.addColorStop(1, 'rgba(255,98,60,0.05)');
      ctx.fillStyle = trail;
      ctx.beginPath();
      ctx.moveTo(pathX - roadWidth * 0.2, horizonY);
      ctx.bezierCurveTo(
        pathX - roadWidth * 0.34,
        horizonY + heightCss * 0.12,
        pathX - roadWidth * 0.18,
        heightCss * 0.7,
        pathX - roadWidth * 0.42,
        heightCss,
      );
      ctx.lineTo(pathX + roadWidth * 0.42, heightCss);
      ctx.bezierCurveTo(
        pathX + roadWidth * 0.18,
        heightCss * 0.7,
        pathX + roadWidth * 0.34,
        horizonY + heightCss * 0.12,
        pathX + roadWidth * 0.2,
        horizonY,
      );
      ctx.closePath();
      ctx.fill();

      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `${context.accentColor}${alphaHex(0.3 + sunHalo * 0.1)}`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pathX, horizonY);
      ctx.bezierCurveTo(
        pathX - roadWidth * 0.1,
        horizonY + heightCss * 0.16,
        pathX + roadWidth * 0.08,
        heightCss * 0.76,
        pathX - roadWidth * 0.06,
        heightCss,
      );
      ctx.stroke();

      const dustCount = Math.round(lerp(28, 72, canyonDepth));
      for (let dust = 0; dust < dustCount; dust += 1) {
        const seed = dust * 0.83;
        const depth = (dust % 11) / 10;
        const x = (Math.sin(seed * 11.3 + localTime * (0.5 + travelSpeed * 0.5)) * 0.5 + 0.5) * widthCss;
        const y = lerp(horizonY - 16, heightCss + 20, depth) + Math.cos(localTime * 1.4 + seed) * lerp(2, 16, depth);
        const size = 0.7 + depth * 1.8;
        ctx.fillStyle = dust % 4 === 0 ? 'rgba(255,255,255,0.76)' : `${context.accentColor}${alphaHex(0.2 + depth * 0.12)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [canyonDepth, context.accentColor, context.isSettingsActive, sunHalo, travelSpeed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-12%',
        width: '124%',
        height: '124%',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: context.isSettingsActive ? 0.99 : 0.92,
      }}
    />
  );
}

function CanyonRunTopBar({ context }) {
  const time = useClock(1.04);
  const travelSpeed = Number(context.sharedUniforms.travelSpeed ?? 0.58);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 20%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.12) 80%, transparent 100%)`,
          filter: 'blur(7px)',
          opacity: 0.78,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.62) * 10}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,0.06) 14px 16px, transparent 16px 30px)',
            `radial-gradient(circle at ${48 + Math.sin(time * 1.4) * 10}% 30%, ${context.accentColor}${alphaHex(0.08 + travelSpeed * 0.06)}, transparent 22%)`,
          ].join(', '),
          opacity: 0.3,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function CanyonRunBorder({ context }) {
  const time = useClock(1.34);
  const canyonDepth = Number(context.sharedUniforms.canyonDepth ?? 0.62);
  const pulse = 0.26 + Math.sin(time * 1.8) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 18px ${context.accentColor}${alphaHex(0.08 + canyonDepth * 0.08)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-18%, -18%) rotate(${time * 16}deg)` },
        { inset: '0 0 auto auto', transform: `translate(18%, -18%) rotate(${-time * 18}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-18%, 18%) rotate(${-time * 14}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(18%, 18%) rotate(${time * 20}deg)` },
      ].map((corner, index) => (
        <div
          key={`canyon-run-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 52,
            height: 52,
            background: `radial-gradient(circle, rgba(255,255,255,0.16) 0%, ${context.accentColor}${alphaHex(0.12)} 42%, transparent 72%)`,
            filter: 'blur(8px)',
            opacity: 0.6,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Canyon Run',
  description: 'A sunstruck first-person canyon flight with layered ridges, a glowing flight path, and a fast, cinematic horizon.',
  group: 'Landscape Flights',
  tags: ['canyon', 'flight', 'desert', 'horizon'],
  controls: [
    {
      id: 'travelSpeed',
      label: 'Travel Speed',
      description: 'Push the forward motion and dust streaming through the canyon.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.58,
    },
    {
      id: 'canyonDepth',
      label: 'Canyon Depth',
      description: 'Stretch the canyon walls and deepen the flight perspective.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.62,
    },
    {
      id: 'sunHalo',
      label: 'Sun Halo',
      description: 'Expand the warm horizon bloom and flare around the skyline.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.54,
    },
  ],
  resolveSharedUniforms: context => ({
    travelSpeed: clamp01(0.24 + context.blurStrength / 44 + context.zoom * 0.12),
    canyonDepth: clamp01(0.36 + context.panelTransparency * 0.26 + context.viewport.width / 5600),
    sunHalo: clamp01(0.34 + (context.isSettingsActive ? 0.08 : 0) + context.blurStrength / 72),
  }),
  background: {
    render: CanyonRunBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 28%, rgba(255,173,84,0.12), transparent 18%)',
        `radial-gradient(circle at 26% 16%, ${context.accentColor}${alphaHex(0.1)}, transparent 18%)`,
        'linear-gradient(180deg, rgba(8,10,24,1) 0%, rgba(29,21,42,1) 48%, rgba(255,128,78,0.36) 100%)',
      ].join(', '),
      opacity: 0.96,
      mixBlendMode: 'screen' as const,
    }),
  },
  topBar: {
    render: CanyonRunTopBar,
    resolveStyle: context => ({
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 38%, ${context.accentColor}${alphaHex(0.08 + Number(context.sharedUniforms.travelSpeed ?? 0.58) * 0.08)} 50%, rgba(255,255,255,0.12) 62%, transparent 100%)`,
      opacity: 0.7,
      filter: 'blur(7px)',
      transform: 'scale(1.04)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: CanyonRunBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.22)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 16px ${context.accentColor}${alphaHex(0.1)}`,
    }),
  },
});
