/**
 * K_OS Python Bridge - TypeScript Client
 * =======================================
 * Easy access to Python sidecar from React/JS.
 * 
 * Usage:
 *   import { python } from './services/pythonBridge';
 *   
 *   // Start Python
 *   await python.start();
 *   
 *   // Call a registered function
 *   const result = await python.call('mesh.decimate', { vertices, faces, target_faces: 1000 });
 *   
 *   // Run a user script
 *   await python.runScript('my_script', 'main', { param1: 'value' });
 *   
 *   // Execute raw Python code
 *   const result = await python.exec('import numpy as np; result = np.array([1,2,3]).sum()');
 */

import { invoke } from '@tauri-apps/api/core';

class PythonBridge {
    private started = false;

    /**
     * Start the Python sidecar process
     */
    async start(): Promise<string> {
        const result = await invoke<string>('python_start');
        this.started = true;
        console.log('[Python] Started:', result);
        return result;
    }

    /**
     * Stop the Python sidecar
     */
    async stop(): Promise<string> {
        const result = await invoke<string>('python_stop');
        this.started = false;
        console.log('[Python] Stopped:', result);
        return result;
    }

    /**
     * Check if Python is ready
     */
    async ping(): Promise<string> {
        return invoke<string>('python_ping');
    }

    /**
     * List all available Python functions
     */
    async listFunctions(): Promise<string[]> {
        return invoke<string[]>('python_list_functions');
    }

    /**
     * Call a registered Python function
     * @param method - Function name (e.g., 'mesh.decimate', 'ml.segment_image')
     * @param params - Function parameters as object
     */
    async call<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
        if (!this.started) {
            await this.start();
        }
        return invoke<T>('python_call', { method, params });
    }

    /**
     * Execute arbitrary Python code
     * @param code - Python code string
     * @returns The value of 'result' variable or expression result
     */
    async exec<T = any>(code: string): Promise<T> {
        if (!this.started) {
            await this.start();
        }
        return invoke<T>('python_exec', { code });
    }

    /**
     * Run a user script from src-python/kos/scripts/
     * @param scriptName - Script filename without .py
     * @param functionName - Function to call (default: 'main')
     * @param kwargs - Keyword arguments to pass
     */
    async runScript<T = any>(
        scriptName: string,
        functionName = 'main',
        kwargs: Record<string, any> = {}
    ): Promise<T> {
        if (!this.started) {
            await this.start();
        }
        return invoke<T>('python_run_script', {
            scriptName,
            function: functionName,
            kwargs
        });
    }

    /**
     * Hot-reload a script (use after editing the file)
     */
    async reloadScript(scriptName: string): Promise<string> {
        return invoke<string>('python_reload_script', { scriptName });
    }

    // ========= CONVENIENCE METHODS =========

    /**
     * Generate Perlin noise texture
     */
    async generateNoise(
        width: number,
        height: number,
        scale = 50,
        octaves = 4,
        seed?: number
    ) {
        return this.call<{ data: number[][]; width: number; height: number }>(
            'procedural.perlin_2d',
            { width, height, scale, octaves, seed }
        );
    }

    /**
     * Decimate a mesh to target face count
     */
    async decimateMesh(
        vertices: number[][],
        faces: number[][],
        targetFaces: number
    ) {
        return this.call<{ vertices: number[][]; faces: number[][] }>(
            'mesh.decimate',
            { vertices, faces, target_faces: targetFaces }
        );
    }

    /**
     * Generate normal map from heightmap
     */
    async generateNormalMap(heightmap: number[][], strength = 1.0) {
        return this.call<{ data: number[][][]; width: number; height: number }>(
            'texture.generate_normal_map',
            { heightmap, strength }
        );
    }

    /**
     * Estimate depth from an image
     */
    async estimateDepth(imageData: number[], width: number, height: number) {
        return this.call<{ depth_data: number[][]; width: number; height: number }>(
            'ml.depth_estimation',
            { image_data: imageData, width, height }
        );
    }

    /**
     * Generate terrain heightmap with erosion
     */
    async generateTerrain(
        width: number,
        height: number,
        seaLevel = 0.3,
        mountainScale = 1.0,
        seed?: number
    ) {
        return this.call<{
            heightmap: number[][];
            biome_map: number[][];
            width: number;
            height: number;
            biome_legend: string[];
        }>('procedural.terrain', {
            width,
            height,
            sea_level: seaLevel,
            mountain_scale: mountainScale,
            seed
        });
    }

    /**
     * Scatter points using Poisson disc distribution
     */
    async scatterPoints(width: number, height: number, minDistance = 10, seed?: number) {
        return this.call<{
            points: number[][];
            count: number;
            width: number;
            height: number;
        }>('procedural.scatter_points', {
            width,
            height,
            min_distance: minDistance,
            seed
        });
    }
}

// Singleton instance
export const python = new PythonBridge();

// Also export the class for testing
export { PythonBridge };
