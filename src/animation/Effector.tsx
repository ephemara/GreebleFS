/**
 * Effector Component
 * 
 * Cinema 4D MoGraph-style effector for procedural control
 * Modifies clones based on random, noise, field, or custom functions
 * 
 * Usage:
 *   <Effector type="random" strength={0.5} seed={42}>
 *     <Cloner count={10} motion="orbit">
 *       <Icon name="gpu" />
 *     </Cloner>
 *   </Effector>
 * 
 *   <Effector type="noise" frequency={2.0} strength={1.0}>
 *     <AnimatedIcon name="sparkles" />
 *   </Effector>
 */

import { useRef, useEffect } from 'react';

export type EffectorType = 'random' | 'noise' | 'wave' | 'field' | 'step' | 'delay';

export interface EffectorProps {
  children: React.ReactNode;
  type: EffectorType;
  strength?: number;
  frequency?: number;
  seed?: number;
  fieldCenter?: [number, number]; // For field effector
  fieldRadius?: number;
  falloff?: 'linear' | 'smooth' | 'inverse';
  className?: string;
}

export function Effector({
  children,
  type,
  strength = 1.0,
  frequency = 1.0,
  seed = 42,
  fieldCenter = [0, 0],
  fieldRadius = 100,
  falloff = 'smooth',
  className = '',
}: EffectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!containerRef.current) return;

    const animate = () => {
      const t = (Date.now() - startTimeRef.current) / 1000;
      const container = containerRef.current;
      if (!container) return;

      // Get all child elements
      const children = Array.from(container.children) as HTMLElement[];

      children.forEach((child, index) => {
        const effect = calculateEffect(
          index,
          t,
          type,
          strength,
          frequency,
          seed,
          fieldCenter,
          fieldRadius,
          falloff,
          child
        );

        // Apply effect as CSS variables that children can use
        child.style.setProperty('--effector-strength', effect.strength.toString());
        child.style.setProperty('--effector-offset-x', `${effect.offsetX}px`);
        child.style.setProperty('--effector-offset-y', `${effect.offsetY}px`);
        child.style.setProperty('--effector-scale', effect.scale.toString());
        child.style.setProperty('--effector-rotation', `${effect.rotation}deg`);
        child.style.setProperty('--effector-opacity', effect.opacity.toString());
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [type, strength, frequency, seed, fieldCenter, fieldRadius, falloff]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

/**
 * Calculate effector influence
 */
function calculateEffect(
  index: number,
  time: number,
  type: EffectorType,
  strength: number,
  frequency: number,
  seed: number,
  fieldCenter: [number, number],
  fieldRadius: number,
  falloff: 'linear' | 'smooth' | 'inverse',
  element: HTMLElement
): {
  strength: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  opacity: number;
} {
  const hash = (n: number) => {
    let x = Math.sin(n + seed) * 43758.5453123;
    return x - Math.floor(x);
  };

  const noise = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3.0 - 2.0 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  };

  let effectStrength = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  let scale = 1.0;
  let rotation = 0;
  let opacity = 1.0;

  switch (type) {
    case 'random':
      effectStrength = hash(index) * strength;
      offsetX = (hash(index * 3) - 0.5) * 50 * strength;
      offsetY = (hash(index * 3 + 1) - 0.5) * 50 * strength;
      scale = 1.0 + (hash(index * 3 + 2) - 0.5) * 0.5 * strength;
      rotation = (hash(index * 3 + 3) - 0.5) * 45 * strength;
      break;

    case 'noise':
      const n = noise(index * 0.5 + time * frequency);
      effectStrength = n * strength;
      offsetX = (noise(index * 0.5 + time * frequency + 100) - 0.5) * 30 * strength;
      offsetY = (noise(index * 0.5 + time * frequency + 200) - 0.5) * 30 * strength;
      scale = 1.0 + (n - 0.5) * 0.3 * strength;
      break;

    case 'wave':
      const wave = Math.sin(index * 0.5 + time * frequency * 2);
      effectStrength = (wave + 1) * 0.5 * strength;
      offsetY = wave * 20 * strength;
      scale = 1.0 + wave * 0.2 * strength;
      break;

    case 'field': {
      // Get element position relative to field center
      const rect = element.getBoundingClientRect();
      const elemX = rect.left + rect.width / 2;
      const elemY = rect.top + rect.height / 2;
      const dx = elemX - fieldCenter[0];
      const dy = elemY - fieldCenter[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate falloff
      let falloffValue = 1.0;
      if (distance < fieldRadius) {
        const t = distance / fieldRadius;
        switch (falloff) {
          case 'linear':
            falloffValue = 1.0 - t;
            break;
          case 'smooth':
            falloffValue = 1.0 - t * t * (3.0 - 2.0 * t);
            break;
          case 'inverse':
            falloffValue = 1.0 / (1.0 + t * 5);
            break;
        }
      } else {
        falloffValue = 0;
      }

      effectStrength = falloffValue * strength;
      scale = 1.0 + falloffValue * 0.5 * strength;
      opacity = 0.5 + falloffValue * 0.5;
      break;
    }

    case 'step':
      effectStrength = Math.floor(time * frequency + index * 0.1) % 2 === 0 ? strength : 0;
      scale = effectStrength > 0.5 ? 1.2 : 0.8;
      break;

    case 'delay':
      const delayTime = time - index * 0.1;
      effectStrength = delayTime > 0 ? Math.min(delayTime, 1.0) * strength : 0;
      scale = 0.5 + effectStrength * 0.5;
      opacity = effectStrength;
      break;
  }

  return {
    strength: effectStrength,
    offsetX,
    offsetY,
    scale,
    rotation,
    opacity,
  };
}
