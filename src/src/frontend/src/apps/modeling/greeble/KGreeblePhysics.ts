/**
 * KGreeblePhysics.ts
 * 
 * Rapier3D integration for KGreeble - Real rigid body physics simulation.
 * Drop shapes from the sky, watch them collide and settle on the ground.
 */

import * as THREE from 'three';

// Check if we're running in Tauri
const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Lazy import Tauri invoke
let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const getInvoke = async () => {
    if (tauriInvoke) return tauriInvoke;
    if (isTauri()) {
        try {
            const tauri = await import('@tauri-apps/api/core');
            tauriInvoke = tauri.invoke;
            return tauriInvoke;
        } catch (e) {
            console.warn('[KGreeblePhysics] Failed to import Tauri API:', e);
        }
    }
    return null;
};

export interface BodyState {
    id: number;
    position: [number, number, number];
}

export interface PhysicsBodyMapping {
    bodyId: number;
    object3D: THREE.Object3D;
    boundsRadius: number;
}

export class KGreeblePhysicsEngine {
    private worldId: number | null = null;
    private bodyMappings: Map<number, PhysicsBodyMapping> = new Map();
    private groundMeshId: number | null = null;
    private isActive: boolean = false;
    private animationId: number | null = null;

    // Callbacks
    private onUpdate?: (bodies: BodyState[]) => void;
    private onStatusChange?: (status: string) => void;

    constructor() { }

    /**
     * Initialize the Rapier physics world
     */
    async init(gravity: number = -9.81): Promise<boolean> {
        const invoke = await getInvoke();
        if (!invoke) {
            console.warn('[KGreeblePhysics] Tauri not available - using fallback physics');
            return false;
        }

        try {
            this.worldId = await invoke('create_physics_world', { gravityY: gravity });
            this.isActive = true;
            this.onStatusChange?.('⚡ RAPIER PHYSICS ACTIVE');
            console.log('[KGreeblePhysics] Rapier3D initialized, world:', this.worldId);
            return true;
        } catch (e) {
            console.error('[KGreeblePhysics] Failed to create physics world:', e);
            return false;
        }
    }

    /**
     * Add ground plane as static collider
     */
    async addGroundPlane(size: number = 100): Promise<void> {
        if (!this.worldId) return;
        const invoke = await getInvoke();
        if (!invoke) return;

        const halfSize = size / 2;
        const thickness = 0.5;

        const vertices: [number, number, number][] = [
            [-halfSize, -thickness, -halfSize],
            [halfSize, -thickness, -halfSize],
            [halfSize, -thickness, halfSize],
            [-halfSize, -thickness, halfSize],
            [-halfSize, 0, -halfSize],
            [halfSize, 0, -halfSize],
            [halfSize, 0, halfSize],
            [-halfSize, 0, halfSize],
        ];

        const indices: [number, number, number][] = [
            [4, 5, 6], [4, 6, 7],
            [0, 2, 1], [0, 3, 2],
            [0, 1, 5], [0, 5, 4],
            [1, 2, 6], [1, 6, 5],
            [2, 3, 7], [2, 7, 6],
            [3, 0, 4], [3, 4, 7],
        ];

        try {
            this.groundMeshId = await invoke('add_physics_mesh', {
                worldId: this.worldId,
                vertices,
                indices,
            });
            console.log('[KGreeblePhysics] Ground plane added, ID:', this.groundMeshId);
        } catch (e) {
            console.error('[KGreeblePhysics] Failed to add ground:', e);
        }
    }

    /**
     * Add a Three.js object as a dynamic physics body
     */
    async addDynamicBody(object: THREE.Object3D): Promise<number | null> {
        if (!this.worldId) return null;
        const invoke = await getInvoke();
        if (!invoke) return null;

        // Calculate bounding sphere
        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        const radius = Math.max(size.x, size.y, size.z) / 2;

        // Get world position
        const worldPos = new THREE.Vector3();
        object.getWorldPosition(worldPos);

        try {
            const bodyId = await invoke('add_physics_body', {
                worldId: this.worldId,
                position: [worldPos.x, worldPos.y, worldPos.z],
                radius,
            });

            if (bodyId !== null) {
                this.bodyMappings.set(bodyId, {
                    bodyId,
                    object3D: object,
                    boundsRadius: radius
                });
                console.log(`[KGreeblePhysics] Added body ${bodyId}`);
            }
            return bodyId;
        } catch (e) {
            console.error('[KGreeblePhysics] Failed to add body:', e);
            return null;
        }
    }

    /**
     * Add all scene objects as physics bodies
     */
    async addSceneObjects(rootGroup: THREE.Group, dropHeight: number = 0): Promise<void> {
        const meshes: THREE.Object3D[] = [];

        rootGroup.traverse((child) => {
            // Get containers (our spawned objects are wrapped in groups)
            if (child.userData?.isContainer && child.visible) {
                meshes.push(child);
            }
        });

        if (meshes.length === 0) {
            // Fallback: get any meshes
            rootGroup.traverse((child) => {
                if (child instanceof THREE.Mesh && child.visible && !child.userData?.isGround) {
                    meshes.push(child);
                }
            });
        }

        this.onStatusChange?.(`Adding ${meshes.length} physics bodies...`);

        for (const mesh of meshes) {
            if (dropHeight > 0) {
                mesh.position.y += dropHeight;
            }
            await this.addDynamicBody(mesh);
        }

        this.onStatusChange?.(`⚡ ${meshes.length} BODIES ACTIVE`);
    }

    /**
     * Step the physics simulation and update Three.js objects
     */
    async step(): Promise<void> {
        if (!this.worldId) return;
        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            const bodies: BodyState[] = await invoke('step_physics', { worldId: this.worldId });

            // Update Three.js object positions
            for (const body of bodies) {
                const mapping = this.bodyMappings.get(body.id);
                if (mapping) {
                    const obj = mapping.object3D;

                    if (obj.parent) {
                        const worldPos = new THREE.Vector3(body.position[0], body.position[1], body.position[2]);
                        const localPos = obj.parent.worldToLocal(worldPos);
                        obj.position.copy(localPos);
                    } else {
                        obj.position.set(body.position[0], body.position[1], body.position[2]);
                    }
                }
            }

            this.onUpdate?.(bodies);
        } catch (e) {
            console.error('[KGreeblePhysics] Step failed:', e);
        }
    }

    /**
     * Start continuous simulation loop
     */
    startLoop(fps: number = 60): void {
        if (this.animationId !== null) return;

        const stepTime = 1000 / fps;
        let lastTime = performance.now();

        const loop = async () => {
            const now = performance.now();
            if (now - lastTime >= stepTime) {
                await this.step();
                lastTime = now;
            }
            this.animationId = requestAnimationFrame(loop);
        };

        this.animationId = requestAnimationFrame(loop);
        this.onStatusChange?.('▶ SIMULATION RUNNING');
    }

    /**
     * Stop simulation loop
     */
    stopLoop(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            this.onStatusChange?.('⏸ SIMULATION PAUSED');
        }
    }

    /**
     * Drop an object from a height
     */
    async dropFromHeight(object: THREE.Object3D, height: number = 10): Promise<void> {
        object.position.y += height;
        await this.addDynamicBody(object);
    }

    /**
     * Drop all selected objects from sky
     */
    async dropSelected(objects: THREE.Object3D[], height: number = 10): Promise<void> {
        for (const obj of objects) {
            await this.dropFromHeight(obj, height);
        }
        this.onStatusChange?.(`🪂 DROPPED ${objects.length} OBJECTS`);
    }

    /**
     * Bake simulation to keyframes
     */
    async bakeToKeyframes(duration: number, fps: number = 60): Promise<Record<string, any[]>> {
        const keyframes: Record<string, any[]> = {};
        const steps = Math.floor(duration * fps);
        const dt = duration / steps;

        this.onStatusChange?.('⏺ BAKING PHYSICS...');

        // Initialize keyframe arrays
        for (const mapping of Array.from(this.bodyMappings.values())) {
            keyframes[mapping.object3D.uuid] = [];
        }

        // Run simulation and capture keyframes
        for (let i = 0; i <= steps; i++) {
            const t = i * dt;
            await this.step();

            for (const mapping of Array.from(this.bodyMappings.values())) {
                const obj = mapping.object3D;
                keyframes[obj.uuid]?.push({
                    t,
                    p: obj.position.clone(),
                    q: obj.quaternion.clone(),
                    s: obj.scale.clone()
                });
            }
        }

        this.onStatusChange?.(`✓ BAKED ${steps} FRAMES`);
        return keyframes;
    }

    /**
     * Reset physics world
     */
    async reset(): Promise<void> {
        if (this.worldId) {
            const invoke = await getInvoke();
            if (invoke) {
                try {
                    await invoke('dispose_physics_world', { worldId: this.worldId });
                } catch (e) {
                    console.warn('[KGreeblePhysics] Dispose failed:', e);
                }
            }
        }
        this.bodyMappings.clear();
        this.groundMeshId = null;
        this.worldId = null;
        this.stopLoop();
    }

    /**
     * Check if physics is active
     */
    isPhysicsActive(): boolean {
        return this.isActive && this.worldId !== null;
    }

    /**
     * Set callbacks
     */
    setCallbacks(onUpdate?: (bodies: BodyState[]) => void, onStatus?: (status: string) => void): void {
        this.onUpdate = onUpdate;
        this.onStatusChange = onStatus;
    }

    /**
     * Get body count
     */
    getBodyCount(): number {
        return this.bodyMappings.size;
    }

    /**
     * Is simulation loop running
     */
    isRunning(): boolean {
        return this.animationId !== null;
    }
}

// Singleton for easy access
export const greeblePhysics = new KGreeblePhysicsEngine();

export default KGreeblePhysicsEngine;
