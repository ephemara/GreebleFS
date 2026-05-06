export declare const getGreeble3DWasmInterface: () => any;
export declare const initWasm: () => Promise<void>;
export declare const getNoiseGenerator: () => any;
export declare const fillNoiseBuffer: (positions: Float32Array, output: Float32Array, scale: number, time: number) => boolean;
export declare const createSupershapeWasm: (params: any) => any;
export declare const subdivideGeometryWasm: (positions: Float32Array, indices: Uint32Array | Uint16Array, params: {
    point_x: number;
    point_y: number;
    point_z: number;
    radius: number;
    max_edge_length: number;
}) => any;
export declare const ensureSymmetryWasm: (positions: Float32Array, indices: Uint32Array | Uint16Array, params: {
    tolerance: number;
    x: boolean;
    y: boolean;
    z: boolean;
}) => any;
