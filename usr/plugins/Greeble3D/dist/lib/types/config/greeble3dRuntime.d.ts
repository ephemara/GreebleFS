import manifest from '../../Greeble3D.manifest.json';
type Greeble3DManifest = typeof manifest;
export declare const greeble3dRuntimeConfig: Greeble3DManifest;
export declare const getGreeble3DWasmGlobalKey: () => string;
export declare const getGreeble3DWasmReadyEventName: () => string;
export declare const getGreeble3DWasmFromWindow: () => any;
export {};
