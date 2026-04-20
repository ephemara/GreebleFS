
import * as THREE from 'three';

// --- CONSTANTS ---
export const apiKey = process.env.API_KEY;

export const SHAPES = {
  SPHERE: 'sphere', CUBE: 'cube', CYLINDER: 'cylinder', CONE: 'cone',
  TORUS: 'torus', SPIKE: 'spike', PIPE: 'pipe', CRYSTAL: 'crystal', GREEBLE: 'greeble',
  PYRAMID: 'pyramid', CAPSULE: 'capsule', RING: 'ring', ICOSA: 'icosa',
  WALL: 'wall', PLATFORM: 'platform', PILLAR: 'pillar', TOWER: 'tower', ARC: 'arc',
  TENTACLE: 'tentacle', SPINE: 'spine', SWARM: 'swarm', CITY: 'city',
  STRUCT: 'struct', FRACTAL: 'fractal',
  CHAIN: 'chain', GEAR: 'gear', FLORA: 'flora', RUINS: 'ruins'
};

// --- SHARED CANVAS ---
const sharedCanvas = document.createElement('canvas');
const sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });

// --- UTILS ---
export const processImage = (img: HTMLImageElement, type: string, params: any) => {
  const canvas = sharedCanvas;
  const ctx = sharedCtx;
  if (!ctx) return null;

  const w = Math.floor(img.width);
  const h = Math.floor(img.height);
  if (w === 0 || h === 0) return null;
  canvas.width = w; canvas.height = h;

  if (params.makeSeamless) {
    ctx.drawImage(img, 0, 0, w, h);
    const temp = document.createElement('canvas');
    temp.width = w; temp.height = h;
    const tCtx = temp.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(img, 0, 0, w, h);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(temp, -w / 2, -h / 2, w, h); ctx.drawImage(temp, w / 2, -h / 2, w, h);
      ctx.drawImage(temp, -w / 2, h / 2, w, h); ctx.drawImage(temp, w / 2, h / 2, w, h);
      ctx.globalAlpha = 1.0;
    }
  } else { ctx.drawImage(img, 0, 0); }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const outputData = ctx.createImageData(w, h);
  const out = outputData.data;

  const applyHue = (r: number, g: number, b: number, hue: number) => {
    if (hue === 0) return [r, g, b];
    const cosA = Math.cos(hue * Math.PI / 180);
    const sinA = Math.sin(hue * Math.PI / 180);
    const neoR = (cosA + (1.0 - cosA) / 3.0) * r + (1.0 / 3.0 * (1.0 - cosA) - Math.sqrt(1.0 / 3.0) * sinA) * g + (1.0 / 3.0 * (1.0 - cosA) + Math.sqrt(1.0 / 3.0) * sinA) * b;
    const neoG = (1.0 / 3.0 * (1.0 - cosA) + Math.sqrt(1.0 / 3.0) * sinA) * r + (cosA + 1.0 / 3.0 * (1.0 - cosA)) * g + (1.0 / 3.0 * (1.0 - cosA) - Math.sqrt(1.0 / 3.0) * sinA) * b;
    const neoB = (1.0 / 3.0 * (1.0 - cosA) - Math.sqrt(1.0 / 3.0) * sinA) * r + (1.0 / 3.0 * (1.0 - cosA) + Math.sqrt(1.0 / 3.0) * sinA) * g + (cosA + 1.0 / 3.0 * (1.0 - cosA)) * b;
    return [Math.min(255, Math.max(0, neoR)), Math.min(255, Math.max(0, neoG)), Math.min(255, Math.max(0, neoB))];
  };

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];
    if (type === 'base') {
      const [nR, nG, nB] = applyHue(r, g, b, params.hue);
      out[i] = nR; out[i + 1] = nG; out[i + 2] = nB; out[i + 3] = 255;
    }
    else if (type === 'height') {
      let gray = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      gray = ((gray - 128) * 2.0) + 128;
      gray = Math.min(255, Math.max(0, gray));
      out[i] = gray; out[i + 1] = gray; out[i + 2] = gray; out[i + 3] = 255;
    }
  }

  if (type === 'normal') {
    const getInt = (idx: number) => (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const right = (x < w - 1) ? ((y * w) + (x + 1)) * 4 : idx;
        const bottom = (y < h - 1) ? (((y + 1) * w) + x) * 4 : idx;
        const strength = Math.max(0.1, params.normalStrength);
        const dx = (getInt(right) - getInt(idx)) * strength * 0.15;
        const dy = (getInt(bottom) - getInt(idx)) * strength * 0.15;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        out[idx] = (0.5 + 0.5 * (dx / len)) * 255;
        out[idx + 1] = (0.5 + 0.5 * (dy / len)) * 255;
        out[idx + 2] = (1.0 / len) * 255;
        out[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(outputData, 0, 0);
  return canvas.toDataURL();
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

export const generateTexture = async (prompt: string) => {
  const maxRetries = 3; let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: [{ prompt: `seamless pbr texture, material study, flat lighting, no perspective, full frame, high detail, ${prompt}` }], parameters: { sampleCount: 1, aspectRatio: "1:1" } })
      });
      if (!response.ok) throw new Error(`API Status: ${response.status}`);
      const data = await response.json();
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (b64) return { url: `data:image/png;base64,${b64}` };
      throw new Error("No data received");
    } catch (e: any) {
      if (i === maxRetries - 1) return { error: e.message || String(e) };
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return { error: "Failed" };
};

export const generateSceneLayout = async (userPrompt: string) => {
  try {
    const systemPrompt = `
        You are 'Titan Architect', a 3D Scene Layout Engine.
        Goal: Construct complex, grounded 3D structures based on: "${userPrompt}".
        
        LAYER SYSTEM (CRITICAL):
        - Group objects into named LAYERS. This is how the user will texture them later.
        - Example: For "A car in a forest", create "Car Body", "Wheels", "Trees", "Ground".
        
        GEOMETRY RULES:
        1. Y is UP. Ground is Y=0.
        2. Origins are BOTTOM CENTER.
        3. To stack, add Y position + scale.y.
        
        SHAPES: [cube, sphere, cylinder, cone, torus, pyramid, capsule, ring, icosa, wall, platform, pillar, tower, arc, greeble, tentacle, spine, swarm, city, struct, fractal, chain, gear, flora, ruins]

        RETURN JSON ONLY:
        {
          "layers": [
            {
              "name": "LayerName",
              "objects": [
                 { "type": "cube", "pos": [0, 0, 0], "rot": [0, 0, 0], "scale": [1, 1, 1] }
              ]
            }
          ]
        }
        `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) throw new Error("AI Layout Failed");
    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty AI Response");

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.error("Architect Error:", e);
    return null;
  }
};

export const createGeometry = (type: string) => {
  const seg = 128; // Increased from 64 for higher quality
  switch (type) {
    case SHAPES.CUBE: return new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).translate(0, 0.5, 0); // Box doesn't need high segs unless deformed
    case SHAPES.SPHERE: return new THREE.SphereGeometry(0.5, seg, seg).translate(0, 0.5, 0);
    case SHAPES.CYLINDER: return new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 1).translate(0, 0.5, 0);
    case SHAPES.CONE: return new THREE.ConeGeometry(0.5, 1, seg, 1).translate(0, 0.5, 0);
    case SHAPES.TORUS: return new THREE.TorusGeometry(0.4, 0.2, seg, seg).rotateX(-Math.PI / 2).translate(0, 0.2, 0);
    case SHAPES.SPIKE: return new THREE.ConeGeometry(0.2, 2, seg, 1).translate(0, 1, 0);
    case SHAPES.PIPE: return new THREE.TorusKnotGeometry(0.4, 0.15, 256, 32, 2, 3).translate(0, 0.6, 0);
    case SHAPES.CRYSTAL: return new THREE.OctahedronGeometry(0.5, 0).translate(0, 0.5, 0); // Low poly style
    case SHAPES.PYRAMID: return new THREE.ConeGeometry(0.5, 1, 4, 1).translate(0, 0.5, 0);
    case SHAPES.ICOSA: return new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.5, 0);
    case SHAPES.CAPSULE: return new THREE.CapsuleGeometry(0.3, 0.8, 8, 64).translate(0, 0.7, 0);
    case SHAPES.RING: return new THREE.TorusGeometry(0.5, 0.1, 64, 128).rotateX(-Math.PI / 2).translate(0, 0.1, 0);
    case SHAPES.WALL: return new THREE.BoxGeometry(2, 1, 0.2).translate(0, 0.5, 0);
    case SHAPES.PLATFORM: return new THREE.BoxGeometry(2, 0.2, 2).translate(0, 0.1, 0);
    case SHAPES.PILLAR: return new THREE.CylinderGeometry(0.2, 0.2, 2, 32).translate(0, 1, 0);
    case SHAPES.TOWER: return new THREE.BoxGeometry(0.5, 3, 0.5).translate(0, 1.5, 0);
    case SHAPES.ARC: return new THREE.TorusGeometry(1, 0.2, 32, 64, Math.PI).rotateY(Math.PI / 2).translate(0, 0, 0);
    default: return new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  }
};

export const generateSuperGreeble = (material: THREE.Material) => {
  const container = new THREE.Group();
  container.userData.isContainer = true;
  const coreW = 0.5 + Math.random() * 0.5; const coreH = 0.5 + Math.random() * 0.5; const coreD = 0.5 + Math.random() * 0.5;
  const core = new THREE.Mesh(new THREE.BoxGeometry(coreW, coreH, coreD), material);
  core.castShadow = true; core.receiveShadow = true; container.add(core);
  const numModules = 4 + Math.floor(Math.random() * 6);
  for (let i = 0; i < numModules; i++) {
    const type = Math.floor(Math.random() * 4);
    const modMesh = new THREE.Mesh(); modMesh.castShadow = true; modMesh.receiveShadow = true; modMesh.material = material;
    const face = Math.floor(Math.random() * 6); const offset = 0.05;
    if (type === 0) { modMesh.geometry = new THREE.BoxGeometry(coreW * 0.8, coreH * 0.1, coreD * 0.8); if (face < 2) modMesh.scale.set(1, 1, 1); else modMesh.scale.set(0.1, 1, 1); }
    else if (type === 1) { modMesh.geometry = new THREE.BoxGeometry(coreW * 0.9, coreH * 0.05, coreD * 0.05); }
    else if (type === 2) { modMesh.geometry = new THREE.CylinderGeometry(0.1, 0.1, Math.max(coreW, coreH), 16); modMesh.rotation.z = Math.PI / 2; }
    else { modMesh.geometry = new THREE.SphereGeometry(0.15, 16, 16); }
    if (face === 0 || face === 1) { modMesh.position.set((Math.random() - 0.5) * coreW, (face === 0 ? 1 : -1) * (coreH / 2 + offset), (Math.random() - 0.5) * coreD); }
    else if (face === 2 || face === 3) { modMesh.position.set((face === 2 ? 1 : -1) * (coreW / 2 + offset), (Math.random() - 0.5) * coreH, (Math.random() - 0.5) * coreD); modMesh.rotation.z = Math.PI / 2; }
    else { modMesh.position.set((Math.random() - 0.5) * coreW, (Math.random() - 0.5) * coreH, (face === 4 ? 1 : -1) * (coreD / 2 + offset)); modMesh.rotation.x = Math.PI / 2; }
    container.add(modMesh);
  }
  return container;
};
