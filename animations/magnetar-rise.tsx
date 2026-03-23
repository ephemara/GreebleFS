import React, { useEffect, useRef } from 'react';
import { clamp01, defineAnimation, lerp, useAnimationContextRef } from 'overlayterm-animation';

function MagnetarRiseLayer({ context }) {
  const canvasRef = useRef(null);
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
      const progress = clamp01(liveContext.progress);
      const active = liveContext.direction === 'enter' ? progress : 1 - progress;
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
      const rise = h * (0.72 - active * 0.28);
      const flareWidth = lerp(160, 320, active);
      const flareHeight = lerp(120, 260, active);

      ctx.globalCompositeOperation = 'screen';

      const wash = ctx.createLinearGradient(0, h, 0, 0);
      wash.addColorStop(0, `rgba(0,0,0,0)`);
      wash.addColorStop(0.3, `${liveContext.accentColor}18`);
      wash.addColorStop(1, 'rgba(255,255,255,0.1)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      const corona = ctx.createRadialGradient(cx, rise, 8, cx, rise, flareWidth);
      corona.addColorStop(0, `rgba(255,255,255,${0.28 + active * 0.26})`);
      corona.addColorStop(0.18, `${liveContext.accentColor}cc`);
      corona.addColorStop(0.42, `${liveContext.accentColor}33`);
      corona.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = corona;
      ctx.beginPath();
      ctx.ellipse(cx, rise, flareWidth, flareHeight, 0, 0, Math.PI * 2);
      ctx.fill();

      const fieldCount = 18;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let index = 0; index < fieldCount; index += 1) {
        const spread = 90 + index * 12;
        const sway = Math.sin(now * 0.0014 + index * 0.7) * (8 + active * 18);
        const topY = 24 + index * 10;
        const alpha = 0.08 + active * 0.12;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = index % 2 === 0 ? liveContext.accentColor : '#ffffff';
        ctx.shadowColor = liveContext.accentColor;
        ctx.shadowBlur = 10 + active * 12;
        ctx.lineWidth = 1 + (index % 4) * 0.4;

        ctx.beginPath();
        ctx.moveTo(cx, h + 10);
        ctx.quadraticCurveTo(cx - spread - sway, h * 0.7, cx - sway * 0.35, topY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, h + 10);
        ctx.quadraticCurveTo(cx + spread + sway, h * 0.7, cx + sway * 0.35, topY);
        ctx.stroke();
        ctx.restore();
      }

      const sparkCount = 80;
      ctx.globalCompositeOperation = 'lighter';
      for (let index = 0; index < sparkCount; index += 1) {
        const seed = index * 1.217;
        const theta = seed + now * 0.00085 * (0.5 + (index % 6) * 0.12);
        const orbit = flareWidth * (0.46 + (index % 5) * 0.06);
        const px = cx + Math.cos(theta) * orbit + Math.sin(theta * 2.1) * 14;
        const py = rise + Math.sin(theta * 1.33) * flareHeight * 0.72;
        const size = 0.75 + (index % 4) * 0.4 + active * 0.9;

        ctx.save();
        ctx.globalAlpha = 0.1 + active * 0.45;
        ctx.shadowBlur = 12 * active;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = index % 5 === 0 ? '#ffffff' : liveContext.accentColor;
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
        opacity: 0.92,
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
    transform: `perspective(1600px) translate3d(0, ${lerp(42, 0, progress) * signed}px, 0) scale(${enter ? lerp(0.72, 1, progress) : lerp(1, 0.84, progress)}) rotateX(${enter ? lerp(24, 0, progress) : lerp(0, -18, progress)}deg) rotateZ(${enter ? lerp(-6, 0, progress) : lerp(0, 9, progress)}deg)`,
    opacity: context.baseOpacity * (enter ? progress : 1 - progress),
    filter: `blur(${enter ? lerp(20, 0, progress) : lerp(0, 18, progress)}px) saturate(${enter ? lerp(0.68, 1.12, progress) : lerp(1.12, 0.76, progress)}) brightness(${enter ? lerp(0.8, 1, progress) : lerp(1, 0.74, progress)})`,
    transition: 'none',
    willChange: 'transform, opacity, filter',
  };
}

export default defineAnimation({
  name: 'Magnetar Rise',
  description: 'A magnetic star-core flare rises through the shell with polar arcs, corona bloom, and heavy upward thrust.',
  group: 'Cinematic',
  tags: ['magnetar', 'corona', 'flare', 'canvas'],
  open: {
    resolveShellStyle: context => shellStyle(context, 'enter'),
    renderOverlay: MagnetarRiseLayer,
  },
  close: {
    resolveShellStyle: context => shellStyle(context, 'exit'),
    renderOverlay: MagnetarRiseLayer,
  },
});
