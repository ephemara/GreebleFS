/**
 * Fast JavaScript PBR Generator
 * Adapted from K_OS AutoPBR Engine
 * Faster than WASM due to zero serialization overhead!
 */
export interface FastPbrParams {
    normalStrength: number;
    roughnessBase: number;
    roughnessContrast: number;
    roughnessInvert: boolean;
    metallicBase: number;
    metalContrast: number;
    edgeWear: number;
    cavityDirt: number;
    dust: number;
    grunge: number;
    aoIntensity: number;
    heightContrast: number;
    makeSeamless: boolean;
}
export interface FastPbrResult {
    base: string;
    normal: string;
    roughness: string;
    metallic: string;
    ao: string;
    height: string;
}
/**
 * Generate all PBR maps from an image (FAST!)
 */
export declare function generatePbrMapsFast(img: HTMLImageElement, params: FastPbrParams): Promise<FastPbrResult>;
/**
 * Convert legacy params to fast PBR params
 */
export declare function convertToFastParams(legacyParams: any): FastPbrParams;
