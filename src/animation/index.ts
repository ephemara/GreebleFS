/**
 * MoGraph System
 *
 * The animation folder now has two explicit lanes:
 * - shell-facing micro interactions and profile math
 * - advanced MoGraph scene effects for labs and authored runtime overlays
 */

export * from './advancedEffects';
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

export * from './microInteractions';
