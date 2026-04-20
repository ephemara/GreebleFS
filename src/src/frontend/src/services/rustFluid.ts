/**
 * rustFluid.ts
 * 
 * TypeScript bindings for K_OS Rust SPH Fluid Simulation (salva3d).
 * UV-space fluid dynamics for realistic paint effects.
 */

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
            console.warn('[rustFluid] Failed to import Tauri API:', e);
        }
    }
    return null;
};

// ============================================================================
// TYPES
// ============================================================================

export interface FluidState {
    positions: [number, number][];
    velocities: [number, number][];
    particle_count: number;
}

export interface FluidConfig {
    gravity: number;
    particleRadius: number;
}

// ============================================================================
// UV-SPACE FLUID SIMULATION API
// ============================================================================

export class RustFluidSim {
    private simId: number | null = null;
    private config: FluidConfig;
    private velocityGrid: Float32Array | null = null;
    private gridResolution: number = 512;

    constructor(config: Partial<FluidConfig> = {}) {
        this.config = {
            gravity: config.gravity ?? -0.5, // Gentle gravity for UV space (0-1 range)
            particleRadius: config.particleRadius ?? 0.005, // Small for UV space
        };
    }

    /**
     * Initialize the Rust fluid simulation
     */
    async init(): Promise<boolean> {
        const invoke = await getInvoke();
        if (!invoke) {
            console.warn('[rustFluid] Tauri not available - fluid sim disabled');
            return false;
        }

        try {
            this.simId = await invoke('create_fluid_sim', {
                gravityY: this.config.gravity,
                particleRadius: this.config.particleRadius,
            });
            console.log(`[rustFluid] Initialized UV-space simulation ${this.simId}`);
            return true;
        } catch (e) {
            console.error('[rustFluid] Failed to create simulation:', e);
            return false;
        }
    }

    /**
     * Spawn particles at UV position (from brush stroke)
     */
    async spawnAtUV(uv: [number, number], velocity: [number, number], count: number = 50): Promise<void> {
        if (this.simId === null) return;

        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('spawn_fluid_at_uv', {
                simId: this.simId,
                uv,
                velocity,
                count,
            });
        } catch (e) {
            console.error('[rustFluid] Failed to spawn particles:', e);
        }
    }

    /**
     * Step the simulation
     */
    async step(dt: number = 0.016): Promise<FluidState | null> {
        if (this.simId === null) return null;

        const invoke = await getInvoke();
        if (!invoke) return null;

        try {
            const state: FluidState = await invoke('step_fluid_sim', {
                simId: this.simId,
                dt,
            });
            return state;
        } catch (e) {
            console.error('[rustFluid] Step failed:', e);
            return null;
        }
    }

    /**
     * Get velocity grid for GPU texture upload
     * Returns Float32Array of [vx, vy, vx, vy, ...] in row-major order
     */
    async getVelocityGrid(resolution: number = 512): Promise<Float32Array | null> {
        if (this.simId === null) return null;

        const invoke = await getInvoke();
        if (!invoke) return null;

        try {
            const grid: number[] = await invoke('get_velocity_grid', {
                simId: this.simId,
                resolution,
            });
            this.velocityGrid = new Float32Array(grid);
            this.gridResolution = resolution;
            return this.velocityGrid;
        } catch (e) {
            console.error('[rustFluid] Get velocity grid failed:', e);
            return null;
        }
    }

    /**
     * Apply force at UV position (from brush)
     */
    async applyForce(uv: [number, number], force: [number, number], radius: number): Promise<void> {
        if (this.simId === null) return;

        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('apply_fluid_force', {
                simId: this.simId,
                uv,
                force,
                radius,
            });
        } catch (e) {
            console.error('[rustFluid] Apply force failed:', e);
        }
    }

    /**
     * Apply vortex effect (swirling)
     */
    async applyVortex(uv: [number, number], strength: number, radius: number): Promise<void> {
        if (this.simId === null) return;

        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('apply_fluid_vortex', {
                simId: this.simId,
                uv,
                strength,
                radius,
            });
        } catch (e) {
            console.error('[rustFluid] Apply vortex failed:', e);
        }
    }

    /**
     * Apply black hole effect (Kerr metric!)
     */
    async applyBlackHole(uv: [number, number], strength: number, spin: number, radius: number): Promise<void> {
        if (this.simId === null) return;

        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('apply_fluid_black_hole', {
                simId: this.simId,
                uv,
                strength,
                spin,
                radius,
            });
        } catch (e) {
            console.error('[rustFluid] Apply black hole failed:', e);
        }
    }

    /**
     * Clear simulation particles
     */
    async clear(): Promise<void> {
        if (this.simId === null) return;

        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('clear_fluid_sim', { simId: this.simId });
        } catch (e) {
            console.error('[rustFluid] Clear failed:', e);
        }
    }

    /**
     * Dispose the simulation
     */
    async dispose(): Promise<void> {
        if (this.simId === null) return;

        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('dispose_fluid_sim', { simId: this.simId });
            console.log(`[rustFluid] Disposed simulation ${this.simId}`);
            this.simId = null;
        } catch (e) {
            console.error('[rustFluid] Dispose failed:', e);
        }
    }

    /**
     * Check if simulation is active
     */
    isActive(): boolean {
        return this.simId !== null;
    }

    /**
     * Get cached velocity grid
     */
    getCachedVelocityGrid(): Float32Array | null {
        return this.velocityGrid;
    }

    /**
     * Get grid resolution
     */
    getGridResolution(): number {
        return this.gridResolution;
    }
}

// ============================================================================
// PHYSICS WORLD (Rapier3D) - For KGreeble rigid body physics
// ============================================================================

export class RustPhysicsWorld {
    private worldId: number | null = null;
    private active: boolean = false;

    async init(gravity: number = -9.81): Promise<boolean> {
        const invoke = await getInvoke();
        if (!invoke) {
            console.warn('[RustPhysics] Tauri not available');
            return false;
        }

        try {
            this.worldId = await invoke('create_physics_world', { gravityY: gravity });
            this.active = true;
            console.log(`[RustPhysics] Created world ${this.worldId}`);
            return true;
        } catch (e) {
            console.error('[RustPhysics] Failed to create world:', e);
            return false;
        }
    }

    async addBody(position: [number, number, number], radius: number): Promise<number | null> {
        if (!this.active || this.worldId === null) return null;
        const invoke = await getInvoke();
        if (!invoke) return null;

        try {
            return await invoke('add_physics_body', {
                worldId: this.worldId,
                position,
                radius,
            });
        } catch (e) {
            console.error('[RustPhysics] Failed to add body:', e);
            return null;
        }
    }

    async addMesh(vertices: [number, number, number][], indices: [number, number, number][]): Promise<number | null> {
        if (!this.active || this.worldId === null) return null;
        const invoke = await getInvoke();
        if (!invoke) return null;

        try {
            return await invoke('add_physics_mesh', {
                worldId: this.worldId,
                vertices,
                indices,
            });
        } catch (e) {
            console.error('[RustPhysics] Failed to add mesh:', e);
            return null;
        }
    }

    async step(): Promise<Array<{ id: number; position: [number, number, number] }>> {
        if (!this.active || this.worldId === null) return [];
        const invoke = await getInvoke();
        if (!invoke) return [];

        try {
            return await invoke('step_physics', { worldId: this.worldId });
        } catch (e) {
            console.error('[RustPhysics] Step failed:', e);
            return [];
        }
    }

    async applyBlackHoleGravity(center: [number, number, number], strength: number, radius: number): Promise<void> {
        if (!this.active || this.worldId === null) return;
        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('apply_black_hole_gravity', {
                worldId: this.worldId,
                center,
                strength,
                radius,
            });
        } catch (e) {
            console.error('[RustPhysics] Black hole failed:', e);
        }
    }

    async dispose(): Promise<void> {
        if (this.worldId === null) return;
        const invoke = await getInvoke();
        if (!invoke) return;

        try {
            await invoke('dispose_physics_world', { worldId: this.worldId });
            this.worldId = null;
            this.active = false;
        } catch (e) {
            console.error('[RustPhysics] Dispose failed:', e);
        }
    }

    isActive(): boolean {
        return this.active;
    }
}

// Singleton export for easy access
export const rustFluid = new RustFluidSim();

export default { RustFluidSim, RustPhysicsWorld, rustFluid };
