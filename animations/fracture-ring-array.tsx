import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp } from 'overlayterm-animation';

function FractureRingArrayLayer({ context }) {
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

    const rings = Array.from({ length: 11 }, (_, index) => ({
      radius: 54 + index * 22,
      segments: 10 + index * 2,
      phase: index * 0.61,
      drift: 0.2 + index * 0.06,
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

      const cx = canvas.clientWidth * 0.5;
      const cy = canvas.clientHeight * 0.52;
      const radiusLimit = Math.max(canvas.clientWidth, canvas.clientHeight) * 0.62;

      ctx.globalCompositeOperation = 'screen';

      const haze = ctx.createRadialGradient(cx, cy, 12, cx, cy, radiusLimit);
      haze.addColorStop(0, `rgba(255,255,255,${0.16 + active * 0.12})`);
      haze.addColorStop(0.32, `${context.accentColor}22`);
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const [ringIndex, ring] of rings.entries()) {
        const ringRadius = ring.radius * lerp(0.66, 1.08, active);
        const spin = now * 0.00042 * (1 + ring.drift) + ring.phase + active * 2.3;
        const alpha = lerp(0.16, 0.82, active) * lerp(1, 0.62, ringIndex / Math.max(rings.length - 1, 1));
        const segmentAngle = (Math.PI * 2) / ring.segments;
        const shardJitter = 1 + Math.sin(now * 0.0018 + ring.phase) * 0.22;

        ctx.save();
        ctx.shadowColor = context.accentColor;
        ctx.shadowBlur = 16 * active + ringIndex * 0.5;
        ctx.strokeStyle = context.accentColor;
        ctx.lineWidth = 1.15 + ringIndex * 0.1;
        ctx.globalAlpha = alpha;

        for (let segment = 0; segment < ring.segments; segment += 1) {
          const start = spin + segment * segmentAngle;
          const end = start + segmentAngle * 0.74;
          const segmentLift = Math.sin(start * 3 + now * 0.002 + ring.phase) * (6 + ringIndex * 0.5) * shardJitter;
          const innerRadius = ringRadius + segmentLift;

          ctx.beginPath();
          ctx.arc(cx, cy, innerRadius, start, end);
          ctx.stroke();

          const edgeAngle = end;
          const edgeX = cx + Math.cos(edgeAngle) * innerRadius;
          const edgeY = cy + Math.sin(edgeAngle) * innerRadius;
          const outX = cx + Math.cos(edgeAngle) * (innerRadius + 9 + ringIndex * 0.45);
          const outY = cy + Math.sin(edgeAngle) * (innerRadius + 9 + ringIndex * 0.45);
          ctx.beginPath();
          ctx.moveTo(edgeX, edgeY);
          ctx.lineTo(outX, outY);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.globalCompositeOperation = 'lighter';
      const fleckCount = 42;
      for (let index = 0; index < fleckCount; index += 1) {
        const seed = index * 0.73;
        const orbit = 58 + (index % 9) * 18;
        const theta = seed + now * 0.00066 * (0.7 + (index % 5) * 0.18) + active * 2.4;
        const px = cx + Math.cos(theta) * orbit;
        const py = cy + Math.sin(theta * 1.07) * (orbit * 0.62);
        const size = 0.9 + (index % 4) * 0.45 + active * 1.6;

        ctx.save();
        ctx.globalAlpha = 0.15 + active * 0.55;
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10 * active;
        ctx.fillStyle = index % 3 === 0 ? '#ffffff' : context.accentColor;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
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
        opacity: 0.94,
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
    transform: `perspective(1500px) translate3d(0, ${lerp(30, 0, progress) * signed}px, 0) scale(${enter ? lerp(0.76, 1, progress) : lerp(1, 0.86, progress)}) rotateX(${enter ? lerp(20, 0, progress) : lerp(0, -16, progress)}deg) rotateZ(${enter ? lerp(-9, 0, progress) : lerp(0, 11, progress)}deg) skewX(${enter ? lerp(-4, 0, progress) : lerp(0, 5, progress)}deg)`,
    opacity: context.baseOpacity * (enter ? progress : 1 - progress),
    filter: `blur(${enter ? lerp(18, 0, progress) : lerp(0, 20, progress)}px) saturate(${enter ? lerp(0.72, 1.08, progress) : lerp(1.08, 0.7, progress)}) brightness(${enter ? lerp(0.82, 1, progress) : lerp(1, 0.72, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Fracture Ring Array',
  description: 'A concentric fracture lattice spins up from the shell center and throws off ring shards and orbital debris.',
  group: 'Architecture',
  tags: ['rings', 'fracture', 'lattice', 'canvas'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: FractureRingArrayLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: FractureRingArrayLayer,
  },
});
