/**
 * SubtleEffects - Professional MoGraph Enhancements
 * 
 * Adobe/Autodesk-level polish for UI elements
 * SUBTLE ONLY - no toy-like animations
 */

import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

interface MagneticButtonProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

/**
 * Magnetic Button - Subtle pull effect on hover
 * Used for: CTA buttons, primary actions
 */
export function MagneticButton({ 
  children, 
  strength = 0.3, 
  className = '',
  onClick,
  style 
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 300 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  useEffect(() => {
    const button = ref.current;
    if (!button) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const deltaX = (e.clientX - centerX) * strength;
      const deltaY = (e.clientY - centerY) * strength;
      
      x.set(deltaX);
      y.set(deltaY);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
    };

    button.addEventListener('mousemove', handleMouseMove);
    button.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      button.removeEventListener('mousemove', handleMouseMove);
      button.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [x, y, strength]);

  return (
    <motion.button
      ref={ref}
      className={className}
      style={{ 
        x: springX, 
        y: springY,
        ...style 
      }}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}

interface FloatOnHoverProps {
  children: ReactNode;
  distance?: number;
  duration?: number;
  className?: string;
}

/**
 * Float on Hover - Subtle lift effect
 * Used for: Cards, feature items, nav items
 */
export function FloatOnHover({ 
  children, 
  distance = 4, 
  duration = 0.3,
  className = '' 
}: FloatOnHoverProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ 
        y: -distance,
        transition: { duration, ease: [0.4, 0, 0.2, 1] }
      }}
    >
      {children}
    </motion.div>
  );
}

interface PulseGlowProps {
  children: ReactNode;
  color?: string;
  intensity?: number;
  duration?: number;
  className?: string;
}

/**
 * Pulse Glow - Subtle breathing glow effect
 * Used for: Icons, badges, status indicators
 */
export function PulseGlow({ 
  children, 
  color = '#00ffcc',
  intensity = 0.3,
  duration = 3,
  className = '' 
}: PulseGlowProps) {
  return (
    <motion.div
      className={className}
      animate={{
        filter: [
          `drop-shadow(0 0 ${intensity * 10}px ${color}${Math.floor(intensity * 255).toString(16).padStart(2, '0')})`,
          `drop-shadow(0 0 ${intensity * 20}px ${color}${Math.floor(intensity * 128).toString(16).padStart(2, '0')})`,
          `drop-shadow(0 0 ${intensity * 10}px ${color}${Math.floor(intensity * 255).toString(16).padStart(2, '0')})`,
        ],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}

interface ParallaxCardProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

/**
 * Parallax Card - Subtle 3D tilt on hover
 * Used for: Feature cards, product cards
 */
export function ParallaxCard({ 
  children, 
  strength = 10,
  className = '' 
}: ParallaxCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 300 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  useEffect(() => {
    const card = ref.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const deltaX = (e.clientX - centerX) / rect.width;
      const deltaY = (e.clientY - centerY) / rect.height;
      
      rotateY.set(deltaX * strength);
      rotateX.set(-deltaY * strength);
    };

    const handleMouseLeave = () => {
      rotateX.set(0);
      rotateY.set(0);
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [rotateX, rotateY, strength]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </motion.div>
  );
}

interface ScaleOnHoverProps {
  children: ReactNode;
  scale?: number;
  duration?: number;
  className?: string;
}

/**
 * Scale on Hover - Subtle scale effect
 * Used for: Buttons, icons, interactive elements
 */
export function ScaleOnHover({ 
  children, 
  scale = 1.05,
  duration = 0.2,
  className = '' 
}: ScaleOnHoverProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ 
        scale,
        transition: { duration, ease: [0.4, 0, 0.2, 1] }
      }}
      whileTap={{ scale: scale * 0.95 }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerChildrenProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

/**
 * Stagger Children - Cascade animation for child elements
 * Used for: Lists, grids, navigation items
 */
export function StaggerChildren({ 
  children, 
  staggerDelay = 0.1,
  className = '' 
}: StaggerChildrenProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
  },
};
