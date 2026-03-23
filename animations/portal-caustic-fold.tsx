import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp, useAnimationContextRef } from 'overlayterm-animation';

function PortalCausticFoldOverlay({ context }: { context: any }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useAnimationContextRef(context);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    let raf = 0;
    const render = (now: number) => {
      const liveContext = contextRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const time = now * 0.001;
      const progress = clamp01(liveContext.progress);
      const active = liveContext.direction === 'enter' ? progress : 1 - progress;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const centerX = width * 0.5;
      const centerY = height * 0.52;

      ctx.globalCompositeOperation = 'screen';
      const ringCount = 7;
      for (let ring = 0; ring < ringCount; ring += 1) {
        const depth = ring / Math.max(ringCount - 1, 1);
        const radius = lerp(36, Math.min(width, height) * 0.56, depth + active * 0.2);
        const pulse = Math.sin(time * (1.4 + depth * 1.3) + ring * 0.8);
        const alpha = 0.08 + (1 - depth) * 0.14 + active * 0.08;

        ctx.strokeStyle = `${liveContext.accentColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = lerp(1.5, 8, 1 - depth);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + pulse * 10, 0, Math.PI * 2);
        ctx.stroke();

        const glints = 8 + ring * 3;
        for (let glint = 0; glint < glints; glint += 1) {
          const angle = (glint / glints) * Math.PI * 2 + time * 0.5 + depth * 1.2;
          const px = centerX + Math.cos(angle) * (radius + pulse * 6);
          const py = centerY + Math.sin(angle) * (radius * 0.58 + pulse * 4);
          ctx.fillStyle = glint % 3 === 0 ? 'rgba(255,255,255,0.58)' : `${liveContext.accentColor}aa`;
          ctx.beginPath();
          ctx.ellipse(px, py, 6 + depth * 10, 2 + depth * 3, angle, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      const foldAlpha = 0.12 + active * 0.2;
      ctx.fillStyle = `${liveContext.accentColor}${Math.round(foldAlpha * 255).toString(16).padStart(2, '0')}`;
      for (let fold = 0; fold < 11; fold += 1) {
        const y = height * (fold / 10);
        const wave = Math.sin(time * 0.8 + fold * 0.6) * 28;
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.quadraticCurveTo(centerX + wave * 0.4, y + 14, width + 20, y + wave);
        ctx.lineTo(width + 20, y + wave + 6);
        ctx.quadraticCurveTo(centerX + wave * 0.4, y + 20, -20, y + 6);
        ctx.closePath();
        ctx.fill();
      }

      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(raf);
  }, []);

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
        mixBlendMode: 'screen',
        opacity: 0.86,
      }}
    />
  );
}

function shellStyle(context: any, direction: 'enter' | 'exit') {
  const progress = clamp01(context.progress);
  const active = direction === 'enter' ? progress : 1 - progress;
  const signed = context.verticalOrigin === 'top' ? -1 : 1;

  return {
    transform: `perspective(1320px) translate3d(0, ${lerp(20, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.86, 1, active) : lerp(1, 0.84, progress)}) rotateX(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, -11, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(16, 0, active) : lerp(0, 16, progress)}px) saturate(${direction === 'enter' ? lerp(0.8, 1.08, active) : lerp(1.08, 0.78, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Portal Caustic Fold',
  description: 'A rotating portal aperture with refracted caustic arcs, layered folds, and a deep inward pull.',
  group: 'Cinematic',
  tags: ['portal', 'caustic', 'fold', 'aperture'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: PortalCausticFoldOverlay,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: PortalCausticFoldOverlay,
  },
});
