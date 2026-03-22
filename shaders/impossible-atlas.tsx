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

const atlasPalette = [
  '#7c3aed',
  '#22d3ee',
  '#f59e0b',
  '#84cc16',
  '#fb7185',
  '#f8fafc',
];

function atlasNoise(progress: number, time: number, fold: number, seed: number): number {
  return (
    Math.sin(progress * (6.4 + fold * 2.8) + time * (0.82 + fold * 0.3) + seed) * 0.56 +
    Math.cos(progress * (15.2 + fold * 5.1) - time * 0.46 + seed * 1.8) * 0.22 +
    Math.sin(progress * 31.1 + time * 1.2 + seed * 2.1) * 0.08
  ) * (0.56 + fold * 0.62);
}

function ImpossibleAtlasBackground({ context }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fold = Number(context.sharedUniforms.fold ?? 0.68);
  const glyphDensity = Number(context.sharedUniforms.glyphDensity ?? 0.56);
  const paradoxHue = Number(context.sharedUniforms.paradoxHue ?? 0.74);

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

      const backdrop = ctx.createLinearGradient(0, 0, 0, heightCss);
      backdrop.addColorStop(0, 'rgba(6,6,18,1)');
      backdrop.addColorStop(0.42, 'rgba(18,12,34,1)');
      backdrop.addColorStop(0.74, 'rgba(36,24,59,1)');
      backdrop.addColorStop(1, 'rgba(4,5,14,1)');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const field = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(widthCss, heightCss) * 0.72);
      field.addColorStop(0, `${context.accentColor}${alphaHex(0.12 + paradoxHue * 0.08)}`);
      field.addColorStop(0.28, 'rgba(34,211,238,0.1)');
      field.addColorStop(0.54, 'rgba(245,158,11,0.08)');
      field.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, widthCss, heightCss);

      const ringCount = 5;
      for (let ring = 0; ring < ringCount; ring += 1) {
        const progress = ring / Math.max(ringCount - 1, 1);
        const radius = lerp(widthCss * 0.18, widthCss * 0.44, progress);
        ctx.strokeStyle = ring % 2 === 0 ? `${context.accentColor}${alphaHex(0.18 + progress * 0.08)}` : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.2 - progress * 0.4;
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          radius,
          radius * (0.4 + Math.sin(localTime * 0.26 + ring) * 0.06),
          localTime * 0.22 + ring * 0.3,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }

      const plateCount = 6;
      for (let plate = 0; plate < plateCount; plate += 1) {
        const progress = plate / plateCount;
        const warp = atlasNoise(progress, localTime, fold, plate * 0.73);
        const baseAngle = localTime * (0.22 + fold * 0.08) + progress * Math.PI * 2;
        const orbit = lerp(widthCss * 0.12, widthCss * 0.28, fold) * (0.9 + warp * 0.1);
        const plateX = centerX + Math.cos(baseAngle) * orbit;
        const plateY = centerY + Math.sin(baseAngle * 1.12) * orbit * 0.5;
        const plateScale = lerp(0.72, 1.1, 0.5 + Math.sin(baseAngle * 1.4) * 0.5 + warp * 0.1);
        const skewX = Math.sin(baseAngle * 0.8) * 0.12 + warp * 0.04;
        const skewY = Math.cos(baseAngle * 0.7) * 0.16 - warp * 0.03;
        const plateRadiusX = lerp(widthCss * 0.1, widthCss * 0.18, plateScale);
        const plateRadiusY = lerp(heightCss * 0.08, heightCss * 0.14, plateScale);
        const palette = atlasPalette[(plate + 1) % atlasPalette.length];

        ctx.save();
        ctx.translate(plateX, plateY);
        ctx.rotate(baseAngle * 0.26 + Math.sin(localTime * 0.4 + plate) * 0.1);
        ctx.transform(1, skewY, skewX, 1, 0, 0);

        ctx.beginPath();
        ctx.ellipse(0, 0, plateRadiusX, plateRadiusY, 0, 0, Math.PI * 2);
        ctx.clip();

        const plateFill = ctx.createLinearGradient(-plateRadiusX, -plateRadiusY, plateRadiusX, plateRadiusY);
        plateFill.addColorStop(0, `${palette}${alphaHex(0.16 + fold * 0.08)}`);
        plateFill.addColorStop(0.42, `${context.accentColor}${alphaHex(0.12 + paradoxHue * 0.08)}`);
        plateFill.addColorStop(0.74, 'rgba(255,255,255,0.08)');
        plateFill.addColorStop(1, 'rgba(8,8,18,0.9)');
        ctx.fillStyle = plateFill;
        ctx.fillRect(-plateRadiusX, -plateRadiusY, plateRadiusX * 2, plateRadiusY * 2);

        const contourCount = 6;
        for (let contour = 0; contour < contourCount; contour += 1) {
          const progressContour = contour / Math.max(contourCount - 1, 1);
          const rx = plateRadiusX * (0.35 + progressContour * 0.68);
          const ry = plateRadiusY * (0.28 + progressContour * 0.74);
          ctx.strokeStyle = contour % 2 === 0 ? `${palette}${alphaHex(0.24)}` : `${context.accentColor}${alphaHex(0.14)}`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, ry, progressContour * 0.24, 0, Math.PI * 2);
          ctx.stroke();
        }

        const lineCount = 7;
        for (let line = 0; line < lineCount; line += 1) {
          const progressLine = line / Math.max(lineCount - 1, 1);
          const y = lerp(-plateRadiusY, plateRadiusY, progressLine);
          ctx.strokeStyle = line % 2 === 0 ? 'rgba(255,255,255,0.08)' : `${context.accentColor}${alphaHex(0.16)}`;
          ctx.beginPath();
          ctx.moveTo(-plateRadiusX, y);
          ctx.bezierCurveTo(
            -plateRadiusX * 0.3,
            y + Math.sin(localTime + line) * 5,
            plateRadiusX * 0.3,
            y - Math.cos(localTime * 0.8 + line) * 5,
            plateRadiusX,
            y + Math.sin(localTime * 1.2 + line * 0.6) * 3,
          );
          ctx.stroke();
        }

        const routeCount = 5;
        for (let route = 0; route < routeCount; route += 1) {
          const progressRoute = route / Math.max(routeCount - 1, 1);
          const startX = -plateRadiusX + progressRoute * plateRadiusX * 1.4;
          const startY = -plateRadiusY * 0.48 + Math.sin(localTime * 0.9 + route) * 7;
          const endX = plateRadiusX * 0.82 - progressRoute * plateRadiusX * 0.3;
          const endY = plateRadiusY * 0.48 + Math.cos(localTime * 1.05 + route) * 7;
          ctx.strokeStyle = route % 2 === 0 ? `${palette}${alphaHex(0.26)}` : `rgba(255,255,255,0.18)`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.bezierCurveTo(
            0,
            -plateRadiusY * 0.9,
            0,
            plateRadiusY * 0.9,
            endX,
            endY,
          );
          ctx.stroke();
        }

        const glyphCount = Math.round(lerp(6, 18, glyphDensity));
        for (let glyph = 0; glyph < glyphCount; glyph += 1) {
          const seed = glyph * 1.17 + plate * 0.9;
          const gx = Math.sin(seed * 2.7 + localTime * 0.8) * plateRadiusX * 0.72;
          const gy = Math.cos(seed * 3.2 - localTime * 0.54) * plateRadiusY * 0.68;
          const glow = glyph % 4 === 0 ? `${context.accentColor}${alphaHex(0.32)}` : `${palette}${alphaHex(0.36)}`;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(gx, gy, 1.1 + (glyph % 3) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      const loopRadiusX = widthCss * (0.15 + fold * 0.12);
      const loopRadiusY = heightCss * (0.1 + fold * 0.1);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `${context.accentColor}${alphaHex(0.34 + paradoxHue * 0.08)}`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX - loopRadiusX, centerY);
      ctx.bezierCurveTo(
        centerX - loopRadiusX * 0.6,
        centerY - loopRadiusY * 1.5,
        centerX + loopRadiusX * 0.6,
        centerY - loopRadiusY * 1.5,
        centerX + loopRadiusX,
        centerY,
      );
      ctx.bezierCurveTo(
        centerX + loopRadiusX * 0.6,
        centerY + loopRadiusY * 1.5,
        centerX - loopRadiusX * 0.6,
        centerY + loopRadiusY * 1.5,
        centerX - loopRadiusX,
        centerY,
      );
      ctx.stroke();

      const labelCount = 8;
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let label = 0; label < labelCount; label += 1) {
        const progress = label / labelCount;
        const angle = localTime * 0.28 + progress * Math.PI * 2;
        const x = centerX + Math.cos(angle) * loopRadiusX * 1.42;
        const y = centerY + Math.sin(angle * 1.15) * loopRadiusY * 1.3;
        const text = `${String.fromCharCode(65 + (label % 6))}${(label % 4) + 1}`;
        ctx.fillStyle = label % 3 === 0 ? 'rgba(255,255,255,0.7)' : `${atlasPalette[label % atlasPalette.length]}aa`;
        ctx.fillText(text, x, y);
      }

      const signalCount = Math.round(lerp(18, 48, glyphDensity));
      for (let signal = 0; signal < signalCount; signal += 1) {
        const seed = signal * 0.91;
        const x = (Math.sin(seed * 9.3 + localTime * 0.66) * 0.5 + 0.5) * widthCss;
        const y = (Math.cos(seed * 6.7 - localTime * 0.42) * 0.5 + 0.5) * heightCss;
        const size = 0.7 + (signal % 4) * 0.5;
        ctx.fillStyle = signal % 5 === 0 ? 'rgba(255,255,255,0.84)' : `${context.accentColor}${alphaHex(0.22)}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [context.accentColor, glyphDensity, fold, paradoxHue]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: '-14%',
        width: '128%',
        height: '128%',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: context.isSettingsActive ? 1 : 0.94,
      }}
    />
  );
}

function ImpossibleAtlasTopBar({ context }) {
  const time = useClock(1.02);
  const paradoxHue = Number(context.sharedUniforms.paradoxHue ?? 0.74);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: '-18% -8%',
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 22%, ${context.accentColor}${alphaHex(0.14)} 50%, rgba(255,255,255,0.12) 78%, transparent 100%)`,
          filter: 'blur(8px)',
          opacity: 0.78,
          mixBlendMode: 'screen',
          transform: `translateX(${Math.sin(time * 0.52) * 12}%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'repeating-linear-gradient(90deg, transparent 0 10px, rgba(255,255,255,0.06) 10px 12px, transparent 12px 24px)',
            `radial-gradient(circle at ${50 + Math.sin(time * 1.1) * 10}% 28%, ${context.accentColor}${alphaHex(0.1 + paradoxHue * 0.06)}, transparent 22%)`,
          ].join(', '),
          opacity: 0.3,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
}

function ImpossibleAtlasBorder({ context }) {
  const time = useClock(1.28);
  const fold = Number(context.sharedUniforms.fold ?? 0.68);
  const pulse = 0.24 + Math.sin(time * 1.6) * 0.06;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          border: `1px solid ${context.accentColor}${alphaHex(pulse)}`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 20px ${context.accentColor}${alphaHex(0.08 + fold * 0.08)}`,
        }}
      />
      {[
        { inset: '0 auto auto 0', transform: `translate(-18%, -18%) rotate(${time * 14}deg)` },
        { inset: '0 0 auto auto', transform: `translate(18%, -18%) rotate(${-time * 20}deg)` },
        { inset: 'auto auto 0 0', transform: `translate(-18%, 18%) rotate(${-time * 16}deg)` },
        { inset: 'auto 0 0 auto', transform: `translate(18%, 18%) rotate(${time * 18}deg)` },
      ].map((corner, index) => (
        <div
          key={`impossible-atlas-corner-${index}`}
          style={{
            position: 'absolute',
            inset: corner.inset,
            width: 56,
            height: 56,
            background: `radial-gradient(circle, rgba(255,255,255,0.18) 0%, ${context.accentColor}${alphaHex(0.14)} 42%, transparent 72%)`,
            filter: 'blur(8px)',
            opacity: 0.64,
            transform: corner.transform,
          }}
        />
      ))}
    </div>
  );
}

export default defineShader({
  name: 'Impossible Atlas',
  description: 'A deliberately unstable cartographic engine with warped plates, orbiting route fragments, and impossible coordinates.',
  group: 'Experimental Cartography',
  tags: ['experimental', 'atlas', 'warp', 'kaleidoscope'],
  controls: [
    {
      id: 'fold',
      label: 'Fold',
      description: 'Increase orbiting plate drift and spatial distortion.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.68,
    },
    {
      id: 'glyphDensity',
      label: 'Glyph Density',
      description: 'Control how many map markers and signal fragments appear.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.56,
    },
    {
      id: 'paradoxHue',
      label: 'Paradox Hue',
      description: 'Shift the atlas palette toward stranger chromatic combinations.',
      min: 0,
      max: 1,
      step: 0.02,
      defaultValue: 0.74,
    },
  ],
  resolveSharedUniforms: context => ({
    fold: clamp01(0.34 + context.blurStrength / 42 + context.zoom * 0.08),
    glyphDensity: clamp01(0.24 + context.panelTransparency * 0.26 + context.viewport.width / 7000),
    paradoxHue: clamp01(0.42 + (context.isSettingsActive ? 0.1 : 0) + context.blurStrength / 90),
  }),
  background: {
    render: ImpossibleAtlasBackground,
    resolveStyle: context => ({
      background: [
        'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.12), transparent 16%)',
        `radial-gradient(circle at 24% 18%, ${context.accentColor}${alphaHex(0.1)}, transparent 18%)`,
        'linear-gradient(180deg, rgba(7,6,18,1) 0%, rgba(25,15,46,1) 45%, rgba(10,12,28,1) 100%)',
      ].join(', '),
      opacity: 0.97,
      mixBlendMode: 'screen' as const,
      filter: `hue-rotate(${Math.round(Number(context.sharedUniforms.paradoxHue ?? 0.74) * 54)}deg) saturate(${1.14 + Number(context.sharedUniforms.paradoxHue ?? 0.74) * 0.12})`,
    }),
  },
  topBar: {
    render: ImpossibleAtlasTopBar,
    resolveStyle: context => ({
      opacity: 0.72,
      filter: 'blur(8px)',
      transform: 'scale(1.05)',
      mixBlendMode: 'screen' as const,
      background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 36%, ${context.accentColor}${alphaHex(0.11)} 50%, rgba(255,255,255,0.12) 64%, transparent 100%)`,
    }),
  },
  border: {
    render: ImpossibleAtlasBorder,
    resolveStyle: context => ({
      border: `1px solid ${context.accentColor}${alphaHex(0.2)}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 18px ${context.accentColor}${alphaHex(0.1)}`,
    }),
  },
});
