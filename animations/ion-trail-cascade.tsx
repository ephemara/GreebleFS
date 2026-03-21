import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function IonTrailCascadeOverlay({ context }: { context: any }) {
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

    const particles = Array.from({ length: 180 }, (_, index) => ({
      seed: index * 1.713,
      lane: index % 12,
      radius: 12 + (index % 8) * 10,
      speed: 0.9 + (index % 9) * 0.07,
      phase: (index % 6) * 0.4,
    }));

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
      const centerX = width * 0.5;
      const cascade = lerp(-0.22, 0.26, active);

      ctx.globalCompositeOperation = 'screen';
      for (const particle of particles) {
        const laneOffset = (particle.lane - 6) * 18;
        const cycle = ((time * (38 + particle.speed * 10) + particle.seed) % (height + 260)) - 140;
        const wobble = Math.sin(time * 2.4 + particle.phase + laneOffset * 0.03) * (10 + active * 12);
        const x = centerX + laneOffset + Math.sin(time * 0.8 + particle.seed) * (24 + active * 20);
        const y = cycle + wobble * 0.3;
        const trail = Math.max(1, particle.radius * (0.3 + active * 0.7));

        const grad = ctx.createLinearGradient(x, y - 32, x, y + 42);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.28, `${context.accentColor}00`);
        grad.addColorStop(0.5, `${context.accentColor}${Math.round((0.18 + active * 0.28) * 255).toString(16).padStart(2, '0')}`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - 1.5, y - 42, 3, 84);

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.lineTo(x + Math.sin(time * 1.5 + particle.seed) * 18, y + 28);
        ctx.stroke();

        ctx.fillStyle = particle.lane % 3 === 0 ? 'rgba(255,255,255,0.78)' : `${context.accentColor}cc`;
        ctx.beginPath();
        ctx.arc(x, y, trail * (0.7 + Math.cos(time + particle.seed) * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      const ribbonAlpha = 0.2 + active * 0.18;
      ctx.strokeStyle = `${context.accentColor}${Math.round(ribbonAlpha * 255).toString(16).padStart(2, '0')}`;
      for (let ribbon = 0; ribbon < 5; ribbon += 1) {
        const y = height * (0.12 + ribbon * 0.18) + Math.sin(time * 0.6 + ribbon) * 14;
        ctx.beginPath();
        ctx.moveTo(-30, y);
        ctx.bezierCurveTo(width * 0.22, y + 14 * cascade, width * 0.7, y - 18 * cascade, width + 30, y + 18);
        ctx.stroke();
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
    transform: `perspective(1250px) translate3d(0, ${lerp(18, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.9, 1, active) : lerp(1, 0.9, progress)}) rotateZ(${direction === 'enter' ? lerp(-8, 0, active) : lerp(0, 8, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 14, progress)}px) saturate(${direction === 'enter' ? lerp(0.82, 1.08, active) : lerp(1.08, 0.8, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Ion Trail Cascade',
  description: 'Vertical ion streams cascade through the shell like charged rain, leaving trail ribbons and ember nodes behind.',
  group: 'Showcase',
  tags: ['ion', 'trail', 'cascade', 'particles'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: IonTrailCascadeOverlay,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: IonTrailCascadeOverlay,
  },
});
