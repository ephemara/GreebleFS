/**
 * Fast JavaScript PBR Generator
 * Adapted from K_OS AutoPBR Engine
 * Faster than WASM due to zero serialization overhead!
 */

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

// Shared canvas for performance
const sharedCanvas = document.createElement('canvas');
const sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });

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
 * Process image to generate a specific PBR map type
 */
function processMap(
    img: HTMLImageElement,
    type: 'base' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'height',
    params: FastPbrParams
): string | null {
    if (!sharedCtx) return null;
    
    const canvas = sharedCanvas;
    const ctx = sharedCtx;
    
    const MAX_SIZE = 2048;
    let w = img.width;
    let h = img.height;
    
    if (w > MAX_SIZE || h > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
    }
    
    canvas.width = w;
    canvas.height = h;
    
    // Base render with seamless option
    if (params.makeSeamless && type === 'base') {
        ctx.drawImage(img, 0, 0, w, h);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.drawImage(img, w / 2, -h / 2, w, h);
        ctx.drawImage(img, -w / 2, h / 2, w, h);
        ctx.drawImage(img, w / 2, h / 2, w, h);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.drawImage(img, 0, 0, w, h);
    }
    
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outputData = ctx.createImageData(w, h);
    const out = outputData.data;
    
    // Convert to grayscale buffer
    const grayBuffer = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        grayBuffer[i] = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    }
    
    const getIdx = (x: number, y: number) => {
        const cx = Math.max(0, Math.min(w - 1, x));
        const cy = Math.max(0, Math.min(h - 1, y));
        return cy * w + cx;
    };
    
    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % w;
        const y = Math.floor(pixelIndex / w);
        
        const baseLum = grayBuffer[pixelIndex];
        
        // Calculate edge magnitude (Sobel)
        const tl = grayBuffer[getIdx(x - 1, y - 1)];
        const t = grayBuffer[getIdx(x, y - 1)];
        const tr = grayBuffer[getIdx(x + 1, y - 1)];
        const l = grayBuffer[getIdx(x - 1, y)];
        const r = grayBuffer[getIdx(x + 1, y)];
        const bl = grayBuffer[getIdx(x - 1, y + 1)];
        const b = grayBuffer[getIdx(x, y + 1)];
        const br = grayBuffer[getIdx(x + 1, y + 1)];
        
        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
        const edgeMag = Math.sqrt(dX * dX + dY * dY);
        
        if (type === 'base') {
            out[i] = data[i];
            out[i + 1] = data[i + 1];
            out[i + 2] = data[i + 2];
            out[i + 3] = 255;
        }
        else if (type === 'normal') {
            const dZ = 1.0 / Math.max(0.001, params.normalStrength);
            const len = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
            out[i] = ((dX / len) * 0.5 + 0.5) * 255;
            out[i + 1] = ((dY / len) * 0.5 + 0.5) * 255;
            out[i + 2] = ((dZ / len) * 0.5 + 0.5) * 255;
            out[i + 3] = 255;
        }
        else if (type === 'roughness') {
            const baseRough = params.roughnessBase * 255;
            let val = baseRough + (baseLum - 128) * params.roughnessContrast * 0.3;
            
            if (params.roughnessInvert) val = 255 - val;
            
            // Dust makes things rougher
            if (params.dust > 0) {
                const dustNoise = Math.random() * 0.5 + 0.5;
                val = lerp(val, 255, params.dust * dustNoise);
            }
            
            // Edge wear makes edges shinier (less rough)
            if (params.edgeWear > 0 && edgeMag > (255 - params.edgeWear * 200)) {
                val = lerp(val, 0, 0.5);
            }
            
            // Cavity dirt makes cavities rougher
            if (params.cavityDirt > 0 && edgeMag > (255 - params.cavityDirt * 200)) {
                val = lerp(val, 255, 0.5);
            }
            
            val = clamp(val, 0, 255);
            out[i] = val;
            out[i + 1] = val;
            out[i + 2] = val;
            out[i + 3] = 255;
        }
        else if (type === 'metallic') {
            const baseMetal = params.metallicBase * 255;
            let val = baseMetal + (baseLum - 128) * params.metalContrast * 0.2;
            
            // Edge wear exposes metal (white)
            if (params.edgeWear > 0 && edgeMag > (255 - params.edgeWear * 200)) {
                val = lerp(val, 255, 0.7);
            }
            
            // Cavity dirt covers metal (black)
            if (params.cavityDirt > 0 && edgeMag > (255 - params.cavityDirt * 200)) {
                val = lerp(val, 0, 0.7);
            }
            
            // Grunge covers metal
            if (params.grunge > 0) {
                val = lerp(val, 0, Math.random() * params.grunge);
            }
            
            val = clamp(val, 0, 255);
            out[i] = val;
            out[i + 1] = val;
            out[i + 2] = val;
            out[i + 3] = 255;
        }
        else if (type === 'ao') {
            // Simple AO approximation from luminance
            let val = (baseLum * params.aoIntensity) + (255 * (1 - params.aoIntensity));
            
            if (params.grunge > 0) {
                val -= Math.random() * params.grunge * 50;
            }
            
            val = clamp(val, 0, 255);
            out[i] = val;
            out[i + 1] = val;
            out[i + 2] = val;
            out[i + 3] = 255;
        }
        else if (type === 'height') {
            let val = (baseLum - 128) * params.heightContrast + 128;
            val = clamp(val, 0, 255);
            out[i] = val;
            out[i + 1] = val;
            out[i + 2] = val;
            out[i + 3] = 255;
        }
    }
    
    ctx.putImageData(outputData, 0, 0);
    return canvas.toDataURL('image/png');
}

/**
 * Generate all PBR maps from an image (FAST!)
 */
export async function generatePbrMapsFast(
    img: HTMLImageElement,
    params: FastPbrParams
): Promise<FastPbrResult> {
    const base = processMap(img, 'base', params) || '';
    const normal = processMap(img, 'normal', params) || '';
    const roughness = processMap(img, 'roughness', params) || '';
    const metallic = processMap(img, 'metallic', params) || '';
    const ao = processMap(img, 'ao', params) || '';
    const height = processMap(img, 'height', params) || '';
    
    return { base, normal, roughness, metallic, ao, height };
}

/**
 * Convert legacy params to fast PBR params
 */
export function convertToFastParams(legacyParams: any): FastPbrParams {
    return {
        normalStrength: legacyParams.normalStrength || 1.0,
        roughnessBase: 0.5,
        roughnessContrast: legacyParams.roughnessContrast || 1.0,
        roughnessInvert: legacyParams.roughnessInvert || false,
        metallicBase: (legacyParams.metalBias || 0) / 100.0,
        metalContrast: legacyParams.metalContrast || 1.0,
        edgeWear: legacyParams.wear || 0.0,
        cavityDirt: 0.0,
        dust: 0.0,
        grunge: legacyParams.wear || 0.0,
        aoIntensity: legacyParams.aoIntensity || 0.8,
        heightContrast: 1.0,
        makeSeamless: legacyParams.makeSeamless || false,
    };
}
