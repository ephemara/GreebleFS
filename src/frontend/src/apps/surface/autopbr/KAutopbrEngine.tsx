
// --- CONSTANTS ---
const apiKey = process.env.API_KEY;

// --- UTILS ---
export const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;
export const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

// --- SHARED CANVAS (For Performance) ---
const sharedCanvas = document.createElement('canvas');
const sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });

// --- KIPP FLUX ENGINE v2.0 ---
export const processImage = (img: HTMLImageElement, decalImg: HTMLImageElement | null, type: string, params: any) => {
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

    // 1. Base Render & Seamless
    if (params.makeSeamless) {
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

    // 2. Decal Scattering (Pre-Processing)
    if (decalImg && params.decalCount > 0) {
        const count = Math.floor(params.decalCount * 20);
        for (let i = 0; i < count; i++) {
            const dx = Math.random() * w;
            const dy = Math.random() * h;
            const scale = (Math.random() * 0.5 + 0.5) * params.decalScale;
            const dw = decalImg.width * scale;
            const dh = decalImg.height * scale;
            const rot = Math.random() * Math.PI * 2;

            ctx.save();
            ctx.translate(dx, dy);
            ctx.rotate(rot);
            ctx.globalAlpha = params.decalOpacity;
            ctx.drawImage(decalImg, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
    }

    // 3. PIXELATE EFFECT (Pre-Pass)
    if (params.pixelate > 0.01) {
        // Scale down then up
        const factor = 1.0 - (params.pixelate * 0.98); // Min 2% resolution
        const sw = Math.max(1, Math.floor(w * factor));
        const sh = Math.max(1, Math.floor(h * factor));

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sw;
        tempCanvas.height = sh;
        const tCtx = tempCanvas.getContext('2d');
        if (tCtx) {
            tCtx.drawImage(canvas, 0, 0, sw, sh);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(tempCanvas, 0, 0, sw, sh, 0, 0, w, h);
            ctx.imageSmoothingEnabled = true;
        }
    }

    // 4. BLUR EFFECT
    if (params.blur > 0) {
        ctx.filter = `blur(${params.blur * 10}px)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
    }

    // 5. SHARPEN EFFECT (Convolution)
    if (params.sharpen > 0) {
        // Simple unsharp mask approximation via composite
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w; tempCanvas.height = h;
        const tCtx = tempCanvas.getContext('2d');
        if (tCtx) {
            tCtx.filter = 'blur(2px)';
            tCtx.drawImage(canvas, 0, 0);
            ctx.globalCompositeOperation = 'overlay';
            ctx.globalAlpha = params.sharpen;
            ctx.drawImage(canvas, 0, 0); // Boost contrast
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // 6. INVERT
    if (params.invert) {
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
    }

    // 7. BRIGHTNESS / CONTRAST / GAMMA
    if (params.brightness !== 1.0 || params.contrast !== 1.0) {
        ctx.filter = `brightness(${params.brightness}) contrast(${params.contrast})`;
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
    }

    // 8. VIGNETTE
    if (params.vignette > 0) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, Math.max(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${params.vignette})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outputData = ctx.createImageData(w, h);
    const out = outputData.data;

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

    const getPixel = (idx: number) => {
        const i = Math.max(0, Math.min(data.length - 4, idx * 4));
        return [data[i], data[i + 1], data[i + 2]];
    };

    for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % w;
        const y = Math.floor(pixelIndex / w);

        // --- FLUX: CHROMATIC ABERRATION ---
        let r, g, b;
        if (type === 'base' && params.chromatic > 0) {
            const offset = Math.floor(params.chromatic * 20); // Max 20px shift
            const rIdx = getIdx(x - offset, y);
            const bIdx = getIdx(x + offset, y);
            const rPx = getPixel(rIdx);
            const bPx = getPixel(bIdx);
            r = rPx[0];
            g = data[i + 1]; // Green stays center
            b = bPx[2];
        } else {
            r = data[i];
            g = data[i + 1];
            b = data[i + 2];
        }

        const baseLum = grayBuffer[pixelIndex];

        const cx = Math.floor(x * params.cyberScale);
        const cy = Math.floor(y * params.cyberScale);
        const cyberNoise = ((cx ^ cy) % 13) === 0 ? 1.0 : 0.0;

        const bioNoise = (Math.sin(x * params.bioFreq * 0.1) * Math.cos(y * params.bioFreq * 0.1)) * 0.5 + 0.5;
        const scratchNoise = Math.random() > (1.0 - params.scratches * 0.1) ? 1.0 : 0.0;
        const dustNoise = (Math.random() * 0.5 + 0.5);

        const tl = grayBuffer[getIdx(x - 1, y - 1)];
        const t = grayBuffer[getIdx(x, y - 1)];
        const tr = grayBuffer[getIdx(x + 1, y - 1)];
        const l = grayBuffer[getIdx(x - 1, y)];
        const bl = grayBuffer[getIdx(x - 1, y + 1)];
        const b_ = grayBuffer[getIdx(x, y + 1)];
        const br = grayBuffer[getIdx(x + 1, y + 1)];

        const dX = (tr + 2 * grayBuffer[getIdx(x + 1, y)] + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b_ + br) - (tl + 2 * t + tr);
        const edgeMag = Math.sqrt(dX * dX + dY * dY);

        if (type === 'base') {
            if (params.hue !== 0) {
                const hueVal = params.hue % 360;
                // Simple channel shifting approximation for hue rotation
                if (hueVal < 90) { /* keep */ }
                else if (hueVal < 180) { const temp = r; r = g; g = temp; }
                else if (hueVal < 270) { const temp = g; g = b; b = temp; }
                else { const temp = r; r = b; b = temp; }
            }

            // --- FLUX: SIGNAL NOISE ---
            if (params.noise > 0) {
                const noise = (Math.random() - 0.5) * params.noise * 100;
                r += noise; g += noise; b += noise;
            }

            // --- FLUX: GAMMA CORRECTION ---
            if (params.gamma && params.gamma !== 1.0) {
                r = 255 * Math.pow(r / 255, 1 / params.gamma);
                g = 255 * Math.pow(g / 255, 1 / params.gamma);
                b = 255 * Math.pow(b / 255, 1 / params.gamma);
            }

            // --- FLUX: SCANLINES ---
            if (params.scanlines > 0) {
                if (y % 4 === 0) {
                    const dark = 1.0 - (params.scanlines * 0.5);
                    r *= dark; g *= dark; b *= dark;
                }
            }

            if (params.dust > 0) {
                const dustFactor = dustNoise * params.dust;
                r = lerp(r, 220, dustFactor);
                g = lerp(g, 215, dustFactor);
                b = lerp(b, 200, dustFactor);
            }
            if (params.grunge > 0) {
                const grungeFactor = Math.random() * params.grunge;
                r = lerp(r, 30, grungeFactor);
                g = lerp(g, 20, grungeFactor);
                b = lerp(b, 10, grungeFactor);
            }
            if (cyberNoise > 0.5 && params.cyberDetail > 0) {
                const etch = params.cyberDetail * 100;
                r += etch; g += etch * 2; b += etch * 2;
            }
            out[i] = clamp(r, 0, 255);
            out[i + 1] = clamp(g, 0, 255);
            out[i + 2] = clamp(b, 0, 255);
            out[i + 3] = 255;
        }
        else if (type === 'normal') {
            const dZ = 1.0 / Math.max(0.001, params.normalStrength);
            const scratchX = (Math.random() - 0.5) * params.scratches * 100;
            const scratchY = (Math.random() - 0.5) * params.scratches * 100;
            const cyberX = (cyberNoise > 0.5 && params.cyberDetail > 0) ? 50 * params.cyberDetail : 0;
            const vX = dX + scratchX + cyberX;
            const vY = dY + scratchY + cyberX;
            const len = Math.sqrt(vX * vX + vY * vY + dZ * dZ);
            out[i] = ((vX / len) * 0.5 + 0.5) * 255;
            out[i + 1] = ((vY / len) * 0.5 + 0.5) * 255;
            out[i + 2] = ((dZ / len) * 0.5 + 0.5) * 255;
            out[i + 3] = 255;
        }
        else if (type === 'emissive') {
            // STRICT EMISSIVE LOGIC
            const threshold = 255 * (1.0 - params.emissiveThreshold);
            if (params.emissiveThreshold > 0.01 && baseLum > threshold) {
                out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
            } else if (params.emissiveThreshold > 0.01 && cyberNoise > 0.5 && params.cyberDetail > 0.2) {
                // Cyber glow
                out[i] = 0; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = 255;
            } else {
                // CLEAN BLACK if inactive or below threshold
                out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 255;
            }
        }
        else {
            let val = baseLum;
            if (type === 'roughness') {
                // NEW: Start from roughnessBase, then apply contrast/brightness adjustments
                const baseRough = (params.roughnessBase ?? 0.7) * 255;
                val = baseRough + (baseLum - 128) * params.roughnessContrast * 0.3 + params.roughnessBrightness;
                if (params.roughnessInvert) val = 255 - val;
                if (params.dust > 0) val = lerp(val, 255, params.dust * dustNoise);
                if (params.bioDetail > 0) val = lerp(val, 255, bioNoise * params.bioDetail);

                // Edge Wear (Lightens edges - makes them shinier)
                if (params.edgeWear > 0 && edgeMag > (255 - params.edgeWear * 200)) val = lerp(val, 0, 0.5);
                // Cavity Dirt (Darkens crevices - makes them rougher)
                if (params.cavityDirt > 0 && edgeMag > (255 - params.cavityDirt * 200)) val = lerp(val, 255, 0.5);

                if (cyberNoise > 0.5 && params.cyberDetail > 0) val = 10;
                // Noise influences roughness
                if (params.noise > 0) val += (Math.random() - 0.5) * params.noise * 50;
            }
            else if (type === 'metallic') {
                // NEW: Start from metallicBase, then apply contrast adjustments
                const baseMetal = (params.metallicBase ?? 0) * 255;
                val = baseMetal + (baseLum - 128) * params.metalContrast * 0.2 + params.metalBias;
                // Edge Wear makes metal exposed (white)
                if (params.edgeWear > 0 && edgeMag > (255 - params.edgeWear * 200)) val = lerp(val, 255, 0.7);
                // Cavity Dirt covers metal (black)
                if (params.cavityDirt > 0 && edgeMag > (255 - params.cavityDirt * 200)) val = lerp(val, 0, 0.7);
                if (params.grunge > 0) val = lerp(val, 0, Math.random() * params.grunge);
                if (cyberNoise > 0.5 && params.cyberDetail > 0) val = 255;
            }
            else if (type === 'ao') {
                // Simple AO Approximation from luminance
                val = (val * params.aoIntensity) + (255 * (1 - params.aoIntensity));
                if (params.grunge > 0) val -= Math.random() * params.grunge * 50;
            }
            else if (type === 'height') {
                val = (val - 128) * params.heightContrast + 128;
                if (cyberNoise > 0.5 && params.cyberDetail > 0) val += 50;
            }
            val = clamp(val, 0, 255);
            out[i] = val; out[i + 1] = val; out[i + 2] = val; out[i + 3] = 255;
        }
    }

    ctx.putImageData(outputData, 0, 0);
    return canvas.toDataURL('image/png');
};

export const generatePattern = (type: string, params: any) => {
    const canvas = sharedCanvas;
    const ctx = sharedCtx;
    if (!ctx) return null;

    const w = 1024;
    const h = 1024;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    if (type === 'checker') {
        const size = Math.floor(lerp(32, 256, params.scale));
        const cols = Math.ceil(w / size);
        const rows = Math.ceil(h / size);
        ctx.fillStyle = '#fff';
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if ((x + y) % 2 === 0) ctx.fillRect(x * size, y * size, size, size);
            }
        }
    } else if (type === 'noise') {
        const imgData = ctx.createImageData(w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const val = Math.random() * 255;
            data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    } else if (type === 'bricks') {
        const rows = Math.floor(lerp(4, 32, params.scale));
        const brickH = h / rows;
        const brickW = brickH * 2;
        ctx.fillStyle = '#fff';
        const gap = brickH * 0.1;

        for (let y = 0; y < rows; y++) {
            const offset = (y % 2) * (brickW / 2);
            const cols = Math.ceil(w / brickW) + 1;
            for (let x = -1; x < cols; x++) {
                ctx.fillRect(x * brickW + offset + gap / 2, y * brickH + gap / 2, brickW - gap, brickH - gap);
            }
        }
    }

    return canvas.toDataURL('image/png');
};

export const packORM = (img: HTMLImageElement, params: any) => {
    const canvas = sharedCanvas;
    const ctx = sharedCtx;
    if (!ctx) return null;

    const w = Math.floor(img.width);
    const h = Math.floor(img.height);
    if (w === 0 || h === 0) return null;
    canvas.width = w; canvas.height = h;

    if (params.makeSeamless) {
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 0.5;
        ctx.drawImage(canvas, -w / 2, -h / 2); ctx.drawImage(canvas, w / 2, -h / 2);
        ctx.drawImage(canvas, -w / 2, h / 2); ctx.drawImage(canvas, w / 2, h / 2);
        ctx.globalAlpha = 1.0;
    } else { ctx.drawImage(img, 0, 0); }

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outputData = ctx.createImageData(w, h);
    const out = outputData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        const noise = (Math.random() - 0.5) * params.wear * 255;
        let ao = (gray) * params.aoIntensity + 255 * (1 - params.aoIntensity);
        let rough = params.roughnessInvert ? (255 - gray) : gray;
        rough = (rough - 128) * params.roughnessContrast + 128 + params.roughnessBrightness + noise;
        let metal = (gray - 128) * params.metalContrast + 128 + params.metalBias;
        out[i] = Math.min(255, Math.max(0, ao));
        out[i + 1] = Math.min(255, Math.max(0, rough));
        out[i + 2] = Math.min(255, Math.max(0, metal));
        out[i + 3] = 255;
    }
    ctx.putImageData(outputData, 0, 0);
    return canvas.toDataURL();
};

export const generateAITexture = async (prompt: string) => {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: `seamless pbr texture, material study, flat lighting, no perspective, full frame, high detail, ${prompt}` }],
                parameters: { sampleCount: 1, aspectRatio: "1:1" }
            })
        });
        const data = await response.json();
        if (data.predictions?.[0]?.bytesBase64Encoded) {
            return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
        }
    } catch (e) { console.error(e); }
    return null;
};

// ============================================================================
// 🦀 RUST-ACCELERATED PBR GENERATION
// ============================================================================

import { rustPbr, PbrParams, PbrMapSet } from '../../../services/pbrClient';

/**
 * Convert HTMLImageElement to base64 data URL
 */
const imageToBase64 = (img: HTMLImageElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
};

/**
 * Generate ALL PBR maps in parallel using Rust (10-50x faster!)
 * Falls back to JS if Rust is unavailable.
 */
export const processAllPbrMapsRust = async (
    img: HTMLImageElement,
    params: any
): Promise<{ base: string; normal: string; roughness: string; metallic: string; ao: string; height: string; time_ms: number } | null> => {
    try {
        // Convert params to Rust format
        const rustParams: Partial<PbrParams> = {
            normal_strength: params.normalStrength || 1.0,
            roughness_brightness: params.roughnessBrightness || 0.0,
            roughness_contrast: params.roughnessContrast || 1.0,
            roughness_invert: params.roughnessInvert || false,
            metal_bias: params.metalBias || 0.0,
            metal_contrast: params.metalContrast || 1.0,
            dust: params.dust || 0.0,
            grunge: params.grunge || 0.0,
            scratches: params.scratches || 0.0,
            noise: params.noise || 0.0,
            edge_wear: params.edgeWear || 0.0,
            cavity_dirt: params.cavityDirt || 0.0,
            brightness: params.brightness || 1.0,
            contrast: params.contrast || 1.0,
            gamma: params.gamma || 1.0,
            chromatic: params.chromatic || 0.0,
            make_seamless: params.makeSeamless || false,
        };

        const imageBase64 = imageToBase64(img);
        console.log('[KAutopbr] 🦀 Generating PBR maps with Rust...');

        const result = await rustPbr.generatePbrMaps(imageBase64, rustParams);

        console.log(`[KAutopbr] 🦀 PBR maps generated in ${result.time_ms.toFixed(1)}ms`);

        return {
            base: result.base || imageBase64,
            normal: result.normal || '',
            roughness: result.roughness || '',
            metallic: result.metallic || '',
            ao: result.ao || '',
            height: result.height || '',
            time_ms: result.time_ms,
        };
    } catch (error) {
        console.warn('[KAutopbr] Rust PBR generation failed, falling back to JS:', error);
        return null;
    }
};

/**
 * Generate just the normal map using Rust (for quick preview)
 */
export const generateNormalMapRust = async (
    img: HTMLImageElement,
    strength: number = 1.0
): Promise<string | null> => {
    try {
        const imageBase64 = imageToBase64(img);
        return await rustPbr.generateNormalMap(imageBase64, strength);
    } catch (error) {
        console.warn('[KAutopbr] Rust normal map failed:', error);
        return null;
    }
};
