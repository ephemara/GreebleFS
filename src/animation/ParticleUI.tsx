/**
 * ParticleUI Component
 * 
 * 2D-adapted particle system for UI elements
 * GPU-accelerated particle physics concepts for web UI
 * 
 * Usage:
 *   <ParticleUI mode="orbit" speed={1.0} chaos={0.5}>
 *     <Icon name="sparkles" />
 *   </ParticleUI>
 */

import { useRef, useEffect } from 'react';

export type ParticleMode = 
  | 'orbit' 
  | 'attract' 
  | 'repel' 
  | 'vortex' 
  | 'explode' 
  | 'flow' 
  | 'quantum';

export interface ParticleUIProps {
  children: React.ReactNode;
  mode?: ParticleMode;
  speed?: number;
  chaos?: number;
  particleCount?: number;
  interactive?: boolean;
  className?: string;
}

export function ParticleUI({
  children,
  mode = 'orbit',
  speed = 1.0,
  chaos = 0.3,
  particleCount = 50,
  interactive = true,
  className = '',
}: ParticleUIProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    size: number;
  }>>([]);
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });
  const frameRef = useRef<number | null>(null);

  // Initialize particles
  useEffect(() => {
    const particles: typeof particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1.0,
        size: Math.random() * 3 + 1,
      });
    }
    particlesRef.current = particles;
  }, [particleCount]);

  // Mouse tracking
  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = e.clientX - rect.left;
        mouseRef.current.y = e.clientY - rect.top;
      }
    };

    const handleMouseDown = () => {
      mouseRef.current.isDown = true;
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [interactive]);

  // Particle simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((p) => {
        // Apply mode-specific forces
        applyParticleForces(p, mode, chaos, mouseRef.current, interactive);

        // Update position
        p.x += p.vx * speed;
        p.y += p.vy * speed;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle
        ctx.fillStyle = `rgba(0, 255, 204, ${p.life * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw trail
        ctx.strokeStyle = `rgba(0, 255, 204, ${p.life * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 5, p.y - p.vy * 5);
        ctx.stroke();
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [mode, speed, chaos, interactive]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="absolute inset-0 pointer-events-none"
        style={{ mixBlendMode: 'screen' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Apply forces based on particle mode
 */
function applyParticleForces(
  particle: { x: number; y: number; vx: number; vy: number; life: number },
  mode: ParticleMode,
  chaos: number,
  mouse: { x: number; y: number; isDown: boolean },
  interactive: boolean
) {
  const centerX = 400;
  const centerY = 300;

  // Add chaos (noise)
  const hash = (n: number) => {
    let x = Math.sin(n) * 43758.5453123;
    return x - Math.floor(x);
  };
  particle.vx += (hash(particle.x * 0.1 + particle.y * 0.1) - 0.5) * chaos * 0.1;
  particle.vy += (hash(particle.y * 0.1 + particle.x * 0.1) - 0.5) * chaos * 0.1;

  switch (mode) {
    case 'orbit': {
      const dx = particle.x - centerX;
      const dy = particle.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        particle.vx += (-dy / distance) * 0.1;
        particle.vy += (dx / distance) * 0.1;
      }
      break;
    }

    case 'attract': {
      const target = interactive && mouse.isDown ? mouse : { x: centerX, y: centerY };
      const dx = target.x - particle.x;
      const dy = target.y - particle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        particle.vx += (dx / distance) * 0.05;
        particle.vy += (dy / distance) * 0.05;
      }
      break;
    }

    case 'repel': {
      const target = interactive ? mouse : { x: centerX, y: centerY };
      const dx = particle.x - target.x;
      const dy = particle.y - target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0 && distance < 200) {
        const force = (1 - distance / 200) * 0.2;
        particle.vx += (dx / distance) * force;
        particle.vy += (dy / distance) * force;
      }
      break;
    }

    case 'vortex': {
      const dx = particle.x - centerX;
      const dy = particle.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        const angle = Math.atan2(dy, dx);
        const force = 0.1 / (1 + distance * 0.01);
        particle.vx += Math.cos(angle + Math.PI / 2) * force;
        particle.vy += Math.sin(angle + Math.PI / 2) * force;
        particle.vx += (-dx / distance) * 0.01;
        particle.vy += (-dy / distance) * 0.01;
      }
      break;
    }

    case 'explode': {
      const dx = particle.x - centerX;
      const dy = particle.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) {
        particle.vx += (dx / distance) * 0.1;
        particle.vy += (dy / distance) * 0.1;
      }
      break;
    }

    case 'flow': {
      const time = Date.now() / 1000;
      particle.vx += Math.sin(particle.y * 0.01 + time) * 0.05;
      particle.vy += Math.cos(particle.x * 0.01 + time) * 0.05;
      break;
    }

    case 'quantum': {
      // Quantum uncertainty - random teleportation
      if (Math.random() < 0.01) {
        particle.x += (Math.random() - 0.5) * 50;
        particle.y += (Math.random() - 0.5) * 50;
      }
      // Superposition - multiple states
      particle.vx += Math.sin(Date.now() * 0.01) * 0.1;
      particle.vy += Math.cos(Date.now() * 0.01) * 0.1;
      break;
    }
  }

  // Damping
  particle.vx *= 0.98;
  particle.vy *= 0.98;
}
