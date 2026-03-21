import React, { useEffect, useRef } from 'react';
import { clamp01, defineShader, lerp } from 'overlayterm-shader';

function GridSurface({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    const densityBoost = Number(context.sharedUniforms.densityBoost ?? 0.58);
    const scanWeight = Number(context.sharedUniforms.scanWeight ?? 0.5);

    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      canvas.width = width;
      canvas.height = height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const time = now * 0.001;
      const widthCss = canvas.clientWidth;
      const heightCss = canvas.clientHeight;
      if (widthCss <= 0 || heightCss <= 0) {
        frame = window.requestAnimationFrame(render);
        return;
      }

      const horizon = heightCss * (context.surface === 'background' ? 0.22 : 0.36);
      const verticalVanishingX = widthCss * (0.5 + Math.sin(time * 0.28) * 0.08);
      const rows = Math.round(lerp(
        context.surface === 'background' ? 18 : 9,
        context.surface === 'background' ? 30 : 14,
        densityBoost,
      ));
      const columns = Math.round(lerp(
        context.surface === 'background' ? 12 : 8,
        context.surface === 'background' ? 22 : 12,
        densityBoost,
      ));
      const sweepY = ((time * lerp(52, 120, scanWeight)) % (heightCss + 180)) - 90;
      const sweepGradient = ctx.createLinearGradient(0, sweepY - 80, 0, sweepY + 80);
      sweepGradient.addColorStop(0, 'rgba(255,255,255,0)');
      sweepGradient.addColorStop(0.5, `${context.accentColor}22`);
      sweepGradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sweepGradient;
      ctx.fillRect(0, 0, widthCss, heightCss);

      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = context.surface === 'border' ? 1.4 : 1;
      ctx.strokeStyle = `${context.accentColor}${context.surface === 'border' ? '52' : '38'}`;

      for (let row = 0; row <= rows; row += 1) {
        const progress = row / Math.max(rows, 1);
        const y = horizon + Math.pow(progress, 1.82) * (heightCss - horizon + 56);
        const amplitude = (1 - progress) * (12 + scanWeight * 12);
        ctx.beginPath();
        for (let segment = 0; segment <= 24; segment += 1) {
          const x = (segment / 24) * widthCss;
          const normalized = segment / 24 - 0.5;
          const drift = Math.sin(time * 1.24 + progress * 8 + x * 0.012) * amplitude;
          const curvature = normalized * normalized * progress * 40;
          const pointY = y + drift + curvature;
          if (segment === 0) {
            ctx.moveTo(x, pointY);
          } else {
            ctx.lineTo(x, pointY);
          }
        }
        ctx.stroke();
      }

      for (let column = 0; column <= columns; column += 1) {
        const progress = column / Math.max(columns, 1);
        const baseX = progress * widthCss;
        const wobble = Math.sin(time * 0.9 + progress * 9) * 16;
        ctx.beginPath();
        ctx.moveTo(verticalVanishingX + (baseX - verticalVanishingX) * 0.12, horizon - 8);
        ctx.quadraticCurveTo(
          baseX + wobble * 0.3,
          heightCss * 0.56,
          baseX + wobble,
          heightCss + 28,
        );
        ctx.stroke();
      }

      const nodeAlpha = context.surface === 'background' ? 0.26 : 0.34;
      ctx.fillStyle = `${context.accentColor}${Math.round(nodeAlpha * 255).toString(16).padStart(2, '0')}`;
      for (let row = 2; row < rows; row += 2) {
        const rowProgress = row / rows;
        const rowY = horizon + Math.pow(rowProgress, 1.82) * (heightCss - horizon + 56);
        for (let column = 0; column <= columns; column += 2) {
          const columnProgress = column / Math.max(columns, 1);
          const baseX = columnProgress * widthCss;
          const x = verticalVanishingX + (baseX - verticalVanishingX) * Math.pow(rowProgress, 1.08);
          const pulse = 1 + Math.sin(time * 2.2 + row * 0.6 + column * 0.4) * 0.4;
          ctx.beginPath();
          ctx.arc(x, rowY, pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (context.surface === 'topBar') {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let stripe = 0; stripe < 6; stripe += 1) {
          const x = ((time * 80) + stripe * 54) % (widthCss + 120) - 60;
          ctx.fillRect(x, 0, 18, heightCss);
        }
      }

      if (context.surface === 'border') {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        const corner = 18;
        [
          [0, 0, corner, 0, 0, corner],
          [widthCss, 0, widthCss - corner, 0, widthCss, corner],
          [0, heightCss, corner, heightCss, 0, heightCss - corner],
          [widthCss, heightCss, widthCss - corner, heightCss, widthCss, heightCss - corner],
        ].forEach(points => {
          ctx.beginPath();
          ctx.moveTo(points[0], points[1]);
          ctx.lineTo(points[2], points[3]);
          ctx.lineTo(points[4], points[5]);
          ctx.stroke();
        });
      }

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, context.blurStrength, context.isSettingsActive, context.sharedUniforms, context.surface, context.zoom]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: context.isSettingsActive ? 0.98 : 0.9,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function alphaHex(value: number): string {
  return Math.round(clamp01(value) * 255).toString(16).padStart(2, '0');
}

export default defineShader({
  name: 'Grid Scan',
  description: 'A deep perspective telemetry lattice with sweep bands, signal nodes, and chrome instrumentation across the shell.',
  group: 'Authoring Extremes',
  tags: ['grid', 'scanline', 'telemetry', 'canvas'],
  controls: [
    { id: 'densityBoost', label: 'Grid Density', description: 'Increase the number of rows, columns, and node points.', min: 0, max: 1, step: 0.02 },
    { id: 'scanWeight', label: 'Sweep Energy', description: 'Strengthen the sweep band and signal motion.', min: 0, max: 1, step: 0.02 },
  ],
  resolveSharedUniforms: context => ({
    densityBoost: clamp01(0.26 + context.viewport.width / 2400 + context.zoom * 0.14),
    scanWeight: clamp01(0.22 + context.blurStrength / 40 + (context.isSettingsActive ? 0.1 : 0)),
  }),
  background: {
    render: GridSurface,
    resolveStyle: context => ({
      background: [
        `radial-gradient(circle at 50% 8%, rgba(255,255,255,0.08), transparent 28%)`,
        `radial-gradient(circle at 50% 50%, ${context.accentColor}${alphaHex(0.08)}, transparent 64%)`,
      ].join(', '),
      opacity: 0.88,
    }),
  },
  topBar: {
    render: GridSurface,
    resolveStyle: context => ({
      background: `linear-gradient(90deg, transparent 0%, ${context.accentColor}${alphaHex(0.08)} 50%, transparent 100%)`,
      opacity: 0.62,
      mixBlendMode: 'screen' as const,
    }),
  },
  border: {
    render: GridSurface,
    resolveStyle: context => ({
      opacity: 0.8,
      border: `1px solid ${context.accentColor}${alphaHex(0.18)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 18px ${context.accentColor}${alphaHex(0.12)}`,
    }),
  },
});
