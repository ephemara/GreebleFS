/**
 * Cloner Component
 * 
 * Cinema 4D MoGraph-style cloner for web UI
 * Creates array instances with procedural offset and effector support
 * 
 * Usage:
 *   <Cloner count={10} motion="orbit" layout="linear" spacing={50}>
 *     <Icon name="gpu" />
 *   </Cloner>
 * 
 *   <Cloner count={20} motion="float" layout="grid" columns={5}>
 *     <AnimatedIcon name="sparkles" />
 *   </Cloner>
 */

import { useRef, useEffect, Children, cloneElement, isValidElement } from 'react';
import { applyMotion, resolveMotionModifier, type MotionParams } from './lib/ProceduralMotion';
import * as THREE from 'three';

export type ClonerLayout = 'linear' | 'grid' | 'circle' | 'spiral' | 'random';

export interface ClonerProps {
  children: React.ReactNode;
  count: number;
  motion?: string | string[];
  motionParams?: MotionParams;
  layout?: ClonerLayout;
  spacing?: number;
  columns?: number; // For grid layout
  radius?: number; // For circle/spiral layout
  randomSeed?: number;
  stepOffset?: number; // Time offset per clone (MoGraph step effector)
  autoPlay?: boolean;
  className?: string;
}

export function Cloner({
  children,
  count,
  motion,
  motionParams = {},
  layout = 'linear',
  spacing = 40,
  columns = 5,
  radius = 100,
  randomSeed = 42,
  stepOffset = 0.1,
  autoPlay = true,
  className = '',
}: ClonerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clonesRef = useRef<HTMLDivElement[]>([]);
  const transformsRef = useRef<Array<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    basePosition: THREE.Vector3;
  }>>([]);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());

  // Initialize transforms
  useEffect(() => {
    transformsRef.current = Array.from({ length: count }, (_, i) => ({
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      basePosition: calculateBasePosition(i, layout, spacing, columns, radius, randomSeed),
    }));
  }, [count, layout, spacing, columns, radius, randomSeed]);

  // Animation loop
  useEffect(() => {
    if (!motion || !autoPlay) return;

    const motions = Array.isArray(motion) ? motion : [motion];

    const animate = () => {
      const t = (Date.now() - startTimeRef.current) / 1000;

      transformsRef.current.forEach((transform, index) => {
        // Reset to base position
        transform.position.copy(transform.basePosition);
        transform.rotation.set(0, 0, 0);
        transform.scale.set(1, 1, 1);

        // Apply all motions with step offset
        motions.forEach((motionType) => {
          const motionDef = resolveMotionModifier(motionType);
          if (motionDef) {
            applyMotion(
              transform,
              {
                type: motionDef.id,
                params: { ...motionDef.params, ...motionParams, step: stepOffset },
              },
              t,
              index
            );
          }
        });

        // Apply transform to DOM element
        const element = clonesRef.current[index];
        if (element) {
          const { position, rotation, scale } = transform;

          const tx = position.x * 10;
          const ty = position.y * 10;
          const tz = position.z * 10;
          const rx = rotation.x;
          const ry = rotation.y;
          const rz = rotation.z;
          const sx = scale.x;
          const sy = scale.y;
          const sz = scale.z;

          element.style.transform = `
            translate3d(${tx}px, ${ty}px, ${tz}px)
            rotateX(${rx}rad)
            rotateY(${ry}rad)
            rotateZ(${rz}rad)
            scale3d(${sx}, ${sy}, ${sz})
          `;
        }
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [motion, motionParams, autoPlay, stepOffset, count]);

  // Clone children
  const clones = Array.from({ length: count }, (_, i) => {
    const child = Children.only(children);
    if (!isValidElement(child)) return null;

    return (
      <div
        key={i}
        ref={(el) => {
          if (el) clonesRef.current[i] = el;
        }}
        style={{
          position: 'absolute',
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        {cloneElement(child as React.ReactElement)}
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
    >
      {clones}
    </div>
  );
}

/**
 * Calculate base position for clone based on layout
 */
function calculateBasePosition(
  index: number,
  layout: ClonerLayout,
  spacing: number,
  columns: number,
  radius: number,
  seed: number
): THREE.Vector3 {
  const pos = new THREE.Vector3();

  switch (layout) {
    case 'linear':
      pos.x = index * spacing;
      break;

    case 'grid': {
      const row = Math.floor(index / columns);
      const col = index % columns;
      pos.x = col * spacing;
      pos.y = row * spacing;
      break;
    }

    case 'circle': {
      const angle = (index / 10) * Math.PI * 2; // Assuming max 10 for circle
      pos.x = Math.cos(angle) * radius;
      pos.y = Math.sin(angle) * radius;
      break;
    }

    case 'spiral': {
      const angle = index * 0.5;
      const r = index * (radius / 20);
      pos.x = Math.cos(angle) * r;
      pos.y = Math.sin(angle) * r;
      break;
    }

    case 'random': {
      // Seeded random
      const hash = (n: number) => {
        let x = Math.sin(n + seed) * 43758.5453123;
        return x - Math.floor(x);
      };
      pos.x = (hash(index * 3) - 0.5) * radius * 2;
      pos.y = (hash(index * 3 + 1) - 0.5) * radius * 2;
      pos.z = (hash(index * 3 + 2) - 0.5) * radius * 0.5;
      break;
    }
  }

  return pos;
}
