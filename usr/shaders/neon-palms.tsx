import React, { useEffect, useRef } from 'react';
import { clamp01, defineShader, lerp } from 'overlayterm-shader';

function alphaHex(value: number): string {
  return Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
}

function NeonPalmsBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glow = Number(context.sharedUniforms.glow ?? 0.62);
  const palmDensity = Number(context.sharedUniforms.palmDensity ?? 0.58);
  const tide = Number(context.sharedUniforms.tide ?? 0.34);

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

      const localTime = now * 0.001;
      const horizon = heightCss * 0.56;
      const sky = ctx.createLinearGradient(0, 0, 0, heightCss);
      sky.addColorStop(0, 'rgba(255,110,180,0.16)');
      sky.addColorStop(0.36, `${context.accentColor}${alphaHex(0.14 + glow * 0.08)}`);
      sky.addColorStop(0.7, 'rgba(18,12,52,0.1)');
      sky.addColorStop(1, 'rgba(7,10,18,0.18)');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const moon = ctx.createRadialGradient(widthCss * 0.76, heightCss * 0.2, 0, widthCss * 0.76, heightCss * 0.2, widthCss * 0.17);
      moon.addColorStop(0, 'rgba(255,255,255,0.74)');
      moon.addColorStop(0.22, 'rgba(142,255,242,0.22)');
      moon.addColorStop(0.5, `${context.accentColor}${alphaHex(0.18)}`);
      moon.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moon;
      ctx.beginPath();
      ctx.arc(widthCss * 0.76, heightCss * 0.2, widthCss * 0.045, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const waveBands = Math.round(lerp(4, 8, tide));
      for (let band = 0; band < waveBands; band += 1) {
        const progress = band / Math.max(waveBands - 1, 1);
        const y = horizon + progress * (heightCss - horizon);
        const wave = Math.sin(localTime * (0.8 + band * 0.08) + band);
        ctx.strokeStyle = band % 2 === 0 ? `${context.accentColor}${alphaHex(0.16 + progress * 0.12)}` : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.2 + (1 - progress) * 1.2;
        ctx.beginPath();
        ctx.moveTo(0, y + wave * 2);
        ctx.bezierCurveTo(widthCss * 0.28, y - 12 + wave * 8, widthCss * 0.68, y + 12 - wave * 8, widthCss, y + Math.sin(localTime * 1.2 + band) * 4);
        ctx.stroke();
      }

      const palmCount = Math.round(lerp(3, 8, palmDensity));
      for (let palm = 0; palm < palmCount; palm += 1) {
        const seed = palm * 1.57;
        const baseX = widthCss * (0.1 + (palm / Math.max(palmCount - 1, 1)) * 0.8);
        const sway = Math.sin(localTime * 0.6 + seed) * (18 + palm * 2);
        const trunkHeight = heightCss * (0.26 + (palm % 3) * 0.06);
        const trunkTopY = horizon - trunkHeight;
        const trunkBottomY = heightCss * 1.03;
        ctx.strokeStyle = `rgba(8, 10, 18, ${0.8 - palm * 0.04})`;
        ctx.lineWidth = 6 - palm * 0.45;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX, trunkBottomY);
        ctx.quadraticCurveTo(baseX + sway * 0.18, horizon + 50, baseX + sway, trunkTopY);
        ctx.stroke();

        const frondCount = 6 + (palm % 4);
        for (let frond = 0; frond < frondCount; frond += 1) {
          const angle = -Math.PI / 2 + (frond - (frondCount - 1) / 2) * 0.34 + Math.sin(localTime * 0.4 + seed) * 0.08;
          const length = widthCss * (0.1 + frond * 0.004 + palm * 0.002);
          const endX = baseX + Math.cos(angle) * length + sway * 0.12;
          const endY = trunkTopY + Math.sin(angle) * length * 0.55;
          ctx.strokeStyle = frond % 2 === 0 ? `${context.accentColor}${alphaHex(0.28 + glow * 0.06)}` : 'rgba(255,255,255,0.18)';
          ctx.lineWidth = 2 - frond * 0.08;
          ctx.beginPath();
          ctx.moveTo(baseX + sway * 0.1, trunkTopY);
          ctx.quadraticCurveTo(baseX + Math.cos(angle) * length * 0.38, trunkTopY - length * 0.26, endX, endY);
          ctx.stroke();
        }
      }

      for (let speck = 0; speck < 42; speck += 1) {
        const seed = speck * 1.93;
        const x = (Math.sin(seed * 8.1) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 5.8 + localTime * 0.4) * 0.5 + 0.5) * heightCss * 0.8;
        const size = 0.6 + (speck % 3) * 0.4;
        ctx.fillStyle = speck % 4 === 0 ? 'rgba(255,255,255,0.82)' : `${context.accentColor}${alphaHex(0.24)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, glow, palmDensity, tide]);

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

function NeonPalmsTopBar({ context }) {
  const time = useClock(1.08);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-22% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 22%, ${context.accentColor}${alphaHex(0.16)} 50%, rgba(255,255,255,0.12) 78%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.74,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.58) * 14}%)`,
        }}
      />
    </div>
  );
}

function NeonPalmsBorder({ context }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}28`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 16px ${context.accentColor}10`,
        }}
      />
    </div>
  );
}

export default defineShader({
  name: 'Neon Palms',
  description: 'A tropical neon coast with palm silhouettes, reflective water bands, and a humid vapor skyline.',
  group: 'Tropical Neon',
  tags: ['tropical', 'palms', 'neon', 'coastal'],
  controls: [
    { id: 'palmDensity', label: 'Palm Density', description: 'Add more or fewer silhouetted palm forms.', min: 0, max: 1, step: 0.02 },
    { id: 'glow', label: 'Neon Glow', description: 'Push the sky and water bloom brighter.', min: 0, max: 1, step: 0.02 },
    { id: 'tide', label: 'Tide Motion', description: 'Adjust the shimmer and motion of the water bands.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    palmDensity: clamp01(0.34 + context.viewport.width / 5200 + context.panelTransparency * 0.2),
    glow: clamp01(0.42 + context.blurStrength / 40 + (context.isSettingsActive ? 0.08 : 0)),
    tide: clamp01(0.2 + context.zoom * 0.08 + context.blurStrength / 60),
  }),
  background: {
    render: NeonPalmsBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 28% 22%, rgba(255,110,180,0.14), transparent 20%)',
        'radial-gradient(circle at 74% 18%, rgba(120,240,255,0.12), transparent 18%)',
        `radial-gradient(circle at 50% 62%, ${context.accentColor}${alphaHex(0.12)}, transparent 30%)`,
        'linear-gradient(180deg, rgba(255,205,120,0.1) 0%, rgba(54,16,88,0.08) 48%, rgba(6,10,18,0.18) 100%)',
      ].join(', '),
      opacity: 0.98,
      mixBlendMode: 'screen' as const,
    }),
  },
  topBar: {
    render: NeonPalmsTopBar,
    resolveStyle: () => ({
      opacity: 0.72,
      filter: 'blur(7px)',
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: NeonPalmsBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}24`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 16px ${context.accentColor}10`,
    }),
  },
});
