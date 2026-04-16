import React, { useEffect, useState } from 'react';
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

function PulseBackground({ context }) {
  const time = useClock(0.5);
  const pulse = Math.sin(time * 2.5) * 0.5 + 0.5;
  const accent = context.accentColor || '#8b5cf6';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        inset: '-20%',
        background: `radial-gradient(circle at ${50 + Math.sin(time) * 10}% ${50 + Math.cos(time * 0.8) * 10}%, ${accent}${alphaHex(0.12 + pulse * 0.08)}, transparent 60%)`,
        filter: 'blur(60px)',
        transform: `scale(${1 + pulse * 0.05})`,
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${time * 15}deg, transparent 0%, ${accent}${alphaHex(0.04)} 50%, transparent 100%)`,
        mixBlendMode: 'screen',
      }} />
    </div>
  );
}

export default defineShader({
  name: 'Obsidian Pulse',
  description: 'Deep obsidian respiratory light that pulses with the heartbeat of the shell.',
  group: 'Reference',
  tags: ['obsidian', 'pulse', 'minimal'],
  background: {
    render: PulseBackground,
  }
});
