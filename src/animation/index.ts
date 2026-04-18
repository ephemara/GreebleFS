/**
 * MoGraph System
 * 
 * Cinema 4D-style motion graphics system for web UI
 * Procedural animation, cloning, effectors, and fields
 * 
 * BREAKTHROUGH: Applying 3D DCC motion graphics concepts to 2D web UI
 */

export { Cloner, type ClonerProps, type ClonerLayout } from './Cloner';
export { Effector, type EffectorProps, type EffectorType } from './Effector';
export { Field, FieldTarget, type FieldProps, type FieldType, type FalloffType } from './Field';
export { ParticleUI, type ParticleUIProps, type ParticleMode } from './ParticleUI';
export { FluidUI, type FluidUIProps } from './FluidUI';
export {
  AnimationTimeline,
  bakeAnimation,
  MOTION_LIBRARY,
  MOTION_LIBRARY_BY_ID,
  applyMotion,
  useAnimation,
  type AnimationState,
  type BakeOptions,
  type BakeRange,
  type BakeResult,
  type MotionModifier,
  type MotionParams,
  type TransformTarget,
  type UseAnimationOptions,
} from './lib';

// Subtle professional effects for UI polish
export {
  MagneticButton,
  FloatOnHover,
  PulseGlow,
  ParallaxCard,
  ScaleOnHover,
  StaggerChildren,
  childVariants,
} from './SubtleEffects';
