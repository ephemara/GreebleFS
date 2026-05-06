// Type declarations for WASM modules

declare module '../wasm/k_greeble_wasm.js' {
    export default function init(): Promise<any>;
    export class NoiseGenerator {
        static new(): NoiseGenerator;
        fill_noise_buffer(positions: Float32Array, output: Float32Array, scale: number, time: number): void;
    }
}

declare module '../features/greeble/pkg/k_greeble_wasm' {
    export default function init(): Promise<any>;
    export class NoiseGenerator {
        static new(): NoiseGenerator;
        fill_noise_buffer(positions: Float32Array, output: Float32Array, scale: number, time: number): void;
    }
}
