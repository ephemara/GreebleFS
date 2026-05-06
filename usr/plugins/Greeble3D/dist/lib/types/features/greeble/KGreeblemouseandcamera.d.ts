import * as THREE from 'three';
/**
 * 🔥 ZBRUSH-STYLE IMM BRUSH SYSTEM
 *
 * BUILD MODE CONTROLS:
 * - DRAG: Scale object exponentially (smooth, INFINITE - no limits!)
 * - CTRL + DRAG: Rotate around surface normal (spawns at size 1.0, horizontal mouse = rotation)
 * - ALT + DRAG: Move/reposition object along surface (spawns at size 1.0, no scaling)
 * - SHIFT + DRAG: Uniform constrained scale (INFINITE with 0.25 snap increments)
 * - RIGHT-CLICK + DRAG: Free screen-space rotation (spawns at size 1.0, X/Y axes)
 *
 * ARCHITECTURE:
 * - NO MODIFIER: Wait for drag threshold, then spawn and scale based on distance (INFINITE)
 * - WITH MODIFIER: Spawn IMMEDIATELY at default size (1.0), then apply modifier action
 * - DYNAMIC SWITCHING: Hold/release modifiers during drag to switch modes in real-time
 * - This prevents tiny objects when using modifiers
 *
 * SCALING:
 * - Default drag: Exponential curve Math.pow(dist * 2.5, 1.8) - NO LIMITS!
 * - Shift drag: Exponential with snapping Math.pow(mouseDist * 10, 1.5) - NO LIMITS!
 * - Both scale infinitely from tiny to massive
 *
 * MODIFIERS:
 * - Hold modifier BEFORE clicking to activate mode
 * - Hold/release modifiers DURING drag to switch modes dynamically
 * - Right-click on existing object to rotate it (doesn't spawn new)
 * - Status bar updates in real-time showing active mode
 */
export declare const useKGreebleInteraction: (sceneRef: any, mountRef: any, state: any, setters: any, callbacks: {
    spawnProceduralObject: (point: THREE.Vector3, normal: THREE.Vector3, type: string) => THREE.Group | null;
    captureCurrentTransform: () => void;
}) => {
    handleMouseDown: (e: any) => void;
    handleMouseMove: (e: any) => void;
    handleMouseUp: (_e?: any) => void;
    resetCamera: () => void;
};
