/**
 * Easing Functions for Keyframe Animation
 * t = progress (0 to 1)
 * returns eased value (0 to 1)
 */

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce' | 'elastic';

export const easings: Record<EasingType, (t: number) => number> = {
    linear: (t) => t,

    easeIn: (t) => t * t * t,

    easeOut: (t) => 1 - Math.pow(1 - t, 3),

    easeInOut: (t) => t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2,

    bounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },

    elastic: (t) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
};

/**
 * Interpolate between two values with easing
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Keyframe transform interface
 */
export interface KeyframeTransform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}

export interface Keyframe {
    frame: number;
    transform: KeyframeTransform;
    easing: EasingType;
}

/**
 * Get interpolated transform at a given frame
 */
export function getInterpolatedTransform(
    keyframes: Keyframe[],
    frame: number
): KeyframeTransform {
    // Default transform
    const defaultTransform: KeyframeTransform = {
        x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0
    };

    if (keyframes.length === 0) return defaultTransform;

    // Sort keyframes by frame
    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);

    // Before first keyframe
    if (frame <= sorted[0].frame) return sorted[0].transform;

    // After last keyframe
    if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].transform;

    // Find surrounding keyframes
    let prev = sorted[0];
    let next = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
        if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
            prev = sorted[i];
            next = sorted[i + 1];
            break;
        }
    }

    // Calculate progress between keyframes
    const duration = next.frame - prev.frame;
    const progress = duration > 0 ? (frame - prev.frame) / duration : 0;

    // Apply easing
    const easedProgress = easings[next.easing](progress);

    // Interpolate all transform properties
    return {
        x: lerp(prev.transform.x, next.transform.x, easedProgress),
        y: lerp(prev.transform.y, next.transform.y, easedProgress),
        scaleX: lerp(prev.transform.scaleX, next.transform.scaleX, easedProgress),
        scaleY: lerp(prev.transform.scaleY, next.transform.scaleY, easedProgress),
        rotation: lerp(prev.transform.rotation, next.transform.rotation, easedProgress)
    };
}
