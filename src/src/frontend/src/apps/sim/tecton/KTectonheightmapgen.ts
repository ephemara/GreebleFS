
import * as THREE from 'three';

// --- PSEUDO RANDOM ---
class Random {
    seed: number;
    constructor(seed: number) { this.seed = seed; }
    // Mulberry32
    next() {
        var t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// --- ROBUST SIMPLEX NOISE (3D capable but used for 2D) ---
class SimplexNoise {
    perm: Uint8Array;
    grad3: Float32Array;
    
    constructor(r: Random) {
        this.perm = new Uint8Array(512);
        this.grad3 = new Float32Array([1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1]);
        const p = new Uint8Array(256);
        for(let i=0; i<256; i++) p[i] = i;
        for(let i=255; i>0; i--) {
            const n = Math.floor(r.next() * (i+1));
            const q = p[i]; p[i] = p[n]; p[n] = q;
        }
        for(let i=0; i<512; i++) this.perm[i] = p[i & 255];
    }

    noise2D(xin: number, yin: number) {
        let n0=0, n1=0, n2=0; 
        const F2 = 0.5*(Math.sqrt(3.0)-1.0);
        const s = (xin+yin)*F2; 
        const i = Math.floor(xin+s);
        const j = Math.floor(yin+s);
        const G2 = (3.0-Math.sqrt(3.0))/6.0;
        const t = (i+j)*G2;
        const X0 = i-t; 
        const Y0 = j-t;
        const x0 = xin-X0; 
        const y0 = yin-Y0;
        
        let i1, j1;
        if(x0>y0) {i1=1; j1=0;} else {i1=0; j1=1;}
        
        const x1 = x0 - i1 + G2; 
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0*G2; 
        const y2 = y0 - 1.0 + 2.0*G2;
        
        const ii = i & 255; 
        const jj = j & 255;
        
        const gi0 = this.perm[ii+this.perm[jj]] % 12;
        const gi1 = this.perm[ii+i1+this.perm[jj+j1]] % 12;
        const gi2 = this.perm[ii+1+this.perm[jj+1]] % 12;
        
        let t0 = 0.5 - x0*x0 - y0*y0;
        if(t0<0) n0 = 0.0; 
        else { 
            t0 *= t0; 
            n0 = t0 * t0 * (this.grad3[gi0*3]*x0 + this.grad3[gi0*3+1]*y0); 
        }
        
        let t1 = 0.5 - x1*x1 - y1*y1;
        if(t1<0) n1 = 0.0; 
        else { 
            t1 *= t1; 
            n1 = t1 * t1 * (this.grad3[gi1*3]*x1 + this.grad3[gi1*3+1]*y1); 
        }
        
        let t2 = 0.5 - x2*x2 - y2*y2;
        if(t2<0) n2 = 0.0; 
        else { 
            t2 *= t2; 
            n2 = t2 * t2 * (this.grad3[gi2*3]*x2 + this.grad3[gi2*3+1]*y2); 
        }
        
        return 70.0 * (n0 + n1 + n2);
    }
}

export const generateTerrainData = (width: number, height: number, seed: number) => {
    const size = width * height;
    const data = new Float32Array(size * 4);
    const rng = new Random(seed);
    const simplex = new SimplexNoise(rng);

    // FBM Settings
    const octaves = 6;
    const persistence = 0.5;
    const lacunarity = 2.0;
    const scale = 3.0; // Zoom out slightly

    let minVal = Infinity;
    let maxVal = -Infinity;

    // 1. Generate Noise
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        const nx = x / width - 0.5;
        const ny = y / height - 0.5;
        
        let amplitude = 1.0;
        let frequency = 1.0;
        let noiseVal = 0.0;
        let maxValue = 0.0;
        
        for (let o = 0; o < octaves; o++) {
            noiseVal += simplex.noise2D(nx * scale * frequency, ny * scale * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        // Basic normalization within loop to avoid extreme values
        let h = (noiseVal / maxValue) + 0.5;
        
        // Island Mask
        const d = Math.sqrt(nx*nx + ny*ny) * 2.0; 
        const mask = 1.0 - Math.pow(d, 2.5);
        h *= mask;
        
        // Ridged mountains
        h = Math.pow(Math.abs(h), 1.2);

        buffer[i] = h;
        
        if (h < minVal) minVal = h;
        if (h > maxVal) maxVal = h;
    }

    // 2. Normalize and Fill Data
    const range = maxVal - minVal;
    for (let i = 0; i < size; i++) {
        let val = buffer[i];
        if (range > 0.0001) {
            val = (val - minVal) / range;
        } else {
            val = 0.5;
        }
        
        data[i * 4] = val;     // R: Height
        data[i * 4 + 1] = 0; 
        data[i * 4 + 2] = 0; 
        data[i * 4 + 3] = 1; 
    }

    return data;
};
