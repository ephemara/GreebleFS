/**
 * Field Component
 * 
 * Cinema 4D-style field system for spatial influence
 * Provides spherical, linear, and custom falloff for child elements
 * 
 * Usage:
 *   <Field type="spherical" center={[400, 300]} radius={200} falloff="smooth">
 *     <Cloner count={20} motion="float">
 *       <Icon name="gpu" />
 *     </Cloner>
 *   </Field>
 * 
 *   <Field type="linear" direction="horizontal" falloff="linear">
 *     <AnimatedIcon name="sparkles" />
 *   </Field>
 */

import { useRef, useEffect, useState } from 'react';

export type FieldType = 'spherical' | 'linear' | 'radial' | 'noise' | 'grid';
export type FalloffType = 'linear' | 'smooth' | 'inverse' | 'constant';

export interface FieldProps {
  children: React.ReactNode;
  type: FieldType;
  center?: [number, number]; // Screen coordinates
  radius?: number;
  direction?: 'horizontal' | 'vertical';
  falloff?: FalloffType;
  strength?: number;
  invert?: boolean;
  className?: string;
}

export function Field({
  children,
  type,
  center,
  radius = 200,
  direction = 'horizontal',
  falloff = 'smooth',
  strength = 1.0,
  invert = false,
  className = '',
}: FieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fieldCenter, setFieldCenter] = useState<[number, number]>(center || [0, 0]);
  const frameRef = useRef<number | null>(null);

  // Update field center if not provided (use container center)
  useEffect(() => {
    if (center) {
      setFieldCenter(center);
      return;
    }

    const updateCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setFieldCenter([rect.left + rect.width / 2, rect.top + rect.height / 2]);
      }
    };

    updateCenter();
    window.addEventListener('resize', updateCenter);
    return () => window.removeEventListener('resize', updateCenter);
  }, [center]);

  // Apply field influence
  useEffect(() => {
    if (!containerRef.current) return;

    const animate = () => {
      const container = containerRef.current;
      if (!container) return;

      const children = Array.from(container.querySelectorAll('[data-field-target]')) as HTMLElement[];

      children.forEach((child) => {
        const influence = calculateFieldInfluence(
          child,
          type,
          fieldCenter,
          radius,
          direction,
          falloff,
          strength,
          invert
        );

        // Apply influence as CSS variables
        child.style.setProperty('--field-influence', influence.toString());
        child.style.setProperty('--field-scale', (1.0 + influence * 0.5).toString());
        child.style.setProperty('--field-opacity', (0.3 + influence * 0.7).toString());
        child.style.setProperty('--field-blur', `${(1 - influence) * 5}px`);

        // Apply visual effects
        child.style.transform = `scale(${1.0 + influence * 0.3})`;
        child.style.opacity = (0.3 + influence * 0.7).toString();
        child.style.filter = `blur(${(1 - influence) * 3}px)`;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [type, fieldCenter, radius, direction, falloff, strength, invert]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {children}
    </div>
  );
}

/**
 * Calculate field influence on element
 */
function calculateFieldInfluence(
  element: HTMLElement,
  type: FieldType,
  center: [number, number],
  radius: number,
  direction: 'horizontal' | 'vertical',
  falloff: FalloffType,
  strength: number,
  invert: boolean
): number {
  const rect = element.getBoundingClientRect();
  const elemX = rect.left + rect.width / 2;
  const elemY = rect.top + rect.height / 2;

  let distance = 0;
  let influence = 0;

  switch (type) {
    case 'spherical': {
      const dx = elemX - center[0];
      const dy = elemY - center[1];
      distance = Math.sqrt(dx * dx + dy * dy);
      break;
    }

    case 'linear': {
      if (direction === 'horizontal') {
        distance = Math.abs(elemX - center[0]);
      } else {
        distance = Math.abs(elemY - center[1]);
      }
      break;
    }

    case 'radial': {
      const dx = elemX - center[0];
      const dy = elemY - center[1];
      const angle = Math.atan2(dy, dx);
      distance = (Math.abs(angle) / Math.PI) * radius;
      break;
    }

    case 'noise': {
      const hash = (n: number) => {
        let x = Math.sin(n) * 43758.5453123;
        return x - Math.floor(x);
      };
      const noise = hash(elemX * 0.01 + elemY * 0.01);
      distance = noise * radius;
      break;
    }

    case 'grid': {
      const gridSize = radius / 5;
      const gridX = Math.floor(elemX / gridSize);
      const gridY = Math.floor(elemY / gridSize);
      const isEven = (gridX + gridY) % 2 === 0;
      distance = isEven ? 0 : radius;
      break;
    }
  }

  // Calculate falloff
  if (distance < radius) {
    const t = distance / radius;
    switch (falloff) {
      case 'linear':
        influence = 1.0 - t;
        break;
      case 'smooth':
        influence = 1.0 - t * t * (3.0 - 2.0 * t);
        break;
      case 'inverse':
        influence = 1.0 / (1.0 + t * 5);
        break;
      case 'constant':
        influence = 1.0;
        break;
    }
  }

  influence *= strength;
  if (invert) influence = 1.0 - influence;

  return Math.max(0, Math.min(1, influence));
}

/**
 * FieldTarget - Wrapper to mark elements as field targets
 */
export function FieldTarget({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-field-target className={className}>
      {children}
    </div>
  );
}
