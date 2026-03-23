import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp, useAnimationContextRef } from 'overlayterm-animation';

function CathedralFallOverlay({ context }: { context: any }) {
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

    const rafState = { id: 0 };
    const render = (now: number) => {
      const liveContext = contextRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const time = now * 0.001;
      const active = liveContext.direction === 'enter'
        ? clamp01(liveContext.progress)
        : 1 - clamp01(liveContext.progress);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const columnCount = 8;

      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < columnCount; i += 1) {
        const t = i / (columnCount - 1);
        const x = width * (0.1 + t * 0.8);
        const sway = Math.sin(time * 0.8 + i * 0.7) * (8 + active * 10);
        const topY = lerp(-height * 0.08, height * 0.08, active) + Math.sin(time * 0.55 + i) * 10;
        const bottomY = height + 20 + Math.cos(time * 0.42 + i) * 12;

        const grad = ctx.createLinearGradient(x - 18, topY, x + 18, bottomY);
        grad.addColorStop(0, 'rgba(255,255,255,0.14)');
        grad.addColorStop(0.38, `${liveContext.accentColor}18`);
        grad.addColorStop(0.74, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - 18, topY);
        ctx.lineTo(x + 18, topY);
        ctx.lineTo(x + 24 + sway, bottomY);
        ctx.lineTo(x - 24 - sway, bottomY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `${liveContext.accentColor}66`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x + sway * 0.2, bottomY);
        ctx.stroke();

        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.beginPath();
          ctx.ellipse(x, height * 0.24 + Math.sin(time + i) * 8, 18, 44, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let arch = 0; arch < 4; arch += 1) {
        const y = height * (0.22 + arch * 0.16);
        ctx.strokeStyle = `${liveContext.accentColor}${arch === 1 ? '4d' : '22'}`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.08, y);
        ctx.bezierCurveTo(width * 0.2, y - 48, width * 0.8, y - 48, width * 0.92, y);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      rafState.id = window.requestAnimationFrame(render);
    };

    rafState.id = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafState.id);
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
        opacity: 0.88,
      }}
    />
  );
}

function shellStyle(context: any, direction: 'enter' | 'exit') {
  const progress = clamp01(context.progress);
  const active = direction === 'enter' ? progress : 1 - progress;
  const signed = context.verticalOrigin === 'top' ? -1 : 1;

  return {
    transform: `perspective(1400px) translate3d(0, ${lerp(30, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.84, 1, active) : lerp(1, 0.78, progress)}) rotateX(${direction === 'enter' ? lerp(18, 0, active) : lerp(0, -14, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(20, 0, active) : lerp(0, 20, progress)}px) saturate(${direction === 'enter' ? lerp(0.76, 1.06, active) : lerp(1.06, 0.72, progress)}) brightness(${direction === 'enter' ? lerp(0.88, 1, active) : lerp(1, 0.74, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Cathedral Fall',
  description: 'A stained-glass descent with vaulted arches, illuminated columns, and a heavy ceremonial fold.',
  group: 'Cinematic',
  tags: ['cathedral', 'stained-glass', 'vault', 'descent'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: CathedralFallOverlay,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: CathedralFallOverlay,
  },
});
