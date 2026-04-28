import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp, useAnimationContextRef } from 'overlayterm-animation';

const CUBE_VERTICES = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];

const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function rotate(point, ax, ay) {
  let [x, y, z] = point;
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  let nx = x * cy - z * sy;
  let nz = x * sy + z * cy;
  let ny = y * cx - nz * sx;
  nz = y * sx + nz * cx;
  return [nx, ny, nz];
}

function HologramCubeLattice({ context }) {
  const canvasRef = useRef(null);
  const contextRef = useAnimationContextRef(context);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cubes = Array.from({ length: 18 }, (_, index) => ({
      x: -2 + (index % 6) * 0.8,
      y: -1 + Math.floor(index / 6) * 0.8,
      z: -1.5 + (index % 4) * 0.7,
      size: 0.26 + (index % 3) * 0.08,
      offset: index * 0.4,
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
      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = 1.15;

      const centerX = canvas.clientWidth * 0.5;
      const centerY = canvas.clientHeight * 0.5;
      const focal = 360;
      const spin = now * 0.00042;

      for (const cube of cubes) {
        const projected = CUBE_VERTICES.map(vertex => {
          const scaled = vertex.map(value => value * cube.size);
          const rotated = rotate(scaled, spin + cube.offset, spin * 1.2 + cube.offset * 0.5);
          const worldX = rotated[0] + cube.x;
          const worldY = rotated[1] + cube.y + Math.sin(spin * 2.0 + cube.offset) * 0.06;
          const worldZ = rotated[2] + cube.z + active * 1.5;
          const depth = focal / Math.max(100, focal + worldZ * 120);
          return [centerX + worldX * 120 * depth, centerY + worldY * 120 * depth, depth];
        });

        ctx.strokeStyle = `rgba(110, 230, 255, ${0.18 + active * 0.52})`;
        for (const [fromIndex, toIndex] of CUBE_EDGES) {
          const from = projected[fromIndex];
          const to = projected[toIndex];
          ctx.beginPath();
          ctx.moveTo(from[0], from[1]);
          ctx.lineTo(to[0], to[1]);
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = window.requestAnimationFrame(render);
    };

    raf = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.88 }} />;
}

function shellStyle(context, direction) {
  const progress = clamp01(context.progress);
  const signed = context.verticalOrigin === 'top' ? -1 : 1;
  const active = direction === 'enter' ? progress : 1 - progress;
  return {
    transform: `perspective(1300px) translate3d(0, ${lerp(14, 0, active) * signed}px, 0) scale(${direction === 'enter' ? lerp(0.88, 1, active) : lerp(1, 0.9, progress)}) rotateX(${direction === 'enter' ? lerp(-18, 0, active) : lerp(0, 20, progress)}deg) rotateY(${direction === 'enter' ? lerp(12, 0, active) : lerp(0, -14, progress)}deg)`,
    opacity: context.baseOpacity * (direction === 'enter' ? active : 1 - progress),
    filter: `blur(${direction === 'enter' ? lerp(14, 0, active) : lerp(0, 16, progress)}px) saturate(${direction === 'enter' ? lerp(0.68, 1, active) : lerp(1, 0.62, progress)}) contrast(${direction === 'enter' ? lerp(1.2, 1, active) : lerp(1, 1.16, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Hologram Cube Lattice',
  description: 'Projected cubes form a floating holographic grid to stress the canvas-side pseudo-3D path.',
  group: 'Stress Test',
  tags: ['hologram', 'cubes', '3d'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: HologramCubeLattice,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: HologramCubeLattice,
  },
});
