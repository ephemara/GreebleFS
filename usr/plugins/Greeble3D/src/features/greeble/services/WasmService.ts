import init, { NoiseGenerator } from '../pkg/k_greeble_wasm';
import {
    getGreeble3DWasmFromWindow,
    getGreeble3DWasmGlobalKey,
    getGreeble3DWasmReadyEventName,
} from '../../../config/greeble3dRuntime';

// Force reload timestamp: 2026-01-31
let isInitialized = false;
let noiseGenerator: any = null;

export const getGreeble3DWasmInterface = () => getGreeble3DWasmFromWindow();

export const initWasm = async () => {
    if (isInitialized) return;
    try {
        const wasm = await init();
        noiseGenerator = NoiseGenerator.new();
        
        // Create a mutable interface object by spreading the wasm exports
        // The raw wasm object from init() is not extensible
        const wasmInterface = { 
            ...wasm,
            noiseGeneratorInstance: noiseGenerator
        };
        
        // Expose to window using the portable runtime key
        (window as unknown as Record<string, unknown>)[getGreeble3DWasmGlobalKey()] = wasmInterface;
        
        isInitialized = true;
        
        window.dispatchEvent(new CustomEvent(getGreeble3DWasmReadyEventName()));
        console.log("Greeble WASM Initialized");
    } catch (e) {
        console.error("Failed to initialize Greeble WASM", e);
    }
};

export const getNoiseGenerator = () => noiseGenerator;

export const fillNoiseBuffer = (positions: Float32Array, output: Float32Array, scale: number, time: number) => {
    if (!noiseGenerator) return false;
    noiseGenerator.fill_noise_buffer(positions, output, scale, time);
    return true;
};

export const createSupershapeWasm = (params: any) => {
    const wasm = getGreeble3DWasmInterface();
    if (wasm && wasm.create_supershape_wasm) {
        return wasm.create_supershape_wasm(params);
    }
    // console.warn("WASM create_supershape_wasm not available, falling back to JS");
    return null;
};

export const subdivideGeometryWasm = (
    positions: Float32Array, 
    indices: Uint32Array | Uint16Array, 
    params: { point_x: number, point_y: number, point_z: number, radius: number, max_edge_length: number }
) => {
    const wasm = getGreeble3DWasmInterface();
    if (wasm && wasm.subdivide_geometry_wasm) {
        return wasm.subdivide_geometry_wasm(positions, indices, params);
    }
    return null;
};

export const ensureSymmetryWasm = (
    positions: Float32Array,
    indices: Uint32Array | Uint16Array,
    params: { tolerance: number, x: boolean, y: boolean, z: boolean }
) => {
    const wasm = getGreeble3DWasmInterface();
    if (wasm && wasm.ensure_symmetry_wasm) {
        return wasm.ensure_symmetry_wasm(positions, indices, params);
    }
    return null;
};
