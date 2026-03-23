import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp, useAnimationContextRef } from 'overlayterm-animation';

function ParticleSingularity3D({ context }) {
  const canvasRef = useRef(null);
  const contextRef = useAnimationContextRef(context);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles = Array.from({ length: 320 }, (_, index) => ({
      seed: index * 0.37,
      radius: 40 + (index % 24) * 10,
      angle: index * 0.28,
      elevation: -180 + (index % 36) * 10,
      speed: 0.4 + (index % 9) * 0.07,
      size: 1 + (index % 4),
    }));

    let raf = 0;
    const render = now => {
      const liveContext = contextRef.current;
      const progress = clamp01(liveContext.progress);
      const active = liveContext.direction === 'enter' ? 1 - progress : progress;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      const centerX = canvas.clientWidth * 0.5;
      const centerY = canvas.clientHeight * 0.54;
      const focalLength = 340;
      ctx.globalCompositeOperation = 'screen';

      for (const particle of particles) {
        const theta = particle.angle + now * 0.00045 * particle.speed + active * 6.0;
        const collapse = lerp(1.0, 0.15, active);
        const radius = particle.radius * collapse;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta * 1.13) * radius + Math.sin(theta * 0.4 + particle.seed) * 40;
        const y = particle.elevation * collapse + Math.sin(theta * 1.9 + particle.seed) * 18;
        const depth = focalLength / Math.max(80, focalLength + z + active * 240);
        const px = centerX + x * depth;
        const py = centerY + y * depth;
        const glow = particle.size * depth * (1.2 + active * 0.6);

        ctx.fillStyle = `rgba(120, ${Math.round(190 + depth * 40)}, 255, ${Math.min(0.92, 0.18 + depth * 0.65)})`;
        ctx.beginPath();
        ctx.arc(px, py, glow, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.92 }} />;
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `perspective(1200px) translate3d(0, ${lerp(28, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.62, 1, active) : lerp(1, 0.56, progress)}) rotateY(${direction === 'enter' ? lerp(-20, 0, active) : lerp(0, 24, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(22, 0, active) : lerp(0, 24, progress)}px) saturate(${direction === 'enter' ? lerp(0.4, 1, active) : lerp(1, 0.34, progress)}) brightness(${direction === 'enter' ? lerp(0.72, 1, active) : lerp(1, 0.66, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Particle Singularity 3D',
  description: 'A dense three-dimensional particle field collapses into a singularity and re-expands through the shell.',
  group: 'Stress Test',
  tags: ['particles', '3d', 'singularity'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: ParticleSingularity3D,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: ParticleSingularity3D,
  },
});
