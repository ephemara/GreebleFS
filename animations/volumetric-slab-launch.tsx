import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function VolumetricSlabLaunchLayer({ context }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const slabs = Array.from({ length: 8 }, (_, index) => ({
      seed: index * 0.71,
      depth: index / 7,
      width: 120 + index * 18,
      height: 42 + index * 8,
      lift: 24 + index * 14,
      tilt: -10 + index * 3.4,
    }));

    let raf = 0;
    const render = (now: number) => {
      const progress = clamp01(context.progress);
      const active = context.direction === 'enter' ? progress : 1 - progress;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w * 0.5;
      const baseY = h * 0.82;

      ctx.globalCompositeOperation = 'screen';

      const backGlow = ctx.createLinearGradient(0, h, 0, 0);
      backGlow.addColorStop(0, 'rgba(0,0,0,0)');
      backGlow.addColorStop(0.35, `${context.accentColor}18`);
      backGlow.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = backGlow;
      ctx.fillRect(0, 0, w, h);

      const launchCore = ctx.createRadialGradient(cx, baseY, 8, cx, baseY, w * 0.42);
      launchCore.addColorStop(0, `rgba(255,255,255,${0.24 + active * 0.28})`);
      launchCore.addColorStop(0.16, `${context.accentColor}cc`);
      launchCore.addColorStop(0.36, `${context.accentColor}33`);
      launchCore.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = launchCore;
      ctx.beginPath();
      ctx.ellipse(cx, baseY, w * 0.32 + active * 40, h * 0.18 + active * 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [index, slab] of slabs.entries()) {
        const band = index / Math.max(slabs.length - 1, 1);
        const lift = lerp(0, slab.lift + 120, active);
        const rise = baseY - lift - Math.sin(now * 0.0014 + slab.seed) * (10 + band * 18);
        const widthScale = lerp(0.6, 1.18, active);
        const heightScale = lerp(0.7, 1.28, active);
        const perspective = 1 - band * 0.18;
        const halfWidth = slab.width * 0.5 * widthScale * perspective;
        const halfHeight = slab.height * 0.5 * heightScale;
        const skew = slab.tilt + Math.sin(now * 0.001 + slab.seed) * (4 + band * 3);
        const xShift = Math.sin(now * 0.0012 + slab.seed * 1.7) * (12 + band * 24);
        const alpha = 0.12 + active * 0.62 * (1 - band * 0.18);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = context.accentColor;
        ctx.shadowBlur = 16 + band * 10 + active * 18;

        const topLeft = [cx - halfWidth - xShift - skew, rise - halfHeight - band * 6];
        const topRight = [cx + halfWidth + xShift + skew, rise - halfHeight + band * 4];
        const bottomRight = [cx + halfWidth * 0.82 + xShift + skew * 0.6, rise + halfHeight + band * 8];
        const bottomLeft = [cx - halfWidth * 0.82 - xShift - skew * 0.6, rise + halfHeight + band * 2];

        const fill = ctx.createLinearGradient(0, rise - halfHeight, 0, rise + halfHeight);
        fill.addColorStop(0, `rgba(255,255,255,${0.34 + active * 0.16})`);
        fill.addColorStop(0.4, `${context.accentColor}${Math.round((0.26 + band * 0.12) * 255).toString(16).padStart(2, '0')}`);
        fill.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = fill;

        ctx.beginPath();
        ctx.moveTo(topLeft[0], topLeft[1]);
        ctx.lineTo(topRight[0], topRight[1]);
        ctx.lineTo(bottomRight[0], bottomRight[1]);
        ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = index % 2 === 0 ? '#ffffff' : context.accentColor;
        ctx.lineWidth = 1 + band * 0.2;
        ctx.globalAlpha = alpha * 0.92;
        ctx.stroke();

        ctx.restore();
      }

      ctx.globalCompositeOperation = 'lighter';
      const sparkCount = 72;
      for (let index = 0; index < sparkCount; index += 1) {
        const seed = index * 1.317;
        const drift = Math.sin(now * 0.002 + seed) * 22;
        const x = cx + Math.sin(seed * 7.4) * (24 + (index % 7) * 12) + drift * 0.25;
        const y = baseY - (index % 12) * 18 - active * 120 - (seed % 1) * 40;
        const size = 0.8 + (index % 5) * 0.34 + active * 1.0;

        ctx.save();
        ctx.globalAlpha = 0.08 + active * 0.38;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 8 + active * 10;
        ctx.fillStyle = index % 4 === 0 ? '#ffffff' : context.accentColor;
        ctx.beginPath();
        ctx.arc(x, y + Math.sin(seed + now * 0.0018) * 6, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(raf);
  }, [context.accentColor, context.direction, context.progress]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.93,
        mixBlendMode: 'screen',
      }}
    />
  );
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const enter = direction === 'enter';

  return {
    transform: `perspective(1600px) translate3d(0, ${lerp(40, 0, progress) * signed}px, 0) scale(${enter ? lerp(0.72, 1, progress) : lerp(1, 0.86, progress)}) rotateX(${enter ? lerp(26, 0, progress) : lerp(0, -18, progress)}deg) rotateZ(${enter ? lerp(-7, 0, progress) : lerp(0, 8, progress)}deg)`,
    opacity: context.baseOpacity * (enter ? progress : 1 - progress),
    filter: `blur(${enter ? lerp(18, 0, progress) : lerp(0, 20, progress)}px) saturate(${enter ? lerp(0.74, 1.12, progress) : lerp(1.12, 0.76, progress)}) brightness(${enter ? lerp(0.84, 1, progress) : lerp(1, 0.76, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Volumetric Slab Launch',
  description: 'Translucent launch slabs rise in stacked perspective with bloom cores, edge highlights, and ascent sparks.',
  group: 'Cinematic',
  tags: ['volumetric', 'slab', 'launch', 'canvas'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: VolumetricSlabLaunchLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: VolumetricSlabLaunchLayer,
  },
});
