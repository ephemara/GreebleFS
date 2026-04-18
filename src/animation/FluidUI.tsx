/**
 * FluidUI Component
 * 
 * 2D-adapted fluid simulation for UI elements
 * Applies Navier-Stokes fluid dynamics concepts to web UI
 * 
 * Usage:
 *   <FluidUI viscosity={0.98} turbulence={0.5}>
 *     <Cloner count={20} motion="float">
 *       <Icon name="gpu" />
 *     </Cloner>
 *   </FluidUI>
 */

import { useRef, useEffect } from 'react';

export interface FluidUIProps {
  children: React.ReactNode;
  viscosity?: number; // 0-1, higher = more viscous
  turbulence?: number; // 0-1, chaos factor
  flowSpeed?: number;
  interactive?: boolean; // React to mouse
  className?: string;
}

export function FluidUI({
  children,
  viscosity = 0.95,
  turbulence = 0.3,
  flowSpeed = 1.0,
  interactive = true,
  className = '',
}: FluidUIProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const velocityFieldRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const mouseRef = useRef({ x: 0, y: 0, prevX: 0, prevY: 0, isDown: false });
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());

  // Mouse tracking
  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
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

  // Fluid simulation
  useEffect(() => {
    if (!containerRef.current) return;

    const animate = () => {
      const t = (Date.now() - startTimeRef.current) / 1000;
      const container = containerRef.current;
      if (!container) return;

      const children = Array.from(container.children) as HTMLElement[];

      // Calculate mouse velocity
      const mouseDx = mouseRef.current.x - mouseRef.current.prevX;
      const mouseDy = mouseRef.current.y - mouseRef.current.prevY;
      const mouseForce = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy) * 0.1;

      children.forEach((child, index) => {
        const rect = child.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // Get or create velocity for this element
        const key = `elem-${index}`;
        let velocity = velocityFieldRef.current.get(key) || { vx: 0, vy: 0 };

        // Apply turbulence (noise-based flow)
        const noise = (x: number, y: number) => {
          const hash = (n: number) => {
            let x = Math.sin(n) * 43758.5453123;
            return x - Math.floor(x);
          };
          return hash(x * 0.01 + y * 0.01 + t * flowSpeed);
        };

        const turbulenceX = (noise(cx, cy) - 0.5) * turbulence * 2;
        const turbulenceY = (noise(cy, cx) - 0.5) * turbulence * 2;

        velocity.vx += turbulenceX;
        velocity.vy += turbulenceY;

        // Apply mouse interaction
        if (interactive && mouseForce > 0.1) {
          const dx = cx - mouseRef.current.x;
          const dy = cy - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 200) {
            const force = (1 - distance / 200) * mouseForce;
            velocity.vx += (dx / distance) * force * (mouseRef.current.isDown ? -1 : 1);
            velocity.vy += (dy / distance) * force * (mouseRef.current.isDown ? -1 : 1);
          }
        }

        // Apply viscosity (damping)
        velocity.vx *= viscosity;
        velocity.vy *= viscosity;

        // Update velocity field
        velocityFieldRef.current.set(key, velocity);

        // Apply to element
        const offsetX = velocity.vx * 10;
        const offsetY = velocity.vy * 10;
        const rotation = Math.atan2(velocity.vy, velocity.vx);

        child.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation * 0.1}rad)`;
        child.style.transition = 'transform 0.1s ease-out';
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [viscosity, turbulence, flowSpeed, interactive]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {children}
    </div>
  );
}
