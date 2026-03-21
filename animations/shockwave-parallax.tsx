import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function ShockwaveParallaxOverlay({ context }: { context: any }) {
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

    let raf = 0;
    const render = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const time = now * 0.001;
      const progress = clamp01(context.progress);
      const active = context.direction === 'enter' ? progress : 1 - progress;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width * 0.5;
      const cy = height * 0.52;

      ctx.globalCompositeOperation = 'screen';
      const shockCount = 6;
      for (let shock = 0; shock < shockCount; shock += 1) {
        const depth = shock / Math.max(shockCount - 1, 1);
        const radius = lerp(24, Math.max(width, height) * 0.62, depth + active * 0.28);
        const xOffset = Math.sin(time * 0.7 + depth * 3.4) * lerp(6, 28, depth);
        const yOffset = Math.cos(time * 0.8 + depth * 2.9) * lerp(4, 18, depth);
        const alpha = 0.08 + (1 - depth) * 0.16 + active * 0.08;

        ctx.strokeStyle = `${context.accentColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = lerp(6, 1.2, depth);
        ctx.beginPath();
        ctx.ellipse(cx + xOffset * 0.12, cy + yOffset * 0.12, radius * 0.96, radius * (0.48 + depth * 0.22), time * 0.1 + depth, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx + xOffset * 0.2, cy + yOffset * 0.2, radius * 1.02, radius * 0.52, -time * 0.08 - depth, 0, Math.PI * 2);
        ctx.stroke();

        for (let spoke = 0; spoke < 10; spoke += 1) {
          const angle = (spoke / 10) * Math.PI * 2 + time * 0.45 + depth * 0.7;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius * 0.5;
          ctx.fillStyle = spoke % 2 === 0 ? 'rgba(255,255,255,0.58)' : `${context.accentColor}aa`;
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + depth * 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      for (let layer = 0; layer < 4; layer += 1) {
        const offset = (layer - 1.5) * 16 * (1 - active);
        ctx.fillStyle = `${context.accentColor}${Math.round((0.04 + layer * 0.03) * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.ellipse(cx + offset, cy - offset * 0.28, width * 0.48, height * (0.04 + layer * 0.03), 0, 0, Math.PI * 2);
        ctx.fill();
      }

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
        mixBlendMode: 'screen',
        opacity: 0.9,
      }}
    />
  );
}

function shellStyle(context: any, direction: 'enter' | 'exit') {
  const progress = clamp01(context.progress);
  const active = direction === 'enter' ? progress : 1 - progress;
  const signed = context.verticalOrigin === 'top' ? -1 : 1;

  return {
    transform: `perspective(1500px) translate3d(0, ${lerp(28, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.8, 1, active) : lerp(1, 0.76, progress)}) rotateY(${direction === 'enter' ? lerp(-12, 0, active) : lerp(0, 12, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(22, 0, active) : lerp(0, 22, progress)}px) saturate(${direction === 'enter' ? lerp(0.75, 1.1, active) : lerp(1.1, 0.7, progress)}) brightness(${direction === 'enter' ? lerp(0.84, 1, active) : lerp(1, 0.68, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Shockwave Parallax',
  description: 'A layered outward shockwave with depth-separated rings, drifting highlights, and a strong parallax push.',
  group: 'Impact',
  tags: ['shockwave', 'parallax', 'impact', 'rings'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: ShockwaveParallaxOverlay,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: ShockwaveParallaxOverlay,
  },
});
